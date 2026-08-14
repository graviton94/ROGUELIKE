/* fitall.mjs — 놀이 화면 말고 나머지 화면들도 틀 안에 있는가.

   fit.mjs가 지도 화면을 재고 나서 남은 질문: 배낭·상점·제단·모루·
   사건·계단·유물 화면은? 이쪽이 오히려 위험하다. 목록이고, 목록은
   내용이 길어지면 자란다. 그리고 이름이 가장 긴 물건은 대개
   가장 깊은 층에서 나온다.

   각 화면을 실제로 열고, 자식 사각형이 부모를 벗어나는지 잰다.
   잘리도록 만든 상자(overflow:hidden/auto)는 넘침이 아니다.

   usage: node sim/fitall.mjs                     */
import { chromium } from 'playwright';

const SIZES = [{ w: 320, h: 568, n: '작은 폰' }, { w: 390, h: 844, n: '요즘 폰' }];
const SCREENS = [
  ['sc-inv',   '배낭'],
  ['sc-shop',  '상점'],
  ['sc-altar', '제단'],
  ['sc-anvil', '모루'],
  ['sc-camp',  '모닥불'],
  ['sc-event', '사건'],
  ['sc-stairs','계단'],
  ['sc-relic', '유물'],
  ['sc-spell', '주문서'],
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let bad = 0;

for (const s of SIZES) {
  const pg = await b.newPage({ viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { let z = 7654321 >>> 0;
    Math.random = () => ((z = (z * 1664525 + 1013904223) >>> 0) / 4294967296); });
  await pg.goto('http://localhost:8199/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => { const el = [...document.querySelectorAll('button')]
    .find(e => e.getBoundingClientRect().width > 2 && /새 게임/.test(e.textContent)); el && el.click(); });
  await pg.waitForTimeout(400);
  for (let i = 0; i < 4; i++) {
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
      .filter(e => e.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
    await pg.waitForTimeout(320);
  }

  /* 가장 붐비는 손. 배낭이 가득 차고, 이름이 길고, 유물이 다섯이고,
     돈이 일곱 자리인 상태 — 목록은 그때 넘친다. */
  await pg.evaluate(async () => {
    const G = await import('/src/game.js');
    const D = await import('/src/data.js');
    G.enterDepth(12);
    const g = G.G, p = g.player;
    p.gold = 9999999; p.lv = 30;
    p.mats = { scrap: 999, dust: 999, essence: 999 };
    p.relics = D.RELICS.slice(0, 5).map(r => r.id);
    p.pack.length = 0;
    /* 가장 긴 이름들을 골라 담는다 — 접두·접미가 붙은 고유 무기가
       이 게임에서 가장 긴 문자열이다. */
    const longest = [...D.WEAPONS, ...D.ARMOURS].sort((a, b) => b.n.length - a.n.length).slice(0, 6);
    for (const w of longest) {
      const it = { ...w, kind: w.slot === 'body' ? 'armour' : 'weapon',
                   pre: D.PREFIXES[0]?.id, suf: D.SUFFIXES[0]?.id, plus: 9 };
      p.pack.push({ item: it, qty: 1 });
    }
    for (const c of D.CONSUMABLES.slice(0, 6)) p.pack.push({ item: { ...c, kind: 'use' }, qty: 9 });
    G.recalc(p);
  });
  await pg.keyboard.press('.');
  await pg.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().width > 2) { el.click(); return true; }
      } return false;
    });
    if (!hit) break;
    await pg.waitForTimeout(220);
  }

  console.log(`\n══ ${s.n} ${s.w}×${s.h}`);
  for (const [id, name] of SCREENS) {
    const opened = await pg.evaluate(async (sid) => {
      const U = await import('/src/ui.js');
      const G = await import('/src/game.js');
      const key = sid.replace('sc-', '');
      /* 화면마다 여는 문이 다르다. 제단·모루·사건은 바닥의 자리가
         있어야 열리므로, 세우고 나서 화면만 바꾼다. */
      /* 화면마다 필요한 맥락이 다르다. 세우지 않으면 열리지 않고,
         열리지 않은 화면을 「안에 있다」라고 적으면 그건 거짓말이다. */
      if (key === 'altar') G.G.altar = G.G.altar || { kind: 'blood' };
      if (key === 'event') G.G.level.eventId = G.G.level.eventId || 'seep';
      if (key === 'shop') {
        const D = await import('/src/data.js');
        G.G.shop = G.G.shop || D.SHOPS[0];
      }
      if (key === 'relic') {
        const D = await import('/src/data.js');
        G.G.relicOffer = G.G.relicOffer || D.RELICS[6].id;
        G.G.pendingRelic = G.G.pendingRelic || D.RELICS[6].id;
      }
      try { U.setScreen(key); } catch (e) { return 'ERR ' + e.message; }
      return document.getElementById(sid)?.hidden === false;
    }, id);
    await pg.waitForTimeout(420);
    /* 화면을 연 **뒤에** 안내 카드를 치운다. 열기 전에 치우면 화면과
       함께 다시 떠서, 찍히는 것은 화면이 아니라 안내문이 된다. */
    for (let i = 0; i < 6; i++) {
      const hit = await pg.evaluate(() => {
        for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().width > 2) { el.click(); return true; }
        } return false;
      });
      if (!hit) break;
      await pg.waitForTimeout(220);
    }
    if (opened !== true) { console.log(`  · ${name} — 못 열었다 (${opened})`); continue; }

    const out = await pg.evaluate((sid) => {
      const root = document.getElementById(sid);
      const spill = [], seen = new Set();
      const boxes = [root, ...root.querySelectorAll('div, section, ul')].slice(0, 40);
      for (const box of boxes) {
        const B = box.getBoundingClientRect();
        if (B.width < 8 || B.height < 8) continue;
        const cs = getComputedStyle(box);
        if (cs.overflowX !== 'visible' && cs.overflowY !== 'visible') continue;
        for (const el of box.children) {
          const R = el.getBoundingClientRect();
          if (!R.width || !R.height) continue;
          const over = Math.max(
            cs.overflowX === 'visible' ? R.right - B.right : -9,
            cs.overflowX === 'visible' ? B.left - R.left : -9,
            cs.overflowY === 'visible' ? R.bottom - B.bottom : -9,
            cs.overflowY === 'visible' ? B.top - R.top : -9);
          if (over <= 1) continue;
          const key = (box.id || box.className) + '>' + (el.id || el.className);
          if (seen.has(key)) continue;
          seen.add(key);
          spill.push({ box: box.id || box.className, who: el.id || el.className,
                       px: Math.round(over), text: (el.textContent || '').trim().slice(0, 20) });
        }
      }
      /* 넘침을 재는 김에 글도 읽는다. 「undefined이(가) 삐걱인다」류는
         규칙 파일의 로그가 아니라 화면에 그려진 글에도 난다 — 그쪽은
         헤드리스 벤치가 영영 못 본다. 화면을 이미 가장 붐비는 상태로
         열어 두었으니, 여기가 그 글을 읽을 수 있는 유일한 자리다. */
      const holes = [];
      for (const el of root.querySelectorAll('*')) {
        if (el.children.length) continue;            // 잎만 — 부모는 자식 글을 겹쳐 센다
        const t = (el.textContent || '').trim();
        if (t && /undefined|NaN|\[object |\bnull\b/.test(t)) holes.push(t.slice(0, 40));
      }
      return { spill, holes,
        sx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sy: document.documentElement.scrollHeight - document.documentElement.clientHeight };
    }, id);

    const notes = [];
    for (const h of [...new Set(out.holes)].slice(0, 3)) notes.push(`글에 구멍 — 「${h}」`);
    if (out.sx > 1) notes.push(`가로로 ${out.sx}px 넘침`);
    if (out.sy > 1) notes.push(`세로로 ${out.sy}px 넘침`);
    for (const v of out.spill.slice(0, 4)) notes.push(`${v.box} 안의 ${v.who}가 ${v.px}px — 「${v.text}」`);
    if (!notes.length) console.log(`  · ${name} — 안에 있다`);
    else { for (const n of notes) { console.log(`  ✗ ${name} — ${n}`); bad++; } }
    await pg.screenshot({ path: `/tmp/fitall-${s.w}-${id}.png` });
  }
  if (errs.length) { console.log(`  ✗ 콘솔 오류: ${errs[0]}`); bad++; }
  await pg.close();
}

console.log(bad ? `\n화면 벤치: ${bad}건 넘침\n` : '\n화면 벤치: 전부 안에 있다\n');
await b.close();
process.exit(bad ? 1 : 0);
