// Préparation des photos et appel du worker d'assemblage (utilisé par l'app et par l'atelier HD).
import { addPanoMetadata } from './jpeg-meta.js';

async function decodeTo(blob, longSide) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, longSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return g.getImageData(0, 0, w, h);
}

function toGray(img) {
  const g = new Uint8Array(img.width * img.height), d = img.data;
  for (let i = 0; i < g.length; i++) g[i] = (d[4 * i] * 77 + d[4 * i + 1] * 150 + d[4 * i + 2] * 29) >> 8;
  return g;
}

function runWorker(msg, transfer, onProgress) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./stitch.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.stage, m.p);
      else if (m.type === 'done') { w.terminate(); resolve(m); }
      else if (m.type === 'error') { w.terminate(); reject(new Error(m.message)); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'worker')); };
    w.postMessage(msg, transfer);
  });
}

// shots : [{ blob, R }]
export async function stitchShots(shots, { focalNorm, outW, onProgress = () => {}, maxRenderLong = 2600 }) {
  const MATCH_LONG = 512;
  const fovLongDeg = 2 * Math.atan(0.5 / focalNorm) * 180 / Math.PI;
  const renderLong = Math.round(Math.min(maxRenderLong, (outW / 360) * fovLongDeg * 1.15));
  const images = [], transfer = [];
  for (let i = 0; i < shots.length; i++) {
    onProgress('prepare', i / shots.length);
    const s = shots[i];
    const m = await decodeTo(s.blob, MATCH_LONG);
    const c = await decodeTo(s.blob, renderLong);
    const gray = toGray(m);
    images.push({ mw: m.width, mh: m.height, gray, cw: c.width, ch: c.height, color: c.data, R: s.R });
    transfer.push(gray.buffer, c.data.buffer);
  }
  return runWorker({ cmd: 'stitch', images, focalNorm, outW, refine: true }, transfer, onProgress);
}

export async function encodePano(res, location, quality = 0.9) {
  const c = document.createElement('canvas'); c.width = res.w; c.height = res.h;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(res.rgba.buffer), res.w, res.h), 0, 0);
  const raw = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
  const pano = await addPanoMetadata(raw, { width: res.w, height: res.h, lat: location?.lat, lon: location?.lon, alt: location?.alt });
  const tc = document.createElement('canvas'); tc.width = 480; tc.height = 240;
  tc.getContext('2d').drawImage(c, 0, 0, 480, 240);
  const thumb = await new Promise((r) => tc.toBlob(r, 'image/jpeg', 0.8));
  return { pano, thumb, canvas: c };
}
