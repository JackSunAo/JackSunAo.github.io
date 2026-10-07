const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(1500);
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { const D = __dbg; D.startGame(); D.skipOpening(); D.step(20); });
  const park = `D.infected.forEach((x, i) => { x.pos.set(12 + i, -0.25, 16); x.setState('lurk'); x.aware = 0; x.provoked = false; });`;
  // 1. you, pinned inside next to 老周: does he get it off you?
  console.log(await ev(new Function(`const D = __dbg; D.resetGame(); D.step(5); ${park}
    const z = D.defenders[1], e = D.infected[3]; D.G.playT = 999;
    D.P.pos.set(z.pos.x + 1.2, 0, z.pos.z + 0.9); e.pos.set(D.P.pos.x + 0.6, 0, D.P.pos.z); e.aware = 1.2; e.provoked = true; D.startPin(e);
    const log = ['pinned: ' + D.P.state];
    for (let i = 0; i < 120; i++) { D.step(1); if (D.P.state !== 'pinned') { log.push('freed after ' + (i / 30).toFixed(1) + 's, P=' + D.P.state + ', e=' + e.state + (e.dead ? 'X' : '')); break; } }
    if (D.P.state === 'pinned' || D.P.dead) log.push('still ' + D.P.state + ' dead=' + D.P.dead + ' | ' + D.defenders.map(d => d.name + ':' + d.state + (d.foe === e ? '*' : '')).join(' '));
    return log.join(' | ');`)));
  // 2. a stealth kill on the one pinning 阿梅
  console.log(await ev(new Function(`const D = __dbg; D.resetGame(); D.step(5); ${park}
    const m = D.defenders[2], e = D.infected[2]; D.G.playT = 999; D.defenders[0].pos.set(-2.5, 0, 1.6); D.defenders[1].pos.set(-1.0, 0, -2.4);
    D.defenders.forEach(d => { if (d !== m) d.react = 9; });
    e.pos.set(m.pos.x, 0, m.pos.z + 0.6); e.aware = 1.2; m.pinnedByE(e);
    const f = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)); D.P.pos.set(e.pos.x - f.x * 0.8, 0, e.pos.z - f.z * 0.8); D.P.state = 'move'; D.P.atk = null;
    const t = D.takedownTarget(); const log = ['target: ' + (t ? t.kind + ' on ' + t.e.type + ' (holding ' + (t.e.holding && t.e.holding.name) + ')' : 'none')];
    if (t) { D.interact(); D.step(60); log.push('after: e=' + e.state + (e.dead ? 'X' : '') + ' 阿梅=' + m.state + (m.bitten ? '(咬)' : '')); }
    return log.join(' | ');`)));
  // 3. the medic: 老周 bleeding, you wounded — she patches both up
  console.log(await ev(new Function(`const D = __dbg; D.resetGame(); D.step(5); ${park}
    const z = D.defenders[1], m = D.defenders[2]; z.bleed = 1.5; z.art = 0.8; D.P.wounds = 1; D.P.pos.set(0.9, 0, 0.6);
    const log = [];
    for (let i = 0; i < 600; i++) { D.step(1); if (i % 60 === 0) log.push('t' + (i / 30).toFixed(0) + ' mei:' + m.state + (m.patient ? '→' + m.patient.name : '') + ' 老周 bleed ' + (z.bleed + z.art).toFixed(2) + ' P.bandaged ' + !!D.P.bandaged); }
    return log.join('\\n');`)));
  // 4. the door guard: you come in, he shuts and bars the door
  console.log(await ev(new Function(`const D = __dbg; D.resetGame(); D.step(5); ${park}
    D.door.target = 1.35; D.door.angV = 3; D.door.latch = 0; D.P.pos.set(0, 0, 5); D.step(30);
    const log = ['you outside: door ' + D.door.ang.toFixed(2)]; D.step(60); log.push('still outside after 2s: door ' + D.door.ang.toFixed(2));
    D.P.pos.set(1.5, 0, 1.0); D.step(150); log.push('you inside, 5s later: door ' + D.door.ang.toFixed(2) + (D.door.barred ? ' barred' : ' not barred') + ' 小赵:' + D.defenders[0].state);
    return log.join(' | ');`)));
  // 5. outnumbered: 小赵 alone at the open door against three
  console.log(await ev(new Function(`const D = __dbg; D.resetGame(); D.step(5); ${park}
    const zh = D.defenders[0]; D.defenders[1].setPost('back'); D.defenders[2].pos.set(-2.5, 0, -2.4); D.defenders[2].setOrder('hold'); D.defenders[2].post = 'back';
    D.door.target = 1.35; D.door.angV = 3; D.door.latch = 0; D.G.playT = 999; D.P.pos.set(2.8, 0, -2.0);
    [0, 1, 2].forEach(i => { const e = D.infected[i]; e.pos.set(-0.6 + i * 0.6, -0.25, 4.6); e.aware = 1.2; e.provoked = true; e.tgt = zh; e.setState('stalk'); });
    const log = [], seen = {};
    for (let i = 0; i < 900; i++) { D.step(1); const k = zh.state + (zh.panic ? 'P' : ''); if (!seen[k]) { seen[k] = 1; log.push('t' + (i / 30).toFixed(1) + ' 小赵 ' + k + ' m' + zh.morale.toFixed(2) + ' b' + zh.blood.toFixed(0)); } if (zh.dead) break; }
    log.push('end: 小赵 ' + zh.state + ' dead=' + zh.dead + ' | inf ' + D.infected.slice(0, 3).map(e => e.state + (e.dead ? 'X' : '')).join(','));
    return log.join('\\n');`)));
  // 6. a real click in command view: select 阿梅 by clicking her, send her to the porch ring
  console.log(await ev(new Function(`const D = __dbg; D.resetGame(); D.step(5); ${park}
    D.setCommand(true); D.step(40); D.CMD.sel.clear();
    const m = D.defenders[2], pr = p => { const v = p.clone().project(D.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; };
    const s1 = pr(m.chestPos()); D.cmdClick(s1.x, s1.y, false); const log = ['selected: ' + [...D.CMD.sel].map(d => d.name).join(',')];
    const pp = D.POSTS.porch.p.clone(); pp.y = 0; const s2 = pr(pp); D.cmdClick(s2.x, s2.y, false); log.push('order: ' + m.orderText());
    D.setCommand(false); D.step(300); log.push('阿梅 @' + m.pos.x.toFixed(1) + ',' + m.pos.z.toFixed(1) + ' indoor ' + m.indoor + ' door ' + D.door.ang.toFixed(2));
    return log.join(' | ');`)));
  console.log('errors:', errs.length ? errs.slice(0, 8).join('\n---\n') : 'none');
  await browser.close();
})();
