/* retreat.mjs — 물러선다는 것이 수가 되는가.

   여기까지 이 게임에서 후퇴는 존재할 수 없었다. 몬스터는 한 번
   깨면 시야와 무관하게 플레이어의 현재 좌표를 알았고, 도망치면
   정확히 따라오면서 공짜로 때렸다. 그래서 붙으면 끝까지 패는 것
   외에 다른 수가 없었다.

   전체 통계로는 이걸 알 수 없다 — 봇은 물러설 줄 모르니까.
   그래서 상황을 손으로 만들어 놓고 세 가지만 본다:

     · 시야를 끊으면 놈들이 자취를 잃는가
     · 문을 닫으면 못 여는 것들이 막히는가
     · 안 보이는 위협을 글이 알려 주는가

   usage: node sim/retreat.mjs                    */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const W = await import('../src/world.js');
const G = Game.G;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

/* 손으로 만든 방: 가로로 긴 굴 하나. 왼쪽 끝에 나, 오른쪽에 놈들.
   그 사이를 벽으로 끊어 시야를 잘라 볼 수 있다. */
function stage(opts = {}) {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(4);
  const L = G.level, p = G.player;
  /* 층 전체를 바위로 덮고 한 줄만 판다 — 다른 방의 것들이 끼어들면
     재는 것이 후퇴가 아니라 우연이 된다. */
  for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = W.ROCK;
  const y = 10;
  for (let x = 3; x <= 40; x++) L.tiles[W.idx(x, y)] = W.FLOOR;
  if (opts.door) L.tiles[W.idx(opts.door, y)] = W.DOOR_OPEN;
  p.x = 6; p.y = y;
  p.lightTurns = opts.oil ?? 700;
  G.monsters.length = 0;
  const kinds = opts.kinds || 3;
  for (let i = 0; i < kinds; i++) {
    const m = Game.spawnAt ? null : null;
    G.monsters.push({ spr:'rat', n:'커다란 쥐', hp:14, maxhp:14, atk:4, ac:2, xp:2,
                      ai:'hunt', x: 12 + i, y, awake:true, energy:0 });
  }
  Game.recalc(p); Game.refreshFov();
  return { L, p, y };
}

console.log('\n후퇴 벤치 — 물러선다는 것이 수가 되는가\n');

/* ── 1. 시야를 끊으면 자취를 잃는가 ────────────────────── */
{
  const { L, p, y } = stage();
  /* 먼저 두 턴을 마주 본다 — 본 적이 없으면 잃을 자취도 없다.
     (첫 판에서 이걸 빼먹고 「자취를 잃은 사건 0회」를 게임 탓으로
     볼 뻔했다.) */
  for (let i = 0; i < 2; i++) Game.step(0, 0);
  const marked0 = G.monsters.filter(m => m.mark).length;
  /* 이제 놈들과 나 사이를 막는다. 서로 보이지 않는다. */
  L.tiles[W.idx(9, y)] = W.ROCK;
  Game.refreshFov();
  const before = G.monsters.map(m => m.x);
  /* 20턴을 기다린다. 12턴으로 재다가 한 번 실패했는데 게임이 아니라
     검사가 짧았다 — 느린 것은 제 차례가 덜 오므로 자취를 잃는 데도
     더 걸린다. 자취는 「플레이어의 턴」이 아니라 「제 턴」으로 센다. */
  for (let i = 0; i < 20; i++) Game.step(0, 0);
  const marks = G.monsters.filter(m => m.mark).length;
  const moved = G.monsters.map(m => m.x);
  ok(marked0 > 0, '마주 보는 동안에는 내 자리를 안다', `자취를 든 것 ${marked0}/${G.monsters.length}`);
  ok(marks === 0, '벽으로 시야를 끊으면 마지막 자리를 잊는다', `자취를 든 것 ${marks}/${G.monsters.length}`);
  ok(G.lostMe > 0, '자취를 잃은 사건이 실제로 일어났다', `${G.lostMe || 0}회`);
  ok(G.monsters.every(m => m.x > p.x + 1), '벽 너머로 정확히 오지는 못한다',
     `${before.join(',')} → ${moved.join(',')}`);
}

/* ── 2. 보이면 여전히 문다 ─────────────────────────────── */
{
  const { p } = stage();
  const d0 = Math.min(...G.monsters.map(m => Math.abs(m.x - p.x)));
  for (let i = 0; i < 6; i++) Game.step(0, 0);
  const d1 = Math.min(...G.monsters.map(m => Math.abs(m.x - p.x)));
  ok(d1 < d0, '한 줄 굴에서 서로 보이면 곧장 온다 — 후퇴가 공짜가 되지는 않았다',
     `${d0}칸 → ${d1}칸`);
}

/* ── 3. 이름 있는 것은 놓아 주지 않는다 ────────────────── */
{
  const { L, p, y } = stage();
  for (const m of G.monsters) { m.named = true; m.provoked = true; m.home = { x:m.x, y:m.y }; }
  L.tiles[W.idx(9, y)] = W.ROCK;
  Game.refreshFov();
  for (let i = 0; i < 10; i++) Game.step(0, 0);
  ok(G.monsters.every(m => m.mark), '이름 있는 것은 시야가 끊겨도 안다 — 고른 싸움이다',
     `자취를 든 것 ${G.monsters.filter(m => m.mark).length}/${G.monsters.length}`);
}

/* ── 4. 문을 닫으면 못 여는 것은 막힌다 ────────────────── */
{
  const { L, p, y } = stage({ door: 9 });
  for (const m of G.monsters) m.door = null;         // 문을 못 여는 것들
  p.x = 8;
  Game.refreshFov();
  const closed = Game.closeDoor();
  ok(closed !== false && L.tiles[W.idx(9, y)] === W.DOOR,
     '옆 칸의 열린 문을 닫을 수 있다', `타일 ${L.tiles[W.idx(9, y)]}`);
  for (let i = 0; i < 14; i++) Game.step(0, 0);
  ok(G.monsters.every(m => m.x > 9), '문을 못 여는 것은 문 너머에 남는다',
     G.monsters.map(m => m.x).join(','));
}

/* ── 5. 어둠이 글로 말해 주는가 ────────────────────────── */
{
  const { L, p, y } = stage({ oil: 0 });             // 불이 꺼졌다: 반경 2
  Game.refreshFov();
  const said = [];
  const seen = new Set();
  for (let i = 0; i < 40; i++) Game.step(0, 0);
  /* 로그 전체를 훑는다. 마지막 몇 줄만 보다가 한 번 놓쳤다 —
     놈들이 붙으면 전투 문장이 쏟아져서 힌트를 밀어낸다. */
  for (const line of G.log) {
    const t = typeof line === 'string' ? line : (line?.text || '');
    if (/어둠|숨소리|발소리|부스럭|끄는 소리|가까워/.test(t) && !seen.has(t)) { seen.add(t); said.push(t); }
  }
  ok(said.length > 0, '안 보이는 놈들을 글이 알려 준다', `${said.length}종`);
  for (const t of said.slice(0, 4)) console.log(`      「${t}」`);
  ok(G.lightRadius === 2, '불이 꺼진 상태였다', `반경 ${G.lightRadius}칸`);
}

console.log(bad ? `\n후퇴 벤치: ${bad}건 실패\n` : '\n후퇴 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
