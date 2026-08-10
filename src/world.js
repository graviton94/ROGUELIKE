/* ═══════════════════════════════════════════════════════════
   world.js — level generation and line of sight.
   ═══════════════════════════════════════════════════════════ */

import { SHOPS } from './data.js';

export const MW = 66, MH = 40;
export const ROCK = 0, FLOOR = 1, DOWN = 2, UP = 3, DOOR = 4, RUBBLE = 5, SHOP = 6;

export const idx = (x, y) => y * MW + x;
export const rnd = n => Math.floor(Math.random() * n);
export const roll = (c, s) => { let t = 0; for (let i = 0; i < c; i++) t += 1 + rnd(s); return t; };
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Level {
  constructor(depth) {
    this.depth = depth;
    this.tiles  = new Uint8Array(MW * MH);
    this.seen   = new Uint8Array(MW * MH);
    this.vis    = new Uint8Array(MW * MH);
    this.roomOf = new Int16Array(MW * MH).fill(-1);
    this.shopAt = new Map();     // tile index -> shop id
    this.rooms  = [];
    this.entry  = { x: 0, y: 0 };
    depth === 0 ? this.buildTown() : this.buildDungeon();
  }

  solid(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return true;
    const t = this.tiles[idx(x, y)];
    return t === ROCK || t === SHOP;
  }

  opaque(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return true;
    const t = this.tiles[idx(x, y)];
    return t === ROCK || t === SHOP;
  }

  /* ── town: an open plaza ringed by six shopfronts ── */
  buildTown() {
    const x0 = 6, y0 = 5, w = MW - 12, h = MH - 10;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) this.tiles[idx(x, y)] = FLOOR;

    // scatter a few rubble piles for texture
    for (let i = 0; i < 40; i++) {
      const x = x0 + rnd(w), y = y0 + rnd(h);
      if (this.tiles[idx(x, y)] === FLOOR) this.tiles[idx(x, y)] = RUBBLE;
    }

    // shop buildings around the rim; the door tile carries the shop id
    const spots = [
      [x0 + 3,       y0 + 1],       [x0 + (w >> 1) - 2, y0 + 1],       [x0 + w - 6, y0 + 1],
      [x0 + 3,       y0 + h - 4],   [x0 + (w >> 1) - 2, y0 + h - 4],   [x0 + w - 6, y0 + h - 4],
    ];
    SHOPS.forEach((shop, i) => {
      const [sx, sy] = spots[i];
      for (let y = sy; y < sy + 3; y++)
        for (let x = sx; x < sx + 5; x++) this.tiles[idx(x, y)] = SHOP;
      const dx = sx + 2, dy = (i < 3) ? sy + 3 : sy - 1;
      this.tiles[idx(dx, dy)] = DOOR;
      this.shopAt.set(idx(dx, dy), shop.id);
    });

    const cx = x0 + (w >> 1), cy = y0 + (h >> 1);
    this.tiles[idx(cx, cy)] = DOWN;
    this.entry = { x: cx, y: cy + 2 };
    this.rooms.push({ x: x0, y: y0, w, h, lit: true });
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) this.roomOf[idx(x, y)] = 0;
  }

  /* ── dungeon: non-overlapping rooms joined by L corridors ── */
  buildDungeon() {
    const target = 10 + rnd(5);
    for (let t = 0; t < 500 && this.rooms.length < target; t++) {
      const w = 4 + rnd(9), h = 3 + rnd(6);
      const x = 1 + rnd(MW - w - 2), y = 1 + rnd(MH - h - 2);
      if (this.rooms.some(r => x <= r.x + r.w + 1 && x + w + 1 >= r.x &&
                               y <= r.y + r.h + 1 && y + h + 1 >= r.y)) continue;
      const lit = Math.random() < Math.max(0.12, 0.92 - this.depth * 0.032);
      const id = this.rooms.length;
      this.rooms.push({ x, y, w, h, lit });
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) { this.tiles[idx(i, j)] = FLOOR; this.roomOf[idx(i, j)] = id; }
    }

    for (let i = 1; i < this.rooms.length; i++) {
      const a = this.centre(this.rooms[i - 1]), b = this.centre(this.rooms[i]);
      if (Math.random() < 0.5) { this.hall(a.x, b.x, a.y, true); this.hall(a.y, b.y, b.x, false); }
      else                     { this.hall(a.y, b.y, a.x, false); this.hall(a.x, b.x, b.y, true); }
    }

    // doors where a corridor meets a room wall
    for (const r of this.rooms) {
      for (let x = r.x; x < r.x + r.w; x++) {
        this.tryDoor(x, r.y - 1, 0, -1); this.tryDoor(x, r.y + r.h, 0, 1);
      }
      for (let y = r.y; y < r.y + r.h; y++) {
        this.tryDoor(r.x - 1, y, -1, 0); this.tryDoor(r.x + r.w, y, 1, 0);
      }
    }

    for (let i = 0; i < 24; i++) {
      const x = 1 + rnd(MW - 2), y = 1 + rnd(MH - 2);
      if (this.tiles[idx(x, y)] === FLOOR && this.roomOf[idx(x, y)] < 0)
        this.tiles[idx(x, y)] = RUBBLE;
    }

    const start = this.centre(this.rooms[0]);
    this.entry = start;
    this.tiles[idx(start.x, start.y)] = UP;

    let far = this.rooms[this.rooms.length - 1], best = -1;
    for (const r of this.rooms) {
      const c = this.centre(r), d = (c.x - start.x) ** 2 + (c.y - start.y) ** 2;
      if (d > best) { best = d; far = r; }
    }
    const st = this.centre(far);
    this.tiles[idx(st.x, st.y)] = DOWN;
    this.downRoom = far;
  }

  tryDoor(x, y, dx, dy) {
    if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) return;
    if (this.tiles[idx(x, y)] !== FLOOR) return;
    if (this.roomOf[idx(x, y)] >= 0) return;
    const ax = x + dx, ay = y + dy;
    if (ax < 0 || ay < 0 || ax >= MW || ay >= MH) return;
    if (this.tiles[idx(ax, ay)] !== FLOOR) return;
    if (Math.random() < 0.55) this.tiles[idx(x, y)] = DOOR;
  }

  centre(r) { return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }; }

  hall(from, to, fixed, horizontal) {
    const [a, b] = from < to ? [from, to] : [to, from];
    for (let v = a; v <= b; v++) {
      const i = horizontal ? idx(v, fixed) : idx(fixed, v);
      if (this.tiles[i] === ROCK) this.tiles[i] = FLOOR;
    }
  }

  openSpot(room, occupied) {
    for (let t = 0; t < 80; t++) {
      const x = room.x + rnd(room.w), y = room.y + rnd(room.h);
      const i = idx(x, y);
      if (this.tiles[i] !== FLOOR && this.tiles[i] !== RUBBLE) continue;
      if (occupied && occupied(x, y)) continue;
      return { x, y };
    }
    return null;
  }

  randomFloor(occupied) {
    for (let t = 0; t < 400; t++) {
      const x = rnd(MW), y = rnd(MH), i = idx(x, y);
      if (this.tiles[i] !== FLOOR && this.tiles[i] !== RUBBLE) continue;
      if (occupied && occupied(x, y)) continue;
      return { x, y };
    }
    return null;
  }
}

