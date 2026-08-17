/* ═══════════════════════════════════════════════════════════
   warp.mjs — 기괴함이 가독성을 못 이긴다

   DESIGN.md §3. 화면을 뒤틀 이유가 셋이나 온다 — 신앙심(내려갈수록
   짙어진다) · 이물 층 · 광신. 셋이 각자 화면을 뒤틀면 세 가지 다른
   기괴함이 생기고, 그러면 그건 문법이 아니라 잡음이다. 그래서 문이
   하나다(setWarp / warpLens).

   이 파일이 지키는 것 넷:

   ① **순서대로 열린다.** 네 표현(잔상 → 색 분리 → 찢김 → 오독)이
      한꺼번에 열리면 0.35 에서 이미 다 보여서 0.70 이 아무 말도 못 한다.
   ② **지형만 뒤틀린다.** 몬스터와 영웅까지 뒤틀면 무엇이 나를 죽이는지가
      안 보이고, 그건 기괴한 게 아니라 불공평한 것이다. 벽이 거짓말하는
      것과 적이 안 보이는 것은 다른 물건이다.
   ③ **팔레트를 안 벗어난다.** 26색이 이 게임의 얼굴이다.
   ④ **가독성 린트를 못 이긴다.** 대비·실루엣·무대가 뒤틀림 아래에서도
      선다.

   usage: node sim/warp.mjs      (포트 8199에 정적 서버 필요)
   ═══════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://127.0.0.1:8199/index.html');
await pg.waitForTimeout(900);

console.log('\n뒤틀림 벤치 — 기괴함이 가독성을 못 이긴다\n');

/* ── ① 순서대로 열리는가 ────────────────────────────────── */
const curve = await pg.evaluate(async () => {
  const J = await import('/src/juice.js');
  const out = [];
  for (const v of [0, 0.2, 0.34, 0.35, 0.54, 0.55, 0.69, 0.70, 1.0]) {
    J.setWarp(v);
    out.push([v, J.warpLens()]);
  }
  J.setWarp(0);
  return out;
});
const at = v => curve.find(([x]) => x === v)[1];
ok(at(0) === null && at(0.34) === null, '0.35 아래에서는 아무 일도 없다', '정상');
ok(!!at(0.35) && at(0.35).split === 0 && at(0.35).tear === 0,
   '0.35 — 잔상만 열린다', `잔상 ${at(0.35)?.ghost.toFixed(2)}`);
ok(at(0.55).split > 0 && at(0.54).split === 0,
   '0.55 — 색 분리가 더해진다', `${at(0.54).split} → ${at(0.55).split}px`);
ok(at(0.70).tear > 0 && at(0.69).tear === 0,
   '0.70 — 찢김이 더해진다', `${at(0.69).tear} → ${at(0.70).tear}px`);
ok(at(1.0).misread > 0 && at(0.69).misread === 0,
   '0.70 위 — 오독이 더해진다 (규칙은 안 바뀐다, 눈만 속는다)',
   `${(at(1.0).misread * 100).toFixed(0)}%`);
ok(at(1.0).ghost > at(0.35).ghost && at(1.0).tear >= at(0.70).tear,
   '그리고 깊어질수록 짙어진다', `잔상 ${at(0.35).ghost.toFixed(2)} → ${at(1.0).ghost.toFixed(2)}`);

/* ── ② 지형만 뒤틀리는가 ────────────────────────────────── */
console.log('');
const src = await pg.evaluate(async () => (await fetch('/src/ui.js')).text());
/* 정의(`function warped(ctx,`)를 빼고 **부르는 자리**만 센다. 처음에
   그냥 세었더니 3곳이 나왔는데 그 셋째는 함수 자신이었다. */
