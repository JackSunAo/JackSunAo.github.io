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
  // 7) a long siege left to itself
  await ev(() => { const D = __dbg; D.resetGame(); D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.P.pos.set(1.6, 0, 0.6); D.P.invuln = 9999; D.setBar(true); D.infected.forEach(e => { e.aware = 1.2; e.provoked = true; }); D.G.camMode = 'command'; D.cam.userDist = 16; D.cam.yaw = 0.4; });
  for (let i = 0; i < 4; i++) { await ev(() => __dbg.step(300)); await log('t+' + (i + 1) * 10 + 's'); }
  await shot('44_long_siege', 10);
  console.log(errors.length ? errors.slice(0, 20).join('\n') : 'no errors');
  await browser.close();
})();
