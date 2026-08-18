/* ═══════════════════════════════════════════════════════════
   synergy.mjs — 어느 유물이 어느 직업을 살리는가

   플레이어: 「이후에 밸런스가 안 맞는 것은 종족×최적직업 시너지 &
   아이템 및 유물로 밸런싱하면 될 것 같다.」

   그 계획이 성립하려면 **직업마다 그 직업의 유물이 있어야 한다.**
   없으면 유물은 밸런싱 손잡이가 아니라 공용 스탯이고, 그때 유물로
   직업을 맞추려는 시도는 전부 헛손질이 된다. 이 파일은 그 전제를
   먼저 잰다.

   ── 240칸을 재지 않는다 ────────────────────────────────────
   처음에 생각한 자는 「유물 40 × 직업 6을 각각 굴려서 도달 층 차이를
   본다」였다. 그러면 240칸이고, 칸마다 배치 폭이 ±1.5층이라 쓸 만한
   해상도를 내려면 만 판을 넘게 굴려야 한다. 열두 시간짜리 벤치는
   아무도 안 돌리고, 안 돌리는 벤치는 없는 벤치다.

   그런데 **게임이 이미 그 표를 갖고 있었다.** 크랙 시스템이 유물마다
   「그 유물이 세는 것」을 하나씩 정해 두었다(RELIC_CRACKS[id].at) —
   거울 방패는 맞은 수를, 쌍둥이 룬은 외운 주문을, 저울추는 재운 수를.
   그 갈래는 마흔 개에 **열한 종**뿐이다. 즉 「유물 × 직업」이 아니라
   **「갈래 × 직업」 66칸**이 진짜 표이고, 그건 직업당 한 벌의 판으로
   전부 찬다. 장부는 유물을 안 들고 있어도 차니까.

   ── 비율이 아니라 「그 판에서 닿았는가」로 센다 ────────────
   100턴당 비율로 재서 문턱까지 걸리는 턴을 계산하려 했는데, 그건
   판 길이를 모형으로 끼워 넣는 짓이다. 판마다 그 판의 장부가 문턱에
   **실제로 닿았는지**만 세면 모형이 필요 없다. 비율 표는 「왜 닿는가」를
   설명하는 자리로만 남긴다.

   갈래 셋은 장부가 아니라 다른 곳에서 센다:
     floor — 그 유물을 낀 채 내려간 층. 도달 층으로 읽는다
     combo — 합이 아니라 **최고값**이다(ledgerPeak)
     fused — 융합 유물은 문턱이 0이다. 나올 때 이미 깨져 있다

   usage: node sim/synergy.mjs [판수]        (기본 20)
          node sim/synergy.mjs [판수] --deep  표가 지목한 짝만 실제로
                                              끼워서 도달 층을 잰다
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const { runBot } = await import('./_botlib.mjs');
const { G } = Game;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

const CLS = ['warrior', 'rogue', 'ranger', 'mage', 'priest', 'paladin'];
const KO = { warrior:'전사', rogue:'도적', ranger:'궁수', mage:'마법사', priest:'사제', paladin:'팔라딘' };
const N = Math.max(8, Number(process.argv[2]) || 20);
const DEEP = process.argv.includes('--deep');

/* 유물 → 갈래·문턱. 크랙이 없는 유물이 있으면 그것부터 결함이다. */
const spec = D.RELICS.map(r => ({ id:r.id, n:r.n, at: D.crackOf(r.id)?.at }));
const noCrack = spec.filter(s => !s.at);
ok(!noCrack.length, '유물 마흔이 전부 세는 것을 갖고 있다 — 안 세는 유물은 두 번째 줄이 없는 유물이다',
   noCrack.length ? noCrack.map(s => s.id).join(' ') : `${spec.length}개`);
const KINDS = [...new Set(spec.filter(s => s.at).map(s => s.at[0]))];

/* ═══ 1. 직업마다 세 배치를 굴린다 ═══════════════════════
   한 배치로 읽으면 안 된다. 12판에서 「8%」는 열두 판에 한 판이고,
   그 한 판이 있고 없고로 「이 유물의 직업」이 바뀐다 — 처음에 한
   배치로 재서 도굴꾼의 장갑을 마법사 것으로 찍었다(5/12 대 1/12).
   배치 셋을 굴려서 **중앙값**을 쓰고, 배치 사이의 폭을 같이 들고
   다닌다. 폭보다 작은 차이로는 이름을 안 붙인다(§6). */
