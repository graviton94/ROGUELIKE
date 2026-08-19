/* ═══════════════════════════════════════════════════════════
   juice.js — the layer between "what happened" and "how hard
   it lands". game.js emits typed events into G.fx; nothing in
   here ever changes a rule. Everything is time-based, so a
   player holding a direction down never queues up a backlog
   of animations — the world just keeps up.
   ═══════════════════════════════════════════════════════════ */

import { PALETTE, spriteColors } from './pixels.js';
import { EYE_TEX, FLESH_TEX, VEIN_TEX, HAND_TEX, FACE_TEX, LIMBS, SIGIL_TEX, HERALD_TEX } from './horror.js';
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

/* ── 시간 ──────────────────────────────────────────────────
   플레이어: 「스킬이 너무 전부 즉시시전 아님? 강한 스킬이나 치명타는
   슬로우 모션 이후 빨리감기 + 이펙트 몰아서 표현이나, 컷신 같은
   효과나 줌인이나…」

   히트스톱(freeze)은 있었는데 **배속이 없었다.** 멈췄다가 원속으로
   돌아오면 그건 「끊긴 것」이지 슬로우모션이 아니다. 늘어졌다가
   당겨져야 한 방이 무거워 보인다. 네 마디로 돈다:

     정지(freeze) → 늘어짐(slow) → 빨리감기(snap) → 원속

   빨리감기가 마지막에 있는 이유는 **밀린 이펙트를 몰아 주기** 위해서다.
   늘어지는 동안 파편과 고리는 제자리에 가까이 머물고, 당겨질 때 한꺼번에
   흩어진다 — 그것이 「이펙트 몰아서」의 실제 모양이다. */
let slowLeft = 0, slowRate = 1, snapLeft = 0;
const SNAP_MS = 160, SNAP_RATE = 1.4;

/* ── 렌즈 하나, 두 가지 이유 ──────────────────────────────
   죽을 때만 열리던 카메라다. 궁극기도 같은 카메라를 쓴다 — 다만
   **짧고, 어둡게 하지 않는다.** 죽음은 판이 끝나는 순간이라 색이
   빠져야 하고, 궁극기는 판이 계속되는 순간이라 안 빠져야 한다.
   그리고 죽음의 렌즈는 조이고 멎지만 이건 들어갔다 **나온다** —
   나오지 않으면 그건 연출이 아니라 고장이다. */
let punchT = 0, punchAt = null, punchK = 0;
const PUNCH_MS = 440;

/* 카메라가 읽는 자리. 죽음이 있으면 죽음이 이긴다 — 판이 끝나는
   순간에 궁극기 줌이 섞이면 둘 다 안 읽힌다. */
export function lens() {
  const d = deathLens();
  if (d) return d;
  if (punchT <= 0 || !punchAt) return null;
  const t = 1 - punchT / PUNCH_MS;
  return { k: 1 + punchK * Math.sin(Math.min(1, t) * Math.PI), at: punchAt, dim: 0 };
}

/* ── 뒤틀림 ────────────────────────────────────────────────
   DESIGN.md §3. 화면이 얼마나 잘못됐는가 — 0에서 1까지.

   이 문 하나가 뒤에 오는 것 전부를 받는다: 신앙심(내려갈수록 짙어진다),
   이물 층(규칙이 통째로 다른 층), 광신(70 위). 셋이 각자 화면을 뒤틀면
   세 가지 다른 기괴함이 생기고, 그러면 그건 문법이 아니라 잡음이다.

   **글리치는 팔레트 안에서 한다.** 새 색을 안 만든다 — 26색이 이
   게임의 얼굴이고, 뒤틀림이 그 얼굴을 바꾸면 뒤틀린 게 아니라 다른
   게임이 된다.

   네 표현이 순서대로 열린다. 한꺼번에 열면 35에서 이미 다 보여서
   70이 아무 말도 못 한다:

     0.00–0.35  아무 일도 없다
     0.35–0.55  잔상 — 이전 프레임이 한 겹 남는다
     0.55–0.70  + 색 분리 — 붉은 쪽과 푸른 쪽이 어긋난다
     0.70–1.00  + 찢김과 오독 — 줄이 밀리고, 타일이 딴 것으로 보인다

   마지막의 **오독이 가장 값싸고 가장 무섭다.** 규칙은 안 바뀐다 —
   벽은 여전히 벽이고 지나갈 수 없다. 눈만 속는다. */
let warp = 0;
export function setWarp(v) { warp = Math.max(0, Math.min(1, v || 0)); }
export const warpAt = () => warp;
/* 그리는 쪽이 읽는 자리. juice 는 무엇을 그릴지 모르고 「얼마나
   잘못됐나」만 안다 — deathLens 와 같은 계약이다. */
export function warpLens() {
  if (warp < 0.35) return null;
  const t = (warp - 0.35) / 0.65;                  // 0..1 로 다시 편다
  return {
    ghost:   Math.min(0.30, 0.10 + t * 0.24),      // 잔상 진하기
    split:   warp >= 0.55 ? Math.round(1 + t * 2) : 0,   // 색 분리 픽셀
    tear:    warp >= 0.70 ? Math.round(1 + t * 3) : 0,   // 찢김 픽셀
    misread: warp >= 0.70 ? (warp - 0.70) / 0.30 * 0.12 : 0,  // 타일이 딴 것으로
  };
}

/* ── 연출 등급 ────────────────────────────────────────────
   스킬마다 연출을 따로 짜면 스물넷이 각자 다른 말을 한다. 등급을
   정해 두면 스킬을 설계할 때 「이건 몇 등급」 한 줄이면 끝나고,
   화면은 한 가지 문법만 말한다.

   죽음 줄은 여기 없다 — 그건 판이 끝나는 순간이라 규칙이 다르고,
   이미 제 자리(openLens)를 갖고 있다. */
const BEAT = {
  /* 치명타 · 기본 기예. 자주 터지므로 슬로우가 없다 — 매번 늘어지면
     세 번째 판부터는 연출이 아니라 지연이다. */
  hit: { freeze: 70,  shake: 0.30, flash: 0.12 },
  /* 직업특화 기예. 늘어지되 카메라는 안 움직인다. */
  sig: { freeze: 110, shake: 0.45, flash: 0.20, slow: [0.45, 260] },
  /* 궁극기. 늘어졌다 당겨지고, 그동안 카메라가 그 자리로 들어갔다 나온다. */
  ult: { freeze: 180, shake: 0.70, flash: 0.34, slow: [0.30, 320], zoom: 0.25 },
};
/* 시간이 지금 어느 마디에 있는가. 밖에서 읽을 자리가 없으면 배속을
   **간접**으로 잴 수밖에 없는데, 흔들림은 난수 지터라 순간 크기가
   널뛴다 — 그걸로 쟀다가 궁극기가 「2프레임」으로 찍혔다. 상태를
   그냥 내준다. deathHolding()·shakeVec()·lens() 와 같은 종류의 창이다. */
export const timeState = () =>
  ({ freeze, slowLeft, slowRate, snapLeft, punchT });

export function beat(grade, at, hue = 'W') {
  const b = BEAT[grade];
  if (!b) return;
  freeze = Math.max(freeze, b.freeze);
  shake = Math.max(shake, b.shake);
  if (b.flash) { flashScreen = Math.max(flashScreen, b.flash); flashHue = hue; }
  /* 겹치면 **더 느린 쪽**이 이긴다. 궁극기 중에 평타가 들어와서
     슬로우를 풀어 버리면 그 한 방이 통째로 날아간다. */
  if (b.slow) { slowRate = Math.min(slowRate, b.slow[0]); slowLeft = Math.max(slowLeft, b.slow[1]); }
  if (b.zoom && at && Number.isFinite(at.x)) { punchAt = at; punchK = b.zoom; punchT = PUNCH_MS; }
}

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
  if (e.t === 'proclaim') return proclaimFx(e);
  if (e.t === 'deathZoom') return openLens(e);
  if (e.t === 'crack') return crackBurst(e);
  if (e.t === 'vanishOut') return vanishBurst(e);
  if (e.t === 'martyr' || e.t === 'martyrHold') return martyrFx(e, e.t === 'martyr');
  return breakFx(e);
}

