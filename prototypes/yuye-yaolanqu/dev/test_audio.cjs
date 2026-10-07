const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(2000);
  const ms = await page.evaluate(async () => { const S = __dbg.SND, t0 = performance.now(); S.init(); const sync = performance.now() - t0; while (S.worker || S.queue.length) { if (!S.worker) S.bake(50); await new Promise(r => setTimeout(r, 20)); } return 'init ' + sync.toFixed(1) + 'ms, worker ' + (performance.now() - t0).toFixed(0) + 'ms'; });
  const r = await page.evaluate(() => {
    const S = __dbg.SND;
    const bad = [], stats = {};
    for (const [k, L] of Object.entries(S.bank)) for (const b of L) { const d = b.getChannelData(0); let pk = 0, nan = 0, rms = 0; for (const v of d) { if (!isFinite(v)) nan++; else { pk = Math.max(pk, Math.abs(v)); rms += v * v; } } rms = Math.sqrt(rms / d.length);
      if (nan || pk < 0.01 || pk > 1.01) bad.push(k + ' nan' + nan + ' pk' + pk.toFixed(3)); stats[k] = (b.duration).toFixed(2) + 's rms' + rms.toFixed(3); }
    const p = new THREE.Vector3(3, 0, 5);
    const calls = ['step', 'swing', 'hit', 'thud', 'growl', 'shriek', 'clicks', 'click', 'drip', 'grunt', 'babyCry', 'babyCoo', 'impact', 'crunch', 'kick', 'exhale', 'shout', 'bodyFall', 'spurt', 'whistle', 'chop', 'splinter', 'doorBang', 'glass', 'pry', 'barMove', 'woodDrop', 'hammer', 'creak', 'scrape'];
    const fail = [];
    for (const c of calls) try { S[c](p, 1, 1); S[c](new THREE.Vector3(0, 0, 0)); } catch (e) { fail.push(c + ': ' + e.message); }
    try { S.roar(p, 'spot', 1.4); S.roar(p, 'breach'); S.thunder(0.5, 1); S.heartbeat(); S.growl(p, 0.6, 1, 1.4); for (let i = 0; i < 60; i++) { S.exertion = 0.5; S.adr = 0.5; S.update(1 / 60); } } catch (e) { fail.push('misc ' + e.message); }
    return { n: Object.values(S.bank).reduce((a, L) => a + L.length, 0), bad, fail, voices: S.voices.length, stats };
  });
  console.log(ms); if (!process.argv[2]) delete r.stats; console.log(JSON.stringify(r, null, 1)); console.log('errors', errors);
  await browser.close();
})();
