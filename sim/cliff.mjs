/* cliff.mjs — 죽음이 절벽인가 비탈인가.

   whodies가 말한 것: 끝나기 10턴 전 체력 70%, 5턴 전 68%. 그리고
   죽음. 열 턴 동안 2%p를 잃고 다섯 턴 만에 68%를 잃는다는 뜻이고,
   그것이 「판의 대부분을 멀쩡하게 걷는다」의 진짜 원인이었다.
   회복이 후한 게 아니라, 죽기 직전까지 아무 일도 안 일어난다.

   그래서 마지막 스무 턴의 체력을 그대로 찍어 본다. 한 방이
   최대 체력의 몇 %를 가져가는지도 같이 센다 — 상한은 거기에 걸려
   있으므로, 분포의 오른쪽 꼬리가 잘렸는지가 곧 규칙이 물었는지다.

   usage: node sim/cliff.mjs [판수=6]                  */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 6);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];
const TAIL = 20;

/* 마지막 턴들의 체력을 봇 바깥에서 찍는다. 게임에 탐침용 배열을
   심지 않는다 — 규칙 파일은 규칙만 안다. */
const tail = new Array(TAIL).fill(0).map(() => []);
const blows = [];
let runs = 0, deaths = 0, wounds = 0;

for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    const seen = [];
    let lastHp = null;
    /* 매 턴 체력 비율과, 직전 턴 대비 떨어진 폭을 기록한다.
       떨어진 폭이 곧 「한 방」이다 — 회복은 음수가 되므로 버린다.
       (한 턴에 둘이 때리면 둘이 합쳐 한 건으로 세어진다. 상한이
       한 방마다 걸리므로 여기 숫자는 상한보다 커질 수 있고,
       그것은 오류가 아니라 「둘러싸였다」는 뜻이다.) */
    const onTurn = g => {
      const p = g.player;
      if (!p || !p.maxhp) return;
      seen.push(p.hp / p.maxhp);
      if (lastHp !== null && lastHp > p.hp) blows.push((lastHp - p.hp) / p.maxhp);
      lastHp = p.hp;
    };
    const r = runBot('human', cls, i % 2 === 0, { onTurn });
    runs++;
    if (!r.win) deaths++;
    wounds += (G.player?.wound || 0) / Math.max(1, (G.player?.maxhp || 1) + (G.player?.wound || 0));
    const cut = seen.slice(-TAIL);
    for (let k = 0; k < cut.length; k++) tail[TAIL - cut.length + k].push(cut[k]);
  }
}

const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log(`\n절벽 벤치 — ${runs}판 · 죽음 ${deaths}\n`);
console.log('끝나기 전 마지막 스무 턴의 체력:');
for (let k = 0; k < TAIL; k++) {
  const v = avg(tail[k]) * 100;
  console.log(`  −${String(TAIL - k).padStart(2)}턴  ${String(Math.round(v)).padStart(3)}%  ${'█'.repeat(Math.round(v / 3))}`);
}

blows.sort((a, b) => a - b);
const q = f => blows.length ? blows[Math.floor(blows.length * f)] : 0;
console.log(`\n한 번에 잃은 체력 (${blows.length}건):`);
console.log(`  가운데값 ${(q(0.5) * 100).toFixed(1)}%  ·  상위 5% ${(q(0.95) * 100).toFixed(1)}%  ·  최대 ${(blows.at(-1) * 100).toFixed(1)}%`);
console.log(`  최대 체력의 30%를 넘긴 한 방: ${(blows.filter(b => b > 0.30).length * 100 / Math.max(1, blows.length)).toFixed(1)}%`);
console.log(`\n죽을 때 상처로 잃은 몸: 평균 ${(wounds / runs * 100).toFixed(0)}%\n`);
