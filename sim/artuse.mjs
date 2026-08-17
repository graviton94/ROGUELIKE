/* Did the policy actually fire? A zero here means the class survey
   was still measuring a class with its toolkit switched off. */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const { runBot, ARTUSE, ARTMISS } = await import('./_botlib.mjs');
Meta.forget();

const N = Number(process.argv[2] || 12);
for (const cls of ['warrior','ranger','priest','paladin','rogue','mage']) {
  for (const k of Object.keys(ARTUSE)) delete ARTUSE[k];
  for (const k of Object.keys(ARTMISS)) delete ARTMISS[k];
  let depth = 0;
  for (let i = 0; i < N; i++) { const r = runBot('human', cls, i % 2 === 0); depth += r.depth; }
  const used = Object.entries(ARTUSE).sort((a,b)=>b[1]-a[1]);
  console.log(`── ${cls} ${N}판 · 평균 ${(depth/N).toFixed(1)}층`);
  console.log(used.length ? '   ' + used.map(([k,v])=>`${k} ${v}`).join(' · ') : '   기예 사용 0');
  /* 헛손질. 이 줄이 커지면 봇 정책이 게임의 거절 조건과 어긋난
     것이고, 위 줄을 「많이 쓴다」로 읽으면 다섯 배를 부풀려 읽는다. */
  const miss = Object.entries(ARTMISS).sort((a,b)=>b[1]-a[1]);
  const nUse = used.reduce((n,[,v])=>n+v,0), nMiss = miss.reduce((n,[,v])=>n+v,0);
  if (nMiss) console.log(`   헛손질 ${nMiss}회 (${Math.round(100*nMiss/(nUse+nMiss))}%) — `
    + miss.slice(0,3).map(([k,v])=>`${k} ${v}`).join(' · '));
}
