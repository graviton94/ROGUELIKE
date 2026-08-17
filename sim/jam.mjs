/* jam.mjs — 라이브락은 어디에서 걸리는가.

   정직 벤치가 다시 빨갛다(60판에 3판, 5%). 앞서 고친 것은 **턴이
   흐르지 않는** 라이브락이었고(장비 교체·해체 루프), 이번 것은
   다르다: 막힌 판이 59983턴을 쓴다. 턴은 멀쩡히 흐른다. 봇이
   죽지도, 내려가지도 않고 **한 층을 영원히 걷는다**.

   그러면 물어야 할 것은 「어느 층에서, 무엇을 하다가」다. 층·
   과업·계단 타일·경로 유무를 끝 순간에 찍는다.

   usage: node sim/jam.mjs [판수=60]                              */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const W = await import('../src/world.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 60);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];

const jams = [];
let runs = 0;
/* 판마다 마지막 2000턴의 위치를 기억한다 — 갇힌 판이 무엇을
   반복하는지는 좌표가 말한다. */
for (let i = 0; i < N; i++) {
  const ring = new Array(400).fill(null);
  let k = 0, lastDepth = 0, depthAtTurn = 0;
  const r = runBot('human', CLASSES[i % CLASSES.length], i % 2 === 0, { onTurn: g => {
    const p = g.player; if (!p) return;
    if (g.depth !== lastDepth) { lastDepth = g.depth; depthAtTurn = g.turn; }
    ring[k++ % ring.length] = { x: p.x, y: p.y, t: g.turn, s: g.screen,
      /* 갇힌 판이 「무엇을 하고 있었나」. 좌표만으로는 서 있는 것과
         때리는 것을 구별할 수 없다. 화면과 발밑 타일도 같이 본다 —
         턴이 안 흐르는 반복은 대개 화면 하나에서 난다. */
      hp: p.hp, adj: g.monsters.filter(m =>
        Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 1).length,
      pr: Game.pressureLevel(), tile: g.level.tiles[W.idx(p.x, p.y)],
      pend: (g.pendingBranch || []).length };
  } });
  runs++;
  if (!r.stuck) continue;
  const L = G.level, p = G.player;
  // 계단 타일이 있는가, 그리고 잠겨 있는가
  let downAt = -1;
  for (let j = 0; j < L.tiles.length; j++) if (L.tiles[j] === W.DOWN) downAt = j;
  const seen = ring.filter(Boolean);
  const spots = new Set(seen.map(s => `${s.x},${s.y}`));
  const screens = {};
  for (const s of seen) screens[s.s || '—'] = (screens[s.s || '—'] || 0) + 1;
  jams.push({
    cls: CLASSES[i % CLASSES.length], depth: G.depth, turn: G.turn, lv: p.lv,
    floorTurn: G.floorTurn, budget: Game.floorBudget(), waves: G.waves,
    task: G.task ? (G.task.id || JSON.stringify(G.task)) : '없음',
    taskDone: G.task ? !!G.task.done : null,
    downAt, onDown: downAt >= 0 && W.idx(p.x, p.y) === downAt,
    reachable: downAt >= 0,
    turnsOnFloor: G.turn - depthAtTurn,
    distinctSpots: spots.size,
    screens,
    hp: `${p.hp}/${p.maxhp}`, monsters: G.monsters.length,
    /* 「무엇을 향해 걷고 있었나」가 없으면 좌표만 보고 추측하게 된다.
       봇이 고르는 목표는 순서가 정해져 있으므로, 층에 그것들이
       남아 있는지와 소비 가능한지를 같이 찍는다 — 소비할 수 없는
       목표를 향해 계속 걷는 것이 걷는 라이브락의 가장 그럴듯한 꼴이다. */
    campLeft: G.campUses, hasCamp: L.tiles.some(t => t === W.CAMP),
    hasAnvil: L.tiles.some(t => t === W.ANVIL),
    relicsOnFloor: G.items.filter(i => i.kind === 'relic').length,
    tileNow: L.tiles[W.idx(p.x, p.y)],
    tail: (() => { const a = []; for (let q = 8; q >= 1; q--) a.push(ring[(k - q + ring.length * 2) % ring.length]); return a.filter(Boolean); })(),
  });
}

console.log(`\n라이브락 해부 — ${runs}판 중 ${jams.length}판이 갇혔다 (${(jams.length * 100 / runs).toFixed(1)}%)\n`);
console.log(`  TASK_ODDS=${D.TASK_ODDS} · TASK_PATIENCE=${D.TASK_PATIENCE}\n`);
for (const j of jams) {
  console.log(`  ── ${j.cls} · ${j.depth}층 · ${j.turn}턴 (이 층에서 ${j.turnsOnFloor}턴) · Lv${j.lv} · 체력 ${j.hp}`);
  console.log(`     과업 ${j.task}${j.taskDone === null ? '' : j.taskDone ? ' (끝남)' : ' (안 끝남)'}`
    + ` · 층시계 ${j.floorTurn}/${j.budget} · 파도 ${j.waves} · 몬스터 ${j.monsters}`);
  console.log(`     모닥불 ${j.hasCamp ? '있음' : '없음'}(남은 사용 ${j.campLeft})`
    + ` · 모루 ${j.hasAnvil ? '있음' : '없음'} · 바닥의 유물 ${j.relicsOnFloor} · 발밑 타일 ${j.tileNow}`);
  {
    const tail = j.tail || [];
    if (tail.length) {
      console.log(`     마지막 여덟 번: ` + tail.map(t =>
        `${t.t}턴(${t.x},${t.y})[${t.s}]타일${t.tile}갈림${t.pend}적${t.adj}`).join(' '));
    }
  }
  console.log(`     계단 타일 ${j.downAt >= 0 ? '있음' : '없음'}${j.onDown ? ' · 계단 위에 서 있다' : ''}`
    + ` · 마지막 400턴에 밟은 칸 ${j.distinctSpots}개`
    + ` · 화면 ${Object.entries(j.screens).map(([a, b]) => `${a}:${b}`).join(' ')}`);
}
if (!jams.length) console.log('  (이번 표본에는 없다 — 더 돌려야 한다)');
console.log('');
