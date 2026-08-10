/* ═══════════════════════════════════════════════════════════
   game.js — state and rules. No rendering happens here.
   ═══════════════════════════════════════════════════════════ */

import {
  MAX_DEPTH, STATS, RACES, CLASSES, SPELLS, MONSTERS, BOSS, mimicFor,
  WEAPONS, ARMOURS, CONSUMABLES, SHOPS, AILMENTS, IMMUNE, TRAPS,
  PREFIXES, SUFFIXES, SPELL_AFFIXES, ELITES, affixName,
  xpToLevel, statBonus,
} from './data.js';
import {
  Level, computeFov, lineClear, idx, rnd, roll, clamp, MW, MH,
  FLOOR, DOWN, UP, DOOR, RUBBLE, DOOR_OPEN, DOOR_LOCKED, DOOR_BROKEN,
  WEB, WATER, CAMP, isDoor, isShut,
} from './world.js';

export const G = {
  level: null, depth: 0, player: null, monsters: [], items: [],
  log: [], turn: 0, running: false, screen: 'title', shop: null,
  seenBoss: false,
  fx: [], combo: 0, comboT: 0, bestCombo: 0,
  opened: 0, mimicsBitten: 0, trapsSprung: 0,
};

export function say(text, tone = '') {
  G.log.push({ text, tone });
  if (G.log.length > 120) G.log.shift();
}

/* ── effect queue ─────────────────────────────────────────
   The rules never draw. They describe what just happened and
   ui.js decides how loud it looks. Headless runs simply let
   the queue fill and roll off the front.                    */
export function fx(ev) {
  G.fx.push(ev);
  if (G.fx.length > 300) G.fx.shift();
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
    ail: {},          // ailment -> turns remaining
    stuck: 0,         // turns still caught in a web
    keys: 0,
    spellPlus: {}, spellAffix: {},
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
  const g = gearBonus(p);
  p.maxhp = Math.max(8, Math.round(p.maxhp * (1 + g.maxhpPct)));
  p.maxmana = Math.max(0, Math.round(p.maxmana * (1 + g.manaPct)));
  if (init) return;
  p.hp = Math.min(p.hp, p.maxhp);
  p.mana = Math.min(p.mana, p.maxmana);
}

/* ── gear resolution ──────────────────────────────────────
   Every derived number the player has runs through here, so an
   affix only ever has to be declared once in data.js. Cheap
   enough to recompute per swing: three slots, two affixes each. */
const EMPTY_BONUS = {
  dmg:0, dmgPct:0, hit:0, crit:0, critMult:0, ac:0, stealth:0,
  lifesteal:0, chain:0, burst:0, execute:0, pierce:0,
  regen:0, lightR:0, maxhpPct:0, manaPct:0, on:null, resistAll:false,
};

export function gearBonus(p) {
  const b = { ...EMPTY_BONUS };
  if (!p) return b;
  for (const slot of ['weapon', 'body', 'shield']) {
    const it = p.equip[slot];
    if (!it) continue;

    // Enhancement is flat and boring on purpose — it is the safe
    // pick at the fire, the one you take when a gamble would end you.
    if (it.plus) {
      if (it.kind === 'weapon') { b.dmg += it.plus * 2; b.hit += it.plus * 1.5; }
      else b.ac += it.plus * 2;
    }
    if (it.kind === 'armour') b.ac += it.ac || 0;

    for (const a of [
      it.pre && PREFIXES.find(x => x.id === it.pre),
      it.suf && SUFFIXES.find(x => x.id === it.suf),
    ]) {
      if (!a) continue;
      b.dmg       += a.dmg || 0;
      b.dmgPct    += a.dmgPct || 0;
      b.hit       += a.hit || 0;
      b.crit      += a.crit || 0;
      b.critMult  += a.critMult || 0;
      b.ac        += a.ac || 0;
      b.stealth   += a.stealth || 0;
      b.lifesteal += a.lifesteal || 0;
      b.chain     += a.chain || 0;
      b.burst     += a.burst || 0;
      b.execute   += a.execute || 0;
      b.pierce    += a.pierce || 0;
      b.regen     += a.regen || 0;
      b.lightR    += a.lightR || 0;
      b.maxhpPct  += a.maxhpPct || 0;
      b.manaPct   += a.manaPct || 0;
      if (a.on) b.on = a.on;
      if (a.resist === 'all') b.resistAll = true;
    }
  }
  return b;
}

export const armourClass = p =>
  gearBonus(p).ac
  + statBonus(p.stats.dex) + Math.floor(p.lv / 4) + (p.blessed > 0 ? 4 : 0);

export const toHit = p => {
  const base = CLASSES[p.cls].bth * p.lv / 3 + statBonus(p.stats.dex) * 2
    + statBonus(p.stats.str) + (p.blessed > 0 ? 5 : 0) + gearBonus(p).hit;
  // Proportional, not flat: a flat penalty would cripple level 1
  // and barely register at level 20.
  return has(p, 'fear') ? base * 0.55 : base;
};

/* ── ailments ─────────────────────────────────────────────
   The race notes have always claimed a gnome cannot be
   paralysed and a dwarf cannot be blinded. Now they can't. */
export const has = (p, kind) => (p.ail?.[kind] || 0) > 0;
export const immuneTo = (p, kind) =>
  (IMMUNE[p.race] || []).includes(kind) || gearBonus(p).resistAll;

export function afflict(p, kind, turns) {
  if (!kind || !AILMENTS[kind]) return;
  if (immuneTo(p, kind)) {
    say(`${AILMENTS[kind].n}이(가) 통하지 않는다.`, 'good');
    fx({ t:'resist', x:p.x, y:p.y });
    return;
  }
  const already = p.ail[kind] || 0;
  p.ail[kind] = Math.max(already, turns);
  if (!already) {
    say(`${AILMENTS[kind].n} — ${AILMENTS[kind].note}.`, 'warn');
    fx({ t:'ail', kind, x:p.x, y:p.y });
  }
}

export const ailList = p =>
  Object.entries(p.ail || {}).filter(([, v]) => v > 0).map(([k]) => k);

/* ── the payoff dials ─────────────────────────────────────
   Crits, sneak attacks and the kill chain are what make a
   swing feel worth taking. Keep them legible: a rogue should
   be able to read these three lines and plan around them.   */
export const critChance = p => clamp(
  0.04 + statBonus(p.stats.dex) * 0.022 + p.lv * 0.004
  + (p.cls === 'rogue' ? 0.10 : p.cls === 'ranger' ? 0.04 : 0)
  + gearBonus(p).crit,
  0.02, 0.80);

