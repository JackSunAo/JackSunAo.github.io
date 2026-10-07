/* ===== P8 player: stamina & adrenaline, melee (club / axe: quick, heavy, kick), dodge, stealth, pin & struggle ===== */
// survival instinct hits hard: high base force; stamina is generous but real, and running dry bends every motion
const HIT = {
  quick: { imp: 40, dmg: 24, reach: 2.05, cone: 1.05, stop: 0.075, shake: 0.22, cost: 9, dur: 0.55, strikeA: 0.34, hitA: 0.45 },
  heavy: { imp: 85, dmg: 52, reach: 2.3, cone: 0.95, stop: 0.13, shake: 0.42, cost: 18, dur: 0.85, strikeA: 0.45, hitA: 0.56 },
  kick: { imp: 66, dmg: 6, reach: 1.5, cone: 1.15, stop: 0.06, shake: 0.25, cost: 11, dur: 0.5, strikeA: 0.3, hitA: 0.42 },
  stomp: { imp: 26, dmg: 46, reach: 1.35, cone: 1.2, stop: 0.11, shake: 0.38, cost: 10, dur: 0.6, strikeA: 0.42, hitA: 0.55 },
  // your people's weapons: a spear thrust (long, piercing) and a shield slam (all shove, no damage)
  thrust: { imp: 36, dmg: 30, reach: 2.6, cone: 0.42, stop: 0.06, shake: 0.18, cost: 8, dur: 0.62, strikeA: 0.42, hitA: 0.5 },
  bash: { imp: 82, dmg: 4, reach: 1.45, cone: 0.95, stop: 0.07, shake: 0.25, cost: 11, dur: 0.55, strikeA: 0.35, hitA: 0.45 }
};
// something on the ground within reach of a boot: its head first, then a reaching arm, a leg, the back
function stompTarget() {
  if (P.dead || P.state !== 'move') return null;
  let best = null, bd = 1e9;
  for (const e of infected) {
    if (e.dead || !(e.state === 'crawl' || e.state === 'ko' || (e.state === 'down' && e.landed))) continue;
    for (const [part, side, p] of e.groundPoints()) {
      const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); if (d > 1.35) continue;
      const ruined = (part === 'arm' && e.body.arm[side] !== 'ok') || (part === 'leg' && e.body.leg[side] !== 'ok');
      const sc = d * (part === 'head' ? 0.6 : part === 'torso' ? 1.4 : 1) * (ruined ? 1.8 : 1); if (sc < bd) { bd = sc; best = { e, part, side, p }; }
    }
  }
  return best;
}
const WEAPONS = { club: { name: '钉头球棍', speed: 1, cost: 1 }, axe: { name: '消防斧', speed: 1.12, cost: 1.2 } };
function effMax() { return P.staMax - (P.crash > 0 ? 12 : 0); }
function fatigue() { return smooth(0, 1, 1 - P.stamina / 32) * (1 - 0.5 * P.adr); } // 0 fresh … 1 spent: form falls apart
function powerMul() { return (P.broken && P.weapon === 'club' ? 0.45 : 1) * (1 + 0.35 * P.adr) * (1 - 0.45 * fatigue()); }
function spend(cost) { P.stamina = Math.max(0, P.stamina - cost * (1 - 0.3 * P.adr)); P.staDelay = 0.45; P.staMax = Math.max(55, P.staMax - cost * 0.05); if (P.stamina <= 0.5) P.winded = true; }
function camBasis() { return { fwd: new V3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), right: new V3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)) }; }
function inputDir() { const { fwd, right } = camBasis(), d = new V3(); if (keys.KeyW) d.add(fwd); if (keys.KeyS) d.sub(fwd); if (keys.KeyD) d.add(right); if (keys.KeyA) d.sub(right); return d; }

