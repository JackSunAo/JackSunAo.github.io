/* Character concept painter. A pose drives a 2D skeleton seen in three-quarter view; the body, clothes and props are
   built as paths over it and painted far to near with cel shading (a shadow side, a lit side, a hot edge toward the key
   light, a cold moon rim on the dark edge) and an ink line, then rain, fog and grain go on top.
   One painter for every plate, so every figure shares proportions and light. */
(function () {
'use strict';
const RAD = Math.PI / 180;
const V = (x, y) => ({ x, y });
const add = (a, b) => V(a.x + b.x, a.y + b.y), sub = (a, b) => V(a.x - b.x, a.y - b.y), mul = (a, k) => V(a.x * k, a.y * k);
const len = a => Math.hypot(a.x, a.y), norm = a => { const l = len(a) || 1; return V(a.x / l, a.y / l); }, perp = a => V(-a.y, a.x);
const lerpV = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const rot = (a, t) => V(a.x * Math.cos(t) - a.y * Math.sin(t), a.x * Math.sin(t) + a.y * Math.cos(t));
const dir = deg => V(Math.sin(deg * RAD), Math.cos(deg * RAD)); // 0° hangs straight down, 90° points +x
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => clamp(Math.round(v + (B[i] - v) * t), 0, 255).toString(16).padStart(2, '0')).join(''); }
function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function shade(hex, k) { return k < 1 ? mix(hex, '#000000', 1 - k) : mix(hex, '#ffffff', k - 1); }
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

/* ---------- light ----------
   L.key: unit vector toward the key light; keyCol/keyAmt its colour and strength; ambCol the shadow fill;
   rim/rimAmt the cold moon on the dark edges; ink the outline width */
function tone(base, side, L) { // side: -1 deep shadow … 0 base … +1 hot edge
  if (side >= 0) return mix(base, mix(base, L.keyCol, 0.42), side * L.keyAmt);
  return mix(base, mix(shade(base, 0.38), L.ambCol, 0.3), -side);
}
/* ---------- paths ---------- */
function capPath(A, B, rA, rB, bf = 0, bb = 0, at = 0.45) { // tapered capsule A→B; bf bows the +n side out, bb the -n side
  const p = new Path2D(), u = norm(sub(B, A)), n = perp(u), m = lerpV(A, B, at), rm = rA + (rB - rA) * at, aN = Math.atan2(n.y, n.x);
  p.moveTo(A.x + n.x * rA, A.y + n.y * rA);
  const c1 = add(m, mul(n, rm + bf)); p.quadraticCurveTo(c1.x, c1.y, B.x + n.x * rB, B.y + n.y * rB);
  p.arc(B.x, B.y, rB, aN, aN - Math.PI, true);
  const c2 = add(m, mul(n, -(rm + bb))); p.quadraticCurveTo(c2.x, c2.y, A.x - n.x * rA, A.y - n.y * rA);
  p.arc(A.x, A.y, rA, aN - Math.PI, aN - 2 * Math.PI, true);
  p.closePath(); return p;
}
function smooth(pts, closed = true) { // Catmull-Rom through the points; a point with .s = true is a sharp corner
  const p = new Path2D(), n = pts.length, P = i => pts[closed ? (i + n) % n : clamp(i, 0, n - 1)];
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = p1.s ? p1 : V(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6), c2 = p2.s ? p2 : V(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6);
    p.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p2.x, p2.y);
  }
  if (closed) p.closePath(); return p;
}
const S_ = p => Object.assign({ s: true }, p); // mark a sharp corner
function ellPath(c, rx, ry, a = 0) { const p = new Path2D(); p.ellipse(c.x, c.y, rx, ry, a, 0, Math.PI * 2); return p; }
function polyPath(pts) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)); p.closePath(); return p; }
const shifted = (path, dx, dy) => { const p = new Path2D(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, dx, dy])); return p; };
/* ---------- cel shading: shadow side, lit side, hot edge, moon rim, ink ---------- */
function cel(g, path, base, L, w, o = {}) {
  const k = L.key, ks = norm(V(k.x, k.y * 0.45)); // light wraps mostly sideways, so tops don't leave a dark band under every shape
  g.save(); g.clip(path);
  g.fillStyle = tone(base, -1, L); g.fill(path);
  const s = w * (o.term ?? 0.5), soft = Math.max(0.6, w * 0.07);
  g.save(); g.filter = `blur(${soft}px)`; g.translate(ks.x * s, ks.y * s); g.fillStyle = tone(base, 0.32, L); g.fill(path); g.restore();
  if (o.mid !== false) { g.save(); g.filter = `blur(${soft * 1.6}px)`; g.translate(ks.x * s * 1.9, ks.y * s * 1.9); g.fillStyle = tone(base, 0.7, L); g.globalAlpha = 0.55; g.fill(path); g.restore(); }
  if (o.hi !== 0) { const h = Math.max(0.9, w * (o.hi ?? 0.09)), x = new Path2D(); x.addPath(path); x.addPath(shifted(path, -ks.x * h, -ks.y * h)); g.save(); g.clip(x, 'evenodd'); g.globalAlpha = 0.85; g.fillStyle = tone(base, 1, L); g.fill(path); g.restore(); }
  if (L.rimAmt && o.rim !== false) { const r = Math.max(0.9, w * 0.07), x = new Path2D(); x.addPath(path); x.addPath(shifted(path, ks.x * r, ks.y * r)); g.save(); g.clip(x, 'evenodd'); g.globalAlpha = L.rimAmt; g.fillStyle = L.rim; g.fill(path); g.restore(); }
  if (o.tex) o.tex(g);
  g.restore();
  if (o.ink !== false) { g.save(); if (o.inkClip) g.clip(o.inkClip, 'evenodd'); g.lineWidth = o.lw || L.ink; g.strokeStyle = L.inkCol; g.lineJoin = 'round'; g.stroke(path); g.restore(); }
}
function stroke(g, pts, lw, col, cap = 'round') { g.lineWidth = lw; g.strokeStyle = col; g.lineCap = cap; g.lineJoin = 'round'; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke(); }
function softDot(g, c, r, col, a) { const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(c.x - r, c.y - r, 2 * r, 2 * r); }
function stains(g, R, cx, cy, w, h, n, col = '#3a0606', a = 0.6) { // blood soaked into cloth
  for (let i = 0; i < n; i++) { const x = cx + (R() - 0.5) * w, y = cy + (R() - 0.5) * h, r = 2 + R() * w * 0.24, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.55, rgba(col, a * 0.6)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + R() * 0.8), R() * 3, 0, 7); g.fill(); }
}
function drips(g, R, x0, y0, w, n, len0, col = '#4a0707') { for (let i = 0; i < n; i++) { const x = x0 + (R() - 0.5) * w, l = len0 * (0.4 + R()); stroke(g, [V(x, y0), V(x + (R() - 0.5) * 2, y0 + l)], 1 + R() * 1.4, rgba(col, 0.75)); } }

/* ---------- the skeleton ----------
   Every figure is built facing screen-left in three-quarter view (C.face = 1 mirrors the finished figure). Forward is -x;
   the near side of the body (the figure's left) is +x. Pose angles are degrees with positive = forward: a limb at 0° hangs
   down, at 90° points the way the figure faces, at 180° straight up. S = pixels per metre, u = pixels per "body metre"
   (the rig is drawn for a 1.75 m person and scaled by height). */
function ik2(root, target, l1, l2, bendBack) {
  const d = sub(target, root), dist = clamp(len(d), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999), n = norm(d);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const m1 = add(add(root, mul(n, a)), mul(perp(n), h)), m2 = add(add(root, mul(n, a)), mul(perp(n), -h));
  return { mid: (m1.x > m2.x) === !!bendBack ? m1 : m2, end: add(root, mul(n, dist)) };
}
function spineAt(J, h) { // a point up the spine (h in body metres from the hip joint) and the forward direction there
  const s = J.spine; let i = 0; while (i < s.length - 2 && h > s[i + 1][0]) i++;
  const [h0, a] = s[i], [h1, b] = s[i + 1], t = (h - h0) / (h1 - h0), tan = norm(sub(b, a));
  return { p: lerpV(a, b, t), fw: V(tan.y, -tan.x) };
}
const TP = (J, h, f) => { const s = spineAt(J, h); return add(s.p, mul(s.fw, f * J.u)); };       // on the body
const TPg = (J, h, f) => h >= 0 ? TP(J, h, f) : add(TP(J, 0, f), V(0, -h * J.u));             // cloth below the hips hangs plumb
function skeleton(C, P, S, foot) {
  const k = C.height / 1.75, u = k * S, gw = C.girth || 1, gF = Math.pow(gw, 0.75);
  const J = { S, k, u, H: C.height * S };
  const pelvisH = P.sit ? 0.5 : 0.97 - 0.22 * (P.crouch || 0);
  J.pelvis = V(foot.x + (P.shift || 0) * u, foot.y - pelvisH * u);
  const lean = P.lean || 0, hunch = P.hunch || 0;
  J.waist = add(J.pelvis, mul(dir(180 + lean), 0.22 * u));
  J.chest = add(J.waist, mul(dir(180 + lean * 1.12 + hunch * 0.6), 0.28 * u));
  J.neck = add(J.chest, mul(dir(180 + lean * 1.2 + hunch * 1.4), 0.05 * u));
  J.spine = [[0, J.pelvis], [0.22, J.waist], [0.5, J.chest], [0.55, J.neck]];
  const up = norm(sub(J.neck, J.chest)), fw = V(up.y, -up.x);
  const nd = norm(add(up, mul(fw, Math.sin((P.headTilt || 0) * RAD)))), drop = (P.headDrop || 0) * 0.004 * u;
  J.head = add(add(J.neck, mul(nd, 0.105 * u)), add(mul(fw, 0.025 * u + drop * 0.6), V(0, drop * 0.5)));
  J.headR = 0.115 * u; J.headUp = nd; J.up = up;
  const shr = (P.shrug || 0) * 0.025 * u;
  J.shF = add(TP(J, 0.47, 0.1 * gF), V(0, -shr)); J.shN = add(TP(J, 0.46, -0.11 * gF), V(0, -shr));
  const ua = 0.31 * u, fa = 0.26 * u, hd = 0.075 * u;
  const arm = (s0, a, e, w = 0) => { const el = add(s0, mul(dir(-a), ua)), wr = add(el, mul(dir(-(a + e)), fa)); return { sh: s0, el, wr, hand: add(wr, mul(dir(-(a + e + w)), hd)) }; };
  const armTo = (s0, t, bendBack = true) => { const r = ik2(s0, t, ua, fa + hd, bendBack), wr = add(r.mid, mul(norm(sub(r.end, r.mid)), fa)); return { sh: s0, el: r.mid, wr, hand: r.end }; };
  const local = p => add(J.pelvis, V(-p[0] * u, -p[1] * u)); // [forward, up] in body metres from the hip joint
  J.armN = P.handN ? armTo(J.shN, local(P.handN), P.bendN !== 'fwd') : arm(J.shN, ...(P.armN || [6, 8]), P.wristN || 0);
  J.propDirN = P.propNAng != null ? dir(-P.propNAng) : null; J.propDirF = P.propFAng != null ? dir(-P.propFAng) : null;
  if (P.gripF != null && J.propDirN) J.armF = armTo(J.shF, add(J.armN.hand, mul(J.propDirN, P.gripF * u)), P.bendF !== 'fwd');
  else J.armF = P.handF ? armTo(J.shF, local(P.handF), P.bendF !== 'fwd') : arm(J.shF, ...(P.armF || [6, 8]), P.wristF || 0);
  J.hipF = TP(J, -0.02, 0.05 * gF); J.hipN = TP(J, -0.02, -0.055 * gF);
  const th = 0.44 * u, sh = 0.44 * u;
  if (P.sit) { // seated: thighs run toward us and forward, shins drop to the floor
    J.legN = { hip: J.hipN, knee: add(J.hipN, V(-0.3 * u, 0.02 * u)) }; J.legN.ank = add(J.legN.knee, V(0.03 * u, 0.42 * u));
    J.legF = { hip: J.hipF, knee: add(J.hipF, V(-0.33 * u, -0.01 * u)) }; J.legF.ank = add(J.legF.knee, V(-0.01 * u, 0.43 * u));
  } else { // feet planted on the ground, legs solved to them
    const ground = foot.y - 0.08 * u, legTo = (hp, x) => { const r = ik2(hp, V(foot.x - x * u, ground), th, sh, false); return { hip: hp, knee: r.mid, ank: r.end }; };
    J.legN = legTo(J.hipN, P.footN ?? -0.04); J.legF = legTo(J.hipF, P.footF ?? 0.05);
  }
  J.gF = gF;
  return J;
}

