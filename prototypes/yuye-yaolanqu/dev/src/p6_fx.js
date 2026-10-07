/* ===== P6 combat FX: blood, mist, decals, wounds painted on cloth, gibs, mud, impact flashes, swing trail, sound rings ===== */
// blood droplets: fly, fall, stick; some leave a spot on the ground
const BL_N = 420, blGeo = new THREE.BufferGeometry(), blPos = new Float32Array(BL_N * 3), blVel = new Float32Array(BL_N * 3), blLife = new Float32Array(BL_N), blMark = new Uint8Array(BL_N);
blGeo.setAttribute('position', new THREE.BufferAttribute(blPos, 3));
const dropTex = softDisc(32, [[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]);
const bloodPts = new THREE.Points(blGeo, new THREE.PointsMaterial({ color: 0x5a0707, size: 0.07, map: dropTex, transparent: true, opacity: 0.95, depthWrite: false }));
bloodPts.frustumCulled = false; scene.add(bloodPts); let blIdx = 0;
for (let i = 0; i < BL_N; i++) blPos[i * 3 + 1] = -50;
function spawnBlood(p, dir, n, ground, speed = 1, mark = 0.3) {
  for (let k = 0; k < n; k++) {
    const i = blIdx++ % BL_N; blPos[i * 3] = p.x + rnd(-0.04, 0.04); blPos[i * 3 + 1] = p.y + rnd(-0.04, 0.04); blPos[i * 3 + 2] = p.z + rnd(-0.04, 0.04);
    const s = rnd(0.7, 3.2) * speed;
    blVel[i * 3] = dir.x * s + rnd(-0.8, 0.8); blVel[i * 3 + 1] = ground ? rnd(0.3, 1.1) : dir.y * s + rnd(0.2, 2.4); blVel[i * 3 + 2] = dir.z * s + rnd(-0.8, 0.8);
    blLife[i] = rnd(0.8, 1.3); blMark[i] = Math.random() < mark ? 1 : 0;
  }
}
// ground spots and pools
const poolTex = softDisc(64, [[0, 'rgba(40,4,4,.95)'], [0.6, 'rgba(35,4,4,.8)'], [1, 'rgba(30,4,4,0)']]);
const decalMat = new THREE.MeshStandardMaterial({ map: poolTex, transparent: true, roughness: 0.18, metalness: 0.15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const DEC_N = 110, decals = []; let decIdx = 0;
const planeGeo = new THREE.PlaneGeometry(1, 1);
for (let i = 0; i < DEC_N; i++) { const m = new THREE.Mesh(planeGeo, decalMat); m.rotation.x = -Math.PI / 2; m.visible = false; m.receiveShadow = true; scene.add(m); decals.push(m); }
function addDecal(x, z, s) { const m = decals[decIdx++ % DEC_N]; m.position.set(x, groundY(x, z) + 0.008, z); m.rotation.z = rnd(0, 6.28); m.scale.set(s, s * rnd(0.55, 1), 1); m.visible = true; }
const pools = [];
function addBloodPool(p, size = 1.4) { const m = new THREE.Mesh(planeGeo, new THREE.MeshStandardMaterial({ map: poolTex, transparent: true, roughness: 0.12, metalness: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })); m.rotation.x = -Math.PI / 2; m.position.set(p.x, groundY(p.x, p.z) + 0.01, p.z); m.scale.setScalar(0.1); m.userData.grow = size; scene.add(m); pools.push(m); }
// a soft red cloud for heavy hits
const mistTex = softDisc(64, [[0, 'rgba(96,12,12,.6)'], [0.45, 'rgba(70,8,8,.28)'], [1, 'rgba(50,5,5,0)']]);
const mists = []; let mistIdx = 0;
for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); mists.push({ s, t: 1, d: 0.6, v: new V3(), sz: 1 }); }
function spawnMist(p, dir, size) { const m = mists[mistIdx++ % mists.length]; m.s.position.copy(p); m.v.copy(dir).multiplyScalar(1.1).add(new V3(0, 0.25, 0)); m.t = 0; m.d = 0.6; m.sz = size; m.s.visible = true; }
// impact flash + shock ring at the contact point
const flashTex = softDisc(64, [[0, 'rgba(255,248,235,1)'], [0.18, 'rgba(255,226,190,.55)'], [1, 'rgba(255,200,150,0)']]);
const impacts = []; let impIdx = 0;
for (let i = 0; i < 6; i++) {
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  const r = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, color: 0xffe6c8 }));
  f.visible = r.visible = false; scene.add(f); scene.add(r); impacts.push({ f, r, t: 1, p: 1 });
}
function spawnImpact(p, power) { const m = impacts[impIdx++ % impacts.length]; m.f.position.copy(p); m.r.position.copy(p); m.t = 0; m.p = power; m.f.visible = m.r.visible = true; }
// muddy water thrown up by falls, kicks and stomps
const MUD_N = 240, mudGeo = new THREE.BufferGeometry(), mudPos = new Float32Array(MUD_N * 3), mudVel = new Float32Array(MUD_N * 3), mudLife = new Float32Array(MUD_N);
mudGeo.setAttribute('position', new THREE.BufferAttribute(mudPos, 3));
const mudPts = new THREE.Points(mudGeo, new THREE.PointsMaterial({ color: 0x343c44, size: 0.05, map: dropTex, transparent: true, opacity: 0.7, depthWrite: false }));
mudPts.frustumCulled = false; scene.add(mudPts); let mudIdx = 0;
for (let i = 0; i < MUD_N; i++) mudPos[i * 3 + 1] = -50;
function spawnSplash(p, n, spread = 0.4, up = 1.6) {
  for (let k = 0; k < n; k++) {
    const i = mudIdx++ % MUD_N; mudPos[i * 3] = p.x + rnd(-spread, spread); mudPos[i * 3 + 1] = groundY(p.x, p.z) + 0.03; mudPos[i * 3 + 2] = p.z + rnd(-spread, spread);
    mudVel[i * 3] = rnd(-1.3, 1.3); mudVel[i * 3 + 1] = rnd(0.5, 1) * up; mudVel[i * 3 + 2] = rnd(-1.3, 1.3); mudLife[i] = rnd(0.35, 0.75);
  }
}
// sound made visible: a ring on the ground (white for your noise, red for their roars)
const sRings = []; let srIdx = 0;
for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: 0xa8bcd4, fog: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); sRings.push({ m, t: 1, d: 1, r: 1, a: 0.3 }); }
function spawnRing(p, r, kind) { const s = sRings[srIdx++ % sRings.length], roar = kind === 'roar'; s.m.position.set(p.x, groundY(p.x, p.z) + 0.04, p.z); s.t = 0; s.r = r; s.d = roar ? 1.5 : 0.75; s.a = roar ? 0.32 : 0.18; s.m.material.color.setHex(roar ? 0xd25a40 : 0xa8bcd4); s.m.visible = true; }

