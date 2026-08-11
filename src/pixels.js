/* ═══════════════════════════════════════════════════════════
   pixels.js — every graphic in this game is a string in here.
   No image files. Sprites are 8×8 character grids; each char
   indexes PALETTE. Bake once at boot, blit scaled thereafter.
   ═══════════════════════════════════════════════════════════ */

export const PALETTE = {
  '.': null,          // transparent
  k: '#0a0c12',       // void black
  d: '#1b2130',       // dark slate
  g: '#333c52',       // stone
  G: '#59657f',       // lit stone
  w: '#d8d5c8',       // bone
  W: '#f2efe4',       // highlight
  r: '#8f2f28',       // dark red
  R: '#d95a4a',       // red
  o: '#d98a3c',       // ember
  y: '#e8c76a',       // gold
  n: '#5c3f28',       // brown
  N: '#8f6b3f',       // tan
  e: '#357a4c',       // green
  E: '#6fb87a',       // pale green
  b: '#2b5288',       // blue
  B: '#5b9bd5',       // sky
  p: '#6b3f85',       // violet
  P: '#b57ad0',       // orchid
  c: '#3f8f8f',       // teal
  s: '#7d8596',       // steel
};

/* ── the bestiary, drawn ─────────────────────────────────── */
export const SPRITES = {
  /* player — recolored per class at bake time via tint keys */
  hero: [
    '..wwww..',
    '.wWWWWw.',
    '.wkwwkw.',
    '..wwww..',
    '.CCCCCC.',
    'CC.CC.CC',
    '.C.CC.C.',
    '.n....n.',
  ],

  /* vermin */
  rat: [
    '........',
    '........',
    '.n....n.',
    'nNNnnNNn',
    'NNkNNkNN',
    '.NNNNNN.',
    'nn.nn.nn',
    '......nn',
  ],
  bat: [
    '........',
    'g......g',
    'gg.gg.gg',
    '.gggggg.',
    '.gRggRg.',
    '..gggg..',
    '...gg...',
    '........',
  ],
  snake: [
    '........',
    '..EEE...',
    '.Ee.eE..',
    '.EEEEE..',
    '..eEEEe.',
    '.EEe.eEE',
    'Ee....eE',
    '.E......',
  ],
  spider: [
    '........',
    'g.g..g.g',
    '.ggggggg',
    'g.gkkg.g',
    '.gkRRkg.',
    'g.gkkg.g',
    '.ggggggg',
    'g.g..g.g',
  ],
  mold: [
    '........',
    '........',
    '..ee.e..',
    '.eEeeEe.',
    'eEeEEeEe',
    '.eEeeEe.',
    '.eeeeee.',
    '..eeee..',
  ],
  jelly: [
    '........',
    '..pppp..',
    '.pPPPPp.',
    'pPPkkPPp',
    'pPPPPPPp',
    '.pPPPPp.',
    '..pppp..',
    '........',
  ],

  /* humanoids */
  kobold: [
    '..ee.e..',
    '..eEEe..',
    '..ekke..',
    '...ee...',
    '..nNNn..',
    '.nnNNnn.',
    '..n..n..',
    '..n..n..',
  ],
  orc: [
    '..eeee..',
    '.eEEEEe.',
    '.eRwwRe.',
    '..ewwe..',
    '.nnNNnn.',
    'sn.NN.ns',
    '..n..n..',
    '..s..s..',
  ],
  dog: [
    '........',
    'n......n',
    'nNn..nNn',
    '.NNNNNN.',
    'NNyNNyNN',
    '.NNNNNN.',
    'n.n..n.n',
    '.......n',
  ],
  ogre: [
    '.NNNNNN.',
    'NNwwwwNN',
    'NNkNNkNN',
    '.NwwwwN.',
    'nNNNNNNn',
    'nnNNNNnn',
    '.NN..NN.',
    '.nn..nn.',
  ],
  troll: [
    '.eeEEee.',
    'eEEwwEEe',
    'eEkEEkEe',
    '.EEwwEE.',
    'eeEEEEee',
    'eeEEEEee',
    '.EE..EE.',
    '.ee..ee.',
  ],
  giant: [
    'NNNNNNNN',
    'NwwNNwwN',
    'NkwNNwkN',
    'NNwwwwNN',
    'sNNNNNNs',
    'ssNNNNss',
    '.NNNNNN.',
    '.nn..nn.',
  ],

  /* undead & horrors */
  wraith: [
    '..dddd..',
    '.dGGGGd.',
    '.dBddBd.',
    '..dGGd..',
    '.dGdddGd',
    'd.dGGd.d',
    '..d..d..',
    '...d.d..',
  ],
  mummy: [
    '..wwww..',
    '.wgwwgw.',
    '.wkwwkw.',
    '..wwww..',
    '.wgwwgw.',
    'ww.ww.ww',
    '.w.ww.w.',
    '.ww..ww.',
  ],
  vampire: [
    '..kkkk..',
    '.kWWWWk.',
    '.kRkkRk.',
    '..kWWk..',
    'rkkrrkkr',
    'rrkrrkrr',
    '.rr..rr.',
    '.kk..kk.',
  ],
  lich: [
    '..WWWW..',
    '.WkWWkW.',
    '.WkPPkW.',
    '..WWWW..',
    '.pPWWPp.',
    'pP.pp.Pp',
    '.p.pp.p.',
    '.pp..pp.',
  ],

  /* dragons & the deep */
  dragon: [
    '..RR..R.',
    'R.RRR.RR',
    'RRrRRrRR',
    '.RRyyRR.',
    'rRRRRRRr',
    'rrRRRRrr',
    '.rr..rr.',
    'r......r',
  ],
  wyrm: [
    '.BB..B..',
    'B.BBB.BB',
    'BBbBBbBB',
    '.BBWWBB.',
    'bBBBBBBb',
    'bbBBBBbb',
    '.bb..bb.',
    'b......b',
  ],
  balemperor: [
    'r.oRRo.r',
    '.oRWWRo.',
    'oRyRRyRo',
    'oRRooRRo',
    'rRoRRoRr',
    'rrRooRRr',
    '.rR..Rr.',
    'r.o..o.r',
  ],

  /* items */
  potion: [
    '...ww...',
    '...ww...',
    '..wRRw..',
    '.wRRRRw.',
    '.wRRRRw.',
    '.wRRRRw.',
    '.wwwwww.',
    '........',
  ],
  scroll: [
    '........',
    '.wwwwww.',
    'wWWWWWWw',
    'wWkkkkWw',
    'wWkkkkWw',
    'wWWWWWWw',
    '.wwwwww.',
    '........',
  ],
  wand: [
    '........',
    '......Bw',
    '.....Bww',
    '....nn..',
    '...nn...',
    '..nn....',
    '.nn.....',
    'n.......',
  ],
  ring: [
    '........',
    '...yy...',
    '..y..y..',
    '.y.BB.y.',
    '.y.BB.y.',
    '..y..y..',
    '...yy...',
    '........',
  ],
  amulet: [
    '..y..y..',
    '.y....y.',
    'y......y',
    '.y....y.',
    '..yPPy..',
    '..PPPP..',
    '...PP...',
    '........',
  ],
  sword: [
    '......sw',
    '.....sws',
    '....sws.',
    '...sws..',
    '..sws...',
    '.yyy....',
    'ny.y....',
    'n.......',
  ],
  dagger: [
    '.....sw.',
    '....sws.',
    '...sws..',
    '..yyy...',
    '.ny.y...',
    '.n......',
    '........',
    '........',
  ],
  spear: [
    '......sW',
    '.....sss',
    '....ns..',
    '...nn...',
    '..nn....',
    '.nn.....',
    'nn......',
    'n.......',
  ],
  great: [
    '.....sWs',
    '....sWs.',
    '...sWs..',
    '..sWs...',
    '.sWs....',
    'yyyy....',
    'ny..y...',
    'n.......',
  ],
  axe: [
    '....ss..',
    '...ssss.',
    '..sssss.',
    '..nssss.',
    '..nsss..',
    '.n......',
    'n.......',
    '........',
  ],
  mace: [
    '.....ss.',
    '....ssss',
    '....ssss',
    '.....ss.',
    '...nn...',
    '..nn....',
    '.nn.....',
    'n.......',
  ],
  armor: [
    '.s....s.',
    'ssssssss',
    'sGGGGGGs',
    'sGssssGs',
    'sGssssGs',
    '.sGssGs.',
    '..ssss..',
    '..s..s..',
  ],
  shield: [
    '.ssssss.',
    'sGGGGGGs',
    'sGrrrrGs',
    'sGrRRrGs',
    'sGrrrrGs',
    '.sGGGGs.',
    '..ssss..',
    '...ss...',
  ],
  food: [
    '........',
    '..nnnn..',
    '.nNNNNn.',
    'nNNwwNNn',
    'nNNwwNNn',
    '.nNNNNn.',
    '..nnnn..',
    '........',
  ],
  torch: [
    '...o....',
    '..oyo...',
    '..oyo...',
    '...o....',
    '...n....',
    '...n....',
    '...n....',
    '...n....',
  ],
  /* The golden thief. A hunched shape with a sack — it has to
     read as a *creature* at a glance, not as a coin pile, or
     the player will walk into it expecting loot. */
  thief: [
    '..yy....',
    '.yWWy...',
    '.yyyy...',
    '.oyyoy..',
    'yoyyyoy.',
    '.oyyyo..',
    '.y.y....',
    'y...y...',
  ],
  gold: [
    '........',
    '..yyyy..',
    '.yWyyWy.',
    'yyyyyyyy',
    '.yyyyyy.',
    '..yyyy..',
    '...yy...',
    '........',
  ],

  /* terrain features */
  stairsDown: [
    'GGGGGGGG',
    'Gddddddd',
    'GGGGGGdd',
    'Gdddddgd',
    'GGGGdggd',
    'Gddddggd',
    'GGdkkggd',
    'Gdkkkggd',
  ],
  stairsUp: [
    'dGGGGGGG',
    'dggkkkdG',
    'dggkkddG',
    'dggdddGG',
    'dgddddGG',
    'ddddddGG',
    'dddddGGG',
    'GGGGGGGG',
  ],
  door: [
    'gggggggg',
    'gnnnnnng',
    'gnNNNNng',
    'gnNyyNng',
    'gnNyyNng',
    'gnNNNNng',
    'gnnnnnng',
    'gggggggg',
  ],
  rubble: [
    '........',
    '..g..g..',
    '.gGg.gG.',
    'gGGgggGg',
    '.gGGGgg.',
    'gggGGGg.',
    '.ggggg..',
    '........',
  ],

  /* A chest and a mimic share a silhouette on purpose — the
     mimic only gives itself away by breathing (see ui.js). */
  chest: [
    '........',
    '.nnnnnn.',
    'nNNNNNNn',
    'nNyyyyNn',
    'nnnnnnnn',
    'nNNyyNNn',
    'nNNNNNNn',
    '.nnnnnn.',
  ],
  mimic: [
    '.nnnnnn.',
    'nNNNNNNn',
    'nWkWkWWn',
    'nkWkWkWn',
    'nWkWkWWn',
    'nNRRRRNn',
    'nNNNNNNn',
    '.nn.nnn.',
  ],
  /* Shopkeeper — the C channel is tinted per shop, same trick
     the hero uses for classes. Drawn as a torso behind a counter
     because he is standing in a shopfront, not walking about. */
  keeper: [
    '..wwww..',
    '.wWWWWw.',
    '.wkwwkw.',
    '..wwww..',
    '.CCCCCC.',
    'CCCCCCCC',
    'nnnnnnnn',
    'nNNNNNNn',
  ],
  /* A blank plank. The shop's goods sprite is drawn on top, and
     the goods sprites all have transparent margins, so the plank
     reads as a frame around the icon. */
  sign: [
    'n......n',
    'nnnnnnnn',
    'nNNNNNNn',
    'nNNNNNNn',
    'nNNNNNNn',
    'nNNNNNNn',
    'nnnnnnnn',
    '........',
  ],
  /* The ? room. A question mark on a stone marker — the one
     glyph the player will read before they read the prose. */
  event: [
    '..bBBb..',
    '.BB..BB.',
    '.Bb..bB.',
    '....bB..',
    '...bB...',
    '...B....',
    '........',
    '...B....',
  ],
  /* The anvil. A dark block on a stump with a spark coming off
     the horn — it has to read as "hit things here" at 24px. */
  anvil: [
    '........',
    '..W.....',
    '.ssssss.',
    'sssssss.',
    '.ssssss.',
    '...nn...',
    '...nn...',
    '..nnnn..',
  ],
  barrel: [
    '........',
    '.nnnnnn.',
    'nNNNNNNn',
    'nsssssss',
    'nNNNNNNn',
    'nsssssss',
    'nNNNNNNn',
    '.nnnnnn.',
  ],
  brazier: [
    '........',
    '........',
    '..ssss..',
    '.ssssss.',
    '..ssss..',
    '...ss...',
    '..ssss..',
    '.ssssss.',
  ],
  brazierLit: [
    '...o....',
    '..oyo.o.',
    '.oyWyoo.',
    '.ssssss.',
    '..ssss..',
    '...ss...',
    '..ssss..',
    '.ssssss.',
  ],
  pillar: [
    '.GGGGGG.',
    '.GggggG.',
    '..GggG..',
    '..GggG..',
    '..GggG..',
    '..GggG..',
    '.GggggG.',
    'GGGGGGGG',
  ],
  bones: [
    '........',
    '...ww...',
    '..wWWw..',
    '..wkkw..',
    '.wwwwww.',
    'w.w..w.w',
    '.wwwwww.',
    '..w..w..',
  ],
  urn: [
    '...pp...',
    '..pPPp..',
    '.pPPPPp.',
    'pPPkkPPp',
    'pPPPPPPp',
    'pPPPPPPp',
    '.pPPPPp.',
    '..pppp..',
  ],
  altar: [
    '..PPPP..',
    '.PWWWWP.',
    '..PPPP..',
    '...pp...',
    '...pp...',
    '..pppp..',
    '.pPPPPp.',
    'pppppppp',
  ],
  camp: [
    '........',
    '...o....',
    '..oyo...',
    '.oyWyo..',
    '.oyyyo..',
    'nnoyonn.',
    '.nnnnn..',
    '........',
  ],
  campSpent: [
    '........',
    '........',
    '........',
    '..ggg...',
    '.gkkkg..',
    'nngkgnn.',
    '.nnnnn..',
    '........',
  ],
  web: [
    'w..w..w.',
    '.w.w.w..',
    '..www...',
    'ww.w.ww.',
    '..www...',
    '.w.w.w..',
    'w..w..w.',
    '........',
  ],
  water: [
    '........',
    '..bbbb..',
    '.bBbbBb.',
    'bbbbbbbb',
    'bBbbbbBb',
    'bbbbbbbb',
    '.bbbbbb.',
    '........',
  ],
  trap: [
    '........',
    '.R.RR.R.',
    '..RRRR..',
    '.RRkkRR.',
    '.RRkkRR.',
    '..RRRR..',
    '.R.RR.R.',
    '........',
  ],
  doorOpen: [
    'nnnnnnnn',
    'n......n',
    'n......n',
    'n......n',
    'n......n',
    'n......n',
    'n......n',
    'nnnnnnnn',
  ],
  doorLocked: [
    'nnnnnnnn',
    'nNNNNNNn',
    'nNNyyNNn',
    'nNNykNNn',
    'nNNyyNNn',
    'nNNNNNNn',
    'nNNNNNNn',
    'nnnnnnnn',
  ],
  doorBroken: [
    'n.nnnn.n',
    'nn....nn',
    'n......n',
    '.......n',
    'n.......',
    'n......n',
    'nn....nn',
    'n.nn.n.n',
  ],
};

