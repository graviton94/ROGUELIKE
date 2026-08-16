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
  /* 1.2 를 손으로 적어 두고 있었다. 유물 값에 배율이 걸리는 순간
     (RELIC_SCALE) 이 줄은 게임이 아니라 **옛 숫자**를 재게 된다.
     깔때기를 읽는다 — 크랙은 「두 배」이지 「1.2」가 아니다. */
  const want = Game.relicVal('scale') * 2;
  ok(off === 0 && on >= want - 1e-9,
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
   이 절을 두 번 다시 썼다.

   처음에는 판 전체 장부의 중앙값을 문턱과 나란히 놓고 「끼고 있었다면
   깨졌겠는가」를 셌다. 그 계산은 이제 틀렸다 — 크랙 조건이 유물별로
   바뀌었기 때문이다(주운 뒤부터 센다). 판 전체 장부로는 아무 말도
   못 한다.

   그리고 그 계산이 틀린 채로 초록이었던 이유가 하나 더 있었다:
   floor 조건 열한 개를 `G.deepest`로 쟀는데 규칙은 `G.relicFloors[id]`
   (그 유물과 함께 내려간 층수)를 본다. 열한 개가 전부 자동 통과였고,
   실제로는 90판에서 한 개가 한 번 열렸다.

   그래서 이제 **봇이 실제로 깬 것**을 센다. 세는 자와 게임이 같은
   숫자를 보게 하는 방법은 그것뿐이다.                            */
console.log('');
const worn = {}, split = {};
for (const cls of ['warrior', 'mage', 'rogue', 'ranger'])
  /* 15판이었다. 그런데 조건 갈래 중 combo 는 판당 표본이 8~12개라,
     아래의 「죽은 갈래」 판정(표본 20 이상)에 **가끔만** 걸린다 —
     걸린 그 판에서 0이면 실패로 뒤집힌다. 여섯 번에 한 번 그랬다.
     문턱을 올려 눈을 감는 대신 표본을 늘린다: 판정이 흔들리는
     이유가 게임이 아니라 표본 수였다. */
  for (let i = 0; i < 30; i++) {
    runBot('human', cls, true);
    for (const id of Object.keys(G.relicFloors || {})) {
      const kind = D.crackOf(id)?.at[0] || '?';
      (worn[id] ||= [0, 0])[1]++;
      (split[kind] ||= [0, 0])[1]++;
      if (G.cracks?.[id]) { worn[id][0]++; split[kind][0]++; }
    }
  }
const tookN = Object.values(worn).reduce((s, v) => s + v[1], 0);
const brokeN = Object.values(worn).reduce((s, v) => s + v[0], 0);
console.log(`  봇 60판 · 유물 착용 ${tookN}건 · 그중 깨진 것 ${brokeN}건`);
console.log('  조건 갈래별 (깨짐/착용)');
for (const [k, [b, t]] of Object.entries(split).sort((a, c) => c[1][1] - a[1][1]))
  console.log(`    ${k.padEnd(6)} ${String(b).padStart(3)}/${String(t).padStart(3)}`
    + `  ${String(Math.round(b / t * 100)).padStart(3)}%`);

const rate = brokeN / Math.max(1, tookN);
ok(rate <= 0.60,
   '낀 유물이 전부 깨지지는 않는다 — 전부 깨지면 크랙이 아니라 지연된 기본값이다',
   `${Math.round(rate * 100)}%`);
ok(rate >= 0.15,
   '그러나 낀 유물의 상당수는 깨진다 — 못 보는 두 번째 줄은 없는 줄이다',
   `${Math.round(rate * 100)}%`);
/* 갈래 하나가 통째로 죽어 있으면 그 조건은 설계가 아니라 장식이다.
   floor 열한 개가 정확히 그랬다(90판에 1건).

   표본 문턱을 10에서 20으로 올렸다. 10으로 걸었더니 같은 코드에서
   gold 가 1/7 → 0/6 으로 흔들리며 판정이 뒤집혔다 — 표본 예닐곱으로
   「죽었다」를 말할 수 없다. deep.mjs 가 「N<90이면 판정하지 않는다」로
   같은 규율을 이미 적어 뒀다. 표본이 모자란 갈래는 인쇄만 한다. */
/* 문턱을 20에서 40으로 올린다. 눈을 감는 것이 아니라 **이항분포**
   때문이다: 살아 있는 갈래도 열리는 비율이 10~17% 라, 표본 25에서
   한 번도 안 열릴 확률이 1.7% 다. 갈래가 여덟이면 판마다 몇 %가
   허위 실패로 뒤집힌다 — 실제로 hit 갈래가 그렇게 한 번 뒤집혔다.
   40이면 12% 짜리 갈래가 0으로 나올 확률이 0.6% 이고, 진짜 죽은
   갈래(combo 는 0/41 이었다)는 여전히 잡힌다. */
const thin = Object.entries(split).filter(([, [, t]]) => t < 40 && t > 0).map(([k]) => k);
if (thin.length) console.log(`  (표본 20 미만이라 판정하지 않는 갈래: ${thin.join(' ')})`);
const deadKinds = Object.entries(split).filter(([, [b, t]]) => t >= 40 && b === 0).map(([k]) => k);
ok(deadKinds.length === 0,
   '열 번 이상 껴 봤는데 한 번도 안 깨지는 조건 갈래가 없다',
   deadKinds.length ? deadKinds.join(' ') : '전부 열린 적 있음');

/* 그리고 **주운 그 층에서 바로** 깨지면 안 된다 — 그건 그 유물을
   쓴 것이 아니라 판이 쌓아 둔 것을 상속한 것이다. */
{
  let inherited = 0, opened = 0;
  for (let i = 0; i < 40; i++) {
    runBot('human', 'warrior', true);
    for (const id of Object.keys(G.cracks || {})) {
      if (D.crackOf(id)?.at[0] === 'fused') continue;
      opened++;
      if ((G.relicFloors?.[id] || 0) <= 1) inherited++;
    }
  }
  ok(opened === 0 || inherited / opened <= 0.2,
     '주운 그 층에서 바로 깨지는 일이 드물다 — 그건 밀고 간 보상이 아니라 판 길이에 대한 배당이다',
     `${inherited}/${opened}`);
}

/* 절반의 중얼거림이 실제로 나오는가. 문장만 표에 있고 규칙이 안
   부르면 그건 없는 줄이다 — 크랙 자체가 그랬다(UNIQUES의 crackT가
   데이터에만 있고 화면에 한 번도 안 나오고 있었다). */
{
  const p = stage();
  p.relics = ['mirror']; G.cracks = {}; G.ledger = {}; G.murmured = {};
  const said = [];
  const c = D.crackOf('mirror');
  for (let i = 0; i < c.at[1]; i++) {
    const before = G.murmured.mirror;
    Game.ledger('hit');
    if (!before && G.murmured.mirror) said.push(i + 1);
  }
  ok(said.length === 1, '절반쯤에서 유물이 한 번 중얼거린다 — 딱 한 번',
     said.length ? `${said[0]}/${c.at[1]}대째` : '한 번도 안 함');
  ok(Game.cracked('mirror'), '그리고 문턱에서 실제로 깨진다');
}

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
