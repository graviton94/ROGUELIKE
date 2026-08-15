/* ═══════════════════════════════════════════════════════════
   fair.mjs — 판이 애초에 성립하는가

   외부 평가 보고서가 두 가지를 요구했다: 생성된 층의 **연결성**을
   플러드 필로 검증할 것, 시야를 **대칭**으로 만들 것. 재 보니 둘 다
   이미 참이었다(120층 중 계단에 못 닿는 층 0, 반경 안 비대칭 0%).

   그래서 이 파일은 고치는 벤치가 아니라 **잠그는** 벤치다. 지금 맞는
   것이 조용히 틀려지는 것을 막는다.

   ── 그리고 이 파일 자체가 그 교훈을 한 번 겪었다 ──
   처음 판은 `walkable`로 셌다. 그랬더니 「모닥불에 못 닿는 층 2/120」
   「최악의 층은 걸을 수 있는 칸의 55%가 끊김」이 나왔고, 나는 생성기에
   두 가지를 붙였다: 못 닿는 곳의 모닥불을 옮기는 패스와, 끊긴 덩어리에
   굴을 파는 패스. 두 번째 것을 켜고 다시 재니 최악이 72%로 **더**
   나빠졌다 — 그 순간 자를 의심했다.
   원인은 `walkable`이 잠긴 문을 벽으로 세는 것이었다. 잠긴 문은 벽이
   아니라 **열쇠를 아직 안 구한 문**이다. 제대로 세니 300층 전부
   고립 0.0%였다 — 생성기는 처음부터 멀쩡했고, 나는 자물쇠라는 장치를
   옆으로 우회하는 굴을 팔 뻔했다. 두 패스는 지웠다. 그리고 이 둘은 틀렸을 때 화면에서
   「어렵다」로 보이지 「고장」으로 안 보인다:

     · 계단에 못 닿는 층은 「운이 나빴다」로 읽힌다. 실제로는 그 판이
       거기서 끝난 것이다. 인내심 시계도 못 구한다 — 시계는 잠긴
       자물쇠를 삭히지, 없는 길을 만들지 않는다.
     · 비대칭 시야는 「불공평하다」로 읽힌다. 보이지 않는 것에게
       일방적으로 맞는 것은 난이도가 아니라 규칙 위반이다.

   ── 다만 어둠은 예외다. 그리고 그 예외는 의도된 것이다. ──
   불이 꺼지면 이쪽 반경은 4로 줄고 저쪽(DARK_SIGHT)은 7이다. 이건
   버그가 아니라 이 게임이 파는 것이다 — 「여기 사는 것들은 여기서
   살고, 눈이 먼 쪽은 너다」. 대신 값을 치른다: 붙어 있는 것과 밝은
   방 안은 언제나 보이고(sim/dark.mjs), 규칙이 예고를 삼킨 그 순간
   화면이 한 번 그렇게 말한다. 그러니 여기서 재는 대칭은 **불이 켜져
   있을 때의 대칭**이다. 어둠의 비대칭은 크기까지 인쇄해 둔다 —
   의도된 값도 얼마짜리인지는 알고 있어야 한다.

   usage: node sim/fair.mjs [층수=120]
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const W = await import('../src/world.js');
const G = Game.G;

const N = Number(process.argv[2] || 120);

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

console.log(`\n성립 벤치 — 판이 애초에 성립하는가 (${N}층)\n`);

/* 걸어서 닿는 칸 전부. 두 가지를 조심한다.

   대각선까지 센다 — 이 게임은 대각선으로 걷는다. 4방향으로 재면
   실제보다 좁게 나오고, 그러면 있지도 않은 고립을 보고한다.

   그리고 **잠긴 문은 벽이 아니다.** 처음에 `walkable`로 셌더니 잠긴
   문 뒤가 전부 「끊긴 구역」으로 잡혔고, 최악의 층이 52%에서 72%로
   오락가락했다. 세계가 틀린 것이 아니라 자가 틀린 것이었다 —
   그 문은 열쇠를 아직 안 구한 문이지 못 가는 곳이 아니다. */
function flood(L, sx, sy) {
  const seen = new Uint8Array(L.tiles.length);
  const q = [W.idx(sx, sy)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % W.MW, cy = (c / W.MW) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W.MW || ny >= W.MH) continue;
      const ni = W.idx(nx, ny);
      if (seen[ni] || !W.eventuallyWalkable(L, nx, ny)) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  return seen;
}

