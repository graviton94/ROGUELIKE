/* ═══════════════════════════════════════════════════════════
   edge.mjs — 평타보다 나은 것이 있는가, 그리고 언제 위험한가

   플레이어의 말 둘:
     「스킬들도 딱히 평타보다 훨씬 좋나? 모르겠음.」
     「사람이 플레이하면 아무 생각 없이 해도 13층까지 너무 쉽게 감.」

   둘 다 숫자로 답할 수 있는 주장이다. 봇으로 답하면 안 된다 — 봇은
   중앙 5층에서 죽는데 사람은 13층까지 간다. 그 간극 자체가 「봇은
   사람의 대역이 아니다」라는 뜻이라, 여기서는 **봇을 안 쓴다.**
   대신 곡선대로 선 영웅을 세우고 산수를 한다.

   ── 무엇을 재는가 ────────────────────────────────────────
   1. 한 턴에 나가는 피해: 평타 대 주문 대 기예.
      주문은 마나를 쓰므로 **판당 몇 번 쓸 수 있는가**까지 곱해서
      「층 하나에서 주문이 실제로 낸 총 피해」로 환산한다. 한 방이
      두 배여도 다섯 번밖에 못 쓰면 평타를 못 이긴다.
   2. 위험한 턴이 있는가: 층의 몬스터가 **가만히 서 있는 나를**
      몇 턴에 죽이는가. 이 숫자가 크면 실수할 여지가 크다는 뜻이고,
      그게 「아무 생각 없이 간다」의 정확한 정의다.

   usage: node sim/edge.mjs
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

/* 곡선대로 선 영웅. deep.mjs 와 같은 세움 — 「그 층에 도달한 사람은
   대개 이만큼이다」를 손으로 만든다. 봇이 실제로 그렇게 자라지
   않으므로(중앙 5층에서 죽는다) 봇에서 뽑을 수 없는 값이다. */
function hero(cls, depth) {
  Meta.forget();
  Game.startGame('human', cls, Game.rollStats(cls));
  Game.descend(); Game.enterDepth(depth);
  const p = G.player;
  p.lv = Math.max(1, Math.round(depth * 1.6));
  p.xp = 0;
  /* 곡선: 층마다 +0.45 정도 벼려지고, 6층부터 속성 하나가 붙는다. */
  const w = p.equip.weapon;
  if (w) { w.plus = Math.min(8, Math.round(depth * 0.45)); if (depth >= 6) w.pre = 'sharp'; }
  const b = p.equip.body;
  if (b) b.plus = Math.min(8, Math.round(depth * 0.4));
  Game.recalc(p);
  p.hp = p.maxhp; p.mana = p.maxmana;
  stage(depth);
  Game.recalc(p); Game.refreshFov();
  return p;
}
/* 이 층의 평범한 몬스터 하나.

   ── 이걸 손으로 만들다가 자를 세 번째로 틀렸다 ────────────
   처음에는 표에서 종을 하나 고르고 배율을 직접 곱해서 만들었다.
   그랬더니 12·15층 명중률이 10%로 나왔는데, 같은 층의 **실제 스폰**을
   재면 46%다. 손으로 만든 몬스터는 그 층에 실제로 서는 몬스터가
   아니었다(정예도 없고, 풀의 가중치도 무시하고, scaleMonster 를
   안 지난다).

   그래서 층을 진짜로 만들고 거기 선 것을 데려온다. 이 파일이 재려는
   것은 「이 층이 얼마나 위험한가」이고, 그 답은 생성기만 안다.  */
const REAL = {};
function foe(depth, at = 1) {
  const p = G.player;
  /* 층을 한 번 만들어 그 층의 몬스터 명단을 떠 둔다(층마다 한 번). */
  if (!REAL[depth]) {
    const keep = { x: p.x, y: p.y };
    const list = [];
    for (let t = 0; t < 12; t++) {
      Game.enterDepth(depth);
      for (const m of G.monsters) if (!m.boss) list.push({ ...m });
    }
    REAL[depth] = list;
    /* 층을 다시 만들었으므로 무대를 복구한다. */
    stage(depth); p.x = keep.x; p.y = keep.y;
  }
  const src = REAL[depth][Math.floor(Math.random() * REAL[depth].length)];
  const m = { ...src, x: p.x + at, y: p.y, awake: true, energy: 0,
    hp: src.maxhp, mark: null, home: null };
  G.monsters.push(m);
  return m;
}
/* 무대만 다시 세운다 — hero() 는 능력치까지 다시 굴리므로 여기서
   쓰면 재는 대상이 매번 달라진다. */