/* swing trail: a fading ribbon between the weapon head and the shaft */
const TRAIL_N = 14, trailGeo = new THREE.BufferGeometry(), trailPos = new Float32Array(TRAIL_N * 6), trailA = new Float32Array(TRAIL_N * 2);
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('a', new THREE.BufferAttribute(trailA, 1));
{ const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trailMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { color: { value: new THREE.Color(0x8fa2bc) }, k: { value: 0 } },
  vertexShader: 'attribute float a; varying float vA; void main(){ vA=a; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 color; uniform float k; varying float vA; void main(){ gl_FragColor=vec4(color*vA*k,1.0); }'
});
const trail = new THREE.Mesh(trailGeo, trailMat); trail.frustumCulled = false; scene.add(trail);
const trailPts = [], _tip = new V3(), _tbase = new V3();
function weaponObj() { return P.weapon === 'axe' ? P.axe : P.club; }
function updateTrail(dt) {
  const A = P.atk, a = A ? A.t / A.dur : 0, active = A && A.kind !== 'kick' && a > A.strikeA && a < A.hitA + 0.08;
  if (active) {
    const w = weaponObj(); w.updateWorldMatrix(true, false);
    w.localToWorld(_tip.copy(w.userData.tip)); if (P.broken && w === P.club) _tip.copy(w.userData.tip).multiplyScalar(0.55).applyMatrix4(w.matrixWorld);
    w.localToWorld(_tbase.set(0, P.weapon === 'axe' ? -0.5 : -0.48, 0));
    trailPts.unshift([_tip.clone(), _tbase.clone()]); if (trailPts.length > TRAIL_N) trailPts.pop(); trailMat.uniforms.k.value = A.kind === 'heavy' ? 0.42 : 0.3;
  } else { trailMat.uniforms.k.value = Math.max(0, trailMat.uniforms.k.value - dt * 3); if (trailMat.uniforms.k.value <= 0) trailPts.length = 0; }
  const n = trailPts.length;
  for (let i = 0; i < TRAIL_N; i++) {
    const s = trailPts[Math.min(i, n - 1)]; if (!s) break;
    trailPos.set([s[0].x, s[0].y, s[0].z, s[1].x, s[1].y, s[1].z], i * 6);
    trailA[i * 2] = i < n ? Math.pow(1 - i / Math.max(1, n - 1), 1.4) * 0.7 : 0; trailA[i * 2 + 1] = 0;
  }
  trailGeo.setDrawRange(0, Math.max(0, n - 1) * 6); trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.a.needsUpdate = true;
}

