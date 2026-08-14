/* ═══════════════════════════════════════════════════════════
   game.js — state and rules. No rendering happens here.
   ═══════════════════════════════════════════════════════════ */

import {
  MAX_DEPTH, MAX_LEVEL, STATS, STAT_NAME, RACES, CLASSES, SPELLS, MONSTERS, BOSS, mimicFor,
  WEAPONS, ARMOURS, CONSUMABLES, SHOPS, AILMENTS, IMMUNE, TRAPS,
  PREFIXES, SUFFIXES, SPELL_AFFIXES, ELITES, affixName,
  MATS, salvageYield, worthOf, upgradeCost, ENCHANT_COST, REROLL_COST,
  ENGRAVINGS, engraveById, engraveSlots, isMilestone, ENGRAVE_PENALTY,
  CATALYSTS, catalystById, makeCatalyst,
  upgradeOdds, upgradeRisk, UPGRADE_CRIT, CAREFUL_MULT, CAREFUL_BONUS,
  UPGRADE_SURGE, UPGRADE_SURGE_FROM, UPGRADE_HEX_FROM, UPGRADE_HEX_PCT,
  ENCHANT_CURSE, ENCHANT_CURSE_STEP, ENCHANT_TWIN,
  BOONS, boonById, transChance,
  FUSIONS, fusionOf, FUSE_ODDS, FUSE_COST,
  ALTAR_OFFERS, rarityOf, isCursed, RARITY, TEMPLE_SHARE, JACKPOT,
  POTION_LOOKS, SCROLL_LOOKS, UNKNOWABLE,
  RELICS, RELIC_SLOTS, relicSlots, relicById, BRANCHES,
  FLOOR_BUDGET, WAVE_EVERY, WAVE_GROWTH, REGIONS, regionOf,
  MEMORIES, memoryEarned, SHACKLES, shacklesAt, SHACKLE_STAT, tellsNeeded,
  WEAPON_TYPES, PATTERNS, NAMED,
  FITS, fitsOf, fitRule, UNDEAD,
  UNIQUES, uniqueById, UNIQUE_ODDS, ODDITIES, oddityById, oddityOf, ODDITY_ODDS,
  RESONANCE, resonanceById, CHAIN_ECHO, CHAIN_DECAY, CHAIN_MAX,
  CHAIN_KEEP, CHAIN_KEEP_RESO, POWDER_MAX, POWDER_BUDGET, BRAMBLE_BITE,
  ECHO_ROOM_HOPS, ECHO_ROOM_TOLL, ECHO_ROOM_KEEP,
  ROLL_COST, ROLL_DIST, staminaMax, STAM_REGEN_EVERY,
  ARTS, SHOVE_DIST, SHOVE_WALL, CLEAVE_SHARE,
  SHADOW_MAX, SHADOW_TICK, FAN_RANGE, FAN_ARC, FAN_SHARE, VANISH_HUSH, VITALS_MULT,
  ECHOES, ECHO_TURNS, ECHO_POWER, ECHO_SPLASH,
  FLURRY_MAX, FLURRY_STEP, FLURRY_STAM, MARK_STEP, MARK_MAX,
  AIMED_GAIN, PIERCE_KEEP, SNARE_TURNS, VOLLEY_SHARE, SMOKE_RADIUS, SMOKE_TURNS,
  QUIVERS, quiverById, BOW_MELEE, BOW_FALLOFF, GEAR_SLOTS,
  FORCE_STAM, FORCE_HURT, FORCE_NOISE, PICK_USES, CHEST_RUIN, RANGER_FOOTING,
  FAITH_MAX, FAITH_PER_HURT, FAITH_PER_UNDEAD, SANCTUM_TURNS, SANCTUM_CUT,
  ANATHEMA_MORE, JUDGE_HURT, MARTYR_TURNS, FAITH_HARD_HIT, FAITH_PER_HARD,
  QUARRY_RANGE, QUARRY_STAM, QUARRY_HEAL,
  FINISH_MAX,
  OATH_MAX, OATH_PER_HIT, OATH_PER_KILL, CHARGE_DIST, CHARGE_SLAM,
  JUDGE_STRIKE, STORM_SHARE, CRUSADE_MAX,
  BANK_STEP, BANK_MAX, bankPurse, THIEF, thiefChance, thiefPurse,
  xpToLevel, statBonus, BANDS, CLASS_BAND, statRange, josa,
  strikeLine, takenLine, pickLine, MISS_BY, MISS_AT, FELLED,
} from './data.js';
import {
  Level, computeFov, lineClear, idx, rnd, roll, clamp, MW, MH,
  FLOOR, DOWN, UP, DOOR, RUBBLE, DOOR_OPEN, DOOR_LOCKED, DOOR_BROKEN,
  WEB, WATER, CAMP, ALTAR, EVENT, ANVIL, PROP, propAt, isDoor, isShut, walkable,
} from './world.js';
import { EVENTS } from './events.js';
import * as Meta from './meta.js';

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
  bank: 0,               // floors descended without sitting at a fire
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
  const r = relicById(id);
  const first = Meta.see('relics', id);
  say(`${r.n} — ${r.t}`, 'level');
  /* 유물은 규칙을 바꾸는 물건인데, 처음 보는 것일 때만 카드가 떴다.
     두 번째로 든 「굶주린 칼날」도 그 판에서는 처음이고, 무엇을
     들었는지 읽지 않고 지나가면 판이 어떻게 달라졌는지 모른 채로
     계속 걷게 된다. 이제 언제나 멈춘다 — 판에 예닐곱 번뿐인 일이다. */
  lore(first ? '처음 든 유물' : '유물', r.n, r.t, r.spr);
  /* 그리고 다른 득템과 같은 자로 연출한다. 여태 유물만 제단 반짝임을
     빌려 쓰고 있었다 — 이 게임에서 가장 큰 획득이 가장 다른 소리를
     냈다는 뜻이다. */
  fx({ t:'found', x:p.x, y:p.y, rar:3 });
  fx({ t:'altar', x:p.x, y:p.y, good:true });
  G.rareFound = (G.rareFound || 0) + 1;
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

/* One funnel, so a particle can never be wrong on one line and
   right on the next. Every sentence in the game passes through
   here, which is why the resolver lives here rather than at the
   call sites. */
/* Which variant of a line to reach for. Purely cosmetic, so it
   lives outside the save — but it has to move on every sentence
   rather than on every turn, or two blows in the same turn come
   out word for word identical, which is the thing being fixed. */
let proseTick = 0;
export const nextLine = () => ++proseTick;

export function say(text, tone = '') {
  /* Stamped with when and where, so the scroll can set the record
     as paragraphs under floor headings instead of as one endless
     column. The strip ignores both. */
  G.log.push({ text: josa(text), tone, turn: G.turn || 0, depth: G.depth || 0 });
  if (G.log.length > 220) G.log.shift();
}

/* A page worth reading, handed to the presentation layer the same
   way every other effect is. The rules never decide what it looks
   like — they decide that this is the first time. */
