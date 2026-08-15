/* fitbudget.mjs — 층 예산을 무엇에서 뽑아야 하는가.

   「층 예산을 층의 실제 크기에서 뽑아라」는 그럴듯한 말이지만, 그
   말이 옳으려면 **한 층의 크기가 그 층에서 실제로 쓴 턴을 예측해야**
   한다. 예측하지 못하면 크기로 예산을 뽑는 것은 정밀해 보이는 잡음일
   뿐이다. 그래서 먼저 그 상관을 잰다 — 설계보다 먼저.

   층마다 짝을 지어 기록한다: (걷는 칸, 입구→계단 거리, 방 수, 깊이)
   대 (그 층에서 실제로 쓴 턴). 그리고 어느 것이 예측하는지 본다.

   usage: node sim/fitbudget.mjs [직업당 판수=10]                   */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const W = await import('../src/world.js');
const { runBot } = await import('./_botlib.mjs');
const { geometry } = await import('./pace.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 10);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];

/* 층 하나가 한 줄이다. */
const rows = [];
let stuck = 0, runs = 0;

for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    const seen = new Map();       // depth -> geometry
    /* 봇은 6층에서 죽는다. 그래서 7층 아래의 「통과 비용」은 표본이
       한 자릿수라 예산을 정할 근거가 못 된다. TOUGH=1 이면 매 턴
       체력을 채워 15층까지 걷게 한다 — 죽지 않는 봇이 재는 것은
       난이도가 아니라 **거리와 절차**이고, 예산이 맞춰야 할 것이
       바로 그것이다. 다만 물러서지 않으므로 전투 시간은 과대평가다. */
    const r = runBot('human', cls, i % 2 === 0, { tough: !!process.env.TOUGH, onTurn: g => {
      if (g.depth > 0 && g.level && !seen.has(g.depth)) seen.set(g.depth, geometry(g.level));
    } });
    runs++;
    if (r.stuck) { stuck++; continue; }
    for (const [d, t] of Object.entries(G.floorTurns || {})) {
      const k = Number(d), g = seen.get(k);
      /* 마지막 층은 죽어서 중간에 끊긴 층이다. 「이 층을 통과하는 데
         든 비용」이 아니라 「죽기까지 버틴 시간」이라 다른 물건이고,
         예산을 맞출 대상도 아니다. 뺀다. */
      if (!g || k === r.depth) continue;
      rows.push({ d: k, t, ...g });
    }
  }
}

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const corr = (a, b) => {
  const ma = mean(a), mb = mean(b), sa = sd(a), sb = sd(b);
  if (!sa || !sb) return 0;
  return mean(a.map((_, i) => (a[i] - ma) * (b[i] - mb))) / (sa * sb);
};

console.log(`\n예산의 근거 — ${runs}판 (라이브락 ${stuck}) · 통과한 층 ${rows.length}개\n`);

const T = rows.map(r => r.t);
console.log(`  통과한 층의 소요 턴 — 평균 ${mean(T).toFixed(0)} · 표준편차 ${sd(T).toFixed(0)}`);
console.log(`\n무엇이 「이 층에 몇 턴 걸리는가」를 예측하는가 (피어슨 r):`);
for (const [name, key] of [['깊이', 'd'], ['걷는 칸 수', 'walk'],
                           ['입구→계단 거리', 'stairDist'], ['방 수', 'rooms']]) {
  const r = corr(rows.map(x => x[key]), T);
  const bar = '█'.repeat(Math.round(Math.abs(r) * 40));
  console.log(`  ${name.padEnd(16)} r = ${r >= 0 ? ' ' : ''}${r.toFixed(3)}  ${bar}`);
}

/* 깊이를 고정하고 봐야 진짜다. 깊이가 크기와 턴 둘 다에 얹히면
   가짜 상관이 생긴다. 층 크기는 깊이와 무관하게 생성되므로 사실
   섞일 것이 없지만, 확인하고 넘어간다. */
