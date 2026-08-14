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
  ok(lines.every(l => /^[▓▒░]+ \d+\/15층$/.test(l[1])),
     '둘째 줄은 사다리다 — 붙인 것만 보고도 얼마나 갔는지 안다', lines[1][1]);
  ok(lines[0][1].startsWith('░'), '0층은 한 칸도 안 채워진다', lines[0][1]);
  ok(lines[2][1].startsWith('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓'), '완주는 꽉 찬다', lines[2][1]);
  ok(lines.every(l => l[4].includes('graviton94.github.io')),
     '어디서 온 것인지가 붙어 있다 — 이게 없으면 자랑이 광고가 안 된다');
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

  const seen = await pg.evaluate(() => {
    const b2 = document.getElementById('btn-share');
    return { there: !!b2 && b2.getBoundingClientRect().width > 2, label: b2?.textContent };
  });
  ok(seen.there, '끝 화면에 기록 버튼이 있다', seen.label);

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
  ok(/깊은 곳 —/.test(got.clip), '누르면 진짜로 클립보드에 들어간다',
     got.clip.split('\n')[0] || got.clip);
  ok(got.label === '복사됐다', '버튼이 됐다고 말한다', got.label);
  ok(/오우거/.test(got.clip), '실제로 죽인 것이 적혀 있다');
}

ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
console.log(bad ? `\n기록 벤치: ${bad}건 실패\n` : '\n기록 벤치: 전부 통과\n');
await b.close();
process.exit(bad ? 1 : 0);
