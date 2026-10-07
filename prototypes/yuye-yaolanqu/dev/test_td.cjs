const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = async (name, n, wait = 2800) => { await ev(k => __dbg.step(k), n); await page.waitForTimeout(wait); await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
  const iso = (keep) => `const D = __dbg; D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.SQUAD.tokenCD = 0; D.infected.forEach(e => { if (e.type !== '${keep}') { e.pos.set(14, -0.25, 24); e.setState('lurk'); e.aware = 0; e.provoked = false; } });`;
  await ev(() => { __dbg.startGame(); __dbg.skipOpening(); __dbg.step(30); });
  await page.waitForTimeout(2000);
  // 6) a quiet kill: the student lurking with its back to you
  await ev(() => { const D = __dbg; D.resetGame(); });
  await ev(new Function(iso('student') + ` const s = D.infected.find(e => e.type === 'student'); D.G.playT = 0; s.pos.set(-6, -0.25, 15); s.yaw = Math.PI; s.state = 'lurk'; s.st = 0; s.angVel = 0; s.aware = 0.2; s.seen = 0; D.P.pos.set(-6, -0.25, 15.9); D.P.yaw = Math.PI; D.P.crouch = true; D.P.shutter = true; D.G.camMode = 'close'; D.cam.yaw = 0.9;`));
  await ev(() => __dbg.step(2));
  console.log('takedown target:', JSON.stringify(await ev(() => { const t = __dbg.takedownTarget(); return t && { kind: t.kind, type: t.e.type }; })));
  await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); });
  await shot('64_takedown', 16);
  await shot('65_takedown_after', 40);
  console.log('after takedown:', JSON.stringify(await ev(() => __dbg.infected.map(e => e.type + ':' + e.state + ' aw' + e.aware.toFixed(2)))));
  console.log(errors.length ? errors.slice(0, 10).join('\n') : 'no errors');
  await browser.close();
})();
