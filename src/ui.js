/* ═══════════════════════════════════════════════════════════
   ui.js — canvas for the dungeon, DOM text for everything
   else. Korean needs real font shaping, so the chrome stays
   in the DOM; only the map is pixels.
   ═══════════════════════════════════════════════════════════ */

import { sprite, hasSprite, wallTile, floorTile, CELL_SIZE, PALETTE, setTerrainTheme } from './pixels.js';
import * as Pix from './pixels.js';
import {
  RACES, CLASSES, STATS, STAT_NAME, MAX_DEPTH, SHOPS, AILMENTS, TRAPS, statRange,
  PREFIXES, SUFFIXES, SPELL_AFFIXES, affixName, MATS, ENCHANT_COST, REROLL_COST,
  REFINE_COST, ATTUNE_COST, ATTUNE_MAX,
  ENCHANT_CURSE, ENCHANT_CURSE_STEP,
  RARITY, CURSED_TONE, rarityOf, isCursed,
  RELIC_SLOTS, RELICS, relicById, WEAPON_TYPES, PATTERNS,
  BUILD, SAVE_FORMAT,
  MONSTERS, BRANCHES, SPELLS, SPELLS_COMMON, boonById, FUSIONS, engraveById, ENGRAVE_AT, ENGRAVE_PENALTY, NAMED,
  BOSS, tellsOf, tellsNeeded, rulebook, hearsayFor, CONSUMABLES, RESONANCE,
  REGIONS, regionOf, MEMORIES, memoryEarned, SHACKLES, MAX_SHACKLE, josa,
  UPGRADE_CRIT, CAREFUL_MULT, CAREFUL_BONUS, FUSE_ODDS, FUSE_COST,
  xpToLevel, statBonus, poolName,
} from './data.js';
import { EVENTS } from './events.js';

const EVENTS_TOTAL = EVENTS.length;
const BRANCH_TOTAL = BRANCHES.length;
import {
  MW, MH, idx, clamp, walkable, isDoor,
  ROCK, FLOOR, DOWN, UP, DOOR, RUBBLE, SHOP,
  DOOR_OPEN, DOOR_LOCKED, DOOR_BROKEN, WEB, WATER, CAMP, ALTAR, EVENT, ANVIL, PROP, propAt,
} from './world.js';
import * as Data from './data.js';
import * as Game from './game.js';
import { G } from './game.js';
import * as Juice from './juice.js';
import * as Save from './save.js';
import * as Audio from './audio.js';
import * as Meta from './meta.js';

const $ = id => document.getElementById(id);
/* 와/과. 「약장수과 거래」는 한 글자 틀린 것이 아니라 글이 기계처럼
   읽히게 만드는 종류의 틀림이다. 받침이 있으면 과, 없으면 와 —
   한글 음절은 (코드 − 0xAC00) % 28이 0이면 받침이 없다. */
