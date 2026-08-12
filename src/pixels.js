/* ═══════════════════════════════════════════════════════════
   pixels.js — every graphic in this game is a string in here.
   No image files. Sprites are 16×16 character grids; each char
   indexes PALETTE. Bake once at boot, blit scaled thereafter.

   ── the redesign, and the two rules it turns on ───────────
   The old sheet was 8×8, unoutlined and flat: one colour per
   thing, no light direction, and every humanoid the same four
   pixels of body. Two changes fix nearly all of it, and they
   are the ones the sprite work everybody remembers is built
   from.

   **1. Every material is a four-step ramp.**
   outline → shadow → base → light. Not one colour, and not a
   black line round the outside either: the outline is a *dark
   version of the material's own hue* (`1` for wood, `2` for
   steel, `5` for green, `3` for gold …). That is why a wooden
   haft and an iron head read as two different substances in
   the same 16 pixels, and it is the single biggest difference
   between this sheet and the last one.

   **2. Tools are drawn on the diagonal.**
   A blade laid at 45° gets its full length across the tile and
   gives every pixel of its edge a highlighted side and a shaded
   side. Upright weapons waste half the cell and read as sticks.

   Everything else follows from those: light comes from the
   upper left, so the light step sits on a shape's upper-left
   face and the shadow step on its lower-right; creatures are
   built as head-block over body-block with a rounded crown
   rather than a square one; and free-standing things bottom
   out at row 15 so they stand on the floor instead of floating
   in the middle of the cell.

   Walls are cut against their neighbours (see `wallTile`), so
   a block of rock reads as one mass with a lit top edge and a
   shadow falling onto the floor below it.
   ═══════════════════════════════════════════════════════════ */

/* ── the palette ──────────────────────────────────────────
   Grouped as ramps, one per material. Digits are the outline
   step — they read differently from the letters inside a grid
   string, which makes a sprite legible as source.

   The twenty original letters keep their meaning, because
   data.js names tones by letter (`tone:'R'`) and so do the
   hazard telegraphs; they have only been pulled toward the
   saturation a backlit handheld screen actually had. */
export const PALETTE = {
  '.': null,          // transparent

  /* structural */
  k: '#0a0910',       // true black — pupils, and the void
  q: '#151a26',       // deep shadow

  /* stone & steel */
  2: '#242b3d',       // steel outline
  d: '#333d54',       // steel shadow
  g: '#4a5670',       // stone
  G: '#6b7893',       // lit stone
  s: '#8f99ad',       // steel
  S: '#bcc4d3',       // bright steel
  W: '#f6f3e7',       // highlight

  /* bone */
  9: '#4e4838',       // bone outline
  u: '#8f886f',       // bone shadow
  w: '#d9d5c4',       // bone

  /* wood */
  1: '#2a190e',       // wood outline
  n: '#43301c',       // wood shadow
  N: '#7c5a33',       // wood
  M: '#b08a55',       // lit wood

  /* blood */
  4: '#3f0f16',       // red outline
  r: '#8a2226',       // dark red
  R: '#e0463c',       // red
  x: '#f79a83',       // pale red

  /* ember */
  m: '#5e2c08',       // ember outline
  o: '#c9701c',       // ember
  O: '#f8a938',       // bright ember

  /* gold */
  3: '#6b4410',       // gold outline
  y: '#e8bd45',       // gold
  Y: '#fbe9a4',       // pale gold

  /* green */
  5: '#0f3520',       // green outline
  e: '#2b7a44',       // dark green
  E: '#5fbc6b',       // green
  F: '#a4dd7c',       // pale green

  /* blue */
  6: '#0f2749',       // blue outline
  b: '#22508f',       // dark blue
  B: '#4f9bdc',       // sky
  I: '#a3dcf3',       // ice

  /* violet */
  7: '#281038',       // violet outline
  p: '#5b3080',       // violet
  P: '#b276d2',       // orchid
  V: '#e3bcf4',       // pale violet

  /* teal */
  8: '#0c3a39',       // teal outline
  c: '#2c7d82',       // teal
  t: '#5fcabb',       // pale teal
  T: '#b6f2e4',       // bright teal

  /* skin */
  0: '#5e3116',       // skin outline
  H: '#a5673a',       // skin shadow
  h: '#e9b783',       // skin
  a: '#ffdcb0',       // skin light
};

/* ── the bestiary, drawn ───────────────────────────────────
   Creatures share one skeleton: a rounded crown at row 0, the
   head block down to row 8, shoulders at 9, body to 13, and
   two rows of leg that the walk frame mirrors. Deviating from
   it is how a monster gets a silhouette — the ogre starts at
   row 0 and fills the width, the halfling starts three rows
   down, the wraith has no legs at all. */
