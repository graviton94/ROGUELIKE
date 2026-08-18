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
      const cv = document.getElementById('map');
      /* 몫만으로는 「몇 칸이 보이는가」를 모른다 — 타일 크기는 화면
         **폭**에서 나오므로(ui.js 의 scale), 같은 몫이라도 기기마다
         줄 수가 다르다. 그리는 쪽과 같은 식으로 센다. */
      const t = 8 * Math.max(2, Math.min(12, Math.round(cv.width / (8 * 17))));
      return { rows, slots: Game.spellSlots().length, view: Math.floor(cv.height / t),
               share: st ? st.getBoundingClientRect().height / window.innerHeight : 0 };
    }, cls);

    const cells = out.rows.flatMap(r => r.cells);
    const narrow = cells.filter(c => c.w < MIN_W);
    const clipped = cells.filter(c => c.clipped);
    const widest = out.rows.map(r => `${r.id.replace('-row','')} ${r.n}칸`).join(' · ');
    const minW = cells.length ? Math.min(...cells.map(c => c.w)) : 0;
    const share = Math.round(out.share * 100);
    console.log(`  ${cls.padEnd(8)} ${String(out.slots).padStart(2)}칸 → ${widest.padEnd(24)} 가장 좁은 칸 ${minW}px · 지도 ${share}% · ${out.view}줄`);
    /* 0.36을 두 기기에 똑같이 걸고 있었다. 조작 화면의 높이는 화면
       크기와 거의 무관하게 고정이므로(sim/fit.mjs 에 실측을 적었다)
       그 문턱은 배치가 아니라 화면 크기를 잰다. 사람이 겪는 것은
       **몇 줄이 보이는가**다 — 다섯 줄이면 붙기 전에 못 본다. */
    if (out.view < 9) { console.log(`      ${out.view}줄밖에 안 보인다 (지도 ${share}%)`); bad++; }
    if (clipped.length) console.log(`      잘린 글자: ${clipped.map(c => `「${c.text}」`).join(' ')}`);
    if (clipped.length) bad++;
    if (narrow.length) bad++;
    if (narrow.length) console.log(`      ${narrow.length}칸이 ${MIN_W}px 미만`);
  }
  /* ── 지도 위에 뜬 방향판 ────────────────────────────────
     격자에서 꺼내 지도 위에 얹은 뒤로, 이 덩어리는 배치가 지켜 주지
     않는다 — 밖으로 나가도, 미니맵을 덮어도, 칸이 작아져도 아무도
     안 운다. 옮긴 그 커밋에서 같이 건다.
     그리고 **눌러서 실제로 걷는가**까지 본다: 부모가 바뀌면 조용히
     안 먹는 것이 가장 흔한 결함이고, 그건 화면으로는 안 보인다. */
  {
    const box = await pg.evaluate(() => {
      const d = document.getElementById('dpad').getBoundingClientRect();
      const st = document.getElementById('stage').getBoundingClientRect();
      const mn = document.getElementById('mini').getBoundingClientRect();
      const bs = [...document.querySelectorAll('#dpad button')].map(b => b.getBoundingClientRect());
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return { inStage: d.left >= st.left - 1 && d.right <= st.right + 1
                     && d.top >= st.top - 1 && d.bottom <= st.bottom + 1,
               overMini: hit(d, mn),
               /* 피해 표는 z-index 12라 방향판 위에 그려진다. 겹치면
                  누르는 것은 멀쩡한데 화살표가 안 보인다 — 눌리는데
                  안 보이는 것이 가장 나쁜 겹침이다. */
               overTally: (() => { const t = document.getElementById('tally');
                 const was = t.hidden; t.hidden = false;
                 t.innerHTML = '<span class="tallyone"><b>-5</b></span>'
                   + '<span class="tallyone"><b>-12 x3</b></span>'
                   + '<span class="tallytotal">이번 턴 -17</span>';
                 const r = t.getBoundingClientRect(); t.hidden = was; t.innerHTML = '';
                 return hit(d, r); })(),
               min: Math.round(Math.min(...bs.map(b => Math.min(b.width, b.height)))),
               cover: Math.round(d.width * d.height / (st.width * st.height) * 100) };
    });
    ok(box.inStage, '방향판이 지도 안에 있다 — 밖으로 나가면 로그나 조작줄을 덮는다');
    ok(!box.overMini, '방향판이 미니맵을 안 덮는다 — 겹치는 것 둘이 겹치면 둘 다 못 쓴다');
    ok(!box.overTally, '피해 표가 방향판을 안 덮는다 — 눌리는데 안 보이는 것이 가장 나쁜 겹침이다');
    ok(box.min >= MIN_W, `방향판 칸이 ${MIN_W}px 이상이다`, `${box.min}px`);
    ok(box.cover <= 30, '방향판이 지도의 3할을 안 넘는다 — 그 이상이면 얻은 것보다 가린 것이 크다',
       `${box.cover}%`);
    /* 여덟 방향을 눌러 본다. 자리가 아니라 **턴이 흘렀는가**로 본다 —
       벽에 막히면 안 움직이지만 턴은 흐른다. */
    const walked = await pg.evaluate(async () => {
      const G = (await import('/src/game.js')).G;
      const was = G.turn;
      for (const d of ['0,-1', '1,0', '0,1', '-1,0', '1,1', '-1,-1', '1,-1', '-1,1']) {
        const b = document.querySelector(`#dpad button[data-dir="${d}"]`);
        const r = b.getBoundingClientRect();
        for (const t of ['pointerdown', 'pointerup', 'click'])
          b.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1,
            clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
        await new Promise(r2 => setTimeout(r2, 90));
      }
      return G.turn - was;
    });
    ok(walked >= 8, '여덟 방향이 다 걸음이 된다 — 부모가 바뀌면 조용히 안 먹는다',
       `${walked}턴`);
  }
  if (errs.length) { ok(false, '콘솔 오류', errs[0]); }
  await pg.close();
}

await b.close();
console.log(bad ? `\n칸 벤치: ${bad}건 실패\n` : '\n칸 벤치: 전부 읽을 수 있다\n');
process.exit(bad ? 1 : 0);
