/* ===== P2 world: cabin, props, yard, lights, weather ===== */
const colliders = [];
function addCol(x0, x1, z0, z1, tag) { colliders.push({ x0, x1, z0, z1, tag }); }
const GROUND_Y = -0.25;
function groundY(x, z) {
  if (x > -3.7 && x < 3.7 && z > -3.25 && z < 5.45) return 0;
  if (x > -1.0 && x < 1.0 && z >= 5.45 && z < 5.95) return -0.12;
  return GROUND_Y;
}
function insideCabin(x, z) { return x > -3.5 && x < 3.5 && z > -3.0 && z < 3.05; }

const matFloor = woodMat('#6e5138', 46, 1.3, { seed: 2, dirt: 0.5 });
const matWall = woodMat('#5b4633', 58, 1.9, { seed: 4, dirt: 0.55 });
const matPorch = woodMat('#4d3b2b', 40, 1.4, { seed: 8, dirt: 0.6, rough: 0.8 });
const matTrim = woodMat('#3a2a1d', 30, 1.0, { seed: 9 });
const matFurn = woodMat('#6a4a30', 36, 1.0, { seed: 13, dirt: 0.25, rough: 0.7 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x1e1712, roughness: 0.92 });
const matIron = new THREE.MeshStandardMaterial({ color: 0x23211f, roughness: 0.55, metalness: 0.75 });
const matRust = new THREE.MeshStandardMaterial({ color: 0x4a2f22, roughness: 0.8, metalness: 0.4 });
const matTreeBark = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 });

/* ---------------- cabin walls with camera cutaway ---------------- */
const wallSets = [];
function wallSet(side, full, cut) {
  const gF = new THREE.Group(), gC = new THREE.Group();
  const add = (g, p) => {
    const [w, h, d, x, y0, z] = p;
    g.add(mesh(boxGeo(w, h, d, matWall.userData.tile), matWall, x, y0 + h / 2, z));
  };
  full.forEach(p => add(gF, p)); cut.forEach(p => add(gC, p));
  gC.visible = false; scene.add(gF, gC);
  const ws = { side, full: gF, cut: gC, isCut: false }; wallSets.push(ws); return ws;
}
const wBack = wallSet('back',
  [[2.1, 2.6, 0.2, -2.65, 0, -3.1], [4.1, 2.6, 0.2, 1.65, 0, -3.1], [1.2, 0.95, 0.2, -1.0, 0, -3.1], [1.2, 0.65, 0.2, -1.0, 1.95, -3.1]],
  [[7.4, 0.9, 0.2, 0, 0, -3.1]]);
const wFront = wallSet('front',
  [[3.15, 2.6, 0.2, -2.125, 0, 3.1], [3.15, 2.6, 0.2, 2.125, 0, 3.1], [1.1, 0.55, 0.2, 0, 2.05, 3.1]],
  [[3.15, 0.9, 0.2, -2.125, 0, 3.1], [3.15, 0.9, 0.2, 2.125, 0, 3.1]]);
// the left wall has a window the survivors boarded up (opening z 1.05..2.15, y 1.0..1.95)
const wLeft = wallSet('left', [[0.2, 2.6, 4.05, -3.6, 0, -0.975], [0.2, 2.6, 0.85, -3.6, 0, 2.575], [0.2, 1.0, 1.1, -3.6, 0, 1.6], [0.2, 0.65, 1.1, -3.6, 1.95, 1.6]], [[0.2, 0.9, 6.0, -3.6, 0, 0]]);
const wRight = wallSet('right', [[0.2, 2.6, 6.0, 3.6, 0, 0]], [[0.2, 0.9, 6.0, 3.6, 0, 0]]);
addCol(-3.75, 3.75, -3.3, -3.0, 'wall'); addCol(-3.75, -3.5, -3.3, 3.25, 'wall'); addCol(3.5, 3.75, -3.3, 3.25, 'wall');
addCol(-3.75, -0.55, 3.0, 3.2, 'wall'); addCol(0.55, 3.75, 3.0, 3.2, 'wall');

// visible roof: shown from outside, hidden when the camera looks into the cabin
const matRoof = woodMat('#3a2f28', 30, 1.3, { seed: 15, dirt: 0.75, rough: 0.92 });
const roofG = new THREE.Group(); scene.add(roofG);
[-1, 1].forEach(sx => { const r = mesh(boxGeo(4.05, 0.1, 7.0, matRoof.userData.tile), matRoof, sx * 1.95, 3.04, 0); r.rotation.z = -sx * 0.214; roofG.add(r); });
const gShape = new THREE.Shape(); gShape.moveTo(-3.7, 0); gShape.lineTo(3.7, 0); gShape.lineTo(0, 0.85); gShape.lineTo(-3.7, 0);
const gableMat = matWall.clone(); gableMat.side = THREE.DoubleSide;
[3.2, -3.2].forEach(z => { const gm = new THREE.Mesh(new THREE.ShapeGeometry(gShape), gableMat); gm.position.set(0, 2.6, z); gm.castShadow = true; gm.receiveShadow = true; roofG.add(gm); });
roofG.add(mesh(boxGeo(0.18, 0.1, 7.1), matTrim, 0, 3.47, 0));
const porchRoof = mesh(boxGeo(7.4, 0.08, 2.5, 1.3), matRoof, 0, 2.52, 4.35); porchRoof.rotation.x = 0.087; scene.add(porchRoof);
// the front door itself is built in the camp module (P6b): it can be barred, chopped, rammed and broken

// floor + skirting + roof beams
scene.add(mesh(boxGeo(7.4, 0.2, 6.4, matFloor.userData.tile), matFloor, 0, -0.1, 0, false, true));
// invisible roof: casts shadows so moonlight only enters through the window
const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
[-1, 1].forEach(sx => {
  const r = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.05, 6.8), shadowOnly);
  r.position.set(sx * 1.85, 3.05, 0); r.rotation.z = -sx * 0.22; r.castShadow = true; scene.add(r);
});