/* wounds: blood painted straight onto the clothes and skin, so a body shows every hit it took */
function fleshSpot(mat, region) { const R = mat.userData.flesh.A.meta.regions || {}, list = R[region] || R.torso || [[0.5, 0.5]]; return list[Math.floor(Math.random() * list.length)]; }
function paintWound(mat, n, big, front) {
  const tex = mat && mat.map; if (!tex || !tex.image || !tex.image.getContext) return;
  const c = tex.image, g = c.getContext('2d'), W = c.width, H = c.height, fr = mat.userData && mat.userData.fleshRegion;
  for (let i = 0; i < n; i++) {
    let x = (front ? 0.25 + rnd(-0.09, 0.09) : rnd(0.05, 0.95)) * W, y = (front ? rnd(0.3, 0.75) : rnd(0.12, 0.8)) * H, r = rnd(0.035, big ? 0.12 : 0.065) * Math.min(W, H) * (front ? 0.6 : 1);
    if (fr) { const sp = fleshSpot(mat, fr); x = sp[0] * W; y = sp[1] * H; r = rnd(0.006, big ? 0.02 : 0.012) * W; }
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(62,5,5,.92)'); gr.addColorStop(0.55, 'rgba(70,6,6,.7)'); gr.addColorStop(1, 'rgba(50,4,4,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * rnd(0.6, 1.25), rnd(0, 3), 0, 7); g.fill();
    g.strokeStyle = 'rgba(58,5,5,.6)'; g.lineCap = 'round';
    for (let k = 0; k < (big ? 4 : 2); k++) { const dx = x + rnd(-r, r) * 0.6; g.lineWidth = rnd(0.8, 2.2) * W / 128; g.beginPath(); g.moveTo(dx, y); g.lineTo(dx + rnd(-1.5, 1.5), y + rnd(0.06, 0.22) * H); g.stroke(); }
  }
  tex.needsUpdate = true; atlasRefresh(mat);
}
// a blade wound on cloth: a dark slash, a wet halo, blood running down from it
function paintCut(mat, heavy) {
  const tex = mat && mat.map; if (!tex || !tex.image || !tex.image.getContext) return;
  const c = tex.image, g = c.getContext('2d'), W = c.width, H = c.height, fr = mat.userData && mat.userData.fleshRegion, sp = fr ? fleshSpot(mat, fr) : null;
  const x = (sp ? sp[0] : rnd(0.15, 0.85)) * W, y = (sp ? sp[1] : rnd(0.2, 0.7)) * H, len = (heavy ? rnd(0.3, 0.5) : rnd(0.15, 0.3)) * W * (sp ? 0.12 : 1), a = rnd(-0.6, 0.6);
  g.save(); g.translate(x, y); g.rotate(a); g.lineCap = 'round';
  g.globalAlpha = 0.55; g.strokeStyle = 'rgba(90,8,8,1)'; g.lineWidth = (heavy ? 7 : 4) * W / 128; g.beginPath(); g.moveTo(-len / 2, 1); g.lineTo(len / 2, 1); g.stroke();
  g.globalAlpha = 1; g.strokeStyle = 'rgba(30,2,2,.95)'; g.lineWidth = (heavy ? 2.6 : 1.8) * W / 128; g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, rnd(-1.5, 1.5)); g.stroke();
  g.restore(); g.strokeStyle = 'rgba(60,5,5,.7)'; g.lineCap = 'round';
  for (let i = 0; i < (heavy ? 7 : 4); i++) { const t = rnd(-0.5, 0.5), dx = x + Math.cos(a) * len * t, dy = y + Math.sin(a) * len * t; g.lineWidth = rnd(1, 2.6) * W / 128; g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx + rnd(-1, 1), dy + rnd(0.1, 0.35) * H); g.stroke(); }
  tex.needsUpdate = true; atlasRefresh(mat);
}
function stainWeapon(w, k) { for (const m of w.userData.stain) { if (!m.userData.base) m.userData.base = m.color.clone(); m.userData.blood = Math.min(1, (m.userData.blood || 0) + k); m.color.copy(m.userData.base).lerp(new THREE.Color(0x3a0606), m.userData.blood * 0.75); } }
function rinseWeapons(dt) { for (const w of [P.club, P.axe]) for (const m of w.userData.stain) if (m.userData.blood > 0) { m.userData.blood = Math.max(0, m.userData.blood - dt * 0.006 * G.rain); m.color.copy(m.userData.base).lerp(new THREE.Color(0x3a0606), m.userData.blood * 0.75); } }

