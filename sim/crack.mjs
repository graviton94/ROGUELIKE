/* ═══════════════════════════════════════════════════════════
   crack.mjs — 이름 붙은 것이 규칙을 부수는가

   이름 붙은 무기는 「조금 더 좋은 무기」였다. 주사위가 한 단계 크고
   규칙이 한 줄 붙은 것 — 그러면 3.5%를 뽑고도 판이 안 달라진다.
   그래서 하나마다 **크랙**을 줬고, 크랙은 셋 중 하나여야 한다:

     ① 컨셉을 지키는 크랙 — 그 물건이 하는 일을 말이 안 되는 데까지
     ② 단점을 날려버리는 크랙 — 그 **종류**가 지불하는 값을 지운다
     ③ 상식을 파괴하는 크랙 — 게임이 가르친 규칙 하나를 부순다

   ③은 특히 조심해서 재야 한다. 「천장은 내려가기만 한다」를 부수는
   물건은, 잘못 만들면 크랙이 아니라 **무한 성장**이다. 그래서 여기서
   묻는 것은 「부수는가」와 「어디서 멈추는가」 둘 다다.

   이 파일을 쓰면서 자가 두 번 틀렸다. 한 번은 천장이 **파생값**이라는
   것을 잊고 `p.maxhp += n`으로 올려서, recalc 한 번에 지워졌는데
   장부만 남았다. 한 번은 「층을 내려가면 처음 천장으로 돌아온다」로
   걸었는데 그 사이 레벨이 올라 기본 천장이 커져 있었다.
   둘 다 세계가 아니라 자가 틀린 것이었다.

   usage: node sim/crack.mjs
   ═══════════════════════════════════════════════════════════ */
const store=new Map();
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const Meta=await import('/home/user/ROGUELIKE/src/meta.js');
const Game=await import('/home/user/ROGUELIKE/src/game.js');
const D=await import('/home/user/ROGUELIKE/src/data.js');
const W=await import('/home/user/ROGUELIKE/src/world.js');
const G=Game.G;
let bad=0;
const ok=(c,m,g)=>{ console.log(`  ${c?'·':'✗'} ${m}${g!==undefined?` — ${g}`:''}`); if(!c)bad++; };

function stage(cls='warrior'){
  Meta.forget();
  Game.startGame('human',cls,Game.rollStats(cls));
  Game.descend(); Game.enterDepth(6);
  const L=G.level,p=G.player;
  for(let i=0;i<L.tiles.length;i++) L.tiles[i]=W.ROCK;
  for(let x=3;x<=40;x++) L.tiles[W.idx(x,12)]=W.FLOOR;
  p.x=10;p.y=12;p.lightTurns=900;p.hp=p.maxhp;
  G.monsters.length=0;
  Game.recalc(p); Game.refreshFov();
  return p;
}
const give=(p,id)=>{ const u=D.uniqueById(id); p.equip.weapon={kind:'weapon',unique:id,...u,plus:0}; Game.recalc(p); return u; };
const put=(hp=999,atk=0)=>{ const spec=D.MONSTERS.find(m=>m.spr==='orc');
  const m={...spec,hp,maxhp:hp,atk,ac:0,x:G.player.x+1,y:G.player.y,awake:true,energy:0};
  G.monsters.push(m); return m; };

console.log('\n크랙 벤치 — 이름 붙은 것이 규칙을 부수는가\n');