const wa = s => {
  const c = (s || '').trim().slice(-1).charCodeAt(0);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return '와';   // 한글이 아니면 기본값
  return (c - 0xac00) % 28 ? '과' : '와';
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const cv = $('map'), ctx = cv.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
let scale = 3, viewW = 0, viewH = 0, cols = 0, rows = 0;

/* ── viewport ───────────────────────────────────────────────
   The canvas fills #stage with CSS, but its *bitmap* only
   changes here. Anything that resizes #stage without calling
   this leaves an old bitmap stretched into a new box — the map
   goes squat or tall. #stage is a flex child, so it moves
   whenever the panels around it do: the action column gaining
   "문 닫기", the HUD chips wrapping to a second line, the
   mobile URL bar sliding away. Watching the window is not
   enough; the observer below watches the box itself. */
export function resize() {
  const box = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(box.width * dpr), h = Math.round(box.height * dpr);
  if (!w || !h) return;                            // screen is hidden
  if (w === cv.width && h === cv.height) return;   // nothing moved

  cv.width = w; cv.height = h;
  /* Device-pixel space, identity transform. The old dpr transform
     put drawing in CSS pixels, so a sprite pixel covered
     scale×dpr device pixels — fractional on most phones, and the
     rounding fell differently on every column: the grid was made
     of subtly unequal pixels. Working in device pixels with an
     integer scale makes every sprite pixel the same square, which
     is the whole contract of the art style. */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;

  viewW = w; viewH = h;
  scale = clamp(Math.round(w / (CELL_SIZE * 17)), 2, 12);
  cols = Math.ceil(viewW / (CELL_SIZE * scale));
  rows = Math.ceil(viewH / (CELL_SIZE * scale));
  draw();
}

/* The camera is a float that chases the hero rather than a
   integer that snaps to him. Combined with the per-actor
   offsets in juice.js this is what turns a tile hop into a
   step. */
let camX = 0, camY = 0, camReady = false;
let endHold = null;
let heroFacing = 1, heroLastX = null;

function cameraTarget() {
  const p = G.player;
  let cx = clamp(p.x - (cols - 1) / 2, 0, Math.max(0, MW - cols));
  let cy = clamp(p.y - (rows - 1) / 2, 0, Math.max(0, MH - rows));
  if (MW < cols) cx = -(cols - MW) / 2;
  if (MH < rows) cy = -(rows - MH) / 2;
  return { cx, cy };
}

function camera() {
  return { cx: camX, cy: camY, t: CELL_SIZE * scale };
}

export function snapCamera() {
  Juice.clearDeath();
  if (!G.player) return;
  const { cx, cy } = cameraTarget();
  camX = cx; camY = cy; camReady = true;
}

/* ── the map ────────────────────────────────────────────── */
export function draw() {
  if (!G.level || !G.player) return;
  const L = G.level, p = G.player;
  /* The masonry belongs to the theme. One call before any tile is
     asked for; the cache is keyed by theme so walking back up a
     floor costs nothing. */
  /* 층의 성격과 깊이를 같이 넘긴다 — 무늬는 성격이 정하고, 온도는
     구역이 정한다. 열다섯 층을 내려가는 동안 돌이 실제로 달아오른다. */
  setTerrainTheme(L.theme?.id || 'plain', G.depth > 0 ? REGIONS.indexOf(regionOf(G.depth)) : 0);
  /* 죽는 순간의 렌즈. 카메라가 그 자리로 조이고 타일이 커진다 —
     「왜 죽었는지」를 읽으려면 먼저 **무엇이 거기 서 있었는지**가
     보여야 한다. juice 가 얼마나 조였는지만 알려 주고, 어디를 어떻게
     그릴지는 여기서 정한다. */
  /* 카메라는 죽음의 렌즈와 궁극기의 렌즈를 같은 자리에서 읽는다 —
     둘 다 「얼마나 조였고 어디를 보나」일 뿐이다. 아래 어둡게 하는
     쪽만 죽음 전용으로 남는다. */
  const lens = Juice.lens();
  const t = Math.round(CELL_SIZE * scale * (lens ? lens.k : 1));
  if (!camReady) snapCamera();
  if (lens?.at) {
    const lc = Math.ceil(viewW / t), lr = Math.ceil(viewH / t);
    camX = lens.at.x - (lc - 1) / 2;
    camY = lens.at.y - (lr - 1) / 2;
  }

  const jolt = Juice.shakeVec();
  const cx = camX + jolt.x, cy = camY + jolt.y;

  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(0, 0, viewW, viewH);

  const lightR = G.lightRadius || 7;
  const x0 = Math.floor(cx) - 1, y0 = Math.floor(cy) - 1;
  /* Two-frame tiles: water laps, fire leans. One clock for all
     of them so the floor breathes in unison. */
  const flick = ((performance.now() / 420) | 0) & 1;

  for (let y = y0; y <= cy + rows + 1; y++) {
    for (let x = x0; x <= cx + cols + 1; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const i = idx(x, y);
      if (!L.seen[i]) continue;

      const px = Math.round((x - cx) * t), py = Math.round((y - cy) * t);
      const tile = L.tiles[i];
      const lit = L.vis[i];

      /* The fog is a smooth alpha fade — tried as ordered dither
         once (v33) and walked back: the sprites are the pixels,
         the light is allowed to be light. Hard dots, soft glow. */
      let alpha;
      if (lit) {
        const d = Math.hypot(x - p.x, y - p.y);
        const rid = L.roomOf[i];
        /* Daylight, not torchlight. A lit dungeon room still
           falls off toward its corners; the town does not, or the
           far end of the street reads as unexplored cave. */
        const room = rid >= 0 ? L.rooms[rid] : null;
        const ambient = room?.bright ? 1
          : (room?.lit && rid === L.roomOf[idx(p.x, p.y)]) ? 0.55 : 0;
        alpha = clamp(0.30 + Math.max(ambient, 1 - d / (lightR + 1.5)) * 0.72, 0, 1);
      } else {
        alpha = 0.26;
      }

      ctx.globalAlpha = alpha;

      if (tile === ROCK || tile === SHOP) {
        warped(ctx, wallTile(x, y), px, py, t, x, y);
        /* 벽에도 외곽선. 스프라이트는 구울 때 테두리를 얻었는데 지형은
           못 얻었고(지형은 구울 때 이웃을 모른다), 그래서 벽 덩어리가
           덩어리가 아니라 무늬 밭으로 읽혔다 — 어디까지가 벽이고
           어디부터 바닥인지가 색 차이로만 있었다.

           바닥에 면한 쪽에만 한 줄 긋는다. 벽끼리 붙은 면에 그으면
           격자무늬가 되고, 그건 테두리가 아니라 모눈종이다. */
        const u = Math.max(1, Math.round(t / CELL_SIZE));   // 한 픽셀
        ctx.fillStyle = PALETTE.k;
        const wallAt = (ax, ay) => {
          if (ax < 0 || ay < 0 || ax >= MW || ay >= MH) return true;
          const tt = L.tiles[idx(ax, ay)];
          return tt === ROCK || tt === SHOP;
        };
        if (!wallAt(x, y - 1)) ctx.fillRect(px, py, t, u);
        if (!wallAt(x, y + 1)) ctx.fillRect(px, py + t - u, t, u);
        if (!wallAt(x - 1, y)) ctx.fillRect(px, py, u, t);
        if (!wallAt(x + 1, y)) ctx.fillRect(px + t - u, py, u, t);
      } else {
        warped(ctx, floorTile(x, y), px, py, t, x, y);
        if (tile === DOWN) {
          /* 내려가는 자리는 이 게임에서 유일하게 「반드시 찾아야 하는」
             칸이다. 8×8 계단 그림 하나로는 어두운 바닥에서 안 읽힌다 —
             갱구에서 특히 그랬다. 밑에 숨 쉬는 빛을 깔아 준다.
             좋은 물건의 빛기둥과 같은 언어이되 색이 다르다: 저쪽은
             갖는 것이고 이쪽은 가는 것이다. */
          const beat = 0.5 + Math.sin(performance.now() / 520) * 0.22;
          const prevA2 = ctx.globalAlpha;
          const g2 = ctx.createRadialGradient(px + t / 2, py + t / 2, t * 0.12,
                                              px + t / 2, py + t / 2, t * 1.35);
          g2.addColorStop(0, PALETTE.o);
          g2.addColorStop(1, 'transparent');
          ctx.globalAlpha = beat * 0.55;
          ctx.fillStyle = g2;
          ctx.fillRect(px - t, py - t, t * 3, t * 3);
          ctx.globalAlpha = prevA2;
          ctx.drawImage(sprite('stairsDown'), px, py, t, t);
        }
        if (tile === UP)          ctx.drawImage(sprite('stairsUp'),   px, py, t, t);
        if (tile === DOOR)        ctx.drawImage(sprite('door'),       px, py, t, t);
        if (tile === DOOR_OPEN)   ctx.drawImage(sprite('doorOpen'),   px, py, t, t);
        if (tile === DOOR_LOCKED) ctx.drawImage(sprite('doorLocked'), px, py, t, t);
        if (tile === DOOR_BROKEN) ctx.drawImage(sprite('doorBroken'), px, py, t, t);
        if (tile === WEB)         ctx.drawImage(sprite('web'),        px, py, t, t);
        if (tile === WATER)       ctx.drawImage(sprite(flick ? 'water2' : 'water'), px, py, t, t);
        if (tile === CAMP) {
          const prevA = ctx.globalAlpha;
          ctx.globalAlpha = Math.max(prevA, 0.55 + Math.sin(performance.now() / 300) * 0.12);
          ctx.drawImage(sprite(flick ? 'camp2' : 'camp'), px, py, t, t);
          ctx.globalAlpha = prevA;
        }
        if (tile === ALTAR) {
          const prevA = ctx.globalAlpha;
          ctx.globalAlpha = Math.max(prevA, 0.6 + Math.sin(performance.now() / 380) * 0.18);
          ctx.drawImage(sprite('altar'), px, py, t, t);
          ctx.globalAlpha = prevA;
        }
        if (tile === EVENT) {
          const prevA = ctx.globalAlpha;
          ctx.globalAlpha = Math.max(prevA, 0.62 + Math.sin(performance.now() / 340) * 0.16);
          ctx.drawImage(sprite('event'), px, py, t, t);
          ctx.globalAlpha = prevA;
        }
        if (tile === ANVIL) {
          const prevA = ctx.globalAlpha;
          ctx.globalAlpha = Math.max(prevA, 0.7 + Math.sin(performance.now() / 500) * 0.12);
          ctx.drawImage(sprite('anvil'), px, py, t, t);
          ctx.globalAlpha = prevA;
        }
        if (tile === PROP) {
          const o = propAt(L, x, y);
          if (o) {
            // A lit brazier throws its own light, so it is drawn
            // at full brightness whatever the fog says.
            const prevA = ctx.globalAlpha;
            const isLit = o.kind === 'brazier' && o.lit;
            if (isLit) ctx.globalAlpha = 1;
            ctx.drawImage(sprite(isLit ? (flick ? 'brazierLit2' : 'brazierLit') : o.kind),
                          px, py, t, t);
            ctx.globalAlpha = prevA;
          }
        }
        if (tile === RUBBLE)      ctx.drawImage(sprite('rubble'),     px, py, t, t);

        // A trap you have spotted is drawn; one you haven't isn't.
        const tr = L.traps.get(i);
        if (tr && tr.seen) ctx.drawImage(sprite('trap'), px, py, t, t);
      }

      /* A shopfront tells you what it sells before you walk in:
         a plank with the goods painted on it, the keeper standing
         under it, and the door number small in the corner. */
      const signId = L.signAt?.get(i);
      if (signId && L.seen[i]) {
        const shop = SHOPS.find(s => s.id === signId);
        /* 층에서 만나는 상인의 간판은 **오늘 끌고 온 짐**을 건다.
           표에 굳은 부적 하나가 걸려 있던 동안, 여섯 수레는 전부
           같은 간판이었다 — 짐을 나눈 것이 화면에 안 나온 것이다. */
        const load = shop?.wander ? Game.wanderLoad() : null;
        ctx.globalAlpha = 1;
        /* 간판은 좌판 위에 걸린다 — 같은 칸을 꽉 채워 그리면 아래의
           좌판을 완전히 덮어서, 여섯 수레가 「공중에 뜬 판자」로
           보인다. 위쪽 3/4만 쓰고 아랫단은 좌판의 다리에 내준다. */
        const sh = t * 0.74;
        ctx.drawImage(sprite('sign'), px, py, t, sh);
        const icon = load?.spr || shop?.spr;
        if (icon) ctx.drawImage(sprite(icon), px, py, t, sh);
      }

      const keeperId = L.keeperAt?.get(i);
      if (keeperId && L.seen[i]) {
        ctx.globalAlpha = 1;
        // A slow shift of weight, so the town does not look embalmed.
        const sway = Math.sin(performance.now() / 700 + keeperId) * t * 0.035;
        /* 마을의 좌판 주인은 계산대 뒤에 서 있고, 층의 상인은 수레를
           끌고 다닌다. 여태 둘이 같은 그림이었다 — 층 한복판에 놓인
           계산대는 계산대로 안 읽히고, 그래서 돌멩이로 보였다. */
        const cart = keeperId === 7 ? Game.wanderLoad() : null;
        const who = keeperId === 7 ? `pedlar:${cart?.id || 'wick'}` : `keeper:${keeperId}`;
        ctx.drawImage(sprite(who), px + sway, py, t, t);
      }

      const shopId = L.shopAt.get(i);
      if (shopId && lit) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = PALETTE.y;
        ctx.font = `bold ${Math.floor(t * 0.42)}px Galmuri11, ui-monospace, monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(String(shopId), px + t * 0.08, py + t * 0.06);
      }
    }
  }

  ctx.globalAlpha = 1;

  /* ── 화면 밖의 갱구 ──────────────────────────────────────
     폰에서 보이는 것은 층의 일부다 — 320px에서는 16×9칸이고, 층은
     52×32다. 내려가는 자리가 화면 밖에 있으면 「어디로 가야 하지」에
     답할 방법이 지도를 열어 보는 것밖에 없다.

     본 적 있는 계단이 화면 밖에 있으면 가장자리에 화살표를 세운다.
     본 적 없으면 안 세운다 — 안 가 본 곳을 가리키는 것은 안내가
     아니라 정답 공개다. */
  {
    const L2 = G.level;
    let sx = -1, sy = -1;
    for (let i = 0; i < L2.tiles.length; i++)
      if (L2.tiles[i] === DOWN && L2.seen[i]) { sx = i % MW; sy = (i / MW) | 0; break; }
    if (sx >= 0) {
      const ax = (sx - cx) * t + t / 2, ay = (sy - cy) * t + t / 2;
      const off = ax < 0 || ay < 0 || ax > viewW || ay > viewH;
      if (off) {
        const mgn = 16;
        const px2 = Math.max(mgn, Math.min(viewW - mgn, ax));
        const py2 = Math.max(mgn, Math.min(viewH - mgn, ay));
        const ang = Math.atan2(ay - viewH / 2, ax - viewW / 2);
        const beat = 0.55 + Math.sin(performance.now() / 520) * 0.25;
        ctx.save();
        ctx.translate(px2, py2);
        ctx.rotate(ang);
        ctx.globalAlpha = beat;
        ctx.fillStyle = PALETTE.o;
        ctx.beginPath();
        ctx.moveTo(11, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ── marked ground ──────────────────────────────────────
     The whole point of a telegraph is that it is unmissable and
     unambiguous: a filled tint, a hard border on the outside
     edge of the shape, and the count printed once in the middle.
     Drawn under the actors so it never hides what is standing
     in it — the thing you most need to see. */
  for (const h of G.hazards) {
    const col = PALETTE[h.tone] || PALETTE.o;
    const urgent = h.left <= 1;
    /* Light enough to read the floor through — the marked area
       has to say "danger" without hiding what is standing in it.
       The border and the count carry the message; the fill is
       only there to bound the shape. */
    const beat = urgent ? 0.30 + Math.abs(Math.sin(performance.now() / 130)) * 0.26
                        : 0.14 + Math.abs(Math.sin(performance.now() / 300)) * 0.09;
    ctx.save();
    ctx.fillStyle = col;
    for (const i of h.tiles) {
      const hx = i % MW, hy = (i / MW) | 0;
      if (!L.seen[i]) continue;
      ctx.globalAlpha = beat * (L.vis[i] ? 1 : 0.45);
      ctx.fillRect(Math.round((hx - cx) * t), Math.round((hy - cy) * t), t, t);
    }
    // outline: any edge with no sibling tile beyond it
    ctx.globalAlpha = urgent ? 0.95 : 0.6;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1.5, t * 0.09);
    const own = new Set(h.tiles);
    ctx.beginPath();
    for (const i of h.tiles) {
      const hx = i % MW, hy = (i / MW) | 0;
      if (!L.seen[i]) continue;
      const px2 = Math.round((hx - cx) * t), py2 = Math.round((hy - cy) * t);
      if (!own.has(i - MW)) { ctx.moveTo(px2, py2); ctx.lineTo(px2 + t, py2); }
      if (!own.has(i + MW)) { ctx.moveTo(px2, py2 + t); ctx.lineTo(px2 + t, py2 + t); }
      if (!own.has(i - 1))  { ctx.moveTo(px2, py2); ctx.lineTo(px2, py2 + t); }
      if (!own.has(i + 1))  { ctx.moveTo(px2 + t, py2); ctx.lineTo(px2 + t, py2 + t); }
    }
    ctx.stroke();

    ctx.restore();
  }
  ctx.globalAlpha = 1;

  /* Items bob so loot reads as loot even at the edge of the lamp,
     and anything better than plain throws a shaft of light you can
     see before you can read the name. */
  const bob = Math.sin(performance.now() / 380) * t * 0.06;
  for (const it of G.items) {
    const vis = L.vis[idx(it.x, it.y)];
    const grade = it.kind === 'chest' ? 2 : rarityOf(it);
    const seenBefore = L.seen[idx(it.x, it.y)];
    if (!vis && !(grade >= 2 && seenBefore)) continue;

    const ix = (it.x - cx) * t, iy = (it.y - cy) * t;
    if (grade >= 1) {
      const glow = RARITY[grade].glow;
      const pulse = 0.55 + Math.sin(performance.now() / 420 + it.x) * 0.25;
      ctx.save();
      // 초월 throws a pillar twice as tall and twice as wide as
      // anything else on the floor. You should see it from the
      // far side of the room and walk towards it.
      const tall = grade === 4 ? 6.4 : 3.2;
      const beam = ctx.createLinearGradient(0, iy - t * tall, 0, iy + t);
      beam.addColorStop(0, 'transparent');
      beam.addColorStop(1, glow);
      ctx.globalAlpha = pulse * (grade === 4 ? 0.72 : grade >= 3 ? 0.5 : 0.34);
      ctx.fillStyle = beam;
      ctx.fillRect(ix + t * (grade === 4 ? 0.14 : 0.28), iy - t * tall,
                   t * (grade === 4 ? 0.72 : 0.44), t * (tall + 1));
      ctx.globalAlpha = pulse * (grade === 4 ? 0.7 : 0.45);
      ctx.beginPath();
      ctx.ellipse(ix + t / 2, iy + t * 0.85, t * 0.55, t * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = vis ? 1 : 0.6;
    ctx.drawImage(sprite(it.spr), ix, iy + bob, t, t);
    /* 초월은 절차적으로 만들어지므로 제 그림을 미리 못 갖는다.
       대신 은총의 문장을 물건 위에 찍는다 — 여섯이 각자 다르고,
       바닥에서도 배낭에서도 같은 표시다. 「획득 시 확실하게 체감
       가능하게(외관)」의 마지막 조각. */
    if (it.boon) ctx.drawImage(sprite(`b_${it.boon}`), ix, iy + bob, t, t);
    ctx.globalAlpha = 1;
  }

  /* The idle beat: a square wave, not a sine. Everything alive
     drops exactly one sprite pixel on the off-beat, each at its
     own phase — the cheapest possible two-frame animation, and
     it reads as one because the step is quantized. */
  const bobT = (performance.now() / 480) | 0;
  const px1 = Math.max(1, Math.round(t / CELL_SIZE));   // one sprite pixel

  for (const m of G.monsters) {
    const seenNow = L.vis[idx(m.x, m.y)];
    if (!seenNow && !(G.detectPulse > 0)) continue;
    ctx.globalAlpha = seenNow ? 1 : 0.45;
    const o = Juice.offsetOf(m);
    let mx = (m.x + o.x - cx) * t, my = (m.y + o.y - cy) * t;

    /* The mimic's only tell. It sits where a chest sits and looks
       like a chest looks, but it breathes — a slow half-pixel
       rise a patient player can catch and a hurried one can't. */
    if (m.disguise) my += Math.sin(performance.now() / 900 + m.x) * t * 0.045;
    // Awake and undisguised: on the beat. Sleepers hold still.
    else if (m.awake) my += ((bobT + m.x + m.y) & 1) ? px1 : 0;

    /* A monster faces the way it last moved. Mirroring is free —
       the same baked sprite, drawn through a flipped transform. */
    if (m._lx != null && m.x !== m._lx) m._face = m.x > m._lx ? 1 : -1;
    m._lx = m.x;

    /* 정예 표식. 예전에는 칸 네 귀퉁이에 괄호를 그렸는데, 그것은
       그 **자리**에 표를 붙인 것이지 그것을 표시한 것이 아니다 —
       셋이 붙어 서 있으면 어느 괄호가 누구 것인지 모르고, 괄호가
       옆 칸의 벽·바닥과 겹쳐 읽혔다.

       이제 그것의 테두리 자체를 물들인다. 실루엣 바깥 한 줄이라
       몸을 한 픽셀도 안 가리고, 몇 마리가 붙어 있든 각자 자기
       윤곽을 갖는다. 속성 하나면 잉걸, 둘 이상이면 시든 난초.
       고리는 스프라이트를 그린 **뒤에** 덮는다 — 먼저 그리면
       스프라이트 자신의 검은 외곽선에 덮여 사라진다. */
    const eliteInk = m.elite?.length ? (m.elite.length > 1 ? 'P' : 'o') : null;

    /* 미믹은 안 어긋난다. 상자인 척하는 것이 떨리면 그건 이 게임에서
       가장 잘 만든 장치를 공짜로 알려 주는 셈이다. */
    const gl = m.disguise ? null : glitchNow(m, glitchOf(m));
    if (gl) {
      /* sprite()는 못 찾으면 돌무더기를 돌려준다 — 「|| sprite(m.spr)」로는
         못 막는다. 대군주가 한 프레임 동안 돌무더기가 될 뻔했다. */
      const img = gl.other && hasSprite(`wrong:${m.spr}`)
        ? sprite(`wrong:${m.spr}`) : sprite(m.spr);
      if (m._face === -1) {
        ctx.save();
        ctx.translate(mx + t / 2, 0); ctx.scale(-1, 1); ctx.translate(-(mx + t / 2), 0);
        blitGlitch(img, mx, my, t, gl, px1);
        ctx.restore();
      } else blitGlitch(img, mx, my, t, gl, px1);
    } else blitActor(sprite(m.spr), mx, my, t, o, m._face === -1);

    if (eliteInk && seenNow && hasSprite(`rim:${eliteInk}:${m.spr}`)) {
      const prevA = ctx.globalAlpha;
      /* 숨 쉰다. 가만히 있으면 그림의 일부로 읽히고, 그러면 「이 종은
         원래 테두리가 주황이구나」가 된다. */
      /* 진폭을 ±0.24에서 ±0.14로 줄였다. 0.48까지 내려가는 골짜기에서
         시든 난초(#9a6ab0, 명도 0.69)는 어두운 바닥에 섞여 명도 0.41이
         된다 — 「속성 둘」 표식이 주기의 일부 동안 화면에서 사라진다는
         뜻이다. 벤치가 그것을 먼저 잡았다: 같은 화면을 재는데 어떤
         판은 246점, 어떤 판은 0점이 나왔고, 표본 간격이 380ms 주기와
         맞물려 골짜기에만 내려앉으면 열 번 내리 0이었다. 재는 쪽의
         버그처럼 보였지만 원인은 그림 쪽이었다 — 사람도 같은 순간에
         같은 것을 못 본다. 0.68~0.96이면 숨은 그대로 쉬고 골짜기에서도
         읽힌다. */
      /* 다시 좁혔다. 0.68~0.96에서도 밝은 회색 바닥 위에서는 시든
         난초의 **채도가 0.07까지 내려간다** — 색상은 살아 있는데
         색으로는 안 읽힌다는 뜻이고, 「속성 둘」이라는 정보가 바닥
         색깔에 따라 사라진다. 숨은 밝기로 쉬게 하고(0.9~1.0) 색은
         건드리지 않는다. 알파 블렌딩은 채도를 먼저 죽인다. */
      ctx.globalAlpha = prevA * (0.95 + Math.sin(performance.now() / 380) * 0.05);
      ctx.drawImage(sprite(`rim:${eliteInk}:${m.spr}`), Math.round(mx), Math.round(my), t, t);
      ctx.globalAlpha = prevA;
    }

    if (m.disguise) continue;     // no sleep marker, no health bar — it is furniture

    /* ── 열쇠를 문 것 ────────────────────────────────────
       과업은 「저것을 잡아야 한다」인데 「저것」을 지목할 방법이
       화면에 하나도 없었다 — `hasKey`가 저장소 전체에서 규칙 두
       곳에만 있고 UI·미니맵·스프라이트에 0곳이었다. 360판을 세어
       보니 주인까지 평균 21칸이고, 스프라이트도 이름도 옆의 같은
       종과 구별되지 않는다. 지목할 수 없으면 결정이 아니라
       전수조사다. 그러니 그것의 머리 위에 열쇠를 얹는다. */
    if (seenNow && m.hasKey && G.task && !G.taskDone) {
      const kx = mx + t * 0.14, ky = my - t * 0.04;
      ctx.font = `900 ${Math.floor(t * 0.58)}px Galmuri11, ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, t * 0.18);
      ctx.strokeStyle = PALETTE.k;
      ctx.strokeText('⚷', kx, ky);
      ctx.fillStyle = PALETTE.y;
      ctx.fillText('⚷', kx, ky);
    }

    /* A sleeping target is a free critical, so say so plainly —
       an opportunity the player can't see isn't a decision. */
    if (seenNow && !m.awake) {
      const zx = mx + t * 0.86;
      const zy = my - t * 0.06 + Math.sin(performance.now() / 500) * t * 0.09;
      ctx.font = `900 ${Math.floor(t * 0.62)}px Galmuri11, ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, t * 0.16);
      ctx.strokeStyle = PALETTE.k;
      ctx.strokeText('z', zx, zy);
      ctx.fillStyle = PALETTE.B;
      ctx.fillText('z', zx, zy);
    }

    /* ── 어둠은 예고를 가린다 ────────────────────────────
       기름 소모를 4배로 올리고 4분의 1로 낮춰 봤더니 도달 층이
       6.42 / 5.98 / 6.08 — 오차 안에서 같았다. 기름이 덜 무는 게
       아니라 **결과와 연결이 끊겨** 있었다. 불이 꺼져도 반경 2 안은
       그대로 보이고, 싸움은 대개 붙어서 하므로 어둠이 전투에 아무
       값도 매기지 않았던 것이다.

       예고(붉은 별)는 이 게임에서 가장 값진 정보다 — 그 한 칸을
       읽으면 물러설 수 있고 못 읽으면 2.5배를 맞는다. 그리고 그것은
       **보는 것**이다. 불이 꺼진 채로 싸우면 다음 턴에 무엇이
       오는지 모른다. 매 턴 드는 값이고, 그래서 기름이 처음으로
       전투와 이어진다.

       방이 밝으면(제 불이 아니어도) 보인다 — 어둠의 값이지
       근시의 값이 아니다. */
    const litHere = p.lightTurns > 0
      || (L.roomOf[idx(m.x, m.y)] >= 0 && L.rooms[L.roomOf[idx(m.x, m.y)]]?.lit);
    if (seenNow && m.awake && m.intent && litHere) drawIntent(m.intent, mx, my, t);

    if (seenNow && m.hp < m.maxhp) {
      const w = Math.round(t * (m.hp / m.maxhp));
      ctx.fillStyle = PALETTE.r;
      ctx.fillRect(mx, my + t - 2, t, 2);
      ctx.fillStyle = PALETTE.R;
      ctx.fillRect(mx, my + t - 2, w, 2);
    }
  }
  ctx.globalAlpha = 1;

  // the lamp glow, then the hero on top
  const po = Juice.offsetOf(p);
  const hx = (p.x + po.x - cx) * t + t / 2, hy = (p.y + po.y - cy) * t + t / 2;
  const glow = ctx.createRadialGradient(hx, hy, t * 0.4, hx, hy, t * lightR);
  glow.addColorStop(0, 'rgba(248,124,32,0.16)');
  glow.addColorStop(1, 'rgba(248,124,32,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, viewW, viewH);
  // The hero keeps the beat too, and faces the way he last walked.
  if (heroLastX !== null && p.x !== heroLastX) heroFacing = p.x > heroLastX ? 1 : -1;
  heroLastX = p.x;
  const hbob = (bobT & 1) ? px1 : 0;
  blitActor(heroSprite(p), hx - t / 2, hy - t / 2 + hbob, t, po, heroFacing === -1);

  /* The countdown goes on last. It used to be drawn with the
     tint, which put it underneath the hero sprite — and a disc
     centred on you puts its middle tile exactly where you are
     standing, so the number was invisible in the one case that
     mattered most. */
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const h of G.hazards) {
    const seen = h.tiles.filter(i => L.seen[i]);
    if (!seen.length) continue;
    const mid = seen[Math.floor(seen.length / 2)];
    const mx2 = (mid % MW - cx) * t + t / 2, my2 = ((mid / MW | 0) - cy) * t + t / 2;
    const urgent = h.left <= 1;
    const pop = urgent ? 1 + Math.abs(Math.sin(performance.now() / 130)) * 0.22 : 1;
    ctx.globalAlpha = 1;
    ctx.font = `900 ${Math.floor(t * 0.78 * pop)}px Galmuri11, ui-monospace, monospace`;
    ctx.lineWidth = Math.max(3, t * 0.24);
    ctx.strokeStyle = PALETTE.k;
    ctx.strokeText(String(h.left), mx2, my2);
    ctx.fillStyle = urgent ? PALETTE.W : (PALETTE[h.tone] || PALETTE.o);
    ctx.fillText(String(h.left), mx2, my2);
  }

  /* What a step costs, before it is taken. Eight small marks, one
     per neighbouring tile, each saying how many awake things could
     reach you there. Drawn under the effects so a telegraph always
     wins the pixel. */
  if (G.running && G.depth > 0 && showThreat) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [dx, dy] of DIRS8) {
      const tx = p.x + dx, ty = p.y + dy;
      if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
      if (!L.seen[idx(tx, ty)] || L.solid(tx, ty)) continue;
      const n = Game.threatAt(tx, ty);
      if (!n) continue;
      const px = (tx - cx) * t, py = (ty - cy) * t;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = n >= 3 ? PALETTE.r : n === 2 ? PALETTE.n : PALETTE.g;
      ctx.fillRect(px + t * 0.06, py + t * 0.06, t * 0.88, t * 0.88);
      ctx.globalAlpha = 1;
      ctx.font = `700 ${Math.floor(t * 0.4)}px Galmuri11, ui-monospace, monospace`;
      ctx.fillStyle = n >= 3 ? PALETTE.R : PALETTE.G;
      ctx.fillText(String(n), px + t * 0.82, py + t * 0.2);
    }
    ctx.globalAlpha = 1;
  }

  Juice.drawEffects(ctx, cx, cy, t);
  /* 0 above a quarter health, rising to 1 at death's door. One
     number so the pulse and its speed can never disagree. */
  const low = p.maxhp ? Math.max(0, 1 - p.hp / (p.maxhp * 0.25)) : 0;
  Juice.drawScreenFlash(ctx, viewW, viewH, G.running ? low : 0);
  /* 죽음의 렌즈가 `dim` 을 계산해 놓고 **아무도 안 읽고 있었다.**
     그래서 죽는 순간 화면이 어두워지는 게 아니라 오히려 밝아졌다 —
     타일이 2.15배로 커지면 광원 감쇠가 타일 좌표 기준이라 같은 밝기가
     더 넓은 면적을 덮는다. 다크소울·디아블로의 죽음은 색이 빠지고
     어두워지는 순간인데 여기서는 조명이 켜졌다. */
  const dying = Juice.deathLens();
  if (dying?.dim) {
    ctx.save();
    ctx.fillStyle = `rgba(14,11,16,${dying.dim.toFixed(3)})`;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.restore();
  }
  drawMini();
}

/* ── the minimap ──────────────────────────────────────────
   The map view only ever shows a lamp's worth of floor, so a
   player who has walked half a level has no way to see the half
   they walked. This is that: everything remembered, a few pixels
   a tile, over the corner of the map.

   Three sizes on tap rather than a toggle, because on a phone
   the useful size depends on whether you are exploring or in a
   fight, and a hidden setting for it would be worse than a tap. */
const MINI_SIZES = [2, 3, 0];      // px per tile; 0 = hidden
let miniStep = 0;

const MINI_TILE = {
  [DOWN]:  'o', [UP]: 'B',
  [CAMP]:  'o', [ALTAR]: 'P', [EVENT]: 'B', [ANVIL]: 's', [PROP]: 'N',
  [DOOR]:  'N', [DOOR_OPEN]: 'N', [DOOR_LOCKED]: 'y', [DOOR_BROKEN]: 'N',
  [WATER]: 'b', [WEB]: 's', [RUBBLE]: 'g',
};

export /* ── 뒤틀린 채로 그린다 ────────────────────────────────────
   DESIGN.md §3. juice 가 「얼마나 잘못됐나」만 알려 주고, 무엇을 어떻게
   그릴지는 여기서 정한다 — deathLens 와 같은 계약이다.

   지형에만 붙인다. 몬스터와 영웅까지 뒤틀면 **무엇이 나를 죽이는지**가
   안 보이고, 그건 기괴한 게 아니라 불공평한 것이다. 벽이 거짓말하는
   것과 적이 안 보이는 것은 다른 물건이다. */
function warped(ctx, img, px, py, t, x, y) {
  const w = Juice.warpLens();
  if (!w) { ctx.drawImage(img, px, py, t, t); return; }
  const a0 = ctx.globalAlpha;
  /* 찢김 — 가로 줄 하나가 밀린다. 줄 번호로 정하므로 매 프레임
     같은 줄이 밀린다: 무작위로 흔들면 그건 글리치가 아니라 지진이다. */
  const dx = w.tear && ((y * 7 + 3) % 5 === 0) ? w.tear : 0;
  /* 색 분리 — 같은 그림을 붉은 쪽과 푸른 쪽으로 어긋나게 두 번 더.
     팔레트 밖으로 안 나간다: 원본을 그대로 겹치고 합성만 바꾼다. */
  if (w.split) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = a0 * 0.34;
    ctx.drawImage(img, px + dx - w.split, py, t, t);
    ctx.drawImage(img, px + dx + w.split, py, t, t);
    ctx.restore();
  }
  ctx.globalAlpha = a0;
  ctx.drawImage(img, px + dx, py, t, t);
  /* 잔상 — 한 겹이 어둠으로 남는다. 이전 프레임을 들고 있지 않으므로
     제자리에 옅게 겹쳐 「한 프레임 늦게 따라오는」 인상만 만든다. */
  if (w.ghost) {
    ctx.save();
    ctx.globalAlpha = a0 * w.ghost;
    ctx.drawImage(img, px + dx, py + 1, t, t);
    ctx.restore();
  }
  ctx.globalAlpha = a0;
}

function drawMini() {
  const px = MINI_SIZES[miniStep];
  mini.classList.toggle('off', !px);
  if (!px || !G.level || !G.player) return;

  const L = G.level, p = G.player;
  if (mini.width !== MW * px) { mini.width = MW * px; mini.height = MH * px; }
  mini.style.width = `${MW * px}px`;
  mini.style.height = `${MH * px}px`;

  mctx.clearRect(0, 0, mini.width, mini.height);
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++) {
      const i = idx(x, y);
      if (!L.seen[i]) continue;
      const t = L.tiles[i];
      if (t === ROCK) continue;
      let tone = MINI_TILE[t] || (t === SHOP ? 'y' : null);
      /* 미니맵은 가구여야지 주인공이면 안 된다. 밝은 돌색(G)을 쓰던
         동안 이 구석이 화면에서 가장 밝은 것이었고, 시선이 전투가
         아니라 여기로 갔다. 바닥 두 톤을 한참 낮춘다 — 몬스터·유물·
         나를 가리키는 색만 밝게 남는다. */
      if (!tone) tone = L.vis[i] ? 'A' : 'd';
      mctx.fillStyle = PALETTE[tone];
      mctx.fillRect(x * px, y * px, px, px);
    }

  // marked ground, so a pattern is visible even off-screen
  for (const h of G.hazards)
    for (const i of h.tiles) {
      if (!L.seen[i]) continue;
      mctx.fillStyle = PALETTE[h.tone] || PALETTE.o;
      mctx.fillRect((i % MW) * px, ((i / MW) | 0) * px, px, px);
    }

  // anything you can see right now
  for (const m of G.monsters) {
    if (!L.vis[idx(m.x, m.y)] && !(G.detectPulse > 0)) continue;
    if (m.disguise) continue;
    mctx.fillStyle = m.boss || m.named ? PALETTE.R : m.elite?.length ? PALETTE.o : PALETTE.r;
    mctx.fillRect(m.x * px, m.y * px, px, px);
  }
  for (const it of G.items) {
    if (!L.seen[idx(it.x, it.y)]) continue;
    if (it.kind === 'relic') mctx.fillStyle = PALETTE.P;
    else if (it.kind === 'chest') mctx.fillStyle = PALETTE.y;
    else continue;
    mctx.fillRect(it.x * px, it.y * px, px, px);
  }

  // you, blinking, so the eye finds you first
  mctx.fillStyle = (performance.now() % 900) < 560 ? PALETTE.W : PALETTE.y;
  mctx.fillRect(p.x * px - 1, p.y * px - 1, px + 2, px + 2);
}

export function cycleMini() {
  miniStep = (miniStep + 1) % MINI_SIZES.length;
  drawMini();
}

/* ── intent ───────────────────────────────────────────────
   One glyph over the head, saying what this thing does on its
   next turn. It is the difference between a fight you trade
   through and a fight you solve: the wind-up marker in
   particular is an invitation to step back, shut a door, or
   drink — and to decide the hit is worth eating anyway.

   Drawn as paths, not as text. The obvious glyphs for this —
   ✸ ➤ ☣ — are missing from the monospace stacks on plenty of
   phones and render as tofu boxes, which is worse than no
   telegraph at all. Eight shapes, hand-drawn, always present. */
const SHAPES = {
  // winding up: a four-pointed star, and it pulses
  heavy:   [star4,                                    'R'],
  wind:    [(c, x, y, r) => star4(c, x, y, r * 0.8),  'o'],
  // about to swing: a solid diamond
  melee:   [(c, x, y, r) => diamond(c, x, y, r * 0.8),'W'],
  // about to poison or blind you: three dots
  hex:     [dots3,                                    'P'],
  // about to shoot: an arrowhead with a shaft
  shoot:   [arrow,                                    'y'],
  // closing / running: chevrons down and up
  close:   [(c, x, y, r) => chevrons(c, x, y, r, 1),  'G'],
  flee:    [(c, x, y, r) => chevrons(c, x, y, r, -1), 'B'],
  erratic: [(c, x, y, r) => ring(c, x, y, r * 0.7),   'p'],
  // about to mark the ground: a hollow diamond, distinct from
  // the solid one that means a plain swing
  cast:    [(c, x, y, r) => hollowDiamond(c, x, y, r), 'P'],
  watch:   [(c, x, y, r) => dot(c, x, y, r * 0.30),   'G'],
  held:    [(c, x, y, r) => cross(c, x, y, r * 0.7),  'G'],
};

function star4(c, x, y, r) {
  const i = r * 0.3;
  c.moveTo(x, y - r);
  c.lineTo(x + i, y - i); c.lineTo(x + r, y);
  c.lineTo(x + i, y + i); c.lineTo(x, y + r);
  c.lineTo(x - i, y + i); c.lineTo(x - r, y);
  c.lineTo(x - i, y - i); c.closePath();
}
function diamond(c, x, y, r) {
  c.moveTo(x, y - r); c.lineTo(x + r * 0.72, y);
  c.lineTo(x, y + r); c.lineTo(x - r * 0.72, y); c.closePath();
}
/* 비전 폭주. 별 넷(축복·되감기)이 이미 쓰이고 있으므로 **여덟 갈**로
   가른다 — 8×8에서 넷과 여덟은 「가시가 몇 개냐」로 즉시 갈리고, 그
   차이가 「받는 주문」과 「터지는 주문」의 차이다. 안쪽 반지름을
   star4(0.3)보다 더 죄어(0.22) 가시가 더 날카롭게 읽히게 한다. */
function starburst(c, x, y, r) {
  const n = 8, inner = r * 0.22;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? inner : r;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.closePath();
}
function arrow(c, x, y, r) {
  c.moveTo(x + r, y);
  c.lineTo(x - r * 0.18, y - r * 0.78);
  c.lineTo(x - r * 0.02, y - r * 0.26);
  c.lineTo(x - r, y - r * 0.26);
  c.lineTo(x - r, y + r * 0.26);
  c.lineTo(x - r * 0.02, y + r * 0.26);
  c.lineTo(x - r * 0.18, y + r * 0.78);
  c.closePath();
}
function chevrons(c, x, y, r, dir) {
  for (const off of [-r * 0.5, r * 0.28]) {
    c.moveTo(x - r * 0.78, y + off - dir * r * 0.28);
    c.lineTo(x,            y + off + dir * r * 0.34);
    c.lineTo(x + r * 0.78, y + off - dir * r * 0.28);
    c.lineTo(x + r * 0.78, y + off + dir * r * 0.06);
    c.lineTo(x,            y + off + dir * r * 0.68);
    c.lineTo(x - r * 0.78, y + off + dir * r * 0.06);
    c.closePath();
  }
}
function dots3(c, x, y, r) {
  for (const [ox, oy] of [[0, -r * 0.6], [-r * 0.6, r * 0.42], [r * 0.6, r * 0.42]]) {
    c.moveTo(x + ox + r * 0.32, y + oy);
    c.arc(x + ox, y + oy, r * 0.32, 0, Math.PI * 2);
  }
}
function ring(c, x, y, r) {
  c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2);
  c.moveTo(x + r * 0.44, y); c.arc(x, y, r * 0.44, 0, Math.PI * 2, true);
}
function dot(c, x, y, r) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
function hollowDiamond(c, x, y, r) {
  diamond(c, x, y, r);
  c.moveTo(x, y + r * 0.42);
  c.lineTo(x - r * 0.3, y); c.lineTo(x, y - r * 0.42); c.lineTo(x + r * 0.3, y);
  c.closePath();
}
function cross(c, x, y, r) {
  const w = r * 0.34;
  for (const s of [1, -1]) {
    c.moveTo(x - r * s, y - r + w); c.lineTo(x - r * s + w * s * 1.5, y - r);
    c.lineTo(x + r * s, y + r - w); c.lineTo(x + r * s - w * s * 1.5, y + r);
    c.closePath();
  }
}

/* ── spell glyphs ───────────────────────────────────────────
   Same reasoning as the intent marks: drawn, not typed. These
   sit on the play screen at 15px, so they are read as silhouettes
   — one is a plus, one is a flake, one is an eye — and the short
   name under each carries the rest. */
function plus(c, x, y, r) {
  const w = r * 0.34;
  c.moveTo(x - w, y - r); c.lineTo(x + w, y - r); c.lineTo(x + w, y - w);
  c.lineTo(x + r, y - w); c.lineTo(x + r, y + w); c.lineTo(x + w, y + w);
  c.lineTo(x + w, y + r); c.lineTo(x - w, y + r); c.lineTo(x - w, y + w);
  c.lineTo(x - r, y + w); c.lineTo(x - r, y - w); c.lineTo(x - w, y - w);
  c.closePath();
}
function flake(c, x, y, r) {
  const w = r * 0.15;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3, dx = Math.cos(a), dy = Math.sin(a);
    c.moveTo(x - dx * r - dy * w, y - dy * r + dx * w);
    c.lineTo(x + dx * r - dy * w, y + dy * r + dx * w);
    c.lineTo(x + dx * r + dy * w, y + dy * r - dx * w);
    c.lineTo(x - dx * r + dy * w, y - dy * r - dx * w);
    c.closePath();
  }
}
function zigzag(c, x, y, r) {
  c.moveTo(x + r * 0.55, y - r);
  c.lineTo(x - r * 0.6,  y + r * 0.14);
  c.lineTo(x - r * 0.05, y + r * 0.14);
  c.lineTo(x - r * 0.5,  y + r);
  c.lineTo(x + r * 0.62, y - r * 0.2);
  c.lineTo(x + r * 0.06, y - r * 0.2);
  c.closePath();
}
function grid(c, x, y, r) {
  const w = r * 0.2;
  c.moveTo(x - r, y - r); c.lineTo(x + r, y - r);
  c.lineTo(x + r, y + r); c.lineTo(x - r, y + r); c.closePath();
  // wound the other way so the middle punches out
  c.moveTo(x - r + w, y - r + w); c.lineTo(x - r + w, y + r - w);
  c.lineTo(x + r - w, y + r - w); c.lineTo(x + r - w, y - r + w); c.closePath();
  c.moveTo(x - w * 0.5, y - r + w); c.lineTo(x + w * 0.5, y - r + w);
  c.lineTo(x + w * 0.5, y + r - w); c.lineTo(x - w * 0.5, y + r - w); c.closePath();
  c.moveTo(x - r + w, y - w * 0.5); c.lineTo(x + r - w, y - w * 0.5);
  c.lineTo(x + r - w, y + w * 0.5); c.lineTo(x - r + w, y + w * 0.5); c.closePath();
}
function beamDown(c, x, y, r) {
  c.moveTo(x - r * 0.2, y - r); c.lineTo(x + r * 0.2, y - r);
  c.lineTo(x + r * 0.66, y + r); c.lineTo(x - r * 0.66, y + r); c.closePath();
}
function eye(c, x, y, r) {
  c.moveTo(x + r, y);
  c.bezierCurveTo(x + r * 0.34, y - r * 0.86, x - r * 0.34, y - r * 0.86, x - r, y);
  c.bezierCurveTo(x - r * 0.34, y + r * 0.86, x + r * 0.34, y + r * 0.86, x + r, y);
  c.closePath();
  // The pupil has to survive a 15px render — any smaller and the
  // dark outline stroke closes the hole and it reads as a blob.
  c.moveTo(x + r * 0.5, y); c.arc(x, y, r * 0.5, 0, Math.PI * 2, false);
}

/* ── the arts, drawn ──────────────────────────────────────
   Same 8px budget as a spell glyph, and they have to be tellable
   apart at a thumb's distance. Each is its verb as a shape: a
   flat palm pushing, a ring of teeth, a shield planted in the
   ground, a wedge coming down. */
function palm(c, x, y, r) {                 // 밀쳐내기
  c.moveTo(x - r * 0.9, y - r * 0.62);
  c.lineTo(x + r * 0.1, y - r * 0.62);
  c.lineTo(x + r * 0.1, y - r);
  c.lineTo(x + r,       y);
  c.lineTo(x + r * 0.1, y + r);
  c.lineTo(x + r * 0.1, y + r * 0.62);
  c.lineTo(x - r * 0.9, y + r * 0.62);
  c.closePath();
}
function sweep(c, x, y, r) {                // 휩쓸기
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, w = 0.34;
    c.moveTo(x + Math.cos(a - w) * r * 0.44, y + Math.sin(a - w) * r * 0.44);
    c.lineTo(x + Math.cos(a) * r,            y + Math.sin(a) * r);
    c.lineTo(x + Math.cos(a + w) * r * 0.44, y + Math.sin(a + w) * r * 0.44);
    c.closePath();
  }
}
function planted(c, x, y, r) {              // 버티기
  c.moveTo(x - r * 0.78, y - r);
  c.lineTo(x + r * 0.78, y - r);
  c.lineTo(x + r * 0.78, y + r * 0.1);
  c.lineTo(x,            y + r * 0.72);
  c.lineTo(x - r * 0.78, y + r * 0.1);
  c.closePath();
  c.moveTo(x - r, y + r * 0.82);            // the ground it is planted on
  c.lineTo(x + r, y + r * 0.82);
  c.lineTo(x + r, y + r);
  c.lineTo(x - r, y + r);
  c.closePath();
}
function wedge(c, x, y, r) {                // 마무리
  c.moveTo(x - r * 0.52, y - r);
  c.lineTo(x + r * 0.52, y - r);
  c.lineTo(x + r * 0.18, y + r * 0.18);
  c.lineTo(x,            y + r);
  c.lineTo(x - r * 0.18, y + r * 0.18);
  c.closePath();
}

/* The ranger's four. Every one is about the gap, so none of them
   is a hand: a ring you look through, a line that does not stop,
   a set of jaws on the floor, and several falling at once. */
function crosshair(c, x, y, r) {
  c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2, false);
  c.moveTo(x + r * 0.5, y); c.arc(x, y, r * 0.5, 0, Math.PI * 2, true);
  const w = r * 0.14;
  c.moveTo(x - r * 1.25, y - w); c.lineTo(x + r * 1.25, y - w);
  c.lineTo(x + r * 1.25, y + w); c.lineTo(x - r * 1.25, y + w); c.closePath();
  c.moveTo(x - w, y - r * 1.25); c.lineTo(x + w, y - r * 1.25);
  c.lineTo(x + w, y + r * 1.25); c.lineTo(x - w, y + r * 1.25); c.closePath();
}
function throughLine(c, x, y, r) {
  const w = r * 0.2;
  c.moveTo(x - r * 1.2, y - w); c.lineTo(x + r * 0.4, y - w);
  c.lineTo(x + r * 0.4, y - r * 0.6); c.lineTo(x + r * 1.2, y);
  c.lineTo(x + r * 0.4, y + r * 0.6); c.lineTo(x + r * 0.4, y + w);
  c.lineTo(x - r * 1.2, y + w); c.closePath();
}
function jaws(c, x, y, r) {
  for (const s of [-1, 1]) {
    c.moveTo(x - r, y + s * r * 0.15);
    for (let i = 0; i <= 4; i++) {
      const px = x - r + (i / 4) * r * 2;
      c.lineTo(px, y + s * (i % 2 ? r * 0.9 : r * 0.15));
    }
    c.lineTo(x + r, y + s * r * 0.15);
    c.closePath();
  }
}
function rain(c, x, y, r) {
  for (const off of [-r * 0.7, 0, r * 0.7]) {
    const w = r * 0.13;
    c.moveTo(x + off - w, y - r); c.lineTo(x + off + w, y - r);
    c.lineTo(x + off + w, y + r * 0.45); c.lineTo(x + off, y + r);
    c.lineTo(x + off - w, y + r * 0.45); c.closePath();
  }
}

/* 사제의 넷. 셋은 원이 아니라 표시다 — 땅에 그은 것, 이름 위에
   그은 것, 방 전체에 그은 것. 마법사의 도형과 닮으면 안 된다. */
function slab(c, x, y, r) {                 // 성역
  c.moveTo(x - r, y + r * 0.2); c.lineTo(x, y - r * 0.55);
  c.lineTo(x + r, y + r * 0.2); c.lineTo(x, y + r * 0.95); c.closePath();
  c.moveTo(x - r * 0.42, y + r * 0.2); c.lineTo(x, y - r * 0.12);
  c.lineTo(x + r * 0.42, y + r * 0.2); c.lineTo(x, y + r * 0.52); c.closePath();
}
function strikeOut(c, x, y, r) {            // 파문
  c.moveTo(x + r * 0.72, y - r); c.arc(x, y, r, -Math.PI / 4, Math.PI * 7 / 4, false);
  const w = r * 0.19;
  c.moveTo(x - r * 1.1 - w, y - w); c.lineTo(x + r * 1.1, y - r * 1.1 - w);
  c.lineTo(x + r * 1.1 + w, y - r * 1.1 + w); c.lineTo(x - r * 1.1 + w, y + w); c.closePath();
}
function rays(c, x, y, r) {                 // 심판
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, w = 0.12;
    c.moveTo(x + Math.cos(a - w) * r * 0.3, y + Math.sin(a - w) * r * 0.3);
    c.lineTo(x + Math.cos(a) * r * 1.15,    y + Math.sin(a) * r * 1.15);
    c.lineTo(x + Math.cos(a + w) * r * 0.3, y + Math.sin(a + w) * r * 0.3);
    c.closePath();
  }
  c.moveTo(x + r * 0.34, y); c.arc(x, y, r * 0.34, 0, Math.PI * 2, false);
}
function kneel(c, x, y, r) {                // 순교
  c.moveTo(x - r * 0.16, y - r); c.lineTo(x + r * 0.16, y - r);
  c.lineTo(x + r * 0.16, y + r * 0.28); c.lineTo(x + r, y + r * 0.28);
  c.lineTo(x + r, y + r * 0.6); c.lineTo(x - r, y + r * 0.6);
  c.lineTo(x - r, y + r * 0.28); c.lineTo(x - r * 0.16, y + r * 0.28); c.closePath();
}

/* ── 팔라딘의 넷 ─────────────────────────────────────────
   An arrow with a body behind it (돌진), a hammer coming down
   (심판의 일격), a ring of blades (성스러운 폭풍), and a line of
   marks continuing off the edge (성전). */
function dash(c, x, y, r) {                 // 돌진
  c.moveTo(x - r, y); c.lineTo(x + r * 0.4, y);
  c.moveTo(x + r * 0.4, y - r * 0.5); c.lineTo(x + r, y); c.lineTo(x + r * 0.4, y + r * 0.5);
  c.moveTo(x - r * 0.9, y - r * 0.45); c.lineTo(x - r * 0.2, y - r * 0.45);
  c.moveTo(x - r * 0.9, y + r * 0.45); c.lineTo(x - r * 0.2, y + r * 0.45);
}
function maul(c, x, y, r) {                 // 심판의 일격
  c.moveTo(x, y + r); c.lineTo(x, y - r * 0.2);
  c.moveTo(x - r * 0.75, y - r * 0.2); c.lineTo(x + r * 0.75, y - r * 0.2);
  c.lineTo(x + r * 0.75, y - r * 0.85); c.lineTo(x - r * 0.75, y - r * 0.85); c.closePath();
}
function bladering(c, x, y, r) {            // 성스러운 폭풍
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    c.moveTo(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42);
    c.lineTo(x + Math.cos(a + 0.5) * r, y + Math.sin(a + 0.5) * r);
  }
}
/* 숨 끊기. 급소가 이미 wedge 이고 되감기가 star4 이므로, 이 셋이
   한 줄에 나란히 서면 모양이 갈려야 한다 — 목을 지나는 가로 한 줄과
   그 위아래의 짧은 두 점. 8×8에서 「끊겼다」로 읽히는 가장 싼 그림이다. */
function slit(c, x, y, r) {
  const w = r * 0.16;
  c.moveTo(x - r, y - w); c.lineTo(x + r, y - w);
  c.lineTo(x + r, y + w); c.lineTo(x - r, y + w); c.closePath();
  c.moveTo(x - r * 0.34, y - r * 0.72); c.arc(x - r * 0.34, y - r * 0.72, w * 1.2, 0, Math.PI * 2);
  c.moveTo(x + r * 0.34, y + r * 0.72); c.arc(x + r * 0.34, y + r * 0.72, w * 1.2, 0, Math.PI * 2);
}
function march(c, x, y, r) {                // 성전
  for (let i = 0; i < 3; i++) {
    const px = x - r + i * r * 0.85;
    c.moveTo(px, y + r * 0.6); c.lineTo(px + r * 0.42, y - r * 0.6);
  }
  c.moveTo(x + r * 0.72, y); c.lineTo(x + r, y);
}

const SPELL_ICONS = {
  charge:   [dash,                                    'y'],
  judgest:  [maul,                                    'W'],
  storm:    [bladering,                               'y'],
  crusade:  [march,                                   'W'],
  /* 사제의 셋이 바뀌었다. 셋 다 「받은 것을 돌려준다」의 다른 얼굴이라
     모양도 그 방향을 쓴다 — 되갚기는 돌려주는 손(palm), 말씀은
     퍼지는 소리(rays), 성흔은 지워지지 않는 표(strikeOut). */
  repay:    [palm,                                    'y'],
  word:     [rays,                                    'W'],
  stigma:   [strikeOut,                               'R'],
  martyr:   [kneel,                                   'R'],
  aimed:    [(c, x, y, r) => crosshair(c, x, y, r),   'E'],
  pierce:   [(c, x, y, r) => throughLine(c, x, y, r), 'B'],
  snare:    [(c, x, y, r) => jaws(c, x, y, r),        'n'],
  volley:   [(c, x, y, r) => rain(c, x, y, r),        'y'],
  shove:    [palm,                                    'W'],
  cleave:   [sweep,                                   'o'],
  /* 연타 and the rogue's four reuse shapes already defined here —
     drawSpellInto returns silently on an id it does not know, so a
     missing line is a blank button and no error. */
  flurry:     [(c, x, y, r) => rain(c, x, y, r),    'R'],
  shadowstep: [zigzag,                              'P'],
  hush:       [slit,                                'p'],
  vanish:     [(c, x, y, r) => star4(c, x, y, r),   'g'],
  vitals:     [wedge,                               'P'],
  finisher: [wedge,                                   'R'],
  bolt:   [arrow,                                     'P'],
  blink:  [zigzag,                                    'B'],
  detect: [eye,                                       'y'],
  frost:  [flake,                                     'B'],
  map:    [(c, x, y, r) => grid(c, x, y, r * 0.86),   'G'],
  surge:  [starburst,                                 'p'],
  cure:   [(c, x, y, r) => plus(c, x, y, r * 0.82),   'W'],
  heal:   [plus,                                      'W'],
  bless:  [(c, x, y, r) => star4(c, x, y, r * 0.95),  'y'],
  smite:  [beamDown,                                  'y'],
};

export function drawSpellInto(c, id, cx, cy, size) {
  const spec = SPELL_ICONS[id];
  if (!spec) return;
  const [shape, tone] = spec;
  c.save();
  c.beginPath();
  shape(c, cx, cy, size * 0.34);
  c.lineJoin = 'round';
  c.lineWidth = Math.max(2, size * 0.1);
  c.strokeStyle = PALETTE.k;
  c.stroke();
  c.fillStyle = PALETTE[tone] || PALETTE.w;
  c.fill();
  c.restore();
}

/* Shared by the map and by the key on the help screen, so the
   two can never drift apart. */
export function drawIntentInto(c, kind, gx, gy, t, beat = 1) {
  const spec = SHAPES[kind];
  if (!spec) return;
  const [shape, tone] = spec;
  const r = t * 0.24 * beat;
  c.save();
  c.beginPath();
  shape(c, gx, gy, r);
  // A dark stroke under the fill keeps the mark readable on a
  // lit floor and against a wall alike.
  c.lineJoin = 'round';
  c.lineWidth = Math.max(2, t * 0.13);
  c.strokeStyle = PALETTE.k;
  c.stroke();
  c.fillStyle = PALETTE[tone] || PALETTE.w;
  c.fill();
  c.restore();
}

function drawIntent(kind, mx, my, t) {
  const beat = kind === 'heavy' ? 1 + Math.sin(performance.now() / 140) * 0.18 : 1;
  drawIntentInto(ctx, kind, mx + t / 2, my - t * 0.24, t, beat);
}

/* Race under, class over. Falls back to the class-only bake if
   a race is somehow missing, so a bad save can never blank the
   thing the player is looking at. */
export const heroSprite = p =>
  sprite(`hero:${p.race}:${p.cls}`) || sprite(`hero:${p.cls}`);

/* One sprite, plus a squash-punch on impact and an additive
   pass that whitens it for a few frames when it takes a hit.
   `flip` mirrors around the sprite's own centre line — the same
   baked canvas serves both directions. */
/* ── 글리치 ───────────────────────────────────────────────
   「실제 그래픽도 반영될 정도로 글리치하게.」

   그런데 화면 전체에 노이즈를 씌우면 그건 필터지 공포가 아니다.
   무서운 것은 **그것만** 잘못 보이는 것이다. 그래서 어긋나는 것은
   몬스터 한 마리씩이고, 얼마나 어긋나는지는 장식이 아니라 판의
   상태에서 나온다:

     · 깊이 — 아래로 갈수록 보이는 것을 믿을 수 없다
     · 불   — 기름이 줄면 심해진다. 이 게임의 모든 것이 그렇듯이
     · 상처 — 몸이 상할수록 심해진다
     · 그것 자체 — 이름 있는 것, 정예, 그리고 「서 있는 것」은 바닥값이 높다

   시간은 90ms 칸으로 끊는다. 프레임마다 새로 뽑으면 60Hz로 떨려서
   눈이 아프고, 그건 불쾌한 게 아니라 그냥 못 만든 것이다. 한 칸
   동안은 같은 모양으로 어긋나 있어야 사람이 그것을 **본다**. */
const GLITCH_MS = 90;
const glitchHash = (s, q) => {
  let h = q | 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  return h;
};

function glitchOf(m) {
  const p = G.player;
  if (!p) return 0;
  let a = (G.depth || 0) / 15 * 0.45;
  /* 기름. lightRadius가 줄면 그만큼 올라간다 — 7칸이 온전한 상태다. */
  a += (1 - Math.min(1, (G.lightRadius || 7) / 7)) * 0.30;
  if (p.maxhp) a += (1 - p.hp / p.maxhp) * 0.15;
  if (m.ai === 'unseen') a = Math.max(a, 0.85);
  else if (m.boss) a = Math.max(a, 0.7);
  else if (m.named) a = Math.max(a, 0.5);
  else if (m.elite?.length) a = Math.max(a, 0.35);
  return Math.min(1, a);
}

/* 한 마리, 한 칸(90ms) 동안의 어긋남. 값이 아니라 결정이라서 그리는
   쪽에서 매번 다시 뽑지 않는다. */
function glitchNow(m, amount) {
  if (amount <= 0.02) return null;
  const q = Math.floor(performance.now() / GLITCH_MS);
  const h = glitchHash(m.spr || '?', q + m.x * 7 + m.y * 13);
  /* 얼마나 자주 어긋나는가. 최대치에서도 한 칸 걸러 한 칸이다 —
     내내 어긋나 있으면 그건 그냥 그렇게 생긴 것이 된다. */
  if ((h % 1000) / 1000 > amount * 0.5) return null;
  const kind = h % 100;
  return {
    /* 줄 하나가 옆으로 밀린다. 가장 싸고 가장 확실한 것. */
    shear: 1 + (h >> 3) % 2,
    row: (h >> 5) % 6 + 1,
    dir: (h >> 9) % 2 ? 1 : -1,
    /* 색이 갈라진다 — 붉은 쪽이 한 칸 뒤처진다. */
    split: amount > 0.35,
    /* 그리고 아주 가끔, 한 칸 동안만 통째로 다른 것이 된다. */
    other: kind < 4 && amount > 0.5,
  };
}

/* 어긋난 채로 그린다. 스프라이트를 세 조각(위·어긋난 줄·아래)으로
   잘라 가운데만 밀어 놓는다 — 캔버스 세 번이지, 픽셀을 만지지 않는다. */
function blitGlitch(img, px, py, t, g, unit) {
  const u = t / CELL_SIZE;                 // 스프라이트 한 픽셀의 화면 크기
  const y0 = g.row, y1 = Math.min(CELL_SIZE, g.row + g.shear);
  const off = g.dir * unit;
  if (g.split) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.35;
    ctx.drawImage(img, px - unit, py, t, t);
    ctx.globalAlpha = a;
  }
  ctx.drawImage(img, 0, 0, CELL_SIZE, y0, px, py, t, y0 * u);
  ctx.drawImage(img, 0, y0, CELL_SIZE, y1 - y0, px + off, py + y0 * u, t, (y1 - y0) * u);
  ctx.drawImage(img, 0, y1, CELL_SIZE, CELL_SIZE - y1,
                px, py + y1 * u, t, (CELL_SIZE - y1) * u);
}

function blitActor(img, px, py, t, o, flip = false) {
  if (flip) {
    ctx.save();
    ctx.translate(px + t / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(px + t / 2), 0);
  }
  const s = o.squash || 0;
  if (s > 0) {
    const g = 1 + s * 0.35;
    const w = t * g, h = t * (2 - g);
    ctx.drawImage(img, px - (w - t) / 2, py + (t - h), w, h);
  } else {
    ctx.drawImage(img, px, py, t, t);
  }
  if (o.flash > 0) {
    const prev = ctx.globalCompositeOperation, a = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = o.flash * 0.9;
    ctx.drawImage(img, px, py, t, t);
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = a;
  }
  if (flip) ctx.restore();
}

/* ── the frame loop ─────────────────────────────────────────
   Turns still resolve instantly; this loop only decides how
   they look on the way out. Everything is dt-driven, so if the
   player holds a direction and turns fire every 55ms the
   animations blend instead of queueing. */
let rafId = 0, lastTs = 0, lastDepth = -1;

/* Autosave lives here rather than in game.js so the rules layer
   never touches localStorage — that boundary is what keeps the
   headless simulation runnable. Floor changes are the natural
   checkpoint; the turn counter catches long floors. */
let savedTurn = -1, savedEnding = false;
const SAVE_EVERY = 40;

function autosave(reason) {
  if (!G.player || !G.running) return;
  Save.save(activeSlot);
  savedTurn = G.turn;
}

/* ── 죽음의 렌즈만 화면 전환 앞에서 통과시킨다 ──────────────
   죽으면 규칙이 G.screen='end' 로 바꾸고, 그러면 frame 이 그 줄에서
   끝난다 — Juice.pump 가 영영 안 돌고, 죽음 사건이 큐에 남은 채 화면은
   곧장 명세서로 넘어간다. 「슬로우모션으로 확대」가 한 프레임도 안
   그려지던 이유가 이것이다.

   그 사건 하나만 먼저 꺼내 렌즈를 켠다. 켜져 있는 동안은 판을 계속
   그린다 — 그게 이 연출의 전부다. */
function dyingFrame(dt) {
  if (G.fx.some(e => e.t === 'deathZoom')) {
    Juice.pump(G.fx.filter(e => e.t === 'deathZoom'), G.player);
    G.fx = G.fx.filter(e => e.t !== 'deathZoom');
  }
  if (!Juice.deathHolding() || !G.level) return false;
  Juice.tickDeath(dt);
  Juice.update(dt, [G.player, ...G.monsters]);
  draw();
  return true;
}

function frame(ts) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(50, ts - (lastTs || ts));
  lastTs = ts;
  /* Above the no-hero guard on purpose: the title is the one
     screen that is running before anybody exists. */
  if (!$('sc-title').hidden) { drawTitleScene(); return; }
  if (!G.player) return;
  /* 여기 `Juice.tickDeath(dt)` 가 하나 더 있었다. 바로 아래
     `dyingFrame(dt)` 안에서 또 부르므로 렌즈가 **한 프레임에 두 번**
     감겼다 — 「1.4초에 걸쳐 조인다」고 적어 둔 연출이 0.7초에 끝나고,
     끝 화면을 여는 endHold(1500ms)까지 남는 0.8초 동안 최대치로 굳은
     정지 화면이 남았다. 홀드 중에 정확히 한 번 도는 쪽만 남긴다. */

  /* Permadeath: the slot dies with the run. This lives in the
     loop rather than on the ending screen because death can
     arrive from a trap, from poison, or from a monster during
     an auto-walk — and a save that outlives the character would
     quietly turn the whole game into save-scumming. */
  if (!G.running && G.ending && !savedEnding) {
    savedEnding = true;
    Save.clear(activeSlot);
  }

  if (dyingFrame(dt)) return;
  if (!G.level || G.screen !== 'play') return;

  if (lastDepth !== G.depth) {
    lastDepth = G.depth;
    Juice.reset();
    snapCamera();
    autosave('floor');
  } else if (G.turn - savedTurn >= SAVE_EVERY) {
    autosave('turns');
  }

  tickInput(dt);
  if (G.screen !== 'play') return;
  checkLessons();

  /* Pages and the tally are pulled out of the queue before juice
     sees it: both are DOM, not canvas effects, and both outlive
     the frame that produced them. */
  for (const e of G.fx) {
    if (e.t === 'lore') pushLore(e);
    else if (e.t === 'hit' && e.on === 'player') noteHit(e);
  }
  // The ear stands where the hero stands.
  Audio.listenAt(G.player.x, G.player.y);
  /* 신앙심이 곧 뒤틀림이다(§4). 규칙 쪽은 0~100 숫자만 알고, 그것이
     화면에서 무엇이 되는지는 여기서 정한다 — 두 자리에서 계산하면
     「깊어질수록 기괴해진다」가 둘로 갈린다. */
  Juice.setWarp(Game.warpOf());
  Juice.pump(G.fx, G.player);
  Juice.update(dt, [G.player, ...G.monsters]);

  const { cx, cy } = cameraTarget();
  const k = 1 - Math.pow(0.78, dt / 16.7);
  camX += (cx - camX) * k;
  camY += (cy - camY) * k;
  if (Math.abs(cx - camX) < 0.002) camX = cx;
  if (Math.abs(cy - camY) < 0.002) camY = cy;

  draw();
}

export function startLoop() {
  Juice.bindLookup((x, y) => Game.monsterAt(x, y));
  if (!rafId) rafId = requestAnimationFrame(frame);
}

/* ── HUD ────────────────────────────────────────────────── */
let shownCombo = 0;

export function refresh() {
  const p = G.player;
  if (!p) return;

  $('hud-name').textContent  = `${RACES[p.race].name} ${CLASSES[p.cls].name}`;
  $('hud-lv').textContent    = p.lv;
  /* 원래 천장을 분모로 쓴다. `p.maxhp`는 이미 상처로 깎인 값이라,
     그걸로 나누면 상한 40%를 잃은 몸이 만피와 똑같이 100%로 그려진다. */
  const wound = p.wound || 0;
  const roof = p.maxhp + wound;
  $('hud-hp').textContent    = wound ? `${p.hp}/${p.maxhp} (−${wound})` : `${p.hp}/${p.maxhp}`;
  $('hud-hpbar').style.width = `${(p.hp / roof) * 100}%`;
  $('hud-wound').style.width = `${(wound / roof) * 100}%`;
  $('hud-ac').textContent    = Game.armourClass(p);
  $('hud-gold').textContent  = p.gold;
  /* The chip says where, not only how deep. "9층"은 숫자고
     "잊힌 성소 9층"은 장소다. */
  $('hud-depth').textContent = G.depth === 0
    ? '갱구' : `${regionOf(G.depth).n} ${G.depth}층`;
  $('hud-depth').title = G.depth ? regionOf(G.depth).t : '';
  $('hud-xp').textContent    = `${p.xp}/${xpToLevel(p.lv)}`;

  /* The only upkeep left, so it gets a number rather than just a
     warning word. It is also the light radius, which is why it
     sits next to the other numbers you plan around. */
  $('hud-oil-wrap').hidden = G.depth === 0;
  $('hud-oil').textContent = `${p.lightTurns} (${Game.lightRadiusOf(p)}칸)`;

  /* Tied to the class, not to the current pool. A priest who
     rolled poor wisdom has 0 mana at level 1 but still has a
     spellbook — showing the button without the bar told them
     nothing about why nothing worked. */
  /* 그리고 이제 그 「직업」이 여섯이다. 유틸 넷의 앞 둘(공통 치유)이
     마나를 먹으므로 전사도 볼 통이 있다. realm 으로 가리면 세 직업이
     자기가 방금 쓴 자원을 화면에서 못 본다. */
  const mana = $('hud-mana-wrap');
  mana.hidden = false;
  /* 그을린 동안에는 통이 안 찬다. 그것이 화면에 안 보이면 플레이어는
     열 턴 동안 「마나가 고장 났다」를 본다 — 이 게임에서 가장 자주
     고쳐 온 종류의 결함이 정확히 그것이다(§0). 칩이 식고, 이름 옆에
     남은 턴을 적는다. */
  // `seared` 는 「이 턴까지」이므로 남은 턴은 차이 + 1 이다.
  const scar = p.seared ? Math.max(0, p.seared - G.turn + 1) : 0;
  mana.classList.toggle('seared', scar > 0);
  $('hud-mana').textContent = scar > 0 ? `그을림 ${scar}턴` : `${p.mana}/${p.maxmana}`;
  $('hud-manabar').style.width = p.maxmana ? `${(p.mana / p.maxmana) * 100}%` : '0%';

  /* Always shown, town included. It toggled on depth at first,
     which moved the map by a gauge's height every time the
     player walked into or out of the town — a jump for no
     information gained. */
  const stam = $('hud-stam-wrap');
  $('hud-stam').textContent = `${p.stam}/${p.maxStam}`;
  $('hud-stambar').style.width = p.maxStam ? `${(p.stam / p.maxStam) * 100}%` : '0%';

  const combo = $('hud-combo');
  if (G.combo > 1) {
    combo.hidden = false;
    $('hud-combo-n').textContent = G.combo;
    combo.style.setProperty('--heat', Math.min(1, G.combo / 20));
    combo.classList.toggle('hot', G.combo >= 10);
    // Retrigger the pop only when the number actually changed —
    // this forces a reflow, and refresh() runs on every step.
    if (G.combo !== shownCombo) {
      combo.classList.remove('pop'); void combo.offsetWidth; combo.classList.add('pop');
    }
  } else combo.hidden = true;
  shownCombo = G.combo;

  const m = Game.mats();
  const matChip = $('hud-mats');
  const total = m.scrap + m.dust + m.essence;
  matChip.hidden = !total;
  if (total) $('hud-mats-n').textContent = `${m.scrap}/${m.dust}/${m.essence}`;

  const keys = $('hud-keys');
  keys.hidden = !p.keys;
  if (p.keys) $('hud-keys-n').textContent = p.keys;

  /* Ailments come first: they are the thing most likely to kill
     you in the next ten turns. */
  const flags = Game.ailList(p).map(k => AILMENTS[k].n);
  // Wearing something you cannot carry is a big invisible penalty
  // otherwise — it belongs next to poison and darkness.
  const strain = Game.strainOf(p);
  if (strain) flags.push(`부담 −${strain.short * 3} 명중`);
  if (p.stuck > 0) flags.push('거미줄');
  /* 소란은 내가 만든 것이라 보여야 한다. 그런데 배수만 띄우면 그것은
     도박판이 아니라 그냥 보너스다 — 딴 것만 보이고 건 것이 안 보인다.
     그래서 값과 위험을 나란히 적는다: 배수, 그리고 지금 이쪽으로
     오고 있는 것의 수. 둘이 같이 있어야 「더 부를까」가 질문이 된다. */
  if (G.depth > 0 && (G.uproar || 0) >= 2) {
    const p2 = G.player;
    const coming = G.monsters.filter(m => m.awake && !m.disguise
      && Math.hypot(m.x - p2.x, m.y - p2.y) <= 9).length;
    flags.push(`소란 ×${Game.uproarMult().toFixed(2)}${coming ? ` · ${coming}체` : ''}`);
  }
  /* 가방이 몇 칸 남았는지 보이지 않았다. 안 보이면 무게는 벌이 아니라
     사고다 — 무거워지는 순간을 알아야 무엇을 버릴지 고를 수 있다. */
  {
    const cap = Game.PACK_MAX;
    const load = Game.packLoad(p);
    // 미상 소모품이 반 칸이라 정수가 아닐 수 있다. 규칙이 세는 값을
    // 그대로 보여 주되 반올림해서 읽는다.
    const used = Math.round(Game.packUsed(p) * 2) / 2;
    if (load >= Game.LADEN_AT) flags.push(`짐 ${used}/${cap} 과적`);
    else if (load >= Game.HEAVY_AT) flags.push(`짐 ${used}/${cap} 무거움`);
    /* 가벼울 때까지 칩을 띄웠더니 320px에서 위쪽 HUD가 14px 밀려
       나갔다. 남은 칸은 어차피 늘 보여야 하는 값이므로, 벌을 알리는
       칩이 아니라 배낭 버튼 자체가 들고 있는 게 맞다. */
    const bag = $('btn-inv');
    /* 「배낭 6.5/20」은 개수처럼 읽힌다 — 실제로는 무게이고, 그래서
       소수점이 붙는다. 무엇을 세는 숫자인지를 말한다. */
    if (bag) bag.textContent = `배낭 무게 ${used}/${cap}`;
  }
  if (G.depth > 0 && p.lightTurns <= 0) flags.push('암흑');
  else if (G.depth > 0 && p.lightTurns < 80) flags.push('불빛 희미');
  else if (G.depth > 0 && p.lightTurns < 300) flags.push('기름 부족');
  if (p.blessed > 0) flags.push('축복');
  $('hud-flags').textContent = flags.join(' · ');
  $('hud-flags').className = flags.length ? 'flags on' : 'flags';

  /* Shutting a door is only ever *offered* when there is one to
     shut — but the row stays in the layout either way. Hiding it
     shortened the action column by a whole button, which pushed
     the map taller, and the view jumped every time the player
     walked past a doorway. A dim, dead row costs 40px once; a
     jumping map costs it on every step. */
  $('btn-door').disabled = !Game.doorToClose();
  /* The offer underfoot waits to be pressed rather than opening
     itself. Labelled with what it is, so the player never presses
     it blind. */
  /* 발밑에 있는 것 하나. 모닥불·제단·모루·?·수레에 더해 계단까지
     이 한 자리가 맡는다 — 봇 137,276턴에서 내려가기·올라가기·발밑이
     서로 동시에 살아 있는 일은 0.0%였다. 셋 다 「지금 이 칸에 있는
     것」을 말하는 같은 동사이므로, 한 자리에 두어도 잃는 것이 없다.
     비어 있어도 숨기지 않는다: 사라지는 줄은 지도를 매 걸음 밀어
     올리고, 그러면 누르려던 것이 아닌 것이 눌린다. */
  const here = Game.hereOffer();
  const stair = Game.stairHere();
  /* 잠긴 계단이 열리는 계단과 **픽셀 단위로 같은 버튼**이었다 —
     밝은 금색, 활성, 같은 글자. 누르면 화면에 아무 일도 안 일어나고
     로그 다섯 줄 중 하나에 주황 한 줄이 낀다. 세 번 누르면 세 턴이
     날아가는데 화면은 그 사실도 말하지 않는다. 모바일에서 이건
     거의 언제나 「고장」으로 읽힌다.
     라벨을 상태로 바꾸고, 금색을 뺀다. 삭아 가는 세 단계 문구는
     이미 있으니 버튼에 그대로 실으면 그 자체가 타이머가 된다. */
  const shut = stair === 'down' ? Game.stairsLocked() : null;
  const hb = $('btn-here');
  hb.disabled = !here && !stair;
  hb.classList.toggle('live', !!((here || stair) && !shut));
  hb.classList.toggle('shut', !!shut);
  hb.textContent = here ? (here.shop ? `${here.n}${wa(here.n)} 거래` : `${here.n} 열기`)
                 : shut ? `🔒 잠긴 계단 — ${Game.lockHint()}`
                 : stair === 'down' ? '▼ 내려가기'
                 : stair === 'up'   ? '▲ 올라가기'
                 : '발밑에 아무것도 없다';
  if (shut) teach('task');

  const logBox = $('log');
  logBox.innerHTML = '';
  /* Six now that the strip has the height for them. Anything
     older is not lost — it is on the parchment, one tap away. */
  for (const line of G.log.slice(-6)) logBox.appendChild(el('p', line.tone, line.text));

  $('btn-cast').hidden = !Game.spellSlots().length;
  /* 쏘기 only exists while a bow is held. It names what is
     nocked, because the quiver is half of what a bow
     hits for now, and greys out rather than vanishing when there
     is no line — a control that moves is a control you
     misfire. */
  const bowed = Game.weaponType(G.player) === 'bow';
  const q = Game.quiver();
  const shootBtn = $('btn-shoot');
  /* 활이 없으면 사라지던 자리다. 1.9%의 턴에만 살아 있는 버튼이
     제 줄을 통째로 썼다 없앴다 하면 지도가 매번 밀린다 — 이제
     고정된 칸에서 어두워지기만 한다. */
  shootBtn.disabled = !bowed || !Game.canShoot();
  if (!bowed) $('shoot-n').textContent = '';
  if (bowed) {
    /* 무엇을 끼웠는지를 두어 글자로. 앞서 여기에 「남은 화살 수」를
       적었는데, 이 게임의 화살은 떨어지지 않는다 — 화살통은 소모품이
       아니라 장비 한 칸이다. 없는 숫자를 세는 칸이었다. */
    $('shoot-n').textContent = q ? (q.short || q.n.slice(0, 2)) : '';
    shootBtn.title = !Game.shotTarget() ? '사선이 막혔거나 사거리 밖이다'
                   : q ? `${q.n} · ${q.desc}` : '화살통이 없다 — 평범한 화살이 나간다';
  }
  renderQuick();
  renderSpellRow();

  /* The clock, shown as a chip rather than a number: how much of
     the floor's patience is left. It only appears once it starts
     to matter, and it turns red when the floor is already
     feeding — a player who ignores it should at least have been
     told. */
  const clock = $('hud-clock');
  if (G.depth > 0) {
    const budget = Game.floorBudget();
    const left = budget - G.floorTurn;
    const lvl = Game.pressureLevel();
    clock.hidden = left > budget * 0.35 && !lvl;
    clock.className = 'chip clock' + (lvl ? ' bad' : left < budget * 0.15 ? ' warn' : '');
    $('hud-clock-n').textContent = lvl ? `습격 ${lvl}` : `여유 ${Math.max(0, left)}`;
  } else clock.hidden = true;

  const wager = $('hud-bank');
  wager.hidden = !(G.bank >= 2);
  if (G.bank >= 2) {
    const bp = Game.bankPurse2();
    /* 「판돈 12층 1840닢」은 97px을 먹었다. 층수는 바로 옆 지역 칩에
       이미 적혀 있으므로 여기서는 액수와 「쌓이는 중」만 말한다. */
    $('hud-bank-n').textContent = `◍${bp ? bp.gold : 0}↑`;
    wager.title = `${G.bank}층 연속 — 불 앞에 앉으면 탄다`;
    wager.classList.toggle('hot', G.bank >= 4);
  }

  /* 층에 과업이 걸리면 그 층의 규칙이 바뀐다 — 45%의 층에서.
     그런데 화면에 표시가 없었다. `say(G.task.intro)`는 지역 소개
     lorecard보다 먼저 나가므로 카드를 치우고 나면 이미 스크롤아웃
     되어 있고, 그러면 남는 것은 「랜덤 편차」라는 인상이다.
     칩 하나면 층 내내 남는다. */
  const task = $('hud-task');
  const tk = G.depth > 0 && G.task && !G.taskDone ? G.task : null;
  task.hidden = !tk;
  if (tk) {
    $('hud-task-n').textContent = tk.n;
    task.title = tk.intro || '';
  }

  /* The class counter. A trait the player cannot watch fill is
     a trait they cannot play around, so it goes in the HUD next
     to the things they already read every turn. */
  const tr = $('hud-trait');
  const st = Game.traitState();
  tr.hidden = !st;
  if (st) {
    const dots = st.max
      ? '●'.repeat(Math.min(st.at, st.max)) + '○'.repeat(Math.max(0, st.max - st.at))
      : '';
    $('hud-trait-n').textContent = `${st.n}${dots ? ' ' + dots : ''}${st.note ? ' ' + st.note : ''}`;
    tr.className = 'chip trait' + (st.ready ? ' on' : '');
  }

  /* A resonance is a turning point, so it stays on screen for the
     rest of the run — the player should be able to see, at any
     moment, that this is one of *those* runs. */
  const rs = $('hud-reso');
  const lit = RESONANCE.filter(r => Game.resonanceState(r.id)?.lit);
  rs.hidden = !lit.length;
  if (lit.length) $('hud-reso-n').textContent = lit.map(r => r.n).join(' · ');

  const rel = $('hud-relics');
  const held = Game.relicList();
  rel.hidden = !held.length;
  /* 칩이 「유물 4/7」만 말하던 동안, 크랙은 두 번 탭해야 나오는 창
     안에만 있었다. 크랙은 이 층에서 무엇을 할지를 바꾸는 장치다 —
     함정을 밟을까, 연격을 노릴까, 정예를 피할까. 그 판단은 걷는 중에
     일어나는데 정보가 창 안에 있으면 사람은 그냥 안 본다. 향할 곳이
     화면 밖에 있는 것이 「루즈하다」의 직접 원인이다.

     가장 가까운 하나만 건다. 넷을 걸면 그건 목록이지 목표가 아니다. */
  /* 주목. 이 판의 risk & take 계기다 — 세지면 아래가 너를 보고,
     본 만큼 층이 깨어 있고 정예가 잦고 시계가 짧다. 누르면 무엇이
     달라지는지 전부 적힌 카드가 뜬다. */
  const heat = G.heat || 0;
  const hc = $('hud-heat');
  hc.hidden = !(G.depth > 0);
  $('hud-heat-n').textContent = String(heat);
  hc.className = 'chip heat' + (heat >= 80 ? ' burn' : heat >= 45 ? ' hot' : '');
  hc.style.cursor = 'pointer';
  hc.onclick = () => showHeat();

  const near = Game.nearestCrack();
  $('hud-relics-n').textContent = `${held.length}/${RELIC_SLOTS}`
    + (near ? ` · ✧ ${near.n} ${near.left}` : '');
  rel.classList.toggle('close', !!near && near.at >= 0.9);
  /* 들고 있는 유물을 어디서도 볼 수 없었다. 숫자만 있고 목록이 없으면
     그것은 정보가 아니라 알림이다 — 칩을 누르면 편다. */
  rel.style.cursor = 'pointer';
  rel.onclick = () => showRelicList();

  draw();
}

/* Three buttons that never move and never change count, so the
   row cannot reflow under a thumb that is already travelling. */
function renderQuick() {
  const row = $('quick-row');
  const slots = Game.quickSlots();
  if (!row.children.length) {
    for (let i = 0; i < slots.length; i++) {
      const b = el('button');
      b.appendChild(el('canvas', 'qic'));
      b.appendChild(el('span', 'qn'));
      row.appendChild(b);
    }
  }
  slots.forEach((s, i) => {
    const b = row.children[i];
    if (!b) return;
    const cv = b.querySelector('canvas');
    const label = b.querySelector('.qn');
    b.disabled = !s;
    if (!s) {
      cv.width = cv.height = 1;
      label.textContent = Game.QUICK_LABELS[i];
      const gone = b.querySelector('.qty');
      if (gone) gone.hidden = true;
      b.onclick = null;
      return;
    }
    paintIcon(cv, s.item.spr);
    /* The count was inside the flow and the button is 49px wide on
       a small phone, so `×15` was pushed clean off the end — the
       one number on that button a player actually needs. It is a
       badge in the corner now, out of the flow entirely, and the
       label may be clipped instead. */
    label.textContent = s.label;
    let n = b.querySelector('.qty');
    if (!n) { n = el('b', 'qty'); b.appendChild(n); }
    n.textContent = s.qty > 1 ? String(s.qty) : '';
    n.hidden = s.qty <= 1;
    /* 불이 사그라들면 그 칸이 뛴다. HUD의 「불 55」가 빨개져도 사람은
       누를 것을 못 찾는다 — 로그 한 줄보다 버튼이 직접 부르는 편이
       확실하다. 그리고 어둠이 이제 예고를 가리므로, 이 칸은 편의가
       아니라 싸움의 일부다. */
    b.classList.toggle('urgent',
      s.role === 'torch' && (G.player?.lightTurns || 0) < 120);
    b.onclick = () => { stopAuto(); act(() => Game.useItem(s.idx)); };
  });
}

/* Casting used to cost a screen change every single time: open
   주문, read the list, tap, come back. That is a tax paid once
   per turn by every caster. The book is five entries and never
   more, so it fits on the play screen as five fixed frames — the
   ones you have not learned yet stay as dead slots, so the row
   never reflows as you level and the position is memorisable
   from level 1.

   `주문서` stays: names, descriptions, affixes and enhancement
   live there. This row is only the trigger. */
/* 기술과 주문을 갈라 그린다. 한 줄에 몰아넣었더니 팔라딘처럼 둘 다
   가진 직업에서 아홉 칸이 되었고, 320px에서 칸 하나가 30px가 안 돼
   「치유」가 「치듀」로 잘렸다. 자원이 다르면(기력·맹세 / 마나) 줄도
   다른 편이 낫다 — 눈이 한 줄을 한 종류로 읽는다.
   줄 수는 직업이 정하고 판 중에 안 바뀌므로, 나타났다 사라지며 지도를
   미는 문제는 생기지 않는다. */
function renderSpellRow() {
  const all = Game.spellSlots();
  paintSlotRow($('art-row'), all.filter(s => s.art));
  paintSlotRow($('spell-row'), all.filter(s => !s.art));
}

/* 한 줄에 여섯까지. 일곱째부터 아래로 접는다.
   재 보니 320px에서 칸 하나의 폭은 (300 − 5×(n−1)) / n 이다:
     다섯 56px · 여섯 46px · **일곱 39px** · 여덟 33px
   손가락 하나가 44px이므로 일곱부터 옆 칸이 눌리고, 「치유2」가
   「치유」로 잘린다(칸 벤치가 일곱 칸 전부를 잘림으로 잡았다).
   공통 치유 둘이 붙으면서 마법사가 다섯에서 일곱이 됐고, 순서 3-②는
   여덟으로 만든다 — 접는 자리를 지금 정한다.
   접는 폭은 ⌈n/2⌉ 이지만 넷을 안 넘는다: 여덟 칸을 4+4로 놓으면
   기예 넷과 유틸 넷이 위아래로 갈려서 §4의 표가 화면에 그대로
   보인다. 여섯 이하는 한 줄에 남으므로 사제·팔라딘의 줄 수는
   그대로다 — 줄이 늘면 지도가 줄고, 지도는 이미 320px에서 20%다. */
function slotCols(n) {
  return n <= 6 ? n : Math.min(4, Math.ceil(n / 2));
}

function paintSlotRow(row, slots) {
  row.hidden = !slots.length;
  if (!slots.length) return;
  row.style.setProperty('--cols', slotCols(slots.length));
  if (row.children.length !== slots.length) {
    row.innerHTML = '';
    for (let i = 0; i < slots.length; i++) {
      const b = el('button');
      b.appendChild(el('canvas', 'sic'));
      b.appendChild(el('span', 'sn'));
      row.appendChild(b);
    }
  }
  slots.forEach((s, i) => {
    const b = row.children[i];
    const cv = b.querySelector('canvas');
    const label = b.querySelector('.sn');
    b.disabled = !s.ready;
    b.className = s.locked ? 'locked' : s.ready ? '' : 'cold';
    if (cv.dataset.spell !== s.id || cv.dataset.lock !== String(s.locked)) {
      cv.dataset.spell = s.id; cv.dataset.lock = String(s.locked);
      cv.width = cv.height = 40;
      const c = cv.getContext('2d');
      c.clearRect(0, 0, 40, 40);
      if (!s.locked) drawSpellInto(c, s.id, 20, 20, 40);
    }
    label.innerHTML = '';
    if (s.locked) {
      // Latin here on purpose: "13레벨" does not fit in 23px of
      // button on a 320px phone, and "Lv13" does.
      label.appendChild(document.createTextNode(`Lv${s.lv}`));
      b.title = `${s.lv}레벨에 익힙니다`;
    } else {
      label.appendChild(document.createTextNode(s.short));
      /* 값이 횟수인 기예에는 숫자가 없다. 「1」을 찍으면 기력 1로
         읽히므로 점을 찍는다 — 다 쓰면 빈 점이 되어 그 자체가
         「이 층에서는 끝」이다. */
      label.appendChild(el('b', '', s.floorOnce ? (s.spent ? '○' : '●')
                                                : String(s.cost)));
      b.title = s.silent ? `${s.name} — 침묵의 서약으로 봉인됨`
              : s.noTarget ? (s.art ? `${s.name} — 손이 닿는 곳에 아무것도 없다`
                                    : `${s.name} — 시야에 적이 없다`)
              /* 식은 이유가 「모자라서」인지 「태울 것이 없어서」인지는
                 다른 말이다. 태우는 주문은 값이 통 전체라, 값을 적으면
                 언제나 「낼 수 있다」로 읽힌다 — 문턱을 적는다. */
              : s.thin ? `${s.name} — 태울 것이 모자라다 (마나 ${s.min} 이상)`
              : s.floorOnce ? `${s.name} · ${s.spent ? '이 층에서는 이미 썼다' : '층에 한 번'}`
              : s.burn ? `${s.name} · 통에 있는 ${s.cost} 전부를 태운다`
              : `${s.name} · ${s.cost}${s.art ? poolName(G.player?.cls) : 'mp'}`;
    }
    /* An art spends breath, not mana, and the row has to say so
       without a word — the cost pip carries the stamina colour. */
    b.classList.toggle('artslot', !!s.art);
    b.onclick = () => { stopAuto(); act(() => Game.cast(s.id)); };
  });
}

/* 지금 들고 있는 것들. 살펴보기 카드를 그대로 빌려 쓴다 — 읽는
   창이 하나면 밀어내기도 한 곳에서만 손보면 된다. */
/* 크랙 한 줄. 열렸으면 무엇이 깨졌는지, 아직이면 **무엇을 세고 있고
   얼마나 왔는지** 같은 자리에 쓴다. 조건을 숨기면 크랙은 우연이 되고,
   우연은 빌드가 안 된다 — 세는 것이 보여야 그쪽으로 논다. */
function crackRow(id) {
  const c = Game.crackOf(id);
  if (!c) return null;
  const on = Game.cracked(id);
  const row = el('div', 'crackline' + (on ? ' lit' : ''));
  row.appendChild(el('span', 'crackcat', c.c));
  const b = el('div', 'crackbody');
  b.appendChild(el('span', 'crackname', c.n));
  if (on) {
    b.appendChild(el('span', 'cracktext', c.t.replace(/\*\*/g, '')));
  } else {
    const pr = Game.crackProgress(id);
    /* 여태 안 열린 줄에는 조건만 있고 **상금이 없었다**. 「170마리를
       재우면」 옆에 「실이 끝나지 않는다」만 있으면, 그것이 체력인지
       시야인지 피해인지 모르는 채로 170마리를 향해 놀 사람은 없다 —
       조건만 보이고 상금이 안 보이면 목표가 아니라 잡음이다.
       전문은 열렸을 때 읽는다. 여기서는 굵게 표시된 한 구절만. */
    /* 굵은 첫 구절을 정규식으로 짜내고 있었다. 그런데 그 구절이 숫자면
       화면에는 `3` · `+2` · `×2.6` 만 뜬다 — 마흔 중 열하나가 그랬다.
       바로 위 주석이 「조건만 보이고 상금이 안 보이면 잡음이다」라고
       말하는데, 그 잡음을 스스로 27%를 만들고 있었다. 데이터가
       말하게 한다(c.prize). 나머지는 첫 구절이 이미 문장이다. */
    const prize = c.prize || (c.t.match(/\*\*(.+?)\*\*/) || [])[1];
    if (prize) b.appendChild(el('span', 'cracktext', prize));
    /* 그리고 남은 수를 절대값으로. 「129마리 더」가 「(41/170)」보다
       짧고, 사람이 계산을 안 해도 된다. */
    b.appendChild(el('span', 'cracktext dim', Game.crackLeft(id)));
    const bar = el('div', 'crackbar');
    const fill = el('div', 'crackfill');
    fill.style.width = `${Math.min(100, Math.round(pr.have / pr.need * 100))}%`;
    bar.appendChild(fill); b.appendChild(bar);
  }
  row.appendChild(b);
  return row;
}

/* 주목이 지금 무엇을 하고 있는지, 전부. 숫자 하나만 띄우면 그건
   경고등이지 거래 조건이 아니다. */
function showHeat() {
  const h = G.heat || 0;
  $('look-name').textContent = '깊은 곳이 너를 본다';
  $('look-sub').textContent = `주목 ${h}/${Game.HEAT_MAX}`;
  const rows = $('look-rows'); rows.innerHTML = '';
  const line = (k, v) => {
    const r = el('div', 'endrow');
    r.appendChild(el('span', 'endlabel', k));
    r.appendChild(el('span', 'endval', v));
    rows.appendChild(r);
  };
  rows.appendChild(el('p', 'empty', Game.HEAT_WORD(h)));
  /* ── 계기판이 아니라 거래 조건표다 ─────────────────────
     처음에 「곡선보다 1.3배 앞서 있다」·「평소의 2.9배」·「몬스터
     세기 114%」로 적었다. **「곡선」은 개발자의 단어이고** 세계에
     곡선은 없다. 「몬스터 세기」는 「세다(強)」와 「세다(數)」가 겹쳐
     한 번에 안 읽히기까지 했다. 숫자는 남기되 사건으로 적는다.

     그리고 계수를 손으로 다시 적지 않는다 — 0.6·0.035·0.022·0.0035·
     0.0025 를 여기 베껴 두면 규칙이 바뀔 때 화면이 조용히 거짓말을
     하게 되고, 이 카드의 값은 「거래 조건이 미리 다 적혀 있다」
     하나뿐이다. 깔때기를 그대로 부른다. */
  const pow = Math.round(Game.powerOf());
  const want = Math.round(Game.expectedPower(G.depth));
  line('네가 가진 것', pow > want
    ? '이 층이 예상한 것보다 무겁다' : '아직 이 층이 예상한 만큼이다');
  line('그래서', pow > want
    ? '아래가 네 이름을 안다' : '아래는 너를 대충 본다');
  rows.appendChild(el('div', 'endsep'));
  const wake = Math.round(Game.heatAwake() * 100);
  line('기다리고 있는 것', wake
    ? `층에 들어서면 열에 ${Math.max(1, Math.round(wake / 10))}은 이미 눈을 뜨고 있다`
    : '층은 자고 있다');
  line('알아채는 거리', `${Game.heatWake().toFixed(1)}배 멀리서 고개를 돌린다`);
  line('이름 있는 것', `${Game.heatElite().toFixed(1)}배 자주 나온다`);
  line('층의 여유', `전보다 ${100 - Math.round(Game.heatClock() * 100)}% 짧다 — 파도가 일찍 온다`);
  line('몬스터', `같은 이름이 ${Game.heatStat().toFixed(2)}배 두껍게 나온다`);
  $('look').hidden = false;
}

/* ── 아르카나 ────────────────────────────────────────────
   4·8·12층에 한 번씩, 셋 중 하나. 전부 양날이라 「좋은 것 고르기」가
   아니라 **이 판을 어떤 판으로 만들 것인가**를 고르는 화면이다.
   그래서 좋은 쪽과 값을 같은 크기로 적는다 — 한쪽만 크게 쓰면
   그건 광고지 결정이 아니다. */
function renderArcana() {
  /* ── 서약 화면 ────────────────────────────────────────────
     DESIGN.md §4. 아르카나가 쓰던 화면을 그대로 쓴다 — 넷째 칸이
     붙었을 뿐이다.

     **신이 말한 것만 뜬다.** 실제로 일어나는 것(real)은 이 함수가
     아예 안 읽는다 — 규칙 쪽(godOffer)이 안 내보내기도 하지만, 화면이
     그것을 알면 언젠가 새 나간다.

     그리고 이 화면도 뒤틀린다. 신앙심이 깊어질수록 신의 말이 흔들리고,
     넷째 칸은 점점 멀어진다. */
  const list = $('arcana-list'); list.innerHTML = '';
  const have = (G.gifts || []).length + (G.refused || 0);
  const w = Juice.warpLens();
  $('arcana-sub').textContent = G.god
    ? `${G.depth}층. 그가 다시 말한다.`
    : `${G.depth}층. 무언가 듣고 있다.`;

  for (const g of Game.godOffer()) {
    const row = el('button', 'itemrow arcanarow');
    const mid = el('div', 'imid');
    const nm = el('span', 'iname', g.n);
    nm.style.color = 'var(--P)';
    nm.classList.add('transcend');
    mid.appendChild(nm);
    mid.appendChild(el('span', 'idesc arcanacat', g.face));
    /* 부름은 명령형이다(§2) — 짧고, 이유를 안 댄다. */
    mid.appendChild(el('span', 'idesc arcanagood', `「${g.call}」`));
    /* 선물. **정직하다** — 성능을 속이면 결정을 못 하고, 결정을 못 하는
       것은 이 게임에서 「고장」으로 읽힌다(§0). 신이 속이는 것은 값이
       아니라 「무찌르면 평화가 온다」쪽이다. */
    mid.appendChild(el('span', 'idesc arcanacost', g.boon));
    mid.appendChild(el('span', 'idesc arcanacat', `계율 — ${g.vow}`));
    mid.appendChild(el('span', 'idesc arcanalore', g.lore));
    row.appendChild(mid);
    if (w) row.style.transform = `translateX(${(w.split || 0) * (Math.random() < 0.5 ? -1 : 1)}px)`;
    row.onclick = () => { if (!armed()) return; Game.pledge(g.id); setScreen('play'); refresh(); };
    list.appendChild(row);
  }

  /* ── 넷째 칸 ──────────────────────────────────────────────
     언제나 있고, 심연 8단에서만 열린다. 숨기지 않고 **잠근다** —
     위키도 공략도 없는 게임이라 완전히 감추면 아무도 못 찾고, 못 찾는
     진 엔딩은 없는 진 엔딩이다. 잠긴 채로 보이면 왜 잠겼는지 알고
     싶어진다. */
  const can = Game.canRefuse();
  const row = el('button', 'itemrow arcanarow' + (can ? '' : ' poor'));
  const mid = el('div', 'imid');
  const nm = el('span', 'iname', Data.REFUSE.n);
  nm.style.color = can ? 'var(--w)' : 'var(--g)';
  mid.appendChild(nm);
  mid.appendChild(el('span', 'idesc arcanacost',
    can ? Data.REFUSE.say : Data.REFUSE.locked));
  if (can) mid.appendChild(el('span', 'idesc arcanalore', Data.REFUSE.lore));
  row.appendChild(mid);
  row.disabled = !can;
  /* 뒤틀리면 이 칸이 **멀어진다.** 신이 원하지 않는 쪽이라는 것을
     문장이 아니라 손가락이 알게 된다(§4). */
  if (can && w) row.style.transform = `translateX(${w.split * 3}px)`;
  row.onclick = () => { if (!armed()) return; if (Game.refuse()) { setScreen('play'); refresh(); } };
  list.appendChild(row);
  void have;
}

function showRelicList() {
  const held = Game.relicList();
  if (!held.length) return;
  $('look-name').textContent = '지니고 있는 것';
  $('look-sub').textContent = `${held.length}/${RELIC_SLOTS}`;
  const rows = $('look-rows');
  rows.innerHTML = '';
  for (const r of held) {
    const row = el('div', 'codexrow');
    const ic = el('canvas', 'iicon');
    ic.width = ic.height = CELL_SIZE * 2;
    const c = ic.getContext('2d');
    c.imageSmoothingEnabled = false;
    const spr = sprite(r.spr || 'amulet');
    if (spr) c.drawImage(spr, 0, 0, ic.width, ic.height);
    row.appendChild(ic);
    const box = el('div', 'codextext');
    box.appendChild(el('div', 'iname', r.n));
    box.appendChild(el('div', 'idesc', r.t || ''));
    const ck = crackRow(r.id); if (ck) box.appendChild(ck);
    row.appendChild(box);
    rows.appendChild(row);
  }
  $('look').hidden = false;
}

/* ── screens ────────────────────────────────────────────── */
/* ── 손가락 밑에서 열리는 창 ──────────────────────────────
   ? 자리를 밟으면 사건 화면이 뜬다. 그 화면은 방금 밟은 자리 위에,
   즉 손가락 바로 밑에 열린다. 이동 버튼을 꾹 누르고 있었다면 손은
   아직 내려가 있고, 떼는 순간의 click은 새로 생긴 선택지로 간다 —
   읽지도 않은 선택을 누른 셈이 된다. 계단·모닥불·제단도 같은 방식으로
   당했다.

   두 겹으로 막는다.
     · 창이 열리고 ARM_MS 동안은 어떤 선택도 받지 않는다.
     · 그 뒤에도, 그 버튼 위에서 시작하지 않은 누름은 무시한다.
   두 번째가 없으면 꾹 누른 손가락이 350ms를 그냥 넘겨 버린다.
   반대로 첫 번째가 없으면 창이 열리자마자 새로 찍는 손을 못 막는다. */
export const ARM_MS = 350;
let armUntil = 0;
export const armScreens = () => { armUntil = Date.now() + ARM_MS; };
export const armed = () => Date.now() >= armUntil;

/* 어느 화면 하나만 남기고 전부 감춘다. setScreen 밖으로 뺀 이유는
   매듭 린트가 이 커밋에서 그 함수를 복잡도 30 위로 밀어 올렸다고
   잡았기 때문이고, 실제로 이건 「무엇을 보여줄까」 하나뿐이다.

   판을 가리지 않고 그 위에 얹히는 여섯(SHEETS)은 예외다 — 층에
   무엇이 남았고 내가 어디 섰는지가 바로 그 창이 묻는 정보라서. */
/* 판 밖에서도 열리는 화면들. 이 셋만 「어디서 열었는지」를 기억하면
   된다 — 나머지는 판 안에서만 열리므로 돌아갈 곳이 판 하나다. */
const OVERLAYS = ['help', 'codex'];
const SCREEN_IDS = ['title', 'create', 'play', 'inv', 'shop', 'spell', 'end', 'help',
                    'camp', 'slots', 'altar', 'stairs', 'relic', 'event', 'anvil',
                    'codex', 'arcana'];
function showOnly(name) {
  const sheeted = SHEETS.includes(name);
  for (const s of SCREEN_IDS) {
    const box = $(`sc-${s}`);
    box.hidden = (s !== name) && !(s === 'play' && sheeted);
    box.classList.toggle('assheet', s === name && sheeted);
  }
}

/* ── 닫기가 어디로 가야 하는가 ─────────────────────────────
   `[data-back]` 이 전부 `setScreen('play')` 였다. 그런데 조작법은
   **첫 화면에서도** 열린다(btn-help). 그래서 첫 화면 → 조작법 →
   닫기 를 하면 시작한 적도 없는 판으로 떨어졌다 — 지도도 영웅도
   없는 화면이다.

   화면마다 예외를 붙이는 대신(도감이 이미 그렇게 한 줄을 갖고
   있었다) **어디서 열었는지를 기억한다.** 그러면 같은 창이 어디서
   열리든 제자리로 돌아간다. */
let cameFrom = 'title';
export const backTarget = () =>
  (cameFrom === 'play' && !G.running) ? 'title' : cameFrom;

/* 덮개형 화면(조작법·도감)에 들어설 때만 기억한다 — 판 안에서
   배낭·상점을 오가는 것까지 기억하면 「돌아갈 곳」이 매번 바뀌어
   오히려 못 돌아간다. setScreen 밖에 두는 이유는 저 함수가 이미
   매듭 린트의 목록에 있기 때문이다. */
/* 기록할 판이 없으면 버튼이 **미리** 그렇게 보여야 한다 — 눌러 보고
   알게 되는 것은 한 번 속은 것이다. setScreen 밖에 두는 이유는 저
   함수가 이미 매듭 린트의 목록에 있기 때문이다. */
function armTrace() {
  const t = $('btn-trace2');
  if (!t) return;
  /* 「줄 것이 있는가」는 이번 판만의 질문이 아니다. 층별 기록이 없어도
     이 브라우저에는 저장 슬롯과 누적 장부가 남아 있고, 그것만으로도
     답할 수 있는 질문이 있다. 그래서 셋 중 하나라도 있으면 열린다 —
     그리고 무엇을 주는지 버튼이 미리 말한다. 「판 기록」이라 써 놓고
     장부만 주면 받은 쪽은 고장으로 읽는다. */
  const live = !!G.player && !!(G.trace || []).length;
  const meta = Meta.read();
  const kept = Save.allSlots().length > 0 || (meta.runs || 0) > 0;
  t.disabled = !live && !kept;
  t.textContent = live ? '판 기록 내려받기'
    : kept ? '이 브라우저에 남은 기록 내려받기'
    : '판을 시작하면 받을 수 있다';
}

function rememberFrom(name) {
  if (!OVERLAYS.includes(name)) return;
  if (OVERLAYS.includes(G.screen)) return;
  cameFrom = G.screen || 'title';
}

export function setScreen(name) {
  rememberFrom(name);
  if (name === 'help') armTrace();
  /* ── 죽는 순간은 화면을 늦춘다 ─────────────────────────
     죽자마자 명세서를 띄우면 **무엇이 나를 죽였는지 볼 틈이 없다.**
     규칙 쪽은 이미 끝났다고 말했지만(G.running=false), 화면은 렌즈가
     다 조일 때까지 판을 계속 그린다 — 카메라가 그 자리로 들어가고
     시간이 늘어지는 1.4초. 그 뒤에 명세서가 온다. */
  if (name === 'end' && Juice.deathHolding()) {
    G.screen = 'play';
    clearTimeout(endHold);
    endHold = setTimeout(() => setScreen('end'), 1500);
    draw();
    return;
  }
  /* 같은 화면을 다시 그리는 것은 새로 열리는 것이 아니다 — d-pad가
     모닥불 화면을 매 걸음 다시 그리므로, 여기서 구분하지 않으면
     불 앞에서는 아무 버튼도 영영 눌리지 않는다. */
  if (name !== G.screen) armScreens();
  G.screen = name;
  if (name !== 'play') stopAuto();
  /* Paper floats over the map rather than inside a screen, so it
     has to be put away by hand when the map goes. */
  if (name !== 'play') { $('scroll').hidden = true; closeLore(); }
  // Leaving the run entirely throws the unread pages away with it.
  if (name === 'end' || name === 'title' || name === 'codex') dropLore();
  /* The six that interrupt a floor come up as sheets over the map
     instead of replacing it. Losing the map loses "what is left on
     this floor and where I am standing" — which is precisely the
     information the fire is asking you to decide with. */
  showOnly(name);
  if (name === 'play') {
    /* 아르카나가 밀린 채로 판에 돌아오면 안 된다 — 4층에 들어선 순간
       고르는 화면이 떠야 그 층부터 그 판이 된다. */
    if (Game.pledgeDue(G.depth)) { setScreen('arcana'); return; }
    resize(); refresh();
    // Back on the map: whatever was waiting can be read now.
    if (loreQueue.length && $('lorecard').hidden) showLore();
  }
  if (name === 'arcana') renderArcana();
  if (name === 'inv')  renderInventory();
  if (name === 'shop') renderShop();
  if (name === 'spell') renderSpells();
  if (name === 'camp')  { teach('fire'); renderCamp(); }
  if (name === 'altar') renderAltar();
  if (name === 'slots') renderSlots();
  if (name === 'title') refreshTitle();
  if (name === 'end')  renderEnd();
  if (name === 'stairs') { teach('fork'); renderStairs(); }
  if (name === 'relic')  renderRelicSwap();
  if (name === 'event')  renderEvent();
  if (name === 'help')   renderLegend();
  if (name === 'anvil')  { teach('anvil'); renderAnvil(); }
  if (name === 'codex')  renderCodex();
}

/* ── 규칙서 한 장 ─────────────────────────────────────────
   도감의 「버릇」 칸에 들어가는 줄들. 세 종류가 섞인다:
     · 그냥 참말
     · 앞선 자가 적어 놓은 줄 — 이 중 하나가 거짓이고, 앞에 「전해
       들음」이 붙는다. 붙어 있지 않으면 나중에 「이거 버그인가」가 된다
     · 붉게 고쳐 쓴 줄 — 네가 두 눈으로 봐서 정본이 된 것
   어느 줄이 거짓인지는 절대 미리 말하지 않는다. 말해 주면 그건
   퀴즈지 규칙서가 아니다. */
function bookLines(m) {
  const h = hearsayFor(m);
  return rulebook(m, h ? Meta.corrected(m.spr, h.k) : false)
    .map(l => l.kind === 'hearsay'  ? { ...l, text: `전해 들음 — ${l.text}` }
            : l.kind === 'redwrit'  ? { ...l, text: `고쳐 씀 — ${l.text}` } : l);
}

/* The telegraph is only a mechanic if the player can read it.
   Same draw call as the map uses, so the key can never drift
   from what the map actually shows. */
const INTENT_NAMES = [
  ['heavy',   '크게 내리치기 직전 — 물러서면 헛손질'],
  ['melee',   '다음 턴에 때린다'],
  ['hex',     '독·실명 같은 것을 건다'],
  ['shoot',   '멀리서 쏜다'],
  ['close',   '다가온다'],
  ['flee',    '달아난다'],
  ['erratic', '어디로 갈지 모른다'],
  ['watch',   '움직이지 않고 지켜본다'],
  ['cast',    '바닥에 공격 범위를 그린다 — 표시된 칸에서 나가라'],
  ['held',    '묶이거나 휘청여 한 턴 쉰다'],
];

function renderLegend() {
  const box = $('intent-legend');
  if (!box || box.dataset.done) return;
  box.dataset.done = '1';
  for (const [kind, text] of INTENT_NAMES) {
    const row = el('div', 'eqrow');
    const c = el('canvas', 'icon');
    c.width = 72; c.height = 72;
    drawIntentInto(c.getContext('2d'), kind, 36, 38, 72);
    row.appendChild(c);
    row.appendChild(el('span', 'eqname', text));
    box.appendChild(row);
  }

  /* Both realms in one key, so a mage can read what a priest's
     row would look like and the shapes stay learnable. */
  const sbox = $('spell-legend');
  if (!sbox) return;
  // 탐지 is one glyph shared by both realms under two names —
  // listed once, or the key reads like a rendering bug.
  const byId = new Map();
  // 공통 둘이 먼저 — 여섯 직업이 다 갖는 것이 열쇠의 첫 줄이어야 한다.
  for (const list of [SPELLS_COMMON, SPELLS.arcane, SPELLS.divine])
    for (const s of list) {
      const had = byId.get(s.id);
      if (had) had.names.push(s.name);
      else byId.set(s.id, { ...s, names: [s.name] });
    }
  for (const s of byId.values()) {
    const row = el('div', 'eqrow');
    const c = el('canvas', 'icon');
    c.width = 72; c.height = 72;
    drawSpellInto(c.getContext('2d'), s.id, 36, 36, 72);
    row.appendChild(c);
    /* 태우는 주문의 값은 숫자가 아니다 — `0mp` 라고 적으면 열쇠가
       거짓말을 한다. 값이 「통에 있는 전부」임을 그대로 적는다. */
    row.appendChild(el('span', 'eqname',
      `${s.names.join(' · ')} — ${s.lv}레벨 · ${s.burn ? '통을 전부' : `${s.cost}mp`} · ${s.desc}`));
    sbox.appendChild(row);
  }
}

/* ── confirm ────────────────────────────────────────────────
   A Y/N gate in the game's own type rather than the browser's.
   Native confirm() blocks the render loop and looks like a
   security warning, which is the wrong tone for "이 검을 살까". */
let askResolve = null;

/* ── 계율을 어기는 것은 **손이 닿기 어려운 곳으로 간다** ─────
   DESIGN.md §4. 광신(신앙심 70)부터.

   처음에 「손가락이 다가오면 비켜선다」로 만들었는데 그건 **모바일에서
   아예 안 도는 코드**였다. 터치에는 hover 가 없다 — pointerenter 는
   마우스의 것이고, 손가락은 다가오는 단계 없이 그냥 닿는다. 그런데
   벤치가 `dispatchEvent(new PointerEvent('pointerenter'))` 로 합성
   이벤트를 쏴서 통과로 찍혔다. 자가 거짓말한 것이다(이 세션 네 번째).

   터치에서 되는 방식으로 바꾼다: **자리를 옮긴다.** 광신부터 계율에
   걸리는 줄이 배낭 맨 아래로 내려간다. 손가락이 기억하는 자리에 그것이
   없고, 찾아야 한다. 누르는 것은 여전히 되므로 고장이 아니고(§0),
   근육 기억이 배신당하는 쪽이 비켜서는 것보다 오래 남는다. */
function vowSinks(it) {
  if (!Game.vowRisk(vowKindOf(it))) return false;
  return Game.warpOf() * 100 >= Data.PIETY_ZEAL;
}

/* 이 물건을 쓰면 어떤 계율에 걸리는가. 규칙 쪽 표(VOW_BREAK)와 같은
   이름을 쓴다 — 여기서 따로 세면 언젠가 화면과 규칙이 다른 말을 한다. */
function vowKindOf(it) {
  if (!it || it.kind !== 'use') return null;
  if (it.use === 'heal' || it.use === 'bigHeal') return 'gulp';
  return null;
}

export function ask(text, sub, onYes) {
  dressAll();
  // Same resolver the log uses, so a confirmation reads like the
  // rest of the game rather than like a form.
  $('ask-text').textContent = josa(text);
  $('ask-sub').textContent = sub || '';
  $('ask').hidden = false;
  askResolve = onYes;
}

function closeAsk(yes) {
  if ($('ask').hidden) return false;
  $('ask').hidden = true;
  const fn = askResolve;
  askResolve = null;
  if (yes && fn) fn();
  return true;
}

export const asking = () => !$('ask').hidden;

$('ask-yes').onclick = () => closeAsk(true);
$('ask-no').onclick  = () => closeAsk(false);
$('ask').onclick = e => { if (e.target.id === 'ask') closeAsk(false); };

/* ── save slots ─────────────────────────────────────────────
   The same screen serves both doors: "새 게임" asks where to put
   the run, "이어하기" asks which one to resume. Occupied slots
   warn before they are overwritten, because a roguelike that
   silently eats a level-20 run is a bad roguelike. */
let slotMode = 'load';        // 'load' | 'new'
let activeSlot = 0;           // where the current run autosaves

export const currentSlot = () => activeSlot;

const RELATIVE = ms => {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};

export function renderSlots() {
  $('slots-title').textContent = slotMode === 'new' ? '어디에 저장할까' : '이어하기';
  $('slots-lead').textContent = slotMode === 'new'
    ? '고른 자리에 자동으로 저장됩니다. 층을 옮길 때마다, 그리고 이따금.'
    : '저장된 모험을 고르시오.';

  const list = $('slot-list');
  list.innerHTML = '';

  for (let i = 0; i < Save.SLOTS; i++) {
    const info = Save.describe(i);
    const row = el('button', 'slotrow' + (info ? '' : ' empty'));
    row.appendChild(el('span', 'slotnum', String(i + 1)));

    const mid = el('div', 'slotmid');
    if (info) {
      mid.appendChild(el('span', 'slotwho',
        `${RACES[info.race].name} ${CLASSES[info.cls].name} · Lv ${info.lv}`));
      mid.appendChild(el('span', 'slotmeta',
        `${info.depth === 0 ? '갱구' : info.depth + '층'} · HP ${info.hp}/${info.maxhp}` +
        ` · ${info.turn}턴 · ${RELATIVE(info.savedAt)}`));
    } else {
      mid.appendChild(el('span', 'slotwho', '비어 있음'));
      mid.appendChild(el('span', 'slotmeta', slotMode === 'new' ? '여기에 시작' : '—'));
    }
    row.appendChild(mid);

    if (slotMode === 'load' && !info) { row.disabled = true; row.classList.add('poor'); }

    row.onclick = () => {
      if (slotMode === 'new') {
        const begin = () => { activeSlot = i; setScreen('create'); renderCreate(); };
        if (info) {
          ask(`${i + 1}번 슬롯을 덮어쓸까요?`,
              `${RACES[info.race].name} ${CLASSES[info.cls].name} · ` +
              `${info.depth}층 · Lv ${info.lv} — 되돌릴 수 없습니다.`, begin);
          return;
        }
        begin();
      } else {
        if (!info) return;
        if (!Save.load(i)) { ask('저장을 읽지 못했다. 파일이 상했을 수 있다.', '파일이 손상되었을 수 있습니다.', null); return; }
        activeSlot = i;
        savedEnding = false;
        savedTurn = G.turn;
        lastDepth = G.depth;
        stopAuto();
        snapCamera();
        setScreen('play');
        refresh();
      }
    };
    list.appendChild(row);

    if (info) {
      const del = el('button', 'slotdel', '삭제');
      del.onclick = e => {
        e.stopPropagation();
        ask(`${i + 1}번 슬롯을 지울까요?`,
            `${RACES[info.race].name} ${CLASSES[info.cls].name} · ${info.depth}층 — 되돌릴 수 없습니다.`,
            () => { Save.clear(i); renderSlots(); refreshTitle(); });
      };
      row.appendChild(del);
    }
  }
}

export function openSlots(mode) {
  slotMode = mode;
  setScreen('slots');
  renderSlots();
}

/* ── 첫 화면 ──────────────────────────────────────────────
   An ASCII box in a monospace font said "someone's weekend
   project". The game underneath is not that, and the title is
   the only screen everybody sees.

   So it is a place instead of a logo: a stair going down out of
   the light, painted from the same wall and floor tiles the
   dungeon uses, with embers drifting up out of it. Nothing new is
   drawn here — it is the game's own vocabulary arranged to say
   "there is a down, and something is burning at the bottom".   */
let sparks = null, sceneAt = 0;

function drawTitleScene() {
  const cv = $('title-scene');
  if (!cv || $('sc-title').hidden) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.imageSmoothingEnabled = false;
  setTerrainTheme('plain');

  const t = Math.max(22, Math.round(w / 11));
  const cols = Math.ceil(w / t) + 1, rows = Math.ceil(h / t) + 1;
  c.fillStyle = PALETTE.k;
  c.fillRect(0, 0, w, h);

  /* A shaft: masonry on both sides, floor down the middle,
     narrowing as it goes so the eye is pulled to the bottom. */
  /* The shaft narrows as it drops, and the walls are held much
     darker than the floor — without that gap the grid reads as
     noise rather than as a place with a middle you could walk
     down. The vanishing point is a little below centre, where the
     eye lands first. */
  const midX = cols / 2, vanish = 0.58;
  for (let y = 0; y < rows; y++) {
    const depth = Math.min(1, (y / rows) / vanish);
    const half = Math.max(1.1, (cols / 2 - 0.4) * (1 - depth * 0.82));
    for (let x = 0; x < cols; x++) {
      const off = Math.abs(x + 0.5 - midX);
      const px = x * t, py = y * t;
      const wall = off >= half;
      c.globalAlpha = 1;
      c.drawImage(wall ? wallTile(x, y) : floorTile(x, y), px, py, t, t);
      /* Floors keep some light so the lane is legible; walls go
         nearly to black, and the very edges go all the way. */
      const edge = Math.max(0, off - half) / Math.max(1, cols / 2);
      c.globalAlpha = Math.min(0.95,
        (wall ? 0.62 + edge * 1.6 : 0.14) + depth * (wall ? 0.28 : 0.42));
      c.fillStyle = PALETTE.k;
      c.fillRect(px, py, t, t);
    }
  }

  /* The stair goes down *before* the light, so the light falls on
     it. Drawn after, it was a cold blue chip sitting on top of an
     amber wash. */
  const gy = h * vanish;
  const ss = t * 1.4;
  c.globalAlpha = 0.85;
  c.drawImage(sprite('stairsDown'), w / 2 - ss / 2, gy - ss * 0.5, ss, ss);
  c.globalAlpha = 1;

  /* And the reason to go down. Kept dim: this is a hole with
     something burning a long way below it, not a bonfire. */
  const glow = c.createRadialGradient(w / 2, gy + ss * 0.2, t * 0.1, w / 2, gy, h * 0.3);
  glow.addColorStop(0, 'rgba(232,199,106,0.34)');
  glow.addColorStop(0.4, 'rgba(217,138,60,0.17)');
  glow.addColorStop(1, 'rgba(143,47,40,0)');
  c.globalAlpha = 0.72 + 0.28 * Math.abs(Math.sin(performance.now() / 2600));
  c.fillStyle = glow;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 1;

  /* Embers. Seeded once, looped forever — no allocation per
     frame, and the same drift on every visit. */
  const now = performance.now();
  const dt = Math.min(60, now - (sceneAt || now));
  sceneAt = now;
  sparks ||= Array.from({ length: 26 }, (_, i) => ({
    x: 0.5 + (((i * 7919) % 100) / 100 - 0.5) * 0.5,
    y: ((i * 104729) % 100) / 100,
    v: 0.05 + ((i * 31) % 40) / 900,
    s: 1 + (i % 3),
  }));
  for (const p of sparks) {
    p.y -= p.v * dt / 1000;
    p.x += Math.sin(now / 900 + p.y * 9) * 0.0006;
    if (p.y < -0.05) { p.y = 1.05; p.x = 0.5 + (Math.random() - 0.5) * 0.5; }
    c.globalAlpha = Math.max(0, Math.min(0.85, p.y * 1.1)) * 0.9;
    c.fillStyle = p.s > 2 ? PALETTE.y : PALETTE.o;
    c.fillRect(Math.round(p.x * w), Math.round(p.y * h), p.s, p.s);
  }
  c.globalAlpha = 1;
  /* A soft floor of darkness under the type and under the
     buttons, so neither sits on masonry. */
  const fade = c.createLinearGradient(0, h * 0.62, 0, h);
  fade.addColorStop(0, 'rgba(10,12,18,0)');
  fade.addColorStop(0.55, 'rgba(10,12,18,0.72)');
  fade.addColorStop(1, 'rgba(10,12,18,0.99)');
  c.fillStyle = fade;
  c.fillRect(0, 0, w, h);
  /* And the sides, so the shaft is the only thing with light in
     it. */
  const sides = c.createLinearGradient(0, 0, w, 0);
  sides.addColorStop(0, 'rgba(10,12,18,0.9)');
  sides.addColorStop(0.28, 'rgba(10,12,18,0)');
  sides.addColorStop(0.72, 'rgba(10,12,18,0)');
  sides.addColorStop(1, 'rgba(10,12,18,0.9)');
  c.fillStyle = sides;
  c.fillRect(0, 0, w, h);
}

export function refreshTitle() {
  const btn = $('btn-load');
  if (btn) btn.hidden = !(Save.available() && Save.anySaved());

  /* One line, where ten rows and a nine-button ladder used to be.
     What a returning player wants off the title is "am I making
     progress" — the detail belongs behind 기록, and putting it
     here made the screen taller than the phone. */
  const meta = Meta.read();
  const bits = [];
  if (meta.runs) bits.push(`${meta.runs}판`);
  if (meta.best?.depth) bits.push(`최고 ${meta.best.depth}층`);
  const filled = codexFilled();
  if (filled) bits.push(`기록 ${filled}/${codexOf()}`);
  if (Meta.abyss()) bits.push(`심연 ${Meta.abyss()}`);
  if (meta.wins) bits.push(`승리 ${meta.wins}`);
  $('title-stat').textContent = bits.length ? bits.join(' · ') : '아직 아무도 내려가지 않았다.';
  /* 판번호는 data.js 한 곳에서 온다. 예전에는 index.html 안에 `v36`
     이라고 글자로 박혀 있었고, 그 뒤 117개 커밋 동안 아무도 안
     고쳤다 — 화면에 있는 숫자가 코드와 무관해지는 자리는 하나여야
     하고, 그 하나가 없어야 한다. */
  $('build').textContent = `${BUILD} · 저장 ${SAVE_FORMAT}`;
  paintLedger();
}

/* Which combinations exist, which are lit, and which this run is
   already carrying. The last column is the point: a lottery whose
   tickets you cannot see is a surprise, not a hunt. */
function paintReso() {
  const box = $('reso-list');
  if (!box) return;
  box.innerHTML = '';
  for (const r of RESONANCE) {
    const ever = Meta.seen('reso', r.id);
    const now = Game.resonanceState(r.id);
    const row = el('div', 'codexrow' + (ever || now?.lit ? '' : ' unknown'));
    const ic = el('canvas', 'icon');
    paintIcon(ic, ever || now?.lit ? r.spr : 'rubble');
    if (!ever && !now?.lit) ic.style.filter = 'brightness(0.28) grayscale(1)';
    row.appendChild(ic);
    const col = el('div', 'codextext');
    col.appendChild(el('span', 'iname', ever || now?.lit ? r.n : '???'));
    col.appendChild(el('span', 'idesc', r.want));
    if (ever || now?.lit) {
      col.appendChild(el('span', 'codextells', r.t));
      /* And what it cannot do. A resonance that reads as pure gain
         is a number; one that names its own blind spot is a build,
         and the player needs to see the blind spot to plan around
         it — that is the whole difference. */
      if (r.weak) col.appendChild(el('span', 'codexweak', `약점 — ${r.weak}`));
    }
    if (now?.lit) col.appendChild(el('span', 'idesc lit', '이 판에서 켜져 있다'));
    row.appendChild(col);
    box.appendChild(row);
  }
}

/* The two lists that used to live on the title. Rebuilt whenever
   the ledger screen opens, and once on boot so the title's status
   line has its numbers. */
function paintLedger() {
  const meta = Meta.read();
  const box = $('memories');
  box.innerHTML = '';
  for (const m of MEMORIES) {
    const at = Math.min(m.at(meta), m.of), done = at >= m.of;
    const row = el('div', 'memrow' + (done ? ' on' : ''));
    row.appendChild(el('span', 'memn', m.n));
    const bar = el('div', 'membar');
    const fill = el('i');
    fill.style.width = `${(at / m.of) * 100}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el('span', 'memt', done ? m.t : `${m.goal} ${at}/${m.of}`));
    row.title = m.t;
    box.appendChild(row);
  }

  /* 심연 only exists once the thing at the bottom is dead, and
     then it is a ladder: rung n+1 opens when rung n is finished.
     Locked rungs stay on the screen, greyed — the point of a
     ladder is being able to see the top of it. */
  const pick = $('abyss-pick');
  const unlocked = memoryEarned(meta, 'ember');
  pick.hidden = !unlocked;
  $('abyss-locked').hidden = unlocked;
  if (!unlocked) return;
  const row = pick.querySelector('.abyssrow');
  row.innerHTML = '';
  const at = Meta.abyss(), open = Meta.cleared() + 1;
  SHACKLES.forEach(a => {
    const locked = a.n > open;
    const b = el('button', (a.n === at ? 'on' : '') + (locked ? ' locked' : ''), String(a.n));
    b.disabled = locked;
    if (!locked) b.onclick = () => { Meta.setAbyss(a.n); paintLedger(); refreshTitle(); };
    row.appendChild(b);
  });
  /* Every shackle currently worn, not just the newest one — a
     rung wears all the rungs below it, and a player who cannot
     see that is guessing about the run they are starting. */
  const worn = SHACKLES.slice(1, at + 1);
  const note = $('abyss-note');
  note.innerHTML = worn.length
    ? worn.map(x => `<b>${x.k}</b> — ${x.t}`).join('<br>') +
      `<br><span class="dim">전리품 ×${SHACKLES[at].gold.toFixed(2)}` +
      (at < MAX_SHACKLE
        ? ` · ${at}단계를 이기면 ${at + 1}단계 「${SHACKLES[at + 1].k}」가 열린다`
        : ' · 마지막 단계') + '</span>'
    : SHACKLES[0].t + (open >= 1 ? ` <span class="dim">1단계 「${SHACKLES[1].k}」가 열려 있다</span>` : '');
}

