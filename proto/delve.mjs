/* delve.mjs — 프로토타입이 자기 주장을 지키는가.
   주장: 「같은 모듈, 다른 순서 → 다른 결과」.
   순서가 결과를 안 바꾸면 이 설계는 또 장식이고, 그러면 내가 또 실패한 것이다. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 1000, height: 900 } });
const errs = [];
pg.on('pageerror', e => errs.push(e.message));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) errs.push('console: ' + m.text()); });
await pg.goto('http://localhost:8299/deeprun-delve.html', { waitUntil: 'networkidle' });
await pg.waitForTimeout(500);

/* 1. 순서 벤치 — 5모듈 120순열, 각 40회 */
const bench = await pg.evaluate(() => window.__bench(40));
console.log(`\n순서 벤치 — 같은 5모듈의 ${bench.n}가지 순열, 각 40회, 같은 적 3체`);
console.log(`  최고  ${String(bench.best[1]).padStart(6)}  ${bench.best[0]}`);
console.log(`  최저  ${String(bench.worst[1]).padStart(6)}  ${bench.worst[0]}`);
console.log(`  격차  ×${(bench.best[1] / Math.max(1, bench.worst[1])).toFixed(1)}`);
console.log('  상위:'); for (const [k, v] of bench.top) console.log(`    ${String(v).padStart(6)}  ${k}`);
console.log('  하위:'); for (const [k, v] of bench.bottom) console.log(`    ${String(v).padStart(6)}  ${k}`);

/* 2. 실제로 걸어지는가 — 무작위 워크 300걸음 */
const walk = await pg.evaluate(async () => {
  const keys = [[0,-1],[0,1],[-1,0],[1,0]];
  const seen0 = window.__G ? 0 : 0;
  let fights = 0, moved = 0, drafts = 0;
  const before = { x: null, y: null };
  for (let i = 0; i < 300; i++) {
    const g = window.__peek();
    if (g.over) break;
    if (g.draftOpen) { document.querySelector('#cards .card')?.click(); drafts++; await new Promise(r=>setTimeout(r,20)); continue; }
    const k = keys[Math.floor(Math.random()*4)];
    const px = g.x, py = g.y;
    await window.__step(k[0], k[1]);
    await new Promise(r => setTimeout(r, 15));
    const h = window.__peek();
    if (h.x !== px || h.y !== py) moved++;
    if (h.kills > g.kills) fights++;
  }
  const g = window.__peek();
  return { moved, fights, drafts, depth: g.depth, hp: g.hp, kills: g.kills,
           revealed: g.revealed, over: g.over, chain: g.chain };
});
console.log(`\n무작위 워크 300걸음 — 이동 ${walk.moved} · 교전승 ${walk.fights} · 뽑기 ${walk.drafts}`);
console.log(`  구역 ${walk.depth} · 노심 ${walk.hp} · 정지 ${walk.kills} · 밝힌 칸 ${walk.revealed} · 체인 ${walk.chain}칸 · 종료 ${walk.over}`);

/* 3. 순서를 실제로 바꿀 수 있는가 (탭-탭 교환) */
const swap = await pg.evaluate(() => {
  const g0 = window.__peek().chainIds.join(',');
  const els = document.querySelectorAll('#chain .mod');
  if (els.length < 2) return { ok: false, why: '체인이 2칸 미만' };
  els[0].click(); document.querySelectorAll('#chain .mod')[1].click();
  const g1 = window.__peek().chainIds.join(',');
  return { ok: g0 !== g1, g0, g1 };
});
console.log(`\n탭-탭 순서 교환: ${swap.ok ? '작동' : '실패 — ' + (swap.why || swap.g0)}`);

await pg.screenshot({ path: '/tmp/claude-0/-home-user-ROGUELIKE/df5def91-9f06-5415-baa6-46f3f5cf182c/scratchpad/delve3.png' });

let bad = 0;
if (bench.spread < 10) { console.log('\n  ✗ 순서를 바꿔도 결과가 거의 같다 — 이 설계는 장식이다'); bad++; }
if (walk.moved < 100) { console.log('  ✗ 걷지를 못한다'); bad++; }
if (walk.fights < 1) { console.log('  ✗ 300걸음 동안 아무것도 못 잡았다'); bad++; }
if (!swap.ok) { console.log('  ✗ 순서를 바꿀 수 없다'); bad++; }
if (errs.length) { console.log('  ✗ 콘솔 오류:'); errs.slice(0,5).forEach(e=>console.log('     '+e)); bad++; }
else console.log('\n  · 콘솔 오류 없음');
console.log(bad ? `\n델브 벤치: ${bad}건 실패\n` : '\n델브 벤치: 전부 통과\n');
await b.close();
process.exit(bad ? 1 : 0);
