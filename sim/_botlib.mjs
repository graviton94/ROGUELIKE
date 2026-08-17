import * as Game from '../src/game.js';
const Meta = await import('../src/meta.js');
import { G } from '../src/game.js';
import { idx, MW, MH, DOWN, CAMP, ANVIL, PROP, walkable } from '../src/world.js';
import { ENCHANT_COST } from '../src/data.js';
import * as BOWDATA from '../src/data.js';
export const ARTUSE = {};
/* Offers already reached for, keyed tile+floor, cleared per run. */
const pressed = new Set();
/* 시전 기회 대비 「눈앞에 있는데 살 수 있는 주문이 없던」 턴. 자원이
   자원인지 묻는 유일한 지표 — 걷는 턴의 잔량은 아무것도 말하지 않는다. */
export const DRY = { dry: 0, cast: 0 };
/* ── 누른 것이 아니라 나간 것을 센다 ────────────────────────
   여기서 누르기 전에 세고 있었다. 그런데 cast는 거절할 수 있다 —
   자원이 모자라거나, 손에 닿는 것이 없거나, 이 층에서 이미 썼거나.
   그래서 이 표는 「기예를 몇 번 썼나」가 아니라 「버튼을 몇 번
   눌렀나」였고, 팔라딘의 심판의 일격이 층당 20.9회로 찍혔다. 실제로
   나간 것은 층당 4.2회다 — 다섯 배를 부풀려 읽고 있었다.

   게임에 이미 「나갔다」를 세는 자리가 있다(G.artsUsed는 useArt가
   모든 검사를 통과한 뒤에만 오른다). 그걸 읽는다.

   눌렀는데 안 나간 것도 값이다 — 봇이 헛손질하는 횟수는 곧 봇 정책과
   게임의 거절 조건이 어긋난 정도다. 따로 센다. */
export const ARTMISS = {};
function useArtCounted(id) {
  const was = Game.G.artsUsed || 0;
  Game.cast(id);
  if ((Game.G.artsUsed || 0) > was) ARTUSE[id] = (ARTUSE[id] || 0) + 1;
  else ARTMISS[id] = (ARTMISS[id] || 0) + 1;
}
/* The mage's lines want to record *which sentence* was cast, not
   only which spell, so they pass a label and the spell id apart. */
function castCounted(label, id) { ARTUSE[label] = (ARTUSE[label]||0)+1; Game.cast(id); }
const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const prev = new Int32Array(MW*MH);
/* ── 도착했는데 아무 일도 안 일어난 칸 ────────────────────────
   봇의 목표 목록(유물 · 수레 · 모닥불 · 모루 · 사건 · 계단)은 전부
   「거기 가면 무언가 일어난다」를 전제한다. 그런데 일어나지 않는
   경우가 있다: 두들길 것이 없는 모루, 다 쓴 모닥불, 자리가 없어
   못 줍는 유물. 그러면 봇은 목표로 걸어가고, 아무 일도 없고, 다시
   같은 목표를 고른다 — 영원히. 240판에 한 판이 4층에서 59,685턴을
   그렇게 썼고 그 판의 도달 층이 죽은 판들과 같이 평균에 섞였다.

   개별 목표마다 예외를 붙이는 대신(모루 하나를 막으니 유물이 같은
   짓을 했다) **한 자리에서 한 번 헛걸음하면 그 칸은 이번 층에서
   끝난 것으로 친다.** 층이 바뀌면 전부 다시 후보다. */
const dead = new Set();
function route(pred) {
  const live = (x, y) => !dead.has(idx(x, y)) && pred(x, y);
  /* 세 번째 시도가 필요했다. 앞의 둘은 함정만 풀고 **이름 있는 것의
     자리**는 양쪽 다 피하는데, 그것이 계단으로 가는 복도 한가운데
     앉아 있으면 경로가 아예 없다 — 그러면 봇은 제자리에서 영원히
     기다린다(실제로 갇힌 판들이 UP 타일 위에서 그러고 있었다).
     피할 수 있으면 피하고, 피해서는 못 가면 지나간다. 사람도 그렇게
     한다: 못 지나가는 길이면 결국 그것과 마주친다. */
  return routeAvoiding(live, true) || routeAvoiding(live, false)
      || routeAvoiding(live, false, true);
}

/* A named thing now holds its ground instead of hunting the
   floor, so "fight it or walk past it" became a real choice — and
   a bot that walks into every one of them measures a game nobody
   plays. Model the choice the way a reader of the stairs screen
   would: take it on if you arrived roughly on curve and healthy,
   otherwise treat its ground as somewhere you do not go.

   Level 1.6 per floor is the surveyed hero at each depth: about
   10 on floor 6, 16 on floor 10, 21 on floor 13. */
function willFight(m) {
  const p = G.player;
  return p.lv >= G.depth * 1.6 && p.hp > p.maxhp * 0.7;
}
function duckedNamed() {
  return G.monsters.filter(m => m.named && !m.provoked && !willFight(m));
}
function inLair(x, y, ducked) {
  for (const m of ducked) if (Math.hypot(x - m.x, y - m.y) <= 3.5) return true;
  return false;
}

function routeAvoiding(pred, dodgeTraps, barge) {
  const L = G.level, p = G.player;
  const ducked = barge ? [] : duckedNamed();
  prev.fill(-1);
  const start = idx(p.x, p.y);
  prev[start] = start;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % MW, cy = (cur / MW) | 0;
    if (cur !== start && pred(cx, cy)) {
      const out = [];
      for (let n = cur; n !== start; n = prev[n]) out.push(n);
      return out.reverse();
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const ni = idx(nx, ny);
      if (prev[ni] !== -1 || !walkable(L, nx, ny)) continue;
      /* Furniture is optional content, not floor. A bot that
         paths through barrels breaks every one it passes and
         takes an urn in the face on the way — which measured the
         furniture rather than the game. Route around unless the
         furniture *is* the destination. */
      if (L.tiles[ni] === PROP && !pred(nx, ny)) continue;
      if (L.shopAt.has(ni) && !pred(nx, ny)) continue;
      if (dodgeTraps) { const tr = L.traps.get(ni); if (tr && tr.seen) continue; }
      if (ducked.length && inLair(nx, ny, ducked) && !pred(nx, ny)) continue;
      prev[ni] = cur; q.push(ni);
    }
  }
  return null;
}

/* Town first. The bot used to walk straight down the stairs with
   its starting purse untouched, which meant every number below
   was measured on a hero who had refused to buy a single potion
   — not a difficulty reading, a shopping bug. */
function outfit() {
  /* 「물약을 쥐어 준 것」과 「과업을 넣은 것」 중 무엇이 판을 길게
     만들었는지 가르려면, 쥐어 주지 않은 판도 한 벌 필요하다. 측정용
     스위치이지 기본값이 아니다 — 기본은 언제나 산다. */
  if (process.env.NO_OUTFIT) return;
  const p = G.player;
  for (const shop of [5, 1, 4]) {           // alchemist, general, temple
    const stock = Game.shopStock({ id: shop, stock: shop === 5
      ? ['potHeal','potMana','potCure'] : shop === 1
      ? ['torch','potHeal','scrMap','smoke'] : ['potHeal','potCure'] });
    for (const it of stock) {
      if (it.use === 'heal') while (p.gold > (p.maxmana ? 150 : 70)) Game.buy(it);
      if (it.use === 'mana' && p.maxmana) while (p.gold > 90) Game.buy(it);
      if (it.use === 'torch') while (p.gold > 200) Game.buy(it);
      if (it.use === 'smoke') while (p.gold > 320) Game.buy(it);
    }
  }
}

const SHOUT = !!process.env.SHOUT;

/* 「무언가 일어났는가」의 지문. 화면 · 배낭 · 금화 · 유물 · 재료 —
   목표들이 실제로 바꾸는 것들이다. */
