/* ═══════════════════════════════════════════════════════════
   fourverbs.mjs — 네 직업의 동사를 문턱보다 먼저 잰다

   `synergy.mjs` 가 잰 것: 장부에서 도적이 압도하는 갈래가 다섯,
   마법사가 하나, **전사·궁수·사제·팔라딘이 압도하는 것은 하나도
   없다.** 그래서 그 넷에게는 「그 직업의 유물」을 지을 수가 없었다 —
   유물의 효과가 아니라 **조건**이 없었던 것이다.

   동사 넷을 새로 세기 시작했다:
     third 급소가 열린 수 (전사만 지나가는 문)
     far   세 칸 밖의 명중 (누구나 지나가지만 궁수가 압도할 것)
     faith 찬 신앙 (사제만)
     oath  찬 맹세 (팔라딘만)

   이 파일은 **유물을 짓기 전에** 돈다. 문턱을 짐작으로 적고 나서
   재면, 안 맞았을 때 고치는 것이 문턱이 아니라 판정이 된다.
   묻는 것 둘:
     1. 그 넷이 정말 제 동사를 압도하는가 (배치 폭을 넘겨서)
     2. 판당 얼마나 차는가 — 그 숫자에서 문턱을 뽑는다

   usage: node sim/fourverbs.mjs [판수]
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('/home/user/ROGUELIKE/src/meta.js');
const Game = await import('/home/user/ROGUELIKE/src/game.js');
const { runBot } = await import('/home/user/ROGUELIKE/sim/_botlib.mjs');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

const N = Number(process.argv[2] || 14), B = 3;
const KO = { warrior:'전사', rogue:'도적', ranger:'궁수', mage:'마법사', priest:'사제', paladin:'팔라딘' };
const CLS = Object.keys(KO);
const VERB = { third:'전사', far:'궁수', faith:'사제', oath:'팔라딘' };
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
/* 「팔라딘가 압도한다」가 찍혔다. 받침으로 갈린다 — 문장을 기계가 조립할
   때는 조사도 기계가 골라야 한다. */
const ga = w => (((w.charCodeAt(w.length - 1) - 0xac00) % 28) ? '이' : '가');

console.log(`\n네 동사 — ${B}배치 × ${N}판\n`);
const runs = {};
for (const cls of CLS) {
  runs[cls] = [];
  for (let b = 0; b < B; b++) {
    const bat = [];
    for (let i = 0; i < N; i++) {
      Meta.forget();
      const r = runBot('human', cls, i % 2 === 0);
      bat.push({ turn: r.turn, led: { ...(G.ledger || {}) } });
    }
    runs[cls].push(bat);
  }
}
/* 판당 총량과 100턴당 비율을 같이 본다. 문턱은 **판당 총량**에서
   뽑는다 — 크랙은 판 안에서 열려야 하는 것이므로. */
const perRun  = (cls, k, b) => med(runs[cls][b].map(r => r.led[k] || 0));
const perTurn = (cls, k, b) => med(runs[cls][b].map(r => (r.led[k] || 0) / Math.max(1, r.turn) * 100));

console.log('  동사     ' + CLS.map(c => KO[c].padStart(8)).join('') + '     주인/2위');
for (const k of Object.keys(VERB)) {
  const run = {}, band = {};
  for (const c of CLS) {
    const three = [0, 1, 2].map(b => perRun(c, k, b));
    run[c] = med(three); band[c] = Math.max(...three) - Math.min(...three);
  }
  const sorted = CLS.slice().sort((a, b) => run[b] - run[a]);
  const lead = run[sorted[0]] / Math.max(0.5, run[sorted[1]]);
  console.log(`  ${k.padEnd(8)}` + CLS.map(c => run[c].toFixed(0).padStart(8)).join('')
    + `  ${KO[sorted[0]]}/${KO[sorted[1]]} ${lead.toFixed(1)}배`);
  /* 압도의 뜻: 1위가 2위의 두 배를 넘고, 그 차가 **배치 폭보다
     크다**. 폭보다 작은 차이로 「이 직업의 동사」라고 적으면 그건
     측정이 아니라 한 배치의 운이다(§6). */
  const gap = run[sorted[0]] - run[sorted[1]];
  ok(sorted[0] === CLS.find(c => KO[c] === VERB[k]) && lead >= 2
     && gap > (band[sorted[0]] + band[sorted[1]]) / 2,
     `${k} — ${VERB[k]}${ga(VERB[k])} 압도한다`,
     `${VERB[k]} ${run[CLS.find(c => KO[c] === VERB[k])].toFixed(0)}/판 · 2위 ${KO[sorted[1]]} `
     + `${run[sorted[1]].toFixed(0)} · 배치폭 ${band[sorted[0]].toFixed(0)}`);
}

console.log('\n  (100턴당)');
for (const k of Object.keys(VERB))
  console.log(`  ${k.padEnd(8)}` + CLS.map(c => med([0,1,2].map(b => perTurn(c, k, b))).toFixed(2).padStart(8)).join(''));

/* ── 문턱 후보 ─────────────────────────────────────────────
   크랙은 「끼고 놀면 열리고 끼고만 있으면 안 열린다」여야 한다. 주인이
   보통 판에서 닿고 조금 남는 자리 — 주인의 판당 중앙값의 0.7배 —
   를 후보로 인쇄한다. 손으로 적은 숫자를 이 표와 나란히 두면 「짐작으로
   적은 문턱」이 눈에 보인다. */
console.log('\n── 문턱 후보 (주인 판당 중앙값 × 0.7)');
for (const k of Object.keys(VERB)) {
  const owner = CLS.find(c => KO[c] === VERB[k]);
  const v = med([0, 1, 2].map(b => perRun(owner, k, b)));
  console.log(`  ${k.padEnd(8)} ${VERB[k]} 판당 ${v.toFixed(0)} → 문턱 ${Math.max(1, Math.round(v * 0.7))}`);
}

console.log(bad ? `\n네 동사 벤치: ${bad}건 실패\n` : '\n네 동사 벤치: 넷이 각자 제 직업에게 쏠려 있다\n');
process.exit(bad ? 1 : 0);