/* 이 판이 무엇인지 선언하는 순간. 화면 전체가 한 번 물든다 — 유물이나
   크랙과 달리 이건 **내 몸이 아니라 세계**에 일어난 일이다. 아르카나를
   고를 때 쓰던 연출인데, 아르카나를 지운 지금은 이물의 층을 밟았을 때
   그 이름을 선언한다. 이름을 옮긴 이유가 그것이다. */
function proclaimFx(e) {
  const p = G.player;
  if (!p) return;
  for (let i = 0; i < 3; i++)
    ring(p.x, p.y, 2.2 + i * 1.6, i % 2 ? PALETTE.p : PALETTE.P, 700 + i * 200);
  number(p.x, p.y - 1.1, e.n || '이물', PALETTE.P, 1.4);
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
  if (e.t === 'hushCut') return hushCutFx(e);
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
/* 칼부채(fanOutFx)가 있던 자리. 기예가 없어졌으므로 프레임도 지운다 —
   아무도 안 띄우는 case 는 다음 사람이 「어딘가 쓰이는 것」으로 읽는다.

   숨 끊기: 짧은 한 줄과 글자 하나. 급소와 같은 문(vitals)을 쓸 수는
   없다 — 저쪽은 화면에 「급소」라고 쓰므로, 빌려 쓰면 숨 끊기를 눌러도
   급소라고 적힌다. 등급은 §4의 특화(정지 110ms)다. */
/* 심판의 일격. pump 밖으로 뺀 이유는 매듭 린트다 — pump 는 이미
   「해체 순서」 맨 위이고(복잡도 172 · 849줄), 성전이 돌려보낸 판결을
   갈래 하나로 얹으면서 기준선 네 줄을 다 넘겼다. 얹은 것보다 조금 더
   뺀다: 기준선을 올리려면 이유를 적어야 하고, 여기서 댈 이유는 「기예를
   하나 더했다」뿐이라 그건 이유가 아니다. */
/* 마력 장벽. 고리 하나가 서고 **머문다** — 다섯 턴짜리 상태이므로
   한 번 번쩍이고 마는 그림이면 「지금 서 있는가」를 화면이 말하지
   않는다. 그래서 고리를 겹으로 세 개 깔아 남기고, 이미 안에 갇힌
   것이 있으면 그 수를 적는다(늦게 누른 판에서 이 주문이 안 통했다고
   읽히면 안 된다). 깨질 때는 붉게 한 번. */
function wardFx(e) {
  for (let i = 0; i < 3; i++)
    ring(e.x, e.y, 1.5 + i * 0.22, PALETTE.B, 900 + i * 260);
  number(e.x, e.y - 1.0, e.n ? `봉했다 · 안에 ${e.n}` : '봉했다', PALETTE.B, 1.2);
  freeze = Math.max(freeze, 90);
  buzz([20, 40, 20]); sfx.warn();
}
function wardBreakFx(e) {
  ring(e.x, e.y, 1.6, PALETTE.R, 380);
  burstShards(e.x, e.y, [PALETTE.B, PALETTE.R, PALETTE.W], 22, 1.5);
  number(e.x, e.y - 1.0, '깨졌다', PALETTE.R, 1.3);
  flashScreen = Math.max(flashScreen, 0.26); flashHue = 'R';
  shake = Math.max(shake, 0.46);
  buzz([44, 20, 44]); sfx.crit();
}

/* 십자. 고리가 아니라 **네 개의 선**이다 — 고리를 하나 더 그리면
   서리 폭발·말씀·연막과 같은 그림이 되고, 이 기예가 방을 상대하는
   방식이 원이 아니라 십자라는 것이 화면에서 사라진다. 팔이 멀수록
   얇아지는 규칙이 있으므로 선도 끝으로 갈수록 옅게 — 보이는 것이 곧
   맞는 값이어야 한다.
   `pump` 의 가지가 아니라 함수인 이유는 매듭 린트다(§3): 저 스위치는
   이미 갈래 82에 복잡도 174이고, 새 그림은 제 함수를 갖는다. */
function crusadeCrossFx(e) {
  const arm = e.r || 4;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    beams.push({ fx: e.x + 0.5, fy: e.y + 0.5,
                 tx: e.x + 0.5 + dx * arm, ty: e.y + 0.5 + dy * arm,
                 color: PALETTE.W, age: 0, life: 300 });
    beams.push({ fx: e.x + 0.5, fy: e.y + 0.5,
                 tx: e.x + 0.5 + dx * (arm * 0.55), ty: e.y + 0.5 + dy * (arm * 0.55),
                 color: PALETTE.y, age: 0, life: 220 });
  }
  ring(e.x, e.y, 1.1, PALETTE.y, 280);
  burstShards(e.x, e.y, [PALETTE.W, PALETTE.y], 20, 1.3);
  if (e.n) number(e.x, e.y - 1.1, `판결 ${e.n}`, PALETTE.W, 1.15);
  flashScreen = Math.max(flashScreen, e.n ? 0.3 : 0.16); flashHue = 'y';
  freeze = Math.max(freeze, e.n ? 90 : 40);
  shake = Math.max(shake, e.n ? 0.5 : 0.2);
  buzz(e.n ? [28, 10, 28] : 14); sfx.crit();
}

/* 성전이 돌려보낸 판결에 흰 고리를 한 겹 더 붙이던 가지가 여기
   있었다. 성전이 십자가 되면서 그쪽은 제 프레임을 갖게 됐고
   (`crusadeCross`), 이 함수는 다시 손이 누른 한 대만 그린다 —
   `e.crusade` 를 보내는 자리가 하나도 없는 채로 가지를 남겨 두면
   그 가지는 「있는데 안 나가는 그림」이 된다. */
