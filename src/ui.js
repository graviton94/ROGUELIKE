/* ═══════════════════════════════════════════════════════════
   ui.js — canvas for the dungeon, DOM text for everything
   else. Korean needs real font shaping, so the chrome stays
   in the DOM; only the map is pixels.
   ═══════════════════════════════════════════════════════════ */

import { sprite, wallTile, floorTile, CELL_SIZE, PALETTE } from './pixels.js';
import {
  RACES, CLASSES, STATS, STAT_NAME, MAX_DEPTH, SHOPS, AILMENTS, TRAPS,
  PREFIXES, SUFFIXES, SPELL_AFFIXES, affixName, MATS, ENCHANT_COST, REROLL_COST,
  RARITY, CURSED_TONE, rarityOf, isCursed,
  RELIC_SLOTS, relicById,
  xpToLevel, statBonus,
} from './data.js';
import {
  MW, MH, idx, clamp, walkable, isDoor,
  ROCK, FLOOR, DOWN, UP, DOOR, RUBBLE, SHOP,
  DOOR_OPEN, DOOR_LOCKED, DOOR_BROKEN, WEB, WATER, CAMP, ALTAR,
} from './world.js';
import * as Game from './game.js';
import { G } from './game.js';
import * as Juice from './juice.js';
import * as Save from './save.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const cv = $('map'), ctx = cv.getContext('2d');
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
      const beam = ctx.createLinearGradient(0, iy - t * 3.2, 0, iy + t);
      beam.addColorStop(0, 'transparent');
      beam.addColorStop(1, glow);
      ctx.globalAlpha = pulse * (grade >= 3 ? 0.5 : 0.34);
      ctx.fillStyle = beam;
      ctx.fillRect(ix + t * 0.28, iy - t * 3.2, t * 0.44, t * 4.2);
      ctx.globalAlpha = pulse * 0.45;
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
  blitActor(sprite(`hero:${p.cls}`), hx - t / 2, hy - t / 2, t, po);

  Juice.drawEffects(ctx, cx, cy, t);
  Juice.drawScreenFlash(ctx, viewW, viewH);
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
function cross(c, x, y, r) {
  const w = r * 0.34;
  for (const s of [1, -1]) {
    c.moveTo(x - r * s, y - r + w); c.lineTo(x - r * s + w * s * 1.5, y - r);
    c.lineTo(x + r * s, y + r - w); c.lineTo(x + r * s - w * s * 1.5, y + r);
    c.closePath();
  }
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
  $('hud-depth').textContent = G.depth === 0 ? '마을' : `${G.depth}층`;
  $('hud-xp').textContent    = `${p.xp}/${xpToLevel(p.lv)}`;

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
  if (p.stuck > 0) flags.push('거미줄');
  if (p.food <= 0) flags.push('굶주림');
  else if (p.food < 400) flags.push('허기');
  if (G.depth > 0 && p.lightTurns <= 0) flags.push('암흑');
  else if (G.depth > 0 && p.lightTurns < 200) flags.push('불빛 희미');
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

  $('btn-cast').hidden = Game.spellList(p).length === 0;

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

  const rel = $('hud-relics');
  const held = Game.relicList();
  rel.hidden = !held.length;
  $('hud-relics-n').textContent = `${held.length}/${RELIC_SLOTS}`;

  draw();
}

/* ── screens ────────────────────────────────────────────── */
export function setScreen(name) {
  G.screen = name;
  if (name !== 'play') stopAuto();
  for (const s of ['title', 'create', 'play', 'inv', 'shop', 'spell', 'end', 'help',
                   'camp', 'slots', 'altar', 'stairs', 'relic'])
    $(`sc-${s}`).hidden = (s !== name);
  if (name === 'play') { resize(); refresh(); }
  if (name === 'inv')  renderInventory();
  if (name === 'shop') renderShop();
  if (name === 'spell') renderSpells();
  if (name === 'camp')  renderCamp();
  if (name === 'altar') renderAltar();
  if (name === 'slots') renderSlots();
  if (name === 'title') refreshTitle();
  if (name === 'end')  renderEnd();
  if (name === 'stairs') renderStairs();
  if (name === 'relic')  renderRelicSwap();
  if (name === 'help')   renderLegend();
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
  ['held',    '거미줄에 묶여 한 턴 쉰다'],
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
}

/* character creation */
let pick = { race: 'human', cls: 'warrior', base: null };

