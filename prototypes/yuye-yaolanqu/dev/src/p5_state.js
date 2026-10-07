/* ===== P5 state: shared game state, the player rig, the mother & baby, small helpers ===== */
const $ = id => document.getElementById(id);
const G = {
  mode: 'title', t: 0, hitStop: 0, slowmo: 0, shake: 0, camMode: 'command', rain: 1, fx: true, muted: false, tension: 0,
  flood: { state: 'on', t: 0, next: 40 }, lightning: { next: 14, t: -1, power: 1 },
  toastT: 0, babyTaken: false, openingT: 0, playT: 0, cardOnClose: null, cardT: 0, cutT: 0,
  camKick: new V3(), fovPunch: 0, wave: 1, waveT: -1, spentToastT: 0
};
const keys = {};
const LURK_C = new V3(0, GROUND_Y, 9.4);
const dirA = a => new V3(Math.sin(a), 0, Math.cos(a));
const fwdOf = yaw => new V3(Math.sin(yaw), 0, Math.cos(yaw));
// an actor's own frame: +x is its left, +z its front
function toLocal(d, yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); return { x: d.x * c - d.z * s, z: d.x * s + d.z * c }; }
function toWorld(lx, lz, yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); return new V3(lx * c + lz * s, 0, -lx * s + lz * c); }

/* ---------------- player ---------------- */
const P = {};
(function initPlayer() {
  const h = makeHuman({ height: 1.76, girth: 1.06, skin: '#c38f6e', top: '#59503f', coat: '#4a4434', bottom: '#2b3035', shoes: '#1b1612', hair: '#1d140e', hairStyle: 'short', cap: '#6a3b2c', scarf: '#8a6638', backpack: '#3b382e', seed: 3 });
  scene.add(h.root); initSprings(h);
  const club = makeClub(); h.armR.hand.add(club); club.position.set(0, -0.05, 0.01); club.rotation.set(0.32, 0, 0);
  const axe = makeAxe(); h.armR.hand.add(axe); axe.position.set(0, -0.05, 0.01); axe.rotation.set(0.32, 0, 0); axe.visible = false;
  const lantern = makeLantern(); h.armL.hand.add(lantern); lantern.position.set(0, -0.05, 0);
  // a knife for quiet work, only drawn for a takedown
  const knife = new THREE.Group(); h.armR.hand.add(knife); knife.position.set(0, -0.06, 0.02); knife.rotation.set(0.3, 0, 0); knife.visible = false;
  knife.add(mesh(new THREE.BoxGeometry(0.026, 0.1, 0.022), new THREE.MeshStandardMaterial({ color: 0x1c1915, roughness: 0.9 }), 0, 0, 0));
  { const bl = mesh(new THREE.BoxGeometry(0.02, 0.17, 0.004), new THREE.MeshStandardMaterial({ color: 0xa9adb1, roughness: 0.25, metalness: 0.9 }), 0, -0.13, 0); bl.scale.x = 0.9; knife.add(bl); }
  const torch = new THREE.Group(); torch.position.set(0.075 * h.s, 0.31 * h.s, 0.135); h.spine.add(torch);
  const tb = mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.1, 10), matIron); tb.rotation.x = Math.PI / 2; torch.add(tb);
  const tlens = mesh(new THREE.CircleGeometry(0.024, 12), new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0xcfe4ff, emissiveIntensity: 0, roughness: 0.2 }), 0, 0, 0.051, false, false); torch.add(tlens);
  const spot = new THREE.SpotLight(0xd6e6ff, 0, 17, 0.32, 0.4, 1.25); spot.castShadow = true; spot.shadow.mapSize.set(512, 512); spot.shadow.bias = -0.002; spot.position.set(0, 0, 0.06); torch.add(spot);
  const spotT = new THREE.Object3D(); spotT.position.set(0, -0.9, 5); torch.add(spotT); spot.target = spotT;
  const tbGeo = new THREE.ConeGeometry(Math.tan(0.32) * 6.5, 6.5, 24, 1, true); tbGeo.translate(0, -3.25, 0); tbGeo.rotateX(-Math.PI / 2);
  const tbMat = beamMat.clone(); tbMat.uniforms.color.value = new THREE.Color(0xa8bedc); tbMat.uniforms.intensity.value = 0;
  const tbeam = new THREE.Mesh(tbGeo, tbMat); tbeam.rotation.x = Math.atan2(0.9, 5); tbeam.visible = false; torch.add(tbeam); // drawn only while the torch is on
  Object.assign(P, {
    h, club, axe, knife, weapon: 'club', lantern, torch, spot, tlens, tbeam, pos: new V3(0.2, GROUND_Y, 10.6), vel: new V3(), yaw: Math.PI, ph: 0, state: 'move', st: 0,
    stamina: 100, staMax: 100, staDelay: 0, winded: false, adr: 0, adrPeak: 0, crash: 0, battery: 100, torchOn: false, durability: 60, broken: false,
    atk: null, charging: false, chargeT: 0, invuln: 0, dodgeDir: new V3(), dodgeK: 1, struggle: 0, pinnedBy: null, carrying: false, indoor: false,
    crouch: false, shutter: false, vis: 0.5, whistleCD: 0, calmT: 0, gore: 0,
    swing: { ax: 0, vx: 0, az: 0, vz: 0 }, prevVel: new V3(), dead: false, isPlayer: true, name: '你', bitten: false, panic: false,
    ai: false, aiHold: new V3(), aiWant: new V3(), aiT: 0, aiFoe: null // while you're in someone else's body, yours looks after itself
  });
})();
// everyone the infected can go for: you, and your people (they join in p7b)
const PREY = [P];
// the body your keys drive: you, or whoever you've stepped into
const CTRL = { who: P };

