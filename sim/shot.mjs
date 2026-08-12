/* shot.mjs — 실제 게임 화면을 실제 UI로 들어가서 찍는다.
   내부 함수를 부르면 화면 전환을 건너뛰고, 안내문을 안 치우면
   측정한 것이 지도가 아니라 안내문이 된다 (둘 다 한 번씩 겪었다). */
import { chromium } from 'playwright';
const out = process.argv[2] || 'game-deep.png';
const depth = Number(process.argv[3] || 4);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
/* 같은 던전을 봐야 팔레트를 비교할 수 있다. 방이 매번 달라지면
   비교하는 것은 색이 아니라 방이다 — 한 번 그렇게 속을 뻔했다. */
await pg.addInitScript(() => {
  let s = 20260812 >>> 0;
  Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
});
await pg.goto('http://localhost:8199/index.html', { waitUntil:'domcontentloaded' });
await pg.waitForTimeout(1200);

const clickText = async (re) => pg.evaluate((src) => {
  const rx = new RegExp(src);
  const el = [...document.querySelectorAll('button, .btn, [role=button], a, div, span')]
    .filter(e => e.offsetParent && rx.test((e.textContent || '').trim())
                 && (e.textContent || '').trim().length < 12)
    .sort((a, b) => a.textContent.length - b.textContent.length)[0];
  if (el) { el.click(); return true; } return false;
}, re.source);

await clickText(/새 게임/);
await pg.waitForTimeout(500);
for (let i = 0; i < 4; i++) {                 // 종족·직업 선택을 넘긴다
  const done = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('button:not([disabled])')].filter(e => e.offsetParent);
    if (!b.length) return true;
    b[b.length - 1].click(); return false;
  });
  await pg.waitForTimeout(400);
  if (done) break;
}
await pg.evaluate(async d => { const G = await import('/src/game.js'); G.enterDepth(d); }, depth);
await pg.waitForTimeout(700);
/* 안내 카드는 button이 아니라 #lesson-ok다. 텍스트로 더듬지 말고
   그 id를 직접 누른다 — 두 번 헛짚었다. */
for (let i = 0; i < 8; i++) {
  const hit = await pg.evaluate(() => {
    for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
      const el = document.getElementById(id);
      if (el && el.offsetParent) { el.click(); return true; }
    }
    const c = document.getElementById('cards') || document.body;
    return false;
  });
  if (!hit) break;
  await pg.waitForTimeout(280);
}
await pg.waitForTimeout(1500);

const st = await pg.evaluate(async () => { const G = await import('/src/game.js');
  return { screen:G.G.screen, depth:G.G.depth, monsters:G.G.monsters.length }; });
await pg.screenshot({ path: out });
console.log(JSON.stringify(st), errs.length ? 'ERR ' + errs[0] : 'no errors');
await b.close();
