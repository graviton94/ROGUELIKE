/* Content is data, and data has a schema even when nothing enforces
   it. A monster carrying on:'burn' compiled, ran, spawned, fought —
   and only crashed the moment somebody tapped it, because that was
   the one line that read AILMENTS[m.on].n. Check the keys. */
import { MONSTERS, NAMED, BOSS, AILMENTS, PATTERNS, RELICS, MATS,
         MEMORIES, SHACKLES, MAX_SHACKLE, shacklesAt, tellsOf, CONSUMABLES } from '../src/data.js';
import { EVENTS } from '../src/events.js';
import * as PIX from '../src/pixels.js';

let bad = 0;
const fail = s => { console.log('   ✗ ' + s); bad++; };
const sprites = new Set(Object.keys(PIX.SPRITES || PIX.PIX || {}));

for (const m of [...MONSTERS, ...NAMED, BOSS]) {
  if (m.on && !AILMENTS[m.on]) fail(`${m.n} — on:'${m.on}'은 없는 상태이상`);
  for (const k of m.casts || []) if (!PATTERNS[k]) fail(`${m.n} — casts:'${k}'는 없는 패턴`);
  if (sprites.size && m.spr && !sprites.has(m.spr)) fail(`${m.n} — spr:'${m.spr}' 스프라이트 없음`);
  for (const ph of m.phases || []) {
    if (typeof ph.at !== 'number' || ph.at <= 0 || ph.at >= 1) fail(`${m.n} — 단계 at:${ph.at}`);
    if (ph.ring && !PATTERNS[ph.ring]) fail(`${m.n} — 단계 ring:'${ph.ring}'는 없는 패턴`);
    if (!ph.n) fail(`${m.n} — 이름 없는 단계`);
  }
  if (m.phases?.some((ph, i) => i && ph.at >= m.phases[i-1].at))
    fail(`${m.n} — 단계 임계값이 내림차순이 아니다`);
}

const ids = new Set();
for (const e of EVENTS) {
  if (ids.has(e.id)) fail(`사건 id 중복: ${e.id}`);
  ids.add(e.id);
  if (!e.opts?.length) fail(`${e.id} — 선택지 없음`);
  for (const o of e.opts || []) {
    if (!o.run) fail(`${e.id} / ${o.n} — run 없음`);
    const w = [o.odds != null, !!o.fail, !!o.risk];
    if (w.some(Boolean) && !w.every(Boolean))
      fail(`${e.id} / ${o.n} — odds·fail·risk는 셋이 함께여야 한다`);
    if (o.odds != null && (o.odds <= 0 || o.odds >= 1)) fail(`${e.id} / ${o.n} — odds ${o.odds}`);
  }
}

/* Memories: every goal must be reachable and every id unique. */
const mid = new Set();
for (const m of MEMORIES) {
  if (mid.has(m.id)) fail(`기억 id 중복: ${m.id}`);
  mid.add(m.id);
  if (!(m.of > 0)) fail(`${m.id} — 목표치 ${m.of}`);
  if (typeof m.at !== 'function') fail(`${m.id} — at()이 없다`);
  if (!m.goal || !m.t) fail(`${m.id} — 문구가 비었다`);
}

/* The ladder: rungs numbered in order, each one named and paying
   more than the one below it, stacking rather than swapping. */
SHACKLES.forEach((sh, i) => {
  if (sh.n !== i) fail(`족쇄 ${i}번의 n이 ${sh.n}`);
  if (i && !sh.id) fail(`족쇄 ${i}단계에 id가 없다`);
  if (i && !sh.k) fail(`족쇄 ${i}단계에 이름이 없다`);
  if (i && sh.gold <= SHACKLES[i-1].gold) fail(`족쇄 ${i}단계 전리품이 아래보다 크지 않다`);
});
if (shacklesAt(MAX_SHACKLE).length !== MAX_SHACKLE)
  fail('마지막 단계가 모든 족쇄를 껴안지 않는다');
for (let i = 1; i <= MAX_SHACKLE; i++) {
  const a = shacklesAt(i - 1), b = shacklesAt(i);
  if (!a.every((x, k) => b[k] === x)) fail(`족쇄 ${i}단계가 아래 단계를 그대로 껴안지 않는다`);
}

/* Every monster must produce at least one tell, or the codex
   pays out a blank page for five bodies. */
for (const m of [...MONSTERS, ...NAMED, BOSS])
  if (!tellsOf(m).length) fail(`${m.n} — 버릇이 하나도 나오지 않는다`);

const rid = new Set();
for (const r of RELICS) { if (rid.has(r.id)) fail(`유물 id 중복: ${r.id}`); rid.add(r.id); }

console.log(bad ? `\n   ✗ ${bad}건` : '   내용 검사 통과 ✓  ' +
  `몬스터 ${MONSTERS.length + NAMED.length + 1} · 사건 ${EVENTS.length} · 유물 ${RELICS.length}` +
  ` · 소모품 ${CONSUMABLES.length} · 기억 ${MEMORIES.length} · 족쇄 ${MAX_SHACKLE}`);
process.exit(bad ? 1 : 0);
