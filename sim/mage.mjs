/* ── 순서 3 ② — 마법사의 여덟 칸과 비전 폭주 ────────────────
   §4: 「마법사만 예외 — 기예 없이 주문 8개」. 다섯이었고, 공통 치유
   둘이 붙어 일곱이 됐고, 궁극기 하나가 비어 있었다.

   비전 폭주는 값의 모양이 다른 주문이다 — 피해가 주사위가 아니라
   **태운 마나**에서 나오고, 그 뒤 열 턴 동안 마나가 어떤 식으로도
   돌아오지 않는다. 그래서 이 벤치가 무는 것은 위력이 아니라 **약속**
   이다: 화면이 예고한 값이 그대로 나가는가, 그리고 「어떤 식으로도」가
   정말 어떤 식으로도인가.

   ── 왜 소스를 읽는 절이 있는가 ─────────────────────────────
   「그을린 동안 마나가 안 돌아온다」는 규칙은 **문이 하나일 때만**
   참이다. 이 저장소에는 마나를 올리는 자리가 일곱 개 있었다(물약 ·
   지팡이 · 시간 도둑 · 레벨업 · 자연 회복 · 모닥불 · 살덩이).
   여섯을 막고 하나를 놓치면 「분명 안 찬다고 했는데 모닥불에서는
   찬다」가 되고, 그 종류의 결함은 판을 굴리는 벤치로는 거의 안 걸린다
   — 모닥불에 앉은 채로 그을린 판이 드물기 때문이다.
   그래서 규칙 파일을 글자로 읽어 「p.mana 에 쓰는 자리」를 센다.
   §5-2 를 기계로 지키는 자리다.

   usage: node sim/mage.mjs [판수]                              */