/* ---------------- mother & baby ---------------- */
const mother = (function () {
  const h = makeHuman({ female: true, downcast: true, height: 1.62, girth: 0.92, skin: '#d9b49b', pale: 0.5, top: '#76604e', topWear: 0.55, skirt: '#3b4656', shoes: '#2a201a', hair: '#2a1c12', hairStyle: 'bun', seed: 21 });
  rock.add(h.root); h.root.position.set(0, 0, 0.0);
  const seat = Object.assign({}, SEATED, { pelY: 0.5 - h.pelvisY0, spX: -0.06, headX: 0.48, headY: 0.24, headZ: 0.06, shLx: -0.42, shLy: -1.05, shLz: -0.04, elL: 1.62, shRx: -0.58, shRy: 0.95, shRz: 0.06, elR: 1.42, chY: 0.08 });
  h.cur = Object.assign({}, NEUTRAL, seat); applyPose(h);
  const baby = makeBaby(); h.chest.add(baby); baby.position.set(0.02, -0.2, 0.15); baby.rotation.set(0.1, Math.PI + 0.2, 0.18);
  const sm = new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#6e5a4a', 0.45, false, 23)), roughness: 1, side: THREE.DoubleSide });
  const shawl = (r0, r1, hh, ph0, phl, folds) => {
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector2((r0 + (r1 - r0) * Math.pow(t, 0.8)) * h.s, -t * hh * h.s)); }
    const geo = new THREE.LatheGeometry(pts, 30, ph0, phl), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), k = 1 + Math.sin(a * folds + y * 18) * 0.045 * (-y / (hh * h.s) + 0.2); p.setX(i, x * k); p.setZ(i, z * k); }
    geo.computeVertexNormals(); return geo;
  };
  const backShawl = mesh(shawl(0.12, 0.25, 0.44, 0.95, 4.4, 9), sm, 0, 0.02 * h.s, -0.015); h.chest.add(backShawl);
  const drape = mesh(shawl(0.17, 0.29, 0.28, -0.3, 1.45, 6), sm, 0.0, -0.16 * h.s, 0.0); h.chest.add(drape);
  const band = mesh(new THREE.CylinderGeometry(0.048 * h.s, 0.048 * h.s, 0.07, 12, 1, true), new THREE.MeshStandardMaterial({ map: toTex(clothCanvas('#d8d0c0', 0.4, true, 71)), roughness: 1, side: THREE.DoubleSide }), 0, -0.14 * h.s, 0);
  h.armL.el.add(band);
  return { h, baby, seat, lang: 0.15, langT: 0.15, hasBaby: true, handing: 0, t: 0, coughT: 9, coughK: 0, cooT: 6, jaw: 0, talking: false };
})();

/* ---------------- helpers ---------------- */
function pushOut(p, c, r) {
  if (c.off) return false;
  if (p.x > c.x0 - r && p.x < c.x1 + r && p.z > c.z0 - r && p.z < c.z1 + r) {
    const dl = p.x - (c.x0 - r), dr = c.x1 + r - p.x, dn = p.z - (c.z0 - r), df = c.z1 + r - p.z, m = Math.min(dl, dr, dn, df);
    if (m === dl) p.x = c.x0 - r; else if (m === dr) p.x = c.x1 + r; else if (m === dn) p.z = c.z0 - r; else p.z = c.z1 + r;
    return true;
  }
  return false;
}
function collide(p, r) {
  for (const c of colliders) pushOut(p, c, r);
  const d = Math.hypot(p.x, p.z - 6); if (d > 23) { p.x *= 23 / d; p.z = 6 + (p.z - 6) * 23 / d; }
}
function floodOff() { return floodLevel() < 0.45; }
const _tw = new V3(), _td = new V3();
function torchHits(p) {
  if (!P.torchOn || P.battery <= 0) return false;
  P.torch.getWorldPosition(_tw); _td.set(p.x, p.y + 1.1, p.z).sub(_tw); const d = _td.length(); if (d > 13) return false;
  const f = new V3(Math.sin(P.yaw), -0.12, Math.cos(P.yaw)).normalize();
  return _td.normalize().dot(f) > Math.cos(0.36);
}
function bushCover(p) { for (const [x, z] of bushes) if (Math.hypot(p.x - x, p.z - z) < 1.05) return true; return false; }

/* ---------------- floating labels / toasts ---------------- */
const labels = [];
function project(p) { const v = p.clone().project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, vis: v.z < 1 }; }
function floatLabel(text, pos, cls, dur = 1.1) { const el = document.createElement('div'); el.className = 'flabel ' + (cls || ''); el.textContent = text; $('labels').appendChild(el); labels.push({ el, pos: pos.clone(), t: 0, dur }); }
function toast(text, dur = 3) { const el = $('toast'); el.textContent = text; el.classList.add('on'); G.toastT = dur; }
function setObj(text) { $('obj').textContent = text; }
