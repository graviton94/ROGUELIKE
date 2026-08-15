/* pace.mjs — 층 예산이 층의 실제 크기와 맞는가.

   tension.mjs는 「한 층에 몇 턴」을 평균으로만 낸다. 그런데 판당 턴
   분포는 오른쪽 꼬리가 매우 길다(라이브락 근처까지 가는 판이 섞인다).
   평균 하나로는 「과업이 늘렸다」와 「한 판이 60000턴을 썼다」를
   구별할 수 없다. 그래서 여기서는 **가운데값**을 같이 낸다.

   그리고 이 파일의 진짜 목적: 층 예산 FLOOR_BUDGET(d) = 320 − 8d 는
   깊이만 보고 층의 **실제 크기**를 안 본다. 같은 5층이라도 좁은 굴은
   방이 13개고 큰 방은 4개다. 그래서 층마다 걸을 수 있는 칸 수와
   입구→계단 최단 거리를 같이 재서, 예산이 무엇과 맞아야 하는지를
   숫자로 놓는다.

   usage: node sim/pace.mjs [직업당 판수=8]
     환경변수 NO_OUTFIT=1 이면 봇이 마을에서 아무것도 안 산다.       */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const W = await import('../src/world.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 8);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];

/* ── 층의 크기 ────────────────────────────────────────────
   걸을 수 있는 칸 수와 입구→계단 최단 거리. 예산이 붙어야 할
   후보 둘이다. 거리는 실제 걸음 수라 곧 「최소 필요 턴」이고,
   칸 수는 「다 보려면」에 해당한다. */
export function geometry(L) {
  let walk = 0;
  for (let i = 0; i < L.tiles.length; i++) {
    const t = L.tiles[i];
    if (t === W.ROCK || t === W.SHOP) continue;
    if (t === W.PROP) continue;
    walk++;
  }
  // 입구 → 내려가는 계단 BFS (닫힌 문은 한 걸음으로 친다)
  const dist = new Int32Array(W.MW * W.MH).fill(-1);
  const s = W.idx(L.entry.x, L.entry.y);
  dist[s] = 0;
  const q = [s];
  let goal = -1;
  for (let i = 0; i < L.tiles.length; i++) if (L.tiles[i] === W.DOWN) goal = i;
  const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c === goal) break;
    const cx = c % W.MW, cy = (c / W.MW) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W.MW || ny >= W.MH) continue;
      const ni = W.idx(nx, ny);
      if (dist[ni] !== -1) continue;
      if (!W.walkable(L, nx, ny)) continue;
      dist[ni] = dist[c] + 1;
      q.push(ni);
    }
  }
  return { walk, rooms: L.rooms.length, theme: L.theme?.id || '?',
           stairDist: goal >= 0 ? dist[goal] : -1 };
}

const med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

const runTurns = [], runDepth = [];
const floorTurns = new Map();   // depth -> [turns]
const geo = new Map();          // depth -> [geometry]
let stuck = 0, runs = 0;

for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    const seenDepth = new Set();
    const r = runBot('human', cls, i % 2 === 0, { onTurn: g => {
      if (g.depth > 0 && g.level && !seenDepth.has(g.depth)) {
        seenDepth.add(g.depth);
        if (!geo.has(g.depth)) geo.set(g.depth, []);
        geo.get(g.depth).push(geometry(g.level));
      }
    } });
    runs++;
    if (r.stuck) { stuck++; continue; }     // 라이브락 판은 통계에서 뺀다
    runTurns.push(G.turn || 0); runDepth.push(r.depth);
    for (const [d, t] of Object.entries(G.floorTurns || {})) {
      const k = Number(d);
      if (!floorTurns.has(k)) floorTurns.set(k, []);
      floorTurns.get(k).push(t);
    }
  }
}

console.log(`\n페이싱 — ${runs}판 (라이브락 ${stuck}판 제외) · NO_OUTFIT=${process.env.NO_OUTFIT || '0'} · TASK_ODDS=${D.TASK_ODDS}`);
console.log(`\n판당 턴 — 가운데값 ${med(runTurns).toFixed(0)} · 평균 ${mean(runTurns).toFixed(0)}`
  + ` · 최대 ${Math.max(...runTurns)}`);
console.log(`도달 층 — 가운데값 ${med(runDepth).toFixed(1)} · 평균 ${mean(runDepth).toFixed(2)}`);
console.log(`라이브락 ${stuck}/${runs} (${(stuck * 100 / runs).toFixed(1)}%)`);

console.log(`\n층별 — 소요 턴(가운데값/평균) · 예산 · 사용률 · 층 크기\n`);
console.log('  층   가운데  평균   예산  사용률   걷는칸  계단거리  방  n');
const depths = [...floorTurns.keys()].sort((a, b) => a - b).filter(d => d <= 12);
for (const d of depths) {
  const a = floorTurns.get(d);
  if (a.length < 3) continue;
  const b = D.FLOOR_BUDGET(d);
  const g = geo.get(d) || [];
  const gw = mean(g.map(x => x.walk)), gs = mean(g.map(x => x.stairDist)), gr = mean(g.map(x => x.rooms));
  console.log(`  ${String(d).padStart(2)}  ${String(med(a).toFixed(0)).padStart(6)}`
    + `${String(mean(a).toFixed(0)).padStart(7)}${String(b).padStart(7)}`
    + `${(med(a) / b).toFixed(2).padStart(8)}`
    + `${gw.toFixed(0).padStart(9)}${gs.toFixed(0).padStart(9)}${gr.toFixed(1).padStart(6)}`
    + `${String(a.length).padStart(4)}`);
}

/* 층 크기가 실제로 얼마나 흔들리는가 — 예산이 깊이만 봐도 되는지의 근거. */
console.log(`\n같은 깊이 안에서 층 크기가 얼마나 다른가 (테마별, 5층):`);
const g5 = [];
for (let i = 0; i < 400; i++) { const L = new W.Level(5, {}); g5.push(geometry(L)); }
const byTheme = new Map();
for (const g of g5) { if (!byTheme.has(g.theme)) byTheme.set(g.theme, []); byTheme.get(g.theme).push(g); }
for (const [t, a] of [...byTheme.entries()].sort((x, y) => y[1].length - x[1].length)) {
  console.log(`  ${t.padEnd(9)} n=${String(a.length).padStart(3)}`
    + ` 걷는칸 ${mean(a.map(x => x.walk)).toFixed(0).padStart(4)}`
    + `  계단거리 ${mean(a.map(x => x.stairDist)).toFixed(0).padStart(3)}`
    + `  방 ${mean(a.map(x => x.rooms)).toFixed(1)}`);
}
const allW = g5.map(x => x.walk), allS = g5.map(x => x.stairDist);
console.log(`  전체      걷는칸 ${mean(allW).toFixed(0)} (최소 ${Math.min(...allW)} 최대 ${Math.max(...allW)})`
  + `  계단거리 ${mean(allS).toFixed(0)} (최소 ${Math.min(...allS)} 최대 ${Math.max(...allS)})`);
console.log('');
