/* ═══════════════════════════════════════════════════════════
   quest.mjs — 층에 ? 가 둘인데 사건은 하나였다

   플레이어의 말: 「? 이벤트는 층마다 여러개가 있는데 하나만
   활성화됌」. 코드를 보니 그대로였다 — `placeEvent`는 5층 아래에서
   절반 확률로 두 번째 ? 를 깔고, `enterDepth`는 **층당 하나**를
   굴려서 `L.eventId`에 넣었다. 어느 쪽을 밟든 같은 사건이 뜨고,
   하나를 소비하면 `eventId = null`이 되어 나머지 ? 는 밟아도 아무
   일도 안 일어나는 칸이 된다.

   그건 「사건이 두 개인 층」이 아니라 **미끼가 하나 더 있는 층**이다.
   던전에서 가장 싼 콘텐츠라고 파일 머리에 적어 놓고, 절반은 버리고
   있었다.

   그래서 사건을 칸에 붙인다(`L.eventAt`). 이 파일이 묻는 것:
     1. ? 가 둘인 층에서 사건도 둘인가
     2. 그 둘이 서로 다른 사건인가 (같으면 「한 번 더」지 「두 개」가 아니다)
     3. 하나를 소비해도 나머지가 살아 있는가
     4. 판 하나에서 실제로 만나는 사건 수가 늘었는가 (봇으로)

   usage: node sim/quest.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('/home/user/ROGUELIKE/src/meta.js');
const Game = await import('/home/user/ROGUELIKE/src/game.js');
const W    = await import('/home/user/ROGUELIKE/src/world.js');
const { runBot } = await import('/home/user/ROGUELIKE/sim/_botlib.mjs');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

console.log('\n사건 벤치 — ? 가 둘이면 사건도 둘인가\n');

/* ── 1·2. 칸마다 다른 사건이 붙는가 ────────────────────── */
Meta.forget();
Game.startGame('human', 'warrior', Game.rollStats('warrior'));
Game.descend();
let floors = 0, twoTiles = 0, twoEvents = 0, sameEvent = 0, tiles = 0;
for (let d = 1; d <= 15; d++) {
  for (let t = 0; t < 20; t++) {
    Game.enterDepth(d);
    const L = G.level;
    const n = (L.eventTiles || []).length;
    if (!n) continue;
    floors++; tiles += n;
    if (n >= 2) {
      twoTiles++;
      const ids = [...L.eventAt.values()];
      if (ids.length >= 2) twoEvents++;
      if (new Set(ids).size < ids.length) sameEvent++;
    }
  }
}
console.log(`  층 ${floors}개 · ? 칸 ${tiles}개 (층당 ${(tiles/floors).toFixed(2)})`);
ok(twoTiles > 0, '? 가 둘인 층이 실제로 나온다 — 안 나오면 아래 셋은 아무 말도 안 한 것이다',
   `${twoTiles}층`);
ok(twoEvents === twoTiles, '? 가 둘인 층은 사건도 둘이다',
   `${twoEvents}/${twoTiles}`);
ok(sameEvent === 0, '그리고 그 둘은 서로 다른 사건이다 — 같으면 「두 개」가 아니라 「한 번 더」다',
   `겹친 층 ${sameEvent}`);

/* ── 3. 하나를 소비해도 나머지가 산다 ──────────────────── */
{
  let checked = 0;
  for (let t = 0; t < 300 && checked < 5; t++) {
    Game.enterDepth(8);
    const L = G.level, p = G.player;
    const spots = [...(L.eventAt?.keys() || [])];
    if (spots.length < 2) continue;
    checked++;
    /* 첫 칸에 서서 고르고, 둘째 칸으로 옮겨서 아직 사건이 있는지 본다.
       (걸어가는 것이 아니라 놓는다 — 재려는 것은 길이 아니라 칸이다.) */
    p.x = spots[0] % W.MW; p.y = (spots[0] / W.MW) | 0;
    const first = Game.eventHere();
    Game.eventChoose(0);
    p.x = spots[1] % W.MW; p.y = (spots[1] / W.MW) | 0;
    const second = Game.eventHere();
    if (!(first && second && first !== second)) {
      ok(false, '하나를 소비해도 나머지 ? 가 산다', `${first} → ${second}`);
      break;
    }
  }
  if (checked) ok(true, '하나를 소비해도 나머지 ? 가 산다', `${checked}개 층에서 확인`);
  else ok(false, '? 가 둘인 8층을 300번 굴려도 못 만들었다 — 자가 틀렸다');
}

/* ── 4. 판 하나에서 실제로 몇 개를 만나는가 ────────────── */
console.log('');
{
  const seen = [];
  for (let i = 0; i < 40; i++) { runBot('human', 'warrior', true); seen.push(G.eventsSeen || 0); }
  const v = seen.slice().sort((a,b)=>a-b);
  const per = v.reduce((a,b)=>a+b,0) / v.length;
  console.log(`  봇 40판에서 판당 만난 사건 ${per.toFixed(2)}개 (중앙 ${v[v.length>>1]})`);
  /* 「늘었나」를 여기서 판정하지는 않는다 — 이전 값을 이 파일이
     들고 있지 않고, 봇의 도달 깊이가 흔들리면 이 숫자도 같이
     흔들린다(sim/relicrack.mjs에서 한 번 데었다). 인쇄만 한다. */
  ok(per > 0, '봇이 사건을 실제로 밟는다 — 0이면 위의 셋은 화면에 안 닿는 얘기다',
     per.toFixed(2));
}

console.log(bad ? `\n사건 벤치: ${bad}건 실패\n` : '\n사건 벤치: ? 가 둘이면 사건도 둘이다\n');
process.exit(bad ? 1 : 0);
