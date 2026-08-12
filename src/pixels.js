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

  /* ── the second step of every ramp ────────────────────────
     Two shades of a colour is a flat fill with a line around it,
     which is what every sprite in here was. Four is a surface: a
     lit plane, a body colour, a turned plane, and an edge. The
     edge is the darkest shade of the material — pure black only
     where the sprite meets nothing at all, because a black
     keyline around every limb is a colouring book. Light comes
     from the upper left in every sprite in this file. */
  f: '#1d4630',       // green, deepest
  F: '#a6dba4',       // green, lit
  j: '#33210f',       // brown, deepest
  J: '#c4a06a',       // brown, lit
  q: '#464d5c',       // steel, deepest
  Q: '#b4bcc9',       // steel, lit
  a: '#6b4530',       // skin, shadowed
  A: '#bc8a60',       // skin
  h: '#571914',       // red, deepest
  H: '#f18c74',       // red, lit
  l: '#132a52',       // blue, deepest
  L: '#a3cdec',       // blue, lit
  m: '#39204b',       // violet, deepest
  M: '#dcaaee',       // violet, lit
  v: '#7d4210',       // ember, deepest
  V: '#f7dda6',       // ember, lit
  u: '#9a9484',       // bone, shadowed
  t: '#141a26',       // the shadow a body casts on the floor
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
  /* A body, a snout, a tail — three things eight pixels could not fit at once. */
  rat: [
    '................',
    '................',
    '..jj............',
    '.jNNj......jj...',
    'jNJJNjjjjjjNNj..',
    'jNhJNNNNNNNNNj..',
    'jNJJNNNNNNNNNjj.',
    '.jNNNNNNNNNNNjjn',
    '..jjNNNNNNNNjj.n',
    '...jjnnnnnnjj..n',
    '....jj....jj..n.',
    '....jj....jj.n..',
    '...tttt..tttt...',
    '................',
    '................',
    '................',
  ],
  /* 굶은 들쥐 — the same animal after a bad month. Longer, greyer,
     ribs showing, and one red eye, so a glance at the tile says
     "not the one you have been killing" before the name does. */
  /* Ribs showing through. Same shape as the rat, worse condition. */
  lean: [
    '................',
    '................',
    '..jj............',
    '.jnnj......jj...',
    'jnJJnjjjjjjnnj..',
    'jnhJnNjjNjjNNj..',
    'jnJJNjNNjjNNNjj.',
    '.jnnNjjNNjjnnjjn',
    '..jjnnnnnnnnjj.n',
    '...jjnnnnnnjj..n',
    '....jj....jj..n.',
    '....jj....jj.n..',
    '...tttt..tttt...',
    '................',
    '................',
    '................',
  ],
  /* Wings wider than the body, which is the only silhouette that reads as a bat. */
  bat: [
    '................',
    '..jj........jj..',
    '.jnnj......jnnj.',
    'jnnnjj.jj.jjnnnj',
    'jnnnnjjnnjjnnnnj',
    'jnnnnnnJJnnnnnnj',
    'jnnnnnhJJhnnnnnj',
    '.jnnnnJJJJnnnnj.',
    '..jjnnnwwnnnjj..',
    '....jjnnnnjj....',
    '......jnnj......',
    '.......jj.......',
    '.....tttttt.....',
    '................',
    '................',
    '................',
  ],
  /* Coiled, with the head raised — a straight line reads as a stick. */
  snake: [
    '................',
    '................',
    '......ffffff....',
    '.....fFFFFFFf...',
    '.....fEEhhEEf...',
    '.....fEEEEEEf...',
    '....ffeEEEEef...',
    '...ffFFEwwEf....',
    '..feEEEEeff.....',
    '.feEEEEef.......',
    'feEEEEef........',
    'feEEEef.........',
    '.feeef..........',
    '..fff...........',
    '...ttttttt......',
    '................',
  ],
  /* Eight legs that actually read as eight. */
  /* Legs off every corner, and a body small enough that the legs are the shape. */
  /* Thick legs off every corner. Thin ones vanish at a tile this size. */
  spider: [
    '................',
    'q...........q...',
    '.qq.......qq....',
    '..qq..dd..qq....',
    'q..qqddddqq...q.',
    '.qqddGGGGddqq...',
    '..qdGhddhGdq....',
    'q.qdGGddGGdq..q.',
    '.qqdGGGGGGdqq...',
    '..qqdGGGGdqq....',
    'q..qqdwwdqq...q.',
    '.qq..dddd..qq...',
    'q..............q',
    '.....tttttt.....',
    '................',
    '................',
  ],
  /* A patch on the floor, not a creature standing on it. */
  /* Lumpy and low and spreading sideways — the first pass came out a whale. */
  mold: [
    '................',
    '................',
    '...ff...fff.....',
    '..fFFf.fFFFf.ff.',
    '.feEEffeEEEffFFf',
    'feEEEEeEEEEEeEEf',
    'feEEEEEEEEEEEEEf',
    'feEEEEEEEEEEEEEf',
    '.feEEEEEEEEEEEf.',
    '..ffeEEEEEEEeff.',
    '....ffeeeeeff...',
    '......fffff.....',
    '...tttttttttt...',
    '................',
    '................',
    '................',
  ],
  /* A blob is the right answer here, but a blob with a highlight in it. */
  jelly: [
    '................',
    '................',
    '.....cccccc.....',
    '...ccLLLLLLcc...',
    '..cLLLLLLLLLLc..',
    '.cLLLLcccLLLLLc.',
    '.cLLccccccccLLc.',
    'cLLcccccccccc Lc',
    'cLccccccccccccc.',
    'cLccccccccccccc.',
    '.cccccccccccccc.',
    '.ccccccccccccc..',
    '..cccccccccccc..',
    '...cccccccccc...',
    '....tttttttt....',
    '................',
  ],

  /* humanoids */
  /* Horns, a snout and a spear — the thing that kills more first floors than anything. */
  kobold: [
    '................',
    '..k........k....',
    '..kk......kk....',
    '..kJk.kk.kJk....',
    '..kJJkJJkJJk....',
    '...kJJJJJJk.....',
    '...kNkNNkNk.....',
    '...kNNNNNNk.....',
    '...kNwwwwNk...k.',
    '..kkNNNNNNkk.kw.',
    '.kNJJJJJJJJNkw..',
    '.kNJJJJJJJJNk...',
    '.kkNJJJJJJNkk...',
    '...kNNk.kNNk....',
    '...kkk...kkk....',
    '................',
  ],
  /* Redrawn at sixteen. At eight a leg was one pixel and an eye
     was one pixel, so there was nowhere to put a jaw, an outline
     or a shadow — which is most of why everything read as the
     same blob wearing different colours. Same palette, same file,
     four times the room. */
  /* Light from the upper left. Four greens rather than two, edges in the darkest green rather than black, a cleaver held to one side so the silhouette is not a mirror, and a shadow under it so it stands on the floor instead of floating over it. */
  /* A narrower skull, a harness with a lit strap down the middle, arms clear of the body, and the cleaver held out so the silhouette is not a mirror of itself. */
  /* The house style, in one sprite: two-pixel forms, one lit row along the top of each surface, edges in the darkest shade of the material rather than in black, the weapon on one side only, and a shadow under the feet. */
  /* Game Boy Colour rules: a black keyline around the whole silhouette, and only three colours inside it — the body, one shade under it, and a highlight. No gradient, no ground shadow, no fourth tone. The outline is what was missing; taking it out is what made the last pass read as neither chunky nor finished. */
  orc: [
    '................',
    '.....kkkkkk.....',
    '....kFFFFFFk....',
    '...kFFFFFFFFk...',
    '...kEEEEEEEEk...',
    '...kEkEEEEkEk...',
    '...kEEEEEEEEk...',
    '...kEwEEEEwEk...',
    '..kkeEEEEEEekk..',
    '.kNJkeEEEEekJNk.',
    '.kNJkkNNNNkkJNk.',
    '.kkkNJJJJJJNkkk.',
    '...kNJJJJJJNk...',
    '...kEEk..kEEk...',
    '...kkk....kkk...',
    '................',
  ],
  /* Ears up, muzzle forward, four legs under it. */
  dog: [
    '................',
    '..jj.......jj...',
    '.jnnj.....jnnj..',
    'jnJJnjjjjjnJJnj.',
    'jnJJJJJJJJJJJnj.',
    'jnJhJJJJJJJhJnj.',
    '.jnJJJJJJJJJnj..',
    '..jnnwwwwwnnj...',
    '.jnnnnnnnnnnnj..',
    'jnNNNNNNNNNNNnj.',
    'jnNNNNNNNNNNNnj.',
    '.jnnj.....jnnj..',
    '..jjj.....jjj...',
    '..tttt...tttt...',
    '................',
    '................',
  ],
  /* Heavy enough that the wind-up is worth telegraphing. */
  ogre: [
    '................',
    '...jjJJJJJJj....',
    '..jJJJJJJJJJj...',
    '..jJJJJJJJJJj...',
    '..jNNhhNNhhNj...',
    '..jNNNNNNNNNj...',
    '..jNNwwwwwNNj...',
    '...jNNNNNNNj....',
    'jj.jjNNNNNjj.jj.',
    'jNjjnnnnnnnjjNj.',
    'jNNnnnnnnnnnNNj.',
    '.jnnnnnnnnnnnj..',
    '.jnnnj...jnnnj..',
    '..jNNj...jNNj...',
    '..jjjj...jjjj...',
    '..tttt...tttt...',
  ],
  /* It closes its own wounds, so it should look like there is plenty to close. */
  troll: [
    '................',
    '..ffFFFFFFFff...',
    '.fFFFFFFFFFFFf..',
    '.fFFFFFFFFFFFf..',
    '.fEEhhEEEhhEEf..',
    '.fEEEEEEEEEEEf..',
    '.feEwwwwwwwEef..',
    '.feEEEEEEEEEef..',
    'ffeEEEEEEEEEeff.',
    'fEEfeEEEEEeffEf.',
    'fEEfeEEEEEeffEf.',
    '.fffeEEEEEefff..',
    '...feEEf.fEef...',
    '...fEEf..fEEf...',
    '...ffff..ffff...',
    '..tttt....tttt..',
  ],
  /* It fills the tile. That is the whole reading. */
  /* Skin, not bone — the first pass drew the face in bone and it read as blank. */
  giant: [
    '..jjJJJJJJJJj...',
    '.jJJJJJJJJJJJj..',
    '.jJJJJJJJJJJJj..',
    '.jNNNNNNNNNNNj..',
    '.jNNhhNNNhhNNj..',
    '.jNNNNNNNNNNNj..',
    '.jNNwwwwwwwNNj..',
    '.jnNNNNNNNNNnj..',
    'qqjjnnnnnnnjjqq.',
    'qQjnnnnnnnnnjQq.',
    'qQjnnnnnnnnnjQq.',
    '.qjnnnnnnnnnjq..',
    '..jnnnj.jnnnj...',
    '..jNNj...jNNj...',
    '..jjjj...jjjj...',
    '.tttt.....tttt..',
  ],

  /* undead & horrors */
  /* No feet. It ends in smoke rather than standing on anything. */
  wraith: [
    '................',
    '.....gGGGGg.....',
    '....gGGGGGGg....',
    '....gGGGGGGg....',
    '....gdhddhdg....',
    '....gdddddd g...',
    '...ggGGGGGGgg...',
    '..gGGGGGGGGGGg..',
    '.gGGGGGGGGGGGGg.',
    'gGGGGGGGGGGGGGGg',
    'gGGGGGGGGGGGGGGg',
    '.gGGgGGGGGGgGGg.',
    '..gg.gGGGGg.gg..',
    '......gGGg......',
    '.......gg.......',
    '................',
  ],
  /* Wrapping that has come loose in places, which is where the black shows. */
  /* Brown showing between the wrappings, or it is a white sheet. */
  mummy: [
    '................',
    '...uuwwwwwwuu...',
    '..uwwwwwwwwwwu..',
    '..uwwuuuuuwwwu..',
    '..uwwhwuwhwwwu..',
    '..uwwwwwwwwwwu..',
    '..uwuuwwwuuwwu..',
    '..uwwwwuwwwwwu..',
    'uuuwwwwwwwwwuuu.',
    'uwwuwwuuuwwuwwu.',
    'uwwuwwwwwwwuwwu.',
    '.uuuwwuuuwwuuu..',
    '...uwwwu.wwwu...',
    '...uwwu...uwu...',
    '...uuuu...uuu...',
    '..tttt.....ttt..',
  ],
  /* A collar thrown out to either side, and everything else narrow. */
  vampire: [
    '................',
    '....ddddddd.....',
    '...dwwwwwwwd....',
    '...dwwwwwwwd....',
    '...dwhwwwhwd....',
    '...dwwwwwwwd....',
    '...dwwWWWwwd....',
    '....dwwwwwd.....',
    '.hhhddwwwddhhh..',
    'hHHhddwwwddhHHh.',
    'hHHhdddddddhHHh.',
    '.hhhdddddddhhh..',
    '..hhddddddd hh..',
    '....ddd.ddd.....',
    '....ddd.ddd.....',
    '...tttt..tttt...',
  ],
  /* A skull in a robe, holding something lit. Purple is the tell. */
  lich: [
    '................',
    '....uwwwwwwu.M..',
    '...uwwwwwwwwM...',
    '...uwwwwwwwuM...',
    '...uwMwwwMwuM...',
    '...uwwwwwwwuM...',
    '...uwuwwwuwuM...',
    '....uwwuwwu.M...',
    '..mmpuwwwupmm...',
    '.mpppuuwuuppp m.',
    '.mppppppppppp m.',
    '.mppppppppppp m.',
    '..mpppppppppm...',
    '...mppp.pppm....',
    '...mmmm.mmmm....',
    '..tttt...tttt...',
  ],

  /* dragons & the deep */
  /* Wings out, and the whole thing red enough to be read across a dark room. */
  /* A snout that comes forward out of the wings, and teeth under it. */
  dragon: [
    '................',
    '.hh..........hh.',
    'hrrh...HH...hrrh',
    'hrrrh.hHHh.hrrrh',
    'hrrrrhHRRHhrrrrh',
    '.hrrrHRRRRHrrrh.',
    '..hrrRRyyRRrrh..',
    '..hrrRRRRRRrrh..',
    '.hhrRRRRRRRRrhh.',
    'hrrrRRwwwwRRrrrh',
    'hrrrrRRRRRRrrrrh',
    '.hhrrRRRRRRrrhh.',
    '...hrRRr.rRRrh..',
    '...hyyh...hyyh..',
    '...hyh.....hyh..',
    '..tttt.....tttt.',
  ],
  /* Long and low, tapering off — nothing about it stands upright. */
  wyrm: [
    '................',
    '.....vvvvvvv....',
    '...vvyyyyyyyvv..',
    '..vyyyyyyyyyyyv.',
    '..vyyhhyyyhhyyv.',
    '..vyyyyyyyyyyyv.',
    'vvvyyyWWWWWyyyvv',
    'vyyvyyyyyyyyyvyv',
    'vyyyvvvvvvvvyyyv',
    '.vyyyyyyyyyyyyv.',
    '..vvyyyyyyyyyv..',
    '....vyyyyyyyv...',
    '......vyyyyv....',
    '........vvv.....',
    '....tttttttt....',
    '................',
  ],

  /* ── the ember floors ─────────────────────────────────
     Everything from ten down is drawn out of the same three
     colours — char, ember, steel — so the deep floors read as
     one place rather than as six unrelated monsters. */
  // 재의 사냥개: low, long, running. Two embers where eyes go.
  /* A drawn bow, string to the right, so the item tile reads as
     "this one reaches" next to the swords and axes. */
  bow: [
    '................',
    '.......jJj......',
    '.....jJJj.w.....',
    '....jJj...w.....',
    '...jJj....w.....',
    '...jJj....w.....',
    '..jJj.....w.....',
    '..jJj....Qw.....',
    '..jJj....Qw.....',
    '..jJj.....w.....',
    '...jJj....w.....',
    '...jJj....w.....',
    '....jJj...w.....',
    '.....jJJj.w.....',
    '.......jJj......',
    '.....tttt.......',
  ],
  /* A dog made of what was left after the fire. */
  ashhound: [
    '................',
    '..qq.......qq...',
    '.qggq.....qggq..',
    'qgGGqqqqqqgGGq..',
    'qgGGGGGGGGGGGq..',
    'qgGvGGGGGGGvGq..',
    '.qgGGGGGGGGGq...',
    '..qgvvvvvvvgq...',
    '.qgggggggggggq..',
    'qgGGGGGGGGGGGq..',
    'qgvGGGGGGGGvGq..',
    '.qggq.....qggq..',
    '..qqq.....qqq...',
    '..tttt...tttt...',
    '................',
    '................',
  ],
  // 화로지기: wide and plated, arms already half-drawn back.
  /* Plate over everything, and a polearm out to one side. */
  warden: [
    '................',
    '...qqQQQQQQq....',
    '..qQQQQQQQQQq...',
    '..qQQqqqqqQQq..q',
    '..qQqvhwhvqQq.qQ',
    '..qQqwwwwwqQq.qQ',
    '..qQqwwwwwqQq.qQ',
    '...qQQQQQQQq.qQQ',
    'qqqqQQQQQQQqqqQ.',
    'qQQQQQQQQQQQQQ..',
    'qQQQggggggQQQq..',
    '.qQQggggggQQq...',
    '..qQQgggggQQq...',
    '..qQQQq.qQQQq...',
    '..qqqqq.qqqqq...',
    '..tttt...tttt...',
  ],
  // 잿물 먹는 것: a slumped thing, brighter where it has fed.
  /* What is left of somebody who kept walking. */
  ashen: [
    '................',
    '....ggGGGGgg....',
    '...gGGGGGGGGg...',
    '...gGGuuuuGGg...',
    '...gGuvhhvuGg...',
    '...gGuuuuuuGg...',
    '...gGuuwwuuGg...',
    '....gGGuuGGg....',
    '..ggdddddddd gg.',
    '.gddddddddddddg.',
    'gddvvdddddvvddg.',
    'gdddddddddddddg.',
    '.gdddddddddddg..',
    '..gdddg.gdddg...',
    '..gggg...gggg...',
    '..tttt...tttt...',
  ],
  // 화로의 사제: robed, and holding the mark it is about to draw.
  /* Robed and carrying a light that is not a torch. */
  emberpriest: [
    '................',
    '....vvoooovv.V..',
    '...voooooooV....',
    '...vooooooovV...',
    '...vohVooVhov...',
    '...voooooooov...',
    '...vovoooovov...',
    '....voooooov....',
    '..hhrvoooovrhh..',
    '.hrrrvooooovrrh.',
    '.hrrrrvoooovrrh.',
    '..hrrrvooovrrh..',
    '...hrrvooovrh...',
    '....hrvoovrh....',
    '....hhrrrrhh....',
    '...tttttttt.....',
  ],
  // 잿더미 속의 것: a heap, until the moment it is not.
  /* A pile that turns out to be looking at you. */
  ashheap: [
    '................',
    '................',
    '....dddddd......',
    '..ddGGGGGGdd....',
    '.dGGdvddvdGGd...',
    'dGGdddddddd GGd.',
    'dGddddddddddd Gd',
    'dGdvdddddddvdGd.',
    'dGddddddddddd Gd',
    '.dGdddddddddGd..',
    '..ddGGGGGGGGd...',
    '....dddddddd....',
    '...tttttttttt...',
    '................',
    '................',
    '................',
  ],
  /* Crowned, and the crown is the only gold on it. Fifteen floors of this. */
  balemperor: [
    '...y..yyyy..y...',
    '...yy.yVVy.yy...',
    '...vyyyyyyyyyv..',
    '...voooooooo v..',
    '...vohhoooohov..',
    '...voooooooov...',
    '...vovoooovov...',
    '..hhvoowwwoovhh.',
    '.hrrvooooooovrh.',
    'hrrrvooyyyoovrrh',
    'hrrrrvoyVyovrrrh',
    '.hrrrvooyoovrrh.',
    '..hrrrvoooovrh..',
    '...hrrvooovrh...',
    '...hhrrh.hrrhh..',
    '..tttt.....tttt.',
  ],

  /* items */
  potion: [
    '................',
    '......jJJj......',
    '......jNNj......',
    '......jNNj......',
    '.....jJNNJj.....',
    '....jJRRRRJj....',
    '...jRRRRRRRRj...',
    '...jRHHRRRRRj...',
    '...jRHRRRRRRj...',
    '...jRRRRRRRRj...',
    '...jRRRRRRRRj...',
    '...jjRRRRRRjj...',
    '....jjjjjjjj....',
    '....tttttttt....',
    '................',
    '................',
  ],
  scroll: [
    '................',
    '................',
    '...jJJJJJJJJj...',
    '..jJNNNNNNNNJj..',
    '..jNwwwwwwwwNj..',
    '..jNwuuuuuuwNj..',
    '..jNwwwwwwwwNj..',
    '..jNwuuuuuuwNj..',
    '..jNwwwwwwwwNj..',
    '..jNwuuuuuuwNj..',
    '..jNwwwwwwwwNj..',
    '..jJNNNNNNNNJj..',
    '...jJJJJJJJJj...',
    '...tttttttttt...',
    '................',
    '................',
  ],
  wand: [
    '................',
    '.........MM.....',
    '........MPPM....',
    '........MPPM....',
    '.........MM.....',
    '........jJj.....',
    '.......jJj......',
    '......jJj.......',
    '.....jJj........',
    '....jJj.........',
    '...jJj..........',
    '..jJj...........',
    '..jjj...........',
    '................',
    '..tttt..........',
    '................',
  ],
  ring: [
    '................',
    '................',
    '.......LL.......',
    '......LBBL......',
    '.......LL.......',
    '.....yyyyyy.....',
    '....yyvvvvyy....',
    '...yyvv..vvyy...',
    '...yvv....vvy...',
    '...yvv....vvy...',
    '...yyvv..vvyy...',
    '....yyvvvvyy....',
    '.....yyyyyy.....',
    '.....tttttt.....',
    '................',
    '................',
  ],
  amulet: [
    '................',
    '...yy......yy...',
    '....yy....yy....',
    '.....yy..yy.....',
    '......yyyy......',
    '.......yy.......',
    '.....vyyyyv.....',
    '....vyyPPyyv....',
    '...vyyPMMPyyv...',
    '...vyyPMMPyyv...',
    '....vyyPPyyv....',
    '.....vyyyyv.....',
    '......vvvv......',
    '.....tttttt.....',
    '................',
    '................',
  ],
  sword: [
    '................',
    '............QQ..',
    '...........QQQ..',
    '..........QQQ...',
    '.........QQQ....',
    '........QQQ.....',
    '.......QQQ......',
    '......QQQ.......',
    '.....QQQ........',
    '..yyQQQyy.......',
    '..yyQQyyy.......',
    '...jQQj.........',
    '..jjQjj.........',
    '..jJJj..........',
    '..jjj...........',
    '...tttt.........',
  ],
  dagger: [
    '................',
    '................',
    '................',
    '..........QQ....',
    '.........QQQ....',
    '........QQQ.....',
    '.......QQQ......',
    '......QQQ.......',
    '....yyQQy.......',
    '....yyQyy.......',
    '.....jQj........',
    '....jJJj........',
    '....jjj.........',
    '................',
    '...tttt.........',
    '................',
  ],
  spear: [
    '................',
    '.........QQ.....',
    '........QQQQ....',
    '........QQQQ....',
    '.........QQ.....',
    '........jJj.....',
    '.......jJj......',
    '......jJj.......',
    '.....jJj........',
    '....jJj.........',
    '...jJj..........',
    '..jJj...........',
    '..jjj...........',
    '................',
    '..tttt..........',
    '................',
  ],
  great: [
    '................',
    '..........QQQ...',
    '.........QQQQ...',
    '........QQQQQ...',
    '.......QQQQQ....',
    '......QQQQQ.....',
    '.....QQQQQ......',
    '....QQQQQ.......',
    '...QQQQQ........',
    '.yyyQQQyyy......',
    '.yyyQQyyyy......',
    '...jQQj.........',
    '..jjQQjj........',
    '..jJJJj.........',
    '..jjjj..........',
    '..tttt..........',
  ],
  /* The blade hangs off one side of the haft. A symmetric head is a mace. */
  axe: [
    '................',
    '......jJj.......',
    '.....qQQQQq.....',
    '....qQQQQQQQq...',
    '...qQQQQQQQQQq..',
    '...qQQQQQQQQQq..',
    '....qQQQQQQQq...',
    '.....qQQQQQq....',
    '......jJj.......',
    '......jJj.......',
    '......jJj.......',
    '......jJj.......',
    '......jJj.......',
    '......jjj.......',
    '....tttttt......',
    '................',
  ],
  mace: [
    '................',
    '......qQQQq.....',
    '.....qQQQQQq....',
    '....qQQQQQQQq...',
    '....qQQQQQQQq...',
    '.....qQQQQQq....',
    '......qQQQq.....',
    '.......jJj......',
    '.......jJj......',
    '.......jJj......',
    '.......jJj......',
    '.......jJj......',
    '......jJJJj.....',
    '......jjjjj.....',
    '.....tttttt.....',
    '................',
  ],
  armor: [
    '................',
    '...qq......qq...',
    '..qQQqqqqqqQQq..',
    '..qQQQQQQQQQQq..',
    '..qQQQQQQQQQQq..',
    '...qQQQQQQQQq...',
    '...qQQQQQQQQq...',
    '...qQQqqqqQQq...',
    '...qQQqQQqQQq...',
    '...qQQqQQqQQq...',
    '...qQQQQQQQQq...',
    '....qQQQQQQq....',
    '.....qQQQQq.....',
    '......qqqq......',
    '....tttttt......',
    '................',
  ],
  shield: [
    '................',
    '...qQQQQQQQQq...',
    '..qQQQQQQQQQQq..',
    '..qQQyyyyyyQQq..',
    '..qQQyQQQQyQQq..',
    '..qQQyQQQQyQQq..',
    '..qQQyyyyyyQQq..',
    '..qQQQQQQQQQQq..',
    '..qQQQQQQQQQQq..',
    '...qQQQQQQQQq...',
    '....qQQQQQQq....',
    '.....qQQQQq.....',
    '......qQQq......',
    '.......qq.......',
    '.....tttttt.....',
    '................',
  ],
  food: [
    '................',
    '................',
    '.....jJJJJj.....',
    '...jJNNNNNNJj...',
    '..jJNNNNNNNNJj..',
    '..jNNJJJJNNNNj..',
    '..jNNJNNJNNNNj..',
    '..jNNJJJJNNNNj..',
    '..jNNNNNNNNNNj..',
    '..jJNNNNNNNNJj..',
    '...jJNNNNNNJj...',
    '.....jJJJJj.....',
    '....tttttttt....',
    '................',
    '................',
    '................',
  ],
  torch: [
    '................',
    '.......V........',
    '......VyV.......',
    '.....VyyyV......',
    '.....oyyyo......',
    '.....voooov.....',
    '......vvvv......',
    '......jJJj......',
    '......jJJj......',
    '......jJJj......',
    '......jNNj......',
    '......jNNj......',
    '......jNNj......',
    '......jjjj......',
    '.....tttttt.....',
    '................',
  ],
  /* The golden thief. A hunched shape with a sack — it has to
     read as a *creature* at a glance, not as a coin pile, or
     the player will walk into it expecting loot. */
  /* Masked, and already carrying somebody else's purse. */
  thief: [
    '................',
    '................',
    '....dddddddd....',
    '...ddddddddd d..',
    '...ddAAAAAdd d..',
    '...dAkAAAkAd....',
    '...dAAAAAAAd....',
    '....dAAAAAd.....',
    '...ddddddddd..y.',
    '..dddddddddd.yYy',
    '..dddddddddd.yYy',
    '..ddddddddddd.y.',
    '..dddd..dddd....',
    '...dd....dd.....',
    '...dd....dd.....',
    '..tttt..tttt....',
  ],
  /* A little heap with one coin standing on edge. */
  gold: [
    '................',
    '................',
    '................',
    '......vyyv......',
    '.....vyVVyv.....',
    '.....vyyyyv.....',
    '..vvvyyyyyyvvv..',
    '.vyyyyyyyyyyyyv.',
    'vyVyyyyyyyyyyyyv',
    'vyyyyvvvvyyyyyyv',
    '.vyyyyyyyyyyyyv.',
    '..vvyyyyyyyyvv..',
    '....vvvvvvvv....',
    '...tttttttttt...',
    '................',
    '................',
  ],

  /* terrain features */
  /* Rings going down into black, which is the only thing this game asks you to do. */
  /* Steps stepping away from you into black. The rings read as a target. */
  stairsDown: [
    'gGGGGGGGGGGGGGGg',
    'gGGGGGGGGGGGGGGg',
    'gggggggggggggggg',
    '.gggggggggggggg.',
    '.gGGGGGGGGGGGGg.',
    '.gGGGGGGGGGGGGg.',
    '.gggggggggggggg.',
    '..gggggggggggg..',
    '..gddddddddddg..',
    '..gddddddddddg..',
    '..gggggggggggg..',
    '...gggggggggg...',
    '...gkkkkkkkkg...',
    '...gkkkkkkkkg...',
    '...gggggggggg...',
    '....kkkkkkkk....',
  ],
  /* The same rings, lit at the middle instead of black. */
  /* The same steps climbing toward light instead of away into it. */
  stairsUp: [
    '....WWWWWWWW....',
    '....WWWWWWWW....',
    '...gggggggggg...',
    '...gGGGGGGGGg...',
    '...gGGGGGGGGg...',
    '..gggggggggggg..',
    '..gGGGGGGGGGGg..',
    '..gGGGGGGGGGGg..',
    '.gggggggggggggg.',
    '.gGGGGGGGGGGGGg.',
    '.gGGGGGGGGGGGGg.',
    'gggggggggggggggg',
    'gGGGGGGGGGGGGGGg',
    'gGGGGGGGGGGGGGGg',
    'gggggggggggggggg',
    '................',
  ],
  /* Planks, a frame and a handle. A shut door has to look shut. */
  door: [
    'jjjjjjjjjjjjjjjj',
    'jJJJJJJJJJJJJJJj',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjyyjjNNJJ j',
    'jJJJJJJJJJJJJJJj',
    'jjjjjjjjjjjjjjjj',
  ],
  /* Loose stone, scattered. Not a texture — pieces with edges on them. */
  rubble: [
    '................',
    '................',
    '.....gGGg.......',
    '..gGg gGGg......',
    '.gGGGggggg..gGg.',
    '.gggg....g.gGGGg',
    '..gg.......ggggg',
    '.....gGGGg...gg.',
    '....gGGGGGg.....',
    '..gGgggggggg....',
    '.gGGGg.ggg..gGg.',
    '.ggggg.....gGGGg',
    '..gg........ggg.',
    '................',
    '................',
    '................',
  ],

  /* A chest and a mimic share a silhouette on purpose — the
     mimic only gives itself away by breathing (see ui.js). */
  /* A band across the middle and a keyhole under it. */
  chest: [
    '................',
    '..jjjjjjjjjjjj..',
    '.jJJJJJJJJJJJJj.',
    'jJNNNNNNNNNNNNJj',
    'jJNNNNNNNNNNNNJj',
    'jyyyyyyyyyyyyyyj',
    'jJNNNNNNNNNNNNJj',
    'jJNNNNNyyNNNNNJj',
    'jJNNNNNyjNNNNNJj',
    'jJNNNNNNNNNNNNJj',
    'jyyyyyyyyyyyyyyj',
    'jJNNNNNNNNNNNNJj',
    'jJJJJJJJJJJJJJJj',
    '.jjjjjjjjjjjjjj.',
    '...tttttttttt...',
    '................',
  ],
  /* A chest with a full set of teeth in it. */
  mimic: [
    '................',
    '................',
    '..jjjjjjjjjjjj..',
    '.jJJJJJJJJJJJJj.',
    'jJJJJJJJJJJJJJJj',
    'jJwwwwwwwwwwwwJj',
    'jJwWWwWWwWWwWWJj',
    'jNwwwwwwwwwwwwNj',
    'jNhNNNNNNNNNNhNj',
    'jNNNNNNNNNNNNNNj',
    'jJJJJJJJJJJJJJJj',
    '.jJJJJJJJJJJJJj.',
    '..jjjjjjjjjjjj..',
    '...tttttttttt...',
    '................',
    '................',
  ],
  /* Shopkeeper — the C channel is tinted per shop, same trick
     the hero uses for classes. Drawn as a torso behind a counter
     because he is standing in a shopfront, not walking about. */
  /* A person behind a cart, tinted a different colour for each of the six. */
  keeper: [
    '................',
    '....jjCCCCjj....',
    '...jCCCCCCCCj...',
    '...aAAAAAAAAa...',
    '...aAwwwwwwAa...',
    '...aAkAwwAkAa...',
    '...aAAAAAAAAa...',
    '....aAAwwAAa....',
    '.....aAAAAa.....',
    '...CCCCCCCCCC...',
    '..CCCCCCCCCCCC..',
    '..CCCCyyyyCCCC..',
    '..CCCCCCCCCCCC..',
    '...jnnj..jnnj...',
    '...jnnj..jnnj...',
    '..tttt....tttt..',
  ],
  /* A blank plank. The shop's goods sprite is drawn on top, and
     the goods sprites all have transparent margins, so the plank
     reads as a frame around the icon. */
  /* A plank on a post. What is painted on it is drawn over the top. */
  sign: [
    '................',
    '..jjjjjjjjjjjj..',
    '.jJJJJJJJJJJJJj.',
    'jJNNNNNNNNNNNNJj',
    'jJN..........NJj',
    'jJN..........NJj',
    'jJN..........NJj',
    'jJN..........NJj',
    'jJN..........NJj',
    'jJNNNNNNNNNNNNJj',
    '.jJJJJJJJJJJJJj.',
    '..jjjjjnnjjjjj..',
    '.......nn.......',
    '.......nn.......',
    '......jnnj......',
    '.....tttttt.....',
  ],
  /* The ? room. A question mark on a stone marker — the one
     glyph the player will read before they read the prose. */
  /* A question mark. It is a gamble, and it should say so from across the room. */
  event: [
    '................',
    '.....mppppm.....',
    '....mpPPPPpm....',
    '...mpPmmmmPpm...',
    '...mpm....mpm...',
    '...mm.....mpm...',
    '.........mpPm...',
    '........mpPpm...',
    '.......mpPpm....',
    '.......mpPm.....',
    '.......mpm......',
    '................',
    '.......mpm......',
    '......mpPpm.....',
    '......mpPpm.....',
    '.......mmm......',
  ],
  /* The anvil. A dark block on a stump with a spark coming off
     the horn — it has to read as "hit things here" at 24px. */
  /* The horn on one side and the block under it. It is not spent, ever. */
  anvil: [
    '................',
    '................',
    '..qQQQQQQQQQQq..',
    '.qQQQQQQQQQQQQq.',
    'qQQQQQQQQQQQQQQq',
    'qqqqQQQQQQQQqqqq',
    '....qQQQQQQq....',
    '.....qQQQQq.....',
    '.....qQQQQq.....',
    '....qQQQQQQq....',
    '...qQQQQQQQQq...',
    '..jJJJJJJJJJJj..',
    '..jNNNNNNNNNNj..',
    '..jjjjjjjjjjjj..',
    '...tttttttttt...',
    '................',
  ],
  /* Staves and three iron hoops. */
  barrel: [
    '................',
    '..jjJJJJJJJJjj..',
    '.jJNNNNNNNNNNJj.',
    'jJNNNNNNNNNNNNJj',
    'jqQQQQQQQQQQQQqj',
    'jJNNNNNNNNNNNNJj',
    'jJNNNNNNNNNNNNJj',
    'jqQQQQQQQQQQQQqj',
    'jJNNNNNNNNNNNNJj',
    'jJNNNNNNNNNNNNJj',
    'jqQQQQQQQQQQQQqj',
    'jJNNNNNNNNNNNNJj',
    '.jJNNNNNNNNNNJj.',
    '..jjJJJJJJJJjj..',
    '...tttttttttt...',
    '................',
  ],
  /* A cold bowl on a stem. Nothing in it but ash. */
  brazier: [
    '................',
    '..qQQQQQQQQQQq..',
    '.qQQQQQQQQQQQQq.',
    '.qdddddddddddq..',
    '.qQQQQQQQQQQQq..',
    '..qQQQQQQQQQq...',
    '...qQQQQQQQq....',
    '.....qQQQQq.....',
    '.....qQQQQq.....',
    '.....qQQQQq.....',
    '....qQQQQQQq....',
    '...qQQQQQQQQq...',
    '..qQQQQQQQQQQq..',
    '..qqqqqqqqqqqq..',
    '...tttttttttt...',
    '................',
  ],
  /* The same bowl with something in it, throwing its own light. */
  brazierLit: [
    '.......V........',
    '......VyV..V....',
    '.....VyyyVVyV...',
    '....VyyVyyyyyV..',
    '.qQQoyyyyyyyoQq.',
    '..qQvooooooovQ..',
    '...qQQQQQQQq....',
    '.....qQQQQq.....',
    '.....qQQQQq.....',
    '.....qQQQQq.....',
    '....qQQQQQQq....',
    '...qQQQQQQQQq...',
    '..qQQQQQQQQQQq..',
    '..qqqqqqqqqqqq..',
    '...tttttttttt...',
    '................',
  ],
  /* The town's middle. Everything in this game is a corridor or
     a shopfront; the plaza needed one thing that is neither —
     something people would have stood around before the deep
     place opened underneath them. */
  /* A stone rim and water in it. Still clear; nobody left to draw it. */
  well: [
    '................',
    '..gGGGGGGGGGGg..',
    '.gGGGGGGGGGGGGg.',
    '.gggggggggggggg.',
    '.gGGgggggggggGg.',
    '.gGGgllllllggGg.',
    '.gGGglbbbblggGg.',
    '.gGGglbLLblggGg.',
    '.gGGglbbbblggGg.',
    '.gGGgllllllggGg.',
    '.gGGgggggggggGg.',
    '.gggggggggggggg.',
    '.gGGGGGGGGGGGGg.',
    '..gGGGGGGGGGGg..',
    '..tttttttttttt..',
    '................',
  ],
  /* A stall front: cloth over poles. Reads as market rather than
     as furniture to smash. */
  /* Striped cloth over poles with a crate under it. */
  stall: [
    'hrrhhrrhhrrhhrrh',
    'hWWhhrrhhWWhhrrh',
    'hrrhhWWhhrrhhWWh',
    'jjjjjjjjjjjjjjjj',
    '..n..........n..',
    '..n..........n..',
    '..n.jJJJJJJj.n..',
    '..n.jNNNNNNj.n..',
    '..n.jNyyyyNj.n..',
    '..n.jNyjjyNj.n..',
    '..n.jNyyyyNj.n..',
    '..n.jJJJJJJj.n..',
    '..n.jjjjjjjj.n..',
    '..n..........n..',
    '..j..........j..',
    '..tt........tt..',
  ],
  /* Capital, shaft, base — three things, so it reads as built rather than dropped. */
  pillar: [
    'ggGGGGGGGGGGGGgg',
    'gGGGGGGGGGGGGGGg',
    'gggggggggggggggg',
    '..ggGGGGGGGGgg..',
    '..gGGGGGGGGGGg..',
    '..gGGgggggggGg..',
    '..gGGgggggggGg..',
    '..gGGgggggggGg..',
    '..gGGgggggggGg..',
    '..gGGgggggggGg..',
    '..gGGgggggggGg..',
    '..ggGGGGGGGGgg..',
    'gggggggggggggggg',
    'gGGGGGGGGGGGGGGg',
    'ggGGGGGGGGGGGGgg',
    '..tttttttttttt..',
  ],
  /* A skull and what is left of the ribs, not a pile of sticks. */
  bones: [
    '................',
    '....uwwwwwwu....',
    '...uwWWWWWWwu...',
    '...uwWWWWWWwu...',
    '...uwkWWWWkwu...',
    '...uwWWWWWWwu...',
    '....uwWWWWwu....',
    '.....uwwwwu.....',
    '................',
    '..uu........uu..',
    '.uwwuuuuuuuuwwu.',
    '.uwWWWWWWWWWWwu.',
    '..uuwwwwwwwwuu..',
    '...tttttttttt...',
    '................',
    '................',
  ],
  /* A painted jar. Somebody made this before the deep place opened. */
  urn: [
    '................',
    '.....jJJJJj.....',
    '....jJNNNNJj....',
    '...jJNNNNNNJj...',
    '..jJNNNNNNNNJj..',
    '.jJNNNNNNNNNNJj.',
    '.jNNyyyyyyyyNJj.',
    'jJNNyNNNNNNyNNJj',
    'jJNNyNNNNNNyNNJj',
    'jJNNyyyyyyyyNNJj',
    '.jJNNNNNNNNNNJj.',
    '..jJNNNNNNNNJj..',
    '...jjJJJJJJjj...',
    '...tttttttttt...',
    '................',
    '................',
  ],
  /* A slab with something standing over it that has not gone out. */
  altar: [
    '................',
    '.......V........',
    '......VyV.......',
    '.....VyyyV......',
    '......VyV.......',
    '.......V........',
    '..gGGGGGGGGGGg..',
    '.gGGGGGGGGGGGGg.',
    '.gggggggggggggg.',
    '...gGGGGGGGGg...',
    '...gGgggggggg...',
    '...gGgggggggg...',
    '..gGGGGGGGGGGg..',
    '.gGGGGGGGGGGGGg.',
    '.gggggggggggggg.',
    '..tttttttttttt..',
  ],
  /* A flame with logs crossed under it. The one place you get anything back. */
  camp: [
    '................',
    '.......V........',
    '......VyV.......',
    '.....VyyyV......',
    '....VyyVyyV.....',
    '....oyyyyyo.....',
    '....vooooov.....',
    '.....vooov......',
    '..jjjjjjjjjjjj..',
    '.jJJJJJJJJJJJJj.',
    'jJNNjjJJJJjjNNJj',
    'jJJJJJJJJJJJJJJj',
    '.jjjjjjjjjjjjjj.',
    '...tttttttttt...',
    '................',
    '................',
  ],
  /* Grey logs and one thread of smoke. Nothing left in it. */
  campSpent: [
    '................',
    '................',
    '................',
    '................',
    '.......g........',
    '......g.g.......',
    '.......g........',
    '................',
    '..dddddddddddd..',
    '.dggggggggggggd.',
    'dggddggggggddggd',
    'dggggggggggggggd',
    '.dddddddddddddd.',
    '...tttttttttt...',
    '................',
    '................',
  ],
  /* Radials and rings. Eight pixels could only manage a cross. */
  /* Radials crossed by strands. Rings made it a star. */
  web: [
    'g......g......g.',
    '.g.....g.....g..',
    '..g....g....g...',
    'gggggggGggggggg.',
    '...g...G...g....',
    '.ggggggGgggggg..',
    '....g..G..g.....',
    'gggggggGggggggg.',
    '....g..G..g.....',
    '.ggggggGgggggg..',
    '...g...g...g....',
    '..g....g....g...',
    '.g.....g.....g..',
    'g......g......g.',
    '................',
    '................',
  ],
  /* Ripples spread over the tile rather than one blob in the middle. */
  water: [
    'llllllllllllllll',
    'lbbbbbbbbbbbbbbl',
    'lbbLbbbbbbLbbbbl',
    'lbLLLbbbbLLLbbbl',
    'lbbLbbbbbbLbbbbl',
    'lbbbbbbbbbbbbbbl',
    'lbbbbbLbbbbbbLbl',
    'lbbbbLLLbbbbLLLl',
    'lbbbbbLbbbbbbLbl',
    'lbbbbbbbbbbbbbbl',
    'lbbLbbbbbbbLbbbl',
    'lbLLLbbbbbLLLbbl',
    'lbbLbbbbbbbLbbbl',
    'lbbbbbbbbbbbbbbl',
    'lbbbbbbbbbbbbbbl',
    'llllllllllllllll',
  ],
  /* Teeth closing on a gap. Only drawn once you have spotted it. */
  trap: [
    '................',
    '..h..........h..',
    '..hh........hh..',
    '..hrh......hrh..',
    '..hrrhhhhhhrrh..',
    '...hrrrrrrrrh...',
    '....hrrrrrrh....',
    '....hrrrrrrh....',
    '...hrrrrrrrrh...',
    '..hrrhhhhhhrrh..',
    '..hrh......hrh..',
    '..hh........hh..',
    '..h..........h..',
    '................',
    '................',
    '................',
  ],
  /* Swung back against the jamb, and the way through is empty. */
  doorOpen: [
    'jjjjjjjjjjjjjjjj',
    'jJJJj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJNNj..........j',
    'jJyNj..........j',
    'jJJJj..........j',
    'jjjjjjjjjjjjjjjj',
  ],
  /* The plate over the middle is the whole message. */
  doorLocked: [
    'jjjjjjjjjjjjjjjj',
    'jJJJJJJJJJJJJJJj',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNqqQQQQQQqqJ j',
    'jJNqQQQQQQQQqJ j',
    'jJNqQQyyyyQQqJ j',
    'jJNqQQyjjyQQqJ j',
    'jJNqQQyjjyQQqJ j',
    'jJNqQQQQQQQQqJ j',
    'jJNqqQQQQQQqqJ j',
    'jJNNjjNNjjNNJJ j',
    'jJNNjjNNjjNNJJ j',
    'jJJJJJJJJJJJJJJj',
    'jjjjjjjjjjjjjjjj',
  ],
  /* Splinters left in the frame — somebody shouldered through here. */
  doorBroken: [
    'jjjjjjjjjjjjjjjj',
    'jJJJj......jJJ j',
    'jJNNj.......jN j',
    'jJNNjj......jN j',
    'jJNNj........j j',
    'jJNj..........j.',
    'jJj...........j.',
    'jj.............j',
    'jJj............j',
    'jJNj.........jNj',
    'jJNNj.......jNNj',
    'jJNNjj.....jJNNj',
    'jJNNj......jJNNj',
    'jJNNj......jJNNj',
    'jJJJj......jJJJj',
    'jjjjjjjjjjjjjjjj',
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
/* ── the eight bodies, at sixteen ─────────────────────────
   Redrawn from eight. The layout is fixed so a kit can be
   painted over any of them without knowing which race it is:

     rows 0–2   above the head — hair, ears, whatever stands up
     rows 3–7   the head. The kit never touches 4–6, so the face
                survives every helmet.
     rows 8–13  the body. This is the kit's.
     rows 14–15 legs and feet.

   'C' is the class tint, filled in at bake time; 'k' is the
   outline, which is the single biggest thing eight pixels could
   not afford and the reason everything used to read as a blob. */
export const RACE_BODY = {
  /* Same rules as the bestiary: two-pixel forms, one lit row on
     the top of each surface, edges in the darkest shade of the
     material rather than in black. The layout is fixed so a kit
     can be painted over any of them without knowing which race it
     is — rows 4–7 are the face and no kit writes there. */
  human: [
    '................',
    '....jjnnnnjj....',
    '...jnnnnnnnnj...',
    '...aAAAAAAAAa...',
    '...aAwwwwwwAa...',
    '...aAkAwwAkAa...',
    '...aAAAAAAAAa...',
    '....aAAwwAAa....',
    '.....aAAAAa.....',
    '...CCCCCCCCCC...',
    '..CCCCCCCCCCCC..',
    '..CCCCCCCCCCCC..',
    '..CCCCC..CCCCC..',
    '...jnnj..jnnj...',
    '...jnnj..jnnj...',
    '..tttt....tttt..',
  ],
  halfElf: [
    '................',
    '....jjNNNNjj....',
    '...jNNNNNNNNj...',
    '.aa aAAAAAAAaaa.',
    'aAaaAwwwwwwAaaAa',
    '.aaaAkAwwAkAaaa.',
    '...aAAAAAAAAa...',
    '....aAAwwAAa....',
    '.....aAAAAa.....',
    '...CCCCCCCCCC...',
    '..CCCCCCCCCCCC..',
    '..CCCCCCCCCCCC..',
    '..CCCCC..CCCCC..',
    '...jnnj..jnnj...',
    '...jnnj..jnnj...',
    '..tttt....tttt..',
  ],
  elf: [
    '................',
    '....uuwwwwuu....',
    '...uwwwwwwwwu...',
    'u..uwWWWWWWwu..u',
    'uu.uwWWWWWWwu.uu',
    '.uuuwkWWWWkwuuu.',
    '...uwWWWWWWwu...',
    '....uwWWWWwu....',
    '.....uwwwwu.....',
    '...CCCCCCCCCC...',
    '..CCCCCCCCCCCC..',
    '..CCCCCCCCCCCC..',
    '..CCCCC..CCCCC..',
    '...unnu..unnu...',
    '...unnu..unnu...',
    '..tttt....tttt..',
  ],
  halfling: [
    '................',
    '................',
    '....jjnnnnjj....',
    '...jnnnnnnnnj...',
    '...aAAAAAAAAa...',
    '...aAkAwwAkAa...',
    '...aAAAAAAAAa...',
    '....aAAwwAAa....',
    '.....aAAAAa.....',
    '..CCCCCCCCCCCC..',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCC..CCCCCC.',
    '..jnnnj..jnnnj..',
    '..jnnnj..jnnnj..',
    '.tttt......tttt.',
  ],
  gnome: [
    '................',
    '..jjNNNNNNNNjj..',
    '.jNNNNNNNNNNNNj.',
    '.jNaAAAAAAAAaNj.',
    '.jNaAwwwwwwAaNj.',
    '..NaAkAwwAkAaN..',
    '..NaAAAAAAAAaN..',
    '...aAAAwwAAAa...',
    '....aAAAAAAa....',
    '....CCCCCCCC....',
    '...CCCCCCCCCC...',
    '..CCCCCCCCCCCC..',
    '..CCCCC..CCCCC..',
    '...jnnj..jnnj...',
    '...jnnj..jnnj...',
    '..tttt....tttt..',
  ],
  dwarf: [
    '................',
    '..jjNNNNNNNNjj..',
    '.jNNNNNNNNNNNNj.',
    '.jNaAAAAAAAAaNj.',
    '.jNaAwwwwwwAaNj.',
    '.jNakAwwwwAkaNj.',
    '.jNNAAAAAAAANNj.',
    '.jNNNNwwwwNNNNj.',
    '..jNNNNNNNNNNj..',
    '..CCCCCCCCCCCC..',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCC..CCCCCC.',
    '..jnnnj..jnnnj..',
    '..jnnnj..jnnnj..',
    '.tttt......tttt.',
  ],
  halfOrc: [
    '................',
    '...ffFFFFFFff...',
    '..fFFFFFFFFFFf..',
    '..fFFFFFFFFFFf..',
    '..fEEkkEEkkEEf..',
    '..fEEEEEEEEEEf..',
    '..feEEEEEEEEef..',
    '..fewwEEEEwwef..',
    '...feEEEEEEef...',
    '..CCCCCCCCCCCC..',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCC..CCCCCC.',
    '..fEEf....fEEf..',
    '..fjjf....fjjf..',
    '.tttt......tttt.',
  ],
  halfTroll: [
    '..ffFFFFFFFFff..',
    '.fFFFFFFFFFFFFf.',
    '.fFFFFFFFFFFFFf.',
    '.fEEEEEEEEEEEEf.',
    '.fEEhhEEEEhhEEf.',
    '.fEEEEEEEEEEEEf.',
    '.feEwwwwwwwwEef.',
    '.feEEEEEEEEEEef.',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCC CCCCCCC',
    'CCCCCCC..CCCCCCC',
    '.fEEEf....fEEEf.',
    '.fjjjf....fjjjf.',
    'tttt........tttt',
  ],
};

/* Painted over the race. '.' means "leave the race showing".
   Each kit owns row 0 (what is on the head) and rows 4–6 (what
   is on the body), and deliberately never touches rows 1–3. */
export const CLASS_KIT = {
  /* Rows 0–3 are what is on the head, rows 8–14 what is on the
     body. Nothing here writes into rows 4–7 — that is the face,
     and a helmet that eats the face is how six classes ended up
     looking like one. */
  warrior: [
    '................',
    '...qQQQQQQQQq...',
    '..qQQQQQQQQQQq..',
    '..qqq......qqq..',
    '................',
    '................',
    '................',
    '................',
    'qQQq........qQQq',
    'qQQqCCCCCCCCqQQq',
    '.qqCCCCCCCCCCqq.',
    '..CCCCCCCCCCCC..',
    '..CCCCC..CCCCC..',
    '................',
    '................',
    '................',
  ],
  mage: [
    '.......ll.......',
    '.....llBBll.....',
    '...llBBBBBBll.n.',
    '.llBBBBBBBBBl n.',
    '..............n.',
    '..............n.',
    '..............V.',
    '..............n.',
    '...lBBBBBBBBl n.',
    '..lBBBBBBBBBBln.',
    '..lBBCCCCCCBBl..',
    '.lBBBCCCCCCBBBl.',
    '.lBBBBBBBBBBBBl.',
    '.lBBBBBBBBBBBBl.',
    '..lBBBBBBBBBBl..',
    '...llBBBBBBll...',
  ],
  priest: [
    '................',
    '....uwwwwwwu....',
    '...uwwwwwwwwu...',
    '...uww....wwu...',
    '...uw......wu...',
    '...uw......wu...',
    '...uw......wu...',
    '....uw....wu....',
    '...uwwwyywwwu...',
    '..uwwwwyywwwwu..',
    '..uwwCCCCCCwwu..',
    '.uwwwCCCCCCwwwu.',
    '.uwwwCC..CCwwwu.',
    '..uwwu....uwwu..',
    '................',
    '................',
  ],
  rogue: [
    '................',
    '....tdddddddt...',
    '...tddddddddd t.',
    '...td......dt...',
    '................',
    '...td......dt...',
    '...tdd....ddt...',
    '...tdddddddd t..',
    '..tdddddddddd t.',
    'QQtdCCCCCCCCd tQ',
    'QQtdCCCCCCCCd tQ',
    '.QtdCCCCCCCCdtQ.',
    '..tCCCCC..CCCt..',
    '................',
    '................',
    '................',
  ],
  ranger: [
    '................',
    '....ffEEEEff....',
    '...fEEEEEEEEf...',
    '...fe......ef...',
    '................',
    '..n.............',
    '.n..............',
    'n...............',
    'n..feEEEEEEef...',
    'n.feEECCCCEEef..',
    'n.feECCCCCCEef..',
    'n..feCCCCCCef...',
    '.n.feCCC..CCef..',
    '..n.fEEf..fEEf..',
    '...n............',
    '................',
  ],
  paladin: [
    '................',
    '...yVyyyyyyVy...',
    '..yqQQQQQQQQqy..',
    '..yqq......qqy..',
    '................',
    '................',
    '................',
    '................',
    'qQQq...yy...qQQq',
    'qQQqCCCyyCCCqQQq',
    '.yqCCCyyyyCCCqy.',
    '..CCCCCyyCCCCC..',
    '..CCCCC..CCCCC..',
    '................',
    '................',
    '................',
  ],
};

export const CLASS_TINT = {
  warrior: 's', mage:   'b', priest: 'W',
  rogue:   'd', ranger: 'e', paladin:'y',
};

const CELL = 8;
const baked = new Map();

/* The grid says how big it is, rather than the file saying every
   grid is eight by eight. Eight pixels is one pixel for a leg and
   one for an eye — there is physically nowhere to put an outline
   or a shade, which is the whole reason the sprites look the way
   they do. The renderer already draws every sprite into a tile-
   sized box, so a 16×16 sheet and an 8×8 one can sit in the same
   file and be redrawn one at a time instead of all at once. */
function bakeGrid(grid, tint) {
  const rows = grid.length || CELL;
  const cols = (grid[0] || '').length || CELL;
  const c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  const x = c.getContext('2d');
  for (let row = 0; row < rows; row++) {
    const line = grid[row] || '';
    for (let col = 0; col < cols; col++) {
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
  /* The composite is the size of the body sheet, so a race drawn
     at sixteen and a kit drawn at sixteen merge at sixteen — and
     an eight-pixel kit over an eight-pixel body still works. */
  const rows = Math.max(body.length, kit.length);
  const cols = Math.max((body[0] || '').length, (kit[0] || '').length);
  const merged = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
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
  /* 마을: the only place above ground. Warm, pale, worn — it has
     to look like daylight next to fifteen floors of wet stone,
     because the contrast is most of what the town is for. */
  town:    { base:'n', grain:'N', mortar:'j', floor:'G', dust:'G',  style:'ashlar' },
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