// back window: frame, mullions, glass, rain streaks
const win = new THREE.Group(); win.position.set(-1.0, 1.45, -3.1); scene.add(win);
[[1.32, 0.08, 0.26, 0, 0.54], [1.32, 0.08, 0.26, 0, -0.54], [0.08, 1.16, 0.26, -0.62, 0], [0.08, 1.16, 0.26, 0.62, 0],
 [0.04, 1.0, 0.1, 0, 0], [1.2, 0.04, 0.1, 0, 0.02]].forEach(([w, h, d, x, y]) => win.add(mesh(boxGeo(w, h, d), matTrim, x, y, 0)));
const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }));
glass.position.z = -0.02; win.add(glass);
const streakMat = new THREE.MeshBasicMaterial({ color: 0x9fb6d0, transparent: true, opacity: 0.32, depthWrite: false });
const streaks = [];
for (let i = 0; i < 18; i++) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.008, rnd(0.04, 0.12)), streakMat);
  s.position.set(rnd(-0.56, 0.56), rnd(-0.48, 0.48), -0.01); s.userData.v = rnd(0.08, 0.35); win.add(s); streaks.push(s);
}

/* ---------------- furniture ---------------- */
function group(x, y, z, ry = 0) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); return g; }
function bx(g, w, h, d, x, y, z, mat = matFurn, cast = true) { const m = mesh(boxGeo(w, h, d, 0.8), mat, x, y, z, cast, true); g.add(m); return m; }
function cy(g, rt, rb, h, x, y, z, mat, seg = 14) { const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z); g.add(m); return m; }

// table
const table = group(1.7, 0, -2.25);
bx(table, 1.4, 0.06, 0.8, 0, 0.75, 0);
[[-0.62, -0.32], [0.62, -0.32], [-0.62, 0.32], [0.62, 0.32]].forEach(([x, z]) => bx(table, 0.07, 0.72, 0.07, x, 0.36, z));
addCol(0.98, 2.42, -2.67, -1.83, 'table');
// chair by table
const chair2 = group(1.25, 0, -1.55, 2.6);
bx(chair2, 0.42, 0.05, 0.42, 0, 0.45, 0); bx(chair2, 0.42, 0.5, 0.04, 0, 0.72, -0.2);
[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([x, z]) => bx(chair2, 0.04, 0.45, 0.04, x, 0.225, z));
addCol(1.02, 1.48, -1.78, -1.32, 'chair');

// candle with flame
const wax = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 });
cy(table, 0.07, 0.07, 0.012, -0.42, 0.786, 0.08, matIron);
cy(table, 0.026, 0.028, 0.15, -0.42, 0.865, 0.08, wax);
const flameMat = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 6, roughness: 1 });
const flame = mesh(new THREE.SphereGeometry(0.014, 10, 8), flameMat, -0.42, 0.965, 0.08, false, false); flame.scale.set(1, 2.4, 1); table.add(flame);
const glowTex = softDisc(128, [[0, 'rgba(255,190,110,.9)'], [0.25, 'rgba(255,140,60,.35)'], [1, 'rgba(255,120,40,0)']]);
const candleGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
candleGlow.scale.set(0.55, 0.55, 1); candleGlow.position.set(-0.42, 0.97, 0.08); table.add(candleGlow);
const candleLight = new THREE.PointLight(0xff9a45, 1.15, 7.5, 2); candleLight.position.set(1.28, 1.05, -2.17); scene.add(candleLight);
candleLight.castShadow = true; candleLight.shadow.mapSize.set(256, 256); candleLight.shadow.bias = -0.004; candleLight.shadow.radius = 4;

// formula tin (empty), bottle, photo
function labelCanvas() {
  const c = mkCanvas(256, 96), g = c.getContext('2d');
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#c9772f'; g.fillRect(0, 70, 256, 26);
  g.fillStyle = '#f2c46a'; g.beginPath(); g.arc(46, 40, 24, 0, 7); g.fill();
  g.fillStyle = '#5a3a22'; g.font = 'bold 22px "PingFang SC","Noto Sans SC","Heiti SC",sans-serif'; g.fillText('暖阳 婴儿奶粉', 82, 38);
  g.font = '15px "PingFang SC","Noto Sans SC",sans-serif'; g.fillText('1 段 · 0-6 个月', 84, 60);
  g.fillStyle = '#fff'; g.fillText('净含量 800 克', 90, 88);
  return c;
}
const tinMat = [new THREE.MeshStandardMaterial({ map: toTex(labelCanvas(), true, false), roughness: 0.5, metalness: 0.3 }), matIron, matIron];
const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.13, 20, 1, true), tinMat[0]);
tin.position.set(0.12, 0.845, -0.05); tin.castShadow = true; table.add(tin);
cy(table, 0.065, 0.065, 0.004, 0.12, 0.782, -0.05, matIron, 20);
const lid = cy(table, 0.068, 0.068, 0.012, 0.3, 0.787, 0.12, matIron, 20); lid.rotation.z = 0.08;
const bottle = new THREE.Group(); bottle.position.set(-0.05, 0.81, 0.22); bottle.rotation.z = Math.PI / 2; bottle.rotation.y = 0.6; table.add(bottle);
cy(bottle, 0.028, 0.028, 0.16, 0, 0, 0, new THREE.MeshStandardMaterial({ color: 0xd8dde0, roughness: 0.15, transparent: true, opacity: 0.55 }));
cy(bottle, 0.012, 0.02, 0.04, 0, 0.1, 0, new THREE.MeshStandardMaterial({ color: 0xc9a77a, roughness: 0.5 }));
function photoCanvas() {
  const c = mkCanvas(128, 160), g = c.getContext('2d');
  g.fillStyle = '#b89a72'; g.fillRect(0, 0, 128, 160);
  const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, 'rgba(255,240,210,.35)'); gr.addColorStop(1, 'rgba(60,40,20,.4)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 160);
  g.fillStyle = 'rgba(55,38,25,.85)';
  [[40, 70, 15], [86, 64, 17]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill(); g.fillRect(x - r * 0.75, y + r * 0.5, r * 1.5, 70); });
  g.beginPath(); g.arc(62, 100, 9, 0, 7); g.fill();
  g.strokeStyle = '#efe4cf'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 152);
  return c;
}
const photo = new THREE.Group(); photo.position.set(0.48, 0.9, -0.28); photo.rotation.set(-0.25, -0.35, 0); table.add(photo);
photo.add(mesh(boxGeo(0.17, 0.21, 0.015), matTrim));
const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.18), new THREE.MeshStandardMaterial({ map: toTex(photoCanvas(), true, false), roughness: 0.6 }));
ph.position.z = 0.009; photo.add(ph);

