/* ===== P7b defenders: your people. Posts and orders, a weapon each, stamina, morale, blood — and they can be bitten too ===== */
/* --------- their gear --------- */
function makeSpear() { // a kitchen knife lashed to an ash pole: reach that keeps the teeth away
  const g = new THREE.Group();
  const wd = new THREE.MeshStandardMaterial({ map: toTex(woodCanvas('#8a6a46', 20, 128, 128, 91, 0.5)), roughness: 0.75 });
  const shaft = mesh(new THREE.CylinderGeometry(0.02, 0.024, 2.1, 8), wd, 0, -0.55, 0); g.add(shaft);
  const steel = new THREE.MeshStandardMaterial({ color: 0xa9adb1, roughness: 0.3, metalness: 0.85 });
  const blade = mesh(new THREE.ConeGeometry(0.03, 0.3, 4), steel, 0, -1.74, 0); blade.rotation.x = Math.PI; blade.scale.z = 0.35; g.add(blade);
  g.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x3a2f24, roughness: 1 }), 0, -1.55, 0));
  g.userData = { shaft, tip: new V3(0, -1.85, 0), stain: [steel] };
  return g;
}
function makeShield() { // planks and two iron straps; it rides on the forearm in front of the chest
  const g = new THREE.Group();
  const wd = new THREE.MeshStandardMaterial({ map: toTex(woodCanvas('#5a4630', 18, 128, 128, 93, 0.6)), roughness: 0.85 });
  g.add(mesh(boxGeo(0.5, 0.78, 0.035, 0.9), wd, 0, 0, 0));
  [-0.28, 0.28].forEach(y => g.add(mesh(new THREE.BoxGeometry(0.52, 0.045, 0.012), matIron, 0, y, 0.022)));
  g.userData = { stain: [wd] };
  return g;
}
function makePipe() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x5a5d60, roughness: 0.45, metalness: 0.8 });
  const shaft = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.78, 10), m, 0, -0.3, 0); g.add(shaft);
  g.add(mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.06, 10), m, 0, -0.67, 0)); // a coupling on the end
  g.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.15, 8), new THREE.MeshStandardMaterial({ color: 0x222020, roughness: 1 }), 0, 0.02, 0));
  g.userData = { shaft, tip: new V3(0, -0.7, 0), stain: [m] };
  return g;
}
function makeMachete() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.13, 0.028), new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.9 }), 0, 0, 0));
  const steel = new THREE.MeshStandardMaterial({ color: 0x9da2a6, roughness: 0.35, metalness: 0.85 });
  g.add(mesh(new THREE.BoxGeometry(0.006, 0.5, 0.05), steel, 0, -0.31, -0.008));
  const tip = mesh(new THREE.BoxGeometry(0.006, 0.08, 0.04), steel, 0, -0.58, -0.003); tip.rotation.x = 0.4; g.add(tip);
  g.userData = { tip: new V3(0, -0.6, 0), stain: [steel] };
  return g;
}

/* --------- who they are --------- */
const DEF_T = {
  zhao: { name: '小赵', role: '盾牌 · 铁管', kit: 'shield', post: 'door', nerve: 0.5, str: 1.0, weight: 72, voice: 1.05, line: '门我顶着。',
    look: { height: 1.78, girth: 0.98, skin: '#c99a78', top: '#2f3c52', coat: '#30394a', bottom: '#2a2d33', shoes: '#1c1915', hair: '#120c09', hairStyle: 'messy', seed: 73 } },
  zhou: { name: '老周', role: '长矛', kit: 'spear', post: 'back', nerve: 0.85, str: 1.1, weight: 80, voice: 0.85, line: '后窗我看着。',
    look: { height: 1.72, girth: 1.1, skin: '#b88a68', top: '#4a5240', coat: '#3f4637', bottom: '#2e2c28', shoes: '#1b1612', hair: '#6b6660', hairStyle: 'sparse', cap: '#3a3f33', seed: 71 } },
  mei: { name: '阿梅', role: '砍刀 · 护士', kit: 'machete', post: 'center', nerve: 0.65, str: 0.85, weight: 58, voice: 1.45, medic: true, line: '谁伤了喊我。',
    look: { female: true, height: 1.63, girth: 0.9, skin: '#d4a98a', top: '#6e7f84', bottom: '#2b2f36', shoes: '#211a15', hair: '#1a120c', hairStyle: 'bun', scarf: '#8a3a3a', seed: 77 } }
};
// where they can be put. Yaw faces the way they watch: +z the door, -z the back window, -x the side window
const POSTS = {
  door: { name: '正门', p: new V3(0.12, 0, 2.55), face: 0, entry: 'door' },
  back: { name: '后窗', p: new V3(-1.0, 0, -2.38), face: Math.PI, entry: 'back' },
  left: { name: '侧窗', p: new V3(-2.72, 0, 1.6), face: -Math.PI / 2, entry: 'left' },
  center: { name: '屋中', p: new V3(0.25, 0, 0.35), face: 0, entry: null },
  porch: { name: '门廊', p: new V3(0, 0, 4.35), face: 0, entry: null },
  fallback: { name: '第二道防线', p: new V3(-0.45, 0, -0.55), face: 0, entry: null }
};
const POST_KEYS = ['door', 'back', 'left', 'center', 'porch'];
const ENTRY_POST = { door: 'door', back: 'back', left: 'left' };
const ORDER_NAMES = { hold: '守住', fallback: '后撤', plug: '堵缺口', sally: '出击', focus: '打头领' };
const ORDER_SHOUT = { hold: '守住位置！', fallback: '往里撤！', plug: '去堵缺口！', sally: '冲出去！', focus: '打那个领头的！' };
const ACK = { hold: ['守住！', '收到，守着。', '这儿交给我。'], fallback: ['往里退！', '后撤！', '退了退了！'], plug: ['哪儿破了我去哪儿！', '我去堵！', '来了！'], sally: ['上！', '跟它们拼了！', '出去打！'], focus: ['打那个领头的！', '盯住头领！', '先弄死带头的！'] };
const KILL_LINES = ['倒了一个！', '解决了！', '下一个！', '还有几个？'];
const defenders = [];
const _dEye = new V3(), _dTg = new V3();
const pick = a => a[Math.floor(Math.random() * a.length)];

/* --------- the doorway: someone leaning on it holds it shut --------- */
function doorBraced() {
  if (door.fallen || door.fall || door.ang > 0.1) return null;
  for (const d of defenders) if (!d.dead && ['move', 'atk'].includes(d.state) && !d.panic && Math.hypot(d.pos.x - POSTS.door.p.x, d.pos.z - POSTS.door.p.z) < 0.75) return d;
  return null;
}
function doorBurst() { const d = doorBraced(); if (d) { d.stagger(new V3(0, 0, -1), 0.9); floatLabel('门被撞开，' + d.name + '被顶了个趔趄', d.headPos(), 'heavy', 1.6); } }
// how hard each way in is being worked right now
function entryPressure(en) {
  let p = entryOpen(en) ? 1.5 : 0;
  for (const e of infected) {
    if (e.dead || (!e.standing && e.state !== 'crawl')) continue;
    if (e.state === 'climb' && e.climb && e.climb.en === en) p += 3;
    else if (e.entry === en && (e.state === 'work' || e.state === 'siege')) p += 1.5;
    else if (!insideCabin(e.pos.x, e.pos.z) && Math.hypot(e.pos.x - en.out.x, e.pos.z - en.out.z) < 2.2) p += 1;
  }
  return p;
}

/* --------- poses --------- */
const GUARD = {
  spear: { shRx: -0.55, elR: 1.05, shRz: -0.05, shLx: -1.05, elL: 0.55, shLz: 0.12, spX: 0.12, knL: 0.15, knR: 0.22, hipLx: -0.28, headX: -0.05 },
  shield: { shLx: -1.0, elL: 1.5, shLz: 0.15, shRx: -0.35, elR: 0.95, shRz: -0.12, spX: 0.14, knL: 0.22, knR: 0.22, hipLx: -0.22, headX: -0.08 },
  machete: { shRx: -0.35, elR: 0.95, shRz: -0.22, shLx: -0.3, elL: 1.55, shLz: 0.22, spX: 0.1, knL: 0.16, knR: 0.16, hipLx: -0.15 } // blade low and out, the free fist up by the chest
};
const REST_SPEAR = { shRx: -0.3, elR: 1.25, shRz: -0.08, shLx: -0.25, elL: 0.6, shLz: 0.1, spX: 0.04, knL: 0.05, knR: 0.08 }; // pole upright in front, butt on the floor
function thrustPose(a) { // draw back, drive the point straight through, pull it out
  if (a < 0.42) { const k = smooth(0, 0.42, a); return { shRx: -0.55 + 0.2 * k, elR: 1.05 + 0.45 * k, shLx: -1.05 + 0.15 * k, elL: 0.55 + 0.3 * k, spX: 0.12 - 0.17 * k, hipLx: -0.28, knR: 0.22 }; }
  if (a < 0.6) { const k = smooth(0.42, 0.6, a); return { shRx: -0.35 - 0.8 * k, elR: 1.5 - 1.15 * k, shLx: -0.9 - 0.45 * k, elL: 0.85 - 0.65 * k, spX: -0.05 + 0.4 * k, hipLx: -0.28 - 0.3 * k, knR: 0.22 + 0.15 * k, knL: 0.15 + 0.2 * k }; }
  const k = smooth(0.6, 1, a); return { shRx: -1.15 + 0.6 * k, elR: 0.35 + 0.7 * k, shLx: -1.35 + 0.3 * k, elL: 0.2 + 0.35 * k, spX: 0.35 - 0.23 * k, hipLx: -0.58 + 0.3 * k, knR: 0.37 - 0.15 * k, knL: 0.35 - 0.2 * k };
}
function bashPose(a) { // shoulder behind the shield, step in, slam it
  if (a < 0.35) { const k = smooth(0, 0.35, a); return { shLx: -1.0 + 0.2 * k, elL: 1.5 + 0.25 * k, spX: 0.14 - 0.2 * k, chY: 0.3 * k, knL: 0.3, knR: 0.3 }; }
  if (a < 0.55) { const k = smooth(0.35, 0.55, a); return { shLx: -0.8 - 0.5 * k, elL: 1.75 - 0.4 * k, spX: -0.06 + 0.5 * k, chY: 0.3 - 0.5 * k, hipLx: -0.6 * k, knR: 0.3 + 0.2 * k, knL: 0.3 }; }
  const k = smooth(0.55, 1, a); return { shLx: -1.3 + 0.3 * k, elL: 1.35 + 0.15 * k, spX: 0.44 - 0.3 * k, chY: -0.2 * (1 - k), hipLx: -0.6 * (1 - k), knR: 0.5 - 0.28 * k, knL: 0.3 - 0.08 * k };
}

