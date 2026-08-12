/* live.mjs — 실시간 판이 실제로 굴러가는가, 그리고 여전히 순서가 결과를 바꾸는가.
   실시간이라 「걸음 수」로는 못 잰다. 시계를 실제로 흘려보내고, 화면이
   무엇을 그리고 있는지·플레이어가 살아 있는지·이펙트가 실제로 나는지를 본다. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = [];
pg.on('pageerror', e => errs.push(e.message));
pg.on('console', m => { if (m.type()==='error' && !/favicon/.test(m.location()?.url||'')) errs.push('console: '+m.text()); });
await pg.goto('http://localhost:8299/deeprun-live.html', { waitUntil: 'networkidle' });
await pg.waitForTimeout(700);

/* 1. 순서 벤치 — 실시간에서도 같은 질문 */
const bench = await pg.evaluate(() => window.__bench(60));
console.log(`\n순서 벤치 — 같은 5모듈 ${bench.n}순열 · 60박자 · 고정된 무리 3체 (박자당 피해)`);
console.log(`  최고  ${String(bench.best[1]).padStart(6)}  ${bench.best[0]}`);
console.log(`  최저  ${String(bench.worst[1]).padStart(6)}  ${bench.worst[0]}`);
console.log(`  격차  ×${(bench.best[1]/Math.max(.1,bench.worst[1])).toFixed(1)}`);
for (const [k,v] of bench.top) console.log(`    ${String(v).padStart(6)}  ${k}`);

/* 2. 실제로 굴러가는가 — 40초를 흘려보내며 조종한다 */
await pg.waitForTimeout(400);
await pg.screenshot({ path: 'live-start.png' });
const live = await pg.evaluate(async () => {
  const log = { peakParts:0, peakFoes:0, damageSeen:0, drafts:0, hpMin:1e9, moved:0 };
  const p0 = window.__peek();
  let lastKills = p0.kills, lastX = p0.x, lastY = p0.y;
  const dirs = [[1,0],[0,1],[-1,0],[0,-1],[.7,.7],[-.7,.7]];
  for (let i=0;i<200;i++){
    const g = window.__peek();
    if (g.over) break;
    if (g.draftOpen){ document.querySelector('#cards .card')?.click(); log.drafts++; }
    const d = dirs[Math.floor(i/14) % dirs.length];
    window.__drive(d[0], d[1]);
    await new Promise(r=>setTimeout(r,200));
    const h = window.__peek();
    log.peakParts = Math.max(log.peakParts, h.parts);
    log.peakFoes  = Math.max(log.peakFoes, h.foes);
    log.hpMin     = Math.min(log.hpMin, h.hp);
    if (Math.hypot(h.x-lastX, h.y-lastY) > 1) log.moved++;
    lastX = h.x; lastY = h.y;
  }
  const g = window.__peek();
  return { ...log, kills:g.kills, depth:g.depth, hp:g.hp, over:g.over, chain:g.chain };
});
console.log(`\n실시간 40초 — 이동 프레임 ${live.moved}/200 · 정지시킨 것 ${live.kills} · 구역 ${live.depth}`);
console.log(`  동시 적 최대 ${live.peakFoes} · 파티클 최대 ${live.peakParts} · 노심 최저 ${Math.round(live.hpMin)} · 뽑기 ${live.drafts} · 체인 ${live.chain}칸 · 종료 ${live.over}`);
await pg.screenshot({ path: 'live-mid.png' });

/* 3. 진짜 손가락 드래그로도 움직이는가 — __drive는 뒷문이라 그것만 믿을 수 없다 */
await pg.evaluate(() => window.__drive(0,0));
const before = await pg.evaluate(() => window.__peek());
const box = await pg.locator('#cv').boundingBox();
await pg.mouse.move(box.x + box.width/2, box.y + box.height/2);
await pg.mouse.down();
await pg.mouse.move(box.x + box.width/2 + 60, box.y + box.height/2, { steps: 6 });
await pg.waitForTimeout(900);
await pg.mouse.up();
const after = await pg.evaluate(() => window.__peek());
const dragged = Math.hypot(after.x-before.x, after.y-before.y);
console.log(`  손가락 드래그: ${dragged.toFixed(1)}px 이동`);

/* 4. 프레임이 실제로 돌아가는가 */
const fps = await pg.evaluate(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now()-t0 < 1500) requestAnimationFrame(tick);
    else res(Math.round(n/((performance.now()-t0)/1000))); };
  requestAnimationFrame(tick);
}));
console.log(`  프레임 ${fps}/초`);

let bad = 0;
if (bench.spread < 2) { console.log('\n  ✗ 순서를 바꿔도 결과가 같다 — 체인은 장식이다'); bad++; }
if (live.moved < 100)  { console.log('  ✗ 조종이 안 먹는다'); bad++; }
if (dragged < 12)      { console.log('  ✗ 손가락으로는 안 움직인다'); bad++; }
if (live.kills < 3)    { console.log('  ✗ 40초 동안 거의 못 잡았다'); bad++; }
if (live.peakParts < 5){ console.log('  ✗ 이펙트가 안 난다'); bad++; }
if (fps < 30)          { console.log(`  ✗ 프레임이 ${fps}밖에 안 나온다`); bad++; }
if (errs.length){ console.log('  ✗ 콘솔 오류:'); errs.slice(0,5).forEach(e=>console.log('     '+e)); bad++; }
else console.log('  · 콘솔 오류 없음');
console.log(bad ? `\n실시간 벤치: ${bad}건 실패\n` : '\n실시간 벤치: 전부 통과\n');
await b.close();
process.exit(bad ? 1 : 0);
