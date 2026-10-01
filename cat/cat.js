(function(){
"use strict";
// ---------------------------------------------------------------- math
const D2R = Math.PI / 180;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const smoother = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// damped spring toward target (critically damped-ish), returns new [x, v]
function springStep(x, v, target, k, d, dt) {
  const a = -k * (x - target) - d * v;
  v += a * dt; x += v * dt; return [x, v];
}
function expDecay(cur, target, rate, dt) { return target + (cur - target) * Math.exp(-rate * dt); }

const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
};

// quaternions [x, y, z, w]
const Q = {
  id: () => [0, 0, 0, 1],
  axis: (ax, ang) => { const s = Math.sin(ang / 2); const a = v3.norm(ax); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(ang / 2)]; },
  mul: (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]],
  conj: (q) => [-q[0], -q[1], -q[2], q[3]],
  norm: (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; },
  rot: (q, v) => {
    const [x, y, z, w] = q;
    const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  },
  // euler in degrees: roll about X, yaw about Y, pitch about Z, applied as Y * Z * X
  euler: (rx, ry, rz) => Q.mul(Q.mul(Q.axis([0, 1, 0], ry * D2R), Q.axis([0, 0, 1], rz * D2R)), Q.axis([1, 0, 0], rx * D2R)),
  slerp: (a, b, t) => {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let bb = b;
    if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
    if (d > 0.9995) return Q.norm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
    const th = Math.acos(d), s = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
  },
  fromTo: (u, v) => {
    u = v3.norm(u); v = v3.norm(v);
    const d = v3.dot(u, v);
    if (d < -0.999999) { let ax = v3.cross([1, 0, 0], u); if (v3.len(ax) < 1e-6) ax = v3.cross([0, 1, 0], u); return Q.axis(ax, Math.PI); }
    const c = v3.cross(u, v);
    return Q.norm([c[0], c[1], c[2], 1 + d]);
  },
  scale: (q, t) => Q.slerp(Q.id(), q, t),
};

// column-major mat4
const M4 = {
  id: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  fromQT: (q, t, s = 1, out = new Float32Array(16)) => {
    const [x, y, z, w] = q;
    const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    out[0] = (1 - (yy + zz)) * s; out[1] = (xy + wz) * s; out[2] = (xz - wy) * s; out[3] = 0;
    out[4] = (xy - wz) * s; out[5] = (1 - (xx + zz)) * s; out[6] = (yz + wx) * s; out[7] = 0;
    out[8] = (xz + wy) * s; out[9] = (yz - wx) * s; out[10] = (1 - (xx + yy)) * s; out[11] = 0;
    out[12] = t[0]; out[13] = t[1]; out[14] = t[2]; out[15] = 1;
    return out;
  },
  mul: (a, b, out = new Float32Array(16)) => {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return out;
  },
  persp: (fovy, aspect, n, f) => {
    const t = 1 / Math.tan(fovy / 2);
    return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]);
  },
  ortho: (l, r, b, t, n, f) => new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]),
  lookAt: (e, c, up) => {
    let z = v3.norm(v3.sub(e, c)); let x = v3.norm(v3.cross(up, z)); const y = v3.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -v3.dot(x, e), -v3.dot(y, e), -v3.dot(z, e), 1]);
  },
  point: (m, p) => {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
  },
  dir: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]],
  inv: (m) => {
    const inv = new Float32Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    det = 1.0 / det;
    for (let i = 0; i < 16; i++) inv[i] *= det;
    return inv;
  },
};

// ---------------------------------------------------------------- GL helpers
// Anything that goes wrong from here on leaves the viewer looking at a black
// page under a "grooming…" caption forever, so say what happened instead.
function fatal(title, detail) {
  for (const id of ['start', 'hint']) { const e = document.getElementById(id); if (e) e.hidden = true; }
  for (const e of document.querySelectorAll('.hud, .dock')) e.style.display = 'none';
  const box = document.getElementById('loading');
  if (!box) return;
  box.hidden = false;
  box.textContent = '';
  const h = document.createElement('p'), p = document.createElement('p');
  h.textContent = title; p.textContent = detail;
  h.style.cssText = 'margin:0 0 8px;font:600 17px/1.4 var(--serif)';
  p.style.cssText = 'margin:0;max-width:30em;font-size:13.5px;line-height:1.7;opacity:.8';
  const card = document.createElement('div');
  card.style.cssText = 'text-align:center;padding:0 24px';
  card.append(h, p);
  box.append(card);
}
window.addEventListener('error', (e) => {
  if (window.__ready) return;             // only the failures that stop it starting
  fatal('小银没能跑起来', '渲染初始化时出错了：' + (e.message || e.type) + '。换一个浏览器或重新加载页面也许可以。');
});
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
if (!gl) {
  fatal('这个浏览器打不开小银', '这只猫的毛发是用 WebGL2 实时算出来的，而当前浏览器没有提供 WebGL2。换用较新版本的 Chrome、Edge、Firefox 或 Safari，或者在设置里打开硬件加速，就能看到它了。');
  return;
}
const MSAA = gl.getParameter(gl.SAMPLES) || 0;
// Phones, iOS above all, take the GL context back when memory gets tight or the
// page sits in the background too long. Without this the scene simply freezes
// on its last frame and looks broken.
let GL_LOST = false;
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  GL_LOST = true;
  SOUNDS.purr(0); SOUNDS.whirr(0);
  fatal('画面断了', '浏览器收回了这个页面的显卡资源 —— 手机上内存紧张或页面在后台放久了就会这样。重新加载页面就能接着玩。');
});

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
    console.error(log + '\n' + lines);
    throw new Error('shader: ' + log);
  }
  return s;
}
function program(vs, fs, defines = '') {
  const head = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler3D;\nprecision highp sampler2DShadow;\n' + defines + '\n';
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, head + vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, head + fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}
function makeBuffer(data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) {
  const b = gl.createBuffer();
  gl.bindBuffer(target, b);
  gl.bufferData(target, data, usage);
  return b;
}
// simple float mesh: positions + normals (+ optional uv), indexed
function makeMesh(pos, nrm, idx, uv) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  makeBuffer(new Float32Array(pos)); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  makeBuffer(new Float32Array(nrm)); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  if (uv) { makeBuffer(new Float32Array(uv)); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0); }
  const big = pos.length / 3 > 65535;
  makeBuffer(big ? new Uint32Array(idx) : new Uint16Array(idx), gl.ELEMENT_ARRAY_BUFFER);
  gl.bindVertexArray(null);
  return { vao, count: idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
}
function drawMesh(m) { gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, m.type, 0); }

// geometry builders --------------------------------------------------------
function sphereGeom(r, seg = 32, rings = 20) {
  const pos = [], nrm = [], uv = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const th = j / rings * Math.PI;
    for (let i = 0; i <= seg; i++) {
      const ph = i / seg * Math.PI * 2;
      const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      pos.push(n[0] * r, n[1] * r, n[2] * r); nrm.push(...n); uv.push(i / seg, j / rings);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + seg + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  return { pos, nrm, uv, idx };
}
// rounded box: subdivided cube whose points are pushed onto a rounded box surface
function roundBoxGeom(sx, sy, sz, r, n = 10) {
  const pos = [], nrm = [], uv = [], idx = [];
  const faces = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 2, 0, 1], [1, 2, 0, -1], [2, 0, 1, 1], [2, 0, 1, -1]];
  const hx = [sx / 2, sy / 2, sz / 2];
  for (const [a, b, c, s] of faces) {
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const p = [0, 0, 0];
      p[a] = (i / n * 2 - 1) * (s > 0 ? 1 : -1); p[b] = j / n * 2 - 1; p[c] = s;
      // map cube point to rounded box
      const q = [p[0] * hx[0], p[1] * hx[1], p[2] * hx[2]];
      const inner = [Math.max(hx[0] - r, 0), Math.max(hx[1] - r, 0), Math.max(hx[2] - r, 0)];
      const cl = [clamp(q[0], -inner[0], inner[0]), clamp(q[1], -inner[1], inner[1]), clamp(q[2], -inner[2], inner[2])];
      let d = v3.sub(q, cl); const dl = v3.len(d);
      let nn;
      if (dl < 1e-9) { nn = [0, 0, 0]; nn[c] = s; d = v3.mul(nn, r); } else { nn = v3.mul(d, 1 / dl); d = v3.mul(nn, r); }
      const P = v3.add(cl, d);
      pos.push(...P); nrm.push(...nn); uv.push(i / n, j / n);
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = base + j * (n + 1) + i;
      idx.push(k, k + 1, k + n + 1, k + n + 1, k + 1, k + n + 2);
    }
  }
  // fix winding so normals point outward
  for (let t = 0; t < idx.length; t += 3) {
    const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
    const e1 = [pos[B] - pos[A], pos[B + 1] - pos[A + 1], pos[B + 2] - pos[A + 2]];
    const e2 = [pos[C] - pos[A], pos[C + 1] - pos[A + 1], pos[C + 2] - pos[A + 2]];
    const fn = v3.cross(e1, e2);
    if (v3.dot(fn, [nrm[A], nrm[A + 1], nrm[A + 2]]) < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
  }
  return { pos, nrm, uv, idx };
}
function cylGeom(r, h, seg = 18, capped = true) {
  const pos = [], nrm = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI * 2, c = Math.cos(a), si = Math.sin(a);
    pos.push(c * r, -h / 2, si * r); nrm.push(c, 0, si); uv.push(i / seg, 0);
    pos.push(c * r, h / 2, si * r); nrm.push(c, 0, si); uv.push(i / seg, 1);
  }
  for (let i = 0; i < seg; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
  if (capped) for (const sy of [-1, 1]) {
    const base = pos.length / 3;
    pos.push(0, sy * h / 2, 0); nrm.push(0, sy, 0); uv.push(0.5, 0.5);
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, c = Math.cos(a), si = Math.sin(a);
      pos.push(c * r, sy * h / 2, si * r); nrm.push(0, sy, 0); uv.push(0.5 + c * 0.5, 0.5 + si * 0.5);
    }
    for (let i = 0; i < seg; i++) {
      if (sy > 0) idx.push(base, base + 1 + i, base + 2 + i); else idx.push(base, base + 2 + i, base + 1 + i);
    }
  }
  return { pos, nrm, uv, idx };
}
function coneGeom(r0, r1, h, seg = 20) {
  const pos = [], nrm = [], uv = [], idx = [];
  const sl = Math.hypot(r0 - r1, h), ny = (r0 - r1) / sl, nr = h / sl;
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI * 2, c = Math.cos(a), si = Math.sin(a);
    pos.push(c * r0, -h / 2, si * r0); nrm.push(c * nr, ny, si * nr); uv.push(i / seg, 0);
    pos.push(c * r1, h / 2, si * r1); nrm.push(c * nr, ny, si * nr); uv.push(i / seg, 1);
  }
  for (let i = 0; i < seg; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
  return { pos, nrm, uv, idx };
}
function transformGeom(g, m) {
  const pos = [], nrm = [];
  for (let i = 0; i < g.pos.length; i += 3) {
    const p = M4.point(m, [g.pos[i], g.pos[i + 1], g.pos[i + 2]]);
    const n = v3.norm(M4.dir(m, [g.nrm[i], g.nrm[i + 1], g.nrm[i + 2]]));
    pos.push(...p); nrm.push(...n);
  }
  return { pos, nrm, uv: g.uv, idx: g.idx };
}
function mergeGeom(list) {
  const out = { pos: [], nrm: [], uv: [], idx: [] };
  for (const g of list) {
    const base = out.pos.length / 3;
    out.pos.push(...g.pos); out.nrm.push(...g.nrm); out.uv.push(...(g.uv || new Array(g.pos.length / 3 * 2).fill(0)));
    for (const i of g.idx) out.idx.push(i + base);
  }
  return out;
}

// ---------------------------------------------------------------- shaders
const GLSL_COMMON = `
uniform vec3 uCamPos;
uniform vec3 uLightDir;      // toward the light
uniform vec3 uLightCol;
uniform vec3 uSkyCol;
uniform vec3 uGroundCol;
uniform float uExposure;
uniform sampler2DShadow uShadow;
uniform vec2 uShadowTexel;
uniform vec3 uWinDir;        // direction toward the window (world)
uniform vec3 uLampPos;       // the warm lamp on the desk
uniform vec3 uLampCol;
// A real lamp falls off fast, which is what makes a room feel lit rather than
// flooded, and is most of why the corner it stands in reads as warm.
float lampFall(vec3 p) { vec3 d = uLampPos - p; return 1.0 / (1.0 + dot(d, d) * 2.2); }
vec3 lampDir(vec3 p) { return normalize(uLampPos - p + vec3(1e-5)); }
const vec2 POISSON[12] = vec2[12](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),vec2(0.962,-0.195),vec2(0.473,-0.480),vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),vec2(0.896,0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598));
float shadowAt(vec4 sc, float bias, float rad){
  vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0;
  for (int i = 0; i < 12; i++) s += texture(uShadow, vec3(p.xy + POISSON[i] * uShadowTexel * rad, p.z - bias));
  return s / 12.0;
}
float shadowFast(vec4 sc, float bias, float rad){
  vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0;
  for (int i = 0; i < 5; i++) s += texture(uShadow, vec3(p.xy + POISSON[i * 2 + 1] * uShadowTexel * rad, p.z - bias));
  return s / 5.0;
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
vec3 outColor(vec3 c){ c = aces(c * uExposure); return pow(c, vec3(1.0/2.2)); }
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// The window is a metre-wide area source, not a point. A single directional
// light can carry its shadows but not its fill, which is why everything turned
// away from it went black; this is the broad wash it actually throws, plus the
// warm bounce back up off the oak floor.
vec3 roomFill(vec3 n) {
  float win = clamp(dot(n, uWinDir) * 0.5 + 0.55, 0.0, 1.0);
  float down = clamp(-n.y * 0.5 + 0.5, 0.0, 1.0);
  return vec3(0.27, 0.30, 0.36) * win + vec3(0.17, 0.125, 0.075) * down;
}
uniform vec4 uLaser;         // xyz where the dot is, w how bright
// The dot is not a sprite pasted over the scene: it is light landing on
// whatever is under it, so it bends over the edge of the bed, climbs the wall
// and slides across the cat's own fur when you point it at them.
vec3 laserOn(vec3 p) {
  if (uLaser.w <= 0.0) return vec3(0.0);
  float d2 = dot(p - uLaser.xyz, p - uLaser.xyz);
  // a laser dot is far brighter than anything around it: the core clips to
  // near-white and only the halo reads as red, which is how one actually looks
  return (vec3(7.5, 0.70, 0.40) * exp(-d2 / (0.0085 * 0.0085))
        + vec3(1.8, 0.07, 0.05) * exp(-d2 / (0.034 * 0.034))) * uLaser.w;
}
// soft room environment used for glossy reflections (eyes, nose, ball)
vec3 envColor(vec3 r){
  vec3 room = mix(vec3(0.20,0.17,0.14), vec3(0.55,0.53,0.52), smoothstep(-0.4, 0.8, r.y));
  float w = max(dot(r, uWinDir), 0.0);
  vec3 win = vec3(1.6,1.65,1.75) * smoothstep(0.80, 0.93, w);
  // window mullions
  return room + win;
}
`;