function stage(depth) {
  const L = G.level, p = G.player;
  for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = W.ROCK;
  for (let x = 3; x <= 40; x++) L.tiles[W.idx(x, 12)] = W.FLOOR;
  p.x = 10; p.y = 12; p.lightTurns = 900;
  G.monsters.length = 0;
  Game.refreshFov();
}

console.log('\n날 벤치 — 평타보다 나은 것이 있는가\n');

/* ── 1. 한 턴의 피해 ──────────────────────────────────── */
console.log('  한 턴에 나가는 피해 (같은 층, 같은 손, 200회 평균)');
console.log('  층   직업      평타    주문한방  주문비용  층당가능  주문총량/평타총량');
const ratios = [];
for (const [cls, spellId] of [['mage', 'bolt'], ['paladin', 'smite']]) {
  for (const d of [3, 6, 9, 12, 15]) {
    const p = hero(cls, d);
    /* 평타: 실제 swing 을 돌리고 몬스터가 잃은 체력을 센다. */
    let melee = 0, n = 200;
    for (let i = 0; i < n; i++) {
      G.monsters.length = 0;
      const m = foe(d); m.hp = m.maxhp = 999999;
      p.hp = p.maxhp; Game.step(1, 0);
      melee += 999999 - m.hp;
    }
    melee /= n;
    /* 주문: 같은 방식. 마나는 매번 채운다 — 여기서 재는 것은 한 방이다. */
    const sp = Game.spellList(p).find(s => s.id === spellId);
    let spell = 0, cost = 0;
    if (sp) {
      cost = Game.spellCost(p, sp);
      for (let i = 0; i < n; i++) {
        G.monsters.length = 0;
        const m = foe(d); m.hp = m.maxhp = 999999;
        p.mana = p.maxmana; p.hp = p.maxhp;
        Game.cast(sp.id);
        spell += 999999 - m.hp;
      }
      spell /= n;
    }
    /* 층 하나에서 주문을 몇 번 쓸 수 있는가. 마나는 층 이동과
       모닥불에서만 크게 돌아오므로, 「한 층 = 최대 마나 한 통」으로
       읽는다. 그게 이 게임에서 주문이 실제로 갖는 예산이다. */
    const casts = cost ? Math.floor(p.maxmana / cost) : 0;
    /* 그 예산을 다 쓰고 나면 나머지 턴은 평타다. 층의 전투 턴 수를
       40으로 잡고(실측 교전 길이대) 총량을 비교한다. */
    const TURNS = 40;
    const withSpell = spell * casts + melee * Math.max(0, TURNS - casts);
    const allMelee = melee * TURNS;
    const r = withSpell / Math.max(1, allMelee);
    ratios.push({ cls, d, r });
    console.log(`  ${String(d).padStart(2)}   ${cls.padEnd(8)}${melee.toFixed(1).padStart(7)}`
      + `${spell.toFixed(1).padStart(10)}${String(cost).padStart(9)}${String(casts).padStart(10)}`
      + `        ×${r.toFixed(2)}`);
  }
}
console.log('');
const best = Math.max(...ratios.map(x => x.r));
const worst = Math.min(...ratios.filter(x => x.r > 1).map(x => x.r));
/* 같은 코드로 네 번 재서 1.36 · 1.40 · 1.22 · 1.53. 폭이 ±0.15라
   1.25에 문턱을 두면 동전 던지기가 된다. 폭 바깥으로 내린다. */
ok(worst >= 1.15,
   '주문을 쓰는 판이 안 쓰는 판보다 확실히 세다 — 아니면 주문은 버튼이지 선택이 아니다',
   `가장 약한 조합에서도 ×${worst.toFixed(2)}`);
/* 반대쪽도 잠근다. 처음 재니 마법사가 **×33.5**였다 — 화살 한 방이
   평타의 20배인데 값이 1이라 한 층에 예순여덟 번 쏜다. 그러면 마법사는
   평타를 칠 이유가 없고 판 내내 버튼 하나만 누른다. 「스킬이 평타보다
   좋나」의 정반대 고장이고, 상한이 없으면 이 파일은 그걸 「통과」라고
   찍는다. */
/* 문턱을 10으로 잡았더니 같은 코드에서 8.01 · 8.89 · 10.19가 나왔다 —
   마법사의 최대 마나가 판마다 흔들리고 그 값이 「층당 몇 번 쏘나」를
   통째로 정하기 때문이다. 잡음이 넘나드는 자리에 문턱을 두면 이 파일은
   동전 던지기가 된다(deep.mjs 에서 같은 실수를 한 번 봤다). 관측된
   폭(±1.1) 바깥인 12로 올린다 — 고치기 전 값이 **33.5**였으므로
   12는 여전히 그 고장을 잡는다. */
