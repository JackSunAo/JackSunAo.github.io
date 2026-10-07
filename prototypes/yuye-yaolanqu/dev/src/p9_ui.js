/* ===== P9 scene glue: mother, dialogue, camera, environment, HUD, input, reset, main loop ===== */
/* ---------------- mother update ---------------- */
function updateMother(dt) {
  const m = mother, h = m.h; m.t += dt;
  m.lang = damp(m.lang, m.langT, 1.5, dt);
  rock.rotation.x = Math.sin(m.t * 1.12) * 0.06 * (m.hasBaby ? 1 : 0.4);
  const breathe = Math.sin(m.t * 1.55) * 0.022, tremor = m.lang * (Math.sin(m.t * 23) * 0.012 + (Math.random() - 0.5) * 0.014);
  const humming = SND.humGain > 0.01 || G.mode !== 'play';
  m.jaw = m.talking ? 0.2 + Math.abs(Math.sin(m.t * 14)) * 0.4 : (humming ? 0.08 + Math.sin(m.t * 5.2) * 0.05 : 0);
  m.coughT -= dt; if (m.coughT < 0) { m.coughK = 0.6; m.coughT = rnd(12, 22); if (SND.ready) SND.grunt(); }
  m.coughK = Math.max(0, m.coughK - dt * 1.5);
  const ck = Math.sin(m.coughK * 30) * m.coughK;
  const pose = Object.assign({}, m.seat, {
    spX: m.seat.spX + breathe + ck * 0.15, chX: breathe * 0.6, headZ: m.seat.headZ + Math.sin(m.t * 0.4) * 0.05 + tremor,
    headX: m.seat.headX + Math.sin(m.t * 0.7) * 0.03 + ck * 0.2, elR: m.seat.elR + (m.hasBaby ? Math.sin(m.t * 2.3) * 0.1 : 0), jaw: m.jaw
  });
  if (!m.hasBaby) Object.assign(pose, { shLx: -0.3, shLy: -0.5, shLz: 0.05, elL: 0.9, shRx: -0.35, shRy: 0.5, shRz: -0.05, elR: 0.95, headX: 0.35, headY: 0.0, spX: -0.02 });
  if (m.handing > 0) { m.handing -= dt; Object.assign(pose, { shLx: -1.15, shLy: -0.5, elL: 0.9, shRx: -1.1, shRy: 0.5, elR: 0.8, spX: 0.18, headX: 0.25, headY: 0.1 }); if (m.handing <= 0) finishHandover(); }
  poseTo(h, pose, 3.5, dt);
  const bu = m.baby.userData; bu.hand.position.y = 0.055 + Math.sin(G.t * 2.7) * 0.008; bu.head.rotation.y = Math.sin(G.t * 0.8) * 0.15;
  m.cooT -= dt; if (m.cooT < 0) { m.cooT = rnd(10, 18); const bp = new V3(); m.baby.getWorldPosition(bp); if (P.carrying) { SND.babyCry(bp, 0.35); makeNoise(bp, 15, 'baby'); floatLabel('（孩子在哭）', bp.clone().add(new V3(0, 0.5, 0)), 'tough', 1.6); } else if (P.pos.distanceTo(bp) < 7) SND.babyCoo(bp); }
}
function finishHandover() {
  const b = mother.baby; P.h.spine.add(b); b.position.set(0.02, 0.27 * P.h.s, 0.19); b.rotation.set(0.1, Math.PI + 0.15, 0.3);
  mother.hasBaby = false; P.carrying = true; G.babyTaken = true;
  P.h.pelvis.add(P.lantern); P.lantern.position.set(0.19, -0.02, 0.06);
  const bp = new V3(); b.getWorldPosition(bp); SND.babyCry(bp, 0.45);
  showCard('婴儿进入隔离观察', '第 1 天 / 共 3 天。\n她还坐在那张摇椅上，还在哼那首歌。\n她求你做的那件事，你还没有做。', () => setObj('你抱着孩子。院子里还有它们。'));
}