function lore(kind, name, text, spr) {
  if (!text) return;
  fx({ t:'lore', kind, name, text, spr });
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
/* Rolled inside the class's bands rather than from 4d6, so the
   spread between two heroes of the same class is a few points
   and not a landslide. `cls` may be omitted early in a session,
   in which case everything lands in the middle band. */
export function rollStats(classKey) {
  const bands = CLASS_BAND[classKey] || null;
  const s = {};
  for (const k of STATS) {
    const [lo, hi] = BANDS[bands ? bands[k] : 'fair'];
    s[k] = lo + rnd(hi - lo + 1);
  }
  return s;
}

export function createHero(raceKey, classKey, base) {
  const race = RACES[raceKey], cls = CLASSES[classKey];
  /* The class modifier is gone: the roll bands already encode
     what a class is, and adding the old modifier on top counted
     it twice — a 전사 came out at 힘 20 and 지혜 3 every time.
     The race modifier stays, because that is the only thing left
     that separates a 드워프 전사 from an 엘프 전사. */
  const stats = {};
  for (const k of STATS)
    stats[k] = clamp(base[k] + (race.mod[k] || 0), 3, 20);

  const p = {
    race: raceKey, cls: classKey, stats,
    lv: 1, xp: 0,
    hp: 0, maxhp: 0, mana: 0, maxmana: 0,
    gold: 250,
    lightTurns: 700, wound: 0,
    blessed: 0,
    ail: {},          // ailment -> turns remaining
    stuck: 0,         // turns still caught in a web
    keys: 0,
    mats: { scrap: 0, dust: 0, essence: 0 },
    might: 0, iron: 0,
    spellPlus: {}, spellAffix: {},
    relics: [], boneHp: 0, seedAc: 0, grudge: 0,
    stam: 0, maxStam: 0, iframe: 0,
    shadow: 0,        // 도적의 탄약. Everyone carries the field; only a rogue fills it.
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
  /* The ranger is the class whose whole idea is distance, so it
     starts holding the thing that makes distance possible rather
     than hoping the weapon shop has one. Everyone else can buy a
     bow; the ranger *is* one. */
  if (classKey === 'ranger') {
    p.equip.weapon = { kind:'weapon', ...WEAPONS.find(w => w.n === '짧은 활') };
    p.equip.quiver = makeQuiver('deer');
    /* And two ways out. The class dies with something in its face
       more than any other, and until this patch it had no verb
       for that at all. */
    addItem(p, makeConsumable('smoke'), 2);
    /* And the knife stays on the belt. Handing the ranger a bow
       *instead of* a weapon left it as the only class in the game
       with nothing to swing when something closed — a bow up
       close is half a blow, and an empty quiver is a stick. It
       measured 5.3 floors that way and 6.1 with the knife. */
    addItem(p, { kind:'weapon', ...WEAPONS[0] }, 1);
  }
  return p;
}

/* 한 방에 최대 체력의 이만큼을 잃으면 상처가 남는다. 스치는 것마다
   상처가 되면 그것은 상처가 아니라 그냥 피해다. */
export const WOUND_AT = 0.10;
/* 한 방이 지금 당장 가져갈 수 있는 최대치. 넘은 몫은 사라지지
   않고 상처로 옮겨 간다 — 총량은 같고, 오는 속도만 달라진다. */
export const BLOW_CAP = 0.32;
export const WOUND_SHARE = 0.50;      // 그 피해의 몇 할이 천장에서 깎이는가
export const WOUND_CAP = 0.45;        // 천장은 절반 아래로는 안 내려간다

export function recalc(p, init) {
  const race = RACES[p.race], cls = CLASSES[p.cls];
  const conB = statB(p, 'con');
  /* Growth in steps, not a trickle. The totals at level 30 are
     what they always were; the delivery is not. Nine health a
     level is a number nobody notices — the same health arriving
     as +6 on ordinary levels and +14 on every third one is a
     thing you feel, and a thing worth levelling *for*.

     Every stat the player watches is on this pattern now: health
     every three levels, mana every two. */
  const step3 = Math.floor(p.lv / 3);
  p.maxhp = Math.max(8, Math.floor(
      (15 + cls.hd + race.hp)
    + (p.lv - 1) * (cls.hd * 0.42 + 1.5)      // the trickle, cut by 40%
    + step3 * (cls.hd * 0.88 + 3.6)           // …and paid back in lumps
    + conB * p.lv * 1.05));
  if (cls.realm) {
    const key = cls.realm === 'arcane' ? 'int' : 'wis';
    const b = statBonus(p.stats[key]);
    // Mana moves on the odd levels only, twice as far each time.
    /* 1.7 made the pool a number that goes up rather than a
       resource: a level-15 mage could cast 마력 화살 61 times in a
       row, and the pool sat at 97% of maximum across a run. At 1.2
       the caster runs dry about one casting opportunity in
       twenty-five and the reach barely moves. */
    /* 1.7, restored. It was cut to 1.2 on a measurement that does
       not hold: "in forty runs the caster never stood in front of
       something it could not afford" was true, but it was counted
       against 마력 화살, which costs one at every level — the pool
       has never gated *that* spell and never will. What the pool
       actually gates is 서리 폭발 and 중상 치유, and the probe never
       asked about those.
       Re-measured on a bot that reaches floor eight rather than
       floor three: the cut cost the mage a full floor (7.8 → 6.8)
       and three levels, with the dry-turn count still zero at both
       settings. A change that buys nothing measurable and costs a
       floor is a change that was measuring its own instrument. */
    p.maxmana = Math.max(0, Math.floor((b + 1) * Math.ceil(p.lv / 2) * 1.7));
  } else p.maxmana = 0;
  const g = gearBonus(p);
  p.maxhp = Math.max(8, Math.round(p.maxhp * (1 + g.maxhpPct)) + (p.boneHp || 0) + (p.permHp || 0));
  /* ── 상처 ────────────────────────────────────────────────
     체력은 차오르지만 차오를 수 있는 높이가 낮아진다. 재 보니 판의
     60%를 체력 90~100%에서 보내고 30% 아래는 0%였다 — 몸이 안 닳으니
     물약을 아낄 이유도, 물러설 이유도 없었다. 톱니를 내려가는 선으로
     바꾸는 것이 이 한 줄이다.

     천장은 여기 한 곳에서만 깎인다. 다른 데서 maxhp를 건드리면
     recalc이 다음 호출에 되돌려 놓으므로, 상처는 반드시 여기를 지난다. */
  p.wound = Math.max(0, Math.min(p.wound || 0, Math.round(p.maxhp * WOUND_CAP)));
  p.maxhp = Math.max(8, p.maxhp - p.wound);
  if (p.hp > p.maxhp) p.hp = p.maxhp;
  // 재의 무게, applied last so it takes a slice of the finished
  // number rather than of the base one.
  if (hasShackle('ash')) p.maxhp = Math.max(8, Math.round(p.maxhp * 0.85));
  p.maxmana = Math.max(0, Math.round(p.maxmana * (1 + g.manaPct)) + g.manaFlat);
  p.maxStam = staminaMax(p);
  if (init) return;
  p.hp = Math.min(p.hp, p.maxhp);
  p.mana = Math.min(p.mana, p.maxmana);
  p.stam = Math.min(p.stam ?? p.maxStam, p.maxStam);
  /* Twenty-four call sites end up here — every equip, forge,
     engrave, relic and altar. One hook rather than twenty-four. */
  checkResonance(p);
}

/* ── effective ability scores ─────────────────────────────
   `p.stats` is what the dice said and never changes. What the
   game *reads* is this, so a relic can bend an ability score
   without anything downstream needing to know that relics exist
   — the same trick gearBonus plays for damage.

   Every read of an ability goes through statB(). There is no
   second path, which is the only reason a relic that rewrites
   a score can be trusted. */
export function effStats(p) {
  if (!p) return { str:10, int:10, wis:10, dex:10, con:10, chr:10 };
  const s = { ...p.stats };
  const held = p.relics || [];

  // 균형추: the low end comes up to meet the high end. The whole
  // point of the stat spread, bought with a quarter of your life.
  if (held.includes('ballast')) {
    const hi = Math.max(...STATS.map(k => s[k]));
    for (const k of STATS) s[k] = hi;
  }
  if (held.includes('grip'))   { s.str = Math.max(s.str, 20); s.dex = Math.min(s.dex, 6); }
  if (held.includes('specs'))  { const hi = Math.max(s.int, s.wis); s.int = hi; s.wis = hi; }
  if (held.includes('acro'))   { s.dex += 6; s.str -= 4; }
  if (held.includes('bull'))   { s.con += 6; s.chr -= 6; }
  if (held.includes('mask'))   { s.chr = Math.max(s.chr, 18); for (const k of STATS) if (k !== 'chr') s[k] -= 1; }

  for (const k of STATS) s[k] = clamp(s[k], 1, 26);
  return s;
}

/* The one reader. `statB(p, 'str')` replaced every
   `statB(p, 'str')` in the file. */
export const statB = (p, k) => statBonus(effStats(p)[k]);

/* ── gear resolution ──────────────────────────────────────
   Every derived number the player has runs through here, so an
   affix only ever has to be declared once in data.js. Cheap
   enough to recompute per swing: three slots, two affixes each. */
const EMPTY_BONUS = {
  dmg:0, dmgPct:0, hit:0, hitPct:1, crit:0, critMult:0, ac:0, stealth:0,
  lifesteal:0, chain:0, burst:0, execute:0, pierce:0,
  regen:0, lightR:0, maxhpPct:0, manaPct:0, manaFlat:0, spellPow:0,
  on:null, resistAll:false, noStealth:false,
  // engraving-only rules — see ENGRAVINGS in data.js
  firstStrike:0, vsElite:0, flatDR:0, reflect:0, dawn:0, ailShrug:0, anchor:false,
};

export function gearBonus(p) {
  const b = { ...EMPTY_BONUS };
  if (!p) return b;
  for (const slot of GEAR_SLOTS) {
    const it = p.equip[slot];
    if (!it) continue;

    // Enhancement is flat and boring on purpose — it is the safe
    // pick at the fire, the one you take when a gamble would end you.
    if (it.plus) {
      if (it.kind === 'weapon') { b.dmg += it.plus * 2; b.hit += it.plus * 1.5; }
      else b.ac += it.plus * 2;
    }
    if (it.kind === 'armour') b.ac += it.ac || 0;
    /* A rod is not swung, it is held. Its two numbers go straight
       into the pool and the book rather than into the blow. */
    b.manaFlat += it.manaFlat || 0;
    b.spellPow += it.spellPow || 0;

    for (const a of [
      it.pre && PREFIXES.find(x => x.id === it.pre),
      it.suf && SUFFIXES.find(x => x.id === it.suf),
      // Engravings ride the same funnel, so a rule declared once
      // in data.js is true everywhere without a second code path.
      ...(it.engrave || []).map(engraveById),
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
      b.firstStrike += a.firstStrike || 0;
      b.vsElite   += a.vsElite || 0;
      b.flatDR    += a.flatDR || 0;
      b.reflect   += a.reflect || 0;
      b.dawn      += a.dawn || 0;
      b.ailShrug  += a.ailShrug || 0;
      if (a.anchor) b.anchor = true;
      if (a.on) b.on = a.on;
      if (a.resist === 'all') b.resistAll = true;
    }

    /* What these particular hands do with this particular thing.
       Folded in here rather than anywhere else because gearBonus
       is the one place every derived number already passes
       through — a fit that lived outside it would be right in the
       item card and wrong in the swing. */
    for (const f of fitsOf(p, it)) {
      const m = f.mod;
      if (m) {
        b.dmg += m.dmg || 0;  b.dmgPct += m.dmgPct || 0;
        b.hit += m.hit || 0;  b.ac += m.ac || 0;
        b.crit += m.crit || 0;  b.stealth += m.stealth || 0;
        b.maxhpPct += m.maxhpPct || 0;  b.manaPct += m.manaPct || 0;
        b.regen += m.regen || 0;  b.lifesteal += m.lifesteal || 0;
      }
      if (f.rule === 'noStealth') b.noStealth = true;
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
      case 'everflame': b.maxhpPct -= 0.20; break;
      case 'moth':     b.maxhpPct -= 0.10; break;
      case 'knot':     b.stealth -= 0.5; break;
      case 'seed':     b.maxhpPct -= 0.15; b.ac += p.seedAc || 0; break;
      case 'grudge':   b.dmgPct += Math.min(0.60, (p.grudge || 0) * 0.04); break;
      // The stat relics pay for themselves in health, not in
      // a second stat — see effStats() for what they actually do.
      case 'specs':    b.maxhpPct -= 0.20; break;
      case 'ballast':  b.maxhpPct -= 0.25; break;

      /* Fused. Each one is its two halves with the downside
         deepened and the upside paid out — a fused relic is not
         a better relic, it is a more extreme one. */
      case 'martyr':   b.maxhpPct -= 0.40; b.crit += 0.25; b.critMult += 1.2; b.hitPct *= 0.90; break;
      case 'paradox':  b.dmgPct += 0.20; break;
      case 'oracle':   b.manaFlat -= 6; b.lightR -= 2; break;
    }
  }
  return b;
}

export const armourClass = p =>
  gearBonus(p).ac
  + statB(p, 'dex') + Math.floor(p.lv / 4)
  + (p.blessed > 0 ? 4 : 0) + (p.iron > 0 ? 10 : 0)
  + (p.cls === 'paladin' ? Math.floor((p.oath || 0) / 2) : 0);   // 맹세

/* 힘의 아래쪽. Heavy gear asks for a number, and a hero who does
   not have it swings badly rather than being refused — a refusal
   is a rule you fight, a penalty is a trade you make. Two-handers
   and plate are the only things that ask. */
export function strainOf(p) {
  let need = 0;
  const w = p.equip.weapon, b = p.equip.body;
  if (w?.hands === 2) need = Math.max(need, 15);
  else if (w && (w.dice?.[1] || 0) >= 8) need = Math.max(need, 12);
  if (b && (b.ac || 0) >= 16) need = Math.max(need, 15);
  else if (b && (b.ac || 0) >= 12) need = Math.max(need, 12);
  const have = effStats(p).str;
  return need && have < need ? { need, have, short: need - have } : null;
}

export const toHit = p => {
  const strain = strainOf(p);
  const base = CLASSES[p.cls].bth * p.lv / 3 + statB(p, 'dex') * 2
    + statB(p, 'str') + (p.blessed > 0 ? 5 : 0) + gearBonus(p).hit
    - (strain ? strain.short * 3 : 0);
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
  const g = gearBonus(p);
  // 닻의 각인 refuses the two that take the turn away from you.
  if (g.anchor && (kind === 'paralyze' || kind === 'slow')) {
    say(`${AILMENTS[kind].n}이(가) 미끄러진다.`, 'good');
    fx({ t:'resist', x:p.x, y:p.y });
    return;
  }
  if (g.ailShrug) turns = Math.max(1, Math.round(turns * (1 - g.ailShrug)));
  /* 지혜 is what shrugs a curse off. High wisdom shortens every
     ailment; low wisdom lengthens them, which is the reason a
     wizard with dumped wisdom feels different from one without. */
  turns = Math.max(1, Math.round(turns * clamp(1 - statB(p, 'wis') * 0.09, 0.35, 1.9)));
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
  0.04 + statB(p, 'dex') * 0.022 + p.lv * 0.004
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
export const stealth = p =>
  /* 소리 없는 강철: too heavy to make a sound. Standing still in
     the wrong armour is the only way anyone has ever been
     invisible in this game. */
  (oddAwake('quietsteel') && G.player?.stillFor > 0) ? 0.95
  : (gearBonus(p).noStealth ? 0 : clamp(
  0.10 + statB(p, 'dex') * 0.05
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

/* 연격은 기량의 표시가 아니라 상태의 표시다. 문장이 위로 갈수록
   기뻐지면 이 게임이 아니다 — 손이 풀리는 것이 아니라 손이 굳는다. */
const COMBO_TIERS = [
  [5,  '연격 5 — 손이 젖었다.'],
  [10, '연격 10 — 팔이 저 혼자 움직인다.'],
  [15, '연격 15 — 바닥이 미끄럽다. 네 것인지 아닌지는 모른다.'],
  [20, '연격 20 — 이제 아무것도 다가오지 않는다. 그것이 더 나쁘다.'],
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
/* 신앙. It fills where a mage's pool empties — one point per blow
   landed on you, and two for every undead put back down. There is
   no way to build it standing safely in a corridor, which is the
   whole design: the priest's buttons light up during the fight it
   is losing, not before it starts. */
/* One funnel for 맹세, so being hit, killing and the storm's
   refund can never disagree about the ceiling. */
export function oathGain(n) {
  const p = G.player;
  if (p?.cls !== 'paladin') return;
  p.oath = Math.min(OATH_MAX, (p.oath || 0) + n);
}

/* ── 잔향 ─────────────────────────────────────────────────
   The mage's axis. One place it is written, one place it is read,
   one place it is spent. It lives on the player rather than on G
   because it is the caster's, not the floor's. */
export function liveEcho(p = G.player) {
  if (!p || p.cls !== 'mage' || !p.echo) return null;
  if (G.turn > p.echo.until) return null;
  const spec = ECHOES[p.echo.from];
  return spec ? { ...spec, from: p.echo.from } : null;
}
function leaveEcho(p, spellId) {
  if (p.cls !== 'mage' || !ECHOES[spellId]) return;
  p.echo = { from: spellId, until: G.turn + ECHO_TURNS };
  fx({ t:'echoLeft', x:p.x, y:p.y, id: ECHOES[spellId].id });
}
function takeEcho(p) {
  const e = liveEcho(p);
  if (e) { p.echo = null; say(`잔향 — ${e.n}. ${e.t}.`, 'level'); }
  return e;
}

/* ── 그림자 ───────────────────────────────────────────────
   The rogue's ammunition, in the same shape 신앙 and 맹세 use: one
   funnel in, and only useArt out. */
export function gainShadow(n = 1, why = '') {
  const p = G.player;
  if (!p || p.cls !== 'rogue' || !(n > 0)) return 0;
  const was = p.shadow || 0;
  p.shadow = Math.min(SHADOW_MAX, was + n);
  const got = p.shadow - was;
  if (got) {
    fx({ t:'shadowGain', x:p.x, y:p.y, at:p.shadow, why });
    if (p.shadow === SHADOW_MAX && was < SHADOW_MAX) say('그림자가 가득 찼다.', 'good');
  }
  return got;
}
/* Is anything awake looking at you right now? The quiet tick is
   paid for standing outside every awake thing's line — the same
   test the monsters themselves run. */
function unseenByAll() {
  const p = G.player, L = G.level;
  if (!L) return false;
  return !G.monsters.some(m =>
    m.awake && !m.disguise
    && Math.hypot(m.x - p.x, m.y - p.y) <= 9
    && lineClear(L, m.x, m.y, p.x, p.y));
}

/* ── 표적 (레인저) ────────────────────────────────────────
   One funnel, called by every landed blow whichever hand threw
   it. It used to be two inline fragments inside swing(): the
   stack counter in one branch and the multiplier eighty lines
   below. loose() — the arrow path, which is the entire class —
   touched neither, so a level-12 ranger shooting a single target
   held 표적 0.00 out of 5 for the whole fight and the 45% the
   tooltip promises did not exist. */
function markTarget(m) {
  const p = G.player;
  if (p.cls !== 'ranger') return;
  p.markN = p.markOn === m ? Math.min(MARK_MAX, (p.markN || 0) + 1) : 0;
  p.markOn = m;
}
const markMult = () => {
  const p = G.player;
  return (p?.cls === 'ranger' && p.markN) ? 1 + p.markN * MARK_STEP : 1;
};

export function faithGain(n) {
  const p = G.player;
  if (p?.cls !== 'priest') return;
  const was = p.faith || 0;
  p.faith = Math.min(FAITH_MAX, was + n);
  if (was < FAITH_MAX && p.faith === FAITH_MAX) say('신앙이 가득 찼다.', 'level');
}

/* One funnel for every blow that lands on the player, so the two
   paths that hit a hero — a body in reach and something loosed
   across the room — cannot drift apart the way 버티기 did. A hard
   blow is worth two: at a flat one per hit the bar filled about
   as fast as 성역 and 파문 emptied it, and 순교 at nine never came
   up once in twelve measured runs. */
function faithForBlow(dmg) {
  const p = G.player;
  faithGain(dmg >= (p.maxhp || 1) * FAITH_HARD_HIT ? FAITH_PER_HARD : FAITH_PER_HURT);
}

/* 사냥꾼의 몫 (레인저). The class lost its spell list this patch,
   which was the right call — it was casting the mage's book two
   points of intelligence short — but the list was quietly the
   only sustain the ranger had, and four more ways to deal damage
   did not replace it. It measured 8.2 floors with the book and
   5.7 without.
   So the breath comes back, and only to the hand that earns it:
   a kill made at arm's length pays nothing. That keeps the answer
   inside the class's own instruction — keep the gap — instead of
   handing back a worse mage. */
function quarry(m) {
  const p = G.player;
  if (p.cls !== 'ranger') return;
  if (Math.hypot(m.x - p.x, m.y - p.y) < QUARRY_RANGE) return;
  const heal = Math.max(1, Math.round(p.maxhp * QUARRY_HEAL));
  const before = p.hp, beforeStam = p.stam;
  p.hp = Math.min(p.maxhp, p.hp + heal);
  p.stam = Math.min(p.maxStam, p.stam + QUARRY_STAM);
  if (p.hp > before || p.stam > beforeStam)
    fx({ t:'quarry', x:p.x, y:p.y, hp: p.hp - before });
}

/* ── 피가 깎이는 단 한 자리 ──────────────────────────────
   여섯 군데가 저마다 `p.hp -= dmg`를 하고 저마다 tookHit을 불렀다.
   그중 넷은 인자 없이 불러서 화살도, 장판도, ? 방의 피해도 상처를
   남기지 않았다 — 「큰 한 방은 상처가 된다」가 근접 공격에만
   조용히 참이었던 셈이다.

   이제 피는 여기서만 깎인다. 상한도, 상처도, 숨 잠금도 한 자리에
   있으므로 새 피해원이 생겨도 규칙을 다시 적을 일이 없다.
   돌려주는 값은 「실제로 깎인 만큼」이라, 부르는 쪽은 그것을 그대로
   로그와 이펙트에 쓰면 된다 — 50을 맞았다고 적어 놓고 32만 깎는
   것은 연출이 아니라 거짓말이다.

   ── 절벽을 비탈로 ──
   죽기 10턴 전 체력 70%, 5턴 전 68%, 그리고 죽음. 이 판의 죽음은
   말라 죽는 것이 아니라 다섯 턴짜리 절벽이었고, 그래서 판의
   대부분을 멀쩡한 몸으로 걷게 된다 — 멀쩡하면 결정이 없다.

   한 방이 최대 체력의 BLOW_CAP을 넘으면 넘은 몫은 지금 깎이지
   않는다. 대신 그만큼이 통째로 상처가 된다. 빼앗기는 총량은 같다.
   달라지는 것은 그 총량이 한 턴에 오느냐 남은 판 내내 따라오느냐고,
   그 차이가 절벽과 비탈의 차이다. */
export function hurtPlayer(dmg, opt = {}) {
  const p = G.player;
  if (!p) return 0;
  let taken = Math.max(1, Math.round(dmg));
  let over = 0;
  const cap = Math.max(1, Math.round(p.maxhp * BLOW_CAP));
  if (taken > cap) { over = taken - cap; taken = cap; }
  p.hp -= taken;
  if (opt.combo !== false) breakCombo(false);
  tookHit(taken, over);
  return taken;
}

function tookHit(dmg = 0, over = 0) {
  const p = G.player;
  /* You cannot catch your breath while something is hitting you.
     Stamped here rather than at the two damage sites so an arrow
     counts the same as an axe. */
  p.hurtAt = G.turn;
  /* 상처도 같은 자리에서 남는다. 큰 한 방만 천장을 깎는다 —
     스치는 것마다 상처가 되면 그것은 상처가 아니라 그냥 피해다.
     천장은 recalc이 다시 세우므로 여기서는 값만 얹는다. */
  if (over > 0 || dmg >= p.maxhp * WOUND_AT) {
    const w = Math.max(1, Math.round(dmg * WOUND_SHARE) + over);
    p.wound = (p.wound || 0) + w;
    recalc(p);
    say(`상처가 남았다. 견딜 수 있는 몸이 ${w}만큼 줄었다.`, 'hit');
    fx({ t:'ail', x:p.x, y:p.y, kind:'wound' });
  }
  if (hasRelic('grudge')) p.grudge = Math.min(15, (p.grudge || 0) + 1);
  /* 맹세 (팔라딘). Every blow taken hardens him a little more.
     Sits here rather than in the two damage sites so it counts
     an arrow the same as an axe. */
  // 맹세의 방패: a paladin behind a shield swears twice as fast,
  // which is the whole reason to give up the second weapon.
  if (p.cls === 'paladin') oathGain(OATH_PER_HIT * (fitRule(p, 'twiceSworn') ? 2 : 1));
}

/* How long after a blow before the body starts closing again,
   and how far it will go on its own. 체질 buys both — a dumped
   constitution now means bad fights stay with you. */
export const BREATH = 10;
/* Measured at 0.50: floors five and six went from 13% of runs to
   24%, and the share reaching floor 11 fell six points. The
   lockout is the interesting half of this change — you cannot
   breathe while something is hitting you — so that stays at ten
   turns and the ceiling gives a little back instead. */
/* And then it stopped being enough. Measured over 24 runs: 57% of
   turns sat at 90–100% health and not one turn fell below 30%,
   because a ceiling of 46–82% refilled for free every ten quiet
   turns and 87% of turns are quiet. Wounds alone could not bend
   that line — they lower the bar the percentage is taken of, so
   the *shape* stayed flat.

   So the ceiling itself falls. Two terms, both of them things the
   player did: how torn up the body already is, and how far down it
   was carried. Deep and whole still breathes back to most of the
   bar; deep and half-ruined does not breathe back at all. */
/* 0.9로 재니 봇의 평균 도달 층이 6.7 → 4.1로 내려앉았다. 원했던
   방향이지만 한 번에 두 층 반은 조정이 아니라 사고다. */
export const BREATH_WEAR = 0.7;    // 상처가 천장을 끌어내리는 비율
export const BREATH_DEEP = 0.012;  // 4층 아래로 한 층마다
export const breathRoof = p => {
  const base = clamp(0.56 + statB(p, 'con') * 0.055, 0.46, 0.82);
  const worn = (p.wound || 0) / Math.max(1, p.maxhp + (p.wound || 0));
  const deep = Math.max(0, (G.depth || 0) - 4) * BREATH_DEEP;
  return clamp(base - worn * BREATH_WEAR - deep, 0.18, 0.82);
};

/* Lit once, and it stays lit: a resonance is a turning point, not
   a buff with an uptime. Checked after recalc because that is the
   one place gearBonus is known to be current — swapping a weapon,
   forging a plus, taking a relic and cutting an engraving all end
   up here. */
export function checkResonance(p) {
  if (!p) return;
  p.reso = p.reso || {};
  const g = gearBonus(p);
  for (const r of RESONANCE) {
    if (p.reso[r.id] || !r.need(g, p)) continue;
    p.reso[r.id] = true;
    G.resoFound = (G.resoFound || 0) + 1;
    Meta.see('reso', r.id);
    say(`공명 — ${r.n}. ${r.say}`, 'level');
    lore('공명', r.n, `${r.t}\n${r.say}`, r.spr);
    fx({ t:'transcend', x:p.x, y:p.y, word:'공명' });
  }
}
export const hasResonance = id => !!G.player?.reso?.[id];

/* How many of a resonance's pieces are in hand, for the screen
   that shows what is missing. A lottery nobody can see the
   tickets of is not a hunt, it is a surprise. */
export function resonanceState(id) {
  const r = resonanceById(id);
  if (!r) return null;
  const p = G.player;
  return { id, lit: !!p?.reso?.[id], can: p ? r.need(gearBonus(p), p) : false };
}

function breakCombo(hard) {
  if (!G.combo) return;
  // 전쟁 북: a hit costs a quarter of the chain rather than half.
  if (hasRelic('march') && !hard) return;
  const left = hard ? 0 : (hasRelic('drum') ? Math.round(G.combo * 0.75) : G.combo >> 1);
  if (left < G.combo) fx({ t:'comboDrop', from: G.combo, to: left });
  G.combo = left;
  if (!G.combo) G.comboT = 0;
}

/* ── class traits ─────────────────────────────────────────
   One counter per class, all of them living on the player and
   all of them read in exactly one place. The HUD prints this,
   so a player can watch the thing fill and time it. */
export function traitState() {
  const p = G.player;
  if (!p) return null;
  const spec = CLASSES[p.cls].trait;
  if (!spec) return null;
  switch (p.cls) {
    case 'warrior': return { ...spec, at: p.chain3 || 0, ready: (p.chain3 || 0) >= 2 };
    case 'mage': {
      const e = liveEcho(p);
      return { ...spec, at: e ? 1 : 0, max: 1, ready: !!e,
               note: e ? `${e.n} — ${e.t}` : '' };
    }
    case 'ranger':  return { ...spec, at: p.markN || 0, ready: (p.markN || 0) >= 5,
                             note: p.markN ? `+${Math.round((p.markN) * 9)}%` : '' };
    case 'paladin': return { ...spec, at: p.oath || 0, max: OATH_MAX,
                             ready: (p.oath || 0) >= 2,
                             note: p.oath ? `맹세 ${p.oath}` : '' };
    case 'rogue':   return { ...spec, at: p.shadow || 0, max: SHADOW_MAX,
                             ready: (p.shadow || 0) >= 1,
                             note: p.shadow ? `그림자 ${p.shadow}` : '' };
    case 'priest':  return { ...spec, at: p.faith || 0, max: FAITH_MAX,
                             ready: (p.faith || 0) >= 3,
                             note: p.faith ? `신앙 ${p.faith}` : '' };
  }
  return spec;
}

/* 응답: the priest heals harder the worse it is going. Every
   restore in the game funnels through here so the trait cannot
   be true of the potion and false of the spell. */
export const healScale = () => {
  const p = G.player;
  return (p?.cls === 'priest' && p.hp < p.maxhp * 0.5) ? 1.6 : 1;
};

export const spellList = p => {
  const realm = CLASSES[p.cls].realm;
  return realm ? SPELLS[realm].filter(s => s.lv <= p.lv) : [];
};

/* The arts ride the same row, the same keys and the same tooltip
   as spells — they differ in what they spend and in that they are
   the class's own rather than a realm's. `artList` is the funnel;
   nothing outside it should read ARTS directly. */
export const artList = p => (ARTS[p?.cls] || []).filter(a => a.lv <= p.lv);
export const artById = (p, id) => artList(p).find(a => a.id === id);

/* Spells that do nothing at all without something in sight. */
const TARGETED = ['bolt', 'smite'];

/* The whole book at once — always the same five, always in the
   same order, with what is not yet learned shown as a locked
   frame rather than left out. A row that grows as you level is a
   row you misfire on, and the point of putting spells on the
   play screen is that casting stops costing a screen change. */
export function spellSlots() {
  const p = G.player;
  if (!p) return [];
  const realm = CLASSES[p.cls].realm;
  /* A bolt with nothing to shoot at stays dark. The row doubles
     as a read of the room that way. */
  const seen = G.level && G.monsters.some(m => G.level.vis[idx(m.x, m.y)]);

  /* Arts come first in the row, because a class that has them
     leads with them. 침묵의 서약 takes spells, not hands — an art
     is not spoken. */
  const arts = (ARTS[p.cls] || []).map(a => {
    const locked = a.lv > p.lv;
    const near = G.level && adjacentMonsters(p).length > 0;
    /* The row has to grey out on exactly the tests useArt refuses
       on, or the button lies. It only knew about the arts that
       need a body, so the three shooting arts read as live with no
       bow and no clear line — useArt then declined and, costing no
       turn, handed anything looping on the row an infinite loop.
       Measured on a headless bot: every ranger run stalled inside
       14 turns, pressing 조준 사격 301.6 times a run. */
    const noTarget = (ART_NEEDS_BODY.includes(a.id) && !near)
                  || (ART_NEEDS_SHOT.includes(a.id) && !(G.level && shotTarget()))
                  || (ART_NEEDS_SIGHT.includes(a.id) && !(G.level && visibleMonsters().length))
                  || (ART_NEEDS_WATCHER.includes(a.id) && !(G.level && awakeWatchers().length));
    return {
      id: a.id, name: a.name, short: a.short || a.name.slice(0, 3),   // 두 글자로 자르면 「마무」가 된다
      lv: a.lv, cost: a.faith || a.oath || a.shade || a.stam, art: true,
      faith: !!a.faith, oath: !!a.oath, shade: !!a.shade, stam: a.stam || 0,
      locked, silent: false, noTarget,
      plus: 0, affix: null,
      ready: !locked && !noTarget
             && (a.faith ? (p.faith || 0) >= a.faith
               : a.oath ? (p.oath || 0) >= a.oath
               : a.shade ? (p.shadow || 0) >= a.shade
               : true)
             && p.stam >= (a.stam || 0),
    };
  });
  if (!realm) return arts;

  const silent = hasRelic('vow');
  return arts.concat(SPELLS[realm].map(s => {
    const locked = s.lv > p.lv;
    const cost = spellCost(p, s);
    const noTarget = TARGETED.includes(s.id) && !seen;
    return {
      id: s.id, name: s.name, short: s.short || s.name.slice(0, 3),
      lv: s.lv, cost, locked, silent, noTarget,
      plus: p.spellPlus?.[s.id] || 0,
      affix: p.spellAffix?.[s.id] || null,
      ready: !locked && !silent && !noTarget && p.mana >= cost,
    };
  }));
}

/* ── inventory ──────────────────────────────────────────── */
export const makeConsumable = id => ({ kind:'use', ...CONSUMABLES.find(c => c.id === id) });
/* Ammunition stacks the way flasks do — one line in the pack that
   counts down, not twenty arrows taking twenty slots. */
export const makeQuiver = id => ({ kind:'quiver', slot:'quiver', ...quiverById(id) });

export const PACK_MAX = 20;
/* 한 줄이 몇 칸인가. 정체를 모르는 물약·두루마리는 반 칸이다 —
   생김새가 열 가지라 한 종류씩만 주워도 배낭의 절반이 도박으로
   차 버렸고, 그래서 도박을 줍지 않게 됐다. 미지를 들고 다니는
   값이 「배낭을 포기하는 것」이면 아무도 안 든다. */
export const slotCost = slot =>
  (slot?.item?.kind === 'use' && !isKnown(slot.item.id)) ? 0.5 : 1;
export const packUsed = p =>
  (p?.pack || []).reduce((s, slot) => s + slotCost(slot), 0);
/* 얼마나 찼는가 (0~1). 화면과 규칙이 같은 한 줄을 읽는다 —
   막대가 부르는 값과 벌이 매기는 값이 갈라지면 그건 벌이 아니라 버그다. */
export const packLoad = p => packUsed(p) / PACK_MAX;
export const HEAVY_AT = 0.60;      // 숨이 늦게 돌아오기 시작하는 지점
export const LADEN_AT = 0.85;      // 손이 굼떠 기름이 빨리 타는 지점

/* Will this item find a home? Asked *before* the floor lets go of
   it. addItem used to answer by refusing after the caller had
   already spliced the thing out of G.items, which meant a full
   pack did not stop a pickup — it deleted the item. A rare drop
   walked over with twenty slots full simply ceased to exist, and
   the only trace was one line in the log. */
export function packRoom(p, item) {
  if (!item) return false;
  if (item.kind === 'use' || item.kind === 'cat')
    if (p.pack.some(s => s.item.id === item.id)) return true;   // stacks
  return packUsed(p) + slotCost({ item }) <= PACK_MAX;
}

export function addItem(p, item, qty = 1) {
  // Catalysts stack the same way flasks do — you carry three
  // 정련의 촉매, not three separate lines in the pack.
  if (item.kind === 'use' || item.kind === 'cat') {
    const slot = p.pack.find(s => s.item.id === item.id);
    if (slot) { slot.qty += qty; return true; }
  }
  if (packUsed(p) + slotCost({ item }) > PACK_MAX) { say('배낭이 가득 찼다.', 'warn'); return false; }
  p.pack.push({ item, qty });
  return true;
}

export function removeItem(p, slotIdx, qty = 1) {
  const slot = p.pack[slotIdx];
  if (!slot) return;
  slot.qty -= qty;
  if (slot.qty <= 0) p.pack.splice(slotIdx, 1);
}

/* 착용도 등급을 보여 준다. 여태 초월 무기를 드는 것과 낡은 단검을
   드는 것이 같은 초록 한 줄이었다 — 손에 쥐는 순간이 아무 일도
   아니면, 그 물건을 찾아다닐 이유도 한 줄 줄어든다. */
function wieldFx(it, line) {
  const p = G.player, g = rarityOf(it);
  say(line, g >= 2 ? 'level' : 'good');
  if (g >= 1) fx({ t:'wield', x:p.x, y:p.y, rar:g, spr:it.spr });
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
    // The weapon-family ledger. This line used to live in the
    // armour branch behind a `kind === 'weapon'` test, which is
    // never true there — so 무기 계열 sat at 0/6 no matter what
    // the player picked up.
    if (it.t) Meta.see('weapons', it.t);
    wieldFx(it, `${nameOf(it)}을(를) 들었다.`);
  } else if (it.kind === 'armour' || it.kind === 'quiver') {
    const key = it.slot;
    if (key === 'shield' && p.equip.weapon?.hands === 2) { say('양손 무기를 든 채로는 방패를 들 수 없다.', 'warn'); return; }
    const old = p.equip[key];
    p.equip[key] = it;
    removeItem(p, slotIdx);
    if (old) addItem(p, old);
    wieldFx(it, `${nameOf(it)}을(를) 착용했다.`);
  }
  endTurn();
}

/* ── salvage ──────────────────────────────────────────────
   The answer to "why is all this gear dropping". A weapon you
   will never wear is no longer litter; it is either coin at the
   merchant or material at the fire, and you cannot have both. */
/* A named weapon is neither scrap nor a candidate for the anvil.
   Melting 《약속》 for two dust, or plussing it into an ordinary
   +7, would make the one-of-a-kind into a resource. */
/* 소모품과 화살통도 부술 수 있다. 나오는 것은 부스러기 몇뿐이고
   그게 맞다 — 여기서 묻는 것은 「이게 재료로 값어치가 있는가」가
   아니라 「나쁜 물약 한 병이 열 층 내내 배낭 한 칸을 잡고 있어야
   하는가」다. 답은 아니오였다. */
export const canSalvage = it =>
  !!it && !it.unique
  && (it.kind === 'weapon' || it.kind === 'armour'
      || it.kind === 'use' || it.kind === 'quiver' || it.kind === 'cat');

/* 그리고 부술 수도 없는 것 — 이름이 붙은 물건 — 은 바닥에 내려
   놓는다. 여태 이 게임에는 「버린다」는 동사 자체가 없었다. 안
   쓰는 고유 무기 하나가 배낭 한 칸을 판이 끝날 때까지 붙들었고,
   플레이어에게는 그걸 어떻게 할 방법이 없었다. 부수지 못하게
   막은 규칙은 지킨다 — 《약속》은 여전히 가루가 되지 않는다.
   다만 내려놓을 수는 있고, 마음이 바뀌면 다시 주우면 된다. */
export function dropItem(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot) return false;
  const it = slot.item, qty = slot.qty;
  if (G.items.some(o => o.x === p.x && o.y === p.y)) {
    say('발밑에 이미 뭔가 있다.', 'warn'); return false;
  }
  removeItem(p, slotIdx, qty);
  G.items.push({ ...it, qty, x: p.x, y: p.y });
  say(`${nameOf(it)}을(를) 내려놓았다.`);
  fx({ t:'drop', x: p.x, y: p.y, rar: rarityOf(it) });
  endTurn();
  return true;
}

export const salvagePreview = it => (canSalvage(it) ? salvageYield(it) : null);

export function salvage(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot || !canSalvage(slot.item)) return;
  const it = slot.item;
  const got = salvageYield(it);

  p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
  const parts = [];
  const mult = (G.branch?.mats || 1) * (hasBoon('hoard') ? 1.6 : 1);
  for (const k of ['scrap', 'dust', 'essence']) {
    if (!got[k]) continue;
    got[k] = Math.round(got[k] * mult);
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

/* 값을 물린다. 막는 판정이 값보다 앞에 있어야 하는 것이 원칙이지만,
   접사 뽑기처럼 값을 치른 뒤에야 「나올 것이 없다」를 알 수 있는
   자리가 하나 있다. 거기서는 되돌려준다. */
function refund(cost) {
  const p = G.player;
  p.gold += cost.gold || 0;
  for (const k of ['scrap', 'dust', 'essence']) p.mats[k] += cost[k] || 0;
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
  G.act = 'use';
  // Using it is how you find out what it was.
  identify(it.id);

  // 폭식의 위장 doubles what a flask does. It is the only relic
  // that makes the potions you were already hoarding matter.
  // 짧은 심지 turns the same act into an attack and takes the
  // healing back — a flask becomes a tactic, not a top-up.
  const gulp = (hasRelic('gut') || hasRelic('famine') ? 2 : 1) * (hasRelic('wick') ? 0.7 : 1);
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
      const h = Math.round(Math.min(p.maxhp - p.hp, (20 + roll(2, 8) + p.lv * 2) * gulp * healScale()));
      p.hp += h; if (h) fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(h ? `상처가 아문다. 체력 +${h}.` : '이미 멀쩡하다.', 'good'); break;
    }
    case 'bigHeal': {
      const h = Math.round(Math.min(p.maxhp - p.hp, (Math.floor(p.maxhp * 0.6) + roll(3, 10)) * gulp * healScale()));
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
    case 'torch': p.lightTurns = Math.min(oilCap(), p.lightTurns + 520); say('새 횃불에 불을 붙였다.', 'good'); break;

    /* 연막탄. The one verb this game did not have: breaking
       pursuit. Everything walks at your speed here, so once a
       thing is on you the only exits were killing it or dying to
       it — which is why every class dies the same way, with one
       or two bodies in its face. This puts a third door in that
       room. It deals nothing; it takes the room's attention off
       you and holds the tile blind while you spend the turns you
       just bought. */
    case 'smoke': {
      const caught = G.monsters.filter(m =>
        Math.hypot(m.x - p.x, m.y - p.y) <= SMOKE_RADIUS);
      G.smoke = { x:p.x, y:p.y, left: SMOKE_TURNS, r: SMOKE_RADIUS };
      for (const m of caught) {
        if (m.named) continue;     // a guardian does not lose its own doorway
        m.awake = false;
        m.provoked = false;
      }
      /* And nothing re-acquires you while it hangs. This is the
         same gate 그림자 걸음 opens, on purpose: one funnel for
         "nothing notices you", so the smoke cannot be right in
         one place and wrong in the other. */
      G.hushUntil = Math.max(G.hushUntil || 0, G.turn + SMOKE_TURNS);
      fx({ t:'smoke', x:p.x, y:p.y, r: SMOKE_RADIUS, n: caught.length });
      say(caught.length
        ? `연기가 터진다. ${caught.length}이(가) 당신을 놓쳤다.`
        : '연기가 터진다. 놓칠 것이 아무것도 없다.', caught.length ? 'good' : 'warn');
      break;
    }

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
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, low: p.hp <= p.maxhp * 0.25 && p.hp + dmg > p.maxhp * 0.25, severe:true });
      if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'독의 물약' }); }
      break;
    }
    case 'murk': afflict(p, 'blind', 22); break;
    case 'forge': {
      const slots = GEAR_SLOTS.filter(k => p.equip[k]);
      if (!slots.length) { say('벼릴 것이 없다.', 'warn'); break; }
      const it2 = p.equip[slots[rnd(slots.length)]];
      it2.plus = Math.min(MAX_PLUS, (it2.plus || 0) + 1);
      recalc(p);
      say(`${affixName(it2)} — 저절로 벼려졌다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y });
      break;
    }
    case 'hex': {
      const slots = GEAR_SLOTS.filter(k => p.equip[k]);
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
/* Arts that are pointless with nothing in reach, so the row can
   grey them out the way it greys out a bolt with no target. */
const ART_NEEDS_BODY = ['shove', 'cleave', 'finisher', 'vitals', 'judgest', 'storm'];
/* And the ones that need something down a clear line instead —
   the ranger's row greys out on the same reading of the room that
   the 쏘기 button uses. */
const ART_NEEDS_SHOT = ['aimed', 'pierce', 'volley'];
/* The rogue's two that only need to *see* something — no bow, no
   reach, just a body in the light. */
const ART_NEEDS_SIGHT = ['shadowstep', 'fan'];
/* And the one that needs something to lose you: vanishing in an
   empty room is a wasted shade, so the row says so. */
const ART_NEEDS_WATCHER = ['vanish'];

/* The eight neighbours, in the order a landing spot should be
   tried: straight behind first, then around. */
const dirs8 = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];

/* Everything the hero sees right now, nearest first. One reader,
   because three arts and the row all have to agree on what
   "보인다" means. */
function visibleMonsters() {
  const p = G.player, L = G.level;
  if (!L) return [];
  return G.monsters
    .filter(m => !m.disguise && L.vis[idx(m.x, m.y)])
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
}
const awakeWatchers = () => visibleMonsters().filter(m => m.awake && !m.boss);

/* ── the warrior's four ───────────────────────────────────
   Each answers a situation the class is supposed to own and no
   two answer the same one: surrounded, a pack, something that
   telegraphs or shoots, and a thing that is nearly done. They
   spend stamina, which regenerates on a timer rather than being
   found in a flask — so the warrior's rhythm is spend-and-wait
   rather than hoard-and-dump, which is the whole difference in
   feel from a caster. */
export function useArt(id) {
  const p = G.player;
  const a = artById(p, id);
  if (!a) return;
  /* Paralysis eats the turn here exactly as it does in step().
     Returning without spending it looks harmless and is not: any
     caller that loops until the turn advances — the bot does —
     spins forever on a paralysed hero. */
  if (has(p, 'paralyze')) {
    say('몸이 굳어 말을 듣지 않는다.', 'warn');
    fx({ t:'struggle', x:p.x, y:p.y });
    endTurn(); return;
  }
  // These two are mis-taps rather than lost turns, so they cost
  // nothing — the same way a spell with no mana costs nothing.
  if (a.stam && p.stam < a.stam) { say('숨이 차다.', 'warn'); return; }
  if (a.oath && (p.oath || 0) < a.oath) { say('맹세가 모자라다.', 'warn'); return; }
  if (a.shade && (p.shadow || 0) < a.shade) { say('그림자가 모자란다.', 'warn'); return; }

  const near = adjacentMonsters(p);
  if (ART_NEEDS_BODY.includes(id) && !near.length) {
    say('손이 닿는 곳에 아무것도 없다.', 'warn'); return;
  }
  G.act = 'cast';                 // 기예도 플레이어에겐 같은 몸짓이다
  if (ART_NEEDS_SHOT.includes(id)) {
    if (weaponType(p) !== 'bow') { say('활이 없다.', 'warn'); return; }
    if (!shotTarget()) { say('사선이 트인 것이 없다.', 'warn'); return; }
  }
  if (ART_NEEDS_SIGHT.includes(id) && !visibleMonsters().length) {
    say('보이는 것이 없다.', 'warn'); return;
  }
  if (ART_NEEDS_WATCHER.includes(id) && !awakeWatchers().length) {
    say('너를 보고 있는 것이 없다.', 'warn'); return;
  }
  if (a.faith && (p.faith || 0) < a.faith) { say('신앙이 모자란다.', 'warn'); return; }
  p.stam -= a.stam || 0;
  if (a.faith) p.faith -= a.faith;
  if (a.oath) p.oath -= a.oath;
  if (a.shade) p.shadow = Math.max(0, (p.shadow || 0) - a.shade);

  switch (id) {
    case 'shove': {
      /* The answer to being surrounded. It does almost no damage
         on its own — what it buys is a tile, and a wall turns
         that tile into a stagger. */
      const m = near.sort((x, y) => y.hp - x.hp)[0];
      const dx = Math.sign(m.x - p.x), dy = Math.sign(m.y - p.y);
      let moved = 0;
      for (let i = 0; i < SHOVE_DIST; i++) {
        const nx = m.x + dx, ny = m.y + dy;
        if (G.level.solid(nx, ny) || monsterAt(nx, ny)) break;
        m.x = nx; m.y = ny; moved++;
      }
      m.awake = true;
      fx({ t:'shove', x:p.x, y:p.y, tx:m.x, ty:m.y, dx, dy, hit: moved < SHOVE_DIST });
      if (moved < SHOVE_DIST) {
        // It had nowhere to go. That is the good outcome.
        const bump = Math.max(2, Math.round(baseSwing(p) * SHOVE_WALL));
        hurtMonster(m, bump, '벽', {});
        // Negative energy is how this game spends a monster's turn
        // for it — the same lever the ambush ring uses to make the
        // first turn a scramble rather than a swing.
        if (G.monsters.includes(m)) m.energy = -1;
        say(`${m.n}을(를) 벽으로 몰아붙였다. 무너진다.`, 'level');
      } else {
        say(`${m.n}을(를) ${moved}칸 밀어냈다.`);
      }
      break;
    }
    case 'cleave': {
      /* The answer to a pack — and the reason 재의 사냥개 arriving
         three at a time is a fight rather than a funeral.

         전사의 자루 reaches a ring further with a haft in both
         hands, which turns the art from "the things touching me"
         into "the things near me". */
      const wide = fitRule(p, 'wideCleave');
      const hit = wide
        ? G.monsters.filter(o => !o.disguise
            && Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y)) <= 2)
        : near;
      fx({ t:'cleave', x:p.x, y:p.y, n:hit.length, wide });
      say(hit.length > 2 ? '한 호를 그리며 전부를 지나갔다.' : '넓게 베었다.', 'level');
      for (const m of [...hit]) if (G.monsters.includes(m)) swing(m, CLEAVE_SHARE);
      break;
    }
    /* ── 도적의 넷 ─────────────────────────────────────
       Two answers to being outnumbered or outranged, and two
       assassin's blows. In that order, because the first two are
       what make the other two survivable. */
    case 'shadowstep': {
      /* The archer answer. An archer beats you by keeping a gap;
         this spends a shade to delete the gap and arrive on the
         blind side. */
      const t = visibleMonsters()[0];
      const dx = Math.sign(t.x - p.x), dy = Math.sign(t.y - p.y);
      const spots = [[t.x + dx, t.y + dy],
                     ...dirs8.map(([ax, ay]) => [t.x + ax, t.y + ay])];
      const to = spots.find(([x, y]) =>
        !G.level.solid(x, y) && !monsterAt(x, y) && !(x === p.x && y === p.y));
      if (!to) { say('설 자리가 없다.', 'warn'); break; }
      const from = { x:p.x, y:p.y };
      p.x = to[0]; p.y = to[1];
      refreshFov();
      fx({ t:'roll', x:p.x, y:p.y,
           dx: Math.sign(p.x - from.x), dy: Math.sign(p.y - from.y),
           dist: Math.max(1, Math.round(Math.hypot(p.x - from.x, p.y - from.y))) });
      say(`${t.n}의 등 뒤에 섰다.`, 'level');
      /* Unaware is how this game already spells "ambush", so the
         art borrows that rather than inventing a second kind of
         guaranteed crit. */
      const wasAwake = t.awake;
      t.awake = false;
      swing(t, 1, { noShade: true });
      if (wasAwake && G.monsters.includes(t)) t.awake = true;
      break;
    }
    case 'fan': {
      /* The pack answer. A cone rather than a ring: it is thrown,
         so it answers the half of the room you are facing. */
      const t = visibleMonsters()[0];
      const len = Math.max(1e-6, Math.hypot(t.x - p.x, t.y - p.y));
      const ax = (t.x - p.x) / len, ay = (t.y - p.y) / len;
      const hit = visibleMonsters().filter(o => {
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d > FAN_RANGE) return false;
        if (d < 0.5) return true;
        return ((o.x - p.x) / d) * ax + ((o.y - p.y) / d) * ay >= FAN_ARC;
      });
      fx({ t:'volley', x:p.x, y:p.y, n:hit.length });
      say(hit.length > 1 ? `칼이 부채처럼 펼쳐졌다 — ${hit.length}에게.`
                         : '칼 한 자루가 날아갔다.', 'level');
      for (const o of [...hit]) if (G.monsters.includes(o)) swing(o, FAN_SHARE);
      break;
    }
    case 'vanish': {
      /* Stealth as something you can re-enter. Everything awake
         that can see you loses you — which makes your next blow an
         ambush by the ordinary rule, which hands a shade back.
         A boss does not lose you, and neither does a named thing
         you have already picked a fight with. */
      const lost = awakeWatchers().filter(m => !(m.named && m.provoked));
      for (const m of lost) m.awake = false;
      G.hushUntil = G.turn + VANISH_HUSH;
      fx({ t:'burst', x:p.x, y:p.y, r:3, color:'B' });
      say(lost.length ? `${lost.length}이(가) 너를 놓쳤다.` : '자취를 지웠다.', 'good');
      break;
    }
    case 'vitals': {
      /* The one shot. Priced off nothing but the three shades it
         costs, so unlike 마무리 it is worth the same on a full
         health bar as on a sliver. */
      const m = near.sort((x, y) => y.hp - x.hp)[0];
      fx({ t:'finisher', x:p.x, y:p.y, tx:m.x, ty:m.y, power:1 });
      say('칼끝이 갑옷 사이를 찾았다.', 'level');
      swing(m, VITALS_MULT, { pierce: true });
      break;
    }

    case 'flurry': {
      /* Every exit from this loop is a thing the player did: the
         breath ran out, the body fell, or a blow missed. It rides
         swing(), so the third blow feeds 세 번째 손 exactly as
         three ordinary swings would. */
      const m = near.sort((x, y) => y.hp - x.hp)[0];
      let landed = 0;
      for (let i = 0; i < FLURRY_MAX; i++) {
        if (!G.monsters.includes(m) || !G.running) break;
        if (i > 0) {
          if (p.stam < FLURRY_STAM) { say('숨이 끊겼다.', 'warn'); break; }
          p.stam -= FLURRY_STAM;
        }
        fx({ t:'lunge', who:'player', x:p.x, y:p.y, kind:weaponType(p),
             dx: Math.sign(m.x - p.x), dy: Math.sign(m.y - p.y) });
        if (!swing(m, 1 + landed * FLURRY_STEP)) break;
        landed++;
      }
      if (landed >= 3) say(`${landed}연타 — 마지막 한 대가 처음의 ${(1 + (landed - 1) * FLURRY_STEP).toFixed(2)}배였다.`, 'level');
      else if (landed) say(`${landed}대를 이어 붙였다.`, 'level');
      else say('첫 대부터 빗나갔다.', 'warn');
      break;
    }

    case 'finisher': {
      /* The answer to a thing that is nearly done. Priced off what
         the target has *lost*, so it is worthless as an opener and
         decisive as a closer — the opposite curve from 처형, which
         is a threshold rather than a slope. */
      const m = near.sort((x, y) => (x.hp / x.maxhp) - (y.hp / y.maxhp))[0];
      const gone = 1 - m.hp / Math.max(1, m.maxhp);
      fx({ t:'finisher', x:p.x, y:p.y, tx:m.x, ty:m.y, power:gone });
      say(`숨을 모아 내리친다.`, 'level');
      swing(m, 1 + gone * (FINISH_MAX - 1));
      break;
    }

    /* ── 팔라딘의 넷 ───────────────────────────────────
       The old paladin was a defence number that leaked, and the
       first attempt at fixing it was another defence number that
       asked him to stand still — which is nothing in a game whose
       whole texture is walking into a room and taking it apart.
       All four of these kill something. What differs is the
       shape: how you reach it, how you get through it, how you
       take a crowd, and how you keep going. */
    case 'charge': {
      /* Nobody in the game has a gap-closer, and the paladin is
         the class that most needs one — dexterity −2 makes him
         the slowest thing on the floor, so anything that wants to
         keep away from him simply does. */
      const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      let best = null;
      for (const [dx, dy] of dirs) {
        for (let d = 1; d <= CHARGE_DIST; d++) {
          const tx = p.x + dx * d, ty = p.y + dy * d;
          if (!walkable(G.level, tx, ty)) break;
          const hit = G.monsters.find(o => !o.disguise && o.x === tx && o.y === ty);
          if (hit) {
            if (!best || d < best.d) best = { m: hit, dx, dy, d };
            break;
          }
        }
      }
      if (!best) { say('달려들 곳이 없다.', 'warn'); break; }
      const lx = best.m.x - best.dx, ly = best.m.y - best.dy;
      const from = { x: p.x, y: p.y };
      if (walkable(G.level, lx, ly) && !G.monsters.some(o => o.x === lx && o.y === ly)) {
        p.x = lx; p.y = ly;
      }
      fx({ t:'charge', x:from.x, y:from.y, tx:p.x, ty:p.y, dx:best.dx, dy:best.dy });
      say('땅을 밟고 달려든다.', 'level');
      /* Driven into a wall it loses its footing. The extra is not
         damage — it is turns, which is worth more. */
      const bx = best.m.x + best.dx, by = best.m.y + best.dy;
      const pinned = !walkable(G.level, bx, by);
      swing(best.m, 1.35);
      if (pinned && G.monsters.includes(best.m)) {
        best.m.energy = -CHARGE_SLAM;
        best.m.awake = true;
        fx({ t:'slam', x:best.m.x, y:best.m.y });
        say(`${best.m.n}이(가) 벽에 처박혔다.`, 'good');
      }
      break;
    }
    case 'judgest': {
      /* The warrior's 마무리 is priced off what the target has
         lost, so it closes fights. This one is priced off how big
         the target is to begin with, so it opens them — and it
         goes through armour entirely, which is what makes the
         thickest thing in the room the right thing to use it on. */
      const m = near.sort((x, y) => (y.maxhp || 0) - (x.maxhp || 0))[0];
      fx({ t:'judgest', x:p.x, y:p.y, tx:m.x, ty:m.y });
      say('내리치는 것은 무기가 아니라 판결이다.', 'level');
      /* The whole blow goes through armour, so it is priced and
         delivered by hand rather than through swing() — which
         rolls the target's plate in on every hit and has no way
         to be told not to. */
      const heft = Math.round(baseSwing(p) + (m.maxhp || 10) * JUDGE_STRIKE);
      fx({ t:'lunge', who:'player', x:p.x, y:p.y, kind:weaponType(p),
           dx: Math.sign(m.x - p.x), dy: Math.sign(m.y - p.y) });
      m.awake = true;
      hurtMonster(m, Math.max(3, heft), '심판의 일격', { pierce: true });
      break;
    }
    case 'storm': {
      /* The reason to walk into the middle of a crowd rather than
         hold a doorway. Everything around him, and every kill
         hands the oath back — three bodies down is three oath
         returned, which is another storm or most of a 성전. This
         is the engine: the class accelerates on a good swing
         instead of running dry on one. */
      if (!near.length) { say('휘두를 것이 없다.', 'warn'); break; }
      fx({ t:'storm', x:p.x, y:p.y, n:near.length });
      say(`${near.length}을(를) 한 바퀴에 쓸어버린다.`, 'level');
      let felled = 0;
      for (const m of [...near]) {
        if (!G.monsters.includes(m)) continue;
        swing(m, STORM_SHARE);
        if (!G.monsters.includes(m)) felled++;
      }
      if (felled) {
        oathGain(felled);
        fx({ t:'oathback', x:p.x, y:p.y, n:felled });
        say(`쓰러진 만큼 맹세가 돌아온다. (+${felled})`, 'good');
      }
      break;
    }
    case 'crusade': {
      /* The whole bar, and it only pays if the room is already
         nearly down — which is what 성스러운 폭풍 is for. Cut the
         nearest thing; if it falls, walk to the next and cut that
         one; stop the moment something does not fall. A paladin
         who set the room up right clears it in one action, and one
         who did not gets a single swing for eight oath. */
      let cuts = 0;
      fx({ t:'crusade', x:p.x, y:p.y });
      say('한 번 시작한 것은 끝날 때까지 멈추지 않는다.', 'level');
      while (cuts < CRUSADE_MAX) {
        const alive = G.monsters.filter(o => !o.disguise && G.level.vis[idx(o.x, o.y)]);
        if (!alive.length) break;
        const m = alive.sort((x, y) =>
          Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y))[0];
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        // step to it if it is not already in reach
        if (d > 1.5) {
          const sx = p.x + Math.sign(m.x - p.x), sy = p.y + Math.sign(m.y - p.y);
          if (!walkable(G.level, sx, sy) || G.monsters.some(o => o.x === sx && o.y === sy)) break;
          p.x = sx; p.y = sy;
          if (Math.hypot(m.x - p.x, m.y - p.y) > 1.5) { cuts++; continue; }
        }
        fx({ t:'crusadeCut', x:p.x, y:p.y, tx:m.x, ty:m.y, n:cuts });
        swing(m, 1.15);
        cuts++;
        if (G.monsters.includes(m)) break;    // it did not fall; the march is over
      }
      break;
    }

    /* ── the priest's four ─────────────────────────────
       None of them is a heal. Three answer things the game
       already had no answer to — a room you cannot leave, a thing
       that keeps aning, a floor full of the undead — and the
       fourth is a bet rather than a cure. */
    case 'sanctum': {
      G.sanctum = { x:p.x, y:p.y, left: SANCTUM_TURNS };
      fx({ t:'sanctum', x:p.x, y:p.y, turns:SANCTUM_TURNS });
      say('발밑의 돌이 밝아진다. 여기서는 물러서지 않는다.', 'good');
      break;
    }
    case 'anathema': {
      /* The answer to everything that keeps closing its own
         wounds — the troll, the vampire, 잿물 먹는 것. There was
         no way to switch that off before. */
      const near2 = G.monsters.filter(o => !o.disguise && G.level.vis[idx(o.x, o.y)]);
      if (!near2.length) { say('지목할 것이 없다.', 'warn'); break; }
      const m2 = near2.sort((x, y) => (y.maxhp || 0) - (x.maxhp || 0))[0];
      m2.cursed = true; m2.awake = true;
      fx({ t:'anathema', x:m2.x, y:m2.y });
      say(`${m2.n}을(를) 파문했다. 더는 아물지 않는다.`, 'level');
      break;
    }
    case 'judge': {
      const dead = G.monsters.filter(o => !o.disguise && UNDEAD.includes(o.spr)
                                       && G.level.vis[idx(o.x, o.y)]);
      if (!dead.length) { say('심판할 것이 없다.', 'warn'); break; }
      fx({ t:'judge', x:p.x, y:p.y, n:dead.length });
      say(`${dead.length}에게 이름을 되돌려주었다.`, 'level');
      for (const o of [...dead]) {
        if (!G.monsters.includes(o)) continue;
        hurtMonster(o, Math.max(3, Math.round((o.maxhp || 10) * JUDGE_HURT)), '심판', { pierce:true });
        if (G.monsters.includes(o)) { o.fleeing = true; o.awake = true; }
      }
      break;
    }
    case 'martyr': {
      /* Not a heal — a debt. Everything turned aside arrives at
         once when it ends, so the five turns have to be spent
         finishing the fight rather than surviving it. */
      p.martyr = MARTYR_TURNS; p.martyrDebt = 0;
      fx({ t:'martyr', x:p.x, y:p.y, turns:MARTYR_TURNS });
      say('무릎을 꿇지 않기로 했다. 다섯 턴 동안은.', 'level');
      break;
    }

    /* ── the ranger's four ─────────────────────────────
       Every one is about the gap. The warrior's arts ask what is
       next to you; these ask where everything is standing. */
    case 'aimed': {
      /* A bow loses damage over distance. This one gains it, and
         cannot miss — so the ranger's best shot is the one taken
         from the far end of the room, which is the exact opposite
         of every other attack in the game. */
      const t = shotTarget();
      const dist = Math.hypot(t.x - p.x, t.y - p.y);
      fx({ t:'aimed', fx:p.x, fy:p.y, tx:t.x, ty:t.y, dist });
      say(`숨을 멈추고 겨눈다.`, 'level');
      loose(t, 1 + dist * AIMED_GAIN, { sure: true });
      break;
    }
    case 'pierce': {
      /* One arrow, one line, everything on it. The answer to a
         corridor — and the reason a ranger wants the pack lined
         up rather than spread. */
      const t = shotTarget();
      const dx = Math.sign(t.x - p.x), dy = Math.sign(t.y - p.y);
      const rng = bowRange(p);
      fx({ t:'pierceShot', fx:p.x, fy:p.y, dx, dy, rng });
      say('시위가 한 줄을 그었다.', 'level');
      let carry = 1;
      for (let i = 1; i <= rng; i++) {
        const x = p.x + dx * i, y = p.y + dy * i;
        if (G.level.solid(x, y)) break;
        const o = monsterAt(x, y);
        if (!o || o.disguise) continue;
        loose(o, carry, { sure: true, quietFx: true });
        carry *= PIERCE_KEEP;
      }
      break;
    }
    case 'snare': {
      /* Was: bury a trap under your own feet, which only paid off
         if you were already leaving — so it fired eight times in
         twelve measured runs and never at the moment it was
         wanted. It is one action now: give ground and leave the
         trap in the ground you gave. That answers the ranger's
         actual way of dying, which is something standing in its
         face with nowhere to go.

         The snares get their own list rather than G.hazards —
         that one is the telegraphed floor patterns, keyed on
         PATTERNS and ticked by `left`, and a snare pushed into it
         would tick NaN and take every telegraph on the floor
         down with it. */
      const from = near.sort((a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      const ox = p.x, oy = p.y;
      if (from) {
        const bx = Math.sign(p.x - from.x), by = Math.sign(p.y - from.y);
        /* Straight back first, then either shoulder — a ranger
           against a wall still gets the trap, just not the step. */
        for (const [dx, dy] of [[bx, by], [bx, 0], [0, by], [-by, bx], [by, -bx]]) {
          if (!dx && !dy) continue;
          const nx = p.x + dx, ny = p.y + dy;
          if (!walkable(G.level, nx, ny)) continue;
          if (G.monsters.some(o => o.x === nx && o.y === ny)) continue;
          p.x = nx; p.y = ny;
          break;
        }
      }
      G.snares = G.snares || [];
      if (!G.snares.some(s2 => s2.x === ox && s2.y === oy))
        G.snares.push({ x:ox, y:oy });
      fx({ t:'snare', x:ox, y:oy });
      if (p.x !== ox || p.y !== oy) {
        fx({ t:'roll', x:p.x, y:p.y, dx: Math.sign(p.x - ox), dy: Math.sign(p.y - oy), dist:1 });
        say('한 걸음 물러서며 발자국 자리에 덫을 묻었다.', 'good');
      } else {
        say('발밑에 덫을 묻었다. 밟는 쪽이 손해다.', 'good');
      }
      break;
    }
    case 'volley': {
      /* Everything in sight, once each, at half. The answer to a
         room rather than to a body — the ranger's 휩쓸기, thrown
         across the floor instead of swung around the hips. */
      const rng = bowRange(p);
      const seen = G.monsters.filter(o =>
        !o.disguise && G.level.vis[idx(o.x, o.y)]
        && Math.hypot(o.x - p.x, o.y - p.y) <= rng
        && lineClear(G.level, p.x, p.y, o.x, o.y));
      if (!seen.length) { say('겨눌 것이 없다.', 'warn'); break; }
      fx({ t:'volley', x:p.x, y:p.y, n:seen.length });
      say(`화살이 빗발친다 — ${seen.length}에게.`, 'level');
      for (const o of [...seen]) if (G.monsters.includes(o)) loose(o, VOLLEY_SHARE, { quietFx: true });
      break;
    }
  }
  if (G.running) endTurn();
}

/* 성역. Only while you are standing in it — the moment you step
   off the consecrated tile it is just a bright stone. That is what
   makes it zone control rather than a buff: the priest has to
   decide to hold a place, and the room has to be worth holding. */
function sanctumSoak(dmg) {
  const p = G.player, s2 = G.sanctum;
  if (!s2 || s2.left <= 0 || p.x !== s2.x || p.y !== s2.y) return dmg;
  fx({ t:'sanctumHit', x:p.x, y:p.y });
  return Math.max(1, Math.round(dmg * (1 - SANCTUM_CUT)));
}


/* What one clean blow is worth right now, before the target's
   armour. Used by the arts that need to price something off the
   swing rather than roll a fresh one. */
function baseSwing(p) {
  const w = p.equip.weapon;
  const d = w ? w.dice : [1, 3];
  return (d[0] * (d[1] + 1)) / 2 + statB(p, 'str') * 2
       + Math.floor(p.lv / 3) + gearBonus(p).dmg;
}

export function cast(spellId) {
  const p = G.player;
  // One entry point for the row, the keys and the tooltip: an art
  // and a spell are the same gesture to the player.
  if (artById(p, spellId)) { useArt(spellId); return; }
  const sp = spellList(p).find(s => s.id === spellId);
  if (!sp) return;
  // 침묵의 서약 trades the whole spellbook for a third more
  // damage in the hand — the sharpest build commitment here.
  if (hasRelic('vow')) { say('서약이 혀를 막는다. 주문은 나오지 않는다.', 'warn'); return; }
  const cost = spellCost(p, sp);
  if (p.mana < cost) { say('마나가 모자란다.', 'warn'); return; }

  /* 잔향 is read before anything is spent, because 지형 changes
     what counts as a target and 자취 changes whether this cast
     ends the turn — both of which the guards below depend on. */
  const echo = p.cls === 'mage' ? liveEcho(p) : null;
  const reach = echo?.id === 'reach';

  /* 지형 makes the floor the room: a spell may reach what you know
     is down there rather than only what you can see from here. */
  const visible = G.monsters.filter(m => reach || G.level.vis[idx(m.x, m.y)]);
  const nearest = visible.sort((a, b) =>
    Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];

  /* Checked *before* the mana leaves the pool. A spell that has
     nothing to hit used to still cost the mana and the turn, and
     one-tap casting would have turned that from a rare slip into
     a routine one. */
  if (TARGETED.includes(sp.id) && !nearest) { say('시야에 적이 없다.', 'warn'); return; }

  p.mana -= cost;
  G.act = 'cast';                 // 마나가 실제로 나간 지점에서만 센다
  // 술사의 지팡이: the rod gives one back. Small, constant, and
  // the reason a mage keeps a wand in hand rather than a sword.
  if (fitRule(p, 'siphon')) p.mana = Math.min(p.maxmana, p.mana + 1);
  p.casts = (p.casts || 0) + 1;
  if (echo) takeEcho(p);          // consumed here, whatever it does below
  /* 룬을 새긴 자의 것: the plate still chokes the pool. What does
     get out comes out twice as hard, which is the trade for
     wearing the thing that was strangling you. */
  const pow = spellPower(p, sp.id) * (oddAwake('runeplate') ? 2 : 1)
            * (echo?.id === 'spark' ? 1 + ECHO_POWER : 1);
  const aff = SPELL_AFFIXES.find(a => a.id === p.spellAffix?.[sp.id]);

  /* 서리's afterimage: whatever this spell touches loses its next
     move. Negative energy is the same lever 밀쳐내기 uses, so a new
     trait cannot invent a second kind of "stunned". */
  const rime = m => { if (echo?.id === 'rime' && G.monsters.includes(m)) m.energy = -1; };
  /* 눈's afterimage: everything else in the room takes half, rolled
     off the damage the spell actually dealt. */
  const splash = (from, dmg, label) => {
    if (echo?.id !== 'eye') return;
    let n = 0;
    for (const o of [...visible]) {
      if (o === from || !G.monsters.includes(o) || o.disguise) continue;
      const d = Math.max(1, Math.round(dmg * ECHO_SPLASH));
      fx({ t:'beam', fx:p.x, fy:p.y, tx:o.x, ty:o.y, color:'W' });
      hurtMonster(o, d, label, { weapon: 'spell' });
      rime(o); n++;
    }
    if (n) say(`눈이 열려 있다 — ${n}에게도 닿았다.`, 'level');
  };

  switch (sp.id) {
    case 'bolt':
    case 'smite': {
      if (!nearest) { say('시야에 적이 없다.'); break; }
      const holy = sp.id === 'smite';
      const raw = holy
        ? roll(3 + Math.floor(p.lv / 3), 6) + statB(p, 'wis') * 2
        : roll(2 + Math.floor(p.lv / 3), 5) + statB(p, 'int') * 2;
      const dmg = Math.max(1, Math.round(raw * pow));
      fx({ t:'beam', fx:p.x, fy:p.y, tx:nearest.x, ty:nearest.y, color: holy ? 'y' : 'P' });
      hurtMonster(nearest, dmg, holy ? '응징의 빛' : '마력 화살', { weapon: 'spell' });
      spellDrain(aff, dmg);
      rime(nearest);
      splash(nearest, dmg, holy ? '응징의 빛' : '마력 화살');
      // 메아리치는: half of it carries to a second target.
      // 울림의 은총 does the same thing without needing the affix,
      // so a caster who finds one has it on every spell at once.
      if (aff?.chainSpell || hasBoon('echo')) {
        /* 메아리의 방: the echo echoes. Same halving each hop, one
           more body — and the room charges mana for the extra one,
           which is the whole trade. A caster who widens this way
           runs dry a floor sooner, and when the pool is empty the
           spell is back to touching two. */
        const room = hasResonance('echoroom');
        const hit = new Set([nearest]);
        let carry = dmg, from = nearest;
        for (let hop = 0; hop < (room ? ECHO_ROOM_HOPS : 1); hop++) {
          const next = visible.find(o => !hit.has(o) && G.monsters.includes(o));
          if (!next) break;
          if (hop > 0) {
            const toll = Math.max(1, Math.ceil(spellCost(p, sp) * ECHO_ROOM_TOLL));
            if (p.mana < toll) break;
            p.mana -= toll;
          }
          carry = Math.max(1, Math.round(carry * (room ? ECHO_ROOM_KEEP : 0.5)));
          fx({ t:'beam', fx:from.x, fy:from.y, tx:next.x, ty:next.y, color: holy ? 'y' : 'P' });
          hurtMonster(next, carry, '메아리', { weapon: 'spell' });
          spellDrain(aff, carry);
          hit.add(next); from = next;
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
      const h = Math.min(p.maxhp - p.hp, Math.round((12 + roll(2, 6) + statB(p, 'wis') * 3) * pow * healScale()));
      p.hp += h; fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(`상처가 닫힌다. 체력 +${h}.`, 'good'); break;
    }
    case 'heal': {
      const h = Math.min(p.maxhp - p.hp, Math.round((Math.floor(p.maxhp * 0.55) + roll(3, 8)) * pow * healScale()));
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
      /* 지형's afterimage turns the burst into the floor. Frost is
         the only spell whose reach is a radius, so it is the one
         that feels the difference. */
      let n = 0;
      const r = reach ? 999 : 5;
      fx({ t:'burst', x:p.x, y:p.y, r: reach ? 10 : 5, color:'B' });
      for (const m of [...visible])
        if (Math.hypot(m.x - p.x, m.y - p.y) <= r) {
          const d = Math.max(1, Math.round((roll(3, 8) + p.lv) * pow));
          hurtMonster(m, d, '서리', { weapon: 'spell' }); spellDrain(aff, d);
          rime(m); n++;
        }
      say(n ? (reach ? '층 전체의 공기가 얼어붙는다.' : '주변 공기가 얼어붙는다.')
            : '얼릴 것이 없다.', n ? 'good' : ''); break;
    }
    case 'map': revealMap(); say('층의 구조가 머릿속에 그려진다.', 'good'); break;
  }
  /* 자취: this cast was free of the clock, so it also leaves
     nothing behind. Without that the mage blinks, casts free,
     leaves 자취 again, and never spends a turn — an infinite free
     action dressed as a trait. One sentence: a cast that did not
     cost a turn does not write the next word. */
  const free = echo?.id === 'haste';
  if (!free) {
    leaveEcho(p, sp.id);
    endTurn();
  } else {
    fx({ t:'twin', x:p.x, y:p.y });
    say('자취를 따라, 시간을 쓰지 않고.', 'good');
  }
}

/* Spell enhancement is the same two dials as gear: a flat safe
   climb, and an affix that changes what the spell *does*. */
export const spellPower = (p, id) =>
  (1 + (p.spellPlus?.[id] || 0) * 0.22
     + gearBonus(p).spellPow
     + (SPELL_AFFIXES.find(a => a.id === p.spellAffix?.[id])?.powPct || 0))
  * (hasRelic('paradox') ? 0.55 : hasRelic('twin') ? 0.8 : 1);

export const spellCost = (p, sp) => {
  const a = SPELL_AFFIXES.find(x => x.id === p.spellAffix?.[sp.id]);
  if (hasRelic('paradox')) return 0;
  // 마지막 등불: the shorter the wick, the brighter. Free while
  // you are nearly gone — which is exactly when a caster is out
  // of mana anyway.
  if (p.equip?.weapon?.unique === 'lastlamp' && p.hp < p.maxhp * 0.25) return 0;
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
  G.hazards = []; G.snares = []; G.sanctum = null;
  G.campUses = 1 + (hasRelic('ember') ? 1 : 0);
  G.tideUsed = false;

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

  /* 화부의 기억: 잿불 아래 always holds one. Floors 11 to 14 are
     where measured runs now end, and they end with no health and
     nowhere to spend a turn getting it back. This does not hand
     any back — it puts a fire on the floor and leaves the walk
     to the player. */
  if (depth >= 11 && depth <= 14 && hasMemory('hearth') && !L.camp) L.forceCamp();

  /* A fire promised three floors ago has to actually be here. */
  if (depth > 0 && G.campPromise > 0 && !L.camp) {
    G.campPromise--;
    L.forceCamp();
  } else if (depth > 0 && G.campPromise > 0) G.campPromise--;

  if (depth > 0) populate(depth);
  if (depth > 0 && L.event) L.eventId = rollEvent();
  if (mods?.mapped && depth > 0) L.seen.fill(1);
  /* 길잡이의 기억: the shape of the floor, from floor 11 down.
     Not what is on it — the walls only. Dying because you walked
     into the wrong corridor at one health is a different failure
     from dying to the thing at the end of the right one. */
  if (depth >= 11 && hasMemory('pathfinder')) L.seen.fill(1);
  refreshFov();

  /* A fire burns whether or not you are looking at it. Mark it
     as remembered the moment you arrive, so the floor has a
     destination other than the stairs — otherwise most players
     would walk past the one real decision on the level. */
  if (L.camp) {
    L.seen[idx(L.camp.x, L.camp.y)] = 1;
    if (depth > 0) say('멀리서 불빛이 흔들린다.', 'good');
  }
  /* Where you are, said once, the turn you arrive — and only
     when it changes. Fifteen floors were fifteen numbers; five
     named places is a descent you can describe to somebody. */
  if (depth > 0) {
    const region = regionOf(depth);
    if (region.n !== G.regionAt) {
      G.regionAt = region.n;
      say(region.line, 'level');
      if (Meta.see('regions', region.n)) lore('처음 밟는 곳', region.n, region.t, 'stairsDown');
    }
  }
  if (depth > 0 && L.theme?.n) say(`${L.theme.n}이다.`, 'warn');

  // 심연의 눈 pays out the moment you arrive, which is the only
  // moment a whole map is worth anything.
  if (depth > 0 && (hasRelic('eye') || hasRelic('oracle'))) {
    L.seen.fill(1);
    say(hasRelic('oracle') ? '눈먼 예언자가 층 전체를 읊는다.' : '심연의 눈이 층 전체를 훑는다.', 'good');
  }
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
  if (depth > 0 && (hasRelic('toll') || hasRelic('ledger')) && p.gold > 0) {
    const rate = hasRelic('ledger') ? 0.20 : 0.10;
    const fee = Math.ceil(p.gold * rate);
    p.gold -= fee;
    say(hasRelic('ledger') ? `장부가 ${fee}닢을 지웠다.` : `뱃사공이 ${fee}닢을 챙겼다.`, 'warn');
  }
  // 돌씨 hardens a little every floor, for the whole run.
  if (depth > 0 && hasRelic('seed')) {
    p.seedAc = (p.seedAc || 0) + 1;
    recalc(p);
    say(`돌씨가 자란다. 방어 +${p.seedAc}.`, 'good');
  }
  /* 여명의 각인: the floor opens and the wounds close a little. */
  if (depth > 0) {
    const dawn = gearBonus(p).dawn;
    if (dawn && p.hp < p.maxhp) {
      /* 여명의 맹세: not a slice of the sheet — the whole sheet.
         A build that adds nothing to what you hit for has to be
         paid somewhere, and this is where. */
      const got = hasResonance('dawnoath') ? p.maxhp - p.hp
                : Math.min(p.maxhp - p.hp, Math.round(p.maxhp * dawn));
      p.hp += got;
      say(`여명 — 층이 열리며 상처가 아문다. 체력 +${got}.`, 'good');
      fx({ t:'heal', x:p.x, y:p.y, amt:got });
    }
  }
  G.tally = 0;                      // 처형인의 셈 starts over each floor
  G.ashCount = 0;                   // and so does 재를 세는 자
  G.hushUntil = -1;
  if (depth > 0) p.grudge = 0;      // 앙심 forgets between floors
  if (depth > 0) { p.oath = 0; p.chain3 = 0; p.markN = 0; p.chainOn = null; p.markOn = null; }

  /* The wager climbs with every floor you take without sitting
     down. Nothing is banked in the town, and nothing survives
     you — that is the whole tension. */
  if (depth > 0) {
    G.bank = Math.min(BANK_MAX, (G.bank || 0) + 1);
    if (G.bank >= 2) {
      const purse = bankPurse(G.bank, depth);
      say(`쉬지 않고 ${G.bank}층 — 판돈이 ${purse.gold}닢까지 불었다.`, 'level');
    }
  } else G.bank = 0;
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
  /* A named thing waits on two floors on the way down, and it
     waits somewhere you do not have to go. Putting it in the
     stairs room made it a toll rather than a decision — the
     arrival message announces it, so the player can weigh the
     relic against the fight and walk the other way. */
  const named = NAMED.find(n => n.at === depth);
  if (named) {
    const banned = new Set([L.roomOf[idx(G.player.x, G.player.y)],
                            L.downRoom ? L.rooms.indexOf(L.downRoom) : -1]);
    const away = L.rooms.filter((r, i) => !banned.has(i));
    const room = (away.length ? away : L.rooms)[rnd(Math.max(1, away.length || L.rooms.length))];
    const spot = L.openSpot(room, busy);
    if (spot) {
      G.monsters.push({ ...named, maxhp: named.hp, x: spot.x, y: spot.y, awake: false, energy: 0 });
      say(named.intro, 'hit');
      lore('이름 있는 것', named.n, named.intro, named.spr);
    }
  }

  /* Pack animals arrive as a pack. Six wolves coming down one
     corridor is a different problem from six wolves scattered
     across a floor, and it is the problem doors are for. */
  const br = G.branch || {};
  const mob = G.level.theme?.mob || 1;
  /* Fewer, heavier. Twelve monsters a floor at two turns each
     cost more health than every healing source on the floor
     could return, so runs ended on floor four or five no matter
     how well an individual fight went. Cutting the count is the
     lever that makes each fight matter *and* makes the descent
     survivable — the opposite of raising everyone's health. */
  const budget = Math.round((4 + rnd(3) + Math.floor(depth * 0.55))
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
      const one = { ...m, x: spot.x, y: spot.y,
                    awake: hasShackle('awake') && Math.random() < 0.5, energy: 0 };
      if (Math.random() < eliteChance(depth) * (br.elite ?? 1)) makeElite(one, depth);
      one.maxhp = one.hp;
      G.monsters.push(one);
      placed++;
    }
  }

  /* Half as many things, each worth stopping for. Eight or nine
     drops a floor read as generous and delivered nothing — you
     walked past most of them, and the ones you picked up were
     indistinguishable from the ones you left. Three or four,
     drawn from your own depth band, is the same total value
     arriving in pieces big enough to notice. */
  const loot = Math.max(1, Math.round((2 + rnd(3)) * (br.item || 1)));
  for (let i = 0; i < loot; i++) {
    const item = pickItem(depth);
    const spot = L.randomFloor(busy);
    if (spot && item) G.items.push({ ...item, x: spot.x, y: spot.y });
  }
  /* Same gold, fewer piles. A pile you cross the room for. */
  const piles = 1 + rnd(2);
  for (let i = 0; i < piles; i++) {
    const spot = L.randomFloor(busy);
    if (spot) G.items.push({ kind:'gold', spr:'gold', n:'금화',
      amount: Math.round((45 + rnd(90 + depth * 60)) * (br.gold || 1)), x: spot.x, y: spot.y });
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

  /* Rarer than it was, because it is worth something now:
     the only answer to a lock that is silent, certain and
     instant. Forcing is always available and always costs. */
  if (Math.random() < 0.26) {
    const spot = L.randomFloor(busy);
    if (spot) G.items.push({ kind:'key', spr:'ring', n:'녹슨 열쇠', x: spot.x, y: spot.y });
  }

  /* The golden thief. Fast, fragile, worth a fortune, and it
     runs the instant it sees you — so catching one costs a roll,
     a spell or a scroll, and every turn spent chasing is a turn
     the floor clock keeps. Letting it go has to stay a real
     option or it is not a gamble, it is a tax. */
  if (Math.random() < thiefChance(depth)) {
    const spot = L.randomFloor(busy);
    if (spot) {
      const t = { ...THIEF, x: spot.x, y: spot.y, awake: false, energy: 0, fleeing: true };
      t.hp = Math.round(t.hp * (1 + depth * 0.12));
      t.ac = Math.round(t.ac * (1 + depth * 0.05));
      t.maxhp = t.hp;
      G.monsters.push(t);
      say('금붙이가 부딪치는 소리가 어디선가 난다.', 'level');
    }
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

/* Two scalings, and they do different jobs.

   `over` is how far past its home depth this thing is being
   used, and keeps a rat from being a rat forever. `depth` is
   the floor itself, and is the one that was missing: without
   it the deepest monster in the book topped out at 143 health
   against a hero with 554, so the bestiary simply stopped
   being a threat somewhere around floor 6. */
function scaleMonster(m, depth) {
  const over = Math.max(0, depth - m.d);
  /* Kept deliberately mild. The bestiary already ramps hard on
     its own — five health on floor 1, a hundred and forty on
     twelve — so a large multiplier on top compounds into a
     cliff around floor 11 where a single monster trades evenly
     with the hero and there are eighteen of them. */
  const deep = 1 + depth * 0.055;
  /* 심연 rides on top of the depth curve, on the two numbers that
     decide a fight rather than on how many things are in the room.
     More monsters is more turns; harder monsters is a harder game. */
  /* 무거운 것들 is the only shackle that touches these two, and
     it touches them once. Everything else on the ladder changes a
     rule rather than a number. */
  const heavy = hasShackle('weight') ? SHACKLE_STAT : 1;
  return { ...m,
    hp:  Math.round(m.hp  * (1 + over * 0.10) * deep * heavy),
    atk: Math.round(m.atk * (1 + over * 0.06) * (1 + depth * 0.02) * heavy),
    ac:  Math.round(m.ac  * (1 + depth * 0.025)),
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

/* Gear the floor is allowed to drop. The band moves down with
   you: floor 10 no longer scatters daggers and soft leather,
   because a drop you would never pick up is not loot, it is
   litter — and litter is what made the floor feel generous
   while giving you nothing. */
const inBand = (pool, depth) => {
  const floor = depth - 5;
  const band = pool.filter(x => x.d <= depth + 2 && x.d >= floor);
  return band.length ? band : pool.filter(x => x.d <= depth + 2);
};

function pickItem(depth) {
  const r = Math.random();
  /* 3% of what a floor drops is a catalyst, and only ones the
     depth has unlocked. Rolled first so it is never crowded out. */
  if (r < 0.03) {
    const pool = CATALYSTS.filter(c => c.d <= depth);
    if (pool.length) return { kind:'cat', ...pickByRarity(pool) };
  }
  if (r < 0.38) {
    const pool = CONSUMABLES.filter(c => c.d <= depth + 2);
    return { kind:'use', ...pickByRarity(pool) };
  }
  /* A named weapon, at most one of each per run. Rolled before
     the ordinary tables so the deep floors can actually produce
     one, and never given affixes — the name is the affix. */
  if (r < 0.71 + UNIQUE_ODDS) {
    const pool = UNIQUES.filter(u => u.d <= depth && !(G.uniques || {})[u.id]);
    if (pool.length) {
      const u = pool[rnd(pool.length)];
      (G.uniques = G.uniques || {})[u.id] = true;
      return { kind:'weapon', unique:u.id, ...u };
    }
  }
  if (r < 0.71) {
    const it = { kind:'weapon', ...pickOne(inBand(WEAPONS, depth)) };
    rollAffixes(it, depth);
    rollOddity(it);
    return it;
  }
  const it = { kind:'armour', ...pickOne(inBand(ARMOURS, depth)) };
  rollAffixes(it, depth);
  rollOddity(it);
  return it;
}

/* A sleeping enchantment. It is stamped on at generation and does
   nothing at all until the item ends up in hands it does not
   suit — so it cannot be farmed by playing correctly, and the
   only way to meet one is to keep something you should have
   dropped. */
function rollOddity(it) {
  if (Math.random() >= ODDITY_ODDS) return;
  it.odd = ODDITIES[rnd(ODDITIES.length)].id;
}

export const hasUnique = id => G.player?.equip?.weapon?.unique === id;
/* Awake oddities on the whole kit, for the rules to ask about. */
export const oddAwake = id =>
  GEAR_SLOTS.some(k => oddityOf(G.player, G.player?.equip?.[k])?.id === id);

const pickOne = pool => pool[rnd(pool.length)];

function pickByRarity(pool) {
  const total = pool.reduce((s, c) => s + (c.rar || 1), 0);
  let n = rnd(total);
  for (const c of pool) { if (n < (c.rar || 1)) return c; n -= (c.rar || 1); }
  return pool[0];
}

/* Affixes on found gear. The odds climb with depth, so an early
   named weapon is a genuine event and a late one is expected. */
export function rollAffixes(item, depth, guaranteed) {
  if (item.kind !== 'weapon' && item.kind !== 'armour') return item;
  const tag = item.kind;
  /* 매력 is the stat the dungeon likes you for. It moves the odds
     that a drop carries anything at all — never enough to carry a
     build, always enough that dumping it is a decision. */
  const luck = G.player ? statB(G.player, 'chr') * 0.02 : 0;
  /* Measured: the median run reached its end holding *one* affix
     across all three slots. Every combinatorial system this game
     has — synergies, engravings, resonance — needs two specific
     things in hand at once, and at one affix a run that is a
     lottery ticket is a run that never gets a ticket. The first
     resonance lit in 1 run out of 76.

     So the pieces circulate more. Raw power is not what goes up
     — worthOf already prices an affix into what a thing sells and
     salvages for, so the economy takes its own correction. */
  const odds = clamp(0.11 + depth * 0.033 + luck, 0.04, 0.70);
  if (guaranteed || Math.random() < odds) {
    const a = pickAffix(PREFIXES, tag, false);
    if (a) item.pre = a.id;
  }
  if ((guaranteed && Math.random() < 0.5) || Math.random() < odds * 0.6) {
    const a = pickAffix(SUFFIXES, tag, false);
    if (a) item.suf = a.id;
  }
  /* 초월. Rolled here and nowhere else, so it can only ever be
     the luck of the drop — no camp, no altar, no shop can put
     one in your hands. */
  if (Math.random() < transChance(depth)) {
    item.boon = BOONS[rnd(BOONS.length)].id;
    /* It arrives already sharpened. A 초월 평범한 단검 would
       read as a joke rather than a find. */
    item.plus = Math.max(item.plus || 0, 1 + rnd(3));
    if (!item.pre) item.pre = pickAffix(PREFIXES, tag, false)?.id;
  }
  return item;
}

/* Does the player currently benefit from a 은총? Weapons and
   armour both count — the boon is a property of the thing, and
   the thing is either worn or it is not. */
export const hasBoon = id => {
  const p = G.player;
  if (!p) return false;
  for (const slot of GEAR_SLOTS)
    if (p.equip[slot]?.boon === id) return true;
  return false;
};

export function pickAffix(table, tag, allowCurse) {
  const pool = table.filter(a => a.tags.includes(tag) && (allowCurse || !a.curse));
  return pool.length ? pool[rnd(pool.length)] : null;
}

/* Light shrinks, it does not switch off. A cliff at zero taught
   the player nothing until it was too late; a radius that closes
   in over the last few hundred turns is a warning you can act on
   — and on a 빛이 없는 층 it is the whole fight. */
/* 기름은 무한정 쌓이지 않는다. 상한이 없으면 보급이 소모를 앞지르고,
   그러면 시계가 멈춘다. 사그라진 잉걸은 그 통을 더 작게 만든다. */
export const OIL_CAP = 1100;
export const oilCap = () => OIL_CAP - (hasRelic('nighteye') ? 300 : 0);

/* 한 턴에 태우는 기름. 6층까지는 1, 그 아래로 한 단씩. */
export const OIL_BURN = depth => depth >= 11 ? 3 : depth >= 6 ? 2 : 1;

/* 세 계단이 아니라 여섯 계단. 예전 표는 기름이 300 남을 때까지
   계속 7칸이었고, 그 300은 한 층을 통째로 덮는 양이라 플레이어는
   마지막 순간까지 아무것도 느끼지 못했다. 판의 90%를 가장 밝은
   반경에서 보낸 이유가 그것이다 (sim/oil.mjs). 좁혀 오는 것이
   보여야 경로를 바꿀 마음이 생긴다. */
/* 불이 꺼졌을 때 놈들이 너를 보는 거리. 네 반경 2보다 넉넉하다 —
   여기 사는 것들은 여기서 살고, 눈이 먼 쪽은 너다. */
export const DARK_SIGHT = 7;
/* 그리고 어둠 속의 손. 0.78이었는데, 어둠이 은신이던 시절에는 그것이
   유일한 벌이었다. 이제 어둠은 그 자체로 위험하므로 손은 조금 더
   무뎌져도 된다 — 「불을 켤까」가 매번 계산이 되어야 한다. */
export const DARK_AIM = 0.70;

export const lightRadiusOf = p => {
  if (G.depth === 0) return 12;
  const t = p.lightTurns;
  return t <= 0 ? 2 : t < 60 ? 3 : t < 180 ? 4 : t < 360 ? 5 : t < 640 ? 6 : 7;
};

export function refreshFov() {
  const p = G.player;
  let radius = lightRadiusOf(p);
  radius += gearBonus(p).lightR;
  if (p.race === 'elf') radius += 1;          // "눈이 밝다"
  /* 전설. 기름이 바닥나도 다섯 칸은 남는다 — 이 판에서 가장 센
     효과이고, 그래서 전설급으로 잠가 둔다. */
  if (hasRelic('everflame')) radius = Math.max(radius, 5);
  if (has(p, 'blind')) radius = 1;
  computeFov(G.level, p.x, p.y, radius);
  G.lightRadius = radius;
}

/* ── movement and turns ─────────────────────────────────── */
export const monsterAt = (x, y) => G.monsters.find(m => m.x === x && m.y === y);
export const itemAt = (x, y) => G.items.find(i => i.x === x && i.y === y);

export function step(dx, dy) {
  /* 제자리 대기를 걷기로 세면, 「버티는 판」이 「걸어 다니는 판」으로
     읽힌다 — 소란을 재다가 실제로 그렇게 헛짚었다. */
  if (!dx && !dy) G.act = 'wait';
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
    const pull = statB(p, 'str') + roll(1, 6);
    if (pull >= 5) { p.stuck = 0; say('거미줄을 뜯어냈다.', 'good'); }
    else { p.stuck--; say('거미줄이 발을 붙잡는다.', 'warn'); fx({ t:'struggle', x:p.x, y:p.y }); }
    endTurn(); return;
  }

  if (dx === 0 && dy === 0) { endTurn(); return; }

  const nx = p.x + dx, ny = p.y + dy;
  if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return;
  const ni = idx(nx, ny);
  if (L.tiles[ni] === undefined) return;

  /* A body comes before a counter. The shop check used to sit
     above this, so anything standing on a merchant's tile could
     not be attacked at all — walking into it opened the shop,
     spent no turn, and left the thing there. Harmless in town,
     where nothing hostile walks; the travelling merchant put the
     same tile in the dungeon, where things do. */
  const onCounter = monsterAt(nx, ny);
  const shopId = L.shopAt.get(ni);
  if (shopId && !(onCounter && !onCounter.disguise)) {
    /* 수레 앞도 나머지 넷과 같은 규칙을 따른다. 여기만 옛 동작이
       남아 있었다 — 발이 닿는 순간 화면이 튀어나오고, 턴은 안 쓰고,
       심지어 그 칸에 서지도 못했다. 지나가려던 사람이 장을 보게
       되고, 화면은 엄지 밑에서 열린다. 넷을 고칠 때 여기를 빠뜨린
       것이지 상점이 특별한 것이 아니었다. */
    p.x = nx; p.y = ny;
    refreshFov();
    say(`${SHOPS.find(s => s.id === shopId)?.n || '수레'} 앞에 섰다.`, 'good');
    endTurn();
    return;
  }

  /* The four tiles that offer something used to throw their whole
     screen up the instant a foot landed on them. Walking is held
     input in this game — a d-pad press that repeats, a tapped
     path that runs — so the sheet arrived *under the thumb* and
     the next repeat pressed a button on it. A choice you make by
     accident is not a choice.
     Now the foot lands, the turn is spent like any other step,
     and the offer waits. `hereOffer()` tells the row what is
     underfoot; `openHere()` is the deliberate press. Exactly the
     shape 문 닫기 already has. */
  const t = L.tiles[ni];
  if (t === CAMP || t === ALTAR || t === EVENT || t === ANVIL) {
    p.x = nx; p.y = ny;
    refreshFov();
    say(`${OFFER_NAME[t]} 위에 섰다.`, 'good');
    endTurn();
    return;
  }
  if (t === PROP) { if (bumpProp(nx, ny)) endTurn(); return; }
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
  /* Picks first: the quiet answer, and the one a rogue is for.
     They are finite, so they are a decision rather than a
     replacement for the key. */
  const picks = p.pack.find(s => s.item.id === 'picks');
  if (picks) {
    const skill = clamp(0.34 + statB(p, 'dex') * 0.07 + lockBonus(p) + p.lv * 0.006, 0.15, 0.95);
    if (Math.random() < skill) {
      L.tiles[idx(x, y)] = DOOR_OPEN;
      say('자물쇠가 소리 없이 열렸다.', 'good');
      fx({ t:'door', x, y, state:'open' });
      wearPicks();
      return;
    }
    say('갈고리가 미끄러졌다.', 'warn');
    fx({ t:'door', x, y, state:'stuck' });
    wearPicks();
    rouse(x, y, 3, 0.2);           // a pick that slips is still quiet
    return;
  }

  /* The shoulder. It always works eventually — but eventually is
     now paid for in breath, and then in blood, and the racket
     grows with every try. */
  const key = idx(x, y);
  G.forced = G.forced || {};
  const tries = (G.forced[key] = (G.forced[key] || 0) + 1);
  const chance = clamp(0.14 + statB(p, 'str') * 0.09 + p.lv * 0.006
                     + tries * 0.05, 0.04, 0.85);
  if (p.stam >= FORCE_STAM) p.stam -= FORCE_STAM;
  else {
    const hurt = hurtPlayer(FORCE_HURT + Math.floor(G.depth / 2), { combo:false });
    say(`어깨로 밀어붙였다. 숨이 없어 몸이 대신 받는다. (−${hurt})`, 'hit');
    fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg:hurt, who:'잠긴 문', severe:false });
    if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'잠긴 문' }); return; }
  }

  if (Math.random() < chance) {
    L.tiles[idx(x, y)] = DOOR_BROKEN;
    delete G.forced[key];
    say('문이 부서져 나갔다.', 'good');
    fx({ t:'door', x, y, state:'broken' });
    rouse(x, y, 11, 0.9);          // splinters carry
  } else {
    say(`문이 꿈쩍도 하지 않는다. 소리만 크게 났다. (${tries}번째)`, 'warn');
    fx({ t:'door', x, y, state:'stuck' });
    // Each shove is heard further than the last.
    rouse(x, y, FORCE_NOISE + tries * 2, Math.min(0.9, 0.45 + tries * 0.12));
  }
}

/* How much better this pair of hands is at a lock. One funnel so
   the door, the chest and any future lock agree about who is good
   at this — and so a class passive is written once. */
export function lockBonus(p) {
  return (p?.cls === 'rogue' ? 0.30 : 0)
       + (p?.race === 'gnome' ? 0.08 : 0);
}

function wearPicks() {
  const p = G.player;
  const i = p.pack.findIndex(s => s.item.id === 'picks');
  if (i < 0) return;
  removeItem(p, i, 1);
  const left = p.pack.find(s => s.item.id === 'picks')?.qty || 0;
  if (!left) say('갈고리가 부러졌다. 마지막 하나였다.', 'warn');
}

/* What is under the hero's feet that is worth a press, if
   anything. One reader, so the button, the prompt and the key
   binding can never disagree about whether there is an offer. */
export const OFFER_NAME = { [CAMP]:'모닥불', [ALTAR]:'제단', [EVENT]:'수상한 자리', [ANVIL]:'모루' };
const OFFER_SCREEN = { [CAMP]:'camp', [ALTAR]:'altar', [EVENT]:'event', [ANVIL]:'anvil' };

/* 발밑이 계단인가. 화면이 「내려가기」와 「올라가기」를 각각 한 칸씩
   차지하고 늘 띄우고 있었는데, 재 보니 각각 0.1%의 턴에만 살아 있고
   둘이 동시에 사는 일은 없다 — 한 칸에 두 계단은 없으므로 당연하다.
   판정을 규칙 쪽에 두어야 화면이 타일 상수를 알 필요가 없다. */
export function stairHere() {
  const p = G.player, L = G.level;
  if (!p || !L || !G.running) return null;
  const t = L.tiles[idx(p.x, p.y)];
  return t === DOWN ? 'down' : t === UP ? 'up' : null;
}

export function hereOffer() {
  const p = G.player, L = G.level;
  if (!p || !L || !G.running) return null;
  const here = idx(p.x, p.y);
  /* 수레는 타일이 아니라 자리로 표시된다 — 마을에는 문이 없고,
     흥정하는 칸은 좌판 앞의 땅바닥이다. 그래서 타일 표에서 찾지
     않고 따로 묻는다. */
  const shopId = L.shopAt.get(here);
  if (shopId) {
    const shop = SHOPS.find(s => s.id === shopId);
    if (shop) return { screen:'shop', n: shop.n, shop };
  }
  /* 전리품 더미도 발밑의 것이다. 타일이 아니라 바닥에 놓인 물건이라
     따로 묻는다 — 수레와 같은 이유다. */
  const pile = G.items.find(o => o.kind === 'spoils' && o.x === p.x && o.y === p.y);
  if (pile) return { screen:'event', n:'전리품 더미', spoils: pile };
  const t = L.tiles[here];
  if (t === EVENT && !L.eventId) return null;      // already taken
  const screen = OFFER_SCREEN[t];
  return screen ? { screen, n: OFFER_NAME[t] } : null;
}

/* The deliberate press. Nothing else opens these. */
export function openHere() {
  const o = hereOffer();
  if (!o) return false;
  G.act = 'open';
  if (o.shop) G.shop = o.shop;
  if (o.spoils) G.spoils = { picks: o.spoils.picks };
  G.screen = o.screen;
  return true;
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
    const d = Math.hypot(m.x - x, m.y - y);
    if (d > radius) continue;
    /* 소리는 깨우기만 하는 것이 아니라 **부른다**. 몬스터가 본 것만
       알게 된 뒤로(sim/retreat.mjs) 깨어난 놈은 나를 못 보면 헤맸고,
       그래서 소음이 아무도 끌어오지 못했다. 소리가 난 자리를 자취로
       심어 주면 놈들은 그리로 온다 — 그때부터 소음은 미끼가 되고,
       미끼가 되는 순간 밀도는 내가 정하는 것이 된다. */
    if (m.awake) { if (!m.mark || Math.random() < 0.5) { m.mark = { x, y }; m.lost = 0; } continue; }
    /* volume 1은 「반드시」다. 문이 삐걱이거나 상자가 부서지는 것은
       확률이어야 하지만(사고니까), 대가를 치르고 일부러 지르는
       소리는 결과가 확실해야 한다 — 11칸에서 25%만 깨우던 동안
       외침은 결정이 아니라 도박이었고, 도박은 이미 소란이 맡는다. */
    const heard = volume >= 1 ? true : Math.random() < volume * (1 - d / (radius + 1));
    if (heard) { m.awake = true; m.mark = { x, y }; m.lost = 0; woke++; }
  }
  if (woke) fx({ t:'noise', x, y, r:radius });
  return woke;
}

/* ── 소란 ────────────────────────────────────────────────
   판의 78%가 빈 걷기였고, 그 답은 「몬스터를 더 뿌린다」가 아니었다.
   그건 그냥 다 늘리는 것이고, 늘린 밀도는 플레이어의 결정이 아니다.

   그래서 밀도를 내가 산다. 깨어 있는 것이 주위에 많을수록 소란이
   오르고, 소란은 처치 보상을 부풀린다. 조용히 가면 안전하고 가난하고,
   불러 모으면 위험하고 부유하다. 소란은 혼자가 되면 식는다 — 그래서
   ③의 후퇴가 「그만두기」가 아니라 「챙기고 빠지기」가 된다. */
export const UPROAR_MAX = 12;
export const uproarMult = () => 1 + Math.min(G.uproar || 0, UPROAR_MAX) * 0.085;

function stirUproar() {
  const p = G.player;
  const near = G.monsters.filter(m => m.awake && !m.disguise
    && Math.hypot(m.x - p.x, m.y - p.y) <= 7).length;
  if (near >= 2) G.uproar = Math.min(UPROAR_MAX, (G.uproar || 0) + (near >= 4 ? 2 : 1));
  else if (near === 0) G.uproar = Math.max(0, (G.uproar || 0) - 1);
  const tier = G.uproar >= 9 ? 3 : G.uproar >= 5 ? 2 : G.uproar >= 2 ? 1 : 0;
  if (tier !== (G.uproarTier || 0)) {
    G.uproarTier = tier;
    if (tier === 1) say('사방에서 무언가 일어선다.', 'warn');
    if (tier === 2) say('층이 깨어났다. 이 소란은 네가 만든 것이다.', 'warn');
    if (tier === 3) say('전부 이쪽으로 오고 있다. 물러설 자리를 지금 정해라.', 'hit');
  }
}

/* 스스로 내는 소리. 이 게임에서 밀도를 올리는 유일한 손잡이다. */
export const SHOUT_STAM = 2;
export function shout() {
  const p = G.player;
  if (G.depth === 0) { say('여기서 소리쳐 봐야 아무도 오지 않는다.', 'warn'); return false; }
  if (p.stam < SHOUT_STAM) { say('숨이 차서 소리가 나오지 않는다.', 'warn'); return false; }
  p.stam -= SHOUT_STAM;
  G.act = 'shout';                  // 외침은 걷기가 아니다 — 안 적으면 걷기로 세어진다
  /* 9칸. 13칸을 확정으로 깨우던 동안 외침은 「한 무리를 부르는 것」이
     아니라 「층을 통째로 여는 것」이었고, 재 보니 도달 층수가 8.1에서
     5.0으로 떨어졌다. 위험을 사는 것과 판을 버리는 것은 다르다. */
  const woke = rouse(p.x, p.y, 9, 1);
  G.shouts = (G.shouts || 0) + 1; G.drawn = (G.drawn || 0) + woke;
  G.uproar = Math.min(UPROAR_MAX, (G.uproar || 0) + 3);
  say(woke ? `소리쳤다. ${woke}이(가) 이쪽으로 온다.`
           : '소리쳤다. 아무 대답도 없다. 그편이 나은지는 모르겠다.', woke ? 'hit' : '');
  fx({ t:'noise', x:p.x, y:p.y, r:13 });
  endTurn();
  return true;
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
  /* 발이 가볍다. A ranger has spent its life on ground that bites
     and sometimes simply does not put its weight down — the trap
     stays armed and it steps around. Nobody else gets this, and
     it is why the class walks into a floor first. */
  if (p.cls === 'ranger' && Math.random() < RANGER_FOOTING) {
    trap.seen = true;
    say(`${TRAPS[trap.kind].n} 위에서 발을 뗐다.`, 'good');
    fx({ t:'spot', x, y });
    return false;
  }
  L.traps.delete(idx(x, y));
  G.trapsSprung++;
  // 부러진 나침반: you walk into every one of them and none of
  // them matter. Blind and immune is a build, not a handicap.
  if (hasRelic('compass') || hasRelic('oracle')) {
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
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, low: p.hp <= p.maxhp * 0.25 && p.hp + dmg > p.maxhp * 0.25, severe: dmg >= p.maxhp * 0.18 });
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
      const grab = clamp(0.45 + statB(p, 'dex') * 0.07
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
    0.16 + statB(p, 'wis') * 0.045 + p.lv * 0.007
    + (p.cls === 'rogue' ? 0.28 : p.cls === 'ranger' ? 0.10 : 0),
    0.04, 0.9);
  /* How far the eye reaches, not just how good it is. A rogue
     spots what is under its nose; a ranger reads the ground two
     rooms out, which is the difference between disarming a floor
     and surviving it. */
  let reach = p.cls === 'ranger' ? 4 : p.cls === 'rogue' ? 3 : 2;
  /* 어둠 속에서는 바닥이 안 보인다. 함정을 밟는 것이 어둠의 값 중
     하나여야지, 불이 꺼진 채로 걷는 것이 공짜면 안 된다. */
  if (G.depth > 0 && p.lightTurns <= 0 && !hasRelic('nighteye')) reach = 1;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const trap = L.traps.get(idx(x, y));
    if (!trap || trap.seen) continue;
    const near = Math.max(Math.abs(dx), Math.abs(dy));
    // 도굴꾼의 장갑 and 부러진 나침반 both blind you to traps —
    // one for greed, one because it no longer matters.
    if (hasRelic('glove') || hasRelic('compass') || hasRelic('oracle')) continue;
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
  G.act = 'pick';
  const it = G.items[i];
  if (it.kind === 'chest') { openChest(i, it); return; }
  /* 전리품 더미는 줍는 것이 아니라 여는 것이다. 사건 화면을 빌려
     쓴다 — 「여러 줄 중 하나를 고른다」는 화면이 이미 있는데 똑같은
     것을 하나 더 만들면, 다음에 고칠 때 한쪽만 고쳐진다. */
  /* 밟는 순간 화면을 띄우지 않는다. 걷는 손가락 아래로 시트가
     올라오면 다음 반복 입력이 버튼을 눌러 버린다 — 모닥불·제단·
     수레에서 이미 겪은 일이고, 새로 만드는 것이 같은 실수를
     되풀이할 이유는 없다. 발밑 버튼이 기다린다. */
  if (it.kind === 'spoils') {
    say('전리품 더미 위에 섰다.', 'good');
    return;
  }
  if (it.kind === 'relic') {
    // Leave it lying there if the swap screen is refused, so the
    // choice can be walked away from and come back to.
    if (!takeRelic(it.id) && G.screen !== 'relic') return;
    G.items.splice(i, 1);
    return;
  }
  /* Gold and keys go nowhere near the pack, so they are always
     takeable. Everything else has to have a slot waiting before
     the floor gives it up. */
  if (it.kind !== 'gold' && it.kind !== 'key' && !packRoom(p, it)) {
    say(`배낭이 가득 찼다 — ${nameOf(it)}은(는) 발밑에 그대로 있다.`, 'warn');
    return;
  }
  G.items.splice(i, 1);
  if (it.kind === 'gold') { const g = goldGain(it.amount); p.gold += g; say(`금화 ${g}닢.`, 'good'); return; }
  if (it.kind === 'key')  { p.keys++; say(`녹슨 열쇠를 주웠다. (${p.keys})`, 'good'); return; }
  // 서기의 깃펜 names it in your hand, before you have to bet on it.
  if (hasRelic('quill') || hasRelic('ledger')) identify(it.id, true);
  /* 지능 reads labels. A clever hero names roughly half of what
     they pick up on sight; a dull one names nothing and has to
     drink it to find out, which is exactly the gamble the
     unidentified flask is for. */
  else if (it.kind === 'use' && !isKnown(it.id)
           && Math.random() < clamp(statB(p, 'int') * 0.12, 0, 0.7)) {
    identify(it.id, true);
    say(`글자를 읽어냈다 — ${nameOf(it)}.`, 'good');
  }
  // 내려놓은 묶음은 묶음째 돌아온다 — 화살 스무 발을 놓고 다시
  // 주웠더니 한 발이 되던 자리다.
  addItem(p, it, it.qty || 1);
  /* 초월 does not get a line in the log — it gets the screen.
     This is the rarest thing that can happen to a run and the
     player should not have to read four words to notice it. */
  if (it.boon) {
    const b = boonById(it.boon);
    G.transFound = (G.transFound || 0) + 1;
    fx({ t:'transcend', x:p.x, y:p.y });
    say(`— 초월. ${affixName(it)}.`, 'level');
    say(b.t, 'level');
    return;
  }
  /* 그 아래 등급들도 로그 한 줄로 흘려보내지 않는다. 「희귀」부터는
     화면이 멈춘다 — 판에 서너 번뿐인 일이고, 그때 무엇을 얻었는지
     읽지 않고 지나가면 그건 득템이 아니라 알림이다.
     초월은 위에서 이미 제 화면을 가져갔다. */
  const grade = rarityOf(it);
  if (grade >= 2) {
    G.rareFound = (G.rareFound || 0) + 1;
    fx({ t:'found', x:p.x, y:p.y, rar:grade });
    lore(RARITY[grade].n, affixName(it), itemBlurb(it), it.spr);
  }
  say(`${nameOf(it)}을(를) 주웠다.`, grade >= 2 ? 'level' : 'good');
}

/* 주운 것이 무엇인지 한 문단으로. 카드에 「사용 가능」만 뜨면 카드를
   띄운 의미가 없다 — 멈춰 세웠으면 멈출 값을 줘야 한다. */
function itemBlurb(it) {
  const bits = [];
  if (it.kind === 'weapon') bits.push(`${WEAPON_TYPES[it.t]?.n || '무기'} · ${it.dice[0]}d${it.dice[1]}${it.hands === 2 ? ' · 양손' : ''}`);
  if (it.kind === 'armour') bits.push(`방어 +${it.ac}`);
  if (it.plus) bits.push(`+${it.plus}`);
  for (const table of [PREFIXES, SUFFIXES]) {
    const a = table.find(x => x.id === (table === PREFIXES ? it.pre : it.suf));
    if (a) bits.push(`${a.n} — ${a.t || ''}`.trim());
  }
  for (const g of (it.engrave || [])) {
    const e = ENGRAVINGS.find(x => x.id === g);
    if (e) bits.push(`${e.n} — ${e.t}`);
  }
  if (isCursed(it)) bits.push('저주받았다. 벗을 수 없다.');
  return bits.join('\n');
}

/* ── the furniture ────────────────────────────────────────
   Five things that stand in rooms. Walking into one is the whole
   interface — there is no "use" verb, because a game where you
   have to remember a verb is a game where nobody touches the
   scenery. Each one answers a different question:

     통  — what is inside? (loot, and sometimes a face)
     화로 — light, at the price of standing next to fire
     기둥 — masonry you have to walk around, or break through
     뼈무더기 — free bones, and whatever was sleeping under them
     항아리 — the only one that is purely a gamble

   A prop takes two or three blows because a single tap would make
   them scenery you clear rather than scenery you decide about. */
/* 여기 열쇠가 빠지면 「undefined이(가) 삐걱인다」가 나간다. 좌판과
   우물이 그렇게 빠져 있었다 — 표는 가구가 늘 때 같이 늘지 않는다. */
export const PROP_NAME = {
  barrel:'낡은 통', brazier:'화로', pillar:'무너진 기둥',
  bones:'뼈 무더기', urn:'봉인된 항아리',
  stall:'좌판', well:'마른 우물',
};

/* Returns whether the bump cost a turn. */
function bumpProp(x, y) {
  const p = G.player, L = G.level, i = idx(x, y);
  const o = propAt(L, x, y);
  if (!o) return false;

  /* A brazier is not broken, it is lit. Standing next to one is
     worth more than the oil it saves, and it never has to be
     hit at all. */
  if (o.kind === 'brazier' && !o.lit) {
    o.lit = true;
    p.lightTurns = Math.min(oilCap(), p.lightTurns + 240);
    say('화로에 불을 옮겼다. 기름이 조금 아껴진다.', 'good');
    fx({ t:'forge', x, y });
    // Fire is bright, and bright carries. Four tiles, not the
    // whole room — waking a floor by accident is not a trade.
    for (const m of G.monsters)
      if (Math.hypot(m.x - x, m.y - y) <= 4) m.awake = true;
    return true;
  }
  // Bumping a fire that is already burning costs nothing. A wall
  // that eats turns is a wall you fight.
  if (o.kind === 'brazier') { say('이미 타고 있다.'); return false; }

  // Everything else gets hit.
  const force = 1 + Math.max(0, statB(p, 'str'));
  o.hp -= force;
  fx({ t:'hit', on:'monster', x, y, dmg:force, spr:'rubble' });
  if (o.hp > 0) { say(`${PROP_NAME[o.kind]}이(가) 삐걱인다.`); return true; }

  L.tiles[i] = FLOOR;
  L.props.delete(i);
  fx({ t:'salvage', x, y });
  G.smashed = (G.smashed || 0) + 1;

  switch (o.kind) {
    case 'barrel': {
      // A barrel is a chest without a lock and without a lid, so
      // it is also the cheapest place to hide a mimic.
      if (Math.random() < 0.10 + G.depth * 0.012) {
        const mim = mimicFor(G.depth);
        G.monsters.push({ ...mim, maxhp:mim.hp, x, y, awake:true, energy:0 });
        say('통 속에서 이빨이 나왔다.', 'bad');
        fx({ t:'reveal', x, y });
        break;
      }
      say('통이 부서졌다.', 'good');
      dropFromProp(x, y, 0.55);
      break;
    }
    case 'pillar':
      say('기둥이 무너졌다. 길이 열렸다.', 'good');
      // Rubble is loud enough to be heard across a room.
      for (const m of G.monsters)
        if (Math.hypot(m.x - x, m.y - y) <= 9) m.awake = true;
      fx({ t:'noise', x, y, r:9 });
      break;
    case 'bones':
      // Something is usually under a pile of bones.
      if (Math.random() < 0.35) {
        const m = pickMonster(G.depth);
        if (m) {
          const one = { ...scaleMonster(m, G.depth), x, y, awake:true, energy:0 };
          one.maxhp = one.hp;
          G.monsters.push(one);
          say(`뼈 무더기 아래에서 ${one.n}이(가) 일어났다.`, 'bad');
          break;
        }
      }
      say('뼈가 흩어졌다.', 'good');
      dropFromProp(x, y, 0.35);
      break;
    case 'urn': {
      /* The only pure gamble in the furniture. A third of them
         are worth breaking, a fifth of them bite. */
      const r = Math.random();
      if (r < 0.20) {
        const dmg = hurtPlayer(roll(2, 4 + Math.floor(G.depth * 0.8)));
        say(`항아리에서 검은 것이 터져 나왔다. ${dmg}의 피해.`, 'bad');
        fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, severe: dmg >= p.maxhp * 0.18 });
        afflict(p, 'poison', 10 + rnd(8));
        if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'봉인된 항아리' }); }
      } else if (r < 0.55) {
        say('항아리는 비어 있었다.');
      } else {
        say('항아리에서 무언가가 굴러 나왔다.', 'level');
        dropFromProp(x, y, 1, true);
      }
      break;
    }
  }
  return true;
}

function dropFromProp(x, y, chance, good) {
  if (Math.random() > chance) return;
  const spot = itemAt(x, y) ? G.level.randomFloor(q => itemAt(q.x, q.y)) : { x, y };
  if (!spot) return;
  if (!good && Math.random() < 0.45) {
    G.items.push({ kind:'gold', spr:'gold', n:'금화',
      amount: Math.round((20 + rnd(30 + G.depth * 22)) * (G.branch?.gold || 1)),
      x: spot.x, y: spot.y });
    return;
  }
  const item = pickItem(G.depth + (good ? 2 : 0));
  if (item) G.items.push({ ...item, x: spot.x, y: spot.y });
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
      const hasPicks = !!p.pack.find(s => s.item.id === 'picks');
      const pick = clamp(
        0.10 + statB(p, 'dex') * 0.06 + lockBonus(p) + p.lv * 0.008
        + (hasPicks ? 0.28 : 0), 0.04, 0.92);
      if (hasPicks) wearPicks();
      if (Math.random() < pick) {
        chest.locked = false;
        say(hasPicks ? '갈고리가 걸리고, 자물쇠가 딸깍 열렸다.' : '자물쇠가 딸깍 열렸다.', 'good');
      } else {
        /* A lid that will not lift gets levered. It opens, but a
           lever through a lock goes through whatever the lock was
           protecting — which is what a key is worth, and it is a
           cost that can never wall off a floor the way a jammed
           door would. */
        chest.locked = false;
        say('자물쇠가 버틴다 — 지렛대를 걸었다.', 'warn');
        fx({ t:'door', x:chest.x, y:chest.y, state:'broken' });
        rouse(chest.x, chest.y, 9, 0.7);
        if (chest.loot?.length && Math.random() < CHEST_RUIN) {
          const gone = chest.loot.splice(rnd(chest.loot.length), 1)[0];
          say(`${gone.n}이(가) 지렛대에 부서졌다.`, 'bad');
          fx({ t:'shatter', x:chest.x, y:chest.y });
        }
        chest.gold = Math.round(chest.gold * 0.8);
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
export { fitsOf, fitRule, FITS, oddityOf, UNIQUES, ODDITIES };
export const weaponType = p => p.equip.weapon?.t || 'sword';
export const weaponReach = p => (weaponType(p) === 'spear' ? 2 : 1);

/* Called once per player turn. A dagger swings twice; everything
   else swings once and lets its own rule fire inside. */
function playerAttack(m) {
  const p = G.player;
  if (!p.swinging && weaponType(p) === 'dagger') {
    p.swinging = true;
    swing(m, 0.62);
    // 도적의 날: the streak counter is already at two after the
    // first thrust, so the guaranteed crit lands on the second
    // rather than a turn later.
    if (fitRule(p, 'thirdAtTwo') && p.chain3 === 2) p.chain3 = 3;
    // The second thrust only lands if there is still something
    // in front of you — which is why a dagger wants 처형.
    if (G.running && G.monsters.includes(m)) swing(m, 0.62);
    p.swinging = false;
    return;
  }
  // A bow up close is a stick. That is the price of reach, and it
  // is what stops a bow from being a free extra button on a build
  // that never wanted to stand back.
  swing(m, weaponType(p) === 'bow' && !fitRule(p, 'bowButt') ? BOW_MELEE : 1);
}

/* ── shooting ─────────────────────────────────────────────
   The other half of a fight the player could only ever walk into.
   A shot costs a turn and an arrow, falls off with distance, and
   needs a clear line — everything a monster's shot already costs
   it, read off the same helpers. */
/* What is on the hip right now. Arrows stopped being a count
   this patch: the quiver is a worn item and a bow with one is
   simply a better bow, so nothing here can run out mid-floor. */
export function quiver(p) {
  return (p || G.player)?.equip?.quiver || null;
}

export function shotTarget() {
  const p = G.player, L = G.level;
  if (!p || weaponType(p) !== 'bow') return null;
  const rng = bowRange(p);
  return G.monsters
    .filter(m => !m.disguise && L.vis[idx(m.x, m.y)]
              && Math.hypot(m.x - p.x, m.y - p.y) <= rng
              && lineClear(L, p.x, p.y, m.x, m.y))
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] || null;
}

/* How far this bow reaches in these hands. 긴 눈 is the only
   thing that moves it, and every reader goes through here. */
export const bowRange = p =>
  (p?.equip?.weapon?.rng || 5) + (quiver(p)?.rng || 0) + (fitRule(p, 'farEye') ? 2 : 0);

export const canShoot = () => !!shotTarget();

/* One arrow leaving the string, wherever it was told to go. Both
   the plain shot and every ranger art land here, so ammunition,
   falloff, poison and the ember can never be right in one place
   and wrong in another. `scale` is the art's multiplier; `sure`
   skips the roll for the arts that promise they cannot miss. */
/* 화살은 떨어지지 않는다. 화살통은 소모품이 아니라 장비 한 칸이고,
   무엇을 끼웠는가가 「몇 발 남았는가」를 대신한다 — 세는 자원이 하나
   더 붙으면 활은 「쏠까 말까」가 아니라 「아껴 둘까」가 된다.
   예전 설계의 잔해가 세 군데 남아 있었다: 기술의 a.ammo 게이트 둘과,
   **어디에도 정의된 적 없는** spendArrows() 호출 하나. 화살값이 붙은
   기술이 하나라도 생기는 날 그 줄은 ReferenceError로 터졌을 것이다. */
function loose(m, scale = 1, opt = {}) {
  const p = G.player;
  G.act = 'shoot';
  const a = quiver(p) || QUIVERS[0];
  const dist = Math.hypot(m.x - p.x, m.y - p.y);
  const g = gearBonus(p);
  m.awake = true;
  if (!opt.quietFx) fx({ t:'loose', fx:p.x, fy:p.y, tx:m.x, ty:m.y, ammo:a.id });

  if (!opt.sure) {
    const hit = 12 + statB(p, 'dex') * 3 + Math.floor(p.lv * 0.8) + g.hit + (a.hit || 0)
              + (p.blessed > 0 ? 6 : 0);
    const land = clamp(0.32 + (hit - (m.ac || 0) * 1.6) / 46, 0.15, 0.95);
    if (Math.random() > land) {
      say(`${pickLine(MISS_AT, m.n, nextLine())}`);
      fx({ t:'miss', x:m.x, y:m.y });
      return false;
    }
  }
  /* Landed. The mark goes on before the damage is priced, exactly
     as it does for a swing, so a shot benefits from the stack it
     just placed. */
  markTarget(m);
  const d = p.equip.weapon?.dice || [1, 4];
  let dmg = roll(d[0], d[1]) + statB(p, 'dex') * 2 + Math.floor(p.lv / 3) + g.dmg;
  dmg *= (1 + g.dmgPct) * (a.dmg || 1) * scale * markMult();
  // 부러뜨리는 손: the aim is still bad. What lands, lands twice.
  if (oddAwake('breakhand')) dmg *= 2;
  // Reach is not free — except where an art has bought it.
  if (!opt.sure) dmg *= Math.max(0.55, 1 - dist * (BOW_FALLOFF + (a.falloff || 0)));
  dmg = Math.max(1, Math.round(dmg));

  // hurtMonster narrates off opt.weapon; saying it here too printed
  // every shot twice, once as an arrow and once as a shove.
  hurtMonster(m, dmg, null, { weapon:'arrow', shot:true, burst: a.burst || 0 });
  if (a.on && G.monsters.includes(m) && Math.random() < 0.6) poisonMonster(m, a.on);
  /* 미늘 화살촉. Not poison and not damage — the head stays in,
     and the thing wearing it arrives a turn later than it meant
     to. The one quiver that answers being closed on. */
  if (a.bleed && G.monsters.includes(m)) m.energy = (m.energy || 0) - 0.5;
  return true;
}

export function shoot() {
  const p = G.player;
  if (weaponType(p) !== 'bow') { say('활이 없다.', 'warn'); return; }
  const m = shotTarget();
  if (!m) { say('겨눌 것이 없다.', 'warn'); return; }
  if (has(p, 'paralyze')) {
    say('몸이 굳어 말을 듣지 않는다.', 'warn');
    fx({ t:'struggle', x:p.x, y:p.y }); endTurn(); return;
  }
  /* ── 물러서며 쏜다 ────────────────────────────────────
     레인저의 지시는 「거리를 두고 잡아라」인데, 이 게임의 모든 것은
     너와 같은 속도로 걷는다 — 즉 거리를 **만들** 방법이 없었다.
     재 보니 판당 근접 87번, 사격 48번. 활잡이가 판의 대부분을
     활로 두들겨 패고 있었고, 그래서 사냥꾼의 몫(두 칸 밖 처치)도
     표적 누적도 거의 켜지지 않았다.

     붙은 것에게 쏘면 한 발 물러난다. 뒤가 막혔으면 못 물러난다 —
     구석에 몰리는 것은 여전히 벌이다. 기술이 아니라 기본 사격에
     붙인다: 8레벨에 열리는 덫으로는 1층부터 12층까지의 문제를
     풀 수 없다. */
  if (p.cls === 'ranger' && Math.hypot(m.x - p.x, m.y - p.y) <= 1.5) {
    const bx = p.x - Math.sign(m.x - p.x), by = p.y - Math.sign(m.y - p.y);
    if (!G.level.solid(bx, by) && !monsterAt(bx, by)
        && G.level.tiles[idx(bx, by)] !== WEB) {
      p.x = bx; p.y = by;
      refreshFov();
      say('한 발 물러서며 시위를 놓았다.', 'good');
      fx({ t:'dodge', x:p.x, y:p.y });
    }
  }
  G.hushShot = true;
  loose(m, 1);
  /* 두 번 우는 활: a second arrow at half, out of the same nock.
     One arrow spent, two in the air. */
  if (hasUnique('twicewept') && G.monsters.includes(m)) loose(m, 0.5, { quietFx: true });
  G.hushShot = false;
  endTurn();
}

/* `opt` carries the handful of things an art needs the blow to do
   differently. It returns whether the blow landed — 연타 needs to
   know, and nothing else in the file did until now. */
function swing(m, scale, opt = {}) {
  const p = G.player;
  G.act = 'fight';

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
    if (!G.running) return false;
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
  /* 불이 꺼지면 반경만 줄어드는 것이 아니라 손도 무뎌진다. 두 칸
     앞이 벽인지도 모르는 자리에서 정확히 때릴 수는 없다. 잠든 것은
     예외 — 어둠 속에서 자는 것을 찾아낸 것은 오히려 공이다. */
  const blind = G.depth > 0 && p.lightTurns <= 0 && !hasRelic('nighteye');
  const chance = asleep ? 1
    : clamp((0.44 + (toHit(p) * aim - armour) / 55) * (blind ? DARK_AIM : 1), 0.14, 0.95);
  if (Math.random() > chance) {
    say(pickLine(MISS_AT, m.n, nextLine()));
    fx({ t:'miss', x:m.x, y:m.y });
    p.chain3 = 0;              // 세 번째 손: a miss resets the count
    return false;
  }

  /* 세 번째 손 (전사). Three landed blows on the same body and
     the third one goes through the armour. Same target only —
     a warrior who dances between three enemies never gets it,
     which is the whole instruction the trait is giving. */
  if (p.cls === 'warrior') {
    p.chain3 = (p.chainOn === m ? (p.chain3 || 0) : 0) + 1;
    p.chainOn = m;
  }
  /* 표적 (레인저). The opposite instruction: stay on one thing
     and it gets worse for it, 9% at a time. */
  markTarget(m);

  const w = p.equip.weapon;
  const dice = w ? w.dice : [1, 3];
  const g = gp;
  let dmg = roll(dice[0], dice[1]) + statB(p, 'str') * 2 + Math.floor(p.lv / 3) + g.dmg;
  dmg *= (1 + g.dmgPct + (p.might > 0 ? 0.6 : 0));
  dmg *= scale;
  if (kind === 'great') dmg *= 1.45;

  // 낙인: sharpened against the things that telegraph, blunted
  // against everything else.
  if (hasRelic('brand')) dmg *= (m.elite?.length || m.boss) ? 1.5 : 0.85;
  // 진노의: the same idea without the downside, which is what
  // makes a 은총 a 은총 and not an affix.
  if (hasBoon('wrath') && (m.elite?.length || m.boss || m.named)) dmg *= 1.35;
  // 재를 세는 자: one notch per body, and the notches are this
  // floor's only. The knife counts, not you.
  if (hasUnique('ashcount')) dmg += (G.ashCount || 0);
  // 화로에서 꺼낸 것: it wakes up as you run out.
  if (hasUnique('emberpull')) dmg *= 1 + (1 - p.hp / Math.max(1, p.maxhp)) * 1.2;
  /* 사제의 무게: a mace in the right hands against the things
     that should already be still. Read off the sprite rather than
     a hand-kept list, so a new undead is covered the day it is
     written. */
  if (fitRule(p, 'vsUndead') && UNDEAD.includes(m.spr)) dmg *= 1.4;
  // 결전의 각인: the same idea, cut into the blade rather than worn.
  if (g.vsElite && (m.elite?.length || m.boss || m.named)) dmg *= 1 + g.vsElite;
  // 사냥의 각인: only the blow that opens the wound.
  if (g.firstStrike && m.hp >= m.maxhp) dmg *= 1 + g.firstStrike;

  dmg *= markMult();

  /* The two traits that decide a crit outright, rather than
     nudging the roll. Both are earned by a rule the player can
     see filling in the HUD. */
  /* The rogue used to be the second line here: a swing spent
     p.shadow for a guaranteed crit. That is what made the shade a
     blinking light rather than a resource — it was banked and
     burned by the same button you press anyway. */
  const forced = (p.cls === 'warrior' && (p.chain3 || 0) >= 3);
  if (forced) { p.chain3 = 0; say('세 번째 손 — 급소가 열렸다.', 'level'); }
  const crit = asleep || forced
    || Math.random() < critChance(p) + (kind === 'dagger' ? 0.08 : 0);
  if (crit) dmg *= critMult(p) * (asleep ? 1.5 : 1);
  dmg = Math.max(1, Math.round(dmg * comboMult()));

  /* 절단. One crit in forty becomes something else entirely: the
     swing that people screenshot. Deliberately not a stat you can
     build for — it rides on the crit you already earned, so the
     build that crits often sees it often, and nobody sees it on
     purpose. */
  let perfect = false;
  if (crit && !m.boss && Math.random() < PERFECT_CHANCE) {
    perfect = true;
    G.perfects = (G.perfects || 0) + 1;
    dmg = Math.round(dmg * 3.2);
    say(`— 절단. ${m.n}이(가) 두 동강 났다.`, 'level');
  }

  if (asleep) {
    say(`잠든 ${m.n}의 급소를 찔렀다.`, 'level');
    if (hasResonance('shadowstep')) G.hushUntil = G.turn + 1;
    /* A throat opened quietly pays for the next one — the loop
       어둠 되감기 closes. Not for an ambush the art manufactured
       itself, though: 그림자 도약 marks its target unaware for one
       blow, and on the bench that refunded the shade it had just
       spent. An art may borrow the ambush; it may not be paid. */
    if (!opt.noShade) gainShadow(1, 'ambush');
  }

  /* 처형: below the threshold nothing survives, so a suffix that
     looks small on paper decides whether a wounded troll gets one
     more turn to hit back. */
  const cut = g.execute + (hasResonance('tally') ? (G.tally || 0) * 0.01 : 0);
  if (cut > 0 && !m.boss && m.hp <= m.maxhp * cut) {
    say(`${m.n}을(를) 처형했다.`, 'level');
    /* Each one makes the next easier, for this floor only. The
       reset on descending is the whole balance: it snowballs
       inside a room and never carries. */
    if (hasResonance('tally')) {
      G.tally = (G.tally || 0) + 1;
      if (G.tally % 5 === 0) say(`셈이 ${G.tally}에 이르렀다 — 문턱 +${G.tally}%p.`, 'level');
    }
    fx({ t:'execute', x:m.x, y:m.y });
    hurtMonster(m, m.hp + 999, null, { crit: true, execute: true });
  } else {
    /* 파멸의: a crit takes a slice of the *maximum*, so the boon
       is worth exactly as much against a troll as the troll is
       big. It is the only damage in the game that does not care
       what your weapon is. */
    if (crit && hasBoon('ruin') && !m.boss)
      dmg += Math.max(1, Math.round(m.maxhp * 0.08));
    if (perfect) fx({ t:'perfect', x:m.x, y:m.y });
    hurtMonster(m, dmg, null, { crit, sneak: asleep, weapon: kind, perfect, ...opt });
    // 모르고 휘두른 것: the stick answers.
    if (oddAwake('blindswing') && G.monsters.includes(m)) {
      const bolt = Math.max(2, Math.round(4 + p.lv * 0.9));
      fx({ t:'beam', fx:p.x, fy:p.y, tx:m.x, ty:m.y, color:'P' });
      hurtMonster(m, bolt, '막대 끝', { weapon:'spell' });
    }
    // 못 박는 자: pinned. Negative energy is how this game spends
    // a monster's turn for it.
    if (hasUnique('nailer') && G.monsters.includes(m)) {
      m.energy = Math.min(m.energy, -1);
      fx({ t:'snared', x:m.x, y:m.y });
    }
  }
  if (!G.running) return true;

  drainLife(dmg * (crit ? 0.6 : 1));
  if (g.on) poisonMonster(m, g.on);
  weaponRule(kind, m, dmg, crit);

  /* 연쇄: the swing carries into one more body. This is the line
     that turns 작열 into a chain of detonations and 흡혈 into a
     way to out-heal a whole room. */
  chainOut(m, dmg, 0);

  /* 메아리의 종. Deliberately placed last, after 연쇄 and 흡혈,
     so the second swing runs the whole chain again — a long
     streak with the right two suffixes turns one tap into a
     room-clearing cascade. That is the absurd combination this
     relic exists to make possible. */
  if ((hasRelic('echo') || hasRelic('march')) && G.combo >= (hasRelic('march') ? relicVal('march') : relicVal('echo'))
      && G.monsters.includes(m) && !p.echoing) {
    p.echoing = true;
    fx({ t:'arc', fx:p.x, fy:p.y, tx:m.x, ty:m.y });
    say('종이 한 번 더 울렸다.', 'level');
    playerAttack(m);
    p.echoing = false;
  }
  return true;
}

/* 뱃사공의 동전 doubles it, 서기의 깃펜 shaves it. One funnel so
   the two can never be applied twice or missed once. */
export const goldGain = n => Math.max(0, Math.round(
  n * (SHACKLES[G.abyss || 0] || SHACKLES[0]).gold
    * (hasRelic('toll') || hasRelic('ledger') ? 2 : 1) * (hasRelic('quill') ? 0.75 : 1)
    * (hasBoon('hoard') ? 1.6 : 1)));

/* Relics that pay on a kill. 굶주린 칼날 is the aggression
   engine — it out-heals a room only if you keep killing — and
   뼈 목걸이 is the slow one, worth taking early or not at all. */
function onKill(m) {
  const p = G.player;
  /* 맹세 used to spend itself down on every kill, which meant
     the better the fight went the less he had — a class that
     decelerates when it is winning. It fills on a kill now, so a
     good swing pays for the next one. */
  if (p.cls === 'paladin') oathGain(OATH_PER_KILL);
  if (hasUnique('ashcount')) G.ashCount = (G.ashCount || 0) + 1;
  if (UNDEAD.includes(m.spr)) faithGain(FAITH_PER_UNDEAD);
  if ((hasRelic('hunger') || hasRelic('famine')) && p.hp < p.maxhp) {
    const base = hasRelic('famine') ? relicVal('famine') : relicVal('hunger');
    /* 굶주린 무리 multiplies the bite by the streak. Three in a
       row is three times the meal, ten is ten — and one blow
       taken halves the streak, so it is a build that has to keep
       moving and cannot stand and trade. */
    const mult = hasResonance('pack') ? Math.max(1, G.combo || 1) : 1;
    const got = Math.min(p.maxhp - p.hp, base * mult);
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

/* 연쇄: the swing carries into one more body — and with 피의
   톱니 lit, that body's blow carries into the next. This one
   recursion is the whole experiment: everything else in the build
   adds into a sum and is spent once, so nothing in the game
   compounds. A branch does.

   The lifesteal was already riding along; what is new is that the
   branch can branch. */
function chainOut(m, dmg, depth) {
  const p = G.player, g = gearBonus(p);
  /* The first swing chains at whatever the build rolls. A rebound
     is priced by the resonance instead — pricing it off the base
     produced 0.07 extra hits per swing, which is not a cascade. */
  const saw = hasResonance('sawtooth');
  /* Lit, the first link is certain rather than a 0.30 roll —
     otherwise a cascade worth four hits is only ever worth 1.2,
     and the whole thing measures as a good weapon instead of as a
     run coming apart. */
  const odds = depth === 0 ? (saw && g.chain > 0 ? 1 : g.chain)
                           : CHAIN_ECHO * Math.pow(CHAIN_DECAY, depth - 1);
  if (!(odds > 0) || Math.random() >= odds) return;
  const near = adjacentMonsters(depth ? m : p).filter(o => o !== m);
  if (!near.length) return;
  const o = near[rnd(near.length)];
  const spill = Math.max(1, Math.round(dmg * (saw ? CHAIN_KEEP_RESO : CHAIN_KEEP)));
  fx({ t:'arc', fx:m.x, fy:m.y, tx:o.x, ty:o.y });
  hurtMonster(o, spill, '연쇄', {});
  drainLife(spill);
  if (saw && depth < CHAIN_MAX && G.monsters.includes(o))
    chainOut(o, spill, depth + 1);
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

/* A health bar cut into thirds, each third doing something the
   last one did not. Crossing a threshold is announced, changes
   what the thing is, and clears its cooldown so the new shape
   arrives immediately rather than three turns later.

   The loop is a `while` on purpose: one enormous hit can carry a
   boss through two thresholds at once, and skipping the middle
   phase would quietly skip its escort too. */
function enterPhase(m) {
  if (!m.phases?.length) return;
  const frac = m.hp / Math.max(1, m.maxhp || m.hp);
  while ((m.phase || 0) < m.phases.length && frac <= m.phases[m.phase || 0].at) {
    const ph = m.phases[m.phase || 0];
    m.phase = (m.phase || 0) + 1;
    Object.assign(m, ph.set || {});
    for (const [k, v] of Object.entries(ph.add || {})) m[k] = (m[k] || 0) + v;
    m.cooling = 0; m.wind = 0; m.awake = true;
    say(`${m.n} — ${ph.n}`, 'hit');
    if (ph.say) say(ph.say, 'warn');
    fx({ t:'wake', x:m.x, y:m.y });
    fx({ t:'burst', x:m.x, y:m.y, r:2.4, color:'o' });
    fx({ t:'telegraph', urgent:true });
    /* The threshold itself is an attack: the floor goes out from
       under you the moment the bar crosses, so the punish for
       standing on top of it while burst-damaging is real. */
    if (ph.ring) castPattern(m, ph.ring);
    if (ph.summon) spawnNear(null, ph.summon, false);
  }
}

export function hurtMonster(m, dmg, source, opt = {}) {
  // 파문: a named thing stays named until it is down.
  if (m.cursed) dmg = Math.round(dmg * (1 + ANATHEMA_MORE));
  m.awake = true;
  /* You started it. From here it follows.

     Not friendly fire, though: a named thing that happens to be
     standing in another elite's 불길 has not been picked on, and
     an ogre that starts hunting you because two monsters splashed
     each other would make the leash a lie in exactly the case the
     player could not see coming. */
  if (m.named && !opt.crossfire) m.provoked = true;
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
  if (m.hp > 0) enterPhase(m);
  const via = source ? `${source}이(가) ` : '';

  if (m.hp <= 0) {
    /* Overkill is measured against what was actually left, so a
       finishing tap on a sliver stays quiet and a hit that erases
       a full-health troll gets the whole fireworks budget. */
    const over = clamp(-m.hp / Math.max(1, before), 0, 3);
    /* 약속: what spilled past the kill comes back. A weapon that
       rewards hitting far harder than you needed to, which is the
       opposite of every efficiency instinct the game teaches. */
    if (hasUnique('promise') && m.hp < 0) {
      const back = Math.min(G.player.maxhp - G.player.hp, Math.round(-m.hp));
      if (back > 0) {
        G.player.hp += back;
        fx({ t:'heal', x:G.player.x, y:G.player.y, amt:back });
        say(`넘친 것이 돌아왔다. 체력 +${back}.`, 'good');
      }
    }
    G.monsters.splice(G.monsters.indexOf(m), 1);
    bumpCombo(m.x, m.y);

    /* 작열: the corpse goes off. Chained kills chain detonations,
       which is the whole point of stacking it with 연쇄. */
    const g = gearBonus(G.player);
    /* 화약고 takes the guard off: a corpse that goes off can set
       off the next one. The depth cap is the only thing between
       this and a room clearing itself, and it is the reason the
       resonance needs a kill to start — losing never lights it. */
    /* The depth cap alone is not enough: a detonation catches up
       to eight bodies and each of those detonates in turn, so four
       deep is eight-to-the-fourth in the worst case. The budget is
       counted per player action rather than per chain, so one
       swing can set off at most POWDER_BUDGET explosions no matter
       how they branch. */
    const room = hasResonance('powder');
    if (room && (opt.blast || 0) === 0) G.powderSpent = 0;
    /* The gear's 작열 and an ember arrow are the same rule from
       two pockets. Reading only the gear meant an ember arrow
       carried a `burst` field that nothing ever looked at. */
    const burstRate = g.burst + (opt.burst || 0);
    if (burstRate > 0 && (room ? ((opt.blast || 0) < POWDER_MAX
                                && (G.powderSpent || 0) < POWDER_BUDGET)
                             : !opt.noBurst)) {
      /* Normally a corpse goes off for a share of what it was, so
         a room of weak things makes weak bangs and 작열 does
         nothing for a build that has outgrown the floor. 화약고
         loads the killing blow into the corpse instead: the
         explosion is worth whatever your swing was worth, which
         is what makes the second one able to kill and the third
         one able to happen at all. */
      const charge = room ? Math.max(m.maxhp || 10, dmg) : (m.maxhp || 10);
      const blast = Math.max(2, Math.round(charge * burstRate * (room ? 0.7 : 0.5)));
      const caught = adjacentMonsters(m);
      if (caught.length) {
        fx({ t:'burst', x:m.x, y:m.y, r: room ? 2.4 : 1.9, color:'o' });
        if (room) G.powderSpent = (G.powderSpent || 0) + 1;
        for (const o of caught)
          hurtMonster(o, blast, '폭발', room ? { blast: (opt.blast || 0) + 1 } : { noBurst: true });
      }
    }
    fx({ t:'kill', x:m.x, y:m.y, spr:m.spr, dmg, crit:!!opt.crit, over, boss:!!m.boss, combo:G.combo });
    G.kills = (G.kills || 0) + 1;
    quarry(m);
    /* One more body in the ledger. The count is what buys the
       tells — a monster you have met is in the codex, a monster
       you have killed five of tells you how it fights. */
    if (Meta.slew(m.n) === tellsNeeded(Meta.read()))
      say(`${m.n}의 버릇이 눈에 익었다 — 도감에 적힌다.`, 'level');
    say(`${pickLine(FELLED, m.n, nextLine())}. (+${m.xp} 경험치)`, 'good');
    if (m.thief) {
      const who = G.player;
      const purse = thiefPurse(G.depth);
      who.gold += goldGain(purse.gold);
      who.mats = who.mats || { scrap: 0, dust: 0, essence: 0 };
      for (const k of ['scrap', 'dust', 'essence']) who.mats[k] += purse[k] || 0;
      say(`자루가 터졌다 — 금화 ${goldGain(purse.gold)}닢과 재료가 쏟아진다.`, 'level');
      fx({ t:'altar', x:m.x, y:m.y, result:'대성공' });
    }
    if (m.named) {
      const id = unownedRelic();
      if (id) {
        G.items.push({ kind:'relic', id, spr: relicById(id).spr, n: relicById(id).n, x:m.x, y:m.y });
        say(`${relicById(id).n}이(가) 남았다.`, 'level');
        fx({ t:'drop', x:m.x, y:m.y, relic:true, rar:3 });
      }
      dropElite(m);
    } else if (m.elite?.length) dropElite(m);
    onKill(m);
    gainXp(Math.round(m.xp * (G.branch?.xp || 1) * uproarMult()));
    /* 소란이 붙어 있을 때만 시체에서 더 나온다. 경험치만 부풀리면
       보상이 레벨업까지 미뤄지고, 미뤄진 보상은 위험을 살 이유가
       되지 못한다 — 걸었으면 그 자리에서 받아야 건 것 같다. */
    const spoil = Math.round(m.xp * 2.2 * (uproarMult() - 1));
    if (spoil > 0) {
      const got = goldGain(spoil);
      G.player.gold += got;
      if (got >= 3) say(`소란 속에서 ${got}닢을 주웠다.`, 'good');
    }
    if (m.boss) victory();
  } else {
    fx({ t:'hit', on:'monster', x:m.x, y:m.y, dmg, crit:!!opt.crit, sneak:!!opt.sneak,
         weapon: opt.weapon, spr:m.spr });
    if (!opt.quiet) {
      const tag = opt.sneak ? ' 기습!' : opt.crit ? ' 치명타!' : '';
      /* The verb comes from the weapon and the swing from how much
         of the thing went. `via` is the odd case — a chain, a
         thorn, a burst — and it names itself, so it keeps the
         plain sentence rather than borrowing a sword's. */
      const line = opt.weapon
        ? `${via}${strikeLine(opt.weapon, m.n, dmg, m.maxhp || m.hp + dmg, nextLine())} (${dmg})`
        : `${via}${m.n}에게 ${dmg}의 피해.`;
      say(line + tag, opt.crit ? 'level' : 'hit');
    }
  }
}

/* Relics never repeat within a run — a second 뼈 목걸이 is not a
   choice, it is filler. */
export function unownedRelic() {
  const held = new Set(G.player?.relics || []);
  // Fused relics are never on a floor and never in a shop. The
  // fire is the only door.
  /* 전설(myth)은 8층 아래에서만 나오고, 나와도 넷 중 하나꼴이다.
     판을 바꾸는 물건이 첫 층에서 굴러다니면 그 판은 이미 끝난 것이다. */
  const pool = RELICS.filter(r => !held.has(r.id) && !r.fused
    && (!r.myth || G.depth >= 8));
  if (!pool.length) return null;
  for (let guard = 0; guard < 12; guard++) {
    const r = pool[rnd(pool.length)];
    if (!r.myth || Math.random() < 0.25) return r.id;
  }
  return pool.find(r => !r.myth)?.id || pool[0].id;
}

/* An elite always leaves something with a name on it — and one
   in five leaves the thing that changes the run instead. */
/* 바로 옆의 빈 칸. 같은 칸에 둘을 겹치면 하나가 영영 안 주워진다. */
function freeSpotNear(x, y) {
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
    const nx = x + dx, ny = y + dy;
    if (G.level.solid(nx, ny)) continue;
    if (G.items.some(o => o.x === nx && o.y === ny)) continue;
    return { x: nx, y: ny };
  }
  return null;
}

function dropElite(m) {
  const spot = { x: m.x, y: m.y };
  /* 소란이 클수록 좋은 것이 나온다. 위험을 산 값을 여기서 치른다 —
     경험치만 부풀리면 「많이 싸우면 레벨이 는다」는 당연한 소리지,
     걸었다는 느낌이 아니다. */
  /* 0.22였다. 유물은 이 게임에서 유일하게 규칙을 바꾸는 물건인데,
     한 판에 서넛 들고 끝나니 「고르는 물건」이 아니라 「가끔 줍는
     물건」이었다. 자리가 일곱까지 늘어나는 손을 채우려면 나오는
     쪽도 같이 늘어야 한다. */
  if (Math.random() < 0.34 * uproarMult()) {
    const id = unownedRelic();
    if (id) {
      G.items.push({ kind:'relic', id, spr: relicById(id).spr, n: relicById(id).n, ...spot });
      say(`${relicById(id).n}이(가) 굴러떨어졌다.`, 'level');
      fx({ t:'drop', x: spot.x, y: spot.y, relic:true, rar:3 });
      /* 대박. 아주 드물게 둘이 나온다 — 유물 자리가 일곱까지 늘어나는
         판에서, 한 번에 둘은 그 판의 방향을 정해 버린다. */
      if (Math.random() < JACKPOT.relic) {
        const two = unownedRelic();
        const at = freeSpotNear(spot.x, spot.y);
        if (two && at) {
          G.items.push({ kind:'relic', id: two, spr: relicById(two).spr, n: relicById(two).n, ...at });
          say('— 하나가 아니었다.', 'level');
          fx({ t:'drop', x: at.x, y: at.y, relic:true, rar:4 });
        }
      }
      return;
    }
  }
  /* ── 셋을 남기고, 하나를 고르게 한다 ──────────────────
     여태 정예는 물건 하나를 떨어뜨렸다. 좋으면 끼우고 아니면
     지나치는데, 그건 결정이 아니라 통보다. 파밍이 재미없다는
     말의 절반이 여기 있었다.

     셋을 굴려 놓고 하나만 가져가게 하면, 나머지 둘이 값이 된다 —
     피해가 큰 것과 속성이 좋은 것 사이에서 고르는 순간이 곧
     「이 판을 어떻게 끌고 갈까」다. 굴림은 여기서 끝내 놓는다.
     화면을 열 때마다 다시 굴리면, 열었다 닫았다 하는 것이 수가
     된다 — 그건 고르는 게 아니라 재굴림이다. */
  const picks = [];
  for (let i = 0; i < SPOIL_PICKS; i++) {
    const it = pickItem(G.depth + 4);
    if (!it) continue;
    rollAffixes(it, G.depth + 8, true);
    if (Math.random() < 0.45) it.plus = 1 + rnd(2);
    /* 대박은 여기서도 열린다 — 셋 중 하나가 훨씬 깊은 곳의 물건일
       때가 있다. 자주 열리면 그건 대박이 아니라 기본값이다. */
    if (Math.random() < JACKPOT.spoil) {
      const deep = pickItem(G.depth + 20);
      if (deep) {
        rollAffixes(deep, G.depth + 30, true);
        deep.plus = 2 + rnd(3);
        picks.push(deep);
        continue;
      }
    }
    picks.push(it);
  }
  if (!picks.length) return;
  if (picks.length === 1) {
    G.items.push({ ...picks[0], ...spot });
    fx({ t:'drop', x: spot.x, y: spot.y, rar: rarityOf(picks[0]) });
    return;
  }
  const best = Math.max(...picks.map(rarityOf));
  G.items.push({ kind:'spoils', spr:'chest', n:'전리품 더미', picks, rar: best, ...spot });
  fx({ t:'drop', x: spot.x, y: spot.y, rar: best, pile:true });
}

function gainXp(n) {
  const p = G.player;
  p.xp += Math.round(n / RACES[p.race].xp);
  while (p.lv < MAX_LEVEL && p.xp >= xpToLevel(p.lv)) {
    p.lv++;
    const before = p.maxhp;
    recalc(p);
    p.hp += p.maxhp - before;
    p.mana = p.maxmana;
    /* A milestone level is announced as one, with the number the
       player actually gained — the point of moving growth into
       steps is lost if the steps are silent. */
    const gain = p.maxhp - before;
    const milestone = p.lv % 3 === 0;
    fx({ t:'levelup', x:p.x, y:p.y, big: milestone });
    say(milestone
      ? `레벨 ${p.lv}. 뼈가 굵어졌다 — 최대 체력 +${gain}.`
      : `레벨 ${p.lv}. 몸이 단단해진다. (체력 +${gain})`, 'level');
    const learned = spellList(p).filter(s => s.lv === p.lv);
    /* 주문은 `name`을 쓴다 — 물건만 `n`이다. 여기 한 줄이 `s.n`이라
       마법사·사제·성기사가 주문을 배울 때마다 「새 주문을 익혔다 —
       undefined」가 나가고 있었다. 판당 여덟 번씩. */
    for (const s of learned) say(`새 주문을 익혔다 — ${s.name}`, 'level');
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
  Meta.see('branches', branch.id);
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
  /* 한 턴이 무엇이었는지 여기 한 곳에서만 센다. 행동이 자기 이름을
     남기지 않았으면 그 턴은 걷기다. 콘텐츠가 몇 %나 닿는지는 이미
     쟀고(reach.mjs) 96%였다 — 그런데도 재미가 없었으니, 남은 질문은
     「무엇이 있는가」가 아니라 「무엇을 하며 시간을 보내는가」다.
     sim/turns.mjs가 이 한 줄만 읽는다. */
  const kind = G.act || 'walk';
  (G.did || (G.did = {}))[kind] = (G.did[kind] || 0) + 1;
  /* 걷기가 다 같은 걷기는 아니다. 스톤수프도 걷는 턴이 대부분이지만
     그 걷기는 「보이는 위협 앞에서의 걷기」다. 그래서 걷는 동안 적이
     하나라도 눈에 있었는지를 따로 센다 — 이 둘의 차이가 곧 긴장이다. */
  if (kind === 'walk' && G.level) {
    const watched = G.monsters.some(m => G.level.vis[idx(m.x, m.y)]);
    if (watched) G.did.walkSeen = (G.did.walkSeen || 0) + 1;
  }
  /* 빛도 같은 자리에서 센다. 「횃불이 있다」와 「횃불이 문다」는 다르고,
     후자는 어느 반경에서 얼마나 오래 있었는지로만 알 수 있다.
     sim/oil.mjs가 이 줄을 읽는다. */
  if (G.depth > 0) {
    const band = lightRadiusOf(p);
    (G.lit || (G.lit = {}))[band] = (G.lit[band] || 0) + 1;
    hint('near');
    stirUproar();
    /* 체력이 판 내내 어디에 있었는가. 「죽기 5턴 전에 68%」라는 것은
       판의 대부분을 멀쩡하게 걸었다는 뜻이고, 멀쩡하면 긴장이 없다.
       sim/tension.mjs가 이 줄을 읽는다. */
    const hpTenth = Math.min(9, Math.floor(Math.max(0, p.hp) / p.maxhp * 10));
    (G.hpBand || (G.hpBand = new Array(10).fill(0)))[hpTenth]++;
    G.floorTurns = G.floorTurns || {};
    G.floorTurns[G.depth] = (G.floorTurns[G.depth] || 0) + 1;
  }
  G.act = null;
  /* How long you have not moved. Cheap to keep and the only
     thing 소리 없는 강철 needs — armour that hides you while you
     hold still has to know when you are holding still. */
  if (p.x === p._wasX && p.y === p._wasY) p.stillFor = (p.stillFor || 0) + 1;
  else p.stillFor = 0;
  p._wasX = p.x; p._wasY = p.y;

  if (p.blessed > 0) p.blessed--;
  if (p.might > 0 && --p.might === 0) say('끓던 피가 식는다.');
  if (p.iron > 0 && --p.iron === 0) say('굳었던 살갗이 풀린다.');
  if (G.sanctum && --G.sanctum.left <= 0) { G.sanctum = null; say('빛이 스러졌다.'); }
  if (G.smoke && --G.smoke.left <= 0) { G.smoke = null; say('연기가 걷힌다.'); }
  if (p.martyr > 0 && --p.martyr === 0) {
    const owed = Math.round(p.martyrDebt || 0);
    p.martyrDebt = 0;
    if (owed > 0) {
      say(`빚이 한꺼번에 왔다. (−${owed})`, 'bad');
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg:owed, who:'순교', severe:true });
      p.hp -= owed;
      if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'스스로 진 빚' }); return; }
    } else say('일어섰다. 빚은 없었다.', 'good');
  }
  if (G.detectPulse > 0) G.detectPulse--;

  if (G.comboT > 0 && --G.comboT === 0) breakCombo(true);
  /* ── 무게 ────────────────────────────────────────────────
     스무 칸을 꽉 채워도 아무 일이 없었다. 그러면 줍는 것은 결정이
     아니라 습관이고, 파밍은 「보이면 줍는다」가 된다. 이제 짐이
     무거우면 숨이 늦게 돌아오고, 더 무거우면 손이 굼떠 기름이
     빨리 탄다 — 무엇을 버릴지가 수가 된다. */
  const loadRate = STAM_REGEN_EVERY * (packLoad(p) >= HEAVY_AT ? 2 : 1);
  if (G.turn % loadRate === 0 && p.stam < p.maxStam) p.stam++;

  if (G.depth > 0) {
    /* One upkeep resource, not two. Food and torches were the
       same countdown wearing different hats, and with 15 floors
       neither ever ran out — two numbers to babysit that decided
       nothing. Light survives because it is *spatial*: it changes
       how far you can see, which changes what you can fight. */
    /* Integer only. A fractional drain reads fine in a total and
       then quietly breaks every `lightTurns === 300` milestone and
       the torch chip, which counts whole turns. 굶주린 불 spends
       its extra thirty percent as three whole turns in every ten
       rather than as 0.3 of a turn each time. */
    /* 깊을수록 어둠이 짙다. 한 턴에 1을 태우던 시절, 판의 90%를
       가장 밝은 반경에서 보냈고 불이 꺼지는 판은 48판 중 1판이었다
       (sim/oil.mjs). 보급이 소모를 앞질렀다는 뜻이고, 그러면 그것은
       시계가 아니라 장식이다. 깊이로 태우면 초반은 그대로 관대하고
       후반에만 조여든다 — 위협이 커지는 곳에서 시야가 좁아진다. */
    if (!hasRelic('lamp'))
      p.lightTurns -= (G.branch?.drain || 1) * OIL_BURN(G.depth)
        * (packLoad(p) >= LADEN_AT ? 2 : 1)
        * (hasRelic('famine') ? 3 : hasRelic('hunger') ? 2 : 1)
        + (hasShackle('hunger') && G.turn % 10 < 3 ? 1 : 0);
    if (p.lightTurns === 640) say('불빛이 한 뼘 줄었다. 벽이 가까워진 것은 아니다.', 'warn');
    if (p.lightTurns === 360) say('기름이 절반쯤 남았다.', 'warn');
    if (p.lightTurns === 180) say('빛이 팔 길이만큼만 간다.', 'warn');
    if (p.lightTurns === 60)  say('불빛이 손바닥만큼 줄었다. 여기서부터는 듣고 걷는다.', 'warn');
    if (p.lightTurns === 0)   say('불이 꺼졌다. 두 칸 앞이 벽인지 아닌지도 모른다.', 'hit');
    if (p.lightTurns < 0) p.lightTurns = 0;
    G.floorTurn++;
    pressure();
  }

  tickAilments(p);
  if (!G.running) return;

  /* Natural recovery is the only healing that scales with the
     hero, and it was flat enough to be decorative: two points
     every fourteen turns against a hundred and fifty of health.
     Clearing a floor cost far more than the floor gave back, so
     runs ended by attrition on floor four or five regardless of
     how well any single fight went.

     This does bring resting-to-heal back as a tactic — which is
     exactly what the floor clock is there to price. The two
     systems check each other. */
  const regen = Math.max(0, 1 + Math.floor(p.lv / 4)
    + (p.race === 'halfTroll' ? 1 : 0) + gearBonus(p).regen);
  /* 체질 sets how often the body closes, not only how much it
     holds. 8 turns at 10 con, 5 at 18, 12 at 5 — a dumped
     constitution is felt between fights as well as inside one. */
  const beat = clamp(8 - statB(p, 'con'), 4, 14);
  /* Measured: a hundred turns of walking handed back forty to
     fifty percent of maximum health, at every level. A floor is
     one to two hundred turns, so clearing one was a free full
     heal and attrition stopped being a resource — the clock was
     the only pressure left in the game.

     The answer is not a smaller number. Making it smaller brings
     back the floor-four death spiral this was added to fix. What
     changes is its *character*: it is catching your breath, not
     medicine. So it does nothing while something is hitting you,
     and it closes a wound only so far. Past that line the wound
     is real and costs a flask, a fire, or a prayer — which is
     what those are for. */
  const rested = G.turn - (p.hurtAt ?? -99) >= BREATH;
  /* 여명의 맹세 takes the ceiling off. It is the whole payout of a
     build that adds nothing at all to what you hit for. */
  const roof = hasResonance('dawnoath') ? p.maxhp
             : Math.round(p.maxhp * breathRoof(p));
  if (rested && G.turn % beat === 0 && p.hp < roof)
    p.hp = Math.min(roof, p.hp + regen);
  // 응답: the priest closes on his own, twice as often as anyone,
  // and past the line everyone else stops at. That is the class.
  if (p.cls === 'priest' && rested && G.turn % 6 === 0 && p.hp < p.maxhp)
    p.hp = Math.min(p.maxhp, p.hp + Math.max(1, Math.round(regen * healScale())));
  if (G.turn % 10 === 0 && p.mana < p.maxmana) p.mana = Math.min(p.maxmana, p.mana + 1);

  /* 그림자, the slow way: time spent with nothing awake looking at
     you. The two fast ways (an ambush, a roll) are things you do;
     this is what pays the approach the stealth stat exists for. */
  if (p.cls === 'rogue' && G.turn % SHADOW_TICK === 0 && unseenByAll())
    gainShadow(1, 'quiet');

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
    say(`심연이 ${born === 1 ? '하나' : '둘'}을(를) 더 게워냈다. (${G.waves}번째)`, 'hit');
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
    fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, poison:true, who:'중독', spr:'potion' });
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

  /* A snare is spent by the thing that steps in it. Checked at the
     top of its turn rather than on the step, so a fast thing that
     moved twice is caught by the tile it stopped on. */
  if (G.snares?.length) {
    const i = G.snares.findIndex(s2 => s2.x === m.x && s2.y === m.y);
    if (i >= 0) {
      G.snares.splice(i, 1);
      m.energy = -SNARE_TURNS;
      m.awake = true;
      fx({ t:'snared', x:m.x, y:m.y });
      say(`${m.n}이(가) 덫에 걸렸다.`, 'good');
      return;
    }
  }

  if (m.poison > 0) {
    m.poison--;
    const tick = Math.max(1, Math.round((m.maxhp || 10) * 0.045));
    hurtMonster(m, tick, '독', { quiet: true });
    if (!G.monsters.includes(m)) return;
  }
  // 파문: nothing mends. Regen, drain and the troll's whole idea.
  if (m.regen && !m.cursed && m.hp < m.maxhp) m.hp = Math.min(m.maxhp, m.hp + m.regen);

  if (!m.awake) {
    if (!L.vis[idx(m.x, m.y)] || dist2 > 110) return;
    /* Noticing you is a roll per turn, not a certainty, so the
       long quiet approach is a strategy and not just flavour.
       Standing in water throws that away. */
      const wading = L.tiles[idx(p.x, p.y)] === WATER;
    const quiet = wading ? stealth(p) * 0.25 : stealth(p);
    // 전쟁 북 is loud: it hears you two tiles sooner.
    const reach = dist - (hasRelic('march') ? 3 : hasRelic('drum') ? 2 : 0);
    const notice = clamp((1 - quiet) * (0.62 - reach * 0.055), 0.02, 0.9);
    /* 그림자 걸음: a throat opened quietly does not announce
       itself. Nothing notices you on the turn you take a sleeping
       thing, so a room can be emptied one at a time — which is
       the only way that build ever wins a fight it did not pick. */
    if (G.hushUntil >= G.turn) return;
    if (Math.random() >= notice) return;
    m.awake = true;
    if (Meta.see('monsters', m.n) && m.lore) lore('처음 보는 것', m.n, m.lore, m.spr);
    if (m.disguise) return;              // a mimic that has noticed you keeps very still
    fx({ t:'wake', x:m.x, y:m.y });
  }

  // A mimic does nothing at all until it is touched.
  if (m.disguise) return;
  if (m.ai === 'still' && dist2 > 2) return;

  /* A named thing guards; it does not hunt the floor. The stairs
     screen promises "피해서 내려갈 수 있다" and that promise has to
     be true — a 185-health ogre that follows you across three
     rooms is a toll, not a decision.

     It holds a leash around where it was placed, walks back if it
     is dragged off it, and once you have hit it the leash is
     gone: pick the fight and it is a fight. Floor 6 was ending
     eighteen percent of runs before this. */
  /* 긴 그림자 takes the leash off. Same dungeon, read completely
     differently: the stairs screen stops being an offer and goes
     back to being a warning. */
  if (m.named && !m.provoked && !hasShackle('shadow')) {
    m.home ??= { x: m.x, y: m.y };
    const away = Math.hypot(m.x - m.home.x, m.y - m.home.y);
    const far  = Math.hypot(p.x - m.home.x, p.y - m.home.y);
    if (far > NAMED_LEASH) {
      // Out of its ground. Drift home, and let it forget.
      if (away > 0.9) { advance(m, Math.sign(m.home.x - m.x), Math.sign(m.home.y - m.y)); return; }
      m.awake = false;
      return;
    }
  }

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
  /* The thief runs from full health, which is what makes it a
     decision rather than a fight: you cannot walk it down, so
     catching it costs a roll, a spell or a scroll. */
  if (m.thief || ((m.ai === 'coward' || m.fleeing) && m.hp < m.maxhp * 0.35)) {
    if (!m.fleeing) { m.fleeing = true; say(`${m.n}이(가) 달아나기 시작한다.`); }
    if (retreat(m)) return;
    // Cornered: it stops, it does not turn and charge.
    if (m.thief) return;
  }

  /* ── 무엇을 보고 쫓는가 ────────────────────────────────
     여기까지 오는 동안 몬스터는 아무것도 보지 않고 쫓았다. 한 번
     깨면 시야와 무관하게 플레이어의 현재 좌표를 알았고, 그래서
     「물러선다」는 수가 존재할 수 없었다. 도망쳐도 정확히 따라오니
     공짜 매질만 받는 셈이었다.

     이제는 본 것만 안다. 그리고 무엇을 보느냐는 **네 횃불이 정한다**
     — L.vis는 「네 빛이 닿고 시선이 통하는 칸」이라, 그 칸에 선
     것만 너를 본다. 불을 끄면 놈들도 너를 잃는다. 횃불이 위협이자
     동시에 도구가 되는 지점이 여기다.

     이름 있는 것과 정예는 예외다. 그것은 네가 고른 싸움이고,
     고른 싸움에서 걸어 나갈 수 있으면 고른 것이 아니다. */
  const keen = m.named || m.boss || m.elite?.length;
  /* ── 그런데 어둠이 은신이 되어 버렸다 ────────────────────
     L.vis는 「네 빛이 닿는 칸」이다. 불이 꺼지면 그 칸이 반경 2로
     쪼그라들고, 그러면 세 칸 밖의 모든 것이 너를 잃는다 — 불을 끄는
     것이 이 게임에서 가장 싸고 확실한 은신이었다. 재 보니 턴의
     62%를 꺼진 채로 보내고 있었고, 그건 플레이어가 이상해서가
     아니라 그게 최적이어서였다.

     여기 사는 것들은 여기서 산다. 네 횃불이 꺼졌다고 눈이 머는 것은
     너지 놈들이 아니다. 불이 꺼져 있으면 놈들은 제 눈으로 본다 —
     시선이 통하고 DARK_SIGHT 안이면 계속 안다.

     불이 켜져 있을 때의 규칙은 그대로다: 서로 보이면 안다. 그래야
     「벽 뒤로 돌아 시야를 끊는다」는 후퇴가 남는다. 어둠은 이제
     후퇴의 수단이 아니라 후퇴해야 하는 이유다. */
  const dark = G.depth > 0 && p.lightTurns <= 0;
  const ownEyes = dark && dist <= DARK_SIGHT && lineClear(L, m.x, m.y, p.x, p.y);
  const sees = keen || dist <= 1.5 || ownEyes
            || (!dark && L.vis[idx(m.x, m.y)]);
  if (sees) { m.mark = { x: p.x, y: p.y }; m.lost = 0; }
  else {
    m.lost = (m.lost || 0) + 1;
    const at = m.mark && m.x === m.mark.x && m.y === m.mark.y;
    if (at || m.lost > TRACK_TURNS) {
      /* 자취가 끊겼다. 그렇다고 다시 재우면 층이 죽는다 — 한 번
         그렇게 했더니 판이 세 배로 길어지고 걷기 비중이 도로 올라갔다.
         잃은 것은 위치이지 관심이 아니다. 마지막 자리 근처를 헤매게
         두면, 네가 돌아오는 순간 다시 문다.

         아주 멀어진 것만 잠든다. 지도 반대편에서 영원히 서성이는
         것은 위협이 아니라 계산 낭비다. */
      if (m.mark) { G.lostMe = (G.lostMe || 0) + 1; if (dist < 9) hint('trail'); }
      m.mark = null;
      if (m.lost > TRACK_TURNS * 4 && dist > 14) { m.awake = false; m.lost = 0; return; }
      advance(m, rnd(3) - 1, rnd(3) - 1);
      return;
    }
  }

  const goal = sees ? p : (m.mark || p);
  let sx = Math.sign(goal.x - m.x), sy = Math.sign(goal.y - m.y);
  if (m.ai === 'erratic' && Math.random() < 0.45) { sx = rnd(3) - 1; sy = rnd(3) - 1; }
  advance(m, sx, sy);
}

/* 자취를 몇 턴이나 쫓는가. 짧으면 후퇴가 공짜가 되고, 길면
   후퇴가 없다. */
export const TRACK_TURNS = 6;

/* ── 어둠이 말해 주는 것 ──────────────────────────────────
   빛을 줄이면 보이는 것이 줄어든다. 그것만으로는 긴장이 아니라
   무지다 — 무엇이 있는지 짐작조차 못 하면 물러설 이유도 생기지
   않는다. 그래서 안 보이는 것을 글로 알린다. 위치는 주지 않고,
   수와 거리와 방향만.

   소리를 글로 옮기는 쪽을 골랐다: 이 게임의 로그는 이미 화면의
   절반이고, 새 장치를 만드는 것보다 있는 통로로 말하는 편이 낫다. */
const HINT_EVERY = 4;
function hint(kind) {
  if (G.turn - (G.hintAt || -99) < HINT_EVERY) return;
  const p = G.player, L = G.level;
  if (kind === 'trail') {
    G.hintAt = G.turn;
    say(pickOne(['무언가가 네 자리를 지나쳐 갔다.',
              '발소리가 멀어진다. 자취를 놓친 모양이다.',
              '숨소리가 갈라져 흩어졌다.']), 'good');
    return;
  }
  const unseen = G.monsters.filter(m => m.awake && !m.disguise
    && !L.vis[idx(m.x, m.y)] && Math.hypot(m.x - p.x, m.y - p.y) <= 8);
  if (!unseen.length) { G.near = 0; return; }
  const near = Math.min(...unseen.map(m => Math.hypot(m.x - p.x, m.y - p.y)));
  const closing = G.near && near < G.near - 0.4;
  G.near = near;
  G.hintAt = G.turn;
  G.did && (G.did.hinted = (G.did.hinted || 0) + 1);

  const many = unseen.length >= 3 ? '여럿' : unseen.length === 2 ? '둘' : '하나';
  if (near <= 2.5)
    say(pickOne([`바로 옆 어둠에서 숨소리가 난다. ${many}.`,
              `손이 닿을 거리에 무언가 있다. ${many}.`]), 'hit');
  else if (closing)
    say(pickOne([`소리가 가까워지고 있다. ${many}.`,
              `어둠 속에서 발이 빨라졌다. ${many}.`]), 'warn');
  else
    say(pickOne([`빛 밖에서 무언가 움직인다. ${many}.`,
              `어둠이 부스럭거린다. ${many}.`,
              `돌 위를 끄는 소리. ${many}.`]), 'warn');
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
    say(heavy ? `${m.n}의 내리친 일격이 바닥을 때렸다.`
              : pickLine(MISS_BY, m.n, nextLine()));
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  let dmg = Math.max(1, Math.round(
    (roll(2, Math.max(3, Math.floor(m.atk * 0.72))) - Math.floor(ac / 5))
    * (heavy ? 2.5 : 1) * (1 + (p.perm?.takeMore || 0))) - gearBonus(p).flatDR);
  dmg = sanctumSoak(dmg);
  dmg = hurtPlayer(dmg); faithForBlow(dmg);
  fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, from:{ x:m.x, y:m.y },
       who:m.n, spr:m.spr, severe: dmg >= p.maxhp * 0.18 });
  say(`${heavy ? '당겼던 것이 떨어졌다. ' : ''}${takenLine(m.n, dmg, p.maxhp, nextLine())} (${dmg})`, 'hit');
  if (m.drain && !m.cursed) {          // 흡혈하는: it heals off you
    const back = Math.max(1, Math.round(dmg * m.drain));
    m.hp = Math.min(m.maxhp, m.hp + back);
  }
  if (m.on && Math.random() < 0.28) afflict(p, m.on, 9 + rnd(9));
  corrode(m);
  reflect(m, dmg);
  if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death(m); }
}

/* 부식. The other end of the anvil: rarely, something that eats
   metal takes a level of enhancement back off you. Only the four
   things that should be able to do it can, and only on a landed
   blow, and never through 불괴의.

   A level, never the item — losing a +7 sword to a mould would
   be a story about quitting, not a story about the dungeon. */
const CORRODERS = ['회색 곰팡이', '푸른 젤리', '미라', '망령'];
function corrode(m) {
  const p = G.player;
  if (!CORRODERS.includes(m.n) || Math.random() >= CORRODE_CHANCE) return;
  const worn = GEAR_SLOTS
    .map(k => p.equip[k]).filter(it => it && (it.plus || 0) > 0 && it.boon !== 'aegis');
  if (!worn.length) return;
  const it = worn[rnd(worn.length)];
  it.plus--;
  recalc(p);
  say(`${m.n}이(가) 남긴 것이 ${affixName(it)}을(를) 갉아먹었다. 한 단계 잃었다.`, 'bad');
  fx({ t:'corrode', x:p.x, y:p.y });
}

/* 거울 방패. Deliberately placed after the damage is applied, so
   a reflected killing blow still trades — you both go down. */
function reflect(m, dmg) {
  if (!G.monsters.includes(m)) return;
  // 거울 방패 and 가시의 각인 stack — one funnel so they can never
  // be applied twice or missed once.
  const g = gearBonus(G.player);
  const rate = (hasRelic('mirror') ? relicVal('mirror') : 0) + g.reflect;
  if (rate <= 0) return;
  /* 가시밭 prices the thorn on what the armour *stopped* rather
     than on what got through, so the tankier the build the harder
     it bites back — and it goes past the thing's own armour,
     because a hand on a spike does not care how thick the glove
     is. Nothing at all happens if nobody is hitting you. */
  if (hasResonance('bramble')) {
    const stopped = g.flatDR + Math.round(armourClass(G.player) * 0.5);
    hurtMonster(m, Math.max(1, Math.round((dmg + stopped) * (rate + BRAMBLE_BITE))),
                hasRelic('mirror') ? '거울 방패' : '가시', { pierce: true });
    return;
  }
  hurtMonster(m, Math.max(1, Math.round(dmg * rate)),
              hasRelic('mirror') ? '거울 방패' : '가시');
}

function monsterShoot(m) {
  const p = G.player;
  const ac = armourClass(p);
  fx({ t:'shot', fx:m.x, fy:m.y, tx:p.x, ty:p.y, kind:m.spr });
  if (p.iframe > 0) { say('구르며 흘려보냈다.', 'good'); fx({ t:'miss', x:p.x, y:p.y }); return; }
  const chance = clamp(0.20 + (m.atk * 1.25 - ac * 1.6) / 62, 0.05, 0.80);
  if (Math.random() > chance) {
    say(`${m.n}이(가) 쏘았지만 빗나갔다.`);
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  const dmg = hurtPlayer(sanctumSoak(Math.max(1, roll(2, Math.max(3, Math.floor(m.atk * 0.6)))
    - Math.floor(ac / 6) - gearBonus(p).flatDR)));
  faithForBlow(dmg);
  fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, from:{ x:m.x, y:m.y },
       who:m.n, spr:m.spr, arrow:true, severe: dmg >= p.maxhp * 0.18 });
  say(`멀리서 날아왔다. ${takenLine(m.n, dmg, p.maxhp, nextLine())} (${dmg})`, 'hit');
  if (m.on && Math.random() < 0.22) afflict(p, m.on, 8 + rnd(8));
  reflect(m, dmg);
  if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death(m); }
}

/* Movement shared by every AI, including what to do about a
   shut door: most things are simply stopped by one. */
function advance(m, sx, sy) {
  const p = G.player, L = G.level;
  /* 성역: the things that should already be still cannot come to
     the stone. Everything else can — it is a ward, not a wall. */
  const s2 = G.sanctum;
  if (s2 && s2.left > 0 && UNDEAD.includes(m.spr)
      && Math.max(Math.abs(s2.x - m.x), Math.abs(s2.y - m.y)) <= 1) {
    const away = Math.hypot(m.x - s2.x, m.y - s2.y);
    if (away <= 1.5) { m.energy = Math.min(m.energy, 0); return; }
  }

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
  fx({ t:'telegraph', urgent: spec.warn <= 1 });
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
      const dmg = hurtPlayer(Math.max(1, Math.round((h.dmg - ac * 0.25) * (1 + (p.perm?.takeMore || 0)))));
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, who:PATTERNS[h.key].n, spr:'trap',
           low: p.hp <= p.maxhp * 0.25 && p.hp + dmg > p.maxhp * 0.25, severe:true });
      say(`${h.owner}의 ${PATTERNS[h.key].n}에 ${dmg}의 피해.`, 'hit');
      if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n: h.owner }); return; }
    }
  }
  // Everything else standing in it, including the caster's own.
  for (const m of [...G.monsters])
    if (hit.has(idx(m.x, m.y)) && !m.disguise)
      hurtMonster(m, Math.round(h.dmg * 0.7), PATTERNS[h.key].n, { crossfire: true });
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
/* 그림자 걸음 (도적): a roll costs one instead of two, which is
   the difference between rolling once a fight and rolling in
   and out of every one. */
export const rollCost = () => (G.player?.cls === 'rogue' ? 1 : ROLL_COST);

export function canRoll() {
  const p = G.player;
  return !!p && p.stam >= rollCost() && !has(p, 'paralyze') && !(p.stuck > 0);
}

export function dodgeRoll(dx, dy) {
  const p = G.player, L = G.level;
  if (!dx && !dy) return false;
  if (!canRoll()) { say(p.stam < rollCost() ? '숨이 차다.' : '움직일 수 없다.', 'warn'); return false; }

  let moved = 0;
  for (let i = 0; i < ROLL_DIST; i++) {
    const nx = p.x + dx, ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) break;
    if (L.solid(nx, ny) || monsterAt(nx, ny)) break;
    const t = L.tiles[idx(nx, ny)];
    if (t === CAMP || t === ALTAR || t === EVENT || t === ANVIL || L.shopAt.has(idx(nx, ny))) break;
    p.x = nx; p.y = ny; moved++;
  }
  if (!moved) { say('구를 자리가 없다.', 'warn'); return false; }

  p.stam -= rollCost();
  p.iframe = 1;
  p.stuck = 0;
  // …and a roll is one of the three things that earns a shade.
  gainShadow(1, 'roll');
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
  if (m.thief) return 'flee';        // it is always running, adjacent or not
  if (dist2 <= 2) return m.heavy ? 'wind' : (m.on ? 'hex' : 'melee');
  if (m.ai === 'still') return 'watch';
  if (m.ai === 'ranged' && m.rng
      && dist <= m.rng && dist >= 2.5 && lineClear(L, m.x, m.y, p.x, p.y)) return 'shoot';
  if (m.thief || ((m.ai === 'coward' || m.fleeing) && m.hp < m.maxhp * 0.35)) return 'flee';
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
/* 0.40이면 모닥불 한 번에 몸이 새것이 된다. 재 보니 판의 60%를
   체력 90~100%에서 보냈고, 그 대부분이 이 한 줄에서 나왔다. */
export const CAMP_HEAL = 0.28;
/* Gear climbs to 8 now that the odds gate it; a spell's plus is
   a multiplier, so it stays where it was. */
export const MAX_PLUS = 10;   // 8에서 올렸다 — 위쪽 네 칸이 벼랑이다
/* 정예가 남기는 것의 수. 셋을 굴려 놓고 하나만 가져간다. */
export const SPOIL_PICKS = 3;
export const MAX_SPELL_PLUS = 5;
const capFor = t => (t.type === 'spell' || t.kind === 'spell' ? MAX_SPELL_PLUS : MAX_PLUS);

/* ── 모루가 손댈 수 있는 것 ────────────────────────────────
   화면과 규칙이 서로 다른 답을 내고 있었다. 화면은 이름 붙은 물건을
   `capped: true`로 막아 놓고 「최대 +8」이라고 적었는데(+0인 물건에
   대고 하는 거짓말이다), 규칙 쪽 anvilStrike·anvilEnchant에는 unique
   검사가 아예 없었다. 실제로 재 보니 《약속》이 강화도 되고 인챈트도
   먹었다 — 데이터에 「접사가 붙지 않고, 벼려지지 않는다」고 적어 둔
   바로 그 물건이.

   그래서 판정을 한 자리로 모은다. 화면이 읽는 값과 규칙이 쓰는 값이
   같은 함수에서 나오면 둘이 갈릴 수가 없다. 그리고 막을 때는 **값을
   치르기 전에** 막는다 — 재료만 먹고 아무 일도 안 일어나는 것이
   이 화면에서 가장 나쁜 일이다. */
export function forgeBlock(t, mode) {
  if (!t) return '고를 수 있는 것이 없다';
  const it = t.type === 'item' ? t.item : (t.item || null);
  if (t.type === 'spell' || t.kind === 'spell') {
    if (mode === 'enchant' || mode === 'reroll') return null;
    return (plusOf(t) >= MAX_SPELL_PLUS) ? `더 연마할 수 없다 (최대 +${MAX_SPELL_PLUS})` : null;
  }
  if (!it) return '고를 수 있는 것이 없다';
  /* 이름 붙은 것은 이미 제 모습이다. 여기서 한 줄로 막고, 화면도
     같은 줄을 읽어 「왜 안 되는지」를 그대로 보여 준다. */
  if (it.unique) return '이름이 붙은 것은 벼려지지도, 물들지도 않는다';
  if (mode === 'reroll' && !it.pre && !it.suf) return '다시 굴릴 속성이 없다';
  if (mode === 'upgrade' && (it.plus || 0) >= MAX_PLUS) return `더 벼릴 수 없다 (최대 +${MAX_PLUS})`;
  return null;
}

export function campTargets() {
  const p = G.player, out = [];
  for (const [slot, label] of [['weapon', '무기'], ['body', '갑옷'], ['shield', '방패']]) {
    const it = p.equip[slot];
    // A named weapon is already what it is: the anvil has nothing
    // to add and everything to lose.
    if (it) {
      const t = { type:'item', item: it };
      out.push({
        key: `eq:${slot}`, label, name: affixName(it), kind: it.kind, item: it,
        plus: it.plus || 0, cap: MAX_PLUS,
        /* 모드마다 막히는 이유가 다르다. 화면은 이 세 줄을 그대로
           읽어서 「최대 +8」 같은 거짓말 대신 진짜 이유를 적는다. */
        block: {
          upgrade: forgeBlock(t, 'upgrade'),
          enchant: forgeBlock(t, 'enchant'),
          reroll:  forgeBlock(t, 'reroll'),
        },
        capped: !!forgeBlock(t, 'upgrade'),
      });
    }
  }
  for (const s of spellList(p)) {
    const plus = p.spellPlus?.[s.id] || 0;
    const aff = p.spellAffix?.[s.id];
    const affN = aff ? SPELL_AFFIXES.find(a => a.id === aff)?.n : null;
    out.push({
      key: `sp:${s.id}`, label: '주문', kind: 'spell', spell: s,
      name: `${plus ? `+${plus} ` : ''}${affN ? affN + ' ' : ''}${s.name}`,
      plus, capped: plus >= MAX_SPELL_PLUS, cap: MAX_SPELL_PLUS,
      block: {
        upgrade: plus >= MAX_SPELL_PLUS ? `더 연마할 수 없다 (최대 +${MAX_SPELL_PLUS})` : null,
        enchant: null, reroll: null,
      },
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

/* What the bank is worth right now, or null if there is
   nothing on the table. The fire screen prints this next to
   "rest", because the price of resting *is* the pile. */
export function bankPurse2() {
  if (!(G.bank >= 2)) return null;
  return { floors: G.bank, ...bankPurse(G.bank, G.depth) };
}

/* Taking the pile. Deliberately its own option rather than a
   side effect of resting, so cashing out is a decision the
   player makes with their thumb — and so it can be refused. */
export function campCash() {
  const p = G.player, purse = bankPurse2();
  if (!purse) { say('걸린 판돈이 없다.'); return; }
  p.gold += goldGain(purse.gold);
  p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
  for (const k of ['scrap', 'dust', 'essence']) p.mats[k] += purse[k] || 0;
  G.bank = 0;
  say(`${purse.floors}층치 판돈을 챙겼다 — 금화 ${goldGain(purse.gold)}닢.`, 'level');
  fx({ t:'altar', x:p.x, y:p.y, result:'대성공' });
  spendCamp();
}

export const CAMP_OIL = 200;
export const WOUND_OIL = 260;    // 상처를 전부 지지는 데 드는 기름

export function campRest() {
  const p = G.player;
  // Sitting down ends the run of unrested floors, pile or not.
  if (G.bank >= 2) say(`판돈 ${G.bank}층치가 불에 탔다.`, 'warn');
  G.bank = 0;
  /* 앉은 김에 심지도 갈아 끼운다. 모닥불이 층마다 하나씩 오는
     안전한 보급처이고, 화로와 기름병이 그보다 위험하거나 비싼
     보급처다 — 셋의 값이 다르기 때문에 경로가 선택이 된다. */
  const oil = Math.min(oilCap() - p.lightTurns, CAMP_OIL);
  if (oil > 0) { p.lightTurns += oil; say(`심지를 갈았다. 기름 +${oil}.`, 'good'); }
  /* 상처는 저절로 낫지 않는다. 불에 지져야 하고, 지지려면 기름을
     태운다 — 몸과 시계가 같은 저울에 오르는 자리다. 기름이 모자라면
     상처를 안고 내려간다. */
  if (p.wound > 0) {
    const cost = Math.min(p.lightTurns, WOUND_OIL);
    const share = cost / WOUND_OIL;
    const mend = Math.max(1, Math.round(p.wound * share));
    p.wound -= mend;
    p.lightTurns -= cost;
    recalc(p);
    say(share >= 1 ? `불에 지졌다. 상처 ${mend}이(가) 닫혔다. (기름 −${cost})`
                   : `기름이 모자라 절반만 지졌다. 상처 ${mend}. (기름 −${cost})`, 'good');
  }
  const heal = Math.min(p.maxhp - p.hp,
    Math.ceil(p.maxhp * CAMP_HEAL * (hasShackle('dryspring') ? 0.5 : 1)));
  p.hp += heal;
  p.mana = p.maxmana;
  const cured = ailList(p);
  p.ail = {};
  p.stuck = 0;
  if (heal) fx({ t:'heal', x:p.x, y:p.y, amt:heal });
  say(heal ? `불 앞에서 숨을 돌렸다. 체력 +${heal}. 이것으로 충분할 리 없다.`
           : '불 앞에 앉았다. 아직 성한 몸이라는 것이 이상하다.', 'good');
  if (cured.length) say(`${cured.map(k => AILMENTS[k].n).join(' · ')}이(가) 가셨다.`, 'good');
  spendCamp();
}

const plusOf = t =>
  t.type === 'item' ? (t.item?.plus || 0) : (G.player.spellPlus?.[t.id] || 0);

export const upgradeCostFor = (key, careful = false) => {
  const t = targetOf(key);
  if (!t) return null;
  // 식은 모루 raises the bill as well as lowering the odds, so the
  // shackle bites the gold sink rather than only the dice.
  const dear = hasShackle('coldanvil') ? 1.4 : 1;
  const raw = upgradeCost(plusOf(t));
  const base = {};
  for (const k of Object.keys(raw)) base[k] = Math.ceil(raw[k] * dear);
  if (!careful) return base;
  const out = {};
  for (const k of Object.keys(base)) out[k] = Math.ceil(base[k] * CAREFUL_MULT);
  return out;
};

/* Everything the fire screen needs to print the bet before the
   player takes it — the same numbers the roll actually uses, so
   what is shown and what happens cannot drift apart. */
export function upgradeOddsFor(key, careful = false, cat = null) {
  const t = targetOf(key);
  if (!t) return null;
  const plus = plusOf(t);
  const risk = careful ? { down: 0, breakPct: 0 } : upgradeRisk(plus);
  const spec = cat ? catalystById(cat) : null;
  const c = spec?.on === 'upgrade' ? spec.id : null;
  return {
    plus,
    cap: capFor(t),
    // The first strikes are certain on purpose. A 1% failure on
    // a +0 sword would teach a new player the wrong lesson about
    // a screen they have just met.
    /* A milestone strike is doing two jobs — the number and the
       engraving — so it is markedly harder than its neighbours.
       This is the risk the reward is attached to. */
    milestone: t.type === 'item' && isMilestone(plus),
    odds: c === 'core' ? 1
        : Math.max(0.05, Math.min(1, upgradeOdds(plus)
            + (careful ? CAREFUL_BONUS : 0)
            + (hasMemory('graver') ? 0.06 : 0)
            - (hasShackle('coldanvil') ? 0.08 : 0)
            - (t.type === 'item' && isMilestone(plus) ? ENGRAVE_PENALTY : 0))),
    crit: c === 'surge' ? 1 : careful ? 0 : UPGRADE_CRIT,
    down: c === 'flux' ? 0 : risk.down,
    // A spell cannot shatter; there is nothing to shatter. Nor
    // can a 불괴의 — that is what the 은총 is for — and a 수호의
    // 못 buys the same protection for one strike.
    // 정련의 촉매 deliberately does *not* stop a shatter: the two
    // catalysts have to answer different questions or the cheap
    // one makes the expensive one pointless.
    breakPct: c === 'ward' ? 0
            : t.type === 'item' && t.item?.boon !== 'aegis' ? risk.breakPct : 0,
    /* 화면이 「무엇을 걸고 있는지」를 전부 읽을 수 있어야 한다.
       저주도 판돈의 일부다. */
    hexPct: !careful && t.type === 'item' && plus >= UPGRADE_HEX_FROM ? UPGRADE_HEX_PCT : 0,
    cat: c,
  };
}

/* ── the anvil ────────────────────────────────────────────
   Enhancement used to live at the fire, competing with rest and
   enchant for a single use — so a whole run got four or five
   attempts total and the failure odds had nothing to bite on.
   The anvil is not spent. You strike it until the purse is
   empty, which is what makes going broke a way to play.

   `cat` is an optional catalyst id, consumed on the strike and
   only if it is a catalyst this action accepts.              */
export function anvilStrike(key, careful = false, cat = null) {
  const p = G.player, t = targetOf(key);
  if (!t) return;
  const cap = capFor(t);
  const name = t.type === 'item'
    ? (t.item ? affixName(t.item) : null)
    : (spellList(p).find(s => s.id === t.id)?.name || '주문');
  /* 막는 것이 먼저, 값은 그다음. 순서가 뒤집혀 있으면 「재료만 먹고
     아무 일도 없었다」가 된다. */
  const why = forgeBlock(t, 'upgrade');
  if (why) { say(`${name} — ${why}.`, 'warn'); return; }
  const cost = upgradeCostFor(key, careful);
  if (!canAfford(cost)) { say(`재료가 모자란다 — ${costText(cost)}.`, 'warn'); return; }

  const c = useCatalyst(cat, 'upgrade');
  const bet = upgradeOddsFor(key, careful, c?.id);
  spend(cost);
  if (c) say(`${c.n}을(를) 함께 넣었다.`, 'good');

  if (c?.id === 'core' || Math.random() < bet.odds) {
    // 과감 pays double one time in eight; 폭주의 불씨 makes it
    // certain. That is the whole reason to take the risky strike
    // when the safe one is affordable.
    /* 두 단계, 그리고 아주 드물게 세 단계. 세 번째 칸은 +5 위에서만
       열린다 — 초반에 터지면 그 뒤가 전부 심심해진다. */
    let step = (c?.id === 'surge' || Math.random() < bet.crit) ? 2 : 1;
    if (step === 2 && bet.plus >= UPGRADE_SURGE_FROM && Math.random() < UPGRADE_SURGE) step = 3;
    if (t.type === 'item') {
      t.item.plus = Math.min(cap, (t.item.plus || 0) + step);
      recalc(p);
    } else {
      p.spellPlus = p.spellPlus || {};
      p.spellPlus[t.id] = Math.min(cap, (p.spellPlus[t.id] || 0) + step);
    }
    G.forged = (G.forged || 0) + step;
    // Every milestone crossed by this strike cuts its engraving.
    if (t.type === 'item') engraveUpTo(t.item);
    if (step >= 3) {
      say(`${name} — 쇠가 울부짖는다. 세 단계 올랐다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y, big:true, surge:true });
    } else if (step === 2) {
      say(`${name} — 쇠가 노래한다. 두 단계 올랐다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y, big:true });
    } else {
      say(t.type === 'item' ? `${name} — 날이 섰다.` : `${name}을(를) 연마했다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y });
    }
    return;
  }

  /* 대박. 실패한 손이 되레 맞는 일이 아주 드물게 있다. 부서지기
     직전까지 갔다가 살아 돌아오는 것이 이 화면에서 가장 기억에
     남는 순간이고, 그 순간은 만들어 줘야 생긴다. */
  if (Math.random() < JACKPOT.forge) {
    if (t.type === 'item') {
      t.item.plus = Math.min(cap, (t.item.plus || 0) + 1);
      engraveUpTo(t.item);
      recalc(p);
    } else {
      p.spellPlus = p.spellPlus || {};
      p.spellPlus[t.id] = Math.min(cap, (p.spellPlus[t.id] || 0) + 1);
    }
    G.forged = (G.forged || 0) + 1;
    say(`${name} — 꺼진 줄 알았던 불이 되살아났다.`, 'level');
    fx({ t:'forge', x:p.x, y:p.y, big:true, surge:true });
    return;
  }

  /* The strike failed. What that costs depends on how far out on
     the limb you already were — and on what you threw in with it. */
  if (bet.breakPct && Math.random() < bet.breakPct) {
    breakItem(t.item);
    say(`${name}이(가) 쨍 하고 갈라졌다. 남은 것은 손잡이뿐이다.`, 'bad');
    fx({ t:'shatter', x:p.x, y:p.y });
  } else if (bet.down) {
    if (t.type === 'item') { t.item.plus = Math.max(0, (t.item.plus || 0) - 1); recalc(p); }
    else p.spellPlus[t.id] = Math.max(0, (p.spellPlus[t.id] || 0) - 1);
    say(`${name} — 금이 갔다. 한 단계 물러섰다.`, 'warn');
    fx({ t:'forge', x:p.x, y:p.y, fail:true });
    /* 그리고 위쪽에서는 망가진 채로 남을 수 있다. 부서지면 다시
       구하면 되지만 저주는 들고 다녀야 한다 — 「신중」은 이것도
       사 준다(down이 0이므로 여기에 오지 않는다). */
    if (bet.hexPct && Math.random() < bet.hexPct) {
      const table = Math.random() < 0.5 ? PREFIXES : SUFFIXES;
      const a = pickAffixFor(table, t.item.kind, true);
      if (a) {
        t.item[table === PREFIXES ? 'pre' : 'suf'] = a.id;
        recalc(p);
        say(`식은 자리에 검은 것이 앉았다 — ${a.n}.`, 'bad');
        fx({ t:'enchant', x:p.x, y:p.y, cursed:true });
      }
    }
  } else {
    say(`${name} — 불꽃이 사그라든다. 아무 일도 없었다.`, 'warn');
    fx({ t:'forge', x:p.x, y:p.y, fail:true });
  }
}

