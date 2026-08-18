/* mend.mjs — 층이 뺏은 것과 되돌려 준 것.

   1차 리뷰가 「회복이 층이 뺏은 것의 90~100%를 되돌려 준다」고 적었지만,
   그 숫자는 자연회복 공식을 손으로 적분해서 나온 값이었다. 손으로 적분한
   값은 판이 실제로 쉬는 시간을 모른다 — BREATH(맞은 뒤 숨 잠금)도,
   breathRoof(상처가 끌어내린 천장)도, 봇이 실제로 물약을 언제 마시는지도.

   그래서 여기서는 판을 돌리면서 **체력이 움직인 모든 순간**을 잡는다.

   ── 어떻게 ──
   game.js에는 손실 깔때기(hurtPlayer)는 있지만 **회복 깔때기는 없다**.
   회복은 열두 군데에서 저마다 `p.hp += n`을 한다. 규칙 파일을 고치지 않고
   그것을 전부 잡으려면 재는 쪽에서 접근자를 씌우는 수밖에 없다:

     G.player 에 setter를 걸어 → 새 영웅마다 hp 에 접근자를 건다
     → hp 가 움직일 때마다 호출 스택의 함수 이름으로 출처를 가른다.

   함수 이름이 곧 출처다 (game.js에서 확인한 대응):
     endTurn     자연회복        useItem   물약
     campRest    모닥불          grantBoon 제단
     eventApi    사건            cast      치유 주문
     quarry/drainLife/spellDrain/onKill/hurtMonster  전투가 돌려준 것
     enterDepth  층 진입(여명·시간도둑)
     gainXp      레벨업(천장이 오른 몫 — 회복이 아니다, 따로 센다)
     recalc      상처 정산(천장이 내려가며 깎인 몫 — 손실이다)
     hurtPlayer  피해

   ── 분모를 조심할 것 ──
   「되돌려 준 비율」의 분모는 **그 층에서 잃은 체력**이지 최대 체력이
   아니다. 그리고 레벨업으로 오른 몫은 되돌려 준 것이 아니라 그릇이
   커진 것이므로 분자에서 뺀다. 이 두 개를 섞으면 회복률이 120%로 나온다
   (처음에 그렇게 나왔다).

   usage: node sim/mend.mjs [판수]                            */

const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

Error.stackTraceLimit = 14;

/* 함수 이름 → 양동이. 여기 없는 이름이 나오면 '기타'로 모아서 끝에
   찍는다. 조용히 버리면 그 순간 이 벤치도 거짓말이 된다. */
const GAIN = {
  endTurn:'자연회복', useItem:'물약', campRest:'모닥불', grantBoon:'제단',
  eventApi:'사건', cast:'치유주문',
  quarry:'전투회복', drainLife:'전투회복', spellDrain:'전투회복',
  onKill:'전투회복', hurtMonster:'전투회복',
  enterDepth:'층진입', gainXp:'레벨업', createHero:'생성', death:'사망처리',
  recalc:'천장정산',
  /* 죽는 순간 음수 체력을 0으로 세우는 세 자리. 양수 델타지만 회복이
     아니다 — 안 걸러 내면 「전투가 돌려준 것」이 죽을 때마다 부풀었다. */
  monsterMelee:'사망처리', monsterShot:'사망처리', hazardTick:'사망처리',
};
const LOSS = {
  hurtPlayer:'피해', recalc:'상처정산', enterDepth:'층진입비용',
  useItem:'물약대가', cast:'주문대가', grantBoon:'제단대가',
  eventApi:'사건대가', death:'사망처리',
};

const GAIN_ORDER = ['자연회복','물약','모닥불','제단','사건','치유주문','전투회복','층진입','기타'];

/* 층 → { lost, gained:{출처:양}, levelup, turns } */
const floors = new Map();
const bucket = d => {
  if (!floors.has(d)) floors.set(d, { lost:0, gain:{}, levelup:0, ceil:0, n:0 });
  return floors.get(d);
};
const unknown = new Map();