// rocking chair (mother sits here); the group rocks
const rocker = group(-1.25, 0, -1.55, 0.55);
const rock = new THREE.Group(); rocker.add(rock);
bx(rock, 0.56, 0.05, 0.52, 0, 0.47, 0);
const back = bx(rock, 0.56, 0.78, 0.05, 0, 0.88, -0.28); back.rotation.x = -0.18;
for (let i = -2; i <= 2; i++) { const sl = bx(rock, 0.04, 0.62, 0.025, i * 0.11, 0.86, -0.255); sl.rotation.x = -0.18; }
[[-0.28], [0.28]].forEach(([x]) => {
  bx(rock, 0.05, 0.05, 0.56, x, 0.7, -0.02);
  bx(rock, 0.04, 0.24, 0.04, x, 0.58, 0.2); bx(rock, 0.04, 0.47, 0.04, x, 0.23, -0.2); bx(rock, 0.04, 0.47, 0.04, x, 0.23, 0.2);
  const run = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.025, 6, 24, 0.95), matFurn);
  run.rotation.set(0, Math.PI / 2, -Math.PI / 2 - 0.475); run.position.set(x, 1.0, -0.02); run.castShadow = true; rock.add(run);
});
addCol(-1.65, -0.85, -1.95, -1.15, 'rocker');
// low stool with a candle stub beside the rocker: the only warm light on her face
const stool = group(-1.72, 0, -0.86, 0.3);
cy(stool, 0.17, 0.17, 0.04, 0, 0.44, 0, matFurn, 14);
[0, 2.1, 4.2].forEach(a => { const l = cy(stool, 0.018, 0.022, 0.44, Math.cos(a) * 0.11, 0.21, Math.sin(a) * 0.11, matFurn, 6); l.rotation.z = Math.cos(a) * 0.12; l.rotation.x = -Math.sin(a) * 0.12; });
cy(stool, 0.035, 0.035, 0.06, 0.03, 0.49, 0.02, wax);
const flame2 = mesh(new THREE.SphereGeometry(0.011, 8, 6), flameMat, 0.03, 0.535, 0.02, false, false); flame2.scale.set(1, 2.3, 1); stool.add(flame2);
const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
glow2.scale.set(0.42, 0.42, 1); glow2.position.set(0.03, 0.54, 0.02); stool.add(glow2);
cy(stool, 0.03, 0.025, 0.07, -0.08, 0.495, -0.05, new THREE.MeshStandardMaterial({ color: 0xd9d4c6, roughness: 0.35 }), 10);
const stoolLight = new THREE.PointLight(0xffa458, 0.75, 3.6, 2); stoolLight.position.set(-1.68, 0.72, -0.84); scene.add(stoolLight);
addCol(-1.92, -1.52, -1.06, -0.66, 'stool');
// shawl draped over the back of the chair
const shawlMat = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#6e5a4a', 0.4, false, 21)), roughness: 0.95 });

