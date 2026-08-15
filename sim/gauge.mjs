/* gauge.mjs — 로그가 계기판처럼 말하고 있는가.

   이 게임의 목소리는 「설명하지 않는다」다. 「팔을 당긴다」이지
   「다음 턴 2.5배」가 아니고, 「셈이 이만큼 쌓였다」이지 「문턱
   +12%p」가 아니다. 그런데 규칙을 새로 넣을 때마다 그 규칙을 만든
   사람의 손버릇이 문장에 딸려 들어온다 — 「%p」, 「×1.55」, 「160턴」.
   화면 옆의 표에서는 맞는 말이고, **흐르는 로그에서는 틀린 말**이다.

   그래서 세는 자리를 로그로 좁힌다: say() · toast() 안의 글자만 본다.
   유물 설명이나 상점 표는 표이고, 표는 숫자로 말해도 된다. 로그는
   세계가 나에게 말을 거는 자리라서 세계는 배율을 모른다.

   판정은 「이보다 늘지 않는다」다. 기존 위반을 다 고치기 전에 빨간
   벤치를 만들면 그 벤치는 그냥 꺼져 있는 벤치가 된다 — 문턱을 지금
   값에 박아 두고, 한 건이라도 늘면 실패한다. 고칠 때마다 문턱을
   내려 잠근다.

   usage: node sim/gauge.mjs [--list]                             */
import fs from 'node:fs';

/* 지금 걸려 있는 건수. 여기서 **늘지 않는다**가 전부다.
   한 건 고칠 때마다 이 숫자를 같이 내린다. */
const CEILING = 4;

const FILES = ['game.js', 'data.js', 'ui.js', 'events.js', 'world.js'];

/* ── 주석을 걷어낸다 ──────────────────────────────────────
   이 저장소의 주석은 본문보다 길고 숫자로 가득하다. 주석까지 세면
   벤치가 재는 것은 문장이 아니라 설계 노트가 된다. 줄 수는 지킨다
   — 자리를 파일:줄로 짚어야 고칠 수 있다. */
function stripComments(src) {
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; }
      i += 2;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c;
      out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    out += c; i++;
  }
  return out;
}

/* say(...)·toast(...)의 괄호 한 벌을 통째로 떠낸다. 정규식으로는
   못 한다 — 인자에 삼항이 들어가고 문자열이 여러 줄에 걸친다. */
function calls(src) {
  const out = [];
  const rx = /\b(say|toast)\s*\(/g;
  let m;
  while ((m = rx.exec(src))) {
    let i = rx.lastIndex, depth = 1;
    const from = i;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '\'' || c === '"' || c === '`') {
        const q = c; i++;
        while (i < src.length) {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === q) { i++; break; }
          i++;
        }
        continue;
      }
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push({ at: m.index, body: src.slice(from, i - 1) });
    rx.lastIndex = i;
  }
  return out;
}

/* 인자 안의 글자만 남긴다. `${...}` 안은 값이지 글이 아니므로
   구멍으로 바꿔 둔다 — 다만 구멍 자체는 흔적을 남겨서 「${x}배」가
   잡히게 한다. */
function literals(body) {
  const out = [];
  const rx = /`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;
  let m;
  while ((m = rx.exec(body))) {
    const raw = m[0].slice(1, -1);
    out.push(raw.replace(/\$\{[^}]*\}/g, '□'));   // □ = 채워지는 값
  }
  return out;
}

/* ── 계기판 어휘 ──────────────────────────────────────────
   전부 「값이 얼마인지」를 말하는 말이다. 세계는 값을 모른다 —
   세계가 아는 것은 무거워졌다, 뜨겁다, 오래 못 간다뿐이다. */
const VOCAB = [
  { id:'%p',  rx:/%p/,                    why:'퍼센트포인트 — 규칙표의 말' },
  { id:'배',  rx:/[\d□]\s*배(?![우움])/, why:'배율 — 「1.55배」는 계산기가 하는 말' },
  { id:'×',   rx:/×/,                     why:'곱하기 기호' },
  { id:'%',   rx:/[\d□]\s*%/,        why:'퍼센트' },
  { id:'턴',  rx:/[\d□]\s*턴(?!다)/, why:'턴 수 — 세계에는 시계가 없다' },
];

const arg = process.argv[2];
let hits = [];

for (const f of FILES) {
  const url = new URL(`../src/${f}`, import.meta.url);
  const raw = fs.readFileSync(url, 'utf8');
  const src = stripComments(raw);
  for (const c of calls(src)) {
    const line = src.slice(0, c.at).split('\n').length;
    for (const lit of literals(c.body)) {
      const v = VOCAB.find(x => x.rx.test(lit));
      if (!v) continue;
      hits.push({ f, line, v, text: lit.replace(/\s+/g, ' ').trim() });
      break;                     // 한 줄에 한 건. 어휘 수가 아니라 문장 수를 센다
    }
  }
}

console.log('\n계기판 벤치 — 로그가 표처럼 말하고 있는가\n');

const byId = new Map();
for (const h of hits) byId.set(h.v.id, (byId.get(h.v.id) || 0) + 1);
for (const v of VOCAB) {
  const n = byId.get(v.id) || 0;
  if (n) console.log(`  ${String(n).padStart(3)}건  ${v.id.padEnd(3)} ${v.why}`);
}

console.log('');
for (const h of hits)
  console.log(`  ✗ src/${h.f}:${h.line}  [${h.v.id}]  ${h.text.slice(0, 92)}`);

console.log(`\n  걸린 문장 ${hits.length}건 · 문턱 ${CEILING}건`);

const bad = hits.length > CEILING;
if (bad) {
  console.log(`\n계기판 벤치: ${hits.length - CEILING}건 늘었다. ` +
              '로그는 값이 아니라 무게를 말해야 한다.\n');
} else if (hits.length < CEILING) {
  console.log(`\n계기판 벤치: 통과. ${CEILING - hits.length}건 줄었다 — ` +
              `sim/gauge.mjs의 CEILING을 ${hits.length}으로 내려 잠글 것.\n`);
} else {
  console.log('\n계기판 벤치: 통과 (늘지 않았다)\n');
}
process.exit(bad ? 1 : 0);
