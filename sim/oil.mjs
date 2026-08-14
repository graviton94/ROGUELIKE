/* oil.mjs — 횃불은 지금 실제로 무는가.

   횃불은 이미 있다: 1100턴에서 시작해 매 턴 줄고, 반경은
   7 → 5(300 미만) → 3(80 미만) → 2(0). 그런데 「있다」와 「문다」는
   다르다. 판의 대부분을 가장 밝은 반경에서 보내고 한 번도 안 꺼진다면
   그것은 시계가 아니라 장식이다.

   그래서 세 가지만 센다:
     · 한 판의 턴을 어느 반경에서 보내는가
     · 몇 %의 판에서 불이 꺼지는가, 꺼진 뒤 몇 턴을 더 사는가
     · 기름을 어디서 채우는가 (모닥불이냐 소모품이냐)

   집계는 endTurn 한 곳에서 한다 (G.lit). 걷기 집계와 같은 자리다.

   usage: node sim/oil.mjs [runs]                */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 8);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];

const band = {};           // 반경별 턴 수
let runs = 0, depth = 0, turns = 0, wentDark = 0, darkTurns = 0, endOil = 0;
let blindTurns = 0, litTurns = 0, bigDark = 0, bigLit = 0;
const depthsDark = [], depthsLit = [];

for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    /* 어둠이 실제로 값을 무는가 — 도달 층으로는 못 잰다. 기름 소모를
       4배로 올리고 4분의 1로 낮춰 봤더니 6.42 / 5.98 / 6.08로 오차 안에서
       같았다(봇이 다른 데서 벌충한다). 직접 결과를 센다: **예고 없이
       맞은 큰 한 방**. 봇은 예고를 딱 한 군데에서만 쓴다(heavy면 물러선다)
       므로, 어둠이 예고를 가리면 여기가 움직여야 한다. */
    let prevBlind = false;
    const r = runBot('human', cls, i % 2 === 0, { onTurn: g => {
      const pl = g.player; if (!pl) return;
      const blind = g.depth > 0 && pl.lightTurns <= 0;
      if (blind) blindTurns++; else litTurns++;
      for (const e of (g.fx || []))
        if (e.t === 'hit' && e.on === 'player' && e.dmg >= pl.maxhp * 0.22) {
          if (prevBlind) bigDark++; else bigLit++;
        }
      prevBlind = blind;
    } });
    runs++; depth += r.depth; turns += G.turn || 0;
    for (const [k, v] of Object.entries(G.lit || {})) band[k] = (band[k] || 0) + v;
    const dark = (G.lit || {})['2'] || 0;
    if (dark > 0) { wentDark++; darkTurns += dark; depthsDark.push(r.depth); }
    else depthsLit.push(r.depth);
    endOil += G.player?.lightTurns || 0;
  }
}

const sum = Object.values(band).reduce((a, b) => a + b, 0) || 1;
const mean = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '—';

console.log(`\n횃불은 무는가 — ${CLASSES.length}직업 × ${N}판 = ${runs}판 · 평균 ${(depth/runs).toFixed(1)}층 · 판당 ${(turns/runs).toFixed(0)}턴\n`);
console.log('턴을 어느 반경에서 보냈나:');
for (const k of ['7', '6', '5', '4', '3', '2']) {
  const v = band[k] || 0, pct = v * 100 / sum;
  const label = k === '2' ? '2칸 — 불이 꺼진 상태' : `${k}칸`;
  console.log(`  ${String(Math.round(pct)).padStart(3)}%  ${'█'.repeat(Math.round(pct/2)).padEnd(50, '·')}  ${label}`);
}
console.log(`\n불이 꺼진 판  ${wentDark}/${runs} (${Math.round(wentDark*100/runs)}%)`);
console.log(`꺼진 뒤 산 턴  판당 평균 ${wentDark ? Math.round(darkTurns/wentDark) : 0}턴`);
console.log(`끝날 때 남은 기름 평균 ${Math.round(endOil/runs)}`);
console.log(`\n도달 층수 — 꺼진 판 ${mean(depthsDark)}층 / 안 꺼진 판 ${mean(depthsLit)}층`);
console.log('\n가장 밝은 칸에서 대부분을 보내고 한 번도 안 꺼지면, 그것은 시계가 아니라 장식이다.\n');

