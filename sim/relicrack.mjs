/* ═══════════════════════════════════════════════════════════
   relicrack.mjs — 유물 마흔 개가 판 중반부터 배경이었다

   유물은 이 게임에서 규칙을 바꾸는 유일한 물건인데, 주우면 그 줄이
   끝이었다. 피의 계약은 판이 끝날 때까지 −25%/+20%p이고 저울추는
   끝까지 「30% 아래 +60%」다. 일곱 칸을 채우고 나면 유물 쪽에서
   더 일어날 일이 없다 — 그래서 후반의 유물 칸은 스탯 창이다.

   크랙은 **그 유물을 쓴 만큼** 열린다. 이 파일이 묻는 것은 셋이다:

     1. 마흔 개가 전부 크랙을 갖고 있고, 조건이 읽히는가
     2. 열리면 정말 다른 물건이 되는가 (숫자로)
     3. **거저 열리지 않는가** — 이게 제일 중요하다. 문턱이 낮으면
        크랙은 「나중에 자동으로 켜지는 줄」이고, 그건 크랙이 아니라
        지연된 기본값이다.

   3번을 재는 방법이 두 번 틀렸다. 처음엔 「봇 100판에서 몇 개나
   열리나」를 쟀는데, 봇은 유물을 고르지 않고 주는 대로 받으므로
   그건 크랙이 아니라 드롭을 잰 것이었다. 그다음엔 조건 숫자만
   비교했는데, kill 60과 floor 6은 단위가 달라 비교가 안 된다.
   지금 재는 것은 **판당 각 장부가 실제로 얼마나 차는가**이고,
   그 분포와 문턱을 나란히 놓는다.

   ── 자의 흔들림을 적어 둔다 ──
   총합의 중앙값으로 쟀더니 같은 코드에서 kill이 91·64·41로 나왔다.
   장부가 흔들린 것이 아니라 **봇이 6~10층까지 제각각 갔던 것**이고,
   그걸 장부의 성질로 읽으면 유물 문턱을 잡음에 맞춰 깎게 된다.
   층당으로 나눠 12층으로 곱하니 92·93·83으로 앉았다.

   그래도 gold는 여전히 꼬리가 길다(9136·8532·4601) — 금화는 한 번의
   운으로 배가 되는 장부라 중앙값도 안 잡힌다. 금화를 조건으로 쓰는
   셋(깃펜·가면·동전)의 문턱은 이 숫자를 ±10% 따라가지 말 것.

   usage: node sim/relicrack.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('/home/user/ROGUELIKE/src/meta.js');
const Game = await import('/home/user/ROGUELIKE/src/game.js');
const D    = await import('/home/user/ROGUELIKE/src/data.js');
const W    = await import('/home/user/ROGUELIKE/src/world.js');
const { runBot } = await import('/home/user/ROGUELIKE/sim/_botlib.mjs');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

function stage(cls = 'warrior') {
  Meta.forget();
  Game.startGame('human', cls, Game.rollStats(cls));
  Game.descend(); Game.enterDepth(6);
  const L = G.level, p = G.player;
  for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = W.ROCK;
  for (let x = 3; x <= 40; x++) L.tiles[W.idx(x, 12)] = W.FLOOR;
  p.x = 10; p.y = 12; p.lightTurns = 900; p.hp = p.maxhp;
  G.monsters.length = 0;
  Game.recalc(p); Game.refreshFov();
  return p;
}
/* 크랙만 켠 채로 재는 자. 조건을 실제로 채우면 그 과정이 다른
   숫자(레벨·장비)를 같이 움직여서, 재려는 것이 무엇이었는지 알 수
   없게 된다 — 여기서는 스위치만 켠다. 켜는 조건 자체는 아래 세 번째
   절에서 따로 판다. */
const wear = (p, id, on) => { p.relics = [id]; G.cracks = on ? { [id]:1 } : {}; Game.recalc(p); };

console.log('\n유물 크랙 벤치 — 마흔 개가 두 번째 줄을 갖는가\n');