/* ── 이번 턴 ──────────────────────────────────────────────
   The log used to carry two jobs at once: the prose, and "what
   just took forty health off me". The second one starved the
   first — it is the reason a summary line ever looked tempting.
   It is a picture now, on the map's bottom edge, and the prose
   was free to get longer the moment it stopped competing.

   Keyed by source so three wolves biting you read as one row with
   the total rather than as three rows you have to add up. */
let tallyTurn = -1, tallyAt = 0;
const tallyRows = new Map();

function noteHit(e) {
  const who = e.who || '?';
  if (G.turn !== tallyTurn) { tallyTurn = G.turn; tallyRows.clear(); }
  const row = tallyRows.get(who) || { spr: e.spr || 'trap', dmg: 0, n: 0 };
  row.dmg += e.dmg || 0; row.n++;
  tallyRows.set(who, row);
  drawTally();
}

function drawTally() {
  const box = $('tally');
  box.innerHTML = '';
  let total = 0;
  for (const [who, r] of tallyRows) {
    total += r.dmg;
    const one = el('div', 'tallyone');
    one.title = who;
    const cv = el('canvas');
    cv.width = CELL_SIZE * 2; cv.height = CELL_SIZE * 2;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(sprite(r.spr), 0, 0, cv.width, cv.height);
    one.appendChild(cv);
    one.appendChild(el('b', '', `−${r.dmg}${r.n > 1 ? `  ×${r.n}` : ''}`));
    box.appendChild(one);
  }
  /* The one number that decides whether to drink, when more than
     one thing is on you. */
  if (tallyRows.size > 1) box.appendChild(el('div', 'tallytotal', `이번 턴 −${total}`));
  box.hidden = false;
  box.classList.remove('fade');
  clearTimeout(tallyAt);
  tallyAt = setTimeout(() => {
    box.classList.add('fade');
    setTimeout(() => { box.hidden = true; tallyRows.clear(); }, 320);
  }, 2600);
}