export const SPRITES = {
  /* Generic adventurer. The real hero is composited from
     RACE_BODY + CLASS_KIT below; this one survives as the
     fallback for the ending screen and as the shard palette. */
  hero: [
    '.....000000.....',
    '...11nnnnnn11...',
    '..1nNNnnnnnnn1..',
    '..1nNnnnnnnnn1..',
    '..1nnnhhhhnnn1..',
    '..1nnhaaaahnn1..',
    '..0nhWkhhWkhn0..',
    '..0nhhhhhhhhn0..',
    '...0HhhhhhH0....',
    '....00hhhh00....',
    '...2CCCCCCCC2...',
    '.0C0CCCCCCCC0C0.',
    '.0h0CCCCCCDD0h0.',
    '..22CCCCCCDD22..',
    '....1nn11nn1....',
    '....1111.111....',
  ],

  /* ── vermin ─────────────────────────────────────────── */
  rat: {
    down: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....11....11....',
      '...1nn1..1nn1...',
      '..1nNNNnnNNNn1..',
      '..1nNkNNNNkNn1..',
      '..1nNNNNNNNNn1..',
      '...1nNhhhhNn1...',
      '....1n0000n1....',
      '...1nNNMMNNn1...',
      '..1nNMMMMMMNn1..',
      '.1n1.1n11n1.1n1.',
    ],
    side: [
      '................',
      '................',
      '................',
      '................',
      '..........11....',
      '.........1nN1...',
      '....11111nNNn1..',
      '..1nNNNNNNNkN1..',
      '.1nNNMMMNNNNhh1.',
      'n1NNMMMMMNNNN001',
      '.1nNNMMMMNNNn11.',
      '..1nNNNNNNNn1...',
      '...1n1..1n1.....',
      '...1N1..1N1.....',
      '...1n1..1n1.....',
      '...11....11.....',
    ],
    up: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....11....11....',
      '...1nn1..1nn1...',
      '..1nNNNnnNNNn1..',
      '..1nNNNNNNNNn1..',
      '..1nNMMMMMMNn1..',
      '..1nNMMMMMMNn1..',
      '..1nNNMMMMNNn1..',
      '...1nNNNNNNn1...',
      '....1n1nn1n1....',
      '.1n1.1n11n1.1n1.',
    ],
  },
  /* 굶은 들쥐 — the same animal after a bad month. Greyer,
     one eye gone red, and the ribs showing through. */
  lean: {
    down: [
      '................',
      '................',
      '................',
      '................',
      '...11......11...',
      '..2dd2....2dd2..',
      '..2dgd2..2dgd2..',
      '..2dggd22dggd2..',
      '.2dggggggggggd2.',
      '.2dgkggggggkgd2.',
      '.2dggggggggggd2.',
      '..2dgghhhhggd2..',
      '...2d000000d2...',
      '..2dgGGGGGGgd2..',
      '.2dggGGGGGGggd2.',
      '2d2..2d22d2..2d2',
    ],
    side: [
      '................',
      '................',
      '...........11...',
      '..........2dg2..',
      '.......2222dgg2.',
      '....2222ggggkg2.',
      '..2dgggGGgggghh2',
      '.2dggGG2GGggg002',
      'd2dggG22Gggg22..',
      '.2ddgg22ggd2....',
      '..2ddggggd2.....',
      '...2d2..2d2.....',
      '...2g2..2g2.....',
      '...2d2..2d2.....',
      '...2g2..2g2.....',
      '...22....22.....',
    ],
    up: [
      '................',
      '................',
      '................',
      '................',
      '...11......11...',
      '..2dd2....2dd2..',
      '..2dgd2..2dgd2..',
      '..2dggd22dggd2..',
      '.2dggggggggggd2.',
      '.2dggGGGGGGggd2.',
      '.2dgGGGGGGGGgd2.',
      '.2dgGGGGGGGGgd2.',
      '..2dgGGGGGGgd2..',
      '...2dggggggd2...',
      '....2d2dd2d2....',
      '2d2..2d22d2..2d2',
    ],
  },
  bat: {
    down: [
      '................',
      '................',
      '...7......7.....',
      '..7p7....7p7....',
      '.7pP7.11.7Pp7...',
      '7pPP71nn17PPp7..',
      '7pPPP1kNk1PPPp7.',
      '7pPPP1NhN1PPPp7.',
      '.7pPP1wnw1PPp7..',
      '..7pP71n17Pp7...',
      '...7p71N17p7....',
      '....771nn177....',
      '.....1nNNn1.....',
      '.....1nNNn1.....',
      '......1nn1......',
      '.......11.......',
    ],
    side: [
      '................',
      '................',
      '.......7........',
      '......7p7.......',
      '.....7pP7..11...',
      '....7pPP71nNn1..',
      '...7pPPP71NkN1..',
      '...7pPPP71NNh1..',
      '...7pPPP71wnw1..',
      '....7pPP71nN1...',
      '.....7pP71n1....',
      '......7p71N1....',
      '.......771n1....',
      '........1nNn1...',
      '........1nnn1...',
      '.........111....',
    ],
    up: [
      '................',
      '................',
      '...7......7.....',
      '..7p7....7p7....',
      '.7pP7.11.7Pp7...',
      '7pPP71nn17PPp7..',
      '7pPPP1nNn1PPPp7.',
      '7pPPP1NNN1PPPp7.',
      '.7pPP1NNN1PPp7..',
      '..7pP71N17Pp7...',
      '...7p71N17p7....',
      '....771nn177....',
      '.....1nNNn1.....',
      '.....1nNNn1.....',
      '......1nn1......',
      '.......11.......',
    ],
  },
  /* Reared over its own coil — a snake that is only a coil
     reads as rope, and one that is only a head reads as a
     lizard. */
  snake: {
    down: [
      '................',
      '.....999999.....',
      '....9wWWWWw9....',
      '....9WkWWkW9....',
      '....9wWWWWw9....',
      '....99wwww99....',
      '..99wwWWWWww99..',
      '.9wWWWWWWWWWWw9.',
      '.9wuuuuuuuuuuw9.',
      '.9wWWWWWWWWWWw9.',
      '.9wuuuuuuuuuuw9.',
      '.9wWWWWWWWWWWw9.',
      '.9wuuuuuuuuuuw9.',
      '.9wWWWWWWWWWWw9.',
      '.99wuuuuuuuuw99.',
      '...9999999999...',
    ],
    side: [
      '................',
      '.........999....',
      '........9wWW9...',
      '........9WkW9...',
      '.........9ww9...',
      '.......99wWw9...',
      '.....99wWWW9....',
      '...99wWWWu9.....',
      '..9wWWWuu9......',
      '..9wuuu99.......',
      '..99www999......',
      '...9wWWWWw99....',
      '...9wuuuuuuw9...',
      '..9wWWWWWWWWw9..',
      '..9wuuuuuuuuuw9.',
      '..999999999999..',
    ],
    up: [
      '................',
      '.....999999.....',
      '....9wuuuuw9....',
      '....9uuuuuu9....',
      '....9wuuuuw9....',
      '....99wwww99....',
      '..99wwWWWWww99..',
      '.9wWWWWWWWWWWw9.',
      '.9wuuuuuuuuuuw9.',
      '.9wWWWWWWWWWWw9.',
      '.9wuuuuuuuuuuw9.',
      '.9wWWWWWWWWWWw9.',
      '.9wuuuuuuuuuuw9.',
      '.9wWWWWWWWWWWw9.',
      '.99wuuuuuuuuw99.',
      '...9999999999...',
    ],
  },
  /* The legs are steel: eight dark legs on a dark outline in
     front of dark masonry is one dark smudge. */
  spider: {
    down: [
      '................',
      '7......77......7',
      '.7....7pp7....7.',
      '..7..7p77p7..7..',
      '7..7.7p77p7.7..7',
      '.7..7p7777p7..7.',
      '..7.7p7..7p7.7..',
      '...77pPPPPp77...',
      '..7pPVkVVkVPp7..',
      '..7pPPPPPPPPp7..',
      '...7pPPPPPPp7...',
      '..7pPPPPPPPPp7..',
      '.7pPPVVPPVVPPp7.',
      '.7pPPPPPPPPPPp7.',
      '..7pPPPPPPPPp7..',
      '...77pp77pp77...',
    ],
    side: [
      '................',
      '7..............7',
      '.7............7.',
      '..7..7....7..7..',
      '7..7..7..7..7..7',
      '.7..77p77p77..7.',
      '..7.7pPPPPp7.7..',
      '...77pPVVPp77...',
      '...7pPVkkVPp7...',
      '...7pPPPPPPp7...',
      '....7pPPPPp7....',
      '...7pPPVVPPp7...',
      '..7pPPPPPPPPp7..',
      '..7pPPPPPPPPp7..',
      '...7pPPPPPPp7...',
      '....77pppp77....',
    ],
    up: [
      '................',
      '7......77......7',
      '.7....7pp7....7.',
      '..7..7p77p7..7..',
      '7..7.7p77p7.7..7',
      '.7..7p7777p7..7.',
      '..7.7p7..7p7.7..',
      '...77pPPPPp77...',
      '..7pPPPPPPPPp7..',
      '..7pPPPPPPPPp7..',
      '...7pPPPPPPp7...',
      '..7pPPPPPPPPp7..',
      '.7pPPVVPPVVPPp7.',
      '.7pPPPPPPPPPPp7.',
      '..7pPPPPPPPPp7..',
      '...77pp77pp77...',
    ],
  },
  mold: [
    '................',
    '................',
    '................',
    '......9999......',
    '.....9uwwu9.....',
    '..99.9uuuu9.99..',
    '.9uw999uu999wu9.',
    '9uwWuwwwwwwuWwu9',
    '9uwwuuwwwwuuwwu9',
    '9uuwwuuuuuuwwuu9',
    '99uuwuuwwuuwuu99',
    '.99uuwwuuwwuu99.',
    '..9uuuuuuuuuu9..',
    '..99uuu99uuu99..',
    '...9999999999...',
    '.....999999.....',
  ],
  jelly: [
    '................',
    '................',
    '......6666......',
    '....66bBBb66....',
    '...6bBBIIBBb6...',
    '..6bBIIIIIIBb6..',
    '..6bBIIIIIIBb6..',
    '.6bBIIbbbbIIBb6.',
    '.6bBIIbbbbIIBb6.',
    '.6bBIIIIIIIIBb6.',
    '.6bBBIIIIIIBBb6.',
    '.6bbBBIIIIBBbb6.',
    '.6bbbBBBBBBbbb6.',
    '..6bbbbBBbbbb6..',
    '..66bbbbbbbb66..',
    '....66666666....',
  ],

  /* ── humanoids ──────────────────────────────────────── */
  kobold: {
    down: [
      '................',
      '................',
      '........55......',
      '........5.......',
      '.......ee5......',
      '......eFF5......',
      '....e5EFFE5e....',
      '....1WkEEkW1....',
      '.....1E55E1.....',
      '.....555555.....',
      '....eeeeeeee....',
      '...5EEEFFEEE5...',
      '...51nNNMNNn5...',
      '...nMnn111NM1...',
      '....Nn1551n1n...',
      '.....e5555e.....',
    ],
    side: [
      '................',
      '................',
      '.....5555.......',
      '.....5.55.......',
      '.....5.5ee......',
      '....555EFFe.....',
      '....5eeEFFe5....',
      '....1EEEEWk1....',
      '.....1EEEE1e....',
      '....55555555e...',
      '...eEFEEeEEe5...',
      '..5eEeeEFEEE5...',
      '...5EEnnNNNMN1..',
      '....1nNMNNNMN1..',
      '...11nNM11nn1...',
      '...1.e555555e...',
    ],
    up: [
      '................',
      '................',
      '.......55.......',
      '......55ee......',
      '......55E5......',
      '....eeeEEE5e....',
      '....55EFFE55....',
      '....1NNNNNN1....',
      '.....1NNNN1.....',
      '....e555555e....',
      '...5EEFFFFEE5...',
      '...51nnMMNn11...',
      '...5nNnnnNNN1...',
      '...NMMn1e1NNN...',
      '....nn1551nn....',
      '.....e5555e.....',
    ],
  },
  orc: {
    down: [
      '................',
      '......5555......',
      '.....5eFFe5.....',
      '.....5EEEE5.....',
      '.....5EEEE5.....',
      '.....5EEEE5.....',
      '.....1WkkW1.....',
      '.....1E55E1.....',
      '...22s1EE1s22...',
      '..5FENNMMNNEF5..',
      '..5E51NMMN15E5..',
      '..5EenNNNNneE5..',
      '...e1nnnnnn1e...',
      '....1N1111N1....',
      '....5n1..1n5....',
      '...555e..e555...',
    ],
    side: [
      '................',
      '....5555555.....',
      '....555EFFE5....',
      '.....5eEFFF5....',
      '.....5eEEEE5....',
      '.....5eFEEe5....',
      '....1EEEEWk1....',
      '....1EEEEEEe....',
      '..22s1EEEE1.....',
      '..5FE1nNMMMM11..',
      '..5EEEnNNMMN15..',
      '..55FEnnNNNNn5..',
      '....5nnNnNNN1...',
      '....1nnNnnNN1...',
      '...11nnN11nEee..',
      '....155555555e..',
    ],
    up: [
      '................',
      '......5555......',
      '.....5EFFE5.....',
      '.....5EFFE5.....',
      '.....5FFFF5.....',
      '.....5EFFE5.....',
      '.....1NNNN1.....',
      '.....1NNNN1.....',
      '...22s1NN1s22...',
      '..5EeMMMMNneE5..',
      '..5E5nNMMNn5E5..',
      '..eE1nNMMnn1Ee..',
      '...ennn11nnne...',
      '....1Nn11nN1....',
      '...5en1..1ne5...',
      '....e55..55e....',
    ],
  },
  dog: {
    down: [
      '................',
      '................',
      '................',
      '...11......11...',
      '..1nn1....1nn1..',
      '..1nNn1..1nNn1..',
      '.1nNNNn11nNNNn1.',
      '.1nNNNNNNNNNNn1.',
      '.1nNMkNNNNkMNn1.',
      '.1nNMNNNNNNMNn1.',
      '..1nNMhhhhMNn1..',
      '...1nM0000Mn1...',
      '...1nwwwwwwn1...',
      '..1nNMMMMMMNn1..',
      '.1nNMMMMMMMMNn1.',
      '1n1..1n11n1..1n1',
    ],
    side: [
      '................',
      '...........11...',
      '..........1nN1..',
      '.........1nNNn1.',
      '....11111nNNMn1.',
      '..1nNNNNNNNMkN1.',
      '.1nNMMMMNNNNMww1',
      'n1NNMMMMMNNNN001',
      '.1nNNMMMMMNNn11.',
      '..1nNNMMMMNNn1..',
      '...1nNNNNNNn1...',
      '...1n1...1n1....',
      '...1N1...1N1....',
      '...1n1...1n1....',
      '...1N1...1N1....',
      '...11.....11....',
    ],
    up: [
      '................',
      '................',
      '................',
      '...11......11...',
      '..1nn1....1nn1..',
      '..1nNn1..1nNn1..',
      '.1nNNNn11nNNNn1.',
      '.1nNNNNNNNNNNn1.',
      '.1nNNNNNNNNNNn1.',
      '.1nNMMMMMMMMNn1.',
      '.1nNMMMMMMMMNn1.',
      '.1nNMMMMMMMMNn1.',
      '..1nNMMMMMMNn1..',
      '..1nNNNNNNNNn1..',
      '...1n1nnnn1n1...',
      '1n1..1n11n1..1n1',
    ],
  },
  ogre: {
    down: [
      '................',
      '......n11n......',
      '......1NN1......',
      '....n1NNNN1n....',
      '....11NMMM11....',
      '....11NMMN11....',
      '....1WkNNkW1....',
      '....1NN11NN1....',
      '.....1NNNN1.....',
      '.1Nn1nMNNMn1nN1.',
      '.1Nnu9Nnnn9unN1.',
      '.11nwwwWWwwun11.',
      '...9wwu99uww9...',
      '...9Ww9..9wW9...',
      '...1N99..99N1...',
      '...11n....n11...',
    ],
    side: [
      '................',
      '......n11n......',
      '....n1NNNNn.....',
      '....11nNMM1.....',
      '.....1nNMM1.....',
      '.....1nnMNNn....',
      '....1NNNWk1.....',
      '....1NNNNNn.....',
      '.....1NNN1......',
      '.1nMNMnnNNNnn1..',
      '.1nMNn1NNNNn111.',
      '..11NN1uuuwwu1..',
      '....9uwWuuWW9...',
      '...99uwWuuww9...',
      '...99uu1991111..',
      '....111111......',
    ],
    up: [
      '................',
      '......n11n......',
      '......1MM1......',
      '......1MM1......',
      '....n1MMMM1n....',
      '....11NMMN11....',
      '....1NNNNNN1....',
      '....1NNNNNN1....',
      '.....1NNNN1.....',
      '.1Nn1NNNNNN1nN1.',
      '.1Nn99MnnM99nN1.',
      '.11NuwwWWwwuN11.',
      '...9wwu99uww9...',
      '...9Ww9..9wW9...',
      '...1N99..99N1...',
      '...111....111...',
    ],
  },
  troll: {
    down: [
      '................',
      '......e55e......',
      '......5EE5......',
      '....e5EEEE5e....',
      '....55FFFF55....',
      '....55EFFE55....',
      '....5WkEEkW5....',
      '....5EE55EE5....',
      '.....5EEEE5.....',
      '.5Ee5eEEEEe5eE5.',
      '.5Een1eeee1neE5.',
      '.55enNNMMNNne55.',
      '...1NNn11nNN1...',
      '...1MN1..1NM1...',
      '...5E11..11E5...',
      '...e5e....e5e...',
    ],
    side: [
      '................',
      '......e55e......',
      '....e5EFEEe.....',
      '....55eFFF5.....',
      '.....5eEFF5.....',
      '.....5eeFFEe....',
      '....5EEEWk5.....',
      '....5EEEEEe.....',
      '.....5EEE5......',
      '.5eEEFeeEEEee5..',
      '.5eFEe5EEEe5555.',
      '..55FE5nnnNMN5..',
      '....1nNNnnNM1...',
      '...11nNMnnNn1...',
      '...11nn511555e..',
      '....555555......',
    ],
    up: [
      '................',
      '......e55e......',
      '......5FF5......',
      '......5FF5......',
      '....e5FFFF5e....',
      '....55FFFF55....',
      '....5EEEEEE5....',
      '....5EEEEEE5....',
      '.....5EEEE5.....',
      '.5Ee5EEEEEE5eE5.',
      '.5Ee11EeeE11eE5.',
      '.55EnNNMMNNnE55.',
      '...1NNn11nNN1...',
      '...1Mn1..1nM1...',
      '...5E11..11E5...',
      '...555....555...',
    ],
  },
  giant: {
    down: [
      '................',
      '.....111111.....',
      '....1nNMMMn1....',
      '....1NNMMMN1....',
      '....1nNNMMn1....',
      '.....11111n1....',
      '....1WkhhkW1....',
      'w99991h00h1999w.',
      '999haaahaaah999.',
      '0hhHHaahaaHHhh0.',
      '0hHHHHhhhhHHHh0.',
      '0hHnnNNNNNnnHh0.',
      '.00NNNn1nNNN00..',
      '..1MNN1.1NNM1...',
      '..0nnn1.1nnn0...',
      '..H00H...H00H...',
    ],
    side: [
      '................',
      '......11111.....',
      '.....1nMMMN1....',
      '....1nnMMMN1....',
      '....1nnNNNn1....',
      '....11111111....',
      '....1hhhhWk1....',
      '..9991hhhh1H....',
      '.0huuu900000000.',
      '.0hhhhhaaahha00.',
      '.0hhhH0HhhHH000.',
      '.00hhH0nNNNMN0..',
      '...0nnNNNNNM1...',
      '...1nNNNNNNN1...',
      '...1nNNNnnnhHH..',
      '...n000000000H..',
    ],
    up: [
      '................',
      '......1111......',
      '....11MMMN1.....',
      '....1nMMMN11....',
      '....1nNMMn11....',
      '....11nMMn11....',
      '....1NNNNNN1....',
      'w99991NNNN1999w.',
      '999HhhaaahhH999.',
      '0aHHHhhhhhHHHa0.',
      '0hHnnahhhannHh0.',
      '0HhnNNNNNNNnhH0.',
      '.0nNNNNNNNNNn0..',
      '..1MNN1.1NNM1...',
      '..0nNnn.nnNn0...',
      '..0000...0000...',
    ],
  },

  /* ── undead & horrors ───────────────────────────────── */
  wraith: {
    down: [
      '................',
      '................',
      '......p77P......',
      '.....PPPPPp.....',
      '.....7pppppp....',
      '....PPp77777....',
      '....777..777....',
      '....7WkPPkW7....',
      '....7PP77PP7....',
      '.....7PPPP7.....',
      '..7ppPPPPPPpp7..',
      '..P77pVVVVp77P..',
      '.....777777.....',
      '....V......V....',
      '...VV......VV...',
      '....V......V....',
    ],
    side: [
      '................',
      '......777P......',
      '.....7pppPP.....',
      '....77pPPPPP....',
      '....77pPP777....',
      '....77pp7.77....',
      '....7PPPPWk7....',
      '....7PPPPPPp....',
      '.....7PPPP7.....',
      '..7PPPPPPPP7....',
      '..7PPPPPPVV7....',
      '..77777pPV77....',
      '.......p7p......',
      '...VV...........',
      '...VVV..........',
      '....VV..........',
    ],
    up: [
      '................',
      '......p77p......',
      '.....ppPPpp.....',
      '.....ppppppp....',
      '....77pppp77....',
      '....777pp777....',
      '....7PPPPPP7....',
      '....7PPPPPP7....',
      '.....7PPPP7.....',
      '..777ppPPpp777..',
      '..p777pppp777p..',
      '....7VPPPPP7....',
      '....7VVVVVP7....',
      '...PVVVVVVPPP...',
      '...PVVVPPVVPP...',
      '....P777777P....',
    ],
  },
  mummy: {
    down: [
      '................',
      '.....999999.....',
      '.....9wwwu9.....',
      '.....9wwww9.....',
      '....9uwwwwu9....',
      '....9uwwuuu9....',
      '....9WkwwkW9....',
      '....9ww99ww9....',
      '.....9wwww9.....',
      '..9wwWWWWWWww9..',
      '..9uuuWWWWuuu9..',
      '..9uuwWWWWwww9..',
      '..99wWWwwWWw9u..',
      '....9Ww99wW9....',
      '...99w9..9w99...',
      '...u999..999u...',
    ],
    side: [
      '................',
      '.....999999.....',
      '....9uwwwu99....',
      '....9wwwwwu9....',
      '....9wwwwwu9....',
      '....9uwwwww9....',
      '....9wwwwWk9....',
      '....9wwwwwwu....',
      '.....9wwww9.....',
      '..9WWWWWWWWWw9..',
      '..9WwuwWWWWWu9..',
      '..9uuu9wWWWuu9..',
      '...9uuuwWWWW9...',
      '....9wwWwwwW9...',
      '...uuwwwuuuwuu..',
      '....u999999999..',
    ],
    up: [
      '................',
      '.....999999.....',
      '.....9wwuu9.....',
      '....9uwwwuu9....',
      '....9wWwwuu9....',
      '....9wwwuuu9....',
      '....9wwwwww9....',
      '....9wwwwww9....',
      '.....9wwww9.....',
      '..uwWWWWWWWWwu..',
      '..9uuuWWWWuuu9..',
      '..9uuwWWWWwuu9..',
      '..99wwWwwWww99..',
      '....9Ww99wW9....',
      '...99wu..uw99...',
      '...99w....w99...',
    ],
  },
  vampire: {
    down: [
      '................',
      '.....999999.....',
      '.....9wWww9.....',
      '.....9WWWW9.....',
      '....9wwwwww9....',
      '....9wwwwww9....',
      '....4WkwwkW4....',
      '....4ww99ww4....',
      '..d224wwww422d..',
      '..2sssSSSSsss2..',
      '..2sssSSSSsss2..',
      '..2w9dddddd9w2..',
      '..9u2d222dd2u9..',
      '...4dd2222dd4...',
      '...4222..2224...',
      '...9999..9999...',
    ],
    side: [
      '................',
      '.....999999.....',
      '....9uwwWwu9....',
      '....9wWWWWw9....',
      '....9wWwwWw9....',
      '....9wwwwWw9....',
      '....4wwwwWk4....',
      '....4wwwwwwu....',
      '..d224wwww4sd...',
      '..2SSssSssssdd..',
      '..2SsssSSsssd9..',
      '..2ssussddsdd9..',
      '..4ruu22dddd2...',
      '..rR222222dd2...',
      '...222dd222uu9..',
      '....2999999999..',
    ],
    up: [
      '................',
      '.....999999.....',
      '.....9wwww9.....',
      '....9uWWwwu9....',
      '....9wWWwWw9....',
      '....9uWwwwu9....',
      '....4RRRRRR4....',
      '.....4RRRR4.....',
      '...sdSsssssss...',
      '..sssSSsssssss..',
      '..2sssSSSSsss2..',
      '..2dddddddddd2..',
      '..9u2dd22dd2u9..',
      '...4dd2222dd4...',
      '...4222xx2224...',
      '...9444444449...',
    ],
  },
  lich: {
    down: [
      '................',
      '......c88t......',
      '......8TTTc.....',
      '.....ttttccc....',
      '....tttt8888....',
      '....8ccWWc88....',
      '....8WkwwkW8....',
      '....8ww99ww8....',
      '.....8wwww8.....',
      '..8ttTttttTtt8..',
      '..8t8cTTTTc8t8..',
      '..8cu8tTTt8uc8..',
      '..uuuw9999wuuu..',
      '...8t9....9t8...',
      '...8c99..99c8...',
      '...9899..9989...',
    ],
    side: [
      '................',
      '......888t......',
      '.....8ctttt.....',
      '....8ccTtttt....',
      '....8ccTt888....',
      '....8ccttWc8....',
      '....8wwwwWk8....',
      '....8wwwwwwu....',
      '.....8wwww8.....',
      '..8cTTttttt8....',
      '..8tTcttTTTc9...',
      '..88ccctTTtc9...',
      '....9uwW9uu9....',
      '...tt9ww9w9.....',
      '...c8cWuuW99u...',
      '.....u99999u....',
    ],
    up: [
      '................',
      '......c88t......',
      '.....tTTTTc.....',
      '.....8TTTtcc....',
      '....8tttTcc8....',
      '....8ccttcc8....',
      '....8tttttt8....',
      '....8tttttt8....',
      '.....8tttt8.....',
      '..8tTTttttTTt8..',
      '..888cTTTTc888..',
      '..88cccttcc888..',
      '..uwtTTttcc88u..',
      '...8tttttccc8...',
      '...8cttccccc8...',
      '...9888888889...',
    ],
  },

  /* ── dragons & the deep ─────────────────────────────── */
  dragon: {
    down: [
      '................................',
      '............w944449w............',
      '...........9WW4rr4WW9...........',
      '...........9WwRxxRwW9...........',
      '...........9wuxxxRuw9...........',
      '...........9u9xxxx9u9...........',
      '..........OwurxxxRruwO..........',
      '.........mOu9rRxxRr9uOm.........',
      '.........mO99rRRRRr99Om.........',
      '.........mO9uRRRRRRu9Om.........',
      '.........mOow1WkkW1woOm.........',
      '........mOOou1R44R1uoOOm........',
      '........mOooo1RRRR1oooOm........',
      '........mOooo1RRRR1oooOm........',
      '........mOooo1RRRR1oooOm........',
      '....mmmmOOooom1RR1moooOOmmmm....',
      '....mYYmooooooxrrxoooooomYYm....',
      '....mYYOoooommxRRxmmooooOYYm....',
      '....mYYOmoomRxxRRxxRmoomOYYm....',
      '....mYYOmmm4rRRRRRRr4mmmOYYm....',
      '....mOYYoo44rRRRRRRr44ooYYOm....',
      '....mOYYOor4rRRRRRRr4roOYYOm....',
      '....mOYOOom4rrrRRRrr4moOOYOm....',
      '.....mYOmm4rrrrRRrRrr4mmOYm.....',
      '.....oOO444RRrr44rrRR444OOo.....',
      '......om..4RRr4..4rRR4..mo......',
      '.......m..4rr44..44rr4..m.......',
      '..........4rr4....4rr4..........',
      '..........4RR4....4RR4..........',
      '.........4Rxx4....4xxR4.........',
      '.........4xxx4....4xxx4.........',
      '.........4444r....r4444.........',
    ],
    side: [
      '................................',
      '.............9994444............',
      '............uuwwxxRr4...........',
      '............9wWW9RRRr4..........',
      '...........9uWWwrrrRRr4.........',
      '...........9wWu9RRRRRRr4........',
      '...........9ww9xRRRRRRr4........',
      '..........ouWWRxRRRRRRr4........',
      '.........mOuwwRxxRRRrrr4........',
      '.........mY9uWwRxxRRr444........',
      '.........mOOuw1RRRRRRWk1........',
      '........mOOouu1RRRRRRRRr........',
      '........mOOoou1RRRRRRRR1........',
      '........mYOoom1RRRRRRRR1........',
      '........mYOooo1RRRRRRRR1........',
      '....mmmmmYOooom1RRRRRR1.........',
      '....mOYOmooooooooxxxxRRR4.......',
      '....mOYOmoooooommxxxxrRR4.......',
      '....mOYYOoooommRrxxxxrRR4.......',
      '....mOYYOooomxRrrrRxrrr44.......',
      '....mOYYOommxxrrrRRRrrr44.......',
      '....mOYYOOmmxxR4rRRRrrr44.......',
      '....mOYYOOmmRRR44RRRrrr44.......',
      '.....mOYOOmmmRRrrRrrrrr4........',
      '.....mOOOm..4rrrrxR4rrr4........',
      '......oOm....4rxxxR4RR4.........',
      '.......om....4rxxRr4Rr4.........',
      '........m....4rRRrrrRr4.........',
      '.............4rRr44rRRr44.......',
      '............44rRr444Rxx44.......',
      '.............4rRRR4444444.......',
      '..............444444............',
    ],
    up: [
      '................................',
      '............w944449w............',
      '...........9Ww4rr4wW9...........',
      '...........9w9rxRr9w9...........',
      '...........9w9xxxR9w9...........',
      '...........9W9xxxR9W9...........',
      '..........muuRxxxxruum..........',
      '..........m9uRxxxRru9m..........',
      '.........moouRRxxRruoom.........',
      '.........moourRxxRruoom.........',
      '.........moo.1NNNN1.oom.........',
      '........mooom1NNNN1mooom........',
      '........mOoOm1NNNN1mOoOm........',
      '........mOoOo1NNNN1oOoOm........',
      '........mOoYo1NNNN1oYoOm........',
      '....mmmmoOoYOm1NN1mOYoOommmm....',
      '....mOOmOYYYYYRRRRYYYYYOmOOm....',
      '....mOOmOYYYOORRRROOYYYOmOOm....',
      '....mOYooOOoRRRRRRRRoOOooYOm....',
      '....mOYOoOOmrRRRRRRrmOOoOYOm....',
      '....mOYOooOmRRRrrRRRmOooOYOm....',
      '....mOYYooomxxxrrxxxmoooYYOm....',
      '....mOYYOoomRxxrrxxRmooOYYOm....',
      '.....mYOmmmrrrrxxrrrrmmmOYm.....',
      '.....mOm..4rrrrRRrrrr4..mOm.....',
      '.....mom..4rrrrRRrrrr4..mom.....',
      '......om..4rrrrrRrrrr4..mo......',
      '.......m.44rrr4rrrrrr44.m.......',
      '.........4rRR44rr44RRr4.........',
      '.........4rrr44r444rrr4.........',
      '..........rr44444.44rr..........',
      '...........44444...44...........',
    ],
  },
  wyrm: {
    down: [
      '................................',
      '............w966669w............',
      '...........9WW6bb6WW9...........',
      '...........9WwBIIBwW9...........',
      '...........9wuIIIBuw9...........',
      '...........9u9IIII9u9...........',
      '..........twubIIIBbuwt..........',
      '.........8tu9bbIIbb9ut8.........',
      '.........8t99bbBBbb99t8.........',
      '.........8t9ubbBBbbu9t8.........',
      '.........8tcw1WkkW1wct8.........',
      '........8tccu1B66B1ucct8........',
      '........8tccc1BBBB1ccct8........',
      '........8tccc1BBBB1ccct8........',
      '........8tccc1BBBB1ccct8........',
      '....8888ccccc81BB18ccccc8888....',
      '....8TT8ccccccIbbIcccccc8TT8....',
      '....8TTccccc88IBBI88cccccTT8....',
      '....8TTt8cc8BIIBBIIB8cc8tTT8....',
      '....8TTt8886bBBBBBBb6888tTT8....',
      '....8TTTcc66bBBBBBBb66ccTTT8....',
      '....8tTTtcb6bBBBBBBb6bctTTt8....',
      '....8tTttc86bbBBBBBb68cttTt8....',
      '.....8Tt886bbbbbbbBbb688tT8.....',
      '.....ccc666BBBb66bBBB666ccc.....',
      '......c8..6BBB6..6BBB6..8c......',
      '.......8..6bbb6..6bbb6..8.......',
      '..........6bb6....6bb6..........',
      '..........6BB6....6BB6..........',
      '.........6BII6....6IIB6.........',
      '.........6III6....6III6.........',
      '.........6666b....b6666.........',
    ],
    side: [
      '................................',
      '.............9996666............',
      '............uuwwIIBb6...........',
      '............9wWW9BBBb6..........',
      '...........9uWWwbbbBBb6.........',
      '...........9wWu9bbbBBBb6........',
      '...........9ww9IBBbBBBb6........',
      '..........cuWWIIBBBBBB66........',
      '.........8tuwwBIIBBBbb66........',
      '.........8T9uWwBIIBbb666........',
      '.........8tcuw1BBBBBBWk1........',
      '........8ttcuu1BBBBBBBBb........',
      '........8ttccu1BBBBBBBB1........',
      '........8Ttccc1BBBBBBBB1........',
      '........8Ttccc1BBBBBBBB1........',
      '....88888Ttccc81BBBBBB1.........',
      '....8tTt8ccccccccIIIIBBB6.......',
      '....8tTt8cccccc88IIIIBBB6.......',
      '....8tTTtccccc8BbIIIIBBB6.......',
      '....8tTTtccc8BIbbbBIbbb66.......',
      '....8tTTtcccIBbb6BBBbbb66.......',
      '....8tTTtt88IIB66BBBBbb66.......',
      '....8tTTttccBBB66BBBBbb66.......',
      '.....8tTtt888BBbbBbbbbb6........',
      '.....8ttt8..6bbbbBBbbbb6........',
      '......ct8....6bIIBB6BB6.........',
      '.......c8....6bIIBb6Bb6.........',
      '........8....6bBBb66Bb6.........',
      '.............6bBB666BBb66.......',
      '............66BBB666BII66.......',
      '.............6bBBB6666666.......',
      '..............666666............',
    ],
    up: [
      '................................',
      '............w966669w............',
      '...........9Ww6bb6wW9...........',
      '...........9w9bIBb9w9...........',
      '...........9w9IIIB9w9...........',
      '...........9W9IIIB9W9...........',
      '..........8uuBIIIIbuu8..........',
      '..........89uBIIIBbu98..........',
      '.........8ccubBIIBbucc8.........',
      '.........8ccubBIIBbucc8.........',
      '.........8cc.1NNNN1.cc8.........',
      '........8ccc81NNNN18ccc8........',
      '........8tct81NNNN18tct8........',
      '........8tctc1NNNN1ctct8........',
      '........8tcTc1NNNN1cTct8........',
      '....8888ctcTt81NN18tTctc8888....',
      '....8tt8tTTTTTBBBBTTTTTt8tt8....',
      '....8tt8tTTTttBBBBttTTTt8tt8....',
      '....8tTccttcBBBBBBBBcttccTt8....',
      '....8tTtctt8bBBBBBBb8ttctTt8....',
      '....8tTtcct8BBBbbBBB8tcctTt8....',
      '....8tTTccc8IIBbbBII8cccTTt8....',
      '....8tTTtcc8BIIbbIIB8cctTTt8....',
      '.....8tT888bbbbIIbbbb888TT8.....',
      '.....8t8..6bbbbBBbbbb6..8t8.....',
      '.....8c8..6bbbbBBbbbb6..8c8.....',
      '......c8..6bbbbbBbbbb6..8c......',
      '.......8.66bbb6bB6bbb66.8.......',
      '.........6bBB66bb66BBb6.........',
      '.........6BIb66b666bIB6.........',
      '..........bb66666.66bb..........',
      '...........66666...66...........',
    ],
  },

  /* ── the ember floors ───────────────────────────────────
     Everything from ten down is drawn out of the same three
     values — char, ember, steel — so the deep floors read as
     one place rather than as six unrelated monsters. */
  ashhound: {
    down: [
      '................',
      '................',
      '................',
      '...22......22...',
      '..2dd2....2dd2..',
      '..2dgd2..2dgd2..',
      '.2dgggd22dgggd2.',
      '.2dggggggggggd2.',
      '.2dgGOggggOGgd2.',
      '.2dgGggggggGgd2.',
      '..2dgGmmmmGgd2..',
      '...2dOmmmmOd2...',
      '...2dgmmmmgd2...',
      '..2dggGGGGggd2..',
      '.2dgggGGGGgggd2.',
      '2d2..2d22d2..2d2',
    ],
    side: [
      '................',
      '...........22...',
      '..........2dg2..',
      '.........2dggd2.',
      '....22222dggGd2.',
      '..2dggggggggOg2.',
      '.2dgGGGGggggGOO2',
      'd2dgGGGGGgggmmm2',
      '.2dggGGGGGggd22.',
      '..2dggGGGGggd2..',
      '...2dggggggd2...',
      '...2d2...2d2....',
      '...2g2...2g2....',
      '...2d2...2d2....',
      '...2m2...2m2....',
      '...22.....22....',
    ],
    up: [
      '................',
      '................',
      '................',
      '...22......22...',
      '..2dd2....2dd2..',
      '..2dgd2..2dgd2..',
      '.2dgggd22dgggd2.',
      '.2dggggggggggd2.',
      '.2dggggggggggd2.',
      '.2dgGGGGGGGGgd2.',
      '.2dgGmGGGGmGgd2.',
      '.2dgGmGGGGmGgd2.',
      '..2dgGGGGGGgd2..',
      '..2dggggggggd2..',
      '...2d2m22m2d2...',
      '2d2..2d22d2..2d2',
    ],
  },
  warden: {
    down: [
      '................',
      '......o333......',
      '.....YYYYyo.....',
      '....3yYYYyo3....',
      '....3yyYyyo3....',
      '....3yyyyyo3....',
      '....3oyyooo3....',
      '..223oyyooo322..',
      '.222oooyooo3222.',
      '.22dds3333s2d22.',
      '.2sddsssssd2ds2.',
      '.dSSssdddddsSSd.',
      '..s2ssd22ddd2s..',
      '....222..222....',
      '...sS22..22Ss...',
      '...S22s..s22S...',
    ],
    side: [
      '................',
      '......333o......',
      '....33yYYY3o....',
      '....3yyYYYY3....',
      '....3yyyyYY3....',
      '....3yyooyy3....',
      '....3yyoooo3....',
      '.3333oyoooo3333.',
      '.22d333oo333322.',
      '.2dddddssssss22.',
      '.2ddddddddddd2d.',
      '.22SSdddddddds..',
      '...2sddss2ds2...',
      '...22dd22dd22...',
      '...22Ss22sSSSs..',
      '...s222222222s..',
    ],
    up: [
      '................',
      '......o333......',
      '....o3YYYy33....',
      '....3yYYYyo3....',
      '....3Yyyooo3....',
      '....3Yyyooo3....',
      '....3Yyyooo3....',
      '..223oyyooo322..',
      '.22sd3oooo3d222.',
      '.2dddsSSsssdd22.',
      '.2s22sssssd22s2.',
      '.dSSsddddddsSSd.',
      '..sssdd22ddsss..',
      '...2sd2..2dd2...',
      '...2Ss2..2sS2...',
      '...s2S....S2s...',
    ],
  },
  ashen: {
    down: [
      '................',
      '.....222222.....',
      '.....2GGGg2.....',
      '.....2GGGG2.....',
      '....2gGGGGg2....',
      '....2gGGggg2....',
      '....2WkggkW2....',
      '.....2g22g2.....',
      '..9999uuuu9999..',
      '..9uuwWwwWwuu9..',
      '..9uuuWWWWuuu9..',
      '..222uwwwwu222..',
      '..d22dddddd22d..',
      '....2d2222d2....',
      '...22g2..2g22...',
      '...d222..222d...',
    ],
    side: [
      '................',
      '.....222222.....',
      '....2gGGGgd2....',
      '....2GGGGgg2....',
      '....2GGGGGg2....',
      '....2ggGGgg2....',
      '....2ggggWk2....',
      '.....2gggg2d....',
      '..99W9wuuuu99...',
      '..9wWwwWwwwwu9..',
      '..9wu9uwwWWwu9..',
      '..99gg9uuwwudd..',
      '...ddddddddg2...',
      '....2ddd22dd2...',
      '...222dd22dggd..',
      '....2222222222..',
    ],
    up: [
      '................',
      '.....222222.....',
      '.....2GGgg2.....',
      '....2gGGGgd2....',
      '....2GGGGgg2....',
      '....2GGGggg2....',
      '....2gggggg2....',
      '.....2gggg2.....',
      '...u9wuuuuw9u...',
      '..9wwWWWWWWww9..',
      '..9u99wwww99u9..',
      '..2229uuuu9222..',
      '..d22dd22dd22d..',
      '....2d2222d2....',
      '...22d2..2g22...',
      '...d2g....g2d...',
    ],
  },
  emberpriest: {
    down: [
      '................',
      '......r44R......',
      '......4xxxr.....',
      '.....RxRRrr4....',
      '....RRx44444....',
      '....4Rr..444....',
      '....4WkhhkW4....',
      '....4hh00hh4....',
      '..y334hhhh433y..',
      '..33rr44rrrr33..',
      '..4R44RRRR44R4..',
      '..4rrrRRRRrrr4..',
      '..H0rRRRRRRr0H..',
      '....4Rr44rR4....',
      '....4r4..4r4....',
      '...H000..000H...',
    ],
    side: [
      '................',
      '......444R......',
      '.....4rRRRR.....',
      '....44rxxrRR....',
      '....44rxR444....',
      '....44rR4.44....',
      '....4hhhhWk4....',
      '....4hhhhhhH....',
      '....y4hhhh4.....',
      '..4r3orRRrr4....',
      '..4RRrrRxxxr0...',
      '..44ahRRxxx40...',
      '....0HRRRRx4....',
      '....4RRRRRx4....',
      '....4rRRrrahH...',
      '....r000000H....',
    ],
    up: [
      '................',
      '......r44r......',
      '.....xxxxRr.....',
      '.....4xxxRR4....',
      '....4RRRRRR4....',
      '....4rrRRrR4....',
      '....4RRRRRR4....',
      '....4RRRRRR4....',
      '..y334RRRR433y..',
      '..33R44444Rr33..',
      '..4r44rrrr44R4..',
      '..0arrRxxRrra0..',
      '..H0rRRRRRRr0H..',
      '....4xr44rx4....',
      '...0rr4..4rr0...',
      '...00h....h00...',
    ],
  },
  ashheap: [
    '................',
    '................',
    '................',
    '......2222......',
    '.....2dggd2.....',
    '....2dggggd2....',
    '...2dgOmmOgd2...',
    '..2dggmmmmggd2..',
    '..2dggggggggd2..',
    '.2dggmmOOmmggd2.',
    '.2dgggmmmmgggd2.',
    '2dggggggggggggd2',
    '2dggGggggggGggd2',
    '2dggggggggggggd2',
    '22dggggggggggd22',
    '.22222222222222.',
  ],
  balemperor: {
    down: [
      '................',
      '.......yy.......',
      '.......33.......',
      '....yy.33.yy....',
      '....3o3oo3o3....',
      '....3oyYYyo3....',
      '....3WkRRkW3....',
      '....3RR44RR3....',
      '.....3RRRR3.....',
      '.33ooyyooyyoo33.',
      '.3oooYYYYyy3333.',
      '.3y3oyYYyyy3oy3.',
      '.r4RyyooooyyR4r.',
      '...4RYo33oYR4...',
      '...4r34..43r4...',
      '...r44r..r44r...',
    ],
    side: [
      '................',
      '.......o3y......',
      '.......333......',
      '....yy.3yo3y....',
      '....3o3oYYo3....',
      '....3oyYYYy3....',
      '....3RRRRWk3....',
      '....3RRRRRRr....',
      '.....3RRRR3.....',
      '.3333333333333..',
      '.3ooooooYYYYY33.',
      '.3yy33ooyyyyy33.',
      '.3rxxroYy3yyy34.',
      '.rRx3oyYy3yy3...',
      '..RRryy333yy34..',
      '...444444444444.',
    ],
    up: [
      '................',
      '.......oo.......',
      '....y..33..y....',
      '....333yy333....',
      '....3ooYYoo3....',
      '....3oyYYyo3....',
      '....3yyyyyy3....',
      '....3yyyyyy3....',
      '.....3yyyy3.....',
      '.33y44444444y33.',
      '.3oorRxxxRr4oo3.',
      '.3YoRRxRRRr4yY3.',
      '.444xxRRRRrr444.',
      '...4xxxRxRrr4...',
      '...4RRRRrRRR4...',
      '...4444444444...',
    ],
  },

  /* The golden thief. A hunched shape with a sack — it has to
     read as a *creature* at a glance, not as a coin pile. */
  thief: {
    down: [
      '................',
      '......N11M......',
      '.....NNMMNn.....',
      '.....1NNnnnn....',
      '....MMN11111....',
      '....111..111....',
      '....1WkhhkW1....',
      '.....1h00h1.....',
      '...MNN111nnnn...',
      '..NMnn111nnnnn..',
      '..3o1nNMNNn1y3..',
      '..331nNMNNn0o3..',
      '..H0nNNNNNNn0H..',
      '....1Nn11nN1....',
      '....1n1..1n1....',
      '...H000..000H...',
    ],
    side: [
      '................',
      '......111M......',
      '.....11NNMM.....',
      '....111MMnNN....',
      '....111NM111....',
      '....11nn1.11....',
      '....1hhhhWk1....',
      '.....1hhhh1H....',
      '..11nnnnN11n....',
      '..1nNNnNMnn1....',
      '..0yy3nNMMMN0...',
      '..33ahnNMMMn0...',
      '....0HnNNNM1....',
      '....1nNNNNN1....',
      '....1nNNnnahH...',
      '....n000000H....',
    ],
    up: [
      '................',
      '......N11M......',
      '.....MMMMMN.....',
      '.....1MMMNNN....',
      '....nNnNMnN1....',
      '....11nNNnn1....',
      '....1NNNNNN1....',
      '.....1NNNN1.....',
      '...MNn1nn111n...',
      '..o3Nn1111nn3o..',
      '..3o1nnnnnn1o3..',
      '..0a1NNNNNN1a0..',
      '..H0nNNnnNNn0H..',
      '....1Nn11nN1....',
      '...0nn1..1nn0...',
      '...00h....h00...',
    ],
  },

  /* ── items ──────────────────────────────────────────────
     Tools go on the diagonal so the blade gets its full run
     across the tile, and every material carries its own
     outline: a wooden haft never shares a line with an iron
     head. */
  sword: [
    '..........kkk...',
    '.........kSSk...',
    '........kSSkk...',
    '.......kSSk.....',
    '......kSSk......',
    '.....kSSk.......',
    '....kSSk........',
    '...kSSk.........',
    '..kkSkk.........',
    '.kyykyyk........',
    '.kyyyyyk........',
    '..kkyykk........',
    '...kNNk.........',
    '..kNNk..........',
    '..kkk...........',
    '................',
  ],
  dagger: [
    '................',
    '................',
    '................',
    '..........22222.',
    '.........2WSd2..',
    '........2WSd2...',
    '.......2WSd2....',
    '......2WS22.....',
    '.....32Sd2......',
    '....3y32d2......',
    '...3yYy33.......',
    '..13yYy3........',
    '..1NM3y3........',
    '.11NM133........',
    '.1NM11..........',
    '.111............',
  ],
  great: [
    '..........2222..',
    '.........2WWSd2.',
    '........2WWSSd2.',
    '.......2WWSSd22.',
    '......2WWSSd22..',
    '.....2WWSSd22...',
    '....2WWSSd22....',
    '...2WWSSd22.....',
    '..2WWSSd22......',
    '.32WSSd22.......',
    '3yY32d22........',
    '3yYYy33.........',
    '13yYYy3.........',
    '1NM3yy3.........',
    '1NM1133.........',
    '.1111...........',
  ],
  axe: [
    '................',
    '........222.....',
    '.......2SSS2....',
    '......2SWSSS2...',
    '.....2SWSSSSS2..',
    '....12SWSSSSSd2.',
    '...1M12SWSSSSd2.',
    '...1NM12SSSSSd2.',
    '..1nNM12SSSSd2..',
    '..1nNM122SSd2...',
    '.1nNM1..2Sd2....',
    '.1nNM1..222.....',
    '1nNM1...........',
    '1nNM1...........',
    '1nM11...........',
    '111.............',
  ],
  mace: [
    '................',
    '......22.22.....',
    '.....2S22S2.....',
    '....22SSSS22....',
    '...2SSSSSSSS2...',
    '...2SWSSSSdd2...',
    '...2SSSSSSdd2...',
    '....22SSSS22....',
    '.....2S22S2.....',
    '......22M1......',
    '.....1NM11......',
    '....1NM11.......',
    '...1NM11........',
    '..1NM11.........',
    '..1M11..........',
    '..111...........',
  ],
  spear: [
    '.........22222..',
    '........2WSSSd2.',
    '.......2WWSSSd2.',
    '.......2WWSSd2..',
    '........2WSSd2..',
    '........22WSd2..',
    '.........13yy32.',
    '........1NM133..',
    '.......1nNM11...',
    '......1nNM11....',
    '.....1nNM11.....',
    '....1nNM11......',
    '...1nNM11.......',
    '..1nNM11........',
    '..1nM11.........',
    '..111...........',
  ],
  bow: [
    '................',
    '.....1111.......',
    '....1nNMn1......',
    '...1nNM1n1.9....',
    '..1nNM11..9w9...',
    '..1NM1.....9w...',
    '.1nNM1.....9w...',
    '.1nNM1.....9w...',
    '.1nNM1.....9w...',
    '.1nNM1.....9w...',
    '.1nNM1.....9w...',
    '..1NM1.....9w...',
    '..1nNM11..9w9...',
    '...1nNM1n1.9....',
    '....1nNMn1......',
    '.....1111.......',
  ],
  wand: [
    '................',
    '...........888..',
    '..........8TTT8.',
    '..........8TWT8.',
    '...........8T8..',
    '..........1t88..',
    '.........1NM1...',
    '........1NM1....',
    '.......1NM1.....',
    '......1NM1......',
    '.....1NM1.......',
    '....1NM1........',
    '...1NM1.........',
    '..1NM1..........',
    '..1M1...........',
    '..11............',
  ],
  potion: [
    '................',
    '......kkkk......',
    '......kNNk......',
    '.....kkNNkk.....',
    '.....kwwwwk.....',
    '....kkwwwwkk....',
    '...kwRRRRRRwk...',
    '..kwRRRRRRRRwk..',
    '..kRRRRRRRRRRk..',
    '..kRRRRRRRRRRk..',
    '..kRRRRRRRRRRk..',
    '..kRRRRRRRRRRk..',
    '...kRRRRRRRRk...',
    '....kkRRRRkk....',
    '......kkkk......',
    '................',
  ],
  scroll: [
    '................',
    '..111111111111..',
    '.1nNMMMMMMMMNn1.',
    '.1nNMMMMMMMMNn1.',
    '..9wwwwwwwwww9..',
    '..9wuuuuuuuuw9..',
    '..9wu999999uw9..',
    '..9wuuuuuuuuw9..',
    '..9wu99999uuw9..',
    '..9wuuuuuuuuw9..',
    '..9wu9999uuuw9..',
    '..9wuuuuuuuuw9..',
    '..9wwwwwwwwww9..',
    '.1nNMMMMMMMMNn1.',
    '.1nNMMMMMMMMNn1.',
    '..111111111111..',
  ],
  ring: [
    '................',
    '................',
    '.......33.......',
    '......3II3......',
    '.....3ITTI3.....',
    '.....3ITTI3.....',
    '....33IIII33....',
    '...33yyyyyy33...',
    '..3yYYY33YYy3...',
    '..3yY33..33Yy3..',
    '..3yY3....3Yy3..',
    '..3yy3....3yy3..',
    '...3yy3..3yy3...',
    '....3yy33yy3....',
    '.....3yyyy3.....',
    '......3333......',
  ],
  amulet: [
    '................',
    '...333....333...',
    '..3yY3....3Yy3..',
    '..3y3......3y3..',
    '..3y3......3y3..',
    '...3y3....3y3...',
    '....3y3..3y3....',
    '.....3y33y3.....',
    '......3yy3......',
    '.....77PP77.....',
    '....7PVVVVP7....',
    '....7PVWWVP7....',
    '....7PVVVVP7....',
    '.....7pPPp7.....',
    '......7777......',
    '................',
  ],
  armor: [
    '................',
    '....2222222.....',
    '..22SSSSSSSS22..',
    '.2SSSSSSSSSSSS2.',
    '2SSGGGGGGGGGGSS2',
    '2SGGSSSSSSSSGGS2',
    '2SGSSSSSSSSSSGS2',
    '.2SGSSS22SSSGS2.',
    '.2SGSS2WW2SSGS2.',
    '.2SGSS2WW2SSGS2.',
    '..2SGSS22SSGS2..',
    '..2SGSSSSSSGS2..',
    '...2SGSSSSGS2...',
    '....2SSSSSS2....',
    '....2S2222S2....',
    '.....22..22.....',
  ],
  shield: [
    '................',
    '..222222222222..',
    '.2SSSSSSSSSSSS2.',
    '.2SGGGGGGGGGGS2.',
    '.2SG444444444S2.',
    '.2SG4RRRRRRr4S2.',
    '.2SG4RRxxRRr4S2.',
    '.2SG4RRxxRRr4S2.',
    '.2SG4RRRRRRr4S2.',
    '.2SG4444444GS2..',
    '.2SGGGGGGGGGS2..',
    '..2SSSSSSSSS2...',
    '...2SSSSSSS2....',
    '....2SSSSS2.....',
    '.....22S22......',
    '.......22.......',
  ],
  food: [
    '................',
    '................',
    '.....111111.....',
    '...11MMMMMM11...',
    '..1MMMMMMMMMM1..',
    '.1nMMMMMMMMMMn1.',
    '.1NM1MMM1MMMMN1.',
    '1NNM1MMM1MMMMNN1',
    '1NNNM1MM1MMMNNN1',
    '1NNNNMMMMMMNNNN1',
    '1nNNNNNNNNNNNNn1',
    '.1nNNNNNNNNNNn1.',
    '..11nnnnnnnn11..',
    '....11111111....',
    '................',
    '................',
  ],
  torch: [
    '................',
    '.......m........',
    '......mOm.......',
    '.....mOYOm......',
    '....mOYWYOm.....',
    '....mOYWYOm.....',
    '.....mOYOm......',
    '.....mmOmm......',
    '......1M1.......',
    '......1NM1......',
    '......1NM1......',
    '......1NM1......',
    '......1NM1......',
    '......1nN1......',
    '......1nN1......',
    '......1111......',
  ],
  gold: [
    '................',
    '................',
    '................',
    '................',
    '.......3333.....',
    '......3yYYy3....',
    '......3yyyy3....',
    '..3333.3333.....',
    '.3yYYy33333.....',
    '.3yyyy3yYy3.....',
    '.3yyyy3yyy3.....',
    '.33333333333....',
    '3yYYyyyyyyyy3...',
    '3yyyyyyyyyyy3...',
    '.333333333333...',
    '................',
  ],

  /* ── terrain features ───────────────────────────────── */
  stairsDown: [
    'kkkkkkkkkkkkkkkk',
    'kSSSSSSSSSSSSSSk',
    'kGGGGGGGGGGGGGGk',
    'kkkkkkkkkkkkkkkk',
    'kGGGGGGGGGGGGGGk',
    'kgggggggggggggGk',
    'kkkkkkkkkkkkkkkk',
    'kggggggggggggggk',
    'kddddddddddddgdk',
    'kkkkkkkkkkkkkkkk',
    'kddddddddddddddk',
    'kqqqqqqqqqqqqdqk',
    'kkkkkkkkkkkkkkkk',
    'kqqqqqqqqqqqqqqk',
    'kkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
  ],
  stairsUp: [
    'kkkkkkkkkkkkkkkk',
    'kqqqqqqqqqqqqqqk',
    'kkkkkkkkkkkkkkkk',
    'kddddddddddddddk',
    'kddddddddddddddk',
    'kkkkkkkkkkkkkkkk',
    'kgggggggggggggGk',
    'kggggggggggggggk',
    'kkkkkkkkkkkkkkkk',
    'kGGGGGGGGGGGGGGk',
    'kGGGGGGGGGGGGGSk',
    'kkkkkkkkkkkkkkkk',
    'kSSSSSSSSSSSSSSk',
    'kSSSSSSSSSSSSSWk',
    'kwwwwwwwwwwwwwwk',
    'kkkkkkkkkkkkkkkk',
  ],
  door: [
    '1111111111111111',
    '1nnnnnnnnnnnnnn1',
    '1nNNNNNNNNNNNNn1',
    '1nNMM1NNNN1MMMn1',
    '1nNMM1NNNN1MMMn1',
    '1nNMM1NNNN1MMMn1',
    '1nNNN1NNNN1NNNn1',
    '1nNMM1NNNN1MMMn1',
    '1nNMM1N3y31MMMn1',
    '1nNMM1NyY31MMMn1',
    '1nNMM1NNNN1MMMn1',
    '1nNNN1NNNN1NNNn1',
    '1nNMM1NNNN1MMMn1',
    '1nNMM1NNNN1MMMn1',
    '1nnnnnnnnnnnnnn1',
    '1111111111111111',
  ],
  doorOpen: [
    '1111111111111111',
    '1nnn1......1nnn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nNM1......1MNn1',
    '1nnn1......1nnn1',
    '11111......11111',
  ],
  doorLocked: [
    '1111111111111111',
    '1nnnnnnnnnnnnnn1',
    '1nNNNNNNNNNNNNn1',
    '1nNMMMMMMMMMMNn1',
    '1nNMM333333MMNn1',
    '1nNM3yyYYyy3MNn1',
    '1nNM3yY33Yy3MNn1',
    '1nNM3y3kk3y3MNn1',
    '1nNM3yy33yy3MNn1',
    '1nNMM3yyyy3MMNn1',
    '1nNMMM3333MMMNn1',
    '1nNMMMMMMMMMMNn1',
    '1nNNNNNNNNNNNNn1',
    '1nnnnnnnnnnnnnn1',
    '1111111111111111',
    '................',
  ],
  doorBroken: [
    '1111111111111111',
    '1nn1.....1nnnnn1',
    '1nN1......1nNMn1',
    '1nNM1......1nNn1',
    '1n.1........1Nn1',
    '1...1........1n1',
    '.....1.......1..',
    '................',
    '................',
    '..1.........1...',
    '.1n1.......1n1..',
    '1nN1......1nNM1.',
    '1nNM1....1nNMn1.',
    '1nNMn1..1nNMMn1.',
    '1nnnn1111nnnnnn1',
    '1111111111111111',
  ],
  rubble: [
    '................',
    '................',
    '.......22.......',
    '......2GG2......',
    '..22.2gGGg2.....',
    '.2GG22gggg2.22..',
    '2gGGG222222dGG2.',
    '2ggGg2gGGg2gGg2.',
    '22ggg2gggg2ggg2.',
    '.22222dgg22222..',
    '.2GGg22GG22gGG2.',
    '2gGGGg2gg2gGGGg2',
    '2gggggg22ggggg22',
    '22222222222222..',
    '................',
    '................',
  ],

  /* A chest and a mimic share a silhouette on purpose — the
     mimic only gives itself away by breathing (see ui.js). */
  chest: [
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kNNNNNNNNNNk..',
    '..kNNNNNNNNNNk..',
    '..kkkkkkkkkkkk..',
    '..kyyyyyyyyyyk..',
    '..kkkkkkkkkkkk..',
    '..kNNNNNNNNNNk..',
    '..kNNNkkkkNNNk..',
    '..kNNNkyykNNNk..',
    '..kNNNkkkkNNNk..',
    '..kNNNNNNNNNNk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  mimic: [
    '................',
    '................',
    '...1111111111...',
    '..1nNNNNNNNNn1..',
    '..1nN3yyyy3Nn1..',
    '..1nNNNNNNNNn1..',
    '..111111111111..',
    '..1wkw1ww1wkw1..',
    '..1w1w1ww1w1w1..',
    '..1wwww11wwww1..',
    '..111111111111..',
    '..1nNNNNNNNNn1..',
    '..1nN3yyyy3Nn1..',
    '..1nNNNNNNNNn1..',
    '..1nnnnnnnnnn1..',
    '..111111111111..',
  ],

  /* Shopkeeper — the C channel is tinted per shop, same trick
     the hero uses for classes. Drawn as a torso behind a
     counter, because he is standing in a shopfront. */
  keeper: {
    down: [
      '................',
      '......1111......',
      '.....nNMMNn.....',
      '....1NMMMMN1....',
      '....1NNMNNN1....',
      '....1nNNNNn1....',
      '....1WkhhkW1....',
      '....1hh00hh1....',
      '...DX1hhhh1DD...',
      '..XCCLCCCCDDDX..',
      '..XXXDLLLLDDXX..',
      '..XXXXDCCDXXXX..',
      '..h0nnnNNnnn0h..',
      '....1N1111N1....',
      '...11n1..1n11...',
      '...n111..111n...',
    ],
    side: [
      '................',
      '......11111.....',
      '.....1NNMNn1....',
      '....1nNMMMM1....',
      '....1nMMMNN1....',
      '....1nnNN111....',
      '....1hhhhWk1....',
      '....1hhhhhhH....',
      '...DC1hhhh1X....',
      '..XCCCCCDDCCD...',
      '..XLDXCLLLCCX...',
      '..XDXXDDDCCDH0..',
      '...HahnNnnNN0...',
      '....1nNNnnN1....',
      '...1nNNnnNNnN...',
      '....n1111111n...',
    ],
    up: [
      '................',
      '......1111......',
      '.....1NNNn1.....',
      '....1NMMMMN1....',
      '....1NMMMMN1....',
      '....1NMMMMn1....',
      '....1NNNNNN1....',
      '.....1NNNN1.....',
      '...DXCDXXDCXD...',
      '..XCCCLLLLCCCX..',
      '..XDXXCLLCXXDX..',
      '..0hnnDDDDnnh0..',
      '..0hnnnnnnnnH0..',
      '...1nnn11nnn1...',
      '...1NN1..1NN1...',
      '...11N....N11...',
    ],
  },
  /* A blank plank. The shop's goods sprite is drawn on top, and
     the goods sprites all have transparent margins, so the plank
     reads as a frame around the icon. */
  sign: [
    '1..............1',
    '1n............n1',
    '11nnnnnnnnnnnn11',
    '1nNNNNNNNNNNNNn1',
    '1nNMMMMMMMMMMNn1',
    '1nNMMMMMMMMMMNn1',
    '1nNMMMMMMMMMMNn1',
    '1nNMMMMMMMMMMNn1',
    '1nNMMMMMMMMMMNn1',
    '1nNMMMMMMMMMMNn1',
    '1nNMMMMMMMMMMNn1',
    '1nNNNNNNNNNNNNn1',
    '11nnnnnnnnnnnn11',
    '................',
    '................',
    '................',
  ],
  /* The ? room. A question mark on a stone marker — the one
     glyph the player will read before they read the prose. */
  event: [
    '................',
    '.....666666.....',
    '....6bBBBBb6....',
    '...6bBIIIIBb6...',
    '...6BI6666IB6...',
    '...6BI6..6IB6...',
    '...6bB6..6IB6...',
    '....666.6IB6....',
    '.......6IB6.....',
    '......6IB6......',
    '......6Bb6......',
    '......6666......',
    '......6IB6......',
    '......6Bb6......',
    '......6666......',
    '................',
  ],
  /* The anvil. A dark block on a stump with a spark coming off
     the horn — it has to read as "hit things here". */
  anvil: [
    '................',
    '.............m..',
    '............mOm.',
    '.............m..',
    '...222222222....',
    '..2SSSSSSSSS2...',
    '.2SSSSSSSSSSS2..',
    '2gSSSSSSSSSSSS22',
    '2gg222SSSSd2222.',
    '.22..2SSSSd2....',
    '.....2SSSSd2....',
    '....2gSSSSgd2...',
    '...2gggggggg2...',
    '..1nNNNNNNNNn1..',
    '..1nnnnnnnnnn1..',
    '...1111111111...',
  ],
  barrel: [
    '................',
    '................',
    '..111111111111..',
    '.1nNNNNNNNNNNn1.',
    '.1NMMMMMMMMMMN1.',
    '.2dssssssssssd2.',
    '.2SSSSSSSSSSSS2.',
    '1nMMMMMMMMMMMMn1',
    '1nMMMMMMMMMMMMn1',
    '1nMMMMMMMMMMMMn1',
    '.2dssssssssssd2.',
    '.2SSSSSSSSSSSS2.',
    '.1NMMMMMMMMMMN1.',
    '.1nNNNNNNNNNNn1.',
    '..111111111111..',
    '................',
  ],
  brazier: [
    '................',
    '................',
    '................',
    '..222222222222..',
    '.2dssssssssssd2.',
    '.2dSSSSSSSSSSd2.',
    '..2dssssssssd2..',
    '...2ddssssdd2...',
    '....22dss222....',
    '......2ss2......',
    '......2ss2......',
    '.....2dssd2.....',
    '....2dssssd2....',
    '...2ddssssdd2...',
    '...2222222222...',
    '................',
  ],
  brazierLit: [
    '.......m........',
    '......mOm...m...',
    '.....mOYOm.mOm..',
    '....mOYWYOmmOm..',
    '..mmOOYWYOOmm2..',
    '.2dOOOOYOOOOsd2.',
    '..2dsOOOOOOsd2..',
    '...2ddssssdd2...',
    '....22dss222....',
    '......2ss2......',
    '......2ss2......',
    '.....2dssd2.....',
    '....2dssssd2....',
    '...2ddssssdd2...',
    '...2222222222...',
    '................',
  ],
  pillar: [
    '..222222222222..',
    '.2GGGGGGGGGGGG2.',
    '.2Gggggggggggg2.',
    '..222222222222..',
    '...2GGGGGGGG2...',
    '...2GgggggGG2...',
    '...2GgggggGG2...',
    '...2GgggggGG2...',
    '...2GgggggGG2...',
    '...2GgggggGG2...',
    '...2GgggggGG2...',
    '...2GgggggGG2...',
    '..222222222222..',
    '.2GGGGGGGGGGGG2.',
    '.2Gggggggggggg2.',
    '..222222222222..',
  ],
  bones: [
    '................',
    '................',
    '.....99999......',
    '....9wwwww9.....',
    '...9wWWWWWw9....',
    '...9w999w9w9....',
    '...9wWkkWWw9....',
    '...9wwwwwww9....',
    '....9w999w9.....',
    '.....99999......',
    '..99.......99...',
    '.9ww9999999ww9..',
    '..9wwwwwwwww9...',
    '.9ww9999999ww9..',
    '..99.......99...',
    '................',
  ],
  urn: [
    '................',
    '......7777......',
    '.....7ppp7......',
    '....77PPP77.....',
    '...7pPPPPPp7....',
    '..7pPVVVVVPp7...',
    '.7pPVVVVVVVPp7..',
    '.7PVVV77VVVVP7..',
    '.7PVV7kk7VVVP7..',
    '.7PVVV77VVVVP7..',
    '.7pPVVVVVVVPp7..',
    '..7pPVVVVVPp7...',
    '...7pPPPPPp7....',
    '....7pppppp7....',
    '....77777777....',
    '................',
  ],
  altar: [
    '................',
    '................',
    '....77777777....',
    '...7VVVVVVVV7...',
    '...7VWWWWWWV7...',
    '...7VWVVVVWV7...',
    '...7PPPPPPPP7...',
    '....77ppp77.....',
    '.....7pPp7......',
    '.....7pPp7......',
    '.....7pPp7......',
    '....7ppPpp7.....',
    '...7pPPPPPp7....',
    '..7pPPPPPPPp7...',
    '..7pppppppppp7..',
    '..777777777777..',
  ],
  camp: [
    '................',
    '.......m........',
    '......mOm.......',
    '.....mOYOm......',
    '....mOYWYOm.....',
    '...mOYWWWYOm....',
    '...mOYWWWYOm....',
    '....mOYWYOm.....',
    '..11.mOOOm.11...',
    '.1nN11mOm11Nn1..',
    '1nNMMn1m1nMMN1..',
    '.1nnNNMMMMNnn1..',
    '..11nnnnnnn11...',
    '....1111111.....',
    '................',
    '................',
  ],
  campSpent: [
    '................',
    '................',
    '................',
    '................',
    '.......2........',
    '......2g2.......',
    '.....2gqg2......',
    '.....2qqq2......',
    '..11.2gqg2.11...',
    '.1nN112g211Nn1..',
    '1nNnnn121nnnN1..',
    '.1nnnnnnnnnnn1..',
    '..11nnnnnnn11...',
    '....1111111.....',
    '................',
    '................',
  ],
  web: [
    'w......w......w.',
    '.w.....w.....w..',
    '..w....w....w...',
    '.u.w...w...w.u..',
    '..u..w.w.w..u...',
    '...u.wwwww.u....',
    '....wwuwuww.....',
    'wwwwwuwuwuwwwww.',
    '....wwuwuww.....',
    '...u.wwwww.u....',
    '..u..w.w.w..u...',
    '.u.w...w...w.u..',
    '..w....w....w...',
    '.w.....w.....w..',
    'w......w......w.',
    '................',
  ],
  water: [
    '................',
    '..bbbbbbbbbbbb..',
    '.bbbbbbbbbbbbbb.',
    'bbbBBbbbbbBBbbbb',
    'bbBIIBbbbBIIBbbb',
    'bbbBBbbbbbBBbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbBBbbbbbbbb',
    'bbbbbBIIBbbbbbbb',
    'bbbbbbBBbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bBBbbbbbbbbbBBbb',
    'BIIBbbbbbbbBIIBb',
    'bBBbbbbbbbbbBBbb',
    '.bbbbbbbbbbbbbb.',
    '..bbbbbbbbbbbb..',
  ],
  trap: [
    '................',
    '..4..........4..',
    '.4R4..4444..4R4.',
    '.4RR44RRRR44RR4.',
    '..4RRR4444RRR4..',
    '...4RR4..4RR4...',
    '..44R4....4R44..',
    '.4RR4......4RR4.',
    '.4RR4......4RR4.',
    '..44R4....4R44..',
    '...4RR4..4RR4...',
    '..4RRR4444RRR4..',
    '.4RR44RRRR44RR4.',
    '.4R4..4444..4R4.',
    '..4..........4..',
    '................',
  ],
};

