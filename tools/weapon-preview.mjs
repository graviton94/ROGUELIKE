/* 무기 얹기 미리보기 — ui.js 의 변환을 격자에서 그대로 재현한다.
   node tools/weapon-preview.mjs out.png [무기,무기,...] [종족] [직업] */
import zlib from 'node:zlib'; import fs from 'node:fs';
import * as P from '../src/pixels.js';

const N = 16, WW = P.WEAPON_W, WH = P.WEAPON_H;
const M = 40, OFF = 12, Z = 7, PAD = 4;
const view = (s, v) => (Array.isArray(s) ? s : s[v] || s.down);

/* WEAPON.art 를 16×32 격자로 편다 (아래 정렬) */
const pad = art => Array(WH - art.length).fill('.'.repeat(WW)).concat(art);
const gy = n => WH - 1 - (P.WEAPON[n].grip || 0);

/* 캔버스 rotate(양수)=시계. 격자에서 같은 결과를 만든다. */
function rot(g, cw) {
  const h = g.length, w = g[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g[y][x];
    if (cw) out[x][h - 1 - y] = c; else out[w - 1 - x][y] = c;
  }
  return out.map(r => r.join(''));
}

function scene(wname, face, v, race, cls) {
  const hand = P.HAND[face];
  let w = pad(P.WEAPON[wname].art);
  let gx = P.GRIP.x, gyy = gy(wname);
  if (hand.rot) {
    const cw = hand.rot > 0;
    w = rot(w, cw);
    if (cw) [gx, gyy] = [WH - 1 - gyy, gx]; else [gx, gyy] = [gyy, WW - 1 - gx];
  }
  const ox = hand.x - gx + OFF, oy = hand.y - gyy + OFF;
  const g = Array.from({ length: M }, () => Array(M).fill('.'));
  const put = (src, sx, sy) => {
    for (let y = 0; y < src.length; y++) for (let x = 0; x < src[y].length; x++) {
      const c = src[y][x]; if (c === '.') continue;
      const tx = x + sx, ty = y + sy;
      if (tx >= 0 && ty >= 0 && tx < M && ty < M) g[ty][tx] = c;
    }
  };
  if (hand.under) put(w, ox, oy);
  put(view(P.RACE_BODY[race], v), OFF, OFF);
  put(view(P.CLASS_KIT[cls], v), OFF, OFF);
  if (!hand.under) put(w, ox, oy);
  return g.map(r => r.join(''));
}

const weps = (process.argv[3] || 'dagger,sword,great,spear,axe,mace,bow,wand').split(',');
const race = process.argv[4] || 'human', cls = process.argv[5] || 'warrior';
const t = P.CLASS_TINT[cls], TINT = { C: t[0], D: t[1], X: t[2] };
const dirs = [['down','down'], ['right','side'], ['up','up']];
const cells = [];
for (const wn of weps) for (const [f, v] of dirs) cells.push(scene(wn, f, v, race, cls));

const cell = M * Z + PAD * 2, cols = 3, rows = Math.ceil(cells.length / cols);
const W = cols * cell, H = rows * cell, buf = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) { buf[i*3]=0x3e; buf[i*3+1]=0x3a; buf[i*3+2]=0x4a; }
cells.forEach((g, i) => {
  const ox = (i % cols) * cell + PAD, oy = ((i / cols) | 0) * cell + PAD;
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    let ch = g[y][x];
    if (ch === 'C') ch = TINT.C; if (ch === 'D') ch = TINT.D; if (ch === 'X') ch = TINT.X;
    const col = P.PALETTE[ch]; if (!col) continue;
    for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) {
      const o = ((oy + y*Z + dy) * W + ox + x*Z + dx) * 3;
      buf[o]=parseInt(col.slice(1,3),16); buf[o+1]=parseInt(col.slice(3,5),16); buf[o+2]=parseInt(col.slice(5,7),16);
    }
  }
});
const raw = Buffer.alloc((W*3+1)*H);
for (let y=0;y<H;y++){raw[y*(W*3+1)]=0;buf.copy(raw,y*(W*3+1)+1,y*W*3,(y+1)*W*3);}
let TB=null;const crc=b=>{if(!TB){TB=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;TB[n]=c>>>0;}}let c=0xffffffff;for(const v of b)c=TB[(c^v)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
const ck=(ty,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(ty,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td)>>>0);return Buffer.concat([l,td,c]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;
fs.writeFileSync(process.argv[2],Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ck('IHDR',ih),ck('IDAT',zlib.deflateSync(raw)),ck('IEND',Buffer.alloc(0))]));
console.log(process.argv[2], W+'x'+H, cells.length+'칸');
