/* ═══════════════════════════════════════════════════════════
   juice.js — the layer between "what happened" and "how hard
   it lands". game.js emits typed events into G.fx; nothing in
   here ever changes a rule. Everything is time-based, so a
   player holding a direction down never queues up a backlog
   of animations — the world just keeps up.
   ═══════════════════════════════════════════════════════════ */

import { PALETTE, spriteColors } from './pixels.js';
import { MW as MAP_W } from './world.js';
import { sfx, from as earFrom } from './audio.js';

/* 등급의 색과 이름. data.js의 RARITY를 그대로 쓰지 않는 것은 juice가
   규칙 데이터를 읽지 않기 때문이다 — 여기는 「무슨 일이 있었나」를
   받아서 「얼마나 세게 보여 줄까」만 정하는 층이다. 값은 같게 둔다. */
const RARE_TONE = [PALETTE.G, '#48a8f8', '#f8d020', '#c868f8', '#f8f8f8'];
const RARE_NAME = ['전리품', '마법', '희귀', '유물', '초월'];

/* ── stores ─────────────────────────────────────────────── */
const shards = [];     // pixel chunks knocked off a sprite
const numbers = [];    // floating damage / heal readouts
const rings = [];      // expanding shockwaves
const beams = [];      // spell traces
const slashes = [];    // weapon arcs, shaped by family
const tracked = new WeakMap();   // actor -> interpolation state

let shake = 0;         // remaining shake magnitude, in tiles
let freeze = 0;        // hit-stop, ms
let flashScreen = 0;   // full-screen tint, 0..1
let vignette = 0;      // damage read at the edges, 0..1
let flashHue = 'W';
/* ── 죽는 순간 ──────────────────────────────────────────
   플레이어: 「질때는 슬로우모션으로 주인공 확대되면서 왜 죽는지 좀
   알법하게」. 규칙 쪽이 deathZoom 사건을 던지면 여기서 시간이 늘어지고
   카메라가 그 자리로 조인다. 화면 쪽(ui.js)이 deathLens() 를 읽어
   타일 크기와 중심을 그 값으로 민다 — juice 는 규칙도 그리기도
   모르고, 「얼마나 조였나」만 안다. */
let deathZoom = 0, deathAt = null;
export const deathLens = () =>
  (deathZoom > 0 ? { k: 1 + 1.15 * ease(deathZoom), at: deathAt, dim: 0.55 * ease(deathZoom) } : null);
/* 처음엔 빠르게 조이고 끝에서 멎는다 — 슬로우모션의 형태가 이것이다. */
const ease = t => 1 - Math.pow(1 - Math.min(1, t), 3);

const MAX_SHARDS = 260;

/* Actors are plain objects that survive between turns, so a
   WeakMap keyed on identity gives us per-entity animation
   without game.js ever knowing this file exists. */
export function track(actor) {
  let s = tracked.get(actor);
  if (!s) {
    s = { x: actor.x, y: actor.y, ox: 0, oy: 0, lx: 0, ly: 0, flash: 0, squash: 0 };
    tracked.set(actor, s);
    return s;
  }
  if (s.x !== actor.x || s.y !== actor.y) {
    // Remember where it was and slide in from there.
    s.ox += s.x - actor.x;
    s.oy += s.y - actor.y;
    s.x = actor.x; s.y = actor.y;
    if (Math.abs(s.ox) > 2.5 || Math.abs(s.oy) > 2.5) { s.ox = 0; s.oy = 0; }  // teleport, don't streak
  }
  return s;
}

const at = (actor) => tracked.get(actor);

/* ── spawning ───────────────────────────────────────────── */
/* Velocities are in tiles per second and gravity in tiles per
   second squared, so a shard from an ordinary hit travels about
   a tile and a half before it fades. */
function burstShards(x, y, palette, n, power) {
  for (let i = 0; i < n && shards.length < MAX_SHARDS; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (1.6 + Math.random() * 3.4) * power;
    shards.push({
      x: x + 0.5 + (Math.random() - 0.5) * 0.5,
      y: y + 0.5 + (Math.random() - 0.5) * 0.5,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.9 * power,
      life: 420 + Math.random() * 420,
      age: 0,
      size: Math.random() < 0.3 ? 2 : 1,
      color: palette[(Math.random() * palette.length) | 0],
    });
  }
}

function number(x, y, text, color, size, drift) {
  /* Several readouts can land on one tile in a single turn — a
     miss, then a hit, then a kill. Stack them instead of letting
     them print on top of each other.

     The test used to be a one-tile box, which is narrower than the
     text: 「빗나감」 is three glyphs wide and spills well past its
     own tile. Four monsters around you printed eight readouts into
     three tiles and none of them could be read. The box is now as
     wide as the words actually are, and the window is long enough
     to cover a whole turn's worth. */
  let lift = 0;
  const wide = 0.9 + text.length * 0.34;
  for (const n of numbers)
    if (Math.abs(n.x - x - 0.5) < wide && Math.abs(n.y - y) < 1.4 && n.age < 460) lift += 0.7;
  if (lift > 4.2) lift = 4.2;              // 화면 밖으로 밀어내지는 않는다

  numbers.push({
    x: x + 0.5 + (Math.random() - 0.5) * 0.35, y: y + 0.35 - lift,
    vy: -0.0016 - Math.random() * 0.0007,
    vx: (drift || 0) * 0.0006,
    life: size > 1.15 ? 900 : 680, age: 0, text, color, size,
  });
}

/* 크랙이 열리는 순간. 이 판에서 그 유물이 다른 물건이 되는 한 번뿐인
   프레임이라 레벨업과 같은 무게로 친다. pump 밖에 두는 이유는 하나다 —
   저 함수는 이미 171갈래이고, 새 사건마다 한 갈래씩 더 얹으면 아무도
   못 여는 함수가 된다(sim/knots.mjs가 이 커밋에서 바로 잡아냈다). */
/* 순교의 두 프레임. 같은 유물의 같은 사건이라 한 함수에 둔다. */
function martyrFx(e, spent) {
  ring(e.x, e.y, spent ? 1.4 : 1.1, PALETTE.R, spent ? 640 : 260);
  number(e.x, e.y - (spent ? 0.7 : 0.5), spent ? '순교' : '버틴다',
         PALETTE.R, spent ? 1.25 : 1.05);
  if (spent) { flashScreen = Math.max(flashScreen, 0.25); flashHue = 'r'; buzz([80, 40, 80]); sfx.warn(); }
  else shake = Math.max(shake, 0.4);
}

/* 되감기가 「사라진다」에서 「빠져나온다」가 됐다. 연출도 그 순서를
   따라간다 — 칼이 먼저 사방으로 나가고, 그 다음에 연기가 덮는다.
   예전에는 파란 원 하나가 퍼지고 끝이라 「임팩트가 없다」는 말을
   들었고, 그 말은 규칙에도 화면에도 둘 다 맞았다. */
/* 한계돌파 셋의 연출. 셋 다 「피해가 나갔다」가 아니라 **판이
   바뀌었다**를 그려야 해서, 숫자가 아니라 형태로 말한다. 한 곳에
   묶는 이유는 pump 가 이미 169갈래이기 때문이다. */
/* 판을 바꾸는 사건들의 한 문. pump 는 이미 169갈래·868줄이고, 새
   사건마다 case 를 하나씩 얹으면 아무도 못 여는 함수가 된다 —
   sim/knots.mjs 가 이 커밋에서 두 번 잡았다. */
function bigFx(e) {
  if (e.t === 'arcana') return arcanaFx(e);
  if (e.t === 'deathZoom') return openLens(e);
  if (e.t === 'crack') return crackBurst(e);
  if (e.t === 'vanishOut') return vanishBurst(e);
  if (e.t === 'martyr' || e.t === 'martyrHold') return martyrFx(e, e.t === 'martyr');
  return breakFx(e);
}

/* 아르카나를 고른 순간. 판 전체의 성격이 바뀌는 일이라 화면 전체가
   한 번 물든다 — 유물이나 크랙과 달리 이건 **내 몸이 아니라 세계**에
   일어난 일이다. */
function arcanaFx(e) {
  const p = G.player;
  if (!p) return;
  for (let i = 0; i < 3; i++)
    ring(p.x, p.y, 2.2 + i * 1.6, i % 2 ? PALETTE.p : PALETTE.P, 700 + i * 200);
  number(p.x, p.y - 1.1, e.n || '아르카나', PALETTE.P, 1.4);
  flashScreen = Math.max(flashScreen, 0.2); flashHue = 'P';
  shake = Math.max(shake, 0.45);
  buzz([50, 40, 50, 40, 90]);
  sfx.levelup();
}

