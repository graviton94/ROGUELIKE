/* fallen.mjs — 앞서 간 사람이 실제로 거기 있는가.

   이 게임의 이야기는 「아무도 돌아오지 못했다」인데, 지금까지 그 말은
   문장으로만 있었다. 지역 문장이 말하고 사건 하나가 흉내 냈지만,
   거기 누워 있는 것은 아무도 아니었다 — 생성기가 만든 익명의 시체다.

   이제 지난 판의 **당신**이 그 층에 놓인다. 그래서 이 벤치는 두 판을
   이어서 잰다: 한 판을 죽이고, 다음 판을 시작해서, 그 층에 그가
   있는지. 한 판만 재면 확인할 수 있는 것이 아무것도 없다.

   usage: node sim/fallen.mjs                        */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const name = it => D.affixName(it);
const W = await import('../src/world.js');
const G = Game.G;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

console.log('\n앞선 자 벤치 — 지난 판의 내가 거기 있는가\n');

/* ── 1. 죽으면 남는다 ────────────────────────────────────── */
Meta.forget();
{
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(5);
  const p = G.player;
  /* 알아볼 수 있는 무기를 쥐여 준다 — 다음 판에서 「그 무기가 맞는가」를
     물으려면 표시가 있어야 한다. */
  p.equip.weapon = { ...D.WEAPONS[6], kind:'weapon', plus:4, pre: D.PREFIXES[0].id };
  p.gold = 500;
  p.relics = ['pact'];
  Game.recalc(p);
  const mine = name(p.equip.weapon);
  Meta.finish(Game.summarise(false, '오우거'));

  const fallen = Meta.read().fallen;
  ok(fallen.length === 1, '죽은 판이 하나 남았다', `${fallen.length}구`);
  ok(fallen[0].depth === 5, '죽은 층이 기록된다', `${fallen[0].depth}층`);
  ok(fallen[0].by === '오우거', '무엇에게 죽었는지도', fallen[0].by);
  ok(!!fallen[0].weapon, '들고 있던 무기가 이름이 아니라 물건으로 남는다',
     fallen[0].weapon ? name(fallen[0].weapon) : '없음');
  ok(fallen[0].gold > 0 && fallen[0].gold < 500,
     '주머니는 일부만 남는다 — 죽으면 흩어진다', `${fallen[0].gold}닢`);

  /* 완주한 사람은 아래에 없다. */
  Game.startGame('human', 'mage', Game.rollStats('mage'));
  Game.descend(); Game.enterDepth(9);
  Meta.finish(Game.summarise(true, null));
  ok(Meta.read().fallen.every(f => f.depth !== 9),
     '걸어 나간 판은 시체를 안 남긴다', Meta.read().fallen.map(f => `${f.depth}층`).join(','));
  globalThis.__mine = mine;
}

/* ── 2. 다음 판의 그 층에 놓인다 ──────────────────────────── */
{
  Game.startGame('human', 'rogue', Game.rollStats('rogue'));
  Game.descend();
  let found = null;
  for (let d = 1; d <= 8 && !found; d++) {
    Game.enterDepth(d);
    found = G.items.find(o => o.kind === 'fallen');
    if (found) ok(d === 5, '기록된 층에서만 나온다', `${d}층`);
  }
  ok(!!found, '앞서 간 사람이 층에 놓인다', found ? `${found.rec.sent}번째` : '없음');
  if (!found) { console.log('\n앞선 자 벤치: 세울 수 없어 중단\n'); process.exit(1); }

  const p = G.player;
  p.x = found.x; p.y = found.y;
  Game.refreshFov();
  ok(G.screen !== 'event', '밟았다고 화면이 열리지 않는다', G.screen);
  const here = Game.hereOffer();
  ok(here?.fallen, '발밑 버튼이 그를 가리킨다', here?.n);
  ok(Game.openHere() && G.screen === 'event', '눌러야 열린다');

  const offer = Game.eventOffer();
  const ids = offer.opts.map(o => o.id);
  console.log(`\n      ── ${offer.n}`);
  console.log(`      ${offer.t}`);
  for (const o of offer.opts) console.log(`      · ${o.n}`);
  console.log('');
  ok(offer.fallenOffer, '시체 화면으로 뜬다');
  ok(ids.includes('take') && ids.includes('purse') && ids.includes('relic'),
     '남긴 것이 전부 목록에 오른다', ids.join(','));
  ok(ids.includes('raise') && ids.includes('leave'),
     '일으켜 세우거나, 그대로 둘 수 있다');
}

/* ── 3. 하나만 가져간다 ──────────────────────────────────── */
{
  const p = G.player;
  const before = p.pack.length;
  const offer = Game.eventOffer();
  Game.eventChoose(offer.opts.findIndex(o => o.id === 'take'));
  ok(p.pack.length === before + 1, '고른 하나가 들어온다', `${before} → ${p.pack.length}줄`);
  ok(p.pack.some(sl => name(sl.item) === globalThis.__mine),
     '지난 판에 내가 벼려 놓은 그 무기가 맞다', globalThis.__mine);
  ok(!G.items.some(o => o.kind === 'fallen'),
     '나머지는 그와 함께 남는다 — 전부 가지려면 일으켜 세워야 한다');
  ok(G.screen === 'play', '고르고 나면 지도로 돌아온다', G.screen);
}

/* ── 4. 일으켜 세우면 세다, 그리고 전부 준다 ─────────────── */
{
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend(); Game.enterDepth(6);
  const dead = G.player;
  dead.equip.weapon = { ...D.WEAPONS[8], kind:'weapon', plus:6 };
  dead.gold = 900; dead.relics = ['echo']; dead.lv = 12;
  Game.recalc(dead);
  Meta.finish(Game.summarise(false, '동굴 트롤'));

  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  let body = null;
  for (let d = 1; d <= 8 && !body; d++) { Game.enterDepth(d); body = G.items.find(o => o.kind === 'fallen'); }
  ok(!!body, '두 번째 판에도 놓인다');
  const p = G.player;
  p.x = body.x; p.y = body.y;
  Game.refreshFov(); Game.openHere();
  const offer = Game.eventOffer();
  const monsters0 = G.monsters.length;
  Game.eventChoose(offer.opts.findIndex(o => o.id === 'raise'));
  const risen = G.monsters.find(m => m.drops);
  ok(G.monsters.length === monsters0 + 1, '일어선다', `${monsters0} → ${G.monsters.length}마리`);
  ok(!!risen && risen.hp > 150,
     '살아 있던 때보다 세다 — 깊이 갔던 판일수록 무섭다', `체력 ${risen?.hp}`);
  ok(risen?.named, '이름 있는 것으로 친다 — 시야를 끊어도 놓아 주지 않는다');

  /* 쓰러뜨리면 전부 준다. */
  const gold0 = p.gold;
  risen.hp = 1;
  Game.hurtMonster(risen, 999);
  const gotGold = p.gold > gold0;
  const dropped = G.items.some(o => o.kind === 'weapon' || o.kind === 'relic');
  ok(gotGold || dropped, '쓰러뜨리면 남긴 것이 나온다',
     `금화 ${p.gold - gold0} · 바닥 ${G.items.length}점`);
}

console.log(bad ? `\n앞선 자 벤치: ${bad}건 실패\n` : '\n앞선 자 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
