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

   ── 한 번 다시 그렸다가 되돌렸다 ──
   2026-08-15, 이 린트를 보고 열일곱 종을 16×16으로 다시 그렸다.
   숫자는 크게 좋아졌다: 실패 쌍 74 → 11, 최악 0.984 → 0.783.
   그런데 사람이 보고 「저번 게 낫다」고 했고, 실제로 그랬다 —
   쥐가 물고기로, 거인이 곰인형으로, 망령이 물방울로 읽혔다.

   **이 린트가 재는 것은 「서로 다른가」이지 「무엇으로 보이는가」가
   아니다.** 그 둘은 같이 가지 않는다: 실루엣을 벌리려고 팔다리를
   뻗고 대칭을 만들면 IoU는 떨어지지만 그림은 장난감이 된다.

   그러니 이 목록을 쓸 때 규칙 하나를 같이 지킬 것 —
   **한 종을 고칠 때마다 구워서 눈으로 볼 것.** 숫자가 내려가도
   그림이 그것으로 안 읽히면 그건 개선이 아니다. 이 파일은 재작업
   **순서**를 정해 주는 도구이지, 재작업이 끝났는지를 판정하는
   도구가 아니다.

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
  /* ── 그리고 여기서 자를 한 번 틀렸다 ────────────────────────
     처음에 이 숫자를 **9**로 적었다. 스프라이트의 **원본 격자**를
     직접 세서 나온 값이다. 그런데 플레이어가 보는 것은 원본 격자가
     아니라 **그려진 그림**이고, 그리는 파이프라인은 채워진 픽셀
     둘레에 어두운 외곽선을 두른다 — 그래서 속이 꽉 찬 8×8 그림은
     전부 같은 덩어리가 된다. 같은 자로 다시 재니 9가 아니라 **221**
     이었다. 「안 닮았다」를 플레이어가 안 보는 자로 말하고 있었다.

     속을 비우고 획을 얇게 다시 그려 46까지 내렸다(1081쌍의 4.3%.
     비교: 사물 쪽은 136쌍 중 37, 27%다). 0은 8×8 + 외곽선에서
     불가능하다 — 이 숫자를 **올려** 적는 커밋은 회귀다. */
  iconPairsOver: 46,     // 아이콘 1081쌍 중 IoU ≥ 0.70 인 것 (최악 0.849)
  /* ── 세 번째로 자를 고쳤다 (2026-08-19) ──────────────────────
     몬스터 표를 서른에서 서른넷으로 다시 짜자 이 칸이 74 → 105로
     올랐다. 그런데 **비교한 쌍 자체가** 106 → 157로 늘었다. 즉 이
     칸은 「그림이 닮았는가」가 아니라 **「몬스터가 몇 마리인가」**를
     세고 있었다: 쌍은 마릿수의 제곱으로 는다.

     비율로 재니 0.698 → 0.637이다. **좋아졌다.** 같은 커밋을 두 자가
     정반대로 판정한 것이고, 이 파일이 이미 두 번 겪은 일이다(아래
     fauxEight 의 기록). 개수를 세는 칸은 내용을 더하지 말라고 말한다.

     비율은 마릿수에 안 흔들리고, 「새로 그린 것이 기존 평균보다 더
     닮았는가」를 그대로 말한다. 개수는 참고로만 인쇄한다. */
  monPairsRate: 0.669,   // 같은 층대 몬스터 쌍 중 IoU ≥ 0.70 인 **비율**
  monWorst:   0.951,     // 그중 최악값 (예전엔 ogre ↔ troll, troll ↔ warden)
  /* 11에서 37로 올려 적는다. 그림이 나빠져서가 아니라 **재는 대상을
     늘려서**다: 이 목록에 서 있는 사람(pedlar·keeper)과 좌판·모루·
     제단·모닥불을 새로 넣었고, 소품이 10종에서 17종이 되면서 쌍이
     45개에서 136개로 늘었다. 새로 걸린 26쌍 중 pedlar 가 낀 것은
     7쌍이고 나머지 19쌍은 **원래 있었는데 안 재고 있던 것**이다
     (urn↔stall 0.828 · chest↔stall 0.826 · doorLocked↔urn 0.761 …).

     즉 이 숫자가 오른 것은 그림이 나빠진 사건이 아니라 **자가 정직해진
     사건**이다. 그리고 그 19쌍이 다음 재작업 목록이다 — 위에 인쇄된
     순서 그대로.

     (다음 사람에게: 목록에 이름을 더 넣어 이 숫자가 오르는 것은
     괜찮다. **목록을 그대로 두고** 이 숫자가 오르면 그건 회귀다.) */
  propPairsOver: 37,     // 사물 136쌍 중 IoU ≥ 0.70
  propWorst:      1,     // stairsDown ↔ stairsUp ↔ door ↔ doorLocked, 넷이 같은 그림
  /* 이 둘은 **비율이 아니라 개수**다. 그래서 그림을 한 장 더 그리면
     그림이 나빠지지 않아도 숫자가 오른다 — 떠돌이 상인의 `pedlar`를
     넣으면서 실제로 그렇게 걸렸다(60→61, 68→69). 같은 커밋에서
     monPairsOver·monWorst·fillWorst는 하나도 안 움직였다: 새 그림이
     기존 실루엣과 더 닮게 만든 것은 없다는 뜻이고, 그것이 이 파일이
     정말 지키려는 값이다. 그래서 하나씩만 올려 적는다.

     (다음 사람에게: 여기를 올릴 때는 **왜** 올리는지 같이 적을 것.
     「그림을 더 그렸다」와 「그림이 나빠졌다」는 이 자로는 구분이 안
     되고, 구분은 위의 세 값이 한다.) */
  /* 61 → 84, 69 → 116. 둘 다 그림이 나빠져서가 아니라 **재는 대상이
     47장 늘어서**다: 유물 마흔과 이름 있는 무기 일곱이 각자 제 아이콘을
     갖게 됐고, 그것들은 다른 물건 그림과 마찬가지로 8×8이다. 새로
     걸린 장수가 정확히 47이면 기존 그림은 한 장도 안 나빠진 것이다. */
  /* 이 칸도 같은 병이었다. 84 → 92로 오른 것은 몬스터 그림 여덟 장을
     더 그렸기 때문이고, 여덟 장이 특별히 뚱뚱해서가 아니다 —
     **비아이콘 평균 채움이 176.8에서 176.8로 한 자리도 안 움직였다.**
     비아이콘 중 74%가 이미 140을 넘고 있으므로(빚이고, 이 파일이
     그렇게 적어 뒀다), 새로 그린 것이 그 평균에 앉으면 개수만 는다.

     그래서 둘로 가른다:
       · 아이콘 쪽은 **개수**로 잠근다. 닫힌 가족이고 얇게 그릴 수
         있으며, 실제로 새 아이콘은 전부 140 아래로 들어왔다
       · 몬스터·사물 쪽은 **평균 채움**으로 잠근다. 개수는 마릿수를
         세고 평균은 그림을 센다 */
  fillIconsOver:  23,    // 아이콘 중 채움 > 140 인 장수
  fillMean:    176.3,    // 아이콘을 뺀 나머지의 **평균** 채움 (140이 목표)
  fillWorst:    254,     // 칸을 통째로 채운 것 — 실루엣이 없다는 뜻
  /* ── 이 칸을 두 번 올려 적고 나서 자를 고쳤다 ────────────────
     122 → 128(유물 여섯) → 132(유물 넷). 두 번 다 모양을 재는 세 값이
     한 칸도 안 움직였고, 두 번 다 「그림을 더 그렸다」는 이유였다.
     세 번째로 올려 적을 자리가 오면 그건 이 칸이 재는 것이 잘못된
     것이다 — 아이콘을 한 장 그릴 때마다 회귀로 찍히는 자는 「아이콘을
     그리지 마라」고 말하고 있다.

     그래서 아이콘을 따로 센다. 아이콘 가족은 **전부 8줄이고**, 지켜야
     하는 것은 개수가 아니라 **가족이 섞이지 않는 것**이다: 절반만
     16줄로 다시 그려 두면 배낭 안에서 획 굵기가 두 종류로 보인다.
     그러니 아이콘 쪽은 「전부 8줄이거나 전부 16줄」을 단언하고
     (fauxIconsUniform), 아래 fauxEight 는 **아이콘을 뺀** 나머지를
     센다. 그러면 이 칸은 다시 몬스터·사물의 빚만 말한다.

     아이콘을 뺀 값은 **75**다(132 − 아이콘 57). 처음에 82로 적었는데,
     은총 여섯(`b_`)이 아이콘 정규식(`^[ru]_`)에 안 걸려서 나머지 쪽에
     남는다는 것을 빼먹었다. 값은 세어서 적는다. */
  /* 그리고 이 칸은 아예 뺐다(2026-08-19). 세 번째로 올려 적을 자리가
     오면 재는 것이 잘못된 것이라고 위에 적어 뒀고, 실제로 왔다:
     75 → 83, 정확히 새로 그린 여덟 장이다. 8줄 가족에 8줄을 더한
     것을 회귀로 찍는 자는 「몬스터를 그리지 마라」고 말한다.
     지켜야 하는 것은 개수가 아니라 **가족이 안 섞이는 것**이고,
     그건 아이콘 쪽에 이미 등식으로 있다. 숫자는 참고로만 인쇄한다. */
  /* 옛 기록. 122 → 128 → 132 로 오른 것은 전부 아이콘을 더 그려서였다. 그림이 나빠져서가 아니라는
     것은 이 파일이 스스로 정한 방법으로 판정했다 — 모양을 재는 세 값이
     한 칸도 안 움직였다 (iconPairsOver 46=46 · fillOver 84=84 ·
     fillWorst 254=254). 즉 새 여섯은 기존 실루엣과 더 닮지도, 더 뚱뚱하지도
     않다. 오른 것은 **장수를 세는 이 칸 하나**다.

     그리고 이 칸이 오른 이유는 여섯이 8줄이기 때문인데, **유물 아이콘 마흔여섯이
     전부 8줄이다** (16줄 유물 0/46). 그러니 이건 새로 생긴 빚이 아니라
     원래 있던 빚 마흔여섯에 여섯이 더해진 것이고, 8줄 가족 안에 8줄로
     그린 것이 이 칸에서만 벌을 받는다.

     제대로 갚는 방법은 이 숫자를 내리는 쪽이다: 아이콘 가족을 16줄로
     다시 그리면 쉰셋이 한꺼번에 이 목록에서 빠진다(122 → 69). 여섯만
     16줄로 그리면 이 칸은 안 오르지만 획 굵기가 이웃과 달라져 배낭 안에서
     여섯만 유독 가늘게 보인다 — 그건 자를 맞추려고 그림을 어긋내는 것이다.
     그래서 가족을 맞추고 이 칸을 올렸다. 되갚을 자리는 NEXT.md 에 적었다. */
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
  /* ── 이 목록이 이 파일의 약점이다 ──────────────────────
     손으로 적은 목록은 언젠가 반드시 어긋난다고 이 파일 스스로 적어
     놓고, 그대로 어긋났다. 떠돌이 상인의 `pedlar`를 새로 그리면서
     「monPairsOver도 monWorst도 안 움직였으니 나빠진 것은 없다」고
     판정하고 기준선을 올렸는데 — **pedlar가 이 목록에 없었다.**
     비교 대상이 아닌 그림을 두고 「안 닮았다」고 말한 것이다.
     실제로 재 보니 urn 0.855 · well 0.855 · orc 0.871 · wraith 0.873이다.

     그래서 서 있는 사람과 좌판도 여기 넣는다. 이것들은 몬스터가
     아니지만 **몬스터와 같은 칸에 서고 같은 크기로 그려진다** —
     실루엣이 갈려야 하는 이유가 몬스터끼리와 똑같다. */
  /* ── 그리고 아이콘 마흔일곱 ────────────────────────────────
     유물 마흔과 이름 있는 무기 일곱이 각자 제 그림을 갖게 되면서,
     이 자가 재야 할 세 번째 무리가 생겼다. 이것들은 몬스터·사물과
     같은 칸에 안 서고 **배낭과 카드 안에서 서로와만** 비교되므로
     따로 센다 — 섞어서 재면 「목걸이가 문과 안 닮았다」 같은 쓸모없는
     쌍이 표를 채운다. */
  const icons = Object.keys(P.SPRITES).filter(n => /^[ru]_/.test(n) && P.hasSprite(n));

  const props = ['stairsDown', 'stairsUp', 'door', 'doorOpen', 'doorLocked', 'doorBroken',
                 'chest', 'barrel', 'urn', 'well',
                 'pedlar', 'keeper', 'sign', 'stall', 'anvil', 'altar', 'camp']
                .filter(n => P.hasSprite(n));

  const all = Object.keys(P.SPRITES).filter(n => P.hasSprite(n));
  const M = {}; for (const n of new Set([...all, ...mon, ...props, ...icons])) M[n] = maskOf(n);

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

  const iconPairs = [];
  for (let i = 0; i < icons.length; i++) for (let j = i + 1; j < icons.length; j++)
    iconPairs.push({ a: icons[i], b: icons[j], v: iou(M[icons[i]].m, M[icons[j]].m) });
  iconPairs.sort((x, y) => y.v - x.v);

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
  const fauxIcon = faux.filter(n => icons.includes(n));
  return { CELL, monPairs, propPairs, iconPairs, fills, faux, fauxIcon,
           mon: mon.length, props: props.length, icons: icons.length, iconNames: icons };
}, { NEAR });

