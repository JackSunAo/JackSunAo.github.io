const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = async (name, n, wait = 3000) => { await ev(k => __dbg.step(k), n); await page.waitForTimeout(wait); await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
  const st = () => ({ inf: __dbg.infected.map(e => e.type + ':' + e.state + (e.workKind && e.state === 'work' ? '/' + e.workKind : '') + (e.entry ? '@' + e.entry.id : '') + (e.hasAxe ? '(axe)' : '')),
    door: { ang: +__dbg.door.ang.toFixed(2), barred: __dbg.door.barred, barHp: +__dbg.door.barHp.toFixed(2), holes: __dbg.door.holes, reach: __dbg.door.reach, crawl: __dbg.door.crawl, hinge: __dbg.door.hinge.map(x => +x.toFixed(2)), fallen: __dbg.door.fallen },
    back: { glass: __dbg.winBack.glass, boards: __dbg.winBack.boards.length }, left: { boards: __dbg.winLeft.boards.map(b => +b.hp.toFixed(2)) }, siege: __dbg.SIEGE.on, p: __dbg.P.state + (__dbg.P.dead ? ' DEAD' : '') });
  const log = async l => console.log(l, JSON.stringify(await ev(st)));
  await ev(() => { __dbg.startGame(); __dbg.skipOpening(); __dbg.step(30); });
  await page.waitForTimeout(2500);
  // 1) you go inside and bar the door; they notice; the leader walks the walls and tests the ways in
  await ev(() => { const D = __dbg; D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.P.pos.set(0.3, 0, 1.6); D.P.yaw = 0; D.setBar(true); D.G.camMode = 'command'; D.cam.userDist = 15; D.cam.yaw = 0.6;
    D.infected.forEach(e => { e.aware = 1.2; e.provoked = true; }); });
  await shot('30_siege_scout', 150);
  await log('scout');
  await shot('31_siege_plan', 150);
  await log('plan');
  // 2) the firefighter on the door: lock the plan so he keeps at it; watch the planks go
  await ev(() => { const D = __dbg; D.SIEGE.lock = true; const f = D.infected.find(e => e.type === 'fireman'); D.infected.forEach(e => { if (e !== f) { e.entry = null; e.pos.set(12, -0.25, 18); e.setState('lurk'); e.aware = 0; } });
    f.entry = D.ENTRIES[0]; f.slotN = 0; f.pos.set(0.2, 0, 4.4); f.setState('siege'); D.P.pos.set(0.25, 0, 1.4); D.P.yaw = 0; D.G.camMode = 'close'; D.cam.yaw = Math.PI; });
  await shot('32_chop_start', 90);
  await log('chop1');
  await shot('33_chop_more', 300);
  await log('chop2');
  await shot('34_chop_hole', 300);
  await log('chop3');
  await shot('35_chop_through', 400);
  await log('chop4');
  // 3) the butcher with his shoulder on a fresh, barred door
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.SIEGE.lock = true; D.P.pos.set(-1.5, 0, 0.8); D.setBar(true); D.infected.forEach(e => { e.aware = 1.2; e.provoked = true; });
    D.step(2); const b = D.infected.find(e => e.type === 'butcher'); D.infected.forEach(e => { if (e !== b) { e.pos.set(-12, -0.25, 20); e.setState('lurk'); e.aware = 0; e.provoked = false; } });
    D.SIEGE.on = true; D.SIEGE.scoutDone = true; b.entry = D.ENTRIES[0]; b.slotN = 0; b.pos.set(-0.3, 0, 4.4); b.setState('siege'); D.G.camMode = 'command'; D.cam.userDist = 9; D.cam.yaw = 0.5; });
  await shot('36_ram', 300);
  await log('ram1');
  await shot('37_ram_sag', 600);
  await log('ram2');
  // 4) the back window: one punch through the glass, then over the sill; hit it and it goes back out
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.SIEGE.lock = true; D.P.pos.set(1.0, 0, -0.5); D.setBar(true); D.infected.forEach(e => { e.aware = 1.2; e.provoked = true; });
    D.step(2); const s = D.infected.find(e => e.type === 'student'); D.infected.forEach(e => { if (e !== s) { e.pos.set(-12, -0.25, 20); e.setState('lurk'); e.aware = 0; e.provoked = false; } });
    D.SIEGE.on = true; D.SIEGE.scoutDone = true; s.entry = D.winBack; s.slotN = 0; s.pos.set(-1.3, -0.25, -5.5); s.setState('siege'); D.G.camMode = 'command'; D.cam.userDist = 10; D.cam.yaw = Math.PI - 0.5; });
  await shot('38_window_smash', 75);
  await log('win1');
  await shot('39_window_climb', 24, 2500);
  await log('win2');
  await ev(() => { const D = __dbg, s = D.infected.find(e => e.type === 'student'); D.P.pos.set(-1.0, 0, -1.95); D.P.yaw = Math.PI; D.P.atk = null; D.P.state = 'move'; D.startAttack('heavy', true); });
  await shot('40_pushed_out', 20);
  await log('win3');
  // 5) the side window: boards pried off one at a time; you nail one back
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.SIEGE.lock = true; D.P.pos.set(-2.6, 0, 1.6); D.setBar(true); D.infected.forEach(e => { e.aware = 1.2; e.provoked = true; });
    D.step(2); const o = D.infected.find(e => e.type === 'office'); D.infected.forEach(e => { if (e !== o) { e.pos.set(12, -0.25, 20); e.setState('lurk'); e.aware = 0; e.provoked = false; } });
    D.SIEGE.on = true; D.SIEGE.scoutDone = true; o.entry = D.winLeft; o.slotN = 0; o.pos.set(-6, -0.25, 3); o.setState('siege'); D.G.camMode = 'command'; D.cam.userDist = 9; D.cam.yaw = -1.2; });
  await shot('41_pry', 180);
  await log('pry1');
  await ev(() => { const D = __dbg; D.P.pos.set(-3.15, 0, 1.6); D.P.state = 'move'; D.interact(); });
  await shot('42_nail', 40);
  await log('pry2');
  // 6) outside, the axe swung at you
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.P.pos.set(-4, -0.25, 12); D.P.yaw = 0; const f = D.infected.find(e => e.type === 'fireman'); D.infected.forEach(e => { if (e !== f) { e.pos.set(14, -0.25, 22); e.setState('lurk'); } });
    f.pos.set(-4, -0.25, 13.6); f.yaw = Math.PI; f.aware = 1.2; f.provoked = true; f.state = 'axeWind'; f.st = 0; D.G.camMode = 'close'; D.cam.yaw = 1.0; });
  await shot('43_axe_swing', 32);
  await log('axe');
  // 7) a long siege left to itself
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.P.pos.set(1.6, 0, 0.6); D.P.invuln = 9999; D.setBar(true); D.infected.forEach(e => { e.aware = 1.2; e.provoked = true; }); D.G.camMode = 'command'; D.cam.userDist = 16; D.cam.yaw = 0.4; });
  for (let i = 0; i < 4; i++) { await ev(() => __dbg.step(300)); await log('t+' + (i + 1) * 10 + 's'); }
  await shot('44_long_siege', 10);
  console.log(errors.length ? errors.slice(0, 20).join('\n') : 'no errors');
  await browser.close();
})();
