/* cliff.mjs — 죽음이 절벽인가 비탈인가.

   whodies가 말한 것: 끝나기 10턴 전 체력 70%, 5턴 전 68%. 그리고
   죽음. 열 턴 동안 2%p를 잃고 다섯 턴 만에 68%를 잃는다는 뜻이고,
   그것이 「판의 대부분을 멀쩡하게 걷는다」의 진짜 원인이었다.
   회복이 후한 게 아니라, 죽기 직전까지 아무 일도 안 일어난다.

   그래서 마지막 스무 턴의 체력을 그대로 찍어 본다. 한 방이
   최대 체력의 몇 %를 가져가는지도 같이 센다 — 상한은 거기에 걸려
   있으므로, 분포의 오른쪽 꼬리가 잘렸는지가 곧 규칙이 물었는지다.

   usage: node sim/cliff.mjs [판수=6]                  */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 6);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];
const TAIL = 20;

/* 마지막 턴들의 체력을 봇 바깥에서 찍는다. 게임에 탐침용 배열을
   심지 않는다 — 규칙 파일은 규칙만 안다. */
const tail = new Array(TAIL).fill(0).map(() => []);
const blows = [];
let runs = 0, deaths = 0, wounds = 0;
const hits = [];   // 깔때기가 내보낸 한 방 하나하나 (참고용)
let worstRatio = 0;   // 깔때기 안에서 본 상한 준수 (taken/cap, 1을 못 넘어야 한다)
let ghost = 0, totalDrop = 0;   // 깔때기를 안 지나고 사라진 체력

for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    const seen = [];
    let lastHp = null, lastMax = null, lastFunnelled = 0;
    /* 매 턴 체력 비율과, 직전 턴 대비 떨어진 폭을 기록한다.
       떨어진 폭이 곧 「한 방」이다 — 회복은 음수가 되므로 버린다.
       (한 턴에 둘이 때리면 둘이 합쳐 한 건으로 세어진다. 상한이
       한 방마다 걸리므로 여기 숫자는 상한보다 커질 수 있고,
       그것은 오류가 아니라 「둘러싸였다」는 뜻이다.) */
    const onTurn = g => {
      const p = g.player;
      if (!p || !p.maxhp) return;
      seen.push(p.hp / p.maxhp);
      if (lastHp !== null && lastHp > p.hp) blows.push((lastHp - p.hp) / p.maxhp);
      /* 설명되지 않는 감소를 센다. 깔때기를 지난 피해 총량(G.funnelled)이
         늘어난 만큼을 체력 감소에서 빼면, 남는 것은 깔때기를 안 지난
         피해다 — 제단의 자발적 지불 하나만 남아야 한다. */
      if (lastHp !== null && p.hp < lastHp) {
        const dropped = lastHp - p.hp;
        const viaFunnel = (g.funnelled || 0) - lastFunnelled;
        const unexplained = dropped - viaFunnel;
        if (unexplained > 0) ghost += unexplained;
        totalDrop += dropped;
      }
      lastFunnelled = g.funnelled || 0;
      lastHp = p.hp;
      /* 그리고 **진짜 한 방**은 깔때기가 내보내는 이벤트에 있다.
         위의 턴 차이는 둘러싸이면 합쳐지므로 상한을 재는 데 못 쓴다 —
         그걸 모르고 여기에 상한 단언을 걸었다가 109%로 실패했는데,
         이 파일의 주석이 이미 「합쳐진다」고 적어 두고 있었다.
         재려는 것이 무엇인지부터 읽었어야 했다. */
      /* 분모는 **맞기 전의 천장**이다. 상한은 맞는 순간의 천장에
         걸리는데, 그 한 방이 상처를 남기면 recalc이 천장을 즉시
         깎으므로 지금 나누면 비율이 부풀어 오른다. 실제로 58.3%가
         나와서 「우회가 남았다」고 판정했는데, 0.32 ÷ (1−0.45) =
         0.58 — 상한은 멀쩡했고 분모가 줄어든 것이었다.
         그리고 이 착시 자체가 상처 나선이 하는 일이다. */
      for (const e of (g.fx || []))
        if (e.t === 'hit' && e.on === 'player' && e.dmg > 0)
          /* 둘 중 큰 쪽으로 나눈다. 상처는 천장을 **줄이고** 레벨업은
             **늘린다** — 앞쪽만 막았더니 레벨업한 턴의 한 방이 42.9%로
             부풀어서, 우회를 되살린 판(44.0%)과 구별이 안 됐다.
             여유 1.35가 그 차이를 가리고 있었다. */
          hits.push(e.dmg / Math.max(lastMax || 0, p.maxhp));
      lastMax = p.maxhp;
    };
    const r = runBot('human', cls, i % 2 === 0, { onTurn });
    worstRatio = Math.max(worstRatio, G.blowRatio || 0);
    runs++;
    if (!r.win) deaths++;
    wounds += (G.player?.wound || 0) / Math.max(1, (G.player?.maxhp || 1) + (G.player?.wound || 0));
    const cut = seen.slice(-TAIL);
    for (let k = 0; k < cut.length; k++) tail[TAIL - cut.length + k].push(cut[k]);
  }
}

