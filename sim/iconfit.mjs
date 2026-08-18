/* ═══════════════════════════════════════════════════════════
   iconfit.mjs — 아이콘 실루엣 탐침 (브라우저 없이)

   silhouette.mjs 는 **판정**하는 자다: 기준선보다 나빠졌으면 exit 1.
   그건 옳지만 느리다 — 포트를 띄우고 크로미움을 굽고 138장을 전부
   재고 나서야 「r_horn 이 r_seed 와 0.764」를 알려 준다. 그 한 줄을
   보려고 한 장 그릴 때마다 그걸 다 돌렸고, 두 번 다시 그려서 두 번
   더 나빠졌다. 자가 느리면 사람은 자를 덜 본다.

   그래서 같은 계산을 **순수 노드**로 다시 한다. bakeGrid 는 순수
   함수다: 8줄 격자를 16칸으로 펼치고, 채운 칸과 그 사방 한 칸을
   불투명으로 칠한다. 캔버스가 필요한 이유는 색뿐이고, 실루엣은
   색을 안 본다. 그래서 여기서는 캔버스 없이 같은 마스크를 만든다.

   대신 이 파일은 **아무것도 단언하지 않는다.** 기준선을 지키는 것은
   silhouette.mjs 의 일이고, 이 파일은 그 자가 무엇을 말할지 미리
   보여 주는 것까지만 한다. 두 자가 같은 숫자를 말하는지는 아래
   --check 로 확인한다.

   쓰는 법:
     node sim/iconfit.mjs                아이콘끼리 붐비는 순서
     node sim/iconfit.mjs --zone         3×3 모양 가족 인구조사 (빈 가족 찾기)
     node sim/iconfit.mjs --new a,b,c    이름 몇 개만 골라 이웃과 그림을 본다
     node sim/iconfit.mjs --show a,b     구운 16칸 마스크를 글자로 본다
   ═══════════════════════════════════════════════════════════ */
import { SPRITES, PALETTE } from '../src/pixels.js';

const CELL = 16, IOU_MAX = 0.70, FILL_MAX = 140;

/* bakeGrid 와 같은 순서로 펼친다. 흉내가 아니라 옮겨 적은 것이고,
   같은지는 --check 가 silhouette.mjs 의 출력과 맞춰 본다. */
export function maskOf(grid) {
  const n = Math.max(1, grid.length);
  const s = Math.max(1, Math.round(CELL / n));
  const key = [];
  for (let row = 0; row < CELL; row++) {
    const line = grid[Math.min(n - 1, (row / s) | 0)] || '';
    const out = [];
    for (let col = 0; col < CELL; col++) {
      let ch = line[Math.min(line.length - 1, (col / s) | 0)] || '.';
      if (ch === 'C') ch = 's';
      out.push(PALETTE[ch] ? ch : null);
    }
    key.push(out);
  }
  const m = new Uint8Array(CELL * CELL); let cnt = 0;
  const on = (r, c) => r >= 0 && c >= 0 && r < CELL && c < CELL && !!key[r][c];
  for (let r = 0; r < CELL; r++) for (let c = 0; c < CELL; c++) {
    if (on(r, c) || on(r - 1, c) || on(r + 1, c) || on(r, c - 1) || on(r, c + 1)) {
      m[r * CELL + c] = 1; cnt++;
    }
  }
  return { m, n: cnt };
}

export const iou = (A, B) => { let i = 0, u = 0;
  for (let k = 0; k < A.length; k++) { if (A[k] & B[k]) i++; if (A[k] | B[k]) u++; }
  return u ? i / u : 0; };

/* 3×3 가족. 8은 3으로 안 나뉘므로 0-2 / 3-5 / 6-7 로 자른다.
   한 구역은 두 칸 이상 채워졌을 때 「있다」로 센다 — 한 칸은 획이
   지나간 것이지 그 구역에 무언가 있는 것이 아니다. */
const ZONES = [[0, 3], [3, 6], [6, 8]];
export function zoneOf(grid) {
  let code = 0;
  for (let zr = 0; zr < 3; zr++) for (let zc = 0; zc < 3; zc++) {
    let k = 0;
    for (let r = ZONES[zr][0]; r < ZONES[zr][1]; r++)
      for (let c = ZONES[zc][0]; c < ZONES[zc][1]; c++)
        if (((grid[r] || '')[c] || '.') !== '.') k++;
    if (k >= 2) code |= 1 << (zr * 3 + zc);
  }
  return code;
}
const zoneArt = code => [0, 1, 2].map(zr =>
  [0, 1, 2].map(zc => (code >> (zr * 3 + zc)) & 1 ? '#' : '.').join('')).join('/');

const icons = Object.keys(SPRITES).filter(n => /^[ru]_/.test(n));
const M = {}; for (const n of icons) M[n] = maskOf(SPRITES[n]);

const argOf = f => { const i = process.argv.indexOf(f);
  return i < 0 ? null : (process.argv[i + 1] || '').split(',').filter(Boolean); };

/* maskOf·iou 를 남이 불러 쓸 수 있게 열어 뒀으므로, 불렀을 때 이 파일의
   보고서가 같이 쏟아지면 안 된다. 직접 돌렸을 때만 아래로 내려간다. */
