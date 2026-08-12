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
  /* ── 후보 C: 둘 사이 ───────────────────────────────────
     8×8의 뭉툭함을 16×16에서 유지한다. 형태는 두 픽셀 단위로
     굵게 가고, 음영은 한 겹만 — 재질의 밝은 색을 위쪽 면에
     한 줄 얹는 정도. 외곽선은 그 재질의 어두운 색이고 검정은
     쓰지 않는다. */
  demoC: [
    '................',
    '...ffffffff.....',
    '..fFFFFFFFFf....',
    '..fFFFFFFFFf..qq',
    '..fEEkkEEkkf..qQ',
    '..fEEEEEEEEf..qQ',
    '..feEEEEEEef.qQQ',
    '..fewwEEwwef.qQ.',
    '.jjJJJJJJJJjjQ..',
    'jjJJJJJJJJJJjj..',
    'jjJJEEEEEEJJjj..',
    '.jJJEEEEEEJJj...',
    '..ffEEEEEEff....',
    '..fFFf..fFFf....',
    '..fjjf..fjjf....',
    '..tttt..tttt....',
  ],

  /* ── 후보 A: 16×16, 세 가지 색 ─────────────────────────
     NES 한 장의 규칙이 타일당 세 가지 색이었다. 계조를 쌓는
     대신 색을 줄이고 형태에 일을 시킨다 — 실루엣이 먼저 읽히고
     안쪽은 거들 뿐이다. */
  demoA: [
    '................',
    '....EEEEEE......',
    '...EEEEEEEE.....',
    '...EEkEEkEE.....',
    '...EEEEEEEE..kk.',
    '...EwEEEEwE..kk.',
    '....EEEEEE...kk.',
    '..nnnnnnnnnnkk..',
    '.nnnnnnnnnnnkk..',
    '.nnEEEEEEnnkk...',
    '.nnEEEEEEnn.....',
    '..EEEEEEEEE.....',
    '..EEEE..EEEE....',
    '..EEE....EEE....',
    '..nn......nn....',
    '................',
  ],
  /* ── 후보 B: 8×8, 같은 규칙으로 다시 ───────────────────
     원래 크기 그대로, 다만 실루엣을 먼저 정하고 그 안을 채운
     것. 투박함이 매력이 되려면 형태가 단호해야 한다. */
  demoB: [
    '.EEEEE..',
    '.EkEkE..',
    '.EEEEE.k',
    'nnnnnnnk',
    'nEEEEEnk',
    '.EEEEE.k',
    '.EE..EE.',
    '.n....n.',
  ],
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
    '................',
    '..kk............',
    '.knnk......kk...',
    'knNNnkkkkkknnk..',
    'knRNnnnnnnnnnk..',
    'knNNNNNNNNNNnkn.',
    '.knnNNNNNNNnknn.',
    '..kknnnnnnnkk.n.',
    '...knk.k.knk..n.',
    '...kk...kk....n.',
    '..............k.',
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
    '................',
    '..kk............',
    '.knnk......kk...',
    'knNwnkkkkkkngk..',
    'knRwnnggnngnnk..',
    'knNNggnnggnNnkn.',
    '.knngnnggnnnknn.',
    '..kknnnnnnnkk.n.',
    '...knk.k.knk..n.',
    '...kk...kk....n.',
    '..............k.',
    '................',
    '................',
    '................',
  ],
  /* Wings wider than the body, which is the only silhouette that reads as a bat. */
  bat: [
    '................',
    '................',
    '..kk........kk..',
    '.kddk......kddk.',
    'kdddk..kk..kddk.',
    'kddkkkdnndkkkddk',
    'kdkddnnnnnnddkdk',
    'kkdddnRnnRnddd kk',
    '..kddnnwwnnddk..',
    '...kkdnnnndkk...',
    '.....kdnnk......',
    '......kkk.......',
    '................',
    '................',
    '................',
    '................',
  ],
  /* Coiled, with the head raised — a straight line reads as a stick. */
  snake: [
    '................',
    '................',
    '.......kkkk.....',
    '......keeeek....',
    '.....keEREEk....',
    '.....keEEEEk....',
    '....kkeewwek....',
    '...keeeeeek.....',
    '..keeekkk.......',
    '.keeek..........',
    'keeek...........',
    'keek............',
    '.kk.............',
    '................',
    '................',
    '................',
  ],
  /* Eight legs that actually read as eight. */
  /* Legs off every corner, and a body small enough that the legs are the shape. */
  /* Thick legs off every corner. Thin ones vanish at a tile this size. */
  spider: [
    '................',
    'kk...........kk.',
    '.kk.........kk..',
    '.kk...kkk...kk..',
    'kk..kkdddkk..kk.',
    '.kkkddddddd kkk.',
    '..kkddRdRddkk...',
    '.kk.kddddd k.kk.',
    'kk..kkdddkk..kk.',
    '.kk..kdddk..kk..',
    '..kk.kdddk.kk...',
    '.kk..kkkkk..kk..',
    'kk...........kk.',
    '................',
    '................',
    '................',
  ],
  /* A patch on the floor, not a creature standing on it. */
  /* Lumpy and low and spreading sideways — the first pass came out a whale. */
  mold: [
    '................',
    '................',
    '..kk...kkk......',
    '.keek.keeek.kk..',
    'keEEekeEEEekeek.',
    'keEeeeeEeEeeeEek',
    '.keeeeeeeeeeeek.',
    'kkeeeeeeeeeeeekk',
    'keEeeeEeeeEeeEek',
    'keeeeeeeeeeeeeek',
    '.keeeeeeeeeeeek.',
    '..kkeeeeeeeeekk.',
    '....kkkkkkkkk...',
    '................',
    '................',
    '................',
  ],
  /* A blob is the right answer here, but a blob with a highlight in it. */
  jelly: [
    '................',
    '................',
    '.....kkkkk......',
    '...kkcccccKk....',
    '..kcccCccccck...',
    '.kccCCcccCCcck..',
    '.kccccccccccck..',
    'kcccWccccWccck..',
    'kcccccccccccck..',
    'kccccccccccccck.',
    '.kcccccccccccK..',
    '.kkccccccccckk..',
    '..kkcccccckk....',
    '....kkkkkk......',
    '................',
    '................',
  ],

  /* humanoids */
  /* Horns, a snout and a spear — the thing that kills more first floors than anything. */
  kobold: [
    '................',
    '................',
    '..k..........k..',
    '..kk.kkkkk..kk..',
    '..knkennnekkn...',
    '...knnNNNnnnk...',
    '...knRNNNRnk....',
    '...knNwwwNnk....',
    '....knNNNnk.....',
    '...knnnnnnnk....',
    '..knnnnnnnnnk.w.',
    '..knnnnnnnnnkkW.',
    '..knnk...knnkw..',
    '...kk.....kk....',
    '..knk.....knk...',
    '..kk.......kk...',
  ],
  /* Redrawn at sixteen. At eight a leg was one pixel and an eye
     was one pixel, so there was nowhere to put a jaw, an outline
     or a shadow — which is most of why everything read as the
     same blob wearing different colours. Same palette, same file,
     four times the room. */
  /* Light from the upper left. Four greens rather than two, edges in the darkest green rather than black, a cleaver held to one side so the silhouette is not a mirror, and a shadow under it so it stands on the floor instead of floating over it. */
  /* A narrower skull, a harness with a lit strap down the middle, arms clear of the body, and the cleaver held out so the silhouette is not a mirror of itself. */
  orc: [
    '................',
    '....ffff........',
    '...fEFFEf...qq..',
    '..fEFFEEEf..qQ..',
    '..fEFEeeEf..qQ..',
    '..fFwkEkwf..qQ..',
    '..feEEEEEf.qQQ..',
    '..fWEeeEWf.qQ...',
    '.fjJjNNNjjfqQ...',
    'fjJNNJJJNNjQ....',
    'fjNNJNNNJNjq....',
    'fjNNJNNNJNnj....',
    '.fjNNJJJNNjf....',
    '..feEfffeEf.....',
    '..fjf...fjf.....',
    '.tttt...tttt....',
  ],
  /* Ears up, muzzle forward, four legs under it. */
  dog: [
    '................',
    '................',
    '..kk.......kk...',
    '.knnk.....knnk..',
    'knNNnkkkkknNNnk.',
    'knNRNnnnnnNRNnk.',
    'knNNNNNNNNNNNnk.',
    '.knNNwwwwwNNnk..',
    '..kknnnnnnnkk...',
    '.knnnnnnnnnnnk..',
    'knnnnnnnnnnnnnk.',
    '.knnk.....knnk..',
    '..knk.....knk...',
    '..kk.......kk...',
    '................',
    '................',
  ],
  /* Heavy enough that the wind-up is worth telegraphing. */
  ogre: [
    '................',
    '....kkNNNkk.....',
    '...kNNNNNNNk....',
    '..kNNnnnnnNNk...',
    '..kNnRNNNRnNk...',
    '..kNnNNNNNnNk...',
    '..kNnwWWWwnNk...',
    '...kNNwwwNNk....',
    'kk..kNNNNNk..kk.',
    'knkknnnnnnnkknk.',
    'knnnnnnnnnnnnnk.',
    '.knnnnnnnnnnnk..',
    '.knnnnk.knnnnk..',
    '..knnk...knnk...',
    '..knnk...knnk...',
    '..kkkk...kkkk...',
  ],
  /* It closes its own wounds, so it should look like there is plenty to close. */
  troll: [
    '................',
    '...kkEEEEEkk....',
    '..kEEEEEEEEEk...',
    '.kEEeeeeeeeEEk..',
    '.kEeRRRERRReEk..',
    '.kEeEEEEEEEeEk..',
    '.kEewWWWWWweEk..',
    '.kEEwwwwwwwEEk..',
    'kkkEEEEEEEEEkkk.',
    'kEEkEEEEEEEkEEk.',
    'kEEkEEEEEEEkEEk.',
    '.kkkEEEEEEEkkk..',
    '...kEEEk EEEk...',
    '...kEEk..kEEk...',
    '...kEEk..kEEk...',
    '...kkkk..kkkk...',
  ],
  /* It fills the tile. That is the whole reading. */
  /* Skin, not bone — the first pass drew the face in bone and it read as blank. */
  giant: [
    '...kkNNNNNkk....',
    '..kNNNNNNNNNk...',
    '.kNNnnnnnnnNNk..',
    '.kNnNNNNNNNnNk..',
    '.kNnNkNNNkNnNk..',
    '.kNnNNNNNNNnNk..',
    '.kNnNwWWWwNnNk..',
    '.kNNnwwwwwnNNk..',
    'kkkkNNNNNNNkkkk.',
    'kggkNNNNNNNkggk.',
    'kggkNNNNNNNkggk.',
    '.kkkNNNNNNNkkk..',
    '...kNNNk.NNNk...',
    '...kNNk...kNk...',
    '...kNNk...kNk...',
    '...kkkk...kkk...',
  ],

  /* undead & horrors */
  /* No feet. It ends in smoke rather than standing on anything. */
  wraith: [
    '................',
    '.....kkkkk......',
    '....kgggggk.....',
    '...kggggggg k...',
    '...kgkGGGkgk....',
    '...kgGRGRGgk....',
    '...kgGGGGGgk....',
    '..kkgggggggkk...',
    '.kgggggggggggk..',
    'kggggggggggggg k',
    'kgggggggggggggk.',
    '.kgg gggggg ggk.',
    '..kg.gggggg.gk..',
    '...k..gggg..k...',
    '.....k.gg.k.....',
    '.......kk.......',
  ],
  /* Wrapping that has come loose in places, which is where the black shows. */
  /* Brown showing between the wrappings, or it is a white sheet. */
  mummy: [
    '................',
    '....kkwwwkk.....',
    '...kwwnnnwwk....',
    '..kwnwwwwwnwk...',
    '..kwnkRwRknwk...',
    '..kwnwwwwwnwk...',
    '..kwwnwwwnwwk...',
    '..kwnwwkwwnwk...',
    '.kkwwnwwwnwwkk..',
    'kwwkwwnwnwwkwwk.',
    'kwwkwnwwwnwkwwk.',
    '.kkwwnwwwnwwkk..',
    '...kwnwk.wnwk...',
    '...kwwk...kwk...',
    '...kwwk...kwk...',
    '...kkkk...kkk...',
  ],
  /* A collar thrown out to either side, and everything else narrow. */
  vampire: [
    '................',
    '....kkkkkkk.....',
    '...kkddddd kk...',
    '..kdkwwwwwkdk...',
    '..kdkwRwRwkdk...',
    '..kdkwwwwwkdk...',
    '..kdkwWWWwkdk...',
    '...kkwwwwwkk....',
    '.kkrrkwwwkrrkk..',
    'krrrrkwwwkrrrrk.',
    'krrrrkdddkrrrrk.',
    '.krrrkdddkrrrk..',
    '..kkrkdddkrkk...',
    '....kkdkdkk.....',
    '.....kk.kk......',
    '................',
  ],
  /* A skull in a robe, holding something lit. Purple is the tell. */
  lich: [
    '................',
    '....kkwwwkk..k..',
    '...kwwwwwwwk.p..',
    '..kwwwwwwwwwk p.',
    '..kwkPwwwPkwkp..',
    '..kwwwwwwwwwkP..',
    '..kwwkwwwkwwkp..',
    '...kwwwwwwwk.p..',
    '..kppkwwwkppkp..',
    '.kppppkwkppppp..',
    '.kpppppppppppk..',
    '..kppppppppp k..',
    '..kpppk.kpppk...',
    '...kpk...kpk....',
    '...kpk...kpk....',
    '...kkk...kkk....',
  ],

  /* dragons & the deep */
  /* Wings out, and the whole thing red enough to be read across a dark room. */
  /* A snout that comes forward out of the wings, and teeth under it. */
  dragon: [
    '................',
    '.kk..........kk.',
    'krrk...kkk...krk',
    'krrrkkrRRrkkrrrk',
    'krrrrRRRRRRrrrrk',
    '.krrRRRRRRRRrrk.',
    '..kRRoRkkRoRRk..',
    '..kRRRRRRRRRk...',
    '.kkRRRwwwRRRkk..',
    'krrRRRRRRRRRrrk.',
    'krrrRRRRRRRrrrk.',
    '.kkrRRRRRRRrkk..',
    '...kRRRk.RRRk...',
    '...kyyk...kyk...',
    '...kyk.....kyk..',
    '...kk.......kk..',
  ],
  /* Long and low, tapering off — nothing about it stands upright. */
  wyrm: [
    '................',
    '...kkkkkkkkk....',
    '..kooooooooo k..',
    '.koooRRRRRoook..',
    '.kooRoooooRook..',
    '.kooooooooooo k.',
    'kkooowwwwwooookk',
    'kookoooooooko ok',
    'koookkkkkkkkoook',
    '.kooooooooooook.',
    '..kkoooooooookk.',
    '....kooooooook..',
    '......kooooo k..',
    '........kookk...',
    '.........kk.....',
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
    '...NN...',
    '..N..W..',
    '.N....W.',
    '.N....W.',
    '.N....W.',
    '.N....W.',
    '..N..W..',
    '...NN...',
  ],
  /* A dog made of what was left after the fire. */
  ashhound: [
    '................',
    '................',
    '..kk.......kk...',
    '.kggk.....kggk..',
    'kgGGgkkkkkgGGgk.',
    'kgGoGggggGGoGgk.',
    'kgGGGGGGGGGGGgk.',
    '.kgGGoooooGGgk..',
    '..kkgggggggkk...',
    '.kgggggggggggk..',
    'kgooggggggoogk..',
    '.kggk.....kggk..',
    '..kgk.....kgk...',
    '..kk.......kk...',
    '................',
    '................',
  ],
  // 화로지기: wide and plated, arms already half-drawn back.
  /* Plate over everything, and a polearm out to one side. */
  warden: [
    '................',
    '....kksssskk....',
    '...ksssssssk....',
    '..ksskwwwkssk...',
    '..kskoRwRokskk..',
    '..kskwwwwwksk.s.',
    '..kskwwkwwkskss.',
    '...kswwwwwsk.ss.',
    '.kkksssssskkkss.',
    'ksssssssssssssk.',
    'ksssgggggggsssk.',
    '.kssgggggggssk..',
    '..kssgggggsskk..',
    '...ksssk ssk....',
    '...kssk..kssk...',
    '...kkkk..kkkk...',
  ],
  // 잿물 먹는 것: a slumped thing, brighter where it has fed.
  /* What is left of somebody who kept walking. */
  ashen: [
    '................',
    '.....kkkkk......',
    '....kdddddk.....',
    '...kddwwwddk....',
    '...kdwoRowdk....',
    '...kdwwwwwdk....',
    '...kdwkwkwdk....',
    '....kddwwddk....',
    '..kkddddddd kk..',
    '.kddddddddddd k.',
    'kdddoooooodddd k',
    '.kdddddddddddk..',
    '..kddddddddkk...',
    '...kddk.kddk....',
    '...kdk...kdk....',
    '...kkk...kkk....',
  ],
  // 화로의 사제: robed, and holding the mark it is about to draw.
  /* Robed and carrying a light that is not a torch. */
  emberpriest: [
    '................',
    '.....kkkkk...k..',
    '....koooook..o..',
    '...kooooooo k.o.',
    '...kokRoRkok.y..',
    '...koooooook.o..',
    '...kokoooko k.o.',
    '....koooook..o..',
    '..kkroooookkro..',
    '.krrroooorrrrk..',
    '.krrrrooorrrrk..',
    '..krrrooorrrk...',
    '..kkrrooorrkk...',
    '....krrorrk.....',
    '.....krrrk......',
    '......kkk.......',
  ],
  // 잿더미 속의 것: a heap, until the moment it is not.
  /* A pile that turns out to be looking at you. */
  ashheap: [
    '................',
    '................',
    '................',
    '.....kkkkk......',
    '...kkdddddkk....',
    '..kddoddoddk....',
    '.kdddddddddd k..',
    'kddoddddddoddk..',
    'kdddddddddddd k.',
    'kdodddddddddodk.',
    'kdddddddddddddk.',
    '.kdddddddddddk..',
    '..kkddddddd kk..',
    '....kkkkkkk.....',
    '................',
    '................',
  ],
  /* Crowned, and the crown is the only gold on it. Fifteen floors of this. */
  balemperor: [
    '..k..kkyyykk..k.',
    '..ky.kyyyyyk.yk.',
    '..kykkoooookkyk.',
    '..kkkoRoooRokkk.',
    '...koooooooo k..',
    '...koookookok...',
    '...kooowwwook...',
    '..kkooooooookk..',
    '.krroooooooorrk.',
    'krrrrooyoorrrrk.',
    'krrrroyyyorrrrk.',
    '.krrrooyoorrrk..',
    '..kkrroooorrkk..',
    '...krroooorrk...',
    '...kkrrk krrkk..',
    '.....kk...kk....',
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
  /* Masked, and already carrying somebody else's purse. */
  thief: [
    '................',
    '................',
    '.....kdddk......',
    '....kddddd k....',
    '...kddNNNddk....',
    '...kdNkNkNdk....',
    '...kdNNNNNdk....',
    '....kdNNNdk.....',
    '....kddddd k....',
    '..y.kdddddk.....',
    '.kyykdddddk.....',
    '.kyykdddddkk....',
    '..y.kddk.kdk....',
    '....kdk...kk....',
    '....kkk.........',
    '................',
  ],
  /* A little heap with one coin standing on edge. */
  gold: [
    '................',
    '................',
    '................',
    '.......kkk......',
    '......kyyyk.....',
    '.....kyWyyk.....',
    '..kkkkyyyykkk...',
    '.kyyyyyyyyyyyk..',
    'kyWyyyyyyyyyyyk.',
    'kyyyykyyyykyyyk.',
    '.kkyyyyyyyyykk..',
    '...kkyyyyykk....',
    '.....kkkkk......',
    '................',
    '................',
    '................',
  ],

  /* terrain features */
  /* Rings going down into black, which is the only thing this game asks you to do. */
  /* Steps stepping away from you into black. The rings read as a target. */
  stairsDown: [
    'kkkkkkkkkkkkkkkk',
    'kGGGGGGGGGGGGGGk',
    'kGGGGGGGGGGGGGGk',
    'kkkkkkkkkkkkkkkk',
    'kggggggggggggggk',
    'kggggggggggggggk',
    'kkkkkkkkkkkkkkkk',
    '.kdddddddddddddk',
    '.kdddddddddddddk',
    '.kkkkkkkkkkkkkkk',
    '..kkkkkkkkkkkkkk',
    '..kkkkkkkkkkkkkk',
    '..kkkkkkkkkkkkkk',
    '...kkkkkkkkkkkkk',
    '...kkkkkkkkkkkkk',
    '................',
  ],
  /* The same rings, lit at the middle instead of black. */
  /* The same steps climbing toward light instead of away into it. */
  stairsUp: [
    '................',
    '...WWWWWWWWWWWW.',
    '...WWWWWWWWWWWW.',
    '..kkkkkkkkkkkkk.',
    '..GGGGGGGGGGGGG.',
    '..GGGGGGGGGGGGG.',
    '.kkkkkkkkkkkkkk.',
    '.gggggggggggggg.',
    '.gggggggggggggg.',
    'kkkkkkkkkkkkkkkk',
    'dddddddddddddddd',
    'dddddddddddddddd',
    'kkkkkkkkkkkkkkkk',
    'gggggggggggggggg',
    'gggggggggggggggg',
    'kkkkkkkkkkkkkkkk',
  ],
  /* Planks, a frame and a handle. A shut door has to look shut. */
  door: [
    'kkkkkkkkkkkkkkkk',
    'kNNNNNNNNNNNNNNk',
    'kNnnnnnnnnnnnnNk',
    'kNnNNNNNNNNNNnNk',
    'kNnNnnnnnnnnNnNk',
    'kNnNnNNNNNNnNnNk',
    'kNnNnNNNNNNnNnNk',
    'kNnNnNNyyNNnNnNk',
    'kNnNnNNyyNNnNnNk',
    'kNnNnNNNNNNnNnNk',
    'kNnNnNNNNNNnNnNk',
    'kNnNnnnnnnnnNnNk',
    'kNnNNNNNNNNNNnNk',
    'kNnnnnnnnnnnnnNk',
    'kNNNNNNNNNNNNNNk',
    'kkkkkkkkkkkkkkkk',
  ],
  /* Loose stone, scattered. Not a texture — pieces with edges on them. */
  rubble: [
    '................',
    '................',
    '.......kk.......',
    '..kk..kGGk......',
    '.kGGk.kGgk..kk..',
    '.kGgk..kk..kGGk.',
    '..kk......kGggk.',
    '.....kkk...kGgk.',
    '....kGGGk...kk..',
    '..kkGgggGk......',
    '.kGGkgggkk...kk.',
    '.kGgk.kk....kGGk',
    '..kk.........kgk',
    '..............k.',
    '................',
    '................',
  ],

  /* A chest and a mimic share a silhouette on purpose — the
     mimic only gives itself away by breathing (see ui.js). */
  /* A band across the middle and a keyhole under it. */
  chest: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kNNNNNNNNNNNNk.',
    'kNnnnnnnnnnnnnNk',
    'kNnNNNNNNNNNNnNk',
    'kyyyyyyyyyyyyyyk',
    'kNnNNNNyyNNNNnNk',
    'kNnNNNNykNNNNnNk',
    'kNnNNNNNNNNNNnNk',
    'kNnnnnnnnnnnnnNk',
    'kNNNNNNNNNNNNNNk',
    'kyNNNNNNNNNNNNyk',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
  /* A chest with a full set of teeth in it. */
  mimic: [
    '................',
    '................',
    '..kkkkkkkkkkk...',
    '.knnnnnnnnnnn k.',
    'knNNNNNNNNNNNnk.',
    'knNWkWkWkWkWNnk.',
    'knNwwwwwwwwwNnk.',
    'kn.kwkwkwkwk.nk.',
    'knRnnnnnnnnnRnk.',
    'knnnnnnnnnnnnnk.',
    'knNNNNNNNNNNNnk.',
    '.knnnnnnnnnnnk..',
    '..kkkkkkkkkkk...',
    '................',
    '................',
    '................',
  ],
  /* Shopkeeper — the C channel is tinted per shop, same trick
     the hero uses for classes. Drawn as a torso behind a counter
     because he is standing in a shopfront, not walking about. */
  /* A person behind a cart, tinted a different colour for each of the six. */
  keeper: [
    '................',
    '.....kkkkk......',
    '....kCCCCCk.....',
    '...kCnnnnnCk....',
    '...kNwWWWwNk....',
    '...kNkWWWkNk....',
    '...kNWWWWWNk....',
    '....kNWkWNk.....',
    '.....kNNNk......',
    '...kkCCCCCkk....',
    '..kCCCCCCCCCk...',
    '..kCCCCCCCCCk...',
    '..kCCCCyCCCCk...',
    '..kCCCC.CCCCk...',
    '...kCCk.kCCk....',
    '...knnk.knnk....',
  ],
  /* A blank plank. The shop's goods sprite is drawn on top, and
     the goods sprites all have transparent margins, so the plank
     reads as a frame around the icon. */
  /* A plank on a post. What is painted on it is drawn over the top. */
  sign: [
    '................',
    '..kkkkkkkkkkkk..',
    '.kNNNNNNNNNNNNk.',
    'kNnnnnnnnnnnnnNk',
    'kNn..........nNk',
    'kNn..........nNk',
    'kNn..........nNk',
    'kNn..........nNk',
    'kNn..........nNk',
    'kNnnnnnnnnnnnnNk',
    '.kNNNNNNNNNNNNk.',
    '..kkkknnkkkkkk..',
    '......knk.......',
    '......knk.......',
    '.....kknkk......',
    '................',
  ],
  /* The ? room. A question mark on a stone marker — the one
     glyph the player will read before they read the prose. */
  /* A question mark. It is a gamble, and it should say so from across the room. */
  event: [
    '................',
    '.....kkkkk......',
    '....kPPPPPk.....',
    '...kPPkkkPPk....',
    '...kPk...kPk....',
    '...kk....kPk....',
    '........kPPk....',
    '.......kPPk.....',
    '......kPPk......',
    '......kPk.......',
    '......kkk.......',
    '................',
    '......kkk.......',
    '.....kPPPk......',
    '.....kPPPk......',
    '......kkk.......',
  ],
  /* The anvil. A dark block on a stump with a spark coming off
     the horn — it has to read as "hit things here" at 24px. */
  /* The horn on one side and the block under it. It is not spent, ever. */
  anvil: [
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..ksssssssssk...',
    '.ksssssssssssk..',
    'ksssssssssssssk.',
    '.kkssssssssskk..',
    '...kkssssskk....',
    '.....kssssk.....',
    '.....ksssk......',
    '....kssssssk....',
    '...ksssssssk....',
    '...knnnnnnnk....',
    '..knnnnnnnnnk...',
    '..kkkkkkkkkkk...',
    '................',
  ],
  /* Staves and three iron hoops. */
  barrel: [
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kNNNNNNNNNNk..',
    '.kNnnnnnnnnnnNk.',
    '.kssssssssssssk.',
    '.kNnNNNNNNNNnNk.',
    '.kNnNNNNNNNNnNk.',
    '.kssssssssssssk.',
    '.kNnNNNNNNNNnNk.',
    '.kNnNNNNNNNNnNk.',
    '.kssssssssssssk.',
    '.kNnnnnnnnnnnNk.',
    '..kNNNNNNNNNNk..',
    '...kkkkkkkkkk...',
    '................',
  ],
  /* A cold bowl on a stem. Nothing in it but ash. */
  brazier: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.ksssssssssssk..',
    '.kskddddddddksk.',
    '.kskdddddddd ksk',
    '..kssssssssssk..',
    '...kkssssskk....',
    '.....ksssk......',
    '.....ksssk......',
    '.....ksssk......',
    '....kssssssk....',
    '...kssssssssk...',
    '..kssssssssssk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  /* The same bowl with something in it, throwing its own light. */
  brazierLit: [
    '................',
    '.......o........',
    '......oyo.......',
    '.....oyWyo..o...',
    '....ooyWyoooyo..',
    '.kskooyyyooooksk',
    '..kssoooooosssk.',
    '...kkssssskk....',
    '.....ksssk......',
    '.....ksssk......',
    '.....ksssk......',
    '....kssssssk....',
    '...kssssssssk...',
    '..kssssssssssk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  /* The town's middle. Everything in this game is a corridor or
     a shopfront; the plaza needed one thing that is neither —
     something people would have stood around before the deep
     place opened underneath them. */
  /* A stone rim and water in it. Still clear; nobody left to draw it. */
  well: [
    '................',
    '..kkkkkkkkkkkk..',
    '.kGGGGGGGGGGGGk.',
    '.kGggggggggggGk.',
    '.kGgkkkkkkkkgGk.',
    '.kGgkbbbbbbkgGk.',
    '.kGgkbBBBBbkgGk.',
    '.kGgkbBWWBbkgGk.',
    '.kGgkbBBBBbkgGk.',
    '.kGgkbbbbbbkgGk.',
    '.kGgkkkkkkkkgGk.',
    '.kGggggggggggGk.',
    '.kGGGGGGGGGGGGk.',
    '..kGGGGGGGGGGk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  /* A stall front: cloth over poles. Reads as market rather than
     as furniture to smash. */
  /* Striped cloth over poles with a crate under it. */
  stall: [
    'krrrrrrrrrrrrrrk',
    'krWWrrWWrrWWrrrk',
    'krrrrrrrrrrrrrrk',
    '.kkkkkkkkkkkkkk.',
    '..n..........n..',
    '..n..........n..',
    '..n.kkkkkkkk.n..',
    '..n.kNNNNNNk.n..',
    '..n.kNwwwwNk.n..',
    '..n.kNwyywNk.n..',
    '..n.kNwwwwNk.n..',
    '..n.kNNNNNNk.n..',
    '..n.kkkkkkkk.n..',
    '..n..........n..',
    '..k..........k..',
    '................',
  ],
  /* Capital, shaft, base — three things, so it reads as built rather than dropped. */
  pillar: [
    '.kkkkkkkkkkkkkk.',
    '.kGGGGGGGGGGGGk.',
    '.kGggggggggggGk.',
    '..kkGGGGGGGGkk..',
    '...kGgggggggk...',
    '...kGgGGGGggk...',
    '...kGgGggGggk...',
    '...kGgGggGggk...',
    '...kGgGggGggk...',
    '...kGgGggGggk...',
    '...kGgGGGGggk...',
    '...kGgggggggk...',
    '..kkGGGGGGGGkk..',
    '.kGGGGGGGGGGGGk.',
    '.kGgggggggggggk.',
    '.kkkkkkkkkkkkkk.',
  ],
  /* A skull and what is left of the ribs, not a pile of sticks. */
  bones: [
    '................',
    '................',
    '....kkwwwkk.....',
    '...kwWWWWWwk....',
    '...kwkWWWkwk....',
    '...kwWWWWWwk....',
    '....kwWkWwk.....',
    '.....kwwwk......',
    '..k..kkkkk..k...',
    '.kwk.......kwk..',
    'kwWwkkkkkkkwWwk.',
    '.kwkwWWWWWwkwk..',
    '..k.kwwwwwk..k..',
    '.....kkkkk......',
    '................',
    '................',
  ],
  /* A painted jar. Somebody made this before the deep place opened. */
  urn: [
    '................',
    '.....kkkkk......',
    '....kNNNNNk.....',
    '...kNnnnnnNk....',
    '..kNNNNNNNNNk...',
    '.kNnNNNNNNNnNk..',
    '.kNnNyyyyyNnNk..',
    'kNnNNyNNNyNNnNk.',
    'kNnNNyNNNyNNnNk.',
    'kNnNNyyyyyNNnNk.',
    '.kNnNNNNNNNnNk..',
    '.kNNnnnnnnnNNk..',
    '..kNNNNNNNNNk...',
    '...kkkkkkkkk....',
    '................',
    '................',
  ],
  /* A slab with something standing over it that has not gone out. */
  altar: [
    '................',
    '.......y........',
    '......yYy.......',
    '.....yyWyy......',
    '......yYy.......',
    '.......y........',
    '..kkkkkkkkkkk...',
    '.kGGGGGGGGGGGk..',
    '.kGgggggggggGk..',
    '..kGGGGGGGGGk...',
    '...kGgggggGk....',
    '...kGgggggGk....',
    '..kGGGGGGGGGk...',
    '.kGGGGGGGGGGGk..',
    '.kkkkkkkkkkkkk..',
    '................',
  ],
  /* A flame with logs crossed under it. The one place you get anything back. */
  camp: [
    '................',
    '.......o........',
    '......oyo.......',
    '.....oyWyo......',
    '....ooyWyoo.....',
    '....ooyyyoo.....',
    '.....ooooo......',
    '......ooo.......',
    '..k.kkkkkkk.k...',
    '.knnnnnnnnnnnk..',
    'knnnknnnnnknnnk.',
    '.kknnnnnnnnnkk..',
    '...kkknnnkkk....',
    '......kkk.......',
    '................',
    '................',
  ],
  /* Grey logs and one thread of smoke. Nothing left in it. */
  campSpent: [
    '................',
    '................',
    '................',
    '................',
    '.........k......',
    '......k..d......',
    '.....kd.kd......',
    '......d.k.......',
    '..k.kkkkkkk.k...',
    '.kgggggggggg k..',
    'kgggkggggg kggk.',
    '.kkgggggggggkk..',
    '...kkkgggkkk....',
    '......kkk.......',
    '................',
    '................',
  ],
  /* Radials and rings. Eight pixels could only manage a cross. */
  /* Radials crossed by strands. Rings made it a star. */
  web: [
    'k......k......k.',
    '.k.....k.....k..',
    '..k....k....k...',
    '...k...k...k....',
    'kkkkkkkGkkkkkkk.',
    '....k..G..k.....',
    '.kkkkkkGkkkkkk..',
    '.....k.G.k......',
    'kkkkkkkGkkkkkkk.',
    '....k..G..k.....',
    '...k...k...k....',
    '..k....k....k...',
    '.k.....k.....k..',
    'k......k......k.',
    '................',
    '................',
  ],
  /* Ripples spread over the tile rather than one blob in the middle. */
  water: [
    '................',
    'bbbbbbbbbbbbbbbb',
    'bbBbbbbbbBbbbbbb',
    'bBBBbbbbBBBbbbbb',
    'bbBbbbbbbBbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbBbbbbbbbBbb',
    'bbbbBBBbbbbbBBBb',
    'bbbbbBbbbbbbbBbb',
    'bbbbbbbbbbbbbbbb',
    'bbBbbbbbbbBbbbbb',
    'bBBBbbbbbBBBbbbb',
    'bbBbbbbbbbBbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
  ],
  /* Teeth closing on a gap. Only drawn once you have spotted it. */
  trap: [
    '................',
    '................',
    '..k..........k..',
    '.krk........krk.',
    '.krrk......krrk.',
    '..krrkkkkkkrrk..',
    '...krrrrrrrrk...',
    '....krrrrrrk....',
    '....krrrrrrk....',
    '...krrrrrrrrk...',
    '..krrkkkkkkrrk..',
    '.krrk......krrk.',
    '.krk........krk.',
    '..k..........k..',
    '................',
    '................',
  ],
  /* Swung back against the jamb, and the way through is empty. */
  doorOpen: [
    'kkkkkkkkkkkkkkkk',
    'kNNNNk.........k',
    'kNnnNk.........k',
    'kNnNNk.........k',
    'kNnNnk.........k',
    'kNnNnk.........k',
    'kNnNnk.........k',
    'kNnyNk.........k',
    'kNnyNk.........k',
    'kNnNnk.........k',
    'kNnNnk.........k',
    'kNnNnk.........k',
    'kNnNNk.........k',
    'kNnnNk.........k',
    'kNNNNk.........k',
    'kkkkkkkkkkkkkkkk',
  ],
  /* The plate over the middle is the whole message. */
  doorLocked: [
    'kkkkkkkkkkkkkkkk',
    'kNNNNNNNNNNNNNNk',
    'kNnnnnnnnnnnnnNk',
    'kNnNNNNNNNNNNnNk',
    'kNnNnnnnnnnnNnNk',
    'kNnNnNsssssnNnNk',
    'kNnNnNsyyysnNnNk',
    'kNnNnNsyksynNnNk',
    'kNnNnNsykkynNnNk',
    'kNnNnNsyyysnNnNk',
    'kNnNnNsssssnNnNk',
    'kNnNnnnnnnnnNnNk',
    'kNnNNNNNNNNNNnNk',
    'kNnnnnnnnnnnnnNk',
    'kNNNNNNNNNNNNNNk',
    'kkkkkkkkkkkkkkkk',
  ],
  /* Splinters left in the frame — somebody shouldered through here. */
  doorBroken: [
    'kkkkkkkkkkkkkkkk',
    'kNNNk......kNNNk',
    'kNnnk.......kNnk',
    'kNnNNk......kNnk',
    'kNnNnk.....kNnNk',
    'kNnNk.......kNnk',
    'kNnk.........kNk',
    'kNk...........kk',
    'kNnk..........kk',
    'kNnNk........kNk',
    'kNnNnk......kNnk',
    'kNnNnk.....kNnNk',
    'kNnNNk......kNnk',
    'kNnnk.......kNnk',
    'kNNNk......kNNNk',
    'kkkkkkkkkkkkkkkk',
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
  /* Skin is tan with a bone highlight and black features, not
     bone with black features — the first pass drew every face in
     'w'/'W' and they came out as blank white ovals. Value, not
     hue, is what makes a face read at this size. */
  human: [
    '................',
    '.....kkkkk......',
    '....knnnnnk.....',
    '...knNNNNNnk....',
    '...kNwWWWwNk....',
    '...kNkWWWkNk....',
    '...kNWWWWWNk....',
    '....kNWkWNk.....',
    '.....kNNNk......',
    '....kCCCCCk.....',
    '...kCCCCCCCk....',
    '...kCCCCCCCk....',
    '...kCC.k.CCk....',
    '....kCk.kCk.....',
    '....knk.knk.....',
    '....kkk.kkk.....',
  ],
  // Half-elf: a little of the point, a little of the height.
  halfElf: [
    '................',
    '.....kkkkk......',
    '....kNNNNNk.....',
    '..kknNNNNNnkk...',
    '.kNkNwWWWwNkNk..',
    '..kkNkWWWkNkk...',
    '...kNWWWWWNk....',
    '....kNWkWNk.....',
    '.....kNNNk......',
    '....kCCCCCk.....',
    '...kCCCCCCCk....',
    '...kCCCCCCCk....',
    '...kCC.k.CCk....',
    '....kCk.kCk.....',
    '....knk.knk.....',
    '....kkk.kkk.....',
  ],
  // Elf: pale, and the ears stand clear of the head.
  elf: [
    '................',
    '.....kkkkk......',
    '....kwwwwwk.....',
    '.k.kwWWWWWwk.k..',
    'kwkkwWWWWWwkkwk.',
    '.kwkwkWWWkwkwk..',
    '..kkwWWWWWwkk...',
    '....kwWkWwk.....',
    '.....kwwwk......',
    '....kCCCCCk.....',
    '...kCCCCCCCk....',
    '...kCCCCCCCk....',
    '...kCC.k.CCk....',
    '....kCk.kCk.....',
    '....knk.knk.....',
    '....kkk.kkk.....',
  ],
  // Halfling: small, low, wide-footed. Sits low in the tile.
  halfling: [
    '................',
    '................',
    '................',
    '.....kkkkk......',
    '....knnnnnk.....',
    '...knNwWwNnk....',
    '...kNkWWWkNk....',
    '...kNWWWWWNk....',
    '....kNNwNNk.....',
    '...kCCCCCCCk....',
    '..kCCCCCCCCCk...',
    '..kCCCCCCCCCk...',
    '..kCCC.k.CCCk...',
    '...kCCk.kCCk....',
    '...knnk.knnk....',
    '..kknnk.knnkk...',
  ],
  // Gnome: the head is half of him, and the hair is half of that.
  gnome: [
    '................',
    '..kkNNNNNNNkk...',
    '.kNNNNNNNNNNNk..',
    '.kNNnnnnnnnNNk..',
    '.kNnNwWWWwNnNk..',
    '..knNkWWWkNnk...',
    '..knNWWWWWNnk...',
    '...knNWkWNnk....',
    '....kNNNNNk.....',
    '....kCCCCCk.....',
    '....kCCCCCk.....',
    '...kCCCCCCCk....',
    '...kCC.k.CCk....',
    '....kCk.kCk.....',
    '....knk.knk.....',
    '....kkk.kkk.....',
  ],
  // Dwarf: broad, and the beard is most of the face.
  dwarf: [
    '................',
    '...kkNNNNNkk....',
    '..kNNNNNNNNNk...',
    '..kNnnnnnnnNk...',
    '..knNwWWWwNnk...',
    '..knkWWWWWknk...',
    '..kNwWWWWWwNk...',
    '..kNNwwwwwNNk...',
    '...kNNNNNNNk....',
    '..kCCCCCCCCCk...',
    '.kCCCCCCCCCCCk..',
    '.kCCCCCCCCCCCk..',
    '.kCCCC.k.CCCCk..',
    '..kCCCk.kCCCk...',
    '..knnnk.knnnk...',
    '..kknnk.knnkk...',
  ],
  // Half-orc: green, jawed, tusks standing up from the lip.
  halfOrc: [
    '................',
    '....kkeeekk.....',
    '...keeeeeeek....',
    '..keEEEEEEEek...',
    '..keEeEEEeEek...',
    '..keERWWWREek...',
    '..keEEEEEEEek...',
    '..kwkEEEEEkwk...',
    '...kWkEEEkWk....',
    '...kCCCCCCCk....',
    '..kCCCCCCCCCk...',
    '..kCCCCCCCCCk...',
    '..kCCCC.CCCCk...',
    '...kCCk.kCCk....',
    '...knnk.knnk....',
    '...kknk.knkk....',
  ],
  // Half-troll: fills the tile. Nothing else does.
  halfTroll: [
    '...kkEEEEEkk....',
    '..kEEEEEEEEEk...',
    '.kEEeeeeeeeEEk..',
    '.kEeEEEEEEEeEk..',
    '.kEeEkEEEkEeEk..',
    '.kEeERWWWREeEk..',
    '.kEeEEEEEEEeEk..',
    '.kwEeEEEEEeEwk..',
    '.kWkEeEEEeEkWk..',
    '.kCCCCCCCCCCCk..',
    'kCCCCCCCCCCCCCk.',
    'kCCCCCCCCCCCCCk.',
    'kCCCCC.k.CCCCCk.',
    '.kCCCCk.kCCCCk..',
    '.knnnnk.knnnnk..',
    'kknnnnk.knnnnkk.',
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
  // 전사: a browed helm, shoulder plates, a blade down one side.
  warrior: [
    '................',
    '....kssssssk....',
    '...ksssssssk....',
    '...ks.....sk....',
    '................',
    '................',
    '................',
    '................',
    '..ksskCCCkssk...',
    '.ksssCCCCCssskw.',
    '.kssCCCCCCCsskW.',
    '..kCCCCCCCCCkW..',
    '...kCCCkCCCk.W..',
    '................',
    '................',
    '................',
  ],
  // 마법사: pointed hat, long robe, a staff down the right.
  mage: [
    '.......kk.......',
    '......kbbk......',
    '.....kbbbbk...n.',
    '...kkbbbbbbkk.n.',
    '..............n.',
    '..............n.',
    '..............y.',
    '..............n.',
    '....kbbbbbbk..n.',
    '...kbbbbbbbbk.n.',
    '...kbbCCCCbbk.n.',
    '..kbbCCCCCCbbkn.',
    '..kbbbCCCCbbbk..',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..kkbbbbbbbbkk..',
  ],
  // 사제: a hood and a pale mantle, with a mark at the throat.
  priest: [
    '................',
    '.....kWWWk......',
    '....kWWWWWk.....',
    '...kWW...WWk....',
    '...kW.....Wk....',
    '...kW.....Wk....',
    '...kW.....Wk....',
    '....kW...Wk.....',
    '....kWWyWWk.....',
    '...kWWWyWWWk....',
    '..kWWCCyCCWWk...',
    '..kWWCCCCCWWk...',
    '..kWWCC.CCWWk...',
    '...kWWk.kWWk....',
    '................',
    '................',
  ],
  // 도적: a low hood, a wrapped face, two short blades.
  rogue: [
    '................',
    '.....kdddk......',
    '....kdddddk.....',
    '...kddddddd k...',
    '...kd.....dk....',
    '................',
    '...kd.....dk....',
    '...kdd...ddk....',
    '..kddCCCCCddk...',
    '.wkdCCCCCCCdkw..',
    'WskdCCCCCCCdksW.',
    '.wk.CCCCCCC.kw..',
    '...kCCC.CCCk....',
    '................',
    '................',
    '................',
  ],
  // 레인저: a hood thrown back, a cloak, the bow across the back.
  ranger: [
    '................',
    '.....keeek......',
    '....keeeeek.....',
    '...ke.....ek....',
    '................',
    '..n.............',
    '.n..............',
    'n...............',
    'n..keeCCCeek....',
    'n.keeeCCCeeek...',
    'n.keeCCCCCeek...',
    'n..keCCCCCek....',
    '.n.keCCCkCek....',
    '..n.kek.kek.....',
    '...n............',
    '................',
  ],
  // 팔라딘: a crowned great-helm and a tabard with a mark on it.
  paladin: [
    '................',
    '....kyyyyyyk....',
    '...kyssssssyk...',
    '...ks......sk...',
    '................',
    '................',
    '................',
    '................',
    '..kyykCCCkyyk...',
    '.kyssCCyCCssyk..',
    '.kysCCyyyCCsyk..',
    '..kCCCCyCCCCk...',
    '...kCCCkCCCk....',
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
  town:    { base:'n', grain:'N', mortar:'k', floor:'G', dust:'g',  style:'ashlar' },
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