/* ── 양피지 ───────────────────────────────────────────────
   The compromise. Compressing the log into a summary line was the
   wrong lever — the log is where the fiction lives turn to turn,
   and a game that wants to be read cannot pay for legibility in
   prose. So nothing is compressed. Instead the two jobs the log
   was doing get separated: the tactical readout goes elsewhere,
   and the writing gets *more* room and more occasions.

   The card is what arrives — the first of a thing, a sentence or
   two, over the map, gone on its own. The scroll is what
   accumulates — everything said this run, set as paragraphs under
   floor headings, for reading rather than glancing.

   Both are paper generated in pixels.js, so this surface is made
   of the same sixteen colours as the dungeon. */
let paper = null;
function paperURL() { return paper ||= Pix.parchmentURL(); }

function dressSheet(box) {
  if (box.dataset.dressed) return;
  box.dataset.dressed = '1';
  let sheet = box.querySelector('.sheet');
  if (!sheet) {
    /* Wrap what is already inside, so the paper sits behind the
       content and the torn edges sit outside it. */
    sheet = el('div', 'sheet');
    while (box.firstChild) sheet.appendChild(box.firstChild);
    box.appendChild(sheet);
  }
  sheet.style.backgroundImage = `url(${paperURL()})`;
  const w = 320;
  for (const [sel, flip] of [['.deck.top', false], ['.deck.bot', true]]) {
    let cv = box.querySelector(sel);
    /* Boxes that were written before the paper existed get their
       torn edges attached here rather than in the markup, so the
       whole game is one surface without four copies of the same
       two canvases in index.html. */
    if (!cv) {
      cv = el('canvas', 'deck ' + (flip ? 'bot' : 'top'));
      if (flip) box.appendChild(cv); else box.insertBefore(cv, box.firstChild);
    }
    const src = Pix.deckle(w, flip);
    cv.width = w; cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
  }
}

/* Every question, lesson and look-at card in the game is paper
   now. A blue-bordered dialog next to a torn leaf reads as two
   different games sharing a screen. */
function dressAll() {
  for (const id of ['ask', 'lesson', 'look'])
    dressSheet($(id).querySelector('.askbox'));
}

/* Cards queue rather than stack: two firsts in one turn would
   otherwise draw on top of each other, and the second is the one
   the player never gets to read. */
const loreQueue = [];
let loreAt = 0;

export function pushLore(ev) {
  loreQueue.push(ev);
  if (!loreAt) showLore();
}

/* ── 밀어내기 ────────────────────────────────────────────
   양피지는 저절로 사라지기를 기다리는 것 말고 치울 방법이 없었다.
   탭은 있었지만, 읽는 중에 잘못 눌릴까 봐 손이 안 가는 자리다.
   그래서 손가락으로 미는 길을 낸다 — 위로든 옆으로든 40px을 넘기면
   그쪽으로 날아간다. 40px 미만이면 제자리로 돌아온다.

   선택을 요구하는 창(#ask)에는 붙이지 않는다. 질문을 밀어서 없앨 수
   있으면 그것은 질문이 아니다. */
const SWIPE_GO = 40;
/* ── 밀어도 안 닫히던 이유 ────────────────────────────────
   플레이어: 「지금 팝업들(양피지) 위나 좌우로 밀어내도 화면에서
   안꺼짐」.

   코드는 멀쩡했다. 막고 있던 것은 CSS다 — body 에 `touch-action:
   manipulation` 이 걸려 있어서, 손가락이 옆으로 움직이는 순간 브라우저가
   그것을 **스크롤 제스처로 채 간다.** 그러면 pointermove 가 우리에게
   한 번도 안 오고, 대신 pointercancel 이 온다. dx·dy 는 0인 채로
   남고, 밀어낸 거리는 언제나 문턱(40px) 아래다.

   그래서 두 곳을 고친다: 미는 면에 `touch-action: none` 을 걸어
   제스처를 우리가 갖고(styles.css), 채였을 때는 닫지 말고 제자리로
   돌린다(아래). 그리고 카드 바깥을 눌러도 닫히게 한다 — 모바일에서
   그건 「밀어내기」와 같은 뜻의 동작이다. */
/* `tapCloses` 는 「읽는 카드」와 「치우는 카드」를 가른다. 본문을
   탭하면 닫는 규칙이 스크롤 되는 카드에도 걸려 있어서, 일곱 줄짜리
   주목 거래 조건표를 읽다가 손가락이 닿으면 사라졌다. 층 배너처럼
   5초면 저절로 없어지는 것은 탭으로 치우는 편이 옳고, 유물 목록과
   주목 카드처럼 **읽으려고 연 것**은 아니다. 바깥(백드롭) 탭과
   미는 동작은 양쪽 다 그대로 닫는다. */
function swipeAway(box, done, { tapCloses = true } = {}) {
  if (box.__swipe) return;
  box.__swipe = true;
  /* 카드 바깥(어두운 바닥)을 누르면 닫힌다. 카드 자체의 클릭은
     아래 surface 쪽이 먹으므로 여기까지 안 올라온다. */
  box.addEventListener('pointerdown', e => { if (e.target === box) done(); });
  let id = null, sx = 0, sy = 0, dx = 0, dy = 0, moved = false;
  const surface = box.querySelector('.sheet') || box;

  const reset = () => {
    box.style.transition = 'transform .16s steps(3), opacity .16s steps(3)';
    box.style.transform = ''; box.style.opacity = '';
    setTimeout(() => { box.style.transition = ''; }, 180);
  };
  surface.addEventListener('pointerdown', e => {
    if (id !== null) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; dx = dy = 0; moved = false;
    box.style.transition = '';
    try { surface.setPointerCapture(id); } catch { /* 마우스에선 없을 수 있다 */ }
  });
  surface.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (Math.hypot(dx, dy) > 6) moved = true;
    if (!moved) return;
    /* 아래로는 안 민다 — 아래에 조작부가 있어서, 내려 미는 동작은
       버튼을 향한 손과 구분이 안 된다. */
    const useY = Math.min(0, dy);
    box.style.transform = `translate(${Math.round(dx)}px, ${Math.round(useY)}px)`;
    box.style.opacity = String(Math.max(0.25, 1 - Math.hypot(dx, useY) / 180));
  });
  const finish = e => {
    if (e.pointerId !== id) return;
    id = null;
    /* 브라우저가 제스처를 채 가면 pointercancel 이 온다. 그때는
       **닫으면 안 된다** — 손가락이 아직 화면에 있고, 사용자는 아직
       아무것도 결정하지 않았다. 제자리로 돌린다. */
    if (e.type === 'pointercancel') { reset(); return; }
    const far = Math.max(Math.abs(dx), Math.max(0, -dy));
    if (!moved) { if (tapCloses) done(); return; }   // 밀지 않았으면 탭이다
    if (far < SWIPE_GO) { reset(); return; }
    const gx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) * 460 : 0;
    const gy = gx ? 0 : -420;
    box.style.transition = 'transform .18s steps(4), opacity .18s steps(4)';
    box.style.transform = `translate(${gx}px, ${gy}px)`;
    box.style.opacity = '0';
    setTimeout(() => { box.style.transition = ''; box.style.transform = '';
                       box.style.opacity = ''; done(); }, 190);
  };
  surface.addEventListener('pointerup', finish);
  surface.addEventListener('pointercancel', finish);
}

function showLore() {
  const box = $('lorecard');
  const ev = loreQueue.shift();
  if (!ev) { box.hidden = true; loreAt = 0; return; }
  dressSheet(box);
  box.classList.remove('out');
  box.hidden = false;
  /* Under the HUD, always. A page you are reading must never be
     covering the health bar — that is the difference between a
     flourish and an obstruction. */
  box.style.top = `${Math.round($('hud').getBoundingClientRect().bottom) + 6}px`;
  box.querySelector('.lorekind').textContent = ev.kind;
  box.querySelector('.lorename').textContent = ev.name;
  box.querySelector('.loretext').textContent = ev.text;
  const ic = box.querySelector('.loreicon');
  ic.width = CELL_SIZE * 3; ic.height = CELL_SIZE * 3;
  const c = ic.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, ic.width, ic.height);
  c.drawImage(sprite(ev.spr || 'scroll'), 0, 0, ic.width, ic.height);
  clearTimeout(loreAt);
  /* Long enough to read two sentences at a glance, and tappable
     away before that — it must never be in the way of a fight. */
  loreAt = setTimeout(closeLore, 5200);
  swipeAway(box, closeLore);
}