/* ── the hero, in two layers ──────────────────────────────
   One sprite for every hero meant a 하프트롤 마법사 looked
   exactly like a 하플링 전사 in a different colour. Eight races
   and six classes is forty-eight characters, which is far too
   many to draw — so they are composited instead.

   RACE_BODY owns the head and the silhouette: skin, ears, size,
   how much of the 16×16 the figure fills. CLASS_KIT is painted
   on top and owns the headgear and the torso, with '.' left
   where the race has to show through. The face never gets
   covered, because the face is the whole reason to have eight
   races — helmets stop at row 4 and hoods only frame the
   cheeks, so the eyes and the jawline always survive.

   Each is drawn three times — walking away from you (`down`),
   across you (`side`), and toward the back of the screen
   (`up`). `left` is `side` mirrored at bake time, and a second
   walk frame comes from mirroring the two leg rows, so four
   facings and eight frames cost three drawings.

   Rows, by contract:
     0–4    hair and headgear
     5–9    the face — kits touch only the outermost columns
     10–13  torso and arms; C is the class colour, D its shade
     14–15  legs — mirrored to make the step frame            */

export const RACE_BODY = {
  human: {
    down: [
      '................',
      '......1111......',
      '.....nnNNnn.....',
      '....1nMNNNn1....',
      '....1nNNNNn1....',
      '....1nNNNNn1....',
      '....1WkhhkW1....',
      '....1hh00hh1....',
      '...u91hhhh19u...',
      '..9wwwwwwwwww9..',
      '..999uWWWWu999..',
      '..9902dddd2099..',
      '..h0nNggggNn0h..',
      '....1M1221M1....',
      '....111..111....',
      '...n111..111n...',
    ],
    side: [
      '................',
      '......n111n.....',
      '.....nNNNNn1....',
      '....1nNNNNN1....',
      '....1nNNMNN1....',
      '....1nnNM111....',
      '....1hhhhWk1....',
      '....1hhhhhhH....',
      '...u.1hhhh19....',
      '..9wWwwwuuwwu...',
      '..9Wu9wwWWWw9...',
      '..9u99uuuwwuH0..',
      '...HahnNd2gg0...',
      '....1nMMnnN1....',
      '...21NMn1NNNN...',
      '....11111111n...',
    ],
    up: [
      '................',
      '......1111......',
      '.....nNNNnn.....',
      '....1NMMNNN1....',
      '....1NMMMNN1....',
      '....1NMMNNn1....',
      '....1NNNNNN1....',
      '....1NNNNNN1....',
      '...u91NNNN19u...',
      '..9uuwWWWWwuu9..',
      '..9uuuwwww99u9..',
      '..0hddggggd2h0..',
      '..0hdGgddgGdH0..',
      '...2nN1221Nn2...',
      '...1nN2..2Nn1...',
      '...n1M....M1n...',
    ],
  },

  // Half-elf: a little of the point, a little of the height.
  halfElf: {
    down: [
      '................',
      '......1111......',
      '.....1nnnn1.....',
      '....1nNnnnn1....',
      '....1nNnnnn1....',
      '....1nNMNNn1....',
      '....1WkhhkW1....',
      '....1hh00hh1....',
      '...u91hhhh19u...',
      '..9wwwwwwwwww9..',
      '..999uWWWWu999..',
      '..9902dddd2099..',
      '..h0NNggggNN0H..',
      '....1Mn22nM1....',
      '....111..111....',
      '...N11n..n11N...',
    ],
    side: [
      '................',
      '......11111.....',
      '.....1nnnnn1....',
      '....1nnNnnn1....',
      '....1nnNNnn1....',
      '....1nnNN111....',
      '....1hhhhWk1....',
      '....1hhhhhhH....',
      '...u.1hhhh19....',
      '..9wWwwwuuwwu...',
      '..9Wu9wwWWWw9...',
      '..9u99uuuwwu00..',
      '...HahNMd2gg0...',
      '....1NMMNNN1....',
      '...2nNMNNNNNN...',
      '....N1111111N...',
    ],
    up: [
      '................',
      '......1111......',
      '.....1nNnnn.....',
      '....1nNNNNn1....',
      '....1NNNNNN1....',
      '....1nNNNNn1....',
      '....1NNNNNN1....',
      '....1NNNNNN1....',
      '...u91NNNN19u...',
      '..9uuwWWWWwuu9..',
      '..9uuuwwww99u9..',
      '..0hddggggd2h0..',
      '..0hdGgddgGdH0..',
      '...2NMn22nMM2...',
      '...1MM2..2MM1...',
      '...N1M....M1N...',
    ],
  },

  // Elf: pale, tall, long ears standing clear of the head.
  elf: {
    down: [
      '................',
      '......o333......',
      '.....oyYYyo.....',
      '....3yYYYyy3....',
      '....3yYyyyy3....',
      '....3yooooy3....',
      '....3WkhhkW3....',
      '....3hh00hh3....',
      '...u93hhhh39u...',
      '..9wwww99wwww9..',
      '..999uWWWWu999..',
      '..u9H2dddd2H9u..',
      '...hnNggggNnh...',
      '....1M1221M1....',
      '....11100111....',
      '...n11100111n...',
    ],
    side: [
      '................',
      '......o333o.....',
      '.....oyyYyyo....',
      '....3oyYYYY3....',
      '....3oyYYyy3....',
      '....3oyyo333....',
      '....3hhhhWk3....',
      '....3hhhhhhH....',
      '...u.3hhhh39....',
      '..9wWwww99wwu...',
      '..9Wu9wwWWWw9...',
      '..9u99uuuwwu0...',
      '..H0hHnNd2gg0...',
      '....1nMMnnN1....',
      '...21NMn1NNNN...',
      '....11111111n...',
    ],
    up: [
      '................',
      '......3333......',
      '.....oyyyoo.....',
      '....3yYYyyy3....',
      '....3yYYYyy3....',
      '....3yYYyyo3....',
      '....3yyyyyy3....',
      '....3yyyyyy3....',
      '...u93yyyy39u...',
      '..9uuwWWWWwuu9..',
      '..9uuuwwww99u9..',
      '..Haddggggd2hH..',
      '...0dGgddgGd0...',
      '...2nN1221Nn2...',
      '...1nN2002Nn1...',
      '...n11000011n...',
    ],
  },

  // Halfling: small, low, wide-footed. Sits three rows lower.
  halfling: {
    down: [
      '................',
      '......1111......',
      '.....nNNMNn.....',
      '....1NMMMNN1....',
      '....1NNMNNN1....',
      '....1nNNNNn1....',
      '....1WkhhkW1....',
      '.....1h00h1.....',
      '...u99....99u...',
      '..9www9999www9..',
      '..999uWWWWu999..',
      '..u9a2dddd2h9u..',
      '...Hnnggggn1....',
      '....1N1221N1....',
      '....1nn0Hnn1....',
      '...n11100111n...',
    ],
    side: [
      '................',
      '......11111.....',
      '.....1NNNNn1....',
      '....1nNMMMM1....',
      '....1nMMMNN1....',
      '....1nnNN111....',
      '....1hhhhWk1....',
      '....1hhhhhhH....',
      '...u.1hhhh19....',
      '..9wWww999wwu...',
      '..9Wu9wwWWWw9...',
      '..9999uuuww9....',
      '....0hnNd2gg0...',
      '....1nNNnnN1....',
      '...2nNNnnNNNN...',
      '....n1111111n...',
    ],
    up: [
      '................',
      '......1111......',
      '.....nNNNnn.....',
      '....1NMMMMN1....',
      '....1NMMMMN1....',
      '....1NMMNNn1....',
      '....1NNNNNN1....',
      '....1NNNNNN1....',
      '...u91NNNN19u...',
      '..9uuwWWWWwuw9..',
      '..uuuuwwww999u..',
      '...Hddggggd2....',
      '....2GgddgG2....',
      '...dnN1221Nnd...',
      '...1nN20h2Nn1...',
      '...n11000011n...',
    ],
  },

  // Gnome: big head, small body, a shock of white hair.
  gnome: {
    down: [
      '................',
      '......9999......',
      '.....uwWWwu.....',
      '....9wWWWWw9....',
      '....9wWwwww9....',
      '....9uuuuuw9....',
      '....9WkhhkW9....',
      '....9hh00hh9....',
      '.....9hhhh9.....',
      '..9wwwwwwwwww9..',
      '..999uWWWWu999..',
      '..u9a2dddd2h9u..',
      '...HnNggggN1....',
      '....1M1221M1....',
      '....1110H111....',
      '...n11100111n...',
    ],
    side: [
      '................',
      '......u9999.....',
      '.....uwwwwu9....',
      '....9uwWWWw9....',
      '....9uwWWww9....',
      '....9uuwu999....',
      '....9hhhhWk9....',
      '....9hhhhhhH....',
      '.....9hhhh9.....',
      '..9wWwwuuuWw9...',
      '..9Wu9wwWWWw9...',
      '..99999uuww9....',
      '....0hnNd2gg0...',
      '....1nMMnnN1....',
      '...21NMn1NNNN...',
      '....11111111n...',
    ],
    up: [
      '................',
      '......9999......',
      '.....uwwwuu.....',
      '....9uwWWWw9....',
      '....9wWWWWw9....',
      '....9uWWwwu9....',
      '....9wwwwww9....',
      '....9wwwwww9....',
      '.....9wwww9.....',
      '..9uuwWWWWwuw9..',
      '..uuuuwwww999u..',
      '...Hddggggd2....',
      '....2GgddgG2....',
      '...dnN1221Nnd...',
      '...1nN20h2Nn1...',
      '...n11000011n...',
    ],
  },

  // Dwarf: broad, and the beard is most of the face.
  dwarf: {
    down: [
      '................',
      '......4444......',
      '.....rRRRrr.....',
      '....4rxRRRr4....',
      '....4rxxRRR4....',
      '....4rrxrrr4....',
      '....4WkhhkW4....',
      '....4hh00hh4....',
      '...994hhhh499...',
      '..9wwwwwwwwww9..',
      '..999uWWWWu999..',
      '..9902dddd2099..',
      '..h0nNggggNn0H..',
      '....1M1221M1....',
      '....111..111....',
      '...n111..111n...',
    ],
    side: [
      '................',
      '......4444r.....',
      '.....rrRRRr4....',
      '....4rRRRRR4....',
      '....4rRRRRR4....',
      '....4rrRr444....',
      '....4hhhhWk4....',
      '....4hhhhhhH....',
      '...u.4hhhh4.....',
      '..9wWwwuuuRw90..',
      '..9Wu9wwWWWw90..',
      '..9u999uuwwuH0..',
      '...hahnNd2ggH...',
      '....1nMMnnN1....',
      '...21NMn1NNNN...',
      '....11111111n...',
    ],
    up: [
      '................',
      '......444r......',
      '.....rRRRrr.....',
      '....4RxxRRR4....',
      '....4RxxxRR4....',
      '....4RxxRRr4....',
      '....4RRRRRR4....',
      '....4RRRRRR4....',
      '...994RRRR499...',
      '..9wuwWWWWwuw9..',
      '..9uuuwwww99u9..',
      '..0hddggggd2h0..',
      '..0HdGgddgGdH0..',
      '...2nN1221Nn2...',
      '...1nN2..2Nn1...',
      '...n1M....M1n...',
    ],
  },

  // Half-orc: green, jawed, tusks up from the lip.
  halfOrc: {
    down: [
      '................',
      '................',
      '.......55.......',
      '....5.eEFe.5....',
      '....55EEEE55....',
      '....5EEEEEe5....',
      '....5WkEEkW5....',
      '....5EE55EE5....',
      '...995EEEE599...',
      '..9wwwwwwwwww9..',
      '..999uWWWWu999..',
      '..9952dddd2599..',
      '..e5nNggggNn5e..',
      '....1M1221M1....',
      '....111..111....',
      '...n111..111n...',
    ],
    side: [
      '................',
      '................',
      '................',
      '........5.......',
      '.....5.eE5e.....',
      '.....55EFF5.....',
      '.....5EEWk5.....',
      '.....5EEEEe.....',
      '...u9u5EE599....',
      '..9wWwwwuuwwu5..',
      '..9Wu9wWWWWw95..',
      '..9u99uuuwwue5..',
      '...eEEnNd2gg5...',
      '....1nMMnnN1....',
      '...21NMn1NNNN...',
      '....11111111n...',
    ],
    up: [
      '................',
      '................',
      '................',
      '....5.5555.5....',
      '....55EFEE55....',
      '....5eFFFEe5....',
      '....5EEEEEE5....',
      '....5EEEEEE5....',
      '...995EEEE599...',
      '..9wuwWWWWwuw9..',
      '..9uuuwwwwuuu9..',
      '..5Eddggggd2E5..',
      '..5edGgddgGde5..',
      '...2nN1221Nn2...',
      '...1nN2..2Nn1...',
      '...n1M....M1n...',
    ],
  },

  // Half-troll: fills the tile. Nothing else does.
  halfTroll: {
    down: [
      '................',
      '................',
      '.......88.......',
      '.....c8tt8c.....',
      '.....8tttt8.....',
      '....8cTttTc8....',
      '....8WkttkW8....',
      '....8tt88tt8....',
      '...998tttt899...',
      '..9wwwwwwwwww9..',
      '..999uWWWWu999..',
      '..9982dddd2899..',
      '..c8nNggggNn8c..',
      '....1M1221M1....',
      '....111..111....',
      '...n111..111n...',
    ],
    side: [
      '................',
      '................',
      '......c88c......',
      '....88ttttc.....',
      '....8cttTt8.....',
      '....8ctTTT8.....',
      '....8tttWk8.....',
      '....8tttttc.....',
      '...uu8ttt899....',
      '..9wWwwwuuwwu8..',
      '..9Wu9wWWWWw98..',
      '..9u99uuuwwu88..',
      '...cccnNd2gg8...',
      '....1nMMnnN1....',
      '...21NMn1NNNN...',
      '....11111111n...',
    ],
    up: [
      '................',
      '................',
      '......c88c......',
      '.....8tTTt8.....',
      '.....8TTTT8.....',
      '....8cttttc8....',
      '....8tttttt8....',
      '....8tttttt8....',
      '...998tttt899...',
      '..9wuwWWWWwuw9..',
      '..9uuuwwwwuuu9..',
      '..8tddggggd2t8..',
      '..8cdGgddgGdc8..',
      '...2nN1221Nn2...',
      '...1nN2..2Nn1...',
      '...n1M....M1n...',
    ],
  },
};