/* ── the hero, in two layers ──────────────────────────────
   One sprite for every hero meant a 하프트롤 마법사 looked
   exactly like a 하플링 전사 in a different colour. Eight races
   and six classes is forty-eight characters, which is far too
   many to draw — so they are composited instead.

   RACE_BODY owns the head and the silhouette: skin, ears, size,
   how much of the 8×8 the figure fills. CLASS_KIT is painted on
   top and owns the headgear and the torso, with '.' left where
   the race has to show through. The face never gets covered,
   because the face is the whole reason to have eight races.

   Baked once per combination at boot: 48 tiny canvases. */
export const RACE_BODY = {
  human: [
    '..wwww..',
    '.wWWWWw.',
    '.wkwwkw.',
    '..wwww..',
    '..CCCC..',
    '.C.CC.C.',
    '..C..C..',
    '..n..n..',
  ],
  // Half-elf: a little of the point, a little of the height.
  halfElf: [
    '..wwww..',
    '.wWWWWw.',
    'wwkwwkww',
    '..wwww..',
    '..CCCC..',
    '.C.CC.C.',
    '..C..C..',
    '..n..n..',
  ],
  // Elf: pale, long ears standing clear of the head.
  elf: [
    '..WWWW..',
    'w.WWWW.w',
    'wWkWWkWw',
    '..WWWW..',
    '..CCCC..',
    '.C.CC.C.',
    '..C..C..',
    '..n..n..',
  ],
  // Halfling: small, low, wide-footed. Sits a row lower.
  halfling: [
    '........',
    '..NNNN..',
    '.NwkkwN.',
    '..NNNN..',
    '..CCCC..',
    '.CCCCCC.',
    '..C..C..',
    '.nn..nn.',
  ],
  // Gnome: big head, small body, a shock of hair.
  gnome: [
    '.NNNNNN.',
    'NNwwwwNN',
    'NwkNNkwN',
    '.NNwwNN.',
    '..CCCC..',
    '.C.CC.C.',
    '..C..C..',
    '..n..n..',
  ],
  // Dwarf: broad, and the beard is most of the face.
  dwarf: [
    '.NNNNNN.',
    'NwwwwwwN',
    'NwkwwkwN',
    '.NNNNNN.',
    '.NCCCCN.',
    'CCCCCCCC',
    '.CC..CC.',
    '.nn..nn.',
  ],
  // Half-orc: green, jawed, tusks up from the lip.
  halfOrc: [
    '..eeee..',
    '.eEEEEe.',
    '.eRwwRe.',
    '.wewwew.',
    '.CCCCCC.',
    'CC.CC.CC',
    '.C.CC.C.',
    '.nn..nn.',
  ],
  // Half-troll: fills the tile. Nothing else does.
  halfTroll: [
    '.EEEEEE.',
    'EEwwwwEE',
    'EEkEEkEE',
    'wEEwwEEw',
    'CCCCCCCC',
    'CC.CC.CC',
    'CC.CC.CC',
    'nn....nn',
  ],
};

