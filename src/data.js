/* ═══════════════════════════════════════════════════════════
   data.js — all game content lives here.

   The *shape* of these tables follows the classic Moria model:
   six attributes, race modifiers + experience penalty, six
   classes with hit dice and spell realms, monsters gated by
   dungeon depth, a town of six shops. The numbers are our own,
   tuned for a 25-level descent rather than Moria's 50.
   ═══════════════════════════════════════════════════════════ */

export const MAX_DEPTH = 25;
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
    { id:'bolt',   name:'마력 화살',   lv:1,  cost:1,  desc:'시야의 적 하나에게 마력을 쏜다.' },
    { id:'blink',  name:'점멸',        lv:3,  cost:2,  desc:'가까운 곳으로 순간 이동한다.' },
    { id:'detect', name:'생명 탐지',   lv:5,  cost:3,  desc:'층의 모든 몬스터 위치를 읽는다.' },
    { id:'frost',  name:'서리 폭발',   lv:9,  cost:6,  desc:'주변 모든 적을 얼려 찢는다.' },
    { id:'map',    name:'지형 파악',   lv:13, cost:8,  desc:'이 층의 지도를 기억해 낸다.' },
  ],
  divine: [
    { id:'cure',   name:'경상 치유',   lv:1,  cost:1,  desc:'상처를 닫는다.' },
    { id:'bless',  name:'축복',        lv:3,  cost:2,  desc:'잠시 명중과 방어가 오른다.' },
    { id:'detect', name:'악 감지',     lv:5,  cost:3,  desc:'층의 모든 몬스터 위치를 읽는다.' },
    { id:'smite',  name:'응징의 빛',   lv:9,  cost:5,  desc:'시야의 적 하나를 빛으로 태운다.' },
    { id:'heal',   name:'중상 치유',   lv:13, cost:8,  desc:'깊은 상처까지 되돌린다.' },
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
  { spr:'kobold',  n:'코볼드 투석꾼',    d:3,  rar:7,  hp:9,   atk:5,  ac:3,  xp:11,  ai:'ranged',  rng:5, spd:0.65, grp:[1,2], door:'open' },
  { spr:'dog',     n:'들개',             d:3,  rar:9,  hp:11,  atk:6,  ac:3,  xp:9,   ai:'coward',  spd:1.3, grp:[2,3] },
  { spr:'jelly',   n:'푸른 젤리',        d:4,  rar:5,  hp:34,  atk:8,  ac:1,  xp:20,  ai:'still',   on:'slow' },
  { spr:'spider',  n:'동굴 거미',        d:4,  rar:8,  hp:16,  atk:8,  ac:5,  xp:16,  ai:'hunt',    spd:1.3, on:'poison', web:true },
  { spr:'orc',     n:'오크 병사',        d:5,  rar:11, hp:24,  atk:10, ac:7,  xp:24,  ai:'hunt',    grp:[2,4], door:'open' },
  { spr:'orc',     n:'오크 궁수',        d:6,  rar:7,  hp:20,  atk:9,  ac:6,  xp:28,  ai:'ranged',  rng:6, spd:0.7, grp:[1,2], door:'open' },
  { spr:'orc',     n:'검은 오크',        d:8,  rar:9,  hp:36,  atk:13, ac:9,  xp:42,  ai:'hunt',    grp:[2,4], door:'open' },
  { spr:'dog',     n:'늑대',             d:8,  rar:8,  hp:30,  atk:12, ac:6,  xp:38,  ai:'hunt',    spd:1.35, grp:[2,4] },
  { spr:'ogre',    n:'오우거',           d:10, rar:8,  hp:52,  atk:16, ac:10, xp:70,  ai:'hunt',    spd:0.75, door:'smash' },
  { spr:'mummy',   n:'미라',             d:11, rar:6,  hp:48,  atk:15, ac:12, xp:75,  ai:'hunt',    spd:0.65, on:'fear' },
  { spr:'troll',   n:'동굴 트롤',        d:12, rar:9,  hp:70,  atk:19, ac:13, xp:110, ai:'hunt',    door:'smash', regen:2 },
  { spr:'wraith',  n:'망령',             d:14, rar:7,  hp:60,  atk:20, ac:15, xp:130, ai:'erratic', spd:1.2, on:'fear' },
  { spr:'giant',   n:'언덕 거인',        d:15, rar:7,  hp:95,  atk:23, ac:14, xp:170, ai:'ranged',  rng:5, spd:0.6, door:'smash' },
  { spr:'vampire', n:'흡혈귀',           d:17, rar:6,  hp:88,  atk:26, ac:17, xp:220, ai:'hunt',    spd:1.25, on:'blind', door:'open', regen:3 },
  { spr:'dragon',  n:'어린 붉은 용',     d:18, rar:5,  hp:120, atk:28, ac:20, xp:300, ai:'ranged',  rng:6, spd:0.7, door:'smash' },
  { spr:'wyrm',    n:'서리 비룡',        d:20, rar:5,  hp:140, atk:31, ac:22, xp:380, ai:'ranged',  rng:6, spd:0.7, on:'slow', door:'smash' },
  { spr:'lich',    n:'리치',             d:22, rar:4,  hp:130, atk:35, ac:24, xp:480, ai:'ranged',  rng:7, spd:0.75, on:'paralyze', door:'open' },
];

