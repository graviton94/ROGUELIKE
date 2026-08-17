/* ═══════════════════════════════════════════════════════════
   pledge.mjs — 신은 거짓말하고, 거절은 잠겨 있다

   DESIGN.md §1·§4.

   이 파일이 지키는 것 넷:

   ① **화면은 신이 말한 것만 안다.** 실제로 일어나는 것(real)이 화면에
      새 나가면 속는 게임이 아니다. 규칙 쪽(godOffer)이 real 을 안
      내보내고, 화면도 그것을 안 읽는다 — 둘 다 확인한다.
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

console.log('\n서약 벤치 — 신은 거짓말하고, 거절은 잠겨 있다\n');

/* ── ① 다섯 신이 말한 것과 실제가 다른가 ─────────────────── */
ok(GODS.length === 5, '신이 다섯이다', `${GODS.length}명`);
ok(GODS.every(g => g.say && g.real && g.say !== g.real),
   '다섯 다 말한 것과 실제가 다르다 — 같으면 속이는 게 아니다');
ok(GODS.every(g => g.real.includes('**')),
   '실제 쪽에 감춰진 대가가 굵게 적혀 있다 — 겪고 나서 읽을 줄');
ok(GODS.every(g => g.call && g.call.length <= 24),
   '부름이 짧다 — 신은 명령형으로 말하고 이유를 안 댄다 (§2)',
   `가장 긴 것 ${Math.max(...GODS.map(g => g.call.length))}자`);
ok(GODS.every(g => g.vow), '다섯 다 계율을 갖고 있다 — 신은 버튼이 아니라 금지다');

/* ── 규칙 쪽이 real 을 안 내보내는가 ─────────────────────── */
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

/* 화면에 real 의 문장이 한 조각도 없어야 한다. 굵게 감춘 부분을
   그대로 찾는다 — 있으면 첫 판에 이미 다 아는 것이다. */
const shown = rows.map(r => r.text).join(' ');
const leaked = GODS.filter(g => {
  const secret = (g.real.match(/\*\*(.+?)\*\*/) || [])[1];
  return secret && shown.includes(secret.replace(/\*\*/g, ''));
});
ok(leaked.length === 0,
   '① 화면에 감춰진 대가가 한 조각도 안 새 나간다',
   leaked.length ? leaked.map(g => g.n).join(' · ') : '전부 감춰짐');
ok(GODS.some(g => shown.includes(g.say)), '   그리고 말한 것은 그대로 뜬다');

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

console.log('');
ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
await b.close();

console.log(bad ? `\n서약 벤치: ${bad}건 실패\n` : '\n서약 벤치: 말한 것만 보이고, 거절은 잠겨 있다\n');
process.exit(bad ? 1 : 0);