class Defender {
  constructor(key) {
    const D = this.D = DEF_T[key]; this.key = key; this.name = D.name; this.isPlayer = false;
    this.h = makeHuman(Object.assign({ assetId: key }, D.look)); scene.add(this.h.root); initSprings(this.h); this.mats = collectMats(this.h);
    const hand = this.h.armR.hand;
    if (D.kit === 'spear') { this.weapon = makeSpear(); hand.add(this.weapon); this.weapon.position.set(0, -0.05, 0.02); this.weapon.rotation.set(0.15, 0, 0); }
    else if (D.kit === 'shield') {
      this.weapon = makePipe(); hand.add(this.weapon); this.weapon.position.set(0, -0.05, 0.01); this.weapon.rotation.set(0.32, 0, 0);
      this.shield = makeShield(); this.h.chest.add(this.shield); this.shield.position.set(0.05, -0.16 * this.h.s, 0.27); this.shieldZ = 0.27;
    } else { this.weapon = makeMachete(); hand.add(this.weapon); this.weapon.position.set(0, -0.05, 0.01); this.weapon.rotation.set(0.32, 0, 0); }
    this.pos = new V3(); this.vel = new V3(); this.prevVel = new V3(); this.customP = new V3(); this.goal = new V3(); this.lastP = new V3(); this.dodgeDir = new V3();
    // a card in the squad panel and a tag over the head
    const card = document.createElement('div'); card.className = 'dcard';
    card.innerHTML = '<div class="dtop"><b class="dname"></b><span class="drole"></span></div><div class="dorder"></div>'
      + '<div class="dbars"><i class="dblood" title="血"><b></b></i><i class="dsta" title="体力"><b></b></i><i class="dmor" title="士气"><b></b></i></div><div class="dstat"></div>';
    card.querySelector('.dname').textContent = D.name; card.querySelector('.drole').textContent = D.role;
    $('squad').appendChild(card); this.card = card;
    this.cEls = { order: card.querySelector('.dorder'), blood: card.querySelector('.dblood b'), sta: card.querySelector('.dsta b'), mor: card.querySelector('.dmor b'), stat: card.querySelector('.dstat') };
    card.addEventListener('mousedown', ev => { ev.stopPropagation(); if (CMD.on) cmdSelect(this, ev.shiftKey); });
    const tag = document.createElement('div'); tag.className = 'dtag'; $('labels').appendChild(tag); this.tag = tag; this.tagText = '';
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xe39a4c, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
    defenders.push(this); PREY.push(this); this.reset();
  }
  reset() {
    const D = this.D; this.post = D.post; this.order = 'hold';
    this.pos.copy(POSTS[this.post].p); this.pos.y = groundY(this.pos.x, this.pos.z); this.vel.set(0, 0, 0); this.yaw = POSTS[this.post].face;
    Object.assign(this, { state: 'move', st: 0, stamina: 100, staDelay: 0, morale: 0.5 + 0.4 * D.nerve, blood: 100, bleed: 0, art: 0, wounds: 0, bitten: false, dead: false, panic: false,
      invuln: 0, pinnedBy: null, clinchBy: null, struggle: 0, strugK: 1, clinchProg: 0, clinchNeed: 3, clinchMax: 1.6, clinchTick: 0.3, atk: null, foe: null, watch: null, cool: 0, thinkT: rnd(0, 0.3),
      sayT: 0, sayQ: null, react: 0, ctrl: false, charging: false, chargeT: 0, stepPh: 0, indoor: true, vis: 0.4, crouch: false, ph: 0, downT: 1.6, wakeT: 0, patient: null, workW: null, stuckT: 0, sideT: 0, side: 1, orderT: 0, ackT: 0, dripT: 0, barPending: false, dodging: false, paleK: 0 });
    this.h.cur = Object.assign({}, NEUTRAL); initSprings(this.h); this.h.root.visible = true; setFlash(this.mats, 0);
    if (this.h.coatMat.map) { this.h.coatMat.map.dispose(); this.h.coatMat.map = toTex(clothCanvas(D.look.coat || D.look.top, 0.55, false, D.look.seed + 7)); this.h.coatMat.needsUpdate = true; }
    for (const m of [this.h.skinMat, this.h.faceMat]) m.color.setRGB(1, 1, 1);
    if (this.shield) this.shield.position.z = this.shieldZ;
  }
  /* ---- reading the body ---- */
  lying() { return ['down', 'ko', 'pinned', 'dead'].includes(this.state); }
  chestPos() { return this.pos.clone().add(new V3(0, this.lying() ? 0.32 : 1.25 * this.h.s, 0)); }
  headPos() { return this.pos.clone().add(new V3(0, this.lying() ? 0.45 : 1.9 * this.h.s, 0)); }
  fatigue() { return smooth(0, 1, 1 - this.stamina / 32); }
  power() { return this.D.str * (1 - 0.4 * this.fatigue()) * (0.75 + 0.4 * this.morale) * (this.blood < 55 ? 0.85 : 1) * (this.bitten ? 0.95 : 1); }
  reach() { return this.D.kit === 'spear' ? 2.55 : this.D.kit === 'shield' ? 1.75 : 1.85; }
  canGrab() { return !this.dead && this.invuln <= 0 && ['move', 'atk', 'bandage', 'work', 'open', 'down', 'panic', 'ko', 'stagger'].includes(this.state); }
  spendSta(c) { this.stamina = Math.max(0, this.stamina - c); this.staDelay = 0.5; }
  say(text, force) { if (this.dead || (!force && this.sayT > 0)) return; this.sayT = 2.6; floatLabel(this.name + '：“' + text + '”', this.headPos().add(new V3(0, 0.25, 0)), 'say', 2.2); }
  yell(v = 1) { SND.shout(this.pos, this.D.voice, 0.55 * v); }
  shaken(v) { if (!this.dead) this.morale = Math.max(0, this.morale - v * (1.3 - 0.6 * this.D.nerve)); }
  /* ---- orders ---- */
  setOrder(order, quiet) {
    if (this.dead) return; this.order = order; this.patient = null; this.workW = null;
    if (this.state === 'bandage' || this.state === 'work') this.state = 'move';
    if (this.orderT <= 0) { this.morale = Math.min(1, this.morale + 0.05); this.orderT = 4; } // someone giving orders steadies them
    if (!quiet) this.ack(order);
  }
  setPost(key, p) { if (this.dead) return; this.post = key; if (p) this.customP.copy(p); this.setOrder('hold', true); this.ack('hold'); }
  ack(order) { if (this.ackT > 0 || this.panic) return; this.ackT = 1.2; this.say(pick(ACK[order]), true); this.yell(0.5); }
  postName() { return this.post === 'custom' ? '指定位置' : POSTS[this.post].name; }
  slotOffset(key) { // two or three people on one spot stand side by side
    const same = defenders.filter(d => !d.dead && (d.order === this.order || (d.order === 'hold' && this.order === 'hold')) && d.post === key); const i = same.indexOf(this);
    if (i <= 0) return new V3(); const f = POSTS[key] ? fwdOf(POSTS[key].face) : new V3(0, 0, 1), side = new V3(f.z, 0, -f.x);
    return side.multiplyScalar(i % 2 ? 0.6 : -0.6).addScaledVector(f, -0.25);
  }
  basePost() { // where its orders put it
    if (this.order === 'fallback') return POSTS.fallback.p.clone().add(this.slotOffset('fallback'));
    if (this.order === 'plug') {
      let best = null, bp = 0.9; for (const en of ENTRIES) { const p = entryPressure(en); if (p > bp) { bp = p; best = en; } }
      if (best) return POSTS[ENTRY_POST[best.id]].p.clone().add(this.slotOffset(ENTRY_POST[best.id]));
    }
    if (this.order === 'sally') return POSTS.porch.p.clone().add(this.slotOffset('porch'));
    if (this.post === 'custom') return this.customP.clone();
    return POSTS[this.post].p.clone().add(this.slotOffset(this.post));
  }
  postFace() {
    if (this.order === 'fallback' || this.order === 'sally' || this.post === 'custom' || this.order === 'plug') {
      const w = this.watch; if (w) return Math.atan2(w.pos.x - this.pos.x, w.pos.z - this.pos.z);
      if (this.post === 'custom' && !insideCabin(this.customP.x, this.customP.z)) return Math.atan2(this.customP.x, this.customP.z - 0.1);
      return this.yaw;
    }
    return POSTS[this.post].face;
  }
  /* ---- thinking: who to fight, where to stand, what to do in a lull ---- */
  think() {
    const me = this.pos; _dEye.set(me.x, me.y + 1.5, me.z);
    const P0 = this.basePost(); let foe = null, fs = 1e9, watch = null, ws = 1e9;
    const leader = SQUAD.leader && !SQUAD.leader.dead ? SQUAD.leader : null;
    for (const e of infected) {
      if (e.dead || e.state === 'takendown') continue;
      const d = Math.hypot(e.pos.x - me.x, e.pos.z - me.z); if (d > 13) continue;
      if (d > 2.2 && sightLine(_dEye, _dTg.set(e.pos.x, e.pos.y + 1.2, e.pos.z)) <= 0) continue;
      if (d < ws) { ws = d; watch = e; }
      const same = insideCabin(e.pos.x, e.pos.z) === this.indoor, reachable = same || openingBetween(me, e.pos);
      const fromPost = Math.hypot(e.pos.x - P0.x, e.pos.z - P0.z), holdingOne = e.holding && e.holding !== this;
      let s = d;
      if (holdingOne) s -= 4; // one of us is under it: everything else waits
      if (e.tgt === this && ['windup', 'lunge', 'axeWind', 'axeSwing'].includes(e.state)) s -= 2.5;
      if (e.state === 'climb') s -= 2;
      if (e.state === 'ko' || (e.state === 'down' && e.landed) || e.state === 'crawl') s += this.D.kit === 'machete' ? -0.4 : 1.2;
      if (this.order === 'focus' && e === leader) s -= 8;
      if (!reachable) s += 3;
      // the leash: unless sent out, it only takes on what comes near its spot, or what's in the room with it, or something on one of us
      if (this.order !== 'sally' && !(this.order === 'focus' && e === leader && same)) {
        const near = fromPost < 3.2 || (same && this.indoor && d < 4.6) || (holdingOne && d < 6.5);
        if (!near) continue;
      }
      if (s < fs) { fs = s; foe = e; }
    }
    if (foe !== this.foe && foe) this.react = rnd(0.3, 0.65) * (1.4 - 0.6 * this.D.nerve) * (this.morale < 0.4 ? 1.4 : 1) * (foe.tgt === this && ['windup', 'lunge'].includes(foe.state) ? 0.6 : 1); // a person needs a moment to see it and decide
    this.foe = foe; this.watch = watch;
    // a lull: patch somebody up, put a board back
    if (!foe || Math.hypot(foe.pos.x - me.x, foe.pos.z - me.z) > 4) {
      if (this.D.medic && this.order !== 'sally') {
        let pat = null, pd = 9;
        for (const q of PREY) {
          if (q.dead || q === this) continue;
          const need = q.isPlayer ? (P.wounds > 0 && !P.bandaged && P.state !== 'pinned') : ((q.bleed + q.art > 0.45 || q.state === 'ko') && q.state !== 'pinned' && q.state !== 'clinch');
          const d = q.pos.distanceTo(me); if (need && d < pd && q.indoor === this.indoor) { pd = d; pat = q; }
        }
        if (!pat && this.bleed + this.art > 0.7) pat = this; // herself, if nobody else needs it
        this.patient = pat;
      } else this.patient = null;
      this.workW = null;
      if (SIEGE.on && this.order === 'hold' && this.post !== 'custom' && POSTS[this.post].entry && POSTS[this.post].entry !== 'door' && G.planks > 0) {
        const w = POSTS[this.post].entry === 'back' ? winBack : winLeft, close = infected.some(e => !e.dead && e.standing && Math.hypot(e.pos.x - w.out.x, e.pos.z - w.out.z) < 1.8);
        if (w.torn > 0 && w.boards.length < 3 && !close && !foe) this.workW = w;
      }
    } else { this.patient = null; this.workW = null; }
  }
  /* ---- being attacked ---- */
  grabbedBy(e) {
    if (!this.canGrab()) return;
    const toE = e.pos.clone().sub(this.pos).setY(0).normalize(), facing = fwdOf(this.yaw).dot(toE), behind = facing < -0.35; e.vel.set(0, 0, 0);
    if (this.D.kit === 'shield' && !this.lying() && this.state !== 'panic' && facing > 0.3 && this.stamina > 8) { // the shield takes it — unless something heavy runs through it
      const s = 0.55 * (e.T.weight / 75) + 0.3 * this.fatigue() + rnd(-0.2, 0.2) - 0.25 * this.D.str; this.spendSta(14);
      if (s < 0.75) {
        e.vel.copy(toE).multiplyScalar(2.6); e.bal -= 0.45; e.balT = 0.5; e.cool = rnd(1.2, 2); releaseToken();
        if (e.bal <= 0) e.startFall(toLocal(toE, e.yaw), 0.7); else e.stumble(toE, 0.5);
        this.vel.addScaledVector(toE, -1.2); springKick(this.h, 'spX', -3); springKick(this.h, 'shLx', 3); SND.thud(this.pos); SND.impact(this.chestPos(), 'quick', 0.6, false);
        floatLabel('盾牌挡住了', this.headPos(), 'heavy', 1.2); this.morale = Math.min(1, this.morale + 0.04); return;
      }
      e.setState('recover'); e.cool = rnd(0.6, 1.1); releaseToken(); this.knockDown(toE.clone().negate(), 0.9); floatLabel('连人带盾被撞倒', this.headPos(), 'heavy', 1.4); return;
    }
    const s = this.lying() ? 9 : 0.45 * (e.T.weight / 75) + (behind ? 0.6 : 0) + 0.35 * this.fatigue() + (this.wounds || this.blood < 55 ? 0.25 : 0) + (0.5 - this.morale) * 0.4 + (e.arms < 2 ? -0.25 : 0) + (this.state === 'panic' ? 0.3 : 0) + rnd(-0.15, 0.15);
    if (s > 0.95) { this.pinnedByE(e); floatLabel(behind ? this.name + '被从背后扑倒' : this.name + '被扑倒了', this.headPos(), 'heavy', 1.4); return; }
    this.state = 'clinch'; this.st = 0; this.clinchBy = e; this.atk = null; this.clinchProg = 0; this.clinchTick = rnd(0.2, 0.35);
    this.clinchNeed = clamp(Math.round(1.5 + 3 * (e.T.weight / 75) * (e.arms >= 2 ? 1 : 0.6) - this.D.str), 2, 6); this.clinchMax = 1.6 + 0.3 * this.D.str;
    this.yaw = Math.atan2(toE.x, toE.z); e.setState('grab'); e.holding = this;
    SND.growl(e.pos, 0.9, 0.5, e.T.voice); this.yell(0.8); floatLabel(this.name + '被抓住了', this.headPos(), 'heavy', 1.2); makeNoise(this.pos, 7, 'struggle');
  }
  pinnedByE(e) {
    if (this.clinchBy && this.clinchBy !== e) { const c = this.clinchBy; c.holding = null; c.setState('recover'); c.cool = rnd(1, 1.6); }
    this.clinchBy = null; this.state = 'pinned'; this.st = 0; this.struggle = 0; this.strugK = rnd(0.8, 1.25); this.pinnedBy = e; this.atk = null;
    e.setState('pinning'); e.holding = this; e.vel.set(0, 0, 0);
    this.yaw = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
    SND.thud(this.pos); this.yell(1.1); makeNoise(this.pos, 9, 'struggle'); impactReact(this.h, 0, -1, 1.2, 'quick');
    this.morale = Math.max(0, this.morale - 0.1); for (const d of defenders) if (d !== this && !d.dead && d.pos.distanceTo(this.pos) < 9) d.shaken(0.04);
    if (P.pos.distanceTo(this.pos) < 16) toast(this.name + '被压在地上了！', 1.8);
  }
  breakFree(e, fromClinch) {
    this.state = 'move'; this.st = 0; this.invuln = 0.8; this.pinnedBy = null; this.clinchBy = null; this.struggle = 0;
    if (e && !e.dead) {
      e.holding = null; const away = e.pos.clone().sub(this.pos).setY(0).normalize(); releaseToken(); e.cool = rnd(1.2, 2);
      if (e.crawler) { e.setState('crawl'); e.pos.addScaledVector(away, 0.5); }
      else { e.vel.copy(away).multiplyScalar(3.2); e.bal -= 0.55; e.balT = 0.5; if (fromClinch && e.bal > 0) e.stumble(away, 0.55); else e.startFall(toLocal(away, e.yaw), fromClinch ? 0.8 : 1.1); }
    }
    floatLabel(this.name + (fromClinch ? '推开了它' : '挣脱了'), this.headPos(), 'heavy', 1.2); this.morale = Math.min(1, this.morale + 0.05); SND.exhale(this.pos, this.D.voice, 0.4);
  }
  freeFrom(e) { // whatever held it was knocked off or killed by someone else
    if (e && e.holding === this) e.holding = null;
    if (this.state === 'pinned' || this.state === 'clinch') { this.state = this.blood < 20 ? 'ko' : 'move'; this.st = 0; this.invuln = 0.8; }
    this.pinnedBy = null; this.clinchBy = null; this.struggle = 0;
  }
  bittenBy(e) {
    if (this.dead) return;
    const pinner = this.pinnedBy, first = !this.bitten; this.bitten = true; this.bleed += 1.2; this.blood -= 4;
    for (const x of [pinner, this.clinchBy, e]) if (x && !x.dead && x.holding === this) { x.holding = null; if (x.crawler) x.setState('crawl'); else { x.setState('stalk'); x.cool = 3; } } // the bite done, it lets go: first infect, then kill
    if (e && !e.dead && e.state !== 'crawl' && e.state !== 'stalk') { e.setState('stalk'); e.cool = 3; }
    this.pinnedBy = null; this.clinchBy = null; this.state = 'down'; this.st = 0; this.downT = 1.8; this.invuln = 1.2; this.atk = null;
    paintWound(this.h.coatMat, 3, true); spawnBlood(this.headPos().add(new V3(0, -0.3, 0)), new V3(0, 0.3, 0), 14, false, 0.8, 0.6); SND.shriek(this.pos, 0.3); this.yell(1.3);
    this.morale = Math.max(0, this.morale - (first ? 0.3 : 0.1));
    for (const d of defenders) if (d !== this && !d.dead && d.pos.distanceTo(this.pos) < 12) d.shaken(0.2);
    floatLabel(this.name + '被咬了', this.headPos(), 'heavy', 2); toast(this.name + '被咬了。伤口很深——潜伏期开始了。', 3.2);
    if (first) this.sayQ = { t: 2.2, text: this.D.nerve > 0.75 ? '别管我……守住！' : this.D.nerve > 0.6 ? '我……还能打。' : '不……不……' };
  }
  axedBy(e) {
    const d = this.pos.clone().sub(e.pos).setY(0).normalize(), chest = this.chestPos();
    this.wounds++; this.art += 1.6; this.bleed += 1; paintWound(this.h.coatMat, 3, true); spawnBlood(chest, d, 26, false, 1.3, 0.6); spawnMist(chest, d, 1); SND.impact(chest, 'heavy', 1, true);
    if (P.pos.distanceTo(this.pos) < 9) G.shake = Math.max(G.shake, 0.35);
    for (const x of defenders) if (x !== this && !x.dead && x.pos.distanceTo(this.pos) < 10) x.shaken(0.12);
    if (this.wounds >= 2) { this.die('斧头'); return; }
    this.knockDown(d, 1.2); floatLabel(this.name + '被斧头砍中', this.headPos(), 'heavy', 1.6); this.morale = Math.max(0, this.morale - 0.2); this.yell(1.2);
  }
  shovedBy(e) { this.stagger(this.pos.clone().sub(e.pos).setY(0).normalize(), 1); floatLabel(this.name + '被撞开', this.headPos(), 'heavy'); }
  stagger(dir, k) { if (this.lying() || this.dead) return; this.state = 'stagger'; this.st = 0; this.atk = null; this.vel.copy(dir).multiplyScalar(3.4 * k); this.spendSta(12); this.invuln = 0.4; const l = toLocal(dir, this.yaw); impactReact(this.h, l.x, l.z, 1, 'quick'); SND.thud(this.pos); }
  knockDown(dir, k) { this.state = 'down'; this.st = 0; this.downT = 1.3 + k; this.atk = null; this.vel.copy(dir).multiplyScalar(2.4 * k); this.invuln = 0.3; const l = toLocal(dir, this.yaw); impactReact(this.h, l.x, l.z, 1.3, 'heavy'); SND.bodyFall(this.pos, this.D.weight); }
  die(cause) {
    if (this.dead) return;
    for (const x of [this.pinnedBy, this.clinchBy]) if (x && !x.dead && x.holding === this) { x.holding = null; if (x.crawler) x.setState('crawl'); else { x.setState('stalk'); x.cool = 2; } }
    this.dead = true; this.state = 'dead'; this.atk = null; this.pinnedBy = this.clinchBy = null; this.panic = false;
    addBloodPool(this.chestPos(), 1.6); SND.bodyFall(this.pos, this.D.weight);
    for (const d of defenders) if (d !== this && !d.dead && d.pos.distanceTo(this.pos) < 14) d.shaken(0.3);
    floatLabel(this.name + '死了', this.headPos(), 'heavy', 2.4); toast(this.name + '死了。' + (cause === '失血' ? '血流干了。' : '') + (this.ctrl ? '你回到了自己身上。' : ''), 3.2);
    if (this.ctrl) possess(P, true);
  }
  bleedOut(dt) {
    const loss = this.bleed + this.art + (this.state === 'ko' ? 0.15 : 0); if (loss <= 0) return;
    this.blood -= loss * dt; this.bleed = Math.max(0, this.bleed - dt * 0.035 * (1 + this.bleed * 0.3)); this.art = Math.max(0, this.art - dt * 0.01 * (1 + this.art * 0.1));
    this.dripT -= dt; if (this.dripT <= 0) { this.dripT = rnd(0.06, 0.25) / (0.4 + Math.min(loss, 4)); spawnBlood(this.chestPos().add(new V3(0, this.lying() ? -0.05 : -0.35, 0)), new V3(0, -0.5, 0), 1, true, 0.2, 0.9); }
    const pale = clamp((60 - this.blood) / 50, 0, 1); if (Math.abs(pale - this.paleK) > 0.05) { this.paleK = pale; for (const m of [this.h.skinMat, this.h.faceMat]) m.color.setRGB(1 - pale * 0.22, 1 - pale * 0.14, 1 - pale * 0.04); }
    if (this.blood < 20 && !['ko', 'dead', 'pinned', 'clinch'].includes(this.state)) { this.state = 'ko'; this.st = 0; this.atk = null; floatLabel(this.name + '失血昏过去了', this.headPos(), 'heavy', 1.6); SND.bodyFall(this.pos, this.D.weight); }
    if (this.blood <= 0) this.die('失血');
  }
  updateMorale(dt) {
    let near = 0; for (const e of infected) if (!e.dead && e.standing && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 3.2) near++;
    if (near >= 2) this.morale -= dt * 0.022 * (near - 1); // outnumbered up close
    const lead = CTRL.who, pNear = lead !== this && !lead.dead && lead.pos.distanceTo(this.pos) < 4.5, base = 0.38 + 0.45 * this.D.nerve - (this.bitten ? 0.08 : 0) - (this.blood < 55 ? 0.1 : 0) + (pNear ? 0.12 : 0);
    this.morale += (base - this.morale) * (1 - Math.exp(-dt / (near ? 45 : 9))); this.morale = clamp(this.morale, 0, 1);
    if (!this.panic && this.morale < 0.18 && this.ctrl) { this.panic = true; toast(this.name + '崩溃了——腿发软，手不听使唤', 2.6); }
    if (!this.panic && this.morale < 0.18 && ['move', 'atk', 'bandage', 'work', 'open'].includes(this.state)) {
      this.panic = true; this.state = 'panic'; this.st = 0; this.atk = null; this.say(pick(['我不行了……', '别过来！别过来！', '跑啊！']), true); floatLabel(this.name + '崩溃了', this.headPos(), 'heavy', 1.6);
    }
    if (this.panic && this.morale > 0.38) { this.panic = false; if (this.state === 'panic') this.state = 'move'; if (!this.ctrl) this.say('……我没事了。', true); }
  }
  checkHolds() {
    if (this.state === 'pinned' && (!this.pinnedBy || this.pinnedBy.dead || this.pinnedBy.state !== 'pinning' || this.pinnedBy.holding !== this)) {
      const e = this.pinnedBy; this.freeFrom(e); floatLabel(this.name + '得救了', this.headPos(), 'heavy', 1.2); this.morale = Math.min(1, this.morale + 0.06);
    }
    if (this.state === 'clinch' && (!this.clinchBy || this.clinchBy.dead || this.clinchBy.state !== 'grab' || this.clinchBy.holding !== this)) this.freeFrom(this.clinchBy);
  }
  /* ---- fighting ---- */
  startAttack(kind) {
    const H = HIT[kind], f = this.fatigue(); this.spendSta(H.cost * 0.8);
    this.state = 'atk'; this.st = 0; this.atk = { kind, t: 0, dur: H.dur * (1 + 0.5 * f) * (this.morale < 0.35 ? 1.15 : 1), hitA: H.hitA, strikeA: H.strikeA, hit: false, f, pow: 1 };
  }
  chooseAttack(e, d) {
    const k = this.D.kit, down = !e.standing;
    if (k === 'spear') return 'thrust';
    if (k === 'shield') return !down && d < 1.5 && this.stamina > 18 && (['windup', 'lunge', 'stalk'].includes(e.state) || Math.random() < 0.35) ? 'bash' : (down || e.state === 'stumble' ? 'heavy' : 'quick');
    return down || e.state === 'stumble' || Math.random() < 0.2 ? 'heavy' : 'quick';
  }
  strike(kind) {
    const H = HIT[kind], f = fwdOf(this.yaw), right = new V3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)), blade = (this.D.kit === 'machete' || kind === 'thrust') && kind !== 'bash' && kind !== 'kick', pm = this.power() * (this.atk ? this.atk.pow : 1);
    const push = kind === 'quick' ? f.clone().multiplyScalar(0.8).addScaledVector(right, 0.6).normalize() : f.clone(), cands = [];
    for (const e of infected) {
      if (e.dead) continue; const d = e.chestPos().sub(this.pos).setY(0), l = d.length();
      if (l > H.reach + (e.standing ? 0 : 0.35)) continue; if (l > 0.3 && d.divideScalar(l).dot(f) < Math.cos(H.cone)) continue;
      if (!openingBetween(this.pos, e.pos)) continue; cands.push({ e, l });
    }
    cands.sort((a, b) => a.l - b.l); let n = 0, kills = 0;
    const t0 = cands[0] && cands[0].e, moving = t0 && Math.hypot(t0.vel.x, t0.vel.z) > 2.5;
    const miss = this.ctrl ? clamp(0.18 * this.fatigue() + (this.morale < 0.3 ? 0.15 : 0), 0, 0.35) : clamp((kind === 'bash' ? 0.06 : 0.14) + 0.25 * this.fatigue() + (this.morale < 0.35 ? 0.15 : 0) + (moving ? 0.12 : 0) - (t0 && !t0.standing ? 0.08 : 0), 0.04, 0.55);
    if (t0 && Math.random() < miss) { makeNoise(this.pos, 4, 'swing'); floatLabel(kind === 'thrust' ? '刺空' : '挥空', this.headPos(), 'tough', 0.9); springKick(this.h, 'spX', 2.5); return; }
    for (const { e } of cands.slice(0, kind === 'heavy' ? 2 : 1)) {
      // a ko'd body is finished with a blade through the skull
      if (e.state === 'ko' && blade && kind !== 'thrust') { e.body.skull = 0; e.dirty = true; spawnBlood(e.headPos(), new V3(0, 0.3, 0), 10, false, 0.5, 0.6); SND.crunch(e.headPos(), 3, 0.4); e.die(); floatLabel('补刀', e.headPos().add(new V3(0, 0.3, 0)), 'heavy', 1.2); n++; kills++; continue; }
      const aim = !e.standing ? 'ground' : kind === 'thrust' ? (e.state === 'climb' || Math.random() < 0.25 ? 'high' : 'mid') : kind === 'bash' ? 'mid' : kind === 'heavy' ? 'high' : 'mid';
      const r = e.hit(push, kind, pm, blade, aim, this); if (!r) continue; n++; if (r.killed) kills++;
      defHitFX(e, push, kind, r, blade, pm);
    }
    makeNoise(this.pos, n ? 11 : 4, 'swing');
    if (n) { springKick(this.h, 'shRx', 3); springKick(this.h, 'elR', 3); springKick(this.h, 'spX', -1.2); stainWeapon(this.weapon, 0.15 * n); this.morale = Math.min(1, this.morale + 0.02 + 0.12 * kills); if (kills) this.say(pick(KILL_LINES)); }
  }
  updateAtk(dt) {
    const A = this.atk; A.t += dt; const a = A.t / A.dur, e = this.foe;
    if (e && !e.dead && a < A.hitA) { const d = e.pos.clone().sub(this.pos).setY(0), l = d.length(); this.yaw += angDiff(this.yaw, Math.atan2(d.x, d.z)) * (1 - Math.exp(-14 * dt)); if (this.D.kit !== 'spear' && l > 1.1 && a > A.strikeA - 0.15) this.vel.addScaledVector(d.divideScalar(l), 6 * dt); }
    if (!A.whoosh && a > A.strikeA) { A.whoosh = true; if (A.kind !== 'bash') SND.swing(this.pos, A.kind === 'heavy'); this.yell(0.35); }
    if (!A.hit && a > A.hitA) { A.hit = true; this.strike(A.kind); }
    if (a >= 1) { this.atk = null; this.state = this.panic && !this.ctrl ? 'panic' : 'move'; this.cool = this.ctrl ? 0 : rnd(0.55, 1.0) + this.fatigue() * 0.8 + (this.morale < 0.35 ? 0.4 : 0); }
    const K = A.kind; let p = K === 'thrust' ? thrustPose(a) : K === 'bash' ? (this.shield ? bashPose(a) : thrustPose(a)) : K === 'kick' ? kickPose(a) : K === 'heavy' ? heavyPose(a) : quickPose(a);
    if (K === 'bash' && this.shield) this.shield.position.z = this.shieldZ + 0.2 * Math.sin(clamp((a - 0.35) / 0.4, 0, 1) * Math.PI);
    p = deform(p, A.f); return Object.assign({}, GUARD[this.D.kit], p);
  }
  /* ---- when you're in this body: your keys, its weapon, its nerves ---- */
  ctrlMove(dt) {
    if (CMD.on) { this.vel.multiplyScalar(Math.exp(-8 * dt)); return; }
    const inp = inputDir(); if (inp.length() > 1) inp.normalize();
    const moving = inp.lengthSq() > 0.01, run = keys.ShiftLeft && moving && !this.indoor && this.stamina > 5 && !this.charging;
    if (this.panic) { const a = Math.sin(G.t * 2.3) * 0.6; inp.set(inp.x * Math.cos(a) + inp.z * Math.sin(a), 0, -inp.x * Math.sin(a) + inp.z * Math.cos(a)); } // legs that won't do what they're told
    const spd = (this.indoor ? 1.75 : run ? 3.6 : 2.5) * (1 - 0.22 * this.fatigue()) * (this.blood < 35 ? 0.7 : 1) * (this.panic ? 0.7 : 1) * (this.charging ? 0.35 : 1);
    this.vel.x = damp(this.vel.x, inp.x * spd, 10, dt); this.vel.z = damp(this.vel.z, inp.z * spd, 10, dt);
    if (run) { this.stamina = Math.max(0, this.stamina - 8 * dt); this.staDelay = 0.5; }
    if (this.charging) { this.chargeT += dt; const t = this.lockTarget(); if (t) this.yaw += angDiff(this.yaw, Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z)) * (1 - Math.exp(-6 * dt)); }
    else if (Math.hypot(this.vel.x, this.vel.z) > 0.2) this.yaw += angDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-12 * dt));
    // footsteps are heard, like yours
    const sp = Math.hypot(this.vel.x, this.vel.z), prev = Math.sin(this.stepPh); this.stepPh += dt * sp * 3.3;
    if (sp > 0.4 && Math.sign(Math.sin(this.stepPh)) !== Math.sign(prev)) { const surf = this.indoor ? 'wood' : (this.pos.z < 5.45 && Math.abs(this.pos.x) < 3.7 ? 'porch' : 'mud'); SND.step(this.pos, surf, run ? 0.65 : 0.45); makeNoise(this.pos, run ? 9 : (surf === 'mud' ? 3.5 : 4.5), 'step'); }
    if (this.panic && Math.random() < dt * 2) G.shake = Math.max(G.shake, 0.05);
  }
  lockTarget() { // soft lock: whatever is where you're pushing, threats first
    const inp = inputDir(), aim = inp.lengthSq() > 0.01 ? inp.normalize() : fwdOf(this.yaw); let best = null, bs = 1e9;
    for (const e of infected) {
      if (e.dead) continue; const d = e.chestPos().sub(this.pos).setY(0), l = d.length(); if (l > this.reach() + 1.2) continue;
      const dot = d.divideScalar(Math.max(l, 0.001)).dot(aim); if (dot < 0.2) continue;
      const s = l + (1 - dot) * 2.2 - (['windup', 'lunge'].includes(e.state) ? 1.2 : 0) + (e.standing ? 0 : 0.6); if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  ctrlAttack(kind) { // quick / heavy / alt (shield slam, spear-shaft shove, a kick)
    if (this.state !== 'move' || this.dead || G.mode !== 'play') return;
    if (this.panic && Math.random() < 0.4) { floatLabel(this.name + '的手在抖，没挥出去', this.headPos(), 'tough', 1.1); return; }
    const k = this.D.kit, real = kind === 'alt' ? (k === 'machete' ? 'kick' : 'bash') : k === 'spear' ? 'thrust' : kind;
    const t = this.lockTarget(); this.foe = t; if (t) this.yaw = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
    if (this.morale < 0.3) this.yaw += rnd(-0.15, 0.15); // a shaking aim
    this.startAttack(real);
    if (k === 'spear' && kind === 'heavy') { this.atk.pow = 1.45; this.atk.dur *= 1.2; } // a charged thrust, whole body behind it
  }
  ctrlDodge() {
    if (this.state !== 'move' || this.dead || G.mode !== 'play') return;
    const d = inputDir(); if (d.lengthSq() < 0.01) d.copy(fwdOf(this.yaw)).negate();
    this.dodgeDir.copy(d.normalize()); this.state = 'dodge'; this.st = 0; this.invuln = 0.32 * (1 - 0.4 * this.fatigue()); this.spendSta(12); this.atk = null; this.charging = false;
    SND.step(this.pos, this.indoor ? 'wood' : 'mud', 0.8); makeNoise(this.pos, 5, 'dodge');
    let close = null; for (const e of infected) if (!e.dead && (e.state === 'lunge' || (e.state === 'windup' && e.st > 0.3)) && e.pos.distanceTo(this.pos) < 2.8) close = e;
    if (close && this.fatigue() < 0.8) { G.slowmo = 0.45; this.invuln = 0.6; floatLabel('闪开了', this.headPos(), 'heavy'); this.morale = Math.min(1, this.morale + 0.03); }
  }
  ctrlClinch(kind) { // Space shove · Q knee · attack: the haft into its face
    const e = this.clinchBy; if (this.state !== 'clinch' || !e) return;
    this.spendSta(kind === 'shove' ? 4 : 9); this.clinchProg += (kind === 'shove' ? 1 : 2) * (this.stamina > 3 ? 1 : 0.6) * this.D.str * (0.7 + 0.6 * this.morale);
    const fp = this.headPos();
    if (kind === 'knee') { springKick(e.h, 'spX', 8); springKick(e.h, 'headX', 6); springKick(this.h, 'hipRx', -6); SND.kick(e.chestPos()); e.bal -= 0.15; floatLabel('顶膝', fp, '', 0.8); }
    else if (kind === 'butt') {
      e.body.skull -= 10 * this.power(); springKick(e.h, 'headX', -10); SND.impact(e.headPos(), 'quick', 0.6); spawnBlood(e.headPos(), fwdOf(this.yaw), 6, false, 0.7, 0.4);
      floatLabel(this.D.kit === 'spear' ? '矛杆砸脸' : this.D.kit === 'shield' ? '盾沿砸脸' : '刀柄砸脸', fp, '', 0.8);
      if (e.body.skull <= 0) { this.freeFrom(e); e.crushSkull(fwdOf(this.yaw)); e.startFall(toLocal(fwdOf(this.yaw), e.yaw), 0.6); e.dieOnLand = true; return; }
    } else springKick(this.h, 'spX', 2);
    if (this.clinchProg >= this.clinchNeed) this.breakFree(e, true);
  }
  ctrlMash() { // held down: Space, again and again
    const e = this.pinnedBy; if (this.state !== 'pinned' || !e) return;
    this.struggle += 0.12 * this.D.str * (0.6 + this.morale) * (this.stamina > 4 ? 1 : 0.7) * (e.arms < 2 ? 1.4 : 1); this.spendSta(2); springKick(this.h, 'spZ', rnd(-3, 3)); SND.exhale(this.pos, this.D.voice, 0.3);
    if (this.struggle >= 1) this.breakFree(e, false);
  }
  useTarget() { // what E would do here
    for (const e of infected) {
      if (e.dead || !(e.state === 'ko' || (e.state === 'down' && e.landed) || e.state === 'crawl')) continue;
      const hp = e.groundPoints().find(x => x[0] === 'head'); if (hp && Math.hypot(hp[2].x - this.pos.x, hp[2].z - this.pos.z) < 1.25 && openingBetween(this.pos, e.pos)) return { k: 'finish', e, p: hp[2] };
    }
    if (this.D.medic) {
      for (const q of PREY) { if (q === this || q.dead) continue; const need = q.isPlayer ? P.wounds > 0 && !P.bandaged : (q.bleed + q.art > 0.2 || q.state === 'ko'); if (need && q.pos.distanceTo(this.pos) < 1.3) return { k: 'bandage', q }; }
      if (this.bleed + this.art > 0.2) return { k: 'bandage', q: this };
    }
    if (Math.hypot(this.pos.x, this.pos.z - 3.12) < 1.45 && !door.fallen && !door.fall) return { k: 'door' };
    return null;
  }
  ctrlUse() { // E: finish one on the ground · patch someone up · the door
    if (this.state !== 'move' || G.mode !== 'play') return; const u = this.useTarget(); if (!u) return;
    if (u.k === 'finish') {
      const e = u.e, hp = u.p; this.yaw = Math.atan2(hp.x - this.pos.x, hp.z - this.pos.z); e.body.skull = 0; e.dirty = true; springKick(e.h, 'headX', 8);
      spawnBlood(hp.clone().setY(hp.y + 0.1), new V3(0, 0.3, 0), 10, false, 0.5, 0.6); SND.crunch(hp, 3, 0.4); e.die(); floatLabel('补刀', e.headPos().add(new V3(0, 0.3, 0)), 'heavy', 1.2);
      springKick(this.h, 'spX', 4); springKick(this.h, 'shRx', 3); makeNoise(this.pos, 3, 'knife');
    } else if (u.k === 'bandage') { this.patient = u.q; this.state = 'bandage'; this.st = 0; this.vel.set(0, 0, 0); }
    else {
      if (door.barred) { toast('门闩着。B 拿下门闩', 1.4); return; }
      const open = door.ang < 0.3; door.latch = open ? 0 : 1; door.target = open ? 1.35 : 0; door.angV = open ? 2 : -2; SND.creak(ENTRIES[0].out); makeNoise(this.pos, 4, 'door');
    }
  }
  ctrlBar() {
    if (!this.indoor || Math.hypot(this.pos.x, this.pos.z - 3.12) > 1.6 || door.fallen || door.fall) return;
    if (door.barBroken) { toast('门闩断了', 1.4); return; } if (door.ang > 0.08) { toast('先把门关上', 1.4); return; }
    setBar(!door.barred); toast(door.barred ? '上了门闩' : '拿下门闩', 1.2);
  }
  ctrlPrompt() {
    if (this.state !== 'move') return ''; const u = this.useTarget(); if (!u) return '';
    if (u.k === 'finish') return 'E　补刀'; if (u.k === 'bandage') return 'E　' + (u.q === this ? '给自己包扎' : '给' + u.q.name + '包扎');
    return door.barred ? 'B　拿下门闩' : door.ang > 0.3 ? 'E　关门' : 'E　开门' + (this.indoor && !door.barBroken ? '　　B　上门闩' : '');
  }
  /* ---- getting somewhere: straight lines inside, round the walls outside, through the door between ---- */
  steer(goal, dt, spd) {
    let wp = goal; const gin = insideCabin(goal.x, goal.z), D0 = ENTRIES[0];
    if (gin !== this.indoor) {
      const inDoorway = Math.abs(this.pos.x) < 0.65 && this.pos.z > 1.9 && this.pos.z < 4.4;
      wp = this.indoor ? (inDoorway ? D0.out : D0.in) : (inDoorway ? D0.in : navNext(this.pos, D0.out));
      if (!entryOpen(D0) && Math.abs(this.pos.x) < 0.8 && Math.abs(this.pos.z - 3.1) < 0.95) { this.state = 'open'; this.st = 0; return; } // the door's in the way: open it
    } else if (!this.indoor) wp = navNext(this.pos, goal);
    const to = wp.clone().sub(this.pos).setY(0), l = to.length();
    if (l < 0.12) { this.vel.x = damp(this.vel.x, 0, 10, dt); this.vel.z = damp(this.vel.z, 0, 10, dt); return; }
    to.divideScalar(l);
    if (this.sideT > 0) { this.sideT -= dt; to.add(new V3(to.z, 0, -to.x).multiplyScalar(this.side * 1.2)).normalize(); } // stuck on furniture: slide round it
    const v = Math.min(spd, l * 2.5 + 0.2);
    this.vel.x = damp(this.vel.x, to.x * v, 9, dt); this.vel.z = damp(this.vel.z, to.z * v, 9, dt);
  }
  /* ---- per frame ---- */
  update(dt) {
    const h = this.h; this.st += dt; this.invuln -= dt; this.cool -= dt; this.react -= dt; this.thinkT -= dt; this.sayT -= dt; this.staDelay -= dt; this.orderT -= dt; this.ackT -= dt;
    this.indoor = insideCabin(this.pos.x, this.pos.z); this.ring.visible = false;
    if (this.dead) { this.vel.multiplyScalar(Math.exp(-6 * dt)); this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y = groundY(this.pos.x, this.pos.z); springStep(h, dt); poseTo(h, { bodyX: -1.5, bodyY: 0.14, shLz: 1.1, shRz: -0.9, elL: 0.3, elR: 0.5, headY: 0.8, knL: 0.25, knR: 0.1 }, 6, dt); h.root.position.copy(this.pos); h.root.rotation.y = this.yaw; return; }
    if (G.mode === 'play') { this.bleedOut(dt); if (this.dead) return; this.checkHolds(); this.updateMorale(dt); }
    if (this.sayQ) { this.sayQ.t -= dt; if (this.sayQ.t <= 0) { this.say(this.sayQ.text, true); this.sayQ = null; } }
    this.vis = (0.3 + (inFlood(this.pos) ? 0.7 : 0) + flashLight.intensity * 0.35) * (this.indoor ? 0.85 : 1) * (1 - 0.2 * G.rain);
    if (this.staDelay <= 0 && this.state !== 'atk') this.stamina = Math.min(100, this.stamina + (Math.hypot(this.vel.x, this.vel.z) < 0.3 ? 18 : 12) * (this.blood < 55 ? 0.7 : 1) * dt);
    if (G.mode === 'play' && this.thinkT <= 0) { this.thinkT = rnd(0.18, 0.3); this.think(); }
    const play = G.mode === 'play', sp = Math.hypot(this.vel.x, this.vel.z); let pose = null;
    switch (this.state) {
      case 'move': {
        if (!play) { this.vel.multiplyScalar(Math.exp(-8 * dt)); break; }
        if (this.ctrl) { this.ctrlMove(dt); break; } // you're driving this body
        const e = this.foe; let goal = this.basePost(), spd = this.indoor ? 1.75 : 2.6;
        if (e && !e.dead) {
          const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z), ok = openingBetween(this.pos, e.pos), R = this.reach();
          const urgent = e.tgt === this && ['windup', 'lunge'].includes(e.state);
          if (ok && d < R + (e.standing ? 0 : 0.3) && this.react <= 0 && (this.cool <= 0 || (urgent && this.cool < 0.3)) && this.stamina > 4) {
            const want = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z); this.yaw += angDiff(this.yaw, want) * (1 - Math.exp(-14 * dt));
            if (Math.abs(angDiff(this.yaw, want)) < 0.5) { this.startAttack(this.chooseAttack(e, d)); break; }
          }
          // close in on it when it's in the room or holding one of us; a spear keeps its distance
          const same = insideCabin(e.pos.x, e.pos.z) === this.indoor;
          if (same && (this.order === 'sally' || this.order === 'focus' || this.indoor || (e.holding && e.holding !== this))) {
            const back = e.pos.clone().sub(this.pos).setY(0).normalize(), want = this.D.kit === 'spear' ? 1.8 : 1.15;
            goal = e.pos.clone().addScaledVector(back, -want); spd = this.indoor ? 2.0 : (this.order === 'sally' ? 3.3 : 2.7);
          } else if (!same && this.order === 'sally') { goal = e.pos.clone(); spd = 3.2; }
        } else if (this.patient && !this.patient.dead) {
          const q = this.patient, d = q === this ? 0 : Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z);
          if (d < 0.95) { this.state = 'bandage'; this.st = 0; this.vel.set(0, 0, 0); this.say(q === this ? '我先给自己扎一下。' : (q.isPlayer ? '别动，我给你包上。' : '按住，我给你扎紧。')); break; }
          goal = q.pos.clone(); spd = 2.0;
        } else if (this.workW) {
          const w = this.workW; if (Math.hypot(w.nail.x - this.pos.x, w.nail.z - this.pos.z) < 0.4) { this.state = 'work'; this.st = 0; this.workN = 0; break; } goal = w.nail.clone();
        }
        // the door guard shuts the door when nobody's out there
        if (this.order === 'hold' && this.post === 'door' && !e && door.ang > 0.6 && !door.fallen && !door.fall && !PREY.some(q => !q.dead && !q.indoor) && !infected.some(x => !x.dead && Math.hypot(x.pos.x, x.pos.z - 3.3) < 2.4)) {
          if (Math.hypot(this.pos.x - 0.15, this.pos.z - 2.55) < 0.6) { this.state = 'open'; this.st = 0; this.closing = true; break; }
        }
        if (this.barPending && door.ang < 0.08 && !door.barred && !door.barBroken && !door.fallen) { this.barPending = false; if (setBar(true)) floatLabel(this.name + '上了门闩', this.headPos(), '', 1.2); }
        // stuck against the furniture for a moment: try the other side
        if (this.st > 0.6) { const moved = this.pos.distanceTo(this.lastP); if (goal.distanceTo(this.pos) > 0.6 && moved < 0.12 && this.sideT <= 0) { this.sideT = 0.6; this.side = Math.random() < 0.5 ? -1 : 1; } this.lastP.copy(this.pos); this.st = 0; }
        this.steer(goal, dt, spd * (this.fatigue() > 0.7 ? 0.8 : 1) * (this.blood < 35 ? 0.7 : 1));
        if (this.state !== 'move') break;
        // facing: the threat, the way it walks, or out of its window
        const look = e && !e.dead ? e.pos : (this.watch && !this.watch.dead && this.watch.pos.distanceTo(this.pos) < 10 ? this.watch.pos : null);
        if (look) this.yaw += angDiff(this.yaw, Math.atan2(look.x - this.pos.x, look.z - this.pos.z)) * (1 - Math.exp(-8 * dt));
        else if (sp > 0.4) this.yaw += angDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-8 * dt));
        else this.yaw += angDiff(this.yaw, this.postFace()) * (1 - Math.exp(-3 * dt));
        break;
      }
      case 'atk': pose = this.updateAtk(dt); this.vel.multiplyScalar(Math.exp(-6 * dt)); break;
      case 'open': { // to the door: lift the bar, pull it open; or the guard pushing it shut and dropping the bar
        this.vel.multiplyScalar(Math.exp(-10 * dt)); this.yaw += angDiff(this.yaw, this.indoor ? 0 : Math.PI) * (1 - Math.exp(-10 * dt));
        pose = { shRx: -1.3, elR: 0.5, shLx: -0.9, elL: 0.7, spX: 0.15 };
        if (this.st > 0.7) {
          if (this.closing) { this.closing = false; if (door.ang > 0.3 && !door.fallen) { door.target = 0; door.angV = -2.2; door.latch = 1; SND.creak(ENTRIES[0].out); this.barPending = true; } }
          else if (!entryOpen(ENTRIES[0])) { if (door.barred) setBar(false); door.latch = 0; door.target = 1.35; door.angV = 2.2; SND.creak(ENTRIES[0].out); makeNoise(this.pos, 4, 'door'); }
          this.state = this.panic && !this.ctrl ? 'panic' : 'move'; this.st = 0;
        }
        break;
      }
      case 'dodge': { // a quick step out of the way
        const k = 1 - this.st / 0.4; this.vel.copy(this.dodgeDir).multiplyScalar((6 * k + 0.6) * (1 - 0.4 * this.fatigue()));
        const m = Math.sin(clamp(this.st / 0.4, 0, 1) * Math.PI); pose = Object.assign({}, GUARD[this.D.kit], { spX: 0.5 * m, knL: 0.9 * m, knR: 1.1 * m, hipLx: -0.5 * m, pelY: -0.28 * m, headX: 0.2 * m });
        if (this.st > 0.4) this.state = 'move';
        break;
      }
      case 'bandage': {
        const q = this.patient; this.vel.multiplyScalar(Math.exp(-10 * dt));
        if (!q || q.dead || (this.foe && this.foe.pos.distanceTo(this.pos) < 2.5) || (q !== this && q.pos.distanceTo(this.pos) > 1.4)) { this.state = 'move'; break; }
        if (q !== this) this.yaw += angDiff(this.yaw, Math.atan2(q.pos.x - this.pos.x, q.pos.z - this.pos.z)) * (1 - Math.exp(-8 * dt));
        const s = Math.sin(this.st * 9); pose = { knL: 1.6, knR: 0.9, hipLx: -1.3, hipRx: -0.2, pelY: -0.42, spX: 0.55, headX: 0.45, shLx: -0.9 + s * 0.1, elL: 1.3, shRx: -0.85 - s * 0.15, elR: 1.2 };
        if (this.st > 2.6) {
          if (q.isPlayer) { P.bandaged = true; toast('阿梅给你扎紧了伤口。血止住了一些。', 2.4); }
          else { q.bleed = 0; q.art *= 0.25; if (q.state === 'ko' && q.blood > 12) q.wakeT = 4; floatLabel((q === this ? '' : q.name) + '止住了血', q.headPos(), '', 1.3); }
          this.patient = null; this.state = 'move';
        }
        break;
      }
      case 'work': { // a board over the window: three blows, each one heard outside
        const w = this.workW; this.vel.multiplyScalar(Math.exp(-12 * dt));
        if (!w || (this.foe && this.foe.pos.distanceTo(this.pos) < 3)) { this.state = 'move'; break; }
        this.yaw += angDiff(this.yaw, Math.atan2(w.center.x - this.pos.x, w.center.z - this.pos.z)) * (1 - Math.exp(-10 * dt));
        const hits = [0.35, 0.75, 1.15]; if (this.workN < 3 && this.st > hits[this.workN]) { this.workN++; SND.hammer(w.nail); makeNoise(this.pos, 8, 'hammer'); }
        const s = Math.sin(this.st * 17); pose = { shRx: -1.7 + s * 0.45, elR: 1.2 - s * 0.4, shLx: -1.35, elL: 0.6, spX: 0.1, headX: 0.15 };
        if (this.st > 1.35) { if (nailBoard(w)) w.torn = Math.max(0, w.torn - 1), floatLabel(this.name + '钉回一块木板（剩 ' + G.planks + ' 块）', this.headPos(), '', 1.4); this.workW = null; this.state = 'move'; }
        break;
      }
      case 'clinch': { // face to face with it, shoving at its chest
        const e = this.clinchBy; this.vel.multiplyScalar(Math.exp(-10 * dt)); this.clinchTick -= dt;
        if (this.clinchTick <= 0 && !this.ctrl) { // on its own it shoves; when it's you, it's your keys
          this.clinchTick = rnd(0.22, 0.38); this.clinchProg += (this.stamina > 3 ? 1 : 0.6) * this.D.str * (0.7 + this.morale * 0.6) * (Math.random() < 0.3 ? 2 : 1); this.spendSta(4); springKick(h, 'spX', 2);
          if (this.clinchProg >= this.clinchNeed) { this.breakFree(e, true); break; }
        }
        if (this.st > this.clinchMax) { this.clinchBy = null; this.pinnedByE(e); floatLabel(this.name + '被拖倒在地', this.headPos(), 'heavy', 1.4); break; }
        const b = Math.sin(G.t * 9); pose = { shLx: -1.3, shRx: -1.25, elL: 0.9 + b * 0.1, elR: 0.85, spX: -0.25, headX: -0.3, headY: -b * 0.2, knL: 0.25, knR: 0.35, hipLx: 0.25 };
        break;
      }
      case 'pinned': { // on its back, forearm under the jaw, kicking
        const e = this.pinnedBy; this.vel.multiplyScalar(Math.exp(-10 * dt));
        if (this.state === 'pinned' && e) {
          this.struggle = this.ctrl ? Math.max(0, this.struggle - 0.28 * dt) : Math.max(0, this.struggle + dt * (0.26 * this.strugK * this.D.str * (0.6 + this.morale) * (this.stamina > 4 ? 1 : 0.6) * (e.arms < 2 ? 1.5 : 1) - 0.05));
          if (this.struggle >= 1) { this.breakFree(e, false); break; }
          if (this.st > 3.6) { if (e.canBite()) { this.bittenBy(e); break; } this.st = 0.8; if (e.roarT <= 0) roar(e, 'help'); }
        }
        pose = { bodyX: -1.05, bodyY: 0.18, shLx: -2.1, shRx: -2.0, shLz: 0.3, shRz: -0.3, elL: 0.6 + Math.sin(G.t * 19) * 0.15, elR: 0.7, hipLx: -0.9, hipRx: -0.3, knL: 1.1, knR: 0.5, headX: -0.3 + Math.sin(G.t * 13) * 0.1 };
        break;
      }
      case 'stagger': { this.vel.multiplyScalar(Math.exp(-5 * dt)); const k = 1 - smooth(0.2, 0.45, this.st); pose = { spX: -0.35 * k, headX: -0.3 * k, shLx: -0.8 * k, shRx: -0.5 * k, shLz: 0.6 * k, shRz: -0.5 * k, knL: 0.3 * k, hipLx: 0.3 * k }; if (this.st > 0.5) this.state = this.panic && !this.ctrl ? 'panic' : 'move'; break; }
      case 'down': {
        this.vel.multiplyScalar(Math.exp(-4 * dt)); const k = 1 - smooth(this.downT - 0.6, this.downT, this.st);
        pose = { bodyX: -1.45 * k, bodyY: 0.15 * k, shLz: 0.9 * k, shRz: -0.7 * k, shLx: -0.4 * k, elL: 0.6, elR: 0.5, knL: 0.5 * k + 0.6 * (1 - k) * Math.sin(k * Math.PI), knR: 0.3 * k, headX: -0.25 * k, spX: 0.5 * Math.sin(k * Math.PI) };
        if (this.st > this.downT) this.state = this.blood < 20 ? 'ko' : (this.panic && !this.ctrl ? 'panic' : 'move');
        break;
      }
      case 'ko': {
        this.vel.multiplyScalar(Math.exp(-6 * dt)); pose = { bodyX: -1.5, bodyY: 0.15, shLz: 1.0, shRz: -0.9, elL: 0.4, elR: 0.6, headY: 0.6, knL: 0.35 };
        if (this.wakeT > 0) { this.wakeT -= dt; if (this.wakeT <= 0) { this.state = 'down'; this.st = 0; this.downT = 1.2; this.blood = Math.max(this.blood, 22); this.say('……我还活着？', true); } }
        break;
      }
      case 'panic': { // backs away toward the inner room, arms over the head; swings blindly if one gets right on top of it
        if (this.ctrl) { this.state = 'move'; break; }
        const e = this.watch, goal = POSTS.fallback.p.clone();
        if (e && !e.dead) { const away = this.pos.clone().sub(e.pos).setY(0); if (away.lengthSq() > 0.01) goal.addScaledVector(away.normalize(), 1.2); }
        this.steer(goal, dt, this.indoor ? 1.9 : 3.0); if (this.state !== 'panic') break;
        if (e && !e.dead) this.yaw += angDiff(this.yaw, Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z)) * (1 - Math.exp(-6 * dt));
        if (e && !e.dead && e.pos.distanceTo(this.pos) < 1.2 && this.cool <= 0 && this.stamina > 5 && openingBetween(this.pos, e.pos)) { this.startAttack(this.D.kit === 'spear' ? 'thrust' : 'quick'); this.atk.dur *= 1.2; break; }
        const tr = Math.sin(G.t * 31) * 0.04; pose = { knL: 0.9, knR: 0.9, hipLx: -0.6, hipRx: -0.6, pelY: -0.3, spX: 0.45 + tr, headX: 0.35, shLx: -2.2, elL: 2.0, shRx: -2.0, elR: 1.9 };
        break;
      }
    }
    // integrate; push out of the other bodies, the walls, the furniture
    if (!['pinned', 'clinch'].includes(this.state)) {
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      const lying = this.lying();
      const sep = (o, r, k) => { const dx = this.pos.x - o.x, dz = this.pos.z - o.z, l = Math.hypot(dx, dz); if (l < r && l > 0.001) { this.pos.x += dx / l * (r - l) * k; this.pos.z += dz / l * (r - l) * k; } };
      if (!lying) {
        for (const d of defenders) if (d !== this && !d.dead && !d.lying()) sep(d.pos, 0.55, 0.5);
        if (!P.dead && P.state !== 'pinned') sep(P.pos, 0.55, 1);
        for (const e of infected) if (!e.dead && e.standing && e.state !== 'pinning' && e.state !== 'grab') sep(e.pos, 0.6, 0.5);
      }
      collide(this.pos, 0.28);
    }
    this.pos.y = groundY(this.pos.x, this.pos.z);
    // pose: guard stance over a walk, unless a state took over
    const sp2 = Math.hypot(this.vel.x, this.vel.z); const turnR = Math.abs(angDiff(this.yawPrev ?? this.yaw, this.yaw)) / Math.max(dt, 1e-3); this.yawPrev = this.yaw;
    const spG = Math.max(sp2, Math.min(0.8, turnR * 0.3)); // turning on the spot takes steps
    this.ph += dt * spG * gaitK(spG, h.s);
    if (!pose) {
      pose = walkPose(this.ph, clamp(sp2 / 2.2, 0, 1), clamp((sp2 - 2.6) / 1.4, 0, 1), spG, h.s);
      const g = this.spearUp ? REST_SPEAR : GUARD[this.D.kit], f = this.fatigue();
      for (const k in g) pose[k] = k.startsWith('sh') || k.startsWith('el') ? g[k] : (pose[k] || 0) + g[k] * (1 - clamp(sp2 / 2, 0, 0.6));
      if (f > 0.05) { pose.spX = (pose.spX || 0) + 0.25 * f + Math.sin(G.t * lerp(4, 9, f)) * 0.03 * f; pose.headX = (pose.headX || 0) + 0.2 * f; }
      if (this.blood < 35) pose.spX = (pose.spX || 0) + 0.12;
      if (this.ctrl && this.charging && this.chargeT > 0.14 && this.state === 'move') { const k = clamp((this.chargeT - 0.14) / 0.3, 0, 1); Object.assign(pose, this.D.kit === 'spear' ? thrustPose(0.42 * k) : heavyPose(0.45 * k)); pose.shRx += Math.sin(G.t * 40) * 0.02 * (1 + (this.morale < 0.3 ? 4 : 0)); }
    }
    if (this.shield && this.state !== 'atk') this.shield.position.z = damp(this.shield.position.z, this.shieldZ, 12, dt);
    if (this.D.kit === 'spear') { // upright at rest (it would poke through the wall); levelled when something comes near or it's moving to fight
      const f = this.foe, ready = this.ctrl || this.state === 'atk' || (f && !f.dead && Math.hypot(f.pos.x - this.pos.x, f.pos.z - this.pos.z) < this.reach() + 1.6) || this.state === 'panic';
      this.weapon.rotation.x = damp(this.weapon.rotation.x, ready || this.lying() ? 0.15 : -1.3, 8, dt); this.spearUp = !ready && !this.lying();
    }
    springStep(h, dt);
    poseTo(h, pose, this.state === 'atk' ? 20 : this.state === 'down' ? 9 : 12, dt);
    h.root.position.copy(this.pos); h.root.rotation.y = this.yaw;
  }
  /* ---- the HUD bits ---- */
  status() {
    if (this.dead) return '阵亡';
    const s = [];
    if (this.state === 'pinned') s.push('被按在地上！'); else if (this.state === 'clinch') s.push('被抓住了'); else if (this.state === 'ko') s.push('昏迷');
    else if (this.panic) s.push('崩溃'); else if (this.state === 'bandage') s.push('包扎中'); else if (this.state === 'work') s.push('钉木板');
    if (this.bitten) s.push('被咬了'); if (this.art > 0.5) s.push('动脉出血'); else if (this.bleed > 0.45) s.push('流血');
    if (!s.length && this.fatigue() > 0.6) s.push('力竭');
    return s.join(' · ');
  }
  orderText() {
    if (this.dead) return '';
    if (this.ctrl) return '由你操控';
    if (this.order === 'hold') return '守住 · ' + this.postName();
    if (this.order === 'plug') { let best = null, bp = 0.9; for (const en of ENTRIES) { const p = entryPressure(en); if (p > bp) { bp = p; best = en; } } return '堵缺口' + (best ? ' → ' + best.name : '（待命）'); }
    return ORDER_NAMES[this.order];
  }
}
function defHitFX(e, dir, kind, r, blade, pm) {
  const p = e.chestPos(), heavy = kind === 'heavy';
  spawnImpact(p, heavy ? 1.2 : 0.9);
  if (kind === 'bash') { SND.thud(p); SND.kick(p); }
  else { SND.impact(p, heavy ? 'heavy' : 'quick', pm, blade); spawnBlood(p, dir, Math.round((heavy ? 26 : 14) * (blade ? 1.5 : 1)), false, heavy ? 1.2 : 1, 0.35); if (heavy || blade) spawnMist(p, dir, 0.7); }
  SND.exhale(e.pos, e.T.voice, 0.35);
  if (r.tag) floatLabel(r.tag, p.clone().add(new V3(0, 0.55, 0)), r.cls, r.cls === 'heavy' ? 1.5 : 1.1);
  if (r.tag2) floatLabel(r.tag2, p.clone().add(new V3(0, 0.95, 0)), '', 1.1);
  if (P.pos.distanceTo(e.pos) < 7) { G.hitStop = Math.max(G.hitStop, HIT[kind].stop * 0.6); G.shake = Math.max(G.shake, HIT[kind].shake * 0.4); }
}
new Defender('zhao'); new Defender('zhou'); new Defender('mei');

