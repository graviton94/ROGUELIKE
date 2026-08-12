/* sheet.mjs — 우리 스프라이트를 0x72와 같은 방식으로 잰다.

   앞서 한 번 틀렸다: 0x72의 수치는 **스프라이트 시트**를 센 것인데
   나는 그것을 **렌더된 게임 화면**과 비교했다. 어두운 무대가 대부분인
   화면과 스프라이트만 모인 시트는 비교 대상이 아니다. 그래서 이번엔
   우리 스프라이트만 한 장에 구워서, study.py가 시트에 쓴 것과 똑같은
   자를 댄다.

   비교 기준 (0x72 DungeonTileset II, CC0):
     외곽선 한 색이 전체의 35.5% · 외곽이 내부보다 85 어둡다
     한 칸이 쓰는 색 중앙값 5 · 저채도(S<20) 55% · V10–20 36% / V80–100 21%
*/
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 400, height: 400 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8199/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(900);

const r = await pg.evaluate(async () => {
  const P = await import('/src/pixels.js');
  const names = Object.keys(P.SPRITES);
  const CELL = P.CELL_SIZE;
  const cols = Math.ceil(Math.sqrt(names.length));
  const cv = document.createElement('canvas');
  cv.width = cols * CELL; cv.height = Math.ceil(names.length / cols) * CELL;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = false;
  P.bakeAll('human', 'warrior');
  const perTile = [];
  names.forEach((n, i) => {
    const img = P.sprite(n);
    if (!img) return;
    cx.drawImage(img, (i % cols) * CELL, ((i / cols) | 0) * CELL);
  });
  const d = cx.getImageData(0, 0, cv.width, cv.height).data;
  const at = (x, y) => { const k = (y * cv.width + x) * 4; return [d[k], d[k+1], d[k+2], d[k+3]]; };

  const cnt = {}; let opaque = 0;
  let edgeSum = 0, edgeN = 0, edgeDark = 0, inSum = 0, inN = 0;
  const vbin = new Array(10).fill(0), sbin = new Array(10).fill(0);
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const [R, G_, B, A] = at(x, y);
    if (A < 128) continue;
    opaque++;
    const key = `#${[R,G_,B].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
    cnt[key] = (cnt[key] || 0) + 1;
    const mx = Math.max(R, G_, B), mn = Math.min(R, G_, B);
    vbin[Math.min(9, (mx * 10 / 256) | 0)]++;
    sbin[Math.min(9, mx === 0 ? 0 : (((mx - mn) * 10 / mx) | 0))]++;
    let touch = false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cv.width || ny >= cv.height || at(nx, ny)[3] < 128) { touch = true; break; }
    }
    if (touch) { edgeSum += mx; edgeN++; if (mx < 64) edgeDark++; }
    else { inSum += mx; inN++; }
  }
  // 칸마다 몇 색을 쓰는가
  names.forEach((n, i) => {
    const ox = (i % cols) * CELL, oy = ((i / cols) | 0) * CELL;
    const s = new Set(); let filled = 0;
    for (let y = oy; y < oy + CELL; y++) for (let x = ox; x < ox + CELL; x++) {
      const [R, G_, B, A] = at(x, y);
      if (A < 128) continue;
      filled++; s.add(`${R},${G_},${B}`);
    }
    if (filled > 12) perTile.push(s.size);
  });
  perTile.sort((a, b) => a - b);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { names: names.length, opaque, colors: Object.keys(cnt).length, top,
           edgeMean: edgeSum / Math.max(1, edgeN), innerMean: inSum / Math.max(1, inN),
           edgeDarkPct: edgeDark * 100 / Math.max(1, edgeN),
           vbin, sbin, tiles: perTile.length,
           tMin: perTile[0], tMed: perTile[perTile.length >> 1], tMax: perTile[perTile.length - 1] };
});

const pct = (v, t) => (v * 100 / t);
console.log(`\n우리 스프라이트 시트 — ${r.names}장 · 불투명 ${r.opaque}px · 고유 색 ${r.colors}개`);
console.log('\n가장 많이 쓰인 색:');
for (const [c, n] of r.top) console.log(`  ${c}  ${pct(n, r.opaque).toFixed(2)}%`);
console.log(`\n외곽 평균 명도 ${r.edgeMean.toFixed(0)} / 내부 ${r.innerMean.toFixed(0)}  → 외곽이 ${(r.innerMean - r.edgeMean).toFixed(0)} 어둡다`);
console.log(`   외곽 픽셀 중 V<64 비율 ${r.edgeDarkPct.toFixed(0)}%`);
console.log(`\n한 칸이 쓰는 색: 최저 ${r.tMin} · 중앙값 ${r.tMed} · 최고 ${r.tMax}  (칸 ${r.tiles}개)`);
console.log('\n명도 분포:');
r.vbin.forEach((v, i) => console.log(`  V ${String(i*10).padStart(3)}–${i*10+10}  ${pct(v, r.opaque).toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(pct(v, r.opaque)/2))}`));
console.log('\n채도 분포:');
r.sbin.forEach((v, i) => console.log(`  S ${String(i*10).padStart(3)}–${i*10+10}  ${pct(v, r.opaque).toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(pct(v, r.opaque)/2))}`));

const lowSat = pct(r.sbin[0] + r.sbin[1], r.opaque);
const dark = pct(r.vbin[1] + r.vbin[0], r.opaque), bright = pct(r.vbin[8] + r.vbin[9], r.opaque);
console.log(`\n0x72 대비:`);
console.log(`  외곽이 내부보다 어두운 정도   우리 ${(r.innerMean - r.edgeMean).toFixed(0)}   /  0x72 85`);
console.log(`  외곽 중 V<64                우리 ${r.edgeDarkPct.toFixed(0)}%  /  0x72 94%`);
console.log(`  한 칸의 색 수 (중앙값)        우리 ${r.tMed}    /  0x72 5`);
console.log(`  저채도 S<20                 우리 ${lowSat.toFixed(0)}%  /  0x72 55%`);
console.log(`  어두운 끝 V<20              우리 ${dark.toFixed(0)}%  /  0x72 36%`);
console.log(`  밝은 끝 V>=80               우리 ${bright.toFixed(0)}%  /  0x72 21%`);
console.log(errs.length ? `\n콘솔 오류 ${errs.length}: ${errs[0]}` : '\n콘솔 오류 없음');
await b.close();