function who(map) {
  const st = new Error().stack || '';
  for (const line of st.split('\n').slice(2)) {
    /* 「at Module.campRest」처럼 앞에 네임스페이스가 붙는다. 앞부분을
       이름으로 읽으면 모든 export가 'Module'이 되어 절반이 미분류로
       떨어진다 — 처음에 그렇게 나왔고, 회복의 49%가 「기타」였다. */
    const m = line.match(/at (?:async )?(?:[\w$.]*\.)?([A-Za-z_$][\w$]*)/);
    if (!m) continue;
    const n = m[1];
    if (n === 'set' || n === 'hpSet' || n === 'Object') continue;
    if (map[n]) return map[n];
    /* 아는 이름이 나올 때까지 더 내려가되, game.js 바깥으로 나가면
       포기한다 — 봇이 직접 hp를 만졌다는 뜻이고 그건 측정 오염이다. */
    if (!line.includes('game.js')) break;
    unknown.set(n, (unknown.get(n) || 0) + 1);
  }
  return null;
}

function hook(p) {
  if (!p || Object.getOwnPropertyDescriptor(p, '__hp')) return;
  let v = p.hp;
  Object.defineProperty(p, '__hp', { value:true, enumerable:false, writable:true });
  Object.defineProperty(p, 'hp', {
    enumerable: true, configurable: true,
    get() { return v; },
    set(nv) {
      const d = nv - v; v = nv;
      if (!d) return;
      const b = bucket(G.depth || 0);
      if (d > 0) {
        const src = who(GAIN) || '기타';
        if (src === '기타' && process.env.MEND_DEBUG)
          console.log('GAIN?', d.toFixed(1), '\n' + (new Error().stack || '').split('\n').slice(2, 6).join('\n'));
        if (src === '레벨업') b.levelup += d;
        else if (src === '생성' || src === '사망처리') { /* 판 밖 */ }
        else b.gain[src] = (b.gain[src] || 0) + d;
      } else {
        const src = who(LOSS) || '기타';
        if (src === '사망처리') return;      // 죽고 나서 1로 세우는 것
        if (src === '상처정산') b.ceil += -d;
        else b.lost += -d;
      }
    },
  });
}

let installed = false;
function installPlayerHook() {
  if (installed) return; installed = true;
  let cur = G.player;
  Object.defineProperty(G, 'player', {
    enumerable: true, configurable: true,
    get() { return cur; },
    set(np) { cur = np; hook(np); },
  });
  hook(cur);
}
installPlayerHook();

const N = Number(process.argv[2] || 30);
const KEEP = process.argv.includes('--keep');
const CLASSES = ['warrior','rogue','mage','priest','ranger','paladin'];
let runs = 0, depthSum = 0, stuck = 0;
const seen = new Set();

/* ── 물약을 쥔 채로 내려가게 한다 ──────────────────────────
   이 벤치를 처음 돌렸을 때 물약이 회복의 0%로 나왔다. 게임이 아니라
   봇이었다: `canSalvage`가 `kind === 'use'`를 참으로 돌려주고, 봇의
   「남는 건 부순다」 줄이 그것을 곧이곧대로 따른다. 그래서 봇은 마을에서
   물약 열 개와 횃불 두 개를 전부 쇳조각으로 갈아 넣고, **소모품 없이**
   1층에 내려간다. 이 하네스의 모든 판이 그랬다.

   여기서 규칙 파일은 못 고치므로, 재는 쪽에서 물약에 「부술 수 없는 것」
   표식을 붙인다(canSalvage가 보는 유일한 탈출구다). 공유 테이블이
   오염되지 않도록 배낭 안의 사본에만 붙인다. */
/* 그런데 지키기만 하면 반대쪽 끝으로 간다: 소모품 더미는 **상한이
   없고 배낭 한 칸**이다(slotCost는 수량을 안 본다). 실제로 재 보니
   봇이 물약 172개를 들고 죽었다. 무한한 물약으로 재는 회복률은
   무한한 체력으로 재는 난이도와 같은 종류의 거짓말이다.
   그래서 --cap 으로 더미 상한을 걸고 셋을 나란히 본다. */
const CAP = (() => { const i = process.argv.indexOf('--cap');
  return i > 0 ? Number(process.argv[i+1]) : 0; })();
const keepPots = g => {
  const p = g.player; if (!p) return;
  for (const s of p.pack) {
    const it = s.item;
    const soft = it.use === 'heal' || it.use === 'bigHeal' || it.use === 'mana' || it.use === 'torch';
    if (!soft) continue;
    if (!it.unique) s.item = { ...it, unique: 'keep' };
    if (CAP && (it.use === 'heal' || it.use === 'bigHeal') && s.qty > CAP) s.qty = CAP;
  }
};

