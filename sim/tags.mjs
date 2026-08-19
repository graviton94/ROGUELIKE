/* ═══════════════════════════════════════════════════════════
   tags.mjs — 유물의 문법

   유물 시스템을 다시 짓는 다섯 단계 중 ②·③. 근본 문제는 밸런스가
   아니라 **진실의 출처가 둘**이라는 것이었다:

       { id:'pact', t:'최대 체력 −25%. 치명타 확률 +20%p.' }  // 문단
       case 'pact': b.maxhpPct -= 0.25; b.crit += 0.20;       // 코드

   마흔 개가 전부 이 모양이고 어긋나도 아무도 안 운다 — 실제로 융합물
   에서 한 번 터졌다(표의 v 는 0.40 인데 그 자리 리터럴은 0.25/1.2).

   이 파일이 무는 것 셋:

     1. **아무것도 안 움직였다.** 값을 switch 에서 표로 옮기는 일은
        리팩터링이지 밸런스 변경이 아니다. 마흔 개 × 크랙 둘 = 여든
        칸의 gearBonus 를 옮기기 **전에** 떠 놓고, 옮긴 뒤에 한 칸도
        안 달라졌는지 본다. 이 방법이 아니면 「값이 조용히 바뀌었다」를
        영영 못 잡는다
     2. **문법이 지켜지는가** — 마흔이 전부 give/take/at 을 갖고,
        대가 없는 유물이 늘지 않는다
     3. **어휘가 한쪽으로 안 몰리는가** — 격자가 비어 있는 자리가
        곧 다음에 만들 유물의 목록이다

   usage: node sim/tags.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const { readFileSync } = await import('node:fs');
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const { G } = Game;

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };

/* ═══ 1. 아무것도 안 움직였다 ═════════════════════════════ */
console.log(`\n── 값이 그대로인가 (유물 × 크랙 둘)`);
{
  const base = JSON.parse(readFileSync(new URL('./_gearbase.json', import.meta.url), 'utf8'));
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  const p = G.player;
  p.lv = 10; Game.recalc(p);
  const diff = [], fresh = new Set();
  for (const r of D.RELICS) for (const crack of [false, true]) {
    p.relics = [r.id];
    G.cracks = crack ? { [r.id]: true } : {};
    /* 떠 놓을 때와 **똑같은 상태**여야 한다 — 조건부 유물이 켜지는
       자리(체력 20% · 앙심 5 · 씨앗 3 · 불 꺼짐 · 3층)를 그대로 쓴다.
       하나라도 다르면 이 비교는 유물이 아니라 상태를 잰다. */
    p.hp = Math.round(p.maxhp * 0.2);
    p.grudge = 5; p.seedAc = 3; p.lightTurns = 0; G.depth = 3;
    const b = Game.gearBonus(p);
    const now = base.keys.map(k => {
      const v = b[k];
      return typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v;
    });
    /* ── 기준선에 없는 유물은 「달라졌다」가 아니다 ────────────
       여기서 한 번 터졌다. 유물을 여섯 개 새로 지으니 was 가
       undefined 라 벤치가 죽었고, 처음 든 생각은 「기준선을 다시
       떠야겠다」였다. 그게 정확히 이 파일이 막으려던 일이다 —
       다시 떠 버리면 옛 여든 칸이 안 움직였다는 보증이 그 순간
       사라진다.

       그래서 새 것은 **견줄 대상이 없다고 말하고 넘긴다.** 기준선은
       마흔 개 × 둘로 그대로 두고, 그 여든 칸만 지킨다. 값을 실제로
       고치는 날(대가 없는 여섯에 대가를 붙이는 순서 ⑤ 같은 날)에만
       _gearbase.mjs 로 일부러 다시 뜨고, 커밋에 **왜** 다시 떴는지
       적는다. */
    const was = base.snap[`${r.id}/${crack ? 'crack' : 'plain'}`];
    if (!was) { fresh.add(r.id); continue; }
    was.forEach((v, i) => {
      if (JSON.stringify(v) !== JSON.stringify(now[i]))
        diff.push(`${r.n}${crack ? '(크랙)' : ''} ${base.keys[i]} ${v} → ${now[i]}`);
    });
  }
  const held = new Set(D.RELICS.map(r => r.id));
  const gone = Object.keys(base.snap).map(k => k.split('/')[0]).filter(id => !held.has(id));
  ok(!diff.length, '기준선의 모든 칸이 그대로다 — 표로 옮기는 것은 리팩터링이지 밸런스 변경이 아니다',
     diff.length ? '\n      ' + diff.join('\n      ')
                 : `${Object.keys(base.snap).length / 2}개 × 2`);
  ok(!gone.length, '기준선에 있던 유물이 조용히 사라지지 않았다',
     gone.length ? [...new Set(gone)].join(' ') : `${held.size - fresh.size}개 그대로`);
  console.log(`    (기준선에 없는 새 유물 ${fresh.size}개는 견줄 대상이 없다: ${[...fresh].join(' ') || '없음'})`);
}