const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const { runBot } = await import('./_botlib.mjs');
const { G } = Game;
const { idx } = await import('../src/world.js');
const fs = await import('node:fs');

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`   ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};
const SURGE = D.SPELLS_CLASS.mage.find(s => s.id === 'surge');

/* ═══ 1. 여덟 칸 ══════════════════════════════════════════ */
console.log('\n── 마법사의 여덟 칸');
{
  Meta.forget();
  Game.startGame('human', 'mage', Game.rollStats('mage'));
  const p = G.player;
  p.lv = D.MAX_LEVEL; Game.recalc(p);
  const list = Game.spellList(p);
  for (const s of list)
    console.log(`   ${s.name.padEnd(7)} lv${String(s.lv).padStart(2)} · ${s.burn ? '통을 전부' : `${s.cost}mp`}`);
  ok(list.length === 8, '여덟이다 — §4의 「기예 없이 주문 8개」', `${list.length}칸`);
  ok(!!SURGE && list.some(s => s.id === 'surge'), '궁극기 칸이 있다', SURGE ? `${SURGE.name} lv${SURGE.lv}` : '없음');
  /* 궁극기는 마지막에 온다. 줄의 순서가 목록의 순서이므로, 사다리의
     맨 위가 가운데 있으면 손이 그것을 못 찾는다. */
  ok(list[list.length - 1].id === 'surge', '궁극기가 줄의 마지막이다 — 사다리의 맨 위는 끝에 있어야 손이 찾는다',
     list.map(s => s.short).join(' '));
  /* ── 줄의 순서와 **사다리**는 다르다 ──────────────────────
     위 줄은 목록의 순서만 봤다(선언 순서). 그래서 지형 파악이 13레벨,
     비전 폭주가 12레벨이던 동안에도 이 절은 초록이었다 — 손이 마지막에
     배우는 것은 궁극기가 아니라 지도였는데. 「마지막에 있다」와
     「마지막에 배운다」는 다른 문장이고, 사람이 겪는 것은 뒤쪽이다.
     레벨로도 묻는다. */
  const top = Math.max(...list.map(s => s.lv));
  ok(list.find(s => s.id === 'surge').lv === top,
     '궁극기를 **가장 늦게** 배운다 — 사다리의 마지막 칸이 편의 주문이면 여덟이 무엇을 향해 오르는지가 흐려진다',
     list.slice().sort((a, b) => a.lv - b.lv).map(s => `${s.short}${s.lv}`).join(' '));
  /* 정보를 읽는 칸이 둘이면 하나는 남는 칸이다. 감지는 §4의 유틸 4라
     고정이므로, 여기서 무는 것은 「그 옆에 또 층을 읽는 것이 있는가」다. */
  const readers = list.filter(s => s.mimic || s.wake || s.traps || s.keepMark || s.id === 'map');
  ok(readers.length === 1, '층을 읽는 칸이 하나다 — 둘이면 하나는 남는 칸이다',
     readers.map(s => s.name).join(' · ') || '없음');
}

/* ═══ 1.5 마력 장벽 ═══════════════════════════════════════
   지형 파악이 있던 자리. 정보를 읽는 칸이 둘일 이유가 없어서 바꿨고,
   바꾼 것이 규칙이므로 **규칙으로 잰다.** 무는 것은 셋이다:

   ① 바깥의 것이 못 들어온다
   ② **이미 안에 있는 것은 그대로다** — 이게 이 주문의 값이고, 늦게
      누르면 값을 못 한다는 뜻이다. 안 걸면 「누르면 안전해진다」로
      슬며시 바뀌어도 아무도 안 운다
   ③ 부수는 것(door:'smash')은 지나가고, 지나가면 **깨진다** —
      문과 같은 약속이다

   마을에서 못 잰다(몬스터가 없다). 실제 층에서, 손으로 세워 놓고
   `advance` 를 직접 돌린다 — 규칙 한 자리를 무는 것이므로 판 전체를
   굴릴 이유가 없다. */
console.log('\n── 마력 장벽');
{
  Meta.forget();
  runBot('human', 'mage', false);           // 층 하나를 만들어 둔다
  Game.startGame('human', 'mage', Game.rollStats('mage'));
  Game.descend();
  const p = G.player;
  p.lv = 12; Game.recalc(p); p.mana = p.maxmana;

  /* 손으로 셋을 세운다: 바깥의 평범한 것 · 안에 이미 있는 것 ·
     바깥의 부수는 것. 자리는 마법사 기준으로 잡는다. */
  const free = (x, y) => !G.level.solid(x, y) && !G.monsters.some(m => m.x === x && m.y === y)
                         && !(x === p.x && y === p.y);
  /* 자리를 손으로 박지 않는다. 층은 매번 다르게 생기고, 「위로 두 칸」이
     벽인 판에서 이 벤치는 게임이 아니라 지형을 잰다 — 처음에 그렇게
     써서 「벽에 막혀 못 세웠다」로 실패했다. 고리 안팎에서 **비어 있는
     칸을 찾아서** 세운다. */
  const findAt = (cheb) => {
    for (let dy = -cheb; dy <= cheb; dy++) for (let dx = -cheb; dx <= cheb; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== cheb) continue;
      if (free(p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
    }
    return null;
  };
  const mk = (cheb, door) => {
    const at = findAt(cheb);
    if (!at) return null;
    const m = { n:'시험체', spr:'rat', x:at.x, y:at.y, hp:99, maxhp:99, atk:1, ac:1, xp:1,
                awake:true, energy:0, ai:'hunt', spd:1, door };
    G.monsters.push(m);
    return m;
  };
  /* 셋을 **한꺼번에** 세우고 한 번에 재려 했더니, 시전이 턴을 끝내므로
     그 턴에 부수는 것이 걸어 들어와 장벽을 깨 버렸다 — 그리고 「누르면
     선다」가 실패로 찍혔다. 규칙은 멀쩡했고 벤치가 세 가지를 같은 턴에
     물은 것이다. 하나씩 세운다. */
  const inside = mk(1);
  ok(!!inside, '장벽을 잴 자리를 만들었다 — 고리 안에 하나',
     inside ? `(${inside.x},${inside.y})` : '벽에 막혀 못 세웠다');
  if (inside) {
    Game.cast('ward');
    ok(Game.wardUp(p), '누르면 장벽이 선다', `${p.ward - G.turn + 1}턴 남음`);
    ok(Math.max(Math.abs(inside.x - p.x), Math.abs(inside.y - p.y)) <= 1,
       '**안에 있던 것은 그대로 안에 있다** — 늦게 누르면 값을 못 한다는 뜻이다',
       `(${inside.x},${inside.y})`);

    /* 이제 바깥에 하나. 마법사는 안 죽어야 한다(안에 하나가 있으므로) —
       재는 것은 걸음이지 생존이 아니다. */
    p.maxhp = 99999; p.hp = 99999;
    const outside = mk(2);
    ok(!!outside, '   바깥에도 하나 세웠다', outside ? `(${outside.x},${outside.y})` : '못 세웠다');
    if (outside) {
      const was = `${outside.x},${outside.y}`;
      for (let i = 0; i < 4 && G.running && Game.wardUp(p); i++) { p.hp = 99999; Game.step(0, 0); }
      ok(Math.max(Math.abs(outside.x - p.x), Math.abs(outside.y - p.y)) > 1,
         '바깥의 것이 못 들어온다',
         `(${was}) → (${outside.x},${outside.y}) · 마법사 (${p.x},${p.y})`);
    }

    /* 그리고 부수는 것. 장벽이 아직 서 있어야 이 줄이 무언가를 잰다. */
    p.ward = G.turn + D.WARD_TURNS;
    const smasher = mk(2, 'smash');
    ok(!!smasher, '   부수는 것도 세웠다', smasher ? `(${smasher.x},${smasher.y})` : '못 세웠다');
    if (smasher) {
      for (let i = 0; i < 8 && G.running && Game.wardUp(p); i++) { p.hp = 99999; Game.step(0, 0); }
      ok(!Game.wardUp(p), '부수는 것이 지나가면 장벽이 깨진다 — 문과 같은 약속이다',
         Game.wardUp(p) ? '아직 서 있다' : '깨졌다');
    }
  }
}

/* ═══ 2. 소스 — 마나가 들어오는 문이 하나인가 ══════════════ */
console.log('\n── 깔때기 (규칙 파일을 글자로)');
{
  const src = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8').split('\n');
  /* 허용되는 넷: 태어날 때 · recalc 의 자름 · gainMana 안 · cast 의 지불.
     그 밖에서 p.mana 를 올리는 줄은 그을음을 새는 문이다. */
  const ALLOW = [
    /p\.hp = p\.maxhp; p\.mana = p\.maxmana;/,          // createHero
    /p\.mana = Math\.min\(p\.mana, p\.maxmana\)/,        // recalc — 자르기
    /p\.mana \+= got/,                                   // gainMana — 그 문
    /p\.mana = Math\.max\(0, p\.mana - cost\)/,          // cast — 지불
  ];
  const leaks = [];
  src.forEach((line, i) => {
    if (!/p\.mana\s*(=[^=]|\+=)/.test(line)) return;
    if (ALLOW.some(re => re.test(line))) return;
    leaks.push(`${i + 1}: ${line.trim()}`);
  });
  ok(!leaks.length,
     'p.mana 에 쓰는 자리가 넷뿐이다 (탄생 · 자름 · gainMana · 지불) — 여덟째 문이 생기면 그을음이 샌다',
     leaks.length ? leaks.join(' / ') : '넷');
  ok(/export function gainMana/.test(src.join('\n')), 'gainMana 가 그 문이다');
}

/* ═══ 3. 폭주 — 예고한 값이 그대로 나가는가 ════════════════ */
console.log('\n── 비전 폭주 (실제 층에서)');
/* `descend()` 는 계단 위에 서 있어야 하므로 층을 손으로 못 만든다.
   봇을 굴려서 「12레벨 · 보이는 것이 둘 이상」인 턴을 잡고 그 순간에
   묻는다 — 마을에서 물으면 시야에 아무것도 없어서 폭주가 **표적이
   없다는 이유로** 거절되고, 그러면 「안 나갔다」를 확인하는 줄들이
   전부 통과로 찍힌다. 실제로 그렇게 한 번 통과했다: 문턱 절과 잔향
   절이 마을에서 돌아 아무것도 안 재고 있었다.

   그래서 fn 이 **실제로 쟀을 때만** true 를 돌려준다. 놓치면 다음 판을
   더 굴린다. */
function atFight(fn, tries = 40) {
  for (let t = 0; t < tries; t++) {
    let done = false;
    Meta.forget();
    runBot('human', 'mage', false, { onTurn: (g) => {
      if (done || !g.player || g.screen !== 'play') return;
      const vis = g.monsters.filter(m => g.level.vis[idx(m.x, m.y)] && !m.disguise);
      if (vis.length < 2 || g.player.lv < SURGE.lv) return;
      done = fn(g, vis) === true;
    } });
    if (done) return true;
  }
  return false;
}

let M = null;
const found = atFight((g, vis) => {
  const p = g.player;
  if (Game.hasRelic('vow')) return false;       // 서약을 든 판은 주문이 안 나간다
  const slot = () => Game.spellSlots().find(s => s.id === 'surge');

  /* ① 문턱 — 태울 것이 모자라면, **맞을 것이 있어도** 안 나간다. */
  p.seared = 0; p.mana = D.SURGE_MIN - 1;
  const thinSlot = slot();
  const thinMana = p.mana;
  Game.cast('surge');
  const thin = { lit: thinSlot.thin && !thinSlot.ready && !thinSlot.noTarget,
                 held: p.mana === thinMana && !p.seared };

  /* ② 잔향을 먹는가. 불씨를 걸어 두고 쏜다. */
  p.seared = 0; p.mana = p.maxmana;
  p.spellPlus = {}; p.spellAffix = {};          // 강화가 실린 통은 예고와 다르다
  p.echo = { from: 'bolt', until: g.turn + D.ECHO_TURNS };
  const echoLit = !!Game.liveEcho(p);
  /* ③ 그리고 값. pow 는 잔향(불씨 +60%)까지 실린 값이어야 예고와 맞는다. */
  const burn = p.mana;
  const pow = Game.spellPower(p, 'surge') * (1 + D.ECHO_POWER);
  const hp0 = vis.map(m => m.hp);
  Game.cast('surge');
  if (p.mana === burn) return false;             // 안 나갔다 — 다른 이유가 있다
  M = { burn, n: vis.length, mana: p.mana, seared: p.seared, turn: g.turn,
        each: Math.max(1, Math.round(burn * D.SURGE_MULT * pow)),
        echoLit, echoLeft: !!Game.liveEcho(p), thin,
        /* 죽은 것은 「적어도 남은 체력만큼」 맞은 것이다 — 죽음을 0으로
           읽으면 예고 검사가 거꾸로 실패한다. */
        hits: vis.map((m, i) => ({ dead: !g.monsters.includes(m),
                                   dmg: g.monsters.includes(m) ? hp0[i] - m.hp : hp0[i] })) };
  return true;
});
ok(found, '실제 층에서 폭주를 잴 판을 찾았다 — 못 찾으면 아래 줄들은 아무것도 안 잰 것이다',
   found ? `${M.n}마리 앞 · 12레벨 이상 · 통 ${M.burn}` : '40판 안에 못 만났다');
if (found) {
  ok(M.mana === 0, '통이 전부 탔다 — 처치로 레벨이 올라도 도로 안 찬다', `${M.burn} → ${M.mana}`);
  /* `M.turn` 은 시전이 끝난 **뒤**의 턴이다(endTurn 이 한 칸 밀었다).
     그을음은 그 턴부터 열 턴을 막아야 하므로 마지막 막히는 턴은
     M.turn + 9 이고, 부등호가 `>=` 이므로 저장된 값이 바로 그것이다. */
  ok(M.seared === M.turn + D.SURGE_DRY - 1, `그을음이 그 턴부터 ${D.SURGE_DRY}턴을 막는다`,
     `turn ${M.turn} → ${M.seared} (마지막 막히는 턴)`);
  const off = M.hits.filter(h => !h.dead && Math.abs(h.dmg - M.each) > 1);
  ok(!off.length,
     `예고한 값이 그대로 나갔다 — 태운 마나 × ${D.SURGE_MULT} × 위력`,
     `통 ${M.burn} → 대상마다 ${M.each} 예고 · 실제 ${M.hits.map(h => h.dead ? `${h.dmg}+죽음` : h.dmg).join('/')}`);
  ok(M.echoLit && !M.echoLeft, '폭주가 잔향을 먹는다 — 불씨를 실으면 그만큼 세게 나간다',
     `${M.echoLit ? '불씨 걸림' : '안 걸림'} → ${M.echoLeft ? '남음' : '먹었다'}`);
  ok(M.thin.lit, `마나 ${D.SURGE_MIN} 아래에서는 칸이 식어 있다 (표적이 아니라 문턱 때문에)`, `thin=${M.thin.lit}`);
  ok(M.thin.held, '문턱 아래에서 눌러도 안 나가고, 안 나갔으므로 그을리지도 않는다', `${M.thin.held}`);
}

/* ═══ 4. 「어떤 식으로도」 ══════════════════════════════════ */
console.log('\n── 그을음');
{
  Meta.forget();
  Game.startGame('human', 'mage', Game.rollStats('mage'));
  const p = G.player;
  p.lv = 14; Game.recalc(p);
  p.seared = G.turn + D.SURGE_DRY;
  p.mana = 0;
  const doors = [
    ['자연 회복 · 지팡이 (gainMana 1)', () => Game.gainMana(p, 1)],
    ['모닥불 · 레벨업 (gainMana 가득)', () => Game.gainMana(p, Infinity)],
    ['마나 물약', () => {
      const before = p.mana, n = p.pack.length;
      Game.addItem(p, Game.makeConsumable('potMana'), 1);
      const i = p.pack.findIndex(s => s.item.use === 'mana');
      Game.useItem(i);
      /* 병이 없어졌는가도 같이 본다 — 값을 치르고 0이 들어가는 것은
         공짜로 거절하는 것과 다른 일이다. */
      const kept = p.pack.some(s => s.item.use === 'mana');
      return (p.mana - before) + (kept ? 0 : 1000);
    }],
  ];
  const leaked = doors.filter(([, f]) => f() !== 0).map(([n]) => n);
  ok(!leaked.length, '그을린 동안 어떤 문으로도 마나가 안 들어온다 — 물약은 열지도 않는다(값만 잃는 것은 고장이다)',
     leaked.length ? `샌 문: ${leaked.join(' · ')}` : `${doors.length}문 다 막혔다`);
  /* 막히는 마지막 턴에도 막히고, 그 다음 턴에는 안 막힌다 — 길이가
     하나 짧거나 하나 긴 것을 잡는 자리다. */
  p.seared = G.turn;
  ok(Game.gainMana(p, 3) === 0, '마지막 막히는 턴에도 막힌다', `seared=${p.seared} turn=${G.turn}`);
  p.seared = G.turn - 1;
  ok(Game.gainMana(p, 3) === 3, '그 다음 턴에는 다시 들어온다', `마나 ${p.mana}`);
}

/* ═══ 5. 잔향 문법 ════════════════════════════════════════ */
console.log('\n── 잔향');
ok(!D.ECHOES.surge, '폭주는 잔향을 남기지 않는다 — 마지막 문장에는 다음 문장이 없다',
   `잔향을 남기는 주문 ${Object.keys(D.ECHOES).length}개 · 폭주는 그중에 없다`);
/* 「먹는가」와 「문턱 아래에서 안 나가는가」는 위의 §비전 폭주 절에서
   실제 층에서 쟀다. 여기 마을 상태로 물으면 시야에 아무것도 없어
   시전이 **표적 없음**으로 거절되고, 그러면 두 줄이 거짓으로 통과한다 —
   처음에 그렇게 써서 두 줄이 아무것도 안 재고 통과했다. */

/* ═══ 6. 효율 — 궁극기가 평상시 주문을 안 잡아먹는가 ═══════ */
console.log('\n── 저울');
{
  /* 폭주가 마나당 효율까지 좋으면 마법사는 판 내내 통을 모아 폭주만
     쏜다 — 그러면 나머지 일곱 칸이 죽는다. 효율은 서리 폭발보다
     **낮아야** 하고, 값은 「한 턴에 시야 전체」로 치른다. */
  const p = G.player;
  p.lv = 12; Game.recalc(p);
  const frost = D.SPELLS_CLASS.mage.find(s => s.id === 'frost');
  const frostEach = 3 * 4.5 + p.lv;                 // roll(3,8) 기대값 + lv
  const perMana = { 폭주: D.SURGE_MULT, 서리: frostEach / frost.cost };
  console.log(`   마나당 피해 — 폭주 ${perMana.폭주.toFixed(1)} · 서리 폭발 ${perMana.서리.toFixed(1)} (대상마다)`);
  ok(perMana.폭주 < perMana.서리,
     '폭주의 마나당 효율이 서리 폭발보다 낮다 — 높으면 마법사가 통을 모으는 일만 하게 된다',
     `${(perMana.폭주 / perMana.서리).toFixed(2)}배`);
  /* 다만 한 방은 훨씬 커야 궁극기다. 통을 다 모은 한 방이 서리 한
     방의 두 배는 넘어야 「끝내는 주문」으로 읽힌다. */
  const full = p.maxmana * D.SURGE_MULT;
  ok(full > frostEach * 2, '통을 다 모은 한 방은 서리 두 방보다 크다 — 아니면 끝내는 주문이 아니다',
     `폭주 ${Math.round(full)} vs 서리 ${Math.round(frostEach)} (lv12 · 통 ${p.maxmana})`);
}

/* ═══ 7. 실측 ═════════════════════════════════════════════ */
const N = Number(process.argv[2] || 8);
const B = 3;
console.log(`\n── 실측 (${B}배치 × ${N}판 · 마법사)`);
const batch = [];
for (let b = 0; b < B; b++) {
  const rows = [];
  for (let i = 0; i < N; i++) rows.push(runBot('human', 'mage', i % 2 === 0));
  const avg = k => rows.reduce((s, r) => s + (r[k] || 0), 0) / rows.length;
  batch.push({ depth: avg('depth'), lv: avg('lv'), surges: avg('surges'), heals: avg('heals') });
}
const m = k => batch.reduce((s, r) => s + r[k], 0) / B;
const spread = Math.max(...batch.map(r => r.depth)) - Math.min(...batch.map(r => r.depth));
console.log(`   도달 ${m('depth').toFixed(1)}층 (폭 ${spread.toFixed(1)}) · Lv ${m('lv').toFixed(1)}`
  + ` · 폭주 ${m('surges').toFixed(1)}회/판 · 치유 ${m('heals').toFixed(1)}회/판`);
/* 12레벨 주문이므로 판당 여러 번은 아니다. 다만 **0이면 안 된다** —
   0은 「칸을 만들었는데 아무도 안 누른다」이고, 그것은 순서 3의 목표를
   못 지킨 것이다. 봇이 12레벨에 닿는 판 자체가 절반쯤이므로 문턱은
   낮게 둔다. */
ok(m('surges') > 0.3, '봇이 폭주를 실제로 쓴다 — 0이면 여덟째 칸은 만들어지지 않은 것이다',
   `${m('surges').toFixed(1)}회/판 (12레벨 주문 · 평균 도달 Lv ${m('lv').toFixed(1)})`);

console.log(bad ? `\n마법사 벤치: ${bad}건 실패\n` : '\n마법사 벤치: 여덟 칸 · 예고한 값 · 새지 않는 그을음\n');
process.exit(bad ? 1 : 0);
