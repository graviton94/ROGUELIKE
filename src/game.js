/* ═══════════════════════════════════════════════════════════
   game.js — state and rules. No rendering happens here.
   ═══════════════════════════════════════════════════════════ */

import {
  MAX_DEPTH, STATS, STAT_NAME, RACES, CLASSES, SPELLS, MONSTERS, BOSS, mimicFor,
  WEAPONS, ARMOURS, CONSUMABLES, SHOPS, AILMENTS, IMMUNE, TRAPS,
  PREFIXES, SUFFIXES, SPELL_AFFIXES, ELITES, affixName,
  MATS, salvageYield, upgradeCost, ENCHANT_COST, REROLL_COST,
  ALTAR_OFFERS, rarityOf, isCursed,
  POTION_LOOKS, SCROLL_LOOKS, UNKNOWABLE,
  RELICS, RELIC_SLOTS, relicSlots, relicById, BRANCHES,
  FLOOR_BUDGET, WAVE_EVERY, WAVE_GROWTH,
  WEAPON_TYPES, PATTERNS, NAMED,
  ROLL_COST, ROLL_DIST, staminaMax, STAM_REGEN_EVERY,
  xpToLevel, statBonus,
} from './data.js';
import {
  Level, computeFov, lineClear, idx, rnd, roll, clamp, MW, MH,
  FLOOR, DOWN, UP, DOOR, RUBBLE, DOOR_OPEN, DOOR_LOCKED, DOOR_BROKEN,
  WEB, WATER, CAMP, ALTAR, EVENT, isDoor, isShut,
} from './world.js';
import { EVENTS } from './events.js';

export const G = {
  level: null, depth: 0, player: null, monsters: [], items: [],
  log: [], turn: 0, running: false, screen: 'title', shop: null,
  seenBoss: false,
  fx: [], combo: 0, comboT: 0, bestCombo: 0,
  opened: 0, mimicsBitten: 0, trapsSprung: 0,
  looks: {}, known: {},        // appearance per id, and what you have learned

  branch: null,          // which stair was taken into this floor
  pendingBranch: null,   // the two on offer, while the choice screen is up
  pendingRelic: null,    // a relic waiting for a slot to be freed
  floorTurn: 0,          // turns spent on this floor — the clock
  waves: 0,              // how many times the floor has answered
  hazards: [],           // telegraphed ground, counting down
  campUses: 0,           // fires still owed on this floor
};

/* ── relics ───────────────────────────────────────────────
   Gear makes numbers bigger; a relic changes what the game
   does. Everything below is a lookup against the five the
   player is carrying — cheap enough to call per swing. */
export const hasRelic = id => !!G.player?.relics?.some(r => r === id);
export const relicVal = id =>
  (hasRelic(id) ? relicById(id).v + (G.player.tuned?.[id] || 0) : 0);
export const relicList = () => (G.player?.relics || []).map(relicById).filter(Boolean);

export const slotCount = () => relicSlots(G.deepest || G.depth || 0);

export function takeRelic(id) {
  const p = G.player;
  if (!p || hasRelic(id)) return false;
  p.relics = p.relics || [];
  if (p.relics.length >= slotCount()) { G.pendingRelic = id; G.screen = 'relic'; return false; }
  p.relics.push(id);
  say(`${relicById(id).n} — ${relicById(id).t}`, 'level');
  fx({ t:'altar', x:p.x, y:p.y, good:true });
  recalc(p);
  return true;
}

/* Swapping is the whole point of a slot limit: taking the new
   thing has to cost the old thing. */
export function swapRelic(dropIdx) {
  const p = G.player, id = G.pendingRelic;
  if (!id) return;
  if (dropIdx >= 0) {
    const gone = relicById(p.relics[dropIdx]);
    p.relics[dropIdx] = id;
    say(`${gone.n}을(를) 버리고 ${relicById(id).n}을(를) 걸었다.`, 'level');
  } else {
    /* Refused. Put it back on the ground rather than destroying
       it — the whole point of a slot limit is that the decision
       stays open, and a relic that evaporates on "no" turns the
       screen into a trap. */
    const r = relicById(id);
    G.items.push({ kind:'relic', id, spr:r.spr, n:r.n, x:p.x, y:p.y });
    say(`${r.n}을(를) 발치에 두었다. 마음이 바뀌면 다시 밟으시오.`);
  }
  G.pendingRelic = null;
  G.screen = 'play';
  recalc(p);
}

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
    lightTurns: 1100,
    blessed: 0,
    ail: {},          // ailment -> turns remaining
    stuck: 0,         // turns still caught in a web
    keys: 0,
    mats: { scrap: 0, dust: 0, essence: 0 },
    might: 0, iron: 0,
    spellPlus: {}, spellAffix: {},
    relics: [], boneHp: 0, seedAc: 0, grudge: 0,
    stam: 0, maxStam: 0, iframe: 0,
    perm: {}, tuned: {}, markup: 0, permHp: 0,
    equip: { weapon: null, body: null, shield: null },
    pack: [],
    x: 0, y: 0,
  };
  recalc(p, true);
  p.hp = p.maxhp; p.mana = p.maxmana;
  p.stam = p.maxStam;

  addItem(p, makeConsumable('potHeal'), 3);
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
  p.maxhp = Math.max(8, Math.round(p.maxhp * (1 + g.maxhpPct)) + (p.boneHp || 0) + (p.permHp || 0));
  p.maxmana = Math.max(0, Math.round(p.maxmana * (1 + g.manaPct)) + g.manaFlat);
  p.maxStam = staminaMax(p);
  if (init) return;
  p.hp = Math.min(p.hp, p.maxhp);
  p.mana = Math.min(p.mana, p.maxmana);
  p.stam = Math.min(p.stam ?? p.maxStam, p.maxStam);
}

/* ── gear resolution ──────────────────────────────────────
   Every derived number the player has runs through here, so an
   affix only ever has to be declared once in data.js. Cheap
   enough to recompute per swing: three slots, two affixes each. */
const EMPTY_BONUS = {
  dmg:0, dmgPct:0, hit:0, hitPct:1, crit:0, critMult:0, ac:0, stealth:0,
  lifesteal:0, chain:0, burst:0, execute:0, pierce:0,
  regen:0, lightR:0, maxhpPct:0, manaPct:0, manaFlat:0,
  on:null, resistAll:false, noStealth:false,
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

  /* Permanent gains from ? rooms live here too. They are not
     attached to any item, so nothing can take them away — which
     is exactly why an event that hands one out is memorable. */
  const perm = p.perm;
  if (perm) {
    b.dmg       += perm.dmg || 0;
    b.ac        += perm.ac || 0;
    b.stealth   += perm.stealth || 0;
    b.lightR    += perm.lightR || 0;
    b.lifesteal += perm.lifesteal || 0;
    b.chain     += perm.chain || 0;
    b.manaFlat  += perm.manaFlat || 0;
    if (perm.hitPctMul) b.hitPct *= perm.hitPctMul;
  }

  /* Relics ride the same funnel, so a relic and an affix can
     never disagree about what a number means. The ones with a
     condition are resolved here too — 저울추 only pays while you
     are nearly dead, which is what makes it a gamble rather
     than a stat. */
  for (const id of p.relics || []) {
    switch (id) {
      case 'pact':     b.maxhpPct -= 0.25; b.crit += 0.20; break;
      case 'chain':    b.ac += 4; b.noStealth = true; break;
      case 'reckless': b.hitPct *= 0.85; b.critMult += 0.8; break;
      case 'eye':      b.manaFlat -= 3; break;
      case 'vow':      b.dmgPct += 0.30; break;
      case 'scale':    if (p.hp <= p.maxhp * 0.3) b.dmgPct += 0.60; break;
      case 'lamp':     b.lightR -= 2; break;
      case 'moth':     b.maxhpPct -= 0.10; break;
      case 'knot':     b.stealth -= 0.5; break;
      case 'seed':     b.maxhpPct -= 0.15; b.ac += p.seedAc || 0; break;
      case 'grudge':   b.dmgPct += Math.min(0.60, (p.grudge || 0) * 0.04); break;
    }
  }
  return b;
}

export const armourClass = p =>
  gearBonus(p).ac
  + statBonus(p.stats.dex) + Math.floor(p.lv / 4)
  + (p.blessed > 0 ? 4 : 0) + (p.iron > 0 ? 10 : 0);

export const toHit = p => {
  const base = CLASSES[p.cls].bth * p.lv / 3 + statBonus(p.stats.dex) * 2
    + statBonus(p.stats.str) + (p.blessed > 0 ? 5 : 0) + gearBonus(p).hit;
  // Proportional, not flat: a flat penalty would cripple level 1
  // and barely register at level 20.
  return (has(p, 'fear') ? base * 0.55 : base) * gearBonus(p).hitPct;
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
export const stealth = p => (gearBonus(p).noStealth ? 0 : clamp(
  0.10 + statBonus(p.stats.dex) * 0.05
  + (p.race === 'halfling' ? 0.20 : p.race === 'elf' ? 0.10 : p.race === 'halfTroll' ? -0.15 : 0)
  + (p.cls === 'rogue' ? 0.25 : p.cls === 'ranger' ? 0.12 : 0)
  - (p.equip.body?.ac || 0) * 0.012
  - (p.equip.shield?.ac || 0) * 0.010
  + gearBonus(p).stealth,
  0, 0.92));

/* Each link in the chain adds damage; the chain is the reward
   for clearing a room without letting anything touch you. */
export const comboMult = () =>
  1 + Math.min(G.combo, 20) * (0.035 + (G.player?.perm?.comboStep || 0));

const COMBO_TIERS = [
  [5,  '연격 5 — 손이 풀렸다.'],
  [10, '연격 10 — 멈출 수가 없다.'],
  [15, '연격 15 — 바닥이 미끄럽다.'],
  [20, '연격 20 — 무엇도 다가오지 못한다.'],
];

function bumpCombo(x, y) {
  G.combo++;
  G.comboT = 14 + (G.player?.perm?.comboHold || 0);
  if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  for (const [n, msg] of COMBO_TIERS)
    if (G.combo === n) { say(msg, 'level'); fx({ t:'comboTier', x, y, n }); }
}

/* A hit to the face costs you half the chain — enough to hurt,
   not enough to make the whole system feel fragile. */
/* 앙심 counts the hits you have taken on this floor. Every path
   that costs you health goes through here, so a relic that pays
   for being hit can never disagree with what "being hit" means. */
function tookHit() {
  const p = G.player;
  if (hasRelic('grudge')) p.grudge = Math.min(15, (p.grudge || 0) + 1);
}

function breakCombo(hard) {
  if (!G.combo) return;
  // 전쟁 북: a hit costs a quarter of the chain rather than half.
  const left = hard ? 0 : (hasRelic('drum') ? Math.round(G.combo * 0.75) : G.combo >> 1);
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
    say(`${nameOf(it)}을(를) 들었다.`, 'good');
  } else if (it.kind === 'armour') {
    const key = it.slot;
    if (key === 'shield' && p.equip.weapon?.hands === 2) { say('양손 무기를 든 채로는 방패를 들 수 없다.', 'warn'); return; }
    const old = p.equip[key];
    p.equip[key] = it;
    removeItem(p, slotIdx);
    if (old) addItem(p, old);
    say(`${nameOf(it)}을(를) 착용했다.`, 'good');
  }
  endTurn();
}

