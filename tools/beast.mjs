/* 도감의 인간형을 통째로 뽑는다 — 열다섯 종, 각 세 방향.
   node tools/beast.mjs [out.py]

   주인공과 같은 자를 씁니다. 다른 것은 셋뿐입니다.

     · 직업 색이 없으므로 재질을 그 자리에서 못 박습니다
     · 덩치는 **사람을 공통 자로** 삼아서 냅니다 — 같은 자 안에서
       근육질 몸은 넓게, 아이 몸은 작게 들어앉습니다
     · 오우거·거인처럼 큰 것은 자를 한 칸 넓혀 16칸을 꽉 채웁니다

   네발짐승과 무정형(쥐·박쥐·뱀·거미·곰팡이·젤리·개·용·잿더미…)은
   여기서 안 나옵니다. 참고본에 사람 골격밖에 없기 때문이고, 그것들은
   손으로 그립니다. */
import fs from 'node:fs';
import { draft, toGrid, stampFace, denoise, settle, RAMPS } from './trace.mjs';

const G = (fam, ...layers) => ({ fam, layers });

/* 자 — 사람 한 사람. 모든 몬스터를 이 자로 재야 덩치가 비교됩니다. */
const FRAME = [
  G('skin', 'body/bodies/male/light.png'),
  G('linen', 'torso/clothes/longsleeve/longsleeve/male/white.png'),
  G('stone', 'legs/pantaloons/male/slate.png'),
  G('wood', 'feet/boots/male/brown.png'),
];

const MALE = 'body/bodies/male/light.png';
const MUSC = c => `body/bodies/muscular/${c}.png`;
const CHILD = c => `body/bodies/child/${c}.png`;

/* skin · mane 은 얼굴을 찍을 때 쓰는 계단입니다. 오크 얼굴에 사람
   살빛을 박으면 안 되므로 종마다 따로 일러 줍니다.               */