/* ---------------- possession: step into any of your people; your own body carries on without you ---------------- */
function moodText(q) { if (q.bitten) return ' — 被咬了，伤口在发烫'; if (q.panic || q.morale < 0.2) return ' — 快崩溃了'; if (q.morale < 0.4) return ' — 手在抖'; if (q.morale < 0.65) return ' — 绷着劲'; return ' — 很镇定'; }
function possess(q, quiet) {
  if (!q || q.dead || q === CTRL.who) return false;
  if (!q.isPlayer && q.state === 'ko') { if (!quiet) toast(q.name + '昏过去了，附不了身', 1.6); return false; }
  const prev = CTRL.who;
  if (prev === P) { P.ai = true; P.aiHold.copy(P.pos); P.atk = null; P.charging = false; P.crouch = false; P.shutter = false; }
  else { prev.ctrl = false; prev.charging = false; prev.thinkT = 0; }
  CTRL.who = q;
  if (q === P) P.ai = false;
  else { q.ctrl = true; q.charging = false; if (['panic', 'work', 'open'].includes(q.state)) q.state = 'move'; q.patient = null; q.workW = null; }
  G.slowmo = Math.max(G.slowmo, 0.3); SND.heartbeat(0.5);
  if (!quiet) toast(q === P ? '回到你自己身上' : '附身：' + q.name + '（' + q.D.role + '）' + moodText(q), 2.4);
  return true;
}
function possessNext() { const all = [P, ...defenders].filter(q => !q.dead && !(q !== P && q.state === 'ko')); if (all.length < 2) return; possess(all[(all.indexOf(CTRL.who) + 1) % all.length]); }
for (const d of defenders) d.card.addEventListener('dblclick', ev => { ev.stopPropagation(); possess(d); });
const youCard = (() => { // you, in the squad panel: who's driving your body
  const c = document.createElement('div'); c.className = 'dcard you';
  c.innerHTML = '<div class="dtop"><b class="dname">你</b><span class="drole"></span></div><div class="dorder"></div><div class="dbars two"><i class="dsta" title="体力"><b></b></i><i class="dmor" title="肾上腺素"><b></b></i></div><div class="dstat"></div>';
  $('squad').insertBefore(c, $('squad').firstChild); c.addEventListener('mousedown', ev => { ev.stopPropagation(); if (CMD.on) possess(P); });
  return { c, role: c.querySelector('.drole'), order: c.querySelector('.dorder'), sta: c.querySelector('.dsta b'), adr: c.querySelector('.dmor b'), stat: c.querySelector('.dstat') };
})();