console.log(`\n깊이를 고정하고 본 상관 (깊이별, n≥25인 층만):`);
const byD = new Map();
for (const r of rows) { if (!byD.has(r.d)) byD.set(r.d, []); byD.get(r.d).push(r); }
for (const d of [...byD.keys()].sort((a, b) => a - b)) {
  const a = byD.get(d);
  if (a.length < 25) continue;
  const t = a.map(x => x.t);
  console.log(`  ${String(d).padStart(2)}층 n=${String(a.length).padStart(3)}`
    + `  턴 평균 ${mean(t).toFixed(0).padStart(4)}`
    + `  ·  걷는칸 r=${corr(a.map(x => x.walk), t).toFixed(2).padStart(5)}`
    + `  계단거리 r=${corr(a.map(x => x.stairDist), t).toFixed(2).padStart(5)}`
    + `  방수 r=${corr(a.map(x => x.rooms), t).toFixed(2).padStart(5)}`);
}

/* 그리고 깊이 자체는 크기를 바꾸는가 — 예산이 깊이를 봐도 되는 이유. */
console.log(`\n깊이별 층 크기 (생성기의 성질):`);
for (const d of [...byD.keys()].sort((a, b) => a - b)) {
  const a = byD.get(d);
  if (a.length < 15) continue;
  console.log(`  ${String(d).padStart(2)}층  걷는칸 ${mean(a.map(x => x.walk)).toFixed(0).padStart(4)}`
    + `  계단거리 ${mean(a.map(x => x.stairDist)).toFixed(0).padStart(3)}`
    + `  방 ${mean(a.map(x => x.rooms)).toFixed(1).padStart(5)}`
    + `  ·  실제 턴 ${mean(a.map(x => x.t)).toFixed(0).padStart(4)}`
    + `  예산 ${String(D.FLOOR_BUDGET(d)).padStart(3)}`
    + `  사용률 ${(mean(a.map(x => x.t)) / D.FLOOR_BUDGET(d)).toFixed(2)}`);
}

/* ── 시계가 실제로 우는가 ──────────────────────────────────
   사용률 평균은 설계가 물어야 할 것이 아니다. 물어야 할 것은
   「통과한 층 중 몇 %에서 파도가 시작되는가」다 — 시계는 평균이
   아니라 꼬리에서 운다. */
const quant = (a, f) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * f))]; };

console.log(`\n통과한 층 중 예산을 넘긴 비율 — 시계가 실제로 우는 빈도:`);
console.log('  층    n   턴 중앙  90분위  현재예산  넘긴비율');
for (const d of [...byD.keys()].sort((a, b) => a - b)) {
  const a = byD.get(d); if (a.length < 10) continue;
  const t = a.map(x => x.t), b = D.FLOOR_BUDGET(d);
  const over = t.filter(x => x > b).length / t.length;
  console.log(`  ${String(d).padStart(2)}  ${String(a.length).padStart(3)}`
    + `${quant(t, 0.5).toFixed(0).padStart(8)}${quant(t, 0.9).toFixed(0).padStart(8)}`
    + `${String(b).padStart(10)}${(over * 100).toFixed(0).padStart(9)}%`);
}

/* 목표 곡선: 시계가 얕은 층에서는 절대 울지 않고, 깊은 층에서는
   절반쯤 운다. 그러면 예산은 그 깊이 소요 분포의 (1−목표) 분위수다.
   깊이만 보고 정하는 것이 맞다 — 위에서 층 크기는 예측하지 못했다. */
const TARGET = d => Math.max(0, Math.min(0.50, (d - 3) * 0.045));
console.log(`\n목표 넘긴비율 = clamp((d−3)×4.5%, 0, 50%) 일 때, 그 깊이 분포가 요구하는 예산:`);
console.log('  층   목표   필요예산   현재예산   현재가 내는 비율');
for (const d of [...byD.keys()].sort((a, b) => a - b)) {
  const a = byD.get(d); if (a.length < 10) continue;
  const t = a.map(x => x.t), b = D.FLOOR_BUDGET(d);
  const want = quant(t, 1 - TARGET(d));
  const over = t.filter(x => x > b).length / t.length;
  console.log(`  ${String(d).padStart(2)}${(TARGET(d) * 100).toFixed(0).padStart(6)}%`
    + `${want.toFixed(0).padStart(10)}${String(b).padStart(11)}${(over * 100).toFixed(0).padStart(15)}%`);
}
console.log('');