const BEASTS = {
  kobold: {
    skin: 'green', mane: 'wood', opt: { headH: 7, bodyH: 7 },
    g: [G('green', CHILD('bright_green'), 'head/heads/goblin/child/bright_green.png'),
      G('wood', 'legs/pantaloons/male/brown.png')],
  },
  orc: {
    skin: 'green', mane: 'wood',
    g: [G('green', MUSC('green'), 'head/heads/orc/male/green.png'),
      G('wood', 'torso/armour/leather/male/brown.png', 'legs/pantaloons/male/brown.png'),
      G('steel', 'shoulders/plate/male/iron.png')],
  },
  ogre: {
    skin: 'wood', mane: 'wood', opt: { bodyW: 14, bodyH: 9, headH: 8 },
    g: [G('wood', MUSC('bronze'), 'head/heads/troll/adult/bronze.png'),
      G('linen', 'legs/pantaloons/male/tan.png')],
  },
  troll: {
    skin: 'green', mane: 'green', opt: { bodyW: 14, bodyH: 9 },
    g: [G('green', MUSC('dark_green'), 'head/heads/troll/adult/dark_green.png'),
      G('wood', 'legs/pantaloons/male/brown.png')],
  },
  giant: {
    skin: 'skin', mane: 'wood', opt: { bodyW: 15, bodyH: 9, headH: 7 },
    g: [G('skin', MUSC('bronze')),
      G('wood', 'hair/messy1/male/chestnut.png',
        'legs/pantaloons/male/brown.png'),
      G('bone', 'shoulders/legion/male/bronze.png')],
  },
  mummy: {
    skin: 'bone', mane: 'bone',
    g: [G('bone', 'body/bodies/zombie/universal/bronze.png',
      'head/heads/zombie/adult/bronze.png',
      'torso/clothes/longsleeve/longsleeve/male/white.png',
      'legs/pantaloons/male/white.png')],
  },
  wraith: {
    skin: 'violet', mane: 'violet', opt: { bodyH: 9 },
    g: [G('violet', 'cape/solid/male/lavender.png', 'hat/cloth/hood/adult/purple.png',
      'torso/clothes/longsleeve/longsleeve/male/purple.png')],
  },
  vampire: {
    skin: 'bone', mane: 'red',
    g: [G('bone', MALE, 'head/heads/vampire/adult/light.png'),
      G('red', 'cape/solid/male/maroon.png'),
      G('steel', 'torso/clothes/longsleeve/formal/male/white.png',
        'legs/pantaloons/male/charcoal.png')],
  },
  lich: {
    skin: 'bone', mane: 'teal',
    g: [G('bone', 'body/bodies/skeleton/universal/light.png',
      'head/heads/skeleton/adult/skeleton.png'),
      G('teal', 'cape/solid/male/green.png', 'hat/cloth/hood/adult/teal.png',
        'torso/clothes/longsleeve/longsleeve/male/teal.png')],
  },
  ashhoundless: null,                       // 네발짐승 — 손으로 그립니다
  warden: {
    skin: 'steel', mane: 'steel', opt: { bodyW: 14, bodyH: 9 },
    g: [G('steel', MUSC('bronze'), 'torso/armour/plate/male/iron.png',
      'arms/armour/plate/male/iron.png', 'shoulders/plate/male/iron.png',
      'legs/armour/plate/male/iron.png'),
      G('gold', 'hat/helmet/greathelm/male/brass.png')],
  },
  ashen: {
    skin: 'stone', mane: 'stone',
    g: [G('stone', 'body/bodies/zombie/universal/fur_grey.png',
      'head/heads/zombie/adult/fur_grey.png',
      'legs/pantaloons/male/gray.png'),
      G('bone', 'torso/clothes/longsleeve/longsleeve/male/gray.png')],
  },
  thief: {
    skin: 'skin', mane: 'wood', opt: { bodyH: 8, headH: 7 },
    g: [G('skin', MALE),
      G('wood', 'torso/armour/leather/male/charcoal.png',
        'hat/cloth/hood/adult/charcoal.png', 'legs/pantaloons/male/charcoal.png'),
      G('gold', 'arms/bracers/male/brass.png')],
  },
  emberpriest: {
    skin: 'skin', mane: 'red',
    g: [G('skin', MALE),
      G('red', 'torso/clothes/longsleeve/longsleeve/male/maroon.png',
        'hat/cloth/hood/adult/maroon.png', 'legs/pantaloons/male/maroon.png'),
      G('gold', 'shoulders/legion/male/brass.png')],
  },
  balemperor: {
    skin: 'red', mane: 'gold', opt: { bodyW: 14, bodyH: 9 },
    g: [G('red', MUSC('dark_green')),
      G('gold', 'torso/armour/plate/male/gold.png', 'arms/armour/plate/male/gold.png',
        'shoulders/plate/male/gold.png', 'legs/armour/plate/male/gold.png',
        'hat/formal/crown/adult/gold.png'),
      G('red', 'cape/solid/male/maroon.png')],
  },
  keeper: {
    skin: 'skin', mane: 'wood',
    g: [G('skin', MALE),
      G('wood', 'hair/plain/male/chestnut.png', 'legs/pantaloons/male/brown.png',
        'feet/boots/male/brown.png'),
      G('tint', 'torso/clothes/longsleeve/longsleeve/male/tan.png')],   // 가게마다 앞치마 색이 다르다
  },
};

const BASE = { split: 0.40, headH: 8, bodyH: 8 };
const VIEWS = [['down', 'down'], ['side', 'right'], ['up', 'up']];

const py = [
  '# -*- coding: utf-8 -*-',
  '# tools/beast.mjs 가 뽑은 밑그림. 인간형만입니다.',
  '',
  'GRIDS = {',
];
for (const [name, spec] of Object.entries(BEASTS)) {
  if (!spec) continue;
  /* 몬스터는 **제 몸으로** 잽니다. 사람 자에 맞추면 아이 골격은 머리가
     네 칸으로 쪼그라들고 목이 끊깁니다. 덩치 차이는 칸 수(bodyW·bodyH)로
     냅니다 — 오우거는 넓고, 코볼드는 낮습니다.                 */
  const opt = { ...BASE, ...(spec.opt || {}) };
  py.push(`  '${name}': {`);
  for (const [v, dir] of VIEWS) {
    const grid = denoise(toGrid(draft(spec.g, dir, opt).cells));
    const done = stampFace(grid, v === 'side' ? 'side' : v, {
      hair: 5, headH: opt.headH,
      skin: RAMPS[spec.skin], mane: RAMPS[spec.mane],
    });
    py.push(`    '${v}': [`);
    for (const line of settle(done)) py.push(`      raw('${line}'),`);
    py.push('    ],');
  }
  py.push('  },');
}
py.push('}', '');

const out = process.argv[2] || '/tmp/beast-job.py';
fs.writeFileSync(out, py.join('\n'));
console.log(`${out}  —  인간형 ${Object.values(BEASTS).filter(Boolean).length}종 × 3방향`);
