// The infected roster as the game builds it (INF looks, infected skin and blood), several to a row, for judging outfits
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 560 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'dist/test.html')); await p.waitForTimeout(2500); if (process.env.ZOOM) await p.evaluate(() => { window.ZOOM = 1; });
  const sel = (process.argv[2] || '').split(',').filter(Boolean), yaw = +(process.argv[3] || 0.5), infected = process.argv[4] !== 'clean';
  const img = await p.evaluate(([sel, yaw, infected]) => {
    const D = __dbg, S = new THREE.Scene(), keys = sel.length ? sel : Object.keys(D.INF).filter(k => D.INF[k].civ), n = keys.length, cam = new THREE.PerspectiveCamera(20, 1600 / 560, 0.1, 80);
    S.background = new THREE.Color(0x2b2f35); S.add(new THREE.HemisphereLight(0xdfe6ef, 0x3a3228, 0.95)); const dl = new THREE.DirectionalLight(0xffe6c8, 1.6); dl.position.set(-3, 5, 5); S.add(dl); const rl = new THREE.DirectionalLight(0x9fb8d8, 0.8); rl.position.set(4, 3, -4); S.add(rl);
    keys.forEach((k, i) => { const h = D.makeHumanForTest(Object.assign({ infected, blood: infected }, D.INF[k])); h.root.position.set((i - (n - 1) / 2) * 0.62, 0, 0); h.root.rotation.y = yaw; S.add(h.root); h.root.updateMatrixWorld(true); h.skel && h.skel.update(); });
    const zoom = +(window.ZOOM || 0); if (zoom) { cam.position.set(0, 1.5, 1.1); cam.lookAt(0, 1.45, 0); } else { cam.position.set(0, 1.0, n * 0.62 * 1.55 + 1.2); cam.lookAt(0, 0.88, 0); }
    const r = D.renderer; r.setRenderTarget(null); r.setPixelRatio(1); r.setSize(1600, 560, false); r.setViewport(0, 0, 1600, 560); r.setScissorTest(false); r.render(S, cam);
    return [r.domElement.toDataURL('image/png'), keys.map(k => D.INF[k].name).join(' | ')];
  }, [sel, yaw, infected]);
  fs.writeFileSync(path.join(__dirname, 'shots', process.argv[5] || 'roster.png'), Buffer.from(img[0].split(',')[1], 'base64'));
  console.log(img[1]); console.log(errs.join('\n') || 'no errors'); await b.close();
})();