/* Cut whatever engravings the item's plus has now earned. Driven
   off the plus rather than off the strike, so an item that jumped
   two steps at once gets both, and an item that was knocked back
   down and climbed again does not get a second copy. */
function engraveUpTo(it) {
  if (!it) return;
  const want = engraveSlots(it.plus);
  it.engrave = it.engrave || [];
  while (it.engrave.length < want) {
    const held = new Set(it.engrave);
    const pool = ENGRAVINGS.filter(e =>
      e.tags.includes(it.kind === 'weapon' ? 'weapon' : 'armour') && !held.has(e.id));
    if (!pool.length) break;
    const e = pool[rnd(pool.length)];
    it.engrave.push(e.id);
    G.engraved = (G.engraved || 0) + 1;
    say(`쇠에 무늬가 돋았다 — ${e.n} ${it.n}. ${e.t}`, 'level');
    lore('쇠에 돋은 무늬', `${e.n} ${it.n}`, e.t, it.spr);
    fx({ t:'engrave', x:G.player.x, y:G.player.y });
  }
}

/* Spend one, if it is there and if this action takes it. Returns
   the catalyst so the caller can name it and read its rule. */
function useCatalyst(id, on) {
  if (!id) return null;
  const p = G.player;
  const spec = catalystById(id);
  if (!spec || spec.on !== on) return null;
  const i = p.pack.findIndex(s => s.item.kind === 'cat' && s.item.id === id);
  if (i < 0) return null;
  removeItem(p, i);
  G.catUsed = (G.catUsed || 0) + 1;
  return spec;
}

