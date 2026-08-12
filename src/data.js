/* ═══════════════════════════════════════════════════════════
   data.js — all game content lives here.

   The *shape* of these tables follows the classic Moria model:
   six attributes, race modifiers + experience penalty, six
   classes with hit dice and spell realms, monsters gated by
   dungeon depth, a town of six shops. The numbers are our own,
   tuned for a 25-level descent rather than Moria's 50.
   ═══════════════════════════════════════════════════════════ */

export const MAX_DEPTH = 15;

/* ── 기억 ─────────────────────────────────────────────────
   What a dead run leaves behind. Six of them, and not one is a
   stat: every memory hands over an option or a piece of
   knowledge the player already earned, so the difficulty curve
   measured over the last three sessions stays exactly where it
   is. The change is that run five starts knowing what run one
   had to find out.

   `need(m)` reads the ledger in meta.js. `at(m)` and `of(m)` are
   for the progress line on the title screen — "34/50 상자" is a
   reason to open the next one.                                */
export const MEMORIES = [
  { id:'alchemy', n:'연금술사의 기억',
    t:'물약과 두루마리가 처음부터 판별되어 있다. 한 번 알아낸 것을 매 판 다시 알아낼 이유는 없다.',
    goal:'소모품 8종 판별', of:8,
    at: m => Object.keys(m.items || {}).length },
  { id:'pedlar',  n:'행상인의 기억',
    t:'마을 잡화점이 당신이 발견한 유물 하나를 판다. 비싸다.',
    goal:'유물 8종 발견', of:8,
    at: m => Object.keys(m.relics || {}).length },
  { id:'smith',   n:'장인의 기억',
    t:'시작 무기와 갑옷이 +2로 시작한다.',
    goal:'누적 강화 30단계', of:30,
    at: m => m.totals?.forged || 0 },
  { id:'digger',  n:'도굴꾼의 기억',
    t:'시작 금화 +300.',
    goal:'누적 상자 50개', of:50,
    at: m => m.totals?.opened || 0 },
  { id:'graver',  n:'세공사의 기억',
    t:'모루의 강화 성공률이 6%p 오른다. 각인이 붙는 한 방에도 적용된다.',
    goal:'각인 5개 새김', of:5,
    at: m => m.totals?.engraved || 0 },
  { id:'ember',   n:'잿불의 기억',
    t:'심연을 연다 — 원하는 만큼 어려운 판을 고를 수 있다.',
    goal:'잿불의 대군주 처치', of:1,
    at: m => m.wins || 0 },
  /* The first six all open the *front* of the descent: named
     flasks, a starting plus, a bigger purse. Measured runs then
     stopped dying on floor five and started dying on eleven,
     twelve, thirteen — and nothing in the ledger reached that
     far. These four do.

     Same rule as the others: no memory is a stat. Every one is
     knowledge you paid for or an option you unlocked by walking
     somewhere. A player who has never seen 잿불 아래 gets none
     of them, which is what makes them worth the trip. */
  { id:'scribe',  n:'서기의 기억',
    t:'도감이 몬스터의 버릇을 세 마리만에 내놓는다. 이미 적힌 것은 그대로 남는다.',
    goal:'도감 40종 등재', of:40,
    at: m => ['monsters', 'relics', 'items', 'events', 'regions']
      .reduce((s, k) => s + Object.keys(m[k] || {}).length, 0) },
  { id:'warden',  n:'파수꾼의 기억',
    t:'계단 화면이 아래에서 기다리는 것의 버릇을 미리 적어 준다.',
    goal:'이름 있는 것 3종 처치', of:3,
    at: m => NAMED.filter(x => (m.bodies || {})[x.n]).length },
  { id:'pathfinder', n:'길잡이의 기억',
    t:'11층부터는 도착하는 순간 그 층의 지도를 안다. 무엇이 있는지는 여전히 모른다.',
    goal:'다섯 장소 전부 밟기', of:5,
    at: m => Object.keys(m.regions || {}).length },
  { id:'hearth',  n:'화부의 기억',
    t:'잿불 아래에는 모닥불이 반드시 하나 있다. 걸어가는 것은 당신 몫이다.',
    goal:'누적 도달 150층', of:150,
    at: m => m.totals?.depth || 0 },
];

/* How many bodies buy the tells, for this run. The scribe does
   not hand over knowledge — it makes the same knowledge cheaper
   to earn, which keeps the codex a thing you fill rather than a
   thing you are given. */
export const TELL_SCRIBE = 3;
export const tellsNeeded = m => memoryEarned(m, 'scribe') ? TELL_SCRIBE : TELL_AT;

export const memoryEarned = (m, id) => {
  const spec = MEMORIES.find(x => x.id === id);
  return !!spec && spec.at(m) >= spec.of;
};

/* ── 심연 ─────────────────────────────────────────────────
   The other direction. Beating the boss unlocks a dial: every
   step makes the whole descent harder and pays a bigger ledger,
   which is the only reason to walk back into a dungeon you have
   already finished.

   Deliberately multiplicative on the two numbers that decide a
   fight — health and attack — rather than on monster count. More
   monsters is more turns; harder monsters is a harder game.   */
/* It used to be a free dial: pick 0 to 5, everything gets that
   many percent bigger. Two problems with a dial. A number that
   only scales health and attack does not change a single decision
   — you play the same run against larger numbers, which is
   harder without being different. And a dial you can set to five
   on your first winning run is not a ladder; there is nothing to
   climb.

   So it is a ladder now, and each rung is a *rule* rather than a
   percentage. You unlock rung N by winning at rung N−1, and a
   rung never replaces the ones below it — 족쇄 seven is wearing
   all seven. Only two of the eight are stat changes, on purpose:
   the other six change what you do, not how long it takes.

   The seventh is the one this ladder exists for. 이름 있는 것 was
   just given a leash, and the whole floor-6 decision rests on
   that leash being real. 긴 그림자 takes it away — the same
   dungeon, read completely differently, without one number
   moving. That is what a shackle should be. */
export const SHACKLES = [
  { n:0, t:'족쇄 없이 내려간다.', gold:1.00 },
  { n:1, id:'hunger',    k:'굶주린 불',     t:'등불이 30% 빨리 탄다. 어둠이 더 빨리 온다.',        gold:1.15 },
  { n:2, id:'dryspring', k:'마른 샘',       t:'모닥불 휴식이 절반만 아문다.',                      gold:1.32 },
  { n:3, id:'awake',     k:'깨어 있는 것들', t:'층에 들어설 때 절반이 이미 눈을 뜨고 있다.',        gold:1.52 },
  { n:4, id:'coldanvil', k:'식은 모루',     t:'강화 성공률 −8%p. 모루와 모닥불 값이 40% 오른다.',  gold:1.75 },
  { n:5, id:'weight',    k:'무거운 것들',   t:'적의 체력과 공격 +22%.',                            gold:2.05 },
  { n:6, id:'ledger',    k:'닫힌 장부',     t:'상점 재고가 절반이고 값이 1.5배다.',                gold:2.40 },
  { n:7, id:'shadow',    k:'긴 그림자',     t:'이름 있는 것이 자기 자리를 지키지 않는다. 층 끝까지 따라온다.', gold:2.80 },
  { n:8, id:'ash',       k:'재의 무게',     t:'최대 체력 −15%.',                                   gold:3.30 },
];

export const MAX_SHACKLE = SHACKLES.length - 1;

/* Which rules are on at a given rung. Every shackle from 1 to n,
   because a ladder that swaps rungs instead of stacking them is
   a difficulty menu, not a ladder. */
export const shacklesAt = n =>
  SHACKLES.slice(1, Math.max(0, Math.min(MAX_SHACKLE, n | 0)) + 1).map(s => s.id);

/* 무거운 것들 is the only rung that touches the two numbers the
   old dial moved, so the multiplier lives here rather than in a
   per-rung table. */
export const SHACKLE_STAT = 1.22;

/* ── 깊은 곳 ──────────────────────────────────────────────
   Fifteen floors were fifteen numbers. They are five places now,
   and the place is announced on arrival — one line, once, the
   turn you step off the stairs.

   The fiction is doing one job: explaining why anything down
   here is worth the walk. Somebody built this, mined it out,
   and then something under it woke up and took the lower half.
   Everything the player finds is one of those three layers
   leaking into the others — dwarf masonry with cinders in the
   mortar, a shrine with the wrong god's name filed off.       */
export const REGIONS = [
  { from:1,  to:3,  n:'무너진 성채',
    t:'사람이 지은 마지막 층들이다. 계단은 넓고 문에는 아직 경첩이 남아 있다.',
    line:'무너진 성채 — 사람이 지은 마지막 곳이다. 여기까지는 지도가 있었다.' },
  { from:4,  to:7,  n:'드워프 갱도',
    t:'성채 아래를 파고 들어간 갱도. 다듬은 돌이 끝나고 파낸 흙이 시작된다.',
    line:'드워프 갱도 — 다듬은 돌이 끝났다. 여기부터는 파낸 자국뿐이다.' },
  { from:8,  to:10, n:'잊힌 성소',
    t:'갱도가 뚫고 들어간 것. 누구를 모시던 곳인지는 벽에서 긁어내져 있다.',
    line:'잊힌 성소 — 벽마다 이름이 긁혀 있다. 무엇을 모셨는지 아무도 적어두지 않았다.' },
  { from:11, to:14, n:'잿불 아래',
    t:'돌이 따뜻하다. 이 아래에서 무언가가 아주 오래 타고 있다.',
    line:'잿불 아래 — 돌이 따뜻하다. 발밑에서 무언가가 아직 타고 있다.' },
  { from:15, to:15, n:'대군주의 화로',
    t:'타고 있는 것의 한가운데.',
    line:'대군주의 화로 — 여기가 타고 있는 것의 한가운데다.' },
];

export const regionOf = depth =>
  REGIONS.find(r => depth >= r.from && depth <= r.to) || REGIONS[0];
/* ── 조사 ─────────────────────────────────────────────────
   Two hundred and twenty lines of prose, every one of them
   written `이(가)` and `을(를)`, because the name in front of the
   particle is a variable and Korean picks its particle by whether
   that name ends in a consonant.

   The bracket notation is the game admitting, on every single
   line, that it is a template. For something meant to read like
   an old book that is the most damaging thing in the build — and
   it was also producing sentences that are simply wrong, like
   「둘를 더 게워냈다」.

   Hangul syllables are laid out so the final consonant falls out
   of arithmetic: (code − 0xAC00) % 28, zero meaning none. So the
   whole problem is one modulo and a table, applied once in say()
   rather than at two hundred call sites.

   The marker stays `X(Y)` on purpose. Resolving bare particles
   would mean guessing whether a 이 is a particle or the first
   syllable of a word, and guessing wrong in prose is worse than
   the bracket ever was. */
const JOSA = {
  '이(가)': ['이', '가'], '가(이)': ['이', '가'],
  '을(를)': ['을', '를'], '를(을)': ['을', '를'],
  '은(는)': ['은', '는'], '는(은)': ['은', '는'],
  '과(와)': ['과', '와'], '와(과)': ['과', '와'],
  '아(야)': ['아', '야'], '야(아)': ['아', '야'],
  '이다(다)': ['이다', '다'],
};

/* 받침 of the last syllable: 0 none, 8 ㄹ. ㄹ matters because
   「칼로」 takes 로 while 「검으로」 takes 으로 — the one particle
   that splits three ways rather than two. */
/* Read aloud, because that is what the particle listens to.
   영 ㅇ · 일 ㄹ · 이 — · 삼 ㅁ · 사 — · 오 — · 육 ㄱ · 칠 ㄹ ·
   팔 ㄹ · 구 —, and a trailing zero with anything in front of it
   is 십 (ㅂ) rather than 영: 「10을」 is 십을. */
const DIGIT_JONG = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0];
export function jong(word) {
  const s = String(word ?? '').trim();
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s.charCodeAt(i);
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28;
    if (c >= 0x30 && c <= 0x39) {
      const d = c - 0x30;
      if (d === 0 && i > 0 && s.charCodeAt(i - 1) >= 0x30 && s.charCodeAt(i - 1) <= 0x39) return 17;
      return DIGIT_JONG[d];
    }
    if (/[a-zA-Z]/.test(s[i])) return 'lmnr'.includes(s[i].toLowerCase()) ? 8 : 0;
  }
  return 0;                       // punctuation only, or empty: treat as open
}
export const hasJong = word => jong(word) !== 0;

/* Applied to a finished sentence, so an interpolated name and a
   literal one are handled identically. */
