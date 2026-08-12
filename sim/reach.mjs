/* reach.mjs — 한 판에 이 게임의 콘텐츠가 실제로 몇 %나 닿는가.
   ("does the content reach the player?")

   이 리포에는 유물 38, 접두·접미 표, 공명, 고유, 기연, 초월, 촉매,
   각인, 융합, 갈래, 기억, 족쇄가 있다. 그런데 플레이 평은 「요소 간
   상호작용이 되는 게 없다」였고, 이번 세션의 측정은 그 말과 같은
   방향을 계속 가리켰다 — 레인저의 표적은 화살에 안 걸렸고, 마나는
   한 번도 마르지 않았고, 기예는 정책이 없어서 0회였다.

   그래서 재미를 추측하기 전에 이것부터 센다: 진짜 한 판에서, 각
   시스템이 몇 %의 판에 한 번이라도 발화하는가. 0%에 가까운 줄은
   「설계가 약한 것」이 아니라 **없는 것**이다.

   usage: node sim/reach.mjs [runs] */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const Game = await import('../src/game.js');
const D = await import('../src/data.js');
const { runBot } = await import('./_botlib.mjs');
const G = Game.G;
Meta.forget();

const N = Number(process.argv[2] || 24);
const CLASSES = ['warrior', 'rogue', 'mage', 'priest', 'ranger', 'paladin'];

/* 한 판이 끝난 시점에 G와 플레이어에서 읽을 수 있는 것들. 「한 번이라도
   있었나」를 세는 것이지 「몇 번」이 아니다 — 0%인 줄을 찾는 게 목적. */
const PROBES = [
  ['유물을 하나라도 들었나',   () => (G.player?.relics || []).length > 0],
  ['유물 둘 이상',            () => (G.player?.relics || []).length >= 2],
  ['유물 셋 이상',            () => (G.player?.relics || []).length >= 3],
  ['공명이 켜졌나',           () => Object.keys(G.player?.reso || {}).length > 0],
  ['융합을 했나',             () => (G.fused || 0) > 0],
  ['고유 무기를 찾았나',       () => Object.keys(G.uniques || {}).length > 0],
  ['기연(oddity)을 만났나',    () => !!G.player?.equip?.weapon?.odd
                                  || !!G.player?.equip?.body?.odd],
  ['초월을 봤나',             () => (G.transFound || 0) > 0],
  ['촉매를 썼나',             () => (G.catUsed || 0) > 0],
  ['각인을 했나',             () => (G.engraved || 0) > 0],
  ['장비에 접두·접미가 붙었나', () => ['weapon','body','shield']
      .some(k => G.player?.equip?.[k]?.pre || G.player?.equip?.[k]?.suf)],
  ['강화 +3 이상을 만들었나',  () => ['weapon','body','shield']
      .some(k => (G.player?.equip?.[k]?.plus || 0) >= 3)],
  ['주문에 속성을 붙였나',     () => Object.keys(G.player?.spellAffix || {}).length > 0],
  ['분해를 했나',             () => (G.broke || 0) > 0],
  ['모루에서 두들겼나',        () => (G.forged || 0) > 0],
  ['? 를 열었나',             () => (G.eventsSeen || 0) > 0],
  ['상자를 열었나',           () => (G.opened || 0) > 0],
  ['미믹에게 물렸나',          () => (G.mimicsBitten || 0) > 0],
  ['함정을 밟았나',           () => (G.trapsSprung || 0) > 0],
  ['파도(wave)를 맞았나',      () => (G.waves || 0) > 0],
  ['판돈을 두 층 이상 걸었나',  () => (G.bank || 0) >= 2],
  ['기억을 갖고 시작했나',      () => (G.memories || []).length > 0],
  ['연격 10 이상',            () => (G.bestCombo || 0) >= 10],
  ['절단(perfect)을 봤나',     () => (G.perfects || 0) > 0],
];

const hit = PROBES.map(() => 0);
let runs = 0, depth = 0;
for (const cls of CLASSES) {
  for (let i = 0; i < N; i++) {
    const r = runBot('human', cls, i % 2 === 0);
    runs++; depth += r.depth;
    PROBES.forEach(([, f], k) => { try { if (f()) hit[k]++; } catch { /* 판이 없다 */ } });
  }
}

console.log(`\n콘텐츠 도달률 — ${CLASSES.length}직업 × ${N}판 = ${runs}판, 평균 ${(depth/runs).toFixed(1)}층\n`);
const rows = PROBES.map(([n], k) => [n, hit[k] * 100 / runs]).sort((a, b) => a[1] - b[1]);
for (const [n, pct] of rows) {
  const bar = '█'.repeat(Math.round(pct / 4)).padEnd(25, '·');
  const flag = pct < 5 ? '  ← 사실상 없음' : pct < 20 ? '  ← 거의 안 보임' : '';
  console.log(`  ${String(Math.round(pct)).padStart(3)}%  ${bar}  ${n}${flag}`);
}
console.log(`\n총 ${D.RELICS.length} 유물 · ${D.UNIQUES.length} 고유 · ${D.ODDITIES.length} 기연 · `
          + `${D.RESONANCE.length} 공명 · ${D.FUSIONS.length} 융합 · ${D.ENGRAVINGS.length} 각인`);
console.log('0%에 가까운 줄은 설계가 약한 것이 아니라 존재하지 않는 것이다.\n');