function judgestFx(e) {
  ring(e.tx, e.ty, 1.9, PALETTE.y, 380);
  beams.push({ fx:e.x + 0.5, fy:e.y - 1.2, tx:e.tx + 0.5, ty:e.ty + 0.5,
               color:PALETTE.W, age:0, life:260 });
  flashScreen = Math.max(flashScreen, 0.3); flashHue = 'y';
  freeze = 80;
  shake = Math.max(shake, 0.6);
  buzz(36); sfx.crit();
}
function hushCutFx(e) {
  beams.push({ fx: e.x + 0.5, fy: e.y + 0.5, tx: e.tx + 0.5, ty: e.ty + 0.5,
               color: PALETTE.p, age: 0, life: 150, thin: true });
  slashes.push({ x: e.tx + 0.5, y: e.ty + 0.5,
                 a: Math.atan2(e.ty - e.y, e.tx - e.x), kind: 'dagger', age: 0, life: 170 });
  number(e.tx, e.ty - 0.6, e.killed ? '끊었다' : '숨', e.killed ? PALETTE.P : PALETTE.g, 1.1);
  freeze = Math.max(freeze, 110);
  shake = Math.max(shake, e.killed ? 0.28 : 0.14);
  buzz(e.killed ? [24, 12, 24] : 12); sfx.roll();
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
/* ── 주문마다 제 그림 ──────────────────────────────────────
   플레이어: 「아이템이나 주문 임펙트, 특히 주문의 효과가 너무 구림.」

   숫자는 약하지 않았다 — 주문 한 방이 평타의 4~7배다. 약한 것은
   화면이었다. 피해 주문 셋이 전부 같은 선 하나에 색만 달랐고,
   나머지 다섯은 아무 프레임도 없었다 — 점멸은 그냥 순간이동했고,
   축복은 로그 한 줄이 전부였다.

   이건 **시전 프레임**이다: 주문이 나가는 순간의 그림. 맞은 자리의
   그림(beam·burst)은 그대로 두고 그 앞에 선다. 그래서 「내가 무엇을
   했나」와 「그것이 무엇에 닿았나」가 화면에서 갈린다.

   기예와 같은 문 뒤에 둔다 — pump 는 이미 이 저장소에서 가장 굵은
   함수이고, 주문 여덟에 case 를 여덟 개 얹으면 아무도 못 연다. */
function spellFx(e) {
  const holy = e.realm === 'divine';
  const C = holy ? PALETTE.y : PALETTE.P;      // 신성은 금빛, 비전은 보랏빛
  const C2 = holy ? PALETTE.W : PALETTE.p;
  switch (e.id) {
    /* 손에서 모였다가 튀어 나간다. 모이는 쪽을 그리는 것이 핵심이다 —
       선만 있으면 「어디선가 선이 나왔다」이고, 모임이 있으면
       「내가 쐈다」가 된다. */
    case 'bolt': {
      ring(e.x, e.y, 1.4, C, 240, true);       // 손으로 오므라드는 고리
      burstShards(e.x, e.y, [C, C2], 8, 0.7);
      if (e.tx !== undefined) {
        /* 굵은 줄 하나에 얇은 줄 둘 — 한 줄이면 가늘고, 셋이면 굵다. */
        for (let i = 0; i < 3; i++)
          beams.push({ fx: e.x + 0.5, fy: e.y + 0.5, tx: e.tx + 0.5, ty: e.ty + 0.5,
                       color: i ? C2 : C, age: -i * 24, life: 240, thin: i > 0 });
      }
      shake = Math.max(shake, holy ? 0.34 : 0.26);
      buzz(holy ? [30, 14, 40] : [22, 10, 26]);
      sfx.crit();
      break;
    }
    /* 얼음은 안쪽에서 바깥으로 밀려 나간다. 고리 셋이 시차를 두고
       퍼지고, 그 뒤에 붙는 burst 가 실제 사거리를 그린다. */
    case 'frost': {
      for (let i = 0; i < 3; i++)
        ring(e.x, e.y, 1.6 + i * 1.5, PALETTE.B, 300 + i * 120);
      burstShards(e.x, e.y, [PALETTE.B, PALETTE.W, PALETTE.b], 22, 1.5);
      flashScreen = Math.max(flashScreen, 0.22); flashHue = 'b';
      freeze = Math.max(freeze, 70);
      shake = Math.max(shake, 0.4);
      buzz([44, 24, 44]); sfx.crit();
      break;
    }
    /* 점멸은 **두 곳**에서 일어난다 — 그림자 도약이 그랬듯이. 여기서는
       떠나는 자리만 그린다(도착 자리는 규칙이 옮긴 뒤라 좌표가 없다). */
    case 'blink': {
      ring(e.x, e.y, 1.5, PALETTE.P, 320, true);
      burstShards(e.x, e.y, [PALETTE.P, PALETTE.p, PALETTE.k], 12, 1.1);
      buzz([12, 8, 20]); sfx.roll();
      break;
    }
    /* 층을 훑는다. 넓고 얇은 고리 셋 — 피해가 없으니 파편도 없다. */
    case 'detect': case 'map': {
      for (let i = 0; i < 3; i++)
        ring(e.x, e.y, 3 + i * 3.2, C2, 420 + i * 160);
      number(e.x, e.y - 0.9, e.id === 'map' ? '지형' : '감지', C2, 1.0, true);
      sfx.levelup();
      break;
    }
    /* 몸으로 스며든다 — 바깥에서 안으로 오므라드는 고리. 치유와
       축복이 같은 방향인 것은 둘 다 「받는」 주문이기 때문이다. */
    case 'cure': case 'heal': {
      ring(e.x, e.y, e.id === 'heal' ? 2.6 : 1.8, PALETTE.g, 380, true);
      burstShards(e.x, e.y, [PALETTE.g, PALETTE.W], e.id === 'heal' ? 16 : 9, 0.9);
      flashScreen = Math.max(flashScreen, e.id === 'heal' ? 0.18 : 0.10); flashHue = 'g';
      sfx.heal();
      break;
    }
    /* 축복(bless)이 여기 있었다. 사제·팔라딘의 유틸 넷을 §4의 표대로
       채우면서 잘려 나갔다 — 여덟 칸에 버프 칸이 없다. 아무도 안 띄우는
       프레임은 다음 사람이 「어딘가 쓰이는 것」으로 읽으므로 지운다. */
    /* ── 비전 폭주 ────────────────────────────────────────
       통을 태우는 것이므로 **모이는 프레임이 없다** — 화살과 응징은
       손으로 오므라들고, 이것은 처음부터 바깥으로만 간다. 고리 다섯이
       한꺼번에 나가고(서리는 셋이 시차를 두고 나간다) 화면이 통째로
       한 번 하얘진 뒤 보랏빛으로 식는다.
       궁극기의 등급을 §4의 표에서 그대로 가져온다: 정지 180ms ·
       늘어짐 320ms. freeze 를 서리(70)의 두 배 넘게 두는 자리다. */
    case 'surge': {
      for (let i = 0; i < 5; i++)
        ring(e.x, e.y, 1.2 + i * 2.1, i % 2 ? PALETTE.W : PALETTE.P, 300 + i * 90);
      burstShards(e.x, e.y, [PALETTE.P, PALETTE.p, PALETTE.W, PALETTE.k], 34, 2.2);
      flashScreen = Math.max(flashScreen, 0.5); flashHue = 'p';
      freeze = Math.max(freeze, 180);
      shake = Math.max(shake, 0.75);
      number(e.x, e.y - 1.1, '폭주', PALETTE.P, 1.5, true);
      buzz([70, 40, 90]); sfx.crit();
      break;
    }
    /* 갈라짐 — 하나가 둘이 된 자리. 고리 하나로는 「맞았다」로 읽히
       므로 둘을 어긋나게 겹친다. */
    case 'split': {
      ring(e.x - 0.35, e.y, 1.1, PALETTE.E, 300, true);
      ring(e.x + 0.35, e.y, 1.1, PALETTE.e, 300, true);
      burstShards(e.x, e.y, [PALETTE.E, PALETTE.e], 8, 0.8);
      buzz([14, 10, 14]); sfx.crit();
      break;
    }
    default:
      ring(e.x, e.y, 1.4, C, 260, true);
      sfx.crit();
  }
  /* 잔향이 실려 있으면 한 겹 더. 마법사의 축이 화면에 안 보이면
     그건 로그에만 있는 축이다. */
  if (e.echo) ring(e.x, e.y, 2.2, PALETTE.W, 300);
}

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
  if (e.t === 'penance') {
    /* 말씀이 있던 자리. 저것은 소리가 퍼지고 멈추는 그림이라 파편이
       없었는데, 이쪽은 곁을 때리므로 파편이 있다 — 그리고 고리는
       한 칸까지만 간다. 보이는 것이 곧 닿는 곳이어야 한다. */
    for (let i = 0; i < 2; i++)
      ring(e.x, e.y, 1.0 + i * 0.5, PALETTE.W, 340 + i * 140);
    burstShards(e.x, e.y, [PALETTE.W, PALETTE.y, PALETTE.R], 16, 1.2);
    number(e.x, e.y - 0.8, e.n ? `무릎 ${e.n}` : '무릎', PALETTE.W, 1.25);
    freeze = Math.max(freeze, 110);
    shake = Math.max(shake, 0.34);
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
          /* 치명타는 「한 대」 등급이다. 여태 여기서 손으로 freeze 와
             flash 를 적고 있었는데, 같은 무게의 다른 사건들과 숫자가
             제각각이었다 — 등급을 지나게 하면 한 곳에서 바뀐다. */
          if (big) { beat('hit', { x: e.x, y: e.y }, 'y'); ring(e.x, e.y, 1.6, PALETTE.y); }
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

      /* 시전 프레임. 맞은 자리의 그림(beam·burst)보다 **먼저** 온다 —
         규칙 쪽에서 그 순서로 띄운다. */
      case 'spellCast': spellFx(e); break;

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
         참회는 나를 중심으로 곁으로, 성흔은 표적에서 곁으로. */
      case 'repay': case 'penance': case 'stigma': case 'stigmaBurst':
        priestFx(e); break;
      case 'proclaim': case 'deathZoom': case 'crack': case 'vanishOut':
      case 'brace': case 'kite': case 'bulwark':
      case 'martyr': case 'martyrHold': bigFx(e); break;
      case 'stepIn': case 'hushCut': case 'vitals': case 'flurry': artFx(e); break;
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

      case 'judgest': judgestFx(e); break;

      case 'storm':
        for (let i = 0; i < 3; i++) ring(e.x, e.y, 1.2 + i * 0.5, PALETTE.y, 300 + i * 90);
        burstShards(e.x, e.y, [PALETTE.y, PALETTE.W], 22, 1.3);
        shake = Math.max(shake, 0.5);
        buzz([20, 10, 20]); sfx.blast();
        break;

      case 'oathback':
        number(e.x, e.y - 1.1, `+${e.n}`, PALETTE.y, 1.15);
        ring(e.x, e.y, 0.9, PALETTE.y, 260);
        break;

      /* crusadeCut 이 있던 자리. 행진하며 베던 기예가 상태가 됐고,
         그다음 십자가 됐다 — 그림은 crusadeCrossFx 에 있다. */
      case 'crusadeCross': crusadeCrossFx(e); break;
      case 'ward': wardFx(e); break;
      case 'wardBreak': wardBreakFx(e); break;

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
  /* ── 정지 → 늘어짐 → 빨리감기 → 원속 ──────────────────────
     세 마디 다 **실제 시간**으로 줄고, 애니메이션에 건네는 dt만
     늘렸다 줄인다. 남은 시간까지 배속으로 깎으면 늘어질수록 슬로우가
     짧아져서 배율을 올린 만큼 효과가 사라진다. */
  if (punchT > 0) punchT -= dt;
  if (freeze > 0) { freeze -= dt; dt = Math.min(dt, 3); }   // hit-stop: near-still, never frozen solid
  else if (slowLeft > 0) {
    slowLeft -= dt; dt *= slowRate;
    if (slowLeft <= 0) { snapLeft = SNAP_MS; slowRate = 1; }
  } else if (snapLeft > 0) { snapLeft -= dt; dt *= SNAP_RATE; }

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
  /* 시간과 렌즈도 같이 푼다 — 층을 넘어가는데 슬로우가 남아 있으면
     다음 층이 느리게 시작한다. */
  slowLeft = 0; slowRate = 1; snapLeft = 0; punchT = 0; punchAt = null;
  warp = 0;
}

/* ═══ 이물의 층 — 화면 전체 ═══════════════════════════════
   플레이어: 「진짜로 그냥 개 불쾌해야함. 벽에 다 눈알을 박고, 벽에
   팔다리가 박혀있고, 갑자기 손이 화면을 뒤덮고(깜짝 놀래키기), 바닥에
   얼굴가죽이 널려있고… 갑자기 일루미나티같은 도형과 눈알이 배경에
   프랙탈 반복되고. 니가 말한 바닥은 이래서 안되고 배경은 이래서
   안되고… 그런 상식 다 좆 까버리라고 하고 디자인하란 말이야.」

   맞다. 이 게임의 다른 모든 곳에서 지키는 규칙 — 「바닥은 조용해야
   한다」, 「배경이 배우를 덮으면 안 된다」, 「매 턴 칠하는 물감이 되면
   안 된다」 — 은 **던전**의 규칙이다. 이물은 던전이 아니다. 열 판에
   한 번 볼까 말까 한 사고이고, 봤다는 사실이 그 판의 이야기가 되어야
   하므로, 여기서는 그 규칙 전부를 일부러 어긴다: 화면을 덮고, 배우를
   가리고, 매 프레임 움직이고, 예고 없이 놀래킨다.

   타일 쪽은 pixels.js 의 STRANGE_ART 가 맡는다(팔로 쌓은 벽 · 얼굴가죽
   바닥 · 젖은 눈알). 여기는 **타일이 못 하는 것**만 한다 — 화면 전체를
   덮는 것, 플레이어를 쫓는 것, 갑자기 튀어나오는 것, 프랙탈로 겹치는 것.

   비용은 프리미티브만 쓴다(호·경로·사각형). 폰에서 매 프레임 도는
   자리이므로 픽셀 루프는 지지직 한 곳뿐이고 그것도 슬라이스 복사다. */
const now = () => performance.now();
let strangeId = null, scareAt = 0, scareTill = 0, strangeT0 = 0;
/* 층에 들어설 때 한 번. 여기서 시계를 리셋해야 「전 층의 놀램」이
   새 층 첫 프레임에 터지지 않는다. */
/* 놀램 한 번의 길이. **한 곳에서만 적는다** — 들어설 때는 900,
   그 뒤로는 420으로 서로 다르게 적어 두었더니 들어서는 순간의 놀램이
   `1 - (남은시간/420)` 에서 음수가 되어 **아예 안 그려졌다.** 화면에
   나와야 할 것이 안 나오는데 아무도 안 울었다. */
const SCARE_MS = 520;
export function strangeEnter(id) {
  strangeId = id || null;
  strangeT0 = now();
  scareTill = id ? now() + SCARE_MS : 0;   // 들어서는 순간 한 번 덮는다
  scareAt = id ? now() + 6000 + Math.random() * 9000 : 0;
}
/* ── 8비트 규칙을 여기서만 깬다 ────────────────────────────
   플레이어: 「실사 3d그래픽을 격자화 한 도트 그래픽으로, 8비트 룰을
   어기고 만들어주는게 더 극적인 호러 이펙트를 가져올 수 있겠다.」

   그렇다. 이 게임의 그림은 스물여섯 색 팔레트와 8×8 격자로 서 있고,
   그 규칙이 만드는 것은 「오래된 게임」이라는 안심이다. 호러는 그
   안심을 깨야 한다 — 그래서 이물의 레이어만 **팔레트 밖의 연속 계조**로
   그린다: 살의 표면산란, 젖은 하이라이트, 안구의 각막 반사, 사진처럼
   부드러운 음영. 팔레트에 없는 색이고, 이 게임 어디에도 없는 계조다.

   그리고 그것을 **격자에 가둔다.** 132칸 버퍼에 그려서 보간 없이
   확대하면 공간이 격자화되고, 아래 `digitise()` 가 계조를 열두 단으로
   눌러 색까지 격자화한다. 실사를 스캔해서 도트로 옮긴 것 —
   매끈한 벡터도 아니고 순수한 8비트도 아닌, 그 사이의 불쾌한 자리다.

   비용: 132×285 ≈ 3.8만 픽셀 한 번. 이물 층에서만 돈다. */
const LEVELS = 12;
function digitise(cx, lw, lh) {
  const img = cx.getImageData(0, 0, lw, lh), d = img.data;
  const q = 255 / (LEVELS - 1);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    /* 흩뿌리기 — 순수 계단으로 누르면 띠가 보이고, 띠는 「저해상도」가
       아니라 「망가진 그라디언트」로 읽힌다. 스캔한 것처럼 만든다. */
    const n = ((i * 2654435761) >>> 13) % 7 - 3;
    for (let k = 0; k < 3; k++)
      d[i + k] = Math.max(0, Math.min(255, Math.round((d[i + k] + n) / q) * q));
    d[i + 3] = d[i + 3] > 210 ? 255 : Math.round(d[i + 3] / 64) * 64;
  }
  cx.putImageData(img, 0, 0);
}
/* ── 사진 격자를 색 램프에 태워 한 번만 굽는다 ─────────────
   격자 한 칸씩 fillRect 하면 눈 아홉 개에 2만 번이 된다. 그래서 격자를
   **제 크기 캔버스에 한 번 굽고**, 그린 뒤에는 보간을 끈 drawImage 한
   번으로 쓴다 — 확대해도 칸이 각지게 남는다.
   램프는 팔레트 밖이다(§ 여기서만 스물여섯 색을 깬다). */