/* Painted over the race. '.' means "leave the race showing".
   Each kit owns row 0 (what is on the head) and rows 4–6 (what
   is on the body), and deliberately never touches rows 1–3. */
export const CLASS_KIT = {
  // 전사: a browed helm and shoulder plates.
  warrior: [
    '.ssssss.',
    '........',
    '........',
    '........',
    's.ssss.s',
    'ss.ss.ss',
    '........',
    '........',
  ],
  // 마법사: pointed hat, long robe, staff down the right.
  mage: [
    '...bb..b',
    '..bbb..b',
    '.......b',
    '.......b',
    '..bbb.nb',
    '.bbbbb.b',
    '.bbbbb..',
    '..bbb...',
  ],
  // 사제: a hood and a pale mantle, with a mark at the throat.
  priest: [
    '.WWWWWW.',
    'W......W',
    'W......W',
    '...yy...',
    '.WWWWWW.',
    'WWWWWWWW',
    '.WWWWWW.',
    '..WW.WW.',
  ],
  // 도적: a low dark hood, a wrap, and a knife at the hip.
  rogue: [
    '..dddd..',
    '.d....d.',
    '........',
    '........',
    '.dddddd.',
    'dd.dd.ds',
    '..d..d.s',
    '........',
  ],
  // 레인저: a green hood, a quiver over the shoulder.
  ranger: [
    '..eeee..',
    '.e....eN',
    '.......N',
    '.......y',
    '.eeeee.y',
    'ee.ee.e.',
    '..e..e..',
    '........',
  ],
  // 팔라딘: a crested helm and a gilded breastplate.
  paladin: [
    '...yy...',
    '.yyyyyy.',
    '........',
    '........',
    'y.yyyy.y',
    'yyyWWyyy',
    '.yyyyyy.',
    '..y..y..',
  ],
};