/* ── salvage ──────────────────────────────────────────────
   The answer to "why is all this gear dropping". A weapon you
   will never wear is no longer litter; it is either coin at the
   merchant or material at the fire, and you cannot have both. */
export const canSalvage = it => !!it && (it.kind === 'weapon' || it.kind === 'armour');

export const salvagePreview = it => (canSalvage(it) ? salvageYield(it) : null);

export function salvage(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot || !canSalvage(slot.item)) return;
  const it = slot.item;
  const got = salvageYield(it);

  p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
  const parts = [];
  const mult = G.branch?.mats || 1;
  for (const k of ['scrap', 'dust', 'essence']) {
    if (!got[k]) continue;
    got[k] *= mult;
    p.mats[k] += got[k];
    parts.push(`${MATS[k].n} ${got[k]}`);
  }
  removeItem(p, slotIdx);
  say(parts.length ? `${affixName(it)}을(를) 부쉈다 — ${parts.join(' · ')}.`
                   : `${affixName(it)}은(는) 아무것도 남기지 않았다.`, 'good');
  fx({ t:'salvage', x:p.x, y:p.y });
}

export const mats = () => G.player?.mats || { scrap: 0, dust: 0, essence: 0 };

export function canAfford(cost) {
  const p = G.player;
  if (!p || !cost) return false;
  if ((cost.gold || 0) > p.gold) return false;
  const m = mats();
  for (const k of ['scrap', 'dust', 'essence'])
    if ((cost[k] || 0) > (m[k] || 0)) return false;
  return true;
}

function spend(cost) {
  const p = G.player;
  p.gold -= cost.gold || 0;
  for (const k of ['scrap', 'dust', 'essence']) p.mats[k] -= cost[k] || 0;
}

export const costText = cost => [
  cost.gold ? `${cost.gold}금` : null,
  cost.scrap ? `${MATS.scrap.n} ${cost.scrap}` : null,
  cost.dust ? `${MATS.dust.n} ${cost.dust}` : null,
  cost.essence ? `${MATS.essence.n} ${cost.essence}` : null,
].filter(Boolean).join(' · ');

/* ── quick slots ──────────────────────────────────────────
   A potion two taps away in a menu is a potion you die holding.
   Three fixed roles, filled automatically from the pack, so the
   common case — drink the heal, right now — is one tap and needs
   no inventory management at all.

   Deliberately role-based rather than player-assigned: assigning
   slots is another system to learn, and the whole point here is
   fewer things to manage. Anything that does not fit a role is
   still in the pack. */
const QUICK_ROLES = [
  { key:'heal',  n:'회복', want: it => it.use === 'bigHeal' || it.use === 'heal',
    rank: it => (it.use === 'bigHeal' ? 2 : 1) },
  { key:'boost', n:'강화', want: it => ['mana', 'might', 'iron'].includes(it.use),
    rank: it => (it.use === 'mana' ? 2 : 1) },
  { key:'out',   n:'탈출', want: it => ['flee', 'teleport', 'torch'].includes(it.use),
    rank: it => (it.use === 'flee' ? 3 : it.use === 'teleport' ? 2 : 1) },
];

/* Unknown flasks never get a quick slot. Auto-drinking something
   you have not identified would hand the gamble to the UI. */
export const QUICK_LABELS = QUICK_ROLES.map(r => r.n);

export function quickSlots() {
  const p = G.player;
  if (!p) return [];
  return QUICK_ROLES.map(role => {
    let best = -1, bestRank = -1;
    p.pack.forEach((slot, i) => {
      const it = slot.item;
      if (it.kind !== 'use' || !isKnown(it.id) || !role.want(it)) return;
      const r = role.rank(it);
      if (r > bestRank) { bestRank = r; best = i; }
    });
    return best < 0 ? null
      : { role: role.key, label: role.n, idx: best,
          item: p.pack[best].item, qty: p.pack[best].qty };
  });
}

