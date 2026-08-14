/* What actually stops each class. Not "how deep" — that number
   is already known — but the shape of the ending: who swung, how
   crowded it was, and whether the health bar fell off a cliff or
   drained. The ranger and the rogue share a prime stat and sit
   four floors apart, so they are the pair worth reading. */
const store = new Map();
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
const Meta = await import('../src/meta.js');
const { runBot } = await import('./_botlib.mjs');
Meta.forget();

const N = Number(process.argv[2] || 30);
for (const cls of (process.argv[3] || 'ranger,rogue,warrior').split(',')) {
  const killers = new Map();
  let hp5 = 0, hp10 = 0, n5 = 0, n10 = 0, adj = 0, dry = 0, depth = 0, runs = 0;
  for (let i = 0; i < N; i++) {
    const r = runBot('human', cls, i % 2 === 0);
    depth += r.depth; runs++;
    if (r.win) continue;
    killers.set(r.killer, (killers.get(r.killer) || 0) + 1);
    if (r.hp5 != null) { hp5 += r.hp5; n5++; }
    if (r.hp10 != null) { hp10 += r.hp10; n10++; }
    adj += r.adjAtEnd || 0;
    // 화살은 떨어지지 않는다. 세던 것 자체가 옛 설계의 잔해였다.
  }
  const top = [...killers.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 5);
  console.log(`── ${cls} ${N}판 · 평균 ${(depth/runs).toFixed(1)}층`);
  console.log(`   끝나기 10턴 전 체력 ${(100*hp10/Math.max(1,n10)).toFixed(0)}%`
            + ` · 5턴 전 ${(100*hp5/Math.max(1,n5)).toFixed(0)}%`);
  console.log(`   마지막 순간 붙어 있던 것 ${(adj/Math.max(1,n5||1)).toFixed(1)}마리`
            );
  console.log(`   ${top.map(([k,v])=>`${k} ${v}`).join(' · ')}`);
  console.log('');
}