export const catalystsHeld = (on) => {
  const p = G.player;
  if (!p) return [];
  return p.pack
    .map((s, i) => ({ idx: i, qty: s.qty, spec: catalystById(s.item.id), kind: s.item.kind }))
    .filter(x => x.kind === 'cat' && x.spec && (!on || x.spec.on === on))
    .map(x => ({ ...x.spec, qty: x.qty }));
};

/* ── fusion ───────────────────────────────────────────────
   Two relics into the fire. Six pairs are written to recognise
   each other and always produce the same 초월 relic; every other
   pair rolls on a printed table. The screen never names the six
   — the twelve relic descriptions do, and a player who reads
   them is being rewarded for reading them.

   `canFuse` is the whole gate: two relics held, the fire unspent,
   and the price on the table. */
export const canFuse = () => (G.player?.relics || []).length >= 2;

/* Do these two know each other? Reported without naming the
   result, so an undiscovered pair still has to be committed to.
   Once found, the ledger remembers and the screen says so. */
export function fusePreview(a, b) {
  if (!a || !b || a === b) return null;
  const f = fusionOf(a, b);
  if (!f) return { special: false };
  return { special: true, out: f.out, known: Meta.seen('fusions', f.out) };
}

export function fuseRelics(a, b) {
  const p = G.player;
  if (!p || a === b) return;
  const ia = p.relics.indexOf(a), ib = p.relics.indexOf(b);
  if (ia < 0 || ib < 0) return;
  if (!canAfford(FUSE_COST)) { say(`재료가 모자란다 — ${costText(FUSE_COST)}.`, 'warn'); return; }
  spend(FUSE_COST);

  const f = fusionOf(a, b);
  const drop = () => {
    // Remove both, high index first so the low one does not shift.
    for (const i of [ia, ib].sort((x, y) => y - x)) p.relics.splice(i, 1);
  };

  if (f) {
    drop();
    p.relics.push(f.out);
    const r = relicById(f.out);
    const first = Meta.see('fusions', f.out);
    Meta.see('relics', f.out);
    G.fused = (G.fused || 0) + 1;
    say(`${relicById(a).n}과(와) ${relicById(b).n}이(가) 서로를 알아본다.`, 'level');
    say(`— ${r.n}. ${r.t}${first ? ' (처음 찾아낸 조합)' : ''}`, 'level');
    fx({ t:'transcend', x:p.x, y:p.y });
    recalc(p);
    spendCamp();
    return;
  }

  const roll = pickWeighted(FUSE_ODDS);
  if (roll.id === 'new') {
    /* Rolled *before* the two are removed, so the fire can never
       hand back one of the things you just fed it. */
    const id = unownedRelic();
    drop();
    if (id) {
      p.relics.push(id);
      Meta.see('relics', id);
      const r = relicById(id);
      say(`쇳물에서 ${r.n}이(가) 떠올랐다.`, 'level');
      say(r.t, 'level');
      fx({ t:'altar', x:p.x, y:p.y, good:true });
    } else say('더 나올 유물이 없다. 둘 다 녹아 없어졌다.', 'warn');
  } else if (roll.id === 'tune') {
    const keep = Math.random() < 0.5 ? a : b;
    drop();
    p.relics.push(keep);
    p.tuned = p.tuned || {};
    const r = relicById(keep);
    // Half again of whatever the relic's number means, to two
    // decimals — the same funnel handles 체력 +3 and 흡혈 0.35.
    const gain = Math.round(r.v * 50) / 100;
    p.tuned[keep] = (p.tuned[keep] || 0) + gain;
    say(`${r.n}이(가) 다른 하나를 삼키고 정련되었다. (${r.v} → ${r.v + p.tuned[keep]})`, 'level');
    fx({ t:'forge', x:p.x, y:p.y, big:true });
  } else {
    drop();
    p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
    p.mats.essence += 2; p.mats.dust += 5;
    say('둘 다 녹아내렸다. 남은 것은 정수 2와 마력 가루 5뿐이다.', 'warn');
    fx({ t:'forge', x:p.x, y:p.y, fail:true });
  }
  recalc(p);
  spendCamp();
}

