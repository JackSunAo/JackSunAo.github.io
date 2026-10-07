// One realistic body in the engine, turned round: front, three-quarter, side, back, and the face close
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 640 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'dist/test.html')); await p.waitForTimeout(2000);
  const ids = (process.argv[2] || 'you').split(','), bind = process.argv[3] === 'bind';
  for (const spec of ids) {
    const [id, asset] = spec.split(':');
    await p.evaluate(([id, asset]) => { const D = __dbg; let look = id === 'you' ? D.PLAYER_LOOK : id === 'mother' ? D.MOTHER_LOOK : D.DEF_T[id] ? Object.assign({ assetId: id }, D.DEF_T[id].look) : Object.assign({ infected: true, blood: true, assetId: id }, D.INF[id]); if (asset) look = Object.assign({}, look, { assetId: asset }); const h = D.makeHumanForTest(look); D.initSprings(h); window.__h = h; }, [id, asset]);
    await p.waitForFunction(() => window.__h.flesh, null, { timeout: 30000 }).catch(() => errs.push(id + ': flesh never arrived'));
    const url = await p.evaluate(bind => {
      const D = __dbg, h = __h, S = new THREE.Scene();
      S.background = new THREE.Color(0x2a2e34); S.add(new THREE.HemisphereLight(0xc8d4e0, 0x2a2420, 0.75));
      const key = new THREE.DirectionalLight(0xffe2c0, 2.0); key.position.set(-2, 3, 3); S.add(key); const rim = new THREE.DirectionalLight(0x8fb0dc, 1.2); rim.position.set(3, 2, -3); S.add(rim);
      S.add(h.root); if (bind) D.poseTo(h, D.BIND, 99, 1); h.root.updateMatrixWorld(true); h.skel && h.skel.update();
      const r = D.renderer; r.setRenderTarget(null); r.setPixelRatio(1); r.setScissorTest(false);
      const W = 1600, Hh = 640, cam = new THREE.PerspectiveCamera(22, 1, 0.05, 50);
      r.setSize(W, Hh, false); r.setScissorTest(true); r.autoClear = false; r.setClearColor(0x2a2e34); r.clear();
      const views = [0, 0.75, 1.57, 3.14];
      views.forEach((yaw, i) => { h.root.rotation.y = yaw; h.root.updateMatrixWorld(true); h.skel.update(); const x = i * 320; r.setViewport(x, 0, 320, Hh); r.setScissor(x, 0, 320, Hh); cam.aspect = 320 / Hh; cam.fov = 22; cam.updateProjectionMatrix(); cam.position.set(0, 0.95, 4.6); cam.lookAt(0, 0.88, 0); r.render(S, cam); });
      h.root.rotation.y = 0.35; h.root.updateMatrixWorld(true); h.skel.update(); const hy = h.root.getObjectByName ? 0 : 0;
      const hp = new THREE.Vector3(); (h.head || h.root).getWorldPosition(hp);
      r.setViewport(1280, 320, 320, 320); r.setScissor(1280, 320, 320, 320); cam.aspect = 1; cam.fov = 20; cam.updateProjectionMatrix(); cam.position.set(hp.x, hp.y + 0.12, hp.z + 0.75); cam.lookAt(hp.x, hp.y + 0.1, hp.z); r.render(S, cam);
      h.root.rotation.y = 2.6; h.root.updateMatrixWorld(true); h.skel.update();
      r.setViewport(1280, 0, 320, 320); r.setScissor(1280, 0, 320, 320); cam.position.set(hp.x, hp.y + 0.1, hp.z + 0.9); cam.lookAt(hp.x, hp.y + 0.05, hp.z); r.render(S, cam);
      r.setScissorTest(false); r.autoClear = true; const u = r.domElement.toDataURL('image/png'); S.remove(h.root); return u;
    }, bind);
    fs.writeFileSync(path.join(__dirname, 'shots', `one_${asset || id}${bind ? '_bind' : ''}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(errs.slice(0, 8).join('\n') || 'no errors'); await b.close();
})();