const B = 3;
console.log(`\n── 판당 장부 (직업 ${B}배치 × ${N}판 · 중앙값)`);
const runs = {};          // cls -> batch -> [{ turn, depth, led }]
for (const cls of CLS) {
  runs[cls] = [];
  for (let b = 0; b < B; b++) {
    const bat = [];
    for (let i = 0; i < N; i++) {
      Meta.forget();
      const r = runBot('human', cls, i % 2 === 0);
      bat.push({ turn: r.turn, depth: r.depth, led: { ...(G.ledger || {}) } });
    }
    runs[cls].push(bat);
  }
}
const all = cls => runs[cls].flat();
/* 한 판의 어떤 갈래가 얼마나 찼는가. 갈래마다 세는 곳이 다르다. */
const got = (run, kind) => kind === 'floor' ? run.depth
  : kind === 'fused' ? 1
  : (run.led[kind] || 0);
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };

/* 단위가 갈래마다 다르다. 합으로 차는 것은 100턴당 비율이 읽히고,
   연격은 **최고값**이라(ledgerPeak) 비율이 아무 뜻이 없으며, 층은
   그냥 도달 층이다. 한 표에 섞어 놓고 숫자만 적으면 읽는 사람이
   연격 0.4를 「판당 0.4회」로 읽는다. 단위를 적는다.
   융합은 문턱이 0이라 여기 안 쓴다. */
const RAW = { combo: '최고', floor: '층' };
const TABLE = KINDS.filter(k => k !== 'fused');
console.log('  갈래           ' + CLS.map(c => KO[c].padStart(7)).join(''));
const rate = {};
for (const k of TABLE) {
  rate[k] = {};
  for (const cls of CLS)
    rate[k][cls] = RAW[k] ? med(all(cls).map(r => got(r, k)))
                          : med(all(cls).map(r => got(r, k) / Math.max(1, r.turn) * 100));
  console.log('  ' + `${k} ${RAW[k] || '/100턴'}`.padEnd(14)
    + CLS.map(c => rate[k][c].toFixed(rate[k][c] < 10 ? 2 : 0).padStart(7)).join(''));
}
console.log('  ' + '판 길이'.padEnd(13)
  + CLS.map(c => String(Math.round(med(all(c).map(r => r.turn)))).padStart(7)).join('') + '턴');

/* ═══ 2. 유물마다 — 어느 직업이 두 번째 줄을 여는가 ═══════
   ── 두 번 틀렸다. 적어 둔다 ────────────────────────────────
   처음에 잰 것은 「판마다 문턱에 닿았는가」의 **비율**이었다. 사람이
   겪는 것이 그것이므로 맞는 값 같았는데, 12판으로 재니 사제가 0개로
   나오고 3배치×20판으로 재니 이번에는 전사가 0개로 나왔다. 답이 뒤집힌
   것이다.

   비율이 나쁜 자인 이유: 그건 **이진화된 통계**다. 문턱이 분포의
   가운데쯤에 있으면 누적량이 조금만 흔들려도 「닿았다/못 닿았다」가
   통째로 뒤집히고, 그래서 배치 폭이 20~40%p 로 나왔다 — 재려는 차이와
   같은 크기다. 반면 누적량 자체(처치 수·맞은 수·외운 수)는 부드럽고,
   위의 장부 표에서 이미 자릿수가 갈려 보인다(치명타는 도적 5.74 대
   궁수 0.06).

   그래서 판정은 **누적량 ÷ 문턱**으로 한다. 1.0이면 「보통 판이 딱
   문턱에 닿는다」이고, 2.0이면 「보통 판이 두 배까지 간다」다. 비율은
   설명하는 자리로 남긴다 — 지우지는 않는다. 사람이 겪는 것은 여전히
   열렸는가이므로.

   그리고 「이 직업의 것」은 배치 폭에서 뽑은 문턱으로만 붙인다:
   여섯의 중앙값보다 **배치 폭보다 크게** 높을 때만. 폭보다 작은 차이로
   이름을 붙이면 표본을 유물의 성질로 읽는 것이다(§6). */