export function josa(text) {
  let out = String(text);
  for (const [mark, [withJ, without]] of Object.entries(JOSA)) {
    let at;
    while ((at = out.indexOf(mark)) !== -1)
      out = out.slice(0, at) + (hasJong(out.slice(0, at)) ? withJ : without)
          + out.slice(at + mark.length);
  }
  /* (으)로 and (이)나 split on ㄹ as well as on bare vowels. */
  out = out.replace(/\(으\)로/g, (_, i, s) => {
    const j = jong(s.slice(0, i));
    return (j === 0 || j === 8) ? '로' : '으로';
  });
  return out;
}

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
/* ── the six habits of hand ───────────────────────────────
   A class used to be three stat modifiers and a spell list,
   which meant the only thing that changed between a 전사 and a
   팔라딘 was arithmetic. Each one now owns a rule instead — a
   counter that fills as you play the class the way it wants to
   be played, and pays out when it does.

   `trait.n` names it, `trait.t` is the whole rule in one line,
   and `trait.max` is what the HUD counter fills towards. The
   counters live on the player and are read in exactly one place
   each, so a class identity is a rule and not a special case
   sprinkled through the combat code.                         */
export const TRAITS = {
  warrior: { n:'세 번째 손', max:3,
    t:'같은 적을 연달아 맞히면 세 번째 타격은 무조건 치명타다. 빗나가면 처음부터.' },
  mage:    { n:'이중 시전', max:4,
    t:'주문을 넷 쓸 때마다 다음 하나는 마나를 쓰지 않고 두 번 나간다.' },
  priest:  { n:'응답', max:0,
    t:'체력이 절반 아래일 때 모든 회복이 60% 더 든다. 여섯 턴마다 저절로 아문다.' },
  rogue:   { n:'그림자 걸음', max:0,
    t:'구르기가 기력을 하나만 쓴다. 구른 바로 다음 공격은 무조건 치명타.' },
  ranger:  { n:'표적', max:5,
    t:'같은 적을 때릴 때마다 그 적에게 주는 피해가 9%씩 쌓인다(최대 45%). 대상을 바꾸면 사라진다.' },
  paladin: { n:'맹세', max:8,
    t:'맞을 때마다 방어 +1이 쌓인다(층마다 초기화, 최대 +8). 처치하면 하나 되돌려준다.' },
};

export const CLASSES = {
  warrior: { name:'전사',     mod:{ str:+3, con:+2, int:-2, wis:-2 }, hd:9, bth:5.0, realm:null,     note:'주문 없이, 오직 무기로.' },
  mage:    { name:'마법사',   mod:{ int:+3, str:-2, con:-2 },         hd:0, bth:2.0, realm:'arcane', note:'지능이 곧 힘. 맞으면 죽는다.' },
  priest:  { name:'사제',     mod:{ wis:+3, str:-1, dex:-1 },         hd:2, bth:3.0, realm:'divine', note:'스스로를 고치며 나아간다.' },
  rogue:   { name:'도적',     mod:{ dex:+3, int:+1, str:-1, wis:-2 }, hd:6, bth:4.0, realm:'arcane', note:'먼저 치고, 잘 피한다.' },
  /* No realm. Casting the mage's book with the mage's stat minus
     two was the whole reason this class read as an in-between —
     it was a worse mage holding a worse dagger. Its five buttons
     are arrows now, and nobody else has those. */
  ranger:  { name:'레인저',   mod:{ dex:+3, int:+1, con:+1 },         hd:5, bth:4.8, realm:null,     note:'활이 곧 직업. 거리를 지운 쪽이 진다.' },
  paladin: { name:'팔라딘',   mod:{ str:+2, wis:+1, chr:+2, dex:-2 }, hd:6, bth:4.5, realm:'divine', note:'느리지만 무너지지 않는다.' },
};
for (const [k, c] of Object.entries(CLASSES)) c.trait = TRAITS[k];

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
  { spr:'rat',     n:'커다란 쥐',        d:1,  rar:10, hp:5,   atk:3,  ac:1,  xp:2,   ai:'hunt',    grp:[1,3],
    lore:'성채가 사람 것이던 시절부터 여기 있었다. 사람이 먼저 나갔을 뿐이다.' },
  { spr:'bat',     n:'과일 박쥐',        d:1,  rar:9,  hp:6,   atk:3,  ac:3,  xp:3,   ai:'erratic', spd:1.7,
    lore:'과일은 오래전에 없어졌는데 이름만 남았다. 지금은 다른 걸 먹는다.' },
  { spr:'mold',    n:'회색 곰팡이',      d:1,  rar:5,  hp:14,  atk:5,  ac:1,  xp:5,   ai:'still',   on:'poison',
    lore:'벽이 아니라 벽에 기댄 것에서 자란다. 밟기 전에는 벽처럼 보인다.' },
  /* The step between one and two. Measured, floor 1 threw 0.8
     damage a turn and floor 2 threw 2.5 — three times as much,
     across a single staircase, at a character who has gained
     about one level. A fresh mage died to three kobolds in 71%
     of tries; to three rats, never.

     So: something that lives on both floors, comes alone, hits
     for what a kobold hits for, and cannot follow you through a
     door. It teaches the two habits floor 2 is about to demand —
     that a single thing can hurt now, and that a doorway is a
     tool — while it is still survivable to learn them. */
  { spr:'lean',    n:'굶은 들쥐',        d:1,  rar:7,  hp:9,   atk:6,  ac:2,  xp:4,   ai:'hunt',    spd:1.15,
    lore:'무리에서 밀려난 쪽이다. 혼자 다니는 것은 그만큼 굶었다는 뜻이고, 굶은 것이 더 문다.' },
  { spr:'snake',   n:'흰 큰뱀',          d:2,  rar:8,  hp:10,  atk:4,  ac:3,  xp:5,   ai:'hunt',    on:'poison',
    lore:'빛을 본 적 없는 비늘은 이렇게 하얗다. 눈이 퇴화한 대신 혀가 길다.' },
  { spr:'kobold',  n:'코볼드',           d:2,  rar:8,  hp:12,  atk:6,  ac:4,  xp:8,   ai:'hunt',    grp:[2,3], door:'open',
    lore:'성채가 무너질 때 남은 것들의 후손. 아직도 사람 갑옷을 잘라 입는다.' },
  { spr:'kobold',  n:'코볼드 투석꾼',    d:2,  rar:7,  hp:9,   atk:5,  ac:3,  xp:11,  ai:'ranged',  rng:5, spd:0.65, grp:[1,2], door:'open',
    lore:'던질 것이 떨어지면 자기 이빨을 뽑아 던진다는 말이 있다. 확인한 사람은 없다.' },
  { spr:'dog',     n:'들개',             d:2,  rar:9,  hp:11,  atk:6,  ac:3,  xp:9,   ai:'coward',  spd:1.3, grp:[2,3],
    lore:'누군가 데리고 내려왔던 개들이다. 데리고 올라간 사람은 없었다.' },
  { spr:'jelly',   n:'푸른 젤리',        d:3,  rar:5,  hp:34,  atk:8,  ac:1,  xp:20,  ai:'still',   on:'slow',
    lore:'다 녹인 뒤에도 자기가 무엇을 녹였는지 안쪽에 남긴다. 반지가 떠 있는 것을 본 적 있다.' },
  { spr:'spider',  n:'동굴 거미',        d:3,  rar:8,  hp:16,  atk:8,  ac:5,  xp:16,  ai:'hunt',    spd:1.3, on:'poison', web:true,
    lore:'줄을 치는 것이 아니라 길을 짜는 것에 가깝다. 자기 길은 걸어서 지난다.' },
  { spr:'orc',     n:'오크 병사',        d:3,  rar:11, hp:24,  atk:10, ac:7,  xp:24,  ai:'hunt',    grp:[2,4], door:'open',
    lore:'갱도를 파던 드워프를 밀어낸 쪽. 그래서 곡괭이 자국이 남은 갑옷을 입는다.' },
  { spr:'orc',     n:'오크 궁수',        d:4,  rar:7,  hp:20,  atk:9,  ac:6,  xp:28,  ai:'ranged',  rng:6, spd:0.7, grp:[1,2], door:'open',
    lore:'활보다 사거리를 잘 안다. 붙으면 물러나며 쏘는 법을 누가 가르쳤다.' },
  { spr:'orc',     n:'검은 오크',        d:5,  rar:9,  hp:36,  atk:13, ac:9,  xp:42,  ai:'hunt',    grp:[2,4], door:'open',
    lore:'검게 그을린 것이 아니라 원래 그렇다. 아래쪽에서 올라온 무리다.' },
  { spr:'dog',     n:'늑대',             d:5,  rar:8,  hp:30,  atk:12, ac:6,  xp:38,  ai:'hunt',    spd:1.35, grp:[2,4],
    lore:'갱도의 소리를 듣고 위에서 내려왔다. 여기서는 무리를 이루는 편이 오래 산다.' },
  /* The lore promised a wind-up for four months and the field was
     never set — `heavy` existed, monsterTurn implemented it, and
     only elites ever had it. Setting it makes the codex true, and
     the attack drops from 16 to 13 because a telegraphed blow
     lands for two and a half times as much. */
  { spr:'ogre',    n:'오우거',           d:6, rar:8,  hp:52,  atk:13, ac:10, xp:70,  ai:'hunt',    spd:0.75, door:'smash', heavy:true,
    lore:'문을 여는 법을 배운 적이 없어서 부순다. 한 번 팔을 당기면 그 자리를 비켜야 한다.' },
  { spr:'mummy',   n:'미라',             d:7, rar:6,  hp:48,  atk:15, ac:12, xp:75,  ai:'hunt',    spd:0.65, on:'fear',
    lore:'성소에 눕혀졌던 것. 이름은 벽에서 긁혔지만 몸은 남았다.' },
  { spr:'troll',   n:'동굴 트롤',        d:8, rar:9,  hp:70,  atk:19, ac:13, xp:110, ai:'hunt',    door:'smash', regen:2,
    lore:'상처가 아무는 속도가 상처가 나는 속도보다 빠르다. 오래 끌면 진다.' },
  { spr:'wraith',  n:'망령',             d:9, rar:7,  hp:60,  atk:20, ac:15, xp:130, ai:'erratic', spd:1.2, on:'fear',
    lore:'모신 것도 모셔진 것도 아니고 그 사이에 끼인 것. 걷는 방향에 규칙이 없다.' },
  { spr:'giant',   n:'언덕 거인',        d:9, rar:7,  hp:95,  atk:23, ac:14, xp:170, ai:'ranged',  rng:5, spd:0.6, door:'smash',
    lore:'언덕이 있던 시절의 것이다. 앉아서도 천장에 머리가 닿는다.' },
  { spr:'vampire', n:'흡혈귀',           d:11, rar:6,  hp:88,  atk:26, ac:17, xp:220, ai:'hunt',    spd:1.25, on:'blind', door:'open', regen:3,
    lore:'성채의 마지막 영주였다는 이야기가 있다. 본인이 퍼뜨렸을 것이다.' },
  { spr:'dragon',  n:'어린 붉은 용',     d:11, rar:5,  hp:120, atk:28, ac:20, xp:300, ai:'ranged',  rng:6, spd:0.7, door:'smash',
    lore:'어리다는 것은 아직 다 자라지 않았다는 뜻이지 약하다는 뜻이 아니다.' },
  { spr:'wyrm',    n:'서리 비룡',        d:12, rar:5,  hp:140, atk:31, ac:22, xp:380, ai:'ranged',  rng:6, spd:0.7, on:'slow', door:'smash',
    lore:'잿불 위에서 사는 것이 얼음을 뱉는다. 아래가 뜨거우니 그럴 만도 하다.' },
  { spr:'lich',    n:'리치',             d:14, rar:4,  hp:130, atk:35, ac:24, xp:480, ai:'ranged',  rng:7, spd:0.75, on:'paralyze', door:'open',
    lore:'죽는 것을 협상으로 처리한 자. 협상의 대가는 이름이었던 모양이다.' },

  /* ── the ember floors ─────────────────────────────────
     Counted by behaviour rather than by name, floors 7 to 15 held
     eight monsters that differed along exactly two axes: speed and
     ailment. Half of them were archers, which is most of why the
     bottom of the game kills — there was nothing to close with and
     nowhere the knowledge could be applied.

     Every one of these opens an axis that the rules implement,
     tellsOf already writes a habit for, and no monster past floor
     five was using: packs, a wind-up, drain, theft, a floor
     pattern, and a thing that simply does not move. Each one has a
     different right answer, and the codex will say what it is
     after three bodies. That is the whole point of a bestiary — a
     deeper floor should ask a different question, not the same
     question with bigger numbers. */
  { spr:'ashhound', n:'재의 사냥개',      d:10, rar:8,  hp:62,  atk:22, ac:15, xp:140, ai:'hunt',    spd:1.45, grp:[3,5], door:'open',
    lore:'화로 둘레를 도는 것들. 한 마리를 보았다면 이미 세 마리가 뒤에 있다.' },
  { spr:'warden',   n:'화로지기',         d:10, rar:7,  hp:130, atk:15, ac:21, xp:240, ai:'hunt',    spd:0.6,  door:'smash', heavy:true,
    lore:'불을 지키라는 명령만 남고 명령한 자는 없다. 팔을 당기는 데 한 박자가 걸린다.' },
  { spr:'ashen',    n:'잿물 먹는 것',     d:12, rar:6,  hp:110, atk:27, ac:16, xp:300, ai:'hunt',    spd:0.9,  drain:0.45, on:'slow',
    lore:'상처를 삼켜서 제 것으로 만든다. 오래 붙어 있을수록 저쪽이 낫는다.' },
  { spr:'thief',    n:'잿불 도굴꾼',      d:12, rar:5,  hp:70,  atk:20, ac:19, xp:260, ai:'coward',  spd:1.5,  thief:true, door:'open',
    lore:'아래에서 무엇을 파내는지는 아무도 모른다. 자루가 늘 무겁다는 것만 안다.' },
  { spr:'emberpriest', n:'화로의 사제',   d:13, rar:5,  hp:105, atk:24, ac:18, xp:400, ai:'hunt',    spd:0.85, casts:['zone','wave'], cool:4, door:'open',
    lore:'화로에 무엇을 바쳤는지 벽에 적혀 있었으나 그 벽도 탔다. 바닥에 먼저 그린다.' },
  { spr:'ashheap',  n:'잿더미 속의 것',   d:15, rar:4,  hp:160, atk:40, ac:26, xp:560, ai:'still',   on:'fear',
    lore:'재가 쌓인 자리 중 하나는 재가 아니다. 건드리지 않으면 그대로 있는다.' },
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
/* Sized against the hero who actually stands on that floor, not
   against the floor number. Both of these used to be losses on
   paper: 뼈를 씹는 자 took 10.8 turns to kill and killed you in
   8.5, and 재 속의 사제 was 11.9 against 10.7. Nearly four runs
   in ten ended on floor 5, which is not a difficulty curve, it is
   a door with no handle.

   It moved to 6 as well. Floor 5 already had 검은 오크 and 늑대
   arriving together; putting the first named fight on the same
   step made three staircases out of one. */
