// Visionneuse 360 légère (WebGL) : glisser pour regarder autour, pincer / molette pour zoomer.
const VS = `attribute vec2 p; varying vec2 v; void main(){ v=p; gl_Position=vec4(p,0.,1.); }`;
const FS = `precision highp float; varying vec2 v; uniform sampler2D t; uniform float yaw, pitch, tanF, aspect;
const float PI=3.14159265;
void main(){
  vec3 c = normalize(vec3(v.x*tanF*aspect, v.y*tanF, 1.0));
  float cp=cos(pitch), sp=sin(pitch), cy=cos(yaw), sy=sin(yaw);
  vec3 F=vec3(cp*sy, cp*cy, sp), R=vec3(cy,-sy,0.), U=vec3(-sp*sy,-sp*cy,cp);
  vec3 w = c.x*R + c.y*U + c.z*F;
  float lon = atan(w.x, w.y), lat = asin(clamp(w.z,-1.,1.));
  gl_FragColor = texture2D(t, vec2(lon/(2.*PI)+0.5, 0.5-lat/PI));
}`;

export class PanoViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.yaw = 0; this.pitch = 0; this.fov = 75 * Math.PI / 180;
    const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL indisponible');
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    this.u = Object.fromEntries(['yaw', 'pitch', 'tanF', 'aspect', 't'].map((n) => [n, gl.getUniformLocation(prog, n)]));
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    this._bind();
    this._raf = 0;
    this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(canvas);
  }

  setImage(source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const pot = (n) => (n & (n - 1)) === 0;
    const w = source.width, h = source.height;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, pot(w) && pot(h) ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.draw();
  }

  draw() {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => {
      const gl = this.gl, c = this.canvas, dpr = Math.min(2, devicePixelRatio || 1);
      const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform1f(this.u.yaw, this.yaw); gl.uniform1f(this.u.pitch, this.pitch);
      gl.uniform1f(this.u.tanF, Math.tan(this.fov / 2)); gl.uniform1f(this.u.aspect, w / h);
      gl.uniform1i(this.u.t, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
  }

  _bind() {
    const c = this.canvas, pts = new Map();
    let last = null, pinch = null;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); last = e; });
    c.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, e);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch) this.zoom(pinch / d);
        pinch = d; return;
      }
      if (last && pts.size === 1) {
        const k = this.fov / c.clientHeight;
        this.yaw -= (e.clientX - last.clientX) * k;
        this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + (e.clientY - last.clientY) * k));
        this.draw();
      }
      last = e;
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = null; last = pts.size ? [...pts.values()][0] : null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
  }

  zoom(f) { this.fov = Math.max(30 * Math.PI / 180, Math.min(110 * Math.PI / 180, this.fov * f)); this.draw(); }

  destroy() { this.ro.disconnect(); const ext = this.gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); }
}
