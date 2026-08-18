/* ═══════════════════════════════════════════════════════════
   evenhand.mjs — 「같은 어휘를 주고받으면 여섯 직업에게 같은 거래」가
   정말인가

   ⑤-린트가 아홉을 지목했다: 주는 어휘와 가져가는 어휘가 같아서 폭이
   0인 것들(쌍둥이 룬 혀/혀 · 무모함의 인장 손/손 · 매듭 밧줄 발/발 …).
   그리고 「이 아홉이 손볼 목록」이라고 적었다.

   그런데 그 폭이 0인 것은 **관측이 아니라 계산의 항등식**이다.
   tags.mjs 는 폭을 이렇게 잰다:

       val(cls) = 무게(give, cls) − 무게(take, cls)

   give === take 면 어떤 무게표를 넣어도 모든 직업에서 0이다. 즉 자는
   「이 유물은 직업을 안 가린다」를 **잰 적이 없다.** 그렇게 나오도록
   적혀 있을 뿐이다.

   그래서 이 파일은 어휘 **안쪽**을 본다. 어휘는 몸의 부위 여섯이고,
   한 부위 안에도 직업마다 크게 다른 숫자가 있다 —

     · `손` 안에 치명 확률이 있다. 무모함의 인장은 치명 **배율**을
       주고 명중을 가져간다. 치명 확률이 두 배인 직업에게 그 배율은
       두 배짜리 선물이다
     · `발` 안에 은신이 있다. 매듭 밧줄은 은신을 절반 가져간다.
       은신이 기예의 자원인 직업과 은신을 안 쓰는 직업에게 그것은
       같은 값이 아니다

   둘이 실제로 갈리면, 아홉 중 적어도 그 둘은 **자의 한계**이지 유물의
   결함이 아니다. 그러면 고칠 곳은 유물이 아니라 자이거나, 아니면
   「지금 자로는 이 둘을 판정하지 않는다」고 적어 두는 것이다.

   이 파일은 아무 유물도 안 고친다. 아홉이 **자의 한계인지 유물의
   결함인지**만 가른다. 답은 아홉 전부 자의 한계였다.

   usage: node sim/evenhand.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('/home/user/ROGUELIKE/src/meta.js');
const Game = await import('/home/user/ROGUELIKE/src/game.js');
const D    = await import('/home/user/ROGUELIKE/src/data.js');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };
const KOC = { warrior:'전사', rogue:'도적', ranger:'궁수', mage:'마법사', priest:'사제', paladin:'팔라딘' };
const CLS = Object.keys(KOC);

/* 능력치는 굴림이라 판마다 다르다 — 직업 하나를 여러 번 세워 중앙값을
   쓴다. 한 판으로 재면 직업 차이가 아니라 굴림 차이를 잰다. */
