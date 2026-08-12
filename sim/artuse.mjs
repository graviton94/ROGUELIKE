/* Did the policy actually fire? A zero here means the class survey
   was still measuring a class with its toolkit switched off. */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const { runBot, ARTUSE } = await import('./_botlib.mjs');
Meta.forget();

const N = Number(process.argv[2] || 12);
for (const cls of ['warrior','ranger','priest']) {
  for (const k of Object.keys(ARTUSE)) delete ARTUSE[k];
  let depth = 0;
  for (let i = 0; i < N; i++) { const r = runBot('human', cls, i % 2 === 0); depth += r.depth; }
  const used = Object.entries(ARTUSE).sort((a,b)=>b[1]-a[1]);
  console.log(`── ${cls} ${N}판 · 평균 ${(depth/N).toFixed(1)}층`);
  console.log(used.length ? '   ' + used.map(([k,v])=>`${k} ${v}`).join(' · ') : '   기예 사용 0');
}
