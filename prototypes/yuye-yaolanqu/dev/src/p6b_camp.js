/* ===== P6b camp: a door that gives way plank by plank, windows that shatter and get boarded, the ways in ===== */
// --- debris: wood chips and glass shards, coloured per particle ---
const DB_N = 360, dbGeo = new THREE.BufferGeometry(), dbPos = new Float32Array(DB_N * 3), dbVel = new Float32Array(DB_N * 3), dbCol = new Float32Array(DB_N * 3), dbLife = new Float32Array(DB_N);
dbGeo.setAttribute('position', new THREE.BufferAttribute(dbPos, 3)); dbGeo.setAttribute('color', new THREE.BufferAttribute(dbCol, 3));
const debrisPts = new THREE.Points(dbGeo, new THREE.PointsMaterial({ size: 0.045, map: dropTex, vertexColors: true, transparent: true, depthWrite: false }));
debrisPts.frustumCulled = false; scene.add(debrisPts); let dbIdx = 0;
for (let i = 0; i < DB_N; i++) dbPos[i * 3 + 1] = -50;
function spawnDebris(p, dir, n, kind) {
  const glassy = kind === 'glass';
  for (let k = 0; k < n; k++) {
    const i = dbIdx++ % DB_N, s = rnd(0.5, 2.6);
    dbPos[i * 3] = p.x + rnd(-0.06, 0.06); dbPos[i * 3 + 1] = p.y + rnd(-0.06, 0.06); dbPos[i * 3 + 2] = p.z + rnd(-0.06, 0.06);
    dbVel[i * 3] = dir.x * s + rnd(-0.9, 0.9); dbVel[i * 3 + 1] = rnd(0.2, 2.0) + dir.y * s; dbVel[i * 3 + 2] = dir.z * s + rnd(-0.9, 0.9);
    const b = glassy ? rnd(0.6, 1) : rnd(0.45, 0.85);
    dbCol[i * 3] = glassy ? b * 0.75 : b * 0.8; dbCol[i * 3 + 1] = glassy ? b * 0.86 : b * 0.62; dbCol[i * 3 + 2] = glassy ? b : b * 0.4;
    dbLife[i] = glassy ? rnd(1.2, 2.2) : rnd(3, 6);
  }
}
function updateDebris(dt) {
  for (let i = 0; i < DB_N; i++) {
    if (dbLife[i] <= 0) continue; dbLife[i] -= dt;
    if (dbVel[i * 3] || dbVel[i * 3 + 1] || dbVel[i * 3 + 2]) {
      dbVel[i * 3 + 1] -= 9.8 * dt; dbPos[i * 3] += dbVel[i * 3] * dt; dbPos[i * 3 + 1] += dbVel[i * 3 + 1] * dt; dbPos[i * 3 + 2] += dbVel[i * 3 + 2] * dt;
      const gy = groundY(dbPos[i * 3], dbPos[i * 3 + 2]); if (dbPos[i * 3 + 1] < gy + 0.012) { dbPos[i * 3 + 1] = gy + 0.012; dbVel[i * 3] = dbVel[i * 3 + 1] = dbVel[i * 3 + 2] = 0; }
    }
    if (dbLife[i] <= 0) dbPos[i * 3 + 1] = -50;
  }
  dbGeo.attributes.position.needsUpdate = true; dbGeo.attributes.color.needsUpdate = true;
}

