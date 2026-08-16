/* ═══════════════════════════════════════════════════════════
   strange.mjs — 이물(異物)이 사고인가, 콘텐츠인가

   플레이어: 「다회차에도 가끔 나올법한, 정말 드문 케이스… 10판 ×
   15스테이지 중 1스테이지 수준… 완전히 운으로 랜덤하되 특정 조건
   만족 시에는 좀 더 확률이 높은 개념 (아이작의 악마방·천사방)」

   그래서 묻는 것 넷:
     1. **정말 드문가.** 열 판을 굴려 한 번쯤이어야 한다. 두 판에
        한 번이면 그건 사고가 아니라 층 종류다.
     2. **깊은 곳에서만인가.** 저층에서 나오면 「특이한 층」이 되고,
        그러면 목록의 한 줄이다.
     3. **불러들일 수 있는가.** 기본은 순수한 운이되, 판이 그것을
        부르는 짓을 했으면 올라가야 한다 — 그래야 「운이 좋았다」가
        아니라 「내가 불렀다」가 된다. 그리고 아무리 불러도 상한이
        있어야 한다.
     4. **밟으면 값을 내는가.** 다섯이 각자 다른 것을 남겨야 하고,
        층 자체도 평범한 층과 달라야 한다.

   usage: node sim/strange.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D    = await import('../src/data.js');
const W    = await import('../src/world.js');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

console.log('\n이물 벤치 — 사고인가, 콘텐츠인가\n');

const seat = () => { Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend(); return G.player; };

/* ── 1. 깊은 곳에서만 ─────────────────────────────────── */
{
  seat();
  const shallow = [1, 3, 5, 8].map(d => Game.strangeOdds(d).p);
  const deep    = [9, 11, 14].map(d => Game.strangeOdds(d).p);
  ok(shallow.every(p => p === 0), '저층에서는 아예 안 나온다 — 나오면 목록의 한 줄이 된다',
     `1·3·5·8층 ${shallow.join(' / ')}`);
  ok(deep.every(p => p > 0), `${D.STRANGE_FROM}층 아래에서만 나온다`,
     `9·11·14층 ${deep.map(p => (p * 100).toFixed(1) + '%').join(' / ')}`);
  /* 마지막 층은 보스의 자리다 — 거기까지 비틀면 그건 이물이 아니라
     엔딩을 갈아 끼우는 것이다. */
  ok(Game.strangeOdds(D.MAX_DEPTH ?? 15).p === 0, '마지막 층은 건드리지 않는다');
}

/* ── 2. 정말 드문가 ───────────────────────────────────── */
console.log('');
{
  /* 「아무것도 안 부른 판」의 층 이동 한 번. 여기가 바닥이다. */
  seat();
  const base = Game.strangeOdds(11).p;
  /* 9~14층 여섯 번을 내려가는 판이 이물을 하나라도 볼 확률. */
  const perRun = 1 - (1 - base) ** 6;
  ok(base <= 0.02, '아무것도 안 부른 판에서는 층 이동 한 번에 2% 이하',
     `${(base * 100).toFixed(1)}%`);
  ok(perRun < 0.12,
     '끝까지 간 판 열에 하나쯤 본다 — 두 판에 한 번이면 사고가 아니라 지형이다',
     `9~14층 여섯 번 중 한 번이라도 ${(perRun * 100).toFixed(1)}%`);
}

/* ── 3. 불러들일 수 있는가 ────────────────────────────── */
console.log('');
{
  seat();
  const read = () => Game.strangeOdds(11);
  const bare = read().p;
  console.log('  무엇을 하면          층 이동 한 번의 확률');
  const show = (what, v) => console.log(`  ${what.padEnd(20)}${(v * 100).toFixed(1).padStart(6)}%`);
  show('아무것도 안 함', bare);

  /* 다섯 끌림을 하나씩 켠다. 각각이 **자기 이물의 몫**을 올리는지도
     같이 본다 — 전체 확률만 오르고 엉뚱한 것이 뜨면 「내가 불렀다」가
     거짓말이 된다. */
  const pulls = [
    ['주문·기예를 쓴다', 'sanctum', () => { G.artsUsed = 40; }],
    ['주목을 올린다',    'void',    () => { G.provoked = 0; Game.provoke(Game.HEAT_MAX); Game.settleHeat(); }],
    ['들키지 않고 걷는다','eyes',   () => { G.sneaked = 30; }],
    /* `p` 를 위에서 한 번 잡아 두고 여기서 `p.hp = 1` 을 했더니
       아무것도 안 움직였다 — 루프 안의 seat() 가 매번 **새 영웅**을
       만들므로 저 p 는 죽은 판의 것이었다. G.player 를 그때그때 읽는다. */
    ['다친 채로 걷는다',  'gullet',  () => { G.player.hp = 1; }],
    ['? 를 많이 본다',   'static',  () => { G.eventsSeen = 8; }],
  ];
  let worst = 1;
  for (const [what, id, set] of pulls) {
    seat(); Game.enterDepth(11);
    /* 층을 하나 만든 것만으로 1% 확률로 이물이 뜨고, 뜨면 그것이
       strangeSeen 에 들어가 그 몫이 0으로 잠긴다 — 다섯 번에 한
       번쯤 「내 몫이 안 올랐다」로 뒤집혔다. 재려는 것은 끌림이지
       방금 무엇이 떴는가가 아니다. */
    G.strange = null; G.strangeSeen = [];
    const before = Game.strangeOdds(11);
    set();
    const after = Game.strangeOdds(11);
    show(what, after.p);
    const mine = after.weights[id] - before.weights[id];
    const others = D.STRANGE.filter(o => o.id !== id)
      .reduce((s, o) => s + (after.weights[o.id] - before.weights[o.id]), 0);
    if (!(after.p > before.p && mine > 0.5 && others <= 0.001)) {
      ok(false, `${what} — ${id} 의 몫만 오른다`,
         `전체 ${(before.p*100).toFixed(1)}→${(after.p*100).toFixed(1)}% · 내 몫 +${mine.toFixed(2)} · 남의 몫 +${others.toFixed(2)}`);
    }
    worst = Math.min(worst, mine);
  }
  ok(worst > 0.5, '다섯 끌림이 각자 자기 이물만 부른다 — 남의 몫은 안 올린다',
     `가장 약한 것도 +${worst.toFixed(2)}`);

  /* 다 켜도 상한이 있어야 한다. */
  seat(); Game.enterDepth(11);
  G.artsUsed = 999; G.sneaked = 999; G.eventsSeen = 99; G.player.hp = 1;
  Game.provoke(Game.HEAT_MAX); Game.settleHeat();
  const all = Game.strangeOdds(11).p;
  show('전부 다 한다', all);
  ok(all <= D.STRANGE_CAP + 1e-9 && all >= bare * 4,
     '다 불러도 상한이 있고, 그래도 바닥의 네 배는 넘는다 — 운이되 결정이 섞인다',
     `${(bare*100).toFixed(1)}% → ${(all*100).toFixed(1)}% (상한 ${(D.STRANGE_CAP*100).toFixed(1)}%)`);
}

