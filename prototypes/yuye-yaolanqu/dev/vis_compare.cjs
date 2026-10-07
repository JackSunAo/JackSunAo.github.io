// Two looks of one character side by side, under a neutral studio light and under the game's night (floodlight, rain haze)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const W = 1600, H = 1300, p = await b.newPage({ viewport: { width: W, height: H } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'dist/test.html')); await p.waitForTimeout(2000);
  const [lookId, ...assets] = (process.argv[2] || 'mei:mei_real,mei_paint').replace(':', ',').split(',');
  const url = await p.evaluate(async ([lookId, assets, W, H]) => {
    const D = __dbg, base = lookId === 'you' ? D.PLAYER_LOOK : lookId === 'mother' ? D.MOTHER_LOOK : D.DEF_T[lookId] ? D.DEF_T[lookId].look : Object.assign({ infected: true, blood: true }, D.INF[lookId]);
    const hs = assets.map(a => { const h = D.makeHumanForTest(Object.assign({}, base, { assetId: a })); D.initSprings(h); return h; });
    for (let i = 0; i < 300 && !hs.every(h => h.flesh); i++) await new Promise(r => setTimeout(r, 100));
    const r = D.renderer; r.setRenderTarget(null); r.setPixelRatio(1); r.setSize(W, H, false); r.setScissorTest(true); r.autoClear = false;
    const scenes = [];
    { const S = new THREE.Scene(); S.background = new THREE.Color(0x2a2e34); S.add(new THREE.HemisphereLight(0xc8d4e0, 0x2a2420, 0.8));
      const k = new THREE.DirectionalLight(0xffe8d0, 2.0); k.position.set(-2, 3, 3); S.add(k); const rm = new THREE.DirectionalLight(0x9fb8dc, 1.0); rm.position.set(3, 2, -3); S.add(rm); scenes.push(S); }
    { const S = new THREE.Scene(); S.background = new THREE.Color(0x0b0e14); S.fog = new THREE.FogExp2(0x10141c, 0.06); S.add(new THREE.HemisphereLight(0x3a4a66, 0x0a0a0c, 0.35));
      const f = new THREE.SpotLight(0xffd9a0, 3.2, 30, 0.6, 0.5, 1.2); f.position.set(-3, 5, 4); f.target.position.set(0, 1, 0); S.add(f); S.add(f.target);
      const rm = new THREE.DirectionalLight(0x6a86b8, 0.8); rm.position.set(2, 2, -4); S.add(rm); scenes.push(S); }
    const cam = new THREE.PerspectiveCamera(22, 1, 0.05, 60), n = hs.length, cw = W / 2 / n, rh = 500;
    scenes.forEach((S, si) => {
      const y0 = 300 + (1 - si) * rh;
      r.setViewport(0, y0, W, rh); r.setScissor(0, y0, W, rh); r.setClearColor(S.background); r.clear();
      hs.forEach((h, i) => {
        S.add(h.root); h.root.position.set(0, 0, 0);
        h.root.rotation.y = 0.45; h.root.updateMatrixWorld(true); h.skel.update();
        r.setViewport(i * cw, y0, cw, rh); r.setScissor(i * cw, y0, cw, rh); cam.aspect = cw / rh; cam.fov = 22; cam.updateProjectionMatrix(); cam.position.set(0, 0.95, 4.8); cam.lookAt(0, 0.86, 0); r.render(S, cam);
        const hp = new THREE.Vector3(); h.head.getWorldPosition(hp);
        r.setViewport(W / 2 + i * cw, y0, cw, rh); r.setScissor(W / 2 + i * cw, y0, cw, rh); cam.fov = 18; cam.updateProjectionMatrix(); cam.position.set(hp.x + 0.12, hp.y + 0.12, hp.z + 0.75); cam.lookAt(hp.x, hp.y + 0.1, hp.z); r.render(S, cam);
        S.remove(h.root);
      });
    });
    { // the game's view: a few metres up and back, in the night light
      const S = scenes[1]; r.setViewport(0, 0, W, 300); r.setScissor(0, 0, W, 300); r.setClearColor(S.background); r.clear();
      hs.forEach((h, i) => { S.add(h.root); h.root.position.set((i - (n - 1) / 2) * 1.2, 0, 0); h.root.rotation.y = 0.3; h.root.updateMatrixWorld(true); h.skel.update(); });
      cam.aspect = W / 300; cam.fov = 30; cam.updateProjectionMatrix(); cam.position.set(0, 4.5, 9); cam.lookAt(0, 0.8, 0);
      r.setViewport(0, 0, W, 300); r.render(S, cam); hs.forEach(h => S.remove(h.root));
    }
    r.setScissorTest(false); r.autoClear = true; return r.domElement.toDataURL('image/png');
  }, [lookId, assets, W, H]);
  fs.writeFileSync(path.join(__dirname, 'shots', process.argv[3] || 'compare.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log(errs.slice(0, 5).join('\n') || 'no errors'); await b.close();
})();
