import { DEG } from './math.js';

// Schéma de prise de vue (téléphone tenu en portrait, champ horizontal ~50°) :
//  - horizon : 12 photos tous les 30°
//  - +45° et -45° : 8 photos chacun, décalées de 22,5° pour mieux couvrir
//  - zénith (ciel) puis nadir (sol), facultatif
export function makeTargets({ nadir = true } = {}) {
  const t = [];
  for (let k = 0; k < 12; k++) t.push({ yaw: k * 30 * DEG, pitch: 0, ring: 0 });
  for (let k = 0; k < 8; k++) t.push({ yaw: (22.5 + k * 45) * DEG, pitch: 45 * DEG, ring: 1 });
  for (let k = 0; k < 8; k++) t.push({ yaw: (22.5 + k * 45) * DEG, pitch: -45 * DEG, ring: 2 });
  t.push({ yaw: 0, pitch: 89.9 * DEG, ring: 3, pole: true });
  if (nadir) t.push({ yaw: 0, pitch: -89.9 * DEG, ring: 4, pole: true });
  return t;
}

// Champ de vision par défaut (côté long de l'image), affiné après chaque assemblage réussi.
export const DEFAULT_FOV_LONG = 66 * DEG;

export function focalNormFromFov(fovLong) { return 0.5 / Math.tan(fovLong / 2); }
