/* ── 순서 3 ① — 통 여섯 개와 공통 치유 둘 ──────────────────
   DESIGN §4 의 여덟 칸 표는 유틸 1·2를 「전 직업 공통 치유」로 못박아
   두고 있었는데, 그 둘이 divine 목록 안에 있었으므로 실제로는 사제와
   팔라딘의 물건이었다. 전사·도적·레인저는 `realm: null` → `maxmana 0`
   이라 **누를 수 없는 칸 둘**을 들고 있었다.

   이 벤치가 지키는 것 넷:
     1. 여섯 직업 전부에 통이 있고, 여덟 종족 어느 조합에서도 안 눕는다.
        그리고 **열린 칸은 최악의 굴림에서도 한 번은 눌린다**
     2. 여섯 직업 전부가 치유 둘을 갖는다
     3. 비시전자의 통은 **작다** — 강화 치유 두 번을 담지 않는다
     4. 그리고 그 통이 실제로 쓰인다 — 봇의 판에서 치유가 나간다

   3과 4가 같이 있어야 하는 이유: 3만 재면 「아무도 못 쓰는 작은 통」이
   통과하고, 4만 재면 「사실은 시전자인 전사」가 통과한다. 1의 뒷줄이
   붙은 이유도 같다 — 천장(cap 11)만 걸어 두면 바닥이 4에 눌린 채로도
   통과하는데, 그러면 지혜를 버린 전사에게 강화 치유는 8레벨에 열려서
   30레벨까지 식어 있는 칸이다.

   ── 이 자가 실제로 반응하는가 ──────────────────────────────
   NEXT.md 가 적어 둔 여섯 번의 오진 중 넷이 「통과로 찍히면서 아무것도
   안 재는」 종류였다. 그래서 §깔때기 절이 있다: 화면의 줄에 **켜진 것**과
   cast() 가 **받는 것**이 같은지 묻고, 지혜를 흔들었을 때 숫자가
   따라 움직이는지 본다. 안 움직이면 통과가 아니라 안 잰 것이다.     */