const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log(`\n절벽 벤치 — ${runs}판 · 죽음 ${deaths}\n`);
console.log('끝나기 전 마지막 스무 턴의 체력:');
for (let k = 0; k < TAIL; k++) {
  const v = avg(tail[k]) * 100;
  console.log(`  −${String(TAIL - k).padStart(2)}턴  ${String(Math.round(v)).padStart(3)}%  ${'█'.repeat(Math.round(v / 3))}`);
}

blows.sort((a, b) => a - b);
const q = f => blows.length ? blows[Math.floor(blows.length * f)] : 0;
console.log(`\n한 번에 잃은 체력 (${blows.length}건):`);
console.log(`  가운데값 ${(q(0.5) * 100).toFixed(1)}%  ·  상위 5% ${(q(0.95) * 100).toFixed(1)}%  ·  최대 ${(blows.at(-1) * 100).toFixed(1)}%`);
console.log(`  최대 체력의 30%를 넘긴 한 방: ${(blows.filter(b => b > 0.30).length * 100 / Math.max(1, blows.length)).toFixed(1)}%`);
console.log(`\n죽을 때 상처로 잃은 몸: 평균 ${(wounds / runs * 100).toFixed(0)}%\n`);

/* ── 상한이 실제로 서 있는가 ──────────────────────────────
   이 벤치는 지금까지 「최대 체력의 106%를 한 방에」를 **인쇄만** 하고
   통과했다. BLOW_CAP이 0.32인 게임에서 106%가 찍히는데 아무도 안
   울렸다는 뜻이고, 그동안 함정 여덟 곳이 깔때기를 우회하고 있었다.
   숫자를 재기만 하고 잠그지 않으면 그 숫자는 장식이다.

   여유를 둔다: 상처(wound)가 천장을 깎으면 **같은 절대 피해가 더 큰
   비율**로 찍히므로, 상한 자체는 지켜져도 비율은 0.32를 넘을 수 있다.
   막아야 하는 것은 「상한이 없는 피해원」이지 반올림이 아니다. */
const CAP = Game.BLOW_CAP ?? 0.32;
hits.sort((a, b) => a - b);
/* 바깥에서 잰 값은 참고로만 인쇄한다. 판정은 깔때기가 자기 안에서
   기록한 비율(G.blowRatio)로 한다 — 분모를 세 번 틀리고 내린 결론이다. */
const over = hits.filter(b => b > CAP * 1.05);
const worst = worstRatio;
console.log(`\n깔때기가 내보낸 한 방 ${hits.length}건 — 가운데값 ${(hits[hits.length >> 1] * 100 || 0).toFixed(1)}%`
  + ` · 최대 ${(worst * 100).toFixed(1)}% (상한 ${(CAP * 100).toFixed(0)}%)`);
let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};
ok(hits.length > 50, '한 방을 셀 만큼 맞았다', `${hits.length}건`);
ok(worst <= 1.0001,
   '깔때기를 지난 한 방은 상한을 넘지 않는다 (taken/cap)',
   `최대 ${worst.toFixed(3)}`);
/* 그리고 진짜 질문: 깔때기를 **안 지나고** 사라진 체력이 있는가.
   제단의 자발적 지불(현재 체력의 40%)만 남아야 한다. */
const ghostPct = totalDrop ? ghost / totalDrop * 100 : 0;
console.log(`  잃은 체력 ${Math.round(totalDrop)} 중 깔때기를 안 지난 것 ${Math.round(ghost)} (${ghostPct.toFixed(1)}%)`);
/* 문턱 6%. 기준선이 2.5~3.9%로 흔들리고, 함정 한 곳만 되살려도
   8.4%가 된다 — 두 상태 사이에 놓는다. 실패를 피하려고가 아니라
   갈리는 자리에. */
ok(ghostPct < 6,
   '깔때기를 안 지나고 사라지는 체력이 8% 미만이다 — 제단의 자발적 지불 말고는 없어야 한다',
   `${ghostPct.toFixed(1)}%`);
ok(over.length / Math.max(1, hits.length) < 0.02,
   '바깥에서 재도 상한 근처를 크게 벗어나는 건이 2% 미만이다 (참고 측정)',
   `${over.length}/${hits.length}건`);
console.log(bad ? `\n절벽 벤치: ${bad}건 실패\n` : '\n절벽 벤치: 상한이 서 있다\n');
process.exit(bad ? 1 : 0);