/* ---------------- dialogue ---------------- */
const DLG = {
  start: {
    lines: [['她', '……别过来。外面那几个，听得见。', 0.25], ['她', '他饿了。奶粉三天前就吃完了，米汤，他吐出来了。', 0.3], ['她', '你看见我胳膊上的……那个了吧。第三天了。有些词，我开始……找不到它们了。', 0.5], ['她', '只是奶。我每天都看，没有破，没有血。他是干净的。', 0.55], ['她', '所以……让我……再喂他……一会儿。', 0.62]],
    choices: [['我带他走。他要隔离观察三天。', 'take'], ['我在这儿陪你一会儿。', 'stay'], ['（转身离开）', 'leave']]
  },
  take: { lines: [['她', '三天……好。', 0.68], ['她', '他叫……他叫……', 0.78], ['她', '……想不起来了。', 0.84], ['她', '等我连这首歌……也忘了的时候……你……就……', 0.92]], end: 'take' },
  stay: { lines: [['', '你在她旁边坐下。她一直哼着那首歌，哼到一半停了，又从头开始。', 0.72], ['她', '带……他……走。', 0.86]], choices: [['我带他走。', 'take'], ['（转身离开）', 'leave']] },
  after: { lines: [['她', '……', 0.94], ['', '她没有抬头。歌声断断续续，调子已经不太对了。', 0.96]], end: 'after' }
};
let D = null;
function startDialog(node) {
  G.mode = 'dialog'; D = { node, i: -1, typed: 0, text: '', done: true, choosing: false };
  $('dlg').classList.add('on'); $('prompt').classList.remove('on'); P.vel.set(0, 0, 0); P.atk = null; P.charging = false;
  const mp = new V3(); mother.h.pelvis.getWorldPosition(mp); const ry = rocker.rotation.y, f = new V3(Math.sin(ry), 0, Math.cos(ry)), sd = new V3(f.z, 0, -f.x);
  const spot = mp.clone().addScaledVector(f, 1.05).addScaledVector(sd, -0.9); P.pos.set(spot.x, 0, spot.z); P.yaw = Math.atan2(mp.x - spot.x, mp.z - spot.z);
  nextLine();
}
function nextLine() {
  const N = DLG[D.node]; D.i++;
  if (D.i < N.lines.length) { const [who, text, lang] = N.lines[D.i]; $('dlgName').textContent = who; D.text = text; D.typed = 0; D.done = false; mother.langT = lang; mother.talking = !!who; $('choices').innerHTML = ''; $('dlgText').classList.toggle('narr', !who); $('dlgText').classList.toggle('broken', lang > 0.7); }
  else if (N.choices) showChoices(N.choices);
  else endDialog(N.end);
}
function showChoices(list) {
  D.choosing = true; mother.talking = false; const box = $('choices'); box.innerHTML = '';
  list.forEach(([label, to], i) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<kbd>${i + 1}</kbd>${label}`; b.onclick = e => { e.stopPropagation(); choose(to); }; box.appendChild(b); });
}
function choose(to) { if (!D) return; D.choosing = false; $('choices').innerHTML = ''; if (to === 'leave') { endDialog('leave'); return; } D.node = to; D.i = -1; nextLine(); }
function advanceDialog() { if (!D || D.choosing) return; if (!D.done) { D.typed = D.text.length; return; } nextLine(); }
function endDialog(kind) {
  $('dlg').classList.remove('on'); D = null; mother.talking = false;
  if (kind === 'take') { G.mode = 'cutscene'; mother.handing = 1.5; setObj(''); }
  else if (kind === 'leave') showCard('你离开了', '歌声在你身后又响了一会儿。\n孩子还在她怀里。', () => setObj('你可以再回去。院子里还有它们。'));
  else showCard('她还在哼', '你在门口站了一会儿。\n院子里的灯又闪了一下。', () => setObj('院子里还有它们。'));
}
function showCard(title, text, onClose, sticky) {
  G.mode = 'card'; G.cardT = 0; G.cardOnClose = onClose; G.cardSticky = !!sticky;
  $('cardTitle').textContent = title; $('cardText').textContent = text; $('card').classList.add('on');
}
function closeCard() {
  if (G.mode !== 'card' || G.cardT < 0.9 || G.cardSticky) return;
  $('card').classList.remove('on'); G.mode = 'play'; if (G.cardOnClose) G.cardOnClose();
}


/* ---------------- camera ---------------- */
const cam = { yaw: 0.12, pitch: 0.86, dist: 13, fov: 32, tgt: new V3(0, 1, 6), pos: new V3(0, 14, 24), userDist: 13, combat: 0, focus: new V3(0, 0, 9) };
function updateCamera(dt, rdt) {
  let tgt, pos, fov;
  if (G.mode === 'title') {
    const a = G.t * 0.035 + 0.35; tgt = new V3(0, 1.0, 4); pos = tgt.clone().add(new V3(Math.sin(a) * 15, 6.5, Math.cos(a) * 15)); fov = 34;
  } else if (G.mode === 'dialog' || G.mode === 'cutscene') {
    const mp = new V3(); mother.h.head.getWorldPosition(mp);
    const ry = rocker.rotation.y, f = new V3(Math.sin(ry), 0, Math.cos(ry)), s = new V3(f.z, 0, -f.x);
    pos = mp.clone().addScaledVector(f, 1.9).addScaledVector(s, 0.8).add(new V3(0, 0.22 + Math.sin(G.t * 0.3) * 0.02, 0));
    tgt = mp.clone().add(new V3(0, -0.34, 0)).addScaledVector(s, 0.12); fov = 34;
  } else {
    if (keys.ArrowLeft) cam.yaw += rdt * 1.4; if (keys.ArrowRight) cam.yaw -= rdt * 1.4;
    // in a fight the command view pulls in a little and leans toward the nearest threat
    const CP = CTRL.who.pos; // the camera rides with whoever you're in
    let th = null, td = 7; for (const e of infected) if (!e.dead && (HUNT.includes(e.state) || e.state === 'stumble' || e.state === 'crawl')) { const d = e.pos.distanceTo(CP); if (d < td) { td = d; th = e; } }
    cam.combat = damp(cam.combat, th && G.mode === 'play' ? 1 : 0, 2.2, rdt); if (th) cam.focus.lerp(th.pos, 1 - Math.exp(-4 * rdt));
    if (G.camOv) { tgt = G.camOv.tgt.clone(); pos = G.camOv.pos.clone(); fov = G.camOv.fov || 40; } // a fixed camera, for looking at things up close
    else if (CMD.on) { // command: high over the cabin, leaning toward you, roof off
      tgt = new V3(0, 0.4, 0.9).lerp(CP.clone().setY(0.4), 0.3); const d = CMD.dist, p = 1.16;
      pos = tgt.clone().add(new V3(Math.sin(cam.yaw) * Math.cos(p) * d, Math.sin(p) * d, Math.cos(cam.yaw) * Math.cos(p) * d)); fov = 40;
    } else if (G.camMode === 'close') {
      const r = new V3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
      tgt = CP.clone().add(new V3(0, 1.45, 0)).addScaledVector(r, 0.42);
      const d = 3.3, p = 0.28; pos = tgt.clone().add(new V3(Math.sin(cam.yaw) * Math.cos(p) * d, Math.sin(p) * d, Math.cos(cam.yaw) * Math.cos(p) * d)); fov = 48;
    } else {
      tgt = CP.clone().add(new V3(0, 0.9, 0)).lerp(cam.focus.clone().setY(CP.y + 0.9), 0.25 * cam.combat); const d = cam.userDist * (1 - 0.15 * cam.combat), p = cam.pitch;
      pos = tgt.clone().add(new V3(Math.sin(cam.yaw) * Math.cos(p) * d, Math.sin(p) * d, Math.cos(cam.yaw) * Math.cos(p) * d)); fov = 32;
    }
    if (G.mode === 'opening') { const k = smooth(0, 7.5, G.openingT); pos.lerp(tgt.clone().add(new V3(0, 22, 18)), 1 - k); }
  }
  const k = G.mode === 'dialog' ? 2.6 : 7;
  cam.pos.x = damp(cam.pos.x, pos.x, k, rdt); cam.pos.y = damp(cam.pos.y, pos.y, k, rdt); cam.pos.z = damp(cam.pos.z, pos.z, k, rdt);
  cam.tgt.x = damp(cam.tgt.x, tgt.x, k * 1.3, rdt); cam.tgt.y = damp(cam.tgt.y, tgt.y, k * 1.3, rdt); cam.tgt.z = damp(cam.tgt.z, tgt.z, k * 1.3, rdt);
  cam.fov = damp(cam.fov, fov, 4, rdt);
  camera.position.copy(cam.pos).add(G.camKick); G.camKick.multiplyScalar(Math.exp(-14 * rdt));
  if (G.shake > 0.001) { camera.position.x += (Math.random() - 0.5) * G.shake * 0.35; camera.position.y += (Math.random() - 0.5) * G.shake * 0.35; G.shake = Math.max(0, G.shake - rdt * 1.6); }
  camera.fov = cam.fov + G.fovPunch; G.fovPunch = damp(G.fovPunch, 0, 8, rdt); camera.updateProjectionMatrix(); camera.lookAt(cam.tgt);
}
function updateWalls() {
  const c = camera.position, inside = (CTRL.who.indoor && G.mode !== 'title') || G.mode === 'dialog' || G.mode === 'cutscene' || CMD.on || (G.camOv && G.camOv.cut);
  const set = (ws, cut) => { if (ws.isCut !== cut) { ws.isCut = cut; ws.full.visible = !cut; ws.cut.visible = cut; } };
  set(wFront, inside && c.z > 3.25); set(wBack, inside && c.z < -3.25); set(wLeft, inside && c.x < -3.75); set(wRight, inside && c.x > 3.75);
  setDoorCut(wFront.isCut);
  roofG.visible = !inside;
  const CP = CTRL.who.pos, onPorch = CP.z > 3.0 && CP.z < 5.7 && Math.abs(CP.x) < 3.8 && G.mode !== 'title';
  porchRoof.visible = !inside && !(onPorch && G.camMode === 'command') && !CMD.on;
}


/* ---------------- environment update ---------------- */
const floodPosV = new V3(), floodDirV = new V3(), lanternW = new V3();
function updateEnvironment(dt) {
  const t = G.t;
  // flood light schedule
  const F = G.flood; F.t += dt;
  if (F.state === 'on' && G.mode !== 'title' && G.mode !== 'opening' && t > F.next) { F.state = 'flicker'; F.t = 0; toast('泛光灯在闪……', 2.5); }
  let lvl = 1;
  if (F.state === 'flicker') { lvl = Math.sin(F.t * 47) > 0.2 ? 0.25 + Math.random() * 0.6 : 0.05; if (F.t > 1.3) { F.state = 'off'; F.t = 0; toast('灯灭了。', 2); onBlackout(); } }
  else if (F.state === 'off') { lvl = 0.0; if (F.t > 4.8) { F.state = 'restore'; F.t = 0; } }
  else if (F.state === 'restore') { lvl = Math.sin(F.t * 39) > 0 ? 0.9 : 0.1; if (F.t > 0.7) { F.state = 'on'; F.t = 0; F.next = t + rnd(38, 60); toast('灯亮了。', 1.6); } }
  floodLight.intensity = 3.2 * lvl; lensMat.emissiveIntensity = 5 * lvl + 0.2; beamMat.uniforms.intensity.value = 0.17 * lvl; beamMat.uniforms.time.value = t; beam.visible = lvl > 0;
  if (SND.ready) SND.buzz.gain.setTargetAtTime(F.state === 'on' ? 0.012 : (F.state === 'off' ? 0 : 0.05 * Math.random()), SND.ctx.currentTime, 0.03);
  // lightning
  const Lg = G.lightning;
  if (G.rain > 0.9 && t > Lg.next && G.mode !== 'title') { Lg.t = 0; Lg.power = rnd(0.6, 1.2); Lg.next = t + rnd(16, 34); SND.thunder(rnd(0.5, 2.2), Lg.power); }
  let fl = 0;
  if (Lg.t >= 0) { Lg.t += dt; const a = Lg.t; fl = a < 0.06 ? 1 : a < 0.13 ? 0.1 : a < 0.45 ? 1.3 * (1 - (a - 0.13) / 0.32) : 0; fl *= Lg.power; if (a > 0.5) Lg.t = -1; }
  flashLight.intensity = fl * 2.2; gradePass.uniforms.flash.value = fl * 0.12;
  // candle & stove flicker
  const n = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 3.3) * 0.2;
  candleLight.intensity = 1.1 + n * 0.12; flame.scale.set(1, 2.4 + n * 0.25, 1); flame.position.x = -0.42 + Math.sin(t * 7) * 0.002; candleGlow.material.opacity = 0.7 + n * 0.08;
  stoveLight.intensity = 0.5 + Math.sin(t * 5.3) * 0.06 + Math.sin(t * 13) * 0.04;
  const n2 = Math.sin(t * 8.3 + 1) * 0.5 + Math.sin(t * 19.1) * 0.3; stoolLight.intensity = 0.72 + n2 * 0.1; flame2.scale.set(1, 2.3 + n2 * 0.25, 1); glow2.material.opacity = 0.62 + n2 * 0.08;
  mobile.rotation.y += dt * 0.15;
  // window streaks
  for (const s of streaks) { s.position.y -= s.userData.v * dt * (0.3 + G.rain); if (s.position.y < -0.5) { s.position.y = 0.5; s.position.x = rnd(-0.56, 0.56); } s.visible = G.rain > 0.1; }
  // roof leak drip
  if (drip.userData.wait > 0) { drip.userData.wait -= dt; drip.visible = false; }
  else { drip.visible = true; drip.userData.v += 9.8 * dt; drip.position.y -= drip.userData.v * dt; if (drip.position.y < 0.19) { drip.position.y = 2.6; drip.userData.v = 0; drip.userData.wait = rnd(0.5, 1.4); ripple.userData.t = 0; SND.drip(drip.position); } }
  if (ripple.userData.t !== undefined) { ripple.userData.t += dt; const k = ripple.userData.t / 0.7; ripple.scale.setScalar(0.04 + k * 0.26); ripple.material.opacity = Math.max(0, 0.7 * (1 - k)); }
  // dust in moonbeam
  for (let i = 0; i < dustN; i++) {
    const [u, x, y, s] = dustSeed[i]; const along = ((u + t * 0.01 * s) % 1) * mbLen;
    const p = new V3(x + Math.sin(t * 0.3 * s + i) * 0.05, y + Math.sin(t * 0.21 * s + i * 2) * 0.05, along).applyQuaternion(moonBeam.quaternion).add(moonBeam.position);
    dustPos[i * 3] = p.x; dustPos[i * 3 + 1] = p.y; dustPos[i * 3 + 2] = p.z;
  }
  dustGeo.attributes.position.needsUpdate = true;
  // sheets in the wind
  if (PERF.frame % QUAL.cloth === 0) for (const m of sheets) {
    const pa = m.geometry.attributes.position, b = m.userData.base, ph = m.userData.ph;
    for (let i = 0; i < pa.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1], depth = -y;
      pa.setZ(i, b[i * 3 + 2] + (Math.sin(x * 4 + t * 2.6 + ph) * 0.06 + Math.sin(t * 1.3 + ph) * 0.16 + Math.sin(x * 9 + t * 6.1) * 0.015) * depth * (0.4 + G.rain * 0.6));
      pa.setX(i, x + Math.sin(t * 2 + y * 3 + ph) * 0.02 * depth);
    }
    pa.needsUpdate = true; m.geometry.computeVertexNormals();
  }
  // fog & clouds drift
  fogLayers.forEach((m, i) => { m.material.map.offset.x = t * 0.004 * (i + 1); m.material.map.offset.y = t * 0.002; });
  cloudTex.offset.x = t * 0.003;
  // rain
  const active = Math.floor(RAIN_N * G.rain * QUAL.rain); rainGeo.setDrawRange(0, active * 2);
  rainCenter.lerp(new V3(cam.tgt.x, 0, cam.tgt.z), 0.05);
  floodPosV.copy(floodLight.position); floodDirV.copy(floodTarget.position).sub(floodPosV).normalize();
  const cosF = Math.cos(FLOOD_ANGLE), fOn = floodLevel(); P.lantern.userData.body.getWorldPosition(lanternW);
  const tOn = P.torchOn; let tPos, tDir; if (tOn) { tPos = new V3(); P.torch.getWorldPosition(tPos); tDir = new V3(Math.sin(P.yaw), -0.17, Math.cos(P.yaw)).normalize(); }
  const wind = 1.6;
  for (let i = 0; i < active; i++) {
    const o = i * 6; let x = rainPos[o], y = rainPos[o + 1], z = rainPos[o + 2];
    y -= rainV[i] * dt; x += wind * dt;
    if (y < GROUND_Y || (y < 3.3 && x > -3.9 && x < 3.9 && z > -3.4 && z < 5.6)) {
      if (y < GROUND_Y + 0.1 && Math.random() < 0.18) { const si = splIdx++ % SPL_N; splPos[si * 3] = x; splPos[si * 3 + 1] = GROUND_Y + 0.02; splPos[si * 3 + 2] = z; splLife[si] = 0.22; }
      spawnDrop(i, false); continue;
    }
    rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z;
    rainPos[o + 3] = x - wind * 0.018; rainPos[o + 4] = y + 0.34; rainPos[o + 5] = z;
    // lighting of each drop
    let r = 0.13, g = 0.16, bl = 0.22;
    if (fOn > 0.05) { const dx = x - floodPosV.x, dy = y - floodPosV.y, dz = z - floodPosV.z, dl = Math.sqrt(dx * dx + dy * dy + dz * dz); if (dl < 16) { const c = (dx * floodDirV.x + dy * floodDirV.y + dz * floodDirV.z) / dl; if (c > cosF) { const k = smooth(cosF, cosF + 0.06, c) * fOn * (1 - dl / 16) * 1.6; r += 0.7 * k; g += 0.78 * k; bl += 0.9 * k; } } }
    const lx = x - lanternW.x, ly = y - lanternW.y, lz = z - lanternW.z, ld = lx * lx + ly * ly + lz * lz; if (ld < 9) { const k = (1 - ld / 9) * 0.8; r += 0.9 * k; g += 0.6 * k; bl += 0.3 * k; }
    if (tOn) { const dx = x - tPos.x, dy = y - tPos.y, dz = z - tPos.z, dl = Math.sqrt(dx * dx + dy * dy + dz * dz); if (dl < 12) { const c = (dx * tDir.x + dy * tDir.y + dz * tDir.z) / dl; if (c > 0.94) { const k = (1 - dl / 12) * 1.4; r += 0.7 * k; g += 0.8 * k; bl += 0.95 * k; } } }
    if (fl > 0) { r += fl * 0.5; g += fl * 0.55; bl += fl * 0.7; }
    rainCol[o] = r * 0.4; rainCol[o + 1] = g * 0.4; rainCol[o + 2] = bl * 0.4; rainCol[o + 3] = r; rainCol[o + 4] = g; rainCol[o + 5] = bl;
  }
  rainGeo.attributes.position.needsUpdate = true; rainGeo.attributes.color.needsUpdate = true;
  for (let i = 0; i < SPL_N; i++) { if (splLife[i] > 0) { splLife[i] -= dt; const k = Math.max(0, splLife[i] / 0.22); splCol[i * 3] = 0.5 * k; splCol[i * 3 + 1] = 0.55 * k; splCol[i * 3 + 2] = 0.65 * k; splPos[i * 3 + 1] += dt * 0.3; } else { splCol[i * 3] = splCol[i * 3 + 1] = splCol[i * 3 + 2] = 0; } }
  splGeo.attributes.position.needsUpdate = true; splGeo.attributes.color.needsUpdate = true;
  for (const m of ripplePool) {
    m.userData.t += dt * (0.8 + G.rain * 1.2);
    if (m.userData.t > 1) { m.userData.t = 0; const pd = puddles[Math.floor(Math.random() * puddles.length)]; const a = rnd(0, 6.28), rr = Math.sqrt(Math.random()) * 0.8; m.position.set(pd.x + Math.cos(a) * pd.a * rr, GROUND_Y + 0.012, pd.z + Math.sin(a) * pd.b * rr); }
    const k = m.userData.t; m.scale.setScalar(0.04 + k * 0.32); m.material.opacity = (1 - k) * 0.55 * Math.min(1, G.rain * 1.5);
  }
}
// when the light dies the leader calls everyone in
function onBlackout() { const L = SQUAD.leader; if (L && !L.dead && L.standing && !P.indoor && G.mode === 'play') roar(L, 'rally'); }

/* ---------------- HUD ---------------- */
function updateHUD(dt) {
  const C = CTRL.who, inP = C === P, fd = inP ? fatigue() : C.fatigue();
  if (!inP) { // driving one of your people: their stamina, nerve, blood and weapon
    $('barSta').style.width = clamp(C.stamina, 0, 100).toFixed(0) + '%'; $('barFat').style.width = '0%'; $('barAdr').style.width = (clamp(C.morale, 0, 1) * 100).toFixed(0) + '%';
    $('barBat').style.width = clamp(C.blood, 0, 100).toFixed(0) + '%'; $('barDur').style.width = '100%';
    if ($('labAdr').textContent !== '士气') { $('labAdr').textContent = '士气'; $('labBat').textContent = '血'; $('barAdr').style.background = 'var(--ember)'; $('barBat').style.background = 'var(--blood)'; }
    if ($('durLabel').textContent !== C.D.role) $('durLabel').textContent = C.D.role;
    const cs = C.status() || (fd > 0.72 ? '力竭 · 动作变形' : fd > 0.25 ? '疲惫' : C.morale < 0.35 ? '手在抖' : ''); if ($('staState').textContent !== cs) $('staState').textContent = cs;
    const sl = '附身：' + C.name + (C.panic ? ' · 崩溃' : ''); if ($('stealth').textContent !== sl) $('stealth').textContent = sl;
    $('bars').classList.toggle('spent', fd > 0.72); $('adrRow').classList.toggle('hot', C.morale < 0.3);
  } else {
  if ($('labAdr').textContent !== '肾上腺素') { $('labAdr').textContent = '肾上腺素'; $('labBat').textContent = '强光手电'; $('barAdr').style.background = ''; $('barBat').style.background = ''; }
  $('barSta').style.width = clamp(P.stamina, 0, 100).toFixed(0) + '%';
  $('barFat').style.width = (100 - effMax()).toFixed(0) + '%';
  $('barAdr').style.width = (P.adr * 100).toFixed(0) + '%';
  const st = P.dead ? '' : P.wounds ? '重伤 · 流血' : P.winded ? '喘不过气' : fd > 0.72 ? '力竭 · 动作变形' : fd > 0.25 ? '疲惫' : P.crash > 0 ? '手在抖' : P.staMax < 85 ? '体力上限下降' : '';
  if ($('staState').textContent !== st) $('staState').textContent = st;
  $('bars').classList.toggle('spent', fd > 0.72); $('adrRow').classList.toggle('hot', P.adr > 0.55);
  $('barBat').style.width = P.battery.toFixed(0) + '%';
  const axe = P.weapon === 'axe';
  $('barDur').style.width = (axe ? 100 : P.durability / 60 * 100).toFixed(0) + '%';
  const wl = axe ? '消防斧' : (P.broken ? '球棍（断了）' : '钉头球棍 · 耐久'); if ($('durLabel').textContent !== wl) $('durLabel').textContent = wl;
  const sl = (P.crouch ? '潜行' : '') + (P.shutter ? (P.crouch ? ' · ' : '') + '提灯遮住' : ''); if ($('stealth').textContent !== sl) $('stealth').textContent = sl;
  }
  if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) $('toast').classList.remove('on'); }
  const showCamp = G.mode === 'play' && (P.indoor || SIEGE.on || door.holes || !winBack.glass || winLeft.boards.length < 3);
  const ct = showCamp ? campStatus().join('\n') : ''; if ($('camp').textContent !== ct) $('camp').textContent = ct;
  // prompt
  let pr = '';
  if (G.mode === 'play' && !P.dead && !inP) pr = C.ctrlPrompt();
  else if (G.mode === 'play' && !P.dead) {
    const it = interactTarget(), td = takedownTarget();
    if (td) pr = td.kind === 'finish' ? 'E　补刀' : 'E　背后刺杀';
    else if (it) pr = it.k === 'mother' ? (mother.hasBaby ? 'E　靠近她' : 'E　坐到她身边') : it.k === 'door' ? (door.barred ? 'B　拿下门闩' : door.ang > 0.3 ? 'E　关门' : 'E　开门' + (P.indoor && !door.barBroken ? '　　B　上门闩' : '')) : 'E　钉木板（剩 ' + G.planks + ' 块）';
    if (P.state === 'pinned' && P.pinnedBy && P.pinnedBy.crawler) pr = 'Q　蹬它的脸';
    else if (!pr && !P.atk) { const st = stompTarget(); if (st) pr = 'Q　' + ({ head: '踩头', arm: '踩断它的手臂', leg: '踩断它的腿', torso: '踩下去' })[st.part]; }
  }
  const pe = $('prompt'); if (pr) { pe.textContent = pr; pe.classList.add('on'); } else pe.classList.remove('on');
  // floating labels
  for (let i = labels.length - 1; i >= 0; i--) {
    const L = labels[i]; L.t += dt; const p = project(L.pos.clone().add(new V3(0, L.t * 0.5, 0)));
    L.el.style.transform = `translate(${p.x.toFixed(0)}px,${p.y.toFixed(0)}px) translate(-50%,-50%)`; L.el.style.opacity = (p.vis ? Math.max(0, Math.min(1, (L.dur - L.t) / 0.35)) : 0).toFixed(2);
    if (L.t > L.dur) { L.el.remove(); labels.splice(i, 1); }
  }
  // enemy readouts: awareness icon (？ investigating, ！ spotted / attacking), health + balance once you're fighting it
  const W = innerWidth, H = innerHeight, play = G.mode === 'play';
  for (const e of infected) {
    const dP = e.pos.distanceTo(C.pos), hunting = HUNT.includes(e.state) || e.state === 'stumble' || e.state === 'crawl';
    let icon = '', alert = false;
    if (!e.dead && play) {
      if (e.state === 'windup' || e.state === 'lunge' || e.spotFlash > 0) { icon = '！'; alert = true; }
      else if (e.state === 'investigate' || e.state === 'search' || ((e.state === 'lurk' || e.state === 'porch') && e.aware > 0.3)) icon = '？';
    }
    const bars = !e.dead && play && (e.barT > 0 || (hunting && dP < 6));
    const show = icon || bars;
    e.bar.style.opacity = show ? '1' : '0'; e.bar.classList.toggle('iconOnly', !bars);
    if (show) {
      const p = project(e.headPos().add(new V3(0, 0.15, 0)));
      e.bar.style.transform = `translate(${p.x.toFixed(0)}px,${p.y.toFixed(0)}px) translate(-50%,-100%)`;
      if (e.icon.textContent !== icon) e.icon.textContent = icon; e.icon.classList.toggle('alert', alert); e.icon.style.opacity = icon === '？' ? (0.45 + 0.55 * clamp(e.aware, 0, 1)).toFixed(2) : '1';
      e.barBlood.style.width = clamp(e.body.blood, 0, 100).toFixed(0) + '%'; const cd = e.condition(); if (e.statEl.textContent !== cd) e.statEl.textContent = cd; e.barBal.style.width = (clamp(e.bal, 0, 1) * 100).toFixed(0) + '%';
      const ds = e.dollState(), key = JSON.stringify(ds);
      if (key !== e.dollKey) { e.dollKey = key; for (const k in e.doll) e.doll[k].setAttribute('class', 'd-' + k + ' ' + (ds[k] || '') + (k === 'head' && ds.jaw ? ' nojaw' : '')); }
      const nm = e.T.name + (e === SQUAD.leader && infected.filter(o => !o.dead).length > 1 ? ' · 头领' : ''); if (e.shownName !== nm) { e.shownName = nm; e.nameEl.textContent = nm; }
    }
    // off-screen danger: an arrow on the screen edge toward anything closing in on you
    const danger = !e.dead && play && (e.state === 'windup' || e.state === 'lunge' || (hunting && dP < 4.5));
    let arrowOn = false;
    if (danger) {
      const v = e.pos.clone().add(new V3(0, 1.1, 0)).project(camera); let x = v.x, y = v.y; if (v.z > 1) { x = -x; y = -y; }
      if (v.z > 1 || Math.abs(x) > 0.92 || Math.abs(y) > 0.88) {
        const a = Math.atan2(y, x), m = Math.max(Math.abs(Math.cos(a)) / 0.9, Math.abs(Math.sin(a)) / 0.84), ex = Math.cos(a) / m, ey = Math.sin(a) / m;
        e.arrow.style.transform = `translate(${((ex * 0.5 + 0.5) * W).toFixed(0)}px,${((-ey * 0.5 + 0.5) * H).toFixed(0)}px) translate(-50%,-50%) rotate(${(-a).toFixed(3)}rad)`;
        e.arrow.classList.toggle('hot', e.state === 'windup' || e.state === 'lunge'); arrowOn = true;
      }
    }
    e.arrow.style.opacity = arrowOn ? '1' : '0';
  }
  updateSquadHUD(); updateCommandView(dt);
  const fear = inP ? P.adr : clamp(1 - C.morale, 0, 1), pulse = fear > 0.3 ? Math.max(0, Math.sin(G.t * (6 + fear * 6))) * 0.08 * fear : 0;
  gradePass.uniforms.hurt.value = damp(gradePass.uniforms.hurt.value, C.state === 'pinned' ? 0.6 + Math.sin(G.t * 8) * 0.15 : (P.dead ? 0.8 : (C.state === 'stagger' || C.state === 'down' ? 0.35 : 0)), 6, dt);
  // the clinch and pinned overlays belong to whoever you're in
  $('qte').classList.toggle('on', G.mode === 'play' && C.state === 'pinned' && !C.dead); $('clinch').classList.toggle('on', G.mode === 'play' && C.state === 'clinch' && !C.dead);
  if (!inP && C.state === 'pinned') $('qteBar').style.width = (C.struggle * 100).toFixed(0) + '%';
  if (!inP && C.state === 'clinch') { $('clinchBar').style.width = Math.min(100, C.clinchProg / C.clinchNeed * 100).toFixed(0) + '%'; $('clinchTime').style.width = Math.max(0, 100 - C.st / C.clinchMax * 100).toFixed(0) + '%'; }
  gradePass.uniforms.desat.value = damp(gradePass.uniforms.desat.value, P.dead ? 0.9 : (G.mode === 'dialog' ? 0.25 : fd * 0.3 + (!inP && C.morale < 0.3 ? 0.25 : 0)), 3, dt);
  gradePass.uniforms.bars.value = damp(gradePass.uniforms.bars.value, (G.mode === 'dialog' || G.mode === 'cutscene') ? 1 : 0, 4, dt);
  gradePass.uniforms.vig.value = damp(gradePass.uniforms.vig.value, G.mode === 'dialog' ? 0.85 : 0.55 + (inP ? 0.15 * P.adr : 0.35 * fear) + pulse, 3, dt);
}

/* ---------------- audio sync ---------------- */
function updateAudioMix(dt) {
  if (!SND.ready) return;
  const C = CTRL.who, L = SND.listener; L.pos.copy(C.pos); L.right.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)); L.indoor = C.indoor;
  SND.rainLevel = G.rain;
  const mp = new V3(); mother.h.head.getWorldPosition(mp); const d = C.pos.distanceTo(mp);
  let hum = 0.55 / (1 + d * d / 5); if (!C.indoor) hum *= 0.35; if (G.mode === 'dialog' || G.mode === 'cutscene') hum = mother.talking ? 0.12 : 0.5;
  if (G.mode === 'title') hum = 0;
  SND.humGain = hum; SND.humDegrade = mother.lang;
  let tens = 0;
  for (const e of infected) { if (e.dead) continue; const de = e.pos.distanceTo(C.pos); if (HUNT.includes(e.state) || ['crawl', 'siege', 'work', 'scout', 'climb', 'enter'].includes(e.state)) tens = Math.max(tens, de < 12 ? 1 : 0.5); else if (e.state === 'investigate' || e.state === 'search') tens = Math.max(tens, 0.55); else if (de < 8 && !C.indoor) tens = Math.max(tens, 0.35); }
  if (floodOff() && G.mode === 'play') tens = Math.max(tens, 0.7);
  G.tension = damp(G.tension, G.mode === 'play' ? tens : 0, 1.5, dt); SND.tension = G.tension;
  const play = G.mode === 'play' && !P.dead;
  SND.exertion = !play ? 0 : C === P ? Math.max(fatigue(), clamp((60 - P.stamina) / 60, 0, 1) * 0.6, P.state === 'pinned' ? 0.9 : 0) : Math.max(C.fatigue(), clamp((60 - C.stamina) / 60, 0, 1) * 0.6, C.state === 'pinned' ? 0.9 : 0);
  SND.adr = !play ? 0 : C === P ? P.adr : clamp(1 - C.morale, 0, 1) * 0.8;
  SND.update(dt);
}

/* ---------------- input ---------------- */
addEventListener('keydown', e => {
  if (['Tab', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (G.mode === 'title') return;
  if (G.mode === 'opening') { if (e.code === 'Space' || e.code === 'Enter') skipOpening(); return; }
  if (G.mode === 'card') { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') closeCard(); if (e.code === 'KeyR') resetGame(); return; }
  if (G.mode === 'dialog') {
    if (D && D.choosing && /^Digit[1-3]$/.test(e.code)) { const b = $('choices').children[+e.code.slice(5) - 1]; if (b) b.click(); }
    else if (['Space', 'Enter', 'KeyE'].includes(e.code)) advanceDialog();
    return;
  }
  if (e.code === 'KeyR') { resetGame(); return; }
  if (e.code === 'Tab') { G.camMode = G.camMode === 'command' ? 'close' : 'command'; toast(G.camMode === 'close' ? '近景镜头' : '指挥镜头', 1.2); }
  if (e.code === 'KeyT') { G.rain = G.rain > 0.9 ? 0.4 : G.rain > 0.1 ? 0 : 1; $('wx').textContent = G.rain > 0.9 ? '暴雨' : G.rain > 0.1 ? '小雨' : '雨停了'; toast('天气：' + $('wx').textContent, 1.5); }
  if (e.code === 'KeyG') cycleQuality();
  if (e.code === 'Backquote') { PERF.show = !PERF.show; toast(PERF.show ? '帧数显示：开（再按 ` 关）' : '帧数显示：关', 1.4); }
  if (e.code === 'KeyM') { G.muted = !G.muted; SND.setMuted(G.muted); toast(G.muted ? '已静音' : '声音已打开', 1.2); }
  if (e.code === 'KeyH') $('help').classList.toggle('off');
  if (e.code === 'KeyL' && G.flood.state === 'on') { G.flood.next = G.t; }
  if (G.mode !== 'play') return;
  // your people: Z command view · Y U I O P orders (to the selection in command view, to everyone otherwise) · 1–3 pick one, 4 all
  if (e.code === 'KeyN') { if (CMD.on) { const sel = [...CMD.sel].filter(d => !d.dead); if (sel.length === 1 || (sel.length && sel[0] !== CTRL.who)) { if (possess(sel.find(d => d !== CTRL.who) || sel[0])) setCommand(false, true); return; } } possessNext(); return; }
  if (e.code === 'KeyZ') { setCommand(!CMD.on); return; }
  const ORD = { KeyY: 'hold', KeyU: 'fallback', KeyI: 'plug', KeyO: 'sally', KeyP: 'focus' };
  if (ORD[e.code]) { orderDefenders(ORD[e.code], CMD.on ? selected() : null); return; }
  if (CMD.on) { if (/^Digit[1-3]$/.test(e.code)) { const d = defenders[+e.code.slice(5) - 1]; if (d) cmdSelect(d, e.shiftKey); } else if (e.code === 'Digit4') cmdSelectAll(); else if (e.code === 'Escape') setCommand(false); return; }
  if (CTRL.who !== P) { ctrlKey(e.code); return; }
  if (P.state === 'clinch') { if (e.code === 'Space') clinchAct('shove'); else if (e.code === 'KeyQ') clinchAct('knee'); else if (e.code === 'KeyJ' || e.code === 'KeyK') clinchAct('butt'); return; }
  if (e.code === 'Space') { if (P.state === 'pinned') { const pe = P.pinnedBy; P.struggle += 0.12 * (1 + 0.8 * P.adr) * (P.stamina > 4 ? 1 : 0.7) * (pe && pe.arms < 2 ? 1.4 : 1); SND.grunt(); P.stamina = Math.max(0, P.stamina - 2); springKick(P.h, 'spZ', rnd(-3, 3)); } else dodge(); }
  if (e.code === 'KeyF') toggleTorch();
  if (e.code === 'KeyJ') startAttack('quick');
  if (e.code === 'KeyK') startAttack('heavy');
  if (e.code === 'KeyQ') { if (P.state === 'pinned' && P.pinnedBy && P.pinnedBy.crawler) kickFace(P.pinnedBy); else startAttack('kick'); }
  if (e.code === 'KeyC') { P.crouch = !P.crouch; toast(P.crouch ? '潜行：脚步几乎无声，更难被看见' : '站起来', 1.4); }
  if (e.code === 'KeyV') { P.shutter = !P.shutter; SND.click(); toast(P.shutter ? '遮住提灯：它们更难看见你，你也看不清' : '打开提灯', 1.6); }
  if (e.code === 'KeyX') whistle();
  if (e.code === 'Digit1') switchWeapon('club');
  if (e.code === 'Digit2') switchWeapon('axe');
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyB') toggleBar();
});
// when you're in one of your people: the same keys, their weapon
function ctrlKey(code) {
  const d = CTRL.who; if (d.dead) return;
  if (d.state === 'clinch') { if (code === 'Space') d.ctrlClinch('shove'); else if (code === 'KeyQ') d.ctrlClinch('knee'); else if (code === 'KeyJ' || code === 'KeyK') d.ctrlClinch('butt'); return; }
  if (d.state === 'pinned') { if (code === 'Space') d.ctrlMash(); return; }
  if (code === 'Space') d.ctrlDodge();
  else if (code === 'KeyJ') d.ctrlAttack('quick');
  else if (code === 'KeyK') d.ctrlAttack('heavy');
  else if (code === 'KeyQ') d.ctrlAttack('alt');
  else if (code === 'KeyE') d.ctrlUse();
  else if (code === 'KeyB') d.ctrlBar();
  else if (['KeyF', 'KeyV', 'KeyX', 'KeyC', 'Digit1', 'Digit2'].includes(code)) toast(d.name + '没有这个——按 N 换回你自己', 1.6);
}
addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousedown', e => {
  if (e.button === 2) { cam.drag = { x: e.clientX, x0: e.clientX, t: performance.now() }; return; }
  if (e.button !== 0) return;
  if (G.mode === 'card') { closeCard(); return; }
  if (G.mode === 'dialog') { advanceDialog(); return; }
  if (G.mode === 'opening') { skipOpening(); return; }
  if (G.mode === 'play' && CMD.on) { cmdClick(e.clientX, e.clientY, e.shiftKey); return; }
  if (G.mode === 'play' && CTRL.who !== P) { const d = CTRL.who; if (d.state === 'clinch') d.ctrlClinch('butt'); else if (d.state === 'move') { d.charging = true; d.chargeT = 0; } return; }
  if (G.mode === 'play' && P.state === 'clinch') { clinchAct('butt'); return; }
  if (G.mode === 'play' && !P.atk && P.state === 'move') { P.charging = true; P.chargeT = 0; }
});
addEventListener('mouseup', e => {
  if (e.button === 2) { const d = cam.drag; cam.drag = null; if (d && Math.abs(e.clientX - d.x0) < 5 && performance.now() - d.t < 260 && G.mode === 'play' && !CMD.on) { if (CTRL.who !== P) { const cd = CTRL.who; if (cd.state === 'clinch') cd.ctrlClinch('knee'); else cd.ctrlAttack('alt'); } else if (P.state === 'clinch') clinchAct('knee'); else if (P.state === 'pinned' && P.pinnedBy && P.pinnedBy.crawler) kickFace(P.pinnedBy); else startAttack('kick'); } return; } // a right-click tap kicks
  if (e.button === 0 && CTRL.who !== P) { const d = CTRL.who; if (d.charging) { d.charging = false; d.ctrlAttack(d.chargeT >= 0.42 ? 'heavy' : 'quick'); } return; }
  if (e.button !== 0 || !P.charging) return;
  const heavy = P.chargeT >= 0.42; P.charging = false; startAttack(heavy ? 'heavy' : 'quick', heavy);
});
addEventListener('mousemove', e => { if (cam.drag) { cam.yaw -= (e.clientX - cam.drag.x) * 0.006; cam.drag.x = e.clientX; } });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) cam.yaw -= e.deltaX * 0.004;
  else if (CMD.on) CMD.dist = clamp(CMD.dist * (1 + e.deltaY * (e.ctrlKey ? 0.01 : 0.0012)), 8, 28);
  else cam.userDist = clamp(cam.userDist * (1 + e.deltaY * (e.ctrlKey ? 0.01 : 0.0012)), 5.5, 26);
}, { passive: false });
$('card').addEventListener('click', closeCard);
$('dlg').addEventListener('click', () => advanceDialog());

