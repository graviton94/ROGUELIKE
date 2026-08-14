/* drops.mjs — 한 판에 실제로 몇 개가 손에 들어오는가.

   「유물 너무 많이 나오고, 희귀장비도 너무 많이 나옴.」

   이 파일은 그 말을 숫자로 만든다. 지금까지 낙하는 표에 적힌 확률로만
   있었고(loot.mjs가 한 번의 굴림을 재고, offer.mjs가 선택 화면을 잰다),
   **한 판을 끝까지 살았을 때 손에 몇 개가 쌓이는가**는 아무도 안 셌다.
   확률 하나하나가 멀쩡해도 그것들이 열다섯 층 동안 곱해지면 다른
   이야기가 된다 — 그게 지금 일어난 일이다.

   그리고 유물은 두 번 세야 한다. 얼마나 나오는가와, 그중 몇이 **동시에
   손에 있는가**. 융합은 둘을 같이 들고 있어야 일어나므로, 흔하게
   나오는데 융합이 안 되면 그건 확률 문제가 아니라 자리 문제다.

   usage: node sim/drops.mjs [판수]                        */
import { runBot } from './_botlib.mjs';

const RUNS = Number(process.argv[2] || 60);

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] || 0; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

console.log(`\n낙하 벤치 — 한 판에 실제로 몇 개가 손에 들어오는가 (${RUNS}판)\n`);

const D = await import('../src/data.js');

/* 두 벌을 잰다.
   · 보통 판 — 봇이 자기 힘으로 간 만큼. 층당 비율의 근거다.
   · 오래 사는 판 — 체력만 올려 열다섯 층까지 밟게 한 판. 「한 판에
     몇 개」의 근거다. 확률은 손대지 않았으므로 층당 비율은 같아야
     하고, 다르면 그건 층이 깊을수록 더 나온다는 뜻이다.
   손잡이를 안 쓰면 3층에서 죽은 판으로 열다섯 층 이야기를 하게 된다. */
const plain = [], long = [];
for (let i = 0; i < RUNS; i++) plain.push(await runBot('human', 'warrior', 8));
for (let i = 0; i < RUNS; i++) long.push(await runBot('human', 'warrior', 15, { tough: 12 }));
const rows = plain;

/* runBot이 무엇을 돌려주는지에 기대지 않고, 없는 값은 0으로 센다 —
   하네스가 조용히 필드를 빼면 벤치가 「0개」로 통과해 버린다. */
const has = k => rows.some(r => r[k] !== undefined);
console.log('      하네스가 돌려주는 값:',
  Object.keys(rows[0] || {}).filter(k => typeof rows[0][k] === 'number').join(' '));
console.log('');

const report = (name, set) => {
  const d = set.map(r => Math.max(1, r.depth || 1));
  const per = (k) => avg(set.map((r, i) => (r[k] || 0) / d[i]));
  console.log(`\n  ── ${name}  (도달 층 중앙값 ${med(d)})`);
  console.log(`     유물     한 판 ${avg(set.map(r => r.relicsTaken || 0)).toFixed(1)}개`
    + ` · 층당 ${per('relicsTaken').toFixed(2)}`
    + ` · 최대 ${Math.max(...set.map(r => r.relicsTaken || 0))}`);
  console.log(`     고유무기 한 판 ${avg(set.map(r => r.uniques || 0)).toFixed(1)}자루`
    + ` · 층당 ${per('uniques').toFixed(2)} (전체 ${D.UNIQUES.length}자루)`);
  console.log(`     장비     한 판 ${avg(set.map(r => r.gearTaken || 0)).toFixed(1)}점`
    + ` · 그중 접두·접미 붙은 것 ${avg(set.map(r => r.rareTaken || 0)).toFixed(1)}점`
    + ` (${Math.round(avg(set.map(r => r.rareTaken || 0)) / Math.max(0.01, avg(set.map(r => r.gearTaken || 0))) * 100)}%)`);
  /* 봇은 모닥불에서 융합을 **안 한다**. 그러니 여기서 물을 것은
     「일어났는가」가 아니라 「일어날 수 있었는가」다. */
  console.log(`     융합기회 ${set.filter(r => r.fusable).length}/${set.length}판에서 짝이 손에 있었다`
    + ` · 끝에 들고 있는 유물 중앙값 ${med(set.map(r => r.relics || 0))}칸`);
};
report('보통 판', plain);
report('오래 사는 판 (체력 ×12)', long);

/* 어디서 나오는가. 이걸 안 세고 정예 확률만 깎았다가, 층당 0.85가
   0.83으로밖에 안 떨어지는 것을 보고서야 주범이 딴 데 있다는 걸 알았다. */
const src = {};
for (const r of long) for (const [k, v] of Object.entries(r.relicSrc || {})) src[k] = (src[k] || 0) + v;
const tot = Object.values(src).reduce((a, c) => a + c, 0) || 1;
console.log('\n  ── 유물이 어디서 나오는가 (오래 사는 판 합계)');
for (const [k, v] of Object.entries(src).sort((a, b) => b[1] - a[1]))
  console.log(`     ${k.padEnd(12)} ${String(v).padStart(4)}개  ${String(Math.round(v / tot * 100)).padStart(3)}%`);
console.log('');

/* ── 지켜야 할 선 ────────────────────────────────────────
   숫자를 재기만 하고 잠그지 않으면, 다음에 누가 확률 하나를 만졌을 때
   조용히 되돌아간다. 아래 값은 전부 이 파일이 실제로 잰 값에서 왔고,
   여유를 조금씩 뒀다 — 봇 스무남은 판은 흔들리니까. */
const perFloor = (set, k) => avg(set.map(r => (r[k] || 0) / Math.max(1, r.depth || 1)));
const rareShare = set => avg(set.map(r => r.rareTaken || 0)) / Math.max(0.01, avg(set.map(r => r.gearTaken || 0)));

console.log('');
ok(perFloor(long, 'relicsTaken') <= 0.85,
   '유물이 층당 0.85개를 안 넘는다 — 규칙을 바꾸는 물건이 층마다 하나씩 나오면 그건 장비다',
   perFloor(long, 'relicsTaken').toFixed(2));
ok(rareShare(long) <= 0.6,
   '주운 장비의 60% 아래만 접두·접미를 단다 — 절반이 희귀하면 희귀한 것이 없다',
   `${Math.round(rareShare(long) * 100)}%`);
ok(perFloor(long, 'uniques') <= 0.5,
   '고유무기가 층당 0.5자루를 안 넘는다', perFloor(long, 'uniques').toFixed(2));
/* 정예 낙하는 층당 하나로 잠겨 있다. 확률만으로는 못 막는다 —
   오래 사는 판은 한 판에 정예를 서른 마리씩 잡으므로. */
const eliteRelics = long.reduce((a, r) => a + ((r.relicSrc || {})['정예'] || 0), 0);
const floors = long.reduce((a, r) => a + Math.max(1, r.depth || 1), 0);
ok(eliteRelics <= floors,
   '정예에게서 나온 유물이 밟은 층수를 안 넘는다 — 층당 하나로 잠겨 있다',
   `${eliteRelics}개 / ${floors}층`);
ok(long.filter(r => r.fusable).length >= long.length * 0.25,
   '오래 사는 판 넷 중 하나 이상에서 융합 짝이 손에 있다 — 짝을 안 맞춰 주면 0/25다',
   `${long.filter(r => r.fusable).length}/${long.length}판`);

console.log(bad ? `\n낙하 벤치: ${bad}건 실패\n` : '\n낙하 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
