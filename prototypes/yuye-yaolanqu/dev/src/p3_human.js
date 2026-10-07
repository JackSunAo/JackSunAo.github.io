/* ===== P3 humans: procedural stylised characters + pose system ===== */
const NEUTRAL = {
  hipLx: 0, hipLz: 0, hipRx: 0, hipRz: 0, knL: 0.04, knR: 0.04, ankL: 0, ankR: 0,
  spX: 0, spY: 0, spZ: 0, chX: 0, chY: 0, headX: 0, headY: 0, headZ: 0,
  shLx: 0, shLy: 0, shLz: 0.08, shRx: 0, shRy: 0, shRz: -0.08, elL: 0.15, elR: 0.15,
  bodyY: 0, bodyX: 0, bodyZ: 0, pelY: 0, pelX: 0, jaw: 0
};
const capsule = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 12), mat);

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
  if (!o.infected) { blob(cx - 30, ey + 30, 18, 12, `rgba(200,90,80,${o.pale ? 0.06 : 0.16})`); blob(cx + 30, ey + 30, 18, 12, `rgba(200,90,80,${o.pale ? 0.06 : 0.16})`); }
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
  else { g.strokeStyle = o.pale ? 'rgba(140,90,95,.75)' : (o.female ? 'rgba(160,70,70,.85)' : 'rgba(120,60,50,.7)'); g.lineWidth = o.female ? 4 : 3; g.lineCap = 'round';
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
    coat: null, apron: false, hood: false, cap: null, scarf: null, skirt: null, backpack: null, collar: null, tie: null, lanyard: false
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
  const hips = add(pelvis, new THREE.Mesh(new THREE.SphereGeometry(0.155 * s, 16, 12), o.skirt ? new THREE.MeshStandardMaterial({ map: toTex(clothCanvas(o.skirt, 0.4, false, o.seed + 9)), roughness: 0.95 }) : botMat), 0, -0.01 * s, 0);
  hips.scale.set(1.05 * g * (o.female ? 1.08 : 1), 0.72, 0.78 * g);
  const legMat = o.skirt ? hips.material : botMat;
  const mkLeg = side => {
    const hip = new THREE.Group(); hip.position.set(side * 0.088 * s * g, -0.03 * s, 0); pelvis.add(hip);
    const tl = 0.43 * s, tr = (o.skirt ? 0.095 : 0.074) * s * sg;
    add(hip, capsule(tr, tl - tr, legMat), 0, -tl / 2, 0);
    const knee = new THREE.Group(); knee.position.y = -tl; hip.add(knee);
    const sl = 0.42 * s, sr = (o.skirt ? 0.085 : 0.057) * s * sg;
    add(knee, capsule(sr, sl - sr, legMat), 0, -sl / 2, 0);
    const ankle = new THREE.Group(); ankle.position.y = -sl; knee.add(ankle);
    const foot = add(ankle, new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.26 * s), shoeMat), 0, -0.015 * s, 0.055 * s);
    return { hip, knee, ankle, foot };
  };
  const L = mkLeg(1), R = mkLeg(-1);

  const spine = new THREE.Group(); spine.position.y = 0.05 * s; pelvis.add(spine);
  const torso = add(spine, capsule(0.15 * s * g, 0.26 * s, coatMat), 0, 0.2 * s, 0);
  torso.scale.set(o.female ? 1.02 : 1.14, 1, 0.76);
  if (g > 1.25) { const belly = add(spine, new THREE.Mesh(new THREE.SphereGeometry(0.17 * s * g, 16, 12), coatMat), 0, 0.11 * s, 0.05 * s * g); belly.scale.set(1, 0.95, 0.9); }
  const chest = new THREE.Group(); chest.position.y = 0.42 * s; spine.add(chest);
  const neck = add(chest, new THREE.Mesh(new THREE.CylinderGeometry(0.046 * s * sg, 0.054 * s * sg, 0.12 * s, 10), skinMat), 0, 0.07 * s, 0);
  if (o.coat) { // coat skirt + collar
    const prof = [[0.16, 0.06], [0.175, -0.04], [0.205, -0.2], [0.225, -0.36]].map(([r, y]) => new THREE.Vector2(r * s * g, y * s));
    const cs = add(pelvis, new THREE.Mesh(new THREE.LatheGeometry(prof, 18), new THREE.MeshStandardMaterial({ map: coatMat.map, roughness: 0.95, side: THREE.DoubleSide })), 0, 0, 0);
    cs.scale.z = 0.82;
    const col = add(chest, new THREE.Mesh(new THREE.TorusGeometry(0.075 * s * sg, 0.03 * s, 8, 16), coatMat), 0, 0.02 * s, 0); col.rotation.x = Math.PI / 2; col.scale.set(1.15, 1, 1);
  }
  if (o.apron) {
    const am = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#c9c2b2', 0.6, true, o.seed + 11)), roughness: 0.9 });
    add(spine, new THREE.Mesh(new THREE.BoxGeometry(0.3 * s * g, 0.42 * s, 0.015), am), 0, 0.16 * s, 0.13 * s * g + 0.02);
    const ap2 = add(pelvis, new THREE.Mesh(new THREE.BoxGeometry(0.34 * s * g, 0.42 * s, 0.015), am), 0, -0.2 * s, 0.14 * s * g); ap2.rotation.x = -0.08;
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

  const head = new THREE.Group(); head.position.y = 0.13 * s; chest.add(head);
  const faceMat = new THREE.MeshStandardMaterial({ map: toTex(faceCanvas(o), true, false), roughness: 0.55 });
  const skull = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.105 * s, 32, 24), faceMat), 0, 0.11 * s, 0);
  skull.scale.set(0.9, 1.1, 1.0);
  const jawM = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.066 * s, 16, 12), skinMat), 0, 0.052 * s, 0.022 * s);
  jawM.scale.set(o.female ? 0.9 : 1.04, 0.8, 0.95);
  [-1, 1].forEach(sx => { const e = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.022 * s, 8, 6), skinMat), sx * 0.093 * s, 0.105 * s, -0.005); e.scale.set(0.5, 1, 0.8); });
  const eyes = [];
  if (o.infected) { const em = new THREE.MeshStandardMaterial({ color: 0xe8e2c8, emissive: 0x8a8460, emissiveIntensity: 0.9 }); [-1, 1].forEach(sx => eyes.push(add(head, new THREE.Mesh(new THREE.SphereGeometry(0.006 * s, 6, 4), em), sx * 0.034 * s, 0.117 * s, 0.098 * s))); } // both eyes glow together: one material
  const nose = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.012 * s, 0.04 * s, 8), faceMat), 0, 0.1 * s, 0.103 * s);
  nose.rotation.x = Math.PI / 2 - 0.35;
  const mouth = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.017 * s, 10, 6), M(o.infected ? '#1a0b0a' : '#4a2a26', 0.7)), 0, 0.066 * s, 0.09 * s);
  mouth.scale.set(1.25, 0.12, 0.35);
  if (o.infected) { const tm = M('#d8cfb4', 0.4); for (let i = 0; i < 4; i++) add(head, new THREE.Mesh(new THREE.BoxGeometry(0.007 * s, 0.009 * s, 0.006 * s), tm), (-0.012 + i * 0.008) * s, 0.071 * s, 0.093 * s); }
  // hair styles
  const cap = (scl = 1.06, theta = 0.56) => {
    const h = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.105 * s * scl, 20, 14, 0, Math.PI * 2, 0, Math.PI * theta), hairMat), 0, 0.115 * s, -0.008);
    h.scale.set(0.92, 1.12, 1.03); h.rotation.x = -0.25; return h;
  };
  if (o.hairStyle === 'short') cap();
  if (o.hairStyle === 'messy') { const h = cap(1.08, 0.6); h.rotation.z = 0.1; for (let i = 0; i < 7; i++) { const t = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.02 * s, 0.07 * s, 5), hairMat), rnd(-0.06, 0.06) * s, 0.2 * s, rnd(-0.07, 0.03) * s); t.rotation.set(rnd(-0.8, 0.4), 0, rnd(-0.8, 0.8)); } }
  if (o.hairStyle === 'bun') {
    const hc = cap(1.07, 0.6); hc.rotation.x = -0.32;
    const bun = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.048 * s, 14, 12), hairMat), 0, 0.165 * s, -0.095 * s); bun.scale.set(1.1, 0.9, 1);
    [-1, 1].forEach(sx => { const fr = add(head, capsule(0.016 * s, 0.085 * s, hairMat), sx * 0.074 * s, 0.1 * s, 0.045 * s); fr.rotation.set(0.15, 0, sx * 0.12); fr.scale.set(1, 1, 0.6); });
    [[0.06, 0.07, 0.07, 0.35], [-0.05, 0.05, 0.075, -0.25]].forEach(([x, y, z, rz]) => { const st = add(head, capsule(0.005 * s, 0.09 * s, hairMat), x * s, y * s, z * s); st.rotation.z = rz; });
  }
  if (o.hairStyle === 'long') { cap(1.07, 0.62); const b = add(head, capsule(0.08 * s, 0.14 * s, hairMat), 0, 0.06 * s, -0.06 * s); b.scale.set(1.25, 1, 0.55); }
  if (o.hairStyle === 'sparse') { const h = cap(1.03, 0.45); h.scale.multiplyScalar(0.98); }
  if (o.cap) { const kc = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.115 * s, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), M(o.cap, 0.95)), 0, 0.125 * s, -0.005); kc.scale.set(0.95, 1.08, 1.05); kc.rotation.x = -0.18;
    const fold = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.02 * s, 6, 18), M(o.cap, 0.95)), 0, 0.14 * s, -0.01); fold.rotation.x = Math.PI / 2 - 0.18; fold.scale.set(0.95, 1.05, 1); }
  if (o.helmet) { // firefighter's helmet: dome, ridge, wide back brim
    const hm = M(o.helmet, 0.55), dome = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.128 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hm), 0, 0.13 * s, -0.01); dome.scale.set(0.95, 1.0, 1.08);
    add(head, new THREE.Mesh(new THREE.BoxGeometry(0.02 * s, 0.03 * s, 0.24 * s), hm), 0, 0.245 * s, -0.01);
    const brim = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.012 * s, 20), hm), 0, 0.12 * s, -0.035 * s); brim.scale.set(0.95, 1, 1.12); brim.rotation.x = -0.12;
  }
  if (o.hood) { const hd = add(chest, new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.045 * s, 8, 16), coatMat), 0, 0.06 * s, -0.06 * s); hd.rotation.x = Math.PI / 2 + 0.5; }

  // arms
  const mkArm = side => {
    const sh = new THREE.Group(); sh.position.set(side * (o.female ? 0.172 : 0.198) * s * g, 0.015 * s, 0); sh.userData.y0 = sh.position.y; chest.add(sh);
    add(sh, new THREE.Mesh(new THREE.SphereGeometry((o.female ? 0.043 : 0.054) * s * sg, 12, 10), coatMat), 0, -0.01 * s, 0);
    const ul = 0.29 * s, ur = (o.female ? 0.042 : 0.052) * s * sg;
    add(sh, capsule(ur, ul - ur, coatMat), 0, -ul / 2, 0);
    const el = new THREE.Group(); el.position.y = -ul; sh.add(el);
    const fl = 0.26 * s, fr = (o.female ? 0.036 : 0.044) * s * sg;
    add(el, capsule(fr, fl - fr, o.sleeves === 'short' ? skinMat : coatMat), 0, -fl / 2, 0);
    const hand = new THREE.Group(); hand.position.y = -fl - 0.01 * s; el.add(hand);
    const hm = add(hand, new THREE.Mesh(new THREE.SphereGeometry(0.044 * s, 12, 10), skinMat), 0, -0.035 * s, 0.005); hm.scale.set(0.75, 1.15, 0.6);
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
// hard: keys driven directly by physics (a falling body), not damped toward a target
function poseTo(h, target, k, dt, hard) {
  for (const key in NEUTRAL) {
    const t = key in target ? target[key] : NEUTRAL[key];
    h.cur[key] = damp(h.cur[key], t, k, dt);
  }
  if (hard) for (const key in hard) h.cur[key] = hard[key];
  applyPose(h);
}
function walkPose(ph, amt, run = 0) {
  const s = Math.sin(ph), c = Math.cos(ph), A = (0.5 + run * 0.25) * amt;
  return {
    hipLx: -s * A, hipRx: s * A,
    knL: Math.max(0, c) * (0.85 + run * 0.6) * amt + 0.06, knR: Math.max(0, -c) * (0.85 + run * 0.6) * amt + 0.06,
    ankL: -Math.max(0, c) * 0.3 * amt, ankR: -Math.max(0, -c) * 0.3 * amt,
    shLx: s * (0.42 + run * 0.35) * amt, shRx: -s * (0.42 + run * 0.35) * amt,
    elL: 0.2 + amt * (0.3 + run * 0.6), elR: 0.2 + amt * (0.3 + run * 0.6),
    spX: 0.05 * amt + run * 0.2, spY: s * 0.09 * amt, bodyY: -Math.abs(c) * 0.035 * amt - run * 0.03, headX: -0.03 * amt - run * 0.12
  };
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
