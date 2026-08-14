/* shots.mjs — 실제로 한 판 돌리면서 화면을 찍는다.

   손으로 상태를 밀어 넣고 찍으면 「이렇게 보일 수도 있다」를 찍는
   것이지 「이렇게 보인다」를 찍는 것이 아니다. 그래서 봇을 브라우저
   안에서 돌린다 — 게임이 스스로 만든 층, 스스로 만난 것들, 스스로
   주운 것을 찍는다.

   찍는 순간은 정해 놓지 않고 **조건**으로 기다린다. 「50턴째」는
   판마다 다른 것을 보여 주지만 「처음으로 불이 꺼졌을 때」는 언제나
   같은 것을 보여 준다.

   usage: node sim/shots.mjs [저장폴더]                */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] || '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = [];
pg.on('pageerror', e => errs.push(e.message));
const SEED = Number(process.argv[3] || 424242);
await pg.addInitScript(z0 => { let z = z0 >>> 0;
  Math.random = () => ((z = (z * 1664525 + 1013904223) >>> 0) / 4294967296); }, SEED);
await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1200);

const dismiss = async () => {
  for (let i = 0; i < 12; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
        const e = document.getElementById(id);
        if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; }
      }
      return false;
    });
    if (!hit) return;
    await pg.waitForTimeout(200);
  }
};
/* 찍기 직전에 카드를 치운다. 미리 치워 두면 그 사이에 다음 장이
   올라와서, 찍히는 것이 화면이 아니라 양피지가 된다 — 이 세션에서
   같은 실수를 세 번째 한다. 그리고 층은 **찍는 순간** 읽는다.
   앞 회차의 state를 쓰면 「4층」이라 적고 1층을 찍게 된다. */