/* Painted over the race. '.' means "leave the race showing".
   Each kit owns rows 0–4 (what is on the head) and rows 10–15
   (what is on the body). Below row 4 a kit may only touch the
   two outermost columns on each side — cheek guards, the sides
   of a hood — so the eyes, the tusks and the beard are always
   the race's, whatever is worn over them. */
export const CLASS_KIT = {
  // 전사: a browed helm with cheek guards, pauldrons, a belt.
  warrior: {
    down: [
      '................',
      '.......DX.......',
      '.....XXLCXX.....',
      '....XCLLCCDX....',
      '....XLLLCCCX....',
      '....XCLCCCCX....',
      '....X......X....',
      '....XX....XX....',
      '..XXXX....XXXX..',
      '..XDDCXXXXDDXX..',
      '..XXXCLLCLDXXX..',
      '..DXXCCCCCDXXX..',
      '....XLDXXDLX....',
      '....XCX..XCX....',
      '....DC....CD....',
      '................',
    ],
    side: [
      '................',
      '....XXXXXD......',
      '....XDLLLLC.....',
      '....XLLLCCCX....',
      '....XLLLCCCX....',
      '....XCCCCCLX....',
      '....XCCCC..D....',
      '....XDCCD.......',
      '..XXXDDX..XX....',
      '..XDDDDDXXCLD...',
      '..XCDDDDCCCCX...',
      '..XXXXXDDDDDX...',
      '......XDDDLX....',
      '....XXXDDXCD....',
      '.....DXXXXC.....',
      '................',
    ],
    up: [
      '................',
      '.......DX.......',
      '.....DXLDXX.....',
      '....XLLLDCDX....',
      '....XLLLCCCX....',
      '....XLLLCCCX....',
      '....XCLLCCCX....',
      '....XCCCCCCX....',
      '..XXXCCCCDXXXX..',
      '..XDDCCLCLDXXX..',
      '..XXXCCCCCDDXX..',
      '..DXXDDCDDDXXX..',
      '....XLDXXDLX....',
      '....XCX..XCX....',
      '....DD....CD....',
      '................',
    ],
  },

  // 마법사: a pointed hat, a long robe, a staff down the side.
  mage: {
    down: [
      '................',
      '.....XXXXD......',
      '.....XDDDDX.....',
      '....XXDDDDXX....',
      '....XDDDDDDX....',
      '....XDDDDDDX....',
      '....D......X....',
      '......XXXX......',
      '...CCC....CCC...',
      '..DCCCXXXXCCCD..',
      '..XCCCLLLLCCCX..',
      '..CD.XXXXXX.DC..',
      '................',
      '................',
      '................',
      '................',
    ],
    side: [
      '................',
      '.....XXXXXX.....',
      '....XDDDDDX.....',
      '....XDDDDDDX....',
      '....XDDDDDDX....',
      '....XCDDDDDX....',
      '....XCCCC..X....',
      '....XXXXXXXX....',
      '...CLLX...XX....',
      '..DLLLLXXXCCD...',
      '..XLCDLLLLLCD...',
      '..XXXXXXXXXC....',
      '................',
      '................',
      '................',
      '................',
    ],
    up: [
      '................',
      '.....XXXXXX.....',
      '....XXDDDDX.....',
      '....XXDDDDXX....',
      '....XDDDDDDX....',
      '....XCCCCCDX....',
      '....XXXXXXXX....',
      '................',
      '...CXXXXXXXXC...',
      '..DCCLLLLLLCLD..',
      '..CXXXLLLLXXXC..',
      '......CXXC......',
      '................',
      '................',
      '................',
      '................',
    ],
  },

  // 사제: a hood and a pale mantle, a gold mark at the throat.
  priest: {
    down: [
      '................',
      '......XXXD......',
      '.....DLLLDD.....',
      '....XLLLCDDD....',
      '....XCLXXXCX....',
      '....XXX..XDX....',
      '....X......X....',
      '....XX...XDX....',
      '...LCXXXXXDDD...',
      '..DCCXXXDDDDDD..',
      '..XCXXXLCCDXCX..',
      '..DD.DXXXXD.DD..',
      '................',
      '................',
      '................',
      '................',
    ],
    side: [
      '................',
      '......XXXC......',
      '.....XXCCCC.....',
      '....XXDLLLLC....',
      '....XXDLLDDX....',
      '....XDDCCXXX....',
      '....XDDDX..D....',
      '....XDDDX..D....',
      '..XXXDCCDXXDX...',
      '..XDCCCCCCDCX...',
      '..XLDDCCCLLLD...',
      '..XXXXXXXXXC....',
      '................',
      '................',
      '................',
      '................',
    ],
    up: [
      '................',
      '......XXXX......',
      '.....DLLLLD.....',
      '....XLLLLCCD....',
      '....XLLLLCCX....',
      '....XDDLCCCX....',
      '....XXDCCDDX....',
      '....XXDCCXXX....',
      '...LXXXCCXXDD...',
      '..DCCXXXXDDDCX..',
      '..DXXXDDCDXXXD..',
      '......CXXC......',
      '................',
      '................',
      '................',
      '................',
    ],
  },

  // 도적: a low dark hood, a wrap, a knife at the hip.
  rogue: {
    down: [
      '................',
      '......DXXC......',
      '.....CLLLLD.....',
      '....DCLCLCDD....',
      '....XCLXXDDX....',
      '....XCD..XXX....',
      '....X......X....',
      '....XX...XDX....',
      '...LCDXXXXDDD...',
      '..CCCDXXDDDDDD..',
      '..XXXDCLCCCXCX..',
      '..DXXDCLLCX.DX..',
      '.....XXXXXX.....',
      '................',
      '................',
      '................',
    ],
    side: [
      '................',
      '......DXXL......',
      '.....XDDCLC.....',
      '....XXDCLLLL....',
      '....XXDCCCCX....',
      '....XDDCCXXX....',
      '....XDDDX..D....',
      '....XDDDX..C....',
      '..XXDDLCDXXDX...',
      '..XDDCCCCCDDX...',
      '..XCDXCCLLLLX...',
      '..XXXXCCLLLDX...',
      '......XXXXXX....',
      '................',
      '................',
      '................',
    ],
    up: [
      '................',
      '......CXXC......',
      '.....LLLLLD.....',
      '....CLLLLCCD....',
      '....XLCCCCCX....',
      '....XDDCCDDX....',
      '....XXDCCXXX....',
      '....XXDCCXXX....',
      '...LDXXCCXXDD...',
      '..CLCCXXXDDDDD..',
      '..DXXCDDDDDDDD..',
      '.....XCCCCDX....',
      '....XXXXXXXX....',
      '................',
      '................',
      '................',
    ],
  },

  // 레인저: a green hood, a quiver of arrows over the shoulder.
  ranger: {
    down: [
      '................',
      '....CXXXXXXX....',
      '....XCCDDDXX....',
      '....XCCDDDDX....',
      '....XDDDDDDX....',
      '....XXXXXXXX....',
      '....X......X....',
      '................',
      '...CXC....CXC...',
      '....XLXXXXLX....',
      '....XCLLLLCD....',
      '....XCCLLCX.....',
      '.....DXXXXD.....',
      '................',
      '................',
      '................',
    ],
    side: [
      '................',
      '....DXXXXXX.....',
      '....XDDDDDXX....',
      '....XDDCCCXX....',
      '....XCDXXXXX....',
      '....XXX....X....',
      '....XX..........',
      '....X...........',
      '...DXXX...CC....',
      '..XXXXCXXXLLD...',
      '.....XCLLLLLX...',
      '......XCLLLCX...',
      '......DXXXXD....',
      '................',
      '................',
      '................',
    ],
    up: [
      '................',
      '......XXXX......',
      '.....XDDXXX.....',
      '....XDCCCDDX....',
      '....XDCCCDDX....',
      '....XDDDDDCX....',
      '....XDDDDDCX....',
      '....XDDDDDCX....',
      '...CXXDDDDDXC...',
      '....XLLLLLLX....',
      '....CLLLLLLX....',
      '.....XCCCCCX....',
      '....XXXXXXXX....',
      '................',
      '................',
      '................',
    ],
  },

  // 팔라딘: a crested helm and a gilded breastplate.
  paladin: {
    down: [
      '................',
      '......XXXX......',
      '.....XCLCDX.....',
      '....XCLLCCDX....',
      '....XCLLCCCX....',
      '....XCLLCCDX....',
      '....X......X....',
      '....XX.XX.XX....',
      '..XXXX.XX.XXXX..',
      '..XDDCXLLXDXXX..',
      '..XXXCLLLLDXXX..',
      '..DXXDCCCDDXXD..',
      '....XLDXXDLX....',
      '....XCX..XCX....',
      '....DD....CD....',
      '................',
    ],
    side: [
      '................',
      '......DXXC......',
      '.....CLCCCC.....',
      '....XLLCCCLX....',
      '....XLLCCDLX....',
      '....XDDCCLLX....',
      '....XDDCC..X....',
      '....XDDDXXXX....',
      '..XXXDXX..XX....',
      '..XDDDDDXXCCD...',
      '..XCDXXDCLLCX...',
      '..XXXXXDDDDDX...',
      '......XLCXLX....',
      '....XXXCDDCD....',
      '.....DXXXXC.....',
      '................',
    ],
    up: [
      '................',
      '......XXXX......',
      '.....DLLCDX.....',
      '....XLLLCCDX....',
      '....XLLLCCCX....',
      '....XCCCCCCX....',
      '....CLCCCCCD....',
      '.....XCCCDX.....',
      '..XXXXXDXXXXXX..',
      '..XDDDLLCLDXXX..',
      '..XXDDCCCCDXXX..',
      '..DXXDDCCDDXXD..',
      '....XLDXXDLX....',
      '....XCX..XCX....',
      '....DD....CD....',
      '................',
    ],
  },
};



