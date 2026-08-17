/* ═══════════════════════════════════════════════════════════
   knots.mjs — 한 함수가 몇 갈래인가

   외부 평가 보고서가 순환 복잡도 15/30을 문턱으로 제시했다. 그
   보고서의 나머지는 이 저장소를 안 보고 쓴 일반론이었지만(C# GC와
   Valgrind와 「A*를 폐기하라」 — 우리는 A*를 쓴 적이 없다), 이 지적
   하나는 정확히 아픈 데를 찔렀다. 재 보니:

       네 파일 · 함수 289개 중 복잡도 15 초과 66개 · 30 초과 23개
       pump 169(877줄) · draw 158(506줄) · useArt 132(460줄)
       monsterTurn 91 · enterDepth 85 · endTurn 78 · refresh 74

   그리고 이건 학술적 지적이 아니다. **이번 세션에 찾아낸 버그의
   자리가 전부 이 목록 안이다** — hurtPlayer가 체력을 먼저 0으로
   만들어 martyrDebt가 항상 1이던 것, campRest가 지출과 보충을 같은
   호출에 넣어 저울이 없던 것. 길고 분기 많은 함수는 「읽기 어렵다」가
   아니라 **두 가지 일이 한 호출 안에서 서로를 지운다**는 뜻이었다.

   ── 지금은 대량으로 실패한다. 그게 정상이다. ──
   실루엣 린트와 같은 방식으로 간다: 현재 값을 기준선에 박고
   「이보다 나빠지지 않는다」만 단언한다. 아래 인쇄되는 목록이 곧
   해체 순서다. BASE를 **올려** 적는 커밋이 곧 회귀다.

   재는 방법은 거칠다(정규식으로 분기 토큰을 센다). 정확한 AST가
   아니라는 것을 알고 쓴다 — 여기서 필요한 것은 절대값이 아니라
   **어제보다 나빠졌는가**이고, 같은 자로 재는 한 그 질문에는
   정확히 답한다.

   usage: node sim/knots.mjs [--print]
   ═══════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';

/* ── 기준선 ────────────────────────────────────────────────
   2026-08-15 실측. 전부 0이 되어야 할 숫자다. */
const BASE = {
  over30: 23,      // 복잡도 30 초과 — 「유지보수 불가」 구간
  over15: 66,      // 복잡도 15 초과 — 「버그가 숨는」 구간
  worst: 169,      // 최악값 (juice.js의 pump — 갈래 70짜리 표를 뺀 값)
  longest: 867,    // 가장 긴 함수의 줄 수 (같은 pump)
};

const FILES = ['src/game.js', 'src/ui.js', 'src/world.js', 'src/juice.js'];

/* 분기 토큰. 둘을 조심한다.

   하나, `?`는 삼항과 옵셔널 체이닝(`?.`)·널 병합(`??`)이 섞인다.
   먼저 지운다 — 안 지우면 안전하게 쓴 코드가 벌을 받는다.

   둘, **`case`는 세지 않는다.** 처음에는 셌는데 그러면 juice.js의
   `pump`가 239로 1등이 된다. 그건 사건 종류마다 한 갈래인 **표**이지
   매듭이 아니다. 표는 길어도 두 갈래가 서로를 지우지 않는다 — 이
   린트가 잡으려는 것은 「한 호출 안에서 두 가지 일이 서로를 지우는」
   모양이고, 그건 중첩과 조건의 상호작용에서 나온다.
   대신 갈래 수를 따로 세어 인쇄한다: 표가 너무 커지는 것도 정보다. */
function complexity(body) {
  const clean = body.replace(/\?\./g, '').replace(/\?\?/g, '');
  const m = clean.match(/\bif\b|\bfor\b|\bwhile\b|\bcatch\b|&&|\|\||\?/g);
  return 1 + (m ? m.length : 0);
}
const cases = body => (body.match(/\bcase\b/g) || []).length;

function scan(path) {
  const src = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const out = [];
  for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm)) {
    const open = src.indexOf('{', m.index + m[0].length);
    if (open < 0) continue;
    let depth = 0, j = open;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { depth--; if (!depth) break; }
    }
    const body = src.slice(open, j);
    out.push({ file: path, name: m[1], cc: complexity(body),
               cases: cases(body), lines: body.split('\n').length });
  }
  return out;
}

const all = FILES.flatMap(scan).sort((a, b) => b.cc - a.cc);
const over30 = all.filter(f => f.cc > 30);
const over15 = all.filter(f => f.cc > 15);
const worst = all[0]?.cc || 0;
const longest = Math.max(...all.map(f => f.lines), 0);

console.log(`\n매듭 린트 — 함수 ${all.length}개 · 파일 ${FILES.length}개\n`);
console.log(`  복잡도 30 초과  ${over30.length}개  (기준선 ${BASE.over30})`);
console.log(`  복잡도 15 초과  ${over15.length}개  (기준선 ${BASE.over15})`);
console.log(`  최악 ${worst} · 가장 긴 함수 ${longest}줄\n`);

console.log('  ── 해체 순서 (위에서부터) ──');
for (const f of all.slice(0, 14))
  console.log(`   ${f.cc > 30 ? '✘' : f.cc > 15 ? '·' : ' '} ${f.name.padEnd(20)}`
    + ` 복잡도 ${String(f.cc).padStart(4)} · ${String(f.lines).padStart(4)}줄`
    + `${f.cases ? ` · 갈래 ${f.cases}` : '        '}  ${f.file}`);
console.log('');

if (process.argv.includes('--print')) {
  console.log('const BASE = {');
  console.log(`  over30: ${over30.length},`);
  console.log(`  over15: ${over15.length},`);
  console.log(`  worst: ${worst},`);
  console.log(`  longest: ${longest},`);
  console.log('}\n');
}

let bad = 0;
const cmp = (label, now, base, unit = '') => {
  const worse = now > base;
  console.log(`  ${worse ? '✗' : '·'} ${label.padEnd(16)} 기준 ${String(base).padStart(5)}`
    + ` · 지금 ${String(now).padStart(5)}${unit}`
    + `  ${worse ? '↑ 나빠졌다' : now < base ? '↓ 좋아졌다 (BASE를 내려 적을 것)' : '='}`);
  if (worse) bad++;
};
console.log('  ── 회귀 판정 ──');
cmp('30 초과 개수', over30.length, BASE.over30);
cmp('15 초과 개수', over15.length, BASE.over15);
cmp('최악 복잡도', worst, BASE.worst);
cmp('가장 긴 함수', longest, BASE.longest, '줄');

console.log(bad ? `\n매듭 린트: ${bad}개 항목이 기준선보다 나빠졌다\n`
                : '\n매듭 린트: 기준선보다 나빠진 것이 없다\n');
process.exit(bad ? 1 : 0);