for (let i = 0; i < N; i++) {
  const r = runBot('human', CLASSES[i % CLASSES.length], i % 2 === 0,
                   KEEP ? { onTurn: keepPots } : {});
  runs++; depthSum += r.depth; if (r.stuck) stuck++;
  for (let d = 1; d <= r.depth; d++) bucket(d).n++;
  seen.add(r.depth);
}

/* ── 보고 ─────────────────────────────────────────────── */
console.log(`\n회복 경제 벤치 — 층이 뺏은 것 대 되돌려 준 것 (${runs}판 · 평균 ${(depthSum/runs).toFixed(1)}층`
  + `${stuck ? ` · 막힘 ${stuck}` : ''}) — 소모품 `
  + `${KEEP ? (CAP ? `쥐고 내려감 · 더미 상한 ${CAP}` : '쥐고 내려감 · 상한 없음')
            : '봇이 마을에서 전부 부숨(하네스 기본값)'}\n`);

const ds = [...floors.keys()].filter(d => d >= 1).sort((a,b)=>a-b);
const totals = { lost:0, ceil:0, levelup:0, gain:{} };

console.log('  층   판   잃음   되찾음  회복률   자연  물약  모닥불  제단  사건  주문  전투');
for (const d of ds) {
  const b = floors.get(d);
  if (!b.n) continue;
  const got = Object.values(b.gain).reduce((a,c)=>a+c,0);
  totals.lost += b.lost; totals.ceil += b.ceil; totals.levelup += b.levelup;
  for (const [k,v] of Object.entries(b.gain)) totals.gain[k] = (totals.gain[k]||0)+v;
  const per = x => (x / b.n).toFixed(0).padStart(5);
  const pc  = k => String(Math.round((b.gain[k]||0) * 100 / Math.max(1, b.lost))).padStart(4);
  console.log(`  ${String(d).padStart(2)} ${String(b.n).padStart(4)} ${per(b.lost)} ${per(got)}`
    + `  ${String(Math.round(got*100/Math.max(1,b.lost))).padStart(4)}%`
    + `  ${pc('자연회복')} ${pc('물약')} ${pc('모닥불')}  ${pc('제단')} ${pc('사건')} ${pc('치유주문')} ${pc('전투회복')}`);
}

const gotAll = Object.values(totals.gain).reduce((a,c)=>a+c,0);
console.log(`\n  ── 전체 (판 밖 제외) ──`);
console.log(`     잃은 체력      ${Math.round(totals.lost)}`);
console.log(`     되찾은 체력    ${Math.round(gotAll)}   → 회복률 ${(gotAll*100/Math.max(1,totals.lost)).toFixed(1)}%`);
console.log(`     상처가 깎은 천장 ${Math.round(totals.ceil)} (되돌아오지 않는 몫)`);
console.log(`     레벨업이 채운 몫 ${Math.round(totals.levelup)} (그릇이 커진 것 — 회복이 아니다)\n`);

for (const k of GAIN_ORDER) {
  const v = totals.gain[k] || 0;
  if (!v) continue;
  const share = v * 100 / Math.max(1, gotAll);
  console.log(`     ${k.padEnd(6)} ${String(Math.round(v)).padStart(6)}  ${String(Math.round(share)).padStart(3)}% of 회복`
    + `  ·  잃은 것의 ${String(Math.round(v*100/Math.max(1,totals.lost))).padStart(3)}%`
    + `  ${'█'.repeat(Math.round(share/2))}`);
}

if (unknown.size) {
  console.log('\n     스택에서 못 알아본 이름 (양동이 밖) — 이게 크면 위 숫자를 믿지 말 것:');
  for (const [k,v] of [...unknown].sort((a,b)=>b[1]-a[1]).slice(0,8))
    console.log(`       ${k} ×${v}`);
}
const other = totals.gain['기타'] || 0;
console.log(`\n     출처를 못 가른 회복 ${Math.round(other)} (${(other*100/Math.max(1,gotAll)).toFixed(1)}%)`);

console.log(`\n  회복률이 100%에 가까우면 층은 아무것도 뺏지 않은 것이다 —`
  + ` 판이 앞으로 나아가는 유일한 압력은 상처가 깎은 천장뿐이다.\n`);