const sig = p => `${G.screen}|${p.pack.length}|${p.gold}|${(p.relics||[]).length}`
  + `|${p.mats ? p.mats.scrap + ':' + p.mats.dust + ':' + p.mats.essence : ''}`
  + `|${G.items.length}`;
const next0 = (path, p) => idx(p.x, p.y);

function runBot(race, cls, clear, opt = {}) {
  /* Runs in one process are not independent unless this is here.
     meta.js keeps its ledger in a module-level cache, and startGame
     turns that ledger into 기억 — +300 gold, +2 on every piece of
     starting gear, every potion pre-identified. So the fortieth run
     of a batch starts richer than the first, and a class measured
     after a long batch reads higher than the same class measured
     first. Caught here by accident: a rogue that spun for 116k
     actions left so much ledger behind that the mage after it read
     8.5층 where a clean run read 6.1. The callers forget() once at
     the top, which is not enough. */
  Meta.forget();
  pressed.clear();
  dead.clear();
  /* `rollStats()` 를 인자 없이 불렀다. CLASS_BAND[undefined] 가 null 이라
     전 스탯이 fair[10,13] 로 굴려졌고, 실제 게임(ui.js 의 rollStats(pick.cls))
     은 prime[14,17]/weak[7,11] 을 굴린다. 즉 이 저장소의 직업 수치는
     전부 **직업이 아닌 것**을 재고 있었다 — 마법사 최대마나 23.7 → 9.9. */
  Game.startGame(race, cls, Game.rollStats(cls));
  outfit();
  /* A bow is a different build, not a better sword, and the
     scorer below ranks weapons by dice — so a bot left to itself
     will never choose one. To measure whether reach helps a
     class, the run has to be able to start committed to it. */
  if (opt.bow) {
    const D = BOWDATA;
    G.player.equip.weapon = { kind:'weapon', ...D.WEAPONS.find(w => w.n === opt.bow) };
    G.player.equip.quiver = Game.makeQuiver('deer');
    Game.recalc(G.player);
  }
  /* Hand the hero its bow but keep a knife on the belt, so the
     run can answer whether the ranger's fall is the lost spell
     list or a kit with nothing to swing when something closes. */
  if (opt.melee) {
    const D = BOWDATA;
    const bow = G.player.equip.weapon;
    G.player.equip.weapon = { kind:'weapon', ...D.WEAPONS[0] };
    if (bow) Game.addItem(G.player, bow, 1);
    Game.recalc(G.player);
  }
  /* 재기 위한 손잡이 하나. 봇은 보통 3~4층에서 죽는데, 「한 판에
     몇 개가 나오는가」를 물으려면 열다섯 층을 걸어 본 판이 있어야
     한다. 체력만 올린다 — 낙하 확률은 손대지 않으므로 층당 비율은
     그대로이고, 다만 층을 더 밟는다. 밸런스를 재는 데는 절대 쓰지 말
     것: 이건 「오래 사는 사람이 무엇을 줍는가」 전용이다. */
  if (opt.tough) {
    G.player.maxhp = Math.round(G.player.maxhp * opt.tough);
    G.player.hp = G.player.maxhp;
    Game.recalc(G.player);
  }
  Game.descend();
  const st = { crits: 0, sneaks: 0, kills: 0, misses: 0, camps: 0, elites: 0, named: 0, shops: 0, broke: 0, events: 0, rolls: 0, branch: {} };
  let path = null, guard = 0, depthAt = G.depth, lastShout = -99, holdUntil = -1;
  const hist = [];
  let traded = false;   // one visit per floor; the bot has no other reason to stop
  /* 이번 층의 모루에서 아무것도 못 샀는가. 못 샀는데 계속 후보로
     두면 봇은 모루와 그 옆칸 사이를 영원히 오간다. */
  let anvilDry = false;
  let screenAt = 'play', screenFor = 0;

  /* ── 제자리걸음 감시 ──────────────────────────────────────
     이 루프는 guard로만 막혀 있었는데, 게임 턴을 소비하지 않는 반복이
     섞여 있다(장비 교체, 해체, 실패하는 행동). 그래서 **죽지 않았는데
     guard가 먼저 닳아 끝나는 판**이 생기고, 그 판의 도달 층이 「거기서
     죽었다」와 똑같이 평균에 섞였다 — 60판에 7판(12%)이었고, 12층까지
     갔다가 멈춘 판도 있었다. 도달 층을 쓰는 벤치 전부가 검열된 표본을
     보고 있었다는 뜻이다.

     턴이 안 흐른 채로 반복이 쌓이면 걸음으로 끊는다. 걸음도 안 먹으면
     그때는 진짜로 갇힌 것이므로 stuck으로 표시하고 나온다 — 조용히
     끝나는 것보다 시끄럽게 끝나는 편이 낫다. */
  const STALL = 40;
  let stallTurn = -1, stalled = 0, jammed = false;
  /* 0보다 크면 이번 반복에서는 기술·주문을 안 쓴다 (라이브락 탈출용). */
  let calm = 0;

  /* ── 걷는 라이브락 ────────────────────────────────────────
     위의 STALL 감시는 **턴이 멈추는** 것만 본다. 그런데 240판에 한 판은
     턴이 멀쩡히 흐르는 채로 갇힌다: 4층에서 59,685턴, 마지막 400턴에
     밟은 칸이 **하나**, 파도 3712번, 몬스터 400마리. 봇은 죽지도
     내려가지도 않고 한 칸에서 영원히 무언가를 한다.

     그런 판은 60000번째 반복에서 조용히 끝나고, 그 도달 층이 「거기서
     죽었다」와 똑같이 평균에 섞인다 — 정직 벤치가 잡으라고 만들어진
     바로 그 오염이다. 층 예산의 스무 배를 한 층에서 쓰면 그것은 판이
     아니다. 시끄럽게 끝낸다. */
  let floorAt = G.depth, floorSince = G.turn;

  while (G.running && guard++ < 60000) {
    if (G.depth !== floorAt) { floorAt = G.depth; floorSince = G.turn; }
    else if (G.turn - floorSince > Game.floorBudget() * 20) { jammed = true; break; }

    if (G.turn === stallTurn) {
      if (++stalled > STALL) {
        /* 아무 방향으로나 한 걸음 — 턴을 흐르게 하는 것이 목적이다. */
        const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
        const d = dirs[stalled % dirs.length];
        const was = G.turn;
        try { Game.step(d[0], d[1]); } catch { /* 화면이 열려 있을 수 있다 */ }
        if (G.turn === was) { try { Game.step(0, 0); } catch { /* 대기도 막혔다 */ } }
        if (G.turn === was) { jammed = true; break; }
        /* 걸음 하나로 턴을 흐르게 하는 것만으로는 모자랐다. 다음
           반복이 같은 가지로 다시 들어가 또 굳으므로, 판은 「턴이
           잠깐 흐르고 다시 멈추는」 것을 수천 번 반복하다 끝난다 —
           실측으로 남은 막힘의 전부가 그 꼴이었다. 그래서 한동안
           기술과 주문을 쉬게 한다: 몇십 번은 그냥 걷는다. 무엇이
           굳었든 그 사이에 상황이 바뀐다. */
        calm = 40;
        stalled = 0;
      }
    } else { stallTurn = G.turn; stalled = 0; }
    /* 판이 도는 동안 바깥에서 들여다볼 수 있는 자리. 규칙 파일에
       탐침용 배열을 심지 않기 위해 여기 둔다 — game.js는 규칙만
       알아야 하고, 무엇을 재고 싶은지는 재는 쪽 사정이다. */
    /* ── 화면에서 못 빠져나오는 판 ────────────────────────
       사건 화면에 갇힌 판을 잡고 나니 제단이 똑같은 짓을 했다
       (마지막 400번의 반복이 전부 `altar`). 화면마다 따로 세는 대신
       한 자리에서 센다: 같은 화면이 스무 번 넘게 붙어 있으면 고른
       것이 화면을 안 닫는 것이고, 그건 그 화면이 이 봇에게는 막다른
       곳이라는 뜻이다. 판으로 돌려보내고 그 칸을 이번 층에서 죽은
       목표로 적는다 — 그 하나를 못 세는 것이, 판 하나를 통째로
       잃고 그 도달 층을 죽은 판들 사이에 섞는 것보다 싸다. */
    /* ── 아르카나는 「닫아 버리는 화면」이 아니다 ────────────
       봇 60판을 굴려 끝에 G.arcana 를 읽었더니 **한 판도 아무것도
       안 들고 있었다.** 위의 화면 탈출기가 아르카나 선택 화면을
       스무 번 만에 그냥 닫아 버렸기 때문이다. 그래서 「아르카나가
       난이도 곡선을 바꾸는가」에는 지금까지 **답이 없었다** — 이
       하네스로는 잰 적이 없다.

       무엇을 고르는지가 아니라 「고른다」가 중요하므로 셋 중 하나를
       무작위로 집는다. 편향된 정책은 나중에 A/B 로 따로 잰다. */
    if (G.screen === 'arcana' && Game.arcanaDue(G.depth)) {
      const off = Game.arcanaOffer();
      if (off.length) { Game.takeArcana(off[Math.floor(Math.random() * off.length)].id); }
      G.screen = 'play'; screenAt = 'play'; screenFor = 0;
    }
    if (G.screen !== 'play') {
      if (G.screen === screenAt) {
        if (++screenFor > 20) {
          if (G.player) dead.add(idx(G.player.x, G.player.y));
          G.screen = 'play'; screenFor = 0;
        }
      } else { screenAt = G.screen; screenFor = 0; }
    } else { screenAt = 'play'; screenFor = 0; }

    if (calm > 0) calm--;
    if (opt.onTurn) opt.onTurn(G);
    if (opt.tough && G.player) G.player.hp = G.player.maxhp;
    for (const e of (G.fx || [])) {
      if (e.t === 'hit' && e.crit) st.crits++;
      if (e.t === 'hit' && e.sneak) st.sneaks++;
      if (e.t === 'miss') st.misses++;
      if (e.t === 'kill') st.kills++;
      if (e.t === 'drop') st.named++;
      if (e.t === 'quarry') { st.quarry = (st.quarry||0)+1; st.quarryHp = (st.quarryHp||0)+(e.hp||0); }
    }
    if (G.fx) G.fx.length = 0;

    const p = G.player;
    /* A rolling window of health, so a run can say afterwards
       whether it was worn down or removed. A class that dies at
       four floors from full health needs a different patch than
       one that dies at four floors having been at a third of its
       health for the last twenty turns. */
    hist.push(p.hp / Math.max(1, p.maxhp));
    if (hist.length > 12) hist.shift();
    if (p.hp < p.maxhp * 0.4) {
      const i = p.pack.findIndex(s => s.item.use === 'heal' || s.item.use === 'bigHeal');
      if (i >= 0) { Game.useItem(i); continue; }
    }
    /* The way out. Every class dies with one or two things in its
       face, so the policy is the shape of that death: hurt, and
       crowded, and no potion left to answer it. A bot that never
       reaches for the smoke measures a game without one. */
    if (p.hp < p.maxhp * 0.42) {
      const crowd = G.monsters.filter(m => !m.disguise && m.awake
        && Math.abs(m.x - p.x) <= 1 && Math.abs(m.y - p.y) <= 1).length;
      if (crowd >= 2 || (crowd >= 1 && p.hp < p.maxhp * 0.22)) {
        const i = p.pack.findIndex(s => s.item.id === 'smoke');
        if (i >= 0) { Game.useItem(i); continue; }
      }
    }
    /* Casters. Without this the bot plays a priest as a warrior
       with a bad sword, and the class numbers mean nothing. */
    /* Casting, played the way a caster is meant to be played:
       heal when hurt, blast at range, freeze when surrounded,
       bless before a hard fight, blink out of a corner. Without
       this the class numbers measured a bot that could not use
       half of what its class is. */
    /* The arts. A warrior that never uses them measures a warrior
       that does not have them — the same hole the spell policy was
       written to close, and the third time this session that a
       missing bot policy nearly got read as a game problem.

       Deliberately simple and in the order the arts answer: keep
       the stance up when it will be hit, sweep when a sweep beats
       a swing, finish what is nearly finished, and shove to make
       room when there is no room. */
    const arts = Game.artList(p);
    if (arts.length && !calm) {
      const art = id => arts.find(a => a.id === id);
      // Never try an art the hero cannot actually take: a
      // refused art costs no turn, and the loop below would spin.
      const can = a => a && p.stam >= a.stam && !p.ail?.paralyze && !(p.stuck > 0);
      const adjA = Game.adjacent ? Game.adjacent(p) : G.monsters.filter(m =>
        !m.disguise && Math.abs(m.x - p.x) <= 1 && Math.abs(m.y - p.y) <= 1);
      const shooters = G.monsters.filter(m =>
        !m.disguise && m.awake && G.level.vis[idx(m.x, m.y)]
        && (m.ai === 'ranged' || m.casts?.length)
        && Math.hypot(m.x - p.x, m.y - p.y) <= 7);

      /* ── 한계돌파 셋 ────────────────────────────────────
         이 하네스에 brace·kite·bulwark 라는 문자열이 **하나도 없었다**
         (vanish·martyr·crusade·volley 는 있는데). 그래서 「직업마다
         하나씩, 위험한 순간에 판을 바꾸는 것」이 판에 얹혀 무슨 값을
         하는지 아무도 잰 적이 없다.

         셋 다 「위험한 순간」이 조건이므로 정책도 그렇게 쓴다: 도망칠
         수 없을 만큼 붙었고(brace), 붙었는데 활이고(kite), 다음 한
         대에 죽을 때(bulwark). 마무리·밀치기보다 **먼저** 본다 —
         나중에 두면 그 둘이 먼저 걸려서 영영 안 눌린다. */
      const brace = art('brace');
      if (can(brace) && !(p.brace > 0) && adjA.length >= 2 && p.hp < p.maxhp * 0.55)
        { useArtCounted('brace'); continue; }

      /* 버티기 is gone — it was the standing-still verb, and the
         measurement that killed it came from this harness: 12판에
         버티기 296 · 휩쓸기 83 · 마무리 72 · 밀치기 3. 연타 is the
         same slot spent forwards, so the policy is the burst
         question: one thing in front, worth the pool, and enough
         breath to finish the chain. */
      const flurry = art('flurry');
      if (can(flurry) && adjA.length === 1 && p.stam >= 4
          && adjA[0].hp > adjA[0].maxhp * 0.35)
        { useArtCounted('flurry'); continue; }

      const cleave = art('cleave');
      if (can(cleave) && adjA.length >= 2) { useArtCounted('cleave'); continue; }

      const fin = art('finisher');
      if (can(fin) && adjA.some(m => m.hp < m.maxhp * 0.45)) { useArtCounted('finisher'); continue; }

      // Cornered: buy a tile. Only worth stamina when it is bad.
      const shove = art('shove');
      if (can(shove) && adjA.length >= 3 && p.hp < p.maxhp * 0.5)
        { useArtCounted('shove'); continue; }

      /* Paladin. The class accelerates on kills, so the policy is
         written to spend rather than to hoard: sweep a crowd
         (which pays itself back), march when the room is already
         down, drive the biggest thing, and close on anything that
         will not come to him. */
      const canSwear = a => a && (p.oath || 0) >= (a.oath || 0)
        && !p.ail?.paralyze && !(p.stuck > 0);
      const seenP = G.monsters.filter(m =>
        !m.disguise && m.awake && G.level.vis[idx(m.x, m.y)]);

      /* 불굴은 이제 맹세를 안 먹고 **층에 한 번**이다 — 지갑이 아니라
         횟수가 값이라, canSwear 로 막으면 안 된다(그러면 이 자는
         고치기 전 규칙을 계속 잰다). */
      const bulwark = art('bulwark');
      if (bulwark && !(p.bulwark > 0) && !(G.floorArts || {}).bulwark
          && !p.ail?.paralyze && !(p.stuck > 0)
          && p.hp < p.maxhp * 0.45 && adjA.length >= 1)
        { useArtCounted('bulwark'); continue; }

      const crusade = art('crusade');
      if (canSwear(crusade)
          && seenP.filter(m => m.hp < m.maxhp * 0.4).length >= 2)
        { useArtCounted('crusade'); continue; }

      const storm = art('storm');
      if (canSwear(storm) && adjA.length >= 2) { useArtCounted('storm'); continue; }

      const judgest = art('judgest');
      if (canSwear(judgest)
          && adjA.some(m => m.maxhp >= p.maxhp * 0.9 || m.named || (m.ac || 0) >= 14))
        { useArtCounted('judgest'); continue; }

      // only worth breath when something is out of reach and coming
      const charge = art('charge');
      if (canSwear(charge) && !adjA.length
          && seenP.some(m => Math.hypot(m.x - p.x, m.y - p.y) <= 4.2))
        { useArtCounted('charge'); continue; }

      /* Ranger. Every one of its arts is an answer to distance, so
         the policy is written in distance: shoot the far thing with
         the shot that gets better far away, take the line when there
         is a line, rain when the room is the problem, and drop the
         trap only when something is already on you. */
      const canShot = a => can(a);
      const seen = G.monsters.filter(m =>
        !m.disguise && m.awake && G.level.vis[idx(m.x, m.y)]);
      const far = Game.canShoot() ? Game.shotTarget() : null;
      const dist = far ? Math.hypot(far.x - p.x, far.y - p.y) : 0;

      // All three flying arts refuse without a bow and a clear
      // line, and a refused art costs no turn — so gate every one
      // of them on `far`, or the loop spins.
      const volley = art('volley');
      if (canShot(volley) && far && seen.length >= 4) { useArtCounted('volley'); continue; }

      // A line is worth 3 arrows' damage for one. Count what shares
      // the target's row, column, or diagonal on the far side.
      const pierce = art('pierce');
      if (canShot(pierce) && far) {
        const dx = Math.sign(far.x - p.x), dy = Math.sign(far.y - p.y);
        const online = m => {
          const ox = m.x - p.x, oy = m.y - p.y;
          if (dx && dy) return Math.abs(ox) === Math.abs(oy)
            && Math.sign(ox) === dx && Math.sign(oy) === dy;
          if (dx) return oy === 0 && Math.sign(ox) === dx;
          return ox === 0 && Math.sign(oy) === dy;
        };
        if (seen.filter(online).length >= 2) { useArtCounted('pierce'); continue; }
      }

      /* 궁수의 한계돌파. 활은 붙으면 막대기라, 「붙었다」가 조건이다 —
         조준·관통보다 먼저 본다(저 둘은 거리가 있을 때 걸린다). */
      const kite = art('kite');
      if (can(kite) && adjA.length >= 1 && p.hp < p.maxhp * 0.6)
        { useArtCounted('kite'); continue; }

      const aimed = art('aimed');
      if (canShot(aimed) && far && dist > 2.2) { useArtCounted('aimed'); continue; }

      // The trap is only worth a turn if something is chasing and
      // the hero is about to leave the tile anyway.
      const snare = art('snare');
      if (can(snare) && adjA.length >= 1 && p.hp < p.maxhp * 0.45)
        { useArtCounted('snare'); continue; }

      /* Priest. Faith is not stamina — it does not tick back, so
         the policy spends it only where the art is the whole answer.
         A bot that never spends it measures the old priest. */
      const canPray = a => a && (p.faith || 0) >= (a.faith || 0)
        && !p.ail?.paralyze && !(p.stuck > 0);
      const dead = seen.filter(m => BOWDATA.UNDEAD.includes(m.spr));

      /* ── 사제의 넷 ─────────────────────────────────────
         넷 다 「맞은 것을 무엇으로 바꿀까」다. 정책도 그렇게 쓴다:
         많이 맞았으면 되갚고, 몰렸으면 멈춰 세우고, 붐비는 곳에
         성흔을 새기고, 죽기 직전에 순교한다. 예전 정책은 성역을
         315회 누르고 심판·순교를 0회 눌렀다 — 그건 정책이 아니라
         한 버튼이었다. */
      const martyr = art('martyr');
      if (canPray(martyr) && !(p.martyr > 0)
          && p.hp < p.maxhp * 0.3 && adjA.length >= 1)
        { useArtCounted('martyr'); continue; }

      const repay = art('repay');
      if (canPray(repay) && adjA.length && (p.tookPool || 0) >= p.maxhp * 0.35)
        { useArtCounted('repay'); continue; }

      const word = art('word');
      if (canPray(word) && adjA.length >= 2 && p.hp < p.maxhp * 0.6)
        { useArtCounted('word'); continue; }

      const stigma = art('stigma');
      if (canPray(stigma) && seen.length >= 3
          && !G.monsters.some(m => m.stigma > 0))
        { useArtCounted('stigma'); continue; }

      /* 성역·파문·심판이 여기 있었다. 셋 다 없어졌다 —
         「원 안에 서기」와 「지목만 하기」는 사제의 자원(맞은 것)과
         아무 관계가 없었고, 심판은 언데드 전용이라 20판에 0회였다. */

      /* Rogue. 그림자 is ammunition gathered by not being seen, and
         four arts burn it. Priority: get out from under a pack,
         finish what is nearly done, delete an archer's distance,
         thin a crowd. */
      if (p.cls === 'rogue') {
        const shade = p.shadow || 0;
        const canHide = a => a && shade >= (a.shade || 0) && p.stam >= (a.stam || 0) && a.lv <= p.lv;
        /* 어둠 되감기 refuses when nothing awake can actually see
           you, and a refusal costs no turn — so a policy that asks
           for it on the wrong reading of the room loops forever.
           Measured here first: vanish 116,073 presses in 8 runs.
           The predicate has to be the one the rules use, not a
           near-miss of it: 붙어 있는 것 ≠ 너를 보고 있는 것. A boss
           is excluded on both sides — it never loses you. */
        const watchers = seen.filter(m => m.awake && !m.boss
                                       && !(m.named && m.provoked));
        const vanish = art('vanish');
        if (canHide(vanish) && watchers.length && adjA.length >= 2
            && p.hp < p.maxhp * 0.65)
          { useArtCounted('vanish'); continue; }
        const vitals = art('vitals');
        if (canHide(vitals) && adjA.length && adjA.some(m => m.hp > m.maxhp * 0.4))
          { useArtCounted('vitals'); continue; }
        const fan = art('fan');
        if (canHide(fan) && seen.length >= 3) { useArtCounted('fan'); continue; }
        const step = art('shadowstep');
        if (canHide(step) && !adjA.length && seen.length)
          { useArtCounted('shadowstep'); continue; }
      }
    }

    /* An offer underfoot waits for a press now instead of throwing
       its screen up on arrival, so the bot has to reach for it.
       Without this it walks over every fire, altar and anvil in
       the dungeon and measures a game with no furniture.

       Once each, though. A fire that is walked away from stays a
       fire, so a bot that presses whatever is underfoot presses it
       again the instant the screen closes — and never takes
       another step. Measured: every class fell to floor 1.1 until
       this set existed. The turn-free refusal loop again, this
       time built by the probe rather than found by it. */
    if (Game.hereOffer) {
      const off = Game.hereOffer();
      const key = idx(p.x, p.y) + ':' + G.depth;
      if (off && !pressed.has(key)) { pressed.add(key); Game.openHere(); continue; }
    }

    /* 소란을 살 것인가. 이 정책이 있어야 ①(선택에 의한 밀도)을
       잴 수 있다 — 봇이 외칠 줄 모르면 「불러 모으는 판」이 한 번도
       측정되지 않는다. SHOUT=1로 켠다.

       사람처럼 고른다: 체력이 넉넉하고, 숨이 붙어 있고, 지금 주위가
       한산할 때만. 이미 둘러싸였는데 더 부르는 것은 결정이 아니라
       자살이다. */
    if (SHOUT && Game.shout && G.depth > 0
        && G.turn - (lastShout || -99) > 60      // 도배하지 않는다: 판당 2천 번은 정책이 아니다
        && p.hp > p.maxhp * 0.72 && p.stam >= 3
        && !G.monsters.some(m => Math.max(Math.abs(m.x-p.x), Math.abs(m.y-p.y)) <= 1)
        && G.monsters.filter(m => m.awake
             && Math.hypot(m.x - p.x, m.y - p.y) <= 7).length < 2
        && (G.uproar || 0) < 6) {
      /* 부르고 도망치면 밀도를 산 것이 아니다. 첫 측정이 정확히
         그렇게 나왔다 — 외침을 켰더니 싸움이 17%에서 10%로 떨어졌다.
         봇이 외쳐 놓고 그대로 걸어가 버렸기 때문이다. 불렀으면
         버텨야 그 판이 「불러 모아 싸운 판」이 된다. */
      if (Game.shout()) { lastShout = G.turn; holdUntil = G.turn + 30; continue; }
    }

    /* 부른 뒤에는 버틴다. 다가오는 것을 맞이하는 것이 이 선택의
       나머지 절반이다. */
    if (SHOUT && G.turn < holdUntil) {
      const seen = G.monsters.filter(m => m.awake && G.level.vis[idx(m.x, m.y)]);
      if (!seen.length && p.hp > p.maxhp * 0.4) { path = null; Game.step(0, 0); continue; }
    }

    /* Loose an arrow rather than walk into a fight you could have
       finished from here. Only past arm's length — a bow up close
       is half a blow, so stepping back and shooting is the whole
       point of carrying one. */
    if (Game.canShoot()) {
      const t = Game.shotTarget();
      if (t && Math.hypot(t.x - p.x, t.y - p.y) > 1.6) { Game.shoot(); continue; }
      /* 붙었을 때도 쏜다 — 레인저에 한해서. 이제 붙은 것에게 쏘면
         한 발 물러나므로, 그것이 이 직업이 거리를 **만드는** 유일한
         수다. 규칙에 붙여 놓고 봇 정책을 안 고치면, 재는 것은
         새 규칙이 아니라 옛 습관이다 — 처음 재고 「4.8 → 4.7,
         효과 없음」이라고 적을 뻔했다. */
      if (t && p.cls === 'ranger') { Game.shoot(); continue; }
    }

    const spells = Game.spellList(p);
    if (spells.length && p.mana > 0 && !calm) {
      const has = id => spells.find(sp => sp.id === id);
      const afford = sp => sp && p.mana >= Game.spellCost(p, sp);
      const visible = G.monsters.filter(m => G.level.vis[idx(m.x, m.y)] && !m.disguise);
      const adj = visible.filter(m => Math.hypot(m.x - p.x, m.y - p.y) < 1.6);
      const far = visible.filter(m => Math.hypot(m.x - p.x, m.y - p.y) > 1.5);

      const heal = has('heal') || has('cure');
      if (afford(heal) && p.hp < p.maxhp * 0.55) { Game.cast(heal.id); continue; }

      // Surrounded is what 서리 폭발 is for.
      const frost = has('frost');
      if (afford(frost) && adj.length >= 2) { Game.cast(frost.id); continue; }

      // Cornered and hurt: leave.
      const blink = has('blink');
      if (afford(blink) && adj.length >= 2 && p.hp < p.maxhp * 0.35) { Game.cast(blink.id); continue; }

      // Buff before committing to something big.
      const bless = has('bless');
      if (afford(bless) && !p.blessed && (adj.length || far.length >= 2)) { Game.cast(bless.id); continue; }

      /* 잔향 (마법사). A spell leaves an afterimage that changes
         the next one, so the caster plays sentences: set one up
         when it is cold, cash it in when it is warm. A policy that
         ignores 잔향 measures the old class with the new code. */
      const echo = Game.liveEcho ? Game.liveEcho(p) : null;
      if (echo && visible.length) {
        const bolt = has('bolt'), fr = has('frost');
        if (echo.id === 'reach' && afford(fr)) { castCounted('주문:서리+지형', fr.id); continue; }
        if (afford(bolt)) { DRY.cast++; castCounted(`주문:화살+${echo.n}`, bolt.id); continue; }
      }
      const detect = has('detect');
      if (p.cls === 'mage' && !echo && afford(detect) && visible.length >= 3
          && p.mana > (detect.cost || 3) * 2) { castCounted('주문:탐지', detect.id); continue; }

      const nuke = has('smite') || has('bolt');
      if (afford(nuke) && far.length) { DRY.cast++; Game.cast(nuke.id); continue; }
      if (visible.length && nuke && !afford(nuke)) DRY.dry++;
    }
    /* The quiver is the other half of a bow now, so the shop
       policy is an upgrade policy rather than a supply run: buy
       the best head the purse can carry, once. */
    if (p.equip.weapon?.t === 'bow' && G.screen === 'shop') {
      const stock = Game.shopStock(G.shop || {});
      const best = stock.filter(x => x.kind === 'quiver' && p.gold >= x.cost)
        .sort((a, b) => (b.dmg || 1) - (a.dmg || 1))[0];
      if (best && (best.dmg || 1) > (Game.quiver(p)?.dmg || 0)) Game.buy(best);
    }
    // Casters drink mana the way fighters drink health.
    if (p.maxmana && p.mana < p.maxmana * 0.25) {
      const i = p.pack.findIndex(sl => sl.item.use === 'mana');
      if (i >= 0) { Game.useItem(i); continue; }
    }

    if (p.lightTurns < 150) {
      const i = p.pack.findIndex(s => s.item.use === 'torch');
      if (i >= 0) { Game.useItem(i); continue; }
    }

    if (G.depth !== depthAt) { depthAt = G.depth; path = null; traded = false; anvilDry = false; dead.clear(); }

    /* The fire is the body and the relics now. Cash the wager if
       there is one, otherwise rest — the bot does not gamble on
       fusion, so these numbers stay a floor. */
    /* 불이 셋 중 하나만 주게 된 뒤로 여기가 실제 결정이 되었다.
       봇의 정책은 「지금 죽는 것 > 곧 어두워지는 것 > 천장이 깎인
       것」 순이다 — 죽으면 나머지가 의미 없고, 불이 꺼지면 예고를
       못 읽어 큰 한 방을 맞는다(어두울 때 32.1 대 밝을 때 15.4).
       상처는 셋 중 가장 느리게 무는 것이라 마지막이다.
       지짐은 체력을 8% 가져가므로 성한 몸일 때만 고른다 —
       안 그러면 상처를 닫으려다 죽는다. */
    if (G.screen === 'camp') {
      const purse = Game.bankPurse2();
      const hurt = p.hp < p.maxhp * 0.55;
      const dim  = p.lightTurns < 260;
      const cut  = (p.wound || 0) > 0 && p.lightTurns >= Game.WOUND_OIL
                   && p.hp > p.maxhp * 0.75;
      if (purse && p.hp > p.maxhp * 0.7) Game.campCash();
      else if (hurt) Game.campRest();
      else if (dim) Game.campWick();
      else if (cut) Game.campSear();
      /* 마지막 칸이 무조건 「숨」이면 성한 몸으로 앉았을 때 회복이 0이
         된다 — 장부에서 앉기의 33%가 아무 값도 못 사고 있었다. 살
         자리가 없으면 기름을 산다. 기름도 가득이면 그때는 정말로
         아무것도 없는 것이고, 그건 불의 잘못이 아니다. */
      else if (p.hp < p.maxhp) Game.campRest();
      else if (p.lightTurns < Game.oilCap() - 40) Game.campWick();
      else Game.campRest();
      st.camps++;
      continue;
    }

    /* The anvil does not run out, so the bot hammers until it
       cannot pay — which is exactly the behaviour the place was
       built to allow. It pays for 신중 whenever a miss would cost
       more than the materials and it can afford the doubled bill. */
    if (G.screen === 'anvil') {
      let hits = 0, enchanted = 0;
      for (;;) {
        /* `.find` always returned the first affordable target, and
           campTargets lists weapon before armour — so the bot hammered
           the weapon and never touched the plate. Measured, that put
           weapons at +3 in 47.8% of runs and armour in 7.8%, which made
           every armour-engraving number a statement about this loop
           rather than about the game. Spread the strikes the way a
           player who wants the +3 engraving on both would. */
        const t = Game.campTargets()
          .filter(x => !x.capped && Game.canAfford(Game.upgradeCostFor(x.key)))
          .sort((a, b) => (a.plus || 0) - (b.plus || 0))[0];
        if (!t || hits >= 12) break;
        const bet = Game.upgradeOddsFor(t.key, false);
        const careful = (bet.down || bet.breakPct)
          && Game.canAfford(Game.upgradeCostFor(t.key, true));
        // Stop before the strike that can shatter unless it can
        // buy the safe version — a broken weapon ends the run.
        if (bet.breakPct && !careful) break;
        Game.anvilStrike(t.key, !!careful);
        hits++;
      }
      /* The bot never enchanted, so the whole spell-affix table
         and every rule that reads it measured zero by
         construction. A caster with spare materials buys one
         property per unenchanted spell, which is what the anvil
         is there for. */
      if ((G.player.maxmana || 0) > 0) {
        for (let e = 0; e < 4; e++) {
          const sp = Game.campTargets().find(x =>
            x.kind === 'spell' && !G.player.spellAffix?.[x.key.slice(3)]);
          if (!sp || !Game.canAfford(ENCHANT_COST)) break;
          Game.anvilEnchant(sp.key, false, null);
          enchanted++; st.enchants = (st.enchants || 0) + 1;
        }
      }
      /* 융합이 모루로 왔다. 봇이 조합을 한 번도 안 하면 「짝을 들고도
         못 한다」가 고쳐졌는지 잴 수가 없다 — 넣을 수 있으면 넣는다.
         무엇이 나올지는 안 보고 고른다: 그게 이 화면의 성격이다. */
      for (let f = 0; f < 3; f++) {
        const rel = (p.relics || []);
        if (rel.length < 2 || !Game.canAfford(BOWDATA.FUSE_COST)) break;   // 값은 융합의 값으로 물어야 한다
        let pair = null;
        for (let x = 0; x < rel.length && !pair; x++)
          for (let y = x + 1; y < rel.length && !pair; y++)
            if (BOWDATA.fusionOf(rel[x], rel[y])) pair = [rel[x], rel[y]];
        const two = pair || [rel[0], rel[1]];
        const before = rel.length;
        Game.fuseRelics(two[0], two[1]);
        if ((p.relics || []).length >= before) break;   // 못 넣었다
        st.fusions = (st.fusions || 0) + 1;
      }
      st.anvils = (st.anvils || 0) + 1;
      /* ── 걷는 라이브락의 정체 ──────────────────────────────
         모루는 닳지 않는다. 그래서 봇의 경로 목록에서 모루는 **재료가
         있는 한 언제나 살아 있는 목표**인데, 실제로 두들길 수 있는
         것이 없으면(전부 상한이거나, 다음 한 방이 부술 수 있는데
         신중을 못 사거나) 이 루프는 한 번도 안 돌고 빠져나온다.
         그러면 봇은 모루에서 내려와 다시 모루로 걸어간다 — 영원히.
         240판에 한 판이 4층에서 59,685턴을 그렇게 썼다.

         이번 층에서 아무것도 못 산 모루는 이번 층에서는 끝난 것으로
         친다. 다음 층의 모루는 다시 후보다 — 그때는 재료도 +도
         달라져 있다. */
      /* 이번 **방문**에서 아무것도 못 샀는가를 물어야 한다. 처음에는
         판 전체의 인챈트 수를 봤는데, 그러면 판 초반에 한 번 걸고 나면
         이 깃발이 영영 안 선다 — 잡으려던 그 판이 정확히 그런 판이다. */
      if (hits === 0 && enchanted === 0) anvilDry = true;
      G.screen = 'play';
      continue;
    }

    /* The fork. The bot plays it the way a cautious human would:
       take the relic branch when healthy enough to survive it,
       otherwise the quiet one, otherwise plain. It never gambles
       on 무너지는 층, so these numbers stay a floor. */
    if (G.screen === 'stairs') {
      const opts = G.pendingBranch || [];
      const want = (p.hp > p.maxhp * 0.7 && opts.find(b => b.relic))
                || (p.hp < p.maxhp * 0.4 && opts.find(b => b.id === 'hush'))
                || opts.find(b => b.id === 'hoard')
                || opts[0];
      st.branch[want.id] = (st.branch[want.id] || 0) + 1;
      Game.chooseBranch(want.id);
      continue;
    }

    // A full hand: drop the oldest rather than refuse the new.
    if (G.screen === 'relic') { Game.swapRelic(0); continue; }

    /* The ? room. The bot takes the first affordable option,
       which is a deliberately dumb policy — it means the event
       numbers below are what a player gets for *not* reading. */
    if (G.screen === 'event') {
      /* 사건 화면에서 못 빠져나오는 판이 있었다 — 마지막 400번의
         반복이 전부 `event`였다. 고른 것이 화면을 안 닫으면 봇은
         같은 화면을 영원히 고른다. 몇 번 눌러 보고 안 되면 접는다:
         재는 쪽이 갇히는 것보다 그 사건 하나를 안 세는 편이 낫다. */
      const offer = Game.eventOffer();
      /* Random among the affordable ones, not the first. Option #1
         is usually the greedy one, and always taking it measured a
         player nobody is. */
      const usable = offer ? offer.opts.filter(o => o.can) : [];
      const pick = usable.length ? usable[Math.floor(Math.random() * usable.length)] : null;
      if (pick) { Game.eventChoose(pick.i); st.events++; }
      else G.screen = 'play';
      continue;
    }
    if (G.screen === 'shop') {
      const shop = G.shop;
      for (let k = p.pack.length - 1; k >= 0; k--)
        if (Game.canSalvage(p.pack[k].item)) Game.sell(k);
      for (const it of Game.shopStock(shop))
        while (it.use === 'heal' && p.gold > 400) Game.buy(it);
      G.screen = 'play';
      traded = true;
      path = null;
      st.shops++;
      continue;
    }

    /* Arm up first, break down second. The bot used to salvage
       every weapon it found, which was harmless while nothing
       could take a weapon *away* — once the anvil could shatter
       one, an unarmed bot sat on a floor punching until the turn
       cap, and the wave counter went to four figures. */
    const score = it => it.kind === 'weapon'
      ? it.dice[0] * (it.dice[1] + 1) / 2 + (it.plus || 0) * 2
      : it.ac + (it.plus || 0) * 2;
    const better = p.pack.findIndex(sl => {
      const it = sl.item;
      if (it.kind !== 'weapon' && it.kind !== 'armour') return false;
      // A shield under a two-hander is refused by the rules and
      // would spin here forever: the slot stays empty, so the
      // shield keeps looking like an upgrade.
      if (it.slot === 'shield' && p.equip.weapon?.hands === 2) return false;
      const worn = it.kind === 'weapon' ? p.equip.weapon : p.equip[it.slot];
      // Holding a bow is a commitment; swapping to
      // a marginally larger die throws the whole build away.
      if (it.kind === 'weapon' && worn?.t === 'bow' && it.t !== 'bow') return false;
      /* 이 손에 안 들리는 물건은 영영 「더 좋은 것」으로 보인다 —
         equip 이 거절하면서 턴도 안 쓰므로 위 while 이 여기서 돈다.
         방패 줄과 똑같은 사고이고, 그래서 판정은 게임의 문을 쓴다. */
      if (Game.cantHold(p, it)) return false;
      return !worn || score(it) > score(worn);
    });
    if (better >= 0) { Game.equip(better); continue; }

    /* 남는 **장비**를 부순다 — 주석은 처음부터 그렇게 적혀 있었는데
       코드는 아니었다. `canSalvage`는 소모품(`use`)과 촉매(`cat`)에도
       참이라, 봇이 방금 산 치유 물약과 횃불까지 전부 쇳조각 1로 갈아
       넣고 있었다. 실측 로그:

         it 1  turn 0  물약 10  "치유의 물약을 샀다. (-28)"
         it 2  turn 0  물약  9  "치유의 물약을 부쉈다 — 쇳조각 1."
         ...
         it 11 turn 0  물약  0  "횃불을 부쉈다 — 쇳조각 1."
         it 15 turn 3  물약  0  ← 1층 진입

       이 하네스의 **모든 판**이 물약 0개·횃불 0개로 1층에 내려갔다는
       뜻이다. 라이브락과 같은 급의 검열이고 라이브락보다 조용하다 —
       막힘 카운터에 안 잡힌다. 기름이 안 문다던 측정도, 직업 순위도,
       회복률도 전부 이 위에서 잰 값이었다. */
    const junk = p.pack.findIndex(sl => {
      const it = sl.item;
      return Game.canSalvage(it) && it.kind !== 'use' && it.kind !== 'cat';
    });
    if (junk >= 0) { Game.salvage(junk); st.broke++; continue; }

    /* Marked ground is the one thing that must beat everything
       else on the list: standing in it to finish a swing is how
       a run ends. Walk out if a step does it, roll if it does
       not — which is what the roll is for. */
    if (Game.hazardAt(p.x, p.y)) {
      const out = DIRS.filter(([dx, dy]) =>
        walkable(G.level, p.x + dx, p.y + dy)
        && !Game.monsterAt(p.x + dx, p.y + dy)
        && !Game.hazardAt(p.x + dx, p.y + dy));
      if (out.length) { path = null; Game.step(out[0][0], out[0][1]); continue; }
      /* A roll needs the tile it passes *through*, not only the
         one it lands on — and dodgeRoll spends no turn when it
         fails, so a policy that assumes it worked spins forever. */
      const far = DIRS.find(([dx, dy]) =>
        walkable(G.level, p.x + dx, p.y + dy) && !Game.monsterAt(p.x + dx, p.y + dy)
        && !Game.hazardAt(p.x + dx * 2, p.y + dy * 2));
      if (far && Game.canRoll() && Game.dodgeRoll(far[0], far[1])) { path = null; st.rolls++; continue; }
    }

    /* Adjacent monster? Swing — unless it is winding up and we
       are too hurt to eat the blow, in which case step out of
       reach and make it start over. That is the whole point of
       the telegraph, and a bot that ignores it measures a game
       nobody is playing. */
    let hit = null, wind = null;
    for (const [dx, dy] of DIRS) {
      const m = Game.monsterAt(p.x + dx, p.y + dy);
      if (!m) continue;
      if (m.named && !m.provoked && !willFight(m)) continue;   // walked past on purpose
      if (m.intent === 'heavy') wind = [dx, dy];
      if (!hit) hit = [dx, dy];
    }
    if (wind && p.hp < p.maxhp * 0.55) {
      const away = DIRS.find(([dx, dy]) =>
        !Game.monsterAt(p.x + dx, p.y + dy)
        && walkable(G.level, p.x + dx, p.y + dy)
        && Math.hypot(p.x + dx - (p.x + wind[0]), p.y + dy - (p.y + wind[1])) > 1.5);
      // Rolling out beats stepping out: two tiles and the blow
      // whiffs even if it lands anyway.
      if (away && Game.canRoll() && Game.dodgeRoll(away[0], away[1])) { path = null; st.rolls++; continue; }
      if (away) { path = null; Game.step(away[0], away[1]); continue; }
    }
    /* ── 습격이 시작되면 정리를 포기하고 계단으로 ────────────
       봇은 이미 압박 아래에서 「몬스터를 찾아가는」 경로를 끊는데,
       그 위의 이 줄이 **인접한 것이 있으면 무조건 때린다**였다.
       층이 파도로 계속 채워지면 인접한 것이 영원히 있으므로 봇은
       영원히 싸운다 — 240판에 한 판이 4층에서 59,685턴을 그렇게
       썼고(파도 3712번), 그 판의 도달 층이 「거기서 죽었다」와 같이
       평균에 섞였다.

       조작법은 이 상황의 정답을 이미 적어 놨다: 「습격이 시작되면
       정리를 포기하고 계단으로 가는 것이 정답」. 그러니 압박 아래
       에서는 **길을 막고 선 것만** 때리고 나머지는 지나친다.
       체력이 얕으면 예외 — 등을 보이는 것이 더 비싸다. */
    const hit0 = hit;
    if (hit && Game.pressureLevel() > 0 && p.hp > p.maxhp * 0.45) {
      const nx = path?.length ? path[0] % MW : null;
      const ny = path?.length ? (path[0] / MW) | 0 : null;
      const blocking = nx !== null
        && Math.abs(p.x + hit[0] - nx) === 0 && Math.abs(p.y + hit[1] - ny) === 0;
      if (!blocking) hit = null;
    }
    if (hit) { path = null; Game.step(hit[0], hit[1]); continue; }

    if (!path || !path.length) {
      const holding = clear && !Game.pressureLevel();
      /* ── 습격 아래에서는 줍는 것도 그만둔다 ────────────────
         압박이 시작되면 몬스터를 **찾아가는** 것은 이미 그만뒀는데,
         유물 · 수레 · 모닥불 · 모루 · 사건은 그대로 후보로 남아
         있었다. 파도는 죽을 때마다 전리품을 떨구므로 그 목록이 절대
         비지 않는다 — 봇은 떨어진 것을 주우러 가고, 그 사이에 또
         떨어지고, 층을 영원히 돈다. 실측: 층 예산의 스무 배를 한 층에
         쓴 판이 200판에 16판이었고 전부 이 꼴이었다.
         조작법이 적어 둔 정답은 하나다 — 계단으로 간다. */
      const fleeing = Game.pressureLevel() > 0;
      path = fleeing ? route((x, y) => G.level.tiles[idx(x, y)] === DOWN) : null;
      if (!path) path = (holding && G.monsters.length
              ? route((x, y) => { const m = Game.monsterAt(x, y);
                                  return m && !(m.named && !m.provoked && !willFight(m)); }) : null)
          || route((x, y) => G.items.some(i => i.kind === 'relic' && i.x === x && i.y === y))
          || (traded ? null : route((x, y) => G.level.shopAt.get(idx(x, y)) === 7))
          || route((x, y) => G.level.tiles[idx(x, y)] === CAMP)
          // The anvil is worth a detour whenever there is anything
          // to spend. Without this the bot only ever stood on one
          // by accident and the whole economy read as unused.
          || (!anvilDry && Game.canAfford({ scrap: 6, gold: 140 })
              ? route((x, y) => G.level.tiles[idx(x, y)] === ANVIL) : null)
          || route((x, y) => G.level.tiles[idx(x, y)] === 14)
          || route((x, y) => G.level.tiles[idx(x, y)] === DOWN);
      if (!path) {
        if (G.level.tiles[idx(p.x, p.y)] === DOWN) { Game.descend(); continue; }
        Game.step(0, 0); continue;
      }
    }

    /* 목표에 도착하기 직전의 상태를 적어 둔다. 도착한 다음 턴에
       이것들이 하나도 안 변했으면 헛걸음이다. */
    const goal = path.length ? path[path.length - 1] : next0(path, p);
    const before = sig(p);

    const next = path.shift();
    const nx = next % MW, ny = (next / MW) | 0;
    const turnWas = G.turn;
    Game.step(Math.sign(nx - p.x), Math.sign(ny - p.y));
    if (p.x !== nx || p.y !== ny) path = null;   // blocked, re-plan next tick
    /* 걸음이 턴을 안 먹었다면 그 칸으로는 갈 수가 없는 것이다(문틀에
       낀 대각선, 거절당한 자리). 경로만 지우면 다음 반복이 같은 경로를
       다시 세워 같은 걸음을 시도한다 — 턴이 안 흐르는 채로. 실제로
       습격 아래에서 옆의 것을 지나치기로 한 판들이 여기서 굳었다.
       옆에 것이 있으면 때리고(그것이 길을 막고 있었다), 없으면 그
       칸을 이번 층에서 지운다. 어느 쪽이든 턴은 흐른다. */
    if (G.turn === turnWas) {
      if (hit0) { path = null; Game.step(hit0[0], hit0[1]); continue; }
      dead.add(next); path = null; Game.step(0, 0); continue;
    }

    /* 도착했는가. 도착했는데 화면도 안 열리고 배낭도 안 늘고 금화도
       안 바뀌었으면 그 칸은 이번 층에서 죽은 목표다. */
    /* 계단만은 절대 죽은 목표로 적지 않는다. 처음에 그 예외를 안
       뒀더니 이런 판이 생겼다: 봇이 계단에 도착 → `clear` 정책이
       「몬스터가 남아 있으면 아직 안 내려간다」로 막음 → 아무것도 안
       변함 → **계단이 죽은 목표로 적힘** → 그 뒤로는 계단으로 가는
       경로를 아예 못 찾고 제자리에서 영원히 기다린다. 판을 끝낼 수
       있는 유일한 칸을 목록에서 지운 것이다. */
    if (!path?.length && idx(p.x, p.y) === goal
        && G.level.tiles[goal] !== DOWN
        && G.screen === 'play' && sig(p) === before) dead.add(goal);

    if (!path?.length && G.level.tiles[idx(p.x, p.y)] === DOWN
        && !(clear && !Game.pressureLevel() && G.monsters.length)) Game.descend();
  }

  return { depth: G.depth, lv: G.player.lv, win: !!G.ending?.win, turn: G.turn,
           killer: G.ending?.by || '?',
           relics: (G.player.relics || []).length, waves: G.waves || 0,
           /* 끝에 들고 있는 개수와 판 내내 나온 개수는 다르다.
              「너무 많이 나온다」를 재려면 나온 쪽을 세야 한다. */
           relicsTaken: G.relicsTaken || 0, fused: G.fused || 0,
           relicSrc: G.relicSrc || {},
           /* 융합은 모닥불에서 재료를 내고 **직접 하는** 행동이라 봇은
              평생 한 번도 안 한다. 그러니 「0/25판에서 융합」은 게임이
              아니라 봇을 잰 값이다. 물어야 할 것은 「기회가 있었는가」다:
              끝에 든 유물 중에 짝이 맞는 쌍이 있는가. */
           fusable: (() => {
             const R = (G.player.relics || []);
             for (let i = 0; i < R.length; i++)
               for (let j = i + 1; j < R.length; j++)
                 if (BOWDATA.fusionOf(R[i], R[j])) return 1;
             return 0;
           })(),
           uniques: Object.keys(G.uniques || {}).length,
           gearTaken: G.gearTaken || 0, rareTaken: G.rareTaken || 0,
           best: G.bestCombo || 0, stuck: jammed || guard >= 60000,
           gear: [G.player.equip.weapon, G.player.equip.body, G.player.equip.shield]
                   .filter(Boolean).filter(i => i.pre || i.suf || i.plus).length,
           plus: (G.player.equip.weapon?.plus || 0) + (G.player.equip.body?.plus || 0),
           gold: G.player.gold, scrap: G.player.mats?.scrap || 0,
           chests: G.opened || 0, mimics: G.mimicsBitten || 0, traps: G.trapsSprung || 0,
           /* Health five and ten turns before the end, and how
              crowded and how well supplied the hero was when it
              stopped. Four numbers is enough to tell burst from
              attrition. */
           hp5: hist.length >= 6 ? hist[hist.length - 6] : null,
           hp10: hist.length >= 11 ? hist[hist.length - 11] : null,
           adjAtEnd: G.monsters.filter(m => !m.disguise
             && Math.abs(m.x - G.player.x) <= 1 && Math.abs(m.y - G.player.y) <= 1).length,
           /* 화살은 떨어지지 않는다 — 화살통은 소모품이 아니라 장비
              한 칸이다. 여기 0이 박혀 있어서 「화살 0으로 끝난 판
              30/30」이라는 측정값이 나왔고, 그걸 두 번이나 그대로
              보고했다. 상수는 측정이 아니다. */
           arrowsAtEnd: null,
           ...st };
}

