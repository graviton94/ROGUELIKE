/* ═══════════════════════════════════════════════════════════
   arcana.mjs — 판 자체가 비틀리는가

   플레이어: 「아르카나는 화면 뒤집는 연출이 아니라, 그런 뭔가 판 자체를
   비트는 요소가 하나 더 들어가야한다는거임.」

   그래서 이 파일이 묻는 것은 「효과가 켜지는가」가 아니라 **세계가
   달라지는가**다. 유물은 내 몸에 붙지만 아르카나는 층 생성·시계·
   드롭에 붙으므로, 재는 자리도 몸이 아니라 그쪽이다.

     1. 아홉이 전부 양날인가 — 순증이 하나라도 있으면 그 판부터
        나머지는 안 고른다
     2. 고르면 **층이 실제로 달라지는가** (같은 층을 스무 번 만들어
        전후를 비교한다)
     3. 판당 셋뿐인가

   usage: node sim/arcana.mjs
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
const mid = a => { const v = a.slice().sort((x, y) => x - y); return v[v.length >> 1]; };

console.log('\n아르카나 벤치 — 판 자체가 비틀리는가\n');

/* ── 1. 전부 양날인가 ─────────────────────────────────── */
{
  const oneSided = D.ARCANA.filter(a => !a.t.includes('대신'));
  ok(oneSided.length === 0,
     '아홉이 전부 양날이다 — 순증이 하나라도 있으면 그 판부터 나머지는 안 고른다',
     oneSided.length ? oneSided.map(a => a.id).join(' ') : `${D.ARCANA.length}종 전부`);
  const noLore = D.ARCANA.filter(a => !a.lore);
  ok(noLore.length === 0, '전부 제 문장을 갖는다',
     noLore.length ? noLore.map(a => a.id).join(' ') : '');
}

/* ── 2. 고르면 층이 달라지는가 ─────────────────────────── */
console.log('');
Meta.forget();
Game.startGame('human', 'warrior', Game.rollStats('warrior'));
Game.descend();
/* 같은 깊이를 스무 번 만들어 중앙값을 뜬다. 층 생성은 판마다 흔들리므로
   한 번 만들어 비교하면 아르카나가 아니라 그 층 하나를 재게 된다. */
const probe = (id, read, depth = 8, n = 20) => {
  const run = () => { const v = []; for (let i = 0; i < n; i++) { Game.enterDepth(depth); v.push(read()); } return mid(v); };
  G.arcana = []; const off = run();
  G.arcana = [id]; const on = run();
  G.arcana = [];
  return [off, on];
};
const mons  = () => G.monsters.length;
const elite = () => G.monsters.filter(m => m.elite?.length).length / Math.max(1, G.monsters.length);
/* 층당 장비 수는 1~3개짜리 작은 정수라, 중앙값으로는 「절반」이
   안 보인다(1 → 1). 여러 층을 합쳐서 센다. */
const gear  = () => G.items.filter(i => i.kind === 'weapon' || i.kind === 'armour').length;
const affix = () => { const w = G.items.filter(i => i.kind === 'weapon' || i.kind === 'armour');
                      return w.length ? w.filter(i => i.pre || i.suf).length / w.length : 0; };
const evs   = () => (G.level.eventTiles || []).length;
const clock = () => { Game.enterDepth(8); return Game.floorBudget(); };

console.log('  아르카나        무엇이            없을 때 → 있을 때');
const show = (n, what, [a, b]) =>
  console.log(`  ${n.padEnd(14)}${what.padEnd(16)}${String(typeof a === 'number' && a % 1 ? a.toFixed(2) : a).padStart(6)}`
    + ` → ${String(typeof b === 'number' && b % 1 ? b.toFixed(2) : b)}`);

const thinM = probe('thin', mons), thinE = probe('thin', elite);
show('얇은 판', '몬스터 수', thinM); show('', '정예 비율', thinE);
ok(thinM[1] < thinM[0] && thinE[1] > thinE[0] + 0.3,
   '얇은 판 — 수가 줄고 남은 것이 전부 정예다', `${thinM[0]}마리 ${(thinE[0]*100).toFixed(0)}% → ${thinM[1]}마리 ${(thinE[1]*100).toFixed(0)}%`);

const sumGear = id => {
  const run = () => { let n = 0; for (let i = 0; i < 60; i++) { Game.enterDepth(8);
    n += G.items.filter(x => x.kind === 'weapon' || x.kind === 'armour').length; } return n; };
  G.arcana = []; const a = run(); G.arcana = [id]; const b = run(); G.arcana = [];
  return [a, b];
};
const famG = sumGear('famine'), famA = probe('famine', affix);
show('굶주린 판', '장비(60층 합)', famG); show('', '속성 붙은 비율', famA);
ok(famG[1] < famG[0] && famA[1] > famA[0],
   '굶주린 판 — 주울 것이 줄고 주운 것이 좋아진다', `${famG[0]}개 → ${famG[1]}개, 속성 ${(famA[1]*100).toFixed(0)}%`);