export const critMult = p =>
  2.0 + (p.cls === 'rogue' ? 0.6 : 0) + Math.floor(p.lv / 10) * 0.25
  + gearBonus(p).critMult;

/* How quietly you move. This is the dial that decides whether
   the sneak attack above is a real option or a dead letter, and
   it is deliberately wired to armour: plate keeps you alive and
   announces you down the corridor. Pick one. */
export const stealth = p => clamp(
  0.10 + statBonus(p.stats.dex) * 0.05
  + (p.race === 'halfling' ? 0.20 : p.race === 'elf' ? 0.10 : p.race === 'halfTroll' ? -0.15 : 0)
  + (p.cls === 'rogue' ? 0.25 : p.cls === 'ranger' ? 0.12 : 0)
  - (p.equip.body?.ac || 0) * 0.012
  - (p.equip.shield?.ac || 0) * 0.010
  + gearBonus(p).stealth,
  0, 0.92);

/* Each link in the chain adds damage; the chain is the reward
   for clearing a room without letting anything touch you. */
export const comboMult = () => 1 + Math.min(G.combo, 20) * 0.035;

const COMBO_TIERS = [
  [5,  '연격 5 — 손이 풀렸다.'],
  [10, '연격 10 — 멈출 수가 없다.'],
  [15, '연격 15 — 바닥이 미끄럽다.'],
  [20, '연격 20 — 무엇도 다가오지 못한다.'],
];

function bumpCombo(x, y) {
  G.combo++;
  G.comboT = 14;
  if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  for (const [n, msg] of COMBO_TIERS)
    if (G.combo === n) { say(msg, 'level'); fx({ t:'comboTier', x, y, n }); }
}

/* A hit to the face costs you half the chain — enough to hurt,
   not enough to make the whole system feel fragile. */
function breakCombo(hard) {
  if (!G.combo) return;
  const left = hard ? 0 : G.combo >> 1;
  if (left < G.combo) fx({ t:'comboDrop', from: G.combo, to: left });
  G.combo = left;
  if (!G.combo) G.comboT = 0;
}

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
      p.hp += h; if (h) fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(h ? `상처가 아문다. 체력 +${h}.` : '이미 멀쩡하다.', 'good'); break;
    }
    case 'bigHeal': {
      const h = Math.min(p.maxhp - p.hp, Math.floor(p.maxhp * 0.6) + roll(3, 10));
      p.hp += h; fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(`깊은 상처까지 닫힌다. 체력 +${h}.`, 'good'); break;
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
  const cost = spellCost(p, sp);
  if (p.mana < cost) { say('마나가 모자란다.', 'warn'); return; }
  p.mana -= cost;
  const pow = spellPower(p, sp.id);
  const aff = SPELL_AFFIXES.find(a => a.id === p.spellAffix?.[sp.id]);

  const visible = G.monsters.filter(m => G.level.vis[idx(m.x, m.y)]);
  const nearest = visible.sort((a, b) =>
    Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];

  switch (sp.id) {
    case 'bolt':
    case 'smite': {
      if (!nearest) { say('시야에 적이 없다.'); break; }
      const holy = sp.id === 'smite';
      const raw = holy
        ? roll(3 + Math.floor(p.lv / 3), 6) + statBonus(p.stats.wis) * 2
        : roll(2 + Math.floor(p.lv / 3), 5) + statBonus(p.stats.int) * 2;
      const dmg = Math.max(1, Math.round(raw * pow));
      fx({ t:'beam', fx:p.x, fy:p.y, tx:nearest.x, ty:nearest.y, color: holy ? 'y' : 'P' });
      hurtMonster(nearest, dmg, holy ? '응징의 빛' : '마력 화살');
      spellDrain(aff, dmg);
      // 메아리치는: half of it carries to a second target.
      if (aff?.chainSpell) {
        const second = visible.filter(o => o !== nearest && G.monsters.includes(o))[0];
        if (second) {
          const echo = Math.max(1, Math.round(dmg * 0.5));
          fx({ t:'beam', fx:nearest.x, fy:nearest.y, tx:second.x, ty:second.y, color: holy ? 'y' : 'P' });
          hurtMonster(second, echo, '메아리');
          spellDrain(aff, echo);
        }
      }
      break;
    }
    case 'blink': {
      for (let t = 0; t < 60; t++) {
        const x = p.x + rnd(15) - 7, y = p.y + rnd(15) - 7;
        if (!G.level.solid(x, y) && !monsterAt(x, y)) { p.x = x; p.y = y; break; }
      }
      say('한 걸음 옆이 아닌 곳에 서 있다.', 'good'); break;
    }
    case 'cure': {
      const h = Math.min(p.maxhp - p.hp, Math.round((12 + roll(2, 6) + statBonus(p.stats.wis) * 3) * pow));
      p.hp += h; fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(`상처가 닫힌다. 체력 +${h}.`, 'good'); break;
    }
    case 'heal': {
      const h = Math.min(p.maxhp - p.hp, Math.round((Math.floor(p.maxhp * 0.55) + roll(3, 8)) * pow));
      p.hp += h; fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(`빛이 몸을 훑고 지나간다. 체력 +${h}.`, 'good'); break;
    }
    case 'bless': p.blessed = 25 + p.lv; say('가벼워진 기분이다.', 'good'); break;
    case 'detect': {
      let unmasked = 0;
      for (const m of G.monsters) {
        G.level.seen[idx(m.x, m.y)] = 1;
        // Life detection sees straight through a lid.
        if (m.disguise) { m.disguise = false; m.spr = 'mimic'; unmasked++; fx({ t:'reveal', x:m.x, y:m.y }); }
      }
      G.detectPulse = 30;
      say(unmasked ? `숨소리가 어디에서 나는지 알겠다. 상자 하나가 숨을 쉬고 있다.`
                   : '숨소리가 어디에서 나는지 알겠다.', 'good');
      break;
    }
    case 'frost': {
      let n = 0;
      fx({ t:'burst', x:p.x, y:p.y, r:5, color:'B' });
      for (const m of [...visible])
        if (Math.hypot(m.x - p.x, m.y - p.y) <= 5) {
          const d = Math.max(1, Math.round((roll(3, 8) + p.lv) * pow));
          hurtMonster(m, d, '서리'); spellDrain(aff, d); n++;
        }
      say(n ? '주변 공기가 얼어붙는다.' : '얼릴 것이 없다.', n ? 'good' : ''); break;
    }
    case 'map': revealMap(); say('층의 구조가 머릿속에 그려진다.', 'good'); break;
  }
  endTurn();
}