function closeLore() {
  const box = $('lorecard');
  if (box.hidden) return;
  clearTimeout(loreAt); loreAt = 0;
  box.classList.add('out');
  setTimeout(() => {
    box.hidden = true; box.classList.remove('out');
    /* Only the map advances the queue. The card floats above
       everything, so popping the next one while a sheet is open
       lands a page of lore on top of the fire, the pack, or the
       list of arts — which is where it was landing. */
    if (loreQueue.length && G.screen === 'play') showLore();
  }, 260);
}

/* Leaving the map drops whatever pages were still waiting. The
   queue exists so two discoveries on one turn are read one after
   the other, not so a page nobody got to floats over the death
   screen a run later — which is exactly what it was doing. */
function dropLore() {
  loreQueue.length = 0;
  clearTimeout(loreAt); loreAt = 0;
  const box = $('lorecard');
  box.hidden = true; box.classList.remove('out');
}

/* The whole record. A floor is a chapter, a turn is a paragraph,
   and not one line is dropped — the grouping is typographic. */
function renderScroll() {
  const box = $('scroll');
  dressSheet(box);
  const out = $('scroll-text');
  out.innerHTML = '';
  let atDepth = null, atTurn = null, para = null;
  for (const line of G.log) {
    if (line.depth !== atDepth) {
      atDepth = line.depth; atTurn = null;
      out.appendChild(el('div', 'scrollfloor',
        atDepth === 0 ? '갱구' : `${regionOf(atDepth).n} · ${atDepth}층`));
    }
    if (line.turn !== atTurn || !para) {
      atTurn = line.turn;
      para = el('p', 'scrollturn');
      out.appendChild(para);
    }
    /* Colour per sentence, not per paragraph. A turn where you
       were hit and then killed the thing is two colours, and
       painting the whole block red loses the second half. */
    if (para.textContent) para.appendChild(document.createTextNode(' '));
    para.appendChild(el('span', line.tone || '', line.text));
  }
  if (!G.log.length) out.appendChild(el('p', 'scrollturn', '아직 아무 일도 없었다.'));
  box.hidden = false;
  out.scrollTop = out.scrollHeight;
  closeLore();                     // one sheet at a time
}

/* ── the codex ────────────────────────────────────────────
   Everything the dead runs met, and — under each monster — how
   many of them you have put down.

   The body count is the point. A codex that only lists what you
   have seen is a museum, and museums do not make anybody press
   새 게임. This one is a contract: five bodies and the thing
   tells you how it fights, forever, in every run after. The
   deep floors are where a player dies not knowing what is in
   front of them, so the fix for the deep floors is not a bigger
   number — it is arriving there having already read the page.

   Undiscovered rows are drawn as a blank plate with the depth
   printed on it, so the page reads as a map of what is left
   rather than as an empty list. */
const CODEX_TABS = [
  { k:'monsters', n:'몬스터' },
  { k:'relics',   n:'유물' },
  { k:'items',    n:'소모품' },
  { k:'events',   n:'사건' },
  { k:'regions',  n:'장소' },
];
let codexTab = 'monsters';

/* One place that knows what a complete codex looks like, so the
   header, the memories and the shackle gate can never disagree
   about what "전부" means. */
export function codexTotals() {
  const roster = [...MONSTERS, ...NAMED, BOSS];
  return {
    monsters: { of: roster.length, at: roster.filter(m => Meta.seen('monsters', m.n)).length },
    relics:   { of: RELICS.length, at: RELICS.filter(r => Meta.seen('relics', r.id)).length },
    items:    { of: CONSUMABLES.length, at: CONSUMABLES.filter(c => Meta.seen('items', c.id)).length },
    events:   { of: EVENTS.length, at: EVENTS.filter(e => Meta.seen('events', e.id)).length },
    regions:  { of: REGIONS.length, at: REGIONS.filter(r => Meta.seen('regions', r.n)).length },
  };
}
export const codexFilled = () => {
  const t = codexTotals();
  return Object.values(t).reduce((s, v) => s + v.at, 0);
};
export const codexOf = () => {
  const t = codexTotals();
  return Object.values(t).reduce((s, v) => s + v.of, 0);
};

/* Three ledgers behind one door. The title screen used to stack
   all of them and came out 837px tall in a 568px phone, with the
   shackle ladder below the fold and unreachable. */
let ledgerTab = 'codex';

function renderCodex() {
  for (const b of $('ledger-tabs').children) b.classList.toggle('on', b.dataset.led === ledgerTab);
  for (const sec of document.querySelectorAll('#sc-codex [data-led]'))
    if (sec.dataset.led && sec.tagName === 'DIV') sec.hidden = sec.dataset.led !== ledgerTab;
  if (ledgerTab !== 'codex') { paintLedger(); paintReso(); return; }
  const tot = codexTotals();
  const need = tellsNeeded(Meta.read());
  $('codex-lead').textContent =
    `본 것 ${codexFilled()} / ${codexOf()}. ` +
    `몬스터는 ${need}마리를 잡으면 버릇을 내놓는다 — 그 앎은 다음 판에도 남는다.`;

  const tabs = $('codex-tabs');
  tabs.innerHTML = '';
  for (const t of CODEX_TABS) {
    const b = el('button', 'codextab' + (codexTab === t.k ? ' on' : ''),
      `${t.n} ${tot[t.k].at}/${tot[t.k].of}`);
    b.onclick = () => { codexTab = t.k; renderCodex(); };
    tabs.appendChild(b);
  }

  const list = $('codex-list');
  list.innerHTML = '';
  const row = (spr, name, sub, body, known) => {
    const r = el('div', 'codexrow' + (known ? '' : ' unknown'));
    const ic = el('canvas', 'icon');
    paintIcon(ic, known ? spr : 'rubble');
    if (!known) ic.style.filter = 'brightness(0.28) grayscale(1)';
    r.appendChild(ic);
    const col = el('div', 'codextext');
    col.appendChild(el('span', 'iname', known ? name : '???'));
    if (sub) col.appendChild(el('span', 'idesc', sub));
    if (body) col.appendChild(el('span', 'codextells', body));
    r.appendChild(col);
    list.appendChild(r);
  };

  if (codexTab === 'monsters') {
    for (const m of [...MONSTERS, ...NAMED, BOSS]) {
      const known = Meta.seen('monsters', m.n);
      const n = Meta.bodies(m.n);
      const where = m.boss ? '15층' : m.at ? `${m.at}층` : `${m.d}층부터`;
      const sub = known
        ? `${where} · 체력 ${m.hp} · 공격 ${m.atk} · 방어 ${m.ac} · 처치 ${n}`
        : where;
      /* The card that arrived the first time is filed here, so a
         page you read once over the map can be read again. */
      const body = [
        known && m.lore ? m.lore : '',
        known && n >= need ? bookLines(m).map(l => l.text).join('\n')
          : known ? `버릇까지 ${need - n}마리` : '',
      ].filter(Boolean).join('\n');
      row(m.spr, m.n, sub, body, known);
    }
  } else if (codexTab === 'relics') {
    for (const r of RELICS)
      row(r.spr, r.n, Meta.seen('relics', r.id) ? r.t : '', '', Meta.seen('relics', r.id));
  } else if (codexTab === 'items') {
    for (const c of CONSUMABLES)
      row(c.spr, c.n, Meta.seen('items', c.id) ? (c.desc || '') : '', '', Meta.seen('items', c.id));
  } else if (codexTab === 'events') {
    for (const e of EVENTS)
      row('event', e.n, Meta.seen('events', e.id) ? e.t : '', '', Meta.seen('events', e.id));
  } else {
    for (const r of REGIONS)
      row('stairsDown', r.n, Meta.seen('regions', r.n) ? r.t : `${r.from}~${r.to}층`,
          '', Meta.seen('regions', r.n));
  }
}

/* character creation */
let pick = { race: 'human', cls: 'warrior', base: null };