const MAIN = process.argv[1] && process.argv[1].endsWith('iconfit.mjs');
if (!MAIN) { /* 라이브러리로 불렸다 */ } else {

const pairs = [];
for (let i = 0; i < icons.length; i++) for (let j = i + 1; j < icons.length; j++)
  pairs.push({ a: icons[i], b: icons[j], v: iou(M[icons[i]].m, M[icons[j]].m) });
pairs.sort((x, y) => y.v - x.v);

const show = names => {
  for (const n of names) {
    const g = SPRITES[n]; if (!g) { console.log(`   ? ${n} 없다`); continue; }
    const { m, n: fill } = M[n];
    console.log(`\n   ${n}  채움 ${fill}/${FILL_MAX}${fill > FILL_MAX ? ' ✘' : ''}  가족 ${zoneArt(zoneOf(g))}`);
    for (let r = 0; r < CELL; r++) {
      let raw = r < g.length * 2 ? (g[(r / 2) | 0] || '') : '';
      raw = [...Array(8)].map((_, c) => (raw[c] || '.') === '.' ? ' ' : '█').join('');
      let bak = ''; for (let c = 0; c < CELL; c++) bak += m[r * CELL + c] ? '█' : '·';
      console.log(`     ${r % 2 ? '        ' : raw}  ${bak}`);
    }
    const near = pairs.filter(p => p.a === n || p.b === n).slice(0, 3);
    for (const p of near)
      console.log(`     ↔ ${(p.a === n ? p.b : p.a).padEnd(14)} ${p.v.toFixed(3)}${p.v >= IOU_MAX ? '  ✘' : ''}`);
  }
};

if (argOf('--show')) { show(argOf('--show')); process.exit(0); }

if (argOf('--new')) {
  const sel = argOf('--new');
  console.log(`\n━━ 고른 ${sel.length}장 ━━`);
  show(sel);
  const bad = pairs.filter(p => p.v >= IOU_MAX && (sel.includes(p.a) || sel.includes(p.b)));
  console.log(`\n   이 ${sel.length}장이 낀 실패 쌍 ${bad.length}개`);
  for (const p of bad) console.log(`   ✘ ${p.a.padEnd(14)} ↔ ${p.b.padEnd(14)} ${p.v.toFixed(3)}`);
  process.exit(bad.length ? 1 : 0);
}

/* ── 어느 칸이 비어 있는가 ─────────────────────────────────
   가족 인구조사보다 이쪽이 실제로 쓸모가 있었다. 마흔일곱이 8×8 안에서
   **어느 칸을 쓰는지** 세어 보면, 붐빈다는 말이 어디가 붐빈다는 말인지
   나온다 — 그 차가운 칸에 획을 두면 IoU가 내려간다. 「가족을 고른다」
   보다 「빈 칸에 그린다」가 이 자에는 더 정직한 지시다. */
if (process.argv.includes('--heat')) {
  const base = icons.filter(n => !(argOf('--minus') || []).includes(n));
  const cnt = [...Array(64)].map(() => 0);
  for (const n of base) { const g = SPRITES[n];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
      if (((g[r] || '')[c] || '.') !== '.') cnt[r * 8 + c]++; }
  const mx = Math.max(...cnt);
  console.log(`\n━━ ${base.length}장이 쓰는 칸 (원본 8×8, 최대 ${mx}) ━━`);
  for (let r = 0; r < 8; r++)
    console.log('   ' + [...Array(8)].map((_, c) => String(cnt[r * 8 + c]).padStart(3)).join(''));
  const cold = cnt.map((v, i) => ({ v, r: (i / 8) | 0, c: i % 8 })).sort((a, b) => a.v - b.v);
  console.log(`\n   가장 찬 칸 여덟: ` + cold.slice(0, 8).map(o => `(${o.r},${o.c})=${o.v}`).join(' '));
  process.exit(0);
}

if (process.argv.includes('--zone')) {
  const fam = new Map();
  for (const n of icons) { const z = zoneOf(SPRITES[n]);
    if (!fam.has(z)) fam.set(z, []); fam.get(z).push(n); }
  console.log(`\n━━ 모양 가족 — 아이콘 ${icons.length}장이 ${fam.size} 가족을 쓴다 ━━`);
  for (const [z, list] of [...fam].sort((a, b) => b[1].length - a[1].length))
    console.log(`   ${zoneArt(z).padEnd(12)} ${String(list.length).padStart(2)}장  ${list.join(' ')}`);
  /* 아홉 구역 중 몇 개를 쓰는지로 묶어 보면, 어느 「굵기」가 비어
     있는지가 보인다 — 붐비는 것은 다섯~여섯 구역짜리다. */
  const byBits = new Map();
  for (const [z, list] of fam) { const b = z.toString(2).split('1').length - 1;
    byBits.set(b, (byBits.get(b) || 0) + list.length); }
  console.log(`\n   채운 구역 수별 장수:`);
  for (let b = 0; b <= 9; b++) console.log(`     ${b}구역  ${String(byBits.get(b) || 0).padStart(2)}장`);
  process.exit(0);
}

const over = pairs.filter(p => p.v >= IOU_MAX);
console.log(`\n━━ 아이콘 ${icons.length}장 · ${pairs.length}쌍 중 IoU ≥ ${IOU_MAX} 인 것 ${over.length} ━━`);
for (const p of over) console.log(`   ✘ ${p.a.padEnd(14)} ↔ ${p.b.padEnd(14)} ${p.v.toFixed(3)}`);
const worst = icons.map(n => ({ n, v: Math.max(...pairs.filter(p => p.a === n || p.b === n).map(p => p.v)),
                                f: M[n].n })).sort((x, y) => y.v - x.v);
console.log(`\n━━ 붐비는 순서 (가장 닮은 이웃) ━━`);
for (const w of worst.slice(0, 20))
  console.log(`   ${w.n.padEnd(14)} ${w.v.toFixed(3)}  채움 ${String(w.f).padStart(3)}`);
const fat = icons.filter(n => M[n].n > FILL_MAX);
console.log(`\n━━ 채움 > ${FILL_MAX} 인 아이콘 ${fat.length}장 ━━`);
console.log(`   ${fat.join(' ') || '없다'}`);
}
