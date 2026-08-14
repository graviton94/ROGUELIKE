/* prose.mjs — 화면에 나가는 글에 구멍이 있는가.

   「undefined이(가) 삐걱인다」는 표 하나에 열쇠가 빠져서 나온 문장
   이었다. 이런 것은 눈으로 못 찾는다 — 좌판을 세 번 쳐야 나오고,
   그 좌판은 마을에만 있고, 대개는 아무도 좌판을 치지 않는다.

   그래서 두 가지로 잡는다:

     · 정적 — 이름표(표)에 열쇠가 빠진 것이 있는가. 항목이 늘 때
       같이 안 늘어난 표가 범인이므로, 표가 아니라 「표를 쓰는
       쪽의 값 전부」에서 거꾸로 확인한다.
     · 동적 — 봇을 태우고 로그를 전부 훑어 undefined·NaN·null·
       [object Object]가 섞였는지 본다. 한 판이 천 줄이므로
       사람이 읽어서는 절대 못 찾는 것들이다.

   usage: node sim/prose.mjs [판수=4]              */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const W = await import('../src/world.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`  ${cond ? '·' : '✗'} ${msg}${got !== undefined ? ` — ${got}` : ''}`);
  if (!cond) bad++;
};

console.log('\n문장 벤치 — 화면에 나가는 글에 구멍이 있는가\n');

/* ── 1. 이름표에 빠진 열쇠 ─────────────────────────────── */
{
  /* 가구. 생성기가 실제로 세우는 종류를 전부 모아서, 그중 이름이
     없는 것을 찾는다. 표를 읽어서는 못 찾는다 — 없는 열쇠는 표에
     없으니까. */
  const kinds = new Set();
  for (let i = 0; i < 60; i++) {
    for (const depth of [0, 3, 7, 12]) {
      const L = new W.Level(depth, {});
      for (const o of L.props.values()) kinds.add(o.kind);
    }
  }
  const unnamed = [...kinds].filter(k => !Game.PROP_NAME[k]);
  ok(unnamed.length === 0, '세워지는 가구에 전부 이름이 있다',
     unnamed.length ? `이름 없음: ${unnamed.join(', ')}` : `${kinds.size}종`);

  /* 그리고 그 이름들이 실제로 그림을 가지고 있는가. sprite()는
     못 찾으면 조용히 '돌무더기'를 내보내므로, 빠진 그림은 오류가
     아니라 「자갈밭으로 보이는 마을」로 나타난다. */
  const P = await import('../src/pixels.js');
  const noArt = [...kinds].filter(k => !P.SPRITES[k]);
  ok(noArt.length === 0, '세워지는 가구에 전부 그림이 있다',
     noArt.length ? `그림 없음: ${noArt.join(', ')}` : `${kinds.size}종`);
}

/* ── 2. 표를 쓰는 모든 값 ──────────────────────────────── */
{
  const miss = [];
  for (const m of D.MONSTERS) if (!m.n) miss.push(`몬스터 ${m.spr}`);
  /* 유물은 규칙(t)과 전승(lore)을 둘 다 가진다. 카드가 둘을 같이
     띄우므로 하나가 비면 카드가 반만 찬 채로 나간다. 새 유물이
     전승 없이 들어오는 것을 여기서 막는다. */
  for (const r of D.RELICS)   if (!r.n || !r.t || !r.lore) miss.push(`유물 ${r.id}`);
  for (const s of D.SHOPS)    if (!s.t) miss.push(`수레 문구 ${s.id}`);
  for (const r of D.REGIONS)  if (!r.stake) miss.push(`구역 ${r.n}의 「밖」`);
  for (const c of D.CONSUMABLES) if (!c.n || !c.desc) miss.push(`소모품 ${c.id}`);
  for (const s of D.SHOPS)    if (!s.n) miss.push(`수레 ${s.id}`);
  ok(miss.length === 0, '데이터의 이름·설명에 빈 곳이 없다', miss.join(', ') || '전부 있음');
}

