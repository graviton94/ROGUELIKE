/* ═══════════════════════════════════════════════════════════
   data.js — all game content lives here.

   The *shape* of these tables follows the classic Moria model:
   six attributes, race modifiers + experience penalty, six
   classes with hit dice and spell realms, monsters gated by
   dungeon depth, a town of six shops. The numbers are our own,
   tuned for a 25-level descent rather than Moria's 50.
   ═══════════════════════════════════════════════════════════ */

export const MAX_DEPTH = 15;
export const STATS = ['str', 'int', 'wis', 'dex', 'con', 'chr'];
export const STAT_NAME = { str:'힘', int:'지능', wis:'지혜', dex:'민첩', con:'체질', chr:'매력' };

/* ── races ────────────────────────────────────────────────
   xp: experience cost multiplier. Tougher races level slower. */
export const RACES = {
  human:     { name:'인간',      mod:{},                                          hp:0, xp:1.00, note:'균형 잡힌 표준. 가장 빠르게 성장한다.' },
  halfElf:   { name:'하프엘프',  mod:{ int:+1, dex:+1, con:-1 },                   hp:0, xp:1.10, note:'양쪽의 피를 절반씩. 어느 길도 막히지 않는다.' },
  elf:       { name:'엘프',      mod:{ int:+2, dex:+1, str:-1, con:-2 },           hp:-2, xp:1.20, note:'마법에 능하고 몸이 약하다. 눈이 밝다.' },
  halfling:  { name:'하플링',    mod:{ dex:+3, str:-2, con:+1, chr:+1 },           hp:-2, xp:1.10, note:'작고 빠르다. 그림자를 잘 쓴다.' },
  gnome:     { name:'노움',      mod:{ int:+2, wis:-2, dex:+2, str:-1 },           hp:-1, xp:1.25, note:'타고난 술사. 마비되지 않는다.' },
  dwarf:     { name:'드워프',    mod:{ str:+2, con:+2, int:-2, chr:-2 },           hp:+2, xp:1.20, note:'돌 밑에서 태어났다. 눈이 멀지 않는다.' },
  halfOrc:   { name:'하프오크',  mod:{ str:+2, int:-1, chr:-3 },                   hp:+1, xp:1.15, note:'맞아도 잘 죽지 않는다. 환영받지 못한다.' },
  halfTroll: { name:'하프트롤',  mod:{ str:+4, con:+3, int:-3, wis:-2, dex:-3, chr:-4 }, hp:+4, xp:1.45, note:'거대하고 둔하다. 상처가 저절로 아문다.' },
};

/* ── classes ──────────────────────────────────────────────
   hd:    hit dice bonus per level
   realm: null | 'arcane' (int) | 'divine' (wis)
   bth:   base to-hit progression per level                  */
export const CLASSES = {
  warrior: { name:'전사',     mod:{ str:+3, con:+2, int:-2, wis:-2 }, hd:9, bth:5.0, realm:null,     note:'주문 없이, 오직 무기로.' },
  mage:    { name:'마법사',   mod:{ int:+3, str:-2, con:-2 },         hd:0, bth:2.0, realm:'arcane', note:'지능이 곧 힘. 맞으면 죽는다.' },
  priest:  { name:'사제',     mod:{ wis:+3, str:-1, dex:-1 },         hd:2, bth:3.0, realm:'divine', note:'스스로를 고치며 나아간다.' },
  rogue:   { name:'도적',     mod:{ dex:+3, int:+1, str:-1, wis:-2 }, hd:6, bth:4.0, realm:'arcane', note:'먼저 치고, 잘 피한다.' },
  ranger:  { name:'레인저',   mod:{ dex:+2, int:+1, con:+1 },         hd:4, bth:4.5, realm:'arcane', note:'칼과 주문을 반씩 나눠 든다.' },
  paladin: { name:'팔라딘',   mod:{ str:+2, wis:+1, chr:+2, dex:-2 }, hd:6, bth:4.5, realm:'divine', note:'느리지만 무너지지 않는다.' },
};

/* ── spells ───────────────────────────────────────────────
   Unlocked by class level; cost mana.                       */
export const SPELLS = {
  arcane: [
    { id:'bolt',   name:'마력 화살',   short:'화살', lv:1,  cost:1,  desc:'시야의 적 하나에게 마력을 쏜다.' },
    { id:'blink',  name:'점멸',        short:'점멸', lv:3,  cost:2,  desc:'가까운 곳으로 순간 이동한다.' },
    { id:'detect', name:'생명 탐지',   short:'탐지', lv:5,  cost:3,  desc:'층의 모든 몬스터 위치를 읽는다.' },
    { id:'frost',  name:'서리 폭발',   short:'서리', lv:9,  cost:6,  desc:'주변 모든 적을 얼려 찢는다.' },
    { id:'map',    name:'지형 파악',   short:'지도', lv:13, cost:8,  desc:'이 층의 지도를 기억해 낸다.' },
  ],
  divine: [
    { id:'cure',   name:'경상 치유',   short:'치유', lv:1,  cost:1,  desc:'상처를 닫는다.' },
    { id:'bless',  name:'축복',        short:'축복', lv:3,  cost:2,  desc:'잠시 명중과 방어가 오른다.' },
    { id:'detect', name:'악 감지',     short:'감지', lv:5,  cost:3,  desc:'층의 모든 몬스터 위치를 읽는다.' },
    { id:'smite',  name:'응징의 빛',   short:'응징', lv:9,  cost:5,  desc:'시야의 적 하나를 빛으로 태운다.' },
    { id:'heal',   name:'중상 치유',   short:'회복', lv:13, cost:8,  desc:'깊은 상처까지 되돌린다.' },
  ],
};

/* ── status effects ───────────────────────────────────────
   Everything a monster can leave on you. `dur` is turns; the
   race immunities below are the ones the race notes already
   promised, now actually wired up.                          */
