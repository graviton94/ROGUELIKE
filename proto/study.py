#!/usr/bin/env python3
"""study.py — 0x72 DungeonTileset II (CC0)에서 '원리'를 뽑아낸다.

에셋 자체를 쓰지 않는다. 배우는 것은 규칙이다:
  · 팔레트가 몇 색인가, 어떤 색인가
  · 한 물체를 몇 단계 명암으로 칠하는가
  · 외곽선을 두르는가, 두른다면 무슨 색인가
  · 명암이 어느 방향으로 흐르는가 (광원 위치)
  · 채도와 명도가 어느 대역에 몰려 있는가

PIL이 없으므로 PNG를 직접 푼다 (zlib + 언필터).
"""
import zlib, struct, sys, colorsys
from collections import Counter

def load(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, pal = 8, b'', None
    w = h = bd = ct = None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos+4])[0]
        typ = d[pos+4:pos+8]; body = d[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', body[:10])
        elif typ == b'PLTE': pal = body
        elif typ == b'IDAT': idat += body
        elif typ == b'IEND': break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1, 2:3, 3:1, 4:2, 6:4}[ct]
    assert bd == 8, f'bit depth {bd} unsupported'
    stride = w*ch
    out = bytearray(h*stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(ch, stride): line[i] = (line[i] + line[i-ch]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                b = prev[i]; c = prev[i-ch] if i >= ch else 0
                pp = a + b - c
                pa, pb, pc = abs(pp-a), abs(pp-b), abs(pp-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y*stride:(y+1)*stride] = line
        prev = line
    return w, h, ch, bytes(out), pal

def px(buf, w, ch, x, y):
    i = (y*w + x)*ch
    if ch == 4: return buf[i], buf[i+1], buf[i+2], buf[i+3]
    if ch == 3: return buf[i], buf[i+1], buf[i+2], 255
    raise SystemExit('unexpected channels')

w, h, ch, buf, _ = load(sys.argv[1] if len(sys.argv) > 1 else 'assets/0x72_dungeon.png')
print(f'시트 {w}×{h}, 채널 {ch}\n')

# ── 1. 팔레트 ─────────────────────────────────────────────
cnt = Counter()
for y in range(h):
    for x in range(w):
        r, g, b, a = px(buf, w, ch, x, y)
        if a < 128: continue
        cnt[(r, g, b)] += 1
tot = sum(cnt.values())
print(f'불투명 픽셀 {tot} · 고유 색 {len(cnt)}개')
print('\n가장 많이 쓰인 색 20 (비중 · HSV):')
for (r, g, b), n in cnt.most_common(20):
    hs, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
    print(f'  #{r:02x}{g:02x}{b:02x}  {n*100/tot:5.2f}%   H{hs*360:5.0f}  S{s*100:3.0f}  V{v*100:3.0f}')

# ── 2. 명도 분포 — 어느 대역을 쓰는가 ────────────────────
bins = [0]*10
for (r, g, b), n in cnt.items():
    v = max(r, g, b)/255
    bins[min(9, int(v*10))] += n
print('\n명도 분포 (V, 10구간):')
for i, n in enumerate(bins):
    pct = n*100/tot
    print(f'  V {i*10:3d}–{i*10+10:3d}  {pct:5.1f}%  ' + '█'*int(pct/2))

# ── 3. 채도 분포 ────────────────────────────────────────
sb = [0]*10
for (r, g, b), n in cnt.items():
    _, s, _ = colorsys.rgb_to_hsv(r/255, g/255, b/255)
    sb[min(9, int(s*10))] += n
print('\n채도 분포 (S, 10구간):')
for i, n in enumerate(sb):
    pct = n*100/tot
    print(f'  S {i*10:3d}–{i*10+10:3d}  {pct:5.1f}%  ' + '█'*int(pct/2))

# ── 4. 외곽선 — 투명에 맞닿은 픽셀은 얼마나 어두운가 ──────
edge = Counter(); inner = Counter()
for y in range(h):
    for x in range(w):
        r, g, b, a = px(buf, w, ch, x, y)
        if a < 128: continue
        touch = False
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x+dx, y+dy
            if not (0 <= nx < w and 0 <= ny < h) or px(buf, w, ch, nx, ny)[3] < 128:
                touch = True; break
        v = max(r, g, b)
        (edge if touch else inner)[v//16] += 1
ev = sum(k*16*n for k, n in edge.items())/max(1, sum(edge.values()))
iv = sum(k*16*n for k, n in inner.items())/max(1, sum(inner.values()))
print(f'\n외곽(투명에 닿은 픽셀) 평균 명도 {ev:.0f} / 내부 평균 {iv:.0f}'
      f'  → 외곽이 내부보다 {iv-ev:.0f} 어둡다')
dark = sum(n for k, n in edge.items() if k*16 < 64)
print(f'   외곽 픽셀 중 V<64(짙은 선) 비율 {dark*100/max(1,sum(edge.values())):.0f}%')

# ── 5. 한 스프라이트 안에서 몇 단계 명암을 쓰는가 ──────────
tiles = []
for ty in range(0, h-15, 16):
    for tx in range(0, w-15, 16):
        c = Counter()
        for y in range(ty, ty+16):
            for x in range(tx, tx+16):
                r, g, b, a = px(buf, w, ch, x, y)
                if a >= 128: c[(r, g, b)] += 1
        if sum(c.values()) > 60: tiles.append(len(c))
tiles.sort()
if tiles:
    print(f'\n16×16 칸 {len(tiles)}개 (내용이 있는 것)')
    print(f'   한 칸이 쓰는 색 수: 최저 {tiles[0]} · 중앙값 {tiles[len(tiles)//2]} · 최고 {tiles[-1]}')

# ── 6. 광원 방향 — 위쪽 절반과 아래쪽 절반의 밝기 차 ───────
top = bot = tn = bn = 0
for ty in range(0, h-15, 16):
    for tx in range(0, w-15, 16):
        for y in range(ty, ty+16):
            for x in range(tx, tx+16):
                r, g, b, a = px(buf, w, ch, x, y)
                if a < 128: continue
                v = max(r, g, b)
                if y-ty < 8: top += v; tn += 1
                else:        bot += v; bn += 1
print(f'\n칸 위쪽 절반 평균 명도 {top/max(1,tn):.0f} · 아래쪽 절반 {bot/max(1,bn):.0f}'
      f'  → 광원은 {"위" if top/max(1,tn) > bot/max(1,bn) else "아래"}에 있다')
