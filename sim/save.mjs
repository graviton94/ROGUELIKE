/* ═══════════════════════════════════════════════════════════
   save.mjs — 판이 판을 넘지 않는가

   리뷰가 재현한 치명 다섯 건이 전부 한 모양이었다: **저장하거나,
   되살리거나, 비우거나 — 셋 중 하나를 빠뜨렸다.**

     · G.gulped 를 `walkOffTolerance()` 로 비웠다(1만 깎는 함수다).
       여덟 병 마신 판 뒤의 새 판이 첫 물약부터 34% 효율이었다.
     · G.relicBase 가 저장에 없었다 — 크랙이 주운 자리에서 즉시
       열리거나, 앞 판의 셈을 물려받아 영영 안 열렸다.
     · G.famineSwell — 저장 당시 24였던 천장이 64로 불러와졌다.
     · G.task/taskDone — 잠긴 계단이 불러오기 한 번에 공짜로 열렸다.
     · 갈래 배수가 id 로만 저장돼 층 여유가 132 → 264 로 두 배 풀렸다.

   벤치가 하나도 못 잡은 이유는 단순하다 — **sim/ 의 어떤 벤치도
   저장을 한 번 지나가지 않았다.** 그래서 이 파일이 있다.

   묻는 것 셋:
     1. RUN_FIELDS 의 모든 키가 저장·복원·리셋 셋 다 지나는가 (계약)
     2. 판을 굴려 저장했다가 불러오면 같은 판인가 (왕복)
     3. 새 판을 시작하면 앞 판이 한 톨도 안 남는가 (누수)

   usage: node sim/save.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k),
  key:i=>[...store.keys()][i], get length() { return store.size; } };
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const Save = await import('../src/save.js');
const D    = await import('../src/data.js');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

console.log('\n저장 벤치 — 판이 판을 넘지 않는가\n');

const seat = (depth = 6) => {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  for (let d = 2; d <= depth; d++) Game.enterDepth(d);
  return G.player;
};
/* 저장을 한 바퀴 돌린다. apply 는 packLevel 이 뜬 층을 되살리므로
   실제 슬롯을 거쳐야 진짜 왕복이다. */
const roundTrip = () => Save.apply(JSON.parse(JSON.stringify(Save.snapshot())));

/* ── 1. 계약: 표의 모든 키가 세 곳을 지나는가 ─────────── */
{
  const keys = Object.keys(Game.RUN_FIELDS);
  seat(4);
  /* 판 상태를 전부 「기본값이 아닌 것」으로 물들인다. 기본값 그대로
     두면 저장을 빠뜨려도 왕복이 통과한다 — 0을 잃어도 0이다. */
  const stain = { number: 7, boolean: true, object: { 벤치: 1 } };
  for (const k of keys) {
    const d = Game.RUN_FIELDS[k];
    G[k] = Array.isArray(d) ? ['벤치'] : d === null ? { 벤치: 1 }
         : stain[typeof d] ?? '벤치';
  }
  const snap = JSON.parse(JSON.stringify(Save.snapshot()));
  const missing = keys.filter(k => !(k in (snap.run || {})));
  ok(missing.length === 0, 'RUN_FIELDS 의 모든 키가 저장에 적힌다',
     missing.length ? missing.join(' ') : `${keys.length}개`);

  Save.apply(snap);
  const lost = keys.filter(k => JSON.stringify(G[k]) !== JSON.stringify(snap.run[k]));
  ok(lost.length === 0, '그리고 불러오면 전부 그대로 돌아온다',
     lost.length ? lost.join(' ') : `${keys.length}개`);

  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  const kept = keys.filter(k =>
    JSON.stringify(G[k]) !== JSON.stringify(Game.RUN_FIELDS[k]));
  ok(kept.length === 0, '새 판을 시작하면 전부 비워진다',
     kept.length ? kept.join(' ') : `${keys.length}개`);
}

