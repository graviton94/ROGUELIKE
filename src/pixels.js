/* ═══════════════════════════════════════════════════════════
   pixels.js — every graphic in this game is a string in here.
   No image files. Sprites are 8×8 character grids; each char
   indexes PALETTE. Bake once at boot, blit scaled thereafter.
   ═══════════════════════════════════════════════════════════ */

/* ── the console palette ──────────────────────────────────
   Redesigned from scratch around an 8-bit home-console look:
   true black, deep indigo shadow, and saturated primaries with
   every channel quantized to 8-step DAC values (#x8), the way
   the old PPUs actually mixed colour. The keys are a contract —
   sprites, juice.js, terrain and styles.css all speak them —
   only the values changed. */
export const PALETTE = {
  '.': null,          // transparent

  /* 두 번 잡았다. 한 번은 0x72 DungeonTileset II(CC0)를 픽셀 단위로
     세어 램프 규칙을 얻었고(아래), 한 번은 톤을 위해 채도를 걷어냈다.
     시트를 같은 자로 재 보니 우리 저채도 비율은 19%인데 저쪽은 55%
     였다 — 그게 「전부 채도가 높아 진흙처럼 보이는」 이유였고, 동시에
     이 게임이 가려는 곳(다크소울·디아블로)과 가장 먼 지점이었다.
     남보라를 쇠와 재의 회색으로 내리고, 채도는 상처와 불에만 남겼다.

     값은 0x72 DungeonTileset II(CC0)를 픽셀 단위로 세어 다시 잡았다.
     에셋을 가져온 것이 아니라 규칙을 가져왔다 (proto/STYLE.md):
       · 외곽선은 순검정이 아니라 색이 든 짙은 색 하나 — 시트의 35%가 그 한 색
       · 램프는 어두울수록 붉게, 밝을수록 노랗게 색조를 민다 (H4 → H12 → H24 → H37)
       · 저채도가 55%, 고채도는 강조에만
     키는 계약이라 그대로 두고 값만 옮겼다. 스프라이트·juice·지형이
     전부 이 키를 부르므로, 여기 한 곳을 고치면 전부 함께 바뀐다. */
  k: '#0e0b10',       // 외곽선과 어둠 — 순검정이 아니다
  d: '#16131a',       // 그을린 돌 — 바닥, 패널
  g: '#3e3a40',       // 그늘 속의 돌 — 쇠와 재의 회색
  G: '#8a8378',       // 빛 받은 돌 — 따뜻한 석회
  w: '#d8cdb4',       // 뼈 — 밝은 끝은 노랑 쪽으로
  W: '#fdf7ed',       // 흰 섬광
  r: '#5e0f1c',       // 마른 피 — 어두운 끝은 보라 쪽으로
  R: '#c8322c',       // 상처의 붉은색
  o: '#d4741f',       // 잉걸불
  y: '#d8b048',       // 낡은 금
  n: '#5e3a1c',       // 가죽 — 어두운 끝
  N: '#c8955c',       // 무두질한 가죽
  e: '#254a2a',       // 이끼와 부패
  E: '#6a9a4c',       // 병든 초록
  b: '#1c2c4a',       // 고인 물
  B: '#5a7fa8',       // 창백한 물빛
  p: '#472150',       // 곰팡이 자주
  P: '#9a6ab0',       // 시든 난초
  c: '#2c7a76',       // 녹슨 청록
  s: '#98a0b8',       // steel

  /* ── 결(grit) — 바닥과 벽에만 쓰는, 바탕보다 한 걸음만 밝은 톤 ──
     0x72 시트를 픽셀 단위로 세어 보니 한 물체가 쓰는 색은 중앙값 5개였고,
     대비는 물체 **안**이 아니라 물체와 배경 **사이**에 있었다 (외곽 픽셀의
     94%가 V<64, 내부보다 평균 85 어둡다). 이 게임의 바닥은 정반대였다 —
     바탕 #181830 위에 #484878 점을 칸마다 넷씩 뿌려서, 화면 전체가
     텔레비전 노이즈로 읽혔다. 결은 바탕 옆에 붙어 있어야 한다. */
  A: '#1d1a20',       // 평범한 돌바닥의 결
  D: '#2a1a0e',       // 좁은 굴 — 흙과 뿌리
  F: '#4f4a48',       // 큰 방 — 밝은 바닥 위의 결
  H: '#182634',       // 물에 잠긴 층 — 젖은 자국
  J: '#241c28',       // 소굴 — 오래된 거미줄
};

