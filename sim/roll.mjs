/* roll.mjs — 걸으려고 누른 것이 구르기가 되는가.

   이 하네스가 구조적으로 못 보던 종류의 버그다. 헤드리스 봇은
   `Game.step()`을 직접 부르므로, 「손가락이 화면을 두 번 두드렸을 때
   무슨 일이 일어나는가」는 한 번도 재어진 적이 없다. sim/README.md가
   말하는 「행에만 있는 버그」가 이것이고, 이 파일이 그 두 번째 봇이다.

   재 보니 260ms 창이 사람이 걸으려고 탭하는 속도와 겹쳤다:
     탭 간격 100ms → 세 칸, 기력 −2      (굴렀다)
     탭 간격 150ms → 세 칸, 기력 −2      (굴렀다)
     탭 간격 200ms → 세 칸, 기력 −1~2    (굴렀다)
     탭 간격 250ms → 두 칸, 기력 그대로  (걸었다)
   기력은 두 턴에 하나씩 찬다. 즉 걸으려고 두 번 누를 때마다 네 턴어치
   방어 자원이 아무것도 아닌 곳에 나갔고, 그 벌은 스무 턴 뒤 오우거가
   붉은 별을 띄웠을 때 온다 — 오발과 벌이 멀리 떨어져 있으면 사람은
   자기가 잘못 눌렀다고 생각하지 않는다.

   usage: node sim/roll.mjs                        */
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
await pg.addInitScript(() => { let z = 31337 >>> 0;
  Math.random = () => ((z = (z * 1664525 + 1013904223) >>> 0) / 4294967296); });
await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1100);
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
  await pg.waitForTimeout(220);
}

/* 수업 카드를 꺼 둔다. 몬스터가 보이는 순간 「적에게 부딪치면
   공격입니다」가 떠서 d-pad를 덮고, 그러면 두드린 손이 통째로
   삼켜진다 — 위협이 있을 때만 0칸이 나오던 이유가 이것이었다.
   재려는 것은 손끝이지 수업이 아니다. */
await pg.evaluate(async () => {
  const Meta = await import('/src/meta.js');
  const m = Meta.read();
  for (const l of ['move','town','fight','cast','intent','heavy','ground',
                   'bank','oil','thief','clock','relic','prop','fire','fork','anvil'])
    (m.taught = m.taught || {})[l] = true;
});

console.log('\n손끝 구르기 벤치 — 걸으려고 누른 것이 구르기가 되는가\n');

/* 손으로 판 굴 하나. 방 생성기에 맡기면 벽에 막혀 몇 칸 갔는지를
   못 세고, 그러면 재는 것이 구르기가 아니라 지형이 된다. */
async function stage(withThreat) {
  return pg.evaluate(async (threat) => {
    const Game = await import('/src/game.js');
    const W = await import('/src/world.js');
    const G = Game.G;
    Game.enterDepth(3);
    const L = G.level, p = G.player;
    for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = W.ROCK;
    L.roomOf.fill(-1);
    for (const r of L.rooms) { r.lit = false; r.bright = false; }
    /* 세 줄짜리 굴. 한 줄로 팠더니 위협용 쥐가 구르는 길 위에 서서
       「구를 자리가 없다」가 나왔다 — 재려던 것은 구르기인데 재고 있던
       것은 길막이었다. 쥐는 옆줄에 세운다. */
    const y = 12;
    for (let x = 4; x <= 40; x++)
      for (let dy = -1; dy <= 1; dy++) L.tiles[W.idx(x, y + dy)] = W.FLOOR;
    p.x = 8; p.y = y;
    p.stam = p.maxStam;
    p.lightTurns = 900;
    G.monsters.length = 0;
    if (threat) {
      /* 진짜 몬스터를 옮겨 세운다. 손으로 지어 넣으면 NaN이 나온다 —
         이 세션에서 이미 한 번 그렇게 헛짚었다. */
      G.monsters.push({ spr:'rat', n:'커다란 쥐', hp:14, maxhp:14, atk:4, ac:2, xp:2,
                        ai:'hunt', x:6, y: y - 1, awake:true, energy:0 });
    }
    Game.recalc(p); Game.refreshFov();
    return { x:p.x, stam:p.stam, threat: Game.threatened() };
  }, withThreat);
}

/* 카드가 떠 있으면 d-pad를 덮는다. 무대를 세울 때마다 치운다 —
   첫 판만 2칸 움직이고 나머지가 전부 0칸이던 이유가 이것이었다.
   무대가 아니라 무대를 덮은 양피지를 두드리고 있었다. */
