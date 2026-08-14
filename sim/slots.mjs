/* slots.mjs — 아래 줄의 칸이 사람이 읽을 수 있는 크기인가.

   「스킬슬롯 ui 너무 말도 안 되게 촘촘함」 — 팔라딘 스크린샷에서
   한 줄에 아홉 칸이 들어가 「돌진 Lv4 Lv8 Lv1 치듀 Lv3 Lv5 Lv9 Lv1」이
   되어 있었다. 「치유」가 「치듀」로 잘린 것이다.

   fit.mjs는 이걸 못 잡는다 — 넘치지는 않았으니까. 넘치지 않는 것과
   읽을 수 있는 것은 다르다. 그래서 여기서는 **칸 하나의 폭**과
   **글자가 잘렸는가**를 직업마다 잰다. 여섯 직업 중 하나만 아홉 칸이
   되므로, 하나만 재면 영영 못 본다.

   usage: node sim/slots.mjs                        */
import { chromium } from 'playwright';

const SIZES = [{ w: 320, h: 568, n: '작은 폰' }, { w: 390, h: 844, n: '요즘 폰' }];
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];
const MIN_W = 44;      // 손가락 하나. 이보다 좁으면 옆 칸이 눌린다.

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const s of SIZES) {
  const pg = await b.newPage({ viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => { const e = [...document.querySelectorAll('button')]
    .find(x => x.getBoundingClientRect().width > 2 && /새 게임/.test(x.textContent)); e && e.click(); });
  await pg.waitForTimeout(400);
  for (let i = 0; i < 4; i++) {
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
      .filter(x => x.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
    await pg.waitForTimeout(300);
  }
  for (let i = 0; i < 10; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
        const e = document.getElementById(id);
        if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; }
      } return false;
    });
    if (!hit) break;
    await pg.waitForTimeout(200);
  }

  console.log(`\n══ ${s.n} ${s.w}×${s.h}`);
  for (const cls of CLASSES) {
    /* 직업을 갈아 끼우고 레벨을 올린다 — 잠긴 칸은 「Lv8」이라 좁아도
       읽히지만, 이름이 붙은 칸이 좁으면 그때 잘린다. 최고 레벨로
       올려서 전부 이름이 나오게 한다. */
    const out = await pg.evaluate(async (c) => {
      const Game = await import('/src/game.js');
      const UI = await import('/src/ui.js');
      const G = Game.G, p = G.player;
      p.cls = c;
      p.lv = 20;
      Game.recalc(p);
      UI.refresh();
      const rows = ['art-row', 'spell-row'].map(id => {
        const r = document.getElementById(id);
        if (!r || r.hidden) return null;
        const cells = [...r.children].map(e => {
          const lab = e.querySelector('.sn');
          return {
            w: Math.round(e.getBoundingClientRect().width),
            h: Math.round(e.getBoundingClientRect().height),
            text: (lab?.textContent || '').trim(),
            /* 잘림은 좌표로만 알 수 있다. 화면에서는 「치듀」가 그냥
               짧은 이름처럼 보인다. */
            clipped: !!lab && lab.scrollWidth > lab.clientWidth + 1,
          };
        });
        return { id, n: cells.length, cells };
      }).filter(Boolean);
      /* 줄이 늘면 지도가 줄어든다. 팔라딘은 두 줄을 쓰므로, 칸이
         읽히는 대신 지도가 사라지는 것은 아닌지 같이 본다. */
      const st = document.getElementById('stage');
      return { rows, slots: Game.spellSlots().length,
               share: st ? st.getBoundingClientRect().height / window.innerHeight : 0 };
    }, cls);

    const cells = out.rows.flatMap(r => r.cells);
    const narrow = cells.filter(c => c.w < MIN_W);
    const clipped = cells.filter(c => c.clipped);
    const widest = out.rows.map(r => `${r.id.replace('-row','')} ${r.n}칸`).join(' · ');
    const minW = cells.length ? Math.min(...cells.map(c => c.w)) : 0;
    const share = Math.round(out.share * 100);
    console.log(`  ${cls.padEnd(8)} ${String(out.slots).padStart(2)}칸 → ${widest.padEnd(24)} 가장 좁은 칸 ${minW}px · 지도 ${share}%`);
    if (out.share < 0.36) { console.log(`      지도가 ${share}%까지 줄었다`); bad++; }
    if (clipped.length) console.log(`      잘린 글자: ${clipped.map(c => `「${c.text}」`).join(' ')}`);
    if (clipped.length) bad++;
    if (narrow.length) bad++;
    if (narrow.length) console.log(`      ${narrow.length}칸이 ${MIN_W}px 미만`);
  }
  if (errs.length) { ok(false, '콘솔 오류', errs[0]); }
  await pg.close();
}

await b.close();
console.log(bad ? `\n칸 벤치: ${bad}건 실패\n` : '\n칸 벤치: 전부 읽을 수 있다\n');
process.exit(bad ? 1 : 0);