function breakFx(e) {
  if (e.t === 'brace') return standFx(e);
  if (e.t === 'kite') return kiteFx(e);
  return bulwarkFx(e);
}
function standFx(e) {
  /* 전사 — 땅으로 박히는 두 겹의 고리. 밖에서 안으로 조인다(shrink). */
  ring(e.x, e.y, 2.4, PALETTE.N, 620, true);
  ring(e.x, e.y, 1.3, PALETTE.y, 420, true);
  number(e.x, e.y - 0.8, '버틴다', PALETTE.y, 1.2);
  shake = Math.max(shake, 0.5);
  buzz([60, 30, 60]);
  sfx.levelup();
}
function kiteFx(e) {
  /* 궁수 — 지나온 자리로 그어지는 선. 물러난 궤적 자체가 공격이다. */
  if (e.from) beams.push({ fx: e.from.x + 0.5, fy: e.from.y + 0.5,
    tx: e.x + 0.5, ty: e.y + 0.5, color: PALETTE.E, age: 0, life: 300, thin: true });
  ring(e.x, e.y, 1.4, PALETTE.E, 340);
  number(e.x, e.y - 0.7, `${e.n || 0}발`, PALETTE.E, 1.1);
  buzz([20, 15, 20]);
  sfx.roll();
}
function bulwarkFx(e) {
  /* 팔라딘 — 금빛 껍질. 쓰러지지 않는다는 것은 밝은 사건이다. */
  ring(e.x, e.y, 1.9, PALETTE.y, 700);
  ring(e.x, e.y, 1.1, PALETTE.w, 480);
  number(e.x, e.y - 0.8, '불굴', PALETTE.y, 1.2);
  shake = Math.max(shake, 0.3);
  buzz([40, 20, 40]);
  sfx.levelup();
}

/* ── 빌려 쓰던 넷 ──────────────────────────────────────────
   그림자 밟기는 회피 굴림의 파란 줄을, 칼 부채는 궁수의 화살비를,
   급소 찌르기는 전사의 마무리를 그대로 빌려 쓰고 있었다. 규칙은
   서로 다른 일을 하는데 화면은 같은 말을 하고 있었다는 뜻이다.
   연타는 아예 제 프레임이 없었다 — 평타 세 번과 구분이 안 됐다.

   bigFx 와 같은 이유로 한 문 뒤에 둔다: pump 는 이미 갈래가 표
   수준이고, 새 기예마다 case 를 하나씩 얹으면 아무도 못 여는
   함수가 된다. */
function artFx(e) {
  if (e.t === 'stepIn') return stepInFx(e);
  if (e.t === 'fanOut') return fanOutFx(e);
  if (e.t === 'vitals') return vitalsFx(e);
  return flurryFx(e);
}
function stepInFx(e) {
  /* 떠난 자리에 남는 그을음, 도착한 자리에 서는 몸. 굴림과 달리
     **두 곳**에서 일어난다 — 그게 「이동」과 「등 뒤에 섰다」의 차이다. */
  const f = e.from || e;
  ring(f.x, f.y, 1.3, PALETTE.p, 420, true);
  beams.push({ fx: f.x + 0.5, fy: f.y + 0.5, tx: e.x + 0.5, ty: e.y + 0.5,
               color: PALETTE.P, age: 0, life: 220, thin: true });
  ring(e.x, e.y, 0.9, PALETTE.P, 300);
  burstShards(e.x, e.y, [PALETTE.p, PALETTE.P, PALETTE.k], 10, 1.2);
  buzz([14, 10, 24]); sfx.roll();
}
function fanOutFx(e) {
  /* 앞쪽 반원으로만 펼쳐지는 다섯 줄. 화살비는 방 전체이고 이건
     내가 보고 있는 쪽이다 — 방향이 있는 것이 이 기예의 전부다. */
  const base = Math.atan2(e.ay || 0, e.ax || 1);
  for (let i = 0; i < 5; i++) {
    const a = base + (i - 2) * 0.30;
    beams.push({ fx: e.x + 0.5, fy: e.y + 0.5,
                 tx: e.x + 0.5 + Math.cos(a) * (e.rng || 4),
                 ty: e.y + 0.5 + Math.sin(a) * (e.rng || 4),
                 color: PALETTE.s, age: -i * 18, life: 200, thin: true });
    slashes.push({ x: e.x + 0.5, y: e.y + 0.5, a, kind: 'dagger', age: -i * 18, life: 180 });
  }
  shake = Math.max(shake, 0.16 + (e.n || 0) * 0.04);
  buzz(18); sfx.roll();
}
function vitalsFx(e) {
  /* 한 점. 고리도 파편도 없고 흰 선 하나와 글자 하나 — 이 기예가
     하는 일이 정확히 그것이다. */
  beams.push({ fx: e.x + 0.5, fy: e.y + 0.5, tx: e.tx + 0.5, ty: e.ty + 0.5,
               color: PALETTE.W, age: 0, life: 160, thin: true });
  ring(e.tx, e.ty, 0.6, PALETTE.W, 220, true);
  number(e.tx, e.ty - 0.6, '급소', PALETTE.W, 1.25);
  freeze = Math.max(freeze, 60);
  shake = Math.max(shake, 0.3);
  buzz([26, 12, 26]); sfx.crit();
}
function flurryFx(e) {
  /* 이어 붙인 대수만큼 짧은 호가 겹친다. 연타의 값은 마지막 한
     대가 무겁다는 것이라, 뒤로 갈수록 커진다. */
  const a = Math.atan2((e.ty ?? e.y) - e.y, (e.tx ?? e.x) - e.x);
  for (let i = 0; i < (e.n || 1); i++)
    slashes.push({ x: e.x + 0.5, y: e.y + 0.5, a: a + (i % 2 ? 0.24 : -0.24),
                   kind: i + 1 >= (e.n || 1) ? 'great' : 'sword',
                   age: -i * 42, life: 180 });
  number(e.x, e.y - 0.9, `${e.n || 1}연타`, PALETTE.o, 0.95 + (e.n || 1) * 0.1);
  shake = Math.max(shake, 0.12 * (e.n || 1));
  buzz(10 * (e.n || 1));
}

/* ── 손에 든 것 ────────────────────────────────────────────
   game.js 의 auraOf() 가 기예 사건마다 「지금 손에 든 것」을 얹어
   보낸다. 여기서 하는 일은 그걸 색으로 옮기는 것뿐이다 — 규칙은
   색을 모르고, 화면은 규칙을 모른다.

   두 가지를 조심했다. 하나, 유물 일곱을 낀 후반에 기예 한 번마다
   무지개가 터지면 그건 정보가 아니라 소음이라 **둘까지만** 그린다.
   둘, 이건 기존 연출 **위에** 얹히는 것이라 원래 프레임보다 작고
   짧아야 한다 — 안 그러면 무슨 기예를 썼는지가 안 보인다. */
const MARK_TINT = { pierce:'W', reap:'R', storm:'E', hunt:'o', duel:'y', thirst:'R',
                    bedrock:'s', thorn:'R', dawn:'y', mend:'E', shrug:'G', anchor:'N' };
const RELIC_TINT = { everflame:'o', ember:'o', lamp:'o', pact:'R', reckless:'R',
                     martyr:'P', hunger:'R', mirror:'W', vow:'y', scale:'y',
                     chain:'s', bone:'w', grudge:'P', nighteye:'B', eye:'P' };
function auraWash(e) {
  const a = e.aura;
  if (!a) return;
  const x = e.x ?? e.fx, y = e.y ?? e.fy;
  if (x === undefined || y === undefined) return;
  /* 두 자리를 **역할별로** 나눈다. 처음에는 각인과 유물을 한 줄로
     이어 붙이고 앞에서 둘을 잘랐는데, 각인 슬롯이 +3·+5·+7에 열리므로
     **+5부터 각인 둘이 자리를 다 먹고 유물은 몇 개를 끼든 영구히
     잘려 나갔다.** 「유물 일곱 낀 후반에 무지개가 터지면 소음」이라고
     걱정한 바로 그 구간이, 정작 유물이 하나도 안 그려지는 구간이었다.
     덤으로 +5 이후 아우라가 절대 안 변해서 정보가 아니라 고정 물감이
     됐다. 각인 하나(손이 무엇을 하는가) + 유물 하나(내가 무엇이
     되었는가). 같은 색이면 뒤엣것은 버린다 — 같은 색 고리 둘은 두
     개의 정보가 아니라 한 개의 겹줄이다. */
  const pick = (list, tab) => { for (const k of list) if (tab[k]) return tab[k]; return null; };
  const mk = pick(a.marks, MARK_TINT);
  const rl = pick(a.relics, RELIC_TINT);
  const keys = [mk, rl !== mk ? rl : null].filter(Boolean);
  /* 강화는 색이 아니라 **양**으로 말한다 — +3마다 한 단계, 셋에서
     멈춘다. +12와 +9가 화면에서 달라야 할 이유는 없다. */
  const step = Math.min(3, Math.floor(a.plus / 3));
  /* 최정상급은 자리를 다투지 않는다. 초월은 흰 껍질, 이름 있는
     무기는 금빛 — 둘 다 다른 무엇보다 **먼저** 그려지고, 나머지
     두 자리는 그대로 남는다. 판에 한두 번 볼 물건이라 흔한 것과
     자리를 나눠 쓸 이유가 없다. */
  if (a.boon || a.unique) {
    const k = a.boon ? 'W' : 'y';
    ring(x, y, 1.15, PALETTE[k], 260);
    ring(x, y, 0.6, PALETTE[k], 180, true);
    burstShards(x, y, [PALETTE[k], PALETTE.w], a.boon ? 9 : 5, 1.1);
  }
  /* ── 그리고 원래 프레임보다 **작고 짧아야** 한다 ────────────
     주석에 그렇게 적어 놓고 정반대를 만들었다: 아우라 고리가 1.4/1.95
     고정이었는데, 기예 스물셋 중 열다섯의 자기 고리가 그보다 작다
     (급소 0.6 · 관통 0.8 · 그림자 도약 0.9 · 덫 0.9…). 수명도 330ms
     로 급소의 220ms보다 오래 남았다. 「고리도 파편도 없이 흰 선 하나」
     라고 적어 둔 기예가 금빛 고리와 파편 열아홉에 파묻혔다.

     그래서 고리를 **작게** 깐다(0.5~0.9칸, 140~200ms). 고리는 이
     파일에서 「사건이 일어났다」의 원시형이고 아우라는 사건이 아니라
     형용사다 — 형용사가 문장보다 크면 안 된다. */
  if (step) burstShards(x, y, [PALETTE.y, PALETTE.w], 2 + step * 2, 0.55 + step * 0.15);
  for (let i = 0; i < keys.length; i++) {
    ring(x, y, 0.5 + i * 0.4, PALETTE[keys[i]], 140 + i * 60, true);
    burstShards(x, y, [PALETTE[keys[i]]], 3, 0.8);
  }
}


