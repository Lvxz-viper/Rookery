'use strict';
/* Fair-play analysis. Runs the bundled Stockfish (WebAssembly) in a separate low-priority
   Node process, one game at a time, and reports how closely each player matched the engine. */
const { spawn } = require('child_process');
const os = require('os');

function createEngine(enginePath, log) {
  let proc = null, buf = '', waiters = [], idleTimer = null;
  function start() {
    proc = spawn(process.execPath, [enginePath], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    try { os.setPriority(proc.pid, os.constants.priority.PRIORITY_LOW); } catch (e) {}
    proc.stdout.on('data', d => {
      buf += d.toString();
      let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); waiters.slice().forEach(w => w(line)); }
    });
    proc.on('exit', () => { proc = null; waiters = []; });
    send('uci'); send('setoption name Hash value 16'); send('setoption name MultiPV value 3'); send('isready');
  }
  function send(c) { if (proc) proc.stdin.write(c + '\n'); }
  function until(pred, ms) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => { waiters = waiters.filter(x => x !== fn); rej(new Error('engine timeout')); }, ms);
      const fn = line => { const v = pred(line); if (v !== undefined) { clearTimeout(t); waiters = waiters.filter(x => x !== fn); res(v); } };
      waiters.push(fn);
    });
  }
  async function ready() { if (!proc) start(); send('isready'); await until(l => l === 'readyok' ? true : undefined, 60000); }
  async function evaluate(fen, depth) {
    clearTimeout(idleTimer);
    await ready();
    const pv = {};
    send('position fen ' + fen); send('go depth ' + depth);
    const best = await until(line => {
      if (line.startsWith('info') && / pv /.test(line)) {
        const k = +((/ multipv (\d+)/.exec(line) || [0, 1])[1]), m = /score (cp|mate) (-?\d+)/.exec(line), mv = / pv (\S+)/.exec(line);
        if (m && mv) pv[k] = { score: m[1] === 'cp' ? +m[2] : (+m[2] > 0 ? 1000 : -1000), move: mv[1] };
      }
      const b = /^bestmove (\S+)/.exec(line); return b ? b[1] : undefined;
    }, 60000);
    idleTimer = setTimeout(stop, 90000);
    const top = [1, 2, 3].map(k => pv[k] && pv[k].move).filter(Boolean);
    return { score: Math.max(-1000, Math.min(1000, pv[1] ? pv[1].score : 0)), best, top };
  }
  function stop() { if (proc) { try { send('quit'); proc.kill(); } catch (e) {} proc = null; } }
  return { evaluate, stop };
}

/* Returns stats per colour: moves counted, average centipawn loss and share of engine-first moves.
   The first 8 moves of each side and positions already decided (|eval| > 600) are skipped. */
async function analyseGame(engine, moves, depth) {
  const Pos = global.Pos; /* loaded by server.js from core.js */
  const pos = new Pos(), fens = [pos.fen()], ucis = [];
  for (const u of moves) { const m = pos.parseUci(u); if (!m) break; ucis.push(pos.uci(m)); pos.make(m); fens.push(pos.fen()); }
  const evals = [];
  for (let i = 0; i < fens.length; i++) evals.push(await engine.evaluate(fens[i], depth));
  /* only moves after the opening in undecided positions (|eval| <= 4 pawns) count; decided positions have many good moves */
  const out = [{ n: 0, nb: 0, loss: 0, m1: 0, m3: 0 }, { n: 0, nb: 0, loss: 0, m1: 0, m3: 0 }];
  for (let i = 16; i < ucis.length; i++) {
    const e = evals[i], before = e.score, after = -evals[i + 1].score, s = out[i % 2];
    if (e.top.length < 2 || Math.abs(before) > 400) continue;
    s.n++; s.nb++; if (ucis[i] === e.best) s.m1++; if (e.top.includes(ucis[i])) s.m3++;
    s.loss += Math.max(0, Math.min(400, before - after));
  }
  return out.map(s => ({ n: s.n, acpl: s.nb >= 5 ? Math.round(s.loss / s.nb) : null, match: s.n ? Math.round(s.m1 / s.n * 100) : null, top3: s.n ? Math.round(s.m3 / s.n * 100) : null }));
}
module.exports = { createEngine, analyseGame };
