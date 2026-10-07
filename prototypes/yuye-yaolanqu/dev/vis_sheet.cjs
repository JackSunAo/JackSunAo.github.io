// Every realistic body on one sheet, standing in the game's idle pose: front and three-quarter, six to a row
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const ids = (process.argv[2] || '').split(',').filter(Boolean), cols = 6, tw = 260, th = 420, rows = Math.ceil(ids.length / cols);
  const p = await b.newPage({ viewport: { width: tw * cols, height: th * rows } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'dist/test.html')); await p.waitForTimeout(2000);
  const url = await p.evaluate(async ([ids, cols, tw, th, rows]) => {
    const D = __dbg, look = id => id === 'you' ? D.PLAYER_LOOK : id === 'mother' ? D.MOTHER_LOOK : D.DEF_T[id] ? Object.assign({ assetId: id }, D.DEF_T[id].look) : Object.assign({ infected: true, blood: true, assetId: id }, D.INF[id]);
    const hs = ids.map(id => { const h = D.makeHumanForTest(look(id)); D.initSprings(h); return h; });
    for (let i = 0; i < 300 && !hs.every(h => h.flesh); i++) await new Promise(r => setTimeout(r, 100));
    const S = new THREE.Scene(); S.add(new THREE.HemisphereLight(0xc8d4e0, 0x2a2420, 0.75));
    const key = new THREE.DirectionalLight(0xffe2c0, 2.0); key.position.set(-2, 3, 3); S.add(key); const rim = new THREE.DirectionalLight(0x8fb0dc, 1.2); rim.position.set(3, 2, -3); S.add(rim);
    const r = D.renderer; r.setRenderTarget(null); r.setPixelRatio(1); r.setSize(tw * cols, th * rows, false); r.setScissorTest(true); r.autoClear = false; r.setClearColor(0x2a2e34); r.clear();
    const cam = new THREE.PerspectiveCamera(22, tw / th, 0.05, 50);
    hs.forEach((h, i) => {
      S.add(h.root); const x = (i % cols) * tw, y = (rows - 1 - Math.floor(i / cols)) * th;
      [[0.15, 0], [0.9, 1]].forEach(([yaw, k]) => {
        h.root.position.set(k ? 0.42 : -0.42, 0, 0); h.root.rotation.y = yaw; h.root.updateMatrixWorld(true); h.skel.update();
        r.setViewport(x, y, tw, th); r.setScissor(x, y, tw, th); cam.position.set(0, 0.95, 5.4); cam.lookAt(0, 0.88, 0); r.render(S, cam);
      });
      S.remove(h.root);
    });
    r.setScissorTest(false); r.autoClear = true; return r.domElement.toDataURL('image/png');
  }, [ids, cols, tw, th, rows]);
  fs.writeFileSync(path.join(__dirname, 'shots', process.argv[3] || 'sheet.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log(errs.slice(0, 5).join('\n') || 'no errors'); await b.close();
})();
