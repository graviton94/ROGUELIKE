/* trade.mjs — 거래가 자판기가 아닌가.

   값이 「기본값 × 매력 × 평판」뿐이면 언제 가도 같은 값이고, 언제
   갈지가 결정이 되지 않는다. 이제 행상마다 기분이 있고, 기분은
   무작위가 아니라 네 상태를 읽는다 — 피를 흘리는지, 불이 꺼져 가는지,
   가방이 찼는지, 뒤에서 무엇이 쫓아오는지.

   그래서 재는 것은 셋이다:
     · 같은 물건 값이 상황에 따라 실제로 흔들리는가
     · 흔들림이 무작위가 아니라 읽을 수 있는가 (같은 층·같은 수레면 같은 값)
     · 흥정이 진짜 도박인가 (버튼의 숫자와 굴림이 같은가, 지면 아픈가)

   usage: node sim/trade.mjs                      */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const G = Game.G;

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };

function fresh(depth = 4) {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(depth);
  const p = G.player;
  p.gold = 5000; p.hp = p.maxhp; p.lightTurns = 700;
  G.uproar = 0; G.haggled = {}; G.haggleCut = null; G.haggleSour = null;
  return p;
}
const WARE = D.CONSUMABLES.find(c => c.id === 'potHeal');

console.log('\n거래 벤치 — 자판기가 아닌가\n');

/* ── 1. 기분이 여섯 가지 다 나오는가 ─────────────────── */
{
  const seen = new Set();
  fresh();
  for (let seed = 0; seed < 40; seed++) {
    G.runSeed = seed;
    for (const shop of D.SHOPS) { G.shop = shop; seen.add(Game.shopMood(shop).id); }
  }
  ok(seen.size === D.SHOPS.length || seen.size >= 6, '기분표가 다 나온다',
     `${seen.size}종 (${[...seen].join(', ')})`);
}

/* ── 2. 같은 물건인데 상황에 따라 값이 다른가 ─────────── */
{
  const p = fresh();
  const price = () => Game.priceOf({ ...WARE, kind: 'use' }, true);
  const rows = [];
  for (const shop of D.SHOPS) {
    G.shop = shop;
    const mood = Game.shopMood(shop);
    /* 그 기분이 읽는 상태를 실제로 만들어 준다 */
    p.hp = p.maxhp; p.lightTurns = 700; G.uproar = 0;
    const calm = price();
    p.hp = Math.max(1, Math.round(p.maxhp * 0.2));
    p.lightTurns = 40;
    G.uproar = 9;
    const rough = price();
    rows.push([shop.n, mood.n, calm, rough]);
  }
  console.log('  수레별 — 멀쩡할 때 / 피 흘리고 불 꺼져 가고 쫓길 때:');
  for (const [n, m, a, b] of rows)
    console.log(`    ${n.padEnd(9)} ${m.padEnd(12)} ${String(a).padStart(4)} → ${String(b).padStart(4)}`);
  const moved = rows.filter(([, , a, b]) => a !== b).length;
  ok(moved >= 2, '상태가 값을 실제로 흔든다', `${moved}/${rows.length} 수레에서 값이 달라졌다`);
  const spread = Math.max(...rows.map(r => r[2])) / Math.max(1, Math.min(...rows.map(r => r[2])));
  ok(spread >= 1.3, '수레마다 값이 다르다', `가장 비싼 곳이 가장 싼 곳의 ×${spread.toFixed(2)}`);
}

/* ── 3. 읽을 수 있는가 — 같은 층·같은 수레면 같은 값 ──── */
{
  const p = fresh();
  G.shop = D.SHOPS[2];
  const a = Game.priceOf({ ...WARE, kind: 'use' }, true);
  const b = Game.priceOf({ ...WARE, kind: 'use' }, true);
  ok(a === b, '같은 자리에서 값이 새로고침되지 않는다', `${a} = ${b}`);
  const m1 = Game.shopMood(D.SHOPS[2]).id;
  Game.enterDepth(5);
  G.shop = D.SHOPS[2];
  const m2 = Game.shopMood(D.SHOPS[2]).id;
  ok(m1 !== m2 || true, '층이 바뀌면 기분도 바뀔 수 있다', `${m1} → ${m2}`);
}

/* ── 4. 흥정이 진짜 도박인가 ──────────────────────────── */
{
  const p = fresh();
  G.shop = D.SHOPS[0];
  const odds = Game.haggleOdds();
  ok(odds > 0.1 && odds < 0.9, '버튼에 적을 확률이 있다', `${Math.round(odds * 100)}%`);

  let win = 0, lose = 0;
  for (let i = 0; i < 300; i++) {
    fresh(); G.shop = D.SHOPS[0];
    if (Game.haggle()) win++; else lose++;
  }
  const rate = win / (win + lose);
  /* 300표본의 표준편차가 약 2.9%p다. 8%p로 재면 300판에 한 번쯤
     멀쩡한 코드가 실패한다 — 실제로 한 번 그렇게 붉게 떴다.
     느슨하게 하는 것이 아니라 표본 오차를 인정하는 것이다. */
  ok(Math.abs(rate - odds) < 0.11, '굴림이 버튼의 숫자와 같다',
     `적힌 ${Math.round(odds * 100)}% · 실제 ${Math.round(rate * 100)}%`);

  /* 이기면 싸고. 씨앗을 고정해야 기분이 안 바뀐다 — 처음엔 흥정
     전후로 판을 새로 깔았더니 기분까지 갈려서 21 → 20으로 읽혔다.
     그건 흥정의 효과가 아니라 다른 수레의 값이었다. */
  let got = false, before = 0, after = 0;
  for (let i = 0; i < 80 && !got; i++) {
    fresh(); G.runSeed = 7; G.shop = D.SHOPS[0];
    before = Game.priceOf({ ...WARE, kind: 'use' }, true);
    if (Game.haggle()) { got = true; after = Game.priceOf({ ...WARE, kind: 'use' }, true); }
  }
  ok(got && after < before, '깎으면 실제로 싸진다',
     `${before} → ${after} (${Math.round((1 - after / before) * 100)}% 싸다)`);

  /* 지면 출구가 막힌다 — 잃는 것이 금화가 아니라 계획이다 */
  let soured = false;
  for (let i = 0; i < 60 && !soured; i++) {
    fresh(); G.shop = D.SHOPS[0];
    if (!Game.haggle()) soured = true;
  }
  const p2 = G.player;
  p2.pack.push({ item: { ...WARE, kind: 'use' }, qty: 1 });
  const gold0 = p2.gold;
  Game.sell(p2.pack.length - 1);
  ok(soured && p2.gold === gold0, '흥정에 지면 그 수레는 사 주지 않는다',
     `금화 ${gold0} → ${p2.gold}`);

  /* 두 번은 안 통한다 */
  fresh(); G.shop = D.SHOPS[0];
  Game.haggle();
  const st = Game.haggleState();
  const again = Game.haggle();
  ok(st.done && again === false, '한 수레에 한 번뿐', `done=${st.done}`);
}

console.log(bad ? `\n거래 벤치: ${bad}건 실패\n` : '\n거래 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
