/* 눈먼 검사용 그림 뽑기.
   node tools/blind.mjs <내보낼 폴더> <이름,이름,...> [배율]

   내가 "이건 뱀이야"라고 알고 보면 뱀으로 보입니다. 그래서 그리는
   사람의 눈은 검사에 못 씁니다. 아무 맥락 없는 눈에 "이게 뭘로
   보이냐"고 물어야 하고, 그러려면 **파일 이름부터 답을 흘리면 안
   됩니다**. 여기서는 a1.png, a2.png 로만 내보내고, 어느 파일이 무엇인지는
   key.json 에만 적어 검사자에게 주지 않습니다.

   배경은 실제 바닥돌 색으로 깝니다. 투명 배경에 놓고 보면 흰 종이 위
   실루엣이라 실제보다 잘 읽히기 때문입니다. */
import fs from 'node:fs';
import path from 'node:path';
import * as P from '../src/pixels.js';
import { blank, scale, fill, encode } from './png.mjs';

const OUT = process.argv[2] || '/tmp/blind';
const NAMES = (process.argv[3] || '').split(',').filter(Boolean);
const Z = Number(process.argv[4] || 10);

const view = (g, v) => (Array.isArray(g) ? g : g[v] || g.down);

/* 이름 하나가 가리킬 수 있는 곳은 넷입니다. */
function gridOf(name) {
  const [kind, key, v = 'down'] = name.includes(':') ? name.split(':') : ['spr', name];
  if (kind === 'boss') return view(P.BOSSES[key], v);
  if (kind === 'kit') {
    const body = view(P.RACE_BODY.human, v), kit = view(P.CLASS_KIT[key], v);
    const t = P.CLASS_TINT[key];
    const sub = ch => (ch === 'C' ? t[0] : ch === 'D' ? t[1] : ch === 'X' ? t[2] : ch === 'L' ? t[3] : ch);
    return body.map((row, y) => [...row].map((ch, x) => {
      const over = (kit[y] || '')[x] || '.';
      return over !== '.' ? sub(over) : ch;
    }).join(''));
  }
  if (kind === 'weapon') {
    const w = P.WEAPON[key];
    const art = w.art, n = Math.max(...art.map(l => l.length));
    const pad = '.'.repeat(n);
    return [...Array(P.WEAPON_H - art.length).fill(pad), ...art];
  }
  const g = P.SPRITES[key ?? kind];
  return view(g, v);
}

fs.mkdirSync(OUT, { recursive: true });
const key = {};
NAMES.forEach((name, i) => {
  const g = gridOf(name);
  const h = g.length, w = Math.max(...g.map(l => l.length));
  const im = blank(w, h);
  g.forEach((line, y) => [...line].forEach((ch, x) => {
    const hex = P.PALETTE[ch];
    if (!hex) return;
    const o = (y * w + x) * 4;
    im.px[o] = parseInt(hex.slice(1, 3), 16);
    im.px[o + 1] = parseInt(hex.slice(3, 5), 16);
    im.px[o + 2] = parseInt(hex.slice(5, 7), 16);
    im.px[o + 3] = 255;
  }));
  const big = scale(im, Z);
  const pad = 2 * Z;
  const sheet = fill(blank(big.w + pad * 2, big.h + pad * 2), '#4a4458');
  for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) {
    const s = (y * big.w + x) * 4;
    if (!big.px[s + 3]) continue;
    const d = ((y + pad) * sheet.w + x + pad) * 4;
    sheet.px[d] = big.px[s]; sheet.px[d + 1] = big.px[s + 1];
    sheet.px[d + 2] = big.px[s + 2]; sheet.px[d + 3] = 255;
  }
  const file = `a${i + 1}.png`;
  encode(path.join(OUT, file), sheet.w, sheet.h, sheet.px);
  key[file] = name;
});
fs.writeFileSync(path.join(OUT, 'key.json'), JSON.stringify(key, null, 2));
console.log(`${OUT} — ${NAMES.length}장. 이름은 key.json 에만 있습니다.`);
