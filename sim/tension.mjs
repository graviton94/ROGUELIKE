/* tension.mjs — 판이 긴장하는가.

   whodies가 말한 것: 죽기 10턴 전 체력 70%, 5턴 전 68%. 죽음이
   5턴짜리 절벽이라는 뜻이고, 그것은 곧 판의 대부분을 멀쩡한 몸으로
   걸었다는 뜻이다. 멀쩡하면 결정이 없다 — 물약을 아낄 이유도,
   물러설 이유도, 불을 아낄 이유도 없다.

   그래서 잰다: 한 판의 턴을 어느 체력 대역에서 보내는가, 그리고
   한 층에 몇 턴을 쓰는가. 앞의 것이 「쉽다」이고 뒤의 것이 「루즈하다」다.

   usage: node sim/tension.mjs [runs]             */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 5);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];
const band = new Array(10).fill(0);
const perFloor = new Map();
let runs = 0, depth = 0, turns = 0, won = 0;

for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    const r = runBot('human', cls, i % 2 === 0);
    runs++; depth += r.depth; turns += G.turn || 0; if (r.win) won++;
    (G.hpBand || []).forEach((v, k) => band[k] += v);
    for (const [d, t] of Object.entries(G.floorTurns || {})) {
      const k = Number(d);
      perFloor.set(k, (perFloor.get(k) || 0) + t);
      perFloor.set(k + '_n', (perFloor.get(k + '_n') || 0) + 1);
    }
  }
}
const sum = band.reduce((a, b) => a + b, 0) || 1;

console.log(`\n판이 긴장하는가 — ${runs}판 · 평균 ${(depth/runs).toFixed(1)}층 · 판당 ${(turns/runs).toFixed(0)}턴 · 완주 ${won}`);
console.log('\n턴을 어느 체력에서 보냈나:');
for (let k = 9; k >= 0; k--) {
  const pct = band[k] * 100 / sum;
  console.log(`  ${String(k*10).padStart(3)}–${k*10+10}%  ${String(Math.round(pct)).padStart(3)}%  ${'█'.repeat(Math.round(pct/2))}`);
}
const safe = (band[7] + band[8] + band[9]) * 100 / sum;
const edge = (band[0] + band[1] + band[2]) * 100 / sum;
console.log(`\n  체력 70% 위에서 보낸 턴  ${Math.round(safe)}%`);
console.log(`  체력 30% 아래에서 보낸 턴 ${Math.round(edge)}%   ← 여기가 긴장이다`);

console.log('\n한 층에 몇 턴을 쓰나:');
const floors = [...perFloor.keys()].filter(k => typeof k === 'number').sort((a, b) => a - b).slice(0, 12);
for (const d of floors) {
  const n = perFloor.get(d + '_n') || 1;
  const t = Math.round(perFloor.get(d) / n);
  console.log(`  ${String(d).padStart(2)}층  ${String(t).padStart(4)}턴  ${'▪'.repeat(Math.min(40, Math.round(t / 8)))}`);
}
console.log('\n멀쩡한 채로 오래 걸으면, 쉬운 것이 아니라 아무 일도 없는 것이다.\n');
