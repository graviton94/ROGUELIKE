/* ═══════════════════════════════════════════════════════════
   purse.mjs — 이 게임의 돈이 무슨 일을 하는가

   플레이어의 말: 「이 게임의 재화가치도 총 리뉴얼 필요. 분해와 판매,
   재료 역할 등 전체적으로 지금 밸런스 깨짐」.

   고치기 전에 잰다. 재는 것은 넷이다:

     1. 팔기와 부수기 중 어느 쪽이 이득인가 — 한쪽이 늘 이기면
        「팔까 부술까」는 결정이 아니라 **오답 하나가 붙은 버튼**이다.
     2. 재료 셋이 각각 쓸 데가 있는가 — 나가는 구멍이 없는 재료는
        재료가 아니라 점수다.
     3. 판이 끝날 때 얼마가 남는가 — 남는 것이 많으면 그 재화는
        판에서 아무 결정도 안 시킨 것이다.
     4. 깊이에 따라 값이 따라오는가 — 15층의 물건이 3층 값이면
        후반의 상인은 장식이다.

   1번은 봇 없이 잴 수 있다. 값은 전부 worthOf 하나에서 나오므로
   표를 세우면 답이 나온다 — 봇을 돌려서 답을 흐리게 만들 이유가 없다.

   usage: node sim/purse.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('/home/user/ROGUELIKE/src/meta.js');
const Game = await import('/home/user/ROGUELIKE/src/game.js');
const D    = await import('/home/user/ROGUELIKE/src/data.js');
const { runBot } = await import('/home/user/ROGUELIKE/sim/_botlib.mjs');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

console.log('\n지갑 벤치 — 팔까, 부술까, 낄까\n');

/* ── 1. 팔기 대 부수기 ──────────────────────────────────
   같은 물건을 두 방식으로 넘기고 금화로 환산한다. 재료의 금화 값은
   상인이 그것을 파는 값(MATS.cost)으로 읽는다 — 「사지 않아도 되는
   금액」이 곧 그 재료가 나에게 주는 값이다.               */
Meta.forget();
Game.startGame('human', 'warrior', Game.rollStats('warrior'));
Game.descend();
const matGold = y => y.scrap * D.MATS.scrap.cost + y.dust * D.MATS.dust.cost
               + y.essence * D.MATS.essence.cost;

const SAMPLES = [
  ['1층 맨 검',        { cost:40,  plus:0 }],
  ['3층 +2 검',        { cost:60,  plus:2 }],
  ['5층 속성 하나',    { cost:90,  plus:1, pre:'sharp' }],
  ['8층 이중부여 +4',  { cost:150, plus:4, pre:'sharp', suf:'ruin' }],
  ['12층 각인 둘 +7',  { cost:260, plus:7, pre:'sharp', suf:'ruin', engrave:['pierce','bleed'] }],
  ['은총 받은 것',     { cost:260, plus:6, pre:'sharp', suf:'ruin', boon:'x' }],
];
console.log('  물건                  값어치   판다   부순다  (부수기/팔기)');
const ratios = [];
for (const [n, it] of SAMPLES) {
  const w = D.worthOf(it);
  const sell = Game.priceOf(it, false);
  const y = D.salvageYield(it);
  const brk = matGold(y);
  ratios.push(brk / Math.max(1, sell));
  console.log(`  ${n.padEnd(18)}${String(w).padStart(7)}${String(sell).padStart(7)}`
    + `${String(brk).padStart(8)}   ×${(brk / Math.max(1, sell)).toFixed(2)}`
    + `   (쇳조각 ${y.scrap} · 가루 ${y.dust} · 정수 ${y.essence})`);
}
const lo = Math.min(...ratios), hi = Math.max(...ratios);
console.log('');
/* 한쪽이 늘 이기면 버튼 하나는 장식이다. 둘 다 이기는 구간이 있어야
   「이건 팔고 저건 부순다」가 생긴다. */
ok(lo < 1 && hi > 1,
   '어떤 물건은 파는 쪽이, 어떤 물건은 부수는 쪽이 이득이다 — 한쪽이 늘 이기면 버튼 하나는 장식이다',
   `부수기/팔기 ${lo.toFixed(2)}~${hi.toFixed(2)}배`);

