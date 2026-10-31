'use strict';
/* Rookery server v2: website, live games, accounts, friends, spectating, puzzles and the admin API. */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const zlib = require('zlib');
const vm = require('vm');
const { WebSocketServer } = require('ws');

const VERSION = '3.0.0';
const PORT = +process.env.PORT || 3001;
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
fs.mkdirSync(DATA, { recursive: true });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'core.js'), 'utf8'), { filename: 'core.js' });

const KEYF = path.join(DATA, 'internal.key');
if (!fs.existsSync(KEYF)) fs.writeFileSync(KEYF, crypto.randomBytes(24).toString('hex'));
const INTERNAL_KEY = fs.readFileSync(KEYF, 'utf8').trim();
const logBuf = [];
const log = (...a) => {
  const line = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' ' + a.map(x => typeof x === 'string' ? x : (x && x.stack) || JSON.stringify(x)).join(' ');
  console.log(line);
  logBuf.push({ ts: Date.now(), line, err: /error|fail|crash/i.test(line) });
  if (logBuf.length > 800) logBuf.shift();
};
const puzzles = require('./puzzles')(DATA, log);

/* ================= time controls ================= */
const TCS = ['1+0', '2+1', '3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10', '30+0', 'none'];
function tcInfo(key) {
  if (!TCS.includes(key)) key = '5+0';
  if (key === 'none') return { key, base: 0, inc: 0, cat: 'rapid', rated: false };
  const [m, i] = key.split('+').map(Number);
  const est = m * 60 + i * 40;
  const cat = est < 180 ? 'bullet' : est < 480 ? 'blitz' : 'rapid';
  return { key, base: m * 60000, inc: i * 1000, cat, rated: true };
}
const CATS = ['bullet', 'blitz', 'rapid', 'daily'];
const LIVE_CATS = ['bullet', 'blitz', 'rapid'];
const DAILY_DAYS = [1, 3, 7];

/* ================= storage ================= */
const DBF = path.join(DATA, 'db.json');
const GAMESF = path.join(DATA, 'games.jsonl');
let db = { version: 2, players: {}, sessions: {}, names: {}, reports: [], announce: null, settings: {}, ipBans: {}, audit: [], daily: {}, dailyInvites: {}, dailySeeks: {}, dms: {}, stats: { dau: {}, peak: {} }, uptime: { events: [], since: null }, filter: null };
const DEFAULT_SETTINGS = { maintenance: false, guestsOnline: true, signups: true, chat: true };

function newRatings(r) { const o = {}; CATS.forEach(c => { o[c] = { r: r || 1200, games: 0, w: 0, l: 0, d: 0, peak: r || 1200 }; }); return o; }
function newPlayer(id, name) {
  return { id, name, username: null, guest: true, pass: null, ratings: newRatings(1200), created: Date.now(), seen: Date.now(),
    avatar: { p: 'nkqrbp'[crypto.randomInt(6)], c: crypto.randomInt(8) }, friends: [], reqIn: [], reqOut: [], hist: [],
    puzzle: { r: 1500, solved: 0, failed: 0, streak: 0, best: 0, recent: [] }, banned: false, muted: false,
    bio: '', country: '', role: '', ach: {}, streak: 0, bestStreak: 0 };
}
(function loadDb() {
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(DBF, 'utf8')); } catch (e) {}
  if (raw && raw.version === 2) { db = Object.assign(db, raw); return; }
  // migrate v1 (data/players.json keyed by session token)
  try {
    const v1 = JSON.parse(fs.readFileSync(path.join(DATA, 'players.json'), 'utf8'));
    let n = 0;
    for (const [tok, o] of Object.entries(v1.players || {})) {
      const p = newPlayer(o.id || crypto.randomBytes(5).toString('hex'), o.name || 'Guest');
      p.ratings = newRatings(o.rating || 1200);
      Object.assign(p.ratings.blitz, { games: o.games || 0, w: o.w || 0, l: o.l || 0, d: o.d || 0, peak: o.rating || 1200 });
      p.created = o.created || Date.now();
      db.players[p.id] = p; db.sessions[tok] = { pid: p.id, created: Date.now() }; n++;
    }
    if (n) log('[db] migrated ' + n + ' players from version 1');
  } catch (e) {}
})();
db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings || {}); db.ipBans = db.ipBans || {}; db.audit = db.audit || [];
['daily', 'dailyInvites', 'dailySeeks', 'dms'].forEach(k => { db[k] = db[k] || {}; });
db.stats = Object.assign({ dau: {}, peak: {} }, db.stats || {});
db.uptime = Object.assign({ events: [], since: null }, db.uptime || {});
if (!db.uptime.since) db.uptime.since = Date.now();
db.filter = Object.assign({ enabled: true, strikes: 3, muteHours: 24, words: [
  'fuck', 'fucking', 'shit', 'bitch', 'cunt', 'asshole', 'bastard', 'dick', 'pussy', 'whore', 'slut', 'motherfucker',
  'كس', 'زب', 'شرموط', 'شرموطة', 'منيوك', 'قحبة', 'خول', 'عرص', 'متناك', 'كسمك', 'كس امك', 'يلعن', 'ابن الكلب', 'ابن الحرام', 'زق'] }, db.filter || {});
for (const p of Object.values(db.players)) {
  for (const c of CATS) if (!p.ratings[c]) p.ratings[c] = { r: 1200, games: 0, w: 0, l: 0, d: 0, peak: 1200 };
  p.ach = p.ach || {}; if (p.streak == null) p.streak = 0; if (p.bestStreak == null) p.bestStreak = 0;
}
// prune empty guests that have not been seen for 30 days
(function prune() {
  const cut = Date.now() - 30 * 864e5, gone = new Set();
  for (const p of Object.values(db.players)) {
    const games = CATS.reduce((s, c) => s + p.ratings[c].games, 0);
    if (p.guest && games === 0 && (p.seen || 0) < cut && !p.puzzle.solved) { delete db.players[p.id]; gone.add(p.id); }
  }
  for (const [t, s] of Object.entries(db.sessions)) if (!db.players[s.pid]) delete db.sessions[t];
  if (gone.size) log('[db] removed ' + gone.size + ' inactive guests');
})();
let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const tmp = DBF + '.tmp';
    fs.writeFile(tmp, JSON.stringify(db), e => { if (e) return log('[db] save failed', e.message); fs.rename(tmp, DBF, () => {}); });
  }, 500);
}
const records = new Map(), byPlayer = new Map();
(function loadGames() {
  try {
    const lines = fs.readFileSync(GAMESF, 'utf8').split('\n');
    for (const l of lines) { if (!l) continue; try { indexRecord(JSON.parse(l)); } catch (e) {} }
  } catch (e) {}
})();
function indexRecord(r) {
  records.set(r.id, r);
  for (const pid of [r.w.id, r.b.id]) { if (!byPlayer.has(pid)) byPlayer.set(pid, []); byPlayer.get(pid).push(r.id); }
}
function storeRecord(r) { indexRecord(r); fs.appendFile(GAMESF, JSON.stringify(r) + '\n', () => {}); }

/* ================= helpers ================= */
const rid = n => crypto.randomBytes(n).toString('hex');
const P = id => db.players[id];
const RESERVED = new Set(['admin', 'rookery', 'moderator', 'system', 'guest', 'pip', 'marlowe', 'juno', 'odile', 'vasco', 'sable', 'oracle', 'stockfish']);
function cleanText(s, n) { return String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }
function hashPw(pw, salt) { return new Promise((res, rej) => crypto.scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k.toString('hex')))); }
async function checkPw(pw, rec) {
  if (!rec) return false;
  const h = await hashPw(pw, rec.salt);
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(rec.hash, 'hex'));
}
function guestName() { let n; do { n = 'Guest' + (1000 + crypto.randomInt(9000)); } while (db.names[n.toLowerCase()]); return n; }

/* ================= connections ================= */
const conns = new Map();        // pid -> Set<ws>
const games = new Map();        // gid -> live game
const activeOf = new Map();     // pid -> gid
const rooms = new Map();        // code -> {host, tc, color}
const queues = {};              // tc -> [pid]
const challenges = new Map();   // cid -> {id, from, to, tc, color, ts}
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };
const sendP = (pid, o) => { const s = conns.get(pid); if (!s) return; const m = JSON.stringify(o); s.forEach(ws => send(ws, m)); };
const online = pid => conns.has(pid);
const gameOf = pid => { const g = games.get(activeOf.get(pid)); return g && !g.over ? g : null; };

function pub(p, cat) {
  return { id: p.id, name: p.name, guest: p.guest, avatar: p.avatar, title: p.title || null, country: p.country || '', role: p.role || '', rating: cat ? p.ratings[cat].r : undefined,
    prov: cat ? p.ratings[cat].games < 10 : undefined };
}
function me(p) {
  return { id: p.id, name: p.name, username: p.username, guest: p.guest, avatar: p.avatar, ratings: p.ratings,
    puzzle: { r: p.puzzle.r, solved: p.puzzle.solved, failed: p.puzzle.failed, streak: p.puzzle.streak, best: p.puzzle.best },
    hist: p.hist.slice(-400), created: p.created, muted: isMuted(p), title: p.title || null, bio: p.bio || '', country: p.country || '', role: p.role || '',
    ach: p.ach || {}, streak: p.streak || 0, bestStreak: p.bestStreak || 0, dmUnread: dmUnread(p.id), dailyTurn: dailyTurnCount(p.id) };
}
function status(pid) { const g = gameOf(pid); return g ? 'playing' : online(pid) ? 'online' : 'offline'; }
function friendsPayload(p) {
  const row = id => { const f = P(id); if (!f) return null; return { id, name: f.name, avatar: f.avatar, title: f.title || null, rating: f.ratings.blitz.r, status: status(id), gid: activeOf.get(id) && gameOf(id) ? activeOf.get(id) : null }; };
  return { t: 'friends', list: p.friends.map(row).filter(Boolean), incoming: p.reqIn.map(row).filter(Boolean), outgoing: p.reqOut.map(row).filter(Boolean) };
}
function notifyFriends(pid) { const p = P(pid); if (!p) return; p.friends.forEach(f => { if (online(f)) sendP(f, friendsPayload(P(f))); }); }

/* ================= moderation helpers ================= */
function isMuted(p) {
  if (p.muted && p.muteUntil && p.muteUntil < Date.now()) { p.muted = false; p.muteUntil = null; save(); }
  return !!p.muted;
}
let filterRe = null, filterKey = '';
function buildFilter() {
  const words = (db.filter.words || []).map(w => String(w).trim()).filter(Boolean);
  const key = words.join('|');
  if (key === filterKey) return filterRe;
  filterKey = key;
  if (!words.length) return (filterRe = null);
  const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  filterRe = new RegExp('(^|[^\\p{L}\\p{N}])(' + words.sort((a, b) => b.length - a.length).map(esc).join('|') + ')(?=$|[^\\p{L}\\p{N}])', 'giu');
  return filterRe;
}
/* masks bad words; counts strikes and mutes repeat offenders. Returns the cleaned text. */
function filterText(text, p) {
  if (!db.filter.enabled) return text;
  const re = buildFilter(); if (!re) return text;
  let hits = 0;
  const out = text.replace(re, (m, pre, w) => { hits++; return pre + '*'.repeat([...w].length); });
  if (hits && p) {
    p.strikes = (p.strikes || 0) + 1;
    if (db.filter.strikes > 0 && p.strikes >= db.filter.strikes) {
      p.strikes = 0; p.muted = true; p.muteUntil = Date.now() + (db.filter.muteHours || 24) * 3600e3;
      sendP(p.id, { t: 'info', msg: 'Chat is turned off for your account for ' + (db.filter.muteHours || 24) + ' hours because of repeated bad language.' });
      log('[filter] muted ' + p.name);
      db.audit.push({ ts: Date.now(), ip: 'server', action: 'auto mute', detail: p.name });
    }
    save();
  }
  return out;
}

/* ================= achievements ================= */
const ACH = [
  ['first_win', 'First victory', 'Win a rated game'], ['wins_10', 'Ten wins', 'Win 10 rated games'], ['wins_50', 'Fifty wins', 'Win 50 rated games'],
  ['wins_100', 'Centurion', 'Win 100 rated games'], ['games_100', 'Regular', 'Play 100 rated games'], ['streak_5', 'On a roll', 'Win 5 rated games in a row'],
  ['streak_10', 'Unstoppable', 'Win 10 rated games in a row'], ['giant', 'Giant slayer', 'Beat a player rated 200 or more above you'],
  ['quick_mate', 'Quick finish', 'Checkmate your opponent in under 20 moves'], ['r1500', 'Club player', 'Reach 1500 in any rating'],
  ['r1800', 'Expert', 'Reach 1800 in any rating'], ['r2000', 'Candidate master', 'Reach 2000 in any rating'], ['r2200', 'Master', 'Reach 2200 in any rating'],
  ['pz10', 'Puzzle solver', 'Solve 10 puzzles'], ['pz100', 'Tactician', 'Solve 100 puzzles'], ['pz500', 'Puzzle master', 'Solve 500 puzzles'],
  ['pzstreak10', 'Sharp eye', 'Solve 10 puzzles in a row'], ['pz2000', 'Puzzle expert', 'Reach a puzzle rating of 2000'],
  ['friend1', 'Good company', 'Add your first friend'], ['friend10', 'Popular', 'Have 10 friends'],
  ['daily_win', 'Patient player', 'Win a daily game'], ['daily_10', 'Correspondent', 'Finish 10 daily games']
];
const ACH_IDS = new Set(ACH.map(a => a[0]));
function grant(p, id, quiet) {
  if (!ACH_IDS.has(id) || (p.ach || (p.ach = {}))[id]) return false;
  p.ach[id] = Date.now();
  if (!quiet) { const a = ACH.find(x => x[0] === id); sendP(p.id, { t: 'achievement', id, name: a[1], desc: a[2] }); }
  return true;
}
function checkAch(p) {
  if (p.guest) return;
  let wins = 0, played = 0, top = 0;
  for (const c of CATS) { const r = p.ratings[c]; wins += r.w; played += r.games; top = Math.max(top, r.peak || r.r); }
  const pz = p.puzzle, ch = [];
  [[wins >= 1, 'first_win'], [wins >= 10, 'wins_10'], [wins >= 50, 'wins_50'], [wins >= 100, 'wins_100'], [played >= 100, 'games_100'],
   [(p.bestStreak || 0) >= 5, 'streak_5'], [(p.bestStreak || 0) >= 10, 'streak_10'],
   [top >= 1500, 'r1500'], [top >= 1800, 'r1800'], [top >= 2000, 'r2000'], [top >= 2200, 'r2200'],
   [pz.solved >= 10, 'pz10'], [pz.solved >= 100, 'pz100'], [pz.solved >= 500, 'pz500'], [pz.best >= 10, 'pzstreak10'], [pz.r >= 2000, 'pz2000'],
   [p.friends.length >= 1, 'friend1'], [p.friends.length >= 10, 'friend10'],
   [p.ratings.daily.w >= 1, 'daily_win'], [p.ratings.daily.games >= 10, 'daily_10']].forEach(([ok, id]) => { if (ok && grant(p, id)) ch.push(id); });
  if (ch.length) save();
}

