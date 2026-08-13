/* uproar.mjs — 밀도를 내가 살 수 있는가.

   판의 78%가 빈 걷기였고, 그 답은 「몬스터를 더 뿌린다」가 아니다.
   그건 다 늘리는 것이고, 늘린 밀도는 플레이어의 결정이 아니다.
   그래서 소리로 산다: 외치면 오고, 오면 소란이 오르고, 소란은
   보상을 부풀린다. 조용하면 안전하고 가난하다.

   전체 통계로는 이걸 못 잰다 — 봇이 외치는 판은 드물고, 판마다
   층이 달라 잡음이 크다. 그래서 기능만 손으로 세워 잰다.

   usage: node sim/uproar.mjs                     */
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

/* 넓은 방 하나. 나는 가운데, 잠든 것들이 거리별로 둘러싼다. */
function stage(dists = [3, 6, 9, 12]) {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(4);
  const L = G.level, p = G.player;
  for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = W.ROCK;
  for (let y = 4; y <= 24; y++) for (let x = 4; x <= 40; x++) L.tiles[W.idx(x, y)] = W.FLOOR;
  p.x = 20; p.y = 14; p.stam = p.maxStam; p.lightTurns = 700;
  G.monsters.length = 0;
  for (const d of dists)
    G.monsters.push({ spr:'rat', n:'커다란 쥐', hp:14, maxhp:14, atk:4, ac:2, xp:2,
                      ai:'hunt', x: p.x + d, y: p.y, awake:false, energy:0 });
  Game.recalc(p); Game.refreshFov();
  return { L, p };
}

console.log('\n소란 벤치 — 밀도를 내가 살 수 있는가\n');

/* ── 1. 외치면 깨어나는가 ─────────────────────────────── */
{
  const dists = [3, 5, 7, 9, 11, 13];
  let woke = [0, 0, 0, 0, 0, 0];
  const N = 200;
  for (let t = 0; t < N; t++) {
    stage(dists);
    Game.shout();
    G.monsters.forEach((m, i) => { if (m.awake) woke[i]++; });
  }
  console.log('  거리별로 깨어난 비율 (200회):');
  dists.forEach((d, i) => console.log(`    ${String(d).padStart(2)}칸  ${Math.round(woke[i] * 100 / N)}%`));
  /* 외침은 대가를 치르고 일부러 내는 소리다. 확률이면 그것은
     결정이 아니라 도박이고, 도박은 이미 소란이 맡고 있다.
     대신 경계가 분명하다 — 9칸 안은 전부 오고, 밖은 아무도 안 온다.
     처음엔 13칸이었는데 그건 「한 무리를 부르는 것」이 아니라 「층을
     통째로 여는 것」이었다 (도달 층수 8.1 → 5.0). */
  ok(woke[0] / N === 1, '9칸 안은 전부 깨어난다 (3칸)', `${Math.round(woke[0]*100/N)}%`);
  ok(woke[3] / N === 1, '9칸 안은 전부 깨어난다 (9칸)', `${Math.round(woke[3]*100/N)}%`);
  ok(woke[4] / N === 0, '9칸 밖은 듣지 못한다 (11칸) — 외침은 층이 아니라 무리를 부른다',
     `${Math.round(woke[4]*100/N)}%`);
}

/* ── 2. 깨어난 것이 실제로 오는가 ─────────────────────── */
{
  const { p } = stage([6, 9, 12]);
  const d0 = G.monsters.map(m => Math.abs(m.x - p.x));
  Game.shout();
  for (let i = 0; i < 14; i++) Game.step(0, 0);
  const d1 = G.monsters.map(m => Math.abs(m.x - p.x));
  const closer = d1.filter((d, i) => d < d0[i]).length;
  ok(closer >= 2, '외침은 깨우는 것이 아니라 부른다 — 자취가 심긴다',
     `${d0.join(',')} → ${d1.join(',')}`);
}

/* ── 3. 소란이 오르고, 혼자가 되면 식는가 ─────────────── */
{
  const { p } = stage([3, 4, 5, 6]);
  for (const m of G.monsters) m.awake = true;
  for (let i = 0; i < 8; i++) Game.step(0, 0);
  const hot = G.uproar || 0;
  ok(hot >= 4, '둘러싸이면 소란이 오른다', `${hot}/${Game.UPROAR_MAX}`);
  ok(Game.uproarMult() > 1.2, '보상 배수가 실제로 붙는다', `×${Game.uproarMult().toFixed(2)}`);
  G.monsters.length = 0;
  for (let i = 0; i < 20; i++) Game.step(0, 0);
  ok((G.uproar || 0) === 0, '혼자가 되면 식는다 — 챙기고 빠지는 것이 수가 된다',
     `${G.uproar || 0}`);
}

/* ── 4. 소란이 위험한가 — 공짜면 결정이 아니다 ─────────── */
{
  const { p } = stage([3, 4, 5, 6, 7, 8]);
  const hp0 = p.hp;
  Game.shout();
  /* 40턴. 25턴으로 재다가 한 번 통과하고 한 번 실패했다 — 명중은
     굴림이라 짧은 창에서는 전부 빗나갈 수 있다. 재는 것은 「반드시
     맞는다」가 아니라 「부르면 붙는다」이므로, 붙었는지도 같이 본다. */
  let touched = 0;
  for (let i = 0; i < 40; i++) {
    if (p.hp <= 0) break;
    Game.step(0, 0);
    if (G.monsters.some(m => Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 1)) touched++;
  }
  ok(touched > 0, '부르면 실제로 붙는다', `${touched}턴 동안 손이 닿는 거리`);
  ok(p.hp < hp0, '붙으면 실제로 맞는다', `체력 ${hp0} → ${Math.max(0, p.hp)}`);
}

/* ── 5. 숨이 없으면 못 외친다 ─────────────────────────── */
{
  const { p } = stage();
  p.stam = 0;
  const before = G.monsters.filter(m => m.awake).length;
  const did = Game.shout();
  ok(did === false && G.monsters.filter(m => m.awake).length === before,
     '숨이 차면 외침이 나오지 않는다', `${did}`);
}

console.log(bad ? `\n소란 벤치: ${bad}건 실패\n` : '\n소란 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