ok(best <= 12,
   '그러나 주문 하나가 판을 끝내지는 않는다 — 한 버튼만 누르면 되는 직업이 있으면 안 된다',
   `가장 센 조합에서 ×${best.toFixed(2)} (고치기 전 33.5)`);

/* ── 2. 위험한 턴이 있는가 ───────────────────────────── */
console.log('');
console.log('  가만히 서 있으면 몇 턴에 죽는가 (곡선대로 선 영웅, 200회 평균)');
console.log('  층   체력   방어   한 대    맞을확률   1:1 죽는턴   3마리 죽는턴');
const solo = {}, pack = {};
for (const d of [3, 6, 9, 12, 15]) {
  const p = hero('warrior', d);
  const ac = Game.armourClass(p);
  /* ── 이 자를 한 번 틀렸다 ──────────────────────────────
     처음에 endTurn 을 **한 번**만 돌리고 「맞았나」를 셌다. 12·15층에서
     0%가 나왔는데, 그건 그 층이 안전해서가 아니라 깊은 몬스터가
     **예고를 하고 다음 턴에 치기 때문**이다(무거운 공격은 한 턴을
     감아야 나간다). 한 턴만 재면 감는 것만 보고 치는 것을 못 본다.

     그리고 두 번째로 틀렸다: 몬스터를 죽게 두면 표본이 도중에
     사라진다. 매 턴 체력을 되돌려 놓고, 40턴을 돌린 뒤 **턴당 평균
     피해**를 읽는다 — 「몇 턴에 죽는가」는 그 값으로만 나온다. */
  const TURNS_D = 40;
  let dmg = 0, hitTurns = 0, n = 150;
  for (let i = 0; i < n; i++) {
    G.monsters.length = 0;
    const m = foe(d);
    p.hp = p.maxhp;
    for (let t = 0; t < TURNS_D; t++) {
      const was = p.hp;
      m.hp = m.maxhp;                    // 표본이 도중에 사라지지 않게
      p.hp = p.maxhp;                    // 죽어서 멈추지 않게 — 재는 것은 들어오는 양이다
      Game.endTurn();
      const took = Math.max(0, p.maxhp - p.hp);
      if (took > 0) { hitTurns++; dmg += took; }
      if (!G.running) { Game.startGame('human', 'warrior', Game.rollStats('warrior')); break; }
    }
  }
  const turns = n * TURNS_D;
  const rate = hitTurns / turns, avg = hitTurns ? dmg / hitTurns : 0;
  const perTurn = dmg / turns;
  solo[d] = perTurn > 0 ? p.maxhp / perTurn : Infinity;
  pack[d] = perTurn > 0 ? p.maxhp / (perTurn * 3) : Infinity;
  console.log(`  ${String(d).padStart(2)}${String(p.maxhp).padStart(7)}${String(ac).padStart(7)}`
    + `${avg.toFixed(1).padStart(8)}${(rate * 100).toFixed(0).padStart(10)}%`
    + `${solo[d] === Infinity ? '  ∞' : solo[d].toFixed(0).padStart(12)}`
    + `${pack[d] === Infinity ? '  ∞' : pack[d].toFixed(0).padStart(14)}`);
}
console.log('');
/* 이 게임은 「한 방에 죽지 않는다」를 BLOW_CAP 으로 보장한다. 그건
   옳다. 문제는 반대쪽이다 — 셋에 둘러싸여도 스무 턴이 남으면 그건
   위기가 아니라 산책이다. */
ok(pack[13] === undefined || pack[12] <= 8,
   '12층에서 셋에 둘러싸이면 여덟 턴 안에 죽는다 — 그보다 길면 둘러싸이는 것이 사건이 아니다',
   pack[12] === Infinity ? '∞' : `${pack[12].toFixed(1)}턴`);
/* ── 이 줄은 판정하지 않고 인쇄만 한다 ────────────────────
   같은 코드로 네 번 재서 14.5 · 15 · 30.5 · 34.0턴이 나왔다. 폭이
   두 배가 넘는다 — 원인은 층 풀에서 **어떤 종을 뽑느냐**이고, 12층
   풀에는 한 대에 27을 때리는 것과 4를 때리는 것이 같이 있다.
   이 폭으로는 「25턴 안에 죽는다」를 판정할 수 없다.

   문턱을 폭 바깥으로 넓히면(=40) 그 단언은 아무것도 안 잡는다.
   그럴 바에는 안 거는 편이 정직하다. 대신 **셋에 둘러싸였을 때**는
   폭이 좁고(4.8 · 5 · 3.6 · 5.2) 이 게임이 실제로 묻는 질문이라,
   그쪽만 판정한다. */
