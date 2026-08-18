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
    /* 계단도 이 자리가 맡는다. 예전에는 제 줄을 통째로 쓰는 두 개의
       버튼이었고, 둘 다 0.1%의 턴에만 살아 있었다.
       올라가는 쪽은 아예 없어졌다 — 아래 따로 잰다. */
    ['내려가는 계단', 'down'],
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
        L.tiles[i] = { camp: W.CAMP, altar: W.ALTAR, event: W.EVENT, anvil: W.ANVIL,
                       down: W.DOWN, up: W.UP }[k];
        /* ── 자리를 반쯤만 꾸며 놓고 있었다 ──────────────────
           타일만 EVENT 로 갈아 끼우고 `eventAt` 에는 안 넣었다.
           그런데 규칙이 보는 조건은 둘이다 —
           `t === EVENT && !L.eventAt.has(here)` 이면 아무것도 없는
           자리다(이미 가져간 자리라는 뜻). 즉 이 칸은 「발밑에 사건이
           있으면 버튼이 뜨는가」를 잰 것이 아니라 **플레이어가 하필
           진짜 사건 타일 위에 서 있었는가**를 재고 있었다.
           기준선에서는 마침 서 있었고, 무관한 커밋 하나가 난수 흐름을
           밀자 그 자리에서 실패로 찍혔다. 규칙이 읽는 곳을 그대로
           꾸민다. */
        if (k === 'event') { L.eventId = L.eventId || 'seep';
          (L.eventAt = L.eventAt || new Map()).set(i, 'seep'); }
      }
      UI.refresh();
      const btn = document.getElementById('btn-here');
      const cs = getComputedStyle(btn);
      const others = [...document.querySelectorAll('#acts .pair button')]
        .map(e => getComputedStyle(e).backgroundColor);
      return {
        hidden: btn.hidden || btn.disabled,
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
  /* 내려온 자리. 예전에는 「▲ 올라가기」가 떴다. 이제 이 게임은
     편도다 — 밟아도 아무 일도 없어야 하고, 버튼이 살아나서도
     안 된다. 「눌리지 않는 버튼」은 자리값을 못 하는 정도지만,
     「눌리는데 아무 일도 안 하는 버튼」은 고장이다. */
  {
    const out = await pg.evaluate(async () => {
      const Game = await import('/src/game.js');
      const W = await import('/src/world.js');
      const UI = await import('/src/ui.js');
      const G = Game.G, L = G.level, p = G.player;
      const i = W.idx(p.x, p.y);
      L.shopAt.delete(i);
      L.tiles[i] = W.UP;
      UI.refresh();
      const btn = document.getElementById('btn-here');
      const before = { d: G.depth };
      Game.ascend();
      return { dead: btn.disabled, text: btn.textContent,
               stair: Game.stairHere(), depth: G.depth, was: before.d,
               said: (G.log[G.log.length - 1] || {}).text || '' };
    });
    ok(out.stair === null, '올라가는 계단은 이제 발밑의 것이 아니다', `${out.stair}`);
    ok(out.dead, '버튼이 살아나지 않는다', `「${out.text}」`);
    ok(out.depth === out.was, '올라가려 해도 층이 안 바뀐다', `${out.was} → ${out.depth}`);
    ok(/올라가는 길은 없다/.test(out.said), '대신 왜 안 되는지를 말한다', `「${out.said}」`);
  }

  /* 그리고 비어 있을 때. 자리는 남되 금색은 아니어야 한다 — 빈 자리가
     빛나면 그 색은 「지금 뭔가 있다」는 뜻을 잃는다. 그리고 사라지면
     지도가 매 걸음 밀린다. */
  {
    const out = await pg.evaluate(async () => {
      const Game = await import('/src/game.js');
      const W = await import('/src/world.js');
      const UI = await import('/src/ui.js');
      const G = Game.G, L = G.level, p = G.player;
      const i = W.idx(p.x, p.y);
      L.shopAt.delete(i); L.tiles[i] = W.FLOOR;
      UI.refresh();
      const btn = document.getElementById('btn-here');
      const cs = getComputedStyle(btn);
      const others = [...document.querySelectorAll('#acts .pair button')]
        .map(e => getComputedStyle(e).backgroundColor);
      return { gone: btn.hidden || btn.getBoundingClientRect().height < 4,
               dead: btn.disabled, bg: cs.backgroundColor,
               plain: others.includes(cs.backgroundColor), text: btn.textContent,
               rows: document.getElementById('acts').children.length };
    });
    ok(!out.gone, '발밑이 비어도 자리는 남는다 — 줄이 사라지면 지도가 밀린다', `「${out.text}」`);
    ok(out.dead, '비었을 때는 눌리지 않는다');
    ok(out.plain, '비었을 때는 금색이 아니다', out.bg);
    ok(out.rows <= 5, '아래 줄이 다섯 줄을 넘지 않는다', `${out.rows}줄`);
  }
  if (errs.length) { ok(false, '콘솔 오류', errs[0]); }
  await pg.screenshot({ path: `/tmp/offer-${s.w}.png` });
  await pg.close();
}

await b.close();
console.log(bad ? `\n발밑 벤치: ${bad}건 실패\n` : '\n발밑 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