/* ---------- the body's three-quarter outline: [height up the spine, front depth, back depth] in body metres ---------- */
function profile(C) {
  const gw = Math.pow(C.girth || 1, 0.75), belly = C.belly ? 1 : 0;
  const rows = C.female
    ? [[0.55, 0.045, 0.045], [0.49, 0.11, 0.125], [0.41, 0.15, 0.115], [0.33, 0.12, 0.105], [0.22, 0.095, 0.095], [0.1, 0.11, 0.135], [0.0, 0.115, 0.15], [-0.1, 0.07, 0.115]]
    : [[0.55, 0.05, 0.05], [0.49, 0.125, 0.145], [0.42, 0.14, 0.14], [0.33, 0.135, 0.13], [0.22, 0.115, 0.11], [0.1, 0.12, 0.13], [0.0, 0.11, 0.14], [-0.1, 0.065, 0.1]];
  return rows.map(([h, fr, bk]) => [h, fr * gw * 1.15 + belly * 0.14 * Math.max(0, 1 - Math.abs(h - 0.18) / 0.24), bk * gw * 1.15]);
}
const prof = (rows, h, i) => { for (let j = 0; j < rows.length - 1; j++) { const a = rows[j], b = rows[j + 1]; if (h <= a[0] && h >= b[0]) return a[i] + (b[i] - a[i]) * (a[0] - h) / (a[0] - b[0]); } return h > rows[0][0] ? rows[0][i] : rows[rows.length - 1][i]; };
function bodyOutline(J, C, e = 0, hem = null) { // e: how far a garment stands off the body; hem: {h, flare} for cloth below the hips
  const rows = profile(C), F = [], B = [];
  for (const [h, fr, bk] of rows) { if (hem && h < 0) continue; F.push(TP(J, h, fr + e)); B.push(TP(J, h, -(bk + e))); }
  if (hem) {
    const fr0 = prof(rows, 0, 1) + e, bk0 = prof(rows, 0, 2) + e, fl = hem.flare || 0;
    for (const t of [0.35, 0.7, 1]) { const h = hem.h * t; F.push(TPg(J, h, fr0 + fl * t)); B.push(TPg(J, h, -(bk0 + fl * t * 1.15))); }
    F.push(TPg(J, hem.h - 0.025, (fr0 - bk0) / 2)); // the hem bows toward us
    return { pts: [...F, ...B.reverse()], rows };
  }
  return { pts: [...F, TP(J, -0.13, 0.0), ...B.reverse()], rows };
}