/* ═══ 2. 문법 ═════════════════════════════════════════════ */
console.log('\n── 문법 (준다 / 가져간다 / 붙는 곳)');
const WORDS = ['몸', '손', '혀', '눈', '발', '주머니', '*'];
{
  const noTag = D.RELICS.filter(r => !r.give || r.take === undefined || !r.at);
  ok(!noTag.length, '마흔이 전부 준다·가져간다·붙는 곳을 갖는다',
     noTag.length ? noTag.map(r => r.id).join(' ') : `${D.RELICS.length}개`);
  const badWord = D.RELICS.filter(r => !WORDS.includes(r.give)
    || (r.take && !WORDS.includes(r.take)));
  ok(!badWord.length, '어휘 밖의 낱말이 없다 — 어휘가 늘면 격자가 뜻을 잃는다',
     badWord.length ? badWord.map(r => `${r.id}:${r.give}/${r.take}`).join(' ') : WORDS.join(' '));
  const badAt = D.RELICS.filter(r => !['self', 'foe', 'floor'].includes(r.at));
  ok(!badAt.length, '붙는 곳이 셋 중 하나다', badAt.map(r => r.id).join(' ') || 'self · foe · floor');
  /* ── 대가 없는 유물 ────────────────────────────────────
     이 게임의 다른 모든 것이 「규칙 하나와 대가 하나」를 지킨다
     (§4의 종족). 유물만 예외였고 여섯 개가 대가 없이 서 있다.

     ⑤-유물 (4)에서 그 여섯에 대가를 붙였다 — 메아리의 종(최대 체력
     −10%) · 거울 방패(은신 −25%) · 불씨 항아리(불빛 −1) · 저울추(물약
     −30%) · 뼈 목걸이(명중 −6) · 앙심(주문 위력 −3). 기준선을 6에서
     **0**으로 내려 적는다. 내리는 것은 언제나 공짜다. */
  const free = D.RELICS.filter(r => !r.take);
  console.log(`     대가 없는 것 ${free.length}개 — ${free.map(r => r.n).join(' · ') || '없다'}`);
  ok(free.length <= 0, '대가 없는 유물이 없다 — 대가가 없으면 유물이 아니라 스탯이다',
     `${free.length}개 (기준선 0)`);
}

