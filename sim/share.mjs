/* share.mjs — 죽은 판이 남기는 것이 실제로 옮겨지는가.

   로그라이크가 퍼지는 방식은 광고가 아니라 「내 판 이야기」다.
   그런데 그 이야기를 옮길 수단이 이 게임에는 하나도 없었다 —
   스크린샷 말고는.

   글 한 덩이가 그 일을 하려면 세 가지를 만족해야 한다:
     · 한눈에 자랑거리가 보인다 (몇 층까지 갔나)
     · 어디에 붙여도 깨지지 않는다 (다섯 줄, 표 없음, 이모지 없음)
     · 복사가 진짜로 된다 (「복사됐다」고 말해 놓고 안 들어가면 최악)

   usage: node sim/share.mjs                        */
import { chromium } from 'playwright';

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  permissions: ['clipboard-read', 'clipboard-write'] });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1000);

console.log('\n기록 벤치 — 죽은 판이 남기는 것\n');

/* ── 1. 카드의 모양 ──────────────────────────────────────
   여러 결말을 손으로 만들어 본다. 봇을 태워 죽이면 한 가지 결말만
   보게 되는데, 깨지는 것은 대개 극단(0층에서 죽음, 완주)에서 깨진다. */
{
  const cards = await pg.evaluate(async () => {
    const UI = await import('/src/ui.js');
    const cases = [
      ['0층에서 죽음', { depth:0, sent:1, turn:12, relics:[], combo:0, win:false }, '커다란 쥐'],
      ['7층에서 죽음', { depth:7, sent:23, turn:1204, relics:['pact','echo','bone','moth'],
                        combo:12, forged:5, win:false }, '오우거'],
      ['완주',        { depth:15, sent:41, turn:3300, relics:['pact'], combo:9, win:true }, null],
    ];
    return cases.map(([n, s, by]) => [n, UI.runCard(s, by)]);
  });
  for (const [n, card] of cards) {
    console.log(`\n      ── ${n}`);
    for (const line of card.split('\n')) console.log(`      ${line}`);
  }
  console.log('');
  const lines = cards.map(([, c]) => c.split('\n'));
  ok(lines.every(l => l.length === 5), '언제나 다섯 줄이다', lines.map(l => l.length).join(','));
  ok(lines.every(l => l.every(x => x.length <= 42)),
     '어느 줄도 42자를 넘지 않는다 — 좁은 채팅창에서 안 접힌다',
     `가장 긴 줄 ${Math.max(...lines.flat().map(x => x.length))}자`);
  /* 칸은 이모지여야 한다. 괘선 문자(▓░)는 CJK 폰트에서 폭이 애매해
     보내는 쪽과 받는 쪽 기기가 다르면 사다리가 어긋나고, 채팅 목록에서
     회색으로 묻힌다. */
  ok(lines.every(l => /^[\u{1F7E5}-\u{1F7EB}\u2B1B\u2B1C]+ \d+\/15층$/u.test(l[1])),
     '둘째 줄은 이모지 사다리다 — 기기가 달라도 같게 보인다', lines[1][1]);
  ok(!lines.some(l => l.some(x => /[▓▒░]/.test(x))), '괘선 문자를 안 쓴다');
  ok(lines[0][1].startsWith('⬛'), '0층은 한 칸도 안 채워진다', lines[0][1]);
  ok(!lines[2][1].includes('⬛'), '완주는 꽉 찬다', lines[2][1]);
  /* 주소에 scheme이 있어야 자동으로 링크가 된다. 링크가 아니면 미리보기
     카드(og.png)도 안 뜬다 — 가장 공들인 그림이 필요한 순간에 안 보인다. */
  ok(lines.every(l => l[4].startsWith('https://')),
     '주소가 https로 시작한다 — 그래야 채팅앱이 링크로 만든다', lines[0][4]);
  /* 첫 줄이 훅이다. 「23번째가 죽었다」가 이 게임에서 가장 좋은 문장인데
     넷째 줄에 묻혀 있었다. */
  ok(lines.every(l => /번째가/.test(l[0])), '첫 줄이 「몇 번째가」로 시작한다', lines[1][0]);
  ok(cards[1][1].includes('23번째') && cards[1][1].includes('오우거'),
     '몇 번째 사람이 무엇에게 죽었는지가 들어간다');
}

/* ── 2. 버튼이 실제로 복사하는가 ─────────────────────────── */
{
  /* 끝 화면을 세운다 — 실제로 죽여서. 화면만 띄우면 「버튼이 있다」를
     재는 것이지 「눌리면 복사된다」를 재는 것이 아니다. */
  await pg.evaluate(() => { const e = [...document.querySelectorAll('button')]
    .find(x => x.getBoundingClientRect().width > 2 && /새 게임/.test(x.textContent)); e && e.click(); });
  await pg.waitForTimeout(400);
  for (let i = 0; i < 4; i++) {
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
      .filter(x => x.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
    await pg.waitForTimeout(300);
  }
  await pg.evaluate(async () => {
    const Game = await import('/src/game.js');
    const UI = await import('/src/ui.js');
    Game.enterDepth(6);
    const p = Game.G.player;
    p.relics = ['pact', 'echo'];
    Game.G.bestCombo = 11;
    Game.G.ending = { win:false, by:'오우거', summary: Game.summarise(false, '오우거') };
    Game.G.running = false;
    UI.setScreen('end');
  });
  await pg.waitForTimeout(500);
  /* 수업 카드가 버튼을 덮는다. 갱구 카드를 새로 넣은 뒤로 여기서
     걸리기 시작했다 — 벤치가 「덮였다」를 잡은 것이지 고장이 아니다. */
  for (let i = 0; i < 10; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
        const e = document.getElementById(id);
        if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; }
      }
      return false;
    });
    if (!hit) break;
    await pg.waitForTimeout(200);
  }

  const seen = await pg.evaluate(() => {
    const b2 = document.getElementById('btn-share');
    return { there: !!b2 && b2.getBoundingClientRect().width > 2, label: b2?.textContent };
  });
  ok(seen.there, '끝 화면에 기록 버튼이 있다', seen.label);
  ok(seen.label === '자랑하기', '버튼이 사회적인 말을 한다 — 「기록 복사」는 파일 작업이다', seen.label);

  /* navigator.share가 있으면 공유 시트로 가 버려 클립보드를 못 잰다.
     헤드리스에는 없지만, 있는 기기를 흉내 내는 경우를 대비해 지운다. */
  await pg.evaluate(() => { delete navigator.share; });
  await pg.click('#btn-share');
  await pg.waitForTimeout(400);
  const got = await pg.evaluate(async () => {
    let clip = '';
    try { clip = await navigator.clipboard.readText(); } catch { clip = '(못 읽음)'; }
    return { clip, label: document.getElementById('btn-share').textContent };
  });
  ok(/번째가/.test(got.clip), '누르면 진짜로 클립보드에 들어간다',
     got.clip.split('\n')[0] || got.clip);
  ok(got.label === '복사됐다', '버튼이 됐다고 말한다', got.label);
  ok(/오우거/.test(got.clip), '실제로 죽인 것이 적혀 있다');
}

ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
console.log(bad ? `\n기록 벤치: ${bad}건 실패\n` : '\n기록 벤치: 전부 통과\n');
await b.close();
process.exit(bad ? 1 : 0);
