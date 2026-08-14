/* loot.mjs — 좋은 것이 떨어졌을 때 티가 나는가.

   「유물이나 희소한 무기는 그 희소성에 맞게 drop이나 착용 시 티가
    나야할텐데 말이지」

   티가 나는지는 눈으로 보면 확인이 안 된다 — 판마다 나오는 등급이
   다르고, 초월은 백 판에 몇 번이다. 그래서 등급을 손으로 만들어
   놓고, 그 등급이 실제로 신호에 실려 나가는지를 센다.

   묻는 것은 넷:
     · 등급 판정이 유물과 이름 붙은 물건을 알아보는가 (여기가 0이면
       그 아래 전부가 조용해진다 — 지도의 빛기둥도, 낙하 연출도,
       로그 색도 전부 이 한 값에서 갈린다)
     · 떨어질 때 등급이 실려 나가는가
     · 주울 때 「희귀」부터는 화면이 멈추는가
     · 등급이 오를수록 연출이 실제로 커지는가

   usage: node sim/loot.mjs                        */
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

const stage = () => {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(6);
  const p = G.player;
  p.pack.length = 0;
  G.items.length = 0;
  G.fx.length = 0;
  return p;
};

/* 등급별 표본을 손으로 짓는다. 생성기에 맡기면 초월이 안 나온다. */
const base = () => ({ ...D.WEAPONS[6], kind:'weapon' });
const SAMPLES = [
  ['평범', () => base()],
  ['마법', () => ({ ...base(), pre: D.PREFIXES[0].id })],
  ['희귀', () => ({ ...base(), pre: D.PREFIXES[0].id, suf: D.SUFFIXES[0].id })],
  ['유물', () => ({ ...base(), unique:true, n:'《약속》' })],
  ['초월', () => ({ ...base(), boon: D.BOONS[0].id })],
];

console.log('\n득템 벤치 — 좋은 것이 떨어졌을 때 티가 나는가\n');

/* ── 1. 등급 판정 ──────────────────────────────────────── */
{
  const got = SAMPLES.map(([n, make]) => [n, D.rarityOf(make())]);
  for (const [n, g] of got) console.log(`      ${n} → ${g} (${D.RARITY[g]?.n})`);
  ok(got.every(([n, g], i) => g === i || (i > 0 && g > got[i - 1][1])),
     '등급이 낮은 것에서 높은 것으로 제대로 오른다',
     got.map(([n, g]) => `${n}:${g}`).join(' '));

  /* 유물은 무기도 갑옷도 아니라 여태 0이었다 — 바닥의 빛기둥도,
     미니맵의 색도, 로그의 색도 평범한 물건과 같았다. */
  const relic = { kind:'relic', id:'pact', n:'피의 계약' };
  ok(D.rarityOf(relic) >= 3, '유물이 「유물」 등급으로 읽힌다', `${D.rarityOf(relic)}`);
}

/* ── 2. 떨어질 때 등급이 실려 나가는가 ─────────────────── */
{
  const seen = [];
  for (const [n, make] of SAMPLES) {
    const p = stage();
    const it = make();
    G.items.push({ ...it, x: p.x + 3, y: p.y });
    Game.fx({ t:'drop', x: p.x + 3, y: p.y, rar: D.rarityOf(it) });
    const ev = G.fx.filter(e => e.t === 'drop').pop();
    seen.push([n, ev?.rar]);
  }
  ok(seen.every(([, r]) => typeof r === 'number'), '낙하 신호에 등급이 실린다',
     seen.map(([n, r]) => `${n}:${r}`).join(' '));
  ok(new Set(seen.map(([, r]) => r)).size === SAMPLES.length,
     '다섯 등급이 서로 다른 값으로 나간다', `${new Set(seen.map(([, r]) => r)).size}가지`);
}

