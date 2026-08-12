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
  rat: [
    '................',
    '................',
    '................',
    '..........11....',
    '.........1nN1...',
    '.........1NM1...',
    '.......111NM11..',
    '11...11nNNNMMN1.',
    '1n1.1nNNMMMMMM1.',
    '.1n11nNMMMMkWM1.',
    '.1nNNMMMMMMMMw1.',
    '..1NMMMMMMMMM11.',
    '..1NMMMMMMMMN1..',
    '..1N1MN1MN1N1...',
    '..111.11.11.1...',
    '................',
  ],
  /* 굶은 들쥐 — the same animal after a bad month. Greyer,
     one eye gone red, and the ribs showing through. */
  lean: [
    '................',
    '................',
    '................',
    '..........22....',
    '.........2dg2...',
    '.........2gG2...',
    '.......222gG22..',
    '22...22dggGGg2..',
    '2d2.2dggGGGGGG2.',
    '.2d22dgGGGGRSG2.',
    '.2dggGGgGgGGGw2.',
    '..2gGgGgGgGGG22.',
    '..2gGGGGGGGGg2..',
    '..2g2gg2gg2g2...',
    '..222.22.22.2...',
    '................',
  ],
  bat: [
    '................',
    '................',
    '.22..........22.',
    '2gG2........2Gg2',
    '2gGg22....22gGg2',
    '2gGGGg2222gGGGg2',
    '.2gGGg2dd2gGGg2.',
    '..2gg22dd22gg2..',
    '...222dRRd222...',
    '......4RxR4.....',
    '......2dd2......',
    '.......22.......',
    '................',
    '................',
    '................',
    '................',
  ],
  /* Reared over its own coil — a snake that is only a coil
     reads as rope, and one that is only a head reads as a
     lizard. */
  snake: [
    '................',
    '....555555......',
    '...5EFFFFE5.....',
    '...5FkFFkF5.....',
    '...5EFFFFE5.....',
    '...5EF44FE5.....',
    '...55EFFE55.....',
    '.....5EE5.......',
    '....55EE55......',
    '...5EEEEEE5.....',
    '..5EEEEEEEE5....',
    '..5EE5555EEE5...',
    '..5EE5..55EEE5..',
    '..5EEe5..5EEE5..',
    '...5eEEeeEEEe5..',
    '....55555555....',
  ],
  /* The legs are steel: eight dark legs on a dark outline in
     front of dark masonry is one dark smudge. */
  spider: [
    '................',
    '.s............s.',
    '.s............s.',
    '..s..........s..',
    '..ss.222222.ss..',
    's..s2dggGd2s..s.',
    'ss..2dRddRd2..ss',
    '..ss2dggggd2ss..',
    '...s2dgGGgd2s...',
    '..ss.2dgggd2.ss.',
    '.ss...2ddd2...ss',
    's......222......',
    '................',
    '................',
    '................',
    '................',
  ],
  mold: [
    '................',
    '................',
    '................',
    '....55...55.....',
    '...5eE5.5eE5....',
    '..5eEFFe5EFe5...',
    '.5eEFFFFFFFFe5..',
    '.5EFFEEFFEFFE5..',
    '5EFFFFFFFFFFFE5.',
    '5EFEFFFFEFFFFE5.',
    '5EFFFFFFFFFFFE5.',
    '.5eEFFFFFFFFe5..',
    '..5eeeeeeeee5...',
    '...555555555....',
    '................',
    '................',
  ],
  jelly: [
    '................',
    '.....7777.......',
    '...77pPPP77.....',
    '..7pPVVPPPP7....',
    '.7pPVVPPPPPP7...',
    '.7PVVPPPPPPP7...',
    '7PPPPP77PPPPP7..',
    '7PPPP7kk7PPPP7..',
    '7PPPPP77PPPPP7..',
    '7PPPPPPPPPPPP7..',
    '7pPPPPPPPPPPp7..',
    '.7pPPPPPPPPp7...',
    '.7ppPPPPPPpp7...',
    '..77ppppppp77...',
    '....7777777.....',
    '................',
  ],

  /* ── humanoids ──────────────────────────────────────── */
  kobold: [
    '................',
    '..55......55....',
    '.5eE5....5Ee5...',
    '.5eEE5..5EEe5...',
    '..5eEE55EEe5....',
    '..5eEEEEEEe5....',
    '..5EEWkEkWE5....',
    '..5EEEEEEEE5....',
    '...5EEwwEE5.....',
    '....55eEe55.....',
    '...1nNNNNn1.....',
    '..1nNMMMMNn1....',
    '..1nNM11MNn1....',
    '...1NM11MN1.....',
    '...1n1..1n1.....',
    '...111..111.....',
  ],
  orc: [
    '................',
    '...5555555555...',
    '..5eeEEEEEEe5...',
    '.5eEEEEEEEEEe5..',
    '.5EEFFFFFFEEE5..',
    '.5EFRkFFkREEE5..',
    '.5EFFFFFFFFEE5..',
    '.5EFwFFFFwFEE5..',
    '..5EFwEEwFEE5...',
    '...55EEEEE55....',
    '..222dSSSd222...',
    '.2dS2dSSSd2Sd2..',
    '.2dS2dSSSd2Sd2..',
    '..22dSSSSSd22...',
    '...1nn1.1nn1....',
    '...1111..111....',
  ],
  dog: [
    '................',
    '................',
    '.........11.11..',
    '........1nN1nN1.',
    '........1NM1NM1.',
    '.......11NMMMN1.',
    '11...111nNMMMMN1',
    '1n1.1nNNMMMMkWM1',
    '.1n11nNMMMMMMMw1',
    '.1nNNMMMMMMMMM11',
    '..1NMMMMMMMMMM1.',
    '..1NMMMMMMMMMN1.',
    '..1NMMMMMMMMN1..',
    '..1N1MN1MN1N1...',
    '..111.11.11.1...',
    '................',
  ],
  ogre: [
    '..000000000000..',
    '.0HHHHHHHHHHHH0.',
    '0HhhhhhhhhhhhhH0',
    '0HhaaaaaaaaaahH0',
    '0HhaaaaaaaaaahH0',
    '0HhWkaaaakWahH0.',
    '0HhaaaaaaaaaahH0',
    '0HhaaHHHHaaahH0.',
    '.0HhaHwwHahhH0..',
    '..00HhaaahH00...',
    '.0HHHHHHHHHH0...',
    '0HhHHHHHHHHhH0..',
    '0HhHHHHHHHHhH0..',
    '0HH11HHHH11HH0..',
    '..11nn1..1nn1...',
    '..1111....111...',
  ],
  troll: [
    '..555555555555..',
    '.5eeEEEEEEEEe5..',
    '5eEEFFFFFFFFEe5.',
    '5eEFFFFFFFFFEe5.',
    '5EFFFFFFFFFFFE5.',
    '5EFykFFFFkyFE5..',
    '5EFFFFFFFFFFFE5.',
    '5EFFwFFFFwFFFE5.',
    '.5EFwEEEEwFFE5..',
    '..55EEEEEEE55...',
    '.5eEEEEEEEEe5...',
    '5eEFEEEEEEFEe5..',
    '5eEFEEEEEEFEe5..',
    '5eE55EEEE55Ee5..',
    '..55ee1..1ee5...',
    '...1111...111...',
  ],
  giant: [
    '.9999999999999..',
    '9uuuuuuuuuuuu9..',
    '9uwwwwwwwwwwu9..',
    '9uwWWWWWWWWwu9..',
    '9uwWkWWWWkWwu9..',
    '9uwWWWWWWWWwu9..',
    '9uwWuuwwuuWwu9..',
    '9uuwWWWWWWwuu9..',
    '2dS2uuwwuu2Sd2..',
    '2dSSuuwwuuSSd2..',
    '9uuuuuuuuuuuu9..',
    '9uwuuuuuuuuwu9..',
    '9uwuuuuuuuuwu9..',
    '9uu99uuuu99uu9..',
    '..99nn9..9nn9...',
    '..1111....111...',
  ],

  /* ── undead & horrors ───────────────────────────────── */
  wraith: [
    '................',
    '.....2222.......',
    '....2dggd2......',
    '...2dgGGgd2.....',
    '...2gGIIGg2.....',
    '...2gGGGGg2.....',
    '..2dgGGGGgd2....',
    '..2dgGdGdGgd2...',
    '.2dgGGdSSdGgd2..',
    '.2dgGGGdSdGGgd2.',
    '.2dgGGGGGGGgd2..',
    '..2dgGGGGGgd2...',
    '..2ddgGGGgdd2...',
    '...2d.ddd.d2....',
    '....2.d.d.2.....',
    '................',
  ],
  mummy: [
    '................',
    '....99999999....',
    '...9wwwwwwww9...',
    '..9wwuuuuwwww9..',
    '..9wuwwwwuwww9..',
    '..9w9yyww9yyw9..',
    '..9wwwwwwwwww9..',
    '...9wwuuuuww9...',
    '.....9wwww9.....',
    '..999wwuuww999..',
    '.9wwuwwwwwwuww9.',
    '.9wwwwuuuuwwww9.',
    '..9wwwwwwwwww9..',
    '..9wuuwwwwuuw9..',
    '...9ww9..9ww9...',
    '...9999...999...',
  ],
  vampire: [
    '................',
    '...4444444444...',
    '..4rrrrrrrrrr4..',
    '.4r4wwwwwwww4r4.',
    '.4r4waaaaaaw4r4.',
    '.4rwaRkaakRawr4.',
    '.4rwaaaaaaaawr4.',
    '.4rwaawwwwaawr4.',
    '.4rrwawwwwawrr4.',
    '4rRR44wwww44RR4.',
    '4rRRRR4rr4RRRR4.',
    '4rrRRRRRRRRRRr4.',
    '.4rRRRRRRRRRr4..',
    '..4rRRRRRRRr4...',
    '...444rr.rr444..',
    '.....444.444....',
  ],
  lich: [
    '................',
    '....3yyyyyy3....',
    '...3yYyyyyYy3...',
    '...99wwwwww99...',
    '..9wwWWWWWWww9..',
    '..9w9PPwwPP9w9..',
    '..9wwWWWWWWww9..',
    '..9ww9w99w9ww9..',
    '...9wwWWWWww9...',
    '..77pPPPPPPp77..',
    '.7pPPVVPPVVPPp7.',
    '.7pPPpPPPPpPPp7.',
    '..7PPPPPPPPPP7..',
    '..7pPPPPPPPPp7..',
    '...7pp7..7pp7...',
    '...7777...777...',
  ],

  /* ── dragons & the deep ─────────────────────────────── */
  dragon: [
    '44..........44..',
    '4rR4...44...4Rr4',
    '4rRR4.4RR4.4RRr4',
    '4rRRR4RRRR4RRRr4',
    '4rRRRRRRRRRRRRr4',
    '.4rR4yy44yy4Rr4.',
    '..4rRRRRRRRRr4..',
    '..4rRR4ww4RRr4..',
    '44.4rRRRRRRr4.44',
    '4r4.4RRRRRR4.4r4',
    '4rr44RRRRRR44rr4',
    '4rrrrRRRRRRrrrr4',
    '.4rrr4RRRR4rrr4.',
    '..444.4RR4.444..',
    '.......44.......',
    '................',
  ],
  wyrm: [
    '66..........66..',
    '6bB6...66...6Bb6',
    '6bBB6.6BB6.6BBb6',
    '6bBBB6BBBB6BBBb6',
    '6bBBBBBBBBBBBBb6',
    '.6bB6II66II6Bb6.',
    '..6bBBBBBBBBb6..',
    '..6bBB6WW6BBb6..',
    '66.6bBBBBBBb6.66',
    '6b6.6BBBBBB6.6b6',
    '6bb66BBBBBB66bb6',
    '6bbbbBBBBBBbbbb6',
    '.6bbb6BBBB6bbb6.',
    '..666.6BB6.666..',
    '.......66.......',
    '................',
  ],

  /* ── the ember floors ───────────────────────────────────
     Everything from ten down is drawn out of the same three
     values — char, ember, steel — so the deep floors read as
     one place rather than as six unrelated monsters. */
  ashhound: [
    '................',
    '................',
    '................',
    '..........22....',
    '.........2dg2...',
    '.........2dG2...',
    '.......222dG22..',
    '22...22ddGGGg2..',
    '2d2.2dGGGGGGGG2.',
    '.2d22dGGGGGOmG2.',
    '.2dGGGGmOmGGGO2.',
    '..2dGmOmGmOGG22.',
    '..2dGGGGGGGGd2..',
    '..2d2GG2GG2d2...',
    '..222.22.22.2...',
    '................',
  ],
  warden: [
    '................',
    '..2222222222....',
    '.2dssssssssd2...',
    '.2dSSSSSSSSd2...',
    '2dSS2OOOO2SSd2..',
    '2dS2ORRRRO2Sd2..',
    '2dSS2OOOO2SSd2..',
    '2dSSSSSSSSSSd2..',
    '.2dssssssssd2...',
    '22dsSSSSSSsd22..',
    '2mOsSSSSSSsOm2..',
    '2mOsSSOOSSsOm2..',
    '2dSsSSSSSSsSd2..',
    '.2dsSSSSSSsd2...',
    '..22dS2..2Sd2...',
    '...222....222...',
  ],
  ashen: [
    '................',
    '................',
    '....mmmmmm......',
    '..mm2dddd2mm....',
    '.md2dooood2dm...',
    '.md2oRRRRo2dm...',
    'mdd2oooooo2ddm..',
    'mdoooooooooodm..',
    'mdoooOOOOooodm..',
    'mdooOOOOOOoodm..',
    '.mdoooOOooodm...',
    '.mddoooooodm....',
    '..mdddooodmm....',
    '..mm2ddddd2m....',
    '...mm2mm2mm.....',
    '.....mm.mm......',
  ],
  emberpriest: [
    '................',
    '....mmmmmmm.....',
    '...mOOOOOOOm....',
    '..mOoooooooOm...',
    '..mOokkookkoOm..',
    '..mOoRookRooOm..',
    '..mOooooooooOm..',
    '...mOooooooOm...',
    '....mmoooomm....',
    '..44rrrrrrrr44..',
    '.4rrRRRRRRRRrr4.',
    '.4rRRR3yy3RRRr4.',
    '.4rRRRyOOyRRRr4.',
    '.4rrRRR3y3RRrr4.',
    '..44rrrrrrrr44..',
    '...4444444444...',
  ],
  ashheap: [
    '................',
    '................',
    '................',
    '.......mm.......',
    '......mOOm......',
    '.....mOROm.mm...',
    '....2gOOOOg2....',
    '...2gggOOggg2...',
    '..2ggOgggggGg2..',
    '.2gGggOROggggg2.',
    '.2ggggOOOggggg2.',
    '2gGgggggggggGg2.',
    '2gggggggggggggg2',
    '2gGgggggggGgggg2',
    '.22222222222222.',
    '................',
  ],
  balemperor: [
    '..mm......mm....',
    '.mOOm....mOOm...',
    '.mOyOmmmmOyOm...',
    '.mOyyOOOOyyOm...',
    'mmOyyyyyyyyOmm..',
    'mOO4RR44RR4OOm..',
    'mOOOOOOOOOOOOm..',
    'mOOO4WWWW4OOOm..',
    '.mOOOOOOOOOOm...',
    '..44rRRRRr44....',
    '.4rrRRRRRRrr4...',
    '4rRROOOOOORRr4..',
    '4rRROyyyyORRr4..',
    '4rrROOOOORRrr4..',
    '.44rr4..4rr44...',
    '..444....444....',
  ],

  /* The golden thief. A hunched shape with a sack — it has to
     read as a *creature* at a glance, not as a coin pile. */
  thief: [
    '................',
    '.....33333......',
    '...33yyyyy33....',
    '..3yYYyyyyy3....',
    '..3yy33333yy3...',
    '..3y3Wkky3y3....',
    '..3y33333y3.....',
    '...3yyyyyy3.....',
    '..33yyyyyy33....',
    '.3yyyyyyyyy33...',
    '.3yy3yyyy3y3mm..',
    '..333yyyy3mOOm..',
    '....3yyyy3mOym..',
    '....3y3y33mmmm..',
    '...333.333......',
    '................',
  ],

  /* ── items ──────────────────────────────────────────────
     Tools go on the diagonal so the blade gets its full run
     across the tile, and every material carries its own
     outline: a wooden haft never shares a line with an iron
     head. */
  sword: [
    '............2222',
    '...........2WSd2',
    '..........2WSd2.',
    '.........2WSd2..',
    '........2WSd2...',
    '.......2WSd2....',
    '......2WSd2.....',
    '.....2WSd2......',
    '....32WSd2......',
    '...3y32Sd2......',
    '..3yYy32d2......',
    '.13yYy332.......',
    '.1NM3yy3........',
    '11NM133.........',
    '1NM11...........',
    '111.............',
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
    '......9999......',
    '......9ww9......',
    '.....99ww99.....',
    '.....9wSSw9.....',
    '.....9wSSw9.....',
    '....99wSSw99....',
    '...9wW4444Sw9...',
    '..9wW4RRRR4ww9..',
    '..9w4RxxRRR4w9..',
    '..9w4RRRRRRR4h..',
    '..9w4RRRRRRR4h..',
    '..9w4rRRRRRr4h..',
    '...9w4rrrrr4w9..',
    '....99wwwww99...',
    '......99999.....',
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
    '...1111111111...',
    '..1nnnnnnnnnn1..',
    '.1nNNNNNNNNNNn1.',
    '.1NMMMMMMMMMMN1.',
    '.1NMMMMMMMMMMN1.',
    '.1nnnnnnnnnnnn1.',
    '.13yyyyyyyyyy31.',
    '.1nnnnnnnnnnnn1.',
    '.1NMMM33y3MMMN1.',
    '.1NMMM3yYy3MMN1.',
    '.1NMMM33y33MMN1.',
    '.1nNNNNNNNNNNn1.',
    '..1nnnnnnnnnn1..',
    '...1111111111...',
  ],
  mimic: [
    '................',
    '................',
    '...1111111111...',
    '..1nnnnnnnnnn1..',
    '.1nNNNNNNNNNNn1.',
    '.1NMM4RR4MMMMN1.',
    '.1NM4WWWW4MMMN1.',
    '.1nW44WW44WWnn1.',
    '.1WWW4WW4WWWWW1.',
    '.11WWW44WWWW111.',
    '.1NW4WWWW4WW4N1.',
    '.1NM44WW444MMN1.',
    '.1NMMM4RR4MMMN1.',
    '.1nNNNNNNNNNNn1.',
    '..1nnnnnnnnnn1..',
    '...1111111111...',
  ],

  /* Shopkeeper — the C channel is tinted per shop, same trick
     the hero uses for classes. Drawn as a torso behind a
     counter, because he is standing in a shopfront. */
  keeper: [
    '.....000000.....',
    '...11nnnnnn11...',
    '..1nNNnnnnnnn1..',
    '..1nNnnnnnnnn1..',
    '..1nnnhhhhnnn1..',
    '..1nnhaaaahnn1..',
    '..0nhWkhhWkhn0..',
    '..0nhhhhhhhhn0..',
    '...0HhhhhhhH0...',
    '....00hhhh00....',
    '...2CCCCCCCC2...',
    '.0C0CCCCCCCC0C0.',
    '.0h0CCCCCCDD0h0.',
    '1111111111111111',
    '1nNMMMMMMMMMMNn1',
    '1111111111111111',
  ],
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
      '.....000000.....',
      '...00nnnnnn00...',
      '..0nnnnnnnnnn0..',
      '..0nnhhhhhhnn0..',
      '..0hhkkhhkkhh0..',
      '..0hhhhhhhhhh0..',
      '...0HHhhhhHH0...',
      '....00hhhh00....',
      '...XCCCCCCCCX...',
      '.XDDXCCCCCCXDDX.',
      '.XhhXCCCCCCXhhX.',
      '..XXXCCCCCCXXX..',
      '....XCCCCCCX....',
      '....XDDDDDDX....',
      '....XDDXXDDX....',
      '....1nn11nn1....',
    ],
    side: [
      '.....000000.....',
      '...00nnnnnn00...',
      '..0nnnnnnnnn00..',
      '..0nnnnnhhhhh0..',
      '..0nnnnhkkhhh0..',
      '..0nnnhhhhhhh0..',
      '...0nnhhhhhH0...',
      '.....00hhh00....',
      '...XCCCCCCCCX...',
      '..XDDXCCCCCCX...',
      '..XhhXCCCCCCX...',
      '...XXXCCCCCCX...',
      '.....XCCCCCCX...',
      '.....XDDDDDDX...',
      '.....XDDDDX.....',
      '.....1nnnn1.....',
    ],
    up: [
      '.....000000.....',
      '...00nnnnnn00...',
      '..0nnnnnnnnnn0..',
      '..0nnnnnnnnnn0..',
      '..0nnnnnnnnnn0..',
      '..0nnnnnnnnnn0..',
      '...0nnnnnnnn0...',
      '....00hhhh00....',
      '...XCCCCCCCCX...',
      '.XDDXCCCCCCXDDX.',
      '.XhhXCCCCCCXhhX.',
      '..XXXCCCCCCXXX..',
      '....XCCCCCCX....',
      '....XDDDDDDX....',
      '....XDDXXDDX....',
      '....1nn11nn1....',
    ],
  },

  // Half-elf: a little of the point, a little of the height.
  halfElf: {
    down: [
      '.....000000.....',
      '...11MMNNNN11...',
      '..1NMMNNNNNNN1..',
      '..1NMNNNNNNNN1..',
      '..1NNNhhhhNNN1..',
      '..1NNhaaaahNN1..',
      '0h0NhWkhhWkhN0h0',
      '.00NhhhhhhhhN00.',
      '...0HhhhhhhH0...',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '.0C0CCCCCCCC0C0.',
      '.0h0CCCCCCDD0h0.',
      '..22CCCCCCDD22..',
      '....1nn11nn1....',
      '....1111.111....',
    ],
    side: [
      '.....000000.....',
      '...11MMNNNN11...',
      '..1NMMNNNNNNN1..',
      '..1NMNNNNNNNN1..',
      '..1NNNNNhhhhh0..',
      '..1NNNNhaaaaa0..',
      '0h0NNNhWkhaaa0..',
      '.00NNhhhhhhhh0..',
      '...1Nhhhhhhh0...',
      '....0haaah00....',
      '...2CCCCCCCC2...',
      '..22CCCCCCCC0C0.',
      '..0hCCCCCCDD0h0.',
      '..22CCCCCCDD22..',
      '.....1nnnn1.....',
      '....111nnn1.....',
    ],
    up: [
      '.....000000.....',
      '...11MMNNNN11...',
      '..1NMMNNNNNNN1..',
      '..1NMNNNNNNNN1..',
      '..1NNNNNNNNNN1..',
      '..1NNNNNNNNNN1..',
      '0h0NNNNNNNNNN0h0',
      '.00NNNNNNNNNN00.',
      '...1NNNNNNNN1...',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '.0C0CCCCCCCC0C0.',
      '.0h0CCCCCCDD0h0.',
      '..22CCCCCCDD22..',
      '....1nn11nn1....',
      '....1111.111....',
    ],
  },

  // Elf: pale, tall, long ears standing clear of the head.
  elf: {
    down: [
      '.....333333.....',
      '...33yYYYYy33...',
      '..3yYYyyyyyy3...',
      '..3yYyyyyyyy3...',
      '..3yyyhhhhyy3...',
      '.000yhaaaahy000.',
      '0hh0hWkhhWkh0hh0',
      '.000hhhhhhhh000.',
      '...0HhhhhhhH0...',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '.0C0CCCCCCCC0C0.',
      '.0h0CCCCCCDD0h0.',
      '..22CCCCCCDD22..',
      '....1nn11nn1....',
      '....1111.111....',
    ],
    side: [
      '.....333333.....',
      '...33yYYYYy33...',
      '..3yYYyyyyyy3...',
      '..3yYyyyyyyy3...',
      '..3yyyyyhhhhh0..',
      '.000yyyhaaaaa0..',
      '0hh0yyhWkhaaa0..',
      '.000yhhhhhhhh0..',
      '...3yhhhhhhh0...',
      '....0haaah00....',
      '...2CCCCCCCC2...',
      '..22CCCCCCCC0C0.',
      '..0hCCCCCCDD0h0.',
      '..22CCCCCCDD22..',
      '.....1nnnn1.....',
      '....111nnn1.....',
    ],
    up: [
      '.....333333.....',
      '...33yYYYYy33...',
      '..3yYYyyyyyy3...',
      '..3yYyyyyyyy3...',
      '..3yyyyyyyyy3...',
      '.000yyyyyyy000..',
      '0hh0yyyyyyy0hh0.',
      '.000yyyyyyy000..',
      '...3yyyyyyy3....',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '.0C0CCCCCCCC0C0.',
      '.0h0CCCCCCDD0h0.',
      '..22CCCCCCDD22..',
      '....1nn11nn1....',
      '....1111.111....',
    ],
  },

  // Halfling: small, low, wide-footed. Sits three rows lower.
  halfling: {
    down: [
      '................',
      '................',
      '.....000000.....',
      '...11nNNNNn11...',
      '..1nNMNNNNNNn1..',
      '..1nNNhhhhNNn1..',
      '..0nNhaaaahNn0..',
      '..0nhWkhhWkhn0..',
      '..0nhhhhhhhhn0..',
      '...0HhaaahH0....',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '.0C0CCCCCCCC0C0.',
      '.0h0CCCCCCDD0h0.',
      '...1nNN1.1nN1...',
      '...11111..111...',
    ],
    side: [
      '................',
      '................',
      '.....000000.....',
      '...11nNNNNn11...',
      '..1nNMNNNNNNn1..',
      '..1nNNNNhhhhh0..',
      '..0nNNNhaaaaa0..',
      '..0nNhWkhaaaa0..',
      '..0nhhhhhhhhh0..',
      '...0Hhaaahh0....',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '..22CCCCCCCC0C0.',
      '..0hCCCCCCDD0h0.',
      '....1nNNNN1.....',
      '...111nNNN1.....',
    ],
    up: [
      '................',
      '................',
      '.....000000.....',
      '...11nNNNNn11...',
      '..1nNMNNNNNNn1..',
      '..1nNNNNNNNNn1..',
      '..1nNNNNNNNNn1..',
      '..1nNNNNNNNNn1..',
      '..1nNNNNNNNNn1..',
      '...1nNNNNNn1....',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '.0C0CCCCCCCC0C0.',
      '.0h0CCCCCCDD0h0.',
      '...1nNN1.1nN1...',
      '...11111..111...',
    ],
  },

  // Gnome: big head, small body, a shock of white hair.
  gnome: {
    down: [
      '................',
      '...9999999999...',
      '..9wwwwwwwwww9..',
      '.9wWWwwwwwwwww9.',
      '.9wWwwwhhhhwww9.',
      '.9wwwhaaaaahww9.',
      '.0wwhWkhhWkhhw0.',
      '.0wwhhhhhhhhhw0.',
      '..9whhhwwwhhh9..',
      '..99wHhaaahHw9..',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '.0C0CCCCCCCC0C0.',
      '.0h0CCCCCCDD0h0.',
      '....1nn11nn1....',
      '....1111.111....',
    ],
    side: [
      '................',
      '...9999999999...',
      '..9wwwwwwwwww9..',
      '.9wWWwwwwwwwww9.',
      '.9wWwwwwwhhhhh0.',
      '.9wwwwwhaaaaaa0.',
      '.0wwwhWkhaaaaa0.',
      '.0wwhhhhhhhhhh0.',
      '..9whhhwwwhhh9..',
      '..99wHhaaahHw9..',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '..22CCCCCCCC0C0.',
      '..0hCCCCCCDD0h0.',
      '.....1nnnn1.....',
      '....111nnn1.....',
    ],
    up: [
      '................',
      '...9999999999...',
      '..9wwwwwwwwww9..',
      '.9wWWwwwwwwwww9.',
      '.9wWwwwwwwwwww9.',
      '.9wwwwwwwwwwww9.',
      '.9wwwwwwwwwwww9.',
      '.9wwwwwwwwwwww9.',
      '..9wwwwwwwwww9..',
      '..99wwwwwwww99..',
      '....00hhhh00....',
      '...2CCCCCCCC2...',
      '.0C0CCCCCCCC0C0.',
      '.0h0CCCCCCDD0h0.',
      '....1nn11nn1....',
      '....1111.111....',
    ],
  },

  // Dwarf: broad, and the beard is most of the face.
  dwarf: {
    down: [
      '................',
      '...1111111111...',
      '..1nnnnnnnnnn1..',
      '.1nNNnnnnnnnnn1.',
      '.1nNnnnhhhhnnn1.',
      '.1nnnhaaaaaahn1.',
      '.0nnhWkhhWkhhn0.',
      '.0nnhhhhhhhhhn0.',
      '.1nNNNhhhhNNNn1.',
      '.1nNMNNNNNNMNn1.',
      '..11nNNNNNNn11..',
      '.222CCCCCCCC222.',
      '0C0CCCCCCCCCC0C0',
      '0h0CCCCCCCCDD0h0',
      '...1nn1..1nn1...',
      '...1111...111...',
    ],
    side: [
      '................',
      '...1111111111...',
      '..1nnnnnnnnnn1..',
      '.1nNNnnnnnnnnn1.',
      '.1nNnnnnnhhhhh0.',
      '.1nnnnnhaaaaaa0.',
      '.0nnnhWkhaaaaa0.',
      '.0nnhhhhhhhhhh0.',
      '.1nNNNhhhhNNNn1.',
      '.1nNMNNNNNNMNn1.',
      '..11nNNNNNNn11..',
      '..22CCCCCCCC22..',
      '.0C0CCCCCCCC0C0.',
      '.0h0CCCCCCDD0h0.',
      '....1nnnnn1.....',
      '...111nnnn1.....',
    ],
    up: [
      '................',
      '...1111111111...',
      '..1nnnnnnnnnn1..',
      '.1nNNnnnnnnnnn1.',
      '.1nNnnnnnnnnnn1.',
      '.1nnnnnnnnnnnn1.',
      '.1nnnnnnnnnnnn1.',
      '.1nnnnnnnnnnnn1.',
      '.1nnnnnnnnnnnn1.',
      '.1nnnnnnnnnnnn1.',
      '..11nnnnnnnn11..',
      '.222CCCCCCCC222.',
      '0C0CCCCCCCCCC0C0',
      '0h0CCCCCCCCDD0h0',
      '...1nn1..1nn1...',
      '...1111...111...',
    ],
  },

  // Half-orc: green, jawed, tusks up from the lip.
  halfOrc: {
    down: [
      '................',
      '...1111111111...',
      '..1nnnnnnnnnn1..',
      '..1nneEEEEenn1..',
      '..1neEEEEEEen1..',
      '..5eEEFFFFEEe5..',
      '..5eERkFFkREe5..',
      '..5eEEFFFFEEe5..',
      '...5EFwFFwFE5...',
      '....55eEEe55....',
      '...5CCCCCCCC5...',
      '.5E5CCCCCCCC5E5.',
      '.5E5CCCCCCDD5E5.',
      '..55CCCCCCDD55..',
      '...1nn1..1nn1...',
      '...1111...111...',
    ],
    side: [
      '................',
      '...1111111111...',
      '..1nnnnnnnnnn1..',
      '..1nneEEEEenn1..',
      '..1neEEEEEEen1..',
      '..5eEEEEEFFFF5..',
      '..5eERkFFFFFE5..',
      '..5eEEFFFFFFE5..',
      '...5EFwFFFFE5...',
      '....55eEEe55....',
      '...5CCCCCCCC5...',
      '..55CCCCCCCC5E5.',
      '..5ECCCCCCDD5E5.',
      '..55CCCCCCDD55..',
      '....1nnnnn1.....',
      '...111nnnn1.....',
    ],
    up: [
      '................',
      '...1111111111...',
      '..1nnnnnnnnnn1..',
      '..1nnnnnnnnnn1..',
      '..1nnnnnnnnnn1..',
      '..5eeeeeeeeee5..',
      '..5eeeeeeeeee5..',
      '..5eeeeeeeeee5..',
      '...5eEEEEEEe5...',
      '....55eEEe55....',
      '...5CCCCCCCC5...',
      '.5E5CCCCCCCC5E5.',
      '.5E5CCCCCCDD5E5.',
      '..55CCCCCCDD55..',
      '...1nn1..1nn1...',
      '...1111...111...',
    ],
  },

  // Half-troll: fills the tile. Nothing else does.
  halfTroll: {
    down: [
      '..555555555555..',
      '.55eeeeeeeeee55.',
      '.5eeeEEEEEEeee5.',
      '.5eeEEEEEEEEee5.',
      '.5eEEFFFFFFEEe5.',
      '.5eEFyRkkRyFEe5.',
      '.5eEEFFFFFFEEe5.',
      '.5eEEwFFFFwEEe5.',
      '..5eEEwFFwEEe5..',
      '...55eEEEEe55...',
      '..5CCCCCCCCCC5..',
      '5C5CCCCCCCCCC5C5',
      '5E5CCCCCCCCDD5E5',
      '.55CCCCCCCCDD55.',
      '...1nnn11nnn1...',
      '...11111.1111...',
    ],
    side: [
      '..555555555555..',
      '.55eeeeeeeeee55.',
      '.5eeeEEEEEEeee5.',
      '.5eeEEEEEEEEee5.',
      '.5eEEEEEFFFFFe5.',
      '.5eEEyRkFFFFFe5.',
      '.5eEEEFFFFFFEe5.',
      '.5eEEwFFFFFFEe5.',
      '..5eEEFFFFEEe5..',
      '...55eEEEEe55...',
      '..5CCCCCCCCCC5..',
      '..55CCCCCCCCC5C5',
      '..5ECCCCCCCDD5E5',
      '..55CCCCCCCDD55.',
      '....1nnnnnn1....',
      '...111nnnnn1....',
    ],
    up: [
      '..555555555555..',
      '.55eeeeeeeeee55.',
      '.5eeeeeeeeeeee5.',
      '.5eeeeeeeeeeee5.',
      '.5eeeeeeeeeeee5.',
      '.5eeeeeeeeeeee5.',
      '.5eeeeeeeeeeee5.',
      '.5eeeeeeeeeeee5.',
      '..5eEEEEEEEEe5..',
      '...55eEEEEe55...',
      '..5CCCCCCCCCC5..',
      '5C5CCCCCCCCCC5C5',
      '5E5CCCCCCCCDD5E5',
      '.55CCCCCCCCDD55.',
      '...1nnn11nnn1...',
      '...11111.1111...',
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
      '.....222222.....',
      '...22dSSSSd22...',
      '..2dSSSSSSSSd2..',
      '..2dS2....2Sd2..',
      '..2dS2....2Sd2..',
      '...2S2....2S2...',
      '................',
      '................',
      '..2SSSSSSSSSS2..',
      '.2SsSSDCCDSSsS2.',
      '..22SDCCCCDS22..',
      '...2SDCCCCDS2...',
      '....2SCCCCS2....',
      '....2ssssss2....',
      '................',
      '................',
    ],
    side: [
      '.....222222.....',
      '...22dSSSSd22...',
      '..2dSSSSSSSSd2..',
      '..2dSSSSSS2Sd2..',
      '..2dS2.....2S2..',
      '...2S2......2...',
      '................',
      '................',
      '..2SSSSSSSSSS2..',
      '.2SsSSDCCCCDX...',
      '..22SSDCCCCDX...',
      '...2SSDCCCCDX...',
      '.....2SDCCCDX...',
      '.....2ssssssX...',
      '................',
      '................',
    ],
    up: [
      '.....222222.....',
      '...22dSSSSd22...',
      '..2dSSSSSSSSd2..',
      '..2dSSSSSSSSd2..',
      '..2dSSSSSSSSd2..',
      '...2S2....2S2...',
      '................',
      '................',
      '..2SSSSSSSSSS2..',
      '.2SsSSDCCDSSsS2.',
      '..22SDCCCCDS22..',
      '...2SDCCCCDS2...',
      '....2SCCCCS2....',
      '....2ssssss2....',
      '................',
      '................',
    ],
  },

  // 마법사: a pointed hat, a long robe, a staff down the side.
  mage: {
    down: [
      '.......66.......',
      '......6bB6......',
      '.....6bBB6......',
      '....6bbBBb6.....',
      '..66bbbBBbb66...',
      '.6bBBBBBBBBBB6..',
      '..666......666..',
      '................',
      '................',
      '................',
      '..6bBBBBBBBBb6..',
      '.6bCCCCCCCCCCb6.',
      '..6CCCCCCDDCCb61',
      '.6bbCCCCCCDDb61N',
      '.6bbbbbbbbbbb61M',
      '..66666666666.11',
    ],
    side: [
      '.......66.......',
      '......6bB6......',
      '.....6bBB6......',
      '....6bbBBb6.....',
      '..66bbbBBbb66...',
      '.6bBBBBBBBBBB6..',
      '..666......666..',
      '................',
      '................',
      '................',
      '..6bBBBBBBBBb6..',
      '..66CCCCCCCCCb61',
      '..6CCCCCCDDCCb61',
      '..6bCCCCCCDDb61N',
      '..6bbbbbbbbb61M.',
      '...6666666661...',
    ],
    up: [
      '.......66.......',
      '......6bB6......',
      '.....6bBB6......',
      '....6bbBBb6.....',
      '..66bbbBBbb66...',
      '.6bBBBBBBBBBB6..',
      '..6bBBBBBBBBb6..',
      '...6bbbbbbbb6...',
      '................',
      '................',
      '..6bBBBBBBBBb6..',
      '.6bCCCCCCCCCCb6.',
      '..6CCCCCCDDCCb61',
      '.6bbCCCCCCDDb61N',
      '.6bbbbbbbbbbb61M',
      '..66666666666.11',
    ],
  },

  // 사제: a hood and a pale mantle, a gold mark at the throat.
  priest: {
    down: [
      '....99999999....',
      '..99wwWWWWww99..',
      '.9wWWWWWWWWWWw9.',
      '.9wWW999999WWw9.',
      '.9wW9......9Ww9.',
      '.9wW9......9Ww9.',
      '.9w9........9w9.',
      '..9..........9..',
      '................',
      '................',
      '..9wWWWWWWWWw9..',
      '.9wCCCCCCCCCCw9.',
      '..9CCC3yy3CDDw9.',
      '.9wwCCCCCCDDww9.',
      '.9wWWWWWWWWWWw9.',
      '..9wWw9..9wWw9..',
    ],
    side: [
      '....99999999....',
      '..99wwWWWWww99..',
      '.9wWWWWWWWWWWw9.',
      '.9wWW999999WWw9.',
      '.9wW9......9Ww9.',
      '.9wW9......9Ww9.',
      '.9w9........9w9.',
      '..9..........9..',
      '................',
      '................',
      '..9wWWWWWWWWw9..',
      '..99CCCCCCCCCw9.',
      '..9CC3yy3CCDDw9.',
      '..9wCCCCCCDDww9.',
      '..9wWWWWWWWWw9..',
      '...9wWWWWWw9....',
    ],
    up: [
      '....99999999....',
      '..99wwWWWWww99..',
      '.9wWWWWWWWWWWw9.',
      '.9wWWWWWWWWWWw9.',
      '.9wWWWWWWWWWWw9.',
      '.9wW9......9Ww9.',
      '.9w9........9w9.',
      '..9..........9..',
      '................',
      '................',
      '..9wWWWWWWWWw9..',
      '.9wCCCCCCCCCCw9.',
      '..9CCC3yy3CDDw9.',
      '.9wwCCCCCCDDww9.',
      '.9wWWWWWWWWWWw9.',
      '..9wWw9..9wWw9..',
    ],
  },

  // 도적: a low dark hood, a wrap, a knife at the hip.
  rogue: {
    down: [
      '....kkkkkkkk....',
      '..kkqqddddqqkk..',
      '.kqdddddddddqk..',
      '.kqddkkkkkkddqk.',
      '.kqdk......kdqk.',
      '.kqdk......kdqk.',
      '.kqk........kqk.',
      '..k..........k..',
      '................',
      '................',
      '..kqddddddddqk..',
      '.kqCCCCCCCCCCqk.',
      '..kCCCCCCDDCCqk2',
      '.kqqCCCCCCDDqk2S',
      '.kqddddddddddk2.',
      '..kqdk..kqdk....',
    ],
    side: [
      '....kkkkkkkk....',
      '..kkqqddddqqkk..',
      '.kqdddddddddqk..',
      '.kqddkkkkkkddqk.',
      '.kqdk......kdqk.',
      '.kqdk......kdqk.',
      '.kqk........kqk.',
      '..k..........k..',
      '................',
      '................',
      '..kqddddddddqk..',
      '..kkCCCCCCCCCqk2',
      '..kCCCCCCDDCCqkS',
      '..kqCCCCCCDDqk2.',
      '..kqdddddddddk..',
      '...kqddddddk....',
    ],
    up: [
      '....kkkkkkkk....',
      '..kkqqddddqqkk..',
      '.kqdddddddddqk..',
      '.kqddddddddddqk.',
      '.kqdddddddddddk.',
      '.kqdk......kdqk.',
      '.kqk........kqk.',
      '..k..........k..',
      '................',
      '................',
      '..kqddddddddqk..',
      '.kqCCCCCCCCCCqk.',
      '..kCCCCCCDDCCqk2',
      '.kqqCCCCCCDDqk2S',
      '.kqddddddddddk2.',
      '..kqdk..kqdk....',
    ],
  },

  // 레인저: a green hood, a quiver of arrows over the shoulder.
  ranger: {
    down: [
      '....55555555....',
      '..55eeEEEEee55..',
      '.5eEEEEEEEEEe5..',
      '.5eEE555555EEe5.',
      '.5eE5......5Ee5.',
      '.5eE5......5Ee5.',
      '.5e5........5e5.',
      '..5..........5..',
      '................',
      '................',
      '..5eEEEEEEEEe5..',
      '.5eCCCCCCCCCCe53',
      '..5CCCCCCDDCCe5y',
      '.5eeCCCCCCDDe51y',
      '.5eeeeeeeeeee51N',
      '..5eE5..5eE5.11.',
    ],
    side: [
      '....55555555....',
      '..55eeEEEEee55..',
      '.5eEEEEEEEEEe5..',
      '.5eEE555555EEe5.',
      '.5eE5......5Ee5.',
      '.5eE5......5Ee5.',
      '.5e5........5e5.',
      '..5..........5..',
      '................',
      '................',
      '..5eEEEEEEEEe5..',
      '..55CCCCCCCCCe53',
      '..5CCCCCCDDCCe5y',
      '..5eCCCCCCDDe51y',
      '..5eeeeeeeeee1N.',
      '...5eeeeeee5.11.',
    ],
    up: [
      '....55555555....',
      '..55eeEEEEee55..',
      '.5eEEEEEEEEEe5..',
      '.5eEEEEEEEEEEe5.',
      '.5eEEEEEEEEEEe5.',
      '.5eE5......5Ee5.',
      '.5e5........5e5.',
      '..5..........5..',
      '................',
      '................',
      '..5eEEEEEEEEe5..',
      '.5eCCCCCCCCCCe53',
      '..5CCCCCCDDCCe5y',
      '.5eeCCCCCCDDe51y',
      '.5eeeeeeeeeee51N',
      '..5eE5..5eE5.11.',
    ],
  },

  // 팔라딘: a crested helm and a gilded breastplate.
  paladin: {
    down: [
      '.......mm.......',
      '......mOOm......',
      '..33333yy33333..',
      '.3yYYYYyyYYYYy3.',
      '.3y3333333333y3.',
      '.3y3........3y3.',
      '.3y3........3y3.',
      '..3..........3..',
      '................',
      '................',
      '..3yyyyyyyyyy3..',
      '3yY3yCCCCCCy3Yy3',
      '.333yCCCCDDy333.',
      '...3yyyyyyyy3...',
      '................',
      '................',
    ],
    side: [
      '.......mm.......',
      '......mOOm......',
      '..33333yy33333..',
      '.3yYYYYyyYYYYy3.',
      '.3y3333333333y3.',
      '.3y3........3y3.',
      '.3y3........3y3.',
      '..3..........3..',
      '................',
      '................',
      '..3yyyyyyyyyy3..',
      '..33yCCCCCCy3Yy3',
      '..3yyCCCCDDy333.',
      '..3yyyyyyyyy3...',
      '................',
      '................',
    ],
    up: [
      '.......mm.......',
      '......mOOm......',
      '..33333yy33333..',
      '.3yYYYYyyYYYYy3.',
      '.3yYYYYyyYYYYy3.',
      '.3y3333333333y3.',
      '.3y3........3y3.',
      '..3..........3..',
      '................',
      '................',
      '..3yyyyyyyyyy3..',
      '3yY3yCCCCCCy3Yy3',
      '.333yCCCCCCy333.',
      '...3yyyyyyyy3...',
      '................',
      '................',
    ],
  },
};

