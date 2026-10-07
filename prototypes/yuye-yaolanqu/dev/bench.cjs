const { openGame, measure, show, SCENES } = require('./bench_lib.cjs');
(async () => {
  const file = process.argv[2] || 'dist/test.html';
  const { browser, page, errs } = await openGame({ file });
  const out = [];
  for (const [name, code] of Object.entries(SCENES)) {
    await page.evaluate(code => { const D = __dbg; new Function('D', code)(D); }, code);
    const r = await measure(page, name, 30); out.push(show(r));
    console.log(show(r));
  }
  console.log('errors:', errs.length ? errs.slice(0, 6).join('\n---\n') : 'none');
  await browser.close();
})();