/* ① 재를 세는 자 — 셈이 층을 넘고 주사위가 커진다 */
{
  const p=stage(); give(p,'ashcount');
  const before=Game.crackDice(p.equip.weapon).join('d');
  G.ashCount=24;
  const after=Game.crackDice(p.equip.weapon).join('d');
  Game.enterDepth(7);
  ok(before!==after, '① 셈이 여덟마다 주사위를 한 면 키운다', `${before} → ${after}`);
  ok(G.ashCount>0, '① 층을 내려가도 셈이 안 지워진다', `${G.ashCount}`);
}
/* ② 화로에서 꺼낸 것 — 대검이 안 빗나간다 */
{
  const p=stage(); give(p,'emberpull');
  ok(Game.crackAim()>1, '② 대검의 빗맞음이 지워진다', `명중 배율 ${Game.crackAim()}`);
}
/* ② 긴 침묵 — 붙어서도 활이다 */
{
  const p=stage(); give(p,'longhush');
  ok(Game.crackBowMelee()===1, '② 활의 근접 페널티가 지워진다', `배율 ${Game.crackBowMelee()}`);
}
/* ③ 약속 — 천장이 올라간다 */
{
  const p=stage(); give(p,'promise');
  p.hp=p.maxhp;
  const roof=p.maxhp;
  for(let i=0;i<10;i++){ G.monsters.length=0; put(1,0); Game.step(1,0); }
  ok(p.maxhp>roof, '③ 넘치게 때리면 최대 체력이 오른다 — 이 게임에서 천장은 내려가기만 한다',
     `${roof} → ${p.maxhp}`);
  const grown=p.maxhp;
  Game.enterDepth(8);
  ok(p.maxhp===grown, '③ 그리고 그 몫은 남는다 (약속은 층을 넘는다)', `${p.maxhp}`);
}
/* ③ 못 박는 자 — 세 번 맞으면 영영 못 움직인다 */
{
  const p=stage(); give(p,'nailer');
  G.monsters.length=0;
  const m=put(9999,0);
  for(let i=0;i<14;i++) Game.step(1,0);   // 빗맞는 판이 있으므로 넉넉히
  const was={x:m.x,y:m.y};
  m.x=p.x+4;                       // 멀리 두고 다가오게 해 본다
  for(let t=0;t<8;t++) Game.endTurn();
  ok(m.nailed===true, '③ 세 번 맞은 것은 박힌다', `못 ${m.nails}`);
  ok(m.x===p.x+4, '③ 박힌 것은 한 칸도 못 온다 — 쫓는 쪽이 바뀐다', `x ${m.x}`);
}
/* ② 마지막 등불 — 마나가 없어도 주문이 나간다 */
{
  const p=stage('mage'); give(p,'lastlamp');
  G.monsters.length=0; put(9999,0);
  p.mana=0; const hp0=p.hp;
  const sp=Game.spellList(p)[0];
  Game.cast(sp.id);
  ok(p.hp<hp0, '② 마나가 없어도 주문이 나간다 — 모자란 만큼을 피로 낸다', `체력 ${hp0} → ${p.hp}`);
}
/* 그리고 벼려진다 */
{
  const p=stage(); give(p,'promise');
  const t={type:'item',item:p.equip.weapon};
  ok(!Game.forgeBlock(t,'upgrade'), '이름 붙은 것도 벼려진다');
  ok(!Game.forgeBlock(t,'enchant'), '이름 붙은 것도 물든다');
}
/* ③ 끝없는 허기 — 천장을 넘겨 먹는다 */
{
  const p=stage(); p.relics=['famine']; Game.recalc(p);
  /* 앞 절에서 「약속」이 permHp를 영구히 올려 놓았다. 그건 의도된
     것이므로(그 크랙의 값이 그것이다) 여기서는 지금 천장을 기준으로
     잡는다 — 앞 절의 결과를 이 절의 오차로 읽으면 안 된다. */
  p.hp=p.maxhp; const roof=p.maxhp;
  for(let i=0;i<6;i++){ G.monsters.length=0; put(1,0); Game.step(1,0); }
  ok(p.maxhp>roof, '③ 가득 찬 몸에도 먹은 것이 쌓인다', `${roof} → ${p.maxhp}`);
  /* 처음에 「층을 내려가면 처음 천장으로 돌아온다」로 걸었더니 틀렸다 —
     그 사이에 처치로 레벨이 올라 **기본 천장 자체가** 커져 있었다.
     세계가 틀린 것이 아니라 자가 틀렸다. 부푼 몫만 빠지는지를 묻는다. */
  const peak=p.maxhp, swell=G.famineSwell||0;
  Game.enterDepth(9);
  ok(swell>0 && p.maxhp===peak-swell,
     '③ 그러나 부푼 몫은 층을 못 넘는다', `${peak} − ${swell} = ${p.maxhp}`);
}
console.log(bad?`\n크랙 벤치: ${bad}건 실패\n`:'\n크랙 벤치: 전부 부순다\n');
process.exit(bad?1:0);