const RAMP = {
  flesh: ['#17070a','#260c10','#3a1216','#4f1a1c','#6a2a26','#853a30','#9e4d3c',
          '#b3654c','#c48160','#d29a78','#dcb192','#e6c4a8','#eed4bc','#f4e0cd','#faebdc','#fff6ee'],
  eye:   ['#1b0305','#340708','#520e0c','#6f1810','#8c2a16','#a63f1e','#bd5a2c',
          '#cf7440','#dd8f58','#e8a973','#f0c190','#f5d5ac','#f9e4c6','#fcefdc','#fef7ec','#fffdf8'],
  /* 얼굴은 채도가 거의 없는 사진이다 — 살 램프에 태우면 분홍 덩어리가
     되고, 이 사진의 힘은 **창백한 피부와 새까만 눈구멍의 대비**다.
     그래서 차가운 시체 램프로 태운다: 검정에서 뼈 흰색까지, 붉은기 없이.
     아래끝을 거의 검게 두어야 눈구멍과 벌린 입이 구멍으로 읽힌다. */
  corpse:['#000000','#050507','#0b0b0e','#131316','#1d1d21','#2a2a2f','#3a3a40',
          '#4d4d53','#616168','#76767d','#8c8c93','#a2a2a8','#b7b7bc','#cacace','#dcdcdf','#ececed'],
  /* 손은 사진이라 밝은 쪽 값이 많다. 살 램프를 그대로 태우면 위쪽이
     인쇄용지처럼 하얘진다 — 죽은 살이지 종이가 아니므로 윗단을 눌러
     회색 도는 창백함에서 멈춘다. */
  /* 안구는 사진이다. 흰자와 홍채는 밝기가 거의 안 겹치므로(홍채 평균
     94, 흰자 평균 203) 램프 하나로 둘 다 낼 수 있다 — 아래쪽 절반은
     차가운 파랑, a부터는 붉은기 없는 뼈색. 따뜻한 램프로 태워 봤더니
     주황 구슬이 되어 눈으로 안 읽혔다. */
  eyeball:['#000000','#04060b','#0a1018','#101c2a','#17293c','#1f374e','#2c4557',
          '#3a5566','#4c6672','#63787e','#8a9088','#a3a79c','#bcbdaf','#d0cfc0','#e2e0d0','#f4f1e4'],
  /* 표는 흰 종이에 검은 잉크로 찍힌 판화다. 어두운 화면에 그대로
     얹으면 안 보이므로 **잉크 세기를 밝기로 뒤집어** 태운다 —
     진한 잉크가 제일 밝은 금색이 된다. 종이는 아예 안 칠한다. */
  sigil: ['#0e0a03','#140e04','#1a1205','#211706','#291c07','#322208','#3b290a','#45300b',
          '#50380d','#5c410f','#694b11','#775614','#866217','#9a721c','#bb8b26','#e6bb44'],
  /* 살덩이 벽은 젖은 고기다. 살 램프(flesh)를 그대로 태웠더니 위쪽이
     크림색으로 떠서 **사암 벽**처럼 보였다. 아래를 검붉게 깔고 가운데를
     피로 채우고, 뼈는 맨 위 두 칸에서만 밝아지게 한다. */
  meat:  ['#0b0305','#170609','#24080c','#340b0f','#450e12','#571216','#6a181a','#7d2020',
          '#8f2b26','#a03a2f','#ae4b3a','#bb6048','#c67b5c','#d09a78','#dcbb9c','#eddcc6'],
  hand:  ['#0d0406','#170709','#220c0d','#320f10','#451614','#5b201b','#742e24',
          '#8c4030','#a4553f','#b96b50','#c88062','#d29175','#daa188','#e0ae98','#e5b9a6','#ead2c2'],
};
const texCache = new Map();
function texCanvas(tex, ramp, key) {
  const hit = texCache.get(key); if (hit) return hit;
  const w = tex[0].length, h = tex.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
    const ch = tex[r][q]; if (ch === '.') continue;
    x.fillStyle = ramp[parseInt(ch, 16)]; x.fillRect(q, r, 1, 1);
  }
  texCache.set(key, c); return c;
}
const hardBlit = (ctx, cv, x, y, w, h) => {
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, 0, 0, cv.width, cv.height, x, y, w, h);
  ctx.imageSmoothingEnabled = sm;
};
/* 팔레트 밖의 살색. 이 게임 어디에도 없는 색이라 이물로 읽힌다. */
const FLESH = { deep:'#2a0a0d', mid:'#7d3a34', skin:'#c99a86', hi:'#f0d6c4', wet:'#fff6ee' };
const SCLERA = { edge:'#8f5a55', mid:'#d8bfb4', hi:'#fffaf4' };
const EYE_TRACK = (px, py, ex, ey, r) => {
  const dx = px - ex, dy = py - ey, d = Math.hypot(dx, dy) || 1;
  return [ex + dx / d * r, ey + dy / d * r];
};
/* ── 신의 사자 ────────────────────────────────────────────
   서약 화면의 「무언가 듣고 있다」에 얼굴을 준다. 이 게임의 다른
   그림은 전부 8×8 도트인데 이것만 실사 격자다 — 이물의 층과 같은
   이유다(§3): 신은 이 세계의 물건이 아니다.

   신앙심이 깊어질수록 **또렷해진다.** 처음 만날 때는 배경에 밴 얼룩
   이고, 광신에 이르면 화면 앞에 서 있다. 값은 규칙 쪽 warpOf 하나에서
   오므로 화면과 규칙이 갈릴 수 없다(§5-2).

   캔버스 뒷면은 격자 크기 그대로 두고 CSS 로 늘린다. 여기서 키워
   구우면 폰마다 다른 배율로 뭉개진다 — 늘리는 것은 브라우저에
   맡기고(image-rendering: pixelated) 우리는 한 칸을 한 픽셀로 굽는다. */