/* ── 무기 ──────────────────────────────────────────────────
   무기는 정사각형에 갇힐 이유가 없습니다. 단검과 창을 같은 칸에
   욱여넣으면 둘 다 어중간해집니다. 그래서 무기만 **16 × 32** 판에
   그리고, 종류마다 길이를 다르게 둡니다.

   자루는 언제나 **맨 아래 가운데**입니다. 그 한 점만 손에 맞추면
   길이가 얼마든 자리가 맞습니다 — 무기마다 자루 좌표를 따로 잡을
   필요가 없어집니다.

   그림은 세로로 세워 그립니다. 45도로 눕히면 방향을 돌릴 때마다
   45도가 남아 뭉개집니다. 세로면 회전이 전부 90도 배수입니다.

   `art` 는 아래에서부터 채워집니다. 짧은 무기는 짧게 적으면 됩니다. */
export const WEAPON_W = 16, WEAPON_H = 32;

/* ── 중심 규칙 ────────────────────────────────────────────
   16칸 판의 진짜 중심은 7열과 8열 **사이**입니다. 그러니 가로로
   놓이는 것은 전부 **짝수 칸**이어야 합니다. 홀수로 그리면 그
   요소만 반 칸 밀리고, 날 4칸에 자루 3칸이면 둘의 중심이 서로
   어긋납니다.

     2칸 → 7~8      4칸 → 6~9      6칸 → 5~10      8칸 → 4~11

   `grip` 은 자루가 그림 **아래에서 몇 번째 줄**인지입니다. 검처럼
   손잡이 끝을 쥐는 것은 0이고, 활처럼 한가운데를 쥐는 것은 그 중간
   값입니다. 이 값이 손 좌표에 맞춰집니다.                        */
