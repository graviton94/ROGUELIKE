# -*- coding: utf-8 -*-
# 뱀을 S자로.
#
# 또아리는 위에서 봐도 결국 원반이라 항아리나 와셔로 읽힌다. 뱀이
# 뱀으로 보이는 건 **몸이 휘어 있을 때**다. 사인 곡선 한 주기를 따라
# 몸을 흘리면 그게 그대로 S자가 된다.
#
# 굵기는 꼬리에서 머리로 갈수록 두꺼워진다 — 한 굵기로 그으면 밧줄이
# 되고, 가늘어지는 끝이 있어야 꼬리로 읽힌다.
import math
import sys
sys.path.insert(0, 'tools')
from shape import Canvas

N = 48


def snake(view):
    c = Canvas(16)
    head = None
    for i in range(N + 1):
        t = i / N
        s = 8 + 4.3 * math.sin(t * 2 * math.pi)     # 휘는 쪽
        u = 2.4 + t * 11.2                          # 흐르는 쪽
        if view == 'down':
            x, y = s, u                             # 머리가 아래
        elif view == 'up':
            x, y = s, 13.6 - t * 11.2               # 머리가 위
        else:
            x, y = u, s                             # 머리가 오른쪽
        # 꼬리에서 머리로 갈수록 두꺼워진다. 한 굵기로 그으면 밧줄이 된다.
        # 몸은 세 칸 균일, 꼬리 끝만 한 칸. 머리 쪽까지 굵히면 S 가
        # 사라지고 몽둥이가 된다 — 굵기로 머리를 말하지 않고 머리는
        # 따로 얹는다.
        r = 0 if t < 0.12 else 1
        c.ellipse(round(x), round(y), r, r, 'body')
        head = (round(x), round(y))
    # 머리 — 몸보다 한 칸 넓은 삼각 쐐기. 뱀 머리는 목보다 벌어져 있다.
    hx, hy = head
    if view == 'down':
        c.wedge([(hx - 3, hy + 2), (hx + 3, hy + 2), (hx + 2, hy - 2), (hx - 2, hy - 2)], 'body')
    elif view == 'up':
        c.wedge([(hx - 3, hy - 2), (hx + 3, hy - 2), (hx + 2, hy + 2), (hx - 2, hy + 2)], 'body')
    else:
        c.wedge([(hx + 2, hy - 3), (hx + 2, hy + 3), (hx - 2, hy + 2), (hx - 2, hy - 2)], 'body')
    # 등무늬는 넣었다 뺐다. 16칸에서는 몸통이 세 칸뿐이라 무늬를 얹으면
    # 결이 아니라 얼룩으로 읽히고 실루엣이 무너진다.
    rows = c.render(body='bone')
    g = [list(r) for r in rows]

    # 눈 둘. 등지고 있을 때는 눈이 보이면 안 된다 — 뒤통수다.
    if view == 'up':
        return [''.join(r) for r in g]
    pairs = {'down': ((hx - 1, hy + 1), (hx + 1, hy + 1)),
             'side': ((hx + 1, hy - 1), (hx + 1, hy + 1))}[view]
    for x, y in pairs:
        if 0 <= x < 16 and 0 <= y < 16 and g[y][x] != '.':
            g[y][x] = 'k'
    return [''.join(r) for r in g]


GRIDS = {'snake': {v: snake(v) for v in ('down', 'side', 'up')}}