/* ── 3. 실제로 나간 문장을 전부 훑는다 ─────────────────── */
{
  const N = Number(process.argv[2] || 4);
  const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];
  const HOLES = /undefined|NaN|\[object |\bnull\b/;
  const found = new Map();
  let lines = 0;
  for (const cls of CLASSES) {
    for (let i = 0; i < N; i++) {
      /* 로그는 판마다 비워지므로 매 턴 걷어 담는다. 마지막에 한 번
         읽으면 판의 끝 몇 줄만 보게 된다 — 후퇴 벤치에서 이걸로
         한 번 놓쳤다. */
      const seen = new Set();
      const onTurn = g => {
        for (const line of (g.log || [])) {
          const t = typeof line === 'string' ? line : (line?.text || '');
          if (!t || seen.has(t)) continue;
          seen.add(t); lines++;
          if (HOLES.test(t)) found.set(t, (found.get(t) || 0) + 1);
        }
      };
      runBot('human', cls, i % 2 === 0, { onTurn });
    }
  }
  ok(found.size === 0, `봇이 본 문장에 구멍이 없다 (${lines}줄)`,
     found.size ? `${found.size}종` : '깨끗함');
  for (const [t, n] of [...found].slice(0, 12)) console.log(`      ${n}회 「${t}」`);
}

