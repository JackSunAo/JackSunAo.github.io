// Foot slip: walk a body at fixed speeds through the real pose path (walkPose -> poseTo) and measure how far a planted
// foot moves across the ground. A foot counts as planted while its sole is within 2 cm of the lowest it gets.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'dist/test.html') + (process.argv[2] === 'old' ? '#old' : '')); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    function oldWalk(ph, amt, run = 0) { const s = Math.sin(ph), c = Math.cos(ph), A = (0.5 + run * 0.25) * amt; return { hipLx: -s * A, hipRx: s * A, knL: Math.max(0, c) * (0.85 + run * 0.6) * amt + 0.06, knR: Math.max(0, -c) * (0.85 + run * 0.6) * amt + 0.06, ankL: -Math.max(0, c) * 0.3 * amt, ankR: -Math.max(0, -c) * 0.3 * amt, shLx: s * (0.42 + run * 0.35) * amt, shRx: -s * (0.42 + run * 0.35) * amt, elL: 0.2 + amt * (0.3 + run * 0.6), elR: 0.2 + amt * (0.3 + run * 0.6), spX: 0.05 * amt + run * 0.2, spY: s * 0.09 * amt, bodyY: -Math.abs(c) * 0.035 * amt - run * 0.03, headX: -0.03 * amt - run * 0.12 }; }
    const D = __dbg, out = {}, OLD = location.hash === '#old';
    for (const sp of [0.6, 1.4, 2.4, 4.0]) {
      const h = D.makeHumanForTest({ height: 1.76 }); D.initSprings(h); let ph = 0, x = 0; const dt = 1 / 60, V = new THREE.Vector3();
      const rec = { L: [], R: [] };
      for (let i = 0; i < 360; i++) {
        x += sp * dt; ph += dt * sp * (OLD ? 3.3 : D.gaitK(sp, h.s)); h.root.position.set(0, 0, x);
        D.poseTo(h, (OLD ? oldWalk : D.walkPose)(ph, Math.min(1, sp / 2.25), Math.max(0, Math.min(1, (sp - 2.6) / 1.4)), sp, h.s), 13, dt);
        h.root.updateMatrixWorld(true);
        if (i > 120) for (const s of ['L', 'R']) { h[s].foot.getWorldPosition(V); rec[s].push([V.z, V.y]); }
      }
      let slip = 0, n = 0, maxLift = 0;
      for (const s of ['L', 'R']) { const a = rec[s], lo = Math.min(...a.map(q => q[1])); maxLift = Math.max(maxLift, Math.max(...a.map(q => q[1])) - lo);
        for (let i = 1; i < a.length; i++) if (a[i][1] < lo + 0.02 && a[i - 1][1] < lo + 0.02) { slip += Math.abs(a[i][0] - a[i - 1][0]); n++; } }
      out[sp] = { slipPerPlantedSec: +(slip / (n * dt)).toFixed(3), planted: +(n / (2 * rec.L.length)).toFixed(2), lift: +maxLift.toFixed(3) };
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1), errs.join('\n') || 'no errors'); await b.close();
})();
