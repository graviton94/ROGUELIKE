/* Contact-sheet renderer for pixels.js grids.
   node sheet.mjs <out.png> <group|name,name,...> [zoom] [cols] */
import zlib from 'node:zlib';
import fs from 'node:fs';
import * as Pix from '../src/pixels.js';

const OUT = process.argv[2] || 'sheet.png';
const GROUP = process.argv[3] || 'sprites';
const Z = Number(process.argv[4] || 5);
const COLS = Number(process.argv[5] || 10);
const PAD = 4;

const P = Pix.PALETTE;
const TINT = { C: 'S', D: 's', X: '2' };

function gridSize(g) { return Math.max(g.length, ...g.map(l => l.length)); }
function compose(body, kit) {
  const n = Math.max(gridSize(body), gridSize(kit));
  const out = [];
  for (let r = 0; r < n; r++) {
    let line = '';
    for (let c = 0; c < n; c++) {
      const over = (kit[r] || '')[c] || '.';
      line += over !== '.' ? over : ((body[r] || '')[c] || '.');
    }
    out.push(line);
  }
  return out;
}
const view = (src, v) => (Array.isArray(src) ? src : src[v] || src.down);

let entries = [];
const push = (n, g, t) => entries.push([n, g, t || TINT]);

const flat = g => (Array.isArray(g) ? g : view(g, 'down'));
if (GROUP === 'sprites' || GROUP === 'all') {
  for (const [n, g] of Object.entries(Pix.SPRITES)) push(n, flat(g));
} else if (GROUP === 'hero') {
  for (const race of Object.keys(Pix.RACE_BODY))
    for (const v of ['down', 'side', 'up']) push(`${race}.${v}`, view(Pix.RACE_BODY[race], v));
  for (const cls of Object.keys(Pix.CLASS_KIT))
    for (const v of ['down', 'side', 'up'])
      push(`${cls}.${v}`, view(Pix.CLASS_KIT[cls], v), tintOf(cls));
} else if (GROUP === 'combo') {
  for (const race of Object.keys(Pix.RACE_BODY))
    for (const cls of Object.keys(Pix.CLASS_KIT))
      push(`${race}/${cls}`, compose(view(Pix.RACE_BODY[race], 'down'), view(Pix.CLASS_KIT[cls], 'down')), tintOf(cls));
} else if (GROUP === 'views') {
  for (const race of Object.keys(Pix.RACE_BODY))
    for (const cls of ['warrior', 'mage'])
      for (const v of ['down', 'side', 'up'])
        push(`${race}/${cls}.${v}`, compose(view(Pix.RACE_BODY[race], v), view(Pix.CLASS_KIT[cls], v)), tintOf(cls));
} else {
  for (const n of GROUP.split(',')) {
    if (n.includes('/')) {
      // race/class — 합성된 주인공을 세 방향으로
      const [race, cls] = n.split('/');
      for (const v of ['down', 'side', 'up'])
        push(`${race}/${cls}.${v}`,
             compose(view(Pix.RACE_BODY[race], v), view(Pix.CLASS_KIT[cls], v)), tintOf(cls));
    }
    else if (Pix.SPRITES[n]) {
      const g = Pix.SPRITES[n];
      if (Array.isArray(g)) push(n, g);
      else for (const v of ['down', 'side', 'up']) push(`${n}.${v}`, view(g, v));
    }
    else if (Pix.RACE_BODY[n]) for (const v of ['down', 'side', 'up']) push(`${n}.${v}`, view(Pix.RACE_BODY[n], v));
    else if (Pix.CLASS_KIT[n]) for (const v of ['down', 'side', 'up']) push(`${n}.${v}`, view(Pix.CLASS_KIT[n], v), tintOf(n));
    else console.error(`? unknown: ${n}`);
  }
}
function tintOf(cls) {
  const t = Pix.CLASS_TINT[cls];
  return Array.isArray(t) ? { C: t[0], D: t[1], X: t[2] } : TINT;
}

const N = Math.max(...entries.map(([, g]) => gridSize(g)));
const cell = N * Z + PAD * 2;
const cols = Math.min(COLS, entries.length);
const rows = Math.ceil(entries.length / cols);
const W = cols * cell, H = rows * cell;

const buf = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  // mid-tone stone, like the floor these actually stand on
  const v = (((x / cell) | 0) + ((y / cell) | 0)) & 1 ? 0x3a : 0x46;
  const o = (y * W + x) * 3; buf[o] = v; buf[o + 1] = v - 4; buf[o + 2] = v + 8;
}
function px(x, y, hex) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = parseInt(hex.slice(1, 3), 16);
  buf[o + 1] = parseInt(hex.slice(3, 5), 16);
  buf[o + 2] = parseInt(hex.slice(5, 7), 16);
}

entries.forEach(([name, grid, tint], i) => {
  const ox = (i % cols) * cell + PAD, oy = ((i / cols) | 0) * cell + PAD;
  for (let r = 0; r < N; r++) {
    const line = grid[r] || '';
    for (let c = 0; c < N; c++) {
      let ch = line[c] || '.';
      if (ch === 'C') ch = tint.C;
      if (ch === 'D') ch = tint.D;
      if (ch === 'X') ch = tint.X;
      const col = P[ch];
      if (!col) continue;
      for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++)
        px(ox + c * Z + dx, oy + r * Z + dy, col);
    }
  }
});

const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  buf.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}
let TBL = null;
function crc32(b) {
  if (!TBL) { TBL = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TBL[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (const v of b) c = TBL[(c ^ v) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(OUT, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log(`${OUT}  ${W}x${H}  ${entries.length} entries`);
