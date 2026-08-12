# 레퍼런스 비율에 맞춘다: 모자 3줄 · 얼굴 3줄 · 몸 4줄 · 다리 2줄.
# 팔은 몸통과 검은 선 하나로 갈라 놓아야 팔로 읽힌다.
GRIDS = {}

GRIDS['human.down'] = [sym(l) for l in [
    '........',
    '........',
    '....kkkk',   # 2  머리 위
    '...knnnn',   # 3  머리카락
    '...knnnn',   # 4
    '...khhhh',   # 5  이마
    '...khkkh',   # 6  눈 2px
    '...khhhh',   # 7
    '...kkhhh',   # 8  턱
    '....kCCC',   # 9  어깨
    '.kCCkCCC',   # 10 팔 — 검은 선으로 몸통과 분리
    '.khhkCCC',   # 11 손
    '..kkkCCC',   # 12
    '....kDDD',   # 13 벨트
    '....nnn.',   # 14 다리
    '....nnn.',   # 15
]]

GRIDS['human.up'] = [sym(l) for l in [
    '........',
    '........',
    '....kkkk',
    '...knnnn',
    '...knnnn',
    '...knnnn',
    '...knnnn',
    '...knnnn',
    '...kknnn',
    '....kCCC',
    '.kCCkCCC',
    '.khhkCCC',
    '..kkkCCC',
    '....kDDD',
    '....nnn.',
    '....nnn.',
]]

GRIDS['human.side'] = [raw(l) for l in [
    '................',
    '................',
    '....kkkkkkkk....',
    '...knnnnnnnnk...',
    '...knnnnnnnnk...',
    '...knnnhhhhhk...',
    '...knnhhkkhhk...',
    '...knhhhhhhhk...',
    '...kknhhhhhkk...',
    '....kCCCCCCk....',
    '...kCCCCCCCCk...',
    '...kCCCCCChhk...',
    '...kkCCCCCkkk...',
    '....kDDDDDDk....',
    '.....nnnnn......',
    '.....nnnnn......',
]]

GRIDS['warrior.down'] = [sym(l) for l in [
    '........',
    '........',
    '....kkkk',   # 2  투구
    '...kSSSS',   # 3
    '...kSSSS',   # 4
    '...kkkkk',   # 5  챙 — 얼굴 바로 위에서 끊는다
    '........',   # 6  눈은 종족 것
    '........',
    '........',
    '..kkSSSS',   # 9  어깨판
    '.kSSkSSS',   # 10 견갑
    '........',   # 11 손은 종족 것
    '........',
    '....kSSS',   # 13 허리띠
    '........',
    '........',
]]
GRIDS['warrior.up'] = GRIDS['warrior.down']
GRIDS['warrior.side'] = [raw(l) for l in [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kSSSSSSSSk...',
    '...kSSSSSSSSk...',
    '...kkkkkkkkkk...',
    '................',
    '................',
    '................',
    '..kkSSSSSSSSk...',
    '..kSSSSSSSSSSk..',
    '................',
    '................',
    '....kSSSSSSk....',
    '................',
    '................',
]]

# 쥐 — 눈을 넣고 귀를 정리
GRIDS['rat'] = [raw(l) for l in [
    '................',
    '................',
    '.........kkk....',
    '........kNNNk...',
    '........kNNNk...',
    '....kkkkkNNNk...',
    '..kkNNNNNNNNk...',
    '.kNNNNNNNkkNk...',
    'kNNNNNNNNkkNNk..',
    'kNNNNNNNNNNNNk..',
    'kNNNNNNNNNNNkk..',
    '.kNNNNNNNNNNk...',
    '.kkNNkkNNkkNk...',
    '..kNNk.kNNk.k...',
    '..kkkk.kkkk.....',
    '................',
]]
