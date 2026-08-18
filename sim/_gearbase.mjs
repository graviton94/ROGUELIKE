/* _gearbase.mjs — sim/tags.mjs 의 기준선을 다시 뜬다.

   유물의 값을 **일부러** 바꿨을 때만 돌린다:
       node sim/_gearbase.mjs > sim/_gearbase.json
   그냥 돌려서 초록으로 만드는 것은 회귀를 지우는 것이다. 값을 바꾼
   커밋이라면 그 커밋의 메시지가 무엇을 왜 바꿨는지 적고 있어야 한다.

   떠 놓는 상태는 tags.mjs 가 비교할 때 쓰는 것과 **글자까지 같아야**
   한다(체력 20% · 앙심 5 · 씨앗 3 · 불 꺼짐 · 3층 · 10레벨) — 하나라도
   다르면 이 비교는 유물이 아니라 상태를 잰다. */
const store=new Map();
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const Meta=await import('../src/meta.js');
const Game=await import('../src/game.js');
const D=await import('../src/data.js');
const {G}=Game;
Meta.forget();
Game.startGame('human','warrior',Game.rollStats('warrior'));
const p=G.player;
p.lv=10; Game.recalc(p);
const KEYS=Object.keys(Game.gearBonus(p)).sort();
const snap={};
for(const r of D.RELICS){
  for(const crack of [false,true]){
    p.relics=[r.id];
    G.cracks = crack ? {[r.id]:true} : {};
    p.hp = Math.round(p.maxhp*0.2);      // 저울추 같은 조건부가 켜지는 자리
    p.grudge = 5; p.seedAc = 3; p.lightTurns = 0; G.depth = 3;
    const b=Game.gearBonus(p);
    snap[`${r.id}/${crack?'crack':'plain'}`] = KEYS.map(k=>{
      const v=b[k];
      return typeof v==='number' ? Math.round(v*1e6)/1e6 : v;
    });
  }
}
console.log(JSON.stringify({keys:KEYS,snap},null,0));