/* ── 사제의 셋 ─────────────────────────────────────────────
   전부 「받은 것을 돌려준다」의 다른 얼굴이라, 셋 다 **되돌아오는
   방향**을 그린다: 되갚기는 나에게서 저쪽으로 한 줄, 말씀은 나를
   중심으로 밖으로, 성흔은 표적에서 곁으로.

   artFx·bigFx 와 같은 이유로 한 문 뒤에 둔다 — pump 는 이 저장소에서
   가장 굵은 함수이고, 매듭 린트가 이 커밋에서 바로 잡았다. */
function priestFx(e) {
  if (e.t === 'repay') {
    /* 모아 둔 것이 한 번에 나간다. 굵은 줄 하나 + 무게. */
    beams.push({ fx: e.x + 0.5, fy: e.y + 0.5, tx: e.tx + 0.5, ty: e.ty + 0.5,
                 color: PALETTE.W, age: 0, life: 260 });
    ring(e.tx, e.ty, 1.7, PALETTE.y, 420);
    burstShards(e.tx, e.ty, [PALETTE.W, PALETTE.y, PALETTE.R], 18, 1.6);
    number(e.x, e.y - 0.8, e.capped ? '되갚기!' : '되갚기', PALETTE.y, 1.3);
    freeze = Math.max(freeze, 80);
    shake = Math.max(shake, 0.5);
    buzz([50, 30, 60]); sfx.crit();
    return;
  }
  if (e.t === 'word') {
    /* 피해가 없는 유일한 기예라 파편도 없다 — 소리가 퍼지고 멈춘다. */
    for (let i = 0; i < 3; i++)
      ring(e.x, e.y, (e.r || 4) * (0.5 + i * 0.28), PALETTE.W, 380 + i * 140);
    number(e.x, e.y - 0.8, '멈춰라', PALETTE.W, 1.25);
    freeze = Math.max(freeze, 120);
    buzz([30, 60, 30]); sfx.warn();
    return;
  }
  if (e.t === 'stigma') {
    ring(e.x, e.y, 1.3, PALETTE.R, 620, true);
    ring(e.x, e.y, 0.7, PALETTE.W, 440, true);
    number(e.x, e.y - 0.7, '성흔', PALETTE.R, 1.2);
    buzz([26, 18, 26]); sfx.warn();
    return;
  }
  ring(e.x, e.y, e.r || 2, PALETTE.R, 260);
  burstShards(e.x, e.y, [PALETTE.R, PALETTE.r], 8, 1.1);
  shake = Math.max(shake, 0.22);
}

function vanishBurst(e) {
  for (let i = 0; i < (e.n || 0); i++) {
    const a = (i / Math.max(1, e.n)) * Math.PI * 2;
    ring(e.x + Math.cos(a) * 0.9, e.y + Math.sin(a) * 0.9, 0.8, PALETTE.w, 240);
  }
  ring(e.x, e.y, 3.2, PALETTE.B, 520);
  ring(e.x, e.y, 2.0, PALETTE.b, 380);
  shake = Math.max(shake, 0.34 + (e.n || 0) * 0.08);
  buzz([30, 20, 40]);
  sfx.hit();
}

function crackBurst(e) {
  const p = G.player;
  if (!p) return;
  /* 처음에 흰 섬광 고리 + 화면 밝힘 + 레벨업 효과음으로 그렸다.
     크랙의 정의는 「게임이 가르친 규칙 하나를 부순다」인데, 그런
     순간을 밝은 팡파르로 축하하면 그건 이 게임이 아니라 가챠의
     「획득!」이다. 다크소울·디아블로에서 무언가가 갈라질 때는 소리가
     낮아지고 화면이 어두워진다.

     그래서 흰 고리를 뺀다(PALETTE.W는 STYLE.md가 하이라이트 4.83%로
     규정한 색이고, 화면 전체 섬광으로 쓸 색이 아니다). 남는 것은
     자수정 고리 하나, 흔들림, 진동, 그리고 낮은 소리다. */
  ring(p.x, p.y, 1.8, PALETTE.P, 720);
  ring(p.x, p.y, 2.6, PALETTE.p, 900);
  number(p.x, p.y - 0.9, e.n || '금이 갔다', PALETTE.P, 1.3);
  shake = Math.max(shake, 0.62);
  buzz([70, 50, 70]);
  sfx.warn();
}

function ring(x, y, maxr, color, life, shrink) {
  rings.push({ x: x + 0.5, y: y + 0.5, maxr, color, life: life || 380, age: 0, shrink });
}

const buzz = ms => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

/* 죽음의 렌즈를 한 프레임 진행시킨다. 1.4초에 걸쳐 다 조인다 —
   그보다 짧으면 확대가 안 읽히고, 길면 화면이 멈춘 것처럼 보인다. */
export function tickDeath(dt) {
  if (deathZoom > 0 && deathZoom < 1) deathZoom = Math.min(1, deathZoom + dt / 1400);
}
export function clearDeath() { deathZoom = 0; deathAt = null; }
/* 0이 아니라 아주 작은 값으로 시작한다 — 1로 넣으면 tickDeath 가
   「이미 다 왔다」고 보고 한 프레임 만에 끝난다. 슬로우모션이 아니라
   컷이 된다. */
function openLens(e) { deathZoom = 0.001; deathAt = { x: e.x, y: e.y }; freeze = 300; }
/* 렌즈가 아직 조이는 중인가. 화면 쪽이 이걸 보고 끝 화면을 **늦춘다** —
   죽자마자 명세서를 띄우면 무엇이 나를 죽였는지 볼 틈이 없다. */
export const deathHolding = () => deathZoom > 0 && deathZoom < 1;

