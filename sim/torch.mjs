/* torchbench.mjs — 새로 붙인 불 관련 것들이 실제로 작동하는가.
   사건 셋, 유물 둘, 접미 하나. 룰만 돌린다. */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const EV = await import('../src/events.js');
const G = Game.G;
let bad = 0;
const ok = (cond, msg, got) => { console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`); if (!cond) bad++; };

const fresh = () => { Meta.forget(); Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend(); Game.enterDepth(6); return G.player; };

console.log('\n불 관련 추가분 벤치\n');

/* 1. 사건 셋이 데이터에 있고, 선택지가 전부 run을 가진다 */
const want = ['seep', 'wickseller', 'blackroom'];
for (const id of want) {
  const e = EV.EVENTS.find(x => x.id === id);
  ok(!!e, `사건 「${id}」 존재`);
  if (e) ok(e.opts.every(o => typeof o.run === 'function'), `  선택지 ${e.opts.length}개 전부 실행 가능`);
}

/* 2. 기름을 붓는 api가 실제로 붓는다 — 게임이 사건을 여는 경로 그대로 */
{
  const p = fresh();
  p.lightTurns = 100;
  G.level.eventId = 'seep';
  G.screen = 'event';
  const before = p.lightTurns;
  Game.eventChoose(0);                       // 「심지에 적신다」
  ok(p.lightTurns > before, '스며 나오는 기름 — 심지를 적시면 기름이 는다', `${before} → ${p.lightTurns}`);

  const q = fresh();
  q.lightTurns = 100;
  const hp0 = q.maxhp;
  G.level.eventId = 'wickseller';
  G.screen = 'event';
  Game.eventChoose(0);                       // 「피를 준다」
  ok(q.lightTurns > 100 && q.maxhp < hp0, '심지를 파는 자 — 피를 주면 최대 체력이 줄고 기름이 는다',
     `체력 ${hp0}→${q.maxhp}, 기름 100→${q.lightTurns}`);

  const r = fresh();
  r.lightTurns = 500;
  r.relics = [];
  G.level.eventId = 'blackroom';
  G.screen = 'event';
  Game.eventChoose(0);                       // 「불을 끄고 들어간다」
  ok(r.lightTurns === 0, '불이 닿지 않는 방 — 불을 끄면 기름이 0이 된다', `${r.lightTurns}`);
  ok(r.relics.length > 0, '  대신 유물을 하나 준다', `${r.relics.join(',') || '없음'}`);
}

/* 3. 유물 둘 */
{
  const p = fresh();
  ok(!!D.RELICS.find(r => r.id === 'nighteye'), '유물 「밤에 익은 눈」 존재');
  const ever = D.RELICS.find(r => r.id === 'everflame');
  ok(!!ever, '유물 「꺼지지 않는 불꽃」 존재');
  ok(!!ever?.myth, '  전설(myth) 표시');

  p.relics = ['everflame'];
  p.lightTurns = 0;
  Game.recalc(p); Game.refreshFov();
  ok(G.lightRadius >= 5, '꺼지지 않는 불꽃 — 기름 0에도 반경 5 이상', `${G.lightRadius}칸`);

  p.relics = [];
  p.lightTurns = 0;
  Game.recalc(p); Game.refreshFov();
  ok(G.lightRadius === 2, '유물 없이 기름 0이면 반경 2', `${G.lightRadius}칸`);
}

/* 4. 통 크기 */
{
  const p = fresh();
  p.relics = []; Game.recalc(p);
  const wide = Game.oilCap();
  p.relics = ['nighteye']; Game.recalc(p);
  const narrow = Game.oilCap();
  ok(narrow === wide - 300, '밤에 익은 눈 — 통이 300 작아진다', `${wide} → ${narrow}`);
}

/* 5. 깊이에 따라 더 태운다 */
ok(Game.OIL_BURN(1) === 1 && Game.OIL_BURN(6) === 2 && Game.OIL_BURN(11) === 3,
   '깊을수록 기름을 더 태운다', `${Game.OIL_BURN(1)} / ${Game.OIL_BURN(6)} / ${Game.OIL_BURN(11)}`);

/* 6. 그을음 접미 */
{
  const suf = D.SUFFIXES.find(s => s.id === 'soot');
  ok(!!suf, '접미 「그을음」 존재');
  ok(suf?.lightR === -2 && suf?.dmgPct > 0, '  밝기를 팔아 힘을 산다', `피해 +${Math.round((suf?.dmgPct||0)*100)}% · 반경 ${suf?.lightR}`);
}

/* 7. 전설 게이트 — 8층 위에서는 안 나온다 */
{
  fresh();
  Game.enterDepth(3);
  let sawMyth = 0;
  for (let i = 0; i < 400; i++) { G.player.relics = []; const id = Game.unownedRelic();
    if (id === 'everflame') sawMyth++; }
  ok(sawMyth === 0, '3층에서는 전설이 나오지 않는다', `${sawMyth}회`);
  Game.enterDepth(10);
  /* 400번으로는 네 번에 한 번꼴로 0이 나왔다 — 게임이 아니라 표본이
     모자란 것이다. 유물 풀이 마흔이고 전설은 뽑혀도 넷 중 하나만
     통과하므로, 한 번 부를 때 이 하나가 나올 확률은 1%도 안 된다.
     열 배로 늘리고, 「한 번이라도 나오는가」가 아니라 「대략 이만큼
     나오는가」를 묻는다. */
  let deep = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) { G.player.relics = []; const id = Game.unownedRelic();
    if (id === 'everflame') deep++; }
  ok(deep >= 5, '10층에서는 나온다', `${deep}/${N} (${(deep * 100 / N).toFixed(2)}%)`);
}

console.log(bad ? `\n불 벤치: ${bad}건 실패\n` : '\n불 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