/* ── 어둠이 값을 무는가 ─────────────────────────────────── */
const perK = (n, t) => t ? n / t * 1000 : 0;
const dRate = perK(bigDark, blindTurns), lRate = perK(bigLit, litTurns);
console.log(`1000턴당 큰 한 방(최대체력 22%+) — 어둠 ${dRate.toFixed(1)} / 밝음 ${lRate.toFixed(1)}`
  + `  (배수 ${(dRate / Math.max(0.01, lRate)).toFixed(2)})`);
let bad = 0;
const ok = (c, msg, got) => {
  console.log(`  ${c ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!c) bad++;
};
ok(blindTurns > 5000 && litTurns > 5000, '어둠과 밝음을 둘 다 충분히 걸었다',
   `어둠 ${blindTurns} · 밝음 ${litTurns}`);
/* 배수는 판정에 못 쓴다. A/B를 두 벌 돌렸더니
       가리기 전 1.37 · 1.63     가린 뒤 1.76 · 3.07
   방향은 언제나 같은데 값이 겹친다 — 문턱을 어디에 놓아도 한쪽이
   샌다. 흔들리는 것을 문턱으로 눌러 통과시키는 것은 벤치를 내 편으로
   만드는 것이다. 인쇄만 한다.

   대신 **규칙 자체**를 잠근다. 이건 확률이 아니라 계약이라 흔들리지
   않는다: 불이 꺼졌고, 붙어 있지 않고, 방도 어두우면 예고는 없다. */
{
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend(); Game.enterDepth(5);
  const L = G.level, pl = G.player;
  for (const r of L.rooms) r.lit = false;
  const spot = (() => {
    for (let d = 3; d < 9; d++)
      for (let dx = -d; dx <= d; dx++) for (let dy = -d; dy <= d; dy++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === d && !L.solid(pl.x + dx, pl.y + dy))
          return { x: pl.x + dx, y: pl.y + dy };
  })();
  const D2 = await import('../src/data.js');
  const spec = D2.MONSTERS.find(m => m.heavy) || D2.MONSTERS[0];
  const mk = () => { G.monsters.length = 0;
    G.monsters.push({ ...spec, hp: spec.hp, maxhp: spec.hp, ...spot, awake: true, energy: 0 }); };

  pl.lightTurns = 900; mk(); Game.step(0, 0);
  const litIntent = G.monsters[0]?.intent;
  pl.lightTurns = 0; mk(); Game.step(0, 0);
  const darkIntent = G.monsters[0]?.intent;
  const near = { ...spot, x: pl.x + 1, y: pl.y };
  G.monsters.length = 0;
  G.monsters.push({ ...spec, hp: spec.hp, maxhp: spec.hp, ...near, awake: true, energy: 0 });
  Game.step(0, 0);
  const closeIntent = G.monsters[0]?.intent;

  ok(!!litIntent, '불이 있으면 멀리 있는 것의 예고가 읽힌다', litIntent || '없음');
  ok(!darkIntent, '불이 꺼지면 멀리 있는 것의 예고가 안 읽힌다 — 어둠이 무는 값',
     darkIntent || '없음');
  ok(!!closeIntent, '붙어 있는 것은 어둠 속에서도 읽힌다 — 코앞을 못 보는 것은 어둠이 아니라 부당함이다',
     closeIntent || '없음');
}
console.log(bad ? `\n횃불 벤치: ${bad}건 실패\n` : '\n횃불 벤치: 어둠이 값을 문다\n');
process.exit(bad ? 1 : 0);
