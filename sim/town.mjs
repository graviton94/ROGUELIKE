/* town.mjs — 마을이 마을처럼 생겼는가.

   층을 66×40에서 52×32로 줄였을 때 마을은 손대지 않았다. 마을은
   던전과 달리 좌표를 손으로 박아 만든 곳이라 (수레 줄은 cx 기준
   ±4칸, 계단 마당은 가장자리에서 6칸) 판이 줄면 그 상수들이
   먼저 벽 밖으로 밀린다.

   눈으로 보면 「좀 좁네」로 끝난다. 그래서 센다:

     · 여섯 수레가 전부 놓였는가, 그리고 흥정하는 칸이 걸어갈 수
       있는 땅인가 — 좌판 뒤나 벽 속에 박히지 않았는가
     · 계단에서 여섯 수레 전부로 걸어갈 수 있는가
     · 폐허가 길을 막지 않는가 — 마을이 두 조각으로 갈리지 않는가
     · 수레·간판·주인이 서로 겹치지 않는가

   usage: node sim/town.mjs [판수=300]                */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const W = await import('../src/world.js');

const N = Number(process.argv[2] || 300);
let bad = 0;
const fails = {};
const note = (key) => { fails[key] = (fails[key] || 0) + 1; };

/* 계단에서 걸어서 닿는 칸 전부. 마을에 문이 없으므로 solid만 보면
   된다 — 다만 좌판은 solid가 아니라서 통과해 버리는 것을 막아야
   실제로 사람이 걷는 길과 같아진다. */
function reach(L, from) {
  const seen = new Set([W.idx(from.x, from.y)]);
  const q = [from];
  while (q.length) {
    const c = q.pop();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= W.MW || y >= W.MH) continue;
      const i = W.idx(x, y);
      if (seen.has(i) || L.solid(x, y)) continue;
      if (L.tiles[i] === W.PROP) continue;      // 좌판·화로·우물은 걸어 넘지 않는다
      seen.add(i); q.push({ x, y });
    }
  }
  return seen;
}

let stallsMissing = 0, counterBad = 0, unreach = 0, overlap = 0, islands = 0;
let counters = 0, floorAvg = 0;

for (let n = 0; n < N; n++) {
  const L = new W.Level(0, {});
  const stalls = [...L.signAt.keys()];
  if (stalls.length < 6) { stallsMissing++; note('수레가 모자란다'); }

  /* 흥정하는 칸이 실제로 밟을 수 있는 땅인가. */
  let okCounters = 0;
  for (const i of L.shopAt.keys()) {
    counters++;
    const x = i % W.MW, y = (i - x) / W.MW;
    const walk = !L.solid(x, y) && L.tiles[i] !== W.PROP;
    if (!walk) { counterBad++; note('흥정 칸이 밟을 수 없는 자리'); }
    else okCounters++;
  }

  /* 겹침: 한 칸이 좌판이면서 흥정 칸이거나 주인 자리이면 안 된다. */
  for (const i of L.signAt.keys())
    if (L.shopAt.has(i) || L.keeperAt.has(i)) { overlap++; note('좌판과 다른 표시가 겹친다'); break; }

  /* 계단에서 여섯 수레 전부에 닿는가. */
  const seen = reach(L, L.entry);
  let miss = 0;
  for (const i of L.shopAt.keys()) if (!seen.has(i)) miss++;
  if (miss) { unreach++; note('계단에서 못 가는 수레가 있다'); }

  /* 마을이 두 조각으로 갈리지 않는가 — 걸을 수 있는 땅의 몇 %에
     닿는지로 본다. 폐허가 길을 가로막으면 여기서 먼저 드러난다. */
  let walkable = 0;
  for (let i = 0; i < L.tiles.length; i++) {
    const x = i % W.MW, y = (i - x) / W.MW;
    if (!L.solid(x, y) && L.tiles[i] !== W.PROP) walkable++;
  }
  floorAvg += walkable;
  if (seen.size < walkable * 0.9) { islands++; note('마을이 조각나 있다'); }
}

const pct = v => `${(v * 100 / N).toFixed(1)}%`;
console.log(`\n마을 벤치 — ${N}판 (${W.MW}×${W.MH})\n`);
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};
ok(stallsMissing === 0, '여섯 수레가 전부 선다', `빠진 판 ${pct(stallsMissing)}`);
ok(counterBad === 0, '흥정하는 칸은 전부 밟을 수 있는 땅이다',
   `${counterBad}/${counters}칸`);