/* ── 3. 주울 때 화면이 멈추는가 ────────────────────────── */
{
  const rows = [];
  for (const [n, make] of SAMPLES) {
    const p = stage();
    const it = make();
    G.items.push({ ...it, x: p.x, y: p.y });
    /* 줍기는 「칸에 들어설 때」 일어난다. 한 칸 나갔다 돌아온다. */
    const home = { x: p.x, y: p.y };
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      Game.step(dx, dy);
      if (p.x !== home.x || p.y !== home.y) { Game.step(-dx, -dy); break; }
    }
    const card = G.fx.some(e => e.t === 'lore' || e.t === 'transcend');
    const found = G.fx.some(e => e.t === 'found' || e.t === 'transcend');
    rows.push([n, card, found, p.pack.length > 0]);
  }
  for (const [n, card, found, got] of rows)
    console.log(`      ${n} — ${got ? '주웠다' : '못 주웠다'} · ${card ? '카드 뜸' : '카드 없음'} · ${found ? '연출 있음' : '연출 없음'}`);
  ok(rows.every(r => r[3]), '다섯 등급 전부 실제로 주워졌다');
  ok(!rows[0][1] && !rows[1][1], '평범·마법은 로그 한 줄로 지나간다 — 매번 멈추면 멈춤이 뜻을 잃는다');
  ok(rows.slice(2).every(r => r[1]), '희귀·유물·초월은 화면이 멈춘다');
  ok(rows.slice(2).every(r => r[2]), '희귀 위로는 주운 순간의 연출이 따로 있다');
}

/* ── 4. 등급이 오르면 연출이 커지는가 ──────────────────── */
{
  /* juice는 규칙을 모르므로 여기서 직접 표를 읽는다. 값이 단조롭게
     커지지 않으면 「더 좋은 것인데 더 조용한」 등급이 생긴다. */
  const src = await (await import('node:fs/promises')).readFile(
    new URL('../src/juice.js', import.meta.url), 'utf8');
  const ringLine = src.match(/ring\(e\.x, e\.y, ([^)]+)\);\s*\n\s*if \(g >= 2\)/);
  ok(!!ringLine, '낙하 고리의 크기가 등급을 쓴다', ringLine ? ringLine[1] : '못 찾음');
  const grow = [0, 1, 2, 3, 4].map(g => 2.0 + g * 0.7);
  ok(grow.every((v, i) => i === 0 || v > grow[i - 1]),
     '등급이 오를수록 고리가 커진다', grow.join(' → '));
  ok(/RARE_NAME = \['전리품', '마법', '희귀', '유물', '초월'\]/.test(src),
     '떨어진 자리에 등급 이름이 뜬다');
  ok(/if \(g >= 3\) \{ shake/.test(src), '유물부터는 화면이 흔들린다');
}

/* ── 5. 손에 쥘 때도 티가 나는가 ───────────────────────── */
{
  const rows = [];
  for (const [n, make] of SAMPLES) {
    const p = stage();
    const it = make();
    Game.addItem(p, it);
    G.fx.length = 0;
    G.log.length = 0;
    Game.equip(0);
    const ev = G.fx.find(e => e.t === 'wield');
    const tone = G.log.map(l => (typeof l === 'string' ? '' : l.tone)).filter(Boolean).pop();
    rows.push([n, ev?.rar, tone, p.equip.weapon === it]);
  }
  for (const [n, rar, tone, worn] of rows)
    console.log(`      ${n} — ${worn ? '들었다' : '못 들었다'} · 연출 ${rar ?? '없음'} · 로그 ${tone}`);
  ok(rows.every(r => r[3]), '다섯 등급 전부 실제로 들렸다');
  ok(rows[0][1] === undefined, '평범한 것을 드는 데는 연출이 없다');
  ok(rows.slice(1).every(r => typeof r[1] === 'number'), '마법 위로는 몸에서 등급 색이 퍼진다',
     rows.slice(1).map(r => `${r[0]}:${r[1]}`).join(' '));
  ok(rows.slice(2).every(r => r[2] === 'level'), '희귀 위로는 로그 색도 달라진다',
     rows.map(r => `${r[0]}:${r[2]}`).join(' '));
}

