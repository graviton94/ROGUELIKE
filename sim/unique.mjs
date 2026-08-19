/* ═══════════════════════════════════════════════════════════
   unique.mjs — 이름 있는 것은 곡선 위에 있는가

   플레이어: 「유일무기가 성능 쓰레기인 거 같고..」

   맞았다. 재 보니 일곱 중 넷이 **같은 계열 같은 깊이의 평범한
   무기보다 약했고**, 그것도 깊을수록 더 나빠졌다:

     화로에서 꺼낸 것 0.88배 · 못 박는 자 0.90배
     두 번 우는 활 1.00배 · 마지막 등불은 별 박힌 홀보다
     주사위도 마나도 주문력도 낮았다

   0.5%로 떨어지는 물건이 주워서 갈아 끼울 이유가 없었다.

   ── 이 파일이 막는 것 ──────────────────────────────────
   ① 유일무기가 제 계열 곡선 아래로 다시 내려가는 것.
   ② **자가 규칙을 모른 채로 재는 것.** 두 번 우는 활은 한 번에
      두 발이 나가고(둘째는 절반), 지팡이의 피해는 막대기가 아니라
      주문에서 온다. 주사위만 보면 이 둘은 「약하다」로 읽히고,
      그 읽기를 믿고 고치면 멀쩡한 것을 부순다. 규칙을 여기 적어
      두는 이유다 — 규칙이 바뀌면 이 표도 같이 바뀌어야 한다.

   usage: node sim/unique.mjs
   ═══════════════════════════════════════════════════════════ */
import { UNIQUES, WEAPONS } from '../src/data.js';

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };
const avg = ([n, f]) => n * (f + 1) / 2;

/* 주사위 밖에서 오는 몫. 규칙이 바뀌면 여기도 바뀐다. */
const RULE = {
  /* 한 번 쏠 때 두 발, 둘째는 절반. */
  twicewept: { mult: 1.5, why: '두 발 (둘째 절반)' },
};
/* 지팡이는 막대기로 안 때린다. 마나와 주문력으로 잰다. */
const WAND = u => (u.manaFlat || 0) + (u.spellPow || 0) * 100;

/* 이름 있는 것이 제 계열에서 얼마나 위여야 하는가. 판에 한 자루
   나올까 말까인 물건이고, 나온 뒤로 여러 층을 같이 걸어야 한다. */
const WANT = 1.25;

console.log('\n유일무기 벤치 — 곡선 위에 있는가\n');
console.log('  이름                깊이  실효   같은 계열 최고        비율');

for (const u of UNIQUES) {
  const peers = WEAPONS.filter(w => w.t === u.t && w.d <= u.d);
  if (!peers.length) { ok(false, `${u.n} — 견줄 평범한 ${u.t}가 없다`); continue; }
  const best = peers.reduce((a, b) => avg(b.dice) > avg(a.dice) ? b : a);

  /* 지팡이는 다른 자로 잰다. 주사위로 재면 「마지막 등불이 1.00배」가
     나오는데, 그건 이 무기가 하는 일을 안 재는 것이다. */
  const wand = u.t === 'wand';
  const rule = RULE[u.id];
  const mine = wand ? WAND(u) : avg(u.dice) * (rule?.mult || 1);
  const theirs = wand ? WAND(best) : avg(best.dice);
  const r = mine / theirs;

  console.log(`  ${u.n.padEnd(20)}${String(u.d).padStart(3)} ${mine.toFixed(1).padStart(6)}   `
    + `${(best.n + ' ' + theirs.toFixed(1)).padEnd(22)}${r.toFixed(2)}배`
    + (wand ? '  (마나+주문력)' : rule ? `  (${rule.why})` : ''));
  if (r < WANT) { bad++; console.log(`      곡선 아래다 — ${WANT}배는 넘어야 주워서 갈아 끼운다`); }
}

/* 그리고 규칙이 성능을 대신하지 못한다는 것. 「대신 규칙이 좋잖아」는
   주워서 안 끼우는 물건을 **설명하는** 말이지 정당화하는 말이 아니다. */
console.log('');
ok(UNIQUES.every(u => u.rule && u.crackN),
   `${UNIQUES.length}자루 다 규칙과 크랙을 갖고 있다 — 성능 위에 얹히는 것이지 대신하는 것이 아니다`);
ok(UNIQUES.every(u => u.t === 'wand' || u.dice[0] >= 2),
   '주사위가 한 개인 유일무기는 없다 — 한 개면 굴림이 널뛰어서 「센 무기」로 안 읽힌다');

console.log(bad ? `\n유일무기 벤치: ${bad}건 곡선 아래\n`
                : `\n유일무기 벤치: ${UNIQUES.length}자루 다 곡선 위에 있다\n`);
process.exit(bad ? 1 : 0);
