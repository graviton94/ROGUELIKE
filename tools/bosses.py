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
    """잿불의 대군주 — 갑옷 가슴이 갈라져 화로가 드러난다."""
    c = Canvas(32)
    c.wedge([(15, 10), (0, 26), (3, 31), (15, 31)], 'cloak')   # 망토 — 넓게
    c.mirror()
    c.rect(5, 22, 10, 31, 'plate')                             # 팔
    c.mirror()
    c.ellipse(16, 20, 10, 8, 'plate')                          # 흉갑
    c.wedge([(3, 17), (9, 13), (12, 17), (6, 20)], 'plate')    # 견갑 — 각지게
    c.mirror()
    c.rect(12, 20, 19, 22, 'trim')                             # 허리띠
    c.ellipse(16, 10, 5, 5, 'helm')                            # 투구는 어둡게
    if view != 'up':
        c.rect(14, 16, 17, 24, 'fire')                         # 갈라진 가슴
    for x, h in ((9, 4), (12, 2), (16, 0), (19, 2), (22, 4)):  # 왕관 — 뾰족하게
        c.rect(x, h, x + 1, 6, 'crown')
    c.rect(9, 6, 23, 7, 'crown')
    rows = c.render(plate='gold', cloak='red', fire='ember',
                    helm=('steel', 1), crown=('gold', 3), trim=('gold', 0))
    g = [list(r) for r in rows]
    if view == 'up':
        return [''.join(r) for r in g]
    ex = (13, 18) if view == 'down' else (17, 19)
    for x in ex:                                               # 투구 틈의 불
        g[10][x] = 'O'; g[11][x] = 'm'
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