/* severed parts: rigid pieces with gravity, bounce and friction; stumps keep pumping for a while */
const gibs = [], stumps = [];
const meatMat = new THREE.MeshStandardMaterial({ color: 0x5a0d0d, roughness: 0.35, metalness: 0.05 });
const boneMat = new THREE.MeshStandardMaterial({ color: 0xd9cfb8, roughness: 0.5 });
function addStump(parent, y, r, dirLocal, owner) {
  const s = new THREE.Group(); s.position.y = y; parent.add(s);
  s.add(mesh(new THREE.SphereGeometry(r, 10, 8), meatMat)); s.children[0].scale.set(1, 0.45, 1);
  const b = mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.32, r * 1.2, 6), boneMat, 0, -r * 0.35, 0); s.add(b);
  const st = { obj: s, t: 0, life: owner ? 999 : rnd(5, 8), next: 0, dir: dirLocal || new V3(0, -1, 0), owner }; stumps.push(st); return st;
}
function detachGib(part, vel, spin, opts = {}) {
  unskin(part); part.updateWorldMatrix(true, true); let obj = part;
  if (opts.center) { obj = new THREE.Group(); obj.position.copy(opts.center); scene.add(obj); obj.updateWorldMatrix(true, false); obj.attach(part); } // tumble about its own middle
  else scene.attach(part);
  const g = { obj, vel: vel.clone(), w: spin.clone(), r: opts.r || 0.06, rest: false, t: 0, bleed: opts.dry ? 0 : (opts.bleed ?? 2.5), roll: !!opts.roll, landed: false, dry: !!opts.dry, thud: opts.thud || 'thud' };
  gibs.push(g); return g;
}
const _gq = new THREE.Quaternion(), _gv = new V3(), _gp = new V3();
function updateGibs(dt) {
  for (const g of gibs) {
    if (g.rest) continue; g.t += dt; const o = g.obj;
    g.vel.y -= 9.8 * dt; o.position.addScaledVector(g.vel, dt);
    const wl = g.w.length(); if (wl > 1e-3) { _gq.setFromAxisAngle(_gv.copy(g.w).divideScalar(wl), wl * dt); o.quaternion.premultiply(_gq); }
    const gy = groundY(o.position.x, o.position.z) + g.r;
    if (o.position.y < gy) {
      o.position.y = gy;
      if (!g.landed || g.vel.y < -1.2) { if (g.thud === 'wood') SND.woodDrop(o.position); else SND.thud(o.position); spawnSplash(o.position, 8, 0.12, 1.1); if (!g.dry) { spawnBlood(o.position, new V3(0, 0.3, 0), 5, true, 0.6, 0.8); if (!g.landed) addDecal(o.position.x, o.position.z, rnd(0.18, 0.3)); } g.landed = true; }
      g.vel.y = Math.abs(g.vel.y) * 0.28; g.vel.x *= 0.62; g.vel.z *= 0.62;
      if (g.roll) g.w.set(g.vel.z / g.r, g.w.y * 0.6, -g.vel.x / g.r); else g.w.multiplyScalar(0.55);
      if (g.vel.lengthSq() < 0.02 && Math.abs(o.position.y - gy) < 0.01) { g.rest = true; if (!g.dry) addDecal(o.position.x, o.position.z, rnd(0.25, 0.4)); }
    }
    for (const c of colliders) if (c.tag === 'post' || c.tag === 'rail' || c.tag === 'wall') if (pushOut(o.position, c, g.r)) { g.vel.x *= -0.4; g.vel.z *= -0.4; }
    if (g.bleed > 0) { g.bleed -= dt; if (Math.random() < dt * 14) spawnBlood(o.position, new V3(0, -0.2, 0), 1, true, 0.3, 0.5); }
  }
}
function updateStumps(dt) {
  for (const s of stumps) {
    if (s.t > s.life || !s.obj.parent) continue; s.t += dt; s.next -= dt;
    let k;
    if (s.owner) { // a wound on a living body pumps with its pressure: strong while the blood lasts, fading as it goes
      const o = s.owner, B = o.body; if (o.dead) { s.deadT = (s.deadT || 0) + dt; if (s.deadT > 3) continue; }
      k = clamp(B.art / 4, 0.2, 1) * clamp(B.blood / 60, 0.05, 1) * (o.dead ? Math.max(0, 1 - s.deadT / 3) : 1); if (k < 0.04) continue;
    } else k = 1 - s.t / s.life;
    if (s.next <= 0) { // arterial pulse
      s.next = 0.42 + (1 - k) * 0.3;
      s.obj.getWorldPosition(_gp); s.obj.getWorldQuaternion(_gq); const d = s.dir.clone().applyQuaternion(_gq);
      spawnBlood(_gp, d, Math.round(3 + 6 * k), false, 0.5 + 1.1 * k, 0.45);
      if (k > 0.4) SND.spurt(_gp, 0.22 * k);
    }
  }
}
function clearGore() {
  for (const g of gibs) if (g.obj.parent) g.obj.parent.remove(g.obj); gibs.length = 0;
  for (const s of stumps) if (s.obj.parent) s.obj.parent.remove(s.obj); stumps.length = 0;
  decals.forEach(m => { m.visible = false; }); pools.forEach(m => scene.remove(m)); pools.length = 0;
  for (let i = 0; i < BL_N; i++) { blLife[i] = 0; blPos[i * 3 + 1] = -50; }
  for (const w of [P.club, P.axe]) for (const m of w.userData.stain) if (m.userData.base) { m.userData.blood = 0; m.color.copy(m.userData.base); }
}

