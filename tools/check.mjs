/* 격자 검사기.
   node tools/check.mjs [이름,이름,...]

   16×16과 오탈자만 보는 게 아니라, 눈으로 놓치기 쉬운 두 가지를 같이
   잡습니다.

   · 대칭   — 좌우가 어긋난 행을 짚어 줍니다. 비대칭이 의도인 스프라이트는
              ASYMMETRIC 목록에 넣으면 조용해집니다.
   · 후광   — 실루엣 바깥 테두리가 그 안쪽보다 밝으면 경고합니다. 외곽선이
              속보다 밝으면 아웃라인이 아니라 후광으로 읽힙니다. */
import * as P from '../src/pixels.js';

const N = 16;
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;

/* 한쪽에만 물건이 붙는 것들. 좌우가 달라야 정상입니다. */
const ASYMMETRIC = new Set([
  'sword', 'dagger', 'great', 'axe', 'mace', 'spear', 'wand', 'gold',
  'rat', 'lean', 'dog', 'ashhound', 'anvil', 'doorBroken', 'rubble', 'thief',
  'stairsDown', 'stairsUp', 'web', 'water', 'bones', 'camp', 'campSpent',
]);

const keys = new Set(Object.keys(P.PALETTE).concat(['C', 'D', 'X']));
const lum = hex => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};
/* C/D는 굽는 시점에 정해지므로 밝기 검사에서는 중간값으로 봅니다. */
const lumOf = ch => ('CDX'.includes(ch) ? 120 : (P.PALETTE[ch] ? lum(P.PALETTE[ch]) : null));

let bad = 0, warn = 0;
const say = (m) => { console.log(m); };

function check(label, g, name) {
  if (!Array.isArray(g)) { say(`✗ ${label}: 배열이 아님`); bad++; return; }
  if (g.length !== N) { say(`✗ ${label}: ${g.length}행`); bad++; }

  g.forEach((line, i) => {
    if (line.length !== N) { say(`✗ ${label} ${i}행: ${line.length}글자  |${line}|`); bad++; }
    for (const ch of line) if (!keys.has(ch)) { say(`✗ ${label} ${i}행: 모르는 글자 '${ch}'`); bad++; }
  });

  // ── 대칭 ────────────────────────────────────────────────
  // 옆모습은 비대칭이 정상입니다.
  if (!ASYMMETRIC.has(name) && !label.endsWith('.side')) {
    const off = [];
    g.forEach((line, i) => {
      const l = line.padEnd(N, '.');
      if (l !== [...l].reverse().join('')) off.push(i);
    });
    if (off.length) { say(`⚠ ${label}: 좌우 비대칭 행 ${off.join(',')}`); warn++; }
  }

  // ── 후광 ────────────────────────────────────────────────
  /* 각 행에서 가장 바깥 칠해진 픽셀과 그 바로 안쪽을 비교합니다.
     바깥이 더 밝으면 외곽선이 아니라 테두리 조명입니다. */
  const halo = [];
  g.forEach((line, i) => {
    const l = [...line.padEnd(N, '.')];
    for (const dir of [1, -1]) {
      const start = dir === 1 ? 0 : N - 1;
      let a = -1;
      for (let k = 0; k >= 0 && k < N; k += dir) { if (l[start + (k * dir) - (dir === 1 ? 0 : 0)] !== '.') { a = start + k * dir; break; } if (start + k * dir === (dir === 1 ? N - 1 : 0)) break; }
      if (a < 0) continue;
      const b = a + dir;
      if (b < 0 || b >= N || l[b] === '.') continue;
      const la = lumOf(l[a]), lb = lumOf(l[b]);
      if (la != null && lb != null && la > lb + 30) halo.push(i);
    }
  });
  if (halo.length > 4) { say(`⚠ ${label}: 외곽이 속보다 밝음 (행 ${[...new Set(halo)].join(',')})`); warn++; }
}

const want = n => !only || only.has(n);

for (const [n, g] of Object.entries(P.SPRITES)) if (want(n)) check(`SPRITES.${n}`, g, n);
for (const [n, v] of Object.entries(P.RACE_BODY)) if (want(n))
  for (const view of P.VIEWS) check(`RACE_BODY.${n}.${view}`, v[view], n);
for (const [n, v] of Object.entries(P.CLASS_KIT)) if (want(n))
  for (const view of P.VIEWS) check(`CLASS_KIT.${n}.${view}`, v[view], n);

console.log(bad || warn
  ? `\n오류 ${bad} · 경고 ${warn}`
  : '\n전부 16×16, 오탈자 없음, 대칭 정상, 후광 없음');