/* ── event intake ───────────────────────────────────────── */
export function pump(queue, player) {
  for (const e of queue) {
    /* Where this happened, handed to the ear once per event. A
       door smashed two rooms west should arrive from the west and
       arrive quieter — that is the one thing sound does better
       than a screen, and it was being thrown away. */
    earFrom(e.x, e.y);
    /* 기예에는 「지금 손에 든 것」이 실려 온다. 원래 연출보다 **먼저**
       그린다 — 뒤에 그리면 강화·인챈트가 기예 자체를 덮는다.
       조건 없이 부른다: 「기예인가」 판정을 여기 두면 pump 가 한 갈래
       더 굵어지고, 저 함수는 이미 이 저장소에서 가장 굵다. 판정은
       auraWash 제 안에 있다. */
    auraWash(e);
    switch (e.t) {
      case 'lunge': {
        const s = at(player);
        if (s) { s.lx = e.dx * 0.42; s.ly = e.dy * 0.42; }
        /* An arc swept in the direction of the blow. The shape
           says which weapon threw it — a dagger's is a short
           stab, a greatsword's is a half-circle — so the family
           you chose is visible in the swing, not only in a
           tooltip. */
        slashes.push({
          x: e.x + 0.5, y: e.y + 0.5,
          a: Math.atan2(e.dy, e.dx),
          kind: e.kind || 'sword',
          age: 0, life: e.kind === 'great' ? 300 : 200,
        });
        break;
      }

      /* The dodge: a streak along the path travelled and a ring
         where you landed, so a roll reads as a roll and not as a
         two-tile teleport. */
      case 'roll': {
        beams.push({ fx: e.x - e.dx * e.dist, fy: e.y - e.dy * e.dist,
                     tx: e.x, ty: e.y, color: PALETTE.B, age: 0, life: 240, thin: true });
        ring(e.x, e.y, 1.1, PALETTE.B, 300);
        buzz(8); sfx.roll();
        break;
      }

      /* Marked ground going off. One ring per tile is too much at
         twenty tiles, so the whole shape flashes at once and the
         shards come from the middle of it. */
      case 'hazard': {
        const n = e.tiles.length;
        for (const i of e.tiles) {
          const x = i % MAP_W, y = (i / MAP_W) | 0;
          if (Math.random() < 24 / n) burstShards(x, y, [PALETTE[e.tone] || PALETTE.o, PALETTE.y], 3, 1.1);
        }
        shake = Math.max(shake, 0.5);
        flashScreen = Math.max(flashScreen, 0.26); flashHue = e.tone || 'o';
        buzz([18, 26, 18]); sfx.blast();
        break;
      }

      case 'miss':
        /* 한 글자면 충분하다. 빗맞은 것은 알아야 하되, 옆 칸의
           피해 숫자를 덮을 만큼 중요하지는 않다. */
        number(e.x, e.y, '빗', PALETTE.s, 0.72);
        sfx.miss();
        break;

      // The moment your free critical evaporates. Worth a beat.
      case 'wake':
        number(e.x, e.y - 0.3, '!', PALETTE.R, 1.2);
        break;

      /* The ground being marked. Louder than the mark is bright,
         because the shape can be off the edge of the view. */
      case 'telegraph':
        sfx.warn(e.urgent);
        break;

      case 'hit': {
        const big = e.crit || e.sneak;
        number(e.x, e.y, String(e.dmg) + (e.sneak ? '!!' : e.crit ? '!' : ''),
               e.on === 'player' ? PALETTE.R : big ? PALETTE.y : PALETTE.W,
               big ? 1.45 : 1);

        if (e.on === 'monster') {
          const s = at(findByPos(e)); if (s) { s.flash = 1; s.squash = 1; }
          burstShards(e.x, e.y, spriteColors(e.spr || 'rat'), big ? 14 : 6, big ? 1.5 : 0.9);
          shake = Math.max(shake, big ? 0.42 : 0.13);
          if (big) { freeze = 70; ring(e.x, e.y, 1.6, PALETTE.y); flashScreen = 0.22; flashHue = 'y'; }
          buzz(big ? 32 : 10);
          if (e.sneak) sfx.sneak(); else if (e.crit) sfx.crit(); else sfx.hit(e.weapon, 1);
        } else {
          /* Getting hit is the one thing that should always read.
             A full-screen wash hides the board at the exact moment
             you need to see it, so the damage colour goes to the
             edges and leaves the middle alone. */
          const s = at(player);
          if (s) {
            const dx = e.from ? Math.sign(e.x - e.from.x) : 0;
            const dy = e.from ? Math.sign(e.y - e.from.y) : 0;
            s.lx = dx * 0.3; s.ly = dy * 0.3; s.flash = 1;
            s.squash = Math.max(s.squash || 0, e.severe ? 1 : 0.6);
          }
          shake = Math.max(shake, e.severe ? 0.6 : 0.24);
          vignette = Math.max(vignette, e.severe ? 1 : 0.55);
          if (e.severe) { freeze = 60; ring(e.x, e.y, 1.5, PALETTE.R, 260); }
          burstShards(e.x, e.y, [PALETTE.R, PALETTE.r, PALETTE.W], e.severe ? 16 : 8, e.severe ? 1.5 : 1.0);
          buzz(e.severe ? [22, 40, 22] : 18);
          sfx.hurt(e.severe);
          if (e.low) sfx.lowHp();
        }
        break;
      }

      case 'kill': {
        /* Overkill deserves to be named. Erasing something that
           still had most of its health is the loudest thing a
           player can do to a monster, and until now it was the
           same three shards as a finishing tap. */
        if (e.over > 0.7) {
          const word = e.over > 2 ? '박살' : e.over > 1.3 ? '분쇄' : '오버킬';
          number(e.x, e.y - 1.0, word, PALETTE.o, 1.6 + Math.min(e.over, 3) * 0.25);
          freeze = Math.max(freeze, 120 + e.over * 70);
          ring(e.x, e.y, 3.4 + e.over, PALETTE.W, 520);
        }
        const power = 1.3 + e.over * 0.9 + (e.crit ? 0.5 : 0);
        burstShards(e.x, e.y, spriteColors(e.spr || 'rat'), Math.round(20 + e.over * 22), power);
        ring(e.x, e.y, 2.2 + e.over, PALETTE.o, 460);
        shake = Math.max(shake, 0.34 + e.over * 0.3);
        freeze = Math.max(freeze, e.boss ? 260 : 90 + e.over * 60);
        flashScreen = Math.max(flashScreen, e.boss ? 0.8 : 0.2 + e.over * 0.2);
        flashHue = e.boss ? 'W' : 'o';
        if (e.boss) { ring(e.x, e.y, 26, PALETTE.o, 1500); ring(e.x, e.y, 18, PALETTE.y, 1100); }
        buzz(e.boss ? [60, 60, 60, 60, 140] : e.over > 0.5 ? [16, 26, 40] : 26);
        if (e.boss) sfx.victory(); else sfx.kill(e.over);
        break;
      }

      case 'comboTier':
        sfx.combo(e.n);
        ring(e.x, e.y, 4 + e.n * 0.2, PALETTE.y, 620);
        number(e.x, e.y - 0.6, `${e.n} 연격`, PALETTE.y, 1.5);
        flashScreen = Math.max(flashScreen, 0.3); flashHue = 'y';
        shake = Math.max(shake, 0.4);
        buzz([20, 30, 20, 30, 60]);
        break;

      case 'heal': {
        number(e.x, e.y, `+${e.amt}`, PALETTE.E, 1.15, 0);
        ring(e.x, e.y, 1.8, PALETTE.E, 520);
        for (let i = 0; i < 10 && shards.length < MAX_SHARDS; i++)
          shards.push({
            x: e.x + Math.random(), y: e.y + 1, vx: (Math.random() - 0.5) * 0.6,
            vy: -1.4 - Math.random() * 0.8, life: 620, age: 0, size: 1,
            color: Math.random() < 0.5 ? PALETTE.E : PALETTE.e, float: true,
          });
        sfx.heal();
        break;
      }

      /* Two sizes. Health now arrives every third level in a
         lump, and the frame has to say which kind of level this
         was or the stepping is invisible. */
      case 'levelup':
        ring(e.x, e.y, e.big ? 9 : 6, PALETTE.y, e.big ? 1000 : 800);
        ring(e.x, e.y, e.big ? 6 : 4, PALETTE.W, 600);
        if (e.big) ring(e.x, e.y, 3, PALETTE.o, 700);
        number(e.x, e.y - 0.8, e.big ? '몸이 커졌다' : 'LEVEL UP',
               e.big ? PALETTE.W : PALETTE.y, e.big ? 2.0 : 1.6);
        flashScreen = Math.max(flashScreen, e.big ? 0.7 : 0.45); flashHue = 'y';
        if (e.big) { shake = Math.max(shake, 0.5); freeze = 110; }
        buzz(e.big ? [40, 40, 40, 40, 140] : [30, 40, 30, 40, 90]);
        sfx.levelup();
        break;

      case 'beam':
        beams.push({ fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty, color: PALETTE[e.color] || PALETTE.P, life: 260, age: 0 });
        shake = Math.max(shake, 0.16);
        break;

      case 'burst':
        ring(e.x, e.y, e.r, PALETTE[e.color] || PALETTE.B, 520);
        burstShards(e.x, e.y, [PALETTE[e.color] || PALETTE.B, PALETTE.W], 26, 1.6);
        shake = Math.max(shake, 0.35);
        break;

      case 'death':
        flashScreen = 1; flashHue = 'r';
        shake = Math.max(shake, 0.9);
        buzz([80, 60, 200]);
        sfx.death();
        break;

      // An arrow out of the dark. The trail is the warning.
      case 'shot':
        beams.push({ fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty,
                     color: PALETTE.w, life: 200, age: 0, thin: true });
        buzz(12);
        break;

      /* Your arrow, and theirs, must never be the same streak —
         the two lines cross the same room and the player has to
         read at a glance which way one is going. Theirs is a thin
         bone line; yours is thicker, tinted by what is nocked, and
         leaves a puff at the string. */
      case 'loose': {
        const tone = { deer:'W', heavy:'s', venom:'e', ember:'o', barbed:'N', long:'B' }[e.ammo] || 'W';
        beams.push({ fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty,
                     color: PALETTE[tone], life: 240, age: 0 });
        const dx = e.tx - e.fx, dy = e.ty - e.fy;
        const len = Math.max(0.001, Math.hypot(dx, dy));
        for (let i = 0; i < 6 && shards.length < MAX_SHARDS; i++) {
          shards.push({
            x: e.fx + 0.5, y: e.fy + 0.5,
            vx: (dx / len) * (2 + Math.random() * 1.6) + (Math.random() - 0.5),
            vy: (dy / len) * (2 + Math.random() * 1.6) + (Math.random() - 0.5),
            life: 180 + Math.random() * 140, age: 0, size: 1, color: PALETTE[tone],
          });
        }
        buzz(14);
        sfx.miss();
        break;
      }

      case 'trap': {
        const hue = { dart:'s', poison:'e', pit:'k', teleport:'P', alarm:'y' }[e.kind] || 'R';
        ring(e.x, e.y, e.kind === 'alarm' ? 9 : 2.4, PALETTE[hue] || PALETTE.R, 620);
        burstShards(e.x, e.y, [PALETTE[hue] || PALETTE.R, PALETTE.W], 18, 1.4);
        number(e.x, e.y - 0.5, '함정!', PALETTE.o, 1.3);
        shake = Math.max(shake, 0.45);
        flashScreen = Math.max(flashScreen, 0.28); flashHue = hue === 'k' ? 'r' : hue;
        buzz([30, 40, 60]);
        break;
      }

      // The chest that wasn't. Worth the biggest tell in the file.
      case 'reveal':
        ring(e.x, e.y, 3.4, PALETTE.R, 700);
        ring(e.x, e.y, 2.0, PALETTE.o, 520);
        number(e.x, e.y - 0.7, '미믹!', PALETTE.R, 1.7);
        burstShards(e.x, e.y, [PALETTE.n, PALETTE.N, PALETTE.R], 22, 1.7);
        shake = Math.max(shake, 0.6);
        freeze = Math.max(freeze, 130);
        flashScreen = Math.max(flashScreen, 0.42); flashHue = 'R';
        buzz([50, 50, 90]);
        break;

      case 'chest':
        ring(e.x, e.y, 2.2, PALETTE.y, 520);
        for (let i = 0; i < 16 && shards.length < MAX_SHARDS; i++)
          shards.push({
            x: e.x + Math.random(), y: e.y + 0.6,
            vx: (Math.random() - 0.5) * 4, vy: -3 - Math.random() * 3,
            life: 700, age: 0, size: 1,
            color: Math.random() < 0.6 ? PALETTE.y : PALETTE.W,
          });
        buzz(24);
        sfx.pick();
        break;

      case 'ail': {
        const hue = { poison:'E', blind:'g', fear:'P', slow:'B', paralyze:'R' }[e.kind] || 'P';
        ring(e.x, e.y, 2.6, PALETTE[hue], 700);
        flashScreen = Math.max(flashScreen, 0.3); flashHue = hue;
        shake = Math.max(shake, 0.3);
        buzz([40, 30, 40]);
        break;
      }

      /* 잠긴 계단을 두드렸다. 로그 한 줄은 다섯 줄 사이에 끼어
         사라지고, 그러면 「밝은 버튼을 눌렀는데 아무 일도 안 났다」만
         남는다 — 그건 고장으로 읽힌다. 흔들고, 쇠 색 고리를 튀기고,
         한 번 울린다. 턴이 탔다는 것을 손이 알아야 한다. */
      case 'lock':
        number(e.x, e.y - 0.4, '잠김', PALETTE.y, 1.1);
        ring(e.x, e.y, 2.2, PALETTE.y, 520);
        shake = Math.max(shake, 0.34);
        buzz([30, 24, 30]);
        break;

      case 'resist':
        number(e.x, e.y - 0.4, '저항', PALETTE.B, 1.2);
        ring(e.x, e.y, 1.8, PALETTE.B, 420);
        break;

      case 'struggle':
        number(e.x, e.y - 0.3, '···', PALETTE.w, 1);
        shake = Math.max(shake, 0.18);
        break;

      case 'splash':
        for (let i = 0; i < 12 && shards.length < MAX_SHARDS; i++)
          shards.push({
            x: e.x + Math.random(), y: e.y + 0.6,
            vx: (Math.random() - 0.5) * 5, vy: -2.4 - Math.random() * 2,
            life: 480, age: 0, size: 1,
            color: Math.random() < 0.5 ? PALETTE.B : PALETTE.b,
          });
        break;

      case 'door':
        if (e.state === 'broken') {
          burstShards(e.x, e.y, [PALETTE.n, PALETTE.N], 20, 1.6);
          shake = Math.max(shake, 0.5);
          buzz([40, 40, 70]);
        } else if (e.state === 'stuck') {
          shake = Math.max(shake, 0.22);
          number(e.x, e.y - 0.3, '덜컹', PALETTE.s, 0.9);
          buzz(20);
        } else {
          shake = Math.max(shake, 0.08);
        }
        sfx.door();
        break;

      // Something heard you. Show how far the sound carried.
      case 'noise':
        ring(e.x, e.y, e.r, PALETTE.o, 720);
        break;

      /* Enhancement, in three sizes. The strike is a bet now, so
         the animation has to say which way it went before the log
         line does — sparks up for a hit, sparks down and grey for
         a miss, and a full flash for the double. */
      case 'forge':
        if (e.fail) {
          ring(e.x, e.y, 1.4, PALETTE.s, 420);
          number(e.x, e.y - 0.5, '실패', PALETTE.s, 1.1);
          for (let i = 0; i < 10 && shards.length < MAX_SHARDS; i++)
            shards.push({
              x: e.x + Math.random(), y: e.y + 0.5,
              vx: (Math.random() - 0.5) * 3, vy: -1.4 - Math.random() * 1.2,
              life: 480, age: 0, size: 1,
              color: Math.random() < 0.5 ? PALETTE.s : PALETTE.g,
            });
          buzz(14); sfx.bust();
          break;
        }
        ring(e.x, e.y, e.big ? 3.4 : 2.2, PALETTE.y, e.big ? 760 : 560);
        number(e.x, e.y - 0.5, e.big ? '+2' : '+1', e.big ? PALETTE.W : PALETTE.y, e.big ? 2.1 : 1.5);
        for (let i = 0; i < (e.big ? 40 : 18) && shards.length < MAX_SHARDS; i++)
          shards.push({
            x: e.x + Math.random(), y: e.y + 0.5,
            vx: (Math.random() - 0.5) * (e.big ? 8 : 5), vy: -3.5 - Math.random() * (e.big ? 5 : 3),
            life: 640, age: 0, size: 1,
            color: Math.random() < 0.5 ? PALETTE.y : PALETTE.o,
          });
        flashScreen = Math.max(flashScreen, e.big ? 0.5 : 0.22); flashHue = 'y';
        if (e.big) { shake = Math.max(shake, 0.5); freeze = 90; sfx.jackpot(); }
        buzz(e.big ? [40, 30, 60] : [25, 30, 45]);
        break;

      /* 절단. One crit in forty. Everything the engine has: the
         world stops, the screen goes white, and the number is
         twice the size of any other number the game draws. */
      case 'perfect':
        freeze = 190;
        flashScreen = Math.max(flashScreen, 0.85); flashHue = 'W';
        shake = Math.max(shake, 1.0);
        ring(e.x, e.y, 4.2, PALETTE.W, 620);
        ring(e.x, e.y, 2.0, PALETTE.R, 460);
        number(e.x, e.y - 0.7, '절단', PALETTE.W, 2.6);
        for (let i = 0; i < 54 && shards.length < MAX_SHARDS; i++) {
          const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 7;
          shards.push({
            x: e.x + 0.5, y: e.y + 0.5,
            vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1,
            life: 760, age: 0, size: Math.random() < 0.3 ? 2 : 1,
            color: Math.random() < 0.5 ? PALETTE.W : PALETTE.R,
          });
        }
        buzz([70, 50, 110]); sfx.crit();
        break;

      /* An engraving being cut. Violet like the relic tier,
         because a rule arriving is a different event from a
         number arriving. */
      case 'engrave':
        freeze = 130;
        for (const r of [1.6, 3.2, 4.8]) ring(e.x, e.y, r, PALETTE.P, 780);
        number(e.x, e.y - 0.7, '각인', PALETTE.P, 2.2);
        for (let i = 0; i < 34 && shards.length < MAX_SHARDS; i++) {
          const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 5;
          shards.push({ x: e.x + 0.5, y: e.y + 0.5,
            vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5,
            life: 820, age: 0, size: Math.random() < 0.3 ? 2 : 1,
            color: Math.random() < 0.5 ? PALETTE.P : PALETTE.W });
        }
        flashScreen = Math.max(flashScreen, 0.6); flashHue = 'P';
        shake = Math.max(shake, 0.6);
        buzz([50, 40, 80]); sfx.jackpot();
        break;

      // 이중 시전. A second ring inside the first, so the free
      // cast is visibly a *second* one and not a bigger one.
      case 'twin':
        ring(e.x, e.y, 1.4, PALETTE.B, 420);
        ring(e.x, e.y, 2.6, PALETTE.P, 520);
        number(e.x, e.y - 0.5, '이중', PALETTE.B, 1.3);
        flashScreen = Math.max(flashScreen, 0.24); flashHue = 'B';
        buzz([16, 14, 16]);
        break;

      /* 초월. The rarest frame in the game, and it belongs to a
         pickup rather than a kill — the one time the floor gives
         you something instead of taking it. */
      case 'transcend':
        freeze = 240;
        flashScreen = Math.max(flashScreen, 0.9); flashHue = 'W';
        for (const r of [1.6, 3.0, 4.6, 6.4])
          ring(e.x, e.y, r, PALETTE.W, 900);
        /* The same fireworks serve 초월 and 공명 — both are the
           moment a run stops being ordinary — so the word comes
           from the event rather than from here. */
        number(e.x, e.y - 0.9, e.word || '초월', PALETTE.W, 3.0);
        for (let i = 0; i < 70 && shards.length < MAX_SHARDS; i++) {
          const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 8;
          shards.push({
            x: e.x + 0.5, y: e.y + 0.5,
            vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2,
            life: 1200, age: 0, size: Math.random() < 0.35 ? 2 : 1,
            color: Math.random() < 0.6 ? PALETTE.W : PALETTE.y,
          });
        }
        buzz([40, 30, 40, 30, 120]); sfx.jackpot();
        break;

      /* 역류의. The death frame has already played by the time
         this arrives, and that is the point — the screen has to
         be taken back. */
      case 'tide':
        freeze = 200;
        flashScreen = Math.max(flashScreen, 0.75); flashHue = 'B';
        ring(e.x, e.y, 5.2, PALETTE.B, 820);
        ring(e.x, e.y, 2.6, PALETTE.W, 620);
        number(e.x, e.y - 0.8, '역류', PALETTE.B, 2.4);
        shake = Math.max(shake, 0.6);
        buzz([90, 60, 90]); sfx.jackpot();
        break;

      // Something ate a level off your gear. Small, grey, nasty.
      case 'corrode':
        ring(e.x, e.y, 1.6, PALETTE.e, 480);
        number(e.x, e.y - 0.4, '부식', PALETTE.e, 1.3);
        flashScreen = Math.max(flashScreen, 0.2); flashHue = 'e';
        buzz([30, 20, 30]); sfx.bust();
        break;

      /* The sword coming apart in your hands. The one outcome in
         the game that takes something away permanently, so it gets
         the loudest frame the fire screen can throw. */
      case 'shatter':
        ring(e.x, e.y, 3.0, PALETTE.R, 700);
        number(e.x, e.y - 0.6, '파괴', PALETTE.R, 2.2);
        for (let i = 0; i < 46 && shards.length < MAX_SHARDS; i++)
          shards.push({
            x: e.x + Math.random(), y: e.y + 0.5,
            vx: (Math.random() - 0.5) * 9, vy: -2 - Math.random() * 6,
            life: 820, age: 0, size: Math.random() < 0.4 ? 2 : 1,
            color: Math.random() < 0.5 ? PALETTE.s : PALETTE.G,
          });
        flashScreen = Math.max(flashScreen, 0.55); flashHue = 'R';
        shake = Math.max(shake, 0.85); freeze = 140;
        buzz([60, 40, 90]); sfx.bust();
        break;

      // The gamble resolving. Violet for a curse, gold for a gift.
      case 'enchant': {
        const hue = e.cursed ? 'P' : 'y';
        ring(e.x, e.y, 4.4, PALETTE[hue], 780);
        ring(e.x, e.y, 2.6, PALETTE.W, 560);
        number(e.x, e.y - 0.7, e.cursed ? '저주' : '인챈트', PALETTE[hue], 1.6);
        burstShards(e.x, e.y, [PALETTE[hue], PALETTE.W], 26, 1.7);
        flashScreen = Math.max(flashScreen, e.cursed ? 0.5 : 0.38); flashHue = hue;
        shake = Math.max(shake, 0.4);
        freeze = Math.max(freeze, 120);
        buzz(e.cursed ? [70, 50, 120] : [25, 35, 25, 35, 70]);
        break;
      }

      case 'drain':
        number(e.x, e.y - 0.2, `+${e.amt}`, PALETTE.R, 1.05);
        ring(e.x, e.y, 1.4, PALETTE.r, 380);
        break;

      case 'execute':
        number(e.x, e.y - 0.6, '처형', PALETTE.R, 1.6);
        ring(e.x, e.y, 3.0, PALETTE.R, 560);
        shake = Math.max(shake, 0.55);
        freeze = Math.max(freeze, 110);
        buzz([40, 30, 80]);
        break;

      // 연쇄 arcing to the next body.
      case 'arc':
        beams.push({ fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty,
                     color: PALETTE.B, life: 240, age: 0 });
        shake = Math.max(shake, 0.2);
        break;

      /* ── the warrior's four ─────────────────────────────
         Four arts that answer four different problems should not
         look like each other, or the row becomes four buttons
         that all mean "attack". Each takes a different primitive
         as its spine: a line, a circle, a floor mark, a column. */

      // 밀쳐내기 — everything travels one way. A shove is a
      // direction before it is damage.
      case 'shove': {
        beams.push({ fx: e.x, fy: e.y, tx: e.tx, ty: e.ty,
                     color: PALETTE.W, life: 200, age: 0, thin: true });
        for (let i = 0; i < 14 && shards.length < MAX_SHARDS; i++) {
          const spread = (Math.random() - 0.5) * 0.7;
          shards.push({
            x: e.x + 0.5 + e.dx * 0.6, y: e.y + 0.5 + e.dy * 0.6,
            vx: (e.dx + spread * -e.dy) * (3.2 + Math.random() * 2.4),
            vy: (e.dy + spread * e.dx) * (3.2 + Math.random() * 2.4) - 0.6,
            life: 260 + Math.random() * 220, age: 0,
            size: 1, color: PALETTE.s,
          });
        }
        if (e.hit) {
          // It met a wall. That is the payoff, so it gets the noise.
          ring(e.tx, e.ty, 1.5, PALETTE.W, 300);
          burstShards(e.tx, e.ty, [PALETTE.W, PALETTE.s, PALETTE.g], 20, 1.5);
          number(e.tx, e.ty - 0.6, '벽!', PALETTE.W, 1.15);
          shake = Math.max(shake, 0.7);
          buzz([30, 40, 60]);
          sfx.blast();
        } else {
          shake = Math.max(shake, 0.22);
          sfx.step();
        }
        break;
      }

      // 휩쓸기 — a full circle, thrown outward from the middle.
      // The only effect in the game that reads as "all around".
      case 'cleave': {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          slashes.push({ x: e.x + 0.5, y: e.y + 0.5, a, kind: 'great',
                         age: -i * 8, life: 260 });
        }
        ring(e.x, e.y, 1.9, PALETTE.o, 340);
        burstShards(e.x, e.y, [PALETTE.o, PALETTE.W], 8 + (e.n || 0) * 5, 1.7);
        shake = Math.max(shake, 0.3 + (e.n || 0) * 0.06);
        buzz(35);
        sfx.crit();
        break;
      }

      /* 여기 예전 버티기(brace)의 case 가 하나 더 있었다. switch 는
         먼저 만나는 갈래를 쓰므로, 한계돌파로 다시 쓴 버티기의 연출
         (standFx)은 **한 번도 화면에 나온 적이 없다** — 조용한 고리
         하나가 대신 나가고 있었다. 갈래를 지운다. 사건 하나에 갈래
         하나. */

      /* ── the priest's four ─────────────────────────────
         The mage throws things; the priest marks them. Three of
         these are lines drawn on something rather than objects
         travelling through the air. */
      /* ── 사제의 셋 ─────────────────────────────────────
         전부 「받은 것을 돌려준다」의 다른 얼굴이라, 셋 다 **되돌아
         오는 방향**을 그린다: 되갚기는 나에게서 저쪽으로 한 줄,
         말씀은 나를 중심으로 밖으로, 성흔은 표적에서 곁으로. */
      case 'repay': case 'word': case 'stigma': case 'stigmaBurst':
        priestFx(e); break;
      case 'arcana': case 'deathZoom': case 'crack': case 'vanishOut':
      case 'brace': case 'kite': case 'bulwark':
      case 'martyr': case 'martyrHold': bigFx(e); break;
      case 'stepIn': case 'fanOut': case 'vitals': case 'flurry': artFx(e); break;
      /* ── the ranger's four ─────────────────────────────
         The warrior's arts happen at arm's length and are drawn
         at the hero. These happen across the room and are drawn
         at the far end of it — that difference is most of what
         makes the two classes feel unlike each other in the
         hand. */

      // 조준 사격 — the pause before it, then one clean line. The
      // ring closes on the target instead of expanding off it.
      case 'aimed': {
        rings.push({ x: e.tx + 0.5, y: e.ty + 0.5, maxr: 2.2, color: PALETTE.E,
                     life: 300, age: 0, shrink: true });
        beams.push({ fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty,
                     color: PALETTE.E, life: 300, age: 0 });
        number(e.tx, e.ty - 0.8, `${Math.round(e.dist)}칸`, PALETTE.E, 1.05);
        freeze = Math.max(freeze, 55);
        shake = Math.max(shake, 0.25);
        buzz([18, 26, 18]);
        sfx.crit();
        break;
      }

      // 관통 사격 — one line all the way to the wall, thick, and
      // it does not stop where the first body is.
      case 'pierceShot': {
        beams.push({ fx: e.fx, fy: e.fy,
                     tx: e.fx + e.dx * e.rng, ty: e.fy + e.dy * e.rng,
                     color: PALETTE.B, life: 340, age: 0 });
        for (let i = 1; i <= e.rng; i += 2)
          ring(e.fx + e.dx * i, e.fy + e.dy * i, 0.8, PALETTE.b, 240);
        shake = Math.max(shake, 0.35);
        buzz([24, 20, 24]);
        sfx.crit();
        break;
      }

      // 덫 — nothing flies at all. A mark bitten into the floor.
      case 'snare':
        ring(e.x, e.y, 0.9, PALETTE.n, 480);
        number(e.x, e.y - 0.4, '덫', PALETTE.N, 1.0);
        sfx.door();
        break;

      case 'snared':
        ring(e.x, e.y, 1.3, PALETTE.N, 380);
        burstShards(e.x, e.y, [PALETTE.n, PALETTE.N], 12, 1.1);
        number(e.x, e.y - 0.6, '걸렸다', PALETTE.N, 1.15);
        shake = Math.max(shake, 0.3);
        buzz([40, 30]);
        sfx.blast();
        break;

      /* ── 팔라딘의 넷 ───────────────────────────────
         The warrior's arts land at arm's length and the ranger's
         land across the room. These travel: the charge draws a
         line the hero actually moved along, and the crusade draws
         one per body it walked to. */
      case 'charge': {
        beams.push({ fx:e.x + 0.5, fy:e.y + 0.5, tx:e.tx + 0.5, ty:e.ty + 0.5,
                     color:PALETTE.y, age:0, life:280 });
        ring(e.tx, e.ty, 1.5, PALETTE.y, 320);
        shake = Math.max(shake, 0.5);
        buzz([16, 8, 22]); sfx.crit();
        break;
      }
      case 'slam':
        ring(e.x, e.y, 1.7, PALETTE.W, 300);
        burstShards(e.x, e.y, [PALETTE.G, PALETTE.w], 16, 1.4);
        number(e.x, e.y - 0.6, '처박혔다', PALETTE.W, 1.1);
        shake = Math.max(shake, 0.55);
        break;

      case 'judgest':
        ring(e.tx, e.ty, 1.9, PALETTE.y, 380);
        beams.push({ fx:e.x + 0.5, fy:e.y - 1.2, tx:e.tx + 0.5, ty:e.ty + 0.5,
                     color:PALETTE.W, age:0, life:260 });
        flashScreen = Math.max(flashScreen, 0.3); flashHue = 'y';
        freeze = 80;
        shake = Math.max(shake, 0.6);
        buzz(36); sfx.crit();
        break;

      case 'storm':
        for (let i = 0; i < 3; i++) ring(e.x, e.y, 1.2 + i * 0.5, PALETTE.y, 300 + i * 90);
        burstShards(e.x, e.y, [PALETTE.y, PALETTE.W], 22, 1.3);
        shake = Math.max(shake, 0.5);
        buzz([20, 10, 20]); sfx.blast();
        break;

      case 'oathback':
        number(e.x, e.y - 1.1, `맹세 +${e.n}`, PALETTE.y, 1.15);
        ring(e.x, e.y, 0.9, PALETTE.y, 260);
        break;

      case 'crusade':
        ring(e.x, e.y, 2.2, PALETTE.W, 460);
        flashScreen = Math.max(flashScreen, 0.24); flashHue = 'W';
        break;

      case 'crusadeCut':
        beams.push({ fx:e.x + 0.5, fy:e.y + 0.5, tx:e.tx + 0.5, ty:e.ty + 0.5,
                     color:PALETTE.W, age:0, life:220, thin:true });
        ring(e.tx, e.ty, 1.1, PALETTE.y, 240);
        shake = Math.max(shake, 0.28 + e.n * 0.06);
        buzz(14);
        break;

      /* 신전에서 떨어져 나가는 것. Upward and pale — the one
         effect in the game that is a subtraction. */
      case 'cleanse':
        ring(e.x, e.y, 1.4, PALETTE.W, 460);
        burstShards(e.x, e.y, [PALETTE.W, PALETTE.y], 18, 1.2);
        number(e.x, e.y - 0.8, '떨어졌다', PALETTE.W, 1.1);
        break;

      /* 연막탄. Grey, low and wide — it has to read as cover
         rather than as a blast, because nothing in it took any
         damage. */
      case 'smoke': {
        for (let i = 0; i < 3; i++) ring(e.x, e.y, e.r * (0.5 + i * 0.3), PALETTE.g, 520 + i * 160);
        burstShards(e.x, e.y, [PALETTE.g, PALETTE.G, PALETTE.d], 26, 0.8);
        if (e.n) number(e.x, e.y - 0.7, `놓쳤다 ${e.n}`, PALETTE.G, 1.0);
        sfx.blast();
        break;
      }

      /* 사냥꾼의 몫. Quiet on purpose — it fires on most kills a
         ranger makes, so it gets a breath of green and nothing
         that competes with the kill it is riding on. */
      case 'quarry':
        if (e.hp > 0) number(e.x, e.y - 0.9, `+${e.hp}`, PALETTE.E, 0.85);
        ring(e.x, e.y, 0.7, PALETTE.E, 200);
        break;

      // 빗발 — many, from above, at once.
      case 'volley': {
        for (let i = 0; i < 10 && shards.length < MAX_SHARDS; i++) {
          const a2 = Math.random() * Math.PI * 2;
          shards.push({
            x: e.x + 0.5 + Math.cos(a2) * 2.2, y: e.y + 0.5 + Math.sin(a2) * 2.2 - 3,
            vx: 0, vy: 5 + Math.random() * 3,
            life: 300 + Math.random() * 200, age: 0, size: 1, color: PALETTE.y,
          });
        }
        ring(e.x, e.y, 3.2, PALETTE.y, 420);
        shake = Math.max(shake, 0.3 + (e.n || 0) * 0.05);
        buzz([16, 16, 16, 16]);
        sfx.crit();
        break;
      }

      case 'braceHit':
        beams.push({ fx: e.x, fy: e.y, tx: e.from.x, ty: e.from.y,
                     color: PALETTE.y, life: 160, age: 0, thin: true });
        break;

      // 마무리 — a column. Shards go straight up and the flash
      // comes straight down, and the whole thing scales with how
      // little the target has left.
      case 'finisher': {
        const p = 0.4 + (e.power || 0) * 0.9;
        for (let i = 0; i < 18 && shards.length < MAX_SHARDS; i++) {
          shards.push({
            x: e.tx + 0.5 + (Math.random() - 0.5) * 0.8, y: e.ty + 0.7,
            vx: (Math.random() - 0.5) * 1.1,
            vy: -(5.5 + Math.random() * 3.5) * p,
            life: 420 + Math.random() * 260, age: 0,
            size: Math.random() < 0.4 ? 2 : 1,
            color: Math.random() < 0.5 ? PALETTE.W : PALETTE.o,
          });
        }
        beams.push({ fx: e.tx, fy: e.ty - 4, tx: e.tx, ty: e.ty,
                     color: PALETTE.W, life: 220, age: 0 });
        ring(e.tx, e.ty, 1.2 + p, PALETTE.o, 380);
        flashScreen = Math.max(flashScreen, 0.35 * p); flashHue = 'W';
        freeze = Math.max(freeze, 70 * p);
        shake = Math.max(shake, 0.5 + p * 0.5);
        buzz([50, 30, 90]);
        sfx.crit();
        break;
      }

      /* 떨어진 것의 등급이 곧 연출의 크기다. 여태 평범한 단검과
         초월 무기가 똑같은 노란 고리 하나에 「전리품」 세 글자였다.
         등급은 규칙이 실어 보낸다(rar) — 여기서 다시 판정하면
         한쪽만 고쳐졌을 때 화면과 규칙이 갈린다. */
      case 'drop': {
        const g = Math.max(0, Math.min(4, e.rar ?? (e.relic ? 3 : 0)));
        const tone = RARE_TONE[g];
        const name = RARE_NAME[g];
        ring(e.x, e.y, 2.0 + g * 0.7, tone, 620 + g * 220);
        if (g >= 2) ring(e.x, e.y, 1.0 + g * 0.4, tone, 900 + g * 200, true);
        number(e.x, e.y - 0.5, name, tone, 1.2 + g * 0.22);
        /* 등급이 올라가면 조각이 튀고, 위쪽 둘은 화면까지 흔든다.
           고리 하나로는 「좋은 것이 떨어졌다」가 눈에 안 들어온다. */
        if (g >= 1) burstShards(e.x, e.y, [tone, PALETTE.W, tone], 6 + g * 6, 0.5 + g * 0.25);
        if (g >= 3) { shake = Math.max(shake, 0.25 + (g - 3) * 0.35); buzz(g >= 4 ? [40, 40, 120] : 40); }
        if (e.relic || g >= 3) sfx.relic(); else sfx.pick();
        break;
      }

      /* 주운 순간. 낙하는 「저기 뭔가 떨어졌다」고, 이쪽은 「그게
         내 것이 되었다」다 — 둘 다 있어야 손에 들어온 느낌이 난다.
         등급 카드가 같이 뜨므로 여기는 짧고 밝게. */
      case 'found': {
        const g = Math.max(0, Math.min(4, e.rar ?? 0));
        const tone = RARE_TONE[g];
        ring(e.x, e.y, 1.2 + g * 0.5, tone, 420, true);
        burstShards(e.x, e.y, [tone, PALETTE.W], 8 + g * 5, 0.7 + g * 0.2);
        if (g >= 3) shake = Math.max(shake, 0.2);
        break;
      }

      /* 손에 쥐는 순간. 몸에서 등급 색이 한 번 퍼진다 — 주운 것과
         든 것은 다른 사건이고, 둘 다 있어야 「이걸 쓰기로 했다」가
         한 동작으로 읽힌다. */
      case 'wield': {
        const g = Math.max(0, Math.min(4, e.rar ?? 0));
        const tone = RARE_TONE[g];
        ring(e.x, e.y, 1.4 + g * 0.45, tone, 480 + g * 120);
        if (g >= 2) burstShards(e.x, e.y, [tone, PALETTE.W], 6 + g * 4, 0.5 + g * 0.15);
        if (g >= 4) shake = Math.max(shake, 0.25);
        break;
      }

      // Breaking gear down: sparks, not fireworks.
      case 'salvage':
        for (let i = 0; i < 14 && shards.length < MAX_SHARDS; i++)
          shards.push({
            x: e.x + Math.random(), y: e.y + 0.5,
            vx: (Math.random() - 0.5) * 5, vy: -2.5 - Math.random() * 2.5,
            life: 520, age: 0, size: 1,
            color: Math.random() < 0.5 ? PALETTE.s : PALETTE.G,
          });
        shake = Math.max(shake, 0.2);
        buzz(18);
        break;

      /* The altar answering. The scale of the flash is the news:
         you know it was good before you read the log. */
      case 'altar': {
        const spec = {
          '대성공': { hue:'y', r:9, n:26, txt:'대성공', size:2.0, buzz:[40,40,40,40,120] },
          '성공':   { hue:'E', r:5, n:16, txt:'성공',   size:1.5, buzz:[25,35,60] },
          '허탕':   { hue:'g', r:2, n:6,  txt:'허탕',   size:1.2, buzz:20 },
          '재앙':   { hue:'R', r:8, n:24, txt:'재앙',   size:2.0, buzz:[80,60,80,60,160] },
        }[e.result] || { hue:'P', r:3, n:8, txt:'…', size:1.2, buzz:20 };
        ring(e.x, e.y, spec.r, PALETTE[spec.hue], 900);
        ring(e.x, e.y, spec.r * 0.55, PALETTE.W, 640);
        burstShards(e.x, e.y, [PALETTE[spec.hue], PALETTE.W], spec.n, 2.0);
        number(e.x, e.y - 0.9, spec.txt, PALETTE[spec.hue], spec.size);
        flashScreen = Math.max(flashScreen, e.result === '허탕' ? 0.2 : 0.7);
        flashHue = spec.hue;
        shake = Math.max(shake, e.result === '허탕' ? 0.2 : 0.75);
        freeze = Math.max(freeze, e.result === '허탕' ? 60 : 220);
        buzz(spec.buzz);
        if (e.result === '대성공') sfx.jackpot();
        else if (e.result === '재앙') sfx.bust();
        else sfx.tick(e.result === '성공' ? 10 : 2);
        break;
      }

      case 'spot':
        number(e.x, e.y - 0.3, '!', PALETTE.o, 1.1);
        ring(e.x, e.y, 1.2, PALETTE.o, 380);
        sfx.tick(6);
        break;
    }
  }
  queue.length = 0;
}