/* class tint applied to any 'C' the class kit leaves showing */
export const CLASS_TINT = {
  warrior: 's', mage:   'b', priest: 'W',
  rogue:   'd', ranger: 'e', paladin:'y',
};

const CELL = 8;
const baked = new Map();

function bakeGrid(grid, tint) {
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = c.getContext('2d');
  for (let row = 0; row < CELL; row++) {
    const line = grid[row] || '';
    for (let col = 0; col < CELL; col++) {
      let ch = line[col] || '.';
      if (ch === 'C') ch = tint || 's';
      const color = PALETTE[ch];
      if (!color) continue;
      x.fillStyle = color;
      x.fillRect(col, row, 1, 1);
    }
  }
  return c;
}

/* One keeper per shop, so the six of them are not identical. */
export const SHOP_TINT = ['e', 's', 'r', 'W', 'P', 'b'];

/* Race under, class over. Any cell the kit leaves as '.' shows
   the body beneath, which is why the face survives the helmet. */
function bakeHero(race, cls) {
  const body = RACE_BODY[race] || RACE_BODY.human;
  const kit = CLASS_KIT[cls] || CLASS_KIT.warrior;
  const merged = [];
  for (let row = 0; row < CELL; row++) {
    let line = '';
    for (let col = 0; col < CELL; col++) {
      const over = (kit[row] || '')[col] || '.';
      line += over !== '.' ? over : ((body[row] || '')[col] || '.');
    }
    merged.push(line);
  }
  return bakeGrid(merged, CLASS_TINT[cls]);
}

