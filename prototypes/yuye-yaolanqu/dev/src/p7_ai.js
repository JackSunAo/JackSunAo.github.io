/* ===== P7 infected: senses (sight, hearing), roar signals, squad tactics, physical hit reactions, wounds ===== */
const INF = {
  butcher: { name: '屠夫', height: 1.8, girth: 1.5, skin: '#b9937c', top: '#6d6658', bottom: '#2b2825', hair: '#3a2e25', hairStyle: 'sparse', apron: true, weight: 125, gait: { sway: 1.9, lift: 0.55, arm: 0.3, wide: 0.8 }, stab: 1.6, skull: 120, limb: 70, speed: 2.1, seed: 31, smart: 0.5, voice: 0.78, lightSens: 1, hesitate: 4.0 },
  student: { name: '学生 · 原发型', height: 1.6, girth: 0.82, skin: '#c7a48c', top: '#273250', coat: '#273250', collar: '#d7d7d0', tie: '#7a2a2a', bottom: '#273250', hair: '#120c09', hairStyle: 'messy', backpack: '#7a3b2e', weight: 52, gait: { lift: 1.3, arm: 0.6, lean: 0.1 }, stab: 0.72, skull: 70, limb: 42, speed: 3.3, seed: 41, smart: 0.2, voice: 1.3, feral: true, lightSens: 0.15, hesitate: 0 },
  fireman: { name: '消防员', height: 1.82, girth: 1.18, skin: '#c29a80', top: '#3a3a30', coat: '#3a3a30', bottom: '#33322a', shoes: '#1a1714', hair: '#1a120c', hairStyle: 'short', helmet: '#8a6a22', stripes: true, weight: 92, gait: { sway: 1.3, arm: 0.35, lift: 0.8, wide: 0.3 }, stab: 1.25, skull: 105, limb: 62, speed: 2.35, seed: 61, smart: 0.6, voice: 0.86, lightSens: 1, hesitate: 3.0, axe: true },
  office: { name: '白领', height: 1.74, girth: 1.0, skin: '#c9a084', top: '#c9ccd0', tie: '#2b3340', lanyard: true, bottom: '#1f2226', hair: '#2a1f17', hairStyle: 'short', weight: 76, gait: { arm: 0.55, lift: 0.9 }, stab: 1.0, skull: 90, limb: 55, speed: 2.7, seed: 51, smart: 0.9, voice: 1.0, lightSens: 1, hesitate: 2.2 }
};
/* everyone else the night took: mostly young women and men in whatever they were wearing when it found them. The virus
   picks its hosts: an old body bitten bleeds out or gives up before the virus can take it, so there are no old ones here.
   Each wears one of four ways of moving; looks vary a little from one to the next (skin, hair, which seed of cloth) */
const INF_TPL = {
  walker: { weight: 56, stab: 0.8, skull: 72, limb: 46, speed: 2.6, smart: 0.45, voice: 1.35, lightSens: 0.9, hesitate: 2.0 },
  runner: { weight: 54, stab: 0.75, skull: 70, limb: 44, speed: 3.1, smart: 0.3, voice: 1.42, lightSens: 0.45, hesitate: 0.6 },
  smart: { weight: 58, stab: 0.85, skull: 75, limb: 48, speed: 2.7, smart: 0.85, voice: 1.3, lightSens: 1, hesitate: 2.2 },
  heavy: { weight: 96, stab: 1.35, skull: 100, limb: 64, speed: 2.25, smart: 0.5, voice: 0.85, lightSens: 1, hesitate: 3.2 }
};
const SHE = { female: true, height: 1.65, girth: 0.87, gait: { sway: 1.35, wide: -0.15, arm: 0.7 } };
const INF_CIV = {
  nurse: ['walker', SHE, { name: '护士', height: 1.63, skin: '#d8b49c', top: '#e6eae8', skirt: '#e6eae8', skirtLen: 'knee', legs: '#ebe6dc', shoes: '#ece8e0', shoeStyle: 'flats', hair: '#1c130d', hairStyle: 'bun', nurseCap: true, lanyard: true, seed: 81 }],
  station: ['smart', SHE, { name: '地铁站务员', height: 1.66, skin: '#d2ad94', top: '#2a3552', coat: '#2a3552', collar: '#e8e8e2', scarf: '#a8323a', skirt: '#28324c', skirtLen: 'knee', legs: '#2a2a30', shoes: '#141414', shoeStyle: 'flats', hair: '#120c09', hairStyle: 'bun', cap: '#2a3552', seed: 83 }],
  clerk: ['runner', SHE, { name: '制服职员', height: 1.69, girth: 0.86, skin: '#dcb8a0', top: '#2b2e38', coat: '#2b2e38', collar: '#ecebe6', skirt: '#23252d', skirtLen: 'knee', legs: '#18181c', shoes: '#121214', shoeStyle: 'heels', hair: '#100b08', hairStyle: 'long', lip: '#a3343e', stab: 0.65, seed: 85, gait: { sway: 1.5, wide: -0.2, arm: 0.5, lift: 0.75, limp: true } }], // one heel snapped off on the way here
  officeF: ['smart', SHE, { name: '白领', height: 1.65, skin: '#dfbea6', top: '#e9e6ea', skirt: '#4a4c55', skirtLen: 'knee', legs: '#c39f88', shoes: '#3a2622', shoeStyle: 'heels', hair: '#2a1a12', hairStyle: 'bob', lanyard: true, stab: 0.72, seed: 87 }],
  waitress: ['walker', SHE, { name: '服务员', height: 1.62, skin: '#d6b097', top: '#1e1c1e', skirt: '#1e1c1e', skirtLen: 'knee', apron: true, apronCol: '#e8e4dc', legs: '#1a1a1d', shoes: '#151515', shoeStyle: 'flats', hair: '#22160e', hairStyle: 'ponytail', seed: 89 }],
  trainer: ['runner', SHE, { name: '健身教练', height: 1.68, girth: 0.88, skin: '#cf9f80', top: '#2f7f8c', sleeves: 'short', bottom: '#1d1e24', shoes: '#e4e4e4', shoeStyle: 'flats', hair: '#1a120c', hairStyle: 'ponytail', speed: 3.4, seed: 91 }],
  schoolgirl: ['runner', SHE, { name: '女学生', height: 1.6, girth: 0.82, skin: '#d9b9a2', top: '#f0f0ec', coat: '#283250', tie: '#7a2a2a', skirt: '#2f3550', skirtLen: 'knee', legs: '#efece5', shoes: '#1a1412', shoeStyle: 'flats', hair: '#100b08', hairStyle: 'ponytail', backpack: '#c7a37a', seed: 93 }],
  police: ['smart', SHE, { name: '女警', height: 1.7, girth: 0.9, skin: '#d0a98e', top: '#25324a', bottom: '#1f2636', shoes: '#121212', shoeStyle: 'boots', cap: '#1f2840', hair: '#140e0a', hairStyle: 'bun', stab: 0.95, seed: 95 }],
  doctor: ['smart', SHE, { name: '医生', height: 1.67, skin: '#dcb8a2', top: '#7f98a8', coat: '#eceeec', bottom: '#7f98a8', shoes: '#e8e8e8', shoeStyle: 'flats', hair: '#2a1c14', hairStyle: 'bob', lanyard: true, seed: 97 }],
  barista: ['walker', SHE, { name: '咖啡店员', height: 1.63, skin: '#d4ab90', top: '#f0eee8', bottom: '#34405a', apron: true, apronCol: '#2f5a44', shoes: '#e6e6e6', shoeStyle: 'flats', hair: '#5a3a22', hairStyle: 'ponytail', seed: 99 }],
  biker: ['runner', SHE, { name: '机车女孩', height: 1.7, girth: 0.88, skin: '#d6b29a', top: '#3a3a40', coat: '#1c1a1a', bottom: '#2a3550', shoes: '#151313', shoeStyle: 'tall', hair: '#3a2416', hairStyle: 'long', lip: '#7a2a32', seed: 101 }],
  bride: ['walker', SHE, { name: '新娘', height: 1.64, skin: '#e0c0aa', top: '#f3f1ec', skirt: '#f3f1ec', shoes: '#efece6', shoeStyle: 'heels', hair: '#1a120c', hairStyle: 'long', lip: '#b23a44', seed: 103 }],
  chef: ['heavy', { name: '厨师', height: 1.76, girth: 1.3, skin: '#c49a7e', top: '#efefea', bottom: '#3a3a3a', apron: true, apronCol: '#e8e4dc', cap: '#efefea', hair: '#1c140e', hairStyle: 'short', seed: 105 }],
  rider: ['runner', { name: '外卖骑手', height: 1.74, girth: 1.0, skin: '#c08f70', top: '#e2b322', coat: '#e2b322', bottom: '#2a2a2e', cap: '#e2b322', backpack: '#e2b322', hair: '#120c09', hairStyle: 'messy', voice: 1.0, seed: 107 }],
  worker: ['walker', { name: '地铁检修工', height: 1.75, girth: 1.1, skin: '#b98a6c', top: '#2b3448', vest: '#e0662a', stripes: true, bottom: '#2b3448', cap: '#2b3448', hair: '#2a231d', hairStyle: 'short', voice: 0.92, weight: 84, stab: 1.1, seed: 109 }]
};
for (const [k, [tpl, ...looks]] of Object.entries(INF_CIV)) INF[k] = Object.assign({ civ: true }, INF_TPL[tpl], ...looks, { tpl });
// a little of each body's own: skin a shade lighter or darker, one of a few cloth seeds (so canvases are shared, not endless)
const SKINS_F = ['#e2c2ac', '#d8b49c', '#cfa58a', '#c4967a', '#b98a6e'], HAIRS = ['#100b08', '#1c130d', '#2a1a12', '#3a2416', '#5a3a22', '#6a4a30'];
function civVariant(T) { if (!T.civ) return null; const i = Math.floor(Math.random() * 3);
  return { seed: T.seed + i * 211, skin: T.female ? SKINS_F[(SKINS_F.indexOf(T.skin) + i + 5) % 5] || T.skin : T.skin, hair: i === 2 && T.female ? HAIRS[(T.seed + i) % HAIRS.length] : T.hair }; }
// who comes in a wave: the same for the pool that builds it ahead and the wave that calls it
function waveTypes(w) {
  const R = rng(w * 7919 + 13), n = Math.min(10, 4 + 2 * (w - 1)), civ = Object.keys(INF).filter(k => INF[k].civ), out = ['office'];
  if (w >= 2) out.push('fireman'); if (w % 2 === 1 || w >= 4) out.push('butcher'); if (R() < 0.7) out.push('student');
  while (out.length < n) out.push(civ[Math.floor(R() * civ.length)]);
  return out.slice(0, n);
}
// the dark ring around the floodlight where they lurk
const SAFE = [];
const floodConeFull = floodCone;
for (let i = 0; i < 180; i++) {
  const a = i / 180 * Math.PI * 2, d = dirA(a); let r = 3.5, ok = false;
  for (; r < 15; r += 0.25) { const p = LURK_C.clone().addScaledVector(d, r); if (p.z < 6.0 && Math.abs(p.x) < 4.8) continue; if (!floodConeFull(p)) { ok = true; break; } }
  SAFE.push(ok ? r : -1);
}
const safeR = a => SAFE[((Math.round(a / (Math.PI * 2) * 180) % 180) + 180) % 180];
const infected = [];

