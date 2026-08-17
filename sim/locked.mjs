/* locked.mjs — 잠긴 계단이 「잠김」으로 읽히는가.

   플레이 리뷰가 이번 회차 최대 결함으로 꼽은 화면이다: 잠긴 계단
   위에 서면 버튼이 「▼ 내려가기」에 밝은 금색 `live`였고, 열리는
   계단과 **픽셀 단위로 같았다**. 누르면 화면에 아무 일도 안 일어나고
   로그 다섯 줄 중 하나에 주황 한 줄이 낀다. 그런데 누를 때마다 한
   턴이 탄다. 모바일에서 「밝은 버튼을 눌렀는데 화면이 안 변한다」는
   거의 언제나 고장으로 읽힌다.

   재는 것 다섯:
     · 잠겼을 때 버튼 글자가 열렸을 때와 다른가
     · 잠겼을 때 `live`(금색)가 꺼지는가
     · 눌러도 층이 안 바뀌는가 — 그리고 **턴은 타는가**
     · 눌렀을 때 화면이 흔들리는가 (촉감이 없으면 고장이다)
     · 인내심이 다하면 같은 버튼이 다시 열리는가

   usage: node sim/locked.mjs                                    */
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
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://127.0.0.1:8199/index.html');
await pg.waitForTimeout(900);

const clearCards = async () => {
  for (let i = 0; i < 14; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok', 'ask-ok', 'look-ok', 'look-close']) {
        const e = document.getElementById(id);
        if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; }
      }
      const c = document.getElementById('lorecard');
      if (c && !c.hidden) { c.hidden = true; return true; }
      return false;
    });
    if (!hit) return;
    await pg.waitForTimeout(120);
  }
};

/* 화면을 **실제로** 연다. `startGame`만 부르면 `#sc-play`가 숨은
   채로 남아 지도 캔버스가 기본값 300×150에 머물고, 그러면 몬스터의
   화면 좌표가 캔버스 밖으로 나가 「그 칸에 아무것도 없다」가 된다 —
   화면이 틀린 것이 아니라 무대가 안 열린 것이다. */
const boot = async () => {
  await pg.evaluate(() => { const e = [...document.querySelectorAll('button')]
    .find(x => x.getBoundingClientRect().width > 2 && /새 게임/.test(x.textContent));
    e && e.click(); });
  await pg.waitForTimeout(400);
  for (let i = 0; i < 4; i++) {
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
      .filter(x => x.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
    await pg.waitForTimeout(300);
  }
  await clearCards();
};

/* 무대: 4층에 내려보내고 계단 위에 세운다. 과업은 손으로 건다 —
   45% 확률을 기다리면 이 벤치가 절반은 아무것도 안 재게 된다. */
const stage = async (locked) => pg.evaluate(async (lock) => {
  const Game = await import('/src/game.js');
  const W = await import('/src/world.js');
  const D = await import('/src/data.js');
  Game.enterDepth(4);
  const G = Game.G, L = G.level, p = G.player;
  /* 4층은 아르카나를 고르는 층이라, enterDepth 가 화면을 'arcana' 로
     세운다. 그대로 두면 이 벤치는 계단이 아니라 선택 화면을 재게
     된다 — 실제로 「흔들림 0칸」과 「표식이 없다」로 뒤집혔다.
     사람이 하듯 하나 고르고 판으로 돌아간다. */
  if (Game.arcanaDue(4)) Game.takeArcana(Game.arcanaOffer()[0].id);
  G.screen = 'play';
  let at = -1;
  for (let i = 0; i < L.tiles.length; i++) if (L.tiles[i] === W.DOWN) { at = i; break; }
  if (at < 0) return { staged: false };
  p.x = at % W.MW; p.y = (at / W.MW) | 0;
  G.task = D.TASKS.find(t => t.id === 'key');
  G.taskDone = !lock;
  G.floorTurn = lock ? 0 : 999;
  /* 열쇠를 문 것을 하나 세워 둔다 — 표식이 그려지는지도 같이 본다. */
  G.monsters.length = 0;
  const spec = D.MONSTERS.find(m => m.spr === 'orc');
  /* 옆칸이 벽이면 아무것도 안 그려지고, 그러면 「표식이 없다」가
     아니라 「몬스터가 없다」를 재게 된다. 걸을 수 있는 이웃을 찾는다. */
  let spot = null;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]])
    if (!spot && W.walkable(L, p.x + dx, p.y + dy)) spot = [p.x + dx, p.y + dy];
  if (!spot) return { staged: false };
  G.monsters.push({ ...spec, hp: spec.hp, maxhp: spec.hp,
                    x: spot[0], y: spot[1], awake: true, energy: 0, hasKey: true });
  p.lightTurns = 900;
  Game.refreshFov();
  /* HUD는 매 프레임이 아니라 행동마다 다시 그려진다. 손으로 세운
     무대는 행동이 아니므로 한 번 불러 줘야 한다 — 안 그러면 지난
     화면의 글자를 읽고 「버튼이 안 바뀐다」고 보고하게 된다. */
  const UI = await import('/src/ui.js');
  UI.refresh();
  /* 지도 캔버스는 화면이 실제로 열릴 때 크기가 잡힌다. 손으로 세운
     무대에서는 그 일이 안 일어나서 캔버스가 기본값 300×150인 채로
     남고, 그러면 몬스터의 화면 좌표가 캔버스 밖(py=−24)으로 나가
     「그 칸에 아무것도 없다」가 된다 — 재는 자리가 틀린 것이다. */
  window.dispatchEvent(new Event('resize'));
  return { staged: true, depth: G.depth };
}, locked);


