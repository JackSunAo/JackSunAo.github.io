// the fast path must look like the plain path: render the same frozen frame both ways and diff the pixels
const { openGame } = require('./bench_lib.cjs');
const fs = require('fs');
(async () => {
  const { browser, page, errs } = await openGame({ w: 960, h: 540 });
  const shots = [
    ['outdoor', `D.startGame(); D.skipOpening(); D.step(300); D.P.pos.set(0.6, -0.25, 7.8); D.step(40);`],
    ['indoor', `D.P.pos.set(1.6, 0, 0.9); D.step(60);`],
    ['siege', `D.P.pos.set(1.2, 0, -0.6); D.G.playT = 999; D.P.invuln = 99; D.spawnWave(); D.spawnWave(); D.infected.forEach(e => { if (!e.dead) { e.provoked = true; e.aware = 1.2; } }); D.step(500);`],
    ['command', `D.setCommand(true, true); D.step(20);`],
  ];
  for (const [name, code] of shots) {
    const r = await page.evaluate(async code => {
      const D = __dbg; new Function('D', code)(D);
      const R = D.renderer, grab = () => { D.composerRender(); return R.domElement.toDataURL('image/png'); };
      grab(); const fast = grab();            // twice: the first may be filling caches
      D.setReference(true); grab(); const plain = grab(); D.setReference(false); grab();
      const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = src; });
      const [a, b] = await Promise.all([load(fast), load(plain)]);
      const W = a.width, H = a.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      g.drawImage(a, 0, 0); const A = g.getImageData(0, 0, W, H).data; g.drawImage(b, 0, 0); const B = g.getImageData(0, 0, W, H).data;
      const out = g.createImageData(W, H); let sum = 0, big = 0, max = 0;
      for (let i = 0; i < A.length; i += 4) {
        const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
        sum += d; if (d > 12) big++; if (d > max) max = d;
        const v = Math.min(255, d * 8); out.data[i] = v; out.data[i + 1] = v * 0.4; out.data[i + 2] = 0; out.data[i + 3] = 255;
      }
      g.putImageData(out, 0, 0);
      return { fast, plain, diff: c.toDataURL('image/png'), mean: sum / (W * H), bigPct: 100 * big / (W * H), max, bad: D.checkStatic() };
    }, code);
    for (const k of ['fast', 'plain', 'diff']) fs.writeFileSync(`shots/cmp_${name}_${k}.png`, Buffer.from(r[k].split(',')[1], 'base64'));
    console.log(`${name}: mean diff ${r.mean.toFixed(3)} / 255, pixels off by >12: ${r.bigPct.toFixed(3)} %, max ${r.max.toFixed(0)}${r.bad.length ? '\n  static check: ' + r.bad.slice(0, 8).join('; ') : ''}`);
  }
  console.log('errors:', errs.length ? errs.slice(0, 6).join('\n---\n') : 'none');
  await browser.close();
})();