export const WEAPON = {
  dagger: { grip: 0, art: [
    '......2222......',
    '......2WS2......',
    '......2WS2......',
    '......2WS2......',
    '......2WS2......',
    '....33yyyy33....',
    '......1MM1......',
    '......1MM1......',
    '......1nn1......',
    '.....33yy33.....',
  ] },
  wand: { grip: 0, art: [
    '......8888......',
    '.....8TTTT8.....',
    '.....8TWWT8.....',
    '.....8TTTT8.....',
    '......8888......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1nn1......',
    '......1111......',
  ] },
  mace: { grip: 0, art: [
    '.....2SSSS2.....',
    '....2SWWWWS2....',
    '...2SWWWWWWS2...',
    '....2SWWWWS2....',
    '.....2SSSS2.....',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1nn1......',
    '......1111......',
  ] },
  sword: { grip: 0, art: [
    '......2222......',
    '......2WS2......',
    '......2WS2......',
    '......2WS2......',
    '......2WS2......',
    '......2WS2......',
    '......2WS2......',
    '......2WS2......',
    '......2WS2......',
    '......2WS2......',
    '....33yyyy33....',
    '......3yy3......',
    '......1MM1......',
    '......1MM1......',
    '......1nn1......',
    '.....33yy33.....',
  ] },
  axe: { grip: 0, art: [
    '....22....22....',
    '...2SS2..2SS2...',
    '..2SWWS22SWWS2..',
    '..2SWWWWWWWWS2..',
    '..2SWWWWWWWWS2..',
    '...2SWWWWWWS2...',
    '....2SSWWSS2....',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1nn1......',
    '......1111......',
  ] },
  /* 활은 한가운데를 쥡니다. grip 이 절반이라 손이 시위 높이에 옵니다. */
  bow: { grip: 6, art: [
    '......1111......',
    '.....1nMM1......',
    '....1nMM1.ww....',
    '....1nMM1..w....',
    '...1nMM1...w....',
    '...1nMM1...w....',
    '...1nMM1...w....',
    '...1nMM1...w....',
    '...1nMM1...w....',
    '....1nMM1..w....',
    '....1nMM1.ww....',
    '.....1nMM1......',
    '......1111......',
  ] },
  great: { grip: 0, art: [
    '.....222222.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '...33yyyyyy33...',
    '......3yy3......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1nn1......',
    '.....33yy33.....',
  ] },
  spear: { grip: 0, art: [
    '......2222......',
    '......2WS2......',
    '.....2WWSS2.....',
    '.....2WWSS2.....',
    '......2SS2......',
    '......3yy3......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1MM1......',
    '......1nn1......',
    '......1111......',
  ] },
};

/* ── 손 ────────────────────────────────────────────────────
   무기를 16×16 격자로 또 그리고 있었습니다. 그러면 같은 칼을 두 번
   그리는 셈이고(아이템 아이콘 한 장, 손에 든 것 세 장), 무기를 하나
   추가할 때마다 세 장이 더 붙습니다.

   대신 **손이 어디 있는지**만 적어 둡니다. 그리는 쪽은 아이템
   스프라이트를 그대로 가져다 그 점에 자루를 맞춰 얹습니다. 무기가
   백 개로 늘어도 여기는 그대로입니다.

   x·y 는 **칸 안의 픽셀 좌표**(0~15)입니다. 비율로 두면 확대할 때
   반 픽셀이 생겨 그림이 뭉개지므로, 정수로 잡고 배율을 그대로
   곱합니다. rot 은 90도 단위여야 회전해도 뭉개지지 않습니다.
   under 는 몸보다 먼저 그릴지입니다.                            */
export const HAND = {
  // 무기는 세로로 세워 그려져 있으므로 회전이 전부 90도 배수입니다.
  //   아래·위 — 그대로. 날이 위로 뻗는다
  //   오른쪽   — 시계로 90도. 날이 앞(오른쪽)으로
  //   왼쪽     — 반시계로 90도. 날이 앞(왼쪽)으로
  // 오른손잡이라 정면에서는 화면 왼쪽, 등지면 화면 오른쪽에 옵니다.
  down:  { x: 3,  y: 12, rot: 0,             under: false },
  right: { x: 11, y: 11, rot:  Math.PI / 2,  under: false },
  left:  { x: 5,  y: 11, rot: -Math.PI / 2,  under: true  },
  up:    { x: 12, y: 12, rot: 0,             under: true  },
};

/* 자루의 가로 위치는 늘 중심선(7~8열 사이)이므로 8로 고정입니다.
   세로 위치는 무기마다 다르므로 gripY() 로 구합니다. */
export const GRIP = { x: WEAPON_W / 2 };
export const gripY = name => (gripYs.has(name) ? gripYs.get(name) : WEAPON_H - 1);

/* The class colour, and the shade one step under it. `C` and
   `D` in a grid are replaced with these at bake time, which is
   what lets one drawing serve six classes and still have a lit
   side and a shaded side. */
/* 바탕 · 그늘 · 외곽선 · 빛. 격자의 C·D·X·L 이 이 넷으로 바뀝니다.
   셋만 있을 때는 장비가 한 덩어리로 뭉쳐 보였습니다 — 갑옷이 갑옷으로
   읽히려면 어두운 면과 밝은 면이 둘 다 있어야 합니다. */
export const CLASS_TINT = {
  warrior: ['s', 'd', '2', 'S'],
  mage:    ['B', 'b', '6', 'I'],
  priest:  ['w', 'u', '9', 'W'],
  rogue:   ['g', 'd', 'k', 'G'],
  ranger:  ['E', 'e', '5', 'F'],
  paladin: ['y', 'o', '3', 'Y'],
};

/* One keeper per shop, so the six of them are not identical. */
export const SHOP_TINT = [
  ['E', 'e', '5', 'F'], ['s', 'd', '2', 'S'], ['R', 'r', '4', 'x'],
  ['w', 'u', '9', 'W'], ['P', 'p', '7', 'V'], ['B', 'b', '6', 'I'],
];

/* ── 보스 판 ──────────────────────────────────────────────
   타일은 16이지만 이름 있는 것들은 32로 그립니다. 발밑은 여전히 한
   칸이라 길찾기도 충돌도 그대로고, 그림만 위로 한 칸·좌우로 반 칸씩
   넘쳐 오릅니다. 마주쳤을 때 "크다"가 규칙이 아니라 눈으로 옵니다.

   tools/boss.mjs 가 이 블록을 통째로 다시 씁니다. */