const readBtn = () => pg.evaluate(() => {
  const e = document.getElementById('btn-here');
  return { text: e.textContent, live: e.classList.contains('live'),
           shut: e.classList.contains('shut'), disabled: e.disabled };
});

console.log('\n잠긴 계단 벤치 — 잠김이 잠김으로 읽히는가\n');
await boot();

/* 1. 무대가 실제로 그 상태인가부터. 계단을 못 찾으면 아래 전부가
      못 틀리는 칸이 된다. */
const st = await stage(true);
ok(st.staged, '계단 위에 세웠다', st.staged ? `${st.depth}층` : '계단을 못 찾았다');
await clearCards();
await pg.waitForTimeout(300);
const shutBtn = await readBtn();

/* 2. 열린 상태와 비교한다. 기준선이 없으면 「금색이 아니다」는
      아무 말도 아니다. */
await stage(false);
await clearCards();
await pg.waitForTimeout(300);
const openBtn = await readBtn();

console.log(`\n      잠김: "${shutBtn.text}" live=${shutBtn.live} shut=${shutBtn.shut}`);
console.log(`      열림: "${openBtn.text}" live=${openBtn.live} shut=${openBtn.shut}\n`);

ok(openBtn.live && openBtn.text.includes('내려가기'),
   '열린 계단은 금색으로 「내려가기」라고 말한다', openBtn.text);
ok(shutBtn.text !== openBtn.text, '잠긴 계단은 다른 글자를 쓴다', shutBtn.text);
ok(shutBtn.text.includes('잠긴'), '무엇이 문제인지를 버튼이 말한다', shutBtn.text);
ok(!shutBtn.live, '잠겼을 때 금색이 꺼진다 — 열리는 계단과 같아 보이면 안 된다',
   `live=${shutBtn.live}`);
ok(!shutBtn.disabled, '그래도 눌리기는 한다 — 두드리는 것도 행동이다',
   `disabled=${shutBtn.disabled}`);

/* 3. 눌렀을 때. 층은 안 바뀌고 턴은 타야 한다. */
await stage(true);
await clearCards();
await pg.waitForTimeout(250);
const before = await pg.evaluate(async () => {
  const { G } = await import('/src/game.js');
  return { depth: G.depth, turn: G.turn, fx: G.fx.length };
});
await pg.evaluate(() => document.getElementById('btn-here').click());
await pg.waitForTimeout(60);
const after = await pg.evaluate(async () => {
  const { G } = await import('/src/game.js');
  return { depth: G.depth, turn: G.turn,
           log: G.log.slice(-3).map(l => l.text) };
});
ok(after.depth === before.depth, '눌러도 안 내려간다', `${before.depth} → ${after.depth}`);
ok(after.turn > before.turn, '그러나 턴은 탄다 — 인내심 시계가 돌아야 열린다',
   `${before.turn} → ${after.turn}`);
