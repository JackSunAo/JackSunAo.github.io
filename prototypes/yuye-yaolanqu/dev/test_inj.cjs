const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = async (name, n, wait = 2500) => { await ev(k => __dbg.step(k), n); await page.waitForTimeout(wait); await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
  const body = () => __dbg.infected.map(e => ({ t: e.type, st: e.state, sk: Math.round(e.body.skull), bl: Math.round(e.body.blood), arm: e.body.arm.L + '/' + e.body.arm.R, leg: e.body.leg.L + '/' + e.body.leg.R, jaw: e.body.jaw, crawl: e.crawler, dead: e.dead }));
  const log = async l => console.log(l, JSON.stringify(await ev(body)));
  await ev(() => { __dbg.startGame(); __dbg.skipOpening(); __dbg.step(40); });
  await page.waitForTimeout(2500);
  // 1) arms: one shoulder out of its socket, one forearm snapped; it still comes
  await ev(() => { const D = __dbg; D.G.playT = 999; D.P.invuln = 999; D.SQUAD.tokenCD = 99; D.G.camMode = 'close'; D.G.flood.next = D.G.t + 999;
    const o = D.infected[2]; D.infected[0].pos.set(14, -0.25, 22); D.infected[1].pos.set(-14, -0.25, 22); D.infected[0].state = D.infected[1].state = 'lurk';
    D.P.pos.set(-3, -0.25, 12.5); D.P.yaw = 0.2; o.pos.set(-2.3, -0.25, 16.5); o.state = 'stalk'; o.aware = 1.2; o.cool = 99; o.dislocate('L'); o.fracture('arm', 'R'); D.cam.yaw = Math.PI + 0.5; });
  await shot('20_dangling_arms', 40);
  await log('arms');
  // 2) a broken leg: it limps on, the shin folding the wrong way
  await ev(() => { const D = __dbg, b = D.infected[0]; b.pos.set(-1.0, -0.25, 17.5); b.state = 'stalk'; b.aware = 1.2; b.cool = 99; b.fracture('leg', 'L'); D.infected[2].pos.set(14, -0.25, 22); D.infected[2].state = 'lurk'; });
  await shot('21_limp', 36);
  await log('limp');
  // 3) crouched sweeps go for the legs
  await ev(() => { const D = __dbg, s = D.infected[1]; D.infected[0].pos.set(14, -0.25, 25); D.infected[0].state = 'lurk'; s.pos.set(-3.2, -0.25, 13.9); s.yaw = Math.PI; s.state = 'recover'; s.st = 0; s.cool = 99; s.aware = 1.2; D.P.crouch = true; D.P.yaw = 0; });
  for (let i = 0; i < 4; i++) await ev(() => { const D = __dbg, s = D.infected[1]; if (s.standing) { s.pos.set(-3.2, -0.25, 13.9); s.state = 'recover'; s.st = 0; } D.P.atk = null; D.P.state = 'move'; D.startAttack('quick'); D.step(20); });
  await shot('22_low_sweep', 6);
  await log('sweep');
  // 4) both legs gone at the knee: it crawls; stomp its arm, then its head
  await ev(() => { const D = __dbg, s = D.infected[1]; D.P.crouch = false; if (!s.crawler) { s.fracture('leg', 'L'); s.fracture('leg', 'R'); s.crawler = true; s.yaw = Math.atan2(D.P.pos.x - s.pos.x, D.P.pos.z - s.pos.z); s.startFall({ x: 0, z: 1 }, 0.8); } });
  await shot('23_crawler', 90);
  await log('crawl');
  await ev(() => { const D = __dbg, s = D.infected[1]; const f = s.fwd(); D.P.pos.set(s.pos.x + f.x * 2.6, -0.25, s.pos.z + f.z * 2.6); D.P.yaw = Math.atan2(-f.x, -f.z); D.P.atk = null; D.P.state = 'move'; D.P.invuln = 999; });
  await log('stomp target ' + JSON.stringify(await ev(() => { const t = __dbg.stompTarget && __dbg.stompTarget(); return t ? t.part : null; })));
  for (let i = 0; i < 3; i++) await ev(() => { const D = __dbg; D.P.atk = null; D.P.state = 'move'; D.startAttack('kick'); D.step(12); });
  await shot('24_stomp', 4);
  await log('stomped');
  // 5) a broken jaw: it pins you but cannot bite, howls, and another comes to do it
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.G.camMode = 'command'; D.cam.userDist = 10; const o = D.infected[2], b = D.infected[0]; D.infected[1].pos.set(-14, -0.25, 24); D.infected[1].state = 'lurk';
    D.P.pos.set(-3, -0.25, 12.5); o.pos.set(-3.6, -0.25, 13); o.breakJaw(); D.P.invuln = 0; D.startPin(o); b.pos.set(2, -0.25, 17); b.state = 'stalk'; b.aware = 1.2; b.provoked = true; });
  await shot('25_jaw_pin', 130);
  await log('jaw');
  await shot('26_jaw_bite', 150, 3500);
  console.log('player dead:', await ev(() => __dbg.P.dead));
  // 6) a crawler grabs an ankle; kick its face until it lets go
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.G.camMode = 'close'; const s = D.infected[1]; D.infected[0].pos.set(14, -0.25, 24); D.infected[2].pos.set(-14, -0.25, 24); D.infected[0].state = D.infected[2].state = 'lurk';
    D.P.pos.set(-3, -0.25, 12.5); D.P.invuln = 0; s.pos.set(-3, -0.25, 15.5); s.fracture('leg', 'L'); s.fracture('leg', 'R'); s.crawler = true; s.fdx = 0; s.fdz = 1; s.yaw = Math.PI; s.setState('crawl'); s.aware = 1.2; D.cam.yaw = Math.PI * 0.5; });
  await shot('27_ankle_grab', 120);
  console.log('pinned by crawler:', await ev(() => __dbg.P.state + ' ' + (__dbg.P.pinnedBy && __dbg.P.pinnedBy.crawler)));
  for (let i = 0; i < 6; i++) await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ' })); __dbg.step(6); });
  await shot('28_kick_face', 10);
  await log('kickface');
  console.log('player:', await ev(() => __dbg.P.state + ' dead=' + __dbg.P.dead));
  console.log(errors.length ? errors.slice(0, 20).join('\n') : 'no errors');
  await browser.close();
})();