// crib with mobile
const crib = group(-2.95, 0, -0.35, 0);
bx(crib, 0.72, 0.06, 1.22, 0, 0.42, 0);
bx(crib, 0.62, 0.1, 1.1, 0, 0.5, 0, new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#c9bfa6', 0.5, false, 3)), roughness: 1 }));
[[-0.34, -0.59], [0.34, -0.59], [-0.34, 0.59], [0.34, 0.59]].forEach(([x, z]) => bx(crib, 0.05, 0.98, 0.05, x, 0.49, z));
[-0.34, 0.34].forEach(x => { bx(crib, 0.04, 0.04, 1.2, x, 0.95, 0); for (let i = 0; i < 9; i++) bx(crib, 0.022, 0.5, 0.022, x, 0.69, -0.48 + i * 0.12); });
[-0.59, 0.59].forEach(z => { bx(crib, 0.7, 0.04, 0.04, 0, 0.95, z); for (let i = 0; i < 5; i++) bx(crib, 0.022, 0.5, 0.022, -0.24 + i * 0.12, 0.69, z); });
const blanketMat = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#8fa3b8', 0.35, false, 7)), roughness: 1 });
const crumple = bx(crib, 0.4, 0.06, 0.5, 0.05, 0.58, 0.2, blanketMat); crumple.rotation.y = 0.4;
const mobile = new THREE.Group(); mobile.position.set(0, 1.55, 0); crib.add(mobile);
cy(crib, 0.01, 0.01, 0.62, -0.34, 1.26, -0.59, matTrim);
const mobMats = [0xd9b45a, 0x9cb7c9, 0xd08f7a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
for (let i = 0; i < 5; i++) {
  const a = i / 5 * Math.PI * 2, r = 0.18;
  const str = cy(mobile, 0.002, 0.002, 0.2, Math.cos(a) * r, -0.1, Math.sin(a) * r, matDark, 4);
  const sh = mesh(i % 2 ? new THREE.OctahedronGeometry(0.035) : new THREE.SphereGeometry(0.03, 8, 6), mobMats[i % 3], Math.cos(a) * r, -0.22, Math.sin(a) * r);
  mobile.add(sh);
}
bx(mobile, 0.4, 0.01, 0.01, 0, 0, 0, matTrim); bx(mobile, 0.01, 0.01, 0.4, 0, 0, 0, matTrim);
addCol(-3.5, -2.55, -1.0, 0.3, 'crib');

// bed
const bed = group(2.85, 0, 1.1);
bx(bed, 1.2, 0.3, 2.05, 0, 0.2, 0);
bx(bed, 1.12, 0.14, 1.95, 0, 0.42, 0, new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#bdb39f', 0.6, false, 9)), roughness: 1 }));
const blanket = bx(bed, 1.16, 0.08, 1.3, 0, 0.52, 0.28, new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#465a70', 0.5, false, 12)), roughness: 1 }));
blanket.rotation.z = 0.04;
bx(bed, 0.6, 0.12, 0.34, 0, 0.55, -0.78, new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#d9d1c0', 0.4, false, 14)), roughness: 1 }));
bx(bed, 1.2, 0.7, 0.07, 0, 0.45, -1.02);
addCol(2.22, 3.5, 0.05, 2.15, 'bed');

// stove + pipe + glow + firewood
const stove = group(3.05, 0, -1.95);
bx(stove, 0.8, 0.8, 0.66, 0, 0.45, 0, matIron);
[[-0.33, -0.27], [0.33, -0.27], [-0.33, 0.27], [0.33, 0.27]].forEach(([x, z]) => bx(stove, 0.06, 0.1, 0.06, x, 0.05, z, matIron));
const pipe = cy(stove, 0.07, 0.07, 2.4, 0.15, 2.05, -0.12, matIron);
const emberMat = new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff5a14, emissiveIntensity: 2.4 });
for (let i = 0; i < 4; i++) bx(stove, 0.012, 0.12, 0.012, -0.405, 0.45, -0.16 + i * 0.1, emberMat, false);
const stoveLight = new THREE.PointLight(0xff5a1a, 0.55, 4, 2); stoveLight.position.set(2.5, 0.45, -1.95); scene.add(stoveLight);
addCol(2.6, 3.5, -2.35, -1.55, 'stove');
const wood = group(3.15, 0, -0.95);
for (let i = 0; i < 9; i++) { const l = cy(wood, 0.06, 0.06, 0.48, 0, 0.07 + Math.floor(i / 3) * 0.11, -0.13 + (i % 3) * 0.13, new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 1 }), 8); l.rotation.x = Math.PI / 2; l.rotation.z = Math.PI / 2; }
addCol(2.85, 3.5, -1.25, -0.65, 'wood');

// shelves on left wall
const shelf = group(-3.38, 0, 1.3);
[1.3, 1.75].forEach(y => bx(shelf, 0.28, 0.04, 1.1, 0, y, 0));
const jarMat = new THREE.MeshStandardMaterial({ color: 0x8aa08a, roughness: 0.1, transparent: true, opacity: 0.5 });
const canMat = new THREE.MeshStandardMaterial({ color: 0x8b8378, roughness: 0.4, metalness: 0.6 });
[[1.42, -0.35, jarMat], [1.42, -0.1, jarMat], [1.40, 0.3, canMat], [1.87, -0.3, canMat], [1.88, 0.15, jarMat]].forEach(([y, z, m]) => cy(shelf, 0.05, 0.05, 0.18, 0, y, z, m));

// rug, bucket under the leak, clutter
function rugCanvas() {
  const c = mkCanvas(256, 192), g = c.getContext('2d');
  g.fillStyle = '#5a1f1a'; g.fillRect(0, 0, 256, 192);
  g.strokeStyle = '#a8763c'; g.lineWidth = 6; g.strokeRect(12, 12, 232, 168);
  g.strokeStyle = '#2b3a4a'; g.lineWidth = 4; g.strokeRect(24, 24, 208, 144);
  g.fillStyle = '#a8763c';
  for (let i = 0; i < 6; i++) { const x = 48 + i * 32; g.beginPath(); g.moveTo(x, 96 - 22); g.lineTo(x + 14, 96); g.lineTo(x, 96 + 22); g.lineTo(x - 14, 96); g.fill(); }
  const R = rng(5); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.18})`; g.fillRect(R() * 256, R() * 192, 2, 2); }
  return c;
}
const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), new THREE.MeshStandardMaterial({ map: toTex(rugCanvas(), true, false), roughness: 1 }));
rug.rotation.x = -Math.PI / 2; rug.rotation.z = 0.06; rug.position.set(-0.25, 0.006, 0.55); rug.receiveShadow = true; scene.add(rug);
const bucket = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.0, 0), new THREE.Vector2(0.13, 0), new THREE.Vector2(0.16, 0.26), new THREE.Vector2(0.165, 0.27)], 18), new THREE.MeshStandardMaterial({ color: 0x6b6a66, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide }));
bucket.position.set(0.95, 0, 0.95); bucket.castShadow = true; bucket.receiveShadow = true; scene.add(bucket);
const waterTop = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), new THREE.MeshStandardMaterial({ color: 0x0c1218, roughness: 0.05, metalness: 0.3 }));
waterTop.rotation.x = -Math.PI / 2; waterTop.position.set(0.95, 0.18, 0.95); scene.add(waterTop);
addCol(0.78, 1.12, 0.78, 1.12, 'bucket');
const drip = mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshStandardMaterial({ color: 0xaac4dd, roughness: 0, metalness: 0.2, emissive: 0x223344 }), 0.95, 2.6, 0.95, false, false);
scene.add(drip); drip.userData.v = 0;
const ringTex = softDisc(64, [[0, 'rgba(255,255,255,0)'], [0.72, 'rgba(255,255,255,0)'], [0.82, 'rgba(210,225,240,.9)'], [0.92, 'rgba(255,255,255,0)']]);
const ripple = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0 }));
ripple.rotation.x = -Math.PI / 2; ripple.position.set(0.95, 0.182, 0.95); scene.add(ripple);

// toy blocks, stuffed rabbit, spilled bowl, rag
const toyCols = [0xb5523b, 0x3f6f8f, 0xd2a548, 0x5e8a54];
[[-2.3, 0.55, 0.2], [-2.12, 0.62, 0.9], [-2.2, 0.38, 0.5], [-2.0, 0.8, 1.4]].forEach(([x, z, r], i) => {
  const b = mesh(boxGeo(0.07, 0.07, 0.07), new THREE.MeshStandardMaterial({ color: toyCols[i], roughness: 0.6 }), x, 0.035, z); b.rotation.y = r; scene.add(b);
});
const rabbit = group(-0.55, 0, -0.75, 0.9);
const plush = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#c8b8a6', 0.7, false, 31)), roughness: 1 });
rabbit.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), plush, 0, 0.07, 0));
rabbit.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), plush, 0, 0.16, 0.02));
[-0.025, 0.025].forEach(x => { const e = mesh(new THREE.CapsuleGeometry(0.014, 0.07, 3, 6), plush, x, 0.24, 0.0); e.rotation.z = x * 6; rabbit.add(e); });
const bowl = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.04, 0), new THREE.Vector2(0.07, 0.05), new THREE.Vector2(0.072, 0.052)], 14), new THREE.MeshStandardMaterial({ color: 0xd9d4c6, roughness: 0.3, side: THREE.DoubleSide }));
bowl.position.set(0.55, 0.03, -1.25); bowl.rotation.z = 1.6; scene.add(bowl);
const rice = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), new THREE.MeshStandardMaterial({ color: 0xe6e0cf, roughness: 1 }));
rice.rotation.x = -Math.PI / 2; rice.position.set(0.42, 0.004, -1.2); rice.scale.set(1.4, 0.8, 1); scene.add(rice);
const rag = mesh(boxGeo(0.3, 0.012, 0.22), new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#cbbca3', 0.5, true, 41)), roughness: 1 }), -1.85, 0.008, -0.75); rag.rotation.y = 0.7; scene.add(rag);

// wall details: child's drawing, chalk tally "正正正正一"
function drawingCanvas() {
  const c = mkCanvas(256, 192), g = c.getContext('2d');
  g.fillStyle = '#efe7d6'; g.fillRect(0, 0, 256, 192);
  g.lineCap = 'round'; g.lineWidth = 5;
  g.strokeStyle = '#d9a23a'; g.beginPath(); g.arc(214, 38, 18, 0, 7); g.stroke();
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; g.beginPath(); g.moveTo(214 + Math.cos(a) * 24, 38 + Math.sin(a) * 24); g.lineTo(214 + Math.cos(a) * 32, 38 + Math.sin(a) * 32); g.stroke(); }
  g.strokeStyle = '#b5523b'; g.beginPath(); g.moveTo(30, 110); g.lineTo(80, 64); g.lineTo(130, 110); g.stroke();
  g.strokeStyle = '#6b4a2a'; g.strokeRect(40, 110, 80, 60);
  g.strokeStyle = '#3f6f8f'; [[160, 120, 1], [190, 116, 1.1], [222, 140, 0.6]].forEach(([x, y, s]) => {
    g.beginPath(); g.arc(x, y - 22 * s, 9 * s, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(x, y - 13 * s); g.lineTo(x, y + 18 * s); g.moveTo(x - 12 * s, y); g.lineTo(x + 12 * s, y); g.moveTo(x, y + 18 * s); g.lineTo(x - 9 * s, y + 34 * s); g.moveTo(x, y + 18 * s); g.lineTo(x + 9 * s, y + 34 * s); g.stroke();
  });
  g.fillStyle = '#5e8a54'; g.font = 'bold 22px "PingFang SC","Noto Sans SC",sans-serif'; g.fillText('妈妈', 146, 186); g.fillText('我', 214, 186);
  return c;
}
const drawing = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.375), new THREE.MeshStandardMaterial({ map: toTex(drawingCanvas(), true, false), roughness: 0.9 }));
drawing.position.set(-3.49, 1.35, 0.6); drawing.rotation.y = Math.PI / 2; drawing.rotation.z = 0.04; wLeft.full.add(drawing);
function tallyCanvas() {
  const c = mkCanvas(512, 128), g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128); g.strokeStyle = 'rgba(235,232,220,.85)'; g.lineCap = 'round'; g.lineWidth = 7;
  const zheng = (x, n) => {
    const S = [[x, 20, x + 70, 20], [x + 35, 20, x + 35, 108], [x + 35, 62, x + 66, 62], [x + 10, 64, x + 10, 108], [x - 2, 108, x + 74, 108]];
    for (let i = 0; i < n; i++) { const s = S[i]; g.beginPath(); g.moveTo(s[0] + rnd(-2, 2), s[1] + rnd(-2, 2)); g.lineTo(s[2] + rnd(-2, 2), s[3] + rnd(-2, 2)); g.stroke(); }
  };
  zheng(12, 5); zheng(112, 5); zheng(212, 5); zheng(312, 5); zheng(412, 1);
  return c;
}
const tally = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: toTex(tallyCanvas(), true, false), transparent: true, roughness: 1 }));
tally.position.set(1.0, 1.65, -2.99); wBack.full.add(tally);

/* ---------------- porch & yard ---------------- */
scene.add(mesh(boxGeo(7.2, 0.2, 2.25, matPorch.userData.tile), matPorch, 0, -0.1, 4.325, false, true));
scene.add(mesh(boxGeo(2.0, 0.13, 0.5, 1.0), matPorch, 0, -0.185, 5.7, false, true));
const posts = [[-3.45, 5.3], [3.45, 5.3]];
posts.forEach(([x, z]) => { scene.add(mesh(boxGeo(0.16, 2.7, 0.16), matTrim, x, 1.35, z)); addCol(x - 0.1, x + 0.1, z - 0.1, z + 0.1, 'post'); });
[[-2.2, 1.3], [2.2, 1.3]].forEach(([x, w]) => {
  scene.add(mesh(boxGeo(w + 0.2, 0.07, 0.07), matTrim, Math.sign(x) * (1.0 + (w + 0.2) / 2 + 0.05), 0.85, 5.3));
  for (let i = 0; i < 4; i++) scene.add(mesh(boxGeo(0.05, 0.8, 0.05), matTrim, Math.sign(x) * (1.25 + i * 0.6), 0.42, 5.3));
});
addCol(-3.5, -1.0, 5.22, 5.38, 'rail'); addCol(1.0, 3.5, 5.22, 5.38, 'rail');

// floodlight on a pole in front of the porch + battery: the yard's only safe zone
const POLE = new V3(1.55, GROUND_Y, 5.85);
scene.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.85, 8), matTrim, POLE.x, GROUND_Y + 2.42, POLE.z));
addCol(POLE.x - 0.12, POLE.x + 0.12, POLE.z - 0.12, POLE.z + 0.12, 'post');
const flood = new THREE.Group(); flood.position.set(POLE.x, 4.42, POLE.z + 0.05); scene.add(flood);
flood.add(mesh(boxGeo(0.36, 0.24, 0.2), matIron));
const lensMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeaff, emissiveIntensity: 5, roughness: 0.2 });
const lens = mesh(boxGeo(0.3, 0.18, 0.02), lensMat, 0, 0, 0.11, false, false); flood.add(lens);
const floodTarget = new THREE.Object3D(); floodTarget.position.set(0.4, GROUND_Y, 8.7); scene.add(floodTarget);
flood.lookAt(floodTarget.position);
const FLOOD_ANGLE = 0.62;
const floodLight = new THREE.SpotLight(0xdde8ff, 3.2, 22, FLOOD_ANGLE, 0.45, 1.0);
floodLight.position.set(POLE.x, 4.36, POLE.z + 0.16); floodLight.target = floodTarget; floodLight.castShadow = true;
floodLight.shadow.mapSize.set(1024, 1024); floodLight.shadow.bias = -0.0008; floodLight.shadow.camera.near = 0.5; floodLight.shadow.camera.far = 24;
scene.add(floodLight);
const battery = group(POLE.x + 0.35, GROUND_Y, POLE.z - 0.15, 0.3); bx(battery, 0.32, 0.22, 0.2, 0, 0.11, 0, new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.6 }));
bx(battery, 0.05, 0.03, 0.05, -0.09, 0.235, 0, new THREE.MeshStandardMaterial({ color: 0xa33a2a })); bx(battery, 0.05, 0.03, 0.05, 0.09, 0.235, 0, matIron);
const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(POLE.x + 0.05, 4.3, POLE.z), new V3(POLE.x + 0.08, 1.2, POLE.z + 0.02), new V3(POLE.x + 0.3, GROUND_Y + 0.23, POLE.z - 0.15)]), new THREE.LineBasicMaterial({ color: 0x111111 }));
scene.add(cable);
// volumetric beam: open cone with soft additive shader
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { color: { value: new THREE.Color(0x8fa6c8) }, intensity: { value: 0.18 }, time: { value: 0 } },
  vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 color; uniform float intensity; uniform float time; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge=pow(abs(dot(vN,vV)),1.6); float fall=pow(vY,1.4); float n=0.85+0.15*sin(vY*30.0-time*3.0); gl_FragColor=vec4(color*intensity*edge*fall*n,1.0); }'
});
const beamLen = floodLight.position.distanceTo(floodTarget.position) * 1.15;
const beamGeo = new THREE.ConeGeometry(Math.tan(FLOOD_ANGLE) * beamLen * 0.85, beamLen, 32, 1, true);
beamGeo.translate(0, -beamLen / 2, 0);
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.position.copy(floodLight.position);
beam.quaternion.setFromUnitVectors(new V3(0, -1, 0), floodTarget.position.clone().sub(floodLight.position).normalize());
scene.add(beam);

// ground: mud + puddles + footprints
function mudCanvas() {
  const c = mkCanvas(512, 512), g = c.getContext('2d'), R = rng(77);
  g.fillStyle = '#2a211a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    const x = R() * 512, y = R() * 512, r = 2 + R() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r);
    const v = R(); gr.addColorStop(0, v < 0.5 ? 'rgba(14,10,7,.35)' : 'rgba(70,58,44,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '90,80,64' : '20,16,12'},.5)`; g.fillRect(R() * 512, R() * 512, 2 + R() * 3, 2 + R() * 3); }
  return c;
}
const mud = mudCanvas();
const mudMap = toTex(mud), mudBump = toTex(mud, false); mudMap.repeat.set(9, 9); mudBump.repeat.set(9, 9);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: mudMap, roughness: 0.86, metalness: 0.0 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND_Y; ground.receiveShadow = true; scene.add(ground);
const puddleMat = new THREE.MeshStandardMaterial({ color: 0x030405, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.88 });
const puddles = [];
[[1.4, 8.4, 1.2, 0.7], [-1.8, 10.2, 0.9, 0.6], [3.0, 11.5, 1.4, 0.8], [-3.8, 7.6, 0.8, 0.5], [0.4, 12.6, 1.1, 0.7], [5.4, 8.8, 0.9, 0.6]].forEach(([x, z, a, b]) => {
  const p = new THREE.Mesh(new THREE.CircleGeometry(1, 24), puddleMat); p.rotation.x = -Math.PI / 2; p.position.set(x, GROUND_Y + 0.006, z); p.scale.set(a, b, 1); p.receiveShadow = true; scene.add(p); puddles.push({ x, z, a, b });
});
function printsCanvas() {
  const c = mkCanvas(128, 512), g = c.getContext('2d'); g.clearRect(0, 0, 128, 512);
  for (let i = 0; i < 8; i++) { const x = i % 2 ? 78 : 46, y = 470 - i * 62; g.fillStyle = 'rgba(8,6,4,.55)'; g.beginPath(); g.ellipse(x, y, 12, 22, 0.1, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, y - 28, 10, 9, 0, 0, 7); g.fill(); }
  return c;
}
const prints = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 2.4), new THREE.MeshStandardMaterial({ map: toTex(printsCanvas(), true, false), transparent: true, roughness: 0.9, depthWrite: false }));
prints.rotation.x = -Math.PI / 2; prints.rotation.z = 0.15; prints.position.set(0.3, GROUND_Y + 0.008, 7.4); scene.add(prints);

