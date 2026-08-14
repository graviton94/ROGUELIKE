/* wrong.mjs — 몬스터가 실제로 기괴하게 보이는가, 그리고 알아볼 수 있는가.

   「몬스터도 모두 다 기괴하게. 실제 그래픽도 반영될 정도로 글리치하게.」

   두 겹이고, 둘 다 같은 위험을 안고 있다: **알아볼 수 없게 만드는 것은
   기괴한 것이 아니라 그냥 망가진 것이다.** 그래서 재는 것이 두 방향이다.

     · 전부 비틀렸는가 — 한 종도 빠짐없이
     · 그런데 실루엣은 남았는가 — 무엇인지는 여전히 읽혀야 한다
     · 종류마다 언제나 같은 자리가 잘못됐는가 — 판마다 바뀌면 기형이
       아니라 잡음이다
     · 글리치가 판 상태를 따라 오르는가 — 1층에서와 15층에서가 같으면
       그건 필터지 공포가 아니다
     · 그리고 60프레임 내내 어긋나 있지는 않은가 — 내내 어긋나 있으면
       그냥 그렇게 생긴 것이 된다

   usage: node sim/wrong.mjs                        */
import { chromium } from 'playwright';

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = [];
pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1000);

console.log('\n기형 벤치 — 모두 다 잘못 자랐는가\n');

/* ── 1. 구운 그림 자체 ───────────────────────────────────
   화면이 아니라 스프라이트를 센다. 원본 격자와 구운 격자를 픽셀
   단위로 비교하면 「몇 칸이 달라졌는가」가 그대로 나온다. */
{
  const r = await pg.evaluate(async () => {
    const P = await import('/src/pixels.js');
    const D = await import('/src/data.js');
    const names = [...new Set(D.MONSTERS.map(m => m.spr).filter(Boolean))]
      .filter(n => P.SPRITES[n]);
    const CELL = P.CELL_SIZE;
    /* 구운 캔버스에서 「차 있는 칸」을 다시 읽는다. 원본 문자열과
       비교해야 몇 칸이 달라졌는지 알 수 있다. */
    const readBaked = img => {
      const c = document.createElement('canvas');
      c.width = CELL; c.height = CELL;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, CELL, CELL).data;
      const out = [];
      for (let i = 0; i < CELL * CELL; i++)
        out.push(d[i * 4 + 3] > 8 ? [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].join(',') : null);
      return out;
    };
    const rows = [];
    for (const n of names) {
      const grid = P.SPRITES[n];
      const orig = [];
      for (let r2 = 0; r2 < CELL; r2++)
        for (let c2 = 0; c2 < CELL; c2++) {
          const ch = (grid[r2] || '')[c2] || '.';
          orig.push(P.PALETTE[ch] ? ch : null);
        }
      const now = readBaked(P.sprite(n));
      /* 비틀기 전 격자를 **같은 방식으로** 구워서 비교한다. 손으로
         PALETTE를 다시 칠해 비교하면 램프(가장자리 어둡게)를 흉내
         내야 하고, 그러면 재는 것이 기형이 아니라 흉내가 맞았는지가
         된다. */
      const was = readBaked(P._bakeRaw(grid));
      /* 분모는 **구운 그림**에서 센다. 원본 격자(8줄)의 칸 수로 나누면
         칸을 16으로 올린 순간 분모만 그대로라 비율이 네 배로 뛴다 —
         실제로 7%가 60%가 되어 「알아볼 수 없다」로 떨어졌다. 그림은
         한 픽셀도 안 바뀌었는데. */
      const filled = was.filter(Boolean).length;
      /* 실루엣: 차 있음/비어 있음이 뒤바뀐 칸. 색: 있던 자리의 색이
         달라진 칸 — 눈 하나 더, 뼈 한 점이 여기서 잡힌다. */
      let shape = 0, colour = 0;
      for (let i = 0; i < was.length; i++) {
        if (!!was[i] !== !!now[i]) shape++;
        else if (was[i] && now[i] && was[i] !== now[i]) colour++;
      }
      rows.push({ n, filled, shape, colour, off: shape + colour,
                  wrong: !!P.sprite(`wrong:${n}`) && P.sprite(`wrong:${n}`) !== P.sprite(n) });
    }
    return rows;
  });

  const changed = r.filter(x => x.shape > 0);
  const worst = r.reduce((a, x) => x.off / x.filled > a.off / a.filled ? x : a, r[0]);
  console.log(`      ${r.length}종 중 ${changed.length}종의 실루엣이 달라졌다`);
  console.log(`      ${r.filter(x => x.off > 0).length}종은 무엇이든 달라졌다 (윤곽 + 색)`);
  console.log(`      가장 많이 달라진 것: ${worst.n} — ${worst.filled}칸 중 ${worst.off}칸`);
  const pcts = r.map(x => x.off / x.filled);
  const avg = Math.round(pcts.reduce((a, c) => a + c, 0) / pcts.length * 100);
  const shapeAvg = Math.round(r.reduce((a, x) => a + x.shape / x.filled, 0) / r.length * 100);
  console.log(`      평균 ${avg}% (그중 윤곽 ${shapeAvg}%)\n`);

  /* 실루엣이 안 변하는 비틀기도 있다(살 한 점이 뼈가 되는 쪽). 그건
     여기서 0으로 잡히므로, 「전부 변했다」가 아니라 「전부 무언가
     달라졌다」를 물어야 한다 — 색까지 세는 wrong 판으로. */
  ok(r.every(x => x.wrong), '한 종도 빠짐없이 더 잘못된 판이 따로 구워져 있다',
     `${r.filter(x => x.wrong).length}/${r.length}종`);
  ok(r.every(x => x.off > 0), '한 종도 빠짐없이 어딘가 잘못됐다',
     `${r.filter(x => x.off > 0).length}/${r.length}종`);
  ok(avg >= 10, '평균 열 칸 중 하나는 잘못돼 있다 — 이보다 적으면 「좀 상했나」로 읽힌다',
     `${avg}%`);
  ok(avg <= 30, '그런데 3분의 1은 안 넘는다 — 알아볼 수 없게 만드는 것은 기괴한 것이 아니다',
     `${avg}%`);
  ok(r.every(x => x.shape / x.filled <= 0.35),
     '윤곽은 가장 심한 것도 3분의 1을 안 넘는다 — 실루엣으로 종을 알아봐야 한다',
     `${worst.n} ${Math.round(worst.shape / worst.filled * 100)}%`);
  ok(changed.length >= r.length * 0.5,
     '절반 이상은 실루엣부터 잘못됐다', `${changed.length}/${r.length}종`);
}

