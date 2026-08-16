/* ═══════════════════════════════════════════════════════════
   contrast.mjs — 화면에 있는데 안 보이는 글자

   3회차 아트 감사가 이 커밋에서 가장 비싼 것을 잡았다: 유물 크랙의
   조건문이 `var(--d)`로 칠해져 있었고, `--d`는 **패널의 배경색 그
   자체**다(#16131a). 대비 1.04:1. 이번 웨이브의 주력 기능에서
   「무엇을 향해 가는가」를 말하는 유일한 줄이, 그것이 나오는 네 화면
   중 셋에서 한 글자도 안 보였다.

   그리고 반대편도 있었다. 같은 컴포넌트가 양피지 카드 위에도 올라가는데
   그쪽은 밝은 바닥이라, 어두운 배경 전제로 고른 색이 거기서 무너졌다.
   **한 컴포넌트가 두 배경을 쓰면 한쪽은 반드시 틀린다.**

   이 종류는 눈으로 보면 놓치고 계산하면 절대 안 놓친다. 그래서 잰다:
   화면에 실제로 그려진 글자 노드마다 계산된 글자색과 **뒤에 실제로
   깔린 색**(투명을 뚫고 조상까지 올라가 합성)을 떠서 WCAG 대비를
   계산한다.

   문턱은 4.5:1(본문)이 아니라 3.0:1로 잡았다 — 이 게임은 의도적으로
   어둡고, 흐린 보조 문장이 실제로 흐려야 하는 곳이 있다. 3.0 아래는
   흐린 것이 아니라 **없는 것**이다.

   usage: node sim/contrast.mjs      (포트 8199에 정적 서버 필요)
   ═══════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';

/* ── 기준선 ────────────────────────────────────────────────
   0이 되어야 할 숫자다. 지금은 3이고, 그 셋은 이 커밋이 만든 것이
   아니라 **원래 있던 것**이다:

     offer      「발밑에 아무것도 없다」 — 아무것도 없을 때의 자리 표시
     btn-door   「문닫기」   — 닫을 문이 없을 때의 죽은 버튼
     btn-shoot  「쏘기」     — 쏠 것이 없을 때의 죽은 버튼

   셋 다 「지금은 못 하는 것」을 흐리게 칠한 것이라, 의도가 아예 없는
   것은 아니다. 다만 잠긴 계단에서 배운 것이 여기에도 적용된다 —
   못 하는 것은 **왜 못 하는지 읽혀야** 하고, 안 보이는 글자는 흐린
   것이 아니라 없는 것이다. 이 셋이 다음 재작업 순서다.

   이 숫자를 올려 적는 사람은 **왜** 올리는지 같이 적을 것. 이 파일이
   생긴 이유가 크랙 조건문이 대비 1.04:1로 조용히 들어갔기 때문이다. */
const BASE = { bad: 3 };

let failed = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) failed++; };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 420, height: 820 } });
await pg.goto('http://127.0.0.1:8199/index.html');
await pg.waitForTimeout(900);

/* 화면을 하나씩 세우고 잰다. 크랙 줄은 네 곳에 나오므로 넷을 다 연다 —
   한 곳만 재면 이번에 놓친 것과 똑같이 놓친다. */
