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
const seen = new Map();
const depth = (race, cls) => {
  const key = `${race}/${cls}`;
  if (seen.has(key)) return seen.get(key);
  const bat = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < N; i++) s += runBot(race, cls, i % 2 === 0).depth;
    bat.push(s / N);
  }
  const out = { m: bat.reduce((a, x) => a + x, 0) / B, w: Math.max(...bat) - Math.min(...bat) };
  seen.set(key, out);
  return out;
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

/* ── 이 자가 종족을 재고 있지 않았다 ─────────────────────
   최상 궁합끼리의 도달 층을 그냥 빼고 있었다. 그런데 종족마다 최상
   궁합이 **다른 직업**이고, 직업들끼리 이미 3.4층 벌어져 있다
   (sim/cls.mjs, 3배치×24판). 하프트롤의 최상은 전사이고 전사가 여섯 중
   다섯째이므로, 「하프트롤이 낮다」의 절반쯤은 하프트롤이 아니라 전사다.
   즉 이 뺄셈은 **직업 폭 + 종족 폭**을 재 놓고 종족 폭이라고 불렀다.

   그리고 문턱이 그 위에서 흔들렸다. `max(3.0, 배치폭×1.5)` 였는데
   배치 폭이 판마다 2.0~3.9로 움직여서 문턱이 3.0~5.85를 오갔다 —
   같은 나무에서 잰 차이는 4.42 · 4.97 · 5.60으로 거의 안 움직이는데
   **표본이 조용한 판에서만 벤치가 울었다.** 게임이 아니라 자가 흔들린
   것이고, 간헐적으로 우는 벤치는 안 우는 것만 못하다(§6-6).

   둘 다 고친다. **인간을 같은 직업으로 같이 굴려서 빼면** 직업이
   지워진다(인간의 보정은 전부 0이라 그 값이 곧 그 직업의 바닥이다).
   남는 것이 종족의 몫이고, 문턱은 그 몫에만 건다. 그리고 문턱은
   표본이 아니라 **배치 폭의 중앙값**에서 뽑는다 — 최댓값 하나는
   그 자체가 한 번 뽑은 값이라 문턱을 그것에 매달면 문턱도 같이 뛴다. */
console.log('');
console.log('  종족        최상 궁합 − 같은 직업의 인간');
const resid = best.map(([r, c, d]) => {
  const base = r === 'human' ? d : depth('human', c);
  return [r, c, d.m - base.m, d.w];
});
for (const [r, c, e] of resid)
  console.log('  ' + r.padEnd(11) + `${c} ${e >= 0 ? '+' : ''}${e.toFixed(2)}층`);
console.log('');
const es = resid.map(([, , e]) => e);
const lo = Math.min(...es), hi = Math.max(...es);
const worst = resid.find(([, , e]) => e === lo), top = resid.find(([, , e]) => e === hi);
const ws = best.map(([, , d]) => d.w).sort((a, b) => a - b);
const noise = ws[ws.length >> 1];
/* 문턱: 배치 폭 중앙값의 두 배, 최소 3.0. 두 배인 것은 뺄셈에 배치가
   둘 들어가기 때문이다(종족 하나와 인간 하나). */
const bar = Math.max(3.0, noise * 2);
ok(hi - lo <= bar,
   '직업을 지우고 나면 종족끼리는 비슷하다 — 최상 궁합으로도 뒤처지는 종족은 아무도 안 고른다',
   `${top[0]} ${hi >= 0 ? '+' : ''}${hi.toFixed(2)} ↔ ${worst[0]} ${lo.toFixed(2)} · 차 ${(hi - lo).toFixed(2)} · 문턱 ${bar.toFixed(1)} (배치 폭 중앙값 ${noise.toFixed(1)})`);
const lowest = Math.min(...best.map(([, , d]) => d.m));
const lowestR = best.find(([, , d]) => d.m === lowest);
ok(lowest >= 5.0, '최상 궁합이면 어느 종족이든 중반까지는 간다',
   `가장 낮은 ${lowestR[0]}(${lowestR[1]}) ${lowest.toFixed(2)}층`);

console.log(bad ? `\n종족 벤치: ${bad}건 실패\n` : '\n종족 벤치: 여덟 다 고를 만하다\n');
process.exit(bad ? 1 : 0);