/* ── item use ───────────────────────────────────────────── */
export function useItem(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot || slot.item.kind !== 'use') return;
  const it = slot.item;
  let spent = true;
  // Using it is how you find out what it was.
  identify(it.id);

  // 폭식의 위장 doubles what a flask does. It is the only relic
  // that makes the potions you were already hoarding matter.
  // 짧은 심지 turns the same act into an attack and takes the
  // healing back — a flask becomes a tactic, not a top-up.
  const gulp = (hasRelic('gut') ? 2 : 1) * (hasRelic('wick') ? 0.7 : 1);
  if (hasRelic('wick') && it.spr === 'potion') {
    const burn = relicVal('wick') + G.depth;
    const near = adjacentMonsters(p);
    if (near.length) {
      fx({ t:'burst', x:p.x, y:p.y, r:1.6, color:'o' });
      for (const o of near) hurtMonster(o, burn, '짧은 심지', {});
    }
  }

  switch (it.use) {
    case 'heal': {
      const h = Math.round(Math.min(p.maxhp - p.hp, (20 + roll(2, 8) + p.lv * 2) * gulp));
      p.hp += h; if (h) fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(h ? `상처가 아문다. 체력 +${h}.` : '이미 멀쩡하다.', 'good'); break;
    }
    case 'bigHeal': {
      const h = Math.round(Math.min(p.maxhp - p.hp, (Math.floor(p.maxhp * 0.6) + roll(3, 10)) * gulp));
      p.hp += h; fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(`깊은 상처까지 닫힌다. 체력 +${h}.`, 'good'); break;
    }
    case 'mana': {
      if (!p.maxmana) { say('아무 일도 일어나지 않았다.'); break; }
      const m = Math.round(Math.min(p.maxmana - p.mana, (Math.ceil(p.maxmana * 0.5) + roll(1, 6)) * gulp));
      p.mana += m; say(`머리가 맑아진다. 마나 +${m}.`, 'good'); break;
    }
    case 'map':   revealMap(); say('층의 구조가 머릿속에 그려진다.', 'good'); break;
    case 'teleport': teleport(); say('공간이 접혔다 펴진다.', 'good'); break;
    /* The panic button. It used to drop you two floors, which
       skipped the fork you were meant to choose; now it takes the
       plain stair down one floor, immediately, from wherever you
       are standing. That is what you want when the floor has
       started feeding and the stairs are on the far side of it. */
    case 'flee':
      if (G.depth === 0) { say('마을에서는 쓸 데가 없다.', 'warn'); spent = false; break; }
      if (G.depth >= MAX_DEPTH) { say('더 내려갈 곳이 없다.', 'warn'); spent = false; break; }
      say('발밑이 열리고, 한 층을 미끄러져 내려간다.', 'warn');
      enterDepth(G.depth + 1, false, BRANCHES[0]);
      break;
    case 'torch': p.lightTurns = Math.min(2600, p.lightTurns + 900); say('새 횃불에 불을 붙였다.', 'good'); break;

    /* The unknown half. Three of these are worth drinking and
       three are not, so an unidentified flask is a real bet. */
    case 'might':
      p.might = Math.round(40 * gulp); say('피가 끓는다. 잠시 훨씬 세게 때린다.', 'good');
      fx({ t:'ail', kind:'fear', x:p.x, y:p.y }); break;
    case 'iron':
      p.iron = Math.round(40 * gulp); say('살갗이 쇠처럼 굳는다.', 'good');
      fx({ t:'ail', kind:'slow', x:p.x, y:p.y }); break;
    case 'venom': {
      const dmg = roll(2, 5) + G.depth;
      p.hp -= dmg;
      afflict(p, 'poison', 20);
      say(`목이 타들어 간다. ${dmg}의 피해.`, 'hit');
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, severe:true });
      if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'독의 물약' }); }
      break;
    }
    case 'murk': afflict(p, 'blind', 22); break;
    case 'forge': {
      const slots = ['weapon', 'body', 'shield'].filter(k => p.equip[k]);
      if (!slots.length) { say('벼릴 것이 없다.', 'warn'); break; }
      const it2 = p.equip[slots[rnd(slots.length)]];
      it2.plus = Math.min(MAX_PLUS, (it2.plus || 0) + 1);
      recalc(p);
      say(`${affixName(it2)} — 저절로 벼려졌다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y });
      break;
    }
    case 'hex': {
      const slots = ['weapon', 'body', 'shield'].filter(k => p.equip[k]);
      if (!slots.length) { say('아무 일도 일어나지 않았다.'); break; }
      const it2 = p.equip[slots[rnd(slots.length)]];
      const table = Math.random() < 0.5 ? PREFIXES : SUFFIXES;
      const a = pickAffixFor(table, it2.kind, true);
      if (a) { it2[table === PREFIXES ? 'pre' : 'suf'] = a.id; recalc(p); }
      say(`${affixName(it2)} — 검은 글자가 스며든다.`, 'warn');
      fx({ t:'enchant', x:p.x, y:p.y, cursed:true });
      break;
    }
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
  // 침묵의 서약 trades the whole spellbook for a third more
  // damage in the hand — the sharpest build commitment here.
  if (hasRelic('vow')) { say('서약이 혀를 막는다. 주문은 나오지 않는다.', 'warn'); return; }
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
  (1 + (p.spellPlus?.[id] || 0) * 0.22
     + (SPELL_AFFIXES.find(a => a.id === p.spellAffix?.[id])?.powPct || 0))
  * (hasRelic('twin') ? 0.8 : 1);

export const spellCost = (p, sp) => {
  const a = SPELL_AFFIXES.find(x => x.id === p.spellAffix?.[sp.id]);
  return Math.max(1, sp.cost - (a?.costCut || 0) + (a?.costUp || 0)
                     - (hasRelic('twin') ? relicVal('twin') : 0));
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
export function enterDepth(depth, fromBelow = false, branch = null) {
  G.depth = depth;
  G.deepest = Math.max(G.deepest || 0, depth);
  G.branch = branch || BRANCHES[0];
  G.level = new Level(depth, G.branch);
  G.monsters = [];
  G.items = [];
  G.floorTurn = 0;
  G.waves = 0;
  G.hazards = [];
  G.campUses = 1 + (hasRelic('ember') ? 1 : 0);

  const L = G.level;
  const p = G.player;
  if (depth === 0) { p.x = L.entry.x; p.y = L.entry.y; }
  else if (fromBelow) {
    const d = findTile(L, DOWN); p.x = d.x; p.y = d.y;
  } else { p.x = L.entry.x; p.y = L.entry.y; }

  /* Modifiers a ? room promised for "the next floor", spent here
     and cleared immediately so they cannot carry on past it. */
  const mods = G.nextMods || null;
  G.nextMods = null;
  if (mods && depth > 0) {
    G.branch = { ...G.branch };
    for (const k of ['item', 'elite', 'chests', 'clock'])
      if (mods[k] != null) G.branch[k] = (G.branch[k] ?? 1) * mods[k];
  }

  /* A fire promised three floors ago has to actually be here. */
  if (depth > 0 && G.campPromise > 0 && !L.camp) {
    G.campPromise--;
    L.forceCamp();
  } else if (depth > 0 && G.campPromise > 0) G.campPromise--;

  if (depth > 0) populate(depth);
  if (depth > 0 && L.event) L.eventId = rollEvent();
  if (mods?.mapped && depth > 0) L.seen.fill(1);
  refreshFov();

  /* A fire burns whether or not you are looking at it. Mark it
     as remembered the moment you arrive, so the floor has a
     destination other than the stairs — otherwise most players
     would walk past the one real decision on the level. */
  if (L.camp) {
    L.seen[idx(L.camp.x, L.camp.y)] = 1;
    if (depth > 0) say('멀리서 불빛이 흔들린다.', 'good');
  }
  if (depth > 0 && L.theme?.n) say(`${L.theme.n}이다.`, 'warn');

  // 심연의 눈 pays out the moment you arrive, which is the only
  // moment a whole map is worth anything.
  if (depth > 0 && hasRelic('eye')) { L.seen.fill(1); say('심연의 눈이 층 전체를 훑는다.', 'good'); }
  /* 나방의 표식 shows the three places worth walking to instead of
     the whole map — cheaper than 심연의 눈 and, for a player who
     only cares about the fire and the stone, better. */
  if (depth > 0 && hasRelic('moth')) {
    let n = 0;
    for (const spot of [L.camp, L.altar, L.merchant, L.event])
      if (spot) { L.seen[idx(spot.x, spot.y)] = 1; n++; }
    if (n) say(`나방이 ${n}곳으로 날아갔다.`, 'good');
  }
  // 뱃사공의 동전 takes its cut on the way down.
  if (depth > 0 && hasRelic('toll') && p.gold > 0) {
    const fee = Math.ceil(p.gold * 0.10);
    p.gold -= fee;
    say(`뱃사공이 ${fee}닢을 챙겼다.`, 'warn');
  }
  // 돌씨 hardens a little every floor, for the whole run.
  if (depth > 0 && hasRelic('seed')) {
    p.seedAc = (p.seedAc || 0) + 1;
    recalc(p);
    say(`돌씨가 자란다. 방어 +${p.seedAc}.`, 'good');
  }
  if (depth > 0) p.grudge = 0;      // 앙심 forgets between floors
  // 시간 도둑 buys the descent back — and charges for it in turns.
  if (depth > 0 && hasRelic('thief') && p.hp < p.maxhp) {
    p.hp = p.maxhp; p.mana = p.maxmana;
    say('시간 도둑이 상처를 되감았다.', 'good');
    fx({ t:'heal', x:p.x, y:p.y, amt:0 });
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

  /* A named thing waits on two floors on the way down. Announced
     on arrival, because a floor you know holds one is a floor you
     walk differently — and the patterns are the reason walking
     differently matters. */
  const named = NAMED.find(n => n.at === depth);
  if (named) {
    const spot = L.openSpot(L.downRoom || L.rooms[L.rooms.length - 1], busy);
    if (spot) {
      G.monsters.push({ ...named, maxhp: named.hp, x: spot.x, y: spot.y, awake: false, energy: 0 });
      say(named.intro, 'hit');
    }
  }

  /* Pack animals arrive as a pack. Six wolves coming down one
     corridor is a different problem from six wolves scattered
     across a floor, and it is the problem doors are for. */
  const br = G.branch || {};
  const mob = G.level.theme?.mob || 1;
  const budget = Math.round((6 + rnd(5) + Math.floor(depth * 0.9))
                            * Math.min(mob, 1.35) * (br.mon || 1));
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
      if (Math.random() < eliteChance(depth) * (br.elite ?? 1)) makeElite(one, depth);
      one.maxhp = one.hp;
      G.monsters.push(one);
      placed++;
    }
  }

  const loot = Math.round((4 + rnd(5)) * (br.item || 1));
  for (let i = 0; i < loot; i++) {
    const item = pickItem(depth);
    const spot = L.randomFloor(busy);
    if (spot && item) G.items.push({ ...item, x: spot.x, y: spot.y });
  }
  const piles = 2 + rnd(4);
  for (let i = 0; i < piles; i++) {
    const spot = L.randomFloor(busy);
    if (spot) G.items.push({ kind:'gold', spr:'gold', n:'금화',
      amount: Math.round((15 + rnd(40 + depth * 25)) * (br.gold || 1)), x: spot.x, y: spot.y });
  }

  /* A branch that promised a relic has to deliver one on the
     floor, not as a maybe-drop — the printed odds on the stairs
     screen are a contract. */
  if (br.relic) {
    const spot = L.randomFloor(busy);
    const id = unownedRelic();
    if (spot && id) G.items.push({ kind:'relic', id, spr: relicById(id).spr,
                                   n: relicById(id).n, x: spot.x, y: spot.y });
  }

  /* Chests, and the thing that is pretending to be one. The
     mimic share climbs with depth, so by the time a chest is
     worth opening you are no longer sure you should. */
  const chests = (1 + rnd(3)) * (br.chests || 1);
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
  const pool = MONSTERS.filter(m => m.d <= depth && m.d >= depth - 5);
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
  m.heavy = true;                       // elites telegraph and hit for two and a half
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

/* Light shrinks, it does not switch off. A cliff at zero taught
   the player nothing until it was too late; a radius that closes
   in over the last few hundred turns is a warning you can act on
   — and on a 빛이 없는 층 it is the whole fight. */
export const lightRadiusOf = p => {
  if (G.depth === 0) return 12;
  const t = p.lightTurns;
  return t <= 0 ? 2 : t < 80 ? 3 : t < 300 ? 5 : 7;
};

export function refreshFov() {
  const p = G.player;
  let radius = lightRadiusOf(p);
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
  if (t === CAMP)  { p.x = nx; p.y = ny; refreshFov(); G.screen = 'camp'; return; }
  if (t === ALTAR) { p.x = nx; p.y = ny; refreshFov(); G.screen = 'altar'; return; }
  if (t === EVENT) { p.x = nx; p.y = ny; refreshFov(); G.screen = 'event'; return; }
  if (t === DOOR)        { openDoor(nx, ny); endTurn(); return; }
  if (t === DOOR_LOCKED) { forceDoor(nx, ny); endTurn(); return; }
  if (L.solid(nx, ny)) return;

  const m = monsterAt(nx, ny);
  if (m) { playerAttack(m); endTurn(); return; }

  /* 창류 reaches past the tile in front of you. Stepping into an
     empty square that has something behind it becomes a thrust
     rather than a move — which is how a spear fights a thing
     that is winding up. */
  if (weaponReach(p) > 1) {
    const far = monsterAt(nx + dx, ny + dy);
    if (far && !far.disguise && !L.solid(nx, ny)) {
      fx({ t:'lunge', who:'player', x:p.x, y:p.y, dx, dy, kind:'spear' });
      playerAttack(far);
      endTurn();
      return;
    }
  }

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
    if (roped()) say('밧줄이 거미줄을 갈라 놓는다.');
    else {
      p.stuck = 1 + rnd(3);
      say('거미줄에 걸렸다.', 'warn');
      fx({ t:'struggle', x, y });
    }
  } else if (t === WATER) {
    // Wading is safe and extremely loud.
    fx({ t:'splash', x, y });
    rouse(x, y, 7, 0.5);
  }

  const trap = L.traps.get(i);
  if (trap) return springTrap(x, y, trap);
  return false;
}

/* 매듭 밧줄. Two of the game's three "you lose your turn" effects
   simply stop applying, which is what makes the stealth price
   worth paying for a build that walks into everything. */
const roped = () => hasRelic('knot');

function springTrap(x, y, trap) {
  const p = G.player, L = G.level;
  L.traps.delete(idx(x, y));
  G.trapsSprung++;
  // 부러진 나침반: you walk into every one of them and none of
  // them matter. Blind and immune is a build, not a handicap.
  if (hasRelic('compass')) {
    say('나침반 바늘이 홱 돌더니, 발밑의 무언가가 죽는다.', 'good');
    fx({ t:'resist', x, y });
    return false;
  }
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
      /* Catching the edge. Falling a floor skips content you were
         in the middle of, so it should be the unlucky outcome and
         not the default — and dexterity should be the thing that
         decides it. */
      if (roped()) { say('밧줄이 걸려 허공에 매달렸다. 기어 올라온다.', 'good'); return false; }
      const grab = clamp(0.45 + statBonus(p.stats.dex) * 0.07
                         + (p.cls === 'rogue' ? 0.15 : p.cls === 'ranger' ? 0.07 : 0), 0.2, 0.92);
      if (Math.random() < grab) {
        const graze = roll(1, 4);
        p.hp -= graze;
        say(`가장자리를 붙잡았다. ${graze}의 피해.`, 'good');
        fx({ t:'struggle', x:p.x, y:p.y });
        if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'구덩이' }); }
        return false;
      }
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
    // 도굴꾼의 장갑 and 부러진 나침반 both blind you to traps —
    // one for greed, one because it no longer matters.
    if (hasRelic('glove') || hasRelic('compass')) continue;
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
  if (it.kind === 'relic') {
    // Leave it lying there if the swap screen is refused, so the
    // choice can be walked away from and come back to.
    if (!takeRelic(it.id) && G.screen !== 'relic') return;
    G.items.splice(i, 1);
    return;
  }
  G.items.splice(i, 1);
  if (it.kind === 'gold') { const g = goldGain(it.amount); p.gold += g; say(`금화 ${g}닢.`, 'good'); return; }
  if (it.kind === 'key')  { p.keys++; say(`녹슨 열쇠를 주웠다. (${p.keys})`, 'good'); return; }
  // 서기의 깃펜 names it in your hand, before you have to bet on it.
  if (hasRelic('quill')) identify(it.id, true);
  addItem(p, it);
  say(`${nameOf(it)}을(를) 주웠다.`, 'good');
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

  // 도굴꾼의 장갑: everything in the box, twice. The cost is
  // paid in every trap you no longer see coming.
  const twice = hasRelic('glove');
  const gold = goldGain(Math.round((chest.gold || 0) * (twice ? 2 : 1)));
  if (gold) { p.gold += gold; say(`금화 ${gold}닢.`, 'good'); }
  for (const it of chest.loot || []) {
    addItem(p, it, twice && it.kind === 'use' ? 2 : 1);
    say(`${nameOf(it)}을(를) 얻었다.${twice ? ' (장갑이 한 번 더 훑었다)' : ''}`, 'good');
  }
  if (twice) {
    const extra = pickItem(G.depth + 2);
    if (extra) { addItem(p, extra); say(`${extra.n}도 딸려 나왔다.`, 'good'); }
  }
}

/* ── weapon families ──────────────────────────────────────
   Six rules rather than six damage dice. Everything below reads
   `weaponType(p)` once and branches; nothing else in the file
   needs to know what a spear is. */
export const weaponType = p => p.equip.weapon?.t || 'sword';
export const weaponReach = p => (weaponType(p) === 'spear' ? 2 : 1);

/* Called once per player turn. A dagger swings twice; everything
   else swings once and lets its own rule fire inside. */
function playerAttack(m) {
  const p = G.player;
  if (!p.swinging && weaponType(p) === 'dagger') {
    p.swinging = true;
    swing(m, 0.62);
    // The second thrust only lands if there is still something
    // in front of you — which is why a dagger wants 처형.
    if (G.running && G.monsters.includes(m)) swing(m, 0.62);
    p.swinging = false;
    return;
  }
  swing(m, 1);
}

function swing(m, scale) {
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
  fx({ t:'lunge', who:'player', x:p.x, y:p.y, kind:weaponType(p),
       dx: Math.sign(m.x - p.x), dy: Math.sign(m.y - p.y) });

  /* A sleeping target never gets a saving throw. This is the
     reason to take the long way round instead of the short. */
  const gp = gearBonus(p);
  const kind = weaponType(p);
  const armour = m.ac * 1.15 * (1 - gp.pierce);   // 꿰뚫는: armour counts for less
  // 대검류 is wilder; everything else swings true.
  const aim = kind === 'great' ? 0.88 : 1;
  const chance = asleep ? 1 : clamp(0.44 + (toHit(p) * aim - armour) / 55, 0.18, 0.95);
  if (Math.random() > chance) {
    say(`${m.n}을(를) 빗맞혔다.`);
    fx({ t:'miss', x:m.x, y:m.y });
    return;
  }

  const w = p.equip.weapon;
  const dice = w ? w.dice : [1, 3];
  const g = gp;
  let dmg = roll(dice[0], dice[1]) + statBonus(p.stats.str) * 2 + Math.floor(p.lv / 3) + g.dmg;
  dmg *= (1 + g.dmgPct + (p.might > 0 ? 0.6 : 0));
  dmg *= scale;
  if (kind === 'great') dmg *= 1.45;

  // 낙인: sharpened against the things that telegraph, blunted
  // against everything else.
  if (hasRelic('brand')) dmg *= (m.elite?.length || m.boss) ? 1.5 : 0.85;

  const crit = asleep || Math.random() < critChance(p) + (kind === 'dagger' ? 0.08 : 0);
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
  weaponRule(kind, m, dmg, crit);

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

  /* 메아리의 종. Deliberately placed last, after 연쇄 and 흡혈,
     so the second swing runs the whole chain again — a long
     streak with the right two suffixes turns one tap into a
     room-clearing cascade. That is the absurd combination this
     relic exists to make possible. */
  if (hasRelic('echo') && G.combo >= relicVal('echo')
      && G.monsters.includes(m) && !p.echoing) {
    p.echoing = true;
    fx({ t:'arc', fx:p.x, fy:p.y, tx:m.x, ty:m.y });
    say('종이 한 번 더 울렸다.', 'level');
    playerAttack(m);
    p.echoing = false;
  }
}

/* 뱃사공의 동전 doubles it, 서기의 깃펜 shaves it. One funnel so
   the two can never be applied twice or missed once. */
export const goldGain = n => Math.max(0, Math.round(
  n * (hasRelic('toll') ? 2 : 1) * (hasRelic('quill') ? 0.75 : 1)));

/* Relics that pay on a kill. 굶주린 칼날 is the aggression
   engine — it out-heals a room only if you keep killing — and
   뼈 목걸이 is the slow one, worth taking early or not at all. */
function onKill(m) {
  const p = G.player;
  if (hasRelic('hunger') && p.hp < p.maxhp) {
    const got = Math.min(p.maxhp - p.hp, relicVal('hunger'));
    p.hp += got;
    fx({ t:'drain', x:p.x, y:p.y, amt:got });
  }
  if (hasRelic('bone') && (p.boneHp || 0) < 30) {
    p.boneHp = (p.boneHp || 0) + 1;
    recalc(p);
    p.hp += 1;
    if (p.boneHp % 10 === 0) say(`뼈 목걸이가 무거워진다. (최대 체력 +${p.boneHp})`, 'level');
  }
}

/* What the weapon does *after* the damage lands. Kept in one
   place so a new family is one case, and so 연쇄 and 작열 stack
   on top of it rather than fighting it. */
function weaponRule(kind, m, dmg, crit) {
  const p = G.player;
  if (kind === 'axe') {
    /* Cleave: the two tiles flanking the target, relative to you.
       Standing so that three bodies line up is the whole skill. */
    const dx = Math.sign(m.x - p.x), dy = Math.sign(m.y - p.y);
    const side = dx && dy ? [[dx, 0], [0, dy]] : dx ? [[dx, -1], [dx, 1]] : [[-1, dy], [1, dy]];
    const spill = Math.max(1, Math.round(dmg * 0.7));
    for (const [ox, oy] of side) {
      const o = monsterAt(p.x + ox, p.y + oy);
      if (o && o !== m && !o.disguise) {
        fx({ t:'arc', fx:m.x, fy:m.y, tx:o.x, ty:o.y });
        hurtMonster(o, spill, '휘둘러', {});
      }
    }
  } else if (kind === 'mace' && Math.random() < 0.30 && G.monsters.includes(m)) {
    // Stagger: eat the energy it had banked, so it loses its turn.
    m.energy = Math.min(m.energy || 0, 0) - 1;
    m.staggered = 2;
    say(`${m.n}이(가) 휘청인다.`, 'good');
    fx({ t:'ail', kind:'slow', x:m.x, y:m.y });
  } else if (kind === 'great' && crit) {
    // A critical with a greatsword is a room-wide event.
    const near = adjacentMonsters(p).filter(o => o !== m);
    const spill = Math.max(1, Math.round(dmg * 0.5));
    if (near.length) {
      fx({ t:'burst', x:p.x, y:p.y, r:1.8, color:'W' });
      for (const o of near) hurtMonster(o, spill, '쓸어', {});
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
    if (m.named) {
      const id = unownedRelic();
      if (id) {
        G.items.push({ kind:'relic', id, spr: relicById(id).spr, n: relicById(id).n, x:m.x, y:m.y });
        say(`${relicById(id).n}이(가) 남았다.`, 'level');
        fx({ t:'drop', x:m.x, y:m.y, relic:true });
      }
      dropElite(m);
    } else if (m.elite?.length) dropElite(m);
    onKill(m);
    gainXp(Math.round(m.xp * (G.branch?.xp || 1)));
    if (m.boss) victory();
  } else {
    fx({ t:'hit', on:'monster', x:m.x, y:m.y, dmg, crit:!!opt.crit, sneak:!!opt.sneak, spr:m.spr });
    if (!opt.quiet) {
      const tag = opt.sneak ? ' 기습!' : opt.crit ? ' 치명타!' : '';
      say(`${via}${m.n}에게 ${dmg}의 피해.${tag}`, opt.crit ? 'level' : 'hit');
    }
  }
}

/* Relics never repeat within a run — a second 뼈 목걸이 is not a
   choice, it is filler. */
export function unownedRelic() {
  const held = new Set(G.player?.relics || []);
  const pool = RELICS.filter(r => !held.has(r.id));
  return pool.length ? pool[rnd(pool.length)].id : null;
}

/* An elite always leaves something with a name on it — and one
   in five leaves the thing that changes the run instead. */
function dropElite(m) {
  const spot = { x: m.x, y: m.y };
  if (Math.random() < 0.22) {
    const id = unownedRelic();
    if (id) {
      G.items.push({ kind:'relic', id, spr: relicById(id).spr, n: relicById(id).n, ...spot });
      say(`${relicById(id).n}이(가) 굴러떨어졌다.`, 'level');
      fx({ t:'drop', x: spot.x, y: spot.y, relic:true });
      return;
    }
  }
  const it = pickItem(G.depth + 4);
  if (!it) return;
  rollAffixes(it, G.depth + 8, true);
  if (Math.random() < 0.45) it.plus = 1 + rnd(2);
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

/* ── the fork ─────────────────────────────────────────────
   Two staircases, both described in advance. This is where a
   run stops being a straight line: the same character comes out
   of floor 9 rich and fragile or poor and armoured depending on
   six of these. Every branch that gives also takes, or it is not
   a choice — it is a reward.

   The town and the boss floor get no fork: one has nothing to
   trade and the other is not a place you pick your way into. */
export function descend() {
  const L = G.level, p = G.player;
  if (L.tiles[idx(p.x, p.y)] !== DOWN) { say('여기엔 내려가는 계단이 없다.'); return; }
  if (G.depth >= MAX_DEPTH) { say('이 아래로는 아무것도 없다.'); return; }
  if (G.depth + 1 >= MAX_DEPTH || G.depth === 0) { takeStairs(BRANCHES[0]); return; }

  const pool = BRANCHES.slice(1).filter(b => !(b.id === 'rush' && G.depth < 3));
  const a = pool.splice(rnd(pool.length), 1)[0];
  const b = pool.splice(rnd(pool.length), 1)[0];
  // Plain is always on the table. A fork with no safe road is a
  // toll, not a decision.
  G.pendingBranch = [BRANCHES[0], a, b].slice(0, 3);
  G.screen = 'stairs';
}

export function chooseBranch(id) {
  const b = BRANCHES.find(x => x.id === id) || BRANCHES[0];
  G.pendingBranch = null;
  G.screen = 'play';
  takeStairs(b);
}

function takeStairs(branch) {
  enterDepth(G.depth + 1, false, branch);
  say(G.depth === MAX_DEPTH ? '공기가 뜨겁다. 무언가 커다란 것이 숨쉬고 있다.'
                            : `던전 ${G.depth}층 — ${branch.n}.`, 'warn');
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
  if (p.might > 0 && --p.might === 0) say('끓던 피가 식는다.');
  if (p.iron > 0 && --p.iron === 0) say('굳었던 살갗이 풀린다.');
  if (G.detectPulse > 0) G.detectPulse--;

  if (G.comboT > 0 && --G.comboT === 0) breakCombo(true);
  if (G.turn % STAM_REGEN_EVERY === 0 && p.stam < p.maxStam) p.stam++;

  if (G.depth > 0) {
    /* One upkeep resource, not two. Food and torches were the
       same countdown wearing different hats, and with 15 floors
       neither ever ran out — two numbers to babysit that decided
       nothing. Light survives because it is *spatial*: it changes
       how far you can see, which changes what you can fight. */
    if (!hasRelic('lamp'))
      p.lightTurns -= (G.branch?.drain || 1) * (hasRelic('hunger') ? 2 : 1);
    if (p.lightTurns === 300) say('기름이 절반쯤 남았다.', 'warn');
    if (p.lightTurns === 80)  say('불빛이 손바닥만큼 줄었다.', 'warn');
    if (p.lightTurns === 0)   say('불이 꺼졌다. 두 칸 앞이 벽인지 아닌지도 모른다.', 'hit');
    if (p.lightTurns < 0) p.lightTurns = 0;
    G.floorTurn++;
    pressure();
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
  if (G.running) tickHazards();
  if (!G.running) return;
  refreshFov();
  readIntents();
  /* Spent at the very end: the roll has to still be dodging while
     the monsters and the marked ground resolve, which is the whole
     turn it was bought for. */
  if (p.iframe > 0) p.iframe--;
}

/* ── the clock ────────────────────────────────────────────
   Vampire Survivors' actual design is not the weapons, it is
   the timer: the screen fills whether you are ready or not, so
   power has to arrive faster than pressure does. A dungeon with
   no clock lets a patient player rest away every mistake, which
   is exactly the "too easy, too slow" this floor plan had.

   The budget is generous — you can clear a floor properly and
   never see a wave. Overstay and the floor starts feeding, each
   wave a little stronger than the last, and they arrive awake
   and knowing where you are. Nothing here kills you outright.
   It just makes standing still the losing move. */
export function floorBudget() {
  return Math.max(60, Math.round(
    FLOOR_BUDGET(G.depth) * (G.branch?.clock || 1) * (hasRelic('thief') ? 0.65 : 1)));
}

export const pressureLevel = () => {
  const over = G.floorTurn - floorBudget();
  return over <= 0 ? 0 : 1 + Math.floor(over / WAVE_EVERY);
};

function pressure() {
  const over = G.floorTurn - floorBudget();
  if (over < 0) return;
  if (over === 0) {
    say('발밑에서 무언가 깨어난다. 이 층은 더 이상 안전하지 않다.', 'hit');
    fx({ t:'noise', x:G.player.x, y:G.player.y });
    return;
  }
  if (over % WAVE_EVERY) return;
  spawnWave();
}

function spawnWave() {
  const L = G.level, p = G.player;
  G.waves++;
  const grow = 1 + WAVE_GROWTH * G.waves;
  const count = 1 + (G.waves >= 4 ? 1 : 0);
  let born = 0;
  for (let i = 0; i < count; i++) {
    // Far enough away to be a warning rather than an ambush.
    let spot = null;
    for (let t = 0; t < 60 && !spot; t++) {
      const s = L.randomFloor((x, y) => monsterAt(x, y) || (p.x === x && p.y === y));
      if (!s) break;
      if (Math.hypot(s.x - p.x, s.y - p.y) < 9) continue;
      spot = s;
    }
    if (!spot) continue;
    const m = pickMonster(Math.min(MAX_DEPTH, G.depth + 1));
    m.hp = Math.round(m.hp * grow);
    m.atk = Math.round(m.atk * grow);
    m.maxhp = m.hp;
    Object.assign(m, { x: spot.x, y: spot.y, awake: true, energy: 0 });
    if (Math.random() < eliteChance(G.depth) * 1.5) makeElite(m, G.depth);
    m.maxhp = m.hp;
    G.monsters.push(m);
    born++;
  }
  if (born) {
    say(`심연이 ${born === 1 ? '하나' : '둘'}를 더 게워냈다. (${G.waves}번째)`, 'hit');
    fx({ t:'noise', x:p.x, y:p.y });
  }
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
  if (m.staggered > 0) { m.staggered--; return; }   // 둔기류 took its turn
  if (m.cooling > 0) m.cooling--;
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
    // 전쟁 북 is loud: it hears you two tiles sooner.
    const reach = dist - (hasRelic('drum') ? 2 : 0);
    const notice = clamp((1 - quiet) * (0.62 - reach * 0.055), 0.02, 0.9);
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

  /* Heavy hitters wind up. One turn of nothing, then a blow
     worth two and a half — which is the turn the player gets to
     step back, shut a door, drink, or decide the trade is worth
     it anyway. Without the pause an elite is just a bigger
     number; with it, it is a problem to solve. */
  /* Things with a repertoire use it at range. The pattern is
     drawn on the floor a turn or two before it lands, which is
     the entire fight: read the shape, decide whether to walk out
     of it, roll out of it, or spend the turn hitting instead. */
  if (m.casts?.length && !m.cooling && dist2 > 2 && dist <= 9
      && lineClear(L, m.x, m.y, p.x, p.y)) {
    const key = m.casts[rnd(m.casts.length)];
    if (castPattern(m, key)) return;
  }

  if (dist2 <= 2) {
    if (m.heavy && !m.wind) {
      m.wind = 1;
      say(`${m.n}이(가) 크게 팔을 당긴다.`, 'warn');
      fx({ t:'wake', x:m.x, y:m.y });
      return;
    }
    monsterMelee(m);
    return;
  }
  m.wind = 0;                           // lost the swing; must wind up again

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
  const heavy = m.wind > 0;
  m.wind = 0;
  if (p.iframe > 0) {
    say(`구르며 ${m.n}의 손을 피했다.`, 'good');
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  const chance = clamp(0.24 + (m.atk * 1.45 - ac * 1.75) / 62, 0.06, 0.90);
  if (Math.random() > chance) {
    say(`${m.n}의 ${heavy ? '내리친 일격이' : '공격이'} 빗나갔다.`);
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  const dmg = Math.max(1, Math.round(
    (roll(2, Math.max(3, Math.floor(m.atk * 0.72))) - Math.floor(ac / 5))
    * (heavy ? 2.5 : 1) * (1 + (p.perm?.takeMore || 0))));
  p.hp -= dmg;
  breakCombo(false); tookHit();
  fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, from:{ x:m.x, y:m.y },
       severe: dmg >= p.maxhp * 0.18 });
  say(`${m.n}이(가) ${heavy ? '내리쳐 ' : ''}${dmg}의 피해를 입혔다.`, 'hit');
  if (m.drain) {                       // 흡혈하는: it heals off you
    const back = Math.max(1, Math.round(dmg * m.drain));
    m.hp = Math.min(m.maxhp, m.hp + back);
  }
  if (m.on && Math.random() < 0.28) afflict(p, m.on, 9 + rnd(9));
  reflect(m, dmg);
  if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death(m); }
}

/* 거울 방패. Deliberately placed after the damage is applied, so
   a reflected killing blow still trades — you both go down. */
function reflect(m, dmg) {
  if (!hasRelic('mirror') || !G.monsters.includes(m)) return;
  const back = Math.max(1, Math.round(dmg * relicVal('mirror')));
  hurtMonster(m, back, '거울 방패');
}

function monsterShoot(m) {
  const p = G.player;
  const ac = armourClass(p);
  fx({ t:'shot', fx:m.x, fy:m.y, tx:p.x, ty:p.y, kind:m.spr });
  if (p.iframe > 0) { say('구르며 흘려보냈다.', 'good'); fx({ t:'miss', x:p.x, y:p.y }); return; }
  const chance = clamp(0.20 + (m.atk * 1.25 - ac * 1.6) / 62, 0.05, 0.80);
  if (Math.random() > chance) {
    say(`${m.n}의 원거리 공격이 빗나갔다.`);
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  const dmg = Math.max(1, roll(2, Math.max(3, Math.floor(m.atk * 0.6))) - Math.floor(ac / 6));
  p.hp -= dmg;
  breakCombo(false); tookHit();
  fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, from:{ x:m.x, y:m.y },
       severe: dmg >= p.maxhp * 0.18 });
  say(`${m.n}이(가) 멀리서 ${dmg}의 피해를 입혔다.`, 'hit');
  if (m.on && Math.random() < 0.22) afflict(p, m.on, 8 + rnd(8));
  reflect(m, dmg);
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

/* ── telegraphed ground ───────────────────────────────────
   Mark tiles, print a countdown on them, then hit whatever is
   still standing there. Everything a boss does that is bigger
   than a punch goes through this, so a pattern is a shape plus
   a number and nothing else has to know about it.

   Friendly fire is deliberate: the emperor burns its own escort,
   which means a good position is one that puts something else in
   the fire with you. */
export function castPattern(m, key) {
  const spec = PATTERNS[key];
  if (!spec) return false;
  const L = G.level, p = G.player;
  const tiles = patternTiles(spec, m, p);
  if (!tiles.length) return false;

  G.hazards.push({
    key, tiles, left: spec.warn,
    dmg: Math.max(2, Math.round(m.atk * spec.dmgPct)),
    tone: spec.tone, from: { x: m.x, y: m.y },
    grow: spec.grow ? 1 : 0, r: spec.r || 0, owner: m.n,
  });
  m.cooling = m.cool || 4;
  say(`${m.n}${spec.say}`, 'warn');
  fx({ t:'wake', x:m.x, y:m.y });
  return true;
}

function patternTiles(spec, m, p) {
  const L = G.level, out = [];
  const push = (x, y) => {
    if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) return;
    if (L.solid(x, y)) return;
    out.push(idx(x, y));
  };

  if (spec.reach && !spec.r) {
    /* A line, or a cross, drawn through the caster along the axis
       that actually contains you — so standing off the axis is
       the counterplay, and it is visible before it lands. */
    const horiz = Math.abs(p.y - m.y) <= Math.abs(p.x - m.x);
    const arms = spec.n === '십자' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
               : horiz ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    push(m.x, m.y);
    for (const [dx, dy] of arms)
      for (let i = 1; i <= spec.reach; i++) {
        const x = m.x + dx * i, y = m.y + dy * i;
        if (L.solid(x, y)) break;         // walls stop it
        push(x, y);
      }
    return out;
  }

  // A blob, centred where you are standing *now*.
  const cx = spec.ring ? m.x : p.x, cy = spec.ring ? m.y : p.y;
  const r = spec.r || 1;
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r + 0.35) continue;
      if (spec.ring && d < r - 0.65) continue;   // a ring, not a disc
      push(x, y);
    }
  return out;
}

/* Ticked once per player turn, after the monsters have moved, so
   the count the player reads is the count they get to act on. */
function tickHazards() {
  const p = G.player;
  for (const h of [...G.hazards]) {
    if (--h.left > 0) continue;
    resolveHazard(h);
    if (!G.running) return;

    // 불길 walks outward for a few more turns.
    if (h.grow && h.grow < (PATTERNS[h.key].grow || 0)) {
      h.grow++;
      h.r = h.grow;
      h.tiles = patternTiles({ ...PATTERNS[h.key], r: h.r, ring: true },
                             { x: h.from.x, y: h.from.y }, p);
      h.left = 1;
      if (h.tiles.length) continue;
    }
    G.hazards.splice(G.hazards.indexOf(h), 1);
  }
}

function resolveHazard(h) {
  const p = G.player;
  const hit = new Set(h.tiles);
  fx({ t:'hazard', tiles: h.tiles, tone: h.tone });

  if (hit.has(idx(p.x, p.y))) {
    if (p.iframe > 0) {
      say('구르며 빠져나갔다.', 'good');
      fx({ t:'resist', x:p.x, y:p.y });
    } else {
      const ac = armourClass(p);
      const dmg = Math.max(1, Math.round((h.dmg - ac * 0.25) * (1 + (p.perm?.takeMore || 0))));
      p.hp -= dmg;
      breakCombo(false); tookHit();
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, severe:true });
      say(`${h.owner}의 ${PATTERNS[h.key].n}에 ${dmg}의 피해.`, 'hit');
      if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n: h.owner }); return; }
    }
  }
  // Everything else standing in it, including the caster's own.
  for (const m of [...G.monsters])
    if (hit.has(idx(m.x, m.y)) && !m.disguise)
      hurtMonster(m, Math.round(h.dmg * 0.7), PATTERNS[h.key].n, {});
}

export const hazardAt = (x, y) => {
  const i = idx(x, y);
  for (const h of G.hazards) if (h.tiles.includes(i)) return h;
  return null;
};

/* ── the roll ─────────────────────────────────────────────
   The answer to a telegraph. Two tiles, one turn, and the next
   thing that swings at you this turn misses. Stamina is what
   stops it from being the answer to everything. */
export function canRoll() {
  const p = G.player;
  return !!p && p.stam >= ROLL_COST && !has(p, 'paralyze') && !(p.stuck > 0);
}

export function dodgeRoll(dx, dy) {
  const p = G.player, L = G.level;
  if (!dx && !dy) return false;
  if (!canRoll()) { say(p.stam < ROLL_COST ? '숨이 차다.' : '움직일 수 없다.', 'warn'); return false; }

  let moved = 0;
  for (let i = 0; i < ROLL_DIST; i++) {
    const nx = p.x + dx, ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) break;
    if (L.solid(nx, ny) || monsterAt(nx, ny)) break;
    const t = L.tiles[idx(nx, ny)];
    if (t === CAMP || t === ALTAR || t === EVENT || L.shopAt.has(idx(nx, ny))) break;
    p.x = nx; p.y = ny; moved++;
  }
  if (!moved) { say('구를 자리가 없다.', 'warn'); return false; }

  p.stam -= ROLL_COST;
  p.iframe = 1;
  p.stuck = 0;
  fx({ t:'roll', x:p.x, y:p.y, dx, dy, dist:moved });
  refreshFov();
  // A roll passes over ground rather than stopping on it: no
  // pickup, no trap, and the traps you skipped stay armed.
  endTurn();
  return true;
}

/* ── intent ───────────────────────────────────────────────
   The one idea worth stealing wholesale from Slay the Spire.
   A fight you cannot read is a dice roll; a fight where every
   enemy announces next turn is a puzzle — step back, shut the
   door, drink now or swing now. This mirrors the branches in
   monsterTurn above without touching a thing, so what the icon
   promises is what the monster does.

   Keep the two in step: any new branch up there needs a line
   down here, or the telegraph starts lying. */
export function predictIntent(m) {
  if (!m.awake || m.disguise) return null;
  const p = G.player, L = G.level;
  const dx = p.x - m.x, dy = p.y - m.y;
  const dist2 = dx * dx + dy * dy, dist = Math.sqrt(dist2);

  if (m.staggered > 0) return 'held';
  if (m.snared > 0 && !m.web) return 'held';
  if (m.wind > 0) return 'heavy';
  if (m.casts?.length && !m.cooling && dist2 > 2 && dist <= 9
      && lineClear(L, m.x, m.y, p.x, p.y)) return 'cast';
  if (dist2 <= 2) return m.heavy ? 'wind' : (m.on ? 'hex' : 'melee');
  if (m.ai === 'still') return 'watch';
  if (m.ai === 'ranged' && m.rng
      && dist <= m.rng && dist >= 2.5 && lineClear(L, m.x, m.y, p.x, p.y)) return 'shoot';
  if ((m.ai === 'coward' || m.fleeing) && m.hp < m.maxhp * 0.35) return 'flee';
  if (m.ai === 'erratic') return 'erratic';
  return 'close';
}

/* Recomputed once per player turn rather than per monster act,
   because what the player needs is the state of the board when
   it is their move again. */
function readIntents() {
  for (const m of G.monsters) m.intent = predictIntent(m);
}

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

export const upgradeCostFor = key => {
  const t = targetOf(key);
  if (!t) return null;
  const plus = t.type === 'item' ? (t.item?.plus || 0) : (G.player.spellPlus?.[t.id] || 0);
  return upgradeCost(plus);
};

export function campUpgrade(key) {
  const p = G.player, t = targetOf(key);
  if (!t) return;
  const cost = upgradeCostFor(key);
  if (!canAfford(cost)) { say(`재료가 모자란다 — ${costText(cost)}.`, 'warn'); return; }
  if (t.type === 'item') {
    if (!t.item) return;
    // Enhancement tops out, or twenty-five floors of fires would
    // outscale everything the dungeon can put in front of you.
    if ((t.item.plus || 0) >= MAX_PLUS) {
      say(`${affixName(t.item)}은(는) 더 벼릴 수 없다.`, 'warn');
      return;
    }
    spend(cost);
    t.item.plus = (t.item.plus || 0) + 1;
    recalc(p);
    say(`${affixName(t.item)} — 날이 섰다.`, 'level');
  } else {
    p.spellPlus = p.spellPlus || {};
    if ((p.spellPlus[t.id] || 0) >= MAX_PLUS) {
      say('그 주문은 더 연마할 수 없다.', 'warn');
      return;
    }
    spend(cost);
    p.spellPlus[t.id] = (p.spellPlus[t.id] || 0) + 1;
    const sp = spellList(p).find(s => s.id === t.id);
    say(`${sp?.name || '주문'}을(를) 연마했다.`, 'level');
  }
  fx({ t:'forge', x:p.x, y:p.y });
  spendCamp();
}

export function campEnchant(key, reroll) {
  const p = G.player, t = targetOf(key);
  if (!t) return;
  const cost = reroll ? REROLL_COST : ENCHANT_COST;
  if (!canAfford(cost)) { say(`재료가 모자란다 — ${costText(cost)}.`, 'warn'); return; }
  spend(cost);

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
  // A reroll never inflicts a curse — it is the cure for one,
  // which is what keeps the enchant gamble survivable.
  const cursed = !reroll && Math.random() < 0.20;

  let usePrefix = Math.random() < 0.5;
  if (reroll) {
    const preCursed = !!PREFIXES.find(a => a.id === it.pre)?.curse;
    const sufCursed = !!SUFFIXES.find(a => a.id === it.suf)?.curse;
    if (preCursed !== sufCursed) usePrefix = preCursed;      // burn the curse first
    else if (!it.pre !== !it.suf) usePrefix = !!it.pre;      // otherwise the slot in use
  }
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
  G.campUses = Math.max(0, (G.campUses || 1) - 1);
  if (G.campUses > 0) {
    say(`불씨 항아리 덕에 불이 아직 살아 있다. (${G.campUses}회 남음)`, 'good');
  } else if (L.tiles[idx(p.x, p.y)] === CAMP) {
    L.tiles[idx(p.x, p.y)] = FLOOR;
    L.campSpent = true;
  }
  G.screen = 'play';
  endTurn();
}

/* Walking away without spending it. There was no way out of the
   fire screen at all, which meant arriving at full health with
   no materials forced you to burn the one real decision on the
   floor for nothing. The fire keeps: come back when it is worth
   something. */
export function leaveCamp() {
  G.screen = 'play';
  say('불은 그대로 두고 물러났다.');
}

/* ── the ? room ───────────────────────────────────────────
   events.js holds the offers; this holds every verb they are
   allowed to use. Keeping the API narrow is the point: an event
   can only do things the rules layer already knows how to do, so
   there is no path by which a piece of content invents a rule.

   Also the boundary that keeps events.js free of imports — no
   cycle, and the offers stay readable as plain descriptions. */
function eventApi() {
  const p = G.player;
  const api = {
    p, G, depth: G.depth,
    say, rnd,
    chance: q => Math.random() < q,

    /* state queries the gates use */
    hasRelic,
    hasAffix: key => (gearBonus(p)[key] || 0) > 0,
    canCast: () => spellList(p).length > 0,
    has: cost => canAfford(cost),

    /* costs */
    pay: cost => spend(cost),
    mats: got => {
      p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
      const parts = [];
      for (const k of ['scrap', 'dust', 'essence']) {
        if (!got[k]) continue;
        p.mats[k] += got[k];
        parts.push(`${MATS[k].n} ${got[k]}`);
      }
      if (parts.length) say(`${parts.join(' · ')}을(를) 얻었다.`, 'good');
    },
    gold: n => goldGain(n),

    /* body */
    heal: n => {
      const got = Math.min(p.maxhp - p.hp, n);
      if (got <= 0) { say('이미 멀쩡하다.'); return; }
      p.hp += got; fx({ t:'heal', x:p.x, y:p.y, amt:got });
      say(`체력 +${got}.`, 'good');
    },
    hurt: (n, from) => {
      p.hp -= n; breakCombo(false); tookHit();
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg:n, severe: n >= p.maxhp * 0.18 });
      say(`${n}의 피해.`, 'hit');
      if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n: from || '사건' }); }
    },
    afflict: (kind, turns) => afflict(p, kind, turns),
    xp: n => gainXp(Math.round(n)),

    /* permanent gains — the reason a ? room is remembered */
    perm: (key, v) => {
      p.perm = p.perm || {};
      if (key === 'hitPctMul') p.perm[key] = (p.perm[key] || 1) * v;
      else p.perm[key] = (p.perm[key] || 0) + v;
      recalc(p);
    },
    permHp: n => { p.permHp = (p.permHp || 0) + n; recalc(p); if (n > 0) p.hp += n; },
    tune: (id, v) => { p.tuned = p.tuned || {}; p.tuned[id] = (p.tuned[id] || 0) + v; },
    infamy: v => { p.markup = (p.markup || 0) + v; },

    /* the floor */
    rouse: r => rouse(p.x, p.y, r, 1),
    burnOil: n => { p.lightTurns = Math.max(0, p.lightTurns - n); },
    spawn: (spr, n) => spawnNear(spr, n, false),
    spawnElite: n => spawnNear(null, n, true),
    wakeHalf: () => {
      let n = 0;
      for (const m of G.monsters) if (!m.awake && Math.random() < 0.5) { m.awake = true; n++; }
      return n;
    },
    resetClock: () => { G.floorTurn = 0; G.waves = 0; },
    spendClock: n => { G.floorTurn += n; },
    grantCamps: n => { G.campPromise = n; },
    openCamp: () => { G.campUses = Math.max(1, G.campUses); G.screen = 'camp'; },
    revealChests: better => {
      for (const it of G.items) if (it.kind === 'chest') {
        G.level.seen[idx(it.x, it.y)] = 1;
        if (better) {
          const extra = pickItem(G.depth + 3);
          if (extra) it.loot.push(extra);
          it.gold = Math.round((it.gold || 0) * 1.5);
        }
      }
    },
    /* Modifiers held for the next floor. Applied in enterDepth,
       then cleared, so they cannot leak into floor after floor. */
    nextFloor: mods => { G.nextMods = { ...(G.nextMods || {}), ...mods }; },

    /* things */
    gear: over => {
      const it = pickItem(G.depth + over);
      if (!it) return;
      rollAffixes(it, G.depth + over, true);
      addItem(p, it);
      say(`${nameOf(it)}을(를) 얻었다.`, 'good');
    },
    givePotion: (n, oneBad) => {
      const good = CONSUMABLES.filter(c => c.spr === 'potion' && !['potVenom', 'potMurk'].includes(c.id));
      const bad = CONSUMABLES.filter(c => ['potVenom', 'potMurk'].includes(c.id));
      for (let i = 0; i < n; i++) {
        const pool = (oneBad && i === n - 1) ? bad : good;
        addItem(p, { kind:'use', ...pool[rnd(pool.length)] });
      }
    },
    forge: (n, slot) => {
      const slots = slot ? [slot] : ['weapon', 'body', 'shield'];
      const pick = slots.filter(k => p.equip[k]);
      if (!pick.length) { say('벼릴 것이 없다.', 'warn'); return; }
      const it = p.equip[pick[rnd(pick.length)]];
      it.plus = Math.min(MAX_PLUS, (it.plus || 0) + n);
      recalc(p);
      say(`${affixName(it)} — 벼려졌다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y });
    },
    reroll: () => {
      const it = p.equip.weapon;
      if (!it) { say('무기가 없다.', 'warn'); return; }
      it.pre = pickAffixFor(PREFIXES, it.kind, false)?.id || it.pre;
      it.suf = pickAffixFor(SUFFIXES, it.kind, false)?.id || it.suf;
      recalc(p);
      say(`${affixName(it)} — 다시 벼려졌다.`, 'level');
      fx({ t:'enchant', x:p.x, y:p.y });
    },
    honeSpell: () => {
      const list = spellList(p);
      if (!list.length) { say('연마할 주문이 없다.', 'warn'); return; }
      const sp = list[rnd(list.length)];
      p.spellPlus = p.spellPlus || {};
      p.spellPlus[sp.id] = Math.min(MAX_PLUS, (p.spellPlus[sp.id] || 0) + 1);
      say(`${sp.name} +${p.spellPlus[sp.id]} — 문법이 손에 붙었다.`, 'level');
    },
    identifyAll: () => {
      let n = 0;
      for (const slot of p.pack) if (!isKnown(slot.item.id)) { identify(slot.item.id, true); n++; }
      return n;
    },
    relic: () => { const id = unownedRelic(); if (id) takeRelic(id); },
    dropRelic: id => {
      const i = (p.relics || []).indexOf(id);
      if (i >= 0) p.relics.splice(i, 1);
      recalc(p);
    },
    /* 잊힌 사당: hand one back, pick from two. Routed through the
       swap screen so the same UI serves both cases. */
    tradeRelic: () => {
      const id = unownedRelic();
      if (!id) { say('바꿀 것이 없다.', 'warn'); return; }
      G.pendingRelic = id;
      G.screen = 'relic';
    },
  };
  return api;
}