function disposeTree(root) { root.traverse(m => { if (!m.isMesh) return; if (!m.geometry.userData.keep) m.geometry.dispose(); if (m.isSkinnedMesh && m.skeleton && m.skeleton.boneTexture) m.skeleton.dispose(); const mt = m.material; if (mt === meatMat || mt === boneMat || mt === decalMat) return; if (mt.map && !mt.map.userData.keep) mt.map.dispose(); mt.dispose(); }); }
/* hit flash on a body's materials (eyes keep their own glow) */
function collectMats(h) { const s = new Set(); h.root.traverse(m => { if (m.isMesh && m.material && m.material.emissive && m.material.emissive.getHex() === 0) s.add(m.material); }); return (h.mats = [...s]); } // a body that turns realistic later adds its material here
function setFlash(mats, k) { for (const m of mats) m.emissive.setRGB(k * 0.2, k * 0.13, k * 0.1); }

/* blood on the lens: only up close, only for the worst hits */
function lensSplat(n) {
  if (G.camMode !== 'close') return; const box = $('splat');
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'), s = rnd(40, 150);
    d.style.cssText = `left:${rnd(5, 90)}%;top:${rnd(5, 80)}%;width:${s}px;height:${s * rnd(0.7, 1.2)}px;`;
    box.appendChild(d); setTimeout(() => d.classList.add('run'), 30); setTimeout(() => d.remove(), 2600);
  }
}

