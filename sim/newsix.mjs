/* ═══════════════════════════════════════════════════════════
   newsix.mjs — 빈 칸에 지은 유물 여섯

   ⑤의 마지막 순서다. 마흔을 문법으로 태그해 놓고 격자를 세어 보니
   비어 있는 자리가 셋이었다:

     · `at:'foe'` 가 마흔 중 **다섯** — 「몬스터에게 하는 일」이 없다
     · 주는 것이 `혀` 인 것 **셋**, `발` 인 것 **셋** (`손`은 열셋)

   그 자리에만 여섯을 지었다. 이 파일이 묻는 것은 「좋은 유물인가」가
   아니라 **카드에 적은 숫자가 실제로 그 숫자인가**다. 여섯 다 값을
   표(mod/uncracked/cracked)에 적었으므로, 표가 정말 그 자리까지
   흐르는지 한 번은 재야 한다 — 표에 적는 것이 switch 에 적는 것보다
   나은 이유가 「안 재도 맞는다」는 아니다.

   그리고 셋은 표 밖에 있다:
     · 사냥 나팔의 **대가** — 몬스터가 두 칸 더 멀리서 깨어난다
     · 가벼운 걸음의 **대가** — 금화 −40%
     · `cracked:{}` 라는 새 칸 — ①(선물을 민다)을 표에 앉히려고
       이번에 만들었다. 없으면 ①은 전부 switch 로 내려간다.

   ── 나팔을 재는 방법 ──
   각성은 턴마다 굴리는 확률이라 한 번 세워 보고는 판정이 안 된다.
   같은 거리에 자는 것을 세우고 한 턴만 돌리는 시행을 여러 번 해서
   **깨어난 비율**을 본다. 나팔은 그 비율을 올려야 하고, 크랙이 열리면
   안 낀 것과 같아져야 한다.

   usage: node sim/newsix.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('/home/user/ROGUELIKE/src/meta.js');
const Game = await import('/home/user/ROGUELIKE/src/game.js');
const D    = await import('/home/user/ROGUELIKE/src/data.js');
const W    = await import('/home/user/ROGUELIKE/src/world.js');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };
const f2 = v => (Math.round(v * 100) / 100).toFixed(2);

function stage(cls = 'warrior') {
  Meta.forget();
  Game.startGame('human', cls, Game.rollStats(cls));
  Game.descend(); Game.enterDepth(6);
  const L = G.level, p = G.player;
  for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = W.ROCK;
  for (let y = 10; y <= 14; y++) for (let x = 3; x <= 40; x++) L.tiles[W.idx(x, y)] = W.FLOOR;
  p.x = 10; p.y = 12; p.lightTurns = 900; p.hp = p.maxhp; p.lv = 10;
  G.monsters.length = 0; G.items.length = 0;
  Game.recalc(p); Game.refreshFov();
  return p;
}
const wear = (p, ids, crack = null) => {
  p.relics = ids;
  G.cracks = {}; if (crack) for (const id of [].concat(crack)) G.cracks[id] = 1;
  Game.recalc(p);
  return Game.gearBonus(p);
};

const SIX = ['leech', 'horn', 'plague', 'conduit', 'ash', 'swift'];

console.log('\n새 유물 여섯 — 카드에 적은 숫자가 그 숫자인가\n');

/* ═══ 1. 빈 칸을 채웠는가 ══════════════════════════════════ */
console.log('── 어느 칸을 채웠는가');
{
  const one = id => D.RELICS.find(r => r.id === id);
  const miss = SIX.filter(id => !one(id));
  ok(!miss.length, '여섯이 표에 있다', miss.length ? miss.join(' ') : SIX.map(id => one(id).n).join(' · '));
  const foe = D.RELICS.filter(r => r.at === 'foe').length;
  ok(foe >= 8, '몬스터에게 붙는 유물이 여덟은 된다 — 시작은 다섯이었다', `${foe}개`);
  for (const w of ['혀', '발']) {
    const n = D.RELICS.filter(r => r.give === w).length;
    ok(n >= 5, `주는 것이 ${w} 인 유물이 다섯은 된다 — 시작은 셋이었다`, `${n}개`);
  }
  /* 주는 말과 가져가는 말이 같으면 여섯 직업에게 같은 거래가 된다 —
     ⑤-린트가 잰 아홉이 그 아홉이고, 새로 짓는 것은 거기 안 보탠다. */
  const same = SIX.filter(id => { const r = one(id); return r.give === r.take; });
  ok(!same.length, '여섯 다 주는 말과 가져가는 말이 다르다', same.length ? same.join(' ') : '전부 다르다');
  const free = SIX.filter(id => !one(id).take);
  ok(!free.length, '여섯 다 대가가 있다', free.length ? free.join(' ') : '전부 있다');
  const nof = SIX.filter(id => !D.crackOf(id));
  ok(!nof.length, '여섯 다 두 번째 줄을 갖는다', nof.length ? nof.join(' ') : SIX.map(id => D.crackNeed(id)).join(' · '));
  /* 마흔 중 열하나가 「낀 채 N층」이었다. 새 여섯이 그 쏠림을 키우면
     안 된다 — 층 수는 유물을 쓴 값이 아니라 시간이다. */
  const byFloor = SIX.filter(id => D.crackOf(id).at[0] === 'floor');
  ok(!byFloor.length, '여섯 다 「낀 채 N층」이 아니다 — 그건 유물을 쓴 값이 아니라 시간이다',
     byFloor.length ? byFloor.join(' ') : SIX.map(id => D.crackOf(id).at[0]).join(' '));
}

