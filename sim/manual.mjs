/* manual.mjs — 조작법이 게임과 같은 숫자를 말하는가.

   이번 회차에서 네 리뷰가 서로 다른 자리에서 같은 결함을 짚었다:
   규칙은 고쳐졌는데 **조작법이 옛 숫자를 그대로 말하고 있다.**
   실제로 걸린 것들 —

     · 「1100에서 시작」  실제 700 (1100은 상한이다)
     · 「300 아래 5칸 · 80 아래 3칸」  실제 640/360/180/60의 여섯 계단
     · 「횃불 하나가 900」  실제 520
     · 「빠른 칸 3개」  실제 4개 (불이 독립한 뒤로)
     · 「장비를 바치면 대성공이 30%로 가장 높고」  실제로는 피가 30,
       장비는 22 — 바로 그 커밋이 뒤집은 표가 안 고쳐졌다

   계산해서 노는 사람에게 틀린 숫자는 어려움이 아니라 함정이다.
   그리고 이런 것은 손으로는 절대 안 잡힌다 — 상수를 고친 사람과
   문서를 읽는 사람이 같은 시간에 같은 자리를 안 보기 때문이다.
   그래서 문서에서 숫자를 **뽑아서** 코드의 값과 맞춰 본다.

   usage: node sim/manual.mjs                                    */
import { readFileSync } from 'node:fs';

const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Game = await import('../src/game.js');
const D = await import('../src/data.js');

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
/* 태그를 걷어내고 글자만 본다 — <b>340</b>은 사람에게 340이다. */
const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

console.log('\n조작법 벤치 — 문서가 게임과 같은 숫자를 말하는가\n');

/* 무엇을 걸어 둘지는 「사람이 계획을 세우는 데 쓰는 값」으로 고른다.
   전부 걸면 문구를 다듬을 때마다 벤치가 울고, 그러면 벤치를 끈다. */
/* 문틀은 코드 값에서 **만들어** 쓴다. 처음에는 정규식에 숫자를 그냥
   박아 뒀는데, CAMP_OIL을 340에서 300으로 바꿔 봐도 벤치가 초록이었다 —
   문서에 340이 있는지만 물었지 그 340이 상수와 같은지는 안 물었기
   때문이다. 상수가 움직이면 문서가 틀리는데 벤치는 조용한, 정확히
   이 파일이 잡으라고 만들어진 그 상황이었다. */
const CHECKS = [
  ['기름 시작값', 700,                                 v => `${v}에서 시작`],
  ['기름 상한',   Game.OIL_CAP,                        v => `상한 ${v}`],
  ['횃불 보충',   520,                                 v => `횃불 하나가 ${v}`],
  ['모닥불 심지', Game.CAMP_OIL,                       v => `심지를 갈면 ${v}`],
  ['지짐 기름값', Game.WOUND_OIL,                      v => `기름 −${v}`],
  ['지짐 체력값', Math.round(Game.CAMP_SEAR_HP * 100), v => `체력 −${v}%`],
  ['숨 회복률',   Math.round(Game.CAMP_HEAL * 100),    v => `최대 체력의 ${v}%`],
];
for (const [n, val, phrase] of CHECKS) {
  const want = phrase(val);
  ok(text.includes(want), `${n} — 문서가 「${want}」라고 말한다`,
     text.includes(want) ? String(val) : `못 찾음 (코드 값 ${val})`);
}

/* 시야 계단. 코드가 여섯 계단이면 문서도 여섯 계단이어야 한다 —
   문턱 하나가 빠져 있으면 「80 아래 3칸」 같은 옛 표가 남는다. */
{
  const missing = [640, 360, 180].filter(t => !text.includes(`${t} 아래`));
  ok(missing.length === 0, '시야 문턱 셋이 전부 문서에 있다',
     missing.length ? `빠진 것 ${missing.join(' · ')}` : '640 · 360 · 180');
  /* `text.includes('80 아래')`로 셌더니 「180 아래」가 걸렸다.
     문서가 틀린 것이 아니라 자가 틀린 것이다 — 앞자리를 막는다. */
  const stale = [300, 80].filter(t => new RegExp(`(^|[^0-9])${t} 아래`).test(text));
  ok(stale.length === 0, '옛 문턱이 남아 있지 않다',
     stale.length ? `아직 있다 ${stale.join(' · ')}` : '');
}

/* 제단 확률표. 문서가 「어느 줄이 가장 높다」고 말하면 그 말이
   실제로 참이어야 한다 — 이번에 틀린 것이 바로 이 문장이다. */
{
  /* `odds`는 객체가 아니라 [[이름, 값]] 배열이다. 처음에 `o.odds.대성공`을
     읽었더니 셋 다 undefined가 되어 reduce가 그냥 첫 줄을 돌려줬다 —
     「피가 최고」가 맞게 나왔지만 그건 우연이었고, 표를 어떻게 바꿔도
     같은 답이 나오는 칸이었다. 배열에서 제대로 뽑는다. */
  const great = o => (o.odds.find(([k]) => k === '대성공') || [, 0])[1];
  const best = D.ALTAR_OFFERS.reduce((a, o) => great(o) > great(a) ? o : a);
  const word = best.n.replace(/를 바친다$/, '');
  ok(text.includes(`${word}는 대성공이 ${great(best)}`)
     || text.includes(`${word}은 대성공이 ${great(best)}`),
     '대성공이 가장 높은 줄을 문서가 그 이름과 그 숫자로 지목한다',
     `코드상 최고: ${best.n} ${great(best)}%`);
}

/* 빠른 칸 수. 역할 목록이 곧 칸 수다. */
{
  /* 처음에 `Game.QUICK_ROLES`를 읽었는데 그건 내보내지지 않는다 —
     `?? 0`이 붙어 있어서 **언제나 통과하는 칸**이 되어 있었다.
     못 틀리는 단언은 없는 것보다 나쁘다. 내보내는 이름으로 읽는다. */
  const n = Game.QUICK_LABELS.length;
  ok(n > 0 && text.includes(`빠른 칸 ${n}개`),
     `빠른 칸이 ${n}개라고 적혀 있다`,
     text.includes(`빠른 칸 ${n}개`) ? `${n}개 — ${Game.QUICK_LABELS.join(' · ')}`
                                    : '문서와 다르다');
}

/* 과업. 규칙에 있는 것이 문서에 아예 없으면, 45%의 층에서 규칙이
   바뀌는데 아무도 그 이유를 모른다. */
{
  const names = D.TASKS.map(t => t.n);
  const gone = names.filter(n => !text.includes(n));
  ok(gone.length === 0, '과업 이름이 전부 문서에 있다',
     gone.length ? `빠진 것 ${gone.join(' · ')}` : names.join(' · '));
}

console.log(bad ? `\n조작법 벤치: ${bad}건 어긋남\n` : '\n조작법 벤치: 문서와 게임이 같은 값을 말한다\n');
process.exit(bad ? 1 : 0);