const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const { runBot } = await import('./_botlib.mjs');
const { G } = Game;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`   ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

const CLS = ['warrior', 'rogue', 'ranger', 'mage', 'priest', 'paladin'];
const CASTER = CLS.filter(c => D.CLASSES[c].realm);
const NOT = CLS.filter(c => !D.CLASSES[c].realm);
const CURE = D.SPELLS_COMMON.find(s => s.id === 'cure');
const BIG  = D.SPELLS_COMMON.find(s => s.id === 'heal');

/* 능력치를 고정해서 만든 영웅 하나. 굴림에 맡기면 같은 줄이 판마다
   다른 숫자를 인쇄하고, 그러면 표가 측정이 아니라 소음이 된다. */
function hero(cls, lv, over = {}) {
  const p = Game.createHero('human', cls, Game.rollStats(cls));
  Object.assign(p.stats, over);
  p.lv = lv;
  Game.recalc(p, true);
  p.hp = p.maxhp; p.mana = p.maxmana;
  G.player = p;
  return p;
}
/* 그 직업이 그 능력치를 어느 폭에서 굴리는가 — 최악·중간·최선. */
const bandOf = (cls, key) => {
  const [lo, hi] = D.BANDS[D.CLASS_BAND[cls][key]];
  return { lo, mid: Math.round((lo + hi) / 2), hi };
};

/* ═══ 1. 통 ═══════════════════════════════════════════════ */
console.log('\n── 통 (능력치 중간 굴림 · 레벨별)');
const LVS = [1, 4, 8, 12, 20];
const pool = {};
for (const cls of CLS) {
  const sc = D.MANA_SCALE[cls];
  const b = bandOf(cls, sc.key);
  pool[cls] = LVS.map(lv => hero(cls, lv, { [sc.key]: b.mid }).maxmana);
  console.log(`   ${cls.padEnd(8)} ${D.CLASSES[cls].realm ? '시전' : '유틸'}`
    + ` · ${D.STAT_NAME[sc.key]} ${String(b.mid).padStart(2)}`
    + ` · ${LVS.map((lv, i) => `lv${String(lv).padEnd(2)} ${String(pool[cls][i]).padStart(2)}`).join(' · ')}`
    + `  (경상 ${(pool[cls][3] / CURE.cost).toFixed(1)}회 @lv12)`);
}

/* 여덟 종족 × 여섯 직업 × 최악의 굴림에서도 칸이 죽지 않는가. */
let lowest = { n: 99, at: '' };
for (const cls of CLS) {
  const sc = D.MANA_SCALE[cls];
  for (const race of Object.keys(D.RACES)) {
    const p = Game.createHero(race, cls, Game.rollStats(cls));
    Object.assign(p.stats, { [sc.key]: bandOf(cls, sc.key).lo });
    p.lv = 1; Game.recalc(p, true);
    if (p.maxmana < lowest.n) lowest = { n: p.maxmana, at: `${race} ${cls}` };
  }
}
ok(lowest.n >= CURE.cost * 2,
   '어느 종족·직업으로 굴려도 1레벨 통에 경상 치유 두 번이 담긴다 — 눌러도 안 되는 유틸 칸은 버그로 읽힌다',
   `가장 작은 통 ${lowest.n} (${lowest.at}) · 경상 치유 ${CURE.cost}mp`);

/* 그리고 **열린 칸은 한 번은 눌린다.** 지혜를 최저로 굴린 전사는
   통이 20레벨까지 4에 머무는데 강화 치유는 6이다 — 8레벨에 칸이
   열리고 30레벨까지 식어 있는다. 열려 있는데 영원히 못 누르는 칸은
   나쁜 선택의 값이 아니라 고장이다(§0). recalc 의 바닥이 그것을 지킨다. */
{
  const dead = [];
  for (const cls of CLS) {
    const sc = D.MANA_SCALE[cls];
    const lo = bandOf(cls, sc.key).lo;
    for (const race of Object.keys(D.RACES)) for (const lv of [BIG.lv, 12, 20, D.MAX_LEVEL]) {
      const p = Game.createHero(race, cls, Game.rollStats(cls));
      Object.assign(p.stats, { [sc.key]: lo });
      p.lv = lv; Game.recalc(p, true); G.player = p;
      for (const s of Game.spellList(p))
        if (D.SPELLS_COMMON.includes(s) && p.maxmana < Game.spellCost(p, s))
          dead.push(`${race} ${cls} lv${lv} ${s.name}`);
    }
  }
  ok(!dead.length,
     '능력치를 최저로 굴려도 배운 공통 유틸은 통에 한 번은 담긴다 — 열린 채 영원히 식은 칸은 값이 아니라 고장이다',
     dead.length ? `${dead.length}건: ${dead.slice(0, 3).join(' / ')}` : `${BIG.name} ${BIG.cost}mp 까지 바닥이 따라온다`);
}

/* ═══ 2. 여섯 직업이 치유 둘을 갖는다 ══════════════════════ */
console.log('\n── 주문 목록');
for (const cls of CLS) {
  const p = hero(cls, 20);
  const list = Game.spellList(p);
  console.log(`   ${cls.padEnd(8)} ${list.map(s => `${s.name}(${s.cost})`).join(' · ')}`);
}
const missing = CLS.filter(cls => {
  const ids = Game.spellList(hero(cls, 20)).map(s => s.id);
  return !ids.includes('cure') || !ids.includes('heal');
});
ok(!missing.length, '여섯 직업 전부가 경상 치유와 강화 치유를 갖는다',
   missing.length ? `없는 직업: ${missing.join(', ')}` : `여섯 다 · ${CURE.name} lv${CURE.lv} · ${BIG.name} lv${BIG.lv}`);

/* 그리고 realm 목록에는 더 이상 없다 — 두 곳에 있으면 사제의 줄에
   경상 치유가 두 번 뜬다. */
const dup = Object.keys(D.SPELLS_CLASS)
  .filter(c => D.SPELLS_CLASS[c].some(s => s.id === 'cure' || s.id === 'heal'));
ok(!dup.length, '치유 둘은 공통 목록에만 있다 — 직업 목록에 남으면 그 직업의 줄에 같은 칸이 두 번 뜬다',
   dup.length ? `${dup.join(', ')} 에 남아 있다` : '공통 하나뿐');
{
  const p = hero('priest', 20);
  const slots = Game.spellSlots().filter(s => !s.art).map(s => s.id);
  const twice = slots.filter((id, i) => slots.indexOf(id) !== i);
  ok(!twice.length, '사제의 줄에 중복된 칸이 없다', twice.length ? twice.join(',') : `${slots.length}칸`);
}

/* ═══ 3. 비시전자의 통은 작다 ══════════════════════════════ */
console.log('\n── 통의 크기 (강화 치유 두 번 = ' + BIG.cost * 2 + 'mp)');
let over = [];
for (const cls of NOT) {
  const sc = D.MANA_SCALE[cls];
  const b = bandOf(cls, sc.key);
  /* 최선의 굴림 · 최고 레벨 — 이 직업이 통을 가장 크게 만들 수 있는 자리 */
  const top = hero(cls, D.MAX_LEVEL, { [sc.key]: b.hi }).maxmana;
  console.log(`   ${cls.padEnd(8)} 최대 ${String(top).padStart(2)} (${D.STAT_NAME[sc.key]} ${b.hi} · lv${D.MAX_LEVEL})`);
  if (top >= BIG.cost * 2) over.push(`${cls} ${top}`);
}
ok(!over.length,
   '비시전자는 통 하나로 강화 치유를 두 번 못 쓴다 — 그러면 유틸 통이 아니라 작은 주문 자원이다',
   over.length ? over.join(' · ') : `천장 ${D.MANA_SCALE.warrior.cap}`);
{
  const mg = hero('mage', 8, { int: bandOf('mage', 'int').mid }).maxmana;
  const wr = hero('warrior', 8, { wis: bandOf('warrior', 'wis').mid }).maxmana;
  ok(mg >= wr * 2.5, '8레벨에 시전자의 통이 비시전자의 두 배 반 이상 — 통을 열어 준 것과 시전자로 만든 것은 다르다',
     `마법사 ${mg} vs 전사 ${wr} = ${(mg / wr).toFixed(1)}배`);
}

/* ═══ 4. 깔때기 — 이 자가 실제로 반응하는가 ════════════════ */
console.log('\n── 깔때기');
/* 지혜를 흔들면 통이 따라 움직이는가. 안 움직이면 위의 표는
   MANA_SCALE 을 읽은 것이 아니라 상수를 인쇄한 것이다. */
{
  const lo = hero('warrior', 12, { wis: 7 }).maxmana;
  const hi = hero('warrior', 12, { wis: 17 }).maxmana;
  ok(hi > lo, '지혜가 통의 크기를 정한다 — 흔들었는데 안 움직이면 이 벤치는 아무것도 안 잰 것이다',
     `지혜 7 → ${lo} · 지혜 17 → ${hi}`);
}
/* 줄에 켜진 것은 cast 가 받는다. 하프엘프가 이 두 문을 가른 종족이다
   (기예와 주문이 두 레벨 일찍 열린다 — early:2). spellList 는 `lv <=
   p.lv` 로 직접 세고 spellSlots 는 learned() 를 썼으므로, 1레벨
   하프엘프 마법사의 줄에 점멸이 켜진 채로 뜨고 눌러도 아무 일도
   안 일어났다. */
{
  const split = [];
  for (const race of ['human', 'castle']) for (const cls of CLS) {
    for (const lv of [1, 2, 3, 4, 7, 8, 12]) {
      const p = Game.createHero(race, cls, Game.rollStats(cls));
      p.lv = lv; Game.recalc(p, true); G.player = p;
      const lit = Game.spellSlots().filter(s => !s.art && !s.locked).map(s => s.id);
      const takes = new Set(Game.spellList(p).map(s => s.id));
      for (const id of lit) if (!takes.has(id)) split.push(`${race} ${cls} lv${lv} ${id}`);
    }
  }
  ok(!split.length, '줄에 켜진 주문은 cast 가 전부 받는다 (하프엘프 포함) — 갈리면 「눌리는데 안 나가는 버튼」이다',
     split.length ? `${split.length}건: ${split.slice(0, 4).join(' / ')}` : '두 문이 같은 답을 본다');
}
/* 그리고 실제로 나가는가 — 목록에 있는 것과 손이 쓰는 것은 다르다.
   전사로 경상 치유를 한 번 외워서 마나가 줄고 피가 차는지 본다. */
{
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  const p = G.player;
  p.hp = Math.max(1, Math.floor(p.maxhp * 0.4));
  const hp0 = p.hp, mp0 = p.mana;
  Game.cast('cure');
  ok(p.mana < mp0 && p.hp > hp0, '전사가 경상 치유를 외우면 마나가 줄고 피가 찬다 — 목록에 있는 것과 나가는 것은 다르다',
     `체력 ${hp0} → ${p.hp} · 마나 ${mp0} → ${p.mana}`);
  /* 통이 비면 거절한다. 「값이 없는 버튼」이 되면 통을 연 의미가 없다. */
  p.mana = 0; p.hp = Math.max(1, Math.floor(p.maxhp * 0.4));
  const hp1 = p.hp;
  Game.cast('cure');
  ok(p.hp === hp1, '통이 비면 경상 치유가 안 나간다 — 값이 없는 유틸은 유틸이 아니다', `체력 ${hp1} → ${p.hp}`);
}

/* ═══ 5. 실측 — 그 통이 판에서 쓰이는가 ════════════════════ */
/* 3배치 복제(§6-2). 한 배치로 읽으면 도달 층이 ±1.5 그냥 흔들린다. */
const N = Number(process.argv[2] || 8);
const B = 3;
console.log(`\n── 실측 (${B}배치 × ${N}판)`);
console.log('   직업       도달층          치유/판   헛손질  마른턴/판');
const meas = {};
for (const cls of CLS) {
  const batch = [];
  for (let b = 0; b < B; b++) {
    const rows = [];
    for (let i = 0; i < N; i++) rows.push(runBot('human', cls, i % 2 === 0));
    const avg = k => rows.reduce((s, r) => s + (r[k] || 0), 0) / rows.length;
    batch.push({ depth: avg('depth'), heals: avg('heals'), miss: avg('healMiss'), dry: avg('healDry') });
  }
  const m = k => batch.reduce((s, r) => s + r[k], 0) / B;
  const spread = Math.max(...batch.map(r => r.depth)) - Math.min(...batch.map(r => r.depth));
  meas[cls] = { depth: m('depth'), heals: m('heals'), miss: m('miss'), dry: m('dry'), spread };
  console.log(`   ${cls.padEnd(9)} ${m('depth').toFixed(1).padStart(4)}층 (폭 ${spread.toFixed(1)})`
    + ` · ${m('heals').toFixed(1).padStart(5)}회`
    + ` · ${m('miss').toFixed(1).padStart(5)}`
    + ` · ${m('dry').toFixed(1).padStart(5)}`);
}

const noHeal = CLS.filter(c => meas[c].heals < 1);
ok(!noHeal.length, '여섯 직업 전부 판당 한 번 이상 치유를 실제로 쓴다 — 안 쓰이는 칸은 열린 것이 아니다',
   noHeal.length ? `안 쓰는 직업: ${noHeal.join(', ')}` : CLS.map(c => `${c.slice(0,2)} ${meas[c].heals.toFixed(1)}`).join(' · '));
const miss = CLS.filter(c => meas[c].miss > 0.5);
ok(!miss.length, '누른 치유는 전부 나갔다 — 헛손질은 봇 정책과 게임의 거절 조건이 어긋난 만큼이다',
   miss.length ? miss.map(c => `${c} ${meas[c].miss.toFixed(1)}`).join(' · ') : '0');
/* ── 「판당 2~3회쯤 쓸 크기인가」를 어느 쪽으로 읽는가 ──────────
   NEXT.md ① 이 남긴 문장이고, 두 갈래로 읽힌다:
     (ㄱ) 통이 **한 번에** 경상 치유 2~3회를 담는가
     (ㄴ) 한 판에 치유를 2~3회 쓰는가
   (ㄴ)은 통 크기가 정하는 값이 아니다 — 마나는 회복하므로 판당 횟수는
   판 길이 ÷ manaEvery 에 걸린다(실측 비시전자 판당 14~21회, 층당 2회쯤).
   문장의 주어가 「풀이」이므로 (ㄱ)으로 읽고, (ㄴ)은 걸지 않고 인쇄만
   한다. 흐르는 양을 문턱으로 걸면 판 길이가 조금 늘 때마다 벤치가
   울고, 그건 이 저장소가 이미 두 번 한 실수다.

   시전자와 비시전자의 **횟수**로 판정하지 않는 이유도 같다. 전사는
   통에 치유 말고 넣을 것이 없어서 있는 마나를 다 치유로 쓰고,
   마법사는 같은 마나를 화살로 쓴다 — 그래서 「전사가 마법사보다 더
   자주 치유한다」가 정상이다. 그건 규칙이 아니라 취향이므로 안 건다
   (cls 벤치가 「전사가 1등이어야 한다」를 안 거는 것과 같은 이유). */
{
  const holds = [];
  for (const cls of NOT) {
    const sc = D.MANA_SCALE[cls];
    const mid = bandOf(cls, sc.key).mid;
    for (const lv of [1, 4, 8, 12])
      holds.push({ cls, lv, n: hero(cls, lv, { [sc.key]: mid }).maxmana / CURE.cost });
  }
  const out = holds.filter(h => h.n < 2 || h.n >= 6);
  ok(!out.length,
     '비시전자의 통은 12레벨까지 경상 치유 2~5회를 담는다 — 두 번 아래면 죽은 칸이고, 여섯 번 위면 유틸 통이 아니다',
     out.length ? out.map(h => `${h.cls} lv${h.lv} ${h.n.toFixed(1)}회`).join(' · ')
                : `${Math.min(...holds.map(h=>h.n)).toFixed(1)}~${Math.max(...holds.map(h=>h.n)).toFixed(1)}회`);
}
{
  /* ── 이 줄은 한 번 틀렸다 ────────────────────────────────
     처음에 「비시전자가 시전자보다 마른 턴이 **많아야** 한다」로 걸었고
     통과했다. 그런데 봇의 회복 정책을 고친 뒤(눈앞에 있으면 35%,
     없으면 55%) 뒤집혔다 — 비시전자 3.0 vs 시전자 3.7.

     게임이 아니라 **단언이 틀렸다.** 마른 턴은 「통이 작아서 못 쓴 턴」과
     「통을 딴 데 써서 못 쓴 턴」을 못 가른다: 마법사는 들어온 마나를
     마력 화살로 태우므로 치유를 쓰려는 순간 자주 비어 있고, 레인저는
     붙기 전에 끝내서 애초에 55% 아래로 안 내려간다(마른 턴 0.0).
     즉 이 숫자의 대소는 통 크기가 아니라 **무엇에 썼는가**를 잰다.

     통 크기는 이미 위에서 직접 걸었다(8레벨에 4.5배 · 천장 11 ·
     경상 치유 2~5회). 여기서는 「비시전자에게 마른 턴이 실제로
     있는가」만 묻는다 — 0이면 통이 작다는 말이 판에서 한 번도
     드러나지 않은 것이다. 대소는 인쇄만 한다. */
  const nDry = NOT.reduce((s, c) => s + meas[c].dry, 0) / NOT.length;
  const cDry = CASTER.reduce((s, c) => s + meas[c].dry, 0) / CASTER.length;
  console.log(`   마른 턴 — 비시전자 ${nDry.toFixed(1)}턴/판 · 시전자 ${cDry.toFixed(1)}턴/판`
    + ` (대소는 통 크기가 아니라 무엇에 썼는가를 잰다)`);
  ok(nDry > 0.5, '비시전자가 「쓰고 싶은데 통이 빈」 턴을 실제로 만난다 — 작은 통이 판에서 드러난다',
     `${nDry.toFixed(1)}턴/판 · 직업별 ${NOT.map(c => `${c.slice(0,2)} ${meas[c].dry.toFixed(1)}`).join(' · ')}`);
}
{
  const best = CLS.reduce((a, c) => meas[c].depth > meas[a].depth ? c : a, CLS[0]);
  const worst = CLS.reduce((a, c) => meas[c].depth < meas[a].depth ? c : a, CLS[0]);
  const gap = meas[best].depth - meas[worst].depth;
  ok(gap < 7.5, '치유를 여섯에게 나눠 준 뒤에도 여섯이 같은 게임을 한다 (§cls 와 같은 문턱)',
     `${best} ${meas[best].depth.toFixed(1)} − ${worst} ${meas[worst].depth.toFixed(1)} = ${gap.toFixed(1)}층`);
}

console.log(bad ? `\n마나 벤치: ${bad}건 실패\n` : '\n마나 벤치: 통 여섯 개 · 치유 둘 · 작은 통이 작다\n');
process.exit(bad ? 1 : 0);