/* ---------------- squad: one attacker per prey at a time, the leader gives orders ---------------- */
const SQUAD = { leader: null, turn: new Set(), tokenCD: 0, flankT: -99, retreatT: -99, spotT: -99 };
const ROAR = {
  spot: { text: '嘶吼：发现猎物', r: 22 }, flank: { text: '低吼：包抄', r: 18 }, wail: { text: '哀嚎：同伴倒下', r: 20 },
  rally: { text: '长嚎：灯灭了，围上去', r: 30 }, retreat: { text: '嘶声：撤', r: 24 }, help: { text: '嘶吼：按住了，快来咬', r: 22 }, breach: { text: '嘶吼：', r: 26 }
};
const HUNT = ['stalk', 'windup', 'lunge', 'recover', 'pinning'];
const GROUNDED = ['down', 'getup', 'dead', 'crawl', 'ko'];
function releaseToken() { SQUAD.tokenCD = Math.max(SQUAD.tokenCD, rnd(0.45, 0.85)); }
function attackersBusy(q) { let n = 0; for (const e of infected) if (!e.dead && (!q || e.tgt === q) && (e.state === 'windup' || e.state === 'lunge' || e.state === 'pinning' || e.state === 'axeWind' || e.state === 'axeSwing' || e.state === 'grab')) n++; return n; }
function squadThink(dt) {
  SQUAD.tokenCD -= dt;
  let lead = null; for (const e of infected) if (!e.dead && e.standing && (!lead || e.T.smart > lead.T.smart)) lead = e; SQUAD.leader = lead;
  siegeThink();
  SQUAD.turn.clear();
  const prey = PREY.filter(q => !q.dead);
  if (P.dead || SQUAD.tokenCD > 0 || attackersBusy() >= (floodOff() ? 2 : 1) + Math.max(0, prey.length - 1)) return;
  // every prey gets at most one mouth coming at it (two at you in the dark); the one at its back goes first
  for (const q of prey) {
    if (q.state === 'pinned' || attackersBusy(q) >= (q.isPlayer && floodOff() ? 2 : 1)) continue;
    let best = null, bs = 1e9; const pf = fwdOf(q.yaw);
    for (const e of infected) {
      if (e.dead || e.state !== 'stalk' || e.cool > 0 || e.tgt !== q) continue; const d = e.pos.distanceTo(q.pos); if (d > 6) continue;
      const front = pf.dot(e.pos.clone().sub(q.pos).setY(0).normalize()); // -1 = behind the prey's back: preferred
      const s = d + front * 0.6 - (e.rage > 0 ? 1 : 0); if (s < bs) { bs = s; best = e; }
    }
    if (best) SQUAD.turn.add(best);
  }
}
/* ---------------- siege: when you're behind walls they look for the weak point ---------------- */
const SIEGE = { on: false, t0: 0, scoutDone: false, known: {}, defended: {}, lastPlanT: -99, wasOpen: {} };
function siegeThink() {
  const want = !P.dead && G.mode === 'play' && PREY.some(q => !q.dead && q.indoor) && (G.playT > 40 || infected.some(e => !e.dead && e.provoked)) && infected.some(e => !e.dead && e.aware > 0.6);
  if (!want) { if (SIEGE.on && G.mode === 'play') { SIEGE.on = false; for (const e of infected) e.entry = null; } return; }
  if (!SIEGE.on) {
    Object.assign(SIEGE, { on: true, t0: G.t, scoutDone: false, known: {}, defended: {}, lastPlanT: -99, wasOpen: {} });
    const L = SQUAD.leader, busy = e => HUNT.includes(e.state) && e.tgt && !e.tgt.dead && !e.tgt.indoor; // already on someone out in the yard
    for (const e of infected) { if (e.dead || e.inside() || busy(e)) continue; e.entry = null; if (e.standing && e.state !== 'climb') e.setState('siege'); }
    if (L && !L.dead && L.standing && !L.inside() && !busy(L)) { L.scoutList = ENTRIES.filter(en => en.kind === 'door' || !L.crawler).sort((a, b) => a.out.distanceTo(L.pos) - b.out.distanceTo(L.pos)).slice(0, 2); L.scoutT = 0; L.scoutTested = false; L.setState('scout'); }
    else { SIEGE.scoutDone = true; }
  }
  for (const en of ENTRIES) for (const q of PREY) if (!q.dead && q.pos.distanceTo(en.in) < 1.7) SIEGE.defended[en.id] = G.t; // someone waiting just inside it
  let opened = null; for (const en of ENTRIES) { const o = entryOpen(en) || (en.kind === 'door' && door.crawl); if (o && !SIEGE.wasOpen[en.id]) opened = en; SIEGE.wasOpen[en.id] = o; }
  if (SIEGE.scoutDone && !SIEGE.lock && (G.t - SIEGE.lastPlanT > 6 || opened)) planSiege(opened);
}
function entryCost(en, e) {
  const def = G.t - (SIEGE.defended[en.id] || -99) < 5 ? 2.5 : 0, known = SIEGE.known[en.id] || (e && e.entry === en && e.state === 'work');
  if (en.kind === 'door') {
    if (entryOpen(en)) return def;
    if (door.crawl) return 0.8 + def;
    if (!known) return (e && e.hasAxe ? 1.5 : 5) + def;
    if (!door.barred) return 1.2 + def;
    if (e && e.hasAxe) return 1.0 + def; // the one job only it can do
    if (door.reach && e && e.arms >= 1) return 2.2 + def;
    return (e && e.type === 'butcher' ? 8 : 13) + def;
  }
  if (e && e.crawler) return 99;
  if (!known) return 3 + def;
  let c = 0.5 + (en.glass ? 0.8 : 0); for (const b of en.boards) if (b.hp > 0) c += 2.4 * b.hp * (e && e.type === 'butcher' ? 0.6 : 1);
  return c + def;
}
function planSiege(opened) {
  SIEGE.lastPlanT = G.t; const crew = infected.filter(o => !o.dead && !o.inside() && (o.state === 'siege' || o.state === 'work' || o.state === 'scout'));
  const load = {}; let best = null, bestC = 1e9;
  for (const e of crew.sort((a, b) => (b.hasAxe ? 1 : 0) - (a.hasAxe ? 1 : 0))) {
    let pick = null, pc = 1e9;
    for (const en of ENTRIES) { const c = entryCost(en, e) + (load[en.id] || 0) * (en.kind === 'door' ? 1.2 : 2.2) + (e.entry === en ? -0.6 : 0); if (c < pc) { pc = c; pick = en; } }
    if (e.entry !== pick && e.state === 'work') e.setState('siege');
    e.entry = pick; e.slotN = load[pick.id] || 0; load[pick.id] = (load[pick.id] || 0) + 1;
    if (pc < bestC) { bestC = pc; best = pick; }
  }
  const caller = opened ? crew.find(o => o.entry === opened) || SQUAD.leader : SQUAD.leader;
  if (caller && !caller.dead && best && caller.roarT <= 0 && caller.standing) {
    const how = entryOpen(best) ? '开了，进去' : best.kind === 'door' ? (door.crawl ? '有洞，钻进去' : door.barred ? (crew.some(o => o.hasAxe) ? '，劈开它' : '，撞开它') : '，推开') : (best.glass ? '，砸玻璃' : '，扒木板');
    roar(caller, 'breach', null, best.name + how);
  }
}
// two hands on the shaft: up, down into the wood, wrench it free
function chopPose(a) {
  if (a < 0.5) { const k = smooth(0, 0.5, a); return { shRx: -2.9 * k, shLx: -2.6 * k, elR: 0.3 + 0.5 * k, elL: 0.4 + 0.6 * k, spX: -0.25 * k, headX: -0.2 * k, knL: 0.15 * k }; }
  if (a < 0.66) { const k = smooth(0.5, 0.66, a); return { shRx: -2.9 + 1.7 * k, shLx: -2.6 + 1.5 * k, elR: 0.8 - 0.6 * k, elL: 1.0 - 0.7 * k, spX: -0.25 + 0.75 * k, headX: -0.2 + 0.3 * k, knL: 0.15 + 0.2 * k, knR: 0.2 * k }; }
  const k = smooth(0.66, 1, a); return { shRx: -1.2 - 0.3 * Math.sin(k * Math.PI), shLx: -1.1 * (1 - k), elR: 0.2 + 0.4 * k, elL: 0.3 + 0.5 * k, spX: 0.5 * (1 - k) + 0.1, knL: 0.35 * (1 - k), knR: 0.2 * (1 - k), chY: -0.3 * Math.sin(k * Math.PI) };
}
// over a sill: hands down, a knee up, the body over, a drop inside
function climbPose(k, low) {
  if (low) { const s = Math.sin(k * 14); return { bodyX: 1.25, spX: -0.2, headX: -0.8, shLx: -2.6 + s * 0.5, shRx: -2.6 - s * 0.5, elL: 0.6, elR: 0.6, hipLx: 0.2 + s * 0.3, hipRx: 0.2 - s * 0.3, knL: 0.6, knR: 0.6 }; }
  if (k < 0.35) { const u = smooth(0, 0.35, k); return { shLx: -1.4 + 0.9 * u, shRx: -1.4 + 0.9 * u, elL: 0.9 - 0.6 * u, elR: 0.9 - 0.6 * u, spX: 0.7, headX: -0.3, hipLx: -1.3 * u, knL: 1.7 * u, hipRx: -0.2 * u, knR: 0.3 }; }
  if (k < 0.75) { const u = smooth(0.35, 0.75, k); return { bodyX: 0.55 * Math.sin(u * Math.PI), spX: 0.8, headX: -0.5, shLx: -1.0 - 0.6 * u, shRx: -1.1 - 0.5 * u, elL: 0.4, elR: 0.4, hipLx: -1.4 + 0.6 * u, knL: 1.4, hipRx: -0.3 - 1.0 * u, knR: 1.2 * u }; }
  const u = smooth(0.75, 1, k); return { spX: 0.5 * (1 - u) + 0.2, headX: -0.3, shLx: -0.8 * (1 - u), shRx: -0.8 * (1 - u), shLz: 0.5, shRz: -0.5, elL: 0.5, elR: 0.5, hipLx: -0.8 * (1 - u), knL: 0.9 - 0.5 * u, hipRx: -0.6 * (1 - u), knR: 0.9 - 0.5 * u, pelY: -0.2 * (1 - u) };
}

function roar(e, type, slots, text) {
  const R = ROAR[type]; e.roarT = e.roarDur = type === 'rally' ? 1.7 : type === 'flank' ? 0.8 : 1.1;
  SND.roar(e.pos, type, e.T.voice); spawnRing(e.pos, R.r, 'roar');
  floatLabel('【' + (text ? '嘶吼：' + text : R.text) + '】', e.headPos(), 'roar', 2.4);
  if (!P.dead && e.pos.distanceTo(P.pos) < 14) P.adr = Math.min(1, P.adr + 0.12);
  for (const d of defenders) if (!d.dead && d.pos.distanceTo(e.pos) < 14) d.shaken(type === 'rally' || type === 'help' ? 0.05 : 0.025); // your people hear it too
  for (const o of infected) {
    if (o === e || o.dead) continue; const d = o.pos.distanceTo(e.pos); if (d > R.r) continue;
    o.inbox.push({ type, from: e, at: G.t + 0.3 + d * 0.035 + rnd(0, 0.25), where: e.lastKnown.clone(), slot: slots ? slots.get(o) : undefined });
  }
}
/* hearing: everything loud you do goes out as a noise event */
function makeNoise(pos, radius, kind) {
  const r = radius * (1 - 0.22 * G.rain);
  for (const e of infected) {
    if (e.dead) continue; let d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
    if (insideCabin(pos.x, pos.z) !== insideCabin(e.pos.x, e.pos.z)) d *= 1.7;
    if (d < r) e.hear(pos, 1 - d / r, radius);
  }
  if (radius >= 5 && G.mode === 'play') spawnRing(pos, r, 'noise');
}
/* sight: the cabin blocks it (except through the door), bushes thin it out */
const CABIN_BOX = { x0: -3.75, x1: 3.75, z0: -3.3, z1: 3.25 };
function segHitsBox(ax, az, bx, bz, b) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, b.x0, b.x1], [az, dz, b.z0, b.z1]]) {
    if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) return false; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) { const s = ta; ta = tb; tb = s; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false;
  }
  return true;
}
function distSeg(px, pz, a, b) { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = clamp(((px - a.x) * dx + (pz - a.z) * dz) / l2, 0, 1); return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t)); }
function sightLine(a, b) {
  const inA = insideCabin(a.x, a.z), inB = insideCabin(b.x, b.z);
  if (inA !== inB) {
    const o = inA ? b : a, i = inA ? a : b, vis = w => (w.glass ? 0.75 : 1) * [1, 0.55, 0.3, 0.15][w.boards.filter(x => x.hp > 0).length];
    if (o.z > 3.1) { const t = (3.1 - o.z) / (i.z - o.z), x = o.x + (i.x - o.x) * t; if (Math.abs(x) < 0.5) return door.fallen || door.fall || door.ang > 0.5 ? 1 : Math.min(0.6, door.holes * 0.12); }
    if (o.z < -3.1) { const t = (-3.1 - o.z) / (i.z - o.z), x = o.x + (i.x - o.x) * t; if (x > -1.6 && x < -0.4) return vis(winBack); }
    if (o.x < -3.6) { const t = (-3.6 - o.x) / (i.x - o.x), z = o.z + (i.z - o.z) * t; if (z > 1.05 && z < 2.15) return vis(winLeft); }
    return 0;
  }
  if (inA) return 1;
  if (segHitsBox(a.x, a.z, b.x, b.z, CABIN_BOX)) return 0;
  let k = 1; for (const [bx, bz] of bushes) if (distSeg(bx, bz, a, b) < 0.75) k *= 0.5; return k;
}
const _eye = new V3(), _tg = new V3();

