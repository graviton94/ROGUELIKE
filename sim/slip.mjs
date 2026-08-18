/* ═══════════════════════════════════════════════════════════
   slip.mjs — 「발」이 세어지는가

   유물의 어휘 여섯(몸·손·혀·눈·발·주머니) 중 **발만 셀 수 있는
   동사가 없었다.** 장부에 여덟이 있었는데 은신과 이동을 세는 것이
   하나도 없다. 그러면:

     · 발을 주거나 가져가는 유물의 무게를 못 단다
     · 그 유물들의 크랙 조건을 태그에서 못 뽑는다
     · sim/synergy.mjs 의 어휘 표에서 그 줄만 비어 있다

   자리가 하나 비어 있으면 거기 들어올 유물은 태어날 때부터 잴 수
   없는 물건이 된다. 그래서 유물 시스템을 다시 짓기 **전에** 이것부터
   만든다.

   이 파일이 무는 것 셋:
     1. 실제로 찬다 (판당 0이면 만들어진 적이 없는 동사다)
     2. **판 길이를 다시 재는 것이 아니다** — 이게 제일 중요하다.
        「아무도 안 볼 때」로 셌으면 층에 처음 들어선 순간 전부 자고
        있으므로 그 값은 판 길이와 거의 같아진다. 유물 벤치가 floor
        갈래에서 이미 그 함정에 빠졌다(열한 개가 전부 「도적 것」으로
        찍혔는데, 도적이 가장 깊이 가기 때문이었다).
     3. 직업을 가른다 — 안 가르면 무게를 달 수 없고, 무게를 못 달면
        이 동사를 만든 이유가 없어진다

   usage: node sim/slip.mjs [판수]
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const { runBot } = await import('./_botlib.mjs');
const { G } = Game;

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };
const CLS = ['warrior', 'rogue', 'ranger', 'mage', 'priest', 'paladin'];
const KO = { warrior:'전사', rogue:'도적', ranger:'궁수', mage:'마법사', priest:'사제', paladin:'팔라딘' };
const N = Math.max(8, Number(process.argv[2]) || 16);
const med = a => { const b = a.slice().sort((x, y) => x - y); const n = b.length;
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };

console.log(`\n발 벤치 — 은신을 세는 동사 (직업 ${N}판씩)\n`);
const runs = {};
for (const cls of CLS) {
  runs[cls] = [];
  for (let i = 0; i < N; i++) {
    Meta.forget();
    const r = runBot('human', cls, i % 2 === 0);
    runs[cls].push({ turn: r.turn, slip: (G.ledger?.slip || 0),
                     hit: (G.ledger?.hit || 0) });
  }
}
console.log('  직업       판 길이   slip   100턴당   판 길이와의 상관');
/* 상관계수. 1에 가까우면 이 동사는 「오래 살았다」를 다시 적은 것이다. */
const corr = (xs, ys) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
};
const rate = {};
for (const cls of CLS) {
  const R = runs[cls];
  /* 비율도 평균으로 본다. 중앙값이 0인 직업이 있으면 아래 배수가
     0으로 나눠지고, 그러면 자가 갈라짐이 아니라 희소함을 잰다. */
  rate[cls] = R.reduce((a, r) => a + r.slip / Math.max(1, r.turn) * 100, 0) / R.length;
  console.log(`  ${KO[cls].padEnd(5)} ${String(Math.round(med(R.map(r => r.turn)))).padStart(8)}`
    + `${String(Math.round(med(R.map(r => r.slip)))).padStart(7)}`
    + `${rate[cls].toFixed(2).padStart(9)}`
    + `${corr(R.map(r => r.turn), R.map(r => r.slip)).toFixed(2).padStart(14)}`);
}
console.log('');

/* ── 1. 실제로 차는가 ───────────────────────────────────────
   중앙값으로 물었더니 사제가 판마다 0과 1을 오가며 판정이 뒤집혔다.
   이 동사는 드문 직업에서 판당 0~2회이므로 **중앙값이 0인 것이
   정상**이고, 물어야 할 것은 「이 직업이 이 동사를 만들 수 있는가」다.
   표본 전체의 합으로 묻는다 — 진짜 0(그 직업에게는 없는 어휘)이면
   합도 0이다. */
const total = {};
for (const c of CLS) total[c] = runs[c].reduce((a, r) => a + r.slip, 0);
const dead = CLS.filter(c => total[c] === 0);
ok(!dead.length, '여섯 직업 전부 실제로 이 동사를 만든다 — 0인 직업이 있으면 그 직업에게는 없는 어휘다',
   dead.length ? dead.map(c => KO[c]).join(' ') : CLS.map(c => `${KO[c]} ${total[c]}`).join(' · '));

/* ── 2. 판 길이를 다시 재는 것이 아닌가 ────────────────────
   비율(100턴당)이 직업마다 갈리면 이건 길이가 아니라 **성질**이다.
   길이를 다시 적은 동사라면 100턴당 값이 여섯 다 같아진다. */
const lo = Math.min(...CLS.map(c => rate[c])), hi = Math.max(...CLS.map(c => rate[c]));
ok(hi / Math.max(0.01, lo) >= 1.5,
   '100턴당 값이 직업마다 갈린다 — 안 갈리면 이 동사는 판 길이를 다시 적은 것이다',
   `${hi.toFixed(1)} / ${lo.toFixed(1)} = ${(hi / Math.max(0.01, lo)).toFixed(1)}배`);

/* ── 3. 이미 있는 동사의 사본이 아닌가 ─────────────────────
   맞은 수(hit)와 순서가 같으면 새 어휘가 아니라 「몸」의 뒷면이다.
   발이 가벼운 직업은 덜 맞으므로 **반대로** 가야 옳다. */
const order = CLS.slice().sort((a, b) => rate[b] - rate[a]).map(c => KO[c]);
const hitRate = {}; for (const c of CLS)
  hitRate[c] = med(runs[c].map(r => r.hit / Math.max(1, r.turn) * 100));
const hitOrder = CLS.slice().sort((a, b) => hitRate[b] - hitRate[a]).map(c => KO[c]);
console.log(`  발 순서  ${order.join(' > ')}`);
console.log(`  몸 순서  ${hitOrder.join(' > ')}`);
ok(order[0] !== hitOrder[0],
   '가장 발이 가벼운 직업과 가장 많이 맞는 직업이 다르다 — 같으면 「몸」의 사본이다',
   `발 ${order[0]} · 몸 ${hitOrder[0]}`);

console.log(bad ? `\n발 벤치: ${bad}건 실패\n`
                : '\n발 벤치: 찬다 · 길이가 아니라 성질이다 · 몸의 사본이 아니다\n');
process.exit(bad ? 1 : 0);
