/* ═══════════════════════════════════════════════════════════
   ui.js — canvas for the dungeon, DOM text for everything
   else. Korean needs real font shaping, so the chrome stays
   in the DOM; only the map is pixels.
   ═══════════════════════════════════════════════════════════ */

import { sprite, wallTile, floorTile, CELL_SIZE, PALETTE, setTerrainTheme } from './pixels.js';
import {
  RACES, CLASSES, STATS, STAT_NAME, MAX_DEPTH, SHOPS, AILMENTS, TRAPS, statRange,
  PREFIXES, SUFFIXES, SPELL_AFFIXES, affixName, MATS, ENCHANT_COST, REROLL_COST,
  RARITY, CURSED_TONE, rarityOf, isCursed,
  RELIC_SLOTS, RELICS, relicById, WEAPON_TYPES, PATTERNS,
  MONSTERS, BRANCHES, SPELLS, boonById, FUSIONS, engraveById, ENGRAVE_AT, ENGRAVE_PENALTY, NAMED,
  REGIONS, regionOf, MEMORIES, memoryEarned, ABYSS,
  UPGRADE_CRIT, CAREFUL_MULT, CAREFUL_BONUS, FUSE_ODDS, FUSE_COST,
  xpToLevel, statBonus,
} from './data.js';
import { EVENTS } from './events.js';

const EVENTS_TOTAL = EVENTS.length;
const BRANCH_TOTAL = BRANCHES.length;
import {
  MW, MH, idx, clamp, walkable, isDoor,
  ROCK, FLOOR, DOWN, UP, DOOR, RUBBLE, SHOP,
  DOOR_OPEN, DOOR_LOCKED, DOOR_BROKEN, WEB, WATER, CAMP, ALTAR, EVENT, ANVIL, PROP, propAt,
} from './world.js';
import * as Game from './game.js';
import { G } from './game.js';
import * as Juice from './juice.js';
import * as Save from './save.js';
import * as Audio from './audio.js';
import * as Meta from './meta.js';

const $ = id => document.getElementById(id);
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  viewW = box.width; viewH = box.height;
  scale = clamp(Math.round(box.width / (CELL_SIZE * 17)), 2, 6);
  cols = Math.ceil(viewW / (CELL_SIZE * scale));
  rows = Math.ceil(viewH / (CELL_SIZE * scale));
  draw();
}

/* The camera is a float that chases the hero rather than a
   integer that snaps to him. Combined with the per-actor
   offsets in juice.js this is what turns a tile hop into a
   step. */