function spawnNear(spr, n, elite) {
  const L = G.level, p = G.player;
  for (let i = 0; i < n; i++) {
    let spot = null;
    for (let t = 0; t < 40 && !spot; t++) {
      const s = L.randomFloor((x, y) => monsterAt(x, y) || (p.x === x && p.y === y));
      if (!s) break;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < 2 || d > 12) continue;
      spot = s;
    }
    if (!spot) continue;
    let m = spr ? MONSTERS.filter(x => x.spr === spr).sort((a, b) => b.d - a.d)[0] : null;
    m = m ? scaleMonster(m, G.depth) : pickMonster(G.depth);
    Object.assign(m, { x: spot.x, y: spot.y, awake: true, energy: 0 });
    if (elite) makeElite(m, G.depth);
    m.maxhp = m.hp;
    G.monsters.push(m);
  }
}

/* Which offer this floor holds. Rolled on arrival rather than on
   contact so the gate reads your state as it was when you walked
   in — otherwise you could farm an event by re-equipping at the
   doorstep. */
export function rollEvent() {
  const api = eventApi();
  const pool = EVENTS.filter(e => !e.when || e.when(api));
  if (!pool.length) return null;
  const total = pool.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of pool) { if (r < e.w) return e.id; r -= e.w; }
  return pool[0].id;
}

