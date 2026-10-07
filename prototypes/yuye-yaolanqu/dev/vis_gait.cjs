// Filmstrip of the walk: bodies stepping past a side-on camera, frames tiled, with a ground grid to judge foot planting
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'dist/test.html')); await p.waitForTimeout(2500);
  const frames = await p.evaluate((cfg) => {
    const D = __dbg, S = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 900 / 600, 0.1, 50);
    S.background = new THREE.Color(0x30343a); S.add(new THREE.HemisphereLight(0xdfe6ef, 0x3a3228, 1.1)); const dl = new THREE.DirectionalLight(0xffe2c0, 1.4); dl.position.set(3, 5, 4); S.add(dl);
    const grid = new THREE.GridHelper(40, 80, 0x8a8f96, 0x5a5f66); S.add(grid);
    const out = [];
    for (const c of cfg) {
      const h = D.makeHumanForTest(c.look); D.initSprings(h); S.add(h.root); h.root.rotation.y = Math.PI / 2; // walking toward +x
      let ph = 0, x = -1.5; const dt = 1 / 60;
      for (let i = 0; i < 150; i++) {
        x += c.sp * dt; ph += dt * c.sp * D.gaitK(c.sp, h.s); h.root.position.set(x, 0, 0);
        D.poseTo(h, D.walkPose(ph, Math.min(1, c.sp / 2.25), Math.max(0, Math.min(1, (c.sp - 2.6) / 1.4)), c.sp, h.s, c.style), 13, dt);
        if (i >= 90 && i % 6 === 0) { h.root.updateMatrixWorld(true); h.skel && h.skel.update(); cam.position.set(x, 0.9, 3.6); cam.lookAt(x, 0.8, 0); D.renderer.setRenderTarget(null); D.renderer.setPixelRatio(1); D.renderer.setSize(900, 600, false); D.renderer.setViewport(0, 0, 900, 600); D.renderer.setScissorTest(false); D.renderer.render(S, cam); out.push(D.renderer.domElement.toDataURL('image/jpeg', 0.85)); }
      }
      S.remove(h.root);
    }
    return out;
  }, [
    { sp: 1.4, look: { height: 1.76, girth: 1.06, skin: '#c38f6e', top: '#59503f', coat: '#4a4434', bottom: '#2b3035', hair: '#1d140e', cap: '#6a3b2c', scarf: '#8a6638', backpack: '#3b382e', seed: 3 } },
    { sp: 1.6, look: { infected: true, height: 1.8, girth: 1.5, skin: '#b9937c', top: '#6d6658', bottom: '#2b2825', hairStyle: 'sparse', apron: true, seed: 31 }, style: { sway: 1.9, lift: 0.55, arm: 0.3, wide: 0.8 } },
    { sp: 3.6, look: { infected: true, height: 1.6, girth: 0.82, skin: '#c7a48c', top: '#273250', coat: '#273250', bottom: '#273250', hairStyle: 'messy', backpack: '#7a3b2e', seed: 41 }, style: { lift: 1.3, arm: 0.6, lean: 0.1 } }
  ]);
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  const html = '<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(5,300px)">' + frames.map(f => `<img src="${f}" style="width:300px">`).join('') + '</body>';
  const q = await b.newPage({ viewport: { width: 1500, height: 600 } }); await q.setContent(html); await q.waitForTimeout(300); await q.screenshot({ path: path.join(__dirname, 'shots/gait_strip.png'), fullPage: true });
  console.log(frames.length, errs.join('\n') || 'no errors'); await b.close();
})();