function setFX(on) { G.fx = on; PERF.auto = false; setQuality(on ? 3 : 1); } // kept for old saves and tests: high or low, by hand
function resetGame() {
  $('card').classList.remove('on'); $('qte').classList.remove('on'); $('dlg').classList.remove('on'); D = null; $('splat').innerHTML = '';
  $('clinch').classList.remove('on'); P.knife.visible = false;
  Object.assign(P, { jawNote: false, wounds: 0, work: null, clinchBy: null, td: null, state: 'move', st: 0, stamina: 100, staMax: 100, winded: false, adr: 0, adrPeak: 0, crash: 0, battery: 100, torchOn: false, durability: 60, broken: false, atk: null, charging: false, invuln: 1, struggle: 0, pinnedBy: null, dead: false, yaw: Math.PI, crouch: false, shutter: false, calmT: 0 });
  P.pos.set(0.2, GROUND_Y, 10.6); P.vel.set(0, 0, 0); P.h.cur = Object.assign({}, NEUTRAL); initSprings(P.h);
  const sh = P.club.userData.shaft; sh.scale.y = 1; sh.position.y = -0.33; P.club.children.forEach(c => { c.visible = true; });
  P.weapon = 'club'; P.club.visible = true; P.axe.visible = false;
  if (!mother.hasBaby) { const b = mother.baby; mother.h.chest.add(b); b.position.set(0.02, -0.2, 0.15); b.rotation.set(0.1, Math.PI + 0.2, 0.18); mother.hasBaby = true; P.carrying = false; P.h.armL.hand.add(P.lantern); P.lantern.position.set(0, -0.05, 0); }
  mother.lang = mother.langT = 0.15; G.babyTaken = false;
  clearGore(); resetCamp(); Object.assign(SIEGE, { on: false, lock: false, scoutDone: false, known: {}, defended: {}, wasOpen: {} });
  if (CTRL.who !== P) { CTRL.who.ctrl = false; CTRL.who = P; } P.ai = false;
  for (const d of defenders) d.reset(); if (CMD.on) setCommand(false, true); CMD.sel.clear(); P.bandaged = false; G.camOv = null;
  while (infected.length > 4) { const e = infected.pop(); scene.remove(e.h.root); disposeTree(e.h.root); e.bar.remove(); e.arrow.remove(); }
  for (const e of infected) e.reset();
  // repaint the player's coat: rebuild the texture by swapping in a fresh one
  if (P.h.coatMat.map) P.h.coatMat.map.dispose(); P.h.coatMat.map = toTex(clothCanvas('#4a4434', 0.55, false, 3 + 7)); P.h.coatMat.needsUpdate = true; atlasRefresh(P.h.coatMat);
  Object.assign(SQUAD, { leader: null, tokenCD: 0, flankT: -99, retreatT: -99, spotT: -99 }); SQUAD.turn.clear();
  labels.forEach(L => L.el.remove()); labels.length = 0;
  G.flood.state = 'on'; G.flood.next = G.t + 40; G.playT = 0; G.mode = 'play'; G.wave = 1; G.waveT = -1; G.hitStop = 0; G.slowmo = 0; setObj('屋里有人在哼歌。');
  toast('重新开始', 1.2);
}
function spawnWave() { // they answer each other from far off, then come
  G.wave++; const base = rnd(0, 6.28);
  for (let i = infected.length - 1; i >= 0 && infected.filter(o => o.dead).length > 4; i--) if (infected[i].dead) { const e = infected[i]; scene.remove(e.h.root); disposeTree(e.h.root); e.bar.remove(); e.arrow.remove(); infected.splice(i, 1); }
  const types = waveTypes(G.wave), n = types.length; // every wave brings more of them, and more of everyone else
  for (let i = 0; i < n; i++) { const a = base + i * (6.28 / n), e = takePooled(types[i], a) || new Infected(types[i], a); e.reset(true); e.provoked = true; e.aware = 0.7; e.lastKnown.copy(P.pos); e.setState('investigate'); }
  SND.roar(LURK_C.clone().addScaledVector(dirA(base), 24), 'rally', 0.9);
  toast('远处的嘶吼一声接一声地应和着。它们又来了。', 3.5); setObj('第 ' + G.wave + ' 波。它们听见了刚才的动静。');
}