const CAT_VS = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aNrm;
layout(location=2) in vec4 aFlow;
layout(location=3) in uvec4 aJ;
layout(location=4) in vec4 aW;
layout(location=5) in vec4 aReg;
layout(location=6) in vec4 aMisc;
layout(location=7) in vec4 aExtra;
uniform highp sampler2D uBones;
uniform mat4 uVP;
uniform mat4 uShadowVP;
uniform vec3 uLo, uHi;
uniform float uShellCount;
uniform float uFurScale;
uniform vec4 uPet;      // xyz contact point, w strength
uniform vec3 uPetDir;
uniform float uWind;
uniform float uTime;
uniform float uBreath;
out vec3 vRest; out vec3 vRestN; out vec3 vWorld; out vec3 vN; out vec3 vT; out float vH;
out vec4 vReg; out vec4 vMisc; out vec4 vShadow; out float vDens; out float vAO; out float vLen; out vec3 vRestF; out vec3 vDesign;
float ssf(float a, float b, float t){ t = clamp((t - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec3 xfD(vec3 p){
  float w = ssf(0.150, 0.185, p.x);
  const vec3 J = vec3(0.180, 0.258, 0.0);
  p = p + w * ((J + (p - J) * 1.10 + vec3(-0.010, -0.016, 0.0)) - p);
  p.x += 0.028 * ssf(-0.03, -0.10, p.x);
  p.y += 0.022 * ssf(0.0, 0.12, p.y);
  return p;
}
vec3 toDesign(vec3 p){
  vec3 q = p;
  for (int i = 0; i < 8; i++) q -= (xfD(q) - p) * 0.9;
  return q;
}

mat4 bm(uint i){ int x = int(i) * 4; return mat4(texelFetch(uBones, ivec2(x,0), 0), texelFetch(uBones, ivec2(x+1,0), 0), texelFetch(uBones, ivec2(x+2,0), 0), texelFetch(uBones, ivec2(x+3,0), 0)); }
void main(){
  vec3 rest = mix(uLo, uHi, aPos);
  mat4 S = bm(aJ.x) * aW.x + bm(aJ.y) * aW.y + bm(aJ.z) * aW.z + bm(aJ.w) * aW.w;
  vec3 P = (S * vec4(rest, 1.0)).xyz;
  vec3 N = normalize(mat3(S) * aNrm.xyz);
  P += N * (0.0013 * uBreath * aReg.x * smoothstep(0.24, 0.12, rest.y) * smoothstep(-0.16, -0.05, rest.x) * smoothstep(0.17, 0.10, rest.x));
  vec3 F = mat3(S) * aFlow.xyz; F -= N * dot(F, N); float fl = length(F); F = fl > 1e-5 ? F / fl : vec3(0.0);
  float h = float(gl_InstanceID) / uShellCount;
  float len = aMisc.x * 0.02 * uFurScale;
  float pd = 0.0; vec3 pushDir = vec3(0.0);
  if (uPet.w > 0.0) {
    float d = distance(P, uPet.xyz);
    pd = uPet.w * exp(-d * d / (0.034 * 0.034));
    pushDir = uPetDir - N * dot(uPetDir, N);
  }
  float lift = mix(0.56, 0.10, pd);
  len *= 1.0 - 0.35 * pd;
  vec3 off = N * (len * lift * h) + F * (len * 0.78 * h * h) + pushDir * (len * 1.0 * pd * h * h) + vec3(0.0, -1.0, 0.0) * (len * 0.12 * h * h);
#ifdef SHADOW
  vec3 Pw = P + N * len * 0.35;
#else
  vec3 Pw = P + off;
#endif
  vT = normalize(N * lift + F * (1.56 * h + 0.25) + pushDir * 2.0 * pd * h + vec3(0.0, -0.24 * h, 0.0));
  vN = N; vH = h; vRest = rest; vRestN = aNrm.xyz; vRestF = aFlow.xyz; vDesign = toDesign(rest); vWorld = Pw; vReg = aReg; vMisc = aMisc; vDens = aFlow.w; vAO = aExtra.x; vLen = len;
  vShadow = uShadowVP * vec4(P + N * 0.003, 1.0);
  gl_Position = uVP * vec4(Pw, 1.0);
}`;

const CAT_FS = GLSL_COMMON + `
in vec3 vRest; in vec3 vRestN; in vec3 vWorld; in vec3 vN; in vec3 vT; in float vH;
in vec4 vReg; in vec4 vMisc; in vec4 vShadow; in float vDens; in float vAO; in float vLen; in vec3 vRestF; in vec3 vDesign;
uniform sampler3D uNoise;
uniform float uStrandDensity;
uniform float uDither;       // 1 when MSAA is unavailable
uniform vec3 uEyeL, uEyeR;
uniform vec3 uEarO[2]; uniform vec3 uEarU[2]; uniform vec3 uEarW[2];
uniform float uMouthOpen;
out vec4 oCol;
float n3(vec3 p){ return texture(uNoise, p).r; }
float fbm3(vec3 p){ return n3(p) * 0.5 + n3(p * 2.07 + 0.31) * 0.3 + n3(p * 4.13 + 0.77) * 0.2; }
float band(float d, float w, float aa){ return 1.0 - smoothstep(w - aa, w + aa, abs(d)); }
vec2 torsoPat(vec3 p){
  float ry = p.y - 0.166; float rz = abs(p.z);
  float phi = atan(rz, ry);
  vec3 np = p * 6.0;
  float w1 = fbm3(np) - 0.5, w2 = fbm3(np * 1.7 + 3.1) - 0.5;
  float X = p.x + w1 * 0.026;
  float Y = phi * 0.066 + w2 * 0.020;
  float dark = 0.0;
  // dorsal stripes
  float dx = smoothstep(0.100, 0.070, X) * smoothstep(-0.205, -0.185, X);
  float dw = 0.030 + 0.005 * sin(X * 45.0);
  float inD = 1.0 - smoothstep(dw - 0.003, dw + 0.003, Y);
  float sep = band(Y - 0.0115, 0.0018, 0.0012);
  dark = max(dark, dx * inD * (1.0 - 0.9 * sep));
  // classic bullseye on the flank
  vec2 c = vec2(-0.066, 0.090);
  // stronger, lower-frequency warp so the rings read as swirls rather than a target
  vec2 wq = vec2(fbm3(p * 3.1 + 7.7) - 0.5, fbm3(p * 3.3 + 1.9) - 0.5);
  vec2 e = (vec2(X, Y) + wq * 0.020 - c) / vec2(1.0, 0.78);
  float r = length(e);
  float ang = atan(e.y, e.x);
  float rn = r + (fbm3(vec3(ang * 0.9, r * 20.0, 3.3)) - 0.5) * 0.010;
  float bull = 1.0 - smoothstep(0.019, 0.024, rn + 0.004 * sin(ang * 3.0 + 1.0));
  bull = max(bull, band(rn - 0.0360, 0.0080 + 0.0022 * sin(ang * 2.0), 0.0022) * (1.0 - 0.8 * smoothstep(0.55, 0.85, fbm3(vec3(ang * 1.3, 2.0, 5.0)))));
  float gap = smoothstep(0.7, 1.3, ang) * smoothstep(2.7, 2.1, ang);
  bull = max(bull, band(rn - 0.0570, 0.0075 + 0.002 * sin(ang * 3.0 + 2.0), 0.0022) * (1.0 - gap));
  float upper = smoothstep(0.35, -0.5, e.y / max(r, 1e-4));
  bull = max(bull, band(rn - 0.0770, 0.0090, 0.0025) * upper);
  float flank = smoothstep(0.022, 0.050, Y) * smoothstep(0.168, 0.135, Y);
  dark = max(dark, bull * flank * smoothstep(0.050, 0.020, X) * smoothstep(-0.200, -0.165, X));
  // bars behind the shoulder
  float sbar = band(fract((X - 0.10 * Y) / 0.025) - 0.5, 0.25, 0.06);
  dark = max(dark, sbar * smoothstep(0.000, 0.016, X) * smoothstep(0.090, 0.070, X) * smoothstep(0.020, 0.040, Y) * smoothstep(0.150, 0.115, Y));
  // butterfly over the shoulders
  vec2 bc = vec2(0.056, 0.035);
  float br = length((vec2(X, Y) - bc) / vec2(1.0, 0.9));
  float bfly = max(band(br - 0.020, 0.0065, 0.0016), 1.0 - smoothstep(0.007, 0.010, br));
  dark = max(dark, bfly * smoothstep(0.100, 0.080, X) * smoothstep(0.016, 0.032, X) * smoothstep(0.075, 0.055, Y));
  // pale bib on the chest front
  float bib = smoothstep(0.075, 0.115, X) * smoothstep(0.10, 0.15, Y);
  dark *= 1.0 - 0.85 * bib;
  // belly: pale with spots
  float belly = smoothstep(0.128, 0.170, Y);
  vec2 g = vec2(X, Y) / vec2(0.032, 0.024);
  vec2 gi = floor(g), gf = fract(g) - 0.5;
  float spot = (1.0 - smoothstep(0.16, 0.30, length(gf))) * step(0.45, hash12(gi));
  dark = mix(dark, spot * 0.75, belly);
  float white = max(belly * 0.75, bib * 0.6);
  return vec2(clamp(dark, 0.0, 1.0), white);
}
vec2 neckPat(vec3 p){
  vec3 a = vec3(0.105, 0.190, 0.0), b = vec3(0.190, 0.262, 0.0);
  vec3 ab = b - a; float t = dot(p - a, ab) / dot(ab, ab);
  vec3 q = p - (a + ab * t);
  vec3 ax = normalize(ab); vec3 up = normalize(vec3(-ax.y, ax.x, 0.0));
  float th = atan(abs(q.z), dot(q, up));
  float w = fbm3(p * 8.0) - 0.5;
  float dark = 0.0;
  float nape = max(band(th + w * 0.2, 0.11, 0.05), band(th - 0.44 + w * 0.2, 0.10, 0.05));
  dark = max(dark, nape * smoothstep(0.95, 0.65, th));
  float tt = t * 3.0 + w * 0.6;
  float neckl = band(fract(tt) - 0.5, 0.17, 0.06) * step(0.12, t) * step(t, 0.72);
  dark = max(dark, neckl * smoothstep(1.35, 2.1, th) * 0.9);
  float white = smoothstep(2.2, 2.8, th) * smoothstep(0.85, 0.45, t) * 0.8;
  return vec2(dark, white);
}
vec2 headPat(vec3 p, vec3 pa, vec3 nr){
  vec3 q = p - vec3(0.205, 0.278, 0.0);
  float az = atan(abs(q.z), q.x);
  float el = atan(q.y, length(q.xz));
  float w = fbm3(p * 16.0) - 0.5;
  float dark = 0.0, white = 0.0;
  // forehead "M" lines converging over the crown
  float spread = mix(1.25, 0.6, smoothstep(0.42, 1.25, el));
  float a = az / spread + w * 0.08 + 0.02 * sin(el * 14.0);
  float ml = max(max(band(a, 0.034, 0.016), band(a - 0.13, 0.030, 0.015)), max(band(a - 0.26, 0.028, 0.015), band(a - 0.40, 0.026, 0.015) * 0.85));
  dark = max(dark, ml * smoothstep(0.30, 0.42, el) * smoothstep(1.62, 1.40, el + 0.25 * smoothstep(1.2, 2.2, az)));
  // back of the head: lines run on toward the nape
  float back = smoothstep(1.55, 2.2, az);
  float bl = max(band(abs(q.z) / 0.03 - 0.0 + w * 0.2, 0.18, 0.08), band(abs(q.z) / 0.03 - 0.62 + w * 0.2, 0.15, 0.08));
  dark = max(dark, bl * back * smoothstep(-0.3, 0.2, el));
  // line from the outer eye corner toward the ear base
  float side = smoothstep(0.62, 0.80, az) * smoothstep(1.85, 1.55, az);
  float e1 = band(el - (0.040 - 0.12 * (az - 0.75) + 0.05 * (az - 0.75) * (az - 0.75)) + w * 0.03, 0.018, 0.014);
  dark = max(dark, e1 * side);
  // Cheek stripe. It has to stay well back on the cheek and well above the
  // mouth: swept any lower and forward it stops reading as a tabby marking and
  // starts reading as a drawn-on downturned mouth.
  float e2 = band(el - (-0.09 + 0.17 * smoothstep(1.0, 1.8, az)) + w * 0.03, 0.013, 0.013);
  dark = max(dark, e2 * smoothstep(1.02, 1.26, az) * smoothstep(2.00, 1.70, az) * 0.5);
  // pale muzzle, chin and throat
  float muz = smoothstep(0.62, 0.38, az) * smoothstep(-0.02, -0.26, el);
  float chin = smoothstep(-0.30, -0.55, el) * smoothstep(1.4, 0.9, az);
  white = max(white, max(muz, chin) * 0.95);
  // whisker-pad follicle spots
  if (p.x > 0.231 && abs(p.z) > 0.0055 && abs(p.z) < 0.0195 && p.y > 0.2556 && p.y < 0.2656) {
    vec2 g = vec2((p.x - 0.2352) / 0.0034, (p.y - 0.2640) / 0.0019);
    vec2 gf = fract(g + 0.5) - 0.5;
    float dot1 = 1.0 - smoothstep(0.16, 0.26, length(gf * vec2(1.0, 1.25)));
    dark = max(dark, dot1 * 0.85);
  }
  // dark tear line from the inner eye corner
  {
    vec3 ec = vec3(0.2290, 0.2905 - 0.0062, 0.0168);
    vec3 dq = vec3(p.x, p.y, abs(p.z)) - ec;
    float along = clamp(dot(dq, normalize(vec3(0.45, -1.0, -0.25))), 0.0, 0.007);
    float dist = length(dq - normalize(vec3(0.45, -1.0, -0.25)) * along);
    dark = max(dark, (1.0 - smoothstep(0.0007, 0.0014, dist)) * 0.85);
  }
  // white "goggles" and black rim around the eyes
  float dl = distance(pa, uEyeL), dr = distance(pa, uEyeR);
  float de = min(dl, dr);
  white = max(white, band(de - 0.0142, 0.0026, 0.0012) * 0.95);
  float rim = 1.0 - smoothstep(0.0111, 0.0121, de);
  dark = max(dark * (1.0 - band(de - 0.0142, 0.0026, 0.0012)), rim);
  // black lip line
  float ys = 0.2540 + 0.10 * (p.x - 0.2338) - 40.0 * p.z * p.z;
  float lip = band(p.y - ys, 0.0006, 0.0005) * smoothstep(0.236, 0.244, p.x) * smoothstep(0.0075, 0.0025, abs(p.z)) * 0.8;
  float philtrum = band(p.z, 0.00045, 0.0003) * step(ys, p.y) * step(p.y, 0.2628) * step(0.247, p.x);
  dark = max(dark, max(lip * 0.0, philtrum * 0.55));
  // ears: darker backs and tips
  for (int i = 0; i < 2; i++) {
    vec3 d = pa - uEarO[i];
    float u = dot(d, uEarU[i]);
    float lw = dot(d, uEarW[i]);
    float inEar = smoothstep(0.003, 0.008, u) * step(length(d), 0.045);
    float backFace = smoothstep(0.1, -0.3, dot(nr, uEarW[i]));
    float tip = smoothstep(0.016, 0.030, u);
    dark = mix(dark, mix(0.55, 0.92, tip), inEar * backFace);
    white = mix(white, 0.0, inEar * backFace);
  }
  return vec2(clamp(dark, 0.0, 1.0), clamp(white, 0.0, 1.0));
}
vec2 legPat(vec3 p, float t, float lat){
  float w = fbm3(p * 9.0) - 0.5;
  bool front = p.x > -0.02;
  float spacing = front ? 0.0225 : 0.0245;
  float bars = band(fract(t / spacing + w * 0.45) - 0.5, 0.24, 0.07);
  float outer = smoothstep(-0.7, 0.2, lat);
  float dark = bars * outer * smoothstep(0.010, 0.030, t);
  float pawStart = front ? 0.140 : 0.180;
  float paw = smoothstep(pawStart - 0.02, pawStart + 0.005, t);
  dark *= 1.0 - paw;
  float white = max(paw * 0.85, (1.0 - outer) * 0.35);
  if (!front) {
    // dark streak down the back of the hind metatarsus
    float hockBack = smoothstep(0.140, 0.150, t) * smoothstep(0.200, 0.185, t);
    float behind = smoothstep(-0.2, 0.6, lat * 0.0 + (p.x < -0.135 ? 1.0 : 0.0));
    dark = max(dark, hockBack * behind * 0.7);
  }
  return vec2(dark, white);
}
vec2 tailPat(vec3 p, float t, vec3 nr){
  float w = fbm3(p * 9.0) - 0.5;
  float rings = band(fract(t / 0.031 + w * 0.3) - 0.5, 0.27, 0.07);
  float tip = smoothstep(0.235, 0.250, t);
  float under = smoothstep(-0.2, -0.7, nr.y);
  float dark = max(rings * (1.0 - under * 0.6), tip);
  return vec2(dark, under * 0.3 * (1.0 - tip));
}

void main(){
  float h = vH;
  float mat = floor(vMisc.y * 255.0 + 0.5);
  if (h > 0.0 && vLen < 0.00035) discard;
  vec3 rp = vRest;
  vec3 fr = normalize(vRestF + vec3(1e-4));
  vec3 fq = rp * 260.0;
  vec3 sq = fq - fr * dot(fq, fr) * 0.88;
  float streak = n3(sq * 0.11) * 0.6 + n3(sq * 0.27 + 5.0) * 0.4;
  vec3 dp = vDesign + fr * (streak - 0.5) * 0.0045;
  // ---------------- strand coverage
  float alpha = 1.0;
  float sid = 0.5;
  float under = 0.0;           // 1 where what we can see here is undercoat, not topcoat
  if (h > 0.0) {
    vec3 q = rp * uStrandDensity;
    vec3 c = floor(q); vec3 f = fract(q);
    vec3 j = hash33(c + 17.0);
    sid = hash13(c);
    // Real fur is not an even pile. Hairs gather into tufts that lean together
    // as they rise, the tufts vary in length, and a sparse scatter of guard
    // hairs stands clear of the rest and breaks the silhouette. Without this
    // the coat reads as velvet however good the lighting is.
    float tuft = fbm3(rp * 85.0);
    float guard = step(0.94, hash13(c + 61.0));
    float slen = mix(0.72, 1.0, sid) * (0.80 + 0.40 * tuft) * (1.0 + 0.75 * guard);
    float tt = h / slen;
    vec3 ctr = 0.2 + 0.6 * j;
    vec3 cq = floor(q / 3.0);
    vec3 clumpC = (cq + 0.5 + 0.44 * (hash33(cq + 41.0) - 0.5)) * 3.0 - c;
    // clamped so a strand never wanders out of its own cell and leaves a hole
    ctr = clamp(ctr + (clumpC - ctr) * (0.30 * h * h), 0.12, 0.88);
    vec3 dv = f - ctr;
    float d = length(dv - vRestN * dot(dv, vRestN));
    float rad = 0.58 * (1.0 - tt * tt * 0.85) * (guard > 0.5 ? 0.6 : 1.0);
    vec3 fw = fwidth(q);
    float fp = max(max(fw.x, fw.y), fw.z);
    float aa = clamp(fp * 0.7, 0.02, 0.5);
    float present = step(1.0 - vDens, j.z);
    float a = present * step(tt, 1.0) * smoothstep(rad + aa, rad - aa, d);
    float avg = vDens * clamp(1.0 - pow(h, 2.0), 0.0, 1.0) * 0.9 * (0.75 + 0.5 * hash13(floor(q * 0.5)));
    float lod = max(smoothstep(0.7, 1.4, fp), smoothstep(0.0075, 0.0040, vLen) * 0.8);
    alpha = mix(a, avg, lod);
    // The undercoat: a second, finer and much denser layer living only close to
    // the skin. A silver tabby carries its markings in the topcoat over a
    // near-white layer beneath, and that pale layer showing through the gaps is
    // what makes the coat read as silver rather than grey. Filling the same
    // space with a solid mass, as this used to, reads as felt.
    vec3 qu = rp * (uStrandDensity * 2.05);
    vec3 fwu = fwidth(qu);                       // hoisted: the branch below is not uniform
    float fpu = max(max(fwu.x, fwu.y), fwu.z);
    float aau = clamp(fpu * 0.7, 0.02, 0.5);
    if (h < 0.38) {
      vec3 cu = floor(qu), fu = fract(qu);
      vec3 ju = hash33(cu + 91.0);
      float ulen = 0.20 + 0.17 * hash13(cu + 7.0);
      vec3 ctru = clamp(0.22 + 0.56 * ju, 0.12, 0.88);
      vec3 dvu = fu - ctru;
      float du = length(dvu - vRestN * dot(dvu, vRestN));
      float radu = 0.66 * (1.0 - pow(min(h / ulen, 1.0), 2.0) * 0.55);
      float au = smoothstep(radu + aau, radu - aau, du) * smoothstep(1.02, 0.80, h / ulen);
      au = mix(au, 0.95, smoothstep(0.7, 1.4, fpu)) * vDens;
      under = clamp(au - alpha, 0.0, 1.0);
      alpha = max(alpha, au);
    }
    if (alpha < 0.02) discard;
  }
  // ---------------- pattern
  vec2 pt = vec2(0.0);
  float wsum = 0.0;
  if (vReg.x > 0.01) {
    float nk = smoothstep(0.075, 0.115, dp.x);
    vec2 tp = mix(torsoPat(dp), neckPat(dp), nk);
    pt += tp * vReg.x;
  }
  if (vReg.y > 0.01) pt += headPat(dp, rp, vRestN) * vReg.y;
  if (vReg.z > 0.01) pt += legPat(dp, vMisc.z * 0.30, vMisc.w * 2.0 - 1.0) * vReg.z;
  if (vReg.w > 0.01) pt += tailPat(dp, vMisc.z * 0.30, vRestN) * vReg.w;
  float dark = clamp(pt.x, 0.0, 1.0), white = clamp(pt.y, 0.0, 1.0);
  // ---------------- colour along the strand
  vec3 SILV_ROOT = vec3(0.56, 0.57, 0.59);
  vec3 SILV = vec3(0.40, 0.41, 0.43);
  vec3 BLK = vec3(0.016, 0.016, 0.019);
  vec3 WHT = vec3(0.66, 0.66, 0.65);
  // the markings live in the topcoat; the undercoat beneath stays near-white
  dark *= 1.0 - 0.62 * under;
  white = max(white, under * 0.40);
  vec3 base = mix(SILV, BLK, dark);
  base = mix(base, WHT, white * (1.0 - 0.75 * dark));
  float rnd = hash13(floor(rp * uStrandDensity) + 3.7);
  // ticking: dark tips on part of the silver hairs, topcoat only
  float tick = step(0.55, rnd) * smoothstep(0.72, 0.88, h) * (1.0 - dark) * (1.0 - white) * (1.0 - under);
  base = mix(base, vec3(0.10, 0.10, 0.11), tick * 0.75);
  vec3 root = mix(SILV_ROOT, vec3(0.62), dark * 0.4);
  vec3 alb = mix(root, base, smoothstep(0.10, 0.45, h));
  alb *= (0.86 + 0.28 * sid) * (0.80 + 0.40 * streak);
  if (h == 0.0) alb = mix(alb, root * 0.55, 0.5);
  // ---------------- special skin materials
  float spec0 = 0.0, rough = 0.0, wet = 0.0;
  if (mat > 0.5) {
    if (mat < 1.5) { // nose leather
      vec3 nc = vec3(0.2512, 0.2665, 0.0);
      vec3 d = dp - nc;
      float tri = abs(d.z) / max(0.0058 * clamp((d.y + 0.0042) / 0.0084, 0.05, 1.0), 1e-4);
      float edge = smoothstep(0.62, 0.98, max(tri, abs(d.y + 0.0002) / 0.0044));
      alb = mix(vec3(0.66, 0.40, 0.38), vec3(0.30, 0.16, 0.15), edge);
      // nostrils
      float nos = band(length((d.yz - vec2(-0.0016, 0.0024 * sign(d.z))) * vec2(1.0, 1.8)) - 0.0010, 0.00045, 0.0003);
      alb *= 1.0 - 0.75 * nos * step(0.0012, abs(d.z));
      alb *= 0.85 + 0.3 * n3(rp * 600.0);
      spec0 = 0.5; wet = 1.0;
    } else if (mat < 2.5) {
      // With the mouth shut these polygons are not a cavity, they are the lip
      // line. Painted near-black, as they were, the downward curve of the mouth
      // slit reads as a frown drawn onto the face; painted like lip skin it
      // reads as a closed mouth, which is what it is.
      // These polygons are recessed and face away from every light, so they come
      // out dark whatever albedo they are given; the closed colour has to be
      // close to the muzzle's for the seam to read as a crease rather than a hole.
      alb = mix(vec3(0.56, 0.47, 0.44), vec3(0.32, 0.08, 0.09), smoothstep(0.08, 0.45, uMouthOpen));
      spec0 = 0.22;
    } else if (mat < 3.5) { // inner ear skin with sparse white hairs
      if (h == 0.0) alb = vec3(0.68, 0.48, 0.46);
      else alb = vec3(0.84, 0.84, 0.83);
    } else { // paw pads
      alb = vec3(0.50, 0.24, 0.25);
      spec0 = 0.25; wet = 0.3;
    }
  }
  // ---------------- lighting
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 T = normalize(vT);
  vec3 L = uLightDir;
  float sh = h > 0.0 ? shadowFast(vShadow, 0.0012, 2.4) : shadowAt(vShadow, 0.0012, 2.2);
  float NoL = dot(N, L);
  float wrap = clamp((NoL + 0.25) / 1.25, 0.0, 1.0);
  float TL = dot(T, L);
  float kk = sqrt(max(1.0 - TL * TL, 0.0));
  float furry = step(0.001, h) * (1.0 - step(0.5, mat) * step(mat, 2.5));
  float diff = wrap * mix(1.0, 0.35 + 0.65 * kk, furry * 0.8);
  vec3 H = normalize(L + V);
  vec3 T1 = normalize(T + N * 0.12), T2 = normalize(T - N * 0.22);
  float th1 = dot(T1, H), th2 = dot(T2, H);
  float s1 = pow(sqrt(max(1.0 - th1 * th1, 0.0)), 80.0);
  float s2 = pow(sqrt(max(1.0 - th2 * th2, 0.0)), 18.0);
  float lightSide = smoothstep(-0.15, 0.35, NoL);
  vec3 specC = (vec3(s1 * 0.16) + alb * s2 * 0.35) * lightSide * furry * smoothstep(0.2, 0.9, h);
  float occ = mix(0.30, 1.0, pow(h, 0.75));
  float ao = mix(0.35, 1.0, vAO);
  float floorAO = mix(0.55, 1.0, smoothstep(0.0, 0.05, vWorld.y));
  vec3 amb = mix(uGroundCol, uSkyCol, N.y * 0.5 + 0.5);
  vec3 col = alb * ((amb + roomFill(N) * 0.85) * occ * ao * floorAO + uLightCol * diff * sh * occ * mix(0.6, 1.0, ao));
  col += uLightCol * specC * sh * ao;
  // the desk lamp, wrapped the same way the key light is so the fur keeps its softness
  vec3 lampL = lampDir(vWorld);
  float lampWrap = clamp((dot(N, lampL) + 0.25) / 1.25, 0.0, 1.0);
  col += alb * uLampCol * lampWrap * lampFall(vWorld) * occ * ao * 0.9;
  float NoV = abs(dot(N, V));
  // Forward scattering. Light that passes through a hair instead of bouncing
  // off it is what makes a backlit coat glow, and it is the thing that most
  // separates fur from a furry-looking solid. It needs the light behind the
  // cat, the view roughly along it, and a short path through the coat, so it
  // shows up along the silhouette and in the thin fur of the ears and legs.
  // wrapped past the terminator and kept broad, because light entering a coat
  // scatters sideways through it rather than glowing on one line of pixels
  float backLit = clamp((-NoL + 0.35) / 1.35, 0.0, 1.0);
  float fwdScatter = pow(clamp(dot(V, -L), 0.0, 1.0), 4.0);
  float thin = pow(1.0 - NoV, 1.3);
  // deeper in the coat the light has scattered further and comes out warmer
  vec3 ttTint = mix(vec3(1.0), vec3(1.25, 0.88, 0.72), smoothstep(0.1, 0.9, h));
  col += alb * ttTint * uLightCol * (backLit * fwdScatter * thin * furry * 3.6 * sh * mix(0.35, 1.0, h));
  // rim / back light through the fur fringe
  float rim = pow(1.0 - NoV, 3.0) * furry * (0.25 + 0.75 * h);
  col += alb * rim * (amb * 0.5 + uLightCol * 0.45 * sh * max(dot(-V, L) + 0.3, 0.0));
  // thin ears let light through: pink glow on the side facing away from the light
  if (vReg.y > 0.3) {
    for (int i = 0; i < 2; i++) {
      vec3 d = vRest - uEarO[i];
      float u = dot(d, uEarU[i]);
      float m = smoothstep(0.004, 0.012, u) * step(length(d), 0.045);
      float back = max(-dot(N, L), 0.0);
      col += vec3(0.85, 0.30, 0.24) * uLightCol * back * m * 0.22 * sh * (0.4 + 0.6 * smoothstep(-0.2, 0.6, dot(V, -L)));
    }
  }
  // glossy skin (nose, pads, mouth)
  if (spec0 > 0.0) {
    vec3 R = reflect(-V, N);
    float fres = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
    col += envColor(R) * fres * spec0 * 0.6 * ao;
    col += uLightCol * pow(max(dot(N, H), 0.0), 60.0) * spec0 * 0.8 * sh;
    // A cat's nose is damp, and damp is two things at once: the surface goes
    // darker because the film soaks it, and it carries a small very bright
    // highlight that a matte nose cannot. A dry nose is the single easiest
    // place to see that a cat is not real.
    if (wet > 0.0) {
      col *= mix(1.0, 0.80, wet);
      col += uLightCol * pow(max(dot(N, H), 0.0), 150.0) * wet * 1.6 * sh * ao;
      col += envColor(R) * pow(1.0 - NoV, 4.0) * wet * 0.55 * ao;
      // the window reflected in the film is what actually reads as wet, the way
      // it does in any photograph of a cat
      col += vec3(1.05, 1.03, 1.0) * smoothstep(0.90, 0.975, dot(R, uWinDir)) * wet * 1.1 * ao;
    }
  }
  if (mat > 1.5 && mat < 2.5) {
    col *= mix(0.95, 1.0, smoothstep(0.0, 0.5, uMouthOpen));
    // a shut mouth sits in the muzzle's own light, not in a cavity's
    col += alb * mix(0.55, 0.0, smoothstep(0.0, 0.4, uMouthOpen)) * (mix(uGroundCol, uSkyCol, 0.65) + roomFill(N) * 0.8);
  }
  col += laserOn(vWorld) * (0.07 + 0.17 * h);   // split across the shells, so each takes a share
  float outA = alpha;
  if (uDither > 0.5) {
    float th = hash12(gl_FragCoord.xy + fract(vH * 7.13) * 31.0);
    if (alpha < th) discard;
    outA = 1.0;
  }
  oCol = vec4(outColor(col), outA);
}`;

const EYE_VS = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
uniform mat4 uVP; uniform mat4 uModel;
out vec3 vLocal; out vec3 vWorld; out vec3 vN;
void main(){ vLocal = aPos; vec4 w = uModel * vec4(aPos, 1.0); vWorld = w.xyz; vN = normalize(mat3(uModel) * aNrm); gl_Position = uVP * w; }`;
const EYE_FS = GLSL_COMMON + `
in vec3 vLocal; in vec3 vWorld; in vec3 vN;
uniform mat4 uModelInv;
uniform float uDilate;      // 0 slit .. 1 round
uniform vec3 uIrisIn, uIrisOut;
uniform vec4 uEyeShadow;    // shadow coordinate of the eye centre
uniform mat4 uShadowVP;
out vec4 oCol;
float hashA(float a){ return fract(sin(a * 127.1) * 43758.5453); }
float vnoise(float x){ float i = floor(x), f = fract(x); return mix(hashA(i), hashA(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void main(){
  vec3 n = normalize(vLocal);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 Vl = normalize(mat3(uModelInv) * V);
  // refract the view ray into the anterior chamber and hit the iris plane
  vec3 rd = refract(-Vl, n, 1.0 / 1.336);
  float planeX = 0.42;
  float t = (planeX - n.x) / min(rd.x, -0.05);
  vec3 ip = n + rd * max(t, 0.0);
  vec2 iuv = ip.zy;                  // z horizontal, y vertical (unit-sphere units)
  float R = 0.84;
  float r = length(iuv) / R;
  float ang = atan(iuv.y, iuv.x);
  vec3 col;
  if (r < 1.0 && n.x > 0.0) {
    vec3 iris = mix(uIrisIn, uIrisOut, smoothstep(0.15, 0.85, r));
    float fib = vnoise(ang * 22.0 + r * 3.0) * 0.6 + vnoise(ang * 55.0 - r * 5.0) * 0.4;
    iris *= 0.72 + 0.55 * fib;
    iris *= mix(1.0, 0.45, smoothstep(0.80, 1.0, r));     // limbal ring
    iris *= 1.0 - 0.3 * smoothstep(0.55, 0.25, r) * (1.0 - fib);
    float pw = mix(0.085, 0.80, uDilate);
    float pe = length(vec2(iuv.x / (pw * R), iuv.y / (0.93 * R)));
    float pupil = 1.0 - smoothstep(0.92, 1.05, pe);
    col = mix(iris, vec3(0.004, 0.006, 0.006), pupil);
    // pupil rim slightly darker
    col *= 1.0 - 0.35 * band01(pe);
  } else {
    col = vec3(0.30, 0.27, 0.22) * smoothstep(-0.2, 0.6, n.x);
  }
  vec3 N = normalize(vN);
  float NoL = max(dot(N, uLightDir), 0.0);
  float sh = shadowAt(uEyeShadow, 0.002, 1.5);
  vec3 lit = col * (mix(uGroundCol, uSkyCol, 0.6) * 0.9 + uLightCol * (0.25 + 0.75 * NoL) * sh * 0.7);
  // cornea reflections
  float NoV = max(dot(N, V), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - NoV, 5.0);
  vec3 Rw = reflect(-V, N);
  vec3 refl = envColor(Rw) * (0.10 + fres);
  float hl = pow(max(dot(Rw, uLightDir), 0.0), 900.0) * 6.0 * sh;
  float hlWin = smoothstep(0.965, 0.985, dot(Rw, uWinDir)) * 1.2;
  float lidShade = mix(1.0, 0.62, smoothstep(0.20, 0.75, n.y)) * mix(1.0, 0.75, smoothstep(-0.55, -0.85, n.y));
  lit *= lidShade;
  col = lit + refl * 0.55 + uLightCol * hl + vec3(hlWin);
  // the tear film pools where the lids meet the eye and picks up the light
  float menis = smoothstep(0.46, 0.72, abs(n.y)) * (1.0 - smoothstep(0.76, 0.93, abs(n.y)));
  col += vec3(0.62, 0.63, 0.66) * menis * (0.22 + 0.78 * NoL) * sh * 0.45;
  oCol = vec4(outColor(col), 1.0);
}`.replace('float hashA', 'float band01(float pe){ return 1.0 - smoothstep(0.0, 0.25, abs(pe - 1.1)); }\nfloat hashA');

const WHISKER_VS = `
layout(location=0) in vec4 aW;     // x: whisker index, y: t (0..1), z: side (-1/1)
uniform mat4 uVP; uniform mat4 uHead;
uniform vec4 uRoot[40]; uniform vec4 uDir[40];
uniform vec2 uView;     // viewport size
uniform float uFan;     // -1 back .. +1 forward
uniform float uTime;
uniform float uPxPerM;  // approx pixels per metre at the whisker distance
out float vT; out float vCov; out vec3 vWorld; out float vSide;
void main(){
  int i = int(aW.x + 0.5);
  float t = aW.y;
  vec3 root = uRoot[i].xyz; float L = uRoot[i].w;
  vec3 d = normalize(uDir[i].xyz); float kind = uDir[i].w;
  float side = sign(root.z);
  // fan: rotate the whisker about the vertical axis at its root (forward when alert)
  float fan = ((kind < 0.5 ? 0.42 : 0.22) * uFan + 0.035 * sin(uTime * 1.3 + float(i) * 1.7)) * side;
  float cs = cos(fan), sn = sin(fan);
  d = vec3(d.x * cs + d.z * sn, d.y, -d.x * sn + d.z * cs);
  vec3 bend = normalize(vec3(0.6, -0.8, 0.0) - d * dot(vec3(0.6, -0.8, 0.0), d));
  vec3 pr = root + L * (d * t + bend * 0.16 * t * t);
  vec3 tr = normalize(d + bend * 0.32 * t);
  vec4 wp = uHead * vec4(pr, 1.0);
  vec3 tw = normalize(mat3(uHead) * tr);
  vec4 cp = uVP * wp;
  vec4 cp2 = uVP * vec4(wp.xyz + tw * 0.001, 1.0);
  vec2 sd = normalize((cp2.xy / cp2.w - cp.xy / cp.w) * uView);
  vec2 perp = vec2(-sd.y, sd.x);
  float widthM = mix(0.00030, 0.00005, t) * (kind < 0.5 ? 1.0 : 0.7);
  float px = widthM * uPxPerM * 1.0 / max(cp.w, 0.05);
  float wpx = max(px, 0.9);
  vCov = px / wpx;
  cp.xy += perp * aW.z * wpx / uView * cp.w;
  vT = t; vWorld = wp.xyz; vSide = aW.z;
  gl_Position = cp;
}`;
const WHISKER_FS = GLSL_COMMON + `
in float vT; in float vCov; in vec3 vWorld; in float vSide;
uniform float uFade;
out vec4 oCol;
void main(){
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  vec3 c = mix(vec3(0.55, 0.55, 0.56), vec3(0.95, 0.95, 0.94), smoothstep(0.0, 0.15, vT));
  vec3 col = c * (mix(uGroundCol, uSkyCol, 0.7) + uLightCol * 0.55);
  float a = vCov * (1.0 - smoothstep(0.85, 1.0, vT)) * 0.9 * uFade;
  oCol = vec4(outColor(col), a);
}`;

// room / props: one shader with a material switch
const ROOM_VS = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
uniform mat4 uVP; uniform mat4 uModel; uniform mat4 uShadowVP;
out vec3 vWorld; out vec3 vN; out vec2 vUV; out vec4 vShadow; out vec3 vLocal;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz; vN = normalize(mat3(uModel) * aNrm); vUV = aUV; vLocal = aPos;
  vShadow = uShadowVP * vec4(w.xyz + vN * 0.004, 1.0);
  gl_Position = uVP * w;
}`;
const ROOM_FS = GLSL_COMMON + `
#define ROOM_WALL_Y 2.6
in vec3 vWorld; in vec3 vN; in vec2 vUV; in vec4 vShadow; in vec3 vLocal;
uniform int uMat;
uniform sampler3D uNoise;
uniform vec3 uCatPos;     // for contact shadow
uniform vec4 uBall;       // ball position + radius (contact shadow)
uniform mat3 uBallRot;
uniform float uInMouth;
out vec4 oCol;
float n3(vec3 p){ return texture(uNoise, p).r; }
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 alb = vec3(0.5); float spec = 0.04; float gloss = 20.0;
  vec3 p = vWorld;
  if (uMat == 0) {           // oak floor planks
    float pw = 0.14;
    float row = floor(p.z / pw);
    float off = hash12(vec2(row, 3.0)) * 1.7;
    float plankLen = 1.1;
    float col = floor((p.x + off) / plankLen);
    float seed = hash12(vec2(row, col));
    vec2 lp = vec2(fract((p.x + off) / plankLen), fract(p.z / pw));
    float grain = n3(vec3(p.x * 0.9, p.z * 18.0, seed * 7.0)) * 0.6 + n3(vec3(p.x * 3.0, p.z * 60.0, seed)) * 0.4;
    float rings = sin((p.z * 90.0 + grain * 6.0 + seed * 20.0)) * 0.5 + 0.5;
    alb = mix(vec3(0.27, 0.16, 0.09), vec3(0.44, 0.28, 0.16), grain * 0.7 + rings * 0.15);
    alb *= 0.82 + 0.3 * seed;
    float seam = (1.0 - smoothstep(0.0, 0.012, lp.y)) + (1.0 - smoothstep(0.0, 0.004, lp.x));
    alb *= 1.0 - 0.45 * clamp(seam, 0.0, 1.0);
    spec = 0.06; gloss = 40.0;
  } else if (uMat == 1) {    // walls
    alb = vec3(0.60, 0.55, 0.49) * (0.97 + 0.06 * n3(p * 3.0));
    if (p.y < 0.09) alb = vec3(0.87, 0.85, 0.80);      // skirting board
    if (p.y > ROOM_WALL_Y - 0.02) alb = vec3(0.70, 0.68, 0.65);   // ceiling
  } else if (uMat == 2) {    // wool rug
    vec2 q = p.xz;
    float weave = n3(vec3(q * 60.0, 1.0)) * 0.5 + n3(vec3(q * 180.0, 2.0)) * 0.5;
    alb = vec3(0.50, 0.46, 0.41) * (0.80 + 0.30 * weave);
    // subtle border stripe
    vec2 lp = abs(vLocal.xz);
    float border = band2(max(lp.x / 0.95, lp.y / 0.66));
    alb = mix(alb, vec3(0.55, 0.50, 0.44) * (0.8 + 0.3 * weave), border);
    spec = 0.0;
  } else if (uMat == 3) {    // the duvet folded over the foot of the bed
    float weave = n3(vec3(p.x * 220.0, p.y * 220.0, p.z * 220.0)) * 0.5 + n3(p * 40.0) * 0.5;
    alb = vec3(0.45, 0.33, 0.27) * (0.86 + 0.24 * weave);
    spec = 0.015; gloss = 14.0;
  } else if (uMat == 4) {    // window (emissive)
    vec2 uv = vUV;
    float frame = step(0.47, abs(uv.x - 0.5)) + step(0.47, abs(uv.y - 0.5)) + (1.0 - step(0.012, abs(uv.x - 0.5))) + (1.0 - step(0.010, abs(uv.y - 0.55)));
    vec3 sky = mix(vec3(2.4, 2.5, 2.7), vec3(1.6, 1.9, 2.4), uv.y);
    vec3 c = frame > 0.5 ? vec3(0.85, 0.84, 0.82) : sky;
    oCol = vec4(outColor(c), 1.0); return;
  } else if (uMat == 5) {    // yarn ball
    vec3 lp = uBallRot * normalize(vLocal);
    float s1 = sin(dot(lp, vec3(0.0, 1.0, 0.3)) * 70.0 + n3(lp * 2.0) * 6.0);
    float s2 = sin(dot(lp, vec3(0.8, 0.1, -0.5)) * 64.0 + n3(lp * 2.0 + 1.0) * 6.0);
    float s3 = sin(dot(lp, vec3(-0.4, 0.6, 0.7)) * 58.0);
    float yarn = max(max(s1, s2 * 0.9), s3 * 0.8) * 0.5 + 0.5;
    alb = mix(vec3(0.40, 0.06, 0.05), vec3(0.78, 0.16, 0.12), yarn);
    spec = 0.02;
  } else if (uMat == 6) {    // plant pot / wood legs
    alb = vec3(0.30, 0.20, 0.13);
  } else if (uMat == 7) {    // leaves
    alb = vec3(0.10, 0.22, 0.08) * (0.8 + 0.4 * n3(p * 8.0));
  } else if (uMat == 10) {   // furniture: a warmer, paler oak than the floor
    float grain = n3(vec3(p.x * 2.2, p.y * 26.0, p.z * 2.0)) * 0.6 + n3(p * 42.0) * 0.4;
    alb = mix(vec3(0.42, 0.30, 0.19), vec3(0.60, 0.46, 0.31), grain);
    spec = 0.05; gloss = 46.0;
  } else if (uMat == 11) {   // bed linen
    float weave = n3(p * 300.0) * 0.5 + n3(p * 70.0) * 0.5;
    alb = vec3(0.80, 0.77, 0.71) * (0.90 + 0.14 * weave);
    spec = 0.015; gloss = 18.0;
  } else if (uMat == 12) {   // book spines, each its own colour
    vec3 cell = floor(vLocal * vec3(26.0, 1.0, 1.0));
    float t = hash12(cell.xy + 3.0);
    vec3 c1 = vec3(0.42, 0.13, 0.11), c2 = vec3(0.15, 0.26, 0.33), c3 = vec3(0.44, 0.35, 0.16), c4 = vec3(0.20, 0.30, 0.19);
    alb = t < 0.3 ? c1 : t < 0.55 ? c2 : t < 0.8 ? c3 : c4;
    alb *= 0.82 + 0.36 * hash12(cell.xy + 11.0);
    // a pale band along the top where the pages show
    alb = mix(alb, vec3(0.80, 0.76, 0.67), smoothstep(0.55, 0.85, fract(vLocal.y * 5.0)) * step(0.5, N.y));
    spec = 0.05; gloss = 30.0;
  } else if (uMat == 13) {   // glazed ceramic
    alb = vec3(0.72, 0.70, 0.66);
    spec = 0.3; gloss = 80.0;
  } else if (uMat == 14) {   // the lamp shade, lit from the inside
    float rim = smoothstep(0.1, 0.5, abs(N.y));
    alb = vec3(0.92, 0.80, 0.62);
    vec3 glow = vec3(1.55, 1.12, 0.66) * (1.0 - rim * 0.55);
    oCol = vec4(outColor(alb * (mix(uGroundCol, uSkyCol, 0.6) * 0.5) + glow), 1.0); return;
  } else if (uMat == 15) {   // brushed metal
    alb = vec3(0.30, 0.29, 0.28);
    spec = 0.45; gloss = 110.0;
  } else if (uMat == 17) {   // the toy mouse; vUV.x says which part this is
    float part = floor(vUV.x + 0.5);
    float felt = n3(vLocal * 220.0) * 0.5 + n3(vLocal * 60.0) * 0.5;
    alb = vec3(0.36, 0.35, 0.36) * (0.84 + 0.32 * felt);
    spec = 0.03; gloss = 24.0;
    if (part == 1.0) { alb = vec3(0.60, 0.32, 0.34); spec = 0.25; gloss = 70.0; }        // nose
    else if (part == 2.0) alb = vec3(0.58, 0.38, 0.39) * (0.9 + 0.2 * felt);             // ears
    else if (part == 3.0) { alb = vec3(0.52, 0.34, 0.35); spec = 0.15; gloss = 50.0; }   // tail
    else if (part == 4.0) { alb = vec3(0.72, 0.62, 0.24); spec = 0.45; gloss = 110.0; }  // the brass key
  } else if (uMat == 16) {   // what is in the picture frames
    vec2 q = vLocal.xy * 9.0;
    float f = n3(vec3(q, 1.0)) * 0.6 + n3(vec3(q * 2.7, 3.0)) * 0.4;
    alb = mix(vec3(0.62, 0.64, 0.60), vec3(0.34, 0.30, 0.26), smoothstep(0.42, 0.62, f));
    spec = 0.08; gloss = 40.0;
  } else if (uMat == 8) {    // teeth
    alb = vec3(0.80, 0.78, 0.72); spec = 0.35; gloss = 70.0;
  } else if (uMat == 9) {    // tongue
    float pap = n3(vLocal * 9.0 + 3.0);
    alb = vec3(0.72, 0.30, 0.34) * (0.85 + 0.3 * pap); spec = 0.22; gloss = 45.0;
  }
  float sh = shadowAt(vShadow, 0.0015, 2.5);
  float NoL = max(dot(N, uLightDir), 0.0);
  vec3 amb = mix(uGroundCol, uSkyCol, N.y * 0.5 + 0.5);
  // soft contact shadows under the cat and the ball
  float ao = 1.0;
  // 8 and 9 are the teeth and the tongue, which are only lit when the mouth is
  // open. Everything above that is furniture and must not be dimmed by it.
  if (uMat == 8 || uMat == 9) ao = uInMouth;
  if (uMat == 0 || uMat == 2) {
    vec2 dc = (p.xz - uCatPos.xz);
    ao *= 1.0 - 0.45 * exp(-dot(dc, dc) / (0.11 * 0.11)) * smoothstep(0.12, 0.0, uCatPos.y);
    vec2 db = p.xz - uBall.xz;
    ao *= 1.0 - 0.6 * exp(-dot(db, db) / (uBall.w * uBall.w * 1.4)) * smoothstep(uBall.w * 3.0, uBall.w, uBall.y);
  }
  // window light pool
  vec3 col = alb * ((amb + roomFill(N)) * ao + uLightCol * NoL * sh * (uMat == 8 || uMat == 9 ? ao * ao : 1.0));
  vec3 H = normalize(uLightDir + V);
  col += uLightCol * spec * pow(max(dot(N, H), 0.0), gloss) * sh * (uMat == 8 || uMat == 9 ? ao : 1.0);
  // and the lamp, which is the warm half of the room
  vec3 ld = lampDir(p);
  float lf = lampFall(p) * ao;
  col += alb * uLampCol * max(dot(N, ld), 0.0) * lf;
  col += uLampCol * spec * pow(max(dot(N, normalize(ld + V)), 0.0), gloss) * lf;
  if (uMat == 0) {
    vec3 R = reflect(-V, N);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    col += envColor(R) * fres * 0.25;
  }
  col += laserOn(p);
  oCol = vec4(outColor(col), 1.0);
}`.replace('out vec4 oCol;\nfloat n3', 'out vec4 oCol;\nfloat band2(float m){ return smoothstep(0.86, 0.88, m) * (1.0 - smoothstep(0.92, 0.94, m)); }\nfloat n3');

const DEPTH_VS = `
layout(location=0) in vec3 aPos;
uniform mat4 uVP; uniform mat4 uModel;
void main(){ gl_Position = uVP * uModel * vec4(aPos, 1.0); }`;
const DEPTH_FS = `out vec4 oCol; void main(){ oCol = vec4(1.0); }`;

// ---------------------------------------------------------------- cat data
const META = window.CAT_ASSET.meta;
function b64ToBytes(s) {
  const bin = atob(s.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const CATBIN = b64ToBytes(window.CAT_ASSET.data);

function buildCatVAO() {
  const nv = META.nv, nf = META.nf;
  let o = 0;
  const take = (bytes) => { const s = CATBIN.subarray(o, o + bytes); o += bytes; return s; };
  const pos = take(nv * 6), nrm = take(nv * 4), flw = take(nv * 4), sj = take(nv * 4), sw = take(nv * 4), reg = take(nv * 4), misc = take(nv * 4), extra = take(nv * 4);
  const idxBytes = take(nf * 3 * (nv < 65536 ? 2 : 4));
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const attr = (loc, data, size, type, norm, integer) => {
    makeBuffer(data);
    gl.enableVertexAttribArray(loc);
    if (integer) gl.vertexAttribIPointer(loc, size, type, 0, 0);
    else gl.vertexAttribPointer(loc, size, type, norm, 0, 0);
  };
  attr(0, pos, 3, gl.UNSIGNED_SHORT, true);
  attr(1, nrm, 4, gl.BYTE, true);
  attr(2, flw, 4, gl.BYTE, true);
  attr(3, sj, 4, gl.UNSIGNED_BYTE, false, true);
  attr(4, sw, 4, gl.UNSIGNED_BYTE, true);
  attr(5, reg, 4, gl.UNSIGNED_BYTE, true);
  attr(6, misc, 4, gl.UNSIGNED_BYTE, true);
  attr(7, extra, 4, gl.UNSIGNED_BYTE, true);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxBytes, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  // CPU copies for picking (rest positions + skin)
  const P = new Float32Array(nv * 3);
  const pv = new Uint16Array(pos.buffer.slice(pos.byteOffset, pos.byteOffset + pos.byteLength));
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) P[i * 3 + k] = META.lo[k] + (META.hi[k] - META.lo[k]) * pv[i * 3 + k] / 65535;
  const idx = nv < 65536 ? new Uint16Array(idxBytes.buffer.slice(idxBytes.byteOffset, idxBytes.byteOffset + idxBytes.byteLength)) : new Uint32Array(idxBytes.buffer.slice(idxBytes.byteOffset, idxBytes.byteOffset + idxBytes.byteLength));
  return { vao, count: nf * 3, type: nv < 65536 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT, rest: P, sj: new Uint8Array(sj), sw: new Uint8Array(sw), idx, reg: new Uint8Array(reg), nrm: new Int8Array(nrm.buffer.slice(nrm.byteOffset, nrm.byteOffset + nrm.byteLength)) };
}

// 3D value-noise texture (tileable)
function makeNoiseTex(n = 64) {
  const data = new Uint8Array(n * n * n);
  // smooth noise: sum of trilinear-interpolated lattices of different frequencies
  const lat = (f, seed) => { const a = new Float32Array(f * f * f); let s = seed; for (let i = 0; i < a.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; a[i] = s / 4294967296; } return a; };
  const octs = [[8, 0.5, 11], [16, 0.3, 23], [32, 0.2, 37]];
  const lats = octs.map(([f, , s]) => lat(f, s));
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = 0;
    octs.forEach(([f, amp], oi) => {
      const L = lats[oi];
      const fx = x / n * f, fy = y / n * f, fz = z / n * f;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
      let tx = fx - x0, ty = fy - y0, tz = fz - z0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); tz = tz * tz * (3 - 2 * tz);
      const g = (i, j, k) => L[((k % f) * f + (j % f)) * f + (i % f)];
      const c00 = lerp(g(x0, y0, z0), g(x0 + 1, y0, z0), tx), c10 = lerp(g(x0, y0 + 1, z0), g(x0 + 1, y0 + 1, z0), tx);
      const c01 = lerp(g(x0, y0, z0 + 1), g(x0 + 1, y0, z0 + 1), tx), c11 = lerp(g(x0, y0 + 1, z0 + 1), g(x0 + 1, y0 + 1, z0 + 1), tx);
      v += amp * lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
    });
    data[(z * n + y) * n + x] = Math.round(clamp(v, 0, 1) * 255);
  }
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, t);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, n, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT);
  return t;
}

// ---------------------------------------------------------------- skeleton
class Skeleton {
  constructor(meta) {
    this.bones = meta.bones;
    this.n = this.bones.length;
    this.idx = {};
    this.bones.forEach((b, i) => { this.idx[b.name] = i; });
    this.parent = this.bones.map((b) => (b.parent ? this.idx[b.parent] : -1));
    this.rest = this.bones.map((b) => b.pos);
    this.offset = this.bones.map((b, i) => (this.parent[i] < 0 ? [0, 0, 0] : v3.sub(b.pos, this.rest[this.parent[i]])));
    this.q = this.bones.map(() => Q.id());
    this.wq = this.bones.map(() => Q.id());
    this.wp = this.bones.map(() => [0, 0, 0]);
    this.rootPos = [0, 0, 0];
    this.rootQ = Q.id();
    this.skin = new Float32Array(this.n * 16);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.n * 4, 1, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }
  id(name) { return this.idx[name]; }
  resetPose() { for (let i = 0; i < this.n; i++) this.q[i] = Q.id(); }
  update() {
    for (let i = 0; i < this.n; i++) {
      const p = this.parent[i];
      if (p < 0) {
        this.wq[i] = Q.mul(this.rootQ, this.q[i]);
        this.wp[i] = this.rootPos.slice();
      } else {
        this.wq[i] = Q.norm(Q.mul(this.wq[p], this.q[i]));
        this.wp[i] = v3.add(this.wp[p], Q.rot(this.wq[p], this.offset[i]));
      }
      // skin = T(wp) R(wq) T(-rest)
      const t = v3.sub(this.wp[i], Q.rot(this.wq[i], this.rest[i]));
      M4.fromQT(this.wq[i], t, 1, this.skinView(i));
    }
  }
  skinView(i) { return this.skin.subarray(i * 16, i * 16 + 16); }
  upload() {
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.n * 4, 1, gl.RGBA, gl.FLOAT, this.skin);
  }
  // world position of a rest-space point carried by bone i
  pointOn(i, restP) { return v3.add(this.wp[i], Q.rot(this.wq[i], v3.sub(restP, this.rest[i]))); }
  // set bone i so that its world rotation equals wq (keeps parents)
  setWorldRot(i, wq) {
    const p = this.parent[i];
    const pq = p < 0 ? this.rootQ : this.wq[p];
    this.q[i] = Q.norm(Q.mul(Q.conj(pq), wq));
  }
}

// ---------------------------------------------------------------- scene & renderer
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
const QUALITY = { shells: IS_MOBILE ? 20 : 30, dprMax: IS_MOBILE ? 1.6 : 2.0, shadowSize: IS_MOBILE ? 1536 : 2048, level: 0 };

// A small warm room rather than a hall: a bed along the back wall, a desk under
// the window with a lamp on it, a chair pulled out, and a shelf of books. The
// cat has to be able to get around all of it, so every piece that stands on the
// floor is listed in BLOCKS and kept out of its way.
const ROOM = {
  floor: { x0: -2.6, x1: 2.6, z0: -2.3, z1: 2.6 },
  backZ: -2.3, leftX: -2.6, wallY: 2.6,
  bed: { x0: 0.25, x1: 2.35, z0: -2.3, z1: -0.60, seatY: 0.49 },
  desk: { x0: -2.55, x1: -1.15, z0: -0.60, z1: 0.30, topY: 0.74 },
  chair: { cx: -0.86, cz: -0.12, yaw: 0.42, seatY: 0.44, hw: 0.23 },
  shelf: { x0: -2.30, x1: -0.78, y: 1.45, z: -2.19, d: 0.22 },
  rug: { cx: 0.05, cz: 0.95, hx: 0.95, hz: 0.68 },
  lamp: [-2.30, 1.10, -0.40],
};
// Everything the cat can be standing on above the floor. Each one gives the
// patch it can actually stand on, clear of the pillows, the lamp and the books,
// so it never ends up perched on a mug.
const PERCHES = {
  bed:   { b: [ROOM.bed.x0 + 0.30, ROOM.bed.x1 - 0.30, ROOM.bed.z0 + 0.45, ROOM.bed.z1 - 0.14], y: ROOM.bed.seatY, label: '床', soft: true },
  desk:  { b: [-2.26, -1.30, -0.44, 0.16], y: ROOM.desk.topY, label: '书桌', soft: false },
  chair: { b: [ROOM.chair.cx - 0.12, ROOM.chair.cx + 0.12, ROOM.chair.cz - 0.12, ROOM.chair.cz + 0.12], y: ROOM.chair.seatY, label: '椅子', soft: true },
};
// where the cat stands to jump up, and where it lands coming down
const perchApproach = (k) => {
  const b = PERCHES[k].b;
  if (k === 'bed') return [[(b[0] + b[1]) / 2, 0, b[3] + 0.46], [(b[0] + b[1]) / 2, 0, b[3] + 0.60]];
  if (k === 'desk') return [[b[1] + 0.42, 0, (b[2] + b[3]) / 2], [b[1] + 0.58, 0, (b[2] + b[3]) / 2]];
  return [[b[0] - 0.42, 0, (b[2] + b[3]) / 2 + 0.26], [b[0] - 0.56, 0, (b[2] + b[3]) / 2 + 0.36]];
};
// footprints the cat walks around, as [x0, x1, z0, z1]
const BLOCKS = [
  [ROOM.desk.x0 - 0.1, ROOM.desk.x1, ROOM.desk.z0, ROOM.desk.z1],
  [ROOM.chair.cx - 0.30, ROOM.chair.cx + 0.30, ROOM.chair.cz - 0.30, ROOM.chair.cz + 0.30],
];
const LIGHT_DIR = v3.norm([-0.80, 0.62, 0.30]);
const LAMP_COL = [1.35, 0.82, 0.42];      // tungsten, against the cool daylight from the window
const WIN_DIR = v3.norm([-1.0, 0.42, 0.15]);

const R = {
  noise: makeNoiseTex(64),
  catProg: program(CAT_VS, CAT_FS),
  catShadowProg: program(CAT_VS, DEPTH_FS, '#define SHADOW'),
  eyeProg: program(EYE_VS, EYE_FS),
  whiskerProg: program(WHISKER_VS, WHISKER_FS),
  roomProg: program(ROOM_VS, ROOM_FS),
  depthProg: program(DEPTH_VS, DEPTH_FS),
  cat: buildCatVAO(),
  shells: QUALITY.shells,
  furScale: 0.9,
  view: M4.id(), proj: M4.id(), vp: M4.id(),
  camPos: [1, 0.5, 1],
  shadowVP: M4.id(),
};
const SK = new Skeleton(META);

// eyes ------------------------------------------------------------------
R.eyeMesh = (() => { const g = sphereGeom(1, 48, 32); return makeMesh(g.pos, g.nrm, g.idx); })();
function eyeFrame(ax) {
  const a = v3.norm(ax); let up = [0, 1, 0]; up = v3.norm(v3.sub(up, v3.mul(a, v3.dot(up, a))));
  const lt = v3.cross(a, up);
  return { a, up, lt };
}
const EYES = [
  { c: META.eyeL, f: eyeFrame(META.eyeAxL) },
  { c: META.eyeR, f: eyeFrame(META.eyeAxR) },
];
const EYE_R = 0.0094;

// whiskers ---------------------------------------------------------------
R.whiskers = (() => {
  const W = META.whiskers;
  const SEG = 16;
  const data = [], idx = [];
  W.forEach((w, i) => {
    const base = data.length / 4;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG;
      data.push(i, t, -1, 0, i, t, 1, 0);
    }
    for (let s = 0; s < SEG; s++) { const k = base + s * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
  });
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  makeBuffer(new Float32Array(data)); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  makeBuffer(new Uint16Array(idx), gl.ELEMENT_ARRAY_BUFFER);
  gl.bindVertexArray(null);
  const roots = new Float32Array(40 * 4), dirs = new Float32Array(40 * 4);
  W.forEach((w, i) => { roots.set([...w.root, w.len], i * 4); dirs.set([...w.dir, w.kind], i * 4); });
  return { vao, count: idx.length, roots, dirs };
})();

// room -------------------------------------------------------------------
function quadGeom(p0, du, dv, n, rep = [1, 1]) {
  const pos = [...p0, ...v3.add(p0, du), ...v3.add(v3.add(p0, du), dv), ...v3.add(p0, dv)];
  return { pos, nrm: [...n, ...n, ...n, ...n], uv: [0, 0, rep[0], 0, rep[0], rep[1], 0, rep[1]], idx: [0, 1, 2, 0, 2, 3] };
}
function fixWinding(g) {
  for (let t = 0; t < g.idx.length; t += 3) {
    const A = g.idx[t] * 3, B = g.idx[t + 1] * 3, C = g.idx[t + 2] * 3;
    const fn = v3.cross([g.pos[B] - g.pos[A], g.pos[B + 1] - g.pos[A + 1], g.pos[B + 2] - g.pos[A + 2]], [g.pos[C] - g.pos[A], g.pos[C + 1] - g.pos[A + 1], g.pos[C + 2] - g.pos[A + 2]]);
    if (v3.dot(fn, [g.nrm[A], g.nrm[A + 1], g.nrm[A + 2]]) < 0) { const tmp = g.idx[t + 1]; g.idx[t + 1] = g.idx[t + 2]; g.idx[t + 2] = tmp; }
  }
  return g;
}
R.room = (() => {
  const F = ROOM.floor, WY = ROOM.wallY;
  const box = (w, h, d, r, n, t, yaw) => transformGeom(roundBoxGeom(w, h, d, r, n), M4.fromQT(yaw ? Q.axis([0, 1, 0], yaw) : Q.id(), t));
  const cyl = (r, h, t, q, seg) => transformGeom(cylGeom(r, h, seg || 18), M4.fromQT(q || Q.id(), t));
  const shell = (g) => makeMesh(g.pos, g.nrm, g.idx, g.uv);

  const floor = fixWinding(quadGeom([F.x0, 0, F.z0], [F.x1 - F.x0, 0, 0], [0, 0, F.z1 - F.z0], [0, 1, 0]));
  const back = fixWinding(quadGeom([F.x0, 0, ROOM.backZ], [F.x1 - F.x0, 0, 0], [0, WY, 0], [0, 0, 1]));
  const left = fixWinding(quadGeom([ROOM.leftX, 0, F.z0], [0, 0, F.z1 - F.z0], [0, WY, 0], [1, 0, 0]));
  const right = fixWinding(quadGeom([F.x1, 0, F.z0], [0, 0, F.z1 - F.z0], [0, WY, 0], [-1, 0, 0]));
  const front = fixWinding(quadGeom([F.x0, 0, F.z1], [F.x1 - F.x0, 0, 0], [0, WY, 0], [0, 0, -1]));
  const ceil = fixWinding(quadGeom([F.x0, WY, F.z0], [F.x1 - F.x0, 0, 0], [0, 0, F.z1 - F.z0], [0, -1, 0]));
  const win = fixWinding(quadGeom([ROOM.leftX + 0.004, 0.95, 0.45], [0, 0, -1.3], [0, 1.10, 0], [1, 0, 0]));
  const rugG = box(ROOM.rug.hx * 2, 0.014, ROOM.rug.hz * 2, 0.007, 6, [ROOM.rug.cx, 0.0, ROOM.rug.cz]);

  // ---- bed: frame, mattress, headboard, duvet over the foot, two pillows
  const B = ROOM.bed;
  const bw = B.x1 - B.x0, bd = B.z1 - B.z0, bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2;
  const bedWood = mergeGeom([
    box(bw, 0.26, bd, 0.02, 4, [bx, 0.14, bz]),
    box(bw, 0.62, 0.07, 0.02, 4, [bx, 0.52, B.z0 + 0.04]),            // headboard
    box(0.09, 0.26, 0.09, 0.012, 3, [B.x0 + 0.07, 0.13, B.z1 - 0.07]),
    box(0.09, 0.26, 0.09, 0.012, 3, [B.x1 - 0.07, 0.13, B.z1 - 0.07]),
  ]);
  const bedLinen = mergeGeom([
    box(bw - 0.07, 0.20, bd - 0.07, 0.05, 9, [bx, 0.38, bz]),          // mattress, top ~0.48
    box(0.56, 0.15, 0.34, 0.07, 9, [B.x0 + 0.56, 0.555, B.z0 + 0.30]), // pillows
    box(0.56, 0.15, 0.34, 0.07, 9, [B.x1 - 0.56, 0.555, B.z0 + 0.30]),
  ]);
  const duvet = box(bw - 0.04, 0.14, 0.78, 0.07, 10, [bx, 0.53, B.z1 - 0.36]);

  // ---- desk under the window, with a drawer stack on one side
  const D = ROOM.desk;
  const dw = D.x1 - D.x0, dd = D.z1 - D.z0, dx = (D.x0 + D.x1) / 2, dz = (D.z0 + D.z1) / 2;
  const legY = D.topY - 0.045;
  const deskWood = mergeGeom([
    box(dw, 0.045, dd, 0.008, 3, [dx, D.topY - 0.022, dz]),
    box(0.44, legY, dd - 0.10, 0.01, 3, [D.x1 - 0.24, legY / 2, dz]),  // drawers
    box(0.055, legY, 0.055, 0.008, 3, [D.x0 + 0.06, legY / 2, D.z0 + 0.06]),
    box(0.055, legY, 0.055, 0.008, 3, [D.x0 + 0.06, legY / 2, D.z1 - 0.06]),
  ]);

  // ---- chair, turned away from the desk the way a chair actually sits
  const C = ROOM.chair;
  const cq = Q.axis([0, 1, 0], C.yaw);
  const chairAt = (w, h, d, r, n, lx, ly, lz) =>
    transformGeom(roundBoxGeom(w, h, d, r, n), M4.fromQT(cq, v3.add([C.cx, 0, C.cz], Q.rot(cq, [lx, ly, lz]))));
  const chair = mergeGeom([
    chairAt(0.44, 0.05, 0.44, 0.015, 3, 0, C.seatY, 0),
    chairAt(0.42, 0.50, 0.045, 0.015, 3, 0, C.seatY + 0.27, -0.195),   // back
    chairAt(0.045, C.seatY, 0.045, 0.008, 3, -0.19, C.seatY / 2, -0.19),
    chairAt(0.045, C.seatY, 0.045, 0.008, 3, 0.19, C.seatY / 2, -0.19),
    chairAt(0.045, C.seatY, 0.045, 0.008, 3, -0.19, C.seatY / 2, 0.19),
    chairAt(0.045, C.seatY, 0.045, 0.008, 3, 0.19, C.seatY / 2, 0.19),
  ]);

  // ---- shelf on the back wall
  const SH = ROOM.shelf;
  const shelfW = SH.x1 - SH.x0, shx = (SH.x0 + SH.x1) / 2;
  const shelf = mergeGeom([
    box(shelfW, 0.035, SH.d, 0.006, 3, [shx, SH.y, SH.z + SH.d / 2]),
    box(0.03, 0.17, SH.d - 0.04, 0.005, 2, [SH.x0 + 0.1, SH.y - 0.10, SH.z + SH.d / 2]),
    box(0.03, 0.17, SH.d - 0.04, 0.005, 2, [SH.x1 - 0.1, SH.y - 0.10, SH.z + SH.d / 2]),
  ]);

  // ---- books: a leaning row on the shelf and a short stack on the desk
  const books = [];
  let bxp = SH.x0 + 0.14;
  for (let i = 0; i < 11; i++) {
    const t = (i * 7919 % 97) / 97;
    const w = 0.028 + t * 0.022, hh = 0.19 + ((i * 7717 % 53) / 53) * 0.07;
    const lean = i === 8 ? 0.30 : 0;
    books.push(transformGeom(roundBoxGeom(w, hh, 0.15, 0.004, 2),
      M4.fromQT(Q.axis([0, 0, 1], lean), [bxp + w / 2, SH.y + 0.018 + hh / 2, SH.z + 0.10])));
    bxp += w + 0.004;
  }
  for (let i = 0; i < 3; i++) {
    books.push(box(0.21 - i * 0.012, 0.028, 0.15 - i * 0.008, 0.004, 2,
      [D.x0 + 0.78, D.topY + 0.014 + i * 0.028, dz - 0.14], 0.12 + i * 0.09));
  }
  const bookG = mergeGeom(books);

  // ---- the lamp: base, arm, shade. Its light is the warm one in the room.
  const L = ROOM.lamp;
  const armQ = Q.axis([0, 0, 1], -0.26);
  const lampMetal = mergeGeom([
    cyl(0.075, 0.022, [L[0] + 0.10, D.topY + 0.011, L[2]]),
    transformGeom(cylGeom(0.013, 0.42, 10), M4.mul(M4.fromQT(Q.id(), [L[0] + 0.10, D.topY + 0.22, L[2]]), M4.fromQT(armQ, [0, 0, 0]))),
  ]);
  const lampShade = transformGeom(coneGeom(0.115, 0.075, 0.14, 22), M4.fromQT(Q.axis([0, 0, 1], -0.18), [L[0], L[1], L[2]]));

  // ---- a mug, a plant by the window, a framed picture over the bed
  const ceramic = mergeGeom([
    cyl(0.043, 0.095, [D.x0 + 0.42, D.topY + 0.047, dz + 0.22]),
    cyl(0.14, 0.17, [F.x0 + 0.30, 0.085, 0.95], null, 14),               // plant pot
  ]);
  const leaves = mergeGeom([0, 1, 2, 3, 4, 5].map((i) => {
    const a = i * 1.04, r = 0.10 + (i % 3) * 0.035;
    return transformGeom(sphereGeom(0.085 + (i % 2) * 0.03, 10, 7),
      M4.fromQT(Q.id(), [F.x0 + 0.30 + Math.cos(a) * r, 0.25 + (i % 3) * 0.085, 0.95 + Math.sin(a) * r]));
  }));
  const frame = mergeGeom([
    box(0.46, 0.34, 0.025, 0.006, 2, [bx - 0.1, 1.62, ROOM.backZ + 0.015]),
    box(0.17, 0.21, 0.022, 0.004, 2, [SH.x1 + 0.42, 1.18, ROOM.backZ + 0.014]),
  ]);
  const picture = mergeGeom([
    box(0.40, 0.28, 0.006, 0.002, 2, [bx - 0.1, 1.62, ROOM.backZ + 0.030]),
    box(0.13, 0.17, 0.006, 0.002, 2, [SH.x1 + 0.42, 1.18, ROOM.backZ + 0.028]),
  ]);
  // window frame and sill, so the opening reads as a window in a wall
  const winWood = mergeGeom([
    box(0.05, 0.05, 1.42, 0.008, 2, [ROOM.leftX + 0.03, 0.93, -0.20]),
    box(0.05, 0.05, 1.42, 0.008, 2, [ROOM.leftX + 0.03, 2.07, -0.20]),
    box(0.05, 1.20, 0.05, 0.008, 2, [ROOM.leftX + 0.03, 1.50, 0.47]),
    box(0.05, 1.20, 0.05, 0.008, 2, [ROOM.leftX + 0.03, 1.50, -0.87]),
    box(0.17, 0.035, 1.52, 0.006, 2, [ROOM.leftX + 0.09, 0.915, -0.20]),   // sill
  ]);

  return {
    floor: shell(floor),
    walls: shell(mergeGeom([back, left, right, front, ceil])),
    window: shell(win),
    rug: shell(rugG),
    wood: shell(mergeGeom([bedWood, deskWood, chair, shelf, winWood])),
    linen: shell(bedLinen),
    duvet: shell(duvet),
    books: shell(bookG),
    ceramic: shell(ceramic),
    leaves: shell(leaves),
    metal: shell(mergeGeom([lampMetal, frame])),
    shade: shell(lampShade),
    picture: shell(picture),
  };
})();
R.ballMesh = (() => { const g = sphereGeom(1, 32, 20); return makeMesh(g.pos, g.nrm, g.idx, g.uv); })();
// the wind-up mouse, built nose-first along +X so it shares the cat's convention
R.mouseMesh = (() => {
  const sq = (sx, sy, sz, t) => transformGeom(sphereGeom(1, 16, 11),
    M4.mul(M4.fromQT(Q.id(), t), new Float32Array([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1])));
  // The parts overlap in space, so which piece a fragment belongs to cannot be
  // worked out from its position. Each one carries its own id in the uv instead.
  const tag = (g, id) => { const n = g.pos.length / 3, uv = new Array(n * 2); for (let i = 0; i < n; i++) { uv[i * 2] = id; uv[i * 2 + 1] = 0; } return { pos: g.pos, nrm: g.nrm, idx: g.idx, uv }; };
  const g = mergeGeom([
    tag(sq(0.058, 0.034, 0.038, [-0.004, 0.0, 0]), 0),            // body
    tag(sq(0.030, 0.026, 0.026, [0.050, -0.004, 0]), 0),          // head
    tag(sq(0.009, 0.007, 0.007, [0.079, -0.008, 0]), 1),          // nose
    tag(sq(0.004, 0.019, 0.019, [0.030, 0.030, -0.023]), 2),      // ears
    tag(sq(0.004, 0.019, 0.019, [0.030, 0.030, 0.023]), 2),
    tag(transformGeom(cylGeom(0.0045, 0.095, 8), M4.fromQT(Q.axis([0, 0, 1], Math.PI / 2 - 0.35), [-0.078, 0.013, 0])), 3),
    tag(transformGeom(cylGeom(0.0105, 0.040, 10), M4.fromQT(Q.axis([1, 0, 0], Math.PI / 2), [-0.028, 0.040, 0])), 4),
  ]);
  return makeMesh(g.pos, g.nrm, g.idx, g.uv);
})();
R.tongueMesh = (() => { const g = sphereGeom(1, 20, 12); return makeMesh(g.pos, g.nrm, g.idx, g.uv); })();
R.toothMesh = (() => {
  // unit cone pointing down -Y from the origin (base ring at y=0)
  const pos = [], nrm = [], idx = [];
  const n = 10;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); pos.push(c, 0, s); nrm.push(c, 0.3, s); pos.push(0, -1, 0); nrm.push(c, 0.3, s); }
  for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1);
  return makeMesh(pos, nrm, idx);
})();

// shadow map ---------------------------------------------------------------
R.shadow = (() => {
  const size = QUALITY.shadowSize;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
  gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, size };
})();

// the red dot: where it is, and how strongly it is showing
const LASER = { on: false, p: [0.4, 0.004, 0.9], shown: 0, lastMove: -10, idleFrom: 0 };
// A wind-up mouse. It does not drive in a straight line and it does not run
// continuously: it bolts, stops dead, swivels and bolts again, which is exactly
// the pattern that a cat cannot ignore. The spring runs down as it goes.
const MOUSE = { out: false, p: [0.6, 0.03, 1.4], yaw: 1.2, yawT: 1.2, speed: 0, wind: 0, burst: 0, pinned: 0, bump: 0 };
const SCENE = {
  ball: { p: [0.9, 0.022, 0.6], v: [0, 0, 0], r: 0.022, rot: Q.id(), visible: true, held: false },
  pet: { p: [0, 0, 0], dir: [1, 0, 0], s: 0 },
  mouthOpen: 0, tongueOut: 0, lidClose: [0, 0], dilate: 0.55, gaze: [[0, 0], [0, 0]], whiskerFan: 0, time: 0, fade: 1,
};

function setCommonUniforms(u) {
  gl.uniform3fv(u.uCamPos, R.camPos);
  gl.uniform3fv(u.uLightDir, LIGHT_DIR);
  gl.uniform3fv(u.uLightCol, [2.5, 2.28, 2.0]);
  gl.uniform3fv(u.uSkyCol, [0.38, 0.41, 0.47]);
  gl.uniform3fv(u.uGroundCol, [0.26, 0.20, 0.145]);
  gl.uniform1f(u.uExposure, 0.64);
  gl.uniform3fv(u.uWinDir, WIN_DIR);
  gl.uniform3fv(u.uLampPos, ROOM.lamp);
  gl.uniform3fv(u.uLampCol, LAMP_COL);
  gl.uniform4f(u.uLaser, LASER.p[0], LASER.p[1], LASER.p[2], LASER.shown);
  gl.uniform2f(u.uShadowTexel, 1 / R.shadow.size, 1 / R.shadow.size);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.shadow.tex); gl.uniform1i(u.uShadow, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, R.noise); if (u.uNoise) gl.uniform1i(u.uNoise, 2);
  gl.activeTexture(gl.TEXTURE0);
}

function computeShadowVP() {
  const c = [0.0, 0.0, 0.0];
  const eye = v3.add(c, v3.mul(LIGHT_DIR, 4.0));
  const view = M4.lookAt(eye, c, [0, 1, 0]);
  const proj = M4.ortho(-3.4, 3.4, -3.4, 3.4, 0.5, 9.0);
  R.shadowVP = M4.mul(proj, view);
}
computeShadowVP();

function catUniforms(P, vp) {
  const u = P.u;
  gl.uniformMatrix4fv(u.uVP, false, vp);
  gl.uniformMatrix4fv(u.uShadowVP, false, R.shadowVP);
  gl.uniform3fv(u.uLo, META.lo); gl.uniform3fv(u.uHi, META.hi);
  gl.uniform1f(u.uShellCount, R.shellsNow || R.shells);
  gl.uniform1f(u.uFurScale, R.furScale);
  gl.uniform4f(u.uPet, SCENE.pet.p[0], SCENE.pet.p[1], SCENE.pet.p[2], SCENE.pet.s);
  gl.uniform3fv(u.uPetDir, SCENE.pet.dir);
  gl.uniform1f(u.uTime, SCENE.time);
  gl.uniform1f(u.uBreath, SCENE.breath || 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, SK.tex); gl.uniform1i(u.uBones, 0);
}

function renderShadow() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.shadow.fb);
  gl.viewport(0, 0, R.shadow.size, R.shadow.size);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3.0);
  // cat
  gl.useProgram(R.catShadowProg.p);
  catUniforms(R.catShadowProg, R.shadowVP);
  gl.bindVertexArray(R.cat.vao);
  gl.drawElementsInstanced(gl.TRIANGLES, R.cat.count, R.cat.type, 0, 1);
  // props
  gl.useProgram(R.depthProg.p);
  gl.uniformMatrix4fv(R.depthProg.u.uVP, false, R.shadowVP);
  gl.uniformMatrix4fv(R.depthProg.u.uModel, false, M4.id());
  for (const m of [R.room.wood, R.room.linen, R.room.duvet, R.room.books, R.room.ceramic, R.room.metal, R.room.shade, R.room.leaves]) drawMesh(m);
  const b = SCENE.ball;
  if (b.visible) { gl.uniformMatrix4fv(R.depthProg.u.uModel, false, M4.fromQT(b.rot, b.p, b.r)); drawMesh(R.ballMesh); }
  if (MOUSE.out) { gl.uniformMatrix4fv(R.depthProg.u.uModel, false, M4.fromQT(Q.axis([0, 1, 0], MOUSE.yaw), MOUSE.p)); drawMesh(R.mouseMesh); }
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function renderScene(width, height) {
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.1, 0.09, 0.08, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  // room
  const rp = R.roomProg; gl.useProgram(rp.p);
  setCommonUniforms(rp.u);
  gl.uniformMatrix4fv(rp.u.uVP, false, R.vp);
  gl.uniformMatrix4fv(rp.u.uShadowVP, false, R.shadowVP);
  gl.uniformMatrix4fv(rp.u.uModel, false, M4.id());
  gl.uniform3fv(rp.u.uCatPos, catContactPos());
  const b = SCENE.ball;
  gl.uniform4f(rp.u.uBall, b.p[0], b.p[1], b.p[2], b.visible ? b.r : 0.0001);
  const mats = [[R.room.floor, 0], [R.room.walls, 1], [R.room.rug, 2], [R.room.duvet, 3], [R.room.window, 4],
    [R.room.wood, 10], [R.room.linen, 11], [R.room.books, 12], [R.room.ceramic, 13], [R.room.shade, 14],
    [R.room.metal, 15], [R.room.picture, 16], [R.room.leaves, 7]];
  for (const [m, id] of mats) { gl.uniform1i(rp.u.uMat, id); drawMesh(m); }
  if (MOUSE.out) {
    gl.uniform1i(rp.u.uMat, 17);
    const q = Q.mul(Q.axis([0, 1, 0], MOUSE.yaw), Q.axis([0, 0, 1], MOUSE.bump * 0.5));
    gl.uniformMatrix4fv(rp.u.uModel, false, M4.fromQT(q, MOUSE.p));
    drawMesh(R.mouseMesh);
    gl.uniformMatrix4fv(rp.u.uModel, false, M4.id());
  }
  if (b.visible) {
    gl.uniform1i(rp.u.uMat, 5);
    gl.uniformMatrix4fv(rp.u.uModel, false, M4.fromQT(Q.id(), b.p, b.r));
    const m = M4.fromQT(Q.conj(b.rot), [0, 0, 0]);
    gl.uniformMatrix3fv(rp.u.uBallRot, false, new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]));
    drawMesh(R.ballMesh);
  }
  // cat fur (base skin + shells in one instanced draw); fewer shells when the fur is only a few pixels thick
  {
    const c = SK.wp[SK.id('spine2')];
    const d = Math.max(0.15, v3.dist(R.camPos, c));
    const furPx = 0.0075 * 0.5 * height * R.proj[5] / d;
    R.shellsNow = clamp(Math.ceil(furPx * 1.35), 10, R.shells);
  }
  const cp = R.catProg; gl.useProgram(cp.p);
  setCommonUniforms(cp.u);
  catUniforms(cp, R.vp);
  gl.uniform1f(cp.u.uStrandDensity, 1750.0);
  gl.uniform1f(cp.u.uDither, MSAA >= 2 ? 0 : 1);
  gl.uniform3fv(cp.u.uEyeL, META.eyeL); gl.uniform3fv(cp.u.uEyeR, META.eyeR);
  gl.uniform3fv(cp.u.uEarO, [...META.earL.o, ...META.earR.o]);
  gl.uniform3fv(cp.u.uEarU, [...META.earL.u, ...META.earR.u]);
  gl.uniform3fv(cp.u.uEarW, [...META.earL.w, ...META.earR.w]);
  gl.uniform1f(cp.u.uMouthOpen, SCENE.mouthOpen);
  if (MSAA >= 2) gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  gl.bindVertexArray(R.cat.vao);
  gl.drawElementsInstanced(gl.TRIANGLES, R.cat.count, R.cat.type, 0, R.shellsNow + 1);
  gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  // tongue & teeth (only when the mouth is open or the tongue sticks out)
  const open = SCENE.mouthOpen, tout = SCENE.tongueOut;
  if (open > 0.02 || tout > 0.02) {
    gl.useProgram(rp.p);
    const M = META.mouth;
    const jawS = SK.skinView(SK.id('jaw')), headS = SK.skinView(SK.id('head'));
    gl.uniform1f(rp.u.uInMouth, clamp(0.25 + 0.6 * open + 0.4 * tout, 0, 1));
    gl.uniform1i(rp.u.uMat, 9);
    const tc = v3.add(M.tongue, [0.0078 * tout + 0.002 * open, -0.0006, 0]);
    const tq = Q.axis([0, 0, 1], -0.12 * tout);
    const tm = M4.mul(jawS, M4.mul(M4.fromQT(tq, tc), new Float32Array([0.0118, 0, 0, 0, 0, 0.0021, 0, 0, 0, 0, 0.0070, 0, 0, 0, 0, 1])));
    gl.uniformMatrix4fv(rp.u.uModel, false, tm);
    drawMesh(R.tongueMesh);
    const tv = smooth((open - 0.12) / 0.4);
    if (tv > 0.01) {
      gl.uniform1i(rp.u.uMat, 8);
      for (const [pos, bone, dir] of [[M.upper[0], headS, 1], [M.upper[1], headS, 1], [M.lower[0], jawS, -1], [M.lower[1], jawS, -1]]) {
        const len = (dir > 0 ? 0.0042 : 0.0034) * tv;
        const m = M4.mul(bone, new Float32Array([0.0011, 0, 0, 0, 0, len * dir, 0, 0, 0, 0, 0.0011, 0, pos[0], pos[1], pos[2], 1]));
        gl.uniformMatrix4fv(rp.u.uModel, false, m);
        drawMesh(R.toothMesh);
      }
    }
  }
  // eyes
  const ep = R.eyeProg; gl.useProgram(ep.p);
  setCommonUniforms(ep.u);
  gl.uniformMatrix4fv(ep.u.uVP, false, R.vp);
  gl.uniformMatrix4fv(ep.u.uShadowVP, false, R.shadowVP);
  gl.uniform1f(ep.u.uDilate, SCENE.dilate);
  gl.uniform3fv(ep.u.uIrisIn, [0.34, 0.27, 0.07]);
  gl.uniform3fv(ep.u.uIrisOut, [0.16, 0.23, 0.10]);
  const head = SK.skinView(SK.id('head'));
  EYES.forEach((e, i) => {
    const [yaw, pitch] = SCENE.gaze[i];
    const f = e.f;
    const rot = new Float32Array([f.a[0], f.a[1], f.a[2], 0, f.up[0], f.up[1], f.up[2], 0, f.lt[0], f.lt[1], f.lt[2], 0, e.c[0], e.c[1], e.c[2], 1]);
    const g = M4.fromQT(Q.mul(Q.axis([0, 1, 0], yaw), Q.axis([0, 0, 1], pitch)), [0, 0, 0], EYE_R);
    const model = M4.mul(head, M4.mul(rot, g));
    gl.uniformMatrix4fv(ep.u.uModel, false, model);
    gl.uniformMatrix4fv(ep.u.uModelInv, false, M4.inv(model));
    const wc = M4.point(head, e.c);
    const sc = M4.mul(R.shadowVP, M4.fromQT(Q.id(), wc));
    gl.uniform4f(ep.u.uEyeShadow, sc[12], sc[13], sc[14], sc[15]);
    drawMesh(R.eyeMesh);
  });
  // whiskers
  const wp = R.whiskerProg; gl.useProgram(wp.p);
  setCommonUniforms(wp.u);
  gl.uniformMatrix4fv(wp.u.uVP, false, R.vp);
  gl.uniformMatrix4fv(wp.u.uHead, false, head);
  gl.uniform4fv(wp.u.uRoot, R.whiskers.roots);
  gl.uniform4fv(wp.u.uDir, R.whiskers.dirs);
  gl.uniform2f(wp.u.uView, width, height);
  gl.uniform1f(wp.u.uFan, SCENE.whiskerFan);
  gl.uniform1f(wp.u.uTime, SCENE.time);
  gl.uniform1f(wp.u.uPxPerM, 0.5 * height * R.proj[5]);
  gl.uniform1f(wp.u.uFade, 1.0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false); gl.disable(gl.CULL_FACE);
  gl.bindVertexArray(R.whiskers.vao);
  gl.drawElements(gl.TRIANGLES, R.whiskers.count, gl.UNSIGNED_SHORT, 0);
  gl.depthMask(true); gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
}

// camera -----------------------------------------------------------------------
const CAM = {
  az: 0.95, el: 0.26, dist: 1.15, target: [0.18, 0.17, 0.3], fov: 38 * D2R,
  tAz: 0.95, tEl: 0.26, tDist: 1.15, follow: true, userTime: 0,
  update(dt, catPos) {
    this.az = expDecay(this.az, this.tAz, 10, dt);
    this.el = expDecay(this.el, this.tEl, 10, dt);
    this.dist = expDecay(this.dist, this.tDist, 8, dt);
    if (catPos) {
      const want = [catPos[0], clamp(catPos[1], 0.10, 0.6), catPos[2]];
      this.target = v3.lerp(this.target, want, 1 - Math.exp(-3.0 * dt));
    }
  },
  matrices(aspect) {
    const ce = Math.cos(this.el), se = Math.sin(this.el);
    // on tall screens aim a little below the cat so it sits above the action bar
    const tgt = [this.target[0], this.target[1] - (aspect < 0.8 ? 0.06 * this.dist : 0.02 * this.dist), this.target[2]];
    let eye = [tgt[0] + this.dist * ce * Math.cos(this.az), tgt[1] + this.dist * se, tgt[2] + this.dist * ce * Math.sin(this.az)];
    // keep inside the room
    eye[0] = clamp(eye[0], ROOM.leftX + 0.15, ROOM.floor.x1 - 0.15);
    eye[2] = clamp(eye[2], ROOM.backZ + 0.15, ROOM.floor.z1 - 0.15);
    eye[1] = clamp(eye[1], 0.04, 2.4);
    R.camPos = eye;
    R.view = M4.lookAt(eye, tgt, [0, 1, 0]);
    const fovY = clamp(2 * Math.atan(Math.tan(17 * D2R) / aspect), this.fov, 62 * D2R);
    R.proj = M4.persp(fovY, aspect, 0.02, 30);
    R.vp = M4.mul(R.proj, R.view);
  },
};

// ---------------------------------------------------------------- animation core: poses, blending, IK, gait
const BI = (n) => SK.idx[n];
const NB = SK.n;
const PIVOT = [-0.02, 0.15, 0.0];
const restOf = (n) => SK.rest[BI(n)];
const endOf = (n) => META.bones[BI(n)].end;

// leg rest data (cat frame)
const LEGDEF = {};
for (const [k, chain, front] of [['FL', ['armL', 'foreL', 'handL', 'fingL'], true], ['FR', ['armR', 'foreR', 'handR', 'fingR'], true],
  ['HL', ['thighL', 'shinL', 'footL', 'toeL'], false], ['HR', ['thighR', 'shinR', 'footR', 'toeR'], false]]) {
  const j = chain.map((n) => restOf(n));
  const tip = endOf(chain[3]);
  const contact = [j[3][0] + (front ? 0.004 : 0.006), 0.0, j[3][2]];
  LEGDEF[k] = {
    key: k, chain, ids: chain.map(BI), front, side: chain[0].endsWith('L') ? -1 : 1,
    j, tip, contact,
    L1: v3.dist(j[0], j[1]), L2: v3.dist(j[1], j[2]),
    // offsets of joint 2 (wrist / hock), joint 3 and the tip relative to the contact point, flat paw
    oJ2: v3.sub(j[2], contact), oJ3: v3.sub(j[3], contact), oTip: v3.sub(tip, contact),
  };
}
const LEGKEYS = ['FL', 'FR', 'HL', 'HR'];

// ---- pose objects -------------------------------------------------------
function poseNew() {
  const q = new Array(NB);
  for (let i = 0; i < NB; i++) q[i] = Q.id();
  return { q, dx: 0, dy: 0, dz: 0, pitch: 0, roll: 0, yaw: 0, plant: 0, jaw: 0 };
}
function poseFromSpec(spec) {
  const p = poseNew();
  for (const k in spec.b || {}) { const e = spec.b[k]; p.q[BI(k)] = Q.euler(e[0], e[1], e[2]); }
  const r = spec.root || {};
  p.dx = r.dx || 0; p.dy = r.dy || 0; p.dz = r.dz || 0; p.pitch = r.pitch || 0; p.roll = r.roll || 0; p.yaw = r.yaw || 0;
  p.plant = spec.plant || 0;
  p.jaw = spec.jaw || 0;
  return p;
}
function poseCopy(a) {
  return { q: a.q.map((x) => x.slice()), dx: a.dx, dy: a.dy, dz: a.dz, pitch: a.pitch, roll: a.roll, yaw: a.yaw, plant: a.plant, jaw: a.jaw };
}
function poseBlend(a, b, t) {
  const o = poseNew();
  for (let i = 0; i < NB; i++) o.q[i] = Q.slerp(a.q[i], b.q[i], t);
  for (const k of ['dx', 'dy', 'dz', 'pitch', 'roll', 'yaw', 'plant', 'jaw']) o[k] = lerp(a[k], b[k], t);
  return o;
}
// add rotations of pose d (relative to identity) on top of a
function poseAddBone(p, name, rx, ry, rz) { const i = BI(name); p.q[i] = Q.mul(p.q[i], Q.euler(rx, ry, rz)); }

// ---- smooth noise: the slow, never-repeating drift of a body that is alive
function hashN(i) { let s = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); s ^= s >>> 13; s = Math.imul(s, 0xc2b2ae35); return ((s ^ (s >>> 16)) >>> 0) / 2147483648 - 1; }
function noise1(x) { const i = Math.floor(x), f = x - i; return lerp(hashN(i), hashN(i + 1), f * f * (3 - 2 * f)); }
function fnoise(x, seed = 0) { return noise1(x + seed * 37.7) * 0.68 + noise1(x * 2.31 + seed * 91.3 + 5.5) * 0.32; }

// ---- overlapping action ---------------------------------------------------
// An animal does not drive every joint to its new angle on one curve: the hips
// commit first, the shoulders follow, the head settles last and the tail
// trails behind everything. Giving each group its own slice of the transition,
// and letting limbs swing a little past their mark before coming back, is most
// of what separates a cat from a mechanism.
const STAGE = [
  [0.00, 1.00],   // 0 core: pelvis and spine lead
  [0.14, 0.86],   // 1 head & neck: arrive last
  [0.05, 0.95],   // 2 front left
  [0.11, 0.89],   // 3 front right — deliberately unequal to the left
  [0.08, 0.92],   // 4 hind left
  [0.03, 0.97],   // 5 hind right
  [0.20, 0.80],   // 6 tail — the spring chain does the rest
  [0.16, 0.84],   // 7 ears
];
const STAGE_OF = (() => {
  const g = new Int8Array(NB);
  const set = (names, k) => names.forEach((n) => { if (SK.idx[n] !== undefined) g[BI(n)] = k; });
  set(['root', 'pelvis', 'spine1', 'spine2'], 0);
  set(['neck', 'head', 'jaw', 'lidUL', 'lidDL', 'lidUR', 'lidDR'], 1);
  set(['scapL', 'armL', 'foreL', 'handL', 'fingL'], 2);
  set(['scapR', 'armR', 'foreR', 'handR', 'fingR'], 3);
  set(['thighL', 'shinL', 'footL', 'toeL'], 4);
  set(['thighR', 'shinR', 'footR', 'toeR'], 5);
  for (let i = 0; i < 8; i++) set(['tail' + i], 6);
  set(['earL', 'earR'], 7);
  return g;
})();
// ease out with a small overshoot: a limb thrown by muscle, not driven to a stop
function easeSettle(t) { const u = clamp(t, 0, 1) - 1; return 1 + u * u * (2.1 * u + 1.1); }
function poseBlendStaged(a, b, t) {
  const o = poseNew();
  const done = t >= 1;
  const e = STAGE.map(([d, span], gi) => {
    const u = clamp((t - d) / span, 0, 1);
    return gi === 0 ? smoother(u) : easeSettle(u);     // the core must not overshoot its height
  });
  for (let i = 0; i < NB; i++) o.q[i] = done ? b.q[i].slice() : Q.slerp(a.q[i], b.q[i], e[STAGE_OF[i]]);
  for (const k of ['dx', 'dy', 'dz', 'pitch', 'roll', 'yaw', 'plant', 'jaw']) o[k] = lerp(a[k], b[k], e[0]);
  return o;
}
// paired bones that should never be perfectly mirrored
const ASYM_BONES = ['scapL', 'armL', 'foreL', 'handL', 'scapR', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const ASYM = (() => { const a = []; for (let i = 0; i < NB; i++) a.push([hashN(i * 3 + 1), hashN(i * 3 + 2), hashN(i * 3 + 3)]); return a; })();

// ---- pose library (degrees; bones in the cat frame, +X forward, +Y up, +Z right)
// rz > 0 swings a downward bone forward / lifts a forward bone
const TAIL_UP = { tail0: [0, 0, -52], tail1: [0, 0, -26], tail2: [0, 0, -8], tail3: [0, 0, 2], tail4: [0, 0, 6], tail5: [0, 0, 8], tail6: [0, 0, 10], tail7: [0, 0, 12] };
const POSE_SPECS = {
  stand: {
    plant: 1,
    b: Object.assign({ neck: [0, 0, -12], head: [0, 0, 6] }, TAIL_UP),
  },
  standLow: {   // relaxed, tail mid
    plant: 1,
    b: { neck: [0, 0, -16], head: [0, 0, 8], tail0: [0, 0, -18], tail1: [0, 0, -6], tail2: [0, 0, 6], tail3: [0, 0, 8], tail4: [0, 0, 6], tail5: [0, 0, 4], tail6: [0, 0, -6], tail7: [0, 0, -10] },
  },
  sit: {
    root: { dy: -0.150 },
    b: {
      pelvis: [0, 0, 50], spine1: [0, 0, -4], spine2: [0, 0, -2], neck: [0, 0, -26], head: [0, 0, -14],
      scapL: [0, 0, -6], scapR: [0, 0, -6], armL: [0, 0, -38], armR: [0, 0, -38], foreL: [0, 0, 0], foreR: [0, 0, 0],
      handL: [0, 0, -2], handR: [0, 0, -2], fingL: [0, 0, 2], fingR: [0, 0, 2],
      thighL: [-4, 0, 26], thighR: [4, 0, 26], shinL: [0, 0, -82], shinR: [0, 0, -82], footL: [0, 0, 76], footR: [0, 0, 76], toeL: [0, 0, -46], toeR: [0, 0, -46],
      tail0: [0, 0, -42], tail1: [0, 22, 4], tail2: [0, 26, 4], tail3: [0, 26, 2], tail4: [0, 24, 0], tail5: [0, 22, 0], tail6: [0, 20, 0], tail7: [0, 16, 0],
    },
  },
  loaf: {
    root: { dy: -0.132 },
    b: {
      neck: [0, 0, -4], head: [0, 0, 2],
      armL: [0, 0, -40], armR: [0, 0, -40], foreL: [0, 0, 122], foreR: [0, 0, 122], handL: [0, 0, -30], handR: [0, 0, -30], fingL: [0, 0, -34], fingR: [0, 0, -34],
      thighL: [-6, 0, 44], thighR: [6, 0, 44], shinL: [0, 0, -86], shinR: [0, 0, -86], footL: [0, 0, 108], footR: [0, 0, 108], toeL: [0, 0, -44], toeR: [0, 0, -44],
      tail0: [0, 0, 8], tail1: [0, 18, 6], tail2: [0, 22, 2], tail3: [0, 24, 0], tail4: [0, 22, 0], tail5: [0, 20, 0], tail6: [0, 16, 0], tail7: [0, 12, 0],
    },
  },
  side: {   // lying on the right side, legs relaxed
    root: { dy: -0.088, roll: 84 },
    b: {
      spine1: [0, 0, -4], spine2: [0, 0, -4], neck: [0, 0, 6], head: [0, 0, 10],
      armL: [-22, 0, 24], foreL: [0, 0, 16], handL: [0, 0, -18], armR: [6, 0, 30], foreR: [0, 0, 12], handR: [0, 0, -14],
      thighL: [-24, 0, 30], shinL: [0, 0, -20], footL: [0, 0, 16], thighR: [6, 0, 24], shinR: [0, 0, -16], footR: [0, 0, 12],
      tail0: [0, 0, 20], tail1: [0, 0, 8], tail2: [0, 0, 4], tail3: [0, 0, 2], tail4: [0, 0, 4], tail5: [0, 0, 6], tail6: [0, 0, 8], tail7: [0, 0, 10],
    },
  },
  bellyUp: {   // on the back, chest up, hips rolled a little to one side, front paws curled
    root: { dy: -0.100, roll: 172 },
    b: {
      pelvis: [-24, 0, 4], spine1: [-6, 0, -6], spine2: [12, 0, -6], neck: [8, 0, 26], head: [10, -10, 24],
      armL: [-14, 0, 38], foreL: [0, 0, 78], handL: [0, 0, -58], fingL: [0, 0, -30],
      armR: [14, 0, 32], foreR: [0, 0, 74], handR: [0, 0, -54], fingR: [0, 0, -30],
      thighL: [-40, 0, 40], shinL: [0, 0, -55], footL: [0, 0, 36], toeL: [0, 0, -20],
      thighR: [34, 0, 30], shinR: [0, 0, -45], footR: [0, 0, 28], toeR: [0, 0, -20],
      tail0: [0, 0, -12], tail1: [0, -14, -4], tail2: [0, -14, -2], tail3: [0, -12, 0], tail4: [0, -10, 2], tail5: [0, -8, 2], tail6: [0, -6, 2], tail7: [0, -4, 2],
    },
  },
  curl: {   // sleeping donut on the right side
    root: { dy: -0.095, roll: 82, dx: 0.0 },
    b: {
      pelvis: [0, 0, 16], spine1: [0, 0, -24], spine2: [0, 0, -26], neck: [0, 0, -46], head: [0, -8, -40],
      armL: [-12, 0, 34], foreL: [0, 0, 92], handL: [0, 0, -44], fingL: [0, 0, -20],
      armR: [6, 0, 30], foreR: [0, 0, 96], handR: [0, 0, -40], fingR: [0, 0, -20],
      thighL: [-12, 0, 64], shinL: [0, 0, -92], footL: [0, 0, 70], toeL: [0, 0, -30],
      thighR: [8, 0, 66], shinR: [0, 0, -94], footR: [0, 0, 70], toeR: [0, 0, -30],
      tail0: [0, 0, 40], tail1: [0, 0, 34], tail2: [0, 0, 34], tail3: [0, 0, 34], tail4: [0, 0, 32], tail5: [0, 0, 30], tail6: [0, 0, 28], tail7: [0, 0, 24],
    },
  },
  crouch: {  // hunting crouch, body low and level, head forward
    root: { dy: -0.070, pitch: -3 },
    plant: 1,
    b: { neck: [0, 0, -34], head: [0, 0, 24], tail0: [0, 0, 16], tail1: [0, 0, 4], tail2: [0, 0, 2], tail3: [0, 0, 0], tail4: [0, 0, -2], tail5: [0, 0, -4], tail6: [0, 0, -6], tail7: [0, 0, -10] },
  },
  pickup: {  // nose to the floor in front of the paws
    root: { dy: -0.022, pitch: -8 },
    plant: 1,
    b: { neck: [0, 0, -52], head: [0, 0, -34], tail0: [0, 0, -30], tail1: [0, 0, -14], tail2: [0, 0, 0], tail3: [0, 0, 6], tail4: [0, 0, 8] },
  },
  stretch: {  // front legs forward, rump up
    root: { dy: -0.035, pitch: -20, dx: 0.02 },
    plant: 1,
    b: { spine1: [0, 0, 6], spine2: [0, 0, 8], neck: [0, 0, 6], head: [0, 0, 16], tail0: [0, 0, -40], tail1: [0, 0, -20], tail2: [0, 0, -6], tail3: [0, 0, 4] },
  },
};
const POSES = {};
for (const k in POSE_SPECS) POSES[k] = poseFromSpec(POSE_SPECS[k]);
// feet offsets for IK-planted poses (cat-frame contact points, relative to rest contact)
const POSE_FEET = { stretch: { FL: [0.085, 0], FR: [0.085, 0], HL: [0, 0], HR: [0, 0] }, crouch: { FL: [0.012, 0], FR: [0.012, 0], HL: [0.03, 0], HR: [0.03, 0] } };

// ---- applying a pose to the skeleton ------------------------------------
function rootFromPose(P, cat) {
  const qpr = Q.euler(P.roll, P.yaw, P.pitch);
  const qy = Q.axis([0, 1, 0], cat.yaw);
  SK.rootQ = Q.mul(qy, qpr);
  const off = v3.sub(v3.add(PIVOT, [P.dx, P.dy, P.dz]), Q.rot(qpr, PIVOT));
  SK.rootPos = v3.add([cat.pos[0], cat.groundY, cat.pos[2]], Q.rot(qy, off));
}
function applyPose(P, cat) {
  for (let i = 0; i < NB; i++) SK.q[i] = P.q[i].slice();
  rootFromPose(P, cat);
}

// ---- IK ------------------------------------------------------------------
function aimBone(i, childRest, target) {
  const cur = v3.sub(SK.pointOn(i, childRest), SK.wp[i]);
  const want = v3.sub(target, SK.wp[i]);
  if (v3.len(want) < 1e-6) return;
  const r = Q.fromTo(cur, want);
  SK.setWorldRot(i, Q.mul(r, SK.wq[i]));
  SK.update();
}
function twoBone(A, B, L1, L2, pole) {
  let ab = v3.sub(B, A);
  let d = v3.len(ab);
  const dmax = (L1 + L2) * 0.999, dmin = Math.abs(L1 - L2) * 1.05 + 1e-4;
  const dc = clamp(d, dmin, dmax);
  const dir = v3.mul(ab, 1 / (d || 1));
  const cosA = clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  let n = v3.cross(dir, pole);
  if (v3.len(n) < 1e-6) n = v3.cross(dir, [0, 0, 1]);
  n = v3.norm(n);
  const bend = v3.norm(v3.cross(n, dir));
  return v3.add(A, v3.add(v3.mul(dir, L1 * cosA), v3.mul(bend, L1 * sinA)));
}
// place a leg so its contact point is at T (world). flex: 0 flat paw .. 1 curled (swing)
function solveLeg(key, T, qyaw, flex = 0, weight = 1) {
  if (weight <= 0.001) return;
  const L = LEGDEF[key];
  const [i0, i1, i2, i3] = L.ids;
  const fwd = Q.rot(qyaw, [1, 0, 0]);
  const up = [0, 1, 0];
  // paw orientation: rotate the paw offsets about the lateral axis when flexing
  const lat = Q.rot(qyaw, [0, 0, 1]);
  const qflex = Q.axis(lat, (L.front ? -1 : 1) * flex * 1.25);
  const o2 = Q.rot(qflex, Q.rot(qyaw, L.oJ2)), o3 = Q.rot(qflex, Q.rot(qyaw, L.oJ3)), ot = Q.rot(qflex, Q.rot(qyaw, L.oTip));
  const J2 = v3.add(T, o2), J3 = v3.add(T, o3), Tip = v3.add(T, ot);
  // keep the original (FK) rotations to blend with
  const keep = weight < 0.999 ? L.ids.map((i) => SK.q[i].slice()) : null;
  const A = SK.wp[i0];
  const pole = L.front ? v3.add(v3.mul(fwd, -1), v3.mul(up, -0.2)) : v3.add(fwd, v3.mul(up, -0.2));
  const knee = twoBone(A, J2, L.L1, L.L2, pole);
  aimBone(i0, L.j[1], knee);
  aimBone(i1, L.j[2], J2);
  aimBone(i2, L.j[3], J3);
  aimBone(i3, L.tip, Tip);
  if (keep) {
    L.ids.forEach((i, k) => { SK.q[i] = Q.slerp(keep[k], SK.q[i], weight); });
    SK.update();
  }
}
// world contact point of a leg's home position for the current root (cat yaw/pos), optional offset (dx,dz in cat frame)
function homeContact(key, cat, off) {
  const L = LEGDEF[key];
  const qy = Q.axis([0, 1, 0], cat.yaw);
  const c = v3.add(L.contact, off ? [off[0], 0, off[1]] : [0, 0, 0]);
  const p = v3.add([cat.pos[0], 0, cat.pos[2]], Q.rot(qy, c));
  p[1] = supportY(p[0], p[2], cat);
  return p;
}

// support surfaces --------------------------------------------------------
function supportY(x, z, cat) {
  if (cat && PERCHES[cat.level]) return PERCHES[cat.level].y;
  const R0 = ROOM.rug;
  if (Math.abs(x - R0.cx) < R0.hx && Math.abs(z - R0.cz) < R0.hz) return 0.012;
  return 0.0;
}

// ---- gait engine ---------------------------------------------------------
const GAITS = {
  walk: { duty: 0.64, off: { HL: 0.0, FL: 0.25, HR: 0.5, FR: 0.75 }, lift: 0.030, bob: 0.004 },
  trot: { duty: 0.50, off: { HL: 0.0, FR: 0.02, HR: 0.5, FL: 0.52 }, lift: 0.040, bob: 0.006 },
  gallop: { duty: 0.32, off: { HL: 0.0, HR: 0.10, FL: 0.48, FR: 0.60 }, lift: 0.055, bob: 0.018 },
};
// small fixed per-leg quirks, so the four legs never run in lockstep
const GAIT_JITTER = { FL: 0.021, FR: -0.016, HL: -0.012, HR: 0.018 };
const GAIT_CURL = { FL: 1.06, FR: 0.93, HL: 0.97, HR: 1.04 };
class Gait {
  constructor() {
    this.phase = 0;
    this.legs = {};
    for (const k of LEGKEYS) this.legs[k] = { F: null, swinging: false, from: null, to: null, s: 0, flex: 0 };
    this.mix = { walk: 1, trot: 0, gallop: 0 };
    this.speed = 0;
    this.active = false;
  }
  reset(cat) {
    for (const k of LEGKEYS) { const l = this.legs[k]; l.F = homeContact(k, cat); l.swinging = false; l.flex = 0; }
    this.phase = 0;
  }
  params(v) {
    // weights per gait from speed
    const w = clamp((v - 0.55) / 0.35, 0, 1), g = clamp((v - 1.45) / 0.4, 0, 1);
    const mix = { walk: (1 - w), trot: w * (1 - g), gallop: g };
    const P = { duty: 0, lift: 0, bob: 0, off: {} };
    for (const k of LEGKEYS) P.off[k] = 0;
    for (const gname in mix) {
      const G = GAITS[gname], m = mix[gname];
      P.duty += G.duty * m; P.lift += G.lift * m; P.bob += G.bob * m;
      for (const k of LEGKEYS) P.off[k] += G.off[k] * m;
    }
    const freq = mix.walk * (0.85 + 1.7 * v) + mix.trot * (1.35 + 1.15 * v) + mix.gallop * (2.0 + 0.55 * v);
    return Object.assign(P, { freq, mix });
  }
  // advance; cat has pos, yaw, vel (world), yawRate
  update(dt, cat, v) {
    const vv = Math.max(v, Math.abs(cat.yawRate) * 0.11);
    const P = this.params(vv);
    this.P = P;
    // no animal is a metronome: the cadence drifts a little as it goes
    this.phase = (this.phase + P.freq * (1 + 0.06 * fnoise(cat.time * 0.35, 90)) * dt) % 1;
    const stanceT = P.duty / P.freq;
    for (const k of LEGKEYS) {
      const l = this.legs[k];
      // ...and each leg runs a hair early or late against the others
      const p = ((this.phase + P.off[k] + GAIT_JITTER[k]) % 1 + 1) % 1;
      if (!l.F) l.F = homeContact(k, cat);
      if (p < P.duty || vv < 0.01) {
        if (l.swinging) {
          l.swinging = false;
          // the paw has just touched down; a step that barely travelled is the
          // leg re-planting, not a footfall, and should stay silent
          if (v3.dist(l.from, l.to) > 0.025) {
            const P0 = PERCHES[cat.level];
            SOUNDS.step(P0 ? (P0.soft ? 'Sofa' : 'Floor') : (l.to[1] > 0.006 ? 'Rug' : 'Floor'), clamp(vv / 1.5, 0.12, 1), l.to);
          }
          l.F = l.to;
        }
        l.flex = Math.max(0, l.flex - dt * 8);
        // re-plant if the leg got stretched too far (teleports, sharp turns)
        const h = homeContact(k, cat);
        if (v3.dist(h, l.F) > 0.17) l.F = h;
      } else {
        const s = (p - P.duty) / (1 - P.duty);
        if (!l.swinging) {
          l.swinging = true; l.from = l.F.slice();
          // predict where the home point will be half a stance after touchdown
          const tAhead = (1 - s) * (1 - P.duty) / P.freq + stanceT * 0.5;
          const fut = { pos: v3.add(cat.pos, v3.mul(cat.vel, tAhead)), yaw: cat.yaw + cat.yawRate * tAhead, level: cat.level };
          l.to = homeContact(k, fut);
        }
        const e = smooth(s);
        const F = v3.lerp(l.from, l.to, e);
        F[1] += P.lift * Math.sin(Math.PI * s) * clamp(v3.dist(l.from, l.to) / 0.08, 0.35, 1.0);
        l.F = F;
        l.flex = Math.sin(Math.PI * Math.min(1, s * 1.15)) * clamp(vv * 1.2, 0.4, 1) * GAIT_CURL[k];
      }
    }
  }
}

function plantFeet(P, cat, offsets) {
  if (!P.plant || P.plant <= 0.001) return;
  const qy = Q.axis([0, 1, 0], cat.yaw);
  for (const k of LEGKEYS) {
    const T = homeContact(k, cat, offsets ? offsets[k] : null);
    solveLeg(k, T, qy, 0, P.plant);
  }
}

// ---- tail: simulated rather than keyframed ---------------------------------
// The tail carries most of a cat's body language, and it is the first thing
// that reads as fake when a sine wave drives it. Here the pose only says what
// the muscles intend; each segment is a spring chasing that intent while
// gravity, its own inertia and the hips moving underneath drag it around. The
// delay down the chain comes out on its own, and so does the whip when the cat
// turns. Runs on world transforms, after the pose is on the skeleton.
const TAILSIM = { dir: null, vel: null, base: null };
function layerTailSim(cat, dt) {
  const n = META.tailN;
  const ids = [], want = [];
  for (let i = 0; i < n; i++) {
    const bi = BI('tail' + i);
    ids.push(bi);
    want.push(v3.norm(Q.rot(SK.wq[bi], v3.sub(META.bones[bi].end, SK.rest[bi]))));
  }
  const base = SK.wp[ids[0]];
  if (!TAILSIM.dir) {
    TAILSIM.dir = want.map((d) => d.slice());
    TAILSIM.vel = want.map(() => [0, 0, 0]);
    TAILSIM.base = base.slice();
  }
  // how fast the root of the tail is travelling — this is what whips the tip
  const bv = v3.mul(v3.sub(base, TAILSIM.base), 1 / Math.max(dt, 1e-4));
  TAILSIM.base = base.slice();
  const limp = cat.sleeping ? 0.45 : 1;              // a sleeping cat's tail goes slack
  const heavy = cat.sleeping ? 1.7 : 1;
  const steps = Math.min(5, Math.max(1, Math.ceil(dt / 0.008)));
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const stiff = lerp(420, 120, k) * limp;        // muscular at the root, loose at the tip
      const damp = lerp(34, 12, k);                  // the tip keeps ringing after the base has stopped
      // the muscles' target, pulled down by the tail's own weight
      const tgt = v3.norm(v3.madd(want[i], [0, -1, 0], lerp(0.02, 0.22, k) * heavy / limp));
      let d = TAILSIM.dir[i], v = TAILSIM.vel[i];
      let acc = v3.mul(v3.sub(tgt, d), stiff);
      acc = v3.madd(acc, bv, -lerp(6, 34, k));       // inertia: the tail lags the hips
      acc = v3.madd(acc, v, -damp);
      v = v3.madd(v, acc, h);
      d = v3.norm(v3.madd(d, v, h));
      v = v3.madd(v, d, -v3.dot(v, d));              // velocity stays tangent to the sphere
      // a tail bends; it does not kink back along the segment before it
      if (i > 0) {
        const p = TAILSIM.dir[i - 1], c = v3.dot(d, p);
        if (c < 0.35) {
          const t2 = v3.sub(d, v3.mul(p, c)), tl = v3.len(t2);
          d = tl > 1e-6 ? v3.norm(v3.madd(v3.mul(p, 0.35), v3.mul(t2, 1 / tl), 0.937)) : p.slice();
        }
      }
      TAILSIM.dir[i] = d; TAILSIM.vel[i] = v;
    }
  }
  for (let i = 0; i < n; i++) {
    const bi = ids[i];
    const cur = v3.norm(Q.rot(SK.wq[bi], v3.sub(META.bones[bi].end, SK.rest[bi])));
    SK.setWorldRot(bi, Q.norm(Q.mul(Q.fromTo(cur, TAILSIM.dir[i]), SK.wq[bi])));
    SK.update();
  }
}

// ---------------------------------------------------------------- the cat: motion, layers, behaviour scripts
const CANCEL = { cancelled: true };
Object.assign(POSE_SPECS, {
  run: {
    plant: 1, root: { dy: -0.018 },
    b: { neck: [0, 0, -24], head: [0, 0, 14], tail0: [0, 0, -14], tail1: [0, 0, -2], tail2: [0, 0, 2], tail3: [0, 0, 2], tail4: [0, 0, 0], tail5: [0, 0, -2], tail6: [0, 0, -4], tail7: [0, 0, -6] },
  },
  leap: {
    root: { pitch: 24 },
    b: {
      spine1: [0, 0, 6], spine2: [0, 0, 4], neck: [0, 0, -18], head: [0, 0, -14],
      armL: [0, 0, 52], armR: [0, 0, 48], foreL: [0, 0, -38], foreR: [0, 0, -34], handL: [0, 0, -40], handR: [0, 0, -40],
      thighL: [0, 0, -62], thighR: [0, 0, -58], shinL: [0, 0, 26], shinR: [0, 0, 22], footL: [0, 0, -34], footR: [0, 0, -30], toeL: [0, 0, -20], toeR: [0, 0, -20],
      tail0: [0, 0, -10], tail1: [0, 0, 4], tail2: [0, 0, 4], tail3: [0, 0, 2], tail4: [0, 0, 0],
    },
  },
  reach: {
    root: { pitch: -16 },
    b: {
      neck: [0, 0, -14], head: [0, 0, 12],
      armL: [0, 0, 36], armR: [0, 0, 32], foreL: [0, 0, -6], foreR: [0, 0, -4], handL: [0, 0, -10], handR: [0, 0, -10],
      thighL: [0, 0, 22], thighR: [0, 0, 26], shinL: [0, 0, -36], shinR: [0, 0, -40], footL: [0, 0, 30], footR: [0, 0, 32],
      tail0: [0, 0, -30], tail1: [0, 0, -10], tail2: [0, 0, 0], tail3: [0, 0, 6], tail4: [0, 0, 6],
    },
  },
  sitTall: {
    root: { dy: -0.150 },
    b: {
      pelvis: [0, 0, 54], spine1: [0, 0, -2], spine2: [0, 0, 0], neck: [0, 0, -20], head: [0, 0, -24],
      scapL: [0, 0, -6], scapR: [0, 0, -6], armL: [0, 0, -42], armR: [0, 0, -42],
      handL: [0, 0, -2], handR: [0, 0, -2], fingL: [0, 0, 2], fingR: [0, 0, 2],
      thighL: [-4, 0, 22], thighR: [4, 0, 22], shinL: [0, 0, -80], shinR: [0, 0, -80], footL: [0, 0, 78], footR: [0, 0, 78], toeL: [0, 0, -46], toeR: [0, 0, -46],
      tail0: [0, 0, -46], tail1: [0, 26, 4], tail2: [0, 30, 4], tail3: [0, 30, 2], tail4: [0, 26, 0], tail5: [0, 24, 0], tail6: [0, 20, 0], tail7: [0, 18, 0],
    },
  },
});
POSE_SPECS.groom = JSON.parse(JSON.stringify(POSE_SPECS.sitTall));
Object.assign(POSE_SPECS.groom.b, {
  neck: [0, 12, -36], head: [-6, 18, -50],
  scapL: [0, 0, 8], armL: [10, 0, 22], foreL: [0, 0, 101], handL: [0, 0, -40], fingL: [0, 0, -20],
});
for (const k of ['run', 'leap', 'reach', 'sitTall', 'groom']) POSES[k] = poseFromSpec(POSE_SPECS[k]);

const SOUNDS = { play() {}, purr() {}, step() {}, whirr() {}, ready: false };   // filled in by the audio module

function poseFromSkeleton(rootLike) {
  const p = poseNew();
  for (let i = 0; i < NB; i++) p.q[i] = SK.q[i].slice();
  for (const k of ['dx', 'dy', 'dz', 'pitch', 'roll', 'yaw', 'plant', 'jaw']) p[k] = rootLike[k];
  return p;
}
const fwdOf = (yaw) => [Math.cos(yaw), 0, -Math.sin(yaw)];
const yawTo = (from, to) => Math.atan2(-(to[2] - from[2]), to[0] - from[0]);

class CatSim {
  constructor() {
    this.pos = [0.18, 0, 0.30];
    this.yaw = -0.45;
    this.vel = [0, 0, 0];
    this.yawRate = 0;
    this.speed = 0;
    this.level = 'floor';
    this.groundY = supportY(this.pos[0], this.pos[2], this);
    this.gait = new Gait();
    this.mode = 'pose';
    this.poseName = 'stand';
    this.from = poseCopy(POSES.stand); this.to = POSES.stand; this.bt = 1; this.bdur = 0.01;
    this.base = poseCopy(POSES.stand);
    this.last = poseCopy(POSES.stand);
    this.feetOff = null;
    this.time = 0;
    this.waiters = [];
    this.token = 0;
    this.busy = null;              // name of the running script
    // layers
    this.look = { target: null, yaw: 0, pitch: 0, w: 0, eyeYaw: 0, eyePitch: 0, sacc: 0 };
    this.lidBase = 0.15; this.lid = 0.15; this.blinkT = 2.5; this.blinkPh = -1; this.squint = 0; this.sleepy = 0;
    this.dilate = 0.5; this.dilateT = 0.5;
    this.ears = { yaw: [0, 0], flat: [0, 0], tYaw: [0, 0], tFlat: [0, 0], timer: 1.5, vyaw: [0, 0] };
    this.tail = { mode: 'up', ph: 0, lash: 0, quiver: 0, curl: 0 };
    this.jaw = 0; this.jawAnim = null; this.tongue = 0;
    this.purr = 0; this.purrT = 0;
    this.breathPh = 0; this.breathRate = 0.45; this.breath = 0;
    this.settle = { y: 0, vy: 0, p: 0, vp: 0, r: 0, vr: 0 };
    this.whisker = 0; this.whiskerT = 0;
    this.pet = { active: false, region: null, point: [0, 0, 0], dir: [1, 0, 0], strength: 0, time: 0, total: 0, last: -10 };
    this.extra = null;             // per-frame additive pose callback from scripts
    this.headTilt = 0; this.headTiltT = 0;
    this.excite = 0;
    this.idleT = 0; this.lastInteraction = 0;
    this.sleeping = false;
    this.jump = null;
    this.status = '在看着你';
    this.onStatus = null;
    this.moveCb = null;
  }
  setStatus(s) { if (s !== this.status) { this.status = s; if (this.onStatus) this.onStatus(s); } }
  contactPos() { const p = SK.wp[BI('spine1')]; return [p[0], Math.max(0, p[1] - 0.205) + (this.groundY > 0.05 ? this.groundY : 0), p[2]]; }

  // ---------- script helpers
  run(name, fn) {
    const tok = ++this.token;
    this.busy = name;
    this.extra = null;
    fn(tok).then(() => { if (tok === this.token) { this.busy = null; this.extra = null; } }).catch((e) => { if (e !== CANCEL) console.error(e); });
    return tok;
  }
  check(tok) { if (tok !== this.token) throw CANCEL; }
  wait(sec, tok) {
    return new Promise((res, rej) => this.waiters.push({ t: this.time + sec, res, rej, tok }));
  }
  async toPose(name, dur, tok, feetOff) {
    this.from = poseCopy(this.last);
    this.to = POSES[name];
    this.poseName = name;
    this.bt = 0; this.bdur = Math.max(dur, 0.001);
    this.feetOff = feetOff || POSE_FEET[name] || null;
    if (this.mode !== 'pose') { this.mode = 'pose'; this.speed = 0; this.vel = [0, 0, 0]; this.yawRate = 0; }
    await this.wait(dur, tok);
    this.check(tok);
  }
  moveTo(target, speed, tok, stopDist = 0.02, opts = {}) {
    return new Promise((res, rej) => {
      if (this.mode !== 'gait') { this.gait.reset(this); this.mode = 'gait'; }
      this.moveTarget = target.slice();
      this.moveSpeed = speed;
      this.stopDist = stopDist;
      this.moveFace = opts.face || null;
      this.moveTargetFn = opts.track || null;
      this.moveStart = this.time;
      this.moveLimit = 3.0 + 2.5 * Math.hypot(target[0] - this.pos[0], target[2] - this.pos[2]) / Math.max(speed, 0.3);
      this.moveCb = { res, rej, tok };
    }).then((r) => { this.check(tok); return r; });
  }
  async turnToward(point, tok) {
    const dy = wrapAngle(yawTo(this.pos, point) - this.yaw);
    if (Math.abs(dy) < 0.35) return;
    if (this.mode !== 'gait') await this.standUp(tok);
    await this.moveTo(this.pos, 0.0, tok, 0.5, { face: point });
  }
  async standUp(tok) {
    if (this.mode === 'pose' && !['stand', 'standLow', 'run', 'crouch', 'pickup'].includes(this.poseName)) {
      const lying = ['loaf', 'side', 'bellyUp', 'curl'].includes(this.poseName);
      if (['side', 'bellyUp', 'curl'].includes(this.poseName)) { await this.toPose('loaf', 0.55, tok); }
      await this.toPose('stand', lying ? 0.55 : 0.45, tok);
    }
  }
  say(kind, opts) {
    const info = SOUNDS.play(kind, opts);
    // mouth animation for vocalisations
    const shapes = {
      meow: [[0, 0], [0.08, 0.35], [0.25, 1.0], [0.55, 0.85], [0.75, 0.2], [0.85, 0]],
      meowShort: [[0, 0], [0.06, 0.6], [0.2, 0.8], [0.32, 0.1], [0.4, 0]],
      meowLong: [[0, 0], [0.1, 0.4], [0.35, 1.0], [0.8, 0.9], [1.05, 0.3], [1.2, 0]],
      trill: [[0, 0], [0.05, 0.12], [0.3, 0.15], [0.42, 0]],
      chirp: [[0, 0], [0.04, 0.5], [0.12, 0.3], [0.18, 0]],
      growl: [[0, 0], [0.1, 0.12], [0.9, 0.12], [1.0, 0]],
      yawn: [[0, 0], [0.4, 0.6], [0.9, 1.0], [1.6, 1.0], [2.1, 0.2], [2.4, 0]],
      mew: [[0, 0], [0.05, 0.4], [0.15, 0.5], [0.25, 0]],
    };
    const amp = { meow: 13, meowShort: 11, meowLong: 15, trill: 3, chirp: 9, growl: 3, yawn: 34, mew: 9 }[kind] || 0;
    if (kind === 'yawn') { const sq0 = this.squint; this.yawnSquint = true; setTimeout(() => { this.yawnSquint = false; }, 2300); }
    if (shapes[kind]) this.jawAnim = { t: 0, keys: shapes[kind], amp: amp * (info && info.scale ? info.scale : 1), dur: shapes[kind][shapes[kind].length - 1][0] * (info && info.stretch ? info.stretch : 1) };
  }

  // ---------- per-frame update
  update(dt) {
    this.time += dt;
    // resolve waiters
    if (this.waiters.length) {
      const keep = [];
      for (const w of this.waiters) {
        if (w.tok !== undefined && w.tok !== this.token) { w.rej(CANCEL); continue; }
        if (this.time >= w.t) w.res(); else keep.push(w);
      }
      this.waiters = keep;
    }
    if (this.moveCb && this.moveCb.tok !== this.token) { const cb = this.moveCb; this.moveCb = null; cb.rej(CANCEL); }

    if (this.lookFn) this.look.target = this.lookFn().slice();
    else if (!this.sleeping) {
      // small, fast and nearby overrides whatever it was looking at
      const fast = (SCENE.ball.visible && ballSpeed() > 0.30) ? SCENE.ball.p
        : (MOUSE.out && MOUSE.speed > 0.10) ? MOUSE.p : null;
      if (fast) {
        this.look.target = fast.slice();
        this.lookTimer = this.time + 0.35;
        this.ears.tYaw = [6, 6];
        this.whiskerT = Math.max(this.whiskerT, 0.5);
      }
    }
    // ---- base motion
    let P;
    if (this.mode === 'gait') P = this.updateGait(dt);
    else if (this.mode === 'jump') P = this.updateJump(dt);
    else {
      this.bt += dt;
      P = poseBlendStaged(this.from, this.to, this.bt / this.bdur);
    }
    this.groundY = this.mode === 'jump' ? this.groundY : expDecay(this.groundY, supportY(this.pos[0], this.pos[2], this), 12, dt);
    this.layerSettle(P, dt);
    this.base = P;
    const L = poseCopy(P);

    // ---- additive layers
    this.layerBreath(L, dt);
    this.layerLife(L, dt);
    this.layerTail(L, dt);
    this.layerEars(L, dt);
    if (this.extra) this.extra(L, dt);
    this.layerPet(L, dt);
    this.layerJaw(L, dt);

    // ---- skeleton
    applyPose(L, this);
    SK.update();
    this.layerLook(L, dt);       // works on world transforms
    layerTailSim(this, dt);      // ditto: the tail follows wherever the body ended up
    if (this.mode === 'gait') {
      const qy = Q.axis([0, 1, 0], this.yaw);
      for (const k of LEGKEYS) { const l = this.gait.legs[k]; solveLeg(k, l.F, qy, l.flex, 1); }
    } else if (this.mode === 'jump') {
      // no foot IK in the air
    } else if (L.plant > 0.01) {
      plantFeet(L, this, this.feetOff);
    }
    this.layerLids(dt);
    this.last = poseFromSkeleton(L);
    this.layerEyes(dt);
    this.idleBrain(dt);
  }

  // ---------- locomotion
  updateGait(dt) {
    if (this.moveTargetFn) this.moveTarget = this.moveTargetFn();
    if (!this.lookFn && !this.moveFace) { const f0 = fwdOf(this.yaw + this.yawRate * 0.25); this.look.target = [this.pos[0] + f0[0], this.groundY + 0.12, this.pos[2] + f0[2]]; }
    const T = this.moveTarget;
    const dx = T[0] - this.pos[0], dz = T[2] - this.pos[2];
    const dist = Math.hypot(dx, dz);
    let wantYaw = dist > this.stopDist + 0.06 || this.moveTargetFn ? Math.atan2(-dz, dx) : this.yaw;
    if (this.moveFace && dist <= this.stopDist + 0.06) wantYaw = yawTo(this.pos, this.moveFace);
    const dyaw = wrapAngle(wantYaw - this.yaw);
    const maxTurn = lerp(3.2, 6.0, clamp(this.speed / 2, 0, 1));
    const targetRate = clamp(dyaw * 5.5, -maxTurn, maxTurn);
    this.yawRate = expDecay(this.yawRate, targetRate, 14, dt);
    this.yaw = wrapAngle(this.yaw + this.yawRate * dt);
    const remain = Math.max(dist - this.stopDist, 0);
    let vt = this.moveSpeed * clamp(1.15 - Math.abs(dyaw) / 1.3, 0, 1);
    vt = Math.min(vt, Math.sqrt(2 * 2.2 * remain));
    const acc = vt > this.speed ? 3.2 : 4.5;
    this.speed = this.speed + clamp(vt - this.speed, -acc * dt, acc * dt);
    const f = fwdOf(this.yaw);
    this.vel = v3.mul(f, this.speed);
    let np = v3.add(this.pos, v3.mul(this.vel, dt));
    // stay inside the room / off the sofa body when on the floor
    np = constrainFloor(np, this.level);
    this.pos = np;
    this.gait.update(dt, this, this.speed);
    const G = this.gait.P;
    // base pose: stand -> run by speed
    const runW = clamp((this.speed - 0.5) / 1.2, 0, 1);
    const P = poseBlend(POSES.stand, POSES.run, runW);
    const ph = this.gait.phase * Math.PI * 2;
    const bobY = -G.bob * (0.5 + 0.5 * Math.cos(2 * ph)) * (1 - G.mix.gallop) - G.bob * 0.6 * Math.sin(ph) * G.mix.gallop;
    P.dy += bobY;
    // the head rides level while the body bobs underneath it
    poseAddBone(P, 'neck', 0, 0, -bobY * 400);
    poseAddBone(P, 'head', 0, 0, -bobY * 250);
    // the trunk sways laterally as the weight crosses from one side to the other
    const vmix = clamp(this.speed / 0.8, 0.25, 1);
    const lat = Math.sin(ph) * (2.6 * (1 - G.mix.gallop) + 1.0 * G.mix.gallop) * vmix;
    poseAddBone(P, 'pelvis', lat * 0.5, 0, 0);
    poseAddBone(P, 'spine1', lat * 0.9, 0, 0);
    poseAddBone(P, 'spine2', lat * 0.6, 0, 0);
    P.roll += lat * 0.55;
    if (G.mix.gallop > 0) {
      const flex = Math.sin(ph + 0.6) * 11 * G.mix.gallop;
      poseAddBone(P, 'spine1', 0, 0, flex); poseAddBone(P, 'spine2', 0, 0, flex * 0.7);
      P.pitch += Math.sin(ph) * 5 * G.mix.gallop;
    }
    // lean into turns, spine bend
    P.roll += clamp(-this.yawRate * this.speed * 4, -12, 12);
    poseAddBone(P, 'spine1', 0, this.yawRate * 3.0, 0); poseAddBone(P, 'spine2', 0, this.yawRate * 3.5, 0);
    P.plant = 0;
    const facingOk = !this.moveFace || Math.abs(dyaw) < 0.16;
    const timedOut = this.time - this.moveStart > this.moveLimit;
    const settled = timedOut || (remain < 0.035 && facingOk && this.speed < 0.08 && Math.abs(this.yawRate) < 0.45);
    if (settled && this.moveCb) { const cb = this.moveCb; this.moveCb = null; this.mode = 'pose'; this.from = poseFromSkeleton(P); this.to = POSES.stand; this.poseName = 'stand'; this.bt = 0; this.bdur = 0.3; this.feetOff = null; this.speed = 0; this.vel = [0, 0, 0]; this.yawRate = 0; cb.res(true); }
    return P;
  }

  // ---------- jumping
  startJump(p1, y1, level) {
    const p0 = this.pos.slice();
    const y0 = this.groundY;
    const d = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
    const up = Math.max(y1 - y0, 0);
    this.jump = { p0, p1, y0, y1, level, t: 0, T: 0.30 + d * 0.18 + up * 0.28, h: 0.10 + 0.36 * up + d * 0.03 };
    this.mode = 'jump';
    this.yaw = yawTo(p0, p1);
  }
  updateJump(dt) {
    const J = this.jump;
    J.t += dt;
    const s = clamp(J.t / J.T, 0, 1);
    this.pos = [lerp(J.p0[0], J.p1[0], s), 0, lerp(J.p0[2], J.p1[2], s)];
    this.groundY = J.y0 + (J.y1 - J.y0) * s + 4 * J.h * s * (1 - s);
    const P = s < 0.45 ? poseBlend(POSES.leap, POSES.reach, smooth(s / 0.45) * 0.4) : poseBlend(POSES.leap, POSES.reach, 0.4 + 0.6 * smooth((s - 0.45) / 0.55));
    P.pitch += lerp(14, -16, s);
    if (s >= 1) {
      this.level = J.level;
      this.groundY = J.y1;
      this.mode = 'pose';
      this.from = poseCopy(P); this.to = POSES.crouch; this.poseName = 'crouch'; this.bt = 0; this.bdur = 0.16; this.feetOff = POSE_FEET.crouch;
      SOUNDS.play('land');
      if (J.done) J.done();
    }
    return P;
  }

  // ---------- layers
  // The body has mass: it arrives at a new height slightly late and rocks past
  // it before coming to rest, instead of landing exactly on the pose.
  layerSettle(P, dt) {
    const S = this.settle;
    if (this.mode !== 'pose') { S.y = P.dy; S.p = P.pitch; S.r = P.roll; S.vy = S.vp = S.vr = 0; return; }
    const n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n;
    for (let i = 0; i < n; i++) {
      [S.y, S.vy] = springStep(S.y, S.vy, P.dy, 420, 26, h);
      [S.p, S.vp] = springStep(S.p, S.vp, P.pitch, 300, 22, h);
      [S.r, S.vr] = springStep(S.r, S.vr, P.roll, 300, 22, h);
    }
    P.dy = S.y; P.pitch = S.p; P.roll = S.r;
  }
  layerBreath(P, dt) {
    const running = this.mode === 'gait' && this.speed > 0.9;
    const rate = this.sleeping ? 0.30 : running ? 1.5 : this.breathRate;
    this.breathPh += dt * rate * Math.PI * 2;
    // a breath is not a sine: the inhale is quicker than the fall back out
    const ph = this.breathPh;
    const a = (Math.sin(ph) * 0.62 + Math.sin(2 * ph + 0.9) * 0.18) * (this.sleeping ? 1.45 : running ? 1.3 : 0.9);
    this.breath = a;
    SCENE.breath = a + (this.purr > 0.1 ? Math.sin(this.time * 2 * Math.PI * 26) * 0.06 * this.purr : 0);
    // the ribcage visibly moves: chest lifts, shoulder blades rotate out, and
    // the head rides along on top of it
    poseAddBone(P, 'spine2', 0, 0, a * 0.52);
    poseAddBone(P, 'spine1', 0, 0, a * 0.30);
    poseAddBone(P, 'scapL', a * 0.9, 0, -a * 0.45);
    poseAddBone(P, 'scapR', -a * 0.9, 0, -a * 0.45);
    poseAddBone(P, 'neck', 0, 0, -a * 0.38);
    P.dy += a * 0.0013;
  }
  // Nothing alive holds perfectly still, and nothing alive is bilaterally
  // symmetric. Slow postural sway, weight shifting from one side to the other,
  // and a permanent small difference between left and right.
  layerLife(P, dt) {
    const t = this.time;
    const asleep = this.sleeping;
    const amp = asleep ? 0.25 : this.mode === 'gait' ? 0.4 : 1;
    P.dx += fnoise(t * 0.23, 1) * 0.0045 * amp;
    P.dz += fnoise(t * 0.19, 2) * 0.0045 * amp;
    P.dy += fnoise(t * 0.31, 3) * 0.0016 * amp;
    P.roll += fnoise(t * 0.21, 4) * 1.15 * amp;
    P.pitch += fnoise(t * 0.26, 5) * 0.75 * amp;
    P.yaw += fnoise(t * 0.17, 6) * 0.9 * amp;
    // standing: weight drifts from one pair of legs to the other
    if (!asleep && this.mode === 'pose' && P.plant > 0.5) {
      const w = fnoise(t * 0.085, 11);
      P.roll += w * 1.9;
      P.dx += w * 0.004;
      poseAddBone(P, 'spine1', w * 1.6, 0, 0);
      poseAddBone(P, 'spine2', w * 1.1, 0, 0);
    }
    const k = asleep ? 0.4 : 1;
    for (const n of ASYM_BONES) {
      const i = BI(n), A = ASYM[i];
      poseAddBone(P, n, (A[0] * 0.9 + fnoise(t * 0.14, i) * 0.8) * k,
        (A[1] * 0.7 + fnoise(t * 0.11, i + 40) * 0.6) * k,
        (A[2] * 1.1 + fnoise(t * 0.13, i + 80) * 1.0) * k);
    }
    poseAddBone(P, 'head', fnoise(t * 0.33, 21) * 1.3 * amp, fnoise(t * 0.27, 22) * 1.5 * amp, fnoise(t * 0.30, 23) * 1.1 * amp);
    poseAddBone(P, 'neck', 0, fnoise(t * 0.24, 24) * 1.0 * amp, fnoise(t * 0.22, 25) * 0.8 * amp);
  }
  // What the tail muscles are *asking* for. The travelling delay down the
  // chain and the follow-through come from layerTailSim, so the amplitudes
  // here are deliberately small — the physics amplifies them.
  layerTail(P, dt) {
    const T = this.tail;
    T.ph += dt * (T.lash > 0.1 ? 3.2 : 0.62) * (0.85 + 0.3 * fnoise(this.time * 0.11, 61));
    T.lash = expDecay(T.lash, 0, 0.6, dt);
    T.quiver = expDecay(T.quiver, 0, 1.5, dt);
    const lying = ['loaf', 'side', 'bellyUp', 'curl', 'sit', 'sitTall'].includes(this.poseName) && this.mode === 'pose';
    for (let i = 0; i < 8; i++) {
      const k = i / 7;
      let sway = Math.sin(T.ph - i * 0.22) * (lying ? 2.2 + 5.0 * k : 1.6 + 3.4 * k);
      sway += fnoise(this.time * 0.37, 70 + i) * (1.2 + 3.0 * k);
      sway += Math.sin(this.time * 7.0 - i * 0.5) * T.lash * (6 + 13 * k);
      const qv = Math.sin(this.time * 38 + i) * T.quiver * 2.5 * k;
      if (this.sleeping) sway *= 0.25;
      poseAddBone(P, 'tail' + i, 0, sway, qv);
    }
  }
  layerEars(P, dt) {
    const E = this.ears;
    E.timer -= dt;
    if (E.timer < 0) {
      E.timer = this.sleeping ? rand(2, 7) : rand(0.6, 3.5);
      const s = Math.random() < 0.5 ? 0 : 1;
      if (Math.random() < 0.55) { E.vyaw[s] += (Math.random() < 0.5 ? -1 : 1) * rand(30, 70); }      // twitch
      else { E.tYaw = [rand(-25, 25), rand(-25, 25)]; }
    }
    for (let s = 0; s < 2; s++) {
      E.vyaw[s] += (-(E.yaw[s] - E.tYaw[s]) * 140 - E.vyaw[s] * 16) * dt;
      E.yaw[s] += E.vyaw[s] * dt;
      E.flat[s] = expDecay(E.flat[s], E.tFlat[s], 8, dt);
      const side = s === 0 ? -1 : 1;
      // swivel about the head's vertical axis, flatten = roll outward + pitch back
      poseAddBone(P, s === 0 ? 'earL' : 'earR', -side * E.flat[s] * 50, -side * E.yaw[s] * 0.6, -E.flat[s] * 22);
    }
  }
  layerJaw(P, dt) {
    let a = 0;
    if (this.jawAnim) {
      const J = this.jawAnim; J.t += dt;
      const k = J.keys, tt = J.t / (J.dur / k[k.length - 1][0] || 1);
      for (let i = 0; i < k.length - 1; i++) if (tt >= k[i][0] && tt <= k[i + 1][0]) { a = lerp(k[i][1], k[i + 1][1], smooth((tt - k[i][0]) / (k[i + 1][0] - k[i][0]))); break; }
      a *= J.amp;
      if (J.t > J.dur) this.jawAnim = null;
    }
    this.tongue = expDecay(this.tongue, this.tongueT || 0, 10, dt);
    this.jaw = expDecay(this.jaw, a + this.tongue * 2.6, 30, dt);
    poseAddBone(P, 'jaw', 0, 0, 4.6 - this.jaw);
    SCENE.mouthOpen = clamp((this.jaw - this.tongue * 2.6) / 12, 0, 1);
    SCENE.tongueOut = this.tongue;
  }
  layerLook(P, dt) {
    const Lk = this.look;
    let wy = 0, wp = 0, w = 0;
    if (Lk.target && !this.sleeping) {
      const ih = BI('head'), in2 = BI('spine2');
      const headPos = SK.wp[ih];
      const to = v3.norm(v3.sub(Lk.target, headPos));
      const cur = Q.rot(SK.wq[ih], [1, 0, 0]);
      // compare desired and current face directions in the chest frame
      const qc = Q.conj(SK.wq[in2]);
      const dl = Q.rot(qc, to), fl = Q.rot(qc, cur);
      wy = wrapAngle(Math.atan2(-dl[2], dl[0]) - Math.atan2(-fl[2], fl[0]));
      wp = Math.asin(clamp(dl[1], -1, 1)) - Math.asin(clamp(fl[1], -1, 1));
      wy = clamp(wy, -1.25, 1.25); wp = clamp(wp, -0.7, 0.7);
      w = 1;
    }
    Lk.w = expDecay(Lk.w, w, 4, dt);
    Lk.yaw = expDecay(Lk.yaw, wy, 6, dt);
    Lk.pitch = expDecay(Lk.pitch, wp, 6, dt);
    const ty = Lk.yaw * Lk.w, tp = Lk.pitch * Lk.w;
    const tilt = this.headTilt;
    this.headTilt = expDecay(this.headTilt, this.headTiltT, 3, dt);
    const ineck = BI('neck'), ihead = BI('head');
    SK.q[ineck] = Q.mul(SK.q[ineck], Q.euler(0, ty * 0.4 / D2R, tp * 0.35 / D2R));
    SK.q[ihead] = Q.mul(SK.q[ihead], Q.euler(tilt, ty * 0.6 / D2R, tp * 0.65 / D2R));
    SK.update();
    // eyes follow with a quick saccade
    Lk.sacc -= dt;
    let ey = 0, ep = 0;
    if (Lk.target && !this.sleeping) {
      const loc = Q.rot(Q.conj(SK.wq[ihead]), v3.sub(Lk.target, SK.wp[ihead]));
      ey = clamp(Math.atan2(-loc[2], loc[0]), -0.32, 0.32);
      ep = clamp(Math.atan2(loc[1], Math.hypot(loc[0], loc[2])) + 0.05, -0.25, 0.25);
    }
    if (Lk.sacc < 0) { Lk.sacc = rand(0.12, 0.6); Lk.eyeYawT = ey; Lk.eyePitchT = ep; }
    Lk.eyeYaw = expDecay(Lk.eyeYaw, Lk.eyeYawT || 0, 25, dt);
    Lk.eyePitch = expDecay(Lk.eyePitch, Lk.eyePitchT || 0, 25, dt);
  }
  layerLids(dt) {
    // blinking
    this.blinkT -= dt;
    if (this.blinkT < 0 && this.blinkPh < 0) { this.blinkPh = 0; this.blinkT = this.sleeping ? 99 : rand(2.0, 6.0) * (this.squint > 0.3 ? 0.6 : 1); }
    if (this.blinkPh >= 0) {
      this.blinkPh += dt / (this.squint > 0.3 ? 0.55 : 0.16);     // slow blink when content
      if (this.blinkPh >= 1.12) this.blinkPh = -1;                // runs past 1 so the lagging eye finishes
    }
    const target = this.sleeping ? 1 : clamp(this.lidBase + this.squint * 0.62 + this.sleepy * 0.4 + (this.yawnSquint ? clamp(this.jaw / 20, 0, 0.8) : 0), 0, 1);
    this.lid = expDecay(this.lid, target, this.sleeping ? 3 : 9, dt);
    for (const sd of ['L', 'R']) {
      const e = sd === 'L' ? 0 : 1;
      // the two eyes do not close in perfect unison, and one lid sits a little
      // lower than the other
      const b = this.blinkPh >= 0 ? Math.sin(Math.PI * clamp(this.blinkPh - e * 0.09, 0, 1)) * (e ? 0.96 : 1) : 0;
      const c = clamp(this.lid * (e ? 1.05 : 0.97) + b * (1 - this.lid), 0, 1);
      const f = EYES[e].f;
      const iu = BI('lidU' + sd), id = BI('lidD' + sd);
      SK.q[iu] = Q.axis(f.lt, -48 * D2R * c - this.look.eyePitch * 0.35);
      SK.q[id] = Q.axis(f.lt, 30 * D2R * c * c);
    }
    SK.update();
  }
  layerEyes(dt) {
    this.dilate = expDecay(this.dilate, this.dilateT, 3, dt);
    SCENE.dilate = this.dilate;
    SCENE.gaze = [[this.look.eyeYaw, this.look.eyePitch], [this.look.eyeYaw, this.look.eyePitch]];
    this.whisker = expDecay(this.whisker, this.whiskerT, 5, dt);
    SCENE.whiskerFan = this.whisker;
  }
  layerPet(P, dt) {
    const pt = this.pet;
    pt.strength = expDecay(pt.strength, pt.active ? 1 : 0, pt.active ? 10 : 4, dt);
    SCENE.pet.s = pt.strength;
    SCENE.pet.p = pt.point; SCENE.pet.dir = pt.dir;
    const w = this.petReact || 0;
    if (w <= 0.001) return;
    const r = this.petRegion;
    if (r === 'chin') { poseAddBone(P, 'neck', 0, 0, 10 * w); poseAddBone(P, 'head', 0, 0, 20 * w); }
    else if (r === 'cheek' || r === 'head') { poseAddBone(P, 'head', 9 * w * this.petSide, 0, -4 * w); poseAddBone(P, 'neck', 0, 0, 4 * w); }
    else if (r === 'back' || r === 'rump') {
      const a = r === 'rump' ? 1 : 0.5;
      poseAddBone(P, 'pelvis', 0, 0, -6 * w * a); poseAddBone(P, 'spine1', 0, 0, 5 * w);
      P.dy += 0.008 * w * a;
      for (let i = 0; i < 3; i++) poseAddBone(P, 'tail' + i, 0, 0, -12 * w * a);
    }
  }

  // ---------- autonomous idle behaviour
  idleBrain(dt) {
    if (this.busy) { this.idleT = 0; return; }
    this.idleT += dt;
    const since = this.time - this.lastInteraction;
    // gaze: look at the viewer often, sometimes around the room
    if (!this.lookTimer || this.time > this.lookTimer) {
      this.lookTimer = this.time + rand(1.5, 4.5);
      const r = Math.random();
      if (r < 0.55) this.look.target = R.camPos.slice();
      else if (r < 0.8 && SCENE.ball.visible) this.look.target = SCENE.ball.p.slice();
      else this.look.target = [this.pos[0] + rand(-2, 2), rand(0.1, 1.2), this.pos[2] + rand(-2, 2)];
    }
    if (this.idleT > 9 && this.poseName === 'stand' && this.mode === 'pose') {
      this.idleT = 0;
      this.run('idleSit', async (tok) => { this.setStatus('坐了下来'); await this.toPose('sit', 0.7, tok); this.tail.mode = 'wrap'; });
    } else if (this.idleT > 22 && (this.poseName === 'sit' || this.poseName === 'sitTall') && this.mode === 'pose' && since > 15) {
      this.idleT = 0;
      this.run('idleLoaf', async (tok) => { this.setStatus('趴着发呆'); await this.toPose('loaf', 1.0, tok); this.sleepy = 0.35; });
    } else if (this.idleT > 5 && Math.random() < dt * 0.03 && !this.sleeping && this.mode === 'pose' && ['sit', 'sitTall'].includes(this.poseName)) {
      this.idleT = 0;
      this.run('groom', async (tok) => {
        const back = this.poseName;
        this.setStatus('舔爪子理毛');
        this.look.target = null;
        await this.toPose('groom', 0.7, tok);
        const t0 = this.time;
        this.extra = (P) => {
          const k = this.time - t0;
          const lick = Math.max(0, Math.sin(k * 7.5));
          poseAddBone(P, 'head', 0, 0, -lick * 7); poseAddBone(P, 'neck', 0, 0, -lick * 3);
          poseAddBone(P, 'handL', 0, 0, Math.sin(k * 1.3) * 6);
          this.tongueT = lick > 0.3 ? 0.9 : 0;
          this.squint = 0.6;
        };
        await this.wait(rand(2.6, 4.2), tok);
        this.extra = null; this.tongueT = 0; this.squint = 0;
        await this.toPose(back, 0.6, tok);
        this.look.target = R.camPos.slice();
        this.setStatus('理完毛，看着你');
      });
    } else if (this.idleT > 5 && Math.random() < dt * 0.035 && !this.sleeping && this.mode === 'pose' && ['sit', 'sitTall', 'loaf'].includes(this.poseName) && !this.tongueT) {
      // the "blep": tongue tip left out for a few seconds
      this.tongueT = 1;
      setTimeout(() => { this.tongueT = 0; }, rand(2500, 5000));
    } else if (this.idleT > 7 && Math.random() < dt * 0.06 && !this.sleeping && this.mode === 'pose') {
      // occasional chirp / meow toward the viewer
      this.look.target = R.camPos.slice();
      this.say(pick(['mew', 'meowShort', 'trill']));
    }
  }
}

function constrainFloor(p, level) {
  const F = ROOM.floor;
  const P0 = PERCHES[level];
  if (P0) return [clamp(p[0], P0.b[0], P0.b[1]), p[1], clamp(p[2], P0.b[2], P0.b[3])];
  let x = clamp(p[0], F.x0 + 0.3, F.x1 - 0.3);
  let z = clamp(p[2], ROOM.backZ + 0.28, F.z1 - 0.3);
  const S = ROOM.bed;
  if (x > S.x0 - 0.18 && x < S.x1 + 0.18 && z < S.z1 + 0.22) z = S.z1 + 0.22;
  // the desk and the chair are solid: push out along whichever side is nearest
  for (const [bx0, bx1, bz0, bz1] of BLOCKS) {
    const m = 0.17;
    if (x > bx0 - m && x < bx1 + m && z > bz0 - m && z < bz1 + m) {
      const d = [x - (bx0 - m), (bx1 + m) - x, z - (bz0 - m), (bz1 + m) - z];
      const k = d.indexOf(Math.min(...d));
      if (k === 0) x = bx0 - m; else if (k === 1) x = bx1 + m;
      else if (k === 2) z = bz0 - m; else z = bz1 + m;
    }
  }
  return [x, p[1], z];
}

// ---------------------------------------------------------------- actions & reactions
const CAT = new CatSim();
const BALL = SCENE.ball;
const G = 9.81;

function mouthPoint() { return SK.pointOn(BI('jaw'), v3.add(endOf('jaw'), [0.012, -0.006, 0])); }
function viewerSpot(dist = 0.55) {
  const cam = [R.camPos[0], 0, R.camPos[2]];
  const dir = v3.norm(v3.sub([CAT.pos[0], 0, CAT.pos[2]], cam));
  let p = v3.add(cam, v3.mul(dir, dist));
  p = constrainFloor(p, 'floor');
  return p;
}
function resetMood(cat) {
  cat.sleeping = false; cat.sleepy = 0; cat.squint = 0; cat.purr = 0; SOUNDS.purr(0);
  cat.extra = null; cat.petReact = 0; cat.headTiltT = 0; cat.whiskerT = 0; cat.dilateT = 0.5;
  cat.ears.tFlat = [0, 0]; cat.tail.mode = 'up'; cat.lookFn = null; cat.tongueT = 0;
}

// ---- ball physics ----------------------------------------------------------
function throwBall(target) {
  const start = v3.add(R.camPos, [0, -0.15, 0]);
  const goal = [target[0], supportY(target[0], target[2], null) + BALL.r, target[2]];
  const d = v3.dist(start, goal);
  const T = 0.45 + d * 0.13;
  const v = [(goal[0] - start[0]) / T, (goal[1] - start[1]) / T + 0.5 * G * T, (goal[2] - start[2]) / T];
  BALL.p = start; BALL.v = v; BALL.held = false; BALL.visible = true; BALL.thrownAt = CAT.time; BALL.spin = v3.norm(v3.cross([0, 1, 0], v));
}
function updateBall(dt) {
  if (BALL.held) {
    BALL.p = mouthPoint(); BALL.v = [0, 0, 0];
    return;
  }
  const steps = 3;
  for (let s = 0; s < steps; s++) {
    const h = dt / steps;
    BALL.v[1] -= G * h;
    BALL.p = v3.add(BALL.p, v3.mul(BALL.v, h));
    let floorY = supportY(BALL.p[0], BALL.p[2], null);
    const S = ROOM.bed;
    const overSeat = BALL.p[0] > S.x0 && BALL.p[0] < S.x1 && BALL.p[2] > S.z0 && BALL.p[2] < S.z1;
    if (overSeat && BALL.p[1] > S.seatY - 0.05) floorY = S.seatY;
    // sofa front & sides as walls when below the seat
    if (!overSeat || BALL.p[1] < S.seatY - 0.05) {
      if (BALL.p[0] > S.x0 && BALL.p[0] < S.x1 && BALL.p[2] < S.z1 + BALL.r && BALL.p[2] > S.z0 && BALL.p[1] < S.seatY) {
        BALL.p[2] = S.z1 + BALL.r; BALL.v[2] = Math.abs(BALL.v[2]) * 0.4;
      }
    }
    if (BALL.p[1] < floorY + BALL.r) {
      BALL.p[1] = floorY + BALL.r;
      if (BALL.v[1] < -0.6) { SOUNDS.play('bounce', { v: -BALL.v[1] }); }
      BALL.v[1] = BALL.v[1] < -0.35 ? -BALL.v[1] * 0.42 : 0;
      const fr = floorY > 0.005 ? 1.6 : 0.65;    // rug rolls slower
      const sp = Math.hypot(BALL.v[0], BALL.v[2]);
      const ns = Math.max(sp - fr * h, 0);
      if (sp > 1e-5) { BALL.v[0] *= ns / sp; BALL.v[2] *= ns / sp; }
    }
    // walls
    const F = ROOM.floor;
    if (BALL.p[0] < F.x0 + 0.02 + BALL.r) { BALL.p[0] = F.x0 + 0.02 + BALL.r; BALL.v[0] = Math.abs(BALL.v[0]) * 0.5; }
    if (BALL.p[0] > F.x1 - 0.02 - BALL.r) { BALL.p[0] = F.x1 - 0.02 - BALL.r; BALL.v[0] = -Math.abs(BALL.v[0]) * 0.5; }
    if (BALL.p[2] < ROOM.backZ + 0.02 + BALL.r) { BALL.p[2] = ROOM.backZ + 0.02 + BALL.r; BALL.v[2] = Math.abs(BALL.v[2]) * 0.5; }
    if (BALL.p[2] > F.z1 - 0.02 - BALL.r) { BALL.p[2] = F.z1 - 0.02 - BALL.r; BALL.v[2] = -Math.abs(BALL.v[2]) * 0.5; }
  }
  // rolling rotation
  const sp = Math.hypot(BALL.v[0], BALL.v[2]);
  if (sp > 1e-4) {
    const axis = v3.norm(v3.cross([0, 1, 0], [BALL.v[0], 0, BALL.v[2]]));
    BALL.rot = Q.norm(Q.mul(Q.axis(axis, sp * dt / BALL.r), BALL.rot));
  }
}
const ballSpeed = () => Math.hypot(BALL.v[0], BALL.v[1], BALL.v[2]);

// ---- the wind-up mouse -----------------------------------------------------
function updateMouse(dt) {
  if (!MOUSE.out) return;
  MOUSE.wind = Math.max(0, MOUSE.wind - dt * 0.013);        // good for about a minute and a half
  if (MOUSE.pinned > 0) {
    // held down under a paw: it buzzes and struggles but gets nowhere
    MOUSE.pinned -= dt;
    MOUSE.speed = 0;
    MOUSE.yaw += Math.sin(CAT.time * 31) * 0.05;
    if (MOUSE.pinned <= 0) { MOUSE.yawT = MOUSE.yaw + rand(-2.6, 2.6); MOUSE.burst = 0; }
    return;
  }
  MOUSE.burst -= dt;
  if (MOUSE.burst <= 0) {
    if (MOUSE.speed > 0.05) { MOUSE.speed = 0; MOUSE.burst = rand(0.25, 1.0); }
    else {
      MOUSE.speed = rand(0.55, 1.15) * clamp(MOUSE.wind, 0, 1);
      MOUSE.burst = rand(0.45, 1.5);
      MOUSE.yawT = MOUSE.yaw + rand(-2.3, 2.3);
    }
  }
  MOUSE.yaw = wrapAngle(MOUSE.yaw + clamp(wrapAngle(MOUSE.yawT - MOUSE.yaw), -7 * dt, 7 * dt));
  const wob = Math.sin(CAT.time * 11.0) * 0.045 * clamp(MOUSE.speed, 0, 1);
  const f = fwdOf(MOUSE.yaw + wob);
  const want = v3.madd(MOUSE.p, f, MOUSE.speed * dt);
  const c = constrainFloor([want[0], 0, want[2]], 'floor');
  if (Math.hypot(c[0] - want[0], c[2] - want[2]) > 1e-6) {
    // ran into something: back off and pick a new heading
    MOUSE.yaw = MOUSE.yawT = MOUSE.yaw + Math.PI + rand(-0.9, 0.9);
    MOUSE.burst = rand(0.3, 0.8);
    MOUSE.bump = 1;
    SOUNDS.play('bounce', { v: 1.1, pos: MOUSE.p, gain: 0.16 });
  }
  MOUSE.p = [c[0], MOUSE.p[1], c[2]];
  MOUSE.bump = Math.max(0, MOUSE.bump - dt * 4);
  SOUNDS.whirr(MOUSE.speed > 0.05 ? clamp(MOUSE.speed, 0.2, 1) * clamp(MOUSE.wind * 2, 0, 1) : 0, MOUSE.p);
}
const mouseFlat = () => [MOUSE.p[0], 0, MOUSE.p[2]];

// step off whatever it is standing on, onto the floor in front of it
async function getDown(cat, tok) {
  if (!PERCHES[cat.level]) return;
  const land = constrainFloor(perchApproach(cat.level)[1], 'floor');
  await jumpTo(cat, tok, land, 'floor', supportY(land[0], land[2], null));
}
// the nearest thing worth jumping onto from where the cat is standing
function nearestPerch() {
  let best = null;
  for (const k in PERCHES) {
    const a = perchApproach(k)[0];
    const d = Math.hypot(a[0] - CAT.pos[0], a[2] - CAT.pos[2]);
    if (!best || d < best.d) best = { k, d };
  }
  return best ? best.k : 'bed';
}

// ---- small reusable motions -----------------------------------------------------
async function buttWiggle(cat, tok, dur) {
  cat.extra = (P) => {
    const t = cat.time;
    P.roll += Math.sin(t * 13) * 3.2;
    poseAddBone(P, 'pelvis', Math.sin(t * 13) * 6, Math.sin(t * 13) * 5, 0);
    poseAddBone(P, 'tail6', 0, Math.sin(t * 9) * 14, 0); poseAddBone(P, 'tail7', 0, Math.sin(t * 9 - 1) * 20, 0);
  };
  await cat.wait(dur, tok); cat.check(tok);
  cat.extra = null;
}
// Before a body springs forward it gathers backward. Without this beat the cat
// simply teleports into its launch, which is the most mechanical thing a jump
// can do.
async function coil(cat, tok, dur = 0.17) {
  const t0 = cat.time;
  cat.extra = (P) => {
    const a = Math.sin(Math.PI * clamp((cat.time - t0) / dur, 0, 1));
    P.dy -= 0.019 * a;
    P.dx -= 0.017 * a;
    P.pitch += 5 * a;
    poseAddBone(P, 'thighL', 0, 0, 15 * a); poseAddBone(P, 'thighR', 0, 0, 13 * a);
    poseAddBone(P, 'shinL', 0, 0, -19 * a); poseAddBone(P, 'shinR', 0, 0, -17 * a);
    poseAddBone(P, 'neck', 0, 0, -7 * a); poseAddBone(P, 'head', 0, 0, 9 * a);
    poseAddBone(P, 'spine1', 0, 0, -5 * a);
  };
  await cat.wait(dur, tok);
  cat.extra = null;
}
async function jumpTo(cat, tok, landing, level, y1) {
  await cat.turnToward(landing, tok);
  cat.look.target = [landing[0], y1 + 0.1, landing[2]];
  cat.ears.tFlat = [0, 0]; cat.whiskerT = 0.6;
  await cat.toPose('crouch', 0.32, tok);
  await buttWiggle(cat, tok, 0.45);
  await coil(cat, tok);
  SOUNDS.play('hop');
  await new Promise((res) => { cat.startJump(landing, y1, level); cat.jump.done = res; });
  cat.check(tok);
  await cat.wait(0.18, tok);
  await cat.toPose('stand', 0.35, tok);
}

// ---- the red dot -----------------------------------------------------------
// Chasing a laser is not fetching. The cat never gets it, and that is the whole
// point: it stalks flat to the floor, pounces, finds nothing under its paws,
// swats at it, and goes back to stalking. Put the dot up a wall and it can only
// sit and chatter at it; hold the dot still and it loses interest, the way a
// real cat does.
async function swatAt(cat, tok, at) {
  const sd = Math.sin(yawTo(cat.pos, at) - cat.yaw) > 0 ? 'R' : 'L';
  const t0 = cat.time;
  cat.extra = (P) => {
    const a = Math.sin(Math.PI * clamp((cat.time - t0) / 0.26, 0, 1));
    poseAddBone(P, 'scap' + sd, 0, 0, a * 16);
    poseAddBone(P, 'arm' + sd, 0, a * 14, a * 54);
    poseAddBone(P, 'fore' + sd, 0, 0, -a * 32);
    poseAddBone(P, 'hand' + sd, 0, 0, -a * 20);
    poseAddBone(P, 'spine2', 0, a * 7, 0);
    P.pitch += a * 4;
  };
  await cat.wait(0.3, tok);
  cat.extra = null;
}
function laserChase() {
  CAT.run('laser', async (tok) => {
    resetMood(CAT);
    CAT.lookFn = () => LASER.p;
    CAT.dilateT = 1.0; CAT.whiskerT = 1.0; CAT.ears.tYaw = [12, 12]; CAT.lidBase = 0.0;
    CAT.setStatus('盯上了那个红点');
    await getDown(CAT, tok);
    await CAT.standUp(tok);
    let misses = 0;
    while (LASER.on) {
      const flat = [LASER.p[0], 0, LASER.p[2]];
      const d = v3.dist([CAT.pos[0], 0, CAT.pos[2]], flat);
      if (CAT.time - LASER.lastMove > 7) {
        CAT.setStatus('红点不动了，看腻了');
        CAT.dilateT = 0.6;
        await CAT.wait(1.4, tok);
        continue;
      }
      CAT.dilateT = 1.0;
      if (LASER.p[1] > 0.30) {
        CAT.setStatus('够不着，只能盯着');
        CAT.tail.lash = 0.7;
        if (Math.random() < 0.22) CAT.say('chatter');
        await CAT.wait(0.5, tok);
      } else if (d > 0.85) {
        CAT.setStatus('冲过去');
        CAT.tail.lash = 0.4;
        await CAT.moveTo(flat, 2.3, tok, 0.3, { track: () => [LASER.p[0], 0, LASER.p[2]] });
      } else if (d > 0.32) {
        CAT.setStatus('压低身子摸过去');
        await CAT.toPose('crouch', 0.28, tok);
        await CAT.moveTo(flat, 0.6, tok, 0.3, { track: () => [LASER.p[0], 0, LASER.p[2]] });
      } else {
        CAT.setStatus('屁股扭了扭…');
        await CAT.toPose('crouch', 0.22, tok);
        CAT.tail.quiver = 1.0;
        await buttWiggle(CAT, tok, rand(0.35, 0.8));
        const tgt = constrainFloor([LASER.p[0], 0, LASER.p[2]], 'floor');
        await coil(CAT, tok, 0.13);
        SOUNDS.play('hop');
        await new Promise((res) => { CAT.startJump(tgt, supportY(tgt[0], tgt[2], null), 'floor'); CAT.jump.done = res; });
        CAT.check(tok);
        misses++;
        CAT.setStatus('扑了个空');
        await CAT.wait(0.16, tok);
        await swatAt(CAT, tok, LASER.p);
        if (Math.random() < 0.45) await swatAt(CAT, tok, LASER.p);
        if (misses % 5 === 0) { CAT.say('meowShort', { annoyed: true }); CAT.tail.lash = 1; }
        await CAT.wait(rand(0.15, 0.45), tok);
        await CAT.toPose('crouch', 0.25, tok);
      }
      await CAT.wait(0.04, tok);
    }
    CAT.lidBase = 0.15; CAT.lookFn = null;
    await CAT.toPose('sit', 0.6, tok);
    CAT.look.target = R.camPos.slice();
    CAT.setStatus('还在想那个红点');
  });
}

// Hunting a toy mouse is the opposite of chasing a laser: this one can actually
// be caught. The cat freezes when it bolts, creeps while it is stopped, pounces,
// pins it under a paw, and then lets it go — because a cat that has caught
// something it cannot eat will always let it run again.
function mouseHunt() {
  CAT.run('mouse', async (tok) => {
    resetMood(CAT);
    CAT.lookFn = () => MOUSE.p;
    CAT.dilateT = 1.0; CAT.whiskerT = 1.0; CAT.ears.tYaw = [8, 8]; CAT.lidBase = 0.02;
    CAT.setStatus('发现了那只老鼠');
    await getDown(CAT, tok);
    await CAT.standUp(tok);
    while (MOUSE.out) {
      const d = v3.dist([CAT.pos[0], 0, CAT.pos[2]], mouseFlat());
      if (MOUSE.wind <= 0.01) {
        CAT.setStatus('老鼠不动了，用爪子拨了拨');
        if (d > 0.3) await CAT.moveTo(mouseFlat(), 0.8, tok, 0.26, { track: mouseFlat });
        else { await swatAt(CAT, tok, MOUSE.p); await CAT.wait(rand(0.8, 2.0), tok); }
        continue;
      }
      if (MOUSE.speed > 0.1 && d < 0.75) {
        // it bolted: freeze, watch it, then go
        CAT.setStatus('一动不动地盯着');
        await CAT.toPose('crouch', 0.18, tok);
        CAT.tail.quiver = 1.0;
        await CAT.wait(rand(0.15, 0.4), tok);
      } else if (d > 0.8) {
        CAT.setStatus('追上去');
        CAT.tail.lash = 0.5;
        await CAT.moveTo(mouseFlat(), 2.1, tok, 0.3, { track: mouseFlat });
      } else if (d > 0.3) {
        CAT.setStatus('蹑手蹑脚靠近');
        await CAT.toPose('crouch', 0.26, tok);
        await CAT.moveTo(mouseFlat(), 0.5, tok, 0.28, { track: mouseFlat });
      } else {
        CAT.setStatus('扑！');
        await CAT.toPose('crouch', 0.2, tok);
        await buttWiggle(CAT, tok, rand(0.3, 0.7));
        const tgt = constrainFloor(mouseFlat(), 'floor');
        await coil(CAT, tok, 0.13);
        SOUNDS.play('hop');
        await new Promise((res) => { CAT.startJump(tgt, 0, 'floor'); CAT.jump.done = res; });
        CAT.check(tok);
        if (v3.dist([CAT.pos[0], 0, CAT.pos[2]], mouseFlat()) < 0.26) {
          MOUSE.pinned = rand(1.2, 2.6);
          CAT.setStatus('按住了！');
          CAT.say('chatter');
          await swatAt(CAT, tok, MOUSE.p);
          await CAT.wait(0.5, tok);
          await swatAt(CAT, tok, MOUSE.p);
          await CAT.wait(Math.max(0, MOUSE.pinned), tok);
          CAT.setStatus('一松爪，又跑了');
        } else {
          CAT.setStatus('差一点');
          await swatAt(CAT, tok, MOUSE.p);
        }
        await CAT.wait(rand(0.2, 0.5), tok);
        await CAT.toPose('crouch', 0.25, tok);
      }
      await CAT.wait(0.04, tok);
    }
    CAT.lidBase = 0.15; CAT.lookFn = null;
    await CAT.toPose('sit', 0.6, tok);
    CAT.look.target = R.camPos.slice();
    CAT.setStatus('玩累了');
  });
}

// ---- top-level actions ----------------------------------------------------------
const ACTIONS = {
  mouse() {
    CAT.lastInteraction = CAT.time;
    if (!MOUSE.out) {
      // wind it up and set it down somewhere clear of the cat
      MOUSE.out = true; MOUSE.wind = 1;
      const a = CAT.yaw + rand(-1.2, 1.2);
      MOUSE.p = constrainFloor(v3.add([CAT.pos[0], 0, CAT.pos[2]], v3.mul(fwdOf(a), rand(0.9, 1.5))), 'floor');
      MOUSE.p[1] = 0.03;
      MOUSE.yaw = MOUSE.yawT = a + Math.PI;
      MOUSE.speed = 0; MOUSE.burst = 0.3; MOUSE.pinned = 0;
      mouseHunt();
    } else if (MOUSE.wind <= 0.01) {
      // the spring has run down: wind it again rather than putting it away
      MOUSE.wind = 1; MOUSE.burst = 0.2;
      if (CAT.busy !== 'mouse') mouseHunt();
    } else {
      MOUSE.out = false; MOUSE.wind = 0;
      SOUNDS.whirr(0);
      if (CAT.busy === 'mouse') CAT.run('mouseOff', async (tok) => {
        resetMood(CAT); CAT.lidBase = 0.15;
        await CAT.toPose('sitTall', 0.6, tok);
        CAT.look.target = R.camPos.slice();
        CAT.setStatus('老鼠收起来了');
      });
    }
  },
  laser() {
    LASER.on = !LASER.on;
    CAT.lastInteraction = CAT.time;
    if (LASER.on) { LASER.lastMove = CAT.time; laserChase(); return; }
    if (CAT.busy === 'laser') {
      CAT.run('laserOff', async (tok) => {
        resetMood(CAT); CAT.lidBase = 0.15;
        CAT.setStatus('红点呢？');
        await CAT.toPose('sitTall', 0.6, tok);
        CAT.look.target = R.camPos.slice();
        await CAT.wait(1.5, tok);
        CAT.setStatus('还在找那个红点');
      });
    }
  },
  fetch(target) {
    const tgt = target || (() => {
      const dir = v3.norm(v3.sub([CAT.pos[0], 0, CAT.pos[2]], [R.camPos[0], 0, R.camPos[2]]));
      const side = [-dir[2], 0, dir[0]];
      return constrainFloor(v3.add(v3.add([CAT.pos[0], 0, CAT.pos[2]], v3.mul(dir, rand(0.9, 1.6))), v3.mul(side, rand(-0.8, 0.8))), 'floor');
    })();
    throwBall(tgt);
    CAT.lastInteraction = CAT.time;
    CAT.run('fetch', async (tok) => {
      resetMood(CAT);
      CAT.setStatus('盯着球');
      CAT.look.target = BALL.p; CAT.look.track = true;
      CAT.dilateT = 1.0; CAT.whiskerT = 0.9; CAT.ears.tYaw = [8, 8];
      CAT.lookFn = () => BALL.p;
      if (CAT.mode === 'pose' && ['side', 'bellyUp', 'curl'].includes(CAT.poseName)) await CAT.toPose('loaf', 0.4, tok);
      await getDown(CAT, tok);
      if (CAT.mode === 'pose' && ['loaf', 'sit', 'sitTall'].includes(CAT.poseName)) await CAT.toPose('stand', 0.35, tok);
      await CAT.turnToward(BALL.p, tok);
      await CAT.toPose('crouch', 0.25, tok);
      SOUNDS.play('chatter');
      await buttWiggle(CAT, tok, 0.55);
      CAT.setStatus('冲过去追球');
      await CAT.moveTo(BALL.p, 2.4, tok, 0.205, { track: () => BALL.p });
      // make sure the ball is right in front
      for (let tries = 0; tries < 3 && v3.dist([CAT.pos[0], 0, CAT.pos[2]], [BALL.p[0], 0, BALL.p[2]]) > 0.26; tries++) {
        await CAT.moveTo(BALL.p, 1.0, tok, 0.205, { track: () => BALL.p });
      }
      CAT.lookFn = null;
      await CAT.toPose('pickup', 0.24, tok);
      CAT.jawAnim = { t: 0, keys: [[0, 0], [0.12, 1], [0.24, 1], [0.34, 0.35]], amp: 14, dur: 0.34 };
      await CAT.wait(0.2, tok);
      BALL.held = true;
      await CAT.wait(0.14, tok);
      CAT.setStatus('叼着球回来');
      CAT.dilateT = 0.6;
      await CAT.toPose('stand', 0.25, tok);
      const spot = viewerSpot(0.6);
      CAT.look.target = R.camPos.slice();
      await CAT.moveTo(spot, 0.75, tok, 0.04, { face: R.camPos });
      await CAT.toPose('pickup', 0.3, tok);
      CAT.jawAnim = { t: 0, keys: [[0, 0], [0.1, 1], [0.3, 0.8], [0.4, 0]], amp: 12, dur: 0.4 };
      await CAT.wait(0.1, tok);
      BALL.held = false;
      BALL.v = v3.mul(fwdOf(CAT.yaw), 0.25);
      await CAT.wait(0.2, tok);
      await CAT.toPose('sitTall', 0.55, tok);
      CAT.look.target = R.camPos.slice();
      CAT.setStatus('等你再丢一次');
      await CAT.wait(0.2, tok);
      CAT.say('meow');
      CAT.tail.lash = 0.3;
      await CAT.wait(1.6, tok);
    });
  },
  call() {
    CAT.lastInteraction = CAT.time;
    CAT.run('call', async (tok) => {
      const wasSleeping = CAT.sleeping;
      resetMood(CAT);
      CAT.look.target = R.camPos.slice();
      if (wasSleeping) { await wakeUp(CAT, tok); }
      CAT.say('trill');
      CAT.setStatus('听到你在叫它');
      await CAT.wait(0.35, tok);
      await getDown(CAT, tok);
      await CAT.standUp(tok);
      const spot = viewerSpot(0.5);
      if (v3.dist(spot, CAT.pos) > 0.25) await CAT.moveTo(spot, 0.7, tok, 0.04, { face: R.camPos });
      else await CAT.turnToward(R.camPos, tok);
      CAT.setStatus('跑到你面前');
      await CAT.toPose('sitTall', 0.6, tok);
      CAT.tail.lash = 0.2;
      CAT.say('meow');
      await CAT.wait(1.2, tok);
      CAT.squint = 0.35;
      await CAT.wait(1.0, tok);
      CAT.squint = 0;
    });
  },
  roll() {
    CAT.lastInteraction = CAT.time;
    CAT.run('roll', async (tok) => {
      const wasSleeping = CAT.sleeping;
      resetMood(CAT);
      if (wasSleeping) await wakeUp(CAT, tok);
      CAT.setStatus('打滚');
      CAT.look.target = R.camPos.slice();
      if (CAT.mode !== 'pose' || !['loaf', 'side', 'bellyUp'].includes(CAT.poseName)) {
        await CAT.standUp(tok);
        await CAT.toPose('loaf', 0.7, tok);
      }
      CAT.say('chirp');
      await CAT.toPose('side', 0.55, tok);
      await CAT.toPose('bellyUp', 0.6, tok);
      CAT.setStatus('露出肚皮，摸摸看');
      CAT.squint = 0.3;
      // wriggle on the back
      CAT.extra = (P) => { const t = CAT.time; P.roll += Math.sin(t * 2.2) * 9; poseAddBone(P, 'pelvis', Math.sin(t * 2.2 + 0.8) * 10, 0, 0); poseAddBone(P, 'handL', 0, 0, Math.sin(t * 3.1) * 12); poseAddBone(P, 'handR', 0, 0, Math.sin(t * 3.1 + 1.5) * 12); };
      await CAT.wait(2.4, tok);
      CAT.extra = null;
      CAT.say('trill');
      await CAT.wait(7.0, tok);
      CAT.squint = 0;
      await CAT.toPose('side', 0.6, tok);
      await CAT.toPose('loaf', 0.6, tok);
      CAT.setStatus('趴着看你');
    });
  },
  sleep() {
    CAT.lastInteraction = CAT.time;
    CAT.run('sleep', async (tok) => {
      resetMood(CAT);
      CAT.setStatus('困了');
      if (CAT.mode !== 'pose' || !['loaf', 'side', 'curl'].includes(CAT.poseName)) {
        await CAT.standUp(tok);
        // circle once before lying down
        const c = v3.add(CAT.pos, v3.mul(fwdOf(CAT.yaw + 1.6), 0.1));
        await CAT.moveTo(v3.add(c, v3.mul(fwdOf(CAT.yaw - 1.2), 0.12)), 0.3, tok, 0.02);
        await CAT.toPose('loaf', 0.9, tok);
      }
      CAT.sleepy = 0.6;
      CAT.say('yawn');
      CAT.look.target = null;
      await CAT.wait(2.2, tok);
      await CAT.toPose('side', 1.0, tok);
      await CAT.toPose('curl', 1.4, tok);
      CAT.sleeping = true;
      CAT.ears.tFlat = [0.25, 0.25];
      CAT.setStatus('睡着了 zZ');
      // dream twitches
      for (;;) {
        await CAT.wait(rand(5, 11), tok);
        const leg = pick(['handL', 'handR', 'fingL', 'toeL']);
        const t0 = CAT.time;
        CAT.extra = (P) => { const k = CAT.time - t0; if (k < 0.5) poseAddBone(P, leg, 0, 0, Math.sin(k * 40) * 8 * (1 - k / 0.5)); };
        CAT.ears.vyaw[Math.random() < 0.5 ? 0 : 1] += 60;
        await CAT.wait(0.6, tok);
        CAT.extra = null;
      }
    });
  },
  jump() {
    CAT.lastInteraction = CAT.time;
    CAT.run('jump', async (tok) => {
      const wasSleeping = CAT.sleeping;
      resetMood(CAT);
      if (wasSleeping) await wakeUp(CAT, tok);
      await CAT.standUp(tok);
      if (!PERCHES[CAT.level]) {
        const k = CAT.jumpTo || nearestPerch();
        CAT.jumpTo = null;
        const P0 = PERCHES[k], [take] = perchApproach(k);
        const land = [(P0.b[0] + P0.b[1]) / 2, 0, (P0.b[2] + P0.b[3]) / 2];
        CAT.setStatus('准备跳上' + P0.label);
        await CAT.moveTo(constrainFloor(take, 'floor'), 0.8, tok, 0.04, { face: [land[0], P0.y, land[2]] });
        await jumpTo(CAT, tok, land, k, P0.y);
        CAT.setStatus('跳上了' + P0.label);
        await CAT.wait(0.4, tok);
        await CAT.turnToward(R.camPos, tok);
        await CAT.toPose('sitTall', 0.6, tok);
        CAT.look.target = R.camPos.slice();
      } else {
        CAT.setStatus('跳下' + PERCHES[CAT.level].label);
        await getDown(CAT, tok);
        CAT.setStatus('跳下来了');
        await CAT.wait(0.3, tok);
        await CAT.turnToward(R.camPos, tok);
        await CAT.toPose('stand', 0.4, tok);
      }
    });
  },
  sit() {
    CAT.lastInteraction = CAT.time;
    CAT.run('sit', async (tok) => {
      const wasSleeping = CAT.sleeping;
      resetMood(CAT);
      if (wasSleeping) await wakeUp(CAT, tok);
      await CAT.standUp(tok);
      await CAT.turnToward(R.camPos, tok);
      CAT.look.target = R.camPos.slice();
      await CAT.toPose('sitTall', 0.7, tok);
      CAT.setStatus('乖乖坐好');
      CAT.say('mew');
    });
  },
};

async function wakeUp(cat, tok) {
  cat.sleeping = false;
  cat.setStatus('醒了');
  cat.sleepy = 0.7;
  await cat.toPose('side', 0.9, tok);
  await cat.toPose('loaf', 0.8, tok);
  cat.look.target = R.camPos.slice();
  cat.say('yawn');
  cat.extra = (P) => { const k = clamp((cat.jawAnim ? cat.jawAnim.t : 3) / 2.4, 0, 1); const a = Math.sin(Math.PI * k); poseAddBone(P, 'neck', 0, 0, 14 * a); poseAddBone(P, 'head', 0, 0, 16 * a); cat.squint = 0.8 * a; };
  await cat.wait(2.4, tok);
  cat.extra = null; cat.squint = 0;
  await cat.toPose('stand', 0.6, tok);
  await cat.toPose('stretch', 0.7, tok);
  await cat.wait(1.0, tok);
  await cat.toPose('stand', 0.6, tok);
  cat.sleepy = 0;
}

// ---- petting ---------------------------------------------------------------------
const PET = { lastMove: 0, accum: 0, side: 1 };
function petBegin(hit) {
  const c = CAT;
  c.lastInteraction = c.time;
  c.pet.active = true;
  c.pet.region = hit.region;
  c.pet.point = hit.point;
  c.petRegion = hit.region;
  c.petSide = hit.side;
  PET.accum = 0;
  if (c.busy === 'fetch' || c.busy === 'jump' || c.mode === 'jump') return;
  if (c.sleeping) { c.purr = 0.6; SOUNDS.purr(0.6); c.setStatus('睡梦里咕噜咕噜'); return; }
  if (hit.region === 'tail') {
    c.tail.lash = 1.0; c.ears.tFlat = [0.25, 0.25];
    c.say('growl');
    c.setStatus('不喜欢被摸尾巴');
    return;
  }
  if (hit.region === 'belly') { bellyRub(); return; }
  if (!c.busy || ['idleSit', 'idleLoaf', 'call', 'sit', 'pet', 'groom'].includes(c.busy)) {
    if (c.busy === 'groom') { c.tongueT = 0; c.squint = 0; }
    c.run('pet', async (tok) => {
      const lookAtYou = hit.region === 'cheek' || hit.region === 'head';
      c.look.target = lookAtYou ? R.camPos.slice() : null;
      c.squint = hit.region === 'chin' ? 0.9 : 0.55; c.purr = 0.85; SOUNDS.purr(0.85);
      c.ears.tFlat = [0.12, 0.12];
      c.setStatus(hit.region === 'chin' ? '被挠下巴，眯起眼睛' : hit.region === 'back' || hit.region === 'rump' ? '弓起背蹭你的手' : '蹭你的手');
      c.petReact = 0;
      for (;;) {
        c.petReact = expDecay(c.petReact, c.pet.active ? 1 : 0, 3, 0.05);
        c.petRegion = c.pet.region || c.petRegion;
        if (c.petRegion === 'back' || c.petRegion === 'rump') c.tail.quiver = 0.8;
        if (c.pet.active) { c.squint = c.petRegion === 'chin' ? 0.9 : 0.55; if (c.petRegion === 'chin' || c.petRegion === 'back' || c.petRegion === 'rump') c.look.target = null; }
        await c.wait(0.05, tok);
        if (!c.pet.active && c.time - c.pet.last > 2.5) break;
      }
      c.squint = 0; c.purr = 0; SOUNDS.purr(0); c.petReact = 0; c.ears.tFlat = [0, 0];
      c.look.target = R.camPos.slice();
      c.setStatus('还想被摸');
    });
  }
}
function petMove(hit, dir) {
  const c = CAT;
  c.pet.point = hit.point; c.pet.dir = dir; c.pet.region = hit.region; c.pet.last = c.time;
  c.petSide = hit.side;
  c.lastInteraction = c.time;
  PET.accum += 1;
}
function petEnd() {
  CAT.pet.active = false;
  CAT.pet.last = CAT.time;
  if (CAT.sleeping) { setTimeout(() => { if (!CAT.pet.active && CAT.sleeping) { CAT.purr = 0; SOUNDS.purr(0); CAT.setStatus('睡着了 zZ'); } }, 1500); }
}
function bellyRub() {
  const c = CAT;
  const lying = c.mode === 'pose' && ['side', 'bellyUp'].includes(c.poseName);
  if (!lying) return;
  c.run('belly', async (tok) => {
    c.setStatus('被摸肚子');
    c.purr = 0.7; SOUNDS.purr(0.7); c.squint = 0.4;
    // knead the air with the front paws while it enjoys it
    c.extra = (P) => { const t = c.time; poseAddBone(P, 'handL', 0, 0, Math.sin(t * 5) * 18); poseAddBone(P, 'handR', 0, 0, Math.sin(t * 5 + Math.PI) * 18); poseAddBone(P, 'fingL', 0, 0, Math.max(0, Math.sin(t * 5)) * 20); poseAddBone(P, 'fingR', 0, 0, Math.max(0, Math.sin(t * 5 + Math.PI)) * 20); };
    const enjoy = rand(1.6, 3.6);
    let t = 0;
    while (t < enjoy) { await c.wait(0.1, tok); if (c.pet.active) t += 0.1; else if (c.time - c.pet.last > 3) { c.extra = null; c.purr = 0; SOUNDS.purr(0); c.squint = 0; c.setStatus('肚皮朝天'); return; } }
    if (Math.random() < 0.7) {
      // the classic belly trap: grab with the front paws, bunny-kick, then leave
      c.setStatus('抱住你的手，后腿乱蹬');
      c.purr = 0; SOUNDS.purr(0); c.squint = 0; c.dilateT = 1; c.ears.tFlat = [0.8, 0.8];
      c.say('growl');
      const t0 = c.time;
      c.extra = (P) => {
        const k = c.time - t0;
        const kick = Math.sin(k * 26);
        poseAddBone(P, 'armL', 0, 0, -18); poseAddBone(P, 'armR', 0, 0, -18);
        poseAddBone(P, 'foreL', 0, 0, 30); poseAddBone(P, 'foreR', 0, 0, 30);
        poseAddBone(P, 'thighL', 0, 0, 20 + kick * 22); poseAddBone(P, 'thighR', 0, 0, 20 - kick * 22);
        poseAddBone(P, 'shinL', 0, 0, -kick * 26); poseAddBone(P, 'shinR', 0, 0, kick * 26);
        poseAddBone(P, 'neck', 0, 0, -16); poseAddBone(P, 'head', 0, 0, -20);
        c.tail.lash = 1;
      };
      await c.wait(1.4, tok);
      c.extra = null;
      c.say('meowShort', { annoyed: true });
      await c.toPose('loaf', 0.45, tok);
      await c.toPose('stand', 0.4, tok);
      const away = constrainFloor(v3.add(c.pos, v3.mul(fwdOf(c.yaw + rand(-0.8, 0.8)), 0.45)), c.level);
      await c.moveTo(away, 0.6, tok, 0.03);
      c.ears.tFlat = [0, 0];
      await c.toPose('sit', 0.6, tok);
      c.setStatus('有点不高兴，甩着尾巴');
      c.tail.lash = 0.8;
      await c.wait(2.5, tok);
    } else {
      c.setStatus('很享受，咕噜咕噜');
      while (true) { await c.wait(0.2, tok); if (!c.pet.active && c.time - c.pet.last > 2.5) break; }
      c.extra = null; c.purr = 0; SOUNDS.purr(0); c.squint = 0;
      c.setStatus('肚皮朝天');
    }
  });
}

// ---------------------------------------------------------------- input: picking, petting, camera, throwing
const PICK = { pos: new Float32Array(META.nv * 3), stamp: -1 };
let FRAME_NO = 0;
function skinnedPositions() {
  if (PICK.stamp === FRAME_NO) return PICK.pos;
  const rest = R.cat.rest, sj = R.cat.sj, sw = R.cat.sw, S = SK.skin, out = PICK.pos;
  const nv = META.nv;
  for (let i = 0; i < nv; i++) {
    const px = rest[i * 3], py = rest[i * 3 + 1], pz = rest[i * 3 + 2];
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw[i * 4 + k];
      if (!w) continue;
      const f = w / 255, b = sj[i * 4 + k] * 16;
      x += f * (S[b] * px + S[b + 4] * py + S[b + 8] * pz + S[b + 12]);
      y += f * (S[b + 1] * px + S[b + 5] * py + S[b + 9] * pz + S[b + 13]);
      z += f * (S[b + 2] * px + S[b + 6] * py + S[b + 10] * pz + S[b + 14]);
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  PICK.stamp = FRAME_NO;
  return out;
}
function screenRay(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  const nx = ((cx - rect.left) / rect.width) * 2 - 1, ny = -(((cy - rect.top) / rect.height) * 2 - 1);
  const inv = M4.inv(R.vp);
  const a = M4.point(inv, [nx, ny, -1]), b = M4.point(inv, [nx, ny, 1]);
  return { o: a, d: v3.norm(v3.sub(b, a)) };
}
const HEAD_BONES = new Set(['head', 'jaw', 'earL', 'earR', 'lidUL', 'lidDL', 'lidUR', 'lidDR'].map(BI));
const TORSO_BONES = new Set(['pelvis', 'spine1', 'spine2', 'neck', 'scapL', 'scapR'].map(BI));
const TAIL_BONES = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => BI('tail' + i)));
function pickCat(ray) {
  // quick reject with a bounding sphere around the body
  const c = SK.wp[BI('spine1')];
  const oc = v3.sub(c, ray.o);
  const tc = v3.dot(oc, ray.d);
  const d2 = v3.dot(oc, oc) - tc * tc;
  if (d2 > 0.42 * 0.42) return null;
  const P = skinnedPositions(), idx = R.cat.idx;
  let best = Infinity, bi = -1;
  const o = ray.o, d = ray.d;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, cc = idx[t + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
    const e2x = P[cc] - P[a], e2y = P[cc + 1] - P[a + 1], e2z = P[cc + 2] - P[a + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-12 && det < 1e-12) continue;
    const inv = 1 / det;
    const sx = o[0] - P[a], sy = o[1] - P[a + 1], sz = o[2] - P[a + 2];
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (tt > 0.01 && tt < best) { best = tt; bi = t; }
  }
  if (bi < 0) return null;
  const vi = idx[bi];
  const sj = R.cat.sj, sw = R.cat.sw;
  let bone = sj[vi * 4], bw = sw[vi * 4];
  for (let k = 1; k < 4; k++) if (sw[vi * 4 + k] > bw) { bw = sw[vi * 4 + k]; bone = sj[vi * 4 + k]; }
  const ny = R.cat.nrm[vi * 4 + 1] / 127, nz = R.cat.nrm[vi * 4 + 2] / 127;
  const rx = R.cat.rest[vi * 3], rz = R.cat.rest[vi * 3 + 2];
  let region;
  if (HEAD_BONES.has(bone)) region = (bone === BI('jaw') || ny < -0.35) ? 'chin' : (Math.abs(nz) > 0.55 ? 'cheek' : 'head');
  else if (TORSO_BONES.has(bone)) region = ny < -0.40 ? (bone === BI('neck') ? 'chin' : 'belly') : (rx < -0.06 ? 'rump' : 'back');
  else if (TAIL_BONES.has(bone)) region = 'tail';
  else region = 'leg';
  // when lying on the back/side the exposed underside counts as belly
  if (region === 'back' && CAT.mode === 'pose' && ['bellyUp'].includes(CAT.poseName)) region = 'back';
  const point = v3.add(ray.o, v3.mul(ray.d, best));
  return { t: best, point, region, side: rz < 0 ? -1 : 1, bone };
}
function pickFloor(ray) {
  if (Math.abs(ray.d[1]) < 1e-5) return null;
  const t = -(ray.o[1] - 0.012) / ray.d[1];
  if (t < 0) return null;
  const p = v3.add(ray.o, v3.mul(ray.d, t));
  const F = ROOM.floor;
  if (p[0] < F.x0 || p[0] > F.x1 || p[2] < ROOM.backZ || p[2] > F.z1) return null;
  return { t, point: p };
}

// Where the dot lands. The floor is not the only thing in the room, and a laser
// that stops at the edge of the rug is not worth chasing, so this also takes
// the tops of the bed, the desk and the chair, and the two walls you can see.
function pickSurface(ray) {
  let best = null;
  const F = ROOM.floor, B = ROOM.bed, D = ROOM.desk, C = ROOM.chair;
  const hit = (t, p, kind) => { if (t > 0.02 && (!best || t < best.t)) best = { t, p, kind }; };
  const planeY = (y, inside, kind) => {
    if (Math.abs(ray.d[1]) < 1e-5) return;
    const t = (y - ray.o[1]) / ray.d[1];
    if (t <= 0) return;
    const q = v3.add(ray.o, v3.mul(ray.d, t));
    if (inside(q)) hit(t, [q[0], y + 0.004, q[2]], kind);
  };
  const planeAxis = (ax, v, inside, kind) => {
    if (Math.abs(ray.d[ax]) < 1e-5) return;
    const t = (v - ray.o[ax]) / ray.d[ax];
    if (t <= 0) return;
    const q = v3.add(ray.o, v3.mul(ray.d, t));
    if (inside(q)) { q[ax] += ax === 0 ? 0.004 : 0.004; hit(t, q, kind); }
  };
  // the duvet stands proud of the mattress, so a dot aimed at the foot of the
  // bed has to land on top of it rather than inside it
  const duvZ0 = B.z1 - 0.75, duvZ1 = B.z1 - 0.03;
  planeY(0.605, (q) => q[0] > B.x0 + 0.02 && q[0] < B.x1 - 0.02 && q[2] > duvZ0 && q[2] < duvZ1, 'bed');
  planeY(B.seatY, (q) => q[0] > B.x0 && q[0] < B.x1 && q[2] > B.z0 && q[2] < duvZ0, 'bed');
  planeY(D.topY, (q) => q[0] > D.x0 && q[0] < D.x1 && q[2] > D.z0 && q[2] < D.z1, 'high');
  planeY(C.seatY, (q) => Math.hypot(q[0] - C.cx, q[2] - C.cz) < C.hw + 0.04, 'high');
  planeY(0, (q) => q[0] > F.x0 && q[0] < F.x1 && q[2] > ROOM.backZ && q[2] < F.z1, 'floor');
  const upZ = (q) => q[1] > 0.02 && q[1] < ROOM.wallY - 0.05 && q[0] > F.x0 && q[0] < F.x1;
  const upX = (q) => q[1] > 0.02 && q[1] < ROOM.wallY - 0.05 && q[2] > ROOM.backZ && q[2] < F.z1;
  planeAxis(2, ROOM.backZ, upZ, 'wall');
  planeAxis(2, F.z1, upZ, 'wall');
  planeAxis(0, ROOM.leftX, upX, 'wall');
  planeAxis(0, F.x1, upX, 'wall');
  // the ceiling faces down, so its dot has to sit just below it
  if (Math.abs(ray.d[1]) > 1e-5) {
    const t = (ROOM.wallY - ray.o[1]) / ray.d[1];
    if (t > 0) {
      const q = v3.add(ray.o, v3.mul(ray.d, t));
      if (q[0] > F.x0 && q[0] < F.x1 && q[2] > ROOM.backZ && q[2] < F.z1) hit(t, [q[0], ROOM.wallY - 0.004, q[2]], 'wall');
    }
  }
  // Aim out of a doorway and the ray leaves the room entirely. Rather than
  // leaving the dot stuck where it was, drop it on the floor under the aim.
  if (!best && Math.abs(ray.d[1]) > 1e-5) {
    const t = -ray.o[1] / ray.d[1];
    if (t > 0.02) {
      const q = v3.add(ray.o, v3.mul(ray.d, t));
      best = { t, p: [clamp(q[0], F.x0 + 0.1, F.x1 - 0.1), 0.004, clamp(q[2], ROOM.backZ + 0.1, F.z1 - 0.1)], kind: 'floor' };
    }
  }
  if (best && best.kind === 'floor') {
    const R0 = ROOM.rug;
    if (Math.abs(best.p[0] - R0.cx) < R0.hx && Math.abs(best.p[2] - R0.cz) < R0.hz) best.p[1] = 0.016;
  }
  return best;
}
function laserTo(cx, cy) {
  const h = pickSurface(screenRay(cx, cy));
  if (!h) return;
  LASER.p = h.p; LASER.kind = h.kind; LASER.lastMove = CAT.time;
}
const INPUT = { pointers: new Map(), mode: null, startX: 0, startY: 0, startT: 0, moved: 0, lastPet: null, pinch: 0, onFirst: null };
function onDown(e) {
  // capture can be refused (the pointer may already be gone), and on a phone
  // that must not take the whole gesture down with it
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* keep going without it */ }
  INPUT.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (INPUT.onFirst) { INPUT.onFirst(); INPUT.onFirst = null; }
  if (INPUT.pointers.size === 2) {
    if (INPUT.mode === 'pet') petEnd();
    INPUT.mode = 'pinch';
    const [a, b] = [...INPUT.pointers.values()];
    INPUT.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    return;
  }
  INPUT.startX = e.clientX; INPUT.startY = e.clientY; INPUT.startT = performance.now(); INPUT.moved = 0;
  if (LASER.on) { INPUT.mode = 'laser'; canvas.style.cursor = 'crosshair'; laserTo(e.clientX, e.clientY); return; }
  const hit = pickCat(screenRay(e.clientX, e.clientY));
  if (hit) {
    INPUT.mode = 'pet';
    INPUT.lastPet = hit;
    canvas.style.cursor = 'grabbing';
    petBegin(hit);
  } else {
    INPUT.mode = 'orbit';
    canvas.style.cursor = 'grabbing';
  }
}
function onMove(e) {
  const p = INPUT.pointers.get(e.pointerId);
  if (!p) {
    // hover feedback on desktop
    if (e.pointerType === 'mouse' && !INPUT.mode) {
      const nowT = performance.now();
      if (nowT - (INPUT.lastHover || 0) < 80) return;
      INPUT.lastHover = nowT;
      if (LASER.on) { laserTo(e.clientX, e.clientY); canvas.style.cursor = 'crosshair'; return; }
      const hit = pickCat(screenRay(e.clientX, e.clientY));
      canvas.style.cursor = hit ? 'pointer' : 'grab';
    }
    return;
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  INPUT.moved += Math.hypot(dx, dy);
  if (INPUT.mode === 'pinch' && INPUT.pointers.size >= 2) {
    const [a, b] = [...INPUT.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (INPUT.pinch > 0) CAM.tDist = clamp(CAM.tDist * INPUT.pinch / d, 0.32, 3.2);
    INPUT.pinch = d;
    return;
  }
  if (INPUT.mode === 'laser') { laserTo(e.clientX, e.clientY); return; }
  if (INPUT.mode === 'orbit') {
    CAM.tAz += dx * 0.0085;
    CAM.tEl = clamp(CAM.tEl + dy * 0.006, 0.03, 1.25);
  } else if (INPUT.mode === 'pet') {
    const nowT = performance.now();
    if (nowT - (INPUT.lastPick || 0) < 30) return;
    INPUT.lastPick = nowT;
    const hit = pickCat(screenRay(e.clientX, e.clientY));
    if (hit) {
      const prev = INPUT.lastPet ? INPUT.lastPet.point : hit.point;
      let dir = v3.sub(hit.point, prev);
      dir = v3.len(dir) > 1e-5 ? v3.norm(dir) : CAT.pet.dir;
      INPUT.lastPet = hit;
      petMove(hit, dir);
      if (!CAT.pet.active) { CAT.pet.active = true; }
    } else if (CAT.pet.active) {
      CAT.pet.active = false;
    }
  }
}
function onUp(e) {
  INPUT.pointers.delete(e.pointerId);
  canvas.style.cursor = 'grab';
  if (INPUT.mode === 'pinch') { if (INPUT.pointers.size === 0) INPUT.mode = null; return; }
  const dt = performance.now() - INPUT.startT;
  const tap = INPUT.moved < 9 && dt < 400;
  if (INPUT.mode === 'laser') {
    INPUT.mode = null; canvas.style.cursor = 'crosshair';
    return;
  }
  if (INPUT.mode === 'pet') {
    petEnd();
    if (tap) onTapCat(INPUT.lastPet);
  } else if (INPUT.mode === 'orbit' && tap) {
    const hit = pickFloor(screenRay(e.clientX, e.clientY));
    if (hit) ACTIONS.fetch(constrainFloor(hit.point, 'floor'));
  }
  INPUT.mode = null;
}
function onTapCat(hit) {
  CAT.lastInteraction = CAT.time;
  if (CAT.sleeping) {
    CAT.ears.vyaw[0] += 80; CAT.ears.vyaw[1] -= 80;
    CAT.tapsWhileAsleep = (CAT.tapsWhileAsleep || 0) + 1;
    if (CAT.tapsWhileAsleep >= 2) { CAT.tapsWhileAsleep = 0; ACTIONS.call(); }
    return;
  }
  if (CAT.busy === 'fetch' || CAT.mode === 'jump') return;
  CAT.look.target = R.camPos.slice();
  CAT.say(pick(['mew', 'chirp', 'meowShort']));
  CAT.blinkT = 0.05;
}
canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); CAM.tDist = clamp(CAM.tDist * Math.exp(e.deltaY * 0.0012), 0.32, 3.2); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------- audio: synthesised cat voice (source-filter model)
const AUDIO = { ctx: null, master: null, bufs: {}, purrSrc: null, purrGain: null, on: false };

function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function interpTrack(track, t) {
  if (t <= track[0][0]) return track[0].slice(1);
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i], b = track[i + 1];
    if (t <= b[0]) {
      const k = smooth((t - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, j) => lerp(v, b[j + 1], k));
    }
  }
  return track[track.length - 1].slice(1);
}
// ---- the source: one glottal pulse ----------------------------------------
// The shape of a single pulse is what decides whether a synthesised voice
// reads as a voice or as a buzzer. The folds slam shut far faster than they
// open, and the short return phase as they come back together sets how bright
// the voice is. This is the Liljencrants-Fant pulse written so it can be
// evaluated straight from the cycle phase; its output is already the
// derivative of glottal flow, which is what a listener hears, so no extra
// differentiation is needed downstream.
function lfPulse(ph, oq, sq, ta) {
  const Te = oq, Tp = Te * sq / (1 + sq);
  if (ph >= Te) {
    if (ta < 1e-4) return 0;
    const e = 1 / ta, k = 1 - Math.exp(-e * (1 - Te));
    return -(Math.exp(-e * (ph - Te)) - Math.exp(-e * (1 - Te))) / Math.max(k, 1e-6);
  }
  const norm = Math.abs(Math.sin(Math.PI * (1 + sq) / sq));   // |value| at the excitation instant
  return Math.exp(3 * (ph / Te - 1)) * Math.sin(Math.PI * ph / Tp) / Math.max(norm, 1e-3);
}
// two-pole resonator and its inverse, the two-zero antiresonator
function resoCoef(f, bw, sr) {
  const C = -Math.exp(-2 * Math.PI * bw / sr);
  const B = 2 * Math.exp(-Math.PI * bw / sr) * Math.cos(2 * Math.PI * f / sr);
  return [1 - B - C, B, C];
}
function antiCoef(f, bw, sr) {
  const [A, B, C] = resoCoef(f, bw, sr);
  return [1 / A, -B / A, -C / A];
}

// ---- the vocal tract -------------------------------------------------------
// A cascade of formants, plus one pole-zero pair standing in for the nasal
// cavity. Every meow begins and ends with the mouth shut, and the notch that
// the nasal cavity puts in the spectrum is what makes that closed-mouth part
// sound like an [m] instead of just a quiet vowel. When nasality is zero the
// pole and the zero sit on top of each other and cancel exactly, so the oral
// path is untouched.
function voice(sr, o) {
  const n = Math.floor(o.dur * sr);
  const out = new Float32Array(n);
  const rnd = mulberry(o.seed || 7);
  const st = [[0, 0], [0, 0], [0, 0], [0, 0]];
  let np = [0, 0], zx1 = 0, zx2 = 0;
  let coef = [], nc = [1, 0, 0], zc = [1, 0, 0];
  const oq = o.oq || 0.60, sq = o.sq || 2.2;
  // cats are perturbed talkers: a percent or two of cycle-to-cycle wobble in
  // both pitch and amplitude, and they slip into period doubling easily
  const jitAmt = o.jit === undefined ? 0.018 : o.jit;
  const shimAmt = o.shim === undefined ? 0.07 : o.shim;
  let ph = 1, jit = 0, shim = 1, sub = 0, ta = 0.06;
  let hpPrev = 0, hpOut = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, u = t / o.dur;
    if (i % 24 === 0) {
      const F = interpTrack(o.formants, u);
      const nas = o.nasal ? clamp(interpTrack(o.nasal, u)[0], 0, 1) : 0;
      const bw = o.bw || [110, 150, 220, 300];
      // the nasal cavity is lossy: everything damps when the mouth shuts
      coef = F.map((f, k) => resoCoef(f, bw[k] * (1 + 1.5 * nas), sr));
      nc = resoCoef(280, 300, sr);
      zc = antiCoef(lerp(280, 1000, nas), 300, sr);
      // the voice also gets softer-edged as it closes down
      ta = (o.ta === undefined ? 0.055 : o.ta) * (1 + 1.4 * nas);
    }
    const f0 = interpTrack(o.f0, u)[0] * (1 + (o.vib || 0.012) * Math.sin(2 * Math.PI * (o.vibHz || 5.5) * t));
    ph += f0 * (1 + jit) / sr;
    if (ph >= 1) {
      ph -= 1;
      jit = (rnd() * 2 - 1) * jitAmt;
      shim = 1 + (rnd() * 2 - 1) * shimAmt;
      if (o.rough) sub = rnd() < o.rough ? 1 - sub : sub;
    }
    let g = lfPulse(ph, oq, sq, ta) * shim * (sub ? 1 - (o.subDepth || 0.45) : 1);
    // aspiration leaks through mostly while the folds are apart
    const voiced = o.voiced === undefined ? 1 : interpTrack(o.voiced, u)[0];
    let x = (g * voiced + (rnd() * 2 - 1) * (o.breath || 0.05) * (ph < oq ? 1 : 0.25)) * interpTrack(o.amp, u)[0];
    if (o.am) x *= 1 - o.am.depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * o.am.hz * t));
    // nasal zero then nasal pole
    const zy = zc[0] * x + zc[1] * zx1 + zc[2] * zx2;
    zx2 = zx1; zx1 = x;
    x = nc[0] * zy + nc[1] * np[0] + nc[2] * np[1];
    np[1] = np[0]; np[0] = x;
    for (let k = 0; k < coef.length; k++) {
      const [A, B, C] = coef[k];
      const y = A * x + B * st[k][0] + C * st[k][1];
      st[k][1] = st[k][0]; st[k][0] = y; x = y;
    }
    hpOut = 0.995 * (hpOut + x - hpPrev); hpPrev = x;    // block DC only
    out[i] = hpOut;
  }
  return normalise(out, o.gain || 0.8);
}
function normalise(a, peak) { let m = 1e-9; for (const v of a) m = Math.max(m, Math.abs(v)); const k = peak / m; for (let i = 0; i < a.length; i++) a[i] *= k; return a; }

// A cat's tract is short, so its formants sit high and far apart, and with an
// F0 up around 700 Hz only a handful of harmonics fall under the first one.
const VOWEL = { m: [430, 1500, 2900, 4100], i: [600, 2500, 3500, 4600], a: [1050, 1750, 3150, 4300], u: [540, 1150, 3000, 4100], e: [800, 2050, 3300, 4400] };
const trk = (pairs) => pairs.map(([t, v]) => [t, ...VOWEL[v]]);

// ---- the room --------------------------------------------------------------
// Anything synthesised and played back dry sounds synthetic however good the
// synthesis is, because no real sound ever reaches an ear without the room
// around it. A few early reflections off the floor and the near wall, then a
// short diffuse tail that loses its top end as it decays.
function roomIR(sr) {
  const n = Math.floor(0.4 * sr), ir = new Float32Array(n);
  const rnd = mulberry(99);
  for (const [t, g] of [[0.0072, 0.5], [0.0129, -0.36], [0.0191, 0.28], [0.0264, -0.22], [0.0347, 0.17]]) {
    const i = Math.floor(t * sr); if (i < n) ir[i] += g;
  }
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    lp += ((rnd() * 2 - 1) - lp) * 0.34;
    ir[i] += lp * Math.exp(-t / 0.075) * Math.min(1, t / 0.004) * 0.4;
  }
  return ir;
}
// the other ear hears a different set of reflections off the same room
function roomIR2(sr) {
  const n = Math.floor(0.4 * sr), ir = new Float32Array(n);
  const rnd = mulberry(1733);
  for (const [t, g] of [[0.0081, 0.47], [0.0118, -0.34], [0.0207, 0.3], [0.0251, -0.2], [0.0362, 0.18]]) {
    const i = Math.floor(t * sr); if (i < n) ir[i] += g;
  }
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    lp += ((rnd() * 2 - 1) - lp) * 0.34;
    ir[i] += lp * Math.exp(-t / 0.075) * Math.min(1, t / 0.004) * 0.4;
  }
  return ir;
}

// ---- the purr --------------------------------------------------------------
// Not a tone: a train of laryngeal pulses at around 25 Hz, each one a short
// damped resonance of the larynx and the chest, running right through both the
// in-breath and the out-breath with a different colour on each. The ragged
// spacing of the pulses is a good part of why a real purr sounds alive.
function purrLoop(sr, seed) {
  const dur = 6.4, n = Math.floor(dur * sr), a = new Float32Array(n);
  const rnd = mulberry(seed);
  const lar = resoCoef(168, 95, sr), chest = resoCoef(430, 240, sr);
  const s1 = [0, 0], s2 = [0, 0];
  const exc = new Float32Array(n);
  let t = 0;
  while (t < dur) {
    const inhale = t > 3.45;
    const f = (inhale ? 22.5 : 26.5) * (1 + (rnd() * 2 - 1) * 0.08);
    const i0 = Math.floor(t * sr);
    const len = Math.floor(0.0045 * sr);
    for (let k = 0; k < len && i0 + k < n; k++) {
      const e = 1 - k / len;
      exc[i0 + k] += ((rnd() * 2 - 1) * 0.55 + (k === 0 ? 1 : 0)) * e * e * (inhale ? 0.72 : 1);
    }
    t += 1 / f;
  }
  for (let i = 0; i < n; i++) {
    const tt = i / sr;
    // one breath cycle per loop, fading to nothing at the seam so it tiles
    const env = tt < 3.45 ? Math.sin(Math.PI * tt / 3.45) ** 0.55 : Math.sin(Math.PI * (tt - 3.45) / 2.95) ** 0.55 * 0.72;
    const x = exc[i];
    const y1 = lar[0] * x + lar[1] * s1[0] + lar[2] * s1[1]; s1[1] = s1[0]; s1[0] = y1;
    const y2 = chest[0] * x + chest[1] * s2[0] + chest[2] * s2[1]; s2[1] = s2[0]; s2[0] = y2;
    a[i] = (y1 + y2 * 0.55) * env;
  }
  return normalise(a, 0.9);
}

// ---- the calls -------------------------------------------------------------
// Each call is synthesised three times from different seeds and with its pitch
// and timing nudged, because hearing the identical waveform twice is the
// fastest way to stop believing in an animal.
// Returned as a list of jobs rather than a finished set, because synthesising
// everything takes about a second and doing it in one go would freeze the page
// on the very click that starts the scene. Ordered so the calls the cat makes
// soonest are ready first.
function synthJobs(sr) {
  const J = [];
  const variants = (name, n, make) => { for (let v = 0; v < n; v++) J.push({ name, make: () => make(v) }); };
  // nasal 1 at the ends: a meow is a hum that opens into a vowel and shuts again
  const meowNasal = [[0, 1], [0.1, 0.75], [0.22, 0], [0.74, 0], [0.9, 0.8], [1, 1]];
  variants('meow', 3, (v) => {
    const k = 1 + (v - 1) * 0.045;
    return voice(sr, { dur: 0.78 + v * 0.05, seed: 3 + v * 17,
      f0: [[0, 540 * k], [0.3, 760 * k], [0.72, 690 * k], [1, 470 * k]],
      formants: trk([[0, 'm'], [0.2, 'e'], [0.4, 'a'], [0.64, 'a'], [0.88, 'u'], [1, 'm']]),
      nasal: meowNasal,
      amp: [[0, 0], [0.05, 0.45], [0.28, 1], [0.7, 0.86], [0.92, 0.3], [1, 0]],
      breath: 0.05, rough: 0.05, jit: 0.02 });
  });
  variants('meowShort', 3, (v) => {
    const k = 1 + (v - 1) * 0.05;
    return voice(sr, { dur: 0.4 + v * 0.03, seed: 5 + v * 23,
      f0: [[0, 680 * k], [0.3, 830 * k], [1, 610 * k]],
      formants: trk([[0, 'm'], [0.22, 'e'], [0.5, 'a'], [1, 'm']]),
      nasal: [[0, 1], [0.16, 0], [0.7, 0], [1, 1]],
      amp: [[0, 0], [0.08, 0.7], [0.4, 1], [0.85, 0.4], [1, 0]], jit: 0.022 });
  });
  variants('meowLong', 2, (v) => voice(sr, { dur: 1.15 + v * 0.08, seed: 9 + v * 31,
    f0: [[0, 505], [0.25, 700], [0.6, 715], [1, 440]],
    formants: trk([[0, 'm'], [0.16, 'i'], [0.34, 'a'], [0.7, 'a'], [0.9, 'u'], [1, 'm']]),
    nasal: [[0, 1], [0.12, 0], [0.8, 0], [1, 1]],
    amp: [[0, 0], [0.05, 0.4], [0.3, 1], [0.75, 0.9], [0.95, 0.2], [1, 0]], vib: 0.02, rough: 0.07 }));
  variants('mew', 3, (v) => {
    const k = 1 + (v - 1) * 0.06;
    return voice(sr, { dur: 0.26, seed: 11 + v * 13,
      f0: [[0, 850 * k], [0.4, 960 * k], [1, 790 * k]],
      formants: trk([[0, 'm'], [0.3, 'e'], [0.7, 'i'], [1, 'u']]),
      nasal: [[0, 0.9], [0.25, 0], [0.8, 0.4], [1, 0.7]],
      amp: [[0, 0], [0.12, 0.9], [0.6, 1], [1, 0]], gain: 0.6, jit: 0.025 });
  });
  variants('annoyed', 2, (v) => voice(sr, { dur: 0.55 + v * 0.05, seed: 13 + v * 19,
    f0: [[0, 360], [0.4, 440], [1, 320]],
    formants: trk([[0, 'm'], [0.25, 'a'], [0.7, 'a'], [1, 'u']]),
    nasal: [[0, 0.8], [0.2, 0], [1, 0.5]],
    amp: [[0, 0], [0.1, 0.8], [0.5, 1], [1, 0]], rough: 0.5, subDepth: 0.5, breath: 0.14, jit: 0.04 }));
  // a trill is made with the mouth shut throughout: it is a hum, not a call
  variants('trill', 3, (v) => voice(sr, { dur: 0.42 + v * 0.04, seed: 17 + v * 29,
    f0: [[0, 455 + v * 20], [1, 720 + v * 25]],
    formants: trk([[0, 'm'], [0.6, 'm'], [1, 'u']]),
    nasal: [[0, 1], [1, 0.85]],
    amp: [[0, 0], [0.12, 0.8], [0.7, 1], [1, 0]],
    am: { hz: 24 + v * 2, depth: 0.8 }, gain: 0.55, jit: 0.015 }));
  variants('chirp', 3, (v) => voice(sr, { dur: 0.16, seed: 19 + v * 7,
    f0: [[0, 700 + v * 40], [1, 1120 + v * 60]],
    formants: trk([[0, 'e'], [1, 'i']]),
    nasal: [[0, 0.5], [0.4, 0], [1, 0.3]],
    amp: [[0, 0], [0.2, 1], [0.7, 0.7], [1, 0]], gain: 0.55, jit: 0.03 }));
  variants('growl', 2, (v) => voice(sr, { dur: 1.1 + v * 0.1, seed: 23 + v * 11,
    f0: [[0, 130], [0.5, 148], [1, 120]],
    formants: trk([[0, 'e'], [0.5, 'a'], [1, 'u']]),
    amp: [[0, 0], [0.1, 0.8], [0.8, 1], [1, 0]],
    am: { hz: 28, depth: 0.55 }, rough: 0.75, subDepth: 0.55, breath: 0.5, jit: 0.055,
    gain: 0.5, bw: [180, 240, 320, 400] }));
  variants('yawn', 2, (v) => voice(sr, { dur: 1.5 + v * 0.12, seed: 29 + v * 23,
    f0: [[0, 880], [0.25, 1150], [0.7, 740], [1, 500]],
    formants: trk([[0, 'i'], [0.2, 'a'], [0.75, 'a'], [1, 'u']]),
    amp: [[0, 0], [0.15, 0.8], [0.5, 0.6], [0.85, 0.25], [1, 0]],
    voiced: [[0, 0.7], [0.6, 0.5], [0.85, 0.1], [1, 0]], breath: 0.38, gain: 0.45 }));
  // chatter: the stuttering run of chirps and jaw clicks aimed at prey
  variants('chatter', 2, (v) => {
    const n = Math.floor(0.95 * sr), a = new Float32Array(n);
    for (let k = 0; k < 8; k++) {
      const c = voice(sr, { dur: 0.055, seed: 31 + k + v * 101,
        f0: [[0, 900 + k * 12], [1, 1050]], formants: trk([[0, 'e'], [1, 'i']]),
        amp: [[0, 0], [0.3, 1], [1, 0]], gain: 0.35, jit: 0.04 });
      const off = Math.floor((0.05 + k * 0.11 + (v ? 0.008 : 0)) * sr);
      for (let i = 0; i < c.length && off + i < n; i++) a[off + i] += c[i];
      const r = mulberry(80 + k + v * 7);
      for (let i = 0; i < 0.006 * sr; i++) a[off + i] += (r() * 2 - 1) * 0.25 * (1 - i / (0.006 * sr));
    }
    return normalise(a, 0.45);
  });
  variants('purr', 1, () => purrLoop(sr, 41));
  const thump = (dur, f, noise, seed) => {
    const n = Math.floor(dur * sr), a = new Float32Array(n); const r = mulberry(seed);
    let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; const e = Math.exp(-t / (dur * 0.25)); const ec = Math.exp(-t / 0.006); lp += ((r() * 2 - 1) - lp) * 0.45; a[i] = (Math.sin(2 * Math.PI * f * t * (1 - t * 2)) * 0.6 + lp * noise * 0.6) * e + (r() * 2 - 1) * 0.5 * ec; }
    return normalise(a, 0.7);
  };
  variants('bounce', 2, (v) => thump(0.12, 190 + v * 25, 0.6, 51 + v * 9));
  variants('land', 2, (v) => thump(0.2, 85 + v * 10, 0.9, 53 + v * 9));
  variants('hop', 2, (v) => thump(0.1, 120 + v * 14, 1.4, 57 + v * 9));
  // A paw landing is not a thump. It is a very short, soft, almost toneless
  // contact, and the surface decides nearly all of it: boards give a little
  // top end and a trace of claw, a wool rug swallows the lot.
  const pawStep = (o) => {
    const n = Math.floor(o.dur * sr), a = new Float32Array(n), r = mulberry(o.seed);
    const k = 1 - Math.exp(-2 * Math.PI * o.cut / sr);
    let lp1 = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.exp(-t / o.decay) * Math.min(1, t / 0.0008);
      lp1 += ((r() * 2 - 1) - lp1) * k; lp2 += (lp1 - lp2) * k;   // two poles, so it is properly dull
      let y = lp2 * env;
      if (o.body) y += Math.sin(2 * Math.PI * o.body * t) * Math.exp(-t / (o.decay * 0.5)) * 0.22;
      if (o.tick) y += (r() * 2 - 1) * Math.exp(-t / 0.0022) * o.tick;
      a[i] = y;
    }
    return normalise(a, 0.7);
  };
  variants('stepFloor', 3, (v) => pawStep({ dur: 0.09, decay: 0.012, cut: 1100, body: 150 + v * 18, tick: 0.18, seed: 211 + v * 13 }));
  variants('stepRug', 3, (v) => pawStep({ dur: 0.10, decay: 0.020, cut: 520, seed: 231 + v * 13 }));
  variants('stepSofa', 2, (v) => pawStep({ dur: 0.12, decay: 0.028, cut: 380, seed: 251 + v * 13 }));
  // the clockwork: gear teeth at 46 Hz through the rattle of a plastic shell.
  // One second holds a whole number of teeth, so the loop does not click.
  variants('whirr', 1, () => {
    const n = sr, a = new Float32Array(n), r = mulberry(601);
    const g1 = resoCoef(380, 230, sr), g2 = resoCoef(1250, 500, sr);
    const s1 = [0, 0], s2 = [0, 0];
    let ph = 0;
    for (let i = 0; i < n; i++) {
      ph += 46 / sr; if (ph >= 1) ph -= 1;
      const x = (ph < 0.17 ? 0.9 : 0.0) + (r() * 2 - 1) * 0.4;
      const y1 = g1[0] * x + g1[1] * s1[0] + g1[2] * s1[1]; s1[1] = s1[0]; s1[0] = y1;
      const y2 = g2[0] * x + g2[1] * s2[0] + g2[2] * s2[1]; s2[1] = s2[0]; s2[0] = y2;
      a[i] = y1 + y2 * 0.45;
    }
    return normalise(a, 0.55);
  });
  const rank = { trill: 0, mew: 1, meowShort: 2, stepRug: 3, stepFloor: 3, whirr: 3, purr: 4, meow: 5, chirp: 6, stepSofa: 6, land: 7, hop: 7, bounce: 7 };
  return J.map((j, i) => [j, (rank[j.name] === undefined ? 9 : rank[j.name]) * 100 + i])
    .sort((a, b) => a[1] - b[1]).map(([j]) => j);
}
// everything at once; used by the offline analysis harness
function synthAll(sr) {
  const B = {};
  for (const j of synthJobs(sr)) (B[j.name] = B[j.name] || []).push(j.make());
  return B;
}

function initAudio() {
  if (AUDIO.ctx) { AUDIO.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  AUDIO.ctx = ctx;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3;
  AUDIO.master = ctx.createGain(); AUDIO.master.gain.value = 0.9;
  AUDIO.master.connect(comp); comp.connect(ctx.destination);
  // the room the cat is actually in, as a short convolution everything is sent to
  const ir = roomIR(ctx.sampleRate);
  const irBuf = ctx.createBuffer(2, ir.length, ctx.sampleRate);
  irBuf.copyToChannel(ir, 0);
  irBuf.copyToChannel(roomIR2(ctx.sampleRate), 1);   // decorrelated, so the tail has width
  AUDIO.verb = ctx.createConvolver(); AUDIO.verb.buffer = irBuf;
  AUDIO.verbGain = ctx.createGain(); AUDIO.verbGain.gain.value = 0.9;
  AUDIO.verb.connect(AUDIO.verbGain); AUDIO.verbGain.connect(AUDIO.master);
  AUDIO.purrGain = ctx.createGain(); AUDIO.purrGain.gain.value = 0;
  AUDIO.purrGain.connect(AUDIO.master);
  // a few milliseconds of synthesis per turn, so the click that starts the
  // scene does not sit on a frozen page; a call stays silent until its first
  // take has been made
  const jobs = synthJobs(ctx.sampleRate);
  const run = () => {
    const t0 = performance.now();
    while (jobs.length && performance.now() - t0 < 6) {
      const j = jobs.shift();
      const a = j.make();
      const b = ctx.createBuffer(1, a.length, ctx.sampleRate);
      b.copyToChannel(a, 0);
      (AUDIO.bufs[j.name] = AUDIO.bufs[j.name] || []).push(b);
      if (j.name === 'purr' && !AUDIO.purrSrc) {
        const src = ctx.createBufferSource();
        src.buffer = b; src.loop = true; src.connect(AUDIO.purrGain); src.start();
        AUDIO.purrSrc = src;
        AUDIO.purrGain.gain.setTargetAtTime(AUDIO.on ? CAT.purr * 0.55 : 0, ctx.currentTime, 0.4);
      }
    }
    if (jobs.length) setTimeout(run, 0); else SOUNDS.ready = true;
  };
  AUDIO.on = true;
  run();
}
function setSound(on) {
  AUDIO.on = on;
  if (AUDIO.master) AUDIO.master.gain.setTargetAtTime(on ? 0.9 : 0, AUDIO.ctx.currentTime, 0.05);
}
// where a sound sits left to right, from where the camera is standing
function panOf(p) {
  const to = v3.sub(p, R.camPos);
  const l = v3.len(to);
  if (l < 1e-4) return 0;
  const right = v3.cross(v3.norm(v3.sub(CAM.target, R.camPos)), [0, 1, 0]);
  const rl = v3.len(right);
  if (rl < 1e-4) return 0;
  return clamp(v3.dot(v3.mul(to, 1 / l), v3.mul(right, 1 / rl)) * 1.6, -1, 1);
}
SOUNDS.play = function (kind, opts = {}) {
  if (!AUDIO.ctx || !AUDIO.on) return { scale: 1, stretch: 1 };
  let name = kind;
  if (kind === 'meowShort' && opts.annoyed) name = 'annoyed';
  const set = AUDIO.bufs[name];
  if (!set || !set.length) return { scale: 1, stretch: 1 };
  const ctx = AUDIO.ctx;
  const src = ctx.createBufferSource();
  src.buffer = pick(set);                              // never the same take twice running
  const rate = opts.rate || (['bounce', 'land', 'hop'].includes(kind) ? rand(0.95, 1.05) : rand(0.94, 1.07));
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  const vol = { bounce: clamp((opts.v || 1) / 4, 0.1, 0.8), land: 0.5, hop: 0.3, growl: 0.55, chatter: 0.5, purr: 0 }[kind];
  g.gain.value = opts.gain !== undefined ? opts.gain : (vol === undefined ? 0.85 : vol);
  // a footfall comes from the paw, everything else from the cat
  const at = opts.pos || CAT.pos;
  const d = v3.dist(R.camPos, at);
  g.gain.value *= clamp(1.4 / (0.6 + d), 0.25, 1.3);
  src.connect(g);
  let out = g;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = panOf(at);
    g.connect(p); out = p;
  }
  out.connect(AUDIO.master);
  if (AUDIO.verb) {
    const send = ctx.createGain();
    // the further off it is, the more of what you hear is the room
    send.gain.value = g.gain.value * clamp(0.1 + d * 0.22, 0.1, 0.5);
    out.connect(send); send.connect(AUDIO.verb);
  }
  src.start();
  return { scale: 1, stretch: 1 / rate };
};
SOUNDS.whirr = function (level, pos) {
  if (!AUDIO.ctx) return;
  if (!AUDIO.whirrGain) {
    const set = AUDIO.bufs.whirr;
    if (!set || !set.length) return;
    AUDIO.whirrGain = AUDIO.ctx.createGain(); AUDIO.whirrGain.gain.value = 0;
    AUDIO.whirrPan = AUDIO.ctx.createStereoPanner ? AUDIO.ctx.createStereoPanner() : null;
    if (AUDIO.whirrPan) { AUDIO.whirrGain.connect(AUDIO.whirrPan); AUDIO.whirrPan.connect(AUDIO.master); }
    else AUDIO.whirrGain.connect(AUDIO.master);
    const src = AUDIO.ctx.createBufferSource();
    src.buffer = set[0]; src.loop = true; src.connect(AUDIO.whirrGain); src.start();
    AUDIO.whirrSrc = src;
  }
  const d = pos ? v3.dist(R.camPos, pos) : 1;
  AUDIO.whirrGain.gain.setTargetAtTime(AUDIO.on ? level * 0.20 * clamp(1.4 / (0.6 + d), 0.25, 1.3) : 0, AUDIO.ctx.currentTime, 0.05);
  if (AUDIO.whirrPan && pos) AUDIO.whirrPan.pan.setTargetAtTime(panOf(pos), AUDIO.ctx.currentTime, 0.05);
  if (AUDIO.whirrSrc) AUDIO.whirrSrc.playbackRate.setTargetAtTime(0.85 + 0.35 * level, AUDIO.ctx.currentTime, 0.08);
};
SOUNDS.step = function (surface, strength, pos) {
  SOUNDS.play('step' + surface, { gain: 0.30 * strength, pos, rate: rand(0.86, 1.16) });
};
SOUNDS.purr = function (level) {
  if (!AUDIO.ctx || !AUDIO.purrGain) return;
  AUDIO.purrGain.gain.setTargetAtTime(AUDIO.on ? level * 0.55 : 0, AUDIO.ctx.currentTime, 0.4);
};

// ---------------------------------------------------------------- UI wiring
const UI = {
  status: document.getElementById('status'),
  hint: document.getElementById('hint'),
  snd: document.getElementById('snd'),
  sndLabel: document.getElementById('sndLabel'),
  jumpLabel: document.getElementById('jumpLabel'),
  sleepLabel: document.getElementById('sleepLabel'),
  laser: document.getElementById('aLaser'),
  laserLabel: document.getElementById('laserLabel'),
  mouse: document.getElementById('aMouse'),
  mouseLabel: document.getElementById('mouseLabel'),
  start: document.getElementById('start'),
};
CAT.onStatus = (s) => { UI.status.textContent = s; };
function hideHintSoon() { setTimeout(() => UI.hint.classList.add('gone'), 3500); }
function setSoundUI(on) {
  UI.snd.setAttribute('aria-pressed', on ? 'true' : 'false');
  UI.sndLabel.textContent = on ? '声音开' : '声音关';
}
function enterScene(withSound) {
  UI.start.hidden = true;
  if (withSound) { initAudio(); setSound(true); }
  setSoundUI(withSound);
  hideHintSoon();
  CAT.look.target = R.camPos.slice();
  setTimeout(() => CAT.say('trill'), 500);
}
document.getElementById('goSound').addEventListener('click', () => enterScene(true));
document.getElementById('goMute').addEventListener('click', () => enterScene(false));
UI.snd.addEventListener('click', () => {
  if (!AUDIO.ctx) { initAudio(); setSound(true); setSoundUI(true); return; }
  const on = !AUDIO.on;
  if (on && AUDIO.ctx.state !== 'running') AUDIO.ctx.resume();
  setSound(on); setSoundUI(on);
  if (on && CAT.purr > 0) SOUNDS.purr(CAT.purr);
});
const bind = (id, fn) => document.getElementById(id).addEventListener('click', () => { if (AUDIO.ctx && AUDIO.ctx.state !== 'running' && AUDIO.on) AUDIO.ctx.resume(); UI.hint.classList.add('gone'); fn(); });
bind('aBall', () => ACTIONS.fetch());
bind('aCall', () => ACTIONS.call());
bind('aRoll', () => ACTIONS.roll());
bind('aSleep', () => { if (CAT.sleeping) ACTIONS.call(); else ACTIONS.sleep(); });
bind('aJump', () => ACTIONS.jump());
bind('aSit', () => ACTIONS.sit());
bind('aLaser', () => ACTIONS.laser());
bind('aMouse', () => ACTIONS.mouse());
INPUT.onFirst = () => { UI.hint.classList.add('gone'); };
document.addEventListener('visibilitychange', () => { if (!AUDIO.ctx) return; if (document.hidden) AUDIO.ctx.suspend(); else if (AUDIO.on) AUDIO.ctx.resume(); });
function syncButtons() {
  UI.laser.setAttribute('aria-pressed', LASER.on ? 'true' : 'false');
  UI.mouse.setAttribute('aria-pressed', MOUSE.out ? 'true' : 'false');
  const ml = !MOUSE.out ? '机械鼠' : MOUSE.wind > 0.01 ? '收起来' : '再上弦';
  if (UI.mouseLabel.textContent !== ml) UI.mouseLabel.textContent = ml;
  const ll = LASER.on ? '关激光' : '激光笔';
  if (UI.laserLabel.textContent !== ll) UI.laserLabel.textContent = ll;
  const jl = PERCHES[CAT.level] ? '跳下来' : '跳上' + PERCHES[nearestPerch()].label;
  if (UI.jumpLabel.textContent !== jl) UI.jumpLabel.textContent = jl;
  const sl = CAT.sleeping ? '叫醒' : '睡觉';
  if (UI.sleepLabel.textContent !== sl) UI.sleepLabel.textContent = sl;
}

// ---------------------------------------------------------------- main loop
function catContactPos() { return CAT.contactPos(); }
const TEST = /[?&]test=1/.test(location.search);
let noResize = false;
function resize() {
  if (noResize) return;
  const dpr = Math.min(window.devicePixelRatio || 1, QUALITY.dprMax);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}
function focusPoint() {
  const p = SK.wp[BI('spine2')];
  return [p[0], p[1] - 0.03, p[2]];
}
function step(dt) {
  FRAME_NO++;
  updateMouse(dt);
  LASER.shown = expDecay(LASER.shown, LASER.on ? 1 : 0, 12, dt);
  if (LASER.on) {
    // no hand holds a laser perfectly still, and the shake is most of why a cat
    // believes in it
    LASER.p[0] += fnoise(CAT.time * 3.1, 301) * 0.0018;
    LASER.p[2] += fnoise(CAT.time * 2.7, 302) * 0.0018;
  }
  CAT.update(dt);
  updateBall(dt);
  CAM.update(dt, focusPoint());
  SCENE.time = CAT.time;
}
function draw() {
  resize();
  CAM.matrices(canvas.width / canvas.height);
  SK.upload();
  renderShadow();
  renderScene(canvas.width, canvas.height);
}
// adaptive quality
const PERF = { acc: 0, n: 0, settled: false };
function adapt(dt) {
  if (PERF.settled) return;
  PERF.acc += dt; PERF.n++;
  if (PERF.n >= 60) {
    const avg = PERF.acc / PERF.n;
    PERF.acc = 0; PERF.n = 0;
    if (avg > 0.030 && (R.shells > 12 || QUALITY.dprMax > 1)) {
      if (R.shells > 16) R.shells -= 6; else if (QUALITY.dprMax > 1.0) QUALITY.dprMax = Math.max(1.0, QUALITY.dprMax - 0.35); else R.shells = Math.max(12, R.shells - 4);
    } else if (avg < 0.024) PERF.settled = true;
  }
}
let lastT = 0;
function loop(now) {
  if (GL_LOST) return;
  const dt = lastT ? Math.min((now - lastT) / 1000, 1 / 20) : 1 / 60;
  lastT = now;
  step(dt);
  draw();
  syncButtons();
  adapt(dt);
  requestAnimationFrame(loop);
}
// initial state: standing on the rug, looking at the viewer
CAT.from = poseCopy(POSES.stand); CAT.to = POSES.stand; CAT.bt = 1;
if (canvas.clientWidth / Math.max(1, canvas.clientHeight) < 0.8) { CAM.dist = CAM.tDist = 0.98; }
step(1 / 60); step(1 / 60);
document.getElementById('loading').hidden = true;
if (!TEST) requestAnimationFrame(loop);

// Harness hooks: only attached when the page is opened with ?test=1, so the
// published page carries no scripted control surface.
if (TEST) { window.__step1 = (dt) => { step(dt); };
window.__test = {
  async step(n, dt = 1 / 30) { for (let i = 0; i < n; i++) { step(dt); await new Promise((r) => setTimeout(r, 0)); } return CAT.status; },
  step1(dt = 1 / 30) { step(dt); return CAT.status; },
  draw() { draw(); gl.finish(); return 'ok'; },
  cam(az, el, dist, tx, ty, tz) { CAM.az = CAM.tAz = az; CAM.el = CAM.tEl = el; CAM.dist = CAM.tDist = dist; if (tx !== undefined) CAM.target = [tx, ty, tz]; },
  act(name, arg) { ACTIONS[name](arg); return name; },
  say(k) { CAT.say(k); return k; },
  blep(v) { CAT.tongueT = v; return v; },
  // test-only: evaluate in module scope so probes can read renderer state
  dbg(code) { return eval(code); },
  worldOf() {
    const g = (n) => SK.wp[BI(n)].map((v) => +v.toFixed(4));
    return { head: g('head'), jaw: g('jaw'), nose: SK.pointOn(BI('head'), META.mouth.upper[0]).map((v) => +v.toFixed(4)),
      tongue: SK.pointOn(BI('jaw'), META.mouth.tongue).map((v) => +v.toFixed(4)),
      eyeL: SK.pointOn(BI('head'), META.eyeL).map((v) => +v.toFixed(4)), yaw: +CAT.yaw.toFixed(3), pos: CAT.pos.map((v) => +v.toFixed(3)) };
  },
  screenOf(bone, off) {
    const w = SK.pointOn(BI(bone), v3.add(SK.rest[BI(bone)], off || [0, 0, 0]));
    const c = M4.point(R.vp, w);
    const rect = canvas.getBoundingClientRect();
    return [rect.left + (c[0] * 0.5 + 0.5) * rect.width, rect.top + (1 - (c[1] * 0.5 + 0.5)) * rect.height];
  },
  walk(x, z, speed) { CAT.run('testwalk', async (tok) => { await CAT.moveTo([x, 0, z], speed, tok, 0.02); }); return 'walk'; },
  place(x, z, yaw) { CAT.pos = [x, 0, z]; CAT.yaw = yaw; CAT.groundY = supportY(x, z, CAT); return 'ok'; },
  fixCam(az, el, dist, tx, ty, tz) { CAM.update = function () {}; CAM.az = az; CAM.el = el; CAM.dist = dist; CAM.target = [tx, ty, tz]; return 'ok'; },
  async pose(name) { CAT.run('test', async (tok) => { await CAT.toPose(name, 0.01, tok); }); for (let i = 0; i < 3; i++) { step(1 / 30); await new Promise((r) => setTimeout(r, 0)); } return name; },
  state() { return { pos: CAT.pos, yaw: CAT.yaw, mode: CAT.mode, pose: CAT.poseName, busy: CAT.busy, status: CAT.status, level: CAT.level, ball: BALL.p, held: BALL.held }; },
  pet(region) { const hit = { region, point: SK.wp[BI(region === 'belly' ? 'spine1' : 'head')], side: 1 }; petBegin(hit); return 'pet'; },
  async sheetPoses(items, cols, w, h) {
    noResize = true;
    const rows = Math.ceil(items.length / cols);
    const sheet = document.createElement('canvas'); sheet.width = w * cols; sheet.height = h * rows;
    const ctx = sheet.getContext('2d');
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; canvas.width = w; canvas.height = h;
    CAM.update = function () {};
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      CAT.run('test', async (tok) => { await CAT.toPose(it.pose, 0.01, tok); });
      CAT.lookFn = null; CAT.look.target = null; CAT.look.w = 0; CAT.look.yaw = 0; CAT.look.pitch = 0;
      CAT.tail.ph = 0;
      for (let k = 0; k < 4; k++) { step(1 / 30); await new Promise((r) => setTimeout(r, 0)); }
      const f = focusPoint();
      CAM.az = it.cam[0]; CAM.el = it.cam[1]; CAM.dist = it.cam[2]; CAM.target = [f[0], it.cam[3] !== undefined ? it.cam[3] : f[1], f[2]];
      draw();
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      ctx.putImageData(img, (i % cols) * w, Math.floor(i / cols) * h);
      ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.fillText(it.pose + ' ' + it.cam.join(','), (i % cols) * w + 8, Math.floor(i / cols) * h + 20);
    }
    canvas.style.display = 'none';
    for (const el of document.querySelectorAll('.hud,.dock,.hint,.start')) el.style.display = 'none';
    sheet.style.position = 'fixed'; sheet.style.left = '0'; sheet.style.top = '0'; sheet.style.zIndex = '20';
    document.body.appendChild(sheet);
    return 'sheet';
  },
  // contact strip driven by a spec object: run the sim, fire events at given
  // cells, grab one frame per cell and composite them into a single canvas
  async sheetFrames2(spec) {
    noResize = true;
    const { cols, w, h, cells, stepsPerCell, dt = 1 / 30, events = [] } = spec;
    const rows = Math.ceil(cells / cols);
    const sheet = document.createElement('canvas');
    sheet.width = w * cols; sheet.height = h * rows;
    const ctx = sheet.getContext('2d');
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; canvas.width = w; canvas.height = h;
    const px = new Uint8Array(w * h * 4);
    for (let i = 0; i < cells; i++) {
      for (const [cell, code] of events) if (cell === i) (0, eval)(code);
      for (let k = 0; k < stepsPerCell; k++) { step(dt); await new Promise((r) => setTimeout(r, 0)); }
      draw();
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      ctx.putImageData(img, (i % cols) * w, Math.floor(i / cols) * h);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect((i % cols) * w, Math.floor(i / cols) * h, 58, 20);
      ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
      ctx.fillText(((i + 1) * stepsPerCell * dt).toFixed(2) + 's', (i % cols) * w + 6, Math.floor(i / cols) * h + 15);
    }
    return sheet.toDataURL('image/png');
  },
  async sheetFrames(steps, cols, w, h, camFn) {
    // run the sim, capture frames every `steps[i]` sim steps
    noResize = true;
    const rows = Math.ceil(steps.length / cols);
    const sheet = document.createElement('canvas'); sheet.width = w * cols; sheet.height = h * rows;
    const ctx = sheet.getContext('2d');
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; canvas.width = w; canvas.height = h;
    for (let i = 0; i < steps.length; i++) {
      const n = steps[i];
      for (let k = 0; k < n; k++) { step(1 / 30); await new Promise((r) => setTimeout(r, 0)); }
      if (camFn) camFn(i);
      draw();
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      ctx.putImageData(img, (i % cols) * w, Math.floor(i / cols) * h);
      ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.fillText((i + 1) + ': ' + CAT.status + ' [' + CAT.poseName + '/' + CAT.mode + ']', (i % cols) * w + 8, Math.floor(i / cols) * h + 20);
    }
    canvas.style.display = 'none';
    for (const el of document.querySelectorAll('.hud,.dock,.hint,.start')) el.style.display = 'none';
    sheet.style.position = 'fixed'; sheet.style.left = '0'; sheet.style.top = '0'; sheet.style.zIndex = '20';
    document.body.appendChild(sheet);
    return 'sheet';
  },
};
}
window.__ready = true;

})();
