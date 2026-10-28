'use strict';
/* Rookery puzzles: built-in set + downloader for the Lichess puzzle database (CC0). */
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const DB_URL = process.env.PUZZLE_URL || 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const http = require('http');
// [id, fen, moves, rating, themes]. Built-in puzzles have no setup move: the solver moves first.
const BUILTIN = [["rk001","6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1","d1d8",600,"mate mateIn1 oneMove"],["rk002","r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4","h5f7",615,"mate mateIn1 oneMove"],["rk003","6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1","g5f7",630,"mate mateIn1 oneMove"],["rk004","7k/7p/5N2/8/8/8/8/6RK w - - 0 1","g1g8",645,"mate mateIn1 oneMove"],["rk005","rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2","d8h4",660,"mate mateIn1 oneMove"],["rk006","k7/8/1K6/8/8/8/8/7R w - - 0 1","h1h8",675,"mate mateIn1 oneMove"],["rk007","3rkr2/8/8/8/6Q1/8/8/4K3 w - - 0 1","g4e6",690,"mate mateIn1 oneMove"],["rk008","6k1/8/8/8/1n6/8/PP6/KR6 b - - 0 1","b4c2",705,"mate mateIn1 oneMove"],["rk009","3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1","d8d1",720,"mate mateIn1 oneMove"],["rk010","7k/R7/5N2/8/8/8/8/K7 w - - 0 1","a7h7",735,"mate mateIn1 oneMove"],["rk011","6k1/8/8/8/8/8/rr6/7K b - - 0 1","a2a1",750,"mate mateIn1 oneMove"],["rk012","r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4","f3f7",765,"mate mateIn1 oneMove"],["rk013","1k1r4/ppp5/8/8/8/8/5PPP/3R2K1 w - - 0 1","d1d8",780,"mate mateIn1 oneMove"],["rk014","6k1/5ppp/4p3/8/8/8/5PPP/1Q4K1 w - - 0 1","b1b8",795,"mate mateIn1 oneMove"],["rk015","6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1","a2a7 g8f8 b1b8",1430,"mate mateIn2 short"],["rk016","r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 10","d5f6 g7f6 c4f7",1450,"mate mateIn2 short"],["rk017","4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16","b3b8 d7b8 d1d8",1470,"mate mateIn2 short"],["rk018","4r2k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1","b3g8 e8g8 h6f7",1490,"mate mateIn2 short"],["rk019","5r1k/4Nppp/8/7Q/8/4R3/8/K7 w - - 0 1","h5h7 h8h7 e3h3",1510,"mate mateIn2 short"],["rk020","r1b1kbnr/pppp1ppp/2n5/4p3/2B1P2q/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4","f3f7 e8d8 f7f8",1530,"mate mateIn2 short"],["rk021","5k2/5ppp/8/8/8/8/1Q6/1R4K1 w - - 0 1","b2a3 f8e8 a3a7 e8f8 b1b8",1650,"mate mateIn3 long"]];

const THEMES = [
  ['mix', 'Mixed'], ['mateIn1', 'Mate in 1'], ['mateIn2', 'Mate in 2'], ['mateIn3', 'Mate in 3'],
  ['fork', 'Fork'], ['pin', 'Pin'], ['skewer', 'Skewer'], ['discoveredAttack', 'Discovered attack'],
  ['sacrifice', 'Sacrifice'], ['hangingPiece', 'Hanging piece'], ['deflection', 'Deflection'],
  ['attraction', 'Attraction'], ['backRankMate', 'Back-rank mate'], ['promotion', 'Promotion'],
  ['trappedPiece', 'Trapped piece'], ['kingsideAttack', 'Kingside attack'], ['opening', 'Opening'],
  ['middlegame', 'Middlegame'], ['endgame', 'Endgame'], ['rookEndgame', 'Rook endgame'],
  ['short', 'Short'], ['long', 'Long'], ['crushing', 'Crushing'], ['equality', 'Equality']
];

