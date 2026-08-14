/* verbs.mjs — 아래 줄의 버튼들이 실제로 몇 %의 턴에 살아 있는가.

   「문닫기 외침 거래 등등 버튼은 한번에 다 띄울 필요 없지않나?」

   느낌으로 고르면 안 된다. 자리를 합칠 수 있는 조건은 하나뿐이다:
   **두 버튼이 동시에 살아 있는 일이 없어야 한다.** 동시에 살 수
   있는 둘을 한 자리에 겹치면, 하나를 쓰는 동안 다른 하나가 사라진다
   — 그건 자리를 아낀 것이 아니라 기능을 뺏은 것이다.

   그래서 두 가지를 센다:
     · 각 버튼이 살아 있는 턴의 비율 (죽은 자리가 얼마나 되는가)
     · 두 버튼이 **동시에** 살아 있는 턴의 비율 (합칠 수 있는가)

   usage: node sim/verbs.mjs [판수=3]                */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const W = await import('../src/world.js');
const { runBot } = await import('./_botlib.mjs');
Meta.forget();

const N = Number(process.argv[2] || 3);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];

/* 화면이 읽는 것과 **같은 함수**로 판정한다. 여기서 따로 규칙을
   베껴 쓰면, 재는 것은 화면이 아니라 내가 상상한 화면이 된다. */
const VERBS = {
  '주문서':   g => Game.spellSlots().length > 0,
  '문 닫기':  g => !!Game.doorToClose(),
  '외침':     g => g.player?.stam >= 2,
  '발밑':     g => !!Game.hereOffer(),
  '쏘기':     g => !!Game.quiver(),
  '내려가기': g => g.level?.tiles[W.idx(g.player.x, g.player.y)] === W.DOWN,
  '올라가기': g => g.level?.tiles[W.idx(g.player.x, g.player.y)] === W.UP,
};
const NAMES = Object.keys(VERBS);

const live = Object.fromEntries(NAMES.map(k => [k, 0]));
const both = new Map();
let turns = 0;

for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    const onTurn = g => {
      if (!g.player || !g.level || g.depth < 1) return;
      turns++;
      const on = [];
      for (const k of NAMES) {
        let v = false;
        try { v = !!VERBS[k](g); } catch { v = false; }
        if (v) { live[k]++; on.push(k); }
      }
      for (let a = 0; a < on.length; a++)
        for (let b = a + 1; b < on.length; b++) {
          const key = `${on[a]} + ${on[b]}`;
          both.set(key, (both.get(key) || 0) + 1);
        }
    };
    runBot('human', cls, i % 2 === 0, { onTurn });
  }
}

const pct = v => (v * 100 / Math.max(1, turns));
console.log(`\n아래 줄의 버튼들 — ${turns}턴\n`);
console.log('살아 있는 턴의 비율:');
for (const k of NAMES.slice().sort((a, b) => live[b] - live[a]))
  console.log(`  ${k.padEnd(9)} ${pct(live[k]).toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(pct(live[k]) / 3))}`);

console.log('\n둘이 동시에 살아 있는 턴 (0%면 한 자리에 합쳐도 잃는 것이 없다):');
const pairs = [];
for (let a = 0; a < NAMES.length; a++)
  for (let b = a + 1; b < NAMES.length; b++) {
    const key = `${NAMES[a]} + ${NAMES[b]}`;
    pairs.push([key, both.get(key) || 0]);
  }
pairs.sort((x, y) => x[1] - y[1]);
for (const [key, n] of pairs) {
  const mark = n === 0 ? '합쳐도 된다' : '';
  console.log(`  ${key.padEnd(22)} ${pct(n).toFixed(1).padStart(5)}%  ${mark}`);
}
console.log('\n동시에 살 수 있는 둘을 한 자리에 겹치면, 자리를 아낀 것이 아니라 기능을 뺏은 것이다.\n');