export const NAMED = [
  { at:6,  spr:'ogre',  n:'뼈를 씹는 자', hp:185, atk:14, ac:14, xp:700,
    ai:'hunt', spd:0.9, door:'smash', regen:2, heavy:true, named:true,
    casts:['quake', 'zone'], cool:5,
    warn:'뼈를 씹는 자가 아래에서 기다린다',
    intro:'무언가 커다란 것이 이 층에서 기다리고 있다.' },
  { at:10, spr:'wraith', n:'재 속의 사제', hp:250, atk:20, ac:22, xp:1800,
    ai:'hunt', spd:1.1, on:'fear', door:'open', regen:3, heavy:true, named:true,
    casts:['cross', 'wave'], cool:4,
    warn:'재 속의 사제가 아래에서 기다린다',
    intro:'차가운 것이 이 층의 공기를 마시고 있다.' },
  /* Floor 13 is corridor, not gate: the survey says a run that
     clears floor 11 almost always reaches the emperor, so what
     the 잿불 아래 needs is a destination, not another wall.

     Staging it showed hit points are the wrong dial — the hero
     out-heals them, so a fatter thing is only a longer fight.
     What moves the outcome is damage per turn. 450/59 loses to a
     level-20 hero with one upgrade about seven times in ten and
     wins from level 22 up; it dies in roughly fifty turns rather
     than a hundred and forty, so it reads as a fight instead of
     an attrition race. It hits harder than the emperor and folds
     faster, which is its whole identity: kill it quickly or it
     kills you. It sits in its own lair, so the fight is a
     decision the player makes rather than a toll they pay. */
  { at:13, spr:'wyrm', n:'화로를 감은 것', hp:450, atk:59, ac:32, xp:2600,
    ai:'hunt', spd:1.35, on:'blind', door:'smash', regen:3, heavy:true, named:true,
    casts:['beam', 'wave', 'quake'], cool:3,
    warn:'화로를 감은 것이 아래에서 기다린다',
    intro:'아래쪽 어딘가에서 아주 긴 것이 몸을 고쳐 감았다.' },
];

/* Three turns in one fight.

   Staging the emperor showed the old shape was not hard so much
   as long: 780 hit points regenerating four a turn against a
   hero who drinks at forty percent is an arithmetic problem, and
   the level-20 losses were mostly the four-hundred-turn cap
   rather than deaths. A fight nobody can finish is not a climax.

   So the health bar is cut into three and each third does
   something different. It opens as it always did. At two thirds
   the furnace comes open: it stops closing its wounds, throws
   patterns twice as often, and the escort walks in. At one third
   it stops guarding entirely — armour down, damage up, no
   cooldown worth the name. The last third is a race the player
   can win by committing, which is the turn a final fight is
   supposed to have.

   `set` replaces a field outright, `add` adds to it. Both are
   announced before they land. */
export const BOSS = {
  spr:'balemperor', n:'잿불의 대군주', hp:780, atk:46, ac:30, xp:5000,
  ai:'hunt', spd:1.15, on:'fear', door:'smash', regen:4, boss:true, heavy:true,
  casts:['beam', 'wave', 'zone', 'quake'], cool:3,
  phases: [
    { at:0.66, n:'화로가 열린다',
      say:'가슴팍이 갈라지고 안쪽의 불이 드러났다. 상처가 더는 닫히지 않는다.',
      set:{ regen:0, cool:2, spd:1.3 }, add:{ atk:4 }, ring:'quake', summon:2 },
    /* No escort in the last third on purpose. The middle is the
       crowded part; the end is meant to be the two of you and a
       burning floor, which is the picture the run has been walking
       towards for fifteen floors. */
    { at:0.33, n:'마지막 숨',
      say:'막는 것을 그만두었다. 이제 전부 후려치는 데에 쓴다.',
      set:{ cool:1, ac:22, heavy:false }, add:{ atk:10 }, ring:'wave' },
  ],
};

/* ── 공명 ─────────────────────────────────────────────────
   Measured across eighty-one runs: the strongest build put out
   2.56× the median's damage. In a game that wants a run to
   occasionally come apart in your favour, that is not a lottery,
   that is a run that went well.

   Two reasons, both in the code rather than in the numbers.
   Everything adds — gearBonus sums every source into one `b.*`
   and spends it once, and addition does not run away by
   construction. And the median run holds *one* affix and *zero*
   engravings, so the combinatorial layer this game already has
   almost never engages at all.

   A resonance is the answer to the first: a named combination
   that, when its pieces are all in hand, changes a *rule* rather
   than a number. The design rules it has to obey, or it becomes
   a checklist instead of a lottery:

     multiply or feed back — "+40% damage" is not a resonance
     pieces from different pockets — you can steer two, never all
     partial progress is visible — that turns a lottery into a hunt
     loud when it lands — it is a turning point, not a stat
     rare enough to be an event: aim for one run in six or seven

   `need` reads the finished gearBonus rather than the item that
   supplied it, so a lifesteal prefix, a lifesteal suffix and a
   lifesteal engraving all count the same. One funnel, no drift.

   피의 톱니 was built alone and measured alone first — writing
   eight before measuring one is how a system ends up needing all
   eight rebalanced. The other seven are cut to the scale that
   measurement produced: about twice a comparable build in the
   situation the resonance is *for*, and nothing at all outside
   it.

   Eight, and every one of them has something it cannot do. That
   is the part that makes a build a build rather than an upgrade:
   피의 톱니 is measurably *worse* than a plain damage suffix
   against a boss, because a chain needs a second body. A
   resonance that is good at everything is just a bigger number
   wearing a name.

   Spread across the pools on purpose — weapon, armour, relic,
   spell, class — so no single kind of luck opens all of them and
   every way of playing has one it can reach. */
export const RESONANCE = [
  { id:'sawtooth', n:'피의 톱니', spr:'sword',
    need: g => g.lifesteal > 0 && g.chain > 0,
    want: '흡혈과 연쇄를 한 손에',
    t:'연쇄가 더는 확률이 아니다. 닿는 몸이 있는 한 계속 옮겨 붙고, 옮겨 갈 때마다 피를 가져온다.',
    weak:'혼자 있는 것에게는 아무것도 하지 않는다 — 연쇄는 두 번째 몸이 있어야 한다.',
    say:'날에 묻은 피가 다음 날을 부른다.' },

  { id:'powder', n:'화약고', spr:'axe',
    need: g => g.burst > 0 && g.pierce > 0,
    want: '작열과 관통을 한 자루에',
    t:'죽인 일격의 무게가 시체에 실린다. 터진 시체가 다음 시체를 터뜨리고, 네 번까지 이어진다.',
    weak:'무언가를 죽여야 시작된다. 지고 있을 때는 한 번도 켜지지 않는다.',
    say:'첫 번째가 두 번째를 열고, 두 번째가 방을 연다.' },

  { id:'tally', n:'처형인의 셈', spr:'dagger',
    need: g => g.execute >= 0.30,
    want: '처형 문턱을 30% 위로',
    t:'처형할 때마다 이 층의 문턱이 1%p 오른다. 빨리 죽일수록 더 빨리 죽는다.',
    weak:'층을 내려가면 셈이 처음으로 돌아간다. 대군주에게는 처형이 통하지 않는다.',
    say:'한 번 세기 시작하면 손이 먼저 안다.' },

  { id:'echoroom', n:'메아리의 방', spr:'wand',
    /* The affix and the 울림의 보은 are the same side of this —
       both are "the spell echoes", and cast() reads them with one
       `||`, so `need` has to as well. Measured with them treated
       as two different axes it fired 0 times in 360 runs. */
    need: (g, p) => (p?.maxmana || 0) > 0
                 && (hasSpellEcho(p) || hasBoonId(p, 'echo'))
                 && g.manaPct > 0,
    want: '메아리치는 주문(또는 울림의 은총)과, 마나를 넓히는 것',
    t:'메아리가 다시 메아리친다. 한 번 외운 것이 네 곳에 닿고, 옮겨 가도 좀처럼 약해지지 않는다.',
    weak:'번져 나간 만큼 마나를 더 문다. 마르면 그냥 메아리로 돌아간다.',
    say:'벽이 먼저 외우고, 그다음에 대답한다.' },

  { id:'bramble', n:'가시밭', spr:'shield',
    /* A resonance whose every piece has exactly one origin is
       unreachable in practice: written as thorn-engraving AND
       bedrock-engraving this fired 0 times in 360 runs. Opening
       *both* sides then overshot to 8.3% — 룬이 새겨진 and the
       거울 방패 are each common on their own. One side open is
       the right amount: the mirror shield can stand in for the
       thorn, but the 반석 engraving is still the price. */
    need: (g, p) => (g.reflect > 0 || !!p?.relics?.includes('mirror'))
                 && g.flatDR > 0,
    want: '되돌려주는 것(가시의 각인 · 거울 방패)과, 반석의 각인을 함께',
    t:'막아낸 만큼이 그대로 되돌아간다. 반사는 상대 방어를 무시한다.',
    weak:'맞지 않으면 아무 일도 없다. 바닥 공격과 화살은 되돌릴 것이 없다.',
    say:'두꺼운 것을 때리면 손이 먼저 상한다.' },

  { id:'pack', n:'굶주린 무리', spr:'amulet',
    need: (g, p) => g.lifesteal > 0 && !!p?.relics?.includes('hunger'),
    want: '굶주린 칼날과 흡혈을 함께',
    t:'처치 회복이 연격 배수만큼 곱해진다. 끊지 않는 한 계속 불어난다.',
    weak:'한 대만 맞아도 연격이 절반으로 꺾인다. 서서 맞는 빌드로는 켤 수 없다.',
    say:'멈추지 않는 동안에만 배가 부르다.' },

  { id:'shadowstep', n:'그림자 걸음', spr:'dagger',
    need: (g, p) => !g.noStealth && g.stealth >= 0.20 && (g.crit > 0 || p?.cls === 'rogue'),
    want: '은신을 두르고 치명타를 얹어',
    t:'잠든 것을 잡아도 층이 깨지 않는다. 방 하나를 한 마리씩 지울 수 있다.',
    weak:'사슬 갑주와 얕은 물이 은신을 지운다. 한 번 깨어난 방에서는 소용없다.',
    say:'조용한 쪽이 먼저 끝낸다.' },

  { id:'dawnoath', n:'여명의 맹세', spr:'armor',
    need: g => g.dawn > 0 && g.regen > 0,
    want: '층에 들어설 때 회복하는 것(여명의 각인 · 아침)과, 스스로 아무는 것',
    t:'층에 들어설 때의 회복이 최대치까지 간다. 숨 고르기에 천장이 사라진다.',
    weak:'때리는 것은 하나도 늘지 않는다. 오래 버틸 뿐 이기지는 못한다.',
    say:'아침은 매번 온다. 그것만으로도 대부분은 충분하다.' },
];

