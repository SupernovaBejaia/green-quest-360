// Petite bibliothèque de géométrie 3D partagée par l'app et le worker d'assemblage.
// Conventions :
//  - Monde : x = est, y = nord, z = haut (convention DeviceOrientation du W3C).
//  - Caméra : x = droite de l'image, y = bas de l'image, z = direction de visée.
//  - Matrices 3x3 en tableaux de 9 nombres, ligne par ligne.
//  - "Rcw" = rotation caméra -> monde.

export const DEG = Math.PI / 180;

export function mul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}

export function transpose(a) {
  return [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
}

export function apply(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function applyT(m, v) {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
}

export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

export function normalize(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

export function angleBetween(a, b) {
  return Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b)))));
}

// Rotation de Rodrigues : vecteur rotation (radians) -> matrice.
export function expMap(r) {
  const th = Math.hypot(r[0], r[1], r[2]);
  if (th < 1e-12) return [1, -r[2], r[1], r[2], 1, -r[0], -r[1], r[0], 1];
  const k = [r[0] / th, r[1] / th, r[2] / th];
  const c = Math.cos(th), s = Math.sin(th), t = 1 - c;
  return [
    t * k[0] * k[0] + c, t * k[0] * k[1] - s * k[2], t * k[0] * k[2] + s * k[1],
    t * k[0] * k[1] + s * k[2], t * k[1] * k[1] + c, t * k[1] * k[2] - s * k[0],
    t * k[0] * k[2] - s * k[1], t * k[1] * k[2] + s * k[0], t * k[2] * k[2] + c,
  ];
}

export function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
export function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
export function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }

// Appareil -> caméra arrière : x identique, y inversé (le haut du téléphone = haut de l'image),
// z inversé (la caméra arrière regarde à l'opposé de l'écran).
const CAM_TO_DEVICE = [1, 0, 0, 0, -1, 0, 0, 0, -1];

// DeviceOrientation (alpha, beta, gamma en degrés) -> rotation appareil -> monde.
export function deviceFromEuler(alpha, beta, gamma) {
  return mul(mul(rotZ(alpha * DEG), rotX(beta * DEG)), rotY(gamma * DEG));
}

// Quaternion [x, y, z, w] (RelativeOrientationSensor) -> rotation appareil -> monde.
export function deviceFromQuat(q) {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
}

// Corrige la rotation de l'écran (0, 90, 180, 270) : on travaille dans le repère de l'écran affiché.
export function screenAdjust(Rdev, screenAngleDeg) {
  if (!screenAngleDeg) return Rdev;
  return mul(Rdev, rotZ(-screenAngleDeg * DEG));
}

export function camToWorld(Rdev) { return mul(Rdev, CAM_TO_DEVICE); }

export function forwardOf(Rcw) { return [Rcw[2], Rcw[5], Rcw[8]]; }

export function yawPitchOf(v) {
  const n = normalize(v);
  return { yaw: Math.atan2(n[0], n[1]), pitch: Math.asin(Math.max(-1, Math.min(1, n[2]))) };
}

export function dirFromYawPitch(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [cp * Math.sin(yaw), cp * Math.cos(yaw), Math.sin(pitch)];
}

// Caméra qui regarde vers (yaw, pitch), image droite (pas de roulis).
export function camLookingAt(yaw, pitch, roll = 0) {
  // Partant d'une caméra qui regarde le nord à l'horizontale :
  // x caméra = est, y caméra = bas, z caméra = nord.
  const base = [1, 0, 0, 0, 0, 1, 0, -1, 0];
  return mul(mul(rotZ(-yaw), rotX(pitch)), mul(base, rotZ(roll)));
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Résout A x = b (A n x n, tableau plat), élimination de Gauss avec pivot partiel.
export function solve(A, b, n) {
  const M = A.slice(), x = b.slice();
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(M[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(M[r * n + c]); if (v > best) { best = v; p = r; } }
    if (best < 1e-14) continue;
    if (p !== c) {
      for (let k = 0; k < n; k++) { const t = M[c * n + k]; M[c * n + k] = M[p * n + k]; M[p * n + k] = t; }
      const t = x[c]; x[c] = x[p]; x[p] = t;
    }
    const d = M[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r * n + c] / d;
      if (!f) continue;
      for (let k = c; k < n; k++) M[r * n + k] -= f * M[c * n + k];
      x[r] -= f * x[c];
    }
  }
  for (let c = n - 1; c >= 0; c--) {
    let s = x[c];
    for (let k = c + 1; k < n; k++) s -= M[c * n + k] * x[k];
    const d = M[c * n + c];
    x[c] = Math.abs(d) < 1e-14 ? 0 : s / d;
  }
  return x;
}
