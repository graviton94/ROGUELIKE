# -*- coding: utf-8 -*-
"""repaint.py — study.py가 뽑아낸 규칙대로 스프라이트를 다시 칠한다.

배운 규칙 (0x72 DungeonTileset II, CC0 — 에셋이 아니라 원리만 가져온다):
  1. 공용 외곽선 한 색. 순검정이 아니라 살짝 색이 든 짙은 색. 전부 두른다.
  2. 한 칸은 5색 안팎. 램프는 4단 (그늘 · 본색 · 밝음 · 하이라이트).
  3. 램프를 따라 색조를 민다 — 어두울수록 붉게/차갑게, 밝을수록 노랗게.
  4. 화면 대부분은 저채도. 고채도는 강조에만.
  5. 광원은 위. 윗면이 밝고 아랫면이 어둡다.
"""
import io, re, sys

PAL = """const PAL = {
  '.':null,
  /* 공용 외곽선 — 순검정이 아니라 색이 든 짙은 색. 시트의 35%가 이 한 색이었다. */
  o:'#151120',
  /* 강철 (저채도, 화면의 대부분) — 어두운 쪽은 보라로, 밝은 쪽은 푸른 흰색으로 */
  1:'#2b2438', 2:'#544f6b', 3:'#8e8ea6', 4:'#e6eaf3',
  /* 황동·적열 (따뜻한 강조) — 붉은 그늘에서 노란 하이라이트로 */
  5:'#4a1e14', 6:'#9c3f18', 7:'#e8802a', 8:'#ffd98a',
  /* 네온 청록 (차가운 강조) */
  q:'#0d3542', w:'#12869c', e:'#35d0e8', r:'#bff2ff',
  /* 자홍 (위협) */
  z:'#38103e', x:'#8c1f9e', c:'#d94ce8', v:'#ffb8f5',
  /* 산성 녹 (보상) */
  h:'#0f3620', j:'#1e8c44', k:'#4de07d', l:'#c6ffd2',
  /* 경고 적 */
  m:'#5c1020', n:'#ff4a5e',
};"""

