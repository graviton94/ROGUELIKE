/* 주인공 한 벌을 통째로 뽑는다 — 맨몸 하나와 직업장비 여섯, 각 세 방향.
   node tools/hero.mjs [out.py]

   맨몸과 장비는 **같은 자**로 재서 따로 뽑습니다. 그래야 그리는 쪽에서
   방향마다 층 순서를 바꿀 수 있습니다. 장비는 색을 박지 않고 C/D/X 로
   떨어뜨려 굽는 시점에 직업 색이 들어갑니다 — 한 벌을 그리면 여섯
   직업이 다 나옵니다.

   결과는 tools/draw.py 가 먹는 작업 파일이므로,
     node tools/hero.mjs /tmp/job.py && python3 tools/draw.py /tmp/job.py
   두 줄이면 src/pixels.js 에 들어갑니다. */
import fs from 'node:fs';
import { draft, toGrid, stampFace, denoise } from './trace.mjs';

const G = (fam, ...layers) => ({ fam, layers });
const BODY = 'body/bodies/male/light.png';
const HAIR = 'hair/plain/male/dark_brown.png';

/* 맨몸 — 속옷과 신까지. 장비가 덮지 못한 자리에서 이게 보입니다. */
const RACE = [
  G('skin', BODY),
  G('linen', 'torso/clothes/longsleeve/longsleeve/male/white.png'),
  G('stone', 'legs/pantaloons/male/slate.png'),
  G('wood', 'feet/boots/male/brown.png'),
  G('hair', HAIR),
];

/* 직업장비 — 몸은 빼고 걸치는 것만. 전부 tint 로 떨어집니다.
   투구·모자·두건은 그 직업의 정체성이라 하나씩 다르게 씌웁니다. */
const KIT = {
  warrior: [G('tint',
    'torso/armour/plate/male/steel.png', 'arms/armour/plate/male/steel.png',
    'shoulders/plate/male/steel.png', 'legs/armour/plate/male/steel.png',
    'hat/helmet/bascinet/adult/steel.png')],
  mage: [G('tint',
    'torso/clothes/longsleeve/longsleeve/male/blue.png',
    'cape/solid/male/navy.png',
    'hat/magic/wizard/base/adult/base_teal.png')],
  priest: [G('tint',
    'torso/clothes/longsleeve/longsleeve/male/white.png',
    'hat/cloth/hood/adult/white.png')],
  rogue: [G('tint',
    'torso/armour/leather/male/black.png',
    'arms/bracers/male/iron.png',
    'hat/cloth/hood/adult/black.png')],
  ranger: [G('tint',
    'torso/armour/leather/male/brown.png',
    'shoulders/leather/male/brown.png',
    'hat/cloth/feather_cap/adult/forest.png')],
  paladin: [G('tint',
    'torso/armour/plate/male/gold.png', 'arms/armour/plate/male/gold.png',
    'shoulders/plate/male/gold.png', 'legs/armour/plate/male/gold.png',
    'hat/helmet/sugarloaf_simple/male/gold.png')],
};

const OPT = { split: 0.40, headH: 8, bodyH: 8 };
const VIEWS = [['down', 'down'], ['side', 'right'], ['up', 'up']];

const py = [
  '# -*- coding: utf-8 -*-',
  '# tools/hero.mjs 가 뽑은 밑그림. 손질은 이 파일이 아니라',
  '# src/pixels.js 에서 합니다 — 여기는 다시 뽑으면 덮어씁니다.',
  '',
  'GRIDS = {',
];
const emit = (name, views) => {
  py.push(`  '${name}': {`);
  for (const [v, g] of Object.entries(views)) {
    py.push(`    '${v}': [`);
    for (const line of g) py.push(`      raw('${line}'),`);
    py.push('    ],');
  }
  py.push('  },');
};

const body = {};
for (const [v, dir] of VIEWS) {
  const grid = denoise(toGrid(draft(RACE, dir, OPT).cells));
  body[v] = stampFace(grid, v === 'side' ? 'side' : v, { hair: 5 });
}
emit('human', body);

for (const [cls, groups] of Object.entries(KIT)) {
  const views = {};
  for (const [v, dir] of VIEWS) {
    // 몸을 frame 으로 줘서 같은 자로 재고, 그림은 장비만 그린다.
    views[v] = denoise(toGrid(draft(groups, dir, { ...OPT, frame: RACE }).cells));
  }
  emit(cls, views);
}
py.push('}', '');

const out = process.argv[2] || '/tmp/hero-job.py';
fs.writeFileSync(out, py.join('\n'));
console.log(`${out}  —  맨몸 1 + 직업 ${Object.keys(KIT).length}, 각 3방향`);