/* `hit` events carry a position, not a reference — look up the
   actor standing there so we can flash the right sprite. */
let monsterLookup = () => null;
export function bindLookup(fn) { monsterLookup = fn; }
const findByPos = e => monsterLookup(e.x, e.y);

/* ── simulation ─────────────────────────────────────────── */
export function update(dt, actors) {
  if (freeze > 0) { freeze -= dt; dt = Math.min(dt, 3); }   // hit-stop: near-still, never frozen solid

  const k = Math.min(1, dt / 16.7);

  for (const a of actors) {
    const s = track(a);
    s.ox *= Math.pow(0.62, k);
    s.oy *= Math.pow(0.62, k);
    s.lx *= Math.pow(0.55, k);
    s.ly *= Math.pow(0.55, k);
    if (Math.abs(s.ox) < 0.004) s.ox = 0;
    if (Math.abs(s.oy) < 0.004) s.oy = 0;
    s.flash = Math.max(0, s.flash - dt / 170);
    s.squash = Math.max(0, s.squash - dt / 190);
  }

  for (let i = shards.length - 1; i >= 0; i--) {
    const p = shards[i];
    p.age += dt;
    if (p.age >= p.life) { shards.splice(i, 1); continue; }
    const f = dt / 1000;
    p.x += p.vx * f;
    p.y += p.vy * f;
    if (p.float) p.vy *= Math.pow(0.94, k);
    else { p.vy += 11 * f; p.vx *= Math.pow(0.97, k); }
  }

  for (let i = numbers.length - 1; i >= 0; i--) {
    const n = numbers[i];
    n.age += dt;
    if (n.age >= n.life) { numbers.splice(i, 1); continue; }
    n.y += n.vy * dt;
    n.x += n.vx * dt;
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].age += dt;
    if (rings[i].age >= rings[i].life) rings.splice(i, 1);
  }

  for (let i = beams.length - 1; i >= 0; i--) {
    beams[i].age += dt;
    if (beams[i].age >= beams[i].life) beams.splice(i, 1);
  }

  for (let i = slashes.length - 1; i >= 0; i--) {
    slashes[i].age += dt;
    if (slashes[i].age >= slashes[i].life) slashes.splice(i, 1);
  }

  shake *= Math.pow(0.86, k);
  if (shake < 0.005) shake = 0;
  flashScreen *= Math.pow(0.88, k);
  if (flashScreen < 0.01) flashScreen = 0;
  vignette *= Math.pow(0.90, k);
  if (vignette < 0.01) vignette = 0;
}