/* Spell enhancement is the same two dials as gear: a flat safe
   climb, and an affix that changes what the spell *does*. */
export const spellPower = (p, id) =>
  1 + (p.spellPlus?.[id] || 0) * 0.22
    + (SPELL_AFFIXES.find(a => a.id === p.spellAffix?.[id])?.powPct || 0);

export const spellCost = (p, sp) => {
  const a = SPELL_AFFIXES.find(x => x.id === p.spellAffix?.[sp.id]);
  return Math.max(1, sp.cost - (a?.costCut || 0) + (a?.costUp || 0));
};

function spellDrain(aff, dmg) {
  if (!aff?.spellSteal) return;
  const p = G.player;
  const got = Math.min(p.maxhp - p.hp, Math.max(1, Math.round(dmg * aff.spellSteal)));
  if (got <= 0) return;
  p.hp += got;
  fx({ t:'drain', x:p.x, y:p.y, amt:got });
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

  /* A fire burns whether or not you are looking at it. Mark it
     as remembered the moment you arrive, so the floor has a
     destination other than the stairs — otherwise most players
     would walk past the one real decision on the level. */
  if (L.camp) {
    L.seen[idx(L.camp.x, L.camp.y)] = 1;
    if (depth > 0) say('멀리서 불빛이 흔들린다.', 'good');
  }
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

  /* Pack animals arrive as a pack. Six wolves coming down one
     corridor is a different problem from six wolves scattered
     across a floor, and it is the problem doors are for. */
  const budget = 6 + rnd(5) + Math.floor(depth * 0.7);
  let placed = 0;
  for (let guard = 0; placed < budget && guard < budget * 4; guard++) {
    const m = pickMonster(depth);
    if (!m) continue;
    const room = L.rooms[1 + rnd(Math.max(1, L.rooms.length - 1))];
    const lead = L.openSpot(room, busy);
    if (!lead) continue;

    const size = m.grp ? m.grp[0] + rnd(m.grp[1] - m.grp[0] + 1) : 1;
    for (let k = 0; k < size && placed < budget; k++) {
      const spot = k === 0 ? lead
        : L.openSpot({ x: lead.x - 2, y: lead.y - 2, w: 5, h: 5 }, busy);
      if (!spot) continue;
      const one = { ...m, x: spot.x, y: spot.y, awake: false, energy: 0 };
      if (Math.random() < eliteChance(depth)) makeElite(one, depth);
      one.maxhp = one.hp;
      G.monsters.push(one);
      placed++;
    }
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

  /* Chests, and the thing that is pretending to be one. The
     mimic share climbs with depth, so by the time a chest is
     worth opening you are no longer sure you should. */
  const chests = 1 + rnd(3);
  const mimicShare = Math.min(0.34, 0.06 + depth * 0.013);
  for (let i = 0; i < chests; i++) {
    const spot = L.randomFloor(busy);
    if (!spot) continue;
    if (Math.random() < mimicShare) {
      const mim = mimicFor(depth);
      G.monsters.push({ ...mim, maxhp: mim.hp, x: spot.x, y: spot.y, awake: false, energy: 0 });
    } else {
      G.items.push(makeChest(depth, spot));
    }
  }

  if (Math.random() < 0.45) {
    const spot = L.randomFloor(busy);
    if (spot) G.items.push({ kind:'key', spr:'ring', n:'녹슨 열쇠', x: spot.x, y: spot.y });
  }
}

function makeChest(depth, spot) {
  const locked  = Math.random() < 0.42;
  const trapped = Math.random() < (locked ? 0.42 : 0.22);
  // A locked chest is worth the lockpick; that is the trade.
  const rolls = locked ? 2 + rnd(2) : 1 + rnd(2);
  const loot = [];
  for (let i = 0; i < rolls; i++) {
    const it = pickItem(depth + (locked ? 3 : 0));
    if (it) loot.push(it);
  }
  return {
    kind:'chest', spr:'chest', n:'상자', x: spot.x, y: spot.y,
    locked, trapped, loot,
    gold: Math.round((30 + rnd(60 + depth * 30)) * (locked ? 1.8 : 1)),
  };
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

/* Elites are the monster side of the affix vocabulary. A
   "재빠른 광폭한 늑대" is a different fight from a wolf, and it is
   worth the risk: roughly double experience and a guaranteed
   affixed drop. Rolled per individual — rolling it per pack
   turned one lucky draw into four identical elites at once. */
export const eliteChance = depth => Math.min(0.20, 0.025 + depth * 0.009);

function makeElite(m, depth) {
  const count = depth >= 12 && Math.random() < 0.35 ? 2 : 1;
  const pool = [...ELITES];
  m.elite = [];
  for (let i = 0; i < count && pool.length; i++) {
    const a = pool.splice(rnd(pool.length), 1)[0];
    m.elite.push(a.id);
    m.n = `${a.n} ${m.n}`;
    if (a.spd)    m.spd = (m.spd || 1) + a.spd;
    if (a.hpPct)  m.hp = Math.max(1, Math.round(m.hp * (1 + a.hpPct)));
    if (a.atkPct) m.atk = Math.round(m.atk * (1 + a.atkPct));
    if (a.ac)     m.ac += a.ac;
    if (a.on)     m.on = a.on;
    if (a.drain)  m.drain = a.drain;
  }
  m.xp = Math.round(m.xp * (1.9 + 0.4 * (count - 1)));
  return m;
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
    const it = { kind:'weapon', ...pool[rnd(pool.length)] };
    rollAffixes(it, depth);
    return it;
  }
  const pool = ARMOURS.filter(a => a.d <= depth + 3);
  const it = { kind:'armour', ...pool[rnd(pool.length)] };
  rollAffixes(it, depth);
  return it;
}

/* Affixes on found gear. The odds climb with depth, so an early
   named weapon is a genuine event and a late one is expected. */
export function rollAffixes(item, depth, guaranteed) {
  if (item.kind !== 'weapon' && item.kind !== 'armour') return item;
  const tag = item.kind;
  const odds = Math.min(0.55, 0.05 + depth * 0.02);
  if (guaranteed || Math.random() < odds) {
    const a = pickAffix(PREFIXES, tag, false);
    if (a) item.pre = a.id;
  }
  if ((guaranteed && Math.random() < 0.5) || Math.random() < odds * 0.6) {
    const a = pickAffix(SUFFIXES, tag, false);
    if (a) item.suf = a.id;
  }
  return item;
}

export function pickAffix(table, tag, allowCurse) {
  const pool = table.filter(a => a.tags.includes(tag) && (allowCurse || !a.curse));
  return pool.length ? pool[rnd(pool.length)] : null;
}

export function refreshFov() {
  const p = G.player;
  let radius = p.lightTurns > 0 ? (G.depth === 0 ? 12 : 7) : 2;
  radius += gearBonus(p).lightR;
  if (p.race === 'elf') radius += 1;          // "눈이 밝다"
  if (has(p, 'blind')) radius = 1;
  computeFov(G.level, p.x, p.y, radius);
  G.lightRadius = radius;
}

/* ── movement and turns ─────────────────────────────────── */
export const monsterAt = (x, y) => G.monsters.find(m => m.x === x && m.y === y);
export const itemAt = (x, y) => G.items.find(i => i.x === x && i.y === y);

export function step(dx, dy) {
  if (!G.running) return;
  const p = G.player, L = G.level;

  // Paralysis eats the turn outright — that is what makes a lich
  // frightening rather than merely damaging.
  if (has(p, 'paralyze')) {
    say('몸이 굳어 말을 듣지 않는다.', 'warn');
    fx({ t:'struggle', x:p.x, y:p.y });
    endTurn(); return;
  }

  if (p.stuck > 0) {
    const pull = statBonus(p.stats.str) + roll(1, 6);
    if (pull >= 5) { p.stuck = 0; say('거미줄을 뜯어냈다.', 'good'); }
    else { p.stuck--; say('거미줄이 발을 붙잡는다.', 'warn'); fx({ t:'struggle', x:p.x, y:p.y }); }
    endTurn(); return;
  }

  if (dx === 0 && dy === 0) { endTurn(); return; }

  const nx = p.x + dx, ny = p.y + dy;
  if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return;
  const ni = idx(nx, ny);
  if (L.tiles[ni] === undefined) return;

  const shopId = L.shopAt.get(ni);
  if (shopId) { G.shop = SHOPS.find(s => s.id === shopId); G.screen = 'shop'; return; }

  const t = L.tiles[ni];
  if (t === CAMP) { p.x = nx; p.y = ny; refreshFov(); G.screen = 'camp'; return; }
  if (t === DOOR)        { openDoor(nx, ny); endTurn(); return; }
  if (t === DOOR_LOCKED) { forceDoor(nx, ny); endTurn(); return; }
  if (L.solid(nx, ny)) return;

  const m = monsterAt(nx, ny);
  if (m) { playerAttack(m); endTurn(); return; }

  p.x = nx; p.y = ny;
  if (enterTile(nx, ny)) { endTurn(true); return; }   // trap moved us elsewhere
  pickUp();
  endTurn();
}

/* ── doors ────────────────────────────────────────────────
   A shut door is a wall you chose not to open yet, and the
   only reliable way to break line of sight from an archer. */
function openDoor(x, y) {
  G.level.tiles[idx(x, y)] = DOOR_OPEN;
  say('문을 열었다.');
  fx({ t:'door', x, y, state:'open' });
  rouse(x, y, 5, 0.35);
}

function forceDoor(x, y) {
  const p = G.player, L = G.level;
  if (p.keys > 0) {
    p.keys--;
    L.tiles[idx(x, y)] = DOOR_OPEN;
    say(`열쇠로 잠긴 문을 열었다. (남은 열쇠 ${p.keys})`, 'good');
    fx({ t:'door', x, y, state:'open' });
    return;
  }
  const chance = clamp(0.14 + statBonus(p.stats.str) * 0.09 + p.lv * 0.006, 0.04, 0.85);
  if (Math.random() < chance) {
    L.tiles[idx(x, y)] = DOOR_BROKEN;
    say('문이 부서져 나갔다.', 'good');
    fx({ t:'door', x, y, state:'broken' });
    rouse(x, y, 11, 0.9);          // splinters carry
  } else {
    say('문이 꿈쩍도 하지 않는다.', 'warn');
    fx({ t:'door', x, y, state:'stuck' });
    rouse(x, y, 6, 0.45);
  }
}

export function doorToClose() {
  const p = G.player, L = G.level;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    if (L.tiles[idx(x, y)] !== DOOR_OPEN) continue;
    if (monsterAt(x, y) || itemAt(x, y)) continue;   // can't shut it on something
    return { x, y };
  }
  return null;
}

