/* 초안 생성기 — 참고 자세를 16×16 격자 문자열로 떨어뜨린다.
   node tools/trace.mjs <프리셋> <방향>

   손으로 그릴 때 내가 반복해서 틀린 것은 색이 아니라 **비율과 명암
   배치**였습니다. 머리가 몸에 비해 얼마나 큰지, 어깨가 어디서
   시작하는지, 어느 면이 밝은지. 그건 자를 대고 재면 되는 것이므로
   재게 만들었습니다.

   원본 색은 한 톨도 넘어오지 않습니다. 넘어오는 것은 두 가지뿐이고,

     · 실루엣과 명암의 **구조**  — 여기가 밝고 여기가 어둡다
     · 부위별 **덩어리**        — 여긴 머리카락, 여긴 갑옷

   픽셀은 전부 우리 PALETTE 의 재질 계단으로 다시 찍습니다. 재질은
   색을 보고 맞히지 않고 참고본의 레이어 이름에서 가져옵니다 — 색으로
   맞히면 어두운 외곽선이 보라로 새고 살빛이 빨강으로 샙니다.

   나오는 것은 완성품이 아니라 **밑그림**입니다. 얼굴은 8×7 로 줄이면
   반드시 뭉개지므로 눈·입은 이 위에 손으로 얹습니다.

   참고본은 저장소에 넣지 않습니다. 실행하려면:
     LPC=/받아둔/경로 node tools/trace.mjs warrior down
*/
import { decode, blank, blit, bounds, scale, fill, encode } from './png.mjs';
import { PALETTE } from '../src/pixels.js';

const ROOT = (process.env.LPC || '/tmp/lpc') + '/spritesheets/';
const F = 64;
const ROW = { up: 8, left: 9, down: 10, right: 11 };

/* ── 우리 재질 계단 ────────────────────────────────────────
   어두운 쪽부터 넷. 0번은 그 재질의 외곽선 단계입니다. */
export const RAMPS = {
  skin:   ['0', 'H', 'h', 'a'],
  hair:   ['1', 'n', 'N', 'M'],
  wood:   ['1', 'n', 'N', 'M'],
  linen:  ['9', 'u', 'w', 'W'],
  bone:   ['9', 'u', 'w', 'W'],
  steel:  ['2', 'd', 's', 'S'],
  stone:  ['2', 'd', 'g', 'G'],
  gold:   ['3', 'o', 'y', 'Y'],
  red:    ['4', 'r', 'R', 'x'],
  green:  ['5', 'e', 'E', 'F'],
  blue:   ['6', 'b', 'B', 'I'],
  violet: ['7', 'p', 'P', 'V'],
  teal:   ['8', 'c', 't', 'T'],
  tint:   ['X', 'D', 'C', 'L'],       // 직업 색으로 구워질 자리
};

const cache = new Map();
const load = p => { if (!cache.has(p)) cache.set(p, decode(ROOT + p)); return cache.get(p); };

export function composite(layers, dir, f = 0) {
  const out = blank(F, F);
  for (const p of layers) {
    if (!p) continue;
    try { blit(out, load(p), f * F, ROW[dir] * F, F, F, 0, 0); } catch { }
  }
  return out;
}

/* ── 줄이기 ────────────────────────────────────────────────
   칸 하나가 원본의 여러 픽셀을 덮습니다. 불투명 비율이 문턱을 넘으면
   칠하고, 밝기는 그 칸의 평균으로 잡습니다.                  */
function reduce(img, W, H, box, cover = 0.34) {
  const cells = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const sx0 = box.x0 + (x * box.w) / W, sx1 = box.x0 + ((x + 1) * box.w) / W;
      const sy0 = box.y0 + (y * box.h) / H, sy1 = box.y0 + ((y + 1) * box.h) / H;
      let on = 0, all = 0, L = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
          if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue;
          all++;
          const o = (sy * img.w + sx) * 4;
          if (img.px[o + 3] < 128) continue;
          on++;
          L += 0.299 * img.px[o] + 0.587 * img.px[o + 1] + 0.114 * img.px[o + 2];
        }
      }
      row.push(all && on / all >= cover ? { lum: L / on } : null);
    }
    cells.push(row);
  }
  return cells;
}

/* ── 대두로 고쳐 쌓기 ──────────────────────────────────────
   참고본은 사실적 비율이라 머리가 키의 1/6 입니다. 16칸 안에서 그
   비율이면 얼굴에 눈 둘 자리도 안 나옵니다. 그래서 머리와 몸을
   **다른 배율로** 줄여 쌓습니다 — 자세와 명암은 참고본에서 가져오고
   비율은 우리가 정합니다. 포켓몬도 마인크래프트도 뱀서도 전부
   대두입니다.                                                */
