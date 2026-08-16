/* ═══════════════════════════════════════════════════════════
   aura.mjs — 기예가 저마다의 얼굴을 갖는가, 손에 든 것이 보이는가

   플레이어: 「스킬 이펙트 패치, 스킬 별로 + 내 강화나 인챈트나 유물에
   맞게 추가 이펙트」

   그래서 두 가지를 묻는다.

     1. **기예마다 제 프레임이 있는가.** 셋이 남의 것을 빌려 쓰고
        있었다 — 그림자 밟기는 회피 굴림을, 칼 부채는 궁수의
        화살비를, 급소 찌르기는 전사의 마무리를. 규칙은 서로 다른
        일을 하는데 화면은 같은 말을 하고 있었다는 뜻이다.
     2. **손에 든 것이 실려 나가는가.** +9 관통의 대검으로 휘두른
        휩쓸기와 바닥에서 주운 몽둥이로 휘두른 휩쓸기가 화면에서
        똑같으면, 이 게임이 시킨 가장 비싼 선택이 정작 그걸 쓰는
        순간에 안 보인다.

   재는 자리는 규칙 쪽이다. 색은 juice 가 고르므로 여기서는 「무엇을
   들었는지가 사건에 실렸는가」까지만 본다 — 색까지 재려 들면
   headless 가 아니라 화면을 재는 벤치가 된다.

   usage: node sim/aura.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D    = await import('../src/data.js');
const G = Game.G;
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

console.log('\n기예 연출 벤치 — 저마다의 얼굴 · 손에 든 것\n');

Meta.forget();

/* 기예를 한 번 쓰고 그동안 나온 사건을 돌려준다. 전투가 필요한
   기예가 많으므로 사방에 진짜 몬스터를 세운다 — 손으로 빚은 가짜를
   세웠다가 「9층부터 게임이 쉬워진다」를 사실로 보고한 적이 있다. */
function fire(cls, id) {
  Game.startGame('human', cls, Game.rollStats(cls));
  const p = G.player;
  p.lv = 12;
  Game.descend();
  Game.enterDepth(8);
  /* 자원은 **층에 들어선 뒤에** 채운다. enterDepth 가 맹세·신앙·
     그림자를 다시 잡으므로, 먼저 채우면 전부 0으로 들어가고 여섯
     기예가 「모자란다」로 조용히 죽는다 — 처음에 그렇게 쟀다. */
  p.stam = 99; p.maxstam = 99;
  p.oath = 99; p.faith = 99; p.shadow = 99; p.mana = 99; p.maxmana = 99;
  /* 곁에 셋, 조금 떨어져 둘. 근접·시야·사격 조건을 한 배치로 덮는다. */
  /* 하나는 언데드다 — 심판은 언데드가 없으면 「심판할 것이 없다」로
     끝나므로, 언데드를 안 세워 두고 「프레임이 없다」고 읽으면 그건
     기예가 아니라 배치를 잰 것이다. */
  const spots = [[1,0],[0,1],[-1,0],[3,0],[0,4]];
  G.monsters.length = 0;
  spots.forEach(([dx, dy], i) => {
    const x = p.x + dx, y = p.y + dy;
    if (G.level.solid(x, y)) return;
    G.monsters.push({ n:'표적', spr: i === 1 ? 'wraith' : 'rat', x, y,
                      hp:9999, maxhp:9999, dmg:1, ac:0, ev:0,
                      awake:true, energy:0, spd:1 });
  });
  Game.refreshFov();
  G.fx.length = 0;
  Game.useArt(id);
  return G.fx.slice();
}

/* ── 1. 기예마다 제 프레임 ─────────────────────────────── */
/* 「그 기예가 쓴 사건」에서 평타·피격 같은 공용 프레임을 뺀 나머지가
   그 기예의 얼굴이다. */
const SHARED = new Set(['lunge','hit','miss','kill','shot','loose','wake',
                        'comboTier','drain','execute','arc','noise','death',
                        'ail','resist','splash','heal','levelup','quarry']);
const face = evs => evs.map(e => e.t).filter(t => !SHARED.has(t));

const ARTS = Object.entries(D.ARTS).flatMap(([cls, list]) => list.map(a => [cls, a.id, a.name]));
const faces = new Map();
const naked = [];
for (const [cls, id, name] of ARTS) {
  /* 연타는 첫 대가 빗나가면 거기서 끝나므로 프레임이 안 나온다.
     한 번 쏘고 「프레임이 없다」고 적으면 그건 연출이 아니라 명중
     굴림을 잰 것이다. 다섯 번 쏴서 합친다. */
  let f = [];
  for (let i = 0; i < 5 && !f.length; i++) f = face(fire(cls, id));
  if (!f.length) { naked.push(`${name}(${id})`); continue; }
  faces.set(id, { cls, name, head: f[0], all: [...new Set(f)] });
}

ok(naked.length === 0, '기예마다 제 프레임을 쓴다 — 평타와 구분되지 않는 것이 없다',
   naked.length ? naked.join(' · ') : `${faces.size}종 전부`);

/* 머리 프레임이 겹치면 화면에서 두 기예가 같은 말을 한다. */
const byHead = new Map();
for (const [id, f] of faces) (byHead.get(f.head) || byHead.set(f.head, []).get(f.head)).push(f.name);
const shared = [...byHead.entries()].filter(([, v]) => v.length > 1);
ok(shared.length === 0, '두 기예가 같은 프레임을 빌려 쓰지 않는다',
   shared.length ? shared.map(([t, v]) => `${t}: ${v.join('=')}`).join(' / ')
                 : `${byHead.size}가지 프레임`);

