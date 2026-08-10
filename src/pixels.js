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

/* class tint applied to the 'C' channel of the hero sprite */
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

export function bakeAll() {
  for (const [name, grid] of Object.entries(SPRITES)) {
    if (name === 'hero') {
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

function bakeTerrain(kind, variant) {
  const key = `${kind}:${variant}`;
  if (terrainCache.has(key)) return terrainCache.get(key);

  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = c.getContext('2d');
  let rs = variant * 2654435761 % 2147483647;
  const rr = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  if (kind === 'wall') {
    x.fillStyle = PALETTE.g; x.fillRect(0, 0, CELL, CELL);
    x.fillStyle = PALETTE.G;
    for (let i = 0; i < 7; i++) x.fillRect((rr() * 8) | 0, (rr() * 8) | 0, 1, 1);
    x.fillStyle = PALETTE.d;
    x.fillRect(0, (variant % 2 ? 3 : 4), CELL, 1);
    x.fillRect(variant % 2 ? 2 : 5, 0, 1, 4);
    x.fillRect(variant % 2 ? 6 : 1, 4, 1, 4);
  } else {
    x.fillStyle = PALETTE.d; x.fillRect(0, 0, CELL, CELL);
    x.fillStyle = PALETTE.g;
    for (let i = 0; i < 4; i++) x.fillRect((rr() * 8) | 0, (rr() * 8) | 0, 1, 1);
  }
  terrainCache.set(key, c);
  return c;
}

export const wallTile  = (x, y) => bakeTerrain('wall',  1 + ((hash(x, y) * 6) | 0));
export const floorTile = (x, y) => bakeTerrain('floor', 1 + ((hash(x, y) * 6) | 0));
export const CELL_SIZE = CELL;
