/* ═══════════════════════════════════════════════════════════
   meta.js — the only thing that survives you.

   Permadeath means a run leaves nothing behind, which is
   correct and also the reason the ending screen felt like a
   full stop rather than a comma. This is the comma: a ledger of
   what you have *seen*, kept across runs, plus the handful of
   records worth beating.

   Deliberately not unlocks. Nothing here changes a rule or
   hands out a starting bonus — the run is still the whole game.
   It only answers "is there more", which is the question that
   makes someone press 새 게임 again.

   One key in localStorage, written on every discovery. If the
   browser refuses to store, everything still works and the
   ledger is simply empty each session.
   ═══════════════════════════════════════════════════════════ */

const KEY = 'deepdelve.meta';

const EMPTY = {
  relics: {},     // id -> true
  events: {},
  monsters: {},
  weapons: {},
  branches: {},
  taught: {},     // lessons already given, so the second run is silent
  fusions: {},    // special relic combinations already found — the ledger of secrets
  regions: {},    // named places of the descent that have been stood in
  runs: 0, wins: 0,
  best: { depth: 0, lv: 0, combo: 0, gold: 0, turn: 0 },
  last: null,     // the previous run's summary, for the title screen
};

let cache = null;

export function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
    // Nested objects need their own defaults after a spread.
    for (const k of ['relics', 'events', 'monsters', 'weapons', 'branches', 'taught', 'fusions', 'regions'])
      cache[k] = cache[k] || {};
    cache.best = { ...EMPTY.best, ...(cache.best || {}) };
  } catch { cache = { ...EMPTY }; }
  return cache;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode */ }
}

/* Called from the rules layer whenever something is met for the
   first time. Cheap enough to call unconditionally — the write
   only happens when the ledger actually changed. */
export function see(kind, id) {
  if (!id) return false;
  const m = read();
  if (!m[kind] || m[kind][id]) return false;
  m[kind][id] = true;
  write();
  return true;                       // true = this was the first time
}

export const seen = (kind, id) => !!read()[kind]?.[id];
export const count = kind => Object.keys(read()[kind] || {}).length;

/* Recorded at the end of a run, win or lose. */
export function finish(summary) {
  const m = read();
  m.runs++;
  if (summary.win) m.wins++;
  const b = m.best;
  b.depth = Math.max(b.depth, summary.depth);
  b.lv    = Math.max(b.lv, summary.lv);
  b.combo = Math.max(b.combo, summary.combo);
  b.gold  = Math.max(b.gold, summary.gold);
  if (summary.win) b.turn = b.turn ? Math.min(b.turn, summary.turn) : summary.turn;
  m.last = summary;
  write();
  return m;
}

/* Has this player ever finished a run? Used to decide whether
   the teaching prompts should fire. */
export const isNewcomer = () => read().runs === 0;

export function forget() {
  cache = { ...EMPTY };
  for (const k of ['relics', 'events', 'monsters', 'weapons', 'branches', 'taught', 'fusions', 'regions']) cache[k] = {};
  cache.best = { ...EMPTY.best };
  write();
}
