// on a Retina-like screen (device scale 2): FSR on at 中, compare with native 极高 and plain browser upscale
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, 'dist/test.html')); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const D = __dbg; D.startGame(); D.skipOpening(); D.step(200); D.P.pos.set(0.4, -0.25, 7.6);
    D.G.camOv = { pos: new THREE.Vector3(1.6, 1.7, 9.6), tgt: new THREE.Vector3(0.4, 1.0, 7.6), fov: 34 }; D.step(80);
    const out = {}, shot = (k, lv) => { D.PERF.auto = false; D.setQuality(lv, true); D.composerRender(); D.composerRender(); out[k] = { img: D.renderer.domElement.toDataURL(), fsr: D.FSR.on, size: D.renderer.domElement.width + 'x' + D.renderer.domElement.height, inPR: D.FSR.inPR }; };
    shot('mid_fsr', 2); shot('ultra_native', 4);
    D.QUALITY[2].fsr = false; shot('mid_stretch', 2); D.QUALITY[2].fsr = true;
    return out;
  });
  for (const [k, v] of Object.entries(r)) { fs.writeFileSync(`shots/fsr_${k}.png`, Buffer.from(v.img.split(',')[1], 'base64')); console.log(k, 'fsr', v.fsr, 'canvas', v.size, 'render pr', v.inPR); }
  console.log('errors:', errs.length ? errs.join('\n') : 'none'); await browser.close();
})();