// clothesline with sheets that move in the wind
const lineA = new V3(-7.6, 1.85, 7.2), lineB = new V3(-4.2, 1.85, 9.6);
[lineA, lineB].forEach(p => scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.1 - GROUND_Y, 8), matTrim, p.x, (2.1 + GROUND_Y) / 2, p.z)));
const ropeGeo = new THREE.BufferGeometry().setFromPoints([lineA, lineB]);
scene.add(new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: 0x2a2620 })));
const sheets = [];
['#cfc8b8', '#9fb0bf', '#c4b49a'].forEach((col, i) => {
  const geo = new THREE.PlaneGeometry(0.9, 1.15, 10, 10); geo.translate(0, -0.575, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(col, 0.55, false, 50 + i)), roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.94 }));
  const t = (i + 0.5) / 3; m.position.lerpVectors(lineA, lineB, t); m.position.y -= 0.02;
  m.rotation.y = Math.atan2(lineB.x - lineA.x, lineB.z - lineA.z) - Math.PI / 2; m.castShadow = true; m.receiveShadow = true;
  m.userData.base = Float32Array.from(geo.attributes.position.array); m.userData.ph = i * 1.7;
  scene.add(m); sheets.push(m);
});

// dead trees, fence, bushes (cover for lurkers)
const treePos = [];
function deadTree(x, z, s, seed) {
  const R = rng(seed), g = group(x, GROUND_Y, z, R() * 6);
  const trunkH = 3.2 * s;
  const tr = mesh(new THREE.CylinderGeometry(0.08 * s, 0.24 * s, trunkH, 8), matTreeBark, 0, trunkH / 2, 0); g.add(tr);
  const branch = (parent, len, rad, depth, y, ang, tilt) => {
    const b = new THREE.Group(); b.position.y = y; b.rotation.set(tilt, ang, 0); parent.add(b);
    const m = mesh(new THREE.CylinderGeometry(rad * 0.5, rad, len, 6), matTreeBark, 0, len / 2, 0); b.add(m);
    if (depth > 0) for (let i = 0; i < 2 + (R() < 0.5); i++) branch(b, len * 0.65, rad * 0.6, depth - 1, len * (0.6 + R() * 0.35), R() * 6.28, 0.5 + R() * 0.5);
  };
  for (let i = 0; i < 4; i++) branch(g, 1.4 * s, 0.09 * s, 2, trunkH * (0.45 + R() * 0.45), R() * 6.28, 0.6 + R() * 0.4);
  treePos.push({ x, z }); return g;
}
[[-8.5, 11], [7.5, 12.5], [-11, 4], [11.5, 6], [-4, 16.5], [3.5, 17.5], [-14, 13], [14, 15], [-9, -6], [8, -7], [0, -11], [-17, -1], [17, -2]].forEach(([x, z], i) => deadTree(x, z, rnd(0.8, 1.25), 100 + i));
const bushMat = new THREE.MeshStandardMaterial({ color: 0x0f140d, roughness: 1, flatShading: true });
const bushes = [[-6.2, 12.4], [6.6, 10.4], [-9.6, 8.2], [9.8, 9.2], [1.8, 15.4], [-2.6, 14.8]];
function bushGeo(r) { const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 9) * Math.cos(p.getZ(i) * 7) + Math.sin(p.getY(i) * 11)) * 0.12 + rnd(-0.06, 0.06); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.75, p.getZ(i) * k); } g.computeVertexNormals(); return g; }
const twigMat = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 1 });
bushes.forEach(([x, z]) => {
  for (let i = 0; i < 5; i++) scene.add(mesh(bushGeo(rnd(0.28, 0.5)), bushMat, x + rnd(-0.6, 0.6), GROUND_Y + rnd(0.12, 0.3), z + rnd(-0.45, 0.45)));
  for (let i = 0; i < 9; i++) { const t = mesh(new THREE.CylinderGeometry(0.004, 0.012, rnd(0.5, 1.1), 4), twigMat, x + rnd(-0.7, 0.7), GROUND_Y + 0.4, z + rnd(-0.5, 0.5)); t.rotation.set(rnd(-0.7, 0.7), 0, rnd(-0.7, 0.7)); scene.add(t); }
});
for (let i = 0; i < 22; i++) {
  const a = -0.2 + i / 21 * 3.5, r = 15.5, x = Math.cos(a) * r * 1.1, z = 4 + Math.sin(a) * r;
  if (i % 5 === 3) continue;
  const p = mesh(boxGeo(0.12, 1.2, 0.12), matTrim, x, GROUND_Y + 0.6, z); p.rotation.z = rnd(-0.12, 0.12); scene.add(p);
  if (i % 5 !== 2) { const a2 = a + 1 / 21 * 3.5, x2 = Math.cos(a2) * r * 1.1, z2 = 4 + Math.sin(a2) * r, len = Math.hypot(x2 - x, z2 - z);
    const rail = mesh(boxGeo(len, 0.07, 0.05), matTrim, (x + x2) / 2, GROUND_Y + 0.85, (z + z2) / 2); rail.rotation.y = -Math.atan2(z2 - z, x2 - x); scene.add(rail); }
}

