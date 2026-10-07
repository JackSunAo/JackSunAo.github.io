const { openGame, measure, show, SCENES } = require('./bench_lib.cjs');
(async () => {
  const names = process.argv.slice(2);
  const { browser, page, errs } = await openGame({});
  for (const [name, code] of Object.entries(SCENES)) {
    await page.evaluate(code => { const D = __dbg; new Function('D', code)(D); }, code);
    if (names.length && !names.includes(name)) continue;
    console.log(show(await measure(page, name, 20)));
  }
  console.log('errors:', errs.length ? errs.slice(0, 6).join('\n---\n') : 'none'); await browser.close();
})();
