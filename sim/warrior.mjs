/* ═══════════════════════════════════════════════════════════
   warrior.mjs — 광전사

   DESIGN.md §4. 전사의 넷. 축은 둘이다: **무기가 모양을 정한다**,
   그리고 **죽음에 가까울수록 세진다**.

   ① 연격 — 평타가 이미 계열 규칙을 갖고 있으므로(단검 두 번, 도끼
      양옆, 창 두 칸) 그것을 그냥 스킬로 만들면 공짜인 것을 기력 주고
      사는 버튼이 된다. 값을 하는 자리는 **세 번째 손의 셈**이다:
      맞은 것 하나하나가 오른다. 그래서 무기가 특성의 속도를 바꾼다.
   ② 광폭 — 무적이 아니라 폭주. 예전에 이 자리에 있던 버티기가
      「가만히 서서 버티는 것이 언제나 옳다」로 잘려 나갔으므로,
      무적을 주면 같은 실수를 반복한다. 끌 수도 없다.
   ③ 도발 — 둘러싸이는 것을 값으로 바꾼다. 다만 턴당 상한이 있어야
      한다. 없으면 최적 행동이 되고, 그러면 위험한 선택이 아니다.
   ④ 피의 소용돌이 — 이 게임에 **당기는 것이 하나도 없다**(미는 것은
      둘인데). 광역 회전은 이미 넷째이므로 무게를 당기기에 싣는다.

   usage: node sim/warrior.mjs
   ═══════════════════════════════════════════════════════════ */
import * as Game from '../src/game.js';
import { WEAPONS, ARTS, FRENZY_MAX, FRENZY_TAKE, FRENZY_TURNS,
         TAUNT_CAP, TAUNT_TURNS, MAELSTROM_MAX, CANT_HOLD } from '../src/data.js';

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };
const G = Game.G;

const seat = (t, lv = 12) => {
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  const p = G.player;
  p.lv = lv;
  if (t) p.equip.weapon = { kind: 'weapon', ...WEAPONS.find(w => w.t === t) };
  Game.recalc(p);
  p.stam = p.maxStam; p.hp = p.maxhp;
  G.monsters.length = 0;
  return p;
};
const stand = (p, spots) => spots.map(([dx, dy]) => {
  /* ac 를 아주 낮게 둔다. 명중 굴림이 남아 있으면 「맞은 것 3, 셈이
     오른 몸 2」 같은 결과가 나오고, 그건 기예가 아니라 주사위를 잰
     것이다 — 실제로 그 값을 보고 버그로 읽을 뻔했다. */
  const m = { spr: 'rat', n: '쥐', hp: 4000, maxhp: 4000, atk: 1, ac: -99,
              x: p.x + dx, y: p.y + dy, awake: true, energy: 0 };
  G.monsters.push(m); return m;
});
/* 한 영웅을 두 상태로 비교한다. seat() 를 두 번 부르면 능력치가 다시
   굴려져서 **다른 사람** 둘을 비교하게 된다 — 41 → 49 처럼 거꾸로
   나온 자리가 그것이었다. 그리고 hurtPlayer 는 한 대의 상한(BLOW_CAP)이
   있으므로 100 을 때리면 둘 다 상한에 걸려 같은 값이 나온다. */
const takes = (p, set) => {
  const hp0 = p.hp, keep = { frenzy: p.frenzy, taunt: p.taunt };
  Object.assign(p, set);
  Game.hurtPlayer(6, { by: '벤치' });
  const got = hp0 - p.hp;
  p.hp = hp0; Object.assign(p, keep);
  return got;
};

console.log('\n전사 벤치 — 광전사\n');

/* ── 칸이 넷이고 역할이 다 다른가 ───────────────────────── */
const A = ARTS.warrior;
ok(A.length === 4, '기예가 넷이다', `${A.length}개`);
ok(new Set(A.map(a => a.role)).size === 4,
   '네 칸의 역할이 다 다르다 — 기본·특화·단점 상쇄·궁극',
   A.map(a => a.role).join(' '));
