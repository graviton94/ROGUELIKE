# -*- coding: utf-8 -*-
# 쥐·들개·재의 사냥개를 손으로.
#
# 도형을 조합하니 계속 상자가 됐다. 눈먼 검사에서 둘 다 "곰"으로
# 읽혔는데, 곰과 갈리는 것은 딱 셋이다.
#
#   · 아래로 길게 뻗은 주둥이 (곰은 얼굴이 납작하다)
#   · 얇고 긴 꼬리           (곰에는 없다)
#   · 귀 모양               (쥐는 크고 둥글게, 개는 세워 뾰족하게)
#
# 그래서 이 셋을 실루엣에서 못 놓치게 그린다.


def tail(rows, cells, ch):
    """꼬리를 한쪽에만 붙인다. 좌우가 달라야 꼬리로 읽힌다."""
    g = [list(r) for r in rows]
    for x, y in cells:
        if g[y][x] == '.':
            g[y][x] = ch
    return [''.join(r) for r in g]


# 쥐가 원숭이·개로 읽혔다. 쥐를 쥐로 만드는 것은 몸만큼 긴 꼬리다.
RAT_TAIL = [(12, 14), (13, 13), (14, 12), (15, 11), (15, 10),
            (15, 9), (14, 8), (13, 8)]
DOG_TAIL = [(13, 11), (14, 10), (15, 9)]

RAT = {
    'down': tail([
        sym('........'), sym('........'), sym('........'),
        sym('.111....'),          # 귀 — 몸에 비해 아주 크고 둥글다
        sym('1nNN1...'),
        sym('1nNNN1..'),
        sym('..1nNNNN'),          # 머리
        sym('..1nNMMM'),
        sym('..1nNkMM'),          # 눈 — 가운데를 비워 둘로 가른다
        sym('..1nNMMM'),
        sym('...1nNMM'),
        sym('....1nhh'),          # 주둥이 — 아래로 뻗는다
        sym('.....1n0'),          # 코
        sym('...1nNNN'),          # 몸은 뒤에 숨는다
        sym('..1nNNNN'),
        sym('..11.11.'),          # 발 넷
    ], RAT_TAIL, 'n'),
    'side': tail([
        raw('................'),
        raw('................'),
        raw('................'),
        raw('..........11....'),
        raw('.........1nN1...'),
        raw('....111111nNN1..'),
        raw('..11nNNNNNNNNn1.'),
        raw('.1nNMMMMMMNMkN1.'),
        raw('1nNMMMMMMMMNNhh1'),
        raw('1nNMMMMMMMMMN001'),
        raw('.1nNMMMMMMMNn11.'),
        raw('..1nNNNNNNNn1...'),
        raw('...1n1..1n1.....'),
        raw('...1N1..1N1.....'),
        raw('...1n1..1n1.....'),
        raw('...11....11.....'),
    ], [], 'n'),
    'up': tail([
        sym('........'), sym('........'), sym('........'),
        sym('..11....'),
        sym('.1nN1...'),
        sym('.1nNN1..'),
        sym('..1nNNNN'),
        sym('..1nNNNN'),
        sym('..1nNNNN'),
        sym('..1nNMMM'),
        sym('...1nMMM'),
        sym('...1nMMM'),
        sym('...1nNNN'),
        sym('...1nNNN'),
        sym('..1nNNNN'),
        sym('..11.11.'),
    ], RAT_TAIL, 'n'),
}


# 개 골격을 나무 재질로 한 번만 적는다. 다른 재질은 글자만 바꿔치기한다 —
# %s 로 조립했더니 자릿수가 어긋나 15글자짜리 행이 나왔다.
DOG_ROWS = {
    'down': [
        sym('..11....'),          # 귀 — 세워 뾰족하다
        sym('.1nM1...'),
        sym('.1nNM1..'),
        sym('..1nNMMM'),          # 머리
        sym('..1nNMMM'),
        sym('..1nNkMM'),          # 눈
        sym('..1nNMMM'),
        sym('...1nNMM'),
        sym('....1nNM'),          # 주둥이 — 길게
        sym('....1nNM'),
        sym('.....1nh'),          # 코
        sym('....1nWW'),          # 이빨
        sym('...1nNMM'),
        sym('..1nNMMM'),
        sym('..1nNNNN'),
        sym('..11.11.'),          # 발 넷
    ],
    'up': [
        sym('..11....'),
        sym('.1nM1...'),
        sym('.1nNM1..'),
        sym('..1nNMMM'),
        sym('..1nNMMM'),
        sym('..1nNMMM'),
        sym('..1nNMMM'),
        sym('...1nNMM'),
        sym('....1nNM'),
        sym('....1nNM'),
        sym('.....1nM'),
        sym('....1nNM'),
        sym('...1nNMM'),
        sym('..1nNMMM'),
        sym('..1nNNNN'),
        sym('..11.11.'),
    ],
    'side': [
        raw('................'),
        raw('.........11.....'),
        raw('........1nM1....'),
        raw('....11111nNM1...'),
        raw('..11nNMMMMMMn1..'),
        raw('.1nNMMMMMMMkNM1.'),
        raw('1nNMMMMMMMMMMNM1'),
        raw('1nNMMMMMMMMMNWW1'),
        raw('.1nNMMMMMMMMNn1.'),
        raw('..1nNNMMMMNNn1..'),
        raw('...1n1...1n1....'),
        raw('...1M1...1M1....'),
        raw('...1n1...1n1....'),
        raw('...1M1...1M1....'),
        raw('...11.....11....'),
        raw('................'),
    ],
}


def hound(fur, ember=False):
    """들개와 재의 사냥개는 골격이 같고 재질만 다르다."""
    tr = str.maketrans('1nNM', {'wood': '1nNM', 'stone': '2dgG'}[fur])
    out = {}
    for v, rows in DOG_ROWS.items():
        g = [r.translate(tr) for r in rows]
        if ember:
            g = [r.replace('k', 'O').replace('W', 'm') for r in g]
            # 재의 사냥개는 개 골격을 그대로 쓰면 회색 쥐로 읽힌다.
            # 아가리를 벌리고 송곳니와 불을 물려 짐승으로 못박는다.
            if v != 'up':
                g = [list(r) for r in g]
                for x in range(6, 10):
                    g[11][x] = 'm'
                g[12][6] = g[12][9] = 'W'
                g[12][7] = g[12][8] = 'O'
                g[10][7] = g[10][8] = 'm'
                g = [''.join(r) for r in g]
        out[v] = tail(g, DOG_TAIL if v != 'side' else [], 'n'.translate(tr))
    return out


GRIDS = {'rat': RAT, 'dog': hound('wood'), 'ashhound': hound('stone', ember=True)}
