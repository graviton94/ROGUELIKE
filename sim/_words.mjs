/* _words.mjs — sim/tags.mjs 의 어휘 무게표를 다시 뜬다.

       node sim/_words.mjs > sim/_words.json

   어휘 여섯이 직업마다 얼마나 쓰이는가. 「이 유물이 이 직업에게
   무슨 값인가」는 give/take 어휘의 무게 차이로 나오므로, 240칸을
   손으로 적는 대신 이 66칸이 그 표를 대신한다.

   장부 동사 → 어휘의 대응이 이 파일의 판단이고, 두 가지를 조심한다:
     · `floor`(내려간 층)는 **안 쓴다.** 그 누적량은 도달 층 그 자체라
       유물이 아니라 생존을 재게 된다 — synergy.mjs 가 그 함정에
       한 번 빠졌다(floor 유물 열한 개가 전부 「도적 것」으로 찍혔다)
     · `combo` 는 합이 아니라 최고값(ledgerPeak)이라 비율이 뜻이 없다

   3배치로 뜨고 중앙값을 쓴다. 정규화는 **몫**이다(아래 참조). 배치 폭도 같이 적어 둔다 — 무게 차이가
   폭보다 작으면 그 판정은 표본을 읽은 것이다.                     */
const store=new Map();
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const Meta=await import('../src/meta.js');
const Game=await import('../src/game.js');
const {runBot}=await import('./_botlib.mjs');
const {G}=Game;
const CLS=['warrior','rogue','ranger','mage','priest','paladin'];
/* 어휘 ← 장부 동사. 눈은 함정 하나뿐이다 — 불빛·지도·판별을 세는
   동사가 아직 없고, 그게 ① 다음의 다음 구멍이다. */
const WORD={ '몸':['hit'], '손':['crit','kill','elite'], '혀':['spell'],
             '눈':['trap'], '발':['slip'], '주머니':['gold','gulp'] };
const N=Number(process.argv[2]||20), B=3;
const mid=a=>{const b=a.slice().sort((x,y)=>x-y),n=b.length;
  return n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2;};
const raw={};
for(const cls of CLS){
  raw[cls]=[];
  for(let b=0;b<B;b++){
    const bat=[];
    for(let i=0;i<N;i++){Meta.forget();const r=runBot('human',cls,i%2===0);
      bat.push({turn:r.turn, led:{...(G.ledger||{})}});}
    raw[cls].push(bat);
  }
}
/* 100턴당 비율 → 여섯의 중앙값을 1.00으로 */
const per={};
for(const w of Object.keys(WORD)){
  per[w]={};
  for(const cls of CLS){
    const byBatch=raw[cls].map(bat=>mid(WORD[w].map(k=>
      mid(bat.map(r=>(r.led[k]||0)/Math.max(1,r.turn)*100)))));
    per[w][cls]={ m:mid(byBatch), w:Math.max(...byBatch)-Math.min(...byBatch) };
  }
  /* ── 중앙값으로 나누면 안 된다 ──────────────────────────
     처음에 「여섯의 중앙값을 1.00으로」 했다. 그런데 어휘 하나가
     **한 직업에 몰려** 있으면 중앙값이 0에 가까워지고, 나눗셈이
     터진다 — 발이 정확히 그랬다: 도적의 100턴당 값이 4.1이고 나머지
     다섯이 0.16~0.6인데, 중앙값(0.35)으로 나누니 도적이 **15.83**로
     찍혔다. 그 무게로 사분면을 그리면 발을 건드리는 유물은 전부
     극단으로 갈리고, 그건 게임이 아니라 나눗셈이다.

     몫으로 바꾼다: 그 직업의 비율 ÷ 여섯의 합 × 6. 여섯이 똑같으면
     전부 1.00이고, 한 직업이 전부 가져가면 6.00이다 — **[0,6]에
     갇혀 있고 중앙값이 작아도 안 터진다.** 발의 도적은 4.27이 된다.
     여전히 가장 크고, 다른 어휘와 같은 자에 올라간다. */
  const sum=CLS.reduce((a,c)=>a+per[w][c].m,0) || 1;
  for(const cls of CLS){ per[w][cls].m=per[w][cls].m/sum*CLS.length;
                         per[w][cls].w=per[w][cls].w/sum*CLS.length; }
}
console.log(JSON.stringify({cls:CLS,word:Object.keys(WORD),verb:WORD,runs:N*B,per},null,0));
