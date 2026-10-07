// the published page, three.js from the CDN as the artifact loads it: does it start, render and play without errors?
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--ignore-certificate-errors'], proxy: proxy ? { server: proxy } : undefined });
  for (const dpr of [1, 2]) {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 450 }, deviceScaleFactor: dpr, ignoreHTTPSErrors: true }); const page = await ctx.newPage();
    const errs = [], fails = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('requestfailed', r => fails.push(r.url() + ' ' + (r.failure() && r.failure().errorText)));
    await page.goto('file://' + path.join(__dirname, 'dist/yuye-yaolanqu.html'), { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(4000);
    const ok = await page.evaluate(() => typeof THREE !== 'undefined' && !!document.getElementById('startBtn'));
    if (ok) { await page.click('#startBtn'); await page.waitForTimeout(3000); await page.keyboard.press('Space'); await page.waitForTimeout(6000); await page.keyboard.press('Backquote'); await page.waitForTimeout(3000); }
    const info = await page.evaluate(() => ({ three: typeof THREE !== 'undefined' ? THREE.REVISION : null, perf: document.getElementById('perf') ? document.getElementById('perf').textContent : '', hud: document.getElementById('hud') && document.getElementById('hud').classList.contains('on'), obj: document.getElementById('obj') ? document.getElementById('obj').textContent : '' }));
    await page.screenshot({ path: `shots/cdn_dpr${dpr}.png` });
    console.log(`dpr ${dpr}: three r${info.three}, HUD on ${info.hud}, objective "${info.obj}"\n  overlay: ${info.perf}\n  errors: ${errs.length ? errs.slice(0, 4).join(' | ') : 'none'}${fails.length ? '\n  failed requests: ' + fails.slice(0, 4).join(' | ') : ''}`);
    await ctx.close();
  }
  await browser.close();
})();