/* ---------- body parts ---------- */
function skinOf(C) { return C.infected ? mix(C.skin, '#8a9688', 0.55) : C.pale ? mix(C.skin, '#bdb6af', C.pale) : C.skin; }
function paintBoot(g, C, Lg, L, dim, u) {
  const a = Lg.ank, col = shade(C.shoes || '#1d1814', dim), sd = norm(sub(Lg.ank, Lg.knee)), n = perp(sd);
  const t0 = add(add(a, mul(sd, -0.07 * u)), mul(n, 0.045 * u)), t1 = add(add(a, mul(sd, -0.07 * u)), mul(n, -0.05 * u));
  const pts = [t0, t1, V(a.x + 0.055 * u, a.y + 0.03 * u), S_(V(a.x + 0.05 * u, a.y + 0.08 * u)), S_(V(a.x - 0.16 * u, a.y + 0.08 * u)), V(a.x - 0.175 * u, a.y + 0.045 * u), V(a.x - 0.12 * u, a.y + 0.01 * u), V(a.x - 0.05 * u, a.y - 0.01 * u)];
  cel(g, smooth(pts), col, L, 0.14 * u, { term: 0.45 });
  stroke(g, [V(a.x + 0.05 * u, a.y + 0.077 * u), V(a.x - 0.16 * u, a.y + 0.077 * u)], Math.max(1.5, 0.018 * u), rgba('#000000', 0.8), 'butt'); // the sole
  stroke(g, [V(a.x - 0.03 * u, a.y + 0.0), V(a.x - 0.11 * u, a.y + 0.03 * u)], Math.max(0.8, 0.006 * u), rgba('#9a8a70', 0.35)); // laces catching light
}
function paintLeg(g, C, J, Lg, L, near) {
  const u = J.u, gw = Math.sqrt(C.girth || 1), dim = near ? 1 : 0.8;
  const tr = (C.female ? 0.085 : 0.08) * u * gw, kr = 0.056 * u * gw, ar = 0.043 * u * gw, pants = shade(C.bottom, dim);
  cel(g, capPath(Lg.knee, Lg.ank, kr, ar, 0.004 * u, 0.022 * u, 0.32), pants, L, kr * 2);
  cel(g, capPath(Lg.hip, Lg.knee, tr, kr * 1.04, 0.014 * u, 0.008 * u, 0.4), pants, L, tr * 2);
  const kn = Lg.knee, sd = norm(sub(Lg.ank, Lg.knee)), n = perp(sd); // folds behind the knee
  stroke(g, [add(kn, mul(n, -kr * 0.9)), add(add(kn, mul(sd, kr * 0.4)), mul(n, -kr * 0.2))], Math.max(0.8, 0.006 * u), rgba('#000000', 0.35));
  if (C.torn && near) { const p0 = lerpV(Lg.knee, Lg.ank, 0.08), p1 = lerpV(Lg.knee, Lg.ank, 0.32); cel(g, capPath(p0, p1, kr * 0.62, kr * 0.5), shade(skinOf(C), 0.9), L, kr, { lw: 0.8 }); stains(g, rng(9), (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, kr * 1.4, kr * 2, 4, '#4a0707', 0.7); }
  paintBoot(g, C, Lg, L, dim, u);
}
function paintSkirt(g, C, J, L) { // a long skirt: over the thighs when she sits, to mid-calf when she stands
  const u = J.u, rows = profile(C), fr = prof(rows, 0.1, 1) + 0.02, bk = prof(rows, 0.1, 2) + 0.02;
  let pts;
  if (J.legN.knee.y - J.hipN.y < 0.1 * u) { // seated
    const kF = J.legF.knee, kN = J.legN.knee;
    pts = [TP(J, 0.14, fr), add(kF, V(-0.05 * u, -0.05 * u)), add(kF, V(-0.08 * u, 0.06 * u)), S_(add(kF, V(-0.06 * u, 0.3 * u))), S_(add(kN, V(0.1 * u, 0.32 * u))), add(kN, V(0.08 * u, 0.04 * u)), TP(J, -0.06, -bk), TP(J, 0.14, -bk)];
  } else {
    const hemY = J.pelvis.y + 0.62 * u, kF = J.legF.knee, kN = J.legN.knee;
    pts = [TP(J, 0.14, fr), add(kF, V(-0.08 * u, 0)), S_(V(Math.min(kF.x, J.legF.ank.x) - 0.1 * u, hemY)), S_(V(Math.max(kN.x, J.legN.ank.x) + 0.12 * u, hemY)), add(kN, V(0.1 * u, 0)), TP(J, 0.14, -bk)];
  }
  const p = smooth(pts); cel(g, p, C.skirtCol || C.bottom, L, 0.5 * u, { term: 0.42 });
  g.save(); g.clip(p); for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5, a = lerpV(pts[0], pts[pts.length - 1], t), b = lerpV(pts[2], pts[3], t); stroke(g, [a, lerpV(a, b, 0.5), b], Math.max(0.8, 0.008 * u), rgba('#000000', 0.25)); } g.restore();
}
function paintTorso(g, C, J, L, R) {
  const u = J.u, coat = C.coat || C.longCoat ? (C.coat || C.top) : null;
  const body = bodyOutline(J, C), bodyP = smooth(body.pts), rows = body.rows;
  const W = (prof(rows, 0.3, 1) + prof(rows, 0.3, 2)) * u;
  cel(g, bodyP, C.top, L, W, { term: 0.42, tex: g2 => { if (C.bloodTorso && !coat) bloodOn(g2, C, J, R); } });
  const cf = (h, t = 0.5) => TP(J, h, prof(rows, h, 1) * t); // the centre-front line, turned toward the face in 3/4 view
  if (!coat) { // shirt: buttons, belt
    stroke(g, [cf(0.5, 0.45), cf(0.02, 0.55)], Math.max(0.8, 0.005 * u), rgba('#000000', 0.25));
    const b0 = TP(J, 0.05, prof(rows, 0.05, 1) + 0.004), b1 = TP(J, 0.05, -prof(rows, 0.05, 2) - 0.004), b2 = TP(J, 0.1, -prof(rows, 0.1, 2) - 0.004), b3 = TP(J, 0.1, prof(rows, 0.1, 1) + 0.004);
    cel(g, polyPath([b0, b1, b2, b3]), C.belt || '#1d1a17', L, W * 0.3, { hi: 0.05, lw: 0.8 });
    const bk = lerpV(b0, b3, 0.5), bk2 = lerpV(bk, lerpV(b1, b2, 0.5), 0.35); g.fillStyle = '#8f8a7e'; g.fillRect(bk2.x - 0.012 * u, bk2.y - 0.018 * u, 0.024 * u, 0.026 * u);
  }
  if (C.collar) { const a = TP(J, 0.53, 0.0), b = cf(0.47, 0.75), c = TP(J, 0.53, prof(rows, 0.53, 1) + 0.01); cel(g, polyPath([TP(J, 0.555, -0.03), a, b, c, TP(J, 0.56, 0.05)]), C.collar, L, 0.08 * u, { lw: 0.8 }); }
  if (C.tie && !coat) { const t0 = cf(0.5, 0.62), t1 = cf(0.12, 0.62), w = 0.022 * u, d = norm(sub(t1, t0)), n = perp(d); cel(g, polyPath([add(t0, mul(n, w * 0.6)), add(t0, mul(n, -w * 0.6)), add(t1, mul(n, -w * 1.2)), add(t1, mul(d, w * 1.4)), add(t1, mul(n, w * 1.2))]), C.tie, L, w * 2, { lw: 0.8 }); g.fillStyle = shade(C.tie, 0.7); g.beginPath(); g.ellipse(t0.x, t0.y, w * 0.75, w * 0.6, 0, 0, 7); g.fill(); }
  if (coat) {
    const hem = { h: C.longCoat ? -0.52 : -0.2, flare: C.longCoat ? 0.06 : 0.025 };
    const co = bodyOutline(J, C, 0.025, hem), coP = smooth(co.pts);
    cel(g, coP, coat, L, W * 1.1, { term: 0.42, tex: g2 => { coatFolds(g2, C, J, rows, hem, u); if (C.bloodTorso) bloodOn(g2, C, J, R); } });
    // open down the front: the shirt shows in a sliver
    const v0 = cf(0.52, 0.32), v1 = cf(0.25, 0.52), v2 = cf(0.52, 0.72);
    cel(g, polyPath([v0, v1, v2]), C.inner || C.top, L, 0.08 * u, { lw: 0.8, mid: false });
    if (C.collar) { cel(g, polyPath([v0, cf(0.44, 0.5), v2]), C.collar, L, 0.05 * u, { lw: 0.7, mid: false }); }
    if (C.tie) { const t0 = cf(0.47, 0.52), t1 = cf(0.3, 0.53); stroke(g, [t0, t1], 0.022 * u, C.tie, 'butt'); }
    stroke(g, [v1, TPg(J, hem.h + 0.02, prof(rows, 0, 1) * 0.55)], Math.max(1, 0.007 * u), L.inkCol);
    for (const s of [0.6, -0.35]) { const p = TPg(J, -0.07, s > 0 ? prof(rows, 0, 1) * s : -prof(rows, 0, 2) * -s); stroke(g, [add(p, V(-0.04 * u, 0)), add(p, V(0.04 * u, 0.006 * u))], Math.max(1, 0.008 * u), rgba('#000000', 0.45), 'butt'); } // pockets
    const cl = [TP(J, 0.5, -0.11), TP(J, 0.6, -0.08), TP(J, 0.61, 0.0), TP(J, 0.56, 0.07), S_(cf(0.44, 0.5)), TP(J, 0.52, 0.02), TP(J, 0.52, -0.06)];
    cel(g, smooth(cl), shade(coat, 0.95), L, 0.12 * u, { term: 0.45 }); // collar turned up against the rain
    if (C.stripes) for (const h of C.longCoat ? [0.3, -0.36] : [0.3, 0.06]) { // reflective tape: catches any light going
      const a0 = TPg(J, h, 0.4), a1 = TPg(J, h, -0.4), a2 = TPg(J, h - 0.04, -0.4), a3 = TPg(J, h - 0.04, 0.4);
      g.save(); g.clip(coP); g.fillStyle = '#c9c48c'; g.fill(polyPath([a0, a1, a2, a3])); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba(L.keyCol, 0.25); g.fill(polyPath([a0, a1, a2, a3])); g.restore();
    }
  }
  if (C.apron) { // the butcher's apron: the front of him from chest to knee, stiff with old blood
    const fr = h => prof(rows, h, 1);
    const ap = [S_(TP(J, 0.43, -0.03)), S_(TP(J, 0.43, fr(0.43) + 0.012)), TP(J, 0.3, fr(0.3) + 0.022), TP(J, 0.15, fr(0.15) + 0.026), TPg(J, -0.05, fr(0) + 0.03), TPg(J, -0.3, fr(0) + 0.02), S_(TPg(J, -0.5, fr(0) + 0.0)), S_(TPg(J, -0.5, -0.1)), TPg(J, -0.2, -0.09), TP(J, 0.15, -0.06)];
    cel(g, smooth(ap), '#a59d8c', L, 0.32 * u, { term: 0.45, tex: g2 => { stains(g2, R, ap[4].x, ap[4].y, 0.3 * u, 0.7 * u, 22, '#3d0505', 0.75); stains(g2, R, ap[2].x, ap[2].y, 0.2 * u, 0.2 * u, 8, '#2a0303', 0.6); drips(g2, R, ap[6].x - 0.12 * u, ap[6].y - 0.12 * u, 0.2 * u, 7, 0.1 * u); } });
    stroke(g, [TP(J, 0.43, 0.0), TP(J, 0.57, -0.04)], Math.max(1.2, 0.012 * u), '#4a4338');
  }
  if (C.lanyard) { const a = TP(J, 0.53, -0.04), b = TP(J, 0.53, 0.05), c = cf(0.3, 0.6); stroke(g, [a, c, b], Math.max(1, 0.009 * u), '#2d4f7a'); const card = polyPath([add(c, V(-0.03 * u, 0)), add(c, V(0.03 * u, 0)), add(c, V(0.03 * u, 0.085 * u)), add(c, V(-0.03 * u, 0.085 * u))]); cel(g, card, '#e3e1da', L, 0.06 * u, { lw: 0.8, mid: false }); g.fillStyle = '#2d4f7a'; g.fillRect(c.x - 0.03 * u, c.y, 0.06 * u, 0.018 * u); g.fillStyle = '#7a7670'; g.fillRect(c.x - 0.02 * u, c.y + 0.03 * u, 0.025 * u, 0.03 * u); }
}
function coatFolds(g, C, J, rows, hem, u) { // creases where the coat bends at the waist and hangs from the shoulders
  const fr = h => prof(rows, h, 1), bk = h => prof(rows, h, 2), lw = Math.max(0.8, 0.007 * u), c = rgba('#000000', 0.28);
  stroke(g, [TP(J, 0.2, -bk(0.2) * 0.9), TP(J, 0.24, -bk(0.2) * 0.3), TP(J, 0.21, 0.02)], lw, c);
  stroke(g, [TP(J, 0.45, -bk(0.45) * 0.6), TP(J, 0.32, -bk(0.3) * 0.7)], lw, c);
  stroke(g, [TPg(J, hem.h * 0.4, fr(0) * 0.2), TPg(J, hem.h * 0.95, fr(0) * 0.1)], lw, c);
  stroke(g, [TPg(J, hem.h * 0.3, -bk(0) * 0.5), TPg(J, hem.h * 0.95, -bk(0) * 0.7)], lw, c);
}
function bloodOn(g, C, J, R) { // where they were bitten, and what ran from it
  const u = J.u, n = C.bloodTorso, c = TP(J, 0.47, 0.03);
  stains(g, R, c.x, c.y + 0.05 * u, 0.22 * u, 0.16 * u, n, '#3d0505', 0.75);
  const d = TP(J, 0.3, 0.06); stains(g, R, d.x, d.y, 0.25 * u, 0.3 * u, Math.ceil(n * 0.8), '#4a0707', 0.55);
  drips(g, R, d.x, d.y, 0.16 * u, 5, 0.18 * u);
}
function paintHand(g, C, A, L, near, u, grip) {
  const dim = near ? 1 : 0.82, h = A.hand, d = norm(sub(A.hand, A.wr)), n = perp(d), skin = shade(skinOf(C), dim);
  const c = add(h, mul(d, -0.012 * u));
  const pts = grip // a fist: blocky knuckles, thumb wrapped over
    ? [add(c, add(mul(d, -0.04 * u), mul(n, 0.034 * u))), add(c, add(mul(d, 0.025 * u), mul(n, 0.038 * u))), S_(add(c, add(mul(d, 0.045 * u), mul(n, 0.01 * u)))), add(c, add(mul(d, 0.04 * u), mul(n, -0.03 * u))), add(c, add(mul(d, -0.03 * u), mul(n, -0.036 * u)))]
    : [add(c, add(mul(d, -0.04 * u), mul(n, 0.032 * u))), add(c, add(mul(d, 0.03 * u), mul(n, 0.036 * u))), add(c, add(mul(d, 0.075 * u), mul(n, 0.012 * u))), add(c, add(mul(d, 0.06 * u), mul(n, -0.022 * u))), add(c, add(mul(d, 0.01 * u), mul(n, -0.04 * u))), add(c, add(mul(d, -0.035 * u), mul(n, -0.034 * u)))];
  cel(g, smooth(pts), skin, L, 0.07 * u, { term: 0.45, lw: Math.max(0.8, L.ink * 0.8) });
  if (!grip) stroke(g, [add(c, add(mul(d, 0.02 * u), mul(n, 0.012 * u))), add(c, add(mul(d, 0.06 * u), mul(n, 0.006 * u)))], Math.max(0.7, 0.004 * u), rgba('#000000', 0.3));
  if (C.infected) stroke(g, [add(c, add(mul(d, -0.03 * u), mul(n, 0.01 * u))), add(c, mul(n, -0.005 * u)), add(c, mul(d, 0.03 * u))], Math.max(0.6, 0.004 * u), rgba('#241626', 0.55));
}
function paintArm(g, C, J, A, L, near, o = {}) {
  const u = J.u, gw = Math.sqrt(C.girth || 1), dim = near ? 1 : 0.8, sleeve = shade(C.coat || C.top, dim);
  const ur = (C.female ? 0.05 : 0.06) * u * gw, er = 0.046 * u * gw, wr = 0.037 * u * gw;
  const fore = C.shortSleeves ? shade(skinOf(C), dim) : sleeve;
  cel(g, capPath(A.el, A.wr, er, wr, 0.012 * u, 0.004 * u, 0.3), fore, L, er * 2.2);
  const cut = new Path2D(); cut.rect(-1e4, -1e4, 2e4, 2e4); cut.arc(A.sh.x, A.sh.y, ur * 1.25, 0, 7);
  cel(g, capPath(A.sh, A.el, ur * 1.05, er, 0.01 * u, 0.012 * u, 0.35), sleeve, L, ur * 2.2, { inkClip: cut });
  if (near) { // the deltoid grows out of the body: one shoulder line from the neck over the arm, no seam
    const ud0 = norm(sub(A.el, A.sh)), back = mul(spineAt(J, 0.47).fw, -1), un0 = perp(ud0), out = (un0.x * back.x + un0.y * back.y) > 0 ? un0 : mul(un0, -1);
    const a = TP(J, 0.545, -0.045), b = add(A.sh, add(mul(ud0, -ur * 0.85), mul(out, ur * 0.35))), c = add(A.sh, add(mul(out, ur * 1.08), mul(ud0, 0.07 * u))), d = add(A.sh, add(mul(out, ur * 0.5), mul(ud0, 0.16 * u))), e = add(A.sh, add(mul(out, -ur * 0.9), mul(ud0, 0.08 * u))), f = TP(J, 0.42, -0.02);
    cel(g, smooth([a, b, c, d, e, f]), sleeve, L, ur * 2.4, { ink: false, rim: false });
    stroke(g, [a, lerpV(a, b, 0.5), b, c, d], L.ink, L.inkCol);
  }
  const fd = norm(sub(A.wr, A.el)), fn = perp(fd);
  if (!C.shortSleeves) { const c = add(A.wr, mul(fd, -0.03 * u)); stroke(g, [add(c, mul(fn, wr * 1.15)), add(c, mul(fn, -wr * 1.15))], Math.max(0.8, 0.007 * u), rgba('#000000', 0.4)); }
  const ud = norm(sub(A.el, A.sh)), un = perp(ud); stroke(g, [add(A.el, add(mul(ud, -0.05 * u), mul(un, er * 0.3))), add(A.el, mul(un, -er * 0.4))], Math.max(0.8, 0.006 * u), rgba('#000000', 0.3)); // elbow fold
  if (C.stripes) { const p0 = lerpV(A.el, A.wr, 0.5); stroke(g, [add(p0, mul(fn, er * 1.05)), add(p0, mul(fn, -er * 1.05))], 0.03 * u, '#c9c48c', 'butt'); }
  if (o.broken) { // the forearm hangs the wrong way at the elbow; bone through the sleeve, and it doesn't matter to him
    const p = add(A.el, mul(ud, -0.02 * u)); g.fillStyle = rgba('#4a0606', 0.85); g.beginPath(); g.ellipse(p.x, p.y, er * 0.9, er * 1.2, 0, 0, 7); g.fill();
    const b0 = add(A.el, mul(fn, -er * 0.3)), b1 = add(b0, mul(norm(add(ud, mul(un, 0.8))), 0.05 * u)); stroke(g, [b0, b1], 0.022 * u, '#dcd3bf'); stroke(g, [b0, b1], 0.008 * u, '#f3ecdc');
    drips(g, rng(13), A.el.x, A.el.y + er, er, 3, 0.12 * u);
  }
  if (!o.noHand) paintHand(g, C, A, L, near, u, o.grip);
}
function paintNeckScarf(g, C, J, L) {
  const u = J.u, r = J.headR, skin = skinOf(C), nb = TP(J, 0.5, -0.005), nt = add(J.head, add(mul(J.headUp, -r * 0.45), V(0.012 * u, 0)));
  cel(g, capPath(nb, nt, 0.052 * u * Math.sqrt(C.girth || 1), 0.046 * u), shade(skin, 0.92), L, 0.1 * u, { term: 0.4 });
  if (C.scarf) { // wound twice round and knotted, the tail down the chest
    const a = TP(J, 0.56, -0.07), b = TP(J, 0.56, 0.075), c = TP(J, 0.5, 0.08), d = TP(J, 0.5, -0.08);
    cel(g, smooth([add(a, V(0, -0.02 * u)), add(b, V(0, -0.025 * u)), add(c, V(-0.01 * u, 0.012 * u)), add(d, V(0, 0.015 * u))]), C.scarf, L, 0.16 * u, { term: 0.45 });
    const t0 = TP(J, 0.5, 0.05), t1 = TP(J, 0.36, 0.1), t2 = TP(J, 0.26, 0.085), t3 = TP(J, 0.27, 0.04), t4 = TP(J, 0.4, 0.035);
    cel(g, smooth([t0, t1, S_(t2), S_(t3), t4]), shade(C.scarf, 0.92), L, 0.06 * u, { term: 0.45 });
  }
}
function paintHead(g, C, J, L, R) {
  const u = J.u, r = J.headR, skin = skinOf(C), ang = Math.atan2(J.headUp.x, -J.headUp.y);
  const Lh = Object.assign({}, L, { key: rot(L.key, -ang) });
  g.save(); g.translate(J.head.x, J.head.y); g.rotate(ang);
  const P = (x, y) => V(x * r, y * r), Ps = (x, y) => S_(P(x, y));
  const head = smooth([P(-0.52, -0.88), P(0.08, -1.02), P(0.62, -0.84), P(0.93, -0.3), P(0.88, 0.2), P(0.6, 0.52), P(0.3, 0.7), P(-0.08, 0.93), P(-0.42, 1.0), P(-0.64, 0.86), P(-0.76, 0.6), P(-0.84, 0.38), Ps(-0.98, 0.25), P(-0.85, 0.06), P(-0.87, -0.16), P(-0.8, -0.52)]);
  cel(g, head, skin, Lh, r * 1.6, { term: 0.42 });
  g.save(); g.clip(head);
  softDot(g, P(-0.22, 0.48), r * 0.32, '#000000', C.infected ? 0.32 : 0.16); // under the cheekbone
  softDot(g, P(-0.22, 0.04), r * 0.3, C.infected ? '#000000' : '#2a1610', C.infected ? 0.6 : 0.32); // eye sockets
  softDot(g, P(-0.69, 0.02), r * 0.2, C.infected ? '#000000' : '#2a1610', C.infected ? 0.55 : 0.3);
  if (C.stubble) softDot(g, P(-0.35, 0.72), r * 0.42, '#20140e', 0.22);
  if (C.pale && !C.infected) softDot(g, P(-0.2, 0.15), r * 0.5, '#7a7088', 0.12);
  g.restore();
  const hairCol = C.hair || '#22170f', bw = r * (C.female ? 0.07 : 0.1), browY = C.infected ? -0.14 : C.downcast ? -0.2 : -0.18;
  stroke(g, [P(-0.42, browY), P(-0.22, browY - 0.04), P(-0.02, browY)], bw, rgba(hairCol, 0.9));
  stroke(g, [P(-0.84, browY + 0.01), P(-0.62, browY - 0.03)], bw * 0.85, rgba(hairCol, 0.9));
  if (C.infected) { // the eyes catch light like an animal's; the veins round them gone dark
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [e, s] of [[P(-0.22, 0.04), 1], [P(-0.68, 0.03), 0.65]]) { softDot(g, e, r * 0.3 * s, '#e8e2b0', 0.55); g.fillStyle = '#fbf6d8'; g.beginPath(); g.ellipse(e.x, e.y, r * 0.085 * s, r * 0.04, 0, 0, 7); g.fill(); }
    g.restore();
    g.strokeStyle = rgba('#2b1630', 0.6); g.lineWidth = Math.max(0.6, 0.004 * u);
    for (let i = 0; i < 9; i++) { let p = i < 5 ? P(-0.1 + R() * 0.2, 0.05 + R() * 0.15) : P(-0.05 + R() * 0.22, -0.45 + R() * 0.4); g.beginPath(); g.moveTo(p.x, p.y); for (let s = 0; s < 4; s++) { p = add(p, V((R() - 0.3) * r * 0.18, (R() - 0.5) * r * 0.2)); g.lineTo(p.x, p.y); } g.stroke(); }
  } else {
    for (const [e, s] of [[P(-0.22, 0.05), 1], [P(-0.69, 0.04), 0.6]]) { g.fillStyle = '#1a100c'; g.beginPath(); g.ellipse(e.x, e.y, r * 0.085 * s, r * 0.034, 0, 0, 7); g.fill(); g.fillStyle = rgba(L.keyCol, 0.8); g.fillRect(e.x - r * 0.04 * s, e.y - r * 0.015, Math.max(1, r * 0.03), Math.max(1, r * 0.025)); }
    if (C.downcast) stroke(g, [P(-0.32, 0.0), P(-0.12, 0.01)], Math.max(0.8, 0.006 * u), rgba('#1a100c', 0.6));
  }
  stroke(g, [P(-0.6, -0.02), P(-0.74, 0.26), P(-0.62, 0.34)], Math.max(0.8, 0.007 * u), rgba('#000000', 0.38)); // nose
  if (C.infected) { // the jaw hangs; what it last ate is still down its chin
    const m = P(-0.52, 0.6); g.fillStyle = '#140404'; g.beginPath(); g.ellipse(m.x, m.y + r * 0.02, r * 0.16, r * (C.jawSlack ? 0.13 : 0.06), -0.08, 0, 7); g.fill();
    g.fillStyle = rgba('#d8ceb8', 0.7); g.fillRect(m.x - r * 0.1, m.y - r * 0.08, r * 0.15, r * 0.035);
    g.save(); g.clip(head); stains(g, R, m.x, m.y + r * 0.3, r * 0.35, r * 0.35, 5, '#4a0707', 0.8); drips(g, R, m.x, m.y + r * 0.1, r * 0.25, 4, r * 0.4); g.restore();
  } else stroke(g, [P(-0.66, 0.6), P(-0.5, 0.62), P(-0.34, 0.58)], Math.max(0.8, 0.007 * u), rgba('#3a1c18', 0.75));
  const hs = C.hairStyle, hcap = [P(-0.66, -0.56), P(-0.42, -0.95), P(0.12, -1.08), P(0.7, -0.88), P(1.0, -0.3), P(0.94, 0.22), P(0.66, 0.5), P(0.5, 0.36), P(0.44, -0.12), P(0.2, -0.3), P(-0.3, -0.48)];
  if (hs === 'short' || hs === 'messy' || hs === 'bun') {
    if (hs === 'bun') cel(g, ellPath(P(0.66, -0.74), r * 0.34, r * 0.3), hairCol, Lh, r * 0.6, { term: 0.5 });
    cel(g, smooth(hcap), hairCol, Lh, r * 1.4, { term: 0.42 });
    if (hs === 'messy') { g.fillStyle = tone(hairCol, -0.2, Lh); for (let i = 0; i < 10; i++) { const p = P(-0.6 + i * 0.16, -0.92 - R() * 0.14 + Math.pow(i / 10 - 0.4, 2) * 0.5); g.beginPath(); g.moveTo(p.x - r * 0.09, p.y + r * 0.14); g.lineTo(p.x + (R() - 0.6) * r * 0.32, p.y - r * 0.2); g.lineTo(p.x + r * 0.09, p.y + r * 0.14); g.fill(); } }
    if (hs === 'bun') stroke(g, [P(-0.76, -0.36), P(-0.86, 0.1), P(-0.8, 0.45)], Math.max(0.8, 0.005 * u), rgba(hairCol, 0.85));
    stroke(g, [P(-0.2, -0.86), P(0.3, -0.82), P(0.7, -0.5)], Math.max(0.7, 0.005 * u), rgba(L.keyCol, 0.18)); // sheen
  } else if (hs === 'sparse') { // what's left: round the back and over the ears
    cel(g, smooth([P(0.3, -0.62), P(0.75, -0.6), P(0.98, -0.12), P(0.9, 0.24), P(0.64, 0.5), P(0.5, 0.32), P(0.46, -0.14), P(0.3, -0.3)]), hairCol, Lh, r * 0.8, { term: 0.45 });
    g.fillStyle = rgba(hairCol, 0.45); for (let i = 0; i < 18; i++) { const p = P(-0.45 + R() * 1.1, -0.98 + R() * 0.3); g.fillRect(p.x, p.y, 1.3, 1.3); }
  }
  if (hs && hs !== 'sparse') { // break the hairline: strands at the fringe and sideburn, a few lighter strands over the crown
    g.fillStyle = tone(hairCol, -0.4, Lh);
    for (const [x, y, a, l] of [[-0.62, -0.56, 2.6, 0.22], [-0.5, -0.6, 2.3, 0.2], [-0.36, -0.54, 2.0, 0.16], [0.42, -0.1, 1.7, 0.22], [0.46, 0.06, 1.6, 0.2], [0.62, 0.48, 1.4, 0.16]]) { const b = P(x, y), t = add(b, V(Math.cos(a) * l * r, Math.sin(a) * l * r)), n = perp(norm(sub(t, b))); g.beginPath(); g.moveTo(b.x + n.x * r * 0.06, b.y + n.y * r * 0.06); g.lineTo(t.x, t.y); g.lineTo(b.x - n.x * r * 0.06, b.y - n.y * r * 0.06); g.fill(); }
    for (let i = 0; i < 7; i++) { const a0 = -2.6 + i * 0.32, rr = 0.75 + R() * 0.15; stroke(g, [P(Math.cos(a0) * rr, Math.sin(a0) * rr - 0.05), P(Math.cos(a0 + 0.3) * rr * 0.95, Math.sin(a0 + 0.3) * rr * 0.95)], Math.max(0.6, 0.004 * u), rgba(shade(hairCol, 1.6), 0.25)); }
  }
  const ear = smooth([P(0.22, -0.1), P(0.42, -0.16), P(0.46, 0.12), P(0.36, 0.3), P(0.24, 0.24)]);
  cel(g, ear, shade(skin, 0.95), Lh, r * 0.3, { term: 0.5, lw: Math.max(0.7, L.ink * 0.7) });
  stroke(g, [P(0.3, -0.04), P(0.36, 0.06), P(0.3, 0.18)], Math.max(0.7, 0.004 * u), rgba('#000000', 0.3));
  if (C.cap) { // a cloth cap, peak pulled low
    cel(g, smooth([P(-0.8, -0.4), P(-0.58, -0.96), P(0.15, -1.14), P(0.82, -0.86), P(1.02, -0.36), P(0.6, -0.42), P(-0.2, -0.44)]), C.cap, Lh, r * 1.6, { term: 0.42 });
    cel(g, smooth([S_(P(-0.72, -0.46)), P(-1.18, -0.42), S_(P(-1.42, -0.28)), P(-0.9, -0.32), P(-0.3, -0.38)]), shade(C.cap, 0.8), Lh, r * 0.4, { term: 0.5 });
    stroke(g, [P(-0.1, -1.1), P(0.0, -0.46)], Math.max(0.7, 0.005 * u), rgba('#000000', 0.3));
  }
  if (C.helmet) { // a firefighter's helmet: dome, comb, the long brim behind
    cel(g, smooth([S_(P(-1.2, -0.28)), P(-0.4, -0.42), P(0.6, -0.4), P(1.35, -0.18), S_(P(1.85, 0.08)), P(1.2, 0.02), P(0.2, -0.22), P(-0.9, -0.2)]), shade(C.helmet, 0.8), Lh, r * 0.4, { term: 0.5 });
    cel(g, smooth([P(-0.98, -0.32), P(-0.8, -0.98), P(0.0, -1.28), P(0.82, -1.04), P(1.06, -0.36), P(0.3, -0.46), P(-0.5, -0.42)]), C.helmet, Lh, r * 1.8, { term: 0.42 });
    stroke(g, [P(-0.62, -1.02), P(0.0, -1.34), P(0.7, -1.12)], r * 0.12, tone(C.helmet, 0.3, Lh));
    cel(g, smooth([P(-0.82, -0.78), P(-0.62, -0.92), P(-0.5, -0.66), S_(P(-0.66, -0.46))]), '#c8b26a', Lh, r * 0.3, { lw: 0.8, mid: false });
  }
  g.restore();
}
function paintBackpack(g, C, J, L) {
  const u = J.u, rows = profile(C), b = h => -prof(rows, h, 2);
  const pts = [TP(J, 0.5, b(0.5) + 0.02), TP(J, 0.52, b(0.5) - 0.12), TP(J, 0.4, b(0.4) - 0.17), TP(J, 0.18, b(0.18) - 0.17), TP(J, 0.1, b(0.1) - 0.12), TP(J, 0.1, b(0.1) + 0.03)];
  cel(g, smooth(pts), C.backpack, L, 0.2 * u, { term: 0.45 });
  stroke(g, [TP(J, 0.36, b(0.36) - 0.03), TP(J, 0.38, b(0.38) - 0.15)], Math.max(1, 0.01 * u), rgba('#000000', 0.4));
  const pk = smooth([TP(J, 0.3, b(0.3) - 0.14), TP(J, 0.3, b(0.3) - 0.2), TP(J, 0.15, b(0.15) - 0.21), TP(J, 0.14, b(0.14) - 0.14)]);
  cel(g, pk, shade(C.backpack, 0.9), L, 0.08 * u, { term: 0.5, lw: 0.8 });
}
function paintStraps(g, C, J, L) {
  const u = J.u, rows = profile(C), a = TP(J, 0.5, -prof(rows, 0.5, 2) * 0.35), b = TP(J, 0.2, -prof(rows, 0.2, 2) * 0.45);
  stroke(g, [a, lerpV(a, b, 0.5), b], 0.036 * u, tone(C.backpack, -0.45, L), 'butt');
}