export function drawHerald(cv, deep = 0) {
  const w = HERALD_TEX[0].length, h = HERALD_TEX.length;
  if (cv.width !== w) { cv.width = w; cv.height = h; }
  const x = cv.getContext('2d');
  x.clearRect(0, 0, w, h);
  x.globalAlpha = 0.42 + Math.min(1, Math.max(0, deep)) * 0.58;
  x.drawImage(texCanvas(HERALD_TEX, RAMP.corpse, 'herald'), 0, 0);
  x.globalAlpha = 1;
}
/* 발밑에 구멍을 뚫는다. 이 겹들은 빈 버퍼에 그려 화면 위에 얹는
   것이므로, 지워 낸 자리로는 방이 그대로(원래 해상도로) 보인다.
   화면을 꽉 채우는 겹은 안 뚫으면 **플레이어가 그림 밑으로 사라진다**
   — §0. 완전히 지우지는 않는다: 그것이 너를 피해 갈라지는 것으로 남는다. */
function punchPlayer(ctx, w, h, px, py, rad) {
  const hole = ctx.createRadialGradient(px, py, 0, px, py, rad);
  hole.addColorStop(0, 'rgba(0,0,0,0.94)');
  hole.addColorStop(0.5, 'rgba(0,0,0,0.72)');
  hole.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = hole; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
/* 눈 하나. 렌즈 모양 흰자 + 쫓는 눈동자. 깜빡임은 세로로 감긴다. */
function oneEye(ctx, ex, ey, r, px, py, blink) {
  if (blink <= 0.02) {                     // 감긴 눈 — 젖은 이음선 하나
    ctx.strokeStyle = FLESH.deep; ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath(); ctx.moveTo(ex - r, ey); ctx.lineTo(ex + r, ey); ctx.stroke();
    return;
  }
  ctx.save();
  ctx.translate(ex, ey); ctx.scale(1, blink); ctx.translate(-ex, -ey);
  /* 안구는 **사진이다**. 도트로 그린 눈은 「그린 눈」이지만, 줄여서
     격자에 가둔 사진은 무엇인지 알기 전에 먼저 불쾌하다.
     눈동자를 따로 그리지 않는다 — 사진에 이미 있다. 대신 **공 전체를**
     너 쪽으로 밀어 눈알이 눈구멍 안에서 돌게 한다. 그게 눈이 하는
     짓이고, 그린 눈동자를 사진 위에 겹치면 홍채가 둘이 된다.
     구멍은 **정원**이다. 눈꺼풀 틈처럼 눌러 놨더니 눈알이 아니라
     아몬드로 읽혔다 — 벽에 박힌 것은 눈꺼풀이 아니라 공이다.
     굴린 만큼 공이 구멍보다 커야 가장자리가 안 빈다: gr − roll > r. */
  const globe = texCanvas(EYE_TEX, RAMP.eyeball, 'eye');
  const roll = r * 0.24, gr = r * 1.34;
  const [gx, gy] = EYE_TRACK(px, py, ex, ey, roll);
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2);
  ctx.save(); ctx.clip();
  hardBlit(ctx, globe, gx - gr, gy - gr, gr * 2, gr * 2);
  ctx.restore();
  /* 핏줄 사진을 0.45로 겹쳐 봤더니 눈 아홉 개가 전부 **연어색 덩어리**
     가 되고 홍채가 지워졌다. 이 사진에는 흰자에 실핏줄이 이미 있다 —
     겹치는 것은 아래쪽 삼분의 일, 그것도 얇게. */
  ctx.save(); ctx.beginPath();
  ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha = 0.16;
  hardBlit(ctx, texCanvas(VEIN_TEX, RAMP.flesh, 'vein'), ex - r, ey + r * 0.1, r * 2, r * 0.9);
  ctx.restore();
  // 눈꺼풀 그늘 — 위아래로 어둡게 눌러 구멍에 박힌 눈으로 만든다
  const lid = ctx.createLinearGradient(0, ey - r, 0, ey + r);
  lid.addColorStop(0, 'rgba(8,4,6,0.75)'); lid.addColorStop(0.38, 'rgba(8,4,6,0)');
  lid.addColorStop(0.7, 'rgba(8,4,6,0)'); lid.addColorStop(1, 'rgba(8,4,6,0.6)');
  ctx.save(); ctx.beginPath();
  ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = lid; ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
  ctx.restore();
  ctx.restore();
}
/* 눈의 방 — 화면 전체가 눈이다. 격자로 박고, 파도처럼 깜빡이고,
   전부 같은 곳(너)을 본다. */