/* ── recursive shadowcasting, eight octants ── */
const OCT = [[1,0,0,1],[0,1,1,0],[0,-1,1,0],[-1,0,0,1],
             [-1,0,0,-1],[0,-1,-1,0],[0,1,-1,0],[1,0,0,-1]];

export function computeFov(level, cx, cy, radius) {
  level.vis.fill(0);
  level.vis[idx(cx, cy)] = 1;
  level.seen[idx(cx, cy)] = 1;
  for (const o of OCT) cast(level, cx, cy, 1, 1.0, 0.0, radius, o[0], o[1], o[2], o[3]);

  const rid = level.roomOf[idx(cx, cy)];
  if (rid >= 0 && level.rooms[rid].lit) {
    const r = level.rooms[rid];
    for (let y = r.y - 1; y <= r.y + r.h; y++)
      for (let x = r.x - 1; x <= r.x + r.w; x++) {
        if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
        level.vis[idx(x, y)] = 1;
        level.seen[idx(x, y)] = 1;
      }
  }
}

function cast(L, cx, cy, row, start, end, radius, xx, xy, yx, yy) {
  if (start < end) return;
  let newStart = start;
  for (let j = row; j <= radius; j++) {
    let blocked = false;
    const dy = -j;
    for (let dx = -j; dx <= 0; dx++) {
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;

      const X = cx + dx * xx + dy * xy;
      const Y = cy + dx * yx + dy * yy;
      if (X >= 0 && Y >= 0 && X < MW && Y < MH && dx * dx + dy * dy <= radius * radius) {
        L.vis[idx(X, Y)] = 1;
        L.seen[idx(X, Y)] = 1;
      }
      const wall = L.opaque(X, Y);
      if (blocked) {
        if (wall) { newStart = rSlope; continue; }
        blocked = false; start = newStart;
      } else if (wall && j < radius) {
        blocked = true;
        cast(L, cx, cy, j + 1, start, lSlope, radius, xx, xy, yx, yy);
        newStart = rSlope;
      }
    }
    if (blocked) break;
  }
}