export function draft(groups, dir, opt = {}) {
  const {
    headW = 8, bodyW = 12, bodyH = 9, split = 0.29, N = 16,
  } = opt;
  /* 머리는 1행부터, 몸은 바닥에서 bodyH 만큼. 둘이 겹치면 나중에 놓는
     머리가 몸통을 지웁니다 — 거인의 가슴이 통째로 날아갔던 자리입니다.
     목 한 줄만 겹치도록 머리 높이를 깎습니다.                  */
  const headH = Math.max(4, Math.min(opt.headH ?? 7, N - bodyH));

  /* 장비만 따로 뽑을 때도 **몸과 같은 자**로 재야 층이 겹칩니다.
     frame 을 주면 크기는 거기서 재고 그림은 groups 만 그립니다. */
  const full = composite((opt.frame || groups).flatMap(g => g.layers), dir);
  const b = bounds(full);
  const cut = b.y0 + Math.round(b.h * split);

  // 머리는 어깨 폭에 눌리면 안 되므로 제 폭을 따로 잽니다.
  const headOnly = blank(F, F);
  blit(headOnly, full, b.x0, b.y0, b.w, cut - b.y0, b.x0, b.y0);
  const hb = bounds(headOnly);
  const headBox = { x0: hb.x0, y0: hb.y0, w: hb.w, h: hb.h };
  const bodyBox = { x0: b.x0, y0: cut, w: b.w, h: b.y1 - cut + 1 };

  /* 부위마다 따로 줄인 뒤 그리는 순서대로 덮습니다. 어느 칸이 어떤
     재질인지는 레이어가 알려 주므로 맞힐 필요가 없습니다. */
  const cells = Array.from({ length: N }, () => Array(N).fill(null));
  const place = (src, oy, fam) => {
    const w = src[0].length, ox = (N - w) >> 1;
    src.forEach((row, y) => row.forEach((c, x) => {
      if (c && oy + y >= 0 && oy + y < N) cells[oy + y][ox + x] = { ...c, fam };
    }));
  };
  for (const g of groups) {
    const img = composite(g.layers, dir);
    place(reduce(img, bodyW, bodyH, bodyBox), N - bodyH, g.fam);
    place(reduce(img, headW, headH, headBox, 0.30), 1, g.fam);
  }
  return { cells, full };
}

/* 재질마다 밝기를 넷으로 나눠 계단에 앉힌다. 절대 밝기가 아니라
   **그 재질 안에서의 순위**를 씁니다 — 그래야 어두운 갑옷도 네 단계를
   다 쓰고 납작해지지 않습니다. */
export function toGrid(cells) {
  const N = cells.length;
  const byFam = new Map();
  for (const row of cells) for (const c of row) if (c) {
    if (!byFam.has(c.fam)) byFam.set(c.fam, []);
    byFam.get(c.fam).push(c.lum);
  }
  const cuts = new Map();
  for (const [f, ls] of byFam) {
    ls.sort((a, b) => a - b);
    const q = t => ls[Math.min(ls.length - 1, (ls.length * t) | 0)];
    cuts.set(f, [q(0.22), q(0.55), q(0.84)]);
  }
  const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && cells[y][x];

  return cells.map((row, y) => row.map((c, x) => {
    if (!c) return '.';
    const ramp = RAMPS[c.fam] || RAMPS.stone;
    const [a, b, d] = cuts.get(c.fam);
    let step = c.lum <= a ? 0 : c.lum <= b ? 1 : c.lum <= d ? 2 : 3;
    /* 덩어리의 가장자리만 외곽선 단계로 내립니다. 사방이 다 차 있으면
       속살이고, 셋이 차 있으면 테두리입니다. 둘 이하면 그건 테두리가
       아니라 **얇은 부속**이므로 건드리지 않습니다 — 벨트나 어깨끈처럼
       한 칸짜리 물건까지 검게 칠하면 장비가 통째로 검은 띠가 됩니다. */
    const near = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dx, dy]) => on(x + dx, y + dy)).length;
    if (near === 3) step = 0;
    return ramp[step];
  }).join(''));
}

/* ── 점박이 걷어내기 ──────────────────────────────────────
   줄이면서 밝기가 문턱을 아슬아슬하게 넘나든 칸들이 점으로 흩어집니다.
   눈에는 재질의 결이 아니라 먼지로 읽힙니다. 사방 이웃 중 셋 이상이
   같은 글자면 그쪽으로 끌어당깁니다 — 실루엣은 건드리지 않습니다. */
