'use strict';
/* Rookery auto-updater.
   Checks GitHub every few minutes. When there is a new version it downloads it, replaces the program files
   (never the data folder), installs packages if needed and restarts the server. Run it with PM2:
     pm2 start updater.js --name rookery-updater && pm2 save */
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
fs.mkdirSync(DATA, { recursive: true });
const CFG_FILE = path.join(ROOT, 'updater.json');
const STATE_FILE = path.join(DATA, 'updater-state.json');
const NOW_FLAG = path.join(DATA, 'update-now');
const KEY_FILE = path.join(DATA, 'internal.key');
const SKIP = new Set(['data', 'node_modules', '.git', 'updater.json']);

const log = (...a) => console.log(new Date().toISOString().slice(0, 19).replace('T', ' '), '[updater]', ...a);
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const cfg = Object.assign({ repo: 'Lvxz-viper/rookery', branch: 'main', everyMinutes: 5, port: +process.env.PORT || 3001, apiBase: 'https://api.github.com', zipBase: 'https://codeload.github.com' }, readJson(CFG_FILE, {}));
let state = readJson(STATE_FILE, {});
function saveState(patch) { state = Object.assign(state, patch); fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1)); }

function get(url, asBuffer, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    (url.startsWith('https:') ? https : http).get(url, { headers: { 'User-Agent': 'rookery-updater', Accept: asBuffer ? '*/*' : 'application/vnd.github+json' } }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) { res.resume(); return resolve(get(res.headers.location, asBuffer, redirects + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('GitHub answered ' + res.statusCode + ' for ' + url)); }
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { const b = Buffer.concat(chunks); resolve(asBuffer ? b : JSON.parse(b.toString('utf8'))); });
      res.on('error', reject);
    }).on('error', reject).setTimeout(60000, function () { this.destroy(new Error('Timed out')); });
  });
}
function same(a, b) { try { return fs.readFileSync(a).equals(fs.readFileSync(b)); } catch (e) { return false; } }
function restartServer() {
  return new Promise(resolve => {
    let key = ''; try { key = fs.readFileSync(KEY_FILE, 'utf8').trim(); } catch (e) {}
    const req = http.request({ host: '127.0.0.1', port: cfg.port, path: '/internal/restart', method: 'POST', headers: { 'x-rookery-key': key } }, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false)); req.setTimeout(5000, () => { req.destroy(); resolve(false); }); req.end();
  });
}

let running = false;
async function check(reason) {
  if (running) return; running = true;
  try {
    const c = await get(`${cfg.apiBase}/repos/${cfg.repo}/commits/${cfg.branch}`);
    const sha = c.sha;
    saveState({ lastCheck: Date.now(), error: null, latest: sha, latestMessage: (c.commit && c.commit.message || '').split('\n')[0] });
    if (sha === state.sha && reason !== 'force') return;
    log('new version ' + sha.slice(0, 7) + ': ' + state.latestMessage);
    const zip = await get(`${cfg.zipBase}/${cfg.repo}/zip/refs/heads/${cfg.branch}`, true);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rookery-'));
    const zf = path.join(tmp, 'update.zip');
    fs.writeFileSync(zf, zip);
    const tries = [`tar -xf "${zf}" -C "${tmp}"`, `unzip -q -o "${zf}" -d "${tmp}"`,
      `powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath '${zf}' -DestinationPath '${tmp}'"`];
    let opened = false;
    for (const cmd of tries) { try { execSync(cmd, { stdio: 'ignore' }); opened = true; break; } catch (e) {} }
    if (!opened) throw new Error('Could not open the downloaded update');
    const top = fs.readdirSync(tmp).find(n => n !== 'update.zip' && fs.statSync(path.join(tmp, n)).isDirectory());
    if (!top) throw new Error('The download was empty');
    const src = path.join(tmp, top);
    if (!fs.existsSync(path.join(src, 'server.js'))) throw new Error('The download does not look like Rookery');
    const pkgChanged = !same(path.join(src, 'package.json'), path.join(ROOT, 'package.json'));
    const selfChanged = !same(path.join(src, 'updater.js'), path.join(ROOT, 'updater.js'));
    for (const name of fs.readdirSync(src)) {
      if (SKIP.has(name)) continue;
      fs.cpSync(path.join(src, name), path.join(ROOT, name), { recursive: true, force: true });
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    if (pkgChanged) { log('installing packages'); execSync('npm install --omit=dev --no-audit --no-fund', { cwd: ROOT, stdio: 'inherit' }); }
    saveState({ sha, lastUpdate: Date.now(), lastUpdateMessage: state.latestMessage });
    const ok = await restartServer();
    log(ok ? 'updated and restarted the server' : 'updated; the server did not answer, restart it with: pm2 restart rookery');
    if (selfChanged) { log('the updater itself changed, restarting it'); setTimeout(() => process.exit(0), 500); }
  } catch (e) {
    saveState({ lastCheck: Date.now(), error: e.message });
    log('check failed: ' + e.message);
  } finally { running = false; }
}

log(`watching ${cfg.repo} (${cfg.branch}) every ${cfg.everyMinutes} minutes`);
setTimeout(() => check(), 5000);
setInterval(() => check(), Math.max(2, cfg.everyMinutes) * 60000);
setInterval(() => { if (fs.existsSync(NOW_FLAG)) { try { fs.unlinkSync(NOW_FLAG); } catch (e) {} check('now'); } }, 5000);