export const AILMENTS = {
  poison:  { n:'중독', tone:'e', note:'매 턴 피가 샌다' },
  blind:   { n:'실명', tone:'g', note:'등불이 한 칸까지 좁아진다' },
  fear:    { n:'공포', tone:'p', note:'명중이 크게 떨어진다' },
  slow:    { n:'둔화', tone:'b', note:'적이 두 배로 움직인다' },
  paralyze:{ n:'마비', tone:'R', note:'움직일 수 없다' },
};

export const IMMUNE = {
  gnome:     ['paralyze'],   // "마비되지 않는다"
  dwarf:     ['blind'],      // "눈이 멀지 않는다"
  halfTroll: ['fear'],
  elf:       ['fear'],
};

/* ── bestiary ─────────────────────────────────────────────
   spr:  sprite key      d:  first depth it appears
   rar:  spawn weight    hp/atk/ac/xp: combat profile
   ai:   'hunt' | 'erratic' | 'still' | 'ranged' | 'coward'
   spd:  actions per player turn (1.0 = even footing)
   rng:  tiles it can shoot from        grp: pack size [min,max]
   on:   ailment inflicted on a landed hit
   door: 'open' opens doors, 'smash' breaks them, absent = stopped
   regen: hp regained per turn                                */
export const MONSTERS = [
  { spr:'rat',     n:'커다란 쥐',        d:1,  rar:10, hp:5,   atk:3,  ac:1,  xp:2,   ai:'hunt',    grp:[1,3] },
  { spr:'bat',     n:'과일 박쥐',        d:1,  rar:9,  hp:6,   atk:3,  ac:3,  xp:3,   ai:'erratic', spd:1.7 },
  { spr:'mold',    n:'회색 곰팡이',      d:1,  rar:5,  hp:14,  atk:5,  ac:1,  xp:5,   ai:'still',   on:'poison' },
  { spr:'snake',   n:'흰 큰뱀',          d:2,  rar:8,  hp:10,  atk:4,  ac:3,  xp:5,   ai:'hunt',    on:'poison' },
  { spr:'kobold',  n:'코볼드',           d:2,  rar:10, hp:12,  atk:6,  ac:4,  xp:8,   ai:'hunt',    grp:[2,4], door:'open' },
  { spr:'kobold',  n:'코볼드 투석꾼',    d:2,  rar:7,  hp:9,   atk:5,  ac:3,  xp:11,  ai:'ranged',  rng:5, spd:0.65, grp:[1,2], door:'open' },
  { spr:'dog',     n:'들개',             d:2,  rar:9,  hp:11,  atk:6,  ac:3,  xp:9,   ai:'coward',  spd:1.3, grp:[2,3] },
  { spr:'jelly',   n:'푸른 젤리',        d:3,  rar:5,  hp:34,  atk:8,  ac:1,  xp:20,  ai:'still',   on:'slow' },
  { spr:'spider',  n:'동굴 거미',        d:3,  rar:8,  hp:16,  atk:8,  ac:5,  xp:16,  ai:'hunt',    spd:1.3, on:'poison', web:true },
  { spr:'orc',     n:'오크 병사',        d:3,  rar:11, hp:24,  atk:10, ac:7,  xp:24,  ai:'hunt',    grp:[2,4], door:'open' },
  { spr:'orc',     n:'오크 궁수',        d:4,  rar:7,  hp:20,  atk:9,  ac:6,  xp:28,  ai:'ranged',  rng:6, spd:0.7, grp:[1,2], door:'open' },
  { spr:'orc',     n:'검은 오크',        d:5,  rar:9,  hp:36,  atk:13, ac:9,  xp:42,  ai:'hunt',    grp:[2,4], door:'open' },
  { spr:'dog',     n:'늑대',             d:5,  rar:8,  hp:30,  atk:12, ac:6,  xp:38,  ai:'hunt',    spd:1.35, grp:[2,4] },
  { spr:'ogre',    n:'오우거',           d:6, rar:8,  hp:52,  atk:16, ac:10, xp:70,  ai:'hunt',    spd:0.75, door:'smash' },
  { spr:'mummy',   n:'미라',             d:7, rar:6,  hp:48,  atk:15, ac:12, xp:75,  ai:'hunt',    spd:0.65, on:'fear' },
  { spr:'troll',   n:'동굴 트롤',        d:8, rar:9,  hp:70,  atk:19, ac:13, xp:110, ai:'hunt',    door:'smash', regen:2 },
  { spr:'wraith',  n:'망령',             d:9, rar:7,  hp:60,  atk:20, ac:15, xp:130, ai:'erratic', spd:1.2, on:'fear' },
  { spr:'giant',   n:'언덕 거인',        d:9, rar:7,  hp:95,  atk:23, ac:14, xp:170, ai:'ranged',  rng:5, spd:0.6, door:'smash' },
  { spr:'vampire', n:'흡혈귀',           d:11, rar:6,  hp:88,  atk:26, ac:17, xp:220, ai:'hunt',    spd:1.25, on:'blind', door:'open', regen:3 },
  { spr:'dragon',  n:'어린 붉은 용',     d:11, rar:5,  hp:120, atk:28, ac:20, xp:300, ai:'ranged',  rng:6, spd:0.7, door:'smash' },
  { spr:'wyrm',    n:'서리 비룡',        d:12, rar:5,  hp:140, atk:31, ac:22, xp:380, ai:'ranged',  rng:6, spd:0.7, on:'slow', door:'smash' },
  { spr:'lich',    n:'리치',             d:14, rar:4,  hp:130, atk:35, ac:24, xp:480, ai:'ranged',  rng:7, spd:0.75, on:'paralyze', door:'open' },
];

/* ── telegraphed attacks ──────────────────────────────────
   The classic boss vocabulary, in a grid: mark the ground,
   count down where the player can read it, then hit everything
   still standing there. Three shapes cover almost all of it —
   a line down a row or column, a countdown blob, and a ring
   that walks outward — and each asks a different question of
   your position.

   `warn` is how many turns of marked ground you get before it
   lands. One turn is a reflex, two is a plan. Damage is a
   fraction of the caster's attack so one table serves an elite
   on floor 4 and the Ember Emperor on floor 15.

   Friendly fire is on. A boss that burns its own escort is a
   boss you can fight with the room instead of against it. */
