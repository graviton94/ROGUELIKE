/* hearsay.mjs — 피로 쓰인 규칙이 실제로 붉게 고쳐지는가.

   이 게임의 도감은 지금까지 절대 거짓말을 못 했다. tellsOf가 규칙이
   읽는 값에서 그대로 뽑기 때문이고, 그게 이 파일의 원칙이었다.
   여기서 그 원칙을 **한 줄만** 깬다: 시체를 다섯 구 쌓기 전에
   플레이어가 아는 것은 전부 앞서 죽은 사람들의 말이고, 그 사람들은
   틀릴 수 있다 — 틀려서 죽었을 수도 있다.

   위험한 장치다. 잘못 만들면 「이거 버그 아닌가」가 남고, 그건
   이 게임이 감당할 수 없는 종류의 손해다. 그래서 재야 하는 것은
   「거짓말이 되는가」가 아니라 **거짓말이 반드시 들통나는가**다:

     · 거짓은 한순간에 무너지는 것만 고른다 (문·속도·예비동작·재생)
     · 무엇이 거짓인지는 판이 아니라 종류로 정해진다 — 판마다 바뀌면
       그건 소문이 아니라 잡음이다
     · 그 장면을 **보고 있을 때만** 고쳐진다
     · 한 번 고친 줄은 다시 안 고쳐진다
     · 그리고 정본은 손으로 적힌 것이 아니라 tellsOf가 준 그 줄이다

   usage: node sim/hearsay.mjs                        */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const W = await import('../src/world.js');
const G = Game.G;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

console.log('\n피로 쓰인 규칙 벤치 — 거짓이 반드시 들통나는가\n');

/* ── 1. 표 자체 ──────────────────────────────────────────── */
{
  const all = D.MONSTERS.filter(m => m.spr);
  const lied = all.filter(m => D.hearsayFor(m));
  const pct = Math.round(lied.length / all.length * 100);
  console.log(`      ${lied.length}/${all.length}종(${pct}%)이 틀린 줄을 하나 물려받는다`);
  for (const m of lied.slice(0, 6))
    console.log(`      · ${m.n.padEnd(12)} ${D.hearsayFor(m).k}`);
  console.log('');
  ok(pct >= 30 && pct <= 65,
     '절반 남짓만 거짓이다 — 전부 거짓이면 규칙서를 아예 안 읽는다', `${pct}%`);

  /* 판마다 바뀌면 소문이 아니라 잡음이다. */
  const twice = all.every(m => D.hearsayFor(m)?.k === D.hearsayFor(m)?.k);
  ok(twice, '같은 종류는 언제나 같은 거짓을 듣는다');

  /* 정본을 표에 손으로 적어 두지 않았는가 — 적어 두면 두 벌이 되고,
     언젠가 속도 하나를 고쳤을 때 「정본」 쪽이 거짓말을 한다. */
  ok(D.HEARSAY.every(h => !h.truth),
     '표에 정본이 없다 — 참말은 tellsOf에서만 나온다');

  /* 거짓 줄이 참말 줄을 **덮는지** 확인한다. 덮지 못하고 조용히
     추가되면 규칙서에 줄이 하나 늘고, 그게 최악의 실패다. */
  let covered = 0, grew = 0;
  for (const m of lied) {
    const t = D.tellsOf(m).length, b = D.rulebook(m, false).length;
    if (b === t) covered++; else grew++;
  }
  ok(grew === 0, '거짓은 언제나 참말 한 줄을 덮는다 — 줄이 늘지 않는다',
     `덮음 ${covered} · 늘어남 ${grew}`);
}

/* ── 2. 보는 앞에서 문을 부수면 그 자리에서 고쳐진다 ─────── */
function stage(spr, depth = 6) {
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(depth);
  const L = G.level, p = G.player;
  for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = W.ROCK;
  L.roomOf.fill(-1);
  for (const r of L.rooms) { r.lit = false; r.bright = false; }
  const y = 12;
  for (let x = 4; x <= 40; x++) L.tiles[W.idx(x, y)] = W.FLOOR;
  p.x = 10; p.y = y; p.lightTurns = 900; p.hp = p.maxhp;
  G.monsters.length = 0;
  const spec = D.MONSTERS.find(m => m.spr === spr);
  const m = { ...spec, hp: spec.hp, maxhp: spec.hp, x: 14, y, awake: true, energy: 0 };
  G.monsters.push(m);
  Game.recalc(p); Game.refreshFov();
  G.log.length = 0;
  return { L, p, m, y };
}
const said = () => G.log.map(l => l.text);
const red  = () => G.log.filter(l => l.tone === 'redwrit').map(l => l.text);

