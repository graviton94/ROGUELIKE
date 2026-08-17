/* ═══════════════════════════════════════════════════════════
   pledge.mjs — 신은 정직하게 말하고, 거절은 잠겨 있다

   DESIGN.md §1·§4.

   이 파일이 지키는 것 넷:

   ① **수치는 정직하다.** 선물도 계율도 서약 **전에** 다 말한다.
      한때 say(말한 것)/real(실제)을 갈라 감춰진 대가를 심었다가
      되돌렸다 — 성능을 속이면 값을 못 재고, 값을 못 재는 선택지는
      선택지가 아니다. 신이 속이는 것은 서사이지 숫자가 아니다.
   ② **넷째 칸은 언제나 있다.** 심연 8단 아래에서는 잠겨 있되 보인다.
      숨기면 아무도 못 찾고, 못 찾는 진 엔딩은 없는 진 엔딩이다.
   ③ **거절은 아무것도 안 준다.** 신앙심도 안 오른다. 그것이 이 게임의
      유일한 난이도 선택이다.
   ④ **한 층에 한 번만 묻는다.** 받았든 거절했든 답하면 그 층은 끝난다.

   usage: node sim/pledge.mjs      (포트 8199에 정적 서버 필요)
   ═══════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { GODS, REFUSE, MAX_SHACKLE, ARCANA_AT } from '../src/data.js';

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };

console.log('\n서약 벤치 — 신은 정직하게 말하고, 거절은 잠겨 있다\n');

/* ── ① 신은 수치를 안 속인다 ─────────────────────────────
   처음에 say(말한 것)와 real(실제)을 갈라 감춰진 대가를 심었다가
   되돌렸다. 성능을 속이면 플레이어가 값을 못 재고, 값을 못 재는
   선택지는 선택지가 아니다 — §0 의 「고장 나 보이면 안 된다」와도
   정면으로 부딪힌다.

   신이 속이는 것은 **서사**다: 강해져서 내려가는 것 자체가 다음
   용사가 만날 악마를 빚는 과정이라는 것. 그건 값이 아니라 **결과**에
   있고, 다음 판에서 드러난다. */
ok(GODS.length === 5, '신이 다섯이다', `${GODS.length}명`);
ok(GODS.every(g => !g.say && !g.real),
   '① 말한 것/실제가 갈려 있지 않다 — 수치는 정직하다');
ok(GODS.every(g => g.boon && !g.boon.includes('**')),
   '   선물 설명에 감춰진 구절이 없다');
ok(GODS.every(g => g.call && g.call.length <= 24),
   '부름이 짧다 — 신은 명령형으로 말하고 이유를 안 댄다 (§2)',
   `가장 긴 것 ${Math.max(...GODS.map(g => g.call.length))}자`);
ok(GODS.every(g => g.vow), '다섯 다 계율을 갖고 있다 — 신은 버튼이 아니라 금지다');

/* ── 한 번에 셋을 보여 주는가 ────────────────────────────── */
const Game = await import('../src/game.js');
Game.startGame('human', 'warrior', Game.rollStats('warrior'));
const offer = Game.godOffer();
ok(offer.length === 3, '한 번에 셋을 보여 준다', `${offer.length}장`);

console.log('');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://127.0.0.1:8199/index.html');
await pg.waitForTimeout(900);
await pg.evaluate(() => { const e = [...document.querySelectorAll('button')]
  .find(x => x.getBoundingClientRect().width > 2 && /새 게임/.test(x.textContent)); e && e.click(); });