export function eventOffer() {
  const e = EVENTS.find(x => x.id === G.level?.eventId);
  if (!e) return null;
  const api = eventApi();
  return {
    n: e.n, t: e.t,
    opts: e.opts.map((o, i) => ({
      i, n: o.n, t: o.t, can: !o.need || o.need(api),
    })),
  };
}

export function eventChoose(i) {
  const L = G.level;
  const e = EVENTS.find(x => x.id === L?.eventId);
  if (!e) { G.screen = 'play'; return; }
  const opt = e.opts[i];
  const api = eventApi();
  if (!opt || (opt.need && !opt.need(api))) return;

  /* Consumed before the effect runs: an option that opens another
     screen (the relic swap, the fire) must not leave the tile
     behind for a second helping. */
  if (L.tiles[idx(G.player.x, G.player.y)] === EVENT) L.tiles[idx(G.player.x, G.player.y)] = FLOOR;
  L.eventId = null;
  G.screen = 'play';

  opt.run(api);
  if (G.screen === 'play') endTurn();
}

/* ── the altar ────────────────────────────────────────────
   Pure luck, priced in advance. The odds are shown before you
   commit — a gamble you cannot price is not a decision, it is a
   surprise. Blood is cheap while you are healthy and lethal when
   you are not; gold costs nothing if you had nowhere to spend it;
   gear is the offer that actually hurts, and it pays the best. */
