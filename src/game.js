/* ═══════════════════════════════════════════════════════════
   game.js — state and rules. No rendering happens here.
   ═══════════════════════════════════════════════════════════ */

import {
  MAX_DEPTH, STATS, RACES, CLASSES, SPELLS, MONSTERS, BOSS,
  WEAPONS, ARMOURS, CONSUMABLES, SHOPS, xpToLevel, statBonus,
} from './data.js';
import { Level, computeFov, idx, rnd, roll, clamp, MW, MH, FLOOR, DOWN, UP, DOOR, RUBBLE } from './world.js';

export const G = {
  level: null, depth: 0, player: null, monsters: [], items: [],
  log: [], turn: 0, running: false, screen: 'title', shop: null,
  seenBoss: false,
};

export function say(text, tone = '') {
  G.log.push({ text, tone });
  if (G.log.length > 120) G.log.shift();
}

/* ── character creation ─────────────────────────────────── */
export function rollStats() {
  const s = {};
  for (const k of STATS) {
    const d = [roll(1, 6), roll(1, 6), roll(1, 6), roll(1, 6)].sort((a, b) => b - a);
    s[k] = d[0] + d[1] + d[2];   // 4d6 drop lowest
  }
  return s;
}

export function createHero(raceKey, classKey, base) {
  const race = RACES[raceKey], cls = CLASSES[classKey];
  const stats = {};
  for (const k of STATS)
    stats[k] = clamp(base[k] + (race.mod[k] || 0) + (cls.mod[k] || 0), 3, 20);

  const p = {
    race: raceKey, cls: classKey, stats,
    lv: 1, xp: 0,
    hp: 0, maxhp: 0, mana: 0, maxmana: 0,
    gold: 250,
    food: 3000, lightTurns: 2500,
    blessed: 0,
    equip: { weapon: null, body: null, shield: null },
    pack: [],
    x: 0, y: 0,
  };
  recalc(p, true);
  p.hp = p.maxhp; p.mana = p.maxmana;

  addItem(p, makeConsumable('potHeal'), 3);
  addItem(p, makeConsumable('food'), 3);
  addItem(p, makeConsumable('torch'), 2);
  p.equip.weapon = { kind:'weapon', ...WEAPONS[0] };
  p.equip.body   = { kind:'armour', ...ARMOURS[0] };
  return p;
}

export function recalc(p, init) {
  const race = RACES[p.race], cls = CLASSES[p.cls];
  const conB = statBonus(p.stats.con);
  p.maxhp = Math.max(8, Math.floor((15 + cls.hd + race.hp) + (p.lv - 1) * (cls.hd * 0.7 + 2.6) + conB * p.lv * 1.1));
  if (cls.realm) {
    const key = cls.realm === 'arcane' ? 'int' : 'wis';
    const b = statBonus(p.stats[key]);
    p.maxmana = Math.max(0, Math.floor((b + 1) * p.lv * 0.85));
  } else p.maxmana = 0;
  if (init) return;
  p.hp = Math.min(p.hp, p.maxhp);
  p.mana = Math.min(p.mana, p.maxmana);
}

export const armourClass = p =>
  (p.equip.body?.ac || 0) + (p.equip.shield?.ac || 0)
  + statBonus(p.stats.dex) + Math.floor(p.lv / 4) + (p.blessed > 0 ? 4 : 0);

export const toHit = p =>
  CLASSES[p.cls].bth * p.lv / 3 + statBonus(p.stats.dex) * 2
  + statBonus(p.stats.str) + (p.blessed > 0 ? 5 : 0);

export const spellList = p => {
  const realm = CLASSES[p.cls].realm;
  return realm ? SPELLS[realm].filter(s => s.lv <= p.lv) : [];
};

/* ── inventory ──────────────────────────────────────────── */
export const makeConsumable = id => ({ kind:'use', ...CONSUMABLES.find(c => c.id === id) });

export function addItem(p, item, qty = 1) {
  if (item.kind === 'use') {
    const slot = p.pack.find(s => s.item.id === item.id);
    if (slot) { slot.qty += qty; return; }
  }
  if (p.pack.length >= 20) { say('배낭이 가득 찼다.', 'warn'); return; }
  p.pack.push({ item, qty });
}

export function removeItem(p, slotIdx, qty = 1) {
  const slot = p.pack[slotIdx];
  if (!slot) return;
  slot.qty -= qty;
  if (slot.qty <= 0) p.pack.splice(slotIdx, 1);
}