/* ================= ratings shared by live and daily games ================= */
function applyResult(W, B, cat, result, rated) {
  const before = [W.ratings[cat].r, B.ratings[cat].r];
  let after = before.slice();
  if (result === 'aborted') return { before, after };
  const s = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
  if (rated) {
    const ew = 1 / (1 + Math.pow(10, (before[1] - before[0]) / 400));
    const k = r => (r.games < 10 ? 48 : r.games < 30 ? 32 : 20);
    const rw = W.ratings[cat], rb = B.ratings[cat];
    rw.r = Math.max(100, Math.round(rw.r + k(rw) * (s - ew)));
    rb.r = Math.max(100, Math.round(rb.r + k(rb) * ((1 - s) - (1 - ew))));
    after = [rw.r, rb.r];
    [[rw, s], [rb, 1 - s]].forEach(([r, sc]) => { r.games++; if (sc === 1) r.w++; else if (sc === 0) r.l++; else r.d++; r.peak = Math.max(r.peak, r.r); });
    W.hist.push([Date.now(), cat, rw.r]); B.hist.push([Date.now(), cat, rb.r]);
    [W, B].forEach(x => { if (x.hist.length > 1500) x.hist.splice(0, x.hist.length - 1500); });
    [[W, s], [B, 1 - s]].forEach(([x, sc]) => { if (sc === 1) { x.streak = (x.streak || 0) + 1; x.bestStreak = Math.max(x.bestStreak || 0, x.streak); } else x.streak = 0; });
  }
  return { before, after, s };
}
function afterGameAch(W, B, res, result, reason, plies, cat) {
  if (result === 'aborted' || res.s == null) return;
  [[W, B, res.s, 0], [B, W, 1 - res.s, 1]].forEach(([me_, opp, sc, i]) => {
    if (sc === 1) {
      if (res.before[i ^ 1] - res.before[i] >= 200) grant(me_, 'giant');
      if (reason === 'checkmate' && plies < 40) grant(me_, 'quick_mate');
    }
    checkAch(me_);
  });
  save();
}

/* ================= private messages ================= */
const dmKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
function dmUnread(pid) {
  let n = 0;
  for (const c of Object.values(db.dms)) { if (c.a !== pid && c.b !== pid) continue; const r = (c.read || {})[pid] || 0; for (let i = c.msgs.length - 1; i >= 0 && c.msgs[i].ts > r; i--) if (c.msgs[i].f !== pid) n++; }
  return n;
}
function dmList(pid) {
  const out = [];
  for (const [k, c] of Object.entries(db.dms)) {
    if (c.a !== pid && c.b !== pid) continue;
    const other = P(c.a === pid ? c.b : c.a); if (!other) continue;
    const last = c.msgs[c.msgs.length - 1]; const r = (c.read || {})[pid] || 0;
    out.push({ id: other.id, who: pub(other, 'blitz'), online: online(other.id), last: last ? { text: last.t, ts: last.ts, mine: last.f === pid } : null,
      unread: c.msgs.filter(m => m.ts > r && m.f !== pid).length });
  }
  return out.sort((a, b) => ((b.last && b.last.ts) || 0) - ((a.last && a.last.ts) || 0));
}

/* ================= daily (correspondence) games ================= */
const dailyPos = new Map();
function dPos(g) {
  let p = dailyPos.get(g.id);
  if (!p || p._n !== g.moves.length) { p = new Pos(); for (const u of g.moves) { const m = p.parseUci(u); if (m) p.make(m); } p._n = g.moves.length; dailyPos.set(g.id, p); }
  return p;
}
function dailyView(g, pid) {
  const pos = dPos(g);
  return { gid: g.id, days: g.days, white: pub(P(g.w), 'daily'), black: pub(P(g.b), 'daily'), color: g.w === pid ? 0 : g.b === pid ? 1 : -1,
    moves: g.moves, fen: pos.fen(), turn: pos.turn, deadline: g.deadline, created: g.created, last: g.last, over: g.over, drawFrom: g.drawOffer == null ? -1 : g.drawOffer,
    online: [online(g.w), online(g.b)] };
}
function dailyGamesOf(pid) { return Object.values(db.daily).filter(g => g.w === pid || g.b === pid); }
function dailyTurnCount(pid) { let n = 0; for (const g of dailyGamesOf(pid)) if (!g.over && dPos(g).turn === (g.w === pid ? 0 : 1)) n++; return n; }
function dailySummaryFor(pid) {
  return dailyGamesOf(pid).filter(g => !g.over || Date.now() - g.over.ts < 3 * 864e5)
    .map(g => dailyView(g, pid)).sort((a, b) => (!!a.over - !!b.over) || ((b.color === b.turn) - (a.color === a.turn)) || a.deadline - b.deadline);
}
function sendDailyList(pid) {
  sendP(pid, { t: 'daily_list', games: dailySummaryFor(pid),
    invites: Object.values(db.dailyInvites).filter(i => i.to === pid || i.from === pid).map(i => ({ id: i.id, days: i.days, color: i.color, incoming: i.to === pid, who: pub(P(i.to === pid ? i.from : i.to), 'daily') })),
    seeks: Object.values(db.dailySeeks).filter(x => P(x.by)).map(x => ({ id: x.id, days: x.days, color: x.color, mine: x.by === pid, by: pub(P(x.by), 'daily'), ts: x.ts })) });
}
function createDaily(a, b, days, pref) {
  let w = a, bl = b;
  if (pref === 'b' || (pref === 'r' && crypto.randomInt(2))) { w = b; bl = a; }
  const g = { id: 'd' + rid(5), w, b: bl, days, moves: [], created: Date.now(), last: Date.now(), deadline: Date.now() + days * 864e5, over: null, drawOffer: null };
  db.daily[g.id] = g; save();
  [w, bl].forEach(x => { sendP(x, { t: 'daily_update', game: dailyView(g, x), fresh: true }); sendDailyList(x); });
  log(`[daily ${g.id}] ${P(w).name} vs ${P(bl).name}, ${days} day(s) per move`);
  return g;
}
function endDaily(g, result, reason) {
  if (g.over) return;
  g.over = { result, reason, ts: Date.now() };
  const W = P(g.w), B = P(g.b);
  if (!W || !B) { save(); return; }
  const rated = g.moves.length >= 2 && result !== 'aborted';
  const res = applyResult(W, B, 'daily', rated ? result : 'aborted', rated);
  if (result !== 'aborted' && g.moves.length >= 2) {
    storeRecord({ id: g.id, ts: g.created, end: Date.now(), tc: 'd' + g.days, cat: 'daily', rated: true, result, reason,
      w: { id: W.id, name: W.name, r: res.before[0], a: res.after[0] }, b: { id: B.id, name: B.name, r: res.before[1], a: res.after[1] }, moves: g.moves, times: [] });
  }
  afterGameAch(W, B, res, result, reason, g.moves.length, 'daily');
  save();
  [g.w, g.b].forEach(x => { sendP(x, { t: 'daily_update', game: dailyView(g, x), ratings: [[res.before[0], res.after[0]], [res.before[1], res.after[1]]] }); sendP(x, { t: 'me', me: me(P(x)) }); sendDailyList(x); });
  log(`[daily ${g.id}] ${result} by ${reason}`);
}
function dailyMove(pid, m) {
  const g = db.daily[m.gid]; if (!g || g.over) return;
  const c = g.w === pid ? 0 : g.b === pid ? 1 : -1; if (c < 0) return;
  const pos = dPos(g);
  if (pos.turn !== c) return sendP(pid, { t: 'daily_update', game: dailyView(g, pid) });
  const mv = pos.parseUci(String(m.uci || ''));
  if (!mv) return sendP(pid, { t: 'daily_update', game: dailyView(g, pid) });
  const u = pos.uci(mv);
  pos.make(mv); g.moves.push(u); pos._n = g.moves.length;
  g.last = Date.now(); g.deadline = Date.now() + g.days * 864e5;
  if (g.drawOffer === (c ^ 1)) g.drawOffer = null;
  save();
  const st = pos.status();
  if (st.over) return endDaily(g, st.result, st.reason);
  [g.w, g.b].forEach(x => sendP(x, { t: 'daily_update', game: dailyView(g, x), moved: x !== pid }));
  const opp = c ? g.w : g.b; sendP(opp, { t: 'me', me: me(P(opp)) });
}
setInterval(() => {
  const now = Date.now();
  for (const g of Object.values(db.daily)) {
    if (g.over) { if (now - g.over.ts > 30 * 864e5) { delete db.daily[g.id]; dailyPos.delete(g.id); save(); } continue; }
    if (g.deadline < now) {
      const pos = dPos(g), side = pos.turn;
      if (g.moves.length < 2) endDaily(g, 'aborted', 'aborted');
      else if (!canMate(pos, side ^ 1)) endDaily(g, '1/2-1/2', 'timeout vs insufficient material');
      else endDaily(g, side === 0 ? '0-1' : '1-0', 'timeout');
    }
  }
  for (const [k, i] of Object.entries(db.dailyInvites)) if (now - i.ts > 7 * 864e5) delete db.dailyInvites[k];
  for (const [k, x] of Object.entries(db.dailySeeks)) if (now - x.ts > 14 * 864e5 || !P(x.by)) delete db.dailySeeks[k];
}, 60000);

/* ================= activity stats and uptime ================= */
const dayKey = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const activeToday = { day: dayKey(), set: new Set() };
function markActive(pid) {
  const k = dayKey(); if (activeToday.day !== k) { activeToday.day = k; activeToday.set = new Set(); }
  activeToday.set.add(pid); db.stats.dau[k] = activeToday.set.size;
  const pk = conns.size; if (pk > (db.stats.peak[k] || 0)) db.stats.peak[k] = pk;
  const keys = Object.keys(db.stats.dau); if (keys.length > 120) keys.sort().slice(0, keys.length - 120).forEach(x => { delete db.stats.dau[x]; delete db.stats.peak[x]; });
}
function uptimeEvent(type, from, to, note) {
  db.uptime.events.push({ type, from, to, note: note || '' });
  if (db.uptime.events.length > 300) db.uptime.events.splice(0, db.uptime.events.length - 300);
  save();
}
const HBF = path.join(DATA, 'heartbeat.json');
(function bootUptime() {
  let hb = null; try { hb = JSON.parse(fs.readFileSync(HBF, 'utf8')); } catch (e) {}
  const now = Date.now();
  if (hb && hb.ts) {
    const gap = now - hb.ts;
    if (hb.crash) uptimeEvent('crash', hb.ts, now, hb.crash.slice(0, 200));
    else if (!hb.clean && gap > 90000) uptimeEvent('server', hb.ts, now, 'Rookery or the computer was off');
    else if (hb.clean && gap > 5 * 60000) uptimeEvent('server', hb.ts, now, 'Rookery was stopped');
  }
})();
function beat(extra) { try { fs.writeFileSync(HBF, JSON.stringify(Object.assign({ ts: Date.now() }, extra || {}))); } catch (e) {} }
beat(); setInterval(beat, 30000);
const net = { down: null, fails: 0, lastOk: null };
function checkInternet() {
  const req = https.request({ host: 'www.cloudflare.com', path: '/cdn-cgi/trace', method: 'GET', timeout: 8000 }, res => {
    res.resume();
    net.fails = 0; net.lastOk = Date.now();
    if (net.down) { uptimeEvent('internet', net.down, Date.now(), 'Internet connection lost'); log('[uptime] internet is back'); net.down = null; }
  });
  const fail = () => { net.fails++; if (net.fails === 2 && !net.down) { net.down = Date.now() - 60000; log('[uptime] internet connection lost'); } };
  req.on('timeout', () => { req.destroy(); }); req.on('error', fail); req.end();
}
if (process.env.NO_NET_CHECK !== '1') { setTimeout(checkInternet, 15000); setInterval(checkInternet, 60000); }
function uptimeSummary() {
  const now = Date.now(), span = 7 * 864e5, from = Math.max(now - span, db.uptime.since || now - span), total = Math.max(1, now - from);
  let down = 0;
  const evs = db.uptime.events.concat(net.down ? [{ type: 'internet', from: net.down, to: now, note: 'Internet connection lost (ongoing)' }] : []);
  for (const e of evs) { const a = Math.max(e.from, from), b = Math.min(e.to, now); if (b > a) down += b - a; }
  return { percent: Math.max(0, Math.round((1 - down / total) * 10000) / 100), since: db.uptime.since, events: evs.slice(-60).reverse(), internetOk: !net.down, lastOk: net.lastOk };
}

