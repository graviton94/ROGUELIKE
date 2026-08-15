/* honest.mjs — 봇이 잰 판이 정말로 「판」인가.

   시스템 리뷰가 잡은 것이고, 이 하네스에서 가장 조용한 종류의 거짓말이다.

   `runBot`은 `guard++ < 60000`으로 돈다. 그런데 게임 턴을 소비하지 않는
   반복이 섞여 있어서(장비 교체, 해체, 실패하는 행동), guard가 먼저 닳는
   판이 생긴다. 그 판은 **죽지 않았는데 끝난다** — `G.running`이 참인
   채로. 그리고 그 판의 도달 층이 「거기서 죽었다」와 똑같이 평균에
   섞인다.

   실측: 60판에서 7판(12%)이 그렇게 끝났다. 12층까지 갔다가 멈춘 판도
   있었다. `cls.mjs`·`whodies.mjs`·`tension.mjs`의 도달 층 평균이 전부
   이 검열된 표본을 포함하고 있고, 지금까지 아무 벤치도 이걸 안 봤다.

   이 파일이 그 감시자다. 여기가 빨간 동안에는 어떤 밸런스 변경도
   그 효과와 라이브락 발생률 변화를 구분할 수 없다.

   usage: node sim/honest.mjs [판수]                        */
import { runBot } from './_botlib.mjs';

/* 기본 60판이었다. 실측 막힘률이 1.2%(588판)인데 문턱이 2%였으니
   λ=0.72의 포아송에서 2건 이상 = 16% — 이 벤치가 여섯 번에 한 번
   저절로 빨개졌다. 문턱을 재려는 값 **위에** 올려놓은 것이고,
   그 상태에서는 「막힘이 늘었다」와 「주사위가 그랬다」를 구별할 수
   없다. 표본을 200판으로 늘리고 문턱을 3%로 연다: 참값 1.2%에서
   200판이면 6건 이상이 나올 확률이 2% 아래다. */
const N = Number(process.argv[2] || 200);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

console.log(`\n정직 벤치 — 봇이 잰 판이 정말로 판인가 (${N}판)\n`);

const rows = [];
for (let i = 0; i < N; i++) rows.push(runBot('human', CLASSES[i % CLASSES.length], i % 2 === 0));

const won   = rows.filter(r => r.win);
const stuck = rows.filter(r => !r.win && (r.stuck || r.killer === '?'));
const died  = rows.filter(r => !r.win && !(r.stuck || r.killer === '?'));

const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

console.log(`      죽음 ${died.length} · 승리 ${won.length} · 막힘 ${stuck.length}`);
console.log(`      도달 층 — 죽은 판 ${avg(died.map(r => r.depth)).toFixed(1)}`
  + ` · 막힌 판 ${avg(stuck.map(r => r.depth)).toFixed(1)}`);
if (stuck.length) {
  console.log('');
  for (const r of stuck.slice(0, 6))
    console.log(`      막힘: ${r.depth}층 · ${r.turn}턴 · Lv${r.lv}`);
}
console.log('');

/* 막힌 판이 평균을 얼마나 밀어 올리는가. 「12%가 섞여 있다」보다
   「그래서 층 평균이 얼마나 틀렸다」가 고쳐야 할 이유를 말한다. */
const withStuck = avg(rows.map(r => r.depth));
const clean = avg(rows.filter(r => !(r.stuck || r.killer === '?')).map(r => r.depth));
console.log(`      도달 층 평균 — 전부 ${withStuck.toFixed(2)} · 막힌 판을 빼면 ${clean.toFixed(2)}`
  + ` (차이 ${(withStuck - clean).toFixed(2)}층)\n`);

ok(stuck.length / N < 0.03,
   '판의 3% 미만만 죽지도 이기지도 않고 끝난다 — 이보다 많으면 도달 층 통계가 검열된 표본이다',
   `${stuck.length}/${N}판 (${Math.round(stuck.length / N * 100)}%)`);
/* 이 줄도 지웠다. 막힘을 10%까지 올린 상태에서도 −0.09층으로 통과했다 —
   잡으라고 만든 바로 그 상황에서 안 울린다. 막힌 판은 살아 있는 채로
   끝나므로 도달 층이 죽은 판과 비슷하고, 그래서 평균이 안 움직인다.
   움직이지 않는다는 사실 자체가 이 지표가 못 쓸 물건이라는 뜻이다.
   판정은 막힘 비율 하나가 한다. */
console.log(`      (참고) 막힌 판을 빼면 ${(withStuck - clean).toFixed(2)}층 움직인다 — 판정에는 안 쓴다`);
ok(rows.every(r => r.win || r.killer !== '?' || r.stuck),
   '끝난 이유가 없는 판이 없다 — 이유 없이 끝난 판은 무엇을 잰 것인지 알 수 없다');

console.log(bad ? `\n정직 벤치: ${bad}건 실패\n` : '\n정직 벤치: 잰 판이 전부 진짜 판이다\n');
process.exit(bad ? 1 : 0);
