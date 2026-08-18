/* shotcls.mjs — 여섯 직업의 여덟 칸을 실제 층에서 찍는다.

   손으로 상태를 밀어 넣고 마을에서 찍으면 줄이 전부 식어 있다
   (대상이 없으므로). 그러면 찍히는 것은 「여덟 칸」이 아니라
   「여덟 개의 회색 상자」다. 그래서 계단을 밟고 내려가서 찍는다.

   usage: node sim/shotcls.mjs [저장폴더]                        */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] || '/tmp/shots';
mkdirSync(OUT, { recursive: true });
const CLS = ['warrior', 'rogue', 'ranger', 'mage', 'priest', 'paladin'];
const KO = { warrior:'전사', rogue:'도적', ranger:'궁수', mage:'마법사', priest:'사제', paladin:'팔라딘' };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const walkDown = async (pg, want) => pg.evaluate(async (deep) => {
  const Game = await import('/src/game.js');
  const W = await import('/src/world.js');
  const G = Game.G;
  for (let i = 0; i < 6000 && G.running && G.depth < deep; i++) {
    if (G.screen !== 'play') {
      const was = G.screen;
      if (was === 'event') Game.eventChoose(0);
      else if (was === 'stairs') {
        const o = Game.stairOffers ? Game.stairOffers() : null;
        Game.chooseBranch(o?.[0]?.id ?? null);
      }
      if (G.screen === was) G.screen = 'play';
      continue;
    }
    const p = G.player;
    if (p.hp < p.maxhp * 0.5) { p.hp = p.maxhp; }   // 찍는 것이 목적이지 재는 것이 아니다
    const m = G.monsters.find(x => G.level.vis[W.idx(x.x, x.y)]
      && Math.hypot(x.x - p.x, x.y - p.y) < 1.6);
    if (m) { Game.step(Math.sign(m.x - p.x), Math.sign(m.y - p.y)); continue; }
    if (Game.stairHere() === 'down') { Game.descend(); continue; }
    const L = G.level;
    const walk = (x, y) => x >= 0 && y >= 0 && x < W.MW && y < W.MH
      && (L.tiles[W.idx(x, y)] === W.DOOR || !L.solid(x, y));
    const prev = new Int32Array(W.MW * W.MH).fill(-1);
    const start = W.idx(p.x, p.y);
    prev[start] = start;
    const q = [start];
    let goal = -1, stair = -1;
    for (let h = 0; h < q.length && goal < 0; h++) {
      const cur = q[h], cx = cur % W.MW, cy = (cur / W.MW) | 0;
      if (L.tiles[cur] === W.DOWN && stair < 0) stair = cur;
      if (!L.seen[cur]) { goal = cur; break; }
      for (const [ax, ay] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + ax, ny = cy + ay, ni = W.idx(nx, ny);
        if (!walk(nx, ny) || prev[ni] !== -1) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    if (goal < 0) goal = stair;
    if (goal < 0 || goal === start) { Game.step(0, 0); continue; }
    let n = goal;
    while (prev[n] !== start && prev[n] !== n) n = prev[n];
    Game.step((n % W.MW) - p.x, ((n / W.MW) | 0) - p.y);
  }
  return { depth: G.depth, running: G.running };
}, want);

const dismiss = async pg => {
  for (let i = 0; i < 14; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
        const e = document.getElementById(id);
        if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; }
      }
      return false;
    });
    if (!hit) return;
    await pg.waitForTimeout(160);
  }
};

console.log('\n여섯 직업의 여덟 칸\n');
let i = 0;
for (const cls of [...CLS, '320']) {
  const small = cls === '320';
  const c = small ? 'rogue' : cls;
  const pg = await b.newPage({ viewport: small ? { width: 320, height: 568 }
                                              : { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pg.addInitScript(z0 => { let z = z0 >>> 0;
    Math.random = () => ((z = (z * 1664525 + 1013904223) >>> 0) / 4294967296); }, 7000 + i * 13);
  await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1100);
  await pg.evaluate(async (k) => {
    const Game = await import('/src/game.js');
    const UI = await import('/src/ui.js');
    Game.startGame('human', k, Game.rollStats(k));
    UI.setScreen('play'); UI.refresh();
  }, c);
  await pg.waitForTimeout(300);
  await dismiss(pg);
  const st = await walkDown(pg, 3);
  await dismiss(pg);
  /* 열두 레벨. 여덟 칸이 다 열리는 첫 자리이고, 그 위는 같은 그림이다. */
  await pg.evaluate(async () => {
    const Game = await import('/src/game.js');
    const UI = await import('/src/ui.js');
    const p = Game.G.player;
    p.lv = 12; Game.recalc(p);
    p.mana = p.maxmana; p.stam = p.maxStam; p.hp = Math.round(p.maxhp * 0.72);
    Game.refreshFov(); UI.refresh();
  });
  await pg.waitForTimeout(420);
  const name = small ? '37-small-320' : `3${i}-${cls}`;
  await pg.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  · ${name} — ${KO[c]} · ${st.depth}층`);
  await pg.close();
  i++;
}
await b.close();
console.log(`\n${OUT}에 저장했다\n`);