let camX = 0, camY = 0, camReady = false;

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
  setTerrainTheme(L.theme?.id || 'plain');
  const t = CELL_SIZE * scale;
  if (!camReady) snapCamera();

  const jolt = Juice.shakeVec();
  const cx = camX + jolt.x, cy = camY + jolt.y;

  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(0, 0, viewW, viewH);

  const lightR = G.lightRadius || 7;
  const x0 = Math.floor(cx) - 1, y0 = Math.floor(cy) - 1;

  for (let y = y0; y <= cy + rows + 1; y++) {
    for (let x = x0; x <= cx + cols + 1; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const i = idx(x, y);
      if (!L.seen[i]) continue;

      const px = Math.round((x - cx) * t), py = Math.round((y - cy) * t);
      const tile = L.tiles[i];
      const lit = L.vis[i];

      let alpha;
      if (lit) {
        const d = Math.hypot(x - p.x, y - p.y);
        const rid = L.roomOf[i];
        const ambient = (rid >= 0 && L.rooms[rid].lit && rid === L.roomOf[idx(p.x, p.y)]) ? 0.55 : 0;
        alpha = clamp(0.30 + Math.max(ambient, 1 - d / (lightR + 1.5)) * 0.72, 0, 1);
      } else {
        alpha = 0.26;
      }

      ctx.globalAlpha = alpha;

      if (tile === ROCK || tile === SHOP) {
        ctx.drawImage(wallTile(x, y), px, py, t, t);
      } else {
        ctx.drawImage(floorTile(x, y), px, py, t, t);
        if (tile === DOWN)        ctx.drawImage(sprite('stairsDown'), px, py, t, t);
        if (tile === UP)          ctx.drawImage(sprite('stairsUp'),   px, py, t, t);
        if (tile === DOOR)        ctx.drawImage(sprite('door'),       px, py, t, t);
        if (tile === DOOR_OPEN)   ctx.drawImage(sprite('doorOpen'),   px, py, t, t);
        if (tile === DOOR_LOCKED) ctx.drawImage(sprite('doorLocked'), px, py, t, t);
        if (tile === DOOR_BROKEN) ctx.drawImage(sprite('doorBroken'), px, py, t, t);
        if (tile === WEB)         ctx.drawImage(sprite('web'),        px, py, t, t);
        if (tile === WATER)       ctx.drawImage(sprite('water'),      px, py, t, t);
        if (tile === CAMP) {
          const prevA = ctx.globalAlpha;
          ctx.globalAlpha = Math.max(prevA, 0.55 + Math.sin(performance.now() / 300) * 0.12);
          ctx.drawImage(sprite('camp'), px, py, t, t);
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
            if (o.kind === 'brazier' && o.lit) ctx.globalAlpha = 1;
            ctx.drawImage(sprite(o.kind === 'brazier' && o.lit ? 'brazierLit' : o.kind),
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
        ctx.globalAlpha = 1;
        ctx.drawImage(sprite('sign'), px, py, t, t);
        if (shop) ctx.drawImage(sprite(shop.spr), px, py, t, t);
      }

      const keeperId = L.keeperAt?.get(i);
      if (keeperId && L.seen[i]) {
        ctx.globalAlpha = 1;
        // A slow shift of weight, so the town does not look embalmed.
        const sway = Math.sin(performance.now() / 700 + keeperId) * t * 0.035;
        ctx.drawImage(sprite(`keeper:${keeperId}`), px + sway, py, t, t);
      }

      const shopId = L.shopAt.get(i);
      if (shopId && lit) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = PALETTE.y;
        ctx.font = `bold ${Math.floor(t * 0.42)}px ui-monospace, monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(String(shopId), px + t * 0.08, py + t * 0.06);
      }
    }
  }

  ctx.globalAlpha = 1;

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
    ctx.globalAlpha = 1;
  }

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

    /* An elite gets a ring so you can decide to walk away from
       it before you are already in melee with it. */
    if (m.elite?.length && seenNow) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 420) * 0.18;
      ctx.strokeStyle = m.elite.length > 1 ? PALETTE.P : PALETTE.o;
      ctx.lineWidth = Math.max(1.5, t * 0.09);
      ctx.beginPath();
      ctx.arc(mx + t / 2, my + t / 2, t * 0.56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    blitActor(sprite(m.spr), mx, my, t, o);
    if (m.disguise) continue;     // no sleep marker, no health bar — it is furniture

    /* A sleeping target is a free critical, so say so plainly —
       an opportunity the player can't see isn't a decision. */
    if (seenNow && !m.awake) {
      const zx = mx + t * 0.86;
      const zy = my - t * 0.06 + Math.sin(performance.now() / 500) * t * 0.09;
      ctx.font = `900 ${Math.floor(t * 0.62)}px ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, t * 0.16);
      ctx.strokeStyle = PALETTE.k;
      ctx.strokeText('z', zx, zy);
      ctx.fillStyle = PALETTE.B;
      ctx.fillText('z', zx, zy);
    }

    if (seenNow && m.awake && m.intent) drawIntent(m.intent, mx, my, t);

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
  glow.addColorStop(0, 'rgba(217,138,60,0.16)');
  glow.addColorStop(1, 'rgba(217,138,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, viewW, viewH);
  blitActor(heroSprite(p), hx - t / 2, hy - t / 2, t, po);

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
    ctx.font = `900 ${Math.floor(t * 0.78 * pop)}px ui-monospace, monospace`;
    ctx.lineWidth = Math.max(3, t * 0.24);
    ctx.strokeStyle = PALETTE.k;
    ctx.strokeText(String(h.left), mx2, my2);
    ctx.fillStyle = urgent ? PALETTE.W : (PALETTE[h.tone] || PALETTE.o);
    ctx.fillText(String(h.left), mx2, my2);
  }

  Juice.drawEffects(ctx, cx, cy, t);
  Juice.drawScreenFlash(ctx, viewW, viewH);
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

export function drawMini() {
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
      if (!tone) tone = L.vis[i] ? 'G' : 'g';
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

const SPELL_ICONS = {
  bolt:   [arrow,                                     'P'],
  blink:  [zigzag,                                    'B'],
  detect: [eye,                                       'y'],
  frost:  [flake,                                     'B'],
  map:    [(c, x, y, r) => grid(c, x, y, r * 0.86),   'G'],
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
   pass that whitens it for a few frames when it takes a hit. */
function blitActor(img, px, py, t, o) {
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

function frame(ts) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(50, ts - (lastTs || ts));
  lastTs = ts;
  if (!G.player) return;

  /* Permadeath: the slot dies with the run. This lives in the
     loop rather than on the ending screen because death can
     arrive from a trap, from poison, or from a monster during
     an auto-walk — and a save that outlives the character would
     quietly turn the whole game into save-scumming. */
  if (!G.running && G.ending && !savedEnding) {
    savedEnding = true;
    Save.clear(activeSlot);
  }

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
  $('hud-hp').textContent    = `${p.hp}/${p.maxhp}`;
  $('hud-hpbar').style.width = `${(p.hp / p.maxhp) * 100}%`;
  $('hud-ac').textContent    = Game.armourClass(p);
  $('hud-gold').textContent  = p.gold;
  /* The chip says where, not only how deep. "9층"은 숫자고
     "잊힌 성소 9층"은 장소다. */
  $('hud-depth').textContent = G.depth === 0
    ? '마을' : `${regionOf(G.depth).n} ${G.depth}층`;
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
  const mana = $('hud-mana-wrap');
  if (CLASSES[p.cls].realm) {
    mana.hidden = false;
    $('hud-mana').textContent = `${p.mana}/${p.maxmana}`;
    $('hud-manabar').style.width = p.maxmana ? `${(p.mana / p.maxmana) * 100}%` : '0%';
  } else mana.hidden = true;

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

  const logBox = $('log');
  logBox.innerHTML = '';
  for (const line of G.log.slice(-4)) logBox.appendChild(el('p', line.tone, line.text));

  $('btn-cast').hidden = !Game.spellSlots().length;
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
    $('hud-bank-n').textContent = `${G.bank}층 ${bp ? bp.gold : 0}닢`;
    wager.classList.toggle('hot', G.bank >= 4);
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

  const rel = $('hud-relics');
  const held = Game.relicList();
  rel.hidden = !held.length;
  $('hud-relics-n').textContent = `${held.length}/${RELIC_SLOTS}`;

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
      b.onclick = null;
      return;
    }
    paintIcon(cv, s.item.spr);
    label.innerHTML = '';
    label.appendChild(document.createTextNode(s.label + ' '));
    const n = el('b', '', `×${s.qty}`);
    label.appendChild(n);
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
function renderSpellRow() {
  const row = $('spell-row');
  const slots = Game.spellSlots();
  row.hidden = !slots.length;
  if (!slots.length) return;
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
      label.appendChild(el('b', '', String(s.cost)));
      b.title = s.silent ? `${s.name} — 침묵의 서약으로 봉인됨`
              : s.noTarget ? `${s.name} — 시야에 적이 없다`
              : `${s.name} · ${s.cost}mp`;
    }
    b.onclick = () => { stopAuto(); act(() => Game.cast(s.id)); };
  });
}

/* ── screens ────────────────────────────────────────────── */
export function setScreen(name) {
  G.screen = name;
  if (name !== 'play') stopAuto();
  for (const s of ['title', 'create', 'play', 'inv', 'shop', 'spell', 'end', 'help',
                   'camp', 'slots', 'altar', 'stairs', 'relic', 'event', 'anvil'])
    $(`sc-${s}`).hidden = (s !== name);
  if (name === 'play') { resize(); refresh(); }
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
  for (const realm of ['arcane', 'divine'])
    for (const s of SPELLS[realm]) {
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
    row.appendChild(el('span', 'eqname',
      `${s.names.join(' · ')} — ${s.lv}레벨 · ${s.cost}mp · ${s.desc}`));
    sbox.appendChild(row);
  }
}

/* ── confirm ────────────────────────────────────────────────
   A Y/N gate in the game's own type rather than the browser's.
   Native confirm() blocks the render loop and looks like a
   security warning, which is the wrong tone for "이 검을 살까". */
let askResolve = null;

export function ask(text, sub, onYes) {
  $('ask-text').textContent = text;
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
        `${info.depth === 0 ? '마을' : info.depth + '층'} · HP ${info.hp}/${info.maxhp}` +
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
        if (!Save.load(i)) { ask('저장을 읽지 못했습니다.', '파일이 손상되었을 수 있습니다.', null); return; }
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

export function refreshTitle() {
  const btn = $('btn-load');
  if (btn) btn.hidden = !(Save.available() && Save.anySaved());

  /* The ledger, on the screen where 새 게임 is pressed. Six rows,
     each with what it wants and how far along you are — "34/50
     상자" is a reason to open the next one. A memory that is
     earned but invisible is a memory that does not make anybody
     press the button again. */
  const meta = Meta.read();
  const box = $('memories');
  box.innerHTML = '';
  const any = MEMORIES.some(x => x.at(meta) > 0);
  box.hidden = !any;
  if (any) {
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
  }

  /* 심연 only exists once the thing at the bottom is dead. */
  const pick = $('abyss-pick');
  const unlocked = memoryEarned(meta, 'ember');
  pick.hidden = !unlocked;
  if (unlocked) {
    const row = pick.querySelector('.abyssrow');
    row.innerHTML = '';
    const at = Meta.abyss();
    ABYSS.forEach(a => {
      const b = el('button', a.n === at ? 'on' : '', String(a.n));
      b.onclick = () => { Meta.setAbyss(a.n); refreshTitle(); };
      row.appendChild(b);
    });
    $('abyss-note').textContent = ABYSS[at].t;
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
    b.appendChild(el('span', 'pmod', c.trait ? c.trait.n : (c.realm ? '주문' : '무주문')));
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
function renderInventory() {
  const p = G.player;
  const eq = $('equip-list'); eq.innerHTML = '';
  const slots = [['weapon', '무기'], ['body', '갑옷'], ['shield', '방패']];
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
        it.kind === 'weapon' ? `${it.dice[0]}d${it.dice[1]}` : `AC ${it.ac}`));
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
  p.pack.forEach((slot, i) => {
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
      : it.kind === 'cat' ? `촉매 · ${it.t}`
      : Game.isKnown(it.id) ? (it.desc || '사용 가능') : '마셔 보기 전에는 알 수 없다'));
    const pt = plusText(it);
    if (pt) mid.appendChild(el('span', 'idesc plus', pt));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact',
      it.kind === 'cat' ? '모루에서' : it.kind === 'use' ? '사용' : '장착'));
    // A catalyst is not a thing you use here — it is a thing you
    // throw into a strike at the anvil, so the row only reads.
    if (it.kind === 'cat') row.disabled = true;
    row.onclick = () => {
      if (it.kind === 'cat') return;
      if (it.kind === 'use' && !Game.isKnown(it.id)) {
        ask(`${Game.lookOf(it.id)}을(를) 써 볼까요?`,
            '무엇인지 알 수 없습니다. 좋을 수도, 아닐 수도.',
            () => { Game.useItem(i); renderInventory(); refresh(); });
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
  $('shop-name').textContent = `${shop.id}. ${shop.n}`;
  $('shop-gold').textContent = p.gold;

  const buyList = $('shop-buy'); buyList.innerHTML = '';
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
      : (item.desc || '')));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', `${cost}g`));
    row.onclick = () => {
      if (p.gold < cost) { Game.say('금화가 모자란다.', 'warn'); refresh(); return; }
      ask(`${affixName(item)}을(를) ${cost}금에 사시겠습니까?`,
          `가진 금화 ${p.gold} → ${p.gold - cost}`,
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
  const spells = Game.spellList(p);
  if (!spells.length) list.appendChild(el('p', 'empty', '아직 익힌 주문이 없다.'));
  $('spell-mana').textContent = `${p.mana}/${p.maxmana}`;
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

function nameEl(it, extra) {
  const n = el('span', 'iname', shownName(it) + (extra || ''));
  if (!Game.isKnown(it.id)) { n.style.color = 'var(--P)'; return n; }
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

  const options = [
    { id:'rest', n:'휴식', desc:
        `체력 +${heal} (최대의 ${Math.round(Game.CAMP_HEAL * 100)}%) · 마나 회복 · 모든 상태이상 해제`,
      tag: p.hp < p.maxhp * 0.5 ? '지금은 이게 답일지도' : '공짜' },
  ];

  /* Only offered when there is something to offer. A dead row
     that says "you need two relics" is a row that is dead for
     most of most runs. */
  if (Game.canFuse()) options.push({
    id:'fuse', n:'융합', desc:
      `유물 둘을 불에 넣는다. 대부분은 도박이지만, 서로를 알아보는 짝이 있다. (${Game.costText(FUSE_COST)})`,
    tag: Game.canAfford(FUSE_COST) ? '유물 둘 소모' : '재료 부족',
    poor: !Game.canAfford(FUSE_COST),
  });

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
function renderCampTargets() {
  $('camp-choices').hidden = true;
  $('camp-targets').hidden = false;
  $('camp-target-head').textContent = '무엇과 무엇을 넣을까';
  teach('fuse');
  renderFuse();
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
  $('anvil-depth').textContent = G.depth ? `${G.depth}층` : '마을';
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
      ? `무작위 속성을 건다. 다섯에 하나는 저주. ${Game.costText(ENCHANT_COST)}`
      : anvilMode === 'reroll'
      ? `이미 붙은 속성을 다시 굴린다. 저주는 절대 붙지 않는다. ${Game.costText(REROLL_COST)}`
      : campCareful
      ? `값은 ${CAREFUL_MULT}배. 성공률 +${Math.round(CAREFUL_BONUS * 100)}%p, 실패해도 깎이거나 부서지지 않는다.`
      : `값은 그대로. ${Math.round(UPGRADE_CRIT * 100)}% 확률로 두 단계가 오른다 — 대신 실패하면 깎이고, 깊은 +에서는 부서진다.`;

  renderCatalysts();
  renderAnvilTargets();
}

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
    if (anvilMode === 'upgrade') {
      const cost = Game.upgradeCostFor(t.key, campCareful);
      const bet = Game.upgradeOddsFor(t.key, campCareful, anvilCat);
      blocked = t.capped || !Game.canAfford(cost);
      if (t.capped) label = `최대 +${t.cap}`;
      else {
        /* The bet, printed. Odds on the right where the price used
           to be, and what a failure costs written into the row —
           the altar taught this game that a gamble is only fun
           when you can see its shape before you take it. */
        label = `${Math.round(bet.odds * 100)}%`;
        const risk = bet.breakPct ? `실패 시 −1 또는 ${Math.round(bet.breakPct * 100)}% 파괴`
                   : bet.down     ? '실패 시 −1'
                   : '실패해도 손해는 값뿐';
        const line = el('span', 'idesc bet',
          `+${t.plus} → +${t.plus + (bet.crit >= 1 ? 2 : 1)} · ${risk} · ${Game.costText(cost)}`);
        if (bet.breakPct) line.classList.add('danger');
        mid.appendChild(line);
        /* The milestone gets its own line and its own colour. It
           is the only strike where success changes what the item
           *is*, and the odds are visibly worse for exactly that. */
        if (bet.milestone) {
          const mk = el('span', 'idesc mark',
            `이 한 방에 각인이 새겨진다 — 그래서 성공률이 ` +
            `${Math.round(ENGRAVE_PENALTY * 100)}%p 낮다.`);
          mid.appendChild(mk);
        }
      }
    } else if (anvilMode === 'reroll') {
      blocked = (t.kind === 'spell' ? false : !(t.item?.pre || t.item?.suf))
             || !Game.canAfford(REROLL_COST);
      label = blocked ? (Game.canAfford(REROLL_COST) ? '속성 없음' : '재료 부족') : '재련';
    } else {
      blocked = !Game.canAfford(ENCHANT_COST);
      label = blocked ? '재료 부족' : '인챈트';
    }
    if (blocked) { row.classList.add('poor'); row.disabled = true; }
    row.appendChild(el('span', 'iact', label));

    if (!blocked) row.onclick = () => {
      if (anvilMode !== 'upgrade') {
        Game.anvilEnchant(t.key, anvilMode === 'reroll', anvilCat);
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
  $('camp-target-head').textContent = '무엇과 무엇을 넣을까';

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
    setScreen('play');
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
    rows.push(['속도', `${(m.spd || 1).toFixed(2)}× ${m.spd > 1 ? '(당신보다 빠름)' : m.spd < 1 ? '(느림)' : ''}`]);
    if (m.rng) rows.push(['사거리', `${m.rng}칸에서 쏜다`]);
    if (m.on) rows.push(['맞으면', AILMENTS[m.on].n]);
    if (m.regen) rows.push(['재생', `턴마다 ${m.regen}`]);
    if (m.door) rows.push(['문', m.door === 'smash' ? '부순다' : '연다']);
    if (m.heavy) rows.push(['내리치기', '한 턴 당긴 뒤 2.5배']);
    if (m.casts?.length)
      rows.push(['바닥 공격', m.casts.map(k => PATTERNS[k].n).join(' · ')]);
    if (m.elite?.length) rows.push(['정예 속성', m.elite.join(' · ')]);
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
        brazier: prop.lit ? '이미 타고 있다.'
                          : '불을 옮기면 기름이 260턴어치 아껴진다. 대신 주변 일곱 칸이 전부 깨어난다.',
        pillar:'길을 막는다. 부술 수 있지만 소리가 아홉 칸을 건넌다.',
        bones:'셋에 하나는 아래에 무언가가 자고 있다.',
        urn:'다섯에 하나는 터지고 독을 남긴다. 절반쯤은 값어치가 있다.',
      }[prop.kind]]);
      if (prop.kind !== 'brazier') rows.push(['남은 내구', `${prop.hp}`]);
      const box0 = $('look-rows');
      box0.innerHTML = '';
      $('look-name').textContent = title;
      $('look-sub').textContent = sub;
      for (const [k, v] of rows) {
        const row = el('div', 'endrow');
        row.appendChild(el('span', 'endlabel', k));
        row.appendChild(el('span', 'endval', v));
        box0.appendChild(row);
      }
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
  for (const [k, v] of rows) {
    const row = el('div', 'endrow');
    row.appendChild(el('span', 'endlabel', k));
    row.appendChild(el('span', 'endval', v));
    box.appendChild(row);
  }
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
  { id:'fight',  t:'적에게 <b>부딪치면</b> 공격입니다. 잠든 적(z)을 치면 <b>무조건 치명타</b>입니다 — 돌아가서라도 먼저 치세요.' },
  { id:'intent', t:'깨어난 적은 머리 위에 <b>다음 턴에 할 일</b>을 겁니다. 도움말의 그림표에 전부 있습니다.' },
  { id:'heavy',  t:'<b>붉은 별</b>은 다음 턴에 2.5배로 내리친다는 뜻입니다.<br>' +
                    '<b>같은 방향을 빠르게 두 번</b> 누르면 두 칸 굴러 피합니다(기력 2).' },
  { id:'ground', t:'바닥이 칠해지고 숫자가 뜨면 <b>그 칸이 곧 맞습니다.</b> 숫자는 남은 턴 수입니다. 나가거나 구르세요.' },
  { id:'fire',   t:'모닥불은 <b>한 번만</b> 씁니다 — 휴식 · 판돈 · 유물 융합 중 하나.<br>' +
                    '쇠를 두들기는 일(강화 · 인챈트 · 재련)은 <b>모루</b>에서 하고, 모루는 닳지 않습니다.' },
  { id:'fork',   t:'계단이 갈라지면 <b>주는 것과 가져가는 것이 전부 적혀 있습니다.</b> 평범한 계단은 항상 있습니다.' },
  { id:'relic',  t:'<b>유물</b>은 숫자가 아니라 규칙을 바꿉니다. 자리는 4칸에서 시작해 7칸까지 늘어납니다.' },
  { id:'clock',  t:'층마다 <b>여유 턴</b>이 있습니다. 다 쓰면 몬스터가 계속 나타납니다 — 그때는 정리를 포기하고 계단으로.' },
  { id:'bank',   t:'쉬지 않고 내려갈수록 <b>판돈</b>이 불어납니다. 모닥불에서 챙길 수 있고, <b>죽으면 전부 잃습니다.</b>' },
  { id:'oil',    t:'기름이 줄면 <b>보이는 반경이 좁아집니다.</b> 횃불을 쓰거나, 좁은 시야로 싸우거나.' },
  { id:'prop',   t:'방 안의 통 · 화로 · 기둥 · 뼈 무더기 · 항아리는 <b>부딪치면</b> 상호작용합니다.<br>' +
                    '화로는 <b>기름을 아껴 주지만 주변을 깨웁니다.</b> 항아리는 다섯에 하나가 터집니다. ' +
                    '<b>탭해서 살펴보면</b> 확률이 적혀 있습니다.' },
  { id:'thief',  t:'<b>금빛 도둑</b>은 보자마자 달아납니다. 걸어서는 절대 못 잡습니다 — 구르거나 주문을 쓰거나, 보내주거나.' },
  { id:'cast',   t:'주문은 <b>아래 줄의 아이콘을 눌러 바로</b> 씁니다(단축키 <b>1~5</b>).<br>' +
                    '어두운 칸은 아직 못 배웠거나, 마나가 모자라거나, <b>쏠 대상이 없다</b>는 뜻입니다.' },
  { id:'fuse',   t:'유물 <b>둘</b>을 불에 넣으면 하나가 나옵니다 — 보통은 확률표대로.<br>' +
                    '하지만 <b>서로를 알아보는 짝</b>이 여섯 있습니다. 목록은 없습니다. ' +
                    '<b>유물 설명의 마지막 문장</b>이 짝을 가리킵니다.' },
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
  $('lesson-text').innerHTML = l.t;
  $('lesson').hidden = false;
}

function closeLesson() {
  $('lesson').hidden = true;
  if (lessonQueue.length) showLesson(); else teaching = false;
}

/* Read once per frame from the loop: the rules layer sets flags
   on G and never has to know a teaching system exists. */
export function checkLessons() {
  if (!Meta.isNewcomer() || !G.player || G.screen !== 'play') return;
  if (G.depth > 0) teach('move');
  if (Game.spellSlots().length) teach('cast');
  if (G.monsters.some(m => G.level.vis[idx(m.x, m.y)])) teach('fight');
  if (G.monsters.some(m => m.awake && m.intent && G.level.vis[idx(m.x, m.y)])) teach('intent');
  if (G.monsters.some(m => m.intent === 'heavy' || m.intent === 'wind')) teach('heavy');
  if (G.hazards.length) teach('ground');
  if (G.bank >= 2) teach('bank');
  if (G.player.lightTurns < 320) teach('oil');
  if (G.monsters.some(m => m.thief && G.level.vis[idx(m.x, m.y)])) teach('thief');
  if (Game.pressureLevel() > 0) teach('clock');
  if ((G.player.relics || []).length) teach('relic');
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

  for (const o of offer.opts) {
    const row = el('button', 'campopt' + (o.can ? '' : ' poor'));
    if (!o.can) row.disabled = true;
    const head = el('div', 'camphead');
    head.appendChild(el('span', 'campname', o.n));
    if (!o.can) head.appendChild(el('span', 'camptag', '조건이 안 된다'));
    row.appendChild(head);
    if (o.t) row.appendChild(el('span', 'campdesc', o.t));
    if (o.can) row.onclick = () => {
      Game.eventChoose(o.i);
      // An option can hand off to another screen — a relic swap,
      // the fire. Follow it rather than stamping over it.
      setScreen(INTERRUPTS.includes(G.screen) ? G.screen : 'play');
      refresh();
    };
    list.appendChild(row);
  }
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
  if (named) bits.push(`<b class="danger">${named.warn}.</b> 계단 방에는 없다 — 피해서 내려갈 수 있다.`);
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
  if (recorded !== s) { recorded = s; Meta.finish(s); }
  const m = Meta.read();

  $('end-title').textContent = e.win ? '대군주가 무너졌다' : '당신은 죽었다';
  $('end-sub').textContent = e.win
    ? `${MAX_DEPTH}층에서, 등불을 든 채로.`
    : `${s.depth === 0 ? '마을' : s.depth + '층'}에서 ${e.by}에게.`;

  const box = $('end-body');
  box.innerHTML = '';

  const line = (label, value, tone) => {
    const row = el('div', 'endrow');
    row.appendChild(el('span', 'endlabel', label));
    const v = el('span', 'endval', value);
    if (tone) v.style.color = `var(--${tone})`;
    row.appendChild(v);
    box.appendChild(row);
  };

  line('인물', `${RACES[s.race || p.race].name} ${CLASSES[s.cls || p.cls].name} · Lv ${s.lv}`);
  line('도달', `${s.depth}층 / ${MAX_DEPTH}`, s.depth >= 10 ? 'o' : '');
  line('무기', s.weapon || '맨손', s.weaponType ? 'w' : 'g');
  if (s.relics?.length)
    line('유물', s.relics.map(id => relicById(id)?.n).filter(Boolean).join(' · '), 'P');
  else line('유물', '없음', 'g');
  line('최고 연격', `${s.combo}`, s.combo >= 10 ? 'y' : '');
  line('처치 · 상자 · 사건', `${s.kills || 0} · ${s.opened || 0} · ${s.events || 0}`);
  line('금화 · 턴', `${s.gold}닢 · ${s.turn}턴`);
  if (s.forged) line('벼려 올린 +', `${s.forged}단계`, 'y');
  if (s.broke) line('불에 잃은 장비', `${s.broke}점`, 'R');
  if (s.perfects) line('절단', `${s.perfects}번`, 'W');
  if (s.fused) line('찾아낸 조합', `${s.fused}가지`, 'W');
  if (s.abyss) line('심연', `${s.abyss}단계`, 'R');
  if (s.trans) line('초월', `${s.trans}점 — 이 판을 기억하시오.`, 'W');
  if (s.bank >= 2) line('잃은 판돈', `${s.bank}층치`, 'R');
  if (s.waves) line('심연의 습격', `${s.waves}번`, 'R');

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
const INTERRUPTS = ['shop', 'camp', 'altar', 'stairs', 'relic', 'event', 'anvil'];

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

   The window is deliberately short. A player walking with taps
   must not roll by accident, and 260ms is faster than a walking
   cadence but comfortably within a deliberate double-tap. */
const DOUBLE_TAP = 260;
let lastTap = { dx: 0, dy: 0, at: -1e9 };

function press(dx, dy) {
  route = null;

  if (dx || dy) {
    const now = performance.now();
    if (lastTap.dx === dx && lastTap.dy === dy && now - lastTap.at < DOUBLE_TAP) {
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

export function bindInput() {
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
  $('look').addEventListener('pointerdown', e => {
    if (e.target.id === 'look') $('look').hidden = true;   // tap the backdrop
  });

  const soundBtn = $('btn-sound');
  const paintSound = () => { soundBtn.textContent = Audio.isMuted() ? '소리 꺼짐' : '소리 켜짐'; };
  soundBtn.onclick = () => { Audio.init(); Audio.toggleMute(); paintSound(); };
  paintSound();

  $('btn-inv').onclick    = () => { stopAuto(); setScreen('inv'); };
  $('btn-cast').onclick   = () => { stopAuto(); setScreen('spell'); };
  $('btn-down').onclick   = () => { stopAuto(); act(Game.descend); };
  $('btn-up').onclick     = () => { stopAuto(); act(Game.ascend); };
  $('btn-door').onclick   = () => { stopAuto(); act(Game.closeDoor); };
  $('btn-help').onclick   = () => { stopAuto(); setScreen('help'); };
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => setScreen('play');

  window.addEventListener('keydown', e => {
    // The modal owns the keyboard while it is up.
    if (asking()) {
      const k = e.key.toLowerCase();
      if (k === 'y' || k === 'enter') { e.preventDefault(); closeAsk(true); }
      else if (k === 'n' || k === 'escape') { e.preventDefault(); closeAsk(false); }
      return;
    }
    if (G.screen === 'end') { if (e.key === 'Enter') location.reload(); return; }
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
    return {
      x: Math.floor(cx + (clientX - box.left) / t),
      y: Math.floor(cy + (clientY - box.top) / t),
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