export const altarOffers = () => {
  const p = G.player;
  return ALTAR_OFFERS.map(o => ({
    ...o,
    detail: o.id === 'blood' ? `체력 ${p.hp} → ${Math.max(1, Math.ceil(p.hp * 0.6))}`
          : o.id === 'gold'  ? `금화 ${p.gold} → ${Math.floor(p.gold / 2)}`
          : '착용 중인 무기·갑옷·방패 하나가 사라진다',
    can: o.id === 'blood' ? p.hp > 6
       : o.id === 'gold'  ? p.gold >= 60
       : !!(p.equip.weapon || p.equip.body || p.equip.shield),
  }));
};

function altarRoll(odds) {
  const total = odds.reduce((s, [, w]) => s + w, 0);
  let r = rnd(total);
  for (const [name, w] of odds) { if (r < w) return name; r -= w; }
  return odds[odds.length - 1][0];
}

export function altarOffer(id) {
  const p = G.player;
  const offer = ALTAR_OFFERS.find(o => o.id === id);
  if (!offer) return;

  let weight = 1;                       // how much the gods got
  if (id === 'blood') {
    const pay = Math.max(1, Math.floor(p.hp * 0.4));
    p.hp -= pay;
    weight = 1.0;
    say(`제단이 피를 받는다. 체력 -${pay}.`, 'warn');
  } else if (id === 'gold') {
    const pay = Math.floor(p.gold / 2);
    p.gold -= pay;
    weight = clamp(pay / (250 + G.depth * 90), 0.4, 2.0);
    say(`금화 ${pay}닢이 사라진다.`, 'warn');
  } else {
    const slots = ['weapon', 'body', 'shield'].filter(k => p.equip[k]);
    const k = slots[rnd(slots.length)];
    const given = p.equip[k];
    weight = 1.1 + rarityOf(given) * 0.5 + (given.plus || 0) * 0.15;
    p.equip[k] = null;
    recalc(p);
    say(`${affixName(given)}이(가) 재가 되어 흩어진다.`, 'warn');
  }

  const result = altarRoll(offer.odds);
  fx({ t:'altar', result, x:p.x, y:p.y });
  grantBoon(result, weight);

  G.level.tiles[idx(p.x, p.y)] = FLOOR;   // one use, then it is stone
  G.level.altar = null;
  G.screen = 'play';
  if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'제단' }); return; }
  endTurn();
}