/* ── 1. 표가 완전한가 ─────────────────────────────────── */
{
  const miss = D.RELICS.filter(r => !D.crackOf(r.id));
  ok(miss.length === 0, '유물 마흔 개가 전부 크랙을 갖는다',
     miss.length ? miss.map(r => r.id).join(',') : `${D.RELICS.length}/${D.RELICS.length}`);
  const cats = {};
  for (const r of D.RELICS) { const c = D.crackOf(r.id); if (c) cats[c.c] = (cats[c.c]||0)+1; }
  /* 한 갈래로 몰리면 크랙이 「대가 삭제 패치」가 된다. 실제로 초안이
     ②로 스물두 개였고, 그러면 마흔 개가 전부 같은 사건이 된다. */
  const worst = Math.max(...Object.values(cats));
  ok(worst <= D.RELICS.length * 0.5,
     '세 갈래 중 하나로 몰려 있지 않다 — 몰리면 크랙이 일괄 상향이 된다',
     Object.entries(cats).map(([k,v]) => `${k}${v}`).join(' '));
  const noWord = D.RELICS.filter(r => !D.crackNeed(r.id));
  ok(noWord.length === 0, '조건이 전부 사람이 읽는 말로 적힌다',
     noWord.length ? noWord.map(r=>r.id).join(',') : D.crackNeed('scale'));
}

/* ── 2. 열리면 다른 물건이 되는가 ──────────────────────── */
console.log('');
{
  const p = stage();
  /* ② 피의 계약 — 천장이 돌아온다 */
  wear(p, 'pact', false); const lowRoof = p.maxhp, crit0 = Game.critChance(p);
  wear(p, 'pact', true);
  ok(p.maxhp > lowRoof && Math.abs(Game.critChance(p) - crit0) < 1e-9,
     '② 피의 계약 — 치명은 남고 최대 체력이 돌아온다', `${lowRoof} → ${p.maxhp}`);

  /* ① 저울추 — 문턱과 배수가 같이 커진다 */
  p.hp = Math.round(p.maxhp * 0.45);
  wear(p, 'scale', false); const off = Game.gearBonus(p).dmgPct;
  wear(p, 'scale', true);  const on  = Game.gearBonus(p).dmgPct;
  ok(off === 0 && on >= 1.2,
     '① 저울추 — 45%에서는 원래 안 켜지고, 크랙이 나면 켜지면서 두 배다',
     `${off} → ${on}`);
  p.hp = p.maxhp;

  /* ③ 거인의 손아귀 — 민첩을 읽으러 온 쪽이 힘을 받아 간다 */
  wear(p, 'grip', false); const dexOff = Game.statB(p, 'dex');
  wear(p, 'grip', true);  const dexOn  = Game.statB(p, 'dex');
  ok(Game.effStats(p).dex === 6 && dexOn > dexOff,
     '③ 거인의 손아귀 — 판에 적힌 민첩은 6인 채로, 6을 읽는 쪽이 20을 받는다',
     `보너스 ${dexOff} → ${dexOn}`);

  /* ① 무모함의 인장 — 배수만 커지고 명중은 그대로 깎인 채다 */
  wear(p, 'reckless', false); const m0 = Game.critMult(p), h0 = Game.gearBonus(p).hitPct;
  wear(p, 'reckless', true);  const m1 = Game.critMult(p), h1 = Game.gearBonus(p).hitPct;
  ok(m1 > m0 && Math.abs(h1 - h0) < 1e-9,
     '① 무모함 — 배수는 커지고 명중은 여전히 깎인 채다(①은 대가를 안 지운다)',
     `×${m0.toFixed(2)} → ×${m1.toFixed(2)}`);

  /* ① 꺼지지 않는 등 — 좁아지던 것이 넓어진다 */
  wear(p, 'lamp', false); const r0 = Game.gearBonus(p).lightR;
  wear(p, 'lamp', true);  const r1 = Game.gearBonus(p).lightR;
  ok(r0 < 0 && r1 > 0, '① 꺼지지 않는 등 — 부호가 뒤집힌다', `${r0} → ${r1}`);

  /* ③ 사슬 갑주 — 층마다 첫 한 대가 0이다 */
  wear(p, 'chain', true); G.chainGuard = 0; p.hp = p.maxhp;
  const t1 = Game.hurtPlayer(30, { by:'벤치' });
  const t2 = Game.hurtPlayer(30, { by:'벤치' });
  ok(t1 === 0 && t2 > 0, '③ 사슬 갑주 — 첫 한 대만 사슬이 받는다', `${t1} · ${t2}`);
  Game.enterDepth(7);
  ok(G.chainGuard === 0, '③ 그리고 층이 바뀌면 사슬이 다시 선다');
}

/* ── 3. 거저 열리지 않는가 ─────────────────────────────
   판당 각 장부가 얼마나 차는지를 봇으로 재고, 문턱과 나란히 둔다.
   여기서 「전부 열린다」가 나오면 크랙은 지연된 기본값이다.        */