const shot = async (name, note) => {
  await dismiss();
  /* 카드를 치운 것만으로는 부족하다. 카드가 떠 있는 동안 HUD는 다시
     그려지지 않으므로, 치우기만 하고 찍으면 화면 위쪽이 카드가 뜨기
     **전**의 상태로 남아 있다 — 갱구 HUD 위에 4층 카드가 얹힌 사진이
     그렇게 나왔다. 한 턴을 흘려 전부 다시 그리게 한다. */
  await pg.evaluate(async () => (await import('/src/ui.js')).refresh());
  await pg.waitForTimeout(260);
  const where = await pg.evaluate(async () => {
    const G = (await import('/src/game.js')).G;
    return G.depth === 0 ? '갱구' : `${G.depth}층`;
  });
  await pg.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  · ${name} — ${where}${note ? ` · ${note}` : ''}`);
};

console.log('\n한 판 찍기\n');

/* ── 제목 ─────────────────────────────────────────────── */
await shot('01-title', '제목 화면');

/* 새 게임 → 종족·직업 고르기 */
await pg.evaluate(() => { const e = [...document.querySelectorAll('button')]
  .find(x => x.getBoundingClientRect().width > 2 && /새 게임/.test(x.textContent)); e && e.click(); });
await pg.waitForTimeout(400);
await shot('02-create', '인물 만들기');
for (let i = 0; i < 4; i++) {
  await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
    .filter(x => x.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
  await pg.waitForTimeout(320);
}
await dismiss();
await shot('03-yard', '갱구 야영지');

/* 수레 하나를 열어 본다 — 상인의 말이 나오는 자리다. */
await pg.evaluate(async () => {
  const Game = await import('/src/game.js');
  const W = await import('/src/world.js');
  const UI = await import('/src/ui.js');
  const G = Game.G, L = G.level, p = G.player;
  const spot = [...L.shopAt.keys()][2];
  p.x = spot % W.MW; p.y = (spot - p.x) / W.MW;
  Game.refreshFov(); UI.refresh();
  Game.openHere(); UI.setScreen(G.screen);
});
await pg.waitForTimeout(500);
await shot('04-shop', '수레 — 상인의 기분과 말');
/* 화면만 닫고 자리를 안 옮기면, 아래 봇 고리가 매 걸음 같은 수레를
   다시 연다 — 발밑의 것은 밟고 있는 동안 계속 발밑에 있으니까.
   턴이 하나도 안 흐른 채로 마흔 번을 돌았던 이유가 이것이었다. */
await pg.evaluate(async () => {
  const Game = await import('/src/game.js');
  const UI = await import('/src/ui.js');
  UI.setScreen('play');
  for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
    const p = Game.G.player, x = p.x, y = p.y;
    Game.step(dx, dy);
    if (p.x !== x || p.y !== y) break;
  }
});

/* ── 봇에게 판을 맡기고, 조건이 맞을 때 찍는다 ──────────── */
await pg.evaluate(async () => {
  const Game = await import('/src/game.js');
  window.__snap = {};
  window.__mark = k => { if (!window.__snap[k]) window.__snap[k] = Game.G.turn; };
});

/* 브라우저 안에서 봇을 돌린다. 헤드리스 벤치와 같은 정책이 아니라
   여기서는 「보여 줄 만한 판」을 만드는 것이 목적이므로, 간단한
   정책 하나로 계단을 향해 내려간다. */
const step = async (n) => pg.evaluate(async (count) => {
  const Game = await import('/src/game.js');
  const W = await import('/src/world.js');
  const G = Game.G;
  for (let i = 0; i < count && G.running; i++) {
    if (G.screen !== 'play') {
      /* 사건·더미·모닥불이 열리면 첫 선택지를 고른다. 한 번 눌러
         안 닫히면(배낭이 차서 더미를 못 집는 경우가 그렇다) 그냥
         닫는다 — 안 그러면 턴이 안 흐른 채로 고리만 돈다. */
      const was = G.screen;
      if (was === 'event') Game.eventChoose(0);
      /* 계단은 갈림길 화면을 띄운다. 그걸 그냥 닫으면 내려가는 것
         자체가 취소된다 — 그래서 판이 1층에 300턴 갇혀 있었다.
         가지를 실제로 고른다. */
      else if (was === 'stairs') {
        const opts = Game.stairOffers ? Game.stairOffers() : null;
        Game.chooseBranch(opts?.[0]?.id ?? null);
      }
      if (G.screen === was) G.screen = 'play';
      continue;
    }
    const p = G.player;
    /* 다치면 마신다. 첫 판에서 이걸 빼먹었더니 1층에서 455턴을 싸우다
       죽었고, 그러면 찍을 것이 「1층」밖에 없다. 보여 줄 판을 만들려면
       봇도 판을 살아 있게 둘 만큼은 해야 한다. */
    if (p.hp < p.maxhp * 0.45) {
      const k = p.pack.findIndex(sl => sl.item.use === 'heal' || sl.item.use === 'bigHeal');
      if (k >= 0) { Game.useItem(k); continue; }
    }
    const m = G.monsters.find(x => G.level.vis[W.idx(x.x, x.y)]
      && Math.hypot(x.x - p.x, x.y - p.y) < 1.6);
    if (m) { Game.step(Math.sign(m.x - p.x), Math.sign(m.y - p.y)); continue; }
    /* 발밑의 것은 한 번만 연다. 열고 나서 자리를 안 뜨면 다음 걸음에
       또 열리고, 그 사이 턴은 흐르지 않는다. */
    const here = Game.hereOffer();
    if (here && !window.__opened) {
      window.__opened = true;
      Game.openHere();
      continue;
    }
    if (!here) window.__opened = false;
    if (Game.stairHere() === 'down') { Game.descend(); continue; }
    /* 길 찾기. 처음에는 계단 쪽으로 직선으로 걸었는데, 벽을 만나면
       네 방향을 번갈아 찍는 식이라 1층에서 500턴을 헤매다 죽었다 —
       그러면 찍을 수 있는 것이 「1층」밖에 없다.
       너비 우선으로 제대로 찾는다. 목표는 둘: 아직 안 가 본 곳이
       있으면 그쪽(층을 구경해야 찍을 것이 생긴다), 없으면 계단.
       ui.js에 이미 같은 것이 있지만 내보내지 않는다 — 스크린샷을
       위해 화면 층의 내부를 열 이유는 없으므로 여기서 다시 쓴다. */
    const L = G.level;
    const walk = (x, y) => x >= 0 && y >= 0 && x < W.MW && y < W.MH
      && (L.tiles[W.idx(x, y)] === W.DOOR || !L.solid(x, y));
    const prev = new Int32Array(W.MW * W.MH).fill(-1);
    const start = W.idx(p.x, p.y);
    prev[start] = start;
    const q = [start];
    let goalIdx = -1, stairIdx = -1;
    for (let h = 0; h < q.length && goalIdx < 0; h++) {
      const cur = q[h], cx = cur % W.MW, cy = (cur / W.MW) | 0;
      if (L.tiles[cur] === W.DOWN && stairIdx < 0) stairIdx = cur;
      if (!L.seen[cur]) { goalIdx = cur; break; }
      for (const [ax, ay] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + ax, ny = cy + ay, ni = W.idx(nx, ny);
        if (!walk(nx, ny) || prev[ni] !== -1) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    if (goalIdx < 0) goalIdx = stairIdx;
    if (goalIdx < 0 || goalIdx === start) { Game.step(0, 0); continue; }
    let n = goalIdx;
    while (prev[n] !== start && prev[n] !== n) n = prev[n];
    Game.step((n % W.MW) - p.x, ((n / W.MW) | 0) - p.y);
  }
  return { depth: G.depth, turn: G.turn, hp: G.player?.hp, running: G.running,
           oil: G.player?.lightTurns, screen: G.screen };
}, n);

let state = null;
const marks = { fight: false, dark: false, spoils: false };
for (let round = 0; round < 400; round++) {
  state = await step(25);
  await dismiss();
  if (!state.running) break;

  const seen = await pg.evaluate(async () => {
    const Game = await import('/src/game.js');
    const W = await import('/src/world.js');
    const G = Game.G, p = G.player;
    return {
      depth: G.depth,
      near: G.monsters.filter(m => G.level.vis[W.idx(m.x, m.y)]
        && Math.hypot(m.x - p.x, m.y - p.y) < 4).length,
      dark: p.lightTurns <= 0,
      pile: G.items.some(o => o.kind === 'spoils'),
      screen: G.screen,
    };
  });

  if (!marks.fight && seen.near >= 1 && seen.depth >= 2) { marks.fight = true; await shot('05-fight', '붙었다'); }
  if (!marks.dark && seen.dark) { marks.dark = true; await shot('06-dark', '불이 꺼졌다'); }
  if (!marks.spoils && seen.pile) {
    marks.spoils = true;
    await pg.evaluate(async () => {
      const Game = await import('/src/game.js');
      const W = await import('/src/world.js');
      const UI = await import('/src/ui.js');
      const G = Game.G, p = G.player;
      const pile = G.items.find(o => o.kind === 'spoils');
      p.x = pile.x; p.y = pile.y;
      Game.refreshFov(); Game.openHere(); UI.setScreen(G.screen);
    });
    await shot('07-spoils', '전리품 더미 — 셋 중 하나');
    await pg.evaluate(async () => (await import('/src/ui.js')).setScreen('play'));
  }

  /* 깊은 구역에 처음 닿았을 때 — 돌이 달아오르는 것이 보이는 자리 */
  for (const [d, name] of [[4, '08-mine'], [8, '09-shrine'], [11, '10-ember']]) {
    if (state.depth >= d && !marks[name]) {
      marks[name] = true;
      await dismiss();
      await shot(name);
    }
  }
}

/* 죽은 순간의 화면과 끝 화면은 다른 그림이다. 둘 다 찍는다 —
   앞의 것은 어떻게 죽었는지를, 뒤의 것은 무엇을 남겼는지를 말한다. */
await dismiss();
await shot('11-death', state?.running ? '멈춘 자리' : '쓰러진 순간');
if (!state?.running) {
  await pg.evaluate(async () => (await import('/src/ui.js')).setScreen('end'));
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${OUT}/12-end.png` });
  console.log('  · 12-end — 끝 화면');
}
console.log(`\n마지막 상태: ${JSON.stringify(state)}`);
if (errs.length) console.log(`콘솔 오류: ${errs[0]}`);
console.log(`\n${OUT}에 저장했다\n`);
await b.close();
