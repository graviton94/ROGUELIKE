/* ═══════════════════════════════════════════════════════════
   world.js — level generation and line of sight.
   ═══════════════════════════════════════════════════════════ */

import { SHOPS } from './data.js';

export const MW = 66, MH = 40;

/* Tiles 0-6 are the original set. A door is now four tiles
   rather than one, because a *closed* door is the thing that
   makes archers and hounds interesting: it breaks line of
   sight, and shutting one behind you is a real move. */
export const ROCK = 0, FLOOR = 1, DOWN = 2, UP = 3, DOOR = 4, RUBBLE = 5, SHOP = 6,
             DOOR_OPEN = 7, DOOR_LOCKED = 8, DOOR_BROKEN = 9,
             WEB = 10, WATER = 11, CAMP = 12, ALTAR = 13, EVENT = 14, ANVIL = 15;

/* rooms: how many · size: room dimensions · light/water/web:
   multipliers on the usual amount · mob: monster density. */
export const THEMES = {
  plain:  { id:'plain',  n:null,            weight:26, rooms:[10,14], size:[4,9],  light:1.0,  water:1.0, web:1.0, mob:1.0 },
  warren: { id:'warren', n:'좁은 굴',       weight:14, rooms:[16,22], size:[3,4],  light:0.8,  water:0.6, web:1.4, mob:1.15, from:3 },
  hall:   { id:'hall',   n:'큰 방',         weight:12, rooms:[5,7],   size:[9,12], light:1.2,  water:1.0, web:0.6, mob:1.1,  from:3 },
  dark:   { id:'dark',   n:'빛이 없는 층',  weight:10, rooms:[9,13],  size:[4,9],  light:0.0,  water:0.8, web:1.0, mob:0.9,  from:4 },
  flooded:{ id:'flooded',n:'물에 잠긴 층',  weight:9,  rooms:[8,12],  size:[5,10], light:0.9,  water:3.2, web:0.5, mob:1.0,  from:4 },
  nest:   { id:'nest',   n:'소굴',          weight:9,  rooms:[8,12],  size:[4,9],  light:0.7,  water:0.8, web:2.2, mob:1.6,  from:5 },
};

export const isDoor = t => t === DOOR || t === DOOR_OPEN || t === DOOR_LOCKED || t === DOOR_BROKEN;
export const isShut = t => t === DOOR || t === DOOR_LOCKED;

/* Pathfinding sees a shut door as a step that costs a turn, not
   as a wall — otherwise half a floor stops being tappable. A
   locked one really is a wall until you deal with it. */
export const walkable = (level, x, y) => {
  if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
  const t = level.tiles[idx(x, y)];
  return t === DOOR || !level.solid(x, y);
};