let statsT = null;
function broadcastStats() {
  if (statsT) return;
  statsT = setTimeout(() => {
    statsT = null;
    let playing = 0; games.forEach(g => { if (!g.over) playing++; });
    const m = JSON.stringify({ t: 'stats', online: conns.size, playing });
    conns.forEach(set => set.forEach(ws => send(ws, m)));
  }, 300);
}
function leaderboard(cat) {
  if (!CATS.includes(cat)) cat = 'blitz';
  return Object.values(db.players).filter(p => !p.guest && !p.banned && p.ratings[cat].games > 0)
    .sort((a, b) => b.ratings[cat].r - a.ratings[cat].r).slice(0, 50)
    .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, title: p.title || null, rating: p.ratings[cat].r, games: p.ratings[cat].games, online: online(p.id) }));
}

/* ================= games ================= */
function liveClock(g) {
  const c = g.clock.slice();
  if (g.tc.base && !g.over && g.moves.length >= 2) c[g.pos.turn] = Math.max(0, c[g.pos.turn] - (Date.now() - g.last));
  return c;
}
function gameState(g, pid) {
  const color = g.w === pid ? 0 : g.b === pid ? 1 : -1;
  return { gid: g.id, color, white: pub(P(g.w), g.tc.cat), black: pub(P(g.b), g.tc.cat), tc: g.tc.key, rated: g.tc.rated, cat: g.tc.cat,
    moves: g.moves, times: g.times, clock: liveClock(g), over: g.over, spect: g.spect.size,
    online: [online(g.w), online(g.b)], chat: color >= 0 ? g.chat.slice(-60) : [], drawFrom: g.drawOffer };
}
function toPlayers(g, o) { sendP(g.w, o); sendP(g.b, o); }
function toAll(g, o) { const m = JSON.stringify(o); toPlayers(g, o); g.spect.forEach(ws => send(ws, m)); }

function leaveQueues(pid) { for (const k in queues) queues[k] = queues[k].filter(x => x !== pid); }
function cancelRooms(pid) { for (const [c, r] of rooms) if (r.host === pid) rooms.delete(c); }
function dropChallenges(pid, reason) {
  for (const [id, c] of challenges) if (c.from === pid || c.to === pid) {
    challenges.delete(id);
    sendP(c.from, { t: 'challenge_gone', cid: id, reason }); sendP(c.to, { t: 'challenge_gone', cid: id, reason });
  }
}

function createGame(a, b, tcKey, pref) {
  let w = a, bl = b;
  if (pref === 'b' || (pref === 'r' && crypto.randomInt(2))) { w = b; bl = a; }
  const tc = tcInfo(tcKey);
  const g = { id: rid(5), w, b: bl, tc, pos: new Pos(), moves: [], sans: [], times: [], clock: [tc.base, tc.base], last: Date.now(),
    over: null, drawOffer: -1, rematch: {}, dc: [null, null], timer: null, spect: new Set(), chat: [], created: Date.now() };
  games.set(g.id, g); activeOf.set(w, g.id); activeOf.set(bl, g.id);
  [w, bl].forEach(p => { leaveQueues(p); cancelRooms(p); dropChallenges(p, 'started another game'); });
  sendP(w, Object.assign({ t: 'start' }, gameState(g, w)));
  sendP(bl, Object.assign({ t: 'start' }, gameState(g, bl)));
  schedule(g); broadcastStats(); notifyFriends(w); notifyFriends(bl);
  log(`[game ${g.id}] ${P(w).name} vs ${P(bl).name} ${tc.key}`);
  return g;
}
function schedule(g) {
  clearTimeout(g.timer);
  if (g.over) return;
  if (g.moves.length < 2) {
    g.timer = setTimeout(() => { if (!g.over && g.moves.length < 2) endGame(g, 'aborted', 'aborted'); }, 40000);
    return;
  }
  if (!g.tc.base) return;
  const side = g.pos.turn;
  g.timer = setTimeout(() => {
    if (g.over) return;
    const t = Date.now(); g.clock[side] -= t - g.last; g.last = t;
    if (g.clock[side] <= 0) { g.clock[side] = 0; flag(g, side); } else schedule(g);
  }, Math.max(40, g.clock[side] + 25));
}
function canMate(pos, c) {
  let n = 0, minor = 0;
  for (let s = 0; s < 64; s++) { const p = pos.b[s]; if (!p || (p >> 3) !== c || (p & 7) === 6) continue; n++; if ((p & 7) === 2 || (p & 7) === 3) minor++; }
  return !(n === 0 || (n === 1 && minor === 1));
}
function flag(g, side) {
  if (!canMate(g.pos, side ^ 1)) endGame(g, '1/2-1/2', 'timeout vs insufficient material');
  else endGame(g, side === 0 ? '0-1' : '1-0', 'timeout');
}
function playMove(pid, m) {
  const g = gameOf(pid);
  if (!g || m.gid !== g.id) return;
  const c = g.w === pid ? 0 : 1;
  if (g.pos.turn !== c) return sendP(pid, Object.assign({ t: 'start' }, gameState(g, pid)));
  const t = Date.now();
  if (g.tc.base && g.moves.length >= 2) {
    g.clock[c] -= t - g.last;
    if (g.clock[c] <= 0) { g.clock[c] = 0; return flag(g, c); }
  }
  const mv = g.pos.parseUci(String(m.uci || ''));
  if (!mv) return sendP(pid, Object.assign({ t: 'start' }, gameState(g, pid)));
  const san = g.pos.san(mv), u = g.pos.uci(mv);
  g.pos.make(mv); g.moves.push(u); g.sans.push(san);
  if (g.tc.base && g.moves.length > 2) g.clock[c] += g.tc.inc;
  g.times.push(g.clock[c]);
  g.last = t;
  if (g.drawOffer === (c ^ 1)) g.drawOffer = -1;
  toAll(g, { t: 'move', gid: g.id, uci: u, san, n: g.moves.length, clock: g.clock.slice() });
  const st = g.pos.status();
  if (st.over) return endGame(g, st.result, st.reason);
  schedule(g);
}
function endGame(g, result, reason) {
  if (g.over) return;
  clearTimeout(g.timer); g.dc.forEach(x => x && clearTimeout(x));
  g.over = { result, reason };
  const W = P(g.w), B = P(g.b), cat = g.tc.cat;
  const res = applyResult(W, B, cat, result, g.tc.rated && result !== 'aborted');
  const before = res.before, after = res.after;
  if (g.tc.rated) afterGameAch(W, B, res, result, reason, g.moves.length, cat);
  save();
  if (result !== 'aborted') {
    storeRecord({ id: g.id, ts: g.created, end: Date.now(), tc: g.tc.key, cat, rated: g.tc.rated, result, reason,
      w: { id: W.id, name: W.name, r: before[0], a: after[0] }, b: { id: B.id, name: B.name, r: before[1], a: after[1] },
      moves: g.moves, times: g.times });
  }
  toAll(g, { t: 'end', gid: g.id, result, reason, ratings: [[before[0], after[0]], [before[1], after[1]]] });
  sendP(g.w, { t: 'me', me: me(W) }); sendP(g.b, { t: 'me', me: me(B) });
  log(`[game ${g.id}] ${result} by ${reason}`);
  broadcastStats(); notifyFriends(g.w); notifyFriends(g.b);
  setTimeout(() => {
    if (games.get(g.id) !== g) return;
    games.delete(g.id);
    g.spect.forEach(ws => { if (ws.watching === g.id) ws.watching = null; });
  }, 20 * 60 * 1000);
}
function liveList() {
  const out = [];
  games.forEach(g => {
    if (g.over) return;
    const W = P(g.w), B = P(g.b);
    out.push({ gid: g.id, tc: g.tc.key, cat: g.tc.cat, rated: g.tc.rated, white: pub(W, g.tc.cat), black: pub(B, g.tc.cat),
      fen: g.pos.fen(), last: g.moves[g.moves.length - 1] || null, n: g.moves.length, spect: g.spect.size, clock: liveClock(g) });
  });
  return out.sort((a, b) => (b.white.rating + b.black.rating) - (a.white.rating + a.black.rating));
}
function summary(r, pid) {
  const c = r.w.id === pid ? 0 : 1;
  return { id: r.id, ts: r.end, tc: r.tc, cat: r.cat, rated: r.rated, result: r.result, reason: r.reason, white: r.w, black: r.b, color: c, n: r.moves.length };
}

/* ================= protocol ================= */
function publicCfg() { const st = db.settings; return { maintenance: st.maintenance, guestsOnline: st.guestsOnline, signups: st.signups, chat: st.chat }; }
function banInfo(p) {
  if (p.banUntil && p.banUntil < Date.now()) { p.banned = false; p.banUntil = null; p.banReason = null; save(); }
  if (!p.banned) return null;
  return 'Your account is suspended' + (p.banUntil ? ' until ' + new Date(p.banUntil).toUTCString().replace(' GMT', ' UTC') : '') + '.' + (p.banReason ? ' Reason: ' + p.banReason : '');
}
function canStart(p) {
  if (db.settings.maintenance) return 'New games are paused for server maintenance. Please try again soon.';
  if (p.guest && !db.settings.guestsOnline) return 'Create a free account to play online.';
  return null;
}
const chatLog = [];
function audit(ip, action, detail) {
  db.audit.push({ ts: Date.now(), ip, action, detail: String(detail || '').slice(0, 200) });
  if (db.audit.length > 300) db.audit.splice(0, db.audit.length - 300);
  save();
}
function attach(ws, pid) {
  if (ws.pid && ws.pid !== pid) detach(ws);
  ws.pid = pid;
  if (!conns.has(pid)) conns.set(pid, new Set());
  conns.get(pid).add(ws);
  const p = P(pid); p.seen = Date.now(); if (ws.device) p.device = ws.device;
  markActive(pid);
  send(ws, { t: 'welcome', token: ws.token, me: me(p), cfg: publicCfg() });
  if (!p.guest) setTimeout(() => sendDailyList(pid), 50);
  send(ws, friendsPayload(p));
  if (db.announce && Date.now() - db.announce.ts < 864e5) send(ws, { t: 'announce', text: db.announce.text, ts: db.announce.ts });
  const g = gameOf(pid);
  if (g) {
    const c = g.w === pid ? 0 : 1;
    if (g.dc[c]) { clearTimeout(g.dc[c]); g.dc[c] = null; }
    send(ws, Object.assign({ t: 'start' }, gameState(g, pid)));
    toAll(g, { t: 'presence', gid: g.id, online: [online(g.w), online(g.b)] });
  }
  for (const c of challenges.values()) if (c.to === pid) send(ws, { t: 'challenge_in', cid: c.id, from: pub(P(c.from), tcInfo(c.tc).cat), tc: c.tc, color: c.color });
  broadcastStats(); notifyFriends(pid);
}
function detach(ws) {
  const pid = ws.pid; if (!pid) return;
  ws.pid = null;
  const set = conns.get(pid);
  if (!set) return;
  set.delete(ws);
  if (set.size) return;
  conns.delete(pid);
  leaveQueues(pid); cancelRooms(pid); dropChallenges(pid, 'went offline');
  const g = gameOf(pid);
  if (g) {
    const c = g.w === pid ? 0 : 1;
    toAll(g, { t: 'presence', gid: g.id, online: [online(g.w), online(g.b)] });
    g.dc[c] = setTimeout(() => {
      if (g.over || online(pid)) return;
      if (g.moves.length < 2) endGame(g, 'aborted', 'aborted');
      else if (!canMate(g.pos, c ^ 1)) endGame(g, '1/2-1/2', 'abandonment');
      else endGame(g, c === 0 ? '0-1' : '1-0', 'abandonment');
    }, 60000);
  }
  broadcastStats(); notifyFriends(pid);
}
function unwatch(ws) {
  const g = games.get(ws.watching);
  ws.watching = null;
  if (g && g.spect.delete(ws)) toPlayers(g, { t: 'spect', gid: g.id, n: g.spect.size });
}

const authLimit = new Map();
function limited(key) {
  const now = Date.now(), a = (authLimit.get(key) || []).filter(t => now - t < 600000);
  a.push(now); authLimit.set(key, a);
  return a.length > 12;
}

