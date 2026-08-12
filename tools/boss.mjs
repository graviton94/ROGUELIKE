/* 큰 것들을 32×32 로 뽑는다.
   node tools/boss.mjs

   타일은 16 그대로입니다. 큰 것만 32 판에 그리고, 그리는 쪽이 발밑을
   타일 바닥에 맞춰 세웁니다(actorBox). 지도 밀도도 길찾기도 그대로고,
   달라지는 것은 마주쳤을 때의 크기뿐입니다.

   두 갈래를 뽑습니다.

     · 용과 비룡  — SPRITES 안으로. 16칸에 넣으면 새로 읽힙니다.
     · 보스 넷    — BOSSES 안으로. 같은 종이라도 이름이 붙은 것은
                    더 크고 더 꾸며져야 합니다.

   용 비늘 색은 참고본에서 오지 않습니다. 재질은 우리가 정하므로
   참고본은 명암 구조만 주면 되고, 실제 색은 RAMPS 가 정합니다 —
   그래서 붉은 용도 초록 도마뱀 그림에서 뽑을 수 있습니다.        */
import fs from 'node:fs';
import { draft, toGrid, stampFace, denoise, despeckle, settle, RAMPS } from './trace.mjs';

const G = (fam, ...layers) => ({ fam, layers });
const MUSC = c => `body/bodies/muscular/${c}.png`;
const MALE = 'body/bodies/male/light.png';

/* 32칸이면 머리를 16까지 키울 수 있습니다. 16칸에서는 눈 둘을 넣으면
   끝이던 자리에 콧구멍과 이빨이 들어갑니다. */
const BIG = { split: 0.40, headW: 16, headH: 15, bodyW: 24, bodyH: 17, N: 32 };

const DRAKE = c => [
  G('scale', MUSC(c), `head/heads/lizard/male/${c}.png`),
  /* 날개는 앞뒤 두 장으로 나뉘어 있다. 앞모습에서는 뒤쪽 장만 보이므로
     둘 다 얹어야 어느 방향에서도 날개가 실루엣에 남는다. */
  G('membrane', `body/wings/lizard/adult/bg/${c}.png`,
    `body/wings/lizard/adult/fg/${c}.png`),
  G('scale', `body/tail/lizard/adult/fg/${c}.png`),
  G('horn', 'head/horns/curled/adult/metallic_gold.png'),
];

/* SPRITES 로 들어갈 것 — 평범하게 만나는 큰 짐승 */
const BEASTS = {
  dragon: { scale: 'red', membrane: 'ember', horn: 'bone', g: DRAKE('bright_green') },
  wyrm:   { scale: 'blue', membrane: 'teal', horn: 'bone', g: DRAKE('blue') },
};

/* BOSSES 로 들어갈 것 — 이름이 붙은 넷 */
const NAMED = {
  ogre: {                                   // 뼈를 씹는 자
    skin: 'wood', mane: 'wood',
    g: [G('skin', MUSC('bronze'), 'head/heads/troll/adult/bronze.png'),
      G('mane', 'hair/messy1/male/chestnut.png'),
      G('bone', 'shoulders/legion/male/bronze.png'),
      G('hide', 'legs/pantaloons/male/tan.png')],
    fam: { skin: 'wood', mane: 'wood', bone: 'bone', hide: 'linen' },
  },
  wraith: {                                 // 재 속의 사제
    skin: 'violet', mane: 'violet',
    g: [G('robe', 'cape/solid/male/lavender.png',
      'torso/clothes/longsleeve/longsleeve/male/purple.png'),
      G('hood', 'hat/cloth/hood/adult/purple.png'),
      G('ash', 'shoulders/legion/male/silver.png')],
    fam: { robe: 'violet', hood: 'violet', ash: 'bone' },
  },
  wyrm: {                                   // 화로를 감은 것
    skin: 'teal', mane: 'teal',
    g: [G('scale', MUSC('blue'), 'head/heads/lizard/male/blue.png'),
      G('membrane', 'body/wings/lizard/adult/bg/blue.png',
        'body/wings/lizard/adult/fg/blue.png'),
      G('scale', 'body/tail/lizard/adult/fg/blue.png'),
      G('horn', 'head/horns/backwards/adult/metallic_gold.png')],
    fam: { scale: 'teal', membrane: 'blue', horn: 'gold' },
  },
  balemperor: {                             // 잿불의 대군주
    skin: 'red', mane: 'gold',
    g: [G('skin', MUSC('dark_green')),
      G('plate', 'torso/armour/plate/male/gold.png', 'arms/armour/plate/male/gold.png',
        'shoulders/plate/male/gold.png', 'legs/armour/plate/male/gold.png'),
      G('crown', 'hat/formal/crown/adult/gold.png'),
      G('cloak', 'cape/solid/male/maroon.png')],
    fam: { skin: 'red', plate: 'gold', crown: 'gold', cloak: 'red' },
  },
};

const VIEWS = [['down', 'down'], ['side', 'right'], ['up', 'up']];

/* 재질 이름을 우리 계단 이름으로 옮긴다. 'scale' 이나 'membrane' 은
   RAMPS 에 없으므로 종마다 어느 계단을 쓸지 여기서 정합니다. */
function build(spec) {
  const map = spec.fam || spec;
  const groups = spec.g.map(g => ({ ...g, fam: map[g.fam] || g.fam }));
  const out = {};
  for (const [v, dir] of VIEWS) {
    const grid = denoise(toGrid(draft(groups, dir, BIG).cells));
    out[v] = despeckle(settle(stampFace(grid, v === 'side' ? 'side' : v, {
      hair: 9, headH: BIG.headH,
      skin: RAMPS[spec.skin] || RAMPS[map[spec.g[0].fam]] || RAMPS.skin,
      mane: RAMPS[spec.mane] || RAMPS.hair,
    })));
  }
  return out;
}

// ── 용·비룡은 draw.py 를 태워 SPRITES 로 ────────────────────
const py = [
  '# -*- coding: utf-8 -*-',
  '# tools/boss.mjs 가 뽑은 32×32 큰 짐승.',
  '',
  'GRIDS = {',
];
for (const [name, spec] of Object.entries(BEASTS)) {
  const views = build(spec);
  py.push(`  '${name}': {`);
  for (const [v, g] of Object.entries(views)) {
    py.push(`    '${v}': [`);
    for (const line of g) py.push(`      raw('${line}'),`);
    py.push('    ],');
  }
  py.push('  },');
}
py.push('}', '');
fs.writeFileSync('/tmp/drake-job.py', py.join('\n'));

// ── 보스는 BOSSES 블록을 통째로 다시 쓴다 ──────────────────
const lines = ['export const BOSSES = {'];
for (const [name, spec] of Object.entries(NAMED)) {
  const views = build(spec);
  lines.push(`  ${name}: {`);
  for (const [v, g] of Object.entries(views)) {
    lines.push(`    ${v}: [`);
    for (const line of g) lines.push(`      '${line}',`);
    lines.push('    ],');
  }
  lines.push('  },');
}
lines.push('};');

const PIX = new URL('../src/pixels.js', import.meta.url).pathname;
const src = fs.readFileSync(PIX, 'utf8');
const re = /export const BOSSES = \{[\s\S]*?\n?\};/;
if (!re.test(src)) throw new Error('BOSSES 블록을 찾지 못했습니다');
fs.writeFileSync(PIX, src.replace(re, lines.join('\n')));

console.log(`/tmp/drake-job.py — 용·비룡 32×32 · BOSSES ${Object.keys(NAMED).length}종 반영`);
