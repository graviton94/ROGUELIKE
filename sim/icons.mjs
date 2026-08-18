/* ═══════════════════════════════════════════════════════════
   icons.mjs — 유물과 이름 있는 무기가 각자 제 얼굴인가

   플레이어: 「최정상급 아이템, 유물은 아이콘도 각자 unique하게」.

   그럴 만했다. 유물 마흔이 스프라이트 **열 개**를 나눠 쓰고 있었다 —
   목걸이 아홉, 반지 아홉, 두루마리 다섯, 검 다섯. 배낭에서 「피의
   계약」과 「메아리의 종」과 「앙심」이 완전히 같은 그림이었고, 그러면
   이 게임에서 규칙을 바꾸는 유일한 물건이 화면에서는 구분되지 않는다.
   이름 있는 무기 일곱도 평범한 단검·활·대검을 그대로 입고 있었다.

   묻는 것 넷:
     1. 전부가 각자 다른 그림을 **가리키는가** (데이터)
     2. 그 그림이 실제로 **있는가** (없으면 빈 칸이 그려진다)
     3. 은총 여섯이 각자 제 문장을 갖는가 — 초월은 절차적으로
        만들어져서 제 그림을 미리 못 갖는다
     4. 서로 얼마나 닮았는가는 sim/silhouette.mjs 가 **그려진 그림**
        으로 잰다. 여기서는 원본 격자만 보고, 그 차이를 적어 둔다 —
        처음에 원본 격자로 9쌍이라고 보고했다가 그려진 그림으로 재니
        221쌍이었다. 외곽선이 붙으면 꽉 찬 그림은 전부 덩어리가 된다.

   usage: node sim/icons.mjs
   ═══════════════════════════════════════════════════════════ */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const D = await import('../src/data.js');
const P = await import('../src/pixels.js');
let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if (!c) bad++; };

/* 「마흔일곱」을 제목과 단언에 손으로 적어 두고 있었다. 유물을 여섯
   지으니 쉰셋인데 화면에는 계속 마흔일곱이라고 적혀 있었다 — 이 파일이
   스스로 「손으로 적은 목록은 어긋난다」고 적어 놓은 그 자리다. */
const FACES = D.RELICS.length + D.UNIQUES.length;
console.log(`\n아이콘 벤치 — ${FACES}종이 각자 제 얼굴인가\n`);

/* ── 1·2. 각자 다른 그림을, 실제로 있는 그림을 ────────── */
{
  const rows = [...D.RELICS.map(r => ['유물', r.id, r.n, r.spr]),
                ...D.UNIQUES.map(u => ['이름', u.id, u.n, u.spr])];
  const seen = new Map();
  const shared = [], missing = [];
  for (const [kind, id, n, spr] of rows) {
    if (!P.SPRITES[spr]) missing.push(`${n}(${spr})`);
    if (seen.has(spr)) shared.push(`${n} = ${seen.get(spr)}`); else seen.set(spr, n);
    void kind; void id;
  }
  ok(shared.length === 0, `${FACES}종이 각자 다른 그림을 가리킨다 — 같은 그림을 쓰는 짝이 없다`,
     shared.length ? shared.slice(0, 5).join(' · ') : `${rows.length}종 · 그림 ${seen.size}장`);
  ok(missing.length === 0, '가리키는 그림이 전부 실제로 있다 — 없으면 빈 칸이 그려진다',
     missing.length ? missing.join(' ') : '');

  /* 그리고 그 그림들이 서로의 것이 아니어야 한다 — 유물 아이콘이
     실수로 몬스터나 지형 그림을 가리키면 위 둘은 통과한다. */
  const strays = rows.filter(([, , , spr]) => !/^[ru]_/.test(spr));
  ok(strays.length === 0, '전부 제 이름의 그림을 쓴다 (r_ · u_)',
     strays.length ? strays.map(x => x[2] + ':' + x[3]).join(' ') : '');
}

/* ── 3. 은총 여섯의 문장 ──────────────────────────────── */
console.log('');
{
  const missing = D.BOONS.filter(b => !P.SPRITES[`b_${b.id}`]);
  ok(missing.length === 0, '은총 여섯이 각자 제 문장을 갖는다 — 초월은 그림을 미리 못 갖는다',
     missing.length ? missing.map(b => b.id).join(' ') : `${D.BOONS.length}종`);
  /* 문장은 물건을 덮으면 안 된다. 물건 그림 위에 겹쳐 찍히므로,
     채운 칸이 많으면 그건 표시가 아니라 다른 물건이 된다. */
  const fat = D.BOONS.filter(b => {
    const g = P.SPRITES[`b_${b.id}`] || [];
    return g.flatMap(r => [...r]).filter(c => c !== '.').length > 20;
  });
  ok(fat.length === 0, '문장이 물건을 덮지 않는다 — 표시이지 물건이 아니다',
     fat.length ? fat.map(b => b.id).join(' ') : '전부 20칸 이하');
}

/* ── 4. 원본 격자에서의 닮음 (참고) ───────────────────── */
console.log('');
{
  const names = Object.keys(P.SPRITES).filter(k => /^[ru]_/.test(k));
  const mask = n => P.SPRITES[n].flatMap(r => [...r].map(c => c !== '.' ? 1 : 0));
  const M = {}; for (const n of names) M[n] = mask(n);
  const iou = (a, b) => { let i = 0, u = 0;
    for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; }
    return u ? i / u : 1; };
  const pairs = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++)
    pairs.push({ a: names[i], b: names[j], v: iou(M[names[i]], M[names[j]]) });
  pairs.sort((x, y) => y.v - x.v);
  const over = pairs.filter(p => p.v >= 0.70).length;
  console.log(`  원본 격자 기준 ${over}/${pairs.length} 쌍이 IoU 0.70 이상 · 최악 ${pairs[0].v.toFixed(3)}`);
  console.log(`    (${pairs.slice(0, 3).map(p => `${p.a}↔${p.b} ${p.v.toFixed(2)}`).join(' · ')})`);
  console.log('  ── 이 숫자는 판정하지 않는다. 플레이어가 보는 것은 원본 격자가');
  console.log('     아니라 외곽선이 붙어 그려진 그림이고, 그쪽은 실루엣 린트가');
  console.log('     잰다. 처음에 이 자로 9쌍이라고 보고했다가 그려진 그림으로');
  console.log('     재니 221쌍이었다 — 안 보이는 자로 「안 닮았다」를 말했다.');

  /* 다만 완전히 같은 격자는 여기서 잡는다 — 그건 어느 자로 재도 같다. */
  const same = pairs.filter(p => p.v === 1);
  ok(same.length === 0, '완전히 같은 격자를 쓰는 짝은 없다',
     same.length ? same.map(p => `${p.a}↔${p.b}`).join(' ') : '');
}

console.log(bad ? `\n아이콘 벤치: ${bad}건 실패\n` : `\n아이콘 벤치: ${FACES}종이 각자 제 얼굴이다\n`);
process.exit(bad ? 1 : 0);