function grantBoon(result, weight) {
  const p = G.player, d = G.depth;

  if (result === '재앙') {
    const roll3 = rnd(3);
    if (roll3 === 0) {
      const slots = ['weapon', 'body', 'shield'].filter(k => p.equip[k]);
      if (slots.length) {
        const it = p.equip[slots[rnd(slots.length)]];
        const table = Math.random() < 0.5 ? PREFIXES : SUFFIXES;
        const a = pickAffixFor(table, it.kind, true);
        if (a) { it[table === PREFIXES ? 'pre' : 'suf'] = a.id; recalc(p); }
        say(`${affixName(it)} — 저주가 스며든다.`, 'warn');
      }
    } else if (roll3 === 1) {
      let woke = 0;
      for (const m of G.monsters) if (!m.awake) { m.awake = true; woke++; }
      say(`제단이 비명을 지른다. ${woke}마리가 깨어났다.`, 'warn');
    } else {
      afflict(p, ['poison', 'blind', 'fear'][rnd(3)], 24);
      say('무언가가 몸에 들러붙었다.', 'warn');
    }
    return;
  }

  if (result === '허탕') { say('아무 일도 일어나지 않았다.', ''); return; }

  if (result === '대성공') {
    /* Half of every jackpot is a relic. This is the luck route
       to a run-defining item — the reason to bleed on a stone
       when you already have a good sword. */
    if (Math.random() < 0.5) {
      const id = unownedRelic();
      if (id) { takeRelic(id); return; }
    }
    const pick = rnd(3);
    if (pick === 0) {
      const it = pickItem(d + 8);
      if (it) {
        rollAffixes(it, d + 14, true);
        it.plus = 1 + rnd(2);
        addItem(p, it);
        say(`제단이 ${affixName(it)}을(를) 내놓는다.`, 'level');
      }
    } else if (pick === 1) {
      const k = STATS[rnd(STATS.length)];
      p.stats[k] = Math.min(20, p.stats[k] + 1);
      recalc(p);
      say(`몸이 달라진다 — ${STAT_NAME[k]} +1. 영구적이다.`, 'level');
    } else {
      p.mats.essence += 1 + rnd(2);
      p.mats.dust += 4 + rnd(5);
      p.mats.scrap += 10 + rnd(12);
      say('제단 위에 재료가 수북이 쌓인다.', 'level');
    }
    return;
  }

  // 성공
  const pick = rnd(4);
  if (pick === 0) {
    const heal = Math.ceil(p.maxhp * 0.5);
    const got = Math.min(p.maxhp - p.hp, heal);
    p.hp += got; p.mana = p.maxmana;
    p.ail = {};
    fx({ t:'heal', x:p.x, y:p.y, amt:got });
    say(`상처가 전부 닫힌다. 체력 +${got}.`, 'good');
  } else if (pick === 1) {
    const g = Math.round((160 + d * 70) * weight);
    p.gold += g;
    say(`금화 ${g}닢이 쏟아진다.`, 'good');
  } else if (pick === 2) {
    p.mats.scrap += Math.round((6 + d) * weight);
    p.mats.dust += Math.round((2 + d * 0.3) * weight);
    say('쓸 만한 재료가 남는다.', 'good');
  } else {
    const it = pickItem(d + 4);
    if (it) { rollAffixes(it, d + 6, true); addItem(p, it); say(`${affixName(it)}을(를) 얻었다.`, 'good'); }
  }
}

