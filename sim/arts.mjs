/* ── 순서 3-③ — 네 직업의 기예를 다시 짠다 ──────────────────
   전사는 앞선 세션에서 끝났고(광전사 넷), 이 파일은 나머지를 잰다.
   골격은 이미 맞아 있다(넷 · lv1·4·8·12 · 역할 넷). 이 벤치가 무는
   것은 골격이 아니라 **내용**이다:

     1. 넷이 각자 제 역할과 제 레벨에 있는가 (골격 회귀 방지)
     2. 넷 다 실제 판에서 나가는가 — 판당 0회인 칸은 만들어진 적이
        없는 칸이다
     3. 헛손질이 없는가 — 봇 정책의 술어가 규칙의 술어와 같은가.
        이 줄이 이 파일에서 가장 값을 한다: `p.oath`·`p.faith` 를 읽던
        죽은 정책 때문에 팔라딘이 열 판에 2378회를 헛손질하고 있었고,
        그 표 위에서 「사제·팔라딘이 약하다」는 판단이 내려져 있었다
     4. 그리고 **직업의 축이 값에 닿는가** — 직업마다 한 줄씩. 이것이
        ③이 하려던 일이다: 넷이 다 「공격 하나 더」면 축은 설명문에만
        있는 것이다

   usage: node sim/arts.mjs [판수]                              */

