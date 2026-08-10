/* ═══════════════════════════════════════════════════════════
   ui.js — canvas for the dungeon, DOM text for everything
   else. Korean needs real font shaping, so the chrome stays
   in the DOM; only the map is pixels.
   ═══════════════════════════════════════════════════════════ */

import { sprite, wallTile, floorTile, CELL_SIZE, PALETTE } from './pixels.js';
import {
  RACES, CLASSES, STATS, STAT_NAME, MAX_DEPTH, SHOPS,
  xpToLevel, statBonus,
} from './data.js';
import { MW, MH, idx, clamp, ROCK, FLOOR, DOWN, UP, DOOR, RUBBLE, SHOP } from './world.js';
import * as Game from './game.js';
import { G } from './game.js';

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

function camera() {
  const p = G.player, t = CELL_SIZE * scale;
  let cx = clamp(p.x - (cols >> 1), 0, Math.max(0, MW - cols));
  let cy = clamp(p.y - (rows >> 1), 0, Math.max(0, MH - rows));
  if (MW < cols) cx = -Math.floor((cols - MW) / 2);
  if (MH < rows) cy = -Math.floor((rows - MH) / 2);
  return { cx, cy, t };
}

/* ── the map ────────────────────────────────────────────── */
export function draw() {
  if (!G.level || !G.player) return;
  const L = G.level, p = G.player;
  const { cx, cy, t } = camera();

  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(0, 0, viewW, viewH);

  const lightR = G.lightRadius || 7;

  for (let y = cy; y <= cy + rows; y++) {
    for (let x = cx; x <= cx + cols; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const i = idx(x, y);
      if (!L.seen[i]) continue;

      const px = (x - cx) * t, py = (y - cy) * t;
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
        if (tile === DOWN)   ctx.drawImage(sprite('stairsDown'), px, py, t, t);
        if (tile === UP)     ctx.drawImage(sprite('stairsUp'),   px, py, t, t);
        if (tile === DOOR)   ctx.drawImage(sprite('door'),       px, py, t, t);
        if (tile === RUBBLE) ctx.drawImage(sprite('rubble'),     px, py, t, t);
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

  for (const it of G.items) {
    if (!L.vis[idx(it.x, it.y)]) continue;
    ctx.drawImage(sprite(it.spr), (it.x - cx) * t, (it.y - cy) * t, t, t);
  }

  for (const m of G.monsters) {
    const seenNow = L.vis[idx(m.x, m.y)];
    if (!seenNow && !(G.detectPulse > 0)) continue;
    ctx.globalAlpha = seenNow ? 1 : 0.45;
    ctx.drawImage(sprite(m.spr), (m.x - cx) * t, (m.y - cy) * t, t, t);
    if (seenNow && m.hp < m.maxhp) {
      const w = Math.round(t * (m.hp / m.maxhp));
      ctx.fillStyle = PALETTE.r;
      ctx.fillRect((m.x - cx) * t, (m.y - cy) * t + t - 2, t, 2);
      ctx.fillStyle = PALETTE.R;
      ctx.fillRect((m.x - cx) * t, (m.y - cy) * t + t - 2, w, 2);
    }
  }
  ctx.globalAlpha = 1;

  // the lamp glow, then the hero on top
  const hx = (p.x - cx) * t + t / 2, hy = (p.y - cy) * t + t / 2;
  const glow = ctx.createRadialGradient(hx, hy, t * 0.4, hx, hy, t * lightR);
  glow.addColorStop(0, 'rgba(217,138,60,0.16)');
  glow.addColorStop(1, 'rgba(217,138,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.drawImage(sprite(`hero:${p.cls}`), (p.x - cx) * t, (p.y - cy) * t, t, t);
}

/* ── HUD ────────────────────────────────────────────────── */
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

  const flags = [];
  if (p.food <= 0) flags.push('굶주림');
  else if (p.food < 400) flags.push('허기');
  if (G.depth > 0 && p.lightTurns <= 0) flags.push('암흑');
  else if (G.depth > 0 && p.lightTurns < 200) flags.push('불빛 희미');
  if (p.blessed > 0) flags.push('축복');
  $('hud-flags').textContent = flags.join(' · ');
  $('hud-flags').className = flags.length ? 'flags on' : 'flags';

  const logBox = $('log');
  logBox.innerHTML = '';
  for (const line of G.log.slice(-4)) logBox.appendChild(el('p', line.tone, line.text));

  $('btn-cast').hidden = Game.spellList(p).length === 0;
  draw();
}

/* ── screens ────────────────────────────────────────────── */
export function setScreen(name) {
  G.screen = name;
  for (const s of ['title', 'create', 'play', 'inv', 'shop', 'spell', 'end', 'help'])
    $(`sc-${s}`).hidden = (s !== name);
  if (name === 'play') { resize(); refresh(); }
  if (name === 'inv')  renderInventory();
  if (name === 'shop') renderShop();
  if (name === 'spell') renderSpells();
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
      row.appendChild(el('span', 'eqname', it.n));
      row.appendChild(el('span', 'eqstat',
        it.kind === 'weapon' ? `${it.dice[0]}d${it.dice[1]}` : `AC ${it.ac}`));
    } else {
      row.appendChild(el('span', 'eqname dim', '없음'));
    }
    eq.appendChild(row);
  }

  const list = $('pack-list'); list.innerHTML = '';
  if (!p.pack.length) list.appendChild(el('p', 'empty', '배낭이 비었다.'));
  p.pack.forEach((slot, i) => {
    const it = slot.item;
    const row = el('button', 'itemrow');
    const ic = el('canvas', 'icon'); paintIcon(ic, it.spr);
    row.appendChild(ic);
    const mid = el('div', 'imid');
    mid.appendChild(el('span', 'iname', it.n + (slot.qty > 1 ? ` ×${slot.qty}` : '')));
    mid.appendChild(el('span', 'idesc',
      it.kind === 'weapon' ? `피해 ${it.dice[0]}d${it.dice[1]}${it.hands === 2 ? ' · 양손' : ''}`
      : it.kind === 'armour' ? `방어 +${it.ac}`
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
    mid.appendChild(el('span', 'iname', item.n));
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
    mid.appendChild(el('span', 'iname', slot.item.n + (slot.qty > 1 ? ` ×${slot.qty}` : '')));
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
    const row = el('button', 'itemrow' + (p.mana < s.cost ? ' poor' : ''));
    const mid = el('div', 'imid');
    mid.appendChild(el('span', 'iname', s.name));
    mid.appendChild(el('span', 'idesc', s.desc));
    row.appendChild(mid);
    row.appendChild(el('span', 'iact', `${s.cost}mp`));
    row.onclick = () => { Game.cast(s.id); setScreen('play'); refresh(); };
    list.appendChild(row);
  }
}

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

/* ── input ──────────────────────────────────────────────── */
const DIRS = {
  ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1],
  h:[-1,0], l:[1,0], k:[0,-1], j:[0,1],
  y:[-1,-1], u:[1,-1], b:[-1,1], n:[1,1], '.':[0,0], ' ':[0,0],
};

function act(fn) { fn(); refresh(); if (G.screen === 'end') setScreen('end'); }

export function bindInput() {
  for (const btn of document.querySelectorAll('#dpad button')) {
    btn.onclick = () => {
      const [dx, dy] = btn.dataset.dir.split(',').map(Number);
      act(() => Game.step(dx, dy));
      if (G.screen === 'shop') setScreen('shop');
    };
  }

  $('btn-inv').onclick    = () => setScreen('inv');
  $('btn-cast').onclick   = () => setScreen('spell');
  $('btn-down').onclick   = () => act(Game.descend);
  $('btn-up').onclick     = () => act(Game.ascend);
  $('btn-help').onclick   = () => setScreen('help');
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => setScreen('play');

  window.addEventListener('keydown', e => {
    if (G.screen === 'end') { if (e.key === 'Enter') location.reload(); return; }
    if (G.screen !== 'play') { if (e.key === 'Escape') setScreen('play'); return; }
    if (DIRS[e.key]) { e.preventDefault(); act(() => Game.step(...DIRS[e.key])); if (G.screen === 'shop') setScreen('shop'); }
    else if (e.key === '>') act(Game.descend);
    else if (e.key === '<') act(Game.ascend);
    else if (e.key === 'i') setScreen('inv');
    else if (e.key === 'm') setScreen('spell');
  });

  // swipe and tap on the map
  let sx = 0, sy = 0, st = 0;
  cv.addEventListener('touchstart', e => {
    const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });

  cv.addEventListener('touchend', e => {
    if (G.screen !== 'play') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) {
      if (Date.now() - st > 800) return;
      const box = cv.getBoundingClientRect();
      const { cx, cy, t: ts } = camera();
      const tx = cx + Math.floor((t.clientX - box.left) / ts);
      const ty = cy + Math.floor((t.clientY - box.top) / ts);
      act(() => Game.step(Math.sign(tx - G.player.x), Math.sign(ty - G.player.y)));
    } else {
      const oct = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
      const V = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
      act(() => Game.step(...V[oct]));
    }
    if (G.screen === 'shop') setScreen('shop');
  }, { passive: true });

  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
}

export { pick };