export function closeDoor() {
  const d = doorToClose();
  if (!d) { say('닫을 문이 곁에 없다.'); return; }
  G.level.tiles[idx(d.x, d.y)] = DOOR;
  say('문을 닫았다.', 'good');
  fx({ t:'door', x:d.x, y:d.y, state:'shut' });
  endTurn();
}

/* Noise wakes things. Volume 0..1 scales the chance so that
   shouldering a stuck door is quieter than smashing one. */
function rouse(x, y, radius, volume) {
  let woke = 0;
  for (const m of G.monsters) {
    if (m.awake) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if (d > radius) continue;
    if (Math.random() < volume * (1 - d / (radius + 1))) { m.awake = true; woke++; }
  }
  if (woke) fx({ t:'noise', x, y, r:radius });
  return woke;
}

/* ── stepping onto something ──────────────────────────────
   Returns true when the tile relocated us, so the caller
   knows not to keep acting on the old floor.               */
function enterTile(x, y) {
  const L = G.level, p = G.player, i = idx(x, y);
  const t = L.tiles[i];

  if (t === WEB) {
    p.stuck = 1 + rnd(3);
    say('거미줄에 걸렸다.', 'warn');
    fx({ t:'struggle', x, y });
  } else if (t === WATER) {
    // Wading is safe and extremely loud.
    fx({ t:'splash', x, y });
    rouse(x, y, 7, 0.5);
  }

  const trap = L.traps.get(i);
  if (trap) return springTrap(x, y, trap);
  return false;
}

