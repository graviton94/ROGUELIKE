/* 무기 얹기 미리보기 — ui.js 의 변환을 격자 위에서 그대로 흉내낸다.
   90도 배수 회전이라 격자에서 정확히 재현된다. */
import zlib from 'node:zlib'; import fs from 'node:fs';
import * as P from '../src/pixels.js';
const N = 16, M = 26, OFF = 5, Z = 10, PAD = 4;
const view = (src, v) => (Array.isArray(src) ? src : src[v] || src.down);
const TINT = c => { const t = P.CLASS_TINT[c]; return { C: t[0], D: t[1], X: t[2] }; };

function rot90(g, dir) {                    // dir: -1 = 시계, +1 = 반시계
  const out = Array.from({ length: N }, () => Array(N).fill('.'));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = (g[y] || '')[x] || '.';
    if (dir < 0) out[x][N - 1 - y] = c; else out[N - 1 - x][y] = c;
  }
  return out.map(r => r.join(''));
}

const mirror = g => g.map(r => [...r.padEnd(N, '.')].reverse().join(''));
function place(base, wep, hand, tint) {
  let w = wep;
  if (hand.flip) w = mirror(w);
  if (hand.rot) w = rot90(w, hand.rot > 0 ? -1 : +1);
  // 자루가 손에 오도록 옮긴다. 회전하면 자루 좌표도 같이 돈다.
  let gx = P.GRIP.x, gy = P.GRIP.y;
  if (hand.flip) gx = N - 1 - gx;
  if (hand.rot < 0) [gx, gy] = [gy, N - 1 - gx];
  if (hand.rot > 0) [gx, gy] = [N - 1 - gy, gx];
  const ox = hand.x - gx, oy = hand.y - gy;
  const out = base.map(r => r.split(''));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = (w[y] || '')[x] || '.';
    if (c === '.') continue;
    const tx = x + ox + OFF, ty = y + oy + OFF;
    if (tx < 0 || ty < 0 || tx >= M || ty >= M) continue;
    out[ty][tx] = c;
  }
  return out.map(r => r.join(''));
}

const race = process.argv[3] || 'human', cls = process.argv[4] || 'warrior';
const weps = (process.argv[5] || 'sword,axe,great,mace').split(',');
const dirs = [['down', 'down'], ['right', 'side'], ['up', 'up']];
const cells = [];
for (const w of weps) for (const [face, v] of dirs) {
  const body = view(P.RACE_BODY[race], v), kit = view(P.CLASS_KIT[cls], v);
  const hand = P.HAND[face], wep = P.SPRITES[w];
  const blank = Array(M).fill('.'.repeat(M));
  let g = hand.under ? place(blank, wep, hand, null) : blank;
  const inset = (a, b) => a.map((r, y) => [...r].map((c, x) => {
    const o = ((b[y - OFF] || '')[x - OFF]) || '.'; return o !== '.' ? o : c;
  }).join(''));
  g = inset(g, body); g = inset(g, kit);
  if (!hand.under) g = place(g, wep, hand, null);
  cells.push([`${w}.${face}`, g]);
}

const cell = M * Z + PAD * 2, cols = 3, rows = Math.ceil(cells.length / cols);
const W = cols * cell, H = rows * cell, buf = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) { buf[i*3] = 0x3e; buf[i*3+1] = 0x3a; buf[i*3+2] = 0x4a; }
const tint = TINT(cls);
cells.forEach(([, g], i) => {
  const ox = (i % cols) * cell + PAD, oy = ((i / cols) | 0) * cell + PAD;
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    let ch = (g[y] || '')[x] || '.';
    if (ch === 'C') ch = tint.C; if (ch === 'D') ch = tint.D; if (ch === 'X') ch = tint.X;
    const col = P.PALETTE[ch]; if (!col) continue;
    for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) {
      const px = ox + x*Z + dx, py = oy + y*Z + dy, o = (py*W + px)*3;
      buf[o] = parseInt(col.slice(1,3),16); buf[o+1] = parseInt(col.slice(3,5),16); buf[o+2] = parseInt(col.slice(5,7),16);
    }
  }
});
const raw = Buffer.alloc((W*3+1)*H);
for (let y = 0; y < H; y++) { raw[y*(W*3+1)] = 0; buf.copy(raw, y*(W*3+1)+1, y*W*3, (y+1)*W*3); }
let T=null; const crc=b=>{if(!T){T=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;T[n]=c>>>0;}}let c=0xffffffff;for(const v of b)c=T[(c^v)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
const ck=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td)>>>0);return Buffer.concat([l,td,c]);};
const ih=Buffer.alloc(13); ih.writeUInt32BE(W,0); ih.writeUInt32BE(H,4); ih[8]=8; ih[9]=2;
fs.writeFileSync(process.argv[2], Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), ck('IHDR',ih), ck('IDAT',zlib.deflateSync(raw)), ck('IEND',Buffer.alloc(0))]));
console.log(process.argv[2], W+'x'+H, cells.length+'칸');
