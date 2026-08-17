/* noise.mjs — 이 하네스의 손이 얼마나 떨리는가.

   같은 코드를 여러 배치 돌려 **아무것도 안 바꿨을 때의 폭**을 잰다.
   그 폭이 곧 「이보다 작은 차이는 주장할 수 없다」는 선이고, 이
   프로젝트는 그 선을 몰라서 두 번 틀린 결론을 냈다(sim/_stat.mjs 참고).

   이 파일은 판정이 아니라 **자**다. 그래서 단언이 둘뿐이다:
     · 폭이 0이 아니다 — 0이면 재는 쪽이 고장 난 것이다
     · 폭이 중앙값보다 크지 않다 — 그러면 이 지표로는 아무것도 못 잰다

   나머지는 인쇄하고, 그 숫자를 다른 벤치들이 문턱으로 쓴다.

   usage: node sim/noise.mjs [배치수=3] [배치당 판수=40]           */
import { runBot } from './_botlib.mjs';
import { replicate, median } from './_stat.mjs';

const B = Number(process.argv[2] || 3);
const N = Number(process.argv[3] || 40);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

console.log(`\n잡음 벤치 — 아무것도 안 바꿨을 때 이 하네스가 흔들리는 폭 (${B}배치 × ${N}판)\n`);

/* 배치 하나를 돌리고 세 지표를 한꺼번에 얻는다. 따로 돌리면 배치가
   달라져 서로 다른 잡음을 재게 된다. */
function batch(seed) {
  const rows = [];
  for (let i = 0; i < N; i++)
    rows.push(runBot('human', CLASSES[(i + seed) % CLASSES.length], i % 2 === 0));
  const live = rows.filter(r => !r.stuck);
  return {
    depth: median(live.map(r => r.depth)),
    turns: median(live.map(r => r.turn)),
    stuck: rows.filter(r => r.stuck).length / rows.length * 100,
  };
}

const batches = [];
for (let i = 0; i < B; i++) batches.push(batch(i));

const show = (label, key, unit) => {
  const r = replicate(batches.length, i => batches[i][key]);
  console.log(`  ${r.line(label)}${unit ? ` (${unit})` : ''}`);
  return r;
};

const depth = show('도달 층 중앙값', 'depth', '층');
const turns = show('판당 턴 중앙값', 'turns', '턴');
const stuck = show('막힘 비율',      'stuck', '%');
console.log('');

ok(depth.spread > 0 || turns.spread > 0,
   '폭이 0이 아니다 — 0이면 배치가 서로 독립이 아니거나 재는 쪽이 굳은 것이다',
   `층 ±${depth.spread} · 턴 ±${turns.spread}`);
ok(turns.spread < turns.median,
   '판당 턴의 폭이 중앙값보다 작다 — 이보다 크면 이 지표로는 아무것도 판정할 수 없다',
   `폭 ${Math.round(turns.spread)} vs 중앙 ${Math.round(turns.median)}`);

console.log(`\n      이 값을 쓰는 법: 판당 턴으로 무엇을 주장하려면 차이가`
  + ` **${Math.round(turns.spread * 1.2)}턴**보다 커야 하고,`);
console.log(`      도달 층이면 **${(depth.spread * 1.2).toFixed(2)}층**보다 커야 한다.`);
console.log(`      그보다 작으면 「판정 불가」가 정직한 보고다.\n`);

console.log(bad ? `잡음 벤치: ${bad}건 실패\n` : '잡음 벤치: 자가 자로 쓸 만하다\n');
process.exit(bad ? 1 : 0);
