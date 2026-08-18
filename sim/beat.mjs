/* ═══════════════════════════════════════════════════════════
   beat.mjs — 한 방이 무거워 보이는가

   플레이어: 「스킬이 너무 전부 즉시시전 아님? 죽을때 줌인되면서
   죽는것처럼, 강한 스킬이나 치명타는 슬로우 모션 이후 빨리감기 +
   이펙트 몰아서 표현이나, 컷신같은 효과나 줌인이나, 화면 흔들림이나,
   도트 그래픽 디자이너로서 좀 이런 스킬을 쓰는 손맛도 고려해야 합니다.」

   재 보니 장비는 이미 다 있었다 — 흔들림·히트스톱·섬광, 그리고
   배율·초점·암전을 다 가진 **진짜 카메라**(deathZoom). 다만 그 카메라가
   **죽을 때만** 열렸고, 배속은 아예 없었다. 멈췄다가 원속으로 돌아오면
   그건 「끊긴 것」이지 슬로우모션이 아니다.

   그래서 등급을 만들었다. 스킬마다 연출을 따로 짜면 스물넷이 각자
   다른 말을 하므로, 등급이 곧 스킬 등급이 되게 한다:

     한 대(hit)  치명타·기본 기예   정지만. 슬로우 없음
     특화(sig)   직업특화 기예      정지 + 0.50배 180ms
     궁극(ult)   궁극기            정지 + 0.30배 320ms + 렌즈 줌인

   이 파일이 지키는 것 셋:
   ① 늘어짐이 **실제로** 화면 시간을 늘리는가 (배속이 도는가)
   ② 궁극기의 렌즈가 들어갔다 **나오는가** — 안 나오면 고장이다
   ③ 치명타에는 슬로우가 **없는가** — 자주 터지므로, 매번 늘어지면
      세 번째 판부터는 연출이 아니라 지연이다

   usage: node sim/beat.mjs      (포트 8199에 정적 서버 필요)
   ═══════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';

let bad = 0;
const ok = (c, m, g) => { console.log(`  ${c ? '·' : '✗'} ${m}${g !== undefined ? ` — ${g}` : ''}`); if (!c) bad++; };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://127.0.0.1:8199/index.html');
await pg.waitForTimeout(900);

console.log('\n손맛 벤치 — 한 방이 무거워 보이는가\n');

const r = await pg.evaluate(async () => {
  const J = await import('/src/juice.js');
  /* 모든 마디가 끝날 때까지 돌린다. 등급끼리 상태가 새면 뒤에 재는
     것이 앞엣것의 꼬리를 재게 된다 — 실제로 그래서 궁극기 렌즈가
     「안 닫힘」으로 찍혔다. */
  const drain = () => { for (let i = 0; i < 300; i++) J.update(16.7, []); };

  /* 배속을 **직접** 읽는다. 처음에 흔들림이 잦아드는 프레임 수로 쟀는데
     shakeVec 은 난수 지터라 순간 크기가 널뛰고, 그래서 궁극기가 2프레임,
     특화가 한 대보다 1프레임 긴 것으로 찍혔다. 둘 다 배속이 아니라
     노이즈를 잰 값이었다. */
  const phase = grade => {
    drain();
    J.beat(grade, { x: 5, y: 5 });
    const t0 = J.timeState();
    /* 정지가 끝날 때까지 — 그 뒤에 늘어짐이 온다. */
    let n = 0;
    while (J.timeState().freeze > 0 && n < 200) { J.update(16.7, []); n++; }
    const inSlow = J.timeState();
    /* 늘어짐이 끝나면 빨리감기가 켜져야 한다. */
    let m = 0;
    while (J.timeState().slowLeft > 0 && m < 200) { J.update(16.7, []); m++; }
    const afterSlow = J.timeState();
    return { freeze: t0.freeze, slowMs: inSlow.slowLeft, rate: inSlow.slowRate,
             snap: afterSlow.snapLeft, slowFrames: m };
  };

  const track = grade => {
    drain();
    J.beat(grade, { x: 5, y: 5 });
    const k = [];
    for (let i = 0; i < 80; i++) { J.update(16.7, []); const L = J.lens(); k.push(L ? L.k : 1); }
    return { k, closed: J.lens() === null };
  };

  const hit = phase('hit'), sig = phase('sig'), ult = phase('ult');
  const tUlt = track('ult'), tSig = track('sig'), tHit = track('hit');
  return {
    hasBeat: typeof J.beat === 'function' && typeof J.lens === 'function'
             && typeof J.timeState === 'function',
    hit, sig, ult,
    peak: Math.max(...tUlt.k), tail: tUlt.k[tUlt.k.length - 1], closedAfter: tUlt.closed,
    sigZoom: Math.max(...tSig.k), hitZoom: Math.max(...tHit.k),
    junk: (() => { try { J.beat('아직없는등급', { x: 1, y: 1 }); J.beat('ult', null);
                         J.beat('ult', { x: NaN, y: 2 }); J.update(16.7, []);
                         /* 기예 프레임도 같이 던져 본다. 주문 쪽은
                            spellfx.mjs 가 예순여섯 갈래를 보는데 기예 쪽은
                            아무도 안 봤다 — 새 기예의 그림에서 색 이름
                            하나만 틀려도 판 중에 화면이 멈추고, 규칙 벤치는
                            그것을 영영 못 본다. 새 프레임을 하나 만들면
                            여기 이름을 한 줄 더한다. */
                         for (const t of ['crusadeCross', 'ward', 'wardBreak', 'judgest',
                                          'stigma', 'stigmaBurst', 'martyr', 'penance',
                                          'repay', '아직없는프레임'])
                           for (const e of [{ t, x: 3, y: 3, tx: 6, ty: 4, r: 4, n: 2, turns: 5 },
                                            { t, x: 3, y: 3 },
                                            { t, x: NaN, y: 3, r: 0, n: 0 }])
                             J.pump([e], { x: 3, y: 3, hp: 5, maxhp: 10 });
                         J.update(16.7, []); return null; }
                   catch (e) { return e.message; } })(),
  };
});

