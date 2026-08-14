/* pack.mjs — 배낭이 실제로 어떻게 차는가.

   「해체불가한 아이템이나 미상의 소모품이 자리를 너무 많이 차지함」은
   두 가지 다른 고장이었다: 미상 물약은 생김새가 열 가지라 한 종류씩만
   주워도 절반이 도박으로 찼고, 이름 붙은 물건은 부술 수도 내려놓을 수도
   없어서 판이 끝날 때까지 한 칸을 붙들었다.

   여기서 묻는 것은 셋뿐이다:
     · 미상 소모품이 반 칸인가 — 규칙과 화면이 같은 값을 읽는가
     · 고유 물건을 내려놓을 수 있는가, 그리고 그대로 다시 주워지는가
     · 묶음을 내려놓았다가 주우면 묶음째 돌아오는가

   usage: node sim/pack.mjs                        */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const G = Game.G;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

/* 장비 한 점. 생성기를 부르지 않는다 — pickItem은 내보내지 않는
   내부 함수이고, 여기서 재는 것은 「무엇이 나오는가」가 아니라
   「몇 칸을 잡는가」이므로 평범한 무기 한 자루면 충분하다. */
const gear = i => ({ ...D.WEAPONS[i % D.WEAPONS.length], kind:'weapon' });

function fresh() {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(3);
  const p = G.player;
  p.pack.length = 0;
  G.items.length = 0;
  return p;
}

console.log('\n배낭 벤치 — 무엇이 자리를 잡는가\n');

/* ── 1. 미상 소모품은 반 칸 ────────────────────────────── */
{
  const p = fresh();
  /* 정체를 모르게 만든다. startGame은 들고 시작한 것을 전부
     아는 것으로 표시하므로, 그 표시를 걷어야 미상이 된다. */
  const unknowns = D.UNKNOWABLE.slice(0, 8);
  for (const id of unknowns) { delete G.known[id]; Game.addItem(p, Game.makeConsumable(id)); }
  const used = Game.packUsed(p);
  ok(p.pack.length === 8, '여덟 종류가 여덟 줄로 들어갔다', `${p.pack.length}줄`);
  ok(Math.abs(used - 4) < 1e-9, '미상 여덟 종류가 네 칸을 쓴다', `${used}칸`);
  Game.identify(unknowns[0], true);
  ok(Math.abs(Game.packUsed(p) - 4.5) < 1e-9,
     '정체를 알면 그때부터 한 칸이 된다', `${Game.packUsed(p)}칸`);
}

/* ── 2. 반 칸이 실제로 더 들어간다 ─────────────────────── */
{
  const p = fresh();
  const id = D.UNKNOWABLE[0];
  delete G.known[id];
  /* 같은 id는 겹치므로 칸을 늘리지 않는다. 서로 다른 미상을
     최대한 넣어 보고, 그 다음 평범한 물건이 아직 들어가는지 본다. */
  let lines = 0;
  for (const uid of D.UNKNOWABLE) {
    delete G.known[uid];
    if (Game.addItem(p, Game.makeConsumable(uid))) lines++;
  }
  const room = Game.PACK_MAX - Game.packUsed(p);
  ok(lines * 0.5 === Game.packUsed(p), '넣은 줄 수의 절반만큼 찼다',
     `${lines}줄 · ${Game.packUsed(p)}칸`);
  ok(room >= 10, '미상을 전부 들고도 장비를 열 칸 넘게 실을 수 있다', `${room}칸 남음`);
}

/* ── 3. 배낭은 여전히 찬다 ─────────────────────────────── */
{
  const p = fresh();
  let put = 0;
  for (let i = 0; i < 40; i++) {
    if (!Game.addItem(p, gear(i))) break;
    put++;
  }
  ok(Game.packUsed(p) <= Game.PACK_MAX, '한도를 넘겨 담기지 않는다',
     `${Game.packUsed(p)}/${Game.PACK_MAX}`);
  ok(put >= 18, '평범한 장비는 예전처럼 스무 칸까지 들어간다', `${put}점`);
}

/* ── 4. 부술 수 없는 것을 내려놓을 수 있다 ─────────────── */
{
  const p = fresh();
  const it = gear(0);
  it.unique = true; it.n = '《약속》';
  Game.addItem(p, it);
  ok(!Game.canSalvage(it), '고유 물건은 여전히 가루가 되지 않는다');
  const before = p.pack.length;
  const done = Game.dropItem(0);
  ok(done && p.pack.length === before - 1, '대신 발밑에 내려놓을 수 있다',
     `${before}줄 → ${p.pack.length}줄`);
  ok(G.items.some(o => o.x === p.x && o.y === p.y), '내려놓은 것이 발밑에 있다',
     `${G.items.length}점`);
}

/* ── 5. 묶음은 묶음째 돌아온다 ─────────────────────────── */
{
  const p = fresh();
  Game.addItem(p, Game.makeConsumable('torch'), 7);
  const drop = Game.dropItem(0);
  const lying = G.items.find(o => o.x === p.x && o.y === p.y);
  ok(drop && lying?.qty === 7, '일곱 개가 묶음으로 놓였다', `${lying?.qty}개`);
  /* 줍기는 「칸에 들어설 때」 일어난다 — 제자리 대기로는 발밑의
     것을 집지 않는다. 그래서 한 칸 나갔다 돌아온다. 어느 쪽이
     뚫려 있는지는 층이 정하므로 네 방향을 다 시도한다. */
  const home = { x:p.x, y:p.y };
  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    Game.step(dx, dy);
    if (p.x !== home.x || p.y !== home.y) { Game.step(-dx, -dy); break; }
  }
  const back = p.pack.find(s => s.item.id === 'torch');
  ok(back?.qty === 7, '다시 주우면 일곱 개 그대로다', `${back?.qty}개`);
}

/* ── 6. 나쁜 물약도 재료가 된다 ────────────────────────── */
{
  const p = fresh();
  Game.addItem(p, Game.makeConsumable('potVenom'));
  const it = p.pack[0].item;
  ok(Game.canSalvage(it), '소모품을 부술 수 있다');
  const before = (p.mats?.scrap || 0);
  Game.salvage(0);
  ok(p.pack.length === 0, '부수면 자리가 빈다', `${p.pack.length}줄`);
  ok((p.mats?.scrap || 0) > before, '부스러기가 남는다',
     `쇳 ${before} → ${p.mats.scrap}`);
}

console.log(bad ? `\n배낭 벤치: ${bad}건 실패\n` : '\n배낭 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
