const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader'] });
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'dist/test.html')); await p.waitForTimeout(2500);
  console.log(await p.evaluate(() => { const D = __dbg, sp = 1.4, h = D.makeHumanForTest({ height: 1.76 }); D.initSprings(h); let ph = 0, x = 0; const dt = 1 / 60, V = new THREE.Vector3(), A = new THREE.Vector3(), rows = [];
    for (let i = 0; i < 160; i++) { x += sp * dt; ph += dt * sp * D.gaitK(sp, h.s); h.root.position.set(0, 0, x); const w = D.walkPose(ph, 0.62, 0, sp, h.s); D.poseTo(h, w, 13, dt); h.root.updateMatrixWorld(true);
      h.L.foot.getWorldPosition(V); h.L.ankle.getWorldPosition(A); if (i > 100 && i % 2 == 0) rows.push([(ph % 6.283).toFixed(2), V.z.toFixed(3), V.y.toFixed(3), A.y.toFixed(3), w.pelY.toFixed(3), h.cur.knL.toFixed(2), w.knL.toFixed(2)].join(' ')); }
    return rows.join('\n'); }));
  await b.close(); })();