export const idx = (x, y) => y * MW + x;
export const rnd = n => Math.floor(Math.random() * n);
export const roll = (c, s) => { let t = 0; for (let i = 0; i < c; i++) t += 1 + rnd(s); return t; };
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Level {
  /* `branch` is the stair the player chose to get here (see
     BRANCHES in data.js). Generation reads it for the things
     that are structural — whether there is a fire at all, an
     altar for certain, twice the traps — while the rules layer
     reads it for the rest. */
  constructor(depth, branch) {
    this.depth = depth;
    this.branch = branch || {};
    this.tiles  = new Uint8Array(MW * MH);
    this.seen   = new Uint8Array(MW * MH);
    this.vis    = new Uint8Array(MW * MH);
    this.roomOf = new Int16Array(MW * MH).fill(-1);
    this.shopAt = new Map();     // tile index -> shop id
    this.keeperAt = new Map();   // tile index -> shop id (who stands there)
    this.signAt = new Map();     // tile index -> shop id (what the sign shows)
    /* Traps stay off the tile grid on purpose: a hidden trap has
       to look exactly like the floor it is sitting in, and the
       grid is what the renderer reads. */
    this.traps  = new Map();     // tile index -> { kind, seen }
    this.rooms  = [];
    this.entry  = { x: 0, y: 0 };
    depth === 0 ? this.buildTown() : this.buildDungeon();
  }

  solid(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return true;
    const t = this.tiles[idx(x, y)];
    return t === ROCK || t === SHOP || isShut(t);
  }

  opaque(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return true;
    const t = this.tiles[idx(x, y)];
    return t === ROCK || t === SHOP || isShut(t);
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
    // The wandering merchant has no storefront; he is placed in
    // the dungeon instead, so he must not claim a town plot.
    SHOPS.filter(s => !s.wander).forEach((shop, i) => {
      const [sx, sy] = spots[i];
      for (let y = sy; y < sy + 3; y++)
        for (let x = sx; x < sx + 5; x++) this.tiles[idx(x, y)] = SHOP;
      const dx = sx + 2, dy = (i < 3) ? sy + 3 : sy - 1;
      this.tiles[idx(dx, dy)] = DOOR_OPEN;   // shopfronts are never shut
      this.shopAt.set(idx(dx, dy), shop.id);

      /* A shopfront should say what it sells without the player
         having to walk in and find out. The keeper stands in the
         doorway on the building side; the sign hangs above him. */
      const inward = (i < 3) ? -1 : 1;             // toward the building
      this.keeperAt.set(idx(dx, dy + inward), shop.id);
      this.signAt.set(idx(dx, dy + inward * 2), shop.id);
    });

    const cx = x0 + (w >> 1), cy = y0 + (h >> 1);
    this.tiles[idx(cx, cy)] = DOWN;
    this.entry = { x: cx, y: cy + 2 };
    this.rooms.push({ x: x0, y: y0, w, h, lit: true });
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) this.roomOf[idx(x, y)] = 0;
  }

  /* ── floor themes ─────────────────────────────────────────
     Fifteen floors that generate identically are fifteen of the
     same floor. Each one now draws a character that changes its
     shape, its light and what lives in it, and says so on arrival
     so the player knows what they walked into. */
  pickTheme() {
    if (this.depth <= 1) return THEMES.plain;
    const pool = Object.values(THEMES).filter(t => this.depth >= (t.from || 0));
    const total = pool.reduce((s, t) => s + t.weight, 0);
    let r = rnd(total);
    for (const t of pool) { if (r < t.weight) return t; r -= t.weight; }
    return THEMES.plain;
  }

  /* ── dungeon: non-overlapping rooms joined by L corridors ── */
  buildDungeon() {
    const th = this.pickTheme();
    this.theme = th;
    const target = th.rooms[0] + rnd(th.rooms[1] - th.rooms[0] + 1);
    for (let t = 0; t < 500 && this.rooms.length < target; t++) {
      const w = th.size[0] + rnd(th.size[1]), h = Math.max(3, th.size[0] - 1 + rnd(th.size[1] - 2));
      const x = 1 + rnd(MW - w - 2), y = 1 + rnd(MH - h - 2);
      if (this.rooms.some(r => x <= r.x + r.w + 1 && x + w + 1 >= r.x &&
                               y <= r.y + r.h + 1 && y + h + 1 >= r.y)) continue;
      const lit = Math.random() < Math.max(0.05, (0.92 - this.depth * 0.05) * this.theme.light);
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

    this.scatterHazards(start, st);
    this.placeCamp(start, st);
    this.placeAnvil(start, st);
    this.placeMerchant(start, st);
    this.placeAltar(start, st);
    this.placeEvent(start, st);
    this.unsealStairs(start, st);
  }

  /* The ? room. Common on purpose — it is the cheapest content
     the game has and the only place the dungeon reacts to what
     you happen to be carrying, so a run should meet several. */
  placeEvent(start, down) {
    if (this.depth < 1 || Math.random() > 0.48) return;
    for (let t = 0; t < 70; t++) {
      const r = this.rooms[rnd(this.rooms.length)];
      if (!r) return;
      const x = r.x + rnd(r.w), y = r.y + rnd(r.h);
      const i = idx(x, y);
      if (this.tiles[i] !== FLOOR || this.traps.has(i)) continue;
      if (i === idx(start.x, start.y) || i === idx(down.x, down.y)) continue;
      this.tiles[i] = EVENT;
      this.event = { x, y };
      this.seen[i] = 1;
      return;
    }
  }

  /* A fire promised by a ? room, dropped onto a floor that did
     not roll one. Same placement rules as placeCamp; separate
     entry point so the promise cannot be silently dropped. */
  forceCamp() {
    if (this.camp) return;
    for (let t = 0; t < 120; t++) {
      const r = this.rooms[rnd(this.rooms.length)];
      if (!r) return;
      const x = r.x + rnd(r.w), y = r.y + rnd(r.h);
      const i = idx(x, y);
      if (this.tiles[i] !== FLOOR || this.traps.has(i)) continue;
      this.tiles[i] = CAMP;
      this.camp = { x, y };
      this.seen[i] = 1;
      return;
    }
  }

  /* The altar. Rarer than the fire and louder than it — this is
     the one place a floor can hand you something enormous or take
     something away. Visible from arrival so it can be *wanted*. */
  placeAltar(start, down) {
    if (this.depth < 2) return;
    if (!this.branch.altar && Math.random() > 0.3) return;
    for (let t = 0; t < 60; t++) {
      const r = this.rooms[rnd(this.rooms.length)];
      if (!r) return;
      const x = r.x + rnd(r.w), y = r.y + rnd(r.h);
      const i = idx(x, y);
      if (this.tiles[i] !== FLOOR || this.traps.has(i)) continue;
      if (i === idx(start.x, start.y) || i === idx(down.x, down.y)) continue;
      this.tiles[i] = ALTAR;
      this.altar = { x, y };
      this.seen[i] = 1;
      return;
    }
  }

  /* A merchant turns up now and then. He is the reason to keep
     gold rather than ignore it, and the reason a floor with one
     feels different from the floor before it. */
  placeMerchant(start, down) {
    if (this.depth < 2 || Math.random() > 0.32) return;
    for (let t = 0; t < 60; t++) {
      const r = this.rooms[rnd(this.rooms.length)];
      if (!r) return;
      const x = r.x + rnd(r.w), y = r.y + rnd(r.h);
      const i = idx(x, y);
      if (this.tiles[i] !== FLOOR || this.traps.has(i)) continue;
      if (i === idx(start.x, start.y) || i === idx(down.x, down.y)) continue;
      let open = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        if ((dx || dy) && !this.solid(x + dx, y + dy)) open++;
      if (open < 6) continue;                 // never in a chokepoint
      this.shopAt.set(i, 7);
      this.keeperAt.set(i, 7);
      this.merchant = { x, y };
      this.seen[i] = 1;                 // his lamp is visible from afar
      return;
    }
  }

  /* One fire per floor, and never in the room you arrive in or
     the one you leave by — you should have to go and find it,
     and finding it should mean the floor was worth walking. */
  placeCamp(start, down) {
    /* Not every floor has one. A fire on every level makes rest
       free and turns the choice into "always upgrade"; making it
       scarce is what puts weight on the one you do find. */
    if (this.branch.noCamp) return;
    if (this.depth > 1 && Math.random() > 0.6) return;
    const banned = new Set([this.roomOf[idx(start.x, start.y)], this.roomOf[idx(down.x, down.y)]]);
    const rooms = this.rooms.filter((r, i) => !banned.has(i));
    const pool = rooms.length ? rooms : this.rooms;
    for (let t = 0; t < 80; t++) {
      const r = pool[rnd(pool.length)];
      if (!r) return;
      const x = r.x + rnd(r.w), y = r.y + rnd(r.h);
      const i = idx(x, y);
      if (this.tiles[i] !== FLOOR || this.traps.has(i)) continue;
      this.tiles[i] = CAMP;
      this.camp = { x, y };
      return;
    }
  }

  /* ── the anvil ──────────────────────────────────────────
     Unlike the fire, this one is not spent. You can strike it
     until your purse is empty, which is the entire point: the
     fire is where a run changes shape, the anvil is where it
     buys numbers, and the two should not be competing for the
     same single use.

     Commoner than the fire (55%) because it costs materials
     every time — a floor with an anvil and no scrap is just a
     floor with an anvil. */
  placeAnvil(start, down) {
    if (this.depth < 1 || Math.random() > 0.55) return;
    const banned = new Set([this.roomOf[idx(start.x, start.y)]]);
    const rooms = this.rooms.filter((r, i) => !banned.has(i));
    const pool = rooms.length ? rooms : this.rooms;
    for (let t = 0; t < 80; t++) {
      const r = pool[rnd(pool.length)];
      if (!r) return;
      const x = r.x + rnd(r.w), y = r.y + rnd(r.h);
      const i = idx(x, y);
      if (this.tiles[i] !== FLOOR || this.traps.has(i)) continue;
      this.tiles[i] = ANVIL;
      this.anvil = { x, y };
      return;
    }
  }

  /* A locked door across the only corridor to the stairs turns a
     floor into a dead end for anything that routes around locks.
     Flood from the entrance treating locks as walls, and if the
     stairs fall outside that region, unlock the doors on the way
     until they don't. */
  unsealStairs(start, down) {
    for (let pass = 0; pass < 12; pass++) {
      const seen = new Uint8Array(MW * MH);
      const from = new Int32Array(MW * MH).fill(-1);
      const s = idx(start.x, start.y), goal = idx(down.x, down.y);
      seen[s] = 1;
      const q = [s];
      let reached = s === goal;

      for (let h = 0; h < q.length && !reached; h++) {
        const cur = q[h], cx = cur % MW, cy = (cur / MW) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
          const ni = idx(nx, ny);
          if (seen[ni]) continue;
          const t = this.tiles[ni];
          // Locked doors are the thing we are testing for.
          if (t === ROCK || t === SHOP || t === DOOR_LOCKED) continue;
          seen[ni] = 1; from[ni] = cur;
          if (ni === goal) { reached = true; break; }
          q.push(ni);
        }
      }
      if (reached) return;

      // Unlock the locked door nearest the reachable frontier.
      let best = -1, bestD = Infinity;
      for (let i = 0; i < MW * MH; i++) {
        if (this.tiles[i] !== DOOR_LOCKED) continue;
        const x = i % MW, y = (i / MW) | 0;
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
          if (seen[idx(nx, ny)]) { touches = true; break; }
        }
        if (!touches) continue;
        const dd = (x - down.x) ** 2 + (y - down.y) ** 2;
        if (dd < bestD) { bestD = dd; best = i; }
      }
      if (best < 0) return;              // nothing left to unlock
      this.tiles[best] = DOOR;
    }
  }

  /* Hazards go down last so they never bury a staircase. Webs
     and water are visible and therefore a routing decision;
     traps are invisible and therefore a reason to slow down. */
  scatterHazards(start, down) {
    const d = this.depth;
    const sacred = i => i === idx(start.x, start.y) || i === idx(down.x, down.y);
    const plain = (x, y) => {
      const i = idx(x, y);
      return this.tiles[i] === FLOOR && !sacred(i) && !this.traps.has(i);
    };

    // Webs cluster: one spider nest beats twenty lone strands.
    const nests = Math.round((1 + rnd(1 + Math.floor(d / 6))) * this.theme.web);
    for (let n = 0; n < nests; n++) {
      const r = this.rooms[1 + rnd(Math.max(1, this.rooms.length - 1))];
      if (!r) break;
      const cx = r.x + rnd(r.w), cy = r.y + rnd(r.h);
      for (let i = 0; i < 4 + rnd(7); i++) {
        const x = cx + rnd(5) - 2, y = cy + rnd(5) - 2;
        if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) continue;
        if (plain(x, y)) this.tiles[idx(x, y)] = WEB;
      }
    }

    // Shallow water: safe to cross, loud to cross.
    if (d >= 3 && Math.random() < 0.55 * this.theme.water) {
      const pools = Math.round((1 + rnd(3)) * this.theme.water);
      for (let n = 0; n < pools; n++) {
        const r = this.rooms[1 + rnd(Math.max(1, this.rooms.length - 1))];
        if (!r) break;
        const cx = r.x + rnd(r.w), cy = r.y + rnd(r.h);
        const rad = 1 + rnd(3);
        for (let y = cy - rad; y <= cy + rad; y++)
          for (let x = cx - rad; x <= cx + rad; x++) {
            if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) continue;
            if (Math.hypot(x - cx, y - cy) > rad) continue;
            if (plain(x, y)) this.tiles[idx(x, y)] = WATER;
          }
      }
    }

    /* Collect the candidates first and then draw from them.
       Sampling the whole grid instead wastes four attempts in
       five on solid rock, which quietly produced floors with no
       traps at all. Corridors are weighted double: that is
       where a trap catches someone mid-run. */
    const spots = [];
    for (let y = 1; y < MH - 1; y++)
      for (let x = 1; x < MW - 1; x++) {
        if (!plain(x, y)) continue;
        const i = idx(x, y);
        spots.push(i);
        if (this.roomOf[i] < 0) spots.push(i);   // corridor, counted twice
      }

    const kinds = [
      'dart', 'dart', 'dart', 'dart',
      'poison', 'poison', 'poison',
      'alarm', 'alarm',
      'teleport',
      'pit',                       // one in eleven, not one in five
    ];
    const count = Math.round(Math.min(9, 1 + Math.floor(d * 0.35) + rnd(2))
                             * (this.branch.traps || 1));
    for (let n = 0; n < count && spots.length; n++) {
      const pick = rnd(spots.length);
      const i = spots[pick];
      spots.splice(pick, 1);
      if (this.traps.has(i)) continue;
      this.traps.set(i, { kind: kinds[rnd(kinds.length)], seen: false });
    }
  }

  /* Most doors start shut. That is the point — a shut door is a
     wall you can choose to open, and deeper down more of them
     are locked, so "can I get through this quietly" becomes a
     question with an answer that varies by build. */
  tryDoor(x, y, dx, dy) {
    if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) return;
    if (this.tiles[idx(x, y)] !== FLOOR) return;
    if (this.roomOf[idx(x, y)] >= 0) return;
    const ax = x + dx, ay = y + dy;
    if (ax < 0 || ay < 0 || ax >= MW || ay >= MH) return;
    if (this.tiles[idx(ax, ay)] !== FLOOR) return;
    if (Math.random() >= 0.55) return;

    const r = Math.random();
    const lockChance = Math.min(0.24, 0.04 + this.depth * 0.012);
    this.tiles[idx(x, y)] =
      r < lockChance      ? DOOR_LOCKED :
      r < lockChance + 0.30 ? DOOR_OPEN :
                              DOOR;
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

/* Monsters need their own sight, not the player's. A shut door
   between an archer and you is the whole point of shut doors. */
export function lineClear(level, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let guard = 0; guard < 200; guard++) {
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx)  { err += dx; y += sy; }
    if (x === x1 && y === y1) return true;
    if (level.opaque(x, y)) return false;
  }
  return false;
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
