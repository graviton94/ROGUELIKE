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
  /* ── 대군주만 열여섯으로 ────────────────────────────
     서른 종을 전부 다시 그리면 손이 고르지 않아 어떤 것은 낫고
     어떤 것은 못해진다. 그런데 이 하나는 다르다 — 열다섯 층을
     걸어 내려온 사람이 마지막으로 보는 그림이고, 그때까지 본
     모든 것보다 커야 한다.

     「불을 피우는 것이 아니라 먹는다.」 그래서 불을 **두르지**
     않고 **안에** 넣었다: 숯이 된 몸 한가운데가 뚫려 있고 그
     안이 잉걸에서 금으로, 금에서 흰빛으로 간다. 눈 두 점도 같은
     색이다 — 안에 있는 것과 보고 있는 것이 같은 불이라는 뜻이다.

     빈칸은 두 칸 이상으로 잡았다. 테두리는 몸에 닿은 빈칸을
     칠하므로 한 칸짜리 틈은 양쪽에서 칠해져 통째로 메워진다 —
     처음에 뿔을 한 칸 간격으로 세웠더니 왕관이 금색 막대기가
     됐다. 열여섯 칸에서 음각은 두 칸부터다. */
  balemperor: [
    '..yy........yy..',
    '..yy........yy..',
    '..yyrrrrrrrryy..',
    '....rrrrrrrr....',
    '....roorroor....',
    '....rrrrrrrr....',
    '....rwrrrrwr....',
    '.....rrrrrr.....',
    '.rrrrrrrrrrrrrr.',
    'rrrrrrrrrrrrrrrr',
    'rrrrrroooorrrrrr',
    'rrrrrooyyoorrrrr',
    'rrrrrooWWoorrrrr',
    'rrrrrroooorrrrrr',
    '.rrrrrrrrrrrrrr.',
    '..rrrr....rrrr..',
  ],

  /* ── 이름 있는 것 셋 ────────────────────────────────────
     지금까지 이 셋은 오우거·망령·큰뱀 그림을 그대로 빌려 쓰고 있었다.
     여섯 층을 걸어 내려와 만나는 「뼈를 씹는 자」가 조금 전에 열
     마리쯤 잡은 오우거와 같은 그림이면, 이름이 붙어 있다는 사실이
     화면에는 없는 것이다 — 이름은 로그에만 있었다.

     대군주와 같은 규칙으로 그린다: 열여섯 칸, 음각은 두 칸부터.
     그리고 셋의 실루엣이 서로 달라야 한다 — 넓적한 것, 길쭉한 것,
     감긴 것. */
  bonechewer: [
    '................',
    '....nnnnnnnn....',
    '...nNNNNNNNNn...',
    '...nNRNNNNRNn...',
    '...nNNNNNNNNn...',
    '...nNwwwwwwNn...',
    '....nNNNNNNn....',
    '..nnnNNNNNNnnn..',
    '.nNNNNNNNNNNNNn.',
    'nNNNNNNNNNNNNNNn',
    'nNNNwwNNwwNNNNNn',
    'nNNNNNNNNNNNNNNn',
    '.nNNNNNNNNNNNNn.',
    '..nNNNNNNNNNNn..',
    '..nNNn....nNNn..',
    '..nnnn....nnnn..',
  ],
  ashpriest: [
    '................',
    '.....gggggg.....',
    '....gGGGGGGg....',
    '...gGGGGGGGGg...',
    '...gGGBGGBGGg...',
    '...gGGGGGGGGg...',
    '....gGwwwwGg....',
    '.....gGGGGg.....',
    '...ggGGGGGGgg...',
    '..gGGGGGGGGGGg..',
    '..gGGGwwwwGGGg..',
    '..gGGGGGGGGGGg..',
    '...gGGGGGGGGg...',
    '....gGGGGGGg....',
    '.....gg..gg.....',
    '....ggg..ggg....',
  ],
  forgecoil: [
    '................',
    '...rrrrrrrrrr...',
    '..rroooooooorr..',
    '.rroRRRRRRRRorr.',
    '.roRRrrrrrrRRor.',
    '.roRrroooorrRor.',
    '.roRroyyyyorRor.',
    '.roRroyWWyorRor.',
    '.roRroyyyyorRor.',
    '.roRrroooorrRor.',
    '.roRRrrrrrrRRor.',
    '.rroRRRRRRRRorr.',
    '..rroooooooorr..',
    '...rrrrrrrrrr...',
    '....rr....rr....',
    '................',
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
    '................',
    '..GGGGGGGGGGGG..',
    '..gggggggggggg..',
    '...GGGGGGGGGG...',
    '...gggggggggg...',
    '....gggggggg....',
    '....dddddddd....',
    '.....gggggg.....',
    '.....dddddd.....',
    '......dddd......',
    '......kkkk......',
    '......kkkk......',
    '......kkkk......',
    '......kkkk......',
    '................',
    '................',
  ],
  stairsUp: [
    '................',
    '................',
    '................',
    '...........wwww.',
    '...........gggg.',
    '.........wwwwww.',
    '.........gggggg.',
    '.......GGGGGGGG.',
    '.......gggggggg.',
    '.....GGGGGGGGGG.',
    '.....dddddddddd.',
    '...GGGGGGGGGGGG.',
    '...dddddddddddd.',
    '................',
    '................',
    '................',
  ],
  door: [
    '................',
    '................',
    '......nnnn......',
    '.....nNNNn......',
    '.....nNNNn......',
    '....nNNNNn......',
    '....nNyNNn......',
    '...nNNNNNn......',
    '...nNNNNNn......',
    '..nNNNNNNn......',
    '..nNNNNNNn......',
    '..nNNNNNNn......',
    '..nNNNNNNn......',
    '..nnnnnnnn......',
    '................',
    '................',
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
  /* ── 떠돌이 상인 ────────────────────────────────────
     지금까지 던전의 상인은 마을 좌판의 `keeper`(계산대 뒤의 상반신)를
     그대로 빌려 쓰고 있었다. 계산대는 마을에 있는 것이고, 층 한복판에
     놓인 계산대는 계산대로 안 읽힌다 — 플레이어가 「돌멩이」라고 부른
     것이 이것이다.

     이 사람은 서 있는 사람이 아니라 **끌고 다니는 사람**이다. 그러니
     후드 쓴 형체 왼쪽, 수레 오른쪽, 바퀴 하나. 실루엣이 몬스터 서른네
     종 어느 것과도 안 닮는 것이 이 그림의 일이다.

     C는 짐마다 물든다 — 어느 수레가 왔는지 방 건너에서 읽힌다.  */
  /* 두 번째 그림이다. 첫 판은 주석이 「후드 쓴 형체 왼쪽, 수레
     오른쪽, 바퀴 하나」라고 적어 놓고 실제로는 3열 대칭의 둥근
     덩어리를 그렸다 — 채움 196/256(이 저장소가 스스로 정한 상한은
     140), urn·well과 IoU 0.855, orc·wraith와 0.87. 실루엣이 없었다.

     그리고 그 사실을 벤치가 못 잡은 이유는 sim/silhouette.mjs의 소품
     목록이 **손으로 적혀** 있어서 pedlar가 비교 대상이 아니었기
     때문이다. 목록을 고치고 다시 잰 뒤에 다시 그린다.

     이번에는 비대칭이 규칙이다: 왼쪽에 세로로 긴 형체, 오른쪽에
     가로로 넓은 짐칸, 오른쪽 아래에 바퀴. 항아리·우물 같은 둥근
     덩어리에서 IoU가 떨어지는 것은 색이 아니라 이 모양이다. */
  pedlar: [
    '..kk....',
    '.kCCk...',
    '.kCkk...',
    '..CCknnn',
    '.CCCk.Nn',
    '..CCknnn',
    '..n.nyy.',
    '..n..y..',
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
    '................',
    '................',
    '...gggggggggg...',
    '...nNNNNNNNNn...',
    '...nNNNNNNNNn...',
    '...gggggggggg...',
    '...nNNNNNNNNn...',
    '...nNNNNyyNNnss.',
    '...nNNNNykNNnss.',
    '...nNNNNNNNNn...',
    '...gggggggggg...',
    '...nNNNNNNNNn...',
    '...nNNNNNNNNn...',
    '...gggggggggg...',
    '................',
    '................',
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

/* ── 칸 하나가 몇 픽셀인가 ────────────────────────────────
   여덟이었다. 여덟에서는 두 가지가 동시에 불가능했다.

   하나. 바깥에 테두리를 두를 자리가 없다. 8×8은 몸이 곧 칸이라
   선을 두르면 칸을 넘치고, 그래서 지금까지는 **안쪽** 가장자리를
   눌러서 어둡게 했다 — 그런데 8×8에서 「투명한 이웃이 있는 픽셀」은
   몸의 63%다. 테두리를 그린 게 아니라 몸을 갉아먹고 있었다.
   「외곽선이 배경이랑 식별이 안 된다」와 「픽셀이 얼룩덜룩하다」가
   둘 다 여기서 나왔다: 안쪽이 제각기 다른 비율로 어두워지니까
   재질이 아니라 얼룩으로 읽힌다.

   둘. 여덟 칸으로는 얼굴과 몸과 무기를 동시에 그릴 수 없다. 열 몇
   마리가 같은 실루엣을 쓰게 된 것도 이 때문이다.

   그래서 열여섯으로 올린다. 화면 배치는 한 칸도 안 바뀐다 — 렌더는
   이미 타일 크기 t로 스케일해서 그리므로, CELL은 「타일 안의 해상도」
   일 뿐이다. 지금 있는 8×8 그림은 구울 때 2배로 늘려서 그대로 살리고
   (화면에서 완전히 동일하다), 새로 그리는 것만 16줄로 적으면 된다.
   한 표에 8줄짜리와 16줄짜리가 섞여 있어도 된다. */
const CELL = 16;
const baked = new Map();

/* ── 테두리 ──────────────────────────────────────────────
   0x72 시트를 같은 자로 재 보니 갈린 곳은 한 군데였다: 그쪽은 외곽
   픽셀의 94%가 V<64이고 내부보다 평균 85 어둡다. 우리는 5%에 20 —
   테두리가 없었다.

   이제 열여섯 칸이므로 진짜로 **바깥에** 두른다. 몸에 닿은 빈 칸을
   외곽선 색으로 칠하는 것이라 몸은 한 픽셀도 안 잃고, 선은 언제나
   한 픽셀이다. 몸이 칸 끝에 닿은 자리에서만 그 한 줄을 몸에서
   가져온다 — 열여섯 중 하나이므로 6%이고, 예전 63%와 비교할 것이
   못 된다. */
function bakeGrid(grid, tint) {
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = c.getContext('2d');

  /* 원본이 몇 줄짜리든 받는다 — 8줄이면 2배로, 16줄이면 그대로.
     이 한 줄 덕분에 표를 한꺼번에 갈아엎지 않고 한 마리씩 다시
     그릴 수 있다. */
  const n = Math.max(1, grid.length);
  const s = Math.max(1, Math.round(CELL / n));

  /* 화면 해상도(CELL)로 펼친 채움 지도. 테두리는 여기서 판별해야
     원본이 8줄이든 16줄이든 선 굵기가 언제나 한 픽셀이다. */
  const key = [];
  for (let row = 0; row < CELL; row++) {
    const line = grid[Math.min(n - 1, (row / s) | 0)] || '';
    const out = [];
    for (let col = 0; col < CELL; col++) {
      let ch = line[Math.min(line.length - 1, (col / s) | 0)] || '.';
      if (ch === 'C') ch = tint || 's';
      out.push(PALETTE[ch] ? ch : null);
    }
    key.push(out);
  }
  const inside = (r, cl) => r >= 0 && cl >= 0 && r < CELL && cl < CELL;
  const filled = (r, cl) => inside(r, cl) && !!key[r][cl];

  /* 몸 먼저. 자기 색 그대로 — 누르지 않는다. */
  for (let row = 0; row < CELL; row++)
    for (let col = 0; col < CELL; col++) {
      const ch = key[row][col];
      if (!ch) continue;
      x.fillStyle = PALETTE[ch];
      x.fillRect(col, row, 1, 1);
    }

  /* 그 다음 테두리. 몸에 닿은 빈 칸, 그리고 칸 끝에 닿은 몸 한 줄. */
  x.fillStyle = PALETTE.k;
  for (let row = 0; row < CELL; row++)
    for (let col = 0; col < CELL; col++) {
      if (key[row][col]) {
        const atEdge = row === 0 || col === 0 || row === CELL - 1 || col === CELL - 1;
        if (atEdge) x.fillRect(col, row, 1, 1);
        continue;
      }
      if (filled(row - 1, col) || filled(row + 1, col)
       || filled(row, col - 1) || filled(row, col + 1)) x.fillRect(col, row, 1, 1);
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
/* ── 상수는 화면 픽셀로 말해야 한다 ─────────────────────
   `WRONG_MAX = 3`은 8줄 격자에서 쓰던 값이다. 8줄 그림은 한 칸이
   화면에서 2×2 = 4픽셀이므로 흰 섬광 3점이 12픽셀 = 타일의 4.7%가
   된다 — 그건 「안쪽에서 뭔가 켜졌다」가 아니라 「스프라이트가
   깨졌다」로 읽히는 넓이다. 진짜 16줄 그림에서는 같은 3이 3픽셀
   = 1.2%다. 같은 상수가 격자에 따라 네 배 다르게 작동하고 있었다.

   두 상수는 차원이 다르다:
     · 윤곽 훼손은 **길이**다 — 실루엣 둘레의 일부를 뜯는 일이고,
       둘레는 격자 변 N에 비례한다.        → N¹
     · 흰 섬광은 **면적**이다 — 타일의 몇 %가 순백인가이고,
       칸 하나의 면적은 (CELL/N)²이다.     → N²
   그래서 화면에서 언제나 둘레 6픽셀어치, 섬광 3픽셀어치가 되도록
   격자 크기에서 되돌려 계산한다. 16줄로 다시 그리기 시작하는 날
   기형이 조용히 절반으로 줄어드는 사고도 이걸로 막는다. */
const wrongMax = N => Math.max(2, Math.round(6 * N / CELL));   // 8→3, 16→6
const sparks   = N => Math.max(1, Math.round(3 * (N / CELL) ** 2)); // 8→1, 16→3

const hashOf = s => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  return h;
};

function deform(grid, name) {
  /* 원본 격자의 크기로 센다. CELL로 세면 8줄짜리 그림을 16칸 격자로
     읽어서 절반이 빈칸이 되고, 그러면 비틀 자리를 못 찾는다 —
     칸을 16으로 올린 날 이 함수가 조용히 아무것도 안 할 뻔했다. */
  const N = Math.max(1, grid.length);
  const g = grid.map(r => (r || '').padEnd(N, '.').slice(0, N).split(''));
  const filled = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (g[r][c] !== '.' && PALETTE[g[r][c]]) filled.push([r, c]);
  if (filled.length < N) return grid;       // 너무 작은 것은 비틀 여지가 없다

  const h = hashOf(name);
  const at = (r, c) => (r >= 0 && r < N && c >= 0 && c < N) ? g[r][c] : '.';

  /* ── 첫 겹: 윤곽이 잘못됐다 ────────────────────────────
     처음에는 세 가지 중 하나만 골라 걸었더니 26종 중 10종만 실루엣이
     달라졌다 — 나머지는 안쪽 색만 바뀌어서, 멀리서 보면 원래 그림
     그대로였다. 「모두 다」가 아니었다. 이제 윤곽은 **언제나** 한 번
     비틀고, 그 위에 안쪽을 한 번 더 비튼다. */
  if (h % 2 === 0) {
    /* 한쪽이 없다. 좌우로 짝이 맞는 칸 중 한쪽만 지운다 — 다리 하나가
       짧거나 어깨 한쪽이 없다. 대칭이 깨지는 것이 8×8에서 가장 싸게
       살 수 있는 「사람은 이렇게 안 선다」이다. */
    const pairs = filled.filter(([r, c]) => c < N / 2 && g[r][N - 1 - c] === g[r][c]);
    const spots = pairs.length ? pairs : filled;
    for (let i = 0; i < wrongMax(N) && spots.length; i++) {
      const [r, c] = spots[(h >> (i * 3)) % spots.length];
      g[r][pairs.length ? N - 1 - c : c] = '.';
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
    for (let i = 0; i < spots.length && grew < wrongMax(N); i++) {
      const [r, c] = spots[(h >> (i * 3)) % spots.length];
      const [dr, dc] = dirs[(h >> (i * 2 + 1)) % 4];
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
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
    for (let i = 0; i < wrongMax(N) - 1 && spots.length; i++) {
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
  const N = Math.max(1, grid.length);
  const g = grid.map(r => (r || '').padEnd(N, '.').slice(0, N).split(''));
  const h = hashOf(name + '!');
  const filled = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (g[r][c] !== '.' && PALETTE[g[r][c]]) filled.push([r, c]);
  if (!filled.length) return grid;
  /* 줄 하나가 통째로 어긋난다. */
  const row = 1 + (h % Math.max(1, N - 2));
  const line = g[row].slice();
  const shift = (h >> 3) % 2 ? 1 : -1;
  for (let c = 0; c < N; c++) g[row][c] = line[(c - shift + N) % N];
  /* 그리고 몇 점이 흰 섬광이 된다 — 안쪽에서 무언가 켜진 것처럼. */
  for (let i = 0; i < sparks(N); i++) {
    const [r, c] = filled[(h >> (i * 6)) % filled.length];
    g[r][c] = 'W';
  }
  return g.map(r => r.join(''));
}

/* One keeper per shop, so the six of them are not identical. */
export const SHOP_TINT = ['e', 's', 'r', 'W', 'P', 'b'];
/* 여섯 수레의 물. SHOP_LOADS의 차례와 같다 — 심지(잉걸) · 약(초록) ·
   종이(뼈) · 쇠(쇠회색) · 재(마른 피) · 이상한(자수정). */
/* 처음에 여섯을 색조로만 갈랐더니 **휘도로는 세 단계**뿐이었다:
   심지(o)와 약(E)의 휘도비가 1.00, 쇠(g)는 바로 옆 가죽(n)과 1.11 —
   물이 안 든 것과 구분이 안 됐다. 저채도 팔레트에 안개 알파까지
   곱해지는 화면에서 색조 차이는 살아남지 못한다. 밝기로 가른다:
   뼈(w) · steel(s) · 잉걸(o) · 난초(P) · 이끼(e) · 곰팡이(p). */
export const LOAD_TINT = { wick:'o', flask:'e', paper:'w', iron:'s', ash:'p', odd:'P' };

/* Race under, class over. Any cell the kit leaves as '.' shows
   the body beneath, which is why the face survives the helmet. */
function bakeHero(race, cls) {
  const body = RACE_BODY[race] || RACE_BODY.human;
  const kit = CLASS_KIT[cls] || CLASS_KIT.warrior;
  /* 몸과 장비는 같은 크기로 그려져 있다. 그 크기로 겹친다 —
     8줄짜리 몸을 16칸으로 훑으면 절반이 빈칸이 된다. */
  const N = Math.max(body.length, kit.length);
  const merged = [];
  for (let row = 0; row < N; row++) {
    let line = '';
    for (let col = 0; col < N; col++) {
      const over = (kit[row] || '')[col] || '.';
      line += over !== '.' ? over : ((body[row] || '')[col] || '.');
    }
    merged.push(line);
  }
  return bakeGrid(merged, CLASS_TINT[cls]);
}

/* ── 정예의 테두리 ────────────────────────────────────────
   정예는 몬스터 **종류**가 아니라 아무 몬스터에나 붙는 속성이라, 전용
   그림을 줄 수가 없다. 지금까지는 칸 네 귀퉁이에 괄호를 그려서 알렸는데,
   그건 그 자리에 표를 붙인 것이지 **그것**을 표시한 것이 아니다 — 여럿이
   붙어 있으면 어느 괄호가 누구 것인지 모른다.

   그래서 테두리를 물들인다. 굽는 자리에서 이미 실루엣 바깥 한 줄을
   외곽선 색으로 칠하고 있으므로, 그 한 줄만 다른 색으로 한 장 더 굽는다.
   그리는 쪽은 스프라이트를 그린 뒤 이 고리를 덮어 씌우면 된다 —
   프레임마다 실루엣을 다시 계산하지 않는다.

   두 색뿐이다: 속성 하나면 잉걸, 둘 이상이면 시든 난초. 색이 늘면
   그건 정보가 아니라 무지개다. */
export const ELITE_RIM = ['o', 'P'];

function bakeRim(grid, ink) {
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = c.getContext('2d');
  const n = Math.max(1, grid.length);
  const s = Math.max(1, Math.round(CELL / n));
  const key = [];
  for (let row = 0; row < CELL; row++) {
    const line = grid[Math.min(n - 1, (row / s) | 0)] || '';
    const out = [];
    for (let col = 0; col < CELL; col++) {
      const ch = line[Math.min(line.length - 1, (col / s) | 0)] || '.';
      out.push(PALETTE[ch] && ch !== 'C' ? ch : (ch === 'C' ? 's' : null));
    }
    key.push(out);
  }
  const filled = (r, cl) => r >= 0 && cl >= 0 && r < CELL && cl < CELL && !!key[r][cl];
  x.fillStyle = PALETTE[ink];
  for (let row = 0; row < CELL; row++)
    for (let col = 0; col < CELL; col++) {
      if (key[row][col]) {
        if (row === 0 || col === 0 || row === CELL - 1 || col === CELL - 1)
          x.fillRect(col, row, 1, 1);
        continue;
      }
      if (filled(row - 1, col) || filled(row + 1, col)
       || filled(row, col - 1) || filled(row, col + 1)) x.fillRect(col, row, 1, 1);
    }
  return c;
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
    } else if (name === 'pedlar') {
      baked.set('pedlar', bakeGrid(grid, 'N'));
      for (const [id, tint] of Object.entries(LOAD_TINT))
        baked.set(`pedlar:${id}`, bakeGrid(grid, tint));
    } else if (flesh.has(name)) {
      const bent = deform(grid, name);
      baked.set(name, bakeGrid(bent));
      baked.set(`wrong:${name}`, bakeGrid(wrongen(bent, name)));
      /* 비틀린 그림에서 고리를 뜬다 — 원본에서 뜨면 정예의 테두리만
         한 픽셀씩 어긋나 몸에서 떠 보인다. */
      for (const ink of ELITE_RIM) baked.set(`rim:${ink}:${name}`, bakeRim(bent, ink));
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
  /* ── 이물(異物)의 다섯 ────────────────────────────────────
     여기 있으면 안 되는 층들이라, 돌을 쌓는 방식부터 나머지 여섯과
     달라야 한다. 판을 밟는 순간 「이건 던전이 아니다」가 글자보다
     먼저 와야 한다. */
  // 비어 있는 성소: 표백된 돌, 아주 넓은 켜. 너무 깨끗해서 불편하다.
  sanctum: { base:'w', grain:'W', mortar:'G', floor:'G', dust:'w',  style:'ashlar' },
  // 바깥: 벽이 벽이 아니다. 고인 물빛 위에 아무것도 안 깔린다.
  void:    { base:'b', grain:'P', mortar:'k', floor:'k', dust:'b',  style:'streak' },
  // 눈의 방: 젖은 살. 켜가 없고 결이 사방으로 돈다.
  eyes:    { base:'r', grain:'R', mortar:'k', floor:'r', dust:'r',  style:'rough' },
  // 뱃속: 삭아 가는 살과 위액.
  gullet:  { base:'e', grain:'E', mortar:'r', floor:'r', dust:'e',  style:'streak' },
  // 지지직: 잘못 그려진 층. 강철빛 잡음이 켜를 끊어 놓는다.
  static:  { base:'g', grain:'s', mortar:'k', floor:'k', dust:'s',  style:'brick' },
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
  /* 칸을 16으로 올렸으니 지형도 16으로 그린다. 처음에는 8로 그려서
     두 배로 늘렸는데, 그러면 결 한 점이 2×2 덩어리가 된다 — 「픽셀이
     얼룩덜룩하다」가 오히려 심해졌다. 무늬의 **구조**(이음매, 켜)는
     U배로 키우고, **결**은 한 픽셀로 둔다. 구조는 커야 읽히고 결은
     작아야 결이다. */
  const c = document.createElement('canvas');
  c.width = CELL; c.height = CELL;
  const x = c.getContext('2d');
  const U = CELL / 8;                    // 옛 8칸 좌표 한 칸의 크기
  const u = (a, b, w, h) => x.fillRect(a * U, b * U, w * U, h * U);
  let rs = (variant * 2654435761 + theme.length * 7919) % 2147483647;
  const rr = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  /* 결 한 점 — 언제나 한 픽셀. 칸이 넓어졌으니 점은 조금 더 뿌려도
     같은 밀도가 아니라 더 성기게 남는다. */
  const grit = n => { for (let i = 0; i < n; i++)
    x.fillRect((rr() * CELL) | 0, (rr() * CELL) | 0, 1, 1); };

  if (kind === 'wall') {
    x.fillStyle = PALETTE[T.base]; x.fillRect(0, 0, CELL, CELL);
    /* 결은 드물어야 결이다. 일곱 점은 무늬가 아니라 잡음이었다.
       그리고 **묽어야** 결이다 — 확대해서 보니 좁은 굴의 결(#c8955c)이
       바탕(#5e3a1c) 위에서 색종이 조각처럼 튀고 있었다. 점 수를 줄이는
       것만으로는 안 되고, 바탕 쪽으로 반쯤 끌어와야 무늬로 읽힌다. */
    x.globalAlpha = 0.55;
    x.fillStyle = PALETTE[T.grain];
    grit(3);
    x.globalAlpha = 1;
    x.fillStyle = PALETTE[T.mortar];
    if (T.style === 'brick') {
      // Running bond: one course line, staggered head joints.
      u(0, (variant % 2 ? 3 : 4), 8, 0.5);
      u(variant % 2 ? 2 : 5, 0, 0.5, 4);
      u(variant % 2 ? 6 : 1, 4, 0.5, 4);
    } else if (T.style === 'ashlar') {
      // Big dressed blocks: two courses, joints lined up.
      u(0, 3, 8, 0.5);
      u(0, 7.5, 8, 0.5);
      u(variant % 2 ? 3 : 6, 0, 0.5, 3);
      u(variant % 2 ? 6 : 3, 4, 0.5, 3);
    } else if (T.style === 'streak') {
      // Water has been running down this for a long time.
      for (let i = 0; i < 3; i++)
        u((rr() * 8) | 0, (rr() * 4) | 0, 0.5, 3 + ((rr() * 4) | 0));
    } else {
      // rough: no courses, just broken edges and bite marks.
      for (let i = 0; i < 4; i++)
        u((rr() * 8) | 0, (rr() * 8) | 0, 0.5 + ((rr() * 2) | 0), 0.5);
    }
  } else {
    x.fillStyle = PALETTE[T.floor]; x.fillRect(0, 0, CELL, CELL);
    /* 바닥은 조용해야 한다. 배우가 서는 무대이지 무대가 배우는 아니다.
       칸마다 점을 넷씩 뿌리면 수백 칸이 모여 텔레비전 노이즈가 된다 —
       여섯 변종 중 셋만, 그것도 두어 점만 받는다. */
    if (variant % 2 === 0) {
      x.globalAlpha = 0.5;
      x.fillStyle = PALETTE[T.dust];
      grit(2 + ((rr() * 2) | 0));
      x.globalAlpha = 1;
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
