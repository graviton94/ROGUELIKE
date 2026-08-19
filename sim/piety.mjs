/* ═══════════════════════════════════════════════════════════
   piety.mjs — 신앙심은 저주다

   DESIGN.md §4. 자원이 아니라 저주다 — 쌓이는 것이지 모으는 것이
   아니다. 이 파일이 지키는 것 넷:

   ① **두 갈래로 오르고 한쪽만 막을 수 있다.**
      층을 내려가는 것(막을 수 없다) + 선물을 받는 것(거절로 막는다).
   ② **거절해도 물든다.** 짙어지는 것은 신이 하는 일이 아니라 이
      장소가 하는 일이다. 거절은 **광신을 막을 뿐** 물듦을 막지 못한다.
   ③ **계율은 제 신에게만 걸린다.** 그리고 어기면 신앙심이 깎이는
      것으로 끝나지 않고 그 층의 **선물이 꺼진다** — 잃을 것이 없으면
      계율이 아니라 난이도 손잡이다.
   ④ **신앙심이 곧 화면이다.** 규칙 쪽은 0~100 숫자만 알고(§5 「규칙은
      세계관을 모른다」), 뒤틀림으로 옮기는 자리는 하나뿐이어야 한다.

   usage: node sim/piety.mjs
   ═══════════════════════════════════════════════════════════ */
import * as Game from '../src/game.js';
import { PIETY_MAX, PIETY_FLOOR, PIETY_GIFT, PIETY_BREAK, PIETY_STIR, PIETY_ZEAL,
         VOW_BREAK, GODS, PLEDGE_AT, MAX_DEPTH } from '../src/data.js';

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };
const G = Game.G;

const fresh = () => {
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  G.god = null; G.gifts = []; G.refused = 0; G.piety = 0; G.vowBroke = -1;
};

/* 한 판을 층으로 걸어 본다. take=true 면 4·8·12에서 전부 받는다. */
const walk = take => {
  fresh();
  const seen = {};
  let zeal = null, stir = null;
  for (let d = 1; d <= MAX_DEPTH; d++) {
    if (PLEDGE_AT.includes(d)) {
      if (take) Game.pledge(GODS[PLEDGE_AT.indexOf(d)].id);
      else G.refused++;
    }
    Game.piety(PIETY_FLOOR, 'depth');
    if (!stir && G.piety >= PIETY_STIR) stir = d;
    if (!zeal && G.piety >= PIETY_ZEAL) zeal = d;
    seen[d] = G.piety;
  }
  return { seen, zeal, stir, end: G.piety };
};

console.log('\n신앙심 벤치 — 저주는 쌓이는 것이다\n');

const took = walk(true), left = walk(false);
console.log('  경우          4층  8층  12층  15층   광신    어긋남');
for (const [n, r] of [['전부 받는다', took], ['전부 거절', left]])
  console.log('  ' + n.padEnd(12)
    + String(r.seen[4]).padStart(4) + String(r.seen[8]).padStart(5)
    + String(r.seen[12]).padStart(6) + String(r.seen[15]).padStart(6)
    + '   ' + (r.zeal ? r.zeal + '층' : '안 닿음').padEnd(8)
    + (r.stir ? r.stir + '층' : '안 닿음'));

console.log('');
ok(took.zeal !== null && took.zeal <= 12,
   '① 셋 다 받으면 12층까지 광신에 닿는다', `${took.zeal}층`);
ok(left.zeal === null,
   '   전부 거절하면 광신에 안 닿는다 — 그것이 진 엔딩의 조건이다',
   `15층에 ${left.end} (문턱 ${PIETY_ZEAL})`);
ok(left.end > 0 && left.stir !== null,
   '② 그래도 물든다 — 거절은 광신을 막을 뿐 물듦을 막지 못한다',
   `${left.stir}층에서 화면이 어긋나기 시작`);
ok(left.end === MAX_DEPTH * PIETY_FLOOR,
   '   거절한 판의 신앙심은 층 몫뿐이다', `${MAX_DEPTH}×${PIETY_FLOOR} = ${left.end}`);
ok(took.end - left.end === PLEDGE_AT.length * PIETY_GIFT,
   '   받은 몫이 정확히 선물 셋이다', `${took.end} − ${left.end} = ${took.end - left.end}`);