module.exports = function createPuzzles(DATA, log) {
  const FILE = path.join(DATA, 'puzzles.json');
  let list = [], source = 'builtin', status = { state: 'idle', found: 0, mb: 0, error: null, at: null };
  let byRating = [], themeCounts = {};

  function index() {
    byRating = list.map((p, i) => i).sort((a, b) => list[a][3] - list[b][3]);
    themeCounts = {};
    list.forEach(p => p[4].split(' ').forEach(t => { themeCounts[t] = (themeCounts[t] || 0) + 1; }));
  }
  function load() {
    try {
      const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (Array.isArray(d.puzzles) && d.puzzles.length > 50) { list = d.puzzles; source = 'lichess'; status.at = d.at; index(); return; }
    } catch (e) {}
    list = BUILTIN; source = 'builtin'; index();
  }
  load();

  function toClient(p) {
    if (!p) return null;
    return { id: p[0], fen: p[1], moves: p[2].split(' '), rating: p[3], themes: p[4].split(' ').filter(Boolean), setup: source === 'lichess' && !String(p[0]).startsWith('rk') };
  }
  function lowerBound(r) {
    let lo = 0, hi = byRating.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (list[byRating[m]][3] < r) lo = m + 1; else hi = m; }
    return lo;
  }
  function pick(rating, theme, exclude) {
    rating = Math.max(300, Math.min(3200, +rating || 1500));
    const ex = new Set(exclude || []);
    const ok = p => !ex.has(p[0]) && (!theme || theme === 'mix' || (' ' + p[4] + ' ').includes(' ' + theme + ' '));
    const c = lowerBound(rating);
    for (let w = 25; w <= 4000; w *= 2) {
      const lo = Math.max(0, c - w), hi = Math.min(byRating.length, c + w);
      const cand = [];
      for (let i = lo; i < hi; i++) { const p = list[byRating[i]]; if (Math.abs(p[3] - rating) <= Math.max(120, w) && ok(p)) cand.push(p); }
      if (cand.length >= 6 || (lo === 0 && hi === byRating.length)) {
        if (!cand.length) break;
        return toClient(cand[(Math.random() * cand.length) | 0]);
      }
    }
    const any = list.filter(ok);
    return toClient(any.length ? any[(Math.random() * any.length) | 0] : list[(Math.random() * list.length) | 0]);
  }
  function daily() {
    const d = new Date().toISOString().slice(0, 10);
    let h = 2166136261;
    for (const ch of d) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const pool = list.filter(p => p[3] >= 1300 && p[3] <= 2000 && !p[4].includes('mateIn1'));
    const src = pool.length ? pool : list;
    return Object.assign(toClient(src[h % src.length]), { date: d });
  }
  function get(id) { const p = list.find(x => x[0] === id); return p ? toClient(p) : null; }
  function themes() {
    return THEMES.filter(([k]) => k === 'mix' || (themeCounts[k] || 0) >= (source === 'builtin' ? 1 : 15)).map(([k, l]) => ({ id: k, label: l, count: k === 'mix' ? list.length : themeCounts[k] }));
  }

  /* ----- download ----- */
  function download(opts) {
    opts = Object.assign({ min: 400, max: 2900, step: 100, perBucket: 320, maxMB: 60, minPop: 80, minPlays: 200, maxRD: 95 }, opts || {});
    if (status.state === 'running') return Promise.resolve(status);
    if (typeof zlib.createZstdDecompress !== 'function') {
      status = { state: 'error', found: 0, mb: 0, error: 'This Node.js version cannot read .zst files. Update Node.js to version 22.15 or newer.', at: null };
      return Promise.resolve(status);
    }
    status = { state: 'running', found: 0, mb: 0, error: null, at: null };
    log('[puzzles] downloading the Lichess puzzle database (only the first part is needed)');
    const nb = Math.ceil((opts.max - opts.min) / opts.step);
    const buckets = Array.from({ length: nb }, () => []);
    const core = [Math.floor((600 - opts.min) / opts.step), Math.floor((2400 - opts.min) / opts.step)];
    return new Promise(resolve => {
      let bytes = 0, done = false, header = true, rest = '', pre = Buffer.alloc(0), started = false, lines = 0;
      const dec = zlib.createZstdDecompress();
      let req;
      const full = () => { for (let i = core[0]; i <= core[1]; i++) if (buckets[i].length < opts.perBucket) return false; return true; };
      function finish(err) {
        if (done) return; done = true;
        try { req && req.destroy(); } catch (e) {}
        try { dec.destroy(); } catch (e) {}
        const all = [].concat(...buckets);
        if (all.length >= 200) {
          const tmp = FILE + '.tmp';
          fs.writeFileSync(tmp, JSON.stringify({ at: new Date().toISOString(), puzzles: all }));
          fs.renameSync(tmp, FILE);
          load();
          status = { state: 'done', found: all.length, mb: +(bytes / 1048576).toFixed(1), error: null, at: new Date().toISOString() };
          log('[puzzles] saved ' + all.length + ' puzzles');
        } else {
          status = { state: 'error', found: all.length, mb: +(bytes / 1048576).toFixed(1), error: (err && err.message) || 'Not enough puzzles were read', at: null };
          log('[puzzles] download failed: ' + status.error);
        }
        resolve(status);
      }
      function line(l) {
        lines++;
        if (header) { header = false; if (l.startsWith('PuzzleId')) return; }
        // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
        const f = l.split(',');
        if (f.length < 8) return;
        const r = +f[3], rd = +f[4], pop = +f[5], plays = +f[6];
        if (!(r >= opts.min && r < opts.max) || rd > opts.maxRD || pop < opts.minPop || plays < opts.minPlays) return;
        const b = buckets[Math.floor((r - opts.min) / opts.step)];
        if (b.length >= opts.perBucket) return;
        b.push([f[0], f[1], f[2], r, f[7]]);
        status.found++;
      }
      dec.on('data', d => {
        if (done) return;
        const parts = (rest + d.toString('utf8')).split('\n');
        rest = parts.pop();
        for (const l of parts) { if (l) line(l.replace(/\r$/, '')); }
        if (full() || lines > 1500000) finish();
      });
      dec.on('end', () => finish());
      dec.on('error', e => finish(e));
      req = (DB_URL.startsWith('https:') ? https : http).get(DB_URL, { headers: { 'User-Agent': 'Rookery chess home server' } }, res => {
        if (res.statusCode !== 200) { res.resume(); finish(new Error('Download failed (HTTP ' + res.statusCode + ')')); return; }
        res.on('data', chunk => {
          if (done) return;
          bytes += chunk.length; status.mb = +(bytes / 1048576).toFixed(1);
          if (!started) {
            pre = Buffer.concat([pre, chunk]);
            let off = 0;
            while (pre.length - off >= 8 && (pre.readUInt32LE(off) & 0xfffffff0) === 0x184d2a50) {
              const sz = pre.readUInt32LE(off + 4);
              if (pre.length - off < 8 + sz) return;
              off += 8 + sz;
            }
            if (pre.length - off < 8) return;
            started = true; chunk = pre.subarray(off); pre = null;
          }
          if (!dec.write(chunk)) { res.pause(); dec.once('drain', () => res.resume()); }
          if (bytes > opts.maxMB * 1048576) finish();
        });
        res.on('end', () => { try { dec.end(); } catch (e) {} });
        res.on('error', e => finish(e));
      });
      req.on('error', e => finish(e));
      req.setTimeout(30000, () => finish(new Error('The download timed out')));
    });
  }

  return {
    pick, daily, get, themes, download,
    info: () => ({ source, count: list.length, status }),
    url: DB_URL,
  };
};
module.exports.DB_URL = DB_URL;
