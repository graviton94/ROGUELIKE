/* fit.mjs — 화면 안의 것들이 제 틀을 벗어나는가.

   눈으로 찾으면 놓친다. 기기 폭도 여러 가지고, 넘치는 것은 대개
   가장 긴 한글 문장이 붙었을 때만 넘친다. 그래서 좌표로 잰다:
   자식의 사각형이 부모의 사각형을 벗어나면 그 자리가 범인이다.

   usage: node sim/fit.mjs                        */
import { chromium } from 'playwright';

const SIZES = [
  { w: 320, h: 568, n: '작은 폰' },
  { w: 360, h: 640, n: '보통 폰' },
  { w: 390, h: 844, n: '요즘 폰' },
  { w: 430, h: 932, n: '큰 폰' },
];
/* 틀로 볼 상자들. 각각 성격이 다른 정보를 담는다. */
const FRAMES = ['#hud', '.hudtop', '.hudbot', '#controls', '#acts', '#stage', '#log'];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let bad = 0;

for (const s of SIZES) {
  const pg = await b.newPage({ viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { let z = 20260812 >>> 0;
    Math.random = () => ((z = (z * 1664525 + 1013904223) >>> 0) / 4294967296); });
  await pg.goto('http://localhost:8199/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => { const el = [...document.querySelectorAll('button')]
    .find(e => e.offsetParent && /새 게임/.test(e.textContent)); el && el.click(); });
  await pg.waitForTimeout(400);
  for (let i = 0; i < 4; i++) {
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
      .filter(e => e.offsetParent); bs.length && bs[bs.length - 1].click(); });
    await pg.waitForTimeout(320);
  }
  /* 안내 카드를 **먼저** 치운다. 카드가 떠 있는 동안은 HUD가 다시
     그려지지 않아서, 아래에서 넣은 「붐비는 상태」가 화면에 반영되지
     않는다 — 첫 판에서 「넘치는 것 없음」이 나온 이유가 그것이었다. */
  for (let i = 0; i < 10; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok','ask-ok','look-ok']) {
        const el = document.getElementById(id);
        if (el && el.offsetParent) { el.click(); return true; }
      } return false;
    });
    if (!hit) break;
    await pg.waitForTimeout(250);
  }

  /* 가장 붐비는 상태를 만든다 — 상태 칩이 여럿 붙고 이름이 긴 층에서
     넘친다. 한산할 때만 재면 넘치는 순간을 영영 못 본다. */
  await pg.evaluate(async () => {
    const G = await import('/src/game.js');
    G.enterDepth(9);
    const g = G.G, p = g.player;
    p.lightTurns = 0;                       // 암흑 칩
    g.uproar = 12;                          // 소란 칩
    /* 진짜 상태이상 id만 쓴다. bleed·weak는 없는 것이라 화면이
       터졌고, 하마터면 그것을 게임 버그로 볼 뻔했다. */
    p.ail = { poison: 9, fear: 9, slow: 9 };
    p.blessed = 5; p.might = 5; p.iron = 5;
    p.gold = 999999; p.lv = 24; p.xp = 9999;
    p.hp = 7; p.maxhp = 888;
    G.say?.('아주 긴 문장이 로그에 들어왔을 때 줄이 어떻게 되는지 보려고 적는 문장이다.');
  });
  /* 한 턴을 흘려 HUD를 다시 그리게 한다. 상태를 넣기만 하고 그리지
     않으면 재는 것은 화면이 아니라 내 머릿속이다. */
  await pg.keyboard.press('.');            // 화면을 거쳐 한 턴 — ui.js가 HUD를 다시 그린다
  await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const G = await import('/src/game.js');
    const p = G.G.player;
    window.__fitState = { screen:G.G.screen, depth:G.G.depth, hp:`${p.hp}/${p.maxhp}`,
                          gold:p.gold, lv:p.lv, uproar:G.G.uproar, oil:p.lightTurns,
                          chips: document.getElementById('hud-flags')?.textContent || '' };
  });
  for (let i = 0; i < 6; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok','ask-ok','look-ok']) {
        const el = document.getElementById(id);
        if (el && el.offsetParent) { el.click(); return true; }
      } return false;
    });
    if (!hit) break;
    await pg.waitForTimeout(220);
  }
  await pg.waitForTimeout(600);

  const out = await pg.evaluate((frames) => {
    const spill = [];
    const seen = new Set();
    for (const sel of frames) {
      const box = document.querySelector(sel);
      if (!box || !box.offsetParent) continue;
      const B = box.getBoundingClientRect();
      /* 잘리도록 만든 상자는 넘침이 아니다. #log는 overflow:hidden에
         justify-content:flex-end라 오래된 줄이 위로 밀려 나가지만
         그려지지는 않는다 — 그것까지 세면 탐침이 거짓말을 한다. */
      const cs = getComputedStyle(box);
      const clipsX = cs.overflowX !== 'visible';
      const clipsY = cs.overflowY !== 'visible';
      if (clipsX && clipsY) continue;
      for (const el of box.querySelectorAll('*')) {
        if (!el.offsetParent) continue;
        const R = el.getBoundingClientRect();
        if (!R.width || !R.height) continue;
        const over = { r: clipsX ? -9 : R.right - B.right, l: clipsX ? -9 : B.left - R.left,
                       b: clipsY ? -9 : R.bottom - B.bottom, t: clipsY ? -9 : B.top - R.top };
        const worst = Math.max(over.r, over.l, over.b, over.t);
        if (worst <= 1) {
          /* 넘치지 않아도 잘리거나 접히면 읽을 수 없다. 320px에서
             「기력」이 두 글자로 쪼개져도 상자 안이라 위 검사는 통과한다. */
          const clipped = el.scrollWidth - el.clientWidth;
          const lines = el.children.length === 0 && el.textContent.trim()
            ? el.getClientRects().length : 1;
          if (clipped > 1 && el.children.length === 0) {
            const key2 = sel + '~clip~' + (el.id || el.className || el.tagName);
            if (!seen.has(key2)) {
              seen.add(key2);
              spill.push({ frame: sel, who: el.id || el.className || el.tagName,
                           px: Math.round(clipped), side: '잘림',
                           text: (el.textContent || '').trim().slice(0, 22) });
            }
          } else if (lines > 1 && /glabel|gval|chip|xp|who/.test(el.className || '')) {
            const key3 = sel + '~wrap~' + (el.id || el.className || el.tagName);
            if (!seen.has(key3)) {
              seen.add(key3);
              spill.push({ frame: sel, who: el.id || el.className || el.tagName,
                           px: lines, side: '줄바꿈',
                           text: (el.textContent || '').trim().slice(0, 22) });
            }
          }
          continue;
        }
        const key = sel + '>' + (el.id || el.className || el.tagName);
        if (seen.has(key)) continue;
        seen.add(key);
        spill.push({ frame: sel, who: el.id || el.className || el.tagName,
                     px: Math.round(worst),
                     side: over.r === worst ? '오른쪽' : over.l === worst ? '왼쪽'
                         : over.b === worst ? '아래' : '위',
                     text: (el.textContent || '').trim().slice(0, 22) });
      }
    }
    /* 넘침을 재는 김에 글도 읽는다 — 놀이 화면 쪽. 「undefined」류는
       규칙의 로그뿐 아니라 HUD 칩과 버튼 이름에도 난다. */
    const holes = [];
    for (const el of document.querySelectorAll('#hud *, #controls *, #log *, #acts *')) {
      if (el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (t && /undefined|NaN|\[object |\bnull\b/.test(t)) holes.push(t.slice(0, 40));
    }
    const st = document.getElementById('stage');
    const cv = document.getElementById('map');
    const stage = st ? {
      share: st.getBoundingClientRect().height / window.innerHeight,
      cols: cv ? Math.round(cv.clientWidth / 24) : 0,
      rows: cv ? Math.round(cv.clientHeight / 24) : 0,
    } : null;
    return { spill, holes, stage, state: window.__fitState || null,
      pageScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageScrollY: document.documentElement.scrollHeight - document.documentElement.clientHeight };
  }, FRAMES);

  console.log(`\n${s.n} ${s.w}×${s.h}`);
  console.log(`  (잰 상태: ${JSON.stringify(out.state)})`);
  if (out.pageScrollX > 1) { console.log(`  ✗ 화면이 가로로 ${out.pageScrollX}px 넘친다`); bad++; }
  if (out.pageScrollY > 1) { console.log(`  ✗ 화면이 세로로 ${out.pageScrollY}px 넘친다`); bad++; }
  /* 넘침만 재고 「지도가 얼마나 남았는가」는 안 쟀다. 320px에서
     지도가 화면의 29%였는데도 이 벤치는 초록이었다 — 넘치지는
     않았으니까. 넘치지 않는 것과 놀 수 있는 것은 다르다. */
  if (out.stage) {
    const pct = Math.round(out.stage.share * 100);
    const okShare = out.stage.share >= 0.42;
    console.log(`  ${okShare ? '·' : '✗'} 지도가 화면의 ${pct}% · 보이는 칸 ${out.stage.cols}×${out.stage.rows}`);
    if (!okShare) bad++;
  }
  for (const h of [...new Set(out.holes || [])].slice(0, 3)) {
    console.log(`  ✗ 글에 구멍 — 「${h}」`); bad++;
  }
  if (!out.spill.length && out.pageScrollX <= 1 && out.pageScrollY <= 1)
    console.log('  · 넘치는 것 없음');
  for (const v of out.spill.slice(0, 8)) {
    console.log(v.side === '줄바꿈'
      ? `  ✗ ${v.frame} 안의 ${v.who}가 ${v.px}줄로 접혔다 — 「${v.text}」`
      : `  ✗ ${v.frame} 안의 ${v.who}가 ${v.side}${v.side === '잘림' ? '' : '으로'} ${v.px}px — 「${v.text}」`);
    bad++;
  }
  if (errs.length) { console.log(`  ✗ 콘솔 오류: ${errs[0]}`); bad++; }
  await pg.screenshot({ path: `/tmp/fit-${s.w}.png` });
  await pg.close();
}

console.log(bad ? `\n틀 벤치: ${bad}건 넘침\n` : '\n틀 벤치: 전부 안에 있다\n');
await b.close();
process.exit(bad ? 1 : 0);
