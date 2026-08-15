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
/* 결정이 바뀌는 구간. 30% 아래는 「죽기 직전」이고 그건 드물어야
   맞다 — 물어야 할 것은 오히려 **물약을 쓸지 말지가 고민이 되는
   구간에 얼마나 있는가**다. 그리고 30% 아래를 정수로 찍었더니
   0.42%가 「0%」로 인쇄되어, 움직인 것을 안 움직인 것으로 읽었다.
   소수점 한 자리를 남긴다. */
const hurt = (band[3] + band[4] + band[5]) * 100 / sum;
console.log(`\n  체력 70% 위에서 보낸 턴  ${safe.toFixed(1)}%`);
console.log(`  체력 30~55%에서 보낸 턴 ${hurt.toFixed(1)}%   ← 결정이 바뀌는 구간`);
console.log(`  체력 30% 아래에서 보낸 턴 ${edge.toFixed(1)}%   ← 여기가 긴장이다`);

console.log('\n한 층에 몇 턴을 쓰나:');
const floors = [...perFloor.keys()].filter(k => typeof k === 'number').sort((a, b) => a - b).slice(0, 12);
for (const d of floors) {
  const n = perFloor.get(d + '_n') || 1;
  const t = Math.round(perFloor.get(d) / n);
  console.log(`  ${String(d).padStart(2)}층  ${String(t).padStart(4)}턴  ${'▪'.repeat(Math.min(40, Math.round(t / 8)))}`);
}
console.log('\n멀쩡한 채로 오래 걸으면, 쉬운 것이 아니라 아무 일도 없는 것이다.\n');

/* ── 단언 ──────────────────────────────────────────────────
   이 파일은 오래 「인쇄만 하는 벤치」였다. 그래서 82% / 0%라는 값이
   여러 회차에 걸쳐 그대로 살아남았다 — 아무도 그것을 실패로 부르지
   않았기 때문이다. 이제 부른다.

   다만 문턱을 「긴장이 있어야 한다」에 걸면 이 파일은 오늘부터 영원히
   빨갛고, 영원히 빨간 벤치는 꺼진 벤치다. 그래서 둘로 나눈다:
     · **회귀**는 지금 막는다 — 더 평평해지는 것은 실패다.
     · **목표**는 인쇄한다 — 이 줄이 0에서 움직이는 날이 2차의 끝이다.

   그리고 표본이 진짜인지부터 묻는다. 봇이 걷는 라이브락에 갇혀 있던
   동안 이 벤치는 「한 층에서 수천 턴」을 그대로 평균에 넣고 있었다. */
let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

ok(sum > 5000, '잰 턴이 실제로 있다 — 표본이 얇으면 아래 비율은 아무 말도 아니다',
   `${sum}턴`);
/* 82%가 지금 값이다. 85%를 넘으면 그것은 「더 안전해졌다」이고,
   이 게임에서 그것은 개선이 아니다. */
ok(safe <= 85, '체력 70% 위에서 보낸 턴이 85%를 넘지 않는다 — 넘으면 판이 더 평평해진 것이다',
   `${Math.round(safe)}%`);
console.log(`\n      목표: 체력 30% 아래에서 보낸 턴 ${edge.toFixed(1)}% → 5% 이상.`);
console.log('      이 줄이 움직이는 날이 「긴장」 작업이 끝나는 날이다.');
console.log('      지금까지 안 통한 것 셋을 여기 적어 둔다 — 다음 사람이 같은 길을 두 번 가지 않도록:');
console.log('        · 물약 공급  — 한 병도 안 산 봇에서도 이 값은 그대로였다');
console.log('        · 흐름장 포위 — 82% → 75%(안전 구간)를 줬지만 아래쪽은 안 움직였다');
console.log('        · 이탈 비용  — 규칙은 판당 28번 발화하는데(따라붙기) 3배치 복제로 판정 불가');
console.log('      합으로 보면 싸움은 이미 팽팽하다: 깊은 층에서 죽이는 데 4.5합, 죽는 데 3합.');
console.log('      그런데도 안 깎이는 이유는 **맞지를 않아서**다 — 다음 지렛대는 회피와 명중이다.\n');

console.log(bad ? `긴장 벤치: ${bad}건 실패\n` : '긴장 벤치: 회귀 없음 (긴장은 아직 없다)\n');
process.exit(bad ? 1 : 0);