ok(A.map(a => a.lv).join() === '1,4,8,12', '레벨이 1·4·8·12', A.map(a => a.lv).join('·'));
ok(CANT_HOLD.warrior?.bow && CANT_HOLD.warrior?.wand,
   '활과 지팡이를 못 든다 — 넷이 전부 무기가 정한 모양으로 나가므로');

/* ── ① 연격이 무기별로 갈리는가 ────────────────────────── */
console.log('');
const shapes = {};
for (const t of ['dagger', 'spear', 'axe', 'sword', 'mace']) {
  const p = seat(t);
  const ms = stand(p, [[1, 0], [0, 1], [1, 1]]);
  const before = ms.map(m => m.hp);
  Game.cast('combo');
  const hurt = ms.filter((m, i) => m.hp < before[i]).length;
  const chained = ms.filter(m => (m.chain || 0) > 0).length;
  shapes[t] = { hurt, chained };
  console.log(`  ${t.padEnd(7)}맞은 것 ${hurt} · 셈이 오른 몸 ${chained}`);
}
ok(shapes.axe.hurt > shapes.mace.hurt,
   '① 무기가 모양을 정한다 — 도끼는 여럿, 둔기는 하나',
   `도끼 ${shapes.axe.hurt} vs 둔기 ${shapes.mace.hurt}`);
/* 「맞은 것 = 셈이 오른 몸」으로 잡았다가 도끼에서 3 vs 2 가 나왔다.
   도끼는 계열 규칙으로 **양옆까지 한 번 더** 치므로 한 몸이 두 번
   맞고, 그 둘째가 빗나가면 그 몸의 셈이 0 으로 돌아간다. 실제 동작이고
   기예 탓이 아니다 — 자가 빡빡했다. 물어야 할 것은 「여럿을 치는
   무기가 여러 몸에 셈을 쌓는가」다. */
ok(Object.values(shapes).every(s => s.chained >= 1),
   '   맞은 몸에 세 번째 손의 셈이 오른다 — 이것이 기력을 내는 이유다');
ok(shapes.axe.chained > shapes.mace.chained,
   '   그리고 여럿을 치는 무기는 **여러 몸에 동시에** 쌓는다',
   `도끼 ${shapes.axe.chained}몸 vs 둔기 ${shapes.mace.chained}몸`);

/* 셈이 몸마다 따로인가. 하나뿐이면 도끼 연격이 특성을 **깎는다**. */
{
  const p = seat('axe');
  const ms = stand(p, [[1, 0], [0, 1], [1, 1]]);
  Game.cast('combo');
  ok(ms.every(m => (m.chain || 0) === 1),
     '   셈은 몸마다 따로다 — 하나뿐이면 부채꼴이 특성을 깎는다',
     ms.map(m => m.chain || 0).join(' '));
}

/* ── ② 광폭 ─────────────────────────────────────────────── */
console.log('');
{
  const p = seat('sword');
  stand(p, [[1, 0]]);
  Game.cast('frenzy');
  /* 켜는 그 턴이 이미 한 번 식는다(endTurn). 8 로 켜고 7 이 남는 것이
     정상이다 — 이걸 실패로 찍었다가 멀쩡한 것을 고칠 뻔했다. */
  ok(p.frenzy >= FRENZY_TURNS - 1, '② 광폭이 켜진다', `${p.frenzy}턴 남음 (켤 때 ${FRENZY_TURNS})`);
  p.hp = p.maxhp;
  const full = Game.gearBonus(p).dmgPct;
  p.hp = 1;
  const dying = Game.gearBonus(p).dmgPct;
  ok(dying > full && Math.abs((dying - full) - FRENZY_MAX) < 0.02,
     '   잃은 피에 비례해 오른다 — 가득 차 있으면 아무 일도 없다',
     `가득 +${(full * 100).toFixed(0)}% → 빈사 +${(dying * 100).toFixed(0)}%`);
  /* 받는 쪽도 오르는가. 한쪽만 움직이면 그건 폭주가 아니라 버프다. */
  const q = seat('sword'); q.hp = q.maxhp;
  const plain = takes(q, { frenzy: 0, taunt: 0 });
  const mad = takes(q, { frenzy: FRENZY_TURNS, taunt: 0 });
  ok(mad > plain, '   그리고 받는 피해도 오른다 — 한쪽만 움직이면 폭주가 아니라 버프다',
     `${plain} → ${mad}`);
  ok(!Object.keys(Game).includes('endFrenzy'),
     '   끄는 문이 없다 — 켜는 것이 도박이어야 「언제나 옳은 버튼」이 안 된다');
}