export const PATTERNS = {
  beam:  { n:'베기',     warn:1, dmgPct:1.55, tone:'R', reach:9,
           say:'이(가) 팔을 옆으로 길게 뻗는다.' },
  cross: { n:'십자',     warn:2, dmgPct:1.30, tone:'o', reach:7,
           say:'이(가) 바닥에 십자를 긋는다.' },
  zone:  { n:'낙하',     warn:2, dmgPct:1.85, tone:'y', r:2,
           say:'이(가) 위를 올려다본다. 천장에서 흙이 떨어진다.' },
  /* ring: centred on the caster rather than on you. 불길 has to
     start at its feet or the growth steps land somewhere else
     than the first ring did. */
  wave:  { n:'불길',     warn:1, dmgPct:1.10, tone:'o', r:1, grow:4, ring:true,
           say:'의 발밑에서 불이 번진다.' },
  quake: { n:'진동',     warn:2, dmgPct:1.00, tone:'N', r:3, ring:true,
           say:'이(가) 발을 굴렀다. 바닥에 금이 간다.' },
};

/* ── the named ────────────────────────────────────────────
   Two mid-bosses and the emperor. A floor you *know* has a
   named thing on it is a floor you approach differently, and
   the patterns are the reason the approach matters. */
/* Set against the surveyed hero at each depth rather than by
   feel. On floor 5 that hero is level 6 with 79 health and deals
   15 a turn; on 15 it is level 28 with 341 and deals 41. A named
   thing should take ten turns to bring down and be able to kill
   a careless hero in five.

   The emperor is sized by staging the fight rather than by
   arithmetic: a hero at each power level the survey says can
   arrive on floor 15, dropped in a room with it, thirty times.
   900/60 was unwinnable at every level; 620/38 was won thirty
   times out of thirty from level 20 up, which is not a final
   boss. 780/46 sits where a level-18 hero with no upgrades
   loses about half the time and a well-built one wins.

   That lab result is generous by construction — full health, a
   pocket of potions, an empty room and no clock. Arriving on
   floor 15 in that shape is the actual test. */
export const NAMED = [
  { at:5,  spr:'ogre',  n:'뼈를 씹는 자', hp:150, atk:13, ac:14, xp:700,
    ai:'hunt', spd:0.9, door:'smash', regen:2, heavy:true, named:true,
    casts:['quake', 'zone'], cool:5,
    intro:'무언가 커다란 것이 이 층에서 기다리고 있다.' },
  { at:10, spr:'wraith', n:'재 속의 사제', hp:300, atk:26, ac:22, xp:1800,
    ai:'hunt', spd:1.1, on:'fear', door:'open', regen:3, heavy:true, named:true,
    casts:['cross', 'wave'], cool:4,
    intro:'차가운 것이 이 층의 공기를 마시고 있다.' },
];

export const BOSS = {
  spr:'balemperor', n:'잿불의 대군주', hp:780, atk:46, ac:30, xp:5000,
  ai:'hunt', spd:1.15, on:'fear', door:'smash', regen:4, boss:true, heavy:true,
  casts:['beam', 'wave', 'zone', 'quake'], cool:3,
};

/* ── the wager ────────────────────────────────────────────
   Two systems for the part of the brain that plays slot
   machines, both built on the same principle: the player must
   be able to *stop*, and stopping must feel like a loss.

   The bank grows every floor you descend without sitting at a
   fire. It is paid out in full the moment you do sit — and it
   dies with you. So every fire is the same question a gambler
   asks at every table: take the pile, or go one more.

   Deliberately paid in materials and gold rather than health.
   A payout you cannot spend until the next fire is a promise;
   a payout you can spend on the fire you are sitting at closes
   the loop in one gesture. */
export const BANK_STEP = 0.5;          // multiplier gained per floor unrested
export const BANK_MAX  = 6;

export const bankPurse = (floors, depth) => ({
  gold:  Math.round(floors * BANK_STEP * (40 + depth * 22)),
  scrap: Math.round(floors * BANK_STEP * 1.6),
  dust:  Math.round(floors * BANK_STEP * 1.0),
  essence: floors >= 4 ? Math.floor(floors / 4) : 0,
});

/* The golden thief. Runs the moment it sees you, is worth a
   great deal, and cannot be cornered by walking — you have to
   spend something (a roll, a spell, a scroll) or let it go.
   The clock is what makes letting it go a real option. */
export const THIEF = {
  spr:'thief', n:'금빛 도둑', ai:'coward', spd:1.6, thief:true,
  hp:26, atk:4, ac:18, xp:120, d:2, rar:0,
};
export const thiefChance = depth => (depth >= 2 ? 0.16 : 0);
export const thiefPurse = depth => ({
  gold: 220 + depth * 90,
  scrap: 4 + Math.floor(depth / 2),
  dust: 3 + Math.floor(depth / 3),
  essence: depth >= 6 ? 2 : 1,
});

/* ── stamina ──────────────────────────────────────────────
   One resource, one use: the dodge roll. A telegraphed attack
   with no way to answer it is a tax; the roll is the answer,
   and stamina is what stops it from being the answer to
   everything. */
export const ROLL_COST = 2;
export const ROLL_DIST = 2;
export const staminaMax = p => 3 + Math.floor(p.lv / 6) + Math.max(0, statBonus(p.stats.dex));
export const STAM_REGEN_EVERY = 2;

/* A chest is a monster you have not identified yet. Its profile
   is derived from the floor rather than fixed, because a chest
   on level 1 that hits like a level 10 ogre is not a gamble —
   it is just a death sentence with a lid. */
export const mimicFor = depth => ({
  spr:'chest', n:'미믹', ai:'hunt', disguise:true,
  hp:  Math.round(14 + depth * 3.6),
  atk: Math.round(5  + depth * 1.15),
  ac:  Math.round(3  + depth * 0.8),
  xp:  Math.round(18 + depth * 9),
  // Only the deep ones can lock you in place.
  on: depth >= 9 ? 'paralyze' : depth >= 4 ? 'fear' : null,
});

