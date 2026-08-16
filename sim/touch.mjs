/* touch.mjs — 열리자마자 눌리는 사고를 막았는가.

   「> 로 ? 인카운터 하자마자 그 위치에 있는 선택지를 눌러버림.
    꾹 누르면서 이동할 때 이 현상이 매우 심하고」

   창이 손가락 바로 밑에서 열리기 때문이다. 두 겹으로 막았으니
   두 겹을 따로 잰다:

     · 열리고 350ms 안에 찍은 것은 안 먹는다
     · 350ms가 지나도, 그 버튼 밖에서 시작한 누름은 안 먹는다
     · 그러나 제대로 누른 것은 당연히 먹는다 (안 막으면 게임이 멈춘다)

   usage: node sim/touch.mjs                        */
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:8199/index.html';
let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await browser.newPage({ viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
pg.on('pageerror', e => errors.push(e.message));
await pg.addInitScript(() => { let z = 20260814 >>> 0;
  Math.random = () => ((z = (z * 1664525 + 1013904223) >>> 0) / 4294967296); });
await pg.goto(URL, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1000);

/* 제목 화면부터 판까지. Game.startGame을 밖에서 부르면 페이지가
   갈아엎히므로, 사람이 누르는 순서 그대로 누른다. */
await pg.evaluate(() => { const el = [...document.querySelectorAll('button')]
  .find(e => e.offsetParent && /새 게임/.test(e.textContent)); el && el.click(); });
await pg.waitForTimeout(400);
for (let i = 0; i < 4; i++) {
  await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
    .filter(e => e.offsetParent); bs.length && bs[bs.length - 1].click(); });
  await pg.waitForTimeout(320);
}
/* 안내 양피지가 떠 있으면 그것부터 치운다 — 카드가 덮고 있는 동안은
   아무것도 다시 그려지지 않아, 재는 것이 화면이 아니라 카드가 된다.
   이 실수를 이 세션에서만 두 번 했다. */
for (let i = 0; i < 10; i++) {
  const hit = await pg.evaluate(() => {
    for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
      const el = document.getElementById(id);
      if (el && el.offsetParent) { el.click(); return true; }
    } return false;
  });
  if (!hit) break;
  await pg.waitForTimeout(250);
}
/* 사건 화면에 실제 선택지가 있어야 재는 것이 의미가 있다. 층을
   내려가 ? 자리를 하나 만들고, 그 자리를 밟은 것으로 친다. */
await pg.evaluate(async () => {
  const Game = await import('/src/game.js');
  Game.enterDepth(5);
  /* ── 이 자가 아무것도 안 재고 있었다 ────────────────────
     층만 내려가고 「그 자리를 밟은 것으로 친다」고 적어 놓았는데,
     실제로 밟지 않았다. 그래서 사건 화면에 버튼이 하나도 없었고,
     `#sc-event button:not([hidden])` 이 null 이라 UI.armed() 가
     찍히기도 전에 갈래가 끝났다 — 「손가락 밑에서 열리는 창」 방어를
     **아무도 안 재고 있었다.** 실제로 ? 칸 위에 세운다.
     (그리고 4층이 아니라 5층이다 — 4층은 아르카나를 고르는 층이라
      화면이 그쪽으로 잡힌다.) */
  const G = Game.G, L = G.level, W = await import('/src/world.js');
  const at = [...(L.eventAt?.keys() || [])][0];
  if (at !== undefined) { G.player.x = at % W.MW; G.player.y = (at / W.MW) | 0; }
  Game.refreshFov();
});
await pg.waitForTimeout(300);

console.log('\n손끝 벤치 — 열리자마자 눌리는가\n');