/* Read off the finished build rather than off the item that
   supplied it, same rule as `need` — a boon and a spell affix are
   different pockets and both should count. */
const hasBoonId = (p, id) =>
  ['weapon', 'body', 'shield'].some(k => p?.equip?.[k]?.boon === id);
const hasSpellEcho = p =>
  !!p?.spellAffix && Object.values(p.spellAffix).includes('echo');
export const resonanceById = id => RESONANCE.find(r => r.id === id);

/* The first swing chains at whatever the build rolls — usually
   0.30. Measured, feeding that number back into itself produced
   0.07 extra hits per swing, which is not a cascade, it is a
   rounding error. A rebound cannot be priced off the thing that
   started it.

   So the resonance sets its own rate: the first rebound is nearly
   certain, each one after is a little less, and six deep is the
   ceiling. In a packed room that is about three and a half extra
   bodies hit per chain that starts — and every one of them
   carries the lifesteal. Finite, and loud. */
/* And the first link stops being a die roll. Everything downstream
   was gated on a 0.30 chance, so a cascade worth four hits was
   only worth 1.2 — the measured gain was ×1.5, which is a good
   weapon, not a run coming apart. A resonance changes a rule; the
   rule here is that the chain is no longer a chance. */
export const CHAIN_ECHO = 0.85;
export const CHAIN_DECAY = 0.86;
export const CHAIN_MAX = 6;
/* And the blow has to survive the trip. A chain normally hands on
   six tenths of what it carried, so by the third hop it is worth a
   fifth of the swing and a cascade of six is still barely one
   extra hit. 피의 톱니 keeps most of it instead — that is the
   difference between a chain and a room emptying.

   Note what this does *not* help with: a boss stands alone. The
   resonance makes crowds into food and does nothing at all to the
   thing at the bottom, which is the right shape for it. */
export const CHAIN_KEEP = 0.60;
export const CHAIN_KEEP_RESO = 0.85;

/* 화약고: how many times a detonation may set off the next one.
   Without a cap a packed room clears itself in one kill, which is
   not a payoff, it is the end of the fight before it starts. */
export const POWDER_MAX = 4;
/* And how many may go off in total from one action. A detonation
   catches up to eight bodies and each of those detonates, so the
   depth cap alone allows thousands — this is the number that
   keeps a room-clear a room-clear instead of a stall. */
export const POWDER_BUDGET = 24;
/* 가시밭: what the thorn gains on top of the reflect it already
   had, once it is priced on the blow that was stopped. */
export const BRAMBLE_BITE = 0.25;

/* 메아리의 방: how many bodies the echo may walk, and what the
   extra hop costs. The toll is the weakness made mechanical —
   without it the resonance is free width, and free width on a
   class that already runs out of mana is not a build, it is a
   patch. */
export const ECHO_ROOM_HOPS = 3;
export const ECHO_ROOM_TOLL = 0.5;
/* An echo normally hands on half, so a second bounce would be
   worth a quarter and the resonance would be a rounding error —
   the same trap 피의 톱니 fell into. In the room the echo barely
   fades. */
export const ECHO_ROOM_KEEP = 0.85;

/* ── the tells ────────────────────────────────────────────
   What you learn about a thing by killing enough of them.

   Every line here is *derived from the fields the rules
   actually read*, never written by hand next to a monster. A
   hand-written weakness line is a lie waiting to happen — change
   a speed and the codex keeps promising you can walk away from
   it. This function and monsterTurn read the same numbers.

   The knowledge is real: none of it changes a die roll, all of
   it changes what you do on the turn you see the thing. That is
   the whole shape of this game's meta progression — run five
   does not hit harder than run one, it knows more. */
export const TELL_AT = 5;               // bodies before the tells open

export function tellsOf(m) {
  const out = [];
  const spd = m.spd || 1;
  // Inclusive of the values the table actually uses: 0.9 is the
  // ogre and 1.3 is the wolf, and both were falling through.
  if (spd <= 0.9) out.push('당신보다 느리다 — 걸어서 떨어뜨릴 수 있다.');
  if (spd >= 1.2) out.push('당신보다 빠르다 — 등을 보이면 따라붙는다.');
  if (m.ai === 'still')   out.push('제자리에서 움직이지 않는다 — 그냥 지나가도 된다.');
  if (m.ai === 'erratic') out.push('제멋대로 움직인다 — 유인이 통하지 않는다.');
  if (m.ai === 'ranged')  out.push(`${m.rng || 5}칸에서 쏘고, 붙으면 물러난다 — 시야를 끊거나 단숨에 붙어라.`);
  if (m.ai === 'coward')  out.push('피를 흘리면 달아난다 — 몰아넣지 않으면 놓친다.');
  if (m.door === 'smash') out.push('문을 부순다 — 문으로는 막을 수 없다.');
  else if (m.door === 'open') out.push('문을 연다 — 닫아도 한 턴을 벌 뿐이다.');
  else out.push('문을 열지 못한다 — 문 닫기가 확실히 통한다.');
  if (m.grp)     out.push(`${m.grp[0]}~${m.grp[1]}마리가 함께 나온다 — 좁은 곳으로 끌어들여라.`);
  if (m.heavy)   out.push('때리기 전에 한 턴 팔을 당긴다 — 그 턴에 물러서면 헛손질이다.');
  if (m.regen)   out.push(`턴마다 ${m.regen}씩 아문다 — 오래 끌면 진다.`);
  if (m.drain)   out.push('입힌 피해만큼 자기가 회복한다.');
  if (m.web)     out.push('거미줄에 걸리지 않는다.');
  if (m.thief)   out.push('훔치고 달아난다 — 잡으려면 구르기나 주문이 필요하다.');
  if (m.on && AILMENTS[m.on])
    out.push(`맞으면 ${AILMENTS[m.on].n} — ${AILMENTS[m.on].note}.`);
  if (m.casts?.length)
    out.push(`바닥에 ${m.casts.map(k => PATTERNS[k]?.n).filter(Boolean).join(' · ')}을(를) 그린다 — 표시된 칸에서 나가라.`);
  if (m.phases?.length)
    out.push(`체력 ${m.phases.map(p => Math.round(p.at * 100) + '%').join('와 ')}에서 다른 것이 된다.`);
  return out;
}

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
   everything.

   And now a second use. The warrior was the only class with no
   verbs at all — five of six cast five spells apiece, and it had
   a passive that fires when you do not miss. Raising its numbers
   would have kept it boring; what it needed was a resource it
   already had and something to spend it on. */
export const ROLL_COST = 2;
export const ROLL_DIST = 2;
export const staminaMax = p => 3 + Math.floor(p.lv / 6) + Math.max(0, statBonus(p.stats.dex));
export const STAM_REGEN_EVERY = 2;

/* ── the arts ─────────────────────────────────────────────
   What a class *does*, as opposed to what it rolls. Six classes
   were sharing two spell lists — 마법사, 도적 and 레인저 cast the
   identical five, 사제 and 팔라딘 the identical five, and 전사 cast
   nothing. That is why the ranger read as an in-between: it is
   worse at int than the mage and worse at dex than the rogue,
   casting the same book as both.

   An art is spent from a class's own resource and answers a
   situation the class is supposed to own. The warrior's four are
   the scale everything else gets cut to, measured before the rest
   are written — the same order that worked for the resonances. */
export const ARTS = {
  warrior: [
    { id:'shove',    name:'밀쳐내기', short:'밀침', lv:1,  stam:2,
      desc:'앞의 것을 두 칸 밀어낸다. 벽에 부딪히면 한 턴 무너진다.' },
    { id:'cleave',   name:'휩쓸기',   short:'휩쓺', lv:3,  stam:3,
      desc:'인접한 모든 것을 한 번에 벤다.' },
    { id:'brace',    name:'버티기',   short:'버팀', lv:7,  stam:3,
      desc:'네 턴 동안 받는 피해가 크게 줄고, 때린 쪽이 되받는다.' },
    { id:'finisher', name:'마무리',   short:'마무', lv:11, stam:4,
      desc:'상대가 잃은 피만큼 무거워지는 한 방.' },
  ],

  /* The ranger cast the mage's five spells with worse intelligence
     and swung worse than the rogue — best at nothing, which is
     what "어중간" means. Its axis is the one the game never had:
     the space between you and the thing.

     So its arts spend arrows rather than mana, and every one of
     them is a different answer to distance. Where the warrior's
     four ask "what is next to me", these four ask "where is
     everything standing". */
  ranger: [
    { id:'aimed',   name:'조준 사격', short:'조준', lv:1,  stam:2, ammo:1,
      desc:'빗나가지 않는다. 그리고 멀수록 아프다 — 활의 감쇠가 뒤집힌다.' },
    { id:'pierce',  name:'관통 사격', short:'관통', lv:4,  stam:3, ammo:1,
      desc:'화살이 일직선 위의 모든 것을 뚫고 지나간다.' },
    { id:'snare',   name:'덫 놓기',   short:'덫',   lv:8,  stam:3,
      desc:'발밑에 덫을 묻는다. 밟은 것은 두 턴을 잃는다.' },
    { id:'volley',  name:'빗발',      short:'빗발', lv:12, stam:5, ammo:3,
      desc:'보이는 모든 것에게 한 발씩. 각각은 절반만 아프다.' },
  ],
};

export const AIMED_GAIN  = 0.09;   // damage per tile, instead of the usual loss
export const PIERCE_KEEP = 0.85;   // what the arrow carries to the next body
export const SNARE_TURNS = 2;
export const VOLLEY_SHARE = 0.5;

export const SHOVE_DIST   = 2;     // tiles pushed
export const SHOVE_WALL   = 0.5;   // extra damage, as a share of a normal blow, on impact
export const CLEAVE_SHARE = 0.8;   // what each adjacent body takes, vs one clean swing
export const BRACE_TURNS  = 4;
export const BRACE_CUT    = 0.4;   // damage taken, reduced by this share
export const BRACE_THORNS = 0.5;   // what the blocker hands back, of what it stopped
export const FINISH_MAX   = 2.5;   // the blow at the target's last sliver

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
  bow:    { n:'활류',   t:'화살을 먹고 멀리서 쏜다. 붙으면 활대로 때리는 셈이라 절반만 아프다.' },
  wand:   { n:'지팡이류', t:'때리는 물건이 아니다. 최대 마나가 오르고, 주문 위력이 붙는다.' },
};

/* ── bows ─────────────────────────────────────────────────
   Monsters have shot at the player since the first week; the
   player has never been able to shoot back. Four of the eight
   things on floors 10 and below open at range, the ranger's whole
   identity is supposed to be distance, and the only answers in
   the game were a spell or a jog.

   A bow is a weapon that eats a second resource. That is the
   trade: it reaches, and it runs out. Melee with one in hand is
   half a blow, so carrying a bow is a commitment rather than a
   free extra button. */
export const BOW_MELEE = 0.5;      // what a bow swings for up close
export const BOW_FALLOFF = 0.045;  // damage lost per tile, so range is not free
export const QUIVER_MAX = 40;
export const AMMO_BUNDLE = 12;   // arrows per purchase

/* ── locks ────────────────────────────────────────────────
   A locked door used to cost nothing to force. Fail the roll and
   the only line was "문이 꿈쩍도 하지 않는다" — so you pressed the
   direction again, and again, and it always opened eventually.
   A key was a way to save turns, never a way to do something you
   otherwise could not.

   Now shouldering it spends effort, and when the effort is gone
   it spends you. That makes three different answers to the same
   door rather than one: the key (silent, instant, gone), the
   picks (quiet, skill, finite), and the shoulder (loud, free,
   costly) — and it makes standing in front of a locked door
   during a fight a mistake instead of a delay. */
export const FORCE_STAM   = 2;    // effort per shove
export const FORCE_HURT   = 3;    // and what it costs once the breath is gone
export const FORCE_NOISE  = 7;    // how far the racket carries, growing per try
export const PICK_USES    = 3;    // tries in one set of picks
export const CHEST_RUIN   = 0.5;  // odds a forced lid spoils something inside
/* The ranger's footing: how often a trap under the boot simply
   does not go off. Not immunity — a habit. */
export const RANGER_FOOTING = 0.55;