/* ═══ 3. 격자 ═════════════════════════════════════════════ */
console.log('\n── 격자 (주는 것 × 가져가는 것)');
{
  const cell = {};
  for (const r of D.RELICS) cell[`${r.give}/${r.take || '없음'}`] =
    (cell[`${r.give}/${r.take || '없음'}`] || 0) + 1;
  console.log('        ' + [...WORDS, '없음'].map(w => w.padStart(5)).join(''));
  for (const g of WORDS)
    console.log('  ' + g.padEnd(6) + [...WORDS, '없음'].map(t =>
      String(cell[`${g}/${t}`] || '·').padStart(5)).join(''));
  const give = {}, at = {};
  for (const r of D.RELICS) { give[r.give] = (give[r.give] || 0) + 1; at[r.at] = (at[r.at] || 0) + 1; }
  console.log('  주는 것  ' + WORDS.map(w => `${w} ${give[w] || 0}`).join(' · '));
  console.log('  붙는 곳  ' + Object.entries(at).map(([k, v]) => `${k} ${v}`).join(' · '));
  const filled = Object.keys(cell).length;
  console.log(`  채워진 칸 ${filled}/${WORDS.length * (WORDS.length + 1)}`);

  const lump = Math.max(...WORDS.map(w => give[w] || 0));
  ok(lump / D.RELICS.length <= 0.45,
     '어휘가 고르게 분포한다',
     `가장 많은 것 ${lump}/${D.RELICS.length} (${Math.round(lump / D.RELICS.length * 100)}%)`);
  /* ── 몬스터에게 붙는 유물 ──────────────────────────────
     지금 다섯이고 전부 「깨어나는 거리」나 반사다. 디버프 축이
     사실상 비어 있고, 그게 순서 4에서 새로 지을 자리다. */
  ok((at.foe || 0) >= 5, '몬스터에게 붙는 유물이 다섯은 있다 — 이 축이 비면 유물은 전부 내 몸에만 붙는다',
     `${at.foe || 0}개`);
}

/* ═══ 4. 손의 문법 ════════════════════════════════════════
   유물 둘이 말을 거는 방식 셋(겹침·갚음·겹친 대가)은 새로 만든 규칙이
   아니라 **이미 있던 것을 적은 것**이다. 손으로 정해 둔 융합 여섯 쌍을
   태그로 읽어 보니 여섯이 전부 그 셋 중 하나였다.

   그리고 그 과정에서 **태그의 오기를 하나 잡았다**: 폭식의 위장을
   「주머니를 준다」로 적었는데, 이 유물이 주는 것은 물약이 아니라
   물약이 하는 일 — 회복이다. 몸으로 고치니 굶주린 칼날과 짝이 맞았고,
   그 쌍이 실제로 융합 표에 있다. 문법이 태그를 검사한 자리다. */
console.log('\n── 손의 문법 (겹침 · 갚음 · 겹친 대가)');
{
  const by = Object.fromEntries(D.RELICS.map(r => [r.id, r]));
  const noBond = [];
  for (const f of D.FUSIONS) {
    const b = D.bond(by[f.a], by[f.b]);
    console.log(`     ${(by[f.a].n + ' + ' + by[f.b].n).padEnd(26)} ${b ? D.BONDS[b].n : '없음'}`);
    if (!b) noBond.push(`${by[f.a].n}+${by[f.b].n}`);
  }
  /* 손으로 정한 쌍에 결속이 없으면 둘 중 하나다 — 문법이 그 쌍을
     설명하지 못하거나, **태그가 틀렸다.** 어느 쪽이든 봐야 한다. */
  ok(!noBond.length,
     '융합 여섯 쌍이 전부 문법으로 설명된다 — 안 되면 문법이 틀렸거나 태그가 틀렸다',
     noBond.length ? noBond.join(' · ') : `${D.FUSIONS.length}쌍`);

  const cnt = { twin: 0, mend: 0, ache: 0, none: 0 };
  const per = {};
  for (let i = 0; i < D.RELICS.length; i++) for (let j = i + 1; j < D.RELICS.length; j++) {
    const b = D.bond(D.RELICS[i], D.RELICS[j]);
    cnt[b || 'none']++;
    if (b) { per[D.RELICS[i].id] = (per[D.RELICS[i].id] || 0) + 1;
             per[D.RELICS[j].id] = (per[D.RELICS[j].id] || 0) + 1; }
  }
  const pairs = D.RELICS.length * (D.RELICS.length - 1) / 2;
  console.log(`     모든 쌍 ${pairs} — 겹침 ${cnt.twin} · 갚음 ${cnt.mend} · 겹친 대가 ${cnt.ache}`
    + ` · 안 통함 ${cnt.none} (${Math.round((pairs - cnt.none) / pairs * 100)}%가 말을 건다)`);
  /* 짝이 없는 유물은 어떤 손에도 못 들어간다 — 그건 유물이 아니라
     스탯 하나다. 셋을 문턱으로 두는 이유: 자리가 4~7칸이므로 셋이면
     한 손 안에서 만날 수 있다. */
  const lonely = D.RELICS.filter(r => (per[r.id] || 0) < 3);
  ok(!lonely.length, '유물마다 말을 거는 짝이 셋은 있다 — 하나도 없으면 어떤 손에도 못 들어간다',
     lonely.length ? lonely.map(r => `${r.n}(${per[r.id] || 0})`).join(' · ')
                   : `가장 적은 것 ${Math.min(...D.RELICS.map(r => per[r.id] || 0))}개`);
  /* 셋 중 하나가 통째로 비면 그 관계는 설계가 아니라 장식이다. */
  const deadBond = Object.keys(D.BONDS).filter(k => cnt[k] === 0);
  ok(!deadBond.length, '결속 셋이 전부 실제로 일어난다',
     deadBond.length ? deadBond.join(' ') : Object.keys(D.BONDS).map(k => `${D.BONDS[k].n} ${cnt[k]}`).join(' · '));
}

