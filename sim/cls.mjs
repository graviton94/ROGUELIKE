/* Six classes, same number of runs each. The question is whether
   the warrior stops being last, and whether giving it verbs moved
   anyone else. */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const { runBot } = await import('./_botlib.mjs');
Meta.forget();
const N = Number(process.argv[2] || 40);
const rows = [];
for (const cls of ['warrior','rogue','mage','priest','ranger','paladin']) {
  const d = [];
  let wins = 0, lv = 0;
  for (let i = 0; i < N; i++) {
    const r = runBot('human', cls, i % 2 === 0);
    d.push(r.depth); if (r.win) wins++; lv += r.lv || 0;
  }
  d.sort((a,b)=>a-b);
  const q = f => d[Math.min(d.length-1, Math.floor(d.length*f))];
  rows.push({ cls, avg: d.reduce((a,b)=>a+b,0)/d.length, med: q(0.5), top: q(0.9),
              deep: d.filter(x=>x>=11).length, wins, lv: lv/N });
}
rows.sort((a,b)=>b.avg-a.avg);
console.log(`── 직업별 ${N}판씩`);
for (const r of rows)
  console.log(`   ${r.cls.padEnd(8)} 평균 ${r.avg.toFixed(1).padStart(4)}층 · 중앙 ${String(r.med).padStart(2)} · 상위10% ${String(r.top).padStart(2)}` +
              ` · 11층+ ${String(r.deep).padStart(2)}/${N} · 승 ${r.wins} · Lv ${r.lv.toFixed(1)}`);
