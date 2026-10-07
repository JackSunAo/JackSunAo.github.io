const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(1500);
  const ev = (f, a) => page.evaluate(f, a);
  // 1. the squad is there, at its posts
  console.log(await ev(() => { const D = __dbg; D.startGame(); D.skipOpening(); D.step(60); return D.defenders.map(d => d.name + ' ' + d.state + ' @' + d.pos.x.toFixed(2) + ',' + d.pos.z.toFixed(2) + ' order ' + d.order + '/' + d.post).join(' | '); }));
  // 2. a siege with you inside: run 100 s of game time, log what happens
  const r = await ev(() => {
    const D = __dbg, log = []; D.P.pos.set(1.6, 0, 0.9); D.G.playT = 999; D.P.invuln = 0;
    D.infected.forEach(e => { e.provoked = true; e.aware = 1.2; });
    let last = '';
    for (let i = 0; i < 3000; i++) {
      D.step(1);
      if (i % 150 === 0) {
        const s = 't' + (i / 30).toFixed(0) + ' siege:' + D.SIEGE.on + ' door:' + (D.door.fallen ? 'fallen' : D.door.ang.toFixed(1) + (D.door.barred ? 'B' : '')) + ' holes:' + D.door.holes
          + ' | ' + D.defenders.map(d => d.name + ':' + d.state + (d.bitten ? '(咬)' : '') + ' b' + d.blood.toFixed(0) + ' m' + d.morale.toFixed(2) + ' s' + d.stamina.toFixed(0)).join(' ')
          + ' | ' + D.infected.map(e => e.type[0] + ':' + e.state + (e.dead ? 'X' : '') + '>' + (e.tgt ? e.tgt.name : '-')).join(' ');
        log.push(s);
      }
      if (D.P.dead) { log.push('player died @' + (i / 30).toFixed(1)); break; }
    }
    return log;
  });
  console.log(r.join('\n'));
  console.log('errors:', errs.length ? errs.slice(0, 8).join('\n---\n') : 'none');
  await browser.close();
})();
