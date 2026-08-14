/* offer.mjs — 발밑의 것을 여는 버튼이 읽히는가.

   「상인 대화 버튼 등등 지금 글씨 잘림, 그리고 그 버튼은 눈에 확
    띄는 다른 버튼들이랑 다른 색상으로 해줘야」

   두 가지를 잰다. 잘림은 좌표로만 알 수 있다 — 화면에서는 「무기
   행상과…」가 그냥 짧은 이름처럼 보인다. 눈에 띄는지는 색으로만
   알 수 있다 — 나머지 버튼과 같은 색이면 「지금 여기서 뭘 할 수
   있는지」가 안 보인다.

   여는 자리 다섯을 전부 세워 놓고, 가장 좁은 폰에서 잰다.

   usage: node sim/offer.mjs                        */
import { chromium } from 'playwright';

const SIZES = [{ w: 320, h: 568, n: '작은 폰' }, { w: 390, h: 844, n: '요즘 폰' }];
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
  await pg.addInitScript(() => { let z = 20260814 >>> 0;
    Math.random = () => ((z = (z * 1664525 + 1013904223) >>> 0) / 4294967296); });
  await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => { const e = [...document.querySelectorAll('button')]
    .find(x => x.getBoundingClientRect().width > 2 && /새 게임/.test(x.textContent)); e && e.click(); });
  await pg.waitForTimeout(400);
  for (let i = 0; i < 4; i++) {
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
      .filter(x => x.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
    await pg.waitForTimeout(320);
  }
  for (let i = 0; i < 10; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
        const e = document.getElementById(id);
        if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; }
      } return false;
    });
    if (!hit) break;
    await pg.waitForTimeout(230);
  }

  console.log(`\n══ ${s.n} ${s.w}×${s.h}`);

  /* 발밑에 세울 수 있는 것 전부. 이름이 가장 긴 수레도 넣는다 —
     잘림은 가장 긴 이름에서만 나온다. */
  const CASES = [
    ['모닥불',  'camp'], ['제단', 'altar'], ['수상한 자리', 'event'],
    ['모루',    'anvil'], ['가장 긴 수레 이름', 'shop'],
  ];
  for (const [name, kind] of CASES) {
    const out = await pg.evaluate(async (k) => {
      const Game = await import('/src/game.js');
      const W = await import('/src/world.js');
      const D = await import('/src/data.js');
      const UI = await import('/src/ui.js');
      const G = Game.G, L = G.level, p = G.player;
      const i = W.idx(p.x, p.y);
      /* 발밑을 갈아 끼운다. 수레는 타일이 아니라 자리로 표시되므로
         shopAt에 넣는다 — 규칙이 읽는 곳과 같은 곳이다. */
      L.shopAt.delete(i);
      L.tiles[i] = W.FLOOR;
      if (k === 'shop') {
        const longest = D.SHOPS.slice().sort((a, c) => c.n.length - a.n.length)[0];
        L.shopAt.set(i, longest.id);
      } else {
        L.tiles[i] = { camp: W.CAMP, altar: W.ALTAR, event: W.EVENT, anvil: W.ANVIL }[k];
        if (k === 'event') L.eventId = L.eventId || 'seep';
      }
      UI.refresh();
      const btn = document.getElementById('btn-here');
      const cs = getComputedStyle(btn);
      const others = [...document.querySelectorAll('#acts .pair button')]
        .map(e => getComputedStyle(e).backgroundColor);
      return {
        hidden: btn.hidden,
        text: btn.textContent,
        clipped: btn.scrollWidth > btn.clientWidth + 1,
        scroll: btn.scrollWidth, client: btn.clientWidth,
        bg: cs.backgroundColor,
        sameAsOthers: others.includes(cs.backgroundColor),
        wide: btn.getBoundingClientRect().width,
        rowWide: document.getElementById('acts').getBoundingClientRect().width,
      };
    }, kind);

    if (out.hidden) { ok(false, `${name} — 버튼이 안 떴다`); continue; }
    ok(!out.clipped, `${name} — 「${out.text}」가 안 잘린다`,
       out.clipped ? `글 ${out.scroll}px > 칸 ${out.client}px` : `${out.client}px 안에 들어간다`);
    ok(!out.sameAsOthers, `${name} — 나머지 버튼과 다른 색이다`, out.bg);
    ok(out.wide > out.rowWide * 0.9, `${name} — 제 줄을 다 쓴다`,
       `${Math.round(out.wide)}/${Math.round(out.rowWide)}px`);
  }
  if (errs.length) { ok(false, '콘솔 오류', errs[0]); }
  await pg.screenshot({ path: `/tmp/offer-${s.w}.png` });
  await pg.close();
}

await b.close();
console.log(bad ? `\n발밑 벤치: ${bad}건 실패\n` : '\n발밑 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