/* ── 4. 손으로 밀어 넣기 어려운 자리 ───────────────────── */
{
  /* 좌판을 치는 문장은 봇이 절대 안 만든다 — 마을에서 가구를 치는
     봇은 없다. 그래서 표에 있는 가구를 하나씩 세워 놓고 직접 친다. */
  Meta.forget();
  Game.startGame('human', 'warrior', Game.rollStats('warrior'));
  Game.descend();
  Game.enterDepth(3);
  const p = G.player, L = G.level;
  const holes = [];
  for (const kind of Object.keys(Game.PROP_NAME)) {
    const x = p.x + 1, y = p.y, i = W.idx(x, y);
    L.tiles[i] = W.PROP;
    L.props.set(i, { kind, hp: 1 });
    G.log.length = 0;
    Game.step(1, 0);
    for (const line of G.log) {
      const t = typeof line === 'string' ? line : (line?.text || '');
      if (/undefined|NaN|\[object /.test(t)) holes.push(`${kind}: ${t}`);
    }
    L.tiles[i] = W.FLOOR; L.props.delete(i);
    p.x = p.x; // 제자리
  }
  ok(holes.length === 0, '가구를 치는 문장에 구멍이 없다', holes.join(' · ') || '전부 깨끗함');
}

/* ── 5. 봇이 절대 안 가는 곳 ───────────────────────────── */
{
  /* 봇은 사건의 선택지를 골고루 누르지 않고, 나쁜 물약을 일부러
     마시지 않으며, 제단에서 판돈을 다 걸어 보지도 않는다. 그런데
     구멍은 바로 그런 데 있다 — 아무도 안 지나가는 가지가 곧
     아무도 안 읽어 본 문장이다. 그래서 손으로 전부 눌러 본다. */
  const EV = await import('../src/events.js');
  const holes = [];
  const scan = (where) => {
    for (const line of G.log) {
      const t = typeof line === 'string' ? line : (line?.text || '');
      if (/undefined|NaN|\[object |\bnull\b/.test(t)) holes.push(`${where}: ${t}`);
    }
    G.log.length = 0;
  };
  const stage = () => {
    Meta.forget();
    Game.startGame('human', 'warrior', Game.rollStats('warrior'));
    Game.descend();
    Game.enterDepth(6);
    const p = G.player;
    p.gold = 9999; p.keys = 9; p.mats = { scrap:99, dust:99, essence:99 };
    return p;
  };

  let ranEv = 0;
  for (const e of EV.EVENTS) {
    for (let k = 0; k < e.opts.length; k++) {
      stage();
      G.level.eventId = e.id;
      G.screen = 'event';
      try { Game.eventChoose(k); ranEv++; } catch (err) { holes.push(`사건 ${e.id}[${k}] 던짐: ${err.message}`); }
      scan(`사건 ${e.id}[${k}]`);
    }
  }
  ok(holes.length === 0, `사건의 모든 선택지를 눌러 봤다 (${ranEv}가지)`,
     holes.slice(0, 4).join(' · ') || '전부 깨끗함');

  const before = holes.length;
  let ranUse = 0;
  for (const c of D.CONSUMABLES) {
    const p = stage();
    p.pack.length = 0;
    Game.addItem(p, Game.makeConsumable(c.id), 2);
    try { Game.useItem(0); ranUse++; } catch (err) { holes.push(`소모품 ${c.id} 던짐: ${err.message}`); }
    scan(`소모품 ${c.id}`);
  }
  ok(holes.length === before, `모든 소모품을 써 봤다 (${ranUse}종)`,
     holes.slice(before, before + 4).join(' · ') || '전부 깨끗함');

  const before2 = holes.length;
  let ranAltar = 0;
  for (const o of D.ALTAR_OFFERS) {
    for (let t = 0; t < 12; t++) {          // 성공·실패 양쪽을 다 보려면 여러 번
      const p = stage();
      Game.altarOffer(o.id);
      try { Game.altarSettle(); ranAltar++; } catch (err) { holes.push(`제단 ${o.id} 던짐: ${err.message}`); }
      scan(`제단 ${o.id}`);
    }
  }
  ok(holes.length === before2, `제단의 모든 판돈을 걸어 봤다 (${ranAltar}회)`,
     holes.slice(before2, before2 + 4).join(' · ') || '전부 깨끗함');

  const before3 = holes.length;
  let ranRelic = 0;
  for (const r of D.RELICS) {
    const p = stage();
    p.relics = [];
    try { Game.takeRelic(r.id); Game.recalc(p); ranRelic++; }
    catch (err) { holes.push(`유물 ${r.id} 던짐: ${err.message}`); }
    scan(`유물 ${r.id}`);
  }
  ok(holes.length === before3, `모든 유물을 들어 봤다 (${ranRelic}종)`,
     holes.slice(before3, before3 + 4).join(' · ') || '전부 깨끗함');
}

/* ── 6. 링크 미리보기 ──────────────────────────────────────
   페이지 밖으로 나가는 유일한 글이다. 여기가 비어 있으면 링크는
   주소만 덩그러니 뜨고, 그림이 없으면 다른 서비스가 아무 이미지나
   골라 붙인다. 그림이 실제로 있는지, 크기가 태그가 약속한 값과
   같은지까지 본다 — 어긋나면 카드가 잘린다. */
{
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const need = ['og:title', 'og:description', 'og:image', 'og:url',
                'og:image:width', 'og:image:height', 'twitter:card'];
  const missing = need.filter(k => !html.includes(`"${k}"`));
  ok(missing.length === 0, '링크 미리보기 태그가 전부 있다', missing.join(', ') || `${need.length}개`);

  const url = new URL('../og.png', import.meta.url);
  const has = fs.existsSync(url);
  ok(has, '미리보기 그림이 저장소에 있다', has ? `${(fs.statSync(url).size / 1024) | 0}KB` : '없음 — node sim/og.mjs');
  if (has) {
    /* PNG의 폭·높이는 IHDR 청크의 고정 자리에 있다. 이미지 라이브러리
       없이 열여섯 바이트만 읽으면 된다. */
    const buf = fs.readFileSync(url);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const wantW = +(html.match(/"og:image:width" content="(\d+)"/)?.[1] || 0);
    const wantH = +(html.match(/"og:image:height" content="(\d+)"/)?.[1] || 0);
    ok(w === wantW && h === wantH, '태그가 약속한 크기와 그림이 같다',
       `그림 ${w}×${h} · 태그 ${wantW}×${wantH}`);
  }
}

console.log(bad ? `\n문장 벤치: ${bad}건 실패\n` : '\n문장 벤치: 전부 통과\n');
process.exit(bad ? 1 : 0);