export function renderCreate() {
  pick.base = pick.base || Game.rollStats(pick.cls);

  const rb = $('race-list'); rb.innerHTML = '';
  for (const [key, r] of Object.entries(RACES)) {
    const b = el('button', 'pickbtn' + (pick.race === key ? ' on' : ''));
    b.appendChild(el('span', 'pname', r.name));
    const mods = Object.entries(r.mod).map(([k, v]) => `${STAT_NAME[k]}${v > 0 ? '+' : ''}${v}`).join(' ');
    b.appendChild(el('span', 'pmod', mods || '수정 없음'));
    b.onclick = () => { pick.race = key; renderCreate(); };
    rb.appendChild(b);
  }

  const cb = $('class-list'); cb.innerHTML = '';
  for (const [key, c] of Object.entries(CLASSES)) {
    const b = el('button', 'pickbtn' + (pick.cls === key ? ' on' : ''));
    b.appendChild(el('span', 'pname', c.name));
    /* 「무주문」이라고 적던 갈래가 있었다. 여섯 직업 전부 공통 치유
       둘을 갖게 된 뒤로는 거짓말이고, 그 전에도 여섯이 다 trait 을
       가진 뒤로 한 번도 안 그려진 줄이었다. */
    b.appendChild(el('span', 'pmod', c.trait.n));
    // A class changes the bands, so the roll has to be redrawn
    // — showing a warrior's numbers under 마법사 would be a lie.
    b.onclick = () => { pick.cls = key; pick.base = Game.rollStats(key); renderCreate(); };
    cb.appendChild(b);
  }

  $('race-note').textContent = RACES[pick.race].note;
  /* The trait is most of what a class *is* now, so it goes on
     the screen where the class is chosen rather than being found
     out on floor three. */
  const c = CLASSES[pick.cls];
  $('class-note').innerHTML =
    `${c.note}<br><b style="color:var(--o)">${c.trait.n}</b> — ${c.trait.t}`;

  /* The bar now shows the *band* as well as the roll: a pale
     stripe for what this race and class can ever come out as,
     and the solid fill for what the dice actually said. Rerolling
     moves the fill a few points inside the stripe and never
     outside it, which is the entire point of the change. */
  const sb = $('stat-preview'); sb.innerHTML = '';
  let total = 0;
  for (const k of STATS) {
    const v = clamp(pick.base[k] + (RACES[pick.race].mod[k] || 0), 3, 20);
    total += v;
    const [lo, hi] = statRange(pick.race, pick.cls, k);
    const row = el('div', 'statrow');
    row.appendChild(el('span', 'sname', STAT_NAME[k]));
    row.appendChild(el('span', 'sval', String(v)));
    const bar = el('div', 'sbar');
    const band = el('u');
    band.style.left = `${(lo / 20) * 100}%`;
    band.style.width = `${((hi - lo) / 20) * 100}%`;
    bar.appendChild(band);
    const fill = el('i');
    fill.style.width = `${(v / 20) * 100}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el('span', 'srange', `${lo}~${hi}`));
    sb.appendChild(row);
  }
  /* The two layers, composited, at the size they are actually
     drawn on the map. Choosing a race should change the picture. */
  const pv = $('hero-preview');
  if (pv) {
    pv.width = pv.height = CELL_SIZE * 3;
    const c = pv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, pv.width, pv.height);
    const img = sprite(`hero:${pick.race}:${pick.cls}`) || sprite(`hero:${pick.cls}`);
    if (img) c.drawImage(img, 0, 0, pv.width, pv.height);
    pv.title = `${RACES[pick.race].name} ${CLASSES[pick.cls].name}`;
  }

  const note = el('p', 'note',
    `합계 ${total} — 이 조합이 나올 수 있는 범위 안에서만 굴립니다. ` +
    `다시 굴려도 띠 밖으로 나가지 않습니다.`);
  sb.appendChild(note);
  $('stat-detail').innerHTML = STAT_JOBS.map(([k, t]) =>
    `<b>${STAT_NAME[k]}</b> ${t}`).join('<br>');
}

/* What each ability actually does, printed where the ability is
   chosen. Six lines; every one of them is a rule that exists in
   game.js, not flavour. */
const STAT_JOBS = [
  ['str', '근접 피해와 명중. 양손 무기·중갑은 힘을 요구하고, 모자라면 명중이 크게 깎입니다.'],
  ['int', '비전 주문의 위력. 주운 물건을 그 자리에서 읽어낼 확률.'],
  ['wis', '신성 주문과 치유. 함정을 알아채고, 걸린 상태이상이 짧아집니다 — 낮으면 길어집니다.'],
  ['dex', '방어 · 명중 · 치명타 · 은신 · 기력. 가장 많은 일을 합니다.'],
  ['con', '최대 체력, 그리고 회복 주기 — 높으면 다섯 턴마다, 낮으면 열두 턴마다 아뭅니다.'],
  ['chr', '물건값, 그리고 바닥에 떨어지는 것에 속성이 붙을 확률.'],
];

$('btn-reroll').onclick = () => { pick.base = Game.rollStats(pick.cls); renderCreate(); };
$('btn-begin').onclick  = () => {
  Game.startGame(pick.race, pick.cls, pick.base);
  savedEnding = false;
  savedTurn = -1;
  lastDepth = -1;
  Save.save(activeSlot);          // claim the slot immediately
  setScreen('play');
};

/* inventory */
/* Which half of the bag screen is showing. Kept across opens —
   a player who was comparing weapons is still comparing weapons
   after they walked two tiles. */
let invTab = 'worn';

/* On by default, and switchable: a player who has learned to read
   the room by eye should be able to turn it off. */
let showThreat = true;
const DIRS8 = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

function renderInventory() {
  const p = G.player;
  for (const b of $('inv-tabs').children) b.classList.toggle('on', b.dataset.tab === invTab);
  for (const sec of document.querySelectorAll('#sc-inv [data-inv]'))
    sec.hidden = sec.dataset.inv !== invTab;
  const eq = $('equip-list'); eq.innerHTML = '';
  const slots = [['weapon', '무기'], ['body', '갑옷'], ['shield', '방패'], ['quiver', '화살통']];
  for (const [key, label] of slots) {
    const it = p.equip[key];
    const row = el('div', 'eqrow');
    row.appendChild(el('span', 'eqlabel', label));
    if (it) {
      const ic = el('canvas', 'icon'); paintIcon(ic, it.spr);
      row.appendChild(ic);
      const nm = el('span', 'eqname', affixName(it));
      const r = rarityOf(it);
      nm.style.color = `var(--${isCursed(it) ? CURSED_TONE : RARITY[r].tone})`;
      if (r >= 2 && !isCursed(it)) nm.classList.add('shine');
      row.appendChild(nm);
      row.appendChild(el('span', 'eqstat',
        it.kind === 'weapon' ? `${it.dice[0]}d${it.dice[1]}` : `방어 ${it.ac}`));
      if (it.kind === 'weapon' && WEAPON_TYPES[it.t]) {
        const note = el('div', 'wtype');
        note.appendChild(el('b', '', WEAPON_TYPES[it.t].n));
        note.appendChild(document.createTextNode(' ' + WEAPON_TYPES[it.t].t));
        eq.appendChild(row);
        eq.appendChild(note);
        continue;
      }
    } else {
      row.appendChild(el('span', 'eqname dim', '없음'));
    }
    eq.appendChild(row);
  }

  /* The relics, in full, with their downsides written out. A
     build you cannot read is a build you cannot plan around. */
  const rl = $('relic-held'); rl.innerHTML = '';
  const held = Game.relicList();
  $('relic-count').textContent = `${held.length}/${RELIC_SLOTS}`;
  if (!held.length) rl.appendChild(el('p', 'empty', '아직 없다. 정예와 제단이 내놓는다.'));
  for (const r of held) {
    const row = el('div', 'eqrow');
    const ic = el('canvas', 'icon'); paintIcon(ic, r.spr); row.appendChild(ic);
    const mid = el('div', 'imid');
    mid.appendChild(el('span', 'iname magic', r.n));
    mid.appendChild(el('span', 'idesc', r.t));
    const ck = crackRow(r.id); if (ck) mid.appendChild(ck);
    row.appendChild(mid);
    rl.appendChild(row);
  }

  /* Armour buys AC and costs silence. Show both here, where the
     player is actually choosing between them. */
  const pct = v => `${Math.round(v * 100)}%`;
  const stat = $('combat-stats'); stat.innerHTML = '';
  for (const [label, value, hint] of [
    ['방어',   Game.armourClass(p),              '높을수록 덜 맞는다'],
    ['치명타', pct(Game.critChance(p)),          `피해 ×${Game.critMult(p).toFixed(2)}`],
    ['은신',   pct(Game.stealth(p)),             '잠든 적은 확정 치명타'],
    ['연격',   `×${Game.comboMult().toFixed(2)}`, `현재 ${G.combo}연격 · 최고 ${G.bestCombo}`],
  ]) {
    const row = el('div', 'eqrow');
    row.appendChild(el('span', 'eqlabel', label));
    row.appendChild(el('span', 'eqname', String(value)));
    row.appendChild(el('span', 'eqstat dim', hint));
    stat.appendChild(row);
  }

  const mm = Game.mats();
  const mats = $('mat-list'); mats.innerHTML = '';
  for (const k of ['scrap', 'dust', 'essence']) {
    const row = el('div', 'eqrow');
    row.appendChild(el('span', 'eqlabel', MATS[k].n));
    row.appendChild(el('span', 'eqname' + (mm[k] ? '' : ' dim'), String(mm[k] || 0)));
    row.appendChild(el('span', 'eqstat dim', MATS[k].note));
    mats.appendChild(row);
  }

  const list = $('pack-list'); list.innerHTML = '';
  if (!p.pack.length) list.appendChild(el('p', 'empty', '배낭이 비었다.'));
  /* 광신부터 계율에 걸리는 줄이 **맨 아래로 내려간다**(vowSinks).
     손가락이 기억하는 자리에 그것이 없다. 원래 칸 번호(i)는 그대로
     들고 간다 — 화면의 순서가 바뀌었다고 규칙의 칸이 바뀌면 안 된다. */
  const order = p.pack.map((slot, i) => [slot, i]);
  order.sort((a, b) => (vowSinks(a[0].item) ? 1 : 0) - (vowSinks(b[0].item) ? 1 : 0));
  order.forEach(([slot, i]) => {
    const it = slot.item;
    const row = el('button', 'itemrow');
    const ic = el('canvas', 'icon'); paintIcon(ic, it.spr);
    row.appendChild(ic);
    const mid = el('div', 'imid');
    mid.appendChild(nameEl(it, slot.qty > 1 ? ` ×${slot.qty}` : ''));
    const grade = rarityOf(it);
    mid.appendChild(el('span', 'idesc',
      it.kind === 'weapon' ? `${grade ? `[${RARITY[grade].n}] ` : ''}${WEAPON_TYPES[it.t]?.n || ''} ${it.dice[0]}d${it.dice[1]}${it.hands === 2 ? ' · 양손' : ''}${reqText(it)}${affixBlurb(it)}`
      : it.kind === 'armour' ? `${grade ? `[${RARITY[grade].n}] ` : ''}방어 +${it.ac}${reqText(it)}${affixBlurb(it)}`
      : it.kind === 'quiver' ? `${grade ? `[${RARITY[grade].n}] ` : ''}화살통 · ${quiverLine(it)}${affixBlurb(it)}`
      : it.kind === 'cat' ? `촉매 · ${it.t}`
      : Game.isKnown(it.id) ? (it.desc || '사용 가능') : '마셔 보기 전에는 알 수 없다'));
    /* 설명 줄은 접히는 쪽으로 보낸다 — 접힌 상태에서 남는 것은
       이름과 「이게 나은가」 둘이다. */
    mid.lastChild.classList.add('foldable');
    /* ── 한 줄이 138px 이었다 ──────────────────────────────────
       이름 · 설명 · 강화 · 비교 · 거래 다섯 문장이 한 줄에 쌓여서,
       390×844 한 화면에 무기 **세 개가 안 들어갔다.** 다섯 줄 다
       필요한 정보이긴 한데, **동시에** 필요하지는 않다 — 배낭을
       열었을 때 필요한 것은 「무엇이 있나」이고, 「이게 나은가」는
       하나를 고른 뒤의 질문이다.

       그래서 두 줄로 접는다: 이름과 비교 한 줄. 나머지는 줄을 눌러서
       편다(장착은 오른쪽 버튼이 이미 갖고 있다). 접힌 줄은 50~62px 라
       한 화면에 예닐곱이 들어온다. */
    const more = el('div', 'imore');
    const pt = plusText(it);
    if (pt) more.appendChild(el('span', 'idesc plus', pt));
    /* 「지금 든 것보다」. 배낭은 결정을 내리는 화면인데, 지금까지
       주사위와 속성 이름만 있고 **그래서 이게 나은가**는 없었다.
       2d6과 1d10 중 무엇이 나은지를 사람이 암산하게 두면 그 줄은
       정보가 아니라 장식이다. 규칙이 쓰는 피해식을 그대로 지난다
       (Game.compareToHeld) — 화면이 약속한 값과 손이 내는 값이
       갈릴 수 없다. */
    const cmp = Game.compareToHeld(it);
    if (cmp) {
      const up = cmp.pct > 0, same = cmp.pct === 0;
      mid.appendChild(el('span', 'idesc cmp' + (up ? ' up' : same ? '' : ' down'),
        Game.compareLine(it)));
    }
    /* 그리고 「이걸 어떻게 할까」. 장착이 아닌 쪽의 결정 — 팔 것인가
       부술 것인가 — 는 여태 화면 어디에도 숫자가 없었다. */
    const tl = Game.tradeLine(it);
    if (tl) more.appendChild(el('span', 'idesc trade', tl));
    if (more.childElementCount) {
      mid.appendChild(more);
      const open = el('span', 'idesc unfold', '＋ 더');
      open.onclick = e => { e.stopPropagation();
        const on = mid.classList.toggle('open');
        open.textContent = on ? '－ 접기' : '＋ 더'; };
      mid.appendChild(open);
    }
    row.appendChild(mid);
    row.appendChild(el('span', 'iact',
      it.kind === 'cat' ? '모루에서' : it.kind === 'use' ? '사용' : '장착'));
    // A catalyst is not a thing you use here — it is a thing you
    // throw into a strike at the anvil, so the row only reads.
    if (it.kind === 'cat') row.disabled = true;
    /* ── 못 드는 물건은 **누르기 전에** 말한다 ─────────────────
       규칙 쪽은 거절하면서 이유를 로그에 적는다. 그런데 로그는 누른
       뒤에 읽는 것이고, 이 게임에서 「눌렀는데 아무 일도 안 일어났다」는
       거의 언제나 고장으로 읽힌다. 줄 자체가 미리 말하게 한다.
       판정은 게임의 문(cantHold)을 쓴다 — 여기서 따로 세면 언젠가
       규칙과 화면이 다른 말을 한다. */
    const nope = Game.cantHold(G.player, it);
    if (nope) {
      row.disabled = true;
      row.classList.add('poor');
      row.querySelector('.iact').textContent = '못 듦';
      mid.appendChild(el('span', 'idesc', nope));
    }
    row.onclick = () => {
      if (it.kind === 'cat') return;
      /* ── 계율 앞에서 한 번 막는다 ──────────────────────────
         플레이어가 「어기면 안 되는 것」으로 배우게 하려면 **어기기
         전에** 물어야 한다. 어기고 나서 로그로 알려 주면 그건 벌이지
         가르침이 아니다.

         그리고 이것이 이 게임에서 가장 큰 거짓말이다(§1). 계율을
         어기는 것은 신앙심을 깎고, 신앙심이 낮은 것이 진 엔딩으로
         가는 유일한 길이다. 그런데 이 창은 그것을 재앙처럼 말한다.
         지켜야 한다고 믿을수록 그 자리에 앉게 된다. */
      /* 계율 검사가 **감정 창보다 먼저**다. 처음엔 뒤에 뒀는데, 정체를
         모르는 물약은 감정 창에서 `return` 해 버려서 계율 경고를 통째로
         건너뛰었다 — 진짜 탭으로 재고서야 보였다. */
      const risk = it.kind === 'use' ? Game.vowRisk(vowKindOf(it)) : null;
      const unknown = it.kind === 'use' && !Game.isKnown(it.id);
      const go = () => { Game.useItem(i); renderInventory(); refresh(); };
      if (risk) {
        ask(`${risk.n}이(가) 보고 있다.`,
            `${risk.vow}. 어기면 이 층에서 ${risk.boon.replace(/\.$/, '')} — 그것이 멎는다.`
            + (unknown ? ' 무엇인지도 알 수 없다.' : ''), go);
        return;
      }
      if (unknown) {
        ask(`${Game.lookOf(it.id)}을(를) 쓴다.`,
            '무엇인지 알 수 없습니다. 좋을 수도, 아닐 수도.', go);
        return;
      }
      it.kind === 'use' ? Game.useItem(i) : Game.equip(i);
      renderInventory(); refresh();
    };
    row.oncontextmenu = e => e.preventDefault();

    /* Breaking gear is how junk becomes progress, so the option
       sits on the row itself rather than behind a mode. */
    if (Game.canSalvage(it)) {
      const y = Game.salvagePreview(it);
      const bits = [['scrap','쇳'],['dust','가루'],['essence','정수']]
        .filter(([k]) => y[k]).map(([k, short]) => `${short}${y[k]}`).join(' ');
      const br = el('button', 'slotdel', '분해');
      br.onclick = e => {
        e.stopPropagation();
        ask(`${affixName(it)}을(를) 분해할까요?`,
            bits ? `${bits} 획득 · 되돌릴 수 없습니다.` : '아무것도 나오지 않습니다.',
            () => { Game.salvage(i); renderInventory(); refresh(); });
      };
      row.appendChild(br);
    } else {
      /* 부술 수 없는 것에도 손을 뗄 방법은 있어야 한다. 이름이 붙은
         물건은 가루가 되지 않지만, 바닥에는 내려놓을 수 있다. */
      const dr = el('button', 'slotdel', '버림');
      dr.onclick = e => {
        e.stopPropagation();
        ask(`${Game.nameOf(it)}을(를) 내려놓을까요?`,
            '발밑에 그대로 남습니다. 다시 주울 수 있습니다.',
            () => { Game.dropItem(i); renderInventory(); refresh(); });
      };
      row.appendChild(dr);
    }
    list.appendChild(row);
  });
  $('inv-gold').textContent = p.gold;
}

function paintIcon(canvas, sprName) {
  canvas.width = CELL_SIZE * 3; canvas.height = CELL_SIZE * 3;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(sprite(sprName), 0, 0, canvas.width, canvas.height);
}

/* shop */
function renderShop() {
  const shop = G.shop, p = G.player;
  /* 떠돌이 수레는 층마다 다른 짐을 끌고 온다. 그 짐이 곧 이름이다 —
     「떠돌이 상인」이라고만 쓰면 몇 번째로 만나든 같은 상인이고,
     실제로 재 보니 판을 통틀어 열일곱 품목이 전부 이 한 수레에서
     나왔다. 이름이 바뀌면 재고를 보기 전에 무엇을 실었는지 안다. */
  const load = shop.wander ? Game.wanderLoad() : null;
  $('shop-name').textContent = load ? `${load.n}` : `${shop.id}. ${shop.n}`;
  $('shop-gold').textContent = p.gold;

  const buyList = $('shop-buy'); buyList.innerHTML = '';
  /* Each door says what only it does, right above the shelf.
     Six signs that all read "물약 있음" is the same as no signs. */
  /* 상인이 당신의 번호를 안다. 표에는 굳은 문장을 두고, 세는 말은
     함수로 받는다 — 「23번째」는 판마다 달라야 하는 값이다. */
  const said = [load ? load.line : shop.t,
                shop.line ? shop.line(G.sent || 1) : null].filter(Boolean).join(' ');
  if (said) buyList.appendChild(el('p', 'empty shopline', said));

  /* 오늘 이 수레의 기분. 값이 왜 이런지 말해 주지 않으면 흔들리는
     값은 그냥 버그처럼 읽힌다. 그리고 흥정은 한 번뿐이라 버튼도
     한 번만 산다 — 걸고 나면 결과가 그 자리에 남는다. */
  const mood = Game.shopMood(shop);
  const hag = Game.haggleState();
  const moodBox = el('div', 'shopmood' + (hag?.sour ? ' sour' : hag?.cut < 1 ? ' cut' : ''));
  moodBox.appendChild(el('span', 'moodname', mood.n));
  moodBox.appendChild(el('span', 'moodtag', mood.t));
  /* 그리고 상인이 실제로 하는 말. 규칙 한 줄만 있으면 이 수레는
     값을 매기는 장치이지 사람이 아니다 — 갱구에서 기다리는 쪽의
     사정이 여기 말고는 나올 자리가 없다. */
  if (mood.say) moodBox.appendChild(el('span', 'moodsay', mood.say));
  buyList.appendChild(moodBox);

  if (!hag?.done) {
    const hb = el('button', 'campopt wager haggle');
    const head = el('div', 'camphead');
    head.appendChild(el('span', 'campname', '값을 깎아 본다'));
    head.appendChild(el('span', 'camptag odds', `${Math.round(Game.haggleOdds() * 100)}%`));
    hb.appendChild(head);
    hb.appendChild(el('span', 'campdesc', `되면 이 수레에서 ${Math.round((1 - Game.HAGGLE_CUT) * 100)}% 싸진다.`));
    hb.appendChild(el('span', 'campdesc risk', '실패 — 오늘 이 수레는 아무것도 사 주지 않는다.'));
    hb.onclick = () => { Game.haggle(); renderShop(); refresh(); };
    buyList.appendChild(hb);
  } else if (hag.sour) {
    buyList.appendChild(el('p', 'empty shopline sour', '상인이 등을 돌렸다. 오늘은 팔 수 없다.'));
  } else if (hag.cut < 1) {
    buyList.appendChild(el('p', 'empty shopline cut',
      `깎았다 — ${Math.round((1 - hag.cut) * 100)}% 싸게 산다.`));
  }

  /* The temple sells almost nothing and does one thing, so the
     one thing goes at the top of its shelf rather than below a
     row of flasks. */
  if (shop.temple) {
    const offers = Game.templeOffers();
    if (!offers.length)
      buyList.appendChild(el('p', 'empty', '떼어 낼 것이 없다. 붙은 물건을 들고 오시오.'));
    for (const off of offers) {
      const cost = Game.templeCost(off.item);
      const row = el('button', 'itemrow' + (p.gold < cost ? ' poor' : ''));
      const ic = el('canvas', 'icon'); paintIcon(ic, off.item.spr);
      row.appendChild(ic);
      const mid = el('div', 'imid');
      mid.appendChild(nameEl(off.item));
      mid.appendChild(el('span', 'idesc',
        `${off.where === 'equip' ? '착용 중' : '배낭'} · 붙은 것을 떼어 냅니다${affixBlurb(off.item)}`));
      row.appendChild(mid);
      row.appendChild(el('span', 'iact', `${cost}g`));
      row.onclick = () => {
        if (p.gold < cost) { Game.say('금화가 모자란다.', 'warn'); refresh(); return; }
        ask(`${affixName(off.item)}에서 저주를 떼어 낼까요?`,
            `저주만 떨어집니다. 좋은 속성과 강화는 그대로 남습니다.\n가진 금화 ${p.gold} → ${p.gold - cost}`,
            () => { Game.cleanse(off); renderShop(); refresh(); });
      };
      buyList.appendChild(row);
    }
  }
  for (const item of Game.shopStock(shop)) {
    const cost = Game.priceOf(item, true);
    const row = el('button', 'itemrow' + (p.gold < cost ? ' poor' : ''));
    const ic = el('canvas', 'icon'); paintIcon(ic, item.spr);
    row.appendChild(ic);
    const mid = el('div', 'imid');
    mid.appendChild(nameEl(item));
    mid.appendChild(el('span', 'idesc',
      item.kind === 'weapon' ? `${WEAPON_TYPES[item.t]?.n || ''} ${item.dice[0]}d${item.dice[1]}${item.hands === 2 ? ' · 양손' : ''}`
      : item.kind === 'armour' ? `방어 +${item.ac}`
      : item.kind === 'quiver' ? `화살통 · ${quiverLine(item)}`
      : (item.desc || '')));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', `${cost}g`));
    row.onclick = () => {
      if (p.gold < cost) { Game.say('금화가 모자란다.', 'warn'); refresh(); return; }
      /* 게임 전체가 하다체·명령형인데 결정을 내리는 바로 그 순간에만
         점원 말투가 끼어들고 있었다. 「~하시겠습니까」는 상냥한
         제안이고, 이 창은 되돌릴 수 없는 계약이다. */
      ask(`${affixName(item)}. ${cost}닢.`,
          `가진 것 ${p.gold.toLocaleString()} → ${(p.gold - cost).toLocaleString()}`,
          () => { Game.buy(item); renderShop(); refresh(); });
    };
    buyList.appendChild(row);
  }

  const sellList = $('shop-sell'); sellList.innerHTML = '';
  if (!p.pack.length) sellList.appendChild(el('p', 'empty', '팔 물건이 없다.'));
  p.pack.forEach((slot, i) => {
    const row = el('button', 'itemrow');
    const ic = el('canvas', 'icon'); paintIcon(ic, slot.item.spr);
    row.appendChild(ic);
    const mid = el('div', 'imid');
    mid.appendChild(nameEl(slot.item, slot.qty > 1 ? ` ×${slot.qty}` : ''));
    row.appendChild(mid);
    const gain = Game.priceOf(slot.item, false);
    row.appendChild(el('span', 'iact', `+${gain}g`));
    row.onclick = () => {
      ask(`${affixName(slot.item)}을(를) ${gain}금에 파시겠습니까?`,
          (slot.item.pre || slot.item.suf || slot.item.plus)
            ? '속성이 붙은 물건입니다. 되돌릴 수 없습니다.'
            : `가진 금화 ${p.gold} → ${p.gold + gain}`,
          () => { Game.sell(i); renderShop(); refresh(); });
    };
    sellList.appendChild(row);
  });
}

/* spells */
function renderSpells() {
  const p = G.player;
  const list = $('spell-list'); list.innerHTML = '';
  const arts = Game.artList(p);
  const spells = Game.spellList(p);
  if (!arts.length && !spells.length)
    list.appendChild(el('p', 'empty', '아직 익힌 것이 없다.'));
  /* A class with arts reads its breath here, not its mana — the
     header has to name the resource the buttons below spend, and
     a warrior's page is not called 주문. */
  /* 제목도 그 직업이 쓰는 말로 부른다 — 자원은 하나여도 사제의 쪽은
     기도이고 팔라딘의 쪽은 맹세다. 통을 합치는 것과 말을 뺏는 것은
     다른 일이다. */
  const PAGE = { priest:'기도', paladin:'맹세', rogue:'은신술', ranger:'궁술' };
  const own = PAGE[p.cls] || '무술';
  $('spell-title').textContent = !arts.length ? '주문'
    : (spells.length ? josa(`${own}과(와) 주문`) : own);
  $('spell-chip').firstChild.textContent = arts.length ? '' : '✦ ';

  $('spell-mana').textContent = !arts.length ? `${p.mana}/${p.maxmana}`
    /* 통이 하나이므로 읽는 줄도 하나다. 이름만 직업에서 온다. */
    : (`${poolName(p.cls)} ${p.stam}/${p.maxStam}`)
      + (p.maxmana ? ` · ✦ ${p.mana}/${p.maxmana}` : '');
  for (const a of arts) {
    const row = el('button', 'itemrow artrow' + (p.stam < a.stam ? ' poor' : ''));
    const mid = el('div', 'imid');
    const nm = el('span', 'iname', a.name);
    nm.classList.add('magic');
    mid.appendChild(nm);
    mid.appendChild(el('span', 'idesc', a.desc));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact',
      a.floorOnce ? '층에 한 번'
      : `${a.stam}${poolName(p.cls)}`));
    row.onclick = () => { Game.cast(a.id); setScreen('play'); refresh(); };
    list.appendChild(row);
  }
  for (const s of spells) {
    const cost = Game.spellCost(p, s);
    const plus = p.spellPlus?.[s.id] || 0;
    const aff = SPELL_AFFIXES.find(a => a.id === p.spellAffix?.[s.id]);
    const row = el('button', 'itemrow' + (p.mana < cost ? ' poor' : ''));
    const mid = el('div', 'imid');
    const nm = el('span', 'iname', `${plus ? `+${plus} ` : ''}${aff ? aff.n + ' ' : ''}${s.name}`);
    if (plus || aff) nm.classList.add('magic');
    mid.appendChild(nm);
    mid.appendChild(el('span', 'idesc', s.desc + (aff ? ` · ${aff.note}` : '')));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', `${cost}mp`));
    row.onclick = () => { Game.cast(s.id); setScreen('play'); refresh(); };
    list.appendChild(row);
  }
}

/* ── affix helpers ──────────────────────────────────────── */
const affixOf = (id, table) => table.find(a => a.id === id);

function cursedItem(it) { return isCursed(it); }

/* Every place an item name appears goes through this, so rarity
   reads the same in the pack, the shop and at the fire. */
function shownName(it) {
  return Game.isKnown(it.id) ? affixName(it) : Game.lookOf(it.id);
}

/* ── 자수정 하나가 다섯 뜻이었다 ───────────────────────────
   --P(#9a6ab0)가 등급(유물) · **미감정** · 크랙 · 아르카나 · 저주를
   동시에 뜻하고 있었다. 배낭 한 화면에 「+5 맹독의 별철퇴」(이 판
   최고의 물건)와 「푸른 물약」(마셔 보기 전에는 모른다)이 완전히
   같은 색으로 나란히 섰다.

   축을 나눈다. 자수정은 **등급 하나**에만 남기고, 미감정은 색이
   아니라 **모름**으로 말한다 — 도감이 이미 쓰고 있는 회색이다. */
function nameEl(it, extra) {
  const n = el('span', 'iname', shownName(it) + (extra || ''));
  if (!Game.isKnown(it.id)) { n.classList.add('unknown'); return n; }
  const r = rarityOf(it);
  n.style.color = `var(--${isCursed(it) ? CURSED_TONE : RARITY[r].tone})`;
  if (r >= 2 && !isCursed(it)) n.classList.add('shine');
  if (r === 4) n.classList.add('transcend');
  return n;
}

/* Spell out what an affix actually does. A name like "연쇄의"
   is flavour until the player can read the number behind it. */
const AFFIX_WORDS = {
  dmg: v => `피해 ${v > 0 ? '+' : ''}${v}`,
  dmgPct: v => `피해 ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`,
  hit: v => `명중 ${v > 0 ? '+' : ''}${v}`,
  crit: v => `치명타 +${Math.round(v * 100)}%`,
  critMult: v => `치명 배수 +${v.toFixed(2)}`,
  ac: v => `방어 ${v > 0 ? '+' : ''}${v}`,
  stealth: v => `은신 ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`,
  lifesteal: v => `흡혈 ${Math.round(v * 100)}%`,
  chain: v => `연쇄 ${Math.round(v * 100)}%`,
  burst: v => '처치 시 폭발',
  execute: v => `체력 ${Math.round(v * 100)}% 이하 처형`,
  pierce: v => `방어 관통 ${Math.round(v * 100)}%`,
  regen: v => `재생 ${v > 0 ? '+' : ''}${v}`,
  lightR: v => `시야 +${v}`,
  maxhpPct: v => `최대 체력 +${Math.round(v * 100)}%`,
  manaPct: v => `최대 마나 +${Math.round(v * 100)}%`,
  manaFlat: v => `최대 마나 ${v > 0 ? '+' : ''}${v}`,
  spellPow: v => `주문 위력 +${Math.round(v * 100)}%`,
  dawn: v => `층에 들어설 때 체력 +${Math.round(v * 100)}%`,
  on: v => `타격 시 ${AILMENTS[v]?.n || v}`,
  resist: () => '상태이상 면역',
};

function affixText(a) {
  if (!a) return '';
  return Object.entries(a)
    .filter(([k]) => AFFIX_WORDS[k])
    .map(([k, v]) => AFFIX_WORDS[k](v))
    .join(' · ');
}

function affixBlurb(it) {
  const parts = [affixText(affixOf(it.pre, PREFIXES)), affixText(affixOf(it.suf, SUFFIXES))]
    .filter(Boolean);
  /* What *these* hands do with it, before it is picked up. A fit
     that only reveals itself after equipping would be a trap
     rather than a decision — and the bad ones especially have to
     be readable from the floor. */
  for (const f of Game.fitsOf(G.player, it).slice().reverse())
    parts.unshift(`${f.good ? '✦' : '✕'} ${f.n} — ${f.t}`);
  /* An oddity is only ever mentioned when it is awake. Naming a
     sleeping one would turn "keep the wrong thing and find out"
     into a checklist. */
  const odd = Game.oddityOf(G.player, it);
  if (odd) parts.unshift(`❉ ${odd.n} — ${odd.t}`);
  // A named weapon leads with its rule; the name is the affix.
  if (it.unique) {
    /* 크랙은 이 물건이 다른 장비와 다른 이유 그 자체인데, 표에만
       적혀 있고 화면에 한 번도 안 나왔다. 규칙 위에 올린다. */
    if (it.crackN) parts.unshift(`✧ ${it.crack} ${it.crackN} — ${it.crackT.replace(/\*\*/g, '')}`);
    parts.unshift(it.rule);
  }
  // Rules first, numbers after: the 은총 and the engravings change
  // what the item does, the affixes only change how much.
  for (const id of [...(it.engrave || [])].reverse())
    parts.unshift(engraveById(id)?.t);
  if (it.boon) parts.unshift(boonById(it.boon)?.t);
  return parts.length ? ' · ' + parts.filter(Boolean).join(' · ') : '';
}

/* What the + on this item is actually worth, in the same numbers
   the combat code uses. "+6" told the player nothing; "+6 — 피해
   +12, 명중 +9" tells them what the next strike at the anvil is
   買ing, and what a failure would cost them.

   Also names the next milestone, because the whole reason to
   push past +3 is the engraving waiting at +4. */
/* What this piece asks of your arms, if it asks anything. */
/* A quiver has no armour value and no dice of its own — it is a
   multiplier on someone else's roll, so it needs its own line
   rather than borrowing the armour one. */
function quiverLine(it) {
  const bits = [];
  if (it.dmg && it.dmg !== 1) bits.push(`피해 ${it.dmg > 1 ? '+' : '−'}${Math.round(Math.abs(it.dmg - 1) * 100)}%`);
  if (it.hit) bits.push(`명중 ${it.hit > 0 ? '+' : '−'}${Math.abs(it.hit)}`);
  if (it.rng) bits.push(`사거리 +${it.rng}`);
  if (it.on === 'poison') bits.push('중독');
  if (it.burst) bits.push('죽은 자리가 터진다');
  if (it.bleed) bits.push('맞은 것이 느려진다');
  return bits.join(' · ') || '평범한 화살';
}

function reqText(it) {
  const need = it.hands === 2 ? 15
             : it.kind === 'weapon' && (it.dice?.[1] || 0) >= 8 ? 12
             : it.kind === 'armour' && (it.ac || 0) >= 16 ? 15
             : it.kind === 'armour' && (it.ac || 0) >= 12 ? 12 : 0;
  if (!need) return '';
  const have = Game.effStats(G.player).str;
  return have < need ? ` · 힘 ${need} 필요(현재 ${have})` : ` · 힘 ${need}`;
}

function plusText(it) {
  if (!it || (it.kind !== 'weapon' && it.kind !== 'armour')) return '';
  const plus = it.plus || 0;
  const bits = [];
  if (plus) {
    bits.push(it.kind === 'weapon'
      ? `+${plus} — 피해 +${plus * 2} · 명중 +${(plus * 1.5).toFixed(1).replace(/\.0$/, '')}`
      : `+${plus} — 방어 +${plus * 2}`);
  }
  const next = ENGRAVE_AT.find(n => n > plus);
  const have = (it.engrave || []).length;
  if (next) bits.push(`+${next}에서 각인 ${have + 1}번째`);
  else if (have) bits.push('각인 자리를 다 썼다');
  return bits.join(' · ');
}

/* ── the fire ───────────────────────────────────────────── */
let campMode = null;   // null | 'upgrade' | 'enchant'

export function renderCamp() {
  const p = G.player;
  $('camp-depth').textContent = `${G.depth}층`;

  const wrap = $('camp-choices');
  wrap.innerHTML = '';
  $('camp-targets').hidden = true;
  wrap.hidden = false;

  const heal = Math.min(p.maxhp - p.hp, Math.ceil(p.maxhp * Game.CAMP_HEAL));
  const m = Game.mats();
  $('camp-lead').textContent =
    `불은 한 번만 쓸 수 있다. 쇠를 두들기는 일은 모루에서. ` +
    `◍${p.gold} · ${MATS.scrap.n} ${m.scrap} · ` +
    `${MATS.dust.n} ${m.dust} · ${MATS.essence.n} ${m.essence}`;

  /* 불은 한 번만 쓸 수 있고, 이제 셋 중 하나만 준다. 세 줄을 나란히
     놓는 이유가 그것이다 — 고르지 않은 둘이 무엇이었는지가 화면에
     남아야 「포기했다」가 된다. 어두운 채로 성한 몸으로 갈 것인가,
     밝은 채로 상한 몸으로 갈 것인가. */
  const wound = p.wound || 0;
  const oilRoom = Math.max(0, Game.oilCap() - p.lightTurns);
  const searCost = Math.min(p.lightTurns, Game.WOUND_OIL);
  const searBurn = Math.max(1, Math.round(p.maxhp * Game.CAMP_SEAR_HP));
  const options = [
    { id:'wick', n:'심지를 갈다', desc:
        `기름 +${Math.min(oilRoom, Game.CAMP_OIL)} · 다음 층을 볼 수 있다`,
      tag: p.lightTurns < 200 ? '곧 꺼진다' : `기름 ${p.lightTurns}` },
    { id:'sear', n:'지지다', desc:
        wound
          ? `상처 ${Math.round(wound * (searCost / Game.WOUND_OIL))} 닫힘 · 기름 −${searCost} · 체력 −${searBurn}`
          : '닫을 상처가 없다',
      tag: wound ? (searCost >= Game.WOUND_OIL ? '전부' : '절반') : '—',
      poor: !wound },
    { id:'rest', n:'숨을 돌리다', desc:
        `체력 +${heal} (최대의 ${Math.round(Game.CAMP_HEAL * 100)}%) · 마나 회복 · 모든 상태이상 해제`,
      tag: p.hp < p.maxhp * 0.5 ? '지금은 이게 답일지도' : `${p.hp}/${p.maxhp}` },
  ];

  /* Only offered when there is something to offer. A dead row
     that says "you need two relics" is a row that is dead for
     most of most runs. */

  for (const o of options) {
    const row = el('button', 'campopt' + (o.poor ? ' poor' : ''));
    if (o.poor) row.disabled = true;
    const head = el('div', 'camphead');
    head.appendChild(el('span', 'campname', o.n));
    head.appendChild(el('span', 'camptag', o.tag));
    row.appendChild(head);
    row.appendChild(el('span', 'campdesc', o.desc));
    if (!o.poor) row.onclick = () => {
      if (o.id === 'rest') { Game.campRest(); setScreen('play'); refresh(); return; }
      if (o.id === 'wick') { Game.campWick(); setScreen('play'); refresh(); return; }
      if (o.id === 'sear') {
        /* 지지는 것은 흉터를 지우는 일이다 — 상처를 세는 자의 계율. */
        const risk = Game.vowRisk('mend');
        if (risk) {
          ask(`${risk.n}이(가) 세고 있다.`,
              `${risk.vow}. 어기면 이 층에서 ${risk.boon.replace(/\.$/, '')} — 그것이 멎는다.`,
              () => { Game.campSear(); setScreen('play'); refresh(); });
          return;
        }
        Game.campSear(); setScreen('play'); refresh(); return;
      }
      campMode = o.id;
      renderCampTargets();
    };
    wrap.appendChild(row);
  }

  /* The pile, if there is one. It sits above the other options
     because it is the one that expires — every other choice at
     this fire is still there on the next floor, and this one
     burns the moment you rest. */
  const purse = Game.bankPurse2();
  if (purse) {
    const row = el('button', 'campopt wager');
    const head = el('div', 'camphead');
    const nm = el('span', 'campname', '판돈을 챙긴다');
    nm.style.color = 'var(--y)';
    head.appendChild(nm);
    head.appendChild(el('span', 'camptag', `${purse.floors}층 연속`));
    row.appendChild(head);
    row.appendChild(el('span', 'campdesc',
      `금화 ${purse.gold} · 쇳조각 ${purse.scrap} · 가루 ${purse.dust}` +
      (purse.essence ? ` · 정수 ${purse.essence}` : '') +
      ' — 불을 쓰고 판돈은 사라진다.'));
    row.onclick = () => { Game.campCash(); setScreen('play'); refresh(); };
    wrap.appendChild(row);

    const note = el('p', 'note');
    note.textContent = '한 층 더 내려가면 판돈은 더 불어난다. 죽으면 전부 잃는다.';
    wrap.appendChild(note);
  }

  /* Walking away has to be on the menu. Arriving at full health
     with no materials used to leave "waste the fire on a rest you
     do not need" as the only exit, which reads as being trapped —
     and is, in every way that matters. */
  const out = el('button', 'mini');
  out.textContent = '불을 남겨두고 물러난다';
  out.style.marginTop = '12px';
  out.onclick = () => { Game.leaveCamp(); setScreen('play'); refresh(); };
  wrap.appendChild(out);
}

/* 과감 or 신중. Sticky within a run: a player who has decided
   they are the careful sort should not have to say so at every
   anvil. */
let campCareful = false;

/* The fire now offers rest, the wager and fusion — nothing that
   touches metal. So this is only ever the fusion path. */
/* 모닥불의 융합 화면은 없어졌다 — 융합은 모루로 갔다(index.html 참고).
   이 자리는 남겨 둔다: 모닥불이 다시 무언가를 「고른 뒤에 대상을
   고르는」 일을 갖게 되면 여기로 돌아온다. */
function renderCampTargets() {
  $('camp-choices').hidden = true;
  $('camp-targets').hidden = false;
}

/* ── the anvil ──────────────────────────────────────────────
   Three actions, all paid for in materials, none of them
   spending the place. Standing here with 4000 gold is supposed
   to be a decision about how much of it you are willing to lose
   before you walk away, which is a decision the fire could never
   host because the fire only ever gave you one strike.

   Catalysts sit above the target list rather than inside it:
   what you throw in changes the rules of *every* row, so it has
   to be chosen before you pick a target, not after. */
let anvilMode = 'upgrade';
let anvilCat = null;

export function renderAnvil() {
  const p = G.player;
  $('anvil-depth').textContent = G.depth ? `${G.depth}층` : '갱구';
  const m = Game.mats();
  $('anvil-lead').textContent =
    `모루는 닳지 않는다. 재료가 남아 있는 만큼 두들길 수 있다. ` +
    `◍${p.gold} · ${MATS.scrap.n} ${m.scrap} · ${MATS.dust.n} ${m.dust} · ` +
    `${MATS.essence.n} ${m.essence}`;

  for (const b of $('anvil-mode').children) {
    const on = b.dataset.mode === anvilMode;
    b.className = on ? 'on' : '';
    b.onclick = () => { anvilMode = b.dataset.mode; anvilCat = null; renderAnvil(); };
  }

  const sw = $('anvil-style');
  sw.hidden = anvilMode !== 'upgrade';
  for (const b of sw.children) {
    const careful = b.dataset.style === 'careful';
    b.className = careful === campCareful ? 'on' : '';
    b.onclick = () => { campCareful = careful; renderAnvil(); };
  }

  $('anvil-note').textContent =
    anvilMode === 'enchant'
      ? `무작위 속성을 건다. 이미 붙은 것이 많을수록 저주가 잦다 — ` +
        `${Math.round(ENCHANT_CURSE * 100)}% / ${Math.round((ENCHANT_CURSE + ENCHANT_CURSE_STEP) * 100)}% / ` +
        `${Math.round((ENCHANT_CURSE + ENCHANT_CURSE_STEP * 2) * 100)}%. ${Game.costText(Game.anvilCost(ENCHANT_COST))}`
      : anvilMode === 'reroll'
      ? `이미 붙은 속성을 다시 굴린다. 저주는 절대 붙지 않는다. ${Game.costText(Game.anvilCost(REROLL_COST))}`
      : anvilMode === 'refine'
      ? `마지막에 돋은 각인을 지져 없앤다. 자리는 남고, 그 자리에서 다시 돋는다 — 무엇이 돋을지는 쇠가 정한다. ${Game.costText(Game.anvilCost(REFINE_COST))}`
      : anvilMode === 'attune'
      ? `유물에게 정수를 먹인다. 한 번에 한 단계, 유물마다 ${ATTUNE_MAX}번까지. ${Game.costText(Game.anvilCost(ATTUNE_COST))}`
      : campCareful
      ? `값은 ${CAREFUL_MULT}배. 성공률 +${Math.round(CAREFUL_BONUS * 100)}%p, 실패해도 깎이거나 부서지지 않는다.`
      : `값은 그대로. ${Math.round(UPGRADE_CRIT * 100)}% 확률로 두 단계가 오른다 — 대신 실패하면 깎이고, 깊은 +에서는 부서진다.`;

  /* 융합은 두들기는 일이 아니라 넣는 일이라, 촉매도 대상 목록도
     안 쓴다. 화면을 통째로 바꿔 준다. */
  const fusing = anvilMode === 'fuse';
  $('anvil-list').hidden = fusing;
  $('anvil-list-head').hidden = fusing;
  $('anvil-cat-head').hidden = fusing || $('anvil-cat-head').hidden;
  $('fuse-box').hidden = !fusing;
  if (fusing) {
    $('anvil-list-head').textContent = '무엇과 무엇을 넣을까';
    $('anvil-note').textContent = Game.canFuse()
      ? `유물 둘을 불에 넣는다. 대부분은 도박이지만 서로를 알아보는 짝이 여섯 있다. ${Game.costText(FUSE_COST)}`
      : '유물이 둘은 있어야 한다.';
    teach('fuse');
    renderFuse();
    return;
  }
  /* 조율은 장비가 아니라 유물을 다룬다 — 촉매도 강화 방식도 안 쓴다. */
  if (anvilMode === 'attune') {
    $('anvil-list-head').textContent = '무엇에게 먹일까';
    $('anvil-cat-head').hidden = true; $('anvil-cats').hidden = true;
    renderAttune();
    return;
  }
  renderCatalysts();
  renderAnvilTargets();
}

/* 정수가 갈 두 번째 곳. 유물의 수치는 판이 시작할 때 정해져서 끝까지
   그대로였다 — 크랙이 「무엇을 하는가」를 바꾼다면 먹이는 것은
   「얼마나」를 바꾼다. 둘 다 그 유물을 밀고 가기로 한 판에서만 의미가
   있다. 「조율」이 아니라 「먹이기」인 이유는 game.js 쪽에 적어 뒀다. */
function renderAttune() {
  const list = $('anvil-list');
  list.innerHTML = '';
  /* 받아먹는 것만 올린다. 처음에는 든 유물 전부를 올렸는데, 실측하니
     40개 중 40개가 먹여도 아무 숫자도 안 움직였다 — 규칙이 v를 읽는
     유물이 몇 개뿐이었기 때문이다. 그리고 둘(메아리·진군)은 v가
     연격 문턱이라 먹이면 나빠졌다. */
  const held = Game.relicList().filter(r => Game.feedable(r.id));
  const all = Game.relicList();
  if (!held.length) {
    list.appendChild(el('p', 'empty', all.length
      ? '든 유물 중 받아먹는 것이 없다. 되돌리고 · 태우고 · 재는 것들이 먹는다.'
      : '먹일 유물이 없다.'));
    return;
  }
  const poor = !Game.canAfford(Game.anvilCost(ATTUNE_COST));
  for (const r of held) {
    const left = Game.attuneLeft(r.id);
    const row = el('button', 'itemrow');
    const ic = el('canvas', 'icon'); paintIcon(ic, r.spr); row.appendChild(ic);
    const mid = el('div', 'imid');
    mid.appendChild(el('span', 'iname magic', r.n));
    mid.appendChild(el('span', 'idesc', r.t));
    const now = r.v + (G.player.tuned?.[r.id] || 0);
    mid.appendChild(el('span', 'idesc plus',
      left > 0 ? `${trim(now)} → ${trim(now + Game.attuneStep(r))} · ${left}번 더 먹는다`
               : '더 안 먹는다'));
    row.appendChild(mid);
    const blocked = poor || left <= 0;
    row.appendChild(el('span', 'iact', left <= 0 ? '—' : poor ? '재료 부족' : '먹인다'));
    if (blocked) { row.classList.add('poor'); row.disabled = true; }
    else row.onclick = () => { Game.attuneRelic(r.id); renderAnvil(); refresh(); };
    list.appendChild(row);
  }
}
/* 유물의 수치는 비율이기도 하고 개수이기도 하다. 0.35는 0.35로,
   6은 6으로 읽혀야 한다. */
const trim = v => (Math.abs(v) < 1.5 ? v.toFixed(2).replace(/\.?0+$/, '') : String(Math.round(v)));

function renderCatalysts() {
  const on = anvilMode === 'upgrade' ? 'upgrade' : 'enchant';
  const held = Game.catalystsHeld(on);
  const box = $('anvil-cats'); box.innerHTML = '';
  $('anvil-cat-head').hidden = !held.length;
  box.hidden = !held.length;
  if (!held.length) { anvilCat = null; return; }
  if (anvilCat && !held.some(c => c.id === anvilCat)) anvilCat = null;

  for (const c of held) {
    const row = el('button', 'itemrow relicrow' + (anvilCat === c.id ? ' chosen' : ''));
    const ic = el('canvas', 'icon'); paintIcon(ic, c.spr); row.appendChild(ic);
    const mid = el('div', 'imid');
    const nm = el('span', 'iname', c.n);
    nm.style.color = 'var(--o)';
    mid.appendChild(nm);
    mid.appendChild(el('span', 'idesc', c.t));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', anvilCat === c.id ? '넣음' : `×${c.qty}`));
    row.onclick = () => { anvilCat = anvilCat === c.id ? null : c.id; renderAnvil(); };
    box.appendChild(row);
  }
}

/* 강화 줄 하나. renderAnvilTargets 밖에 두는 이유는 매듭 린트가
   이 커밋에서 그 함수를 복잡도 30 위로 밀어 올렸다고 잡았기 때문이고,
   실제로 여기 있는 것은 「강화의 판돈을 어떻게 적는가」 하나뿐이라
   나머지 모드와 섞여 있을 이유가 없었다. */
function upgradeRow(t, mid) {
  const cost = Game.upgradeCostFor(t.key, campCareful);
  const bet = Game.upgradeOddsFor(t.key, campCareful, anvilCat);
  /* 판돈은 전부 적는다. 저주가 판돈에 들어왔는데 화면이 그걸 안
     말하면, 그건 도박이 아니라 함정이다. */
  const risk = bet.breakPct ? `실패 시 −1 또는 ${Math.round(bet.breakPct * 100)}% 파괴`
             : bet.down     ? '실패 시 −1'
             : '실패해도 손해는 값뿐';
  const line = el('span', 'idesc bet',
    `+${t.plus} → +${t.plus + (bet.crit >= 1 ? 2 : 1)} · ${risk}`
    + (bet.hexPct ? ` · ${Math.round(bet.hexPct * 100)}% 저주` : '')
    + ` · ${Game.costText(cost)}`);
  if (bet.breakPct || bet.hexPct) line.classList.add('danger');
  mid.appendChild(line);
  /* The milestone gets its own line and its own colour. It is the
     only strike where success changes what the item *is*, and the
     odds are visibly worse for exactly that. */
  if (bet.milestone)
    mid.appendChild(el('span', 'idesc mark',
      `이 한 방에 각인이 새겨진다 — 그래서 성공률이 `
      + `${Math.round(ENGRAVE_PENALTY * 100)}%p 낮다.`));
  return { blocked: !Game.canAfford(cost), label: `${Math.round(bet.odds * 100)}%` };
}

function renderAnvilTargets() {
  const list = $('anvil-list');
  list.innerHTML = '';
  for (const t of Game.campTargets()) {
    const row = el('button', 'itemrow');
    if (t.item) { const ic = el('canvas', 'icon'); paintIcon(ic, t.item.spr); row.appendChild(ic); }
    const mid = el('div', 'imid');
    const nm = el('span', 'iname', t.name);
    if (t.item) {
      const r = rarityOf(t.item);
      nm.style.color = `var(--${isCursed(t.item) ? CURSED_TONE : RARITY[r].tone})`;
      if (r === 4) nm.classList.add('transcend');
    } else nm.classList.add('magic');
    mid.appendChild(nm);
    mid.appendChild(el('span', 'idesc',
      t.kind === 'spell' ? '주문'
      : t.item.kind === 'weapon' ? `피해 ${t.item.dice[0]}d${t.item.dice[1]}${affixBlurb(t.item)}`
      : `방어 +${t.item.ac}${affixBlurb(t.item)}`));
    if (t.item) { const pt = plusText(t.item); if (pt) mid.appendChild(el('span', 'idesc plus', pt)); }
    row.appendChild(mid);

    let blocked = false, label = '?';
    /* 왜 안 되는지는 규칙이 안다. 화면이 따로 판정하면 둘이 갈리고,
       실제로 갈려 있었다 — 화면은 이름 붙은 물건에 「최대 +8」이라고
       적었고(+0인 물건에 대고), 규칙은 그걸 벼려 주고 있었다. */
    const why = t.block?.[anvilMode] || null;
    if (why) {
      mid.appendChild(el('span', 'idesc', why));
      row.appendChild(el('span', 'iact', '—'));
      row.classList.add('poor'); row.disabled = true;
      list.appendChild(row);
      continue;
    }
    if (anvilMode === 'upgrade') {
      ({ blocked, label } = upgradeRow(t, mid));
    } else if (anvilMode === 'reroll') {
      blocked = !Game.canAfford(Game.anvilCost(REROLL_COST));
      label = blocked ? '재료 부족' : '속성 다시';
    } else if (anvilMode === 'refine') {
      blocked = !Game.canAfford(Game.anvilCost(REFINE_COST));
      label = blocked ? '재료 부족' : '각인 지우기';
      const last = t.item?.engrave?.[t.item.engrave.length - 1];
      if (last) mid.appendChild(el('span', 'idesc mark',
        `${engraveById(last)?.n}이(가) 돋은 자리를 지진다 — 그 자리에서 다시 돋는다.`));
    } else {
      blocked = !Game.canAfford(Game.anvilCost(ENCHANT_COST));
      label = blocked ? '재료 부족' : '인챈트';
    }
    if (blocked) { row.classList.add('poor'); row.disabled = true; }
    row.appendChild(el('span', 'iact', label));

    if (!blocked) row.onclick = () => {
      /* 되돌릴 수 없는 둘에도 확인을 붙인다 — 강화의 부서짐 확인과
         같은 잣대다. 이름을 갈라 놨어도 오탭은 남는다. */
      if (anvilMode === 'refine') {
        const last = t.item?.engrave?.[t.item.engrave.length - 1];
        ask(`${t.name}의 각인을 지질까?`,
            `${engraveById(last)?.n || '마지막 각인'}이(가) 사라진다. 되돌릴 수 없다.`,
            () => { Game.anvilRefine(t.key); renderAnvil(); refresh(); });
        return;
      }
      if (anvilMode === 'reroll') {
        ask(`${t.name}의 속성을 다시 굴릴까?`,
            '지금 붙어 있는 것이 사라지고 새로 붙는다. 더 나빠질 수도 있다.',
            () => { Game.anvilEnchant(t.key, true, anvilCat);
                    anvilCat = null; renderAnvil(); refresh(); });
        return;
      }
      if (anvilMode !== 'upgrade') {
        Game.anvilEnchant(t.key, false, anvilCat);
        anvilCat = null; renderAnvil(); refresh(); return;
      }
      /* One confirm, and only where it is earned: a strike that
         can take the weapon with it. Everything else goes straight
         through — a Y/N on a 92% strike is just a second tap. */
      const bet = Game.upgradeOddsFor(t.key, campCareful, anvilCat);
      const go = () => { Game.anvilStrike(t.key, campCareful, anvilCat); anvilCat = null; renderAnvil(); refresh(); };
      if (bet.breakPct)
        ask(`${t.name}에 그대로 내리칠까?`,
            `성공 ${Math.round(bet.odds * 100)}% · 실패하면 한 단계 내려가고, ` +
            `그중 ${Math.round(bet.breakPct * 100)}%는 부서진다.`, go);
      else go();
    };
    list.appendChild(row);
  }
}

$('anvil-leave').onclick = () => { anvilCat = null; setScreen('play'); refresh(); };

/* ── fusion ─────────────────────────────────────────────────
   Pick two of the relics you are wearing. The odds for an
   ordinary pair go on the screen as a bar, the same way the
   altar's do — but the six pairs that matter are never named
   here. All the screen will say about them is that the two
   things recognise each other, and it only says that once you
   have already put them side by side.

   Everything you need to find those six is written on the
   relics themselves. 피의 계약 says "무모함과 섞이면 무엇이 되는지
   아무도 모른다"; 무모함의 인장 says "피로 쓴 계약과 함께라면 더
   멀리 간다". Twelve descriptions, six pairs, no list. */
let fusePick = [];

function renderFuse() {
  const box = $('fuse-box');
  box.hidden = false;

  const held = Game.relicList();
  fusePick = fusePick.filter(id => held.some(r => r.id === id));

  const pick = $('fuse-pick'); pick.innerHTML = '';
  for (const r of held) {
    const on = fusePick.includes(r.id);
    const row = el('button', 'itemrow relicrow' + (on ? ' chosen' : ''));
    const ic = el('canvas', 'icon'); paintIcon(ic, r.spr); row.appendChild(ic);
    const mid = el('div', 'imid');
    const nm = el('span', 'iname', r.n);
    nm.style.color = `var(--${r.fused ? 'W' : 'P'})`;
    if (r.fused) nm.classList.add('transcend');
    mid.appendChild(nm);
    mid.appendChild(el('span', 'idesc', r.t));
    const ck = crackRow(r.id); if (ck) mid.appendChild(ck);
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', on ? '넣음' : ''));
    row.onclick = () => {
      if (on) fusePick = fusePick.filter(x => x !== r.id);
      else if (fusePick.length < 2) fusePick.push(r.id);
      else fusePick = [fusePick[1], r.id];   // oldest falls out
      renderFuse();
    };
    pick.appendChild(row);
  }

  const odds = $('fuse-odds'); odds.innerHTML = '';
  for (const o of FUSE_ODDS) {
    const row = el('div', 'oddrow');
    row.appendChild(el('span', 'oddname', o.n));
    const bar = el('div', 'oddbar');
    const fill = el('i');
    fill.style.width = `${o.w}%`;
    fill.style.background = `var(--${o.tone})`;
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el('span', 'oddpct', `${o.w}%`));
    odds.appendChild(row);
  }

  const [a, b] = fusePick;
  const bet = Game.fusePreview(a, b);
  const go = $('fuse-go');
  const poor = !Game.canAfford(FUSE_COST);
  go.disabled = fusePick.length !== 2 || poor;
  /* 잠긴 계단에서 이미 배운 것: 못 누르는 버튼이 누를 수 있는 버튼과
     픽셀 단위로 같으면 그건 고장으로 읽힌다. 실측으로 이 버튼은
     disabled인데 글자색·테두리색이 살아 있는 것과 같았다. 그리고
     **못 하는 일의 확률표를 먼저 보여 주고** 안 되는 이유는 그 위에
     작은 회색으로 놓여 있었다 — 순서가 뒤집혀 있었다. */
  go.classList.toggle('shut', go.disabled);
  go.textContent = fusePick.length !== 2 ? '유물 둘을 고르시오'
                 : poor ? `${Game.costText(FUSE_COST)}가 모자란다`
                 : '불에 넣는다';
  odds.hidden = !Game.canFuse();

  if (fusePick.length !== 2) {
    $('fuse-note').textContent = `둘을 고르시오. ${Game.costText(FUSE_COST)}가 듭니다. 넣은 둘은 돌아오지 않습니다.`;
    odds.style.opacity = '.45';
  } else if (bet?.special) {
    /* The payoff for reading. Named only once you have already
       found it; before that the screen just tells you that you
       have found *something*. */
    odds.style.opacity = '.2';
    $('fuse-note').innerHTML = bet.known
      ? `<b>${relicById(bet.out).n}</b> — 이미 찾아낸 조합입니다. 확률표는 무시됩니다.`
      : '<b>이 둘은 서로를 알아봅니다.</b> 확률표는 무시됩니다. 무엇이 나올지는 넣어 봐야 압니다.';
  } else {
    odds.style.opacity = '1';
    $('fuse-note').textContent = poor
      ? `재료가 모자랍니다 — ${Game.costText(FUSE_COST)}.`
      : `${relicById(a).n} + ${relicById(b).n} — 위 확률로 굴립니다.`;
  }

  go.onclick = () => {
    if (fusePick.length !== 2) return;
    const [x, y] = fusePick;
    fusePick = [];
    Game.fuseRelics(x, y);
    /* 모루는 닳지 않는다 — 융합도 그렇다. 넣고 나서 화면을 닫지 않고
       그 자리에 남는다: 유물이 셋이면 두 번 넣을 수 있어야 하고,
       그 「한 번 더」가 조합을 계획으로 만든다. */
    renderAnvil();
    refresh();
  };
}

$('camp-back').onclick = () => { campMode = null; fusePick = []; renderCamp(); };

/* ── the altar ──────────────────────────────────────────────
   The odds go on the screen as a bar, not as prose. Seeing that
   "재앙" is a visible red sliver next to a fat green one is the
   whole point — you should be able to feel the shape of the bet
   before you read a single number. */
const ODD_CLASS = { '대성공':'great', '성공':'good', '허탕':'none', '재앙':'doom' };

/* ── look at it ───────────────────────────────────────────
   Everything the game knows about a thing, at the moment the
   player wants to know it. A help table is somewhere else; this
   is here, under the thumb, about the specific creature that is
   currently walking towards you.

   Reading is free — no turn passes — because charging a turn
   for information turns "let me check" into "never mind". */
export function inspect(x, y) {
  const L = G.level;
  if (!L || x < 0 || y < 0 || x >= MW || y >= MH) return;
  if (!L.seen[idx(x, y)]) return;

  const m = Game.monsterAt(x, y);
  const it = G.items.find(i => i.x === x && i.y === y);
  const haz = Game.hazardAt(x, y);
  const rows = [];
  let title = '', sub = '';

  if (m && L.vis[idx(x, y)] && !m.disguise) {
    title = m.n;
    sub = m.boss ? '대군주' : m.named ? '이름 있는 것'
        : m.elite?.length ? '정예' : m.thief ? '도둑' : '';
    rows.push(['체력', `${m.hp} / ${m.maxhp}`]);
    rows.push(['공격 · 방어', `${m.atk} · ${m.ac}`]);
    /* 앞선 자가 틀리게 적어 둔 그 한 가지는 여기서 숫자로 새어
       나가면 안 된다. 「문: 부순다」를 두 줄 위에 적어 놓고 아래에서
       「문을 열지 못한다고 전해 들었다」를 보여 주면, 거짓말이
       스스로를 반박한다 — 그러면 남는 것은 긴장이 아니라 오타처럼
       보이는 화면이다. 두 눈으로 보고 나면 그 줄이 돌아온다. */
    const lying = k => hearsayFor(m)?.k === k && !Meta.corrected(m.spr, k);
    rows.push(['속도', lying('speed') ? '적힌 것이 없다'
      : `${(m.spd || 1).toFixed(2)}× ${m.spd > 1 ? '(당신보다 빠름)' : m.spd < 1 ? '(느림)' : ''}`]);
    if (m.rng) rows.push(['사거리', `${m.rng}칸에서 쏜다`]);
    if (AILMENTS[m.on]) rows.push(['맞으면', AILMENTS[m.on].n]);
    if (m.regen && !lying('regen')) rows.push(['재생', `턴마다 ${m.regen}`]);
    if (m.door && !lying('door')) rows.push(['문', m.door === 'smash' ? '부순다' : '연다']);
    if (m.heavy && !lying('heavy')) rows.push(['내리치기', '한 턴 당긴 뒤 2.5배']);
    if (m.casts?.length)
      rows.push(['바닥 공격', m.casts.map(k => PATTERNS[k].n).join(' · ')]);
    if (m.elite?.length) rows.push(['정예 속성', m.elite.join(' · ')]);
    /* Which third of the bar you are in, and what is left. A
       phased fight the player cannot read is just a boss that
       changes its mind. */
    if (m.phases?.length)
      rows.push(['단계', `${(m.phase || 0) + 1} / ${m.phases.length + 1}` +
        ((m.phase || 0) < m.phases.length
          ? ` — 체력 ${Math.round(m.phases[m.phase || 0].at * 100)}%에서 달라진다` : ' — 마지막')]);
    if (m.named && !m.provoked) rows.push(['자리', '이 자리를 지킨다. 건드리지 않으면 따라오지 않는다']);
    /* What enough bodies taught you. The numbers above are what
       the thing *is*; this is what to do about it — and it only
       appears once you have paid for it. */
    const body = Meta.bodies(m.n), need = tellsNeeded(Meta.read());
    // Labelled once. Four rows all saying 버릇 reads like a bug.
    if (body >= need)
      bookLines(m).forEach((l, i) => rows.push([i ? '' : '버릇', l.text,
        l.kind === 'true' ? '' : l.kind]));
    else rows.push(['버릇', `${need}마리를 잡으면 버릇이 보인다 (${body}/${need})`]);
    if (m.intent) {
      const name = INTENT_NAMES.find(([k]) => k === m.intent);
      if (name) rows.push(['다음 턴', name[1]]);
    }
    rows.push(['경험치', `${m.xp}`]);
  } else if (it) {
    title = Game.isKnown(it.id) ? (it.n || '무언가') : Game.lookOf(it.id);
    if (it.kind === 'relic') {
      const r = relicById(it.id);
      title = r?.n || title; sub = '유물';
      if (r) rows.push(['효과', r.t]);
    } else if (it.kind === 'weapon') {
      sub = WEAPON_TYPES[it.t]?.n || '무기';
      rows.push(['피해', `${it.dice[0]}d${it.dice[1]}${it.hands === 2 ? ' · 양손' : ''}`]);
      if (WEAPON_TYPES[it.t]) rows.push(['계열 규칙', WEAPON_TYPES[it.t].t]);
      if (affixBlurb(it)) rows.push(['속성', affixBlurb(it).replace(/^ · /, '')]);
    } else if (it.kind === 'armour') {
      sub = '방어구';
      rows.push(['방어', `+${it.ac}`]);
      if (affixBlurb(it)) rows.push(['속성', affixBlurb(it).replace(/^ · /, '')]);
    } else if (it.kind === 'quiver') {
      sub = '화살통';
      rows.push(['화살', quiverLine(it)]);
      rows.push(['', '활을 들었을 때만 값을 합니다. 떨어지지 않습니다.']);
      if (affixBlurb(it)) rows.push(['속성', affixBlurb(it).replace(/^ · /, '')]);
    } else if (it.kind === 'chest') {
      sub = '상자'; rows.push(['', it.locked ? '잠겨 있다 — 열쇠나 완력이 필요하다' : '열려 있다']);
    } else if (it.kind === 'use') {
      sub = '소모품';
      rows.push(['', Game.isKnown(it.id) ? (it.desc || '') : '마셔 보기 전에는 알 수 없다']);
    } else if (it.kind === 'gold') { sub = '금화'; rows.push(['', `${it.amount}닢`]); }
  } else if (haz) {
    title = PATTERNS[haz.key].n;
    sub = `${haz.owner}의 공격`;
    rows.push(['남은 턴', `${haz.left}`]);
    rows.push(['피해', `${haz.dmg}`]);
    rows.push(['', '표시된 칸에서 나가거나 구르시오. 몬스터도 함께 맞습니다.']);
  } else {
    const tile = L.tiles[idx(x, y)];
    const trap = L.traps.get(idx(x, y));
    /* Furniture answers first: it is the thing standing on the
       tile, and the tile underneath is not what was tapped. */
    const prop = propAt(L, x, y);
    if (prop) {
      title = Game.PROP_NAME[prop.kind];
      sub = '오브젝트 — 부딪치면 상호작용';
      rows.push(['', {
        barrel:'부수면 안에 든 것이 나온다. 가끔 안에 든 것이 이빨을 갖고 있다.',
        well: '깊은 곳이 열리기 전에도 여기 있었다. 물은 아직 맑다. 길어 갈 사람이 없을 뿐이다.',
        stall: '수레 한 대. 여기까지 끌고 와서, 여기서 더 가지 않기로 한 것이다.',
        brazier: prop.lit ? '이미 타고 있다.'
                          : '불을 옮기면 기름이 260턴어치 아껴진다. 대신 주변 일곱 칸이 전부 깨어난다.',
        pillar:'길을 막는다. 부술 수 있지만 소리가 아홉 칸을 건넌다.',
        bones:'셋에 하나는 아래에 무언가가 자고 있다.',
        urn:'다섯에 하나는 터지고 독을 남긴다. 절반쯤은 값어치가 있다.',
      }[prop.kind]]);
      if (prop.kind !== 'brazier' && prop.kind !== 'well') rows.push(['남은 내구', `${prop.hp}`]);
      const box0 = $('look-rows');
      box0.innerHTML = '';
      $('look-name').textContent = title;
      $('look-sub').textContent = sub;
      for (const [k, v, cls] of rows) {
        const row = el('div', 'endrow');
        row.appendChild(el('span', 'endlabel', k));
        row.appendChild(el('span', 'endval' + (cls ? ' ' + cls : ''), v));
        box0.appendChild(row);
      }
      dressAll();
      $('look').hidden = false;
      return;
    }
    const names = { [DOWN]:'내려가는 계단', [UP]:'올라가는 계단', [CAMP]:'모닥불',
                    [ANVIL]:'모루 — 재료가 있는 만큼 두들길 수 있다',
                    [ALTAR]:'제단', [EVENT]:'? 표지', [WATER]:'물', [WEB]:'거미줄',
                    [DOOR]:'닫힌 문', [DOOR_OPEN]:'열린 문', [DOOR_LOCKED]:'잠긴 문',
                    [DOOR_BROKEN]:'부서진 문', [RUBBLE]:'돌무더기' };
    if (trap?.seen) { title = TRAPS[trap.kind].n; sub = '함정'; }
    else if (names[tile]) { title = names[tile]; sub = '지형'; }
    else return;                        // plain floor: nothing to say
  }

  const box = $('look-rows');
  box.innerHTML = '';
  $('look-name').textContent = title;
  $('look-sub').textContent = sub;
  for (const [k, v, cls] of rows) {
    const row = el('div', 'endrow');
    row.appendChild(el('span', 'endlabel', k));
    row.appendChild(el('span', 'endval' + (cls ? ' ' + cls : ''), v));
    box.appendChild(row);
  }
  dressAll();
  $('look').hidden = false;
}

/* ── the first five minutes ───────────────────────────────
   Fifteen interlocking systems and, until now, one way to learn
   them: a help screen with twelve tables that a new player has
   no reason to open. This is the other way — one line, at the
   moment the thing first happens, and never again.

   Deliberately not a tutorial *level*. Scripting the first
   floor would mean the first floor is not the game; teaching at
   the point of contact means the first floor is the game and
   the game explains itself while you play it.

   Each prompt fires once per *player*, not per run, because the
   second run should be silent. The ledger already knows whether
   this is someone's first time. */
const LESSONS = [
  { id:'move',   t:'방향을 <b>꾹 누르면</b> 계속 걷습니다. 가본 곳을 <b>탭하면</b> 거기까지 걸어갑니다.' },
  /* 갱구에서만 뜬다. 「여기가 마지막 가게다」를 아무도 말해 주지 않아서
     처음 하는 사람은 250닢을 그대로 들고 1층에 들어간다. */
  { id:'town',   t:'여기가 <b>마지막 가게</b>입니다. 아래에는 상인이 드물고, <b>올라오는 길은 없습니다</b>.<br>' +
                    '금화를 두고 갈 이유가 없습니다 — 회복 물약과 <b>기름</b>부터 챙기세요.<br>' +
                    '준비가 되면 <b>빛나는 구멍</b> 위에 서서 아래 버튼을 누릅니다.' },
  { id:'fight',  t:'적에게 <b>부딪치면</b> 공격입니다. 잠든 적(z)을 치면 <b>무조건 치명타</b>입니다 — 돌아가서라도 먼저 치세요.' },
  { id:'intent', t:'깨어난 적은 머리 위에 <b>다음 턴에 할 일</b>을 겁니다. 도움말의 그림표에 전부 있습니다.' },
  { id:'heavy',  t:'<b>붉은 별</b>은 다음 턴에 2.5배로 내리친다는 뜻입니다.<br>' +
                    '<b>같은 방향을 빠르게 두 번</b> 누르면 두 칸 굴러 피합니다(기력 2).' },
  { id:'ground', t:'바닥이 칠해지고 숫자가 뜨면 <b>그 칸이 곧 맞습니다.</b> 숫자는 남은 턴 수입니다. 나가거나 구르세요.' },
  /* 이 게임의 난이도 곡선을 실제로 만드는 장치인데, 지금까지 화면에
     한 글자도 없었다. 플레이어가 겪는 것은 「막대가 꽉 찼으니 한 대 더
     맞아도 되겠지」 → 두 대에 죽음 → 「방금 만피였는데?」다. 갱구에서
     항아리 확률을 가르치던 카드 한 장을 여기로 옮긴 셈이다 — 판을
     실제로 죽이는 쪽에. */
  { id:'wound',  t:'큰 한 방은 <b>견딜 수 있는 몸 자체</b>를 깎습니다.<br>' +
                    'HP 막대 오른쪽 끝의 <b>빗금 친 회색</b>이 영영 잃은 몫입니다 — ' +
                    '체력을 다 채워도 그만큼은 안 돌아옵니다.<br>' +
                    '닫을 수 있는 곳은 <b>모닥불</b>뿐입니다.' },
  /* 이 카드가 없어진 기능을 가르치고 있었다 — 융합은 모루로 갔고
     모닥불의 일은 셋으로 바뀌었는데 카드는 옛 화면을 설명했다.
     카드가 없는 것보다 나쁘다: 배운 대로 갔는데 그 선택지가 없으면
     사람은 자기가 뭘 잘못했다고 생각한다. */
  { id:'fire',   t:'모닥불은 <b>한 번만</b> 씁니다 — 심지를 갈거나 · 지지거나 · 숨을 돌리거나, <b>셋 중 하나</b>.<br>' +
                    '벼리고 물들이고 융합하는 일은 전부 <b>모루</b>에서 하고, 모루는 닳지 않습니다.' },
  { id:'fork',   t:'계단이 갈라지면 <b>주는 것과 가져가는 것이 전부 적혀 있습니다.</b> 평범한 계단은 항상 있습니다.' },
  { id:'relic',  t:'<b>유물</b>은 숫자가 아니라 규칙을 바꿉니다. 자리는 4칸에서 시작해 7칸까지 늘어납니다.<br>' +
                    '유물마다 <b>잠긴 두 번째 줄</b>이 있습니다. 그 유물을 쓴 만큼 열립니다 — ' +
                    '위의 <b>유물 칩</b>이 지금 무엇을 세고 있는지 말해 줍니다.' },
  /* 막대가 반쯤 찼을 때가 가르칠 때다. 주운 순간에 가르치면 아직
     아무것도 안 세고 있어서 할 말이 없다. */
  { id:'crack',  t:'유물 하나가 <b>반쯤 찼습니다.</b> 크랙은 그 유물이 하는 일과 같은 것을 셉니다 — ' +
                    '거울 방패는 맞은 수를, 저울추는 재운 수를.<br>' +
                    '<b>①</b> 컨셉을 끝까지 밉니다 · <b>②</b> 그 유물이 치르던 값을 지웁니다 · ' +
                    '<b>③</b> 게임이 가르친 규칙 하나를 부숩니다.' },
  { id:'cart',   t:'이 상인은 층마다 <b>다른 짐</b>을 끌고 옵니다 — 심지 · 약 · 종이 · 쇠 · 재 · 이상한 수레.<br>' +
                    '파는 것도 부르는 값도 다릅니다. <b>지도의 간판</b>이 오늘 무엇을 싣고 왔는지 말해 줍니다.' },
  { id:'clock',  t:'층마다 <b>여유 턴</b>이 있습니다. 다 쓰면 몬스터가 계속 나타납니다 — 그때는 정리를 포기하고 계단으로.' },
  { id:'bank',   t:'쉬지 않고 내려갈수록 <b>판돈</b>이 불어납니다. 모닥불에서 챙길 수 있고, <b>죽으면 전부 잃습니다.</b>' },
  { id:'oil',    t:'기름이 줄면 <b>보이는 반경이 좁아집니다.</b> 횃불을 쓰거나, 좁은 시야로 싸우거나.' },
  { id:'dark',   t:'방금 <b>붉은 예고가 뜨지 않았습니다.</b> 고장이 아닙니다 — 불이 꺼져 있으면 ' +
                    '멀리 있는 것이 무엇을 준비하는지 <b>보이지 않습니다.</b><br>' +
                    '붙어 있는 것과 <b>밝은 방 안</b>은 그대로 보입니다. 그 밖은 어둠 속에서 팔이 올라갑니다 — ' +
                    '그리고 그 한 방은 <b>보통의 두 배 반</b>입니다.' },
  { id:'prop',   t:'방 안의 통 · 화로 · 기둥 · 뼈 무더기 · 항아리는 <b>부딪치면</b> 상호작용합니다.<br>' +
                    '화로는 <b>기름을 아껴 주지만 주변을 깨웁니다.</b> 항아리는 다섯에 하나가 터집니다. ' +
                    '<b>탭해서 살펴보면</b> 확률이 적혀 있습니다.' },
  { id:'thief',  t:'<b>금빛 도둑</b>은 보자마자 달아납니다. 걸어서는 절대 못 잡습니다 — 구르거나 주문을 쓰거나, 보내주거나.' },
  /* 단축키 이야기를 뺐다. 이 게임이 만들어진 기기에는 숫자키가 없다. */
  { id:'cast',   t:'주문과 기술은 <b>아래 줄의 아이콘을 눌러</b> 바로 씁니다.<br>' +
                    '어두운 칸은 아직 못 배웠거나, 마나가 모자라거나, <b>쏠 대상이 없다</b>는 뜻입니다.' },
  { id:'fuse',   t:'유물 <b>둘</b>을 불에 넣으면 하나가 나옵니다 — 보통은 확률표대로.<br>' +
                    '하지만 <b>서로를 알아보는 짝</b>이 여섯 있습니다. 목록은 없습니다. ' +
                    '<b>유물 설명의 마지막 문장</b>이 짝을 가리킵니다.' },
  { id:'cling',  t:'<b>붙어 있는 것에서 물러나면 그만큼 따라붙습니다.</b> 걸어서 떨어뜨릴 수 있는 것이 아닙니다.<br>' +
                    '떼어내려면 <b>구르거나</b>(구르는 동안은 따라붙지 않습니다), 문을 닫거나, 연막을 쓰거나 — 아니면 싸워서 끝내야 합니다.' },
  { id:'task',   t:'이 층에는 <b>과업</b>이 걸려 있습니다 — 층마다 걸리지는 않습니다.<br>' +
                    '계단이 잠겼다면 <b>열쇠를 문 것</b>이 이 층 어딘가에 있습니다. 머리 위에 열쇠가 붙어 있습니다.<br>' +
                    '잡지 못해도 됩니다 — <b>자물쇠는 시간이 지나면 삭습니다.</b> 두드릴 때마다 한 턴이 탑니다.' },
  { id:'anvil',  t:'<b>모루는 닳지 않습니다.</b> 재료가 남아 있는 만큼 계속 두들길 수 있습니다 — ' +
                    '여기서 전 재산을 태울 수도, 확실히 강해질 수도 있습니다.<br>' +
                    '강화는 <b>+2부터 실패합니다.</b> <b>과감</b>은 가끔 두 단계, 깊은 +에서는 <b>부서집니다.</b> ' +
                    '<b>신중</b>은 값 두 배에 잃는 것은 값뿐. <b>촉매</b>를 함께 넣으면 규칙이 바뀝니다.' },
];

let lessonQueue = [];
let teaching = false;

export function teach(id) {
  if (!Meta.isNewcomer()) return;
  if (Meta.seen('taught', id)) return;
  Meta.see('taught', id);
  const l = LESSONS.find(x => x.id === id);
  if (!l) return;
  lessonQueue.push(l);
  if (!teaching) showLesson();
}

function showLesson() {
  const l = lessonQueue.shift();
  if (!l) { teaching = false; return; }
  teaching = true;
  dressAll();
  $('lesson-text').innerHTML = l.t;
  $('lesson').hidden = false;
  swipeAway($('lesson'), closeLesson);
}

function closeLesson() {
  $('lesson').hidden = true;
  if (lessonQueue.length) showLesson(); else teaching = false;
}

/* Read once per frame from the loop: the rules layer sets flags
   on G and never has to know a teaching system exists. */
export /* 순서가 곧 대기줄이다. 그리고 그 줄이 뒤집혀 있었다 — 처음 켠
   사람이 보는 첫 카드가 「주문은 아래 줄 아이콘… (단축키 1~5)」였다.
   전사로, 터치 화면에서, 한 걸음도 걷기 전에.

   원인 둘. 하나는 걷기 수업이 `G.depth > 0` 뒤에 숨어 있어서 갱구
   내내 안 나온다는 것 — 그런데 처음 하는 사람의 첫 화면이 갱구다.
   다른 하나는 주문 수업이 싸움보다 먼저 놓여 있고, 기본 직업인 전사가
   1레벨에 밀침을 가지고 있다는 것.

   걷기가 먼저다. 그리고 갱구에서는 갱구 이야기를 한다 — 여기가 마지막
   가게라는 것을 아무도 말해 주지 않아서, 처음 하는 사람은 지갑을 그대로
   들고 1층에 들어간다. 벤치가 이미 그 값을 안다: 봇에게 장 보는 것을
   빼먹고 쟀더니 잰 난이도가 전부 「물약을 한 병도 안 산 영웅」의
   숫자였다(sim/README.md). 사람은 매번 그 영웅이다. */
function checkLessons() {
  if (!Meta.isNewcomer() || !G.player || G.screen !== 'play') return;
  teach('move');
  if (G.depth === 0) teach('town');
  if (G.monsters.some(m => G.level.vis[idx(m.x, m.y)])) teach('fight');
  if (Game.spellSlots().length) teach('cast');
  if (G.monsters.some(m => m.awake && m.intent && G.level.vis[idx(m.x, m.y)])) teach('intent');
  if (G.monsters.some(m => m.intent === 'heavy' || m.intent === 'wind')) teach('heavy');
  if (G.hazards.length) teach('ground');
  if ((G.player.wound || 0) > 0) teach('wound');
  if (G.bank >= 2) teach('bank');
  if (G.player.lightTurns < 320) teach('oil');
  if (G.darkAte) teach('dark');
  if (G.clung) teach('cling');
  if (G.monsters.some(m => m.thief && G.level.vis[idx(m.x, m.y)])) teach('thief');
  if (Game.pressureLevel() > 0) teach('clock');
  if ((G.player.relics || []).length) teach('relic');
  /* 크랙은 주웠을 때가 아니라 **반쯤 찼을 때** 가르친다 — 그때가
     「이걸 향해 놀 수 있다」가 처음 참이 되는 순간이다. */
  { const near = Game.nearestCrack(); if (near && near.at >= 0.5) teach('crack'); }
  if (G.level?.merchant) teach('cart');
  if (G.level?.props?.size) teach('prop');
}

/* ── the ? room ───────────────────────────────────────────
   Prose, then two or three buttons with their consequences
   printed. An option the player cannot afford stays visible and
   dead rather than vanishing — seeing what you *could* have done
   with ten more scrap is half of why the screen is interesting. */
export function renderEvent() {
  const offer = Game.eventOffer();
  const list = $('event-list');
  list.innerHTML = '';
  if (!offer) { setScreen('play'); return; }

  $('event-name').textContent = offer.n;
  $('event-text').textContent = offer.t;

  /* 사건마다 그림이 따로 있지는 않다. 있는 것을 쓴다 — 사건의 성격에
     가까운 스프라이트를 골라 크게 앉히고, 없으면 물음표 타일. */
  const ART = { seep:'potion', wickseller:'torch', blackroom:'door',
                eggs:'web', anvil:'anvil', shrine:'altar', spoils:'chest',
                fallen:'bones' };
  const art = $('event-art');
  if (art) {
    const S = CELL_SIZE * 9;
    art.width = S; art.height = S;
    art.style.width = `${S}px`; art.style.height = `${S}px`;
    const c = art.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, S, S);
    const spr = sprite(ART[offer.id] || 'event') || sprite('event');
    if (spr) c.drawImage(spr, 0, 0, S, S);
  }

  for (const o of offer.opts) {
    const row = el('button', 'campopt' + (o.can ? '' : ' poor'));
    if (!o.can) row.disabled = true;
    const head = el('div', 'camphead');
    const nm = el('span', 'campname', o.n);
    /* 전리품은 이름의 색이 곧 등급이다. 셋을 나란히 놓고 고르게 하는
       화면에서 셋이 다 같은 색이면, 고르는 근거가 글줄뿐이 된다. */
    if (o.rar != null) {
      nm.style.color = `var(--${RARITY[o.rar].tone})`;
      if (o.rar === 4) nm.classList.add('transcend');
    }
    head.appendChild(nm);
    if (o.rar != null) head.appendChild(el('span', 'camptag', RARITY[o.rar].n));
    /* The odds go on the button, in the same slot the altar uses.
       A wager you cannot price is not a decision — and the number
       shown here is the number game.js rolls, because the roll
       lives beside the label rather than inside the option. */
    if (!o.can) head.appendChild(el('span', 'camptag', '조건이 안 된다'));
    else if (o.odds != null) {
      const tag = el('span', 'camptag odds', `${Math.round(o.odds * 100)}%`);
      head.appendChild(tag);
      row.classList.add('wager');
    }
    row.appendChild(head);
    if (o.t) row.appendChild(el('span', 'campdesc', o.t));
    /* What losing costs, spelled out. The gamble is meant to be
       taken with open eyes; the surprise is which way it goes,
       not what the downside was. */
    if (o.can && o.risk) row.appendChild(el('span', 'campdesc risk', `실패 — ${o.risk}`));
    if (o.can) row.onclick = () => {
      Game.eventChoose(o.i);
      // An option can hand off to another screen — a relic swap,
      // the fire. Follow it rather than stamping over it.
      setScreen(INTERRUPTS.includes(G.screen) ? G.screen : 'play');
      refresh();
    };
    list.appendChild(row);
  }

  /* 셋 다 쓸모없을 때가 있다. 억지로 하나를 집게 하면 배낭 한 칸이
     벌이 된다 — 두고 갈 수 있어야 고르는 것이 결정이 된다. */
  /* 시체 앞에서는 「두고 간다」가 선택지 안에 이미 있다 — 눈을 감겨
     주는 것이 그 자리의 마지막 예의이므로 규칙이 들고 있다. */
  if (offer.spoils) {
    const out = el('button', 'campopt');
    out.appendChild(el('span', 'campname', '두고 간다'));
    out.appendChild(el('span', 'campdesc', '더미는 그대로 남는다. 마음이 바뀌면 다시 열 수 있다.'));
    out.onclick = () => { Game.spoilsLeave(); setScreen('play'); refresh(); };
    list.appendChild(out);
  }
}

/* ── 죽음이 남기는 유일한 물건 ─────────────────────────────
   로그라이크가 퍼지는 방식은 광고가 아니라 「내 판 이야기」다.
   그런데 이 게임에는 그 이야기를 옮길 수단이 하나도 없었다 —
   스크린샷을 찍어 보내는 것 말고는. 워들이 격자 하나로 한 것을
   여기서는 사다리 하나로 한다.

   글로 만든다. 그림이 아니라 글이라, 카카오톡이든 디스코드든
   커뮤니티 글이든 그대로 붙는다. 그리고 붙인 사람이 무엇을 자랑하는지
   한 줄에 보인다 — 몇 번째 사람이 몇 층까지 갔고 무엇에게 죽었는지.

   숫자는 전부 summarise()가 이미 만들어 둔 것에서 읽는다. 여기서
   다시 세면 화면과 기록이 갈린다. */
/* 칸은 이모지다. ▓░ 같은 괘선 문자는 CJK 폰트에서 폭이 애매해서,
   보내는 쪽과 받는 쪽의 기기가 다르면 사다리가 어긋난다. 게다가
   채팅 목록에서 회색 덩어리로 묻힌다 — 워들이 🟩을 쓴 것은 취향이
   아니라 그 이유였다. 여기서는 구역의 색을 그대로 쓴다: 성채·갱도는
   갈색, 성소는 흰색, 잿불부터는 붉게, 화로는 주황.
   못 간 층은 검정 — 아래가 아직 어둡다는 뜻이다. */
const RUNG = ['🟫', '🟫', '🟫', '⬜', '⬜', '⬜', '⬜', '🟥', '🟥', '🟥', '🟥', '🟥', '🟥', '🟥', '🟧'];
const DARK = '⬛';
export function runCard(s, by) {
  const max = MAX_DEPTH;
  const got = Math.max(0, Math.min(max, s.depth || 0));
  let bar = '';
  for (let i = 0; i < max; i++) bar += i < got ? (RUNG[i] || '🟥') : DARK;
  const where = got > 0 ? regionOf(got).n : '갱구';
  const how = s.win ? '불을 껐다 — 처음으로.'
            : by ? `${where}에서 ${by}에게` : `${where}에서`;
  const bits = [];
  if (s.relics?.length) bits.push(`유물 ${s.relics.length}`);
  if (s.combo >= 5) bits.push(`최고 연격 ${s.combo}`);
  if (s.forged) bits.push(`+${s.forged}`);
  bits.push(`${s.turn}턴`);
  return [
    /* 첫 줄이 훅이다. 「23번째가 죽었다」가 이 게임에서 가장 좋은
       문장인데 넷째 줄에 묻혀 있었다. */
    `${s.sent || 1}번째가 ${s.win ? '내려갔다' : '죽었다'} — 깊은 곳`,
    `${bar} ${got}/${max}층`,
    how,
    bits.join(' · '),
    /* 주소는 scheme이 있어야 자동으로 링크가 된다. 없으면 그냥 글자로
       붙고, 링크가 아니면 미리보기 카드(og.png)도 안 뜬다 — 가장 공들인
       그림이 정작 필요한 순간에 안 보이는 것이다. */
    'https://graviton94.github.io/ROGUELIKE/',
  ].join('\n');
}

/* 복사는 두 갈래로 시도한다. 안전한 문맥(https)에서는 클립보드가
   바로 되고, 아닐 때는 눈에 안 보이는 textarea로 옛 방식을 쓴다 —
   「복사됐다」고 말해 놓고 아무 데도 안 들어가는 것이 최악이다. */
async function copyText(t) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(t); return true; }
  } catch { /* 아래로 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

export async function shareRun() {
  const s = G.ending?.summary || Game.summarise(!!G.ending?.win, G.ending?.by);
  const text = runCard(s, G.ending?.by);
  const btn = $('btn-share');
  /* 폰에는 공유 시트가 있다. 그쪽이 훨씬 자연스러우므로 먼저 쓰고,
     없으면 복사로 떨어진다. */
  if (navigator.share) {
    try { await navigator.share({ text }); return; }
    catch { /* 취소했거나 막혔다 — 복사로 */ }
  }
  const ok = await copyText(text);
  if (btn) {
    btn.textContent = ok ? '복사됐다' : '복사 실패';
    setTimeout(() => { btn.textContent = '자랑하기'; }, 1600);
  }
}

/* ── 판을 파일로 ──────────────────────────────────────────
   규칙이 쌓아 둔 것(Game.traceDump)을 그대로 떨어뜨린다. 화면이 하는
   일은 여기까지다 — 무엇을 적을지는 game.js 가 정하고, 이 함수는
   그것을 파일로 만든다.

   왜 JSON 인가: 읽는 쪽이 사람과 기계 둘 다다. 맨 앞에 사람이 읽을
   머리말 몇 줄을 얹고 그 아래 원본을 통째로 둔다 — 붙여 넣으면
   바로 읽히고, sim/replay.mjs 로 넣으면 표가 나온다. */
export function dumpRun(btn) {
  /* ── 기록할 것이 없으면 파일을 만들지 않는다 ────────────────
     첫 화면의 조작법에서도 이 버튼이 눌린다. 그런데 그때는 판이
     시작되기 전이라 G.player 조차 없고, 그대로 떨구면
     `undefined/undefined Lv0 · 0층 · 0턴 · events []` 짜리 빈 파일이
     나간다 — 실제로 플레이어가 그 파일을 보냈다. 아무 말 없이 빈
     것을 주는 것은 「내려받기가 고장났다」와 구분되지 않는다. */
  /* ── 그리고 이 브라우저에 이미 있는 것도 같이 싣는다 ────────
     플레이어: 「이때까지 한 건 안 남는 거구나… 내 로컬 캐시에 있는
     걸 활용할 수 없나?」

     층별 기록은 이번 판부터만 쌓인다 — 그건 사실이다. 그런데
     localStorage 에 이미 있는 둘로도 답할 수 있는 질문이 꽤 있다:
     **저장 슬롯**(진행 중인 판의 전체 상태 — 그 순간의 장비·유물·
     주목·전투력)과 **누적 장부**(판 수·승 수·최고 깊이·총 처치·
     마지막 판 요약·최근 시체 셋). 그래서 판이 없어도 파일은 나간다.
     빈 파일이 되는 것은 셋 다 없을 때뿐이다. */
  const meta = Meta.read();
  const slots = Save.allSlots();
  const live = !!G.player && !!(G.trace || []).length;
  if (!live && !slots.length && !(meta.runs > 0)) {
    if (btn) {
      const was = btn.textContent;
      btn.textContent = '아직 아무 기록도 없다';
      setTimeout(() => { btn.textContent = was; }, 2200);
    }
    Game.say('아직 아무 기록도 없다 — 한 층이라도 내려간 뒤에 받으시오.', 'warn');
    return false;
  }
  const d = Game.traceDump();
  d.meta = meta;
  d.slots = slots;
  const head = [
    `깊은 곳 판 기록 · ${d.build} · 형식 v${d.v}`,
    `${d.race}/${d.cls} Lv${d.lv} · ${d.deepest}층 · ${d.turns}턴`
      + ` · ${d.ending ? (d.ending.win ? '클리어' : `${d.ending.by}에게`) : '진행 중'}`,
    `유물 ${d.relics.length} · 아르카나 ${d.arcana.length} · 총 강화 +${d.plus}`
      + ` · 처치 ${d.kills} · 최고 연격 ${d.bestCombo}`,
    `이 브라우저에 남은 것 — 판 ${d.meta?.runs || 0}회 · 완주 ${d.meta?.wins || 0}회`
      + ` · 최고 ${d.meta?.best?.depth || 0}층 · 저장 슬롯 ${d.slots.length}개`
      + (d.events.length ? '' : ' (층별 기록은 이번 판부터 쌓인다)'),
    '', '── 아래는 원본. sim/replay.mjs 가 읽는다 ──', '',
  ].join('\n');
  const body = head + JSON.stringify(d, null, 1);
  /* ── 파일 이름은 아스키만 ──────────────────────────────────
     처음에 `…-15층-…json` 으로 지었더니 브라우저가 `download` 속성을
     **통째로 무시하고** 확장자도 없는 `download` 라는 파일을 떨궜다
     (실측: 같은 이름에서 「층」만 F 로 바꾸면 정상). 한글이 들어간
     download 이름을 지원하지 않는 것이라, 여기서는 이름을 예쁘게
     짓는 것보다 **구분되게 떨어지는 것**이 먼저다. */
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  a.download = `deepdelve-${d.cls || 'run'}-d${d.deepest}-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

/* ── the fork ─────────────────────────────────────────────
   Three doors, each with its price printed on it. Everything
   the branch will do is on the card before you commit — that is
   the whole mechanic. A modifier the player discovers after
   descending is a trap, not a choice. */
export function renderStairs() {
  const list = $('stairs-list');
  list.innerHTML = '';
  const next = G.depth + 1;
  $('stairs-depth').textContent = `${regionOf(next).n} ${next}층`;

  /* What is waiting, said before the choice rather than after it.
     A named fight the player walks into blind is a wall; the same
     fight announced a screen earlier is a decision — go down at
     full health, or spend the fire first and arrive ready.

     Also names the place when the next floor crosses into one, so
     the descent reads as going somewhere. */
  const warn = $('stairs-warn');
  const named = NAMED.find(n => n.at === next);
  const crossing = regionOf(next).n !== regionOf(G.depth).n ? regionOf(next) : null;
  const bits = [];
  if (crossing) bits.push(`<b>${crossing.n}</b>이 시작된다. ${crossing.t}`);
  /* Both halves of the decision, said once. It holds its own
     ground and will not follow you across the floor, so walking
     past is a real option — which only means something if the
     player also knows what walking past costs them. */
  if (named) {
    bits.push(`<b class="danger">${named.warn}.</b> ` +
      '자기 자리를 지킨다 — 건드리지 않으면 따라오지 않는다. 쓰러뜨리면 유물 하나를 남긴다.');
    /* 파수꾼의 기억: three of them killed, and the fourth run
       gets the briefing. Knowledge earned in bodies, handed back
       on the one screen where it changes a decision. */
    if (Game.hasMemory('warden'))
      bits.push('<span class="tellline">' + bookLines(named)
        .map(l => l.kind === 'redwrit' ? `<i class="redwrit">${l.text}</i>` : l.text)
        .join('<br>') + '</span>');
  }
  warn.hidden = !bits.length;
  warn.innerHTML = bits.join('<br>');

  for (const b of G.pendingBranch || []) {
    const row = el('button', 'campopt branch');
    if (b.tone) row.style.borderColor = `var(--${b.tone})`;
    const head = el('div', 'camphead');
    const nm = el('span', 'campname', b.n);
    if (b.tone) nm.style.color = `var(--${b.tone})`;
    head.appendChild(nm);
    head.appendChild(el('span', 'camptag', tagsFor(b)));
    row.appendChild(head);
    row.appendChild(el('span', 'campdesc', b.t));
    row.onclick = () => { Game.chooseBranch(b.id); setScreen('play'); refresh(); };
    list.appendChild(row);
  }
}

/* A one-glance summary beside the prose, so the branches can be
   compared without reading three sentences each time. */
function tagsFor(b) {
  const out = [];
  if (b.mon && b.mon !== 1)     out.push(`적 ${b.mon > 1 ? '+' : ''}${Math.round((b.mon - 1) * 100)}%`);
  if (b.elite > 1)              out.push(b.elite > 10 ? '전원 정예' : `정예 ×${b.elite}`);
  if (b.item && b.item !== 1)   out.push(`전리품 ${b.item > 1 ? '+' : ''}${Math.round((b.item - 1) * 100)}%`);
  if (b.relic)                  out.push('유물 확정');
  if (b.clock)                  out.push(`시간 ${Math.round(b.clock * 100)}%`);
  if (b.xp > 1)                 out.push(`경험치 ×${b.xp}`);
  if (b.gold > 1)               out.push(`금화 ×${b.gold}`);
  if (b.mats > 1)               out.push(`재료 ×${b.mats}`);
  if (b.chests > 1)             out.push(`상자 ×${b.chests}`);
  if (b.traps > 1)              out.push(`함정 ×${b.traps}`);
  if (b.drain > 1)              out.push(`식량·횃불 ×${b.drain}`);
  if (b.altar)                  out.push('제단 확정');
  if (b.noCamp)                 out.push('모닥불 없음');
  return out.join(' · ') || '기준';
}

/* ── a full hand ──────────────────────────────────────────
   Five slots is the entire point: the sixth relic is only a
   decision because something has to go. */
export function renderRelicSwap() {
  const want = relicById(G.pendingRelic);
  const list = $('relic-list');
  list.innerHTML = '';
  if (!want) { setScreen('play'); return; }

  $('relic-lead').textContent = `${want.n} — ${want.t}`;
  $('relic-sub').textContent = `자리가 다 찼다. 무엇을 버릴까?`;

  (G.player.relics || []).forEach((id, i) => {
    const r = relicById(id);
    if (!r) return;
    const row = el('button', 'itemrow');
    const ic = el('canvas', 'icon'); paintIcon(ic, r.spr); row.appendChild(ic);
    const mid = el('div', 'imid');
    mid.appendChild(el('span', 'iname magic', r.n));
    mid.appendChild(el('span', 'idesc', r.t));
    const ck = crackRow(r.id); if (ck) mid.appendChild(ck);
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', '버린다'));
    row.onclick = () => { Game.swapRelic(i); setScreen('play'); refresh(); };
    list.appendChild(row);
  });
}

/* ── the wheel ────────────────────────────────────────────
   The odds were always printed; what was missing was the
   moment. A marker runs along the same bar the player has been
   staring at, slowing as it goes, and stops on the segment that
   was already decided. Everything it passes on the way is a
   jackpot that did not happen — which is the entire reason
   anyone enjoys a gamble, and it costs one animation.

   The outcome is rolled before the first frame. The wheel
   cannot change it, and slowing down is not the game deciding
   late — it is the game showing you what it already decided. */
function spinAltar(odds) {
  const bar = $('altar-wheel');
  const mark = $('altar-mark');
  const label = $('altar-result');
  const pend = G.pendingAltar;
  if (!bar || !pend) { Game.altarSettle(); setScreen(G.screen === 'relic' ? 'relic' : 'play'); refresh(); return; }

  // Lay out the same segments the offer showed.
  bar.innerHTML = '';
  const total = odds.reduce((s, [, w]) => s + w, 0);
  const tone = { '대성공':'great', '성공':'good', '허탕':'none', '재앙':'doom' };
  for (const [name, w] of odds) {
    const seg = el('i', tone[name] || 'none', name);
    seg.style.flex = `${w} 1 0`;
    bar.appendChild(seg);
  }
  $('altar-spin').hidden = false;
  label.textContent = '';

  // Where it has to stop: the middle of the winning segment.
  let acc = 0, stop = 0.5;
  for (const [name, w] of odds) {
    if (name === pend.result) { stop = (acc + w / 2) / total; break; }
    acc += w;
  }

  /* Three and a bit laps, decelerating. The tick is per segment
     crossed, not per frame, so the ear hears it slow down too. */
  const LAPS = 3;
  const dur = 1500;
  const t0 = performance.now();
  let lastSeg = -1;
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / dur);
    const ease = 1 - Math.pow(1 - k, 3);          // fast, then crawling
    const pos = (LAPS * ease + stop * ease) % 1;
    mark.style.left = `${pos * 100}%`;
    const seg = Math.floor(pos * odds.length);
    if (seg !== lastSeg) { lastSeg = seg; Audio.sfx.tick(seg); }
    if (k < 1) { requestAnimationFrame(step); return; }

    mark.style.left = `${stop * 100}%`;
    label.textContent = pend.result;
    label.style.color = `var(--${{'대성공':'y','성공':'E','허탕':'g','재앙':'R'}[pend.result] || 'w'})`;
    setTimeout(() => {
      $('altar-spin').hidden = true;
      Game.altarSettle();
      setScreen(G.screen === 'relic' ? 'relic' : 'play');
      refresh();
    }, 620);
  };
  requestAnimationFrame(step);
}

