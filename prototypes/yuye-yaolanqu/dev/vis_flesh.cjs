// A realistic body in the engine itself: wait for its files, pose it, light it, render near and far
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 700 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, 'dist/test.html')); await p.waitForTimeout(2500);
  const ids = (process.argv[2] || 'you').split(',');
  await p.evaluate(ids => { window.__H = ids.map(id => { const D = __dbg; const look = id === 'you' ? D.PLAYER_LOOK : id === 'mother' ? D.MOTHER_LOOK : D.DEF_T[id] ? Object.assign({ assetId: id }, D.DEF_T[id].look) : Object.assign({ infected: true, blood: true, assetId: id }, D.INF[id]); const h = D.makeHumanForTest(look); D.initSprings(h); return h; }); }, ids);
  await p.waitForFunction(() => window.__H.every(h => h.flesh), null, { timeout: 30000 }).catch(() => errs.push('flesh never arrived'));
  const shots = await p.evaluate(([yaw, walk]) => {
    const D = __dbg, S = new THREE.Scene(), out = [];
    S.background = new THREE.Color(0x24282e); S.add(new THREE.HemisphereLight(0xc8d4e0, 0x2a2420, 0.7));
    const key = new THREE.DirectionalLight(0xffe2c0, 2.2); key.position.set(-2, 3, 3); S.add(key); const rim = new THREE.DirectionalLight(0x8fb0dc, 1.4); rim.position.set(3, 2, -3); S.add(rim);
    const n = __H.length; __H.forEach((h, i) => { S.add(h.root); h.root.position.set((i - (n - 1) / 2) * 0.9, 0, 0); h.root.rotation.y = yaw; if (walk) D.poseTo(h, D.walkPose(1.2 + i, 0.7, 0, 1.4, h.s), 99, 1); h.root.updateMatrixWorld(true); h.skel.update(); });
    const r = D.renderer; r.setRenderTarget(null); r.setPixelRatio(1); r.setScissorTest(false);
    const cam = new THREE.PerspectiveCamera(24, 1200 / 700, 0.05, 50);
    const shoot = (pos, at, w, hh) => { r.setSize(w, hh, false); r.setViewport(0, 0, w, hh); cam.aspect = w / hh; cam.updateProjectionMatrix(); cam.position.set(...pos); cam.lookAt(...at); r.render(S, cam); out.push(r.domElement.toDataURL('image/png')); };
    shoot([0, 1.05, 2.6 + n * 1.2], [0, 0.9, 0], 1200, 700);
    shoot([0.25, 1.62, 0.85], [0, 1.58, 0], 700, 700);
    return out;
  }, [+(process.argv[3] || 0.4), process.argv[4] === 'walk']);
  shots.forEach((s, i) => fs.writeFileSync(path.join(__dirname, 'shots', `flesh_${i}.png`), Buffer.from(s.split(',')[1], 'base64')));
  console.log(errs.slice(0, 8).join('\n') || 'no errors'); await b.close();
})();