export function renderCreate() {
  pick.base = pick.base || Game.rollStats();

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
    b.appendChild(el('span', 'pmod', c.realm === 'arcane' ? '비전 마법' : c.realm === 'divine' ? '신성 마법' : '무주문'));
    b.onclick = () => { pick.cls = key; renderCreate(); };
    cb.appendChild(b);
  }

  $('race-note').textContent = RACES[pick.race].note;
  $('class-note').textContent = CLASSES[pick.cls].note;

  const sb = $('stat-preview'); sb.innerHTML = '';
  for (const k of STATS) {
    const v = clamp(pick.base[k] + (RACES[pick.race].mod[k] || 0) + (CLASSES[pick.cls].mod[k] || 0), 3, 20);
    const row = el('div', 'statrow');
    row.appendChild(el('span', 'sname', STAT_NAME[k]));
    row.appendChild(el('span', 'sval', String(v)));
    const bar = el('div', 'sbar');
    const fill = el('i');
    fill.style.width = `${(v / 20) * 100}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    sb.appendChild(row);
  }
}

$('btn-reroll').onclick = () => { pick.base = Game.rollStats(); renderCreate(); };
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
      it.kind === 'weapon' ? `${grade ? `[${RARITY[grade].n}] ` : ''}피해 ${it.dice[0]}d${it.dice[1]}${it.hands === 2 ? ' · 양손' : ''}${affixBlurb(it)}`
      : it.kind === 'armour' ? `${grade ? `[${RARITY[grade].n}] ` : ''}방어 +${it.ac}${affixBlurb(it)}`
      : Game.isKnown(it.id) ? (it.desc || '사용 가능') : '마셔 보기 전에는 알 수 없다'));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', it.kind === 'use' ? '사용' : '장착'));
    row.onclick = () => {
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
      item.kind === 'weapon' ? `피해 ${item.dice[0]}d${item.dice[1]}${item.hands === 2 ? ' · 양손' : ''}`
      : item.kind === 'armour' ? `방어 +${item.ac}` : ''));
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
  return parts.length ? ' · ' + parts.join(' · ') : '';
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
    `불은 한 번만 쓸 수 있다. ◍${p.gold} · ${MATS.scrap.n} ${m.scrap} · ` +
    `${MATS.dust.n} ${m.dust} · ${MATS.essence.n} ${m.essence}`;

  const options = [
    { id:'rest', n:'휴식', desc:
        `체력 +${heal} (최대의 ${Math.round(Game.CAMP_HEAL * 100)}%) · 마나 회복 · 모든 상태이상 해제`,
      tag: p.hp < p.maxhp * 0.5 ? '지금은 이게 답일지도' : '공짜' },
    { id:'upgrade', n:'강화', desc:
        '장비를 +1 하거나 주문을 연마한다. 확실하지만 값이 오른다.',
      tag: '재료 소모' },
    { id:'enchant', n:'인챈트', desc:
        `무작위 속성을 건다. 다섯에 하나는 저주. (${Game.costText(ENCHANT_COST)})`,
      tag: Game.canAfford(ENCHANT_COST) ? '도박' : '재료 부족',
      poor: !Game.canAfford(ENCHANT_COST) },
    { id:'reroll', n:'재련', desc:
        `이미 붙은 속성을 다시 굴린다. 저주는 절대 붙지 않는다. (${Game.costText(REROLL_COST)})`,
      tag: Game.canAfford(REROLL_COST) ? '저주 해제' : '재료 부족',
      poor: !Game.canAfford(REROLL_COST) },
  ];

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

function renderCampTargets() {
  $('camp-choices').hidden = true;
  $('camp-targets').hidden = false;
  $('camp-target-head').textContent =
    campMode === 'upgrade' ? '무엇을 강화할까' : campMode === 'reroll' ? '무엇을 재련할까' : '무엇에 걸까';

  const list = $('camp-target-list');
  list.innerHTML = '';
  for (const t of Game.campTargets()) {
    const row = el('button', 'itemrow');
    if (t.item) { const ic = el('canvas', 'icon'); paintIcon(ic, t.item.spr); row.appendChild(ic); }
    const mid = el('div', 'imid');
    const nm = el('span', 'iname', t.name);
    if (t.item) {
      const r = rarityOf(t.item);
      nm.style.color = `var(--${isCursed(t.item) ? CURSED_TONE : RARITY[r].tone})`;
    } else nm.classList.add('magic');
    mid.appendChild(nm);
    mid.appendChild(el('span', 'idesc',
      t.kind === 'spell' ? '주문'
      : t.item.kind === 'weapon' ? `피해 ${t.item.dice[0]}d${t.item.dice[1]}${affixBlurb(t.item)}`
      : `방어 +${t.item.ac}${affixBlurb(t.item)}`));
    row.appendChild(mid);
    // A maxed item can't take the upgrade, so don't offer it as
    // one — a dead button would silently eat the whole fire.
    /* Price the row, and grey it out when it cannot be paid for —
       a dead button would silently eat the whole fire. */
    let blocked = false, label = '?';
    if (campMode === 'upgrade') {
      const cost = Game.upgradeCostFor(t.key);
      blocked = t.capped || !Game.canAfford(cost);
      label = t.capped ? `최대 +${Game.MAX_PLUS}`
            : `+${(t.plus || 0) + 1} · ${Game.costText(cost)}`;
    } else if (campMode === 'reroll') {
      blocked = t.kind === 'spell' ? false : !(t.item?.pre || t.item?.suf);
      label = blocked ? '속성 없음' : '재련';
    }
    if (blocked) { row.classList.add('poor'); row.disabled = true; }
    row.appendChild(el('span', 'iact', label));
    if (!blocked) row.onclick = () => {
      if (campMode === 'upgrade') Game.campUpgrade(t.key);
      else Game.campEnchant(t.key, campMode === 'reroll');
      setScreen('play');
      refresh();
    };
    list.appendChild(row);
  }
}

$('camp-back').onclick = () => { campMode = null; renderCamp(); };

/* ── the altar ──────────────────────────────────────────────
   The odds go on the screen as a bar, not as prose. Seeing that
   "재앙" is a visible red sliver next to a fat green one is the
   whole point — you should be able to feel the shape of the bet
   before you read a single number. */
const ODD_CLASS = { '대성공':'great', '성공':'good', '허탕':'none', '재앙':'doom' };

/* ── the fork ─────────────────────────────────────────────
   Three doors, each with its price printed on it. Everything
   the branch will do is on the card before you commit — that is
   the whole mechanic. A modifier the player discovers after
   descending is a trap, not a choice. */
export function renderStairs() {
  const list = $('stairs-list');
  list.innerHTML = '';
  $('stairs-depth').textContent = `${G.depth + 1}층`;

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
        // A jackpot relic with no free slot opens the swap
        // screen from inside here; don't stamp over it.
        setScreen(G.screen === 'relic' ? 'relic' : 'play');
        refresh();
      });
    };
    list.appendChild(row);
  }
}

$('altar-leave').onclick = () => { setScreen('play'); refresh(); };
$('relic-skip').onclick  = () => { Game.swapRelic(-1); setScreen('play'); refresh(); };

/* ending */
function renderEnd() {
  // The frame loop normally does this; belt and braces for a
  // death that somehow resolves without a frame in between.
  if (!savedEnding) { savedEnding = true; Save.clear(activeSlot); }

  const p = G.player, e = G.ending || {};
  $('end-title').textContent = e.win ? '대군주가 무너졌다' : '당신은 죽었다';
  $('end-sub').textContent = e.win
    ? `${MAX_DEPTH}층에서, 등불을 든 채로.`
    : `${G.depth === 0 ? '마을' : G.depth + '층'}에서 ${e.by}에게.`;
  $('end-body').innerHTML =
    `${RACES[p.race].name} ${CLASSES[p.cls].name} · 레벨 <b>${p.lv}</b><br>` +
    `도달 깊이 <b>${G.depth}층</b> · 금화 <b>${p.gold}</b>닢 · <b>${G.turn}</b>턴`;
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
const INTERRUPTS = ['shop', 'camp', 'altar', 'stairs', 'relic'];

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

/* A step that latches, for keys and buttons that are physically
   held. Holding the centre key rests in place until something
   shows up. */
function press(dx, dy) {
  route = null;
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
      btn.setPointerCapture?.(e.pointerId);
      press(dx, dy);
      if (G.screen === 'camp') setScreen('camp');
      if (G.screen === 'altar') setScreen('altar');
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'])
      btn.addEventListener(ev, release);
  }

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
    if (G.screen === 'camp' || G.screen === 'altar') return;   // decisions, not menus
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
    if (performance.now() - st > 700) return;      // long press: read the map, don't move

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