// moon + cloud deck + ground fog
const moonTex = softDisc(256, [[0, 'rgba(235,240,255,1)'], [0.16, 'rgba(220,230,250,.95)'], [0.2, 'rgba(160,185,220,.35)'], [0.5, 'rgba(90,120,170,.08)'], [1, 'rgba(60,80,120,0)']]);
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true }));
moon.position.set(-38, 46, -80); moon.scale.set(34, 34, 1); scene.add(moon);
function cloudCanvas(seed, alpha) {
  const c = mkCanvas(512, 512), g = c.getContext('2d'), R = rng(seed);
  for (let i = 0; i < 260; i++) {
    const x = R() * 512, y = R() * 512, r = 20 + R() * 90, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${alpha * R()})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  return c;
}
const fogTex = toTex(cloudCanvas(9, 0.22), true, true);
const fogLayers = [];
[0.05, 0.4].forEach((y, i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ map: fogTex.clone(), color: 0x7f93ad, transparent: true, opacity: 0.16 - i * 0.05, depthWrite: false }));
  m.material.map.needsUpdate = true; m.material.map.repeat.set(3, 3); m.rotation.x = -Math.PI / 2; m.position.y = GROUND_Y + y; m.renderOrder = 2; scene.add(m); fogLayers.push(m);
});
const cloudTex = toTex(cloudCanvas(19, 0.5), true, true); cloudTex.repeat.set(2, 2);
const clouds = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: cloudTex, color: 0x223047, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
clouds.rotation.x = Math.PI / 2; clouds.position.y = 34; scene.add(clouds);