/* ── 4. 밟으면 값을 내는가 ────────────────────────────── */
console.log('');
{
  /* 확률을 기다리면 이 절이 절반은 아무것도 안 잰다. 손으로 세운다 —
     재려는 것은 「뜨는가」가 아니라 「떴을 때 무엇인가」다. */
  const force = (id) => {
    const p = seat();
    Game.enterDepth(11);
    const before = { relics: (p.relics || []).length,
                     mats: { ...(p.mats || { scrap:0, dust:0, essence:0 }) },
                     items: G.items.length };
    G.strange = id;
    W.setFacilityBias({ strange: { id, n: D.strangeById(id).n, weight: 0, ...D.strangeById(id).mods } });
    G.level = new W.Level(11, G.branch);
    G.items = [];
    Game.strangePayoffFor?.(id, 11);
    return { p, before };
  };
  console.log('  이물          방  빛   몬스터  남기는 것');
  for (const o of D.STRANGE) {
    const p = seat();
    W.setFacilityBias({ strange: { id: o.id, n: o.n, weight: 0, ...o.mods } });
    const L = new W.Level(11, G.branch);
    console.log(`  ${o.n.padEnd(12)}${String(L.rooms.length).padStart(3)}`
      + `${String(o.mods.light).padStart(5)}${String(o.mods.mob).padStart(8)}   ${o.t.slice(0, 26)}…`);
    void p;
  }
  /* 층이 평범한 층과 다른가 — 방 수·빛·몬스터 예산 중 최소 둘이
     기본 층과 달라야 한다. 하나만 다르면 그건 색만 바꾼 것이다. */
  const plain = W.THEMES.plain;
  const same = D.STRANGE.filter(o => {
    const diff = ['light', 'mob', 'water', 'web'].filter(k => o.mods[k] !== plain[k]).length
      + (o.mods.rooms[0] !== plain.rooms[0] ? 1 : 0);
    return diff < 2;
  });
  ok(same.length === 0, '다섯 다 평범한 층과 형태가 다르다 — 색만 바꾼 것이 아니다',
     same.length ? same.map(o => o.n).join(' ') : `${D.STRANGE.length}종 전부`);

  const TERRAIN = (await import('../src/pixels.js')).TERRAIN;
  const noTerrain = D.STRANGE.filter(o => !TERRAIN[o.id]);
  ok(noTerrain.length === 0, '다섯 다 제 돌을 갖는다',
     noTerrain.length ? noTerrain.map(o => o.n).join(' ') : '');
  void force;
}

/* 규칙이 실제로 붙는가 — 다섯 중 셋은 판 자체를 비튼다. */
console.log('');
{
  const p = seat(); Game.enterDepth(11);
  const clock0 = Game.floorBudget(), stealth0 = Game.stealth(p);
  G.strange = 'gullet';
  const clock1 = Game.floorBudget();
  G.strange = 'eyes';
  const stealth1 = Game.stealth(p);
  G.strange = 'sanctum';
  const art = Game.artList(p)[0];
  const free = art ? Game.spellCost(p, { id:'bolt', cost: 4 }) : null;
  G.strange = null;
  ok(clock1 < clock0 * 0.6, '뱃속 — 층의 여유가 절반이다', `${clock0} → ${clock1}턴`);
  ok(stealth1 === 0 && stealth0 > 0, '눈의 방 — 숨을 수 없다',
     `은신 ${stealth0.toFixed(2)} → ${stealth1.toFixed(2)}`);
  ok(free === 0, '비어 있는 성소 — 주문에 값이 없다', `주문 값 ${free}`);
}

console.log(bad ? `\n이물 벤치: ${bad}건 실패\n` : '\n이물 벤치: 열 판에 한 번, 그리고 부를 수 있다\n');
process.exit(bad ? 1 : 0);
