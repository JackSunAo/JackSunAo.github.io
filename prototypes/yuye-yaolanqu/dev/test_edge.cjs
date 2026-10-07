// someone walking out of the moon's shadow: does their shadow fade or snap off?
const { openGame } = require('./bench_lib.cjs'); const fs = require('fs');
(async () => {
  const { browser, page, errs } = await openGame({ w: 960, h: 540 });
  const r = await page.evaluate(() => {
    const D = __dbg; D.startGame(); D.skipOpening(); D.step(30); D.G.flood.state = 'off'; D.G.flood.t = -999;
    const ok = D.renderer.getContext().getShaderSource ? 1 : 0;
    const shots = [];
    D.G.camOv = { pos: new THREE.Vector3(9, 9, 22), tgt: new THREE.Vector3(2, 0, 11), fov: 40 }; D.step(60);
    for (const z of [7, 9, 10, 11, 12]) { D.P.pos.set(2.5, -0.25, z); D.step(2); D.composerRender(); shots.push(D.renderer.domElement.toDataURL()); }
    return shots;
  });
  r.forEach((s, i) => fs.writeFileSync(`shots/edge_${i}.png`, Buffer.from(s.split(',')[1], 'base64')));
  console.log('errors:', errs.length ? errs.join('\n') : 'none'); await browser.close();
})();