/* ── traps ────────────────────────────────────────────────
   Invisible until they fire or you spot them. Detection is a
   per-step roll off wisdom and class, so a priest walking a
   corridor is doing something a warrior isn't.              */
export const TRAPS = {
  dart:     { n:'화살 함정',   msg:'벽에서 화살이 튀어나온다.' },
  poison:   { n:'독침 함정',   msg:'바늘이 발목을 찌른다.' },
  pit:      { n:'구덩이',      msg:'바닥이 꺼진다.' },
  teleport: { n:'전이의 마법진', msg:'발밑의 문양이 타오른다.' },
  alarm:    { n:'경보 장치',   msg:'날카로운 종소리가 층 전체에 울린다.' },
};

/* ── weapons ──────────────────────────────────────────────
   A weapon used to be a damage die with a name on it, which
   meant "which sword" was arithmetic rather than a decision.
   Six families, each with a rule instead of a number, so the
   choice is about *how you fight* — and so the same affix reads
   differently depending on what it is bolted to.

   The interactions are the point: 연쇄 on an axe hits five
   bodies, 처형 on a dagger gets two rolls a turn, 반격 range on
   a spear means the thing winding up never reaches you. */
export const WEAPON_TYPES = {
  dagger: { n:'단검류', t:'한 턴에 두 번 찌른다(각 62%). 치명타 +8%p.' },
  sword:  { n:'검류',   t:'기준. 특별한 규칙이 없는 만큼 약점도 없다.' },
  axe:    { n:'도끼류', t:'벤 자리 양옆까지 함께 벤다(70% 피해).' },
  spear:  { n:'창류',   t:'두 칸 거리에서 찌른다. 붙지 않고 싸운다.' },
  mace:   { n:'둔기류', t:'30%로 비틀거리게 만든다 — 그 적은 다음 턴을 잃는다.' },
  great:  { n:'대검류', t:'피해 +45%, 명중 −12%. 치명타는 인접한 전부를 벤다.' },
};

/* Weapons carry dice (count × sides) and a type. Armour carries ac. */
export const WEAPONS = [
  { spr:'sword', n:'단검',         t:'dagger', dice:[1,5],  d:0,  cost:20,   hands:1 },
  { spr:'mace',  n:'곤봉',         t:'mace',   dice:[1,7],  d:0,  cost:24,   hands:1 },
  { spr:'sword', n:'짧은 검',      t:'sword',  dice:[1,8],  d:1,  cost:70,   hands:1 },
  { spr:'axe',   n:'창',           t:'spear',  dice:[1,9],  d:1,  cost:85,   hands:2 },
  { spr:'mace',  n:'철퇴',         t:'mace',   dice:[2,4],  d:2,  cost:90,   hands:1 },
  { spr:'axe',   n:'손도끼',       t:'axe',    dice:[1,10], d:2,  cost:130,  hands:1 },
  { spr:'sword', n:'사냥칼',       t:'dagger', dice:[1,9],  d:2,  cost:150,  hands:1 },
  { spr:'sword', n:'장검',         t:'sword',  dice:[2,6],  d:3,  cost:260,  hands:1 },
  { spr:'mace',  n:'전투 망치',    t:'mace',   dice:[3,4],  d:5,  cost:320,  hands:1 },
  { spr:'axe',   n:'전투 도끼',    t:'axe',    dice:[2,9],  d:6,  cost:520,  hands:2 },
  { spr:'axe',   n:'장창',         t:'spear',  dice:[2,8],  d:7,  cost:700,  hands:2 },
  { spr:'sword', n:'양손검',       t:'great',  dice:[3,7],  d:8,  cost:900,  hands:2 },
  { spr:'sword', n:'가시 단도',    t:'dagger', dice:[2,7],  d:9,  cost:1100, hands:1 },
  { spr:'axe',   n:'미늘창',       t:'spear',  dice:[4,6],  d:10, cost:1400, hands:2 },
  { spr:'mace',  n:'파쇄추',       t:'great',  dice:[4,7],  d:11, cost:2200, hands:2 },
  { spr:'sword', n:'룬이 새겨진 검', t:'sword', dice:[4,8], d:12, cost:3000, hands:1 },
  /* Every family needs a late-game entry or the choice collapses
     back into "take the biggest die" by floor 10. */
  { spr:'mace',  n:'별철퇴',       t:'mace',   dice:[2,9],  d:8,  cost:820,  hands:1 },
  { spr:'mace',  n:'룬 철퇴',      t:'mace',   dice:[3,9],  d:12, cost:2600, hands:1 },
  { spr:'sword', n:'서슬 단검',    t:'dagger', dice:[3,7],  d:12, cost:2400, hands:1 },
  { spr:'axe',   n:'쌍날 도끼',    t:'axe',    dice:[3,8],  d:12, cost:2700, hands:2 },
  { spr:'axe',   n:'용창',         t:'spear',  dice:[4,7],  d:13, cost:3200, hands:2 },
];

export const ARMOURS = [
  { spr:'armor',  n:'부드러운 가죽갑옷', ac:4,  d:0,  cost:24,   slot:'body' },
  { spr:'armor',  n:'징 박은 가죽갑옷',  ac:7,  d:2,  cost:90,   slot:'body' },
  { spr:'armor',  n:'사슬 갑옷',         ac:12, d:3,  cost:280,  slot:'body' },
  { spr:'armor',  n:'비늘 갑옷',         ac:16, d:6,  cost:600,  slot:'body' },
  { spr:'armor',  n:'판금 갑옷',         ac:22, d:9, cost:1300, slot:'body' },
  { spr:'armor',  n:'미스릴 갑옷',       ac:30, d:12, cost:3600, slot:'body' },
  { spr:'shield', n:'작은 방패',         ac:3,  d:0,  cost:20,   slot:'shield' },
  { spr:'shield', n:'둥근 방패',         ac:6,  d:3,  cost:110,  slot:'shield' },
  { spr:'shield', n:'탑 방패',           ac:11, d:7, cost:480,  slot:'shield' },
];