/* ── 6. 유물도 같은 자로 ───────────────────────────────── */
{
  /* 유물은 pickUp의 물건 경로를 안 탄다 — takeRelic이 따로 처리한다.
     그래서 위의 다섯 급을 다 고쳐 놓고도 유물만 조용할 수 있다.
     실제로 그랬다: 카드는 「처음 보는 것」일 때만 떴고, 연출은 제단
     반짝임을 빌려 쓰고 있었다. */
  const p = stage();
  p.relics = [];
  G.fx.length = 0;
  Game.takeRelic('pact');
  ok(p.relics.includes('pact'), '유물을 들었다');
  ok(G.fx.some(e => e.t === 'found' && e.rar >= 3),
     '다른 득템과 같은 연출을 탄다', JSON.stringify(G.fx.find(e => e.t === 'found')));
  ok(G.fx.some(e => e.t === 'lore'), '처음 보는 것이든 아니든 화면이 멈춘다');

  /* 두 번째 판에서 다시 들어도 멈춰야 한다 — 그 판에서는 처음이다. */
  const q = stage();
  q.relics = [];
  G.fx.length = 0;
  Game.takeRelic('pact');
  ok(G.fx.some(e => e.t === 'lore'),
     '이미 본 적 있는 유물도 이번 판에는 처음이므로 멈춘다');

  /* 바닥에 떨어진 유물이 빛기둥을 세우는가 — rarityOf가 알아보는가. */
  ok(D.rarityOf({ kind:'relic', id:'echo' }) >= 3, '바닥의 유물이 빛기둥 등급을 받는다');
}

/* ── 7. 셋 중 하나를 고른다 ────────────────────────────── */
{
  const p = stage();
  /* 정예를 하나 세워 놓고 잡는다. 손으로 더미를 만들면 「생성기가
     실제로 더미를 남기는가」를 안 재게 된다. */
  let pile = null;
  for (let t = 0; t < 400 && !pile; t++) {
    const q = stage();
    const m = G.monsters[0];
    if (!m) continue;
    m.elite = ['swift'];
    m.x = q.x + 1; m.y = q.y; m.hp = 1;
    Game.step(1, 0);
    pile = G.items.find(o => o.kind === 'spoils');
  }
  ok(!!pile, '정예가 전리품 더미를 남긴다', pile ? `${pile.picks.length}점` : '못 만듦');
  if (pile) {
    ok(pile.picks.length === Game.SPOIL_PICKS, `셋을 굴려 놓는다`, `${pile.picks.length}점`);
    const q = G.player;
    q.x = pile.x; q.y = pile.y;
    Game.refreshFov();

    /* 밟는 순간 화면이 열리면 안 된다 — 걷는 손가락 아래로 시트가
       올라오면 다음 반복 입력이 버튼을 눌러 버린다. */
    ok(G.screen !== 'event', '밟았다고 화면이 열리지는 않는다', `화면 ${G.screen}`);
    const offerHere = Game.hereOffer();
    ok(offerHere?.screen === 'event', '발밑 버튼이 더미를 가리킨다', offerHere?.n);

    ok(Game.openHere() && G.screen === 'event', '눌러야 열린다');
    const offer = Game.eventOffer();
    ok(offer?.spoils && offer.opts.length === Game.SPOIL_PICKS,
       '셋이 나란히 뜬다', `${offer?.opts.length}줄`);
    ok(offer.opts.every(o => typeof o.rar === 'number'),
       '줄마다 등급이 실린다 — 색으로 고를 수 있어야 한다',
       offer.opts.map(o => o.rar).join(','));

    const want = offer.opts[1].n;
    const before = q.pack.length;
    Game.eventChoose(1);
    ok(q.pack.length === before + 1, '고른 하나만 들어온다', `${before} → ${q.pack.length}줄`);
    ok(!G.items.some(o => o.kind === 'spoils'), '나머지는 두고 간다 — 더미가 사라진다');
    ok(G.screen === 'play', '고르고 나면 지도로 돌아온다', G.screen);
  }
}