const { bad: found, unknown } = await pg.evaluate(async () => {
  const Game = await import('/src/game.js');
  const UI = await import('/src/ui.js');
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend(); Game.enterDepth(9);
  const p = Game.G.player;
  p.mats = { scrap: 80, dust: 40, essence: 12 }; p.gold = 5000;
  p.equip.weapon = { kind:'weapon', t:'sword', spr:'sword', n:'검', cost:150,
    dice:[2,6], plus:5, pre:'sharp', engrave:['pierce'] };
  /* 깨진 것 하나와 세는 중인 것 여럿 — 두 상태가 다 화면에 있어야 한다. */
  p.relics = ['scale', 'mirror', 'bone', 'grudge'];
  Game.G.cracks = { scale: 1 };
  Game.G.ledger = { hit: 40, kill: 30 };
  Game.recalc(p);
  UI.refresh();

  const lum = (r, g, bl) => {
    const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const parse = c => (c.match(/[\d.]+/g) || []).map(Number);
  /* 뒤에 실제로 깔린 색. 투명한 배경을 뚫고 조상까지 올라가며
     합성한다 — 「배경색이 뭐냐」를 한 겹만 보면 rgba(255,255,255,.02)
     같은 워시에서 답이 완전히 틀린다. */
  const behind = node => {
    let el = node, acc = null;
    while (el && el !== document.documentElement) {
      const st0 = getComputedStyle(el);
      /* 배경이 **그림**이면 계산된 색으로는 알 수 없다. 양피지 카드가
         그렇다: `.askbox > .sheet` 의 배경은 반복되는 픽셀 그림이고
         backgroundColor 는 transparent 라, 이 걷기는 그 뒤의 어두운
         모달까지 내려가 「1.69:1」이라고 답한다 — 눈에는 갈색 잉크가
         밝은 종이 위에 잘 보이는데.

         자가 모르는 것을 아는 척하면 그때부터 목록이 거짓말이 된다.
         모르면 모른다고 하고 따로 센다. */
      if (st0.backgroundImage && st0.backgroundImage !== 'none') return null;
      const bg = parse(st0.backgroundColor);
      if (bg.length >= 3) {
        const a = bg.length > 3 ? bg[3] : 1;
        if (a > 0) {
          acc = acc ? acc : [0, 0, 0, 0];
          /* 위에서부터 쌓으므로 아래 색이 나중에 온다: dst = src over dst */
          const rem = 1 - acc[3];
          acc = [acc[0] + bg[0] * a * rem, acc[1] + bg[1] * a * rem,
                 acc[2] + bg[2] * a * rem, acc[3] + a * rem];
          if (acc[3] >= 0.99) break;
        }
      }
      el = el.parentElement;
    }
    return acc ? [acc[0], acc[1], acc[2]] : [0, 0, 0];
  };
  const ratio = node => {
    const fg = parse(getComputedStyle(node).color);
    const op = Number(getComputedStyle(node).opacity || 1);
    const bg = behind(node);
    if (!bg) return null;               // 그림 배경 — 이 자로는 못 잰다
    /* 글자 자체의 opacity 도 합성한다 — .cracktext.dim 이 딱 그렇다. */
    const f = [0, 1, 2].map(i => fg[i] * op + bg[i] * (1 - op));
    const l1 = lum(...f), l2 = lum(...bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const bad = [], unknown = new Set();
  const sweep = where => {
    for (const n of document.querySelectorAll('body *')) {
      if (!n.offsetParent && n.tagName !== 'BODY') continue;      // 안 그려진 것
      const txt = [...n.childNodes].filter(c => c.nodeType === 3)
        .map(c => c.textContent.trim()).join('').trim();
      if (!txt) continue;
      const st = getComputedStyle(n);
      if (st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
      const r = ratio(n);
      if (r === null) { unknown.add(String(n.className || n.id || n.tagName)); continue; }
      if (r < 3.0) bad.push({ where, cls: n.className || n.id || n.tagName,
        txt: txt.slice(0, 22), r: +r.toFixed(2) });
    }
  };

  UI.setScreen('play');
  document.getElementById('hud-relics')?.click();
  sweep('유물 목록(양피지)');
  document.getElementById('look').hidden = true;

  UI.setScreen('inventory');
  for (const t of document.querySelectorAll('#inv-tabs button')) { t.click(); sweep('배낭'); }

  UI.setScreen('anvil');
  for (const m of ['upgrade', 'enchant', 'reroll', 'refine', 'attune', 'fuse']) {
    document.querySelector(`#anvil-mode [data-mode="${m}"]`)?.click();
    sweep(`모루 · ${m}`);
  }
  return { bad, unknown: [...unknown] };
});
await b.close();

console.log('\n대비 벤치 — 화면에 있는데 안 보이는 글자\n');
/* 같은 클래스가 여러 화면에서 걸리면 한 줄로 묶는다 — 고치는 곳은
   한 곳이고, 목록이 길면 순서가 안 보인다. */
const byCls = new Map();
for (const x of found) {
  const k = `${x.cls}`;
  const cur = byCls.get(k);
  if (!cur || x.r < cur.r) byCls.set(k, x);
}
const rows = [...byCls.values()].sort((a, c) => a.r - c.r);
for (const x of rows)
  console.log(`   ✘ ${String(x.r).padStart(5)}:1  ${x.cls.padEnd(28)} 「${x.txt}」  ${x.where}`);
if (!rows.length) console.log('   (없음)');

console.log(`\n   (그림 배경이라 이 자로 못 잰 것 ${unknown.length}종 — 양피지 카드가 그렇다.`
  + ` 그쪽은 눈으로 본다.)`);
console.log('');
ok(rows.length <= BASE.bad,
   '3:1 아래로 칠해진 글자가 없다 — 그 아래는 흐린 것이 아니라 없는 것이다',
   `${rows.length}종 (기준선 ${BASE.bad})`);

console.log(failed ? `\n대비 벤치: ${failed}건 실패\n` : '\n대비 벤치: 화면의 글자가 전부 보인다\n');
process.exit(failed ? 1 : 0);