/* ── the unknown ──────────────────────────────────────────
   A potion you can name is a resource; a potion you cannot is a
   decision. Appearances are shuffled per run, so the red flask
   that saved you last time might be the one that blinds you now.
   This is the cheapest luck the game can buy — it costs no extra
   controls and renews itself every single run. */
export const POTION_LOOKS = [
  '진홍색', '탁한', '거품이는', '은빛', '검은', '기름진', '맑은', '연기 나는', '푸른', '노란',
];
export const SCROLL_LOOKS = [
  '봉인된', '찢어진', '금박', '낡은', '붉은 인장', '기호가 적힌', '피로 쓴', '눅눅한',
];

/* `desc` is what it does, in numbers, once you know what it is.
   Every identified flask showed "사용 가능" — which is to say,
   the game hid the effect twice: before identification because
   that is the gamble, and after identification for no reason at
   all. The second one was just missing text. */
export const CONSUMABLES = [
  { id:'potHeal',  spr:'potion', n:'치유의 물약',     d:0,  cost:22,  rar:12, use:'heal',
    desc:'체력 20 + 2d8 + 레벨×2 회복' },
  { id:'potCure',  spr:'potion', n:'중상 치유 물약',  d:5,  cost:90,  rar:7,  use:'bigHeal',
    desc:'최대 체력의 60% + 3d10 회복' },
  { id:'potMana',  spr:'potion', n:'정신의 물약',     d:2,  cost:60,  rar:8,  use:'mana',
    desc:'최대 마나의 50% + 1d6 회복' },
  { id:'scrMap',   spr:'scroll', n:'지도 두루마리',   d:2,  cost:70,  rar:8,  use:'map',
    desc:'이 층의 지형이 전부 드러난다' },
  { id:'scrTele',  spr:'scroll', n:'전이 두루마리',   d:3,  cost:80,  rar:8,  use:'teleport',
    desc:'이 층의 무작위 지점으로 날아간다' },
  { id:'scrFlee',  spr:'scroll', n:'탈출의 두루마리', d:3,  cost:120, rar:7,  use:'flee',
    desc:'선 자리에서 즉시 한 층 내려간다 (갈림길 없음)' },
  { id:'torch',    spr:'torch',  n:'횃불',            d:0,  cost:14,  rar:12, use:'torch',
    desc:'기름 +900 (최대 2600)' },

  /* Only ever found, never stocked — the merchant will not sell
     you something he cannot name either. Half of these are worth
     drinking and half are not, which is the point. */
  { id:'potMight', spr:'potion', n:'격노의 물약',   d:2, cost:110, rar:6, use:'might',   found:true,
    desc:'40턴 동안 피해 +60%' },
  { id:'potIron',  spr:'potion', n:'무쇠의 물약',   d:3, cost:110, rar:6, use:'iron',    found:true,
    desc:'40턴 동안 방어 +10' },
  { id:'potVenom', spr:'potion', n:'독의 물약',     d:1, cost:20,  rar:7, use:'venom',   found:true,
    desc:'2d5 + 깊이 피해를 입고 20턴 중독 — 나쁜 물약' },
  { id:'potMurk',  spr:'potion', n:'혼탁의 물약',   d:2, cost:20,  rar:6, use:'murk',    found:true,
    desc:'22턴 실명, 시야가 한 칸 — 나쁜 물약' },
  { id:'scrForge', spr:'scroll', n:'제련의 두루마리', d:4, cost:200, rar:5, use:'forge',  found:true,
    desc:'착용 중인 물건 하나가 +1 (최대 +5)' },
  { id:'scrHex',   spr:'scroll', n:'저주의 두루마리', d:2, cost:20,  rar:5, use:'hex',    found:true,
    desc:'착용 중인 물건 하나에 저주가 붙는다 — 나쁜 두루마리' },
];

/* Which item ids hide behind an appearance until you try them. */
export const UNKNOWABLE = CONSUMABLES
  .filter(c => c.spr === 'potion' || c.spr === 'scroll')
  .map(c => c.id);

/* ── the town ─────────────────────────────────────────────
   Six shops, as on Moria's level 0.                        */
export const SHOPS = [
  { id:1, n:'잡화점',   spr:'torch',  stock:['torch','potHeal','scrMap'] },
  { id:2, n:'방어구점', spr:'armor',  stock:'armour' },
  { id:3, n:'무기점',   spr:'sword',  stock:'weapon' },
  { id:4, n:'신전',     spr:'amulet', stock:['potHeal','potCure'] },
  { id:5, n:'연금술사', spr:'potion', stock:['potHeal','potMana','potCure'] },
  { id:6, n:'마법상',   spr:'wand',   stock:['scrMap','scrTele','scrFlee','potMana'] },
  /* Not in town. This one walks the dungeon, which is the only
     reason the gold in your purse means anything after floor 1. */
  { id:7, n:'떠돌이 상인', spr:'amulet', wander:true,
    stock:['potHeal','potCure','potMana','scrTele','scrMap','scrFlee','torch'],
    mats:['scrap','dust','essence'] },
];

/* ── affixes ──────────────────────────────────────────────
   One vocabulary, three users: gear, spells and monsters. The
   fields are all additive except dmgPct, and that is on purpose
   — the multiplicative one is where the absurd builds live. Put
   흡혈 + 연쇄 + 작열 on one weapon and a swing chains into a
   second target, the kill detonates, and the detonation feeds
   you. None of those three lines knows about the other two.

   tags gates what a roll can land on. `curse` marks a downside
   so the enchant gamble has something to lose to.             */