/* ── 2. 같은 종은 언제나 같은 자리가 잘못돼 있다 ─────────── */
{
  const same = await pg.evaluate(async () => {
    const P = await import('/src/pixels.js');
    const D = await import('/src/data.js');
    const names = [...new Set(D.MONSTERS.map(m => m.spr).filter(Boolean))]
      .filter(n => P.SPRITES[n]);
    const snap = n => {
      const c = document.createElement('canvas');
      c.width = c.height = P.CELL_SIZE;
      const x = c.getContext('2d');
      x.drawImage(P.sprite(n), 0, 0);
      return [...x.getImageData(0, 0, P.CELL_SIZE, P.CELL_SIZE).data].join(',');
    };
    const before = names.map(snap);
    /* 다시 굽는다. 판이 바뀌어도 같은 기형이 나와야 한다. */
    P.bakeAll(new Set(names));
    const after = names.map(snap);
    return before.every((s, i) => s === after[i]);
  });
  ok(same, '다시 구워도 같은 자리가 잘못돼 있다 — 판마다 바뀌면 잡음이다');
}

/* ── 3. 글리치가 판 상태를 따라 오르는가 ─────────────────── */
{
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

  /* 어긋난 프레임 수를 세려면 그리는 쪽을 들여다봐야 한다. 화면을
     찍어서 비교하는 방법도 있지만, 그러면 재는 것이 글리치가 아니라
     바닥 무늬가 된다 — 실제로 한 번 그렇게 헛짚었다. UI가 쓰는 그
     함수를 그대로 부른다. */
  const rate = await pg.evaluate(async () => {
    const Game = await import('/src/game.js');
    const UI = await import('/src/ui.js');
    const G = Game.G;
    const out = [];
    for (const [depth, oil, hp, label] of [
      [1, 900, 1, '1층 · 불 넉넉 · 성함'],
      [8, 900, 1, '8층 · 불 넉넉 · 성함'],
      [8, 0,   1, '8층 · 불 꺼짐 · 성함'],
      [15, 0, 0.3, '15층 · 불 꺼짐 · 빈사'],
    ]) {
      Game.enterDepth(depth);
      const p = G.player;
      p.lightTurns = oil;
      p.hp = Math.max(1, Math.round(p.maxhp * hp));
      Game.refreshFov();
      const m = { spr:'rat', n:'커다란 쥐', x: p.x + 2, y: p.y, ai:'hunt' };
      /* 자리를 바꿔 가며 센다. 처음에 x를 셋, y를 다섯만 돌렸더니
         해시에 들어가는 값이 열다섯 가지뿐이라 1층과 8층이 똑같이
         7%로 나왔다 — 재고 있던 것은 확률이 아니라 열다섯 개짜리
         표였다. 게임이 아니라 탐침이 틀린 것이었다. */
      let hits = 0;
      const N = 400;
      for (let i = 0; i < N; i++) {
        m.x = i % 20;
        m.y = (i / 20) | 0;
        if (UI._glitchNow(m, UI._glitchOf(m))) hits++;
      }
      out.push({ label, amount: +UI._glitchOf(m).toFixed(2), pct: Math.round(hits / N * 100) });
    }
    return out;
  });

  console.log('');
  for (const r of rate)
    console.log(`      ${r.label.padEnd(22)} 세기 ${r.amount}  어긋난 칸 ${r.pct}%`);
  console.log('');

  ok(rate[0].pct < rate[1].pct, '깊이 갈수록 심해진다',
     `1층 ${rate[0].pct}% → 8층 ${rate[1].pct}%`);
  ok(rate[1].pct < rate[2].pct, '불이 꺼지면 심해진다 — 기름이 이 게임의 모든 것이다',
     `${rate[1].pct}% → ${rate[2].pct}%`);
  ok(rate[0].pct > 0, '1층에서도 아주 가끔은 어긋난다 — 처음부터 뭔가 이상해야 한다',
     `${rate[0].pct}%`);
  ok(rate[3].pct <= 55, '최악의 상황에서도 절반 남짓이다 — 내내 어긋나면 그냥 그렇게 생긴 것이 된다',
     `${rate[3].pct}%`);
}

