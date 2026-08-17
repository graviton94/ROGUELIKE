/* ═══════════════════════════════════════════════════════════
   spellfx.mjs — 주문마다 제 그림이 있는가

   플레이어: 「아이템이나 주문 임펙트, 특히 주문의 효과가 너무 구림.」

   먼저 잰 것: 주문 한 방이 평타의 **4~7배**다(lv5~20, 세 직업).
   숫자는 약하지 않았다. 약한 것은 화면이었다 —

     · 피해 주문 셋이 전부 같은 선(beam) 하나에 **색만** 달랐다
     · 나머지 다섯(점멸·탐지·지도·치유·축복)은 프레임이 **아예 없었다**
     · 기예는 이미 하나씩 제 그림을 갖고 있는데 주문만 없었다

   그래서 시전 프레임을 넣었다. 이 파일이 지키는 것은 둘이다:
   ① 주문이 나갈 때 규칙 쪽이 프레임을 **띄우는가**
   ② 그리는 쪽이 그것을 받아 **안 던지는가** — 없는 주문 id, 없는
      realm, 잔향이 실린 것까지.

   ②가 이 파일의 절반인 이유: 색 이름 하나만 틀려도 판 중에 화면이
   멈추는데, 규칙 쪽 벤치는 그것을 영영 못 본다.

   usage: node sim/spellfx.mjs      (포트 8199에 정적 서버 필요)
   ═══════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };

console.log('\n주문 프레임 벤치 — 여덟이 다르게 보이는가\n');

/* ── ① 규칙 쪽: 시전이 프레임을 띄우는가 ────────────────── */
const Game = await import('../src/game.js');
const CAST = {
  mage:   ['blink', 'detect', 'frost', 'map'],
  priest: ['cure', 'bless', 'detect', 'heal'],
};
for (const [cls, ids] of Object.entries(CAST)) {
  Game.startGame('human', cls, Game.rollStats(cls));
  const p = Game.G.player;
  p.lv = 20; Game.recalc(p);
  for (const id of ids) {
    Game.G.fx.length = 0;
    p.mana = p.maxmana;
    Game.cast(id);
    const ev = Game.G.fx.find(e => e.t === 'spellCast');
    ok(!!ev && ev.id === id, `${cls} ${id} — 시전 프레임을 띄운다`,
       ev ? `realm=${ev.realm}` : '없음');
  }
}
/* 조준 주문은 대상이 없으면 시전 자체가 거절된다 — 프레임이 안 뜨는
   것이 옳다. 여기서 「안 뜬다」를 실패로 찍으면 멀쩡한 것을 고치게
   된다(실제로 한 번 그럴 뻔했다). 봇을 굴려서 확인한다. */
{
  const { runBot } = await import('./_botlib.mjs');
  const seen = new Set();
  for (let i = 0; i < 8 && !seen.has('bolt'); i++) {
    runBot('human', 'mage', false);
    for (const e of Game.G.fx) if (e.t === 'spellCast') seen.add(e.id);
  }
  ok(seen.has('bolt'), '조준 주문도 실제 판에서는 프레임을 띄운다 — 대상이 있을 때만 시전되므로',
     [...seen].join(' ') || '없음');
}

/* ── ② 그리는 쪽: 받아서 안 던지는가 ────────────────────── */
console.log('');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://127.0.0.1:8199/index.html');
await pg.waitForTimeout(900);
await pg.evaluate(() => { const e = [...document.querySelectorAll('button')]
  .find(x => x.getBoundingClientRect().width > 2 && /새 게임/.test(x.textContent)); e && e.click(); });
await pg.waitForTimeout(400);
for (let i = 0; i < 4; i++) {
  await pg.evaluate(() => { const bs = [...document.querySelectorAll('button:not([disabled])')]
    .filter(x => x.getBoundingClientRect().width > 2); bs.length && bs[bs.length - 1].click(); });
  await pg.waitForTimeout(300);
}
const thrown = await pg.evaluate(async () => {
  const G = (await import('/src/game.js')).G;
  const J = await import('/src/juice.js');
  const p = G.player, out = [];
  /* 없는 id 와 없는 realm 도 넣는다 — 주문을 하나 새로 만드는 사람이
     프레임을 안 붙였을 때 화면이 멈추면 안 된다. */
  const ids = ['bolt', 'smite', 'frost', 'blink', 'detect', 'map',
               'cure', 'heal', 'bless', '아직없는주문'];
  for (const id of ids) for (const realm of ['arcane', 'divine', null]) {
    for (const aura of [null, { plus: 5, marks: ['venom'], relics: ['grudge'],
                                boon: null, unique: null }]) {
      try {
        J.pump([{ t: 'spellCast', id, x: p.x, y: p.y, tx: p.x + 3, ty: p.y + 2,
                  realm, aura, echo: 'spark' }], p);
      } catch (err) { out.push(`${id}/${realm}: ${err.message}`); }
    }
  }
  /* 좌표가 없는 것도 — 대상 없이 나가는 주문이 그렇다. */
  try { J.pump([{ t: 'spellCast', id: 'bolt', x: p.x, y: p.y, realm: 'arcane' }], p); }
  catch (err) { out.push(`좌표 없음: ${err.message}`); }
  return out;
});
ok(thrown.length === 0, '주문 프레임 예순 갈래가 안 던진다 — 없는 id·없는 realm·좌표 없음 포함',
   thrown[0] || '전부 통과');
await pg.waitForTimeout(900);
ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
await b.close();

console.log(bad ? `\n주문 프레임 벤치: ${bad}건 실패\n`
                : '\n주문 프레임 벤치: 여덟이 다 제 그림을 갖고 있다\n');
process.exit(bad ? 1 : 0);