/* ── shops ──────────────────────────────────────────────── */
export function shopStock(shop) {
  if (shop.stock === 'weapon')
    return WEAPONS.filter(w => w.d <= 12).map(w => ({ kind:'weapon', ...w }));
  if (shop.stock === 'armour')
    return ARMOURS.filter(a => a.d <= 12).map(a => ({ kind:'armour', ...a }));
  const out = shop.stock.map(id => makeConsumable(id));
  /* The wandering merchant also deals in materials, which is what
     turns a purse of gold into a +1 you actually wanted. */
  if (shop.mats)
    for (const k of shop.mats)
      out.push({ kind:'mat', mat:k, id:`mat_${k}`, spr: k === 'essence' ? 'amulet' : k === 'dust' ? 'potion' : 'armor',
                 n: MATS[k].n, cost: MATS[k].cost, desc: MATS[k].note });
  return out;
}

export const priceOf = (item, buying) => {
  const chrB = statBonus(G.player.stats.chr);
  const base = item.cost || 10;
  /* markup is the running total of what ? rooms did to your
     reputation: robbing a drunk raises it, settling a ledger
     lowers it. Selling prices move the other way. */
  const mk = 1 + (G.player.markup || 0);
  return buying
    ? Math.max(1, Math.round(base * (1.25 - chrB * 0.03) * mk))
    : Math.max(1, Math.round(base * (0.42 + chrB * 0.02) / mk));
};

export function buy(item) {
  const p = G.player, cost = priceOf(item, true);
  if (p.gold < cost) { say('금화가 모자란다.', 'warn'); return; }
  p.gold -= cost;
  if (item.kind === 'mat') {
    p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
    p.mats[item.mat]++;
    say(`${item.n}을(를) 샀다. (-${cost})`, 'good');
    return;
  }
  /* A merchant names what he sells. Buying it teaches you the
     appearance for the rest of the run — otherwise the shop was
     a way to launder identification without spending anything. */
  identify(item.id, true);
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

/* Shuffle the appearances for this run. Anything the player
   starts with is already known — you packed it yourself. */
function shuffleAppearances(p) {
  G.looks = {}; G.known = {};
  const pots = [...POTION_LOOKS], scrs = [...SCROLL_LOOKS];
  const take = arr => arr.splice(rnd(arr.length), 1)[0];
  for (const id of UNKNOWABLE) {
    const c = CONSUMABLES.find(x => x.id === id);
    G.looks[id] = c.spr === 'potion' ? `${take(pots)} 물약` : `${take(scrs)} 두루마리`;
  }
  for (const slot of p.pack) G.known[slot.item.id] = true;
}

export const isKnown = id => !id || !UNKNOWABLE.includes(id) || !!G.known[id];
export const lookOf = id => G.looks?.[id] || '알 수 없는 것';

/* What the player is allowed to call it. Every log line has to go
   through here: the inventory was hiding unidentified flasks
   correctly while "치유의 물약을(를) 주웠다" printed the answer in
   the log a line earlier, which made the whole system decorative. */
export const nameOf = it =>
  (it && it.kind === 'use' && !isKnown(it.id)) ? lookOf(it.id) : (it?.n || '무언가');

export function identify(id, quiet) {
  if (!id || G.known[id]) return false;
  G.known[id] = true;
  const c = CONSUMABLES.find(x => x.id === id);
  if (c && !quiet) say(`${lookOf(id)}은(는) ${c.n}이었다.`, 'level');
  return true;
}

export function startGame(raceKey, classKey, base) {
  G.player = createHero(raceKey, classKey, base);
  G.log = []; G.turn = 0; G.running = true; G.ending = null;
  G.fx = []; G.combo = 0; G.comboT = 0; G.bestCombo = 0;
  G.opened = 0; G.mimicsBitten = 0; G.trapsSprung = 0;
  G.branch = null; G.pendingBranch = null; G.pendingRelic = null;
  G.nextMods = null; G.campPromise = 0; G.deepest = 0;
  G.floorTurn = 0; G.waves = 0; G.campUses = 1; G.hazards = [];
  shuffleAppearances(G.player);
  enterDepth(0);
  say('마을. 여섯 개의 문이 열려 있고, 광장 한가운데에 계단이 있다.', 'warn');
  G.screen = 'play';
}