/* ── whose hands ──────────────────────────────────────────
   Until now a longsword was a longsword whoever picked it up.
   Every item read the same for every one of the forty-eight
   race×class pairs, which meant the pairs were a stat spread and
   nothing else.

   A fit is what a pair of hands does to a thing. The rules:

     it changes a *rule* or moves a number that already exists —
       never a flat "+10% because you match", which is a tax on
       reading rather than a decision
     the good ones are narrow. A fit that fires on half the table
       is a difficulty setting, not a build
     the bad ones are real, and they are the player's fault. A
       mage in plate should regret it
     nothing here is hidden. `fitsOf` feeds the item card, so the
       card says what these hands do with this thing before it is
       equipped

   Deliberately *not* balanced against each other. 마법사 × 지팡이
   returning mana is small and constant; 레인저 × 활 recovering
   arrows is enormous for that build and worthless for any other.
   That asymmetry is the point — it is what makes the forty-eight
   pairs into forty-eight different games rather than one game
   with a stat screen. */
const isHeavy = it => it.kind === 'armour' && (it.ac || 0) >= 12;
const fam = (it, t) => it.kind === 'weapon' && it.t === t;

export const FITS = [
  /* ── the hands that fit ───────────────────────────── */
  { id:'roguesEdge', n:'도적의 날', good:true,
    when:(p, it) => p.cls === 'rogue' && fam(it, 'dagger'),
    t:'세 번째 손이 두 번째에 온다.',
    rule:'thirdAtTwo' },
  { id:'archersHand', n:'궁수의 손', good:true,
    when:(p, it) => p.cls === 'ranger' && fam(it, 'bow'),
    t:'쏜 화살의 절반은 주워 올 수 있다.',
    rule:'recover' },
  { id:'magesRod', n:'술사의 지팡이', good:true,
    when:(p, it) => p.cls === 'mage' && fam(it, 'wand'),
    t:'주문을 외울 때마다 마나 1이 돌아온다.',
    rule:'siphon' },
  { id:'oathShield', n:'맹세의 방패', good:true,
    when:(p, it) => p.cls === 'paladin' && it.slot === 'shield',
    t:'맹세가 두 배로 쌓인다.',
    rule:'twiceSworn' },
  { id:'clericsWeight', n:'사제의 무게', good:true,
    when:(p, it) => p.cls === 'priest' && fam(it, 'mace'),
    t:'죽지 않는 것에게 피해 +40%.',
    rule:'vsUndead' },
  { id:'warriorsHaft', n:'전사의 자루', good:true,
    when:(p, it) => p.cls === 'warrior' && (fam(it, 'great') || fam(it, 'axe')),
    t:'휩쓸기가 한 칸 더 나간다.',
    rule:'wideCleave' },

  /* ── the blood that fits ──────────────────────────── */
  { id:'stoneBorn', n:'돌 밑에서 났다', good:true,
    when:(p, it) => p.race === 'dwarf' && isHeavy(it),
    t:'무거운 갑옷의 방어 +3, 힘 요구가 없다.',
    mod:{ ac: 3 }, rule:'noStrReq' },
  { id:'longSight', n:'긴 눈', good:true,
    when:(p, it) => p.race === 'elf' && fam(it, 'bow'),
    t:'사거리 +2.',
    rule:'farEye' },
  { id:'smallHands', n:'작은 손', good:true,
    when:(p, it) => p.race === 'halfling' && fam(it, 'dagger'),
    t:'은신 +12%p. 작은 것은 작게 움직인다.',
    mod:{ stealth: 0.12 } },
  { id:'trollGrip', n:'트롤의 악력', good:true,
    when:(p, it) => p.race === 'halfTroll' && it.hands === 2,
    t:'두 손 무기를 한 손처럼 쥔다 — 피해 +12%.',
    mod:{ dmgPct: 0.12 } },

  /* ── the hands that do not ────────────────────────── */
  { id:'ironTongue', n:'쇠가 혀를 막는다', good:false,
    when:(p, it) => (p.cls === 'mage' || p.cls === 'priest') && isHeavy(it),
    t:'최대 마나 −40%. 쇳덩이를 입고는 외울 수 없다.',
    mod:{ manaPct: -0.40 } },
  { id:'dullRod', n:'그냥 몽둥이', good:false,
    when:(p, it) => (p.cls === 'warrior' || p.cls === 'paladin') && fam(it, 'wand'),
    t:'피해 −35%. 손에 든 것이 무엇인지 모른다.',
    mod:{ dmgPct: -0.35 } },
  { id:'elfInPlate', n:'엘프에게 판금', good:false,
    when:(p, it) => (p.race === 'elf' || p.race === 'halfling') && isHeavy(it),
    t:'명중 −6, 은신이 사라진다.',
    mod:{ hit: -6 }, rule:'noStealth' },
  { id:'orcishAim', n:'오크의 조준', good:false,
    when:(p, it) => (p.race === 'halfOrc' || p.race === 'halfTroll') && fam(it, 'bow'),
    t:'명중 −8. 시위는 참을성 있는 손을 좋아한다.',
    mod:{ hit: -8 } },
];

/* The things a mace is for. Derived from the sprites the bestiary
   already uses rather than kept by hand next to the fit — add an
   undead tomorrow and it is covered the day it is written. */
export const UNDEAD = ['wraith', 'mummy', 'lich', 'vampire', 'ashheap', 'emberpriest'];

/* ── the named ────────────────────────────────────────────
   A tier above 초월, and the only weapons in the game with proper
   nouns. One of each exists per run at most, they are never
   rolled with affixes, and every one carries a rule rather than a
   bigger die — the same bar the resonances have to clear.

   They are found, never bought and never forged, which is what
   keeps them a story rather than a shopping list. */
export const UNIQUES = [
  { id:'ashcount', n:'재를 세는 자',   spr:'dagger', t:'dagger', dice:[2,6], d:4,  hands:1,
    rule:'재운 것 하나마다 피해 +1. 층을 내려가면 셈이 처음으로 돌아간다.',
    lore:'자루에 금이 그어져 있다. 세는 쪽은 칼이지 당신이 아니다.' },
  { id:'longhush', n:'긴 침묵',       spr:'bow',    t:'bow',    dice:[2,6], d:6,  hands:2, rng:7,
    rule:'맞은 것 말고는 아무것도 깨어나지 않는다.',
    lore:'시위를 당겨도 소리가 나지 않는다. 놓아도 마찬가지다.' },
  { id:'emberpull', n:'화로에서 꺼낸 것', spr:'great', t:'great', dice:[3,6], d:8, hands:2,
    rule:'잃은 피가 많을수록 무거워진다 — 반쯤 죽었을 때 피해 +60%.',
    lore:'아직 식지 않았다. 몇 해가 지났는데도.' },
  { id:'promise',  n:'약속',          spr:'sword',  t:'sword',  dice:[2,7], d:9,  hands:1,
    rule:'넘치게 때린 만큼이 체력으로 돌아온다.',
    lore:'누가 누구에게 한 약속인지는 적혀 있지 않다.' },
  { id:'nailer',   n:'못 박는 자',     spr:'mace',   t:'mace',   dice:[3,5], d:10, hands:1,
    rule:'맞은 것은 다음 턴에 움직이지 못한다.',
    lore:'대장장이의 물건이었다. 대장장이는 그것으로 못을 박지 않았다.' },
  { id:'twicewept', n:'두 번 우는 활', spr:'bow',    t:'bow',    dice:[2,7], d:12, hands:2, rng:8,
    rule:'한 번 쏠 때마다 두 발이 나간다. 두 번째는 절반. 화살은 하나만 든다.',
    lore:'첫 번째는 맞은 것을 위해, 두 번째는 쏜 것을 위해 운다고 한다.' },
  { id:'lastlamp', n:'마지막 등불',    spr:'wand',   t:'wand',   dice:[1,6], d:13, hands:1,
    manaFlat:8, spellPow:0.25,
    rule:'체력이 4분의 1 아래면 주문에 마나가 들지 않는다.',
    lore:'심지가 짧을수록 밝다. 그것이 등불에게 좋은 일은 아니다.' },
];
export const uniqueById = id => UNIQUES.find(u => u.id === id);
export const UNIQUE_ODDS = 0.035;   // share of floor drops, past its depth

/* ── the oddities ─────────────────────────────────────────
   An enchantment that only wakes in the wrong hands.

   A mage in plate is a mistake, and it should stay a mistake —
   the mana penalty does not go away. But once in a long while the
   thing you should not be wearing turns out to have been made for
   exactly that, and then wearing it anyway is the best decision
   in the run.

   Every one of these is gated on a *bad* fit being active on the
   same item, so they cannot be farmed by playing correctly. They
   are the reward for a mistake you chose to keep. */
export const ODDITIES = [
  { id:'runeplate', n:'룬을 새긴 자의 것', needs:'ironTongue',
    t:'마나는 여전히 줄어든다. 그러나 나오는 주문은 두 배로 나간다.',
    say:'쇠가 혀를 막는다 — 막힌 것이 안에서 터진다.' },
  { id:'blindswing', n:'모르고 휘두른 것', needs:'dullRod',
    t:'막대를 휘두를 때마다 마력 화살이 함께 나간다.',
    say:'무엇인지 모르고 휘둘렀는데, 그것이 대답했다.' },
  { id:'quietsteel', n:'소리 없는 강철', needs:'elfInPlate',
    t:'서 있는 동안에는 보이지 않는다.',
    say:'너무 무거워서 아무 소리도 나지 않는다.' },
  { id:'breakhand', n:'부러뜨리는 손',  needs:'orcishAim',
    t:'명중은 그대로 나쁘다. 맞으면 두 배다.',
    say:'조준을 포기하자 활이 부러질 듯 휘었다.' },
];
export const oddityById = id => ODDITIES.find(o => o.id === id);
export const ODDITY_ODDS = 0.045;   // share of generated gear carrying one

/* Everything the current hands do to this one thing. One funnel,
   so the item card and gearBonus can never disagree. */
export function fitsOf(p, it) {
  if (!p || !it) return [];
  return FITS.filter(f => { try { return f.when(p, it); } catch { return false; } });
}

/* The oddity on this item, and only if the hands holding it are
   the wrong ones. Written as one reader so the item card, the
   rules and the log can never disagree about whether it is awake. */
export function oddityOf(p, it) {
  if (!it?.odd) return null;
  const o = oddityById(it.odd);
  if (!o) return null;
  return fitsOf(p, it).some(f => f.id === o.needs) ? o : null;
}
export const fitRule = (p, rule) =>
  ['weapon', 'body', 'shield'].some(k =>
    fitsOf(p, p?.equip?.[k]).some(f => f.rule === rule));

/* Ammunition. Ordinary arrows are cheap and everywhere; the other
   three are a decision about which fight you are saving them for.
   `dmg` is a multiplier on the bow's roll. */
export const AMMO = [
  { id:'arrow',  n:'화살',        spr:'spear', cost:3,  rar:14, d:0,  dmg:1.0,
    desc:'평범한 화살. 쏘고 나면 사라진다.' },
  { id:'heavy',  n:'무거운 화살',  spr:'spear', cost:9,  rar:7,  d:3,  dmg:1.55, hit:-8,
    desc:'피해 +55%, 명중 −8. 두꺼운 것에게.' },
  { id:'venom',  n:'독화살',      spr:'spear', cost:12, rar:6,  d:5,  dmg:0.9,  on:'poison',
    desc:'맞은 것이 중독된다. 오래 끄는 싸움에.' },
  { id:'ember',  n:'불화살',      spr:'spear', cost:16, rar:5,  d:8,  dmg:1.15, burst:0.35,
    desc:'죽은 자리가 터진다. 무리 한가운데로.' },
];
export const ammoById = id => AMMO.find(a => a.id === id);

/* ── 문장 ─────────────────────────────────────────────────
   Every blow in this game used to read `${적}에게 ${n}의 피해.`
   A two hundred turn run is two hundred identical sentences, and
   a game whose log is meant to be *read* cannot afford that. The
   log is the only place the fiction actually happens turn to
   turn — the sprites are eight pixels square.

   Two axes and no more, because a table nobody can hold in their
   head drifts. The weapon decides the *verb* — a mace does not
   cut and a dagger does not crush — and how much of the target's
   health went decides *how hard the verb swings*. Both are read
   off the same numbers the rules already computed, so the prose
   can never claim something the arithmetic did not do.

   Bands: 스침 under an eighth, 보통 under a third, 깊음 under two
   thirds, 치명 above. Deliberately relative to the target: eleven
   damage is a scratch on a troll and the end of a rat, and the
   sentence should know which. */
