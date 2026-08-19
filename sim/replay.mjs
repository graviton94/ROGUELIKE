/* ═══════════════════════════════════════════════════════════
   replay.mjs — 사람이 실제로 친 판을 읽는다

   플레이어: 「플레이 로그 파일로 추출할 수 있는 기능 만들어라.
   그걸 토대로 니가 리뷰하는게 낫겠다. **봇으로 재현하지 말고.**」

   이 파일이 그 「토대」다. 게임에서 내려받은 판 기록을 넣으면 층별
   표와 판정을 찍는다.

   ── 왜 이게 봇보다 나은가 ──────────────────────────────────
   이번 세션에 저지른 측정 실수의 절반이 **봇으로 사람을 흉내 내다**
   난 것이다. 봇은 중앙 8층에서 죽는데 사람은 15층을 클리어한다.
   그 간극을 손으로 세운 영웅으로 메우려다 성장 곡선을 통째로 틀리게
   잡았고(POWER_STEP 1.45 — 15층 기대치가 도달 불가능한 14,166이
   되어 **후반 내내 주목이 0**이었다), 그 상태의 판을 플레이어가
   3554턴에 클리어하고 「개쉽다」고 말했다.

   사람의 판이 파일로 나오면 그 자리가 통째로 없어진다. 여기서 재는
   것은 전부 **그 판에서 실제로 일어난 일**이다.

   usage: node sim/replay.mjs <파일.json>
   ═══════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) { console.log('usage: node sim/replay.mjs <판기록.json>'); process.exit(2); }

/* 파일 앞에 사람이 읽는 머리말이 붙어 있다 — 첫 `{` 부터가 원본이다. */
const raw = readFileSync(path, 'utf8');
const d = JSON.parse(raw.slice(raw.indexOf('{')));

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };
const ev = d.events || [];
const ins = ev.filter(e => e.k === 'floor.in');
const outs = ev.filter(e => e.k === 'floor.out');

console.log(`\n판 기록 — ${d.build} · ${d.race}/${d.cls} Lv${d.lv}`);
console.log(`${d.deepest}층 · ${d.turns}턴 · `
  + (d.ending ? (d.ending.win ? '클리어' : `${d.ending.by}에게`) : '진행 중')
  + ` · 유물 ${d.relics.length} · 총 강화 +${d.plus}\n`);

/* ── 이 브라우저에 남아 있던 것 ────────────────────────────
   층별 기록은 v43 부터만 쌓인다. 그 전에 친 판들은 층별로는 사라졌지만
   **누적 장부와 저장 슬롯**은 남아 있고, 파일이 그것도 싣고 온다.
   층별 표만큼 자세하지는 않아도 「몇 판에 몇 번 완주했나」와 「그
   순간 손에 뭐가 있었나」는 여기서 나온다 — 밸런스 질문의 절반이
   실은 그 둘이다. */
if (d.meta) {
  const m = d.meta, t = m.totals || {}, b = m.best || {};
  console.log('  ── 누적 장부 ──');
  console.log(`  판 ${m.runs || 0}회 · 완주 ${m.wins || 0}회`
    + (m.runs ? ` (완주율 ${(100 * (m.wins || 0) / m.runs).toFixed(0)}%)` : '')
    + ` · 최고 ${b.depth || 0}층 Lv${b.lv || 0} · 최고 연격 ${b.combo || 0}`
    + ` · 최고 금화 ${b.gold || 0} · 최단 ${b.turn || 0}턴`);
  console.log(`  누적 — 처치 ${t.kills || 0} · 벼림 ${t.forged || 0} · 상자 ${t.opened || 0}`
    + ` · 각인 ${t.engraved || 0} · 내려간 층 ${t.depth || 0}`);
  if (m.last) {
    const l = m.last;
    console.log(`  마지막 판 — ${l.race || '?'}/${l.cls || '?'} Lv${l.lv || 0}`
      + ` · ${l.depth || 0}층 · ${l.turn || 0}턴 · ${l.win ? '클리어' : (l.by || '죽음')}`);
  }
  for (const f of (m.fallen || []).slice(0, 3))
    console.log(`  시체 — ${f.cls || '?'} Lv${f.lv || 0} · ${f.depth || 0}층 · ${f.by || '?'}`);
  console.log('');
}
if (d.slots?.length) {
  console.log('  ── 저장 슬롯 (진행 중이던 판이 멈춘 순간) ──');
  for (const s of d.slots) {
    console.log(`  #${s.slot} ${s.race}/${s.cls} Lv${s.lv} · ${s.depth}층(최고 ${s.deepest})`
      + ` · ${s.hp} · ${s.turn}턴 · 금화 ${s.gold} · 주목 ${s.heat}/${s.provoked}`
      + ` · 총 강화 +${s.plus} · 처치 ${s.kills} · 최고 연격 ${s.bestCombo}`);
    console.log(`     유물 ${(s.relics || []).join(' · ') || '—'}`);
    console.log(`     크랙 ${(s.cracks || []).length}개`
      + (s.strangeSeen?.length ? ` · 이물 ${s.strangeSeen.join(' · ')}` : ''));
    for (const it of s.gear || [])
      console.log(`     ${it.unique ? '★' : '·'} ${it.n}`
        + (it.plus ? ` +${it.plus}` : '')
        + [it.pre, it.suf, it.boon, ...(it.engrave || [])].filter(Boolean)
            .map(x => ` [${x}]`).join(''));
  }
  console.log('');
}

if (!ev.length) {
  console.log('  (층별 기록이 없는 파일 — 이 판을 v43 이후로 한 번 굴리면');
  console.log('   층마다 주목·비율·전투력·쓴 턴·기예까지 같이 나온다.)\n');
  process.exit(0);
}

