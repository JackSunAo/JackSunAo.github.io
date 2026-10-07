// The whole cast standing in three-quarter view, lit simply, at one scale: for judging the models' shapes
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const src = process.argv[2] || path.join(__dirname, 'dist/test.html'), outName = process.argv[3] || 'models.png', yaw = +(process.argv[4] || 0.6);
const castSrc = fs.readFileSync(path.join(__dirname, '../art/chars.js'), 'utf8');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 520 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + src); await p.waitForTimeout(2500);
  const img = await p.evaluate(([castSrc, yaw, SEL]) => {
    eval(castSrc); const D = __dbg, S = new THREE.Scene(), cam = new THREE.PerspectiveCamera(22, 1400 / 520, 0.1, 80);
    S.background = new THREE.Color(0x2b2f35); S.add(new THREE.HemisphereLight(0xdfe6ef, 0x3a3228, 0.9)); const dl = new THREE.DirectionalLight(0xffe6c8, 1.6); dl.position.set(-3, 5, 5); S.add(dl); const rl = new THREE.DirectionalLight(0x9fb8d8, 0.8); rl.position.set(4, 3, -4); S.add(rl);
    const ids = SEL ? SEL.split(',') : null, list = window.CAST.filter(C => !ids || ids.includes(C.id)), n = list.length; list.forEach((C, i) => { const o = Object.assign({}, C, { skirt: C.skirt ? C.bottom : null, blood: !!C.infected }); delete o.pose; const h = D.makeHumanForTest(o); h.root.position.set((i - (n - 1) / 2) * 0.78, 0, 0); h.root.rotation.y = yaw; S.add(h.root); h.root.updateMatrixWorld(true); h.skel && h.skel.update(); });
    cam.position.set(0, 1.05, n * 1.25 + 0.6); cam.lookAt(0, 0.9, 0);
    const r = D.renderer; r.setRenderTarget(null); r.setPixelRatio(1); r.setSize(1400, 520, false); r.setViewport(0, 0, 1400, 520); r.setScissorTest(false); r.render(S, cam);
    return r.domElement.toDataURL('image/png');
  }, [castSrc, yaw, process.argv[5] || '']);
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'shots', outName), Buffer.from(img.split(',')[1], 'base64'));
  console.log(outName, errs.join('\n') || 'no errors'); await b.close();
})();