export const BOSSES = {
  ogre: {
    down: [
      '................................',
      '...........1111111111...........',
      '..........1111nnnn11............',
      '...........11nnnnnn111..........',
      '........111nnnNNNNNNn1..........',
      '.........11nNNNNNNNNn1..........',
      '.........1nnnNnNNNNNn1..........',
      '.........1nnnnNnNNNnn11.........',
      '.........1nnnNnnnnNnn11.........',
      '........nN11nnn1nnNn11Nn........',
      '........1WkNNNNNNNNNNkW1........',
      '........1NNNNNN11NNNNNN1........',
      '........1NNNNNNNNNNNNNN1........',
      '........1NNNNNNNNNNNNNN1........',
      '........1NNNNNNNNNNNNNN1........',
      '.....99991NNNNNNNNNNNN19999.....',
      '....9wWWwuNNNNnnnnNNNNuwWWw9....',
      '....9wwuuuMNNNnnnnNNNMuuuww9....',
      '....1999MMMMMNNNNNNMMMMM9991....',
      '....1NNMMNNNMMMNNMMMNNNMMNN1....',
      '....1NNNn1nNNMMNNMMNNn1nNNN1....',
      '....1NMnn.1nnNNNNNNnn1.nnMN1....',
      '....1nMNn1uu9NNNNNN9uu1nNMn1....',
      '....1nNNnnuuuwwwwwwuuunnNNn1....',
      '.....11nnuwwWwwwwwwWwwunn11.....',
      '.......19uwwWwu99uwWwwu91.......',
      '........9WWWwu9..9uwWWW9........',
      '.......99WWww99..99wwWW99.......',
      '........9uuuu99..99uuuu9........',
      '.......1nNN9u9....9u9NNn1.......',
      '.......1NMMM1......1MMMN1.......',
      '.......n1111n......n1111n.......',
    ],
    side: [
      '................................',
      '............11111111............',
      '............11nnnnnn11..........',
      '..........1111nNNNNNn1..........',
      '..........11nnNNNNNNNN1.........',
      '..........1nnNNNNNNNNN11........',
      '.........11nnNNnMNNNnn11........',
      '........111nnnnnnnnnnnn1........',
      '........111nnnnnnnnnnnn1........',
      '.........111nnnnnnnnnnn1........',
      '........1NNNNNNNNNNNNWk1........',
      '........1NNNNNNNNNNNNNNn........',
      '........1NNNNNNNNNNNNNN1........',
      '........1NNNNNNNNNNNNNN1........',
      '........1NNNNNNNNNNNNNN1........',
      '.......991NNNNNNNNNNNN1.........',
      '........99wWWwNNnnnnnnnnn1......',
      '.......1N9wwwu9MMMMMNNNNN1......',
      '......1nN9uuu9MMMMMMMNNMMn1.....',
      '......1NMMNNMNNMMMMMMNNMMn1.....',
      '......1NMMNNMNNNNMMMNNNNn1......',
      '......1nNMNNNnnNNNNNNNNnn1......',
      '......11NMMNNnnNNNNNNNnnn11.....',
      '.......1nNMNNnnuuuuuuuu911......',
      '........n1NNNnuwwwwwWWWw9.......',
      '..........19uuwwwwuwwWWw9.......',
      '..........9uwwwwWwuwwWWu9.......',
      '.........99uwwwWWuuwwwuu9.......',
      '.........9uuwwwww99999991.......',
      '.........99uuuun9999NMNNNn......',
      '.........99nNNNNNnn111111n......',
      '...........n111111n.............',
    ],
    up: [
      '................................',
      '.............111111.............',
      '............11nnNn111...........',
      '...........1nnNNNNnn1...........',
      '.........11nNNNMMNnn11..........',
      '.........11nNNMMMNNnn11.........',
      '..........1nNNMMMNNnn11.........',
      '..........11nNMMNNNn111.........',
      '.........111nnMNNNnn111.........',
      '........n111nnNNNNnn111n........',
      '........1NNNNNNNNNNNNNN1........',
      '........1NNNNNNNNNNNNNN1........',
      '........1NNNNNNNNNNNNNN1........',
      '........1NNNNNNNNNNNNNN1........',
      '........1NNNNNNNNNNNNNN1........',
      '.....99991NNNNNNNNNNNN19999.....',
      '....9wWwwuMMMM111MMMMMuwwWw9....',
      '....9wWwuuMMMMMMMMMMMMuuwWw9....',
      '....1uuu9NNNNNMMMMNNNNN9uuu1....',
      '....1MMNn1NNNNNNNNNNNN1nNMM1....',
      '....1MNN1.1NNNNNNNNNN1.1NNM1....',
      '....1NNNn1uNNNNNNNNNNu1nNNN1....',
      '....1nNNN9uuuuuwwuuuuu9NNNn1....',
      '....1nNM9uwwwWWWWWWwwwu9MNn1....',
      '.....1119uwwwwwwwwwwwwu9111.....',
      '........9uwwwuu99uuwwwu9........',
      '.......9uWWWw99..99wWWWu9.......',
      '.......9wWWww99..99wwWWw9.......',
      '.......1nuuuu99..99uuuun1.......',
      '.......1nNMN99....99NMNn1.......',
      '.......nnNMN1......1NMNnn.......',
      '........11111......11111........',
    ],
  },
  wraith: {
    down: [
      '................................',
      '................................',
      '.............7777777............',
      '............7PPVVVPp7...........',
      '............7VPPPPPPpp..........',
      '...........PVVPPPPPPpp..........',
      '..........7PPPPPPPPPppp.........',
      '..........7PpPPPP77pppp7........',
      '.........PPPpPPPp77pppp7........',
      '.........7PPPPP7777pp7p7........',
      '........PPPPP77...7pp7p7........',
      '........7WkPPPPPPPPPPkW7........',
      '........7PPPPPP77PPPPPP7........',
      '........7PPPPPPPPPPPPPP7........',
      '........7PPPPPPPPPPPPPP7........',
      '........7PPPPPPPPPPPPPP7........',
      '.....99997PPPPPPPPPPPP7w999.....',
      '....wwWWu9Ppp77.77pppp9uWWww....',
      '....9Wwwu9Ppppp77ppppp9uwwW9....',
      '....9uuuuPppppp77pppppPuuuu9....',
      '....9999ppppp7777ppppppp9999....',
      '....7PPpppppp777pppppp77pPP7....',
      '....7VPp77ppPVVPPVVPpp77pPV7....',
      '....p77p.7ppPPVVVVPPpp7.p77p....',
      '..........p77PPPPPPP7p..........',
      '.............7777777............',
      '........V..............V........',
      '.......VVV............VVV.......',
      '......VVV7............7VVV......',
      '......VVV7............7VVV......',
      '.......VV7............7VV.......',
      '........V7V..........V7V........',
    ],
    side: [
      '................................',
      '............7777777P............',
      '...........ppppppPVPP...........',
      '..........77ppppPPPPPp..........',
      '..........77ppPPPPPPP7..........',
      '.........77pppPPPPPPVVp.........',
      '........77ppppPPVPPPPVPp........',
      '........77ppppPPVP777pV7........',
      '........77ppppPPVP7777P7........',
      '........77pppppPV7...7P7........',
      '........7PPPPPPPPPPPPWk7........',
      '........7PPPPPPPPPPPPPPp........',
      '........7PPPPPPPPPPPPPP7........',
      '........7PPPPPPPPPPPPPP7........',
      '........7PPPPPPPPPPPPPP7........',
      '.......9u7PPPPPPPPPPPP7.........',
      '....777uuWWWwpppPp777777........',
      '....7777uwwww9pPPPPpppp7........',
      '.....77p9uwwu9pPPPPppppp7.......',
      '.....77p9uuu9PPPPPPpp77P7.......',
      '.....77pPPPpPPPPPPp77VPp7.......',
      '.....7PVVPppPPPPVVVVVVPp7.......',
      '.....7pPVP7ppPPPPVVVVPp7........',
      '.....7pp77777pPPPVVVVP7.........',
      '......77.....pppPPP77p..........',
      '..............77777.............',
      '.......V........................',
      '......VVVV......................',
      '......VVVVV.....................',
      '......VVVV7.....................',
      '.......VVV7.....................',
      '........V77V....................',
    ],
    up: [
      '................................',
      '.............7777777............',
      '............7pPPPPPpp...........',
      '...........pPPPPPPPP7...........',
      '...........7PPPPPPPppp..........',
      '..........7PPPPPPPppppp.........',
      '.........7pPPpppPpppppp7........',
      '.........7ppppppPpppppp7........',
      '.........7pppppPPpp7ppp7........',
      '........ppppppppppp7ppp7........',
      '........7PPPPPPPPPPPPPP7........',
      '........7PPPPPPPPPPPPPP7........',
      '........7PPPPPPPPPPPPPP7........',
      '........7PPPPPPPPPPPPPP7........',
      '........7PPPPPPPPPPPPPP7........',
      '.....99997PPPPPPPPPPPP7w999.....',
      '....wwwWu9p777ppp777779uWWww....',
      '....9Wuuu9pp777pp777pp9uuuW9....',
      '....9uuu9ppp77777777ppp9uuu9....',
      '....7ppppppp7777777ppppppp77....',
      '....7ppp7777777777777777pp77....',
      '....p7777P7pppPPPPppp7p7777p....',
      '........7PPPppppppppPPP7........',
      '........7VVVPPPPPPPPPPP7........',
      '........7VVVVVVVVVVPPPP7........',
      '.......PVVVVVVVVVVVVPPPPP.......',
      '.......7VVVVVVVVVVVVPPPP7.......',
      '.......7VVVVVVVVVVVVPPPP7.......',
      '......PVVVVVVVVPPPVVVVVPPP......',
      '......PPPPPVVVVPPPVVVVVPPP......',
      '.......PPPPPVVVVPPVVPPPPP.......',
      '.........P777777777777P.........',
    ],
  },
  wyrm: {
    down: [
      '................................',
      '.............888888.............',
      '.............8tTTt8.............',
      '.............8TTTt8.............',
      '...........68cTTTTc86...........',
      '..........bb8tTTTTc8bb..........',
      '..........6b8tTTTtc8b6..........',
      '.........6Bb8ccTTcc8bB6.........',
      '.........6B68ccttcc86B6.........',
      '.........6Bb8ccttcc8bB6.........',
      '........6BBb8WkttkW8bBB6........',
      '........6BBB8tt88tt8BBB6........',
      '........6BbB8tttttt8BbB6........',
      '........6BbB8tttttt8BbB6........',
      '........6BbB8tttttt8BbB6........',
      '....6666bBBBb8tttt8bBBBb6666....',
      '....6II6BBBBbbTccTbbBBBB6II6....',
      '....6IIbbBBb66TttT66bBBbbII6....',
      '....6IIB6Bb6tTTttTTt6bB6BII6....',
      '....6IIB6668cttttttc8666BII6....',
      '....6IIIbb88cttttttc88bbIII6....',
      '....6BIIBbc8cttttttc8cbBIIB6....',
      '....6BIIBb68cttttttc86bBIIB6....',
      '.....6IB66ccttttttttcc66BI6.....',
      '.....bbb888tttc88cttt888bbb.....',
      '......b6..8ttt8..8ttt8..6b......',
      '.......6..8ctc8..8ctc8..6.......',
      '..........8ct8....8tc8..........',
      '..........8tt8....8tt8..........',
      '.........8tTT8....8TTt8.........',
      '.........8TTT8....8TTT8.........',
      '.........8888c....c8888.........',
    ],
    side: [
      '................................',
      '..............888888............',
      '..............8tTTtc8...........',
      '.............8ctttttc8..........',
      '............68ctcccttc8.........',
      '...........b68cttcctttc8........',
      '...........66cttTtctttc8........',
      '..........bB6cTTTttttt88........',
      '.........6BBb8tTTtttcc88........',
      '.........6BBb6ctTTtcc888........',
      '.........6Bbb8tttttttWk8........',
      '........6BBbb8tttttttttc........',
      '........6BBbb8ttttttttt8........',
      '........6IBbb8ttttttttt8........',
      '........6IBbb8ttttttttt8........',
      '....66666IBbbb8ttttttt8.........',
      '....6BIB6bbbbbbbbTTTTttt8.......',
      '....6BIB6bbbbbbbbTTTTttt8.......',
      '....6BIIBbbbbb6tcTTTTttt8.......',
      '....6BIIBbbb6TTccctTccc88.......',
      '....6BIIIbbbTTccctttccc88.......',
      '....6BIIIB66TTt8cttttcc88.......',
      '....6BIIIBbbtTt88ttttcc88.......',
      '.....6BIBB666TTccttttcc8........',
      '.....6BBB6..8ccccttcccc8........',
      '......bB6....8cTTtt8tt8.........',
      '.......b6....8cTTtc8tc8.........',
      '........6....8cttccctc8.........',
      '.............8ctt88cttc88.......',
      '............88ctt888tTT88.......',
      '.............8cttt8888888.......',
      '..............888888............',
    ],
    up: [
      '................................',
      '.............888888.............',
      '.............8cTtc8.............',
      '.............8TTTt8.............',
      '............8cTTTtc8............',
      '...........68tTTTTc86...........',
      '..........6b8tTTTTc8b6..........',
      '..........6b8tTTTtc8b6..........',
      '.........bbb8ctTTtc8bbb.........',
      '.........6bb8ctTTtc8bb6.........',
      '.........6bb8tttttt8bb6.........',
      '........6Bbb8tttttt8bbB6........',
      '........6BbB8tttttt8BbB6........',
      '........6BbB8tttttt8BbB6........',
      '........6BbI8tttttt8IbB6........',
      '....6666bBbIB8tttt8BIbBb6666....',
      '....6BB6BIIIIIttttIIIIIB6BB6....',
      '....6BB6BIIIBBttttBBIIIB6BB6....',
      '....6BIbbBBbttttttttbBBbbIB6....',
      '....6BIBbBB6cttttttc6BBbBIB6....',
      '....6BIBbbB6tttccttt6BbbBIB6....',
      '....6BIIbbb6TTtcctTT6bbbIIB6....',
      '....6BIIBb66tTTccTTt66bBIIB6....',
      '.....6II666ccccTTcccc666II6.....',
      '.....6B6..8tcccttccct8..6B6.....',
      '.....6b6..8tcccttccct8..6b6.....',
      '......b6..8ccccctcccc8..6b......',
      '.......6.88ccc8cccccc88.6.......',
      '.........8cttccccccttc8.........',
      '.........8ttt8cc888ttt8.........',
      '..........ccc8888.8ccc..........',
      '...........88888...88...........',
    ],
  },
  balemperor: {
    down: [
      '................................',
      '................................',
      '................................',
      '...............oo...............',
      '..............oyyo..............',
      '.............3oYYo3.............',
      '.........3....oyyo....3.........',
      '........yYy....33....yYy........',
      '........3YY3..3oo3..3YY3........',
      '........yYy3..3yy3..3yYy........',
      '.........3oy33oyyo33yo3.........',
      '.........3oooooyyooooo3.........',
      '........3WkRRRRRRRRRRkW3........',
      '........3RRRRRR44RRRRRR3........',
      '........3RRRRRRRRRRRRRR3........',
      '........3RRRRRRRRRRRRRR3........',
      '........3RRRRRRRRRRRRRR3........',
      '.........3RRRRRRRRRRRR3.........',
      '.......333444444444444333.......',
      '......3ooyo3r444444r3oyoo3......',
      '....333yyyoyYYYyyyYyooyoo333....',
      '....3ooooooyYYYYYYYyyoooo333....',
      '....3yYo33yyyyYYyyyyyo33oyo3....',
      '....3ooo33oyyyyyyyyyoo33oyo3....',
      '....4ooRrrooyyyyyooooorrR334....',
      '....4rRRrryYy3oooooyYyrrRRr4....',
      '.....44rrrYYY333333YYYrrr44.....',
      '.......4xRYyo34..43oyyRx4.......',
      '.......4xxyo34....43oyxx4.......',
      '.......4RRR33......33RRR4.......',
      '.......4RrxxR4....4RxxrR4.......',
      '.......r4444R......R4444r.......',
    ],
    side: [
      '................................',
      '................................',
      '................................',
      '................yy..............',
      '...............oYYy.............',
      '..............3oYYy3............',
      '.........3.....3YYy...3.........',
      '........yyy....3o3...yyy........',
      '........3Yy3..3ooo3.3yy3........',
      '........3Yy3..3oyy3.3yy3........',
      '........3ooy33ooyyY3oyy3........',
      '........3ooyyooyyyyyoyy3........',
      '........3RRRRRRRRRRRRWk3........',
      '........3RRRRRRRRRRRRRRr........',
      '........3RRRRRRRRRRRRRR3........',
      '........3RRRRRRRRRRRRRR3........',
      '........3RRRRRRRRRRRRRR3........',
      '.........3RRRRRRRRRRRR3.........',
      '........3333....................',
      '......33oooo33.........33.......',
      '....333ooyyooo333333333yy334....',
      '....3333o3ooooooYYYYYYyYYo34....',
      '....3oyyo3333oooyyyyYYyyyo34....',
      '....3oyyyo333oooyyyyyyyyyo34....',
      '....33ooxRR33oooooooooooo344....',
      '.....4rxxxRR3oYYYyooooYyo344....',
      '.....4RxrrRrooYYYYooyYYYy3......',
      '.....4RxRrooooooyoooyyyo3.......',
      '.....rRxRRyyyoo3333oyYo33.......',
      '......rRRRrryo334433xxRrr4r.....',
      '.......4rrrRxxrrr44444444444....',
      '........444444444444............',
    ],
    up: [
      '................................',
      '................................',
      '................................',
      '...............oo...............',
      '..............oyyo..............',
      '.............33yy33.............',
      '.........3.....33.....3.........',
      '........oy33..3oo3..33yo........',
      '........oyo3..3yy3..3oyo........',
      '.........3oy33YYYY33yo3.........',
      '.........3oyyyYYYYyyyo3.........',
      '........33oyyyyyyyyyyo33........',
      '........3yyyyyyyyyyyyyy3........',
      '........3yyyyyyyyyyyyyy3........',
      '........3yyyyyyyyyyyyyy3........',
      '........3yyyyyyyyyyyyyy3........',
      '........3yyyyyyyyyyyyyy3........',
      '.........3yyyyyyyyyyyy3.........',
      '......3333444......4443333......',
      '.....33yy4rrr444444rrr4yy33.....',
      '....33oyy4rrRRRrrRRrrr4yyo33....',
      '....3ooyy4rrRRxxRRRrrr4oooo3....',
      '....3YYo34RRRRxxRRRrrr43yYy3....',
      '....3yYo4rRxxRRRRRrrrr44yYy3....',
      '....4oox4RxxxRRrrrrrrr44xoo4....',
      '.....4444RxxxxRRRRRrrrr4444.....',
      '......44rxxxxxxxxRRrrrr444......',
      '.......4RxxxRRRRRRRrrrrr4.......',
      '.......4RRRxxRRRRRRRRRrr4.......',
      '.......4RRRRRRRRrrRRRRrr4.......',
      '.......4rrrrRRRRrrRRrrrr4.......',
      '.......444444444444444444.......',
    ],
  },
};

export const VIEWS = ['down', 'side', 'up'];

const CELL = 16;
const LEG_TOP = 14;
const baked = new Map();

/* ── the baker ────────────────────────────────────────────
   ImageData rather than a fillRect per pixel: three hundred
   odd hero combinations is eighty thousand cells, and eighty
   thousand fillRects at boot is a visible hitch on a phone.  */
const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    v = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    rgbCache.set(hex, v);
  }
  return v;
}

const DEFAULT_TINT = ['s', 'd', '2', 'S'];

/* ── 격자의 크기는 격자가 정한다 ──────────────────────────
   타일은 16이지만 배우는 32입니다. 굽는 쪽에서 크기를 상수로
   박아 두면 둘이 공존할 수 없으므로, 격자를 보고 알아냅니다.
   16짜리 그림은 예전 그대로 16으로 구워집니다.              */
const sizeOf = grid => Math.max(grid.length, ...grid.map(l => l.length));

/* 16짜리 옛 그림을 32 판에 올릴 때. 다시 그리기 전까지의 다리이며,
   픽셀이 두 배로 굵어 보이는 것은 아직 손대지 않았다는 표시입니다. */
function upscale2(grid) {
  const out = [];
  for (const line of grid) {
    let big = '';
    for (const ch of line) big += ch + ch;
    out.push(big, big);
  }
  return out;
}
const fit = (grid, n) => (grid.length === n ? grid : grid.length * 2 === n ? upscale2(grid) : grid);