ok(r.hasBeat, '등급 문(beat)과 렌즈(lens)가 열려 있다');

console.log('');
ok(r.hit.freeze < r.sig.freeze && r.sig.freeze < r.ult.freeze,
   '① 정지가 등급을 따라 길어진다',
   `한 대 ${r.hit.freeze} → 특화 ${r.sig.freeze} → 궁극 ${r.ult.freeze}ms`);
ok(r.hit.slowMs === 0 && r.sig.slowMs > 0 && r.ult.slowMs > r.sig.slowMs,
   '   그리고 늘어짐도 — 한 대에는 아예 없다',
   `한 대 ${r.hit.slowMs} → 특화 ${r.sig.slowMs} → 궁극 ${r.ult.slowMs}ms`);
ok(r.sig.rate < 1 && r.ult.rate < r.sig.rate,
   '   궁극기가 더 느리게 늘어진다', `특화 ${r.sig.rate}배 · 궁극 ${r.ult.rate}배`);
ok(r.sig.snap > 0 && r.ult.snap > 0,
   '   늘어짐이 끝나면 **빨리감기**가 켜진다 — 밀린 이펙트가 여기서 몰린다',
   `특화 ${r.sig.snap}ms · 궁극 ${r.ult.snap}ms`);

console.log('');
ok(r.peak > 1.2 && r.peak < 1.35, '② 궁극기 렌즈가 들어간다', `최대 ${r.peak.toFixed(2)}배`);
ok(Math.abs(r.tail - 1) < 0.001 && r.closedAfter,
   '   그리고 **나온다** — 안 나오면 연출이 아니라 고장이다',
   `끝값 ${r.tail.toFixed(3)} · 닫힘 ${r.closedAfter}`);

console.log('');
ok(r.hitZoom === 1, '③ 치명타는 카메라를 안 움직인다 — 자주 터진다', `${r.hitZoom}배`);
ok(r.sigZoom === 1, '   특화도 안 움직인다 — 줌은 궁극기만의 것이다', `${r.sigZoom}배`);
ok(r.hit.slowMs === 0 && r.hit.snap === 0,
   '   그리고 치명타에는 늘어짐도 빨리감기도 없다 — 매번 늘어지면 지연이다',
   `늘어짐 ${r.hit.slowMs}ms · 빨리감기 ${r.hit.snap}ms`);

console.log('');
ok(!r.junk, '없는 등급·좌표 없음을 줘도 안 던진다', r.junk || '전부 통과');
await pg.waitForTimeout(500);
ok(errs.length === 0, '콘솔 오류 없음', errs[0] || '');
await b.close();

console.log(bad ? `\n손맛 벤치: ${bad}건 실패\n` : '\n손맛 벤치: 늘어졌다가 당겨진다\n');
process.exit(bad ? 1 : 0);