/* ── 2. 재현됐던 다섯 ──────────────────────────────────── */
console.log('');
{
  /* 물약 내성 — 여덟 병 마신 판 뒤의 새 판 */
  const p = seat(3);
  G.gulped = 8;
  const worn = Game.potionScale ? Game.potionScale() : null;
  Meta.forget(); Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  ok(G.gulped === 0, '물약 내성이 판을 안 넘는다 — 앞 판에서 여덟 병을 마셨어도',
     `새 판 gulped ${G.gulped}${worn === null ? '' : ''}`);
  void p;
}
{
  /* 크랙의 기준선 — 주운 뒤부터 세는 장치 */
  seat(4);
  G.ledger = { kill: 110 };
  Game.takeRelic('hunger');
  const before = JSON.stringify(Game.crackProgress('hunger'));
  roundTrip();
  const after = JSON.stringify(Game.crackProgress('hunger'));
  ok(before === after, '크랙 진행이 저장을 건너도 같다 — 주운 자리에서 즉시 열리지 않는다',
     `${before} → ${after}`);
}
{
  /* 굶주림이 부풀린 천장 */
  const p = seat(4);
  G.famineSwell = 40; Game.recalc(p);
  const was = p.maxhp;
  roundTrip();
  Game.recalc(G.player);
  ok(G.player.maxhp === was, '부푼 최대 체력이 저장을 건너도 같다',
     `${was} → ${G.player.maxhp}`);
}
{
  /* 잠긴 계단 */
  let locked = null;
  for (let d = 2; d <= 14 && !locked; d++) {
    seat(2); Game.enterDepth(d);
    if (Game.stairsLocked()) locked = d;
  }
  if (locked === null) ok(true, '과업이 걸린 층을 못 만들었다 — 판정 생략', '');
  else {
    const was = Game.stairsLocked();
    roundTrip();
    ok(!!Game.stairsLocked(), '잠긴 계단이 저장을 건너도 잠겨 있다 — 공짜로 안 열린다',
       `${locked}층 · ${was ? '잠김' : '?'} → ${Game.stairsLocked() ? '잠김' : '열림'}`);
  }
}
{
  /* 갈래 배수 */
  seat(4);
  G.branch = { ...(G.branch || D.BRANCHES[0]), clock: 0.5, elite: 4.8 };
  const was = Game.floorBudget();
  roundTrip();
  const now = Game.floorBudget();
  ok(now === was && G.branch.clock === 0.5,
     '갈래의 배수가 저장을 건너도 남는다 — 층 여유가 두 배로 안 풀린다',
     `층 여유 ${was} → ${now} · clock ${G.branch.clock}`);
}

/* ── 3. 판이 판을 넘지 않는가 (전수) ──────────────────── */
console.log('');
{
  /* 한 판을 깊이 굴려 상태를 잔뜩 만든 뒤, 새 판에서 그 값들이
     한 톨도 안 남았는지 본다. 표 밖의 값도 함께 본다. */
  const p = seat(8);
  G.uproar = 9; G.goldEarned = 9999; G.relicsTaken = 7; G.sent = 12;
  p.gold = 5000;
  const OUTSIDE = ['tally', 'kills', 'eventsSeen', 'broke', 'engraved',
                   'deepest', 'campPromise', 'waves', 'floorTurn', 'heat',
                   'provoked', 'martyred', 'chainGuard'];
  Meta.forget(); Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  const leaked = [...Object.keys(Game.RUN_FIELDS), ...OUTSIDE]
    .filter(k => { const v = G[k];
      return typeof v === 'number' ? v !== (Game.RUN_FIELDS[k] ?? 0) && k !== 'relicFloorAt'
           : typeof v === 'object' && v ? Object.keys(v).length > 0 && !Array.isArray(v)
           : false; });
  ok(leaked.length === 0, '새 판에 앞 판이 한 톨도 안 남는다',
     leaked.length ? leaked.map(k => `${k}=${JSON.stringify(G[k])}`).join(' ') : '전부 깨끗');
}

console.log(bad ? `\n저장 벤치: ${bad}건 실패\n` : '\n저장 벤치: 판이 판을 안 넘는다\n');
process.exit(bad ? 1 : 0);