/* ? 칸도 1~2짜리 작은 정수라 중앙값으로는 「하나 더」가 안 보인다
   (2 → 2). 60층을 합쳐서 센다 — 장비 때와 같은 실수를 두 번 했다. */
const sumEv = id => {
  const run = () => { let n = 0; for (let i = 0; i < 60; i++) { Game.enterDepth(8);
    n += (G.level.eventTiles || []).length; } return n; };
  G.arcana = []; const a = run(); G.arcana = [id]; const b = run(); G.arcana = [];
  return [a, b];
};
const echoE = sumEv('echo');
show('되풀이하는 판', '? 칸(60층 합)', echoE);
ok(echoE[1] > echoE[0] * 1.2, '되풀이하는 판 — ? 가 하나 더 깔린다', `${echoE[0]} → ${echoE[1]}`);

/* 시계 기준선이 256과 128 사이를 오갔다. 주목을 눌러도 그대로였다 —
   진짜 원인은 **재촉하는 과업**이 `G.branch.clock` 을 0.5배로
   **영구히 고쳐 쓰기** 때문이다(`G.branch = {...G.branch, clock: ×0.5}`).
   층을 여러 번 만드는 탐침에서는 그게 누적된다.

   그래서 층을 다시 만들지 않는다. **같은 상태에서 아르카나만
   토글**해서 한 번씩 읽는다 — 그러면 다른 모든 것이 상수다. */
const c0raw = (() => { G.arcana = []; return Game.floorBudget(); })();
const c1raw = (() => { G.arcana = ['clock']; return Game.floorBudget(); })();
const c0 = c0raw, c1 = c1raw;
G.arcana = [];
show('재촉하는 판', '층의 여유', [c0, c1]);
ok(c1 < c0 * 0.75, '재촉하는 판 — 시계가 확실히 짧아진다', `${c0} → ${c1}턴`);

/* 무른 판은 몸에 붙는 둘 중 하나 — 같은 깔때기를 지나는지 본다. */
{
  /* 50을 때렸더니 9 → 7이 나왔다. 배율이 안 걸린 게 아니라 **한 방
     상한(BLOW_CAP)**에 둘 다 걸려서, 상한이 배율을 가린 것이다.
     상한 아래의 작은 한 방으로 재야 배율이 보인다. 여러 번 쳐서
     평균을 뜬다 — 상처와 굴림이 한 대에 다 들어 있다. */
  const p = G.player;
  const hit = () => { let n = 0; for (let i = 0; i < 60; i++) {
    p.hp = p.maxhp; n += Game.hurtPlayer(4, { by:'벤치' }); } p.hp = p.maxhp; return n / 60; };
  G.arcana = []; Game.recalc(p); const d0 = Game.gearBonus(p).dmgPct; const t0 = hit();
  G.arcana = ['brittle']; Game.recalc(p); const d1 = Game.gearBonus(p).dmgPct; const t1 = hit();
  G.arcana = []; Game.recalc(p);
  ok(d1 > d0 && t1 > t0,
     '무른 판 — 주는 것도 받는 것도 같이 오른다 (같은 깔때기를 지난다)',
     `피해 +${Math.round((d1-d0)*100)}%p · 맞은 값 ${t0.toFixed(1)} → ${t1.toFixed(1)}`);
}

/* ── 3. 판당 셋 ──────────────────────────────────────── */
console.log('');
{
  G.arcana = [];
  const due = D.ARCANA_AT.map(d => Game.arcanaDue(d));
  ok(due.every(Boolean) && !Game.arcanaDue(5) && !Game.arcanaDue(1),
     '4·8·12층에만 고른다', D.ARCANA_AT.join('·') + '층');
  G.arcana = ['thin', 'famine', 'echo'];
  ok(!Game.arcanaDue(12), '셋을 고르고 나면 더 안 뜬다');
  G.arcana = [];
  const off = Game.arcanaOffer();
  ok(off.length === 3 && new Set(off.map(a => a.id)).size === 3,
     '한 번에 셋을 겹치지 않게 내민다', off.map(a => a.n).join(' / '));
}

console.log(bad ? `\n아르카나 벤치: ${bad}건 실패\n` : '\n아르카나 벤치: 판이 비틀린다\n');
process.exit(bad ? 1 : 0);