ok(overlap === 0, '좌판·간판·주인이 겹치지 않는다', `${pct(overlap)}`);
ok(unreach === 0, '계단에서 여섯 수레 전부로 걸어갈 수 있다', `못 가는 판 ${pct(unreach)}`);
ok(islands === 0, '마을이 조각나지 않는다', `조각난 판 ${pct(islands)}`);
console.log(`\n  걸을 수 있는 땅 평균 ${Math.round(floorAvg / N)}칸\n`);
for (const [k, v] of Object.entries(fails)) console.log(`    ${k}: ${v}판`);
/* ── 갱구가 눈에 띄는가 ───────────────────────────────────
   「첫 마을에서 계단이 너무 눈에 안 띈다」는 제보가 있었다. 여기
   온 이유가 그것 하나뿐인데, 어두운 야영지에서 반경 7칸으로 찾아
   헤매게 만들 이유가 없다. */
{
  let unseen = 0, farAvg = 0;
  const N2 = 200;
  for (let n = 0; n < N2; n++) {
    const L = new W.Level(0, {});
    let at = -1;
    for (let i = 0; i < L.tiles.length; i++) if (L.tiles[i] === W.DOWN) { at = i; break; }
    if (at < 0 || !L.seen[at]) unseen++;
    const x = at % W.MW, y = (at - x) / W.MW;
    farAvg += Math.hypot(x - L.entry.x, y - L.entry.y);
  }
  ok(unseen === 0, '갱구는 도착하자마자 지도에 있다 — 찾아 헤매게 두지 않는다',
     `안 보이는 판 ${unseen}/${N2}`);
  console.log(`      들어선 자리에서 갱구까지 평균 ${(farAvg / N2).toFixed(1)}칸`);
}

/* ── 수레 앞에 서는 일이 나머지 넷과 같은가 ───────────────
   여기만 옛 동작이 남아 있었다: 발이 닿는 순간 화면이 튀어나오고,
   턴은 안 쓰고, 그 칸에 서지도 못했다. 지나가려던 사람이 장을 보게
   되고 화면은 엄지 밑에서 열린다. 넷을 고칠 때 빠뜨린 자리였다. */
{
  const Meta = await import('../src/meta.js');
  const Game = await import('../src/game.js');
  const G = Game.G;
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  const L = G.level, p = G.player;
  /* 흥정 칸 옆에 선다. 어느 쪽이 뚫려 있는지는 판이 정하므로
     네 방향 중 걸어갈 수 있는 자리를 찾는다. */
  let from = null, at = null;
  for (const i of L.shopAt.keys()) {
    const x = i % W.MW, y = (i - x) / W.MW;
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x + dx, ny = y + dy;
      if (L.solid(nx, ny) || L.tiles[W.idx(nx, ny)] === W.PROP) continue;
      if (L.shopAt.has(W.idx(nx, ny))) continue;
      from = { x:nx, y:ny }; at = { x, y, dx:-dx, dy:-dy }; break;
    }
    if (from) break;
  }
  ok(!!from, '흥정 칸 옆에 설 자리가 있다');
  if (from) {
    p.x = from.x; p.y = from.y;
    Game.refreshFov();
    const turn0 = G.turn;
    Game.step(at.dx, at.dy);
    ok(p.x === at.x && p.y === at.y, '수레 앞 칸에 실제로 선다',
       `(${p.x},${p.y}) vs (${at.x},${at.y})`);
    ok(G.screen !== 'shop', '발이 닿았다고 화면이 열리지는 않는다', `화면 ${G.screen}`);
    ok(G.turn > turn0, '한 걸음은 한 턴을 쓴다', `${turn0} → ${G.turn}`);
    const offer = Game.hereOffer();
    ok(offer?.screen === 'shop', '대신 「거래」가 발밑에 뜬다', `${offer?.n}`);
    ok(Game.openHere() && G.screen === 'shop' && !!G.shop,
       '눌러야 열린다 — 나머지 넷과 같은 규칙', `${G.shop?.n}`);
  }
}

console.log(bad ? `\n마을 벤치: ${bad}건 실패\n` : '\n마을 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