export function equip(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot) return;
  const it = slot.item;
  if (it.kind === 'weapon') {
    const old = p.equip.weapon;
    p.equip.weapon = it;
    removeItem(p, slotIdx);
    if (old) addItem(p, old);
    if (it.hands === 2 && p.equip.shield) { addItem(p, p.equip.shield); p.equip.shield = null; say('양손 무기라 방패를 내렸다.'); }
    say(`${it.n}을(를) 들었다.`, 'good');
  } else if (it.kind === 'armour') {
    const key = it.slot;
    if (key === 'shield' && p.equip.weapon?.hands === 2) { say('양손 무기를 든 채로는 방패를 들 수 없다.', 'warn'); return; }
    const old = p.equip[key];
    p.equip[key] = it;
    removeItem(p, slotIdx);
    if (old) addItem(p, old);
    say(`${it.n}을(를) 착용했다.`, 'good');
  }
  endTurn();
}

/* ── item use ───────────────────────────────────────────── */
export function useItem(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot || slot.item.kind !== 'use') return;
  const it = slot.item;
  let spent = true;

  switch (it.use) {
    case 'heal': {
      const h = Math.min(p.maxhp - p.hp, 20 + roll(2, 8) + p.lv * 2);
      p.hp += h; say(h ? `상처가 아문다. 체력 +${h}.` : '이미 멀쩡하다.', 'good'); break;
    }
    case 'bigHeal': {
      const h = Math.min(p.maxhp - p.hp, Math.floor(p.maxhp * 0.6) + roll(3, 10));
      p.hp += h; say(`깊은 상처까지 닫힌다. 체력 +${h}.`, 'good'); break;
    }
    case 'mana': {
      if (!p.maxmana) { say('아무 일도 일어나지 않았다.'); break; }
      const m = Math.min(p.maxmana - p.mana, Math.ceil(p.maxmana * 0.5) + roll(1, 6));
      p.mana += m; say(`머리가 맑아진다. 마나 +${m}.`, 'good'); break;
    }
    case 'map':   revealMap(); say('층의 구조가 머릿속에 그려진다.', 'good'); break;
    case 'teleport': teleport(); say('공간이 접혔다 펴진다.', 'good'); break;
    case 'deepDescent':
      if (G.depth >= MAX_DEPTH) { say('더 내려갈 곳이 없다.', 'warn'); spent = false; break; }
      say('바닥이 열린다.', 'warn'); enterDepth(Math.min(MAX_DEPTH, G.depth + 2)); break;
    case 'food':  p.food = Math.min(6000, p.food + 2200); say('허기가 가신다.', 'good'); break;
    case 'torch': p.lightTurns = Math.min(6000, p.lightTurns + 2500); say('새 횃불에 불을 붙였다.', 'good'); break;
  }
  if (spent) removeItem(p, slotIdx);
  endTurn();
}

function revealMap() {
  const L = G.level;
  for (let i = 0; i < MW * MH; i++) if (L.tiles[i] !== 0) L.seen[i] = 1;
}

function teleport() {
  const spot = G.level.randomFloor((x, y) => monsterAt(x, y));
  if (spot) { G.player.x = spot.x; G.player.y = spot.y; }
}

/* ── spells ─────────────────────────────────────────────── */
export function cast(spellId) {
  const p = G.player;
  const sp = spellList(p).find(s => s.id === spellId);
  if (!sp) return;
  if (p.mana < sp.cost) { say('마나가 모자란다.', 'warn'); return; }
  p.mana -= sp.cost;

  const visible = G.monsters.filter(m => G.level.vis[idx(m.x, m.y)]);
  const nearest = visible.sort((a, b) =>
    Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];

  switch (sp.id) {
    case 'bolt':
      if (!nearest) { say('시야에 적이 없다.'); break; }
      hurtMonster(nearest, roll(2 + Math.floor(p.lv / 3), 5) + statBonus(p.stats.int) * 2, '마력 화살');
      break;
    case 'smite':
      if (!nearest) { say('시야에 적이 없다.'); break; }
      hurtMonster(nearest, roll(3 + Math.floor(p.lv / 3), 6) + statBonus(p.stats.wis) * 2, '응징의 빛');
      break;
    case 'blink': {
      for (let t = 0; t < 60; t++) {
        const x = p.x + rnd(15) - 7, y = p.y + rnd(15) - 7;
        if (!G.level.solid(x, y) && !monsterAt(x, y)) { p.x = x; p.y = y; break; }
      }
      say('한 걸음 옆이 아닌 곳에 서 있다.', 'good'); break;
    }
    case 'cure': {
      const h = Math.min(p.maxhp - p.hp, 12 + roll(2, 6) + statBonus(p.stats.wis) * 3);
      p.hp += h; say(`상처가 닫힌다. 체력 +${h}.`, 'good'); break;
    }
    case 'heal': {
      const h = Math.min(p.maxhp - p.hp, Math.floor(p.maxhp * 0.55) + roll(3, 8));
      p.hp += h; say(`빛이 몸을 훑고 지나간다. 체력 +${h}.`, 'good'); break;
    }
    case 'bless': p.blessed = 25 + p.lv; say('가벼워진 기분이다.', 'good'); break;
    case 'detect':
      for (const m of G.monsters) G.level.seen[idx(m.x, m.y)] = 1;
      G.detectPulse = 30;
      say('숨소리가 어디에서 나는지 알겠다.', 'good'); break;
    case 'frost': {
      let n = 0;
      for (const m of visible)
        if (Math.hypot(m.x - p.x, m.y - p.y) <= 5) { hurtMonster(m, roll(3, 8) + p.lv, '서리'); n++; }
      say(n ? '주변 공기가 얼어붙는다.' : '얼릴 것이 없다.', n ? 'good' : ''); break;
    }
    case 'map': revealMap(); say('층의 구조가 머릿속에 그려진다.', 'good'); break;
  }
  endTurn();
}

