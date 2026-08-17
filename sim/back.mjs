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
/* 살아 있는 판을 슬롯에 한 번 박아 둔다. 아래에서 브라우저를 비운 뒤
   이걸 되돌려 놓고 「슬롯을 실제로 읽어 내는가」를 묻는다 — 진짜 저장
   데이터로 물어야 한다. slotDigest 가 죽는다면 거기서 죽는다. */
await pg.evaluate(async () => {
  const Save = await import('/src/save.js');
  Save.save(0);
  window.__slot = localStorage.getItem('deepdelve.slot.0');
});
ok(await pg.evaluate(() => !!window.__slot), '살아 있는 판이 슬롯에 실제로 저장된다');

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
/* 판이 시작되기 전에는 빈 파일을 주면 안 된다. 실제로 플레이어가
   `0층 · 0턴 · events []` 짜리 파일을 보냈다 — 아무 말 없이 빈 것을
   주는 것은 「내려받기가 고장났다」와 구분되지 않는다. */
console.log('');
await pg.evaluate(() => window.UI.setScreen('title'));
await pg.waitForTimeout(200);
await pg.evaluate(() => window.UI.setScreen('help'));
await pg.waitForTimeout(250);
{
  const st = await pg.evaluate(() => { const e = document.getElementById('btn-trace2');
    return { off: e.disabled, txt: e.textContent }; });
  /* 이 벤치는 판을 한 번 굴린 뒤이므로 기록이 있다 — 「없을 때
     막히는가」는 기록을 비워서 묻는다. 그런데 비울 것이 셋이다:
     이번 판의 층별 기록, 저장 슬롯, 누적 장부. 층별 기록만 지우면
     버튼은 여전히 열려 있어야 옳다 — 줄 것이 남아 있으니까. 「아무
     것도 없다」는 브라우저가 정말로 빈 상태에서만 참이다. */
  await pg.evaluate(async () => { const Game = await import('/src/game.js');
    const Meta = await import('/src/meta.js');
    Game.G.trace = [];
    Meta.forget();                                   // 장부를 게임의 문으로 비운다
    for (const k of Object.keys(localStorage)) if (/^deepdelve\.slot/.test(k)) localStorage.removeItem(k);
    window.UI.setScreen('play'); window.UI.setScreen('help'); });
  await pg.waitForTimeout(250);
  const empty = await pg.evaluate(() => { const e = document.getElementById('btn-trace2');
    return { off: e.disabled, txt: e.textContent }; });
  ok(empty.off, '기록이 없으면 버튼이 미리 잠긴다 — 눌러 보고 아는 것은 한 번 속은 것이다',
     `"${empty.txt}"`);
  const [dl] = await Promise.all([
    pg.waitForEvent('download', { timeout: 2500 }).catch(() => null),
    pg.evaluate(() => document.getElementById('btn-trace2').click()),
  ]);
  ok(!dl, '그리고 눌러도 빈 파일이 안 떨어진다', dl ? dl.suggestedFilename() : '안 떨어짐');
  void st;
}

/* ── 층별 기록이 없어도 브라우저에 남은 것은 준다 ────────────
   플레이어: 「이때까지 한 건 안 남는 거구나, 저 기능 있어야 이후에
   연결되는 거임? 내 로컬 캐시에 있는 걸 활용할 수 없나?」

   층별 기록은 v43 부터만 쌓인다 — 그건 사실이다. 그런데 누적 장부와
   저장 슬롯은 그 전부터 있었고, 그것만으로도 답할 수 있는 질문이
   있다. 그러니 「이번 판의 기록이 없다」와 「줄 것이 아무것도 없다」는
   다른 말이어야 한다. 이 줄들이 그 둘을 갈라 둔다. */
console.log('');
{
  await pg.evaluate(async () => {
    const Meta = await import('/src/meta.js');
    const Game = await import('/src/game.js');
    Meta.finish({ win: false, depth: 7, lv: 5, combo: 3, gold: 210, turn: 900,
                  cls: 'warrior', race: 'human', by: '벤치', kills: 40 });
    localStorage.setItem('deepdelve.slot.0', window.__slot);   // 아까 박아 둔 진짜 저장
    Game.G.trace = [];
    window.UI.setScreen('play'); window.UI.setScreen('help');
  });
  await pg.waitForTimeout(250);
  const st = await pg.evaluate(() => { const e = document.getElementById('btn-trace2');
    return { off: e.disabled, txt: e.textContent }; });
  ok(!st.off, '층별 기록이 없어도 장부가 있으면 버튼이 열린다', `"${st.txt}"`);
  ok(/남은 기록/.test(st.txt),
     '그리고 무엇을 주는지 버튼이 미리 말한다 — 「판 기록」이라 써 놓고 장부만 주면 고장으로 읽힌다',
     `"${st.txt}"`);
  const [dl] = await Promise.all([
    pg.waitForEvent('download', { timeout: 6000 }).catch(() => null),
    pg.evaluate(() => document.getElementById('btn-trace2').click()),
  ]);
  ok(!!dl, '그 상태에서도 파일이 떨어진다', dl ? dl.suggestedFilename() : '안 떨어짐');
  if (dl) {
    const { readFileSync } = await import('node:fs');
    const txt = readFileSync(await dl.path(), 'utf8');
    const d = JSON.parse(txt.slice(txt.indexOf('{')));
    ok(d.meta?.runs > 0, '파일이 누적 장부를 싣고 있다', `판 ${d.meta?.runs}회`);
    const s = (d.slots || [])[0];
    /* 깊이 0은 갱구다 — 이 벤치는 아직 안 내려갔다. 「0이면 못 읽은
       것」으로 재면 게임이 아니라 자가 틀린 것이다(이번 세션에 이미
       다섯 번 그랬다). 읽혔는지는 이름과 장비로 묻는다. */
    ok(!!s && !!s.cls && !!s.race && s.gear?.length > 0 && Number.isFinite(s.turn),
       '파일이 저장 슬롯을 실제로 읽어 낸다 — 그 순간의 층·장비·유물까지',
       s ? `${s.race}/${s.cls} ${s.depth || '갱구'} · 장비 ${s.gear.length} · 유물 ${s.relics.length}` : '없음');
    ok(!!s && !/[A-Za-z0-9+/]{200,}/.test(JSON.stringify(s)),
       '지도 격자는 안 싣는다 — 밸런스를 보는 데 안 쓰이고 파일만 부풀린다');
    ok(/이 브라우저에 남은 것/.test(txt) && /이번 판부터 쌓인다/.test(txt),
       '머리말이 「층별 기록은 이번 판부터」라고 먼저 말한다 — 안 그러면 빈 파일로 읽힌다');
  }
}

console.log('');
await pg.evaluate(async () => { const Game = await import('/src/game.js');
  Game.trace('floor.in', { heat: 0 }); });   // 기록을 다시 채운다
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
