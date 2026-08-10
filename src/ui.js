/* ═══════════════════════════════════════════════════════════
   ui.js — canvas for the dungeon, DOM text for everything
   else. Korean needs real font shaping, so the chrome stays
   in the DOM; only the map is pixels.
   ═══════════════════════════════════════════════════════════ */

import { sprite, wallTile, floorTile, CELL_SIZE, PALETTE } from './pixels.js';
import {
  RACES, CLASSES, STATS, STAT_NAME, MAX_DEPTH, SHOPS, AILMENTS, TRAPS,
  PREFIXES, SUFFIXES, SPELL_AFFIXES, affixName,
  xpToLevel, statBonus,
} from './data.js';
import {
  MW, MH, idx, clamp, walkable, isDoor,
  ROCK, FLOOR, DOWN, UP, DOOR, RUBBLE, SHOP,
  DOOR_OPEN, DOOR_LOCKED, DOOR_BROKEN, WEB, WATER, CAMP,
} from './world.js';
import * as Game from './game.js';
import { G } from './game.js';
import * as Juice from './juice.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const cv = $('map'), ctx = cv.getContext('2d');
let scale = 3, viewW = 0, viewH = 0, cols = 0, rows = 0;

/* ── viewport ───────────────────────────────────────────── */
export function resize() {
  const box = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width  = Math.round(box.width  * dpr);
  cv.height = Math.round(box.height * dpr);
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
        if (tile === RUBBLE)      ctx.drawImage(sprite('rubble'),     px, py, t, t);

        // A trap you have spotted is drawn; one you haven't isn't.
        const tr = L.traps.get(i);
        if (tr && tr.seen) ctx.drawImage(sprite('trap'), px, py, t, t);
      }

      // shop numerals painted over the doorway
      const shopId = L.shopAt.get(i);
      if (shopId && lit) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = PALETTE.y;
        ctx.font = `bold ${Math.floor(t * 0.6)}px ui-monospace, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(shopId), px + t / 2, py + t / 2);
      }
    }
  }

  ctx.globalAlpha = 1;

  // Items bob so loot reads as loot even at the edge of the lamp.
  const bob = Math.sin(performance.now() / 380) * t * 0.06;
  for (const it of G.items) {
    if (!L.vis[idx(it.x, it.y)]) continue;
    ctx.drawImage(sprite(it.spr), (it.x - cx) * t, (it.y - cy) * t + bob, t, t);
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

function frame(ts) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(50, ts - (lastTs || ts));
  lastTs = ts;
  if (!G.player || !G.level || G.screen !== 'play') return;

  if (lastDepth !== G.depth) { lastDepth = G.depth; Juice.reset(); snapCamera(); }

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

  const mana = $('hud-mana-wrap');
  if (p.maxmana > 0) {
    mana.hidden = false;
    $('hud-mana').textContent = `${p.mana}/${p.maxmana}`;
    $('hud-manabar').style.width = `${(p.mana / p.maxmana) * 100}%`;
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

  // Shutting a door is only ever offered when there is one to shut.
  $('btn-door').hidden = !Game.doorToClose();

  const logBox = $('log');
  logBox.innerHTML = '';
  for (const line of G.log.slice(-4)) logBox.appendChild(el('p', line.tone, line.text));

  $('btn-cast').hidden = Game.spellList(p).length === 0;
  draw();
}

/* ── screens ────────────────────────────────────────────── */
export function setScreen(name) {
  G.screen = name;
  if (name !== 'play') stopAuto();
  for (const s of ['title', 'create', 'play', 'inv', 'shop', 'spell', 'end', 'help', 'camp'])
    $(`sc-${s}`).hidden = (s !== name);
  if (name === 'play') { resize(); refresh(); }
  if (name === 'inv')  renderInventory();
  if (name === 'shop') renderShop();
  if (name === 'spell') renderSpells();
  if (name === 'camp')  renderCamp();
  if (name === 'end')  renderEnd();
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
$('btn-begin').onclick  = () => { Game.startGame(pick.race, pick.cls, pick.base); setScreen('play'); };

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
      if (it.pre || it.suf) nm.classList.add(cursedItem(it) ? 'cursed' : 'magic');
      row.appendChild(nm);
      row.appendChild(el('span', 'eqstat',
        it.kind === 'weapon' ? `${it.dice[0]}d${it.dice[1]}` : `AC ${it.ac}`));
    } else {
      row.appendChild(el('span', 'eqname dim', '없음'));
    }
    eq.appendChild(row);
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

  const list = $('pack-list'); list.innerHTML = '';
  if (!p.pack.length) list.appendChild(el('p', 'empty', '배낭이 비었다.'));
  p.pack.forEach((slot, i) => {
    const it = slot.item;
    const row = el('button', 'itemrow');
    const ic = el('canvas', 'icon'); paintIcon(ic, it.spr);
    row.appendChild(ic);
    const mid = el('div', 'imid');
    const nameEl = el('span', 'iname', affixName(it) + (slot.qty > 1 ? ` ×${slot.qty}` : ''));
    if (it.pre || it.suf) nameEl.classList.add(cursedItem(it) ? 'cursed' : 'magic');
    mid.appendChild(nameEl);
    mid.appendChild(el('span', 'idesc',
      it.kind === 'weapon' ? `피해 ${it.dice[0]}d${it.dice[1]}${it.hands === 2 ? ' · 양손' : ''}${affixBlurb(it)}`
      : it.kind === 'armour' ? `방어 +${it.ac}${affixBlurb(it)}`
      : it.desc || '사용 가능'));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', it.kind === 'use' ? '사용' : '장착'));
    row.onclick = () => {
      it.kind === 'use' ? Game.useItem(i) : Game.equip(i);
      renderInventory(); refresh();
    };
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
    mid.appendChild(el('span', 'iname', affixName(item)));
    mid.appendChild(el('span', 'idesc',
      item.kind === 'weapon' ? `피해 ${item.dice[0]}d${item.dice[1]}${item.hands === 2 ? ' · 양손' : ''}`
      : item.kind === 'armour' ? `방어 +${item.ac}` : ''));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', `${cost}g`));
    row.onclick = () => { Game.buy(item); renderShop(); refresh(); };
    buyList.appendChild(row);
  }

  const sellList = $('shop-sell'); sellList.innerHTML = '';
  if (!p.pack.length) sellList.appendChild(el('p', 'empty', '팔 물건이 없다.'));
  p.pack.forEach((slot, i) => {
    const row = el('button', 'itemrow');
    const ic = el('canvas', 'icon'); paintIcon(ic, slot.item.spr);
    row.appendChild(ic);
    const mid = el('div', 'imid');
    mid.appendChild(el('span', 'iname', affixName(slot.item) + (slot.qty > 1 ? ` ×${slot.qty}` : '')));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', `+${Game.priceOf(slot.item, false)}g`));
    row.onclick = () => { Game.sell(i); renderShop(); refresh(); };
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

function cursedItem(it) {
  return !!(affixOf(it.pre, PREFIXES)?.curse || affixOf(it.suf, SUFFIXES)?.curse);
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
  const options = [
    { id:'rest', n:'휴식', desc:
        `체력 +${heal} (최대의 ${Math.round(Game.CAMP_HEAL * 100)}%) · 마나 회복 · 모든 상태이상 해제`,
      tag: p.hp < p.maxhp * 0.5 ? '지금은 이게 답일지도' : '이미 멀쩡하다' },
    { id:'upgrade', n:'강화', desc:
        '장비 하나를 +1 하거나 주문 하나를 연마한다. 작지만 확실하고 영구적이다.',
      tag: '확실함' },
    { id:'enchant', n:'인챈트', desc:
        '무작위 접두 또는 접미 속성을 건다. 다섯에 하나는 저주가 붙고, 이미 붙은 성질을 밀어낼 수 있다.',
      tag: '도박' },
  ];

  for (const o of options) {
    const row = el('button', 'campopt');
    const head = el('div', 'camphead');
    head.appendChild(el('span', 'campname', o.n));
    head.appendChild(el('span', 'camptag', o.tag));
    row.appendChild(head);
    row.appendChild(el('span', 'campdesc', o.desc));
    row.onclick = () => {
      if (o.id === 'rest') { Game.campRest(); setScreen('play'); refresh(); return; }
      campMode = o.id;
      renderCampTargets();
    };
    wrap.appendChild(row);
  }
}

function renderCampTargets() {
  $('camp-choices').hidden = true;
  $('camp-targets').hidden = false;
  $('camp-target-head').textContent = campMode === 'upgrade' ? '무엇을 강화할까' : '무엇에 걸까';

  const list = $('camp-target-list');
  list.innerHTML = '';
  for (const t of Game.campTargets()) {
    const row = el('button', 'itemrow');
    if (t.item) { const ic = el('canvas', 'icon'); paintIcon(ic, t.item.spr); row.appendChild(ic); }
    const mid = el('div', 'imid');
    const nm = el('span', 'iname', t.name);
    if (t.item && (t.item.pre || t.item.suf)) nm.classList.add(cursedItem(t.item) ? 'cursed' : 'magic');
    mid.appendChild(nm);
    mid.appendChild(el('span', 'idesc',
      t.kind === 'spell' ? '주문'
      : t.item.kind === 'weapon' ? `피해 ${t.item.dice[0]}d${t.item.dice[1]}${affixBlurb(t.item)}`
      : `방어 +${t.item.ac}${affixBlurb(t.item)}`));
    row.appendChild(mid);
    // A maxed item can't take the upgrade, so don't offer it as
    // one — a dead button would silently eat the whole fire.
    const capped = campMode === 'upgrade' && t.capped;
    if (capped) { row.classList.add('poor'); row.disabled = true; }
    row.appendChild(el('span', 'iact',
      campMode === 'upgrade' ? (capped ? `최대 +${Game.MAX_PLUS}` : `+${(t.plus || 0) + 1}`) : '?'));
    if (!capped) row.onclick = () => {
      campMode === 'upgrade' ? Game.campUpgrade(t.key) : Game.campEnchant(t.key);
      setScreen('play');
      refresh();
    };
    list.appendChild(row);
  }
}

$('camp-back').onclick = () => { campMode = null; renderCamp(); };

/* ending */
function renderEnd() {
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

function act(fn) { fn(); refresh(); if (G.screen === 'end') setScreen('end'); }

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

function takeStep(dx, dy) {
  act(() => Game.step(dx, dy));
  if (G.screen === 'shop') { stopAuto(); setScreen('shop'); return false; }
  if (G.screen === 'camp') { stopAuto(); setScreen('camp'); return false; }
  if (G.screen === 'end') { stopAuto(); return false; }
  return true;
}

/* Driven from the render loop so movement is frame-synced and
   the animation layer always has time to blend between steps. */
export function tickInput(dt) {
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
    if (G.screen === 'end') { if (e.key === 'Enter') location.reload(); return; }
    if (G.screen === 'camp') return;         // the fire is a decision, not a menu
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
