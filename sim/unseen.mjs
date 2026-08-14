/* unseen.mjs — 보고 있는 동안에는 움직이지 않는가.

   이 게임에서 시야는 장식이 아니라 자원이다 — 횃불이 곧 보이는
   범위이고, 그 범위는 판 내내 줄어든다. 그래서 「보고 있으면 멈춘다」는
   여기서 남의 장르 장치가 아니라 **기름이 줄면 가까워지는 것**이 된다.

   불쾌한 것은 움직이는 순간이 아니라 움직이지 않는 순간이다. 한 칸
   앞에 서 있는데 아무 일도 안 일어나고, 그래서 눈을 뗄 수가 없고,
   그런데 불은 계속 탄다.

   그러니 재야 하는 것은 넷:
     · 보고 있으면 정말로 한 칸도 안 움직이는가
     · 보고 있으면 때리지도 않는가 (「가만히 있는 것」과 다른 지점)
     · 눈을 떼면 두 칸씩 좁히는가
     · 도망칠 수 없는가 — 등을 보이는 것이 곧 이것의 차례다

   usage: node sim/unseen.mjs                        */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const W = await import('../src/world.js');
const G = Game.G;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

/* 한 줄짜리 굴. 시야를 손으로 켜고 끌 수 있어야 하므로 무대를 짓는다. */
function stage(oil) {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(7);
  const L = G.level, p = G.player;
  for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = W.ROCK;
  L.roomOf.fill(-1);
  for (const r of L.rooms) { r.lit = false; r.bright = false; }
  const y = 12;
  for (let x = 3; x <= 44; x++) L.tiles[W.idx(x, y)] = W.FLOOR;
  /* 다섯 칸 떨어뜨려 세운다. 처음에 여덟 칸으로 놓았더니 불이 가장
     밝을 때의 반경이 일곱이라 「보고 있는데 움직였다」가 두 건 떴는데,
     보고 있던 적이 없었다 — 무대가 틀린 것이지 것이 틀린 것이 아니다. */
  p.x = 10; p.y = y;
  p.lightTurns = oil;
  p.hp = p.maxhp;
  G.monsters.length = 0;
  const spec = D.MONSTERS.find(m => m.spr === 'standing');
  G.monsters.push({ ...spec, hp: spec.hp, maxhp: spec.hp,
                    x: 15, y, awake: true, energy: 0 });
  Game.recalc(p); Game.refreshFov();
  return { L, p, m: G.monsters[0], y };
}

console.log('\n서 있는 것 벤치 — 보고 있는 동안에는 움직이지 않는가\n');

/* ── 1. 밝을 때는 한 칸도 안 움직인다 ────────────────────── */
{
  const { L, p, m } = stage(900);
  ok(L.vis[W.idx(m.x, m.y)], '불이 밝아 보인다', `반경 ${G.lightRadius}칸`);
  const at = m.x;
  for (let i = 0; i < 20; i++) Game.step(0, 0);
  ok(m.x === at, '스무 턴을 마주 보고 있어도 한 칸도 안 움직인다', `${at} → ${m.x}`);
  ok(p.hp === p.maxhp, '보고 있는 동안에는 때리지도 않는다', `${p.hp}/${p.maxhp}`);
}

/* ── 2. 눈을 떼면 좁힌다 ─────────────────────────────────── */
{
  /* 처음에는 벽으로 시야를 끊었다. 그런데 한 줄짜리 굴에서 시야를
     끊는 벽은 길도 끊는다 — 「두 칸을 좁힌다」가 「한 칸」으로 나온
     것은 것이 벽에 코를 박고 섰기 때문이었다. 재려던 것은 걸음
     폭인데 재고 있던 것은 벽이었다.
     그래서 어둠으로 끊는다. 이 게임에서 눈을 떼는 방법은 어차피
     그쪽이다 — 기름이 떨어지는 것. */
  const { L, p, m } = stage(0);
  Game.refreshFov();
  ok(!L.vis[W.idx(m.x, m.y)], '불이 꺼져 안 보인다', `반경 ${G.lightRadius}칸`);
  const at = m.x;
  Game.step(0, 0);
  ok(at - m.x === Game.UNSEEN_STEP, '한 턴에 두 칸을 좁힌다',
     `${at} → ${m.x} (${at - m.x}칸)`);
}

/* ── 3. 불이 꺼지면 그것이 곧 눈을 뗀 것이다 ─────────────── */
{
  const { L, p, m } = stage(0);
  Game.refreshFov();
  ok(!L.vis[W.idx(m.x, m.y)], '불이 꺼져 다섯 칸 앞이 안 보인다',
     `반경 ${G.lightRadius}칸`);
  const at = m.x;
  for (let i = 0; i < 3; i++) Game.step(0, 0);
  ok(at - m.x >= Game.UNSEEN_STEP * 2, '어둠 속에서는 계속 좁혀 온다',
     `${at} → ${m.x}`);
}

/* ── 4. 불이 있으면 걸어서 뗄 수 있고, 없으면 없다 ───────── */
{
  /* 처음에 이 칸의 제목은 「걸어서 도망칠 수 없다」였고, 재 보니
     거짓이었다 — 불이 닿는 동안에는 5칸이 7칸이 됐다. 그게 맞다.
     이 판에서 도망은 다리로 치는 것이 아니라 **기름으로** 치는
     것이고, 그러니 재야 할 것은 「도망이 되는가」가 아니라
     「불이 있을 때와 없을 때가 다른가」다. */
  const lit = stage(900);
  const litGap0 = Math.abs(lit.m.x - lit.p.x);
  for (let i = 0; i < 6; i++) Game.step(-1, 0);
  const litGap1 = Math.abs(lit.m.x - lit.p.x);
  ok(litGap1 > litGap0, '불이 닿는 동안에는 걸어서 뗄 수 있다 — 기름이 곧 거리다',
     `${litGap0}칸 → ${litGap1}칸`);

  const dark = stage(0);
  const darkGap0 = Math.abs(dark.m.x - dark.p.x);
  for (let i = 0; i < 6; i++) Game.step(-1, 0);
  const darkGap1 = Math.abs(dark.m.x - dark.p.x);
  ok(darkGap1 < darkGap0, '불이 꺼지면 등을 보이는 것이 곧 그것의 차례다',
     `${darkGap0}칸 → ${darkGap1}칸`);
}

/* ── 5. 문은 통한다 ──────────────────────────────────────── */
{
  const { L, p, m, y } = stage(900);
  L.tiles[W.idx(13, y)] = W.DOOR;          // 닫힌 문
  m.door = null;                            // 문을 못 여는 것으로
  Game.refreshFov();
  const at = m.x;
  for (let i = 0; i < 10; i++) Game.step(0, 0);
  ok(m.x > 13, '문을 못 여는 것은 문 너머에 남는다 — 답이 없는 것은 아니다',
     `${at} → ${m.x}`);
}

/* ── 6. 도감이 그 한 줄을 적어 준다 ──────────────────────── */
{
  const spec = D.MONSTERS.find(m => m.spr === 'standing');
  const tells = D.tellsOf(spec);
  console.log('');
  for (const t of tells) console.log(`      · ${t}`);
  console.log('');
  ok(tells.some(t => /보고 있는 동안/.test(t)),
     '규칙이 도감에 그대로 적힌다 — 손으로 적은 줄이 아니다');
}

console.log(bad ? `\n서 있는 것 벤치: ${bad}건 실패\n` : '\n서 있는 것 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
