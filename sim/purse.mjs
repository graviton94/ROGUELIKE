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

/* ── 손으로 고른 표본이 이 파일을 한 번 속였다 ──────────────
   위 여섯은 내가 적은 물건이다. 그 표를 보고 「깊은 물건은 부수면
   더 나온다」고 판정하고 분해 상한을 고쳤는데, **실제로 바닥에
   떨어지는 장비는 평균 +0.03에 각인 0.00**이었다. 위 표에서 그 사실을
   말해 주는 줄이 하나도 없었고, 그래서 상한을 30으로 놓아 10층 아래
   드롭을 38% 깎아 놓고 「고쳤다」고 적었다.

   손으로 고른 표본은 설계를 설명하는 데는 좋고 **판정하는 데는
   못 쓴다.** 판정은 생성기가 실제로 뱉는 것으로 한다. */
console.log('');
console.log('  실제로 바닥에 떨어진 장비 (층마다 40판 생성)');
console.log('  층    표본   평균+   각인   쇳조각중앙   부수기/팔기중앙');
const mid1 = a => { const v = a.slice().sort((x, y) => x - y); return v[v.length >> 1]; };
const realRatio = {}, realScrap = {};
for (const d of [1, 5, 8, 12, 15]) {
  const sc = [], rt = []; let plus = 0, eng = 0, n = 0;
  for (let t = 0; t < 40; t++) {
    Game.enterDepth(d);
    for (const it of G.items) {
      if (it.kind !== 'weapon' && it.kind !== 'armour') continue;
      n++; plus += it.plus || 0; eng += (it.engrave || []).length;
      const y = D.salvageYield(it);
      sc.push(y.scrap);
      rt.push(matGold(y) / Math.max(1, Game.priceOf(it, false)));
    }
  }
  realRatio[d] = mid1(rt); realScrap[d] = mid1(sc);
  console.log(`  ${String(d).padStart(2)}   ${String(n).padStart(5)}   ${(plus/n).toFixed(2)}   ${(eng/n).toFixed(2)}`
    + `      ${String(mid1(sc)).padStart(4)}         ${mid1(rt).toFixed(2)}`);
}
console.log('');
/* 옛 상한(48 고정)이 하던 일을 지키는가. 이 한 줄이 없었기 때문에
   30으로 내린 것이 통과했다. */
ok(realScrap[12] >= 48,
   '깊은 층의 **주운** 장비도 부수면 옛 상한(48)만큼은 나온다 — 여기가 실제로 부수는 물건이다',
   `12층 ${realScrap[12]} · 15층 ${realScrap[15]}`);
ok(Math.min(...[1, 5, 8, 12, 15].map(d => realRatio[d])) < 1
   && Math.max(...[1, 5, 8, 12, 15].map(d => realRatio[d])) > 1,
   '주운 장비로 재도 얕은 층은 부수는 쪽, 깊은 층은 파는 쪽이 이긴다',
   [1, 5, 8, 12, 15].map(d => `${d}층 ×${realRatio[d].toFixed(2)}`).join(' · '));
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

/* 정수를 먹는 쪽이 실제로 뭔가를 사는가. 처음에 든 유물 전부를
   목록에 올렸더니 40개 중 40개가 먹여도 숫자가 안 움직였다 — 규칙이
   유물의 v를 읽는 곳이 몇 줄뿐이고 나머지는 리터럴이었기 때문이다.
   그리고 둘은 v가 **연격 문턱**이라 먹이면 나빠졌다(6 → 9).
   구멍을 팠는데 그 구멍이 아무것도 안 주고 둘에게는 손해였다. */
console.log('');
{
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  const p = G.player;
  const shot = () => { const g = Game.gearBonus(p); return `${g.dmgPct}|${g.critMult}|${g.ac}|${p.maxhp}`; };
  const dead = [];
  for (const id of D.FEEDABLE) {
    const r = D.relicById(id);
    p.relics = [id]; p.tuned = {}; G.cracks = {}; p.grudge = 10;
    Game.recalc(p); const a = shot();
    p.tuned = { [id]: Game.attuneStep(r) * 3 };
    Game.recalc(p); const b = shot();
    if (a === b && Game.relicVal(id) <= r.v) dead.push(id);
  }
  ok(dead.length === 0, '먹일 수 있다고 적힌 유물은 전부 먹으면 숫자가 움직인다',
     dead.length ? dead.join(' ') : `${D.FEEDABLE.size}종 전부`);
  /* 문턱형이 목록에 끼면 그건 구멍이 아니라 함정이다. */
  const bad = ['echo', 'march'].filter(id => D.FEEDABLE.has(id));
  ok(bad.length === 0, 'v가 문턱인 유물은 먹이는 목록에 없다 — 올리면 나빠지는 것을 팔면 안 된다',
     bad.length ? bad.join(' ') : '메아리·진군 제외됨');
}

/* ── 3·4. 판이 끝날 때 얼마가 남는가 ───────────────────── */
console.log('');
const runs = [];
for (let i = 0; i < 40; i++) {
  runBot('human', 'warrior', true);
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


/* ── 나갈 구멍이 층을 따라가는가 ──────────────────────────
   리뷰가 잰 것: 13층에 도달한 영웅의 금화 중앙값이 12,597 인데
   인챈트 한 번이 130 — **96회분**을 들고 있었다. 그 층 실제 장비의
   평균 강화치는 +0.28이다. 돈이 남아도는 것이 아니라 나갈 구멍이
   1층 값에 묶여 있었다.

   여기서 재는 것은 「부자인가」가 아니라 **몇 회분을 들고 있는가**다.
   그 값이 층을 따라 평평해야 후반의 금화가 결정이 된다 — 백 회분은
   결정이 아니라 배경이다. */
console.log('');
{
  const rows = {};
  Meta.forget();
  for (const cls of ['warrior', 'ranger', 'rogue', 'paladin'])
    for (let i = 0; i < 10; i++)
      runBot('human', cls, true, { onTurn: () => {
        if (G.depth < 1 || G.floorTurn !== 1) return;
        (rows[G.depth] ||= []).push(G.player.gold);
      }});
  const mid2 = a => { const v = a.slice().sort((x, y) => x - y); return v[v.length >> 1]; };
  console.log('  층   금화중앙   인챈트 값   몇 회분');
  const deep = [];
  for (const d of [1, 5, 9, 11, 13]) {
    if (!rows[d]?.length) continue;
    const g = mid2(rows[d]), c = Game.anvilCost(D.ENCHANT_COST, d).gold;
    const n = Math.floor(g / Math.max(1, c));
    console.log(`  ${String(d).padStart(2)}${String(g).padStart(10)}${String(c).padStart(12)}${String(n).padStart(10)}`);
    if (d >= 9) deep.push(n);
  }
  ok(!deep.length || Math.max(...deep) <= 12,
     '후반에도 금화가 「몇 회분」으로 읽힌다 — 백 회분이면 그건 결정이 아니라 배경이다',
     deep.length ? `9층 아래 최대 ${Math.max(...deep)}회분` : '표본 없음');
}

console.log(bad ? `\n지갑 벤치: ${bad}건 실패\n` : '\n지갑 벤치: 돈이 결정을 시킨다\n');
process.exit(bad ? 1 : 0);