export function renderAltar() {
  $('altar-depth').textContent = `${G.depth}층`;
  const list = $('altar-list');
  list.innerHTML = '';

  for (const o of Game.altarOffers()) {
    const row = el('button', 'altopt' + (o.can ? '' : ' poor'));
    if (!o.can) row.disabled = true;

    const head = el('div', 'camphead');
    head.appendChild(el('span', 'altname', o.n));
    head.appendChild(el('span', 'camptag', o.can ? o.cost : '바칠 것이 없다'));
    row.appendChild(head);
    row.appendChild(el('span', 'altcost', o.detail));

    const bar = el('div', 'altodds');
    for (const [name, w] of o.odds) {
      const seg = el('i', ODD_CLASS[name], `${name} ${w}%`);
      seg.style.flex = `${w} 1 0`;
      bar.appendChild(seg);
    }
    row.appendChild(bar);

    if (o.can) row.onclick = () => {
      ask(`${o.n}?`, `${o.detail} — 되돌릴 수 없습니다.`, () => {
        Game.altarOffer(o.id);
        spinAltar(o.odds);
      });
    };
    list.appendChild(row);
  }
}

$('altar-leave').onclick = () => { setScreen('play'); refresh(); };
$('relic-skip').onclick  = () => { Game.swapRelic(-1); setScreen('play'); refresh(); };

