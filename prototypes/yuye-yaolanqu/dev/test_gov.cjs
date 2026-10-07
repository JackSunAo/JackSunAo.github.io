const { openGame } = require('./bench_lib.cjs');
(async () => {
  const { browser, page, errs } = await openGame({});
  console.log(await page.evaluate(() => {
    const D = __dbg, P = D.PERF, log = []; P.auto = true; P.hz = 60; D.setQuality(2, true); P.settle = 0; P.capLv = 4; P.misses.length = 0;
    const run = (sec, gen, label) => { const lv0 = P.level; for (let i = 0; i < sec * 60; i++) D.perfFrame(gen(i), 0.004); log.push(label + ': level ' + D.QUALITY[lv0].name + ' → ' + D.QUALITY[P.level].name + ' (cap ' + D.QUALITY[P.capLv].name + ')'); };
    run(14, () => 1 / 60, 'smooth 14 s');
    run(14, () => 1 / 60, 'smooth 14 s more');
    run(4, i => i % 20 === 0 ? 2 / 60 : 1 / 60, 'a missed frame every 1/3 s');
    run(30, () => 1 / 60, 'smooth again 30 s');
    run(3, () => 1 / 40, 'heavy: 40 fps');
    run(3, i => i === 30 ? 1.2 : 1 / 60, 'one 1.2 s stall (tab switch)');
    P.auto = true; P.capLv = 4; D.setQuality(3, true); P.settle = 0; run(6, () => 0.4, 'a machine at 2.5 fps');
    P.auto = true; P.capLv = 4; D.setQuality(1, true); P.settle = 0; run(14, () => 1 / 60, 'from 低, smooth');
    // 120 Hz: every other refresh drawn
    P.hz = 120; P.lastDraw = 0; let drawn = 0; for (let t = 0; t < 1000; t += 1000 / 120) if (!D.perfSkip(t)) drawn++; log.push('120 Hz screen: ' + drawn + ' frames drawn in 1 s');
    P.hz = 60; P.lastDraw = 0; drawn = 0; for (let t = 0; t < 1000; t += 1000 / 60) if (!D.perfSkip(t)) drawn++; log.push('60 Hz screen: ' + drawn + ' frames drawn in 1 s');
    return log.join('\n');
  }));
  console.log('errors:', errs.length ? errs.join('\n') : 'none'); await browser.close();
})();