function pickWeighted(table) {
  const total = table.reduce((s, o) => s + o.w, 0);
  let n = Math.random() * total;
  for (const o of table) { if (n < o.w) return o; n -= o.w; }
  return table[table.length - 1];
}

/* Losing the sword off your own arm. Left unequipped rather than
   silently replaced: standing there with an empty hand is the
   point, and the player chose this. */
function breakItem(it) {
  const p = G.player;
  for (const slot of GEAR_SLOTS)
    if (p.equip[slot] === it) p.equip[slot] = null;
  const i = p.pack.findIndex(s => s.item === it);
  if (i >= 0) p.pack.splice(i, 1);
  G.broke = (G.broke || 0) + 1;
  recalc(p);
}

/* Enchant and reroll moved to the anvil with enhancement. The
   fire is for the body and the relics now; the anvil is for the
   metal, and all three metal actions cost materials rather than
   the one use a floor grants. */
export function anvilEnchant(key, reroll, cat = null) {
  const p = G.player, t = targetOf(key);
  if (!t) return;
  const label = t.type === 'item'
    ? (t.item ? affixName(t.item) : '그것')
    : (spellList(p).find(s => s.id === t.id)?.name || '주문');
  const why = forgeBlock(t, reroll ? 'reroll' : 'enchant');
  if (why) { say(`${label} — ${why}.`, 'warn'); return; }
  const cost = reroll ? REROLL_COST : ENCHANT_COST;
  if (!canAfford(cost)) { say(`재료가 모자란다 — ${costText(cost)}.`, 'warn'); return; }
  const c = useCatalyst(cat, 'enchant');
  spend(cost);
  if (c) say(`${c.n}을(를) 함께 넣었다.`, 'good');

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
    return;
  }

  const it = t.item;
  if (!it) return;
  const tag = it.kind;
  // A reroll never inflicts a curse — it is the cure for one,
  // which is what keeps the enchant gamble survivable.
  /* 빈 물건에 거는 것은 싸고 안전하고, 이미 둘 다 붙은 물건을 다시
     건드리는 것은 도박이다. 그래야 「지금 멈출까」가 매번 결정이 된다. */
  const worn = (it.pre ? 1 : 0) + (it.suf ? 1 : 0);
  const cursed = !reroll && c?.id !== 'seal'
              && Math.random() < ENCHANT_CURSE + ENCHANT_CURSE_STEP * worn;

  let usePrefix = Math.random() < 0.5;
  if (reroll) {
    const preCursed = !!PREFIXES.find(a => a.id === it.pre)?.curse;
    const sufCursed = !!SUFFIXES.find(a => a.id === it.suf)?.curse;
    if (preCursed !== sufCursed) usePrefix = preCursed;      // burn the curse first
    else if (!it.pre !== !it.suf) usePrefix = !!it.pre;      // otherwise the slot in use
  }
  const table = usePrefix ? PREFIXES : SUFFIXES;
  const a = pickAffixFor(table, tag, cursed);
  /* 여기까지 와서 빈손이면 이미 값을 치른 뒤다. 되돌려준다 —
     「불꽃이 사그라들 뿐이다」가 유료였다. */
  if (!a) { refund(cost); say('불꽃이 사그라들 뿐이다. 값은 돌려받았다.', 'warn'); return; }

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
  /* 대박. 두 슬롯이 다 좋은 것으로 차고, 거기에 한 단계까지 얹힌다.
     몇 판에 한 번 나오라고 둔 숫자다 — 자주 나오면 그건 대박이
     아니라 기본값이고, 그러면 인챈트가 도박이 아니라 절차가 된다. */
  if (!cursed && !reroll && Math.random() < JACKPOT.enchant) {
    for (const [table, key] of [[PREFIXES, 'pre'], [SUFFIXES, 'suf']]) {
      const g = pickAffixFor(table, tag, false);
      if (g) it[key] = g.id;
    }
    it.plus = Math.min(MAX_PLUS, (it.plus || 0) + 1);
    recalc(p);
    say(`불이 하얗게 탄다 — ${affixName(it)}.`, 'level');
    fx({ t:'transcend', x:p.x, y:p.y });
    return;
  }

  /* 분광석 pays for both slots at once — the only way to land a
     prefix and a suffix from one roll. 그리고 아주 드물게 운으로도
     같은 일이 일어난다 — 촉매는 여전히 「확실하게」를 판다. */
  if (!cursed && !reroll && c?.id !== 'prism' && Math.random() < ENCHANT_TWIN) {
    const other = usePrefix ? SUFFIXES : PREFIXES;
    const b = pickAffixFor(other, tag, false);
    if (b) {
      it[usePrefix ? 'suf' : 'pre'] = b.id;
      recalc(p);
      say(`불이 두 번 갈라졌다 — ${affixName(it)}.`, 'level');
      fx({ t:'enchant', x:p.x, y:p.y, cursed:false, twin:true });
    }
  }
  if (c?.id === 'prism') {
    const other = usePrefix ? SUFFIXES : PREFIXES;
    const b = pickAffixFor(other, tag, false);
    if (b) {
      it[usePrefix ? 'suf' : 'pre'] = b.id;
      recalc(p);
      say(`분광석이 빛을 갈랐다 — ${affixName(it)}.`, 'level');
    }
  }
  fx({ t:'enchant', x:p.x, y:p.y, cursed });
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
      n = hurtPlayer(n);
      /* `dmg` was a name from the site this was copied out of and
         has never existed here. It threw the moment a ? room dealt
         damage that pushed you across the quarter-health line —
         which is exactly when the low-health flash was wanted. */
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg:n, who: from || '사건', spr:'event',
           low: p.hp <= p.maxhp * 0.25 && p.hp + n > p.maxhp * 0.25,
           severe: n >= p.maxhp * 0.18 });
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
    /* 기름을 붓는 쪽. burnOil만 있고 이쪽이 없어서, 사건은 기름을
       태울 수만 있고 채울 수는 없었다 — 불에 관한 사건을 쓰려면
       양쪽이 다 있어야 한다. 상한은 통 크기가 정한다. */
    oil: n => { const got = Math.min(oilCap() - p.lightTurns, n);
      if (got > 0) p.lightTurns += got; return Math.max(0, got); },
    spawn: (spr, n) => spawnNear(spr, n, false),
    spawnElite: n => spawnNear(null, n, true),
    /* The room closes on you. Placed on the rings immediately
       around the player rather than scattered across the floor,
       because being surrounded is a different problem from being
       outnumbered — no corridor to back into, no door to shut,
       and the first turn is spent deciding which way out is
       cheapest. This is what a lost wager in the ? room costs. */
    surround: n => {
      const L = G.level, p = G.player, spots = [];
      for (let r = 1; r <= 3; r++)
        for (let y = p.y - r; y <= p.y + r; y++)
          for (let x = p.x - r; x <= p.x + r; x++) {
            if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) !== r) continue;
            if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) continue;
            if (L.solid(x, y) || monsterAt(x, y)) continue;
            spots.push({ x, y, r });
          }
      /* Nearest ring first, shuffled within it, so a small number
         lands in your face rather than politely three tiles off. */
      spots.sort((a, b) => a.r - b.r || Math.random() - 0.5);
      let made = 0;
      for (const s of spots) {
        if (made >= n) break;
        const m = pickMonster(G.depth + 1);
        if (!m) break;
        /* Down an energy, so the ring spends its first turn
           standing up. The punishment for losing the wager is the
           position, not four free hits — the player gets exactly
           one turn to pick a direction, roll, or drink, which is
           the turn that makes it a fight instead of a mugging. */
        Object.assign(m, { x:s.x, y:s.y, awake:true, energy:-1 });
        m.maxhp = m.hp;
        G.monsters.push(m);
        fx({ t:'reveal', x:s.x, y:s.y });
        made++;
      }
      if (made) {
        say(`사방에서 ${made}마리가 일어섰다.`, 'hit');
        fx({ t:'telegraph', urgent:true });
        fx({ t:'noise', x:p.x, y:p.y, r:6 });
      }
      rouse(p.x, p.y, 8, 1);
      return made;
    },
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
      const slots = slot ? [slot] : GEAR_SLOTS;
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
      p.spellPlus[sp.id] = Math.min(MAX_SPELL_PLUS, (p.spellPlus[sp.id] || 0) + 1);
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
  /* 전리품 더미가 먼저다. 사건 자리에서 정예를 잡으면 둘이 겹칠 수
     있는데, 그때 화면에 뜬 것과 고른 것이 갈리면 안 된다. */
  if (G.spoils) {
    return {
      id: 'spoils', n: '전리품 더미', spoils: true,
      t: '쓰러진 것이 남긴 것들이다. 가져갈 수 있는 것은 하나뿐이고, 나머지는 여기 두고 간다.',
      opts: G.spoils.picks.map((it, i) => ({
        i, n: affixName(it), t: itemBlurb(it).split('\n').join(' · '),
        can: true, odds: null, risk: '',
        rar: rarityOf(it), spr: it.spr,
      })),
    };
  }
  const e = EVENTS.find(x => x.id === G.level?.eventId);
  if (!e) return null;
  const api = eventApi();
  return {
    id: e.id, n: e.n, t: e.t,      // 화면이 사건마다 다른 그림을 고를 수 있게
    opts: e.opts.map((o, i) => ({
      i, n: o.n, t: o.t, can: !o.need || o.need(api), odds: o.odds ?? null,
      risk: o.risk || '',
    })),
  };
}