/* ---------------- command: slow time, a view from above, orders ---------------- */
const CMD = { on: false, sel: new Set(), dist: 15 };
const postRings = {};
for (const k of POST_KEYS) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 28), new THREE.MeshBasicMaterial({ color: 0x93b2d8, transparent: true, opacity: 0.6, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(POSTS[k].p.x, groundY(POSTS[k].p.x, POSTS[k].p.z) + 0.03, POSTS[k].p.z); m.visible = false; scene.add(m);
  const el = document.createElement('div'); el.className = 'plabel'; el.textContent = POSTS[k].name; $('labels').appendChild(el);
  postRings[k] = { m, el };
}
function setCommand(on, quiet) {
  if (on && (G.mode !== 'play' || P.dead)) return;
  CMD.on = on; document.body.classList.toggle('cmd', on); P.atk = null; P.charging = false;
  if (on && !CMD.sel.size) for (const d of defenders) if (!d.dead) CMD.sel.add(d);
  if (!quiet) toast(on ? '指挥：时间放慢 · 点人选人 · 点位置派过去' : '回到战斗', 1.6);
}
function cmdSelect(d, add) {
  if (d.dead) return;
  if (add) { if (CMD.sel.has(d)) CMD.sel.delete(d); else CMD.sel.add(d); } else { CMD.sel.clear(); CMD.sel.add(d); }
  SND.click();
}
function cmdSelectAll() { CMD.sel.clear(); for (const d of defenders) if (!d.dead) CMD.sel.add(d); SND.click(); }
function selected() { const s = [...CMD.sel].filter(d => !d.dead); return s.length ? s : defenders.filter(d => !d.dead); }
function orderDefenders(order, list) {
  const alive = (list || defenders).filter(d => !d.dead); if (!alive.length) return;
  for (const d of alive) d.setOrder(order, alive.length > 1 && d !== alive[0]);
  const all = alive.length === defenders.filter(d => !d.dead).length;
  toast((all ? '全体' : alive.map(d => d.name).join('、')) + '：' + ORDER_NAMES[order], 1.4);
  if (!P.dead) { SND.shout(P.pos, 1, 0.55); makeNoise(P.pos, 7, 'shout'); floatLabel('“' + ORDER_SHOUT[order] + '”', P.pos.clone().add(new V3(0, 2.1, 0)), 'say', 1.6); }
}
function assignPost(list, key, p) {
  const alive = list.filter(d => !d.dead); if (!alive.length) return;
  alive.forEach((d, i) => { d.post = key; if (p) d.customP.copy(p).add(new V3((i % 2 ? 0.6 : -0.6) * Math.ceil(i / 2), 0, 0)); d.setOrder('hold', i > 0); });
  toast(alive.map(d => d.name).join('、') + ' → ' + (key === 'custom' ? '指定位置' : POSTS[key].name), 1.4);
  if (!P.dead) { SND.shout(P.pos, 1, 0.45); makeNoise(P.pos, 6, 'shout'); }
}
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
function groundAt(cx, cy) {
  _ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); _ray.setFromCamera(_ndc, camera);
  for (const y of [0, GROUND_Y]) {
    const p = new V3(); if (!_ray.ray.intersectPlane(new THREE.Plane(new V3(0, 1, 0), -y), p)) continue;
    if ((y === 0) === insideCabin(p.x, p.z) || y === GROUND_Y) return p;
  }
  return null;
}
function cmdClick(cx, cy, add) {
  let best = null, bd = 46;
  for (const d of defenders) { if (d.dead) continue; for (const q of [d.chestPos(), d.pos]) { const s = project(q); const dd = Math.hypot(s.x - cx, s.y - cy); if (s.vis && dd < bd) { bd = dd; best = d; } } }
  if (best) { cmdSelect(best, add); return; }
  const sel = [...CMD.sel].filter(d => !d.dead); if (!sel.length) { toast('先选人：点一个守军，或按 1–3', 1.4); return; }
  let pk = null; bd = 40; for (const k of POST_KEYS) { const s = project(POSTS[k].p.clone().setY(groundY(POSTS[k].p.x, POSTS[k].p.z))); const dd = Math.hypot(s.x - cx, s.y - cy); if (s.vis && dd < bd) { bd = dd; pk = k; } }
  if (pk) { assignPost(sel, pk); return; }
  const g = groundAt(cx, cy); if (!g || Math.abs(g.x) > 14 || g.z < -9 || g.z > 16) return;
  assignPost(sel, 'custom', g);
}
function updateCommandView(dt) {
  for (const d of defenders) d.ring.visible = CMD.on && CMD.sel.has(d) && !d.dead;
  for (const d of defenders) if (d.ring.visible) { d.ring.position.set(d.pos.x, d.pos.y + 0.03, d.pos.z); d.ring.material.opacity = 0.6 + 0.3 * Math.sin(G.t * 6); }
  for (const k of POST_KEYS) {
    const R = postRings[k]; R.m.visible = CMD.on; R.el.style.opacity = CMD.on ? '1' : '0'; if (!CMD.on) continue;
    const en = ENTRIES.find(x => ENTRY_POST[x.id] === k), pr = en ? entryPressure(en) : 0;
    R.m.material.color.setHex(pr >= 1 ? 0xe0573c : 0x93b2d8); const txt = POSTS[k].name + (pr >= 1 ? ' · 告急' : '');
    if (R.el.textContent !== txt) R.el.textContent = txt; R.el.classList.toggle('hot', pr >= 1);
    const s = project(POSTS[k].p.clone().setY(groundY(POSTS[k].p.x, POSTS[k].p.z)));
    R.el.style.transform = `translate(${s.x.toFixed(0)}px,${(s.y + 14).toFixed(0)}px) translate(-50%,0)`;
  }
}
function updateSquadHUD() {
  { const Y = youCard, ot = P.dead ? '' : CTRL.who === P ? '由你操控' : '自己守着原地', st = P.dead ? '死了' : P.state === 'pinned' ? '被按在地上！' : P.state === 'clinch' ? '被抓住了' : P.wounds ? (P.bandaged ? '重伤 · 包扎过' : '重伤 · 流血') : '';
    const role = P.weapon === 'axe' ? '消防斧' : P.broken ? '断了的球棍' : '钉头球棍';
    if (Y.role.textContent !== role) Y.role.textContent = role; if (Y.order.textContent !== ot) Y.order.textContent = ot; if (Y.stat.textContent !== st) Y.stat.textContent = st;
    Y.sta.style.width = clamp(P.stamina, 0, 100).toFixed(0) + '%'; Y.adr.style.width = (P.adr * 100).toFixed(0) + '%';
    Y.c.classList.toggle('ctrl', CTRL.who === P && !P.dead); Y.c.classList.toggle('dead', P.dead); Y.c.classList.toggle('alarm', P.ai && (P.state === 'pinned' || P.state === 'clinch')); }
  for (const d of defenders) {
    d.card.classList.toggle('ctrl', d.ctrl);
    const C = d.cEls, ot = d.orderText(), st = d.status();
    if (C.order.textContent !== ot) C.order.textContent = ot; if (C.stat.textContent !== st) C.stat.textContent = st;
    C.blood.style.width = clamp(d.blood, 0, 100).toFixed(0) + '%'; C.sta.style.width = clamp(d.stamina, 0, 100).toFixed(0) + '%'; C.mor.style.width = (clamp(d.morale, 0, 1) * 100).toFixed(0) + '%';
    d.card.classList.toggle('sel', CMD.on && CMD.sel.has(d)); d.card.classList.toggle('dead', d.dead);
    d.card.classList.toggle('alarm', !d.dead && (d.state === 'pinned' || d.state === 'clinch' || d.panic || d.state === 'ko'));
    // a tag over the head: always in command view, otherwise only when something's wrong
    const urgent = !d.dead && (d.state === 'pinned' || d.state === 'clinch' || d.panic || d.state === 'ko'), show = G.mode === 'play' && (CMD.on || urgent) && !d.dead;
    d.tag.style.opacity = show ? '1' : '0';
    if (show) {
      const txt = d.name + (urgent ? ' · ' + st : ''); if (d.tagText !== txt) { d.tagText = txt; d.tag.textContent = txt; }
      d.tag.classList.toggle('hot', urgent); const s = project(d.headPos().add(new V3(0, 0.3, 0)));
      d.tag.style.transform = `translate(${s.x.toFixed(0)}px,${s.y.toFixed(0)}px) translate(-50%,-100%)`;
    }
  }
}
document.querySelectorAll('#cmdbar button').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); if (b.dataset.p) { const s = [...CMD.sel].filter(d => !d.dead && d !== CTRL.who); if (s.length && possess(s[0])) setCommand(false, true); else if (!s.length) toast('先选一个人', 1.2); return; } orderDefenders(b.dataset.o, CMD.on ? selected() : null); }));
