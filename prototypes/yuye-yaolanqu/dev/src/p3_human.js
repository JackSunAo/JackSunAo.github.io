/* ===== P3 humans: procedural stylised characters + pose system ===== */
const NEUTRAL = {
  hipLx: 0, hipLz: 0, hipRx: 0, hipRz: 0, knL: 0.04, knR: 0.04, ankL: 0, ankR: 0,
  spX: 0, spY: 0, spZ: 0, chX: 0, chY: 0, headX: 0, headY: 0, headZ: 0,
  shLx: 0, shLy: 0, shLz: 0.08, shRx: 0, shRy: 0, shRz: -0.08, elL: 0.15, elR: 0.15,
  bodyY: 0, bodyX: 0, bodyZ: 0, pelY: 0, pelX: 0, jaw: 0
};
const capsule = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 12), mat);
/* a sculpted shell: rings down an axis, each with its own half-width (w) and front (f) and back (b) depth, so a torso has a
   chest and shoulder blades and a calf bulges behind the shin; a little squareness (sq) keeps cloth from reading as a tube.
   u runs round the ring, v down the rings, so painted cloth wraps it like it wrapped the capsules */
function shellGeo(rings, k = 1, segs = 16, sq = 2.4, sph = false) {
  const n = rings.length, pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) { const r = rings[i];
    for (let j = 0; j <= segs; j++) { const a = j / segs * Math.PI * 2, e = 2 / sq;
      const sa = sph ? -Math.cos(a) : Math.sin(a), ca = sph ? Math.sin(a) : Math.cos(a); // sph: u = 0.25 faces front
      const x = Math.sign(sa) * Math.pow(Math.abs(sa), e) * r.w, z = Math.sign(ca) * Math.pow(Math.abs(ca), e) * (ca > 0 ? r.f : r.b);
      const dy = (r.yf || 0) * Math.pow(Math.max(0, ca), 1.4) + (r.yb || 0) * Math.pow(Math.max(0, -ca), 1.4);
      pos.push(x * k, (r.y + dy) * k, z * k + (r.z || 0) * k); uv.push(j / segs, 1 - (r.v ?? i / (n - 1))); } }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const cap = (i, y, flip) => { const c = pos.length / 3, r = rings[i]; pos.push(0, y * k, (r.z || 0) * k); uv.push(0.5, flip ? 0 : 1); for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j; flip ? idx.push(c, a + 1, a) : idx.push(c, a, a + 1); } };
  cap(0, rings[0].y + (rings[0].cap || 0), false); cap(n - 1, rings[n - 1].y - (rings[n - 1].cap || 0), true);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const R_ = (y, w, f, b = f, z = 0, cap = 0) => ({ y, w, f, b, z, cap });
/* the head: crown to under the chin, a brow, cheekbones, a jaw that narrows to the chin. v puts the painted face where it
   was drawn (eyes at 0.478 down the canvas, mouth at 0.62) */
const HEAD = [[0, 0.228, 0.03, 0.03, 0.035], [0.08, 0.215, 0.068, 0.07, 0.08], [0.2, 0.19, 0.088, 0.093, 0.102], [0.33, 0.155, 0.094, 0.102, 0.106], [0.43, 0.128, 0.093, 0.106, 0.102],
  [0.478, 0.115, 0.092, 0.104, 0.098], [0.55, 0.095, 0.088, 0.106, 0.088], [0.62, 0.07, 0.078, 0.1, 0.072], [0.72, 0.047, 0.062, 0.09, 0.054], [0.85, 0.031, 0.042, 0.07, 0.038], [1, 0.022, 0.016, 0.03, 0.016]];
function headRings(fem) { return HEAD.map(([v, y, w, f, b]) => { const jaw = fem && y < 0.09 ? 0.88 : 1, sc = fem ? 0.94 : 1; return Object.assign(R_(y, w * sc * jaw, f * (fem ? 0.97 : 1), b * sc), { v }); }); }
function headAt(rs, y) { for (let i = 0; i < rs.length - 1; i++) { const a = rs[i], b = rs[i + 1]; if (y <= a.y && y >= b.y) { const t = (a.y - y) / (a.y - b.y); return { w: a.w + (b.w - a.w) * t, f: a.f + (b.f - a.f) * t, b: a.b + (b.b - a.b) * t }; } } const e = y > rs[0].y ? rs[0] : rs[rs.length - 1]; return { w: e.w, f: e.f, b: e.b }; }
// hair or a hat fitted over the head: down to a line at the nape and sides that rises at the front to the hairline
function overHead(rs, t, bottom, yf, yb, tops = [0.226, 0.212, 0.19, 0.165]) {
  const ring = y => { const d = headAt(rs, y); return R_(y, d.w + t, d.f + t, d.b + t); };
  const out = tops.map(y => ring(y + t * 0.6)); out[0].cap = 0.005;
  const sideW = headAt(rs, bottom).w + t, fr = headAt(rs, bottom + yf).f + t, bk = headAt(rs, bottom + yb).b + t;
  out.push(Object.assign(R_(bottom, sideW, fr, bk), { yf, yb }));
  return out;
}
// rings in body metres (1.75 m person); widths take the girth
function torsoRings(g, fem) { const W = g, D = Math.pow(g, 0.9), bl = Math.max(0, g - 1.2) * 0.32; // a heavy man's belly pushes the front out low
  const B = (y, r) => Object.assign(r, { f: r.f + bl * Math.max(0, 1 - Math.abs(y - 0.13) / 0.2), w: r.w + bl * 0.25 * Math.max(0, 1 - Math.abs(y - 0.1) / 0.2) });
  return (fem
    ? [R_(-0.07, 0.13 * W, 0.085 * D, 0.1 * D, 0, 0.02), R_(0.0, 0.14 * W, 0.095 * D, 0.105 * D), R_(0.09, 0.125 * W, 0.09 * D, 0.09 * D), R_(0.19, 0.135 * W, 0.105 * D, 0.095 * D), R_(0.27, 0.15 * W, 0.13 * D, 0.1 * D), R_(0.35, 0.165 * W, 0.11 * D, 0.1 * D), R_(0.41, 0.168 * W, 0.08 * D, 0.088 * D), R_(0.455, 0.11 * W, 0.055 * D, 0.065 * D), R_(0.49, 0.05 * W, 0.042, 0.045, 0, 0.01)]
    : [R_(-0.07, 0.145 * W, 0.09 * D, 0.1 * D, 0, 0.02), R_(0.0, 0.152 * W, 0.1 * D, 0.105 * D), R_(0.09, 0.15 * W, 0.1 * D, 0.098 * D), R_(0.19, 0.162 * W, 0.112 * D, 0.104 * D), R_(0.28, 0.178 * W, 0.124 * D, 0.11 * D), R_(0.36, 0.188 * W, 0.118 * D, 0.112 * D), R_(0.42, 0.19 * W, 0.088 * D, 0.1 * D), R_(0.46, 0.13 * W, 0.062 * D, 0.074 * D), R_(0.495, 0.058 * W, 0.046, 0.048, 0, 0.01)].map(r => B(r.y, r))); }
const THIGH = (r, len) => [R_(0.02, r * 1.05, r, r * 1.08, 0, 0.03), R_(-0.06, r * 1.04, r * 1.0, r * 1.08), R_(-0.2, r * 0.94, r * 0.92, r * 0.95), R_(-0.34, r * 0.78, r * 0.78, r * 0.74), R_(-len, r * 0.7, r * 0.72, r * 0.66, 0, 0.035)];
const SHIN = (r, len) => [R_(0.02, r * 0.92, r * 0.95, r * 0.9, 0, 0.03), R_(-0.07, r * 0.98, r * 0.92, r * 1.18, -0.004), R_(-0.15, r * 0.96, r * 0.88, r * 1.2, -0.006), R_(-0.28, r * 0.76, r * 0.78, r * 0.8), R_(-len, r * 0.64, r * 0.66, r * 0.64, 0, 0.03)];
const UPPER_ARM = (r, len) => [R_(0.03, r * 0.96, r * 0.95, r * 0.95, 0, 0.03), R_(-0.04, r * 1.08, r * 1.04, r * 1.02), R_(-0.14, r * 0.98, r * 1.02, r * 0.95), R_(-0.25, r * 0.86, r * 0.84, r * 0.86), R_(-len, r * 0.8, r * 0.78, r * 0.8, 0, 0.03)];
const FOREARM = (r, len) => [R_(0.02, r * 0.98, r * 0.95, r * 0.98, 0, 0.025), R_(-0.06, r * 1.06, r * 1.0, r * 1.04), R_(-0.17, r * 0.86, r * 0.8, r * 0.84), R_(-len, r * 0.74, r * 0.66, r * 0.7, 0, 0.02)];
// a work boot: heel, a toe that narrows and lifts a little, the ankle shaft
function bootGeo(k) { const g = new THREE.BoxGeometry(0.1, 0.08, 0.26, 3, 2, 6), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const t = (z + 0.13) / 0.26; // 0 heel … 1 toe
    x *= 1 - 0.28 * Math.pow(Math.max(0, t - 0.55) / 0.45, 1.5) + 0.05 * Math.sin(t * Math.PI); if (y > 0) { y -= 0.03 * Math.max(0, t - 0.45) / 0.55; } if (t > 0.92 && y > -0.02) y -= 0.012;
    if (t < 0.12) z += 0.012 * (y > 0 ? 1 : 0); P.setXYZ(i, x * k, y * k, z * k); }
  g.computeVertexNormals(); return g; }