/* The class colour, and the shade one step under it. `C` and
   `D` in a grid are replaced with these at bake time, which is
   what lets one drawing serve six classes and still have a lit
   side and a shaded side. */
export const CLASS_TINT = {
  warrior: ['S', 's', '2'],
  mage:    ['B', 'b', '6'],
  priest:  ['W', 'w', '9'],
  rogue:   ['g', 'd', 'k'],
  ranger:  ['E', 'e', '5'],
  paladin: ['Y', 'y', '3'],
};

/* One keeper per shop, so the six of them are not identical. */
export const SHOP_TINT = [
  ['E', 'e', '5'], ['S', 's', '2'], ['R', 'r', '4'],
  ['W', 'w', '9'], ['V', 'P', '7'], ['B', 'b', '6'],
];

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

const DEFAULT_TINT = ['S', 's', '2'];

function bakeGrid(grid, tint, flip = false) {
  const [lit, shade, line] = tint || DEFAULT_TINT;
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = c.getContext('2d');
  const img = x.createImageData(CELL, CELL);
  const px = img.data;
  for (let row = 0; row < CELL; row++) {
    const line = grid[row] || '';
    for (let col = 0; col < CELL; col++) {
      let ch = line[flip ? CELL - 1 - col : col] || '.';
      if (ch === 'C') ch = lit;
      else if (ch === 'D') ch = shade;
      else if (ch === 'X') ch = line;
      const color = PALETTE[ch];
      if (!color) continue;
      const [r, g, b] = rgb(color);
      const o = (row * CELL + col) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/* Race under, class over. Any cell the kit leaves as '.' shows
   the body beneath, which is why the face survives the helmet. */
function merge(body, kit) {
  const out = [];
  for (let row = 0; row < CELL; row++) {
    let line = '';
    for (let col = 0; col < CELL; col++) {
      const over = (kit[row] || '')[col] || '.';
      line += over !== '.' ? over : ((body[row] || '')[col] || '.');
    }
    out.push(line);
  }
  return out;
}

/* The second walk frame. Only the two leg rows move: mirrored,
   the forward foot becomes the trailing one. It is one pixel of
   difference and it is the whole reason a walk reads as a walk
   rather than as a slide. */
function stepFrame(grid) {
  const out = grid.slice();
  for (let row = LEG_TOP; row < CELL; row++) {
    const line = (grid[row] || '').padEnd(CELL, '.');
    out[row] = [...line].reverse().join('');
  }
  return out;
}

const viewOf = (src, view) => (Array.isArray(src) ? src : src[view] || src.down);

export function bakeAll() {
  /* Heroes: race × class × facing × frame. `left` is `side`
     mirrored, so the four facings cost three drawings. */
  for (const race of Object.keys(RACE_BODY)) {
    for (const cls of Object.keys(CLASS_KIT)) {
      const tint = CLASS_TINT[cls];
      for (const view of VIEWS) {
        const g = merge(viewOf(RACE_BODY[race], view), viewOf(CLASS_KIT[cls], view));
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
   floor, so a rat scatters brown and a jelly scatters violet.
   Read the grid, keep the opaque colours, cache the list.   */
const shardCache = new Map();
const OUTLINES = new Set(['k', 'q', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'm']);

export function spriteColors(name) {
  // hero:elf:mage:down:0 and hero:mage both scatter the same palette.
  const key = name.startsWith('hero') ? 'hero' : name.split(':')[0];
  if (shardCache.has(key)) return shardCache.get(key);
  const grid = SPRITES[key];
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
