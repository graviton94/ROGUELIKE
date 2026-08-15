/* ═══════════════════════════════════════════════════════════
   _stat.mjs — 배치 하나는 값이 아니다

   이 프로젝트에서 같은 실수를 두 번 했다. 둘 다 「배치 하나 대 배치
   하나」를 비교하고 그것을 발견이라고 불렀다:

     · 「열쇠 과업이 판당 1191턴을 1529턴으로 늘렸다」
       — 아무것도 안 바꾼 48판짜리 배치 셋의 중앙값이
         1315 / 1318 / 1639였다. 주장한 +338턴이 그 폭 안에 통째로
         들어간다. 그리고 그 문장 위에서 새 과업이 정당화되고 있었다.
     · 「어둠이 큰 한 방을 2.76배로 문다」
       — 같은 코드로 다섯 번 재니 6.07 / 0.50 / 3.20 / 2.18 / 1.52.

   두 번 다 숫자는 진짜였다. 틀린 것은 **표본이 하나였다는 것**이고,
   그건 눈으로는 절대 안 보인다 — 1191과 1498은 서로 다른 값처럼
   생겼다.

   그래서 규약을 코드로 만든다. 판당 턴·비율·평균 같은 「배치마다
   흔들리는 값」으로 무엇을 판정하려면 이 파일을 지나야 한다:

     const r = replicate(3, () => 한배치를_돌리고_값을_돌려준다());
     r.spread   배치들 사이의 폭 (최댓값 − 최솟값)
     r.median   배치 중앙값들의 중앙값
     r.decides(차이)  이 차이를 이 폭으로 판정할 수 있는가

   `decides()`가 거짓이면 그 비교는 **아직 아무 말도 하지 않은 것**
   이다. 그때 할 수 있는 정직한 보고는 「판정 불가, 폭 ±N」뿐이다.

   재는 것 자체가 느리다는 반론이 있다. 맞다 — 세 배치는 세 배 걸린다.
   하지만 한 배치로 내린 결론을 다음 사람이 세 배치로 뒤집는 데 드는
   시간은 그보다 훨씬 길고, 그 사이에 그 결론 위에 기능이 얹힌다.
   ═══════════════════════════════════════════════════════════ */

/* 중앙값. 꼬리가 극단적인 분포(한 배치에서 최대 20224턴)에서
   평균은 배치마다 튀므로, 이 프로젝트의 기본 요약값은 중앙값이다. */
export const median = a => {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};

export const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

/* 같은 설정을 n번 돌린다. 돌려주는 것은 값 하나가 아니라 **폭**이다 —
   이 파일의 요점이 그것이다. */
export function replicate(n, run) {
  const vals = [];
  for (let i = 0; i < n; i++) vals.push(run(i));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const spread = hi - lo;
  const mid = median(vals);
  return {
    vals, lo, hi, spread, median: mid,
    /* 이 차이를 이 폭으로 판정할 수 있는가. 배치들 사이의 폭보다
       작은 차이는 「같은 코드로도 나올 수 있는 차이」다. 여유를
       조금 더 둔다 — 세 배치의 폭은 참 폭의 과소평가다. */
    decides: diff => Math.abs(diff) > spread * 1.2,
    /* 사람이 읽을 한 줄. 벤치가 이 줄을 찍으면, 나중에 그 로그를
       보는 사람이 「이건 판정된 값인가」를 묻지 않아도 된다. */
    line(label) {
      return `${label} — 배치 ${vals.map(v => Math.round(v * 100) / 100).join(' / ')}`
        + ` · 중앙 ${Math.round(mid * 100) / 100} · 폭 ${Math.round(spread * 100) / 100}`
        + ` → 이 폭보다 작은 차이는 판정 불가`;
    },
  };
}

/* 두 설정을 각각 n배치씩 돌려 비교한다. 「A가 B보다 크다」를 말할
   자격이 있는지까지 같이 돌려준다.

   `verdict`는 셋 중 하나다:
     '차이 있음'   두 중앙값의 차이가 양쪽 폭보다 크다
     '판정 불가'   차이가 폭 안에 들어간다 — 아무 말도 하지 않은 것
     '같다'        차이가 폭의 4분의 1 아래 (그것도 하나의 발견이다) */
export function compare(n, runA, runB, label = '') {
  const A = replicate(n, runA), B = replicate(n, runB);
  const diff = B.median - A.median;
  const noise = Math.max(A.spread, B.spread);
  const verdict = Math.abs(diff) > noise * 1.2 ? '차이 있음'
                : Math.abs(diff) < noise * 0.25 ? '같다'
                : '판정 불가';
  return {
    A, B, diff, noise, verdict,
    line() {
      return `${label}\n      A ${A.vals.map(v => Math.round(v)).join(' / ')} (중앙 ${Math.round(A.median)})`
        + `\n      B ${B.vals.map(v => Math.round(v)).join(' / ')} (중앙 ${Math.round(B.median)})`
        + `\n      차이 ${Math.round(diff)} · 잡음 폭 ${Math.round(noise)} → ${verdict}`;
    },
  };
}