console.log('');
for (const [id, f] of faces)
  console.log(`  ${f.name.padEnd(10)} ${id.padEnd(12)} ${f.all.join(' ')}`);

/* ── 2. 손에 든 것이 실리는가 ──────────────────────────── */
console.log('');
{
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  const p = G.player;
  p.lv = 12; p.stam = 99;
  Game.descend(); Game.enterDepth(8);
  G.monsters.length = 0;
  G.monsters.push({ n:'표적', spr:'rat', x:p.x+1, y:p.y, hp:9999, maxhp:9999,
                    dmg:1, ac:0, awake:true, energy:0, spd:1 });
  Game.refreshFov();

  const sweep = () => { G.fx.length = 0; p.stam = 99; Game.useArt('cleave');
                        return G.fx.find(e => e.t === 'cleave')?.aura || null; };

  const w = p.equip?.weapon;
  ok(!!w, '전사가 무기를 들고 있다', w?.name);
  w.plus = 0; w.engrave = []; p.relics = [];
  const bare = sweep();
  ok(bare === null, '아무것도 안 붙은 손에는 아무것도 안 실린다 — 소음이 되지 않는다',
     bare === null ? '없음' : JSON.stringify(bare));

  w.plus = 7;
  const plus = sweep();
  ok(plus?.plus === 7, '강화가 실린다', `+${plus?.plus}`);

  w.engrave = ['pierce', 'thirst'];
  const eng = sweep();
  ok(eng?.marks?.length === 2 && eng.marks.includes('pierce'),
     '인챈트가 실린다', (eng?.marks || []).join(' · '));

  p.relics = ['everflame', 'vow'];
  const rel = sweep();
  ok(rel?.relics?.length === 2 && rel.relics.includes('vow'),
     '유물이 실린다', (rel?.relics || []).join(' · '));

  /* 평타에는 안 실린다. 이 층은 기예의 값을 그리는 것이지 매 턴
     칠하는 물감이 아니다 — 매 대마다 불꽃이 터지면 그건 정보가
     아니라 배경이 된다. */
  G.fx.length = 0;
  Game.step(1, 0);                      // 옆칸으로 걸어 들어가면 그게 평타다
  const plain = G.fx.filter(e => e.aura).length;
  ok(plain === 0, '평타에는 안 실린다 — 매 턴 칠하는 물감이 아니다', `${plain}건`);
}

/* ── 3. juice 가 그 색을 알고 있는가 ──────────────────── */
console.log('');
{
  const src = await import('node:fs').then(fs =>
    fs.readFileSync(new URL('../src/juice.js', import.meta.url), 'utf8'));
  const known = k => new RegExp(`${k}\\s*:`).test(src.slice(src.indexOf('const MARK_TINT'),
                                                          src.indexOf('function auraWash')));
  const missM = D.ENGRAVINGS.filter(e => !known(e.id)).map(e => e.id);
  ok(missM.length === 0, '인챈트 열둘이 전부 제 색을 갖는다',
     missM.length ? missM.join(' ') : `${D.ENGRAVINGS.length}종`);

  /* 유물은 마흔이라 전부 색을 줄 이유가 없다 — 화면에 나올 만큼
     성격이 뚜렷한 것만 고른다. 그래도 「하나도 없다」면 유물 축은
     안 보이는 것이므로 바닥은 둔다. */
  const tinted = D.RELICS.filter(r => known(r.id)).length;
  ok(tinted >= 10, '유물 중 성격이 뚜렷한 것들이 색을 갖는다',
     `${tinted} / ${D.RELICS.length}`);
}

/* ── 4. 그 프레임이 실제로 화면 쪽에 닿는가 ───────────── */
/* 이 절이 있는 이유: 버티기의 연출이 **한 번도 나온 적이 없었다.**
   pump 안에 같은 이름의 갈래가 둘 있었고 switch 는 먼저 만나는
   것을 쓰므로, 한계돌파로 다시 쓴 프레임은 조용히 죽어 있었다.
   규칙 쪽 벤치는 그걸 절대 못 잡는다 — 사건은 정상적으로 나갔으니까.
   그래서 사건을 실제로 pump 에 통과시킨다. */
console.log('');
{
  const J = await import('../src/juice.js');
  const seen = new Set();
  let threw = null;
  for (const [id, f] of faces) {
    for (const t of f.all) {
      try { J.pump([{ t, x:5, y:5, fx:5, fy:5, tx:6, ty:6, n:2, dist:3,
                      from:{x:3,y:3}, ax:1, ay:0, rng:4, tiles:[0],
                      aura:{ plus:9, marks:['pierce'], relics:['everflame'] } }],
                    { x:5, y:5 }); seen.add(t); }
      catch (err) { threw = `${id}/${t}: ${err.message}`; }
    }
  }
  ok(!threw, '스물세 기예의 프레임이 전부 pump 를 통과한다', threw || `${seen.size}가지`);

  /* 같은 이름의 갈래가 둘이면 뒤엣것은 영원히 안 나온다. */
  const src = await import('node:fs').then(fs =>
    fs.readFileSync(new URL('../src/juice.js', import.meta.url), 'utf8'));
  const labels = [...src.matchAll(/^\s*case '([a-zA-Z]+)':/gm)].map(m => m[1]);
  const dup = labels.filter((t, i) => labels.indexOf(t) !== i);
  ok(dup.length === 0, 'pump 안에 같은 이름의 갈래가 둘 있지 않다',
     dup.length ? [...new Set(dup)].join(' ') : `${labels.length}갈래`);
}

console.log(bad ? `\n기예 연출 벤치: ${bad}건 실패\n` : '\n기예 연출 벤치: 저마다의 얼굴이 있다\n');
process.exit(bad ? 1 : 0);