async function clearCards() {
  for (let i = 0; i < 10; i++) {
    const hit = await pg.evaluate(() => {
      for (const id of ['lesson-ok', 'ask-ok', 'look-ok']) {
        const e = document.getElementById(id);
        if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; }
      }
      const card = document.getElementById('lorecard');
      if (card && !card.hidden) { card.hidden = true; return true; }
      return false;
    });
    if (!hit) return;
    await pg.waitForTimeout(150);
  }
}

/* d-pad의 동쪽 버튼을 두 번 두드린다. 진짜 터치로. */
async function tapTwice(gap) {
  await clearCards();
  const box = await pg.evaluate(() => {
    const b2 = [...document.querySelectorAll('#dpad button')]
      .find(e => e.dataset.dir === '1,0');
    const r = b2.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const read = () => pg.evaluate(async () => {
    const G = (await import('/src/game.js')).G;
    return { x: G.player.x, stam: G.player.stam, turn: G.turn };
  });
  /* **두드리기 직전에** 읽는다. 무대를 세운 뒤 카드를 치우는 동안에도
     턴이 흐를 수 있어서, stage()가 돌려준 값과 비교하면 걸음 수가
     한 칸씩 어긋난다. */
  const before = await read();
  await pg.touchscreen.tap(box.x, box.y);
  await pg.waitForTimeout(gap);
  await pg.touchscreen.tap(box.x, box.y);
  await pg.waitForTimeout(260);
  let after = await read();
  /* 브라우저가 아주 짧은 간격의 두 탭을 하나의 제스처로 삼켜 버리는
     일이 있다 — 실제로 120ms에서 두 번째 탭이 통째로 사라졌다.
     한 턴도 안 흘렀으면 두드린 적이 없는 것이므로 한 번 더 시도한다.
     게임을 의심하기 전에 두드린 손을 의심한다. */
  if (after.turn === before.turn) {
    await pg.touchscreen.tap(box.x, box.y);
    await pg.waitForTimeout(gap);
    await pg.touchscreen.tap(box.x, box.y);
    await pg.waitForTimeout(260);
    after = await read();
  }
  return { moved: after.x - before.x, spent: before.stam - after.stam,
           turns: after.turn - before.turn, stam: after.stam };
}

/* ── 1. 아무것도 없을 때는 절대 안 구른다 ────────────────── */
{
  console.log('  위협이 없을 때 (빈 복도):');
  console.log('      간격    간 칸   기력');
  let rolled = 0;
  for (const gap of [80, 120, 160, 200, 240, 300, 400]) {
    await stage(false);
    const r = await tapTwice(gap);
    if (r.moved > 2 || r.spent > 0) rolled++;
    console.log(`      ${String(gap).padStart(4)}ms  ${String(r.moved).padStart(4)}칸  ${String(-r.spent).padStart(4)}`);
  }
  ok(rolled === 0, '어느 속도로 두드려도 구르지 않는다 — 피할 것이 없으니까',
     `${rolled}/7 구름`);
}

/* ── 2. 피할 것이 있으면 여전히 구른다 ───────────────────── */
{
  console.log('\n  위협이 있을 때 (뒤에 쥐):');
  const a = await stage(true);
  ok(a.threat, '위협으로 읽힌다');
  const fast = await tapTwice(120);
  console.log(`      120ms  ${fast.moved}칸  기력 −${fast.spent}`);
  ok(fast.moved > 2 && fast.spent > 0, '빠르게 두 번 누르면 구른다 — 원래 되던 것은 그대로다',
     `${fast.moved}칸 · 기력 −${fast.spent}`);

  /* 느리게 두드리면 그냥 걷는다 — 위협이 있어도. */
  await stage(true);
  const slow = await tapTwice(320);
  console.log(`      320ms  ${slow.moved}칸  기력 −${slow.spent}`);
  ok(slow.moved === 2 && slow.spent === 0,
     '천천히 두 번은 위협이 있어도 그냥 두 걸음이다', `${slow.moved}칸 · 기력 −${slow.spent}`);
}

/* ── 3. 구르면 말해 준다 ─────────────────────────────────── */
{
  await stage(true);
  await pg.evaluate(async () => { (await import('/src/game.js')).G.log.length = 0; });
  await tapTwice(120);
  const said = await pg.evaluate(async () => {
    const G = (await import('/src/game.js')).G;
    return G.log.map(l => l.text || l).join(' | ');
  });
  ok(/굴렀다/.test(said), '굴렀다고 로그에 남는다 — 없으면 실수로 구른 사람이 영영 모른다',
     said.split(' | ').find(t => /굴렀다/.test(t)) || said.slice(0, 40));
}

ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
console.log(bad ? `\n손끝 구르기 벤치: ${bad}건 실패\n` : '\n손끝 구르기 벤치: 전부 통과\n');
await b.close();
process.exit(bad ? 1 : 0);