/* 하나를 집고, 나머지는 두고 간다. 배낭이 가득 차 있으면 아무것도
   집히지 않는데, 그때 더미를 없애 버리면 나머지 둘까지 같이 사라진다
   — 「배낭이 가득 찼다」가 물건 셋을 지우는 문장이 되면 안 된다. */
function spoilsTake(i) {
  const p = G.player, sp = G.spoils;
  if (!sp) { G.screen = 'play'; return; }
  const it = sp.picks[i];
  if (!it) return;
  if (!packRoom(p, it)) {
    say(`배낭이 가득 찼다 — ${nameOf(it)}은(는) 더미에 그대로 있다.`, 'warn');
    return;
  }
  const idxAt = G.items.findIndex(o => o.kind === 'spoils' && o.x === p.x && o.y === p.y);
  if (idxAt >= 0) G.items.splice(idxAt, 1);
  G.spoils = null;
  G.screen = 'play';
  G.act = 'pick';
  addItem(p, it);
  const grade = rarityOf(it);
  if (grade >= 2) {
    G.rareFound = (G.rareFound || 0) + 1;
    fx({ t:'found', x:p.x, y:p.y, rar:grade });
    lore(RARITY[grade].n, affixName(it), itemBlurb(it), it.spr);
  } else {
    fx({ t:'found', x:p.x, y:p.y, rar:grade });
  }
  const left = sp.picks.filter((_, k) => k !== i).map(o => affixName(o)).join(', ');
  say(`${affixName(it)}을(를) 골랐다. ${left}은(는) 두고 간다.`, grade >= 2 ? 'level' : 'good');
  endTurn();
}