console.log(`\n── 유물마다 — 보통 판이 문턱의 몇 배까지 가는가 (1.0이면 딱 닿는다)`);
const ratio = {}, rspread = {}, opens = {}, perBatch = {};
for (const s2 of spec) {
  if (!s2.at) continue;
  ratio[s2.id] = {}; rspread[s2.id] = 0; opens[s2.id] = {}; perBatch[s2.id] = {};
  for (const cls of CLS) {
    const per = runs[cls].map(bat => med(bat.map(r => got(r, s2.at[0]))) / Math.max(1, s2.at[1]));
    perBatch[s2.id][cls] = per;
    ratio[s2.id][cls] = med(per);
    rspread[s2.id] = Math.max(rspread[s2.id], Math.max(...per) - Math.min(...per));
    opens[s2.id][cls] = all(cls).filter(r => got(r, s2.at[0]) >= s2.at[1]).length / (N * B);
  }
}
const fusedIds = spec.filter(s2 => s2.at?.[0] === 'fused').map(s2 => s2.id);
const real = spec.filter(s2 => s2.at && s2.at[0] !== 'fused');
/* 이름을 붙이는 규칙. 문턱은 상수가 아니라 **이 유물의 배치 폭**이다. */
/* ── floor 갈래는 시너지를 표현할 수 없다 ──────────────────
   처음 판정에서 floor 유물 **열한 개가 전부 도적 것**으로 찍혔다.
   도적이 도둑질을 잘해서가 아니라 **가장 깊이 가기 때문**이다 —
   floor 의 누적량은 도달 층 그 자체이고, 그러면 이 자는 유물이 아니라
   생존을 잰다. 종족 벤치가 직업을 재고 있던 것과 같은 결함이다.

   그래서 floor 갈래는 판정에서 뺀다. 그리고 그 사실 자체가 이 벤치가
   찾아낸 것 중 가장 큰 것이다: **마흔 중 열하나(28%)가 「N층까지
   내려간다」를 조건으로 쓴다.** 그 열하나는 무엇을 하는 유물이든
   두 번째 줄이 같은 방식으로 열리고, 그러면 크랙은 그 유물의 컨셉을
   말하지 않는다 — 아래 §3의 마지막 단언이 그것을 문다. */
const OWNABLE = k => k !== 'floor' && k !== 'fused';
const ownerOf = (s2) => {
  if (!OWNABLE(s2.at[0])) return { who: [], label: '— 층수 조건 (판정 안 함)' };
  const row = CLS.map(c => ratio[s2.id][c]);
  const top = Math.max(...row);
  if (top === 0) return { who: [], label: '— 아무도 못 연다' };
  /* ── 중앙값 하나로 이름을 붙였더니 개수가 흔들렸다 ────────
     같은 코드를 두 번 돌려서 도적이 13개와 2개로 나왔다. 「0개인
     직업이 넷」은 두 번 다 같았는데(그쪽이 이 벤치의 판정이다) 목록의
     길이는 못 믿을 값이었다 — 중앙값이 문턱을 겨우 넘는 유물은 배치가
     바뀌면 넘었다 못 넘었다 한다.
     그래서 **세 배치에서 모두** 문턱을 넘은 것만 이름을 붙인다. 한
     배치라도 못 넘으면 그건 「이 직업의 유물」이 아니라 잘 풀린 배치다.
     이러면 목록이 짧아지는데, 짧은 쪽이 사실이다. */
  const barOf = (i) => {
    const rowB = CLS.map(c => perBatch[s2.id][c][i]);
    const mid = med(rowB);
    return Math.max(mid + rspread[s2.id], mid * 1.25);
  };
  /* ── 두 질문을 한 문에 걸었다가 마법사를 잃었다 ────────────
     처음 조건이 `v >= barOf(i) && v >= 1.0` 이었다. 그런데 이 둘은
     **다른 질문**이다:
       ① 이 직업이 남들보다 이 갈래를 잘 만드는가  ← 시너지
       ② 그 직업의 보통 판이 문턱에 닿는가          ← 도달 가능성
     ①은 아주 튼튼하다(마법사의 주문 비율은 매 배치에서 남들의 6배다).
     ②는 흔들린다 — 일찍 죽은 배치에서는 마법사도 주문을 40번 못 왼다.
     둘을 곱해 놓으니 「쌍둥이 룬은 마법사 것이 아니다」가 나왔고,
     그건 어느 쪽 질문의 답도 아니다.
     이름은 ①로만 붙인다. ②는 아래 「실제로 열린 판의 비율」 표가
     따로 말하고, 그 둘이 갈려 있어야 「이 직업 것인데 문턱이 높다」는
     결함이 보인다 — hit 갈래 셋이 정확히 그 모양이다. */
  const who = CLS.filter(c => perBatch[s2.id][c].every((v, i) => v >= barOf(i)));
  if (!who.length) return { who: [], label: top >= 1.0 ? '— 공용' : '— 공용(누구도 잘 못 연다)' };
  const reach = who.some(c => ratio[s2.id][c] >= 1.0);
  return { who, label: who.map(c => KO[c]).join('/') + (reach ? '' : ' (문턱이 높다)') };
};
console.log('  유물             갈래       ' + CLS.map(c => KO[c].padStart(6)).join('') + '    폭   이 유물의 직업');
for (const s2 of real.slice().sort((a, b) => a.at[0] < b.at[0] ? -1 : a.at[0] > b.at[0] ? 1 : 0))
  console.log(`  ${s2.n.padEnd(12)} ${(s2.at[0] + ' ' + s2.at[1]).padEnd(11)}`
    + CLS.map(c => ratio[s2.id][c].toFixed(2).padStart(6)).join('')
    + rspread[s2.id].toFixed(2).padStart(6) + '   ' + ownerOf(s2).label);