function introSquad() { // who's in the cabin with you
  toast('你的人：小赵顶门，老周守后窗，阿梅在屋里。按 Z 指挥他们。', 4.5);
  defenders.forEach((d, i) => { d.sayQ = { t: 1.2 + i * 1.6, text: d.D.line }; });
}
/* ---------------- opening & start ---------------- */
function startGame() {
  SND.init();
  $('title').classList.add('gone'); $('opening').classList.add('on');
  G.mode = 'opening'; G.openingT = 0;
}
function skipOpening() { if (G.mode !== 'opening') return; G.openingT = 99; }
$('startBtn').addEventListener('click', startGame);

/* ---------------- main loop ---------------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  if (perfProbe(raw)) { last = now; return; } // the first half second: how fast does this screen refresh?
  if (perfSkip(now)) return;                  // a 120 Hz screen: every other refresh
  last = now;
  const t0 = performance.now(); renderer.info.reset();
  tick(Math.min(0.05, raw));
  drawFrame(); // shadows are drawn inside, by p8c; on a dense screen the frame is scaled up last (FSR)
  PERF.calls = renderer.info.render.calls; PERF.tris = renderer.info.render.triangles;
  const busy = (performance.now() - t0) / 1000; perfFrame(raw, busy); updatePerfHUD(); perfIdle(busy);
}
function tick(rdt) {
  let dt = rdt; if (G.hitStop > 0) { G.hitStop -= rdt; dt = rdt * 0.05; } else if (G.slowmo > 0) { G.slowmo -= rdt; dt = rdt * 0.3; }
  if (CMD.on && G.mode === 'play') dt = rdt * 0.12; // command view: the world all but stops while you give orders
  if (CMD.on && (G.mode !== 'play' || P.dead)) setCommand(false, true);
  G.t += rdt;
  if (G.mode === 'opening') {
    G.openingT += rdt;
    if (G.openingT > 9.2) { $('opening').classList.remove('on'); $('hud').classList.add('on'); G.mode = 'play'; G.flood.next = G.t + 40; setObj('屋里有人在哼歌。'); introSquad(); }
  }
  if (G.mode === 'card') G.cardT += rdt;
  if (G.mode === 'play') G.playT += rdt;
  if (D && !D.done) { D.typed += rdt * 22; $('dlgText').textContent = D.text.slice(0, Math.floor(D.typed)); if (D.typed >= D.text.length) { D.done = true; mother.talking = false; } }
  updatePlayer(dt);
  squadThink(dt);
  for (const e of infected) e.update(dt);
  for (const d of defenders) d.update(dt);
  if (CTRL.who !== P) { const c = CTRL.who; if (P.dead) { c.ctrl = false; c.charging = false; CTRL.who = P; } else if (c.state === 'ko') { possess(P, true); toast(c.name + '昏过去了。你回到了自己身上。', 2.6); } }
  updateFX(dt);
  updateCamp(dt);
  updateMother(dt);
  updateEnvironment(dt);
  updateCamera(dt, rdt);
  updateWalls();
  updateHUD(rdt);
  updateAudioMix(rdt);
  if (G.mode === 'play' && !P.dead) {
    if (G.waveT < 0 && infected.every(e => e.dead)) { G.waveT = 22; toast('雨里安静了……暂时。', 3); setObj('院子里没有站着的东西了。'); }
    if (G.waveT > 0) { G.waveT -= dt; if (G.waveT <= 0) { G.waveT = -1; spawnWave(); } }
  }
  document.body.classList.toggle('cine', G.mode === 'dialog' || G.mode === 'cutscene' || G.mode === 'card');
  gradePass.uniforms.time.value = G.t;
}
requestAnimationFrame(frame);
window.__dbg = { perfFrame, perfSkip, composerRender: () => drawFrame(), POOL, feedPool, takePooled, makeHumanForTest: o => makeHuman(o), walkPose, poseTo, gaitK, initSprings, INF, waveTypes, clothCanvas, faceCanvas, skinCanvas, DOOR_RB, cats: { decalMat, poolTex, gougeMat, crackMat, puddleMat, streakMat, ringTex, doorLeaf: door.leaf, doorPivot: door.pivot, barMesh, glowTex }, PERF, QUALITY, SHADOWS, BATCHES, PROXIES, SHADOW_STATIC, setQuality, setReference, checkStatic, renderShadows, rigs,
  renderFrame: dt => { const t0 = performance.now(); tick(dt); const t1 = performance.now(); drawFrame(); return { tick: t1 - t0, render: performance.now() - t1 }; }, drawFrame, FSR, CTRL, possess, possessNext, ctrlKey, aiPlayer, defenders, CMD, POSTS, setCommand, orderDefenders, assignPost, cmdSelect, cmdClick, entryPressure, doorBraced, PREY, G, P, cam, mother, infected, SQUAD, stompTarget, takedownTarget, clinchAct, grabPlayer, ENTRIES, door, winBack, winLeft, SIEGE, doorChop, doorRam, smashGlass, hitBoard, interact, toggleBar, setBar, planSiege, startDialog, resetGame, skipOpening, startGame, scene, camera, renderer, setFX, choose, advanceDialog, startAttack, dodge, switchWeapon, toggleTorch, startPin, roar, makeNoise, spawnWave, fatigue, LURK_C, step: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); } };