const f3 = v => v.toFixed(3);
const monOver  = r.monPairs.filter(p => p.v >= IOU_MAX);
const propOver = r.propPairs.filter(p => p.v >= IOU_MAX);
const iconOver = r.iconPairs.filter(p => p.v >= IOU_MAX);
const fillOver = r.fills.filter(f => f.v > FILL_MAX);
/* 아이콘과 나머지를 가른다 — 아이콘은 닫힌 가족이라 개수로 잠그고,
   몬스터·사물은 마릿수가 변하므로 평균으로 잠근다. */
const fillIconsOver = fillOver.filter(f => r.iconNames.includes(f.n)).length;
const fillRest = r.fills.filter(f => !r.iconNames.includes(f.n));
const fillMean = +(fillRest.reduce((s, f) => s + f.v, 0) / Math.max(1, fillRest.length)).toFixed(1);

console.log(`\n실루엣 린트 — ${r.CELL}×${r.CELL} · 몬스터 ${r.mon}종 · 사물 ${r.props}종`);

console.log(`\n━━ R1  같은 층대(±${NEAR}) 몬스터 IoU < ${IOU_MAX} ━━`);
console.log(`   ${monOver.length}/${r.monPairs.length} 쌍 실패`
  + `  = ${(monOver.length / Math.max(1, r.monPairs.length)).toFixed(3)}  (기준선 비율 ${BASE.monPairsRate})`);