const N = Number(process.argv[2] || 20);
/* Only survey at import time when the caller asked for exactly
   one class. A comma-separated list is another harness's
   argument, not a class name, and running it here crashed the
   import before that harness got a turn. */
/* Opt-in only. This used to run whenever argv[3] was set, which
   fired the wrong survey twice when another harness passed a
   comma-separated class list in that slot. */
const ONLY = process.env.BOT_ONLY || null;
const line = (label, runs) => {
  const avg = k => (runs.reduce((s, r) => s + r[k], 0) / runs.length).toFixed(1);
  console.log(
    `${label.padEnd(9)} 도달 ${avg('depth').padStart(4)}층 · Lv ${avg('lv').padStart(4)}` +
    ` · 승률 ${runs.filter(r => r.win).length}/${runs.length}` +
    ` · 최고연격 ${String(Math.max(...runs.map(r => r.best))).padStart(2)}` +
    ` · 크리 ${avg('crits').padStart(5)} · 기습 ${avg('sneaks').padStart(5)}` +
    ` · 처치 ${avg('kills').padStart(5)}` +
    ` · 상자 ${avg('chests')} · 미믹 ${avg('mimics')} · 함정 ${avg('traps')}` +
    ` · 구르기 ${avg('rolls')} · 사건 ${avg('events')} · 모닥불 ${avg('camps')} · 강화합 ${avg('plus')} · 유물 ${avg('relics')} · 습격 ${avg('waves')} · 잔고 ${avg('gold')}` +
    (runs.some(r => r.stuck) ? `  ⚠ ${runs.filter(r => r.stuck).length}건 턴 상한` : ''));
};