const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const { runBot, ARTUSE, ARTMISS } = await import('./_botlib.mjs');
const { G } = Game;
const { idx } = await import('../src/world.js');

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`   ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

/* 전사까지 여섯 다 본다 — 전사는 척도라, 척도가 움직이면 나머지 판정이
   전부 흔들린다. 마법사는 기예가 0이고 주문 여덟이 그 자리다(§4). */
const CLS = ['warrior', 'rogue', 'priest', 'paladin', 'ranger'];
const ROLES = ['basic', 'signature', 'cover', 'ultimate'];
const LADDER = [1, 4, 8, 12];

/* ═══ 0. 여덟 칸 ══════════════════════════════════════════
   §4의 표는 「기예 넷 + 유틸 넷」이고 마법사만 예외(주문 여덟)다.
   그 표가 실제로 서 있는지는 아무도 안 재고 있었고, 실제로 안 서
   있었다 — 사제와 팔라딘이 **아홉 칸**이었다(축복과 응징의 빛이
   남아 있었다). 아홉 칸은 화면 문제이기 전에 §4 위반이다.

   그리고 유틸 3·4는 여섯 직업이 **같은 id**(blink · detect)를 쓰되
   표가 갈래를 정한다. id 가 같아야 저장이 살고(주문 연마·접사가 id
   로 묶여 있다), 갈래가 표에 있어야 규칙이 한 자리에 남는다(§5).
   여기서 무는 것은 셋이다: 여덟인가 · 둘 다 있는가 · 갈래가 직업마다
   다른가. 셋째가 없으면 「여섯 직업이 똑같은 유틸 둘을 받았다」가
   되고, 그건 칸을 채운 것이지 직업을 지은 것이 아니다.        */
console.log('\n── 여덟 칸 (기예 넷 + 주문 넷 · 마법사는 주문 여덟)');
{
  const ALL = ['warrior', 'rogue', 'ranger', 'mage', 'priest', 'paladin'];
  const seenHop = new Map(), seenSense = new Map();
  for (const cls of ALL) {
    Meta.forget();
    Game.startGame('human', cls, Game.rollStats(cls));
    const p = G.player;
    /* 사다리 꼭대기(12레벨)를 넘겨서 묻는다 — 표가 다 열린 뒤의
       칸 수가 §4가 말하는 여덟이다. */
    p.lv = 20; Game.recalc(p);
    const slots = Game.spellSlots();
    const arts = slots.filter(s => s.art), sp = slots.filter(s => !s.art);
    console.log(`   ${cls.padEnd(8)} 기예 ${arts.length} ${arts.map(a => a.short).join('·') || '—'}`
      + ` | 주문 ${sp.length} ${sp.map(a => a.short).join('·')} => ${slots.length}`);
    ok(slots.length === 8, `${cls} — 여덟 칸이다`, `${slots.length}칸`);
    ok(arts.length === (cls === 'mage' ? 0 : 4),
       `${cls} — 기예가 ${cls === 'mage' ? '없다 (여덟이 다 주문)' : '넷이다'}`, `${arts.length}`);
    /* 공통 둘은 여섯 직업이 다 갖는다 — 전사도 마나 통이 있다. */
    const ids = new Set(Game.spellList(p).map(x => x.id));
    ok(ids.has('cure') && ids.has('heal'), `${cls} — 공통 치유 둘을 외운다`,
       [...ids].join(','));
    ok(ids.has('blink') && ids.has('detect'), `${cls} — 유틸 3·4가 둘 다 있다`,
       `${ids.has('blink') ? '있음' : '없음'}·${ids.has('detect') ? '있음' : '없음'}`);
    const blink = Game.spellList(p).find(x => x.id === 'blink');
    const det = Game.spellList(p).find(x => x.id === 'detect');
    /* 갈래는 표의 필드로 읽는다. 이름이 아니라 **동작이 갈리는가**를
       묻는 것이라, 설명문을 바꿔도 이 줄은 안 움직인다. */
    const hopKey = `${blink.hop || 'warp'}/${blink.dist || 0}/${blink.pool || 0}/${blink.guard || 0}`;
    const senseKey = `${det.mimic ? 'm' : ''}${det.wake ? 'w' : ''}${det.traps ? 't' : ''}${det.keepMark ? 'k' : ''}`;
    seenHop.set(cls, hopKey); seenSense.set(cls, senseKey);
    ok(blink.lv === 3 && blink.cost === 2 && det.lv === 5 && det.cost === 3,
       `${cls} — 유틸 3·4가 같은 레벨·같은 값에 앉아 있다`,
       `이동 lv${blink.lv}/${blink.cost}마나 · 감지 lv${det.lv}/${det.cost}마나`);
  }
  /* 갈래가 몇 종인가. 여섯이 전부 같으면 1이고, 그건 실패다. */
  const hops = new Set(seenHop.values()), senses = new Set(seenSense.values());
  ok(hops.size >= 5, '이동의 갈래가 다섯 종 이상이다 — 같은 id, 다른 동사',
     [...seenHop].map(([c, k]) => `${c}:${k}`).join(' '));
  ok(senses.size >= 4, '감지의 갈래가 네 종 이상이다',
     [...seenSense].map(([c, k]) => `${c}:${k}`).join(' '));
  /* 잘려 나간 둘이 되살아나지 않는가. */
  const gone = ['bless', 'smite'].filter(id =>
    Object.values(D.SPELLS_CLASS).some(l => l.some(x => x.id === id)));
  ok(!gone.length, '축복·응징의 빛은 표에서 없어졌다 — 여덟 칸에 버프 칸은 없다',
     gone.length ? gone.join(',') : '둘 다 없다');
}

/* ═══ 1. 골격 ═════════════════════════════════════════════ */
console.log('\n── 골격 (역할 넷 · 사다리 1·4·8·12)');
for (const cls of CLS) {
  const arts = D.ARTS[cls] || [];
  const byRole = ROLES.map(r => arts.find(a => a.role === r));
  console.log(`   ${cls.padEnd(8)} ${byRole.map((a, i) =>
    `${ROLES[i].slice(0, 4)}:${a ? `${a.name}(lv${a.lv})` : '없음'}`).join(' · ')}`);
  const missing = ROLES.filter((r, i) => !byRole[i]);
  if (missing.length) { ok(false, `${cls} — 역할이 빈다`, missing.join(',')); continue; }
  const lvs = byRole.map(a => a.lv);
  ok(lvs.every((lv, i) => lv === LADDER[i]),
     `${cls} — 넷이 사다리 위에 있다`, lvs.join('·'));
}

/* ═══ 2. 축이 값에 닿는가 (직업별) ════════════════════════ */
console.log('\n── 축');

/* ── 도적 — 「보이지 않는 동안 모으고, 한 번에 태운다」 ──────
   넷 다 공격이거나 도망이었고 **그림자를 읽는 것이 하나도 없었다.**
   모은 양이 어느 값도 바꾸지 않으면 모으는 일은 재장전 대기이지 축이
   아니다. 두 자리를 고쳤다 — 급소가 남은 그림자를 읽고, 숨 끊기가
   죽였을 때만 자취를 지운다. 둘 다 「입력을 바꾸면 숫자가 움직이는가」
   로 잰다. */
{
  Meta.forget();
  Game.startGame('human', 'rogue', Game.rollStats('rogue'));
  const p = G.player;
  p.lv = 14; Game.recalc(p);
  const vitals = D.ARTS.rogue.find(a => a.id === 'vitals');
  const cost = Game.artCost(p, vitals);
  const mult = shade => D.VITALS_BASE + D.VITALS_STEP * shade;
  const lo = mult(0), hi = mult(p.maxStam - cost);
  console.log(`   도적 급소 배수 — 그림자 0에서 ×${lo.toFixed(2)} · 남은 것 ${p.maxStam - cost}에서 ×${hi.toFixed(2)}`);
  ok(hi > lo * 1.4, '급소가 남은 그림자를 읽는다 — 고정 배수면 「모은 것을 태운다」는 설명문에만 있는 말이다',
     `×${lo.toFixed(2)} → ×${hi.toFixed(2)}`);
  /* 옛 고정값(2.6) 근처에 머무는가. 축을 세우는 패치이지 직업을 세게
     만드는 패치가 아니다 — 평균이 크게 오르면 그건 다른 변경이다. */
  const mid = mult(Math.round((p.maxStam - cost) / 2));
  ok(mid > 2.0 && mid < 3.0, '중간쯤 모았을 때가 옛 고정 배수(2.6) 근처다 — 총량이 아니라 폭을 만든 것이다',
     `×${mid.toFixed(2)}`);
  ok(!D.ARTS.rogue.some(a => a.id === 'fan'),
     '칼부채는 없어졌다 — 부채꼴 광역은 이 직업의 축과 무관하고, 광역은 이미 셋이다',
     D.ARTS.rogue.map(a => a.short).join(' '));
}

/* ── 사제 — 「맞을수록 강해진다」 ────────────────────────────
   넷 다 「받은 것을 무엇으로 바꿀까」를 답하고 있었다. 틀린 것은 내용이
   아니라 **자리**였다: §4의 2번은 직업특화 공격인데 말씀은 「피해는
   없다」이고, 3번은 단점 상쇄인데 성흔은 공격 증폭이다. 둘을 바꿨다.
   규칙은 한 줄도 안 건드렸다 — 여기서 잴 것은 표가 제 자리를 지키는가
   하나다(위 §골격이 사다리를 보고, 이 줄이 역할과 내용이 맞는지 본다). */
{
  const byId = Object.fromEntries(D.ARTS.priest.map(a => [a.id, a]));
  ok(byId.stigma.role === 'signature' && byId.word.role === 'cover',
     '사제 — 공격 칸에 공격이, 상쇄 칸에 시간을 사는 것이 앉아 있다',
     `성흔 ${byId.stigma.role}(lv${byId.stigma.lv}) · 말씀 ${byId.word.role}(lv${byId.word.lv})`);
  ok(/피해는 없다/.test(byId.word.desc) && !/피해는 없다/.test(byId.stigma.desc),
     '사제 — 그 판단의 근거가 설명문에 그대로 있다', '말씀만 피해가 없다');
}

/* ── 팔라딘 — 「맞아서 시작하고, 죽여서 굴러간다」 ───────────
   성전이 「방이 이미 무너져 있어야」 값을 하는 기예였고, 그 순간은 오지
   않는다 — 여덟 판에 **0회**. 조건을 뒤집었다: 다섯 턴 동안 맹세가 차는
   것이 곧 판결이 되고, 맹세는 맞을 때와 죽일 때 찬다. 그래서 값이
   「방이 나쁠 때」로 옮겨 간다.

   무한 기관이 되기 쉬운 모양이라(판결이 죽이면 또 차고 또 나간다) 두
   가지를 잰다: 상한이 있는가, 그리고 **재귀로 안 도는가.** */
{
  ok(D.CRUSADE_HITS > 0 && D.CRUSADE_TURNS > 0,
     '팔라딘 — 성전에 상한이 둘 있다 (턴과 횟수)', `${D.CRUSADE_TURNS}턴 · ${D.CRUSADE_HITS}번`);
  /* **마을에서 물으면 안 된다.** 판결은 보이는 것이 있어야 나가므로,
     계단을 안 밟은 영웅에게 맹세를 열다섯 번 채워도 남은 판결은 그대로
     다섯이다 — 그리고 그것이 「상한이 있다」로 읽힌다. 처음에 그렇게
     써서 통과 대신 실패로 찍혔다(운이 좋았다. 반대였으면 못 봤다).
     실제 층에서, 실제로 판결이 한 번이라도 나간 판에서만 판정한다. */
  let seenFire = false, left = null;
  /* `tough` 로 오래 살게 만든다 — 12레벨 팔라딘이 무언가를 보고 있는
     턴을 만나야 하는데, 그냥 굴리면 서른 판에 한 번은 못 만난다.
     간헐적으로 우는 벤치는 안 우는 것만 못하다(§6-6). 이 손잡이는
     밸런스에 쓰면 안 되지만(_botlib 의 경고) 여기서 재는 것은 상한
     하나이고 상한은 체력과 무관하다. */
  for (let t = 0; t < 12 && !seenFire; t++) {
    Meta.forget();
    runBot('human', 'paladin', false, { tough: 3, onTurn: (g) => {
      if (seenFire || !g.player || g.player.lv < 12) return;
      const p = g.player;
      if (!g.monsters.some(m => !m.disguise && g.level.vis[idx(m.x, m.y)])) return;
      p.crusade = D.CRUSADE_TURNS; p.crusadeLeft = D.CRUSADE_HITS;
      /* 맹세가 차는 문을 상한의 세 배로 두드린다. 상한이 없으면
         판결이 더 나가고, 재귀를 안 막았으면 여기서 스택이 터진다. */
      for (let i = 0; i < D.CRUSADE_HITS * 3; i++) { p.stam = 0; Game.poolGain(1, 'hurt'); }
      if (p.crusadeLeft < D.CRUSADE_HITS) { seenFire = true; left = p.crusadeLeft; }
    } });
  }
  ok(seenFire, '팔라딘 — 실제 층에서 판결이 나가는 판을 찾았다 (마을에서 재면 아무것도 안 잰다)',
     seenFire ? `나간 판결 ${D.CRUSADE_HITS - left}` : '열두 판 안에 12레벨 · 보이는 것을 못 만났다');
  /* `left === 0` 을 걸었다가 3과 1이 나왔다. 규칙이 아니라 단언이
     틀렸다 — 판결은 **보이는 것이 있어야** 나가고, 앞의 판결이 방을
     비우면 남은 판결은 부를 곳이 없다. 그게 옳은 동작이다.
     여기서 잴 것은 상한을 **넘지 않는가**이고, 그것은 left 가 음수로
     안 내려가는 것으로 읽는다. 그리고 이 절이 끝까지 돌았다는 사실
     자체가 재귀를 막았다는 증거다 — 안 막았으면 판결이 죽이고 그
     처치가 또 맹세를 채워 스택이 터진다. */
  if (seenFire) ok(left >= 0 && left < D.CRUSADE_HITS,
     `팔라딘 — 맹세를 상한의 세 배로 채워도 판결은 ${D.CRUSADE_HITS}번을 넘지 않는다 (그리고 재귀로 안 돈다)`,
     `나간 판결 ${D.CRUSADE_HITS - left} / 상한 ${D.CRUSADE_HITS}`);
}

/* ── 궁수 — 「나와 그것 사이의 거리」와 표적 ─────────────────
   넷 다 거리의 답이고 넷 다 나간다(이 직업은 여섯 중 가장 깊이 간다).
   빈 곳은 **표적**이었다: 셈을 올리는 것은 조준 사격 하나뿐이고
   나머지 셋은 그 셈을 읽지도 않았다. 빗발이 그것을 태우게 했고,
   총량은 그대로 두려고 나머지 몫을 0.5 → 0.45 로 내렸다. */
{
  ok(D.VOLLEY_MARKED > D.VOLLEY_SHARE,
     '궁수 — 겨누던 것은 온전히, 나머지는 반 (빗발이 표적을 읽는다)',
     `표적 ×${D.VOLLEY_MARKED} · 나머지 ×${D.VOLLEY_SHARE}`);
  /* 세게 만드는 패치가 아니다. 표적 하나가 온전히 맞는 대신 나머지가
     조금 내려가므로, 넷을 맞히는 방의 합은 옛 값(0.5×4=2.0) 근처다. */
  const before = 0.5 * 4, after = D.VOLLEY_MARKED + D.VOLLEY_SHARE * 3;
  ok(Math.abs(after - before) <= 0.4,
     '궁수 — 넷을 맞히는 방의 합이 옛 값 근처다 (선명하게 한 것이지 세게 한 것이 아니다)',
     `옛 ${before.toFixed(2)} → 새 ${after.toFixed(2)}`);
}

/* ═══ 3. 조작법 화면이 같은 표를 말하는가 ══════════════════
   여기 오기 전에 index.html 의 직업 표는 이렇게 적혀 있었다:

     사제   성역(3) · 파문(4) · 심판(6) · 순교(9)
     팔라딘 돌진(2) · 심판의 일격(3) · 성스러운 폭풍(4) · 성전(8)
     도적   그림자 도약(1) · 칼부채(2) · 어둠 되감기(1) · 급소(3)

   성역·파문·심판·성스러운 폭풍은 **넷 다 잘려 나간 기예**다. 값도 전부
   틀렸다(사제의 순교는 9가 아니라 6이다). 즉 게임을 처음 켠 사람이
   읽는 유일한 설명이 없는 기예 넷을 소개하고 있었다. 「고장 나 보이면
   안 된다」(§0)는 규칙이 화면의 글에도 걸린다.

   `sim/manual.mjs` 는 이걸 못 잡았다 — 문서와 게임의 **판번호**만
   본다. 그래서 여기서 표를 글자로 비교한다: 살아 있는 기예의 이름은
   화면에 있어야 하고, 표에 없는 이름이 화면에 있으면 그건 유령이다. */
console.log('\n── 조작법 화면');
{
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const alive = CLS.flatMap(c => (D.ARTS[c] || []).map(a => a.name));
  const missing = alive.filter(n => !html.includes(n));
  ok(!missing.length, '살아 있는 기예 스물이 조작법 화면에 다 있다',
     missing.length ? `없는 것: ${missing.join(', ')}` : `${alive.length}개`);
  /* 잘려 나간 것들. 이름을 목록으로 박아 두는 이유: 「지금 표에 없는
     모든 한국어」를 검사할 수는 없고, 이 저장소가 실제로 죽인 것들이
     되살아나는 것만 막으면 된다. 새로 죽일 때 한 줄 더한다. */
  const ghosts = ['성역', '파문', '심판(', '성스러운 폭풍', '칼부채', '버티기', '휩쓸기', '이중 시전'];
  const found = ghosts.filter(n => html.includes(n));
  ok(!found.length, '잘려 나간 기예의 이름이 화면에 없다 — 없는 버튼을 소개하는 설명은 버그다',
     found.length ? `유령: ${found.join(', ')}` : `${ghosts.length}개 다 없다`);
}

/* ═══ 4. 실측 — 넷이 다 나가는가 ═══════════════════════════ */
/* 여섯 판 아래로는 안 내려간다. 순교·성전처럼 조건이 좁은 궁극기는
   판당 0.5회쯤 나가므로, 두 판으로 「넷이 다 나간다」를 물으면 멀쩡한
   기예가 0으로 찍힌다 — 그리고 그 실패는 게임이 아니라 표본이다.
   간헐적으로 우는 벤치는 안 우는 것만 못하다(§6-6). */
const N = Math.max(6, Number(process.argv[2] || 10));
console.log(`\n── 실측 (${N}판씩 · 나간 것만 센다)`);
for (const cls of CLS) {
  for (const k of Object.keys(ARTUSE)) delete ARTUSE[k];
  for (const k of Object.keys(ARTMISS)) delete ARTMISS[k];
  let depth = 0;
  /* 판마다 **몇 레벨까지 갔는가**를 같이 센다. 없으면 이 절이 물을 수
     없는 것을 묻게 된다 — 순교는 12레벨이고 사제는 24판에 7판만 12에
     닿는다. 여섯 판으로 「순교가 안 나간다」를 물으면 절반쯤은 0이
     나오고, 그 0은 죽은 버튼이 아니라 **표본이 그 레벨에 못 간 것**
     이다. 간헐적으로 우는 벤치는 안 우는 것만 못하다(§6-6).
     그래서 갈라서 묻는다: 레벨에 닿은 판이 있었으면 「나가는가」를,
     하나도 없었으면 「그 직업이 제 궁극기까지 살지 못한다」를. 둘은
     다른 결함이고 고칠 자리도 다르다. */
  const topLv = [];
  for (let i = 0; i < N; i++) {
    Meta.forget(); depth += runBot('human', cls, i % 2 === 0).depth;
    topLv.push(G.player?.lv || 1);
  }
  const ids = (D.ARTS[cls] || []).map(a => a.id);
  const lvOf = Object.fromEntries((D.ARTS[cls] || []).map(a => [a.id, a.lv]));
  const reached = id => topLv.filter(lv => lv >= lvOf[id]).length;
  const used = ids.map(id => [id, ARTUSE[id] || 0]);
  const miss = ids.reduce((s, id) => s + (ARTMISS[id] || 0), 0);
  const total = used.reduce((s, [, n]) => s + n, 0);
  console.log(`   ${cls.padEnd(8)} ${(depth / N).toFixed(1)}층 · 최고 ${Math.max(...topLv)}레벨 · `
    + used.map(([id, n]) => `${id} ${n}`).join(' · ')
    + (miss ? `  ⚠ 헛손질 ${miss} (${Math.round(miss / (total + miss) * 100)}%)` : ''));
  const dead = used.filter(([id, n]) => n === 0 && reached(id) >= 3).map(([id]) => id);
  ok(!dead.length, `${cls} — 배운 판이 셋 이상인 기예는 다 나간다`,
     dead.length ? `판당 0회: ${dead.join(',')}` : `${total}회`);
  /* 궁극기(12레벨)에 닿은 판이 몇이었는가. 셋 미만이면 위 줄은 아무
     것도 안 물은 것이므로, 그 사실을 표에 적는다 — 조용히 넘어가면
     「초록이니 괜찮다」로 읽힌다(§6). */
  const ult = ids.find(id => lvOf[id] === 12);
  if (ult) console.log(`      ${ult}(12레벨)를 배운 판 ${reached(ult)}/${N}`
    + (reached(ult) < 3 ? ' — 표본이 거기까지 못 갔다. 위 줄은 이 칸을 안 물었다.' : ''));
  /* 헛손질은 정책과 규칙이 어긋난 만큼이다. 10%를 넘으면 그 표로는
     아무 판단도 하면 안 된다 — 실제로 86%였던 적이 있다. */
  ok(miss / Math.max(1, total + miss) < 0.10, `${cls} — 헛손질이 10% 아래다`,
     `${miss}회 / ${total + miss}회`);
}

console.log(bad ? `\n기예 벤치: ${bad}건 실패\n` : '\n기예 벤치: 골격 · 축 · 넷이 다 나간다\n');
process.exit(bad ? 1 : 0);