export function denoise(grid, keep = new Set(['k', 'W', '.'])) {
  const N = grid.length;
  const g = grid.map(l => [...l]);
  const out = grid.map(l => [...l]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = g[y][x];
    if (keep.has(c)) continue;
    const n = [[0, -1], [0, 1], [-1, 0], [1, 0]]
      .map(([dx, dy]) => (g[y + dy] || [])[x + dx])
      .filter(v => v && v !== '.');
    if (n.length < 3) continue;
    const tally = new Map();
    for (const v of n) tally.set(v, (tally.get(v) || 0) + 1);
    for (const [v, k] of tally) if (k >= 3 && v !== c) out[y][x] = v;
  }
  return out.map(r => r.join(''));
}

/* ── 목 붙이기 ────────────────────────────────────────────
   머리와 몸을 다른 배율로 줄이다 보면 그 사이에 빈 줄이 생깁니다.
   작은 몸(아이 골격)일수록 잘 생기고, 그러면 머리가 공중에 뜹니다.
   빈 줄을 찾아 그만큼 위쪽 덩어리를 내려 붙입니다.            */
export function settle(grid) {
  const N = grid.length;
  const empty = y => !grid[y] || !/[^.]/.test(grid[y]);
  let first = 0; while (first < N && empty(first)) first++;
  let gap = first; while (gap < N && !empty(gap)) gap++;      // 머리 끝
  let next = gap; while (next < N && empty(next)) next++;     // 몸 시작
  const d = next - gap;
  if (d <= 0 || next >= N) return grid;
  const out = Array.from({ length: N }, () => '.'.repeat(N));
  for (let y = gap - 1; y >= first; y--) out[y + d] = grid[y];
  for (let y = next; y < N; y++) out[y] = grid[y];
  return out;
}

// ── 프리셋 ────────────────────────────────────────────────
const BODY = 'body/bodies/male/light.png';
const HAIR = 'hair/plain/male/dark_brown.png';
const G = (fam, ...layers) => ({ fam, layers });

export const PRESETS = {
  body: [
    G('skin', BODY),
    G('linen', 'torso/clothes/longsleeve/longsleeve/male/white.png'),
    G('stone', 'legs/pantaloons/male/slate.png'),
    G('wood', 'feet/boots/male/brown.png'),
    G('hair', HAIR),
  ],
  warrior: [
    G('skin', BODY),
    G('stone', 'legs/pantaloons/male/slate.png'),
    G('wood', 'feet/boots/male/brown.png'),
    G('steel',
      'torso/armour/plate/male/steel.png', 'arms/armour/plate/male/steel.png',
      'shoulders/plate/male/steel.png', 'legs/armour/plate/male/steel.png',
      'hat/helmet/bascinet/adult/steel.png'),
  ],
  mage: [
    G('skin', BODY),
    G('hair', HAIR),
    G('blue', 'torso/clothes/longsleeve/longsleeve/male/blue.png',
      'legs/pantaloons/male/navy.png', 'cape/solid/male/navy.png'),
    G('wood', 'feet/boots/male/black.png'),
    G('teal', 'hat/magic/wizard/base/adult/base_teal.png'),
  ],
  ranger: [
    G('skin', BODY),
    G('hair', HAIR),
    G('green', 'torso/clothes/longsleeve/longsleeve/male/forest.png'),
    G('wood', 'legs/pantaloons/male/brown.png', 'feet/boots/male/brown.png',
      'torso/armour/leather/male/brown.png'),
  ],
};

/* ── 얼굴은 찍는다 ────────────────────────────────────────
   8×8 로 줄이면 눈·코·입은 반드시 뭉갭니다. 참고본에서 가져올 수
   있는 것은 **머리통의 크기와 위치**까지고, 그 안은 규칙으로 찍는
   편이 낫습니다. 규칙은 넷입니다.

     · 얼굴은 두개골에서 가장 넓은 폭을 그대로 쓴다 (대두)
     · 머리카락이 얼굴을 양옆에서 한 칸씩 감싼다
     · 눈은 흰자 + 검은자, 가운데를 비워 둘로 갈라 놓는다
     · 턱은 한 칸씩 좁힌다

   내가 손으로 할 때 매번 틀린 자리 — 눈 둘이 붙어 한 줄이 되거나,
   좌우가 한 칸 어긋나거나 — 가 전부 이 넷 안에 있습니다.      */