/* ── queries used by the renderer ───────────────────────── */
export function offsetOf(actor) {
  const s = tracked.get(actor);
  return s ? { x: s.ox + s.lx, y: s.oy + s.ly, flash: s.flash, squash: s.squash } : ZERO;
}
const ZERO = { x: 0, y: 0, flash: 0, squash: 0 };

export const shakeVec = () => shake === 0
  ? ZERO
  : { x: (Math.random() - 0.5) * shake, y: (Math.random() - 0.5) * shake };

/* ── drawing ────────────────────────────────────────────── */
export function drawEffects(ctx, camX, camY, t) {
  const X = v => (v - camX) * t;
  const Y = v => (v - camY) * t;

  for (const b of beams) {
    const k = 1 - b.age / b.life;
    ctx.globalAlpha = k;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = Math.max(b.thin ? 1 : 2, t * (b.thin ? 0.07 : 0.18)) * (0.4 + k);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X(b.fx + 0.5), Y(b.fy + 0.5));
    ctx.lineTo(X(b.tx + 0.5), Y(b.ty + 0.5));
    ctx.stroke();
  }

  for (const r of rings) {
    const k = r.age / r.life;
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = Math.max(1.5, t * 0.12) * (1 - k);
    ctx.beginPath();
    /* A ring normally opens outward from where something landed.
       조준 사격 closes instead — the aim tightening onto a body
       reads as the opposite gesture, and it should. */
    const grow = r.shrink ? (1.1 - k * 0.95) : (0.15 + k * 0.95);
    ctx.arc(X(r.x), Y(r.y), r.maxr * t * grow, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* The swing itself. Each family gets its own sweep and reach,
     drawn as a thick stroked arc that thins as it fades. */
  const SWEEP = {
    dagger: { arc: 0.55, r: 0.62, w: 0.10, color: PALETTE.W },
    sword:  { arc: 1.25, r: 0.82, w: 0.13, color: PALETTE.W },
    axe:    { arc: 2.00, r: 0.95, w: 0.20, color: PALETTE.o },
    spear:  { arc: 0.28, r: 1.45, w: 0.12, color: PALETTE.B },
    mace:   { arc: 1.55, r: 0.80, w: 0.22, color: PALETTE.y },
    great:  { arc: 2.60, r: 1.10, w: 0.26, color: PALETTE.R },
  };
  for (const sl of slashes) {
    const k = 1 - sl.age / sl.life;
    const sp = SWEEP[sl.kind] || SWEEP.sword;
    ctx.save();
    ctx.globalAlpha = k * 0.9;
    ctx.strokeStyle = sp.color;
    ctx.lineWidth = Math.max(2, t * sp.w * (0.35 + k));
    ctx.lineCap = 'round';
    ctx.beginPath();
    // swept from one edge of the arc to the other as it ages
    const swept = sp.arc * (1 - k);
    ctx.arc(X(sl.x), Y(sl.y), sp.r * t,
            sl.a - sp.arc / 2 + swept * 0.35, sl.a - sp.arc / 2 + swept);
    ctx.stroke();
    ctx.restore();
  }

  const px = Math.max(1, Math.round(t / 8));
  for (const p of shards) {
    const k = p.age / p.life;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(X(p.x)), Math.round(Y(p.y)), px * p.size, px * p.size);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const n of numbers) {
    const k = n.age / n.life;
    ctx.globalAlpha = k > 0.65 ? (1 - k) / 0.35 : 1;
    const pop = k < 0.12 ? 1 + (0.12 - k) * 3 : 1;      // snap outward on birth
    const size = Math.max(11, t * 0.42 * n.size * pop);
    ctx.font = `900 ${size}px Galmuri11, ui-monospace, monospace`;
    ctx.lineWidth = Math.max(2, size * 0.22);
    ctx.strokeStyle = PALETTE.k;
    ctx.strokeText(n.text, X(n.x), Y(n.y));
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, X(n.x), Y(n.y));
  }
  ctx.globalAlpha = 1;
}