await pg.waitForTimeout(400);
for (let i = 0; i < 4; i++) {
  await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
    .filter(x => x.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
  await pg.waitForTimeout(300);
}

const read = () => pg.evaluate(async () => {
  window.UI.setScreen('arcana');
  await new Promise(r => setTimeout(r, 260));
  return [...document.querySelectorAll('#arcana-list .itemrow')].map(r => ({
    n: r.querySelector('.iname')?.textContent || '',
    text: [...r.querySelectorAll('.idesc')].map(x => x.textContent).join(' '),
    off: !!r.disabled,
  }));
});

const rows = await read();
ok(rows.length === 4, '칸이 넷이다 — 셋과 거절', `${rows.length}칸`);

/* 화면이 선물과 **계율을 둘 다** 미리 말하는가. 계율은 감출 것이
   아니다 — 그걸 감추면 그때부터 수치를 속이는 것이 된다. */
const shown = rows.map(r => r.text).join(' ');
ok(GODS.some(g => shown.includes(g.boon)), '선물이 그대로 뜬다');
ok(GODS.some(g => shown.includes(g.vow)),
   '계율도 **미리** 뜬다 — 서약 뒤에 알게 되면 그건 속인 것이다');

/* ── ② 넷째 칸 ────────────────────────────────────────── */
console.log('');
const last = rows[rows.length - 1];
ok(last.n === REFUSE.n, '② 넷째 칸이 거절이다', last.n);
ok(last.off === true, `   심연 ${MAX_SHACKLE}단 아래에서는 잠겨 있다`, last.off ? '잠김' : '열림');
ok(last.text.includes(REFUSE.locked),
   '   그리고 왜 잠겼는지 말한다 — 숨긴 것과 잠근 것은 다른 물건이다');

/* 8단에서는 열리는가. 심연은 오르는 것이지 고르는 것이 아니므로
   메타를 직접 밀어 넣어 확인한다 — 이건 벤치의 특권이다. */
const opened = await pg.evaluate(async n => {
  const Meta = await import('/src/meta.js');
  const G = (await import('/src/game.js')).G;
  Meta.clearedAt(n); Meta.setAbyss(n);
  G.abyss = n;
  window.UI.setScreen('play'); window.UI.setScreen('arcana');
  await new Promise(r => setTimeout(r, 260));
  const rs = [...document.querySelectorAll('#arcana-list .itemrow')];
  const l = rs[rs.length - 1];
  return { off: !!l.disabled, text: [...l.querySelectorAll('.idesc')].map(x => x.textContent).join(' ') };
}, MAX_SHACKLE);
ok(opened.off === false, `   심연 ${MAX_SHACKLE}단에서 열린다`, opened.off ? '아직 잠김' : '열림');
ok(opened.text.includes(REFUSE.say), '   열리면 말이 바뀐다', opened.text.slice(0, 30));

/* ── ③ 거절이 아무것도 안 주는가 ────────────────────────── */
console.log('');
const after = await pg.evaluate(async () => {
  const Game = await import('/src/game.js');
  const G = Game.G;
  const before = { gifts: (G.gifts || []).length, piety: G.piety || 0, god: G.god };
  Game.refuse();
  return { before, gifts: (G.gifts || []).length, piety: G.piety || 0,
           god: G.god, refused: G.refused || 0 };
});
ok(after.refused === 1, '③ 거절이 세어진다', `${after.refused}회`);
ok(after.gifts === after.before.gifts && after.god === after.before.god,
   '   그리고 아무것도 안 준다 — 신도, 선물도');
ok(after.piety === after.before.piety, '   신앙심도 안 오른다', `${after.piety}`);

/* ── ④ 한 층에 한 번만 묻는가 ───────────────────────────── */
console.log('');
const due = await pg.evaluate(async at => {
  const Game = await import('/src/game.js');
  const G = Game.G;
  G.gifts = []; G.refused = 0;
  const first = Game.pledgeDue(at[0]);
  Game.pledge('blood');
  const again = Game.pledgeDue(at[0]);
  const next = Game.pledgeDue(at[1]);
  const between = Game.pledgeDue(at[0] + 1);
  return { first, again, next, between };
}, ARCANA_AT);
ok(due.first === true, `④ ${ARCANA_AT[0]}층에서 묻는다`);
ok(due.again === false, '   답하면 그 층은 끝난다 — 두 번 안 묻는다');
ok(due.between === false, `   사이 층(${ARCANA_AT[0] + 1}층)에서는 안 묻는다`);
ok(due.next === true, `   그리고 ${ARCANA_AT[1]}층에서 다시 묻는다`);

/* ── ⑤ 진짜 손가락으로 눌리는가 ──────────────────────────
   합성 click 은 레이아웃과 무관하게 요소에 직접 꽂힌다. 그래서 화면이
   0×0 이어도 통과한다 — 실제로 「탭이 안 먹는다」를 다섯 번 오진했다.
   원인은 전부 탐침이었다: 안내 모달이 열려 있었고, 배낭이 **탭**이라
   setScreen('inv') 만으로는 그 칸이 안 열린다(invTab='worn' 이 기본).

   그러니 마지막 한 줄은 **진짜 좌표에 진짜 손가락**이어야 한다. */
console.log('');
for (let i = 0; i < 14; i++) {
  const hit = await pg.evaluate(() => {
    for (const id of ['lesson-ok', 'ask-ok', 'look-ok', 'look-close']) {
      const e = document.getElementById(id);
      if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; } }
    const c = document.getElementById('lorecard');
    if (c && !c.hidden) { c.hidden = true; return true; }
    return false; });
  if (!hit) break;
  await pg.waitForTimeout(100);
}
await pg.evaluate(async () => {
  const G = (await import('/src/game.js')).G;
  G.god = 'blood'; G.depth = 5; G.vowBroke = -1; G.piety = 90;
  window.UI.setScreen('play');
});
await pg.waitForTimeout(200);
const tap = await pg.evaluate(() => {
  const e = document.getElementById('btn-inv'); const r = e.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await pg.touchscreen.tap(tap.x, tap.y);
await pg.waitForTimeout(420);
const row = await pg.evaluate(() => {
  const r = [...document.querySelectorAll('#pack-list .itemrow')]
    .find(x => /치유의 물약/.test(x.textContent));
  if (!r) return null;
  const b = r.getBoundingClientRect();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const h = document.elementFromPoint(cx, cy);
  return { w: Math.round(b.width), x: cx, y: cy, inRow: !!h && (h === r || r.contains(h)) };
});
ok(!!row && row.w > 40 && row.inRow,
   '⑤ 배낭 버튼을 손가락으로 누르면 줄이 실제로 거기 있다',
   row ? `너비 ${row.w} · 좌표가 줄 안: ${row.inRow}` : '줄 없음');
if (row?.inRow) {
  await pg.touchscreen.tap(row.x, row.y);
  await pg.waitForTimeout(380);
  const a = await pg.evaluate(() => ({ open: !document.getElementById('ask').hidden,
    t: document.getElementById('ask-text').textContent }));
  ok(a.open, '   그리고 진짜 손가락 탭이 계율 경고를 띄운다 — 합성 click 이 아니라',
     a.open ? a.t : '안 떴다');
}

console.log('');
ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
await b.close();

console.log(bad ? `\n서약 벤치: ${bad}건 실패\n` : '\n서약 벤치: 값은 정직하고, 속는 것은 결과다\n');
process.exit(bad ? 1 : 0);