export const STRIKES = {
  dagger: [['{n}의 옆구리를 얕게 그었다', '{n}의 살갗을 스쳤다', '{n}의 손등을 그었다'],
           ['{n}의 옆구리에 날을 밀어 넣었다', '{n}을(를) 짧게 두 번 찔렀다', '{n}의 허벅지를 갈랐다'],
           ['{n}의 갈비 사이로 깊게 찔러 넣었다', '{n}의 목덜미를 그었다', '{n}의 겨드랑이 아래를 찔렀다'],
           ['{n}의 급소를 정확히 꿰었다', '날이 {n}의 등으로 빠져나왔다', '{n}이(가) 소리도 내지 못했다']],
  sword:  [['{n}을(를) 얕게 베었다', '{n}의 팔을 스치고 지나갔다', '{n}의 손목을 베었다'],
           ['{n}의 어깨를 베어 내렸다', '{n}의 옆구리를 갈랐다', '{n}의 허벅지를 베었다'],
           ['{n}의 가슴을 크게 열었다', '{n}을(를) 어깨에서 허리까지 갈랐다', '{n}의 목을 스쳐 지나갔다'],
           ['{n}을(를) 한 번에 베어 넘겼다', '칼이 {n}을(를) 가로질렀다', '{n}이(가) 베인 자리를 붙잡지도 못했다']],
  axe:    [['{n}의 팔뚝을 찍었다', '도끼날이 {n}을(를) 얕게 물었다', '{n}의 정강이를 찍었다'],
           ['{n}의 어깨죽지를 찍어 내렸다', '{n}의 어깨를 비스듬히 찍었다', '{n}의 등을 찍었다'],
           ['{n}의 쇄골을 부수며 박혔다', '{n}을(를) 어깨에서 쪼갰다', '도끼가 {n}의 뼈에 걸렸다'],
           ['{n}을(를) 세로로 쪼갰다', '도끼가 {n}을(를) 통째로 열었다', '{n}이(가) 도끼째로 끌려왔다']],
  spear:  [['{n}을(를) 창끝으로 찔렀다', '창이 {n}의 팔을 스쳤다', '{n}을(를) 창끝으로 밀어냈다'],
           ['{n}의 배를 꿰뚫었다', '{n}을(를) 창대째 밀어붙였다', '{n}의 어깨를 꿰었다'],
           ['{n}을(를) 깊게 꿰뚫었다', '창이 {n}을(를) 관통했다', '{n}이(가) 창을 붙잡고 매달렸다'],
           ['{n}을(를) 꿰어 바닥에 박았다', '창이 {n}의 등으로 나왔다', '{n}이(가) 창끝에서 멈췄다']],
  mace:   [['{n}을(를) 후려쳤다', '{n}의 어깨를 때렸다', '{n}의 팔을 쳐냈다'],
           ['{n}의 뼈를 울렸다', '{n}의 갑옷을 우그러뜨렸다', '{n}을(를) 반걸음 밀어냈다'],
           ['{n}의 갈비를 부러뜨렸다', '{n}의 투구를 찌그러뜨렸다', '{n}이(가) 숨을 놓쳤다'],
           ['{n}의 머리를 짓이겼다', '{n}을(를) 한 번에 눕혔다', '{n}의 몸이 잘못된 방향으로 접혔다']],
  great:  [['{n}을(를) 무겁게 밀어 베었다', '칼등이 {n}을(를) 훑었다', '{n}의 발치를 훑었다'],
           ['{n}을(를) 크게 내리쳤다', '{n}의 몸통을 가로로 베었다', '{n}을(를) 통째로 밀어냈다'],
           ['{n}을(를) 어깨부터 내리찍었다', '{n}을(를) 두 걸음 뒤로 날렸다', '{n}의 발이 땅에서 떨어졌다'],
           ['{n}을(를) 두 동강 냈다', '{n}이(가) 반으로 접혔다', '{n}이(가) 있던 자리만 남았다']],
  spell:  [['{n}을(를) 그을렸다', '{n}의 겉을 태웠다'],
           ['{n}을(를) 태웠다', '{n}의 몸에서 김이 올랐다'],
           ['{n}을(를) 안쪽까지 태웠다', '{n}이(가) 비명을 삼켰다'],
           ['{n}을(를) 재로 만들 뻔했다', '{n}의 안쪽이 먼저 무너졌다']],
  arrow:  [['화살이 {n}을(를) 스쳤다', '{n}의 어깨에 화살이 박혔다'],
           ['화살이 {n}의 옆구리에 박혔다', '{n}이(가) 화살을 맞고 휘청였다'],
           ['화살이 {n}의 가슴 깊이 박혔다', '{n}을(를) 화살이 꿰뚫었다'],
           ['화살이 {n}의 목을 꿰었다', '{n}이(가) 화살을 문 채 주저앉았다']],
  hand:   [['{n}을(를) 밀쳤다', '{n}의 턱을 스쳤다'],
           ['{n}을(를) 후려쳤다', '{n}의 배를 쳤다'],
           ['{n}을(를) 세게 내리쳤다', '{n}을(를) 바닥에 찍었다'],
           ['{n}을(를) 주먹으로 눕혔다', '{n}이(가) 그대로 넘어갔다']],
};

/* What the thing in front of you does back. Same bands, read
   against *your* health — the sentence should know the difference
   between a scratch and the hit that decides the run. */
export const TAKEN = [
  ['{n}이(가) 스치고 지나갔다', '{n}에게 얕게 긁혔다', '{n}에게 어깨를 스쳤다'],
  ['{n}이(가) 당신을 때렸다', '{n}이(가) 방어를 밀어냈다', '{n}에게 옆구리를 내주었다'],
  ['{n}이(가) 당신을 깊게 때렸다', '{n}이(가) 갑옷을 뚫고 들어왔다', '{n}에게 크게 맞았다'],
  ['{n}이(가) 당신을 무너뜨릴 뻔했다', '{n}에게 맞고 무릎이 꺾였다', '{n}에게 시야가 하얗게 날아갔다'],
];

export const MISS_BY = ['{n}이(가) 허공을 갈랐다', '{n}이(가) 헛디뎠다',
                        '{n}의 공격이 빗나갔다', '몸을 틀어 {n}을(를) 피했다'];
export const MISS_AT = ['{n}을(를) 빗맞혔다', '날이 허공을 갈랐다',
                        '{n}이(가) 몸을 틀어 피했다', '손이 미끄러졌다'];
export const FELLED  = ['{n}이(가) 쓰러졌다', '{n}이(가) 무너졌다',
                        '{n}이(가) 더는 일어나지 않는다', '{n}이(가) 조용해졌다'];

export const band = (dmg, maxhp) => {
  const f = dmg / Math.max(1, maxhp);
  return f < 0.125 ? 0 : f < 0.33 ? 1 : f < 0.66 ? 2 : 3;
};

/* One reader, so a family with no table falls back rather than
   throwing, and the two variants alternate on a counter the
   caller owns instead of on a die — the same blow twice in a row
   reading identically is what we are fixing. */
export function strikeLine(family, name, dmg, maxhp, tick = 0) {
  const rows = STRIKES[family] || STRIKES.hand;
  const pair = rows[band(dmg, maxhp)];
  return pair[tick % pair.length].replace(/\{n\}/g, name);
}
export function takenLine(name, dmg, maxhp, tick = 0) {
  const pair = TAKEN[band(dmg, maxhp)];
  return pair[tick % pair.length].replace(/\{n\}/g, name);
}
export const pickLine = (list, name, tick = 0) =>
  list[tick % list.length].replace(/\{n\}/g, name);

/* Weapons carry dice (count × sides) and a type. Armour carries ac. */
export const WEAPONS = [
  { spr:'dagger', n:'단검',         t:'dagger', dice:[1,5],  d:0,  cost:20,   hands:1 },
  { spr:'mace',  n:'곤봉',         t:'mace',   dice:[1,7],  d:0,  cost:24,   hands:1 },
  { spr:'sword', n:'짧은 검',      t:'sword',  dice:[1,8],  d:1,  cost:70,   hands:1 },
  { spr:'spear',   n:'창',           t:'spear',  dice:[1,9],  d:1,  cost:85,   hands:2 },
  { spr:'mace',  n:'철퇴',         t:'mace',   dice:[2,4],  d:2,  cost:90,   hands:1 },
  { spr:'axe',   n:'손도끼',       t:'axe',    dice:[1,10], d:2,  cost:130,  hands:1 },
  { spr:'dagger', n:'사냥칼',       t:'dagger', dice:[1,9],  d:2,  cost:150,  hands:1 },
  { spr:'sword', n:'장검',         t:'sword',  dice:[2,6],  d:3,  cost:260,  hands:1 },
  { spr:'mace',  n:'전투 망치',    t:'mace',   dice:[3,4],  d:5,  cost:320,  hands:1 },
  { spr:'axe',   n:'전투 도끼',    t:'axe',    dice:[2,9],  d:6,  cost:520,  hands:2 },
  { spr:'spear',   n:'장창',         t:'spear',  dice:[2,8],  d:7,  cost:700,  hands:2 },
  { spr:'great', n:'양손검',       t:'great',  dice:[3,7],  d:8,  cost:900,  hands:2 },
  { spr:'dagger', n:'가시 단도',    t:'dagger', dice:[2,7],  d:9,  cost:1100, hands:1 },
  { spr:'spear',   n:'미늘창',       t:'spear',  dice:[4,6],  d:10, cost:1400, hands:2 },
  { spr:'great',  n:'파쇄추',       t:'great',  dice:[4,7],  d:11, cost:2200, hands:2 },
  { spr:'sword', n:'룬이 새겨진 검', t:'sword', dice:[4,8], d:12, cost:3000, hands:1 },
  /* Every family needs a late-game entry or the choice collapses
     back into "take the biggest die" by floor 10. */
  { spr:'mace',  n:'별철퇴',       t:'mace',   dice:[2,9],  d:8,  cost:820,  hands:1 },
  { spr:'mace',  n:'룬 철퇴',      t:'mace',   dice:[3,9],  d:12, cost:2600, hands:1 },
  { spr:'dagger', n:'서슬 단검',    t:'dagger', dice:[3,7],  d:12, cost:2400, hands:1 },
  { spr:'axe',   n:'쌍날 도끼',    t:'axe',    dice:[3,8],  d:12, cost:2700, hands:2 },
  { spr:'spear',   n:'용창',         t:'spear',  dice:[4,7],  d:13, cost:3200, hands:2 },

  /* Rods. The mage had no mage's weapon: every class was holding
     something from the same six families, and the one whose whole
     kit is mana had nothing that spoke to mana. A rod is a bad
     stick that makes the book better — which is the trade a
     caster should be making with its weapon slot. */
  { spr:'wand',  n:'개암나무 막대',  t:'wand',   dice:[1,4],  d:0,  cost:70,   hands:1, manaFlat:3,  spellPow:0.10 },
  { spr:'wand',  n:'주목 지팡이',    t:'wand',   dice:[1,6],  d:3,  cost:280,  hands:1, manaFlat:6,  spellPow:0.20 },
  { spr:'wand',  n:'뼈 지팡이',      t:'wand',   dice:[2,5],  d:7,  cost:820,  hands:1, manaFlat:10, spellPow:0.32 },
  { spr:'wand',  n:'별 박힌 홀',     t:'wand',   dice:[2,6],  d:11, cost:2400, hands:1, manaFlat:16, spellPow:0.48 },

  /* Bows. Reach is the stat that matters, so it climbs with the
     table while the dice stay modest — a longbow is not a better
     sword, it is a different question about where you stand. */
  { spr:'bow',   n:'짧은 활',      t:'bow',    dice:[1,7],  d:0,  cost:60,   hands:2, rng:5 },
  { spr:'bow',   n:'사냥 활',      t:'bow',    dice:[2,5],  d:3,  cost:240,  hands:2, rng:6 },
  { spr:'bow',   n:'장궁',         t:'bow',    dice:[2,8],  d:7,  cost:760,  hands:2, rng:8 },
  { spr:'bow',   n:'뿔나무 활',    t:'bow',    dice:[3,7],  d:11, cost:2100, hands:2, rng:9 },
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
  /* Not a potion — a tool. It sits in the same pack line because
     it stacks and is spent, but it is never drunk: the lock code
     reaches for it by id. Three tries to a set. */
  { id:'picks',    spr:'ring',   n:'자물쇠 갈고리', d:1,  cost:55,  rar:9,  use:null,
    desc:'잠긴 문과 상자를 조용히 연다. 실패해도 하나가 닳는다' },
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
  { id:1, n:'잡화점',   spr:'torch',  stock:['torch','potHeal','scrMap'], ammo:['arrow'] },
  { id:2, n:'방어구점', spr:'armor',  stock:'armour' },
  { id:3, n:'무기점',   spr:'sword',  stock:'weapon', ammo:['arrow','heavy','venom','ember'] },
  { id:4, n:'신전',     spr:'amulet', stock:['potHeal','potCure'] },
  { id:5, n:'연금술사', spr:'potion', stock:['potHeal','potMana','potCure'], cats:true },
  { id:6, n:'마법상',   spr:'wand',   stock:['scrMap','scrTele','scrFlee','potMana'] },
  /* Not in town. This one walks the dungeon, which is the only
     reason the gold in your purse means anything after floor 1. */
  { id:7, n:'떠돌이 상인', spr:'amulet', wander:true,
    stock:['potHeal','potCure','potMana','scrTele','scrMap','scrFlee','torch'],
    mats:['scrap','dust','essence'], cats:true },
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
  /* Every source of `dawn` was the one armour engraving, and an
     armour engraving needs +3 on the plate — measured, 6.7% of
     runs ever cut one at all, and then it is a one-in-six pick.
     여명의 맹세 sat on 0.8% and fired zero times in 360 games.
     Putting it in the ordinary suffix pool gives that side a
     second origin, the same fix 가시밭 and 메아리의 방 needed. */
  { id:'morning', n:'아침',     tags:['armour'], dawn:0.10 },

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
  /* 초월. Colourless on purpose — every other tier gets a hue,
     and the one above them all is simply too bright to have one. */
  { n:'초월', tone:'W', glow:'#f2efe4' },
];
export const CURSED_TONE = 'R';