/* ── 1. 열리고 곧바로 찍으면 안 먹는다 ─────────────────── */
{
  const res = await pg.evaluate(async () => {
    const { UI, G } = window;
    UI.setScreen('event');                       // 지금 이 순간 열렸다
    const btn = document.querySelector('#sc-event button:not([hidden])');
    if (!btn) return { skip: true };
    const before = G.screen;
    const r = btn.getBoundingClientRect();
    const at = { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2,
                 bubbles: true, cancelable: true, pointerId: 1, isPrimary: true };
    btn.dispatchEvent(new PointerEvent('pointerdown', at));
    btn.dispatchEvent(new PointerEvent('pointerup', at));
    btn.dispatchEvent(new MouseEvent('click', { ...at, detail: 1 }));
    return { armed: UI.armed(), screen: G.screen, before };
  });
  ok(!res.skip && res.armed === false, '창이 열린 직후에는 아직 잠겨 있다',
     `armed=${res.armed}`);
  ok(res.screen === 'event', '그 순간 찍은 것은 화면을 바꾸지 못한다',
     `${res.before} → ${res.screen}`);
}

/* ── 2. 잠금이 풀려도, 밖에서 시작한 누름은 안 먹는다 ──── */
{
  await pg.waitForTimeout(450);                  // ARM_MS를 넘긴다
  const res = await pg.evaluate(() => {
    const { UI, G } = window;
    const btn = document.querySelector('#sc-event button:not([hidden])');
    const r = btn.getBoundingClientRect();
    const at = { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2,
                 bubbles: true, cancelable: true, pointerId: 2, isPrimary: true };
    /* 손가락은 d-pad에서 내려갔다 — 창 밖이다. 그러고 나서 창 위에서
       떼었다. 꾹 누르며 걷다가 창이 열린 상황이 정확히 이것이다. */
    document.body.dispatchEvent(new PointerEvent('pointerdown',
      { ...at, clientX: 10, clientY: 800 }));
    btn.dispatchEvent(new PointerEvent('pointerup', at));
    btn.dispatchEvent(new MouseEvent('click', { ...at, detail: 1 }));
    return { armed: UI.armed(), screen: G.screen };
  });
  ok(res.armed === true, '350ms가 지나 잠금은 풀렸다');
  ok(res.screen === 'event', '그래도 버튼 밖에서 시작한 누름은 먹지 않는다',
     `화면 ${res.screen}`);
}

/* ── 3. 제대로 누른 것은 먹는다 ────────────────────────── */
{
  const res = await pg.evaluate(() => {
    const { G } = window;
    const btn = document.querySelector('#sc-event button:not([hidden])');
    const label = btn.textContent.trim().slice(0, 20);
    const r = btn.getBoundingClientRect();
    const at = { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2,
                 bubbles: true, cancelable: true, pointerId: 3, isPrimary: true };
    btn.dispatchEvent(new PointerEvent('pointerdown', at));
    btn.dispatchEvent(new PointerEvent('pointerup', at));
    btn.dispatchEvent(new MouseEvent('click', { ...at, detail: 1 }));
    return { screen: G.screen, label };
  });
  ok(res.screen !== 'event', '버튼 위에서 시작해 버튼 위에서 뗀 누름은 먹는다',
     `「${res.label}」 → 화면 ${res.screen}`);
}

/* ── 4. 같은 화면을 다시 그리는 것은 다시 잠그지 않는다 ── */
{
  const res = await pg.evaluate(async () => {
    const { UI } = window;
    UI.setScreen('camp');
    await new Promise(r => setTimeout(r, 400));
    UI.setScreen('camp');                        // d-pad가 매 걸음 이렇게 한다
    return UI.armed();
  });
  ok(res === true, '불 앞에서 걸어도 버튼이 다시 잠기지는 않는다', `armed=${res}`);
}

ok(errors.length === 0, '콘솔 오류 없음', errors[0] || '');
console.log(bad ? `\n손끝 벤치: ${bad}건 실패\n` : '\n손끝 벤치: 전부 통과\n');
await browser.close();
process.exit(bad ? 1 : 0);