export function bakeAll() {
  for (const race of Object.keys(RACE_BODY))
    for (const cls of Object.keys(CLASS_KIT))
      baked.set(`hero:${race}:${cls}`, bakeHero(race, cls));
  for (const [name, grid] of Object.entries(SPRITES)) {
    if (name === 'hero') {
      // Kept as the fallback for anything that asks for a class
      // without naming a race — the ending screen, mostly.
      for (const [cls, tint] of Object.entries(CLASS_TINT))
        baked.set(`hero:${cls}`, bakeGrid(grid, tint));
    } else if (name === 'keeper') {
      SHOP_TINT.forEach((tint, i) => baked.set(`keeper:${i + 1}`, bakeGrid(grid, tint)));
    } else {
      baked.set(name, bakeGrid(grid));
    }
  }
}

export const sprite = name => baked.get(name) || baked.get('rubble');

/* ── particle stock ───────────────────────────────────────
   When something dies we throw its own pixels across the
   floor, so a rat scatters brown and a jelly scatters blue.
   Read the grid, keep the opaque colours, cache the list.   */
const shardCache = new Map();

export function spriteColors(name) {
  // hero:elf:mage and hero:mage both scatter the same palette.
  const key = name.startsWith('hero') ? 'hero' : name;
  if (shardCache.has(key)) return shardCache.get(key);
  const grid = SPRITES[key];
  const out = [];
  if (grid) {
    for (const line of grid)
      for (const ch of line) {
        const c = PALETTE[ch];
        if (c && ch !== 'k') out.push(c);
      }
  }
  if (!out.length) out.push(PALETTE.w);
  shardCache.set(key, out);
  return out;
}

