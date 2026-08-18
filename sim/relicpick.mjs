/* ═══════════════════════════════════════════════════════════
   relicpick.mjs — 유물은 밟는다고 먹히지 않는다

   플레이어: 「유물을 아이템이랑 다르게 자동획득이 아닌 획득할것인지
   묻는 창이 나와야하는거임. 지금은 타일 밟으면 바로 먹어버림.」

   이 게임에서 자리는 4~7칸이고 유물은 규칙을 바꾸는 유일한 물건이다.
   그 선택을 발이 대신 하면 안 된다. 그런데 전리품 더미와 시신은 이미
   「밟으면 로그만, 발밑 버튼이 기다린다」였다 — 유물만 예외였다.

   이 파일이 무는 것 다섯:
     1. 밟아도 안 걸린다 (그리고 바닥에 그대로 있다)
     2. 발밑 버튼이 그 유물을 알아본다
     3. 받으면 걸리고 **바닥에서 사라진다**
     4. 두고 가면 안 걸리고 **바닥에 남는다** — 되돌아올 수 있어야 결정이다
     5. 자리가 찼으면 교체 화면으로 이어지고, 거기서 버려도 한 칸에
        유물이 둘 놓이지 않는다

   4번과 5번이 이 파일의 이유다. 「두고 간다」가 유물을 지우면 그 화면은
   함정이고, 교체가 바닥을 안 치우면 같은 칸에 둘이 겹친다 — 둘 다
   눈으로는 몇 판을 봐도 안 보이는 종류다.

   usage: node sim/relicpick.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const { G } = Game;

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };
console.log('\n유물 줍기 벤치 — 발이 대신 고르지 않는다\n');

/* 판 하나를 세우고 발밑에 유물을 놓는다. */
const stage = (n = 0) => {
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  const p = G.player;
  p.relics = [];
  G.items.length = 0;
  G.pendingRelic = null; G.relicOnFloor = false;
  /* 손을 n개 채운다 — 자리가 찼을 때를 재려면 필요하다. */
  for (let i = 0; i < n; i++) p.relics.push(D.RELICS[i + 5].id);
  const r = D.RELICS[0];
  G.items.push({ kind:'relic', id:r.id, spr:r.spr, n:r.n, x:p.x, y:p.y });
  return { p, r };
};
const onFloor = (p, id) => G.items.some(o => o.kind === 'relic' && o.id === id
  && o.x === p.x && o.y === p.y);

/* ── 1·2. 밟아도 안 먹고, 발밑이 그것을 안다 ─────────────── */
{
  const { p, r } = stage();
  /* 제자리걸음도 「밟는 것」을 지난다 — 발밑을 다시 읽는 자리다. */
  Game.step(0, 0);
  ok(!p.relics.includes(r.id), '밟아도 안 걸린다', p.relics.length ? p.relics.join(',') : '손이 비어 있다');
  ok(onFloor(p, r.id), '   그리고 바닥에 그대로 있다');
  const o = Game.hereOffer();
  ok(o?.screen === 'relic' && o.relic?.id === r.id,
     '발밑 버튼이 그 유물을 알아본다', o ? `${o.screen} · ${o.n}` : '아무것도 없다');
}

/* ── 3. 받으면 걸리고 바닥에서 사라진다 ───────────────────── */
{
  const { p, r } = stage();
  Game.openHere();
  ok(G.screen === 'relic' && G.relicOnFloor, '누르면 유물 화면이 열린다', G.screen);
  Game.acceptRelic();
  ok(p.relics.includes(r.id), '받으면 걸린다', p.relics.join(','));
  ok(!onFloor(p, r.id), '   그리고 바닥에서 사라진다 — 안 지우면 무한히 집힌다');
  ok(!G.pendingRelic && !G.relicOnFloor, '   그리고 화면이 들고 있던 것도 비워진다');
}

/* ── 4. 두고 가면 남는다 ──────────────────────────────────
   이 줄이 이 파일에서 가장 값을 한다. 「두고 간다」가 유물을 지우면
   그 화면은 선택지가 아니라 함정이고, 그건 §0이 이름을 붙인 결함이다. */
{
  const { p, r } = stage();
  Game.openHere();
  Game.leaveRelic();
  ok(!p.relics.includes(r.id), '두고 가면 안 걸린다');
  ok(onFloor(p, r.id), '**두고 간 것은 바닥에 남는다** — 되돌아올 수 있어야 결정이다');
  const dup = G.items.filter(o => o.kind === 'relic' && o.id === r.id).length;
  ok(dup === 1, '   그리고 한 개다 — 되돌려 놓는 길이 둘이면 둘이 놓인다', `${dup}개`);
  /* 다시 눌러도 같은 화면이 열린다 — 마음이 바뀔 수 있어야 한다. */
  ok(Game.hereOffer()?.screen === 'relic', '   다시 누르면 같은 화면이 열린다');
}

/* ── 5. 자리가 찼을 때 ────────────────────────────────────── */
{
  const cap = Game.slotCount();
  const { p, r } = stage(cap);
  Game.openHere();
  ok(G.screen === 'relic', '자리가 차 있어도 화면은 열린다', `${p.relics.length}/${cap}칸`);
  Game.acceptRelic();
  ok(!p.relics.includes(r.id) && G.screen === 'relic',
     '   자리가 차면 바로 안 걸리고 「무엇을 버릴까」로 이어진다', G.screen);
  Game.swapRelic(0);
  ok(p.relics.includes(r.id), '   버리고 나면 걸린다', p.relics.join(','));
  const here = G.items.filter(o => o.kind === 'relic' && o.x === p.x && o.y === p.y);
  ok(here.length === 1 && here[0].id !== r.id,
     '   그리고 한 칸에 유물이 둘 놓이지 않는다 — 버린 것 하나만 남는다',
     here.map(o => o.n).join(' · ') || '없음');
  /* 버린 것을 다시 집을 수 있는가. 교체는 되돌릴 수 있어야 한다. */
  ok(Game.hereOffer()?.screen === 'relic', '   버린 것도 발밑에서 다시 물어본다');
}

console.log(bad ? `\n유물 줍기 벤치: ${bad}건 실패\n`
                : '\n유물 줍기 벤치: 발이 대신 고르지 않고, 두고 간 것은 남는다\n');
process.exit(bad ? 1 : 0);
