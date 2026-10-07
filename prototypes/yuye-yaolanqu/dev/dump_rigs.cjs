// Every character's look and bind-pose joints, straight from the game: the one source the offline modeller builds from
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'dist/test.html')); await p.waitForTimeout(2500);
  const out = await p.evaluate(() => {
    const D = __dbg, list = { you: D.PLAYER_LOOK, mother: D.MOTHER_LOOK };
    for (const [k, d] of Object.entries(D.DEF_T)) list[k] = d.look;
    for (const [k, t] of Object.entries(D.INF)) list[k] = Object.assign({ infected: true, blood: true }, t);
    const res = {};
    for (const [id, look] of Object.entries(list)) { const h = D.makeHumanForTest(look); const r = D.rigDump(h); const L = {}; for (const [k, v] of Object.entries(look)) if (typeof v !== 'function') L[k] = v; res[id] = Object.assign({ look: L }, r); }
    return res;
  });
  fs.writeFileSync(path.join(__dirname, '../chars_src/rigs.json'), JSON.stringify(out, null, 1));
  console.log(Object.keys(out).length, 'characters', errs.join('\n') || 'no errors'); await b.close();
})();
