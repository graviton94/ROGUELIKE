/* ═══════════════════════════════════════════════════════════
   silhouette.mjs — 실루엣 린트

   1회차 감사에서 실측한 것: 몬스터 26종이 세 실루엣을 나눠 쓰고
   (`ogre↔warden` IoU 1.000, `dog↔ashhound` 0.973), 사물 넷은
   서로 **완전히 같은 그림**이다 (`stairsDown↔stairsUp` 1.000,
   `door↔doorLocked` 1.000, `chest↔barrel` 1.000, `urn↔well` 1.000).
   원인은 하나다 — 채움률 평균 82%. 82%를 채운 그림에는 실루엣이 없다.

   이 파일은 그것을 **자동으로** 잰다. 세 규칙:

     R1  같은 층대(±2층)에서 만날 수 있는 몬스터끼리 IoU < 0.70
     R2  사물끼리 IoU < 0.70 (사물은 층을 안 가리므로 전부가 「같은 층대」다)
     R3  구운 그림의 불투명 픽셀 ≤ 140 / 256

   ── 지금은 대량으로 실패한다. 그게 정상이다. ──
   단언을 느슨하게 만들어 통과시키면 안 된다. 그 대신 **현재 상태를
   기준선으로 박아 두고, 「이보다 나빠지지 않는다」만 단언한다.**
   아래 인쇄되는 실패 목록이 곧 재작업 순서다 — 위에서부터 고치면
   되고, 하나 고칠 때마다 BASE의 숫자를 내려 적으면 된다.

   BASE를 **올려** 적는 커밋은 회귀다. 그럴 때만 이 린트가 일한다.

   쓰는 법:
     node sim/silhouette.mjs           재고, 기준선과 비교하고, 나빠졌으면 exit 1
     node sim/silhouette.mjs --print   지금 값으로 새 BASE를 찍어 준다 (고친 뒤에만)
   포트 8199에 정적 서버가 떠 있어야 한다.
   ═══════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';

const IOU_MAX  = 0.70;
const FILL_MAX = 140;          // 256칸 중 (= 54.7%)
const NEAR     = 2;            // 「같은 층대」 = 대표 깊이 차 ±2층

/* ── 기준선 ────────────────────────────────────────────────
   2026-08-15 실측. 전부 실패 개수이고, 전부 0이 되어야 할 숫자다. */
const BASE = {
  monPairsOver:  74,     // 같은 층대 몬스터 106쌍 중 IoU ≥ 0.70 인 것 — 70%
  monWorst:   0.984,     // 그중 최악값 (ogre ↔ troll, troll ↔ warden)
  propPairsOver: 11,     // 사물 45쌍 중 IoU ≥ 0.70 — 24% (계단·문 넷을 다시 그려 29에서 내려왔다)
  propWorst:      1,     // stairsDown ↔ stairsUp ↔ door ↔ doorLocked, 넷이 같은 그림
  fillOver:      60,     // 채움 > 140 인 스프라이트 수 (전체 76장, 63에서)
  fillWorst:    254,     // 칸을 통째로 채운 것 — 실루엣이 없다는 뜻
  fauxEight:     68,     // 16줄 주소를 쓰면서 2×2 덩어리뿐인 「실질 8×8」
};

const port = process.env.PORT || 8199;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 400, height: 400 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(`http://localhost:${port}/index.html`, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1000);

const r = await pg.evaluate(async ({ NEAR }) => {
  const P = await import('/src/pixels.js');
  const D = await import('/src/data.js');
  const CELL = P.CELL_SIZE;
  P.bakeAll(new Set(D.MONSTERS.map(m => m.spr)));

  const cv = document.createElement('canvas'); cv.width = CELL; cv.height = CELL;
  const cx = cv.getContext('2d');
  const maskOf = name => {
    cx.clearRect(0, 0, CELL, CELL);
    cx.drawImage(P.sprite(name), 0, 0);
    const d = cx.getImageData(0, 0, CELL, CELL).data;
    const m = new Uint8Array(CELL * CELL); let n = 0;
    for (let i = 0; i < CELL * CELL; i++) if (d[i * 4 + 3] >= 128) { m[i] = 1; n++; }
    return { m, n };
  };
  const iou = (A, B) => { let i = 0, u = 0;
    for (let k = 0; k < A.length; k++) { if (A[k] & B[k]) i++; if (A[k] | B[k]) u++; }
    return u ? i / u : 0; };

  /* 몬스터는 data.js에서 나온다 — 여기 손으로 적지 않는다.
     손으로 적은 목록은 몬스터를 하나 더 넣는 날 조용히 어긋난다. */
  const depth = {};
  for (const m of D.MONSTERS) (depth[m.spr] = depth[m.spr] || []).push(m.d);
  const mon = Object.keys(depth).filter(n => P.hasSprite(n));

  /* 사물은 층을 안 가린다 — 계단·문·상자·통·항아리·우물은
     한 층에 전부 같이 있을 수 있으므로 전부가 같은 층대다. */
  const props = ['stairsDown', 'stairsUp', 'door', 'doorOpen', 'doorLocked', 'doorBroken',
                 'chest', 'barrel', 'urn', 'well'].filter(n => P.hasSprite(n));

  const all = Object.keys(P.SPRITES).filter(n => P.hasSprite(n));
  const M = {}; for (const n of new Set([...all, ...mon, ...props])) M[n] = maskOf(n);

  const monPairs = [];
  for (let i = 0; i < mon.length; i++) for (let j = i + 1; j < mon.length; j++) {
    const a = mon[i], c = mon[j];
    let near = false;
    for (const x of depth[a]) for (const y of depth[c]) if (Math.abs(x - y) <= NEAR) near = true;
    if (!near) continue;
    monPairs.push({ a, b: c, v: iou(M[a].m, M[c].m) });
  }
  monPairs.sort((x, y) => y.v - x.v);

  const propPairs = [];
  for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++)
    propPairs.push({ a: props[i], b: props[j], v: iou(M[props[i]].m, M[props[j]].m) });
  propPairs.sort((x, y) => y.v - x.v);

  const fills = all.map(n => ({ n, v: M[n].n })).sort((x, y) => y.v - x.v);

  /* ── 실질 8×8 ─────────────────────────────────────────
     16줄 주소를 쓰면서 2×2 덩어리로만 그린 그림. 눈이 2×2면
     그건 16칸 그림이 아니라 확대한 8칸 그림이다. */
  const faux = [];
  for (const n of all) {
    const g = P.SPRITES[n]; if (!g || g.length < 16) { faux.push(n); continue; }
    let blocky = true;
    for (let r2 = 0; r2 < 16 && blocky; r2 += 2)
      for (let c2 = 0; c2 < 16 && blocky; c2 += 2) {
        const a = (g[r2] || '')[c2] || '.';
        if (((g[r2] || '')[c2 + 1] || '.') !== a || ((g[r2 + 1] || '')[c2] || '.') !== a
         || ((g[r2 + 1] || '')[c2 + 1] || '.') !== a) blocky = false;
      }
    if (blocky) faux.push(n);
  }
  return { CELL, monPairs, propPairs, fills, faux, mon: mon.length, props: props.length };
}, { NEAR });

