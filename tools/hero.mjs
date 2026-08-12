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
import { draft, toGrid, stampFace, denoise, RAMPS } from './trace.mjs';

const G = (fam, ...layers) => ({ fam, layers });
const BODY = 'body/bodies/male/light.png';
const HAIR = 'hair/plain/male/dark_brown.png';

/* 맨몸 — 속옷과 신까지. 장비가 덮지 못한 자리에서 이게 보입니다.
   여덟 종족이 같은 옷을 입습니다. 달라지는 것은 살빛·덩치·귀·수염뿐이고,
   그래야 장비 한 벌이 여덟 종족에 다 맞습니다.               */
const WEAR = [
  G('linen', 'torso/clothes/longsleeve/longsleeve/male/white.png'),
  G('stone', 'legs/pantaloons/male/slate.png'),
  G('wood', 'feet/boots/male/brown.png'),
];
const person = (skin, hair, ...extra) => [
  { fam: skin[0], layers: skin.slice(1) }, ...WEAR,
  { fam: hair[0], layers: hair.slice(1) }, ...extra,
];

/* 종족이 달라 보이는 것은 세 가지입니다 — 살빛, 머리빛, 그리고 덩치.
   앞의 둘은 재질 계단을 갈아 끼워 냅니다. 덩치는 **사람 몸을 공통
   자로** 삼아서 냅니다: 같은 자 안에서 아이 몸은 작게, 근육질 몸은
   넓게 들어앉으므로 키와 어깨가 저절로 달라집니다. 종족마다 제 몸으로
   자를 다시 재면 전부 같은 키가 되어 버립니다.               */
const RACES = {
  human:    person(['skin', 'body/bodies/male/light.png'], ['hair', HAIR]),
  halfElf:  person(['skin', 'body/bodies/male/light.png', 'head/ears/medium/adult/light.png'],
    ['wood', HAIR]),
  elf:      person(['skin', 'body/bodies/teen/light.png', 'head/ears/elven/adult/light.png'],
    ['gold', 'hair/plain/male/blonde.png']),
  halfling: person(['skin', 'body/bodies/child/bronze.png'],
    ['wood', 'hair/plain/male/chestnut.png']),
  gnome:    person(['skin', 'body/bodies/child/light.png'],
    ['bone', 'hair/plain/male/white.png'],
    G('bone', 'beards/beard/basic/white.png')),
  dwarf:    person(['skin', 'body/bodies/muscular/bronze.png'],
    ['red', 'hair/plain/male/redhead.png'],
    G('red', 'beards/beard/basic/redhead.png')),
  halfOrc:  person(['green', 'body/bodies/muscular/green.png', 'head/heads/orc/male/green.png'],
    ['green']),
  halfTroll: person(['teal', 'body/bodies/muscular/dark_green.png',
    'head/heads/troll/adult/dark_green.png'], ['teal']),
};
const RACE = RACES.human;

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
    'hat/magic/wizard/base/adult/base_black.png')],
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
    'hat/helmet/norman/adult/gold.png')],
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

/* ── 눈구멍 ───────────────────────────────────────────────
   투구는 머리를 통째로 덮습니다. 층으로 얹으면 아래 있는 얼굴이
   가려져 금덩어리 한 개가 서 있게 됩니다. 그래서 **몸의 눈이 있는
   자리**를 읽어 그 줄만 뚫습니다 — 그게 실제 투구의 슬릿입니다.
   뒷모습은 뚫지 않습니다. 뒤통수에는 슬릿이 없습니다.        */
function visor(kit, bodyGrid) {
  const row = bodyGrid.findIndex(l => l.includes('k'));
  if (row < 0) return kit;
  const xs = [...bodyGrid[row]].flatMap((ch, x) => ('kW'.includes(ch) ? [x] : []));
  if (!xs.length) return kit;
  const a = Math.min(...xs), b = Math.max(...xs);
  const out = kit.slice();
  const line = [...out[row]];
  for (let x = a; x <= b; x++) line[x] = '.';
  out[row] = line.join('');
  return out;
}

let body = {};                       // 사람 몸 — 눈구멍을 뚫을 때 자로 씁니다
for (const [race, groups] of Object.entries(RACES)) {
  const views = {};
  for (const [v, dir] of VIEWS) {
    const grid = denoise(toGrid(draft(groups, dir, { ...OPT, frame: RACES.human }).cells));
    views[v] = stampFace(grid, v === 'side' ? 'side' : v, {
      hair: 5, skin: RAMPS[groups[0].fam], mane: RAMPS[groups[4].fam],
    });
  }
  if (race === 'human') body = views;
  emit(race, views);
}

for (const [cls, groups] of Object.entries(KIT)) {
  const views = {};
  for (const [v, dir] of VIEWS) {
    // 몸을 frame 으로 줘서 같은 자로 재고, 그림은 장비만 그린다.
    const g = denoise(toGrid(draft(groups, dir, { ...OPT, frame: RACE }).cells));
    views[v] = v === 'up' ? g : visor(g, body[v]);
  }
  emit(cls, views);
}
py.push('}', '');

const out = process.argv[2] || '/tmp/hero-job.py';
fs.writeFileSync(out, py.join('\n'));
console.log(`${out}  —  맨몸 1 + 직업 ${Object.keys(KIT).length}, 각 3방향`);