/* ── 초월 ─────────────────────────────────────────────────
   The tier you cannot grind into. Rarity 0–3 is arithmetic on
   affixes and plus; 초월 is a flag rolled once, at the moment
   the item is created, and never afterwards. That is the whole
   design: a player who has seen one knows it was luck, not a
   shopping list, and remembers which run it was.

   Every 초월 item carries a 은총 — a rule no ordinary affix can
   give. The stat sheet is not the point; the rule is.        */
export const BOONS = [
  { id:'ruin',  n:'파멸의',  t:'치명타가 대상의 최대 체력 8%를 함께 태운다.' },
  { id:'aegis', n:'불괴의',  t:'부서지지 않는다. 부식도 통하지 않는다.' },
  { id:'hoard', n:'만금의',  t:'금화와 재료를 60% 더 얻는다.' },
  { id:'echo',  n:'울림의',  t:'주문이 언제나 두 번째 대상에게 절반으로 번진다.' },
  { id:'tide',  n:'역류의',  t:'체력이 25% 아래로 떨어지면 층마다 한 번 절반까지 되돌아온다.' },
  { id:'wrath', n:'진노의',  t:'정예와 이름 있는 것에게 주는 피해 +35%.' },
];
export const boonById = id => BOONS.find(b => b.id === id);

/* Per weapon or armour created. 1층 0.6%, 15층 3.0% — rare
   enough that most runs never see one, common enough that a
   player who plays for a week has a story. */
export const transChance = depth => 0.006 + depth * 0.0016;

export function rarityOf(item) {
  if (!item || (item.kind !== 'weapon' && item.kind !== 'armour')) return 0;
  if (item.boon) return 4;
  const pre = PREFIXES.find(a => a.id === item.pre);
  const suf = SUFFIXES.find(a => a.id === item.suf);
  const score = (pre ? 2 : 0) + (suf ? 2 : 0) + (item.plus || 0)
              + (item.engrave || []).length * 2
              + (item.d >= 13 ? 1 : 0);
  return score >= 6 ? 3 : score >= 4 ? 2 : score >= 1 ? 1 : 0;
}

export const isCursed = item =>
  !!(PREFIXES.find(a => a.id === item?.pre)?.curse
  || SUFFIXES.find(a => a.id === item?.suf)?.curse);

export const affixName = (item) => {
  /* A named weapon is only ever its name. No plus, no prefix —
     the whole point of a proper noun is that there is one of it
     and it is already finished. */
  if (item.unique) return `《${item.n}》`;
  const pre = item.pre ? PREFIXES.find(a => a.id === item.pre) : null;
  const suf = item.suf ? SUFFIXES.find(a => a.id === item.suf) : null;
  const plus = item.plus ? `+${item.plus} ` : '';
  const boon = item.boon ? boonById(item.boon) : null;
  // Engravings read before the prefix and after the 은총: they are
  // cut into the thing, where a prefix is only true of it.
  const marks = (item.engrave || []).map(id => engraveById(id)?.n).filter(Boolean).join(' ');
  // The 은총 goes in front of everything, including the prefix:
  // it is the first thing true about the item.
  return `${plus}${boon ? boon.n + ' ' : ''}${marks ? marks + ' ' : ''}` +
         `${pre ? pre.n + ' ' : ''}${item.n}${suf ? ' · ' + suf.n : ''}`;
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

/* ── what a thing is worth ────────────────────────────────
   One number, read by both the merchant and the anvil. They
   used to disagree: the shop priced off `cost` alone while
   salvage read a depth tier, so a +5 이중부여 검 sold for the
   same as the plain one it started as, and broke into the same
   pile as a soft leather from floor 1. Enhancement and affixes
   are most of an item's value by floor 8, and now they count
   in both places because there is only one place to count them. */
export function worthOf(item) {
  if (!item) return 0;
  const affixes = (item.pre ? 1 : 0) + (item.suf ? 1 : 0);
  const marks = (item.engrave || []).length;
  return Math.round((item.cost || 10)
    * (1 + (item.plus || 0) * 0.42)     // every + is real money
    * (1 + affixes * 0.55)              // and so is every affix
    * (1 + marks * 0.85)                // an engraving is worth more than either
    * (item.boon ? 3.5 : 1));           // 초월 is not for sale cheap
}

/* Breaking it gives materials proportional to that same worth.
   The three tiers are gates, not curves: scrap from anything,
   dust only from things that carry magic, essence only from
   things that were genuinely valuable. */
export function salvageYield(item) {
  const w = worthOf(item);
  const affixes = (item.pre ? 1 : 0) + (item.suf ? 1 : 0)
                + (item.engrave || []).length;
  return {
    scrap:   Math.max(1, Math.min(48, Math.round(w / 26))),
    dust:    affixes ? affixes + Math.floor(w / 320) : 0,
    essence: w >= 600 ? 1 + Math.floor(w / 2200) : 0,
  };
}

/* Enhancement costs climb steeply so +5 is a campaign, not a
   formality. Gold finally has a hole to fall into. */
export const upgradeCost = plus => ({
  scrap: 3 + plus * 3,
  gold:  50 + plus * 90,
});

/* ── engravings ───────────────────────────────────────────
   Prefixes and suffixes are numbers; an engraving is a rule,
   and the only way to get one is to survive a specific strike
   at the anvil. Reaching +4 cuts the first, reaching +7 cuts
   the second — and those two strikes are markedly harder than
   the ones around them, because they are doing more than adding
   a number.

   That is the whole shape of the system: the milestone is where
   the item stops being a bigger version of itself and becomes a
   different item, and it is exactly where the anvil is most
   likely to take it off you.                                 */
export const ENGRAVE_AT = [3, 5, 7];
export const ENGRAVE_PENALTY = 0.18;   // success chance lost on a milestone strike

export const ENGRAVINGS = [
  // weapons
  { id:'pierce', n:'관통의',  tags:['weapon'], t:'적 방어를 25% 무시한다.',  pierce:0.25 },
  { id:'reap',   n:'수확의',  tags:['weapon'], t:'체력 12% 아래의 적을 즉사시킨다.', execute:0.12 },
  { id:'storm',  n:'폭풍의',  tags:['weapon'], t:'30% 확률로 인접한 다른 적까지 벤다.', chain:0.30 },
  { id:'hunt',   n:'사냥의',  tags:['weapon'], t:'상처 없는 적에게 첫 타 피해 +55%.', firstStrike:0.55 },
  { id:'duel',   n:'결전의',  tags:['weapon'], t:'정예·이름 있는 것·보스에게 피해 +30%.', vsElite:0.30 },
  { id:'thirst', n:'갈증의',  tags:['weapon'], t:'준 피해의 12%를 체력으로 가져온다.', lifesteal:0.12 },
  // armour and shields
  { id:'bedrock',n:'반석의',  tags:['armour'], t:'받는 모든 피해가 3 줄어든다.',     flatDR:3 },
  { id:'thorn',  n:'가시의',  tags:['armour'], t:'받은 피해의 20%를 때린 쪽에 돌려준다.', reflect:0.20 },
  { id:'dawn',   n:'여명의',  tags:['armour'], t:'층에 들어설 때 최대 체력의 15%를 회복한다.', dawn:0.15 },
  { id:'mend',   n:'재생의',  tags:['armour'], t:'회복 주기마다 2씩 더 아문다.',     regen:2 },
  { id:'shrug',  n:'인내의',  tags:['armour'], t:'상태이상이 절반만 걸린다.',        ailShrug:0.5 },
  { id:'anchor', n:'닻의',    tags:['armour'], t:'거미줄과 마비에 걸리지 않는다.',    anchor:true },
];

export const engraveById = id => ENGRAVINGS.find(e => e.id === id);

/* How many engraving slots a given plus has opened. */
export const engraveSlots = plus =>
  ENGRAVE_AT.filter(n => (plus || 0) >= n).length;

/* Is the strike that takes `plus` to `plus+1` a milestone one? */
export const isMilestone = plus => ENGRAVE_AT.includes((plus || 0) + 1);

/* ── the anvil ────────────────────────────────────────────
   A +5 that always lands is a shopping list. The interesting
   version of enhancement is the one every Korean MMO found by
   accident: past a point the strike can fail, and past another
   point it can take the sword with it. That turns "can I afford
   it" into "do I dare", which is a much better question — and
   it is the same question the altar already asks, moved to the
   one screen where the player has something to lose.

   Two ways to strike, printed side by side:
     과감 — the listed odds, and one in eight lands *two* steps.
            Past +4 a failure costs a level; past +6 it can
            shatter the thing outright.
     신중 — twice the price, better odds, and a failure is only
            ever a failure. The metal never fatigues, never
            breaks. You are buying the tail away.

   MAX_PLUS climbed from 5 to 8 because the odds now do the
   gating that the cap used to do. A +8 weapon is +16 damage and
   should be the thing a player tells someone about. Spells stay
   capped at 5: spell power multiplies rather than adds, and 5
   is already ×2.1.                                           */
const UPGRADE_ODDS = [1, 1, 0.92, 0.80, 0.66, 0.52, 0.40, 0.30, 0.22];
export const upgradeOdds = plus => UPGRADE_ODDS[plus] ?? 0.16;

export const upgradeRisk = plus =>
  plus >= 6 ? { down: 1, breakPct: 0.30 }
: plus >= 4 ? { down: 1, breakPct: 0 }
:             { down: 0, breakPct: 0 };

export const UPGRADE_CRIT   = 0.125;  // 과감: two steps instead of one
export const CAREFUL_MULT   = 2;      // 신중: price
export const CAREFUL_BONUS  = 0.18;   // 신중: added success chance

export const ENCHANT_COST = { dust: 4, gold: 130 };
export const REROLL_COST  = { essence: 1, dust: 2, gold: 220 };

/* ── catalysts ────────────────────────────────────────────
   Materials are a currency; catalysts are a decision. Each one
   is a single-use item that changes the *rules* of one strike
   at the anvil rather than paying for it, and each one answers
   a question the anvil asks and nothing else does.

   They are rare on the floor and expensive from a merchant, so
   the interesting moment is the one where you are standing at
   +6 holding exactly one 수호의 못 and deciding whether this is
   the sword you spend it on.

   `on` says which action will accept it.                    */
export const CATALYSTS = [
  { id:'flux',  n:'정련의 촉매', spr:'potion', cost:340,  rar:11, d:2,  on:'upgrade',
    t:'실패해도 단계가 깎이지 않는다. 부서지는 것은 막지 못한다.' },
  { id:'ward',  n:'수호의 못',   spr:'ring',   cost:620,  rar:7,  d:5,  on:'upgrade',
    t:'실패해도 부서지지 않는다.' },
  { id:'surge', n:'폭주의 불씨', spr:'torch',  cost:540,  rar:8,  d:4,  on:'upgrade',
    t:'성공하면 반드시 두 단계 오른다. 실패 확률은 그대로.' },
  { id:'core',  n:'심연의 핵',   spr:'amulet', cost:1500, rar:2,  d:9,  on:'upgrade',
    t:'이 한 번은 반드시 성공한다.' },
  { id:'seal',  n:'봉인의 밀랍', spr:'scroll', cost:520,  rar:8,  d:3,  on:'enchant',
    t:'저주가 붙지 않는다.' },
  { id:'prism', n:'분광석',      spr:'gold',   cost:880,  rar:4,  d:7,  on:'enchant',
    t:'접두와 접미를 한 번에 건다.' },
];
export const catalystById = id => CATALYSTS.find(c => c.id === id);
export const makeCatalyst = id => ({ kind:'cat', ...catalystById(id) });

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
    t:'최대 체력 −25%. 치명타 확률 +20%p. 무모함과 섞이면 무엇이 되는지 아무도 모른다.' },
  { id:'echo',    n:'메아리의 종',   spr:'amulet', k:'echo',    v:6,
    t:'연격 6 이상이면 공격이 한 번 더 들어간다. 북이 있어야 진군이 된다.' },
  { id:'hunger',  n:'굶주린 칼날',   spr:'sword',  k:'hunger',  v:3,
    t:'처치할 때마다 체력 +3. 기름을 두 배로 태운다. 위장이 크면 더 굶주린다.' },
  { id:'mirror',  n:'거울 방패',     spr:'shield', k:'mirror',  v:0.35,
    t:'받은 피해의 35%를 때린 쪽에 돌려준다.' },
  { id:'eye',     n:'심연의 눈',     spr:'scroll', k:'eye',     v:3,
    t:'층에 들어설 때 지도가 전부 보인다. 최대 마나 −3. 부러진 바늘이 가리키는 쪽을 본다.' },
  { id:'glove',   n:'도굴꾼의 장갑', spr:'ring',   k:'glove',   v:2,
    t:'상자와 바닥의 전리품이 두 배. 함정을 영영 못 본다.' },
  { id:'ember',   n:'불씨 항아리',   spr:'potion', k:'ember',   v:1,
    t:'모닥불을 두 번 쓸 수 있다.' },
  { id:'scale',   n:'저울추',        spr:'ring',   k:'scale',   v:0.6,
    t:'체력이 30% 아래일 때 주는 피해 +60%.' },
  { id:'twin',    n:'쌍둥이 룬',     spr:'wand',   k:'twin',    v:2,
    t:'주문 비용 −2. 주문 피해 −20%. 서약과 만나면 서로를 지운다.' },
  { id:'thief',   n:'시간 도둑',     spr:'ring',   k:'thief',   v:0.35,
    t:'층을 내려갈 때 체력을 전부 회복한다. 층의 여유 시간 −35%.' },
  { id:'bone',    n:'뼈 목걸이',     spr:'amulet', k:'bone',    v:1,
    t:'처치할 때마다 최대 체력 +1 (최대 +30).' },
  { id:'chain',   n:'사슬 갑주',     spr:'armor',  k:'chain',   v:4,
    t:'방어 +4. 은신이 사라진다 — 기습은 없다.' },
  { id:'compass', n:'부러진 나침반', spr:'ring',   k:'compass', v:1,
    t:'함정 피해를 입지 않는다. 대신 함정이 보이지 않는다. 심연의 눈이 대신 봐 준다면 이야기가 다르다.' },
  { id:'gut',     n:'폭식의 위장',   spr:'potion', k:'gut',     v:2,
    t:'물약 효과가 두 배. 배낭에 물약을 세 종류까지만 넣는다. 굶주린 날붙이와 짝이 맞는다.' },
  { id:'reckless',n:'무모함의 인장', spr:'sword',  k:'reckless',v:0.8,
    t:'명중 −15%. 치명타 배율 ×1.8. 피로 쓴 계약과 함께라면 더 멀리 간다.' },
  { id:'vow',     n:'침묵의 서약',   spr:'scroll', k:'vow',     v:0.3,
    t:'주문을 쓸 수 없다. 근접 피해 +30%. 쌍둥이 룬 앞에서만 말을 더듬는다.' },

  /* Second batch. With a hand that grows to seven, the pool has
     to be deep enough that two runs never hold the same five. */
  { id:'lamp',    n:'꺼지지 않는 등', spr:'torch', k:'lamp',    v:2,
    t:'기름이 줄지 않는다. 대신 불빛이 2칸 좁다.' },
  { id:'moth',    n:'나방의 표식',   spr:'ring',   k:'moth',    v:0.10,
    t:'층에 들어설 때 모닥불·제단·상인·사건 위치가 보인다. 최대 체력 −10%.' },
  { id:'knot',    n:'매듭 밧줄',     spr:'ring',   k:'knot',    v:0.5,
    t:'거미줄과 구덩이가 통하지 않는다. 은신 −50%.' },
  { id:'toll',    n:'뱃사공의 동전', spr:'gold',   k:'toll',    v:0.5,
    t:'금화를 두 배로 얻는다. 층을 내려갈 때 가진 금화의 10%를 잃는다. 깃펜이 장부를 적어 준다면.' },
  { id:'brand',   n:'낙인',          spr:'sword',  k:'brand',   v:0.5,
    t:'정예에게 주는 피해 +50%. 일반 몬스터에게 −15%.' },
  { id:'quill',   n:'서기의 깃펜',   spr:'scroll', k:'quill',   v:0.25,
    t:'미확인 물건을 주우면 바로 판별된다. 금화 획득 −25%. 뱃사공의 동전을 세기 좋은 펜이다.' },
  { id:'grudge',  n:'앙심',          spr:'amulet', k:'grudge',  v:0.04,
    t:'맞을 때마다 피해 +4% 누적(층마다 초기화, 최대 +60%).' },
  { id:'seed',    n:'돌씨',          spr:'armor',  k:'seed',    v:1,
    t:'층을 내려갈 때 방어 +1 영구. 최대 체력 −15%.' },
  { id:'wick',    n:'짧은 심지',     spr:'potion', k:'wick',    v:6,
    t:'물약을 마실 때 인접한 적이 타 들어간다. 회복량 −30%.' },
  { id:'drum',    n:'전쟁 북',       spr:'amulet', k:'drum',    v:2,
    t:'맞아도 연격을 4분의 1만 잃는다. 몬스터가 두 칸 더 멀리서 깨어난다. 종과 함께 울리면 행군이 된다.' },

  /* ── 능력치를 손대는 것들 ──────────────────────────────
     Every other relic changes what a number does. These six
     change the number, which is a different kind of decision:
     they are the answer to a roll that came out wrong, and the
     way to push a roll that came out right past what the dice
     could ever have given you.

     Resolved in effStats(), one funnel, so nothing downstream
     has to know an ability score can be rewritten. */
  { id:'grip',    n:'거인의 손아귀', spr:'sword',  k:'grip',    v:20,
    t:'힘이 20이 된다. 민첩은 6으로 떨어진다.' },
  { id:'specs',   n:'현자의 안경',   spr:'scroll', k:'specs',   v:1,
    t:'지능과 지혜 중 높은 쪽이 둘 다가 된다. 최대 체력 −20%.' },
  { id:'acro',    n:'곡예사의 신',   spr:'ring',   k:'acro',    v:6,
    t:'민첩 +6. 힘 −4.' },
  { id:'bull',    n:'황소의 심장',   spr:'amulet', k:'bull',    v:6,
    t:'체질 +6. 매력 −6.' },
  { id:'mask',    n:'웃는 가면',     spr:'amulet', k:'mask',    v:18,
    t:'매력이 18이 된다. 나머지 다섯 능력치가 1씩 내려간다.' },
  { id:'ballast', n:'균형추',        spr:'ring',   k:'ballast', v:1,
    t:'가장 낮은 능력치가 가장 높은 것과 같아진다. 최대 체력 −25%.' },

  /* ── 초월 유물 ──────────────────────────────────────────
     These never drop and never appear in a shop. The only way
     to hold one is to burn a campfire fusing the two relics
     that name each other in their own descriptions — read the
     twelve above again and the six pairs are all there.

     Every one of them takes the two halves' downsides and makes
     them worse, then pays for it. That is the deal: a fused
     relic is not a better relic, it is a more extreme one.   */
  { id:'martyr',  n:'순교자의 맹세', spr:'amulet', k:'martyr',  v:0.40, fused:true,
    t:'최대 체력 −40%. 치명타 확률 +25%p, 배율 ×2.2. 명중 −10%.' },
  { id:'famine',  n:'끝없는 허기',   spr:'sword',  k:'famine',  v:8,    fused:true,
    t:'처치할 때마다 체력 +8. 물약 효과 두 배. 기름을 세 배로 태운다.' },
  { id:'paradox', n:'모순의 룬',     spr:'wand',   k:'paradox', v:0.45, fused:true,
    t:'주문이 공짜가 된다. 주문 피해 −45%. 근접 피해 +20%.' },
  { id:'oracle',  n:'눈먼 예언자',   spr:'scroll', k:'oracle',  v:6,    fused:true,
    t:'층에 들어설 때 지도가 전부 보인다. 함정 피해를 입지 않는다. 최대 마나 −6, 불빛이 2칸 좁다.' },
  { id:'ledger',  n:'회계사의 저울', spr:'gold',   k:'ledger',  v:0.20, fused:true,
    t:'금화를 두 배로 얻고 미확인 물건은 즉시 판별된다. 층을 내려갈 때 금화의 20%를 잃는다.' },
  { id:'march',   n:'울리는 진군',   spr:'amulet', k:'march',   v:4,    fused:true,
    t:'연격 4 이상이면 공격이 한 번 더. 맞아도 연격이 깎이지 않는다. 몬스터가 세 칸 더 멀리서 깨어난다.' },
];