/* ═══ 2. 표가 그 자리까지 흐르는가 ════════════════════════ */
console.log('\n── 표에 적은 값이 실제 값인가');
{
  const p = stage();
  const zero = wear(p, []);
  const cases = [
    /* 카드에 적힌 숫자 그대로 적는다 — 표의 v 가 아니다.
       relicVal 이 RELIC_SCALE(0.80)을 걸어서 나가므로 v 와 카드는
       다른 숫자이고, 여기서 v 를 적으면 벤치가 카드가 아니라 표를
       베끼는 자가 된다. 실제로 처음 여섯을 v 로 적었다가 여섯 다
       0.8배로 걸렸고, 그게 카드의 거짓말을 잡은 자리다. */
    ['leech',   'lifesteal', 0.20,  '준 피해를 빨아 온다'],
    ['horn',    'vsElite',   0.40,  '정예에게 더 아프다'],
    ['plague',  'pierce',    0.30,  '방어를 뚫는다'],
    ['conduit', 'spellPow',  4,     '주문 위력'],
    ['ash',     'stealth',   0.40,  '은신'],
    ['swift',   'firstStrike', 0.40, '아직 안 다친 것에게 첫 대'],
  ];
  for (const [id, key, want, what] of cases) {
    const b = wear(p, [id]);
    const got = b[key] - zero[key];
    ok(Math.abs(got - want) < 1e-9, `${D.RELICS.find(r=>r.id===id).n} — ${what}`,
       `${key} ${f2(zero[key])} → ${f2(b[key])}`);
  }
  /* 대가 쪽도 같은 표에서 나온다. 선물만 재고 넘어가면 「양날」이
     문장에만 있고 값에는 없는 유물이 생긴다 — 마흔에서 실제로 한 번
     그랬다. */
  const costs = [
    ['leech',   'hit',      -10,   '명중이 무디다'],
    ['plague',  'maxhpPct', -0.10, '천장이 낮다'],
    ['conduit', 'dmgPct',   -0.25, '근접이 무디다'],
    ['ash',     'lightR',   -1,    '불빛이 좁다'],
  ];
  for (const [id, key, want, what] of costs) {
    const b = wear(p, [id]);
    const got = b[key] - zero[key];
    ok(Math.abs(got - want) < 1e-9, `${D.RELICS.find(r=>r.id===id).n} — ${what}`,
       `${key} ${f2(zero[key])} → ${f2(b[key])}`);
  }
}

/* ═══ 3. 두 번째 줄 ═══════════════════════════════════════ */
console.log('\n── 크랙이 열리면 다른 물건이 되는가');
{
  const p = stage();
  /* ② 는 대가를 지운다 — uncracked 칸이 하는 일이다. */
  for (const [id, key] of [['leech', 'hit'], ['ash', 'lightR']]) {
    const off = wear(p, [id])[key], on = wear(p, [id], id)[key];
    const bare = wear(p, [])[key];
    ok(off !== bare && on === bare, `② ${D.RELICS.find(r=>r.id===id).n} — 대가가 지워진다`,
       `${key} ${f2(off)} → ${f2(on)} (안 낀 손 ${f2(bare)})`);
  }
  /* ① 은 선물을 민다 — 이번에 만든 cracked 칸이 하는 일이다.
     이 셋이 실패하면 새 칸이 안 흐르는 것이고, 그러면 ①은 전부
     switch 로 내려가야 한다. */
  for (const [id, key, want] of [['plague','pierce',0.60], ['conduit','spellPow',7], ['swift','firstStrike',0.8]]) {
    const bare = wear(p, [])[key];
    const off = wear(p, [id])[key] - bare, on = wear(p, [id], id)[key] - bare;
    ok(on > off && Math.abs(on - want) < 1e-9, `① ${D.RELICS.find(r=>r.id===id).n} — 선물이 커진다`,
       `${key} +${f2(off)} → +${f2(on)}`);
  }
}

