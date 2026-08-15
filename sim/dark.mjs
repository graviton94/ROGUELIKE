/* dark.mjs — 어둠이 삼킨 예고를, 세계가 삼켰다고 말하는가.

   `readIntents()`는 불이 꺼져 있으면 멀리 있는 것의 예고를 지운다.
   그것은 규칙으로서는 옳지만 **화면으로서는 고장과 구별되지 않는다** —
   처음 하는 사람에게 「붉은 별이 안 떴는데 2.5배를 맞았다」는 버그다.

   그래서 규칙은 예고를 삼킨 그 자리에서 깃발 하나를 세우고(`G.darkAte`),
   화면은 그것을 읽어 수업 카드를 한 번 띄운다. 규칙은 여전히 수업이라는
   것이 있는 줄 모른다.

   재는 것 넷:
     · 어두우면 멀리 있는 `heavy` 예고가 정말 지워지는가
     · 지워질 때 깃발이 서는가
     · 밝은 방 안에서는 지워지지도, 깃발이 서지도 않는가
     · 가벼운 예고(`close`)가 지워지는 것으로는 깃발이 서지 않는가
       — 못 본 것을 못 봤다고 말할 필요는 없다. 값진 것만 말한다.

   usage: node sim/dark.mjs                                        */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const W = await import('../src/world.js');
const G = Game.G;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

/* 곧은 굴 하나. 여섯 칸 떨어뜨려 세운다 — 두 칸 안은 어둠과 무관하게
   언제나 보이고, 그 규칙을 재려는 게 아니다. */
function stage({ oil, lit, wind }) {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(6);
  const L = G.level, p = G.player;
  for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = W.ROCK;
  L.roomOf.fill(-1);
  for (const r of L.rooms) { r.lit = false; r.bright = false; }
  const y = 12;
  for (let x = 3; x <= 40; x++) L.tiles[W.idx(x, y)] = W.FLOOR;
  /* 밝은 방을 재려면 방이 있어야 한다: 굴 전체를 0번 방으로 삼고
     그 방의 불을 켠다. 방 밖이면 `roomOf`가 −1이라 언제나 어둡다. */
  if (lit) {
    for (let x = 3; x <= 40; x++) L.roomOf[W.idx(x, y)] = 0;
    if (L.rooms[0]) L.rooms[0].lit = true;
  }
  p.x = 10; p.y = y;
  p.lightTurns = oil;
  p.hp = p.maxhp;
  p.relics = [];
  G.monsters.length = 0;
  const spec = D.MONSTERS.find(m => m.spr === 'orc') || D.MONSTERS[0];
  const m = { ...spec, hp: spec.hp, maxhp: spec.hp,
              x: 16, y, awake: true, energy: 0, wind: wind ? 1 : 0 };
  G.monsters.push(m);
  Game.recalc(p); Game.refreshFov();
  G.darkAte = false;
  Game.endTurn(true);              // 몬스터는 안 굴린다 — wind가 살아 있어야 한다
  return m;
}

console.log('\n어둠 벤치 — 삼킨 예고를 삼켰다고 말하는가\n');

/* 1. 무대가 실제로 그 상태인지부터. 예고가 애초에 heavy가 아니면
      아래 셋 전부가 못 틀리는 칸이 된다. */
{
  const m = stage({ oil: 500, lit: false, wind: true });
  ok(m.intent === 'heavy', '밝을 때 여섯 칸 밖 wind는 heavy로 읽힌다', m.intent);
  ok(G.darkAte === false, '보이는 예고에는 깃발이 서지 않는다', G.darkAte);
}

/* 2. 어둠. */
{
  const m = stage({ oil: 0, lit: false, wind: true });
  ok(m.intent === null, '불이 꺼지면 여섯 칸 밖 heavy가 지워진다', String(m.intent));
  ok(G.darkAte === true, '지운 자리에서 깃발이 선다', G.darkAte);
}

/* 3. 밝은 방은 제 불이 아니어도 보인다. */
{
  const m = stage({ oil: 0, lit: true, wind: true });
  ok(m.intent === 'heavy', '밝은 방 안이면 불이 꺼져도 보인다', String(m.intent));
  ok(G.darkAte === false, '보이는데 깃발이 서지는 않는다', G.darkAte);
}

/* 4. 값싼 예고는 말하지 않는다. wind가 없으면 여섯 칸 밖은 `close`고,
      그것이 지워지는 것은 사람이 눈치채지도 못한다. */
{
  const m = stage({ oil: 0, lit: false, wind: false });
  ok(m.intent === null, '불이 꺼지면 close도 지워진다', String(m.intent));
  ok(G.darkAte === false, '그러나 close로는 깃발이 서지 않는다', G.darkAte);
}

console.log(bad ? `\n✗ ${bad}건\n` : '\n· 전부 통과\n');
process.exit(bad ? 1 : 0);
