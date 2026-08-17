/* ═══════════════════════════════════════════════════════════
   back.mjs — 닫기가 제자리로 돌아오는가

   플레이어: 「조작법 → 닫기 하면 이상한 화면으로 넘어감.」

   맞았다. `[data-back]` 이 전부 `setScreen('play')` 였는데 조작법은
   **첫 화면에서도** 열린다. 그래서 첫 화면 → 조작법 → 닫기 를 하면
   시작한 적도 없는 판으로 떨어졌다 — 지도도 영웅도 없는 화면이다.
   도감만 예외 한 줄로 막아 두고 있었고, 그 한 줄이 있었다는 것이
   같은 병이 이미 한 번 났었다는 뜻이다.

   그래서 화면마다 예외를 붙이는 대신 「어디서 열었는지」를 기억한다.
   이 파일은 그 계약을 지킨다: **같은 창이 어디서 열리든 닫으면
   열기 전 자리로 돌아온다.**

   usage: node sim/back.mjs      (포트 8199에 정적 서버 필요)
   ═══════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
  isMobile: true, hasTouch: true, acceptDownloads: true });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://127.0.0.1:8199/index.html');
await pg.waitForTimeout(900);

const at = () => pg.evaluate(() => window.G?.screen);
const tap = id => pg.evaluate(i => { const e = document.getElementById(i); e && e.click(); }, id);
const back = sc => pg.evaluate(s => {
  const e = document.querySelector(`#sc-${s} [data-back]`); e && e.click(); }, sc);
const wait = () => pg.waitForTimeout(220);

/* 열고 닫고, 제자리인지 본다. 「열렸는가」도 같이 봐야 한다 — 안
   열렸는데 제자리이면 그것도 통과로 찍힌다. */
async function round(what, open, sc, expect) {
  const from = await at();
  await open(); await wait();
  const opened = await at();
  await back(sc); await wait();
  const now = await at();
  ok(opened === sc && now === expect,
     `${what} — 닫으면 ${expect} 로 돌아온다`,
     `${from} → ${opened} → ${now}`);
}

console.log('\n닫기 벤치 — 제자리로 돌아오는가\n');

/* ── 판 밖에서 ────────────────────────────────────────── */
await round('첫 화면 → 조작법', () => tap('btn-help'), 'help', 'title');
await round('첫 화면 → 기록',   () => tap('btn-codex'), 'codex', 'title');

/* ── 판 안에서 ────────────────────────────────────────── */
await pg.evaluate(() => { const e = [...document.querySelectorAll('button')]
  .find(x => x.getBoundingClientRect().width > 2 && /새 게임/.test(x.textContent)); e && e.click(); });
await pg.waitForTimeout(400);
for (let i = 0; i < 4; i++) {
  await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
    .filter(x => x.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
  await pg.waitForTimeout(300);
}
for (let i = 0; i < 14; i++) {
  const hit = await pg.evaluate(() => {
    for (const id of ['lesson-ok', 'ask-ok', 'look-ok', 'look-close']) {
      const e = document.getElementById(id);
      if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; } }
    const c = document.getElementById('lorecard');
    if (c && !c.hidden) { c.hidden = true; return true; }
    return false; });
  if (!hit) break;
  await pg.waitForTimeout(120);
}
console.log('');
ok(await at() === 'play', '판이 실제로 시작됐다 — 아래 줄들이 잴 것이 있다');
await round('판 → 조작법', () => tap('btn-help'), 'help', 'play');
await round('판 → 배낭',   () => pg.evaluate(() => window.UI.setScreen('inv')), 'inv', 'play');

/* 그리고 가장 아픈 자리: 배낭 안에서 연 조작법. 여기서 판으로
   돌아가면 배낭을 다시 열어야 한다 — 「닫기」가 두 칸을 닫는다. */
await pg.evaluate(() => window.UI.setScreen('inv'));
await wait();
await round('배낭 → 조작법', () => tap('btn-help2'), 'help', 'inv');

/* ── 판이 끝난 뒤 ─────────────────────────────────────── */
console.log('');
await pg.evaluate(async () => {
  const Game = await import('/src/game.js');
  Game.G.player.hp = 1; Game.hurtPlayer(9999, { by: '벤치' });
});
await pg.waitForTimeout(2000);
ok(await at() === 'end', '죽으면 끝 화면이다', await at());
await round('끝 화면 → 기록', () => tap('btn-endcodex'), 'codex', 'end');

/* 판이 끝난 뒤에는 「판으로 돌아가기」가 있으면 안 된다 — 돌아갈
   판이 없다. 덮개가 아닌 화면의 닫기도 그것을 알아야 한다. */
await pg.evaluate(() => window.UI.setScreen('inv'));
await wait();
await back('inv'); await wait();
ok(await at() !== 'play', '끝난 뒤의 닫기는 판으로 안 간다 — 돌아갈 판이 없다', await at());

/* ── 판 기록이 실제로 떨어지는가 ──────────────────────────
   이 문이 있어야 「봇으로 재현하지 말고 내 판을 봐라」가 성립한다.
   그리고 파일 **이름**까지 봐야 한다: 처음에 `…-15층-….json` 으로
   지었더니 브라우저가 download 속성을 통째로 무시하고 확장자도 없는
   `download` 를 떨궜다 — 받은 쪽은 그게 무슨 파일인지 모른다. */
console.log('');
for (const [what, screen, id] of [['조작법', 'help', 'btn-trace2'],
                                  ['끝 화면', 'end', 'btn-trace']]) {
  await pg.evaluate(s2 => window.UI.setScreen(s2), screen);
  await pg.waitForTimeout(300);
  const box = await pg.evaluate(i => { const e = document.getElementById(i);
    const r = e?.getBoundingClientRect(); return e ? { w: Math.round(r.width), h: Math.round(r.height) } : null; }, id);
  ok(box && box.h >= 44, `${what} 의 판 기록 버튼이 손가락 크기다`,
     box ? `${box.w}×${box.h}` : '없음');
  const [dl] = await Promise.all([
    pg.waitForEvent('download', { timeout: 6000 }).catch(() => null),
    pg.evaluate(i => document.getElementById(i)?.click(), id),
  ]);
  ok(!!dl, `${what} 에서 파일이 실제로 떨어진다`, dl ? dl.suggestedFilename() : '안 떨어짐');
  ok(!!dl && /^deepdelve-[\w-]+\.json$/.test(dl.suggestedFilename()),
     `${what} — 이름이 아스키다 (한글이 섞이면 브라우저가 이름을 통째로 버린다)`,
     dl ? dl.suggestedFilename() : '');
}

console.log('');
ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
await b.close();
console.log(bad ? `\n닫기 벤치: ${bad}건 실패\n` : '\n닫기 벤치: 전부 제자리로 돌아온다\n');
process.exit(bad ? 1 : 0);