class Infected {
  constructor(type, ang, pooled) {
    const T = this.T = INF[type]; this.type = type; this.vari = civVariant(T);
    this.vel = new V3(); this.lastKnown = new V3(); this.lungeT = new V3(); this.fleeTo = new V3(); this.inbox = [];
    this.h = null; this.dirty = true; this.home = ang;
    const bar = document.createElement('div'); bar.className = 'ebar';
    bar.innerHTML = '<span class="eicon"></span><div class="erow"><svg class="doll" viewBox="0 0 26 42" width="20" height="32" aria-hidden="true">'
      + '<circle class="d-head" cx="13" cy="5.5" r="4.3"/><rect class="d-torso" x="9" y="10.6" width="8" height="12.6" rx="2"/>'
      + '<rect class="d-armR" x="4.4" y="11" width="3.3" height="12.6" rx="1.6"/><rect class="d-armL" x="18.3" y="11" width="3.3" height="12.6" rx="1.6"/>'
      + '<rect class="d-legR" x="9" y="24.2" width="3.7" height="16" rx="1.7"/><rect class="d-legL" x="13.3" y="24.2" width="3.7" height="16" rx="1.7"/></svg>'
      + '<div class="ecol"><span class="ename"></span><span class="estat"></span><i class="blood"><b></b></i><i class="bal"><b></b></i></div></div>';
    $('labels').appendChild(bar); this.nameEl = bar.querySelector('.ename'); this.nameEl.textContent = T.name; this.shownName = T.name;
    this.bar = bar; this.statEl = bar.querySelector('.estat'); this.barBlood = bar.querySelector('.blood b'); this.barBal = bar.querySelector('.bal b'); this.icon = bar.querySelector('.eicon');
    this.doll = {}; ['head', 'torso', 'armL', 'armR', 'legL', 'legR'].forEach(k => { this.doll[k] = bar.querySelector('.d-' + k); });
    const ar = document.createElement('div'); ar.className = 'threat'; $('threats').appendChild(ar); this.arrow = ar;
    this.reset(); if (pooled) this.h.root.visible = false; else infected.push(this); // a pooled one waits off stage until a wave calls it
  }
  rebuild() {
    if (this.h) { scene.remove(this.h.root); disposeTree(this.h.root); }
    this.h = makeHuman(Object.assign({ infected: true, blood: true, topWear: 0.85, bottomWear: 0.8 }, this.T, this.vari)); scene.add(this.h.root);
    initSprings(this.h); this.mats = collectMats(this.h); this.dirty = false;
    if (this.T.axe) { this.axe = makeAxe(); this.h.armR.hand.add(this.axe); this.axe.position.set(0, -0.05, 0.01); this.axe.rotation.set(0.32, 0, 0); }
  }
  reset(far) {
    if (this.dirty) this.rebuild();
    const T = this.T; this.ang = this.home; const r = Math.max(4, safeR(this.ang)) + (far ? 9 : 1.5);
    this.pos = LURK_C.clone().addScaledVector(dirA(this.ang), r); this.pos.y = GROUND_Y; this.vel.set(0, 0, 0);
    this.yaw = this.ang + Math.PI; this.state = 'lurk'; this.st = 0; this.ph = rnd(0, 6); this.angVel = (Math.random() < 0.5 ? -1 : 1) * rnd(0.05, 0.11);
    this.body = { skull: T.skull, jaw: true, blood: 100, bleed: 0, art: 0, arteries: {}, arm: { L: 'ok', R: 'ok' }, armHp: { L: T.limb, R: T.limb }, leg: { L: 'ok', R: 'ok' }, legHp: { L: T.limb * 1.2, R: T.limb * 1.2 } };
    this.bal = 1; this.balT = 0; this.cool = rnd(1, 3); this.barT = 0; this.daze = 0; this.frenzy = 0; this.crackNote = false; this.dollKey = ''; this.ko = false; this.quietFall = false; this.tdLimp = false; this.paleK = 0;
    this.adapt = 0; this.wasLit = false; this.shielding = false; this.hesT = 0;
    this.voiceT = rnd(4, 10); this.dead = false; this.mood = rnd(); this.flinchT = 0;
    this.aware = 0; this.lastKnown.copy(LURK_C); this.seeT = 99; this.seen = 0; this.provoked = false; this.spotFlash = 0; this.lookT = 0; this.lookAt = null;
    this.inbox.length = 0; this.slot = null; this.slotT = 0; this.rage = 0; this.roarT = 0; this.roarDur = 1; this.feintT = rnd(2, 4); this.feint = 0; this.circleDir = Math.random() < 0.5 ? -1 : 1;
    this.stumDur = 0.5; this.stumPh = 0; this.fdx = 0; this.fdz = -1; this.fallA = 0; this.fallV = 0; this.landed = false; this.dieOnLand = false; this.downPose = {};
    this.flashK = 0; this.bumpT = 0; this.investT = 0; this.searchYaw = 0; this.regroupT = 0; this.wailed = false;
    this.crawler = false; this.dripT = 0; this.headless = false; this.prevVel = new V3();
    if (this.T.axe && (!this.axe || this.axe.parent !== this.h.armR.hand)) { this.dirty = true; this.rebuild(); }
    this.tgt = P; this.seenQ = null; this.retargetT = 0; this.holding = null; this.lastHitBy = null;
    this.hasAxe = !!this.T.axe; this.entry = null; this.slotN = 0; this.workKind = ''; this.workT = 0; this.workN = 0; this.climb = null; this.climbY = 0; this.navWP = null; this.navGoal = new V3(); this.navT = 0; this.scoutList = []; this.scoutT = 0; this.swung = false; this.prowl = null;
    this.h.cur = Object.assign({}, NEUTRAL); this.h.root.visible = true; initSprings(this.h); setFlash(this.mats, 0);
  }
  get standing() { return !GROUNDED.includes(this.state); }
  fwd() { return fwdOf(this.yaw); }
  setState(s) { this.state = s; this.st = 0; }
  lying() { return this.state === 'down' || this.state === 'dead' || this.state === 'getup' || this.state === 'crawl' || this.state === 'ko' || (this.state === 'pinning' && this.crawler); }
  chestPos() {
    if (this.lying()) {
      const a = this.crawler && this.state !== 'down' ? 1.45 : Math.min(1.5, this.state === 'getup' ? 1.5 * (1 - smooth(0, 1, this.st)) : this.fallA);
      return this.pos.clone().addScaledVector(toWorld(this.fdx, this.fdz, this.yaw), 0.85 * Math.sin(a)).add(new V3(0, 1.15 * Math.cos(a) + 0.18, 0));
    }
    return this.pos.clone().add(new V3(0, 1.2 * this.T.height / 1.75, 0));
  }
  headPos() { return this.lying() ? this.chestPos().add(new V3(0, 0.45, 0)) : this.pos.clone().add(new V3(0, 1.95 * this.T.height / 1.75, 0)); }
  /* ---- the cabin ---- */
  inside() { return insideCabin(this.pos.x, this.pos.z); }
  nav(target, dt) { // next waypoint toward target, around the cabin; recomputed a few times a second
    this.navT -= dt;
    if (this.navT <= 0 || !this.navWP || this.navGoal.distanceToSquared(target) > 0.25) { this.navWP = navNext(this.pos, target); this.navGoal.copy(target); this.navT = 0.35; }
    if (this.navWP !== target && Math.hypot(this.navWP.x - this.pos.x, this.navWP.z - this.pos.z) < 0.45) this.navT = 0;
    return this.navWP;
  }
  entrySpot(en) { // where to stand at an entry: two can work the door, one a window, the rest queue behind
    const outN = en.out.clone().sub(en.in).setY(0).normalize(), side = new V3(outN.z, 0, -outN.x);
    if (en.kind === 'door') { const xs = this.hasAxe ? [0.15] : [-0.32, 0.36, -0.05]; const k = this.hasAxe ? 0 : Math.min(this.slotN, 2); return en.out.clone().addScaledVector(side, xs[k]).addScaledVector(outN, k === 2 ? 0.8 : 0); }
    return this.slotN === 0 ? en.out.clone() : en.out.clone().addScaledVector(outN, 1.1 + 0.4 * this.slotN).addScaledVector(side, (this.slotN % 2 ? 0.6 : -0.6));
  }
  startWork(en) {
    let k;
    if (en.kind === 'door') {
      if (door.barred) k = door.reach && this.arms >= 1 && (this.T.smart >= 0.5 || this.workN > 3) ? 'reach' : this.hasAxe ? 'chop' : this.type === 'butcher' ? 'ram' : 'pound';
      else k = this.T.smart >= 0.5 && this.arms >= 1 ? 'open' : this.type === 'butcher' ? 'ram' : 'pound';
    } else k = en.glass ? 'smash' : 'pry';
    if (this.entry !== en || this.state !== 'work') this.workN = 0;
    this.setState('work'); this.workKind = k; this.workT = 0; this.swung = false;
  }
  startClimb(en, low) {
    const outN = en.out.clone().sub(en.in).setY(0).normalize(), wallP = en.kind === 'door' ? new V3(clamp(this.pos.x, -0.3, 0.3), 0, 3.12) : new V3(en.center.x, 0, en.center.z);
    this.climb = { p0: this.pos.clone(), pa: wallP.clone().addScaledVector(outN, 0.32), pb: wallP.clone().addScaledVector(outN, -0.38), p2: en.in.clone(), sill: low ? 0.25 : en.sill, t: 0, dur: (low ? 1.9 : 1.5) * (this.T.feral ? 0.75 : 1) * (this.type === 'butcher' ? 1.3 : 1) * (this.legsOK() < 2 ? 1.4 : 1), en, low, outN };
    this.setState('climb'); SND.growl(this.pos, 0.6, 0.6);
  }
  chopTarget() { // a firefighter goes for the lock side at bar height first, then low for a hole to get through
    if (!door.reach) return { x: rnd(0.74, 0.9), y: rnd(0.92, 1.2) };
    return { x: rnd(0.55, 0.85), y: rnd(0.25, 0.75) };
  }
  dropAxe() {
    if (!this.hasAxe) return; this.hasAxe = false; if (!this.axe || this.axe.parent !== this.h.armR.hand) return;
    detachGib(this.axe, this.fwd().multiplyScalar(0.6).add(new V3(rnd(-0.4, 0.4), 0.8, rnd(-0.4, 0.4))), new V3(rnd(-6, 6), rnd(-3, 3), rnd(-6, 6)), { r: 0.05, dry: true, thud: 'wood' });
    floatLabel('斧头脱手了', this.headPos(), 'heavy', 1.5); if (this.state === 'work' && this.workKind === 'chop') this.setState('siege');
  }
  /* ---- what the body can still do ---- */
  dollState() { // a part reads ok / hurt / broken / gone on the paper doll
    const B = this.body, T = this.T, limb = (st, hp, max) => st === 'severed' ? 'gone' : st !== 'ok' ? 'broken' : hp < max * 0.6 ? 'hurt' : '';
    const A = B.arteries, art = k => A[k] ? ' art' : '';
    return { head: (this.headless ? 'gone' : B.skull < T.skull * 0.3 ? 'broken' : B.skull < T.skull * 0.7 ? 'hurt' : '') + art('neck'), jaw: !B.jaw, torso: (B.bleed + B.art > 0.8 ? 'bleed' : '') + art('torso'),
      armL: limb(B.arm.L, B.armHp.L, T.limb) + art('armL'), armR: limb(B.arm.R, B.armHp.R, T.limb) + art('armR'), legL: limb(B.leg.L, B.legHp.L, T.limb * 1.2) + art('legL'), legR: limb(B.leg.R, B.legHp.R, T.limb * 1.2) + art('legR') };
  }
  condition() { // what the readout says under its name
    const B = this.body; if (this.dead) return ''; if (this.ko) return '失血昏迷'; if (B.blood < 35) return '失血虚弱'; if (B.art > 0.5) return '动脉出血'; if (B.blood < 55) return '失血'; if (B.bleed > 0.6) return '出血'; return '';
  }
  get arms() { return (this.body.arm.L === 'ok' ? 1 : 0) + (this.body.arm.R === 'ok' ? 1 : 0); } // hands that can still hold you down
  legsOK() { return (this.body.leg.L === 'ok' ? 1 : 0) + (this.body.leg.R === 'ok' ? 1 : 0); }
  canStand() { const l = this.body.leg; return l.L !== 'severed' && l.R !== 'severed' && !(l.L === 'broken' && l.R === 'broken'); }
  canBite() { return this.body.jaw && !this.headless; }
  vit() { return Math.min(this.body.skull / this.T.skull, this.body.blood / 100); }
  mobility() { const b = this.body.blood; let m = 1; for (const s of ['L', 'R']) if (this.body.leg[s] === 'broken') m *= 0.55; if (b < 55) m *= 0.88; if (b < 35) m *= 0.75; if (this.frenzy > 0) m *= 1.12; return m; }
  stability() { const b = this.body.blood; return this.T.stab * (this.legsOK() < 2 ? 0.65 : 1) * (b < 55 ? 0.85 : 1) * (b < 35 ? 0.75 : 1); }
  // points of a body lying in the mud that a boot can reach
  groundPoints() {
    const s = this.T.height / 1.75, al = toWorld(this.fdx, this.fdz, this.yaw), lat = new V3(al.z, 0, -al.x), out = [], B = this.body, crawl = this.state === 'crawl';
    if (!this.headless) out.push(['head', 'L', this.pos.clone().addScaledVector(al, 1.55 * s)]);
    for (const sd of ['L', 'R']) {
      const k = sd === 'L' ? 1 : -1;
      if (B.arm[sd] !== 'severed') out.push(['arm', sd, this.pos.clone().addScaledVector(al, (crawl ? 1.85 : 1.2) * s).addScaledVector(lat, k * (crawl ? 0.22 : 0.34) * s)]);
      if (B.leg[sd] !== 'severed') out.push(['leg', sd, this.pos.clone().addScaledVector(al, 0.35 * s).addScaledVector(lat, k * 0.13 * s)]);
    }
    out.push(['torso', 'L', this.pos.clone().addScaledVector(al, 1.05 * s)]);
    return out;
  }

