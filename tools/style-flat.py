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
# 기준: 톤 2~3개 · 검은 외곽선 · 무기를 든다 · 얼굴에 표정이 있다.
# 납작(1톤)과 과한 램프(4톤) 사이. 하이라이트는 덩어리로만 놓는다.
GRIDS = {}

# 오크 — 초록 3톤, 가죽 흉갑, 오른손에 검
GRIDS['orc'] = [raw(l) for l in [
    '................',
    '.....kkkkkk.....',
    '....keeeeeek....',
    '...keEEEEEEek...',
    '...kEEFFFFEEk.k.',
    '...kEkFFFFkEkkSk',
    '...kEEFFFFEEkSSk',
    '...kEEwwwwEEkSSk',
    '...kkEEEEEEkkSk.',
    '..kNNNNNNNNNNkk.',
    '..kNMMMMMMMMNk..',
    '..kNMMMMMMMMNk..',
    '..kNNNNNNNNNNk..',
    '...kkEEEEEEkk...',
    '....kEEk.kEEk...',
    '....kkk...kkk...',
]]

# 코볼드 — 뿔 둘, 붉은 눈, 드러난 이빨, 왼손에 단검
GRIDS['kobold'] = [raw(l) for l in [
    '................',
    '..kk........kk..',
    '..kNk......kNk..',
    '..kNNk....kNNk..',
    '..kNNNkkkkNNNk..',
    '.kNNMMMMMMMMNNk.',
    '.kNRkMMMMMMkRNk.',
    '.kNNMMMMMMMMNNk.',
    '.kNNwwwwwwwwNNk.',
    '..kkNNNNNNNNkk..',
    '.kNNNNNNNNNNNNk.',
    'kSkNMMMMMMMMNk..',
    'kSkNMMMMMMMMNk..',
    '.kkNNNNNNNNNNk..',
    '..kNNk....kNNk..',
    '..kkkk....kkkk..',
]]