console.log(`  (융합 여섯은 문턱이 0이라 뺐다: ${fusedIds.join(' ')})`);

/* 사람이 겪는 것은 여전히 「열렸는가」다. 위 표가 판정하고, 이 표가
   그 판정이 판에서 무엇으로 보이는지 말한다. */
console.log(`\n── (참고) 실제로 열린 판의 비율 — ${N * B}판 중`);
console.log('  유물             ' + CLS.map(c => KO[c].padStart(6)).join(''));
for (const s2 of real.slice().sort((a, b) => (Math.max(...CLS.map(c => opens[b.id][c])))
                                            - (Math.max(...CLS.map(c => opens[a.id][c])))).slice(0, 8))
  console.log(`  ${s2.n.padEnd(14)}` + CLS.map(c => `${Math.round(opens[s2.id][c] * 100)}%`.padStart(6)).join(''));

/* ═══ 3. 단언 ═════════════════════════════════════════════ */
console.log('');
/* ① 아무도 못 세는 갈래가 있으면 그 갈래의 유물은 전부 두 번째 줄이
   없는 유물이다. relicrack.mjs 가 「갈래 하나가 통째로 죽어 있으면
   그 조건은 설계가 아니라 장식」이라고 이미 적어 뒀고, 여기서는
   **직업별로** 같은 질문을 한다. */
const deadKind = TABLE.filter(k => CLS.every(c => rate[k][c] === 0));
ok(!deadKind.length, '열한 갈래를 만드는 직업이 갈래마다 하나는 있다',
   deadKind.length ? `아무도 안 만드는 갈래: ${deadKind.join(' ')}` : `${TABLE.length}종`);

/* ② 아무도 못 여는 유물. 그 유물의 두 번째 줄은 **없는 줄**이다. */
const unopened = real.filter(s2 => CLS.every(c => ratio[s2.id][c] === 0));
ok(!unopened.length, '유물마다 두 번째 줄을 여는 직업이 하나는 있다 — 아무도 못 여는 줄은 없는 줄이다',
   unopened.length ? unopened.map(s2 => `${s2.n}(${s2.at[0]} ${s2.at[1]})`).join(' · ') : `${real.length}개`);

/* ③ **이 파일의 이유.** 직업마다 「그 직업의 유물」이 있어야 유물로
   직업을 맞출 수 있다. 하나도 없는 직업이 있으면 그 계획은 그 직업에
   대해서만 성립하지 않고, 그건 미리 알아야 하는 사실이다. */
console.log('');
const mine = {};
for (const cls of CLS) {
  mine[cls] = real.filter(s2 => ownerOf(s2).who.includes(cls));
  console.log(`  ${KO[cls].padEnd(4)} ${mine[cls].length}개  ${mine[cls].map(s2 => s2.n).join(' · ') || '없음'}`);
}
console.log('');
/* ④ 크랙 조건이 유물의 컨셉을 말하는가. 한 갈래가 목록의 4분의 1을
   넘게 쓰고 있으면, 그 갈래의 유물들은 **서로 다른 물건인데 같은
   방식으로 열린다.** 그리고 그 갈래가 하필 「층수」라면 여는 조건이
   컨셉과 아무 관계가 없다 — 굶주린 칼날과 곡예사의 신이 같은 조건으로
   열릴 이유가 없다. */
