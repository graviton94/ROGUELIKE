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
  /* name -> how many of that thing you have put down, ever. A
     sighting gets a monster into the codex; a body count is what
     buys the tells. Knowing that an ogre winds up for a turn is
     knowledge you paid for in ogres. */
  bodies: {},
  reso: {},        // named combinations ever lit
  /* ── 붉게 고쳐 쓴 줄 ───────────────────────────────────
     앞선 자들이 적어 놓은 규칙 중에는 틀린 줄이 있고, 그것이 눈앞에서
     들통나는 순간이 있다. 그 순간을 여기 적는다: `spr:열쇠` 하나가
     「이 종류의 이 규칙은 내가 두 눈으로 봤다」다.

     판을 넘어 남는다. 이 게임에서 판을 넘어 남는 것은 언제나 힘이
     아니라 **앎**이고(bodies가 그렇듯), 규칙서를 고쳐 쓴 것은 정확히
     그 종류다 — 다음 판의 나는 더 세지 않고 덜 속는다. */
  redwrit: {},
  /* Cumulative across every run, for the memories that ask for a
     total rather than a first sighting. */
  totals: { forged: 0, opened: 0, engraved: 0, kills: 0, depth: 0 },
  abyss: 0,       // the rung of the shackle ladder being played, 0..8
  cleared: null,  // highest rung ever won; null = never asked, -1 = never won
  /* ── 앞서 간 사람들 ────────────────────────────────────
     이 게임의 이야기는 「아무도 돌아오지 못했다」다. 그런데 그
     사람들이 실제로 어디에 있는지는 게임 어디에도 없었다 — 문장으로만
     있었다. 여기 넣는다: 죽은 자리, 죽인 것, 들고 있던 것.
     다음 판의 그 층에 그대로 놓인다.

     셋만 남긴다. 무한정 쌓으면 열 판쯤 뒤에 층마다 시체가 널려
     「앞서 간 자」가 배경 소품이 된다 — 드물어야 사건이다. */
  fallen: [],
  runs: 0, wins: 0,
  best: { depth: 0, lv: 0, combo: 0, gold: 0, turn: 0 },
  last: null,     // the previous run's summary, for the title screen
};

/* 몇 명까지 기억하는가. 드물어야 사건이다. */
export const FALLEN_KEEP = 3;

/* EMPTY의 속표(속이 빈 객체들)는 참조 하나뿐이다. `{ ...EMPTY }`는
   얕은 복사이므로 그 참조가 그대로 딸려 오고, 거기에 한 줄이라도
   쓰면 **기본값 자체가** 오염된다 — forget()으로 지워도 안 지워지는
   칸이 생긴다. 실제로 redwrit을 새로 넣자마자 그 일이 났고(벤치가
   「어둠 속에서는 안 고쳐진다」로 잡았다), read()와 forget()이 각자
   손으로 나열하던 표를 하나로 합치지 않으면 다음에 또 난다. */
const TABLES = ['relics', 'events', 'monsters', 'weapons', 'branches', 'taught',
                'fusions', 'regions', 'items', 'bodies', 'reso', 'redwrit'];
const blank = () => {
  const m = { ...EMPTY, fallen: [],
              best: { ...EMPTY.best }, totals: { ...EMPTY.totals } };
  for (const k of TABLES) m[k] = {};
  return m;
};

let cache = null;

export function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
    // Nested objects need their own defaults after a spread.
    for (const k of TABLES) cache[k] = cache[k] || {};
    cache.fallen = Array.isArray(cache.fallen) ? cache.fallen : [];
    cache.best = { ...EMPTY.best, ...(cache.best || {}) };
    cache.totals = { ...EMPTY.totals, ...(cache.totals || {}) };
    cache.abyss = cache.abyss || 0;
  } catch { cache = blank(); }
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

/* One body, recorded. Also counts as a sighting — you cannot kill
   something you never met, and a thing killed from across a room
   by a spell would otherwise stay off the codex. */
export function slew(name) {
  if (!name) return 0;
  const m = read();
  m.monsters[name] = true;
  m.bodies[name] = (m.bodies[name] || 0) + 1;
  write();
  return m.bodies[name];
}
export const bodies = name => read().bodies?.[name] || 0;

/* 붉게 고쳐 쓴 줄. 열쇠는 `spr:k` — 판을 넘어 남고, 한 번 고친 줄은
   다시 안 고쳐진다. 두 번째로 그 장면을 봤을 때 게임이 또 「그 기록은
   틀렸다」고 말하면 그건 발견이 아니라 잡음이다. */
export const corrected = (spr, k) => !!read().redwrit?.[`${spr}:${k}`];
export function correct(spr, k) {
  if (!spr || !k) return false;
  const m = read();
  const key = `${spr}:${k}`;
  if (m.redwrit[key]) return false;
  m.redwrit[key] = true;
  write();
  return true;                       // true = 이번에 처음 고쳐 썼다
}

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
  /* 시체를 남긴다. 완주는 안 남긴다 — 걸어 나간 사람은 아래에 없다. */
  if (!summary.win && summary.depth > 0) {
    m.fallen = [{
      sent: summary.sent || m.runs,
      depth: summary.depth,
      by: summary.by || null,
      cls: summary.cls, race: summary.race, lv: summary.lv,
      weapon: summary.weaponItem || null,
      gold: Math.round((summary.gold || 0) * 0.6),
      relic: (summary.relics || [])[0] || null,
    }, ...(m.fallen || [])].slice(0, FALLEN_KEEP);
  }
  write();
  return m;
}

/* The rung of the ladder this player is standing on, and the
   highest one they have actually finished. `abyss` is the old
   free-choice dial; a saved 3 becomes rung 3 and rung 3 counts as
   beaten, which is the fairest reading — that player had already
   chosen to play at 3 and the old dial let them. */
export const abyss = () => {
  const m = read();
  return Math.max(0, Math.min(8, m.abyss | 0));
};
export function setAbyss(n) {
  const m = read();
  m.abyss = Math.max(0, Math.min(8, Math.min(n | 0, cleared() + 1)));
  write();
  return m.abyss;
}

/* The highest rung ever won. Rung n+1 is selectable and nothing
   above it — the ladder is climbed, not chosen. */
export function cleared() {
  const m = read();
  if (m.cleared == null) m.cleared = m.wins > 0 ? Math.max(0, m.abyss | 0) : -1;
  return m.cleared;
}
export function clearedAt(n) {
  const m = read();
  if (n > cleared()) { m.cleared = n; write(); }
  return m.cleared;
}

/* Has this player ever finished a run? Used to decide whether
   the teaching prompts should fire. */
export const isNewcomer = () => read().runs === 0;

export function forget() {
  cache = blank();
  cache.abyss = 0;
  cache.cleared = null;
  write();
}
