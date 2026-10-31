'use strict';
/* Builds public/index.html from client/. Run: node tools/build.js
   Also writes an offline edition (no server features) when given --offline <file>. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const C = path.join(ROOT, 'client');
const read = f => fs.readFileSync(path.join(C, f), 'utf8');

const order = ['base.js', 'data.js', 'engine.js', 'board.js', 'app1.js', 'app2.js', 'app3.js', 'app4.js', 'app5.js'];
let app = order.filter(f => fs.existsSync(path.join(C, f))).map(f => '/* ' + f + ' */\n' + read(f)).join('\n');
app = app.replace('/*PIECES*/', () => read('pieces.json')).replace('/*PUZZLES*/', () => read('puzzles-builtin.json').trim());
let tpl = read('index.html');
const core = fs.readFileSync(path.join(ROOT, 'core.js'), 'utf8');
tpl = tpl.replace('/*CSS*/', () => read('style.css')).replace('/*CORE*/', () => core).replace('/*APP*/', () => app);

const offIdx = process.argv.indexOf('--offline');
if (offIdx > 0) {
  const art = tpl.replace(/<link rel="manifest"[^>]*>\n/, '').replace(/<link rel="icon"[^>]*>\n/, '').replace(/<link rel="apple-touch-icon"[^>]*>\n/, '')
    .replace(/<meta name="apple-[^>]*>\n/g, '').replace(/<meta name="mobile-web-app-capable"[^>]*>\n/, '');
  fs.writeFileSync(process.argv[offIdx + 1], art);
}

const FACES = '<style>@font-face{font-family:"Bodoni Moda";src:url(fonts/bodoni-moda.woff2) format("woff2");font-weight:400 900;font-style:normal;font-display:swap}' +
  [400, 500, 600, 700].map(w => '@font-face{font-family:"Onest";src:url(fonts/onest-' + w + '.woff2) format("woff2");font-weight:' + w + ';font-style:normal;font-display:swap}').join('') + '</style>';
tpl = tpl.replace(/<link rel="preconnect"[^>]*>\n/g, '').replace(/<link href="https:\/\/fonts.googleapis.com[^>]*>/, '<link rel="preload" href="fonts/onest-400.woff2" as="font" type="font/woff2" crossorigin>' + FACES);
const head = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#131a16"><script>window.ROOKERY_ONLINE=true;</script>\n';
const firstBody = tpl.indexOf('<div class="app">');
const full = head + tpl.slice(0, firstBody) + '</head><body>\n' + tpl.slice(firstBody) + '\n</body></html>\n';
fs.writeFileSync(path.join(ROOT, 'public', 'index.html'), full);

// syntax check every inline script
const vm = require('vm');
let i = 0;
for (const m of full.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) { new vm.Script(m[1], { filename: 'inline-' + (i++) + '.js' }); }
console.log('built public/index.html', Math.round(full.length / 1024) + ' KB, ' + i + ' scripts OK');
