/* turns.mjs — 한 판의 턴은 무엇으로 이루어져 있는가.
   ("what is a turn actually made of?")

   reach.mjs가 「콘텐츠는 96% 닿는다」를 보여 준 뒤에도 판은 재미없었다.
   그러면 문제는 콘텐츠가 아니라 **콘텐츠 사이의 거리**다. 그래서 이번엔
   무엇이 있는지가 아니라, 플레이어가 실제로 무엇을 하며 시간을 보내는지를
   센다. 걷기만 하는 턴이 대부분이면, 그 판은 내용이 아무리 많아도
   대부분의 시간이 비어 있는 것이다. 고칠 곳이 다르다.

   집계는 game.js의 endTurn 한 곳에서만 한다 (G.did). 행동이 자기 이름을
   남기지 않은 턴은 걷기다.

   usage: node sim/turns.mjs [runs]                */
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
const NAMES = { walk:'그냥 걸었다', shout:'외쳤다', wait:'기다렸다', fight:'때렸다', shoot:'쏘았다', cast:'주문을 썼다',
                pick:'주웠다', use:'소모품을 썼다', open:'무언가를 열었다' };

const total = {};
const perClass = {};
let runs = 0, depth = 0, turns = 0, shouts = 0, drawn = 0;

for (const cls of CLASSES) {
  const mine = {};
  for (let i = 0; i < N; i++) {
    const r = runBot('human', cls, i % 2 === 0);
    runs++; depth += r.depth; turns += G.turn || 0;
    shouts += G.shouts || 0; drawn += G.drawn || 0;
    for (const [k, v] of Object.entries(G.did || {})) {
      total[k] = (total[k] || 0) + v;
      mine[k] = (mine[k] || 0) + v;
    }
  }
  perClass[cls] = mine;
}

const sum = Object.values(total).reduce((a, b) => a + b, 0);
console.log(`\n한 턴은 무엇인가 — ${CLASSES.length}직업 × ${N}판 = ${runs}판 · 평균 ${(depth/runs).toFixed(1)}층 · 판당 ${(turns/runs).toFixed(0)}턴\n`);

const watched = total.walkSeen || 0; delete total.walkSeen;
for (const cls of CLASSES) delete perClass[cls].walkSeen;
for (const [k, v] of Object.entries(total).sort((a, b) => b[1] - a[1])) {
  const pct = v * 100 / sum;
  console.log(`  ${String(Math.round(pct)).padStart(3)}%  ${'█'.repeat(Math.round(pct/2)).padEnd(50, '·')}  ${NAMES[k] || k}`);
}

console.log(`\n걷는 턴 ${total.walk} 중 적이 눈에 있던 것 ${watched} — ${Math.round(watched*100/Math.max(1,total.walk))}%`);
console.log(`나머지 ${Math.round((total.walk-watched)*100/Math.max(1,total.walk))}%는 아무것도 보이지 않는 채로 걸은 턴이다.`);

console.log(`외침 ${shouts}회 · 불러온 것 ${drawn}`);
console.log('\n직업별 (걷기 % / 싸움 % — 싸움은 때리기+쏘기+주문):');
for (const cls of CLASSES) {
  const m = perClass[cls];
  const s = Object.values(m).reduce((a, b) => a + b, 0) || 1;
  const fightPct = ((m.fight||0) + (m.shoot||0) + (m.cast||0)) * 100 / s;
  console.log(`  ${cls.padEnd(8)}  걷기 ${String(Math.round((m.walk||0)*100/s)).padStart(3)}%   싸움 ${String(Math.round(fightPct)).padStart(3)}%`);
}
console.log(`\n걷기가 크면 「내용이 없는 게임」이 아니라 「내용 사이가 먼 게임」이다.\n`);
