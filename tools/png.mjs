/* 의존성 없는 PNG 읽기·쓰기. 에셋을 평가하려면 그림을 실제로 봐야 하는데
   이 환경에는 이미지 라이브러리가 없어서 직접 폅니다. RGBA 8비트만. */
import zlib from 'node:zlib';
import fs from 'node:fs';

export function decode(path) {
  const b = fs.readFileSync(path);
  let p = 8, w = 0, h = 0, depth = 0, type = 0, pal = null, trns = null;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const tag = b.toString('ascii', p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (tag === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; type = data[9];
      if (depth !== 8) throw new Error(`${path}: ${depth}비트는 못 읽습니다`);
    } else if (tag === 'PLTE') pal = data;
    else if (tag === 'tRNS') trns = data;
    else if (tag === 'IDAT') idat.push(data);
    else if (tag === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = type === 6 ? 4 : type === 2 ? 3 : type === 4 ? 2 : 1;
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const bb = prev ? prev[i] : 0;
      const c = prev && i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
      }
      cur[i] = v & 255;
    }
  }
  // 무엇이 들어왔든 RGBA 로 통일합니다.
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, bl, al = 255;
    if (ch === 4) { r = out[i * 4]; g = out[i * 4 + 1]; bl = out[i * 4 + 2]; al = out[i * 4 + 3]; }
    else if (ch === 3) { r = out[i * 3]; g = out[i * 3 + 1]; bl = out[i * 3 + 2]; }
    else if (ch === 2) { r = g = bl = out[i * 2]; al = out[i * 2 + 1]; }
    else if (pal) { const k = out[i]; r = pal[k * 3]; g = pal[k * 3 + 1]; bl = pal[k * 3 + 2]; if (trns && k < trns.length) al = trns[k]; }
    else { r = g = bl = out[i]; }
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = bl; px[i * 4 + 3] = al;
  }
  return { w, h, px };
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
export function encode(path, w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

export const blank = (w, h) => ({ w, h, px: Buffer.alloc(w * h * 4) });

/* src 의 (sx,sy,sw,sh) 를 dst 의 (dx,dy) 에 알파 합성 */
export function blit(dst, src, sx, sy, sw, sh, dx, dy) {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const s = ((sy + y) * src.w + sx + x) * 4;
    const a = src.px[s + 3]; if (!a) continue;
    const X = dx + x, Y = dy + y;
    if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
    const d = (Y * dst.w + X) * 4;
    const na = a / 255, ia = 1 - na;
    dst.px[d]     = src.px[s]     * na + dst.px[d]     * ia;
    dst.px[d + 1] = src.px[s + 1] * na + dst.px[d + 1] * ia;
    dst.px[d + 2] = src.px[s + 2] * na + dst.px[d + 2] * ia;
    dst.px[d + 3] = Math.min(255, a + dst.px[d + 3] * ia);
  }
}

export function scale(img, z) {
  const o = blank(img.w * z, img.h * z);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const s = (y * img.w + x) * 4;
    for (let dy = 0; dy < z; dy++) for (let dx = 0; dx < z; dx++) {
      const d = ((y * z + dy) * o.w + x * z + dx) * 4;
      o.px[d] = img.px[s]; o.px[d + 1] = img.px[s + 1]; o.px[d + 2] = img.px[s + 2]; o.px[d + 3] = img.px[s + 3];
    }
  }
  return o;
}

/* 칠해진 픽셀의 최소 사각형 */
export function bounds(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++)
    if (img.px[(y * img.w + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function fill(img, hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < img.w * img.h; i++) { img.px[i * 4] = r; img.px[i * 4 + 1] = g; img.px[i * 4 + 2] = b; img.px[i * 4 + 3] = 255; }
  return img;
}