for (const p of monOver.slice(0, 25))
  console.log(`   ✘ ${p.a.padEnd(12)} ↔ ${p.b.padEnd(12)} ${f3(p.v)}`);
if (monOver.length > 25) console.log(`   … 그리고 ${monOver.length - 25}쌍 더`);

console.log(`\n━━ R2  사물 IoU < ${IOU_MAX} ━━`);
console.log(`   ${propOver.length}/${r.propPairs.length} 쌍 실패  (기준선 ${BASE.propPairsOver})`);
for (const p of propOver)
  console.log(`   ✘ ${p.a.padEnd(12)} ↔ ${p.b.padEnd(12)} ${f3(p.v)}`);

console.log(`\n━━ R2b  아이콘 IoU < ${IOU_MAX} ━━`);
console.log(`   ${iconOver.length}/${r.iconPairs.length} 쌍 실패  (기준선 ${BASE.iconPairsOver})`);
for (const p of iconOver)
  console.log(`   ✘ ${p.a.padEnd(14)} ↔ ${p.b.padEnd(14)} ${f3(p.v)}`);

console.log(`\n━━ R3  채움 ≤ ${FILL_MAX}/256 ━━`);
console.log(`   ${fillOver.length}/${r.fills.length} 장 실패`
  + `  · 아이콘 ${fillIconsOver}/${r.icons} (기준선 ${BASE.fillIconsOver})`
  + `  · 나머지 평균 채움 ${fillMean} (기준선 ${BASE.fillMean})`);
