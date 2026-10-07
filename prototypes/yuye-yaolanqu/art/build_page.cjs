const fs = require('fs'); let s = fs.readFileSync(__dirname + '/page_src.html', 'utf8');
s = s.replace('/*PAINTER*/', () => fs.readFileSync(__dirname + '/painter.js', 'utf8')).replace('/*CAST*/', () => fs.readFileSync(__dirname + '/chars.js', 'utf8'));
fs.writeFileSync(__dirname + '/index.html', s);
fs.writeFileSync(__dirname + '/preview.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + s + '<script>setTimeout(()=>window.done=true,1500)</script></body></html>');
console.log((s.length / 1024).toFixed(1) + ' KB');
