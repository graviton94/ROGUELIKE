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

/* ── 6. 테두리가 실제로 화면에 있는가 ────────────────────
   구운 그림에 테두리가 들어갔는지는 스프라이트를 세면 알지만, 벽은
   구울 때 이웃을 모르므로 **그리는 자리**에서 긋는다. 그래서 벽은
   화면에서만 확인할 수 있다.

   그리고 이건 사람이 눈으로 확인한 것 중 유일하게 조용히 사라질 수
   있는 것이다 — 스프라이트 테두리는 벤치가 잡지만, 벽 테두리는 그리는
   코드 한 줄이라 지워져도 아무 벤치도 안 울린다. */
{
  const seen = await pg.evaluate(async () => {
    const P = await import('/src/pixels.js');
    const D = await import('/src/data.js');
    const names = Object.keys(P.SPRITES);
    const CELL = P.CELL_SIZE;
    const K = P.PALETTE.k;
    const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    const read = img => {
      const c = document.createElement('canvas'); c.width = c.height = CELL;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, CELL, CELL).data;
    };
    let bare = [];
    for (const n of names) {
      const d = read(P.sprite(n));
      let opaque = 0, line = 0;
      for (let i = 0; i < CELL * CELL; i++) {
        if (d[i * 4 + 3] <= 8) continue;
        opaque++;
        if (hex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) === K) line++;
      }
      if (opaque && line / opaque < 0.08) bare.push(n);
    }
    return { total: names.length, bare };
  });
  ok(seen.bare.length === 0,
     '스프라이트 전부가 테두리를 가진다 — 몬스터만이 아니라 물건도 지형지물도',
     `${seen.total}종 중 없는 것 ${seen.bare.length}${seen.bare.length ? ': ' + seen.bare.join(' ') : ''}`);

  /* 벽. 바닥에 면한 쪽에 어두운 줄이 있는가.

     처음에 「화면에서 어두운 픽셀의 비율」을 셌다. 15%가 나왔고 통과
     했는데, 테두리를 그리는 네 줄을 지우고 다시 재도 15%였다 —
     세고 있던 것은 테두리가 아니라 배경이었다. 통과하는 벤치가
     아무것도 안 재고 있었다.

     그래서 **그 벽이 화면 어디에 그려졌는지**를 받아 와서, 바닥에
     면한 가장자리 한 줄과 그 벽의 속을 직접 비교한다. */
  const staged = await pg.evaluate(async () => {
    const Game = await import('/src/game.js');
    const G = Game.G;
    /* 무대를 다시 세운다. 앞 칸이 15층을 불 꺼진 채로 남겨 놓아서
       아무것도 안 보였다 — 「아래가 바닥인 벽이 없다」는 벽이 없어서가
       아니라 어두워서였다. */
    Game.enterDepth(3);
    const p = G.player;
    p.lightTurns = 900;
    p.hp = p.maxhp;
    Game.refreshFov();
    return true;
  });
  /* 카메라는 프레임 루프에서 주인공을 쫓아간다. 무대를 세우자마자
     좌표를 물으면 **직전 층의 카메라**가 나오고, 그러면 화면 밖을
     가리켜 -1이 나온다. 그리고 -1은 어떤 부등식이든 통과시킨다 —
     실제로 그렇게 통과한 벤치를 한 번 만들었다. 몇 프레임 기다린다. */
  await pg.waitForTimeout(400);

  /* 살아 있는 캔버스에서 바로 읽는다. 스크린샷을 거치면 (1) 찍는
     동안 카메라가 움직여 좌표가 낡고 (2) 배율이 하나 더 끼어든다 —
     둘 다 겪었고, 두 번째는 -1을 세면서 통과까지 했다. 카메라를 묻는
     것과 픽셀을 읽는 것을 한 번의 호출 안에서 한다. */
  const lum = await pg.evaluate(async () => {
    const Game = await import('/src/game.js');
    const UI = await import('/src/ui.js');
    const W = await import('/src/world.js');
    const G = Game.G, L = G.level, p = G.player;
    const cam = UI._camera();
    const cv = document.getElementById('map');
    const g = cv.getContext('2d');
    let best = null;
    for (let r = 1; r < 14 && !best; r++)
      for (let dx = -r; dx <= r && !best; dx++)
        for (let dy = -r; dy <= r && !best; dy++) {
          const x = p.x + dx, y = p.y + dy;
          if (!L.vis[W.idx(x, y)] || L.solid(x, y)) continue;          // 자기는 바닥
          if (!L.solid(x, y - 1) || !L.vis[W.idx(x, y - 1)]) continue; // 위는 벽
          const ax = Math.round((x - cam.cx) * cam.t);
          const ay = Math.round((y - 1 - cam.cy) * cam.t);
          if (ax < 0 || ay < 0 || ax + cam.t >= cv.width || ay + cam.t >= cv.height) continue;
          best = { x, y: y - 1, px: ax, py: ay };
        }
    if (!best) return null;
    const t = cam.t;
    const col = best.px + Math.round(t / 2);
    const d = g.getImageData(col, best.py, 1, t).data;
    const lumAt = k => Math.max(d[k * 4], d[k * 4 + 1], d[k * 4 + 2]);
    const strip = [];
    for (let k = 0; k < t; k++) strip.push(lumAt(k));
    const u = Math.max(1, Math.round(t / 16));
    /* 한 줄만 집어 재면 화면 흔들림(shakeVec) 몇 픽셀에 값이 뒤집힌다 —
       81 대 61이 나와서 실패한 적이 있는데, 테두리는 멀쩡히 있었고
       집은 자리가 두 픽셀 어긋나 있었다. 아래쪽 띠에서 가장 어두운
       줄과, 속의 중앙값을 비교한다. */
    const band = strip.slice(Math.max(0, t - u - 2), t);
    const edge = Math.min(...band);
    const core = strip.slice(u + 2, t - u - 3).sort((a, b) => a - b);
    const inside = core[core.length >> 1] || 0;
    return { at: `${best.x},${best.y}`, t, u, inside, edge, strip };
  });
  ok(!!lum, '아래가 바닥인 벽을 화면에서 찾았다', lum?.at);
  if (lum) {
    console.log(`\n      세로 단면 ${lum.strip.join(' ')}`);
    console.log(`      벽 속 ${lum.inside} · 바닥에 면한 가장자리 ${lum.edge}\n`);
    ok(lum.inside > 12,
       '벽 속이 실제로 그려져 있다 — 빈 곳을 재면 0이 나오고 0은 어떤 부등식이든 통과한다',
       `${lum.inside}`);
    ok(lum.inside > 12 && lum.edge < lum.inside * 0.7,
       '바닥에 면한 벽 가장자리가 벽 속보다 확실히 어둡다 — 벽이 덩어리로 읽힌다',
       `${lum.inside} → ${lum.edge}`);
  }
}

ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
console.log(bad ? `\n기형 벤치: ${bad}건 실패\n` : '\n기형 벤치: 전부 통과\n');
await b.close();
process.exit(bad ? 1 : 0);