/* ---------------- lights ---------------- */
const hemi = new THREE.HemisphereLight(0x2c3d58, 0x100b07, 0.22); scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0x7f9ccc, 0.8);
moonLight.position.set(-7.1, 11, -16.1); moonLight.target.position.set(-0.1, 0, -1.09);
moonLight.castShadow = true; moonLight.shadow.mapSize.set(2048, 2048);
Object.assign(moonLight.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 45 });
moonLight.shadow.bias = -0.0006; moonLight.shadow.normalBias = 0.02;
scene.add(moonLight, moonLight.target);
const flashLight = new THREE.DirectionalLight(0xc8d8ff, 0); flashLight.position.set(5, 20, 8); scene.add(flashLight);

// faux volumetric moonbeam through the window + dust motes
const mbDir = new V3(0.35, -0.55, 0.75).normalize();
const mbLen = 3.4;
const mbGeo = new THREE.BoxGeometry(1.15, 0.95, mbLen); mbGeo.translate(0, 0, mbLen / 2);
const mbMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { intensity: { value: 0.075 }, len: { value: mbLen } },
  vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform float intensity, len; varying vec3 vP; void main(){ float f=(1.0-vP.z/len); float e=(1.0-smoothstep(0.35,0.6,abs(vP.x)))*(1.0-smoothstep(0.3,0.5,abs(vP.y))); gl_FragColor=vec4(vec3(0.55,0.68,0.95)*intensity*f*e,1.0); }'
});
const moonBeam = new THREE.Mesh(mbGeo, mbMat);
moonBeam.position.set(-1.0, 1.45, -3.02);
moonBeam.quaternion.setFromUnitVectors(new V3(0, 0, 1), mbDir);
scene.add(moonBeam);
const dustN = 90, dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(dustN * 3), dustSeed = [];
for (let i = 0; i < dustN; i++) { dustSeed.push([rnd(), rnd(-0.5, 0.5), rnd(-0.4, 0.4), rnd(0.2, 1)]); }
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.012, color: 0xb9c9e6, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(dust);