function bakeGrid(grid, tint, flip = false) {
  const [base, shade, edge, lit] = tint || DEFAULT_TINT;
  const n = sizeOf(grid);
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const x = c.getContext('2d');
  const img = x.createImageData(n, n);
  const px = img.data;
  for (let row = 0; row < n; row++) {
    const line = grid[row] || '';
    for (let col = 0; col < n; col++) {
      let ch = line[flip ? n - 1 - col : col] || '.';
      if (ch === 'C') ch = base;
      else if (ch === 'D') ch = shade;
      else if (ch === 'X') ch = edge;
      else if (ch === 'L') ch = lit;
      const color = PALETTE[ch];
      if (!color) continue;
      const [r, g, b] = rgb(color);
      const o = (row * n + col) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/* Race under, class over. Any cell the kit leaves as '.' shows
   the body beneath, which is why the face survives the helmet. */
function merge(body, kit) {
  const n = Math.max(sizeOf(body), sizeOf(kit));
  const B = fit(body, n), K = fit(kit, n);
  const out = [];
  for (let row = 0; row < n; row++) {
    let line = '';
    for (let col = 0; col < n; col++) {
      const over = (K[row] || '')[col] || '.';
      line += over !== '.' ? over : ((B[row] || '')[col] || '.');
    }
    out.push(line);
  }
  return out;
}

/* The second walk frame. Only the bottom leg rows move: mirrored,
   the forward foot becomes the trailing one. It is one pixel of
   difference and it is the whole reason a walk reads as a walk
   rather than as a slide. */
function stepFrame(grid) {
  const n = sizeOf(grid);
  const out = grid.slice();
  for (let row = Math.round(n * LEG_TOP / CELL); row < n; row++) {
    const line = (grid[row] || '').padEnd(n, '.');
    out[row] = [...line].reverse().join('');
  }
  return out;
}

const viewOf = (src, view) => (Array.isArray(src) ? src : src[view] || src.down);

/* 무기는 16×32 판이라 정사각형 굽는 함수를 못 씁니다. `art` 는
   아래에서부터 채워지므로 짧은 무기는 짧게 적으면 됩니다. */
const gripYs = new Map();
function bakeWeapon(name, w) {
  /* 32폭으로 그렸으면 그대로, 16폭이면 두 배로. 쥐는 행도 같은
     배율로 따라가야 손 위치가 어긋나지 않습니다. */
  const step = Math.max(...w.art.map(l => l.length)) > WEAPON_W / 2 ? 1 : 2;
  const art = step === 1 ? w.art : upscale2(w.art);
  gripYs.set(name, WEAPON_H - step - step * (w.grip || 0));
  const c = document.createElement('canvas');
  c.width = WEAPON_W; c.height = WEAPON_H;
  const x = c.getContext('2d');
  const img = x.createImageData(WEAPON_W, WEAPON_H);
  const px = img.data;
  const top = WEAPON_H - art.length;
  for (let row = 0; row < art.length; row++) {
    const line = art[row];
    for (let col = 0; col < WEAPON_W; col++) {
      const color = PALETTE[line[col] || '.'];
      if (!color) continue;
      const [r, g, b] = rgb(color);
      const o = ((row + top) * WEAPON_W + col) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/* ── 배우 판 크기 ─────────────────────────────────────────
   타일도 배우도 16입니다. 굽는 쪽은 격자를 보고 크기를 알아내므로
   이 값만 바꾸면 전부 따라오지만, 지금은 16을 지킵니다. */
export const ACTOR_N = 16;
const ACTORS = new Set([
  'hero', 'rat', 'lean', 'bat', 'snake', 'spider', 'mold', 'jelly', 'kobold',
  'orc', 'dog', 'ogre', 'troll', 'giant', 'wraith', 'mummy', 'vampire', 'lich',
  'dragon', 'wyrm', 'ashhound', 'warden', 'ashen', 'emberpriest', 'balemperor',
  'thief', 'mimic', 'keeper',
]);

export function bakeAll() {
  for (const [name, w] of Object.entries(WEAPON))
    baked.set(`weapon:${name}`, bakeWeapon(name, w));

  /* ── 층 ────────────────────────────────────────────────
     맨몸 · 직업장비 · 무기를 **각각 따로** 굽습니다. 예전에는 격자
     글자를 덮어쓰는 방식이라 직업 장비가 몸의 픽셀을 지우고 들어갔고,
     그래서 층 순서를 방향마다 바꿀 수가 없었습니다. 따로 구워 두면
     그리는 쪽에서 순서를 정할 수 있습니다.                      */
  for (const race of Object.keys(RACE_BODY)) {
    for (const view of VIEWS) {
      const g = fit(viewOf(RACE_BODY[race], view), ACTOR_N);
      if (view === 'side') {
        baked.set(`race:${race}:right`, bakeGrid(g));
        baked.set(`race:${race}:left`,  bakeGrid(g, null, true));
      } else {
        baked.set(`race:${race}:${view}`, bakeGrid(g));
      }
    }
  }
  for (const cls of Object.keys(CLASS_KIT)) {
    const tint = CLASS_TINT[cls];
    for (const view of VIEWS) {
      const g = fit(viewOf(CLASS_KIT[cls], view), ACTOR_N);
      if (view === 'side') {
        baked.set(`kit:${cls}:right`, bakeGrid(g, tint));
        baked.set(`kit:${cls}:left`,  bakeGrid(g, tint, true));
      } else {
        baked.set(`kit:${cls}:${view}`, bakeGrid(g, tint));
      }
    }
  }

  /* 합성본은 남겨 둡니다 — 캐릭터 생성 미리보기와 결말 화면은 한 장을
     원하고, 거기서는 층 순서가 문제되지 않습니다. */
  for (const race of Object.keys(RACE_BODY)) {
    for (const cls of Object.keys(CLASS_KIT)) {
      const tint = CLASS_TINT[cls];
      for (const view of VIEWS) {
        const g = fit(merge(viewOf(RACE_BODY[race], view), viewOf(CLASS_KIT[cls], view)), ACTOR_N);
        [g, stepFrame(g)].forEach((f, i) => {
          if (view === 'side') {
            baked.set(`hero:${race}:${cls}:right:${i}`, bakeGrid(f, tint));
            baked.set(`hero:${race}:${cls}:left:${i}`,  bakeGrid(f, tint, true));
          } else {
            baked.set(`hero:${race}:${cls}:${view}:${i}`, bakeGrid(f, tint));
          }
        });
      }
      // The plain key the character sheet and the save preview ask for.
      baked.set(`hero:${race}:${cls}`, baked.get(`hero:${race}:${cls}:down:0`));
    }
  }

  /* ── 보스는 크다 ────────────────────────────────────────
     타일은 16이고 보스 그림은 32입니다. 발밑은 여전히 한 칸이라
     길찾기도 충돌도 그대로고, 그림만 위로 한 칸 넘쳐 오릅니다.
     이름 있는 것과 대군주만 이 판을 찾습니다.               */
  for (const [name, grid] of Object.entries(BOSSES)) {
    for (const view of VIEWS) {
      const g = viewOf(grid, view);
      if (view === 'side') {
        baked.set(`boss:${name}:right`, bakeGrid(g));
        baked.set(`boss:${name}:left`, bakeGrid(g, null, true));
      } else {
        baked.set(`boss:${name}:${view}`, bakeGrid(g));
      }
    }
    baked.set(`boss:${name}`, baked.get(`boss:${name}:down`));
  }

  for (const [name, grid] of Object.entries(SPRITES)) {
    if (name === 'hero') {
      // Kept as the fallback for anything that asks for a class
      // without naming a race — the ending screen, mostly.
      for (const [cls, tint] of Object.entries(CLASS_TINT))
        baked.set(`hero:${cls}`, bakeGrid(fit(grid, ACTOR_N), tint));
    } else if (name === 'keeper') {
      /* 상점 주인은 여섯 가게 색으로 여섯 번 굽습니다. 이제 방향
         묶음이므로 색 × 방향만큼 굽습니다 — 앞치마만 색이 바뀌고
         얼굴과 살빛은 여섯이 같습니다. */
      SHOP_TINT.forEach((tint, i) => {
        for (const view of VIEWS) {
          const g = fit(viewOf(grid, view), ACTOR_N);
          if (view === 'side') {
            baked.set(`keeper:${i + 1}:right`, bakeGrid(g, tint));
            baked.set(`keeper:${i + 1}:left`, bakeGrid(g, tint, true));
          } else {
            baked.set(`keeper:${i + 1}:${view}`, bakeGrid(g, tint));
          }
        }
        baked.set(`keeper:${i + 1}`, baked.get(`keeper:${i + 1}:down`));
      });
    } else if (!Array.isArray(grid)) {
      /* 방향을 가진 몬스터. 주인공과 같은 규칙이다 — 정면·옆·뒤를
         그리면 왼쪽은 옆을 뒤집어 만든다. */
      for (const view of VIEWS) {
        const g = fit(viewOf(grid, view), ACTOR_N);
        if (view === 'side') {
          baked.set(`${name}:right`, bakeGrid(g));
          baked.set(`${name}:left`,  bakeGrid(g, null, true));
        } else {
          baked.set(`${name}:${view}`, bakeGrid(g));
        }
      }
      // 방향을 묻지 않고 부르면 정면이 나온다.
      baked.set(name, baked.get(`${name}:down`));
    } else {
      baked.set(name, bakeGrid(ACTORS.has(name) ? fit(grid, ACTOR_N) : grid));
    }
  }
}

export const sprite = name => baked.get(name) || baked.get('rubble');
/* sprite() 는 없으면 rubble 을 돌려주므로 있는지 없는지는 이걸로
   묻습니다 — 보스가 큰 판을 가졌는지 확인할 때 씁니다. */
export const hasSprite = name => baked.has(name);

/* ── particle stock ───────────────────────────────────────
   When something dies we throw its own pixels across the
   floor, so a rat scatters brown and a jelly scatters violet.
   Read the grid, keep the opaque colours, cache the list.   */
const shardCache = new Map();
const OUTLINES = new Set(['k', 'q', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'm']);

export function spriteColors(name) {
  // hero:elf:mage:down:0 and hero:mage both scatter the same palette.
  const key = name.startsWith('hero') ? 'hero' : name.split(':')[0];
  if (shardCache.has(key)) return shardCache.get(key);
  const src = SPRITES[key];
  const grid = src && !Array.isArray(src) ? viewOf(src, 'down') : src;
  const out = [];
  if (grid) {
    /* Outline steps are excluded: a burst made of a thing's own
       outline is a burst of near-black, which reads as nothing
       at all against the floor. */
    for (const line of grid)
      for (const ch of line) {
        const c = PALETTE[ch];
        if (c && !OUTLINES.has(ch)) out.push(c);
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

/* ── the seven faces of the dungeon ───────────────────────
   Masonry used to be one grey everywhere, so floor 2 and floor
   12 were the same room with different monsters in it. Each
   theme owns a palette and a way of laying stone, and the floor
   announces where you are before a single word of log text
   does.

   `base`/`grain`/`mortar` are the body of the wall, `cap` is
   the lit top course that only shows where the rock is cut
   against open air, and `style` decides how the courses run. */
export const TERRAIN = {
  plain:   { base:'g', grain:'G', mortar:'2', cap:'G', lit:'S', edge:'q', floor:'d', dust:'g', style:'brick' },
  // 좁은 굴: hacked out rather than built. No courses at all.
  warren:  { base:'n', grain:'N', mortar:'1', cap:'N', lit:'M', edge:'1', floor:'n', dust:'1', style:'rough' },
  // 큰 방: dressed stone, wide courses, pale.
  hall:    { base:'G', grain:'S', mortar:'g', cap:'S', lit:'W', edge:'2', floor:'g', dust:'G', style:'ashlar' },
  // 빛이 없는 층: everything a step darker; the grain barely reads.
  dark:    { base:'d', grain:'g', mortar:'2', cap:'g', lit:'G', edge:'k', floor:'q', dust:'d', style:'brick' },
  // 물에 잠긴 층: wet blue stone, streaked downward.
  flooded: { base:'b', grain:'B', mortar:'6', cap:'B', lit:'I', edge:'6', floor:'d', dust:'b', style:'streak' },
  // 소굴: chitin and old web over the stone.
  nest:    { base:'p', grain:'P', mortar:'7', cap:'P', lit:'V', edge:'7', floor:'d', dust:'p', style:'rough' },
  // 마을: not masonry at all — hedge and grass under open sky.
  town:    { base:'e', grain:'E', mortar:'5', cap:'F', lit:'F', edge:'5', floor:'e', dust:'E', style:'leaf' },
};

let terrainTheme = 'plain';
/* Called by the renderer when the floor changes. Cheap: the
   cache is keyed by theme so walking back up is instant. */
export function setTerrainTheme(id) {
  terrainTheme = TERRAIN[id] ? id : 'plain';
}
export const themeId = () => terrainTheme;

/* Mask bits, in the order the renderer packs them. */
export const N_WALL = 1, E_WALL = 2, S_WALL = 4, W_WALL = 8;

function ctxOf(c) {
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return x;
}

/* ── walls, cut against their neighbours ──────────────────
   The old wall was one speckled square repeated everywhere, so
   a room boundary was a change of colour and nothing else — no
   edge, no thickness, no direction of light. A wall that knows
   which of its four sides is open can do all three: a lit cap
   on top where it meets air, a hard dark lip at the bottom,
   and shaded returns down the open sides. That single change
   is most of the difference between "a grid of grey" and "a
   room with rock around it".                                 */
function bakeWall(variant, mask) {
  const theme = terrainTheme;
  const key = `${theme}:wall:${variant}:${mask}`;
  const hit = terrainCache.get(key);
  if (hit) return hit;

  const T = TERRAIN[theme] || TERRAIN.plain;
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = ctxOf(c);
  let rs = (variant * 2654435761 + theme.length * 7919) % 2147483647;
  const rr = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  x.fillStyle = PALETTE[T.base]; x.fillRect(0, 0, CELL, CELL);

  x.fillStyle = PALETTE[T.grain];
  const grains = T.style === 'leaf' ? 26 : 14;
  for (let i = 0; i < grains; i++) {
    const gw = T.style === 'leaf' ? 2 : 1;
    x.fillRect((rr() * CELL) | 0, (rr() * CELL) | 0, gw, gw);
  }

  x.fillStyle = PALETTE[T.mortar];
  if (T.style === 'brick') {
    // Running bond: two courses, staggered head joints.
    x.fillRect(0, variant % 2 ? 5 : 6, CELL, 1);
    x.fillRect(0, variant % 2 ? 12 : 13, CELL, 1);
    x.fillRect(variant % 2 ? 4 : 10, 0, 1, 6);
    x.fillRect(variant % 2 ? 11 : 5, 7, 1, 6);
    x.fillRect(variant % 2 ? 3 : 9, 14, 1, 2);
  } else if (T.style === 'ashlar') {
    // Big dressed blocks: joints lined up, one deep course.
    x.fillRect(0, 7, CELL, 1);
    x.fillRect(0, 15, CELL, 1);
    x.fillRect(variant % 2 ? 6 : 11, 0, 1, 7);
    x.fillRect(variant % 2 ? 11 : 6, 8, 1, 7);
  } else if (T.style === 'streak') {
    // Water has been running down this for a long time.
    for (let i = 0; i < 5; i++)
      x.fillRect((rr() * CELL) | 0, (rr() * 6) | 0, 1, 5 + ((rr() * 9) | 0));
  } else if (T.style === 'leaf') {
    // Hedge: clumps rather than courses, each with a lit crown.
    for (let i = 0; i < 9; i++) {
      const lx = (rr() * CELL) | 0, ly = (rr() * CELL) | 0;
      x.fillStyle = PALETTE[T.mortar]; x.fillRect(lx, ly + 1, 3, 2);
      x.fillStyle = PALETTE[T.grain];  x.fillRect(lx, ly, 3, 2);
      x.fillStyle = PALETTE[T.cap];    x.fillRect(lx, ly, 1, 1);
    }
  } else {
    // rough: no courses, just broken edges and bite marks.
    for (let i = 0; i < 12; i++)
      x.fillRect((rr() * CELL) | 0, (rr() * CELL) | 0, 1 + ((rr() * 3) | 0), 1);
  }

  /* ── the cut edges ────────────────────────────────────
     Top open → a lit cap two rows deep with a hard line above
     it, because that is the face the lamp actually reaches.
     Bottom open → the underside goes to the outline colour, so
     the rock has a bottom rather than fading into the floor.
     Sides open → one column of shadow, one of outline.       */
  const K = PALETTE[T.edge];
  if (!(mask & N_WALL)) {
    x.fillStyle = PALETTE[T.cap]; x.fillRect(0, 1, CELL, 2);
    x.fillStyle = PALETTE[T.lit]; x.fillRect(0, 1, CELL, 1);
    x.fillStyle = K;              x.fillRect(0, 0, CELL, 1);
  }
  if (!(mask & S_WALL)) {
    x.fillStyle = PALETTE[T.mortar]; x.fillRect(0, CELL - 3, CELL, 2);
    x.fillStyle = K;                 x.fillRect(0, CELL - 1, CELL, 1);
  }
  if (!(mask & W_WALL)) {
    x.fillStyle = PALETTE[T.mortar]; x.fillRect(1, 0, 1, CELL);
    x.fillStyle = K;                 x.fillRect(0, 0, 1, CELL);
  }
  if (!(mask & E_WALL)) {
    x.fillStyle = PALETTE[T.mortar]; x.fillRect(CELL - 2, 0, 1, CELL);
    x.fillStyle = K;                 x.fillRect(CELL - 1, 0, 1, CELL);
  }
  /* Outside corners: without these the two straight edges meet
     in a square notch that reads as a mistake. */
  x.fillStyle = K;
  if (!(mask & N_WALL) && !(mask & W_WALL)) x.fillRect(0, 0, 2, 2);
  if (!(mask & N_WALL) && !(mask & E_WALL)) x.fillRect(CELL - 2, 0, 2, 2);
  if (!(mask & S_WALL) && !(mask & W_WALL)) x.fillRect(0, CELL - 2, 2, 2);
  if (!(mask & S_WALL) && !(mask & E_WALL)) x.fillRect(CELL - 2, CELL - 2, 2, 2);

  terrainCache.set(key, c);
  return c;
}

function bakeFloor(variant) {
  const theme = terrainTheme;
  const key = `${theme}:floor:${variant}`;
  const hit = terrainCache.get(key);
  if (hit) return hit;

  const T = TERRAIN[theme] || TERRAIN.plain;
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = ctxOf(c);
  let rs = (variant * 40503 + theme.length * 7919 + 17) % 2147483647;
  const rr = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  x.fillStyle = PALETTE[T.floor]; x.fillRect(0, 0, CELL, CELL);

  if (T.style === 'leaf') {
    /* Grass, not flagstones: short blades at two values, dense
       enough to read as ground cover at any zoom. */
    for (let i = 0; i < 22; i++) {
      x.fillStyle = rr() < 0.5 ? PALETTE[T.dust] : PALETTE[T.lit];
      x.fillRect((rr() * CELL) | 0, (rr() * CELL) | 0, 1, 2);
    }
  } else {
    // Flagstones: a faint joint, then dust in the middle of it.
    x.fillStyle = PALETTE[T.dust];
    for (let i = 0; i < 9; i++) x.fillRect((rr() * CELL) | 0, (rr() * CELL) | 0, 1, 1);
    if (T.style === 'ashlar' || T.style === 'brick') {
      x.globalAlpha = 0.45;
      if (variant % 2) x.fillRect(0, 8, CELL, 1); else x.fillRect(8, 0, 1, CELL);
      x.globalAlpha = 1;
    }
    if (T.style === 'rough' || T.style === 'streak') {
      x.fillStyle = PALETTE[T.grain];
      if (rr() < 0.5) x.fillRect((rr() * CELL) | 0, (rr() * CELL) | 0, 2, 1);
    }
  }
  terrainCache.set(key, c);
  return c;
}

/* The shadow a wall throws onto the floor below it. Drawn by
   the renderer on any floor tile with rock immediately above —
   this is what stops a room from looking like a flat sheet of
   tiles with a different colour stuck to one edge. */
let shadowCv = null;
export function shadowTile() {
  if (shadowCv) return shadowCv;
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = ctxOf(c);
  const h = Math.round(CELL * 0.45);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(4,4,10,0.66)');
  g.addColorStop(1, 'rgba(4,4,10,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, CELL, h);
  shadowCv = c;
  return c;
}

/* The soft disc an actor stands on. Without it a sprite looks
   pasted onto the floor rather than standing on it. */
let dropCv = null;
export function dropShadow() {
  if (dropCv) return dropCv;
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = ctxOf(c);
  x.fillStyle = 'rgba(4,4,10,0.34)';
  x.beginPath();
  x.ellipse(CELL / 2, CELL - 2, CELL * 0.34, CELL * 0.11, 0, 0, Math.PI * 2);
  x.fill();
  dropCv = c;
  return c;
}

export const wallTile  = (x, y, mask = 0) => bakeWall(1 + ((hash(x, y) * 4) | 0), mask & 15);
export const floorTile = (x, y) => bakeFloor(1 + ((hash(x, y) * 6) | 0));
export const CELL_SIZE = CELL;

/* ── 양피지 ───────────────────────────────────────────────
   The one surface in the game that is meant to be *read* rather
   than watched, so it gets a page rather than a panel.

   No image files here either: the fibre is a hash over the same
   deterministic noise the terrain uses, so two runs draw the same
   sheet and it tiles without a seam. Kept deliberately low in
   contrast — this is paper for text to sit on, and a texture you
   notice while reading is a texture that failed. */
const PARCH = 96;
let parchCache = null;

export function parchmentTile() {
  if (parchCache) return parchCache;
  const cv = document.createElement('canvas');
  cv.width = PARCH; cv.height = PARCH;
  const c = cv.getContext('2d');
  c.fillStyle = '#d8cba6';                            // the leaf itself
  c.fillRect(0, 0, PARCH, PARCH);
  /* Fibre: short horizontal strokes at two weights, wrapped so
     the tile meets itself on every edge. */
  for (let i = 0; i < 900; i++) {
    const h = hash(i * 7 + 1, i * 13 + 5);
    const x = (h * PARCH) | 0, y = ((hash(i * 3, i * 11) * PARCH) | 0);
    const len = 1 + ((hash(i, i) * 4) | 0);
    const dark = hash(i * 5, i * 2) < 0.45;
    c.fillStyle = dark ? 'rgba(120,96,58,0.16)' : 'rgba(255,246,214,0.22)';
    for (let k = 0; k < len; k++) c.fillRect((x + k) % PARCH, y, 1, 1);
  }
  /* A few age spots, sparse enough to read as paper and not as
     dirt on the screen. */
  for (let i = 0; i < 26; i++) {
    const x = (hash(i * 17, 3) * PARCH) | 0, y = (hash(5, i * 19) * PARCH) | 0;
    const r = 1 + ((hash(i, i * 2) * 3) | 0);
    c.fillStyle = 'rgba(146,112,64,0.10)';
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  parchCache = cv;
  return cv;
}

export const parchmentURL = () => parchmentTile().toDataURL();

/* The torn top and bottom of a sheet, drawn once at a given width
   and used as a mask-free decoration strip. Height is fixed; the
   caller stretches horizontally, which is invisible at this
   contrast. */
export function deckle(w, flip = false) {
  const H = 8;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = H;
  const c = cv.getContext('2d');
  /* Filled with the sheet itself rather than a flat colour, or
     the torn strip reads as a separate pale ribbon sitting above
     the page instead of as the page's own edge. */
  c.fillStyle = c.createPattern(parchmentTile(), 'repeat');
  /* Two frequencies added together: the low one gives the long
     wave a hand-torn edge has, the high one gives the fibre. One
     frequency alone looks combed. */
  for (let x = 0; x < w; x++) {
    const low = hash((x / 11) | 0, flip ? 9 : 4);
    const hi  = hash(x, flip ? 3 : 7);
    const cut = Math.max(0, Math.min(H - 1, Math.round(low * 4 + hi * 2)));
    if (flip) c.fillRect(x, 0, 1, H - cut);
    else c.fillRect(x, cut, 1, H - cut);
  }
  return cv;
}