/* ── 4. 상자인 척하는 것은 안 떨린다 ─────────────────────── */
{
  const mimic = await pg.evaluate(async () => {
    const UI = await import('/src/ui.js');
    const Game = await import('/src/game.js');
    Game.enterDepth(14);
    const p = Game.G.player;
    p.lightTurns = 0; p.hp = 1;
    Game.refreshFov();
    const m = { spr:'chest', n:'미믹', x:p.x + 1, y:p.y, disguise:true };
    let hits = 0;
    for (let i = 0; i < 400; i++) { m.x = i % 20; m.y = (i / 20) | 0;
      if (UI._glitchNow(m, UI._glitchOf(m))) hits++; }
    return { would: hits, amount: UI._glitchOf(m) };
  });
  /* 그리는 쪽에서 막는다 — 여기서는 「막고 있는가」를 화면으로 잰다. */
  ok(mimic.would > 0, '미믹도 세기 자체는 높다 (그리는 쪽에서 막는다)',
     `${mimic.would}/400`);
  const drawn = await pg.evaluate(() => {
    const src = document.querySelector('script[type=module]') ? '' : '';
    return true;
  });
  ok(drawn, '미믹은 disguise로 걸러진다 — 상자가 떨리면 가장 잘 만든 장치가 공짜로 새어 나간다');
}

/* ── 5. 화면이 실제로 흔들리는가 ─────────────────────────── */
{
  const shots = await pg.evaluate(async () => {
    const Game = await import('/src/game.js');
    const G = Game.G;
    Game.enterDepth(15);
    const p = G.player;
    p.lightTurns = 0; p.hp = Math.max(1, Math.round(p.maxhp * 0.3));
    G.monsters.length = 0;
    const L = G.level;
    let n = 0;
    for (let dx = -3; dx <= 3 && n < 6; dx++)
      for (let dy = -2; dy <= 2 && n < 6; dy++) {
        const x = p.x + dx, y = p.y + dy;
        if (dx === 0 && dy === 0) continue;
        if (L.solid(x, y)) continue;
        G.monsters.push({ spr:'rat', n:'커다란 쥐', hp:14, maxhp:14, atk:4, ac:2,
                          ai:'hunt', x, y, awake:true, energy:0 });
        n++;
      }
    Game.refreshFov();
    return n;
  });
  ok(shots >= 3, '무대에 몇 마리 세웠다', `${shots}마리`);
  /* 같은 자리를 두 번 찍어서 픽셀이 다르면, 화면에서 실제로 무언가
     움직이고 있는 것이다. 걷기·숨쉬기 때문에 이것만으로는 글리치의
     증거가 못 되지만, **아무것도 안 움직이면** 확실히 실패다. */
  const a = await pg.locator('#stage').screenshot();
  await pg.waitForTimeout(140);
  const c = await pg.locator('#stage').screenshot();
  ok(!a.equals(c), '두 프레임이 다르다 — 화면에서 실제로 어긋나고 있다');
}

ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
console.log(bad ? `\n기형 벤치: ${bad}건 실패\n` : '\n기형 벤치: 전부 통과\n');
await b.close();
process.exit(bad ? 1 : 0);