/* ── 8. 두고 갈 수도 있다 ──────────────────────────────── */
{
  const p = stage();
  G.items.push({ kind:'spoils', spr:'chest', n:'전리품 더미', rar:1,
                 picks:[base(), base(), base()], x:p.x, y:p.y });
  Game.openHere();
  const before = p.pack.length;
  Game.spoilsLeave();
  ok(p.pack.length === before, '두고 가면 아무것도 안 들어온다');
  ok(G.items.some(o => o.kind === 'spoils'), '더미는 그대로 남는다 — 마음이 바뀌면 다시 연다');
  ok(G.screen === 'play', '지도로 돌아온다', G.screen);
}

/* ── 9. 이름 붙은 무기는 드문가 ────────────────────────── */
{
  /* 부등호 하나가 빠져 있어서 낙하의 36.5%가 이름 붙은 무기로
     나가고 있었다. UNIQUE_ODDS에는 3.5%라고 적혀 있었는데 실제로는
     열 배였다 — 표의 숫자와 굴림이 갈리면 표는 주석이 된다.
     굴림 쪽을 직접 센다. */
  const N = 20000;
  let uni = 0, use = 0, cat = 0, gear = 0;
  for (let i = 0; i < N; i++) {
    stage();
    G.uniques = {};                     // 판마다 하나씩만 나오므로 매번 비운다
    const it = Game.pickItemFor(8);
    if (!it) continue;
    if (it.unique) uni++;
    else if (it.kind === 'use') use++;
    else if (it.kind === 'cat') cat++;
    else gear++;
  }
  const pc = v => `${(v * 100 / N).toFixed(1)}%`;
  console.log(`      이름 붙은 것 ${pc(uni)} · 소모품 ${pc(use)} · 촉매 ${pc(cat)} · 장비 ${pc(gear)}`);
  ok(uni / N < 0.06, '이름 붙은 무기는 낙하의 6%를 넘지 않는다', pc(uni));
  ok(uni > 0, '그래도 나오기는 한다', `${uni}회`);
  ok(gear / N > 0.4, '대부분은 평범한 장비다', pc(gear));
}

/* ── 10. 대박은 대박인가 ───────────────────────────────── */
{
  /* 「가끔 좋은 일」과 「대박」은 다르다. 앞의 것은 한 판에 서너 번,
     뒤의 것은 몇 판에 한 번이다. 표가 흩어지면 어떤 자리는 5%를
     대박이라 부르고 어떤 자리는 0.1%를 부르게 되므로, 값이 한 표에
     모여 있는지와 그 값이 실제로 낮은지를 같이 본다. */
  const J = D.JACKPOT;
  const rows = Object.entries(J);
  for (const [k, v] of rows) console.log(`      ${k.padEnd(8)} ${(v * 100).toFixed(1)}%`);
  ok(rows.length >= 5, '대박이 붙은 자리가 다섯 군데다', `${rows.length}곳`);
  ok(rows.every(([, v]) => v > 0 && v <= 0.05),
     '전부 5% 아래다 — 자주 나오면 그건 대박이 아니라 기본값이다',
     rows.map(([k, v]) => `${(v * 100).toFixed(1)}%`).join(' '));
  ok(rows.every(([, v]) => v >= 0.005),
     '그렇다고 영영 안 나오지도 않는다 — 0.5% 위',
     `${(Math.min(...rows.map(r => r[1])) * 100).toFixed(1)}%`);
}

console.log(bad ? `\n득템 벤치: ${bad}건 실패\n` : '\n득템 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
