/* ═══════════════════════════════════════════════════════════
   world.js — level generation and line of sight.
   ═══════════════════════════════════════════════════════════ */

import { SHOPS } from './data.js';

/* 66×40에서 줄였다. 방을 줄여도 지도가 넓으면 복도가 길어져
   걷는 턴이 그대로 남는다 — 걸음을 줄이려면 거리를 줄여야 한다. */
export const MW = 52, MH = 32;

/* 직전 층에 무엇이 서 있었나. 생성기의 기억이지 판의 상태가 아니라
   여기 둔다 — 같은 시설이 두 층 연달아 나오는 것을 막는 데만 쓴다. */
let LAST_FLOOR = [];
/* 규칙 쪽이 생성기에 거는 편향. 층을 만들기 직전에 game.js가 채우고,
   planFacilities 한 곳에서만 읽는다 — 생성기가 유물을 알아야 하는
   자리를 이 한 줄로 묶어 둔다. */
let FACILITY_BIAS = {};
export const setFacilityBias = o => { FACILITY_BIAS = o || {}; };

/* Tiles 0-6 are the original set. A door is now four tiles
   rather than one, because a *closed* door is the thing that
   makes archers and hounds interesting: it breaks line of
   sight, and shutting one behind you is a real move. */
export const ROCK = 0, FLOOR = 1, DOWN = 2, UP = 3, DOOR = 4, RUBBLE = 5, SHOP = 6,
             DOOR_OPEN = 7, DOOR_LOCKED = 8, DOOR_BROKEN = 9,
             WEB = 10, WATER = 11, CAMP = 12, ALTAR = 13, EVENT = 14, ANVIL = 15,
             PROP = 16;

/* rooms: how many · size: room dimensions · light/water/web:
   multipliers on the usual amount · mob: monster density. */