export const BOSS = {
  spr:'balemperor', n:'잿불의 대군주', hp:700, atk:46, ac:30, xp:6000,
  ai:'hunt', spd:1.15, on:'fear', door:'smash', regen:4, boss:true,
};

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

/* ── items ────────────────────────────────────────────────
   Weapons carry dice (count × sides). Armour carries ac.    */
export const WEAPONS = [
  { spr:'sword', n:'단검',         dice:[1,5],  d:0,  cost:20,   hands:1 },
  { spr:'sword', n:'짧은 검',      dice:[1,8],  d:1,  cost:70,   hands:1 },
  { spr:'mace',  n:'철퇴',         dice:[2,4],  d:2,  cost:90,   hands:1 },
  { spr:'axe',   n:'손도끼',       dice:[1,10], d:3,  cost:130,  hands:1 },
  { spr:'sword', n:'장검',         dice:[2,6],  d:5,  cost:260,  hands:1 },
  { spr:'mace',  n:'전투 망치',    dice:[3,4],  d:7,  cost:320,  hands:1 },
  { spr:'axe',   n:'전투 도끼',    dice:[2,9],  d:10, cost:520,  hands:2 },
  { spr:'sword', n:'양손검',       dice:[3,7],  d:13, cost:900,  hands:2 },
  { spr:'axe',   n:'미늘창',       dice:[4,6],  d:16, cost:1400, hands:2 },
  { spr:'sword', n:'룬이 새겨진 검', dice:[4,8], d:20, cost:3000, hands:1 },
];

export const ARMOURS = [
  { spr:'armor',  n:'부드러운 가죽갑옷', ac:4,  d:0,  cost:24,   slot:'body' },
  { spr:'armor',  n:'징 박은 가죽갑옷',  ac:7,  d:2,  cost:90,   slot:'body' },
  { spr:'armor',  n:'사슬 갑옷',         ac:12, d:5,  cost:280,  slot:'body' },
  { spr:'armor',  n:'비늘 갑옷',         ac:16, d:9,  cost:600,  slot:'body' },
  { spr:'armor',  n:'판금 갑옷',         ac:22, d:14, cost:1300, slot:'body' },
  { spr:'armor',  n:'미스릴 갑옷',       ac:30, d:19, cost:3600, slot:'body' },
  { spr:'shield', n:'작은 방패',         ac:3,  d:0,  cost:20,   slot:'shield' },
  { spr:'shield', n:'둥근 방패',         ac:6,  d:4,  cost:110,  slot:'shield' },
  { spr:'shield', n:'탑 방패',           ac:11, d:11, cost:480,  slot:'shield' },
];

export const CONSUMABLES = [
  { id:'potHeal',  spr:'potion', n:'치유의 물약',     d:0,  cost:22,  rar:12, use:'heal' },
  { id:'potCure',  spr:'potion', n:'중상 치유 물약',  d:8,  cost:90,  rar:7,  use:'bigHeal' },
  { id:'potMana',  spr:'potion', n:'정신의 물약',     d:2,  cost:60,  rar:8,  use:'mana' },
  { id:'scrMap',   spr:'scroll', n:'지도 두루마리',   d:2,  cost:70,  rar:8,  use:'map' },
  { id:'scrTele',  spr:'scroll', n:'전이 두루마리',   d:4,  cost:80,  rar:8,  use:'teleport' },
  { id:'scrDeep',  spr:'scroll', n:'심연의 두루마리', d:6,  cost:120, rar:5,  use:'deepDescent' },
  { id:'food',     spr:'food',   n:'말린 식량',       d:0,  cost:6,   rar:14, use:'food' },
  { id:'torch',    spr:'torch',  n:'횃불',            d:0,  cost:10,  rar:10, use:'torch' },
];

/* ── the town ─────────────────────────────────────────────
   Six shops, as on Moria's level 0.                        */
export const SHOPS = [
  { id:1, n:'잡화점',   spr:'food',   stock:['food','torch','potHeal'] },
  { id:2, n:'방어구점', spr:'armor',  stock:'armour' },
  { id:3, n:'무기점',   spr:'sword',  stock:'weapon' },
  { id:4, n:'신전',     spr:'amulet', stock:['potHeal','potCure'] },
  { id:5, n:'연금술사', spr:'potion', stock:['potHeal','potMana','potCure'] },
  { id:6, n:'마법상',   spr:'wand',   stock:['scrMap','scrTele','scrDeep','potMana'] },
  /* Not in town. This one walks the dungeon, which is the only
     reason the gold in your purse means anything after floor 1. */
  { id:7, n:'떠돌이 상인', spr:'amulet', wander:true,
    stock:['potHeal','potCure','potMana','scrTele','scrMap','food','torch'],
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

/* ── curves ───────────────────────────────────────────────*/
export const xpToLevel = lv => Math.floor(13 * Math.pow(lv, 1.92));
export const statBonus = v => Math.floor((v - 10) / 2);