/* ---------- props: d is the direction from the hand (null follows the forearm), opt carries per-prop details ---------- */
function prop(g, kind, A, L, u, C, R, d0, opt = {}) {
  const h = A.hand, fd = norm(sub(A.hand, A.wr)), fn = perp(fd);
  const bend = { bat: -0.25, axe: 0.15, pipe: -0.4, machete: -0.2 }[kind] || 0;
  const d = d0 || norm(add(fd, mul(fn, bend))), dn = perp(d);
  const P = (t, s = 0) => add(add(h, mul(d, t * u)), mul(dn, s * u)); // along the prop from the hand (t), across it (s); body metres
  const pole = (t0, t1, r0, r1, col, o) => cel(g, capPath(P(t0), P(t1), r0 * u, r1 * u), col, L, Math.max(r0, r1) * 2 * u, Object.assign({ term: 0.45, lw: Math.max(0.8, L.ink * 0.85) }, o));
  const poly = (pts, col, o) => cel(g, polyPath(pts.map(p => P(p[0], p[1]))), col, L, 0.06 * u, Object.assign({ lw: Math.max(0.8, L.ink * 0.85), mid: false }, o));
  const steelFill = (path, t, w) => { const a = P(t, w), b = P(t, -w), gr = g.createLinearGradient(a.x, a.y, b.x, b.y); gr.addColorStop(0, '#eef1f3'); gr.addColorStop(0.45, '#a8adb2'); gr.addColorStop(1, '#4d5256'); g.fillStyle = gr; g.fill(path); g.lineWidth = Math.max(0.8, L.ink * 0.85); g.strokeStyle = L.inkCol; g.stroke(path); };
  const blood = (t, s, w, hh, n, a = 0.75) => { const p = P(t, s); stains(g, R, p.x, p.y, w * u, hh * u, n, '#3a0606', a); };
  const lw = x => Math.max(0.8, x * u);
  if (kind === 'bat') { // a baseball bat, nails driven through the head, the grip taped
    cel(g, capPath(P(-0.07), P(0.74), 0.017 * u, 0.034 * u), '#7a5a3a', L, 0.06 * u, { term: 0.45, lw: Math.max(0.8, L.ink * 0.85), tex: () => blood(0.62, 0, 0.14, 0.18, 9, 0.8) });
    pole(-0.08, 0.1, 0.021, 0.021, '#24201c', { hi: 0.05 });
    for (let t = -0.06; t < 0.1; t += 0.025) stroke(g, [P(t, 0.021), P(t + 0.012, -0.021)], lw(0.003), rgba('#000000', 0.55));
    for (let i = 0; i < 8; i++) { const t = 0.46 + i * 0.036, s = i % 2 ? 1 : -1, r = 0.017 + 0.017 * (t + 0.07) / 0.81; stroke(g, [P(t, s * r * 0.5), P(t + 0.012 * s, s * (r + 0.055))], lw(0.009), '#262626'); stroke(g, [P(t, s * r * 0.5), P(t + 0.012 * s, s * (r + 0.055))], lw(0.004), '#a7a9aa'); }
  }
  if (kind === 'lantern') { // hangs from the hand whatever the arm does
    const b = add(h, V(0, 0.17 * u));
    stroke(g, [add(h, V(-0.05 * u, 0.06 * u)), add(h, V(-0.03 * u, 0.0)), add(h, V(0.03 * u, 0.0)), add(h, V(0.05 * u, 0.06 * u))], lw(0.008), '#2a2622');
    g.save(); g.globalCompositeOperation = 'lighter'; const glow = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, 1.2 * u); glow.addColorStop(0, 'rgba(255,190,110,.55)'); glow.addColorStop(0.1, 'rgba(255,150,70,.26)'); glow.addColorStop(0.35, 'rgba(255,120,40,.08)'); glow.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = glow; g.fillRect(b.x - 1.2 * u, b.y - 1.2 * u, 2.4 * u, 2.4 * u); g.restore();
    const fl = g.createRadialGradient(b.x, b.y + 0.01 * u, 0, b.x, b.y, 0.085 * u); fl.addColorStop(0, '#fff6d8'); fl.addColorStop(0.35, '#ffc070'); fl.addColorStop(1, 'rgba(255,160,80,.4)'); g.fillStyle = fl; g.fillRect(b.x - 0.05 * u, b.y - 0.075 * u, 0.1 * u, 0.155 * u);
    cel(g, polyPath([add(b, V(-0.035 * u, -0.115 * u)), add(b, V(0.035 * u, -0.115 * u)), add(b, V(0.064 * u, -0.075 * u)), add(b, V(-0.064 * u, -0.075 * u))]), '#3b2a20', L, 0.06 * u, { lw: 0.8, mid: false });
    cel(g, polyPath([add(b, V(-0.068 * u, 0.075 * u)), add(b, V(0.068 * u, 0.075 * u)), add(b, V(0.068 * u, 0.105 * u)), add(b, V(-0.068 * u, 0.105 * u))]), '#3b2a20', L, 0.06 * u, { lw: 0.8, mid: false });
    for (const x of [-0.052, 0, 0.052]) stroke(g, [add(b, V(x * u, -0.075 * u)), add(b, V(x * u, 0.075 * u))], lw(0.007), '#231d18');
  }
  if (kind === 'axe') { // fire axe: red head, a ground steel edge, the pick on the back
    const bs = opt.blade || 1, Sd = s => s * bs;
    pole(-0.1, 0.7, 0.02, 0.024, '#8a5a32'); pole(-0.11, 0.05, 0.026, 0.026, '#1d1a17', { hi: 0.05 });
    poly([[0.6, Sd(-0.035)], [0.735, Sd(-0.035)], [0.735, Sd(0.045)], [0.6, Sd(0.045)]], '#7d1b15');
    poly([[0.615, Sd(0.04)], [0.72, Sd(0.04)], [0.775, Sd(0.14)], [0.565, Sd(0.14)]], '#8e1f18');
    const edge = new Path2D(), e0 = P(0.555, Sd(0.135)), e1 = P(0.785, Sd(0.135)), ec = P(0.67, Sd(0.18)), i1 = P(0.775, Sd(0.12)), ic = P(0.67, Sd(0.15)), i0 = P(0.565, Sd(0.12));
    edge.moveTo(e0.x, e0.y); edge.quadraticCurveTo(ec.x, ec.y, e1.x, e1.y); edge.lineTo(i1.x, i1.y); edge.quadraticCurveTo(ic.x, ic.y, i0.x, i0.y); edge.closePath(); steelFill(edge, 0.67, Sd(0.02));
    poly([[0.635, Sd(-0.03)], [0.7, Sd(-0.03)], [0.672, Sd(-0.15)]], '#7d1b15');
    blood(0.67, Sd(0.12), 0.12, 0.1, 6, 0.8);
  }
  if (kind === 'spear') { // a kitchen knife lashed to an ash pole
    pole(-0.62, 1.28, 0.019, 0.017, '#8a6a46'); pole(1.2, 1.34, 0.025, 0.025, '#3a2f24', { hi: 0.05 });
    for (let t = 1.21; t < 1.34; t += 0.022) stroke(g, [P(t, 0.025), P(t + 0.01, -0.025)], lw(0.004), rgba('#000000', 0.5));
    const bl = new Path2D(), s0 = P(1.3, 0.016), s1 = P(1.64, 0.004), ec = P(1.5, -0.042), e0 = P(1.3, -0.02); bl.moveTo(s0.x, s0.y); bl.lineTo(s1.x, s1.y); bl.quadraticCurveTo(ec.x, ec.y, e0.x, e0.y); bl.closePath(); steelFill(bl, 1.45, 0.03);
    g.save(); g.clip(bl); blood(1.5, -0.01, 0.14, 0.1, 5, 0.8); g.restore();
  }
  if (kind === 'shield') { // planks and two iron straps on the forearm in front of the chest, claw-gouged
    const c = lerpV(A.el, A.wr, 0.55), w = 0.25 * u, hh = 0.39 * u, rr = opt.rot ?? -0.05; g.save(); g.translate(c.x, c.y); g.rotate(rr);
    const Ls = Object.assign({}, L, { key: rot(L.key, -rr) }), cols = ['#5a4630', '#614b33', '#564230', '#5d4832'];
    for (let i = 0; i < 4; i++) { const x = -w + i * (w / 2), dy = (i % 2 ? 0.012 : -0.008) * u, pl = polyPath([V(x + 1, -hh + dy), V(x + w / 2 - 1, -hh + dy + 1.5), V(x + w / 2 - 1, hh + dy), V(x + 1, hh + dy - 1)]); cel(g, pl, cols[i], Ls, w / 2, { term: 0.4, lw: Math.max(0.8, L.ink * 0.85), tex: g2 => { for (let j = 0; j < 4; j++) { const gx = x + 4 + R() * (w / 2 - 8); stroke(g2, [V(gx, -hh + 4), V(gx + (R() - 0.5) * 3, hh - 4)], 1, rgba('#000000', 0.2)); } } }); }
    for (const y of [-0.56, 0.56]) { const sy = y * hh; cel(g, polyPath([V(-w - 2, sy - 0.022 * u), V(w + 2, sy - 0.022 * u), V(w + 2, sy + 0.022 * u), V(-w - 2, sy + 0.022 * u)]), '#34312e', Ls, 0.044 * u, { lw: 0.8, mid: false }); g.fillStyle = '#8a8580'; for (const x of [-0.8, -0.27, 0.27, 0.8]) { g.beginPath(); g.arc(x * w, sy, 0.008 * u, 0, 7); g.fill(); } }
    for (let s = 0; s < 3; s++) { const x0 = -w * 0.55 + s * 0.04 * u, y0 = -hh * 0.3, pts = [V(x0, y0), V(x0 + 0.09 * u, y0 + 0.12 * u), V(x0 + 0.21 * u, y0 + 0.2 * u)]; stroke(g, pts.map(p => add(p, V(1, 1.5))), lw(0.007), rgba('#000000', 0.45)); stroke(g, pts, lw(0.005), rgba('#d8c8a8', 0.45)); }
    stains(g, R, w * 0.3, hh * 0.45, 0.25 * u, 0.3 * u, 7, '#3a0606', 0.6);
    g.restore();
  }
  if (kind === 'pipe') { // a length of steel pipe, a coupling on the end
    pole(-0.07, 0.7, 0.02, 0.02, '#5d6064'); pole(0.63, 0.71, 0.029, 0.029, '#4a4d50'); pole(-0.08, 0.1, 0.024, 0.024, '#1e1d1d', { hi: 0.05 });
    stroke(g, [P(0.12, L.key.x < 0 ? 0.008 : -0.008), P(0.62, L.key.x < 0 ? 0.008 : -0.008)], lw(0.005), rgba('#f2f6fa', 0.45));
    blood(0.66, 0, 0.09, 0.09, 5, 0.75);
  }
  if (kind === 'machete') { // a cane knife: clipped point, the edge worn bright
    pole(-0.06, 0.075, 0.021, 0.021, '#2a1d14', { hi: 0.05 }); g.fillStyle = '#c9b48a'; for (const t of [-0.02, 0.04]) { const p = P(t); g.beginPath(); g.arc(p.x, p.y, 0.006 * u, 0, 7); g.fill(); }
    const bl = new Path2D(), p0 = P(0.075, 0.022), p1 = P(0.56, 0.016), p2 = P(0.62, -0.004), e1 = P(0.5, -0.052), e0 = P(0.075, -0.026); bl.moveTo(p0.x, p0.y); bl.lineTo(p1.x, p1.y); bl.lineTo(p2.x, p2.y); bl.quadraticCurveTo(e1.x, e1.y, e0.x, e0.y); bl.closePath(); steelFill(bl, 0.35, 0.04);
    stroke(g, [P(0.1, -0.024), P(0.45, -0.042), P(0.58, -0.012)], lw(0.004), rgba('#f4f6f8', 0.6));
    g.save(); g.clip(bl); blood(0.45, -0.015, 0.16, 0.06, 6, 0.65); g.restore();
  }
}