/* ---------------- attacks ---------------- */
function startAttack(kind, fromCharge) {
  if (kind === true) kind = 'heavy'; else if (kind === false) kind = 'quick';
  if (P.atk || P.state !== 'move' || P.dead || G.mode !== 'play' || (CMD.on && !P.ai)) return;
  const st = kind === 'kick' ? stompTarget() : null; if (st) kind = 'stomp'; // a kick at something on the ground becomes a stomp
  const H = HIT[kind], Wp = WEAPONS[P.weapon], f = fatigue(), foot = kind === 'kick' || kind === 'stomp', dur = H.dur * (1 + 0.5 * f) * (foot ? 1 : Wp.speed);
  spend(H.cost * (foot ? 1 : Wp.cost));
  P.atk = { kind, t: fromCharge ? dur * (H.strikeA - 0.15) : 0, dur, strikeA: H.strikeA, hitA: H.hitA, f, target: st ? null : pickTarget(), stomp: st, low: P.crouch };
  if (f > 0.7 && G.spentToastT <= 0) { toast('力竭：动作变形，挥不动了', 2.2); G.spentToastT = 10; }
}
// soft lock: whoever is in the direction you're pushing, threats first
function pickTarget() {
  const inp = P.ai ? P.aiWant.clone() : inputDir(), aim = inp.lengthSq() > 0.01 ? inp.normalize() : fwdOf(P.yaw);
  let best = null, bs = 1e9;
  for (const e of infected) {
    if (e.dead) continue; const d = e.chestPos().sub(P.pos).setY(0), l = d.length(); if (l > 3.4) continue;
    const dot = d.divideScalar(Math.max(l, 0.001)).dot(aim); if (dot < 0.2) continue;
    const s = l + (1 - dot) * 2.2 - (e.state === 'windup' || e.state === 'lunge' ? 1.2 : 0) + (e.standing ? 0 : 0.6);
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function strike(kind) {
  if (kind === 'stomp') { stompStrike(); return; }
  const H = HIT[kind], blade = P.weapon === 'axe' && kind !== 'kick', f = fwdOf(P.yaw), right = new V3(-Math.cos(P.yaw), 0, Math.sin(P.yaw));
  const low = P.atk && P.atk.low, aimFor = e => {
    if (!e.standing) return 'ground';
    const back = e.fwd().dot(P.pos.clone().sub(e.pos).setY(0).normalize()) < -0.3; if (back && e.seen <= 0 && e.aware < 0.95 && kind !== 'kick') return 'sneak'; // it never saw you coming
    return kind === 'kick' ? 'kick' : low ? 'low' : kind === 'heavy' ? 'high' : 'mid';
  };
  const push = kind === 'quick' ? f.clone().multiplyScalar(0.8).addScaledVector(right, 0.6).normalize() : f.clone();
  const cands = [];
  for (const e of infected) {
    if (e.dead) continue; const d = e.chestPos().sub(P.pos).setY(0), l = d.length();
    if (l > H.reach + (e.standing ? 0 : 0.35)) continue; if (l > 0.3 && d.divideScalar(l).dot(f) < Math.cos(H.cone)) continue;
    if (!openingBetween(P.pos, e.pos)) continue; // a wall between you
    cands.push({ e, l });
  }
  cands.sort((a, b) => a.l - b.l);
  const pm = powerMul(); let n = 0, kills = 0;
  for (const { e } of cands.slice(0, kind === 'heavy' ? 2 : 1)) {
    const r = e.hit(push, kind, pm, blade, aimFor(e)); if (!r) continue; n++; if (r.killed) kills++;
    hitFX(e.chestPos(), push, kind, r, e, blade, pm);
  }
  makeNoise(P.pos, n ? 12 : 4, 'swing');
  if (n) {
    G.hitStop = H.stop * (0.85 + 0.3 * pm) * (kills ? 1.35 : 1); G.shake = Math.max(G.shake, H.shake * (0.8 + 0.3 * pm));
    G.camKick.addScaledVector(push, kind === 'heavy' ? 0.16 : 0.09); G.fovPunch = kind === 'heavy' ? -3.2 : -1.6;
    P.adr = Math.min(1, P.adr + 0.05 + kills * 0.1);
    springKick(P.h, 'shRx', 3); springKick(P.h, 'elR', 4); springKick(P.h, 'chY', -2.5); springKick(P.h, 'spX', -1.5); // the weapon stops in a body; the arm takes it
    if (kind !== 'kick') { stainWeapon(weaponObj(), 0.18 * n); if (P.weapon === 'club' && !P.broken) { P.durability -= kind === 'heavy' ? 4 : 2; if (P.durability <= 0) breakClub(); } }
  } else if (kind !== 'kick' && P.atk && P.atk.f > 0.5) { springKick(P.h, 'spX', 3); P.vel.addScaledVector(f, 1.4); floatLabel('挥空', P.pos.clone().add(new V3(0, 1.9, 0)), 'tough'); }
}
function hitFX(p, dir, kind, r, e, blade, pm) {
  const heavy = kind === 'heavy';
  spawnImpact(p, heavy ? 1.3 : kind === 'kick' ? 0.8 : 0.95);
  if (kind === 'kick') { SND.kick(p); spawnSplash(e.pos, 6, 0.2, 1); }
  else { SND.impact(p, kind, pm, blade); spawnBlood(p, dir, Math.round((heavy ? 30 : 16) * (blade ? 1.6 : 1)), false, heavy ? 1.3 : 1, 0.35); if (heavy || blade) spawnMist(p, dir, heavy ? 1 : 0.7); }
  SND.exhale(e.pos, e.T.voice, 0.35);
  if (r.tag) floatLabel(r.tag, p.clone().add(new V3(0, 0.55, 0)), r.cls, r.cls === 'heavy' ? 1.5 : 1.1);
  if (r.tag2) floatLabel(r.tag2, p.clone().add(new V3(0, 0.95, 0)), '', 1.1);
  if (kind !== 'kick' && heavy && P.pos.distanceTo(e.pos) < 2.2) { if (Math.random() < 0.5) lensSplat(blade ? 3 : 2); if (Math.random() < 0.4) paintWound(P.h.coatMat, 1, false); }
}
function stompStrike() {
  const S = P.atk && P.atk.stomp; makeNoise(P.pos, 9, 'stomp');
  if (!S || S.e.dead || !(S.e.state === 'crawl' || S.e.state === 'down')) return;
  const now = S.e.groundPoints().find(x => x[0] === S.part && x[1] === S.side), p = (now ? now[2] : S.p).clone(); p.y = groundY(p.x, p.z) + 0.1;
  if (Math.hypot(p.x - P.pos.x, p.z - P.pos.z) > 1.6) { floatLabel('踩空', P.pos.clone().add(new V3(0, 1.9, 0)), 'tough'); return; } // it dragged itself away
  const pm = powerMul(), r = S.e.stomped(S.part, S.side, pm);
  G.hitStop = HIT.stomp.stop * (r.killed ? 1.5 : 1); G.shake = Math.max(G.shake, HIT.stomp.shake); G.camKick.y -= 0.12; G.fovPunch = -2;
  SND.kick(p); SND.crunch(p, S.part === 'head' ? 6 : 4, 0.7); spawnSplash(p, 12, 0.18, 1.3);
  spawnBlood(p, new V3(0, 0.6, 0), S.part === 'head' ? 18 : 8, true, 1, 0.7); addDecal(p.x, p.z, S.part === 'head' ? 0.5 : 0.3);
  springKick(P.h, 'knR', 3); springKick(P.h, 'spX', 2); P.adr = Math.min(1, P.adr + 0.06);
  if (r.tag) floatLabel(r.tag, p.clone().add(new V3(0, 0.7, 0)), 'heavy', 1.4);
}
// a crawler has your ankle: drive your heel into its face
function kickFace(e) {
  if (!e || P.state !== 'pinned') return;
  e.body.skull -= 15 * powerMul(); P.struggle += 0.3; spend(5); springKick(e.h, 'headX', 12); SND.kick(e.headPos()); SND.crunch(e.headPos(), 3, 0.5);
  spawnBlood(e.headPos(), new V3(0, 0.3, 0), 6, false, 0.6, 0.5); G.shake = Math.max(G.shake, 0.2); springKick(P.h, 'hipLx', -5);
  if (e.body.skull <= 0) { e.crushSkull(new V3(0, -0.4, 0)); releasePin(e, true); e.die(); floatLabel('蹬碎了它的脸', e.headPos(), 'heavy', 1.4); }
  else floatLabel('蹬脸', e.headPos(), '', 0.8);
}
function breakClub() {
  P.durability = 0; P.broken = true; const sh = P.club.userData.shaft; sh.scale.y = 0.45; sh.position.y = -0.15;
  P.club.children.forEach(c => { if (c.geometry && c.geometry.type === 'CylinderGeometry' && c !== sh && c.position.y < -0.4) c.visible = false; });
  SND.crunch(P.pos, 4, 0.5); toast('球棍断了。剩下的半截伤害很低。按 2 换斧头。', 3.5);
}
function switchWeapon(w) {
  if (P.weapon === w || P.atk || P.state !== 'move' || P.dead) return;
  P.weapon = w; P.club.visible = w === 'club'; P.axe.visible = w === 'axe'; SND.click();
  toast(w === 'axe' ? '消防斧：伤害高，能砍断肢体；更沉，更耗体力' : '球棍：冲击大，打得它们站不稳', 2.2);
}
function dodge() {
  if (P.state !== 'move' || P.dead || G.mode !== 'play') return;
  const f = fatigue(), d = inputDir(); if (d.lengthSq() < 0.01) d.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  P.dodgeDir.copy(d.normalize()); P.state = 'dodge'; P.st = 0; P.dodgeK = 1 - 0.45 * f; P.invuln = 0.34 * (1 - 0.4 * f); spend(12); P.atk = null; P.charging = false;
  SND.step(P.pos, P.indoor ? 'wood' : 'mud', 0.8); spawnSplash(P.pos, 6, 0.2, 1.2); makeNoise(P.pos, 5, 'dodge');
  // reading the lunge: dodge just before it lands and time slows for a breath
  let close = null; for (const e of infected) if (!e.dead && (e.state === 'lunge' || (e.state === 'windup' && e.st > 0.3)) && e.pos.distanceTo(P.pos) < 2.8) close = e;
  if (close && f < 0.8) { G.slowmo = 0.45; P.invuln = 0.6; P.adr = Math.min(1, P.adr + 0.2); floatLabel('闪开了', P.pos.clone().add(new V3(0, 1.9, 0)), 'heavy'); }
}
function shovePlayer(e) { // an attacker with no hands left slams into you instead
  const d = P.pos.clone().sub(e.pos).setY(0).normalize();
  P.state = 'stagger'; P.st = 0; P.atk = null; P.charging = false; P.vel.copy(d).multiplyScalar(4.2); spend(14); P.invuln = 0.5;
  const loc = toLocal(d, P.yaw); impactReact(P.h, loc.x, loc.z, 1.1, 'quick'); G.shake = Math.max(G.shake, 0.3); SND.thud(P.pos); SND.grunt();
  floatLabel('被撞开', P.pos.clone().add(new V3(0, 1.9, 0)), 'heavy');
}
/* ---------------- the cabin: door, bar, boards ---------------- */
function interactTarget() {
  if (P.dead || P.state !== 'move') return null;
  const mp = new V3(); mother.h.pelvis.getWorldPosition(mp); const dm = P.pos.distanceTo(mp.setY(P.pos.y));
  const dd = door.fallen || door.fall ? 9 : Math.hypot(P.pos.x, P.pos.z - 3.12);
  let win = null, dw = 9; if (P.indoor) for (const w of [winBack, winLeft]) { const d = Math.hypot(P.pos.x - w.nail.x, P.pos.z - w.nail.z); if (d < dw) { dw = d; win = w; } }
  const c = [];
  if (dm < 1.7) c.push({ k: 'mother', d: dm - 0.3 }); if (dd < 1.45) c.push({ k: 'door', d: dd }); if (win && dw < 1.0 && win.boards.length < 3) c.push({ k: 'window', w: win, d: dw });
  c.sort((a, b) => a.d - b.d); return c[0] || null;
}
function interact() {
  const td = takedownTarget(); if (td) { startTakedown(td); return; }
  const t = interactTarget(); if (!t) return;
  if (t.k === 'mother') startDialog(mother.hasBaby ? 'start' : 'after');
  else if (t.k === 'door') {
    if (door.barred) { toast('门闩着。B 拿下门闩', 1.6); return; }
    const open = door.ang < 0.3; door.latch = open ? 0 : 1; door.target = open ? 1.35 : 0; door.angV = open ? 2 : -2; SND.creak(ENTRIES[0].out); makeNoise(P.pos, 4, 'door');
  } else if (t.k === 'window') { if (G.planks <= 0) { toast('没有木板了', 1.5); return; } P.state = 'work'; P.st = 0; P.work = { w: t.w, n: 0 }; }
}
function toggleBar() {
  if (!P.indoor || Math.hypot(P.pos.x, P.pos.z - 3.12) > 1.6 || P.state !== 'move' || door.fallen || door.fall) return;
  if (door.barBroken) { toast('门闩断了', 1.4); return; } if (door.ang > 0.08) { toast('先把门关上', 1.4); return; }
  setBar(!door.barred); toast(door.barred ? '上了门闩' : '拿下门闩', 1.2);
}
// an axe blade: down, bleeding; a second one ends it
function axeHitPlayer(e) {
  const d = P.pos.clone().sub(e.pos).setY(0).normalize(), chest = P.pos.clone().add(new V3(0, 1.3, 0));
  P.wounds++; paintWound(P.h.coatMat, 3, true); spawnBlood(chest, d, 28, false, 1.3, 0.6); spawnMist(chest, d, 1); SND.impact(chest, 'heavy', 1, true); SND.grunt(); lensSplat(4);
  G.shake = Math.max(G.shake, 0.7); G.hitStop = 0.12; G.camKick.addScaledVector(d, 0.2);
  if (P.wounds >= 2) {
    P.dead = true; P.state = 'dead'; P.atk = null; $('qte').classList.remove('on');
    setTimeout(() => P.dead && showCard('斧头', '第二下砍进了锁骨。你倒在地上，听见它把斧头从你身上拔出来。\n\n这是原型：按 R 重新开始。', null, true), 900); return;
  }
  P.state = 'down'; P.st = 0; P.atk = null; P.charging = false; P.vel.copy(d).multiplyScalar(3.4); spend(30); P.invuln = 0.35;
  const loc = toLocal(d, P.yaw); impactReact(P.h, loc.x, loc.z, 1.4, 'heavy');
  toast('斧头砍进了你的肩膀。你还能动——但血一直在流，再挨一下就完了。', 3.5); floatLabel('重伤', chest.clone().add(new V3(0, 0.6, 0)), 'heavy', 1.6);
}
function toggleTorch() { if (P.battery <= 0) { toast('手电没电了'); return; } P.torchOn = !P.torchOn; SND.click(); makeNoise(P.pos, 3, 'click'); }
function whistle() { if (P.whistleCD > 0 || P.dead || G.mode !== 'play') return; P.whistleCD = 2.5; SND.whistle(); makeNoise(P.pos, 12, 'whistle'); floatLabel('（口哨）', P.pos.clone().add(new V3(0, 2, 0)), 'tough'); }

function quickPose(a) {
  if (a < 0.34) { const k = smooth(0, 0.34, a); return { chY: 0.9 * k, spY: 0.25 * k, shRx: -1.35 * k, shRz: -0.55 * k, shRy: 0.5 * k, elR: 0.5 + 0.9 * k, hipRx: 0.2 * k }; }
  if (a < 0.56) { const k = smooth(0.34, 0.56, a); return { chY: 0.9 - 2.0 * k, spY: 0.25 - 0.55 * k, shRx: -1.35 - 0.15 * k, shRz: -0.55 + 0.25 * k, shRy: 0.5 - 1.5 * k, elR: 1.4 - 1.25 * k, spX: 0.15 * k, hipLx: -0.4 * k, knR: 0.3 * k }; }
  const k = smooth(0.56, 1, a); return { chY: -1.1 * (1 - k), spY: -0.3 * (1 - k), shRx: -1.5 * (1 - k) - 0.3 * k, shRz: -0.3 * (1 - k), shRy: -1.0 * (1 - k), elR: 0.15 + 0.6 * k, spX: 0.15 * (1 - k), hipLx: -0.4 * (1 - k), knR: 0.3 * (1 - k) };
}
function heavyPose(a) {
  if (a < 0.45) { const k = smooth(0, 0.45, a); return { shRx: -2.85 * k, shLx: -1.9 * k, elR: 0.4 + 1.5 * k, elL: 0.5 + 1.2 * k, spX: -0.28 * k, chY: 0.25 * k, headX: -0.15 * k }; }
  if (a < 0.62) { const k = smooth(0.45, 0.62, a); return { shRx: -2.85 + 2.95 * k, shLx: -1.9 + 1.7 * k, elR: 1.9 - 1.75 * k, elL: 1.7 - 1.2 * k, spX: -0.28 + 0.85 * k, chY: 0.25 - 0.35 * k, hipLx: -0.55 * k, knL: 0.45 * k, knR: 0.25 * k, bodyY: -0.09 * k, headX: 0.25 * k }; }
  const k = smooth(0.62, 1, a); return { shRx: 0.1 * (1 - k) - 0.3 * k, shLx: -0.2 * (1 - k) - 0.35 * k, elR: 0.15 + 0.6 * k, elL: 0.5 + 0.45 * k, spX: 0.57 * (1 - k), hipLx: -0.55 * (1 - k), knL: 0.45 * (1 - k), knR: 0.25 * (1 - k), bodyY: -0.09 * (1 - k) };
}
function stompPose(a) { // knee high, look down, drive the heel into the ground
  if (a < 0.42) { const k = smooth(0, 0.42, a); return { hipRx: -1.35 * k, knR: 1.7 * k, spX: 0.25 - 0.1 * k, knL: 0.2 * k, shLx: -0.5 * k, shLz: 0.35 * k, shRz: -0.3 * k, headX: 0.45 }; }
  if (a < 0.58) { const k = smooth(0.42, 0.58, a); return { hipRx: -1.35 + 1.15 * k, knR: 1.7 - 1.6 * k, spX: 0.15 + 0.2 * k, knL: 0.2 + 0.25 * k, pelY: -0.08 * k, shLx: -0.5, shLz: 0.35, shRz: -0.3, headX: 0.45 }; }
  const k = smooth(0.58, 1, a); return { hipRx: -0.2 * (1 - k), knR: 0.1 + 0.2 * (1 - k), spX: 0.35 * (1 - k), knL: 0.45 * (1 - k), pelY: -0.08 * (1 - k), shLx: -0.5 * (1 - k), shLz: 0.35 * (1 - k), shRz: -0.3 * (1 - k), headX: 0.45 * (1 - k) };
}
function kickPose(a) { // chamber, drive the heel through, recover
  if (a < 0.3) { const k = smooth(0, 0.3, a); return { hipRx: -1.15 * k, knR: 1.55 * k, spX: -0.15 * k, shLx: -0.55 * k, shLz: 0.3 * k, shRx: 0.25 * k, knL: 0.15 * k, elL: 1.0 }; }
  if (a < 0.5) { const k = smooth(0.3, 0.5, a); return { hipRx: -1.15 - 0.35 * k, knR: 1.55 - 1.45 * k, ankR: 0.35 * k, spX: -0.15 - 0.22 * k, shLx: -0.55, shLz: 0.3, shRx: 0.25 + 0.2 * k, knL: 0.15 + 0.12 * k, elL: 1.0 }; }
  const k = smooth(0.5, 1, a); return { hipRx: -1.5 * (1 - k), knR: 0.1 + Math.sin(k * Math.PI) * 0.6, spX: -0.37 * (1 - k), shLx: -0.55 * (1 - k), shLz: 0.3 * (1 - k), shRx: 0.45 * (1 - k), knL: 0.27 * (1 - k), elL: 1.0 };
}
// running dry doesn't stop you, it bends you: smaller arcs, slumped spine, bent knees
function deform(p, f) { if (f <= 0.02) return p; const k = 1 - 0.32 * f; for (const key in p) p[key] *= k; p.spX = (p.spX || 0) + 0.2 * f; p.headX = (p.headX || 0) + 0.15 * f; p.knL = (p.knL || 0) + 0.12 * f; p.knR = (p.knR || 0) + 0.1 * f; return p; }

/* ---------------- grabbed: a clinch first, the ground only if you lose it ---------------- */
function grabPlayer(e) {
  if (P.state === 'pinned' || P.dead) return;
  if (P.state === 'clinch' && P.clinchBy && P.clinchBy !== e) { const c = P.clinchBy; breakClinch(null); c.setState('recover'); c.cool = rnd(1, 1.6); startPin(e); floatLabel('另一只把你扑倒了', P.pos.clone().add(new V3(0, 1.8, 0)), 'heavy'); return; }
  const toE = e.pos.clone().sub(P.pos).setY(0).normalize(), behind = fwdOf(P.yaw).dot(toE) < -0.35;
  // whether it simply bowls you over depends on its weight, where it came from, and the shape you're in
  const s = P.state === 'down' ? 9 : 0.45 * (e.T.weight / 75) + (behind ? 0.6 : 0) + 0.35 * fatigue() + (P.atk ? 0.15 : 0) + (P.wounds ? 0.2 : 0) - 0.3 * P.adr + (e.arms < 2 ? -0.25 : 0) + (e.frenzy > 0 ? 0.1 : 0) + rnd(-0.15, 0.15);
  if (s > 0.95) { startPin(e); floatLabel(behind ? '从背后扑倒' : '被扑倒了', P.pos.clone().add(new V3(0, 1.8, 0)), 'heavy'); return; }
  P.state = 'clinch'; P.st = 0; P.clinchBy = e; P.atk = null; P.charging = false; P.clinchProg = 0; P.yaw = Math.atan2(toE.x, toE.z);
  P.clinchNeed = clamp(Math.round(1.5 + 3 * (e.T.weight / 75) * (e.arms >= 2 ? 1 : 0.6) - 2 * P.adr - (P.stamina > 50 ? 0.5 : 0)), 2, 7);
  P.clinchMax = 1.5 + 0.4 * P.adr;
  e.setState('grab'); e.holding = P; e.vel.set(0, 0, 0); G.shake = Math.max(G.shake, 0.25); SND.grunt(); SND.growl(e.pos, 0.9, 0.5); impactReact(P.h, 0, -1, 0.6, 'quick');
  $('clinch').classList.add('on'); makeNoise(P.pos, 7, 'struggle'); P.adr = Math.min(1, P.adr + 0.2);
}
function clinchAct(kind) { // Space: shove it off · Q: knee to the gut · attack: the haft into its face
  const e = P.clinchBy; if (!e || P.state !== 'clinch') return;
  const spent = P.stamina < 3; spend(kind === 'shove' ? 4 : kind === 'knee' ? 9 : 8);
  P.clinchProg += (kind === 'shove' ? 1 : 2) * (spent ? 0.6 : 1) * (1 + 0.5 * P.adr);
  const fp = P.pos.clone().add(new V3(0, 1.6, 0));
  if (kind === 'knee') { springKick(e.h, 'spX', 8); springKick(e.h, 'headX', 6); springKick(P.h, 'hipRx', -6); SND.kick(e.chestPos()); e.bal -= 0.15; floatLabel('顶膝', fp, '', 0.8); }
  else if (kind === 'butt') {
    e.body.skull -= 10 * powerMul(); springKick(e.h, 'headX', -10); springKick(P.h, 'shRx', -4); SND.impact(e.headPos(), 'quick', 0.6); spawnBlood(e.headPos(), fwdOf(P.yaw), 6, false, 0.7, 0.4);
    floatLabel(P.weapon === 'axe' ? '斧柄砸脸' : '棍柄砸脸', fp, '', 0.8);
    if (e.body.skull <= 0) { breakClinch(null); e.crushSkull(fwdOf(P.yaw)); e.startFall(toLocal(fwdOf(P.yaw), e.yaw), 0.6); e.dieOnLand = true; return; }
  } else springKick(P.h, 'spX', 2);
  if (P.clinchProg >= P.clinchNeed) breakClinch(true);
}
function breakClinch(pushed) {
  const e = P.clinchBy; P.clinchBy = null; $('clinch').classList.remove('on'); if (e && e.holding === P) e.holding = null;
  if (pushed === null || !e) { P.state = 'move'; return; }
  if (pushed) {
    P.state = 'move'; P.invuln = 0.6; const away = e.pos.clone().sub(P.pos).setY(0).normalize();
    e.vel.copy(away).multiplyScalar(3.4); e.bal -= 0.55; e.balT = 0.5; e.cool = rnd(1.2, 2); releaseToken();
    if (e.bal <= 0) e.startFall(toLocal(away, e.yaw), 0.8); else e.stumble(away, 0.55);
    floatLabel('推开了', P.pos.clone().add(new V3(0, 1.8, 0)), 'heavy'); SND.exhale(e.pos, e.T.voice, 0.4);
  } else { startPin(e); floatLabel('被拖倒在地', P.pos.clone().add(new V3(0, 1.8, 0)), 'heavy'); }
}

/* ---------------- quiet kills: from behind, unseen; or finishing one that's down ---------------- */
function takedownTarget() {
  if (P.state !== 'move' || P.dead || P.atk || G.mode !== 'play') return null;
  let best = null, bd = 1.3;
  for (const e of infected) {
    if (e.dead) continue;
    const busy = (e.state === 'grab' || e.state === 'pinning') && e.holding && e.holding !== P; // its hands are full with one of your people
    if (e.state === 'ko' || (e.state === 'down' && e.landed) || e.state === 'crawl' || (busy && e.crawler)) {
      const hp = e.groundPoints().find(x => x[0] === 'head'); if (hp && Math.hypot(hp[2].x - P.pos.x, hp[2].z - P.pos.z) < 1.0 && openingBetween(P.pos, e.pos)) return { e, kind: 'finish' };
      continue;
    }
    const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); if (d > bd || !e.standing) continue;
    if (!busy && ['windup', 'lunge', 'axeWind', 'axeSwing', 'grab', 'pinning', 'stumble', 'climb', 'startle', 'takendown'].includes(e.state)) continue;
    const toP = P.pos.clone().sub(e.pos).setY(0).normalize(); if (e.fwd().dot(toP) > -0.3) continue; // you have to be at its back
    if (!busy && (e.seen > 0 || (e.aware >= 0.95 && !['work', 'siege', 'scout'].includes(e.state)))) continue; // and it can't know you're there
    if (!openingBetween(P.pos, e.pos)) continue;
    bd = d; best = { e, kind: 'stealth' };
  }
  return best;
}
function startTakedown(t) {
  const e = t.e; P.state = 'takedown'; P.st = 0; P.td = { e, kind: t.kind, done: false }; P.atk = null; P.charging = false;
  weaponObj().visible = false; P.knife.visible = true;
  if (t.kind === 'stealth') { if (e.state === 'work' || e.state === 'grab' || e.state === 'pinning') releaseToken(); if (e.holding && e.holding !== P) floatLabel('从它身下救出了' + e.holding.name, e.headPos(), 'heavy', 1.6); e.holding = null; e.setState('takendown'); e.tdLimp = false; e.vel.set(0, 0, 0); P.yaw = e.yaw; }
  else { const hp = e.groundPoints().find(x => x[0] === 'head')[2]; P.yaw = Math.atan2(hp.x - P.pos.x, hp.z - P.pos.z); }
  makeNoise(P.pos, 2.5, 'knife');
}
function stab(e, ground) { // through the base of the skull
  const hp = e.headPos(); e.body.skull = 0; e.dirty = true; springKick(e.h, 'headX', 8); springKick(e.h, 'spX', 4);
  spawnBlood(hp, fwdOf(P.yaw).multiplyScalar(0.3).add(new V3(0, -0.2, 0)), 10, false, 0.5, 0.6); paintWound(e.h.faceMat, 1, false); SND.crunch(hp, 3, 0.35); SND.exhale(e.pos, e.T.voice, 0.3);
  makeNoise(P.pos, 3, 'knife');
  if (ground) e.die(); else e.tdLimp = true;
  floatLabel(ground ? '补刀' : '无声刺杀', hp.clone().add(new V3(0, 0.3, 0)), 'heavy', 1.4);
}
function endTakedown() {
  const T = P.td; P.td = null; P.state = 'move'; weaponObj().visible = true; P.knife.visible = false;
  if (T && T.kind === 'stealth' && !T.e.dead) { const e = T.e; e.quietFall = true; e.startFall({ x: 0, z: 1 }, 0.15); e.dieOnLand = true; }
}

/* ---------------- pin / struggle ---------------- */
function startPin(e) {
  P.state = 'pinned'; P.st = 0; P.struggle = 0; P.pinnedBy = e; P.atk = null; P.charging = false; e.setState('pinning'); e.holding = P;
  P.yaw = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
  $('qte').classList.add('on'); G.shake = 0.4; SND.thud(P.pos); SND.heartbeat(0.8); P.adr = Math.min(1, P.adr + 0.3); makeNoise(P.pos, 9, 'struggle');
  impactReact(P.h, 0, -1, 1.2, 'quick');
}
function releasePin(e, scared) {
  if (P.pinnedBy !== e) { if (e.holding && !e.holding.isPlayer) e.holding.freeFrom(e, scared); return; }
  e.holding = null; P.state = 'move'; P.pinnedBy = null; P.invuln = 1.0; $('qte').classList.remove('on'); SQUAD.tokenCD = Math.max(SQUAD.tokenCD, 0.9);
  const away = e.pos.clone().sub(P.pos).setY(0).normalize();
  if (e.crawler) { e.setState('crawl'); e.pos.addScaledVector(away, 0.5); floatLabel(scared ? '被光逼退' : '踹开', e.headPos(), 'heavy'); return; }
  e.vel.copy(away).multiplyScalar(scared ? 2.5 : 3.5);
  if (!scared) { e.startFall(toLocal(away, e.yaw), 1.2); floatLabel('挣脱', P.pos.clone().add(new V3(0, 1.6, 0)), 'heavy'); }
  else floatLabel('被光逼退', e.headPos(), '');
}
function bitten(by) {
  if (P.dead) return;
  const e = P.pinnedBy, other = by && by !== e;
  P.dead = true; P.state = 'dead'; $('qte').classList.remove('on');
  if (e) { e.holding = null; if (e.crawler) e.setState('crawl'); else { e.setState('stalk'); e.cool = 3; } } P.pinnedBy = null;
  if (other) { by.setState('stalk'); by.cool = 3; }
  G.shake = 0.5; SND.shriek(P.pos, 0.6); paintWound(P.h.coatMat, 3, true);
  const txt = other ? '压着你的那只咬不动，它一直在嚎。另一只扑上来，咬穿了你的衣领。' : (e && e.crawler ? '它抓着你的脚踝爬上来，牙齿嵌进了小腿。' : '它咬穿了你的衣领。脖子上一阵剧痛，然后是热。');
  setTimeout(() => P.dead && showCard('深咬伤', txt + '\n潜伏期开始了，最多三天。\n\n这是原型：按 R 重新开始。', null, true), 900);
}

/* ---------------- one interface for every prey: you, or one of your people ---------------- */
function grabbable(q) { if (!q || q.dead || q.invuln > 0) return false; return q.isPlayer ? (q.state === 'move' || q.state === 'down') : q.canGrab(); }
function preyGrab(e, q) { if (q.isPlayer) grabPlayer(e); else q.grabbedBy(e); }
function preyShove(e, q) { if (q.isPlayer) shovePlayer(e); else q.shovedBy(e); }
function preyPin(e, q) { if (q.isPlayer) startPin(e); else q.pinnedByE(e); }
function preyBite(e, q) { if (q.isPlayer) bitten(e); else q.bittenBy(e); }
function preyAxe(e, q) { if (q.isPlayer) axeHitPlayer(e); else q.axedBy(e); }
// the thing holding you down was knocked off you or killed by someone else
function freePlayer() {
  const e = P.pinnedBy; if (e && e.holding === P) e.holding = null;
  P.state = 'move'; P.pinnedBy = null; P.invuln = 1.0; P.struggle = 0; $('qte').classList.remove('on'); SQUAD.tokenCD = Math.max(SQUAD.tokenCD, 0.9);
  floatLabel('压着你的那只被打开了', P.pos.clone().add(new V3(0, 1.8, 0)), 'heavy', 1.4); P.adr = Math.min(1, P.adr + 0.1);
}

/* ---------------- your body on its own: while you're in someone else, it holds where you left it and fights what comes ---------------- */
function aiPlayer(dt) {
  P.aiT -= dt; const me = P.pos; let foe = null, fs = 1e9;
  for (const e of infected) {
    if (e.dead || e.state === 'takendown') continue; const d = Math.hypot(e.pos.x - me.x, e.pos.z - me.z); if (d > 7) continue;
    if (insideCabin(e.pos.x, e.pos.z) !== P.indoor && !openingBetween(me, e.pos)) continue;
    const near = Math.hypot(e.pos.x - P.aiHold.x, e.pos.z - P.aiHold.z) < 3.5 || d < 2.4 || (e.holding && d < 6); if (!near) continue;
    const s = d - (e.holding ? 3 : 0) - (e.tgt === P && ['windup', 'lunge'].includes(e.state) ? 2 : 0); if (s < fs) { fs = s; foe = e; }
  }
  P.aiFoe = foe; const want = new V3();
  if (foe) {
    const to = foe.pos.clone().sub(me).setY(0), d = to.length(); to.divideScalar(Math.max(d, 0.001));
    if (d > 1.45) want.copy(to);
    if (!P.atk && P.state === 'move' && P.aiT <= 0 && d < HIT.quick.reach + 0.25 && openingBetween(me, foe.pos)) {
      P.yaw = Math.atan2(to.x, to.z); P.aiWant.copy(to);
      startAttack(!foe.standing ? 'kick' : (foe.state === 'stumble' || Math.random() < 0.3) ? 'heavy' : 'quick'); // a kick at something on the ground becomes a stomp
      P.aiT = rnd(0.45, 0.9) + fatigue() * 0.6;
    }
  } else { const back = P.aiHold.clone().sub(me).setY(0); if (back.length() > 0.5) want.copy(back.normalize()).multiplyScalar(0.7); }
  if (want.lengthSq() > 0) P.aiWant.copy(want);
  return want;
}

/* ---------------- per-frame ---------------- */
function updatePlayer(dt) {
  const h = P.h; P.st += dt; P.invuln -= dt; P.staDelay -= dt; P.whistleCD -= dt; P.crash -= dt; G.spentToastT -= dt;
  P.indoor = insideCabin(P.pos.x, P.pos.z);
  const act = G.mode === 'play' && (!CMD.on || P.ai) && P.state !== 'pinned' && P.state !== 'stagger' && P.state !== 'down' && P.state !== 'work' && P.state !== 'clinch' && P.state !== 'takedown' && !P.dead;
  const want = act ? (P.ai ? aiPlayer(dt) : inputDir()) : new V3(); if (want.length() > 1) want.normalize();
  const fd = fatigue(); if (P.winded && P.stamina > 25) P.winded = false;
  const sprint = act && !P.ai && keys.ShiftLeft && want.lengthSq() > 0.01 && !P.winded && !P.atk && !P.charging && P.state === 'move' && !P.indoor;
  if (sprint && P.crouch) P.crouch = false;
  let speed = P.indoor ? 1.6 : sprint ? 4.0 : P.crouch ? 1.25 : 2.25; speed *= 1 - 0.18 * fd; if (P.carrying) speed *= 0.85; if (P.atk || P.charging) speed *= 0.3;
  if (P.state === 'dodge') { const k = 1 - P.st / 0.42; P.vel.copy(P.dodgeDir).multiplyScalar((6.4 * k + 0.6) * P.dodgeK); if (P.st > 0.42) P.state = 'move'; }
  else if (P.state === 'stagger') { P.vel.multiplyScalar(Math.exp(-5 * dt)); if (P.st > 0.45) P.state = 'move'; }
  else if (P.state === 'down') { P.vel.multiplyScalar(Math.exp(-4 * dt)); if (P.st > 1.9) P.state = 'move'; }
  else if (P.state === 'clinch') { // face to face; it pulls, you push
    const e = P.clinchBy; P.vel.multiplyScalar(Math.exp(-10 * dt));
    if (!e || e.dead || e.state !== 'grab') { P.state = 'move'; P.clinchBy = null; $('clinch').classList.remove('on'); if (e && e.holding === P) e.holding = null; }
    else { if (P.ai && Math.random() < dt * 3.5) clinchAct(Math.random() < 0.3 ? 'knee' : 'shove'); if (P.state === 'clinch') { $('clinchBar').style.width = Math.min(100, P.clinchProg / P.clinchNeed * 100).toFixed(0) + '%'; $('clinchTime').style.width = Math.max(0, 100 - P.st / P.clinchMax * 100).toFixed(0) + '%'; if (P.st > P.clinchMax) breakClinch(false); } }
  }
  else if (P.state === 'takedown') {
    const T = P.td, e = T && T.e; P.vel.set(0, 0, 0);
    if (!e) P.state = 'move';
    else if (T.kind === 'stealth') { const f = fwdOf(P.yaw); e.pos.copy(P.pos).addScaledVector(f, 0.42); e.pos.y = groundY(e.pos.x, e.pos.z); e.yaw = P.yaw; if (!T.done && P.st > 0.55) { T.done = true; stab(e, false); } if (P.st > 1.4) endTakedown(); }
    else { if (!T.done && P.st > 0.45) { T.done = true; stab(e, true); } if (P.st > 0.95) endTakedown(); }
  }
  else if (P.state === 'work') { // nailing a board over a window: three blows of the hammer, each one heard outside
    P.vel.multiplyScalar(Math.exp(-12 * dt)); const W = P.work, hits = [0.3, 0.65, 1.0];
    if (W && W.n < 3 && P.st > hits[W.n]) { W.n++; SND.hammer(W.w.nail); makeNoise(P.pos, 8, 'hammer'); }
    if (P.st > 1.2) { if (W && nailBoard(W.w)) toast('钉上了一块木板（还剩 ' + G.planks + ' 块）', 1.6); P.state = 'move'; P.work = null; }
  }
  else if (P.state === 'pinned' || P.dead) { P.vel.multiplyScalar(Math.exp(-10 * dt)); if (P.state === 'pinned' && (!P.pinnedBy || P.pinnedBy.dead || P.pinnedBy.state !== 'pinning')) freePlayer(); }
  else { P.vel.x = damp(P.vel.x, want.x * speed, 10, dt); P.vel.z = damp(P.vel.z, want.z * speed, 10, dt); }
  // stamina: generous and dynamic; a short rest refills it, long fights lower the ceiling
  const sp0 = Math.hypot(P.vel.x, P.vel.z), cap = effMax();
  if (sprint) { P.stamina = Math.max(0, P.stamina - 7 * (1 - 0.3 * P.adr) * dt); P.staDelay = Math.max(P.staDelay, 0.5); P.staMax = Math.max(55, P.staMax - 0.3 * dt); if (P.stamina <= 0.5) P.winded = true; }
  if (P.staDelay <= 0 && !P.atk && P.state !== 'pinned' && !P.dead) P.stamina = Math.min(cap, P.stamina + (sp0 < 0.3 ? 22 : 15) * (1 + 0.4 * P.adr) * (P.crash > 0 ? 0.7 : 1) * (P.wounds && !P.bandaged ? 0.7 : 1) * dt);
  if (P.wounds && !P.dead && Math.random() < dt * (P.bandaged ? 0.4 : 3)) spawnBlood(P.pos.clone().add(new V3(0, 1.2, 0)), new V3(0, -0.3, 0), 1, true, 0.2, 0.9); // the shoulder keeps bleeding
  if (P.stamina > cap) P.stamina = Math.max(cap, P.stamina - 20 * dt);
  let threat = 0;
  for (const e of infected) {
    if (e.dead || !(HUNT.includes(e.state) || e.state === 'crawl' || e.state === 'stumble')) continue; const d = e.pos.distanceTo(P.pos);
    if (d < 2.8 && (e.state === 'windup' || e.state === 'lunge')) threat = Math.max(threat, 1); else if (d < 5) threat = Math.max(threat, 0.6); else if (d < 9) threat = Math.max(threat, 0.25);
  }
  if (P.state === 'pinned') threat = 1.4;
  P.calmT = threat > 0.2 ? 0 : P.calmT + dt;
  P.staMax = Math.min(100, P.staMax + (P.calmT > 3 && !sprint ? 0.7 : 0.08) * dt);
  // adrenaline: the body answers danger, then drops you when it leaves
  if (threat > 0.2 && !P.dead) P.adr = Math.min(1, P.adr + threat * 0.35 * dt); else if (P.calmT > 3) P.adr = Math.max(0, P.adr - 0.07 * dt);
  P.adrPeak = Math.max(P.adrPeak, P.adr);
  if (P.adrPeak > 0.6 && P.adr < 0.15 && !P.dead) { P.adrPeak = 0; P.crash = 14; toast('肾上腺素退了。手在抖，腿发软。', 2.8); }
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; collide(P.pos, 0.28);
  P.pos.y = damp(P.pos.y, groundY(P.pos.x, P.pos.z), 16, dt);
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (P.state === 'move' && !P.atk && sp > 0.2) P.yaw += angDiff(P.yaw, Math.atan2(P.vel.x, P.vel.z)) * (1 - Math.exp(-12 * dt));
  if (P.state === 'dodge') P.yaw += angDiff(P.yaw, Math.atan2(P.dodgeDir.x, P.dodgeDir.z) + (P.dodgeDir.dot(fwdOf(P.yaw)) < -0.3 ? Math.PI : 0)) * 0.2;
  // how far away they can make you out: lantern, torch, floodlight, lightning; crouching and bushes help
  P.vis = (0.2 + (P.shutter ? 0.02 : 0.4) + (P.torchOn ? 0.45 : 0) + (inFlood(P.pos) ? 0.7 : 0) + flashLight.intensity * 0.35) * (P.crouch ? 0.6 : 1) * (bushCover(P.pos) ? 0.45 : 1) * (1 - 0.2 * G.rain) * (P.indoor ? 0.8 : 1);
  // footsteps are noise
  const prevS = Math.sin(P.ph); const turnR = Math.abs(angDiff(P.yawPrev ?? P.yaw, P.yaw)) / Math.max(dt, 1e-3); P.yawPrev = P.yaw;
  const spG = Math.max(sp, Math.min(0.8, turnR * 0.3)); // turning on the spot takes steps
  P.ph += dt * spG * gaitK(spG, P.h.s);
  if (sp > 0.4 && Math.sign(Math.sin(P.ph)) !== Math.sign(prevS)) {
    const surf = P.indoor ? 'wood' : (P.pos.z < 5.45 && Math.abs(P.pos.x) < 3.7 ? 'porch' : 'mud');
    SND.step(P.pos, surf, P.crouch ? 0.22 : sprint ? 0.65 : 0.45);
    makeNoise(P.pos, P.crouch ? 1.2 : sprint ? 9 : (surf === 'mud' ? 3.5 : 4.5), 'step');
    if (sprint && surf === 'mud') spawnSplash(P.pos, 3, 0.1, 0.9);
  }
  // attack / charge, with a soft lock that turns you and steps you in
  if (P.charging) { P.chargeT += dt; const t = pickTarget(); if (t) { const d = t.chestPos().sub(P.pos); P.yaw += angDiff(P.yaw, Math.atan2(d.x, d.z)) * (1 - Math.exp(-6 * dt)); } }
  if (P.atk) {
    const A = P.atk; A.t += dt; const a = A.t / A.dur;
    if (A.stomp && !A.stomp.e.dead && a < A.hitA) { const S = A.stomp, now = S.e.groundPoints().find(x => x[0] === S.part && x[1] === S.side); if (now) S.p.copy(now[2]); const d = S.p.clone().sub(P.pos).setY(0), l = d.length(); if (l > 0.05) { P.yaw += angDiff(P.yaw, Math.atan2(d.x, d.z)) * (1 - Math.exp(-14 * dt)); P.pos.addScaledVector(d.divideScalar(l), clamp(l - 0.55, -0.3, 0.8) * Math.min(1, dt * 9)); collide(P.pos, 0.28); } }
    if (A.target && !A.target.dead && a < A.hitA) {
      const d = A.target.chestPos().sub(P.pos).setY(0), l = d.length();
      if (l > 0.05) { P.yaw += angDiff(P.yaw, Math.atan2(d.x, d.z)) * (1 - Math.exp(-18 * dt)); const ideal = A.kind === 'kick' ? 0.95 : (A.target.standing ? 1.3 : 1.05); P.pos.addScaledVector(d.divideScalar(l), clamp(l - ideal, -0.4, A.kind === 'heavy' ? 1.3 : 0.9) * Math.min(1, dt * (a > A.strikeA - 0.16 ? 13 : 7))); collide(P.pos, 0.28); }
    }
    if (!A.whoosh && a > A.strikeA) { A.whoosh = true; if (A.kind !== 'kick' && A.kind !== 'stomp') SND.swing(P.pos, A.kind === 'heavy'); }
    if (!A.hit && a > A.hitA) { A.hit = true; strike(A.kind); }
    if (a >= 1) P.atk = null;
  }
  // torch battery
  if (P.torchOn) { P.battery -= 4.5 * dt; if (P.battery <= 0) { P.battery = 0; P.torchOn = false; toast('手电没电了'); } }
  P.spot.intensity = damp(P.spot.intensity, P.torchOn ? 7 : 0, 20, dt);
  P.tlens.material.emissiveIntensity = P.torchOn ? 6 : 0; P.tbeam.material.uniforms.intensity.value = P.torchOn ? 0.1 : 0; P.tbeam.visible = P.torchOn;
  // pinned: mash to break it; adrenaline puts weight behind it
  if (P.state === 'pinned') {
    P.struggle = Math.max(0, P.struggle - 0.28 * dt);
    if (P.ai && Math.random() < dt * 4.5) { P.struggle += 0.12 * (1 + 0.8 * P.adr) * (P.stamina > 4 ? 1 : 0.7) * (P.pinnedBy && P.pinnedBy.arms < 2 ? 1.4 : 1); P.stamina = Math.max(0, P.stamina - 2); } // on its own it fights too
    $('qteBar').style.width = (P.struggle * 100).toFixed(0) + '%';
    if (Math.floor(P.st * 1.6) !== Math.floor((P.st - dt) * 1.6)) SND.heartbeat(0.7);
    if (P.struggle >= 1) { releasePin(P.pinnedBy, false); spend(20); }
    else if (P.st > 3.5) {
      const e = P.pinnedBy;
      if (e.canBite()) bitten(e);
      else { P.st = 0.6; if (e.roarT <= 0) roar(e, 'help'); if (!P.jawNote) { P.jawNote = true; toast('它的下巴碎了，咬不下来——可它死死压着你，在嚎叫同伴', 3.2); } }
    }
  }
  // pose
  let pose = walkPose(P.ph, clamp(sp / 2.25, 0, 1), clamp((sp - 2.6) / 1.4, 0, 1), spG, P.h.s);
  Object.assign(pose, { shRx: (pose.shRx || 0) * 0.55 - 0.32, elR: 0.75, shRz: -0.1, shLx: (pose.shLx || 0) * 0.4 - 0.3, elL: 1.0, shLz: 0.14 });
  if (P.crouch) Object.assign(pose, { knL: (pose.knL || 0) + 0.75, knR: (pose.knR || 0) + 0.75, hipLx: (pose.hipLx || 0) - 0.5, hipRx: (pose.hipRx || 0) - 0.5, pelY: -0.22, spX: (pose.spX || 0) + 0.38, headX: -0.25 });
  if (P.carrying) Object.assign(pose, { shLx: -0.62, shLz: 0.42, elL: 1.85 });
  if (fd > 0.02 && !P.atk) { const br = Math.sin(G.t * lerp(4, 9, fd)); Object.assign(pose, { spX: (pose.spX || 0) + 0.3 * fd + br * 0.035 * fd, headX: (pose.headX || 0) + 0.25 * fd, shRx: pose.shRx * (1 - 0.6 * fd) + 0.1 * fd, elR: pose.elR * (1 - 0.5 * fd), shLx: pose.shLx * (1 - 0.4 * fd), knL: (pose.knL || 0) + 0.12 * fd, knR: (pose.knR || 0) + 0.12 * fd, chX: br * 0.04 * fd }); }
  if (P.charging && P.chargeT > 0.14 && !P.atk) { Object.assign(pose, deform(heavyPose(0.45 * clamp((P.chargeT - 0.14) / 0.3, 0, 1)), fd)); pose.shRx += Math.sin(G.t * 40) * 0.02 * (1 + 3 * fd); }
  if (P.atk) { const a = P.atk.t / P.atk.dur, K = P.atk.kind; Object.assign(pose, deform(K === 'heavy' ? heavyPose(a) : K === 'kick' ? kickPose(a) : K === 'stomp' ? stompPose(a) : quickPose(a), P.atk.f)); if (P.atk.low && K !== 'kick' && K !== 'stomp') Object.assign(pose, { knL: (pose.knL || 0) + 0.7, knR: (pose.knR || 0) + 0.6, pelY: -0.22, spX: (pose.spX || 0) + 0.35 }); }
  if (P.state === 'dodge') { const k = Math.sin(clamp(P.st / 0.42, 0, 1) * Math.PI); Object.assign(pose, { spX: 0.6 * k, knL: 1.0 * k, knR: 1.2 * k, hipLx: -0.6 * k, hipRx: -0.2 * k, pelY: -0.3 * k, headX: 0.2 * k, shLx: -0.8 * k, shRx: -0.6 * k }); }
  if (P.state === 'clinch') { const b = Math.sin(G.t * 9); Object.assign(pose, { shLx: -1.3, shRx: -1.25, elL: 0.9 + b * 0.1, elR: 0.85, spX: -0.25, headX: -0.3, headY: -b * 0.2, knL: 0.25, knR: 0.35, hipLx: 0.25 }); }
  if (P.state === 'takedown' && P.td) {
    if (P.td.kind === 'stealth') { const a = P.st; Object.assign(pose, { shLx: -1.5, shLz: -0.5, elL: 1.75, spX: 0.2, knL: 0.2, knR: 0.25 }, a < 0.45 ? { shRx: -1.9, elR: 1.8 } : a < 0.62 ? { shRx: -1.3, elR: 0.4, chY: -0.2 } : { shRx: -1.0 * (1 - smooth(0.9, 1.4, a)), elR: 0.6 }); }
    else { const a = P.st; Object.assign(pose, { knL: 1.4, knR: 1.1, hipLx: -1.2, hipRx: -0.4, pelY: -0.45, spX: 0.75, headX: 0.4, shLx: -0.6, elL: 0.8 }, a < 0.4 ? { shRx: -1.8, elR: 1.4 } : { shRx: -0.5, elR: 0.3 }); }
  }
  if (P.state === 'down') { const k = 1 - smooth(1.3, 1.9, P.st); Object.assign(pose, { bodyX: -1.45 * k, bodyY: 0.15 * k, shLz: 0.9 * k, shRz: -0.7 * k, shLx: -0.4 * k, elL: 0.6, elR: 0.5, knL: 0.5 * k + 0.6 * (1 - k) * Math.sin(k * Math.PI), knR: 0.3 * k, headX: -0.25 * k, spX: 0.5 * Math.sin(k * Math.PI) }); }
  if (P.state === 'work') { const s = Math.sin(P.st * 17); Object.assign(pose, { shRx: -1.7 + s * 0.45, elR: 1.2 - s * 0.4, shLx: -1.35, elL: 0.6, spX: 0.1, headX: 0.15 }); }
  if (P.state === 'stagger') { const k = 1 - smooth(0.2, 0.45, P.st); Object.assign(pose, { spX: -0.35 * k, headX: -0.3 * k, shLx: -0.8 * k, shRx: -0.5 * k, shLz: 0.6 * k, shRz: -0.5 * k, knL: 0.3 * k, hipLx: 0.3 * k }); }
  if (P.state === 'pinned') Object.assign(pose, { bodyX: -1.05, bodyY: 0.18, shLx: -2.1, shRx: -2.0, shLz: 0.3, shRz: -0.3, elL: 0.6 + Math.sin(G.t * 19) * 0.15, elR: 0.7, hipLx: -0.9, hipRx: -0.3, knL: 1.1, knR: 0.5, headX: -0.3 + Math.sin(G.t * 13) * 0.1 });
  if (P.dead) Object.assign(pose, { bodyX: -1.5, bodyY: 0.16, shLz: 1.0, shRz: -0.9, elL: 0.4, elR: 0.6, headY: 0.7, knL: 0.3 });
  springStep(h, dt);
  poseTo(h, pose, P.state === 'dodge' ? 20 : (P.atk ? 22 : 13), dt);
  h.root.position.copy(P.pos); h.root.rotation.y = P.yaw;
  // scarf tail
  const tail = h.o._scarf; if (tail) tail.forEach((seg, i) => { const target = clamp(sp * 0.28, 0, 1.0) * (i ? 0.35 : 1) + (P.indoor ? 0 : Math.sin(G.t * 6 + i * 1.3) * 0.12 * (0.5 + G.rain * 0.5)); seg.rotation.x = damp(seg.rotation.x, target, 10, dt); seg.rotation.z = damp(seg.rotation.z, Math.sin(G.t * 4 + i) * 0.08, 6, dt); });
  // lantern pendulum (stays upright, swings with acceleration); V throws a cloth over it
  const acc = P.vel.clone().sub(P.prevVel).divideScalar(Math.max(dt, 1e-3)); P.prevVel.copy(P.vel);
  const S = P.swing, lx = acc.x * Math.cos(P.yaw) - acc.z * Math.sin(P.yaw), lz = acc.x * Math.sin(P.yaw) + acc.z * Math.cos(P.yaw);
  S.vx += (-30 * Math.sin(S.ax) - 3 * S.vx - lz * 0.9) * dt; S.ax += S.vx * dt; S.vz += (-30 * Math.sin(S.az) - 3 * S.vz + lx * 0.9) * dt; S.az += S.vz * dt;
  const q = new THREE.Quaternion(); P.lantern.parent.getWorldQuaternion(q); q.invert();
  P.lantern.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(S.ax, P.yaw, S.az, 'YXZ')));
  const L = P.lantern.userData, fl = 1 + Math.sin(G.t * 13) * 0.05 + Math.sin(G.t * 31) * 0.04 + (Math.random() - 0.5) * 0.05;
  L.light.intensity = damp(L.light.intensity, (P.shutter ? 0.06 : 1.2) * fl, 12, dt); L.flame.scale.set(1, 2 * fl, 1); L.glow.material.opacity = P.shutter ? 0.05 : 0.75 * fl;
}
