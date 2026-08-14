/* forge.mjs — 모루가 정합적인가, 그리고 충분히 극단적인가.

   「유물급 고유명사 아이템은 인챈트 재료만 먹고 안됨」

   재 보니 그보다 나빴다. 화면은 이름 붙은 물건을 `capped: true`로
   막아 놓고 「최대 +8」이라고 적었는데(+0인 물건에 대고 하는
   거짓말이다), 규칙 쪽에는 unique 검사가 아예 없어서 《약속》이
   강화도 되고 인챈트도 먹었다 — 데이터에 「접사가 붙지 않고,
   벼려지지 않는다」고 적어 둔 바로 그 물건이.

   그래서 두 가지를 잰다:
     · 정합성 — 화면이 읽는 이유와 규칙이 쓰는 판정이 같은가,
       그리고 막을 때 **값을 치르기 전에** 막는가
     · 극단 — 위쪽 칸이 실제로 벼랑인가, 아래쪽은 그대로인가

   usage: node sim/forge.mjs [시행=4000]              */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const G = Game.G;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

function stage(weapon) {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(6);
  const p = G.player;
  p.equip.weapon = weapon;
  p.mats = { scrap: 99999, dust: 99999, essence: 99999 };
  p.gold = 9999999;
  Game.recalc(p);
  G.log.length = 0;
  return p;
}
const plain = (over = {}) => ({ ...D.WEAPONS[6], kind:'weapon', ...over });
const named = () => ({ kind:'weapon', unique:'promise', ...D.uniqueById('promise') });
const purse = p => [p.gold, p.mats.scrap, p.mats.dust, p.mats.essence].join('/');

console.log('\n모루 벤치 — 정합적인가, 그리고 극단적인가\n');

/* ── 1. 이름 붙은 것은 어느 문으로도 안 들어간다 ─────────── */
{
  const p = stage(named());
  const before = purse(p);
  const rows = [];
  for (const [n, run] of [['강화', () => Game.anvilStrike('eq:weapon', false)],
                          ['신중 강화', () => Game.anvilStrike('eq:weapon', true)],
                          ['인챈트', () => Game.anvilEnchant('eq:weapon', false)],
                          ['재련', () => Game.anvilEnchant('eq:weapon', true)]]) {
    G.log.length = 0;
    run();
    rows.push([n, (G.log.pop() || {}).text || '']);
  }
  const it = p.equip.weapon;
  for (const [n, line] of rows) console.log(`      ${n} — 「${line}」`);
  ok(purse(p) === before, '재료도 금화도 한 톨 안 나갔다', `${before} → ${purse(p)}`);
  ok(!it.plus && !it.pre && !it.suf, '물건은 그대로다',
     JSON.stringify({ plus: it.plus, pre: it.pre, suf: it.suf }));
  ok(rows.every(r => /이름이 붙은/.test(r[1])), '네 문 전부 같은 이유를 말한다');

  /* 화면이 읽는 값과 규칙이 쓰는 값이 같은 함수에서 나오는가. */
  const t = Game.campTargets().find(x => x.key === 'eq:weapon');
  ok(t.block.upgrade && t.block.enchant && t.block.reroll,
     '화면도 같은 이유를 읽는다', t.block.upgrade);
  ok(t.block.upgrade === Game.forgeBlock({ type:'item', item: it }, 'upgrade'),
     '화면의 이유와 규칙의 판정이 같은 자리에서 나온다');
}

/* ── 2. 평범한 물건은 여전히 들어간다 ──────────────────── */
{
  const p = stage(plain());
  const before = p.gold;
  Game.anvilStrike('eq:weapon', false);
  ok((p.equip.weapon.plus || 0) > 0, '평범한 무기는 +0에서 반드시 오른다',
     `+${p.equip.weapon.plus}`);
  ok(p.gold < before, '값은 치렀다', `${before} → ${p.gold}`);
  const t = Game.campTargets().find(x => x.key === 'eq:weapon');
  ok(!t.block.upgrade && !t.block.enchant, '막힌 이유가 없다');
}

/* ── 3. 속성이 없으면 재련만 막힌다 ────────────────────── */
{
  const p = stage(plain());
  const t0 = Game.campTargets().find(x => x.key === 'eq:weapon');
  ok(!!t0.block.reroll && !t0.block.enchant,
     '붙은 것이 없으면 재련은 막히고 인챈트는 열린다', t0.block.reroll);
  const before = purse(p);
  Game.anvilEnchant('eq:weapon', true);
  ok(purse(p) === before, '막힌 재련은 값을 안 먹는다', `${before} → ${purse(p)}`);
}

