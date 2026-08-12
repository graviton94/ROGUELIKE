/* fight.mjs — 실제 전투 한 프레임을 잡는다.
   몬스터를 옆에 세우고 한 대 치고, 이펙트가 살아 있는 순간에 찍는다. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(() => { let s=20260812>>>0;
  Math.random = () => ((s = (s*1664525+1013904223)>>>0)/4294967296); });
/* 안내 카드를 미리 「이미 배운 것」으로 표시해 둔다. 안 그러면
   찍히는 것은 지도가 아니라 안내문이다 (두 번 그랬다). */
await pg.addInitScript(() => {
  const t = {}; for (let i = 0; i < 60; i++) t['t'+i] = 1;
  try { localStorage.setItem('deepdelve', JSON.stringify({ runs: 3, taught: {} })); } catch {}
});
await pg.goto('http://localhost:8199/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1100);
await pg.evaluate(() => { const el=[...document.querySelectorAll('button')]
  .find(e=>e.offsetParent && /새 게임/.test(e.textContent)); el&&el.click(); });
await pg.waitForTimeout(500);
for (let i=0;i<4;i++){
  await pg.evaluate(() => { const b=[...document.querySelectorAll('button:not([disabled])')]
    .filter(e=>e.offsetParent); b.length && b[b.length-1].click(); });
  await pg.waitForTimeout(400);
}
const info = await pg.evaluate(async () => {
  const G = await import('/src/game.js'); const W = await import('/src/world.js');
  G.enterDepth(5);
  const g = G.G, p = g.player;
  p.hp = p.maxhp; p.lv = 5;
  /* 몬스터는 게임이 만든 것을 옮겨 세운다. 내가 손으로 지어 넣었더니
     피해가 NaN으로 떴는데, 그건 게임이 아니라 내 가짜 몬스터 탓이었다. */
  const keep = g.monsters.slice(0, 4);
  g.monsters.length = 0;
  const spots = [[1,0],[-1,0],[0,1],[1,1]];
  keep.forEach((m, i) => {
    const [dx,dy] = spots[i] || [1,0];
    const x = p.x+dx, y = p.y+dy;
    if (!W.walkable(g.level, x, y)) return;
    m.x = x; m.y = y; m.awake = true; m.energy = 0;
    g.monsters.push(m);
  });
  return { monsters: g.monsters.length, depth:g.depth, names:g.monsters.map(m=>m.n), hp:g.monsters.map(m=>m.hp) };
});
console.log(JSON.stringify(info));
const shut = async () => { for (let i=0;i<10;i++){
  const hit = await pg.evaluate(() => { for (const id of ['lesson-ok','ask-ok','look-ok']) {
    const el=document.getElementById(id); if (el&&el.offsetParent) { el.click(); return true; } } return false; });
  if (!hit) break; await pg.waitForTimeout(220); } };
await shut();
await pg.waitForTimeout(900);
await pg.screenshot({ path:'fight-idle.png' });
/* 한 대 친다 */
await pg.evaluate(async () => { const G = await import('/src/game.js');
  const g=G.G, p=g.player, m=g.monsters[0];
  if (m) G.step(Math.sign(m.x-p.x), Math.sign(m.y-p.y)); });
await pg.waitForTimeout(90);
await pg.screenshot({ path:'fight-hit.png' });
await shut();
await pg.waitForTimeout(500);
await pg.evaluate(async () => { const G = await import('/src/game.js');
  const g=G.G, p=g.player, m=g.monsters[0];
  if (m) G.step(Math.sign(m.x-p.x), Math.sign(m.y-p.y)); });
await pg.waitForTimeout(90);
await pg.screenshot({ path:'fight-hit2.png' });
console.log(errs.length? 'ERR '+errs[0] : 'no errors');
await b.close();
