/* Six classes, same number of runs each. The question is whether
   the warrior stops being last, and whether giving it verbs moved
   anyone else. */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const { runBot } = await import('./_botlib.mjs');
Meta.forget();
const N = Number(process.argv[2] || 40);
const rows = [];
for (const cls of ['warrior','rogue','mage','priest','ranger','paladin']) {
  const d = [];
  let wins = 0, lv = 0;
  for (let i = 0; i < N; i++) {
    const r = runBot('human', cls, i % 2 === 0);
    d.push(r.depth); if (r.win) wins++; lv += r.lv || 0;
  }
  d.sort((a,b)=>a-b);
  const q = f => d[Math.min(d.length-1, Math.floor(d.length*f))];
  rows.push({ cls, avg: d.reduce((a,b)=>a+b,0)/d.length, med: q(0.5), top: q(0.9),
              deep: d.filter(x=>x>=11).length, wins, lv: lv/N });
}
rows.sort((a,b)=>b.avg-a.avg);
console.log(`── 직업별 ${N}판씩`);
for (const r of rows)
  console.log(`   ${r.cls.padEnd(8)} 평균 ${r.avg.toFixed(1).padStart(4)}층 · 중앙 ${String(r.med).padStart(2)} · 상위10% ${String(r.top).padStart(2)}` +
              ` · 11층+ ${String(r.deep).padStart(2)}/${N} · 승 ${r.wins} · Lv ${r.lv.toFixed(1)}`);

/* ── 단언 ──────────────────────────────────────────────────
   이 파일도 오래 인쇄만 했다. 그동안 이 표는 「전사 4.7층 꼴찌」에서
   「전사 6.7층 1등」으로 뒤집힌 적이 있는데(봇이 마을에서 소모품을
   전부 해체하고 있었다), 표가 뒤집혔다는 사실 자체를 아무도 실패로
   부르지 않았다. 그래서 무엇을 걸어야 하는지가 이 파일의 어려운
   부분이다 — 「전사가 1등이어야 한다」는 규칙이 아니라 취향이다.

   걸 수 있는 것은 **직업이 서로 다른 게임이면 안 된다**는 것 하나다.
   여섯 중 가장 깊이 가는 직업과 가장 얕은 직업의 차이가 판 전체
   길이의 절반을 넘으면, 그건 「직업 선택」이 아니라 「난이도 선택」이다.

   그리고 표본 검증. 잡음 벤치(sim/noise.mjs)가 잰 배치 간 폭이
   도달 층 ±1이므로, 이 차이는 그보다 확실히 커야 판정이 된다. */
let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`\n  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

const best = rows[0], worst = rows[rows.length - 1];
const gap = best.avg - worst.avg;
ok(rows.every(r => r.avg > 0), '여섯 직업이 전부 실제로 돌았다 — 0층짜리 줄은 측정이 아니라 사고다');
ok(gap < 7.5, '가장 깊은 직업과 가장 얕은 직업의 차이가 판 절반을 넘지 않는다 — 넘으면 직업이 아니라 난이도 선택이다',
   `${best.cls} ${best.avg.toFixed(1)} − ${worst.cls} ${worst.avg.toFixed(1)} = ${gap.toFixed(1)}층`);
ok(rows.some(r => r.wins > 0), '적어도 한 직업은 완주한다 — 아무도 못 끝내면 뒤쪽 층은 설계된 적이 없는 것이다');

console.log(bad ? `\n직업 벤치: ${bad}건 실패\n` : '\n직업 벤치: 여섯이 같은 게임을 한다\n');
process.exit(bad ? 1 : 0);