/* ── ③ 계율 ──────────────────────────────────────────────── */
console.log('');
for (const [god, kind] of Object.entries(VOW_BREAK)) {
  fresh();
  G.depth = 5; G.god = god; G.piety = 50;
  const before = Game.blessed(god);
  const hit = Game.breakVow(kind);
  ok(hit && before && !Game.blessed(god) && G.piety === 50 - PIETY_BREAK,
     `③ ${godName(god)} — ${kind} 를 어기면 신앙심이 깎이고 선물이 꺼진다`,
     `50 → ${G.piety} · 선물 ${Game.blessed(god) ? '켜짐' : '꺼짐'}`);
}
function godName(id) { return GODS.find(g => g.id === id)?.n || id; }

/* 남의 계율은 안 걸린다. 하나라도 걸리면 다섯 신이 같은 금지를 갖는
   것이고, 그러면 신을 고르는 일이 의미를 잃는다. */
console.log('');
let cross = 0;
for (const [god] of Object.entries(VOW_BREAK))
  for (const [other, kind] of Object.entries(VOW_BREAK)) {
    if (god === other) continue;
    fresh();
    G.depth = 5; G.god = god; G.piety = 50;
    if (Game.breakVow(kind)) cross++;
  }
ok(cross === 0, '   그리고 남의 계율은 안 걸린다 — 안 그러면 신을 고르는 일이 의미를 잃는다',
   `${cross}건`);

/* 같은 층에서 두 번 어겨도 한 번만 깎인다 — 매 턴 깎이면 그건 계율이
   아니라 출혈이다. */
fresh();
G.depth = 5; G.god = 'blood'; G.piety = 50;
Game.breakVow('gulp');
const once = G.piety;
Game.breakVow('gulp');
ok(G.piety === once, '   한 층에서는 한 번만 깎인다 — 매 턴 깎이면 출혈이지 계율이 아니다',
   `${once} → ${G.piety}`);

/* ── ④ 신앙심이 곧 뒤틀림인가 ───────────────────────────── */
console.log('');
fresh();
const pairs = [[0, 0], [35, 0.35], [70, 0.70], [100, 1]];
const wrong = pairs.filter(([p, w]) => { G.piety = p; return Math.abs(Game.warpOf() - w) > 0.001; });
ok(wrong.length === 0, '④ 신앙심이 그대로 뒤틀림이 된다 — 옮기는 자리는 하나다',
   pairs.map(([p]) => { G.piety = p; return `${p}→${Game.warpOf().toFixed(2)}`; }).join(' '));
G.piety = PIETY_MAX + 999;
ok(Game.warpOf() <= 1, '   그리고 1을 안 넘는다', Game.warpOf().toFixed(2));

/* ── ⑤ 덫이 정직한 값 위에 서 있는가 ────────────────────
   이 게임에서 가장 큰 거짓말은 **말투**에 있다(§1). 계율을 어기는 것은
   신앙심을 깎고, 신앙심이 낮은 것이 진 엔딩으로 가는 유일한 길이다.
   그런데 화면은 그것을 재앙처럼 말한다.

   그러니 값은 반드시 정직해야 한다 — 말투가 거짓이면 값이라도 참이어야
   플레이어가 나중에 되짚어 볼 수 있다. 어긴 대가는 −8 과 그 층의
   선물뿐이고, 그 이상은 없다. */
console.log('');
fresh();
G.depth = 5; G.god = 'blood'; G.piety = 50;
const hp0 = G.player.hp, stam0 = G.player.stam, gold0 = G.player.gold;
Game.breakVow('gulp');
ok(G.player.hp === hp0 && G.player.stam === stam0 && G.player.gold === gold0,
   '⑤ 계율을 어겨도 몸·기력·금화는 안 건드린다 — 값은 정직하다',
   `−${PIETY_BREAK} 과 그 층의 선물뿐`);
ok(Game.vowRisk('gulp') === null,
   '   이미 어긴 층에서는 더 경고하지 않는다 — 돌아설 곳이 없다');
fresh();
G.depth = 5; G.god = 'blood'; G.piety = 50;
const risk = Game.vowRisk('gulp');
ok(risk && risk.vow && risk.boon && risk.cost === PIETY_BREAK,
   '   그리고 어기기 **전에** 무엇을 잃는지 다 말한다',
   risk ? `${risk.vow} · ${risk.cost}` : '없음');
ok(Game.vowRisk('shout') === null, '   남의 계율로는 경고하지 않는다');

console.log(bad ? `\n신앙심 벤치: ${bad}건 실패\n` : '\n신앙심 벤치: 거절해도 물들되, 광신에는 안 닿는다\n');
process.exit(bad ? 1 : 0);