/* ── procedural terrain ───────────────────────────────────
   Floors and walls are generated, not authored: a cheap hash
   per map coordinate picks the speckle pattern so the masonry
   never tiles visibly but stays identical between frames.    */

const hash = (x, y) => {
  let h = (x * 73856093) ^ (y * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const terrainCache = new Map();

/* ── the six faces of the dungeon ─────────────────────────
   Masonry used to be one grey everywhere, so floor 2 and floor
   12 were the same room with different monsters in it. Each
   theme now owns a palette and a way of laying stone, and the
   floor announces where you are before a single word of log
   text does.

   `base`/`grain`/`mortar` are the three colours the generator
   uses; `style` decides how the courses are cut.            */
export const TERRAIN = {
  plain:   { base:'g', grain:'G', mortar:'d', floor:'d', dust:'g',  style:'brick' },
  // 좁은 굴: hacked out rather than built. No courses at all.
  warren:  { base:'n', grain:'N', mortar:'k', floor:'k', dust:'n',  style:'rough' },
  // 큰 방: dressed stone, wide courses, pale.
  hall:    { base:'G', grain:'w', mortar:'g', floor:'g', dust:'G',  style:'ashlar' },
  // 빛이 없는 층: everything one step darker; the grain barely reads.
  dark:    { base:'d', grain:'g', mortar:'k', floor:'k', dust:'d',  style:'brick' },
  // 물에 잠긴 층: wet blue stone, streaked downward.
  flooded: { base:'b', grain:'B', mortar:'k', floor:'d', dust:'b',  style:'streak' },
  // 소굴: chitin and old web over the stone.
  nest:    { base:'p', grain:'P', mortar:'k', floor:'d', dust:'p',  style:'rough' },
};

let terrainTheme = 'plain';
/* Called by the renderer when the floor changes. Cheap: the
   cache is keyed by theme so walking back up is instant. */
export function setTerrainTheme(id) {
  terrainTheme = TERRAIN[id] ? id : 'plain';
}

function bakeTerrain(kind, variant) {
  const theme = terrainTheme;
  const key = `${theme}:${kind}:${variant}`;
  if (terrainCache.has(key)) return terrainCache.get(key);

  const T = TERRAIN[theme] || TERRAIN.plain;
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = c.getContext('2d');
  let rs = (variant * 2654435761 + theme.length * 7919) % 2147483647;
  const rr = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  if (kind === 'wall') {
    x.fillStyle = PALETTE[T.base]; x.fillRect(0, 0, CELL, CELL);
    x.fillStyle = PALETTE[T.grain];
    for (let i = 0; i < 7; i++) x.fillRect((rr() * 8) | 0, (rr() * 8) | 0, 1, 1);
    x.fillStyle = PALETTE[T.mortar];
    if (T.style === 'brick') {
      // Running bond: one course line, staggered head joints.
      x.fillRect(0, (variant % 2 ? 3 : 4), CELL, 1);
      x.fillRect(variant % 2 ? 2 : 5, 0, 1, 4);
      x.fillRect(variant % 2 ? 6 : 1, 4, 1, 4);
    } else if (T.style === 'ashlar') {
      // Big dressed blocks: two courses, joints lined up.
      x.fillRect(0, 3, CELL, 1);
      x.fillRect(0, 7, CELL, 1);
      x.fillRect(variant % 2 ? 3 : 6, 0, 1, 3);
      x.fillRect(variant % 2 ? 6 : 3, 4, 1, 3);
    } else if (T.style === 'streak') {
      // Water has been running down this for a long time.
      for (let i = 0; i < 3; i++) {
        const cx = (rr() * 8) | 0;
        x.fillRect(cx, (rr() * 4) | 0, 1, 3 + ((rr() * 4) | 0));
      }
    } else {
      // rough: no courses, just broken edges and bite marks.
      for (let i = 0; i < 6; i++) x.fillRect((rr() * 8) | 0, (rr() * 8) | 0, 1 + ((rr() * 2) | 0), 1);
    }
  } else {
    x.fillStyle = PALETTE[T.floor]; x.fillRect(0, 0, CELL, CELL);
    x.fillStyle = PALETTE[T.dust];
    for (let i = 0; i < 4; i++) x.fillRect((rr() * 8) | 0, (rr() * 8) | 0, 1, 1);
    // A few floors get a second scatter so the ground is not flat.
    if (T.style === 'rough' || T.style === 'streak') {
      x.fillStyle = PALETTE[T.grain];
      if (rr() < 0.35) x.fillRect((rr() * 8) | 0, (rr() * 8) | 0, 1, 1);
    }
  }
  terrainCache.set(key, c);
  return c;
}

export const wallTile  = (x, y) => bakeTerrain('wall',  1 + ((hash(x, y) * 6) | 0));
export const floorTile = (x, y) => bakeTerrain('floor', 1 + ((hash(x, y) * 6) | 0));
export const CELL_SIZE = CELL;