/* ═══ 5. 무조건 좋은 유물은 없다 ══════════════════════════
   플레이어: 「특정 직업한테는 완전 무가치라서 버리는 것도 직업별,
   종족별로 다 다른거임. 무조건 좋은게 아니야.」

   240칸(유물 40 × 직업 6)을 손으로 적지 않는다. `give`/`take` 어휘의
   **무게**만 알면 값이 나오고, 그 무게는 66칸이다
   (`sim/_words.json` — 3배치×20판, 몫으로 정규화해서 여섯이 똑같으면
   1.00, 한 직업이 다 가져가면 6.00).

       값(직업) = give 무게 − take 무게

   그리고 「무조건 좋은 게 아니다」는 **그 값이 직업마다 달라야 한다**로
   적힌다. 폭이 0이면 여섯이 같은 유물을 든 것이다.

   ── 사분면으로 걸었다가 0/40이 나왔다 ────────────────────
   처음에 「도박(선물도 크고 대가도 아프다)인 직업 하나, 버린다인
   직업 하나」로 걸었더니 **0/40**이었다. 문턱이 틀린 것이 아니라
   조건이 두 어휘에 **동시에** 높기를 요구했는데, 어휘들은 서로
   반대로 가는 편이다(손이 높은 직업은 몸이 낮다). 피의 계약은
   전사의 도박이 맞는데 몸 1.14가 문턱 1.15에 0.01 모자랐다.
   폭으로 묻는다 — 같은 것을 재면서 자가 흔들리지 않는다.

   ── 그리고 아홉 개는 구조적으로 폭이 0이다 ────────────────
   주는 어휘와 가져가는 어휘가 **같으면** 값이 모든 직업에서 정확히
   0이다(쌍둥이 룬 혀/혀 · 무모함의 인장 손/손 · 매듭 밧줄 발/발 …).

   ── 여기 적혀 있던 말이 틀렸다 ──────────────────────────────
   처음엔 「그건 자의 결함이 아니라 그 유물의 성질이다 — 이 아홉이
   손볼 목록이다」라고 적어 두었다. 아니었다. 폭은
   `무게(give,cls) − 무게(take,cls)` 이므로 give === take 면 **어떤
   무게표를 넣어도 모든 직업에서 0**이다. 관측이 아니라 항등식이다.

   `sim/evenhand.mjs` 가 어휘 **안쪽**을 재 보니 여섯 낱말 전부가
   직업마다 갈렸다 — 치명 3.9배 · 은신 201배 · 명중 3.0배. (「명중은
   평평할 것」을 대조군으로 세웠다가 그 대조군에 물려서 알았다.)
   즉 이 아홉은 「직업을 안 가리는 유물 아홉」이 아니라 **이 자로는
   판정할 수 없는 유물 아홉**이다. 유물을 고칠 목록이 아니다.

   그래서 이 절은 아홉을 「폭 0」이 아니라 **판정 안 함**으로 인쇄한다.
   남겨 두는 규칙은 하나뿐이다: 이 아홉이 **늘지 않는다** — 새로 짓는
   유물은 어휘가 갈리는 쪽으로 짓는 편이 자에게도 보인다. */
