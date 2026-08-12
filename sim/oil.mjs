/* oil.mjs — 횃불은 지금 실제로 무는가.

   횃불은 이미 있다: 1100턴에서 시작해 매 턴 줄고, 반경은
   7 → 5(300 미만) → 3(80 미만) → 2(0). 그런데 「있다」와 「문다」는
   다르다. 판의 대부분을 가장 밝은 반경에서 보내고 한 번도 안 꺼진다면
   그것은 시계가 아니라 장식이다.

   그래서 세 가지만 센다:
     · 한 판의 턴을 어느 반경에서 보내는가
     · 몇 %의 판에서 불이 꺼지는가, 꺼진 뒤 몇 턴을 더 사는가
     · 기름을 어디서 채우는가 (모닥불이냐 소모품이냐)

   집계는 endTurn 한 곳에서 한다 (G.lit). 걷기 집계와 같은 자리다.

   usage: node sim/oil.mjs [runs]                */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 8);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];

const band = {};           // 반경별 턴 수
let runs = 0, depth = 0, turns = 0, wentDark = 0, darkTurns = 0, endOil = 0;
const depthsDark = [], depthsLit = [];

for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    const r = runBot('human', cls, i % 2 === 0);
    runs++; depth += r.depth; turns += G.turn || 0;
    for (const [k, v] of Object.entries(G.lit || {})) band[k] = (band[k] || 0) + v;
    const dark = (G.lit || {})['2'] || 0;
    if (dark > 0) { wentDark++; darkTurns += dark; depthsDark.push(r.depth); }
    else depthsLit.push(r.depth);
    endOil += G.player?.lightTurns || 0;
  }
}

const sum = Object.values(band).reduce((a, b) => a + b, 0) || 1;
const mean = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '—';

console.log(`\n횃불은 무는가 — ${CLASSES.length}직업 × ${N}판 = ${runs}판 · 평균 ${(depth/runs).toFixed(1)}층 · 판당 ${(turns/runs).toFixed(0)}턴\n`);
console.log('턴을 어느 반경에서 보냈나:');
for (const k of ['7', '6', '5', '4', '3', '2']) {
  const v = band[k] || 0, pct = v * 100 / sum;
  const label = k === '2' ? '2칸 — 불이 꺼진 상태' : `${k}칸`;
  console.log(`  ${String(Math.round(pct)).padStart(3)}%  ${'█'.repeat(Math.round(pct/2)).padEnd(50, '·')}  ${label}`);
}
console.log(`\n불이 꺼진 판  ${wentDark}/${runs} (${Math.round(wentDark*100/runs)}%)`);
console.log(`꺼진 뒤 산 턴  판당 평균 ${wentDark ? Math.round(darkTurns/wentDark) : 0}턴`);
console.log(`끝날 때 남은 기름 평균 ${Math.round(endOil/runs)}`);
console.log(`\n도달 층수 — 꺼진 판 ${mean(depthsDark)}층 / 안 꺼진 판 ${mean(depthsLit)}층`);
console.log('\n가장 밝은 칸에서 대부분을 보내고 한 번도 안 꺼지면, 그것은 시계가 아니라 장식이다.\n');