/* ── 층별 표 ──────────────────────────────────────────────
   「이 판이 어디서 쉬웠나」는 한 줄로 안 나온다. 층마다 나란히
   놓아야 어느 구간이 평평했는지가 보인다. */
console.log('  층 주목  비율   전투력  기대  깨어서 정예  여유/쓴턴   최저체력  받은  물약  기예');
for (const i of ins) {
  const o = outs.find(x => x.depth === i.depth && x.turn >= i.turn) || {};
  const used = o.turns ?? '?';
  const over = (o.turns ?? 0) - (i.budget ?? 0);
  console.log(`  ${String(i.depth).padStart(2)}`
    + `${String(i.heat).padStart(5)}`
    + `${String(i.ratio).padStart(6)}`
    + `${String(i.power).padStart(8)}${String(i.want).padStart(7)}`
    + `${String(i.awake) + '/' + i.mons}`.padStart(8)
    + `${String(i.elite).padStart(5)}`
    + `  ${String(i.budget).padStart(4)}/${String(used).padEnd(4)}${over > 0 ? '↑' : ' '}`
    + `${String(o.lowHp ?? '?').padStart(8)}`
    + `${String(o.took ?? '?').padStart(7)}`
    + `${String(o.gulps ?? '?').padStart(5)}`
    + `  ${(o.arts || []).join(' ') || '—'}`);
}

/* ── 판정 ─────────────────────────────────────────────────
   전부 「이 판에서 무엇이 일어나지 않았나」를 묻는다. 일어나야
   하는데 안 일어난 것이 곧 무너진 자리다. */
console.log('');
{
  const deep = ins.filter(i => i.depth >= 9);
  if (!deep.length) console.log('  (9층 아래를 안 밟은 판 — 후반 판정은 생략한다)');
  else {
    const hot = deep.filter(i => i.heat > 0).length;
    ok(hot >= deep.length * 0.5,
       '후반에 주목이 실제로 걸린다 — 늘 0이면 러버밴드가 꺼져 있는 것이다',
       `9층 아래 ${deep.length}개 층 중 ${hot}개에서 주목 > 0`);
    const ratios = deep.map(i => i.ratio);
    ok(Math.max(...ratios) >= 0.7,
       '곡선이 도달 가능한 곳에 있다 — 아무리 잘 굴려도 비율이 1에 못 가면 곡선이 틀린 것이다',
       `후반 최대 비율 ${Math.max(...ratios)}`);
  }
}
{
  /* 층을 얼마나 넘겨 썼나. 넘겼는데 아무 일도 안 일어났으면
     인내심 시계는 장식이다. */
  const pairs = ins.map(i => [i, outs.find(x => x.depth === i.depth && x.turn >= i.turn)])
                   .filter(([, o]) => o);
  const over = pairs.filter(([i, o]) => o.turns > i.budget);
  const waves = pairs.reduce((n, [, o]) => Math.max(n, o.waves || 0), 0);
  console.log(`  층의 여유를 넘긴 층 ${over.length}/${pairs.length} · 그 판의 최대 파도 ${waves}`);
  if (over.length) ok(waves > 0,
    '여유를 넘긴 판에서는 파도가 실제로 왔다 — 안 오면 시계가 장식이다', `파도 ${waves}`);
}
{
  const closes = ev.filter(e => e.k === 'close');
  const byFloor = {};
  for (const c of closes) byFloor[c.depth] = (byFloor[c.depth] || 0) + 1;
  console.log(`  죽을 뻔한 순간(체력 25% 아래로) ${closes.length}회`
    + (closes.length ? ` — ${Object.entries(byFloor).map(([k, v]) => `${k}층 ${v}`).join(' · ')}` : ''));
  const deepClose = closes.filter(c => c.depth >= 9).length;
  ok(!ins.some(i => i.depth >= 12) || deepClose > 0,
     '후반에 한 번은 몰렸다 — 열두 층을 걷는 동안 한 번도 안 몰렸다면 그건 난이도가 아니다',
     `9층 아래 ${deepClose}회`);
}
{
  const arts = {};
  for (const o of outs) for (const a of o.arts || []) {
    const [k, n] = a.split('×'); arts[k] = (arts[k] || 0) + Number(n || 1);
  }
  const list = Object.entries(arts).sort((a, b) => b[1] - a[1]);
  console.log(`  쓴 기예 — ${list.length ? list.map(([k, v]) => `${k} ${v}`).join(' · ') : '없음'}`);
  ok(list.length >= 2,
     '기예를 두 종류 이상 썼다 — 하나만 눌렀다면 나머지는 버튼이지 선택이 아니다',
     `${list.length}종`);
}
{
  const got = ev.filter(e => e.k === 'relic').map(e => e.n);
  const cracks = ev.filter(e => e.k === 'crack').length;
  const odd = ev.filter(e => e.k === 'strange').map(e => e.n);
  const anvil = ev.filter(e => e.k === 'anvil').length;
  console.log(`  유물 ${got.length} (${got.join(' · ') || '—'}) · 크랙 ${cracks} · 모루 ${anvil}회`
    + (odd.length ? ` · 이물 ${odd.join(' · ')}` : ''));
}
const death = ev.find(e => e.k === 'death');
if (death) {
  console.log(`\n  ${death.depth}층 · ${death.by}에게`);
  for (const line of death.post || []) console.log(`    ${line}`);
}

console.log(bad ? `\n판 기록: 무너진 자리 ${bad}곳\n` : '\n판 기록: 판정한 것 전부 통과\n');
process.exit(0);