function veilEyes(ctx, w, h, px, py, tt) {
  /* 처음에 일곱 개씩 깔았더니 저해상도에서 눈 하나가 반지름 6칸이 되고,
     계조를 누른 뒤에는 **회색 얼룩**으로 읽혔다. 작은 눈 마흔 개보다
     큰 눈 아홉 개가 무섭다 — 세 줄로 줄이고 안구를 키운다. */
  const step = Math.max(24, Math.min(w, h) / 3.1);
  ctx.globalAlpha = 0.72;
  for (let ey = step * 0.5, row = 0; ey < h + step; ey += step, row++)
    for (let ex = step * 0.5 + (row % 2 ? step * 0.5 : 0), col = 0; ex < w + step; ex += step, col++) {
      /* 파도처럼 감긴다 — 전부 같이 깜빡이면 그건 조명이고, 제각각이면
         잡음이다. 대각선으로 흐르는 물결이 「보고 있다」로 읽힌다. */
      const ph = (tt / 900) - (ex + ey) / (step * 5);
      const blink = Math.max(0, Math.sin(ph) * 1.4);
      const r = step * 0.42;
      /* 눈구멍부터 그린다 — 안구가 배경 위에 떠 있으면 스티커가 되고,
         구멍에 박혀 있으면 벽에서 나온 것이 된다. */
      const gs = ctx.createRadialGradient(ex, ey, r * 0.5, ex, ey, r * 1.5);
      gs.addColorStop(0, 'rgba(18,3,6,0.95)'); gs.addColorStop(1, 'rgba(18,3,6,0)');
      ctx.fillStyle = gs;
      ctx.beginPath(); ctx.arc(ex, ey, r * 1.5, 0, Math.PI * 2); ctx.fill();
      oneEye(ctx, ex, ey, r, px, py, Math.min(1, blink));
      void col;
    }
  ctx.globalAlpha = 1;
  punchPlayer(ctx, w, h, px, py, step * 0.62);   // 눈 아홉이 방을 통째로 덮는다
}
/* 팔의 벽 — 네 변에서 팔이 들어온다. 팔은 **사진**이다(ARM_TEX):
   격자 안에서 어깨가 왼쪽 위, 손이 오른쪽 아래이므로, 어깨를 변에 대고
   손이 안쪽을 향하도록 돌려서 붙인다. 길이는 안 늘인다 — 사진을 늘이면
   힘줄 간격이 같이 늘어나 고무가 된다. 대신 **밀어 넣었다 뺀다.** */