function hairCanvas(hex, seed) {
  const c = mkCanvas(256, 128), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = hex; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 520; i++) { const x = R() * 256, light = R() < 0.4; g.strokeStyle = light ? 'rgba(255,240,220,.07)' : 'rgba(0,0,0,.22)'; g.lineWidth = 0.6 + R() * 1.2;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (R() - 0.5) * 20, 40, x + (R() - 0.5) * 20, 90, x + (R() - 0.5) * 14, 128); g.stroke(); }
  return c;
}
/* hand-painted face on the skull sphere: u=0.25 is the front, canvas top is the crown */
function faceCanvas(o) {
  const W = 512, H = 256, c = mkCanvas(W, H), g = c.getContext('2d'), R = rng(o.seed * 7 + 1);
  const base = new THREE.Color(o.skin);
  if (o.infected) base.lerp(new THREE.Color('#8f9c8a'), 0.55); else if (o.pale) base.lerp(new THREE.Color('#b9b3ad'), o.pale);
  const hex = '#' + base.getHexString(), dark = '#' + base.clone().multiplyScalar(0.55).getHexString();
  g.fillStyle = hex; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '90,50,40' : '255,230,210'},${0.02 + R() * 0.05})`; g.fillRect(R() * W, R() * H, 1 + R() * 2, 1 + R() * 2); }
  const cx = W * 0.25, ey = H * 0.478, ex = 31;
  const blob = (x, y, rx, ry, col) => { g.save(); g.translate(x, y); g.scale(rx / ry, 1); const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry, 0, 7); g.fill(); g.restore(); };
  // shading: temples, cheek hollows, under-brow
  blob(cx - 62, ey + 4, 30, 40, 'rgba(60,30,25,.22)'); blob(cx + 62, ey + 4, 30, 40, 'rgba(60,30,25,.22)');
  blob(cx, ey - 10, 70, 14, 'rgba(70,40,30,.14)');
  if (!o.infected) { const bl = o.pale ? 0.06 : o.female ? 0.24 : 0.16; blob(cx - 30, ey + 30, 18, 12, `rgba(205,95,90,${bl})`); blob(cx + 30, ey + 30, 18, 12, `rgba(205,95,90,${bl})`); }
  const tired = o.pale || o.infected;
  [-1, 1].forEach(sx => {
    const x = cx + sx * ex;
    blob(x, ey + 1, 17, 11, o.infected ? 'rgba(60,20,30,.55)' : 'rgba(55,30,25,.35)');
    if (tired) blob(x, ey + 11, 15, 7, o.infected ? 'rgba(70,30,50,.5)' : 'rgba(80,50,70,.38)');
    if (o.infected) {
      g.fillStyle = '#dcd6bf'; g.beginPath(); g.ellipse(x, ey + 1, 9, 5, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(140,30,30,.8)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#2a1414'; g.beginPath(); g.arc(x, ey + 1, 1.6, 0, 7); g.fill();
    } else if (o.downcast) { // lowered lids, looking down at the baby
      g.strokeStyle = '#1e130f'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - 9, ey + 1); g.quadraticCurveTo(x, ey + 6, x + 9, ey + 1); g.stroke();
      g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x + i * 2.6, ey + 4.5); g.lineTo(x + i * 3, ey + 7.5); g.stroke(); }
    } else {
      g.fillStyle = '#e9dfd2'; g.beginPath(); g.ellipse(x, ey + 1, 8.5, 4.2, 0, 0, 7); g.fill();
      g.fillStyle = '#2b1c14'; g.beginPath(); g.arc(x + sx * 0.5, ey + 1, 3.6, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - 1, ey - 1, 1.5, 1.5);
      g.strokeStyle = '#1e130f'; g.lineWidth = o.female ? 2.2 : 1.6; g.beginPath(); g.moveTo(x - 9.5, ey + 1); g.quadraticCurveTo(x, ey - 5.5, x + 9.5, ey); g.stroke();
      if (o.female) { g.lineWidth = 1.4; for (let i = 0; i < 5; i++) { const lx = x - 6 + i * 3 + sx * 1.5; g.beginPath(); g.moveTo(lx, ey - 3.8 + Math.abs(i - 2) * 0.6); g.lineTo(lx + sx * 2.2, ey - 7 + Math.abs(i - 2) * 0.5); g.stroke(); } // lashes, flicked out
        g.lineWidth = 2.6; g.beginPath(); g.moveTo(x + sx * 8, ey - 0.5); g.lineTo(x + sx * 12.5, ey - 3.2); g.stroke(); }
    }
    // brows
    g.strokeStyle = o.hair || '#2a1d14'; g.lineWidth = o.female ? 2.4 : 3.6; g.lineCap = 'round'; g.beginPath();
    const by = ey - 15, tilt = o.infected ? 6 : (o.downcast ? -3 : 0);
    g.moveTo(x - sx * 11, by + (sx < 0 ? tilt : -tilt) * 0.2 + 2); g.quadraticCurveTo(x, by - 3 + (o.infected ? 4 : 0), x + sx * 11, by + (o.infected ? tilt : 2)); g.stroke();
  });
  // nose shadow + nostrils
  g.strokeStyle = 'rgba(70,40,30,.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 5, ey + 4); g.quadraticCurveTo(cx - 8, ey + 18, cx - 6, ey + 24); g.stroke();
  g.fillStyle = 'rgba(50,25,20,.45)'; g.beginPath(); g.ellipse(cx - 5, ey + 25, 2.6, 1.6, 0, 0, 7); g.ellipse(cx + 5, ey + 25, 2.6, 1.6, 0, 0, 7); g.fill();
  // mouth
  const my = H * 0.62;
  if (o.infected) { blob(cx, my, 18, 10, 'rgba(25,8,8,.9)'); blob(cx, my + 12, 20, 14, 'rgba(80,10,10,.45)'); }
  else if (o.female) { // lips: a bow on top, a fuller lower lip with a little light on it
    const lc = o.pale ? '#a87f84' : (o.lip || '#b4555a'); g.fillStyle = lc; g.beginPath(); g.moveTo(cx - 13, my); g.quadraticCurveTo(cx - 6, my - 5, cx, my - 2.5); g.quadraticCurveTo(cx + 6, my - 5, cx + 13, my); g.quadraticCurveTo(cx, my + 8, cx - 13, my); g.fill();
    g.strokeStyle = 'rgba(60,20,20,.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - 12, my + 0.3); g.quadraticCurveTo(cx, my + 1.6, cx + 12, my + 0.3); g.stroke(); blob(cx, my + 3.5, 5, 2, 'rgba(255,230,220,.35)');
  } else { g.strokeStyle = o.pale ? 'rgba(140,90,95,.75)' : 'rgba(120,60,50,.7)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 12, my); g.quadraticCurveTo(cx, my + (o.downcast ? 1 : 3), cx + 12, my); g.stroke(); blob(cx, my + 7, 10, 4, 'rgba(70,35,30,.18)'); }
  // stubble
  if (!o.female && !o.infected) for (let i = 0; i < 260; i++) { const a = R() * 6.28, r = 26 + R() * 30; g.fillStyle = 'rgba(40,25,18,.18)'; g.fillRect(cx + Math.cos(a) * r * 1.2, my + 6 + Math.abs(Math.sin(a)) * r * 0.5, 1, 1); }
  // veins: temples and cheeks for the infected and the half-turned
  if (o.infected || o.pale) {
    g.strokeStyle = o.infected ? 'rgba(60,35,85,.75)' : 'rgba(95,70,120,.45)';
    for (let i = 0; i < (o.infected ? 16 : 7); i++) {
      let x = cx + (R() < 0.5 ? -1 : 1) * (45 + R() * 30), y = ey - 30 + R() * 60; g.lineWidth = 0.8 + R() * 1.4; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 16; y += 4 + R() * 9; g.lineTo(x, y); } g.stroke();
    }
  }
  return c;
}

hairCanvas = memoCanvas(hairCanvas); faceCanvas = memoCanvas(faceCanvas);

function makeHuman(o) {
  o = Object.assign({
    height: 1.75, girth: 1, female: false, skin: '#c99a78', top: '#4b5a52', topWear: 0.3, bottom: '#33302c', bottomWear: 0.3,
    shoes: '#211a15', hair: '#22170f', hairStyle: 'short', infected: false, pale: 0, blood: false, seed: 1,
    coat: null, skirtLen: 'long', legs: null, shoeStyle: 'boots', nurseCap: false, vest: null, apron: false, hood: false, cap: null, scarf: null, skirt: null, backpack: null, collar: null, tie: null, lanyard: false
  }, o);
  const s = o.height / 1.75, g = o.girth, sg = Math.sqrt(g);
  const M = (col, r = 0.9) => new THREE.MeshStandardMaterial({ color: col, roughness: r });
  const skinMat = new THREE.MeshStandardMaterial({ map: toTex(skinCanvas(o.skin, o.infected, o.pale)), roughness: 0.58 });
  const topMat = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(o.top, o.topWear, o.blood, o.seed)), roughness: 0.93 });
  const botMat = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(o.bottom, o.bottomWear, o.blood && o.infected, o.seed + 3)), roughness: 0.93 });
  const coatMat = o.coat ? new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(o.coat, 0.55, o.blood, o.seed + 7)), roughness: 0.95 }) : topMat;
  const shoeMat = M(o.shoes, 0.65), hairMat = new THREE.MeshStandardMaterial({ map: toTex(hairCanvas(o.hair, o.seed + 5)), roughness: 0.62, side: THREE.DoubleSide });
  const add = (p, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const pelvisY0 = 0.93 * s, pelvis = new THREE.Group(); pelvis.position.y = pelvisY0; body.add(pelvis);
  const hw = g * (o.female ? 1.08 : 1), hd = Math.pow(g, 0.9); // the seat of the trousers: hips, and the buttocks behind
  const hips = add(pelvis, new THREE.Mesh(shellGeo([R_(0.06, 0.145 * hw, 0.094 * hd, 0.1 * hd, 0, 0.01), R_(0.0, 0.156 * hw, 0.1 * hd, 0.12 * hd), R_(-0.06, 0.152 * hw, 0.092 * hd, 0.122 * hd), R_(-0.11, 0.125 * hw, 0.072 * hd, 0.09 * hd, 0, 0.03)], s, 18, 2.4), o.skirt ? new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(o.skirt, 0.4, false, o.seed + 9)), roughness: 0.95 }) : botMat), 0, 0, 0);
  const longSkirt = o.skirt && o.skirtLen !== 'knee'; // a long skirt wraps each leg; a short one leaves legs in tights or bare
  const legMat = longSkirt ? hips.material : o.skirt ? (o.legs ? new THREE.MeshStandardMaterial({ color: o.legs, roughness: 0.5 }) : skinMat) : botMat;
  const mkLeg = side => {
    const hip = new THREE.Group(); hip.position.set(side * 0.088 * s * g, -0.03 * s, 0); pelvis.add(hip);
    const tl = 0.43 * s, tr = (longSkirt ? 0.095 : o.female ? 0.07 : 0.074) * s * sg;
    if (longSkirt) add(hip, capsule(tr, tl - tr, legMat), 0, -tl / 2, 0); else add(hip, new THREE.Mesh(shellGeo(THIGH(tr / s, 0.43), s, 14), legMat), 0, 0, 0);
    const knee = new THREE.Group(); knee.position.y = -tl; hip.add(knee);
    const sl = 0.42 * s, sr = (longSkirt ? 0.085 : o.female ? 0.052 : 0.057) * s * sg;
    if (longSkirt) add(knee, capsule(sr, sl - sr, legMat), 0, -sl / 2, 0); else add(knee, new THREE.Mesh(shellGeo(SHIN(sr / s, 0.42), s, 14), legMat), 0, 0, 0);
    if (o.shoeStyle === 'tall') add(knee, new THREE.Mesh(shellGeo(SHIN(sr / s * 1.12, 0.42).slice(1).map(r => Object.assign({}, r, { y: Math.min(r.y, -0.08) })), s, 12), shoeMat), 0, 0, 0); // riding boots to below the knee
    const ankle = new THREE.Group(); ankle.position.y = -sl; knee.add(ankle);
    let foot;
    if (o.shoeStyle === 'heels') { // a court shoe: pointed toe down on the ground, the heel up on a spike
      foot = add(ankle, new THREE.Mesh(shellGeo([R_(0.0, 0.03, 0.03, 0.03, 0, 0.01), R_(-0.09, 0.034, 0.02, 0.02), R_(-0.17, 0.022, 0.012, 0.012, 0, 0.03)], s, 10, 2.2), shoeMat), 0, -0.02 * s, -0.035 * s); foot.rotation.x = -Math.PI / 2 + 0.38;
      const spike = add(ankle, new THREE.Mesh(new THREE.CylinderGeometry(0.006 * s, 0.009 * s, 0.05 * s, 6), shoeMat), 0, -0.05 * s, -0.04 * s); spike.castShadow = false;
    } else if (o.shoeStyle === 'flats') { foot = add(ankle, new THREE.Mesh(bootGeo(s * 0.9), shoeMat), 0, -0.022 * s, 0.05 * s); foot.scale.y = 0.6; }
    else foot = add(ankle, new THREE.Mesh(bootGeo(s), shoeMat), 0, -0.015 * s, 0.055 * s);
    return { hip, knee, ankle, foot };
  };
  const L = mkLeg(1), R = mkLeg(-1);

  const spine = new THREE.Group(); spine.position.y = 0.05 * s; pelvis.add(spine);
  const torso = add(spine, new THREE.Mesh(shellGeo(torsoRings(g, o.female), s, 20, o.female ? 2.25 : 2.6), coatMat), 0, 0, 0);
  const chest = new THREE.Group(); chest.position.y = 0.42 * s; spine.add(chest);
  const neck = add(chest, new THREE.Mesh(new THREE.CylinderGeometry((o.female ? 0.047 : 0.054) * s * sg, (o.female ? 0.058 : 0.066) * s * sg, 0.13 * s, 12), skinMat), 0, 0.075 * s, 0.002 * s);
  if (o.skirt && o.skirtLen === 'knee') {
    const prof = [[0.15, 0.04], [0.162, -0.06], [0.17, -0.2], [0.168, -0.34]].map(([r, y]) => new THREE.Vector2(r * s * hw, y * s));
    const sk = add(pelvis, new THREE.Mesh(new THREE.LatheGeometry(prof, 18), new THREE.MeshStandardMaterial({ map: hips.material.map, roughness: 0.92, side: THREE.DoubleSide })), 0, 0, 0); sk.scale.z = 0.8 * hd / hw;
  }
  if (o.vest) { // a high-visibility vest over the work clothes
    const vm = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(o.vest, 0.5, o.blood, o.seed + 19)), roughness: 0.8 });
    const vr = torsoRings(g, o.female).filter(r => r.y > -0.02 && r.y < 0.44).map(r => Object.assign({}, r, { w: r.w + 0.012, f: r.f + 0.012, b: r.b + 0.012 }));
    add(spine, new THREE.Mesh(shellGeo(vr, s, 20, 2.6), vm), 0, 0, 0);
  }
  if (o.coat) { // coat skirt + collar
    const prof = [[0.16, 0.06], [0.175, -0.04], [0.205, -0.2], [0.225, -0.36]].map(([r, y]) => new THREE.Vector2(r * s * g, y * s));
    const cs = add(pelvis, new THREE.Mesh(new THREE.LatheGeometry(prof, 18), new THREE.MeshStandardMaterial({ map: coatMat.map, roughness: 0.95, side: THREE.DoubleSide })), 0, 0, 0);
    cs.scale.z = 0.82;
    const col = add(chest, new THREE.Mesh(new THREE.TorusGeometry((o.female ? 0.066 : 0.075) * s * sg, (o.female ? 0.017 : 0.026) * s, 8, 18), coatMat), 0, 0.03 * s, 0.004 * s); col.rotation.x = Math.PI / 2; col.scale.set(1.15, 1, 1);
  }
  if (o.apron) {
    const am = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(o.apronCol || '#c9c2b2', 0.6, o.apronCol ? o.blood : true, o.seed + 11)), roughness: 0.9 });
    am.side = THREE.DoubleSide; const fr = torsoRings(g, o.female), front = y => { let a = fr[0]; for (const r of fr) if (r.y <= y) a = r; return a.f; };
    const panel = (r0, r1, hgt, arc) => { const gm = new THREE.CylinderGeometry(r0, r1, hgt, 12, 4, true, -arc / 2, arc); return gm; };
    const up = add(spine, new THREE.Mesh(panel(front(0.36) * s + 0.012, front(0.1) * s + 0.016, 0.36 * s, 1.9), am), 0, 0.2 * s, 0); up.scale.x = 1.35; // bib over chest and belly
    const lo = add(pelvis, new THREE.Mesh(panel(0.115 * s * g + 0.02, 0.15 * s * g + 0.02, 0.46 * s, 1.7), am), 0, -0.2 * s, 0.01 * s); lo.scale.x = 1.3; lo.rotation.x = -0.06; // skirt to the knee
  }
  if (o.collar) { const c = add(chest, new THREE.Mesh(new THREE.TorusGeometry(0.07 * s, 0.022 * s, 6, 14), M(o.collar, 0.8)), 0, 0.0, 0.01); c.rotation.x = Math.PI / 2 - 0.3; }
  if (o.tie) { const t = add(spine, new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.26 * s, 0.01), M(o.tie, 0.6)), 0, 0.27 * s, 0.118 * s * g); t.rotation.x = -0.1; }
  if (o.lanyard) {
    add(spine, new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.07 * s, 0.008), M('#e8e6df', 0.5)), 0.04 * s, 0.2 * s, 0.125 * s * g);
    const ly = add(spine, new THREE.Mesh(new THREE.TorusGeometry(0.09 * s, 0.005, 4, 16, Math.PI), M('#2d4f7a', 0.6)), 0.0, 0.33 * s, 0.09 * s); ly.rotation.z = Math.PI; ly.rotation.x = 0.4;
  }
  if (o.backpack) {
    const bm = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(o.backpack, 0.6, false, o.seed + 13)), roughness: 0.9 });
    const bp = add(spine, new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.34 * s, 0.14 * s), bm), 0, 0.24 * s, -0.15 * s * g);
    bp.rotation.x = 0.08;
    add(spine, new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.1 * s, 0.1 * s), bm), 0, 0.05 * s, -0.16 * s * g);
  }

  const head = new THREE.Group(); head.position.y = 0.108 * s; chest.add(head);
  const faceMat = new THREE.MeshStandardMaterial({ map: toTex(faceCanvas(o), true, false), roughness: 0.55 });
  const HR = headRings(o.female);
  const skull = add(head, new THREE.Mesh(shellGeo(HR, s, 28, 2.15, true), faceMat), 0, 0, 0);
  if (!['bob', 'long'].includes(o.hairStyle)) [-1, 1].forEach(sx => { const e = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.022 * s, 8, 6), skinMat), sx * (headAt(HR, 0.105).w + 0.002) * s, 0.105 * s, -0.008 * s); e.scale.set(0.45, 1, 0.75); });
  const eyes = [];
  if (o.infected) { const em = new THREE.MeshStandardMaterial({ color: 0xe8e2c8, emissive: 0x8a8460, emissiveIntensity: 0.9 }); [-1, 1].forEach(sx => eyes.push(add(head, new THREE.Mesh(new THREE.SphereGeometry(0.006 * s, 6, 4), em), sx * 0.034 * s, 0.117 * s, (headAt(HR, 0.117).f - 0.004) * s))); } // both eyes glow together: one material
  const nose = add(head, new THREE.Mesh(new THREE.ConeGeometry((o.female ? 0.009 : 0.011) * s, 0.026 * s, 8), faceMat), 0, 0.097 * s, (headAt(HR, 0.097).f - 0.006) * s);
  nose.rotation.x = Math.PI / 2 - 0.35;
  const mouth = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.017 * s, 10, 6), M(o.infected ? '#1a0b0a' : '#4a2a26', 0.7)), 0, 0.066 * s, (headAt(HR, 0.066).f - 0.006) * s);
  mouth.scale.set(1.25, 0.12, 0.35);
  if (o.infected) { const tm = M('#d8cfb4', 0.4); for (let i = 0; i < 4; i++) add(head, new THREE.Mesh(new THREE.BoxGeometry(0.007 * s, 0.009 * s, 0.006 * s), tm), (-0.012 + i * 0.008) * s, 0.071 * s, (headAt(HR, 0.071).f - 0.004) * s); }
  // hair, fitted to the head: it stops at a hairline over the brow and comes down to the nape and over the ears
  const hairOn = (bottom, yf, yb, t = 0.009) => add(head, new THREE.Mesh(shellGeo(overHead(HR, t, bottom, yf, yb), s, 24, 2.15, true), hairMat), 0, 0, 0);
  const hs = o.hairStyle;
  if (hs === 'short') hairOn(0.1, 0.07, -0.055);
  if (hs === 'messy') { hairOn(0.098, 0.068, -0.05, 0.011); for (let i = 0; i < 7; i++) { const t = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.02 * s, 0.07 * s, 5), hairMat), rnd(-0.06, 0.06) * s, 0.205 * s, rnd(-0.07, 0.03) * s); t.rotation.set(rnd(-0.8, 0.4), 0, rnd(-0.8, 0.8)); } }
  if (hs === 'bun') { hairOn(0.1, 0.068, -0.045); const bun = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.046 * s, 14, 12), hairMat), 0, 0.175 * s, -0.1 * s); bun.scale.set(1.1, 0.9, 1); }
  if (hs === 'ponytail') { hairOn(0.1, 0.068, -0.04);
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.025 * s, 10, 8), hairMat), 0, 0.175 * s, -0.105 * s);
    const tail = add(head, capsule(0.03 * s, 0.17 * s, hairMat), 0, 0.085 * s, -0.135 * s); tail.rotation.x = 0.3; tail.scale.set(1, 1, 0.75); }
  if (hs === 'bob') hairOn(0.058, 0.09, 0.0, 0.015);
  if (hs === 'long') { hairOn(0.07, 0.08, -0.02, 0.015); const b = add(head, capsule(0.075 * s, 0.17 * s, hairMat), 0, 0.03 * s, -0.07 * s); b.scale.set(1.25, 1, 0.5); }
  if (hs === 'sparse') hairOn(0.12, 0.05, -0.08, 0.005);
  if (o.cap) { const cm = M(o.cap, 0.95); add(head, new THREE.Mesh(shellGeo(overHead(HR, 0.022, 0.148, 0.012, -0.012, [0.236, 0.222, 0.2, 0.176]), s, 24, 2.15, true), cm), 0, 0, 0);
    const pk = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.075 * s, 0.075 * s, 0.008 * s, 16, 1, false, -1.1, 2.2), cm), 0, 0.152 * s, (headAt(HR, 0.15).f - 0.02) * s); pk.scale.set(1.1, 1, 0.75); pk.rotation.x = 0.12; } // the peak
  if (o.nurseCap) { const nc = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.035 * s, 0.07 * s), M('#f1f0ea', 0.8)), 0, 0.232 * s, 0.025 * s); nc.rotation.x = -0.35; }
  if (o.helmet) { // firefighter's helmet: dome, ridge, wide back brim
    const hm = M(o.helmet, 0.55), dome = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.128 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hm), 0, 0.13 * s, -0.01); dome.scale.set(0.95, 1.0, 1.08);
    add(head, new THREE.Mesh(new THREE.BoxGeometry(0.02 * s, 0.03 * s, 0.24 * s), hm), 0, 0.245 * s, -0.01);
    const brim = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.012 * s, 20), hm), 0, 0.12 * s, -0.035 * s); brim.scale.set(0.95, 1, 1.12); brim.rotation.x = -0.12;
  }
  if (o.hood) { const hd = add(chest, new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.045 * s, 8, 16), coatMat), 0, 0.06 * s, -0.06 * s); hd.rotation.x = Math.PI / 2 + 0.5; }

  // arms
  const mkArm = side => {
    const sh = new THREE.Group(); sh.position.set(side * (o.female ? 0.172 : 0.198) * s * g, 0.015 * s, 0); sh.userData.y0 = sh.position.y; chest.add(sh);
    const delt = add(sh, new THREE.Mesh(new THREE.SphereGeometry((o.female ? 0.046 : 0.058) * s * sg, 12, 10), coatMat), -side * 0.01 * s, -0.035 * s, 0); delt.scale.set(1.0, 0.92, 1.1); // the deltoid, rounding the shoulder into the arm
    const ul = 0.29 * s, ur = (o.female ? 0.042 : 0.052) * s * sg;
    add(sh, new THREE.Mesh(shellGeo(UPPER_ARM(ur / s, 0.29), s, 12), coatMat), 0, 0, 0);
    const el = new THREE.Group(); el.position.y = -ul; sh.add(el);
    const fl = 0.26 * s, fr = (o.female ? 0.036 : 0.044) * s * sg;
    add(el, new THREE.Mesh(shellGeo(FOREARM(fr / s, 0.26), s, 12), o.sleeves === 'short' ? skinMat : coatMat), 0, 0, 0);
    const hand = new THREE.Group(); hand.position.y = -fl - 0.01 * s; el.add(hand);
    const hw = o.female ? 0.88 : 1, hm = add(hand, new THREE.Mesh(shellGeo([R_(0.012, 0.03 * hw, 0.017, 0.018, 0, 0.008), R_(-0.025, 0.04 * hw, 0.022, 0.022), R_(-0.06, 0.042 * hw, 0.02, 0.024, 0.004), R_(-0.088, 0.034 * hw, 0.016, 0.02, 0.008, 0.012)], s, 10, 2.2), skinMat), 0, 0, 0.004 * s);
    const th = add(hand, capsule(0.012 * s, 0.03 * s, skinMat), side * 0.03 * s * hw, -0.03 * s, 0.018 * s); th.rotation.set(0.5, 0, side * 0.5); // the thumb
    return { sh, el, hand };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  if (o.stripes) { // reflective tape: two bands round the coat, one on each sleeve and each shin
    const tape = new THREE.MeshStandardMaterial({ color: 0xc9c48e, roughness: 0.35, metalness: 0.25, emissive: 0x24231a });
    [0.08, 0.3].forEach(y => { const b = add(spine, new THREE.Mesh(new THREE.CylinderGeometry(0.152 * s * g, 0.152 * s * g, 0.028 * s, 18, 1, true), tape), 0, y * s, 0); b.scale.set(o.female ? 1.03 : 1.15, 1, 0.78); });
    [armL, armR].forEach(a => add(a.el, new THREE.Mesh(new THREE.CylinderGeometry(0.047 * s * sg, 0.047 * s * sg, 0.026 * s, 12, 1, true), tape), 0, -0.13 * s, 0));
    [L, R].forEach(l => add(l.knee, new THREE.Mesh(new THREE.CylinderGeometry(0.061 * s * sg, 0.061 * s * sg, 0.026 * s, 12, 1, true), tape), 0, -0.26 * s, 0));
  }
  if (o.scarf) {
    const sm = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(o.scarf, 0.4, false, o.seed + 17)), roughness: 1 });
    const ring = add(chest, new THREE.Mesh(new THREE.TorusGeometry(0.075 * s, 0.038 * s, 8, 18), sm), 0, 0.045 * s, 0.005); ring.rotation.x = Math.PI / 2 - 0.15;
    const tail = []; let par = new THREE.Group(); par.position.set(0.045 * s, 0.02 * s, 0.085 * s); chest.add(par);
    for (let i = 0; i < 4; i++) { const seg = new THREE.Group(); seg.position.y = i ? -0.085 * s : 0; par.add(seg);
      add(seg, new THREE.Mesh(new THREE.BoxGeometry(0.075 * s, 0.09 * s, 0.022 * s), sm), 0, -0.042 * s, 0); tail.push(seg); par = seg; }
    o._scarf = tail;
  }
  const h = { root, body, pelvis, pelvisY0, spine, chest, head, neck, L, R, armL, armR, mouth, eyes, s, o, cur: Object.assign({}, NEUTRAL), skinMat, topMat, botMat, coatMat, faceMat, cut: {}, loose: {}, drop: { L: 0, R: 0 }, sprK: null };
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // a few millimetres of ear, nose and teeth throw no shadow worth drawing
  root.traverse(m => { if (!m.isMesh) return; const gm = m.geometry; if (!gm.boundingSphere) gm.computeBoundingSphere(); if (gm.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < 0.045) m.castShadow = false; });
  root.userData.human = true;
  applyPose(h); skinHuman(h);
  if (o.assetId) { loadChar(o.assetId); if (CHAR_ASSETS[o.assetId]) fleshUp(h, CHAR_ASSETS[o.assetId]); else if (CHAR_WAIT[o.assetId]) CHAR_WAIT[o.assetId].push(h); }
  return h;
}

/* ---------- the body drawn the way games draw characters ----------
   Every part stays in the rig as an invisible bone (layer 31), so poses, springs, a crushed skull, a dropping jaw and a
   severed arm still move exactly what they moved before. A skinned copy draws them: all of a body's textures packed into
   one atlas, each part's colour and roughness carried in its vertices, so the whole body is one draw (plus the glowing
   eyes); and one more copy, shown only while shadows are drawn, throws the whole body's shadow in one */
const SKIN_LAYER = 31, _skM = new THREE.Matrix4(), _skN = new THREE.Matrix3(), _skV = new V3(), _skZero = new THREE.Matrix4().makeScale(0, 0, 0);
const SKIN_BOUNDS = new THREE.Sphere(new V3(0, 0.9, 0), 2.1); // generous: arms out, lying flat
const SKIN_SHADOW_MAT = new THREE.MeshBasicMaterial(); // one-sided; a two-sided part is baked in twice, once each way round
const ATLAS_PAD = 4;
function skinKey(m) { // identical plain materials draw together; anything textured, glowing or odd keeps its own
  if (m.type !== 'MeshStandardMaterial' || m.map || m.emissive.getHex() !== 0 || m.transparent) return m.uuid;
  return [m.color.getHex(), m.roughness, m.metalness, m.side, m.flatShading].join('|');
}
// what can share the body's one material: lit, not glowing, not see-through, not metal, its texture (if any) a painted canvas
function atlasable(m) { return m.type === 'MeshStandardMaterial' && m.emissive.getHex() === 0 && !m.transparent && m.metalness === 0 && !m.bumpMap && !m.normalMap && !m.flatShading && m.side !== THREE.BackSide && (!m.map || !!(m.map.image && m.map.image.getContext)); }
// spheres and capsules nudge u half a segment past the edge at their poles, where every vertex meets anyway: clamped, nothing moves
function uvInside(g) { const U = g.attributes.uv; if (!U) return false; for (let j = 0; j < U.count; j++) { const u = U.getX(j), v = U.getY(j); if (u < -0.13 || u > 1.13 || v < -0.13 || v > 1.13) return false; } return true; }
function bodyAtlas(images) {
  const W = 1024, P = ATLAS_PAD, rects = new Map(), white = { width: 8, height: 8 }, list = [...images].sort((a, b) => b.height - a.height); list.push(white);
  let x = 0, y = 0, row = 0;
  for (const im of list) { const w = im.width + 2 * P, h = im.height + 2 * P; if (x + w > W) { x = 0; y += row; row = 0; } rects.set(im, { x: x + P, y: y + P, w: im.width, h: im.height }); x += w; row = Math.max(row, h); }
  let H = 64; while (H < y + row) H *= 2;
  const c = mkCanvas(W, H), A = { c, g: c.getContext('2d'), W, H, rects, white: rects.get(white), tex: null };
  for (const im of images) atlasDraw(A, im, rects.get(im));
  const wr = A.white; A.g.fillStyle = '#fff'; A.g.fillRect(wr.x - P, wr.y - P, wr.w + 2 * P, wr.h + 2 * P);
  A.tex = toTex(c, true, false); return A;
}
function atlasDraw(A, im, r) { // the image, with its edge pixels smeared into the padding so filtering never reaches a neighbour
  const g = A.g, P = ATLAS_PAD, iw = im.width, ih = im.height, { x, y, w, h } = r;
  g.drawImage(im, x, y, w, h);
  g.drawImage(im, 0, 0, 1, ih, x - P, y, P, h); g.drawImage(im, iw - 1, 0, 1, ih, x + w, y, P, h); g.drawImage(im, 0, 0, iw, 1, x, y - P, w, P); g.drawImage(im, 0, ih - 1, iw, 1, x, y + h, w, P);
  g.drawImage(im, 0, 0, 1, 1, x - P, y - P, P, P); g.drawImage(im, iw - 1, 0, 1, 1, x + w, y - P, P, P); g.drawImage(im, 0, ih - 1, 1, 1, x - P, y + h, P, P); g.drawImage(im, iw - 1, ih - 1, 1, 1, x + w, y + h, P, P);
}
// a wound painted on a part's own texture (p6) is copied into its body's atlas
function atlasRefresh(mat) { const a = mat && mat.userData.atlas; if (!a || !mat.map || !mat.map.image) return; atlasDraw(a.A, mat.map.image, a.rect); a.A.tex.needsUpdate = true; }
// roughness read from the vertices instead of the material
const BODY_ROUGH = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float rough;\nvarying float vRough;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRough = rough;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRough;').replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRough;');
};
// items: { i: part index, rev: a second, inside-out copy for a two-sided part, rect: atlas rectangle (or the white patch), col, rough }
function bakeSkinned(parts, items, rootInv, opt) {
  let nv = 0, ni = 0; for (const it of items) { const g = parts[it.i].geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const main = opt.main, A = opt.A, pos = new Float32Array(nv * 3), nor = main ? new Float32Array(nv * 3) : null, uvs = main ? new Float32Array(nv * 2) : null;
  const col = A ? new Float32Array(nv * 3) : null, rgh = A ? new Float32Array(nv) : null, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), ix = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, k = 0;
  for (const it of items) {
    const m = parts[it.i], g = m.geometry, Pa = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index, s = it.rev ? -1 : 1;
    _skM.multiplyMatrices(rootInv, m.matrixWorld); _skN.getNormalMatrix(_skM); const flip = (_skM.determinant() < 0) !== !!it.rev;
    for (let j = 0; j < Pa.count; j++) {
      const o = v + j; _skV.fromBufferAttribute(Pa, j).applyMatrix4(_skM); pos[o * 3] = _skV.x; pos[o * 3 + 1] = _skV.y; pos[o * 3 + 2] = _skV.z;
      if (main) { _skV.fromBufferAttribute(N, j).applyMatrix3(_skN).normalize().multiplyScalar(s); nor[o * 3] = _skV.x; nor[o * 3 + 1] = _skV.y; nor[o * 3 + 2] = _skV.z;
        let u = U ? U.getX(j) : 0, w = U ? U.getY(j) : 0;
        if (A) { const r = it.rect; if (r === A.white) { u = 0.5; w = 0.5; } u = clamp(u, 0, 1); w = clamp(w, 0, 1); u = (r.x + u * r.w) / A.W; w = 1 - (r.y + (1 - w) * r.h) / A.H; col[o * 3] = it.col.r; col[o * 3 + 1] = it.col.g; col[o * 3 + 2] = it.col.b; rgh[o] = it.rough; }
        uvs[o * 2] = u; uvs[o * 2 + 1] = w; }
      si[o * 4] = it.i; sw[o * 4] = 1;
    }
    const n = I ? I.count : Pa.count;
    for (let j = 0; j < n; j += 3) { const a = (I ? I.getX(j) : j) + v, b = (I ? I.getX(j + 1) : j + 1) + v, c = (I ? I.getX(j + 2) : j + 2) + v; ix[k++] = a; ix[k++] = flip ? c : b; ix[k++] = flip ? b : c; }
    v += Pa.count;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (main) { geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); }
  if (A) { geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('rough', new THREE.BufferAttribute(rgh, 1)); }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); geo.setIndex(new THREE.BufferAttribute(ix, 1));
  geo.boundingSphere = SKIN_BOUNDS.clone(); return geo;
}
function skinHuman(h) {
  const root = h.root; root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert(), parts = []; root.traverse(o => { if (o.isMesh) parts.push(o); });
  const skel = new THREE.Skeleton(parts, parts.map(m => m.matrixWorld.clone().invert()));
  // a part is drawn while it and every group above it are visible, and until it is torn off (then it is drawn as itself)
  const chains = parts.map(m => { const c = []; for (let o = m; o && o !== root; o = o.parent) c.push(o); return c; });
  skel.update = function () {
    const out = this.boneMatrices, inv = this.boneInverses;
    for (let i = 0; i < parts.length; i++) {
      const m = parts[i]; let on = !m.userData.skinOff; if (on) for (const o of chains[i]) if (!o.visible) { on = false; break; }
      (on ? _skM.multiplyMatrices(m.matrixWorld, inv[i]) : _skZero).toArray(out, i * 16);
    }
    if (this.boneTexture) this.boneTexture.needsUpdate = true;
  };
  const bind = (geo, mat) => { const sm = new THREE.SkinnedMesh(geo, mat); root.add(sm); sm.bind(skel, root.matrixWorld); return sm; };
  h.skinned = [];
  // the body's one material: every part that can share it, textures packed into one atlas
  const inAtlas = [], rest = [];
  parts.forEach((m, i) => (atlasable(m.material) && (!m.material.map || uvInside(m.geometry)) ? inAtlas : rest).push(i));
  if (new Set(inAtlas.map(i => parts[i].material)).size > 1) {
    const images = new Set(); for (const i of inAtlas) if (parts[i].material.map) images.add(parts[i].material.map.image);
    const A = bodyAtlas(images), items = [];
    for (const i of inAtlas) {
      const mt = parts[i].material, rect = mt.map ? A.rects.get(mt.map.image) : A.white; if (mt.map) mt.userData.atlas = { A, rect };
      const it = { i, rect, col: mt.color, rough: mt.roughness }; items.push(it); if (mt.side === THREE.DoubleSide) items.push(Object.assign({}, it, { rev: true }));
    }
    const bm = new THREE.MeshStandardMaterial({ map: A.tex, vertexColors: true, roughness: 1, metalness: 0 }); bm.onBeforeCompile = BODY_ROUGH; bm.customProgramCacheKey = () => 'body-atlas';
    const sm = bind(bakeSkinned(parts, items, rootInv, { main: true, A }), bm); sm.receiveShadow = true; h.skinned.push(sm); h.atlas = A; h.bodyMat = bm;
  } else rest.push(...inAtlas);
  // the rest (the eyes that glow, reflective tape), one draw per look
  const groups = new Map(); for (const i of rest) { const m = parts[i], key = skinKey(m.material); let g = groups.get(key); if (!g) groups.set(key, g = { mat: m.material, items: [] }); g.items.push({ i }); }
  for (const { mat, items } of groups.values()) { const sm = bind(bakeSkinned(parts, items, rootInv, { main: true }), mat); sm.receiveShadow = true; h.skinned.push(sm); }
  // the shadow: one-sided parts once, two-sided parts once each way round
  const cast = []; parts.forEach((m, i) => { if (!m.castShadow) return; const sd = m.material.side; if (sd !== THREE.BackSide) cast.push({ i }); if (sd !== THREE.FrontSide) cast.push({ i, rev: true }); });
  const sh = bind(bakeSkinned(parts, cast, rootInv, {}), SKIN_SHADOW_MAT); sh.castShadow = true; sh.visible = false; h.shadows = [sh];
  for (const m of parts) { m.layers.set(SKIN_LAYER); m.userData.skinned = true; }
  root.traverse(o => { o.userData.rigNode = true; }); // whatever is added to the rig later (weapons, lantern, baby, stumps) is gear
  h.skel = skel; h.parts = parts;
}
// a part torn off the body (an arm, a leg, the head) leaves the skinned copy and is drawn as itself again
function unskin(part) {
  const merged = [];
  part.traverse(o => {
    if (o.userData.skinned && !o.userData.skinOff) { o.userData.skinOff = true; o.layers.set(0); }
    if (o.userData.batched) { o.layers.set(0); o.userData.batched = false; } // drawn through a batch until now: on its own from here
    if (o.userData.batchMesh) merged.push(o);
  });
  for (const m of merged) if (m.parent) m.parent.remove(m); // the batches it was in stay behind with what didn't fly off
  part.traverse(o => { if (o.userData.rb) { o.userData.rb.sig = -1; o.userData.rb.meshes = []; o.userData.rb.shadows = []; } });
}


/* ---------- realistic bodies: one continuous mesh per character, sculpted, retopologised and baked offline ----------
   It is skinned with smooth weights to the same rig nodes the rigid parts hang from, so every pose, spring, hit reaction
   and planted foot drives it unchanged, and the rigid parts stay on as invisible stand-ins for hit tests and severed
   pieces. A limb cut off folds its share of the body into the stump; wounds are painted into the body's own texture
   where they land; blood loss pales only the skin; the infected's eyes catch light. Near: ~8k triangles; far and in
   shadow maps: ~2.4k. Until (or unless) a character's files load, the stand-in body is what you see. */
const CHAR_DIR = 'chars/', CHAR_ASSETS = {}, CHAR_WAIT = {}, FLESH_NEAR = 9, FLESH_FAR = 10.5;
function loadChar(id) {
  if (CHAR_ASSETS[id] || CHAR_WAIT[id]) return;
  CHAR_WAIT[id] = [];
  const get = (url, type) => new Promise((res, rej) => { const x = new XMLHttpRequest(); x.open('GET', url); x.responseType = type; x.onload = () => (x.status === 200 || x.status === 0) && x.response ? res(x.response) : rej(url); x.onerror = () => rej(url); x.send(); });
  const img = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(url); im.src = url; });
  Promise.all([get(CHAR_DIR + id + '.mesh.json', 'json'), get(CHAR_DIR + id + '.mesh.bin', 'arraybuffer'), img(CHAR_DIR + id + '_albedo.webp'), img(CHAR_DIR + id + '_nrm.webp'), img(CHAR_DIR + id + '_mr.webp')])
    .then(([meta, bin, alb, nrm, mr]) => {
      const tex = (im, srgb) => { const t = new THREE.Texture(im); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.needsUpdate = true; t.userData.keep = true; return t; };
      const A = CHAR_ASSETS[id] = { id, meta, lods: meta.lods.map(L => charGeo(L, bin)), alb, nrmTex: tex(nrm, false), mrTex: tex(mr, false) };
      for (const h of CHAR_WAIT[id]) if (!h.dead) fleshUp(h, A);
      CHAR_WAIT[id] = null;
    })
    .catch(e => { console.warn('character files missing, keeping the stand-in body:', id, e); CHAR_WAIT[id] = null; CHAR_ASSETS[id] = null; });
}
function charGeo(L, bin) {
  const arr = (k, T) => { const [off, , n] = L.buf[k]; return new T(bin, off, n); };
  const qp = arr('pos', Uint16Array), lo = L.lo, hi = L.hi, n = L.nv, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) pos[i * 3 + c] = lo[c] + qp[i * 3 + c] / 65535 * (hi[c] - lo[c]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(arr('nrm', Int8Array), 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(arr('uv', Uint16Array), 2, true));
  g.setAttribute('tangent', new THREE.BufferAttribute(arr('tan', Int8Array), 4, true));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(arr('si', Uint8Array), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(arr('sw', Uint8Array), 4, true));
  g.setIndex(new THREE.BufferAttribute(L.buf.idx[1] === 'uint32' ? arr('idx', Uint32Array) : arr('idx', Uint16Array), 1));
  g.boundingSphere = SKIN_BOUNDS.clone(); g.userData.keep = true; return g;
}
const _flP = new V3(), _flM = new THREE.Matrix4(), _flCam = new V3();
function fleshUp(h, A) {
  if (h.flesh || !A) return;
  const map = A.meta.bones, rb = RIG_BONES(h), bones = map.map(k => rb[k]);
  // bind in the pose it was sculpted in (springs off), then go back to whatever pose it had
  const keep = h.cur, spr = h.spr; h.spr = null; h.cur = Object.assign({}, NEUTRAL, BIND); applyPose(h); h.root.updateMatrixWorld(true);
  const inv = bones.map(b => b.matrixWorld.clone().invert());
  const info = bones.map(b => { let p = b.parent, pi = -1; while (p && pi < 0) { pi = bones.indexOf(p); p = p.parent; } return { parent: b.parent, local: b.position.clone(), probe: b.children.find(c => c.isMesh), pi }; });
  const skel = new THREE.Skeleton(bones, inv), coll = new Array(bones.length);
  skel.update = function () { // a severed or hidden limb folds into its joint, and everything below it with it
    const out = this.boneMatrices;
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i], f = info[i]; coll[i] = null;
      if (f.pi >= 0 && coll[f.pi]) { coll[i] = coll[f.pi]; }
      else if ((f.probe && f.probe.userData.skinOff) || b.parent !== f.parent || !b.visible) coll[i] = _flP.copy(f.local).applyMatrix4(f.parent.matrixWorld).clone();
      if (coll[i]) { const c = coll[i]; _flM.set(0, 0, 0, c.x, 0, 0, 0, c.y, 0, 0, 0, c.z, 0, 0, 0, 1).toArray(out, i * 16); }
      else _skM.multiplyMatrices(b.matrixWorld, inv[i]).toArray(out, i * 16);
    }
    if (this.boneTexture) this.boneTexture.needsUpdate = true;
  };
  // its own copy of the colour, so its wounds are its own
  const canvas = mkCanvas(A.alb.width, A.alb.height); canvas.getContext('2d').drawImage(A.alb, 0, 0);
  const tex = toTex(canvas, true, false); tex.anisotropy = 4;
  const pale = new THREE.Color(1, 1, 1), glow = { value: h.o.infected ? 1.6 : 0 };
  const mat = new THREE.MeshStandardMaterial({ map: tex, normalMap: A.nrmTex, roughnessMap: A.mrTex, roughness: 1, metalness: 0 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.fleshPale = { value: pale }; sh.uniforms.fleshGlow = glow; sh.uniforms.fleshMR = { value: A.mrTex };
    sh.fragmentShader = 'uniform vec3 fleshPale;\nuniform float fleshGlow;\nuniform sampler2D fleshMR;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n  vec3 fmr = texture2D(fleshMR, vUv).rgb;\n  diffuseColor.rgb *= mix(vec3(1.0), fleshPale, fmr.r);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(0.9, 0.86, 0.66) * fmr.b * fleshGlow;');
  };
  mat.customProgramCacheKey = () => 'flesh';
  const sm = new THREE.SkinnedMesh(A.lods[0], mat); sm.receiveShadow = true; sm.castShadow = false; h.root.add(sm); sm.updateMatrixWorld(true); sm.bind(skel, sm.matrixWorld);
  const shm = new THREE.SkinnedMesh(A.lods[A.lods.length - 1], SKIN_SHADOW_MAT); shm.castShadow = true; shm.visible = false; h.root.add(shm); shm.updateMatrixWorld(true); shm.bind(skel, shm.matrixWorld);
  let far = false; // near enough to see a face: the full mesh; further: the light one
  sm.onBeforeRender = (r, sc, cam) => { if (!cam.isPerspectiveCamera || cam !== camera) return; const d = h.root.getWorldPosition(_flCam).distanceTo(cam.position); const f = far ? d > FLESH_NEAR : d > FLESH_FAR; if (f !== far) { far = f; sm.geometry = A.lods[far ? A.lods.length - 1 : 0]; } };
  h.cur = keep; h.spr = spr; applyPose(h);
  // the stand-in body steps aside
  for (const m of [...(h.skinned || []), ...(h.shadows || [])]) { if (m.parent) m.parent.remove(m); if (!m.geometry.userData.keep) m.geometry.dispose(); }
  if (h.skel && h.skel.boneTexture) h.skel.dispose();
  h.skinned = [sm]; h.shadows = [shm]; h.skel = skel; h.atlas = null; h.bodyMat = mat;
  h.flesh = { sm, shm, mat, tex, canvas, pale, glow, A };
  // what the game paints and tints: wounds land in the right part of this texture, paling reaches only skin
  const wash = () => { canvas.getContext('2d').drawImage(A.alb, 0, 0); tex.needsUpdate = true; };
  const stand = region => { const o = { color: pale, emissive: new THREE.Color(), userData: { fleshRegion: region, flesh: h.flesh }, needsUpdate: false, dispose() {} }; Object.defineProperty(o, 'map', { get: () => tex, set: () => wash() }); return o; };
  h.coatMat = stand('torso'); h.topMat = stand('torso'); h.faceMat = stand('face'); h.skinMat = stand('arms'); h.botMat = stand('legs');
  if (h.mats) h.mats.push(mat);
}

/* physical layer: damped springs added on top of the animated pose (hit reactions, recoil, bumps) */
const SPRING_KEYS = ['spX', 'spY', 'spZ', 'chX', 'chY', 'headX', 'headY', 'headZ', 'shLx', 'shRx', 'shLz', 'shRz', 'elL', 'elR', 'knL', 'knR', 'pelY', 'bodyX', 'bodyZ', 'bodyY'];
const ZERO_SPR = {}; SPRING_KEYS.forEach(k => { ZERO_SPR[k] = 0; });
function initSprings(h) { h.spr = Object.assign({}, ZERO_SPR); h.sprV = Object.assign({}, ZERO_SPR); }
function springKick(h, k, v) { if (h.sprV) h.sprV[k] += v; }
function springStep(h, dt, stiff = 115, damping = 10) {
  if (!h.spr) return; const n = Math.max(1, Math.ceil(dt / 0.016)), sdt = dt / n;
  for (const k of SPRING_KEYS) {
    let x = h.spr[k], v = h.sprV[k]; if (x === 0 && v === 0) continue;
    const o = h.sprK && h.sprK[k], ks = o ? o[0] : stiff, kd = o ? o[1] : damping;
    for (let i = 0; i < n; i++) { v += (-ks * x - kd * v) * sdt; x += v * sdt; }
    if (Math.abs(x) < 1e-4 && Math.abs(v) < 1e-3) { x = 0; v = 0; }
    h.spr[k] = clamp(x, -1.3, 1.3); h.sprV[k] = v;
  }
}
// lx/lz: push direction in the body's own frame (+x its left, +z its front); p ≈ 0.2 … 1.6
function impactReact(h, lx, lz, p, kind) {
  const back = -lz, side = lx;
  springKick(h, 'spX', -back * 5.5 * p); springKick(h, 'bodyX', -back * 1.5 * p); springKick(h, 'headX', -back * 8 * p);
  springKick(h, 'spZ', -side * 5 * p); springKick(h, 'bodyZ', -side * 1.3 * p); springKick(h, 'headZ', -side * 8 * p);
  springKick(h, 'chY', side * 6 * p); springKick(h, 'headY', rnd(-3, 3) * p);
  springKick(h, 'shLx', -back * 6 * p + rnd(-2, 2) * p); springKick(h, 'shRx', -back * 6 * p + rnd(-2, 2) * p);
  springKick(h, 'shLz', (3 - side * 4) * p); springKick(h, 'shRz', (-3 - side * 4) * p);
  springKick(h, 'elL', rnd(2, 5) * p); springKick(h, 'elR', rnd(2, 5) * p);
  if (kind === 'heavy') { springKick(h, 'headX', 5 * p); springKick(h, 'knL', 5 * p); springKick(h, 'knR', 4 * p); springKick(h, 'pelY', -1.1 * p); }
  if (kind === 'kick') { springKick(h, 'spX', 9 * p); springKick(h, 'headX', 9 * p); springKick(h, 'pelY', -0.5 * p); springKick(h, 'knL', 3 * p); }
}
function applyPose(h) {
  const c = h.cur, s = h.spr || ZERO_SPR;
  h.L.hip.rotation.set(c.hipLx, 0, c.hipLz); h.R.hip.rotation.set(c.hipRx, 0, c.hipRz);
  const cut = h.cut || {}, lo = h.loose || {};
  if (!cut.knL) h.L.knee.rotation.x = lo.knL ? c.knL + s.knL : Math.max(0, c.knL + s.knL); if (!cut.knR) h.R.knee.rotation.x = lo.knR ? c.knR + s.knR : Math.max(0, c.knR + s.knR);
  h.L.ankle.rotation.x = c.ankL; h.R.ankle.rotation.x = c.ankR;
  h.spine.rotation.set(c.spX + s.spX, c.spY + s.spY, c.spZ + s.spZ); h.chest.rotation.set(c.chX + s.chX, c.chY + s.chY, 0);
  if (!cut.head) h.head.rotation.set(c.headX + s.headX, c.headY + s.headY, c.headZ + s.headZ);
  h.armL.sh.rotation.set(c.shLx + s.shLx, c.shLy, c.shLz + s.shLz); h.armR.sh.rotation.set(c.shRx + s.shRx, c.shRy, c.shRz + s.shRz);
  if (!cut.elL) h.armL.el.rotation.x = -(lo.elL ? c.elL + s.elL : Math.max(0, c.elL + s.elL)); if (!cut.elR) h.armR.el.rotation.x = -(lo.elR ? c.elR + s.elR : Math.max(0, c.elR + s.elR));
  if (h.drop) { h.armL.sh.position.y = h.armL.sh.userData.y0 - h.drop.L; h.armR.sh.position.y = h.armR.sh.userData.y0 - h.drop.R; }
  h.body.position.y = c.bodyY + s.bodyY; h.body.rotation.set(c.bodyX + s.bodyX, 0, c.bodyZ + s.bodyZ);
  h.pelvis.position.y = h.pelvisY0 + c.pelY + s.pelY; h.pelvis.rotation.x = c.pelX;
  h.mouth.scale.y = 0.12 + c.jaw * 1.3;
}
const LEG_KEYS = new Set(['hipLx', 'hipRx', 'hipLz', 'hipRz', 'knL', 'knR', 'ankL', 'ankR', 'pelY']);
// hard: keys driven directly by physics (a falling body), not damped toward a target
function poseTo(h, target, k, dt, hard) {
  const kl = target.__gait ? Math.max(k, 45) : k; // planted feet follow the gait closely, or they'd skate
  for (const key in NEUTRAL) {
    const t = key in target ? target[key] : NEUTRAL[key];
    h.cur[key] = damp(h.cur[key], t, LEG_KEYS.has(key) ? kl : k, dt);
  }
  if (hard) for (const key in hard) h.cur[key] = hard[key];
  applyPose(h);
}
/* ---------- locomotion: a gait that plants its feet ----------
   One leg cycle (2π) is two steps. A planted foot moves backward under the hip at exactly the ground speed, so nothing
   slides; the swing foot lifts and comes through; the pelvis rides on the stance leg (low with both feet down, high over a
   straight leg); the chest turns against the hips and the arms swing against the legs, a little late. Legs are solved
   with two-bone IK from where the feet should be. Units: body metres (1.75 m person), scaled by h.s at the call site. */
const LEG_T = 0.43, LEG_S = 0.42, LEG_L = LEG_T + LEG_S;
const stepLen = sp => clamp(0.3 + 0.22 * sp, 0.34, 1.12);           // one step, metres, for a 1.75 m body
const gaitK = (sp, s = 1) => Math.PI / (stepLen(sp) * s);           // gait phase per metre travelled
function legIK(z, y) { // foot relative to the hip joint (z forward, y up): [hip pitch (+ = leg back), knee flexion]
  const d = clamp(Math.hypot(z, y), 0.25, LEG_L - 1e-4);
  const k = Math.PI - Math.acos(clamp((LEG_T * LEG_T + LEG_S * LEG_S - d * d) / (2 * LEG_T * LEG_S), -1, 1));
  return [Math.atan2(-z, -y) - Math.atan2(LEG_S * Math.sin(k), LEG_T + LEG_S * Math.cos(k)), k];
}
const GAIT_DEFAULT = { sway: 1, lift: 1, arm: 1, lean: 0, elbow: 0, stiff: 0, wide: 0 };
// amt 0…1 how hard it walks, run 0…1, sp the ground speed (m/s), s the body's height scale, st a gait style
function walkPose(ph, amt, run = 0, sp = null, s = 1, st = GAIT_DEFAULT) {
  st = st === GAIT_DEFAULT ? st : Object.assign({}, GAIT_DEFAULT, st);
  if (sp == null) sp = amt * 2.2;
  const v = sp / s, w = clamp(v / 0.5, 0, 1), duty = lerp(0.62, 0.38, run), L = stepLen(v) * w, sweep = L * duty;
  const lift = (0.06 + 0.05 * amt + 0.1 * run) * w * st.lift;
  const foot = phase => { // z forward, y lift, and the 0…1 time in the leg's cycle
    const t = ((phase / (2 * Math.PI)) % 1 + 1) % 1;
    if (t < duty) return { z: sweep * (1 - 2 * t / duty), y: 0, t, stance: true };
    const u = (t - duty) / (1 - duty);
    return { z: -sweep + 2 * sweep * (0.5 - 0.5 * Math.cos(Math.PI * u)), y: lift * Math.sin(Math.PI * Math.pow(u, 0.75)), t, stance: false };
  };
  const fL = foot(ph), fR = foot(ph + Math.PI);
  // the pelvis rides the stance leg: as high as the straighter planted leg allows, a touch of bend kept; running adds flight
  // a leg takes the weight over the first part of its stance and gives it up before toe-off, so the knee bends to land
  const reach = f => { if (!f.stance) return 9; const wt = Math.min(1, f.t / 0.14, (duty - f.t) / 0.1); return Math.sqrt(Math.max(0.3, (LEG_L * 0.996) ** 2 - f.z * f.z)) + (1 - Math.max(0, wt)) * 0.12; };
  let hipH = Math.min(reach(fL), reach(fR), LEG_L * 0.996); if (run > 0.3) hipH = Math.min(hipH, LEG_L * 0.95);
  hipH -= 0.05 * run + 0.004 * amt + (st.crouch || 0);
  const leg = f => { const [hx, kn] = legIK(f.z, -(hipH - f.y)); let an = -(hx + kn); // flat foot
    if (f.stance && f.t > duty - 0.18) an += 0.55 * (f.t - (duty - 0.18)) / 0.18 * w; // heel comes up, toe pushes off
    if (!f.stance) an -= 0.12 * w; return [hx, kn, an]; };
  const [hl, kl, al] = leg(fL), [hr, kr, ar] = leg(fR);
  // arms swing against the legs, lagging a little; forward swing bends the elbow
  const lag = 0.35, aL = foot(ph + Math.PI + lag).z, aR = foot(ph + lag).z, ka = (0.55 + 0.5 * run) * st.arm / Math.max(0.2, L || 0.2) * w;
  const shL = -aL * ka * 0.9, shR = -aR * ka * 0.9;
  const sw = Math.sin(ph), still = 1 - w, t = (typeof G !== 'undefined' ? G.t : 0) + ph * 3.7; // standing: breath, and the weight drifting from foot to foot
  const breath = Math.sin(t * 1.7) * still, drift = Math.sin(t * 0.37) * still;
  return {
    __gait: 1, hipLx: hl, hipRx: hr, knL: kl + Math.max(0, drift) * 0.12, knR: kr + Math.max(0, -drift) * 0.12, ankL: al, ankR: ar,
    hipLz: 0.02 + st.wide * 0.08, hipRz: -0.02 - st.wide * 0.08,
    shLx: shL, shRx: shR, elL: 0.18 + 0.25 * amt + 0.9 * run + Math.max(0, -shL) * 0.45 + st.elbow, elR: 0.18 + 0.25 * amt + 0.9 * run + Math.max(0, -shR) * 0.45 + st.elbow,
    pelY: (hipH - LEG_L * 0.9996) * s - Math.abs(drift) * 0.008 * s - (st.limp && fL.stance ? 0.035 * w * s : 0),
    spX: 0.03 * amt + 0.22 * run + st.lean, spY: sw * (0.08 + 0.05 * run) * w, chY: -sw * (0.11 + 0.06 * run) * w * st.arm,
    bodyZ: Math.cos(ph) * 0.028 * (1 - run) * w * st.sway + drift * 0.025, chX: breath * 0.018, spZ: -Math.cos(ph) * 0.02 * w * st.sway + (st.limp ? (fL.stance ? 0.06 : -0.02) * w : 0),
    headX: -(0.03 * amt + 0.22 * run + st.lean) * 0.6, headY: -sw * 0.07 * w
  };
}
// the pose every body is modelled and bound in: arms out in an A, legs a little apart, joints straight
const BIND = { shLz: 0.75, shRz: -0.75, elL: 0, elR: 0, hipLz: 0.05, hipRz: -0.05, knL: 0, knR: 0 };
const RIG_BONES = h => ({ pelvis: h.pelvis, spine: h.spine, chest: h.chest, head: h.head, hipL: h.L.hip, kneeL: h.L.knee, ankleL: h.L.ankle, hipR: h.R.hip, kneeR: h.R.knee, ankleR: h.R.ankle,
  shL: h.armL.sh, elL: h.armL.el, handL: h.armL.hand, shR: h.armR.sh, elR: h.armR.el, handR: h.armR.hand });
// where every joint sits in the bind pose, in the body's own space (feet on y = 0, facing +z): what the modeller builds around
function rigDump(h) {
  const keep = h.cur; h.cur = Object.assign({}, NEUTRAL, BIND); applyPose(h); h.root.position.set(0, 0, 0); h.root.rotation.set(0, 0, 0); h.root.updateMatrixWorld(true);
  const out = { s: h.s, joints: {} }, v = new V3();
  for (const [k, b] of Object.entries(RIG_BONES(h))) { b.getWorldPosition(v); out.joints[k] = [+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5)]; }
  h.cur = keep; applyPose(h); return out;
}
// a seated pose (used by the mother)
const SEATED = { hipLx: -1.5, hipRx: -1.5, hipLz: 0.05, hipRz: -0.05, knL: 1.45, knR: 1.5, pelY: -0.42, spX: -0.12 };

/* --------- held props --------- */
function makeClub() {
  const g = new THREE.Group();
  const wd = new THREE.MeshStandardMaterial({ map: toTex(woodCanvas('#7a5a3a', 24, 128, 128, 44, 0.5)), roughness: 0.75 });
  const shaft = mesh(new THREE.CylinderGeometry(0.035, 0.022, 0.82, 10), wd, 0, -0.33, 0); g.add(shaft);
  const grip = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 }), 0, 0.02, 0); g.add(grip);
  for (let i = 0; i < 6; i++) { const n = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 4), matIron, 0, -0.52 - i * 0.04, 0, false); n.rotation.z = Math.PI / 2; n.rotation.y = i * 1.1; g.add(n); }
  g.userData = { shaft, tip: new V3(0, -0.74, 0), stain: [wd] };
  return g;
}
// fire axe: red head, ground steel edge facing the hand's -z (it leads the overhead chop), pick at +z
function makeAxe() {
  const g = new THREE.Group();
  const hm = new THREE.MeshStandardMaterial({ map: toTex(woodCanvas('#8a5a32', 22, 128, 128, 77, 0.6)), roughness: 0.7 });
  const shaft = mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.8, 10), hm, 0, -0.32, 0); g.add(shaft);
  g.add(mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x1d1a17, roughness: 1 }), 0, 0.02, 0));
  const red = new THREE.MeshStandardMaterial({ color: 0x8e1f18, roughness: 0.45, metalness: 0.35 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb2b6, roughness: 0.28, metalness: 0.9 });
  const head = new THREE.Group(); head.position.y = -0.68; g.add(head);
  head.add(mesh(new THREE.BoxGeometry(0.048, 0.08, 0.1), red));
  const plate = (x0, x1, y0, y1, mat, curve) => {
    const sh = new THREE.Shape(); sh.moveTo(x0, y0 * 0.5); sh.lineTo(x1, y1); if (curve) sh.quadraticCurveTo(x1 + 0.03, 0, x1, -y1); else sh.lineTo(x1, -y1); sh.lineTo(x0, -y0 * 0.5); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
    geo.translate(0, 0, -0.006); geo.rotateY(Math.PI / 2); const m = mesh(geo, mat); head.add(m); return m;
  };
  plate(0.04, 0.125, 0.07, 0.062, red, false);
  plate(0.122, 0.15, 0.124, 0.072, steel, true);
  const pick = mesh(new THREE.ConeGeometry(0.018, 0.11, 6), red, 0, 0, 0.1); pick.rotation.x = Math.PI / 2; head.add(pick);
  g.userData = { shaft, tip: new V3(0, -0.68, -0.17), stain: [steel, hm] };
  return g;
}
function makeLantern() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 4, 12, Math.PI), matIron); handle.position.y = -0.03; g.add(handle);
  const body = new THREE.Group(); body.position.y = -0.17; g.add(body);
  body.add(mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.03, 12), matRust, 0, 0.1, 0));
  body.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.025, 12), matRust, 0, -0.08, 0));
  body.add(mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.15, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xffe2b0, roughness: 0.1, transparent: true, opacity: 0.25, side: THREE.DoubleSide }), 0, 0.01, 0, false, false));
  for (let i = 0; i < 3; i++) { const bar = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 4), matIron, Math.cos(i * 2.1) * 0.055, 0.01, Math.sin(i * 2.1) * 0.055); body.add(bar); }
  const fl = mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffa040, emissiveIntensity: 7 }), 0, 0.0, 0, false, false); fl.scale.y = 2; body.add(fl);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
  glow.scale.set(0.3, 0.3, 1); body.add(glow);
  const light = new THREE.PointLight(0xffb468, 1.25, 8.5, 2); light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.003; light.shadow.radius = 3;
  body.add(light);
  g.userData = { body, light, flame: fl, glow };
  return g;
}
function makeBaby() {
  const g = new THREE.Group();
  const wrap = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#e3d7c0', 0.25, false, 61)), roughness: 1 });
  const prof = [[0.0, -0.17], [0.045, -0.16], [0.068, -0.1], [0.074, -0.01], [0.07, 0.08], [0.055, 0.15], [0.0, 0.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const bundle = mesh(new THREE.LatheGeometry(prof, 20), wrap); bundle.rotation.z = Math.PI / 2; bundle.scale.set(1, 1, 0.85); g.add(bundle);
  const fold = mesh(new THREE.SphereGeometry(0.06, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), wrap, -0.13, 0.015, 0); fold.rotation.z = Math.PI / 2 + 0.3; fold.scale.set(1.1, 0.8, 1.15); g.add(fold);
  const bskin = new THREE.MeshStandardMaterial({ color: 0xe8c3a8, roughness: 0.55 });
  const fc = mkCanvas(256, 128), fg = fc.getContext('2d'); fg.fillStyle = '#e8c3a8'; fg.fillRect(0, 0, 256, 128);
  const fx = 64, fy = 66; fg.strokeStyle = '#4a2c22'; fg.lineWidth = 2; [-1, 1].forEach(sx => { fg.beginPath(); fg.arc(fx + sx * 13, fy - 3, 6, 0.2, Math.PI - 0.2); fg.stroke(); });
  const bl = fg.createRadialGradient(fx, fy + 8, 0, fx, fy + 8, 24); bl.addColorStop(0, 'rgba(220,110,100,.25)'); bl.addColorStop(1, 'rgba(220,110,100,0)'); fg.fillStyle = bl; fg.fillRect(fx - 30, fy - 20, 60, 50);
  fg.fillStyle = '#b86a62'; fg.beginPath(); fg.ellipse(fx, fy + 15, 4, 2.5, 0, 0, 7); fg.fill();
  const head = mesh(new THREE.SphereGeometry(0.064, 20, 14), new THREE.MeshStandardMaterial({ map: toTex(fc, true, false), roughness: 0.55 }), -0.17, 0.02, 0.0); head.rotation.x = -0.6; g.add(head);
  const hat = mesh(new THREE.SphereGeometry(0.062, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0xb98c6a, roughness: 1 }), -0.185, 0.03, 0); hat.rotation.z = 1.0; g.add(hat);
  const hand = mesh(new THREE.SphereGeometry(0.016, 8, 6), bskin, -0.1, 0.055, 0.045); g.add(hand);
  g.userData = { head, hand };
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
