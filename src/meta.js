/* ═══════════════════════════════════════════════════════════
   meta.js — the only thing that survives you.

   Permadeath means a run leaves nothing behind, which is
   correct and also the reason the ending screen felt like a
   full stop rather than a comma. This is the comma: a ledger of
   what you have *seen*, kept across runs, plus the handful of
   records worth beating.

   It started as a pure ledger — deliberately no unlocks, because
   the run was supposed to be the whole game. Sixty measured runs
   later, fifteen percent of them reached floor 11 and the back
   half of the dungeon was content almost nobody saw. A ledger
   that only counts is a ledger that never opens a door.

   So it pays out now, but never in raw power: every memory below
   hands over an *option* or a piece of knowledge you already
   earned by playing — the relic you found is for sale, the potion
   you identified stays identified. The difficulty curve is
   untouched; what changes is that run five starts knowing things
   run one did not.

   And 심연 runs the other way: once the boss is down, you can
   choose to make the whole descent harder for a bigger ledger.

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
  items: {},      // consumables ever identified — the alchemist's memory
  /* Cumulative across every run, for the memories that ask for a
     total rather than a first sighting. */
  totals: { forged: 0, opened: 0, engraved: 0, kills: 0, depth: 0 },
  abyss: 0,       // chosen difficulty above the base game, 0..5
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
    for (const k of ['relics', 'events', 'monsters', 'weapons', 'branches', 'taught', 'fusions', 'regions', 'items'])
      cache[k] = cache[k] || {};
    cache.best = { ...EMPTY.best, ...(cache.best || {}) };
    cache.totals = { ...EMPTY.totals, ...(cache.totals || {}) };
    cache.abyss = cache.abyss || 0;
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
  /* Totals, not maxima: a memory that asks for fifty chests wants
     fifty chests across every run, which is the whole point of
     something that survives you. */
  const t = m.totals;
  t.forged   += summary.forged || 0;
  t.opened   += summary.opened || 0;
  t.engraved += summary.engraved || 0;
  t.kills    += summary.kills || 0;
  t.depth    += summary.depth || 0;
  m.last = summary;
  write();
  return m;
}

/* The chosen difficulty above the base game. Only ever set by the
   player, and only after the boss has been beaten once. */
export const abyss = () => read().abyss || 0;
export function setAbyss(n) {
  const m = read();
  m.abyss = Math.max(0, Math.min(5, n | 0));
  write();
  return m.abyss;
}

/* Has this player ever finished a run? Used to decide whether
   the teaching prompts should fire. */
export const isNewcomer = () => read().runs === 0;

export function forget() {
  cache = { ...EMPTY };
  for (const k of ['relics', 'events', 'monsters', 'weapons', 'branches', 'taught', 'fusions', 'regions', 'items']) cache[k] = {};
  cache.best = { ...EMPTY.best };
  cache.totals = { ...EMPTY.totals };
  cache.abyss = 0;
  write();
}
