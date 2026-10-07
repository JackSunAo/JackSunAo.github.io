const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(1500);
  const ev = (f, a) => page.evaluate(f, a);
  const park = `D.infected.forEach((x, i) => { x.pos.set(12 + i, -0.25, 16); x.setState('lurk'); x.aware = 0; x.provoked = false; });`;
  await ev(new Function(`const D = __dbg; D.startGame(); D.skipOpening(); D.step(20); D.P.pos.set(1.6, 0, 0.9); ${park} D.step(10);`));
  // 1. N cycles: you → 小赵 → 老周
  await page.keyboard.press('KeyN'); await page.keyboard.press('KeyN');
  console.log(await ev(() => { const D = __dbg; D.step(20); return 'driving: ' + D.CTRL.who.name + ' ctrl=' + D.CTRL.who.ctrl + ' P.ai=' + D.P.ai + ' cam→' + D.cam.tgt.x.toFixed(1) + ',' + D.cam.tgt.z.toFixed(1); }));
  // 2. walk 老周 with the keyboard
  console.log(await ev(() => { const D = __dbg; const z = D.CTRL.who; z.p0 = z.pos.clone(); return '老周 at ' + z.pos.x.toFixed(2) + ',' + z.pos.z.toFixed(2); }));
  await page.keyboard.down('KeyD'); await ev(() => __dbg.step(45)); await page.keyboard.up('KeyD');
  console.log(await ev(() => { const D = __dbg, z = D.CTRL.who; return 'after holding D 1.5s: moved ' + z.pos.distanceTo(z.p0).toFixed(2) + 'm, state ' + z.state; }));
  // 3. a thrust from 老周's hands at an infected in front of him
  console.log(await ev(new Function(`const D = __dbg, z = D.CTRL.who, e = D.infected[1]; ${park}
    const f = new THREE.Vector3(Math.sin(z.yaw), 0, Math.cos(z.yaw)); e.pos.set(z.pos.x + f.x * 1.9, 0, z.pos.z + f.z * 1.9); e.aware = 0; e.setState('search'); e.searchYaw = z.yaw;
    const b0 = e.body.blood, bal0 = e.bal; D.ctrlKey('KeyJ'); D.step(25);
    return 'thrust: state after ' + z.state + ' | infected blood ' + b0.toFixed(0) + '→' + e.body.blood.toFixed(0) + ' bleed ' + (e.body.bleed + e.body.art).toFixed(2) + ' bal ' + bal0.toFixed(2) + '→' + e.bal.toFixed(2) + ' state ' + e.state;`)));
  // 4. pinned in 老周's body: mash Space
  console.log(await ev(new Function(`const D = __dbg, z = D.CTRL.who, e = D.infected[0]; ${park}
    e.pos.set(z.pos.x + 0.5, 0, z.pos.z + 0.3); e.aware = 1.2; z.pinnedByE(e); let n = 0;
    for (let i = 0; i < 90 && z.state === 'pinned'; i++) { if (i % 2 === 0) { D.ctrlKey('Space'); n++; } D.step(1); }
    return 'pinned: after ' + n + ' presses → 老周 ' + z.state + (z.bitten ? '(咬)' : '') + ', it: ' + e.state;`)));
  // 5. your own body fights on its own
  console.log(await ev(new Function(`const D = __dbg, e = D.infected[2]; ${park}
    D.P.state = 'move'; D.P.invuln = 0; e.pos.set(D.P.pos.x + 1.6, 0, D.P.pos.z); e.aware = 0; e.setState('search'); const b0 = e.bal, s0 = e.body.skull; let atk = 0;
    for (let i = 0; i < 90; i++) { D.step(1); if (D.P.atk) atk++; }
    return 'your body (AI): attacking frames ' + atk + ' | it skull ' + s0 + '→' + e.body.skull.toFixed(0) + ' state ' + e.state + (e.dead ? 'X' : '');`)));
  // 6. 老周 dies in your hands: back to yourself
  console.log(await ev(() => { const D = __dbg, z = D.CTRL.who; z.die('斧头'); D.step(5); return 'after 老周 died: driving ' + D.CTRL.who.name + ' P.ai=' + D.P.ai; }));
  // 7. command view: pick 阿梅, N
  console.log(await ev(() => { const D = __dbg; D.setCommand(true); D.cmdSelect(D.defenders[2], false); D.step(5); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' })); D.step(5); return 'cmd + N: driving ' + D.CTRL.who.name + ' cmd ' + D.CMD.on; }));
  // 8. 阿梅 patches up 小赵 with E
  console.log(await ev(() => { const D = __dbg, m = D.CTRL.who, zh = D.defenders[0]; zh.bleed = 1.2; zh.art = 0.6; zh.pos.set(m.pos.x + 0.8, 0, m.pos.z); zh.setOrder('hold', true); zh.post = 'custom'; zh.customP.copy(zh.pos);
    const pr = m.ctrlPrompt(); D.ctrlKey('KeyE'); const st = m.state; D.step(90); return 'prompt "' + pr + '" → ' + st + ' → 小赵 bleed ' + (zh.bleed + zh.art).toFixed(2); }));
  // 9. a mouse charge in 阿梅's hands: hold the button, release → heavy
  await ev(new Function(`const D = __dbg, m = D.CTRL.who, e = D.infected[3]; ${park} const f = new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw)); e.pos.set(m.pos.x + f.x * 1.4, 0, m.pos.z + f.z * 1.4); e.setState('search');`));
  await page.mouse.move(480, 270); await page.mouse.down(); await ev(() => __dbg.step(18)); await page.mouse.up();
  console.log(await ev(() => { const D = __dbg, m = D.CTRL.who; const k = m.atk && m.atk.kind; D.step(30); return 'mouse charge → attack ' + k + ' | it: ' + D.infected[3].state + ' bleed ' + (D.infected[3].body.bleed + D.infected[3].body.art).toFixed(2); }));
  // 10. back to you with N cycling
  console.log(await ev(() => { const D = __dbg; const seq = []; for (let i = 0; i < 4; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' })); D.step(2); seq.push(D.CTRL.who.name); } return 'N x4: ' + seq.join(' → '); }));
  console.log('errors:', errs.length ? errs.slice(0, 8).join('\n---\n') : 'none');
  await browser.close();
})();