async function handle(ws, m) {
  if (m.t === 'hello') {
    let s = typeof m.token === 'string' && db.sessions[m.token];
    if (s && !P(s.pid)) s = null;
    if (!s) {
      const p = newPlayer(rid(5), guestName());
      db.players[p.id] = p;
      ws.token = rid(24); db.sessions[ws.token] = { pid: p.id, created: Date.now() };
      save();
    } else ws.token = m.token;
    if (db.ipBans[ws.ip]) { send(ws, { t: 'banned', msg: 'Access from your network has been blocked.' }); return ws.close(); }
    const p = P(db.sessions[ws.token].pid);
    const bi = banInfo(p);
    if (bi) { send(ws, { t: 'banned', msg: bi }); return ws.close(); }
    p.lastIp = ws.ip; p.ips = [ws.ip].concat((p.ips || []).filter(x => x !== ws.ip)).slice(0, 6);
    return attach(ws, p.id);
  }
  const pid = ws.pid;
  if (!pid) return;
  const p = P(pid);
  if (!p) return;
  switch (m.t) {
    /* ----- account ----- */
    case 'signup': {
      if (!p.guest) return send(ws, { t: 'auth_error', msg: 'You already have an account.' });
      if (!db.settings.signups) return send(ws, { t: 'auth_error', msg: 'New accounts are closed right now.' });
      const u = String(m.username || '').trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return send(ws, { t: 'auth_error', msg: 'Usernames use 3 to 20 letters, numbers or underscores.' });
      if (db.names[u.toLowerCase()] || RESERVED.has(u.toLowerCase())) return send(ws, { t: 'auth_error', msg: 'That username is taken.' });
      const pw = String(m.password || '');
      if (pw.length < 6 || pw.length > 100) return send(ws, { t: 'auth_error', msg: 'Passwords need at least 6 characters.' });
      const salt = rid(16);
      p.pass = { salt, hash: await hashPw(pw, salt) };
      if (db.names[u.toLowerCase()]) return send(ws, { t: 'auth_error', msg: 'That username is taken.' });
      p.username = u; p.name = u; p.guest = false; db.names[u.toLowerCase()] = p.id;
      save(); log('[account] new account ' + u);
      return conns.get(pid).forEach(w => send(w, { t: 'auth_ok', token: w.token, me: me(p), msg: 'Account created' }));
    }
    case 'login': {
      const ip = ws.ip || 'x';
      if (limited('login:' + ip)) return send(ws, { t: 'auth_error', msg: 'Too many attempts. Try again in 10 minutes.' });
      const tid = db.names[String(m.username || '').trim().toLowerCase()];
      const t = tid && P(tid);
      if (!t || !(await checkPw(String(m.password || ''), t.pass))) return send(ws, { t: 'auth_error', msg: 'Wrong username or password.' });
      if (banInfo(t)) return send(ws, { t: 'auth_error', msg: banInfo(t) });
      if (gameOf(pid)) return send(ws, { t: 'auth_error', msg: 'Finish your current game first.' });
      unwatch(ws);
      const tok = rid(24); db.sessions[tok] = { pid: t.id, created: Date.now() };
      if (p.guest && p.ratings.blitz.games + p.ratings.bullet.games + p.ratings.rapid.games === 0) delete db.sessions[ws.token];
      ws.token = tok; save();
      detach(ws); attach(ws, t.id);
      return send(ws, { t: 'auth_ok', token: tok, me: me(t), msg: 'Welcome back, ' + t.name });
    }
    case 'logout': {
      if (gameOf(pid)) return send(ws, { t: 'auth_error', msg: 'Finish your current game first.' });
      delete db.sessions[ws.token];
      const g = newPlayer(rid(5), guestName());
      db.players[g.id] = g;
      ws.token = rid(24); db.sessions[ws.token] = { pid: g.id, created: Date.now() };
      save(); unwatch(ws); detach(ws); attach(ws, g.id);
      return send(ws, { t: 'auth_ok', token: ws.token, me: me(g), msg: 'Signed out' });
    }
    case 'password': {
      if (p.guest) return;
      if (!(await checkPw(String(m.old || ''), p.pass))) return send(ws, { t: 'auth_error', msg: 'Your current password is wrong.' });
      const pw = String(m.password || '');
      if (pw.length < 6 || pw.length > 100) return send(ws, { t: 'auth_error', msg: 'Passwords need at least 6 characters.' });
      const salt = rid(16); p.pass = { salt, hash: await hashPw(pw, salt) };
      for (const [t, s] of Object.entries(db.sessions)) if (s.pid === pid && t !== ws.token) delete db.sessions[t];
      save(); return send(ws, { t: 'info', msg: 'Password changed. Other devices were signed out.' });
    }
    case 'profile': {
      if (m.avatar && 'kqrbnp'.includes(m.avatar.p) && m.avatar.p.length === 1 && m.avatar.c >= 0 && m.avatar.c < 8) p.avatar = { p: m.avatar.p, c: m.avatar.c | 0 };
      if (p.guest && m.name) { const n = cleanText(m.name, 20); if (n.length >= 2) p.name = n; }
      if (typeof m.bio === 'string') { if (p.guest) return send(ws, { t: 'error', msg: 'Create an account to write a bio.' }); p.bio = filterText(String(m.bio).replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim().slice(0, 300), p); }
      if (typeof m.country === 'string') p.country = /^[A-Z]{2}$/.test(m.country) ? m.country : '';
      save(); conns.get(pid).forEach(w => send(w, { t: 'me', me: me(p) })); return notifyFriends(pid);
    }
    /* ----- pairing ----- */
    case 'queue': {
      if (gameOf(pid)) return send(ws, Object.assign({ t: 'start' }, gameState(gameOf(pid), pid)));
      const tc = tcInfo(m.tc); if (tc.key === 'none') return;
      { const why = canStart(p); if (why) return send(ws, { t: 'error', msg: why }); }
      leaveQueues(pid); cancelRooms(pid);
      const q = queues[tc.key] || (queues[tc.key] = []);
      const mine = p.ratings[tc.cat].r;
      let best = -1, bd = Infinity;
      q.forEach((o, i) => { if (o === pid || !online(o)) return; const d = Math.abs(P(o).ratings[tc.cat].r - mine); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) { const o = q.splice(best, 1)[0]; return createGame(o, pid, tc.key, 'r'); }
      q.push(pid);
      return sendP(pid, { t: 'queued', tc: tc.key });
    }
    case 'cancel': leaveQueues(pid); cancelRooms(pid); return sendP(pid, { t: 'idle' });
    case 'create': {
      if (gameOf(pid)) return;
      { const why = canStart(p); if (why) return send(ws, { t: 'error', msg: why }); }
      leaveQueues(pid); cancelRooms(pid);
      const tc = tcInfo(m.tc); let code;
      do { code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join(''); } while (rooms.has(code));
      rooms.set(code, { host: pid, tc: tc.key, color: ['w', 'b', 'r'].includes(m.color) ? m.color : 'r' });
      return sendP(pid, { t: 'room', code, tc: tc.key });
    }
    case 'join': {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const r = rooms.get(code);
      if (!r) return send(ws, { t: 'error', msg: 'No game with that code. It may have started or been cancelled.' });
      if (r.host === pid) return send(ws, { t: 'room', code, tc: r.tc });
      if (gameOf(pid)) return send(ws, { t: 'error', msg: 'Finish your current game first.' });
      { const why = canStart(p); if (why) return send(ws, { t: 'error', msg: why }); }
      if (!online(r.host)) { rooms.delete(code); return send(ws, { t: 'error', msg: 'Your friend is offline.' }); }
      rooms.delete(code);
      return createGame(r.host, pid, r.tc, r.color);
    }
    case 'challenge': {
      const to = m.to, t = P(to);
      if (!t || to === pid) return;
      { const why = canStart(p); if (why) return send(ws, { t: 'error', msg: why }); }
      if (!online(to)) return send(ws, { t: 'error', msg: t.name + ' is offline.' });
      if (gameOf(to)) return send(ws, { t: 'error', msg: t.name + ' is playing a game.' });
      if (gameOf(pid)) return send(ws, { t: 'error', msg: 'Finish your current game first.' });
      for (const c of challenges.values()) if (c.from === pid && c.to === to) return;
      const tc = tcInfo(m.tc), cid = rid(4), color = ['w', 'b', 'r'].includes(m.color) ? m.color : 'r';
      challenges.set(cid, { id: cid, from: pid, to, tc: tc.key, color, ts: Date.now() });
      sendP(to, { t: 'challenge_in', cid, from: pub(p, tc.cat), tc: tc.key, color });
      sendP(pid, { t: 'challenge_out', cid, to: pub(t, tc.cat), tc: tc.key });
      setTimeout(() => { if (challenges.delete(cid)) { sendP(pid, { t: 'challenge_gone', cid, reason: 'expired' }); sendP(to, { t: 'challenge_gone', cid, reason: 'expired' }); } }, 60000);
      return;
    }
    case 'challenge_reply': {
      const c = challenges.get(m.cid);
      if (!c || c.to !== pid) return;
      challenges.delete(c.id);
      if (!m.accept) { sendP(c.from, { t: 'challenge_gone', cid: c.id, reason: 'declined' }); return sendP(pid, { t: 'challenge_gone', cid: c.id, reason: 'declined' }); }
      if (!online(c.from) || gameOf(c.from)) return send(ws, { t: 'error', msg: 'That challenge is no longer available.' });
      return createGame(c.from, c.to, c.tc, c.color);
    }
    case 'challenge_cancel': {
      const c = challenges.get(m.cid);
      if (!c || c.from !== pid) return;
      challenges.delete(c.id);
      sendP(c.to, { t: 'challenge_gone', cid: c.id, reason: 'cancelled' }); return sendP(pid, { t: 'challenge_gone', cid: c.id, reason: 'cancelled' });
    }
    /* ----- in game ----- */
    case 'move': return playMove(pid, m);
    case 'resign': {
      const g = gameOf(pid); if (!g) return;
      const c = g.w === pid ? 0 : 1;
      if (g.moves.length < 2) return endGame(g, 'aborted', 'aborted');
      return endGame(g, c === 0 ? '0-1' : '1-0', 'resignation');
    }
    case 'draw_offer': {
      const g = gameOf(pid); if (!g || g.moves.length < 2) return;
      const c = g.w === pid ? 0 : 1;
      if (g.drawOffer === (c ^ 1)) return endGame(g, '1/2-1/2', 'agreement');
      if (g.drawOffer === c) return;
      g.drawOffer = c;
      sendP(c ? g.w : g.b, { t: 'draw_offer', gid: g.id });
      return sendP(pid, { t: 'info', msg: 'Draw offered' });
    }
    case 'draw_reply': {
      const g = gameOf(pid); if (!g) return;
      const c = g.w === pid ? 0 : 1;
      if (g.drawOffer !== (c ^ 1)) return;
      if (m.accept) return endGame(g, '1/2-1/2', 'agreement');
      g.drawOffer = -1; return sendP(c ? g.w : g.b, { t: 'info', msg: 'Your draw offer was declined' });
    }
    case 'chat': {
      const g = games.get(m.gid); if (!g || (g.w !== pid && g.b !== pid)) return;
      if (!db.settings.chat) return send(ws, { t: 'info', msg: 'Chat is turned off on this server.' });
      if (isMuted(p)) return send(ws, { t: 'info', msg: 'Chat is turned off for your account' + (p.muteUntil ? ' until ' + new Date(p.muteUntil).toUTCString().replace(' GMT', ' UTC') : '') + '.' });
      const t = Date.now(); if (t - (ws.lastChat || 0) < 600) return; ws.lastChat = t;
      let text = cleanText(m.text, 200); if (!text) return;
      text = filterText(text, p);
      const msg = { from: g.w === pid ? 0 : 1, name: p.name, text, ts: t };
      g.chat.push(msg); if (g.chat.length > 200) g.chat.shift();
      chatLog.push({ ts: t, gid: g.id, pid, name: p.name, text }); if (chatLog.length > 400) chatLog.shift();
      return toPlayers(g, Object.assign({ t: 'chat', gid: g.id }, msg));
    }
    case 'rematch': {
      const g = games.get(m.gid);
      if (!g || !g.over || (g.w !== pid && g.b !== pid) || gameOf(pid)) return;
      g.rematch[pid] = true;
      const o = g.w === pid ? g.b : g.w;
      if (!g.rematch[o]) return sendP(o, { t: 'rematch_offer', gid: g.id });
      if (!online(o) || gameOf(o)) return send(ws, { t: 'error', msg: 'Your opponent left.' });
      g.rematch = {};
      return createGame(g.b, g.w, g.tc.key, 'w');
    }
    case 'report': {
      const g = games.get(m.gid) || null; const r = records.get(m.gid);
      const other = g ? (g.w === pid ? g.b : g.w) : r ? (r.w.id === pid ? r.b.id : r.w.id) : null;
      if (!other || db.reports.some(x => x.gid === m.gid && x.by === pid)) return send(ws, { t: 'info', msg: 'Report sent. Thank you.' });
      db.reports.push({ id: rid(4), ts: Date.now(), by: pid, byName: p.name, who: other, whoName: P(other) ? P(other).name : '?', gid: m.gid,
        reason: cleanText(m.reason, 60) || 'Chat', chat: g ? g.chat.slice(-30) : [], open: true });
      if (db.reports.length > 300) db.reports.shift();
      save(); return send(ws, { t: 'info', msg: 'Report sent. Thank you.' });
    }
    case 'sync': {
      const g = gameOf(pid) || games.get(activeOf.get(pid));
      if (g) send(ws, Object.assign({ t: 'start' }, gameState(g, pid)));
      return;
    }
    /* ----- spectating ----- */
    case 'live': return send(ws, { t: 'live', games: liveList().slice(0, 40), online: conns.size });
    case 'watch': {
      const g = games.get(m.gid);
      if (!g) return send(ws, { t: 'error', msg: 'That game has ended.' });
      if (g.w === pid || g.b === pid) return send(ws, Object.assign({ t: 'start' }, gameState(g, pid)));
      unwatch(ws); ws.watching = g.id; g.spect.add(ws);
      toPlayers(g, { t: 'spect', gid: g.id, n: g.spect.size });
      return send(ws, Object.assign({ t: 'watch' }, gameState(g, null)));
    }
    case 'unwatch': return unwatch(ws);
    /* ----- social ----- */
    case 'friends': return send(ws, friendsPayload(p));
    case 'friend_add': {
      if (p.guest) return send(ws, { t: 'error', msg: 'Create an account to add friends.' });
      const tid = m.id || db.names[String(m.username || '').trim().toLowerCase()];
      const t = tid && P(tid);
      if (!t || t.guest) return send(ws, { t: 'error', msg: 'No player with that username.' });
      if (t.id === pid || p.friends.includes(t.id)) return;
      if (p.reqIn.includes(t.id)) { // they already asked: accept
        p.reqIn = p.reqIn.filter(x => x !== t.id); t.reqOut = t.reqOut.filter(x => x !== pid);
        p.friends.push(t.id); t.friends.push(pid); checkAch(p); checkAch(t);
        save(); sendP(t.id, friendsPayload(t)); sendP(t.id, { t: 'info', msg: p.name + ' accepted your friend request' });
        return sendP(pid, friendsPayload(p));
      }
      if (p.reqOut.includes(t.id)) return;
      p.reqOut.push(t.id); t.reqIn.push(pid);
      save(); sendP(t.id, friendsPayload(t)); sendP(t.id, { t: 'friend_request', from: pub(p, 'blitz') });
      sendP(pid, friendsPayload(p));
      return send(ws, { t: 'info', msg: 'Friend request sent to ' + t.name });
    }
    case 'friend_accept':
    case 'friend_decline': {
      const t = P(m.id); if (!t || !p.reqIn.includes(t.id)) return;
      p.reqIn = p.reqIn.filter(x => x !== t.id); t.reqOut = t.reqOut.filter(x => x !== pid);
      if (m.t === 'friend_accept') { p.friends.push(t.id); t.friends.push(pid); checkAch(p); checkAch(t); sendP(t.id, { t: 'info', msg: p.name + ' accepted your friend request' }); }
      save(); sendP(t.id, friendsPayload(t)); return sendP(pid, friendsPayload(p));
    }
    case 'friend_remove': {
      const t = P(m.id); if (!t) return;
      p.friends = p.friends.filter(x => x !== t.id); t.friends = t.friends.filter(x => x !== pid);
      p.reqOut = p.reqOut.filter(x => x !== t.id); t.reqIn = t.reqIn.filter(x => x !== pid);
      save(); sendP(t.id, friendsPayload(t)); return sendP(pid, friendsPayload(p));
    }
    case 'leaderboard': return send(ws, { t: 'leaderboard', cat: CATS.includes(m.cat) ? m.cat : 'blitz', rows: leaderboard(m.cat) });
    /* ----- profiles ----- */
    case 'openings': {
      const tid = m.id || pid, ids = (byPlayer.get(tid) || []).slice(-300);
      return send(ws, { t: 'openings', id: tid, games: ids.map(id => { const r = records.get(id); if (!r) return null; const c = r.w.id === tid ? 0 : 1; const sc = r.result === '1/2-1/2' ? 0.5 : ((r.result === '1-0') === (c === 0) ? 1 : 0); return [r.moves.slice(0, 16), c, sc]; }).filter(Boolean) });
    }
    case 'ach_list': return send(ws, { t: 'ach_list', list: ACH });
    /* ----- private messages ----- */
    case 'dm_list': return send(ws, { t: 'dm_list', list: dmList(pid), unread: dmUnread(pid) });
    case 'dm_open': {
      const o = P(m.id); if (!o) return;
      const c = db.dms[dmKey(pid, o.id)];
      if (c) { (c.read || (c.read = {}))[pid] = Date.now(); save(); }
      send(ws, { t: 'dm_thread', id: o.id, who: pub(o, 'blitz'), online: online(o.id), friend: p.friends.includes(o.id), msgs: c ? c.msgs.slice(-150) : [] });
      return conns.get(pid).forEach(w => send(w, { t: 'dm_unread', n: dmUnread(pid) }));
    }
    case 'dm_send': {
      const o = P(m.to); if (!o || o.id === pid) return;
      if (p.guest) return send(ws, { t: 'error', msg: 'Create an account to send messages.' });
      if (!p.friends.includes(o.id)) return send(ws, { t: 'error', msg: 'You can message friends only.' });
      if (isMuted(p)) return send(ws, { t: 'error', msg: 'Messages are turned off for your account.' });
      const t = Date.now(); if (t - (ws.lastDm || 0) < 500) return; ws.lastDm = t;
      let text = String(m.text || '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim().slice(0, 1000); if (!text) return;
      text = filterText(text, p);
      const k = dmKey(pid, o.id), c = db.dms[k] || (db.dms[k] = { a: pid, b: o.id, msgs: [], read: {} });
      const msg = { f: pid, t: text, ts: t }; c.msgs.push(msg); if (c.msgs.length > 400) c.msgs.splice(0, c.msgs.length - 400);
      c.read[pid] = t; save();
      sendP(pid, { t: 'dm', with: o.id, msg });
      sendP(o.id, { t: 'dm', with: pid, from: pub(p, 'blitz'), msg });
      return sendP(o.id, { t: 'dm_unread', n: dmUnread(o.id) });
    }
    /* ----- daily games ----- */
    case 'daily_list': return sendDailyList(pid);
    case 'daily_open': { const g = db.daily[m.gid]; if (!g) return send(ws, { t: 'error', msg: 'That daily game no longer exists.' }); return send(ws, { t: 'daily_update', game: dailyView(g, pid), open: true }); }
    case 'daily_move': return dailyMove(pid, m);
    case 'daily_resign': { const g = db.daily[m.gid]; if (!g || g.over || (g.w !== pid && g.b !== pid)) return; if (g.moves.length < 2) return endDaily(g, 'aborted', 'aborted'); return endDaily(g, g.w === pid ? '0-1' : '1-0', 'resignation'); }
    case 'daily_draw': {
      const g = db.daily[m.gid]; if (!g || g.over || (g.w !== pid && g.b !== pid) || g.moves.length < 2) return;
      const c = g.w === pid ? 0 : 1;
      if (g.drawOffer === (c ^ 1)) return endDaily(g, '1/2-1/2', 'agreement');
      if (m.decline) { if (g.drawOffer === (c ^ 1)) g.drawOffer = null; }
      else g.drawOffer = c;
      save(); return [g.w, g.b].forEach(x => sendP(x, { t: 'daily_update', game: dailyView(g, x) }));
    }
    case 'daily_draw_decline': { const g = db.daily[m.gid]; if (!g || g.over) return; g.drawOffer = null; save(); return [g.w, g.b].forEach(x => sendP(x, { t: 'daily_update', game: dailyView(g, x) })); }
    case 'daily_invite': {
      if (p.guest) return send(ws, { t: 'error', msg: 'Create an account to play daily games.' });
      { const why = canStart(p); if (why) return send(ws, { t: 'error', msg: why }); }
      const o = P(m.to); if (!o || o.guest || o.id === pid) return;
      if (dailyGamesOf(pid).filter(g => !g.over).length >= 20) return send(ws, { t: 'error', msg: 'You can have up to 20 daily games at once.' });
      const days = DAILY_DAYS.includes(+m.days) ? +m.days : 3, id = rid(4);
      db.dailyInvites[id] = { id, from: pid, to: o.id, days, color: ['w', 'b', 'r'].includes(m.color) ? m.color : 'r', ts: Date.now() }; save();
      sendDailyList(pid); sendDailyList(o.id);
      sendP(o.id, { t: 'info', msg: p.name + ' invited you to a daily game' });
      return send(ws, { t: 'info', msg: 'Invitation sent to ' + o.name });
    }
    case 'daily_invite_reply': {
      const i = db.dailyInvites[m.id]; if (!i || (i.to !== pid && i.from !== pid)) return;
      delete db.dailyInvites[i.id]; save();
      if (m.accept && i.to === pid && P(i.from)) createDaily(i.from, i.to, i.days, i.color);
      else { sendDailyList(i.from); sendDailyList(i.to); }
      return;
    }
    case 'daily_seek': {
      if (p.guest) return send(ws, { t: 'error', msg: 'Create an account to play daily games.' });
      { const why = canStart(p); if (why) return send(ws, { t: 'error', msg: why }); }
      if (Object.values(db.dailySeeks).filter(x => x.by === pid).length >= 3) return send(ws, { t: 'error', msg: 'You already have 3 open daily games waiting.' });
      const id = rid(4); db.dailySeeks[id] = { id, by: pid, days: DAILY_DAYS.includes(+m.days) ? +m.days : 3, color: ['w', 'b', 'r'].includes(m.color) ? m.color : 'r', ts: Date.now() }; save();
      return sendDailyList(pid);
    }
    case 'daily_seek_cancel': { const x = db.dailySeeks[m.id]; if (x && x.by === pid) { delete db.dailySeeks[m.id]; save(); } return sendDailyList(pid); }
    case 'daily_seek_accept': {
      if (p.guest) return send(ws, { t: 'error', msg: 'Create an account to play daily games.' });
      const x = db.dailySeeks[m.id]; if (!x || x.by === pid || !P(x.by)) return send(ws, { t: 'error', msg: 'That game was already taken.' });
      delete db.dailySeeks[x.id]; save();
      return createDaily(x.by, pid, x.days, x.color);
    }
    case 'search': {
      const q = String(m.q || '').trim().toLowerCase(); if (q.length < 2) return send(ws, { t: 'search', rows: [] });
      const rows = Object.values(db.players).filter(x => !x.guest && !x.banned && x.name.toLowerCase().includes(q)).slice(0, 12)
        .map(x => ({ id: x.id, name: x.name, avatar: x.avatar, rating: x.ratings.blitz.r, online: online(x.id) }));
      return send(ws, { t: 'search', rows });
    }
    case 'player': {
      const t = P(m.id) || P(db.names[String(m.username || '').toLowerCase()]);
      if (!t) return send(ws, { t: 'error', msg: 'Player not found.' });
      const ids = (byPlayer.get(t.id) || []).slice(-12).reverse();
      return send(ws, { t: 'player', player: { id: t.id, name: t.name, guest: t.guest, avatar: t.avatar, title: t.title || null, ratings: t.ratings, created: t.created, seen: t.seen,
        status: status(t.id), gid: gameOf(t.id) ? activeOf.get(t.id) : null, puzzle: t.puzzle.r,
        friend: p.friends.includes(t.id) ? 'yes' : p.reqOut.includes(t.id) ? 'sent' : p.reqIn.includes(t.id) ? 'incoming' : 'no',
        games: ids.map(id => summary(records.get(id), t.id)), hist: t.hist.slice(-300),
        bio: t.bio || '', country: t.country || '', role: t.role || '', ach: t.ach || {}, streak: t.streak || 0, bestStreak: t.bestStreak || 0 } });
    }
    case 'history': {
      const tid = m.id || pid, all = byPlayer.get(tid) || [];
      let end = all.length; if (m.before) { const i = all.indexOf(m.before); if (i >= 0) end = i; }
      const ids = all.slice(Math.max(0, end - 20), end).reverse();
      return send(ws, { t: 'history', id: tid, games: ids.map(id => summary(records.get(id), tid)), more: end - 20 > 0 });
    }
    case 'game': {
      const r = records.get(m.id);
      if (!r) return send(ws, { t: 'error', msg: 'Game not found.' });
      return send(ws, { t: 'game', game: r });
    }
    /* ----- puzzles ----- */
    case 'puzzle_result': {
      const pz = puzzles.get(String(m.id || ''));
      if (!pz || p.puzzle.recent.includes(pz.id)) return send(ws, { t: 'puzzle_rating', r: p.puzzle.r, d: 0 });
      const exp = 1 / (1 + Math.pow(10, (pz.rating - p.puzzle.r) / 400)), k = p.puzzle.solved + p.puzzle.failed < 20 ? 40 : 22;
      const before = p.puzzle.r;
      p.puzzle.r = Math.max(100, Math.round(p.puzzle.r + k * ((m.win ? 1 : 0) - exp)));
      if (m.win) { p.puzzle.solved++; p.puzzle.streak++; p.puzzle.best = Math.max(p.puzzle.best, p.puzzle.streak); }
      else { p.puzzle.failed++; p.puzzle.streak = 0; }
      p.puzzle.recent.push(pz.id); if (p.puzzle.recent.length > 400) p.puzzle.recent.shift();
      p.hist.push([Date.now(), 'puzzle', p.puzzle.r]); if (p.hist.length > 1500) p.hist.shift();
      checkAch(p); save();
      send(ws, { t: 'puzzle_rating', r: p.puzzle.r, d: p.puzzle.r - before });
      return conns.get(pid).forEach(w => send(w, { t: 'me', me: me(p) }));
    }
    case 'puzzle_seen': { const r = p.puzzle.recent; return send(ws, { t: 'puzzle_seen', ids: r.slice(-200) }); }
  }
}

/* ================= HTTP ================= */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const zcache = new Map();
function serveFile(req, res, f, extraHead) {
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(f), type = MIME[ext] || 'application/octet-stream';
    const head = Object.assign({ 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }, extraHead || {});
    if (!head['Cache-Control']) head['Cache-Control'] = ext === '.wasm' || f.includes(path.sep + 'icons' + path.sep) ? 'public, max-age=2592000' : 'no-cache';
    const gz = /gzip/.test(req.headers['accept-encoding'] || '') && /text|json|javascript|svg|manifest|wasm/.test(type) && st.size > 1024;
    if (!gz) { res.writeHead(200, Object.assign(head, { 'Content-Length': st.size })); return fs.createReadStream(f).pipe(res); }
    const key = f + ':' + st.mtimeMs;
    const hit = zcache.get(f);
    const done = buf => { res.writeHead(200, Object.assign(head, { 'Content-Encoding': 'gzip', 'Content-Length': buf.length, Vary: 'Accept-Encoding' })); res.end(buf); };
    if (hit && hit.key === key) return done(hit.buf);
    fs.readFile(f, (e2, raw) => {
      if (e2) { res.writeHead(500); return res.end(); }
      zlib.gzip(raw, { level: 6 }, (e3, buf) => { if (e3) { res.writeHead(200, head); return res.end(raw); } zcache.set(f, { key, buf }); done(buf); });
    });
  });
}
function json(res, code, o) { const b = JSON.stringify(o); res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(b); }
function body(req) {
  return new Promise(resolve => {
    let s = ''; req.on('data', c => { s += c; if (s.length > 20000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { resolve({}); } });
  });
}
const ipOf = req => String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

/* ----- admin ----- */
const ADMINF = path.join(DATA, 'admin.json');
let admin = null;
try { admin = JSON.parse(fs.readFileSync(ADMINF, 'utf8')); } catch (e) {}
const adminTokens = new Map();
async function ensureAdmin() {
  if (admin) return;
  const pw = Array.from({ length: 4 }, () => rid(2)).join('-');
  const salt = rid(16);
  admin = { salt, hash: await hashPw(pw, salt) };
  fs.writeFileSync(ADMINF, JSON.stringify(admin));
  fs.writeFileSync(path.join(DATA, 'ADMIN-PASSWORD.txt'), 'Rookery admin password: ' + pw + '\r\nOpen /admin on your Rookery link and sign in with it. You can change it from the dashboard.\r\n');
  log('[admin] admin password created in data\\ADMIN-PASSWORD.txt');
}
const sys = { samples: [], last: null, started: Date.now() };
function cpuTimes() { let idle = 0, total = 0; os.cpus().forEach(c => { for (const k in c.times) total += c.times[k]; idle += c.times.idle; }); return { idle, total }; }
function sample() {
  const now = cpuTimes();
  let cpu = 0;
  if (sys.last) { const di = now.idle - sys.last.idle, dt = now.total - sys.last.total; cpu = dt > 0 ? Math.round((1 - di / dt) * 1000) / 10 : 0; }
  sys.last = now;
  sys.samples.push({ ts: Date.now(), cpu, mem: Math.round((1 - os.freemem() / os.totalmem()) * 1000) / 10, rss: Math.round(process.memoryUsage().rss / 1048576), online: conns.size });
  if (sys.samples.length > 360) sys.samples.shift();
}
sample(); setInterval(sample, 10000);
function drives() {
  const out = [];
  if (process.platform === 'win32') {
    for (const L of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
      try { const s = fs.statfsSync(L + ':\\'); if (s.blocks > 0) out.push({ name: L + ':', total: s.blocks * s.bsize, free: s.bavail * s.bsize, system: L === 'C', here: ROOT[0].toUpperCase() === L }); } catch (e) {}
    }
  } else {
    try { const s = fs.statfsSync(ROOT); out.push({ name: '/', total: s.blocks * s.bsize, free: s.bavail * s.bsize, system: true, here: true }); } catch (e) {}
  }
  return out;
}
function disk() {
  const d = drives(); if (!d.length) return null;
  return { total: d.reduce((a, x) => a + x.total, 0), free: d.reduce((a, x) => a + x.free, 0), list: d };
}
/* ----- automatic backups ----- */
db.backup = db.backup || { dir: null, keep: 14, last: null, lastFile: null, error: null };
function backupDir() {
  if (db.backup.dir) return db.backup.dir;
  const other = drives().filter(d => !d.system && process.platform === 'win32');
  return other.length ? other[0].name + '\\Rookery-backups' : path.join(DATA, 'backups');
}
function runBackup() {
  const dir = backupDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    const name = 'rookery-backup-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
    fs.writeFileSync(path.join(dir, name), JSON.stringify({ exported: new Date().toISOString(), version: VERSION, db, games: [...records.values()] }));
    const old = fs.readdirSync(dir).filter(f => /^rookery-backup-.*\.json$/.test(f)).sort();
    while (old.length > (db.backup.keep || 14)) { try { fs.unlinkSync(path.join(dir, old.shift())); } catch (e) {} }
    db.backup.last = Date.now(); db.backup.lastFile = path.join(dir, name); db.backup.error = null;
    log('[backup] saved ' + db.backup.lastFile);
  } catch (e) { db.backup.error = e.message; db.backup.lastTry = Date.now(); log('[backup] failed: ' + e.message); }
  save();
}
setInterval(() => { if (!db.backup.last || Date.now() - db.backup.last > 24 * 3600e3) { if (!db.backup.lastTry || Date.now() - db.backup.lastTry > 3600e3) runBackup(); } }, 10 * 60000);
setTimeout(() => { if (!db.backup.last || Date.now() - db.backup.last > 24 * 3600e3) runBackup(); }, 30000);
function overview(isMod) {
  let playing = 0, spect = 0; games.forEach(g => { if (!g.over) { playing++; spect += g.spect.size; } });
  const all = Object.values(db.players), today = new Date(); today.setHours(0, 0, 0, 0);
  let gamesToday = 0; records.forEach(r => { if (r.end >= today.getTime()) gamesToday++; });
  const queued = Object.values(queues).reduce((s, q) => s + q.length, 0);
  return {
    version: VERSION, node: process.version, platform: os.platform() + ' ' + os.release(), host: os.hostname(), cpuModel: (os.cpus()[0] || {}).model,
    cores: os.cpus().length, memTotal: os.totalmem(), memFree: os.freemem(), rss: process.memoryUsage().rss, disk: disk(),
    uptime: os.uptime(), procUptime: process.uptime(), samples: sys.samples,
    counts: { online: conns.size, playing, spect, queued, accounts: all.filter(p => !p.guest).length, guests: all.filter(p => p.guest).length,
      games: records.size, gamesToday, banned: all.filter(p => p.banned).length, reports: db.reports.filter(r => r.open).length },
    puzzles: puzzles.info(), live: liveList(), recent: [...records.values()].slice(-12).reverse().map(r => ({ id: r.id, end: r.end, tc: r.tc, result: r.result, reason: r.reason, w: r.w.name, b: r.b.name, n: r.moves.length })),
    reports: db.reports.filter(r => r.open).slice(-50).reverse(), announce: db.announce,
    settings: db.settings, ipBans: isMod ? [] : Object.entries(db.ipBans).map(([ip, v]) => Object.assign({ ip }, v)),
    audit: db.audit.slice(-80).reverse(), chat: chatLog.slice(-120).reverse(), activity: activity(),
    titles: all.filter(p => p.title).length, updater: updaterInfo(), backup: Object.assign({ folder: backupDir() }, db.backup),
    upt: uptimeSummary(), staff: all.filter(p => p.role).map(p => ({ id: p.id, name: p.name, role: p.role, online: online(p.id) })),
    filter: db.filter, dailyCount: Object.values(db.daily).filter(g => !g.over).length, dmCount: Object.keys(db.dms).length, achList: ACH
  };
}
function updaterInfo() {
  let st = null; try { st = JSON.parse(fs.readFileSync(path.join(DATA, 'updater-state.json'), 'utf8')); } catch (e) {}
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'updater.json'), 'utf8')); } catch (e) {}
  return st ? Object.assign({ repo: cfg.repo || 'Lvxz-viper/rookery', running: Date.now() - (st.lastCheck || 0) < 11 * 60000 }, st) : null;
}
function activity() {
  const days = [], d0 = new Date(); d0.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) days.push({ day: d0.getTime() - i * 864e5, games: 0, signups: 0 });
  const first = days[0].day;
  records.forEach(r => { if (r.end >= first) { const k = Math.floor((r.end - first) / 864e5); if (days[k]) days[k].games++; } });
  Object.values(db.players).forEach(p => { if (!p.guest && p.created >= first) { const k = Math.floor((p.created - first) / 864e5); if (days[k]) days[k].signups++; } });
  return days;
}
function adminPlayer(id) {
  const p = P(id); if (!p) return null;
  const ids = (byPlayer.get(p.id) || []).slice(-25).reverse();
  return { id: p.id, name: p.name, username: p.username, guest: p.guest, title: p.title || null, avatar: p.avatar, ratings: p.ratings, puzzle: p.puzzle.r,
    created: p.created, seen: p.seen, online: online(p.id), playing: gameOf(p.id) ? activeOf.get(p.id) : null, banned: p.banned, banUntil: p.banUntil || null,
    banReason: p.banReason || null, muted: p.muted, lastIp: p.lastIp || null, ips: p.ips || [], sessions: Object.values(db.sessions).filter(s => s.pid === p.id).length,
    friends: p.friends.map(f => P(f) ? P(f).name : '?'), games: ids.map(gid => summary(records.get(gid), p.id)),
    reports: db.reports.filter(r => r.who === p.id).length, puzzleStats: { r: p.puzzle.r, solved: p.puzzle.solved, failed: p.puzzle.failed, streak: p.puzzle.streak, best: p.puzzle.best },
    bio: p.bio || '', country: p.country || '', role: p.role || '', ach: p.ach || {}, streak: p.streak || 0, bestStreak: p.bestStreak || 0, muteUntil: p.muteUntil || null,
    strikes: p.strikes || 0, device: p.device || null, hist: p.hist.slice(-200), daily: dailyGamesOf(p.id).filter(g => !g.over).length,
    linked: Object.values(db.players).filter(o => o.id !== p.id && p.lastIp && (o.ips || []).includes(p.lastIp)).slice(0, 12).map(o => ({ id: o.id, name: o.name, guest: o.guest })) };
}
function adminGames(q) {
  q = String(q || '').toLowerCase();
  const out = [];
  const all = [...records.values()];
  for (let i = all.length - 1; i >= 0 && out.length < 80; i--) {
    const r = all[i];
    if (q && !r.w.name.toLowerCase().includes(q) && !r.b.name.toLowerCase().includes(q) && r.id !== q) continue;
    out.push({ id: r.id, end: r.end, tc: r.tc, rated: r.rated, result: r.result, reason: r.reason, w: r.w, b: r.b, n: r.moves.length });
  }
  return out;
}
function rewriteGames() { const tmp = GAMESF + '.tmp'; fs.writeFileSync(tmp, [...records.values()].map(r => JSON.stringify(r)).join('\n') + (records.size ? '\n' : '')); fs.renameSync(tmp, GAMESF); }
function adminPlayers(q, opt) {
  q = String(q || '').toLowerCase(); opt = opt || {};
  const kind = opt.kind || 'all', sort = opt.sort || 'seen';
  let list = Object.values(db.players).filter(p => !q || p.name.toLowerCase().includes(q) || p.id === q || (p.lastIp || '') === q);
  if (kind === 'accounts') list = list.filter(p => !p.guest); else if (kind === 'guests') list = list.filter(p => p.guest);
  else if (kind === 'online') list = list.filter(p => online(p.id)); else if (kind === 'banned') list = list.filter(p => p.banned);
  else if (kind === 'staff') list = list.filter(p => p.role); else if (kind === 'muted') list = list.filter(p => isMuted(p));
  const total = (p) => CATS.reduce((s2, c) => s2 + p.ratings[c].games, 0);
  const sorters = { seen: (a, b) => (b.seen || 0) - (a.seen || 0), created: (a, b) => b.created - a.created, name: (a, b) => a.name.localeCompare(b.name),
    blitz: (a, b) => b.ratings.blitz.r - a.ratings.blitz.r, games: (a, b) => total(b) - total(a) };
  list.sort(sorters[sort] || sorters.seen);
  const count = list.length, off = Math.max(0, +opt.offset || 0), lim = Math.min(500, Math.max(1, +opt.limit || 100));
  const rows = list.slice(off, off + lim)
    .map(p => ({ id: p.id, name: p.name, guest: p.guest, title: p.title || null, online: online(p.id), playing: !!gameOf(p.id), banned: p.banned, banUntil: p.banUntil || null, muted: p.muted, lastIp: p.lastIp || null,
      ratings: { bullet: p.ratings.bullet.r, blitz: p.ratings.blitz.r, rapid: p.ratings.rapid.r }, puzzle: p.puzzle.r,
      games: CATS.reduce((s, c) => s + p.ratings[c].games, 0), created: p.created, seen: p.seen, friends: p.friends.length,
      role: p.role || '', country: p.country || '', daily: p.ratings.daily.r, wins: CATS.reduce((s, c) => s + p.ratings[c].w, 0), ach: Object.keys(p.ach || {}).length }));
  return { rows, count };
}
/* ----- full account editor ----- */
function editPlayer(p, d) {
  const num = (v, lo, hi) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };
  if (d.name != null && d.name !== p.name) {
    const u = String(d.name).trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return 'Names use 3 to 20 letters, numbers or underscores';
    const owner = db.names[u.toLowerCase()]; if (owner && owner !== p.id) return 'That name is taken';
    if (p.username) delete db.names[p.username.toLowerCase()];
    if (!p.guest) { p.username = u; db.names[u.toLowerCase()] = p.id; }
    p.name = u;
  }
  if (d.title != null) p.title = cleanText(d.title, 16) || null;
  if (d.bio != null) p.bio = String(d.bio).replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim().slice(0, 300);
  if (d.country != null) p.country = /^[A-Z]{2}$/.test(d.country) ? d.country : '';
  if (d.avatar && 'kqrbnp'.includes(d.avatar.p) && d.avatar.p.length === 1 && d.avatar.c >= 0 && d.avatar.c < 8) p.avatar = { p: d.avatar.p, c: d.avatar.c | 0 };
  if (d.created) { const t = Date.parse(d.created); if (t && t < Date.now() + 864e5) p.created = t; }
  if (d.ratings) for (const c of CATS) {
    const x = d.ratings[c]; if (!x) continue; const r = p.ratings[c], old = r.r;
    ['r', 'peak'].forEach(k => { if (x[k] != null) { const v = num(x[k], 100, 3500); if (v != null) r[k] = v; } });
    ['games', 'w', 'l', 'd'].forEach(k => { if (x[k] != null) { const v = num(x[k], 0, 1e6); if (v != null) r[k] = v; } });
    if (x.w != null || x.l != null || x.d != null) r.games = Math.max(r.games, r.w + r.l + r.d);
    r.peak = Math.max(r.peak, r.r);
    if (r.r !== old) p.hist.push([Date.now(), c, r.r]);
  }
  if (d.puzzle) { const z = p.puzzle, x = d.puzzle;
    ['solved', 'failed', 'streak', 'best'].forEach(k => { if (x[k] != null) { const v = num(x[k], 0, 1e6); if (v != null) z[k] = v; } });
    if (x.r != null) { const v = num(x.r, 100, 3500); if (v != null && v !== z.r) { z.r = v; p.hist.push([Date.now(), 'puzzle', v]); } }
    z.best = Math.max(z.best, z.streak); }
  if (d.streak != null) { const v = num(d.streak, 0, 10000); if (v != null) p.streak = v; }
  if (d.bestStreak != null) { const v = num(d.bestStreak, 0, 10000); if (v != null) p.bestStreak = v; }
  p.bestStreak = Math.max(p.bestStreak || 0, p.streak || 0);
  if (Array.isArray(d.ach)) { const keep = {}; d.ach.forEach(id => { if (ACH_IDS.has(id)) keep[id] = (p.ach && p.ach[id]) || Date.now(); }); p.ach = keep; }
  return null;
}
function backupList() {
  const dir = backupDir(); let files = [];
  try { files = fs.readdirSync(dir).filter(f => /^rookery-backup-.*\.json$/.test(f)).map(f => { const st = fs.statSync(path.join(dir, f)); return { file: f, size: st.size, ts: st.mtimeMs }; }); } catch (e) {}
  return { dir, files: files.sort((a, b) => b.ts - a.ts) };
}
function analytics() {
  const now = Date.now(), heat = Array.from({ length: 7 }, () => Array(24).fill(0)), tcs = {}, reasons = {}, res = { w: 0, b: 0, d: 0 };
  let plies = 0, n = 0;
  records.forEach(r => {
    if (now - r.end < 90 * 864e5) { const d = new Date(r.end); heat[d.getDay()][d.getHours()]++; }
    tcs[r.tc] = (tcs[r.tc] || 0) + 1; reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    if (r.result === '1-0') res.w++; else if (r.result === '0-1') res.b++; else res.d++;
    plies += r.moves.length; n++;
  });
  const acc = Object.values(db.players).filter(p => !p.guest);
  const old = acc.filter(p => now - p.created > 2 * 864e5), back = old.filter(p => (p.seen || 0) - p.created > 864e5);
  const recent = Object.values(db.players).filter(p => now - (p.seen || 0) < 30 * 864e5);
  const dev = { phone: 0, computer: 0 }; recent.forEach(p => { if (p.device) dev[p.device]++; });
  const days = []; for (let i = 29; i >= 0; i--) { const k = dayKey(now - i * 864e5); days.push({ day: k, active: db.stats.dau[k] || 0, peak: db.stats.peak[k] || 0 }); }
  const total = p => CATS.reduce((s2, c) => s2 + p.ratings[c].games, 0);
  const top = acc.slice().sort((a, b) => total(b) - total(a)).slice(0, 8).map(p => ({ id: p.id, name: p.name, games: total(p) }));
  const pz = acc.reduce((a, p) => a + p.puzzle.solved, 0);
  return { heat, tcs, reasons, res, avgMoves: n ? Math.round(plies / n / 2) : 0, retention: old.length ? Math.round(back.length / old.length * 100) : null, retentionBase: old.length,
    devices: dev, days, top, puzzlesSolved: pz, achievements: acc.reduce((a, p) => a + Object.keys(p.ach || {}).length, 0) };
}
async function adminMore(route, req, res, b, ip, role, aud) {
  const owner = role === 'owner';
  if (route === 'analytics') return json(res, 200, analytics());
  if (route === 'logs') return json(res, 200, { lines: logBuf.slice(-500) });
  if (route === 'backups') return json(res, 200, backupList());
  if (route === 'gameedit') {
    const r = records.get(b.id); if (!r) return json(res, 404, { error: 'Game not found' });
    if (!['1-0', '0-1', '1/2-1/2'].includes(b.result)) return json(res, 400, { error: 'Pick a result' });
    r.result = b.result; r.reason = cleanText(b.reason, 40) || r.reason; r.edited = Date.now();
    rewriteGames(); aud(ip, 'edit game', r.w.name + ' vs ' + r.b.name + ' ' + r.result);
    return json(res, 200, { ok: true });
  }
  if (route === 'filter') {
    if (Array.isArray(b.words)) db.filter.words = [...new Set(b.words.map(w => String(w).trim().slice(0, 40)).filter(Boolean))].slice(0, 500);
    if (b.enabled != null) db.filter.enabled = !!b.enabled;
    if (b.strikes != null) db.filter.strikes = Math.max(0, Math.min(50, +b.strikes | 0));
    if (b.muteHours != null) db.filter.muteHours = Math.max(1, Math.min(24 * 90, +b.muteHours | 0));
    save(); aud(ip, 'word filter', db.filter.words.length + ' words, ' + (db.filter.enabled ? 'on' : 'off'));
    return json(res, 200, { ok: true });
  }
  if (route === 'broadcast') {
    const text = cleanText(b.text, 300); if (!text) return json(res, 400, { error: 'Write a message first' });
    const m = JSON.stringify({ t: 'admin_msg', text }); let n = 0; conns.forEach(st => { n++; st.forEach(ws => send(ws, m)); });
    aud(ip, 'message everyone', text); return json(res, 200, { ok: true, n });
  }
  if (route === 'createaccount') {
    const u = String(b.username || '').trim(), pw = String(b.password || '');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return json(res, 400, { error: 'Usernames use 3 to 20 letters, numbers or underscores' });
    if (db.names[u.toLowerCase()]) return json(res, 400, { error: 'That username is taken' });
    if (pw.length < 6) return json(res, 400, { error: 'Passwords need at least 6 characters' });
    const p = newPlayer(rid(5), u); p.guest = false; p.username = u; const salt = rid(16); p.pass = { salt, hash: await hashPw(pw, salt) };
    db.players[p.id] = p; db.names[u.toLowerCase()] = p.id; save(); aud(ip, 'create account', u);
    return json(res, 200, { ok: true, id: p.id });
  }
  if (route === 'cleanguests') {
    let n = 0; const cut = Date.now() - (+b.days || 7) * 864e5;
    for (const p of Object.values(db.players)) if (p.guest && !online(p.id) && (p.seen || 0) < cut && CATS.every(c => !p.ratings[c].games)) { delete db.players[p.id]; n++; }
    for (const [t, x] of Object.entries(db.sessions)) if (!db.players[x.pid]) delete db.sessions[t];
    save(); aud(ip, 'remove guests', n + ' removed'); return json(res, 200, { ok: true, n });
  }
  if (route === 'restore') {
    if (!owner) return json(res, 403, { error: 'Only the owner can restore a backup' });
    const name = String(b.file || ''); if (!/^rookery-backup-[\w-]+\.json$/.test(name)) return json(res, 400, { error: 'Pick a backup from the list' });
    let data; try { data = JSON.parse(fs.readFileSync(path.join(backupDir(), name), 'utf8')); } catch (e) { return json(res, 400, { error: 'That backup cannot be read: ' + e.message }); }
    if (!data || !data.db || !data.db.players) return json(res, 400, { error: 'That file is not a Rookery backup' });
    runBackup();
    db = data.db; records.clear(); byPlayer.clear(); (data.games || []).forEach(indexRecord); rewriteGames();
    try { fs.writeFileSync(DBF, JSON.stringify(db)); } catch (e) {}
    log('[backup] restored ' + name); audit(ip, 'restore backup', name);
    json(res, 200, { ok: true });
    beat({ clean: true }); return setTimeout(() => process.exit(0), 500);
  }
  return json(res, 404, { error: 'Unknown' });
}
function kick(pid, msg) { const s = conns.get(pid); if (!s) return; [...s].forEach(ws => { send(ws, { t: 'banned', msg }); try { ws.close(); } catch (e) {} }); }
async function adminApi(req, res, route) {
  const ip = ipOf(req);
  if (route === 'login' && req.method === 'POST') {
    await ensureAdmin();
    if (limited('admin:' + ip)) return json(res, 429, { error: 'Too many attempts. Try again in 10 minutes.' });
    const b = await body(req);
    if (b.username) {
      const tid = db.names[String(b.username).trim().toLowerCase()], t = tid && P(tid);
      if (!t || !['mod', 'admin'].includes(t.role) || !(await checkPw(String(b.password || ''), t.pass)) || banInfo(t)) { audit(ip, 'failed sign in', String(b.username).slice(0, 30)); return json(res, 401, { error: 'Wrong username or password, or this account is not a moderator' }); }
      const tok = rid(24); adminTokens.set(tok, { exp: Date.now() + 12 * 3600e3, role: t.role, pid: t.id, name: t.name });
      log('[admin] ' + t.name + ' signed in as ' + t.role); audit(ip, 'sign in', t.name + ' (' + t.role + ')');
      return json(res, 200, { token: tok, role: t.role, name: t.name });
    }
    if (!(await checkPw(String(b.password || ''), admin))) { audit(ip, 'failed sign in', ''); return json(res, 401, { error: 'Wrong password' }); }
    const tok = rid(24); adminTokens.set(tok, { exp: Date.now() + 12 * 3600e3, role: 'owner', pid: null, name: 'Owner' });
    log('[admin] signed in from ' + ip); audit(ip, 'sign in', 'Owner');
    return json(res, 200, { token: tok, role: 'owner', name: 'Owner' });
  }
  const tok = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const sess = adminTokens.get(tok);
  if (!sess || sess.exp < Date.now()) { adminTokens.delete(tok); return json(res, 401, { error: 'Sign in again' }); }
  if (sess.pid) { const sp = P(sess.pid); if (!sp || !['mod', 'admin'].includes(sp.role) || sp.banned) { adminTokens.delete(tok); return json(res, 401, { error: 'Sign in again' }); } sess.role = sp.role; }
  const role = sess.role, isMod = role === 'mod';
  const who = sess.name;
  const aud = (i, a, d) => audit(i, a, (d ? d + ' ' : '') + '(' + who + ')');
  const MOD_GET = new Set(['overview', 'players', 'player', 'games', 'logs-none']);
  const MOD_POST = new Set(['player', 'report', 'endgame']);
  const MOD_ACTIONS = new Set(['mute', 'unmute', 'kick', 'ban', 'unban', 'message']);
  if (isMod && !(req.method === 'GET' ? MOD_GET : MOD_POST).has(route)) return json(res, 403, { error: 'Moderators cannot do that' });
  if (route === 'overview') return json(res, 200, Object.assign(overview(isMod), { me: { role, name: who } }));
  const qs = new URL(req.url, 'http://x').searchParams;
  if (route === 'players') return json(res, 200, adminPlayers(qs.get('q'), { kind: qs.get('kind'), sort: qs.get('sort'), offset: qs.get('offset'), limit: qs.get('limit') }));
  if (route === 'player' && req.method === 'GET') { const d = adminPlayer(qs.get('id')); return d ? json(res, 200, d) : json(res, 404, { error: 'Player not found' }); }
  if (route === 'games') return json(res, 200, { rows: adminGames(qs.get('q')) });
  if (route === 'backup') {
    aud(ip, 'backup', '');
    const bodyStr = JSON.stringify({ exported: new Date().toISOString(), version: VERSION, db, games: [...records.values()] });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="rookery-backup-' + new Date().toISOString().slice(0, 10) + '.json"', 'Cache-Control': 'no-store' });
    return res.end(bodyStr);
  }
  if (route === 'players.csv') {
    const rows = adminPlayers('', { limit: 500, sort: 'name' }).rows;
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = ['name,account,role,title,bullet,blitz,rapid,daily,puzzle,games,wins,joined,last seen'].concat(rows.map(r => [r.name, r.guest ? 'guest' : 'account', r.role, r.title, r.ratings.bullet, r.ratings.blitz, r.ratings.rapid, r.daily, r.puzzle, r.games, r.wins, new Date(r.created).toISOString().slice(0, 10), new Date(r.seen || r.created).toISOString().slice(0, 10)].map(esc).join(','))).join('\r\n');
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="rookery-players.csv"', 'Cache-Control': 'no-store' });
    return res.end('\ufeff' + csv);
  }
  if (['analytics', 'logs', 'backups'].includes(route) && req.method === 'GET') return adminMore(route, req, res, {}, ip, role, aud);
  if (req.method !== 'POST') return json(res, 404, { error: 'Unknown' });
  const b = await body(req);
  const OWNER_ONLY = new Set(['password', 'restart', 'restore', 'settings', 'ipban', 'backupdir']);
  if (role !== 'owner' && OWNER_ONLY.has(route)) return json(res, 403, { error: 'Only the owner can do that' });
  if (route === 'player') {
    const p = P(b.id); if (!p) return json(res, 404, { error: 'Player not found' });
    if (isMod && !MOD_ACTIONS.has(b.action)) return json(res, 403, { error: 'Moderators cannot do that' });
    if (isMod && b.action === 'ban' && (!(+b.minutes > 0) || +b.minutes > 10080)) return json(res, 403, { error: 'Moderators can suspend for up to 7 days' });
    if (isMod && ['mod', 'admin'].includes(p.role)) return json(res, 403, { error: 'Moderators cannot act on staff accounts' });
    if (role === 'admin' && p.role === 'admin' && sess.pid !== p.id && ['ban', 'delete', 'edit', 'role', 'password'].includes(b.action)) return json(res, 403, { error: 'Only the owner can change another admin' });
    switch (b.action) {
      case 'ban': {
        const mins = +b.minutes || 0;
        p.banned = true; p.banUntil = mins > 0 ? Date.now() + mins * 60000 : null; p.banReason = cleanText(b.reason, 120) || null;
        const g = gameOf(p.id);
        if (g) endGame(g, g.w === p.id ? '0-1' : '1-0', 'abandonment');
        kick(p.id, banInfo(p)); break;
      }
      case 'unban': p.banned = false; p.banUntil = null; p.banReason = null; break;
      case 'rating': {
        const v = Math.round(+b.value);
        if (!(v >= 100 && v <= 3500)) return json(res, 400, { error: 'Use a rating between 100 and 3500' });
        if (b.cat === 'puzzle') p.puzzle.r = v;
        else if (CATS.includes(b.cat)) { p.ratings[b.cat].r = v; p.ratings[b.cat].peak = Math.max(p.ratings[b.cat].peak, v); p.hist.push([Date.now(), b.cat, v]); }
        else return json(res, 400, { error: 'Unknown rating' });
        sendP(p.id, { t: 'me', me: me(p) }); break;
      }
      case 'rename': {
        const u = String(b.name || '').trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return json(res, 400, { error: 'Names use 3 to 20 letters, numbers or underscores' });
        const owner = db.names[u.toLowerCase()];
        if (owner && owner !== p.id) return json(res, 400, { error: 'That name is taken' });
        if (p.username) delete db.names[p.username.toLowerCase()];
        if (!p.guest) { p.username = u; db.names[u.toLowerCase()] = p.id; }
        p.name = u; sendP(p.id, { t: 'me', me: me(p) }); notifyFriends(p.id); break;
      }
      case 'password': {
        if (p.guest) return json(res, 400, { error: 'Guests have no password' });
        const temp = rid(4); const salt = rid(16); p.pass = { salt, hash: await hashPw(temp, salt) };
        for (const [t, s] of Object.entries(db.sessions)) if (s.pid === p.id) delete db.sessions[t];
        kick(p.id, 'Your password was reset. Sign in with the new password.');
        aud(ip, 'password', p.name); save();
        return json(res, 200, { ok: true, temp });
      }
      case 'title': p.title = cleanText(b.title, 16) || null; sendP(p.id, { t: 'me', me: me(p) }); notifyFriends(p.id); break;
      case 'message': {
        const text = cleanText(b.text, 300); if (!text) return json(res, 400, { error: 'Write a message first' });
        if (!online(p.id)) return json(res, 400, { error: p.name + ' is offline' });
        sendP(p.id, { t: 'admin_msg', text }); break;
      }
      case 'logout': for (const [t, s] of Object.entries(db.sessions)) if (s.pid === p.id) delete db.sessions[t]; kick(p.id, 'You were signed out by the server.'); break;
      case 'mute': p.muted = true; p.muteUntil = +b.hours > 0 ? Date.now() + b.hours * 3600e3 : null; break;
      case 'unmute': p.muted = false; p.muteUntil = null; p.strikes = 0; break;
      case 'edit': { const r = editPlayer(p, b.data || {}); if (r) return json(res, 400, { error: r }); sendP(p.id, { t: 'me', me: me(p) }); notifyFriends(p.id); break; }
      case 'role': {
        if (role !== 'owner') return json(res, 403, { error: 'Only the owner can change roles' });
        if (p.guest) return json(res, 400, { error: 'Guests cannot be staff. They need an account first.' });
        p.role = ['mod', 'admin'].includes(b.role) ? b.role : '';
        for (const [k, v] of adminTokens) if (v.pid === p.id) adminTokens.delete(k);
        sendP(p.id, { t: 'me', me: me(p) }); break;
      }
      case 'max': {
        const v = Math.max(100, Math.min(3500, Math.round(+b.value || 3000)));
        for (const c of CATS) { const r = p.ratings[c]; r.r = v; r.peak = Math.max(r.peak, v); p.hist.push([Date.now(), c, v]); }
        p.puzzle.r = Math.max(p.puzzle.r, v);
        ACH.forEach(a => grant(p, a[0], true));
        if (b.title) p.title = cleanText(b.title, 16);
        sendP(p.id, { t: 'me', me: me(p) }); notifyFriends(p.id); break;
      }
      case 'grantall': ACH.forEach(a => grant(p, a[0], true)); sendP(p.id, { t: 'me', me: me(p) }); break;
      case 'clearhist': p.hist = []; sendP(p.id, { t: 'me', me: me(p) }); break;
      case 'kick': kick(p.id, 'You were disconnected by the server.'); break;
      case 'reset': p.ratings = newRatings(1200); p.hist = []; break;
      case 'delete': {
        if (online(p.id)) kick(p.id, 'Your account was removed.');
        if (p.username) delete db.names[p.username.toLowerCase()];
        Object.values(db.players).forEach(o => { ['friends', 'reqIn', 'reqOut'].forEach(k => { o[k] = o[k].filter(x => x !== p.id); }); });
        for (const [t, s] of Object.entries(db.sessions)) if (s.pid === p.id) delete db.sessions[t];
        delete db.players[p.id]; break;
      }
      default: return json(res, 400, { error: 'Unknown action' });
    }
    log('[admin] ' + b.action + ' ' + p.name); aud(ip, b.action, p.name + (b.reason ? ' (' + b.reason + ')' : '') + (b.value ? ' ' + (b.cat ? b.cat + '=' : 'all ratings ') + b.value : '') + (b.hours ? ' ' + b.hours + 'h' : '') + (b.role != null && b.action === 'role' ? ' ' + (b.role || 'player') : '') + (b.title ? ' ' + b.title : '')); save();
    return json(res, 200, { ok: true });
  }
  if (route === 'report') { const r = db.reports.find(x => x.id === b.id); if (r) { r.open = false; save(); } return json(res, 200, { ok: true }); }
  if (route === 'announce') {
    const text = cleanText(b.text, 200);
    db.announce = text ? { text, ts: Date.now() } : null; save(); aud(ip, 'announcement', text || '(removed)');
    const m = JSON.stringify(text ? { t: 'announce', text, ts: Date.now() } : { t: 'announce', text: '' });
    conns.forEach(s => s.forEach(ws => send(ws, m)));
    return json(res, 200, { ok: true });
  }
  if (route === 'endgame') {
    const g = games.get(b.gid);
    if (g && !g.over) {
      const r = ['1-0', '0-1', '1/2-1/2'].includes(b.result) ? b.result : 'aborted';
      endGame(g, r, r === 'aborted' ? 'aborted' : 'server decision');
      aud(ip, 'end game', P(g.w).name + ' vs ' + P(g.b).name + ' ' + r);
    }
    return json(res, 200, { ok: true });
  }
  if (route === 'deletegame') { if (records.delete(b.id)) { byPlayer.forEach(l => { const i = l.indexOf(b.id); if (i >= 0) l.splice(i, 1); }); rewriteGames(); aud(ip, 'delete game', b.id); } return json(res, 200, { ok: true }); }
  if (route === 'settings') {
    if (!(b.key in DEFAULT_SETTINGS)) return json(res, 400, { error: 'Unknown setting' });
    db.settings[b.key] = !!b.value; save(); aud(ip, 'setting', b.key + '=' + !!b.value);
    const m = JSON.stringify({ t: 'cfg', cfg: publicCfg() }); conns.forEach(st => st.forEach(ws => send(ws, m)));
    if (b.key === 'maintenance' && b.value) for (const k in queues) queues[k] = [];
    return json(res, 200, { ok: true });
  }
  if (route === 'ipban') {
    const tip = String(b.ip || '').trim().slice(0, 64); if (!tip) return json(res, 400, { error: 'Enter an address' });
    if (b.remove) delete db.ipBans[tip];
    else {
      db.ipBans[tip] = { ts: Date.now(), reason: cleanText(b.reason, 120) || null };
      wss.clients.forEach(w => { if (w.ip === tip) { send(w, { t: 'banned', msg: 'Access from your network has been blocked.' }); try { w.close(); } catch (e) {} } });
    }
    aud(ip, b.remove ? 'unblock address' : 'block address', tip); save();
    return json(res, 200, { ok: true });
  }
  if (route === 'backupnow') { runBackup(); aud(ip, 'backup', 'automatic copy now'); return db.backup.error ? json(res, 500, { error: db.backup.error }) : json(res, 200, { ok: true, file: db.backup.lastFile }); }
  if (route === 'backupdir') {
    const dir = String(b.dir || '').trim();
    if (dir && !path.isAbsolute(dir)) return json(res, 400, { error: 'Use a full folder path, like E:\\Rookery-backups' });
    try { if (dir) fs.mkdirSync(dir, { recursive: true }); } catch (e) { return json(res, 400, { error: 'That folder cannot be created: ' + e.message }); }
    db.backup.dir = dir || null; save(); aud(ip, 'backup folder', dir || 'automatic');
    return json(res, 200, { ok: true });
  }
  if (route === 'checkupdate') { fs.writeFileSync(path.join(DATA, 'update-now'), '1'); aud(ip, 'check for update', ''); return json(res, 200, { ok: true }); }
  if (route === 'restart') {
    aud(ip, 'restart', ''); log('[admin] restart requested');
    json(res, 200, { ok: true });
    try { fs.writeFileSync(DBF, JSON.stringify(db)); } catch (e) {}
    beat({ clean: true }); setTimeout(() => process.exit(0), 600); return;
  }
  if (route === 'puzzles') { puzzles.download(); return json(res, 200, { ok: true, status: puzzles.info() }); }
  if (route === 'password') {
    const pw = String(b.password || '');
    if (pw.length < 8) return json(res, 400, { error: 'Use at least 8 characters' });
    const salt = rid(16); admin = { salt, hash: await hashPw(pw, salt) };
    fs.writeFileSync(ADMINF, JSON.stringify(admin));
    try { fs.unlinkSync(path.join(DATA, 'ADMIN-PASSWORD.txt')); } catch (e) {}
    for (const [k, v] of adminTokens) if (v.role === 'owner') adminTokens.delete(k);
    const t2 = rid(24); adminTokens.set(t2, { exp: Date.now() + 12 * 3600e3, role: 'owner', pid: null, name: 'Owner' });
    return json(res, 200, { ok: true, token: t2 });
  }
  return await adminMore(route, req, res, b, ip, role, aud);
}