/* ── level flow ─────────────────────────────────────────── */
export function enterDepth(depth, fromBelow = false) {
  G.depth = depth;
  G.level = new Level(depth);
  G.monsters = [];
  G.items = [];

  const L = G.level;
  const p = G.player;
  if (depth === 0) { p.x = L.entry.x; p.y = L.entry.y; }
  else if (fromBelow) {
    const d = findTile(L, DOWN); p.x = d.x; p.y = d.y;
  } else { p.x = L.entry.x; p.y = L.entry.y; }

  if (depth > 0) populate(depth);
  refreshFov();
}

function findTile(L, t) {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++)
    if (L.tiles[idx(x, y)] === t) return { x, y };
  return L.entry;
}

function populate(depth) {
  const L = G.level;
  const busy = (x, y) => (G.player.x === x && G.player.y === y) || monsterAt(x, y) || itemAt(x, y);

  if (depth === MAX_DEPTH) {
    const spot = L.openSpot(L.downRoom || L.rooms[L.rooms.length - 1], busy);
    if (spot) G.monsters.push({ ...BOSS, maxhp: BOSS.hp, x: spot.x, y: spot.y, awake: false });
  }

  const count = 6 + rnd(5) + Math.floor(depth * 0.7);
  for (let i = 0; i < count; i++) {
    const m = pickMonster(depth);
    if (!m) continue;
    const room = L.rooms[1 + rnd(Math.max(1, L.rooms.length - 1))];
    const spot = L.openSpot(room, busy);
    if (spot) G.monsters.push({ ...m, maxhp: m.hp, x: spot.x, y: spot.y, awake: false });
  }

  const loot = 4 + rnd(5);
  for (let i = 0; i < loot; i++) {
    const item = pickItem(depth);
    const spot = L.randomFloor(busy);
    if (spot && item) G.items.push({ ...item, x: spot.x, y: spot.y });
  }
  const piles = 2 + rnd(4);
  for (let i = 0; i < piles; i++) {
    const spot = L.randomFloor(busy);
    if (spot) G.items.push({ kind:'gold', spr:'gold', n:'금화', amount: 15 + rnd(40 + depth * 25), x: spot.x, y: spot.y });
  }
}

function pickMonster(depth) {
  const pool = MONSTERS.filter(m => m.d <= depth && m.d >= depth - 9);
  if (!pool.length) return { ...MONSTERS[0] };
  const total = pool.reduce((s, m) => s + m.rar, 0);
  let r = rnd(total);
  for (const m of pool) { if (r < m.rar) return scaleMonster(m, depth); r -= m.rar; }
  return scaleMonster(pool[0], depth);
}

function scaleMonster(m, depth) {
  const over = Math.max(0, depth - m.d);
  return { ...m,
    hp:  Math.round(m.hp  * (1 + over * 0.07)),
    atk: Math.round(m.atk * (1 + over * 0.05)),
    xp:  Math.round(m.xp  * (1 + over * 0.10)) };
}

function pickItem(depth) {
  const r = Math.random();
  if (r < 0.45) {
    const pool = CONSUMABLES.filter(c => c.d <= depth + 2);
    const total = pool.reduce((s, c) => s + c.rar, 0);
    let n = rnd(total);
    for (const c of pool) { if (n < c.rar) return { kind:'use', ...c }; n -= c.rar; }
    return { kind:'use', ...pool[0] };
  }
  if (r < 0.75) {
    const pool = WEAPONS.filter(w => w.d <= depth + 3);
    return { kind:'weapon', ...pool[rnd(pool.length)] };
  }
  const pool = ARMOURS.filter(a => a.d <= depth + 3);
  return { kind:'armour', ...pool[rnd(pool.length)] };
}