/* 더미를 안 열고 돌아설 수도 있어야 한다. 셋 다 쓸모없을 때가
   있고, 그때 억지로 하나를 집게 하면 배낭 한 칸이 벌이 된다. */
export function spoilsLeave() {
  if (!G.spoils) return;
  G.spoils = null;
  G.screen = 'play';
  say('더미를 그대로 두고 돌아섰다.');
}

export function eventChoose(i) {
  const L = G.level;
  if (G.spoils) return spoilsTake(i);
  const e = EVENTS.find(x => x.id === L?.eventId);
  if (!e) { G.screen = 'play'; return; }
  const opt = e.opts[i];
  const api = eventApi();
  if (!opt || (opt.need && !opt.need(api))) return;

  /* Consumed before the effect runs: an option that opens another
     screen (the relic swap, the fire) must not leave the tile
     behind for a second helping. */
  Meta.see('events', e.id);
  G.eventsSeen = (G.eventsSeen || 0) + 1;
  if (L.tiles[idx(G.player.x, G.player.y)] === EVENT) L.tiles[idx(G.player.x, G.player.y)] = FLOOR;
  L.eventId = null;
  G.screen = 'play';

  /* A wager, if the option declared one. The roll lives here
     rather than inside the option so the number the button
     printed is provably the number that was rolled — an option
     that rolls its own chance can drift from its label, and a
     gamble whose odds you cannot trust is just a surprise.

     The altar stakes an item. This stakes the floor: the losing
     branch does not take your gold, it puts the room around you. */
  if (opt.odds != null && opt.fail) {
    if (Math.random() < opt.odds) opt.run(api);
    else { say('걸었고, 졌다.', 'warn'); opt.fail(api); }
  } else opt.run(api);
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
       : GEAR_SLOTS.some(k => p.equip[k]),
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
    const slots = GEAR_SLOTS.filter(k => p.equip[k]);
    const k = slots[rnd(slots.length)];
    const given = p.equip[k];
    weight = 1.1 + rarityOf(given) * 0.5 + (given.plus || 0) * 0.15;
    p.equip[k] = null;
    recalc(p);
    say(`${affixName(given)}이(가) 재가 되어 흩어진다.`, 'warn');
  }

  /* The roll happens now; the *reveal* happens in the UI, over
     about a second, with the marker slowing as it passes the
     segments it did not land on. Resolving instantly threw away
     the only part of a gamble that is actually enjoyable — the
     part where you can still see the jackpot going by. */
  const result = altarRoll(offer.odds);
  G.pendingAltar = { result, weight, odds: offer.odds, gave: id };
  return result;
}