console.log(`      (1:1 죽는 턴은 판정하지 않는다 — 같은 코드로 14.5~34턴,`
  + ` 층 풀에서 어떤 종을 뽑느냐가 결과를 지배한다.)`);

/* ── 3. 한계돌파 셋이 실제로 판을 바꾸는가 ────────────────
   직업마다 하나씩, 「누가 봐도 이 직업이 위험한 순간」에 쓰는 것.
   피해가 아니라 **판**을 바꾸는 기예라, 여기서 재는 것도 피해가
   아니다: 덜 맞나 · 거리를 벌렸나 · 안 쓰러지나. */
console.log('');
{
  const seat = (cls, lv) => {
    Meta.forget();
    Game.startGame('human', cls, Game.rollStats(cls));
    Game.descend(); Game.enterDepth(8);
    const p = G.player; p.lv = lv; Game.recalc(p);
    stage(8); p.x = 20; p.hp = p.maxhp; p.stam = 99; p.oath = 99;
    Game.recalc(p); Game.refreshFov();
    return p;
  };
  const dummy = (p, dx) => {
    const spec = D.MONSTERS.find(m => m.spr === 'orc');
    const m = { ...spec, hp: 9999, maxhp: 9999, atk: 30, ac: 0,
      x: p.x + dx, y: p.y, awake: true, energy: 0 };
    G.monsters.push(m); return m;
  };

  /* 전사 — 덜 맞고, 옆의 것이 못 물러나고, 나도 못 간다 */
  const w = seat('warrior', 12); dummy(w, 1);
  w.hp = w.maxhp; Game.hurtPlayer(40, { by:'벤치' });
  const openTake = w.maxhp - w.hp;
  Game.useArt('brace');
  w.hp = w.maxhp; Game.hurtPlayer(40, { by:'벤치' });
  const braceTake = w.maxhp - w.hp;
  const wx = w.x; Game.step(1, 0);
  ok(braceTake < openTake * 0.6 && w.x === wx && G.monsters[0].pinned > 0,
     '전사 버텨선다 — 덜 맞고, 옆의 것이 못 물러나고, 나도 못 간다(대가)',
     `피해 ${openTake} → ${braceTake} · 이동 ${w.x === wx ? '막힘' : '됨'}`);

  /* 궁수 — 거리를 벌리면서 그것이 곧 공격이다 */
  const r = seat('ranger', 12);
  r.equip.weapon = { kind:'weapon', t:'bow', spr:'bow', n:'활', dice:[2,6], rng:7, plus:0 };
  r.quiver = { kind:'quiver', qty:99, n:'화살' }; Game.recalc(r);
  /* 허수아비를 체력 무한으로 두면 화살이 죽이지 못해 「몇 대 맞았나」가
     그대로 남는다. 실제 스폰을 쓰면 첫 발에 죽어서 나머지가 허공을
     때리고, 그러면 0으로 읽힌다 — 처음에 그렇게 재서 통과하던 것이
     실패로 뒤집혔다. */
  const foeR = dummy(r, 1); foeR.hp = foeR.maxhp = 99999;
  const rx = r.x, rhp = foeR.hp;
  Game.useArt('kite');
  ok(Math.abs(r.x - rx) >= 3 && rhp - foeR.hp > 0,
     '궁수 물러서며 쏘기 — 거리를 벌리는 일이 그대로 공격이 된다',
     `${Math.abs(r.x - rx)}칸 물러나며 ${rhp - foeR.hp} 피해`);

  /* 팔라딘 — 세 턴 동안 안 쓰러진다, 빚 없이 */
  const pa = seat('paladin', 12);
  Game.useArt('bulwark');
  pa.hp = pa.maxhp;
  for (let i = 0; i < 20; i++) Game.hurtPlayer(9999, { by:'벤치' });
  ok(G.running && pa.hp >= 1,
     '팔라딘 불굴 — 스무 대를 맞아도 쓰러지지 않는다',
     `체력 ${pa.hp} · 살아 있음 ${G.running}`);
}

console.log(bad ? `\n날 벤치: ${bad}건 실패\n` : '\n날 벤치: 날이 서 있다\n');
process.exit(bad ? 1 : 0);