{
  /* 문을 부수는 것 중 「문을 열지 못한다」고 잘못 적힌 종류를 찾는다.
     손으로 고르면 표가 바뀌었을 때 벤치가 조용히 죽는다. */
  const liar = D.MONSTERS.find(m => m.spr && D.hearsayFor(m)?.k === 'door' && m.door === 'smash');
  ok(!!liar, '문을 부수는데 못 연다고 적힌 종류가 있다', liar?.n);
  if (liar) {
    Meta.forget();
    const { L, m, y } = stage(liar.spr);
    const book0 = D.rulebook(m, Meta.corrected(m.spr, 'door'));
    const lie = book0.find(l => l.kind === 'hearsay');
    ok(!!lie, '도감이 그 거짓을 먼저 보여 준다', lie?.text);

    L.tiles[W.idx(12, y)] = W.DOOR;      // 사이에 문을 닫아 둔다
    Game.refreshFov();
    for (let i = 0; i < 12 && !red().length; i++) Game.step(0, 0);
    console.log('');
    for (const t of said().slice(-3)) console.log(`      ${t}`);
    console.log('');
    ok(red().length === 1, '문을 부수는 것을 본 그 자리에서 붉은 줄이 하나 뜬다',
       red()[0] || '없음');
    ok(Meta.corrected(liar.spr, 'door'), '정본이 기록된다');

    const book1 = D.rulebook(m, true);
    ok(book1.some(l => l.kind === 'redwrit' && /부순다/.test(l.text)),
       '도감이 정본으로 바뀐다', book1.find(l => l.kind === 'redwrit')?.text);
    ok(!book1.some(l => l.kind === 'hearsay'), '거짓 줄은 사라진다');

    /* 두 번째로 봤을 때 또 말하면 그건 발견이 아니라 잡음이다. */
    const { L: L2, y: y2 } = stage(liar.spr);
    L2.tiles[W.idx(12, y2)] = W.DOOR;
    Game.refreshFov();
    for (let i = 0; i < 12; i++) Game.step(0, 0);
    ok(red().length === 0, '두 번째로 봤을 때는 말하지 않는다', red()[0] || '조용함');
  }
}

/* ── 3. 안 보는 데서 일어난 일은 안 고쳐진다 ─────────────── */
{
  const liar = D.MONSTERS.find(m => m.spr && D.hearsayFor(m)?.k === 'door' && m.door === 'smash');
  if (liar) {
    Meta.forget();
    const { L, p, m, y } = stage(liar.spr);
    /* 보는 것은 문이므로, 어둡게 하는 것만으로는 부족하고 **문이**
       멀어야 한다. 처음에 두 칸 앞에 문을 두고 불만 껐더니 반경 2에
       문이 그대로 보여서 규칙서가 멀쩡히 고쳐졌다 — 게임이 아니라
       무대가 틀렸다. */
    L.tiles[W.idx(20, y)] = W.DOOR;
    m.x = 22;
    p.lightTurns = 0;                    // 반경 2
    Game.refreshFov();
    ok(!L.vis[W.idx(20, y)], '열 칸 밖의 문은 어두워서 안 보인다',
       `반경 ${G.lightRadius}칸`);
    for (let i = 0; i < 20; i++) Game.step(0, 0);
    ok(!Meta.corrected(liar.spr, 'door'),
       '어둠 속에서 부서진 문은 규칙서를 안 고친다 — 못 본 것을 고쳐 주면 알림이지 발견이 아니다');
  }
}

/* ── 4. 팔을 당기는 것을 보면 고쳐진다 ───────────────────── */
{
  const liar = D.MONSTERS.find(m => m.spr && D.hearsayFor(m)?.k === 'heavy');
  ok(!!liar, '예고 없이 때린다고 잘못 적힌 종류가 있다', liar?.n);
  if (liar) {
    Meta.forget();
    const { p, m } = stage(liar.spr);
    m.x = p.x + 1; m.y = p.y;            // 붙여 세운다
    Game.refreshFov();
    G.log.length = 0;
    for (let i = 0; i < 6 && !red().length; i++) Game.step(0, 0);
    ok(red().length >= 1, '팔을 당기는 것을 본 자리에서 고쳐진다', red()[0] || '없음');
    ok(Meta.corrected(liar.spr, 'heavy'), '정본이 기록된다');
  }
}