function springTrap(x, y, trap) {
  const p = G.player, L = G.level;
  L.traps.delete(idx(x, y));
  G.trapsSprung++;
  const spec = TRAPS[trap.kind];
  say(spec.msg, 'warn');
  fx({ t:'trap', kind:trap.kind, x, y });

  switch (trap.kind) {
    case 'dart': {
      const dmg = roll(2, 4) + Math.floor(G.depth * 0.8);
      p.hp -= dmg; breakCombo(false);
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, severe: dmg >= p.maxhp * 0.18 });
      say(`화살이 ${dmg}의 피해를 입혔다.`, 'hit');
      if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'화살 함정' }); }
      return false;
    }
    case 'poison': {
      const dmg = roll(1, 4);
      p.hp -= dmg; breakCombo(false);
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg });
      afflict(p, 'poison', 22 + G.depth);
      if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'독침 함정' }); }
      return false;
    }
    case 'pit': {
      const dmg = roll(2, 6) + Math.floor(G.depth * 0.5);
      p.hp -= dmg;
      say(`떨어지며 ${dmg}의 피해를 입었다.`, 'hit');
      if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'구덩이' }); return false; }
      if (G.depth >= MAX_DEPTH) return false;
      breakCombo(true);
      enterDepth(G.depth + 1);
      say(`${G.depth}층으로 떨어졌다.`, 'warn');
      return true;
    }
    case 'teleport':
      teleport();
      return false;
    case 'alarm': {
      let woke = 0;
      for (const m of G.monsters) if (!m.awake) { m.awake = true; woke++; }
      say(woke ? `${woke}마리가 깨어났다.` : '아무도 대답하지 않는다.', 'warn');
      fx({ t:'noise', x, y, r:26 });
      return false;
    }
  }
  return false;
}

/* Spotting a trap before you tread on it. Wisdom and a rogue's
   trade; the reason to walk a corridor instead of sprint it. */
function scanForTraps() {
  const p = G.player, L = G.level;
  const skill = clamp(
    0.16 + statBonus(p.stats.wis) * 0.045 + p.lv * 0.007
    + (p.cls === 'rogue' ? 0.28 : p.cls === 'ranger' ? 0.10 : 0),
    0.04, 0.9);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const trap = L.traps.get(idx(x, y));
    if (!trap || trap.seen) continue;
    const near = Math.max(Math.abs(dx), Math.abs(dy));
    if (Math.random() < skill / near) {
      trap.seen = true;
      say(`${TRAPS[trap.kind].n}을(를) 발견했다.`, 'good');
      fx({ t:'spot', x, y });
    }
  }
}

function pickUp() {
  const p = G.player;
  const i = G.items.findIndex(it => it.x === p.x && it.y === p.y);
  if (i < 0) return;
  const it = G.items[i];
  if (it.kind === 'chest') { openChest(i, it); return; }
  G.items.splice(i, 1);
  if (it.kind === 'gold') { p.gold += it.amount; say(`금화 ${it.amount}닢.`, 'good'); return; }
  if (it.kind === 'key')  { p.keys++; say(`녹슨 열쇠를 주웠다. (${p.keys})`, 'good'); return; }
  addItem(p, it);
  say(`${it.n}을(를) 주웠다.`, 'good');
}

/* ── chests ───────────────────────────────────────────────
   The gamble. A locked chest holds more; a trapped one costs
   you for finding out; and one chest in some number of them
   is not a chest at all (see MIMIC in populate).           */
function openChest(index, chest) {
  const p = G.player;

  if (chest.locked) {
    if (p.keys > 0) {
      p.keys--;
      chest.locked = false;
      say(`열쇠로 자물쇠를 열었다. (남은 열쇠 ${p.keys})`, 'good');
    } else {
      const pick = clamp(
        0.10 + statBonus(p.stats.dex) * 0.06 + (p.cls === 'rogue' ? 0.30 : 0) + p.lv * 0.008,
        0.04, 0.92);
      if (Math.random() < pick) {
        chest.locked = false;
        say('자물쇠가 딸깍 열렸다.', 'good');
      } else {
        say('자물쇠가 걸려 열리지 않는다.', 'warn');
        fx({ t:'door', x:chest.x, y:chest.y, state:'stuck' });
        return;
      }
    }
  }

  if (chest.trapped) {
    chest.trapped = false;
    const kind = ['dart', 'poison', 'alarm'][rnd(3)];
    say('뚜껑에 무언가 걸려 있었다.', 'warn');
    springTrap(chest.x, chest.y, { kind });
    if (!G.running) return;
  }

  G.items.splice(index, 1);
  G.opened++;
  fx({ t:'chest', x:chest.x, y:chest.y });
  say('상자를 열었다.', 'good');

  const gold = chest.gold || 0;
  if (gold) { p.gold += gold; say(`금화 ${gold}닢.`, 'good'); }
  for (const it of chest.loot || []) {
    addItem(p, it);
    say(`${it.n}을(를) 얻었다.`, 'good');
  }
}

function playerAttack(m) {
  const p = G.player;

  /* You did not attack a mimic — you reached for a chest. It
     gets the first bite for that, and your swing still lands. */
  if (m.disguise) {
    m.disguise = false;
    m.awake = true;
    m.spr = 'mimic';
    G.mimicsBitten++;
    say('상자가 이빨을 드러냈다.', 'warn');
    fx({ t:'reveal', x:m.x, y:m.y });
    monsterMelee(m);
    if (!G.running) return;
  }

  const asleep = !m.awake;
  m.awake = true;
  fx({ t:'lunge', who:'player', x:p.x, y:p.y, dx: Math.sign(m.x - p.x), dy: Math.sign(m.y - p.y) });

  /* A sleeping target never gets a saving throw. This is the
     reason to take the long way round instead of the short. */
  const gp = gearBonus(p);
  const armour = m.ac * 1.15 * (1 - gp.pierce);   // 꿰뚫는: armour counts for less
  const chance = asleep ? 1 : clamp(0.44 + (toHit(p) - armour) / 55, 0.18, 0.95);
  if (Math.random() > chance) {
    say(`${m.n}을(를) 빗맞혔다.`);
    fx({ t:'miss', x:m.x, y:m.y });
    return;
  }

  const w = p.equip.weapon;
  const dice = w ? w.dice : [1, 3];
  const g = gp;
  let dmg = roll(dice[0], dice[1]) + statBonus(p.stats.str) * 2 + Math.floor(p.lv / 3) + g.dmg;
  dmg *= (1 + g.dmgPct);

  const crit = asleep || Math.random() < critChance(p);
  if (crit) dmg *= critMult(p) * (asleep ? 1.5 : 1);
  dmg = Math.max(1, Math.round(dmg * comboMult()));

  if (asleep) say(`잠든 ${m.n}의 급소를 찔렀다.`, 'level');

  /* 처형: below the threshold nothing survives, so a suffix that
     looks small on paper decides whether a wounded troll gets one
     more turn to hit back. */
  if (g.execute > 0 && !m.boss && m.hp <= m.maxhp * g.execute) {
    say(`${m.n}을(를) 처형했다.`, 'level');
    fx({ t:'execute', x:m.x, y:m.y });
    hurtMonster(m, m.hp + 999, null, { crit: true, execute: true });
  } else {
    hurtMonster(m, dmg, null, { crit, sneak: asleep });
  }
  if (!G.running) return;

  drainLife(dmg * (crit ? 0.6 : 1));
  if (g.on) poisonMonster(m, g.on);

  /* 연쇄: the swing carries into one more body. This is the line
     that turns 작열 into a chain of detonations and 흡혈 into a
     way to out-heal a whole room. */
  if (g.chain > 0 && Math.random() < g.chain) {
    const near = adjacentMonsters(p).filter(o => o !== m);
    if (near.length) {
      const o = near[rnd(near.length)];
      const spill = Math.max(1, Math.round(dmg * 0.6));
      fx({ t:'arc', fx:m.x, fy:m.y, tx:o.x, ty:o.y });
      hurtMonster(o, spill, '연쇄', {});
      drainLife(spill);
    }
  }
}