const byKind = {};
for (const s2 of real) (byKind[s2.at[0]] ||= []).push(s2);
const fat = Object.entries(byKind).filter(([, v]) => v.length > real.length * 0.25);
ok(!fat.length,
   '한 갈래가 유물 목록의 4분의 1을 넘게 쓰지 않는다 — 넘으면 그 갈래의 유물들은 서로 다른 물건인데 같은 방식으로 열린다',
   fat.length ? fat.map(([k, v]) => `${k} ${v.length}/${real.length}`).join(' · ')
              : Object.entries(byKind).map(([k, v]) => `${k} ${v.length}`).join(' '));

const barren = CLS.filter(c => mine[c].length === 0);
ok(!barren.length,
   '직업마다 **그 직업의 유물**이 있다 — 없으면 그 직업은 유물로 못 맞춘다',
   barren.length ? `한 개도 없는 직업: ${barren.map(c => KO[c]).join(' ')}` : CLS.map(c => `${KO[c]} ${mine[c].length}`).join(' · '));

/* ═══ 4. 깊이 재기 (--deep) ═══════════════════════════════
   위의 표는 「두 번째 줄이 열리는가」를 잰다. 그것과 「그래서 더 깊이
   가는가」는 다른 질문이고, 뒤쪽은 배치 폭(±1.5층) 때문에 짝마다 수십
   판이 든다. 그래서 **표가 지목한 짝만** 잰다 — 240칸을 다 재는 대신
   여섯 칸을 제대로 재는 쪽이 읽을 수 있는 숫자를 낸다. */
if (DEEP) {
  console.log('\n── 실제로 끼워 보기 (표가 지목한 짝만 · 3배치)');
  const M = Math.max(6, Math.round(N / 2));
  const depthOf = (cls, relic) => {
    const bat = [];
    for (let b = 0; b < B; b++) {
      let s = 0;
      for (let i = 0; i < M; i++) {
        Meta.forget();
        /* 시작하자마자 손에 쥐여 준다. runBot 안에서 판이 시작되므로
           첫 턴 훅에서 준다 — 봇이 주워 오기를 기다리면 그건 유물이
           아니라 드롭 확률을 재는 것이다(relicrack.mjs 가 같은 실수를
           한 번 했다). */
        let given = !relic;
        s += runBot('human', cls, i % 2 === 0, { onTurn: () => {
          if (given) return;
          given = true; Game.takeRelic(relic);
        } }).depth;
      }
      bat.push(s / M);
    }
    return { m: bat.reduce((a, x) => a + x, 0) / B, w: Math.max(...bat) - Math.min(...bat) };
  };
  for (const cls of CLS) {
    const pick = mine[cls][0];
    const base = depthOf(cls, null);
    if (!pick) { console.log(`  ${KO[cls].padEnd(4)} 지목된 유물 없음 · 기준 ${base.m.toFixed(2)}층 (±${base.w.toFixed(1)})`); continue; }
    const with_ = depthOf(cls, pick.id);
    const d = with_.m - base.m, noise = Math.max(base.w, with_.w);
    console.log(`  ${KO[cls].padEnd(4)} ${pick.n.padEnd(12)} ${base.m.toFixed(2)} → ${with_.m.toFixed(2)}층`
      + ` (${d >= 0 ? '+' : ''}${d.toFixed(2)} · 배치 폭 ±${noise.toFixed(1)})`
      + (Math.abs(d) > noise ? '  ← 폭 밖' : '  (폭 안 — 안 움직였다)'));
  }
  console.log('\n  이 절은 판정하지 않는다. 배치 폭이 차이보다 큰 동안은 「움직였다」를');
  console.log('  말할 수 없고, 그 사실을 초록/빨강으로 바꾸면 잡음이 판정이 된다(§6).');
}

console.log(bad ? `\n시너지 벤치: ${bad}건 실패\n`
                : '\n시너지 벤치: 갈래마다 만드는 직업이, 유물마다 여는 직업이, 직업마다 제 유물이 있다\n');
process.exit(bad ? 1 : 0);
