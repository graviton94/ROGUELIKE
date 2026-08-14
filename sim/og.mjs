/* og.mjs — 링크를 붙여 넣었을 때 뜨는 미리보기 그림을 굽는다.

   손으로 그리지 않는다. 이 카드는 게임의 진짜 스프라이트와 진짜
   팔레트로, 게임의 진짜 폰트를 써서 그린다 — 그래야 도트를 다시
   손보거나 팔레트를 또 한 번 갈아엎었을 때 미리보기만 옛 모습으로
   남는 일이 없다. 다시 구우면 그만이다:

     node sim/og.mjs            (og.png를 저장소 뿌리에 굽는다)

   1200×630은 오픈그래프의 권장 크기다. 트위터·디스코드·슬랙·
   카카오가 전부 이 비율로 자른다. 다만 잘리는 폭이 서비스마다
   달라서, 글자는 가운데 안쪽에만 둔다.                          */
import { chromium } from 'playwright';

const W = 1200, H = 630;
const OUT = process.argv[2] || 'og.png';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
pg.on('pageerror', e => console.log('  ✗ ' + e.message));

/* index.html을 거쳐 간다 — 폰트(@font-face)와 모듈을 그 페이지가
   이미 올바르게 불러오므로, 여기서 다시 선언하면 두 곳이 어긋난다. */
await pg.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1200);
await pg.evaluate(() => document.fonts.ready);