const f3 = v => v.toFixed(3);
const monOver  = r.monPairs.filter(p => p.v >= IOU_MAX);
const propOver = r.propPairs.filter(p => p.v >= IOU_MAX);
const fillOver = r.fills.filter(f => f.v > FILL_MAX);

console.log(`\n실루엣 린트 — ${r.CELL}×${r.CELL} · 몬스터 ${r.mon}종 · 사물 ${r.props}종`);

console.log(`\n━━ R1  같은 층대(±${NEAR}) 몬스터 IoU < ${IOU_MAX} ━━`);
console.log(`   ${monOver.length}/${r.monPairs.length} 쌍 실패  (기준선 ${BASE.monPairsOver})`);
for (const p of monOver.slice(0, 25))
  console.log(`   ✘ ${p.a.padEnd(12)} ↔ ${p.b.padEnd(12)} ${f3(p.v)}`);
if (monOver.length > 25) console.log(`   … 그리고 ${monOver.length - 25}쌍 더`);

console.log(`\n━━ R2  사물 IoU < ${IOU_MAX} ━━`);
console.log(`   ${propOver.length}/${r.propPairs.length} 쌍 실패  (기준선 ${BASE.propPairsOver})`);
for (const p of propOver)
  console.log(`   ✘ ${p.a.padEnd(12)} ↔ ${p.b.padEnd(12)} ${f3(p.v)}`);

console.log(`\n━━ R3  채움 ≤ ${FILL_MAX}/256 ━━`);
console.log(`   ${fillOver.length}/${r.fills.length} 장 실패  (기준선 ${BASE.fillOver})`);
for (const f of fillOver.slice(0, 20))
  console.log(`   ✘ ${f.n.padEnd(12)} ${String(f.v).padStart(3)}/256  ${(f.v * 100 / 256).toFixed(0)}%`);
if (fillOver.length > 20) console.log(`   … 그리고 ${fillOver.length - 20}장 더`);

console.log(`\n━━ 참고  16줄 주소를 쓰는 실질 8×8 ━━`);
console.log(`   ${r.faux.length}장  (기준선 ${BASE.fauxEight})`);
console.log(`   ${r.faux.join(' ')}`);

const now = {
  monPairsOver: monOver.length,
  monWorst: +f3(r.monPairs[0]?.v || 0),
  propPairsOver: propOver.length,
  propWorst: +f3(r.propPairs[0]?.v || 0),
  fillOver: fillOver.length,
  fillWorst: r.fills[0]?.v || 0,
  fauxEight: r.faux.length,
};

if (process.argv.includes('--print')) {
  console.log('\n새 BASE (고친 뒤에만 붙여 넣을 것):');
  console.log(JSON.stringify(now, null, 2).replace(/"/g, ''));
}

/* ── 단언: 기준선보다 나빠지지 않는다 ─────────────────────── */
const bad = [];
for (const k of Object.keys(BASE))
  if (now[k] > BASE[k]) bad.push(`${k}  ${BASE[k]} → ${now[k]}  (나빠졌다)`);
const better = Object.keys(BASE).filter(k => now[k] < BASE[k]);

console.log('\n━━ 회귀 판정 ━━');
for (const k of Object.keys(BASE))
  console.log(`   ${k.padEnd(14)} 기준 ${String(BASE[k]).padStart(6)}  지금 ${String(now[k]).padStart(6)}  ` +
              (now[k] < BASE[k] ? '↓ 좋아졌다 (BASE를 내려 적을 것)' : now[k] > BASE[k] ? '↑ 회귀' : '='));
if (errs.length) console.log(`\n콘솔 오류 ${errs.length}: ${errs[0]}`);

await b.close();

if (bad.length) {
  console.log('\n실패 — 실루엣이 기준선보다 나빠졌다:');
  for (const l of bad) console.log('  ' + l);
  process.exit(1);
}
if (better.length) console.log(`\n통과. ${better.length}개 항목이 기준선보다 좋아졌다 — BASE를 내려 적어 잠가 두십시오.`);
else console.log('\n통과 (기준선 유지). 이 목록이 재작업 순서다.');
process.exit(0);