const calls = (src.match(/(?<!function )warped\(ctx,/g) || []).length;
ok(calls === 2, '뒤틀린 채 그리는 자리가 둘뿐이다 — 벽과 바닥', `${calls}곳`);
ok(!/warped\(ctx,\s*sprite\(/.test(src),
   '스프라이트(몬스터·영웅·물건)는 안 지난다 — 무엇이 나를 죽이는지는 늘 보여야 한다');

/* ── ③ 팔레트를 안 벗어나는가 ───────────────────────────── */
const juice = await pg.evaluate(async () => (await fetch('/src/juice.js')).text());
const warpBlock = juice.slice(juice.indexOf('export function warpLens'),
                              juice.indexOf('export function beat'));
ok(!/#[0-9a-fA-F]{3,6}/.test(warpBlock), '뒤틀림이 새 색을 안 만든다 — 26색 안에서 논다');

/* ── ④ 가독성이 뒤틀림 아래에서도 서는가 ──────────────────
   실제로 판을 굴려 놓고 최대 뒤틀림에서 화면을 그린다. 던지지 않는가,
   그리고 화면이 통째로 하얘지거나 까매지지 않는가. */
console.log('');
await pg.evaluate(() => { const e = [...document.querySelectorAll('button')]
  .find(x => x.getBoundingClientRect().width > 2 && /새 게임/.test(x.textContent)); e && e.click(); });
await pg.waitForTimeout(400);
for (let i = 0; i < 4; i++) {
  await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
    .filter(x => x.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
  await pg.waitForTimeout(300);
}
const shots = [];
for (const v of [0, 0.5, 0.75, 1.0]) {
  /* **신앙심**을 민다. setWarp 를 직접 부르면 렌더 루프가 매 프레임
     `setWarp(warpOf())` 로 덮어써서 네 단계가 전부 같은 값이 된다 —
     신앙심이 뒤틀림의 유일한 입구가 된 뒤로 그렇다. 진짜 입구를 밀어야
     진짜 경로를 잰다.

     그리고 값만 바꾸고 재면 안 된다: 화면은 다음 프레임에야 바뀐다. */
  await pg.evaluate(async w => {
    const Game = await import('/src/game.js');
    const UI = await import('/src/ui.js');
    Game.G.piety = Math.round(w * 100);
    UI.draw();
  }, v);
  await pg.waitForTimeout(120);
  /* 지도 캔버스의 밝기 분포. 뒤틀려도 어두운 칸과 밝은 칸이 **둘 다**
     남아 있어야 한다 — 한쪽으로 쏠리면 그건 뒤틀린 게 아니라 지워진
     것이다. */
  shots.push(await pg.evaluate(() => {
    /* 지도는 #map 이다. 처음에 `#stage canvas || canvas` 로 잡았더니
       그 셀렉터가 안 맞아 **첫 캔버스(#title-scene)** 를 재고 있었고,
       그래서 네 단계가 전부 같은 숫자로 나왔다. 제대로 겨누니 밝기가
       8% 움직인다. 이 벤치에서 자를 세 번 고쳤다. */
    const c = document.getElementById('map');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let dark = 0, lit = 0, n = 0, sum = 0;
    for (let i = 0; i < d.length; i += 16) {
      if (d[i+3] < 8) continue;
      const l = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114) / 255;
      n++; sum += l; if (l < 0.18) dark++; else if (l > 0.35) lit++;
    }
    /* mean 도 같이 낸다. 「문턱 위 픽셀의 비율」은 뒤틀림이 밝기를
       올려도 문턱을 안 넘으면 안 움직인다 — 실제로 네 단계가 전부
       4.7% 로 나왔다. 평균은 움직인다(실측 +8%). */
    return { dark: dark / n, lit: lit / n, mean: sum / n };
  }));
}
const flat = shots.findIndex(s => s.lit < 0.02 || s.dark < 0.02);
ok(flat === -1,
   '최대 뒤틀림에서도 어두운 칸과 밝은 칸이 둘 다 남는다 — 뒤틀린 것과 지워진 것은 다르다',
   shots.map((s, i) => `${[0, 0.5, 0.75, 1][i]}:밝${(s.lit * 100).toFixed(1)}%`).join(' '));
/* 그리고 이 자가 실제로 뒤틀림에 반응하는가. 네 단계가 전부 같은
   숫자면 통과로 찍히더라도 아무것도 안 잰 것이다 — 이 저장소가 이번
   세션에 그 실수를 세 번 했다. */
const moved = Math.max(...shots.map(s => s.mean)) - Math.min(...shots.map(s => s.mean));
ok(moved > 0.002, '   그리고 이 자가 뒤틀림에 실제로 반응한다 — 안 움직이면 안 잰 것이다',
   shots.map((s, i) => `${[0, 0.5, 0.75, 1][i]}:${s.mean.toFixed(3)}`).join(' ')
   + ` · 폭 ${(moved * 100).toFixed(1)}%`);

await pg.evaluate(async () => { (await import('/src/game.js')).G.piety = 0; });
await pg.waitForTimeout(400);
ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
await b.close();

console.log(bad ? `\n뒤틀림 벤치: ${bad}건 실패\n` : '\n뒤틀림 벤치: 기괴하되 읽힌다\n');
process.exit(bad ? 1 : 0);