export const PREFIXES = [
  { id:'keen',    n:'예리한',   tags:['weapon'], crit:0.09, critMult:0.15 },
  { id:'heavy',   n:'묵직한',   tags:['weapon'], dmg:4, hit:-3 },
  { id:'vamp',    n:'흡혈의',   tags:['weapon'], lifesteal:0.18 },
  { id:'chain',   n:'연쇄의',   tags:['weapon'], chain:0.45 },
  { id:'venom',   n:'맹독의',   tags:['weapon'], on:'poison' },
  { id:'blazing', n:'작열하는', tags:['weapon'], burst:0.55 },
  { id:'swift',   n:'신속한',   tags:['weapon'], hit:5, crit:0.04 },
  { id:'rending', n:'꿰뚫는',   tags:['weapon'], pierce:0.5 },

  { id:'sturdy',  n:'견고한',   tags:['armour'], ac:5 },
  { id:'light',   n:'가벼운',   tags:['armour'], ac:-2, stealth:0.14 },
  { id:'runed',   n:'룬이 새겨진', tags:['armour'], resist:'all' },
  { id:'living',  n:'살아있는', tags:['armour'], regen:2 },
  { id:'lantern', n:'등불의',   tags:['armour'], lightR:3 },

  { id:'dull',    n:'무딘',     tags:['weapon'], dmg:-3, curse:true },
  { id:'loud',    n:'시끄러운', tags:['weapon','armour'], stealth:-0.25, curse:true },
  { id:'brittle', n:'삭은',     tags:['armour'], ac:-4, curse:true },
];

export const SUFFIXES = [
  { id:'fury',    n:'분노',     tags:['weapon'], dmgPct:0.28 },
  { id:'precision', n:'정밀',   tags:['weapon'], hit:8 },
  { id:'thirst',  n:'갈증',     tags:['weapon'], lifesteal:0.12, dmg:2 },
  { id:'execution', n:'처형',   tags:['weapon'], execute:0.22 },
  { id:'storm',   n:'폭풍',     tags:['weapon'], chain:0.30, dmg:2 },
  { id:'ruin',    n:'파멸',     tags:['weapon'], critMult:0.7 },

  { id:'ward',    n:'수호',     tags:['armour'], ac:4 },
  { id:'shadow',  n:'그림자',   tags:['armour'], stealth:0.16 },
  { id:'vigour',  n:'활력',     tags:['armour'], maxhpPct:0.12 },
  { id:'mind',    n:'정신',     tags:['armour'], manaPct:0.25 },

  { id:'weight',  n:'짐',       tags:['weapon','armour'], hit:-6, curse:true },
  { id:'decay',   n:'부패',     tags:['armour'], regen:-1, curse:true },
];

/* Spells take the same shape, smaller vocabulary. */
export const SPELL_AFFIXES = [
  { id:'echo',    n:'메아리치는', chainSpell:true, note:'두 번째 대상에게도 절반이 간다' },
  { id:'greater', n:'강대한',   powPct:0.40,   note:'위력 +40%' },
  { id:'cheap',   n:'간결한',   costCut:1,     note:'소모 마나 -1' },
  { id:'draining',n:'흡수하는', spellSteal:0.25, note:'입힌 피해의 1/4을 회복한다' },
  { id:'wild',    n:'거친',     powPct:0.9, costUp:2, note:'위력 +90%, 마나 +2' },
];

/* Monsters get prefixes too — the same idea, pointed at you. An
   elite is worth killing: more experience, better drops. */
export const ELITES = [
  { id:'quick',  n:'재빠른',   spd:0.45 },
  { id:'huge',   n:'거대한',   hpPct:0.65, atkPct:0.20 },
  { id:'iron',   n:'강철의',   ac:7 },
  { id:'toxic',  n:'맹독의',   on:'poison' },
  { id:'feral',  n:'광폭한',   atkPct:0.45, hpPct:-0.15 },
  { id:'leech',  n:'흡혈하는', drain:0.35 },
];

/* ── rarity ───────────────────────────────────────────────
   A good drop has to *look* good from across the room, or it is
   just another line in a list. Four tiers, one colour each, and
   anything above plain throws a beam of light on the floor so
   you can see it before you can read it. */
export const RARITY = [
  { n:'평범', tone:'w', glow:null },
  { n:'마법', tone:'B', glow:'#5b9bd5' },
  { n:'희귀', tone:'y', glow:'#e8c76a' },
  { n:'유물', tone:'P', glow:'#b57ad0' },
];
export const CURSED_TONE = 'R';

export function rarityOf(item) {
  if (!item || (item.kind !== 'weapon' && item.kind !== 'armour')) return 0;
  const pre = PREFIXES.find(a => a.id === item.pre);
  const suf = SUFFIXES.find(a => a.id === item.suf);
  const score = (pre ? 2 : 0) + (suf ? 2 : 0) + (item.plus || 0)
              + (item.d >= 13 ? 1 : 0);
  return score >= 6 ? 3 : score >= 4 ? 2 : score >= 1 ? 1 : 0;
}

export const isCursed = item =>
  !!(PREFIXES.find(a => a.id === item?.pre)?.curse
  || SUFFIXES.find(a => a.id === item?.suf)?.curse);

export const affixName = (item) => {
  const pre = item.pre ? PREFIXES.find(a => a.id === item.pre) : null;
  const suf = item.suf ? SUFFIXES.find(a => a.id === item.suf) : null;
  const plus = item.plus ? `+${item.plus} ` : '';
  return `${plus}${pre ? pre.n + ' ' : ''}${item.n}${suf ? ' · ' + suf.n : ''}`;
};

/* ── materials ────────────────────────────────────────────
   The loop this game was missing. Before, gold piled up with
   nowhere to go, dropped gear was noise, and enhancement was
   free — so power only ever went up in a straight line. Now
   junk gear is the currency: break it for materials, spend
   materials and gold to get stronger. Every drop becomes a
   question (sell it, break it, or wear it) instead of litter. */
export const MATS = {
  scrap:   { n:'쇳조각',    note:'무기와 갑옷을 부수면 나온다', cost:14 },
  dust:    { n:'마력 가루', note:'속성이 붙은 물건에서만 나온다', cost:40 },
  essence: { n:'정수',      note:'정예가 떨구는 물건의 핵',      cost:150 },
};

/* What breaking a thing gives you. Tier comes from the item's
   depth band, so a mithril hauberk is worth breaking and a
   soft leather is not. */
