import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'fs';
const dir = new URL('.', import.meta.url).pathname;
const libs = ['build/three.min.js', 'examples/js/shaders/CopyShader.js', 'examples/js/shaders/LuminosityHighPassShader.js',
  'examples/js/postprocessing/EffectComposer.js', 'examples/js/postprocessing/RenderPass.js', 'examples/js/postprocessing/ShaderPass.js',
  'examples/js/postprocessing/UnrealBloomPass.js'];
const parts = ['p1_core.js', 'p2_world.js', 'p3_human.js', 'p4_audio.js', 'p5_state.js', 'p6_fx.js', 'p6b_camp.js', 'p7_ai.js', 'p7b_defenders.js', 'p8_player.js', 'p8c_perf.js', 'p9_ui.js'];
const code = parts.map(p => readFileSync(dir + 'src/' + p, 'utf8')).join('\n');
const shell = readFileSync(dir + 'src/shell.html', 'utf8');
const tags = base => libs.map(l => `<script src="${base}${l}"></script>`).join('\n');
const cdn = shell.replace('{{SCRIPTS}}', tags('https://cdn.jsdelivr.net/npm/three@0.146.0/')).replace('{{CODE}}', () => code);
const local = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'
  + shell.replace('{{SCRIPTS}}', tags('../node_modules/three/')).replace('{{CODE}}', () => code).replace(/<link[^>]+fonts[^>]+>/g, '') + '\n</body></html>';
const cut = cdn.indexOf('<canvas id="c">');
const site = '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + cdn.slice(0, cut) + '</head>\n<body>\n' + cdn.slice(cut) + '\n</body>\n</html>\n';
mkdirSync(dir + 'dist', { recursive: true });
writeFileSync(dir + 'dist/site.html', site);
writeFileSync(dir + 'dist/yuye-yaolanqu.html', cdn);
writeFileSync(dir + 'dist/test.html', local);
// the characters' baked meshes and textures sit next to the page
mkdirSync(dir + 'dist/chars', { recursive: true });
if (existsSync(dir + '../chars')) for (const f of readdirSync(dir + '../chars')) copyFileSync(dir + '../chars/' + f, dir + 'dist/chars/' + f);
console.log('built', (cdn.length / 1024).toFixed(1) + ' KB');