await pg.evaluate(async ({ W, H }) => {
  const P = await import('/src/pixels.js');
  const { sprite, wallTile, floorTile, PALETTE } = P;

  /* 페이지의 나머지를 전부 걷어내고 카드 하나만 남긴다. */
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;overflow:hidden;background:#000';
  const cv = document.createElement('canvas');
  cv.id = 'og'; cv.width = W; cv.height = H;
  cv.style.cssText = `width:${W}px;height:${H}px;display:block`;
  document.body.appendChild(cv);
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;

  const T = 45;                                   // 카드에서의 타일 한 칸

  /* ── 바닥과 벽 ──────────────────────────────────────────
     게임의 지형 타일을 그대로 깐다. 아래쪽 네 줄은 벽, 그 위는
     바닥 — 던전의 한 단면을 옆에서 보는 구도다. */
  c.fillStyle = PALETTE.k;
  c.fillRect(0, 0, W, H);
  const rows = Math.ceil(H / T), cols = Math.ceil(W / T);
  /* 벽 두 줄, 그 아래 바닥. 벽이 한 줄이면 「선」으로 보이고 던전이
     아니라 지평선이 된다 — 벽돌 결이 두 줄은 보여야 방으로 읽힌다. */
  const wallTop = rows - 6, floorTop = wallTop + 2;
  for (let y = wallTop; y < rows; y++)
    for (let x = 0; x < cols; x++)
      c.drawImage(y < floorTop ? wallTile(x, y) : floorTile(x, y), x * T, y * T, T, T);

  /* 위쪽은 어둠. 횃불이 닿지 않는 곳이 이 게임의 절반이다. */
  const dark = c.createLinearGradient(0, 0, 0, H);
  dark.addColorStop(0, PALETTE.k);
  dark.addColorStop(0.55, PALETTE.k);
  dark.addColorStop(0.70, 'rgba(14,11,16,0.62)');
  dark.addColorStop(0.86, 'rgba(14,11,16,0.05)');
  dark.addColorStop(1, 'rgba(14,11,16,0.45)');   // 아래 끝은 다시 어둡게 — 글 자리
  c.fillStyle = dark;
  c.fillRect(0, 0, W, H);

  /* ── 불빛 ───────────────────────────────────────────────
     주인공 자리에서 퍼지는 둥근 빛. 이 게임에서 빛은 자원이므로,
     카드에서도 빛이 닿는 곳과 안 닿는 곳이 갈려야 한다. */
  const hx = W * 0.5, hy = (floorTop + 1.9) * T;
  const glow = c.createRadialGradient(hx, hy, 10, hx, hy, 380);
  glow.addColorStop(0, 'rgba(212,116,31,0.42)');
  glow.addColorStop(0.5, 'rgba(212,116,31,0.16)');
  glow.addColorStop(1, 'rgba(212,116,31,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);

  /* ── 사는 것들 ──────────────────────────────────────────
     주인공을 가운데, 빛의 가장자리에 놈들을 세운다. 멀수록 어둡게
     — 게임에서 안 보이는 것이 글로만 오는 그 거리감이다. */
  const S = 96;
  const cast = [
    { n:'ashhound', x:0.14, s:0.45 }, { n:'wraith',  x:0.26, s:0.62 },
    { n:'orc',      x:0.74, s:0.72 }, { n:'ogre',    x:0.86, s:0.52 },
    { n:'dragon',   x:0.95, s:0.38 },
  ];
  for (const m of cast) {
    c.globalAlpha = m.s;
    c.drawImage(sprite(m.n), W * m.x - S / 2, hy - S * 0.86, S, S);
  }
  c.globalAlpha = 1;
  /* 주인공은 지도 위의 말('hero')로 그린다. 직업 그림(warrior 등)은
     직업 고르는 화면에서 실루엣으로 쓰라고 구멍이 뚫린 것이라,
     크게 키우면 사람이 아니라 회색 덩어리가 된다. hero는 머리·눈·
     몸이 다 있어서 120px에서도 사람으로 읽힌다. */
  c.drawImage(sprite('hero'), hx - S * 0.62, hy - S * 1.0, S * 1.24, S * 1.24);
  /* 그리고 그 옆의 횃불 — 이 게임의 시계다. */
  c.drawImage(sprite('torch'), hx - S * 1.45, hy - S * 0.8, S * 0.9, S * 0.9);

  /* ── 글 ────────────────────────────────────────────────
     게임과 같은 폰트. 카드 폭의 안쪽 절반에만 둔다 — 서비스마다
     잘라 내는 폭이 다르다. */
  const line = (t, y, size, color, weight = 'normal', track = 0) => {
    c.font = `${weight} ${size}px Galmuri11, ui-monospace, monospace`;
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillStyle = color;
    if (!track) { c.fillText(t, W / 2, y); return; }
    const chars = [...t];
    const wid = chars.reduce((s, ch) => s + c.measureText(ch).width + track, -track);
    let x = W / 2 - wid / 2;
    c.textAlign = 'left';
    for (const ch of chars) { c.fillText(ch, x, y); x += c.measureText(ch).width + track; }
  };

  // 제목 뒤에 한 겹 그림자 — 도트 위에 얹는 글은 이게 없으면 묻힌다
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 24;
  line('깊은 곳', 214, 122, PALETTE.w, 'bold');
  c.restore();
  line('D E E P D E L V E', 270, 31, PALETTE.o, 'normal', 6);

  c.save();
  c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 14;
  line('아래에 있는 것이 세상을 먹고 있다. 아무도 돌아오지 못했다.', 328, 25, PALETTE.G);
  c.restore();

  /* 아래 한 줄은 「무엇인가」를 정확히 말한다. 미리보기를 보는
     사람은 이 한 줄로 열지 말지를 정한다. */
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 18;
  line('15층 · 여섯 직업 · 올라가는 길은 없다', H - 36, 26, PALETTE.y);
  c.restore();

  /* ── 테두리 ────────────────────────────────────────────
     흰 배경의 타임라인에서 카드가 배경에 녹지 않게 하는 한 줄. */
  c.strokeStyle = PALETTE.g;
  c.lineWidth = 6;
  c.strokeRect(3, 3, W - 6, H - 6);
}, { W, H });

await pg.waitForTimeout(300);
const el = await pg.$('#og');
await el.screenshot({ path: OUT });
await b.close();
console.log(`\n미리보기 그림을 구웠다 — ${OUT} (${W}×${H})\n`);