export function refreshFov() {
  const p = G.player;
  const radius = p.lightTurns > 0 ? (G.depth === 0 ? 12 : 7) : 2;
  computeFov(G.level, p.x, p.y, radius);
  G.lightRadius = radius;
}

/* ── movement and turns ─────────────────────────────────── */
export const monsterAt = (x, y) => G.monsters.find(m => m.x === x && m.y === y);
export const itemAt = (x, y) => G.items.find(i => i.x === x && i.y === y);

export function step(dx, dy) {
  if (!G.running) return;
  const p = G.player;
  if (dx === 0 && dy === 0) { endTurn(); return; }

  const nx = p.x + dx, ny = p.y + dy;
  const L = G.level;

  if (L.tiles[idx(nx, ny)] === undefined) return;
  if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return;

  const shopId = L.shopAt.get(idx(nx, ny));
  if (shopId) { G.shop = SHOPS.find(s => s.id === shopId); G.screen = 'shop'; return; }

  if (L.solid(nx, ny)) return;

  const m = monsterAt(nx, ny);
  if (m) { playerAttack(m); endTurn(); return; }

  p.x = nx; p.y = ny;
  pickUp();
  endTurn();
}

function pickUp() {
  const p = G.player;
  const i = G.items.findIndex(it => it.x === p.x && it.y === p.y);
  if (i < 0) return;
  const it = G.items[i];
  G.items.splice(i, 1);
  if (it.kind === 'gold') { p.gold += it.amount; say(`금화 ${it.amount}닢.`, 'good'); return; }
  addItem(p, it);
  say(`${it.n}을(를) 주웠다.`, 'good');
}

function playerAttack(m) {
  const p = G.player;
  m.awake = true;
  const chance = clamp(0.44 + (toHit(p) - m.ac * 1.15) / 55, 0.18, 0.95);
  if (Math.random() > chance) { say(`${m.n}을(를) 빗맞혔다.`); return; }

  const w = p.equip.weapon;
  const dice = w ? w.dice : [1, 3];
  const dmg = Math.max(1, roll(dice[0], dice[1]) + statBonus(p.stats.str) * 2 + Math.floor(p.lv / 3));
  hurtMonster(m, dmg, null);
}

export function hurtMonster(m, dmg, source) {
  m.awake = true;
  m.hp -= dmg;
  const via = source ? `${source}이(가) ` : '';
  if (m.hp <= 0) {
    G.monsters.splice(G.monsters.indexOf(m), 1);
    say(`${m.n}이(가) 쓰러졌다. (+${m.xp} 경험치)`, 'good');
    gainXp(m.xp);
    if (m.boss) victory();
  } else {
    say(`${via}${m.n}에게 ${dmg}의 피해.`, 'hit');
  }
}

function gainXp(n) {
  const p = G.player;
  p.xp += Math.round(n / RACES[p.race].xp);
  while (p.lv < 50 && p.xp >= xpToLevel(p.lv)) {
    p.lv++;
    const before = p.maxhp;
    recalc(p);
    p.hp += p.maxhp - before;
    p.mana = p.maxmana;
    say(`레벨 ${p.lv}. 몸이 단단해진다.`, 'level');
    const learned = spellList(p).filter(s => s.lv === p.lv);
    for (const s of learned) say(`새 주문을 익혔다 — ${s.n}`, 'level');
  }
}

export function descend() {
  const L = G.level, p = G.player;
  if (L.tiles[idx(p.x, p.y)] !== DOWN) { say('여기엔 내려가는 계단이 없다.'); return; }
  if (G.depth >= MAX_DEPTH) { say('이 아래로는 아무것도 없다.'); return; }
  enterDepth(G.depth + 1);
  say(G.depth === MAX_DEPTH ? '공기가 뜨겁다. 무언가 커다란 것이 숨쉬고 있다.'
                            : `던전 ${G.depth}층.`, 'warn');
  endTurn(true);
}

export function ascend() {
  const L = G.level, p = G.player;
  if (L.tiles[idx(p.x, p.y)] !== UP) { say('여기엔 올라가는 계단이 없다.'); return; }
  enterDepth(G.depth - 1, true);
  say(G.depth === 0 ? '햇빛이 눈을 찌른다. 마을이다.' : `던전 ${G.depth}층.`, 'warn');
  endTurn(true);
}

