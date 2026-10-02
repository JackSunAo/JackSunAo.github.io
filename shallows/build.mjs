// Bundles src/ (+ three.js) into one self-contained index.html that runs from file:// with no network access.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true, minify: !process.argv.includes('--dev'), format: 'iife', target: 'es2020', write: false, legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync(join(here, 'src/template.html'), 'utf8');
const html = tpl.replace('/*__BUNDLE__*/', () => js);
writeFileSync(join(here, 'index.html'), html);
const sha = createHash('sha256').update(html).digest('hex');
console.log(`index.html  ${(html.length / 1024).toFixed(0)} KiB  sha256 ${sha}`);