console.log('');
const KINDS = ['kill','crit','hit','spell','gulp','trap','combo','elite','gold'];
/* 처음에 전사 마흔 판으로 쟀더니 spell 중앙값이 0이었다. 전사는
   주문을 안 쓴다 — 그건 세계가 아니라 자가 「주문을 안 세는 봇」이라는
   뜻이다. 직업을 갈라서 재고, 각 장부는 **그것을 실제로 쓰는 직업**의
   중앙값으로 읽는다. 그리고 8층이 아니라 12층까지 민다: 크랙은
   판 중반에 열리라고 만든 것이라, 판을 반만 재면 전부 「못 연다」로
   나온다. */
const byCls = { warrior: [], mage: [] };
for (const cls of ['warrior', 'mage'])
  for (let i = 0; i < 20; i++) {
    runBot('human', cls, 12, { seed: i });
    const l = { ...(G.ledger || {}) };
    l.floor = G.deepest || 0;
    byCls[cls].push(l);
  }
/* 총합의 중앙값으로 재면 자가 못 쓸 만큼 흔들린다 — 같은 코드로 세 번
   재서 kill이 91·64·41로 나왔다. 원인은 장부가 아니라 **봇이 몇 층까지
   갔느냐**였다(도달 6~10층). 그래서 층으로 나눠서 재고 12층으로 곱한다:
   「12층까지 갔다면 이 장부가 얼마나 찼겠는가」. 분자에서 도달 깊이의
   흔들림이 빠지면 남는 것이 그 장부의 성질이다. */
const PROJECT = 12;
const mid = (rows, k) => {
  const v = rows.map(r => (r[k] || 0) / Math.max(1, r.floor)).sort((a,b) => a-b);
  return Math.round(v[v.length >> 1] * PROJECT);
};
/* 그 장부를 더 많이 채우는 쪽을 그 장부의 대표로 삼는다. */
const med = k => k === 'floor' ? PROJECT
             : Math.max(mid(byCls.warrior, k), mid(byCls.mage, k));
const depths = [...byCls.warrior, ...byCls.mage].map(r => r.floor).sort((a,b)=>a-b);
console.log(`  봇 도달 깊이 ${depths[0]}~${depths[depths.length-1]}층`
  + ` (중앙 ${depths[depths.length>>1]}) — 그래서 총합이 아니라 층당으로 잰다`);
console.log(`  ${PROJECT}층까지 갔다면 장부가 이만큼 (전사 20판 · 마법사 20판, 높은 쪽)`);
for (const k of [...KINDS, 'floor'])
  console.log(`    ${k.padEnd(6)} ${String(med(k)).padStart(5)}`);

/* 문턱을 넘긴 유물이 몇 개인가 — 유물마다 그 판에 끼고 있었다고
   가정한 상한이다. 실제로는 일곱 칸뿐이라 이보다 훨씬 적게 열린다. */
console.log('');
const openable = [];
for (const r of D.RELICS) {
  const c = D.crackOf(r.id);
  if (!c || c.at[0] === 'fused') continue;
  const [k, n] = c.at;
  if (med(k) >= n) openable.push(r.id);
}
const gated = D.RELICS.filter(r => D.crackOf(r.id)?.at[0] !== 'fused').length;
/* 읽는 법: 이 숫자는 「그 유물을 12층 내내 끼고 있었다면 깨졌겠는가」다.
   일곱 칸뿐이므로 실제 한 판에서 깨지는 수는 이보다 훨씬 적다. 목표는
   절반쯤 — 끝까지 끼고 논 유물은 깨져야 하고, 그냥 주워 둔 것은 안
   깨져야 한다. 세 번 재서 20·18·17이 나왔다(층당으로 재기 전에는
   28·10·0이었다). */
ok(openable.length <= gated * 0.7,
   '끝까지 끼고 있어도 전부 깨지지는 않는다 — 전부 깨지면 크랙이 아니라 지연된 기본값이다',
   `${openable.length}/${gated}`);
ok(openable.length >= gated * 0.25,
   '그러나 아무것도 안 열리지는 않는다 — 못 보는 두 번째 줄은 없는 줄이다',
   openable.length ? openable.join(' ') : '없음');

/* 융합 유물은 불에서 나오는 순간 깨져 있어야 한다. */
{
  const p = stage();
  p.relics = []; G.cracks = {};
  Game.takeRelic('march');
  ok(Game.cracked('march'), '융합 유물은 든 순간부터 깨져 있다');
}

console.log(bad ? `\n유물 크랙 벤치: ${bad}건 실패\n`
                : '\n유물 크랙 벤치: 마흔 개가 두 번째 줄을 갖는다\n');
process.exit(bad ? 1 : 0);