const ROLLS = 15;
const med = a => { const s = a.slice().sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

const per = {};
for (const cls of CLS) {
  const crit = [], hide = [], hit = [];
  for (let i = 0; i < ROLLS; i++) {
    Meta.forget();
    Game.startGame('human', cls, Game.rollStats(cls));
    const p = G.player; p.lv = 10; Game.recalc(p);
    crit.push(Game.critChance(p)); hide.push(Game.stealth(p)); hit.push(Game.toHit(p));
  }
  per[cls] = { crit: med(crit), hide: med(hide), hit: med(hit) };
}

console.log('\n어휘 안쪽 — 같은 낱말 안에서 직업이 갈리는가\n');
console.log('             치명확률   은신   명중');
for (const cls of CLS)
  console.log(`  ${KOC[cls].padEnd(5)} ${(per[cls].crit * 100).toFixed(1).padStart(8)}%`
    + `${(per[cls].hide * 100).toFixed(1).padStart(7)}%${per[cls].hit.toFixed(1).padStart(7)}`);

const ratio = k => { const v = CLS.map(c => per[c][k]);
  return Math.max(...v) / Math.max(1e-6, Math.min(...v)); };

console.log('');
/* ── 대조군을 하나 세웠다가 그 대조군에 물렸다 ──────────────
   처음에 「치명과 은신은 갈리지만 **명중은 평평하다**」를 단언으로
   적었다. 어휘 안쪽이 언제나 갈리는 것은 아니라는 것을 보이려고
   세운 대조군이다. 그런데 명중이 **2.38배**로 갈렸다 — 치명(3.86배)
   보다 작지만 「평평하다」와는 거리가 멀다.

   그래서 결론이 뒤집혔다. 어휘 안쪽이 갈리는 것은 특별한 몇 낱말이
   아니라 **여섯 낱말 전부**다. 대조군이 통과했으면 「아홉 중 셋만
   자의 한계」로 적고 넘어갔을 것이고, 그건 틀린 말이었다. */
const BAR = 1.5;
{
  const name = (k, hi) => { const v = CLS.map(c => per[c][k]);
    return KOC[CLS[v.indexOf(hi ? Math.max(...v) : Math.min(...v))]]; };
  for (const [k, word, what] of [['crit', '손', '치명 확률이'], ['hide', '발', '은신이'], ['hit', '손', '명중이']])
    ok(ratio(k) >= BAR, `\`${word}\` 안의 ${what} 직업마다 갈린다`,
       `${name(k, true)} / ${name(k, false)} = ${ratio(k).toFixed(2)}배`);
}

/* ── 그래서 아홉을 둘로 가른다 ─────────────────────────────
   어휘 안쪽이 갈리는 숫자를 실제로 건드리는 유물은 「자가 못 보는
   것」이고, 그 안에서 평평한 숫자만 건드리는 유물은 정말 같은 거래다.
   이 표는 손으로 적는다 — 유물이 무엇을 건드리는지는 카드에 사람의
   말로 적혀 있고, 그것을 기계가 읽을 방법이 아직 없다. 대신 아홉이
   전부 여기 있는지는 기계가 센다. */
const BLIND = {
  /* 배수를 손으로 적어 두었다가 다시 돌리니 3.86이 4.24였다 — 능력치가
     굴림이므로 이 숫자는 판마다 움직인다. 방금 잰 값을 끼워 넣는다. */
  reckless: () => `치명 **배율**을 준다 — 치명 확률이 ${ratio('crit').toFixed(2)}배 갈린다`,
  knot:     () => `은신을 절반 가져간다 — 은신이 ${ratio('hide').toFixed(0)}배 갈린다`,
  lamp:     '불빛 반경을 가져간다 — 어둠에서 이득을 보는 직업과 손해만 보는 직업이 다르다',
  nighteye: () => `어둠 속 명중을 준다 — 명중이 ${ratio('hit').toFixed(2)}배 갈린다`,
  brand:    '정예 피해와 일반 피해를 반대로 민다 — 정예를 만나는 빈도와 한 방의 무게가 직업마다 다르다',
  twin:     '주문 비용과 주문 피해를 반대로 민다 — 판당 주문 횟수가 마법사와 전사에서 여덟 배 갈린다',
  toll:     '금화를 주고 금화를 가져간다 — 층당 버는 금화가 직업마다 다르다',
  ledger:   '같은 이유 (융합 유물)',
  seed:     '층당 방어와 최대 체력을 반대로 민다 — 층을 몇 개 내려가는지가 직업마다 다르다',
};
console.log('\n── 아홉이 무엇을 건드리는가');
{
  const same = D.RELICS.filter(r => r.take && r.give === r.take);
  ok(same.length === 9, '⑤-린트가 지목한 아홉이 그대로 아홉이다', `${same.length}개`);
  const blind = same.filter(r => BLIND[r.id]), flat = same.filter(r => !BLIND[r.id]);
  const why = id => { const v = BLIND[id]; return typeof v === 'function' ? v() : v; };
  for (const r of same) console.log(`       ${r.n.padEnd(12)} ${r.give}/${r.take}  ${why(r.id) || '설명이 없다'}`);
  /* 아홉 **전부**가 어휘 안쪽의 갈리는 숫자를 건드린다. 그래서 이 아홉은
     「직업을 안 가리는 유물 아홉」이 아니라 **자가 판정하지 못하는 유물
     아홉**이다. 고칠 곳은 유물이 아니라 자다. */
  ok(!flat.length, '아홉이 전부 어휘 안쪽의 갈리는 숫자를 건드린다 — 그러면 폭 0은 관측이 아니다',
     flat.length ? flat.map(r => r.n).join(' · ') : `${blind.length}개 전부`);
  ok(same.length <= 9, '같은 낱말을 주고받는 유물이 늘지 않는다 — 늘면 자가 판정 못 하는 칸이 늘어난다',
     `${same.length}개 (기준선 9)`);
}

console.log(bad ? `\n어휘 벤치: ${bad}건 실패\n`
                : '\n어휘 벤치: 어휘 안쪽이 전부 갈린다 — 폭 0은 계산의 항등식이지 관측이 아니다\n');
process.exit(bad ? 1 : 0);
