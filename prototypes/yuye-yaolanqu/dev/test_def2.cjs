const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(1500);
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { const D = __dbg; D.startGame(); D.skipOpening(); D.step(30); });
  // A. one of them gets jumped: an infected right on 阿梅, everyone else should come to help
  console.log(await ev(() => {
    const D = __dbg, log = [], mei = D.defenders[2], e = D.infected[1]; // the feral student
    D.G.playT = 999; D.infected.forEach((x, i) => { if (i !== 1) { x.pos.set(12 + i, -0.25, 14); x.setState('lurk'); } });
    e.pos.set(mei.pos.x + 0.7, 0, mei.pos.z + 0.3); e.aware = 1.2; e.provoked = true; e.tgt = mei; e.setState('stalk');
    mei.pinnedByE(e); log.push('pinned: ' + mei.state + ' by ' + e.state);
    for (let i = 0; i < 240; i++) { D.step(1); if (i % 20 === 0) log.push('t' + (i / 30).toFixed(1) + ' mei:' + mei.state + (mei.bitten ? '(咬)' : '') + ' st' + mei.struggle.toFixed(2) + ' e:' + e.state + (e.dead ? 'X' : '') + ' | ' + D.defenders.map(d => d.name + ':' + d.state + (d.foe === e ? '*' : '')).join(' ')); }
    return log.join('\n');
  }));
  // B. orders: fall back, then sally, then plug the side window
  console.log(await ev(() => {
    const D = __dbg, log = []; D.resetGame(); D.step(5); D.G.playT = 0;
    D.infected.forEach((x, i) => { x.pos.set(10 + i, -0.25, 15); x.setState('lurk'); x.aware = 0; });
    D.orderDefenders('fallback'); D.step(150);
    log.push('fallback: ' + D.defenders.map(d => d.name + '@' + d.pos.x.toFixed(1) + ',' + d.pos.z.toFixed(1) + ' ' + d.orderText()).join(' | '));
    D.orderDefenders('sally', [D.defenders[0]]); D.step(150);
    log.push('sally 小赵: door ' + D.door.ang.toFixed(2) + (D.door.barred ? 'B' : '') + ' 小赵@' + D.defenders[0].pos.x.toFixed(1) + ',' + D.defenders[0].pos.z.toFixed(1) + ' indoor:' + D.defenders[0].indoor + ' state ' + D.defenders[0].state);
    D.orderDefenders('hold'); D.step(200);
    log.push('hold again: 小赵@' + D.defenders[0].pos.x.toFixed(1) + ',' + D.defenders[0].pos.z.toFixed(1) + ' door ' + D.door.ang.toFixed(2) + (D.door.barred ? 'B' : '') + ' ' + D.defenders[0].state);
    // plug: put the fireman to work on the side window
    const f = D.infected[3]; f.pos.set(-4.4, -0.25, 1.6); f.entry = D.ENTRIES[2]; f.setState('work'); f.workKind = 'pry'; D.SIEGE.on = true; D.SIEGE.scoutDone = true; D.SIEGE.lock = true;
    D.orderDefenders('plug'); D.step(120);
    log.push('plug: pressure left=' + D.entryPressure(D.ENTRIES[2]).toFixed(1) + ' | ' + D.defenders.map(d => d.name + '@' + d.pos.x.toFixed(1) + ',' + d.pos.z.toFixed(1) + ' ' + d.orderText()).join(' | '));
    D.SIEGE.lock = false;
    return log.join('\n');
  }));
  // C. command view: select 老周, send him to the side window by clicking its ring
  console.log(await ev(() => {
    const D = __dbg, log = []; D.resetGame(); D.step(5);
    D.setCommand(true); const t0 = D.G.t; D.step(30); log.push('cmd on: ' + D.CMD.on + ' sel ' + D.CMD.sel.size);
    D.cmdSelect(D.defenders[1], false); D.assignPost([D.defenders[1]], 'left'); D.setCommand(false); D.step(240);
    const z = D.defenders[1]; log.push('老周 → ' + z.orderText() + ' @' + z.pos.x.toFixed(2) + ',' + z.pos.z.toFixed(2));
    return log.join('\n');
  }));
  // D. a long siege with you inside, bigger waves
  console.log(await ev(() => {
    const D = __dbg, log = []; D.resetGame(); D.P.pos.set(1.6, 0, 0.9); D.G.playT = 999; D.P.invuln = 0; D.infected.forEach(e => { e.provoked = true; e.aware = 1.2; });
    const seen = {};
    for (let i = 0; i < 5400; i++) {
      D.step(1);
      for (const d of D.defenders) { const k = d.name + d.state + (d.bitten ? 'b' : '') + (d.dead ? 'X' : '') + (d.panic ? 'P' : ''); if (['pinned', 'clinch', 'down', 'ko', 'panic', 'dead'].includes(d.state) || d.bitten) { const kk = d.name + ':' + d.state + (d.bitten ? '(咬)' : ''); if (!seen[kk]) { seen[kk] = 1; log.push('t' + (i / 30).toFixed(1) + ' ' + kk); } } }
      if (i % 600 === 0) log.push('t' + (i / 30).toFixed(0) + ' wave ' + D.G.wave + ' alive inf ' + D.infected.filter(e => !e.dead).length + ' | ' + D.defenders.map(d => d.name + ' b' + d.blood.toFixed(0) + ' m' + d.morale.toFixed(2)).join(' ') + ' | planks ' + D.G.planks + ' door ' + (D.door.fallen ? 'fallen' : D.door.ang.toFixed(1)));
      if (D.P.dead) { log.push('player died @' + (i / 30).toFixed(1)); break; }
    }
    return log.join('\n');
  }));
  console.log('errors:', errs.length ? errs.slice(0, 8).join('\n---\n') : 'none');
  await browser.close();
})();