function adjacentMonsters(from) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const m = monsterAt(from.x + dx, from.y + dy);
    if (m && !m.disguise) out.push(m);
  }
  return out;
}

function drainLife(dmg) {
  const p = G.player, g = gearBonus(p);
  if (g.lifesteal <= 0 || p.hp >= p.maxhp) return;
  const heal = Math.max(1, Math.round(dmg * g.lifesteal));
  const got = Math.min(p.maxhp - p.hp, heal);
  if (got <= 0) return;
  p.hp += got;
  fx({ t:'drain', x:p.x, y:p.y, amt:got });
}

function poisonMonster(m, kind) {
  if (kind !== 'poison') return;
  m.poison = Math.max(m.poison || 0, 6 + Math.floor(G.player.lv / 3));
}

export function hurtMonster(m, dmg, source, opt = {}) {
  m.awake = true;
  // Any damage at all blows a disguise — a frost blast should not
  // leave a "chest" quietly smouldering.
  if (m.disguise) {
    m.disguise = false;
    m.spr = 'mimic';
    say('상자가 이빨을 드러냈다.', 'warn');
    fx({ t:'reveal', x:m.x, y:m.y });
  }
  const before = m.hp;
  m.hp -= dmg;
  const via = source ? `${source}이(가) ` : '';

  if (m.hp <= 0) {
    /* Overkill is measured against what was actually left, so a
       finishing tap on a sliver stays quiet and a hit that erases
       a full-health troll gets the whole fireworks budget. */
    const over = clamp(-m.hp / Math.max(1, before), 0, 3);
    G.monsters.splice(G.monsters.indexOf(m), 1);
    bumpCombo(m.x, m.y);

    /* 작열: the corpse goes off. Chained kills chain detonations,
       which is the whole point of stacking it with 연쇄. */
    const g = gearBonus(G.player);
    if (g.burst > 0 && !opt.noBurst) {
      const blast = Math.max(2, Math.round((m.maxhp || 10) * g.burst * 0.5));
      const caught = adjacentMonsters(m);
      if (caught.length) {
        fx({ t:'burst', x:m.x, y:m.y, r:1.9, color:'o' });
        for (const o of caught) hurtMonster(o, blast, '폭발', { noBurst: true });
      }
    }
    fx({ t:'kill', x:m.x, y:m.y, spr:m.spr, dmg, crit:!!opt.crit, over, boss:!!m.boss, combo:G.combo });
    say(`${m.n}이(가) 쓰러졌다. (+${m.xp} 경험치)`, 'good');
    if (m.elite?.length) dropElite(m);
    gainXp(m.xp);
    if (m.boss) victory();
  } else {
    fx({ t:'hit', on:'monster', x:m.x, y:m.y, dmg, crit:!!opt.crit, sneak:!!opt.sneak, spr:m.spr });
    if (!opt.quiet) {
      const tag = opt.sneak ? ' 기습!' : opt.crit ? ' 치명타!' : '';
      say(`${via}${m.n}에게 ${dmg}의 피해.${tag}`, opt.crit ? 'level' : 'hit');
    }
  }
}

/* An elite always leaves something with a name on it. */
function dropElite(m) {
  const spot = { x: m.x, y: m.y };
  const it = pickItem(G.depth + 4);
  if (!it) return;
  rollAffixes(it, G.depth + 8, true);
  G.items.push({ ...it, ...spot });
  say(`${affixName(it)}을(를) 떨어뜨렸다.`, 'level');
  fx({ t:'drop', x: spot.x, y: spot.y });
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
    fx({ t:'levelup', x:p.x, y:p.y });
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

  if (G.comboT > 0 && --G.comboT === 0) breakCombo(true);

  if (G.depth > 0) {
    p.food--;
    p.lightTurns--;
    if (p.food === 200) say('배가 고프다.', 'warn');
    if (p.food <= 0) { p.food = 0; if (G.turn % 12 === 0) { p.hp -= 1; if (p.hp <= 0) return death({ n:'굶주림' }); } }
    if (p.lightTurns === 100) say('횃불이 사그라든다.', 'warn');
    if (p.lightTurns < 0) p.lightTurns = 0;
  }

  tickAilments(p);
  if (!G.running) return;

  const regen = Math.max(0, 1 + Math.floor(p.lv / 6)
    + (p.race === 'halfTroll' ? 1 : 0) + gearBonus(p).regen);
  if (G.turn % 14 === 0 && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + regen);
  if (G.turn % 10 === 0 && p.mana < p.maxmana) p.mana = Math.min(p.maxmana, p.mana + 1);

  refreshFov();
  if (G.depth > 0) scanForTraps();
  if (!skipMonsters) runMonsters();
  refreshFov();
}

/* Speed is an energy budget rather than a turn order: a wolf at
   1.5 gets a second move every other turn, an ogre at 0.75 skips
   one in four, and 둔화 doubles everyone else's allowance. */
function runMonsters() {
  const slowed = has(G.player, 'slow') ? 2 : 1;
  for (const m of [...G.monsters]) {
    if (!G.running) return;
    m.energy = (m.energy || 0) + (m.spd || 1) * slowed;
    let acts = 0;
    while (m.energy >= 1 && acts < 4) {
      if (!G.monsters.includes(m)) break;     // died mid-loop
      m.energy -= 1;
      acts++;
      monsterTurn(m);
      if (!G.running) return;
    }
  }
}