/* ── 2. 재료 셋에 나가는 구멍이 있는가 ─────────────────── */
console.log('');
const SINKS = { scrap: [], dust: [], essence: [] };
for (const [k, c] of [['강화', D.upgradeCost(0)], ['인챈트', D.ENCHANT_COST],
                      ['재련', D.REROLL_COST], ['융합', D.FUSE_COST],
                      ['정련', D.REFINE_COST], ['조율', D.ATTUNE_COST]]) {
  for (const m of ['scrap', 'dust', 'essence'])
    if (c[m]) (SINKS[m] ||= []).push(k);
}
for (const m of ['scrap', 'dust', 'essence']) {
  const uses = [...new Set(SINKS[m])];
  console.log(`  ${D.MATS[m].n.padEnd(8)} 나가는 곳 ${uses.length ? uses.join(' · ') : '없음'}`);
}
ok(['scrap','dust','essence'].every(m => SINKS[m].length),
   '재료 셋이 전부 나가는 구멍을 갖는다 — 구멍 없는 재료는 재료가 아니라 점수다');
/* 쇳조각이 강화 하나뿐인 것은 괜찮다 — 그쪽은 **양**의 재화이고,
   강화 하나가 판 내내 108개를 먹는다. 문제는 정수였다: 재굴림
   하나에 1개씩 들어가면서 위 판정을 통과하고 있었고, 실제로는 판이
   끝날 때까지 쌓이기만 했다. 그래서 정수만 따로, 더 센 자로 잰다. */
/* 「구멍이 하나라도 있다」는 너무 약한 자였다 — 정수는 재굴림 하나에
   1개씩만 들어가면서 이 판정을 통과하고 있었고, 실제로는 판이 끝날
   때까지 쌓이기만 했다. 두 개 이상을 묻는다. */
ok([...new Set(SINKS.essence)].length >= 2,
   '정수는 나가는 곳이 둘 이상이다 — 하나뿐인 구멍은 쌓이는 것과 같다',
   [...new Set(SINKS.essence)].join(' · '));

/* 깊이가 값에 따라오는가. 잘 벼려진 12층 물건이 8층 물건보다
   확실히 더 나와야 부수는 일이 후반에도 살아 있다. */
const mid8 = D.salvageYield({ cost:150, plus:4, pre:'sharp', suf:'ruin' });
const deep = D.salvageYield({ cost:260, plus:7, pre:'sharp', suf:'ruin', engrave:['pierce','bleed'] });
ok(deep.scrap > mid8.scrap * 1.5,
   '잘 벼려진 깊은 물건은 부수면 확실히 더 나온다 — 상한이 굳어 있으면 후반의 드롭은 쓰레기가 된다',
   `쇳조각 ${mid8.scrap} → ${deep.scrap}`);

/* 그리고 그 답이 화면에 있는가. 숫자가 맞아도 안 보이면 결정이 안 된다. */
ok(!!Game.tradeLine(SAMPLES[3][1]),
   '팔 값과 부술 값이 한 줄로 같이 읽힌다 — 안 보이면 이 결정은 감으로 내려간다',
   Game.tradeLine(SAMPLES[3][1]));

/* ── 3·4. 판이 끝날 때 얼마가 남는가 ───────────────────── */
console.log('');
const runs = [];
for (let i = 0; i < 40; i++) {
  runBot('human', 'warrior', 12, { seed: i });
  const p = G.player;
  runs.push({ d: G.deepest || 1, gold: p?.gold || 0,
    earned: G.goldEarned || 0, ...(p?.mats || {}) });
}
const mid = k => { const v = runs.map(r => r[k] || 0).sort((a,b)=>a-b); return v[v.length>>1]; };
console.log(`  봇 40판 (도달 중앙 ${mid('d')}층)`);
console.log(`    번 금화 ${mid('earned')} · 죽을 때 남은 금화 ${mid('gold')}`
  + ` (${Math.round(mid('gold') / Math.max(1, mid('earned')) * 100)}% 안 씀)`);
console.log(`    남은 재료 — 쇳조각 ${mid('scrap')} · 가루 ${mid('dust')} · 정수 ${mid('essence')}`);
/* 봇은 사람처럼 안 쓴다. 그래서 이 숫자는 「밸런스가 이렇다」가 아니라
   「봇 정책으로도 이만큼 남는다」로만 읽는다 — 판정은 안 건다. */
console.log('  (봇은 사람처럼 쓰지 않는다. 위 셋은 판정하지 않고 인쇄만 한다.)');

console.log(bad ? `\n지갑 벤치: ${bad}건 실패\n` : '\n지갑 벤치: 돈이 결정을 시킨다\n');
process.exit(bad ? 1 : 0);
