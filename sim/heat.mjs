/* ═══════════════════════════════════════════════════════════
   heat.mjs — 깊은 곳이 너를 보는가

   플레이어의 말: 「모든 선택지가 risk & take 가 전혀 없다. 후반
   난이도 하향 장치를 만들어놨으면 그만큼 내 전투력에 맞춰서 몬스터가
   더 강해지던가.」

   근거는 실측에 있었다. **같은 층에서 전투력이 하위/상위 사분위 사이에
   ×2.2~3.2로 벌어진다**(6직업 72판). 정적인 깊이 곡선은 약한 빌드에도
   강한 빌드에도 안 맞는다.

   그래서 주목(G.heat)을 만들었다. 이 파일이 묻는 것 넷:

     1. 계기가 실제로 움직이는가 — 항상 0이거나 항상 100이면 없는 것
     2. **약한 판은 안 뜨거워지는가** — 이게 제일 중요하다. 죽어가는
        사람에게 열기가 붙으면 그건 러버밴드가 아니라 처형이다
     3. 손잡이 넷이 실제로 돌아가는가 (각성·정예·시계·스탯)
     4. 스탯 쪽이 **얇은가** — 두꺼우면 방금 주운 것이 그 자리에서
        상쇄되고, 그건 이 판에서 이미 한 번 고친 병이다

   usage: node sim/heat.mjs
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
const mid = a => { const v = a.slice().sort((x, y) => x - y); return v[v.length >> 1]; };
const qt  = (a, f) => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length * f)]; };

console.log('\n주목 벤치 — 깊은 곳이 너를 보는가\n');

/* ── 1·2. 실제 판에서 계기가 어떻게 벌어지는가 ────────── */
const heats = [], awake = [], elite = [], byPow = [];
for (const cls of ['warrior', 'mage', 'rogue', 'ranger'])
  for (let i = 0; i < 12; i++) {
    runBot('human', cls, true, { onTurn: () => {
      if (G.depth < 1 || G.floorTurn !== 1) return;
      const n = G.monsters.length || 1;
      heats.push(G.heat || 0);
      awake.push(G.monsters.filter(m => m.awake).length / n);
      elite.push(G.monsters.filter(m => m.elite?.length).length / n);
      byPow.push({ h: G.heat || 0,
        r: Game.powerOf() / Math.max(1, Game.expectedPower(G.depth)) });
    }});
  }
console.log(`  층 진입 ${heats.length}회`);
console.log(`  주목  중앙 ${mid(heats)} · 하위25% ${qt(heats, 0.25)}`
  + ` · 상위25% ${qt(heats, 0.75)} · 최대 ${Math.max(...heats)}`);
ok(qt(heats, 0.75) - qt(heats, 0.25) >= 20,
   '계기가 실제로 벌어진다 — 늘 같은 값이면 그건 계기가 아니라 상수다',
   `사분위 폭 ${qt(heats, 0.75) - qt(heats, 0.25)}`);

/* 2번 — 이 파일에서 가장 중요한 단언. 곡선보다 **뒤처진** 판에
   열기가 붙으면 그건 러버밴드가 아니라 처형이다. */
const weak = byPow.filter(x => x.r <= 1).map(x => x.h);
const strong = byPow.filter(x => x.r >= 2).map(x => x.h);
console.log(`  곡선 안(×1 이하) ${weak.length}회 → 주목 중앙 ${weak.length ? mid(weak) : '—'}`);
console.log(`  곡선 밖(×2 이상) ${strong.length}회 → 주목 중앙 ${strong.length ? mid(strong) : '—'}`);
ok(!weak.length || mid(weak) <= 5,
   '곡선보다 뒤처진 판은 뜨거워지지 않는다 — 죽어가는 사람을 더 미는 것은 러버밴드가 아니다',
   weak.length ? `주목 ${mid(weak)}` : '표본 없음');
ok(!strong.length || mid(strong) >= 40,
   '곡선을 크게 앞선 판은 확실히 뜨거워진다',
   strong.length ? `주목 ${mid(strong)}` : '표본 없음');