function tickAilments(p) {
  for (const kind of Object.keys(p.ail)) {
    if (p.ail[kind] <= 0) { delete p.ail[kind]; continue; }
    p.ail[kind]--;
    if (p.ail[kind] === 0) {
      delete p.ail[kind];
      say(`${AILMENTS[kind].n}에서 벗어났다.`, 'good');
    }
  }
  if (has(p, 'poison') && G.turn % 3 === 0) {
    const dmg = 1 + Math.floor(G.depth / 8);
    p.hp -= dmg;
    fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, poison:true });
    if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'독' }); }
  }
}

function monsterTurn(m) {
  if (!G.running) return;
  const p = G.player, L = G.level;
  const dx = p.x - m.x, dy = p.y - m.y;
  const dist2 = dx * dx + dy * dy;
  const dist = Math.sqrt(dist2);

  if (m.poison > 0) {
    m.poison--;
    const tick = Math.max(1, Math.round((m.maxhp || 10) * 0.045));
    hurtMonster(m, tick, '독', { quiet: true });
    if (!G.monsters.includes(m)) return;
  }
  if (m.regen && m.hp < m.maxhp) m.hp = Math.min(m.maxhp, m.hp + m.regen);

  if (!m.awake) {
    if (!L.vis[idx(m.x, m.y)] || dist2 > 110) return;
    /* Noticing you is a roll per turn, not a certainty, so the
       long quiet approach is a strategy and not just flavour.
       Standing in water throws that away. */
    const wading = L.tiles[idx(p.x, p.y)] === WATER;
    const quiet = wading ? stealth(p) * 0.25 : stealth(p);
    const notice = clamp((1 - quiet) * (0.62 - dist * 0.055), 0.02, 0.9);
    if (Math.random() >= notice) return;
    m.awake = true;
    if (m.disguise) return;              // a mimic that has noticed you keeps very still
    fx({ t:'wake', x:m.x, y:m.y });
  }

  // A mimic does nothing at all until it is touched.
  if (m.disguise) return;
  if (m.ai === 'still' && dist2 > 2) return;

  // Webs hold everything that did not spin them.
  if (m.snared > 0 && !m.web) { m.snared--; return; }

  if (dist2 <= 2) { monsterMelee(m); return; }

  /* Archers keep their distance: they shoot from range, back off
     when you close, and only advance when they have lost you.  */
  if (m.ai === 'ranged' && m.rng) {
    const sighted = dist <= m.rng && lineClear(L, m.x, m.y, p.x, p.y);
    if (sighted && dist >= 2.5) { monsterShoot(m); return; }
    if (sighted && dist < 2.5 && retreat(m)) return;
  }

  /* A wounded hound runs, and a runner that gets away lives to
     bring friends. Cornering one is a decision. */
  if ((m.ai === 'coward' || m.fleeing) && m.hp < m.maxhp * 0.35) {
    if (!m.fleeing) { m.fleeing = true; say(`${m.n}이(가) 달아나기 시작한다.`); }
    if (retreat(m)) return;
  }

  let sx = Math.sign(dx), sy = Math.sign(dy);
  if (m.ai === 'erratic' && Math.random() < 0.45) { sx = rnd(3) - 1; sy = rnd(3) - 1; }
  advance(m, sx, sy);
}

function monsterMelee(m) {
  const p = G.player;
  const ac = armourClass(p);
  const chance = clamp(0.24 + (m.atk * 1.45 - ac * 1.75) / 62, 0.06, 0.90);
  if (Math.random() > chance) {
    say(`${m.n}의 공격이 빗나갔다.`);
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  const dmg = Math.max(1, roll(2, Math.max(3, Math.floor(m.atk * 0.72))) - Math.floor(ac / 5));
  p.hp -= dmg;
  breakCombo(false);
  fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, from:{ x:m.x, y:m.y },
       severe: dmg >= p.maxhp * 0.18 });
  say(`${m.n}이(가) ${dmg}의 피해를 입혔다.`, 'hit');
  if (m.drain) {                       // 흡혈하는: it heals off you
    const back = Math.max(1, Math.round(dmg * m.drain));
    m.hp = Math.min(m.maxhp, m.hp + back);
  }
  if (m.on && Math.random() < 0.28) afflict(p, m.on, 9 + rnd(9));
  if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death(m); }
}

function monsterShoot(m) {
  const p = G.player;
  const ac = armourClass(p);
  fx({ t:'shot', fx:m.x, fy:m.y, tx:p.x, ty:p.y, kind:m.spr });
  const chance = clamp(0.20 + (m.atk * 1.25 - ac * 1.6) / 62, 0.05, 0.80);
  if (Math.random() > chance) {
    say(`${m.n}의 원거리 공격이 빗나갔다.`);
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  const dmg = Math.max(1, roll(2, Math.max(3, Math.floor(m.atk * 0.6))) - Math.floor(ac / 6));
  p.hp -= dmg;
  breakCombo(false);
  fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, from:{ x:m.x, y:m.y },
       severe: dmg >= p.maxhp * 0.18 });
  say(`${m.n}이(가) 멀리서 ${dmg}의 피해를 입혔다.`, 'hit');
  if (m.on && Math.random() < 0.22) afflict(p, m.on, 8 + rnd(8));
  if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death(m); }
}

/* Movement shared by every AI, including what to do about a
   shut door: most things are simply stopped by one. */
function advance(m, sx, sy) {
  const p = G.player, L = G.level;

  const go = (a, b) => {
    if (!a && !b) return false;
    const nx = m.x + a, ny = m.y + b;
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return false;
    if (monsterAt(nx, ny) || (nx === p.x && ny === p.y)) return false;

    const t = L.tiles[idx(nx, ny)];
    if (isShut(t)) {
      if (!m.door) return false;
      if (t === DOOR_LOCKED && m.door !== 'smash') return false;
      L.tiles[idx(nx, ny)] = m.door === 'smash' ? DOOR_BROKEN : DOOR_OPEN;
      say(`${m.n}이(가) 문을 ${m.door === 'smash' ? '부쉈다' : '열었다'}.`, 'warn');
      fx({ t:'door', x:nx, y:ny, state: m.door === 'smash' ? 'broken' : 'open' });
      return true;                    // opening costs the move
    }
    if (L.solid(nx, ny)) return false;

    m.x = nx; m.y = ny;
    if (t === WEB && !m.web) { m.snared = 1 + rnd(2); fx({ t:'struggle', x:nx, y:ny }); }
    return true;
  };
  return go(sx, sy) || go(sx, 0) || go(0, sy);
}

