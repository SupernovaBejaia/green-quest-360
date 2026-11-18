// Écran de prise de vue guidée.
import { DEG, applyT, camToWorld, deviceFromEuler, deviceFromQuat, dirFromYawPitch, forwardOf, yawPitchOf, angleBetween, mul, expMap } from './math.js';
import { makeTargets } from './targets.js';
import { t } from './i18n.js';

const ALIGN_TOL = 4 * DEG, POLE_TOL = 7 * DEG, HOLD_MS = 650, MAX_SPEED = 7 * DEG; // rad/s

// ---------- Orientation ----------

// À appeler directement dans le gestionnaire du clic (iOS exige un geste de l'utilisateur).
export function requestMotionPermission() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') return D.requestPermission().catch(() => 'denied');
  return Promise.resolve('granted');
}

class DeviceOrientationSource {
  constructor() { this.R = null; this.listeners = []; this.stamp = 0; }
  async start() {
    // Android / Chrome : capteur de fusion (quaternion), plus précis et sans blocage de cardan.
    if ('RelativeOrientationSensor' in window) {
      try {
        const ok = await Promise.all(['accelerometer', 'gyroscope'].map((n) => navigator.permissions.query({ name: n }).then((r) => r.state !== 'denied').catch(() => true)));
        if (ok.every(Boolean)) {
          const s = new RelativeOrientationSensor({ frequency: 60, referenceFrame: 'device' });
          await new Promise((resolve, reject) => {
            const to = setTimeout(() => reject(new Error('timeout')), 1500);
            s.addEventListener('reading', () => {
              if (!s.quaternion) return;
              this._set(deviceFromQuat(s.quaternion));
              clearTimeout(to); resolve();
            });
            s.addEventListener('error', (e) => { clearTimeout(to); reject(e.error); });
            s.start();
          });
          this.sensor = s;
          return true;
        }
      } catch { /* repli sur deviceorientation */ }
    }
    return new Promise((resolve) => {
      const to = setTimeout(() => resolve(false), 2000);
      this._h = (e) => {
        if (e.alpha == null && e.beta == null) return;
        this._set(deviceFromEuler(e.alpha || 0, e.beta || 0, e.gamma || 0));
        clearTimeout(to); resolve(true);
      };
      window.addEventListener('deviceorientation', this._h);
    });
  }
  _set(Rdev) { this.R = camToWorld(Rdev); this.stamp = performance.now(); for (const l of this.listeners) l(); }
  stop() { this.sensor?.stop(); if (this._h) window.removeEventListener('deviceorientation', this._h); }
}

// ---------- Caméra ----------

class CameraSource {
  async start(video) {
    this.video = video;
    const tries = [
      { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 }, aspectRatio: { ideal: 4 / 3 } },
      { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      { facingMode: 'environment' },
    ];
    let err;
    for (const v of tries) {
      try { this.stream = await navigator.mediaDevices.getUserMedia({ video: v, audio: false }); break; } catch (e) { err = e; if (e.name === 'NotAllowedError') break; }
    }
    if (!this.stream) throw err || new Error('camera');
    video.srcObject = this.stream;
    video.setAttribute('playsinline', ''); video.muted = true;
    await video.play();
    await new Promise((r) => (video.videoWidth ? r() : video.addEventListener('loadedmetadata', r, { once: true })));
    // Mise au point continue si disponible (Android)
    const track = this.stream.getVideoTracks()[0];
    try {
      const caps = track.getCapabilities?.() || {};
      if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    } catch {}
    return true;
  }
  get width() { return this.video.videoWidth; }
  get height() { return this.video.videoHeight; }
  grab() {
    const c = document.createElement('canvas');
    c.width = this.width; c.height = this.height;
    c.getContext('2d').drawImage(this.video, 0, 0);
    return c;
  }
  stop() { this.stream?.getTracks().forEach((tr) => tr.stop()); }
}