export function stampFace(grid, view = 'down', opt = {}) {
  const {
    top = 1, headH = 8, hair = 5,
    skin = RAMPS.skin, mane = RAMPS.hair,
  } = opt;
  const N = grid.length;
  const g = grid.map(l => [...l]);
  /* 덮어도 되는 것은 그 종족의 살과 머리카락뿐입니다. 투구·모자·두건은
     그 직업의 정체성이므로 얼굴이 밀어내면 안 됩니다. 계단을 밖에서
     받는 이유는 오크의 얼굴에 사람 살빛을 박으면 안 되기 때문입니다. */
  const SOFT = new Set([...skin, ...mane]);
  const run = y => {
    let a = -1, b = -1;
    for (let x = 0; x < N; x++) if (SOFT.has(g[y][x])) { if (a < 0) a = x; b = x; }
    return [a, b];
  };

  const rows = [];
  for (let y = top + hair; y < top + headH; y++) if (run(y)[0] >= 0) rows.push(y);
  if (!rows.length) return grid;

  /* 얼굴 폭은 얼굴 줄이 아니라 **머리통에서 가장 넓은 줄**을 따릅니다.
     참고본은 턱으로 갈수록 좁아지는데 그 폭을 그대로 쓰면 16칸에서 눈
     둘이 안 들어갑니다. 대두는 여기서 만들어집니다.

     다만 재는 범위는 머리 지붕까지입니다 — 아래쪽 줄에는 어깨와 팔이
     걸려 있어서, 거기까지 재면 얼굴이 어깨만큼 넓어집니다.       */
  let sa = 99, sb = -1;
  for (let y = top; y < top + hair; y++) {
    const [a, b] = run(y);
    if (a >= 0 && b - a > sb - sa) { sa = a; sb = b; }
  }
  if (sb < 0) return grid;

  rows.forEach((y, i) => {
    const chin = i === rows.length - 1 ? 1 : 0;      // 턱은 한 칸 좁게
    const a = sa + chin, b = sb - chin;
    for (let x = 0; x < N; x++) {
      if (!SOFT.has(g[y][x]) && !(x >= a && x <= b)) continue;
      if (x < a || x > b) { if (SOFT.has(g[y][x])) g[y][x] = '.'; continue; }
      if (view === 'up') { g[y][x] = (x === a || x === b) ? mane[0] : mane[2]; continue; }
      g[y][x] = (x === a || x === b) ? mane[0] : skin[2];  // 머리카락이 얼굴을 감싼다
    }
  });
  if (view === 'up') return g.map(r => r.join(''));

  const mid = (sa + sb) / 2;
  const eyeRow = rows[0];
  if (view === 'down') {
    /* 눈은 얼굴 테두리에서 두 칸 안쪽. 흰자가 바깥, 검은자가 안쪽으로
       와야 두 눈이 서로를 본다 — 반대로 놓으면 사시가 됩니다. 좌우가
       같은 거리라 16칸의 중심(7열과 8열 사이)이 저절로 맞습니다. */
    g[eyeRow][sa + 1] = 'W'; g[eyeRow][sa + 2] = 'k';
    g[eyeRow][sb - 1] = 'W'; g[eyeRow][sb - 2] = 'k';
  } else {
    // 옆모습 — 눈 하나가 앞쪽에 붙고 코가 한 칸 나온다
    g[eyeRow][sb - 1] = 'k'; g[eyeRow][sb - 2] = 'W';
    if (eyeRow + 1 < N) g[eyeRow + 1][sb] = skin[1];
  }
  // 입은 눈 바로 아래 줄, 가운데 두 칸. 턱줄은 옷과 겹치므로 피합니다.
  const my = rows[1];
  if (my != null && view === 'down') {
    g[my][Math.floor(mid)] = skin[0]; g[my][Math.ceil(mid)] = skin[0];
  }
  return g.map(r => r.join(''));
}

/* 격자를 우리 팔레트로 찍어 PNG 로 뱉는다 — 글자만 봐서는 못 고칩니다. */
export function preview(out, pairs, Z = 10) {
  const cell = 16 * Z + 8;
  const sheet = fill(blank(pairs.length * cell, cell), '#3a3446');
  pairs.forEach(([grid, src], i) => {
    const g = blank(16, 16);
    grid.forEach((line, y) => [...line].forEach((ch, x) => {
      const hex = PALETTE[ch]; if (!hex) return;
      const o = (y * 16 + x) * 4;
      g.px[o] = parseInt(hex.slice(1, 3), 16);
      g.px[o + 1] = parseInt(hex.slice(3, 5), 16);
      g.px[o + 2] = parseInt(hex.slice(5, 7), 16);
      g.px[o + 3] = 255;
    }));
    const big = scale(g, Z);
    blit(sheet, big, 0, 0, big.w, big.h, i * cell + 4, 4);
  });
  encode(out, sheet.w, sheet.h, sheet.px);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , name = 'body', dir = 'down'] = process.argv;
  const { cells } = draft(PRESETS[name], dir);
  const grid = toGrid(cells);
  console.log(grid.map(l => `  '${l}',`).join('\n'));
  const bad = grid.flatMap(l => [...l]).filter(ch => ch !== '.' && !PALETTE[ch] && !'CDX'.includes(ch));
  if (bad.length) console.error('모르는 글자:', [...new Set(bad)].join(''));
}