/* ending */
/* The end of a run should read like an account of it, not like
   a receipt. Three numbers told the player nothing about what
   they had just spent an hour doing — which relics they wore,
   which roads they took, what the last three things that
   happened were. All of it was already in G; it was simply
   never collected. */
let recorded = null;

function renderEnd() {
  // The frame loop normally does this; belt and braces for a
  // death that somehow resolves without a frame in between.
  if (!savedEnding) { savedEnding = true; Save.clear(activeSlot); }

  const p = G.player, e = G.ending || {};
  /* Built here if the ending arrived without one — a death
     routed around death() would otherwise print a blank sheet,
     and the same function makes both paths identical. */
  const s = e.summary || Game.summarise(!!e.win, e.by);

  // Ledger it once, however many times this screen re-renders.
  if (recorded !== s) {
    recorded = s;
    Meta.finish(s);
    /* A rung is only cleared by finishing it. Winning at 3 opens
       4 and nothing further — the ladder is climbed, not chosen. */
    if (s.win) Meta.clearedAt(s.abyss || 0);
  }
  const m = Meta.read();

  /* ── 끝이 셋이다 ────────────────────────────────────────
     DESIGN.md §1. 이기는 것이 실패다. 무엇을 이겼는지가 신앙심으로
     갈리고, 그 갈래를 규칙이 문자열 하나로 건네준다(endKind). */
  const ENDS = {
    throne: ['그 자리에 앉았다',
             '가장 깊은 곳의 것을 눕혔다. 그것은 앞서 간 자였다.',
             '앉을 자리가 비어 있었고, 다리가 저절로 굽었다. 다음 사람이 내려올 것이다.'],
    hollow: ['불이 꺼졌다',
             '가장 깊은 곳의 것을 눕혔다. 그것은 앞서 간 자였다.',
             '앉지 않았다. 그렇다고 걸어 나가지도 못했다.'],
    true:   ['아무것도 받지 않았다',
             '가장 깊은 곳의 것을 눕혔다. 그것은 앞서 간 자였고, 당신이 될 뻔한 것이었다.',
             '처음으로 위를 올려다본다. 거기 있는 것은 신이 아니다.'],
  };
  const end = e.win ? (ENDS[e.kind] || ENDS.hollow) : null;
  $('end-title').textContent = end ? end[0] : '당신은 죽었다';
  if (end) {
    const sub = $('end-sub') || $('end-title').parentElement;
    /* 두 줄을 제목 아래에 붙인다. 진 엔딩만 위를 올려다본다. */
    for (const old of [...(sub.querySelectorAll?.('.endline') || [])]) old.remove();
    for (const line of end.slice(1)) {
      const p2 = el('p', 'tag endline', line);
      if (e.kind === 'true') p2.style.color = 'var(--W)';
      $('end-title').after(p2);
    }
  }
  /* 죽음이 끝이 아니라 「다음 사람」이라는 것을, 사망 화면이 말한다.
     메타 진행(기억)이 왜 남는지가 이 한 줄로 설명된다 — 남는 것은
     네 실력이 아니라 네 시체를 본 다음 놈의 학습이다. */
  const nextLine = el('p', 'note',
    /* 「다음 사람」은 개념이고 「24번째」는 사람이다. 그리고 이 줄이
       다음 판의 오프닝(「24번째다」)과 정확히 맞물린다 — 죽음 화면이
       예고한 숫자를 다음 판의 첫 줄이 받는다. 지금까지 그 이음매가
       비어 있었다.
       승리 쪽: 「아무도 세지 않아도 되는」이 무엇을 세는지 말하지 않아서
       뜬 말이었다. 세던 것은 번호이고, 승리란 번호가 늘지 않는 것이다. */
    e.win ? `${s.sent || 1}에서 멈췄다. 도르래가 처음으로 비어 있다.`
          : `도르래가 한 번 더 감긴다. ${(s.sent || 1) + 1}번째가 목에 쇠를 채우고 있다.`);
  $('end-sub').textContent = e.win
    ? `${MAX_DEPTH}층에서. 처음으로, 누군가 그만큼 내려갔다.`
    : `${s.depth === 0 ? '갱구' : s.depth + '층'}에서 ${e.by}에게.`;

  /* 결산은 이제 #end-body 안의 **첫 칸**에 들어간다 — 그 아래에
     작은 버튼 셋이 같이 스크롤되므로, 여기서 innerHTML 을 비우면
     버튼까지 지운다. 제 칸만 비운다. */
  const box = $('end-ledger');
  box.innerHTML = '';

  const line = (label, value, tone) => {
    const row = el('div', 'endrow');
    row.appendChild(el('span', 'endlabel', label));
    const v = el('span', 'endval', value);
    if (tone) v.style.color = `var(--${tone})`;
    row.appendChild(v);
    box.appendChild(row);
  };

  /* ── 왜 죽었는지 ────────────────────────────────────────
     여태 이 화면이 말한 것은 「무엇에게 죽었나」 하나였다. 그건 사인이지
     이유가 아니다. 이유는 **안 쓴 것**에 있다 — 주머니에 물약이 셋
     있었는데 안 마셨다든가, 한계돌파가 열려 있었는데 안 눌렀다든가,
     여유를 백 턴 넘겨서 파도가 셋째로 오고 있었다든가.

     그래서 부검을 맨 위에 놓는다. 아래의 기록(인물·도달·무기)은
     지나간 판의 명세서이고, 이쪽은 **다음 판에 쓸 것**이다. */
  if (!e.win && e.post?.length) {
    box.appendChild(el('h3', 'sect', '왜 죽었나'));
    for (const row of e.post) line(row.k, row.v, row.hot ? 'R' : 'G');
    box.appendChild(el('div', 'endsep'));
  }
  line('인물', `${RACES[s.race || p.race].name} ${CLASSES[s.cls || p.cls].name} · Lv ${s.lv}`);
  line('도달', `${s.depth}층 / ${MAX_DEPTH}`, s.depth >= 10 ? 'o' : '');
  line('무기', s.weapon || '맨손', s.weaponType ? 'w' : 'g');
  if (s.relics?.length)
    line('유물', s.relics.map(id => relicById(id)?.n).filter(Boolean).join(' · '), 'P');
  else line('유물', '없음', 'g');
  line('최고 연격', `${s.combo}`, s.combo >= 10 ? 'y' : '');
  line('처치 · 상자 · 사건', `${s.kills || 0} · ${s.opened || 0} · ${s.events || 0}`);
  line('금화 · 턴', `${s.gold}닢 · ${s.turn}턴`);
  /* 잃은 천장과 안 쓴 것. 둘 다 「무엇이 이 판을 끝냈는가」에 대한
     답이고, 지금까지 결산에 없던 줄이다. 상처는 0일 때도 적는다 —
     「한 번도 안 깎였다」는 그 자체로 읽을 값이다. */
  const roof = (s.maxhp || 0) + (s.wound || 0);
  line('잃은 천장', s.wound
    ? `−${s.wound} (${roof ? Math.round(s.wound / roof * 100) : 0}%)`
    : '없음 — 한 번도 깎이지 않았다', s.wound ? 'R' : 'g');
  if (s.unused) line('배낭에 남은 것', `${s.unused}개를 안 썼다`, s.unused >= 3 ? 'o' : 'g');
  /* 빚. 금화를 점수가 아니라 「얼마나 갚았나」로 다시 읽는 줄이다 —
     이 한 줄이 있으면 판 내내 주운 동전에 이유가 생긴다. 아무도
     다 갚지 못했고, 그것도 세계관의 일부다. */
  /* 몇 번째였나. 「모험가 하나가 죽었다」와 「스물세 번째가 죽었다」는
     같은 사건의 다른 무게다. 그리고 이 줄이 기억(메타 진행)이 왜
     남는지를 설명한다 — 남는 것은 실력이 아니라 앞선 자들의 흔적이다. */
  if (s.sent) line('내려간 순서', `${s.sent}번째`, s.sent >= 20 ? 'R' : '');
  /* 벌어들인 금화는 「구덩이가 얼마를 내주었나」다. 가진 금화로 세면
     상점과 모루에 쓰는 것이 점수를 깎는 일이 되어버린다. */
  if (s.earned) line('구덩이가 내준 것', `${s.earned}닢`, 'y');
  if (s.forged) line('벼려 올린 +', `${s.forged}단계`, 'y');
  if (s.broke) line('불에 잃은 장비', `${s.broke}점`, 'R');
  if (s.perfects) line('절단', `${s.perfects}번`, 'W');
  if (s.fused) line('찾아낸 조합', `${s.fused}가지`, 'W');
  if (s.reso?.length)
    line('공명', s.reso.map(id => RESONANCE.find(r => r.id === id)?.n).filter(Boolean).join(' · '), 'W');
  if (s.abyss)
    line('심연', `${s.abyss}단계 — ${SHACKLES.slice(1, s.abyss + 1).map(x => x.k).join(' · ')}`, 'R');
  if (s.trans) line('초월', `${s.trans}점 — 이 판을 기억하시오.`, 'W');
  if (s.bank >= 2) line('잃은 판돈', `${s.bank}층치`, 'R');
  if (s.waves) line('심연의 습격', `${s.waves}번`, 'R');

  box.appendChild(nextLine);

  if (s.tail?.length) {
    const tail = el('div', 'endtail');
    for (const t of s.tail) tail.appendChild(el('p', '', t));
    box.appendChild(tail);
  }

  /* The ledger. This is the only reason to press 새 게임 again
     that the game itself provides — so it goes on the screen
     where that decision is made. */
  const led = el('div', 'ledger');
  led.appendChild(el('h3', 'sect', '발견'));
  const bars = [
    ['유물',   Meta.count('relics'),   RELICS.length,   'P'],
    ['사건',   Meta.count('events'),   EVENTS_TOTAL,    'B'],
    ['몬스터', Meta.count('monsters'), MONSTERS.length + 4, 'R'],
    ['무기 계열', Meta.count('weapons'), Object.keys(WEAPON_TYPES).length, 'o'],
    ['갈림길', Meta.count('branches'), BRANCH_TOTAL,    'y'],
    ['다녀온 곳', Meta.count('regions'), REGIONS.length,  'o'],
    // The one row that is not a checklist: nothing in the game
    // tells you these exist. The bar is the only place they are
    // ever counted.
    ['조합',   Meta.count('fusions'),  FUSIONS.length,  'W'],
  ];
  for (const [label, have, all, tone] of bars) {
    const row = el('div', 'endrow');
    row.appendChild(el('span', 'endlabel', label));
    const bar = el('div', 'ledbar');
    const fill = el('i');
    fill.style.width = `${Math.min(100, (have / all) * 100)}%`;
    fill.style.background = `var(--${tone})`;
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el('span', 'endval', `${have}/${all}`));
    led.appendChild(row);
  }
  const rec = el('p', 'note');
  rec.textContent = `${m.runs}판 · ${m.wins}승 · 최고 ${m.best.depth}층 · 최고 연격 ${m.best.combo}`;
  led.appendChild(rec);
  box.appendChild(led);
}

/* ── input ──────────────────────────────────────────────────
   One tap used to equal one tile, which made a 66×40 floor a
   drumming exercise. Now a held direction repeats, a swipe
   held down keeps walking, and a tap on somewhere you have
   already seen walks you there — stopping the moment anything
   worth looking at happens. */
const DIRS = {
  ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1],
  h:[-1,0], l:[1,0], k:[0,-1], j:[0,1],
  y:[-1,-1], u:[1,-1], b:[-1,1], n:[1,1], '.':[0,0], ' ':[0,0],
};

const HOLD_FIRST  = 190;   // grace before a held direction starts repeating
const HOLD_FAST   = 62;    // floor of the repeat cadence
const PATH_STEP   = 58;    // cadence while walking a tapped route

let held = null;           // {dx,dy} physically held right now
let heldWait = 0, heldCount = 0;
let route = null, routeWait = 0;
let guard = null;          // situation snapshot that cancels auto-movement

function act(fn) {
  fn();
  refresh();
  if (G.screen === 'end') setScreen('end');
  else if (INTERRUPTS.includes(G.screen)) setScreen(G.screen);
}

/* What "something happened" means: we lost health, another
   monster came into view, we picked something up, or the floor
   changed under us. Any of those and the feet stop. */
function snapshot() {
  const p = G.player, L = G.level;
  let vis = 0;
  for (const m of G.monsters) if (L.vis[idx(m.x, m.y)]) vis++;
  return { hp: p.hp, vis, depth: G.depth, pack: p.pack.length, gold: p.gold };
}

function disturbed(before) {
  if (!before) return true;
  const now = snapshot();
  return now.hp < before.hp || now.vis > before.vis || now.depth !== before.depth
      || now.pack !== before.pack || now.gold !== before.gold;
}

export function stopAuto() { route = null; held = null; guard = null; }

/* Breadth-first over tiles we have actually seen. Monsters are
   treated as walls so a route never suicides into one.

   Traps are avoided on the first pass and permitted on the
   second: a spotted trap sitting in a one-wide corridor would
   otherwise cut the floor in half and make everything past it
   untappable. Prefer to walk around; walk over it if that is
   the only way through. */
function findRoute(tx, ty) {
  return routeAvoiding(tx, ty, true) || routeAvoiding(tx, ty, false);
}

function routeAvoiding(tx, ty, dodgeTraps) {
  const L = G.level, p = G.player;
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return null;
  const goal = idx(tx, ty);
  if (!L.seen[goal] || !walkable(L, tx, ty)) return null;

  const prev = new Int32Array(MW * MH).fill(-1);
  const start = idx(p.x, p.y);
  prev[start] = start;
  const q = [start];

  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    if (cur === goal) {
      const out = [];
      for (let n = goal; n !== start; n = prev[n]) {
        out.push({ x: n % MW, y: (n / MW) | 0 });
        if (out.length > 400) return null;
      }
      return out.reverse();
    }
    const cxx = cur % MW, cyy = (cur / MW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cxx + dx, ny = cyy + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const ni = idx(nx, ny);
      if (prev[ni] !== -1 || !L.seen[ni] || !walkable(L, nx, ny)) continue;
      if (Game.monsterAt(nx, ny)) continue;
      if (L.shopAt.has(ni) && ni !== goal) continue;
      if (dodgeTraps) {
        const tr = L.traps.get(ni);
        if (tr && tr.seen && ni !== goal) continue;
      }
      prev[ni] = cur;
      q.push(ni);
    }
  }
  return null;
}

function walkTo(tx, ty) {
  const r = findRoute(tx, ty);
  if (!r || !r.length) return false;
  route = r; routeWait = 0; guard = snapshot();
  return true;
}

/* The rules layer can hand control to a screen from inside a
   step — walking onto a fire, opening a chest with a relic in
   it. One list, so a new screen is never routed from three
   places and forgotten in a fourth. */
/* 'arcana' 가 여기 없었다. 규칙이 G.screen='arcana' 를 세워도
   act() 가 그것을 인터럽트로 안 봐서 그냥 'play' 로 덮였다. */
const INTERRUPTS = ['shop', 'camp', 'altar', 'stairs', 'relic', 'event', 'anvil', 'arcana'];
/* Everything that happens *on a floor*. The shop is in town where
   there is no map worth keeping, so it stays a whole screen. */
const SHEETS = ['camp', 'altar', 'stairs', 'relic', 'event', 'anvil'];

function takeStep(dx, dy) {
  act(() => Game.step(dx, dy));
  if (INTERRUPTS.includes(G.screen)) { stopAuto(); setScreen(G.screen); return false; }
  if (G.screen === 'end') { stopAuto(); return false; }
  return true;
}

/* Driven from the render loop so movement is frame-synced and
   the animation layer always has time to blend between steps. */
export function tickInput(dt) {
  if (asking()) { stopAuto(); return; }     // the modal holds the world still
  if (G.screen !== 'play' || !G.running) { stopAuto(); return; }

  if (route) {
    routeWait -= dt;
    if (routeWait <= 0) {
      routeWait = PATH_STEP;
      if (disturbed(guard)) { stopAuto(); return; }
      const next = route.shift();
      if (!next) { stopAuto(); return; }
      const p = G.player;
      const dx = Math.sign(next.x - p.x), dy = Math.sign(next.y - p.y);
      if (!takeStep(dx, dy)) return;
      if (p.x !== next.x || p.y !== next.y) { stopAuto(); return; }  // blocked; give up quietly
      if (!route.length) stopAuto();
      else if (disturbed(guard)) stopAuto();
      else guard = snapshot();
    }
    return;
  }

  if (held) {
    heldWait -= dt;
    if (heldWait <= 0) {
      heldCount++;
      // Ease from a deliberate first repeat down to a jog.
      heldWait = Math.max(HOLD_FAST, HOLD_FIRST - heldCount * 26);
      // Guard is carried across ticks, not re-taken each step, so
      // anything that changed since the last step counts — not
      // only what this step caused.
      if (disturbed(guard)) { stopAuto(); return; }
      if (!takeStep(held.dx, held.dy)) return;
      if (disturbed(guard)) stopAuto();
      else guard = snapshot();
    }
  }
}

/* A single step with nothing latched — used by taps, which get
   no matching pointer-up to release a held direction. */
function single(dx, dy) {
  route = null; held = null;
  takeStep(dx, dy);
}

/* ── the roll ─────────────────────────────────────────────
   Same direction twice, quickly. No new button to find and no
   modifier to hold — the gesture is the one every action game
   already taught the player, and it costs stamina rather than a
   cooldown so it stays a decision.

   창은 짧아야 한다 — 였는데, 260ms는 안 짧았다. 탭 간격 100·150·
   200ms에서 전부 굴렀다. 그게 사람이 걸으려고 누르는 속도다. 주석은
   「걷는 박자보다 빠르다」고 적혀 있었는데, 그건 **누르고 있을 때**의
   박자(HOLD_FIRST 190ms)이지 탭 박자가 아니다. 그리고 처음 하는
   사람은 누르고 있는 법을 알기 전에 탭부터 한다.

   두 겹으로 좁힌다: 창을 200ms로 줄이고, **피할 것이 있을 때만**
   구른다. 아무것도 없는 복도에서 구르는 것을 의도한 사람은 없다. */
const DOUBLE_TAP = 200;
let lastTap = { dx: 0, dy: 0, at: -1e9 };

function press(dx, dy) {
  route = null;

  if (dx || dy) {
    const now = performance.now();
    if (lastTap.dx === dx && lastTap.dy === dy && now - lastTap.at < DOUBLE_TAP
        && Game.threatened()) {
      lastTap.at = -1e9;                   // one roll per double-tap, not a chain
      if (Game.canRoll()) {
        held = null;
        act(() => Game.dodgeRoll(dx, dy));
        if (INTERRUPTS.includes(G.screen)) setScreen(G.screen);
        return;
      }
    }
    lastTap = { dx, dy, at: now };
  }

  const before = snapshot();
  if (!takeStep(dx, dy)) return;
  held = { dx, dy };
  heldWait = HOLD_FIRST;
  heldCount = 0;
  if (disturbed(before)) stopAuto();
  else guard = snapshot();
}

const release = () => { held = null; heldCount = 0; };

/* 위의 두 겹을 실제로 거는 자리. 캡처 단계에서 잡아채므로 개별
   버튼의 onclick은 이 규칙을 몰라도 되고, 새 화면을 만들 때 이걸
   붙이는 걸 잊을 일도 없다.

   키보드로 누른 click(detail === 0)은 통과시킨다 — 손가락이 없었던
   누름은 손가락 때문에 생기는 사고와 무관하고, 헤드리스 벤치가
   화면을 두드리는 방법도 이것이다. */
const GUARDED = ['sc-camp', 'sc-altar', 'sc-stairs', 'sc-event', 'sc-relic',
                 'sc-anvil', 'sc-shop', 'sc-inv', 'sc-spell', 'ask'];
function guardScreens() {
  const boxOf = t => (t?.closest ? t.closest(GUARDED.map(id => `#${id}`).join(',')) : null);
  let downOn = null;
  document.addEventListener('pointerdown', e => {
    if (!boxOf(e.target)) { downOn = null; return; }
    if (!armed()) { e.preventDefault(); e.stopPropagation(); downOn = null; return; }
    downOn = e.target.closest('button') || e.target;
  }, true);
  document.addEventListener('click', e => {
    const btn = boxOf(e.target) && e.target.closest?.('button');
    if (!btn) return;
    if (e.detail === 0) return;                 // 키보드·벤치
    if (armed() && downOn === btn) { downOn = null; return; }
    e.preventDefault(); e.stopPropagation();
    downOn = null;
  }, true);
}

export function bindInput() {
  guardScreens();
  for (const btn of document.querySelectorAll('#dpad button')) {
    const [dx, dy] = btn.dataset.dir.split(',').map(Number);
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      /* Capture is a nicety — it keeps the hold alive if the
         finger slides off the button. It is not worth losing the
         input to: some pointer ids are already gone by the time
         the handler runs, and an exception here would eat the
         step entirely. */
      try { btn.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
      press(dx, dy);
      if (G.screen === 'camp') setScreen('camp');
      if (G.screen === 'altar') setScreen('altar');
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'])
      btn.addEventListener(ev, release);
  }

  mini.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); cycleMini(); });

  $('lesson-ok').onclick = () => closeLesson();
  $('look-close').onclick = () => { $('look').hidden = true; };
  /* 살펴보기 카드도 밀어서 치운다. 여기는 읽는 창이지 묻는 창이 아니다.
     ── 그래서 **탭으로는 안 닫는다.** 이 카드가 담는 것은 유물 목록과
     주목의 거래 조건표(일곱 줄)이고, 읽는 중에 손가락이 본문에 닿으면
     사라졌다. 스크롤이 붙은 지금은 더 그렇다 — 목록을 넘기려고 대는
     손과 치우려는 손이 같아진다. 미는 것과 백드롭 탭은 그대로 닫는다. */
  swipeAway($('look'), () => { $('look').hidden = true; }, { tapCloses: false });
  $('look').addEventListener('pointerdown', e => {
    if (e.target.id === 'look') $('look').hidden = true;   // tap the backdrop
  });

  /* Two buttons, one switch — the title carries it and so does
     the bag, because those are the two places a hand is already
     resting when the room gets loud. */
  const soundBtns = [$('btn-sound'), $('btn-sound2')];
  const paintSound = () => {
    const off = Audio.isMuted();
    soundBtns[0].textContent = off ? '소리 꺼짐' : '소리 켜짐';
    soundBtns[1].textContent = off ? '소리 꺼짐' : '소리 켜짐';
  };
  for (const b of soundBtns) b.onclick = () => { Audio.init(); Audio.toggleMute(); paintSound(); };
  paintSound();

  /* 버튼에 「배낭 5.5/20」이라고 적혀 있는데 열리면 「몸」 탭이었다.
     라벨과 도착지가 다른 것은 그 자체로 오터치이고, 처음 하는 사람은
     물약을 찾으러 들어갔다가 장비창을 보고 한 번 더 눌러야 한다.
     라벨이 가리키는 곳으로 연다. */
  $('btn-inv').onclick    = () => { stopAuto(); invTab = 'bag'; setScreen('inv'); };
  $('btn-cast').onclick   = () => { stopAuto(); setScreen('spell'); };
  $('btn-door').onclick   = () => { stopAuto(); act(Game.closeDoor); };
  /* 밀도를 올리는 유일한 손잡이. 버튼 하나로 두는 이유는, 이것이
     실수로 눌리면 안 되는 결정이기 때문이다 — 자동 이동을 끊고
     한 번의 의식적인 누름으로만 나간다. */
  $('btn-shout').onclick  = () => {
    /* 소리치기도 계율이 될 수 있다(침묵의 어머니). 같은 문으로 묻는다. */
    const risk = Game.vowRisk('shout');
    if (risk) {
      ask(`${risk.n}이(가) 듣고 있다.`,
          `${risk.vow}. 어기면 이 층에서 ${risk.boon.replace(/\.$/, '')} — 그것이 멎는다.`,
          () => { stopAuto(); act(Game.shout); });
      return;
    }
    stopAuto(); act(Game.shout);
  };
  $('btn-here').onclick   = () => {
    stopAuto();
    /* 발밑의 것이 먼저다. 계단 위에는 다른 것이 놓이지 않으므로
       둘이 부딪칠 일은 없지만, 순서는 적어 두는 편이 낫다. */
    if (Game.openHere()) { setScreen(G.screen); refresh(); return; }
    const stair = Game.stairHere();
    if (stair === 'down') act(Game.descend);
    else if (stair === 'up') act(Game.ascend);
  };
  $('btn-shoot').onclick  = () => { stopAuto(); act(Game.shoot); };
  for (const b of [$('btn-help'), $('btn-help2')])
    b.onclick = () => { stopAuto(); setScreen('help'); };
  $('btn-codex').onclick  = () => setScreen('codex');
  for (const b of $('ledger-tabs').children)
    b.onclick = () => { ledgerTab = b.dataset.led; renderCodex(); };
  for (const b of $('inv-tabs').children)
    b.onclick = () => { invTab = b.dataset.tab; renderInventory(); };
  /* The strip is the lid of the record. Tapping it opens the
     whole thing — the two-line window was never meant to be the
     only way to read what happened. */
  $('log').onclick = () => { stopAuto(); renderScroll(); };
  $('scroll-close').onclick = () => { $('scroll').hidden = true; };
  /* 닫기는 「열기 전에 있던 곳」으로 돌아간다. 덮개형이 아닌 화면
     (배낭·상점·모루…)은 판 안에서만 열리므로 여전히 판으로 간다. */
  for (const b of document.querySelectorAll('[data-back]'))
    b.onclick = () => setScreen(G.running ? 'play' : 'title');
  for (const id of OVERLAYS) {
    const b = document.querySelector(`#sc-${id} [data-back]`);
    if (b) b.onclick = () => setScreen(backTarget());
  }

  window.addEventListener('keydown', e => {
    // The modal owns the keyboard while it is up.
    if (asking()) {
      const k = e.key.toLowerCase();
      if (k === 'y' || k === 'enter') { e.preventDefault(); closeAsk(true); }
      else if (k === 'n' || k === 'escape') { e.preventDefault(); closeAsk(false); }
      return;
    }
    /* Enter goes back down, Escape goes back to the title — the
       same two doors the buttons offer, so the keyboard is not a
       narrower way to leave an ending than the thumb is. */
    if (G.screen === 'end') {
      if (e.key === 'Enter') location.reload();
      else if (e.key === 'Escape') { G.running = false; setScreen('title'); }
      return;
    }
    // decisions, not menus — but the map key still works everywhere
    if (e.key === 'Tab') { e.preventDefault(); cycleMini(); return; }
    if (G.screen === 'camp' || G.screen === 'altar') return;
    if (G.screen !== 'play') { if (e.key === 'Escape') setScreen('play'); return; }
    if (e.key === 'Escape') { stopAuto(); return; }

    const d = DIRS[e.key];
    if (d) {
      e.preventDefault();
      if (e.repeat) return;          // our own repeat is smoother than the OS one
      press(d[0], d[1]);
    }
    else if (e.key === '>') { stopAuto(); act(Game.descend); }
    else if (e.key === '<') { stopAuto(); act(Game.ascend); }
    else if (e.key === 'i') { stopAuto(); setScreen('inv'); }
    else if (e.key === 'm') { stopAuto(); setScreen('spell'); }
    else if (e.key === 'c') { stopAuto(); act(Game.closeDoor); }
    else if (e.key === 'y') { stopAuto(); act(Game.shout); }
    else if (e.key === 'Tab') { e.preventDefault(); cycleMini(); }
    // 1–5 cast, q/w/e drink — the same order as the two rows read
    else if (e.key >= '1' && e.key <= '5') {
      const s = Game.spellSlots()[+e.key - 1];
      if (s?.ready) { stopAuto(); act(() => Game.cast(s.id)); }
    }
    else if ('qwe'.includes(e.key)) {
      const s = Game.quickSlots()['qwe'.indexOf(e.key)];
      if (s) { stopAuto(); act(() => Game.useItem(s.idx)); }
    }
  });

  window.addEventListener('keyup', e => { if (DIRS[e.key]) release(); });
  window.addEventListener('blur', release);

  bindMapGestures();

  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  /* The stage moves for reasons the window never hears about —
     a button appearing in the action column, a HUD chip wrapping
     onto a second line. Observe the box, not the window. Safe
     from feedback: the canvas is sized *from* #stage and never
     the other way round, so re-sizing it cannot move the box. */
  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv.parentElement);
}

/* Swipe sets a heading and *keeps* it while the finger stays
   down, so crossing a room is one gesture instead of thirty. */
function bindMapGestures() {
  let sx = 0, sy = 0, st = 0, moved = false, id = null;

  const tileUnder = (clientX, clientY) => {
    const box = cv.getBoundingClientRect();
    const { cx, cy, t } = camera();
    /* t is in device pixels now; the pointer arrives in CSS
       pixels. Convert through the bitmap/box ratio rather than
       devicePixelRatio, so a mid-transition box can't lie. */
    const kx = cv.width / box.width, ky = cv.height / box.height;
    return {
      x: Math.floor(cx + (clientX - box.left) * kx / t),
      y: Math.floor(cy + (clientY - box.top) * ky / t),
    };
  };

  const heading = (dx, dy) => {
    const oct = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
    return [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]][oct];
  };

  cv.addEventListener('pointerdown', e => {
    if (G.screen !== 'play') return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; st = performance.now(); moved = false;
    cv.setPointerCapture?.(id);
    stopAuto();
  });

  cv.addEventListener('pointermove', e => {
    if (e.pointerId !== id || G.screen !== 'play') return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.hypot(dx, dy) < 26) return;
    const [hx, hy] = heading(dx, dy);
    if (!moved) { moved = true; press(hx, hy); }
    else if (held && (held.dx !== hx || held.dy !== hy)) { held = { dx: hx, dy: hy }; }
  });

  const finish = e => {
    if (e.pointerId !== id) return;
    id = null;
    release();
    if (G.screen !== 'play') return;
    if (moved) return;
    /* Long press reads instead of walking. This is where the
       manual goes: a monster you can question is worth more
       than a table you have to go and find. */
    if (performance.now() - st > 550) {
      const t = tileUnder(e.clientX, e.clientY);
      inspect(t.x, t.y);
      return;
    }

    const { x, y } = tileUnder(e.clientX, e.clientY);
    const p = G.player;
    const far = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
    if (far === 0) { single(0, 0); return; }
    if (far === 1 || !walkTo(x, y)) single(Math.sign(x - p.x), Math.sign(y - p.y));
  };

  cv.addEventListener('pointerup', finish);
  cv.addEventListener('pointercancel', e => { if (e.pointerId === id) { id = null; release(); } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}

export { pick };
/* 탐침용. 화면을 찍어서 글리치를 세면 재고 있는 것이 글리치가 아니라
   바닥 무늬가 된다 — 그리는 쪽이 부르는 그 함수를 그대로 내준다. */
export { glitchOf as _glitchOf, glitchNow as _glitchNow };
/* 탐침용. 벽 테두리는 그리는 자리에서 긋는 것이라 화면에서만 잴 수
   있고, 화면에서 재려면 그 벽이 화면 어디에 그려졌는지 알아야 한다.
   좌표를 안 내주면 벤치는 「어두운 픽셀이 몇 %인가」 같은 것을 세게
   되는데, 그건 배경을 세는 것이지 테두리를 세는 것이 아니다 —
   실제로 그렇게 만들어 놓고 통과시킨 적이 있다. */
export { camera as _camera };
