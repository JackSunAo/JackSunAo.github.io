// hitches: the slowest frames of a long session, and what happened in them
const { openGame } = require('./bench_lib.cjs');
(async () => {
  const { browser, page, errs } = await openGame({});
  const r = await page.evaluate(() => {
    const D = __dbg, R = D.renderer, gl = R.getContext(), px = new Uint8Array(4), log = [];
    const frame = (label) => { const p0 = R.info.programs.length, t0 = performance.now(); R.info.reset(); D.renderFrame(1 / 60); const t1 = performance.now(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return { ms: t1 - t0, newProg: R.info.programs.length - p0, label }; };
    const out = [];
    let f = frame('first frame (title)'); out.push(f);
    D.startGame(); out.push(frame('start game')); for (let i = 0; i < 30; i++) frame('');
    D.skipOpening(); out.push(frame('skip opening')); for (let i = 0; i < 60; i++) { out.push(frame('play')); if (i % 4 === 0) { const t0 = performance.now(); if (D.feedPool()) out.push({ ms: performance.now() - t0, newProg: 0, label: 'pool: one body built off stage (frame ' + i + ')' }); } }
    const t0 = performance.now(); D.spawnWave(); const spawnMs = performance.now() - t0; out.push({ ms: spawnMs, newProg: 0, label: 'spawnWave() itself (' + D.infected.length + ' infected)' });
    out.push(frame('first frame after spawn')); for (let i = 0; i < 10; i++) out.push(frame('after spawn'));
    D.P.pos.set(1.6, 0, 0.9); out.push(frame('walk in (cutaway)')); for (let i = 0; i < 10; i++) out.push(frame('inside'));
    D.toggleTorch(); out.push(frame('torch on')); D.setCommand(true, true); out.push(frame('command view')); D.setCommand(false, true);
    const e = D.infected.find(x => !x.dead); if (e) { e.severArm('L', new THREE.Vector3(1, 0, 0)); out.push(frame('sever arm')); e.decapitate(new THREE.Vector3(0, 1, 0)); out.push(frame('decapitate')); }
    for (let i = 0; i < 6; i++) D.doorChop(0.5, 1.0, 2); out.push(frame('door chopped'));
    D.G.flood.next = D.G.t; for (let i = 0; i < 100; i++) out.push(frame('flood flicker/off'));
    return out.filter(o => o.label && (o.ms > 14 || o.newProg || /spawn|first|start|torch|command|sever|decap|door/.test(o.label))).map(o => o.ms.toFixed(1).padStart(7) + ' ms  ' + (o.newProg ? '+' + o.newProg + ' programs  ' : '') + o.label).join('\n');
  });
  console.log(r); console.log('errors:', errs.length ? errs.join('\n') : 'none'); await browser.close();
})();
