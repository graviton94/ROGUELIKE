/* density.mjs — 한 판을 걷는 동안 몇 번이나 무슨 일이 일어나는가.

   「행상인이나 이벤트가 너무 자주 안 뜸」은 감상이 아니라 측정할 수
   있는 말이다. 층을 만들기만 하고 무엇이 놓였는지 세면 된다. 봇을
   태울 필요도 없다 — 이건 생성기의 성질이지 플레이의 성질이 아니다.

   usage: node sim/density.mjs [층수=15] [반복=200]                */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const W = await import('../src/world.js');

const DEPTH = Number(process.argv[2] || 15);
const N = Number(process.argv[3] || 200);

const tally = { camp:0, altar:0, merchant:0, event:0, anvil:0 };
const per = [];
for (let run = 0; run < N; run++) {
  const one = { camp:0, altar:0, merchant:0, event:0, anvil:0 };
  for (let d = 1; d <= DEPTH; d++) {
    const L = new W.Level(d, {});
    /* 사건은 층당 둘까지 놓이는데 L.event는 한 자리만 기억한다.
       그래서 여기서는 기억이 아니라 타일을 센다 — 무대에 실제로
       놓인 것을 세지 않으면 두 번째 사건이 통계에서 사라진다. */
    let ev = 0;
    for (const t of L.tiles) if (t === W.EVENT) ev++;
    one.event += ev;
    if (L.camp) one.camp++;
    if (L.altar) one.altar++;
    if (L.merchant) one.merchant++;
    if (L.anvil) one.anvil++;
  }
  per.push(one);
  for (const k of Object.keys(tally)) tally[k] += one[k];
}

const NAME = { camp:'모닥불', altar:'제단', merchant:'행상인', event:'수상한 자리', anvil:'모루' };
console.log(`\n밀도 벤치 — ${DEPTH}층까지 · ${N}판\n`);
for (const k of ['event', 'merchant', 'altar', 'camp', 'anvil']) {
  const avg = tally[k] / N;
  const floors = per.filter(o => o[k] > 0).length / N;
  console.log(`  ${NAME[k].padEnd(7)} 판당 ${avg.toFixed(1)}회 · ${(DEPTH / Math.max(avg, 0.001)).toFixed(1)}층에 한 번`
            + `  ${'▪'.repeat(Math.round(avg))}`);
}
const dry = per.map(o => DEPTH - Math.min(DEPTH, o.event + o.merchant + o.altar));
console.log(`\n  아무 자리도 없는 층: 판당 ${(dry.reduce((a, b) => a + b, 0) / N).toFixed(1)}층\n`);