const retreat = m => advance(m, Math.sign(m.x - G.player.x), Math.sign(m.y - G.player.y));

/* ── the fire ─────────────────────────────────────────────
   One per floor, one choice, no take-backs. Rest is the safe
   pick and buys you nothing lasting. Enhancement is a small,
   certain, permanent gain. The enchant is the gamble: a real
   affix most of the time, a curse some of the time, and it can
   land on top of one you already had. The whole point is that
   at full health the first option is worthless and at 20% it is
   the only sane one. */
export const CAMP_HEAL = 0.30;
export const MAX_PLUS = 5;

export function campTargets() {
  const p = G.player, out = [];
  for (const [slot, label] of [['weapon', '무기'], ['body', '갑옷'], ['shield', '방패']]) {
    const it = p.equip[slot];
    if (it) out.push({
      key: `eq:${slot}`, label, name: affixName(it), kind: it.kind, item: it,
      plus: it.plus || 0, capped: (it.plus || 0) >= MAX_PLUS,
    });
  }
  for (const s of spellList(p)) {
    const plus = p.spellPlus?.[s.id] || 0;
    const aff = p.spellAffix?.[s.id];
    const affN = aff ? SPELL_AFFIXES.find(a => a.id === aff)?.n : null;
    out.push({
      key: `sp:${s.id}`, label: '주문', kind: 'spell', spell: s,
      name: `${plus ? `+${plus} ` : ''}${affN ? affN + ' ' : ''}${s.name}`,
      plus, capped: plus >= MAX_PLUS,
    });
  }
  return out;
}

const targetOf = key => {
  const p = G.player;
  if (key.startsWith('eq:')) return { type: 'item', item: p.equip[key.slice(3)] };
  if (key.startsWith('sp:')) return { type: 'spell', id: key.slice(3) };
  return null;
};

export function campRest() {
  const p = G.player;
  const heal = Math.min(p.maxhp - p.hp, Math.ceil(p.maxhp * CAMP_HEAL));
  p.hp += heal;
  p.mana = p.maxmana;
  const cured = ailList(p);
  p.ail = {};
  p.stuck = 0;
  if (heal) fx({ t:'heal', x:p.x, y:p.y, amt:heal });
  say(heal ? `불 앞에서 숨을 돌렸다. 체력 +${heal}.` : '불 앞에 앉았지만 이미 멀쩡하다.', 'good');
  if (cured.length) say(`${cured.map(k => AILMENTS[k].n).join(' · ')}이(가) 가셨다.`, 'good');
  spendCamp();
}

export function campUpgrade(key) {
  const p = G.player, t = targetOf(key);
  if (!t) return;
  if (t.type === 'item') {
    if (!t.item) return;
    // Enhancement tops out, or twenty-five floors of fires would
    // outscale everything the dungeon can put in front of you.
    if ((t.item.plus || 0) >= MAX_PLUS) {
      say(`${affixName(t.item)}은(는) 더 벼릴 수 없다.`, 'warn');
      return;
    }
    t.item.plus = (t.item.plus || 0) + 1;
    recalc(p);
    say(`${affixName(t.item)} — 날이 섰다.`, 'level');
  } else {
    p.spellPlus = p.spellPlus || {};
    if ((p.spellPlus[t.id] || 0) >= MAX_PLUS) {
      say('그 주문은 더 연마할 수 없다.', 'warn');
      return;
    }
    p.spellPlus[t.id] = (p.spellPlus[t.id] || 0) + 1;
    const sp = spellList(p).find(s => s.id === t.id);
    say(`${sp?.name || '주문'}을(를) 연마했다.`, 'level');
  }
  fx({ t:'forge', x:p.x, y:p.y });
  spendCamp();
}

export function campEnchant(key) {
  const p = G.player, t = targetOf(key);
  if (!t) return;

  if (t.type === 'spell') {
    p.spellAffix = p.spellAffix || {};
    const a = SPELL_AFFIXES[rnd(SPELL_AFFIXES.length)];
    const had = p.spellAffix[t.id];
    p.spellAffix[t.id] = a.id;
    const sp = spellList(p).find(s => s.id === t.id);
    say(had && had !== a.id
      ? `${sp?.name}의 성질이 뒤바뀌었다 — ${a.n}. ${a.note}.`
      : `${sp?.name}이(가) ${a.n} 주문이 되었다. ${a.note}.`, 'level');
    fx({ t:'enchant', x:p.x, y:p.y, cursed:false });
    spendCamp();
    return;
  }

  const it = t.item;
  if (!it) return;
  const tag = it.kind;
  // Roughly one roll in five bites back.
  const cursed = Math.random() < 0.20;
  const usePrefix = Math.random() < 0.5;
  const table = usePrefix ? PREFIXES : SUFFIXES;
  const a = pickAffixFor(table, tag, cursed);
  if (!a) { say('불꽃이 사그라들 뿐이다.', 'warn'); spendCamp(); return; }

  const slotKey = usePrefix ? 'pre' : 'suf';
  const replaced = it[slotKey];
  it[slotKey] = a.id;
  recalc(p);

  if (cursed) {
    say(`${it.n}에서 검은 연기가 피어오른다 — ${a.n}.`, 'warn');
  } else if (replaced && replaced !== a.id) {
    say(`${affixName(it)} — 이전의 성질을 밀어냈다.`, 'level');
  } else {
    say(`${affixName(it)} — 새 성질이 깃들었다.`, 'level');
  }
  fx({ t:'enchant', x:p.x, y:p.y, cursed });
  spendCamp();
}

/* Cursed rolls draw from the cursed pool only, so a bad outcome
   is genuinely bad rather than merely a weaker good one. */
function pickAffixFor(table, tag, cursed) {
  const pool = table.filter(a => a.tags.includes(tag) && !!a.curse === cursed);
  if (pool.length) return pool[rnd(pool.length)];
  return pickAffix(table, tag, false);
}

function spendCamp() {
  const L = G.level, p = G.player;
  if (L.tiles[idx(p.x, p.y)] === CAMP) L.tiles[idx(p.x, p.y)] = FLOOR;
  L.campSpent = true;
  G.screen = 'play';
  endTurn();
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
  G.fx = []; G.combo = 0; G.comboT = 0; G.bestCombo = 0;
  G.opened = 0; G.mimicsBitten = 0; G.trapsSprung = 0;
  enterDepth(0);
  say('마을. 여섯 개의 문이 열려 있고, 광장 한가운데에 계단이 있다.', 'warn');
  G.screen = 'play';
}