export function salvageYield(item) {
  const tier = Math.max(0, Math.floor((item.d || 0) / 4));
  const affixes = (item.pre ? 1 : 0) + (item.suf ? 1 : 0);
  return {
    scrap:   2 + tier * 2 + (item.plus || 0) * 3,
    dust:    affixes * (1 + Math.floor(tier / 2)),
    essence: tier >= 4 || (item.plus || 0) >= 4 ? 1 : 0,
  };
}

/* Enhancement costs climb steeply so +5 is a campaign, not a
   formality. Gold finally has a hole to fall into. */
export const upgradeCost = plus => ({
  scrap: 3 + plus * 3,
  gold:  50 + plus * 90,
});

export const ENCHANT_COST = { dust: 4, gold: 130 };
export const REROLL_COST  = { essence: 1, dust: 2, gold: 220 };

/* ── the altar ────────────────────────────────────────────
   Luck, made legible. The odds are printed on the screen before
   you commit, because a gamble you cannot price is not a
   decision — it is just a surprise. Three things to offer, each
   with its own risk profile: blood is cheap when you are healthy
   and suicidal when you are not; gold is painless if you have
   nowhere to spend it; gear is the real cost. */
export const ALTAR_OFFERS = [
  { id:'blood', n:'피를 바친다',   cost:'현재 체력의 40%',
    odds:[['대성공', 18], ['성공', 44], ['허탕', 26], ['재앙', 12]] },
  { id:'gold',  n:'금화를 바친다', cost:'가진 금화의 절반',
    odds:[['대성공', 14], ['성공', 52], ['허탕', 28], ['재앙', 6]] },
  { id:'gear',  n:'장비를 바친다', cost:'착용 중인 물건 하나',
    odds:[['대성공', 30], ['성공', 46], ['허탕', 18], ['재앙', 6]] },
];

/* ── relics ───────────────────────────────────────────────
   Affixes make a number bigger. A relic changes what the game
   does — that is the whole difference, and it is why five of
   these produce more distinct runs than fifty +1 swords.

   Every one is a trade with a real downside, so picking one is
   a decision rather than a pickup. `k` is the hook the rules
   layer switches on; `v` is that hook's single parameter. Five
   slots, no more: a build you cannot fill is a build you had to
   choose. */
/* Slots grow with the descent. Five was one interesting decision
   and then a wall: by floor 8 every relic offer was "swap or
   refuse", which taught the player to stop reading them. Growing
   the hand means the early game is tight and the late game is
   where the absurd combinations actually assemble — which is the
   part worth playing for. */
export const RELIC_SLOTS_BASE = 4;
export const RELIC_SLOT_DEPTHS = [4, 8, 12];      // +1 slot on reaching each
export const relicSlots = deepest =>
  RELIC_SLOTS_BASE + RELIC_SLOT_DEPTHS.filter(d => deepest >= d).length;
export const RELIC_SLOTS = RELIC_SLOTS_BASE + RELIC_SLOT_DEPTHS.length;   // 7, the cap

export const RELICS = [
  { id:'pact',    n:'피의 계약',     spr:'amulet', k:'pact',    v:0.25,
    t:'최대 체력 −25%. 치명타 확률 +20%p.' },
  { id:'echo',    n:'메아리의 종',   spr:'amulet', k:'echo',    v:6,
    t:'연격 6 이상이면 공격이 한 번 더 들어간다.' },
  { id:'hunger',  n:'굶주린 칼날',   spr:'sword',  k:'hunger',  v:3,
    t:'처치할 때마다 체력 +3. 기름을 두 배로 태운다.' },
  { id:'mirror',  n:'거울 방패',     spr:'shield', k:'mirror',  v:0.35,
    t:'받은 피해의 35%를 때린 쪽에 돌려준다.' },
  { id:'eye',     n:'심연의 눈',     spr:'scroll', k:'eye',     v:3,
    t:'층에 들어설 때 지도가 전부 보인다. 최대 마나 −3.' },
  { id:'glove',   n:'도굴꾼의 장갑', spr:'ring',   k:'glove',   v:2,
    t:'상자와 바닥의 전리품이 두 배. 함정을 영영 못 본다.' },
  { id:'ember',   n:'불씨 항아리',   spr:'potion', k:'ember',   v:1,
    t:'모닥불을 두 번 쓸 수 있다.' },
  { id:'scale',   n:'저울추',        spr:'ring',   k:'scale',   v:0.6,
    t:'체력이 30% 아래일 때 주는 피해 +60%.' },
  { id:'twin',    n:'쌍둥이 룬',     spr:'wand',   k:'twin',    v:2,
    t:'주문 비용 −2. 주문 피해 −20%.' },
  { id:'thief',   n:'시간 도둑',     spr:'ring',   k:'thief',   v:0.35,
    t:'층을 내려갈 때 체력을 전부 회복한다. 층의 여유 시간 −35%.' },
  { id:'bone',    n:'뼈 목걸이',     spr:'amulet', k:'bone',    v:1,
    t:'처치할 때마다 최대 체력 +1 (최대 +30).' },
  { id:'chain',   n:'사슬 갑주',     spr:'armor',  k:'chain',   v:4,
    t:'방어 +4. 은신이 사라진다 — 기습은 없다.' },
  { id:'compass', n:'부러진 나침반', spr:'ring',   k:'compass', v:1,
    t:'함정 피해를 입지 않는다. 대신 함정이 보이지 않는다.' },
  { id:'gut',     n:'폭식의 위장',   spr:'potion', k:'gut',     v:2,
    t:'물약 효과가 두 배. 배낭에 물약을 세 종류까지만 넣는다.' },
  { id:'reckless',n:'무모함의 인장', spr:'sword',  k:'reckless',v:0.8,
    t:'명중 −15%. 치명타 배율 ×1.8.' },
  { id:'vow',     n:'침묵의 서약',   spr:'scroll', k:'vow',     v:0.3,
    t:'주문을 쓸 수 없다. 근접 피해 +30%.' },

  /* Second batch. With a hand that grows to seven, the pool has
     to be deep enough that two runs never hold the same five. */
  { id:'lamp',    n:'꺼지지 않는 등', spr:'torch', k:'lamp',    v:2,
    t:'기름이 줄지 않는다. 대신 불빛이 2칸 좁다.' },
  { id:'moth',    n:'나방의 표식',   spr:'ring',   k:'moth',    v:0.10,
    t:'층에 들어설 때 모닥불·제단·상인·사건 위치가 보인다. 최대 체력 −10%.' },
  { id:'knot',    n:'매듭 밧줄',     spr:'ring',   k:'knot',    v:0.5,
    t:'거미줄과 구덩이가 통하지 않는다. 은신 −50%.' },
  { id:'toll',    n:'뱃사공의 동전', spr:'gold',   k:'toll',    v:0.5,
    t:'금화를 두 배로 얻는다. 층을 내려갈 때 가진 금화의 10%를 잃는다.' },
  { id:'brand',   n:'낙인',          spr:'sword',  k:'brand',   v:0.5,
    t:'정예에게 주는 피해 +50%. 일반 몬스터에게 −15%.' },
  { id:'quill',   n:'서기의 깃펜',   spr:'scroll', k:'quill',   v:0.25,
    t:'미확인 물건을 주우면 바로 판별된다. 금화 획득 −25%.' },
  { id:'grudge',  n:'앙심',          spr:'amulet', k:'grudge',  v:0.04,
    t:'맞을 때마다 피해 +4% 누적(층마다 초기화, 최대 +60%).' },
  { id:'seed',    n:'돌씨',          spr:'armor',  k:'seed',    v:1,
    t:'층을 내려갈 때 방어 +1 영구. 최대 체력 −15%.' },
  { id:'wick',    n:'짧은 심지',     spr:'potion', k:'wick',    v:6,
    t:'물약을 마실 때 인접한 적이 타 들어간다. 회복량 −30%.' },
  { id:'drum',    n:'전쟁 북',       spr:'amulet', k:'drum',    v:2,
    t:'맞아도 연격을 4분의 1만 잃는다. 몬스터가 두 칸 더 멀리서 깨어난다.' },
];