/* ═══ 4. 표 밖의 대가 둘 ══════════════════════════════════ */
console.log('\n── 표에 안 적히는 대가 둘');
{
  /* 사냥 나팔 — 같은 거리의 자는 것이 얼마나 깨는가.
     한 턴만 돌리는 시행을 되풀이해서 비율을 본다. */
  /* 여섯 칸이다. 여덟에 세웠더니 세 번 다 0%였다 — 각성 굴림은
     **보이는 것에만** 걸리고 등불이 일곱 칸까지밖에 안 간다. 벤치가
     「나팔이 아무 일도 안 한다」고 말하고 있었는데 실은 아무것도
     안 재고 있었다. 그래서 보이는지도 같이 단언한다. */
  const TRIALS = 1200, AT = 6;
  const wakeRate = relics => {
    const p = stage();
    p.relics = relics.ids; G.cracks = {};
    if (relics.crack) G.cracks[relics.crack] = 1;
    Game.recalc(p);
    let woke = 0, saw = 0;
    for (let i = 0; i < TRIALS; i++) {
      G.monsters.length = 0;
      G.monsters.push({ n:'시험체', spr:'rat', x: p.x + AT, y: p.y, hp:99, maxhp:99,
                        atk:1, ac:1, xp:1, awake:false, energy:0, ai:'hunt', spd:1 });
      p.hp = p.maxhp; p.lightTurns = 900; Game.refreshFov();
      if (G.level.vis[W.idx(p.x + AT, p.y)]) saw++;
      Game.endTurn();
      if (G.monsters[0]?.awake) woke++;
    }
    if (saw < TRIALS) { ok(false, `자는 것이 ${AT}칸 밖에서 보인다 — 안 보이면 각성 굴림 자체가 없다`, `${saw}/${TRIALS}`); }
    return woke / TRIALS;
  };
  const plain = wakeRate({ ids: [] });
  const horn  = wakeRate({ ids: ['horn'] });
  const open  = wakeRate({ ids: ['horn'], crack: 'horn' });
  /* 문턱은 잡음에서 뽑는다. 같은 조건을 두 번 재서 폭을 보고, 그
     폭보다 큰 차이만 「달라졌다」로 읽는다. */
  const noise = Math.abs(plain - wakeRate({ ids: [] }));
  ok(horn - plain > Math.max(0.03, noise * 2),
     `사냥 나팔 — ${AT}칸 밖의 자는 것이 더 깨어난다 (대가)`,
     `${(plain*100).toFixed(1)}% → ${(horn*100).toFixed(1)}% (잡음 ${(noise*100).toFixed(1)}%p)`);
  ok(Math.abs(open - plain) <= Math.max(0.03, noise * 2),
     '② 나팔이 열리면 더 이상 저를 부르지 않는다',
     `${(open*100).toFixed(1)}% (안 낀 손 ${(plain*100).toFixed(1)}%)`);

  /* 가벼운 걸음 — 금화가 실제로 덜 들어오는가. */
  const gold = ids => {
    const p = stage(); p.relics = ids; G.cracks = {}; Game.recalc(p);
    G.gold = 0; G.goldEarned = 0;
    /* goldGain 은 넣어 주는 함수가 아니라 **깎아서 돌려주는 깔때기**다
       (넣는 것은 부르는 쪽이 한다). G.gold 를 읽고 있었더니 둘 다
       0닢이었다 — 벤치가 유물을 재는 대신 자기 실수를 재고 있었다. */
    return Game.goldGain(1000);
  };
  const g0 = gold([]), g1 = gold(['swift']);
  ok(g1 < g0 && Math.abs(g1 / g0 - 0.6) < 0.02, '가벼운 걸음 — 주머니가 샌다 (대가)',
     `${g0}닢 → ${g1}닢`);
}

/* ═══ 5. 손에 들어오는가 ══════════════════════════════════ */
console.log('\n── 실제로 손에 들어오는가');
{
  /* 표에 있어도 뽑히지 않으면 없는 것과 같다. 융합도 전설도 아니므로
     여섯은 전부 평범한 무게로 서 있어야 한다. */
  const p = stage();
  p.relics = []; G.depth = 6;
  const seen = new Set();
  for (let i = 0; i < 4000; i++) { const id = Game.unownedRelic(); if (id) seen.add(id); }
  const unseen = SIX.filter(id => !seen.has(id));
  ok(!unseen.length, '여섯이 전부 뽑히는 자리에 있다', unseen.length ? unseen.join(' ') : `${seen.size}종 중`);
  /* 문법이 붙었으니 결속도 붙어야 한다 — 아무 짝과도 말을 안 거는
     유물은 어떤 손에도 못 들어간다. */
  const lonely = SIX.filter(id => {
    const r = D.RELICS.find(x => x.id === id);
    return D.RELICS.filter(o => D.bond(r, o)).length < 3;
  });
  ok(!lonely.length, '여섯이 전부 말을 거는 짝을 셋 이상 갖는다',
     lonely.length ? lonely.join(' ')
       : SIX.map(id => { const r = D.RELICS.find(x=>x.id===id);
           return `${r.n} ${D.RELICS.filter(o => D.bond(r,o)).length}`; }).join(' · '));
}

console.log(bad ? `\n새 유물 벤치: ${bad}건 실패\n` : '\n새 유물 벤치: 여섯이 카드대로 움직인다\n');
process.exit(bad ? 1 : 0);
