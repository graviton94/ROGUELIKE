#!/usr/bin/env python3
"""도형으로 짓는 격자.

문자를 한 글자씩 타이핑해서 32칸짜리 용을 그리려니 매번 실루엣이
무너졌습니다. 사람 골격을 빌려 오면 날개를 붙여도 "날개 달린 사람"이
되고요. 용은 사람이 아니라 **머리·목·날개·몸통·꼬리**라는 도형 몇 개고,
그렇게 짓는 편이 맞습니다.

쓰는 쪽은 재질 이름으로 도형만 놓습니다. 외곽선과 명암은 이 파일이
넣습니다 — 손으로 넣으면 매번 어긋나던 두 가지입니다.

    c = Canvas(32)
    c.ellipse(16, 9, 7, 6, 'scale')      # 머리
    c.wedge([(10,14),(1,9),(3,24),(11,23)], 'membrane')   # 날개
    c.mirror()                           # 왼쪽 절반을 오른쪽에 붙인다
    rows = c.render(scale='red', membrane='ember')

명암은 위에서 빛이 온다고 보고 **덩어리의 윗면부터** 밝게 깝니다.
외곽선은 그 재질의 제일 어두운 단계라 검정 공용이 아닙니다.
"""

RAMPS = {
    'skin':   ['0', 'H', 'h', 'a'],
    'hair':   ['1', 'n', 'N', 'M'],
    'wood':   ['1', 'n', 'N', 'M'],
    'linen':  ['9', 'u', 'w', 'W'],
    'bone':   ['9', 'u', 'w', 'W'],
    'steel':  ['2', 'd', 's', 'S'],
    'stone':  ['2', 'd', 'g', 'G'],
    'gold':   ['3', 'o', 'y', 'Y'],
    'red':    ['4', 'r', 'R', 'x'],
    'green':  ['5', 'e', 'E', 'F'],
    'blue':   ['6', 'b', 'B', 'I'],
    'violet': ['7', 'p', 'P', 'V'],
    'teal':   ['8', 'c', 't', 'T'],
    'ember':  ['m', 'o', 'O', 'Y'],
    'void':   ['k', 'q', 'g', 'G'],
}

# 명암을 주지 않고 그대로 찍는 글자들 — 눈처럼 위치가 곧 뜻인 것.
LITERAL = set('kW.')


class Canvas:
    def __init__(self, n=32):
        self.n = n
        self.px = [[None] * n for _ in range(n)]

    # ── 놓기 ────────────────────────────────────────────────
    def _put(self, x, y, mat):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.px[y][x] = mat

    def rect(self, x0, y0, x1, y1, mat):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self._put(x, y, mat)
        return self

    def ellipse(self, cx, cy, rx, ry, mat):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                dx = (x - cx + 0.5) / (rx + 0.5)
                dy = (y - cy + 0.5) / (ry + 0.5)
                if dx * dx + dy * dy <= 1.0:
                    self._put(x, y, mat)
        return self

    def line(self, x0, y0, x1, y1, mat, w=1):
        n = max(abs(x1 - x0), abs(y1 - y0)) or 1
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            for dy in range(w):
                for dx in range(w):
                    self._put(x + dx, y + dy, mat)
        return self

    def wedge(self, pts, mat):
        """볼록 다각형을 채운다. 날개막이나 망토처럼 각진 것에 씁니다."""
        ys = [p[1] for p in pts]
        for y in range(min(ys), max(ys) + 1):
            xs = []
            for i in range(len(pts)):
                (ax, ay), (bx, by) = pts[i], pts[(i + 1) % len(pts)]
                if (ay <= y < by) or (by <= y < ay):
                    xs.append(ax + (bx - ax) * (y - ay) / (by - ay))
            if len(xs) >= 2:
                for x in range(round(min(xs)), round(max(xs)) + 1):
                    self._put(x, y, mat)
        return self

    def erase(self, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < self.n and 0 <= y < self.n:
                    self.px[y][x] = None
        return self

    def dot(self, x, y, ch):
        """명암을 안 받는 한 점. 눈처럼 자리가 곧 뜻인 것."""
        self._put(x, y, ('=', ch))
        return self

    def mirror(self):
        """왼쪽 절반을 오른쪽에 뒤집어 붙인다. 좌우가 어긋날 수 없다."""
        h = self.n // 2
        for y in range(self.n):
            for x in range(h):
                self.px[y][self.n - 1 - x] = self.px[y][x]
        return self

    # ── 굽기 ────────────────────────────────────────────────
    def render(self, **mats):
        """재질 이름을 계단에 붙이고 외곽선·명암을 넣어 문자열로 만든다."""
        n = self.n
        px = self.px

        def mat(x, y):
            if not (0 <= x < n and 0 <= y < n):
                return None
            v = px[y][x]
            return None if v is None or isinstance(v, tuple) else v

        def solid(x, y):
            return 0 <= x < n and 0 <= y < n and px[y][x] is not None

        out = []
        for y in range(n):
            line = ''
            for x in range(n):
                v = px[y][x]
                if v is None:
                    line += '.'
                    continue
                if isinstance(v, tuple):            # dot() — 그대로 찍는다
                    line += v[1]
                    continue
                spec = mats.get(v, v)
                fixed = None
                if isinstance(spec, tuple):
                    spec, fixed = spec
                ramp = RAMPS[spec]
                if fixed is not None:        # 이음매·끈처럼 단계를 못 박는 것
                    line += ramp[fixed]
                    continue
                # 실루엣 가장자리는 제일 어두운 단계. 다리나 이음매처럼
                # 얇아서 외곽선을 먹으면 안 되는 것은 단계를 못 박아
                # (재질, 단계) 로 넘기면 여기까지 오지 않는다.
                near = sum(solid(x + dx, y + dy)
                           for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)))
                if near < 4:
                    line += ramp[0]
                    continue
                # 위에서 빛이 온다 — 같은 재질의 윗면부터 밝게. 절대
                # 깊이로 재면 큰 덩어리가 통째로 어두워지므로, 그 칸이
                # 속한 세로 줄의 **길이에 비례**해 셋으로 나눈다.
                depth = 0
                while mat(x, y - depth - 1) == v:
                    depth += 1
                below = 0
                while mat(x, y + below + 1) == v:
                    below += 1
                total = depth + below + 1
                t = depth / total
                line += ramp[3] if t < 0.28 else ramp[2] if t < 0.72 else ramp[1]
            out.append(line)
        return out


def flip(rows):
    """좌우를 뒤집은 사본. 옆모습을 반대쪽으로 쓸 때."""
    return [r[::-1] for r in rows]