/* ---------------- rain ---------------- */
const RAIN_N = 4200;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 6), rainCol = new Float32Array(RAIN_N * 6), rainV = new Float32Array(RAIN_N);
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
rainGeo.setAttribute('color', new THREE.BufferAttribute(rainCol, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
rain.frustumCulled = false; scene.add(rain);
const rainCenter = new V3(0, 0, 6);
function spawnDrop(i, anyY) {
  let x, z, tries = 0;
  do { x = rainCenter.x + rnd(-17, 17); z = rainCenter.z + rnd(-17, 17); tries++; } while (x > -3.9 && x < 3.9 && z > -3.4 && z < 5.6 && tries < 8);
  const y = anyY ? rnd(GROUND_Y, 13) : rnd(10, 13);
  rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z;
  rainPos[i * 6 + 3] = x; rainPos[i * 6 + 4] = y + 0.34; rainPos[i * 6 + 5] = z;
  rainV[i] = rnd(17, 23);
}
for (let i = 0; i < RAIN_N; i++) spawnDrop(i, true);
// splashes
const SPL_N = 260, splGeo = new THREE.BufferGeometry(), splPos = new Float32Array(SPL_N * 3), splCol = new Float32Array(SPL_N * 3), splLife = new Float32Array(SPL_N);
splGeo.setAttribute('position', new THREE.BufferAttribute(splPos, 3)); splGeo.setAttribute('color', new THREE.BufferAttribute(splCol, 3));
const splashTex = softDisc(32, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
const splashes = new THREE.Points(splGeo, new THREE.PointsMaterial({ size: 0.07, map: splashTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
splashes.frustumCulled = false; scene.add(splashes);
let splIdx = 0;
// puddle ripples
const ripplePool = [];
for (let i = 0; i < 18; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0, color: 0x9fb0c4 }));
  m.rotation.x = -Math.PI / 2; m.userData.t = rnd(0, 1); scene.add(m); ripplePool.push(m);
}

/* light queries used by AI */
const _v = new V3(), _fd = new V3();
function floodLevel() { return floodLight.intensity / 3.2; }
const FLOOD_COS = Math.cos(FLOOD_ANGLE * 0.9);
function floodCone(p) { // lit if knees or chest are inside the cone
  _fd.copy(floodTarget.position).sub(floodLight.position).normalize();
  for (const hy of [0.45, 1.1]) {
    _v.set(p.x, p.y + hy, p.z).sub(floodLight.position); const d = _v.length();
    if (d < 16 && _v.divideScalar(d).dot(_fd) > FLOOD_COS) return true;
  }
  return false;
}
function inFlood(p) { return floodLevel() >= 0.45 && floodCone(p); }
