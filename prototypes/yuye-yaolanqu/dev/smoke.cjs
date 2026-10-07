const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(2000);
  // a long AI-driven run: player fights back automatically, waves, resets
  const r = await page.evaluate(() => {
    const D = __dbg, log = []; D.startGame(); D.skipOpening(); D.step(40); D.G.playT = 999; D.P.invuln = 0;
    D.infected.forEach(e => { e.provoked = true; e.aware = 1.2; });
    let kills = 0;
    for (let i = 0; i < 2400; i++) {
      D.step(1);
      if (D.P.state === 'pinned') { if (i % 3 === 0) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); }
      else if (!D.P.atk && i % 9 === 0) { const t = D.infected.find(e => !e.dead && e.pos.distanceTo(D.P.pos) < 3); if (t) { D.P.yaw = Math.atan2(t.pos.x - D.P.pos.x, t.pos.z - D.P.pos.z); D.startAttack(i % 27 === 0 ? 'heavy' : (i % 18 === 0 ? 'kick' : 'quick')); } }
      if (i === 600) D.switchWeapon('axe');
      if (D.P.dead) { log.push('died@' + i); D.resetGame(); D.G.playT = 999; D.switchWeapon('axe'); D.infected.forEach(e => { e.provoked = true; e.aware = 1.2; }); }
      if (i === 1800) D.G.flood.next = D.G.t;
    }
    log.push('wave ' + D.G.wave, 'infected ' + D.infected.length, 'states ' + D.infected.map(e => e.type + ':' + e.state + (e.crawler ? '(crawl)' : '') + (e.headless ? '(headless)' : '')).join(','));
    return log;
  });
  console.log(r.join('\n')); console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none');
  await browser.close();
})();