/* ---------- a whole figure, far to near ---------- */
const HELD = p => p && p !== 'lantern' && p !== 'shield';
function paintFigure(g, C, P, S, foot, L, R) {
  if (C.face === 1) { // mirrored: the canonical figure flipped about its feet, the light flipped so it still falls from the same side
    g.save(); g.translate(2 * foot.x, 0); g.scale(-1, 1);
    const J = paintFigure(g, Object.assign({}, C, { face: -1 }), P, S, foot, Object.assign({}, L, { key: V(-L.key.x, L.key.y) }), R);
    g.restore(); return J;
  }
  const J = skeleton(C, P, S, foot), u = J.u;
  if (C.chair) paintChair(g, J, L, u);
  if (C.backpack) paintBackpack(g, C, J, L);
  const farProp = () => prop(g, P.propF, J.armF, L, u, C, R, J.propDirF, P.propFOpt);
  const farArm = () => {
    if (P.propF && P.propFBehind) farProp();
    paintArm(g, C, J, J.armF, L, false, { broken: P.brokenF, grip: HELD(P.propF) || P.gripF != null || P.fistF });
    if (P.propF && !P.propFBehind) { farProp(); if (HELD(P.propF)) paintHand(g, C, J.armF, L, false, u, true); }
  };
  if (!P.farArmFront) farArm();
  paintLeg(g, C, J, J.legF, L, false);
  paintLeg(g, C, J, J.legN, L, true);
  if (C.skirt) paintSkirt(g, C, J, L);
  paintTorso(g, C, J, L, R);
  if (C.backpack) paintStraps(g, C, J, L);
  if (C.satchel) { // across the body: far shoulder to the back hip, a red cross gone pale
    const a = TP(J, 0.5, 0.06), b = TP(J, 0.02, -0.17), m = TP(J, 0.26, -0.02);
    stroke(g, [a, m, b], 0.032 * u, '#3b3326', 'butt');
    cel(g, smooth([S_(add(b, V(-0.1 * u, -0.03 * u))), S_(add(b, V(0.1 * u, -0.03 * u))), add(b, V(0.11 * u, 0.12 * u)), add(b, V(-0.1 * u, 0.13 * u))]), '#6a6250', L, 0.2 * u, { term: 0.45 });
    cel(g, polyPath([add(b, V(-0.1 * u, -0.03 * u)), add(b, V(0.1 * u, -0.03 * u)), add(b, V(0.1 * u, 0.045 * u)), add(b, V(-0.1 * u, 0.045 * u))]), shade('#6a6250', 0.85), L, 0.1 * u, { lw: 0.8, mid: false });
    g.fillStyle = '#b8a8a0'; g.fillRect(b.x - 0.035 * u, b.y + 0.075 * u, 0.07 * u, 0.02 * u); g.fillRect(b.x - 0.01 * u, b.y + 0.05 * u, 0.02 * u, 0.07 * u);
  }
  if (C.shawl) paintShawl(g, C, J, L, u);
  paintNeckScarf(g, C, J, L);
  paintHead(g, C, J, L, R);
  if (C.baby) paintBaby(g, J, L, u);
  if (P.farArmFront) farArm();
  const nearProp = () => prop(g, P.propN, J.armN, L, u, C, R, J.propDirN, P.propNOpt);
  if (P.propN && P.propNBehind) nearProp();
  paintArm(g, C, J, J.armN, L, true, { broken: P.brokenN, grip: HELD(P.propN) || P.fistN });
  if (P.propN && !P.propNBehind) { nearProp(); if (HELD(P.propN)) paintHand(g, C, J.armN, L, true, u, true); }
  if (P.gripF != null) paintHand(g, C, J.armF, L, false, u, true); // the far hand closed on the near hand's shaft
  if (C.cleaverInShoulder) { // the cleaver someone left in him; he never noticed
    const s = add(J.shN, add(mul(J.up, 0.03 * u), V(0.02 * u, 0))); g.save(); g.translate(s.x, s.y); g.rotate(-0.55);
    const Lc = Object.assign({}, L, { key: rot(L.key, 0.55) });
    cel(g, polyPath([V(-0.016 * u, -0.25 * u), V(0.016 * u, -0.25 * u), V(0.016 * u, -0.12 * u), V(-0.016 * u, -0.12 * u)]), '#2a1d14', Lc, 0.03 * u, { lw: 0.8, mid: false });
    const bl = polyPath([V(-0.06 * u, -0.125 * u), V(0.065 * u, -0.125 * u), V(0.06 * u, 0.0), V(-0.065 * u, 0.012 * u)]); const sg = g.createLinearGradient(-0.06 * u, 0, 0.06 * u, 0); sg.addColorStop(0, '#d8dcdf'); sg.addColorStop(1, '#575c60'); g.fillStyle = sg; g.fill(bl); g.lineWidth = 0.8; g.strokeStyle = L.inkCol; g.stroke(bl);
    g.fillStyle = '#141414'; g.beginPath(); g.arc(0.035 * u, -0.095 * u, 0.008 * u, 0, 7); g.fill(); g.restore();
    g.fillStyle = rgba('#3d0505', 0.9); g.beginPath(); g.ellipse(s.x + 0.005 * u, s.y + 0.04 * u, 0.04 * u, 0.06 * u, 0.2, 0, 7); g.fill(); drips(g, R, s.x, s.y + 0.06 * u, 0.06 * u, 4, 0.16 * u, '#3d0505');
  }
  return J;
}
function paintChair(g, J, L, u) { // the rocking chair she never leaves: back behind her, rockers on the floor
  const p = J.pelvis, col = '#5a3d27', bx = p.x + 0.16 * u;
  cel(g, smooth([S_(V(bx - 0.2 * u, p.y + 0.02 * u)), V(bx - 0.2 * u, p.y - 0.6 * u), V(bx - 0.14 * u, p.y - 0.98 * u), V(bx + 0.08 * u, p.y - 1.06 * u), V(bx + 0.3 * u, p.y - 0.96 * u), S_(V(bx + 0.3 * u, p.y + 0.02 * u))]), col, L, 0.5 * u, { term: 0.4, tex: g2 => { for (let i = -2; i <= 2; i++) { g2.fillStyle = rgba('#000000', 0.45); g2.fillRect(bx + 0.05 * u + i * 0.09 * u - 0.012 * u, p.y - 0.86 * u, 0.024 * u, 0.74 * u); } } });
  for (const x of [-0.34, 0.26]) stroke(g, [V(p.x + x * u, p.y + 0.02 * u), V(p.x + x * 1.1 * u, p.y + 0.45 * u)], 0.036 * u, tone(col, -0.3, L));
  stroke(g, [V(p.x - 0.62 * u, p.y + 0.41 * u), V(p.x - 0.1 * u, p.y + 0.56 * u), V(p.x + 0.46 * u, p.y + 0.38 * u)], 0.042 * u, tone(col, -0.1, L));
  cel(g, polyPath([V(p.x - 0.4 * u, p.y - 0.01 * u), V(p.x + 0.32 * u, p.y - 0.01 * u), V(p.x + 0.32 * u, p.y + 0.05 * u), V(p.x - 0.4 * u, p.y + 0.05 * u)]), shade(col, 1.05), L, 0.06 * u, { lw: 0.8, mid: false });
}
function paintShawl(g, C, J, L, u) { // over both shoulders, falling past the elbows, fringed
  const rows = profile(C), a = TP(J, 0.5, prof(rows, 0.5, 1) + 0.05), b = TP(J, 0.5, -prof(rows, 0.5, 2) - 0.05), c = TP(J, 0.18, 0.02);
  const pts = [a, TP(J, 0.58, 0.0), b, TP(J, 0.2, -prof(rows, 0.2, 2) - 0.07), S_(c), TP(J, 0.22, prof(rows, 0.22, 1) + 0.07)];
  cel(g, smooth(pts), C.shawl, L, 0.4 * u, { term: 0.42, tex: g2 => { for (let i = 0; i < 7; i++) { const t = (i + 1) / 8, q = lerpV(b, a, t); stroke(g2, [q, lerpV(q, c, 0.5), lerpV(q, c, 0.85)], Math.max(0.8, 0.006 * u), rgba('#000000', 0.22)); } } });
  for (let i = 0; i < 16; i++) { const t = i / 15, q = t <= 0.5 ? lerpV(pts[3], c, t * 2) : lerpV(c, pts[5], (t - 0.5) * 2); stroke(g, [q, add(q, V(0, 0.035 * u))], Math.max(0.7, 0.004 * u), rgba(shade(C.shawl, 1.25), 0.6)); }
}
function paintBaby(g, J, L, u) { // swaddled, held across her chest, head toward the face side
  const c = TP(J, 0.3, 0.16);
  cel(g, ellPath(c, 0.18 * u, 0.095 * u, -0.2), '#e3d7c0', L, 0.2 * u, { term: 0.45, tex: g2 => { for (let i = 0; i < 3; i++) { g2.strokeStyle = rgba('#000000', 0.16); g2.lineWidth = Math.max(0.8, 0.005 * u); g2.beginPath(); g2.arc(c.x + 0.05 * u, c.y - 0.01 * u, (0.05 + i * 0.035) * u, 2.2, 3.9); g2.stroke(); } } });
  const f = add(c, V(-0.13 * u, -0.04 * u));
  cel(g, ellPath(f, 0.058 * u, 0.055 * u), '#e8c3a8', L, 0.1 * u, { term: 0.45, lw: 0.8 });
  cel(g, smooth([add(f, V(-0.05 * u, -0.02 * u)), add(f, V(-0.02 * u, -0.065 * u)), add(f, V(0.05 * u, -0.05 * u)), add(f, V(0.065 * u, 0.02 * u)), add(f, V(0.02 * u, -0.01 * u))]), '#b98c6a', L, 0.1 * u, { lw: 0.8 });
  for (const x of [-0.026, 0.004]) stroke(g, [add(f, V(x * u - 0.008 * u, 0.012 * u)), add(f, V(x * u, 0.016 * u)), add(f, V(x * u + 0.008 * u, 0.012 * u))], Math.max(0.7, 0.004 * u), rgba('#4a2c22', 0.85));
}

