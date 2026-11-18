/**
 * Green Quest 360 — réception des photos dans Google Drive.
 *
 * Installation (5 minutes, une seule fois) : voir docs/INSTALLATION.md
 *  1. Créez un dossier dans votre Drive, ex. "Green Quest 360", et copiez son identifiant
 *     (la partie après /folders/ dans l'adresse) dans ROOT_FOLDER_ID ci-dessous.
 *  2. Choisissez une clé secrète (n'importe quel mot de passe long) et mettez-la dans KEY,
 *     ainsi que dans app/js/config.js (uploadKey).
 *  3. Déployer > Nouveau déploiement > Application Web
 *       Exécuter en tant que : Moi
 *       Qui a accès : Tout le monde
 *     Copiez l'URL (…/exec) dans app/js/config.js (uploadUrl).
 *
 * Organisation dans le Drive :
 *   Green Quest 360/
 *     Relevés Green Quest 360   (Google Sheet : une ligne par photo, avec GPS -> importable dans Google My Maps)
 *     2026-11-20/
 *       2026-11-20_10h32_Amina_waste_before_Plage-Sablettes_ab12/
 *         ..._360.jpg   (photo 360, reconnue par Google Photos / Facebook / Kuula)
 *         meta.json     (infos + orientation de chaque photo source)
 *         sources/      (photos sources, pour refaire une version HD sur ordinateur)
 */

const ROOT_FOLDER_ID = '1aT-aEzUjJ7kY0h8F_VtU7A-v7ZEpCfBk'; // Drive : Green Quest Cartographie
const KEY = 'gq360-D4V6lQUFeiTDT4ffM7FVC2xi';

const CATEGORY_LABELS = {
  waste_before: 'Déchets — avant nettoyage',
  waste_after: 'Déchets — après nettoyage',
  heritage: 'Lieu historique',
  other: 'Autre',
};

function doGet() {
  return json_({ ok: true, app: 'Green Quest 360', info: 'Service de réception actif.' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.key !== KEY) return json_({ ok: false, error: 'Clé invalide' });
    if (body.action === 'ping') return json_({ ok: true });
    if (body.action === 'file') return json_(saveFile_(body));
    if (body.action === 'record') return json_(saveRecord_(body));
    return json_({ ok: false, error: 'Action inconnue' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function childFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function captureFolder_(folderName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const day = String(folderName).slice(0, 10); // AAAA-MM-JJ
    return childFolder_(childFolder_(root, day), folderName);
  } finally {
    lock.releaseLock();
  }
}

function saveFile_(b) {
  const safe = (s) => String(s || '').replace(/[\/\\]/g, '-').slice(0, 120);
  let folder = captureFolder_(safe(b.folder));
  if (b.subfolder) folder = childFolder_(folder, safe(b.subfolder));
  const name = safe(b.name);
  // Renvoi après coupure réseau : si le fichier existe déjà, on ne le duplique pas.
  const existing = folder.getFilesByName(name);
  let file;
  if (existing.hasNext()) {
    file = existing.next();
  } else {
    const bytes = Utilities.base64Decode(b.data);
    file = folder.createFile(Utilities.newBlob(bytes, b.mime || 'application/octet-stream', name));
  }
  return { ok: true, id: file.getId(), url: file.getUrl(), folderUrl: captureFolder_(safe(b.folder)).getUrl() };
}

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Relevés Green Quest 360');
    DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(ROOT_FOLDER_ID));
    props.setProperty('SHEET_ID', ss.getId());
    const sh = ss.getSheets()[0];
    sh.setName('Relevés');
    sh.appendRow(['Date', 'Participant', 'Équipe', 'Type', 'Lieu', 'Remarque', 'Latitude', 'Longitude', 'Précision GPS (m)', 'Photo 360', 'Dossier', 'Photos sources', 'ID']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 13).setFontWeight('bold');
  }
  return ss.getSheetByName('Relevés') || ss.getSheets()[0];
}

function saveRecord_(b) {
  const r = b.record || {};
  const folder = captureFolder_(String(b.folder)); // prend et relâche son propre verrou
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    // Pas de doublon si l'envoi est rejoué
    const ids = sh.getRange(1, 13, Math.max(1, sh.getLastRow()), 1).getValues().map(function (x) { return x[0]; });
    if (ids.indexOf(r.id) === -1) {
      sh.appendRow([
        r.date ? new Date(r.date) : new Date(), r.participant || '', r.team || '', CATEGORY_LABELS[r.category] || r.category || '',
        r.place || '', r.note || '', r.lat, r.lon, r.accuracy, r.panoUrl || '', folder.getUrl(), r.shots || '', r.id,
      ]);
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}
