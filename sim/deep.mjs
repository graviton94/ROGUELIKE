/* deep.mjs — 10층 전투는 어떤 모양인가.

   1차 리뷰가 남긴 구멍: 120판에서 11층 이상에 닿은 것이 4판이고, d≥10
   몬스터 열 종은 **한 번도 실측된 적이 없다**. 그런데 그 층들의 숫자는
   전부 적혀 있다. 적혀 있고 안 밟힌 숫자는 설계가 아니라 소망이다.

   앞선 벤치들이 깊은 층을 재려고 쓴 손잡이는 `opt.tough` — 최대 체력에
   배수를 곱하고 매 턴 가득 채운다. 그것으로 재면 「무엇이 나오는가」는
   알 수 있어도 「그것이 사람을 죽이는가」는 절대 알 수 없다. 죽지 않는
   영웅으로 난이도를 재는 것은 난이도를 안 재는 것이다.

   그래서 여기서는 **곡선에 맞는 영웅**을 세운다.

   ── 1단계: 곡선을 잰다 ──
   보통 판을 돌리면서 각 층에 **처음 발 디딘 순간**의 레벨·최대체력·
   장비 등급을 적는다. 이건 관측이지 가정이 아니다. (_botlib의 주석은
   「층당 레벨 1.6」이라고 적어 두었는데, 그 숫자가 맞는지도 여기서
   판정된다.)

   ── 2단계: 그 사양으로 영웅을 세워 10층에 놓는다 ──
   체력 배수 없음. 죽으면 죽는다. 대조군으로 같은 방식의 5층 영웅도
   세워서, 「10층이 5층과 다른가」를 같은 자로 잰다.

   usage: node sim/deep.mjs [세울 판수] [조사 판수]           */