/* ---------- the plate: the place, the light, rain, the figure and its rim, fog, grain ---------- */
let GRAIN = null;
function grain() { if (GRAIN) return GRAIN; const c = document.createElement('canvas'); c.width = c.height = 192; const g = c.getContext('2d'), d = g.createImageData(192, 192), R = rng(99); for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (R() - 0.5) * 110; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return (GRAIN = c); }
function lightFor(C, ink = 1.3) {
  const cold = !!C.infected;
  return { key: norm(V(cold ? 0.85 : -0.8, -0.55)), keyCol: cold ? '#cfdcf0' : '#ffc27a', keyAmt: 1, ambCol: cold ? '#16241f' : '#1a2131', rim: cold ? '#a8c2d4' : '#8fb0dc', rimAmt: 0.55, ink, inkCol: 'rgba(8,8,10,.88)' };
}
function backdrop(g, W, Hh, cold, R, groundY) {
  const bg = g.createLinearGradient(0, 0, 0, Hh); bg.addColorStop(0, cold ? '#0a100f' : '#0c0d12'); bg.addColorStop(0.65, cold ? '#0d1514' : '#120f0e'); bg.addColorStop(1, '#050506'); g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
  if (cold) { // outside: trees in the fog, the floodlight cutting down through the rain
    for (let layer = 0; layer < 3; layer++) { const a = 0.12 + layer * 0.12; for (let i = 0; i < 4; i++) { const x = R() * W, w = 10 + R() * 18 + layer * 8; g.fillStyle = `rgba(${4 + layer * 2},${8 + layer * 2},${8 + layer * 2},${0.5 + a})`; g.fillRect(x, 0, w, groundY); } const fog = g.createLinearGradient(0, groundY * 0.3, 0, groundY); fog.addColorStop(0, 'rgba(70,90,95,0)'); fog.addColorStop(1, `rgba(70,90,95,${0.08 + layer * 0.03})`); g.fillStyle = fog; g.fillRect(0, 0, W, groundY); }
    g.save(); g.globalCompositeOperation = 'lighter'; const beam = g.createLinearGradient(W, 0, W * 0.4, Hh); beam.addColorStop(0, 'rgba(160,185,215,.2)'); beam.addColorStop(1, 'rgba(160,185,215,0)'); g.fillStyle = beam; g.beginPath(); g.moveTo(W * 0.92, 0); g.lineTo(W * 1.02, 0); g.lineTo(W * 0.85, Hh); g.lineTo(W * 0.1, Hh); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(190,210,235,.16)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 90; i++) { const t = R(), x = W * (0.97 - t * 0.5) + (R() - 0.5) * W * 0.4 * t, y = t * Hh, l = 10 + R() * 18; g.moveTo(x, y); g.lineTo(x - l * 0.2, y + l); } g.stroke(); g.restore();
  } else { // the cabin wall behind: rough planks, a boarded window leaking moonlight, the lamp's warmth
    const plank = 34 + R() * 8; for (let x = -R() * plank; x < W; x += plank) { g.fillStyle = `rgba(${26 + R() * 10},${19 + R() * 6},${14 + R() * 4},.9)`; g.fillRect(x, 0, plank - 2, groundY); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + plank - 2, 0, 2, groundY); }
    const wx = W * 0.62, wy = Hh * 0.12, ww = W * 0.3, wh = Hh * 0.26; g.fillStyle = '#07090c'; g.fillRect(wx, wy, ww, wh);
    g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const y = wy + (i + 0.5) * wh / 4; g.fillStyle = 'rgba(120,150,190,.22)'; g.fillRect(wx, y - 1.5, ww, 3); } g.restore();
    for (let i = 0; i < 4; i++) { const y = wy + i * wh / 4 + 2; g.fillStyle = '#2a1e16'; g.save(); g.translate(wx + ww / 2, y + wh / 8 - 4); g.rotate((R() - 0.5) * 0.12); g.fillRect(-ww * 0.58, -wh / 10, ww * 1.16, wh / 5.2); g.fillStyle = '#6a6460'; g.fillRect(-ww * 0.5, -1, 3, 3); g.fillRect(ww * 0.46, -1, 3, 3); g.restore(); }
    const warm = g.createRadialGradient(W * 0.08, Hh * 0.6, 0, W * 0.08, Hh * 0.6, W * 0.95); warm.addColorStop(0, 'rgba(255,160,80,.26)'); warm.addColorStop(0.5, 'rgba(255,140,60,.07)'); warm.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = warm; g.fillRect(0, 0, W, Hh);
    const dim = g.createLinearGradient(0, 0, 0, Hh); dim.addColorStop(0, 'rgba(0,0,0,.45)'); dim.addColorStop(0.5, 'rgba(0,0,0,.15)'); dim.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = dim; g.fillRect(0, 0, W, Hh);
  }
  const gr = g.createLinearGradient(0, groundY - 20, 0, Hh); gr.addColorStop(0, cold ? 'rgba(14,16,15,0)' : 'rgba(30,22,16,0)'); gr.addColorStop(0.18, cold ? 'rgba(14,16,15,.95)' : 'rgba(30,22,16,.95)'); gr.addColorStop(1, '#060606'); g.fillStyle = gr; g.fillRect(0, groundY - 20, W, Hh - groundY + 20);
  if (!cold) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const y = groundY + 6 + i * i * 6; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
  const pud = g.createRadialGradient(W * 0.5, groundY + 16, 0, W * 0.5, groundY + 16, W * 0.45); pud.addColorStop(0, cold ? 'rgba(150,175,210,.16)' : 'rgba(255,170,90,.14)'); pud.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = pud; g.beginPath(); g.ellipse(W * 0.5, groundY + 16, W * 0.45, 22, 0, 0, 7); g.fill();
}
function plate(canvas, C, opts = {}) {
  const W = opts.w || 520, Hh = opts.h || 720, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = Hh * dpr; const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const R = rng(C.seed || 7), cold = !!C.infected, L = lightFor(C, opts.ink || 1.4), groundY = Hh * 0.9;
  backdrop(g, W, Hh, cold, rng((C.seed || 7) + 5), groundY);
  const rain = (n, a, lw) => { g.strokeStyle = `rgba(170,190,215,${a})`; g.lineWidth = lw; g.beginPath(); for (let i = 0; i < n; i++) { const x = R() * (W + 120) - 60, y = R() * Hh, l = 14 + R() * 26; g.moveTo(x, y); g.lineTo(x - l * 0.22, y + l); } g.stroke(); };
  if (cold) rain(140, 0.07, 0.8);
  const S = opts.scale || (Hh * 0.7 / 1.85), foot = V(W * (opts.cx || 0.5), opts.fy ? Hh * opts.fy : groundY);
  const F = document.createElement('canvas'); F.width = W * dpr; F.height = Hh * dpr; const f = F.getContext('2d'); f.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = 'rgba(0,0,0,.65)'; g.beginPath(); g.ellipse(foot.x - 0.04 * S, foot.y + 4, 0.42 * S, 8, 0, 0, 7); g.fill(); // contact shadow
  paintFigure(f, C, C.pose || {}, S, foot, L, R);
  f.save(); f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-atop'; f.globalAlpha = 0.14; f.fillStyle = f.createPattern(grain(), 'repeat'); f.fillRect(0, 0, F.width, F.height); f.restore(); // paper tooth on the figure only
  const rim = document.createElement('canvas'); rim.width = F.width; rim.height = F.height; const rg = rim.getContext('2d'); rg.drawImage(F, 0, 0); rg.globalCompositeOperation = 'source-in'; rg.fillStyle = L.rim; rg.fillRect(0, 0, rim.width, rim.height);
  g.save(); g.filter = 'blur(6px)'; g.globalAlpha = 0.28; g.drawImage(rim, 0, 0, W, Hh); g.restore(); // a soft halo of moonlight behind
  g.drawImage(F, 0, 0, W, Hh);
  if (cold) rain(60, 0.15, 1);
  const fog = g.createLinearGradient(0, groundY - 80, 0, Hh); fog.addColorStop(0, 'rgba(120,140,160,0)'); fog.addColorStop(0.6, cold ? 'rgba(110,130,150,.12)' : 'rgba(120,100,80,.06)'); fog.addColorStop(1, 'rgba(90,105,120,.04)'); g.fillStyle = fog; g.fillRect(0, groundY - 80, W, Hh);
  const vg = g.createRadialGradient(W / 2, Hh * 0.45, Hh * 0.28, W / 2, Hh * 0.5, Hh * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.62)'); g.fillStyle = vg; g.fillRect(0, 0, W, Hh);
  g.save(); g.globalAlpha = 0.08; g.globalCompositeOperation = 'overlay'; g.fillStyle = g.createPattern(grain(), 'repeat'); g.fillRect(0, 0, W, Hh); g.restore();
  return g;
}
// a strip of the same figure in several poses, solid, the way the overhead camera reads it
function silhouettes(canvas, C, poses, opts = {}) {
  const W = opts.w || 520, Hh = opts.h || 180, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = Hh * dpr; const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = opts.bg || '#14191f'; g.fillRect(0, 0, W, Hh);
  const S = Hh * 0.8 / 1.9, L = Object.assign(lightFor(C), { rimAmt: 0 });
  poses.forEach((P, i) => {
    const F = document.createElement('canvas'); F.width = W * dpr; F.height = Hh * dpr; const f = F.getContext('2d'); f.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFigure(f, Object.assign({}, C, P.C || {}), P, S, V(W * (i + 0.5) / poses.length + (P.dx || 0) * S, Hh * 0.92), L, rng(5));
    f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-in'; f.fillStyle = opts.ink || '#e9e1d2'; f.fillRect(0, 0, F.width, F.height);
    g.drawImage(F, 0, 0, W, Hh);
  });
}
// everyone side by side at one scale, with a height rule in metres
function lineup(canvas, list, opts = {}) {
  const W = opts.w || 1100, Hh = opts.h || 360, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = Hh * dpr; const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = opts.bg || '#10151c'; g.fillRect(0, 0, W, Hh);
  const base = Hh - 34, S = (Hh - 64) / 2.0, left = 50;
  g.font = '11px ' + (opts.mono || 'monospace'); g.textBaseline = 'middle';
  for (let m = 0; m <= 2.0001; m += 0.25) { const y = base - m * S, major = Math.abs(m * 2 - Math.round(m * 2)) < 0.01; g.strokeStyle = major ? 'rgba(233,225,210,.16)' : 'rgba(233,225,210,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(left, y); g.lineTo(W - 10, y); g.stroke(); if (major) { g.fillStyle = 'rgba(233,225,210,.5)'; g.fillText(m.toFixed(1) + ' m', 6, y); } }
  const step = (W - left - 20) / list.length;
  list.forEach((C, i) => {
    const cx = left + step * (i + 0.5), L = Object.assign(lightFor(C, 1), { key: norm(V(-0.7, -0.7)), rimAmt: 0.35 });
    const F = document.createElement('canvas'); F.width = W * dpr; F.height = Hh * dpr; const f = F.getContext('2d'); f.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFigure(f, Object.assign({}, C, { chair: false }), C.linePose || {}, S, V(cx, base), L, rng(9 + i));
    g.drawImage(F, 0, 0, W, Hh);
    const top = base - C.height * S; g.strokeStyle = C.infected ? 'rgba(224,122,95,.55)' : 'rgba(233,225,210,.4)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(cx - step * 0.32, top); g.lineTo(cx + step * 0.32, top); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.infected ? 'rgba(224,122,95,.95)' : 'rgba(233,225,210,.85)'; g.textAlign = 'center'; g.fillText(C.short || C.name, cx, base + 16); g.fillStyle = 'rgba(233,225,210,.45)'; g.fillText(C.height.toFixed(2) + ' m', cx, top - 9); g.textAlign = 'left';
  });
}
window.CONCEPT = { plate, silhouettes, lineup };
})();
