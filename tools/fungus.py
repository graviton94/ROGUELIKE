# -*- coding: utf-8 -*-
# 2차 눈먼 검사에서 떨어진 것들.
#
#   곰팡이 → 새    : 덩이만 모아 놓으니 새 몸통이 됐다. 갓과 자루를
#                    그려 버섯 무리로 만든다.
#   젤리  → 자루   : 윗변의 지그재그가 자루 아가리로 읽혔다. 둥근
#                    돔에 흘러내리는 물방울과 삼킨 뼈를 넣는다.
#   사냥개 → 쥐    : 개 골격을 그대로 썼더니 회색 쥐가 됐다. 아가리를
#                    벌리고 송곳니와 불을 물린다.
import sys
sys.path.insert(0, 'tools')
from shape import Canvas


def mold():
    """회색 곰팡이 — 갓과 자루가 있어야 버섯 무리로 읽힌다."""
    c = Canvas(16)
    for cx, cy, rx in ((4, 9, 3), (11, 8, 4), (8, 12, 3)):
        c.rect(cx - 1, cy, cx, cy + 4, 'stem')            # 자루
        c.ellipse(cx, cy, rx, 2, 'cap')                   # 갓
    rows = c.render(cap='linen', stem=('linen', 1))
    g = [list(r) for r in rows]
    for x, y in ((2, 4), (6, 3), (13, 3), (9, 2), (4, 6)):   # 홀씨
        g[y][x] = 'u'
    for cx, cy in ((4, 9), (11, 8), (8, 12)):             # 갓의 점무늬
        for dx in (-2, 1):
            if 0 <= cx + dx < 16 and g[cy][cx + dx] != '.':
                g[cy][cx + dx] = '9'
    return [''.join(r) for r in g]


def jelly():
    """푸른 젤리 — 둥근 돔에 흘러내리는 방울. 지그재그는 자루가 된다."""
    c = Canvas(16)
    # 바닥을 사각으로 깔았더니 통조림이 됐다. 돔 하나로 두고 아래만
    # 살짝 퍼뜨린다 — 젤리는 제 무게로 주저앉은 모양이다.
    c.ellipse(8, 9, 6, 6, 'goo')
    c.ellipse(8, 13, 7, 3, 'goo')
    rows = c.render(goo='blue')
    g = [list(r) for r in rows]
    for x, y in ((5, 5), (6, 5), (5, 6)):                 # 빛나는 면 — 한쪽에만
        if g[y][x] != '.':
            g[y][x] = 'I'
    for x, y in ((9, 9), (10, 9), (9, 10), (10, 11)):     # 삼킨 뼈
        if g[y][x] != '.':
            g[y][x] = 'w'
    for x, y in ((2, 12), (13, 12)):                      # 흘러내린 방울
        g[y][x] = 'B'
    return [''.join(r) for r in g]


GRIDS = {'mold': mold(), 'jelly': jelly()}