  /* ---- senses ---- */
  perceive() { // every living person in view; the clearest one is what it "sees"
    this.seen = 0; this.seenQ = null;
    if (P.dead || G.mode === 'title' || G.mode === 'opening' || this.state === 'down' || this.state === 'getup' || this.state === 'startle' || this.state === 'flee' || this.state === 'ko' || this.state === 'takendown') return;
    _eye.set(this.pos.x, this.pos.y + (this.crawler ? 0.35 : 1.6), this.pos.z); const f = this.fwd();
    for (const q of PREY) {
      if (q.dead) continue; const d = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z), range = 3 + 13.5 * q.vis; if (d > range) continue;
      const c = (f.x * (q.pos.x - this.pos.x) + f.z * (q.pos.z - this.pos.z)) / Math.max(d, 0.001);
      if (c < -0.2 && (d > 2.2 || q.crouch || q.vis < 0.3)) continue; // wide predator vision, nothing behind; up close it feels you, unless you're creeping
      _tg.set(q.pos.x, q.pos.y + 1.1, q.pos.z); const los = sightLine(_eye, _tg); if (los <= 0) continue;
      let k = los * clamp(1.25 - d / range, 0.12, 1); if (c < 0.45) k *= 0.55; if (this.shielding) k *= 0.6;
      if (q.bitten) k *= 0.5; // it already carries the virus: barely worth a look
      if (k > this.seen) { this.seen = k; this.seenQ = q; }
    }
  }
  // who to go for: whoever is on its side of the walls, close, in trouble; not someone already bitten — first infect, then kill
  chooseTarget() {
    if (this.holding && (this.state === 'pinning' || this.state === 'grab')) { this.tgt = this.holding; return; }
    if (this.tgt && !this.tgt.dead && ['windup', 'lunge', 'axeWind', 'axeSwing', 'recover'].includes(this.state)) return;
    let best = null, bs = 1e9; const ins = this.inside();
    for (const q of PREY) {
      if (q.dead) continue;
      let s = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z);
      if (q.indoor !== ins) s += 6; if (q.bitten) s += 8; if (q === this.tgt) s -= 1.2; if (q === this.seenQ) s -= 1.5;
      if (q.state === 'down' || q.state === 'pinned' || q.panic) s -= 1;
      if (s < bs) { bs = s; best = q; }
    }
    this.tgt = best || P;
  }
  hear(pos, s, radius) {
    if (this.dead || this.state === 'down' || this.state === 'getup' || this.state === 'ko' || this.state === 'takendown') return;
    const err = (1 - s) * 2.2;
    this.lastKnown.set(pos.x + rnd(-err, err), GROUND_Y, pos.z + rnd(-err, err));
    this.aware = Math.min(1.25, this.aware + 0.15 + s * 0.55 * (radius >= 8 ? 1.4 : 1));
    if (radius >= 8 && s > 0.35) this.provoked = true;
    this.lookAt = pos.clone(); this.lookT = 1.4;
    if ((this.state === 'lurk' || this.state === 'search') && this.aware > 0.3 && (this.provoked || G.playT > 40)) { this.setState('investigate'); this.investT = 0; }
    else if (this.state === 'investigate') this.investT = 0;
  }
  onSpot() {
    this.setState('stalk'); this.spotFlash = 1.6;
    if (G.t - SQUAD.spotT > 6) { SQUAD.spotT = G.t; roar(this, 'spot'); } else SND.clicks(this.pos, 3);
  }
  onSignal(m) {
    if (this.state === 'ko' || this.state === 'takendown' || (m.type !== 'retreat' && !(this.standing || this.state === 'crawl'))) return;
    switch (m.type) {
      case 'spot': this.aware = Math.max(this.aware, 1.05); this.provoked = true; this.lastKnown.copy(m.where); SND.clicks(this.pos, 2); break;
      case 'flank': if (m.slot !== undefined) { this.slot = m.slot; this.slotT = 9; SND.clicks(this.pos, 2); } break;
      case 'witness': if (this.standing && !this.wailed) { this.wailed = true; roar(this, 'wail'); } break;
      case 'wail': this.rage = 7; this.aware = 1.25; this.provoked = true; this.lastKnown.copy(m.where); SND.growl(this.pos, 0.7, 0.8); floatLabel('红了眼', this.headPos(), 'roar'); break;
      case 'rally': this.aware = 1.25; this.provoked = true; this.regroupT = 0; this.lastKnown.copy(m.where); SND.growl(this.pos, 0.6, 0.9); break;
      case 'help': this.aware = 1.25; this.provoked = true; this.regroupT = 0; this.lastKnown.copy(m.where); this.rage = Math.max(this.rage, 4); if (m.from && m.from.holding && this.state !== 'pinning' && this.state !== 'grab') this.tgt = m.from.holding; SND.clicks(this.pos, 3); break;
      case 'retreat':
        if (this.T.feral) { floatLabel('（原发型不听）', this.headPos(), 'tough', 1.6); break; }
        if (this.standing && this.state !== 'pinning' && this.state !== 'stumble') this.flee(m.where); break;
    }
  }
  leaderThink(dP) {
    const Q = this.tgt; if (this !== SQUAD.leader || !Q || Q.dead || Q.indoor) return;
    const hunters = infected.filter(o => !o.dead && o.standing && HUNT.includes(o.state) && o.tgt === Q);
    const fallen = infected.filter(o => o.dead || o.state === 'down' || o.state === 'crawl' || o.state === 'ko').length;
    if (G.t - SQUAD.retreatT > 30 && fallen >= 2) { SQUAD.retreatT = G.t; roar(this, 'retreat'); this.flee(Q.pos); return; }
    if (hunters.length >= 2 && dP < 10 && G.t - SQUAD.flankT > 11 && this.roarT <= 0) {
      SQUAD.flankT = G.t; const others = hunters.filter(o => o !== this), slots = new Map(), plan = [Math.PI, Math.PI * 0.55, -Math.PI * 0.55, -Math.PI * 0.8];
      others.sort((a, b) => b.pos.distanceTo(Q.pos) - a.pos.distanceTo(Q.pos)).forEach((o, i) => slots.set(o, plan[i % plan.length]));
      this.slot = 0.35; this.slotT = 9; roar(this, 'flank', slots);
    }
  }
  startle(from) { // strong light only works at first: a flinch, an arm over the eyes, a step back
    if (this.crawler) { if (this.state === 'pinning') releasePin(this, true); return; }
    if (this.state === 'pinning') releasePin(this, true);
    if (this.state === 'windup' || this.state === 'lunge') releaseToken();
    this.setState('startle'); const away = this.pos.clone().sub(from).setY(0); if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
    this.vel.copy(away).multiplyScalar(2.2); SND.shriek(this.pos, 0.55);
    floatLabel('惊退', this.headPos(), 'tough');
  }
  flee(from) {
    if (this.state === 'pinning') releasePin(this, true);
    if (this.state === 'windup' || this.state === 'lunge') releaseToken();
    this.setState('flee'); const away = this.pos.clone().sub(from); away.y = 0; if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
    const a = Math.atan2(this.pos.x - LURK_C.x, this.pos.z - LURK_C.z); const r = Math.max(5, safeR(a)) + rnd(5, 8);
    this.fleeTo.copy(LURK_C).addScaledVector(dirA(a), r).addScaledVector(away, 2); this.regroupT = 9;
  }

  /* ---- getting hit: the body is human. No pain, but mass, balance, bones and blood ---- */
  // where a blow lands depends on how it was thrown: a crouched sweep goes for the legs, an overhead chop for the head
  pickPart(aim, side) {
    const r = Math.random(), B = this.body, other = side === 'L' ? 'R' : 'L';
    let part;
    switch (aim) {
      case 'high': part = r < 0.55 ? 'head' : r < 0.8 ? 'arm' : 'torso'; break;
      case 'low': part = r < 0.85 ? 'leg' : 'torso'; break;
      case 'kick': part = r < 0.45 ? 'leg' : 'torso'; break;
      case 'ground': part = r < 0.45 ? 'head' : r < 0.7 ? 'arm' : r < 0.85 ? 'leg' : 'torso'; break;
      case 'sneak': part = r < 0.7 ? 'head' : r < 0.9 ? 'torso' : 'arm'; break;
      default: part = r < 0.25 ? 'head' : r < 0.6 ? 'arm' : 'torso';
    }
    if (part === 'head' && this.headless) part = 'torso';
    if (part === 'arm' && B.arm[side] === 'severed') { if (B.arm[other] !== 'severed' && Math.random() < 0.35) side = other; else part = 'torso'; }
    if (part === 'leg' && B.leg[side] === 'severed') { if (B.leg[other] !== 'severed') side = other; else part = 'torso'; }
    return { part, side };
  }
  hit(dir, kind, power, blade, aim, src = P) {
    if (this.dead) return null;
    const T = this.T, H = HIT[kind];
    this.lastHitBy = src; if (src && !src.dead && src !== this.tgt && !['pinning', 'grab'].includes(this.state)) this.tgt = src; // it turns on whoever hit it
    let imp = H.imp * power * (blade ? 0.72 : 1), dmg = H.dmg * power * (blade ? 1.45 : 1), tag2 = '';
    const lying = !this.standing, wasAtk = this.state === 'windup' || this.state === 'lunge' || this.state === 'axeWind' || this.state === 'axeSwing';
    if (this.state === 'climb' && this.climb && this.climb.t / this.climb.dur < 0.75) { const C = this.climb; this.climb = null; this.climbY = 0; this.pos.copy(C.pa).addScaledVector(C.outN, 0.35); this.startFall(toLocal(C.outN, this.yaw), 0.9); floatLabel(C.low ? '踹回去了' : '推出窗外', this.headPos(), 'heavy', 1.4); }
    if (this.state === 'work' && this.workKind === 'reach') { floatLabel('伸进来的手被打了回去', this.headPos(), 'heavy', 1.4); this.setState('siege'); }
    if (this.state === 'windup' || this.state === 'axeWind') { imp *= 1.35; tag2 = '打断'; }
    if (aim === 'sneak') { dmg *= 1.8; tag2 = '偷袭'; }
    if (this.state === 'lunge') { imp *= 1.7; dmg *= 1.25; tag2 = '迎击'; }
    this.barT = 4; this.flashK = kind === 'heavy' ? 1 : 0.7; this.provoked = true; this.aware = 1.25; this.lastKnown.copy(src.pos); this.dirty = true;
    if (wasAtk) releaseToken();
    const loc = toLocal(dir, this.yaw), pw = imp / T.weight;
    const { part, side } = this.pickPart(aim || 'mid', loc.x > 0.12 ? 'R' : loc.x < -0.12 ? 'L' : (Math.random() < 0.5 ? 'L' : 'R'));
    impactReact(this.h, loc.x, loc.z, clamp(pw * 1.1, 0.25, 1.6), kind);
    const inj = this.injure(part, side, dmg, kind, blade, dir, loc, lying);
    const out = (tag, cls) => ({ tag: inj.tag || tag, tag2: inj.tag && tag !== '晃了一下' ? tag : '', cls: inj.tag ? 'heavy' : cls, killed: this.dead || this.dieOnLand || inj.killed, part });
    if (lying) {
      this.vel.addScaledVector(dir, pw * 1.2); springKick(this.h, 'bodyY', 0.9 * clamp(pw, 0.3, 1));
      if (inj.killed && !this.dead) this.die();
      return out(inj.killed ? '断气了' : '倒地重击', 'heavy');
    }
    this.vel.addScaledVector(dir, pw * (part === 'torso' ? 3.2 : 2.6));
    if (inj.fall) return out('倒地', 'heavy'); // legs gone from under it: already falling
    if (inj.killed) { this.startFall(loc, pw); this.dieOnLand = true; return out('倒下', 'heavy'); }
    const loss = imp / (100 * this.stability()) * (part === 'leg' ? 1.6 : part === 'head' ? 1.2 : 1) * (this.arms < 2 ? 1.1 : 1);
    this.bal -= loss; this.balT = 0.6;
    if (this.bal <= 0) { this.startFall(loc, pw); return out(tag2 || '击倒', 'heavy'); }
    if (loss >= 0.33 || this.bal < 0.45 || tag2) { this.stumble(dir, 0.3 + loss * 0.85 + (tag2 ? 0.15 : 0)); return out(tag2 || (loss > 0.6 ? '趔趄' : '失衡'), tag2 ? 'heavy' : ''); }
    this.flinchT = 0.15;
    return out('晃了一下', 'tough');
  }
  injure(part, side, dmg, kind, blade, dir, loc, lying) {
    const B = this.body, T = this.T, heavy = kind === 'heavy', pierce = kind === 'thrust', cn = side === 'L' ? '左' : '右', res = { tag: '', killed: false, fall: false };
    if (part === 'head') {
      B.skull -= dmg * (lying ? 1.3 : 1) * (kind === 'kick' ? 0.6 : 1);
      this.daze = Math.max(this.daze, heavy ? 1.7 : 0.9);
      springKick(this.h, 'headX', heavy ? -10 : -6); springKick(this.h, 'headZ', (loc.x > 0 ? -1 : 1) * 9);
      paintWound(this.h.faceMat, heavy ? 2 : 1, heavy, true); spawnBlood(this.headPos(), dir, heavy ? 14 : 7, false, 1, 0.4);
      if (B.skull <= 0) { res.killed = true; if (blade && heavy && !lying && Math.random() < 0.65) { this.decapitate(dir); res.tag = '斩首'; } else { this.crushSkull(dir); res.tag = pierce ? '一矛扎穿了头' : blade ? '劈开头颅' : '颅骨碎裂'; } }
      else if (blade && (Math.abs(loc.x) > 0.12 || pierce) && Math.random() < (heavy ? 0.5 : pierce ? 0.3 : 0.35)) { this.cutArtery('neck', side, dir, 9); res.tag = pierce ? '刺中脖子 · 颈动脉断了' : '砍中脖子 · 颈动脉断了'; }
      else if (pierce) res.tag = '扎在脸上';
      else if (B.jaw && !blade && kind !== 'heavy' && Math.abs(loc.x) > 0.2 && Math.random() < 0.4) { this.breakJaw(); res.tag = '下颌碎裂 · 咬不动了'; }
      else if (B.skull < T.skull * 0.5 && !this.crackNote) { this.crackNote = true; res.tag = '颅骨开裂'; }
      if (!blade && kind !== 'kick') B.bleed += 0.25; // scalp wounds bleed hard
    } else if (part === 'torso') {
      if (blade) {
        B.bleed += heavy ? 2.2 : pierce ? 1.7 : 1.1; paintCut(this.h.coatMat, heavy || pierce);
        if ((heavy || pierce) && Math.random() < (pierce ? 0.3 : 0.4)) { this.cutArtery('torso', side, dir, 5); res.tag = pierce ? '捅穿了肚子' : '劈中要害'; } else res.tag = heavy ? '劈进胸口' : pierce ? '捅进胸口' : '砍伤';
      } else { B.bleed += heavy ? 0.35 : 0.12; if (kind !== 'kick') paintWound(this.h.coatMat, heavy ? 3 : 2, heavy); }
      if (heavy && !blade && Math.random() < 0.35) { res.tag = '肋骨断了'; SND.crunch(this.chestPos(), 4, 0.5); }
    } else if (part === 'arm') {
      B.armHp[side] -= dmg; if (blade) paintCut(this.h.coatMat, false); else paintWound(this.h.coatMat, 1, false);
      if (blade && pierce) { B.bleed += 0.7; if (Math.random() < 0.2) { this.cutArtery('arm' + side, side, dir, 2.5); res.tag = '刺穿' + cn + '臂 · 动脉断了'; } else res.tag = '刺穿' + cn + '臂'; }
      else if (blade) {
        if (heavy ? (B.armHp[side] <= 0 || Math.random() < 0.55) : (B.armHp[side] <= 0 && Math.random() < 0.5)) { this.severArm(side, dir); res.tag = cn + '臂砍断'; }
        else if (Math.random() < 0.25) { B.bleed += 0.9; this.cutArtery('arm' + side, side, dir, 2.5); res.tag = cn + '臂动脉砍断了'; }
        else { B.bleed += 0.9; res.tag = cn + '臂砍伤 · 见骨'; }
      } else if (B.arm[side] === 'ok' && B.armHp[side] <= 0) {
        if (heavy || Math.random() < 0.5) { this.dislocate(side); res.tag = cn + '肩脱臼 · 手臂耷拉'; } else { this.fracture('arm', side); res.tag = cn + '小臂骨折'; }
      }
    } else if (part === 'leg') {
      B.legHp[side] -= dmg * (kind === 'kick' ? 1.3 : 1);
      if (blade && heavy && (B.legHp[side] <= 0 || Math.random() < 0.35)) { this.severLeg(side, dir); res.tag = cn + '腿砍断'; res.fall = !lying; }
      else {
        if (blade) { B.bleed += 1.0; if (Math.random() < 0.3) { this.cutArtery('leg' + side, side, dir, 3.5); res.tag = cn + (pierce ? '腿动脉被刺断了' : '腿动脉砍断了'); } else res.tag = cn + (pierce ? '腿刺伤' : '腿砍伤'); }
        if (B.leg[side] === 'ok' && B.legHp[side] <= 0) { this.fracture('leg', side); res.tag = cn + '腿骨折'; if (!this.canStand()) { this.crawler = true; if (!lying) { const S = this.lastHitBy || P; this.yaw = Math.atan2(S.pos.x - this.pos.x, S.pos.z - this.pos.z); this.startFall({ x: 0, z: 1 }, 0.8); res.fall = true; } } }
      }
    }
    return res;
  }
  // an opened artery: the wound pumps in time with the heart until the pressure is gone
  cutArtery(where, side, dir, rate) {
    const B = this.body, h = this.h, s = h.s, k = side === 'L' ? 1 : -1; if (B.arteries[where]) { B.art += rate * 0.4; return; }
    B.arteries[where] = true; B.art += rate;
    const spot = where === 'neck' ? [h.chest, new V3(k * 0.05 * s, 0.1 * s, 0.03 * s), new V3(k * 0.8, 0.5, 0.4)]
      : where === 'torso' ? [h.spine, new V3(k * 0.06 * s, 0.22 * s, 0.13 * s), new V3(k * 0.2, 0.2, 1)]
      : where.startsWith('arm') ? [side === 'L' ? h.armL.sh : h.armR.sh, new V3(0, -0.2 * s, 0.03), new V3(k, -0.2, 0.4)]
      : [side === 'L' ? h.L.hip : h.R.hip, new V3(0, -0.22 * s, 0.06), new V3(k * 0.5, 0, 1)];
    const o = new THREE.Object3D(); o.position.copy(spot[1]); spot[0].add(o);
    stumps.push({ obj: o, t: 0, life: 999, next: 0, dir: spot[2].normalize(), owner: this });
    spawnBlood(o.getWorldPosition(new V3()), dir, 18, false, 1.4, 0.5); SND.spurt(this.chestPos(), 0.35);
  }
  // bones: a forearm that bends the wrong way, a shoulder out of its socket, a leg that buckles. It screams and keeps coming.
  fracture(limb, side) {
    const B = this.body, h = this.h;
    if (limb === 'arm') { B.arm[side] = 'broken'; h.loose['el' + side] = true; this.floppy(side); if (side === 'R') this.dropAxe(); }
    else { B.leg[side] = 'broken'; h.loose['kn' + side] = true; }
    SND.crunch(this.chestPos(), 6, 0.65); this.enrage();
  }
  dislocate(side) { if (side === 'R') this.dropAxe(); this.body.arm[side] = 'dislocated'; this.h.drop[side] = 0.045 * this.h.s; this.floppy(side); SND.crunch(this.chestPos(), 4, 0.6); this.enrage(); }
  breakJaw() { this.body.jaw = false; SND.crunch(this.headPos(), 5, 0.6); spawnBlood(this.headPos(), this.fwd(), 10, false, 0.6, 0.6); this.enrage(); }
  floppy(side) { if (!this.h.sprK) this.h.sprK = {}; for (const k of ['sh' + side + 'x', 'sh' + side + 'z', 'el' + side]) this.h.sprK[k] = [16, 1.6]; }
  enrage() { if (this.dead) return; this.frenzy = 7; this.roarT = this.roarDur = 0.7; SND.shriek(this.pos, 0.6); }
  crushSkull(dir) {
    const h = this.h, hp = this.headPos(), sk = h.head.children[0];
    sk.scale.y *= 0.72; sk.scale.x *= 1.12; sk.position.y -= 0.012 * h.s;
    spawnBlood(hp, new V3(dir.x * 0.4, Math.max(0.3, dir.y + 0.9), dir.z * 0.4), 34, false, 1.2, 0.5); spawnMist(hp, dir, 1); SND.crunch(hp, 8, 0.75);
    paintWound(h.faceMat, 4, true, true); springKick(h, 'headZ', (Math.random() < 0.5 ? -1 : 1) * 14);
  }
  // a boot coming down on whatever part of it is on the ground
  stomped(part, side, power) {
    const B = this.body; this.barT = 4; this.flashK = 0.8; this.dirty = true; this.aware = 1.25; this.provoked = true;
    springKick(this.h, 'bodyY', -0.6); const cn = side === 'L' ? '左' : '右';
    let tag = '';
    if (part === 'head') {
      B.skull -= HIT.stomp.dmg * power * 1.25; springKick(this.h, 'headX', 10);
      if (B.skull <= 0) { this.crushSkull(new V3(0, -1, 0)); tag = '踩碎头骨'; this.die(); }
      else if (B.jaw && Math.random() < 0.4) { this.breakJaw(); tag = '踩碎下巴'; }
      else { tag = '踩头'; paintWound(this.h.faceMat, 2, true, true); }
    } else if (part === 'arm') { if (B.arm[side] === 'ok') { this.fracture('arm', side); tag = cn + '臂踩断'; } else { tag = '踩烂了'; B.bleed += 0.2; } }
    else if (part === 'leg') { if (B.leg[side] === 'ok') { this.fracture('leg', side); tag = cn + '腿踩断'; if (!this.canStand()) this.crawler = true; } else tag = '踩烂了'; }
    else { B.bleed += 0.3; tag = '踩在背上'; }
    return { tag, killed: this.dead };
  }
  severArm(side, dir) {
    const key = 'el' + side, arm = side === 'L' ? this.h.armL : this.h.armR; if (this.h.cut[key]) return false;
    this.h.cut[key] = true; this.body.arm[side] = 'severed'; if (side === 'R') this.hasAxe = false; this.body.art += 3; this.body.arteries['arm' + side] = true; if (this.h.sprK) for (const k of ['sh' + side + 'x', 'sh' + side + 'z']) this.h.sprK[k] = [40, 4];
    const c = new V3(); arm.el.children[0].getWorldPosition(c);
    detachGib(arm.el, dir.clone().multiplyScalar(2.4).add(new V3(rnd(-0.5, 0.5), 2.2, rnd(-0.5, 0.5))), new V3(rnd(-10, 10), rnd(-5, 5), rnd(-10, 10)), { r: 0.05, center: c });
    addStump(arm.sh, -0.29 * this.h.s, 0.048 * this.h.s * Math.sqrt(this.T.girth), new V3(0, -1, 0), this);
    const p = new V3(); arm.sh.getWorldPosition(p); spawnBlood(p, dir, 26, false, 1.2, 0.5); spawnMist(p, dir, 0.8); SND.crunch(p, 5, 0.6);
    this.enrage(); return true;
  }
  severLeg(side, dir) {
    const key = 'kn' + side, leg = side === 'L' ? this.h.L : this.h.R; if (this.h.cut[key]) return false;
    this.h.cut[key] = true; this.body.leg[side] = 'severed'; this.body.art += 4.5; this.body.arteries['leg' + side] = true; this.crawler = true;
    const c = new V3(); leg.knee.children[0].getWorldPosition(c);
    detachGib(leg.knee, dir.clone().multiplyScalar(1.6).add(new V3(rnd(-0.5, 0.5), 1.4, rnd(-0.5, 0.5))), new V3(rnd(-8, 8), rnd(-4, 4), rnd(-8, 8)), { r: 0.06, center: c });
    addStump(leg.hip, -0.43 * this.h.s, 0.066 * this.h.s * Math.sqrt(this.T.girth), new V3(0, -1, 0), this);
    spawnBlood(c, dir, 22, false, 1, 0.5); spawnMist(c, dir, 0.7); SND.crunch(c, 5, 0.6);
    if (this.standing) { const S = this.lastHitBy || P; this.yaw = Math.atan2(S.pos.x - this.pos.x, S.pos.z - this.pos.z); this.startFall({ x: 0, z: 1 }, 1.2); }
    this.enrage(); return true;
  }
  decapitate(dir) {
    const h = this.h; h.cut.head = true; this.headless = true; this.body.skull = 0; this.body.bleed += 4;
    const c = new V3(); h.head.children[0].getWorldPosition(c);
    detachGib(h.head, dir.clone().multiplyScalar(2.6).add(new V3(rnd(-0.4, 0.4), 3.2, rnd(-0.4, 0.4))), new V3(rnd(-12, 12), rnd(-6, 6), rnd(-12, 12)), { r: 0.1, center: c, roll: true, bleed: 4 });
    const st = addStump(h.chest, 0.13 * h.s, 0.05 * h.s, new V3(0, 1, 0)); st.life = 6; st.next = 0.15;
    spawnBlood(c, new V3(0, 1, 0), 40, false, 1.6, 0.4); spawnMist(c, new V3(0, 0.6, 0), 1.2); SND.crunch(c, 7, 0.7);
    if (P.pos.distanceTo(this.pos) < 2.4) { lensSplat(3); paintWound(P.h.coatMat, 2, true); }
  }
  stumble(dir, dur) {
    if (this.state === 'windup' || this.state === 'lunge') releaseToken();
    this.setState('stumble'); this.stumDur = dur; this.stumPh = 0; this.cool = Math.max(this.cool, 0.6);
    SND.exhale(this.pos, this.T.voice, 0.4);
  }
  startFall(loc, pw) {
    if (this.state === 'windup' || this.state === 'lunge') releaseToken();
    const l = Math.hypot(loc.x, loc.z) || 1; this.fdx = loc.x / l; this.fdz = loc.z / l;
    this.setState('down'); this.fallA = 0.12; this.fallV = 1.5 + clamp(pw, 0, 1.6) * 2.0; this.landed = false;
    this.downPose = this.makeDownPose(); SND.exhale(this.pos, this.T.voice, 0.55);
  }
  makeDownPose() {
    if (this.fdz > 0.4) return { shLx: -2.6 + rnd(-0.3, 0.3), shRx: -2.4 + rnd(-0.3, 0.3), shLz: rnd(0.2, 0.6), shRz: -rnd(0.2, 0.6), elL: rnd(0.3, 0.9), elR: rnd(0.3, 0.9), headX: -0.6, headY: rnd(-0.9, 0.9), knL: rnd(0.1, 0.6), knR: rnd(0.1, 0.6), hipLz: 0.12, hipRz: -0.12 };
    return { shLz: rnd(0.7, 1.4), shRz: -rnd(0.7, 1.4), shLx: rnd(-0.7, 0.2), shRx: rnd(-0.7, 0.2), elL: rnd(0.2, 1), elR: rnd(0.2, 1), hipLz: rnd(0.05, 0.3), hipRz: -rnd(0.05, 0.3), knL: rnd(0.1, 0.8), knR: rnd(0.1, 0.8), headY: rnd(-0.8, 0.8), headX: this.fdz < -0.4 ? rnd(-0.3, 0.1) : 0, headZ: this.fdz < -0.4 ? 0 : -this.fdx * 0.4 };
  }
  fallHard(a) { const lift = smooth(0.7, 1.5, a) * (Math.abs(this.fdz) * 0.13 + Math.abs(this.fdx) * 0.19) * (this.T.girth > 1.2 ? 1.4 : 1); return { bodyX: this.fdz * a, bodyZ: -this.fdx * a, bodyY: lift }; }
  onLand() {
    const w = this.T.weight, along = toWorld(this.fdx, this.fdz, this.yaw);
    SND.bodyFall(this.pos, this.quietFall ? w * 0.5 : w); makeNoise(this.pos, this.quietFall ? 4 : 10, 'fall');
    for (let i = 0; i < 4; i++) spawnSplash(this.pos.clone().addScaledVector(along, 0.3 + i * 0.4), 7, 0.25, 1.4 + w / 90);
    if (this.pos.distanceTo(P.pos) < 9) G.shake = Math.max(G.shake, 0.1 * w / 80);
    if (this.body.bleed > 0.3) { const c = this.pos.clone().addScaledVector(along, 0.8); c.y += 0.15; spawnBlood(c, new V3(0, 1, 0), 8, true, 0.8, 0.6); }
    if (this.ko) addBloodPool(this.chestPos(), 1.7);
    if (this.dieOnLand) { this.dieOnLand = false; this.die(); return; }
    if (this.ko) return;
    if (this.vit() < 0.35 && !this.wailed && !this.headless) { this.wailed = true; roar(this, 'wail'); }
  }
  die() {
    this.dead = true; this.state = 'dead'; this.barT = 0; this.inbox.length = 0; this.flashK = 0; setFlash(this.mats, 0);
    const B = this.body; addBloodPool(this.chestPos(), this.headless || B.arm.L === 'severed' || B.arm.R === 'severed' || this.crawler || B.blood < 30 ? 1.9 : 1.4);
    let o = null, od = this.quietFall ? 9 : 18; const c = this.chestPos();
    for (const x of infected) if (x !== this && !x.dead && x.standing) { const d = x.pos.distanceTo(this.pos); if (d < od && sightLine(x.pos.clone().setY(x.pos.y + 1.6), c) > 0) { od = d; o = x; } }
    if (o) o.inbox.push({ type: 'witness', at: G.t + 0.6 });
  }
  bleedOut(dt) {
    const B = this.body, loss = B.bleed + B.art + (this.ko ? 0.35 : 0); if (loss <= 0) return;
    B.blood -= loss * dt; this.dripT -= dt;
    if (this.dripT <= 0) { this.dripT = rnd(0.05, 0.22) / (0.4 + Math.min(loss, 4)); const p = this.chestPos(); p.y -= this.standing ? 0.35 : 0.05; spawnBlood(p, new V3(0, -0.5, 0), 1 + (loss > 3 ? 1 : 0), true, 0.2, 0.9); }
    B.bleed = Math.max(0, B.bleed - dt * 0.04 * (1 + B.bleed * 0.3)); B.art = Math.max(0, B.art - dt * 0.012 * (1 + B.art * 0.1));
    const pale = clamp((60 - B.blood) / 50, 0, 1); if (Math.abs(pale - this.paleK) > 0.05) { this.paleK = pale; for (const m of [this.h.skinMat, this.h.faceMat]) m.color.setRGB(1 - pale * 0.22, 1 - pale * 0.14, 1 - pale * 0.04); }
    if (B.blood < 35 && this.state === 'stalk' && Math.random() < dt * 0.3) { this.bal -= 0.3; this.stumble(this.fwd(), 0.45); floatLabel('失血踉跄', this.headPos(), 'tough'); }
    if (!this.ko && B.blood < 20 && B.blood > 0) this.knockOut();
    if (B.blood <= 0) { floatLabel('失血而死', this.headPos(), 'heavy', 1.4); if (this.standing) { this.startFall({ x: 0, z: 1 }, 0.2); this.dieOnLand = true; } else if (this.state !== 'down' || this.landed) this.die(); else this.dieOnLand = true; }
  }
  knockOut() { // not pain: the pressure is gone and the brain shuts off
    this.ko = true; floatLabel('失血昏迷', this.headPos(), 'heavy', 1.6); SND.exhale(this.pos, this.T.voice, 0.5);
    if (this.state === 'pinning') releasePin(this, true);
    if (this.state === 'grab') { if (P.clinchBy === this) breakClinch(true); else if (this.holding && !this.holding.isPlayer) this.holding.freeFrom(this, true); }
    if (this.state === 'climb') { this.climb = null; this.climbY = 0; }
    if (this.state === 'crawl') { this.setState('ko'); return; }
    if (this.standing) this.startFall({ x: rnd(-0.5, 0.5), z: rnd(0.3, 1) }, 0.25);
  }
  bump(o, n, sp) { // a stumbling body carries its momentum into whoever it runs into
    this.bumpT = 0.5; o.bumpT = 0.35;
    const m1 = this.T.weight, m2 = o.T.weight, j = sp * m1 / (m1 + m2) * 1.15;
    o.vel.addScaledVector(n, j); this.vel.multiplyScalar(0.45);
    const loss = j * 0.42 * (70 / m2), loc = toLocal(n, o.yaw);
    impactReact(o.h, loc.x, loc.z, clamp(j * 0.4, 0.2, 1.2), 'quick'); SND.thud(o.pos); SND.exhale(o.pos, o.T.voice, 0.4);
    o.bal -= loss; o.balT = 0.5;
    if (o.bal <= 0) { o.startFall(loc, j * 0.5); floatLabel('撞倒同伴', o.headPos(), 'heavy'); } else { o.stumble(n, 0.3 + loss * 0.7); floatLabel('撞上', o.headPos(), ''); }
  }
  slam() { // into a post, the rail or the porch edge
    this.bumpT = 0.6; const sp = Math.hypot(this.vel.x, this.vel.z); this.vel.multiplyScalar(-0.25);
    const n = this.vel.clone().setY(0); if (n.lengthSq() < 1e-4) n.copy(this.fwd()).negate(); n.normalize();
    const loc = toLocal(n, this.yaw); impactReact(this.h, loc.x, loc.z, 0.8, 'quick'); SND.thud(this.pos); G.shake = Math.max(G.shake, 0.1);
    if (this.state === 'stumble') { this.bal -= 0.35 + sp * 0.08; this.balT = 0.6; floatLabel('撞上柱子', this.headPos(), ''); if (this.bal <= 0) this.startFall(loc, 0.5); }
  }
  avoidLight(dir, dt) {
    if (!inFlood(this.pos.clone().addScaledVector(dir, 0.8))) return dir;
    this.hesT += dt;
    const tang = new V3(-dir.z, 0, dir.x); if (inFlood(this.pos.clone().addScaledVector(tang, 0.8))) tang.negate();
    return inFlood(this.pos.clone().addScaledVector(tang, 0.8)) ? new V3() : tang;
  }
  contactPrey(r) {
    let best = null, bd = r;
    for (const q of PREY) {
      if (!grabbable(q)) continue; const d = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z) - (q === this.tgt ? 0.05 : 0);
      if (d < bd && openingBetween(this.pos, q.pos)) { bd = d; best = q; }
    }
    return best;
  }
  moveDir(dir, spd, dt, k = 6) { this.vel.x = damp(this.vel.x, dir.x * spd, k, dt); this.vel.z = damp(this.vel.z, dir.z * spd, k, dt); }
  moveTo(target, spd, dt) { const d = target.clone().sub(this.pos); d.y = 0; const l = d.length(); if (l < 0.3) { this.moveDir(new V3(), 0, dt); return; } this.moveDir(d.divideScalar(l), Math.min(spd, l * 1.5), dt); }
  face(target, dt, k = 8) { const a = Math.atan2(target.x - this.pos.x, target.z - this.pos.z); this.yaw += angDiff(this.yaw, a) * (1 - Math.exp(-k * dt)); }
  gait(amt, run = 0, crouch = 0) { // their own walk: the butcher rolls, the student scampers, nobody guards a wound
    const w = walkPose(this.ph, amt, run, this._sp, this.h.s, crouch ? Object.assign({ crouch }, this.T.gait) : this.T.gait), B = this.body;
    for (const sd of ['L', 'R']) if (B.leg[sd] === 'broken') {
      const stance = Math.max(0, sd === 'L' ? -Math.cos(this.ph) : Math.cos(this.ph)) * Math.max(amt, 0.3);
      w['kn' + sd] = -0.12 - 0.4 * stance; w['hip' + sd + 'x'] *= 0.5; w.spZ = (w.spZ || 0) + (sd === 'L' ? 1 : -1) * 0.14 * stance; w.bodyY = (w.bodyY || 0) - 0.06 * stance;
    }
    if (B.blood < 35) w.spX = (w.spX || 0) + 0.1;
    if (this.daze > 0) { w.spZ = (w.spZ || 0) + Math.sin(G.t * 4.5) * 0.12 * Math.min(1, this.daze); w.headZ = (w.headZ || 0) + Math.sin(G.t * 3.1) * 0.25 * Math.min(1, this.daze); }
    return w;
  }
  updateDead(dt) {
    this.vel.multiplyScalar(Math.exp(-6 * dt)); this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y = groundY(this.pos.x, this.pos.z);
    springStep(this.h, dt); poseTo(this.h, this.downPose, 6, dt, this.fallHard(1.5));
    this.h.root.position.copy(this.pos); this.h.root.rotation.y = this.yaw;
  }

  update(dt) {
    const T = this.T, h = this.h; this.st += dt;
    this.barT -= dt; this.voiceT -= dt; this.cool -= dt; this.flinchT -= dt; this.roarT -= dt; this.spotFlash -= dt; this.rage -= dt; this.lookT -= dt; this.bumpT -= dt; this.slotT -= dt; this.regroupT -= dt; this.daze -= dt; this.frenzy -= dt;
    if (this.flashK > 0) { this.flashK = Math.max(0, this.flashK - dt * 8); setFlash(this.mats, this.flashK); }
    if (this.dead) { this.updateDead(dt); return; }
    if (this.balT > 0) this.balT -= dt; else this.bal = Math.min(1, this.bal + (this.state === 'stumble' ? 0.22 : 0.5) * dt);
    this.bleedOut(dt); if (this.dead) { this.updateDead(dt); return; }
    for (let i = this.inbox.length - 1; i >= 0; i--) if (G.t >= this.inbox[i].at) { const m = this.inbox.splice(i, 1)[0]; this.onSignal(m); if (this.dead) return; }
    this.retargetT -= dt; if (!this.tgt || this.tgt.dead || this.retargetT <= 0) { this.retargetT = rnd(0.35, 0.6); this.chooseTarget(); }
    const Q = this.tgt, toP = Q.pos.clone().sub(this.pos); toP.y = 0; const dP = toP.length(); // Q: the one it's after (you or one of your people)
    // strong light (floodlight, torch) startles them at first; then they shield their eyes and keep coming. The feral barely care.
    const lit = inFlood(this.pos), torch = torchHits(this.pos), strong = lit || torch, sens = T.lightSens;
    if (strong && this.standing) {
      if (!this.wasLit && this.adapt < 0.5 && this.state !== 'stumble') {
        if (sens > 0.5 && this.rage <= 0 && ['lurk', 'stalk', 'porch', 'windup', 'recover', 'pinning', 'investigate', 'search'].includes(this.state)) this.startle(torch ? P.pos : floodLight.position);
        else if (this.state !== 'lurk') { this.flinchT = 0.15; floatLabel('硬扛强光', this.headPos(), 'heavy'); }
      }
      this.adapt = Math.min(1, this.adapt + dt / (1.3 * sens));
    } else if (!strong) this.adapt = Math.max(0, this.adapt - dt / 7);
    this.wasLit = strong; this.shielding = strong && sens > 0.5 && this.state !== 'startle' && this.standing;
    // senses
    this.perceive();
    const S = this.seenQ, seesQ = this.seen > 0 && S === Q;
    if (this.seen > 0) { this.aware = Math.min(1.25, this.aware + dt * this.seen * 1.7); if (seesQ || this.seeT > 1.5) this.lastKnown.copy(S.pos); this.seeT = 0; if (S.pos.distanceTo(this.pos) < 6 && !inFlood(S.pos)) this.provoked = true; }
    else this.seeT += dt;
    if ((G.playT < 40 && !this.provoked && !floodOff()) || this.regroupT > 0) this.aware = Math.min(this.aware, 0.95);
    const canHunt = G.mode === 'play' && !P.dead && !Q.dead && (Q.indoor === this.inside() || (dP < 3 && openingBetween(this.pos, Q.pos)));
    if (this.aware >= 1 && canHunt && (this.state === 'lurk' || this.state === 'investigate' || this.state === 'search')) this.onSpot();
    let pose = {}, hard = null; const sp = Math.hypot(this.vel.x, this.vel.z); const turnR = Math.abs(angDiff(this.yawPrev ?? this.yaw, this.yaw)) / Math.max(dt, 1e-3); this.yawPrev = this.yaw; this._sp = Math.max(sp, Math.min(0.8, turnR * 0.3));
    switch (this.state) {
      case 'lurk': {
        if (SIEGE.on && Q.indoor && this.aware > 0.6 && G.mode === 'play') { this.setState('siege'); break; }
        this.ang += this.angVel * dt; let r = safeR(this.ang);
        if (r < 0 || Math.random() < 0.0015) { this.angVel *= -1; this.ang += this.angVel * dt * 3; r = Math.max(4, safeR(this.ang)); }
        const tgt = LURK_C.clone().addScaledVector(dirA(this.ang), Math.max(r, 4) + 0.9 + this.mood * 1.7);
        const watching = this.aware > 0.3 && this.seeT < 2.5;
        this.moveTo(tgt, watching ? 0.35 : 0.8, dt);
        if (watching) this.face(this.lastKnown, dt, 3);
        else if (sp > 0.15) this.yaw += angDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-4 * dt));
        else if (Math.sin(G.t * 0.3 + this.mood * 9) > 0.7) this.face(Q.pos, dt, 2);
        if (!watching) this.aware = Math.max(0, this.aware - dt * 0.05);
        if (this.aware > 0.45 && (this.provoked || G.playT > 40) && canHunt && this.regroupT <= 0) { this.setState('investigate'); this.investT = 0; }
        if (floodOff() && !P.dead) { if (Q.indoor) { if (SIEGE.on) this.setState('siege'); } else if (dP < 17 && G.mode === 'play') { this.aware = Math.max(this.aware, 1.05); this.provoked = true; } }
        if (this.voiceT < 0) { SND.growl(this.pos, 0.3, rnd(0.8, 1.4)); this.voiceT = rnd(8, 15); }
        pose = Object.assign(this.gait(clamp(sp / 0.9, 0, 1) * 0.7, 0, 0.1), { spX: 0.42, headX: watching ? -0.45 : -0.32, shLx: -0.35, shRx: -0.4, elL: 0.55, elR: 0.6, spZ: Math.sin(G.t * 0.9 + this.mood * 5) * 0.06 });
        break;
      }
      case 'investigate': { // walk to where it saw or heard something, low and slow, head sweeping
        if (SIEGE.on && Q.indoor && G.mode === 'play' && !this.inside()) { this.setState('siege'); break; }
        this.investT += dt;
        const to = this.lastKnown.clone().sub(this.pos).setY(0), l = to.length();
        let dir = l > 0.7 ? to.divideScalar(l) : new V3();
        const allowLight = T.feral || floodOff() || this.adapt > 0.8 || this.rage > 0;
        if (!allowLight && dir.lengthSq()) dir = this.avoidLight(dir, dt);
        this.moveDir(dir, T.speed * (this.aware > 0.7 ? 0.55 : 0.4), dt);
        if (this.seen > 0) this.face(S.pos, dt, 4); else if (sp > 0.2) this.yaw += angDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-5 * dt));
        if (this.seen <= 0) this.aware = Math.max(0, this.aware - dt * 0.03);
        if (l < 0.9 || this.investT > 8 || (!dir.lengthSq() && this.investT > 2.5)) { this.setState('search'); this.searchYaw = this.yaw; }
        else if (Q.indoor && floodOff()) this.setState('porch');
        if (this.voiceT < 0) { SND.clicks(this.pos, 2); this.voiceT = rnd(3, 6); }
        pose = Object.assign(this.gait(clamp(sp / 1.4, 0, 1), 0, 0.08), { spX: 0.36, headX: -0.15 + Math.sin(G.t * 3) * 0.08, headY: Math.sin(G.t * 1.3 + this.mood * 4) * 0.6, shLx: -0.3, shRx: -0.3, elL: 0.5, elR: 0.5 });
        break;
      }
      case 'search': { // stand where the trail went cold: turn, sniff, click
        if (SIEGE.on && Q.indoor && G.mode === 'play' && !this.inside()) { this.setState('siege'); break; }
        this.moveDir(new V3(), 0, dt, 4); this.yaw = this.searchYaw + Math.sin(this.st * 1.1) * 1.3;
        if (this.seen <= 0) this.aware = Math.max(0, this.aware - dt * 0.1);
        if (this.st > 5.5 || this.aware < 0.12) { this.setState('lurk'); this.ang = Math.atan2(this.pos.x - LURK_C.x, this.pos.z - LURK_C.z); }
        else if (this.aware > 0.45 && this.st > 1 && this.lastKnown.distanceTo(this.pos) > 1.5) { this.setState('investigate'); this.investT = 0; }
        if (this.voiceT < 0) { SND.clicks(this.pos, 3); this.voiceT = rnd(2, 4); }
        pose = { spX: 0.32, knL: 0.25, knR: 0.25, headX: -0.25 + Math.sin(this.st * 2.3) * 0.15, headY: Math.sin(this.st * 1.7) * 0.5, shLx: -0.3, shRx: -0.35, elL: 0.5, elR: 0.5, jaw: 0.2 + Math.max(0, Math.sin(this.st * 5)) * 0.3 };
        break;
      }
      case 'porch': {
        const tgt = new V3(clamp(this.pos.x, -2.8, 2.8) + Math.sin(this.home * 3) * 0.6, GROUND_Y, 6.1 + this.mood * 0.6);
        this.moveTo(tgt, 1.3, dt); this.face(new V3(0, 0, 3), dt, 3);
        if (!floodOff()) this.setState('lurk');
        if (!Q.indoor && dP < 12) { this.aware = 1.1; this.setState('stalk'); }
        if (this.voiceT < 0) { SND.growl(this.pos, 0.5, rnd(1, 1.6)); this.voiceT = rnd(3, 6); }
        pose = Object.assign(this.gait(clamp(sp / 1.3, 0, 1)), { spX: 0.25, headX: -0.2, shLx: -0.6, shRx: -0.55, elL: 0.3, elR: 0.4 });
        break;
      }
      case 'stalk': {
        if (!canHunt) {
          if (G.mode === 'play' && !P.dead && this.inside() && !Q.indoor) { this.setState('exit'); break; }
          if (G.mode === 'play' && !P.dead && Q.indoor && SIEGE.on) { this.setState('siege'); break; }
          this.setState('lurk'); this.aware = Math.min(this.aware, 0.8); break;
        }
        if (this.seeT > 3.5) { this.setState('investigate'); this.investT = 0; break; } // lost sight: go to where it was last seen
        this.leaderThink(dP); if (this.state !== 'stalk') break;
        const pLit = inFlood(Q.pos), allowLight = T.feral || floodOff() || this.adapt > 0.8 || this.hesT > T.hesitate || this.rage > 0;
        const rageK = this.rage > 0 ? 1.18 : 1, limpK = this.mobility(), myTurn = SQUAD.turn.has(this) && this.daze < 0.4;
        const pinner = Q.state === 'pinned' ? Q.pinnedBy : null;
        if (pinner && pinner !== this && !pinner.canBite() && this.canBite()) { // it can't bite, so this one comes to
          this.moveDir(toP.clone().normalize(), T.speed * limpK * rageK, dt); this.face(Q.pos, dt, 8);
          pose = Object.assign(this.gait(clamp(sp / 2.5, 0, 1), clamp((sp - 2.2) / 1.5, 0, 1)), { spX: 0.45, headX: -0.3, shLx: -0.9, shRx: -0.9, elL: 0.3, elR: 0.3, jaw: 0.9 });
          if (dP < 1.1) preyBite(this, Q);
          break;
        }
        const target = seesQ ? Q.pos : this.lastKnown, toT = target.clone().sub(this.pos).setY(0), dT = toT.length();
        let dir, spd;
        if (myTurn && dP < (this.hasAxe ? 2.2 : 2.7) && (!pLit || allowLight)) { this.setState(this.hasAxe ? 'axeWind' : 'windup'); SQUAD.tokenCD = 0.3; SND.growl(this.pos, 0.8, 0.6); break; }
        if (dT > 4.4 || myTurn) { dir = dT > 0.05 ? toT.divideScalar(dT) : new V3(); spd = (dT > 5 ? T.speed : T.speed * 0.8) * (floodOff() ? 1.15 : 1); this.feint = 0; }
        else { // hold a ring around the prey, wait for a turn, drift toward the flank slot the leader gave
          const R = Q.state === 'pinned' ? 2.3 : (Q.indoor ? 2.1 : 2.9) + this.mood * 0.5;
          let want = Math.atan2(this.pos.x - Q.pos.x, this.pos.z - Q.pos.z);
          if (this.slot !== null && this.slotT > 0) want += clamp(angDiff(want, Q.yaw + this.slot), -0.9, 0.9); else want += this.circleDir * 0.5;
          const to = Q.pos.clone().addScaledVector(dirA(want), R).sub(this.pos).setY(0);
          if (dP < R) { const rad = toP.clone().divideScalar(-Math.max(dP, 0.001)), out = to.dot(rad); if (out > 0) to.addScaledVector(rad, -out); } // you stepped in: it holds its ground instead of backing off
          const l = to.length(); dir = l > 0.05 ? to.divideScalar(l) : new V3(); spd = Math.min(T.speed * 0.8, l * 2.2 + 0.4);
          this.feintT -= dt;
          if (this.feintT <= 0 && dP < 3.9 && Q.state !== 'pinned') { this.feint = 0.34; this.feintT = rnd(2.4, 4.6) / (T.feral ? 1.6 : 1); SND.growl(this.pos, 0.55, 0.45); }
          if (this.feint > 0) { this.feint -= dt; dir = toP.clone().normalize(); spd = 3.4; }
          if (Math.random() < dt * 0.15) this.circleDir *= -1;
        }
        if (!allowLight && dir.lengthSq() > 0) dir = this.avoidLight(dir, dt);
        if (!inFlood(this.pos) && allowLight && !floodOff()) this.hesT = Math.max(0, this.hesT - dt * 0.2);
        if (this.daze > 0.2) { const a = Math.sin(G.t * 3.7) * 0.9 * Math.min(1, this.daze); dir = new V3(dir.x * Math.cos(a) + dir.z * Math.sin(a), 0, -dir.x * Math.sin(a) + dir.z * Math.cos(a)); spd *= 0.55; }
        this.moveDir(dir, spd * rageK * limpK * (this.shielding ? 0.72 : 1), dt); this.face(Q.pos, dt, this.daze > 0.2 ? 2.5 : 6);
        if (dP > 19 && this.seen <= 0) this.setState('lurk');
        if (this.voiceT < 0) { SND.growl(this.pos, 0.45, rnd(0.6, 1)); this.voiceT = rnd(4, 8); }
        pose = Object.assign(this.gait(clamp(sp / 2.5, 0, 1), clamp((sp - 2.2) / 1.5, 0, 1)), { spX: 0.3 + clamp((sp - 2) / 2, 0, 0.2) + (this.feint > 0 ? 0.25 : 0), headX: -0.25, shLx: -0.5, shRx: -0.45, elL: 0.45, elR: 0.5, jaw: this.feint > 0 ? 0.9 : 0.15 });
        break;
      }
      case 'windup': {
        this.moveDir(new V3(), 0, dt, 10); this.face(Q.pos, dt, 10);
        const k = smooth(0, 0.5, this.st);
        pose = { spX: -0.12 * k, shLx: -1.7 * k, shRx: -1.7 * k, shLz: 0.45 * k, shRz: -0.45 * k, elL: 0.35, elR: 0.35, headX: -0.25, jaw: k, knL: 0.3 * k, knR: 0.3 * k, pelY: -0.06 * k };
        if (this.st > (this.shielding ? 0.78 : 0.5)) { this.setState('lunge'); this.lungeT.copy(Q.pos).addScaledVector(Q.vel, this.shielding ? 0.05 : 0.22); SND.shriek(this.pos, 0.5); }
        break;
      }
      case 'lunge': {
        const d = this.lungeT.clone().sub(this.pos); d.y = 0; d.normalize();
        const ls = (this.shielding ? 6.0 : 7.2) * Math.max(0.55, this.mobility()); this.vel.x = d.x * ls; this.vel.z = d.z * ls; this.face(this.lungeT, dt, 12);
        pose = { spX: 0.6, shLx: -1.5, shRx: -1.5, shLz: 0.2, shRz: -0.2, elL: 0.15, elR: 0.15, jaw: 1, hipLx: -0.7, hipRx: 0.5, knR: 0.6, headX: -0.4 };
        const hitQ = G.mode === 'play' ? this.contactPrey(this.shielding ? 0.7 : 0.85) : null; // whoever it slams into: the one it went for, or someone in the way
        if (hitQ) {
          if (this.arms >= 1) { preyGrab(this, hitQ); break; }
          preyShove(this, hitQ); this.setState('recover'); this.cool = rnd(1.4, 2.2); releaseToken(); break; // no hands left to hold on with
        }
        if (this.st > 0.32) { // lunged at air: momentum carries it past
          this.cool = rnd(1.3, 2.2) * (T.feral ? 0.6 : 1) * (this.rage > 0 || this.frenzy > 0 ? 0.6 : 1); releaseToken();
          this.bal -= 0.28; this.stumble(this.fwd(), 0.5); floatLabel('扑空', this.headPos(), 'tough');
        }
        break;
      }
      case 'recover': {
        this.moveDir(new V3(), 0, dt, 5);
        pose = { spX: 0.55 - this.st * 0.4, shLx: -0.6, shRx: -0.7, elL: 0.5, elR: 0.5, knL: 0.4, knR: 0.2, headX: -0.2 };
        if (this.st > 0.85) this.setState('stalk');
        break;
      }
      case 'stumble': { // feet scrambling to get back under a body that is falling over
        this.vel.multiplyScalar(Math.exp(-2.4 * dt));
        const lv = toLocal(this.vel, this.yaw), k = 1 - smooth(this.stumDur * 0.6, this.stumDur, this.st);
        this.stumPh += dt * (7 + sp * 5);
        pose = Object.assign(walkPose(this.stumPh, clamp(sp / 1.5, 0.35, 1) * k, 0.4 * k), {
          spX: clamp(lv.z * 0.16, -0.5, 0.5) * k + 0.1, spZ: clamp(-lv.x * 0.16, -0.4, 0.4) * k, headX: -0.25 * k, jaw: 0.6 * k, pelY: -0.05 * k,
          shLx: (-0.9 + Math.sin(this.st * 13) * 0.9) * k, shRx: (-0.7 + Math.sin(this.st * 13 + 2) * 0.9) * k,
          shLz: (1.0 + Math.sin(this.st * 9) * 0.3) * k + 0.08, shRz: -(1.0 + Math.sin(this.st * 9 + 1) * 0.3) * k - 0.08, elL: 0.5, elR: 0.6
        });
        if (this.st > this.stumDur) {
          if (this.bal < 0.12) this.startFall(toLocal(sp > 0.1 ? this.vel.clone().normalize() : this.fwd().negate(), this.yaw), 0.3);
          else { this.setState('stalk'); this.cool = Math.max(this.cool, 0.35); if (Math.random() < 0.6) SND.growl(this.pos, 0.6, 0.6); }
        }
        break;
      }
      case 'down': {
        this.vel.multiplyScalar(Math.exp(-(this.landed ? 6 : 2.2) * dt));
        if (!this.landed) { this.fallV += 8.4 * Math.sin(this.fallA) * dt; this.fallA += this.fallV * dt; if (this.fallA >= 1.5) { this.fallA = 1.5; this.landed = true; this.fallV = -Math.min(2.2, Math.abs(this.fallV) * 0.2); this.onLand(); } }
        else { this.fallV += 16 * dt; this.fallA = Math.min(1.5, this.fallA + this.fallV * dt); if (this.fallA >= 1.5) this.fallV = 0; }
        const k = smooth(0.2, 1.3, this.fallA); for (const key in this.downPose) pose[key] = this.downPose[key] * k;
        if (!this.landed) Object.assign(pose, { shLx: -1.4 + Math.sin(this.st * 20) * 0.5, shRx: -1.2 + Math.sin(this.st * 18 + 1) * 0.5, shLz: 0.9, shRz: -0.9, jaw: 0.8 });
        hard = this.fallHard(this.fallA);
        if (this.dead) break;
        if (this.landed && this.st > 1.7 + T.weight / 140) { if (this.ko) this.setState('ko'); else if (this.crawler || !this.canStand()) { this.crawler = true; this.fdx = 0; this.fdz = 1; this.setState('crawl'); } else { this.setState('getup'); SND.growl(this.pos, 0.5, 0.7); } }
        break;
      }
      case 'getup': {
        const k = 1 - smooth(0, 1.0, this.st), m = Math.sin((1 - k) * Math.PI);
        hard = this.fallHard(1.5 * k); for (const key in this.downPose) pose[key] = this.downPose[key] * k;
        Object.assign(pose, { spX: (this.fdz > 0 ? 0.9 : 0.6) * m, knL: 1.5 * m, knR: 1.3 * m, pelY: -0.38 * m, hipLx: -0.8 * m, hipRx: -0.5 * m, shLx: -0.8 * m, shRx: -0.6 * m });
        if (this.st > 1.0) { this.setState('stalk'); this.bal = 0.75; this.cool = Math.max(this.cool, 0.4); }
        break;
      }
      case 'crawl': { // a leg is gone; it drags itself on toward you anyway
        const D0 = ENTRIES[0], goal = Q.indoor && !this.inside() ? this.nav(entryOpen(D0) || door.crawl ? D0.in : D0.out, dt) : (!Q.indoor && this.inside() ? D0.out : Q.pos);
        const want = Math.atan2(goal.x - this.pos.x, goal.z - this.pos.z); this.yaw += clamp(angDiff(this.yaw, want), -0.9 * dt, 0.9 * dt);
        this.ph += dt * 3.2; const pull = Math.max(0, Math.sin(this.ph)), f = this.fwd();
        const spd = (canHunt ? 0.25 + 0.55 * pull : 0) * (this.seen > 0 || this.aware > 0.9 ? 1 : 0.4) * [0.22, 0.6, 1][this.arms] * (this.frenzy > 0 ? 1.15 : 1);
        this.vel.x = f.x * spd; this.vel.z = f.z * spd;
        hard = { bodyX: 1.45, bodyZ: 0, bodyY: 0.13 * (T.girth > 1.2 ? 1.4 : 1) };
        const s = Math.sin(this.ph), c = Math.cos(this.ph);
        pose = { shLx: -2.7 + s * 0.6, shRx: -2.7 - s * 0.6, shLz: 0.35, shRz: -0.35, elL: 0.6 + Math.max(0, c) * 0.9, elR: 0.6 + Math.max(0, -c) * 0.9, headX: -0.85, headY: Math.sin(G.t * 2) * 0.15, jaw: 0.6 + Math.sin(G.t * 7) * 0.3, spX: -0.15, hipLx: 0.1 + s * 0.15, hipRx: 0.1 - s * 0.15, knL: 0.3, knR: 0.3 };
        for (const sd of ['L', 'R']) { const st = this.body.arm[sd]; if (st === 'broken' || st === 'dislocated') { pose['sh' + sd + 'x'] = -0.6; pose['sh' + sd + 'z'] = sd === 'L' ? 0.15 : -0.15; pose['el' + sd] = st === 'broken' ? -0.4 : 0.1; } else if (st === 'severed') pose['sh' + sd + 'x'] = -1.6 + (sd === 'L' ? s : -s) * 0.3; }
        if (!this.arms) { pose.spZ = Math.sin(this.ph * 2) * 0.2; pose.hipLx = s * 0.4; pose.hipRx = -s * 0.4; } // no hands: it wriggles on its shoulders
        const head = this.pos.clone().addScaledVector(f, 1.45);
        if (canHunt && head.distanceTo(Q.pos) < 0.75 && grabbable(Q) && attackersBusy(Q) === 0 && this.arms >= 1) { preyPin(this, Q); break; }
        if (this.voiceT < 0) { SND.growl(this.pos, 0.55, rnd(0.8, 1.3)); this.voiceT = rnd(2.5, 5); }
        break;
      }
      case 'pinning': {
        this.vel.set(0, 0, 0);
        const H = this.holding || P, f = fwdOf(H.yaw); this.pos.copy(H.pos).addScaledVector(f, this.crawler ? 1.75 : 0.62); this.yaw = H.yaw + Math.PI;
        if (this.crawler) { hard = { bodyX: 1.3, bodyZ: 0, bodyY: 0.2 }; pose = { shLx: -2.9, shRx: -2.8, shLz: 0.25, shRz: -0.25, elL: 0.9 + Math.sin(G.t * 17) * 0.1, elR: 0.8, headX: -0.5 + Math.sin(G.t * 11) * 0.1, jaw: 0.6 + Math.sin(G.t * 9) * 0.4 }; }
        else pose = { spX: 0.95, shLx: -1.45, shRx: -1.4, elL: 0.9 + Math.sin(G.t * 17) * 0.1, elR: 0.85, headX: 0.25 + Math.sin(G.t * 11) * 0.08, jaw: 0.6 + Math.sin(G.t * 9) * 0.4, knL: 0.7, knR: 0.9, pelY: -0.28 };
        if (this.voiceT < 0) { SND.growl(this.pos, 0.9, 0.7); this.voiceT = 0.8; }
        break;
      }
      case 'flee': {
        this.moveTo(this.fleeTo, T.speed * 1.4, dt);
        if (sp > 0.2) this.yaw += angDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-10 * dt));
        pose = Object.assign(this.gait(1, 1), { shLx: -0.6, shRx: -0.5, headX: 0.1, spX: 0.4 });
        if (this.st > 5 || this.pos.distanceTo(this.fleeTo) < 0.6) { this.setState('lurk'); this.ang = Math.atan2(this.pos.x - LURK_C.x, this.pos.z - LURK_C.z); this.aware = Math.min(this.aware, 0.6); }
        break;
      }
      case 'scout': { // the leader walks the walls and tests each way in
        if (!SIEGE.on) { this.setState('lurk'); break; }
        if (G.mode !== 'play') break;
        const en = this.scoutList[0];
        if (!en) { SIEGE.scoutDone = true; planSiege(); if (this.state === 'scout') this.setState('siege'); break; }
        const wp = this.nav(en.out, dt), d = Math.hypot(en.out.x - this.pos.x, en.out.z - this.pos.z);
        if (d > 0.45) { const to = wp.clone().sub(this.pos).setY(0), l = to.length(); this.moveDir(l > 0.01 ? to.divideScalar(l) : new V3(), T.speed * this.mobility(), dt); if (sp > 0.2) this.yaw += angDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-6 * dt)); pose = Object.assign(this.gait(clamp(sp / 2, 0, 1)), { spX: 0.35, headX: -0.2 }); }
        else {
          this.moveDir(new V3(), 0, dt, 8); this.face(en.in, dt, 6); this.scoutT += dt;
          pose = en.kind === 'door' ? { spX: 0.25 + Math.max(0, Math.sin(this.scoutT * 9)) * 0.2, shLx: -1.5, shRx: -1.4, elL: 0.4, elR: 0.4, headX: -0.1 } : { spX: 0.15, headX: -0.35, headY: Math.sin(this.scoutT * 3) * 0.3, shLx: -1.1, elL: 1.2 };
          if (this.scoutT > 0.7 && !this.scoutTested) {
            this.scoutTested = true; SIEGE.known[en.id] = true; const lp = this.headPos();
            if (en.kind === 'door') { doorPound(0.4); if (!door.barred && this.arms >= 1 && !doorBraced()) { door.target = 1.35; door.angV = 2.5; SND.creak(ENTRIES[0].out); floatLabel('推门：没闩——开了', lp, 'heavy', 1.6); } else floatLabel(door.barred ? '推门：闩着' : doorBraced() ? '推门：有人从里面顶着' : '推门：关着', lp, 'roar', 1.6); }
            else floatLabel('看' + en.name + '：' + (en.glass ? '玻璃' : '没玻璃') + ' · 木板 ' + en.boards.filter(b => b.hp > 0).length + ' 块', lp, 'roar', 1.6);
          }
          if (this.scoutT > 1.25) { this.scoutList.shift(); this.scoutT = 0; this.scoutTested = false; }
        }
        break;
      }
      case 'siege': {
        if (!SIEGE.on && G.mode === 'play') { this.setState(this.inside() ? 'stalk' : 'lurk'); break; }
        if (this.inside()) { this.setState('stalk'); break; }
        if (G.mode !== 'play') { this.moveDir(new V3(), 0, dt, 6); break; }
        if (!Q.dead && !Q.indoor && this.seeT < 1.5 && dP < 12) { this.entry = null; this.setState('stalk'); break; } // someone out in the yard with it: that comes first
        const en = this.entry;
        let goal;
        if (!en) { // no plan yet: prowl the walls, growling
          if (!this.prowl || this.pos.distanceTo(this.prowl) < 0.6) { const a = rnd(0, 6.28); this.prowl = new V3(Math.sin(a) * 5.4, 0, Math.cos(a) * 5.0 + 0.6); }
          goal = this.prowl;
        } else goal = this.entrySpot(en);
        const d = Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z);
        if (d > 0.32 || !en) {
          const wp = this.nav(goal, dt), to = wp.clone().sub(this.pos).setY(0), l = to.length();
          this.moveDir(l > 0.01 ? to.divideScalar(l) : new V3(), (en ? T.speed * 0.9 : 1.2) * this.mobility(), dt);
          if (sp > 0.2) this.yaw += angDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-7 * dt)); else this.face(new V3(0, 0, 0), dt, 2);
          pose = Object.assign(this.gait(clamp(sp / 2.5, 0, 1), clamp((sp - 2.2) / 1.5, 0, 1)), { spX: 0.35, headX: -0.25, shLx: -0.4, shRx: -0.4, elL: 0.5, elR: 0.5 });
          if (this.voiceT < 0) { SND.growl(this.pos, 0.5, rnd(0.7, 1.2)); this.voiceT = rnd(3, 7); }
        } else {
          this.moveDir(new V3(), 0, dt, 8); this.face(en.in, dt, 8);
          const queued = en.kind === 'window' && this.slotN > 0;
          if (entryOpen(en)) { if (en.kind === 'door') this.setState('enter'); else if (!queued || !infected.some(o => o !== this && o.state === 'climb' && o.climb && o.climb.en === en)) this.startClimb(en, false); }
          else if (en.kind === 'door' && door.crawl && !this.hasAxe) this.startClimb(en, true);
          else if (!queued) this.startWork(en);
          pose = { spX: 0.3, headX: -0.3, shLx: -0.5, shRx: -0.5, elL: 0.6, elR: 0.6, jaw: 0.3 + Math.max(0, Math.sin(G.t * 3)) * 0.3 };
        }
        break;
      }
      case 'work': {
        const en = this.entry; this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (G.mode !== 'play') break;
        if (!SIEGE.on || !en || this.inside()) { this.setState(this.inside() ? 'stalk' : 'siege'); break; }
        if (entryOpen(en) || (en.kind === 'door' && door.crawl && !this.hasAxe && this.workKind !== 'reach')) { this.setState('siege'); break; }
        this.face(en.in, dt, 8); this.workT += dt;
        const W = this.workKind, t = this.workT, fz = this.frenzy > 0 ? 0.8 : 1;
        if (W === 'chop') { // a firefighter at a door: many blows, each one a cut in the wood
          const cyc = 1.5 * fz, a = t / cyc; pose = chopPose(a);
          if (!this.swung && a > 0.62) { this.swung = true; const c = this.chopTarget(); doorChop(c.x, c.y, 1); springKick(h, 'spX', 2); }
          if (t > cyc) { this.workT = 0; this.swung = false; this.workN++; if (!door.barred) this.workKind = this.arms >= 1 ? 'open' : 'pound'; else if (door.reach && this.arms >= 1) this.workKind = 'reach'; }
        } else if (W === 'ram') { // back up, run at it shoulder first
          const cyc = 1.9 * fz, a = t / cyc, outN = en.out.clone().sub(en.in).setY(0).normalize();
          if (a < 0.37) { this.moveDir(outN, 1.0, dt, 10); pose = { spX: 0.15, shLx: -0.3, shRx: -0.3, knL: 0.3, knR: 0.3 }; }
          else if (a < 0.53) { this.moveDir(outN.clone().negate(), 4.2, dt, 14); pose = { spX: 0.5, chY: 0.6, shRx: -0.4, shRz: -0.1, shLx: -0.8, elL: 1.4, hipLx: -0.6, knR: 0.5, headY: -0.4 }; }
          else { this.moveDir(new V3(), 0, dt, 8); pose = { spX: 0.2, chY: 0.3 * (1 - a), headX: -0.3 }; }
          if (!this.swung && a > 0.52) { this.swung = true; doorRam(this.type === 'butcher' ? 1.0 : 0.55); this.vel.addScaledVector(outN, 1.6); springKick(h, 'spX', -4); springKick(h, 'chY', -5); }
          if (t > cyc) { this.workT = 0; this.swung = false; this.workN++; if (!door.barred && this.T.smart >= 0.5 && this.arms >= 1) this.workKind = 'open'; else if (door.barred && door.reach && this.arms >= 1 && this.workN > 3) this.workKind = 'reach'; }
        } else if (W === 'pound') { // fists on the boards
          const cyc = 0.8 * fz, a = t / cyc, s = Math.sin(a * Math.PI * 2);
          pose = { spX: 0.35, shLx: -1.7 + s * 0.5, shRx: -1.7 - s * 0.5, elL: 0.6 + Math.max(0, -s) * 0.8, elR: 0.6 + Math.max(0, s) * 0.8, headX: -0.2, jaw: 0.7 };
          if (!this.swung && a > 0.45) { this.swung = true; doorPound(this.type === 'butcher' ? 1.2 : 0.7); }
          if (t > cyc) { this.workT = 0; this.swung = false; this.workN++; if (door.barred && door.reach && this.arms >= 1 && this.workN > 4) this.workKind = 'reach'; if (!door.barred && this.T.smart >= 0.5 && this.arms >= 1) this.workKind = 'open'; }
        } else if (W === 'reach') { // an arm in through the hole, feeling for the bar
          pose = { spX: 0.55, shRx: -1.55, shRz: 0.15, elR: 0.1 + Math.sin(t * 7) * 0.15, shLx: -0.8, elL: 0.8, headX: -0.1, headY: 0.4, chY: -0.4 };
          if (t > 1.7 && door.barred) { liftBar(true); this.workKind = 'open'; this.workT = 0; }
          else if (!door.barred) { this.workKind = 'open'; this.workT = 0; }
        } else if (W === 'open') { // a hand on the latch, a shove
          pose = { spX: 0.3, shRx: -1.4, elR: 0.5, shLx: -1.2, elL: 0.6 };
          if (door.barred) { this.workKind = this.hasAxe ? 'chop' : 'pound'; this.workT = 0; }
          else if (t > 0.6 && doorBraced()) { floatLabel('门被人从里面顶住了', this.headPos(), 'roar', 1.4); this.workKind = this.type === 'butcher' ? 'ram' : 'pound'; this.workT = 0; }
          else if (t > 0.6) { door.latch = 0; door.target = 1.35; door.angV = 2.8; SND.creak(ENTRIES[0].out); this.setState('siege'); }
        } else if (W === 'smash') { // one punch through the glass, and a cut arm for it
          const a = t / 0.9; pose = a < 0.6 ? { spX: -0.1, shRx: -0.6 - 1.0 * smooth(0, 0.6, a), elR: 1.6, chY: 0.4 } : { spX: 0.5, shRx: -1.6, elR: 0.1, chY: -0.4 };
          if (!this.swung && a > 0.65) { this.swung = true; smashGlass(en); this.body.bleed += 0.25; paintWound(this.h.coatMat, 1, false); }
          if (t > 0.9) { this.workKind = 'pry'; this.workT = 0; this.swung = false; }
        } else if (W === 'pry') { // fists and shoulders against the boards until the nails give
          const cyc = 1.1 * fz, a = t / cyc, s = Math.sin(a * Math.PI * 2);
          pose = { spX: 0.45 + Math.max(0, s) * 0.2, shLx: -1.9 + s * 0.4, shRx: -1.9 - s * 0.4, elL: 0.4, elR: 0.4, headX: -0.15, jaw: 0.8 };
          if (!this.swung && a > 0.5) { this.swung = true; hitBoard(en, (this.type === 'butcher' ? 1.6 : 1) * (this.frenzy > 0 ? 1.2 : 1)); }
          if (t > cyc) { this.workT = 0; this.swung = false; }
        }
        if (this.voiceT < 0) { SND.growl(this.pos, 0.6, rnd(0.6, 1)); this.voiceT = rnd(2, 4); }
        break;
      }
      case 'enter': { // through the open doorway; whoever stands in it gets it first
        if (canHunt && dP < 2.6) { this.setState('stalk'); break; }
        const tgt = ENTRIES[0].in; this.moveTo(tgt, T.speed * 0.9 * this.mobility(), dt);
        if (sp > 0.2) this.yaw += angDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-8 * dt));
        if ((this.inside() && this.pos.distanceTo(tgt) < 0.9) || this.st > 3) this.setState('stalk');
        pose = Object.assign(this.gait(clamp(sp / 2.5, 0, 1)), { spX: 0.35, headX: -0.2 });
        break;
      }
      case 'exit': { // you went back outside; it goes out the way it can
        const D0 = ENTRIES[0], tgt = entryOpen(D0) ? D0.out : D0.in; this.moveTo(tgt, T.speed * 0.9 * this.mobility(), dt);
        if (sp > 0.2) this.yaw += angDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-8 * dt));
        if (!entryOpen(D0) && this.pos.distanceTo(D0.in) < 0.7) { this.face(D0.out, dt, 8); if (this.st > 1.0) { if (door.barred) liftBar(false); door.latch = 0; door.target = 1.35; door.angV = 2.5; SND.creak(D0.in); this.st = 0; } }
        if (!this.inside()) this.setState('stalk');
        if (Q.indoor) this.setState('stalk');
        pose = Object.assign(this.gait(clamp(sp / 2.5, 0, 1)), { spX: 0.35, headX: -0.2 });
        break;
      }
      case 'climb': {
        const C = this.climb; if (!C) { this.setState('stalk'); break; }
        C.t += dt; const k = Math.min(1, C.t / C.dur); this.vel.set(0, 0, 0);
        const lift = C.low ? 0.03 : C.sill - 0.55; let p, y;
        if (k < 0.35) { const u = smooth(0, 0.35, k); p = C.p0.clone().lerp(C.pa, u); y = lerp(groundY(C.p0.x, C.p0.z), lift, u); }
        else if (k < 0.75) { const u = smooth(0.35, 0.75, k); p = C.pa.clone().lerp(C.pb, u); y = lift + Math.sin(u * Math.PI) * (C.low ? 0 : 0.12); }
        else { const u = smooth(0.75, 1, k); p = C.pb.clone().lerp(C.p2, u); y = lerp(lift, 0, Math.min(1, u * 1.6)); }
        this.pos.copy(p); this.climbY = y; this.yaw = Math.atan2(-C.outN.x, -C.outN.z);
        pose = climbPose(k, C.low); if (C.low) hard = { bodyX: 1.25, bodyZ: 0, bodyY: 0.12 };
        if (k >= 1) { this.climb = null; this.climbY = 0; SND.thud(this.pos); makeNoise(this.pos, 8, 'land'); floatLabel(C.low ? '它从门洞里钻进来了' : '它从' + C.en.name + '翻进来了', this.headPos(), 'heavy', 1.6); this.setState(this.crawler ? 'crawl' : 'stalk'); }
        break;
      }
      case 'axeWind': { // the axe comes up over its head: everyone can see this coming
        this.moveDir(new V3(), 0, dt, 10); this.face(Q.pos, dt, 6);
        pose = chopPose(0.48 * smooth(0, 0.8, this.st)); pose.jaw = 0.8;
        if (this.st > 0.85) { this.setState('axeSwing'); this.swung = false; SND.shriek(this.pos, 0.5); }
        break;
      }
      case 'axeSwing': {
        pose = chopPose(0.5 + 0.35 * smooth(0, 0.2, this.st)); this.moveDir(this.fwd(), 1.4, dt, 10);
        if (!this.swung && this.st > 0.15) {
          this.swung = true; SND.swing(this.pos, true);
          let victim = null, vd = 2.0; // the blade comes down on whoever is in front of it
          for (const q of PREY) {
            if (q.dead || q.invuln > 0 || !openingBetween(this.pos, q.pos)) continue; const d = q.pos.clone().sub(this.pos).setY(0), l = d.length();
            if (l < vd && d.normalize().dot(this.fwd()) > 0.55) { if (q.state === 'dodge' || q.dodging) { floatLabel('躲开了斧头', q.pos.clone().add(new V3(0, 1.9, 0)), 'heavy'); continue; } vd = l; victim = q; }
          }
          if (victim) preyAxe(this, victim);
        }
        if (this.st > 0.5) { this.setState('recover'); this.cool = rnd(1.8, 2.6); releaseToken(); }
        break;
      }
      case 'grab': { // it has your collar in both fists and drags your neck toward its teeth
        const H = this.holding || P;
        if (H.state !== 'clinch' || H.clinchBy !== this) { this.holding = null; this.setState('recover'); this.cool = Math.max(this.cool, 1); break; }
        const f = fwdOf(H.yaw), b = Math.sin(G.t * 9); this.pos.copy(H.pos).addScaledVector(f, 0.55); this.yaw = H.yaw + Math.PI; this.vel.set(0, 0, 0);
        pose = { spX: 0.45 + Math.max(0, b) * 0.15, shLx: -1.6, shRx: -1.55, shLz: -0.15, shRz: 0.15, elL: 0.9, elR: 0.95, headX: 0.15 + Math.max(0, b) * 0.25, headY: Math.sin(G.t * 5) * 0.2, jaw: 0.5 + Math.max(0, b) * 0.5, knL: 0.3, knR: 0.4 };
        if (this.voiceT < 0) { SND.growl(this.pos, 0.9, 0.5); this.voiceT = 0.7; }
        break;
      }
      case 'takendown': { // your arm round its head, then the knife; it fights it, then it's gone
        this.vel.set(0, 0, 0);
        pose = this.tdLimp ? { headX: 0.7, spX: 0.35, shLx: 0.1, shRx: 0.1, elL: 0.1, elR: 0.1, knL: 0.55, knR: 0.5, pelY: -0.15, jaw: 0.4 } : { shLx: -2.4, shRx: -2.2, shLz: -0.3, shRz: 0.3, elL: 1.6, elR: 1.5, headX: -0.5, spX: -0.2, knL: 0.2, jaw: 0.15, headY: Math.sin(G.t * 23) * 0.15 };
        if (!this.tdLimp) springKick(h, 'spZ', rnd(-1.5, 1.5));
        break;
      }
      case 'ko': { // out cold: twitching, a rattle of breath, still bleeding into the mud
        this.vel.multiplyScalar(Math.exp(-6 * dt)); hard = this.fallHard(1.5); pose = Object.assign({}, this.downPose);
        if (Math.random() < dt * 1.3) springKick(h, ['elL', 'elR', 'knL', 'knR', 'headX', 'shLx', 'shRx'][Math.floor(Math.random() * 7)], rnd(-4, 4));
        if (this.voiceT < 0) { SND.exhale(this.pos, this.T.voice * 0.8, 0.22); this.voiceT = rnd(2, 4); }
        break;
      }
      case 'startle': {
        this.vel.multiplyScalar(Math.exp(-4 * dt));
        const k = 1 - smooth(0.45, 0.8, this.st);
        pose = { spX: -0.25 * k, headX: 0.35 * k, headY: 0.4 * k, shLx: -2.4 * k, elL: 2.1 * k, shLz: 0.1, shRx: -1.6 * k, elR: 1.8 * k, shRz: -0.3 * k, knL: 0.3 * k, knR: 0.2 * k, hipLx: 0.3 * k, jaw: 0.7 * k };
        if (this.st > 0.8) this.setState(Q.dead ? 'lurk' : Q.indoor !== this.inside() ? (SIEGE.on && !this.inside() ? 'siege' : 'lurk') : 'stalk');
        break;
      }
    }
    if (this.dead) { this.updateDead(dt); return; }
    if (this.standing && this.state !== 'pinning') {
      if (this.shielding && this.state !== 'startle' && this.state !== 'stumble') Object.assign(pose, { shLx: -2.35, elL: 2.15, shLz: 0.15, shLy: 0.3, headX: (pose.headX || 0) + 0.25 });
      if (this.flinchT > 0) Object.assign(pose, { spX: (pose.spX || 0) - 0.15, headX: -0.3 });
      if (this.roarT > 0) { const k = Math.min(1, this.roarT * 3, (this.roarDur - this.roarT) * 6 + 0.2); Object.assign(pose, { headX: lerp(pose.headX || 0, -0.65, k), jaw: 1, chX: -0.2 * k, spX: lerp(pose.spX || 0, -0.12, k), shLz: lerp(pose.shLz || 0.08, 0.55, k), shRz: lerp(pose.shRz || -0.08, -0.55, k), elL: 0.9, elR: 0.9 }); }
      if (this.lookT > 0 && this.lookAt) { const a = clamp(angDiff(this.yaw, Math.atan2(this.lookAt.x - this.pos.x, this.lookAt.z - this.pos.z)), -1.1, 1.1); pose.headY = (pose.headY || 0) + a * 0.8; pose.chY = (pose.chY || 0) + a * 0.3; }
      if (this.state !== 'stumble') pose.headZ = (pose.headZ || 0) + Math.sin(G.t * 1.7 + this.mood * 7) * 0.08;
    }
    if (this.state !== 'down' && this.state !== 'crawl' && this.state !== 'getup') for (const sd of ['L', 'R']) {
      const st = this.body.arm[sd], k = sd === 'L' ? 1 : -1, sw = Math.sin(this.ph) * 0.25 * clamp(sp / 2, 0, 1); if (st === 'ok') continue;
      if (st === 'broken') { pose['sh' + sd + 'x'] = 0.15 + sw; pose['sh' + sd + 'z'] = k * 0.06; pose['el' + sd] = -0.6; }
      else if (st === 'dislocated') { pose['sh' + sd + 'x'] = 0.08 + sw; pose['sh' + sd + 'z'] = -k * 0.14; pose['sh' + sd + 'y'] = k * 0.9; pose['el' + sd] = 0.05; }
      else { pose['sh' + sd + 'x'] = (pose['sh' + sd + 'x'] || 0) * 0.6 - 0.25; pose['sh' + sd + 'z'] = k * 0.3; }
    }
    if (!this.body.jaw) pose.jaw = 1.15; // the jaw hangs
    // dangling limbs swing with the body's acceleration
    const ax = (this.vel.x - this.prevVel.x), az = (this.vel.z - this.prevVel.z); this.prevVel.copy(this.vel);
    if (h.sprK) { const la = toLocal({ x: ax, z: az }, this.yaw); for (const sd of ['L', 'R']) { const st = this.body.arm[sd]; if (st === 'broken' || st === 'dislocated') { springKick(h, 'sh' + sd + 'x', clamp(la.z, -4, 4) * 0.9); springKick(h, 'sh' + sd + 'z', clamp(-la.x, -4, 4) * 0.9); } } }
    const glow = this.state === 'windup' || this.state === 'lunge' || this.rage > 0 ? 3.2 : 0.9; for (const e of h.eyes) e.material.emissiveIntensity = damp(e.material.emissiveIntensity, glow, 10, dt);
    // integrate, then bodies collide: with each other (momentum carries over), with posts, with the porch edge
    if (this.state !== 'pinning' && this.state !== 'climb' && this.state !== 'grab' && this.state !== 'takendown') {
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      const flying = (this.state === 'stumble' || (this.state === 'down' && !this.landed)) && sp > 1.7;
      for (const o of infected) if (o !== this && !o.dead) {
        const d = this.pos.clone().sub(o.pos); d.y = 0; const l = d.length();
        if (l < 0.72 && l > 0.001) {
          if (flying && this.bumpT <= 0 && o.bumpT <= 0 && o.standing && o.state !== 'pinning' && this.vel.dot(d) < 0) this.bump(o, d.clone().divideScalar(-l), sp);
          if (o.standing || this.standing) this.pos.addScaledVector(d, (0.72 - l) / l * 0.5);
        }
      }
      if (this.standing) for (const q of PREY) { if (q.dead || q.state === 'pinned' || q.state === 'down') continue; const d = this.pos.clone().sub(q.pos); d.y = 0; const l = d.length(); if (l < 0.6 && l > 0.001) this.pos.addScaledVector(d, (0.6 - l) / l * (q.isPlayer ? 1 : 0.5)); }
      let wall = false; const ins = this.inside();
      for (const c of colliders) if ((ins || c.tag === 'post' || c.tag === 'rail' || c.tag === 'wall' || c.tag === 'door') && pushOut(this.pos, c, 0.3)) wall = true;
      if (wall && flying && this.bumpT <= 0) this.slam();
      const dc = this.pos.clone().sub(LURK_C); dc.y = 0; if (dc.length() > 21) this.pos.copy(LURK_C).addScaledVector(dc.normalize(), 21);
    }
    this.pos.y = this.state === 'climb' ? this.climbY : groundY(this.pos.x, this.pos.z);
    if (this.state !== 'crawl') this.ph += dt * Math.max(this._sp, 0.001) * gaitK(this._sp, this.h.s);
    // an axe hanging from a slack arm drags its head through the mud
    if (this.hasAxe && this.standing && !['work', 'axeWind', 'axeSwing', 'climb', 'pinning'].includes(this.state)) { pose.shRx = 0.04 + Math.sin(this.ph) * 0.08 * clamp(sp / 2, 0, 1); pose.elR = 0.12; pose.shRz = -0.12; if (sp > 0.6 && Math.random() < dt * 0.8) SND.scrape(this.pos); }
    springStep(h, dt);
    poseTo(h, pose, this.state === 'down' ? 9 : this.state === 'stumble' ? 14 : 10, dt, hard);
    h.root.position.copy(this.pos); h.root.rotation.y = this.yaw;
  }
}
new Infected('butcher', 0.55); new Infected('student', -0.9); new Infected('office', 2.0); new Infected('fireman', -2.3);