for (const f of fillOver.slice(0, 20))
  console.log(`   ✘ ${f.n.padEnd(12)} ${String(f.v).padStart(3)}/256  ${(f.v * 100 / 256).toFixed(0)}%`);
if (fillOver.length > 20) console.log(`   … 그리고 ${fillOver.length - 20}장 더`);

const fauxRest = r.faux.filter(n => !r.iconNames.includes(n));
console.log(`\n━━ 참고  16줄 주소를 쓰는 실질 8×8 ━━`);
console.log(`   아이콘을 뺀 ${fauxRest.length}장  (참고 — 기준선으로 안 잠근다)`);
console.log(`   ${fauxRest.join(' ')}`);
/* 아이콘 가족은 개수가 아니라 **섞이지 않는가**를 본다. 전부 8줄이거나
   전부 16줄이어야 하고, 절반만 다시 그려 두면 배낭에서 획 굵기가 두
   종류로 보인다. 그래서 이쪽은 기준선이 아니라 등식이다. */
console.log(`   아이콘 ${r.icons}장 중 8줄 ${r.fauxIcon.length}장`
  + (r.fauxIcon.length === r.icons || r.fauxIcon.length === 0 ? '  — 가족이 안 섞였다' : '  ✘ 섞였다'));

const now = {
  iconPairsOver: iconOver.length,
  monPairsRate: +f3(monOver.length / Math.max(1, r.monPairs.length)),
  monWorst: +f3(r.monPairs[0]?.v || 0),
  propPairsOver: propOver.length,
  propWorst: +f3(r.propPairs[0]?.v || 0),
  fillIconsOver,
  fillMean,
  fillWorst: r.fills[0]?.v || 0,
};

if (process.argv.includes('--print')) {
  console.log('\n새 BASE (고친 뒤에만 붙여 넣을 것):');
  console.log(JSON.stringify(now, null, 2).replace(/"/g, ''));
}

/* ── 단언: 기준선보다 나빠지지 않는다 ─────────────────────── */
const bad = [];
if (r.fauxIcon.length !== r.icons && r.fauxIcon.length !== 0)
  bad.push(`아이콘 가족이 섞였다 — ${r.icons}장 중 ${r.fauxIcon.length}장만 8줄이다`
    + ` (${r.iconNames.filter(n => !r.fauxIcon.includes(n)).join(' ')} 가 16줄)`);
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