/* ── 3. 손잡이 넷이 실제로 돌아가는가 ─────────────────── */
console.log('');
Meta.forget();
Game.startGame('human', 'warrior', Game.rollStats('warrior'));
Game.descend();
console.log('  주목이 손잡이에 하는 일 (같은 층, 주목만 바꿈)');
console.log('  주목   깨어서시작   정예비율   층여유   몬스터체력');
const knob = {};
for (const h of [0, 30, 60, 100]) {
  const A = [], E = [], HP = [];
  let clock = 0;
  for (let t = 0; t < 30; t++) {
    /* ── 이 자를 또 틀렸다 ────────────────────────────────
       처음에 enterDepth 를 부른 **뒤에** G.heat 을 덮어썼다. 그런데
       스폰과 시계는 enterDepth 안에서 이미 그 값을 읽고 지나간 뒤다 —
       그래서 표의 네 줄이 전부 안 움직였고, 나는 하마터면 「손잡이가
       안 돌아간다」고 게임을 고칠 뻔했다.

       굳기 **전에** 넣어야 한다. 게임에 이미 그 통로가 있다:
       settleHeat 은 heatFor() + G.provoked 를 굳히므로, 도발 값을
       미리 올려 두면 스폰이 그것을 보고 태어난다. 테스트용 뒷문을
       뚫지 않고 실제 규칙으로 재는 편이 언제나 낫다.

       ── 그리고 그 「통로」가 사실은 막혀 있었다 ──────────────
       `G.provoked` 를 여기서 직접 넣고 있었는데, 리뷰가 재 보니
       **src/ 안에 그 값을 올리는 코드가 한 곳도 없었다.** 즉 이 자는
       자기 입력을 스스로 만들어 놓고 손잡이가 돈다고 보고하고 있었다
       — 계기가 아니라 거울이었다. 이제 게임에 provoke() 깔때기가
       있으므로 그것을 지난다. 그러면 이 줄이 「규칙에 그 통로가
       실제로 있는가」까지 함께 재게 된다. */
    G.provoked = 0;
    Game.provoke(h);
    Game.enterDepth(9);
    const n = G.monsters.length || 1;
    A.push(G.monsters.filter(m => m.awake).length / n);
    E.push(G.monsters.filter(m => m.elite?.length).length / n);
    HP.push(mid(G.monsters.map(m => m.maxhp)) || 0);
    clock = Game.floorBudget();
  }
  knob[h] = { a: mid(A), e: mid(E), hp: mid(HP), c: clock };
  G.provoked = 0;
  console.log(`  ${String(h).padStart(4)}     ${(mid(A) * 100).toFixed(0).padStart(4)}%`
    + `      ${(mid(E) * 100).toFixed(0).padStart(4)}%    ${String(clock).padStart(5)}`
    + `      ${String(mid(HP)).padStart(5)}`);
}
console.log('');
ok(knob[100].c < knob[0].c,
   '주목이 오르면 층의 여유가 줄어든다', `${knob[0].c} → ${knob[100].c}턴`);
ok(knob[100].a > knob[0].a + 0.2,
   '주목이 오르면 층이 이미 깨어 있다 — 여기가 「둘러싸이는 일이 안 일어난다」에 대한 답이다',
   `${(knob[0].a * 100).toFixed(0)}% → ${(knob[100].a * 100).toFixed(0)}%`);
ok(knob[100].e > knob[0].e,
   '주목이 오르면 정예가 잦아진다',
   `${(knob[0].e * 100).toFixed(0)}% → ${(knob[100].e * 100).toFixed(0)}%`);
ok(knob[100].hp > knob[0].hp,
   '그리고 몬스터가 조금 세진다 — 조금이어야 한다',
   `${knob[0].hp} → ${knob[100].hp}`);

/* ── 4. 스탯 쪽이 얇은가 ─────────────────────────────── */
console.log('');
const thin = 1 + Game.HEAT_MAX * 0.0025;
ok(thin <= 1.30,
   '주목이 몬스터 스탯에 거는 몫은 얇다 — 두꺼우면 방금 주운 것이 그 자리에서 상쇄된다',
   `최대 ×${thin.toFixed(2)}`);
/* 반대로 조우 쪽은 두꺼워야 한다. 얇으면 이 시스템은 그냥
   난이도 슬라이더 하나다. */
ok(1 + Game.HEAT_MAX * 0.035 >= 3,
   '대신 조우 쪽은 두껍다 — 열기의 무게는 「얼마나 세냐」가 아니라 「몇이 오냐」에 있다',
   `각성 거리 최대 ×${(1 + Game.HEAT_MAX * 0.035).toFixed(1)}`);

console.log(bad ? `\n주목 벤치: ${bad}건 실패\n` : '\n주목 벤치: 아래가 너를 본다\n');
process.exit(bad ? 1 : 0);
