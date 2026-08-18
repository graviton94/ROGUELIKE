/* ═══════════════════════════════════════════════════════════
   hoard.mjs — 손, 조합, 그리고 최정상급

   플레이어의 세 가지:
     「유물 슬롯 좀 더 늘려주고」
     「일반 유물 단일 효과 좀 줄이는 대신 융합유물 조합을 좀 더
      달성하기 어렵되 조합하면 더욱 효과 좋아지게 (슬롯 절약 +
      재료 2개 합 이상의 효과로 강해지게)」
     「최정상급 아이템 드롭 확률은 확 줄이되, 획득 시 확실하게
      체감 가능하게 (성능 + 외관 모두)」

   셋 다 「줄이고 늘렸다」가 아니라 **비교**로만 답할 수 있는 말이다.
   그래서 이 파일은 전부 두 값을 나란히 놓는다.

     1. 손이 실제로 커졌는가 (그리고 언제)
     2. 융합이 자기 재료 **둘의 합**보다 센가 — 자리는 하나만 쓰면서
     3. 짝을 만나기가 실제로 어려워졌는가
     4. 최정상급이 실제로 드물어졌는가, 그리고 나왔을 때 실제로
        다른 물건인가

   usage: node sim/hoard.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D    = await import('../src/data.js');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

console.log('\n유물 벤치 — 손, 조합, 최정상급\n');

const seat = () => { Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend(); return G.player; };

/* ── 1. 손 ────────────────────────────────────────────── */
{
  const rows = [1, 4, 7, 10, 13, 15].map(d => [d, D.relicSlots(d)]);
  console.log('  가장 깊이 간 층   자리');
  for (const [d, n] of rows) console.log(`  ${String(d).padStart(9)}      ${n}`);
  ok(D.RELIC_SLOTS >= 8, '손이 여덟 이상까지 자란다 — 조합을 짤 자리가 있어야 한다',
     `${D.RELIC_SLOTS_BASE} → ${D.RELIC_SLOTS}`);
  ok(rows[0][1] < rows[rows.length - 1][1],
     '처음에는 좁고 끝에는 넓다 — 초반의 버리는 결정이 그대로 남는다',
     `1층 ${rows[0][1]} → 15층 ${rows[rows.length-1][1]}`);
}

/* ── 2. 융합이 제 재료 둘의 합보다 센가 ───────────────── */
console.log('');
{
  /* 「효과」를 한 숫자로 재기 위해, 그 유물을 낀 몸이 실제로
     달라지는 양을 본다: 한 방 기댓값 × 버틸 수 있는 양 = powerOf().
     피해만 보면 방어형 유물이 0으로 읽히고, 체력만 보면 그 반대다. */
  const p = seat();
  const power = (ids) => {
    p.relics = [...ids];
    for (const id of ids) if (!D.RELIC_CRACKS[id]) { /* 크랙 없는 것도 있다 */ }
    Game.recalc(p);
    p.hp = p.maxhp;
    return Game.powerOf(p);
  };
  const bare = power([]);
  console.log('  융합         재료 둘 각각 → 합    융합물 하나   자리');
  let worstGain = 99;
  for (const f of D.FUSIONS) {
    const a = power([f.a]) - bare;
    const b = power([f.b]) - bare;
    const both = power([f.a, f.b]) - bare;
    const out = power([f.out]) - bare;
    const sum = Math.max(a + b, both);
    const gain = sum > 0 ? out / sum : (out > 0 ? 99 : 0);
    console.log(`  ${D.relicById(f.out).n.padEnd(12)}`
      + `${a.toFixed(0).padStart(6)} +${b.toFixed(0).padStart(6)} =${sum.toFixed(0).padStart(7)}`
      + `${out.toFixed(0).padStart(13)}   2 → 1`);
    /* 몸에 안 닿는 유물이 섞여 있으면(장부·진군처럼 지갑과 연격에
       붙는 것들) powerOf 로는 0이 나온다. 그건 이 자로 못 재는
       것이지 약한 것이 아니므로 판정에서 뺀다 — 못 재는 것을
       실패로 적으면 그건 측정이 아니라 사고다. */
    if (Math.abs(sum) < 1 && Math.abs(out) < 1) continue;
    /* ── 분모가 음수면 배율은 배율이 아니다 ────────────────────
       메아리의 종에 대가(최대 체력 −10%)를 붙인 날 여기가 빨개졌다.
       울리는 진군의 재료 둘이 합쳐서 **−8**이 되고, 융합물은 0이다 —
       즉 융합물이 재료보다 **나은데** `out/sum` 은 0으로 읽힌다.
       분모가 0 이하일 때는 비율을 묻지 않고 **차이**를 묻는다:
       융합물이 재료 둘보다 나쁘지만 않으면 된다. (배율로 우기면
       이 자는 「대가가 있는 유물을 재료로 쓰면 실패」라고 말한다.) */
    if (sum <= 0) { ok(out >= sum, `${D.relicById(f.out).n} — 재료 합이 0 이하라 배율 대신 차이로 본다`,
                      `합 ${sum.toFixed(0)} → 융합 ${out.toFixed(0)}`); continue; }
    worstGain = Math.min(worstGain, gain);
  }
  ok(worstGain >= 1.0,
     '융합물이 제 재료 둘의 합 이상이다 — 그러면서 자리는 하나만 쓴다',
     `가장 박한 짝에서도 ×${worstGain === 99 ? '∞' : worstGain.toFixed(2)}`);

  /* 표에 적힌 값 자체도 본다 — powerOf 가 못 읽는 유물까지 덮는다. */
  const scale = Game.RELIC_SCALE, fscale = Game.FUSED_SCALE;
  ok(fscale > scale * 2 * 0.95,
     '값 배율로도 그렇다: 융합 배율이 일반 둘의 합에 맞먹는다',
     `일반 ×${scale} + ×${scale} = ${(scale*2).toFixed(2)} · 융합 ×${fscale}`);
  ok(scale < 1, '일반 유물의 단일 효과는 내려갔다', `×${scale}`);
}