export const relicById = id => RELICS.find(r => r.id === id);

/* ── fusion ───────────────────────────────────────────────
   Two relics into the fire. Most pairs roll on a table; six
   pairs do not roll at all, because those two things were
   written to point at each other. Nothing in the game says
   which six — the descriptions do, and that is the point.

   Order does not matter; `fusionOf` checks both ways.        */
export const FUSIONS = [
  { a:'pact',   b:'reckless', out:'martyr'  },
  { a:'hunger', b:'gut',      out:'famine'  },
  { a:'twin',   b:'vow',      out:'paradox' },
  { a:'eye',    b:'compass',  out:'oracle'  },
  { a:'toll',   b:'quill',    out:'ledger'  },
  { a:'drum',   b:'echo',     out:'march'   },
];

export const fusionOf = (x, y) =>
  FUSIONS.find(f => (f.a === x && f.b === y) || (f.a === y && f.b === x)) || null;

/* What an ordinary pair rolls for. Printed as a bar on the
   screen before the player commits, same as the altar. */
export const FUSE_ODDS = [
  { id:'new',   n:'새 유물', w:52, tone:'P',
    t:'가지고 있지 않은 유물 하나가 나온다.' },
  { id:'tune',  n:'정련',   w:34, tone:'y',
    t:'둘 중 하나가 강해져 돌아온다. 자리는 하나만 쓴다.' },
  { id:'slag',  n:'잿더미', w:14, tone:'g',
    t:'둘 다 녹아버리고 재료만 남는다.' },
];
export const FUSE_COST = { dust: 3, gold: 180 };

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

/* ── ability rolls ────────────────────────────────────────
   4d6-drop-lowest gave a spread of 3–18 on every ability, so
   two heroes of the same race and class could differ by forty
   points of total and the "다시 굴리기" button was really a
   slot machine you were expected to spin until it paid.

   Instead each class states what it *needs* and the roll happens
   inside a band. A warrior's 힘 lands between 13 and 17 every
   time; his 지혜 lands between 6 and 10. The character you get is
   the character you chose, and the dice only decide the last two
   or three points.

   Race modifiers apply on top, so a 드워프 전사 and a 엘프 전사
   still differ — by the amount the race is supposed to be worth,
   not by whatever the dice felt like.                          */
export const BANDS = {
  prime: [14, 17],   // the thing the class is
  good:  [11, 14],   // the thing it leans on
  fair:  [10, 13],   // the thing it has
  weak:  [7, 11],    // the thing it does without
};
/* The lower two bands were a point deeper when this landed, and
   measured runs came out three floors shorter than they had any
   business being: the old class modifier only ever took two off
   a dump stat, and the new penalties on a low score — the
   encumbrance, the slow recovery, the long ailments — all bite
   from below. A dumped ability is supposed to be a decision, not
   a sentence. */

export const CLASS_BAND = {
  warrior: { str:'prime', con:'good',  dex:'fair',  chr:'fair', int:'weak',  wis:'weak' },
  mage:    { int:'prime', dex:'good',  wis:'fair',  chr:'fair', con:'weak',  str:'weak' },
  priest:  { wis:'prime', con:'good',  chr:'good',  str:'fair', int:'fair',  dex:'weak' },
  rogue:   { dex:'prime', chr:'good',  int:'good',  str:'fair', con:'fair',  wis:'weak' },
  ranger:  { dex:'prime', con:'good',  str:'good',  int:'fair', wis:'fair',  chr:'weak' },
  paladin: { str:'good',  chr:'prime', wis:'good',  con:'good', dex:'weak',  int:'weak' },
};

/* What a fresh hero of this race and class can come out as, after
   the race modifier. Printed on the creation screen so the player
   can see the shape of the choice before they spend a roll. */
export function statRange(raceKey, classKey, key) {
  const band = BANDS[CLASS_BAND[classKey][key]];
  const mod = (RACES[raceKey].mod[key] || 0);
  return [Math.max(3, band[0] + mod), Math.min(20, band[1] + mod)];
}