/* ── 4. 천장과 벼랑 ────────────────────────────────────── */
{
  const N = Number(process.argv[2] || 4000);
  console.log(`\n  강화 한 방의 결과 (각 ${N}번):`);
  const header = '      +N   성공   두단계  세단계  −1     파괴   저주';
  console.log(header);
  for (const plus of [0, 3, 5, 7, 9]) {
    let up = 0, two = 0, three = 0, down = 0, broke = 0, hex = 0;
    for (let i = 0; i < N; i++) {
      const p = stage(plain({ plus }));
      Game.anvilStrike('eq:weapon', false);
      const it = p.equip.weapon;
      if (!it) { broke++; continue; }
      const d = (it.plus || 0) - plus;
      if (d >= 3) { three++; up++; } else if (d === 2) { two++; up++; }
      else if (d === 1) up++;
      else if (d < 0) down++;
      if (it.pre || it.suf) hex++;          // 실패로 앉은 검은 것
    }
    const pc = v => `${(v * 100 / N).toFixed(1)}%`.padStart(6);
    console.log(`      +${String(plus).padEnd(2)} ${pc(up)} ${pc(two)} ${pc(three)} ${pc(down)} ${pc(broke)} ${pc(hex)}`);
    if (plus === 0) ok(up === N, '+0은 반드시 오른다 — 처음 만나는 화면에서 실패를 가르치지 않는다', pc(up));
    /* 세 단계는 여기서 본다. +9에서 재면 영원히 0이 나오는데, 그건
       규칙이 아니라 천장이다 — min(cap, plus+3)이 +10에서 잘리므로
       올라간 폭이 1로 읽힌다. 머리 위 공간이 있는 자리에서 물어야
       한다. (처음에 +9에 대고 물었다가 붉게 떴다.) */
    if (plus === 5) {
      ok(three > 0, '머리 위 공간이 있으면 세 단계가 나온다 — 그것이 위쪽을 치는 이유다',
         `${three}회 / ${N}`);
      ok(down / N > 0.3, '+5부터는 실패가 한 단계를 깎는다', pc(down));
    }
    if (plus === 9) {
      ok(up / N < 0.25, '+9는 네 번에 한 번도 안 된다', pc(up));
      ok(broke / N > 0.2, '+9에서 실패하면 절반 가까이가 파괴다', pc(broke));
      ok(hex / N > 0.05, '그리고 망가진 채로 남을 수 있다', pc(hex));
    }
  }
  ok(Game.MAX_PLUS === 10, '천장이 +10이다', `+${Game.MAX_PLUS}`);
  const p = stage(plain({ plus: 10 }));
  const before = purse(p);
  Game.anvilStrike('eq:weapon', false);
  ok(purse(p) === before, '천장에 닿으면 값을 안 먹는다', `${before} → ${purse(p)}`);
}

/* ── 5. 인챈트는 붙을수록 위험하다 ─────────────────────── */
{
  const N = 3000;
  console.log('\n  인챈트에서 저주가 붙는 비율:');
  const rates = [];
  for (const [n, over] of [['빈 물건', {}],
                           ['하나 붙음', { pre: D.PREFIXES.find(a => !a.curse).id }],
                           ['둘 붙음', { pre: D.PREFIXES.find(a => !a.curse).id,
                                        suf: D.SUFFIXES.find(a => !a.curse).id }]]) {
    let cursed = 0;
    for (let i = 0; i < N; i++) {
      const p = stage(plain({ ...over }));
      G.log.length = 0;
      Game.anvilEnchant('eq:weapon', false);
      if (G.log.some(l => /검은 연기/.test(l.text || ''))) cursed++;
    }
    rates.push(cursed / N);
    console.log(`      ${n.padEnd(8)} ${(cursed * 100 / N).toFixed(1)}%`);
  }
  ok(rates[0] < rates[1] && rates[1] < rates[2],
     '이미 붙은 것이 많을수록 저주가 잦다', rates.map(r => `${(r * 100) | 0}%`).join(' < '));
  ok(rates[0] > 0.14 && rates[0] < 0.27, '빈 물건은 여전히 다섯에 하나쯤',
     `${(rates[0] * 100).toFixed(1)}%`);
}

console.log(bad ? `\n모루 벤치: ${bad}건 실패\n` : '\n모루 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
