/* ═══════════════════════════════════════════════════════════
   throne.mjs — 이기는 것이 실패다

   DESIGN.md §1·§4. 최심부에 서 있는 것은 **전대 용사**이고, 그것을
   눕힌 뒤에 무슨 일이 일어나는지가 신앙심으로 갈린다.

   이 파일이 지키는 것 넷:

   ① **다음 판의 보스는 지난 판의 나다.** meta.last 가 이미 종족·직업·
      레벨·무기·유물·신·선물을 갖고 있다. 새 배관 없음.
   ② **받은 선물이 그대로 얹힌다.** 강해져서 내려간 판일수록 다음 판의
      보스가 강하다 — 이 게임에서 신이 실제로 속이는 자리다.
   ③ **진 엔딩 판은 안 앉는다.** 거절한 사람이 다음 사람의 악마가 되면
      이 게임이 말하려는 것과 정반대가 된다.
   ④ **끝이 셋이고 조건이 겹치지 않는다.** 왕좌 · 빈손 · 진 엔딩.

   usage: node sim/throne.mjs
   ═══════════════════════════════════════════════════════════ */
import * as Game from '../src/game.js';
import * as Meta from '../src/meta.js';
import { BOSS, PIETY_ZEAL, REFUSE, MAX_SHACKLE } from '../src/data.js';

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };
const G = Game.G;

const fresh = () => Game.startGame('human', 'warrior', Game.rollStats('warrior'));
const won = extra => ({ win: true, race: 'dwarf', cls: 'paladin', lv: 18, depth: 15,
                        turn: 3000, relics: ['a', 'b'], weapon: '약속 +5', sent: 7,
                        gifts: [], refused: 0, ...extra });

console.log('\n왕좌 벤치 — 이기는 것이 실패다\n');

/* ── ① 앞선 자가 없으면 원래의 것이 선다 ────────────────── */
Meta.forget();
fresh();
const first = Game.lastHero();
ok(first.n === BOSS.n && first.hp === BOSS.hp,
   '① 처음 내려가는 사람에게는 원래의 대군주가 선다', `${first.n} hp ${first.hp}`);
ok(!first.wasHero, '   그리고 그것은 누구도 아니다');

/* ── ② 이긴 판이 다음 보스가 된다 ───────────────────────── */
console.log('');
Meta.forget();
Meta.finish(won({ kind: 'throne', gifts: ['ember', 'blood', 'hush'] }));
fresh();
const heavy = Game.lastHero();
ok(heavy.n.includes('팔라딘'), '② 다음 판의 보스가 지난 판의 나다', heavy.n);
ok(heavy.hp > BOSS.hp && heavy.atk > BOSS.atk,
   '   그리고 원래의 것보다 무겁다',
   `hp ${BOSS.hp}→${heavy.hp} · atk ${BOSS.atk}→${heavy.atk}`);
ok(heavy.worn === '약속 +5', '   들고 있던 것이 따라온다', heavy.worn);
ok(heavy.wasHero?.gifts.length === 3, '   받은 선물도 기록에 남는다',
   heavy.wasHero.gifts.join(' '));

/* 선물을 안 받은 판은 가볍다. 「강해져서 내려가는 것이 다음 악마를
   빚는다」가 규칙이 되는 자리 — 여기서 안 갈리면 그건 문장일 뿐이다. */
Meta.forget();
Meta.finish(won({ kind: 'hollow', gifts: [], refused: 0 }));
fresh();
const light = Game.lastHero();
ok(light.hp < heavy.hp,
   '   선물을 덜 받은 판은 **덜 무거운** 보스를 남긴다 — 이것이 그 거짓말의 구현이다',
   `선물 0 → hp ${light.hp} · 선물 3 → hp ${heavy.hp}`);

/* ── ③ 진 엔딩은 앉지 않는다 ────────────────────────────── */
console.log('');
Meta.forget();
Meta.finish(won({ kind: 'throne', gifts: ['ember'] }));
const seated = Game.lastHero().hp;
Meta.finish({ win: true, kind: 'true', race: 'elf', cls: 'mage', lv: 20, depth: 15,
              turn: 2800, gifts: [], refused: 3, relics: [], weapon: '막대기', sent: 8 });
fresh();
const after = Game.lastHero();
ok(after.hp === seated && !after.n.includes('마법사'),
   '③ 진 엔딩으로 끝낸 판은 왕좌에 안 앉는다 — 앞의 것이 그대로 남는다',
   `${after.n} hp ${after.hp}`);

/* ── ④ 끝 셋이 안 겹치는가 ──────────────────────────────── */
console.log('');
const kindOf = (piety, refused, gifts, abyss) => {
  fresh();
  G.piety = piety; G.refused = refused;
  G.gifts = new Array(gifts).fill('x'); G.abyss = abyss;
  return Game.endKind();
};
const NAME = { throne: '왕좌', hollow: '빈손', true: '진 엔딩' };
console.log('  신앙심  거절  선물  심연   →  끝');
const cases = [
  [90, 0, 3, 0, 'throne'], [45, 0, 3, 0, 'hollow'],
  [20, 3, 0, 0, 'hollow'], [20, 3, 0, MAX_SHACKLE, 'true'],
  [75, 3, 0, MAX_SHACKLE, 'throne'], [20, 2, 1, MAX_SHACKLE, 'hollow'],
];
for (const [p, r, g, a, want] of cases) {
  const got = kindOf(p, r, g, a);
  console.log('  ' + String(p).padStart(5) + String(r).padStart(6) + String(g).padStart(6)
    + String(a).padStart(6) + '   →  ' + NAME[got]);
  if (got !== want) { bad++; console.log(`      ✗ ${NAME[want]} 여야 한다`); }
}
console.log('');
ok(kindOf(20, 3, 0, MAX_SHACKLE - 1) !== 'true',
   `④ 심연 ${MAX_SHACKLE}단 아래에서는 진 엔딩이 안 열린다 — 거절 버튼 자체가 잠겨 있다`);
ok(kindOf(20, 3, 1, MAX_SHACKLE) !== 'true',
   '   선물을 하나라도 받았으면 안 열린다');
ok(kindOf(PIETY_ZEAL, 3, 0, MAX_SHACKLE) === 'throne',
   '   광신이면 거절했어도 앉는다 — 계율을 어겨 신앙심을 깎는 우회로를 막는다');

console.log(bad ? `\n왕좌 벤치: ${bad}건 실패\n` : '\n왕좌 벤치: 다음 용사는 나를 죽이러 온다\n');
process.exit(bad ? 1 : 0);
