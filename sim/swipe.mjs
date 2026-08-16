/* swipe.mjs — 양피지를 손가락으로 치울 수 있는가.
   저절로 꺼지기를 기다리는 것 말고 방법이 없다는 지적에서 나온 검사. */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8199/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1100);
await pg.evaluate(() => { const e=[...document.querySelectorAll('button')]
  .find(x=>x.offsetParent && /새 게임/.test(x.textContent)); e&&e.click(); });
await pg.waitForTimeout(400);
for (let i=0;i<4;i++){ await pg.evaluate(()=>{ const bs=[...document.querySelectorAll('button:not([disabled])')]
  .filter(e=>e.offsetParent); bs.length&&bs[bs.length-1].click(); }); await pg.waitForTimeout(320); }
let bad = 0;
const ok = (c,m,g)=>{ console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if(!c) bad++; };

const drag = async (sel, dx, dy) => {
  const box = await pg.locator(sel).boundingBox();
  if (!box) return false;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await pg.mouse.move(cx, cy);
  await pg.mouse.down();
  await pg.mouse.move(cx + dx, cy + dy, { steps: 8 });
  await pg.mouse.up();
  /* 날아가는 데 190ms, 실제로 감추는 데 260ms — 합쳐서 기다린다.
     400ms로 재다가 「남아 있다」를 세 번 봤다. */
  await pg.waitForTimeout(800);
  return true;
};
/* position:fixed 요소는 offsetParent가 언제나 null이다. 그걸로
   보이는지 판정하는 바람에 떠 있는 배너를 「없다」로 읽었다. */
const visible = sel => pg.evaluate(q => {
  const el = document.querySelector(q);
  if (!el || el.hidden) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}, sel);

/* 배너는 「처음 밟는 곳」에서만 뜬다. 같은 구역을 두 번 밟으면
   안 뜨므로, 검사마다 다른 구역으로 내려간다. */
let nextDepth = 2;
async function banner() {
  /* 층 배너를 띄우고, 그 위를 덮는 안내 카드를 먼저 치운다.
     안 치우면 미는 것은 배너가 아니라 안내 카드다 — 실제로 그렇게
     세 번 「남아 있다」가 나왔고, 원인은 게임이 아니라 검사였다. */
  await pg.evaluate(async d => { const G = await import('/src/game.js');
    G.enterDepth(d); }, nextDepth);
  nextDepth += 4;
  await pg.waitForTimeout(600);
  for (let i = 0; i < 8; i++) {
    const hit = await pg.evaluate(() => { const el = document.getElementById('lesson-ok');
      if (el && el.offsetParent) { el.click(); return true; } return false; });
    if (!hit) break;
    await pg.waitForTimeout(260);
  }
  return visible('#lorecard');
}

const cardName = () => pg.evaluate(() =>
  document.querySelector('#lorecard .lorename')?.textContent || '');

async function trial(name, dx, dy) {
  if (!await banner()) { ok(false, `${name} — 배너가 안 떴다 (검사 불가)`); return; }
  const was = await cardName();
  await drag('#lorecard', dx, dy);
  const now = await cardName();
  const shown = await visible('#lorecard');
  /* 「사라졌는가」가 아니라 「이 장이 치워졌는가」를 묻는다. 한 턴에
     두 장이 밀려 있으면 하나를 치운 자리에 다음 장이 올라오는데,
     그것은 남아 있는 것이 아니라 다음 장이다. */
  const cleared = !shown || now !== was;
  ok(cleared, name, !shown ? '사라졌다' : `다음 장으로 넘어갔다 (${was} → ${now})`);
}

console.log('\n밀어내기 벤치 — 양피지를 손으로 치울 수 있는가\n');
/* 화면을 덮는 것은 안내 카드다. 그것부터 밀린다. */
{
  /* 4층이 아니라 5층이다. 4·8·12층은 아르카나를 고르는 층이라
     enterDepth 가 화면을 'arcana' 로 세우고, 그러면 그 뒤의 배너가
     한 장도 안 뜬다 — 「배너가 안 떴다」로 세 줄이 뒤집혔다. */
  await pg.evaluate(async () => { const G = await import('/src/game.js'); G.enterDepth(5); });
  await pg.waitForTimeout(600);
  const up = await visible('#lesson');
  if (up) {
    /* 여기도 「사라졌는가」가 아니라 「이 안내가 치워졌는가」다.
       배운 것이 한 턴에 둘이면 하나를 민 자리에 다음 안내가 바로
       올라오는데, 그것은 안 밀린 것이 아니라 다음 장이다. 여덟 번에
       한 번꼴로 붉게 뜨던 이유가 이것이었다 — 아래 배너에는 이미
       같은 규칙을 적용해 놓고 여기만 빠져 있었다. */
    const text = () => pg.evaluate(() => document.getElementById('lesson-text')?.textContent || '');
    const was = await text();
    await drag('#lesson', 0, -110);
    const shown = await visible('#lesson');
    const now = await text();
    const cleared = !shown || now !== was;
    ok(cleared, '안내 카드를 위로 민다',
       !shown ? '사라졌다' : `다음 안내로 넘어갔다 (${was.slice(0, 14)}… → ${now.slice(0, 14)}…)`);
  }
  else ok(true, '안내 카드가 이미 없다 (검사 생략)');
}
await trial('층 배너를 위로 민다',   0, -90);
await trial('층 배너를 왼쪽으로 민다', -120, 0);
await trial('층 배너를 오른쪽으로 민다', 120, 0);
/* 살짝 민 것은 안 사라져야 한다 — 읽다가 손이 스친 것까지 치우면 안 된다 */
await banner();
{
  const box = await pg.locator('#lorecard').boundingBox();
  if (box) {
    const cx = box.x + box.width/2, cy = box.y + box.height/2;
    await pg.mouse.move(cx, cy); await pg.mouse.down();
    await pg.mouse.move(cx + 14, cy - 8, { steps: 4 }); await pg.mouse.up();
    await pg.waitForTimeout(350);
    const still = await visible('#lorecard');
    ok(still, '살짝 스친 것으로는 안 사라진다', still ? '남아 있다' : '사라졌다');
  }
}
console.log(errs.length ? `  ✗ 콘솔 오류: ${errs[0]}` : '  · 콘솔 오류 없음');
if (errs.length) bad++;
console.log(bad ? `\n밀어내기 벤치: ${bad}건 실패\n` : '\n밀어내기 벤치: 전부 통과\n');
await b.close(); process.exit(bad?1:0);