function updateFX(dt) {
  for (let i = 0; i < BL_N; i++) {
    if (blLife[i] <= 0) continue; blLife[i] -= dt;
    if (blVel[i * 3] || blVel[i * 3 + 1] || blVel[i * 3 + 2]) {
      blVel[i * 3 + 1] -= 9.8 * dt; blPos[i * 3] += blVel[i * 3] * dt; blPos[i * 3 + 1] += blVel[i * 3 + 1] * dt; blPos[i * 3 + 2] += blVel[i * 3 + 2] * dt;
      const gy = groundY(blPos[i * 3], blPos[i * 3 + 2]);
      if (blPos[i * 3 + 1] < gy + 0.01) { blPos[i * 3 + 1] = gy + 0.01; blVel[i * 3] = blVel[i * 3 + 1] = blVel[i * 3 + 2] = 0; if (blMark[i]) { addDecal(blPos[i * 3], blPos[i * 3 + 2], rnd(0.06, 0.16)); blLife[i] = Math.min(blLife[i], 0.05); } }
    }
    if (blLife[i] <= 0) blPos[i * 3 + 1] = -50;
  }
  blGeo.attributes.position.needsUpdate = true;
  for (let i = 0; i < MUD_N; i++) {
    if (mudLife[i] <= 0) continue; mudLife[i] -= dt; mudVel[i * 3 + 1] -= 9.8 * dt;
    mudPos[i * 3] += mudVel[i * 3] * dt; mudPos[i * 3 + 1] += mudVel[i * 3 + 1] * dt; mudPos[i * 3 + 2] += mudVel[i * 3 + 2] * dt;
    if (mudLife[i] <= 0 || mudPos[i * 3 + 1] < GROUND_Y - 0.05) { mudLife[i] = 0; mudPos[i * 3 + 1] = -50; }
  }
  mudGeo.attributes.position.needsUpdate = true;
  for (const m of mists) { if (m.t >= 1) continue; m.t += dt / m.d; const k = Math.min(1, m.t); m.s.position.addScaledVector(m.v, dt); m.v.multiplyScalar(Math.exp(-3 * dt)); m.s.scale.setScalar(m.sz * (0.25 + k * 0.9)); m.s.material.opacity = 0.75 * (1 - k); if (m.t >= 1) m.s.visible = false; }
  for (const m of impacts) { if (m.t >= 1) continue; m.t += dt / 0.16; const k = Math.min(1, m.t); m.f.scale.setScalar(m.p * (0.2 + k * 0.35)); m.f.material.opacity = (1 - k) * 0.55; m.r.scale.setScalar(m.p * (0.15 + k * 0.8)); m.r.material.opacity = (1 - k) * 0.3; if (m.t >= 1) m.f.visible = m.r.visible = false; }
  for (const s of sRings) { if (s.t >= 1) continue; s.t += dt / s.d; const k = Math.min(1, s.t), e = 1 - Math.pow(1 - k, 2.2); s.m.scale.setScalar(Math.max(0.01, s.r * e / 0.41)); s.m.material.opacity = s.a * (1 - k); if (s.t >= 1) s.m.visible = false; }
  for (const m of pools) if (m.userData.grow > 0) { const s = m.scale.x + dt * 0.45; m.scale.setScalar(Math.min(s, m.userData.grow)); if (s >= m.userData.grow) m.userData.grow = 0; }
  updateGibs(dt); updateStumps(dt); updateTrail(dt); rinseWeapons(dt);
}