/* ---------------- the front door: 6 vertical planks x 8 sections, two battens and a brace inside, a bar across ---------------- */
const DOOR = { W: 1.1, H: 2.02, T: 0.055, N: 6, R: 8 }; DOOR.pw = DOOR.W / DOOR.N; DOOR.rh = DOOR.H / DOOR.R;
function vertWoodCanvas(base, seed) { const src = woodCanvas(base, 22, 256, 256, seed, 0.6), c = mkCanvas(256, 256), g = c.getContext('2d'); g.translate(128, 128); g.rotate(Math.PI / 2); g.drawImage(src, -128, -128); return c; }
const doorMat = new THREE.MeshStandardMaterial({ map: toTex(vertWoodCanvas('#5c4229', 33)), roughness: 0.86 });
const battenMat = new THREE.MeshStandardMaterial({ map: toTex(woodCanvas('#4e3822', 18, 256, 64, 35, 0.5)), roughness: 0.9 });
const freshWood = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.9 });
function segGeo(w, h, d, x0, y0) { const g = boxGeo(w, h, d, 0.9), uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) + x0 / 0.9, uv.getY(k) + y0 / 0.9); return g; }
// an axe cut: pale fresh wood around a dark wedge; it deepens with every chop on the same spot
const gougeMat = new THREE.MeshStandardMaterial({ map: (() => { const c = mkCanvas(128, 48), g = c.getContext('2d');
  // a lens of freshly exposed pale wood, torn fibres along its edges, a dark slit where the blade went in, shadow on the lower lip
  g.fillStyle = 'rgba(206,166,108,1)'; g.beginPath(); g.moveTo(4, 24); g.quadraticCurveTo(64, 6, 124, 22); g.quadraticCurveTo(64, 40, 4, 24); g.fill();
  g.strokeStyle = 'rgba(150,108,62,.9)'; g.lineWidth = 1; for (let i = 0; i < 26; i++) { const x = 10 + Math.random() * 108; g.beginPath(); g.moveTo(x, 18 + Math.random() * 4); g.lineTo(x + (Math.random() - 0.5) * 6, 28 + Math.random() * 4); g.stroke(); }
  g.fillStyle = 'rgba(232,200,150,.8)'; for (let i = 0; i < 14; i++) g.fillRect(10 + Math.random() * 104, 14 + Math.random() * 18, 3 + Math.random() * 6, 1);
  g.fillStyle = 'rgba(60,36,18,.85)'; g.beginPath(); g.moveTo(14, 25); g.quadraticCurveTo(64, 36, 116, 24); g.quadraticCurveTo(64, 31, 14, 25); g.fill();
  g.strokeStyle = 'rgba(10,5,2,1)'; g.lineWidth = 3; g.beginPath(); g.moveTo(16, 23.5); g.quadraticCurveTo(64, 26, 112, 22.5); g.stroke();
  return toTex(c, true, false); })(), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const crackMat = new THREE.MeshStandardMaterial({ map: (() => { const c = mkCanvas(16, 128), g = c.getContext('2d'); g.strokeStyle = 'rgba(14,8,4,.95)'; g.lineWidth = 2.2; g.beginPath(); let x = 8; g.moveTo(x, 0);
  for (let y = 8; y <= 128; y += 8) { x = clamp(x + rnd(-3.5, 3.5), 2, 14); g.lineTo(x, y); } g.stroke(); return toTex(c, true, false); })(), transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const door = { pivot: new THREE.Group(), leaf: new THREE.Group(), segs: [], ang: 0, angV: 0, target: 0, barred: false, barHp: 1, barBroken: false, latch: 1, hinge: [1, 1], sag: 0, shake: 0, shakeV: 0, fallen: false, fall: null, reach: false, crawl: false, holes: 0, cut: false, upper: [] };
door.pivot.position.set(-0.55, 0, 3.13); scene.add(door.pivot); door.pivot.add(door.leaf);
for (let i = 0; i < DOOR.N; i++) {
  const col = [];
  for (let r = 0; r < DOOR.R; r++) { const x0 = DOOR.pw * i, y0 = DOOR.rh * r, m = mesh(segGeo(DOOR.pw - 0.007, DOOR.rh + 0.002, DOOR.T, x0, y0), doorMat, x0 + DOOR.pw / 2, y0 + DOOR.rh / 2, 0); door.leaf.add(m); col.push({ m, hp: 1, cracks: 0, broken: false, marks: [] }); }
  door.segs.push(col);
}
[0.36, 1.66].forEach(y => { const b = mesh(boxGeo(DOOR.W - 0.06, 0.12, 0.03, 0.9), battenMat, DOOR.W / 2, y, -DOOR.T / 2 - 0.016); door.leaf.add(b); if (y > 1) door.upper.push(b); });
{ const len = Math.hypot(1.0, 1.2), b = mesh(boxGeo(len, 0.1, 0.028, 0.9), battenMat, DOOR.W / 2, 1.01, -DOOR.T / 2 - 0.018); b.rotation.z = Math.atan2(1.2, 1.0); door.leaf.add(b); door.upper.push(b); }
[0.3, 1.72].forEach(y => { const s = mesh(new THREE.BoxGeometry(0.46, 0.045, 0.012), matIron, 0.22, y, DOOR.T / 2 + 0.006); door.leaf.add(s); if (y > 1) door.upper.push(s); });
door.leaf.add(mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 14), matIron, 0.96, 1.0, DOOR.T / 2 + 0.03));
// frame and the bar brackets on the inside of the front wall
[-0.585, 0.585].forEach(x => wFront.full.add(mesh(boxGeo(0.07, 2.07, 0.24), matTrim, x, 1.035, 3.1)));
[-0.72, 0.72].forEach(x => scene.add(mesh(new THREE.BoxGeometry(0.08, 0.11, 0.07), matIron, x, 1.05, 2.965)));
const barMesh = mesh(boxGeo(1.55, 0.085, 0.065, 0.9), battenMat, 0, 0, 0); scene.add(barMesh);
const BAR_ON = { p: new V3(0, 1.05, 2.955), rz: 0 }, BAR_OFF = { p: new V3(1.1, 0.76, 2.93), rz: 1.4 };
door.barK = 0; // 0 leaning against the wall … 1 across the brackets
door.col = { x0: -0.58, x1: 0.58, z0: 3.0, z1: 3.22, tag: 'door', off: false }; colliders.push(door.col);
door.box = { x0: -0.58, x1: 0.58, z0: 3.0, z1: 3.22 };
function doorLocal(p) { const q = door.leaf.worldToLocal(p.clone()); return q; }
function doorWorld(lx, ly, lz = 0) { door.leaf.updateWorldMatrix(true, false); return door.leaf.localToWorld(new V3(lx, ly, lz)); }
function doorHoles() {
  let reach = false, crawl = false, holes = 0; const S = door.segs;
  const atBar = r => r * DOOR.rh + DOOR.rh > 0.75 && r * DOOR.rh < 1.4;
  for (let i = 0; i < DOOR.N; i++) for (let r = 0; r < DOOR.R; r++) if (S[i][r].broken) {
    holes++; if (!atBar(r)) continue;
    if ((S[i][r + 1] && S[i][r + 1].broken) || (S[i][r - 1] && S[i][r - 1].broken) || (S[i + 1] && S[i + 1][r].broken) || (S[i - 1] && S[i - 1][r].broken)) reach = true;
  }
  for (let i = 0; i < DOOR.N - 1; i++) { let run = 0; for (let r = 0; r < 5; r++) { if (S[i][r].broken && S[i + 1][r].broken) { if (++run >= 3) crawl = true; } else run = 0; } }
  door.reach = reach; door.crawl = crawl; door.holes = holes;
}
function addMark(s, mat, lx, ly, w, h, rz) { // a mark lives on its section and leaves with it
  const m = new THREE.Mesh(planeGeo, mat); m.position.set(lx - s.m.position.x, ly - s.m.position.y, DOOR.T / 2 + 0.002); m.scale.set(w, h, 1); m.rotation.z = rz; s.m.add(m); s.marks.push(m); return m;
}
function crackSeg(i, r) { const s = door.segs[i] && door.segs[i][r]; if (!s || s.broken || s.cracks > 2) return; s.cracks++; addMark(s, crackMat, s.m.position.x + rnd(-0.05, 0.05), s.m.position.y + rnd(-0.03, 0.03), 0.03, DOOR.rh * rnd(1.0, 1.5), rnd(-0.08, 0.08)); }
function breakSeg(i, r, from) {
  const s = door.segs[i][r]; if (s.broken) return; s.broken = true;
  const g = s.m.clone(); s.m.parent.add(g); s.m.visible = false;
  const inward = new V3(0, 0, -1).applyQuaternion(door.leaf.getWorldQuaternion(new THREE.Quaternion())), dir = from ? inward : inward.negate();
  detachGib(g, dir.multiplyScalar(rnd(1.2, 2.4)).add(new V3(rnd(-0.4, 0.4), rnd(0.2, 1.0), 0)), new V3(rnd(-7, 7), rnd(-5, 5), rnd(-7, 7)), { r: 0.04, dry: true, thud: 'wood' });
  // splinters left sticking out of the sections above and below
  for (const [rr, sgn] of [[r + 1, -1], [r - 1, 1]]) { const n = door.segs[i][rr]; if (!n || n.broken) continue;
    for (let k = 0; k < 3; k++) { const sp = mesh(new THREE.BoxGeometry(rnd(0.012, 0.022), rnd(0.04, 0.09), 0.018), freshWood, rnd(-DOOR.pw * 0.35, DOOR.pw * 0.35), sgn * DOOR.rh / 2, rnd(-0.01, 0.01)); sp.rotation.z = rnd(-0.3, 0.3); n.m.add(sp); n.marks.push(sp); } }
  const wp = doorWorld(s.m.position.x, s.m.position.y); spawnDebris(wp, inward, 14, 'wood'); SND.splinter(wp);
  doorHoles(); if (door.cut && r >= 4) g.visible = false;
}
// one blow with an axe: the section takes most of it, the grain carries it up and down the plank
function doorChop(lx, ly, power) {
  if (door.fallen) return; door.shakeV += 2.4 * power; const wp = doorWorld(lx, ly, DOOR.T / 2);
  let i = clamp(Math.floor(lx / DOOR.pw), 0, DOOR.N - 1), r = clamp(Math.floor(ly / DOOR.rh), 0, DOOR.R - 1);
  if (door.segs[i][r].broken) { const alt = [[i, r + 1], [i, r - 1], [i + 1, r], [i - 1, r]].filter(([a, b]) => door.segs[a] && door.segs[a][b] && !door.segs[a][b].broken); if (!alt.length) return; [i, r] = alt[Math.floor(Math.random() * alt.length)]; }
  const s = door.segs[i][r], batten = Math.abs(ly - 0.36) < 0.1 || Math.abs(ly - 1.66) < 0.1;
  const dmg = rnd(0.11, 0.19) * power * (batten ? 0.45 : 1) * (s.cracks ? 1.2 : 1);
  s.hp -= dmg;
  const near = s.marks.find(m => m.material === gougeMat && Math.hypot(m.position.x - (lx - s.m.position.x), m.position.y - (ly - s.m.position.y)) < 0.07);
  if (near) { near.scale.x = Math.min(0.3, near.scale.x * 1.15); near.scale.y = Math.min(0.11, near.scale.y * 1.3); } else addMark(s, gougeMat, lx, ly, rnd(0.13, 0.18), rnd(0.045, 0.06), rnd(-0.45, 0.45));
  for (const [a, b, k] of [[i, r + 1, 0.3], [i, r - 1, 0.3], [i + 1, r, 0.1], [i - 1, r, 0.1]]) { const n = door.segs[a] && door.segs[a][b]; if (n && !n.broken) { n.hp -= dmg * k; if (n.hp < 0.55 && !n.cracks) crackSeg(a, b); if (n.hp <= 0) breakSeg(a, b, true); } }
  if (s.hp < 0.55 && s.cracks < 1) crackSeg(i, r); if (s.hp < 0.25 && s.cracks < 2) { crackSeg(i, r); crackSeg(i, r + 1); }
  if (s.hp <= 0) breakSeg(i, r, true);
  if (door.barred) { door.barHp -= 0.015 * power; if (door.barHp <= 0) breakBar(); }
  spawnDebris(wp, new V3(0, 0, 1).applyQuaternion(door.leaf.getWorldQuaternion(new THREE.Quaternion())), 8, 'wood'); SND.chop(wp);
  makeNoise(wp, 11, 'chop');
}
// a shoulder slammed into it: little damage to the boards, but the hinges and the bar take it
function doorRam(power) {
  if (door.fallen) return; door.shakeV += 6 * power; const wp = doorWorld(DOOR.W * 0.7, 1.2, DOOR.T / 2);
  const br = doorBraced() ? 0.5 : 1; // someone leaning on it from inside takes half of it
  door.hinge[0] -= rnd(0.05, 0.09) * power * br; door.hinge[1] -= rnd(0.03, 0.06) * power * br;
  if (door.barred) { door.barHp -= rnd(0.04, 0.07) * power * br; if (door.barHp <= 0) breakBar(); }
  else if (door.latch > 0) { door.latch -= 0.4 * power * br; if (door.latch <= 0) { doorBurst(); door.target = 1.35; door.angV = 4; SND.splinter(wp); } }
  const i = clamp(Math.floor(rnd(2, 6)), 0, 5), r = clamp(Math.floor(rnd(3, 6)), 0, 7), s = door.segs[i][r]; if (!s.broken) { s.hp -= 0.05 * power; if (s.hp < 0.55 && !s.cracks) crackSeg(i, r); if (s.hp <= 0) breakSeg(i, r, true); }
  if (door.hinge[0] <= 0 && door.sag < 0.05) { door.sag = 0.055; SND.splinter(wp); floatLabel('上合页崩了', doorWorld(0.1, 1.8, 0.3), 'heavy'); }
  if (door.hinge[0] <= 0 && door.hinge[1] <= 0) collapseDoor();
  spawnDebris(doorWorld(DOOR.W / 2, 2.05, 0), new V3(0, -1, 0), 6, 'wood'); SND.doorBang(wp, power); makeNoise(wp, 12, 'ram');
}
// fists and shoulders of the rest: mostly noise, a little wear
function doorPound(power) {
  if (door.fallen) return; door.shakeV += 1.2 * power; const wp = doorWorld(rnd(0.3, 0.9), rnd(0.9, 1.5), DOOR.T / 2);
  if (!door.barred && door.latch > 0) { door.latch -= 0.12 * power * (doorBraced() ? 0.4 : 1); if (door.latch <= 0) { doorBurst(); door.target = 1.35; door.angV = 3; SND.splinter(wp); floatLabel('门扣被撞脱了', wp, 'heavy'); } }
  const i = Math.floor(rnd(0, 6)), r = Math.floor(rnd(1, 6)), s = door.segs[i][r]; if (!s.broken) s.hp -= 0.012 * power;
  SND.doorBang(wp, 0.35 * power); makeNoise(wp, 8, 'pound');
}
function breakBar() {
  if (door.barBroken) return; door.barBroken = true; door.barred = false; door.barHp = 0; SND.splinter(BAR_ON.p); SND.crunch(BAR_ON.p, 4, 0.5);
  barMesh.visible = false; const half = (x, rz) => { const m = mesh(boxGeo(0.75, 0.085, 0.065, 0.9), battenMat, 0, 0, 0); m.position.set(x, 1.05, 2.95); scene.add(m); detachGib(m, new V3(rnd(-0.5, 0.5), 0.5, -1.2), new V3(0, 0, rz), { r: 0.04, dry: true, thud: 'wood' }); };
  half(-0.38, 6); half(0.38, -6); floatLabel('门闩断了', BAR_ON.p.clone().add(new V3(0, 0.4, 0)), 'heavy', 1.6);
}
function collapseDoor() { if (door.fallen || door.fall) return; door.fall = { a: 0.06, v: 0.9 }; door.barred = false; floatLabel('门倒了', doorWorld(0.55, 1.5, 0.3), 'heavy', 1.6); }
function liftBar(byInfected) {
  if (!door.barred) return; door.barred = false; SND.barMove(BAR_ON.p);
  if (byInfected) { door.barThrown = true; floatLabel('它从破洞里伸手拨开了门闩', BAR_ON.p.clone().add(new V3(0, 0.6, 0)), 'heavy', 2); }
}
function setBar(on) { if (door.barBroken || door.ang > 0.08 || door.fallen) return false; door.barred = on; door.barThrown = false; SND.barMove(BAR_ON.p); return true; }
function updateDoor(dt) {
  // the bar: across its brackets, leaning by the wall, or thrown on the floor by a hand through a hole
  door.barK = damp(door.barK, door.barred ? 1 : 0, 9, dt);
  if (!door.barBroken) { const off = door.barThrown ? { p: new V3(0.4, 0.05, 2.75), rz: 0.05 } : BAR_OFF; barMesh.position.lerpVectors(off.p, BAR_ON.p, door.barK); barMesh.rotation.z = lerp(off.rz, BAR_ON.rz, door.barK) + door.shake * 0.05 * door.barK; barMesh.rotation.y = door.barThrown ? 0.3 * (1 - door.barK) : 0; }
  if (door.fallen) return;
  if (door.fall) { // falls in flat, pivoting on its bottom edge
    const F = door.fall; F.v += 9 * Math.sin(F.a + 0.05) * dt; F.a += F.v * dt;
    if (F.a >= Math.PI / 2) { F.a = Math.PI / 2; door.fallen = true; door.col.off = true; const wp = doorWorld(0.55, 1.0, 0); SND.bodyFall(wp, 70); SND.woodDrop(wp); spawnDebris(wp, new V3(0, 0.5, 0), 20, 'wood'); spawnSplash(wp, 12, 0.6, 1); G.shake = Math.max(G.shake, 0.25); makeNoise(wp, 12, 'door'); }
    door.leaf.rotation.set(-F.a, 0, -door.sag); door.col.off = true; return;
  }
  if (door.barred || (door.latch > 0 && door.target === 0 && door.ang < 0.02)) { door.ang = Math.max(0, door.ang - dt * 2); door.angV = 0; }
  else { door.angV += (30 * (door.target - door.ang) - 6 * door.angV) * dt; door.ang += door.angV * dt; if (door.ang < 0) { door.ang = 0; door.angV = 0; } if (door.ang > 1.4) { door.ang = 1.4; door.angV *= -0.3; } }
  door.shakeV += (-260 * door.shake - 9 * door.shakeV) * dt; door.shake += door.shakeV * dt;
  door.pivot.rotation.y = door.ang + door.shake * 0.035;
  // a failed top hinge: the leaf hangs from the bottom one, the latch side dropping
  const s = door.sag; door.leaf.rotation.z = -s; door.leaf.position.set(0.3 * Math.sin(s), -(0.3 - 0.3 * Math.cos(s)), 0);
  door.col.off = door.ang > 0.55;
}
// cutaway: when the camera looks in through the front wall the door is cut down with it
function setDoorCut(cut) {
  if (door.cut === cut) return; door.cut = cut;
  for (const col of door.segs) for (let r = 4; r < DOOR.R; r++) col[r].m.visible = !cut && !col[r].broken;
  for (const m of door.upper) m.visible = !cut;
}

/* ---------------- windows ---------------- */
const boardMat = new THREE.MeshStandardMaterial({ map: toTex(woodCanvas('#6a5038', 16, 256, 64, 41, 0.55)), roughness: 0.88 });
function makeBoard(w, slotY) {
  const b = mesh(boxGeo(w.len, 0.15, 0.028, 0.9), boardMat, 0, 0, 0);
  [-1, 1].forEach(k => b.add(mesh(new THREE.SphereGeometry(0.008, 5, 4), matIron, k * (w.len / 2 - 0.06), 0, w.inward ? -0.016 : 0.016, false)));
  if (w.axis === 'z') b.rotation.y = Math.PI / 2; b.rotation.z = rnd(-0.05, 0.05);
  b.position.copy(w.boardPos).setY(slotY); scene.add(b); return { m: b, hp: 1, wob: 0, wobV: 0, rz: b.rotation.z };
}
const WIN_SLOTS = [1.14, 1.47, 1.8];
const winBack = { id: 'back', name: '后窗', kind: 'window', center: new V3(-1.0, 1.45, -3.1), out: new V3(-1.0, GROUND_Y, -3.95), in: new V3(-1.0, 0, -2.45), faceIn: 0, sill: 0.95, glass: true, glassMesh: glass, boards: [], len: 1.32, axis: 'x', boardPos: new V3(-1.0, 0, -2.985) };
const winLeft = { id: 'left', name: '侧窗', kind: 'window', center: new V3(-3.6, 1.48, 1.6), out: new V3(-4.4, GROUND_Y, 1.6), in: new V3(-2.85, 0, 1.6), faceIn: Math.PI / 2, sill: 1.0, glass: false, glassMesh: null, boards: [], len: 1.25, axis: 'z', boardPos: new V3(-3.485, 0, 1.6) };
{ // the side window: frame, the teeth of glass that broke weeks ago, three boards nailed from inside (one of them already split)
  const f = new THREE.Group(); f.position.copy(winLeft.center); f.rotation.y = Math.PI / 2; scene.add(f);
  [[1.22, 0.08, 0.26, 0, 0.51], [1.22, 0.08, 0.26, 0, -0.51], [0.08, 1.06, 0.26, -0.57, 0], [0.08, 1.06, 0.26, 0.57, 0]].forEach(([w, h, d, x, y]) => f.add(mesh(boxGeo(w, h, d), matTrim, x, y, 0)));
  const shardMat = new THREE.MeshStandardMaterial({ color: 0x1a2834, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  [[-0.5, -0.4, 0.18], [0.45, 0.42, 0.14], [-0.48, 0.35, 0.1], [0.5, -0.38, 0.12]].forEach(([x, y, s]) => { const g = new THREE.BufferGeometry().setFromPoints([new V3(0, 0, 0), new V3(s * rnd(0.5, 1), s * rnd(0.2, 0.6) * Math.sign(-y), 0), new V3(s * rnd(0.1, 0.4) * Math.sign(-x), s * Math.sign(-y), 0)]); g.computeVertexNormals(); const m = new THREE.Mesh(g, shardMat); m.position.set(x, y, 0.02); f.add(m); });
  WIN_SLOTS.forEach((y, k) => { const b = makeBoard(winLeft, y + 0.12); if (k === 1) b.hp = 0.55; winLeft.boards.push(b); });
}
const ENTRIES = [
  { id: 'door', name: '正门', kind: 'door', out: new V3(0, 0, 3.78), in: new V3(0, 0, 2.4), faceIn: Math.PI },
  winBack, winLeft
];
function winClear(w) { return !w.glass && w.boards.every(b => b.hp <= 0); }
function entryOpen(en) { return en.kind === 'door' ? door.fallen || !!door.fall || door.ang > 0.6 : winClear(en); }
function smashGlass(w, from) {
  if (!w.glass) return; w.glass = false; if (w.glassMesh) w.glassMesh.visible = false;
  const inward = w.in.clone().sub(w.out).setY(0).normalize(); spawnDebris(w.center, inward, 40, 'glass'); spawnDebris(w.center, inward.clone().negate(), 12, 'glass');
  SND.glass(w.center); makeNoise(w.center, 12, 'glass'); floatLabel(w.name + '玻璃碎了', w.center.clone().add(new V3(0, 0.6, 0)), 'heavy', 1.4);
}
function hitBoard(w, power) {
  const b = w.boards.find(x => x.hp > 0); if (!b) return;
  b.hp -= rnd(0.2, 0.3) * power; b.wobV += 9 * power;
  const inward = w.in.clone().sub(w.out).setY(0).normalize(), p = b.m.position.clone();
  spawnDebris(p, inward, 5, 'wood'); SND.doorBang(p, 0.3 * power);
  if (b.hp <= 0) { SND.pry(p); SND.splinter(p); detachGib(b.m, inward.multiplyScalar(rnd(1.4, 2.2)).add(new V3(0, rnd(0.3, 0.9), 0)), new V3(rnd(-4, 4), rnd(-6, 6), rnd(-4, 4)), { r: 0.04, dry: true, thud: 'wood' }); w.boards.splice(w.boards.indexOf(b), 1); w.torn = (w.torn || 0) + 1; floatLabel('木板被扒掉了', p.clone().add(new V3(0, 0.4, 0)), '', 1.3); }
  makeNoise(p, 9, 'board');
}
function nailBoard(w) {
  if (w.boards.length >= 3 || G.planks <= 0) return false;
  const used = new Set(w.boards.map(b => b.slot)), slot = WIN_SLOTS.findIndex((y, k) => !used.has(k)); if (slot < 0) return false;
  const b = makeBoard(w, WIN_SLOTS[slot] + (w === winLeft ? 0.12 : 0)); b.slot = slot; w.boards.push(b); G.planks--; return true;
}
winLeft.boards.forEach((b, k) => { b.slot = k; });
winBack.nail = new V3(-1.0, 0, -2.72); winLeft.nail = new V3(-3.15, 0, 1.6); // where you stand to nail a board up
function updateWindows(dt) {
  for (const w of [winBack, winLeft]) for (const b of w.boards) { b.wobV += (-220 * b.wob - 8 * b.wobV) * dt; b.wob += b.wobV * dt; b.m.rotation.z = b.rz + b.wob * 0.05 * (1.2 - b.hp); }
}

/* ---------------- getting around the cabin: a tiny visibility graph ---------------- */
const NAV_BOXES = [{ x0: -3.75, x1: 3.75, z0: -3.3, z1: 3.25 }, { x0: -3.5, x1: -1.0, z0: 5.22, z1: 5.38 }, { x0: 1.0, x1: 3.5, z0: 5.22, z1: 5.38 }];
const NAV_NODES = [new V3(-4.4, 0, -3.95), new V3(4.4, 0, -3.95), new V3(-4.4, 0, 3.9), new V3(4.4, 0, 3.9), new V3(0, 0, 6.2), new V3(0, 0, 4.6), new V3(-4.1, 0, 5.95), new V3(4.1, 0, 5.95)];
function navBlocked(a, b, pad) { for (const B of NAV_BOXES) if (segHitsBox(a.x, a.z, b.x, b.z, { x0: B.x0 - pad, x1: B.x1 + pad, z0: B.z0 - pad, z1: B.z1 + pad })) return true; return false; }
function navNext(from, to) {
  if (insideCabin(from.x, from.z) || !navBlocked(from, to, 0.3)) return to;
  const nodes = [from, to, ...NAV_NODES], n = nodes.length, dist = new Array(n).fill(1e9), prev = new Array(n).fill(-1), done = new Array(n).fill(false); dist[0] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1; for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] >= 1e9 || u === 1) break; done[u] = true;
    for (let v = 0; v < n; v++) { if (done[v] || v === u || navBlocked(nodes[u], nodes[v], 0.22)) continue; const d = dist[u] + Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z); if (d < dist[v]) { dist[v] = d; prev[v] = u; } }
  }
  if (prev[1] < 0) return to; let v = 1; while (prev[v] > 0) v = prev[v]; return nodes[v];
}
// melee across a wall only works through an opening
function openingBetween(a, b) {
  if (insideCabin(a.x, a.z) === insideCabin(b.x, b.z)) return true;
  const o = insideCabin(a.x, a.z) ? b : a;
  for (const en of ENTRIES) {
    if (o.distanceTo(en.out) > 1.3) continue;
    if (en.kind === 'door') return entryOpen(en) || door.holes > 0;
    return !en.glass && en.boards.filter(x => x.hp > 0).length <= 1;
  }
  return false;
}
function resetCamp() {
  for (const col of door.segs) for (const s of col) { s.hp = 1; s.cracks = 0; s.broken = false; s.m.visible = true; for (const m of s.marks) s.m.remove(m); s.marks.length = 0; }
  Object.assign(door, { ang: 0, angV: 0, target: 0, barred: false, barHp: 1, barBroken: false, barThrown: false, latch: 1, hinge: [1, 1], sag: 0, shake: 0, shakeV: 0, fallen: false, fall: null, reach: false, crawl: false, holes: 0 });
  door.pivot.add(door.leaf); door.leaf.position.set(0, 0, 0); door.leaf.rotation.set(0, 0, 0); door.leaf.quaternion.identity(); door.col.off = false; barMesh.visible = true; door.cut = !door.cut; setDoorCut(!door.cut);
  winBack.glass = true; glass.visible = true; for (const w of [winBack, winLeft]) { for (const b of w.boards) scene.remove(b.m); w.boards.length = 0; w.torn = 0; }
  WIN_SLOTS.forEach((y, k) => { const b = makeBoard(winLeft, y + 0.12); b.slot = k; if (k === 1) b.hp = 0.55; winLeft.boards.push(b); });
  G.planks = 3;
}
G.planks = 3;
function campStatus() {
  const d = door.fallen || door.fall ? '倒了' : door.ang > 0.6 ? '开着' : door.barred ? '上闩' : '关着', dl = [];
  if (door.holes) dl.push(door.holes + ' 处破洞'); if (door.barred && door.barHp < 0.95) dl.push('门闩 ' + Math.round(door.barHp * 100) + '%'); if (door.barBroken) dl.push('门闩断了'); if (door.sag > 0) dl.push('合页崩了'); else if (door.hinge[0] < 0.7) dl.push('合页松动');
  const w = x => (x.glass ? '玻璃完好' : '玻璃碎了') + ' · 木板 ' + x.boards.filter(b => b.hp > 0).length + '/3';
  return ['正门：' + d + (dl.length ? ' · ' + dl.join(' · ') : ''), '后窗：' + w(winBack), '侧窗：' + w(winLeft), '木板 ×' + G.planks];
}
function updateCamp(dt) { updateDoor(dt); updateWindows(dt); updateDebris(dt); }