/* A mean over eight runs hides a heavy tail, and this
   distribution has one: plenty of runs end on floor 2 and a few
   reach the boss. Print the spread whenever a single class is
   being measured, so a difference can be told from noise. */
if (ONLY) {
  const runs = [];
  for (let i = 0; i < N; i++) runs.push(runBot('human', ONLY, true));
  const d = runs.map(r => r.depth).sort((a, b) => a - b);
  const q = f => d[Math.min(d.length - 1, Math.floor(d.length * f))];
  console.log(`${ONLY.padEnd(8)} n=${N}  평균 ${(d.reduce((s, x) => s + x, 0) / d.length).toFixed(1)}` +
    `  최저 ${d[0]}  25% ${q(0.25)}  중앙 ${q(0.5)}  75% ${q(0.75)}  최고 ${d[d.length - 1]}` +
    `  승 ${runs.filter(r => r.win).length}  턴상한 ${runs.filter(r => r.stuck).length}`);
  const by = {};
  for (const r of runs) if (!r.win) by[r.killer] = (by[r.killer] || 0) + 1;
  console.log('  사인:', Object.entries(by).sort((a,b)=>b[1]-a[1])
    .map(([k,v]) => `${k}×${v}`).join(' · '));
  const hist = {};
  for (const r of runs) hist[r.depth] = (hist[r.depth] || 0) + 1;
  console.log('  사망 층:', Object.keys(hist).sort((a,b)=>a-b).map(k => `${k}층×${hist[k]}`).join(' · '));
  process.exit(0);
}

export { runBot };