/* ── 3. 짝을 만나기 ───────────────────────────────────── */
console.log('');
{
  ok(D.FUSE_PULL <= 0.4,
     '한쪽을 들고 있어도 나머지가 쉽게 오지 않는다 — 들고 다니는 것이 위험이어야 한다',
     `짝이 나올 확률 ${(D.FUSE_PULL * 100).toFixed(0)}%`);
  /* 유물이 판에 몇 개나 들어오는지와 곱해서 「한 판에 융합이 몇 번
     성사되나」의 상한을 본다. 정확한 값은 봇이 재고, 여기서는
     설계값이 서로 모순이 아닌지만 본다. */
  const pairs = D.FUSIONS.length;
  ok(pairs >= 5 && pairs <= 10,
     '짝은 손보다 적다 — 전부 모으는 것이 목표가 되면 그건 체크리스트다',
     `${pairs}쌍 · 자리 ${D.RELIC_SLOTS}`);
}

/* ── 4. 최정상급 ──────────────────────────────────────── */
console.log('');
{
  seat();
  const N = 40000;
  let trans = 0, uniq = 0, both = 0, plusSum = 0, plusN = 0, engr = 0;
  const gear = [];
  for (let i = 0; i < N; i++) {
    /* 이름 있는 무기는 판에 하나씩만 나온다(G.uniques 가 기억한다).
       사만 개를 한 판에서 굴리면 처음 몇 개 뒤로는 풀이 비어서
       0.02% 가 찍힌다 — 그건 확률이 아니라 재고를 잰 것이다.
       판을 새로 시작한 셈 치고 기억을 비운다. */
    if (i % 60 === 0) G.uniques = {};
    const it = Game.pickItemFor(12);
    if (it.kind !== 'weapon' && it.kind !== 'armour') continue;
    gear.push(it);
    if (it.boon) trans++;
    if (it.unique) uniq++;
    if (it.pre && it.suf) { both++; plusSum += it.plus || 0; plusN++;
                            if (it.engrave?.length) engr++; }
  }
  const pct = n => (n / Math.max(1, gear.length) * 100).toFixed(2) + '%';
  console.log(`  12층 장비 ${gear.length}개 중`);
  console.log(`    초월            ${String(trans).padStart(5)}  ${pct(trans)}`);
  console.log(`    이름 있는 무기   ${String(uniq).padStart(5)}  ${pct(uniq)}`);
  console.log(`    접두+접미 둘 다  ${String(both).padStart(5)}  ${pct(both)}`);
  console.log(`      그중 평균 강화 +${(plusSum / Math.max(1, plusN)).toFixed(1)}`
    + ` · 각인 ${(engr / Math.max(1, both) * 100).toFixed(0)}%`);

  ok(trans / gear.length < 0.02, '초월은 장비 쉰 개에 하나도 안 나온다', pct(trans));
  ok(uniq / gear.length < 0.02, '이름 있는 무기도 그렇다', pct(uniq));
  ok(both / gear.length < 0.30,
     '둘 다 붙은 물건이 기본값이 아니다 — 절반이 희귀하면 희귀한 것이 없다', pct(both));

  /* 그리고 나왔을 때는 확실히 다른 물건인가. */
  const bigs = gear.filter(g => g.pre && g.suf);
  const avgPlus = plusSum / Math.max(1, plusN);
  ok(avgPlus >= 3, '나올 때는 벼려진 채로 나온다 — 드물게 만든 값을 여기서 돌려받는다',
     `평균 +${avgPlus.toFixed(1)}`);

  const transItems = gear.filter(g => g.boon);
  const naked = transItems.filter(g => !(g.pre && g.suf && (g.plus || 0) >= 5 && g.engrave?.length));
  ok(naked.length === 0,
     '초월은 접두·접미·벼림·각인을 전부 달고 나온다 — 배낭에서 한 줄만 봐도 다르다',
     `${transItems.length}개 중 맨 것 ${naked.length}개`);
  void bigs;
}

/* ── 5. 손에 들면 화면에도 나오는가 ───────────────────── */
console.log('');
{
  const p = seat();
  const w = p.equip.weapon;
  w.plus = 0; w.engrave = []; w.boon = null; delete w.unique;
  p.relics = [];
  ok(Game.auraOf(p) === null, '맨 물건은 화면에서도 맨 물건이다');
  w.boon = 'ruin';
  ok(Game.auraOf(p)?.boon === 'ruin',
     '초월은 휘두를 때마다 화면에 나온다 — 바닥의 빛기둥은 줍기 전까지만 보인다',
     '은총이 사건에 실린다');
  w.boon = null; w.unique = 'ashcount';
  ok(Game.auraOf(p)?.unique === 'ashcount', '이름 있는 무기도 그렇다');
}

console.log(bad ? `\n유물 벤치: ${bad}건 실패\n` : '\n유물 벤치: 조합이 합보다 세다\n');
process.exit(bad ? 1 : 0);