// Simulation sur ordinateur : décor synthétique, gyroscope volontairement imprécis (dérive).
class SimSource {
  async start(canvasEl, orient, sim) {
    this.sim = sim; this.orient = orient; this.el = canvasEl;
    this.pano = sim.makeSyntheticPano(4096);
    this.fn = 0.8; // focale normalisée "vraie" du faux téléphone
    this.w = 960; this.h = 1280;
    this.preview = new ImageData(270, 360);
    const draw = () => {
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => {
        sim.renderView(this.pano, orient.trueRcw(), 270, 360, this.fn * 360, this.preview);
        canvasEl.width = 270; canvasEl.height = 360;
        canvasEl.getContext('2d').putImageData(this.preview, 0, 0);
      });
    };
    orient.listeners.push(draw); draw();
    return true;
  }
  get width() { return this.w; }
  get height() { return this.h; }
  grab() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d').putImageData(this.sim.renderView(this.pano, this.orient.trueRcw(), this.w, this.h, this.fn * this.h), 0, 0);
    return c;
  }
  stop() { cancelAnimationFrame(this._raf); }
}

class SimOrientationSource {
  constructor(simOrient) {
    this.o = simOrient; this.listeners = []; this.R = null; this.t0 = performance.now();
    simOrient.listeners.push(() => this._update());
  }
  async start() { this._update(); return true; }
  _update() {
    // Dérive lente du cap + petit bruit, comme un vrai gyroscope
    const drift = ((performance.now() - this.t0) / 1000) * 0.05 * DEG;
    this.R = mul(expMap([0.5 * DEG, -0.4 * DEG, drift]), this.o.trueRcw());
    this.stamp = performance.now();
    for (const l of this.listeners) l();
  }
  stop() {}
}

// ---------- Session de capture ----------

export class CaptureScreen {
  constructor(root, { sim = null, focalNorm, onFinish, onCancel, onError }) {
    Object.assign(this, { root, simMod: sim, focalNorm, onFinish, onCancel, onError });
    this.targets = makeTargets();
    this.shots = [];
    this.captured = new Set();
    this.holdStart = 0; this.holdTarget = -1;
    this.speed = 0; this.lastFwd = null; this.lastT = 0;
    this.flash = 0;
    this.busy = false;
  }