let noStairs = 0, isoWorst = 0, isoSum = 0, campUnreachable = 0, floors = 0;
for (let n = 0; n < N; n++) {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(1 + (n % 14));
  const L = G.level, p = G.player;
  const seen = flood(L, p.x, p.y);
  floors++;

  let down = -1, camp = -1, walk = 0, got = 0;
  for (let i = 0; i < L.tiles.length; i++) {
    if (L.tiles[i] === W.DOWN) down = i;
    if (L.tiles[i] === W.CAMP) camp = i;
    const x = i % W.MW, y = (i / W.MW) | 0;
    if (W.eventuallyWalkable(L, x, y)) { walk++; if (seen[i]) got++; }
  }
  if (down >= 0 && !seen[down]) noStairs++;
  if (camp >= 0 && !seen[camp]) campUnreachable++;
  const iso = 1 - got / Math.max(1, walk);
  isoSum += iso;
  isoWorst = Math.max(isoWorst, iso);
}

console.log(`      계단에 못 닿는 층 ${noStairs}/${floors}`
  + ` · 모닥불에 못 닿는 층 ${campUnreachable}/${floors}`);
console.log(`      걸을 수 있는데 닿지 않는 칸 — 평균 ${(isoSum / floors * 100).toFixed(1)}%`
  + ` · 최악 ${(isoWorst * 100).toFixed(1)}%\n`);

ok(noStairs === 0, '계단에 언제나 걸어서 닿는다 — 못 닿으면 그 판은 거기서 끝난 것이다',
   `${noStairs}층`);
ok(campUnreachable === 0, '모닥불에도 닿는다 — 층의 유일한 보급처다', `${campUnreachable}층`);
/* 고립 자체는 죄가 아니다. 벽 뒤의 빈 방, 물 건너의 섬 — 지도에
   그려지지만 못 가는 곳은 세계가 넓어 보이게 한다. 다만 절반을
   넘으면 그건 「넓은 세계」가 아니라 「생성기가 반쪽을 버린 것」이다. */
ok(isoWorst < 0.5, '최악의 층도 걸을 수 있는 칸의 절반 이상은 닿는다',
   `${(isoWorst * 100).toFixed(1)}%`);

/* ── 시야 대칭 ─────────────────────────────────────────── */
Meta.forget();
Game.startGame('human', 'warrior', Game.rollStats('warrior'));
Game.descend();
Game.enterDepth(5);
{
  const L = G.level, p = G.player;
  p.lightTurns = 900;
  Game.recalc(p); Game.refreshFov();
  let checked = 0, asym = 0;
  for (let i = 0; i < L.tiles.length; i++) {
    const x = i % W.MW, y = (i / W.MW) | 0;
    if (!W.walkable(L, x, y)) continue;
    if (Math.hypot(x - p.x, y - p.y) > G.lightRadius) continue;
    checked++;
    /* 저쪽이 이쪽을 보는 판정은 규칙이 실제로 쓰는 것과 같아야 한다.
       `lineClear`가 그것이다 — 예고·사격·주문이 전부 이 함수를
       지난다. 다른 자로 재면 재는 것은 대칭이 아니라 내 흉내다. */
    const iSee = !!L.vis[i];
    const itSees = W.lineClear(L, x, y, p.x, p.y);
    if (iSee !== itSees) asym++;
  }
  console.log('');
  ok(checked > 12, '반경 안에 실제로 잴 칸이 있다 — 0칸이면 어떤 부등식이든 통과한다',
     `${checked}칸`);
  ok(asym / Math.max(1, checked) < 0.05,
     '불이 켜져 있으면 시야가 대칭이다 — 보이지 않는 것에게 맞는 것은 난이도가 아니라 규칙 위반이다',
     `${asym}/${checked} (${(asym * 100 / Math.max(1, checked)).toFixed(1)}%)`);

  /* 어둠의 비대칭은 의도된 값이다. 크기를 인쇄만 한다. */
  p.lightTurns = 0;
  Game.recalc(p); Game.refreshFov();
  console.log(`\n      (참고) 불이 꺼졌을 때 — 이쪽 반경 ${G.lightRadius}`
    + ` · 저쪽 ${Game.DARK_SIGHT}칸. 의도된 비대칭이고, 값은 sim/dark.mjs가 잰다.\n`);
}

console.log(bad ? `성립 벤치: ${bad}건 실패\n` : '성립 벤치: 판이 성립한다\n');
process.exit(bad ? 1 : 0);