export const relicById = id => RELICS.find(r => r.id === id);

/* ── the descent ──────────────────────────────────────────
   Slay the Spire's map, folded into one screen. Two ways down,
   both printed in advance, neither free. This is where a run
   stops being a straight line: the same character reaches floor
   9 rich and fragile or poor and armoured depending on six of
   these choices.

   `mon`/`item`/`elite` scale what populate() rolls; `flags` are
   read by the rules where they matter. Every branch that gives
   must also take, or it is not a choice. */
export const BRANCHES = [
  { id:'plain',  n:'평범한 계단', t:'특별할 것 없는 층.',
    mon:1,    item:1,   elite:1 },
  { id:'den',    n:'정예의 소굴', t:'정예가 두 배. 대신 유물이 하나 확정으로 떨어진다.',
    mon:1,    item:1,   elite:2.4, relic:1, tone:'R' },
  { id:'hoard',  n:'묻힌 보물고', t:'전리품 +80%, 상자 두 배. 몬스터도 30% 더 많다.',
    mon:1.3,  item:1.8, elite:1,   chests:2, tone:'y' },
  { id:'hush',   n:'고요한 층',   t:'몬스터 40% 감소. 전리품도 상자도 모닥불도 없다.',
    mon:0.6,  item:0.35, elite:0.5, noCamp:true, tone:'B' },
  { id:'starve', n:'마른 층',     t:'기름을 두 배로 태운다. 금화는 두 배로 나온다.',
    mon:1,    item:1,   elite:1,   drain:2, gold:2, tone:'o' },
  { id:'curse',  n:'저주받은 층', t:'모든 몬스터가 정예. 제단이 반드시 있고 유물도 하나.',
    mon:0.75, item:1,   elite:99,  relic:1, altar:true, tone:'P' },
  { id:'warren2',n:'무너진 굴',   t:'함정 두 배, 시야가 좁다. 재료가 두 배로 나온다.',
    mon:1,    item:1,   elite:1,   traps:2, mats:2, dim:true, tone:'N' },
  { id:'rush',   n:'무너지는 층', t:'여유 시간이 절반. 경험치가 두 배.',
    mon:1.15, item:1,   elite:1.3, clock:0.5, xp:2, tone:'R' },
];

/* ── the clock ────────────────────────────────────────────
   Vampire Survivors' real design is not the weapons, it is the
   timer: the screen fills whether you are ready or not, so
   power has to arrive faster than pressure. A dungeon without
   one lets a patient player rest away every mistake, which is
   exactly the "too easy and too slow" this game had.

   You get a generous budget per floor. After it runs out the
   floor starts feeding: a monster every so often, stronger each
   wave, and they know where you are. Nothing insta-kills you —
   it just makes standing still the losing move. */
export const FLOOR_BUDGET = d => 320 - d * 8;   // 15층 = 200턴
export const WAVE_EVERY   = 16;
export const WAVE_GROWTH  = 0.13;               // 파도마다 능력치 +13%

/* ── curves ───────────────────────────────────────────────
   The single number that decided this game was too easy. At
   10·lv^1.78 a run hit the level cap on floor 12 of 15: max
   health 554 against a bestiary whose deepest thing has 143,
   which meant one swing killed anything and forty swings were
   needed to kill you. Every system layered on top of that — the
   clock, the patterns, the elites — was a bandage on an
   arithmetic problem.

   2.28 lands the same total experience at roughly level 22 by
   the boss instead of 50 by floor 12, so the bestiary and the
   hero stay in the same conversation for the whole descent.
   The exponent is what matters; the coefficient was then set so
   that the hero is level 7 arriving on floor 5, which is where
   the bestiary steps up (검은 오크 and wolf packs) and where
   most deaths were landing.

   Cumulative, not per-level: gainXp compares the running total
   against this, it does not subtract. */
export const MAX_LEVEL = 30;
export const xpToLevel = lv => Math.floor(6 * Math.pow(lv, 2.28));
export const statBonus = v => Math.floor((v - 10) / 2);