export const THEMES = {
  /* 방 수를 3분의 1쯤 줄였다. 한 층에 175~324턴을 쓰고 있었고, 그
     턴의 87%가 걷기·대기였다 — 콘텐츠가 없는 것이 아니라 콘텐츠
     사이가 멀었다. 몬스터 예산(mob)은 그대로라, 같은 것들이 절반의
     걸음 안에 담긴다. 밀도는 그렇게 올린다. */
  plain:  { id:'plain',  n:null,            weight:26, rooms:[7,9],   size:[4,9],  light:1.0,  water:1.0, web:1.0, mob:1.0 },
  warren: { id:'warren', n:'좁은 굴',       weight:14, rooms:[10,13], size:[3,4],  light:0.8,  water:0.6, web:1.4, mob:1.15, from:3 },
  hall:   { id:'hall',   n:'큰 방',         weight:12, rooms:[4,5],   size:[9,12], light:1.2,  water:1.0, web:0.6, mob:1.1,  from:3 },
  dark:   { id:'dark',   n:'빛이 없는 층',  weight:10, rooms:[6,9],   size:[4,9],  light:0.0,  water:0.8, web:1.0, mob:0.9,  from:4 },
  flooded:{ id:'flooded',n:'물에 잠긴 층',  weight:9,  rooms:[6,8],   size:[5,10], light:0.9,  water:3.2, web:0.5, mob:1.0,  from:4 },
  nest:   { id:'nest',   n:'소굴',          weight:9,  rooms:[6,8],   size:[4,9],  light:0.7,  water:0.8, web:2.2, mob:1.6,  from:5 },
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

/* 「언젠가는 갈 수 있는가」. `walkable`은 지금 이 순간 발을 디딜 수
   있는지를 묻고, 이쪽은 판 전체를 두고 묻는다 — 잠긴 문은 벽이
   아니라 **열쇠를 아직 안 구한 문**이다. 연결성을 검증할 때 이 둘을
   섞으면 잠긴 문 뒤를 「끊긴 구역」으로 세고, 그걸 고치겠다고 옆에
   굴을 파서 자물쇠라는 장치를 통째로 없애 버린다. */
export const eventuallyWalkable = (level, x, y) => {
  if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
  return level.tiles[idx(x, y)] === DOOR_LOCKED || walkable(level, x, y);
};

/* What is standing on this tile, if anything. */
export const propAt = (level, x, y) =>
  (level.tiles[idx(x, y)] === PROP ? level.props.get(idx(x, y)) : null) || null;

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
    /* Furniture, unlike traps, *is* on the grid — it blocks and
       it is drawn — but what each one is lives here. */
    this.props  = new Map();     // tile index -> { kind, hp, lit }
    this.rooms  = [];
    this.entry  = { x: 0, y: 0 };
    depth === 0 ? this.buildTown() : this.buildDungeon();
  }

  solid(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return true;
    const t = this.tiles[idx(x, y)];
    /* A pillar is masonry and a brazier is an open fire: neither
       is a tile you end a turn standing on, so both are solid and
       pathing routes around them. The rest of the furniture is
       walked into and dealt with, the way a shut door is.

       This matters more than it looks: a lit brazier that was not
       solid could never be walked onto and never be broken, so
       anything routing through it looped forever. */
    if (t === PROP) {
      const k = this.props.get(idx(x, y))?.kind;
      /* 좌판과 우물도 여기 들어간다. 좌판은 hp 8짜리 부술 수 있는
         가구로 서 있었다 — 상인의 가판을 세 대 치면 부서지고, 간판도
         같이 사라졌다. 우물도 마찬가지. 둘 다 지나갈 수 없고 부술
         수도 없는 것이 맞다. */
      return k === 'pillar' || k === 'brazier' || k === 'stall' || k === 'well';
    }
    /* 그리고 사람. 마을의 여섯 주인은 그려지기만 하고 몸이 없어서
       그대로 통과해 걸을 수 있었다. 마을에서만이다 — 던전의 떠돌이
       행상은 흥정하는 칸과 서 있는 칸이 같은 한 칸이라, 여기서
       막으면 그와는 영영 거래할 수 없게 된다. */
    if (this.depth === 0 && this.keeperAt.has(idx(x, y))) return true;
    return t === ROCK || t === SHOP || isShut(t);
  }

  opaque(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return true;
    const t = this.tiles[idx(x, y)];
    return t === ROCK || t === SHOP || isShut(t);
  }

  /* ── 갱구 야영지 ────────────────────────────────────────
     예전에는 마을이었다. 지붕이 무너진 집들과 골목과 수레들 —
     잘 만들어져 있었지만, 이 게임은 아래로 파는 게임이다. 위로
     돌아갈 수 없게 만든 이상 마을은 판 시작에 한 번 지나가는
     곳이 되고, 그러면 골목이니 폐허니 하는 것은 전부 한 번
     보고 마는 배경이다.

     그래서 야외로 바꿨다. 지붕도 벽도 없다. 재에 덮인 빈 땅
     한가운데 큰 불이 하나 타고, 그 둘레에 수레 여섯 대가 등을
     밖으로 돌리고 서 있고, 한쪽에 갱구가 입을 벌리고 있다.
     여기 있는 것들은 여기 사는 것이 아니라 여기서 기다린다 —
     내려간 것이 뭘 들고 올라오는지를.

     ── town: a place people built, not a plan ─────────────
     The old one was a rectangle of floor with six identical
     shopfronts pinned to its rim at even spacing, a scatter of
     rubble, and the stairs bare in the middle. It read as a
     level-select screen with a floor texture.

     This one is cut the way a settlement actually grows: a
     street that wanders because the ground made it wander, side
     lanes of whatever length they happened to reach, a market
     that is a widening of the street rather than a courtyard,
     buildings of assorted footprints crowded against the lanes
     with their doors on the street, and the stair mouth at the
     far end with the town turning its back on it.

     Half the buildings are shut houses with no door at all. A
     town where every single building is a shop you can enter is
     a shopping mall, and the one thing this town is supposed to
     say is that most of the people who lived here have gone. */
  buildTown() {
    /* 좁게. 예전에는 판 전체(46×26, 걸을 수 있는 땅 1154칸)를 썼는데,
       한 번 지나가는 곳에 그만한 넓이는 「빈 땅을 가로지르는 시간」
       외에 아무것도 아니다. 갱구 둘레만 남긴다 — 불에서 갱구까지
       열 걸음, 수레 여섯 대는 그 사이에.

       바깥은 바위다. 야영지 밖으로 나갈 이유가 없고, 나갈 수 있으면
       화면이 「어디까지가 여기인가」를 말하지 못한다. */
    const w = Math.min(MW - 6, 27), h = Math.min(MH - 6, 17);
    const x0 = ((MW - w) >> 1), y0 = ((MH - h) >> 1);
    const inb = (x, y) => x > x0 && y > y0 && x < x0 + w - 1 && y < y0 + h - 1;
    const at = (x, y) => (inb(x, y) ? this.tiles[idx(x, y)] : ROCK);

    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) this.tiles[idx(x, y)] = FLOOR;

    /* The traders camp in the middle of it, the way people who
       have somewhere else to be always do — in a cleared lane,
       facing each other, close enough to hear each other shout. */
    const cx = x0 + 8 + rnd(w - 22), cy = y0 + (h >> 1) + rnd(5) - 2;
    const gateX = (cx - x0 < w / 2) ? x0 + w - 7 : x0 + 6;
    const gateY = Math.max(y0 + 5, Math.min(y0 + h - 6, cy + rnd(11) - 5));
    const camp = (x, y) => Math.abs(x - cx) <= 7 && Math.abs(y - cy) <= 4;
    const yard = (x, y) => Math.hypot(x - gateX, y - gateY) < 4.5;

    /* 마을은 던전과 달리 좌표를 손으로 박아 만든 곳이라, 판 크기가
       66×40에서 52×32로 줄었을 때 여기 상수들만 그대로 남았다.
       폐허는 아홉 채를 노리는데 여섯 채밖에 안 들어가고 (들어가다
       만 것은 벽 조각으로 보인다), 돌무더기 마흔아홉 칸과 잡동사니
       일곱이 좁아진 거리에 그대로 쏟아졌다 — 주석이 경계하던 바로
       그 「틀린 그림 찾기」가 크기 때문에 되살아난 것이다.
       그래서 이제 개수를 넓이에서 뽑는다. 다음에 판을 또 줄여도
       같은 밀도로 따라온다. */
    const AREA = w * h, LOT = AREA / 2040;      // 예전 60×34을 1로 친다

    /* 지붕이 남은 것은 하나도 없다 — 이제는 아예 집이 없다.
       예전 폐허 다섯 채 대신, 재에 파묻힌 잔해 무더기 몇 개만
       남긴다. 벽으로 서 있는 것은 갱구를 판 쪽이 쌓아 둔 버력
       더미뿐이고, 그것도 낮아서 시야를 막지 않는다.

       야외라는 것이 규칙으로도 읽혀야 한다: 여기에는 골목이 없고,
       어디서든 불이 보이고, 갱구도 보인다. 그래서 이 화면에서
       할 일은 「길 찾기」가 아니라 「내려가기 전에 무엇을 살까」다. */
    let heaps = 0;
    for (let t = 0; t < 400 && heaps < Math.max(3, Math.round(6 * LOT)); t++) {
      const bw = 3 + rnd(4), bh = 2 + rnd(3);
      const bx = x0 + 2 + rnd(w - bw - 4), by = y0 + 2 + rnd(h - bh - 4);
      let ok = true;
      for (let y = by - 1; y <= by + bh && ok; y++)
        for (let x = bx - 1; x <= bx + bw && ok; x++)
          if (!inb(x, y) || at(x, y) !== FLOOR || camp(x, y) || yard(x, y)) ok = false;
      if (!ok) continue;
      for (let y = by; y < by + bh; y++)
        for (let x = bx; x < bx + bw; x++)
          this.tiles[idx(x, y)] = Math.random() < 0.34 ? SHOP : RUBBLE;
      heaps++;
    }

    /* The camp itself: two facing rows of stalls with a lane
       between them. The tile you step on to trade is the ground
       in front of the stall, not a door — there are no doors
       left in this town. */
    const stallRow = (sy, ky, ids) => {
      ids.forEach((id, k) => {
        const sx = cx + (k - 1) * 4;
        const shop = SHOPS.find(s2 => s2.id === id);
        if (!shop || !inb(sx, sy)) return;
        this.tiles[idx(sx, sy)] = PROP;
        this.props.set(idx(sx, sy), { kind:'stall', hp: 8 });
        this.signAt.set(idx(sx, sy), id);
        this.keeperAt.set(idx(sx, ky), id);
        this.shopAt.set(idx(sx, sy + Math.sign(cy - sy)), id);
      });
    };
    stallRow(cy - 2, cy - 3, [3, 2, 1]);
    stallRow(cy + 2, cy + 3, [5, 4, 6]);

    /* Furniture, checked against the same rule the dungeon uses:
       never stand something where it could seal a way through. */
    const place = (x, y, kind) => {
      const i = idx(x, y);
      if (!inb(x, y) || this.tiles[i] !== FLOOR) return false;
      if (this.shopAt.has(i) || this.keeperAt.has(i) || this.signAt.has(i)) return false;
      let free = 0;
      for (const [ax, ay] of [[1,0],[-1,0],[0,1],[0,-1]])
        if (at(x + ax, y + ay) === FLOOR) free++;
      if (free < 3) return false;
      this.tiles[i] = PROP;
      this.props.set(i, { kind, hp: kind === 'well' ? 40 : 6, lit: kind === 'brazier' });
      return true;
    };

    /* 야영지의 불. 수레 줄 양 끝과, 갱구 어귀에. 갱구 쪽 둘은
       특히 중요하다 — 화면에서 마지막으로 밝은 것이 내려가는
       구멍이어야 「저기로 간다」가 말 없이 읽힌다. */
    place(cx - 6, cy, 'brazier'); place(cx + 6, cy, 'brazier');
    place(cx - 6, cy - 3, 'brazier'); place(cx + 6, cy + 3, 'brazier');
    place(cx + 8, cy - 4, 'well') || place(cx - 8, cy + 4, 'well');
    place(gateX - 3, gateY - 2, 'brazier'); place(gateX + 3, gateY + 2, 'brazier');
    place(gateX - 2, gateY + 2, 'brazier'); place(gateX + 2, gateY - 2, 'brazier');
    // and a handful guttering out in the empty streets
    let lamps = 0;
    /* 어두운 야영지라 불이 더 필요하다 — 화로는 이제 장식이 아니라
       「여기가 야영지다」를 그리는 유일한 선이다. */
    const LAMPS = Math.max(5, Math.round(9 * LOT));
    for (let t = 0; t < 90 && lamps < LAMPS; t++)
      if (place(x0 + 2 + rnd(w - 4), y0 + 2 + rnd(h - 4), 'brazier')) lamps++;
    /* A few, not a field of them. Sixty barrels and skulls turned
       the streets into a spot-the-difference puzzle. */
    let junk = 0;
    const JUNK = Math.max(3, Math.round(7 * LOT));
    for (let t = 0; t < 80 && junk < JUNK; t++) {
      const x = x0 + rnd(w), y = y0 + rnd(h);
      if (camp(x, y) || yard(x, y)) continue;
      if (place(x, y, Math.random() < 0.5 ? 'bones' : 'barrel')) junk++;
    }

    /* Rubble against the standing walls and along the edges —
       what came off the buildings is still lying where it fell. */
    for (let t = 0; t < Math.round(160 * LOT); t++) {
      const x = x0 + rnd(w), y = y0 + rnd(h);
      if (at(x, y) !== FLOOR || camp(x, y) || yard(x, y)) continue;
      let wall = 0;
      for (const [ax, ay] of [[1,0],[-1,0],[0,1],[0,-1]]) if (at(x + ax, y + ay) === SHOP) wall++;
      if (wall >= 1 && Math.random() < 0.4) this.tiles[idx(x, y)] = RUBBLE;
    }

    /* 갱구. 구멍 하나만 찍어 두면 던전 계단과 똑같이 보인다 —
       여기는 야외이고 저것은 땅에 뚫린 입이므로, 둘레에 버력을
       둘러 「파낸 자리」로 읽히게 한다. 어귀 자체는 비워 둔다. */
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < 2 || d > 3) continue;
      const x = gateX + dx, y = gateY + dy;
      if (!inb(x, y) || this.tiles[idx(x, y)] !== FLOOR) continue;
      if (this.shopAt.has(idx(x, y))) continue;
      this.tiles[idx(x, y)] = RUBBLE;
    }
    this.tiles[idx(gateX, gateY)] = DOWN;
    /* 갱구는 처음부터 보인다. 여기 온 이유가 그것 하나뿐인데, 어두운
       야영지에서 반경 7칸으로 찾아 헤매게 만들 이유가 없다 —
       실제로 「계단이 눈에 안 띈다」는 제보가 그것이었다.
       둘레의 버력까지 같이 드러내서, 도착하자마자 「저기가 입구다」가
       한눈에 읽히게 한다. */
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = gateX + dx, y = gateY + dy;
      if (inb(x, y)) this.seen[idx(x, y)] = 1;
    }
    this.entry = { x: gateX, y: gateY };
    for (const [ex, ey] of [[gateX, gateY + 2], [gateX, gateY - 2], [gateX + 2, gateY], [gateX - 2, gateY]])
      if (!this.solid(ex, ey)) { this.entry = { x: ex, y: ey }; break; }

    /* One lit room over the whole settlement, so daylight reaches
       the far end of the street instead of guttering out two
       tiles from the hero the way torchlight does. It goes in
       first so the ruins above keep their own indices. */
    /* 그리고 어둡게. 예전에는 야영지 전체가 한 덩어리의 밝은 방이라
       발을 딛는 순간 전부 드러났다 — 낮의 광장이었다. 이제 밝지
       않다: 보이는 것은 네 등불이 닿는 데까지고, 그 너머에서
       화로들이 점처럼 탄다. 아래로 내려가면 어떤 곳인지를 이
       화면이 미리 한 번 말해 주는 셈이다. */
    this.rooms.unshift({ x: x0, y: y0, w, h, lit: false, bright: false });
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) this.roomOf[idx(x, y)] = 0;
    this.theme = { id:'town' };
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
    /* 내려온 자리. 예전에는 올라가는 계단이었다 — 이제 등 뒤에서
       무너진 구멍이라, 밟아도 아무 데도 가지 않는다. 타일은 남긴다:
       「여기로 들어왔다」는 표시가 지도에 있어야 방향 감각이 선다. */
    this.tiles[idx(start.x, start.y)] = UP;

    let far = this.rooms[this.rooms.length - 1], best = -1;
    for (const r of this.rooms) {
      const c = this.centre(r), d = (c.x - start.x) ** 2 + (c.y - start.y) ** 2;
      if (d > best) { best = d; far = r; }
    }
    const st = this.centre(far);
    this.tiles[idx(st.x, st.y)] = DOWN;
    this.downRoom = far;

    /* ── 무엇을 놓을지 먼저 정한다 ────────────────────────
       예전에는 넷이 각자 주사위를 굴렸다(모닥불 60% · 모루 55% ·
       제단 52% · 수레 58%). 그러면 두 가지가 동시에 일어난다:
       한 층에 넷이 다 서기도 하고, **연달아 같은 것만 나오기도**
       한다. 실측으로 1층에 모루가 63%인데 그중 두들길 재료가 있는
       판은 65%였고 — 1층에서 재료가 있을 리 없다 — 제단은 1층에
       0%, 2층부터 40~60%로 층마다 똑같이 반복됐다.

       그래서 깊이가 성격을 갖게 한다. 얕은 곳은 **보급**(불과 수레),
       가운데는 **벼림**(모루), 아래는 **거래**(제단). 그리고 직전
       층에 있던 것은 이번 층에서 무게를 반으로 줄인다 — 같은 것이
       두 층 연달아 나오는 것이 「똑같은 이벤트」의 정체다. */
    this.planFacilities();
    this.scatterHazards(start, st);
    this.placeCamp(start, st);
    this.placeAnvil(start, st);
    this.scatterProps(start, st);
    this.placeMerchant(start, st);
    this.placeAltar(start, st);
    this.placeEvent(start, st);
    this.unsealStairs(start, st);
  }

  /* The ? room. Common on purpose — it is the cheapest content
     the game has and the only place the dungeon reacts to what
     you happen to be carrying, so a run should meet several. */
  /* 절반의 층에만 두었더니 판 전체에서 서너 번 마주치고 끝났다 —
     「가장 싼 콘텐츠」라고 적어 놓고 제일 아껴 쓴 셈이다. 이제
     1층부터 매 층 하나, 5층 아래로는 두 개째가 절반 확률로 붙는다. */
  placeEvent(start, down) {
    if (this.depth < 1) return;
    this.spotEvent(start, down);
    if (this.depth >= 5 && Math.random() < 0.5) this.spotEvent(start, down, true);
    if (FACILITY_BIAS.extraEvent) this.spotEvent(start, down, true);
  }

  spotEvent(start, down, second) {
    for (let t = 0; t < 70; t++) {
      const r = this.rooms[rnd(this.rooms.length)];
      if (!r) return;
      const x = r.x + rnd(r.w), y = r.y + rnd(r.h);
      const i = idx(x, y);
      if (this.tiles[i] !== FLOOR || this.traps.has(i)) continue;
      if (i === idx(start.x, start.y) || i === idx(down.x, down.y)) continue;
      this.tiles[i] = EVENT;
      // 나방의 표식이 읽는 것은 하나뿐이다 — 두 번째가 첫 번째를
      // 지우면 「사건 위치가 보인다」가 조용히 거짓말이 된다.
      if (!second || !this.event) this.event = { x, y };
      /* 자리를 전부 적어 둔다. 여태 층에 ? 가 둘 놓여도 사건은 하나만
         굴렸고, 그래서 둘째 ? 는 첫째를 밟는 순간 죽은 칸이 됐다 —
         플레이어가 「여러 개인데 하나만 켜진다」고 말한 것이 이것이다. */
      (this.eventTiles ||= []).push(i);
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
    if (!this.branch.altar && !this.plan?.altar) return;
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
    if (!this.plan?.shop) return;
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
      /* 간판. 화면 쪽에 「층의 상인은 오늘 끌고 온 짐을 간판에 건다」는
         코드를 써 놓고, 그 코드가 한 번도 실행되지 않고 있었다 —
         signAt을 세팅하는 곳은 온 저장소에서 마을 좌판 한 줄뿐이고
         거기 7번은 없다. 그래서 짐 정보의 유일한 통로가 8×8 그림의
         물감 22%였다.

         간판은 상인 **위 칸**에 건다. 벽이면 벽에 걸린 판자로 읽히고,
         바닥이면 세워 둔 판자로 읽힌다 — 어느 쪽이든 층 한복판에서
         「여기 장사 중」을 말하는 것은 사람 그림이 아니라 판자다. */
      const above = idx(x, y - 1);
      if (y - 1 > 0 && !this.shopAt.has(above) && !this.keeperAt.has(above)) {
        this.signAt.set(above, 7);
        this.seen[above] = 1;
      }
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
    if (!this.plan?.camp) return;
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

  /* ── the furniture ──────────────────────────────────────
     Rooms were empty boxes with monsters standing in them. Props
     are things the floor is *made of*: a barrel you can smash for
     what is inside it, a brazier that lights the room and burns
     what stands in it, a pillar that blocks a line of sight, a
     bone pile that wakes something when you disturb it.

     They live in `props`, keyed by tile index, and the tile is
     PROP so movement, pathing and line of sight all consult one
     place. What each kind does is in game.js — this only decides
     where they are. */
  scatterProps(start, down) {
    if (this.depth < 1) return;
    const kinds = ['barrel', 'brazier', 'pillar', 'bones', 'urn'];
    const n = 4 + rnd(6);
    for (let t = 0; t < n * 8 && this.props.size < n; t++) {
      const r = this.rooms[rnd(this.rooms.length)];
      if (!r) return;
      const x = r.x + rnd(r.w), y = r.y + rnd(r.h);
      const i = idx(x, y);
      if (this.tiles[i] !== FLOOR || this.traps.has(i)) continue;
      if (i === idx(start.x, start.y) || i === idx(down.x, down.y)) continue;
      // Never wall off a room: a prop in a one-tile doorway would
      // make a floor unsolvable for anything that cannot smash.
      let open = 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]])
        if (this.tiles[idx(x + dx, y + dy)] === FLOOR) open++;
      if (open < 3) continue;
      this.tiles[i] = PROP;
      this.props.set(i, { kind: kinds[rnd(kinds.length)], hp: 3 });
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
  /* 이번 층에 무엇이 서는가. 깊이가 성격을 정하고, 직전 층이 반복을
     막는다. 둘 또는 셋 — 넷이 다 서면 층이 시장이 되고, 하나만
     서면 걷기만 하는 층이 된다. */
  planFacilities() {
    const d = this.depth;
    const bias = FACILITY_BIAS;
    const want = {
      camp:  d <= 2 ? 0.95 : 0.66,
      shop:  d <= 2 ? 0.75 : 0.58,
      /* 모루는 재료가 모이기 시작하는 3층부터. 1~2층의 모루는
         「두들길 것이 없는 모루」이고, 그건 시설이 아니라 장식이다.
         (융합이 모루로 온 뒤로는 유물 둘이 모이는 시점이기도 하다.) */
      anvil: d <= 2 ? 0 : d <= 5 ? 0.55 : 0.65,
      /* 제단은 낼 것이 있어야 무섭다 — 피는 처음부터 있지만
         금화와 장비는 4층쯤부터 아깝다. */
      altar: d <= 3 ? 0 : 0.55,
    };
    this.plan = {};
    for (const k of Object.keys(want)) {
      const w = want[k] * (LAST_FLOOR.includes(k) ? 0.5 : 1);
      this.plan[k] = Math.random() < w;
    }
    /* 아무것도 안 서는 층은 없다. 그런 층은 「조용한 층」이 아니라
       그냥 빈 층이다 — 갈래의 `고요한 층`이 그 일을 따로 한다. */
    if (!Object.values(this.plan).some(Boolean)) this.plan[d <= 2 ? 'camp' : 'anvil'] = true;
    /* 규칙 쪽에서 온 두 가지 편향. 생성기는 왜인지 모른다 — 불씨
       항아리가 깨졌으면 불이 반드시 서고, 나방의 표식이 깨졌으면
       꺼져 있는 것 하나가 더 선다. 층을 만드는 쪽에 유물 이름이
       들어오면 그때부터 생성기가 규칙을 알게 된다. */
    if (bias.camp) this.plan.camp = true;
    /* 되풀이하는 판 — 물어볼 곳은 늘고 쉴 곳은 없다. */
    if (bias.noCamp) this.plan.camp = false;
    if (bias.extra) {
      const off = Object.keys(want).filter(k => !this.plan[k]);
      if (off.length) this.plan[off[rnd(off.length)]] = true;
    }
    LAST_FLOOR = Object.keys(this.plan).filter(k => this.plan[k]);
  }

  placeAnvil(start, down) {
    if (!this.plan?.anvil) return;
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
