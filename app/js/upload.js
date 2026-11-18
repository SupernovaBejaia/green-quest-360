// File d'envoi vers Google Drive (via le script Apps Script de l'organisateur).
// Chaque fichier est envoyé séparément : si la connexion coupe, on reprend là où on s'était arrêté.
import { CONFIG } from './config.js';
import { getBlob, getCapture, listCaptures, saveCapture } from './db.js';

let running = null;
const listeners = new Set();
export const onUploadChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (c) => listeners.forEach((fn) => fn(c));

export const uploadConfigured = () => !!(CONFIG.uploadUrl && CONFIG.uploadKey);

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function call(body, timeoutMs = 120000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // text/plain : requête "simple", pas de pré-vérification CORS (indispensable avec Apps Script).
    const res = await fetch(CONFIG.uploadUrl, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctrl.signal, redirect: 'follow' });
    const txt = await res.text();
    let json;
    try { json = JSON.parse(txt); } catch { throw new Error('Réponse inattendue du serveur'); }
    if (!json.ok) throw new Error(json.error || 'Erreur serveur');
    return json;
  } finally { clearTimeout(to); }
}

export async function testConnection() {
  if (!uploadConfigured()) return false;
  try { const r = await call({ key: CONFIG.uploadKey, action: 'ping' }, 20000); return !!r.ok; } catch { return false; }
}

export function folderNameFor(c) {
  const d = new Date(c.createdAt);
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}`;
  const clean = (s) => (s || '').normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 30);
  return [stamp, clean(c.meta.participant) || 'anonyme', c.meta.category, clean(c.meta.place), c.id.slice(-4)].filter(Boolean).join('_');
}

function fileList(c, withSources) {
  const files = [{ key: `${c.id}/pano`, name: `${folderNameFor(c)}_360.jpg`, mime: 'image/jpeg', main: true }];
  if (withSources) c.shots.forEach((s, i) => files.push({ key: `${c.id}/shot_${i}`, name: `source_${String(i + 1).padStart(2, '0')}.jpg`, mime: 'image/jpeg', dir: 'sources' }));
  return files;
}

function metaJson(c) {
  return JSON.stringify({
    id: c.id, createdAt: new Date(c.createdAt).toISOString(), app: 'Green Quest 360', version: 1,
    meta: c.meta, location: c.location, pano: { width: c.panoW, height: c.panoW / 2 },
    stitch: c.stitch, focalNorm: c.focalNorm,
    shots: c.shots.map((s, i) => ({ file: `sources/source_${String(i + 1).padStart(2, '0')}.jpg`, R: s.R, w: s.w, h: s.h, target: s.target })),
  }, null, 1);
}

async function uploadOne(c, withSources) {
  const folder = folderNameFor(c);
  const files = fileList(c, withSources);
  c.uploaded = c.uploaded || {};
  const total = files.length + 2;
  let done = 0;
  const step = async () => { done++; c.progress = Math.round((done / total) * 100); await saveCapture(c); emit(c); };

  const sendFile = async (f) => {
    if (c.uploaded[f.name]) { await step(); return; }
    const blob = await getBlob(f.key);
    if (!blob) { await step(); return; }
    const r = await call({ key: CONFIG.uploadKey, action: 'file', folder, subfolder: f.dir || '', name: f.name, mime: f.mime, data: await blobToBase64(blob) });
    c.uploaded[f.name] = r.url || true;
    if (f.main) { c.remote = { panoUrl: r.url, folderUrl: r.folderUrl }; }
    await step();
  };
  // La photo 360 puis la première source passent seules (elles créent les dossiers côté Drive),
  // le reste part 3 par 3 : Google met ~5 s par fichier, l'envoi va donc 3 fois plus vite.
  await sendFile(files[0]);
  if (files[1]) await sendFile(files[1]);
  const rest = files.slice(2);
  let failure = null;
  // Au premier échec, les autres envois s'arrêtent après leur fichier en cours :
  // la reprise ne démarre qu'une fois tout le monde arrêté (sinon : doublons).
  const worker = async () => {
    while (rest.length && !failure) {
      try { await sendFile(rest.shift()); } catch (e) { failure = failure || e; }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (failure) throw failure;
  if (!c.uploaded['meta.json']) {
    const r = await call({ key: CONFIG.uploadKey, action: 'file', folder, subfolder: '', name: 'meta.json', mime: 'application/json', data: btoa(unescape(encodeURIComponent(metaJson(c)))) });
    c.uploaded['meta.json'] = r.url || true;
  }
  await step();
  if (!c.uploaded['__record']) {
    await call({ key: CONFIG.uploadKey, action: 'record', folder, record: {
      id: c.id, date: new Date(c.createdAt).toISOString(), participant: c.meta.participant, team: c.meta.team,
      category: c.meta.category, place: c.meta.place, note: c.meta.note,
      lat: c.location?.lat ?? '', lon: c.location?.lon ?? '', accuracy: c.location?.accuracy ?? '',
      panoUrl: c.remote?.panoUrl || '', shots: c.shots.length,
    } });
    c.uploaded['__record'] = true;
  }
  await step();
  c.status = 'sent'; c.sentAt = Date.now(); c.error = null;
  await saveCapture(c); emit(c);
}

// Envoie tout ce qui n'est pas encore parti. Un seul envoi à la fois.
export function uploadPending({ withSources } = {}) {
  if (running) return running;
  if (!uploadConfigured() || !navigator.onLine) return Promise.resolve();
  const ws = withSources ?? getSendSources();
  running = (async () => {
    const all = await listCaptures();
    for (const c0 of all.filter((x) => x.status === 'ready' || x.status === 'error' || x.status === 'sending').reverse()) {
      const c = await getCapture(c0.id);
      try {
        c.status = 'sending'; c.progress = c.progress || 0; await saveCapture(c); emit(c);
        await uploadOne(c, ws);
      } catch (e) {
        c.status = 'error'; c.error = String(e.message || e); await saveCapture(c); emit(c);
        if (!navigator.onLine) break;
      }
    }
  })().finally(() => { running = null; });
  return running;
}

export function getSendSources() {
  try { const v = localStorage.getItem('gq_sources'); return v == null ? CONFIG.sendSourcesDefault : v === '1'; } catch { return CONFIG.sendSourcesDefault; }
}
export function setSendSources(v) { try { localStorage.setItem('gq_sources', v ? '1' : '0'); } catch {} }

// Reprise automatique : au retour du réseau, et régulièrement tant que l'app est ouverte.
export function startAutoUpload() {
  window.addEventListener('online', () => uploadPending());
  setInterval(() => { if (navigator.onLine) uploadPending(); }, 60000);
  setTimeout(() => uploadPending(), 3000);
}