/* Called by the UI when the wheel has finished moving. Kept
   apart from the roll so the outcome cannot be influenced by
   how long the animation ran. */
export function altarSettle() {
  const p = G.player, pend = G.pendingAltar;
  if (!pend) return;
  G.pendingAltar = null;

  fx({ t:'altar', result: pend.result, x:p.x, y:p.y });
  grantBoon(pend.result, pend.weight, pend.gave);

  G.level.tiles[idx(p.x, p.y)] = FLOOR;   // one use, then it is stone
  G.level.altar = null;
  G.screen = 'play';
  if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'제단' }); return; }
  endTurn();
}

function grantBoon(result, weight, gave = 'blood') {
  const p = G.player, d = G.depth;

  if (result === '재앙') {
    const roll3 = rnd(3);
    if (roll3 === 0) {
      const slots = GEAR_SLOTS.filter(k => p.equip[k]);
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

  /* 대박. 대성공 위의 한 칸 — 기적. 제단은 이 판에서 가장 큰 도박인데
     가장 좋은 결과가 「좋은 물건 하나」에서 멈춰 있었다. 몇 판에 한 번,
     제단이 판을 통째로 바꾸는 일이 있어야 그 앞에 설 때 손이 떨린다. */
  if (result === '대성공' && Math.random() < JACKPOT.altar) {
    const id = unownedRelic();
    if (id) takeRelic(id);
    const it = pickItem(d + 18);
    if (it) {
      rollAffixes(it, d + 26, true);
      it.plus = 3 + rnd(3);
      addItem(p, it);
      say(`돌이 갈라지고 ${affixName(it)}이(가) 드러났다.`, 'level');
    }
    // permHp는 recalc이 이미 읽는 자리다 — 새 필드를 만들면 한 곳이 더 갈린다.
    p.permHp = (p.permHp || 0) + 12;
    recalc(p);
    say('— 기적. 제단이 대답 이상의 것을 했다.', 'level');
    fx({ t:'transcend', x:p.x, y:p.y });
    return;
  }

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

  /* 성공. The reward never comes back in the coin it was paid in.
     Bleeding used to have a one-in-four chance of buying a heal
     and gold a one-in-four chance of buying gold — which is not a
     bargain with a god, it is change from a till. What you gave
     decides which door is *closed*; the rest are open. */
  /* Keyed by what the payout *is*, not by what buys it. The first
     version named the gold payout `blood` — after the offering it
     was written for — and the exclusion table then closed the
     wrong door: paying gold shut out materials and left gold wide
     open. The bench caught it at 33%. A lookup keyed on one thing
     and read as another is a bug waiting for a second reader. */
  const PAYOUTS = {
    gold: () => {
      const g = Math.round((160 + d * 70) * weight);
      p.gold += g; say(`금화 ${g}닢이 쏟아진다.`, 'good');
    },
    mats: () => {
      p.mats.scrap += Math.round((6 + d) * weight);
      p.mats.dust += Math.round((2 + d * 0.3) * weight);
      say('쓸 만한 재료가 남는다.', 'good');
    },
    gear: () => {
      const it = pickItem(d + 4);
      if (it) {
        rollAffixes(it, d + 6, true);
        if (!addItem(p, it)) { it.x = p.x; it.y = p.y; G.items.push(it); }
        say(`${affixName(it)}을(를) 얻었다.`, 'good');
      }
    },
    flesh: () => {
      const got = Math.min(p.maxhp - p.hp, Math.ceil(p.maxhp * 0.5));
      p.hp += got; p.mana = p.maxmana; p.ail = {};
      fx({ t:'heal', x:p.x, y:p.y, amt:got });
      say(`상처가 전부 닫힌다. 체력 +${got}.`, 'good');
    },
  };
  /* Each offering shuts the door it came through. Blood cannot buy
     blood back, gold cannot buy gold, and a burnt weapon does not
     come back as a weapon — it comes back as the thing you could
     not have bought. */
  const CLOSED = { blood: 'flesh', gold: 'gold', gear: 'gear' };
  const open = Object.keys(PAYOUTS).filter(k => k !== CLOSED[gave]);
  PAYOUTS[open[rnd(open.length)]]();
}

/* ── shops ──────────────────────────────────────────────── */
/* ── 신전 ─────────────────────────────────────────────────
   The one door in the plaza that does not sell you anything. It
   was a strictly worse alchemist — two potions the alchemist also
   had — which made it a sign hanging over nothing.

   It takes things off instead. Every other counter in the game
   adds: the anvil adds a plus, the fire adds a property, the
   altar adds a gamble. Nothing anywhere could remove a curse, so
   a cursed find was simply a dead find you carried to a merchant.
   Now it is a decision with a price on it. */
export const templeCost = it =>
  Math.max(60, Math.round(priceOf(it, true) * TEMPLE_SHARE));

export function templeOffers() {
  const p = G.player;
  const out = [];
  for (const k of GEAR_SLOTS) {
    const it = p.equip[k];
    if (it && isCursed(it) && !it.unique) out.push({ where:'equip', key:k, item:it });
  }
  p.pack.forEach((slot, i) => {
    if (isCursed(slot.item) && !slot.item.unique)
      out.push({ where:'pack', key:i, item:slot.item });
  });
  return out;
}

export function cleanse(offer) {
  const p = G.player;
  const it = offer.item;
  if (!isCursed(it)) { say('이미 깨끗하다.', 'warn'); return; }
  const cost = templeCost(it);
  if (p.gold < cost) { say('금화가 모자란다.', 'warn'); return; }
  p.gold -= cost;
  /* Only the cursed half comes off. A 저주받은 예리한 검 keeps
     its edge — the temple is not a reroll, it is a subtraction. */
  if (PREFIXES.find(a => a.id === it.pre)?.curse) it.pre = null;
  if (SUFFIXES.find(a => a.id === it.suf)?.curse) it.suf = null;
  recalc(p);
  fx({ t:'cleanse', x:p.x, y:p.y });
  say(`${nameOf(it)}에서 붙어 있던 것이 떨어져 나갔다. (-${cost})`, 'level');
}

export function shopStock(shop) {
  /* The weapon rack used to return here, which meant the quiver
     rack hung below an early return and the one shop that sells
     them never did. */
  if (shop.stock === 'weapon') {
    const out = WEAPONS.filter(w => w.d <= 12 && w.t !== 'wand')
      .map(w => ({ kind:'weapon', ...w }));
    if (shop.quivers)
      for (const q of QUIVERS)
        if (q.d <= Math.max(1, G.deepest || G.depth))
          out.push({ kind:'quiver', slot:'quiver', ...q });
    return out;
  }
  if (shop.stock === 'armour')
    return ARMOURS.filter(a => a.d <= 12).map(a => ({ kind:'armour', ...a }));
  const out = shop.stock.map(id => makeConsumable(id));
  /* Rods are read, not swung, so they hang with the scrolls
     rather than on the weapon rack — the one shelf a caster has
     any reason to walk to. */
  if (shop.rods)
    for (const w of WEAPONS)
      if (w.t === 'wand' && w.d <= Math.max(1, G.deepest || G.depth))
        out.push({ kind:'weapon', ...w });
  /* 닫힌 장부 halves the shelf. Deterministic on the shop id and
     the day's stock rather than random, so re-entering the door
     cannot reroll what is for sale. */
  if (hasShackle('ledger') && out.length > 1) out.length = Math.ceil(out.length / 2);
  /* The wandering merchant also deals in materials, which is what
     turns a purse of gold into a +1 you actually wanted. */
  if (shop.mats)
    for (const k of shop.mats)
      out.push({ kind:'mat', mat:k, id:`mat_${k}`, spr: k === 'essence' ? 'amulet' : k === 'dust' ? 'potion' : 'armor',
                 n: MATS[k].n, cost: MATS[k].cost, desc: MATS[k].note });
  /* 행상인의 기억: the general store carries one relic you have
     already found, at a price that hurts. It is the only way a
     run can *choose* its first relic instead of being handed one,
     and it is bought with knowledge from previous runs. */
  if (shop.id === 1 && hasMemory('pedlar')) {
    const seen = Object.keys(Meta.read().relics || {})
      .map(relicById).filter(r => r && !r.fused && !hasRelic(r.id));
    if (seen.length) {
      // Stable within a run: the same relic is on the shelf every
      // time you walk back in, so "come back with more gold" works.
      const r = seen[(G.relicShelf ??= rnd(seen.length)) % seen.length];
      out.push({ kind:'relic', id:r.id, spr:r.spr, n:r.n, cost:1400, desc:r.t });
    }
  }
  /* Catalysts are the only thing worth crossing a floor for a
     merchant. He carries two, drawn from what the depth has
     unlocked — never the whole rack, or they stop being rare. */
  if (shop.cats) {
    const pool = CATALYSTS.filter(c => c.d <= Math.max(1, G.deepest || G.depth));
    const seen = new Set();
    for (let i = 0; i < 2 && pool.length; i++) {
      const c = pool[(shop.id * 7 + i * 3 + (G.deepest || 1)) % pool.length];
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ kind:'cat', ...c, desc: c.t });
    }
  }
  return out;
}

/* ── 행상의 기분 ─────────────────────────────────────────
   값이 「기본값 × 매력 × 평판」뿐이면 상점은 자판기다. 언제 가도
   같은 값이면 언제 갈지가 결정이 되지 않는다.

   그래서 행상마다 기분이 있다. 무작위가 아니라 **네 상태를 읽는다** —
   피를 흘리고 있는지, 불이 꺼져 가는지, 가방이 찼는지, 뒤에서 무엇이
   쫓아오는지. 그래서 흔들리되 읽을 수 있고, 읽을 수 있으니 「지금
   갈까 나중에 갈까」가 수가 된다.

   기분은 (행상, 층)으로 정해진다 — 한 층에서 나갔다 들어와도 안 바뀐다.
   값이 새로고침되면 그것은 흥정이 아니라 도박이다. */
export const MOODS = [
  { id:'flush',  n:'주머니가 두둑하다',   t:'사는 값 −25%, 파는 값도 −25%.',
    buy: () => 0.75, sell: () => 0.75 },
  { id:'vulture', n:'피 냄새를 맡았다',   t:'다칠수록 비싸게 부른다.',
    buy: p => 1 + (1 - p.hp / p.maxhp) * 0.8, sell: () => 1 },
  { id:'dark',   n:'어둠을 무서워한다',   t:'네 불이 꺼져 갈수록 비싸다.',
    buy: p => G.depth > 0 && p.lightTurns < 200 ? 1.55 : 1.05, sell: () => 1 },
  { id:'scales', n:'무게를 잰다',        t:'가방이 무거울수록 후하게 사 준다.',
    buy: () => 1.1, sell: p => 1 + Math.min(0.6, p.pack.length * 0.05) },
  { id:'deaf',   n:'소란을 안다',        t:'소란이 크면 값을 올린다. 조용하면 깎아 준다.',
    buy: () => (G.uproar || 0) >= 5 ? 1.45 : 0.9, sell: () => 1 },
  { id:'steady', n:'셈이 밝다',          t:'정가. 깎이지도 오르지도 않는다.',
    buy: () => 1, sell: () => 1 },
];

export function shopMood(shop) {
  if (!shop) return MOODS[MOODS.length - 1];
  /* 결정적이다 — 나갔다 들어와도 같은 값. 새로고침되는 값은 흥정이
     아니라 도박이고, 도박은 아래 haggle이 맡는다. */
  const k = (shop.id * 31 + (G.depth || 0) * 17 + (G.runSeed || 0)) % MOODS.length;
  return MOODS[k];
}

/* ── 흥정 ────────────────────────────────────────────────
   한 상점에 한 번. 걸면 값이 내려가거나, 상인이 상한다.
   실패한 상인은 이 방문 동안 사 주지 않는다 — 잃는 것이 금화가
   아니라 **출구**라서, 가진 것을 팔아 치우려던 계획이 통째로 어긋난다. */
export const HAGGLE_CUT = 0.72;
/* 화면이 부르는 확률과 여기서 굴리는 확률은 같은 한 줄이어야 한다.
   버튼에 적힌 숫자와 실제 굴림이 갈라지면 그것은 도박이 아니라 사기다. */
export const haggleOdds = () => clamp(0.42 + statB(G.player, 'chr') * 0.06, 0.15, 0.85);
export function haggle() {
  const p = G.player, shop = G.shop;
  if (!shop) return false;
  G.haggled = G.haggled || {};
  const key = `${shop.id}:${G.depth}`;
  if (G.haggled[key]) { say('한 번 흥정한 상대다. 두 번은 안 통한다.', 'warn'); return false; }
  const odds = haggleOdds();
  G.haggled[key] = true;
  if (Math.random() < odds) {
    G.haggleCut = { key, mult: HAGGLE_CUT };
    say(`값을 깎았다. 이 수레에서는 ${Math.round((1 - HAGGLE_CUT) * 100)}% 싸다.`, 'good');
    return true;
  }
  G.haggleSour = { key };
  say('상인이 등을 돌렸다. 이 수레는 오늘 아무것도 사 주지 않는다.', 'hit');
  return false;
}
export const haggleState = () => {
  const shop = G.shop; if (!shop) return null;
  const key = `${shop.id}:${G.depth}`;
  return { done: !!(G.haggled || {})[key],
           cut: G.haggleCut?.key === key ? G.haggleCut.mult : 1,
           sour: G.haggleSour?.key === key };
};

export const priceOf = (item, buying) => {
  const chrB = statB(G.player, 'chr');
  // Same spine as salvage: a +5 sword is worth five upgrades more
  // than the plain one, at the counter as well as at the anvil.
  const base = worthOf(item) || item.cost || 10;
  /* markup is the running total of what ? rooms did to your
     reputation: robbing a drunk raises it, settling a ledger
     lowers it. Selling prices move the other way. */
  const mk = (1 + (G.player.markup || 0)) * (hasShackle('ledger') ? 1.5 : 1);
  /* 기분과 흥정이 여기 한 곳에서만 값에 닿는다. 화면이 부르는 값과
     계산대가 받는 값이 갈라지면 그것은 흥정이 아니라 사기다. */
  const mood = shopMood(G.shop);
  const hag = haggleState();
  const swing = buying ? mood.buy(G.player) * (hag?.cut ?? 1)
                       : mood.sell(G.player);
  return buying
    ? Math.max(1, Math.round(base * (1.25 - chrB * 0.03) * mk * swing))
    : Math.max(1, Math.round(base * (0.42 + chrB * 0.02) / mk * swing));
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
  if (item.kind === 'cat') {
    addItem(p, makeCatalyst(item.id));
    say(`${item.n}을(를) 샀다. (-${cost})`, 'good');
    return;
  }
  if (item.kind === 'relic') {
    takeRelic(item.id);
    G.relicShelf = null;                 // the shelf restocks
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
  if (haggleState()?.sour) { say('상인이 고개를 젓는다. 오늘은 아니다.', 'warn'); return; }
  const gain = priceOf(slot.item, false);
  p.gold += gain;
  removeItem(p, slotIdx);
  say(`${slot.item.n}을(를) 팔았다. (+${gain})`, 'good');
}

/* ── endings ────────────────────────────────────────────── */
/* The shape of a run, assembled once at the end. Everything
   here was already in G — it was simply never collected, so a
   death printed three numbers and told no story. */
export function summarise(win, by) {
  const p = G.player;
  return {
    win, by,
    race: p.race, cls: p.cls, lv: p.lv,
    depth: G.depth, turn: G.turn,
    gold: p.gold, combo: G.bestCombo || 0,
    hp: p.hp, maxhp: p.maxhp,
    relics: [...(p.relics || [])],
    weapon: p.equip.weapon ? affixName(p.equip.weapon) : null,
    weaponType: p.equip.weapon?.t || null,
    branch: G.branch?.n || null,
    bank: G.bank || 0,
    kills: G.kills || 0, opened: G.opened || 0,
    broke: G.broke || 0, forged: G.forged || 0,
    trans: G.transFound || 0, perfects: G.perfects || 0, fused: G.fused || 0,
    catUsed: G.catUsed || 0, engraved: G.engraved || 0,
    abyss: G.abyss || 0, memories: [...(G.memories || [])],
    reso: Object.keys(G.player?.reso || {}),
    events: G.eventsSeen || 0, waves: G.waves || 0,
    tail: G.log.slice(-3).map(l => l.text),
  };
}

/* How far a named thing will follow you from where it stands. */
const NAMED_LEASH = 9;

/* How many awake things could put a hand on that tile if you
   stood there. Melee counts adjacency, archers count their range
   through clear line — the same two tests the monsters themselves
   run, so the mark on the floor cannot promise something the
   rules will not do.

   This is information, not mercy. Nearly every avoidable death in
   a roguelike is "I did not know how many were in reach of that
   square", and the answer was always on screen — spread across
   eight sprites, a range stat and a wall you had to trace by eye.
   Doing that arithmetic is not the interesting decision; acting
   on it is. */
export function threatAt(x, y) {
  const L = G.level;
  if (!L || L.solid(x, y)) return 0;
  let n = 0;
  for (const m of G.monsters) {
    if (!m.awake || m.disguise || m.fleeing) continue;
    if (m.named && !m.provoked && !hasShackle('shadow')) continue;   // it stays home
    const d = Math.hypot(m.x - x, m.y - y);
    if (m.ai === 'ranged' && m.rng) {
      if (d <= m.rng && lineClear(L, m.x, m.y, x, y)) n++;
    } else if (d <= 1.5 + (m.spd || 1) - 1) n++;
  }
  return n;
}

/* One in forty crits, and never on the boss — the frame is the
   reward, and a boss fight is already carrying its own. */
const PERFECT_CHANCE = 0.025;
const CORRODE_CHANCE = 0.03;

function death(killer) {
  const p = G.player;
  /* 역류의. Checked here rather than at each of the eleven places
     that can reduce you to zero, so it cannot be missed at one of
     them. Once per floor, and the floor has to end before it comes
     back — otherwise it is not a rescue, it is a second health bar. */
  /* 순교. Not a rescue and not a heal — a debt. Everything turned
     aside is written down, and it all arrives the moment the five
     turns end. The only way to win the bet is to finish the fight
     inside it. Checked here for the same reason 역류의 is: eleven
     things can bring you to zero and none of them should have to
     know about this. */
  if (p.martyr > 0) {
    p.martyrDebt = (p.martyrDebt || 0) + (1 - p.hp);
    p.hp = 1;
    fx({ t:'martyrHold', x:p.x, y:p.y });
    say('무릎이 꺾이지 않는다. 아직은.', 'warn');
    return;
  }
  if (hasBoon('tide') && !G.tideUsed) {
    G.tideUsed = true;
    p.hp = Math.max(1, Math.floor(p.maxhp * 0.5));
    say('역류 — 죽음이 뒤로 밀려났다. 체력이 절반까지 돌아왔다.', 'level');
    fx({ t:'tide', x:p.x, y:p.y });
    return;
  }
  G.running = false;
  G.ending = { win:false, by: killer.n, summary: summarise(false, killer.n) };
  G.screen = 'end';
}

function victory() {
  G.running = false;
  G.ending = { win:true, summary: summarise(true, null) };
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
  // The ledger remembers every flask ever named, which is what
  // 연금술사의 기억 is counting.
  Meta.see('items', id);
  const c = CONSUMABLES.find(x => x.id === id);
  if (c && !quiet) say(`${lookOf(id)}은(는) ${c.n}이었다.`, 'level');
  return true;
}

export function startGame(raceKey, classKey, base) {
  /* The ladder is read *before* the hero is built. 재의 무게 takes
     a slice of maximum health inside recalc, and recalc runs the
     moment createHero is called — set the shackles after that and
     the last rung of the ladder silently does nothing. */
  G.abyss = Meta.abyss();
  G.shackles = shacklesAt(G.abyss);
  G.player = createHero(raceKey, classKey, base);
  G.log = []; G.turn = 0; G.running = true; G.ending = null;
  G.fx = []; G.combo = 0; G.comboT = 0; G.bestCombo = 0;
  G.opened = 0; G.mimicsBitten = 0; G.trapsSprung = 0; G.kills = 0; G.eventsSeen = 0;
  G.regionAt = null;
  G.broke = 0; G.forged = 0; G.transFound = 0; G.perfects = 0; G.fused = 0; G.catUsed = 0;
  G.did = {}; G.act = null; G.lit = {}; G.uproar = 0; G.uproarTier = 0;
  G.hpBand = new Array(10).fill(0); G.floorTurns = {};
  G.runSeed = Math.floor(Math.random() * 997);   // 판마다 행상의 기분표가 달라진다
  G.haggled = {}; G.haggleCut = null; G.haggleSour = null;
  G.engraved = 0; G.memories = []; G.relicShelf = null;
  G.branch = null; G.pendingBranch = null; G.pendingRelic = null;
  G.nextMods = null; G.campPromise = 0; G.deepest = 0;
  G.floorTurn = 0; G.waves = 0; G.campUses = 1; G.hazards = []; G.snares = []; G.sanctum = null; G.bank = 0;
  G.tally = 0; G.hushUntil = -1; G.resoFound = 0; G.forced = {}; G.uniques = {};
  G.pendingAltar = null;
  shuffleAppearances(G.player);

  /* ── what the last run left behind ──────────────────────
     Six memories, and none of them is a stat. Each hands over
     something the player already earned: the flask they named,
     the gold they dug out, the plus they ground. The curve is
     untouched; the starting line is not. */
  const meta = Meta.read();
  G.memories = MEMORIES.filter(x => memoryEarned(meta, x.id)).map(x => x.id);

  if (G.memories.includes('alchemy')) {
    // Everything ever named stays named. A player who has learned
    // what the red flask is should not have to learn it again.
    for (const id of Object.keys(meta.items || {})) G.known[id] = true;
  }
  if (G.memories.includes('smith')) {
    for (const slot of GEAR_SLOTS) {
      const it = G.player.equip[slot];
      if (it) it.plus = Math.max(it.plus || 0, 2);
    }
    recalc(G.player);
  }
  if (G.memories.includes('digger')) G.player.gold += 300;

  enterDepth(0);
  say('지붕이 남은 집이 없다. 수레 여섯 대가 한 골목에 모여 있고, 그 너머 폐허 끝에 내려가는 자리가 있다.', 'warn');
  if (G.memories.length)
    say(`기억이 남아 있다 — ${G.memories.map(id => MEMORIES.find(x => x.id === id).n).join(' · ')}.`, 'good');
  if (G.abyss)
    say(`심연 ${G.abyss} — ${SHACKLES.slice(1, G.abyss + 1).map(x => x.k).join(' · ')}.`, 'warn');
  G.screen = 'play';
}

/* Does this run carry that memory? One reader so a memory can
   never be half-applied. */
export const hasMemory = id => (G.memories || []).includes(id);

/* Is this rule on this run? One reader, same shape as hasMemory,
   so a shackle can never be half-applied either. */
export const hasShackle = id => (G.shackles || []).includes(id);