ART = """const ART = {
  /* 주인공 — 강철 저채도 몸체 · 청록 바이저 하나 · 등의 압력로만 따뜻하게.
     강조색을 둘로 제한하면 형태가 먼저 읽힌다. */
  hero:[
    '.....oooooo.....',
    '....o444444o....',
    '...o44444444o...',
    '...o4qqqqqq4o...',
    '...o4qerreq4o...',
    '...o44444444o...',
    '..o5o333333o5o..',
    '..o75o3333o57o..',
    '..o875o22o578o..',
    '..o75o3333o57o..',
    '...o33333333o...',
    '...o3o2222o3o...',
    '...ooo2222ooo...',
    '.....o2222o.....',
    '....o22oo22o....',
    '....oo....oo....'],
  /* 배선 게 — 낮고 넓다. 붉은 껍질 위에 얹힌 하이라이트로 위에서 빛이 온다. */
  crawler:[
    '................',
    '................',
    '..o..........o..',
    '..on........no..',
    '.oo6oooooooo6oo.',
    '.o667777777766o.',
    '.o678888888876o.',
    'oo6788oooo8876oo',
    'o5678o5665o8765o',
    'o5567777777765oo',
    '.o556777777655o.',
    '..oo5o5665o5oo..',
    '..o5o.o55o.o5o..',
    '.oo...o55o...oo.',
    '......oooo......',
    '................'],
  /* 장갑 보행기 — 크고 두껍다. 저채도 강철 덩어리에 붉은 눈 둘. */
  plate:[
    '..oooooooooooo..',
    '.o444444444444o.',
    'o44444444444444o',
    'o4o2222222222o4o',
    'o4o2nn2222nn2o4o',
    'o43o22222222o34o',
    'o43333333333334o',
    'o43333333333334o',
    'o4o3333333333o4o',
    '.o2o22222222o2o.',
    '.o2o3o2222o3o2o.',
    '..o2o3o22o3o2o..',
    '..o2o.o33o.o2o..',
    '..o3o.o22o.o3o..',
    '..ooo.o22o.ooo..',
    '......oooo......'],
  /* 나노 군체 — 윤곽선이 없는 유일한 것. 형태가 없다는 것이 그 규칙이다. */
  swarm:[
    '....c...c.......',
    '..c.xcx...c.z...',
    '.zxc.c.xc.cxz...',
    '..c.xc.c.z.c....',
    '.c.xcvcx..xc....',
    '...c.vc.xc..c...',
    '.xc..cvc..cx....',
    '..c.xc.vc.xc.c..',
    '.c..c.xcx..c....',
    '...xc..c.xc..c..',
    '.c..xc.xc..xc...',
    '..c..c.c.xc.....',
    '....xc..c...c...',
    '..c...xc...c....',
    '.....c...c......',
    '................'],
  /* 흡열 드론 — 떠 있다. 청록 강조 하나에 붉은 눈. 다리는 가늘게. */
  siphon:[
    '.....oooooo.....',
    '...ooqqqqqqoo...',
    '..oqwwwwwwwwqo..',
    '.oqweeeeeeeewqo.',
    '.oqweeoooooewqo.',
    'oqweeeonnoeeewqo',
    'oqweeeonnoeeewqo',
    'oqweeeeeeeeeewqo',
    'oqwerrrrrrrrewqo',
    '.oqweeeeeeeewqo.',
    '..oqwwwwwwwwqo..',
    '...ooqqqqqqoo...',
    '....o.o..o.o....',
    '...oqo.oo.oqo...',
    '..oqo..oo..oqo..',
    '..oo....oo...oo.'],
  /* 부품함 — 청록 상자에 황동 자물쇠. 뚜껑 위쪽이 밝다. */
  cache:[
    '................',
    '..oooooooooooo..',
    '.oqwwwwwwwwwwqo.',
    '.oweeeeeeeeeewo.',
    '.owe11111111ewo.',
    '.owe18888881ewo.',
    '.owe18777781ewo.',
    '.owe18777781ewo.',
    '.owe18888881ewo.',
    '.owe11111111ewo.',
    '.owqqqqqqqqqqwo.',
    '.oqwwwwwwwwwwqo.',
    '..oooooooooooo..',
    '................',
    '................',
    '................'],
  /* 화로 — 유일하게 아래에서 빛이 오는 것. 불이 광원이기 때문이다. */
  forge:[
    '................',
    '.......o........',
    '......o7o.......',
    '.....o787o......',
    '....o78887o.....',
    '...o7888887o....',
    '...o7888887o....',
    '....o78887o.....',
    '.....o777o......',
    '..oooo666oooo...',
    '.o333333333333o.',
    'o22222222222222o',
    'o11111111111111o',
    '.oooooooooooooo.',
    '................',
    '................'],
  /* 하강로 — 보상색(산성 녹) 하나만. 안쪽이 어두워 깊이가 보인다. */
  stair:[
    '................',
    '..oooooooooooo..',
    '.ohjjjjjjjjjjho.',
    '.ojkkkkkkkkkkjo.',
    '.ojkllllllllkjo.',
    '.ojklooooooolkjo',
    '.ojklo111111lkjo',
    '.ojklo1oooo1lkjo',
    '.ojklo111111lkjo',
    '.ojklooooooolkjo',
    '.ojkllllllllkjo.',
    '.ojkkkkkkkkkkjo.',
    '.ohjjjjjjjjjjho.',
    '..oooooooooooo..',
    '................',
    '................'],
};"""

src = open('deeprun-live.src.html', encoding='utf-8').read()

# 검증: 모든 행이 정확히 16자, 모든 문자가 팔레트에 있는가
keys = set(re.findall(r"[ '\"]?([\w.])['\"]?\s*:\s*(?:null|'#)", PAL))
keys.add('.')
bad = []
for name, body in re.findall(r"(\w+):\[(.*?)\]", ART, re.S):
    rows = re.findall(r"'([^']*)'", body)
    if len(rows) != 16: bad.append(f'{name}: 행이 {len(rows)}개')
    for i, r in enumerate(rows):
        if len(r) != 16: bad.append(f'{name}[{i}]: {len(r)}자 — "{r}"')
        for ch in r:
            if ch not in keys: bad.append(f'{name}[{i}]: 팔레트에 없는 문자 {ch!r}')
if bad:
    print('스프라이트 검증 실패:')
    for b in bad[:30]: print('  ', b)
    sys.exit(1)
print('스프라이트 검증 통과 — 8장 × 16행 × 16자, 팔레트 밖 문자 없음')

src = re.sub(r"const PAL = \{.*?\n\};", PAL, src, count=1, flags=re.S)
src = re.sub(r"const ART = \{.*?\n\};", ART, src, count=1, flags=re.S)
open('deeprun-live.src.html', 'w', encoding='utf-8').write(src)
print('다시 칠했다.')
