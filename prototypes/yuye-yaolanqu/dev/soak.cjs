// a long fight, rendered frame by frame: do geometries, textures, programs or the heap keep growing?
const { openGame } = require('./bench_lib.cjs');
(async () => {
  const { browser, page, errs } = await openGame({ w: 800, h: 450 });
  const r = await page.evaluate(() => {
    const D = __dbg, R = D.renderer, out = [];
    const snap = label => { const m = R.info.memory; out.push(`${label}: geometries ${m.geometries}, textures ${m.textures}, programs ${R.info.programs.length}, heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB, infected ${D.infected.length}, pool ${D.POOL.length}`); };
    D.startGame(); D.skipOpening(); D.G.playT = 999; D.P.invuln = 1e9; D.P.pos.set(1.2, 0, -0.6);
    for (let i = 0; i < 30; i++) D.renderFrame(1 / 30); snap('start');
    for (let wave = 0; wave < 4; wave++) {
      for (let k = 0; k < 6; k++) D.feedPool();
      D.spawnWave(); D.infected.forEach(e => { if (!e.dead) { e.provoked = true; e.aware = 1.2; } });
      for (let i = 0; i < 400; i++) { if (i % 20 === 0) D.renderFrame(1 / 30); else D.step(1); if (i === 200) D.infected.forEach(e => { if (!e.dead && Math.random() < 0.5) e.die && e.die(); }); }
      D.infected.forEach(e => { if (!e.dead) e.die && e.die(); }); for (let i = 0; i < 30; i++) D.renderFrame(1 / 30);
      if (window.gc) window.gc(); snap('after wave ' + D.G.wave);
    }
    D.resetGame(); for (let i = 0; i < 5; i++) D.renderFrame(1 / 30); if (window.gc) window.gc(); snap('after reset');
    return out.join('\n');
  });
  console.log(r); console.log('errors:', errs.length ? errs.slice(0, 5).join('\n') : 'none'); await browser.close();
})();
