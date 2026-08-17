/* ═══════════════════════════════════════════════════════════
   race.mjs — 종족이 고를 만한가

   플레이어: 「테스트할때는 그냥 종족별 최상조합 직업으로, 최악조합
   직업으로 비교해. **최악의 선택은 유저가 한 것이고 시스템이 완화해
   줄 필요가 없음.**」

   맞는 지적이고, 그 전까지 이 저장소가 종족을 재던 방식이 틀려
   있었다: 여덟 종족을 **전부 전사로** 굴리고 순위를 매겼다. 엘프를
   전사로 재는 것은 엘프에 대해 아무것도 안 말한다 — 그 판은 플레이어가
   안 고를 판이다.

   ── 궁합은 손으로 안 박는다 ────────────────────────────
   「엘프는 마법사」라고 적어 두면 표가 바뀌어도 벤치는 옛말을 한다.
   CLASS_BAND(직업이 어떤 능력치를 원하는가)와 RACES.mod(종족이 어떤
   능력치를 주는가)를 곱해서 **그때그때 계산한다.** 밴드를 손보면
   궁합도 따라 움직인다.

   ── 무엇을 통과로 보는가 ────────────────────────────────
   **최상 궁합 열에만 문턱을 둔다.** 최악 궁합은 찍어서 보여 주되
   판정하지 않는다 — 하프트롤 마법사가 3층에서 죽는 것은 고장이 아니라
   그 선택의 값이다. 여기에 완화를 넣으면 종족을 고르는 일 자체가
   의미를 잃는다.

   usage: node sim/race.mjs [판수]
   ═══════════════════════════════════════════════════════════ */
import { CLASS_BAND, BANDS, RACES, STATS } from '../src/data.js';
const { runBot } = await import('./_botlib.mjs');

const N = Number(process.argv[2] || 20), B = 3;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };

/* 직업이 각 능력치를 얼마나 원하는가 — 밴드 중앙값이 평균에서 벗어난 만큼. */
const mid = b => { const [l, h] = BANDS[b]; return (l + h) / 2; };
const want = c => {
  const b = CLASS_BAND[c], m = STATS.map(k => mid(b[k]));
  const avg = m.reduce((a, x) => a + x, 0) / m.length;
  return Object.fromEntries(STATS.map((k, i) => [k, (m[i] - avg) / 4]));
};
const W = Object.fromEntries(Object.keys(CLASS_BAND).map(c => [c, want(c)]));
const fitOf = (race, cls) =>
  STATS.reduce((s, k) => s + (RACES[race].mod[k] || 0) * W[cls][k], 0);

/* 3배치 복제. 한 배치로 읽으면 ±1.5층이 그냥 흔들린다 — 실제로 같은
   설정에서 하프트롤이 5.98과 8.36으로 나온 적이 있다. */
const depth = (race, cls) => {
  const bat = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < N; i++) s += runBot(race, cls, i % 2 === 0).depth;
    bat.push(s / N);
  }
  return { m: bat.reduce((a, x) => a + x, 0) / B, w: Math.max(...bat) - Math.min(...bat) };
};

console.log(`\n종족 벤치 — 고를 만한가 (${B}배치 × ${N}판)\n`);
console.log('  종족        최상 궁합              최악 궁합');

const best = [];
for (const r of Object.keys(RACES)) {
  const sc = Object.keys(CLASS_BAND).map(c => [c, fitOf(r, c)]).sort((a, b) => b[1] - a[1]);
  const [bc] = sc[0], [wc] = sc[sc.length - 1];
  const bd = depth(r, bc), wd = depth(r, wc);
  best.push([r, bc, bd]);
  console.log('  ' + r.padEnd(11)
    + `${bc} ${bd.m.toFixed(2)}층 (±${bd.w.toFixed(1)})`.padEnd(23)
    + `${wc} ${wd.m.toFixed(2)}층 (±${wd.w.toFixed(1)})`);
}

/* ── 판정은 최상 궁합에만 ────────────────────────────────
   종족을 제대로 고른 판은 서로 비슷해야 한다. 한 종족만 유독 낮으면
   그건 「어려운 종족」이 아니라 **아무도 안 고를 종족**이다. */
console.log('');
const ms = best.map(([, , d]) => d.m);
const lo = Math.min(...ms), hi = Math.max(...ms);
const worst = best.find(([, , d]) => d.m === lo), top = best.find(([, , d]) => d.m === hi);
/* 문턱은 배치 폭에서 나온다 — 노이즈보다 작은 차이를 잡으면 벤치가
   제 그림자를 쫓는다. */
const noise = Math.max(...best.map(([, , d]) => d.w));
ok(hi - lo <= Math.max(3.0, noise * 1.5),
   '제대로 고른 판끼리는 비슷하다 — 최상 궁합으로도 뒤처지는 종족은 아무도 안 고른다',
   `${top[0]}(${top[1]}) ${hi.toFixed(2)} ↔ ${worst[0]}(${worst[1]}) ${lo.toFixed(2)} · 차 ${(hi - lo).toFixed(2)} · 배치 폭 ${noise.toFixed(1)}`);
ok(lo >= 5.0, '최상 궁합이면 어느 종족이든 중반까지는 간다', `가장 낮은 ${worst[0]} ${lo.toFixed(2)}층`);

console.log(bad ? `\n종족 벤치: ${bad}건 실패\n` : '\n종족 벤치: 여덟 다 고를 만하다\n');
process.exit(bad ? 1 : 0);