  async start() {
    const r = this.root;
    r.innerHTML = `
      <div class="cap">
        ${this.simMod ? '<canvas class="cap-video sim"></canvas>' : '<video class="cap-video" playsinline muted autoplay></video>'}
        <canvas class="cap-overlay"></canvas>
        <div class="cap-top"><div class="cap-count"></div><div class="cap-hint"></div></div>
        <div class="cap-flash"></div>
        <div class="cap-portrait hidden">${t('holdPortrait')}</div>
        <div class="cap-bottom">
          <button class="btn ghost cap-cancel">${t('cancel')}</button>
          <button class="btn primary cap-finish" disabled>${t('finish')}</button>
        </div>
      </div>`;
    this.overlay = r.querySelector('.cap-overlay');
    this.countEl = r.querySelector('.cap-count');
    this.hintEl = r.querySelector('.cap-hint');
    this.flashEl = r.querySelector('.cap-flash');
    this.portraitEl = r.querySelector('.cap-portrait');
    this.finishBtn = r.querySelector('.cap-finish');
    r.querySelector('.cap-cancel').onclick = () => { if (!this.shots.length || confirm(t('confirmCancel'))) { this.stop(); this.onCancel(); } };
    this.finishBtn.onclick = () => this.finish();

    try {
      if (this.simMod) {
        const so = new this.simMod.SimOrientation(this.overlay);
        window.__simOrient = so; window.__cap = this; // pilotage par les tests automatiques
        this.orient = new SimOrientationSource(so);
        this.source = new SimSource();
        await this.source.start(r.querySelector('.cap-video'), so, this.simMod);
        await this.orient.start();
      } else {
        this.orient = new DeviceOrientationSource();
        this.source = new CameraSource();
        const [motionOk] = await Promise.all([this.orient.start(), this.source.start(r.querySelector('.cap-video'))]);
        if (!motionOk) throw Object.assign(new Error(t('noMotion')), { userMessage: t('noMotion') });
      }
    } catch (e) {
      this.stop();
      const msg = e.userMessage || (e.name === 'NotAllowedError' ? t('permDenied') : t('noCamera'));
      this.onError(msg);
      return;
    }
    try { this.wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
    try { this.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    // Le premier point est droit devant, à l'horizon, dans la direction où l'on regarde.
    this.refYaw = yawPitchOf(forwardOf(this.orient.R)).yaw;
    this.dirs = this.targets.map((tg) => dirFromYawPitch(this.refYaw + tg.yaw, tg.pitch));
    this.running = true;
    const loop = () => { if (!this.running) return; this.tick(); this.raf = requestAnimationFrame(loop); };
    loop();
    // Filet de sécurité : si l'affichage est suspendu, la logique de capture continue quand même.
    this.watchdog = setInterval(() => { if (this.running && performance.now() - this.lastT > 150) this.tick(); }, 100);
  }

  requiredDone() { return this.targets.every((tg, i) => this.captured.has(i) || tg.ring === 4); }
  horizonDone() { return this.targets.every((tg, i) => this.captured.has(i) || tg.ring !== 0); }

  nextTarget(fwd) {
    const ringsDone = this.targets.every((tg, i) => this.captured.has(i) || tg.pole);
    let best = -1, bd = Infinity;
    const lastRing = this.shots.length ? this.targets[this.shots[this.shots.length - 1].target].ring : 0;
    this.targets.forEach((tg, i) => {
      if (this.captured.has(i)) return;
      if (tg.pole && !ringsDone) return;
      if (tg.ring === 4 && !this.targets.every((x, k) => this.captured.has(k) || x.ring === 4)) return;
      // Avant de quitter l'horizon, on le termine (c'est le plus important).
      if (tg.ring !== 0 && !this.horizonDone()) return;
      const d = angleBetween(fwd, this.dirs[i]) + (tg.ring !== lastRing ? 12 * DEG : 0);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  tick() {
    const now = performance.now();
    const R = this.orient.R;
    if (!R) return;
    const fwd = forwardOf(R);
    if (this.lastFwd) {
      const dt = Math.max(1, now - this.lastT) / 1000;
      const inst = angleBetween(fwd, this.lastFwd) / dt;
      this.speed = this.speed * 0.8 + inst * 0.2;
    }
    this.lastFwd = fwd; this.lastT = now;

    const portrait = innerHeight >= innerWidth;
    this.portraitEl.classList.toggle('hidden', portrait);

    const next = this.nextTarget(fwd);
    // Cible visée : n'importe quel point non pris, suffisamment proche du centre.
    let aimed = -1, ad = Infinity;
    this.targets.forEach((tg, i) => {
      if (this.captured.has(i)) return;
      const tol = tg.pole ? POLE_TOL : ALIGN_TOL;
      const d = angleBetween(fwd, this.dirs[i]);
      if (d < tol && d < ad) { ad = d; aimed = i; }
    });
    // Le nadir n'est accepté qu'à la fin ; le zénith qu'une fois l'horizon fait.
    if (aimed >= 0) {
      const tg = this.targets[aimed];
      if ((tg.ring === 4 && !this.requiredDone()) || (tg.ring !== 0 && !this.horizonDone())) aimed = -1;
    }

    const steady = this.speed < MAX_SPEED;
    if (aimed >= 0 && steady && portrait && !this.busy) {
      if (this.holdTarget !== aimed) { this.holdTarget = aimed; this.holdStart = now; }
      if (now - this.holdStart > HOLD_MS) this.shoot(aimed);
    } else if (aimed < 0 || !steady) {
      this.holdTarget = -1;
    }

    const n = this.captured.size, total = this.targets.length;
    this.countEl.textContent = `${n} / ${total}`;
    let hint;
    if (this.holdTarget >= 0) hint = t('hold');
    else if (aimed >= 0 && !steady) hint = t('moveSlow');
    else if (next >= 0 && this.targets[next].ring === 4) hint = t('nadirHint');
    else hint = t('aim');
    this.hintEl.textContent = hint;
    this.finishBtn.disabled = !this.horizonDone();
    this.finishBtn.textContent = this.requiredDone() ? t('finishNow') : t('finish');
    if (this.requiredDone() && this.captured.has(this.targets.length - 1)) { this.finish(); return; }

    this.draw(R, next, now);
  }

  draw(R, next, now) {
    const c = this.overlay, dpr = Math.min(2, devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const vw = this.source.width, vh = this.source.height;
    const s = Math.max(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
    const fs = this.focalNorm * Math.max(vw, vh);
    const proj = (d) => {
      const v = applyT(R, d);
      if (v[2] <= 0.05) return null;
      return [ox + s * (fs * v[0] / v[2] + vw / 2), oy + s * (fs * v[1] / v[2] + vh / 2), v];
    };
    const cx = W / 2, cy = H / 2;

    // Points
    this.targets.forEach((tg, i) => {
      if (tg.ring === 4 && !this.requiredDone()) return;
      const p = proj(this.dirs[i]);
      if (!p) return;
      const done = this.captured.has(i);
      g.beginPath();
      if (done) {
        g.fillStyle = 'rgba(46, 204, 113, 0.9)';
        g.arc(p[0], p[1], 9, 0, 7); g.fill();
      } else if (i === next) {
        const pulse = 18 + 3 * Math.sin(now / 180);
        g.lineWidth = 4; g.strokeStyle = '#fff';
        g.arc(p[0], p[1], pulse, 0, 7); g.stroke();
        g.beginPath(); g.fillStyle = '#fff'; g.arc(p[0], p[1], 7, 0, 7); g.fill();
      } else {
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.arc(p[0], p[1], 7, 0, 7); g.fill();
      }
    });

    // Réticule central + progression du maintien
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.stroke();
    if (this.holdTarget >= 0) {
      const p = Math.min(1, (now - this.holdStart) / HOLD_MS);
      g.lineWidth = 7; g.strokeStyle = '#2ecc71';
      g.beginPath(); g.arc(cx, cy, 30, -Math.PI / 2, -Math.PI / 2 + p * 2 * Math.PI); g.stroke();
    }

    // Flèche vers le prochain point s'il est loin du centre
    if (next >= 0 && this.holdTarget < 0) {
      const v = applyT(R, this.dirs[next]);
      const p = proj(this.dirs[next]);
      const far = !p || Math.hypot(p[0] - cx, p[1] - cy) > Math.min(W, H) * 0.32;
      if (far) {
        let ax = v[0], ay = v[1];
        if (v[2] < 0 && Math.hypot(ax, ay) < 0.2) ax = 1; // derrière soi : on indique de tourner
        const a = Math.atan2(ay, ax), rad = 80;
        const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
        g.save(); g.translate(px, py); g.rotate(a);
        g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(22, 0); g.lineTo(-10, -16); g.lineTo(-4, 0); g.lineTo(-10, 16); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
    }
  }

  shoot(i) {
    this.busy = true;
    const R = this.orient.R.slice();
    const canvas = this.source.grab();
    this.captured.add(i);
    this.holdTarget = -1;
    const shot = { target: i, R, w: canvas.width, h: canvas.height, blob: null, t: Date.now() };
    this.shots.push(shot);
    this.flashEl.classList.remove('on'); void this.flashEl.offsetWidth; this.flashEl.classList.add('on');
    try { navigator.vibrate?.(40); } catch {}
    this.beep();
    canvas.toBlob((b) => { shot.blob = b; this.busy = false; }, 'image/jpeg', 0.92);
  }

  beep() {
    const a = this.audio; if (!a) return;
    try {
      if (a.state === 'suspended') a.resume();
      const o = a.createOscillator(), gn = a.createGain();
      o.frequency.value = 1046; gn.gain.value = 0.08;
      o.connect(gn); gn.connect(a.destination);
      o.start(); gn.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.09); o.stop(a.currentTime + 0.1);
    } catch {}
  }

  async finish() {
    if (this.finishing) return;
    this.finishing = true;
    this.running = false;
    // Attendre l'encodage de la dernière photo
    for (let k = 0; k < 100 && this.shots.some((s) => !s.blob); k++) await new Promise((r) => setTimeout(r, 30));
    const shots = this.shots.filter((s) => s.blob);
    this.stop();
    this.onFinish({ shots, targets: this.targets, refYaw: this.refYaw, sim: !!this.simMod });
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearInterval(this.watchdog);
    this.source?.stop(); this.orient?.stop();
    try { this.wakeLock?.release(); } catch {}
    try { this.audio?.close(); } catch {}
  }
}