/* ── ③ 도발 ─────────────────────────────────────────────── */
console.log('');
{
  const p = seat('sword');
  const ms = stand(p, [[1, 0], [0, 1], [1, 1]]);
  Game.cast('taunt');
  ok(p.taunt >= TAUNT_TURNS - 1 && ms.every(m => m.taunted > 0),
     '③ 곁의 것들이 이쪽만 본다',
     `${ms.filter(m => m.taunted > 0).length}마리 · ${p.taunt}턴 남음`);
  const q = seat('sword'); q.hp = q.maxhp;
  const plain = takes(q, { frenzy: 0, taunt: 0 });
  const held = takes(q, { frenzy: 0, taunt: TAUNT_TURNS });
  ok(held < plain, '   받는 피해가 준다', `${plain} → ${held}`);
  /* 그리고 **턴당 상한**. 없으면 둘러싸인 채 무한히 버는 기관이 된다. */
  const p4 = seat('sword');
  p4.taunt = TAUNT_TURNS; p4.stam = 0; p4.tauntGot = 0; p4.hp = p4.maxhp;
  for (let i = 0; i < 6; i++) Game.hurtPlayer(5, { by: '벤치' });
  ok(p4.stam <= TAUNT_CAP,
     '   맞아서 버는 기력에 **턴당 상한**이 있다 — 없으면 도발이 최적 행동이 된다',
     `여섯 대 맞고 기력 ${p4.stam} (상한 ${TAUNT_CAP})`);
}

/* ── ④ 피의 소용돌이 ────────────────────────────────────── */
console.log('');
{
  const p = seat('great');
  /* 멀리 넷을 세운다 — 끌려와야 한다 */
  const ms = stand(p, [[4, 0], [0, 4], [-4, 0], [3, 3]]);
  const far = ms.map(m => Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)));
  const before = ms.map(m => m.hp);
  Game.cast('maelstrom');
  const near = ms.map(m => Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)));
  const pulled = ms.filter((m, i) => near[i] < far[i]).length;
  ok(pulled > 0, '④ 보이는 것을 끌어당긴다 — 이 게임에 없던 동사다',
     `${pulled}/${ms.length}마리가 가까워졌다 (${far.join(',')} → ${near.join(',')})`);
  ok(ms.some((m, i) => m.hp < before[i]), '   그리고 끌어온 것을 벤다');
}
/* 끌려온 것이 많을수록 여러 번 돈다 — 둘러싸이는 것이 조건이다 */
{
  const one = seat('great'); stand(one, [[3, 0]]);
  const a = G.monsters[0].hp; Game.cast('maelstrom');
  const hurtOne = a - G.monsters[0].hp;
  const many = seat('great'); stand(many, [[3, 0], [0, 3], [-3, 0], [2, 2], [-2, 2], [2, -2]]);
  const b0 = G.monsters[0].hp; Game.cast('maelstrom');
  const hurtMany = b0 - G.monsters[0].hp;
  ok(hurtMany > hurtOne,
     '   끌려온 것이 많을수록 한 마리가 더 맞는다 — 전사의 단점이 여기서 조건이 된다',
     `하나일 때 ${hurtOne} vs 여섯일 때 ${hurtMany} (최대 ${MAELSTROM_MAX}회전)`);
}

console.log(bad ? `\n전사 벤치: ${bad}건 실패\n` : '\n전사 벤치: 무기가 모양을 정하고, 죽음에 가까울수록 세진다\n');
process.exit(bad ? 1 : 0);
