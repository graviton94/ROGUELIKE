/* ═══════════════════════════════════════════════════════════
   stage.mjs — 무대가 배우보다 밝으면 안 된다

   아트 감사가 두 번 같은 것을 쟀다: **30가지 조합 전부에서 벽이
   바닥보다 밝고**, 그중 `dark` 지형은 벽:바닥이 1.06:1 — 사실상
   같은 색이다. 그리고 6층과 13층을 나란히 놓고 어느 쪽이 깊은지
   고를 수 없었다(같은 지형끼리 재면 휘도비 1.02~1.08).

   벽이 바닥보다 밝은 것 자체는 옳다 — 빛은 위에서 오고 벽이 그것을
   받는다. 문제는 **얼마나**다:
     · 너무 가까우면(1.06) 벽과 바닥이 한 덩어리가 되어 방의 모양이
       안 읽힌다. 어두운 층에서 길을 못 찾는 것은 어둠 때문이 아니라
       이것 때문이다.
     · 그리고 배우는 그 위에 선다. 무대가 배우만큼 밝으면 몬스터가
       배경에 잠긴다 — 실루엣을 열세 종 다시 그린 것이 여기서
       무효가 된다.

   깊이도 같은 자로 잰다. 이 게임의 뼈대는 「아래로 갈수록 뜨거워
   진다」인데, 그 말이 화면에 없으면 열다섯 층이 한 층이다.

   ── 그런데 1.06:1은 이 자로는 재현되지 않았다 ──
   실측하니 가장 나쁜 조합이 `dark` 열0의 **1.85:1**이고, 깊이는
   여섯 지형 중 다섯에서 읽힌다. 감사가 틀렸다고 단정하지는 않는다 —
   저쪽은 화면에 그려진 타일(안개 알파가 곱해진 상태)을 쟀을 수
   있고, 그러면 같은 돌도 다른 숫자가 나온다. 다만 **구운 타일
   자체**로는 문제가 없다는 것이 이 파일의 답이고, 근거 없이
   지형을 다시 칠하지는 않는다. 연결성 때 이미 한 번 그럴 뻔했다.

   그래서 이 파일도 잠그는 벤치다. 지형을 손대는 사람이 이 셋 중
   하나를 무너뜨리면 여기서 걸린다.

   usage: node sim/stage.mjs      (포트 8199에 정적 서버 필요)
   ═══════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 420, height: 820 } });
await pg.goto('http://127.0.0.1:8199/index.html');
await pg.waitForTimeout(800);

const data = await pg.evaluate(async () => {
  const P = await import('/src/pixels.js');
  /* 상대 휘도 — sRGB 감마를 되돌려서 잰다. 눈이 보는 밝기는
     채널 평균이 아니다. */
  const lum = (r, g, bl) => {
    const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const meanLum = cv => {
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { s += lum(d[i], d[i + 1], d[i + 2]); n++; }
    return s / Math.max(1, n);
  };
  const themes = Object.keys(P.TERRAIN);
  const out = [];
  for (const t of themes) {
    for (let heat = 0; heat < P.REGION_HEAT.length; heat++) {
      P.setTerrainTheme(t, heat);
      /* 여섯 변종의 평균으로 잰다 — 한 장만 재면 그 한 장의 결이
         판정을 한다. */
      let w = 0, f = 0;
      for (let v = 1; v <= 6; v++) {
        w += meanLum(P.wallTile(v * 7, v * 3));
        f += meanLum(P.floorTile(v * 7, v * 3));
      }
      out.push({ t, heat, wall: w / 6, floor: f / 6 });
    }
  }
  return out;
});
await b.close();

console.log('\n무대 벤치 — 벽과 바닥과 깊이\n');
console.log('  지형      열0    열1    열2    열3    열4   (벽:바닥 비)');
const themes = [...new Set(data.map(d => d.t))];
for (const t of themes) {
  const row = data.filter(d => d.t === t).sort((a, b2) => a.heat - b2.heat);
  console.log(`  ${t.padEnd(9)}` + row.map(r =>
    (r.wall / Math.max(1e-6, r.floor)).toFixed(2).padStart(6)).join(' '));
}

const ratios = data.map(d => d.wall / Math.max(1e-6, d.floor));
const worst = Math.min(...ratios);
const worstAt = data[ratios.indexOf(worst)];
console.log('');
ok(worst >= 1.25,
   '가장 나쁜 조합에서도 벽이 바닥보다 확실히 밝다 — 1.2 아래면 벽과 바닥이 한 덩어리다',
   `${worstAt.t} 열${worstAt.heat} = ${worst.toFixed(2)}:1`);

/* 배우가 설 자리. 바닥이 밝아지면 그 위의 몬스터가 잠긴다 —
   실루엣을 아무리 그려도 배경과 명도가 같으면 안 읽힌다. */
const brightestFloor = Math.max(...data.map(d => d.floor));
const dimmestFloor = Math.min(...data.map(d => d.floor));
console.log(`\n      바닥 휘도 — 가장 어두운 ${dimmestFloor.toFixed(4)}`
  + ` · 가장 밝은 ${brightestFloor.toFixed(4)} (${(brightestFloor / dimmestFloor).toFixed(1)}배)`);
ok(brightestFloor < 0.12,
   '가장 밝은 바닥도 충분히 어둡다 — 무대가 밝아지면 그 위의 것이 배경에 잠긴다',
   brightestFloor.toFixed(4));

/* 깊이가 읽히는가. 같은 지형의 열0과 열4를 비교한다 — 지형을
   고정해야 「깊이가 하는 일」만 남는다. */
console.log('');
let readable = 0;
for (const t of themes) {
  const a = data.find(d => d.t === t && d.heat === 0);
  const z = data.find(d => d.t === t && d.heat === 4);
  const dw = Math.abs(z.wall - a.wall) / Math.max(1e-6, a.wall);
  if (dw > 0.25) readable++;
}
ok(readable >= themes.length - 1,
   '지형을 고정해도 가장 얕은 곳과 가장 깊은 곳의 벽이 다르다 — 깊이가 화면에 있어야 한다',
   `${readable}/${themes.length} 지형`);

console.log(bad ? `\n무대 벤치: ${bad}건 실패\n` : '\n무대 벤치: 무대가 배우 아래에 있다\n');
process.exit(bad ? 1 : 0);
