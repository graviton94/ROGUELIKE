#!/usr/bin/env python3
"""이름 붙은 넷을 32칸으로 짓고 src/pixels.js 의 BOSSES 를 다시 쓴다.

    python3 tools/bosses.py

보스를 참고본의 사람 골격에서 뽑았더니 그냥 **덩치 큰 사람**이 나왔다.
이름이 붙은 것은 종이 같아도 실루엣이 달라야 한다 — 뼈를 씹는 자는
어깨가 머리를 삼킬 만큼 넓고, 재 속의 사제는 다리가 없고, 화로를 감은
것은 몸이 또아리고, 대군주는 가슴이 갈라져 불이 보인다. 그래서 사람을
빌리지 않고 도형으로 짓는다.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shape import Canvas

ROOT = Path(__file__).resolve().parent.parent
PIXELS = ROOT / 'src' / 'pixels.js'


def bonechewer(view):
    """뼈를 씹는 자 — 어깨가 머리를 삼킨 덩치. 손에 뼈몽둥이."""
    c = Canvas(32)
    c.rect(4, 22, 11, 31, 'hide')                      # 다리
    c.mirror()
    c.ellipse(16, 20, 12, 8, 'skin')                   # 가슴·어깨
    c.rect(2, 15, 7, 27, 'skin')                       # 팔
    c.ellipse(4, 27, 4, 4, 'skin')                     # 주먹
    c.mirror()
    c.ellipse(16, 10, 6, 5, 'skin')                    # 머리 — 어깨에 파묻힌다
    c.rect(10, 16, 21, 18, 'belt')                     # 어깨끈
    # 어깨에 박은 뼈. 가늘게 뽑으면 더듬이로 읽히므로 쐐기로 놓는다.
    c.wedge([(6, 14), (1, 6), (5, 5), (9, 13)], 'bone')
    c.mirror()
    rows = c.render(skin='wood', hide='linen', bone='bone', belt=('bone', 1))
    g = [list(r) for r in rows]
    if view == 'up':
        return [''.join(r) for r in g]
    if view == 'down':
        g[10][12] = 'W'; g[10][13] = 'k'
        g[10][18] = 'k'; g[10][19] = 'W'
        for x in (14, 17):
            g[13][x] = 'W'                             # 엄니
    else:
        g[10][19] = 'k'; g[10][18] = 'W'
        g[13][20] = 'W'
    # 뼈몽둥이 — 한 손에만 든다. 좌우가 달라야 무기를 든 것으로 읽힌다.
    b = Canvas(32)
    b.line(25, 4, 27, 24, 'bone', w=3)
    b.ellipse(25, 3, 3, 3, 'bone')
    b.ellipse(28, 26, 3, 3, 'bone')
    club = b.render(bone='bone')
    for y in range(32):
        for x in range(32):
            if club[y][x] != '.':
                g[y][x] = club[y][x]
    return [''.join(r) for r in g]


def ashpriest(view):
    """재 속의 사제 — 다리가 없다. 두건 속은 비었고 눈만 탄다."""
    c = Canvas(32)
    c.wedge([(16, 26), (6, 30), (10, 20), (16, 18)], 'robe')   # 옷자락
    c.mirror()
    c.wedge([(16, 2), (7, 14), (9, 26), (16, 27)], 'robe')     # 몸통·두건
    c.mirror()
    c.rect(4, 16, 9, 22, 'robe')                               # 소매
    c.mirror()
    c.ellipse(16, 11, 5, 5, 'hollow')                          # 비어 있는 얼굴
    rows = c.render(robe='violet', hollow=('void', 0))
    g = [list(r) for r in rows]
    if view == 'up':
        for y in range(9, 15):                                 # 뒤통수는 두건뿐
            for x in range(11, 21):
                if g[y][x] != '.':
                    g[y][x] = 'p'
        return [''.join(r) for r in g]
    ex = (13, 18) if view == 'down' else (17, 19)
    for x in ex:
        g[11][x] = 'O'; g[12][x] = 'm'
    # 잿가루 — 옷자락 아래로 흩어진다
    for x, y in ((10, 30), (13, 31), (19, 31), (22, 30)):
        g[y][x] = '9'
    return [''.join(r) for r in g]


def furnacecoil(view):
    """화로를 감은 것 — 몸 자체가 또아리다. 고리 사이로 불이 보인다."""
    c = Canvas(32)
    c.ellipse(16, 22, 15, 10, 'coil')                  # 바깥 또아리
    c.ellipse(16, 22, 11, 7, 'seam')
    c.ellipse(16, 22, 9, 6, 'coil')
    c.ellipse(16, 22, 5, 3, 'fire')                    # 가운데 화로
    c.rect(13, 8, 18, 20, 'coil')                      # 세운 목
    c.ellipse(16, 7, 7, 5, 'coil')                     # 머리
    c.line(11, 4, 6, 0, 'fin', w=2)                    # 갈기
    c.mirror()
    rows = c.render(coil='teal', seam=('teal', 0), fire='ember', fin='gold')
    g = [list(r) for r in rows]
    if view == 'up':
        for y in range(4, 12):
            for x in range(12, 20):
                if g[y][x] not in '.':
                    g[y][x] = 'c'
        return [''.join(r) for r in g]
    if view == 'down':
        g[7][12] = 'W'; g[7][13] = 'O'
        g[7][18] = 'O'; g[7][19] = 'W'
        for x in range(14, 18):
            g[10][x] = 'W'                             # 이빨
    else:
        g[7][19] = 'O'; g[7][18] = 'W'
        g[10][20] = 'W'
    return [''.join(r) for r in g]


def emperor(view):
    """잿불의 대군주 — 갑옷 가슴이 갈라져 화로가 드러난다.

    처음에 타원으로 지었더니 눈먼 검사에서 **커비**로 읽혔다. 둥근
    금색 덩어리에 짧은 팔다리였으니 맞는 말이다. 왕은 둥글면 안 된다 —
    어깨가 각지고 넓게 뻗고, 허리로 갈수록 좁아지고, 망토가 바닥까지
    끌리고, 다리가 벌어져 있어야 선 사람으로 읽힌다."""
    c = Canvas(32)
    # 망토 — 어깨에서 바닥까지 끌린다. 실루엣의 바깥을 이게 만든다.
    c.wedge([(14, 11), (0, 24), (0, 31), (14, 31)], 'cloak')
    c.mirror()
    c.rect(2, 12, 29, 14, 'cloak')                             # 어깨를 덮는 깃
    # 다리 — 벌리고 선다. 붙이면 덩어리가 된다.
    c.rect(9, 24, 13, 31, 'plate')
    c.mirror()
    # 몸통 — 어깨가 넓고 허리가 좁은 사다리꼴
    c.wedge([(5, 15), (27, 15), (21, 26), (11, 26)], 'plate')
    # 견갑 — 어깨 밖으로 각지게 튀어나온다
    c.wedge([(1, 16), (7, 11), (13, 15), (12, 19), (3, 20)], 'plate')
    c.mirror()
    # 팔
    c.rect(2, 20, 6, 28, 'plate')
    c.mirror()
    c.rect(11, 24, 20, 26, 'trim')                             # 허리띠
    c.rect(12, 7, 19, 15, 'helm')                              # 투구 — 각진 통
    if view != 'up':
        c.rect(14, 17, 17, 24, 'fire')                         # 갈라진 가슴
    for x, h in ((10, 3), (13, 1), (16, 0), (19, 1), (22, 3)):  # 왕관 — 뾰족하게
        c.rect(x, h, x + 1, 6, 'crown')
    c.rect(10, 5, 23, 6, 'crown')
    # 홀 — 한 손에만 든다. 좌우가 달라야 들고 있는 것으로 읽힌다.
    if view != 'up':
        c.rect(28, 8, 29, 30, 'trim')
        c.ellipse(29, 6, 2, 2, 'fire')
    rows = c.render(plate='gold', cloak='red', fire='ember',
                    helm=('steel', 1), crown=('gold', 3), trim=('gold', 0))
    g = [list(r) for r in rows]
    if view == 'up':
        return [''.join(r) for r in g]
    ex = (13, 18) if view == 'down' else (17, 19)
    for x in ex:                                               # 투구 틈의 불
        g[10][x] = 'O'; g[11][x] = 'm'
    for x in range(13, 19):                                    # 가로로 난 시야 틈
        if g[12][x] == 'd':
            g[12][x] = '2'
    return [''.join(r) for r in g]


BOSSES = {
    'ogre': bonechewer,
    'wraith': ashpriest,
    'wyrm': furnacecoil,
    'balemperor': emperor,
}

lines = ['export const BOSSES = {']
for name, fn in BOSSES.items():
    lines.append(f'  {name}: {{')
    for v in ('down', 'side', 'up'):
        g = fn(v)
        assert len(g) == 32 and all(len(r) == 32 for r in g), name
        lines.append(f'    {v}: [')
        lines += [f"      '{r}'," for r in g]
        lines.append('    ],')
    lines.append('  },')
lines.append('};')

src = PIXELS.read_text()
out = re.sub(r'export const BOSSES = \{[\s\S]*?\n?\};', '\n'.join(lines), src, count=1)
if out == src:
    raise SystemExit('BOSSES 블록을 찾지 못했습니다')
PIXELS.write_text(out)
print(f'보스 {len(BOSSES)}종 × 3방향 반영')