/* ── 판정 ─────────────────────────────────────────────────
   이 파일에는 단언이 없었다. 회복 경제를 처음으로 재는 벤치인데
   ✗를 인쇄하고도 0으로 끝나면, 다음에 누가 물약 하나를 만졌을 때
   아무도 안 울린다. 아래 값은 전부 이 파일이 실제로 잰 값에서 왔다. */
let bad = 0;
const ok = (c, msg, got) => {
  console.log(`  ${c ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!c) bad++;
};
const rate = totals.lost ? gotAll / totals.lost : 0;
const potShare = (totals.gain['물약'] || 0) / Math.max(1, gotAll);
const otherShare = (totals.gain['기타'] || 0) / Math.max(1, gotAll);

console.log('');
ok(otherShare < 0.08,
   '출처를 못 가른 회복이 8% 미만이다 — 이게 크면 위 표 전체를 못 믿는다',
   `${(otherShare * 100).toFixed(1)}%`);
/* ── 아래 둘은 아직 단언이 아니다 ─────────────────────────
   회복률 92%와 물약 몫 59%는 **고쳐지지 않은 설계 문제**이지 회귀가
   아니다. 여기에 목표치를 단언으로 걸면 스위트가 영구히 빨개지고,
   그러면 「벤치가 빨간 게 정상」이 학습된다 — 이 리포에서 가장 위험한
   상태다. 반대로 지금 값에 맞춰 문턱을 낮추면 그건 벤치를 내 편으로
   만드는 것이고, 더 나쁘다.

   그래서 목표를 **인쇄하되 판정하지 않는다.** 회복 공급을 실제로
   손대는 판(모닥불 밀도, 상점 재고)에서 이 두 줄을 단언으로 올린다.

   손잡이를 훑어 본 기록: STACK_MAX 8 → 6 → 4에서 회복률이
   92.3% → 89.9% → 89.6%. 더미 상한은 이 문제의 손잡이가 아니다 —
   봇이 층마다 상점에서 다시 사기 때문이고, 진짜 손잡이는 공급 쪽
   (모닥불이 1.6층에 하나, 상점 재고 무한)이다. */
/* ── 이 자의 흔들림을 처음으로 쟀다 ────────────────────────
   여태 이 파일을 한 판 돌려서 나온 회복률을 그대로 인용해 왔다.
   같은 코드로 세 판을 재 보니 **85.3% · 82.8% · 77.2%** 다 — 폭이
   8.1%p 이고, 30판의 도달 층이 판마다 다르기 때문이다(깊은 층의
   회복률이 얕은 층보다 20~40%p 높으므로 어디까지 갔는지가 곧
   가중치가 된다).

   그래서 **한 판의 차이로는 회복 손잡이를 판정할 수 없다.** 실제로
   그렇게 속았다: 물약 내성에 깊이 항을 넣고(83.6 → 77.9) 「좋아졌다」고
   읽었는데, 그 5.7%p 가 통째로 이 폭 안이었다. 그다음 손잡이(깊은
   층에서 걸어도 안 삭게)는 81.9% 가 나와 「나빠졌다」고 읽힐 수도
   있었다. 둘 다 되돌렸다.

   손잡이를 손대는 판은 `--batches 3` 로 돌려 **중앙값과 폭**을 같이
   적을 것. 목표(70%)까지의 거리가 13%p 이므로 폭 8%p 안에서는 두세
   배치가 필요하다. */
const RATE_GOAL = 0.70, POT_GOAL = 0.45;
const NOISE = 8.1;          // 같은 코드 세 판의 폭 (85.3 · 82.8 · 77.2)
console.log(`  (목표) 회복률 ${(rate * 100).toFixed(1)}% → ${RATE_GOAL * 100}% 이하`
  + `  ·  물약 몫 ${(potShare * 100).toFixed(1)}% → ${POT_GOAL * 100}% 이하`);
console.log(`  (목표) 위 둘은 아직 판정하지 않는다 — 공급을 손대는 판에서 단언으로 올린다`);
console.log(`  (자의 폭) 같은 코드 세 판이 ${NOISE}%p 만큼 흔들린다 —`
  + ` 한 판의 차이로 손잡이를 판정하지 말 것 (판수를 올리거나 배치 셋의 중앙값으로)`);

console.log(bad ? `\n회복 벤치: ${bad}건 실패\n` : '\n회복 벤치: 통과\n');
process.exit(bad ? 1 : 0);