export function drawScreenFlash(ctx, w, h, hurt = 0) {
  /* Being *at* low health, not being hit. The old vignette
     flashed on damage and decayed in half a second, so walking
     around at fifteen percent looked exactly like walking around
     at full — and the number is in the corner, where nobody is
     looking during a fight.

     A slow breath, not a strobe: this has to be readable at a
     glance and survivable for a hundred turns. */
  if (hurt > 0) {
    const beat = 0.5 + 0.5 * Math.sin(performance.now() / (420 - hurt * 140));
    const a = (0.16 + hurt * 0.30) * (0.62 + beat * 0.38);
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.20,
                                       w / 2, h / 2, Math.max(w, h) * 0.66);
    g.addColorStop(0, 'rgba(143,47,40,0)');
    g.addColorStop(1, `rgba(143,47,40,${a.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  /* The edges first: damage reads as the screen closing in,
     which leaves the board visible in the middle where the
     player has to keep making decisions. */
  if (vignette > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28,
                                       w / 2, h / 2, Math.max(w, h) * 0.62);
    g.addColorStop(0, 'rgba(143,47,40,0)');
    g.addColorStop(1, `rgba(143,47,40,${(vignette * 0.62).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (flashScreen <= 0) return;
  ctx.globalAlpha = flashScreen * 0.5;
  ctx.fillStyle = PALETTE[flashHue] || PALETTE.W;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

export function reset() {
  shards.length = 0; numbers.length = 0; rings.length = 0; beams.length = 0;
  slashes.length = 0; vignette = 0;
  shake = 0; freeze = 0; flashScreen = 0;
}