const server = http.createServer(async (req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  try {
    if (p === '/internal/restart' && req.method === 'POST') {
      const k = Buffer.from(String(req.headers['x-rookery-key'] || '')), want = Buffer.from(INTERNAL_KEY);
      if (k.length !== want.length || !crypto.timingSafeEqual(k, want)) { res.writeHead(403); return res.end(); }
      log('[update] restarting after an update'); res.writeHead(200); res.end('ok'); beat({ clean: true });
      try { fs.writeFileSync(DBF, JSON.stringify(db)); } catch (e) {}
      return setTimeout(() => process.exit(0), 400);
    }
    if (p === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
    if (p.startsWith('/api/admin/')) return await adminApi(req, res, p.slice(11));
    if (p === '/api/puzzle') {
      const q = new URL(req.url, 'http://x').searchParams;
      return json(res, 200, puzzles.pick(q.get('r'), q.get('theme'), String(q.get('ex') || '').split(',').filter(Boolean).slice(0, 300)));
    }
    if (p === '/api/puzzle/daily') return json(res, 200, puzzles.daily());
    if (p === '/api/puzzle/themes') return json(res, 200, { themes: puzzles.themes(), source: puzzles.info().source, count: puzzles.info().count });
    if (p === '/api/info') return json(res, 200, { version: VERSION, online: conns.size });
    if (p === '/' || p === '/index.html') return serveFile(req, res, path.join(PUB, 'index.html'));
    if (p === '/admin' || p === '/admin/') return serveFile(req, res, path.join(PUB, 'admin.html'), { 'X-Robots-Tag': 'noindex' });
    if (p === '/sw.js') return serveFile(req, res, path.join(PUB, 'sw.js'), { 'Service-Worker-Allowed': '/', 'Cache-Control': 'no-cache' });
    const f = path.normalize(path.join(PUB, p));
    if (!f.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
    return serveFile(req, res, f);
  } catch (e) { log('[http] error', e.message); try { json(res, 500, { error: 'Server error' }); } catch (e2) {} }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16384 });
wss.on('connection', (ws, req) => {
  ws.alive = true; ws.ip = ipOf(req); ws.bucket = 40; ws.bt = Date.now();
  ws.device = /mobile|android|iphone|ipad/i.test(req.headers['user-agent'] || '') ? 'phone' : 'computer';
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    const now = Date.now(); ws.bucket = Math.min(40, ws.bucket + (now - ws.bt) / 50); ws.bt = now;
    if (ws.bucket < 1) return; ws.bucket--;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    Promise.resolve(handle(ws, m)).catch(e => { log('[ws] error', e.stack || e.message); send(ws, { t: 'error', msg: 'Server error' }); });
  });
  ws.on('close', () => { unwatch(ws); detach(ws); });
  ws.on('error', () => {});
});
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; try { ws.ping(); } catch (e) {} });
  const now = Date.now(); for (const [t, e] of adminTokens) if (e.exp < now) adminTokens.delete(t);
}, 25000);

server.listen(PORT, async () => {
  await ensureAdmin();
  log(`Rookery ${VERSION} is running on http://localhost:${PORT}`);
  log(`[puzzles] ${puzzles.info().count} puzzles loaded (${puzzles.info().source})`);
  if (puzzles.info().source === 'builtin' && process.env.NO_PUZZLE_DOWNLOAD !== '1') setTimeout(() => puzzles.download(), 3000);
});
function shutdown() { log('shutting down'); beat({ clean: true }); try { fs.writeFileSync(DBF, JSON.stringify(db)); } catch (e) {} process.exit(0); }
process.on('uncaughtException', e => { log('[crash] ' + (e.stack || e.message)); beat({ crash: String(e.message || e) }); try { fs.writeFileSync(DBF, JSON.stringify(db)); } catch (er) {} process.exit(1); });
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
