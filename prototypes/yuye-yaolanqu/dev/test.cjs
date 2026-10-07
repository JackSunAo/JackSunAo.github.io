const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, 'shots');
require('fs').mkdirSync(out, { recursive: true });
const only = process.argv[2] ? process.argv[2].split(',') : null;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(3000);
  const ev = (f, a) => page.evaluate(f, a);
  const log = async (label, f) => console.log(label, JSON.stringify(await ev(f)));
  const shot = async (name, n = 90) => {
    if (only && !only.some(o => name.includes(o))) { await ev(k => __dbg.step(k), n); return; }
    await ev(k => __dbg.step(k), n); await page.waitForTimeout(1600); await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name);
  };
  const states = () => __dbg.infected.map(e => e.type + ':' + e.state + ' skull' + Math.round(e.body.skull) + ' blood' + Math.round(e.body.blood) + ' bal' + e.bal.toFixed(2) + ' aw' + e.aware.toFixed(2));
  await shot('01_title', 60);
  await ev(() => { __dbg.startGame(); __dbg.skipOpening(); });
  await shot('02_yard_command', 150);
  await log('after opening', states);
  await ev(() => { __dbg.G.camMode = 'close'; __dbg.cam.yaw = 0.15; });
  await shot('03_yard_close', 90);
  // combat: student only, player invulnerable for the staged shots
  const stage = () => { const D = __dbg, s = D.infected[1]; D.G.playT = 999; D.P.invuln = 999; D.G.camMode = 'close';
    D.infected.forEach((e, i) => { if (i !== 1) { e.pos.set(-12 + i * 20, -0.25, 22); e.state = 'lurk'; } });
    D.P.pos.set(-5.2, -0.25, 13.2); s.pos.set(-5.2 - 0.6, -0.25, 13.2 - 1.7); s.state = 'stalk'; s.cool = 99; s.aware = 1.2;
    D.P.yaw = Math.atan2(s.pos.x - D.P.pos.x, s.pos.z - D.P.pos.z); D.cam.yaw = D.P.yaw + Math.PI + 0.6; };
  await ev(stage);
  await shot('04_infected_close', 30);
  await ev(() => { const D = __dbg; D.infected[1].cool = 99; D.SQUAD.tokenCD = 99; D.startAttack('heavy', true); });
  await shot('05_heavy_swing', 8);
  await shot('06_after_hit', 14);
  await log('after heavy', states);
  await ev(() => { const D = __dbg; D.infected[1].cool = 99; D.startAttack('heavy', true); });
  await shot('06b_knockdown', 26);
  await log('after 2nd heavy', states);
  // the butcher sways from a light hit, then stumbles from a heavy one
  await ev(() => { const D = __dbg, b = D.infected[0]; D.infected[1].pos.set(-14, -0.25, 22); D.infected[1].state = 'lurk'; D.P.adr = 0; b.pos.set(D.P.pos.x + 0.2, -0.25, D.P.pos.z + 1.3); b.state = 'stalk'; b.cool = 99; b.bal = 1; b.aware = 1.2; D.P.yaw = Math.atan2(b.pos.x - D.P.pos.x, b.pos.z - D.P.pos.z); D.cam.yaw = D.P.yaw + Math.PI + 0.6; D.startAttack('quick'); });
  await shot('06c_butcher_sway', 16);
  await ev(() => { const D = __dbg, b = D.infected[0]; b.cool = 99; D.P.atk = null; D.startAttack('heavy', true); });
  await shot('06c2_butcher_stumble', 14);
  await log('butcher', states);
  // a kick sends the student into the butcher
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.P.invuln = 999; D.SQUAD.tokenCD = 99; D.G.camMode = 'command'; D.cam.userDist = 8;
    const s = D.infected[1], b = D.infected[0]; D.infected[2].pos.set(14, -0.25, 22);
    D.P.pos.set(-4, -0.25, 12); D.P.yaw = 0; s.pos.set(-4, -0.25, 13.1); s.yaw = Math.PI; s.state = 'recover'; s.st = 0; s.cool = 99; s.aware = 1.2; b.pos.set(-4.05, -0.25, 14.0); b.yaw = Math.PI; b.state = 'recover'; b.st = 0; b.cool = 99; b.aware = 1.2; D.cam.yaw = 1.2; D.startAttack('kick'); });
  await shot('06e_kick_domino', 22);
  await log('kick', states);
  // the axe: a severed arm, a severed leg (it crawls), a head
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.P.invuln = 999; D.SQUAD.tokenCD = 99; D.switchWeapon('axe'); D.G.camMode = 'close';
    const o = D.infected[2]; D.infected[0].pos.set(14, -0.25, 22); D.infected[1].pos.set(-14, -0.25, 22);
    D.P.pos.set(-3, -0.25, 13); o.pos.set(-3.3, -0.25, 14.4); o.state = 'stalk'; o.cool = 99; o.aware = 1.2; D.P.yaw = Math.atan2(o.pos.x - D.P.pos.x, o.pos.z - D.P.pos.z); D.cam.yaw = D.P.yaw + Math.PI + 0.7;
    o.severArm('R', new THREE.Vector3(Math.sin(D.P.yaw), 0, Math.cos(D.P.yaw))); });
  await shot('06f_axe_arm', 18);
  await ev(() => { const D = __dbg, b = D.infected[0]; b.pos.set(D.P.pos.x + 1.2, -0.25, D.P.pos.z + 1.0); b.state = 'stalk'; b.cool = 99; b.aware = 1.2; b.severLeg('L', new THREE.Vector3(1, 0, 0)); });
  await shot('06g_leg_fall', 40);
  await shot('06g2_crawler', 70);
  await log('crawler', states);
  await ev(() => { const D = __dbg, o = D.infected[2]; o.state = 'stalk'; o.pos.set(D.P.pos.x - 0.4, -0.25, D.P.pos.z + 1.2); D.P.yaw = Math.atan2(o.pos.x - D.P.pos.x, o.pos.z - D.P.pos.z); o.hp = 1; o.decapitate(new THREE.Vector3(Math.sin(D.P.yaw), 0, Math.cos(D.P.yaw))); o.hp = 0; o.startFall({ x: 0, z: -1 }, 1); o.dieOnLand = true; });
  await shot('06h_decap', 12);
  await shot('06h2_decap_after', 45);
  // exhausted: the same swing, slower and smaller
  await ev(() => { const D = __dbg; D.P.stamina = 0; D.P.atk = null; D.switchWeapon('club'); D.P.atk = null; D.startAttack('heavy'); });
  await shot('06i_spent_swing', 10);
  await log('spent', () => ({ sta: __dbg.P.stamina, fat: __dbg.fatigue(), atkDur: __dbg.P.atk && __dbg.P.atk.dur }));
  // a real pin
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.camMode = 'close'; const o = D.infected[2]; D.P.invuln = 0; D.P.pos.set(-4, -0.25, 12.5); o.pos.set(D.P.pos.x - 1.2, -0.25, D.P.pos.z + 0.4); D.startPin(o); D.cam.yaw = 2.2; });
  await shot('06d_pinned', 20);
  // senses: a whistle in the dark brings them over to look
  await ev(() => { const D = __dbg; D.resetGame(); D.G.camMode = 'command'; D.cam.userDist = 17; D.P.pos.set(-7, -0.25, 10); D.P.shutter = true; D.P.crouch = true; D.G.flood.next = D.G.t + 999; D.P.whistleCD = 0;
    const [b, s, o] = D.infected; b.pos.set(-1.5, -0.25, 16.5); s.pos.set(-12.5, -0.25, 13); o.pos.set(-9, -0.25, 3.2); D.infected.forEach(e => { e.yaw = Math.atan2(e.pos.x - D.LURK_C.x, e.pos.z - D.LURK_C.z); }); });
  await ev(() => __dbg.step(10));
  await ev(() => { const D = __dbg; D.P.whistleCD = 0; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX' })); });
  await shot('07a_whistle', 20);
  await shot('07b_investigate', 90);
  await log('investigate', states);
  // roars: spot, then the leader orders a flank
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.P.invuln = 999; D.G.camMode = 'command'; D.cam.userDist = 15; D.P.pos.set(-1, -0.25, 13); D.G.flood.next = D.G.t + 999; D.infected[2].provoked = true; D.infected[2].aware = 1.1; });
  await shot('07c_spot_roar', 14);
  await shot('07d_flank', 120);
  await log('hunt', () => __dbg.infected.map(e => e.type + ':' + e.state + ' slot' + (e.slot === null ? '-' : e.slot.toFixed(2))));
  // blackout: the leader calls them in
  await ev(() => { __dbg.resetGame(); });
  await ev(() => { const D = __dbg; D.G.playT = 999; D.G.camMode = 'command'; D.P.invuln = 999; D.cam.yaw = 0.15; D.cam.userDist = 11; D.G.flood.next = D.G.t; });
  await shot('07e_flood_off_rally', 75);
  await ev(() => { const D = __dbg; D.infected.forEach((e, i) => { e.pos.set(D.P.pos.x - 1.6 + i * 1.6, -0.25, D.P.pos.z + 2.2); e.state = 'stalk'; e.cool = 99; e.adapt = 0; e.wasLit = false; }); D.G.flood.state = 'restore'; D.G.flood.t = 0.69; });
  await shot('07f_restore_startle', 6);
  await shot('07g_shield_advance', 50);
  await ev(() => { __dbg.resetGame(); });
  await ev(() => { const D = __dbg; D.G.playT = 999; D.P.invuln = 999; D.G.flood.next = D.G.t + 999; D.P.pos.set(-4.0, -0.25, 12.5); D.P.yaw = -0.4; D.infected.forEach((e, i) => { if (i !== 1) e.pos.set(15, -0.25, 25); }); const s = D.infected[1]; s.pos.set(-5.6, -0.25, 15.5); s.state = 'stalk'; s.cool = 99; s.adapt = 0; s.wasLit = false; s.aware = 1.2; D.toggleTorch(); D.G.camMode = 'close'; D.cam.yaw = -0.4 + Math.PI + 0.45; });
  await shot('08_torch_feral', 12);
  await ev(() => { __dbg.resetGame(); });
  await ev(() => { const D = __dbg; if (D.P.torchOn) D.toggleTorch(); D.G.camMode = 'command'; D.P.pos.set(0.6, 0, -0.2); D.P.yaw = Math.PI + 0.6; D.cam.yaw = 0.12; });
  await shot('09_cabin_command', 120);
  await ev(() => { __dbg.startDialog('start'); });
  await shot('10_dialog', 140);
  await ev(() => { for (let i = 0; i < 12; i++) { __dbg.advanceDialog(); } });
  await shot('11_choices', 30);
  await ev(() => { __dbg.choose('take'); for (let i = 0; i < 12; i++) { __dbg.step(40); __dbg.advanceDialog(); } });
  await shot('12_handover', 30);
  await shot('13_card', 60);
  // a free fight with everything on: three of them, no invulnerability, AI driving
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.camMode = 'command'; D.cam.userDist = 12; D.P.pos.set(-3, -0.25, 13); D.infected.forEach(e => { e.provoked = true; e.aware = 1.2; }); });
  await shot('14_free_fight', 150);
  await log('free fight', () => ({ p: __dbg.P.state, sta: Math.round(__dbg.P.stamina), adr: __dbg.P.adr.toFixed(2), inf: __dbg.infected.map(e => e.type + ':' + e.state) }));
  console.log(errors.slice(0, 30).join('\n'));
  await browser.close();
})();