function oneArm(ctx, x0, y0, aim, len, k) {
  const A = LIMBS[k % LIMBS.length];
  const cv = texCanvas(A.g, RAMP.corpse, 'limb' + (k % LIMBS.length));
  const hh = len * cv.height / cv.width;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(aim - A.ang);            // 사진마다 팔이 누운 각이 다르다
  hardBlit(ctx, cv, -A.sx * len, -A.sy * hh, len, hh);
  /* 손끝 쪽으로 갈수록 어둠에 잠긴다 — 팔이 벽에서 나오는 것이지
     화면을 가로지르는 것이 아니다. */
  const fade = ctx.createLinearGradient(0, 0, len, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.55, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(6,4,6,0.85)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = fade;
  ctx.fillRect(-A.sx * len, -A.sy * hh, len, hh);
  ctx.restore();
}
function veilLimbs(ctx, w, h, px, py, tt) {
  /* 팔이 **어디서** 나오는가. 지금까지는 검은 화면 가장자리였고,
     그러면 팔은 허공에서 나온 것이 된다. 벽이 있어야 벽에 박힌
     것이 된다 — 사람 여럿이 녹아 붙은 벽 사진을 화면에 덮고 그
     위에서 팔을 뽑는다. 숨을 쉬듯 아주 느리게 밀린다(§3: 정지한
     배경은 배경이고, 미는 배경은 살아 있는 것이다). */
  const wall = texCanvas(FLESH_TEX, RAMP.meat, 'meat');
  const breath = Math.sin(tt / 2300) * 0.035;
  const cover = Math.max(w / wall.width, h / wall.height) * (1.10 + breath);
  const cw = wall.width * cover, ch = wall.height * cover;
  ctx.globalAlpha = 0.92;
  hardBlit(ctx, wall, (w - cw) / 2 + Math.sin(tt / 3700) * w * 0.02,
                      (h - ch) / 2 + Math.cos(tt / 4300) * h * 0.02, cw, ch);
  ctx.globalAlpha = 1;
  /* 처음에 열넷을 화면 길이만큼 깔았더니 **화면이 통째로 고기**가 되고
     영웅이 어디 있는지 안 보였다. 기괴한 것과 안 보이는 것은 다르다
     (§0). 변에서 들어오되 가운데는 비워 둔다 — 일곱, 화면의 절반 길이,
     그리고 팔이 안쪽으로 갈수록 옅어진다. */
  const reach = 0.66 + Math.sin(tt / 1100) * 0.24;
  const L = Math.min(w, h) * 0.52;
  const push = i => reach * (0.72 + ((i * 37) % 34) / 100);
  let k = 0;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 2; i++) {
    const f = (i + 1) / 3;
    oneArm(ctx, 0, h * f, 0.30 - f * 0.5, L * push(i), k++);
    oneArm(ctx, w, h * (1 - f), Math.PI - 0.30 + f * 0.5, L * push(i + 2), k++);
  }
  oneArm(ctx, w * 0.34, 0, Math.PI / 2 - 0.2, L * push(4), k++);
  oneArm(ctx, w * 0.72, h, -Math.PI / 2 + 0.25, L * push(5), k++);
  oneArm(ctx, w * 0.18, h, -Math.PI / 2 - 0.3, L * push(6), k++);
  ctx.globalAlpha = 1;
  punchPlayer(ctx, w, h, px, py, Math.min(w, h) * 0.24);   // 벽이 화면을 덮는다
}
/* 깜짝. 손 하나가 화면을 통째로 덮는다 — 0.42초, 붉은 섬광과 함께.
   이것이 이 층에서 가장 중요한 그림이고, 그래서 예고가 없다. */
/* ── 손이 화면을 다 덮으면 그건 손이 아니라 검은 화면이다 ──────
   처음에 1.7배까지 키웠더니 순검정이 화면을 통째로 먹었다. 실루엣이
   읽히려면 **뒤가 밝아야** 하고 손은 화면을 다 덮으면 안 된다. 그래서
   붉은 섬광을 세게(0.78) 깔고 손은 0.95배까지만 키우고, 손가락 끝에
   창백한 테를 한 줄 남긴다 — 그 한 줄이 「살」이라고 말한다. */