export function endTurn(skipMonsters = false) {
  const p = G.player;
  G.turn++;

  if (p.blessed > 0) p.blessed--;
  if (G.detectPulse > 0) G.detectPulse--;

  if (G.depth > 0) {
    p.food--;
    p.lightTurns--;
    if (p.food === 200) say('배가 고프다.', 'warn');
    if (p.food <= 0) { p.food = 0; if (G.turn % 12 === 0) { p.hp -= 1; if (p.hp <= 0) return death({ n:'굶주림' }); } }
    if (p.lightTurns === 100) say('횃불이 사그라든다.', 'warn');
    if (p.lightTurns < 0) p.lightTurns = 0;
  }

  if (G.turn % 14 === 0 && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + 1 + Math.floor(p.lv / 6));
  if (G.turn % 10 === 0 && p.mana < p.maxmana) p.mana = Math.min(p.maxmana, p.mana + 1);

  refreshFov();
  if (!skipMonsters) for (const m of [...G.monsters]) monsterTurn(m);
  refreshFov();
}

function monsterTurn(m) {
  if (!G.running) return;
  const p = G.player, L = G.level;
  const dx = p.x - m.x, dy = p.y - m.y;
  const dist2 = dx * dx + dy * dy;

  if (!m.awake) {
    if (L.vis[idx(m.x, m.y)] && dist2 <= 110) m.awake = true;
    else return;
  }
  if (m.ai === 'still' && dist2 > 2) return;

  if (dist2 <= 2) {
    const ac = armourClass(p);
    const chance = clamp(0.24 + (m.atk * 1.45 - ac * 1.75) / 62, 0.06, 0.90);
    if (Math.random() > chance) { say(`${m.n}의 공격이 빗나갔다.`); return; }
    const dmg = Math.max(1, roll(2, Math.max(3, Math.floor(m.atk * 0.72))) - Math.floor(ac / 5));
    p.hp -= dmg;
    say(`${m.n}이(가) ${dmg}의 피해를 입혔다.`, 'hit');
    if (p.hp <= 0) { p.hp = 0; death(m); }
    return;
  }

  let sx = Math.sign(dx), sy = Math.sign(dy);
  if (m.ai === 'erratic' && Math.random() < 0.45) { sx = rnd(3) - 1; sy = rnd(3) - 1; }

  const go = (a, b) => {
    if (!a && !b) return false;
    const nx = m.x + a, ny = m.y + b;
    if (L.solid(nx, ny) || monsterAt(nx, ny) || (nx === p.x && ny === p.y)) return false;
    m.x = nx; m.y = ny; return true;
  };
  go(sx, sy) || go(sx, 0) || go(0, sy);
}

/* ── shops ──────────────────────────────────────────────── */
export function shopStock(shop) {
  if (shop.stock === 'weapon')
    return WEAPONS.filter(w => w.d <= 12).map(w => ({ kind:'weapon', ...w }));
  if (shop.stock === 'armour')
    return ARMOURS.filter(a => a.d <= 12).map(a => ({ kind:'armour', ...a }));
  return shop.stock.map(id => makeConsumable(id));
}

export const priceOf = (item, buying) => {
  const chrB = statBonus(G.player.stats.chr);
  const base = item.cost || 10;
  return buying
    ? Math.max(1, Math.round(base * (1.25 - chrB * 0.03)))
    : Math.max(1, Math.round(base * (0.42 + chrB * 0.02)));
};

export function buy(item) {
  const p = G.player, cost = priceOf(item, true);
  if (p.gold < cost) { say('금화가 모자란다.', 'warn'); return; }
  p.gold -= cost;
  addItem(p, { ...item });
  say(`${item.n}을(를) 샀다. (-${cost})`, 'good');
}

export function sell(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot) return;
  const gain = priceOf(slot.item, false);
  p.gold += gain;
  removeItem(p, slotIdx);
  say(`${slot.item.n}을(를) 팔았다. (+${gain})`, 'good');
}

/* ── endings ────────────────────────────────────────────── */
function death(killer) {
  G.running = false;
  G.ending = { win:false, by: killer.n };
  G.screen = 'end';
}

function victory() {
  G.running = false;
  G.ending = { win:true };
  G.screen = 'end';
}

export function startGame(raceKey, classKey, base) {
  G.player = createHero(raceKey, classKey, base);
  G.log = []; G.turn = 0; G.running = true; G.ending = null;
  enterDepth(0);
  say('마을. 여섯 개의 문이 열려 있고, 광장 한가운데에 계단이 있다.', 'warn');
  G.screen = 'play';
}
