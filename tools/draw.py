#!/usr/bin/env python3
"""격자 작성기.

정면·후면 캐릭터와 대칭인 물체는 **왼쪽 절반 8글자만** 적습니다. 나머지
8글자는 이 스크립트가 뒤집어 붙입니다. 좌우가 어긋날 방법이 없어집니다.

    sym('..0nnhhh')  ->  '..0nnhhhhhhnn0..'

옆모습이나 대각선 도구처럼 좌우가 달라야 하는 것은 raw()에 16글자를
그대로 적습니다.

사용법:  python3 tools/draw.py <작업파일.py>
작업파일은 GRIDS = {'이름': [...16행...]} 를 만들고, 이 스크립트가
src/pixels.js 안의 같은 이름 격자를 그 자리에서 갈아끼웁니다.
"""
import re
import sys
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIXELS = ROOT / 'src' / 'pixels.js'


def sym(left):
    """왼쪽 절반을 받아 좌우대칭 한 행을 만든다.

    8글자를 주면 16칸, 16글자를 주면 32칸이 됩니다. 격자 크기가
    달라져도 규칙은 하나입니다 — 절반만 그리면 어긋날 수가 없습니다."""
    if len(left) not in (8, 16):
        raise ValueError(f'왼쪽 절반은 8 또는 16글자여야 합니다: {left!r} ({len(left)})')
    return left + left[::-1]


def raw(line):
    """좌우가 달라야 하는 행. 16 또는 32글자 그대로."""
    if len(line) not in (16, 32):
        raise ValueError(f'16 또는 32글자여야 합니다: {line!r} ({len(line)})')
    return line


def splice(name, grid, src):
    """pixels.js 안의 격자 하나를 그 자리에서 교체한다.

    SPRITES / RACE_BODY / CLASS_KIT 어디에 있든, 들여쓰기가 몇 칸이든
    같은 방식으로 찾습니다. 이름은 'rat' 또는 'human.down' 꼴입니다.
    """
    n = len(grid)
    if n not in (16, 32):
        raise ValueError(f'{name}: {n}행 — 16 또는 32라야 합니다')
    for i, line in enumerate(grid):
        if len(line) != n:
            raise ValueError(f'{name} {i}행: {len(line)}글자 (={n} 이어야) |{line}|')

    key = name.split('.')[-1]
    pat = re.compile(r'(^([ \t]*)%s: \[\n)(?:.*?\n)*?(\2\],)' % re.escape(key), re.M)

    if name.count('.'):                       # human.down 처럼 뷰가 붙은 경우
        owner = name.split('.')[0]
        block = re.compile(r'^([ \t]*)%s: \{\n(?:.*?\n)*?\1\},' % re.escape(owner), re.M)
        m = block.search(src)
        if not m:
            raise KeyError(f'{owner} 블록을 찾지 못했습니다')
        inner = m.group(0)
        m2 = pat.search(inner)
        if not m2:
            raise KeyError(f'{name} 을 찾지 못했습니다')
        body = ''.join("%s  '%s',\n" % (m2.group(2), l) for l in grid)
        return src.replace(inner, inner[:m2.start()] + m2.group(1) + body + m2.group(3) + inner[m2.end():])

    m = pat.search(src)
    if not m:
        raise KeyError(f'{name} 을 찾지 못했습니다')
    body = ''.join("%s  '%s',\n" % (m.group(2), l) for l in grid)
    return src[:m.start()] + m.group(1) + body + m.group(3) + src[m.end():]


def to_dir(name, views, src):
    """평평한 SPRITES 항목 하나를 {down, side, up} 묶음으로 바꾼다.

    몬스터에 방향이 생기면서 필요해졌습니다. 기존 격자가 배열이든
    이미 묶음이든 상관없이 통째로 갈아 끼웁니다."""
    for v, grid in views.items():
        n = len(grid)
        if n not in (16, 32):
            raise ValueError(f'{name}.{v}: {n}행 — 16 또는 32라야 합니다')
        for i, line in enumerate(grid):
            if len(line) != n:
                raise ValueError(f'{name}.{v} {i}행: {len(line)}글자 (={n} 이어야) |{line}|')

    # 일부 방향만 줘도 된다 — 준 것만 갈아 끼우고 나머지는 그대로 둔다.
    cur = {}
    obj0 = re.compile(r'^  %s: \{\n(?:.*?\n)*?  \},' % re.escape(name), re.M).search(src)
    if obj0:
        for v in ('down', 'side', 'up'):
            m = re.search(r"    %s: \[\n((?:      '.*',\n)+)    \]," % v, obj0.group(0))
            if m:
                cur[v] = re.findall(r"      '(.*)',", m.group(1))
    merged = {**cur, **views}
    missing = [v for v in ('down', 'side', 'up') if v not in merged]
    if missing:
        raise KeyError(f'{name}: {missing} 방향이 없습니다')

    body = f'  {name}: {{\n'
    for v in ('down', 'side', 'up'):
        body += f'    {v}: [\n'
        body += ''.join("      '%s',\n" % l for l in merged[v])
        body += '    ],\n'
    body += '  },'

    # 배열 형태 또는 이미 묶음 형태, 둘 다 잡는다
    arr = re.compile(r'^  %s: \[\n(?:.*?\n)*?  \],' % re.escape(name), re.M)
    obj = re.compile(r'^  %s: \{\n(?:.*?\n)*?  \},' % re.escape(name), re.M)
    for pat in (obj, arr):
        m = pat.search(src)
        if m:
            return src[:m.start()] + body + src[m.end():]
    raise KeyError(f'{name} 을 찾지 못했습니다')


def apply(grids):
    src = PIXELS.read_text()
    n = 0
    for name, grid in grids.items():
        if isinstance(grid, dict):
            src = to_dir(name, grid, src); n += 3
        else:
            src = splice(name, grid, src); n += 1
    PIXELS.write_text(src)
    print(f'{n}장 반영: ' + ', '.join(grids))


if __name__ == '__main__':
    job = Path(sys.argv[1])
    spec = importlib.util.spec_from_file_location('job', job)
    mod = importlib.util.module_from_spec(spec)
    mod.sym, mod.raw = sym, raw
    spec.loader.exec_module(mod)
    apply(mod.GRIDS)