function slam(ctx, w, h, k) {
  const ease = k < 0.22 ? k / 0.22 : 1 - (k - 0.22) / 0.78;
  ctx.save();
  ctx.fillStyle = `rgba(214,58,44,${(ease * 0.88).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  /* 손도 격자다 — 실루엣은 해부학적으로 래스터라이즈했고 표면은 세포
     사진(CC0)을 입혔다. 타원 몇 개를 겹쳐 놓은 것이 아니다.
     유리에 눌린 자리(지문 패드·손가락 밑동·손바닥 두덩)가 창백하게
     떠 있는 것이 이 그림의 전부다. */
  const hand = texCanvas(HAND_TEX, RAMP.hand, 'hand');
  /* 손이 화면보다 커지면 손바닥 한가운데만 보이고, 그건 살덩이지
     손이 아니다. 최대에서 화면 높이의 0.98배 — 손목이 아래로 걸치고
     다섯 손가락이 전부 보이는 크기다. */
  const scale = (0.52 + ease * 0.46) * h / hand.height;
  const hw = hand.width * scale, hh = hand.height * scale;
  ctx.globalAlpha = Math.min(1, ease * 2.2);
  hardBlit(ctx, hand, (w - hw) / 2, h - hh, hw, hh);   // 손목이 화면 아래로 잘린다
  ctx.restore();
}
/* 얼굴들 — 어둠에서 얼굴가죽이 떠오른다. 입이 열리고, 다시 잠긴다. */
/* 얼굴도 사진이다. 눈구멍과 벌린 입은 그린 것이 아니라 거기 있던
   구멍이고, 검은 배경이 그대로 알파라 어둠에서 **떠오르는** 것이 된다.
   `open` 은 얼마나 떠올랐는가다 — 아래에서 위로 드러난다. */
function oneFace(ctx, fx, fy, r, open) {
  const cv = texCanvas(FACE_TEX, RAMP.corpse, 'face');
  const w = r * 1.9, h = w * cv.height / cv.width;
  ctx.save();
  ctx.globalAlpha = Math.min(1, open * 1.25) * (ctx.globalAlpha || 1);
  hardBlit(ctx, cv, fx - w / 2, fy - h / 2, w, h);
  ctx.restore();
}
function veilFaces(ctx, w, h, px, py, tt) {
  for (let i = 0; i < 6; i++) {
    const sx = ((i * 3711) % 977) / 977, sy = ((i * 8317) % 613) / 613;
    const ph = (tt / 1700) + i * 0.7;
    const up = Math.max(0, Math.sin(ph));
    if (up < 0.04) continue;
    ctx.globalAlpha = Math.min(0.9, up * 1.1);
    oneFace(ctx, sx * w, sy * h, Math.min(w, h) * (0.07 + (i % 3) * 0.03), up);
  }
  ctx.globalAlpha = 1;
  void px; void py;
}
/* 새겨진 표 — **판화 한 장이 스스로를 낳는다.** 벡터로 원과 삼각형을
   그려 봤을 때는 「도형 몇 개」였다. 같은 판화를 0.6배씩 줄여 겹쳐
   놓고 겹마다 다른 속도로 돌리면, 화면이 자기를 들여다보는 굴이 된다.
   판화의 눈은 안 움직인다 — 그래서 겹의 꼭짓점에 **너를 쫓는 눈**을
   따로 박는다. 안 보는 눈과 보는 눈이 같은 화면에 있어야 불쾌하다. */
function veilSigil(ctx, w, h, px, py, tt) {
  const cxx = w / 2, cyy = h / 2, big = Math.min(w, h) * 0.80;
  const eng = texCanvas(SIGIL_TEX, RAMP.sigil, 'sigil');
  ctx.save();
  /* 두 번 크게 깔았다가 두 번 다 지도를 지웠다. 이 판화는 삼각형
     **안쪽이 점묘로 꽉 찬** 그림이라, 화면보다 크게 깔면 보이는 것이
     테두리가 아니라 잉크 덩어리다. 화면 짧은 변의 0.8배 — 햇살까지
     한 장이 다 들어오고 가장자리에 방이 남는다. */
  for (let k = 0; k < 5; k++) {
    const s = big * Math.pow(0.60, k);
    const rot = tt / (2600 + k * 1500) * (k % 2 ? -1 : 1);
    ctx.globalAlpha = 0.26 - k * 0.035;
    ctx.save();
    ctx.translate(cxx, cyy); ctx.rotate(rot);
    hardBlit(ctx, eng, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
  ctx.restore();
  /* 겹의 꼭짓점마다 눈. 프랙탈이 「도형」이 아니라 「보는 것」이 된다. */
  ctx.globalAlpha = 0.8;
  for (let k = 1; k < 3; k++) {
    const r = big * 0.30 * Math.pow(0.60, k), rot = tt / (2600 + k * 1500) * (k % 2 ? -1 : 1);
    for (let i = 0; i < 3; i++) {
      const a = rot - Math.PI / 2 + i * Math.PI * 2 / 3;
      oneEye(ctx, cxx + Math.cos(a) * r, cyy + Math.sin(a) * r,
             Math.max(3, big * 0.030 * Math.pow(0.8, k)), px, py, 1);
    }
  }
  ctx.globalAlpha = 1;
  punchPlayer(ctx, w, h, px, py, Math.min(w, h) * 0.20);   // 삼각형 안쪽이 꽉 차 있다
}
/* 고대의 천사 — 화면만 한 눈 하나가 뒤에서 보고 있고, 네 변에 깃이
   돋아 있다. 눈동자는 세로로 갈라져 있고 너를 쫓는다. */
function veilAngel(ctx, w, h, px, py, tt) {
  const cxx = w / 2, cyy = h / 2, R = Math.min(w, h) * 0.46;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = PALETTE.W;
  ctx.beginPath(); ctx.ellipse(cxx, cyy, R * 1.25, R, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PALETTE.P; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cxx, cyy, R * 1.25, R, 0, 0, Math.PI * 2); ctx.stroke();
  const [ix, iy] = EYE_TRACK(px, py, cxx, cyy, R * 0.42);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = PALETTE.P;
  ctx.beginPath(); ctx.arc(ix, iy, R * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.k;                     // 세로로 갈라진 눈동자
  ctx.beginPath(); ctx.ellipse(ix, iy, R * 0.10, R * 0.30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = PALETTE.P; ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {           // 깃 — 네 변에서 안쪽으로
    const f = i / 14, sw = Math.sin(tt / 1300 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(0, h * f); ctx.lineTo(w * 0.10 + sw, h * f - 10); ctx.lineTo(0, h * f - 20);
    ctx.moveTo(w, h * f); ctx.lineTo(w * 0.90 - sw, h * f - 10); ctx.lineTo(w, h * f - 20);
    ctx.stroke();
  }
  ctx.restore();
}
/* 지지직 — 이미 그린 화면을 잘라 옆으로 밀고, 잘못된 색 블록을 얹는다.
   이 층에서만 픽셀을 만진다(슬라이스 복사라 폰에서도 싸다). */
function veilStatic(ctx, w, h, tt) {
  const cv = ctx.canvas;
  for (let i = 0; i < 7; i++) {
    const seed = (i * 7919 + Math.floor(tt / 90) * 104729) % 100000;
    const y = (seed % 97) / 97 * h;
    const hh = 4 + (seed % 11);
    const dx = (((seed >> 3) % 41) - 20) * 1.6;
    ctx.drawImage(cv, 0, y, w, hh, dx, y, w, hh);
  }
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 5; i++) {
    const seed = (i * 6151 + Math.floor(tt / 140) * 92831) % 100000;
    ctx.fillStyle = (seed % 3) ? PALETTE.s : PALETTE.W;
    ctx.fillRect((seed % 89) / 89 * w, (seed % 71) / 71 * h,
                 10 + (seed % 23), 3 + (seed % 5));
  }
  ctx.globalAlpha = 1;
}
/* 뱃속 — 화면이 숨을 쉰다. 조리개가 조여들고, 변에서 융모가 흔들린다. */
function veilGullet(ctx, w, h, tt) {
  const beat = 0.5 + Math.sin(tt / 780) * 0.5;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * (0.20 + beat * 0.10),
                                     w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(37,74,42,${(0.55 + beat * 0.25).toFixed(3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = PALETTE.E; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
  for (let i = 0; i < 22; i++) {           // 융모
    const f = i / 22, sw = Math.sin(tt / 420 + i) * 3, len = 5 + (i % 4) * 3;
    ctx.beginPath(); ctx.moveTo(w * f, 0); ctx.lineTo(w * f + sw, len); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * f, h); ctx.lineTo(w * f - sw, h - len); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h * f); ctx.lineTo(len, h * f + sw); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w, h * f); ctx.lineTo(w - len, h * f - sw); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
const VEIL = {
  eyes:   (c, w, h, px, py, tt) => veilEyes(c, w, h, px, py, tt),
  limbs:  (c, w, h, px, py, tt) => veilLimbs(c, w, h, px, py, tt),
  faces:  (c, w, h, px, py, tt) => veilFaces(c, w, h, px, py, tt),
  sigil:  (c, w, h, px, py, tt) => veilSigil(c, w, h, px, py, tt),
  angel:  (c, w, h, px, py, tt) => veilAngel(c, w, h, px, py, tt),
  static: (c, w, h, px, py, tt) => veilStatic(c, w, h, tt),
  gullet: (c, w, h, px, py, tt) => veilGullet(c, w, h, tt),
};
/* 놀램이 있는 층. 없는 층은 덮개만 돈다 — 전부 놀래키면 놀램이
   아니라 박자가 된다. */
const SCARE = { limbs: slam, faces: slam, angel: slam };

/* ── 그리고 이 전부를 저해상도에서 그린다 ──────────────────
   처음에 화면 해상도에 바로 그렸더니 **부드러운 벡터 그림**이 나왔다 —
   매끈한 타원과 매끈한 호. 이 게임은 8×8 도트로 그린 게임이고, 그 위에
   안티에일리어싱된 곡선이 뜨면 그건 기괴한 것이 아니라 **다른 게임의
   레이어**다. 불쾌함은 매끄러움에서 오지 않는다.

   그래서 가로 132칸짜리 버퍼에 그리고, 보간을 끈 채로 확대해 붙인다.
   같은 코드가 그린 같은 눈알이 계단처럼 각지고, 그때 비로소 이 게임의
   그림이 된다. 덤으로 비용도 내려간다 — 폰에서 매 프레임 도는 자리라
   실제로 그쪽이 더 중요하다. */
const LOW_W = 132;
let lowCv = null, lowCx = null;
function lowBuf(w, h) {
  const lw = LOW_W, lh = Math.max(8, Math.round(h * lw / w));
  if (!lowCv) { lowCv = document.createElement('canvas'); lowCx = lowCv.getContext('2d'); }
  if (lowCv.width !== lw || lowCv.height !== lh) { lowCv.width = lw; lowCv.height = lh; }
  lowCx.clearRect(0, 0, lw, lh);
  return { lw, lh, k: lw / w };
}
export function drawStrange(ctx, w, h, id, px, py) {
  if (!id) { if (strangeId) strangeEnter(null); return; }
  if (id !== strangeId) strangeEnter(id);
  const tt = now() - strangeT0;
  /* 지지직만 예외다 — 이미 그려진 화면을 잘라 미는 것이므로 저해상도
     버퍼에 그릴 대상이 없다. 그쪽은 화면 위에서 직접 자른다. */
  if (id === 'static') { ctx.save(); veilStatic(ctx, w, h, tt); ctx.restore(); return; }
  const { lw, lh, k } = lowBuf(w, h);
  lowCx.save();
  VEIL[id]?.(lowCx, lw, lh, px * k, py * k, tt);
  const scare = SCARE[id];
  if (scare) {
    if (now() > scareAt) { scareTill = now() + SCARE_MS; scareAt = now() + 7000 + Math.random() * 11000; }
    if (now() < scareTill) scare(lowCx, lw, lh, 1 - (scareTill - now()) / SCARE_MS);
  }
  lowCx.restore();
  digitise(lowCx, lw, lh);
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lowCv, 0, 0, lw, lh, 0, 0, w, h);
  ctx.imageSmoothingEnabled = smooth;
}