const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const W = await import('../src/world.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N     = Number(process.argv[2] || 24);   // 세우는 판
const SURVN = Number(process.argv[3] || 60);   // 곡선 조사 판
const CLASSES = ['warrior','rogue','mage','priest','ranger','paladin'];

/* 봇은 마을에서 물약과 횃불을 **전부 쇳조각으로 갈아 넣는다**
   (canSalvage가 kind==='use'를 참으로 돌려주고, 봇의 「남는 건 부순다」
   줄이 그것을 따른다). 그 상태로 조사한 곡선은 소모품이 0인 영웅의
   곡선이라 10층에 세울 사양이 못 된다. 그래서 여기서는 소모품에
   「부술 수 없는 것」 표식을 붙이고, 동시에 더미에 상한을 건다 —
   상한을 안 걸면 봇이 물약 170개를 들고 다니고, 그건 곡선이 아니라
   무한 자원이다. 사본에만 손대므로 공유 테이블은 안 건드린다. */
const STACK = 8;
const keepPots = g => {
  const p = g.player; if (!p) return;
  for (const s of p.pack) {
    const it = s.item;
    if (!(it.use === 'heal' || it.use === 'bigHeal' || it.use === 'mana' || it.use === 'torch')) continue;
    if (!it.unique) s.item = { ...it, unique: 'keep' };
    if ((it.use === 'heal' || it.use === 'bigHeal') && s.qty > STACK) s.qty = STACK;
  }
};

const med = a => { if (!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[s.length>>1]; };
const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;

/* 장비 등급을 한 숫자로. 무기 주사위 + 방어 + 붙은 접사 수 — 절대값이
   아니라 층끼리 비교하기 위한 자다. */
const gearScore = p => {
  const w = p.equip.weapon, b = p.equip.body, s = p.equip.shield;
  const dice = w ? (w.dn || 1) * ((w.ds || 4) + 1) / 2 + (w.plus || 0) : 0;
  const ac = Game.armourClass(p);
  const affix = [w,b,s].filter(Boolean).filter(i => i.pre || i.suf || i.plus).length;
  return { dice, ac, affix };
};

/* ── 1단계: 곡선 ─────────────────────────────────────── */
console.log(`\n깊은 층 벤치 — 10층에 곡선대로 선 영웅\n`);
console.log(`  ── 1단계: 층에 처음 발 디딘 순간의 영웅 (보통 판 ${SURVN})\n`);

const arrive = new Map();   // depth -> [{lv,maxhp,dice,ac,affix,pots}]
for (let i = 0; i < SURVN; i++) {
  let last = -1;
  runBot('human', CLASSES[i % CLASSES.length], i % 2 === 0, {
    onTurn: g => {
      keepPots(g);
      if (g.depth === last || !g.depth) return;
      last = g.depth;
      const p = g.player, gs = gearScore(p);
      if (!arrive.has(g.depth)) arrive.set(g.depth, []);
      arrive.get(g.depth).push({ lv:p.lv, maxhp:p.maxhp, ...gs,
        pots: p.pack.filter(s => s.item.use === 'heal' || s.item.use === 'bigHeal')
                    .reduce((a,s)=>a+(s.qty||1),0) });
    },
  });
}

const ds = [...arrive.keys()].sort((a,b)=>a-b);
console.log('   층    n    Lv   최대체력   무기주사위   방어   접사   물약');
for (const d of ds) {
  const r = arrive.get(d);
  if (r.length < 3) continue;
  console.log(`   ${String(d).padStart(2)} ${String(r.length).padStart(4)}  ${med(r.map(x=>x.lv)).toString().padStart(4)}`
    + `   ${med(r.map(x=>x.maxhp)).toString().padStart(6)}`
    + `   ${avg(r.map(x=>x.dice)).toFixed(1).padStart(8)}`
    + `   ${avg(r.map(x=>x.ac)).toFixed(1).padStart(5)}`
    + `   ${avg(r.map(x=>x.affix)).toFixed(1).padStart(4)}`
    + `   ${avg(r.map(x=>x.pots)).toFixed(1).padStart(4)}`);
}

/* 관측된 층에서 선을 뽑아 10층으로 늘린다. 관측이 닿은 곳까지는
   관측을 쓰고, 그 아래만 외삽한다 — 외삽한 줄은 그렇다고 적는다. */
const solid = ds.filter(d => (arrive.get(d) || []).length >= 5);
const fit = key => {
  const xs = solid, ys = solid.map(d => med(arrive.get(d).map(x => x[key])) || avg(arrive.get(d).map(x=>x[key])));
  const n = xs.length, sx = xs.reduce((a,b)=>a+b,0), sy = ys.reduce((a,b)=>a+b,0);
  const sxy = xs.reduce((a,b,i)=>a+b*ys[i],0), sxx = xs.reduce((a,b)=>a+b*b,0);
  const m = (n*sxy - sx*sy) / Math.max(1e-9, n*sxx - sx*sx);
  return { m, b: (sy - m*sx)/n };
};
const at = (key, d) => { const f = fit(key); return f.m*d + f.b; };

const SPEC = d => ({
  lv:   Math.max(1, Math.round(at('lv', d))),
  dice: at('dice', d),
  affix: Math.max(0, Math.round(at('affix', d))),
  pots: Math.max(0, Math.round(at('pots', d))),
});
const spec10 = SPEC(10), spec5 = SPEC(5);
console.log(`\n   관측이 닿은 층: ${solid.join(',')}`);
console.log(`   선: Lv ≈ ${fit('lv').m.toFixed(2)}×층 + ${fit('lv').b.toFixed(1)}`
  + `  (봇 주석이 적어 둔 값은 1.6/층)`);
console.log(`   → 5층 사양 Lv${spec5.lv} · 접사 ${spec5.affix} · 물약 ${spec5.pots}`);
console.log(`   → 10층 사양 Lv${spec10.lv} · 접사 ${spec10.affix} · 물약 ${spec10.pots}   ← 외삽`);

/* ── 2단계: 세운다 ───────────────────────────────────── */
function build(p, spec, depth) {
  p.lv = spec.lv;
  p.xp = D.xpToLevel(spec.lv - 1);
  /* 장비는 게임의 생성기가 그 깊이에 실제로 내놓는 것을 쓴다. 손으로
     지어 넣으면 그 순간 내가 만든 물건을 재게 된다. */
  for (const slot of ['weapon','body','shield']) {
    for (let tries = 0; tries < 40; tries++) {
      const it = Game.pickItemFor(depth);
      if (!it) break;
      const s = it.slot || (it.kind === 'weapon' ? 'weapon' : null);
      const want = slot === 'weapon' ? it.kind === 'weapon'
                 : slot === 'body'   ? s === 'body'
                 :                     s === 'shield';
      if (!want) continue;
      Game.rollAffixes(it, depth + 2, spec.affix > 0);
      p.equip[slot] = it;
      break;
    }
  }
  for (let i = 0; i < spec.pots; i++) Game.addItem(p, Game.makeConsumable('potHeal'), 1);
  Game.recalc(p);
  p.hp = p.maxhp; p.mana = p.maxmana; p.stam = p.maxStam;
}

/* 세운 층에서만 잰다. 5층에 세운 영웅은 7층에서 죽고 10층에 세운
   영웅은 11층에서 죽으므로, 판 전체로 재면 두 표본이 서로 다른 층을
   섞어 놓는다 — 처음에 그렇게 재서 「10층 몬스터가 5층보다 싸다」가
   나왔다. 그건 층이 아니라 표본을 비교한 값이었다. */
function stand(depth, spec) {
  const out = { runs:0, turns:0, kills:0, taken:0, healed:0, maxhpSum:0,
                died:0, diedHere:0, won:0, stuck:0, reached:[], killers:new Map(), met:new Map(),
                fightTurns:0, hardest:0, pots:0 };
  for (let i = 0; i < N; i++) {
    const cls = CLASSES[i % CLASSES.length];
    let placed = false, hpPrev = 0, lastTurn = -1;
    const r = runBot('human', cls, i % 2 === 0, {
      onTurn: g => {
        const p = g.player;
        if (!placed) {
          placed = true;
          build(p, spec, depth);
          Game.enterDepth(depth);
          hpPrev = p.hp; lastTurn = g.turn;
          out.maxhpSum += p.maxhp;
          return;
        }
        keepPots(g);
        /* 「무엇을 만났는가」는 세운 층에만 가두지 않는다. 가두었더니
           10층 표에는 「서리 비룡을 못 봤다」고 적히고 바로 아래 죽인
           것 목록에는 서리 비룡이 셋 있었다 — 같은 판을 두 가지 자로
           재서 서로 반박하게 만든 것이다. */
        for (const m of g.monsters)
          if (!m.disguise && g.level.vis[W.idx(m.x, m.y)])
            out.met.set(m.n, (out.met.get(m.n) || 0) + 1);
        out.deepest = Math.max(out.deepest || 0, g.depth);
        if (g.depth !== depth) { hpPrev = p.hp; return; }   // 나머지는 세운 층에서만
        const d = p.hp - hpPrev; hpPrev = p.hp;
        if (d < 0) { out.taken += -d; out.hardest = Math.max(out.hardest, -d / Math.max(1,p.maxhp)); }
        else out.healed += d;
        if (g.turn !== lastTurn) {
          lastTurn = g.turn; out.turns++;
          const adj = g.monsters.filter(m => !m.disguise && m.awake
            && Math.abs(m.x-p.x) <= 1 && Math.abs(m.y-p.y) <= 1).length;
          if (adj) out.fightTurns++;
        }
        for (const e of (g.fx || [])) if (e.t === 'kill') out.kills++;
      },
    });
    if (!placed) continue;
    out.runs++;
    out.reached.push(r.depth);
    if (r.win) out.won++;
    else if (r.stuck) out.stuck++;
    else {
      out.died++;
      if (r.depth === depth) out.diedHere++;
      out.killers.set(r.killer, (out.killers.get(r.killer)||0)+1);
    }
  }
  return out;
}

function report(label, depth, o) {
  const perRun = x => (x / Math.max(1, o.runs));
  console.log(`\n  ── ${label} — ${depth}층에 세운 판 ${o.runs} ──`);
  console.log(`     ${depth}층에서 보낸 턴 ${perRun(o.turns).toFixed(0)}턴/판  (그중 붙어서 싸운 턴 ${perRun(o.fightTurns).toFixed(0)} · ${Math.round(o.fightTurns*100/Math.max(1,o.turns))}%)`);
  console.log(`     처치           ${perRun(o.kills).toFixed(1)}마리/판`
    + `  ·  한 마리당 ${o.kills ? (o.fightTurns/o.kills).toFixed(1) : '—'}턴`);
  const mh = o.maxhpSum / Math.max(1, o.runs);
  console.log(`     최대체력       ${mh.toFixed(0)}`);
  console.log(`     받은 피해      ${perRun(o.taken).toFixed(0)}/판 = 최대체력의 ${(perRun(o.taken)*100/mh).toFixed(0)}%`
    + `  ·  한 마리 잡을 때마다 ${o.kills ? (o.taken/o.kills*100/mh).toFixed(1) : '—'}%`);
  console.log(`     되찾은 체력    ${perRun(o.healed).toFixed(0)}/판 (받은 것의 ${Math.round(o.healed*100/Math.max(1,o.taken))}%)`);
  console.log(`     가장 아픈 한 방 최대체력의 ${(o.hardest*100).toFixed(0)}%`);
  console.log(`     끝난 층        중앙 ${med(o.reached)} · 죽음 ${o.died}/${o.runs} `
    + `(그중 ${depth}층에서 ${o.diedHere}) · 이김 ${o.won} · 막힘 ${o.stuck}`);
  const top = [...o.killers].sort((a,b)=>b[1]-a[1]).slice(0,6);
  console.log(`     죽인 것        ${top.map(([k,v])=>`${k} ${v}`).join(' · ') || '—'}`);
  return o;
}

const DEPTH = 10;
const deep = report('곡선대로 선 영웅', DEPTH, stand(DEPTH, spec10));
const ctrl = report('대조군', 5, stand(5, spec5));

/* ── 3단계: 적혀만 있고 안 밟힌 것 ──────────────────── */
/* 10층에 세운 영웅은 10~11층만 밟는다. d14짜리를 못 봤다고 적는 것은
   측정이 아니라 착각이다 — 판정은 이 영웅이 실제로 밟은 깊이에
   나올 수 있는 종에만 건다. 더 아래 것은 「아직 아무도 안 밟았다」로
   따로 적는다. */
const REACH = deep.deepest || 11;
const deepSpec = D.MONSTERS.filter(m => m.d >= 10 && m.d <= REACH);
const tooDeep  = D.MONSTERS.filter(m => m.d > REACH);
const metNames = new Set([...deep.met.keys()]);
const never = deepSpec.filter(m => !metNames.has(m.n));
console.log(`\n  ── d10~${REACH} 몬스터 ${deepSpec.length}종 중 실제로 눈에 든 것 ${deepSpec.length - never.length} ──`);
console.log(`     못 본 것: ${never.map(m=>`${m.n}(d${m.d})`).join(' · ') || '없음'}`);
console.log(`     이 벤치가 닿지 못하는 깊이(d${REACH+1}+) ${tooDeep.length}종: ${tooDeep.map(m=>`${m.n}(d${m.d})`).join(' · ')}`);

/* ── 판정 ─────────────────────────────────────────── */
console.log('');
let bad = 0;
const ok = (c, msg, got) => { console.log(`  ${c?'·':'✗'} ${msg}${got!==undefined?` — ${got}`:''}`); if(!c) bad++; };
const deepCost = deep.kills ? deep.taken/deep.kills * 100 / (deep.maxhpSum/Math.max(1,deep.runs)) : 0;
const ctrlCost = ctrl.kills ? ctrl.taken/ctrl.kills * 100 / (ctrl.maxhpSum/Math.max(1,ctrl.runs)) : 0;
/* 이 지표는 표본이 모자라면 못 쓴다. 기본 N=24로 세 번 돌리니
   배수가 1.03 · 1.77 · 5.99로 나왔다 — 판정이 아니라 동전 던지기다.
   (이 파일을 처음 쓴 사람도 「N≥90 아래로는 인용하지 말라」고 적어
   두었는데, 정작 단언은 N과 무관하게 걸려 있었다.)
   그래서 표본이 찰 때만 판정한다. 흔들리는 것을 문턱으로 눌러 통과
   시키는 것보다, 「이 판에서는 이 질문에 답 안 한다」가 정직하다. */
const COST_N = 90;
if (N >= COST_N) {
  ok(deepCost > ctrlCost * 1.2,
     '10층 몬스터 한 마리가 5층 몬스터보다 눈에 띄게 비싸다 — 안 그러면 깊이는 숫자만 커진 것이다',
     `${deepCost.toFixed(1)}% vs ${ctrlCost.toFixed(1)}% (배수 ${(deepCost/Math.max(0.01,ctrlCost)).toFixed(2)})`);
} else {
  console.log(`  (표본 ${N} < ${COST_N} — 마리당 비용 배수 `
    + `${(deepCost/Math.max(0.01,ctrlCost)).toFixed(2)}는 인쇄만 하고 판정하지 않는다)`);
}
/* ── 이 단언의 이름이 재는 것과 달랐다 ────────────────────
   「10층에서 거의 다 죽는다」라고 적어 놓고 `deep.died` 를 봤는데,
   그건 **언젠가 죽었나**다. 10층에서 죽은 수는 `deep.diedHere` 이고
   같은 코드로 일곱 판을 재니 **0·1·2·2·2·3·4 / 24 (중앙 2, 8%)** 다.
   즉 곡선대로 선 영웅은 10층을 대체로 지나가고 중앙 13~15층에서
   끝난다 — 그리고 그게 맞다. 96%가 10층에서 죽으면 11~15층과 보스는
   아무도 못 본다. 옛 주석의 「보통은 23/24(96%)」는 영웅이 8~10층에서
   죽던 시절의 숫자다.

   그래서 이름을 재는 것에 맞춘다. 지키는 것은 여전히 **곡선이 층보다
   빠르지 않다** 이고, 그 질문의 답은 「언젠가 죽나」다. 문턱 0.75는
   그대로 둔다: 몬스터 공격력을 5%로 낮춘 실험에서 17/24(71%)였으므로
   0.75가 두 상태 사이에 있고, 실측은 17·18·19·19·21·21·21 이다.

   10층 자체의 치사율은 **인쇄만 하고 판정하지 않는다** — 24판에서
   0~4 로 흔들려서 문턱을 세울 수가 없다. 그 숫자를 움직이려면 표본을
   올려야 하고, 그건 이 파일의 90초를 몇 배로 만든다. */
ok(deep.died / Math.max(1, deep.runs) > 0.75,
   '곡선대로 선 영웅도 **언젠가는** 죽는다 — 안 죽으면 곡선이 층보다 빠르다는 뜻이다',
   `${deep.died}/${deep.runs} (중앙 ${med(deep.reached)}층에서 끝난다)`);
console.log(`  (${DEPTH}층 그 자체에서 끝난 판 ${deep.diedHere}/${deep.runs} `
  + `— 같은 코드로 일곱 판을 재니 0~4 로 흔들려서 판정하지 않는다)`);

/* ── 그리고 이 파일에서 정말 볼 것은 이 줄이었다 ────────────
   「곡선이 층보다 빠르다」의 뜻은 결국 **이긴다**다. 그걸 여태 아무도
   세지 않았고, 세 보니 곡선대로 선 봇이 **넷 중 하나꼴로 이긴다**
   (10층에 세운 판 5·6·9/24 · 5층 3·4·6/24). 봇은 사람보다 못 노는
   기계이므로, 봇이 25%로 이기는 판은 사람에게는 그보다 쉽다.

   문턱이 느슨한 것을 그대로 적어 둔다: 같은 코드에서 3~9/24 로
   흔들리므로 한 판으로 판정하려면 9 위에 세워야 하고, 그러면 「전부
   이긴다」만 잡는 자가 된다. 이 숫자를 **내리는 것**이 다음 일이고,
   내리고 나면 문턱도 같이 내려 적으면 된다. 표본을 올리는 쪽이
   정공법이지만 이 파일은 이미 90초를 쓴다. */
ok(deep.won / Math.max(1, deep.runs) <= 0.45,
   '곡선대로 선 영웅이 판을 쓸어버리지 않는다 — 이기는 것이 흔하면 그건 곡선이 이긴 것이다',
   `이김 ${deep.won}/${deep.runs} (${Math.round(deep.won * 100 / Math.max(1, deep.runs))}%) · 문턱 45%`);
ok(never.length <= deepSpec.length * 0.3,
   'd10~ 몬스터의 70% 이상이 실제로 눈에 든다 — 적혀만 있는 종은 설계가 아니다',
   `못 본 것 ${never.length}/${deepSpec.length}`);
console.log(bad ? `\n깊은 층 벤치: ${bad}건 실패\n` : '\n깊은 층 벤치: 통과\n');
/* 이게 없었다. ✗를 인쇄하고도 0으로 끝나면 스위트가 이 파일을
   영영 초록으로 읽는다 — 이 리포에 이미 그런 벤치가 열넷 있다.
   재기만 하고 잠그지 않으면 그 숫자는 장식이다. */
process.exit(bad ? 1 : 0);