console.log('\n── 무조건 좋은 유물은 없는가');
{
  const W = JSON.parse(readFileSync(new URL('./_words.json', import.meta.url), 'utf8'));
  const KOC = { warrior:'전사', rogue:'도적', ranger:'궁수', mage:'마법사', priest:'사제', paladin:'팔라딘' };
  /* 와일드카드는 여섯 어휘의 평균이다 — 전부를 건드리므로. */
  const wt = (word, cls) => {
    if (!word) return { m: 0, w: 0 };
    if (word === '*') {
      const all = W.word.map(w => W.per[w][cls]);
      return { m: all.reduce((a, v) => a + v.m, 0) / all.length,
               w: all.reduce((a, v) => a + v.w, 0) / all.length };
    }
    return W.per[word][cls];
  };
  const rows = D.RELICS.map(r => {
    const val = W.cls.map(c => wt(r.give, c).m - wt(r.take, c).m);
    const noise = W.cls.reduce((a, c) => a + wt(r.give, c).w + wt(r.take, c).w, 0) / W.cls.length;
    const hi2 = Math.max(...val), lo2 = Math.min(...val);
    return { r, val, spread: hi2 - lo2, noise,
             best: W.cls[val.indexOf(hi2)], worst: W.cls[val.indexOf(lo2)],
             same: !!r.take && r.give === r.take };
  }).sort((a, b) => a.spread - b.spread);

  const flat = rows.filter(x => x.spread <= x.noise);
  const sharp = rows.filter(x => x.spread > x.noise);
  console.log(`     직업마다 값이 다른 유물 ${sharp.length}/${D.RELICS.length}`);
  for (const x of rows.slice(-5).reverse())
    console.log(`       ${x.r.n.padEnd(12)} ${(x.r.give + '/' + (x.r.take || '없음')).padEnd(11)}`
      + ` 폭 ${x.spread.toFixed(2)}  ${KOC[x.best]} 쪽 > ${KOC[x.worst]} 쪽`);
  const same = rows.filter(x => x.same);
  console.log(`     **주는 것과 가져가는 것이 같아서 이 자로는 판정 안 되는** 것 ${same.length}개 —`);
  console.log(`       ${same.map(x => x.r.n).join(' · ')}`);
  console.log(`       (폭 0은 관측이 아니라 항등식이다 — 어휘 안쪽은 sim/evenhand.mjs 가 잰다)`);
  const free = rows.filter(x => !x.r.take);
  console.log(`     대가가 없어서 폭이 give 하나로 정해지는 것 ${free.length}개`);

  /* 문턱 둘. 위는 「적어도 이만큼은 실제로 직업별이다」, 아래는
     「같은 어휘를 주고받는 유물이 늘지 않는다」. 위만 걸면 새 유물이
     전부 미지근해도 초록이고, 아래만 걸면 이미 있는 것을 안 고쳐도
     초록이다. */
  ok(sharp.length >= 24,
     '유물의 값이 직업마다 다르다 — 배치 폭을 넘겨서 갈리는 것이 스물넷은 된다',
     `${sharp.length}개 (미지근 ${flat.length})`);
  ok(same.length <= 9,
     '주는 어휘와 가져가는 어휘가 같은 유물이 늘지 않는다 — 이 자가 판정 못 하는 칸이 늘어난다',
     `${same.length}개 (기준선 9)`);
}

console.log(bad ? `\n태그 벤치: ${bad}건 실패\n`
                : '\n태그 벤치: 값이 그대로다 · 문법이 선다 · 격자가 보인다 · 손이 말을 건다\n');
process.exit(bad ? 1 : 0);
