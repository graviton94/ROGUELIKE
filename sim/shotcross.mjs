/* shotcross.mjs — 성전의 십자를 프레임이 살아 있는 순간에 찍는다.

   이 그림은 「눌렀을 때 무슨 일이 일어나는가」가 전부인 기예의
   그림이라, 정지된 화면으로는 아무것도 안 보인다. 그래서 계단을 밟고
   내려가 팔 안에 몬스터를 세워 놓고, 누른 뒤 110ms 에 찍는다.

   카드를 **누르기 전에** 치운다. 안 치우면 층 배너가 십자를 덮고,
   그 사진은 이 세션에서 세 번째로 같은 실수가 된다.

   usage: node sim/shotcross.mjs <저장할 png>                    */
import { chromium } from 'playwright';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.addInitScript(()=>{let z=99991>>>0;Math.random=()=>((z=(z*1664525+1013904223)>>>0)/4294967296);});
await pg.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1100);
await pg.evaluate(async()=>{const Game=await import('/src/game.js');const UI=await import('/src/ui.js');
  Game.startGame('human','paladin',Game.rollStats('paladin'));UI.setScreen('play');UI.refresh();});
const dismiss=async()=>{for(let i=0;i<14;i++){const h=await pg.evaluate(()=>{for(const id of ['lesson-ok','ask-ok','look-ok']){const e=document.getElementById(id);if(e&&e.getBoundingClientRect().width>2){e.click();return true;}}return false;});if(!h)return;await pg.waitForTimeout(160);}};
await dismiss();
// 층으로 내려가서, 십자 팔 안에 몬스터를 세워 놓고 누른다
const info = await pg.evaluate(async()=>{
  const Game=await import('/src/game.js');const W=await import('/src/world.js');const UI=await import('/src/ui.js');
  const G=Game.G;
  for(let i=0;i<4000&&G.depth<3;i++){
    if(G.screen!=='play'){const was=G.screen;
      if(was==='event')Game.eventChoose(0);
      else if(was==='stairs'){const o=Game.stairOffers?Game.stairOffers():null;Game.chooseBranch(o?.[0]?.id??null);}
      if(G.screen===was)G.screen='play';continue;}
    const p=G.player; p.hp=p.maxhp;
    if(Game.stairHere()==='down'){Game.descend();continue;}
    const L=G.level;
    const walk=(x,y)=>x>=0&&y>=0&&x<W.MW&&y<W.MH&&(L.tiles[W.idx(x,y)]===W.DOOR||!L.solid(x,y));
    const prev=new Int32Array(W.MW*W.MH).fill(-1);const start=W.idx(p.x,p.y);prev[start]=start;
    const q=[start];let goal=-1,stair=-1;
    for(let h=0;h<q.length&&goal<0;h++){const cur=q[h],cx=cur%W.MW,cy=(cur/W.MW)|0;
      if(L.tiles[cur]===W.DOWN&&stair<0)stair=cur;
      if(!L.seen[cur]){goal=cur;break;}
      for(const[ax,ay]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+ax,ny=cy+ay,ni=W.idx(nx,ny);
        if(!walk(nx,ny)||prev[ni]!==-1)continue;prev[ni]=cur;q.push(ni);}}
    if(goal<0)goal=stair;
    if(goal<0||goal===start){Game.step(0,0);continue;}
    let n=goal;while(prev[n]!==start&&prev[n]!==n)n=prev[n];
    Game.step((n%W.MW)-p.x,((n/W.MW)|0)-p.y);
  }
  const p=G.player; p.lv=12; Game.recalc(p); p.hp=Math.round(p.maxhp*0.7); p.stam=p.maxStam;
  /* 팔 안에 세 마리를 세운다 — 십자가 무엇을 하는지가 그림에서 보여야 한다. */
  const put=[[2,0],[0,-3],[-1,0],[0,2]];
  let placed=0;
  for(const [dx,dy] of put){
    const x=p.x+dx,y=p.y+dy;
    if(G.level.solid(x,y)||G.monsters.some(m=>m.x===x&&m.y===y))continue;
    const m=G.monsters[placed % Math.max(1,G.monsters.length)];
    if(!m)break;
    // 새 몬스터를 만들지 않고, 있는 것을 옮긴다
    m.x=x;m.y=y;m.awake=true;m.hp=m.maxhp;placed++;
  }
  Game.refreshFov(); UI.refresh();
  return { depth:G.depth, placed, mon:G.monsters.length };
});
await dismiss();                        // 카드를 먼저 치운다 — 안 치우면 십자를 양피지가 덮는다
await pg.waitForTimeout(300);
const fired = await pg.evaluate(async()=>{
  const Game=await import('/src/game.js');const UI=await import('/src/ui.js');
  UI.setScreen('play'); UI.refresh();
  Game.useArt('crusade');
  return Game.G.player.crusadeLeft;
});
await pg.waitForTimeout(110);          // 프레임이 살아 있는 순간
await pg.screenshot({ path: OUT });
console.log(JSON.stringify(info), '남은 판결', fired, '오류', errs[0]||'없음');
await b.close();
