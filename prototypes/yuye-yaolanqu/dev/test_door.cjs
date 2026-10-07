const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { const D = __dbg; D.startGame(); D.skipOpening(); D.step(30); D.G.flood.next = D.G.t + 999; D.infected.forEach(e => { e.dead = true; e.h.root.visible = false; e.bar.style.display = 'none'; });
    D.P.pos.set(1.25, 0, 4.7); D.P.yaw = Math.PI + 0.6; D.setBar(true); D.G.camMode = 'command'; D.cam.userDist = 5.5; D.cam.pitch = 0.42; D.cam.yaw = -0.35; D.step(20); });
  // the firefighter's blows, one at a time, aimed like his: the lock side at bar height first
  const chops = [0, 6, 15];
  let done = 0;
  for (const n of chops) {
    const r = await ev(k => { const D = __dbg; for (let i = 0; i < k; i++) { const tgt = !D.door.reach ? { x: 0.74 + Math.random() * 0.16, y: 0.92 + Math.random() * 0.28 } : { x: 0.55 + Math.random() * 0.3, y: 0.25 + Math.random() * 0.5 }; D.doorChop(tgt.x, tgt.y, 1); D.step(45); } D.step(30); return { holes: D.door.holes, reach: D.door.reach, crawl: D.door.crawl, bar: +D.door.barHp.toFixed(2), segs: D.door.segs.map(c => c.map(s => s.broken ? 'X' : s.hp < 0.55 ? '/' : '.').join('')).join(' ') }; }, n - done);
    done = n; await page.waitForTimeout(3000); await page.screenshot({ path: path.join(out, '50_door_' + String(n).padStart(2, '0') + '.png') }); console.log('chops', n, JSON.stringify(r));
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