ok(after.log.some(t => t.includes('자물쇠')), '자물쇠 이야기가 로그에 남는다',
   after.log[after.log.length - 1]);

/* 4. 촉감. 화면이 실제로 흔들렸는가 — 지도 캔버스의 변환을 본다.
      로그 한 줄만으로는 「고장」과 구별되지 않는다. */
/* 흔들림은 CSS transform이 아니라 그리기 좌표에 실린다 —
   처음에 캔버스의 computed transform을 열네 번 읽고 「안 흔들린다」고
   보고했는데, 거기에는 원래 아무것도 실리지 않는다. 재는 자리가
   틀린 것이지 화면이 틀린 것이 아니었다. juice가 내놓는 값을 본다. */
const shook = await pg.evaluate(async () => {
  const Juice = await import('/src/juice.js');
  const Game = await import('/src/game.js');
  let best = 0;
  Game.descend;
  document.getElementById('btn-here').click();
  for (let i = 0; i < 30; i++) {
    const v = Juice.shakeVec();
    best = Math.max(best, Math.hypot(v.x || 0, v.y || 0));
    await new Promise(r => setTimeout(r, 16));
  }
  return best;
});
ok(shook > 0.02, '누르면 화면이 흔들린다 — 눌렸다는 촉감이 있어야 고장이 아니다',
   `최대 ${shook.toFixed(3)}칸`);

/* 5. 인내심이 다하면 같은 버튼이 열린다. 안 열리면 그건 잠금이
      아니라 벽이고, 판이 거기서 끝난다. */
const opened = await pg.evaluate(async () => {
  const Game = await import('/src/game.js');
  Game.G.floorTurn = 1000;
  return Game.stairsLocked() === null;
});
ok(opened, '인내심이 다하면 자물쇠가 삭는다 — 잠금이지 벽이 아니다');

/* 6. 열쇠를 문 것이 화면에서 지목되는가. 표식이 없으면 과업이
      아니라 전수조사다. */
await stage(true);
await clearCards();
await pg.waitForTimeout(350);
const mark = await pg.evaluate(async () => {
  const Game = await import('/src/game.js'), UI = await import('/src/ui.js');
  const m = Game.G.monsters[0];
  const cv = document.getElementById('map'), g = cv.getContext('2d'), cam = UI._camera();
  const px = Math.round((m.x - cam.cx) * cam.t), py = Math.round((m.y - cam.cy) * cam.t);
  if (px < 0 || py < 0 || px + cam.t >= cv.width || py + cam.t >= cv.height) return -1;
  /* 표식은 칸 위쪽에 걸쳐 그려지므로 위 절반을 조금 넓게 본다. */
  const d = g.getImageData(px, Math.max(0, py - cam.t * 0.3), cam.t, cam.t * 0.8).data;
  const hueOf = (r, gg, bb) => {
    const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), c = mx - mn;
    if (!c) return null;
    let h; if (mx === r) h = ((gg - bb) / c) % 6;
    else if (mx === gg) h = (bb - r) / c + 2; else h = (r - gg) / c + 4;
    h *= 60; if (h < 0) h += 360;
    return { h, s: mx ? c / mx : 0, v: mx / 255 };
  };
  let n = 0, any = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 40) continue;
    any++;
    const c = hueOf(d[i], d[i + 1], d[i + 2]);
    /* 낡은 금 #d8b048 — 색상 44°, 채도 0.67, 명도 0.85. */
    if (c && Math.abs(c.h - 44) < 14 && c.s > 0.45 && c.v > 0.6) n++;
  }
  return any > 100 ? n : -1;
});
ok(mark > 0, '열쇠를 문 것의 머리 위에 금빛 표식이 있다 — 지목할 수 없으면 전수조사다',
   mark < 0 ? '그 칸에 아무것도 안 그려져 있다(무대 오류)' : `${mark}px`);

ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
await b.close();
console.log(bad ? `\n잠긴 계단 벤치: ${bad}건 실패\n` : '\n잠긴 계단 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