/* ── the bestiary, drawn ─────────────────────────────────── */
export const SPRITES = {
  /* player — recolored per class at bake time via tint keys */
  hero: [
    '..nnnn..',
    '.nwwwwn.',
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
  /* 굶은 들쥐 — the same animal after a bad month. Longer, greyer,
     ribs showing, and one red eye, so a glance at the tile says
     "not the one you have been killing" before the name does. */
  lean: [
    '........',
    '.g....g.',
    'ggGggGgg',
    'GGkGGRGG',
    '.GgGgGg.',
    'gG.gg.Gg',
    'g.g..g.g',
    '......gg',
  ],
  /* Cave bat — violet, not grey: grey wings vanished into the
     new indigo floors the moment the palette got darker. */
  bat: [
    '........',
    'p......p',
    'pp.pp.pp',
    '.pPPPPp.',
    '.pRPPRp.',
    '..pPPp..',
    '...pp...',
    '........',
  ],
  snake: [
    '........',
    '..EEE...',
    '.Ek.kE..',
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
  /* Wraith — lifted a full shade: the old charcoal body was
     invisible against a true-black void. */
  wraith: [
    '..gggg..',
    '.gGGGGg.',
    '.gBggBg.',
    '..gGGg..',
    '.gGgggGg',
    'g.gGGg.g',
    '..g..g..',
    '...g.g..',
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
  /* Vampire — the cloak used to be pure black, which is now the
     colour of nothing. Indigo cloak, blood lining, white face. */
  vampire: [
    '..dddd..',
    '.dWWWWd.',
    '.dRddRd.',
    '..dWWd..',
    'rddrrddr',
    'rrdrrdrr',
    '.rr..rr.',
    '.dd..dd.',
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
  ashhound: [
    '........',
    'd......d',
    'dGd..dGd',
    '.GGGGGG.',
    'GGoGGoGG',
    '.GddddG.',
    'd.d..d.d',
    '.......d',
  ],
  // 화로지기: wide and plated, arms already half-drawn back.
  warden: [
    '.ssssss.',
    'sGGooGGs',
    'sGoRRoGs',
    '.soooGs.',
    'ssGGGGss',
    'skGGGGks',
    '.ss..ss.',
    '.kk..kk.',
  ],
  // 잿물 먹는 것: a slumped thing, brighter where it has fed.
  ashen: [
    '..dddd..',
    '.dododdd',
    'dooRRood',
    'doooooog',
    '.dooooo.',
    '.ddoodd.',
    '..dddd..',
    '.d.dd.d.',
  ],
  // 화로의 사제: robed, and holding the mark it is about to draw.
  emberpriest: [
    '..oooo..',
    '.okooko.',
    '.oooooo.',
    '..rrrr..',
    '.rRoorR.',
    'rR.rr.Rr',
    '.r.rr.r.',
    '.rr..rr.',
  ],
  // 잿더미 속의 것: a heap, until the moment it is not.
  ashheap: [
    '........',
    '...gg...',
    '..gRRg..',
    '.gdooodg',
    'gdoRRodg',
    'gddooddg',
    'GgddddgG',
    'gggggggg',
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
    '..nnnn..',
    '.nwwwwn.',
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
  /* 좌판. 마을의 여섯 수레는 여태 이 이름으로 그려 달라고 했는데
     여기 그림이 없어서 sprite()의 마지막 수단인 '돌무더기'가 대신
     나가고 있었다 — 마을 한복판의 장터가 자갈밭으로 보인 이유다.
     천막 지붕과 그 아래 판자 하나. 8×8에서 「가게」로 읽히는 최소
     단위는 그 둘이고, 세로로 나눠 칠해야 접힌 천으로 보인다. */
  stall: [
    '..RRRR..',
    '.RRwwRR.',
    'RRwwRRww',
    'nnnnnnnn',
    '.n.nn.n.',
    '.nNNNNn.',
    '..n..n..',
    '..n..n..',
  ],
  /* 우물도 같은 이유로 돌무더기였다. 두레박 도르래가 있어야
     통과 구분이 된다 — 통은 이미 바로 아래에 있다. */
  well: [
    '...nn...',
    '..nNNn..',
    '.GGGGGG.',
    'GkkkkkkG',
    'Gk.dd.kG',
    'Gkddddkg',
    '.GggggG.',
    '..GGGG..',
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
  brazierLit2: [
    '....o...',
    '.o.oyo..',
    '.ooyWyo.',
    '.ssssss.',
    '..ssss..',
    '...ss...',
    '..ssss..',
    '.ssssss.',
  ],
  /* 서 있는 것. 조각으로 보여야 하고, 조각이 아니라는 것이 나중에
     읽혀야 한다 — 그래서 좌우가 완벽히 대칭이고(사람은 이렇게 안
     선다), 발이 바닥에 붙어 있고, 얼굴 자리에 이목구비 대신 세로로
     난 금이 하나 있다. 색은 벽과 같은 돌색 계열로 두어, 밝을 때는
     방의 일부처럼 보이게 한다. */
  standing: [
    '..GGGG..',
    '.GgggggG',
    '.Gg.k.gG',
    '.Gg.k.gG',
    '.GggggG.',
    'GGgggggG',
    '.G.gg.G.',
    'GGG..GGG',
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
  /* Frame two of the fire: the flame leans and sheds a spark.
     Same logs, same footprint — only the light moves. */
  camp2: [
    '.....o..',
    '....o...',
    '...oyo..',
    '..yWyo..',
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
  /* Frame two: the same pool with the glints shifted one over —
     a palette-cycle wave, the oldest trick the PPU knew. */
  water2: [
    '........',
    '..bbbb..',
    '.bbBbbB.',
    'bBbbbbbb',
    'bbbbBbbb',
    'bbBbbbBb',
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
  // Human: brown hair over an ordinary face — the baseline the
  // other seven deviate from.
  human: [
    '..nnnn..',
    '.nwwwwn.',
    '.wkwwkw.',
    '..wwww..',
    '..CCCC..',
    '.C.CC.C.',
    '..C..C..',
    '..n..n..',
  ],
  // Half-elf: fair hair, and a little of the ear's point.
  halfElf: [
    '..yyyy..',
    '.ywwwwy.',
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
  // Halfling: small, low, a mop of curls. Sits a row lower.
  halfling: [
    '........',
    '..nnnn..',
    '.nwkkwn.',
    '..wwww..',
    '..CCCC..',
    '.CCCCCC.',
    '..C..C..',
    '.nn..nn.',
  ],
  // Gnome: big head, small body, a shock of white hair.
  gnome: [
    '.WWWWWW.',
    'WWwwwwWW',
    'WwkwwkwW',
    '.WWwwWW.',
    '..CCCC..',
    '.C.CC.C.',
    '..C..C..',
    '..n..n..',
  ],
  // Dwarf: broad, and the fire-orange beard is most of the face.
  dwarf: [
    '.oooooo.',
    'owwwwwwo',
    'owkwwkwo',
    '.oooooo.',
    '.oCCCCo.',
    'CCCCCCCC',
    '.CC..CC.',
    '.nn..nn.',
  ],
  // Half-orc: green, red-eyed, tusks up from the lip.
  halfOrc: [
    '..eeee..',
    '.eEEEEe.',
    '.eREERe.',
    '.WeEEeW.',
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
  // 전사: a browed helm with a white glint, shoulder plates.
  warrior: [
    '.sWssss.',
    '........',
    '........',
    '........',
    's.ssss.s',
    'ss.ss.ss',
    '........',
    '........',
  ],
  // 마법사: pointed hat, long robe, wooden staff with a lit tip.
  mage: [
    '...bb..y',
    '..bbb..n',
    '.......n',
    '.......n',
    '..bbb.nn',
    '.bbbbb.n',
    '.bbbbb..',
    '..bbb...',
  ],
  // 사제: a hood, a pale mantle, and a gold cross on the chest.
  priest: [
    '.WWWWWW.',
    'W......W',
    'W......W',
    '...yy...',
    '.WWWWWW.',
    'WWWyyWWW',
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
  // 팔라딘: a red-plumed helm and a gilded breastplate.
  paladin: [
    '...RR...',
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

/* ── 테두리 ──────────────────────────────────────────────
   0x72 시트를 같은 자로 재 보니 우리와 갈린 곳은 한 군데였다:
   그쪽은 외곽 픽셀의 94%가 V<64이고 내부보다 평균 85 어둡다.
   우리는 5%에 20이었다 — 다시 말해 **테두리가 없었다.** 그래서
   배경에서 떨어지지 않고 납작하게 보였다.

   8×8에 바깥으로 선을 두르면 칸을 넘치고, 안쪽을 통째로 한 색
   외곽선으로 채우면 6×6만 남아 형태가 뭉갠다. 그래서 실루엣
   가장자리를 **눌러서** 어둡게 한다 — 색은 자기 색을 유지한 채
   어두워지므로 재질은 남고 윤곽만 선다.

   투명한 이웃이 있는 픽셀에만 적용한다. 칸을 꽉 채우는 스프라이트는
   배경과 겹칠 일이 없으니 테두리도 필요 없다. */
const RIM = 0.42;                 // 가장자리가 자기 색의 몇 배로 어두워지는가
function rimColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round((n >> 16) * RIM), g = Math.round(((n >> 8) & 255) * RIM), b = Math.round((n & 255) * RIM);
  return `rgb(${r},${g},${b})`;
}

function bakeGrid(grid, tint) {
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = c.getContext('2d');

  /* 먼저 어느 칸이 차 있는지 알아야 가장자리를 판별할 수 있다. */
  const key = [];
  for (let row = 0; row < CELL; row++) {
    const line = grid[row] || '';
    const out = [];
    for (let col = 0; col < CELL; col++) {
      let ch = line[col] || '.';
      if (ch === 'C') ch = tint || 's';
      out.push(PALETTE[ch] ? ch : null);
    }
    key.push(out);
  }
  const empty = (r, cl) => r < 0 || cl < 0 || r >= CELL || cl >= CELL || !key[r][cl];

  for (let row = 0; row < CELL; row++) {
    for (let col = 0; col < CELL; col++) {
      const ch = key[row][col];
      if (!ch) continue;
      const color = PALETTE[ch];
      const edge = empty(row - 1, col) || empty(row + 1, col)
                || empty(row, col - 1) || empty(row, col + 1);
      x.fillStyle = edge ? rimColor(color) : color;
      x.fillRect(col, row, 1, 1);
    }
  }
  return c;
}

/* ── 잘못 자란 것 ─────────────────────────────────────────
   「몬스터도 모두 다 기괴하게.」

   서른 장을 손으로 다시 그리는 방법도 있지만, 8×8에서 기괴함은
   그림 실력이 아니라 **규칙 위반**에서 나온다. 대칭인 것에서 한쪽이
   없고, 눈이 둘이어야 할 자리에 셋이 있고, 살 한 점이 뼈 색이면
   그때 사람이 「뭔가 잘못됐다」고 읽는다. 그래서 표를 하나 더 만들지
   않고 **구우면서 비튼다**.

   종류마다 언제나 같은 방식으로 비틀린다. 판마다 바뀌면 그건 기형이
   아니라 잡음이고, 잡음은 무섭지 않다 — 같은 것을 두 번 만났을 때
   같은 자리가 없어야 「이 종은 원래 이렇게 생겼다」가 된다.

   그리고 실루엣은 건드리지 않는다. 세 픽셀 안쪽만 바꾸므로 무엇인지는
   그대로 읽히고, 자세히 본 사람만 잘못된 것을 본다. 알아볼 수 없게
   만드는 것은 기괴한 것이 아니라 그냥 망가진 것이다. */
const WRONG_MAX = 3;                       // 한 종이 잃거나 얻는 픽셀 수

const hashOf = s => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  return h;
};

function deform(grid, name) {
  const g = grid.map(r => (r || '').padEnd(CELL, '.').slice(0, CELL).split(''));
  const filled = [];
  for (let r = 0; r < CELL; r++)
    for (let c = 0; c < CELL; c++)
      if (g[r][c] !== '.' && PALETTE[g[r][c]]) filled.push([r, c]);
  if (filled.length < 8) return grid;       // 너무 작은 것은 비틀 여지가 없다

  const h = hashOf(name);
  const at = (r, c) => (r >= 0 && r < CELL && c >= 0 && c < CELL) ? g[r][c] : '.';

  /* ── 첫 겹: 윤곽이 잘못됐다 ────────────────────────────
     처음에는 세 가지 중 하나만 골라 걸었더니 26종 중 10종만 실루엣이
     달라졌다 — 나머지는 안쪽 색만 바뀌어서, 멀리서 보면 원래 그림
     그대로였다. 「모두 다」가 아니었다. 이제 윤곽은 **언제나** 한 번
     비틀고, 그 위에 안쪽을 한 번 더 비튼다. */
  if (h % 2 === 0) {
    /* 한쪽이 없다. 좌우로 짝이 맞는 칸 중 한쪽만 지운다 — 다리 하나가
       짧거나 어깨 한쪽이 없다. 대칭이 깨지는 것이 8×8에서 가장 싸게
       살 수 있는 「사람은 이렇게 안 선다」이다. */
    const pairs = filled.filter(([r, c]) => c < CELL / 2 && g[r][CELL - 1 - c] === g[r][c]);
    const spots = pairs.length ? pairs : filled;
    for (let i = 0; i < WRONG_MAX && spots.length; i++) {
      const [r, c] = spots[(h >> (i * 3)) % spots.length];
      g[r][pairs.length ? CELL - 1 - c : c] = '.';
    }
  } else {
    /* 하나 더 났다. 몸 가장자리에서 바깥으로 한 칸 자란다 — 가시,
       혹, 없어야 할 다리. 자란 것은 몸 색 그대로라서 무엇인지는
       그대로 읽히고, 윤곽만 틀린다. */
    const rim = filled.filter(([r, c]) =>
      at(r - 1, c) === '.' || at(r + 1, c) === '.' ||
      at(r, c - 1) === '.' || at(r, c + 1) === '.');
    const spots = rim.length ? rim : filled;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let grew = 0;
    for (let i = 0; i < spots.length && grew < WRONG_MAX; i++) {
      const [r, c] = spots[(h >> (i * 3)) % spots.length];
      const [dr, dc] = dirs[(h >> (i * 2 + 1)) % 4];
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= CELL || cc < 0 || cc >= CELL) continue;
      if (g[rr][cc] !== '.') continue;
      g[rr][cc] = g[r][c];
      grew++;
    }
  }

  /* ── 둘째 겹: 눈이 하나 더 있다 ────────────────────────
     이것도 처음에는 반반으로 갈라 걸었다. 그런데 시트를 뽑아 놓고
     보니 8×8에서 확실하게 불쾌한 것은 이것 하나뿐이었다 — 나머지는
     이 크기에서 「좀 상했나」로 읽힌다. 그래서 전부에 건다.
     눈이 없는 것(곰팡이·젤리·잿더미)에는 없던 구멍이 하나 생기는데,
     형체 없는 것에 눈이 생기는 쪽이 오히려 낫다.

     비대칭으로 붙인다. 좌우가 맞는 눈 셋은 그냥 무늬지만, 한쪽에만
     붙은 셋째는 얼굴이 아니다. */
  {
    const eyes = filled.filter(([r, c]) => g[r][c] === 'k' || g[r][c] === 'R');
    const dark = eyes.length ? eyes[(h >> 5) % eyes.length] : null;
    const host = filled[(h >> 7) % filled.length];
    const [r, c] = dark || host;
    const ink = dark ? g[r][c] : 'k';
    for (const [dr, dc] of [[-1, -1], [1, 1], [-1, 1]]) {
      const rr = r + dr, cc = c + dc;
      if (at(rr, cc) !== '.' && g[rr][cc] !== ink) { g[rr][cc] = ink; break; }
    }
  }

  /* ── 셋째 겹: 살 한 점이 뼈다 ──────────────────────────
     몸 안쪽만 바꾸므로 실루엣은 그대로다 — 멀리서는 멀쩡하고,
     가까이서 본 사람만 뼈가 나온 자리를 본다. */
  {
    const inner = filled.filter(([r, c]) =>
      at(r - 1, c) !== '.' && at(r + 1, c) !== '.'
      && at(r, c - 1) !== '.' && at(r, c + 1) !== '.');
    const spots = inner.length ? inner : filled;
    const ink = ['w', 'R', 'w'][(h >> 4) % 3];
    for (let i = 0; i < WRONG_MAX - 1 && spots.length; i++) {
      const [r, c] = spots[(h >> (i * 4)) % spots.length];
      g[r][c] = ink;
    }
  }
  return g.map(r => r.join(''));
}

/* 그리고 한 장 더 굽는다: **더 잘못된** 판. 화면에서 아주 가끔,
   한 프레임만 이쪽으로 바뀐다 — 눈을 비비게 만드는 것이 목적이므로
   여기서는 실루엣을 건드려도 된다. 다시 보면 원래대로다. */
function wrongen(grid, name) {
  const g = grid.map(r => (r || '').padEnd(CELL, '.').slice(0, CELL).split(''));
  const h = hashOf(name + '!');
  const filled = [];
  for (let r = 0; r < CELL; r++)
    for (let c = 0; c < CELL; c++)
      if (g[r][c] !== '.' && PALETTE[g[r][c]]) filled.push([r, c]);
  if (!filled.length) return grid;
  /* 줄 하나가 통째로 어긋난다. */
  const row = 1 + (h % (CELL - 2));
  const line = g[row].slice();
  const shift = (h >> 3) % 2 ? 1 : -1;
  for (let c = 0; c < CELL; c++) g[row][c] = line[(c - shift + CELL) % CELL];
  /* 그리고 몇 점이 흰 섬광이 된다 — 안쪽에서 무언가 켜진 것처럼. */
  for (let i = 0; i < 3; i++) {
    const [r, c] = filled[(h >> (i * 6)) % filled.length];
    g[r][c] = 'W';
  }
  return g.map(r => r.join(''));
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

/* 살아 있는 것들의 이름. 표를 여기 손으로 적지 않는다 — data.js의
   MONSTERS에서 그대로 나오므로, 몬스터를 하나 더 넣으면 그것도 자동으로
   비틀린다. 손으로 적은 목록은 언젠가 반드시 어긋난다. */
let flesh = new Set();

export function bakeAll(living) {
  if (living) flesh = living instanceof Set ? living : new Set(living);
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
    } else if (flesh.has(name)) {
      baked.set(name, bakeGrid(deform(grid, name)));
      baked.set(`wrong:${name}`, bakeGrid(wrongen(deform(grid, name), name)));
    } else {
      baked.set(name, bakeGrid(grid));
    }
  }
}

export const sprite = name => baked.get(name) || baked.get('rubble');
/* 탐침용. 비틀기 전의 격자를 같은 방식으로 구워 준다 — 그래야
   「몇 칸이 달라졌는가」를 램프까지 포함해 정확히 셀 수 있다.
   탐침이 굽는 방식을 따로 흉내 내면 재는 것이 기형이 아니라 흉내가
   맞았는지가 된다. */
export const _bakeRaw = grid => bakeGrid(grid);
/* 있는지 없는지. sprite()는 없으면 돌무더기를 돌려주므로 그것만으로는
   물어볼 수가 없다. */
export const hasSprite = name => baked.has(name);

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
  plain:   { base:'g', grain:'G', mortar:'d', floor:'d', dust:'A',  style:'brick' },
  // 좁은 굴: hacked out rather than built. No courses at all.
  warren:  { base:'n', grain:'N', mortar:'k', floor:'k', dust:'D',  style:'rough' },
  // 큰 방: dressed stone, wide courses, pale.
  hall:    { base:'G', grain:'w', mortar:'g', floor:'g', dust:'F',  style:'ashlar' },
  // 빛이 없는 층: everything one step darker; the grain barely reads.
  dark:    { base:'d', grain:'g', mortar:'k', floor:'k', dust:'d',  style:'brick' },
  // 물에 잠긴 층: wet blue stone, streaked downward.
  flooded: { base:'b', grain:'B', mortar:'k', floor:'d', dust:'H',  style:'streak' },
  // 소굴: chitin and old web over the stone.
  nest:    { base:'p', grain:'P', mortar:'k', floor:'d', dust:'J',  style:'rough' },
};

/* ── 구역의 열 ────────────────────────────────────────────
   지형 무늬는 층의 **성격**(좁은 굴, 큰 방, 물에 잠긴 층)을 말한다.
   그런데 이 게임의 뼈대는 그게 아니라 **깊이**다 — 아래에 있는 것이
   타고 있고, 열다섯 층 내내 돌이 점점 따뜻해진다. 그 말을 지역
   문장으로만 하고 화면은 한 번도 하지 않았다.

   그래서 구운 타일 위에 구역의 색을 얇게 덮는다. 성채는 그대로,
   갱도에서 흙빛이 돌기 시작하고, 성소는 뼈처럼 바래고, 잿불에서는
   붉어지고, 화로에서는 달아오른다. 무늬는 그대로 두고 **온도만**
   바꾸는 것이라, 층의 성격과 깊이가 서로를 지우지 않는다.

   섞는 비율은 낮게 잡았다 — 색을 입히는 것이 아니라 데우는 것이고,
   진해지면 여섯 지형 무늬가 전부 같은 색 덩어리로 뭉개진다. */
/* ── 그런데 첫 판이 자책골이었다 ──────────────────────────
   두 가지가 동시에 틀렸다.

   하나. 화로의 tone `#d4741f`는 PALETTE.o와 **글자 하나까지 같은
   값**이고, 잿불의 `#c8322c`는 PALETTE.R과 같다. 그런데 아래 다섯
   층의 배우들 — 재의 사냥개·화로지기·잿물 먹는 것·화로의 사제·
   대군주 — 이 전부 그 두 키로 그려져 있다. 클라이맥스를 주황 위의
   주황으로 칠하고 있었다는 뜻이다. 실측 명암비 R 대 화로 바닥
   2.66:1, 여기에 안개 알파까지 곱하면 사실상 소실이다.

   둘. 덮는 방식이 source-over라 **명도를 올린다**. 재 보니 화로
   바닥의 상대 휘도가 성채의 3.4배였다 — 가장 깊은 곳이 가장 밝았다.
   무대가 배우 위로 올라온 것이다.

   그래서 벽과 바닥을 가른다. 배경(벽)은 달아오르고, 무대(바닥)는
   식은 채로 어두워진다. tone은 전부 어둡고 채도 높은 값이라 명도는
   안 올리고 색조만 민다. 밝은 잉걸불 키(o, y)는 여기 안 쓴다 —
   그건 불이 내는 색이지 돌이 내는 색이 아니다. */
export const REGION_HEAT = [
  { wallTone:null,      floorTone:null,      wall:0,    floor:0    },  // 무너진 성채 — 식은 돌
  { wallTone:'#5e3a1c', floorTone:'#2e1b0c', wall:0.16, floor:0.10 },  // 드워프 갱도 — 파낸 흙
  { wallTone:'#d8cdb4', floorTone:'#6b6350', wall:0.13, floor:0.08 },  // 잊힌 성소 — 바랜 뼈
  { wallTone:'#8e1f1c', floorTone:'#4a0f14', wall:0.20, floor:0.13 },  // 잿불 아래 — 벽이 붉다
  { wallTone:'#a8460e', floorTone:'#5c1c08', wall:0.30, floor:0.18 },  // 대군주의 화로 — 벽이 탄다
];

let terrainTheme = 'plain';
let terrainHeat = 0;
/* Called by the renderer when the floor changes. Cheap: the
   cache is keyed by theme so walking back up is instant. */
export function setTerrainTheme(id, heat = 0) {
  terrainTheme = TERRAIN[id] ? id : 'plain';
  terrainHeat = Math.max(0, Math.min(REGION_HEAT.length - 1, heat | 0));
}

function bakeTerrain(kind, variant) {
  const theme = terrainTheme;
  const heat = terrainHeat;
  // 열도 캐시 열쇠에 들어간다 — 안 넣으면 성채에서 구운 타일이
  // 화로까지 따라 내려온다.
  const key = `${theme}:${heat}:${kind}:${variant}`;
  if (terrainCache.has(key)) return terrainCache.get(key);

  const T = TERRAIN[theme] || TERRAIN.plain;
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = c.getContext('2d');
  let rs = (variant * 2654435761 + theme.length * 7919) % 2147483647;
  const rr = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  if (kind === 'wall') {
    x.fillStyle = PALETTE[T.base]; x.fillRect(0, 0, CELL, CELL);
    /* 결은 드물어야 결이다. 일곱 점은 무늬가 아니라 잡음이었다. */
    x.fillStyle = PALETTE[T.grain];
    for (let i = 0; i < 3; i++) x.fillRect((rr() * 8) | 0, (rr() * 8) | 0, 1, 1);
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
    /* 바닥은 조용해야 한다. 배우가 서는 무대이지 무대가 배우는 아니다.
       칸마다 점을 넷씩 뿌리면 수백 칸이 모여 텔레비전 노이즈가 된다 —
       여섯 변종 중 셋만, 그것도 한두 점만 받는다. */
    if (variant % 2 === 0) {
      x.fillStyle = PALETTE[T.dust];
      const dots = 1 + ((rr() * 2) | 0);
      for (let i = 0; i < dots; i++) x.fillRect((rr() * 8) | 0, (rr() * 8) | 0, 1, 1);
    }
  }
  /* 그리고 온도. 무늬를 다 그린 뒤에 얇게 덮으므로, 결도 이음매도
     사라지지 않고 색만 옮겨 간다. */
  const H = REGION_HEAT[heat];
  if (H) {
    const tone = kind === 'wall' ? H.wallTone : H.floorTone;
    const a    = kind === 'wall' ? H.wall     : H.floor;
    if (tone && a > 0) {
      x.globalAlpha = a;
      x.fillStyle = tone;
      x.fillRect(0, 0, CELL, CELL);
      x.globalAlpha = 1;
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
  c.fillStyle = '#d8c8a0';                            // the leaf itself
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