/* ── 5. 판을 넘어 남는다 ─────────────────────────────────── */
{
  /* 바로 위에서 고친 그 줄을 본다. 앞선 칸의 문 쪽을 물어봤더니
     실패가 떴는데, 4번 칸이 Meta.forget()으로 판을 갈아엎은 뒤였다 —
     게임이 안 남긴 게 아니라 벤치가 지워 놓고 물어본 것이었다. */
  const liar = D.MONSTERS.find(m => m.spr && D.hearsayFor(m)?.k === 'heavy');
  if (liar) {
    ok(Object.keys(Meta.read().redwrit || {}).length > 0,
       '고쳐 쓴 줄이 저장된다', Object.keys(Meta.read().redwrit).join(' '));
    Game.startGame('human', 'mage', Game.rollStats('mage'));
    Game.descend();
    ok(Meta.corrected(liar.spr, 'heavy'),
       '다음 판의 나는 더 세지 않고 덜 속는다 — 앎만 남는다');
  }
}

/* ── 6. 화면이 거짓말을 스스로 반박하지 않는가 ───────────
   이것이 이 시스템을 조용히 죽이는 유일한 방법이다. 살펴보기 창은
   위쪽에 「무엇인가」를 숫자로 적는데, 거기 「문: 부순다」가 있으면
   두 줄 아래의 「문을 열지 못한다고 전해 들었다」는 거짓말이 아니라
   그냥 오타처럼 보인다. 그러면 남는 것은 긴장이 아니라 「이거 버그
   아닌가」이고, 그건 이 게임이 감당할 수 없는 종류의 손해다.
   그래서 재는 것은 규칙이 아니라 **화면**이고, 브라우저가 필요하다. */
{
  const { chromium } = await import('playwright');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport:{ width:390, height:844 },
    deviceScaleFactor:2, isMobile:true, hasTouch:true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(900);
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
      for (const id of ['lesson-ok','ask-ok','look-ok']) {
        const e = document.getElementById(id);
        if (e && e.getBoundingClientRect().width > 2) { e.click(); return true; }
      } return false;
    });
    if (!hit) break;
    await pg.waitForTimeout(200);
  }

  const seen = await pg.evaluate(async () => {
    const Game = await import('/src/game.js'), D = await import('/src/data.js');
    const Meta = await import('/src/meta.js'), UI = await import('/src/ui.js');
    const G = Game.G;
    const out = [];
    for (const key of ['door', 'speed', 'heavy', 'regen']) {
      const liar = D.MONSTERS.find(m => m.spr && D.hearsayFor(m)?.k === key);
      if (!liar) continue;
      for (let i = 0; i < 20; i++) Meta.slew(liar.n);      // 버릇이 열리도록
      Game.enterDepth(6);
      const L = G.level, p = G.player;
      let spot = null;
      for (let x = p.x - 4; x <= p.x + 4 && !spot; x++)
        for (let y = p.y - 3; y <= p.y + 3 && !spot; y++)
          if (!L.solid(x, y) && !(x === p.x && y === p.y)) spot = { x, y };
      G.monsters.length = 0;
      G.monsters.push({ ...liar, hp: liar.hp, maxhp: liar.hp,
                        x: spot.x, y: spot.y, awake: true, energy: 0 });
      p.lightTurns = 900;
      Game.refreshFov();
      UI.inspect(spot.x, spot.y);
      out.push({ key, n: liar.n,
        rows: [...document.querySelectorAll('#look-rows .endval')]
          .map(e => ({ cls: e.className, t: e.textContent })) });
    }
    return out;
  });

  console.log('');
  for (const s of seen) {
    const lie = s.rows.find(r => /hearsay/.test(r.cls));
    console.log(`      ── ${s.n} (${s.key})`);
    for (const r of s.rows) console.log(`      ${/hearsay/.test(r.cls) ? '»' : ' '} ${r.t}`);
    console.log('');
    ok(!!lie, `${s.n}: 살펴보기 창에 전해 들은 줄이 뜬다`, lie?.t);
    ok(lie ? /전해 들음/.test(lie.t) : false,
       `${s.n}: 남의 말이라고 표시된다 — 안 붙이면 나중에 「버그 아닌가」가 된다`);
    /* 그리고 같은 창의 어느 줄도 그 거짓을 반박하면 안 된다. */
    const leak = {
      door:  r => /^부순다|^연다/.test(r.t),
      speed: r => /×/.test(r.t) && !/적힌 것이 없다/.test(r.t),
      heavy: r => /한 턴 당긴 뒤/.test(r.t),
      regen: r => /^턴마다 \d/.test(r.t),
    }[s.key];
    const bleed = s.rows.filter(r => !/hearsay/.test(r.cls) && leak(r));
    ok(bleed.length === 0,
       `${s.n}: 위쪽 수치가 그 거짓을 반박하지 않는다`,
       bleed.map(r => `「${r.t}」`).join(' ') || '샌 줄 없음');
  }
  ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
  await b.close();
}

console.log(bad ? `\n피로 쓰인 규칙 벤치: ${bad}건 실패\n` : '\n피로 쓰인 규칙 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
