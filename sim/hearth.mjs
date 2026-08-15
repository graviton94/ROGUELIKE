/* hearth.mjs — 모닥불에 앉는 것이 무엇을 사는가.

   1회차 리뷰의 지적은 「모닥불 회복이 무가치하다」였고, 처방은
   「상처를 모닥불 전담 통화로 만들어라」였다. 처방은 이미 들어가
   있다 — campRest가 기름 260을 태워 상처를 지진다(WOUND_OIL).
   그러니 이번에 물을 것은 「넣었는가」가 아니라 **「무는가」**다.

   앉는 순간의 장부를 그대로 찍는다: 상처가 있었는가, 기름이 값을
   낼 만큼 있었는가, 실제로 몇 할을 지졌는가, 체력은 얼마나 찼는가.
   상처가 없거나 기름이 없으면 그 자리는 통화가 아니라 장식이다.

   usage: node sim/hearth.mjs [직업당 판수=8]                     */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 8);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];
const WOUND_OIL = Game.WOUND_OIL ?? 260;
const CAMP_HEAL = Game.CAMP_HEAL ?? 0.28;

/* 앉기 직전의 장부를 본다. ES 모듈의 export는 얼어 있어 감쌀 수
   없고, 규칙 파일에 탐침을 심는 것은 금지다. 그래서 봇의 루프
   훅에서 본다: 화면이 'camp'인 턴이 곧 「앉기 직전」이고, 화면이
   닫힌 첫 턴이 「앉은 직후」다. */
const sits = [];
let runs = 0, stuck = 0;
for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    let pending = null;
    const r = runBot('human', cls, i % 2 === 0, { onTurn: g => {
      const p = g.player; if (!p) return;
      if (g.screen === 'camp') {
        if (!pending) pending = { depth: g.depth, wound: p.wound || 0,
          roof: p.maxhp + (p.wound || 0), oil: p.lightTurns, hp: p.hp, maxhp: p.maxhp };
      } else if (pending) {
        sits.push({ ...pending, woundAfter: p.wound || 0, oilAfter: p.lightTurns,
                    hpAfter: p.hp, maxhpAfter: p.maxhp });
        pending = null;
      }
    } });
    runs++; if (r.stuck) stuck++;
  }
}

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const pct = (n, d) => (d ? n * 100 / d : 0).toFixed(0) + '%';

console.log(`\n모닥불은 무엇을 사는가 — ${runs}판 (라이브락 ${stuck}) · 앉은 횟수 ${sits.length}`);
console.log(`  상수: WOUND_OIL=${WOUND_OIL} · CAMP_HEAL=${CAMP_HEAL} · 판당 ${(sits.length / Math.max(1, runs)).toFixed(1)}회 앉는다\n`);

const withWound = sits.filter(s => s.wound > 0);
const canPay    = sits.filter(s => s.oil >= WOUND_OIL);
const paid      = withWound.filter(s => s.oil >= WOUND_OIL);
const partial   = withWound.filter(s => s.oil > 0 && s.oil < WOUND_OIL);

console.log(`  앉을 때 상처가 있었다        ${withWound.length}/${sits.length} (${pct(withWound.length, sits.length)})`);
console.log(`  앉을 때 기름이 ${WOUND_OIL} 이상이었다  ${canPay.length}/${sits.length} (${pct(canPay.length, sits.length)})`);
console.log(`  상처가 있고 전부 지질 수 있었다  ${paid.length}/${sits.length} (${pct(paid.length, sits.length)})   ← 여기가 「통화」다`);
console.log(`  상처는 있는데 기름이 모자랐다   ${partial.length}/${sits.length} (${pct(partial.length, sits.length)})`);

console.log(`\n  앉을 때 상처가 천장에서 차지한 비율  평균 ${(mean(sits.map(s => s.wound / s.roof)) * 100).toFixed(1)}%`);
console.log(`  앉을 때 기름                    평균 ${mean(sits.map(s => s.oil)).toFixed(0)}`);
console.log(`  실제로 닫힌 상처 (앉기당)         평균 ${mean(sits.map(s => s.wound - s.woundAfter)).toFixed(1)}`
  + `  — 있던 상처의 ${pct(mean(withWound.map(s => s.wound - s.woundAfter)), mean(withWound.map(s => s.wound)))}`);
console.log(`  회복한 체력 (앉기당)             평균 ${mean(sits.map(s => s.hpAfter - s.hp)).toFixed(1)}`
  + ` = 천장의 ${(mean(sits.map(s => (s.hpAfter - s.hp) / Math.max(1, s.maxhp))) * 100).toFixed(0)}%`);
console.log(`  앉을 때 체력이 이미 가득이었다     ${sits.filter(s => s.hp >= s.maxhp).length}/${sits.length}`
  + ` (${pct(sits.filter(s => s.hp >= s.maxhp).length, sits.length)})   ← 여기가 「무가치」다`);

/* 선택이 되려면 두 값이 **둘 다** 아까워야 한다. 기름을 상처에 쓰면
   빛을 잃는다 — 실제로 잃었는가. */
console.log(`\n  지진 뒤 기름이 ${WOUND_OIL} 미만으로 떨어졌다  ${paid.filter(s => s.oilAfter < 150).length}/${Math.max(1,paid.length)}`
  + `   (지진 판에서 빛을 실제로 내주었는가)`);
console.log(`  지진 뒤 남은 기름 평균           ${mean(paid.map(s => s.oilAfter)).toFixed(0)}`);

console.log(`\n  깊이별 — 앉은 횟수 · 상처 있던 비율 · 전부 지진 비율`);
for (let d = 1; d <= 10; d++) {
  const a = sits.filter(s => s.depth === d);
  if (a.length < 5) continue;
  console.log(`   ${String(d).padStart(2)}층  n=${String(a.length).padStart(3)}`
    + `  상처 있음 ${pct(a.filter(s => s.wound > 0).length, a.length).padStart(4)}`
    + `  전부 지짐 ${pct(a.filter(s => s.wound > 0 && s.oil >= WOUND_OIL).length, a.length).padStart(4)}`
    + `  체력 가득 ${pct(a.filter(s => s.hp >= s.maxhp).length, a.length).padStart(4)}`);
}
console.log('');
