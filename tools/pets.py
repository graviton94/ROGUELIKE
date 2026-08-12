# -*- coding: utf-8 -*-
# 4차. 눈먼 검사가 계속 짚어 준 것들.
#
# 쥐를 정면으로 그리면 얼굴만 보인다. 그러면 귀 둘과 주둥이 하나가
# 전부라 곰·당나귀·토끼와 구별이 안 된다. 옆모습은 같은 골격으로
# 이미 "개"로 통과했다 — 네발짐승은 몸 전체가 보여야 종이 읽힌다.
# 그래서 세 방향 모두 옆모습 골격을 쓰고, 방향은 고개와 꼬리로만
# 표시한다. 로그라이크에서 흔히 쓰는 방법이고, 읽히는 쪽이 옳다.
#
# 곰팡이는 대포로, 젤리는 배낭으로 읽혔다. 둘 다 **윤곽이 너무
# 반듯해서** 물건이 됐다. 바닥에 퍼진 것처럼 낮고 우글우글하게.


def beast(o, d, m, b, eye='k', fang=None, tail_len=4, ember=False):
    """네발짐승 옆모습. 재질 네 글자와 꼬리 길이만 다르다."""
    f = fang or m

    def row(s):
        return raw(s.replace('O', o).replace('D', d).replace('M', m)
                   .replace('B', b).replace('E', eye).replace('F', f))
    # 몸을 오른쪽으로 두 칸 민다 — 왼쪽에 꼬리가 나갈 자리를 비운다.
    body = [
        row('................'),
        row('..........OO....'),
        row('.........ODMO...'),
        row('.....OOOOODMMO..'),
        row('...OODMMMMMMMDO.'),
        row('..ODMBBBMMMMEMO.'),
        row('.ODMBBBBMMMMMMMO'),
        row('.ODMBBBBMMMMMFFO'),
        row('..ODMBBBMMMMMDO.'),
        row('...ODMMMMMMMDO..'),
        row('....ODO...ODO...'),
        row('....OMO...OMO...'),
        row('....ODO...ODO...'),
        row('....OMO...OMO...'),
        row('....OO.....OO...'),
        row('................'),
    ]
    g = [list(r) for r in body]
    # 꼬리 — 엉덩이에서 뒤로 뻗는다. 쥐는 몸만큼 길고 가늘게, 개는
    # 짧게 말려 올라간다. 이게 쥐를 쥐로 만드는 한 가지다.
    cells = (((0, 8), (0, 7), (0, 6), (0, 5), (0, 4), (1, 3), (2, 2))
             if tail_len > 4 else                      # 쥐 — 몸만큼 길다
             ((0, 7), (0, 6), (1, 5)))                 # 개 — 짧게 말린다
    for x, y in cells:
        if g[y][x] == '.':
            g[y][x] = d
    if ember:
        for x in (12, 13):
            g[7][x] = 'O'
        g[6][11] = 'm'
    return [''.join(r) for r in g]


def views(**kw):  # noqa: D103
    """세 방향. 골격은 같고 고개와 눈만 다르다."""
    side = beast(**kw)
    down = [r for r in side]
    up = [r.replace('k', kw['m']).replace('O', kw['m']) if False else r for r in side]
    # 뒤를 보면 눈이 안 보인다.
    up = [r.replace('k', kw['m']) for r in side]
    if kw.get('ember'):
        up = [r.replace('O', kw['m']) if False else r for r in up]
    return {'down': down, 'side': side, 'up': up}


def mold():
    """회색 곰팡이 — 바닥에 퍼진 얼룩. 반듯하면 물건이 된다."""
    return [
        sym('........'),
        sym('........'),
        sym('........'),
        sym('........'),
        sym('.....9..'),
        sym('...9..9.'),
        sym('......9.'),
        sym('....99u9'),
        sym('..99uwwu'),
        sym('.9uwwwwu'),
        sym('9uwwuwwu'),
        sym('9uwuwwuw'),
        sym('.9uwwuww'),
        sym('..9uwwuu'),
        sym('...99uww'),
        sym('.....999'),
    ]


def jelly():
    """푸른 젤리 — 밑이 넓고 위가 둥근 덩이. 테두리가 반듯하면 가방이다."""
    return [
        sym('........'),
        sym('........'),
        sym('........'),
        sym('......66'),
        sym('....66bB'),
        sym('...6bBII'),
        sym('..6bBIIB'),
        sym('..6bBIBB'),
        sym('.6bBBBBB'),
        sym('.6bBBBwB'),
        sym('.6bBBBww'),
        sym('6bBBBBBB'),
        sym('6bBBBBBB'),
        sym('6bbBBBBB'),
        sym('.6bbbbbb'),
        sym('..666666'),
    ]


GRIDS = {
    'rat':      views(o='1', d='n', m='N', b='M', tail_len=7),
    'dog':      views(o='1', d='n', m='N', b='M', fang='W', tail_len=3),
    'ashhound': views(o='2', d='d', m='g', b='G', fang='m', tail_len=3, ember=True),
    'mold':     mold(),
    'jelly':    jelly(),
}
