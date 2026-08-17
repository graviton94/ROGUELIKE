/* ═══════════════════════════════════════════════════════════
   game.js — state and rules. No rendering happens here.
   ═══════════════════════════════════════════════════════════ */

import {
  MAX_DEPTH, MAX_LEVEL, STATS, STAT_NAME, RACES, CLASSES, SPELLS, MONSTERS, BOSS, mimicFor,
  WEAPONS, ARMOURS, CONSUMABLES, SHOPS, SHOP_LOADS, loadsFor, AILMENTS, IMMUNE, TRAPS,
  PREFIXES, SUFFIXES, SPELL_AFFIXES, ELITES, affixName,
  MATS, salvageYield, worthOf, upgradeCost, ENCHANT_COST, REROLL_COST,
  REFINE_COST, ATTUNE_COST, ATTUNE_MAX, FEEDABLE,
  ENGRAVINGS, engraveById, engraveSlots, isMilestone, ENGRAVE_PENALTY,
  CATALYSTS, catalystById, makeCatalyst,
  upgradeOdds, upgradeRisk, UPGRADE_CRIT, CAREFUL_MULT, CAREFUL_BONUS,
  UPGRADE_SURGE, UPGRADE_SURGE_FROM, UPGRADE_HEX_FROM, UPGRADE_HEX_PCT,
  ENCHANT_CURSE, ENCHANT_CURSE_STEP, ENCHANT_TWIN,
  BOONS, boonById, transChance,
  FUSIONS, fusionOf, FUSE_ODDS, FUSE_COST, FUSE_PULL,
  TASKS, TASK_PATIENCE, TASK_ODDS,
  ALTAR_OFFERS, rarityOf, isCursed, RARITY, TEMPLE_SHARE, JACKPOT,
  POTION_LOOKS, SCROLL_LOOKS, UNKNOWABLE,
  BUILD, SAVE_FORMAT,
  REPAY_SHARE, REPAY_CAP, AWE_RANGE, AWE_TURNS,
  STIGMA_TURNS, STIGMA_SPLASH, STIGMA_RANGE,
  RELICS, RELIC_SLOTS, relicSlots, relicById, crackOf, crackSaid, crackNeed, CRACK_LEFT, BRANCHES,
  STRANGE, strangeById, STRANGE_FROM, STRANGE_BASE, STRANGE_CAP,
  ARCANA, arcanaById, ARCANA_AT, GODS, godById, REFUSE,
  FLOOR_BUDGET, WAVE_EVERY, WAVE_GROWTH, REGIONS, regionOf,
  MEMORIES, memoryEarned, SHACKLES, shacklesAt, SHACKLE_STAT, tellsNeeded,
  WEAPON_TYPES, PATTERNS, NAMED,
  FITS, fitsOf, fitRule, UNDEAD,
  UNIQUES, uniqueById, UNIQUE_ODDS, ODDITIES, oddityById, oddityOf, ODDITY_ODDS,
  RESONANCE, resonanceById, CHAIN_ECHO, CHAIN_DECAY, CHAIN_MAX,
  CHAIN_KEEP, CHAIN_KEEP_RESO, POWDER_MAX, POWDER_BUDGET, BRAMBLE_BITE,
  ECHO_ROOM_HOPS, ECHO_ROOM_TOLL, ECHO_ROOM_KEEP,
  ROLL_COST, ROLL_DIST, staminaMax, STAM_REGEN_EVERY,
  ARTS, SHOVE_DIST, SHOVE_WALL, CLEAVE_SHARE,
  STAND_TURNS, STAND_CUT, KITE_DIST, KITE_MULT, BULWARK_TURNS,
  FAN_RANGE, FAN_ARC, FAN_SHARE, VANISH_HUSH, VITALS_MULT,
  POOL, poolName, HARD_HIT, POOL_UNDEAD,
  VANISH_MULT, VANISH_PUSH,
  ECHOES, ECHO_TURNS, ECHO_POWER, ECHO_SPLASH,
  FLURRY_MAX, FLURRY_STEP, FLURRY_STAM, MARK_STEP, MARK_MAX,
  AIMED_GAIN, PIERCE_KEEP, SNARE_TURNS, VOLLEY_SHARE, SMOKE_RADIUS, SMOKE_TURNS,
  QUIVERS, quiverById, BOW_MELEE, BOW_FALLOFF, GEAR_SLOTS,
  FORCE_STAM, FORCE_HURT, FORCE_NOISE, PICK_USES, CHEST_RUIN, RANGER_FOOTING,
  SANCTUM_TURNS, SANCTUM_CUT,
  ANATHEMA_MORE, JUDGE_HURT, MARTYR_TURNS,
  QUARRY_RANGE, QUARRY_STAM, QUARRY_HEAL,
  FINISH_MAX,
  CHARGE_DIST, CHARGE_SLAM, CANT_HOLD, raceRule,
  JUDGE_STRIKE, STORM_SHARE, CRUSADE_MAX,
  BANK_STEP, BANK_MAX, bankPurse, THIEF, thiefChance, thiefPurse,
  xpToLevel, statBonus, BANDS, CLASS_BAND, statRange, josa,
  strikeLine, takenLine, pickLine, MISS_BY, MISS_AT, FELLED,
  hearsayFor, rulebook,
} from './data.js';
import {
  Level, computeFov, lineClear, setFacilityBias, idx, rnd, roll, clamp, MW, MH,
  FLOOR, DOWN, UP, DOOR, RUBBLE, DOOR_OPEN, DOOR_LOCKED, DOOR_BROKEN,
  WEB, WATER, CAMP, ALTAR, EVENT, ANVIL, PROP, propAt, isDoor, isShut, walkable,
} from './world.js';
import { EVENTS } from './events.js';
import * as Meta from './meta.js';

export const G = {
  level: null, depth: 0, player: null, monsters: [], items: [],
  log: [], turn: 0, running: false, screen: 'title', shop: null,
  seenBoss: false,
  fx: [], combo: 0, comboT: 0, bestCombo: 0,
  opened: 0, mimicsBitten: 0, trapsSprung: 0,
  looks: {}, known: {},        // appearance per id, and what you have learned

  branch: null,          // which stair was taken into this floor
  pendingBranch: null,   // the two on offer, while the choice screen is up
  pendingRelic: null,    // a relic waiting for a slot to be freed
  floorTurn: 0,          // turns spent on this floor — the clock
  waves: 0,              // how many times the floor has answered
  hazards: [],           // telegraphed ground, counting down
  bank: 0,               // floors descended without sitting at a fire
  campUses: 0,           // fires still owed on this floor
};

/* ── relics ───────────────────────────────────────────────
   Gear makes numbers bigger; a relic changes what the game
   does. Everything below is a lookup against the five the
   player is carrying — cheap enough to call per swing. */
export const hasRelic = id => !!G.player?.relics?.some(r => r === id);
/* ── 유물 하나의 값 ───────────────────────────────────────
   플레이어: 「일반 유물 단일 효과 좀 줄이는 대신 융합유물 조합을
   좀 더 달성하기 어렵되 조합하면 더욱 효과 좋아지게 (슬롯 절약 +
   재료 2개 합 이상의 효과로 강해지게)」

   숫자를 마흔 줄 고쳐 쓰는 대신 **깔때기 하나에서 배율을 건다.**
   그러면 표는 「이 유물이 무엇을 하는가」를 계속 말하고, 「그것이
   지금 얼마인가」는 한 곳에서만 정해진다 — 다음에 다시 조정할 때도
   한 줄이다.

   융합물의 배율이 둘의 배율 합보다 커야 한다: 0.80 + 0.80 = 1.60
   인데 융합은 1.75다. 자리를 하나만 쓰면서 값은 더 크다 — 그게
   「재료 2개 합 이상」의 정확한 뜻이고, 융합을 어렵게 만든 값이다. */
export const RELIC_SCALE = 0.80;
export const FUSED_SCALE = 1.75;
export const relicVal = id => {
  if (!hasRelic(id)) return 0;
  const r = relicById(id);
  const scale = r.fused ? FUSED_SCALE : RELIC_SCALE;
  return r.v * scale + (G.player.tuned?.[id] || 0);
};
export const relicList = () => (G.player?.relics || []).map(relicById).filter(Boolean);

export const slotCount = () => relicSlots(G.deepest || G.depth || 0);

/* ── 크랙 ─────────────────────────────────────────────────
   유물 하나에 붙은 두 번째 줄. 그 유물이 하는 일과 같은 것을 세다가
   문턱을 넘으면 열리고, 열린 뒤로는 판이 끝날 때까지 열려 있다.

   깔때기는 셋뿐이다: 세는 곳 ledger(), 묻는 곳 cracked(), 여는 곳
   crackWatch(). 효과는 각 유물이 원래 살던 자리에서 한 줄로 갈린다 —
   크랙을 위한 두 번째 계산 경로를 만들면 그 순간 두 곳이 어긋난다. */
export const ledgerOf = k => G.ledger?.[k] || 0;
export function ledger(k, n = 1) {
  if (!G.ledger) G.ledger = {};
  G.ledger[k] = (G.ledger[k] || 0) + n;
  crackWatch();
}
/* 최고값을 재는 것들(연격)은 더하지 않고 밀어 올린다. */
export function ledgerPeak(k, v) {
  if (!G.ledger) G.ledger = {};
  if (v > (G.ledger[k] || 0)) { G.ledger[k] = v; crackWatch(); }
}
/* 유물을 **지금 들고 있는지**까지 묻는다. 처음에는 `!!G.cracks?.[id]`
   한 줄이었는데, 그러면 유물이 손에서 나간 뒤에도 크랙이 남는다 —
   유물이 나가는 길은 셋이고(융합의 splice · 자리가 찼을 때의 교체 ·
   사건의 버리기), 이번 커밋에서 융합이 가루 1 + 40금으로 싸졌으므로
   그 길은 이제 판마다 여러 번 지나간다.

   순교자의 맹세를 융합에 넣고 나서도 죽음이 한 번 무효가 되고 있었다.
   깔때기 한 줄에서 막는다 — 열세 군데를 각각 고치면 열네 번째가 또
   생긴다. 화면이 「안 든 유물의 크랙 상태」를 물을 일은 없다:
   crackRow는 relicList()가 준 것만 그린다. */
export const cracked = id => !!G.cracks?.[id] && hasRelic(id);
export function crackProgress(id) {
  const c = crackOf(id);
  if (!c) return null;
  const [k, n] = c.at;
  if (k === 'fused') return { have: 1, need: 1 };
  /* **주운 뒤부터** 센다. 처음에는 판 전체 장부를 그대로 읽었는데,
     그러면 13층에서 주운 굶주린 칼날이 그 판이 이미 쌓아 둔 130킬을
     상속해서 그 자리에서 깨진다 — 실측으로 깨진 71건 중 20건(28%)이
     주운 그 층에서 바로 깨졌다.

     그건 「그 유물을 쓴 만큼」이 아니라 「판이 길면 마지막에 든 것부터」
     이고, 그러면 「이 유물을 밀고 갈까」라는 결정이 아예 안 생긴다 —
     아무거나 주워도 같으니까. takeRelic에서 그 순간의 장부를 떠 두고
     그 뒤의 증가분만 읽는다. */
  if (k === 'floor') return { have: G.relicFloors?.[id] || 0, need: n };
  return { have: Math.max(0, ledgerOf(k) - (G.relicBase?.[id]?.[k] || 0)), need: n };
}
function crackWatch() {
  const p = G.player;
  if (!p?.relics) return;
  G.cracks = G.cracks || {};
  G.murmured = G.murmured || {};
  for (const id of p.relics) {
    if (G.cracks[id]) continue;
    const c = crackOf(id), pr = crackProgress(id);
    if (!c || !pr) continue;
    /* 0에서 130 사이에 아무 일도 안 일어나고 있었다. 문턱을 넘는
       순간에만 말하면 그 전까지 유물은 화면의 막대 하나이고, 이 게임은
       숫자를 이야기로 바꾸는 데 전부를 걸었는데 크랙의 진행만 순수한
       게이지였다. 절반에서 한 번, 유물이 중얼거린다 — 그러면 「130대
       맞기」가 카운터에서 관계가 된다. 문장이 있는 것만 말한다:
       마흔 개를 억지로 채우면 안 좋은 문장이 서른네 개 생긴다. */
    if (c.half && !G.murmured[id] && pr.have >= pr.need * 0.55) {
      G.murmured[id] = 1;
      say(c.half, 'warn');
    }
    if (pr.have < pr.need) continue;
    G.cracks[id] = true;
    const r = relicById(id);
    trace('crack', { id, n: crackOf(id)?.n });
    say(`${r.n}에 금이 갔다 — ${c.n}.`, 'level');
    /* 여기서 `c.t` 를 별표만 벗겨 로그에 밀어 넣고 있었다. 그러면
       두루마리가 「재는 선이 절반(50%)까지 올라오고, 피해는 +120%」
       라고 낭독한다 — `t` 는 **카드에 적히는 계약서**이고, 로그는
       세계의 목소리다. 계약서는 화면이 이미 보여 준다(crackRow).
       여기서는 그 유물이 하는 말만 남긴다. */
    const said = crackSaid(c);
    if (said) say(said, 'good');
    fx({ t:'crack', id, n: c.n });
    recalc(p);
  }
}
/* 「낀 채 몇 층」은 유물 쪽에서 센다 — 판 전체의 층수가 아니라
   그 유물과 함께 내려간 층수여야 늦게 주운 것이 공짜로 깨지지 않는다. */
function crackFloorTick() {
  if (!G.player?.relics) return;
  G.relicFloors = G.relicFloors || {};
  for (const id of G.player.relics)
    G.relicFloors[id] = (G.relicFloors[id] || 0) + 1;
  crackWatch();
}
/* data.js의 표를 그대로 다시 내보낸다 — 화면은 game.js 하나만
   보면 되고, 크랙이 어느 파일에 적혀 있는지 알 필요가 없다. */
export { crackOf };
/* 남은 수 한 조각. 화면 셋(유물 목록 · HUD 칩 · 카드)이 같은 문장을
   쓰게 하려고 뺐다. */
export const crackLeft = id => {
  const c = crackOf(id), pr = crackProgress(id);
  if (!c || !pr) return '';
  if (cracked(id)) return '';
  return CRACK_LEFT[c.at[0]](Math.max(0, pr.need - pr.have));
};

/* HUD에 걸 하나. 지금 가장 가까운 크랙 — 크랙은 이 층에서 무엇을
   할지를 바꾸는 장치인데(함정을 밟을까, 연격을 노릴까, 정예를 피할까)
   그 정보가 두 번 탭해야 나오는 창 안에만 있으면 사람은 안 본다.
   향할 곳이 화면 밖에 있는 것이 「루즈하다」의 직접 원인이다. */
export function nearestCrack() {
  let best = null;
  for (const id of G.player?.relics || []) {
    if (cracked(id)) continue;
    const c = crackOf(id), pr = crackProgress(id);
    if (!c || !pr || !pr.need) continue;
    const at = pr.have / pr.need;
    if (!best || at > best.at) best = { id, at, n: relicById(id).n, left: crackLeft(id) };
  }
  return best;
}

export const crackHint = id => {
  const c = crackOf(id);
  if (!c) return '';
  if (cracked(id)) return `${c.c} ${c.n} — ${c.t}`;
  const pr = crackProgress(id);
  return `${c.c} ${c.n} — ${crackNeed(id)} (${pr.have}/${pr.need})`;
};

/* 유물이 손을 떠날 때. 크랙과 「낀 채 내려간 층」을 같이 지운다 —
   안 지우면 버린 것을 다시 주웠을 때 문턱을 안 세고 깨진 채로 온다. */
export function forgetRelic(id) {
  if (G.cracks) delete G.cracks[id];
  if (G.relicFloors) delete G.relicFloors[id];
  if (G.murmured) delete G.murmured[id];
  if (G.relicBase) delete G.relicBase[id];
}

export function takeRelic(id) {
  const p = G.player;
  if (!p || hasRelic(id)) return false;
  p.relics = p.relics || [];
  if (p.relics.length >= slotCount()) { G.pendingRelic = id; G.screen = 'relic'; return false; }
  p.relics.push(id);
  /* 이 판에서 손에 들어온 유물의 총수. 끝에 들고 있는 개수(relics)와는
     다르다 — 자리가 모자라 버린 것, 융합으로 합쳐진 것이 여기 남는다.
     「너무 많이 나온다」를 재려면 나온 쪽을 세야 한다. */
  G.relicsTaken = (G.relicsTaken || 0) + 1;
  /* 이 유물의 장부는 여기서 0이다. 판이 이미 쌓아 둔 것을 상속하면
     크랙이 「밀고 간 보상」이 아니라 「판 길이에 대한 배당」이 된다. */
  (G.relicBase ||= {})[id] = { ...(G.ledger || {}) };
  /* 그리고 낀 층을 1로 시작한다 — crackFloorTick은 enterDepth에서만
     도므로, 안 그러면 표기 문턱이 실제로는 +1이 된다. */
  (G.relicFloors ||= {})[id] = 1;
  /* 융합 유물은 불에서 나온 순간 이미 깨져 있다 — 여기서 한 번 물어
     보지 않으면 아무 것도 세지 않는 그것들이 영영 안 열린다. */
  crackWatch();
  const r = relicById(id);
  const first = Meta.see('relics', id);
  /* 같은 이유로 유물도 `t`(계약서)가 아니라 `lore`(그 물건이 하는
     말)를 로그에 남긴다. 무엇을 하는지는 바로 뒤에 뜨는 카드가
     적혀 있는 그대로 보여 준다. */
  trace('relic', { id, n: r.n });
  say(`${r.n}. ${r.lore || r.t}`, 'level');
  /* 유물은 규칙을 바꾸는 물건인데, 처음 보는 것일 때만 카드가 떴다.
     두 번째로 든 「굶주린 칼날」도 그 판에서는 처음이고, 무엇을
     들었는지 읽지 않고 지나가면 판이 어떻게 달라졌는지 모른 채로
     계속 걷게 된다. 이제 언제나 멈춘다 — 판에 예닐곱 번뿐인 일이다. */
  /* 규칙과 이야기를 같이 보여 준다. 여태 카드에 규칙만 떴는데,
     유물은 이 게임에서 규칙을 바꾸는 유일한 물건이라 「무엇을
     주웠는가」만큼 「무엇을 주웠는가」도 읽혀야 한다. */
  lore(first ? '처음 든 유물' : '유물', r.n,
       /* lore가 함수면 지금 판의 번호를 받는다. 표에 굳은 숫자를 적어
          두면 마흔 번째 판에서도 「스물둘까지」라고 말한다 — 실제로
          회계사의 저울이 그러고 있었다. 이 표에서 함수인 것은 하나뿐이라
          여기 한 줄이면 된다. */
       (() => {
         const lo = typeof r.lore === 'function' ? r.lore(G.sent || 1) : r.lore;
         return lo ? `${r.t}\n\n${lo}` : r.t;
       })(), r.spr);
  /* 그리고 다른 득템과 같은 자로 연출한다. 여태 유물만 제단 반짝임을
     빌려 쓰고 있었다 — 이 게임에서 가장 큰 획득이 가장 다른 소리를
     냈다는 뜻이다. */
  fx({ t:'found', x:p.x, y:p.y, rar:3 });
  fx({ t:'altar', x:p.x, y:p.y, good:true });
  G.rareFound = (G.rareFound || 0) + 1;
  recalc(p);
  return true;
}

/* Swapping is the whole point of a slot limit: taking the new
   thing has to cost the old thing. */
export function swapRelic(dropIdx) {
  const p = G.player, id = G.pendingRelic;
  if (!id) return;
  if (dropIdx >= 0) {
    const gone = relicById(p.relics[dropIdx]);
    /* 화면이 열려 있는 동안 사건·융합이 p.relics 를 줄일 수 있다.
       그러면 여기 인덱스가 허공을 가리키고 `gone.n` 이 판을 죽인다 —
       90판 배치에서 한 번 실제로 터졌다. 재현률이 낮다는 것은
       사람 세션에서 먼저 만난다는 뜻이다. */
    if (!gone) { G.pendingRelic = null; G.screen = 'play'; return; }
    forgetRelic(p.relics[dropIdx]);
    p.relics[dropIdx] = id;
    say(`${gone.n}을(를) 버리고 ${relicById(id).n}을(를) 걸었다.`, 'level');
  } else {
    /* Refused. Put it back on the ground rather than destroying
       it — the whole point of a slot limit is that the decision
       stays open, and a relic that evaporates on "no" turns the
       screen into a trap. */
    const r = relicById(id);
    G.items.push({ kind:'relic', id, spr:r.spr, n:r.n, x:p.x, y:p.y });
    relicFrom('자리없음');
    say(`${r.n}을(를) 발치에 두었다. 마음이 바뀌면 다시 밟으시오.`);
  }
  G.pendingRelic = null;
  G.screen = 'play';
  recalc(p);
}

/* One funnel, so a particle can never be wrong on one line and
   right on the next. Every sentence in the game passes through
   here, which is why the resolver lives here rather than at the
   call sites. */
/* Which variant of a line to reach for. Purely cosmetic, so it
   lives outside the save — but it has to move on every sentence
   rather than on every turn, or two blows in the same turn come
   out word for word identical, which is the thing being fixed. */
let proseTick = 0;
export const nextLine = () => ++proseTick;

export function say(text, tone = '') {
  /* Stamped with when and where, so the scroll can set the record
     as paragraphs under floor headings instead of as one endless
     column. The strip ignores both. */
  G.log.push({ text: josa(text), tone, turn: G.turn || 0, depth: G.depth || 0 });
  if (G.log.length > 220) G.log.shift();
}

/* A page worth reading, handed to the presentation layer the same
   way every other effect is. The rules never decide what it looks
   like — they decide that this is the first time. */
function lore(kind, name, text, spr) {
  if (!text) return;
  fx({ t:'lore', kind, name, text, spr });
}

/* ── effect queue ─────────────────────────────────────────
   The rules never draw. They describe what just happened and
   ui.js decides how loud it looks. Headless runs simply let
   the queue fill and roll off the front.                    */
/* ── 손에 든 것이 화면에 보이게 ────────────────────────────
   기예 연출은 지금까지 「무슨 기예인가」만 그렸다. 그래서 대장간에서
   두 번 실패하고 얻은 +9 관통의 대검으로 휘두른 휩쓸기와, 바닥에서
   주운 몽둥이로 휘두른 휩쓸기가 화면에서 **똑같았다** — 이 게임이
   플레이어에게 시킨 가장 비싼 선택(모루·제단·유물)이 정작 그 선택을
   쓰는 순간에 안 보인다는 뜻이다.

   그래서 기예 사건마다 「지금 손에 든 것」을 한 줄 얹는다. 규칙은 한
   글자도 안 바뀐다 — 이건 전적으로 화면의 일이다. 그리고 색은 여기서
   안 고른다. 규칙은 **무엇을 들었는지**만 말하고, 그걸 무슨 색으로
   그릴지는 juice 쪽이 정한다.                                   */
const ART_FX = new Set([
  'shove', 'cleave', 'flurry', 'finisher', 'brace',
  'stepIn', 'fanOut', 'vanishOut', 'vitals',
  'charge', 'judgest', 'storm', 'crusade', 'bulwark',
  'sanctum', 'anathema', 'judge', 'martyr',
  'aimed', 'pierceShot', 'snare', 'volley', 'kite',
]);
export function auraOf(p = G.player) {
  if (!p) return null;
  const w = p.equip?.weapon;
  const a = { plus: w?.plus || 0,
              marks: [...(w?.engrave || [])],
              relics: [...(p.relics || [])],
              /* 최정상급은 따로 실어 보낸다. 「확실하게 체감 가능하게
                 (성능 + **외관** 모두)」의 외관 쪽 — 바닥의 빛기둥은
                 줍기 전까지만 보이고, 그 뒤로는 손에 든 것이 화면에서
                 평범한 물건과 똑같았다. 초월과 이름 있는 무기는
                 휘두를 때마다 보여야 한다. */
              boon: w?.boon || null,
              unique: w?.unique || null };
  return (a.plus || a.marks.length || a.relics.length || a.boon || a.unique) ? a : null;
}

export function fx(ev) {
  /* 한 곳. 스물세 군데의 fx 호출을 고치는 대신 깔때기에서 얹는다 —
     기예가 하나 늘 때 목록에 한 줄만 더하면 된다. */
  if (ART_FX.has(ev.t)) ev.aura = auraOf();
  G.fx.push(ev);
  if (G.fx.length > 300) G.fx.shift();
}

/* ── character creation ─────────────────────────────────── */
/* Rolled inside the class's bands rather than from 4d6, so the
   spread between two heroes of the same class is a few points
   and not a landslide. `cls` may be omitted early in a session,
   in which case everything lands in the middle band. */
export function rollStats(classKey) {
  const bands = CLASS_BAND[classKey] || null;
  const s = {};
  for (const k of STATS) {
    const [lo, hi] = BANDS[bands ? bands[k] : 'fair'];
    s[k] = lo + rnd(hi - lo + 1);
  }
  return s;
}

export function createHero(raceKey, classKey, base) {
  const race = RACES[raceKey], cls = CLASSES[classKey];
  /* The class modifier is gone: the roll bands already encode
     what a class is, and adding the old modifier on top counted
     it twice — a 전사 came out at 힘 20 and 지혜 3 every time.
     The race modifier stays, because that is the only thing left
     that separates a 드워프 전사 from an 엘프 전사. */
  const stats = {};
  for (const k of STATS)
    stats[k] = clamp(base[k] + (race.mod[k] || 0), 3, 20);

  const p = {
    race: raceKey, cls: classKey, stats,
    lv: 1, xp: 0,
    hp: 0, maxhp: 0, mana: 0, maxmana: 0,
    gold: 250,
    lightTurns: 700, wound: 0,
    blessed: 0,
    ail: {},          // ailment -> turns remaining
    stuck: 0,         // turns still caught in a web
    keys: 0,
    mats: { scrap: 0, dust: 0, essence: 0 },
    might: 0, iron: 0,
    spellPlus: {}, spellAffix: {},
    relics: [], boneHp: 0, seedAc: 0, grudge: 0,
    stam: 0, maxStam: 0, iframe: 0,
    perm: {}, tuned: {}, markup: 0, permHp: 0,
    equip: { weapon: null, body: null, shield: null },
    pack: [],
    x: 0, y: 0,
  };
  recalc(p, true);
  p.hp = p.maxhp; p.mana = p.maxmana;
  p.stam = p.maxStam;

  addItem(p, makeConsumable('potHeal'), 3);
  addItem(p, makeConsumable('torch'), 2);
  p.equip.weapon = { kind:'weapon', ...WEAPONS[0] };
  p.equip.body   = { kind:'armour', ...ARMOURS[0] };
  /* The ranger is the class whose whole idea is distance, so it
     starts holding the thing that makes distance possible rather
     than hoping the weapon shop has one. Everyone else can buy a
     bow; the ranger *is* one. */
  if (classKey === 'ranger') {
    p.equip.weapon = { kind:'weapon', ...WEAPONS.find(w => w.n === '짧은 활') };
    p.equip.quiver = makeQuiver('deer');
    /* And two ways out. The class dies with something in its face
       more than any other, and until this patch it had no verb
       for that at all. */
    addItem(p, makeConsumable('smoke'), 2);
    /* And the knife stays on the belt. Handing the ranger a bow
       *instead of* a weapon left it as the only class in the game
       with nothing to swing when something closed — a bow up
       close is half a blow, and an empty quiver is a stick. It
       measured 5.3 floors that way and 6.1 with the knife. */
    addItem(p, { kind:'weapon', ...WEAPONS[0] }, 1);
  }
  return p;
}

/* 한 방에 최대 체력의 이만큼을 잃으면 상처가 남는다. 스치는 것마다
   상처가 되면 그것은 상처가 아니라 그냥 피해다. */
export const WOUND_AT = 0.10;
/* 한 방이 지금 당장 가져갈 수 있는 최대치. 넘은 몫은 사라지지
   않고 상처로 옮겨 간다 — 총량은 같고, 오는 속도만 달라진다. */
export const BLOW_CAP = 0.32;
export const WOUND_SHARE = 0.50;      // 그 피해의 몇 할이 천장에서 깎이는가
export const WOUND_CAP = 0.45;        // 천장은 절반 아래로는 안 내려간다
/* 비싼 회복이 흉터에서 되돌리는 몫. 셋(불·물약·주문)이 같은 문을
   지나되 값이 다르다: 불은 기름을 다 내면 전부, 이 둘은 3할씩.
   3할이면 나쁜 층 하나는 물약 하나로 지워지고, 판 내내 깎인 채로
   걷는 일은 없어진다 — 그런데 상처가 사라지지도 않는다. */
export const BIG_HEAL_MEND = 0.30;

export function recalc(p, init) {
  const race = RACES[p.race], cls = CLASSES[p.cls];
  const conB = statB(p, 'con');
  /* Growth in steps, not a trickle. The totals at level 30 are
     what they always were; the delivery is not. Nine health a
     level is a number nobody notices — the same health arriving
     as +6 on ordinary levels and +14 on every third one is a
     thing you feel, and a thing worth levelling *for*.

     Every stat the player watches is on this pattern now: health
     every three levels, mana every two. */
  const step3 = Math.floor(p.lv / 3);
  p.maxhp = Math.max(8, Math.floor(
      (15 + cls.hd + race.hp)
    + (p.lv - 1) * (cls.hd * 0.42 + 1.5)      // the trickle, cut by 40%
    + step3 * (cls.hd * 0.88 + 3.6)           // …and paid back in lumps
    + conB * p.lv * 1.05));
  if (cls.realm) {
    const key = cls.realm === 'arcane' ? 'int' : 'wis';
    const b = statBonus(p.stats[key]);
    // Mana moves on the odd levels only, twice as far each time.
    /* 1.7 made the pool a number that goes up rather than a
       resource: a level-15 mage could cast 마력 화살 61 times in a
       row, and the pool sat at 97% of maximum across a run. At 1.2
       the caster runs dry about one casting opportunity in
       twenty-five and the reach barely moves. */
    /* 1.7, restored. It was cut to 1.2 on a measurement that does
       not hold: "in forty runs the caster never stood in front of
       something it could not afford" was true, but it was counted
       against 마력 화살, which costs one at every level — the pool
       has never gated *that* spell and never will. What the pool
       actually gates is 서리 폭발 and 중상 치유, and the probe never
       asked about those.
       Re-measured on a bot that reaches floor eight rather than
       floor three: the cut cost the mage a full floor (7.8 → 6.8)
       and three levels, with the dry-turn count still zero at both
       settings. A change that buys nothing measurable and costs a
       floor is a change that was measuring its own instrument. */
    p.maxmana = Math.max(0, Math.floor((b + 1) * Math.ceil(p.lv / 2) * 1.7));
  } else p.maxmana = 0;
  const g = gearBonus(p);
  /* 크랙이 부풀린 몫은 여기서 더한다. 처음에는 `p.maxhp += add`로
     직접 올렸는데, 천장은 **파생값**이라 다음 recalc 한 번에 지워진다 —
     그러면 장부(G.famineSwell)만 남아서 층을 내려갈 때 있지도 않은
     몫을 도로 빼앗아 간다. 벤치가 그것을 잡았다(25 → 55 → 15).
     파생값은 파생되는 자리에서 더해야 한다. */
  p.maxhp = Math.max(8, Math.round(p.maxhp * (1 + g.maxhpPct + (raceRule(p, 'hpPct') || 0)))
    + (p.boneHp || 0) + (p.permHp || 0) + (G.famineSwell || 0));
  /* ── 상처 ────────────────────────────────────────────────
     체력은 차오르지만 차오를 수 있는 높이가 낮아진다. 재 보니 판의
     60%를 체력 90~100%에서 보내고 30% 아래는 0%였다 — 몸이 안 닳으니
     물약을 아낄 이유도, 물러설 이유도 없었다. 톱니를 내려가는 선으로
     바꾸는 것이 이 한 줄이다.

     천장은 여기 한 곳에서만 깎인다. 다른 데서 maxhp를 건드리면
     recalc이 다음 호출에 되돌려 놓으므로, 상처는 반드시 여기를 지난다. */
  p.wound = Math.max(0, Math.min(p.wound || 0, Math.round(p.maxhp * WOUND_CAP)));
  p.maxhp = Math.max(8, p.maxhp - p.wound);
  if (p.hp > p.maxhp) p.hp = p.maxhp;
  // 재의 무게, applied last so it takes a slice of the finished
  // number rather than of the base one.
  if (hasShackle('ash')) p.maxhp = Math.max(8, Math.round(p.maxhp * 0.85));
  p.maxmana = Math.max(0, Math.round(p.maxmana * (1 + g.manaPct)) + g.manaFlat);
  p.maxStam = staminaMax(p);
  if (init) return;
  p.hp = Math.min(p.hp, p.maxhp);
  p.mana = Math.min(p.mana, p.maxmana);
  p.stam = Math.min(p.stam ?? p.maxStam, p.maxStam);
  /* Twenty-four call sites end up here — every equip, forge,
     engrave, relic and altar. One hook rather than twenty-four. */
  checkResonance(p);
}

/* ── effective ability scores ─────────────────────────────
   `p.stats` is what the dice said and never changes. What the
   game *reads* is this, so a relic can bend an ability score
   without anything downstream needing to know that relics exist
   — the same trick gearBonus plays for damage.

   Every read of an ability goes through statB(). There is no
   second path, which is the only reason a relic that rewrites
   a score can be trusted. */
export function effStats(p) {
  if (!p) return { str:10, int:10, wis:10, dex:10, con:10, chr:10 };
  const s = { ...p.stats };
  const held = p.relics || [];
  for (const [id, apply] of STAT_RELICS) if (held.includes(id)) apply(s);
  for (const k of STATS) s[k] = clamp(s[k], 1, 26);
  return s;
}
/* 능력치를 고쳐 쓰는 여섯. 표로 두는 이유는 순서가 규칙이기 때문이다 —
   균형추가 먼저 평평하게 만들고 나서 나머지가 그 위에 얹힌다. 그리고
   여기 if를 여섯 개 늘어놓으면 effStats가 곧 복잡도 15를 넘는다
   (sim/knots.mjs가 크랙을 넣던 이 커밋에서 바로 잡아냈다). */
const STAT_RELICS = [
  // 균형추: the low end comes up to meet the high end. The whole
  // point of the stat spread, bought with a quarter of your life.
  ['ballast', s => { const hi = Math.max(...STATS.map(k => s[k])); for (const k of STATS) s[k] = hi; }],
  ['grip',    s => { s.str = Math.max(s.str, 20); s.dex = Math.min(s.dex, 6); }],
  ['specs',   s => { const hi = Math.max(s.int, s.wis) + (cracked('specs') ? 4 : 0); s.int = hi; s.wis = hi; }],
  ['acro',    s => { s.dex += 6; if (!cracked('acro')) s.str -= 4; }],
  ['bull',    s => { s.con += cracked('bull') ? 10 : 6; s.chr -= 6; }],
  ['mask',    s => { s.chr = Math.max(s.chr, 18); for (const k of STATS) if (k !== 'chr') s[k] -= 1; }],
];

/* The one reader. `statB(p, 'str')` replaced every
   `statB(p, 'str')` in the file. */
export const statB = (p, k) => {
  const s = effStats(p);
  /* ③ 거인의 손아귀 크랙. 능력치를 고치지 않는다 — **민첩이 하던
     일을 힘이 한다.** 판에 적힌 6은 6인 채이고, 6을 읽으러 오는 쪽이
     20을 받아 간다. 규칙을 부수는 크랙은 숫자가 아니라 **누가 읽는가**를
     바꾼다. */
  if (k === 'dex' && cracked('grip')) return statBonus(Math.max(s.dex, s.str));
  return statBonus(s[k]);
};

/* ── gear resolution ──────────────────────────────────────
   Every derived number the player has runs through here, so an
   affix only ever has to be declared once in data.js. Cheap
   enough to recompute per swing: three slots, two affixes each. */
const EMPTY_BONUS = {
  dmg:0, dmgPct:0, hit:0, hitPct:1, crit:0, critMult:0, ac:0, acPct:0, stealth:0,
  lifesteal:0, chain:0, burst:0, execute:0, pierce:0,
  regen:0, lightR:0, maxhpPct:0, manaPct:0, manaFlat:0, spellPow:0,
  on:null, resistAll:false, noStealth:false,
  // engraving-only rules — see ENGRAVINGS in data.js
  firstStrike:0, vsElite:0, flatDR:0, reflect:0, dawn:0, ailShrug:0, anchor:false,
};

/* 강화 한 단계의 값. 곱이라 층과 무관하게 같은 무게를 갖는다. */
export const PLUS_DMG = 0.09;   // +8이면 피해 ×1.72
/* 힘과 레벨도 곱 쪽에 선다. 몸이 자라면 **들고 있는 것이 하는 일**이
   커지는 것이지, 맨손 피해가 붙는 것이 아니다. */
export const STR_DMG = 0.09;
export const LV_DMG  = 0.02;
export const PLUS_AC  = 0.07;   // +8이면 방어 ×1.56

export function gearBonus(p) {
  const b = { ...EMPTY_BONUS };
  if (!p) return b;
  for (const slot of GEAR_SLOTS) {
    const it = p.equip[slot];
    if (!it) continue;

    /* ── 강화는 곱이다 ──────────────────────────────────
       예전에는 `+1 = 피해 +2` 고정이었다. 재 보니 그 값이 1층에서는
       한 방의 **+19%**이고 15층에서는 **+4%**다 — 판당 평균 +5.2까지
       올려도 총 +10.4인데, 그때 한 방이 51.6이다. 반올림 오차다.
       그래서 후반의 강화가 「해도 그만」이 되고, 모루 앞의 결정이
       사라진다.

       비율로 바꾼다. `+1 = 피해 ×1.09`. 그러면 +8이 1.99배가 되고,
       그 값은 1층에서든 15층에서든 같은 무게다 — 강화는 「지금 내
       무기를 두 배로 만드는 일」이 된다. 명중은 그대로 가산으로
       둔다: 명중률은 원래 비율이라 곱하면 두 번 곱하는 셈이 된다. */
    if (it.plus) {
      if (it.kind === 'weapon') { b.dmgPct += it.plus * PLUS_DMG; b.hit += it.plus * 1.5; }
      else b.acPct += it.plus * PLUS_AC;
    }
    if (it.kind === 'armour') b.ac += it.ac || 0;
    /* A rod is not swung, it is held. Its two numbers go straight
       into the pool and the book rather than into the blow. */
    b.manaFlat += it.manaFlat || 0;
    b.spellPow += it.spellPow || 0;

    for (const a of [
      it.pre && PREFIXES.find(x => x.id === it.pre),
      it.suf && SUFFIXES.find(x => x.id === it.suf),
      // Engravings ride the same funnel, so a rule declared once
      // in data.js is true everywhere without a second code path.
      ...(it.engrave || []).map(engraveById),
    ]) {
      if (!a) continue;
      b.dmg       += a.dmg || 0;
      b.dmgPct    += a.dmgPct || 0;
      b.hit       += a.hit || 0;
      b.crit      += a.crit || 0;
      b.critMult  += a.critMult || 0;
      b.ac        += a.ac || 0;
      b.stealth   += a.stealth || 0;
      b.lifesteal += a.lifesteal || 0;
      b.chain     += a.chain || 0;
      b.burst     += a.burst || 0;
      b.execute   += a.execute || 0;
      b.pierce    += a.pierce || 0;
      b.regen     += a.regen || 0;
      b.lightR    += a.lightR || 0;
      b.maxhpPct  += a.maxhpPct || 0;
      b.manaPct   += a.manaPct || 0;
      b.firstStrike += a.firstStrike || 0;
      b.vsElite   += a.vsElite || 0;
      b.flatDR    += a.flatDR || 0;
      b.reflect   += a.reflect || 0;
      b.dawn      += a.dawn || 0;
      b.ailShrug  += a.ailShrug || 0;
      if (a.anchor) b.anchor = true;
      if (a.on) b.on = a.on;
      if (a.resist === 'all') b.resistAll = true;
    }

    /* What these particular hands do with this particular thing.
       Folded in here rather than anywhere else because gearBonus
       is the one place every derived number already passes
       through — a fit that lived outside it would be right in the
       item card and wrong in the swing. */
    for (const f of fitsOf(p, it)) {
      const m = f.mod;
      if (m) {
        b.dmg += m.dmg || 0;  b.dmgPct += m.dmgPct || 0;
        b.hit += m.hit || 0;  b.ac += m.ac || 0;
        b.crit += m.crit || 0;  b.stealth += m.stealth || 0;
        b.maxhpPct += m.maxhpPct || 0;  b.manaPct += m.manaPct || 0;
        b.regen += m.regen || 0;  b.lifesteal += m.lifesteal || 0;
      }
      if (f.rule === 'noStealth') b.noStealth = true;
    }
  }

  /* Permanent gains from ? rooms live here too. They are not
     attached to any item, so nothing can take them away — which
     is exactly why an event that hands one out is memorable. */
  const perm = p.perm;
  if (perm) {
    b.dmg       += perm.dmg || 0;
    b.ac        += perm.ac || 0;
    b.stealth   += perm.stealth || 0;
    b.lightR    += perm.lightR || 0;
    b.lifesteal += perm.lifesteal || 0;
    b.chain     += perm.chain || 0;
    b.manaFlat  += perm.manaFlat || 0;
    if (perm.hitPctMul) b.hitPct *= perm.hitPctMul;
  }

  /* Relics ride the same funnel, so a relic and an affix can
     never disagree about what a number means. The ones with a
     condition are resolved here too — 저울추 only pays while you
     are nearly dead, which is what makes it a gamble rather
     than a stat. */
  for (const id of p.relics || []) {
    switch (id) {
      /* 크랙이 갈리는 자리. 두 번째 계산 경로를 만들지 않고 **같은
         줄에서** 갈린다 — 크랙용 gearBonus를 따로 두면 그 날로
         두 곳이 어긋난다. */
      /* 리터럴로 적힌 유물들도 깔때기를 지나게 한다. 지금까지 마흔
         중 열다섯만 relicVal 을 읽었고, 그래서 「일반 유물을 줄인다」가
         그 열다섯에만 걸렸다 — 표에 적힌 v 가 화면에도 규칙에도
         안 닿는 유물이 스물다섯 개 있었다는 뜻이다. */
      case 'pact':     if (!cracked('pact')) b.maxhpPct -= 0.25;
                       b.crit += relicVal('pact'); break;
      /* 먹일 수 있는 것들은 리터럴이 아니라 relicVal을 읽는다 —
         먹인 값(p.tuned)이 닿는 통로가 그것 하나뿐이다. 안 먹였으면
         relicVal은 표의 v를 그대로 돌려주므로 값은 전과 같다. */
      case 'chain':    b.ac += relicVal('chain'); if (!cracked('chain')) b.noStealth = true; break;
      case 'reckless': b.hitPct *= 0.85;
                       b.critMult += relicVal('reckless') * (cracked('reckless') ? 2 : 1); break;
      case 'eye':      b.manaFlat -= relicVal('eye'); break;
      case 'vow':      b.dmgPct += relicVal('vow'); break;
      case 'scale':    if (p.hp <= p.maxhp * (cracked('scale') ? 0.5 : 0.3))
                         b.dmgPct += relicVal('scale') * (cracked('scale') ? 2 : 1); break;
      case 'lamp':     b.lightR += cracked('lamp') ? relicVal('lamp') : -relicVal('lamp'); break;
      case 'everflame': if (!cracked('everflame')) b.maxhpPct -= 0.20; break;
      case 'moth':     b.maxhpPct -= 0.10; break;
      case 'knot':     b.stealth -= 0.5; break;
      case 'seed':     b.maxhpPct -= 0.15; b.ac += p.seedAc || 0; break;
      case 'grudge':   b.dmgPct += (p.grudge || 0) * relicVal('grudge'); break;
      // The stat relics pay for themselves in health, not in
      // a second stat — see effStats() for what they actually do.
      case 'specs':    b.maxhpPct -= 0.20; break;
      case 'ballast':  if (!cracked('ballast')) b.maxhpPct -= 0.25; break;
      case 'nighteye': if (cracked('nighteye') && G.depth > 0 && p.lightTurns <= 0)
                         b.dmgPct += 0.25; break;

      /* Fused. Each one is its two halves with the downside
         deepened and the upside paid out — a fused relic is not
         a better relic, it is a more extreme one. */
      /* ── 여기서 두 유물의 값을 조용히 두 배로 만들었다 ──────────
         「리터럴로 적힌 것도 깔때기를 지나게 한다」면서 relicVal 로
         바꿔 놨는데, 표의 `v` 는 이 자리의 숫자가 **아니었다.**
         순교자의 맹세는 `v:0.40`(설명문의 「최대 체력 −40%」)인데
         이 자리의 리터럴은 치명 0.25 · 배율 1.2 였다. 그래서
         치명이 0.25 → 0.70(+45%p), 배율이 1.2 → 2.1 이 됐다 —
         이 유물 하나로 치명률이 9% → **79%**, 한 방이 4.7 → 15.5,
         전투력이 662 → 1302 가 된다. 모순의 룬도 같은 식으로
         피해 +20% → +39% 가 됐다.

         융합물을 1.75배로 만든다는 뜻은 살린다. 다만 배율은 **이
         자리의 올바른 밑값**에 건다 — 표의 v 는 설명문이 쓰는 다른
         숫자다. 한 유물이 두 개의 값을 가지면 v 하나로는 못 담는다. */
      case 'martyr':   b.maxhpPct -= 0.40; b.crit += 0.25 * FUSED_SCALE;
                       b.critMult += 1.2 * FUSED_SCALE; b.hitPct *= 0.90; break;
      case 'paradox':  b.dmgPct += 0.20 * FUSED_SCALE; break;
      case 'oracle':   b.manaFlat -= 3; b.lightR -= 2; break;
    }
  }
  /* ── 아르카나가 몸에 닿는 두 곳 ────────────────────────
     나머지 일곱은 세계에 붙지만, 이 둘은 주고받는 값이라 여기 온다.
     같은 깔때기를 지나므로 강화·유물과 섞이는 방식이 똑같다. */
  if (hasArcana('brittle')) b.dmgPct += 0.40;
  if (hasArcana('dark') && G.depth > 0 && p.lightTurns <= 0) b.dmgPct += 0.60;
  return b;
}

/* 갑옷의 강화도 곱이다(gearBonus의 acPct). 곱하는 자리는 **장비에서
   온 값**뿐 — 민첩과 레벨과 축복은 몸의 것이지 판금의 것이 아니고,
   거기까지 곱하면 판금 +8이 맨몸까지 두껍게 만든다. */
export const armourClass = p => {
  const g = gearBonus(p);
  return Math.round(g.ac * (1 + g.acPct))
    + statB(p, 'dex') + Math.floor(p.lv / 4)
    + (p.blessed > 0 ? 4 : 0) + (p.iron > 0 ? 10 : 0)
    /* ── 맹세는 지갑이 아니라 서약이다 ──────────────────────
       이 줄이 예전에는 `p.oath / 2`였다. 맹세는 기예에만 쓰였으므로
       늘 높게 차 있었고, 그래서 팔라딘의 갑옷은 두꺼웠다.

       통을 합치자 같은 칸을 구르기와 기예가 매 전투마다 0으로 비웠다.
       **싸우는 동안 갑옷이 벗겨진 것이다** — 실측으로 도달 층이
       10.0 → 6.9로 내려앉았고, 시계를 아무리 빨리 돌려도 안 돌아왔다.
       시계 문제가 아니라 「남은 것」을 읽는다는 것 자체가 문제였다.

       한 숫자가 지갑이면서 동시에 능력치일 수는 없다. 그래서 **남은
       것이 아니라 통의 크기**를 읽는다 — 맹세는 얼마나 남았느냐가
       아니라 얼마나 크게 했느냐다. 레벨을 따라 자라고, 전투 중에
       흔들리지 않는다. */
    + (p.cls === 'paladin' ? Math.floor((p.maxStam || 0) / 2) : 0);
};

/* 힘의 아래쪽. Heavy gear asks for a number, and a hero who does
   not have it swings badly rather than being refused — a refusal
   is a rule you fight, a penalty is a trade you make. Two-handers
   and plate are the only things that ask. */
export function strainOf(p) {
  let need = 0;
  const w = p.equip.weapon, b = p.equip.body;
  if (w?.hands === 2) need = Math.max(need, 15);
  else if (w && (w.dice?.[1] || 0) >= 8) need = Math.max(need, 12);
  if (b && (b.ac || 0) >= 16) need = Math.max(need, 15);
  else if (b && (b.ac || 0) >= 12) need = Math.max(need, 12);
  const have = effStats(p).str;
  return need && have < need ? { need, have, short: need - have } : null;
}

export const toHit = p => {
  const strain = strainOf(p);
  const base = CLASSES[p.cls].bth * p.lv / 3 + statB(p, 'dex') * 2
    + statB(p, 'str') + (p.blessed > 0 ? 5 : 0) + gearBonus(p).hit
    - (strain ? strain.short * 3 : 0);
  // Proportional, not flat: a flat penalty would cripple level 1
  // and barely register at level 20.
  return (has(p, 'fear') ? base * 0.55 : base) * gearBonus(p).hitPct;
};

/* ── ailments ─────────────────────────────────────────────
   The race notes have always claimed a gnome cannot be
   paralysed and a dwarf cannot be blinded. Now they can't. */
export const has = (p, kind) => (p.ail?.[kind] || 0) > 0;
export const immuneTo = (p, kind) =>
  (IMMUNE[p.race] || []).includes(kind) || gearBonus(p).resistAll;

export function afflict(p, kind, turns) {
  if (!kind || !AILMENTS[kind]) return;
  const g = gearBonus(p);
  // 닻의 각인 refuses the two that take the turn away from you.
  if (g.anchor && (kind === 'paralyze' || kind === 'slow')) {
    say(`${AILMENTS[kind].n}이(가) 미끄러진다.`, 'good');
    fx({ t:'resist', x:p.x, y:p.y });
    return;
  }
  if (g.ailShrug) turns = Math.max(1, Math.round(turns * (1 - g.ailShrug)));
  /* 지혜 is what shrugs a curse off. High wisdom shortens every
     ailment; low wisdom lengthens them, which is the reason a
     wizard with dumped wisdom feels different from one without. */
  turns = Math.max(1, Math.round(turns * clamp(1 - statB(p, 'wis') * 0.09, 0.35, 1.9)));
  if (immuneTo(p, kind)) {
    say(`${AILMENTS[kind].n}이(가) 통하지 않는다.`, 'good');
    fx({ t:'resist', x:p.x, y:p.y });
    return;
  }
  /* 인간은 저항이 없다 — 붙은 것이 한 턴 더 간다. 「균형 잡힌 표준」의
     대가가 숫자가 아니라 **규칙**으로 붙는 자리다. */
  const already = p.ail[kind] || 0;
  p.ail[kind] = Math.max(already, turns + (p === G.player ? (raceRule(p, 'ailPlus') || 0) : 0));
  if (!already) {
    say(`${AILMENTS[kind].n} — ${AILMENTS[kind].note}.`, 'warn');
    fx({ t:'ail', kind, x:p.x, y:p.y });
  }
}

export const ailList = p =>
  Object.entries(p.ail || {}).filter(([, v]) => v > 0).map(([k]) => k);

/* ── the payoff dials ─────────────────────────────────────
   Crits, sneak attacks and the kill chain are what make a
   swing feel worth taking. Keep them legible: a rogue should
   be able to read these three lines and plan around them.   */
export const critChance = p => clamp(
  0.04 + statB(p, 'dex') * 0.022 + p.lv * 0.004
  + (p.cls === 'rogue' ? 0.10 : p.cls === 'ranger' ? 0.04 : 0)
  + gearBonus(p).crit,
  0.02, 0.80);

export const critMult = p =>
  2.0 + (p.cls === 'rogue' ? 0.6 : 0) + Math.floor(p.lv / 10) * 0.25
  + gearBonus(p).critMult;

/* How quietly you move. This is the dial that decides whether
   the sneak attack above is a real option or a dead letter, and
   it is deliberately wired to armour: plate keeps you alive and
   announces you down the corridor. Pick one. */
export const stealth = p =>
  /* 소리 없는 강철: too heavy to make a sound. Standing still in
     the wrong armour is the only way anyone has ever been
     invisible in this game. */
  /* 눈의 방에서는 숨을 수 없다. 벽이 전부 보고 있다. */
  strangeIs('eyes') ? 0
  : (oddAwake('quietsteel') && G.player?.stillFor > 0) ? 0.95
  : (gearBonus(p).noStealth ? 0 : clamp(
  0.10 + statB(p, 'dex') * 0.05
  + (p.race === 'halfling' ? 0.20 : p.race === 'elf' ? 0.10 : p.race === 'halfTroll' ? -0.15 : 0)
  + (p.cls === 'rogue' ? 0.25 : p.cls === 'ranger' ? 0.12 : 0)
  - (p.equip.body?.ac || 0) * 0.012
  - (p.equip.shield?.ac || 0) * 0.010
  + gearBonus(p).stealth,
  0, 0.92));

/* Each link in the chain adds damage; the chain is the reward
   for clearing a room without letting anything touch you. */
export const comboMult = () =>
  1 + Math.min(G.combo, 20) * (0.035 + (G.player?.perm?.comboStep || 0));

/* 연격은 기량의 표시가 아니라 상태의 표시다. 문장이 위로 갈수록
   기뻐지면 이 게임이 아니다 — 손이 풀리는 것이 아니라 손이 굳는다. */
const COMBO_TIERS = [
  [5,  '연격 5 — 손이 젖었다.'],
  [10, '연격 10 — 팔이 저 혼자 움직인다.'],
  [15, '연격 15 — 바닥이 미끄럽다. 네 것인지 아닌지는 모른다.'],
  [20, '연격 20 — 이제 아무것도 다가오지 않는다. 그것이 더 나쁘다.'],
];

function bumpCombo(x, y) {
  G.combo++;
  G.comboT = 14 + (G.player?.perm?.comboHold || 0);
  if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  ledgerPeak('combo', G.combo);
  for (const [n, msg] of COMBO_TIERS)
    if (G.combo === n) { say(msg, 'level'); fx({ t:'comboTier', x, y, n }); }
}

/* A hit to the face costs you half the chain — enough to hurt,
   not enough to make the whole system feel fragile. */
/* 앙심 counts the hits you have taken on this floor. Every path
   that costs you health goes through here, so a relic that pays
   for being hit can never disagree with what "being hit" means. */
/* ── 통 하나, 문 하나 ─────────────────────────────────────
   신앙·맹세·그림자가 각자 제 통(12·10·5)과 제 깔때기를 갖고 있었다.
   셋 다 같은 질문에 답한다 — 「기예를 낼 것이 있는가」. 도적은 심지어
   기력과 그림자를 **동시에** 냈으므로 지갑을 두 개 확인해야 했다.

   이제 통은 기력 하나이고, 이 함수가 그 하나뿐인 **들어오는 문**이다.
   직업의 정체성은 통이 아니라 **무엇이 이 문을 두드리는가**로 남는다:
   사제는 맞을 때, 팔라딘은 맞고 죽일 때, 도적은 아무도 안 볼 때.
   그 규칙은 POOL 표가 갖고 있다(data.js).

   이름도 거기서 온다. 같은 숫자가 전사에게는 기력이고 사제에게는
   신앙이다 — 통을 합치는 것과 이름을 뺏는 것은 다른 일이다. */
export function poolGain(n = 1, why = '') {
  const p = G.player;
  if (!p || !(n > 0)) return 0;
  const was = p.stam || 0;
  p.stam = Math.min(p.maxStam, was + n);
  const got = p.stam - was;
  if (got) {
    if (G.floorTally) G.floorTally.pool[why || '?'] = (G.floorTally.pool[why || '?'] || 0) + got;
    fx({ t:'poolGain', x:p.x, y:p.y, at:p.stam, why, cls:p.cls });
    if (p.stam === p.maxStam && was < p.maxStam)
      say(`${poolName(p.cls)}이(가) 가득 찼다.`, 'good');
  }
  return got;
}
/* 직업이 맞을 때 통이 차는가. 사제와 팔라딘만 참이고, 그 둘이
   「나빠질수록 강해지는」 쪽인 이유가 이 한 줄이다. */
function poolOnHurt(dmg, mult = 1) {
  const p = G.player, rule = POOL[p?.cls];
  if (!rule?.onHurt) return;
  /* 곱은 **몫**에 붙는다. 처음에 피해에 곱했더니 맹세의 방패가
     「두 배로 맹세한다」가 아니라 「한 대를 두 배로 세게 읽는다」가
     됐다 — 큰 한 방 판정만 넘기고 몫은 그대로였다. */
  poolGain(mult * (dmg >= (p.maxhp || 1) * HARD_HIT
    ? (rule.onHard || rule.onHurt) : rule.onHurt), 'hurt');
}

/* ── 잔향 ─────────────────────────────────────────────────
   The mage's axis. One place it is written, one place it is read,
   one place it is spent. It lives on the player rather than on G
   because it is the caster's, not the floor's. */
export function liveEcho(p = G.player) {
  if (!p || p.cls !== 'mage' || !p.echo) return null;
  if (G.turn > p.echo.until) return null;
  const spec = ECHOES[p.echo.from];
  return spec ? { ...spec, from: p.echo.from } : null;
}
function leaveEcho(p, spellId) {
  if (p.cls !== 'mage' || !ECHOES[spellId]) return;
  p.echo = { from: spellId, until: G.turn + ECHO_TURNS };
  fx({ t:'echoLeft', x:p.x, y:p.y, id: ECHOES[spellId].id });
}
function takeEcho(p) {
  const e = liveEcho(p);
  if (e) { p.echo = null; say(`잔향 — ${e.n}. ${e.t}.`, 'level'); }
  return e;
}

/* ── 그림자 ───────────────────────────────────────────────
   도적의 탄약. 이제 제 통이 아니라 기력 통이고, 이 함수는 「도적일
   때만」을 지키는 얇은 문일 뿐이다 — 채우는 일은 poolGain이 한다. */
export const gainShadow = (n = 1, why = '') =>
  G.player?.cls === 'rogue' ? poolGain(n, why) : 0;
/* Is anything awake looking at you right now? The quiet tick is
   paid for standing outside every awake thing's line — the same
   test the monsters themselves run. */
function unseenByAll() {
  const p = G.player, L = G.level;
  if (!L) return false;
  return !G.monsters.some(m =>
    m.awake && !m.disguise
    && Math.hypot(m.x - p.x, m.y - p.y) <= 9
    && lineClear(L, m.x, m.y, p.x, p.y));
}

/* ── 표적 (레인저) ────────────────────────────────────────
   One funnel, called by every landed blow whichever hand threw
   it. It used to be two inline fragments inside swing(): the
   stack counter in one branch and the multiplier eighty lines
   below. loose() — the arrow path, which is the entire class —
   touched neither, so a level-12 ranger shooting a single target
   held 표적 0.00 out of 5 for the whole fight and the 45% the
   tooltip promises did not exist. */
function markTarget(m) {
  const p = G.player;
  if (p.cls !== 'ranger') return;
  p.markN = p.markOn === m ? Math.min(MARK_MAX, (p.markN || 0) + 1) : 0;
  p.markOn = m;
}
const markMult = () => {
  const p = G.player;
  return (p?.cls === 'ranger' && p.markN) ? 1 + p.markN * MARK_STEP : 1;
};

/* 신앙도 같다 — 사제일 때만 열리는 얇은 문. */
export const faithGain = (n, why = '') =>
  G.player?.cls === 'priest' ? poolGain(n, why) : 0;

/* 사냥꾼의 몫 (레인저). The class lost its spell list this patch,
   which was the right call — it was casting the mage's book two
   points of intelligence short — but the list was quietly the
   only sustain the ranger had, and four more ways to deal damage
   did not replace it. It measured 8.2 floors with the book and
   5.7 without.
   So the breath comes back, and only to the hand that earns it:
   a kill made at arm's length pays nothing. That keeps the answer
   inside the class's own instruction — keep the gap — instead of
   handing back a worse mage. */
function quarry(m) {
  const p = G.player;
  if (p.cls !== 'ranger') return;
  if (Math.hypot(m.x - p.x, m.y - p.y) < QUARRY_RANGE) return;
  const heal = Math.max(1, Math.round(p.maxhp * QUARRY_HEAL));
  const before = p.hp, beforeStam = p.stam;
  p.hp = Math.min(p.maxhp, p.hp + heal);
  p.stam = Math.min(p.maxStam, p.stam + QUARRY_STAM);
  if (p.hp > before || p.stam > beforeStam)
    fx({ t:'quarry', x:p.x, y:p.y, hp: p.hp - before });
}

/* ── 피가 깎이는 단 한 자리 ──────────────────────────────
   여섯 군데가 저마다 `p.hp -= dmg`를 하고 저마다 tookHit을 불렀다.
   그중 넷은 인자 없이 불러서 화살도, 장판도, ? 방의 피해도 상처를
   남기지 않았다 — 「큰 한 방은 상처가 된다」가 근접 공격에만
   조용히 참이었던 셈이다.

   이제 피는 여기서만 깎인다. 상한도, 상처도, 숨 잠금도 한 자리에
   있으므로 새 피해원이 생겨도 규칙을 다시 적을 일이 없다.
   돌려주는 값은 「실제로 깎인 만큼」이라, 부르는 쪽은 그것을 그대로
   로그와 이펙트에 쓰면 된다 — 50을 맞았다고 적어 놓고 32만 깎는
   것은 연출이 아니라 거짓말이다.

   ── 절벽을 비탈로 ──
   죽기 10턴 전 체력 70%, 5턴 전 68%, 그리고 죽음. 이 판의 죽음은
   말라 죽는 것이 아니라 다섯 턴짜리 절벽이었고, 그래서 판의
   대부분을 멀쩡한 몸으로 걷게 된다 — 멀쩡하면 결정이 없다.

   한 방이 최대 체력의 BLOW_CAP을 넘으면 넘은 몫은 지금 깎이지
   않는다. 대신 그만큼이 통째로 상처가 된다. 빼앗기는 총량은 같다.
   달라지는 것은 그 총량이 한 턴에 오느냐 남은 판 내내 따라오느냐고,
   그 차이가 절벽과 비탈의 차이다. */
/* ── 그리고 죽음까지 삼킨다 ────────────────────────────────
   위 주석은 「이제 피는 여기서만 깎인다」고 선언해 놓았는데, 세어 보니
   통과하는 피해원이 여섯이고 **우회하는 곳이 여덟**이었다. 함정 셋,
   구덩이 둘, 독 물약, 독 틱, 스스로 진 빚. 거기에 잠긴 문과 항아리는
   `p.hp = 0; death(...)`를 손으로 재구현하고 있었다.

   결과가 셋이었다. 함정은 BLOW_CAP을 안 받아 **상한 없는 유일한
   피해원**이었고(실측: 최대 체력의 106%를 한 방에), 상처를 안 남기므로
   「절벽을 비탈로」가 함정에는 적용되지 않았고, `hurtAt`을 안 찍으므로
   **함정을 밟은 다음 턴에 회복이 재개**됐다 — 숨 잠금이 근접 공격에만
   조용히 참이었다.

   깔때기가 소수파면 그건 깔때기가 아니다. 그래서 죽음까지 여기서
   처리한다. 부르는 쪽이 `if (p.hp <= 0)`를 손으로 쓸 수 있는 한
   누군가는 반드시 다르게 쓴다. */
export function hurtPlayer(dmg, opt = {}) {
  const p = G.player;
  if (!p) return 0;
  const traceBefore = p.hp;
  /* 엘프의 대가 — 「몸이 약하다」. 몸의 이야기이므로 주문에는 안 붙는다.
     모든 피해가 이 문을 지나므로 여기 한 줄이면 화살도 도끼도 함정도
     같이 무거워진다. */
  {
    const up = raceRule(p, 'physUp');
    if (up && opt.weapon !== 'spell') dmg *= 1 + up;
  }
  let taken = Math.max(1, Math.round(dmg));
  let over = 0;
  const cap = Math.max(1, Math.round(p.maxhp * BLOW_CAP));
  if (taken > cap) { over = taken - cap; taken = cap; }
  /* 두 가지를 기록한다. 규칙이 아니라 기록이고, 읽는 것은 벤치뿐이다.

     하나는 상한이 지켜졌는가(taken/cap은 정의상 1을 못 넘는다).
     다른 하나는 **깔때기를 지난 피해의 총량**이다. 이쪽이 진짜다 —
     깔때기 안에서만 재면 깔때기를 **안 지나는** 피해는 영영 안 보인다.
     바깥에서 체력이 얼마나 줄었는지와 이 총량을 맞춰 보면, 설명되지
     않는 감소가 곧 우회다. 분모를 세 번 틀리고(한 턴에 둘이 때리면
     합쳐지고, 상처가 천장을 줄이고, 레벨업이 천장을 늘린다) 나서야
     이 방법에 도달했다. */
  G.blowRatio = Math.max(G.blowRatio || 0, taken / cap);
  /* ③ 사슬 갑주 크랙. 층마다 **첫 한 대는 사슬이 받는다.** 피해
     상한과 같은 자리에 두는 이유는 하나다 — 체력을 깎는 열한 군데가
     전부 이 깔때기를 지나므로, 여기 두면 어디서 맞아도 같다. */
  /* 전사의 버텨선다. 피해 깔때기 한 곳에서만 깎인다 — 열한 군데가
     전부 여기를 지나므로 어디서 맞아도 같다. */
  /* 무른 판 — 유리로 만든 칼이 가장 잘 든다. */
  if (hasArcana('brittle')) taken = Math.round(taken * 1.4);
  if ((p.brace || 0) > 0) taken = Math.max(1, Math.round(taken * STAND_CUT));
  /* 팔라딘의 불굴. 순교와 달리 빚이 없다 — 맹세 다섯이 그 값이다. */
  if ((p.bulwark || 0) > 0 && p.hp - taken < 1) taken = Math.max(0, p.hp - 1);
  if (cracked('chain') && !G.chainGuard) {
    G.chainGuard = 1;
    fx({ t:'resist', x:p.x, y:p.y });
    say('사슬이 대신 울렸다.', 'good');
    if (opt.combo !== false) breakCombo(false);
    return 0;
  }
  G.funnelled = (G.funnelled || 0) + taken;
  /* 마지막 몇 대. 끝 화면이 「왜 죽었는지」를 말하려면 죽기 직전의
     서너 턴이 남아 있어야 하고, 그건 이 깔때기 말고는 아무도 모른다. */
  (G.lastBlows ||= []).push({ by: opt.by || '무언가', dmg: taken,
    left: Math.max(0, p.hp - taken), max: p.maxhp, turn: G.turn, depth: G.depth });
  if (G.lastBlows.length > 6) G.lastBlows.shift();
  ledger('hit');
  p.hp -= taken;
  if (opt.combo !== false) breakCombo(false);
  tookHit(taken, over);
  if (p.hp <= 0) {
    /* **0으로 자르지 않고** 넘긴다. death()의 순교 분기가 빚을
       `1 - p.hp`로 적는데, 여기서 먼저 0을 만들면 그 빚이 **언제나
       정확히 1**이 된다 — 체력 3에서 999를 맞아도 1. 순교 다섯 턴이
       「막아 낸 만큼 갚는 내기」가 아니라 총 빚 1~5짜리 무료 무적이
       되어 있었다. 회수한 여덟 곳도 전부 이렇게 하고 있었으므로
       회귀는 아니지만, 한 곳으로 모았으니 한 곳에서 고친다.
       화면용 0 자르기는 death()가 알아서 한다. */
    fx({ t:'death', x:p.x, y:p.y });
    death(typeof opt.by === 'string' ? { n: opt.by }
        : opt.by || { n: opt.who || '알 수 없는 것' });
  }
  /* 기록. 층 요약이 읽는 값이라 여기 한 곳에서만 센다 — 피해가
     들어오는 자리는 이 함수 하나다. */
  /* 되갚기가 먹는 것. 「이 층에서 받은 양」이라 층이 바뀌면 비운다 —
     판 전체를 모으면 15층에서 한 방에 방이 지워진다. */
  p.tookPool = (p.tookPool || 0) + taken;
  const ft = G.floorTally;
  if (ft) {
    ft.took += taken;
    ft.lowHp = Math.min(ft.lowHp, Math.max(0, p.hp));
    /* 죽을 뻔한 순간은 요약이 아니라 사건이다 — 언제 어디서 누구에게
       몰렸는지가 「왜 쉬웠나 / 왜 어려웠나」의 대부분이다. */
    if (traceBefore > p.maxhp * 0.25 && p.hp <= p.maxhp * 0.25 && p.hp > 0)
      trace('close', { by: (typeof opt.by === 'string' ? opt.by : opt.by?.n) || opt.who || '?',
                       hp: `${Math.max(0, p.hp)}/${p.maxhp}`, near: crowdedBy(p) });
  }
  return taken;
}

/* ── 천장을 되돌리는 단 하나의 문 ─────────────────────────
   상처를 지우는 길이 하나뿐이었다: 모닥불에 앉아 기름 260과 살
   8%를 내는 것. 모닥불은 층마다 서지 않으므로, 나쁜 층을 하나 겪으면
   그 판의 나머지를 깎인 천장으로 걸어야 했다 — 플레이어가 「흉터가
   지면 너무 플레이에 제약이 크다」고 한 자리가 여기다.

   그렇다고 아무 물약이나 상처를 닫으면 상처가 상처가 아니게 된다.
   그래서 **비싼 쪽만** 닫는다. 중상 치유 물약과 중상 치유 주문은
   원래 「깊은 상처까지 되돌린다」고 써 있으면서 실제로는 기본 물약과
   숫자만 다른 물건이었다 — 이제 그 문장이 규칙이 된다.

   문은 하나다. 불도 물약도 주문도 여기를 지난다. */
export function mendWound(share, why = '') {
  const p = G.player;
  const had = p.wound || 0;
  if (had <= 0) return 0;
  const mend = Math.max(1, Math.round(had * share));
  p.wound = Math.max(0, had - mend);
  recalc(p);
  /* 천장이 올라가면 그만큼 담긴다. 안 그러면 「최대 체력이 늘었다」고
     써 놓고 눈금은 그대로인 화면이 된다. */
  p.hp = Math.min(p.maxhp, p.hp + mend);
  fx({ t:'levelup', x:p.x, y:p.y });
  if (why) say(`${why} 견딜 수 있는 몸이 ${mend} 돌아왔다.`, 'level');
  return mend;
}

function tookHit(dmg = 0, over = 0) {
  const p = G.player;
  /* You cannot catch your breath while something is hitting you.
     Stamped here rather than at the two damage sites so an arrow
     counts the same as an axe. */
  p.hurtAt = G.turn;
  /* 상처도 같은 자리에서 남는다. 큰 한 방만 천장을 깎는다 —
     스치는 것마다 상처가 되면 그것은 상처가 아니라 그냥 피해다.
     천장은 recalc이 다시 세우므로 여기서는 값만 얹는다. */
  /* ── 나선을 끊는다 ──────────────────────────────────────
     문턱이 `p.maxhp * WOUND_AT`였는데, 그 `p.maxhp`는 **이미 상처로
     깎인 천장**이다. 그래서 상처가 쌓일수록 다음 상처를 받는 문턱이
     낮아졌다 — 기준 체력 24에 매번 똑같은 5피해면
         1번째 천장 24 문턱 2.4 → 2번째 천장 21 문턱 2.1
         → 3번째 천장 18 문턱 1.8 → 4번째 천장 15 문턱 1.5
     네 대에 상한(45%)까지 간다. TRPG 넷이 실제로 이걸로 죽었고
     (마법사가 최대체력 8에서 3피해 물기에), GM의 부검(죽을 때 상처로
     잃은 몸 평균 42%)과 UX의 스크린샷(46→27)이 같은 것을 봤다.

     문턱은 **원래 천장**으로 잰다. 상처는 여전히 쌓이지만, 쌓인다고
     해서 더 쉽게 쌓이지는 않는다 — 비탈이지 낭떠러지가 아니다. */
  const roof = p.maxhp + (p.wound || 0);
  if (over > 0 || dmg >= roof * WOUND_AT) {
    const w = Math.max(1, Math.round(dmg * WOUND_SHARE * (raceRule(p, 'woundCut') ?? 1)) + over);
    p.wound = (p.wound || 0) + w;
    recalc(p);
    say(`상처가 남았다. 견딜 수 있는 몸이 ${w}만큼 줄었다.`, 'hit');
    fx({ t:'ail', x:p.x, y:p.y, kind:'wound' });
  }
  if (hasRelic('grudge')) p.grudge = Math.min(cracked('grudge') ? 30 : 15, (p.grudge || 0) + 1);
  /* 맹세 (팔라딘). Every blow taken hardens him a little more.
     Sits here rather than in the two damage sites so it counts
     an arrow the same as an axe. */
  // 맹세의 방패: a paladin behind a shield swears twice as fast,
  // which is the whole reason to give up the second weapon.
  /* 맹세 (팔라딘) · 신앙 (사제). 둘 다 「맞으면 찬다」이므로 한
     자리에서 센다 — 화살이든 도끼든 같은 한 대다. 맹세의 방패를
     낀 팔라딘은 두 배로 맹세한다. */
  poolOnHurt(dmg, p.cls === 'paladin' && fitRule(p, 'twiceSworn') ? 2 : 1);
}

/* How long after a blow before the body starts closing again,
   and how far it will go on its own. 체질 buys both — a dumped
   constitution now means bad fights stay with you. */
export const BREATH = 10;
/* Measured at 0.50: floors five and six went from 13% of runs to
   24%, and the share reaching floor 11 fell six points. The
   lockout is the interesting half of this change — you cannot
   breathe while something is hitting you — so that stays at ten
   turns and the ceiling gives a little back instead. */
/* And then it stopped being enough. Measured over 24 runs: 57% of
   turns sat at 90–100% health and not one turn fell below 30%,
   because a ceiling of 46–82% refilled for free every ten quiet
   turns and 87% of turns are quiet. Wounds alone could not bend
   that line — they lower the bar the percentage is taken of, so
   the *shape* stayed flat.

   So the ceiling itself falls. Two terms, both of them things the
   player did: how torn up the body already is, and how far down it
   was carried. Deep and whole still breathes back to most of the
   bar; deep and half-ruined does not breathe back at all. */
/* 0.9로 재니 봇의 평균 도달 층이 6.7 → 4.1로 내려앉았다. 원했던
   방향이지만 한 번에 두 층 반은 조정이 아니라 사고다. */
/* ── 세 자원, 세 능력치 ───────────────────────────────────
   체력은 이미 체질이 정하고 있었다 — 얼마나 자주 닫히는지(beat)도,
   어디까지 닫히는지(breathRoof)도. 나머지 둘은 아무 능력치도 안
   읽었다: 기력은 모두에게 2턴 고정, 마나는 모두에게 10턴 고정.
   그래서 지혜는 사실상 **아무 일도 안 하는 능력치**였다.

   이제 셋이 갈린다:
     체력 ← 체질   8턴@10 · 5턴@18 · 12턴@5   (있던 것)
     기력 ← 민첩 + 직업의 차는 규칙 (POOL)
     마나 ← 지혜   12턴@10 · 8턴@18 · 15턴@5

   기력 쪽은 직업이 먼저다. 전사·궁수는 2턴, 도적은 6턴이지만 안
   보이면 매 턴, 사제는 9턴이지만 맞으면 즉시, 팔라딘은 7턴이지만
   맞고 죽이면 즉시 — 통을 합치면서 잃을 뻔한 직업의 얼굴이 전부
   이 표 하나에 들어와 있다. 민첩은 그 위에서 최대 40%까지 당긴다. */
export function stamEvery(p) {
  const base = POOL[p?.cls]?.every ?? STAM_REGEN_EVERY;
  const quick = Math.max(0, statB(p, 'dex'));
  return Math.max(1, Math.round(base * Math.max(0.6, 1 - 0.1 * quick)));
}
export function manaEvery(p) {
  const wise = statB(p, 'wis');
  /* 종족이 속도를 곱한다. 간격이므로 **나눈다** — 2배로 빨리 돌아온다는
     것은 간격이 절반이라는 뜻이다. 처음에 곱했다가 엘프가 가장 느려졌다. */
  return Math.max(3, Math.round(clamp(12 - wise * 2, 6, 18) / (raceRule(p, 'manaFast') || 1)));
}

export const BREATH_WEAR = 0.7;    // 상처가 천장을 끌어내리는 비율
export const BREATH_DEEP = 0.012;  // 4층 아래로 한 층마다
export const breathRoof = p => {
  const base = clamp(0.56 + statB(p, 'con') * 0.055, 0.46, 0.82);
  const worn = (p.wound || 0) / Math.max(1, p.maxhp + (p.wound || 0));
  const deep = Math.max(0, (G.depth || 0) - 4) * BREATH_DEEP;
  return clamp(base - worn * BREATH_WEAR - deep, 0.18, 0.82);
};

/* Lit once, and it stays lit: a resonance is a turning point, not
   a buff with an uptime. Checked after recalc because that is the
   one place gearBonus is known to be current — swapping a weapon,
   forging a plus, taking a relic and cutting an engraving all end
   up here. */
export function checkResonance(p) {
  if (!p) return;
  p.reso = p.reso || {};
  const g = gearBonus(p);
  for (const r of RESONANCE) {
    if (p.reso[r.id] || !r.need(g, p)) continue;
    p.reso[r.id] = true;
    G.resoFound = (G.resoFound || 0) + 1;
    Meta.see('reso', r.id);
    say(`공명 — ${r.n}. ${r.say}`, 'level');
    lore('공명', r.n, `${r.t}\n${r.say}`, r.spr);
    fx({ t:'transcend', x:p.x, y:p.y, word:'공명' });
  }
}
export const hasResonance = id => !!G.player?.reso?.[id];

/* How many of a resonance's pieces are in hand, for the screen
   that shows what is missing. A lottery nobody can see the
   tickets of is not a hunt, it is a surprise. */
export function resonanceState(id) {
  const r = resonanceById(id);
  if (!r) return null;
  const p = G.player;
  return { id, lit: !!p?.reso?.[id], can: p ? r.need(gearBonus(p), p) : false };
}

function breakCombo(hard) {
  if (!G.combo) return;
  // 전쟁 북: a hit costs a quarter of the chain rather than half.
  if (hasRelic('march') && !hard) return;
  if (!hard && cracked('drum')) return;
  const left = hard ? 0 : (hasRelic('drum') ? Math.round(G.combo * 0.75) : G.combo >> 1);
  if (left < G.combo) fx({ t:'comboDrop', from: G.combo, to: left });
  G.combo = left;
  if (!G.combo) G.comboT = 0;
}

/* ── class traits ─────────────────────────────────────────
   One counter per class, all of them living on the player and
   all of them read in exactly one place. The HUD prints this,
   so a player can watch the thing fill and time it. */
export function traitState() {
  const p = G.player;
  if (!p) return null;
  const spec = CLASSES[p.cls].trait;
  if (!spec) return null;
  switch (p.cls) {
    case 'warrior': return { ...spec, at: p.chain3 || 0, ready: (p.chain3 || 0) >= 2 };
    case 'mage': {
      const e = liveEcho(p);
      return { ...spec, at: e ? 1 : 0, max: 1, ready: !!e,
               note: e ? `${e.n} — ${e.t}` : '' };
    }
    case 'ranger':  return { ...spec, at: p.markN || 0, ready: (p.markN || 0) >= 5,
                             note: p.markN ? `+${Math.round((p.markN) * 9)}%` : '' };
    /* 셋 다 같은 통을 읽는다. 다른 것은 이름과 「쓸 만한가」의 문턱뿐. */
    case 'paladin':
    case 'rogue':
    case 'priest': {
      const need = p.cls === 'rogue' ? 2 : 3;
      return { ...spec, at: p.stam || 0, max: p.maxStam || 0,
               ready: (p.stam || 0) >= need,
               note: p.stam ? `${poolName(p.cls)} ${p.stam}` : '' };
    }
  }
  return spec;
}

/* 응답: the priest heals harder the worse it is going. Every
   restore in the game funnels through here so the trait cannot
   be true of the potion and false of the spell. */
/* ── 몸이 물약에 익숙해진다 ────────────────────────────────
   장부를 떠 보니(sim/mend.mjs) **맞은 것의 87.5%를 도로 회복하고
   있고, 그 회복의 81.5%가 물약**이다. 그래서 판이 아무 데도 안
   아프다: 체력 30% 아래에서 보낸 턴이 0%이고, 70% 위에서 보낸 턴이
   79%다(sim/tension.mjs). 몬스터가 약해서가 아니다 — 깊은 층에서
   세 대면 죽는다(층 13에서 3.5대). 세 대가 연달아 들어오지 않을 뿐이고,
   연달아 들어오지 않는 이유가 물약이다.

   그렇다고 물약을 약하게 만들면 첫 병부터 약해진다. 문제는 첫 병이
   아니라 **네 번째 병**이다. 그래서 값을 병이 아니라 **연달아 마시는
   것**에 매긴다: 한 층에서 마실수록 몸이 덜 답한다(−22%씩, 바닥 34%).
   층을 내려가거나 불 앞에 앉으면 셈이 풀린다.

   이야기 쪽에서도 이게 맞다. 이 게임의 몸은 이미 아물지 않는 천장을
   가졌다 — 그 몸이 물약 다섯 병에 똑같이 답하는 것이 오히려 이상했다. */
export const TOLERANCE_STEP = 0.22;
export const TOLERANCE_FLOOR = 0.34;

/* 층을 내려간다고 셈이 풀리지는 않는다 — 한 층에 한 번씩 지워 봤더니
   깊은 층에서 판당 다섯 병씩 마시며 회복률이 여전히 88~93%였다.
   계단은 쉬는 자리가 아니다. 대신 층마다 하나씩 삭는다: 걸으면서
   조금씩 빠지되, 제대로 지우려면 불 앞에 앉아야 한다. */
export function walkOffTolerance() {
  if (G.gulped > 0) G.gulped--;
}

export const healScale = () => {
  const p = G.player;
  const priest = (p?.cls === 'priest' && p.hp < p.maxhp * 0.5) ? 1.6 : 1;
  const drunk = G.gulped || 0;
  const dulled = Math.max(TOLERANCE_FLOOR, 1 - TOLERANCE_STEP * drunk);
  /* 「저절로 아무는 몸은 병에 덜 답한다」 — 트롤과 하프오크의 대가가
     여기 하나에 걸린다. 회복은 전부 이 문을 지나므로 물약도 주문도
     모닥불도 같이 준다. */
  return priest * dulled * (raceRule(p, 'potion') ?? 1);
};

/* 회복을 쓴 것을 센다. 세는 자리가 healScale 옆이어야 둘이 갈리지
   않는다 — 하나는 값을 매기고 하나는 세는데, 서로 다른 조건으로
   세면 언젠가 「마셨는데 안 세는」 물약이 생긴다. */
export function tookDraught() {
  G.gulped = (G.gulped || 0) + 1;
  if (G.floorTally) G.floorTally.gulps++;
  ledger('gulp');
  if (G.gulped === 3) say('세 번째다. 몸이 아까만큼 답하지 않는다.', 'warn');
}

export const spellList = p => {
  const realm = CLASSES[p.cls].realm;
  return realm ? SPELLS[realm].filter(s => s.lv <= p.lv) : [];
};

/* The arts ride the same row, the same keys and the same tooltip
   as spells — they differ in what they spend and in that they are
   the class's own rather than a realm's. `artList` is the funnel;
   nothing outside it should read ARTS directly. */
export const artList = p => (ARTS[p?.cls] || []).filter(a => a.lv <= p.lv);
export const artById = (p, id) => artList(p).find(a => a.id === id);

/* Spells that do nothing at all without something in sight. */
const TARGETED = ['bolt', 'smite'];

/* The whole book at once — always the same five, always in the
   same order, with what is not yet learned shown as a locked
   frame rather than left out. A row that grows as you level is a
   row you misfire on, and the point of putting spells on the
   play screen is that casting stops costing a screen change. */
/* 이 기예가 지금 얼마인가. 세 곳이 이 답을 본다 — 칸에 찍는 숫자,
   낼 수 있는지 보는 검사, 실제로 빼는 자리. 하프트롤은 기예마다 하나씩
   더 내므로, 셋 중 하나라도 딴 셈을 쓰면 「눌리는데 안 나가는 버튼」이
   생긴다. 이 저장소가 이미 두 번 겪은 사고다. */
/* 이것을 익혔는가. 하프엘프는 두 레벨 일찍 연다 — 문턱을 낮추는 것이
   아니라 **읽는 쪽**을 바꾼다(표에 적힌 12는 12인 채로 남는다).
   문이 하나여야 하는 이유는 기예와 주문이 같은 답을 봐야 하기
   때문이다: 「기예만 일찍 열리는 하프엘프」는 아무도 설명 못 한다. */
export const learned = (p, x) => (x?.lv || 0) <= (p?.lv || 0) + (raceRule(p, 'early') || 0);

export const artCost = (p, a) =>
  a?.floorOnce ? 0 : Math.max(0, (a?.stam || 0) + (raceRule(p, 'artUp') || 0));

export function spellSlots() {
  const p = G.player;
  if (!p) return [];
  const realm = CLASSES[p.cls].realm;
  /* A bolt with nothing to shoot at stays dark. The row doubles
     as a read of the room that way. */
  const seen = G.level && G.monsters.some(m => G.level.vis[idx(m.x, m.y)]);

  /* Arts come first in the row, because a class that has them
     leads with them. 침묵의 서약 takes spells, not hands — an art
     is not spoken. */
  const arts = (ARTS[p.cls] || []).map(a => {
    const locked = !learned(p, a);
    const near = G.level && adjacentMonsters(p).length > 0;
    /* The row has to grey out on exactly the tests useArt refuses
       on, or the button lies. It only knew about the arts that
       need a body, so the three shooting arts read as live with no
       bow and no clear line — useArt then declined and, costing no
       turn, handed anything looping on the row an infinite loop.
       Measured on a headless bot: every ranger run stalled inside
       14 turns, pressing 조준 사격 301.6 times a run. */
    const noTarget = (ART_NEEDS_BODY.includes(a.id) && !near)
                  || (ART_NEEDS_SHOT.includes(a.id) && !(G.level && shotTarget()))
                  || (ART_NEEDS_SIGHT.includes(a.id) && !(G.level && visibleMonsters().length))
                  || (ART_NEEDS_WATCHER.includes(a.id) && !(G.level && awakeWatchers().length));
    return {
      id: a.id, name: a.name, short: a.short || a.name.slice(0, 3),   // 두 글자로 자르면 「마무」가 된다
      /* 「층에 한 번」은 값이 자원이 아니라 **횟수**다. 그래서 셋 다
         0인 기예가 생겼고, `a.faith || a.oath || a.shade || a.stam` 이
         undefined 로 떨어져 칸에 「불굴undefined」가 찍혔다. 값이
         없는 것과 값을 모르는 것은 다르다 — 0으로 내려놓고, 무엇이
         값인지는 floorOnce 가 따로 말한다. */
      lv: a.lv, cost: artCost(p, a), art: true, stam: artCost(p, a),
      floorOnce: !!a.floorOnce, spent: !!a.floorOnce && !!(G.floorArts || {})[a.id],
      locked, silent: false, noTarget,
      plus: 0, affix: null,
      /* 이 층에서 이미 쓴 기예는 칸도 식어 있어야 한다. useArt 는
         거절하는데 칸은 밝게 켜져 있었다 — 눌러 보고 아는 것은 한 번
         속은 것이다. */
      ready: !locked && !noTarget
             && !(a.floorOnce && (G.floorArts || {})[a.id])
             && p.stam >= artCost(p, a),
    };
  });
  if (!realm) return arts;

  const silent = hasRelic('vow');
  return arts.concat(SPELLS[realm].map(s => {
    const locked = !learned(p, s);
    const cost = spellCost(p, s);
    const noTarget = TARGETED.includes(s.id) && !seen;
    return {
      id: s.id, name: s.name, short: s.short || s.name.slice(0, 3),
      lv: s.lv, cost, locked, silent, noTarget,
      plus: p.spellPlus?.[s.id] || 0,
      affix: p.spellAffix?.[s.id] || null,
      ready: !locked && !silent && !noTarget && p.mana >= cost,
    };
  }));
}

/* ── inventory ──────────────────────────────────────────── */
export const makeConsumable = id => ({ kind:'use', ...CONSUMABLES.find(c => c.id === id) });
/* Ammunition stacks the way flasks do — one line in the pack that
   counts down, not twenty arrows taking twenty slots. */
export const makeQuiver = id => ({ kind:'quiver', slot:'quiver', ...quiverById(id) });

export const PACK_MAX = 20;
/* 한 줄이 몇 칸인가. 정체를 모르는 물약·두루마리는 반 칸이다 —
   생김새가 열 가지라 한 종류씩만 주워도 배낭의 절반이 도박으로
   차 버렸고, 그래서 도박을 줍지 않게 됐다. 미지를 들고 다니는
   값이 「배낭을 포기하는 것」이면 아무도 안 든다. */
/* ── 더미 한 칸에 몇 개까지 ────────────────────────────────
   상한이 없었다. 「같은 물약은 한 줄에 쌓인다」는 옳은 편의였는데,
   `slotCost`가 **수량을 안 봤다** — 재 보니 치유의 물약 303개가 배낭
   두 칸을 차지한다. 그래서 회복의 79%가 물약 하나에서 나오고, 회복률이
   손실의 91%가 되고, 그 위에서 잰 직업 순위가 전부 「소모품 없는
   영웅에서 누가 버티는가」가 됐다.

   상한을 두되 줄을 막지는 않는다: STACK_MAX개가 한 칸이고, 넘으면
   다음 칸이 열린다. 그러면 「물약을 얼마나 지고 갈 것인가」가 배낭
   스무 칸과 같은 저울 위에 올라온다 — 지금은 공짜다. */
export const STACK_MAX = 8;
export const slotCost = slot => {
  if (!slot?.item) return 1;
  const stacks = Math.max(1, Math.ceil((slot.qty || 1) / STACK_MAX));
  if (slot.item.kind === 'use' && !isKnown(slot.item.id)) return 0.5 * stacks;
  return stacks;
};
export const packUsed = p =>
  (p?.pack || []).reduce((s, slot) => s + slotCost(slot), 0);
/* 얼마나 찼는가 (0~1). 화면과 규칙이 같은 한 줄을 읽는다 —
   막대가 부르는 값과 벌이 매기는 값이 갈라지면 그건 벌이 아니라 버그다. */
export const packLoad = p => packUsed(p) / PACK_MAX;
export const HEAVY_AT = 0.60;      // 숨이 늦게 돌아오기 시작하는 지점
export const LADEN_AT = 0.85;      // 손이 굼떠 기름이 빨리 타는 지점

/* Will this item find a home? Asked *before* the floor lets go of
   it. addItem used to answer by refusing after the caller had
   already spliced the thing out of G.items, which meant a full
   pack did not stop a pickup — it deleted the item. A rare drop
   walked over with twenty slots full simply ceased to exist, and
   the only trace was one line in the log. */
export function packRoom(p, item) {
  if (!item) return false;
  if (item.kind === 'use' || item.kind === 'cat')
    if (p.pack.some(s => s.item.id === item.id)) return true;   // stacks
  return packUsed(p) + slotCost({ item }) <= PACK_MAX;
}

export function addItem(p, item, qty = 1) {
  // Catalysts stack the same way flasks do — you carry three
  // 정련의 촉매, not three separate lines in the pack.
  if (item.kind === 'use' || item.kind === 'cat') {
    const slot = p.pack.find(s => s.item.id === item.id);
    if (slot) {
      /* 더미에 얹을 때도 자리를 센다. 안 세면 상한이 새어 나간다 —
         한 줄에 쌓는 길만 열려 있으면 「같은 물약은 한 칸」이 그대로
         돌아온다. */
      const was = slotCost(slot);
      const now = slotCost({ item, qty: slot.qty + qty });
      if (packUsed(p) - was + now > PACK_MAX) { say('배낭이 가득 찼다.', 'warn'); return false; }
      slot.qty += qty;
      return true;
    }
  }
  if (packUsed(p) + slotCost({ item }) > PACK_MAX) { say('배낭이 가득 찼다.', 'warn'); return false; }
  p.pack.push({ item, qty });
  /* 이 판에 손에 들어온 장비와, 그중 흔치 않은 것. 「희귀장비도 너무
     많이 나옴」은 확률표가 아니라 여기서 세야 하는 말이다 — 한 판을
     끝까지 살면 표에 적힌 3.5%도 열다섯 층 동안 곱해진다. */
  if (item.kind === 'weapon' || item.kind === 'armour') {
    G.gearTaken = (G.gearTaken || 0) + 1;
    if (item.unique || item.pre || item.suf) G.rareTaken = (G.rareTaken || 0) + 1;
  }
  return true;
}

export function removeItem(p, slotIdx, qty = 1) {
  const slot = p.pack[slotIdx];
  if (!slot) return;
  slot.qty -= qty;
  if (slot.qty <= 0) p.pack.splice(slotIdx, 1);
}

/* 착용도 등급을 보여 준다. 여태 초월 무기를 드는 것과 낡은 단검을
   드는 것이 같은 초록 한 줄이었다 — 손에 쥐는 순간이 아무 일도
   아니면, 그 물건을 찾아다닐 이유도 한 줄 줄어든다. */
function wieldFx(it, line) {
  const p = G.player, g = rarityOf(it);
  say(line, g >= 2 ? 'level' : 'good');
  if (g >= 1) fx({ t:'wield', x:p.x, y:p.y, rar:g, spr:it.spr });
}

/* 이 손에 안 들리는 물건인가. 거절하는 **이유**를 돌려준다 — 없으면
   null. 문이 하나여야 하는 이유가 바로 아래 줄에 있다: equip 은 거절할
   때 턴을 안 쓰므로, 화면이나 봇이 이 판정을 따로 갖고 있다가 어긋나면
   「눌러도 아무 일이 없는 버튼」이 되고 봇은 거기서 영영 돈다.
   이 저장소는 이미 그 사고를 두 번 겪었다(양손 무기 + 방패, 조준 사격). */
export const cantHold = (p, it) => {
  if (it?.kind !== 'weapon') return null;
  /* 직업이 막는 것과 종족이 막는 것. 둘 다 같은 문을 지나야 화면·규칙·
     봇이 같은 답을 본다 — 봇은 거절당한 무기를 영원히 「더 좋은 것」으로
     보고 그 자리에서 돈다. */
  if (raceRule(p, 'noTwoHand') && it.hands === 2)
    return '두 손으로 들 물건이 아니다 — 이 몸에는 너무 크다.';
  return CANT_HOLD[p?.cls]?.[it.t] || null;
};

export function equip(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot) return;
  const it = slot.item;
  if (it.kind === 'weapon') {
    /* ── 손에 안 맞는 물건 ──────────────────────────────────
       플레이어: 「전사는 활이랑 지팡이 아예 착용하지 못하게.」

       전사의 기예 넷은 전부 **무기가 정한 모양**으로 나간다 — 연격은
       계열 규칙을 그대로 빌려 쓰고, 소용돌이는 인접한 것을 벤다.
       활을 든 전사는 그 넷이 전부 이상해지고, 지팡이를 든 전사는
       주문도 못 쓰면서 막대기로 때린다. 「쓸 수는 있는데 나쁘다」는
       선택이 아니라 함정이다 — 판을 열 층쯤 걸어 본 뒤에야 알게 되는.

       그래서 아예 안 들린다. 거절은 값이 아니라 문장으로 한다. */
    const no = cantHold(p, it);
    if (no) { say(no, 'warn'); return; }
    const old = p.equip.weapon;
    p.equip.weapon = it;
    removeItem(p, slotIdx);
    if (old) addItem(p, old);
    if (it.hands === 2 && p.equip.shield) { addItem(p, p.equip.shield); p.equip.shield = null; say('양손 무기라 방패를 내렸다.'); }
    // The weapon-family ledger. This line used to live in the
    // armour branch behind a `kind === 'weapon'` test, which is
    // never true there — so 무기 계열 sat at 0/6 no matter what
    // the player picked up.
    if (it.t) Meta.see('weapons', it.t);
    wieldFx(it, `${nameOf(it)}을(를) 들었다.`);
  } else if (it.kind === 'armour' || it.kind === 'quiver') {
    const key = it.slot;
    if (key === 'shield' && p.equip.weapon?.hands === 2) { say('양손 무기를 든 채로는 방패를 들 수 없다.', 'warn'); return; }
    const old = p.equip[key];
    p.equip[key] = it;
    removeItem(p, slotIdx);
    if (old) addItem(p, old);
    wieldFx(it, `${nameOf(it)}을(를) 착용했다.`);
  }
  endTurn();
}

/* ── salvage ──────────────────────────────────────────────
   The answer to "why is all this gear dropping". A weapon you
   will never wear is no longer litter; it is either coin at the
   merchant or material at the fire, and you cannot have both. */
/* A named weapon is neither scrap nor a candidate for the anvil.
   Melting 《약속》 for two dust, or plussing it into an ordinary
   +7, would make the one-of-a-kind into a resource. */
/* 소모품과 화살통도 부술 수 있다. 나오는 것은 부스러기 몇뿐이고
   그게 맞다 — 여기서 묻는 것은 「이게 재료로 값어치가 있는가」가
   아니라 「나쁜 물약 한 병이 열 층 내내 배낭 한 칸을 잡고 있어야
   하는가」다. 답은 아니오였다. */
export const canSalvage = it =>
  !!it && !it.unique
  && (it.kind === 'weapon' || it.kind === 'armour'
      || it.kind === 'use' || it.kind === 'quiver' || it.kind === 'cat');

/* 그리고 부술 수도 없는 것 — 이름이 붙은 물건 — 은 바닥에 내려
   놓는다. 여태 이 게임에는 「버린다」는 동사 자체가 없었다. 안
   쓰는 고유 무기 하나가 배낭 한 칸을 판이 끝날 때까지 붙들었고,
   플레이어에게는 그걸 어떻게 할 방법이 없었다. 부수지 못하게
   막은 규칙은 지킨다 — 《약속》은 여전히 가루가 되지 않는다.
   다만 내려놓을 수는 있고, 마음이 바뀌면 다시 주우면 된다. */
export function dropItem(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot) return false;
  const it = slot.item, qty = slot.qty;
  if (G.items.some(o => o.x === p.x && o.y === p.y)) {
    say('발밑에 이미 뭔가 있다.', 'warn'); return false;
  }
  removeItem(p, slotIdx, qty);
  G.items.push({ ...it, qty, x: p.x, y: p.y });
  say(`${nameOf(it)}을(를) 내려놓았다.`);
  fx({ t:'drop', x: p.x, y: p.y, rar: rarityOf(it) });
  endTurn();
  return true;
}

export const salvagePreview = it => (canSalvage(it) ? salvageYield(it) : null);

export function salvage(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot || !canSalvage(slot.item)) return;
  const it = slot.item;
  const got = salvageYield(it);

  p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
  const parts = [];
  /* 탐욕의 판이 약속한 「많이 벌고」의 둘째 절 — 카드에는 적혀 있고
     코드에는 없었다. */
  const mult = (G.branch?.mats || 1) * (hasBoon('hoard') ? 1.6 : 1)
             * (hasArcana('greed') ? 2 : 1);
  for (const k of ['scrap', 'dust', 'essence']) {
    if (!got[k]) continue;
    got[k] = Math.round(got[k] * mult);
    p.mats[k] += got[k];
    parts.push(`${MATS[k].n} ${got[k]}`);
  }
  removeItem(p, slotIdx);
  say(parts.length ? `${affixName(it)}을(를) 부쉈다 — ${parts.join(' · ')}.`
                   : `${affixName(it)}은(는) 아무것도 남기지 않았다.`, 'good');
  fx({ t:'salvage', x:p.x, y:p.y });
}

export const mats = () => G.player?.mats || { scrap: 0, dust: 0, essence: 0 };

export function canAfford(cost) {
  const p = G.player;
  if (!p || !cost) return false;
  if ((cost.gold || 0) > p.gold) return false;
  const m = mats();
  for (const k of ['scrap', 'dust', 'essence'])
    if ((cost[k] || 0) > (m[k] || 0)) return false;
  return true;
}

function spend(cost) {
  const p = G.player;
  p.gold -= cost.gold || 0;
  for (const k of ['scrap', 'dust', 'essence']) p.mats[k] -= cost[k] || 0;
}

/* 값을 물린다. 막는 판정이 값보다 앞에 있어야 하는 것이 원칙이지만,
   접사 뽑기처럼 값을 치른 뒤에야 「나올 것이 없다」를 알 수 있는
   자리가 하나 있다. 거기서는 되돌려준다. */
function refund(cost) {
  const p = G.player;
  p.gold += cost.gold || 0;
  for (const k of ['scrap', 'dust', 'essence']) p.mats[k] += cost[k] || 0;
}

export const costText = cost => [
  cost.gold ? `${cost.gold}금` : null,
  cost.scrap ? `${MATS.scrap.n} ${cost.scrap}` : null,
  cost.dust ? `${MATS.dust.n} ${cost.dust}` : null,
  cost.essence ? `${MATS.essence.n} ${cost.essence}` : null,
].filter(Boolean).join(' · ');

/* ── quick slots ──────────────────────────────────────────
   A potion two taps away in a menu is a potion you die holding.
   Three fixed roles, filled automatically from the pack, so the
   common case — drink the heal, right now — is one tap and needs
   no inventory management at all.

   Deliberately role-based rather than player-assigned: assigning
   slots is another system to learn, and the whole point here is
   fewer things to manage. Anything that does not fit a role is
   still in the pack. */
const QUICK_ROLES = [
  { key:'heal',  n:'회복', want: it => it.use === 'bigHeal' || it.use === 'heal',
    rank: it => (it.use === 'bigHeal' ? 2 : 1) },
  { key:'boost', n:'강화', want: it => ['mana', 'might', 'iron'].includes(it.use),
    rank: it => (it.use === 'mana' ? 2 : 1) },
  { key:'out',   n:'탈출', want: it => ['flee', 'teleport'].includes(it.use),
    rank: it => (it.use === 'flee' ? 2 : 1) },
  /* ── 불은 제 칸을 갖는다 ────────────────────────────────
     횃불이 「탈출」에 묶여 있었고, 순위가 flee 3 > teleport 2 > torch 1
     이라 **도주 두루마리를 하나라도 주우면 그 버튼은 더 이상 불을
     안 켰다.** UX와 서아(TRPG)가 따로 같은 것을 봤다.

     이 게임은 스스로 「시야는 장식이 아니라 자원」이라고 말한다. 그
     자원의 보충 수단이 자원 이름과 아무 관련 없는 단어 뒤에 있었고,
     시작 안내는 「기름부터 챙기세요」라고 못박는다. HUD의 `불 55`가
     빨갛게 깜빡여도 누를 것을 못 찾는다.

     그리고 어둠이 이제 예고를 가리므로, 이 칸은 더 이상 편의가 아니라
     싸움의 일부다. 강화 칸은 초반 내내 비어 있으니 자리도 있다. */
  { key:'torch', n:'불', want: it => it.use === 'torch', rank: () => 1 },
];

/* Unknown flasks never get a quick slot. Auto-drinking something
   you have not identified would hand the gamble to the UI. */
export const QUICK_LABELS = QUICK_ROLES.map(r => r.n);

export function quickSlots() {
  const p = G.player;
  if (!p) return [];
  return QUICK_ROLES.map(role => {
    let best = -1, bestRank = -1;
    p.pack.forEach((slot, i) => {
      const it = slot.item;
      if (it.kind !== 'use' || !isKnown(it.id) || !role.want(it)) return;
      const r = role.rank(it);
      if (r > bestRank) { bestRank = r; best = i; }
    });
    return best < 0 ? null
      : { role: role.key, label: role.n, idx: best,
          item: p.pack[best].item, qty: p.pack[best].qty };
  });
}

/* ── item use ───────────────────────────────────────────── */
export function useItem(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot || slot.item.kind !== 'use') return;
  const it = slot.item;
  let spent = true;
  G.act = 'use';
  // Using it is how you find out what it was.
  identify(it.id);

  // 폭식의 위장 doubles what a flask does. It is the only relic
  // that makes the potions you were already hoarding matter.
  // 짧은 심지 turns the same act into an attack and takes the
  // healing back — a flask becomes a tactic, not a top-up.
  /* 크랙 배수를 3으로 놓았더니 물약 내성이 통째로 사라졌다:
     내성 바닥이 0.34인데 3을 곱하면 1.02 — **몇 병을 마셔도 첫 병만큼**
     듣는다. 회복의 81.5%가 물약이고 내성은 이 게임에 하나뿐인 회복
     제동장치라, 그 하나를 지우는 것은 크랙이 아니라 난이도 스위치다.
     2.4로 내린다(바닥에서 0.82 — 다섯 병째는 여전히 덜 듣는다). */
  const gulp = (cracked('gut') && hasRelic('gut') ? 2.4
              : hasRelic('gut') || hasRelic('famine') ? 2 : 1)
             * (hasRelic('wick') && !cracked('wick') ? 0.7 : 1);
  if (hasRelic('wick') && it.spr === 'potion') {
    const burn = (relicVal('wick') + G.depth) * (cracked('wick') ? 2 : 1);
    const reach = cracked('wick') ? 2 : 1;
    const near = G.monsters.filter(o => Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y)) <= reach);
    if (near.length) {
      fx({ t:'burst', x:p.x, y:p.y, r: reach * 1.6, color:'o' });
      for (const o of near) hurtMonster(o, burn, '짧은 심지', {});
    }
  }

  switch (it.use) {
    case 'heal': {
      const h = Math.round(Math.min(p.maxhp - p.hp, (20 + roll(2, 8) + p.lv * 2) * gulp * healScale()));
      p.hp += h; tookDraught();
      if (h) fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(h ? `상처가 아문다. 체력 +${h}.` : '이미 멀쩡하다.', 'good'); break;
    }
    case 'bigHeal': {
      /* 상처부터 닫고 체력을 채운다 — 순서가 중요하다. 천장을 먼저
         올려야 그만큼 담을 자리가 생긴다. 거꾸로 하면 「가득 찼다」로
         잘려서 비싼 물약이 싼 물약과 같은 숫자를 낸다. */
      const back = mendWound(BIG_HEAL_MEND);
      const h = Math.round(Math.min(p.maxhp - p.hp, (Math.floor(p.maxhp * 0.6) + roll(3, 10)) * gulp * healScale()));
      p.hp += h; tookDraught();
      fx({ t:'heal', x:p.x, y:p.y, amt:h });
      say(back ? `깊은 상처까지 닫힌다. 체력 +${h}, 천장 +${back}.`
               : `깊은 상처까지 닫힌다. 체력 +${h}.`, 'good'); break;
    }
    case 'mana': {
      if (!p.maxmana) { say('아무 일도 일어나지 않았다.'); break; }
      const m = Math.round(Math.min(p.maxmana - p.mana, (Math.ceil(p.maxmana * 0.5) + roll(1, 6)) * gulp));
      p.mana += m; say(`머리가 맑아진다. 마나 +${m}.`, 'good'); break;
    }
    case 'map':   revealMap(); say('층의 구조가 머릿속에 그려진다.', 'good'); break;
    case 'teleport': teleport(); say('공간이 접혔다 펴진다.', 'good'); break;
    /* The panic button. It used to drop you two floors, which
       skipped the fork you were meant to choose; now it takes the
       plain stair down one floor, immediately, from wherever you
       are standing. That is what you want when the floor has
       started feeding and the stairs are on the far side of it. */
    case 'flee':
      if (G.depth === 0) { say('여기서는 쓸 데가 없다.', 'warn'); spent = false; break; }
      if (G.depth >= MAX_DEPTH) { say('더 내려갈 곳이 없다.', 'warn'); spent = false; break; }
      say('발밑이 열리고, 한 층을 미끄러져 내려간다.', 'warn');
      enterDepth(G.depth + 1, false, BRANCHES[0]);
      break;
    case 'torch': p.lightTurns = Math.min(oilCap(), p.lightTurns + 520); say('새 횃불에 불을 붙였다.', 'good'); break;

    /* 연막탄. The one verb this game did not have: breaking
       pursuit. Everything walks at your speed here, so once a
       thing is on you the only exits were killing it or dying to
       it — which is why every class dies the same way, with one
       or two bodies in its face. This puts a third door in that
       room. It deals nothing; it takes the room's attention off
       you and holds the tile blind while you spend the turns you
       just bought. */
    case 'smoke': {
      const caught = G.monsters.filter(m =>
        Math.hypot(m.x - p.x, m.y - p.y) <= SMOKE_RADIUS);
      G.smoke = { x:p.x, y:p.y, left: SMOKE_TURNS, r: SMOKE_RADIUS };
      for (const m of caught) {
        if (m.named) continue;     // a guardian does not lose its own doorway
        m.awake = false;
        m.provoked = false;
      }
      /* And nothing re-acquires you while it hangs. This is the
         same gate 그림자 걸음 opens, on purpose: one funnel for
         "nothing notices you", so the smoke cannot be right in
         one place and wrong in the other. */
      G.hushUntil = Math.max(G.hushUntil || 0, G.turn + SMOKE_TURNS);
      fx({ t:'smoke', x:p.x, y:p.y, r: SMOKE_RADIUS, n: caught.length });
      say(caught.length
        ? `연기가 터진다. ${caught.length}이(가) 당신을 놓쳤다.`
        : '연기가 터진다. 놓칠 것이 아무것도 없다.', caught.length ? 'good' : 'warn');
      break;
    }

    /* The unknown half. Three of these are worth drinking and
       three are not, so an unidentified flask is a real bet. */
    case 'might':
      p.might = Math.round(40 * gulp); say('피가 끓는다. 잠시 훨씬 세게 때린다.', 'good');
      fx({ t:'ail', kind:'fear', x:p.x, y:p.y }); break;
    case 'iron':
      p.iron = Math.round(40 * gulp); say('살갗이 쇠처럼 굳는다.', 'good');
      fx({ t:'ail', kind:'slow', x:p.x, y:p.y }); break;
    case 'venom': {
      const dmg = roll(2, 5) + G.depth;
      const took = hurtPlayer(dmg, { by:'독의 물약' });
      if (!G.running) break;
      afflict(p, 'poison', 20);
      say(`목이 타들어 간다. ${took}의 피해.`, 'hit');
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg: took, low: p.hp <= p.maxhp * 0.25 && p.hp + took > p.maxhp * 0.25, severe:true });
      break;
    }
    case 'murk': afflict(p, 'blind', 22); break;
    case 'forge': {
      const slots = GEAR_SLOTS.filter(k => p.equip[k]);
      if (!slots.length) { say('벼릴 것이 없다.', 'warn'); break; }
      const it2 = p.equip[slots[rnd(slots.length)]];
      it2.plus = Math.min(MAX_PLUS, (it2.plus || 0) + 1);
      recalc(p);
      say(`${affixName(it2)} — 저절로 벼려졌다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y });
      break;
    }
    case 'hex': {
      const slots = GEAR_SLOTS.filter(k => p.equip[k]);
      if (!slots.length) { say('아무 일도 일어나지 않았다.'); break; }
      const it2 = p.equip[slots[rnd(slots.length)]];
      const table = Math.random() < 0.5 ? PREFIXES : SUFFIXES;
      const a = pickAffixFor(table, it2.kind, true);
      if (a) { it2[table === PREFIXES ? 'pre' : 'suf'] = a.id; recalc(p); }
      say(`${affixName(it2)} — 검은 글자가 스며든다.`, 'warn');
      fx({ t:'enchant', x:p.x, y:p.y, cursed:true });
      break;
    }
  }
  if (spent) removeItem(p, slotIdx);
  endTurn();
}

function revealMap() {
  const L = G.level;
  for (let i = 0; i < MW * MH; i++) if (L.tiles[i] !== 0) L.seen[i] = 1;
}

function teleport() {
  const spot = G.level.randomFloor((x, y) => monsterAt(x, y));
  if (spot) { G.player.x = spot.x; G.player.y = spot.y; }
}

/* ── spells ─────────────────────────────────────────────── */
/* Arts that are pointless with nothing in reach, so the row can
   grey them out the way it greys out a bolt with no target. */
/* 붙어 있는 것이 있어야 나가는 기예들. 여기 안 적으면 그 기예는
   `near[0]` 이 undefined 인 채로 실행되고 그 자리에서 터진다 —
   되갚기를 빠뜨렸다가 봇 판이 정확히 그렇게 죽었다. */
const ART_NEEDS_BODY = ['shove', 'cleave', 'finisher', 'vitals', 'judgest', 'storm', 'repay'];

/* 궁수의 물러서기. 뒤로 갈 수 있는 만큼 가고, 지나온 칸에 붙어 있던
   것을 돌려준다 — 「물러나는 일이 곧 공격」이라는 이 기예의 전부다. */
function kiteAway(p, dist) {
  const from = { x: p.x, y: p.y };
  /* 가장 가까운 것의 반대쪽으로 간다. 아무도 없으면 바라보던 쪽 뒤로. */
  const near = G.monsters.filter(m => G.level.vis[idx(m.x, m.y)])
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  const dx = near ? -Math.sign(near.x - p.x) : -(p.fx || 1);
  const dy = near ? -Math.sign(near.y - p.y) : -(p.fy || 0);
  /* 떠나기 **전에** 붙어 있던 것부터 담는다. 처음에 발을 뗀 뒤부터
     담았더니, 네 칸을 물러나고 나면 아무도 안 붙어 있어서 0발이
     나갔다 — 「물러나는 일이 곧 공격」인데 물러나고 나서 세고 있었다. */
  const passed = adjacentMonsters(p).slice();
  let moved = 0;
  for (let i = 0; i < dist; i++) {
    const nx = p.x + dx, ny = p.y + dy;
    if (G.level.solid(nx, ny) || monsterAt(nx, ny)) break;
    p.x = nx; p.y = ny; moved++;
    for (const m of adjacentMonsters(p)) if (!passed.includes(m)) passed.push(m);
  }
  if (moved) refreshFov();
  return { from, moved, passed };
}
/* And the ones that need something down a clear line instead —
   the ranger's row greys out on the same reading of the room that
   the 쏘기 button uses. */
const ART_NEEDS_SHOT = ['aimed', 'pierce', 'volley'];
/* The rogue's two that only need to *see* something — no bow, no
   reach, just a body in the light. */
const ART_NEEDS_SIGHT = ['shadowstep', 'fan'];
/* And the one that needs something to lose you: vanishing in an
   empty room is a wasted shade, so the row says so. */
const ART_NEEDS_WATCHER = ['vanish'];

/* The eight neighbours, in the order a landing spot should be
   tried: straight behind first, then around. */
const dirs8 = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];

/* Everything the hero sees right now, nearest first. One reader,
   because three arts and the row all have to agree on what
   "보인다" means. */
function visibleMonsters() {
  const p = G.player, L = G.level;
  if (!L) return [];
  return G.monsters
    .filter(m => !m.disguise && L.vis[idx(m.x, m.y)])
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
}
const awakeWatchers = () => visibleMonsters().filter(m => m.awake && !m.boss);

/* ── the warrior's four ───────────────────────────────────
   Each answers a situation the class is supposed to own and no
   two answer the same one: surrounded, a pack, something that
   telegraphs or shoots, and a thing that is nearly done. They
   spend stamina, which regenerates on a timer rather than being
   found in a flask — so the warrior's rhythm is spend-and-wait
   rather than hoard-and-dump, which is the whole difference in
   feel from a caster. */
/* 한국어에서 「3에게」는 문장이 아니라 표의 한 칸이다. 이 게임은
   다른 데서는 이미 알고 있다 — 『심연이 하나를 더 게워냈다』는
   「1을」이라고 안 쓴다. 작은 수는 세는 말로 적는다. */
const COUNT_KO = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const count = n => COUNT_KO[n] || `${n}`;

/* 그 몬스터 곁에 몇이 있나. 성흔이 「어디에 새겨야 하는가」를
   물으므로, 기본 선택은 가장 붐비는 곳이다. */
const crowdAround = m => G.monsters.filter(o => o !== m && !o.disguise
  && Math.hypot(o.x - m.x, o.y - m.y) <= STIGMA_RANGE).length;

export function useArt(id) {
  const p = G.player;
  const a = artById(p, id);
  if (!a) return;
  /* Paralysis eats the turn here exactly as it does in step().
     Returning without spending it looks harmless and is not: any
     caller that loops until the turn advances — the bot does —
     spins forever on a paralysed hero. */
  if (has(p, 'paralyze')) {
    say('몸이 굳어 말을 듣지 않는다.', 'warn');
    fx({ t:'struggle', x:p.x, y:p.y });
    endTurn(); return;
  }
  // These two are mis-taps rather than lost turns, so they cost
  // nothing — the same way a spell with no mana costs nothing.
  if (p.stam < artCost(p, a)) { say('숨이 차다.', 'warn'); return; }


  const near = adjacentMonsters(p);
  if (ART_NEEDS_BODY.includes(id) && !near.length) {
    say('손이 닿는 곳에 아무것도 없다.', 'warn'); return;
  }
  G.act = 'cast';                 // 기예도 플레이어에겐 같은 몸짓이다
  if (ART_NEEDS_SHOT.includes(id)) {
    if (weaponType(p) !== 'bow') { say('활이 없다.', 'warn'); return; }
    if (!shotTarget()) { say('사선이 트인 것이 없다.', 'warn'); return; }
  }
  if (ART_NEEDS_SIGHT.includes(id) && !visibleMonsters().length) {
    say('보이는 것이 없다.', 'warn'); return;
  }
  /* 층에 한 번 쓰는 기예. 자원이 아니라 **횟수**가 값이라, 주력기와
     지갑을 놓고 다투지 않는다 — 팔라딘의 비상 버튼이 판당 0.05회
     눌리던 이유가 그 다툼이었다. */
  if (a.floorOnce && (G.floorArts || {})[id]) {
    say('이 층에서는 이미 한 번 썼다.', 'warn'); return;
  }
  if (ART_NEEDS_WATCHER.includes(id) && !awakeWatchers().length) {
    say('너를 보고 있는 것이 없다.', 'warn'); return;
  }

  /* 「이 판이 기예를 얼마나 썼나」. 비어 있는 성소를 부르는 값이라
     여기서 센다 — 기예가 나가는 유일한 자리다. */
  G.artsUsed = (G.artsUsed || 0) + 1;
  if (G.floorTally) G.floorTally.arts[id] = (G.floorTally.arts[id] || 0) + 1;
  if (a.floorOnce) (G.floorArts ||= {})[id] = true;
  /* 비어 있는 성소에서는 값이 없다. 이 층 하나뿐이고, 그래서 여기서
     무엇을 할지가 그 판의 가장 사치스러운 결정이 된다. */
  if (!strangeIs('sanctum')) {
    p.stam -= artCost(p, a);
  }

  switch (id) {
    case 'shove': {
      /* The answer to being surrounded. It does almost no damage
         on its own — what it buys is a tile, and a wall turns
         that tile into a stagger. */
      const m = near.sort((x, y) => y.hp - x.hp)[0];
      const dx = Math.sign(m.x - p.x), dy = Math.sign(m.y - p.y);
      const moved = shoveBack(m, dx, dy, SHOVE_DIST);
      m.awake = true;
      fx({ t:'shove', x:p.x, y:p.y, tx:m.x, ty:m.y, dx, dy, hit: moved < SHOVE_DIST });
      if (moved < SHOVE_DIST) {
        // It had nowhere to go. That is the good outcome.
        const bump = Math.max(2, Math.round(baseSwing(p) * SHOVE_WALL));
        hurtMonster(m, bump, '벽', {});
        // Negative energy is how this game spends a monster's turn
        // for it — the same lever the ambush ring uses to make the
        // first turn a scramble rather than a swing.
        if (G.monsters.includes(m)) m.energy = -1;
        say(`${m.n}을(를) 벽으로 몰아붙였다. 무너진다.`, 'level');
      } else {
        say(`${m.n}을(를) ${moved}칸 밀어냈다.`);
      }
      break;
    }
    case 'cleave': {
      /* The answer to a pack — and the reason 재의 사냥개 arriving
         three at a time is a fight rather than a funeral.

         전사의 자루 reaches a ring further with a haft in both
         hands, which turns the art from "the things touching me"
         into "the things near me". */
      const wide = fitRule(p, 'wideCleave');
      const hit = wide
        ? G.monsters.filter(o => !o.disguise
            && Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y)) <= 2)
        : near;
      fx({ t:'cleave', x:p.x, y:p.y, n:hit.length, wide });
      say(hit.length > 2 ? '한 호를 그리며 전부를 지나갔다.' : '넓게 베었다.', 'level');
      for (const m of [...hit]) if (G.monsters.includes(m)) swing(m, CLEAVE_SHARE);
      break;
    }
    /* ── 도적의 넷 ─────────────────────────────────────
       Two answers to being outnumbered or outranged, and two
       assassin's blows. In that order, because the first two are
       what make the other two survivable. */
    case 'shadowstep': {
      /* The archer answer. An archer beats you by keeping a gap;
         this spends a shade to delete the gap and arrive on the
         blind side. */
      const t = visibleMonsters()[0];
      const dx = Math.sign(t.x - p.x), dy = Math.sign(t.y - p.y);
      const spots = [[t.x + dx, t.y + dy],
                     ...dirs8.map(([ax, ay]) => [t.x + ax, t.y + ay])];
      const to = spots.find(([x, y]) =>
        !G.level.solid(x, y) && !monsterAt(x, y) && !(x === p.x && y === p.y));
      if (!to) { say('설 자리가 없다.', 'warn'); break; }
      const from = { x:p.x, y:p.y };
      p.x = to[0]; p.y = to[1];
      refreshFov();
      /* 예전에는 회피 굴림(roll)의 연출을 빌려 썼다 — 같은 파란 줄 하나라
         「굴렀다」와 「등 뒤에 섰다」가 화면에서 구분이 안 됐다. */
      fx({ t:'stepIn', x:p.x, y:p.y, from, tx:t.x, ty:t.y });
      say(`${t.n}의 등 뒤에 섰다.`, 'level');
      /* Unaware is how this game already spells "ambush", so the
         art borrows that rather than inventing a second kind of
         guaranteed crit. */
      const wasAwake = t.awake;
      t.awake = false;
      swing(t, 1, { noShade: true });
      if (wasAwake && G.monsters.includes(t)) t.awake = true;
      break;
    }
    case 'fan': {
      /* The pack answer. A cone rather than a ring: it is thrown,
         so it answers the half of the room you are facing. */
      const t = visibleMonsters()[0];
      const len = Math.max(1e-6, Math.hypot(t.x - p.x, t.y - p.y));
      const ax = (t.x - p.x) / len, ay = (t.y - p.y) / len;
      const hit = visibleMonsters().filter(o => {
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d > FAN_RANGE) return false;
        if (d < 0.5) return true;
        return ((o.x - p.x) / d) * ax + ((o.y - p.y) / d) * ay >= FAN_ARC;
      });
      /* 궁수의 화살비(volley)를 빌려 쓰던 자리. 저건 방 전체이고
         이건 앞쪽 반원이라, 화면에서도 부채꼴이어야 한다. */
      fx({ t:'fanOut', x:p.x, y:p.y, ax, ay, n:hit.length, rng:FAN_RANGE });
      say(hit.length > 1 ? `칼이 부채처럼 펼쳐졌다 — ${count(hit.length)}을 지나갔다.`
                         : '칼 한 자루가 날아갔다.', 'level');
      for (const o of [...hit]) if (G.monsters.includes(o)) swing(o, FAN_SHARE);
      break;
    }
    case 'vanish': {
      /* ── 되감기가 「임팩트가 없다」는 말을 들었다 ──────────
         맞는 말이었다. 이것이 하던 일은 **아무 일도 안 일어나게**
         하는 것이다 — 깨어 있던 것이 조용히 안 깨어 있게 된다.
         화면에서는 파란 원 하나가 퍼지고 끝이고, 도적이 실제로
         위험한 순간(들켰고 **이미 붙었을 때**)에는 붙은 것이 여전히
         옆에 서 있다. 놓쳤다고 적혀 있을 뿐이다.

         도적의 한계돌파는 「사라진다」가 아니라 **「빠져나온다」**여야
         한다. 그래서 세 가지를 한 번에 한다:
           · 인접한 것을 전부 밀어낸다 — 포위가 그 자리에서 풀린다
           · 밀려난 것마다 **기습 판정 한 대**를 먹인다 — 도적의
             가장 센 판정이 가장 위험한 순간에 나간다
           · 그러고 나서 자취를 지운다 — 원래 하던 일은 그대로

         「아무 일도 안 일어남」이 「셋을 밀치고 셋을 찌르고 사라짐」이
         된다. 같은 자원, 같은 자리, 다른 사건.                */
      const hugged = adjacentMonsters(p);
      for (const m of hugged) {
        const dx = Math.sign(m.x - p.x), dy = Math.sign(m.y - p.y);
        /* 찌르고 나서 민다 — 순서가 반대면 기습이 사거리를 벗어난다. */
        swing(m, VANISH_MULT, { forceCrit: true });
        if (G.monsters.includes(m)) shoveBack(m, dx, dy, VANISH_PUSH);
      }
      const lost = awakeWatchers().filter(m => !(m.named && m.provoked));
      for (const m of lost) m.awake = false;
      G.hushUntil = G.turn + VANISH_HUSH;
      fx({ t:'vanishOut', x:p.x, y:p.y, n: hugged.length });
      say(hugged.length
        ? `칼이 먼저 나가고 연기가 뒤따랐다. 붙어 있던 ${count(hugged.length)}을 떼어 냈다.`
        : (lost.length ? `${count(lost.length)}이 너를 놓쳤다.` : '자취를 지웠다.'), 'level');
      break;
    }
    case 'vitals': {
      /* The one shot. Priced off nothing but the three shades it
         costs, so unlike 마무리 it is worth the same on a full
         health bar as on a sliver. */
      const m = near.sort((x, y) => y.hp - x.hp)[0];
      /* 전사의 마무리(finisher)를 빌려 쓰던 자리. 저건 위에서 내리치는
         무게이고 이건 갑옷 틈으로 들어가는 한 점이다. */
      fx({ t:'vitals', x:p.x, y:p.y, tx:m.x, ty:m.y });
      say('칼끝이 갑옷 사이를 찾았다.', 'level');
      swing(m, VITALS_MULT, { pierce: true });
      break;
    }

    /* ── 한계돌파 셋 ────────────────────────────────────
       직업마다 하나씩, 「누가 봐도 이 직업이 위험한 순간」에 쓰는 것.
       셋 다 피해가 아니라 **판을 바꾼다** — 버티고, 벌리고, 안 쓰러진다. */
    case 'brace': {
      /* 전사. 예전 버티기가 「언제나 옳다」였던 것을 대가로 푼다:
         버티는 동안 한 칸도 못 움직인다. 도망칠 수 있으면 도망치는
         편이 낫고, 도망칠 수 없을 때만 이것이 옳다. */
      p.brace = STAND_TURNS;
      for (const m of adjacentMonsters(p)) m.pinned = STAND_TURNS;
      fx({ t:'brace', x:p.x, y:p.y, n: adjacentMonsters(p).length });
      say('발을 박고 섰다. 여기서는 아무도 못 지나간다.', 'level');
      break;
    }
    case 'kite': {
      /* 궁수. 활은 붙으면 막대기이고, 이 직업의 축은 거리다.
         뒤로 물러나면서 **지나온 자리에 있던 것 전부**에게 한 발씩 —
         물러나는 일이 곧 공격이 된다. */
      const back = kiteAway(p, KITE_DIST);
      const hitList = back.passed.filter(m => G.monsters.includes(m));
      for (const m of hitList) if (G.monsters.includes(m)) loose(m, KITE_MULT);
      fx({ t:'kite', x:p.x, y:p.y, from: back.from, n: hitList.length });
      say(back.moved
        ? `${back.moved}칸 물러나며 ${hitList.length}발을 박았다.`
        : '물러설 자리가 없다. 그대로 쏜다.', 'level');
      break;
    }
    case 'bulwark': {
      /* 팔라딘. 앞으로 나가는 직업이라 위험한 순간이 자기가 만든
         것이다 — 들어갔고 나올 수가 없다. 순교와 달리 **빚이 없다**:
         맹세 다섯이 그 값이고, 그래서 아무 때나 못 쓴다. */
      p.bulwark = BULWARK_TURNS;
      fx({ t:'bulwark', x:p.x, y:p.y });
      say('맹세가 뼈를 대신한다. 세 턴 동안은 쓰러지지 않는다.', 'level');
      break;
    }
    case 'flurry': {
      /* Every exit from this loop is a thing the player did: the
         breath ran out, the body fell, or a blow missed. It rides
         swing(), so the third blow feeds 세 번째 손 exactly as
         three ordinary swings would. */
      const m = near.sort((x, y) => y.hp - x.hp)[0];
      let landed = 0;
      for (let i = 0; i < FLURRY_MAX; i++) {
        if (!G.monsters.includes(m) || !G.running) break;
        if (i > 0) {
          if (p.stam < FLURRY_STAM) { say('숨이 끊겼다.', 'warn'); break; }
          p.stam -= FLURRY_STAM;
        }
        fx({ t:'lunge', who:'player', x:p.x, y:p.y, kind:weaponType(p),
             dx: Math.sign(m.x - p.x), dy: Math.sign(m.y - p.y) });
        if (!swing(m, 1 + landed * FLURRY_STEP)) break;
        landed++;
      }
      /* 「1.55배였다」는 표의 말이다. 세계는 배율을 모른다 — 아는 것은
         손이 점점 무거워진다는 것뿐이다. */
      if (landed) fx({ t:'flurry', x:p.x, y:p.y, tx:m.x, ty:m.y, n:landed });
      if (landed >= 3) say(`${landed}연타 — 마지막 한 대는 팔이 아니라 몸으로 들어갔다.`, 'level');
      else if (landed) say(`${landed}대를 이어 붙였다.`, 'level');
      else say('첫 대부터 빗나갔다.', 'warn');
      break;
    }

    case 'finisher': {
      /* The answer to a thing that is nearly done. Priced off what
         the target has *lost*, so it is worthless as an opener and
         decisive as a closer — the opposite curve from 처형, which
         is a threshold rather than a slope. */
      const m = near.sort((x, y) => (x.hp / x.maxhp) - (y.hp / y.maxhp))[0];
      const gone = 1 - m.hp / Math.max(1, m.maxhp);
      fx({ t:'finisher', x:p.x, y:p.y, tx:m.x, ty:m.y, power:gone });
      say(`숨을 모아 내리친다.`, 'level');
      swing(m, 1 + gone * (FINISH_MAX - 1));
      break;
    }

    /* ── 팔라딘의 넷 ───────────────────────────────────
       The old paladin was a defence number that leaked, and the
       first attempt at fixing it was another defence number that
       asked him to stand still — which is nothing in a game whose
       whole texture is walking into a room and taking it apart.
       All four of these kill something. What differs is the
       shape: how you reach it, how you get through it, how you
       take a crowd, and how you keep going. */
    case 'charge': {
      /* Nobody in the game has a gap-closer, and the paladin is
         the class that most needs one — dexterity −2 makes him
         the slowest thing on the floor, so anything that wants to
         keep away from him simply does. */
      const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      let best = null;
      for (const [dx, dy] of dirs) {
        for (let d = 1; d <= CHARGE_DIST; d++) {
          const tx = p.x + dx * d, ty = p.y + dy * d;
          if (!walkable(G.level, tx, ty)) break;
          const hit = G.monsters.find(o => !o.disguise && o.x === tx && o.y === ty);
          if (hit) {
            if (!best || d < best.d) best = { m: hit, dx, dy, d };
            break;
          }
        }
      }
      if (!best) { say('달려들 곳이 없다.', 'warn'); break; }
      const lx = best.m.x - best.dx, ly = best.m.y - best.dy;
      const from = { x: p.x, y: p.y };
      if (walkable(G.level, lx, ly) && !G.monsters.some(o => o.x === lx && o.y === ly)) {
        p.x = lx; p.y = ly;
      }
      fx({ t:'charge', x:from.x, y:from.y, tx:p.x, ty:p.y, dx:best.dx, dy:best.dy });
      say('땅을 밟고 달려든다.', 'level');
      /* Driven into a wall it loses its footing. The extra is not
         damage — it is turns, which is worth more. */
      const bx = best.m.x + best.dx, by = best.m.y + best.dy;
      const pinned = !walkable(G.level, bx, by);
      swing(best.m, 1.35);
      if (pinned && G.monsters.includes(best.m)) {
        best.m.energy = -CHARGE_SLAM;
        best.m.awake = true;
        fx({ t:'slam', x:best.m.x, y:best.m.y });
        say(`${best.m.n}이(가) 벽에 처박혔다.`, 'good');
      }
      break;
    }
    case 'judgest': {
      /* The warrior's 마무리 is priced off what the target has
         lost, so it closes fights. This one is priced off how big
         the target is to begin with, so it opens them — and it
         goes through armour entirely, which is what makes the
         thickest thing in the room the right thing to use it on. */
      const m = near.sort((x, y) => (y.maxhp || 0) - (x.maxhp || 0))[0];
      fx({ t:'judgest', x:p.x, y:p.y, tx:m.x, ty:m.y });
      say('내리치는 것은 무기가 아니라 판결이다.', 'level');
      /* The whole blow goes through armour, so it is priced and
         delivered by hand rather than through swing() — which
         rolls the target's plate in on every hit and has no way
         to be told not to. */
      const heft = Math.round(baseSwing(p) + (m.maxhp || 10) * JUDGE_STRIKE);
      fx({ t:'lunge', who:'player', x:p.x, y:p.y, kind:weaponType(p),
           dx: Math.sign(m.x - p.x), dy: Math.sign(m.y - p.y) });
      m.awake = true;
      hurtMonster(m, Math.max(3, heft), '심판의 일격', { pierce: true });
      break;
    }
    case 'storm': {
      /* The reason to walk into the middle of a crowd rather than
         hold a doorway. Everything around him, and every kill
         hands the oath back — three bodies down is three oath
         returned, which is another storm or most of a 성전. This
         is the engine: the class accelerates on a good swing
         instead of running dry on one. */
      if (!near.length) { say('휘두를 것이 없다.', 'warn'); break; }
      fx({ t:'storm', x:p.x, y:p.y, n:near.length });
      say(`둘러선 ${count(near.length)}을 한 바퀴에 쓸어버린다.`, 'level');
      let felled = 0;
      for (const m of [...near]) {
        if (!G.monsters.includes(m)) continue;
        swing(m, STORM_SHARE);
        if (!G.monsters.includes(m)) felled++;
      }
      if (felled) {
        poolGain(felled, 'storm');
        fx({ t:'oathback', x:p.x, y:p.y, n:felled });
        say(`쓰러진 만큼 맹세가 돌아온다. (+${felled})`, 'good');
      }
      break;
    }
    case 'crusade': {
      /* The whole bar, and it only pays if the room is already
         nearly down — which is what 성스러운 폭풍 is for. Cut the
         nearest thing; if it falls, walk to the next and cut that
         one; stop the moment something does not fall. A paladin
         who set the room up right clears it in one action, and one
         who did not gets a single swing for eight oath. */
      let cuts = 0, steps = 0;
      fx({ t:'crusade', x:p.x, y:p.y });
      say('한 번 시작한 것은 끝날 때까지 멈추지 않는다.', 'level');
      while (cuts < CRUSADE_MAX) {
        const alive = G.monsters.filter(o => !o.disguise && G.level.vis[idx(o.x, o.y)]);
        if (!alive.length) break;
        const m = alive.sort((x, y) =>
          Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y))[0];
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        // step to it if it is not already in reach
        if (d > 1.5) {
          const sx = p.x + Math.sign(m.x - p.x), sy = p.y + Math.sign(m.y - p.y);
          if (!walkable(G.level, sx, sy) || G.monsters.some(o => o.x === sx && o.y === sy)) break;
          p.x = sx; p.y = sy;
          /* 여기 `cuts++` 가 있었다. 한 칸 걸어갔는데 아직 안 닿으면
             **베지도 않고 횟수를 한 번 태웠다** — 맹세 여덟을 쓰고
             허공에 걸어가는 턴이 섞여 있었다는 뜻이다. */
          /* 걸음은 따로 센다 — 베는 횟수에 태우지 않되, 표적이
             바뀌며 영원히 걷는 일은 없어야 한다. */
          if (Math.hypot(m.x - p.x, m.y - p.y) > 1.5) {
            if (++steps > CRUSADE_MAX * 2) break;
            continue;
          }
        }
        fx({ t:'crusadeCut', x:p.x, y:p.y, tx:m.x, ty:m.y, n:cuts });
        swing(m, 1.5);
        cuts++;
        if (G.monsters.includes(m)) break;    // it did not fall; the march is over
      }
      break;
    }

    /* ── the priest's four ─────────────────────────────
       None of them is a heal. Three answer things the game
       already had no answer to — a room you cannot leave, a thing
       that keeps aning, a floor full of the undead — and the
       fourth is a bet rather than a cure. */
    /* ── 사제의 넷 ─────────────────────────────────────
       전부 「맞은 것」을 값으로 바꾼다. 이 직업의 신앙은 맞아야
       차는데, 지금까지 그 신앙이 사는 물건 중 어느 것도 맞은 것을
       쓰지 않았다 — 원 안에 서고, 하나를 지목하고, 언데드만 때리고,
       다섯 턴 뒤에 빚을 졌다. 봇 20판에 심판 0회 · 순교 0회.

       이제 넷의 질문이 하나다: **받은 것을 무엇으로 바꿀 것인가.** */
    case 'repay': {
      /* 이 층에서 받은 피해를 눈앞의 하나에게 한 번에 돌려준다.
         맞아야 차는 자원이 맞은 만큼의 위력이 되는 자리 — 사제가
         왜 앞에 서는지가 여기서 처음으로 설명된다. */
      const m = near.sort((x, y) => y.hp - x.hp)[0];
      const pool = Math.round((p.tookPool || 0) * REPAY_SHARE);
      const cap = Math.round(baseSwing(p) * REPAY_CAP);
      const blow = Math.max(2, Math.min(pool, cap));
      p.tookPool = 0;
      fx({ t:'repay', x:p.x, y:p.y, tx:m.x, ty:m.y, n:blow, capped: pool > cap });
      say(pool > cap ? `받은 것을 다 돌려주지는 못했다. ${blow}만큼.`
                     : `받은 것을 그대로 돌려준다 — ${blow}.`, 'level');
      m.awake = true;
      hurtMonster(m, blow, '되갚기', { pierce: true });
      break;
    }
    case 'word': {
      /* 피해가 없는 유일한 공격 기예. 사제가 몰렸을 때 필요한 것은
         한 대 더가 아니라 **한 턴**이다 — 물약을 마시거나, 되갚기를
         모으거나, 문을 닫을 한 턴. */
      const heard = G.monsters.filter(o => !o.disguise
        && Math.hypot(o.x - p.x, o.y - p.y) <= AWE_RANGE
        && G.level.vis[idx(o.x, o.y)]);
      if (!heard.length) { say('들을 것이 없다.', 'warn'); break; }
      for (const o of heard) {
        /* 보스는 안 멈춘다 — 멈추면 그 싸움이 없어진다. */
        if (o.boss) continue;
        o.energy = -AWE_TURNS;
        o.awake = true;
        o.awed = AWE_TURNS;
      }
      fx({ t:'word', x:p.x, y:p.y, r:AWE_RANGE, n:heard.length });
      say(`말이 떨어지자 ${count(heard.length)}이 멈춰 섰다.`, 'level');
      break;
    }
    case 'stigma': {
      /* 파문(아무 일도 안 일어남)과 심판(언데드 전용, 20판에 0회)을
         하나로 합친 자리. 지목한 것이 맞을 때마다 곁의 것들이 같이
         맞으므로, **어디에 새기느냐**가 그 방의 모양을 정한다. */
      const seen = visibleMonsters();
      if (!seen.length) { say('새길 것이 없다.', 'warn'); break; }
      const m = seen.sort((x, y) => crowdAround(y) - crowdAround(x))[0];
      m.stigma = STIGMA_TURNS;
      m.awake = true;
      fx({ t:'stigma', x:m.x, y:m.y, turns:STIGMA_TURNS });
      say(`${m.n}에 성흔을 새겼다. 이제 저것이 맞으면 곁도 맞는다.`, 'level');
      break;
    }
    case 'martyr': {
      /* Not a heal — a debt. Everything turned aside arrives at
         once when it ends, so the five turns have to be spent
         finishing the fight rather than surviving it. */
      p.martyr = MARTYR_TURNS; p.martyrDebt = 0;
      fx({ t:'martyr', x:p.x, y:p.y, turns:MARTYR_TURNS });
      say('무릎을 꿇지 않기로 했다. 다섯 턴 동안은.', 'level');
      break;
    }

    /* ── the ranger's four ─────────────────────────────
       Every one is about the gap. The warrior's arts ask what is
       next to you; these ask where everything is standing. */
    case 'aimed': {
      /* A bow loses damage over distance. This one gains it, and
         cannot miss — so the ranger's best shot is the one taken
         from the far end of the room, which is the exact opposite
         of every other attack in the game. */
      const t = shotTarget();
      const dist = Math.hypot(t.x - p.x, t.y - p.y);
      fx({ t:'aimed', fx:p.x, fy:p.y, tx:t.x, ty:t.y, dist });
      say(`숨을 멈추고 겨눈다.`, 'level');
      loose(t, 1 + dist * AIMED_GAIN, { sure: true });
      break;
    }
    case 'pierce': {
      /* One arrow, one line, everything on it. The answer to a
         corridor — and the reason a ranger wants the pack lined
         up rather than spread. */
      const t = shotTarget();
      const dx = Math.sign(t.x - p.x), dy = Math.sign(t.y - p.y);
      const rng = bowRange(p);
      fx({ t:'pierceShot', fx:p.x, fy:p.y, dx, dy, rng });
      say('시위가 한 줄을 그었다.', 'level');
      let carry = 1;
      for (let i = 1; i <= rng; i++) {
        const x = p.x + dx * i, y = p.y + dy * i;
        if (G.level.solid(x, y)) break;
        const o = monsterAt(x, y);
        if (!o || o.disguise) continue;
        loose(o, carry, { sure: true, quietFx: true });
        carry *= PIERCE_KEEP;
      }
      break;
    }
    case 'snare': {
      /* Was: bury a trap under your own feet, which only paid off
         if you were already leaving — so it fired eight times in
         twelve measured runs and never at the moment it was
         wanted. It is one action now: give ground and leave the
         trap in the ground you gave. That answers the ranger's
         actual way of dying, which is something standing in its
         face with nowhere to go.

         The snares get their own list rather than G.hazards —
         that one is the telegraphed floor patterns, keyed on
         PATTERNS and ticked by `left`, and a snare pushed into it
         would tick NaN and take every telegraph on the floor
         down with it. */
      const from = near.sort((a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      const ox = p.x, oy = p.y;
      if (from) {
        const bx = Math.sign(p.x - from.x), by = Math.sign(p.y - from.y);
        /* Straight back first, then either shoulder — a ranger
           against a wall still gets the trap, just not the step. */
        for (const [dx, dy] of [[bx, by], [bx, 0], [0, by], [-by, bx], [by, -bx]]) {
          if (!dx && !dy) continue;
          const nx = p.x + dx, ny = p.y + dy;
          if (!walkable(G.level, nx, ny)) continue;
          if (G.monsters.some(o => o.x === nx && o.y === ny)) continue;
          p.x = nx; p.y = ny;
          break;
        }
      }
      G.snares = G.snares || [];
      if (!G.snares.some(s2 => s2.x === ox && s2.y === oy))
        G.snares.push({ x:ox, y:oy });
      fx({ t:'snare', x:ox, y:oy });
      if (p.x !== ox || p.y !== oy) {
        fx({ t:'roll', x:p.x, y:p.y, dx: Math.sign(p.x - ox), dy: Math.sign(p.y - oy), dist:1 });
        say('한 걸음 물러서며 발자국 자리에 덫을 묻었다.', 'good');
      } else {
        say('발밑에 덫을 묻었다. 밟는 쪽이 손해다.', 'good');
      }
      break;
    }
    case 'volley': {
      /* Everything in sight, once each, at half. The answer to a
         room rather than to a body — the ranger's 휩쓸기, thrown
         across the floor instead of swung around the hips. */
      const rng = bowRange(p);
      const seen = G.monsters.filter(o =>
        !o.disguise && G.level.vis[idx(o.x, o.y)]
        && Math.hypot(o.x - p.x, o.y - p.y) <= rng
        && lineClear(G.level, p.x, p.y, o.x, o.y));
      if (!seen.length) { say('겨눌 것이 없다.', 'warn'); break; }
      fx({ t:'volley', x:p.x, y:p.y, n:seen.length });
      say(`화살이 빗발친다 — ${count(seen.length)}에게.`, 'level');
      for (const o of [...seen]) if (G.monsters.includes(o)) loose(o, VOLLEY_SHARE, { quietFx: true });
      break;
    }
  }
  if (G.running) endTurn();
}

/* 성역. Only while you are standing in it — the moment you step
   off the consecrated tile it is just a bright stone. That is what
   makes it zone control rather than a buff: the priest has to
   decide to hold a place, and the room has to be worth holding. */
function sanctumSoak(dmg) {
  const p = G.player, s2 = G.sanctum;
  if (!s2 || s2.left <= 0 || p.x !== s2.x || p.y !== s2.y) return dmg;
  fx({ t:'sanctumHit', x:p.x, y:p.y });
  return Math.max(1, Math.round(dmg * (1 - SANCTUM_CUT)));
}


/* What one clean blow is worth right now, before the target's
   armour. Used by the arts that need to price something off the
   swing rather than roll a fresh one. */
function baseSwing(p) {
  const w = p.equip.weapon;
  const d = w ? w.dice : [1, 3];
  return (d[0] * (d[1] + 1)) / 2 + statB(p, 'str') * 2
       + Math.floor(p.lv / 3) + gearBonus(p).dmg;
}

export function cast(spellId) {
  const p = G.player;
  // One entry point for the row, the keys and the tooltip: an art
  // and a spell are the same gesture to the player.
  if (artById(p, spellId)) { useArt(spellId); return; }
  const sp = spellList(p).find(s => s.id === spellId);
  if (!sp) return;
  // 침묵의 서약 trades the whole spellbook for a third more
  // damage in the hand — the sharpest build commitment here.
  if (hasRelic('vow')) { say('서약이 혀를 막는다. 주문은 나오지 않는다.', 'warn'); return; }
  const cost = spellCost(p, sp);
  /* ② 크랙 「마르지 않는다」. 지팡이가 지불하는 값은 하나다 — 마나가
     마르면 시전자는 몽둥이를 든 사람이 된다. 이 지팡이는 그 줄을
     지운다: 모자란 만큼을 **피로 낸다.** 그러면 마나는 자원이 아니라
     **다른 통화**가 되고, 시전자는 마르는 대신 죽어 간다. */
  const bled = bloodPrice(p, cost);
  if (bled < 0) return;              // 낼 수 없다 — 이유는 bloodPrice가 말했다
  ledger('spell');

  /* 잔향 is read before anything is spent, because 지형 changes
     what counts as a target and 자취 changes whether this cast
     ends the turn — both of which the guards below depend on. */
  const echo = p.cls === 'mage' ? liveEcho(p) : null;
  const reach = echo?.id === 'reach';

  /* 지형 makes the floor the room: a spell may reach what you know
     is down there rather than only what you can see from here. */
  const visible = G.monsters.filter(m => reach || G.level.vis[idx(m.x, m.y)]);
  const nearest = visible.sort((a, b) =>
    Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];

  /* Checked *before* the mana leaves the pool. A spell that has
     nothing to hit used to still cost the mana and the turn, and
     one-tap casting would have turned that from a rare slip into
     a routine one. */
  if (TARGETED.includes(sp.id) && !nearest) { say('시야에 적이 없다.', 'warn'); return; }

  p.mana = Math.max(0, p.mana - cost);
  if (bled) {
    /* 피로 낸 것도 한 대다 — 단일 깔때기를 지난다. 여기서 죽을 수
       있고, 죽어야 한다: 낼 수 없는 값을 냈으니까. */
    say(`등불이 피를 받아 갔다. 체력 −${bled}.`, 'warn');
    fx({ t:'ail', x:p.x, y:p.y, kind:'fear' });
    hurtPlayer(bled, { by:'마지막 등불', combo:false });
    if (!G.running) return;
  }
  G.act = 'cast';                 // 마나가 실제로 나간 지점에서만 센다
  // 술사의 지팡이: the rod gives one back. Small, constant, and
  // the reason a mage keeps a wand in hand rather than a sword.
  if (fitRule(p, 'siphon')) p.mana = Math.min(p.maxmana, p.mana + 1);
  p.casts = (p.casts || 0) + 1;
  if (echo) takeEcho(p);          // consumed here, whatever it does below
  /* 룬을 새긴 자의 것: the plate still chokes the pool. What does
     get out comes out twice as hard, which is the trade for
     wearing the thing that was strangling you. */
  const pow = spellPower(p, sp.id) * (oddAwake('runeplate') ? 2 : 1)
            * (echo?.id === 'spark' ? 1 + ECHO_POWER : 1);
  const aff = SPELL_AFFIXES.find(a => a.id === p.spellAffix?.[sp.id]);

  /* 서리's afterimage: whatever this spell touches loses its next
     move. Negative energy is the same lever 밀쳐내기 uses, so a new
     trait cannot invent a second kind of "stunned". */
  const rime = m => { if (echo?.id === 'rime' && G.monsters.includes(m)) m.energy = -1; };
  /* 눈's afterimage: everything else in the room takes half, rolled
     off the damage the spell actually dealt. */
  const splash = (from, dmg, label) => {
    if (echo?.id !== 'eye') return;
    let n = 0;
    for (const o of [...visible]) {
      if (o === from || !G.monsters.includes(o) || o.disguise) continue;
      const d = Math.max(1, Math.round(dmg * ECHO_SPLASH));
      fx({ t:'beam', fx:p.x, fy:p.y, tx:o.x, ty:o.y, color:'W' });
      hurtMonster(o, d, label, { weapon: 'spell' });
      rime(o); n++;
    }
    if (n) say(`눈이 열려 있다 — ${n}에게도 닿았다.`, 'level');
  };

  /* ── 주문마다 제 프레임 ────────────────────────────────────
     플레이어: 「아이템이나 주문 임펙트, 특히 주문의 효과가 너무 구림.」

     숫자 쪽은 약하지 않다 — 실측으로 주문 한 방이 평타의 4~7배다.
     약한 것은 **화면**이었다. 피해 주문 셋이 전부 같은 선(beam) 하나에
     색만 달랐고, 나머지 다섯(점멸·탐지·치유·축복·지도)은 아무 프레임도
     없었다. 기예는 이미 하나씩 제 그림을 갖고 있는데 주문만 없었다.

     기예와 같은 문을 쓴다: 여기서 한 번 띄우고, 그리는 쪽이 id로
     갈래를 탄다. 손에 든 것도 같이 실어 보낸다(auraOf) — 강화와 각인이
     기예에서 보이는데 주문에서 안 보이면, 지팡이를 벼려도 화면은
     아무 말도 안 하게 된다. */
  fx({ t:'spellCast', id: sp.id, x: p.x, y: p.y,
       tx: nearest?.x, ty: nearest?.y, realm: CLASSES[p.cls].realm, pow, aura: auraOf(p),
       echo: echo?.id || null, affix: aff?.id || null });

  switch (sp.id) {
    case 'bolt':
    case 'smite': {
      if (!nearest) { say('시야에 적이 없다.'); break; }
      const holy = sp.id === 'smite';
      /* ── 화살 하나로 판이 끝나고 있었다 ────────────────────
         실측: 마력 화살 한 방이 평타의 **20배**인데 값이 1이라 한 층에
         예순여덟 번 쏜다. 층 총량으로 ×33.5 — 마법사는 평타를 칠 이유가
         아예 없고, 판 내내 버튼 하나만 누르면 된다. 「스킬이 평타보다
         좋나 모르겠다」는 반대쪽 직업의 말이었고, 이쪽은 정반대로
         깨져 있었다.

         주사위가 레벨에 **선형**으로 붙는 것이 원인이다(lv/3 — 24레벨이면
         10개). 상한을 둔다: 화살은 마법사의 기본기이지 결승타가 아니고,
         결승타 자리는 서리 폭발이 맡는다. 값도 1 → 2로 올려 마나가
         실제 예산이 되게 한다(data.js).

         응징의 빛은 반대로 값에 비해 약했다(×1.8). 주사위는 그대로
         두고 값을 5 → 4로 내린다 — 팔라딘의 마나는 맹세와 나눠 쓰는
         자원이라 한 번 더 쏘는 것이 실제로 크다. */
      const raw = holy
        ? roll(3 + Math.min(5, Math.floor(p.lv / 3)), 6) + statB(p, 'wis') * 2
        : roll(2 + Math.min(3, Math.floor(p.lv / 5)), 5) + statB(p, 'int') * 2;
      const dmg = Math.max(1, Math.round(raw * pow));
      fx({ t:'beam', fx:p.x, fy:p.y, tx:nearest.x, ty:nearest.y, color: holy ? 'y' : 'P' });
      hurtMonster(nearest, dmg, holy ? '응징의 빛' : '마력 화살', { weapon: 'spell' });
      spellDrain(aff, dmg);
      rime(nearest);
      splash(nearest, dmg, holy ? '응징의 빛' : '마력 화살');
      // 메아리치는: half of it carries to a second target.
      // 울림의 은총 does the same thing without needing the affix,
      // so a caster who finds one has it on every spell at once.
      if (aff?.chainSpell || hasBoon('echo')) {
        /* 메아리의 방: the echo echoes. Same halving each hop, one
           more body — and the room charges mana for the extra one,
           which is the whole trade. A caster who widens this way
           runs dry a floor sooner, and when the pool is empty the
           spell is back to touching two. */
        const room = hasResonance('echoroom');
        const hit = new Set([nearest]);
        let carry = dmg, from = nearest;
        for (let hop = 0; hop < (room ? ECHO_ROOM_HOPS : 1); hop++) {
          const next = visible.find(o => !hit.has(o) && G.monsters.includes(o));
          if (!next) break;
          if (hop > 0) {
            const toll = Math.max(1, Math.ceil(spellCost(p, sp) * ECHO_ROOM_TOLL));
            if (p.mana < toll) break;
            p.mana -= toll;
          }
          carry = Math.max(1, Math.round(carry * (room ? ECHO_ROOM_KEEP : 0.5)));
          fx({ t:'beam', fx:from.x, fy:from.y, tx:next.x, ty:next.y, color: holy ? 'y' : 'P' });
          hurtMonster(next, carry, '메아리', { weapon: 'spell' });
          spellDrain(aff, carry);
          hit.add(next); from = next;
        }
      }
      break;
    }
    case 'blink': {
      for (let t = 0; t < 60; t++) {
        const x = p.x + rnd(15) - 7, y = p.y + rnd(15) - 7;
        if (!G.level.solid(x, y) && !monsterAt(x, y)) { p.x = x; p.y = y; break; }
      }
      say('한 걸음 옆이 아닌 곳에 서 있다.', 'good'); break;
    }
    case 'cure': {
      const h = Math.min(p.maxhp - p.hp, Math.round((12 + roll(2, 6) + statB(p, 'wis') * 3) * pow * healScale()));
      p.hp += h; fx({ t:'heal', x:p.x, y:p.y, amt:h }); say(`상처가 닫힌다. 체력 +${h}.`, 'good'); break;
    }
    case 'heal': {
      const back = mendWound(BIG_HEAL_MEND);
      const h = Math.min(p.maxhp - p.hp, Math.round((Math.floor(p.maxhp * 0.55) + roll(3, 8)) * pow * healScale()));
      p.hp += h; fx({ t:'heal', x:p.x, y:p.y, amt:h });
      say(back ? `빛이 몸을 훑고 지나간다. 체력 +${h}, 천장 +${back}.`
               : `빛이 몸을 훑고 지나간다. 체력 +${h}.`, 'good'); break;
    }
    case 'bless': p.blessed = 25 + p.lv; say('가벼워진 기분이다.', 'good'); break;
    case 'detect': {
      let unmasked = 0;
      for (const m of G.monsters) {
        G.level.seen[idx(m.x, m.y)] = 1;
        // Life detection sees straight through a lid.
        if (m.disguise) { m.disguise = false; m.spr = 'mimic'; unmasked++; fx({ t:'reveal', x:m.x, y:m.y }); }
      }
      G.detectPulse = 30;
      say(unmasked ? `숨소리가 어디에서 나는지 알겠다. 상자 하나가 숨을 쉬고 있다.`
                   : '숨소리가 어디에서 나는지 알겠다.', 'good');
      break;
    }
    case 'frost': {
      /* 지형's afterimage turns the burst into the floor. Frost is
         the only spell whose reach is a radius, so it is the one
         that feels the difference. */
      let n = 0;
      const r = reach ? 999 : 5;
      fx({ t:'burst', x:p.x, y:p.y, r: reach ? 10 : 5, color:'B' });
      for (const m of [...visible])
        if (Math.hypot(m.x - p.x, m.y - p.y) <= r) {
          const d = Math.max(1, Math.round((roll(3, 8) + p.lv) * pow));
          hurtMonster(m, d, '서리', { weapon: 'spell' }); spellDrain(aff, d);
          rime(m); n++;
        }
      say(n ? (reach ? '층 전체의 공기가 얼어붙는다.' : '주변 공기가 얼어붙는다.')
            : '얼릴 것이 없다.', n ? 'good' : ''); break;
    }
    case 'map': revealMap(); say('층의 구조가 머릿속에 그려진다.', 'good'); break;
  }
  /* 자취: this cast was free of the clock, so it also leaves
     nothing behind. Without that the mage blinks, casts free,
     leaves 자취 again, and never spends a turn — an infinite free
     action dressed as a trait. One sentence: a cast that did not
     cost a turn does not write the next word. */
  const free = echo?.id === 'haste';
  if (!free) {
    leaveEcho(p, sp.id);
    endTurn();
  } else {
    fx({ t:'twin', x:p.x, y:p.y });
    say('자취를 따라, 시간을 쓰지 않고.', 'good');
  }
}

/* Spell enhancement is the same two dials as gear: a flat safe
   climb, and an affix that changes what the spell *does*. */
export const spellPower = (p, id) =>
  (1 + (p.spellPlus?.[id] || 0) * 0.22
     + gearBonus(p).spellPow
     + (SPELL_AFFIXES.find(a => a.id === p.spellAffix?.[id])?.powPct || 0))
  * (hasRelic('paradox') ? 0.55 : hasRelic('twin') && !cracked('twin') ? 0.8 : 1);

export const spellCost = (p, sp) => {
  const a = SPELL_AFFIXES.find(x => x.id === p.spellAffix?.[sp.id]);
  if (strangeIs('sanctum')) return 0;    // 비어 있는 성소에는 값이 없다
  if (hasRelic('paradox')) return 0;
  // 마지막 등불: the shorter the wick, the brighter. Free while
  // you are nearly gone — which is exactly when a caster is out
  // of mana anyway.
  if (p.equip?.weapon?.unique === 'lastlamp' && p.hp < p.maxhp * 0.25) return 0;
  return Math.max(1, sp.cost - (a?.costCut || 0) - (raceRule(p, 'spellCut') || 0) + (a?.costUp || 0)
                     - (hasRelic('twin') ? relicVal('twin') : 0));
};

function spellDrain(aff, dmg) {
  if (!aff?.spellSteal) return;
  const p = G.player;
  const got = Math.min(p.maxhp - p.hp, Math.max(1, Math.round(dmg * aff.spellSteal)));
  if (got <= 0) return;
  p.hp += got;
  fx({ t:'drain', x:p.x, y:p.y, amt:got });
  /* 주문의 흡수는 주문 속성이 하는 일이다. 무기 이름을 부르면
     엉뚱한 물건이 공을 가져간다 — 여기서는 주문이 말한다. */
  credit('spellsteal', `${aff.n || '흡수하는'} 주문이 되마셨다. 체력 +${got}.`);
}

/* ── level flow ─────────────────────────────────────────── */
/* ── 이물(異物) — 여기 있으면 안 되는 층 ────────────────────
   플레이어: 「10판 × 15스테이지 중 1스테이지 수준」, 「완전히 운으로
   랜덤하되 특정 조건에서는 확률이 높은 개념」 — 아이작의 악마방이다.

   그래서 두 층으로 짠다.
     · **바닥은 순수한 운.** 9층 아래에서 층을 옮길 때 1%.
     · **그 위에 판이 한 짓이 얹힌다.** 다섯 이물마다 자기를
       불러들이는 짓이 다르고, 그 짓을 한 판에서만 그 이물의 몫이
       커진다. 그러면 「운이 좋았다」가 아니라 「내가 불렀다」가 된다.

   판정은 여기 한 곳에서만 한다. 세계(world.js)는 결과만 받는다 —
   두 곳에서 굴리면 화면에 뜬 것과 규칙이 갈린다.

   ── 왜 「끌림」을 이렇게 골랐나 ────────────────────────────
   전부 **플레이어가 이미 하고 있는 것**이고, 전부 화면에 보이는
   값이다. 숨은 카운터로 확률을 흔들면 그건 운도 결정도 아니다. */
const STRANGE_PULL = {
  /* 성소: 주문·기예를 많이 쓴 판. 그 값이 없는 방이 부른다. */
  sanctum: () => Math.min(1, (G.artsUsed || 0) / 40),
  /* 바깥: 주목. 깊은 곳이 너를 똑바로 보면, 보는 것이 하나 더 는다. */
  void:    () => Math.min(1, (G.heat || 0) / HEAT_MAX),
  /* 눈의 방: 들키지 않고 걸은 판. 안 보이려 애쓸수록 그것이 부른다. */
  eyes:    () => Math.min(1, (G.sneaked || 0) / 30),
  /* 뱃속: 체력. 반쯤 삼켜진 채로 걷고 있으면 나머지도 삼킨다. */
  gullet:  () => { const p = G.player;
                   return p ? Math.max(0, 1 - p.hp / Math.max(1, p.maxhp)) : 0; },
  /* 지지직: 같은 것을 여러 번 본 판. 반복이 화면을 상하게 한다. */
  static:  () => Math.min(1, (G.eventsSeen || 0) / 8),
};
/* 이 층에서 이물이 뜰 확률과, 떴다면 어느 것인가. 화면(도움말·
   기록)도 이 함수를 읽으므로 「미리 다 적혀 있다」가 유지된다. */
export function strangeOdds(depth = G.depth) {
  if (depth < STRANGE_FROM || depth >= MAX_DEPTH) return { p: 0, weights: {} };
  const weights = {};
  let extra = 0;
  for (const o of STRANGE) {
    /* 이미 이 판에서 본 것은 다시 안 부른다 — 두 번 보면 사고가
       아니라 지형이 된다. */
    if ((G.strangeSeen || []).includes(o.id)) { weights[o.id] = 0; continue; }
    const w = STRANGE_PULL[o.id]?.() || 0;
    weights[o.id] = w;
    extra += w;
  }
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  /* 다섯 몫을 합쳐 봐야 상한을 못 넘는다. 여덟 판에 한 번은 「가끔」이
     아니라 「자주」다. */
  const p = Math.min(STRANGE_CAP, STRANGE_BASE + extra * 0.022);
  return { p, weights, total };
}
export function rollStrange(depth) {
  const { p, weights, total } = strangeOdds(depth);
  if (!p || Math.random() >= p) return null;
  /* 어느 이물인가는 끌림에 비례해서 고른다. 아무것도 안 불렀으면
     다섯이 똑같다 — 순수한 사고다. */
  const ids = Object.keys(weights).filter(id => weights[id] >= 0
    && !(G.strangeSeen || []).includes(id));
  if (!ids.length) return null;
  if (!total) return ids[rnd(ids.length)];
  let r = Math.random() * total;
  for (const id of ids) { if (r < weights[id]) return id; r -= weights[id]; }
  return ids[ids.length - 1];
}
/* 이 판이 지금 어느 이물 안에 있는가. 한 글자짜리 깔때기 —
   다섯 규칙이 전부 이것만 읽는다. */
export const strangeIs = id => G.strange === id;

/* 이물의 층을 세계가 읽을 수 있는 모양으로. THEMES 와 같은 키를
   쓰므로 생성기는 이것이 특별한 층이라는 것을 몰라도 된다. */
const strangeTheme = id => { const o = strangeById(id);
  return o ? { id: o.id, n: o.n, weight: 0, ...o.mods } : null; };


/* 이물이 남기는 것. 층을 만든 직후, 몬스터가 서기 전에 놓는다 —
   나중에 놓으면 「이미 다 치운 방」에 물건이 나타난다.

   다섯을 if 사슬로 쌓았더니 매듭 린트가 바로 잡았다(복잡도 16).
   표로 편다: 이물이 하나 늘면 줄이 하나 는다. */
const dropAt = (it) => {
  const L = G.level, p = G.player;
  const r = L.rooms[rnd(L.rooms.length)];
  const at = r ? { x: r.x + rnd(r.w), y: r.y + rnd(r.h) } : { x: p.x, y: p.y };
  G.items.push({ ...it, x: at.x, y: at.y });
};
const dropRelic = () => {
  const rid = unownedRelic();
  if (rid) dropAt({ kind:'relic', id: rid, spr: relicById(rid).spr, n: relicById(rid).n });
};
const STRANGE_PAY = {
  /* 성소: 아무도 못 가져간 것이 그대로 있다. */
  sanctum: () => dropRelic(),
  /* 바깥: 여기 것이 아닌 물건. 이름 있는 무기는 판에 하나뿐이라
     이 층은 그 하나를 확정으로 만든다. */
  void: () => {
    const pool = UNIQUES.filter(u => !(G.uniques || {})[u.id]);
    if (!pool.length) return dropRelic();
    const u = pool[rnd(pool.length)];
    (G.uniques = G.uniques || {})[u.id] = true;
    dropAt({ kind:'weapon', unique:u.id, ...u });
  },
  /* 눈의 방: 벽이 본 것을 너도 본다 — 숨을 수 없는 대가로 숨은
     것이 없다. */
  eyes: () => { revealMap(); dropRelic(); },
  /* 뱃속: 아직 소화되지 않은 것들. 시계가 절반인 대가다. */
  gullet: (depth) => {
    const p = G.player;
    p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
    p.mats.scrap += 40 + depth * 6;
    p.mats.dust += 14 + depth * 2;
    p.mats.essence += 3 + Math.floor(depth / 4);
  },
  /* 지지직: 잘못 그려진 물건이라 지나치게 잘 벼려져 있다. */
  static: (depth) => {
    const it = pickItem(depth + 10);
    if (it.kind === 'weapon' || it.kind === 'armour') {
      it.plus = Math.max(it.plus || 0, 6 + rnd(3));
      rollAffixes(it, depth + 20, true);
    }
    dropAt(it);
  },
};
const strangePayoff = (id, depth) => { if (G.level && G.player) STRANGE_PAY[id]?.(depth); };

export function enterDepth(depth, fromBelow = false, branch = null) {
  /* 허기로 부푼 몫은 한 층만 간다. 층에 들어서는 이 자리에서
     되돌린다 — 처음에는 판 시작 자리에 넣었는데, 그러면 판이 끝날
     때까지 안 빠져서 크랙이 아니라 무한 성장이 된다(벤치가 잡았다).
     무한은 설계가 아니다. */
  G.promiseFloor = 0;
  if (G.famineSwell && G.player) {
    G.famineSwell = 0;
    recalc(G.player);
    G.player.hp = Math.min(G.player.hp, G.player.maxhp);
  }
  /* 앞 층을 닫고 새 층을 연다. 닫는 것이 먼저다 — floorBudget 이
     G.depth 를 읽으므로, 깊이를 바꾼 뒤에 닫으면 앞 층의 여유를
     새 층의 값으로 적게 된다. */
  traceCloseFloor();
  G.depth = depth;
  if (depth > 0) crackFloorTick();
  G.deepest = Math.max(G.deepest || 0, depth);
  G.branch = branch || BRANCHES[0];
  /* 층을 만들기 전에 규칙이 편향을 건넨다. 항아리가 깨졌으면 불이
     반드시 서고, 나방이 깨졌으면 시설 하나가 더 선다. */
  /* 이물은 층을 만들기 **전에** 정해진다. 만들고 나서 갈아 끼우면
     그건 다른 층 위에 페인트를 칠하는 것이고, 방 수와 빛과 몬스터
     예산이 전부 원래 층 것으로 남는다. */
  G.strange = depth > 0 ? rollStrange(depth) : null;
  if (G.strange) (G.strangeSeen ||= []).push(G.strange);
  setFacilityBias({ camp: cracked('ember'), extra: cracked('moth'),
                    noCamp: hasArcana('echo'), extraEvent: hasArcana('echo'),
                    strange: G.strange ? strangeTheme(G.strange) : null });
  G.level = new Level(depth, G.branch);
  G.monsters = [];
  G.items = [];
  G.floorTurn = 0;
  G.waves = 0;
  G.chainGuard = 0;                 // ③ 사슬 갑주 — 층마다 한 대
  G.floorArts = {};                 // 층에 한 번 쓰는 기예들
  if (G.player) G.player.tookPool = 0;   // 되갚기는 층 단위다
  /* 열기는 층에 들어설 때 한 번 굳는다. 아래의 스폰과 시계가 전부
     이 값을 읽으므로 **무엇보다 먼저** 정해져야 한다. */
  if (depth > 0) settleHeat();
  G.hazards = []; G.snares = []; G.sanctum = null;
  G.campUses = 1 + (hasRelic('ember') ? (cracked('ember') ? 2 : 1) : 0);
  G.tideUsed = false;
  /* ── 이 층의 과업 ────────────────────────────────────────
     계단을 찾는 것 말고 할 일을 하나 준다. 자세한 이유는 data.js의
     TASKS 주석에. 여기서는 뽑기만 하고, 실제로 잠그는 것은 stairHere와
     descend가 한 곳에서 본다 — 두 곳에서 보면 언젠가 갈린다. */
  G.task = null; G.taskDone = false;
  {
    const pool = TASKS.filter(t => depth >= t.from);
    if (pool.length && depth < MAX_DEPTH && Math.random() < TASK_ODDS) {
      G.task = pickWeighted(pool);
    }
  }

  const L = G.level;
  const p = G.player;
  if (depth === 0) { p.x = L.entry.x; p.y = L.entry.y; }
  else if (fromBelow) {
    const d = findTile(L, DOWN); p.x = d.x; p.y = d.y;
  } else { p.x = L.entry.x; p.y = L.entry.y; }

  /* Modifiers a ? room promised for "the next floor", spent here
     and cleared immediately so they cannot carry on past it. */
  const mods = G.nextMods || null;
  G.nextMods = null;
  if (mods && depth > 0) {
    G.branch = { ...G.branch };
    for (const k of ['item', 'elite', 'chests', 'clock'])
      if (mods[k] != null) G.branch[k] = (G.branch[k] ?? 1) * mods[k];
  }

  /* 화부의 기억: 잿불 아래 always holds one. Floors 11 to 14 are
     where measured runs now end, and they end with no health and
     nowhere to spend a turn getting it back. This does not hand
     any back — it puts a fire on the floor and leaves the walk
     to the player. */
  if (depth >= 11 && depth <= 14 && hasMemory('hearth') && !L.camp) L.forceCamp();

  /* A fire promised three floors ago has to actually be here. */
  if (depth > 0 && G.campPromise > 0 && !L.camp) {
    G.campPromise--;
    L.forceCamp();
  } else if (depth > 0 && G.campPromise > 0) G.campPromise--;

  if (depth > 0) populate(depth);
  /* 열쇠를 물린다. populate 뒤라야 물릴 것이 있다.
     가장 깊은 곳에 있는 것이 아니라 **가장 센 것**에게 준다 — 그러면
     「어딘가에 있다」가 「저것을 잡아야 한다」가 되고, 그 판단이 곧
     이 과업의 내용이다. 아무도 없으면 과업을 무른다: 열쇠 없는 잠긴
     계단은 과업이 아니라 벽이다. */
  /* 재촉하는 과업. 계단을 지도에 찍어 주고 시계를 반으로 줄인다 —
     「어디로 갈지」가 사라지므로 남는 결정은 「무엇을 버리고 갈지」다.
     잠그지 않으므로 stairsLocked는 이쪽을 안 본다. */
  /* ③ 부러진 나침반의 크랙. 함정은 여전히 안 보인다 — 부러진 바늘이
     보는 것은 계단 하나뿐이고, 그것이 이 유물의 이야기다. */
  if (cracked('compass'))
    for (let i = 0; i < L.tiles.length; i++) if (L.tiles[i] === DOWN) L.seen[i] = 1;
  if (G.task?.rush) {
    G.taskDone = true;
    for (let i = 0; i < L.tiles.length; i++) if (L.tiles[i] === DOWN) L.seen[i] = 1;
    G.branch = { ...G.branch, clock: (G.branch.clock ?? 1) * 0.5 };
    say(G.task.intro, 'warn');
  }
  if (G.task?.id === 'key') {
    /* ── 무엇에게 물릴 것인가 ────────────────────────────
       xp 최댓값 하나로 골랐더니 두 가지가 새어 들어왔다.
       층당 40판씩 360판을 세어 보니:

         · 4·5·7·8·12층에서 **금빛 도둑**이 8~15% — 조작법이
           「걸어서는 절대 못 잡습니다」라고 적어 둔 바로 그것이다.
           도둑은 xp 120이라 「가장 센 것」이 아니라 「가장 비싼 것」이
           뽑힌다. 못 잡는 것에게 물리면 과업이 아니라 160턴짜리
           대기실이다.
         · 6·10·13층에서 **이름 있는 것이 100%** — 그것들은 자기
           자리를 지키고 먼저 건드리지 않으면 안 따라온다. 「싸울지
           지나칠지」가 플레이어의 결정이라고 화면이 약속해 놓고,
           과업이 그 결정을 압수한다. 6층에서는 185HP짜리를 층
           중앙값 34 사이에서 잡으라는 뜻이 된다 — 층이 아니라
           보스전이다.

       둘 다 후보에서 뺀다. 남는 것이 없으면 과업을 접는다 —
       잡을 수 없는 과업을 다는 것보다 안 다는 편이 낫다. */
    const pool = G.monsters.filter(m => !m.disguise && !m.thief && !m.named);
    if (!pool.length) G.task = null;
    else {
      const holder = pool.reduce((a, m) => (m.xp || 0) > (a.xp || 0) ? m : a, pool[0]);
      holder.hasKey = true;
      say(G.task.intro, 'warn');
    }
  }
  /* 칸마다 다른 사건. 여태 층에 하나만 굴려서, ? 가 둘 놓인 층은
     둘째가 죽은 칸이었다. 굴린 것을 서로 겹치지 않게 뽑는다 —
     같은 사건을 두 번 만나면 「여러 개」가 아니라 「한 번 더」다. */
  L.eventAt = new Map();
  if (depth > 0)
    for (const i of L.eventTiles || []) {
      const id = rollEvent([...L.eventAt.values()]);
      if (id) L.eventAt.set(i, id);
    }
  if (mods?.mapped && depth > 0) L.seen.fill(1);
  /* 길잡이의 기억: the shape of the floor, from floor 11 down.
     Not what is on it — the walls only. Dying because you walked
     into the wrong corridor at one health is a different failure
     from dying to the thing at the end of the right one. */
  if (depth >= 11 && hasMemory('pathfinder')) L.seen.fill(1);
  refreshFov();

  /* A fire burns whether or not you are looking at it. Mark it
     as remembered the moment you arrive, so the floor has a
     destination other than the stairs — otherwise most players
     would walk past the one real decision on the level. */
  if (L.camp) {
    L.seen[idx(L.camp.x, L.camp.y)] = 1;
    if (depth > 0) say('멀리서 불빛이 흔들린다.', 'good');
  }
  /* Where you are, said once, the turn you arrive — and only
     when it changes. Fifteen floors were fifteen numbers; five
     named places is a descent you can describe to somebody. */
  if (depth > 0) {
    const region = regionOf(depth);
    if (region.n !== G.regionAt) {
      G.regionAt = region.n;
      say(region.line, 'level');
      /* 그리고 왜 여기 있는지. 구역이 바뀔 때마다 위의 소식이
         한 줄 나빠지고, 앞서 내려간 자들의 흔적이 한 줄 줄어든다.
         이 게임에서 유일하게 「밖」을 말하는 자리다. */
      if (region.stake) say(region.stake, 'warn');
      if (Meta.see('regions', region.n))
        lore('처음 밟는 곳', region.n, `${region.t}\n\n${region.stake || ''}`, 'stairsDown');
    }
  }
  if (depth > 0 && L.theme?.n) say(`${L.theme.n}이다.`, 'warn');
  placeFallen(L, depth);

  // 심연의 눈 pays out the moment you arrive, which is the only
  // moment a whole map is worth anything.
  if (depth > 0 && (hasRelic('eye') || hasRelic('oracle'))) {
    L.seen.fill(1);
    say(hasRelic('oracle') ? '눈먼 예언자가 층 전체를 읊는다.' : '심연의 눈이 층 전체를 훑는다.', 'good');
  }
  /* 나방의 표식 shows the three places worth walking to instead of
     the whole map — cheaper than 심연의 눈 and, for a player who
     only cares about the fire and the stone, better. */
  if (depth > 0 && hasRelic('moth')) {
    let n = 0;
    for (const spot of [L.camp, L.altar, L.merchant])
      if (spot) { L.seen[idx(spot.x, spot.y)] = 1; n++; }
    /* ? 는 층에 둘일 수 있다. 하나만 찍어 주던 동안 「사건 위치가
       보인다」는 반쯤만 참이었다. */
    for (const i of L.eventTiles || []) { L.seen[i] = 1; n++; }
    if (n) say(`나방이 ${n}곳으로 날아갔다.`, 'good');
  }
  // 뱃사공의 동전 takes its cut on the way down.
  if (depth > 0 && p.gold > 0
      && ((hasRelic('toll') && !cracked('toll')) || (hasRelic('ledger') && !cracked('ledger')))) {
    const rate = hasRelic('ledger') ? 0.20 : 0.10;
    const fee = Math.ceil(p.gold * rate);
    p.gold -= fee;
    say(hasRelic('ledger') ? `장부가 ${fee}닢을 지웠다.` : `뱃사공이 ${fee}닢을 챙겼다.`, 'warn');
  }
  // 돌씨 hardens a little every floor, for the whole run.
  /* 재촉하는 판 — 서두른 사람은 오래 산다. 서두를 줄 아는 동안은. */
  if (depth > 0 && hasArcana('clock')) {
    p.permHp = (p.permHp || 0) + 4;
    recalc(p);
    say('서두른 만큼 몸이 버텨 준다. 최대 체력 +4.', 'good');
  }
  if (depth > 0 && hasRelic('seed')) {
    p.seedAc = (p.seedAc || 0) + relicVal('seed') * (cracked('seed') ? 2 : 1);
    recalc(p);
    say(`돌씨가 자란다. 방어 +${p.seedAc}.`, 'good');
  }
  /* 여명의 각인: the floor opens and the wounds close a little. */
  if (depth > 0) {
    const dawn = gearBonus(p).dawn;
    if (dawn && p.hp < p.maxhp) {
      /* 여명의 맹세: not a slice of the sheet — the whole sheet.
         A build that adds nothing to what you hit for has to be
         paid somewhere, and this is where. */
      const got = hasResonance('dawnoath') ? p.maxhp - p.hp
                : Math.min(p.maxhp - p.hp, Math.round(p.maxhp * dawn));
      p.hp += got;
      say(`여명 — 층이 열리며 상처가 아문다. 체력 +${got}.`, 'good');
      fx({ t:'heal', x:p.x, y:p.y, amt:got });
    }
  }
  G.tally = 0;                      // 처형인의 셈 starts over each floor
  /* ① 크랙 「셈이 끝나지 않는다」. 예전에는 층마다 지웠다 — 그것이
     이 칼의 값이자 한계였다. 크랙은 그 한계를 지운다: 판이 끝날
     때까지 센다. 여덟마다 주사위가 한 면씩 커지므로, 오래 든 사람의
     손에서 이 단검은 대검을 넘어선다. */
  // G.ashCount는 이제 판 단위다 — 층에서 안 지운다.
  G.hushUntil = -1;
  if (depth > 0 && !cracked('grudge')) p.grudge = 0;   // 앙심 forgets between floors — 크랙 전까지만
  if (depth > 0) { p.chain3 = 0; p.markN = 0; p.chainOn = null; p.markOn = null; }

  /* The wager climbs with every floor you take without sitting
     down. Nothing is banked in the town, and nothing survives
     you — that is the whole tension. */
  if (depth > 0) {
    G.bank = Math.min(BANK_MAX, (G.bank || 0) + 1);
    if (G.bank >= 2) {
      const purse = bankPurse(G.bank, depth);
      say(`쉬지 않고 ${G.bank}층 — 판돈이 ${purse.gold}닢까지 불었다.`, 'level');
    }
  } else G.bank = 0;
  // 시간 도둑 buys the descent back — and charges for it in turns.
  if (depth > 0 && hasRelic('thief') && p.hp < p.maxhp) {
    p.hp = p.maxhp; p.mana = p.maxmana;
    say('시간 도둑이 상처를 되감았다.', 'good');
    fx({ t:'heal', x:p.x, y:p.y, amt:0 });
  }
  /* ── 아르카나 화면은 규칙이 요구한다 ────────────────────
     여기 없었다. `arcanaDue` 를 보는 곳이 ui.js 의 setScreen('play')
     한 곳뿐이었는데, enterDepth 를 부르는 경로 셋 중 **둘은 화면을
     안 바꾼다** — 구덩이 낙하와 도주 두루마리. 그 둘로 4층에 도착하면
     아르카나가 안 뜨고 그대로 지나가고, `arcanaDue` 는 보유 개수로
     세므로 그 판은 셋이 아니라 둘로 끝났다.

     그래서 pendingRelic·pendingBranch 와 같은 문법을 쓴다: 규칙이
     화면을 세우고, ui 는 그것을 띄우기만 한다. */
  /* ── 이물은 반드시 값을 낸다 ────────────────────────────
     여기를 밟았는데 아무것도 없으면 그건 기괴한 것이 아니라 낭비다.
     아이작의 악마방이 무서운 것은 무서워서가 아니라 **거기에만 있는
     것이 있어서**다. 다섯이 각자 다른 값을 낸다 — 하나는 유물,
     하나는 이름 있는 무기, 하나는 지도, 하나는 재료, 하나는 벼려진
     물건. 어느 것이 나오는지가 그 이물의 성격이다. */
  if (G.strange) {
    const o = strangeById(G.strange);
    strangePayoff(G.strange, depth);
    /* 밟는 순간 이것이 사고라는 것을 말한다. 층 이름을 조용히 바꾸는
       것으로는 부족하다 — 열 판에 한 번 보는 것이라, 본 사람이
       「내가 뭘 본 거지」라고 물을 만큼은 크게 말해야 한다. */
    trace('strange', { id: G.strange, n: o.n });
    say(`${o.n}. ${o.lore}`, 'level');
    say(o.t, 'warn');
    lore('strange', o.n, `${o.lore}\n\n${o.t}`, o.spr);
    fx({ t:'arcana', n: o.n });
  }
  if (depth > 0) traceOpenFloor(depth);
  if (depth > 0 && pledgeDue(depth)) G.screen = 'arcana';
}

function findTile(L, t) {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++)
    if (L.tiles[idx(x, y)] === t) return { x, y };
  return L.entry;
}

function populate(depth) {
  const L = G.level;
  const busy = (x, y) => (G.player.x === x && G.player.y === y) || monsterAt(x, y) || itemAt(x, y);

  if (depth === MAX_DEPTH) {
    const spot = L.openSpot(L.downRoom || L.rooms[L.rooms.length - 1], busy);
    if (spot) G.monsters.push({ ...BOSS, maxhp: BOSS.hp, x: spot.x, y: spot.y, awake: false });
  }

  /* A named thing waits on two floors on the way down. Announced
     on arrival, because a floor you know holds one is a floor you
     walk differently — and the patterns are the reason walking
     differently matters. */
  /* A named thing waits on two floors on the way down, and it
     waits somewhere you do not have to go. Putting it in the
     stairs room made it a toll rather than a decision — the
     arrival message announces it, so the player can weigh the
     relic against the fight and walk the other way. */
  const named = NAMED.find(n => n.at === depth);
  if (named) {
    const banned = new Set([L.roomOf[idx(G.player.x, G.player.y)],
                            L.downRoom ? L.rooms.indexOf(L.downRoom) : -1]);
    const away = L.rooms.filter((r, i) => !banned.has(i));
    const room = (away.length ? away : L.rooms)[rnd(Math.max(1, away.length || L.rooms.length))];
    const spot = L.openSpot(room, busy);
    if (spot) {
      G.monsters.push({ ...named, maxhp: named.hp, x: spot.x, y: spot.y, awake: false, energy: 0 });
      say(named.intro, 'hit');
      lore('이름 있는 것', named.n, named.intro, named.spr);
    }
  }

  /* Pack animals arrive as a pack. Six wolves coming down one
     corridor is a different problem from six wolves scattered
     across a floor, and it is the problem doors are for. */
  const br = G.branch || {};
  const mob = G.level.theme?.mob || 1;
  /* Fewer, heavier. Twelve monsters a floor at two turns each
     cost more health than every healing source on the floor
     could return, so runs ended on floor four or five no matter
     how well an individual fight went. Cutting the count is the
     lever that makes each fight matter *and* makes the descent
     survivable — the opposite of raising everyone's health. */
  /* 아르카나가 세계에 손대는 첫 자리. 「얇은 판」은 수를 줄이고 남은
     것을 전부 정예로 만든다 — 마릿수가 아니라 **밀도의 성격**이 바뀐다. */
  const budget = Math.round((4 + rnd(3) + Math.floor(depth * 0.55))
                            * Math.min(mob, 1.35) * (br.mon || 1)
                            * (hasArcana('thin') ? 0.7 : 1));
  let placed = 0;
  for (let guard = 0; placed < budget && guard < budget * 4; guard++) {
    const m = pickMonster(depth);
    if (!m) continue;
    /* 방 0(들어선 방)을 피해 1번부터 고른다 — 그런데 방이 **하나뿐인**
       층이면 `rooms[1]` 은 undefined 이고, openSpot 이 그 자리에서
       터진다. 「바깥」은 벽이 없는 층이라 방이 하나로 나올 수 있고,
       실제로 봇 판이 여기서 죽었다. 하나뿐이면 그 방을 쓴다 —
       들어서자마자 마주치는 것이 그 층의 성격이다. */
    const room = L.rooms[1 + rnd(Math.max(1, L.rooms.length - 1))] || L.rooms[0];
    if (!room) continue;
    const lead = L.openSpot(room, busy);
    if (!lead) continue;

    const size = m.grp ? m.grp[0] + rnd(m.grp[1] - m.grp[0] + 1) : 1;
    for (let k = 0; k < size && placed < budget; k++) {
      const spot = k === 0 ? lead
        : L.openSpot({ x: lead.x - 2, y: lead.y - 2, w: 5, h: 5 }, busy);
      if (!spot) continue;
      /* 열기가 층을 깨워 놓는다. 「보이는 몬스터가 0.5%뿐이라 둘러싸일
         일이 없다」는 실측에 직접 답하는 줄이다 — 세진 만큼 층이 너를
         기다리고 있고, 그 기다림은 걸어 들어가는 순간부터다. */
      const one = { ...m, x: spot.x, y: spot.y,
                    awake: strangeIs('eyes')          // 눈의 방은 전부 깨어 있다
                        || (hasShackle('awake') && Math.random() < 0.5)
                        || Math.random() < heatAwake(), energy: 0 };
      if (hasArcana('thin') || Math.random() < eliteChance(depth) * (br.elite ?? 1))
        makeElite(one, depth);
      one.maxhp = one.hp;
      G.monsters.push(one);
      placed++;
    }
  }

  /* Half as many things, each worth stopping for. Eight or nine
     drops a floor read as generous and delivered nothing — you
     walked past most of them, and the ones you picked up were
     indistinguishable from the ones you left. Three or four,
     drawn from your own depth band, is the same total value
     arriving in pieces big enough to notice. */
  const loot = Math.max(1, Math.round((2 + rnd(3)) * (br.item || 1)
                        * (hasArcana('famine') ? 0.5 : 1)));
  for (let i = 0; i < loot; i++) {
    const item = pickItem(depth);
    const spot = L.randomFloor(busy);
    if (spot && item) G.items.push({ ...item, x: spot.x, y: spot.y });
  }
  /* Same gold, fewer piles. A pile you cross the room for. */
  const piles = 1 + rnd(2);
  for (let i = 0; i < piles; i++) {
    const spot = L.randomFloor(busy);
    if (spot) G.items.push({ kind:'gold', spr:'gold', n:'금화',
      amount: Math.round((45 + rnd(90 + depth * 60)) * (br.gold || 1)), x: spot.x, y: spot.y });
  }

  /* A branch that promised a relic has to deliver one on the
     floor, not as a maybe-drop — the printed odds on the stairs
     screen are a contract. */
  if (br.relic) {
    const spot = L.randomFloor(busy);
    const id = unownedRelic();
    if (spot && id) { G.items.push({ kind:'relic', id, spr: relicById(id).spr,
                                   n: relicById(id).n, x: spot.x, y: spot.y });
      relicFrom('갈림길'); }
  }

  /* Chests, and the thing that is pretending to be one. The
     mimic share climbs with depth, so by the time a chest is
     worth opening you are no longer sure you should. */
  const chests = (1 + rnd(3)) * (br.chests || 1);
  const mimicShare = Math.min(0.34, 0.06 + depth * 0.013);
  for (let i = 0; i < chests; i++) {
    const spot = L.randomFloor(busy);
    if (!spot) continue;
    if (Math.random() < mimicShare) {
      const mim = mimicFor(depth);
      G.monsters.push({ ...mim, maxhp: mim.hp, x: spot.x, y: spot.y, awake: false, energy: 0 });
    } else {
      G.items.push(makeChest(depth, spot));
    }
  }

  /* Rarer than it was, because it is worth something now:
     the only answer to a lock that is silent, certain and
     instant. Forcing is always available and always costs. */
  if (Math.random() < 0.26) {
    const spot = L.randomFloor(busy);
    if (spot) G.items.push({ kind:'key', spr:'ring', n:'녹슨 열쇠', x: spot.x, y: spot.y });
  }

  /* The golden thief. Fast, fragile, worth a fortune, and it
     runs the instant it sees you — so catching one costs a roll,
     a spell or a scroll, and every turn spent chasing is a turn
     the floor clock keeps. Letting it go has to stay a real
     option or it is not a gamble, it is a tax. */
  if (Math.random() < thiefChance(depth)) {
    const spot = L.randomFloor(busy);
    if (spot) {
      const t = { ...THIEF, x: spot.x, y: spot.y, awake: false, energy: 0, fleeing: true };
      t.hp = Math.round(t.hp * (1 + depth * 0.12));
      t.ac = Math.round(t.ac * (1 + depth * 0.05));
      t.maxhp = t.hp;
      G.monsters.push(t);
      say('금붙이가 부딪치는 소리가 어디선가 난다.', 'level');
    }
  }
}

function makeChest(depth, spot) {
  const locked  = Math.random() < 0.42;
  const trapped = Math.random() < (locked ? 0.42 : 0.22);
  // A locked chest is worth the lockpick; that is the trade.
  const rolls = locked ? 2 + rnd(2) : 1 + rnd(2);
  const loot = [];
  for (let i = 0; i < rolls; i++) {
    const it = pickItem(depth + (locked ? 3 : 0));
    if (it) loot.push(it);
  }
  return {
    kind:'chest', spr:'chest', n:'상자', x: spot.x, y: spot.y,
    locked, trapped, loot,
    gold: Math.round((30 + rnd(60 + depth * 30)) * (locked ? 1.8 : 1)),
  };
}

function pickMonster(depth) {
  const pool = MONSTERS.filter(m => m.d <= depth && m.d >= depth - 5);
  if (!pool.length) return { ...MONSTERS[0] };
  const total = pool.reduce((s, m) => s + m.rar, 0);
  let r = rnd(total);
  for (const m of pool) { if (r < m.rar) return scaleMonster(m, depth); r -= m.rar; }
  return scaleMonster(pool[0], depth);
}

/* Two scalings, and they do different jobs.

   `over` is how far past its home depth this thing is being
   used, and keeps a rat from being a rat forever. `depth` is
   the floor itself, and is the one that was missing: without
   it the deepest monster in the book topped out at 143 health
   against a hero with 554, so the bestiary simply stopped
   being a threat somewhere around floor 6. */
/* 층당 배율. 나는 판 전체에서 20.6배 자란다(실측) — 세계는 그보다
   조금 느려야 한다. 표 자체가 이미 종을 따라 커지므로 여기 값은
   그 위에 얹는 얇은 층이다. */
export const MON_DEEP     = 1.017;   // 15층에서 ×1.29
export const MON_DEEP_ATK = 1.015;
export const MON_DEEP_AC  = 1.020;
/* 제 집보다 깊은 곳에서 만난 것. 처음에 1.11로 잡았다가 되돌렸다 —
   15층 풀은 5층치를 끌어 쓰므로 1.11^5 = 1.69가 되어, 층 배율을
   낮춘 것을 여기서 도로 다 물어냈다(세계 성장 29.2배로 거의 그대로).
   표 자체가 이미 7.6 → 107.8(14.2배)로 자란다. 여기 얹는 것은
   얇아야 한다. */
export const MON_OVER     = 1.05;
export const MON_OVER_ATK = 1.04;

function scaleMonster(m, depth) {
  const over = Math.max(0, depth - m.d);
  /* Kept deliberately mild. The bestiary already ramps hard on
     its own — five health on floor 1, a hundred and forty on
     twelve — so a large multiplier on top compounds into a
     cliff around floor 11 where a single monster trades evenly
     with the hero and there are eighteen of them. */
  /* ── 세계도 곱으로 자란다 ────────────────────────────
     예전에는 `1 + depth*0.055` — 층에 대해 **선형**이었다. 그런데
     플레이어 쪽은 (이제) 전부 곱이고, 선형과 곱을 붙여 놓으면 둘의
     차가 층마다 벌어진다. 실측으로 판 전체에서 나는 20.6배 자라는데
     세계는 32배 자랐고, 그래서 **죽이는 데 드는 합이 3.1 → 4.9로
     늘었다** — 득템을 해도 제자리인 이유가 이것이다.

     같은 종류의 수로 바꾼다. 그리고 총량을 낮춘다: 세계가 나보다
     조금 느리게 자라야 「이번에 주운 것」이 값을 한다. */
  const deep = MON_DEEP ** depth;
  /* 심연 rides on top of the depth curve, on the two numbers that
     decide a fight rather than on how many things are in the room.
     More monsters is more turns; harder monsters is a harder game. */
  /* 무거운 것들 is the only shackle that touches these two, and
     it touches them once. Everything else on the ladder changes a
     rule rather than a number. */
  const heavy = hasShackle('weight') ? SHACKLE_STAT : 1;
  /* 열기가 스탯에 거는 자리. 얇다(최대 ×1.25) — 두껍게 걸면 방금 주운
     것이 그 자리에서 상쇄되고, 그건 이 판에서 이미 한 번 고친 병이다.
     열기의 무게는 조우 쪽(각성·정예·파도)에 있다. */
  const hot = heatStat();
  return { ...m,
    hp:  Math.round(m.hp  * MON_OVER ** over * deep * heavy * hot),
    atk: Math.round(m.atk * MON_OVER_ATK ** over * MON_DEEP_ATK ** depth * heavy * hot),
    ac:  Math.round(m.ac  * MON_DEEP_AC ** depth),
    /* 경험치는 제 집보다 깊은 곳에서 만난 만큼 더 준다. 이 줄이
       「깊이 내려간 판이 레벨도 높다」를 만든다 — 그리고 레벨이
       이제 곱이므로, 그 차이가 다음 층에서 복리로 돌아온다. */
    xp:  Math.round(m.xp  * MON_OVER ** over) };
}

/* Elites are the monster side of the affix vocabulary. A
   "재빠른 광폭한 늑대" is a different fight from a wolf, and it is
   worth the risk: roughly double experience and a guaranteed
   affixed drop. Rolled per individual — rolling it per pack
   turned one lucky draw into four identical elites at once. */
/* 열기가 정예를 부른다. 상한도 같이 올린다 — 상한이 굳어 있으면
   열기 80과 열기 20이 깊은 층에서 같은 판이 된다. */
export const eliteChance = depth =>
  Math.min(0.20 * heatElite(), (0.025 + depth * 0.009) * heatElite());

function makeElite(m, depth) {
  const count = depth >= 12 && Math.random() < 0.35 ? 2 : 1;
  const pool = [...ELITES];
  m.elite = [];
  for (let i = 0; i < count && pool.length; i++) {
    const a = pool.splice(rnd(pool.length), 1)[0];
    m.elite.push(a.id);
    m.n = `${a.n} ${m.n}`;
    if (a.spd)    m.spd = (m.spd || 1) + a.spd;
    if (a.hpPct)  m.hp = Math.max(1, Math.round(m.hp * (1 + a.hpPct)));
    if (a.atkPct) m.atk = Math.round(m.atk * (1 + a.atkPct));
    if (a.ac)     m.ac += a.ac;
    if (a.on)     m.on = a.on;
    if (a.drain)  m.drain = a.drain;
  }
  m.xp = Math.round(m.xp * (1.9 + 0.4 * (count - 1)));
  m.heavy = true;                       // elites telegraph and hit for two and a half
  return m;
}

/* Gear the floor is allowed to drop. The band moves down with
   you: floor 10 no longer scatters daggers and soft leather,
   because a drop you would never pick up is not loot, it is
   litter — and litter is what made the floor feel generous
   while giving you nothing. */
const inBand = (pool, depth) => {
  const floor = depth - 5;
  const band = pool.filter(x => x.d <= depth + 2 && x.d >= floor);
  return band.length ? band : pool.filter(x => x.d <= depth + 2);
};

/* 벤치가 굴림을 직접 셀 수 있게 열어 둔다. 표에 적힌 확률과 실제로
   나오는 비율이 갈리는 것이 이 파일에서 가장 조용한 종류의 버그다. */
export const pickItemFor = depth => pickItem(depth);

function pickItem(depth) {
  const r = Math.random();
  /* 3% of what a floor drops is a catalyst, and only ones the
     depth has unlocked. Rolled first so it is never crowded out. */
  if (r < 0.03) {
    const pool = CATALYSTS.filter(c => c.d <= depth);
    if (pool.length) return { kind:'cat', ...pickByRarity(pool) };
  }
  if (r < 0.38) {
    const pool = CONSUMABLES.filter(c => c.d <= depth + 2);
    return { kind:'use', ...pickByRarity(pool) };
  }
  /* A named weapon, at most one of each per run, and never given
     affixes — the name is the affix.

     ── 여기 부등호 하나가 이름 붙은 무기를 흔한 물건으로 만들고 있었다
     `r < 0.71 + UNIQUE_ODDS`였다. 바로 아래에 `r < 0.71`이 또 있으니
     의도는 「0.71과 0.745 **사이**」였을 텐데, 위쪽 경계만 적혀 있어서
     0.38부터 0.745까지 전부 이 가지로 들어왔다 — 낙하의 36.5%다.
     UNIQUE_ODDS는 3.5%로 적혀 있는데 실제로는 열 배였고, 판마다 일곱
     자루가 다 나와 버렸다. 전리품 더미 스크린샷 한 장에 《재를 세는 자》와
     《긴 침묵》이 나란히 뜬 것을 보고 잡았다 — 2층에서.
     아래쪽 경계를 적는다. */
  if (r >= 0.71 && r < 0.71 + UNIQUE_ODDS) {
    const pool = UNIQUES.filter(u => u.d <= depth && !(G.uniques || {})[u.id]);
    if (pool.length) {
      const u = pool[rnd(pool.length)];
      (G.uniques = G.uniques || {})[u.id] = true;
      return { kind:'weapon', unique:u.id, ...u };
    }
  }
  if (r < 0.71) {
    const it = { kind:'weapon', ...pickOne(inBand(WEAPONS, depth)) };
    rollAffixes(it, depth);
    rollOddity(it);
    return it;
  }
  const it = { kind:'armour', ...pickOne(inBand(ARMOURS, depth)) };
  rollAffixes(it, depth);
  rollOddity(it);
  return it;
}

/* A sleeping enchantment. It is stamped on at generation and does
   nothing at all until the item ends up in hands it does not
   suit — so it cannot be farmed by playing correctly, and the
   only way to meet one is to keep something you should have
   dropped. */
function rollOddity(it) {
  if (Math.random() >= ODDITY_ODDS) return;
  it.odd = ODDITIES[rnd(ODDITIES.length)].id;
}

export const hasUnique = id => G.player?.equip?.weapon?.unique === id;

/* ── 크랙 ────────────────────────────────────────────────
   이름 붙은 것 하나마다 규칙을 하나씩 부순다. 여기 모아 두는 이유는
   깔때기 때문이다 — 「이 무기가 지금 몇 면짜리인가」를 묻는 자리가
   피해식·카드·배낭·벤치 넷인데, 넷이 각자 계산하면 언젠가 갈린다. */
export function crackDice(w) {
  if (!w) return [1, 3];
  if (w.unique === 'ashcount')
    return [w.dice[0], w.dice[1] + Math.floor((G.ashCount || 0) / 8)];
  return w.dice;
}
/* ② 크랙 「빗맞지 않는다」 — 대검이 지불하는 값(0.88)을 지운다. */
export const crackAim = () => hasUnique('emberpull') ? 1.14 : 1;
/* ② 크랙 「붙어도 활이다」 — 활이 지불하는 값(근접 배율)을 지운다. */
export const crackBowMelee = () => hasUnique('longhush') ? 1 : BOW_MELEE;
/* ③ 크랙 「천장이 올라간다」가 한 층에서 올릴 수 있는 최대. */
export const PROMISE_CAP = 5;
/* ③ 크랙 「그 자리에 박힌다」 — 몇 번 맞으면 영영 못 움직이는가. */
export const NAILED_AT = 3;
/* ② 크랙 「마르지 않는다」 — 모자란 마나 1당 내는 피. */
export const LAMP_BLOOD = 2.2;

/* 모자란 마나를 피로 낼 수 있는가. 낼 수 있으면 낼 피의 양,
   못 내면 −1(이유는 여기서 말한다). 시전 함수가 이미 복잡도 59라,
   새 규칙을 그 안에 또 얹는 대신 이 자리를 만든다. */
function bloodPrice(p, cost) {
  if (p.mana >= cost) return 0;
  /* ② 크랙 「마르지 않는다」. 지팡이가 지불하는 값은 하나다 — 마나가
     마르면 시전자는 몽둥이를 든 사람이 된다. 이 지팡이는 그 줄을
     지운다: 모자란 만큼을 피로 낸다. 마나가 자원이 아니라 **다른
     통화**가 되고, 시전자는 마르는 대신 죽어 간다. */
  if (!hasUnique('lastlamp')) { say('마나가 모자란다.', 'warn'); return -1; }
  const bled = Math.max(1, Math.round((cost - p.mana) * LAMP_BLOOD));
  if (p.hp <= bled) { say('여기서 더 내면 남는 것이 없다.', 'warn'); return -1; }
  return bled;
}
/* ③ 크랙 「천장을 넘겨서」 — 한 층에서 부풀릴 수 있는 최대. */
export const FAMINE_SWELL = 40;

/* 처치할 때 먹는 것. 굶주림 계열 둘이 여기 모인다 — 한 자리에 있어야
   「가득 찬 몸에 무슨 일이 일어나는가」가 한 번만 정해진다. */
function feedOnKill(p) {
  const famine = hasRelic('famine');
  if (!famine && !hasRelic('hunger')) return;
  if (!famine && p.hp >= p.maxhp) return;
  const base = famine ? relicVal('famine') : relicVal('hunger');
  /* 굶주린 무리는 연격만큼 곱한다 — 셋을 연달아 재우면 세 배다. */
  const meal = base * (hasResonance('pack') ? Math.max(1, G.combo || 1) : 1);
  const over = Math.max(0, (p.hp + meal) - p.maxhp);
  p.hp = Math.min(p.maxhp, p.hp + meal);
  /* ③ 크랙 「천장을 넘겨서」. 이 게임의 체력은 천장에서 멈춘다 — 그
     규칙이 회복의 값과 물약의 값과 모닥불의 값을 한꺼번에 정한다.
     끝없는 허기는 그 줄을 부순다: 가득 찬 몸에도 먹은 것이 쌓인다.
     대신 그 몫은 **한 층만 간다**(enterDepth에서 되돌린다) — 안
     되돌리면 그건 크랙이 아니라 무한 성장이다. */
  const add = famine ? Math.min(FAMINE_SWELL - (G.famineSwell || 0), over) : 0;
  if (add > 0) {
    G.famineSwell = (G.famineSwell || 0) + add;
    recalc(p);                 // 천장은 파생값이다 — 장부를 올리고 다시 센다
    p.hp = Math.min(p.maxhp, p.hp + add);
  }
  fx({ t:'drain', x:p.x, y:p.y, amt: meal });
}
/* Awake oddities on the whole kit, for the rules to ask about. */
export const oddAwake = id =>
  GEAR_SLOTS.some(k => oddityOf(G.player, G.player?.equip?.[k])?.id === id);

const pickOne = pool => pool[rnd(pool.length)];

function pickByRarity(pool) {
  const total = pool.reduce((s, c) => s + (c.rar || 1), 0);
  let n = rnd(total);
  for (const c of pool) { if (n < (c.rar || 1)) return c; n -= (c.rar || 1); }
  return pool[0];
}

/* Affixes on found gear. The odds climb with depth, so an early
   named weapon is a genuine event and a late one is expected. */
export function rollAffixes(item, depth, guaranteed) {
  /* 굶주린 판 — 주울 것이 절반이 되는 값으로, 떨어지는 것마다 속성이
     하나씩 더 붙는다. 「주울 것이 적은 판은 가난한 판이 아니라
     **고를 것이 적은 판**이다」가 이 한 줄로 참이 된다. */
  if (hasArcana('famine')) guaranteed = true;
  if (item.kind !== 'weapon' && item.kind !== 'armour') return item;
  const tag = item.kind;
  /* 매력 is the stat the dungeon likes you for. It moves the odds
     that a drop carries anything at all — never enough to carry a
     build, always enough that dumping it is a decision. */
  const luck = G.player ? statB(G.player, 'chr') * 0.02 : 0;
  /* Measured: the median run reached its end holding *one* affix
     across all three slots. Every combinatorial system this game
     has — synergies, engravings, resonance — needs two specific
     things in hand at once, and at one affix a run that is a
     lottery ticket is a run that never gets a ticket. The first
     resonance lit in 1 run out of 76.

     So the pieces circulate more. Raw power is not what goes up
     — worthOf already prices an affix into what a thing sells and
     salvages for, so the economy takes its own correction. */
  /* 0.11 + 층×0.033이었다. 이유는 맞았지만(한 판에 접사 하나로는
     조합이 성립하지 않는다) 재 보니 주운 장비의 53%에 접두나 접미가
     붙어 있었다 — 절반이 희귀하면 희귀한 것이 없는 것이다.
     기울기를 절반으로 낮춘다. 깊은 층에서 붙는다는 성질은 남기고,
     얕은 층의 바닥값을 내렸다. */
  /* ── 그리고 한 번 더 좁혔다 ──────────────────────────────
     플레이어: 「최정상급 아이템 드롭 확률은 확 줄이되, 획득 시
     확실하게 체감 가능하게 (성능 + 외관 모두)」.

     0.05 + 층×0.019 는 15층에서 33%다 — 셋에 하나가 속성을 달고
     나온다. 그러면 「붙었다」가 사건이 아니라 기본값이고, 아래에서
     둘 다 붙은 물건에 얹어 둔 벼림도 덩달아 흔해진다. 바닥과
     기울기를 함께 내려 15층 20%로 만든다. */
  const odds = clamp(0.035 + depth * 0.011 + luck, 0.02, 0.30);
  if (guaranteed || Math.random() < odds) {
    const a = pickAffix(PREFIXES, tag, false);
    if (a) item.pre = a.id;
  }
  if ((guaranteed && Math.random() < 0.5) || Math.random() < odds * 0.6) {
    const a = pickAffix(SUFFIXES, tag, false);
    if (a) item.suf = a.id;
  }
  /* ── 더 드물게, 대신 훨씬 세게 ────────────────────────────
     플레이어: 「득템을 조금 더 어렵지만 훨씬 도파민 있게」.

     실측으로 바닥에 떨어지는 장비는 **평균 +0.03, 각인 0.00**이었다 —
     주운 것은 언제나 맨 물건이고, 「이번에 뭐가 나왔지?」의 답이 판
     내내 「아무것도」였다. 강화는 전부 내가 모루에서 만든 것이고,
     그러면 드롭은 재료 공급처지 사건이 아니다.

     그래서 **둘 다 붙은 물건**에만 벼려진 채로 나올 기회를 준다.
     조건을 그렇게 잡은 이유: 흔한 것에 +를 뿌리면 그냥 인플레이고,
     이미 드문 것에 얹으면 그 하나가 사건이 된다. 깊이가 크기를 정한다.
     그리고 아주 드물게 각인까지 — 판에 한 번 볼까 말까다. */
  if (item.pre && item.suf) {
    /* 둘 다 붙은 물건은 이제 판에 두어 번이다. 그러니 나올 때는
       **확실히 크게** 나와야 한다 — 드물게 만든 값을 여기서 돌려
       받지 못하면 그건 그냥 하향이다. +1~3 이던 것을 +3~7 로. */
    item.plus = Math.max(item.plus || 0, 3 + rnd(3 + Math.floor(depth / 3)));
    if (Math.random() < 0.34 && depth >= 6) {
      const pool = ENGRAVINGS.filter(e => e.tags.includes(tag));
      if (pool.length) item.engrave = [pool[rnd(pool.length)].id];
    }
  }
  /* 초월. Rolled here and nowhere else, so it can only ever be
     the luck of the drop — no camp, no altar, no shop can put
     one in your hands. */
  if (Math.random() < transChance(depth)) {
    item.boon = BOONS[rnd(BOONS.length)].id;
    /* ── 확실하게 체감 가능하게 ──────────────────────────────
       예전에는 +1~3 과 접두 하나였다. 그래서 초월을 주웠는데도
       배낭에서 「+2 날카로운 단검」으로 보였고, 초월인 것은 작은
       글자 한 줄뿐이었다 — 이 게임에서 가장 드문 낙하가 가장
       조용했다. 드물게 만든 값을 여기서 돌려준다.

       나오면 셋 다 있다: 접두·접미가 모두 붙고, 벼려져 있고,
       각인이 하나 돋아 있다. 이름 줄이 길어지는 것 자체가 신호다 —
       배낭에서 한 줄만 봐도 다른 물건이라는 것을 안다. */
    item.plus = Math.max(item.plus || 0, 5 + rnd(4));
    if (!item.pre) item.pre = pickAffix(PREFIXES, tag, false)?.id;
    if (!item.suf) item.suf = pickAffix(SUFFIXES, tag, false)?.id;
    if (!item.engrave?.length) {
      const pool = ENGRAVINGS.filter(e => e.tags.includes(tag));
      if (pool.length) item.engrave = [pool[rnd(pool.length)].id];
    }
  }
  return item;
}

/* Does the player currently benefit from a 은총? Weapons and
   armour both count — the boon is a property of the thing, and
   the thing is either worn or it is not. */
export const hasBoon = id => {
  const p = G.player;
  if (!p) return false;
  for (const slot of GEAR_SLOTS)
    if (p.equip[slot]?.boon === id) return true;
  return false;
};

export function pickAffix(table, tag, allowCurse) {
  const pool = table.filter(a => a.tags.includes(tag) && (allowCurse || !a.curse));
  return pool.length ? pool[rnd(pool.length)] : null;
}

/* Light shrinks, it does not switch off. A cliff at zero taught
   the player nothing until it was too late; a radius that closes
   in over the last few hundred turns is a warning you can act on
   — and on a 빛이 없는 층 it is the whole fight. */
/* 기름은 무한정 쌓이지 않는다. 상한이 없으면 보급이 소모를 앞지르고,
   그러면 시계가 멈춘다. 사그라진 잉걸은 그 통을 더 작게 만든다. */
export const OIL_CAP = 1100;
export const oilCap = () => OIL_CAP - (hasRelic('nighteye') ? 300 : 0);

/* 한 턴에 태우는 기름. 6층까지는 1, 그 아래로 한 단씩. */
export const OIL_BURN = depth => depth >= 11 ? 3 : depth >= 6 ? 2 : 1;

/* 세 계단이 아니라 여섯 계단. 예전 표는 기름이 300 남을 때까지
   계속 7칸이었고, 그 300은 한 층을 통째로 덮는 양이라 플레이어는
   마지막 순간까지 아무것도 느끼지 못했다. 판의 90%를 가장 밝은
   반경에서 보낸 이유가 그것이다 (sim/oil.mjs). 좁혀 오는 것이
   보여야 경로를 바꿀 마음이 생긴다. */
/* 불이 꺼졌을 때 놈들이 너를 보는 거리. 네 반경 2보다 넉넉하다 —
   여기 사는 것들은 여기서 살고, 눈이 먼 쪽은 너다. */
export const DARK_SIGHT = 7;
/* 눈을 뗀 한 턴에 이것이 좁히는 칸 수. 둘이면 「걸어서 도망칠 수
   있다」가 거짓이 되고, 셋이면 방을 가로지르므로 도망 자체가 없어진다. */
export const UNSEEN_STEP = 2;

/* 무언가를 밀어내는 일. 밀쳐내기와 그림자 되감기가 같은 규칙을 쓴다 —
   둘이 따로 밀면 「벽에 처박힌다」가 한쪽에서만 참이 된다. */
function shoveBack(m, dx, dy, dist) {
  let moved = 0;
  for (let i = 0; i < dist; i++) {
    const nx = m.x + dx, ny = m.y + dy;
    if (G.level.solid(nx, ny) || monsterAt(nx, ny)) break;
    m.x = nx; m.y = ny; moved++;
  }
  return moved;
}
/* 그리고 어둠 속의 손. 0.78이었는데, 어둠이 은신이던 시절에는 그것이
   유일한 벌이었다. 이제 어둠은 그 자체로 위험하므로 손은 조금 더
   무뎌져도 된다 — 「불을 켤까」가 매번 계산이 되어야 한다. */
export const DARK_AIM = 0.70;

export const lightRadiusOf = p => {
  /* 갱구도 밝지 않다. 여기는 재에 덮인 빈 땅이고 해는 오래전에
     졌다 — 12칸은 낮의 광장이었다. 아래보다는 넉넉하되(수레를
     찾아 헤매게 만들 이유는 없다) 전부 보이지는 않는다. */
  if (G.depth === 0) return 7;
  const t = p.lightTurns;
  /* ── 꺼진 뒤에도 형체는 보인다 ────────────────────────
     불이 꺼졌을 때 반경이 2였다. 그러면 「보이는데 예고가 없는」 띠가
     정확히 d==2 한 칸뿐이고, 실측으로 어둠이 무는 값은 관측의 6%에
     그쳤다(230 어둠 턴 · 131 관측 중 8건). 나머지 92%는 붙어 있어서
     어차피 예고가 보인다 — 즉 「어둠이 예고를 가린다」는 규칙이
     화면에서 거의 발동하지 않았다.

     원인은 **두 반경이 겹쳐 있던 것**이다. 「안 보인다」와 「예고가
     없다」가 같은 원에서 시작하니 뒤쪽이 앞쪽에 먹혔다. 갈라 놓는다:
     꺼져도 형체는 4칸까지 보이고, 무엇을 준비하는지는 안 보인다.
     어둠이 「걷지 못하는 것」에서 「읽지 못하는 것」이 된다. */
  return t < 180 ? 4 : t < 360 ? 5 : t < 640 ? 6 : 7;
};

export function refreshFov() {
  const p = G.player;
  let radius = lightRadiusOf(p);
  radius += gearBonus(p).lightR;
  if (p.race === 'elf') radius += 1;          // "눈이 밝다"
  /* 전설. 기름이 바닥나도 다섯 칸은 남는다 — 이 판에서 가장 센
     효과이고, 그래서 전설급으로 잠가 둔다. */
  if (hasRelic('everflame')) radius = Math.max(radius, 5);
  if (has(p, 'blind')) radius = 1;
  computeFov(G.level, p.x, p.y, radius);
  G.lightRadius = radius;
}

/* ── 앞서 간 사람 ──────────────────────────────────────────
   이 게임의 이야기는 「아무도 돌아오지 못했다」이고, 지금까지 그 말은
   문장으로만 있었다. 지역 문장이 말하고 사건 하나가 흉내 냈지만,
   거기 누워 있는 것은 아무도 아니었다 — 생성기가 만든 익명의 시체다.

   이제 진짜다. 지난 판에서 **당신이** 죽은 층, 그 층에 당신이 놓인다.
   들고 있던 무기와 유물 하나를 그대로 쥔 채로.

   세 가지가 한꺼번에 붙는다:
     · 이야기 — 「다음 사람이 내려간다」가 규칙이 된다
     · 보상 — 잘 벼려 놓은 무기를 되찾을 수 있다. 죽음이 완전한
       손실이 아니게 되고, 그러면 죽고 나서 한 판 더 누를 이유가
       하나 생긴다
     · 위험 — 그것을 일으켜 세울 수도 있다. 재를 먹은 것은 살아 있던
       때보다 세다

   완주한 판은 안 남는다 — 걸어 나간 사람은 아래에 없다. */
function placeFallen(L, depth) {
  if (depth < 1) return;
  const rec = (Meta.read().fallen || []).find(f => f.depth === depth);
  if (!rec || (G.fallenSeen || {})[rec.sent]) return;
  for (let t = 0; t < 80; t++) {
    const r = L.rooms[rnd(L.rooms.length)];
    if (!r) return;
    const x = r.x + rnd(r.w), y = r.y + rnd(r.h);
    const i = idx(x, y);
    if (L.tiles[i] !== FLOOR || L.traps.has(i)) continue;
    if (G.items.some(o => o.x === x && o.y === y)) continue;
    G.items.push({ kind:'fallen', spr:'bones', n:'앞서 간 자', rec, x, y, rar:2 });
    (G.fallenSeen = G.fallenSeen || {})[rec.sent] = true;
    say(`${rec.sent}번째가 이 층에서 멈췄다. 어딘가에 있다.`, 'warn');
    return;
  }
}

/* 무엇을 고를 수 있는가. 화면은 이걸 읽고, 규칙도 이걸 읽는다. */
export function fallenOffer(rec) {
  const wep = rec.weapon ? affixName(rec.weapon) : null;
  const opts = [];
  if (wep) opts.push({ id:'take', n:`${wep}을(를) 거둔다`,
    t:'그가 마지막까지 쥐고 있던 것이다. 손에 익은 무게일 것이다.' });
  if (rec.gold) opts.push({ id:'purse', n:`주머니 (${rec.gold}닢)`,
    t:'여기까지 벌어 온 것이다. 쓸 사람이 없어졌다.' });
  if (rec.relic) opts.push({ id:'relic', n:`${relicById(rec.relic)?.n || '유물'}`,
    t:'목에 걸려 있다. 그를 여기까지 데려온 것일 수도, 여기서 멈추게 한 것일 수도.' });
  /* 그리고 도박. 재를 먹은 것은 살아 있던 때보다 세다 — 대신
     남은 것을 **전부** 준다. 셋 중 하나가 아니라 전부다. */
  opts.push({ id:'raise', n:'일으켜 세운다',
    t:'재를 털면 일어난다. 살아 있던 때보다 셀 것이다. 쓰러뜨리면 남긴 것을 전부 가져간다.' });
  opts.push({ id:'leave', n:'그대로 둔다', t:'눈을 감겨 주고 지나간다.' });
  return { n:`${rec.sent}번째`, rec,
    t: `${RACES[rec.race]?.name || ''} ${CLASSES[rec.cls]?.name || ''} · Lv ${rec.lv}. `
     + `${rec.by ? `${rec.by}에게 여기서 멈췄다.` : '여기서 멈췄다.'} `
     + '당신보다 앞서 내려간 사람이다.',
    opts };
}

export function fallenTake(id) {
  const p = G.player, sp = G.fallen;
  if (!sp) { G.screen = 'play'; return; }
  const rec = sp.rec;
  const drop = () => {
    const i = G.items.findIndex(o => o.kind === 'fallen' && o.x === p.x && o.y === p.y);
    if (i >= 0) G.items.splice(i, 1);
  };
  G.fallen = null;
  G.screen = 'play';
  G.act = 'open';
  if (id === 'leave') { drop(); say('눈을 감겨 주고 지나갔다.'); endTurn(); return; }

  if (id === 'raise') {
    drop();
    /* 살아 있던 때보다 세다. 층이 아니라 **그 사람의 레벨**로 세우므로,
       깊이 갔던 판일수록 무섭다 — 잘 풀린 판의 시체가 가장 위험하다. */
    const base = MONSTERS.filter(m => m.d <= G.depth + 3).slice(-1)[0] || MONSTERS[0];
    const m = { ...base, spr:'wraith', n:`${rec.sent}번째였던 것`,
      hp: 40 + rec.lv * 14, maxhp: 40 + rec.lv * 14,
      atk: 10 + rec.lv * 2, ac: 6 + rec.lv, xp: 120 + rec.lv * 40,
      ai:'hunt', named:true, awake:true, provoked:true, energy:0,
      x: p.x, y: p.y, drops: rec };
    const spot = freeSpotNear(p.x, p.y);
    if (spot) { m.x = spot.x; m.y = spot.y; }
    G.monsters.push(m);
    say(`${rec.sent}번째가 일어섰다. 재가 흘러내린다.`, 'bad');
    fx({ t:'ail', x:m.x, y:m.y, kind:'fear' });
    endTurn();
    return;
  }

  if (id === 'take' && rec.weapon) {
    const it = { ...rec.weapon };
    if (packRoom(p, it)) { addItem(p, it); say(`${affixName(it)}을(를) 거뒀다.`, 'level'); }
    else { G.items.push({ ...it, x:p.x, y:p.y }); say('배낭이 차서 발밑에 두었다.', 'warn'); }
    fx({ t:'found', x:p.x, y:p.y, rar: rarityOf(it) });
  } else if (id === 'purse') {
    /* 깔때기(goldGain)를 우회해 원금을 그대로 넣고 있었다 — 족쇄
       배수도, 뱃사공 ×2도, 깃펜 ×0.75도, 탐욕 ×2도 안 걸렸다.
       같은 파일의 다른 여섯 자리는 전부 깔때기를 지난다. */
    const got = goldGain(rec.gold);
    p.gold += got;
    say(`${got}닢을 거뒀다.`, 'good');
    fx({ t:'found', x:p.x, y:p.y, rar:1 });
  } else if (id === 'relic' && rec.relic) {
    if (!takeRelic(rec.relic) && G.screen !== 'relic') { say('가져갈 자리가 없다.', 'warn'); }
  }
  /* 하나만 가져간다. 나머지는 그와 함께 남는다 — 전부 가져가려면
     일으켜 세워야 하고, 그게 이 자리의 결정이다. */
  drop();
  endTurn();
}

/* ── movement and turns ─────────────────────────────────── */
export const monsterAt = (x, y) => G.monsters.find(m => m.x === x && m.y === y);
export const itemAt = (x, y) => G.items.find(i => i.x === x && i.y === y);

export function step(dx, dy) {
  /* 제자리 대기를 걷기로 세면, 「버티는 판」이 「걸어 다니는 판」으로
     읽힌다 — 소란을 재다가 실제로 그렇게 헛짚었다. */
  if (!dx && !dy) G.act = 'wait';
  if (!G.running) return;
  const p = G.player, L = G.level;
  /* 버텨선다의 대가. 이 한 줄이 없으면 「받는 피해 절반 + 인접한 것
     묶음」이 대가 없는 순증이 되고, 그건 예전 버티기가 빠진 함정이다
     (봇이 판당 10.2번 눌렀다). 치는 것은 되고 **가는 것만** 안 된다. */
  if ((p.brace || 0) > 0 && (dx || dy) && !monsterAt(p.x + dx, p.y + dy)) {
    say('발을 박아 두었다. 이 자리에서는 못 움직인다.', 'warn');
    return;
  }
  /* 멎은 판 — 걷는 데 두 턴이 든다. 공격은 그대로 매 턴이라,
     「걸어서 붙는다」가 두 배로 비싸지고 「서서 친다」는 안 변한다.
     같이 느려지면 아무것도 안 달라진다고들 하는데, 해 보면 다르다. */
  if (stillHalf() && (dx || dy) && !monsterAt(p.x + dx, p.y + dy)) {
    G.stillStep = !G.stillStep;
    if (G.stillStep) { say('발이 무겁다.', 'warn'); endTurn(); return; }
  }

  // Paralysis eats the turn outright — that is what makes a lich
  // frightening rather than merely damaging.
  if (has(p, 'paralyze')) {
    say('몸이 굳어 말을 듣지 않는다.', 'warn');
    fx({ t:'struggle', x:p.x, y:p.y });
    endTurn(); return;
  }

  if (p.stuck > 0) {
    const pull = statB(p, 'str') + roll(1, 6);
    if (pull >= 5) { p.stuck = 0; say('거미줄을 뜯어냈다.', 'good'); }
    else { p.stuck--; say('거미줄이 발을 붙잡는다.', 'warn'); fx({ t:'struggle', x:p.x, y:p.y }); }
    endTurn(); return;
  }

  if (dx === 0 && dy === 0) { endTurn(); return; }

  const nx = p.x + dx, ny = p.y + dy;
  if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return;
  const ni = idx(nx, ny);
  if (L.tiles[ni] === undefined) return;

  /* A body comes before a counter. The shop check used to sit
     above this, so anything standing on a merchant's tile could
     not be attacked at all — walking into it opened the shop,
     spent no turn, and left the thing there. Harmless in town,
     where nothing hostile walks; the travelling merchant put the
     same tile in the dungeon, where things do. */
  const onCounter = monsterAt(nx, ny);
  const shopId = L.shopAt.get(ni);
  if (shopId && !(onCounter && !onCounter.disguise)) {
    /* 수레 앞도 나머지 넷과 같은 규칙을 따른다. 여기만 옛 동작이
       남아 있었다 — 발이 닿는 순간 화면이 튀어나오고, 턴은 안 쓰고,
       심지어 그 칸에 서지도 못했다. 지나가려던 사람이 장을 보게
       되고, 화면은 엄지 밑에서 열린다. 넷을 고칠 때 여기를 빠뜨린
       것이지 상점이 특별한 것이 아니었다. */
    p.x = nx; p.y = ny;
    refreshFov();
    say(`${SHOPS.find(s => s.id === shopId)?.n || '수레'} 앞에 섰다.`, 'good');
    endTurn();
    return;
  }

  /* The four tiles that offer something used to throw their whole
     screen up the instant a foot landed on them. Walking is held
     input in this game — a d-pad press that repeats, a tapped
     path that runs — so the sheet arrived *under the thumb* and
     the next repeat pressed a button on it. A choice you make by
     accident is not a choice.
     Now the foot lands, the turn is spent like any other step,
     and the offer waits. `hereOffer()` tells the row what is
     underfoot; `openHere()` is the deliberate press. Exactly the
     shape 문 닫기 already has. */
  const t = L.tiles[ni];
  if (t === CAMP || t === ALTAR || t === EVENT || t === ANVIL) {
    p.x = nx; p.y = ny;
    refreshFov();
    say(`${OFFER_NAME[t]} 위에 섰다.`, 'good');
    endTurn();
    return;
  }
  if (t === PROP) { if (bumpProp(nx, ny)) endTurn(); return; }
  if (t === DOOR)        { openDoor(nx, ny); endTurn(); return; }
  if (t === DOOR_LOCKED) { forceDoor(nx, ny); endTurn(); return; }
  if (L.solid(nx, ny)) return;

  const m = monsterAt(nx, ny);
  if (m) { playerAttack(m); endTurn(); return; }

  /* 창류 reaches past the tile in front of you. Stepping into an
     empty square that has something behind it becomes a thrust
     rather than a move — which is how a spear fights a thing
     that is winding up. */
  if (weaponReach(p) > 1) {
    const far = monsterAt(nx + dx, ny + dy);
    if (far && !far.disguise && !L.solid(nx, ny)) {
      fx({ t:'lunge', who:'player', x:p.x, y:p.y, dx, dy, kind:'spear' });
      playerAttack(far);
      endTurn();
      return;
    }
  }

  /* ── 등을 보이는 값 ────────────────────────────────────
     긴장을 재 보면 체력 30% 아래에서 보낸 턴이 **0%**다. 물약을 한
     병도 안 산 봇에서도 0%였으니 공급 문제가 아니다 — 봇은 언제나
     **빠져나갈 수 있었다.** 붙어 있는 것에서 한 걸음 물러나는 데
     아무 값도 안 들었고, 그러면 위험한 구간은 지나가는 곳이 아니라
     건너뛰는 곳이 된다. 죽음은 그래서 30% 위에서 한 번에 온다.

     이제 붙어 있던 것에서 **멀어지는** 걸음은 그것에게 한 걸음을
     내준다. 때리는 것이 아니라 따라붙는 것이다 — 걸어서 떨어뜨릴 수
     없게 될 뿐, 맞고 시작하지는 않는다. 그러면 이탈에 값이 생긴다:
     싸우거나, 구르거나, 문을 닫거나, 연막을 쓰거나.

     구르기는 면제다(iframe). 이 게임에서 구르기가 사는 자리가 바로
     여기이고, 지금까지 그것은 「가끔 쓰는 회피」였지 이탈 수단이
     아니었다. 예고를 당긴 것도 면제한다 — 그건 이미 한 턴을 버린
     것이고, 물러서라고 만든 예고에 벌을 붙이면 예고가 함정이 된다. */
  const wasX = p.x, wasY = p.y;
  const clung = (p.iframe > 0 || G.noCling) ? [] : G.monsters.filter(m =>
    m.awake && !m.disguise && !m.wind && m.ai !== 'unseen'
    && Math.max(Math.abs(m.x - wasX), Math.abs(m.y - wasY)) <= 1
    && Math.max(Math.abs(m.x - nx), Math.abs(m.y - ny)) > 1);

  p.x = nx; p.y = ny;
  if (enterTile(nx, ny)) { endTurn(true); return; }   // trap moved us elsewhere
  pickUp();
  for (const m of clung) {
    if (Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 1) continue;
    const before = `${m.x},${m.y}`;
    advance(m, Math.sign(p.x - m.x), Math.sign(p.y - m.y));
    if (`${m.x},${m.y}` === before) continue;
    G.clung = (G.clung || 0) + 1;
    /* 층마다 한 번만 말한다. 매번 말하면 로그가 이 한 줄로 덮이고,
       그러면 정작 읽어야 할 줄들이 밀려 나간다. */
    if (!G.clungSaid) {
      G.clungSaid = 1;
      say('물러선 만큼 따라붙는다. 걸어서 떨어뜨릴 수 있는 것이 아니다.', 'warn');
    }
  }
  endTurn();
}

/* ── doors ────────────────────────────────────────────────
   A shut door is a wall you chose not to open yet, and the
   only reliable way to break line of sight from an archer. */
function openDoor(x, y) {
  G.level.tiles[idx(x, y)] = DOOR_OPEN;
  say('문을 열었다.');
  fx({ t:'door', x, y, state:'open' });
  rouse(x, y, 5, 0.35);
}

function forceDoor(x, y) {
  const p = G.player, L = G.level;
  if (p.keys > 0) {
    p.keys--;
    L.tiles[idx(x, y)] = DOOR_OPEN;
    say(`열쇠로 잠긴 문을 열었다. (남은 열쇠 ${p.keys})`, 'good');
    fx({ t:'door', x, y, state:'open' });
    return;
  }
  /* Picks first: the quiet answer, and the one a rogue is for.
     They are finite, so they are a decision rather than a
     replacement for the key. */
  const picks = p.pack.find(s => s.item.id === 'picks');
  if (picks) {
    const skill = clamp(0.34 + statB(p, 'dex') * 0.07 + lockBonus(p) + p.lv * 0.006, 0.15, 0.95);
    if (Math.random() < skill) {
      L.tiles[idx(x, y)] = DOOR_OPEN;
      say('자물쇠가 소리 없이 열렸다.', 'good');
      fx({ t:'door', x, y, state:'open' });
      wearPicks();
      return;
    }
    say('갈고리가 미끄러졌다.', 'warn');
    fx({ t:'door', x, y, state:'stuck' });
    wearPicks();
    rouse(x, y, 3, 0.2);           // a pick that slips is still quiet
    return;
  }

  /* The shoulder. It always works eventually — but eventually is
     now paid for in breath, and then in blood, and the racket
     grows with every try. */
  const key = idx(x, y);
  G.forced = G.forced || {};
  const tries = (G.forced[key] = (G.forced[key] || 0) + 1);
  const chance = clamp(0.14 + statB(p, 'str') * 0.09 + p.lv * 0.006
                     + tries * 0.05, 0.04, 0.85);
  if (p.stam >= FORCE_STAM) p.stam -= FORCE_STAM;
  else {
    const hurt = hurtPlayer(FORCE_HURT + Math.floor(G.depth / 2), { combo:false, by:'잠긴 문' });
    say(`어깨로 밀어붙였다. 숨이 없어 몸이 대신 받는다. (−${hurt})`, 'hit');
    fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg:hurt, who:'잠긴 문', severe:false });
    if (!G.running) return;
  }

  if (Math.random() < chance) {
    L.tiles[idx(x, y)] = DOOR_BROKEN;
    delete G.forced[key];
    say('문이 부서져 나갔다.', 'good');
    fx({ t:'door', x, y, state:'broken' });
    rouse(x, y, 11, 0.9);          // splinters carry
  } else {
    /* 「번째」를 회수한다. 이 게임에서 가장 무거운 명사가 문 두드린
       횟수에 쓰이고 있었다 — 「23번째」가 사람이려면 「3번째」가 문
       두드림이면 안 된다. */
    say('문이 꿈쩍도 하지 않는다. 소리만 크게 났다. (또 한 번)', 'warn');
    fx({ t:'door', x, y, state:'stuck' });
    // Each shove is heard further than the last.
    rouse(x, y, FORCE_NOISE + tries * 2, Math.min(0.9, 0.45 + tries * 0.12));
  }
}

/* How much better this pair of hands is at a lock. One funnel so
   the door, the chest and any future lock agree about who is good
   at this — and so a class passive is written once. */
export function lockBonus(p) {
  return (p?.cls === 'rogue' ? 0.30 : 0)
       + (p?.race === 'gnome' ? 0.08 : 0);
}

function wearPicks() {
  const p = G.player;
  const i = p.pack.findIndex(s => s.item.id === 'picks');
  if (i < 0) return;
  removeItem(p, i, 1);
  const left = p.pack.find(s => s.item.id === 'picks')?.qty || 0;
  if (!left) say('갈고리가 부러졌다. 마지막 하나였다.', 'warn');
}

/* What is under the hero's feet that is worth a press, if
   anything. One reader, so the button, the prompt and the key
   binding can never disagree about whether there is an offer. */
export const OFFER_NAME = { [CAMP]:'모닥불', [ALTAR]:'제단', [EVENT]:'수상한 자리', [ANVIL]:'모루' };
const OFFER_SCREEN = { [CAMP]:'camp', [ALTAR]:'altar', [EVENT]:'event', [ANVIL]:'anvil' };

/* 발밑이 계단인가. 화면이 「내려가기」와 「올라가기」를 각각 한 칸씩
   차지하고 늘 띄우고 있었는데, 재 보니 각각 0.1%의 턴에만 살아 있고
   둘이 동시에 사는 일은 없다 — 한 칸에 두 계단은 없으므로 당연하다.
   판정을 규칙 쪽에 두어야 화면이 타일 상수를 알 필요가 없다. */
/* 계단이 잠겨 있는가. **한 곳에서만** 판정한다 — stairHere와 descend가
   각자 보면 언젠가 갈리고, 그러면 버튼은 뜨는데 안 눌리는 화면이 된다.

   그리고 인내심. 과업이 끝나지 않아도 TASK_PATIENCE턴이 지나면 열린다.
   잠긴 계단은 판을 가둘 수 있고, 방금 라이브락 12%를 걷어낸 참이다 —
   「이 층은 나를 붙잡아 두려 했지만 실패했다」가 「이 판은 여기서
   끝났다」보다 언제나 낫다. */
export function stairsLocked() {
  if (!G.task || G.taskDone) return null;
  if ((G.floorTurn || 0) >= TASK_PATIENCE) return null;
  return G.task;
}

/* 삭아 가는 정도를 한 마디로. 버튼과 로그가 같은 단계를 쓰도록
   여기 한 곳에서만 고른다 — 둘이 각자 계산하면 언젠가 갈리고,
   그러면 버튼은 「곧 뜯긴다」인데 로그는 「꿈쩍도 않는다」가 된다. */
export function lockStage() {
  const shut = stairsLocked();
  if (!shut) return -1;
  const left = Math.max(0, TASK_PATIENCE - (G.floorTurn || 0));
  return left > 100 ? 0 : left > 40 ? 1 : 2;
}
export function lockHint() {
  return ['꿈쩍도 않는다', '녹이 번졌다', '곧 뜯긴다'][lockStage()] || '';
}

export function stairHere() {
  const p = G.player, L = G.level;
  if (!p || !L || !G.running) return null;
  const t = L.tiles[idx(p.x, p.y)];
  // 올라가는 계단은 더 이상 어디에도 없다. 남은 것은 내려가는 것뿐.
  return t === DOWN ? 'down' : null;
}

export function hereOffer() {
  const p = G.player, L = G.level;
  if (!p || !L || !G.running) return null;
  const here = idx(p.x, p.y);
  /* 수레는 타일이 아니라 자리로 표시된다 — 야영지에는 문이 없고,
     흥정하는 칸은 좌판 앞의 땅바닥이다. 그래서 타일 표에서 찾지
     않고 따로 묻는다. */
  const shopId = L.shopAt.get(here);
  if (shopId) {
    const shop = SHOPS.find(s => s.id === shopId);
    if (shop) return { screen:'shop', n: shop.n, shop };
  }
  /* 전리품 더미도 발밑의 것이다. 타일이 아니라 바닥에 놓인 물건이라
     따로 묻는다 — 수레와 같은 이유다. */
  const pile = G.items.find(o => o.kind === 'spoils' && o.x === p.x && o.y === p.y);
  if (pile) return { screen:'event', n:'전리품 더미', spoils: pile };
  const body = G.items.find(o => o.kind === 'fallen' && o.x === p.x && o.y === p.y);
  if (body) return { screen:'event', n:`${body.rec.sent}번째`, fallen: body.rec };
  const t = L.tiles[here];
  if (t === EVENT && !L.eventAt?.has(here)) return null;         // already taken
  const screen = OFFER_SCREEN[t];
  return screen ? { screen, n: OFFER_NAME[t] } : null;
}

/* The deliberate press. Nothing else opens these. */
export function openHere() {
  const o = hereOffer();
  if (!o) return false;
  G.act = 'open';
  if (o.shop) G.shop = o.shop;
  if (o.spoils) G.spoils = { picks: o.spoils.picks };
  if (o.fallen) G.fallen = fallenOffer(o.fallen);
  G.screen = o.screen;
  return true;
}

export function doorToClose() {
  const p = G.player, L = G.level;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    if (L.tiles[idx(x, y)] !== DOOR_OPEN) continue;
    if (monsterAt(x, y) || itemAt(x, y)) continue;   // can't shut it on something
    return { x, y };
  }
  return null;
}

export function closeDoor() {
  const d = doorToClose();
  if (!d) { say('닫을 문이 곁에 없다.'); return; }
  G.level.tiles[idx(d.x, d.y)] = DOOR;
  say('문을 닫았다.', 'good');
  fx({ t:'door', x:d.x, y:d.y, state:'shut' });
  endTurn();
}

/* Noise wakes things. Volume 0..1 scales the chance so that
   shouldering a stuck door is quieter than smashing one. */
function rouse(x, y, radius, volume) {
  /* ③ 침묵의 서약의 크랙. 이 게임에서 소리는 정보이자 무기다 —
     문을 부수고, 외치고, 미끼를 놓는다. 서약이 깨지면 그 통로가
     통째로 닫힌다: 잠든 것은 **보아야만** 깨어난다. 대신 미끼도
     못 놓는다 — 규칙을 부수는 크랙은 양쪽을 부순다. */
  if (cracked('vow')) return 0;
  let woke = 0;
  for (const m of G.monsters) {
    const d = Math.hypot(m.x - x, m.y - y);
    if (d > radius) continue;
    /* 소리는 깨우기만 하는 것이 아니라 **부른다**. 몬스터가 본 것만
       알게 된 뒤로(sim/retreat.mjs) 깨어난 놈은 나를 못 보면 헤맸고,
       그래서 소음이 아무도 끌어오지 못했다. 소리가 난 자리를 자취로
       심어 주면 놈들은 그리로 온다 — 그때부터 소음은 미끼가 되고,
       미끼가 되는 순간 밀도는 내가 정하는 것이 된다. */
    if (m.awake) { if (!m.mark || Math.random() < 0.5) { m.mark = { x, y }; m.lost = 0; } continue; }
    /* volume 1은 「반드시」다. 문이 삐걱이거나 상자가 부서지는 것은
       확률이어야 하지만(사고니까), 대가를 치르고 일부러 지르는
       소리는 결과가 확실해야 한다 — 11칸에서 25%만 깨우던 동안
       외침은 결정이 아니라 도박이었고, 도박은 이미 소란이 맡는다. */
    const heard = volume >= 1 ? true : Math.random() < volume * (1 - d / (radius + 1));
    if (heard) { m.awake = true; m.mark = { x, y }; m.lost = 0; woke++; }
  }
  if (woke) fx({ t:'noise', x, y, r:radius });
  return woke;
}

/* ── 소란 ────────────────────────────────────────────────
   판의 78%가 빈 걷기였고, 그 답은 「몬스터를 더 뿌린다」가 아니었다.
   그건 그냥 다 늘리는 것이고, 늘린 밀도는 플레이어의 결정이 아니다.

   그래서 밀도를 내가 산다. 깨어 있는 것이 주위에 많을수록 소란이
   오르고, 소란은 처치 보상을 부풀린다. 조용히 가면 안전하고 가난하고,
   불러 모으면 위험하고 부유하다. 소란은 혼자가 되면 식는다 — 그래서
   ③의 후퇴가 「그만두기」가 아니라 「챙기고 빠지기」가 된다. */
export const UPROAR_MAX = 12;
export const uproarMult = () => 1 + Math.min(G.uproar || 0, UPROAR_MAX) * 0.085;

function stirUproar() {
  const p = G.player;
  const near = G.monsters.filter(m => m.awake && !m.disguise
    && Math.hypot(m.x - p.x, m.y - p.y) <= 7).length;
  if (near >= 2) G.uproar = Math.min(UPROAR_MAX, (G.uproar || 0) + (near >= 4 ? 2 : 1));
  else if (near === 0) G.uproar = Math.max(0, (G.uproar || 0) - 1);
  const tier = G.uproar >= 9 ? 3 : G.uproar >= 5 ? 2 : G.uproar >= 2 ? 1 : 0;
  if (tier !== (G.uproarTier || 0)) {
    G.uproarTier = tier;
    if (tier === 1) say('사방에서 무언가 일어선다.', 'warn');
    if (tier === 2) say('층이 깨어났다. 이 소란은 네가 만든 것이다.', 'warn');
    if (tier === 3) say('전부 이쪽으로 오고 있다. 물러설 자리를 지금 정해라.', 'hit');
  }
}

/* 스스로 내는 소리. 이 게임에서 밀도를 올리는 유일한 손잡이다. */
export const SHOUT_STAM = 2;
export function shout() {
  const p = G.player;
  if (G.depth === 0) { say('여기서 소리쳐 봐야 아무도 오지 않는다.', 'warn'); return false; }
  if (p.stam < SHOUT_STAM) { say('숨이 차서 소리가 나오지 않는다.', 'warn'); return false; }
  p.stam -= SHOUT_STAM;
  G.act = 'shout';                  // 외침은 걷기가 아니다 — 안 적으면 걷기로 세어진다
  /* 9칸. 13칸을 확정으로 깨우던 동안 외침은 「한 무리를 부르는 것」이
     아니라 「층을 통째로 여는 것」이었고, 재 보니 도달 층수가 8.1에서
     5.0으로 떨어졌다. 위험을 사는 것과 판을 버리는 것은 다르다. */
  const woke = rouse(p.x, p.y, 9, 1);
  G.shouts = (G.shouts || 0) + 1; G.drawn = (G.drawn || 0) + woke;
  G.uproar = Math.min(UPROAR_MAX, (G.uproar || 0) + 3);
  /* 외침은 「일부러 시끄럽게 하는 것」이다 — 주목을 사는 가장 곧은
     행동이라, 판돈 쪽 절반이 여기서 시작한다. */
  provoke(6);
  say(woke ? `소리쳤다. ${woke}이(가) 이쪽으로 온다.`
           : '소리쳤다. 아무 대답도 없다. 그편이 나은지는 모르겠다.', woke ? 'hit' : '');
  fx({ t:'noise', x:p.x, y:p.y, r:13 });
  endTurn();
  return true;
}

/* ── stepping onto something ──────────────────────────────
   Returns true when the tile relocated us, so the caller
   knows not to keep acting on the old floor.               */
function enterTile(x, y) {
  const L = G.level, p = G.player, i = idx(x, y);
  const t = L.tiles[i];

  if (t === WEB) {
    if (roped()) say('밧줄이 거미줄을 갈라 놓는다.');
    else {
      p.stuck = 1 + rnd(3);
      say('거미줄에 걸렸다.', 'warn');
      fx({ t:'struggle', x, y });
    }
  } else if (t === WATER) {
    // Wading is safe and extremely loud.
    fx({ t:'splash', x, y });
    rouse(x, y, 7, 0.5);
  }

  const trap = L.traps.get(i);
  if (trap) return springTrap(x, y, trap);
  return false;
}

/* 매듭 밧줄. Two of the game's three "you lose your turn" effects
   simply stop applying, which is what makes the stealth price
   worth paying for a build that walks into everything. */
const roped = () => hasRelic('knot');

function springTrap(x, y, trap) {
  const p = G.player, L = G.level;
  /* 발이 가볍다. A ranger has spent its life on ground that bites
     and sometimes simply does not put its weight down — the trap
     stays armed and it steps around. Nobody else gets this, and
     it is why the class walks into a floor first. */
  if (p.cls === 'ranger' && Math.random() < RANGER_FOOTING) {
    trap.seen = true;
    say(`${TRAPS[trap.kind].n} 위에서 발을 뗐다.`, 'good');
    fx({ t:'spot', x, y });
    return false;
  }
  L.traps.delete(idx(x, y));
  G.trapsSprung++;
  ledger('trap');
  /* ③ 도굴꾼의 장갑 크랙. 이 게임에서 함정은 값을 받는 칸이다 —
     이 장갑은 그 칸을 **주는 칸으로 바꾼다.** 함정을 못 보는 대가는
     그대로 남고, 못 보는 것이 이제 이득이 된다. */
  if (cracked('glove')) {
    say('장갑이 발밑을 파헤친다. 함정이 아니라 묻힌 것이었다.', 'good');
    fx({ t:'spot', x, y });
    dropFromProp(x, y, 1, true);
    return false;
  }
  /* ① 매듭 밧줄의 크랙. 거미줄과 구덩이만 통하던 밧줄이 **전부**
     통한다 — 부러진 나침반과 같은 자리에 선다, 눈은 뜬 채로. */
  if (cracked('knot')) {
    say('밧줄이 발보다 먼저 걸렸다.', 'good');
    fx({ t:'resist', x, y });
    return false;
  }
  // 부러진 나침반: you walk into every one of them and none of
  // them matter. Blind and immune is a build, not a handicap.
  if (hasRelic('compass') || hasRelic('oracle')) {
    say('나침반 바늘이 홱 돌더니, 발밑의 무언가가 죽는다.', 'good');
    fx({ t:'resist', x, y });
    return false;
  }
  const spec = TRAPS[trap.kind];
  say(spec.msg, 'warn');
  fx({ t:'trap', kind:trap.kind, x, y });

  switch (trap.kind) {
    case 'dart': {
      const took = hurtPlayer(roll(2, 4) + Math.floor(G.depth * 0.8), { by:'화살 함정' });
      if (!G.running) return false;
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg: took, low: p.hp <= p.maxhp * 0.25 && p.hp + took > p.maxhp * 0.25, severe: took >= p.maxhp * 0.18 });
      say(`화살이 ${took}의 피해를 입혔다.`, 'hit');
      return false;
    }
    case 'poison': {
      const took = hurtPlayer(roll(1, 4), { by:'독침 함정' });
      if (!G.running) return false;
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg: took });
      afflict(p, 'poison', 22 + G.depth);
      return false;
    }
    case 'pit': {
      /* Catching the edge. Falling a floor skips content you were
         in the middle of, so it should be the unlucky outcome and
         not the default — and dexterity should be the thing that
         decides it. */
      if (roped()) { say('밧줄이 걸려 허공에 매달렸다. 기어 올라온다.', 'good'); return false; }
      const grab = clamp(0.45 + statB(p, 'dex') * 0.07
                         + (p.cls === 'rogue' ? 0.15 : p.cls === 'ranger' ? 0.07 : 0), 0.2, 0.92);
      if (Math.random() < grab) {
        const graze = hurtPlayer(roll(1, 4), { by:'구덩이' });
        if (!G.running) return false;
        say(`가장자리를 붙잡았다. ${graze}의 피해.`, 'good');
        fx({ t:'struggle', x:p.x, y:p.y });
        return false;
      }
      const fell = hurtPlayer(roll(2, 6) + Math.floor(G.depth * 0.5), { by:'구덩이' });
      say(`떨어지며 ${fell}의 피해를 입었다.`, 'hit');
      if (!G.running) return false;
      if (G.depth >= MAX_DEPTH) return false;
      breakCombo(true);
      enterDepth(G.depth + 1);
      say(`${G.depth}층으로 떨어졌다.`, 'warn');
      return true;
    }
    case 'teleport':
      teleport();
      return false;
    case 'alarm': {
      let woke = 0;
      for (const m of G.monsters) if (!m.awake) { m.awake = true; woke++; }
      say(woke ? `${woke}마리가 깨어났다.` : '아무도 대답하지 않는다.', 'warn');
      fx({ t:'noise', x, y, r:26 });
      return false;
    }
  }
  return false;
}

/* Spotting a trap before you tread on it. Wisdom and a rogue's
   trade; the reason to walk a corridor instead of sprint it. */
function scanForTraps() {
  const p = G.player, L = G.level;
  const skill = clamp(
    0.16 + statB(p, 'wis') * 0.045 + p.lv * 0.007
    + (p.cls === 'rogue' ? 0.28 : p.cls === 'ranger' ? 0.10 : 0),
    0.04, 0.9);
  /* How far the eye reaches, not just how good it is. A rogue
     spots what is under its nose; a ranger reads the ground two
     rooms out, which is the difference between disarming a floor
     and surviving it. */
  let reach = p.cls === 'ranger' ? 4 : p.cls === 'rogue' ? 3 : 2;
  /* 어둠 속에서는 바닥이 안 보인다. 함정을 밟는 것이 어둠의 값 중
     하나여야지, 불이 꺼진 채로 걷는 것이 공짜면 안 된다. */
  if (G.depth > 0 && p.lightTurns <= 0 && !hasRelic('nighteye')) reach = 1;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const trap = L.traps.get(idx(x, y));
    if (!trap || trap.seen) continue;
    const near = Math.max(Math.abs(dx), Math.abs(dy));
    // 도굴꾼의 장갑 and 부러진 나침반 both blind you to traps —
    // one for greed, one because it no longer matters.
    if (hasRelic('glove') || hasRelic('compass') || hasRelic('oracle')) continue;
    if (Math.random() < skill / near) {
      trap.seen = true;
      say(`${TRAPS[trap.kind].n}을(를) 발견했다.`, 'good');
      fx({ t:'spot', x, y });
    }
  }
}

function pickUp() {
  const p = G.player;
  const i = G.items.findIndex(it => it.x === p.x && it.y === p.y);
  if (i < 0) return;
  G.act = 'pick';
  const it = G.items[i];
  if (it.kind === 'chest') { openChest(i, it); return; }
  /* 전리품 더미는 줍는 것이 아니라 여는 것이다. 사건 화면을 빌려
     쓴다 — 「여러 줄 중 하나를 고른다」는 화면이 이미 있는데 똑같은
     것을 하나 더 만들면, 다음에 고칠 때 한쪽만 고쳐진다. */
  /* 밟는 순간 화면을 띄우지 않는다. 걷는 손가락 아래로 시트가
     올라오면 다음 반복 입력이 버튼을 눌러 버린다 — 모닥불·제단·
     수레에서 이미 겪은 일이고, 새로 만드는 것이 같은 실수를
     되풀이할 이유는 없다. 발밑 버튼이 기다린다. */
  if (it.kind === 'spoils') {
    say('전리품 더미 위에 섰다.', 'good');
    return;
  }
  if (it.kind === 'fallen') {
    say(`${it.rec.sent}번째 위에 섰다.`, 'warn');
    return;
  }
  if (it.kind === 'relic') {
    // Leave it lying there if the swap screen is refused, so the
    // choice can be walked away from and come back to.
    if (!takeRelic(it.id) && G.screen !== 'relic') return;
    G.items.splice(i, 1);
    return;
  }
  /* Gold and keys go nowhere near the pack, so they are always
     takeable. Everything else has to have a slot waiting before
     the floor gives it up. */
  if (it.kind !== 'gold' && it.kind !== 'key' && !packRoom(p, it)) {
    say(`배낭이 가득 찼다 — ${nameOf(it)}은(는) 발밑에 그대로 있다.`, 'warn');
    return;
  }
  G.items.splice(i, 1);
  if (it.kind === 'gold') { const g = goldGain(it.amount); p.gold += g; say(`금화 ${g}닢.`, 'good'); return; }
  if (it.kind === 'key')  { p.keys++; say(`녹슨 열쇠를 주웠다. (${p.keys})`, 'good'); return; }
  // 서기의 깃펜 names it in your hand, before you have to bet on it.
  if (hasRelic('quill') || hasRelic('ledger')) identify(it.id, true);
  /* 지능 reads labels. A clever hero names roughly half of what
     they pick up on sight; a dull one names nothing and has to
     drink it to find out, which is exactly the gamble the
     unidentified flask is for. */
  else if (it.kind === 'use' && !isKnown(it.id)
           && Math.random() < clamp(statB(p, 'int') * 0.12, 0, 0.7)) {
    identify(it.id, true);
    say(`글자를 읽어냈다 — ${nameOf(it)}.`, 'good');
  }
  // 내려놓은 묶음은 묶음째 돌아온다 — 화살 스무 발을 놓고 다시
  // 주웠더니 한 발이 되던 자리다.
  addItem(p, it, it.qty || 1);
  /* 초월 does not get a line in the log — it gets the screen.
     This is the rarest thing that can happen to a run and the
     player should not have to read four words to notice it. */
  if (it.boon) {
    const b = boonById(it.boon);
    G.transFound = (G.transFound || 0) + 1;
    fx({ t:'transcend', x:p.x, y:p.y });
    say(`— 초월. ${affixName(it)}.`, 'level');
    say(b.t, 'level');
    return;
  }
  /* 그 아래 등급들도 로그 한 줄로 흘려보내지 않는다. 「희귀」부터는
     화면이 멈춘다 — 판에 서너 번뿐인 일이고, 그때 무엇을 얻었는지
     읽지 않고 지나가면 그건 득템이 아니라 알림이다.
     초월은 위에서 이미 제 화면을 가져갔다. */
  const grade = rarityOf(it);
  if (grade >= 2) {
    G.rareFound = (G.rareFound || 0) + 1;
    fx({ t:'found', x:p.x, y:p.y, rar:grade });
    lore(RARITY[grade].n, affixName(it), itemBlurb(it), it.spr);
  }
  say(`${nameOf(it)}을(를) 주웠다.`, grade >= 2 ? 'level' : 'good');
}

/* ── 이게 지금 든 것보다 나은가 ────────────────────────────
   플레이 평이 「아이템이 뭐가 가치있는지 모르겠다」였다. 카드가
   주사위와 속성 **이름**은 말하는데, 그것이 지금 손에 든 것보다
   나은지는 한 번도 말하지 않는다. 2d6과 1d10 중 무엇이 나은지를
   사람이 암산하게 두면, 그 카드는 정보가 아니라 장식이다.

   그래서 **같은 식에 넣어 본다.** 규칙이 실제로 쓰는 피해식(swing의
   그 줄)을 한 곳으로 빼서, 카드와 배낭과 벤치가 전부 그 하나를
   지난다 — 화면이 약속하는 값과 손이 내는 값이 갈릴 수가 없다. */
export function swingAvg(p, it) {
  if (!p) return 0;
  const keep = p.equip[it?.kind === 'armour' ? 'body' : 'weapon'];
  if (it) p.equip[it.kind === 'armour' ? 'body' : 'weapon'] = it;
  const g = gearBonus(p);
  const w = p.equip.weapon;
  const dice = w ? w.dice : [1, 3];
  const mid = dice[0] * (dice[1] + 1) / 2;
  let d = (mid + g.dmg) * (1 + statB(p, 'str') * STR_DMG + p.lv * LV_DMG + g.dmgPct);
  if (w && weaponType(p) === 'great') d *= 1.45;
  /* 치명타는 기댓값에 녹여 넣는다 — 「예리한」이 카드에서 0%로
     보이던 것이 이 한 줄 때문이었다. */
  d *= 1 + critChance(p) * (critMult(p) - 1);
  if (it) p.equip[it.kind === 'armour' ? 'body' : 'weapon'] = keep;
  return d;
}

/* 「지금 든 것 대비 몇 %」. 같은 칸의 장비에만 답한다 — 물약과
   두루마리는 비교할 상대가 없다. */
export function compareToHeld(it) {
  const p = G.player;
  if (!p || !it) return null;
  if (it.kind === 'weapon') {
    const now = swingAvg(p, null), next = swingAvg(p, it);
    if (!now) return null;
    return { what: '한 방', pct: Math.round((next / now - 1) * 100) };
  }
  if (it.kind === 'armour') {
    const keep = p.equip.body;
    const now = armourClass(p);
    p.equip.body = it;
    const next = armourClass(p);
    p.equip.body = keep;
    return { what: '방어', pct: Math.round((next / Math.max(1, now) - 1) * 100) };
  }
  return null;
}

/* 한 줄로 읽는 비교. 카드와 배낭이 같은 문장을 쓰게 하려고 뺐다. */
export function compareLine(it) {
  const c = compareToHeld(it);
  if (!c) return null;
  if (c.pct === 0) return `지금 든 것과 ${c.what}이(가) 같다`;
  return `지금 든 것보다 ${c.what} ${c.pct > 0 ? '+' : ''}${c.pct}%`;
}

/* ── 팔까, 부술까 ────────────────────────────────────────
   두 값이 화면 어디에도 나란히 없었다. 배낭에서 「분해」를 누르면
   재료가 얼마 들어오는지 모른 채 눌렀고, 상인 앞에서 파는 값은
   보이지만 그것을 부수면 뭐가 나오는지는 안 보였다. 그러면 이 게임의
   재화 결정 하나가 통째로 감으로 내려간다.

   실측하면 답이 물건마다 다르다(sim/purse.mjs): 8층 이중부여는
   부수는 쪽이 2.1배 이득이고, 12층 각인 둘짜리는 파는 쪽이 낫다.
   답이 갈리는 결정이므로 **양쪽 숫자를 같이** 적는다.            */
export function tradeLine(it) {
  if (!it || it.kind === 'use' || it.kind === 'cat') return null;
  const y = salvageYield(it);
  const bits = [`${MATS.scrap.n} ${y.scrap}`];
  if (y.dust) bits.push(`${MATS.dust.n} ${y.dust}`);
  if (y.essence) bits.push(`${MATS.essence.n} ${y.essence}`);
  return `팔면 ◍${priceOf(it, false)} · 부수면 ${bits.join(' · ')}`;
}

/* 주운 것이 무엇인지 한 문단으로. 카드에 「사용 가능」만 뜨면 카드를
   띄운 의미가 없다 — 멈춰 세웠으면 멈출 값을 줘야 한다. */
function itemBlurb(it) {
  const bits = [];
  if (it.kind === 'weapon') bits.push(`${WEAPON_TYPES[it.t]?.n || '무기'} · ${it.dice[0]}d${it.dice[1]}${it.hands === 2 ? ' · 양손' : ''}`);
  if (it.kind === 'armour') bits.push(`방어 +${it.ac}`);
  if (it.plus) bits.push(`+${it.plus}`);
  for (const table of [PREFIXES, SUFFIXES]) {
    const a = table.find(x => x.id === (table === PREFIXES ? it.pre : it.suf));
    if (a) bits.push(`${a.n} — ${a.t || ''}`.trim());
  }
  for (const g of (it.engrave || [])) {
    const e = ENGRAVINGS.find(x => x.id === g);
    if (e) bits.push(`${e.n} — ${e.t}`);
  }
  if (isCursed(it)) bits.push('저주받았다. 벗을 수 없다.');
  /* 그리고 마지막 줄에 답을 적는다: 지금 든 것보다 나은가. 2d6과
     1d10 중 무엇이 나은지를 사람이 암산하게 두면 카드는 장식이다. */
  const line = compareLine(it);
  if (line) bits.push(line);
  return bits.join('\n');
}

/* ── the furniture ────────────────────────────────────────
   Five things that stand in rooms. Walking into one is the whole
   interface — there is no "use" verb, because a game where you
   have to remember a verb is a game where nobody touches the
   scenery. Each one answers a different question:

     통  — what is inside? (loot, and sometimes a face)
     화로 — light, at the price of standing next to fire
     기둥 — masonry you have to walk around, or break through
     뼈무더기 — free bones, and whatever was sleeping under them
     항아리 — the only one that is purely a gamble

   A prop takes two or three blows because a single tap would make
   them scenery you clear rather than scenery you decide about. */
/* 여기 열쇠가 빠지면 「undefined이(가) 삐걱인다」가 나간다. 좌판과
   우물이 그렇게 빠져 있었다 — 표는 가구가 늘 때 같이 늘지 않는다. */
export const PROP_NAME = {
  barrel:'낡은 통', brazier:'화로', pillar:'무너진 기둥',
  bones:'뼈 무더기', urn:'봉인된 항아리',
  stall:'좌판', well:'마른 우물',
};

/* Returns whether the bump cost a turn. */
function bumpProp(x, y) {
  const p = G.player, L = G.level, i = idx(x, y);
  const o = propAt(L, x, y);
  if (!o) return false;

  /* A brazier is not broken, it is lit. Standing next to one is
     worth more than the oil it saves, and it never has to be
     hit at all. */
  if (o.kind === 'brazier' && !o.lit) {
    o.lit = true;
    p.lightTurns = Math.min(oilCap(), p.lightTurns + 240);
    say('화로에 불을 옮겼다. 기름이 조금 아껴진다.', 'good');
    fx({ t:'forge', x, y });
    // Fire is bright, and bright carries. Four tiles, not the
    // whole room — waking a floor by accident is not a trade.
    for (const m of G.monsters)
      if (Math.hypot(m.x - x, m.y - y) <= 4) m.awake = true;
    return true;
  }
  // Bumping a fire that is already burning costs nothing. A wall
  // that eats turns is a wall you fight.
  if (o.kind === 'brazier') { say('이미 타고 있다.'); return false; }

  // Everything else gets hit.
  const force = 1 + Math.max(0, statB(p, 'str'));
  o.hp -= force;
  fx({ t:'hit', on:'monster', x, y, dmg:force, spr:'rubble' });
  if (o.hp > 0) { say(`${PROP_NAME[o.kind]}이(가) 삐걱인다.`); return true; }

  L.tiles[i] = FLOOR;
  L.props.delete(i);
  fx({ t:'salvage', x, y });
  G.smashed = (G.smashed || 0) + 1;

  switch (o.kind) {
    case 'barrel': {
      // A barrel is a chest without a lock and without a lid, so
      // it is also the cheapest place to hide a mimic.
      if (Math.random() < 0.10 + G.depth * 0.012) {
        const mim = mimicFor(G.depth);
        G.monsters.push({ ...mim, maxhp:mim.hp, x, y, awake:true, energy:0 });
        say('통 속에서 이빨이 나왔다.', 'bad');
        fx({ t:'reveal', x, y });
        break;
      }
      say('통이 부서졌다.', 'good');
      dropFromProp(x, y, 0.55);
      break;
    }
    case 'pillar':
      say('기둥이 무너졌다. 길이 열렸다.', 'good');
      // Rubble is loud enough to be heard across a room.
      for (const m of G.monsters)
        if (Math.hypot(m.x - x, m.y - y) <= 9) m.awake = true;
      fx({ t:'noise', x, y, r:9 });
      break;
    case 'bones':
      // Something is usually under a pile of bones.
      if (Math.random() < 0.35) {
        const m = pickMonster(G.depth);
        if (m) {
          const one = { ...scaleMonster(m, G.depth), x, y, awake:true, energy:0 };
          one.maxhp = one.hp;
          G.monsters.push(one);
          say(`뼈 무더기 아래에서 ${one.n}이(가) 일어났다.`, 'bad');
          break;
        }
      }
      say('뼈가 흩어졌다.', 'good');
      dropFromProp(x, y, 0.35);
      break;
    case 'urn': {
      /* The only pure gamble in the furniture. A third of them
         are worth breaking, a fifth of them bite. */
      const r = Math.random();
      if (r < 0.20) {
        const dmg = hurtPlayer(roll(2, 4 + Math.floor(G.depth * 0.8)), { by:'봉인된 항아리' });
        say(`항아리에서 검은 것이 터져 나왔다. ${dmg}의 피해.`, 'bad');
        fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, severe: dmg >= p.maxhp * 0.18 });
        if (G.running) afflict(p, 'poison', 10 + rnd(8));
      } else if (r < 0.55) {
        say('항아리는 비어 있었다.');
      } else {
        say('항아리에서 무언가가 굴러 나왔다.', 'level');
        dropFromProp(x, y, 1, true);
      }
      break;
    }
  }
  return true;
}

function dropFromProp(x, y, chance, good) {
  if (Math.random() > chance) return;
  const spot = itemAt(x, y) ? G.level.randomFloor(q => itemAt(q.x, q.y)) : { x, y };
  if (!spot) return;
  if (!good && Math.random() < 0.45) {
    G.items.push({ kind:'gold', spr:'gold', n:'금화',
      amount: Math.round((20 + rnd(30 + G.depth * 22)) * (G.branch?.gold || 1)),
      x: spot.x, y: spot.y });
    return;
  }
  const item = pickItem(G.depth + (good ? 2 : 0));
  if (item) G.items.push({ ...item, x: spot.x, y: spot.y });
}

/* ── chests ───────────────────────────────────────────────
   The gamble. A locked chest holds more; a trapped one costs
   you for finding out; and one chest in some number of them
   is not a chest at all (see MIMIC in populate).           */
function openChest(index, chest) {
  const p = G.player;

  if (chest.locked) {
    if (p.keys > 0) {
      p.keys--;
      chest.locked = false;
      say(`열쇠로 자물쇠를 열었다. (남은 열쇠 ${p.keys})`, 'good');
    } else {
      const hasPicks = !!p.pack.find(s => s.item.id === 'picks');
      const pick = clamp(
        0.10 + statB(p, 'dex') * 0.06 + lockBonus(p) + p.lv * 0.008
        + (hasPicks ? 0.28 : 0), 0.04, 0.92);
      if (hasPicks) wearPicks();
      if (Math.random() < pick) {
        chest.locked = false;
        say(hasPicks ? '갈고리가 걸리고, 자물쇠가 딸깍 열렸다.' : '자물쇠가 딸깍 열렸다.', 'good');
      } else {
        /* A lid that will not lift gets levered. It opens, but a
           lever through a lock goes through whatever the lock was
           protecting — which is what a key is worth, and it is a
           cost that can never wall off a floor the way a jammed
           door would. */
        chest.locked = false;
        say('자물쇠가 버틴다 — 지렛대를 걸었다.', 'warn');
        fx({ t:'door', x:chest.x, y:chest.y, state:'broken' });
        rouse(chest.x, chest.y, 9, 0.7);
        if (chest.loot?.length && Math.random() < CHEST_RUIN) {
          const gone = chest.loot.splice(rnd(chest.loot.length), 1)[0];
          say(`${gone.n}이(가) 지렛대에 부서졌다.`, 'bad');
          fx({ t:'shatter', x:chest.x, y:chest.y });
        }
        chest.gold = Math.round(chest.gold * 0.8);
      }
    }
  }

  if (chest.trapped) {
    chest.trapped = false;
    const kind = ['dart', 'poison', 'alarm'][rnd(3)];
    say('뚜껑에 무언가 걸려 있었다.', 'warn');
    springTrap(chest.x, chest.y, { kind });
    if (!G.running) return;
  }

  G.items.splice(index, 1);
  G.opened++;
  fx({ t:'chest', x:chest.x, y:chest.y });
  say('상자를 열었다.', 'good');

  // 도굴꾼의 장갑: everything in the box, twice. The cost is
  // paid in every trap you no longer see coming.
  const twice = hasRelic('glove');
  const gold = goldGain(Math.round((chest.gold || 0) * (twice ? 2 : 1)));
  if (gold) { p.gold += gold; say(`금화 ${gold}닢.`, 'good'); }
  for (const it of chest.loot || []) {
    addItem(p, it, twice && it.kind === 'use' ? 2 : 1);
    say(`${nameOf(it)}을(를) 얻었다.${twice ? ' (장갑이 한 번 더 훑었다)' : ''}`, 'good');
  }
  if (twice) {
    const extra = pickItem(G.depth + 2);
    if (extra) { addItem(p, extra); say(`${extra.n}도 딸려 나왔다.`, 'good'); }
  }
}

/* ── weapon families ──────────────────────────────────────
   Six rules rather than six damage dice. Everything below reads
   `weaponType(p)` once and branches; nothing else in the file
   needs to know what a spear is. */
export { fitsOf, fitRule, FITS, oddityOf, UNIQUES, ODDITIES };
export const weaponType = p => p.equip.weapon?.t || 'sword';
export const weaponReach = p => (weaponType(p) === 'spear' ? 2 : 1);

/* Called once per player turn. A dagger swings twice; everything
   else swings once and lets its own rule fire inside. */
function playerAttack(m) {
  const p = G.player;
  if (!p.swinging && weaponType(p) === 'dagger') {
    p.swinging = true;
    swing(m, 0.62);
    // 도적의 날: the streak counter is already at two after the
    // first thrust, so the guaranteed crit lands on the second
    // rather than a turn later.
    if (fitRule(p, 'thirdAtTwo') && p.chain3 === 2) p.chain3 = 3;
    // The second thrust only lands if there is still something
    // in front of you — which is why a dagger wants 처형.
    if (G.running && G.monsters.includes(m)) swing(m, 0.62);
    p.swinging = false;
    return;
  }
  // A bow up close is a stick. That is the price of reach, and it
  // is what stops a bow from being a free extra button on a build
  // that never wanted to stand back.
  swing(m, weaponType(p) === 'bow' && !fitRule(p, 'bowButt') ? crackBowMelee() : 1);
}

/* ── shooting ─────────────────────────────────────────────
   The other half of a fight the player could only ever walk into.
   A shot costs a turn and an arrow, falls off with distance, and
   needs a clear line — everything a monster's shot already costs
   it, read off the same helpers. */
/* What is on the hip right now. Arrows stopped being a count
   this patch: the quiver is a worn item and a bow with one is
   simply a better bow, so nothing here can run out mid-floor. */
export function quiver(p) {
  return (p || G.player)?.equip?.quiver || null;
}

export function shotTarget() {
  const p = G.player, L = G.level;
  if (!p || weaponType(p) !== 'bow') return null;
  const rng = bowRange(p);
  return G.monsters
    .filter(m => !m.disguise && L.vis[idx(m.x, m.y)]
              && Math.hypot(m.x - p.x, m.y - p.y) <= rng
              && lineClear(L, p.x, p.y, m.x, m.y))
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] || null;
}

/* How far this bow reaches in these hands. 긴 눈 is the only
   thing that moves it, and every reader goes through here. */
export const bowRange = p =>
  (p?.equip?.weapon?.rng || 5) + (quiver(p)?.rng || 0) + (fitRule(p, 'farEye') ? 2 : 0);

export const canShoot = () => !!shotTarget();

/* One arrow leaving the string, wherever it was told to go. Both
   the plain shot and every ranger art land here, so ammunition,
   falloff, poison and the ember can never be right in one place
   and wrong in another. `scale` is the art's multiplier; `sure`
   skips the roll for the arts that promise they cannot miss. */
/* 화살은 떨어지지 않는다. 화살통은 소모품이 아니라 장비 한 칸이고,
   무엇을 끼웠는가가 「몇 발 남았는가」를 대신한다 — 세는 자원이 하나
   더 붙으면 활은 「쏠까 말까」가 아니라 「아껴 둘까」가 된다.
   예전 설계의 잔해가 세 군데 남아 있었다: 기술의 a.ammo 게이트 둘과,
   **어디에도 정의된 적 없는** spendArrows() 호출 하나. 화살값이 붙은
   기술이 하나라도 생기는 날 그 줄은 ReferenceError로 터졌을 것이다. */
function loose(m, scale = 1, opt = {}) {
  const p = G.player;
  G.act = 'shoot';
  const a = quiver(p) || QUIVERS[0];
  const dist = Math.hypot(m.x - p.x, m.y - p.y);
  const g = gearBonus(p);
  m.awake = true;
  if (!opt.quietFx) fx({ t:'loose', fx:p.x, fy:p.y, tx:m.x, ty:m.y, ammo:a.id });

  if (!opt.sure) {
    const hit = 12 + statB(p, 'dex') * 3 + Math.floor(p.lv * 0.8) + g.hit + (a.hit || 0)
              + (p.blessed > 0 ? 6 : 0);
    const land = clamp(0.32 + (hit - (m.ac || 0) * 1.6) / 46, 0.15, 0.95);
    if (Math.random() > land) {
      say(`${pickLine(MISS_AT, m.n, nextLine())}`);
      fx({ t:'miss', x:m.x, y:m.y });
      return false;
    }
  }
  /* Landed. The mark goes on before the damage is priced, exactly
     as it does for a swing, so a shot benefits from the stack it
     just placed. */
  markTarget(m);
  const d = p.equip.weapon?.dice || [1, 4];
  let dmg = roll(d[0], d[1]) + statB(p, 'dex') * 2 + Math.floor(p.lv / 3) + g.dmg;
  dmg *= (1 + g.dmgPct) * (a.dmg || 1) * scale * markMult();
  // 부러뜨리는 손: the aim is still bad. What lands, lands twice.
  if (oddAwake('breakhand')) dmg *= 2;
  // Reach is not free — except where an art has bought it.
  if (!opt.sure) dmg *= Math.max(0.55, 1 - dist * (BOW_FALLOFF + (a.falloff || 0)));
  dmg = Math.max(1, Math.round(dmg));

  // hurtMonster narrates off opt.weapon; saying it here too printed
  // every shot twice, once as an arrow and once as a shove.
  hurtMonster(m, dmg, null, { weapon:'arrow', shot:true, burst: a.burst || 0 });
  if (a.on && G.monsters.includes(m) && Math.random() < 0.6) poisonMonster(m, a.on);
  /* 미늘 화살촉. Not poison and not damage — the head stays in,
     and the thing wearing it arrives a turn later than it meant
     to. The one quiver that answers being closed on. */
  if (a.bleed && G.monsters.includes(m)) m.energy = (m.energy || 0) - 0.5;
  return true;
}

export function shoot() {
  const p = G.player;
  if (weaponType(p) !== 'bow') { say('활이 없다.', 'warn'); return; }
  const m = shotTarget();
  if (!m) { say('겨눌 것이 없다.', 'warn'); return; }
  if (has(p, 'paralyze')) {
    say('몸이 굳어 말을 듣지 않는다.', 'warn');
    fx({ t:'struggle', x:p.x, y:p.y }); endTurn(); return;
  }
  /* ── 물러서며 쏜다 ────────────────────────────────────
     레인저의 지시는 「거리를 두고 잡아라」인데, 이 게임의 모든 것은
     너와 같은 속도로 걷는다 — 즉 거리를 **만들** 방법이 없었다.
     재 보니 판당 근접 87번, 사격 48번. 활잡이가 판의 대부분을
     활로 두들겨 패고 있었고, 그래서 사냥꾼의 몫(두 칸 밖 처치)도
     표적 누적도 거의 켜지지 않았다.

     붙은 것에게 쏘면 한 발 물러난다. 뒤가 막혔으면 못 물러난다 —
     구석에 몰리는 것은 여전히 벌이다. 기술이 아니라 기본 사격에
     붙인다: 8레벨에 열리는 덫으로는 1층부터 12층까지의 문제를
     풀 수 없다. */
  if (p.cls === 'ranger' && Math.hypot(m.x - p.x, m.y - p.y) <= 1.5) {
    const bx = p.x - Math.sign(m.x - p.x), by = p.y - Math.sign(m.y - p.y);
    if (!G.level.solid(bx, by) && !monsterAt(bx, by)
        && G.level.tiles[idx(bx, by)] !== WEB) {
      p.x = bx; p.y = by;
      refreshFov();
      say('한 발 물러서며 시위를 놓았다.', 'good');
      fx({ t:'dodge', x:p.x, y:p.y });
    }
  }
  G.hushShot = true;
  loose(m, 1);
  /* 두 번 우는 활: a second arrow at half, out of the same nock.
     One arrow spent, two in the air. */
  if (hasUnique('twicewept') && G.monsters.includes(m)) {
    /* ① 크랙 「울음이 멎지 않는다」. 두 번째가 절반이 아니라 온전해지고,
       그 화살이 무언가를 끝내면 세 번째가 나간다. */
    const dead = !G.monsters.includes(m);
    loose(m, 1, { quietFx: true });
    if (!G.monsters.includes(m) && !dead) {
      const next = G.monsters.find(o => o.awake && !o.disguise
        && G.level.vis[idx(o.x, o.y)] && lineClear(G.level, p.x, p.y, o.x, o.y));
      if (next) { say('울음이 멎지 않는다.', 'level'); loose(next, 1, { quietFx: true }); }
    }
  }
  G.hushShot = false;
  endTurn();
}

/* `opt` carries the handful of things an art needs the blow to do
   differently. It returns whether the blow landed — 연타 needs to
   know, and nothing else in the file did until now. */
function swing(m, scale, opt = {}) {
  const p = G.player;
  G.act = 'fight';

  /* You did not attack a mimic — you reached for a chest. It
     gets the first bite for that, and your swing still lands. */
  if (m.disguise) {
    m.disguise = false;
    m.awake = true;
    m.spr = 'mimic';
    G.mimicsBitten++;
    say('상자가 이빨을 드러냈다.', 'warn');
    fx({ t:'reveal', x:m.x, y:m.y });
    monsterMelee(m);
    if (!G.running) return false;
  }

  const asleep = !m.awake;
  m.awake = true;
  fx({ t:'lunge', who:'player', x:p.x, y:p.y, kind:weaponType(p),
       dx: Math.sign(m.x - p.x), dy: Math.sign(m.y - p.y) });

  /* A sleeping target never gets a saving throw. This is the
     reason to take the long way round instead of the short. */
  const gp = gearBonus(p);
  const kind = weaponType(p);
  const armour = m.ac * 1.15 * (1 - gp.pierce);   // 꿰뚫는: armour counts for less
  // 대검류 is wilder; everything else swings true.
  const aim = (kind === 'great' ? 0.88 : 1) * crackAim();
  /* 불이 꺼지면 반경만 줄어드는 것이 아니라 손도 무뎌진다. 두 칸
     앞이 벽인지도 모르는 자리에서 정확히 때릴 수는 없다. 잠든 것은
     예외 — 어둠 속에서 자는 것을 찾아낸 것은 오히려 공이다. */
  const blind = G.depth > 0 && p.lightTurns <= 0 && !hasRelic('nighteye');
  const chance = asleep ? 1
    : clamp((0.44 + (toHit(p) * aim - armour) / 55) * (blind ? DARK_AIM : 1), 0.14, 0.95);
  if (Math.random() > chance) {
    say(pickLine(MISS_AT, m.n, nextLine()));
    fx({ t:'miss', x:m.x, y:m.y });
    p.chain3 = 0;              // 세 번째 손: a miss resets the count
    return false;
  }

  /* 세 번째 손 (전사). Three landed blows on the same body and
     the third one goes through the armour. Same target only —
     a warrior who dances between three enemies never gets it,
     which is the whole instruction the trait is giving. */
  if (p.cls === 'warrior') {
    p.chain3 = (p.chainOn === m ? (p.chain3 || 0) : 0) + 1;
    p.chainOn = m;
  }
  /* 표적 (레인저). The opposite instruction: stay on one thing
     and it gets worse for it, 9% at a time. */
  markTarget(m);

  const w = p.equip.weapon;
  /* ① 크랙 「셈이 끝나지 않는다」. 세는 칼이 세는 것을 멈추지 않으면
     그 칼은 판이 끝날 때까지 자란다 — 여덟마다 주사위가 한 면. */
  const dice = w ? crackDice(w) : [1, 3];
  const g = gp;
  /* ── 무기가 척추다 ──────────────────────────────────────
     예전 식은 `주사위 + 힘×2 + 레벨/3 + 장비` 였다. 전부 가산이라
     **무기가 좋아져도 나머지가 그대로 붙어 오는** 구조였고, 그래서
     판 전체에서 한 방이 2.8 → 51.6(18배)로 자라는 동안 무엇이
     그 18배를 만들었는지 화면에서 읽히지 않았다. 룬검을 주워도
     「+13」이었고, 그 13은 다음 층 몬스터 체력 앞에서 사라졌다.

     이제 주사위가 밑이고 나머지가 지수 쪽에 선다:
         (주사위 + 장비의 고정값) × (1 + 힘 + 레벨 + 비율들)
     무기를 바꾸면 힘도 레벨도 강화도 **같이 커진다.** 이것이
     「득템의 순간」이 존재하기 위한 최소 조건이다 — 곱이 아니면
     새 무기는 언제나 옛 무기 더하기 몇이다. */
  let dmg = (roll(dice[0], dice[1]) + g.dmg)
          * (1 + statB(p, 'str') * STR_DMG + p.lv * LV_DMG
               + g.dmgPct + (p.might > 0 ? 0.6 : 0));
  dmg *= scale;
  if (kind === 'great') dmg *= 1.45;

  // 낙인: sharpened against the things that telegraph, blunted
  // against everything else.
  if (hasRelic('brand'))
    dmg *= (m.elite?.length || m.boss)
      ? 1 + relicVal('brand') * (cracked('brand') ? 2 : 1) : 0.85;
  // 진노의: the same idea without the downside, which is what
  // makes a 은총 a 은총 and not an affix.
  if (hasBoon('wrath') && (m.elite?.length || m.boss || m.named)) dmg *= 1.35;
  // 재를 세는 자: one notch per body, and the notches are this
  // floor's only. The knife counts, not you.
  if (hasUnique('ashcount')) dmg += (G.ashCount || 0);
  // 화로에서 꺼낸 것: it wakes up as you run out.
  if (hasUnique('emberpull')) dmg *= 1 + (1 - p.hp / Math.max(1, p.maxhp)) * 1.2;
  /* 사제의 무게: a mace in the right hands against the things
     that should already be still. Read off the sprite rather than
     a hand-kept list, so a new undead is covered the day it is
     written. */
  if (fitRule(p, 'vsUndead') && UNDEAD.includes(m.spr)) dmg *= 1.4;
  // 결전의 각인: the same idea, cut into the blade rather than worn.
  if (g.vsElite && (m.elite?.length || m.boss || m.named)) dmg *= 1 + g.vsElite;
  // 사냥의 각인: only the blow that opens the wound.
  if (g.firstStrike && m.hp >= m.maxhp) dmg *= 1 + g.firstStrike;

  dmg *= markMult();

  /* The two traits that decide a crit outright, rather than
     nudging the roll. Both are earned by a rule the player can
     see filling in the HUD. */
  /* The rogue used to be the second line here: a swing spent
     p.shadow for a guaranteed crit. That is what made the shade a
     blinking light rather than a resource — it was banked and
     burned by the same button you press anyway. */
  /* 하프오크 — 「맞아도 잘 죽지 않는다」가 여태 hp+1 하나였다.
     몰렸을 때 세지는 쪽이 그 문장에 맞는다. */
  {
    const c = raceRule(p, 'cornered');
    if (c && p.hp < p.maxhp * 0.25) scale = (scale ?? 1) * (1 + c);
  }
  const forced = (p.cls === 'warrior' && (p.chain3 || 0) >= 3) || !!opt.forceCrit;
  if (forced && !opt.forceCrit) { p.chain3 = 0; say('세 번째 손 — 급소가 열렸다.', 'level'); }
  const crit = asleep || forced
    || Math.random() < critChance(p) + (kind === 'dagger' ? 0.08 : 0);
  if (crit) {
    ledger('crit');
    dmg *= critMult(p) * (asleep ? 1.5 : 1);
    /* 치명타는 원래 숫자가 붉게 뜨지만, **왜 자주 뜨는지**는 안 나온다.
       예리한·파멸은 그 확률과 배수에만 사는 속성이라, 이름을 한 번
       불러 주지 않으면 영영 「운이 좋았다」로 읽힌다. */
    if (!asleep && !forced) {
      const byK = bearerOf('crit') || bearerOf('critMult');
      if (byK) credit('crit', `${byK}이(가) 갈비뼈 사이를 찾아냈다.`);
    }
  }
  dmg = Math.max(1, Math.round(dmg * comboMult()));

  /* 절단. One crit in forty becomes something else entirely: the
     swing that people screenshot. Deliberately not a stat you can
     build for — it rides on the crit you already earned, so the
     build that crits often sees it often, and nobody sees it on
     purpose. */
  let perfect = false;
  if (crit && !m.boss && Math.random() < PERFECT_CHANCE) {
    perfect = true;
    G.perfects = (G.perfects || 0) + 1;
    dmg = Math.round(dmg * 3.2);
    say(`— 절단. ${m.n}이(가) 두 동강 났다.`, 'level');
  }

  if (asleep) {
    say(`잠든 ${m.n}의 급소를 찔렀다.`, 'level');
    if (hasResonance('shadowstep')) G.hushUntil = G.turn + 1;
    /* A throat opened quietly pays for the next one — the loop
       어둠 되감기 closes. Not for an ambush the art manufactured
       itself, though: 그림자 도약 marks its target unaware for one
       blow, and on the bench that refunded the shade it had just
       spent. An art may borrow the ambush; it may not be paid. */
    if (!opt.noShade) gainShadow(1, 'ambush');
  }

  /* 처형: below the threshold nothing survives, so a suffix that
     looks small on paper decides whether a wounded troll gets one
     more turn to hit back. */
  const cut = g.execute + (hasResonance('tally') ? (G.tally || 0) * 0.01 : 0);
  if (cut > 0 && !m.boss && m.hp <= m.maxhp * cut) {
    const byX = bearerOf('execute');
    say(byX ? `${byX}이(가) ${m.n}의 숨을 끊었다 — 더 볼 것도 없이.`
            : `${m.n}을(를) 처형했다.`, 'level');
    /* Each one makes the next easier, for this floor only. The
       reset on descending is the whole balance: it snowballs
       inside a room and never carries. */
    if (hasResonance('tally')) {
      G.tally = (G.tally || 0) + 1;
      /* 「문턱 +15%p」는 통계 보고서의 어휘이고, 「재를 세는 자」와 같은
         화면에 뜬다. 세는 것은 세계가 하는 일이니 세는 것만 말한다 —
         그 값이 무엇을 하는지는 유물 설명이 이미 적어 두었다. */
      if (G.tally % 5 === 0) say(`${G.tally}까지 셌다. 손이 그만큼 앞서 간다.`, 'level');
    }
    fx({ t:'execute', x:m.x, y:m.y });
    hurtMonster(m, m.hp + 999, null, { crit: true, execute: true });
  } else {
    /* 파멸의: a crit takes a slice of the *maximum*, so the boon
       is worth exactly as much against a troll as the troll is
       big. It is the only damage in the game that does not care
       what your weapon is. */
    if (crit && hasBoon('ruin') && !m.boss)
      dmg += Math.max(1, Math.round(m.maxhp * 0.08));
    if (perfect) fx({ t:'perfect', x:m.x, y:m.y });
    /* 「들키지 않고 걸었나」. 눈의 방을 부르는 값 — 기습이 나가는
       유일한 자리에서 센다. */
    if (asleep) G.sneaked = (G.sneaked || 0) + 1;
    hurtMonster(m, dmg, null, { crit, sneak: asleep, weapon: kind, perfect, ...opt });
    // 모르고 휘두른 것: the stick answers.
    if (oddAwake('blindswing') && G.monsters.includes(m)) {
      const bolt = Math.max(2, Math.round(4 + p.lv * 0.9));
      fx({ t:'beam', fx:p.x, fy:p.y, tx:m.x, ty:m.y, color:'P' });
      hurtMonster(m, bolt, '막대 끝', { weapon:'spell' });
    }
    // 못 박는 자: pinned. Negative energy is how this game spends
    // a monster's turn for it.
    if (hasUnique('nailer') && G.monsters.includes(m)) {
      m.energy = Math.min(m.energy, -1);
      fx({ t:'snared', x:m.x, y:m.y });
      /* ③ 크랙 「그 자리에 박힌다」. 이 게임은 「쫓기면 걸어서
         떨어뜨릴 수 없다」를 가르친다(따라붙기). 이 망치는 그 줄을
         뒤집는다 — 세 번 맞은 것은 죽을 때까지 제자리다. 쫓는 쪽과
         쫓기는 쪽이 바뀐다. */
      m.nails = (m.nails || 0) + 1;
      if (m.nails === NAILED_AT) {
        m.nailed = true;
        say(`${m.n}이(가) 바닥에 박혔다. 이제 오지 못한다.`, 'level');
        fx({ t:'execute', x:m.x, y:m.y });
      }
    }
  }
  if (!G.running) return true;

  drainLife(dmg * (crit ? 0.6 : 1));
  if (g.on) poisonMonster(m, g.on);
  weaponRule(kind, m, dmg, crit);

  /* 연쇄: the swing carries into one more body. This is the line
     that turns 작열 into a chain of detonations and 흡혈 into a
     way to out-heal a whole room. */
  chainOut(m, dmg, 0);

  /* 메아리의 종. Deliberately placed last, after 연쇄 and 흡혈,
     so the second swing runs the whole chain again — a long
     streak with the right two suffixes turns one tap into a
     room-clearing cascade. That is the absurd combination this
     relic exists to make possible. */
  /* 크랙이 나면 문턱이 3으로 내려가고, **울린 것이 다시 울릴 수
     있다** — 다만 두 번까지다. 무한 재귀는 재미가 아니라 정지다. */
  const echoAt = hasRelic('march') ? relicVal('march')
               : cracked('echo') ? 3 : relicVal('echo');
  const echoDepth = cracked('echo') ? 2 : 1;
  if ((hasRelic('echo') || hasRelic('march')) && G.combo >= echoAt
      && G.monsters.includes(m) && (p.echoing || 0) < echoDepth) {
    p.echoing = (p.echoing || 0) + 1;
    fx({ t:'arc', fx:p.x, fy:p.y, tx:m.x, ty:m.y });
    say('종이 한 번 더 울렸다.', 'level');
    playerAttack(m);
    p.echoing--;
  }
  return true;
}

/* 뱃사공의 동전 doubles it, 서기의 깃펜 shaves it. One funnel so
   the two can never be applied twice or missed once. */
/* 들어온 금화가 지나가는 단 하나의 자리. 배수도 여기서만 붙고,
   「이 판이 구덩이에서 얼마나 꺼내 왔는가」도 여기서만 센다.

   ── 왜 「가진 금화」가 아니라 「번 금화」인가 ──
   빚을 끝 화면에서 「가진 금화 / 빚」으로 읽으려 했다가 물렸다.
   그러면 상점과 모루에 쓰는 것이 곧 점수를 깎는 일이 되고, 방금
   더 극단으로 만든 강화·인챈트를 쓰지 않는 쪽이 이득이 된다 —
   이야기 한 줄을 붙이려다 경제 전체를 뒤집는 셈이다.
   번 것으로 세면 쓰는 것은 여전히 공짜다. 구덩이가 네게 준 것이
   얼마인가를 세는 것이지, 네가 얼마나 아꼈나를 세는 게 아니다. */
export const goldGain = n => {
  /* 족쇄까지가 「구덩이가 내놓은 양」이고, 그 뒤의 유물 배수는
     「내가 붙인 것」이다. 크랙 장부는 앞쪽만 센다. */
  /* 탐욕의 판(×2)이 **raw 쪽에** 붙어 있었다. raw 는 크랙 장부용이고
     got 이 실제로 지갑에 들어가는 값이므로, 금화는 한 닢도 안 늘고
     **장부만 두 배**로 올라갔다 — 뱃사공의 동전·회계사의 깃펜·웃는
     가면 셋이 두 배로 빨리 열렸다. 그리고 카드가 약속한 나머지 둘
     (재료 ×2, 모루 값 ×2)도 없어서, 이 아르카나는 「상인 값 ×2」만
     남은 **순감**이었다. 벤치의 「아홉이 전부 양날」은 카드 문장만
     읽고 통과했다. 배수를 got 으로 옮긴다. */
  const raw = Math.max(0, Math.round(n * (SHACKLES[G.abyss || 0] || SHACKLES[0]).gold));
  const got = Math.max(0, Math.round(
    n * (SHACKLES[G.abyss || 0] || SHACKLES[0]).gold
      * (hasArcana('greed') ? 2 : 1)
      * (hasRelic('toll') || hasRelic('ledger') ? 2 : 1) * (hasRelic('quill') ? 0.75 : 1)
      * (hasBoon('hoard') ? 1.6 : 1)));
  G.goldEarned = (G.goldEarned || 0) + got;
  /* 원금으로 적는다. 보정 뒤 금액을 적으면 뱃사공의 동전이 자기가 두
     배로 만든 금화로 자기 문턱을 넘는다 — 실측으로 표에 적힌 순서가
     뒤집혀 있었다(quill 8000 < mask 11000 < toll 14000인데 실제
     난이도는 toll이 가장 쉽고 quill이 가장 어려웠다). 조건에 그
     유물이 한 일을 섞지 않는다. */
  ledger('gold', raw);
  return got;
};

/* Relics that pay on a kill. 굶주린 칼날 is the aggression
   engine — it out-heals a room only if you keep killing — and
   뼈 목걸이 is the slow one, worth taking early or not at all. */
function onKill(m) {
  const p = G.player;
  /* 맹세 used to spend itself down on every kill, which meant
     the better the fight went the less he had — a class that
     decelerates when it is winning. It fills on a kill now, so a
     good swing pays for the next one. */
  if (POOL[p.cls]?.onKill) poolGain(POOL[p.cls].onKill, 'kill');
  if (hasUnique('ashcount')) G.ashCount = (G.ashCount || 0) + 1;
  if (UNDEAD.includes(m.spr)) faithGain(POOL_UNDEAD, 'undead');
  feedOnKill(p);
  if (hasRelic('bone') && (cracked('bone') || (p.boneHp || 0) < 30)) {
    p.boneHp = (p.boneHp || 0) + relicVal('bone');
    recalc(p);
    p.hp += 1;
    if (p.boneHp % 10 === 0) say(`뼈 목걸이가 무거워진다. (최대 체력 +${p.boneHp})`, 'level');
  }
}

/* What the weapon does *after* the damage lands. Kept in one
   place so a new family is one case, and so 연쇄 and 작열 stack
   on top of it rather than fighting it. */
function weaponRule(kind, m, dmg, crit) {
  const p = G.player;
  if (kind === 'axe') {
    /* Cleave: the two tiles flanking the target, relative to you.
       Standing so that three bodies line up is the whole skill. */
    const dx = Math.sign(m.x - p.x), dy = Math.sign(m.y - p.y);
    const side = dx && dy ? [[dx, 0], [0, dy]] : dx ? [[dx, -1], [dx, 1]] : [[-1, dy], [1, dy]];
    const spill = Math.max(1, Math.round(dmg * 0.7));
    for (const [ox, oy] of side) {
      const o = monsterAt(p.x + ox, p.y + oy);
      if (o && o !== m && !o.disguise) {
        fx({ t:'arc', fx:m.x, fy:m.y, tx:o.x, ty:o.y });
        hurtMonster(o, spill, '휘둘러', {});
      }
    }
  } else if (kind === 'mace' && Math.random() < 0.30 && G.monsters.includes(m)) {
    // Stagger: eat the energy it had banked, so it loses its turn.
    m.energy = Math.min(m.energy || 0, 0) - 1;
    m.staggered = 2;
    say(`${m.n}이(가) 휘청인다.`, 'good');
    fx({ t:'ail', kind:'slow', x:m.x, y:m.y });
  } else if (kind === 'great' && crit) {
    // A critical with a greatsword is a room-wide event.
    const near = adjacentMonsters(p).filter(o => o !== m);
    const spill = Math.max(1, Math.round(dmg * 0.5));
    if (near.length) {
      fx({ t:'burst', x:p.x, y:p.y, r:1.8, color:'W' });
      for (const o of near) hurtMonster(o, spill, '쓸어', {});
    }
  }
}

function adjacentMonsters(from) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const m = monsterAt(from.x + dx, from.y + dy);
    if (m && !m.disguise) out.push(m);
  }
  return out;
}

/* 연쇄: the swing carries into one more body — and with 피의
   톱니 lit, that body's blow carries into the next. This one
   recursion is the whole experiment: everything else in the build
   adds into a sum and is spent once, so nothing in the game
   compounds. A branch does.

   The lifesteal was already riding along; what is new is that the
   branch can branch. */
function chainOut(m, dmg, depth) {
  const p = G.player, g = gearBonus(p);
  /* The first swing chains at whatever the build rolls. A rebound
     is priced by the resonance instead — pricing it off the base
     produced 0.07 extra hits per swing, which is not a cascade. */
  const saw = hasResonance('sawtooth');
  /* Lit, the first link is certain rather than a 0.30 roll —
     otherwise a cascade worth four hits is only ever worth 1.2,
     and the whole thing measures as a good weapon instead of as a
     run coming apart. */
  const odds = depth === 0 ? (saw && g.chain > 0 ? 1 : g.chain)
                           : CHAIN_ECHO * Math.pow(CHAIN_DECAY, depth - 1);
  if (!(odds > 0) || Math.random() >= odds) return;
  const near = adjacentMonsters(depth ? m : p).filter(o => o !== m);
  if (!near.length) return;
  const o = near[rnd(near.length)];
  const spill = Math.max(1, Math.round(dmg * (saw ? CHAIN_KEEP_RESO : CHAIN_KEEP)));
  fx({ t:'arc', fx:m.x, fy:m.y, tx:o.x, ty:o.y });
  const byC = bearerOf('chain');
  if (byC) credit('chain', `${byC}에서 튄 것이 옆의 것까지 갔다.`);
  hurtMonster(o, spill, '연쇄', {});
  drainLife(spill);
  if (saw && depth < CHAIN_MAX && G.monsters.includes(o))
    chainOut(o, spill, depth + 1);
}

/* ── 무엇이 그것을 했는가 ──────────────────────────────────
   속성 열여섯 개 중 다섯만 한 방의 숫자에 나타난다(실측: 묵직한
   +38%, 분노 +28%, 그을음 +24%, 폭풍 +19%, 갈증 +19% — 나머지 열하나는
   0%). 나머지가 약한 것이 아니라 **치명·연쇄·처형·흡혈처럼 다른
   축에서 작동하고, 그 축이 화면에 한 번도 안 나온다.** 「예리한 장검」을
   끼고 스무 번을 때려도 무엇이 달라졌는지 알 방법이 없었다.

   그래서 속성이 실제로 발동한 그 턴에, **그 물건의 이름을 부른다.**
   층마다 한 번씩만 — 매번 부르면 로그가 이 줄로 덮이고 정작 읽어야
   할 것이 밀려 나간다. 두 번째부터는 이펙트만 남는다: 한 번 배우고
   나면 필요한 것은 설명이 아니라 신호다. */
function credit(key, line) {
  G.credited = G.credited || {};
  if (G.credited[key]) return;
  G.credited[key] = 1;
  say(line, 'level');
}
/* 그 속성을 달고 있는 물건의 이름. 어느 칸에 붙어 있든 찾아서
   부른다 — 「무기가」가 아니라 「흡혈의 장검이」여야 배운 것이 된다. */
function bearerOf(prop) {
  const p = G.player;
  for (const slot of GEAR_SLOTS) {
    const it = p.equip[slot];
    if (!it) continue;
    for (const a of [it.pre && PREFIXES.find(x => x.id === it.pre),
                     it.suf && SUFFIXES.find(x => x.id === it.suf)])
      if (a && (a[prop] || 0) > 0) return affixName(it);
  }
  return null;
}

function drainLife(dmg) {
  const p = G.player, g = gearBonus(p);
  if (g.lifesteal <= 0 || p.hp >= p.maxhp) return;
  const heal = Math.max(1, Math.round(dmg * g.lifesteal));
  const got = Math.min(p.maxhp - p.hp, heal);
  if (got <= 0) return;
  p.hp += got;
  fx({ t:'drain', x:p.x, y:p.y, amt:got });
  const by = bearerOf('lifesteal');
  if (by) credit('lifesteal', `${by}이(가) 상처에서 되마신다. 체력 +${got}.`);
}

function poisonMonster(m, kind) {
  if (kind !== 'poison') return;
  m.poison = Math.max(m.poison || 0, 6 + Math.floor(G.player.lv / 3));
}

/* A health bar cut into thirds, each third doing something the
   last one did not. Crossing a threshold is announced, changes
   what the thing is, and clears its cooldown so the new shape
   arrives immediately rather than three turns later.

   The loop is a `while` on purpose: one enormous hit can carry a
   boss through two thresholds at once, and skipping the middle
   phase would quietly skip its escort too. */
function enterPhase(m) {
  if (!m.phases?.length) return;
  const frac = m.hp / Math.max(1, m.maxhp || m.hp);
  while ((m.phase || 0) < m.phases.length && frac <= m.phases[m.phase || 0].at) {
    const ph = m.phases[m.phase || 0];
    m.phase = (m.phase || 0) + 1;
    Object.assign(m, ph.set || {});
    for (const [k, v] of Object.entries(ph.add || {})) m[k] = (m[k] || 0) + v;
    m.cooling = 0; m.wind = 0; m.awake = true;
    say(`${m.n} — ${ph.n}`, 'hit');
    if (ph.say) say(ph.say, 'warn');
    fx({ t:'wake', x:m.x, y:m.y });
    fx({ t:'burst', x:m.x, y:m.y, r:2.4, color:'o' });
    fx({ t:'telegraph', urgent:true });
    /* The threshold itself is an attack: the floor goes out from
       under you the moment the bar crosses, so the punish for
       standing on top of it while burst-damaging is real. */
    if (ph.ring) castPattern(m, ph.ring);
    if (ph.summon) spawnNear(null, ph.summon, false);
  }
}

export function hurtMonster(m, dmg, source, opt = {}) {
  // 파문: a named thing stays named until it is down.
  if (m.cursed) dmg = Math.round(dmg * (1 + ANATHEMA_MORE));
  m.awake = true;
  /* You started it. From here it follows.

     Not friendly fire, though: a named thing that happens to be
     standing in another elite's 불길 has not been picked on, and
     an ogre that starts hunting you because two monsters splashed
     each other would make the leash a lie in exactly the case the
     player could not see coming. */
  if (m.named && !opt.crossfire && !m.provoked) {
    m.provoked = true;
    /* 이름 있는 것에 손을 대는 것은 지나갈 수 있었던 것을 고르는
       일이다 — 판돈을 스스로 올리는 두 번째 자리. */
    provoke(8, `${m.n}을(를) 건드렸다.`);
  }
  // Any damage at all blows a disguise — a frost blast should not
  // leave a "chest" quietly smouldering.
  if (m.disguise) {
    m.disguise = false;
    m.spr = 'mimic';
    say('상자가 이빨을 드러냈다.', 'warn');
    fx({ t:'reveal', x:m.x, y:m.y });
  }
  const before = m.hp;
  m.hp -= dmg;
  if (m.hp > 0) enterPhase(m);
  const via = source ? `${source}이(가) ` : '';

  if (m.hp <= 0) {
    /* Overkill is measured against what was actually left, so a
       finishing tap on a sliver stays quiet and a hit that erases
       a full-health troll gets the whole fireworks budget. */
    const over = clamp(-m.hp / Math.max(1, before), 0, 3);
    /* 약속: what spilled past the kill comes back. A weapon that
       rewards hitting far harder than you needed to, which is the
       opposite of every efficiency instinct the game teaches. */
    if (hasUnique('promise') && m.hp < 0) {
      const pl = G.player;
      const over = Math.round(-m.hp);
      const back = Math.min(pl.maxhp - pl.hp, over);
      if (back > 0) {
        pl.hp += back;
        fx({ t:'heal', x:pl.x, y:pl.y, amt:back });
        say(`넘친 것이 돌아왔다. 체력 +${back}.`, 'good');
      }
      /* ③ 크랙 「천장이 올라간다」. 이 게임에서 최대 체력은 내려가기만
         한다 — 상처는 아물어도 담기는 양이 줄고, 그 규칙 위에 난이도
         곡선 전체가 서 있다. 이 검은 그 줄을 부순다: 이미 가득 찬
         몸에 넘치게 때리면 **담을 수 있는 양 자체가** 자란다.
         층마다 다섯까지 — 무한이면 그건 규칙 파괴가 아니라 버그다. */
      /* 층마다 다섯까지. 얻은 몫 자체는 **영구**라 `permHp`로 들어가고
         (그래야 recalc 한 번에 안 지워진다), 여기 세는 것은 「이 층에서
         이미 얼마나 올렸나」뿐이다. 처음에 둘을 한 장부로 뒀다가
         층마다 지워 버려서 얻은 천장이 사라졌다 — 영구한 것과 이번
         층의 몫은 다른 물건이다. */
      const room = PROMISE_CAP - (G.promiseFloor || 0);
      if (back < over && room > 0) {
        const gain = Math.min(room, Math.max(1, Math.round((over - back) / 6)));
        G.promiseFloor = (G.promiseFloor || 0) + gain;
        pl.permHp = (pl.permHp || 0) + gain;
        recalc(pl);
        pl.hp = Math.min(pl.maxhp, pl.hp + gain);
        fx({ t:'levelup', x:pl.x, y:pl.y });
        say(`약속이 지켜졌다. 담을 수 있는 것이 ${gain} 늘었다.`, 'level');
      }
    }
    G.monsters.splice(G.monsters.indexOf(m), 1);
    bumpCombo(m.x, m.y);

    /* 작열: the corpse goes off. Chained kills chain detonations,
       which is the whole point of stacking it with 연쇄. */
    const g = gearBonus(G.player);
    /* 화약고 takes the guard off: a corpse that goes off can set
       off the next one. The depth cap is the only thing between
       this and a room clearing itself, and it is the reason the
       resonance needs a kill to start — losing never lights it. */
    /* The depth cap alone is not enough: a detonation catches up
       to eight bodies and each of those detonates in turn, so four
       deep is eight-to-the-fourth in the worst case. The budget is
       counted per player action rather than per chain, so one
       swing can set off at most POWDER_BUDGET explosions no matter
       how they branch. */
    const room = hasResonance('powder');
    if (room && (opt.blast || 0) === 0) G.powderSpent = 0;
    /* The gear's 작열 and an ember arrow are the same rule from
       two pockets. Reading only the gear meant an ember arrow
       carried a `burst` field that nothing ever looked at. */
    const burstRate = g.burst + (opt.burst || 0);
    if (burstRate > 0 && (room ? ((opt.blast || 0) < POWDER_MAX
                                && (G.powderSpent || 0) < POWDER_BUDGET)
                             : !opt.noBurst)) {
      /* Normally a corpse goes off for a share of what it was, so
         a room of weak things makes weak bangs and 작열 does
         nothing for a build that has outgrown the floor. 화약고
         loads the killing blow into the corpse instead: the
         explosion is worth whatever your swing was worth, which
         is what makes the second one able to kill and the third
         one able to happen at all. */
      const charge = room ? Math.max(m.maxhp || 10, dmg) : (m.maxhp || 10);
      const blast = Math.max(2, Math.round(charge * burstRate * (room ? 0.7 : 0.5)));
      const caught = adjacentMonsters(m);
      if (caught.length) {
        fx({ t:'burst', x:m.x, y:m.y, r: room ? 2.4 : 1.9, color:'o' });
        if (room) G.powderSpent = (G.powderSpent || 0) + 1;
        for (const o of caught)
          hurtMonster(o, blast, '폭발', room ? { blast: (opt.blast || 0) + 1 } : { noBurst: true });
      }
    }
    fx({ t:'kill', x:m.x, y:m.y, spr:m.spr, dmg, crit:!!opt.crit, over, boss:!!m.boss, combo:G.combo });
    G.kills = (G.kills || 0) + 1;
    ledger('kill');
    if (m.elite?.length || m.boss) ledger('elite');
    quarry(m);
    /* 밀려오는 판 — 아래에서 밀려 올라오는 것들은 손에 무언가를 쥐고
       온다. 파도가 두 배로 빨리 오는 값이 이것이다. */
    if (m.rich) for (let i = 1; i < m.rich; i++) dropFromProp(m.x, m.y, 1, true);
    /* One more body in the ledger. The count is what buys the
       tells — a monster you have met is in the codex, a monster
       you have killed five of tells you how it fights. */
    if (Meta.slew(m.n) === tellsNeeded(Meta.read()))
      say(`${m.n}의 버릇이 눈에 익었다 — 도감에 적힌다.`, 'level');
    say(`${pickLine(FELLED, m.n, nextLine())}. (+${m.xp} 경험치)`, 'good');
    if (m.thief) {
      const who = G.player;
      const purse = thiefPurse(G.depth);
      /* goldGain 은 순수 함수가 아니다 — 안에서 장부에 적고
         goldEarned 를 올린다. 더할 때 한 번, 문장에 찍을 때 또 한 번
         불러서 **부작용이 두 번 실행되고 있었다**(장부·번 돈이 두 배).
         한 번 부르고 그 값을 쓴다. */
      const got = goldGain(purse.gold);
      who.gold += got;
      who.mats = who.mats || { scrap: 0, dust: 0, essence: 0 };
      for (const k of ['scrap', 'dust', 'essence']) who.mats[k] += purse[k] || 0;
      say(`자루가 터졌다 — 금화 ${got}닢과 재료가 쏟아진다.`, 'level');
      fx({ t:'altar', x:m.x, y:m.y, result:'대성공' });
    }
    /* 일으켜 세운 앞사람. 쓰러뜨리면 그가 남긴 것을 **전부** 준다 —
       그게 이 도박의 값이다. 하나만 집을 수도 있었는데 전부를 걸었다. */
    if (m.drops) {
      const rec = m.drops;
      if (rec.weapon) {
        G.items.push({ ...rec.weapon, x:m.x, y:m.y });
        fx({ t:'drop', x:m.x, y:m.y, rar: rarityOf(rec.weapon) });
      }
      if (rec.gold) { G.player.gold += rec.gold; G.goldEarned = (G.goldEarned || 0) + rec.gold; ledger('gold', rec.gold); }
      if (rec.relic) {
        const at = freeSpotNear(m.x, m.y);
        if (at) { G.items.push({ kind:'relic', id:rec.relic, spr: relicById(rec.relic).spr,
                               n: relicById(rec.relic).n, ...at });
          relicFrom('앞선자'); }
      }
      say(`${rec.sent}번째가 다시 누웠다. 남긴 것을 전부 거뒀다.`, 'level');
    }
    if (m.hasKey && G.task && !G.taskDone) {
      G.taskDone = true;
      say(G.task.done, 'level');
      fx({ t:'drop', x:m.x, y:m.y, rar:3 });
    }
    if (m.named) {
      const id = unownedRelic();
      if (id) {
        G.items.push({ kind:'relic', id, spr: relicById(id).spr, n: relicById(id).n, x:m.x, y:m.y });
        relicFrom('이름있는것');
        say(`${relicById(id).n}이(가) 남았다.`, 'level');
        fx({ t:'drop', x:m.x, y:m.y, relic:true, rar:3 });
      }
      dropElite(m);
    } else if (m.elite?.length) dropElite(m);
    onKill(m);
    gainXp(Math.round(m.xp * (G.branch?.xp || 1) * uproarMult()));
    /* 소란이 붙어 있을 때만 시체에서 더 나온다. 경험치만 부풀리면
       보상이 레벨업까지 미뤄지고, 미뤄진 보상은 위험을 살 이유가
       되지 못한다 — 걸었으면 그 자리에서 받아야 건 것 같다. */
    const spoil = Math.round(m.xp * 2.2 * (uproarMult() - 1));
    if (spoil > 0) {
      const got = goldGain(spoil);
      G.player.gold += got;
      if (got >= 3) say(`소란 속에서 ${got}닢을 주웠다.`, 'good');
    }
    if (m.boss) victory();
  } else {
    if (G.floorTally) G.floorTally.dealt += dmg;
    /* 성흔. 맞은 것 곁으로 같은 매가 번진다 — 사제가 「어디에
       새길까」를 고민하게 만드는 유일한 줄이라, 번지는 몫이 여기
       한 곳에서만 정해진다. */
    if (m.stigma > 0 && !opt.stigma) {
      const share = Math.max(1, Math.round(dmg * STIGMA_SPLASH));
      for (const o of G.monsters.slice()) {
        if (o === m || o.disguise) continue;
        if (Math.hypot(o.x - m.x, o.y - m.y) > STIGMA_RANGE) continue;
        hurtMonster(o, share, '성흔', { stigma: true, pierce: true });
      }
      fx({ t:'stigmaBurst', x:m.x, y:m.y, r:STIGMA_RANGE });
    }
    fx({ t:'hit', on:'monster', x:m.x, y:m.y, dmg, crit:!!opt.crit, sneak:!!opt.sneak,
         weapon: opt.weapon, spr:m.spr });
    if (!opt.quiet) {
      const tag = opt.sneak ? ' 기습!' : opt.crit ? ' 치명타!' : '';
      /* The verb comes from the weapon and the swing from how much
         of the thing went. `via` is the odd case — a chain, a
         thorn, a burst — and it names itself, so it keeps the
         plain sentence rather than borrowing a sword's. */
      const line = opt.weapon
        ? `${via}${strikeLine(opt.weapon, m.n, dmg, m.maxhp || m.hp + dmg, nextLine())} (${dmg})`
        : `${via}${m.n}에게 ${dmg}의 피해.`;
      say(line + tag, opt.crit ? 'level' : 'hit');
    }
  }
}

/* Relics never repeat within a run — a second 뼈 목걸이 is not a
   choice, it is filler. */
/* 유물이 어디서 나오는지를 판마다 센다. 「너무 많이 나온다」를 고치려면
   먼저 **어디서** 나오는지를 알아야 하는데, 정예 낙하 확률을 절반 이하로
   내려도 층당 개수가 0.85에서 0.83으로밖에 안 떨어졌다 — 정예가 주범이
   아니었다는 뜻이고, 그걸 모른 채로 숫자를 더 깎았으면 엉뚱한 손잡이만
   부러뜨렸을 것이다. */
export function relicFrom(src) {
  G.relicSrc = G.relicSrc || {};
  G.relicSrc[src] = (G.relicSrc[src] || 0) + 1;
}

export function unownedRelic() {
  const held = new Set(G.player?.relics || []);
  // Fused relics are never on a floor and never in a shop. The
  // fire is the only door.
  /* 전설(myth)은 8층 아래에서만 나오고, 나와도 넷 중 하나꼴이다.
     판을 바꾸는 물건이 첫 층에서 굴러다니면 그 판은 이미 끝난 것이다. */
  const pool = RELICS.filter(r => !held.has(r.id) && !r.fused
    && (!r.myth || G.depth >= 8));
  if (!pool.length) return null;
  /* ── 짝을 맞춰 준다 ─────────────────────────────────────
     융합은 유물 **둘을 동시에** 들고 있어야 일어난다. 마흔 종에서
     짝이 여섯 쌍이니, 손에 다섯을 들고 있어도 짝이 맞을 확률은
     사실상 없다 — 서른 판을 돌려서 융합이 0번 일어났다. 그래서
     융합은 설계가 아니라 전설이었다.

     유물 수를 줄이면서 이걸 그대로 두면 영영 못 본다. 그래서 이미
     한쪽을 들고 있으면, 나오는 유물이 **나머지 한쪽일 확률을 크게
     올린다.** 개수가 아니라 적중률로 조합을 만든다 — 그리고 이건
     플레이어에게 「이 유물을 들고 있으면 짝이 온다」는, 들고 다닐
     이유를 준다.

     확실하게는 안 한다. 확실하면 그건 조합이 아니라 진행이다. */
  if (held.size) {
    const wanted = [];
    for (const f of FUSIONS) {
      if (held.has(f.a) && !held.has(f.b) && pool.some(r => r.id === f.b)) wanted.push(f.b);
      if (held.has(f.b) && !held.has(f.a) && pool.some(r => r.id === f.a)) wanted.push(f.a);
    }
    if (wanted.length && Math.random() < FUSE_PULL) return wanted[rnd(wanted.length)];
  }
  for (let guard = 0; guard < 12; guard++) {
    const r = pool[rnd(pool.length)];
    if (!r.myth || Math.random() < 0.25) return r.id;
  }
  return pool.find(r => !r.myth)?.id || pool[0].id;
}

/* An elite always leaves something with a name on it — and one
   in five leaves the thing that changes the run instead. */
/* 바로 옆의 빈 칸. 같은 칸에 둘을 겹치면 하나가 영영 안 주워진다. */
function freeSpotNear(x, y) {
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
    const nx = x + dx, ny = y + dy;
    if (G.level.solid(nx, ny)) continue;
    if (G.items.some(o => o.x === nx && o.y === ny)) continue;
    return { x: nx, y: ny };
  }
  return null;
}

function dropElite(m) {
  const spot = { x: m.x, y: m.y };
  /* 소란이 클수록 좋은 것이 나온다. 위험을 산 값을 여기서 치른다 —
     경험치만 부풀리면 「많이 싸우면 레벨이 는다」는 당연한 소리지,
     걸었다는 느낌이 아니다. */
  /* 0.22 → 0.34로 올렸다가, 재 보고 0.15로 내렸다.

     올린 이유는 맞았다(한 판에 서넛으로는 「고르는 물건」이 안 된다).
     그런데 sim/drops.mjs로 오래 사는 판을 재 보니 층당 0.85개가
     나오고 있었다 — 열다섯 층이면 열두 개, 유물 표 마흔 종의 30%를
     한 판에 본다. 규칙을 바꾸는 물건이 그 정도로 나오면 그건 규칙을
     바꾸는 물건이 아니라 그냥 장비다.

     대신 나오는 것이 **쓸모 있을** 확률을 올렸다(unownedRelic).
     개수를 줄이고 적중률을 올리는 쪽이, 개수로 밀어붙이는 것보다
     「고르는 물건」에 가깝다. */
  /* ── 층당 하나 ────────────────────────────────────────
     확률만 깎아서는 안 된다는 것을 재고 나서 알았다. 0.34에서 0.15로
     내렸는데 층당 개수가 0.85에서 0.83으로밖에 안 떨어졌다 — 오래
     사는 판은 한 판에 정예를 서른 마리씩 잡으므로, 한 마리당 확률을
     반으로 깎아도 서른 번 굴리면 그대로 나온다. 곱셈을 확률로 이기려
     한 것이다.

     그래서 **층마다 하나**로 잠근다. 많이 싸운 사람이 더 갖는 것은
     맞지만, 그것은 금화와 재료로 갚아야지 규칙을 바꾸는 물건으로
     갚을 것이 아니다. 그리고 이 편이 층 하나하나에 「여기서 하나
     나왔나」라는 상태를 만든다. */
  const gotHere = G.relicFloorAt === G.depth;
  if (!gotHere && Math.random() < 0.30 * uproarMult()) {
    const id = unownedRelic();
    if (id) {
      G.items.push({ kind:'relic', id, spr: relicById(id).spr, n: relicById(id).n, ...spot });
      G.relicFloorAt = G.depth;
      relicFrom('정예');
      say(`${relicById(id).n}이(가) 굴러떨어졌다.`, 'level');
      fx({ t:'drop', x: spot.x, y: spot.y, relic:true, rar:3 });
      /* 대박. 아주 드물게 둘이 나온다 — 유물 자리가 일곱까지 늘어나는
         판에서, 한 번에 둘은 그 판의 방향을 정해 버린다. */
      if (Math.random() < JACKPOT.relic) {
        const two = unownedRelic();
        const at = freeSpotNear(spot.x, spot.y);
        if (two && at) {
          G.items.push({ kind:'relic', id: two, spr: relicById(two).spr, n: relicById(two).n, ...at });
          relicFrom('대박');
          say('— 하나가 아니었다.', 'level');
          fx({ t:'drop', x: at.x, y: at.y, relic:true, rar:4 });
        }
      }
      return;
    }
  }
  /* ── 셋을 남기고, 하나를 고르게 한다 ──────────────────
     여태 정예는 물건 하나를 떨어뜨렸다. 좋으면 끼우고 아니면
     지나치는데, 그건 결정이 아니라 통보다. 파밍이 재미없다는
     말의 절반이 여기 있었다.

     셋을 굴려 놓고 하나만 가져가게 하면, 나머지 둘이 값이 된다 —
     피해가 큰 것과 속성이 좋은 것 사이에서 고르는 순간이 곧
     「이 판을 어떻게 끌고 갈까」다. 굴림은 여기서 끝내 놓는다.
     화면을 열 때마다 다시 굴리면, 열었다 닫았다 하는 것이 수가
     된다 — 그건 고르는 게 아니라 재굴림이다. */
  const picks = [];
  for (let i = 0; i < SPOIL_PICKS; i++) {
    const it = pickItem(G.depth + 4);
    if (!it) continue;
    rollAffixes(it, G.depth + 8, true);
    if (Math.random() < 0.45) it.plus = 1 + rnd(2);
    /* 대박은 여기서도 열린다 — 셋 중 하나가 훨씬 깊은 곳의 물건일
       때가 있다. 자주 열리면 그건 대박이 아니라 기본값이다. */
    if (Math.random() < JACKPOT.spoil) {
      const deep = pickItem(G.depth + 20);
      if (deep) {
        rollAffixes(deep, G.depth + 30, true);
        deep.plus = 2 + rnd(3);
        picks.push(deep);
        continue;
      }
    }
    picks.push(it);
  }
  if (!picks.length) return;
  if (picks.length === 1) {
    G.items.push({ ...picks[0], ...spot });
    fx({ t:'drop', x: spot.x, y: spot.y, rar: rarityOf(picks[0]) });
    return;
  }
  const best = Math.max(...picks.map(rarityOf));
  G.items.push({ kind:'spoils', spr:'chest', n:'전리품 더미', picks, rar: best, ...spot });
  fx({ t:'drop', x: spot.x, y: spot.y, rar: best, pile:true });
}

function gainXp(n) {
  const p = G.player;
  p.xp += Math.round(n / RACES[p.race].xp);
  while (p.lv < MAX_LEVEL && p.xp >= xpToLevel(p.lv)) {
    p.lv++;
    const before = p.maxhp;
    recalc(p);
    p.hp += p.maxhp - before;
    p.mana = p.maxmana;
    /* A milestone level is announced as one, with the number the
       player actually gained — the point of moving growth into
       steps is lost if the steps are silent. */
    const gain = p.maxhp - before;
    const milestone = p.lv % 3 === 0;
    fx({ t:'levelup', x:p.x, y:p.y, big: milestone });
    say(milestone
      ? `레벨 ${p.lv}. 뼈가 굵어졌다 — 최대 체력 +${gain}.`
      : `레벨 ${p.lv}. 몸이 단단해진다. (체력 +${gain})`, 'level');
    const learned = spellList(p).filter(s => s.lv === p.lv);
    /* 주문은 `name`을 쓴다 — 물건만 `n`이다. 여기 한 줄이 `s.n`이라
       마법사·사제·성기사가 주문을 배울 때마다 「새 주문을 익혔다 —
       undefined」가 나가고 있었다. 판당 여덟 번씩. */
    for (const s of learned) say(`새 주문을 익혔다 — ${s.name}`, 'level');
  }
}

/* ── the fork ─────────────────────────────────────────────
   Two staircases, both described in advance. This is where a
   run stops being a straight line: the same character comes out
   of floor 9 rich and fragile or poor and armoured depending on
   six of these. Every branch that gives also takes, or it is not
   a choice — it is a reward.

   The town and the boss floor get no fork: one has nothing to
   trade and the other is not a place you pick your way into. */

/* ── 판을 파일로 꺼낸다 ────────────────────────────────────
   플레이어: 「플레이 로그 파일로 추출할 수 있는 기능 만들어라.
   그걸 토대로 니가 리뷰하는 게 낫겠다. 봇으로 재현하지 말고.」

   맞는 말이다. 이 저장소가 이번 세션에 저지른 측정 실수의 절반은
   **봇으로 사람을 흉내 내다** 난 것이다 — 봇은 5층에서 죽는데 사람은
   15층을 클리어하고, 그 간극을 손으로 세운 영웅으로 메우려다 곡선을
   틀리게 잡았다(POWER_STEP 1.45). 사람의 판이 파일로 나오면 그 자리가
   통째로 없어진다.

   무엇을 적는가: **판정에 쓸 수 있는 것만.** 매 턴을 적으면 3554턴
   짜리 판이 메가바이트가 되고, 읽는 쪽도 못 읽는다. 그래서 층을
   단위로 접고, 층 안에서는 「사건」만 남긴다.

     · 층에 들어설 때  — 깊이·주목·전투력/기대치·몬스터·깨어 있는 수·
                        층의 여유·갈래·이물·아르카나
     · 층을 나갈 때    — 쓴 턴·최저 체력·받은 피해·준 피해·물약·
                        쓴 기예 목록·파도 수
     · 그 사이의 사건  — 유물/아르카나/이물/모루/상인/죽을 뻔한 순간

   game.js 안에 두는 이유: 이건 규칙이 아는 사실이고, 화면은 그것을
   파일로 떨어뜨리기만 한다(ui.js). 헤드리스에서도 그대로 쌓인다. */
export const LOG_VERSION = 1;
const logNow = () => ({ turn: G.turn || 0, depth: G.depth || 0 });
export function trace(kind, data) {
  if (!G.trace) return;
  G.trace.push({ ...logNow(), k: kind, ...data });
  /* 한 판이 아무리 길어도 이만큼이면 층마다 수백 개다. 넘치면 앞을
     버린다 — 끝이 더 궁금하다. */
  if (G.trace.length > 4000) G.trace.splice(0, 500);
}
/* 층 하나를 요약해 닫는다. 다음 층에 들어서기 직전에 불린다. */
function traceCloseFloor() {
  const f = G.floorTally;
  if (!f || !G.trace) return;
  trace('floor.out', { turns: G.floorTurn || 0, budget: floorBudget(),
                       lowHp: f.lowHp, took: f.took, dealt: f.dealt,
                       gulps: f.gulps, waves: G.waves || 0,
                       arts: Object.entries(f.arts).map(([k, v]) => `${k}×${v}`),
                       pool: Object.entries(f.pool || {}).map(([k, v]) => `${k}×${v}`) });
  G.floorTally = null;
}
function traceOpenFloor(depth) {
  if (!G.trace) return;
  const p = G.player;
  /* pool: 이 층에서 통에 무엇이 얼마나 들어왔는지 출처별로. 「기예를
     너무 많이 쓴다」를 봤을 때 원인이 시계인지 맞은 것인지 재운 것인지
     구분할 자리가 없어서 한 번 헛짚었다 — 세는 자리를 만들어 둔다. */
  G.floorTally = { lowHp: p ? p.hp : 0, took: 0, dealt: 0, gulps: 0, arts: {}, pool: {} };
  const awake = G.monsters.filter(m => m.awake).length;
  trace('floor.in', {
    heat: G.heat || 0,
    power: Math.round(powerOf()), want: Math.round(expectedPower(depth)),
    ratio: +(powerOf() / Math.max(1, expectedPower(depth))).toFixed(2),
    hp: p ? `${p.hp}/${p.maxhp}` : '', lv: p?.lv || 0, gold: p?.gold || 0,
    mons: G.monsters.length, awake, elite: G.monsters.filter(m => m.elite?.length).length,
    budget: floorBudget(), branch: G.branch?.id || 'plain',
    strange: G.strange || null, arcana: [...(G.arcana || [])],
    relics: [...(p?.relics || [])],
    gear: ['weapon', 'body', 'shield'].map(k => p?.equip?.[k])
      .filter(Boolean).map(it => `${affixName(it)}${it.plus ? `+${it.plus}` : ''}`),
  });
}
/* 판 전체를 사람이 읽고 내가 재는 한 덩어리로. */
export function traceDump() {
  const p = G.player;
  return {
    v: LOG_VERSION, build: BUILD, saveFormat: SAVE_FORMAT,
    race: p?.race, cls: p?.cls, lv: p?.lv || 0,
    deepest: G.deepest || 0, turns: G.turn || 0,
    ending: G.ending ? { win: !!G.ending.win, by: G.ending.by || null } : null,
    kills: G.kills || 0, bestCombo: G.bestCombo || 0,
    relics: [...(p?.relics || [])], arcana: [...(G.arcana || [])],
    strangeSeen: [...(G.strangeSeen || [])],
    plus: ['weapon', 'body', 'shield'].reduce((n, k) => n + (p?.equip?.[k]?.plus || 0), 0),
    events: G.trace || [],
  };
}

export function descend() {
  const L = G.level, p = G.player;
  if (L.tiles[idx(p.x, p.y)] !== DOWN) { say('여기엔 내려가는 계단이 없다.'); return; }
  const shut = stairsLocked();
  if (shut) {
    /* 문을 흔드는 것도 행동이다 — 턴을 태운다. 안 태우면 인내심
       시계가 영영 안 돌고, 계단에 서서 버튼만 누르는 판이 갇힌다.
       실제로 40판에 한 판이 그렇게 막혔다(정직 벤치가 잡았다).
       잠긴 계단은 「기다리면 열린다」여야지 「여기서 끝」이면 안 된다. */
    say(shut.shut[lockStage()] || shut.intro, 'warn');
    /* 눌렸다는 촉감이 없으면 「고장」으로 읽힌다. 모바일에서 밝게 켜진
       버튼을 눌렀는데 화면이 안 변하면 사람은 거의 언제나 버그로
       판단한다 — 그리고 여기서는 누를 때마다 한 턴이 탄다. 흔든다. */
    fx({ t:'lock', x:p.x, y:p.y });
    endTurn();
    return;
  }
  if (G.depth >= MAX_DEPTH) { say('이 아래로는 아무것도 없다.'); return; }
  if (G.depth + 1 >= MAX_DEPTH || G.depth === 0) { takeStairs(BRANCHES[0]); return; }

  const pool = BRANCHES.slice(1).filter(b => !(b.id === 'rush' && G.depth < 3));
  const a = pool.splice(rnd(pool.length), 1)[0];
  const b = pool.splice(rnd(pool.length), 1)[0];
  // Plain is always on the table. A fork with no safe road is a
  // toll, not a decision.
  G.pendingBranch = [BRANCHES[0], a, b].slice(0, 3);
  G.screen = 'stairs';
}

export function chooseBranch(id) {
  const b = BRANCHES.find(x => x.id === id) || BRANCHES[0];
  G.pendingBranch = null;
  G.screen = 'play';
  takeStairs(b);
}

function takeStairs(branch) {
  Meta.see('branches', branch.id);
  enterDepth(G.depth + 1, false, branch);
  say(G.depth === MAX_DEPTH ? '공기가 뜨겁다. 무언가 커다란 것이 숨쉬고 있다.'
                            : `던전 ${G.depth}층 — ${branch.n}.`, 'warn');
  endTurn(true);
}

/* ── 올라가는 길은 없다 ────────────────────────────────────
   이 게임은 아래로 파는 게임이다. 그런데 올라갈 수 있으면, 아무리
   잘 만든 야영지라도 플레이어는 곧 계산을 한다 — 세 층을 되짚어
   올라가 물약을 사고 다시 세 층을 내려오는 것이 이득인가. 이득이면
   그 왕복이 최적 플레이가 되고, 판의 상당 부분이 「이미 지나온
   빈 층을 다시 걷는 것」으로 채워진다. 이득이 아니면 계단은 그냥
   눌리지 않는 버튼이다. 어느 쪽이든 자리값을 못 한다.

   그래서 내려온 구멍은 닫힌다. 아래에서 만나는 모닥불·행상인·모루가
   유일한 보급이 되고, 「지금 살까 말까」가 진짜 결정이 된다.

   그리고 이것이 이 게임의 이야기이기도 하다. 도르래는 내려보내는
   데만 쓴다 — 지금까지 그것으로 올라온 사람이 없었으므로, 아무도
   올리는 쪽을 만들어 두지 않았다. */
export function ascend() {
  say(`올라가는 길은 없다. 도르래는 ${G.sent}번을 내려보냈고 한 번도 감아 올린 적이 없다.`, 'warn');
}

export function endTurn(skipMonsters = false) {
  const p = G.player;
  G.turn++;
  /* 한 턴이 무엇이었는지 여기 한 곳에서만 센다. 행동이 자기 이름을
     남기지 않았으면 그 턴은 걷기다. 콘텐츠가 몇 %나 닿는지는 이미
     쟀고(reach.mjs) 96%였다 — 그런데도 재미가 없었으니, 남은 질문은
     「무엇이 있는가」가 아니라 「무엇을 하며 시간을 보내는가」다.
     sim/turns.mjs가 이 한 줄만 읽는다. */
  const kind = G.act || 'walk';
  (G.did || (G.did = {}))[kind] = (G.did[kind] || 0) + 1;
  /* 걷기가 다 같은 걷기는 아니다. 스톤수프도 걷는 턴이 대부분이지만
     그 걷기는 「보이는 위협 앞에서의 걷기」다. 그래서 걷는 동안 적이
     하나라도 눈에 있었는지를 따로 센다 — 이 둘의 차이가 곧 긴장이다. */
  if (kind === 'walk' && G.level) {
    const watched = G.monsters.some(m => G.level.vis[idx(m.x, m.y)]);
    if (watched) G.did.walkSeen = (G.did.walkSeen || 0) + 1;
  }
  /* 빛도 같은 자리에서 센다. 「횃불이 있다」와 「횃불이 문다」는 다르고,
     후자는 어느 반경에서 얼마나 오래 있었는지로만 알 수 있다.
     sim/oil.mjs가 이 줄을 읽는다. */
  if (G.depth > 0) {
    const band = lightRadiusOf(p);
    (G.lit || (G.lit = {}))[band] = (G.lit[band] || 0) + 1;
    hint('near');
    stirUproar();
    /* 체력이 판 내내 어디에 있었는가. 「죽기 5턴 전에 68%」라는 것은
       판의 대부분을 멀쩡하게 걸었다는 뜻이고, 멀쩡하면 긴장이 없다.
       sim/tension.mjs가 이 줄을 읽는다. */
    const hpTenth = Math.min(9, Math.floor(Math.max(0, p.hp) / p.maxhp * 10));
    (G.hpBand || (G.hpBand = new Array(10).fill(0)))[hpTenth]++;
    G.floorTurns = G.floorTurns || {};
    G.floorTurns[G.depth] = (G.floorTurns[G.depth] || 0) + 1;
  }
  G.act = null;
  /* How long you have not moved. Cheap to keep and the only
     thing 소리 없는 강철 needs — armour that hides you while you
     hold still has to know when you are holding still. */
  if (p.x === p._wasX && p.y === p._wasY) p.stillFor = (p.stillFor || 0) + 1;
  else p.stillFor = 0;
  p._wasX = p.x; p._wasY = p.y;

  if (p.blessed > 0) p.blessed--;
  if (p.might > 0 && --p.might === 0) say('끓던 피가 식는다.');
  if (p.iron > 0 && --p.iron === 0) say('굳었던 살갗이 풀린다.');
  if (p.brace > 0 && --p.brace === 0) say('발을 뗀다. 다시 움직일 수 있다.');
  if (p.bulwark > 0 && --p.bulwark === 0) say('맹세가 물러난다.');
  for (const m of G.monsters) if (m.pinned > 0) m.pinned--;
  /* 성흔과 경외는 턴을 먹는다 — 둘 다 「몇 턴짜리」가 값의 전부라,
     같은 자리에서 같이 준다. */
  for (const m of G.monsters) {
    if (m.stigma > 0) m.stigma--;
    if (m.awed > 0) m.awed--;
  }
  if (G.sanctum && --G.sanctum.left <= 0) { G.sanctum = null; say('빛이 스러졌다.'); }
  if (G.smoke && --G.smoke.left <= 0) { G.smoke = null; say('연기가 걷힌다.'); }
  if (p.martyr > 0 && --p.martyr === 0) {
    const owed = Math.round(p.martyrDebt || 0);
    p.martyrDebt = 0;
    if (owed > 0) {
      say(`빚이 한꺼번에 왔다. (−${owed})`, 'bad');
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg:owed, who:'순교', severe:true });
      hurtPlayer(owed, { by:'스스로 진 빚' });
      if (!G.running) return;
    } else say('일어섰다. 빚은 없었다.', 'good');
  }
  /* ③ 심연의 눈·눈먼 예언자의 크랙. 새 표시 경로를 만들지 않고
     이미 있는 깔때기를 매 턴 되살린다 — 그리는 쪽은 「감지 중」
     하나만 알면 된다. */
  if (cracked('eye') || cracked('oracle')) G.detectPulse = 2;
  if (G.detectPulse > 0) G.detectPulse--;

  if (G.comboT > 0 && --G.comboT === 0) breakCombo(true);
  /* ── 무게 ────────────────────────────────────────────────
     스무 칸을 꽉 채워도 아무 일이 없었다. 그러면 줍는 것은 결정이
     아니라 습관이고, 파밍은 「보이면 줍는다」가 된다. 이제 짐이
     무거우면 숨이 늦게 돌아오고, 더 무거우면 손이 굼떠 기름이
     빨리 탄다 — 무엇을 버릴지가 수가 된다. */
  const loadRate = stamEvery(p) * (packLoad(p) >= HEAVY_AT ? 2 : 1);
  if (G.turn % loadRate === 0) poolGain(1, 'clock');

  if (G.depth > 0) {
    /* One upkeep resource, not two. Food and torches were the
       same countdown wearing different hats, and with 15 floors
       neither ever ran out — two numbers to babysit that decided
       nothing. Light survives because it is *spatial*: it changes
       how far you can see, which changes what you can fight. */
    /* Integer only. A fractional drain reads fine in a total and
       then quietly breaks every `lightTurns === 300` milestone and
       the torch chip, which counts whole turns. 굶주린 불 spends
       its extra thirty percent as three whole turns in every ten
       rather than as 0.3 of a turn each time. */
    /* 깊을수록 어둠이 짙다. 한 턴에 1을 태우던 시절, 판의 90%를
       가장 밝은 반경에서 보냈고 불이 꺼지는 판은 48판 중 1판이었다
       (sim/oil.mjs). 보급이 소모를 앞질렀다는 뜻이고, 그러면 그것은
       시계가 아니라 장식이다. 깊이로 태우면 초반은 그대로 관대하고
       후반에만 조여든다 — 위협이 커지는 곳에서 시야가 좁아진다. */
    if (!hasRelic('lamp'))
      p.lightTurns -= (G.branch?.drain || 1) * OIL_BURN(G.depth)
        * (packLoad(p) >= LADEN_AT ? 2 : 1)
        * (hasArcana('dark') ? 2 : 1)
        * (hasRelic('famine') ? 3 : hasRelic('hunger') && !cracked('hunger') ? 2 : 1)
        + (hasShackle('hunger') && G.turn % 10 < 3 ? 1 : 0);
    if (p.lightTurns === 640) say('불빛이 한 뼘 줄었다. 벽이 가까워진 것은 아니다.', 'warn');
    if (p.lightTurns === 360) say('기름이 절반쯤 남았다.', 'warn');
    if (p.lightTurns === 180) say('빛이 팔 길이만큼만 간다.', 'warn');
    if (p.lightTurns === 60)  say('불빛이 손바닥만큼 줄었다. 여기서부터는 듣고 걷는다.', 'warn');
    /* 이 줄은 이미 「불이 꺼지면 무엇을 잃는가」를 말하는 자리인데, 잃는
     것 중 **가장 비싼 것**을 안 세고 있었다. 「팔을 당긴다」는 이 게임이
     이미 heavy 예고를 부르는 말이라(data.js의 mark: /팔을 당긴다/),
     그대로 부정형으로 쓰면 설명이 아니라 같은 목소리의 연장이 된다. */
  if (p.lightTurns === 0)
    say('불이 꺼졌다. 두 칸 앞이 벽인지 아닌지도, 저것이 팔을 당겼는지도 모른다.', 'hit');
    if (p.lightTurns < 0) p.lightTurns = 0;
    G.floorTurn++;
    pressure();
  }

  tickAilments(p);
  if (!G.running) return;

  /* Natural recovery is the only healing that scales with the
     hero, and it was flat enough to be decorative: two points
     every fourteen turns against a hundred and fifty of health.
     Clearing a floor cost far more than the floor gave back, so
     runs ended by attrition on floor four or five regardless of
     how well any single fight went.

     This does bring resting-to-heal back as a tactic — which is
     exactly what the floor clock is there to price. The two
     systems check each other. */
  const regen = Math.max(0, Math.round((1 + Math.floor(p.lv / 4) + gearBonus(p).regen)
    * (raceRule(p, 'regenX') || 1)));
  /* 체질 sets how often the body closes, not only how much it
     holds. 8 turns at 10 con, 5 at 18, 12 at 5 — a dumped
     constitution is felt between fights as well as inside one. */
  const beat = clamp(8 - statB(p, 'con'), 4, 14);
  /* Measured: a hundred turns of walking handed back forty to
     fifty percent of maximum health, at every level. A floor is
     one to two hundred turns, so clearing one was a free full
     heal and attrition stopped being a resource — the clock was
     the only pressure left in the game.

     The answer is not a smaller number. Making it smaller brings
     back the floor-four death spiral this was added to fix. What
     changes is its *character*: it is catching your breath, not
     medicine. So it does nothing while something is hitting you,
     and it closes a wound only so far. Past that line the wound
     is real and costs a flask, a fire, or a prayer — which is
     what those are for. */
  /* 트롤만 이 문턱이 없다. 「상처가 저절로 아문다」가 여태 회복량 +1
     하나였는데, 그 회복은 **열 턴을 안 맞아야** 돌기 시작하므로 정작
     싸우는 동안에는 한 번도 안 돌았다 — 설명이 약속한 것을 코드가 안
     지킨 자리다. */
  const rested = raceRule(p, 'regenInFight') || G.turn - (p.hurtAt ?? -99) >= BREATH;
  /* 여명의 맹세 takes the ceiling off. It is the whole payout of a
     build that adds nothing at all to what you hit for. */
  const roof = hasResonance('dawnoath') ? p.maxhp
             : Math.round(p.maxhp * breathRoof(p));
  if (rested && G.turn % beat === 0 && p.hp < roof)
    p.hp = Math.min(roof, p.hp + regen);
  // 응답: the priest closes on his own, twice as often as anyone,
  // and past the line everyone else stops at. That is the class.
  if (p.cls === 'priest' && rested && G.turn % 6 === 0 && p.hp < p.maxhp)
    p.hp = Math.min(p.maxhp, p.hp + Math.max(1, Math.round(regen * healScale())));
  if (p.maxmana && G.turn % manaEvery(p) === 0 && p.mana < p.maxmana)
    p.mana = Math.min(p.maxmana, p.mana + 1);

  /* 그림자, the slow way: time spent with nothing awake looking at
     you. The two fast ways (an ambush, a roll) are things you do;
     this is what pays the approach the stealth stat exists for. */
  /* 그림자, 느린 쪽: 깨어 있는 것 누구의 시선에도 안 걸린 채 보낸
     시간. 빠른 둘(기습·구르기)은 **하는 것**이고 이쪽은 은신 능력치가
     존재하는 이유다. 이제 통이 하나라 이 한 줄이 곧 재장전이다. */
  const hush = POOL[p.cls]?.unseenEvery;
  if (hush && G.turn % hush === 0 && unseenByAll()) poolGain(raceRule(p, 'quiet') || 1, 'quiet');

  refreshFov();
  if (G.depth > 0) scanForTraps();
  if (!skipMonsters) runMonsters();
  if (G.running) tickHazards();
  if (!G.running) return;
  refreshFov();
  readIntents();
  /* Spent at the very end: the roll has to still be dodging while
     the monsters and the marked ground resolve, which is the whole
     turn it was bought for. */
  if (p.iframe > 0) p.iframe--;
}

/* ── the clock ────────────────────────────────────────────
   Vampire Survivors' actual design is not the weapons, it is
   the timer: the screen fills whether you are ready or not, so
   power has to arrive faster than pressure does. A dungeon with
   no clock lets a patient player rest away every mistake, which
   is exactly the "too easy, too slow" this floor plan had.

   The budget is generous — you can clear a floor properly and
   never see a wave. Overstay and the floor starts feeding, each
   wave a little stronger than the last, and they arrive awake
   and knowing where you are. Nothing here kills you outright.
   It just makes standing still the losing move. */
export function floorBudget() {
  return Math.max(60, Math.round(
    /* ③ 불씨 항아리의 크랙은 「불 없는 층이 없어진다」다 — 이 게임의
       가장 큰 압박 하나(불을 못 만난 층)를 통째로 지운다. 크랙 서른넷
       중 압박을 **더하는** 것은 하나도 없고 빼는 것이 열둘이라는
       지적을 받았다. 여기서 값을 받는다: 불은 늘 있고, 대신 층이 더
       빨리 조여 온다. */
    FLOOR_BUDGET(G.depth) * (G.branch?.clock || 1) * heatClock()
      * (hasArcana('clock') ? 0.6 : 1) * (hasArcana('flood') ? 0.5 : 1)
      * (cracked('ember') && !hasArcana('echo') ? 0.78 : 1)
      * (strangeIs('gullet') ? 0.5 : 1)
      * (hasRelic('thief') ? (cracked('thief') ? 1.15 : 0.65) : 1)));
}

/* ═══ 깊은 곳이 너를 본다 ═══════════════════════════════
   플레이어의 말: 「후반 난이도 하향 장치를 만들어놨으면 그만큼 내
   전투력에 맞춰서 몬스터가 더 강해지던가. risk & take 가 전혀 없다.」

   맞는 지적이고, 재 보니 근거도 있다. **같은 층에서 전투력이 하위와
   상위 사분위 사이에 ×2.2~3.2로 벌어진다**(6직업 72판, 층에 첫발을
   디딘 순간의 `한 방 기댓값 × 최대 체력`). 정적인 깊이 곡선은 약한
   빌드에도 강한 빌드에도 안 맞는다 — 약한 쪽은 벽에 부딪히고 강한
   쪽은 산책한다.

   ── 무엇에 거는가 ────────────────────────────────────────
   처음에 스탯만 올리려 했는데, 실측이 그걸 말렸다: 15층에서 셋에
   둘러싸이면 이미 **3턴**에 죽는다. 전투는 이미 치명적이고, 안 죽는
   이유는 세기가 아니라 **둘러싸이는 일이 안 일어나기 때문**이다
   (층의 몬스터 중 보이는 것이 0.5%뿐이다).

   그래서 열기는 **조우**에 먼저 걸고 스탯에는 얇게 건다:
     · 깨어 있는 것이 늘고, 더 멀리서 깨어난다
     · 정예가 잦아진다
     · 파도가 더 일찍 오고 더 크다
     · 그리고 스탯이 조금 오른다 (여기는 얇게 — 두껍게 걸면
       강화·유물의 체감이 그 자리에서 상쇄된다)

   ── 그리고 보인다 ───────────────────────────────────────
   이 게임의 문법은 「거래 조건은 미리 다 적혀 있다」다. 숨은 러버밴드는
   그 문법을 깬다. 열기는 HUD에 뜨고, 무엇이 올렸는지 말하고,
   **일부러 올릴 수도 있다** — 그래야 벌금이 아니라 판돈이 된다.  */
const POWER_BASE = 120;     // 1층 전투력 중앙값 (실측 121)
/* ── 이 두 줄이 후반 난이도를 통째로 껐었다 ────────────────
   1.34 였던 것을 리뷰의 「실제 성장은 층당 1.45」를 그대로 믿고 1.45로
   올렸다. 그 계산이 틀렸다 — 리뷰는 **봇 판**의 전투력비가 1층 1.11
   → 12층 2.68 로 오르는 것을 보고 성장률을 역산했는데, 12층까지 가는
   봇 판은 잘 풀린 판만 남은 것이라(생존 편향) 비율이 오르는 이유가
   성장이 아니라 **표본**이었다.

   같은 손을 층마다 세워 직접 재면 층당 배율은 이렇다:
       곡선대로 자란 사람  ×1.226   (1층 121 → 15층 2115)
       아주 잘 굴린 판     ×1.281   (1층 115 → 15층 3704)

   1.45 를 쓰면 15층 기대치가 **14,166** 이 되는데, 이 게임에서 도달
   가능한 최대치가 3,704 다. 비율이 0.26 이면 heatFor 는 0을 돌려주고,
   그래서 **8층부터 15층까지 주목이 늘 0이었다** — 깨어서 시작 0%,
   정예 기본값, 시계 그대로, 몬스터 체력 그대로. 후반에 밀어붙이라고
   만든 장치가 후반에만 꺼져 있었다. 플레이어가 15층을 3554턴에
   클리어하고 「개쉽다」고 한 판이 그 상태의 판이다.

   그래서 이제 곡선을 **곡선대로 자란 사람**에 맞춘다(×1.226).
   그러면 그 사람은 전 층에서 비율 ≈1 → 주목 0 이고(「곡선 안이면
   아래는 너를 대충 본다」), 잘 굴린 판만 비율 1.7 → 주목 39 로
   뜨거워진다. 그게 이 계기가 원래 재려던 것이다.

   POWER_BASE 도 78 → 120: 1층의 실측 전투력이 121 이라, 78 을 쓰면
   시작하자마자 비율 1.55(주목 31)로 출발한다. */
const POWER_STEP = 1.23;    // 층당 배율 — 곡선대로 자란 손의 실측 성장률
export const expectedPower = d => POWER_BASE * POWER_STEP ** Math.max(0, d - 1);
/* 지금 이 손의 전투력. 한 방 기댓값 × 버틸 수 있는 양 — 둘 중 하나만
   보면 종이 한 장짜리 딜러와 못 때리는 벽이 같은 값을 받는다. */
export function powerOf(p = G.player) {
  if (!p) return 0;
  return Math.max(1, swingAvg(p, p.equip?.weapon) * p.maxhp);
}
/* 0이 기준선. 양수면 곡선보다 앞서 있다는 뜻이고, 그만큼 깊은 곳이
   너를 본다. 한 층에 한 번만 갱신한다 — 매 턴 흔들리면 계기가 아니라
   잡음이고, 층 안에서 조건이 바뀌면 「미리 적혀 있다」가 거짓이 된다. */
export const HEAT_MAX = 100;
export function heatFor(p = G.player, d = G.depth) {
  const ratio = powerOf(p) / Math.max(1, expectedPower(d));
  /* ×1 이면 0, ×2 면 50, ×3.2(실측 상위 사분위 폭) 면 84. 로그로
     읽는 이유는 전투력이 곱으로 자라기 때문이다. */
  return clamp(Math.round(Math.log2(Math.max(0.25, ratio)) * 50), 0, HEAT_MAX);
}
/* 층에 들어설 때 한 번 굳는다. 그리고 판이 스스로 올린 몫(도발)이
   더해진다 — 그쪽이 이 시스템의 risk & take 쪽 절반이다. */
/* ── 스스로 올리는 몫 ─────────────────────────────────────
   이 함수가 없었다. `G.provoked` 를 **올리는 코드가 src/ 어디에도
   없어서**, 위 주석이 약속한 risk & take 쪽 절반이 통째로 비어
   있었다 — 주목은 순수 러버밴드 벌금이었다. 더 나쁜 것은 sim/heat.mjs
   가 `G.provoked` 를 직접 넣어 재고 있었다는 점이다: 계기가 자기
   입력을 만들고 있었으니 벤치는 영원히 초록이었다.

   깔때기 하나. 판을 시끄럽게 만드는 행동이 여기로 모인다. */
export function provoke(n, why) {
  G.provoked = clamp((G.provoked || 0) + n, 0, HEAT_MAX);
  if (why) say(`${why} 아래가 고개를 든다.`, 'warn');
}

export function settleHeat() {
  const was = G.heat || 0;
  G.heat = clamp(heatFor() + (G.provoked || 0), 0, HEAT_MAX);
  if (G.depth > 0 && G.heat >= 25 && G.heat > was + 8)
    say(HEAT_WORD(G.heat), 'warn');
  return G.heat;
}
export const HEAT_WORD = h =>
  h >= 80 ? '아래가 전부 이쪽을 향했다. 숨을 곳이 없다.'
: h >= 55 ? '깊은 곳이 너를 똑바로 본다.'
: h >= 30 ? '무언가가 네 발소리를 세고 있다.'
          : '아직은 아무도 너를 모른다.';
/* 열기가 실제로 돌리는 손잡이 넷. 전부 여기 한 곳에서 나온다 —
   흩어 놓으면 계기가 말하는 값과 판이 하는 일이 갈린다. */
export const heatWake  = () => 1 + (G.heat || 0) * 0.035;   // 각성 거리 ×1 ~ ×4.5
export const heatElite = () => 1 + (G.heat || 0) * 0.022;   // 정예 확률 ×1 ~ ×3.2
export const heatClock = () => 1 - (G.heat || 0) * 0.0035;  // 여유 시계 ×1 ~ ×0.65
/* 스탯은 얇게. 여기를 두껍게 걸면 방금 주운 것이 그 자리에서
   상쇄되고, 그건 이 판에서 이미 한 번 고친 병이다. */
export const heatStat  = () => 1 + (G.heat || 0) * 0.0025;  // ×1 ~ ×1.25
/* 판이 이미 깨어 있는 채로 시작하는 비율. 열기가 높으면 층이 너를
   기다리고 있다. */
export const heatAwake = () => (G.heat || 0) * 0.006;       // 0 ~ 60%

/* ═══ 아르카나 ═══════════════════════════════════════════
   유물은 「내가 무엇을 할 수 있나」를, 크랙은 「얼마나」를 바꾼다.
   아르카나는 그 위의 축 — **던전이 어떤 곳인가**를 바꾼다. 값이 내
   몸이 아니라 세계에 붙으므로, 읽는 곳도 몸이 아니라 층 생성과
   시계와 드롭이다.

   판당 셋(4·8·12층). 고를 때마다 셋 중 하나이고 전부 양날이다 —
   순증이 하나라도 있으면 그 판부터 나머지는 안 고른다. */
export const hasArcana = id => !!G.arcana?.includes(id);
/* 이 층에서 고를 차례인가. 층에 들어서는 순간 화면이 뜬다. */
/* ── 서약 ──────────────────────────────────────────────────
   DESIGN.md §4. 아르카나가 쓰던 리듬(4·8·12층)을 그대로 쓴다. 다만
   고르는 것이 셋이 아니라 **넷**이다 — 「거절한다」가 언제나 붙는다.

   화면에는 신이 **말한 것**(say)만 간다. 실제로 일어나는 것(real)은
   겪고 나서 기록에 남는다. 그것이 속는다는 것의 뜻이고, 그래서 이
   함수는 real 을 안 내보낸다. */
export function godOffer() {
  if (G.godPick) return G.godPick;
  const pool = GODS.filter(g => g.id !== G.god);
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++)
    out.push(pool.splice(rnd(pool.length), 1)[0]);
  G.godPick = out;
  return out;
}
/* 거절할 수 있는가. 심연 8단에서만 열린다 — 사다리는 오르는 것이지
   고르는 것이 아니므로(setAbyss 가 cleared()+1 로 자른다) 여기 서려면
   0단부터 차례로 이겨야 한다. */
export const canRefuse = () => (G.abyss || 0) >= REFUSE.at;

export function pledge(id) {
  const g = godById(id);
  if (!g) return;
  G.god = id;
  /* 받은 선물은 판이 끝날 때 meta 로 간다. 그리고 **다음 판의 보스가
     그것을 지고 나온다** — 이 게임에서 신이 실제로 속이는 자리다.
     강해져서 내려가는 것 자체가 다음 용사가 만날 악마를 빚는 일이고,
     그 사실은 이 판에서 어디에도 안 적혀 있다. */
  (G.gifts ||= []).push(id);
  G.godPick = null;
  say(`「${g.call}」`, 'level');
  say(g.vow + '.', 'warn');
  trace('pledge', { id, n: g.n, depth: G.depth });
  fx({ t:'pledge', id, n: g.n, x: G.player?.x, y: G.player?.y });
}

/* 거절. 아무것도 안 준다 — 신앙심도 안 오른다. 그것이 전부이고,
   그래서 이 게임의 유일한 난이도 선택이다. */
export function refuse() {
  if (!canRefuse()) return false;
  G.refused = (G.refused || 0) + 1;
  G.godPick = null;
  say('아무 말도 하지 않았다.', 'warn');
  trace('refuse', { depth: G.depth, n: G.refused });
  fx({ t:'refuse', x: G.player?.x, y: G.player?.y });
  return true;
}

/* 이 층에서 신이 말을 거는가. 아르카나가 쓰던 4·8·12를 그대로 쓴다.
   받았든 거절했든 한 번 답하면 그 층은 끝난다. */
export function pledgeDue(depth) {
  const answered = (G.gifts || []).length + (G.refused || 0);
  return ARCANA_AT.includes(depth) && answered < ARCANA_AT.indexOf(depth) + 1;
}

export function arcanaDue(depth) {
  return ARCANA_AT.includes(depth) && (G.arcana || []).length < ARCANA_AT.indexOf(depth) + 1;
}
export function arcanaOffer() {
  if (G.arcanaPick) return G.arcanaPick;
  const pool = ARCANA.filter(a => !hasArcana(a.id));
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++)
    out.push(pool.splice(rnd(pool.length), 1)[0]);
  G.arcanaPick = out;
  return out;
}
export function takeArcana(id) {
  if (!id || hasArcana(id)) return;
  (G.arcana ||= []).push(id);
  G.arcanaPick = null;
  const a = arcanaById(id);
  /* 아르카나도 마찬가지. 「무른 판 — 네가 주는 피해 +40%. 대신 받는
     피해도 +40%다」가 아니라 「무른 판. 유리로 만든 칼이 가장 잘
     든다」 — 아홉 자로 같은 것을 말하면서 고르는 사람의 마음까지
     말하는 줄이, 지금까지 화면에 한 번도 안 나왔다. */
  trace('arcana', { id, n: a.n });
  say(`${a.n}. ${a.lore || a.t.replace(/\*\*/g, '')}`, 'level');
  fx({ t:'arcana', id, n: a.n });
  recalc(G.player);
  G.screen = 'play';
}

/* 멎은 판 — 몬스터도 나도 두 턴에 한 번 움직인다. 공격만 매 턴이라,
   「걸어서 붙는다」가 두 배로 비싸지고 「서서 친다」가 그대로다.
   같이 느려지면 아무것도 안 달라진다고들 하는데, 해 보면 다르다. */
export const stillHalf = () => hasArcana('still');

export const pressureLevel = () => {
  const over = G.floorTurn - floorBudget();
  return over <= 0 ? 0 : 1 + Math.floor(over / WAVE_EVERY);
};

function pressure() {
  const over = G.floorTurn - floorBudget();
  if (over < 0) return;
  if (over === 0) {
    say('발밑에서 무언가 깨어난다. 이 층은 더 이상 안전하지 않다.', 'hit');
    fx({ t:'noise', x:G.player.x, y:G.player.y });
    return;
  }
  if (over % WAVE_EVERY) return;
  spawnWave();
}

/* 층이 한 번에 담을 수 있는 것. 상한이 없었고, 라이브락 해부에서
   **한 판이 파도 3712번에 몬스터 400마리**를 만들어 냈다(4층에서
   59,685턴). 사람은 그 층에 그렇게 오래 있을 수 없으니 화면에서는
   안 보이는 값이지만, 상한이 없다는 것은 「심연은 무한히 게워낸다」가
   규칙이라는 뜻이고 그건 설계가 아니라 누락이다. 층이 가득 차면
   더 나오지 않는다 — 대신 이미 나온 것들이 세다. */
export const WAVE_CAP = 24;

/* 한 파도에 몇이 오는가. spawnWave 밖에 두는 이유는 매듭 린트가 이
   커밋에서 그 함수를 복잡도 15 위로 밀어 올렸다고 잡았기 때문이고,
   실제로 이건 「파도의 크기」라는 독립된 규칙이다. */
const waveCount = () =>
  1 + (G.waves >= 4 ? 1 : 0) + ((G.heat || 0) >= 60 ? 1 : 0);

function spawnWave() {
  const L = G.level, p = G.player;
  /* 이미 가득한 층은 더 게워내지 않는다. 파도 수(=세기)는 계속
     오르므로 압박은 멈추지 않는다 — 멈추는 것은 마릿수뿐이다. */
  G.waves++;
  if (G.monsters.length >= WAVE_CAP) return;
  /* 파도의 세기와 마릿수에도 열기가 얹힌다. 시계(heatClock)가 이미
     파도를 **일찍** 부르므로, 여기는 **크게**를 맡는다. */
  const grow = (1 + WAVE_GROWTH * G.waves) * heatStat();
  const count = waveCount();
  let born = 0;
  for (let i = 0; i < count; i++) {
    // Far enough away to be a warning rather than an ambush.
    let spot = null;
    for (let t = 0; t < 60 && !spot; t++) {
      const s = L.randomFloor((x, y) => monsterAt(x, y) || (p.x === x && p.y === y));
      if (!s) break;
      if (Math.hypot(s.x - p.x, s.y - p.y) < 9) continue;
      spot = s;
    }
    if (!spot) continue;
    const m = pickMonster(Math.min(MAX_DEPTH, G.depth + 1));
    m.hp = Math.round(m.hp * grow);
    m.atk = Math.round(m.atk * grow);
    m.maxhp = m.hp;
    Object.assign(m, { x: spot.x, y: spot.y, awake: true, energy: 0 });
    if (hasArcana('flood')) m.rich = 2;      // 밀려온 것은 손에 무언가를 쥐고 온다
    if (Math.random() < eliteChance(G.depth) * 1.5) makeElite(m, G.depth);
    m.maxhp = m.hp;
    G.monsters.push(m);
    born++;
  }
  if (born) {
    say(`심연이 ${born === 1 ? '하나' : '둘'}을(를) 더 게워냈다. (${G.waves}번째)`, 'hit');
    fx({ t:'noise', x:p.x, y:p.y });
  }
}

/* ── 붉게 고쳐 쓰기 ────────────────────────────────────────
   앞선 자들이 적어 놓은 규칙 한 줄이 눈앞에서 틀리는 순간, 그 자리에서
   게임이 먼저 말한다: 「그 기록은 틀렸다」. 그리고 규칙서를 붉게
   고쳐 쓴다.

   이 함수가 그 단 하나의 깔때기다. 부르는 자리는 네 곳뿐이고, 전부
   **플레이어가 보고 있을 때만** 부른다 — 못 본 것을 고쳐 주면 그건
   발견이 아니라 그냥 알림이다. 「속았음이 자명할 때」가 조건이다.

   정본은 여기서 안 쓴다. rulebook이 tellsOf에서 뽑아 준다 — 참말은
   언제나 규칙이 실제로 읽는 값에서만 나온다. */
export function witness(m, key) {
  if (!m || !m.spr) return false;
  const h = hearsayFor(m);
  if (!h || h.k !== key) return false;
  if (!Meta.correct(m.spr, key)) return false;     // 이미 고쳐 쓴 줄
  const fixed = rulebook(m, true).find(l => l.kind === 'redwrit');
  if (!fixed) return true;                         // 덮을 자리가 없으면 조용히
  say(`앞선 자는 「${h.lie}」라고 적어 두었다.`, 'warn');
  say(`그 줄은 틀렸다. ${m.n} — ${fixed.text}`, 'redwrit');
  fx({ t:'redwrit', x:m.x, y:m.y });
  return true;
}

/* Speed is an energy budget rather than a turn order: a wolf at
   1.5 gets a second move every other turn, an ogre at 0.75 skips
   one in four, and 둔화 doubles everyone else's allowance. */
function runMonsters() {
  const slowed = has(G.player, 'slow') ? 2 : 1;
  for (const m of [...G.monsters]) {
    if (!G.running) return;
    m.energy = (m.energy || 0) + (m.spd || 1) * slowed;
    let acts = 0;
    while (m.energy >= 1 && acts < 4) {
      if (!G.monsters.includes(m)) break;     // died mid-loop
      m.energy -= 1;
      acts++;
      monsterTurn(m);
      if (!G.running) return;
      /* 한 턴에 두 번 움직이는 것을 두 눈으로 봤다. 「당신보다
         느리다」고 적힌 줄이 있었다면 여기서 끝난다. */
      if (acts >= 2 && G.level?.vis[idx(m.x, m.y)]) witness(m, 'speed');
    }
  }
}

function tickAilments(p) {
  for (const kind of Object.keys(p.ail)) {
    if (p.ail[kind] <= 0) { delete p.ail[kind]; continue; }
    p.ail[kind]--;
    if (p.ail[kind] === 0) {
      delete p.ail[kind];
      say(`${AILMENTS[kind].n}에서 벗어났다.`, 'good');
    }
  }
  if (has(p, 'poison') && G.turn % 3 === 0) {
    /* 독은 연격을 안 끊는다 — 맞은 것이 아니라 이미 맞은 것의 여진이다.
       그래도 깔때기는 지난다: 숨 잠금과 죽음이 여기서 같이 처리된다. */
    const took = hurtPlayer(1 + Math.floor(G.depth / 8), { by:'독', combo:false });
    fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg: took, poison:true, who:'중독', spr:'potion' });
  }
}

/* ── 하나가 깨면 곁이 깬다 ────────────────────────────────
   「아무 생각 없이 걸어도 13층까지 간다」의 마지막 조각. 여태 각성은
   **한 마리씩**이라, 방을 가로질러도 한 번에 한 마리와 싸웠다 —
   그러면 판단할 것이 없다. 곁의 것이 같이 일어나면 「어느 방으로
   들어갈까」와 「지금 물러설까」가 처음으로 결정이 된다.

   반경은 주목을 탄다: 조용한 판은 두 칸, 아래가 너를 보는 판은
   다섯 칸 — 방 하나가 통째로 일어난다. */
function wakeNear(m) {
  const p = G.player;
  const shout = 2 + (G.heat || 0) * 0.03;
  let woke = 0;
  for (const o of G.monsters) {
    if (o === m || o.awake || o.disguise) continue;
    if (Math.hypot(o.x - m.x, o.y - m.y) > shout) continue;
    o.awake = true; o.mark = { x: p.x, y: p.y }; o.lost = 0; woke++;
  }
  if (woke) fx({ t:'noise', x: m.x, y: m.y, r: shout });
}

function monsterTurn(m) {
  if (!G.running) return;
  const p = G.player, L = G.level;
  /* 멎은 판 — 저쪽도 두 턴에 한 번이다. 나만 느려지면 그건 아르카나가
     아니라 저주다. */
  if (stillHalf()) { m.slowTick = !m.slowTick; if (m.slowTick) return; }
  if (m.staggered > 0) { m.staggered--; return; }   // 둔기류 took its turn
  if (m.cooling > 0) m.cooling--;
  const dx = p.x - m.x, dy = p.y - m.y;
  const dist2 = dx * dx + dy * dy;
  const dist = Math.sqrt(dist2);

  /* A snare is spent by the thing that steps in it. Checked at the
     top of its turn rather than on the step, so a fast thing that
     moved twice is caught by the tile it stopped on. */
  if (G.snares?.length) {
    const i = G.snares.findIndex(s2 => s2.x === m.x && s2.y === m.y);
    if (i >= 0) {
      G.snares.splice(i, 1);
      m.energy = -SNARE_TURNS;
      m.awake = true;
      fx({ t:'snared', x:m.x, y:m.y });
      say(`${m.n}이(가) 덫에 걸렸다.`, 'good');
      return;
    }
  }

  if (m.poison > 0) {
    m.poison--;
    const tick = Math.max(1, Math.round((m.maxhp || 10) * 0.045));
    hurtMonster(m, tick, '독', { quiet: true });
    if (!G.monsters.includes(m)) return;
  }
  // 파문: nothing mends. Regen, drain and the troll's whole idea.
  if (m.regen && !m.cursed && m.hp < m.maxhp) {
    m.hp = Math.min(m.maxhp, m.hp + m.regen);
    /* 상처가 아무는 것을 보고 있다. 「한 번 낸 상처는 아물지
       않는다」는 여기서 무너진다. */
    if (L.vis[idx(m.x, m.y)]) witness(m, 'regen');
  }

  if (!m.awake) {
    if (!L.vis[idx(m.x, m.y)] || dist2 > 110) return;
    /* Noticing you is a roll per turn, not a certainty, so the
       long quiet approach is a strategy and not just flavour.
       Standing in water throws that away. */
      const wading = L.tiles[idx(p.x, p.y)] === WATER;
    const quiet = wading ? stealth(p) * 0.25 : stealth(p);
    // 전쟁 북 is loud: it hears you two tiles sooner.
    const reach = dist - (hasRelic('march') ? 3 : hasRelic('drum') ? 2 : 0);
    /* 열기가 각성에 거는 자리. 곱이 아니라 **거리를 당긴다** —
       확률에 곱하면 멀리 있는 것은 여전히 못 보고 붙은 것만 더 잘
       보게 되는데, 이 시스템이 만들려는 것은 「멀리서부터 온다」다. */
    const pull = reach / heatWake();
    const notice = clamp((1 - quiet) * (0.62 - pull * 0.055), 0.02, 0.95);
    /* 그림자 걸음: a throat opened quietly does not announce
       itself. Nothing notices you on the turn you take a sleeping
       thing, so a room can be emptied one at a time — which is
       the only way that build ever wins a fight it did not pick. */
    if (G.hushUntil >= G.turn) return;
    if (Math.random() >= notice) return;
    m.awake = true;
    wakeNear(m);
    if (Meta.see('monsters', m.n) && m.lore) lore('처음 보는 것', m.n, m.lore, m.spr);
    if (m.disguise) return;              // a mimic that has noticed you keeps very still
    fx({ t:'wake', x:m.x, y:m.y });
  }

  // A mimic does nothing at all until it is touched.
  if (m.disguise) return;
  if (m.ai === 'still' && dist2 > 2) return;

  /* ── 보고 있는 동안에는 움직이지 않는 것 ──────────────────
     이 게임에서 시야는 장식이 아니라 자원이다 — 횃불이 곧 보이는
     범위이고, 그 범위는 판 내내 줄어든다. 그러니 「보고 있으면
     멈춘다」는 규칙은 여기서 남의 장르 장치가 아니라 이 게임의
     시계에 직접 붙는다. 기름이 줄면 볼 수 있는 것이 줄고, 볼 수
     있는 것이 줄면 이것이 움직인다.

     불쾌한 것은 움직이는 순간이 아니라 **움직이지 않는 순간**이다.
     한 칸 앞에 서 있는데 아무 일도 안 일어나고, 그래서 눈을 뗄 수가
     없고, 그런데 불은 계속 탄다. 도망치려면 등을 보여야 한다.

     쫓기지 않는다. 걸어서 떨어뜨릴 수 있는 것이 아니다 — 눈을 감는
     순간 거리가 줄어든다. 그것이 이것의 유일한 규칙이고, 도감의
     tellsOf가 그 한 줄을 그대로 적어 준다. */
  if (m.ai === 'unseen') {
    const watched = L.vis[idx(m.x, m.y)];
    if (watched) {
      m.wind = 0;
      /* 보고 있는 동안 붙어 있어도 때리지 않는다. 이것은 「가만히
         있는 몬스터」가 아니라 「보는 동안 멈추는 것」이다 — 그
         차이가 전부다. */
      return;
    }
    /* 안 보이면 성큼 다가온다. 걷는 것이 아니라 거기 있게 된다. */
    for (let i = 0; i < UNSEEN_STEP; i++) {
      if (Math.max(Math.abs(p.x - m.x), Math.abs(p.y - m.y)) <= 1) break;
      advance(m, Math.sign(p.x - m.x), Math.sign(p.y - m.y));
    }
    if (Math.max(Math.abs(p.x - m.x), Math.abs(p.y - m.y)) <= 1
        && !L.vis[idx(m.x, m.y)]) {
      /* 어둠 속에서 붙었다. 여기서만 때린다. */
      monsterMelee(m);
    }
    return;
  }

  /* A named thing guards; it does not hunt the floor. The stairs
     screen promises "피해서 내려갈 수 있다" and that promise has to
     be true — a 185-health ogre that follows you across three
     rooms is a toll, not a decision.

     It holds a leash around where it was placed, walks back if it
     is dragged off it, and once you have hit it the leash is
     gone: pick the fight and it is a fight. Floor 6 was ending
     eighteen percent of runs before this. */
  /* 긴 그림자 takes the leash off. Same dungeon, read completely
     differently: the stairs screen stops being an offer and goes
     back to being a warning. */
  if (m.named && !m.provoked && !hasShackle('shadow')) {
    m.home ??= { x: m.x, y: m.y };
    const away = Math.hypot(m.x - m.home.x, m.y - m.home.y);
    const far  = Math.hypot(p.x - m.home.x, p.y - m.home.y);
    if (far > NAMED_LEASH) {
      // Out of its ground. Drift home, and let it forget.
      if (away > 0.9) { advance(m, Math.sign(m.home.x - m.x), Math.sign(m.home.y - m.y)); return; }
      m.awake = false;
      return;
    }
  }

  // Webs hold everything that did not spin them.
  if (m.snared > 0 && !m.web) { m.snared--; return; }

  /* Heavy hitters wind up. One turn of nothing, then a blow
     worth two and a half — which is the turn the player gets to
     step back, shut a door, drink, or decide the trade is worth
     it anyway. Without the pause an elite is just a bigger
     number; with it, it is a problem to solve. */
  /* Things with a repertoire use it at range. The pattern is
     drawn on the floor a turn or two before it lands, which is
     the entire fight: read the shape, decide whether to walk out
     of it, roll out of it, or spend the turn hitting instead. */
  if (m.casts?.length && !m.cooling && dist2 > 2 && dist <= 9
      && lineClear(L, m.x, m.y, p.x, p.y)) {
    const key = m.casts[rnd(m.casts.length)];
    if (castPattern(m, key)) return;
  }

  if (dist2 <= 2) {
    if (m.heavy && !m.wind) {
      m.wind = 1;
      say(`${m.n}이(가) 크게 팔을 당긴다.`, 'warn');
      fx({ t:'wake', x:m.x, y:m.y });
      /* 팔을 당기는 것을 봤다 — 「예고 없이 때린다」가 무너지는
         자리이자, 이 게임에서 가장 값진 오정정이다. 예고가 있다는
         것을 알면 그 턴에 물러설 수 있다. */
      if (L.vis[idx(m.x, m.y)]) witness(m, 'heavy');
      return;
    }
    monsterMelee(m);
    return;
  }
  m.wind = 0;                           // lost the swing; must wind up again

  /* Archers keep their distance: they shoot from range, back off
     when you close, and only advance when they have lost you.  */
  if (m.ai === 'ranged' && m.rng) {
    const sighted = dist <= m.rng && lineClear(L, m.x, m.y, p.x, p.y);
    if (sighted && dist >= 2.5) { monsterShoot(m); return; }
    if (sighted && dist < 2.5 && retreat(m)) return;
  }

  /* A wounded hound runs, and a runner that gets away lives to
     bring friends. Cornering one is a decision. */
  /* The thief runs from full health, which is what makes it a
     decision rather than a fight: you cannot walk it down, so
     catching it costs a roll, a spell or a scroll. */
  if (m.thief || ((m.ai === 'coward' || m.fleeing) && m.hp < m.maxhp * 0.35)) {
    if (!m.fleeing) { m.fleeing = true; say(`${m.n}이(가) 달아나기 시작한다.`); }
    if (retreat(m)) return;
    // Cornered: it stops, it does not turn and charge.
    if (m.thief) return;
  }

  /* ── 무엇을 보고 쫓는가 ────────────────────────────────
     여기까지 오는 동안 몬스터는 아무것도 보지 않고 쫓았다. 한 번
     깨면 시야와 무관하게 플레이어의 현재 좌표를 알았고, 그래서
     「물러선다」는 수가 존재할 수 없었다. 도망쳐도 정확히 따라오니
     공짜 매질만 받는 셈이었다.

     이제는 본 것만 안다. 그리고 무엇을 보느냐는 **네 횃불이 정한다**
     — L.vis는 「네 빛이 닿고 시선이 통하는 칸」이라, 그 칸에 선
     것만 너를 본다. 불을 끄면 놈들도 너를 잃는다. 횃불이 위협이자
     동시에 도구가 되는 지점이 여기다.

     이름 있는 것과 정예는 예외다. 그것은 네가 고른 싸움이고,
     고른 싸움에서 걸어 나갈 수 있으면 고른 것이 아니다. */
  const keen = m.named || m.boss || m.elite?.length;
  /* ── 그런데 어둠이 은신이 되어 버렸다 ────────────────────
     L.vis는 「네 빛이 닿는 칸」이다. 불이 꺼지면 그 칸이 반경 2로
     쪼그라들고, 그러면 세 칸 밖의 모든 것이 너를 잃는다 — 불을 끄는
     것이 이 게임에서 가장 싸고 확실한 은신이었다. 재 보니 턴의
     62%를 꺼진 채로 보내고 있었고, 그건 플레이어가 이상해서가
     아니라 그게 최적이어서였다.

     여기 사는 것들은 여기서 산다. 네 횃불이 꺼졌다고 눈이 머는 것은
     너지 놈들이 아니다. 불이 꺼져 있으면 놈들은 제 눈으로 본다 —
     시선이 통하고 DARK_SIGHT 안이면 계속 안다.

     불이 켜져 있을 때의 규칙은 그대로다: 서로 보이면 안다. 그래야
     「벽 뒤로 돌아 시야를 끊는다」는 후퇴가 남는다. 어둠은 이제
     후퇴의 수단이 아니라 후퇴해야 하는 이유다. */
  const dark = G.depth > 0 && p.lightTurns <= 0;
  const ownEyes = dark && dist <= DARK_SIGHT && lineClear(L, m.x, m.y, p.x, p.y);
  const sees = keen || dist <= 1.5 || ownEyes
            || (!dark && L.vis[idx(m.x, m.y)]);
  if (sees) { m.mark = { x: p.x, y: p.y }; m.lost = 0; }
  else {
    m.lost = (m.lost || 0) + 1;
    const at = m.mark && m.x === m.mark.x && m.y === m.mark.y;
    if (at || m.lost > TRACK_TURNS) {
      /* 자취가 끊겼다. 그렇다고 다시 재우면 층이 죽는다 — 한 번
         그렇게 했더니 판이 세 배로 길어지고 걷기 비중이 도로 올라갔다.
         잃은 것은 위치이지 관심이 아니다. 마지막 자리 근처를 헤매게
         두면, 네가 돌아오는 순간 다시 문다.

         아주 멀어진 것만 잠든다. 지도 반대편에서 영원히 서성이는
         것은 위협이 아니라 계산 낭비다. */
      if (m.mark) { G.lostMe = (G.lostMe || 0) + 1; if (dist < 9) hint('trail'); }
      m.mark = null;
      if (m.lost > TRACK_TURNS * 4 && dist > 14) { m.awake = false; m.lost = 0; return; }
      advance(m, rnd(3) - 1, rnd(3) - 1);
      return;
    }
  }

  const goal = sees ? p : (m.mark || p);
  if (m.ai === 'erratic' && Math.random() < 0.45) { advance(m, rnd(3) - 1, rnd(3) - 1); return; }
  /* 보고 쫓을 때만 흐름장을 쓴다. 자취(mark)를 쫓는 것은 「거기
     있었다」는 기억이지 지금 위치가 아니므로, 그때는 방향으로 간다 —
     기억을 향해 최단 경로로 달려가는 것은 자취를 쫓는 모습이 아니다. */
  if (sees && rollDown(m, false)) return;
  advance(m, Math.sign(goal.x - m.x), Math.sign(goal.y - m.y));
}

/* 자취를 몇 턴이나 쫓는가. 짧으면 후퇴가 공짜가 되고, 길면
   후퇴가 없다. */
export const TRACK_TURNS = 6;

/* ── 어둠이 말해 주는 것 ──────────────────────────────────
   빛을 줄이면 보이는 것이 줄어든다. 그것만으로는 긴장이 아니라
   무지다 — 무엇이 있는지 짐작조차 못 하면 물러설 이유도 생기지
   않는다. 그래서 안 보이는 것을 글로 알린다. 위치는 주지 않고,
   수와 거리와 방향만.

   소리를 글로 옮기는 쪽을 골랐다: 이 게임의 로그는 이미 화면의
   절반이고, 새 장치를 만드는 것보다 있는 통로로 말하는 편이 낫다. */
const HINT_EVERY = 4;
function hint(kind) {
  if (G.turn - (G.hintAt || -99) < HINT_EVERY) return;
  const p = G.player, L = G.level;
  if (kind === 'trail') {
    G.hintAt = G.turn;
    say(pickOne(['무언가가 네 자리를 지나쳐 갔다.',
              '발소리가 멀어진다. 자취를 놓친 모양이다.',
              '숨소리가 갈라져 흩어졌다.']), 'good');
    return;
  }
  const unseen = G.monsters.filter(m => m.awake && !m.disguise
    && !L.vis[idx(m.x, m.y)] && Math.hypot(m.x - p.x, m.y - p.y) <= 8);
  if (!unseen.length) { G.near = 0; return; }
  const near = Math.min(...unseen.map(m => Math.hypot(m.x - p.x, m.y - p.y)));
  const closing = G.near && near < G.near - 0.4;
  G.near = near;
  G.hintAt = G.turn;
  G.did && (G.did.hinted = (G.did.hinted || 0) + 1);

  const many = unseen.length >= 3 ? '여럿' : unseen.length === 2 ? '둘' : '하나';
  if (near <= 2.5)
    say(pickOne([`바로 옆 어둠에서 숨소리가 난다. ${many}.`,
              `손이 닿을 거리에 무언가 있다. ${many}.`]), 'hit');
  else if (closing)
    say(pickOne([`소리가 가까워지고 있다. ${many}.`,
              `어둠 속에서 발이 빨라졌다. ${many}.`]), 'warn');
  else
    say(pickOne([`빛 밖에서 무언가 움직인다. ${many}.`,
              `어둠이 부스럭거린다. ${many}.`,
              `돌 위를 끄는 소리. ${many}.`]), 'warn');
}

function monsterMelee(m) {
  const p = G.player;
  const ac = armourClass(p);
  const heavy = m.wind > 0;
  m.wind = 0;
  if (p.iframe > 0) {
    say(`구르며 ${m.n}의 손을 피했다.`, 'good');
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  /* ── 왜 아무 일도 안 일어났는가 ────────────────────────
     긴장을 못 찾아 세 가지를 손봤다(물약 공급 · 포위 · 이탈 비용).
     셋 다 안 움직였다. 그러다 명중률을 깊이별로 재 봤다:

       층   내 방어   몬스터 공격   식이 말하는 명중률
        1      5.3         3.9            18%
        5     15.5         9.0             6%   ← 바닥
       10     34.9        24.0             6%
       15     45.3        42.2             6%

     **5층부터 판이 끝날 때까지 이 식은 언제나 하한 6%를 돌려주고
     있었다.** 실측 명중/빗맞음이 46/392다 — 몬스터는 열 번에 아홉 번
     헛손질한다. 위험 구간이 없던 이유는 회복도 포위도 아니고, 맞는
     일이 일어나지 않아서였다.

     원인은 계수다. 방어가 1.75로 공격의 1.45보다 무겁게 들어가는데,
     방어는 5.3 → 45.3(8.5배)로 자라고 공격은 3.9 → 42.2(10.8배)로
     자란다. 차를 쓰면 그 둘의 차이가 계속 벌어져 아래로 뚫고 나간다.

     차 대신 **비**로 간다. 비는 양쪽이 같은 배율로 자라면 그대로
     있으므로 깊이에서 무너지지 않는다. 값은 아래 표가 되도록 잡았다 —
     초반은 지금과 비슷하고, 깊이 갈수록 조금씩 오른다:

       층 1 ≈ 28% · 층 5 ≈ 24% · 층 10 ≈ 27% · 층 15 ≈ 31% */
  const chance = clamp(0.62 * m.atk / (m.atk + ac * 0.9), 0.10, 0.85);
  if (Math.random() > chance) {
    say(heavy ? `${m.n}의 내리친 일격이 바닥을 때렸다.`
              : pickLine(MISS_BY, m.n, nextLine()));
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  let dmg = Math.max(1, Math.round(
    (roll(2, Math.max(3, Math.floor(m.atk * 0.72))) - Math.floor(ac / 5))
    * (heavy ? 2.5 : 1) * (1 + (p.perm?.takeMore || 0))) - gearBonus(p).flatDR);
  dmg = sanctumSoak(dmg);
  dmg = hurtPlayer(dmg, { by: m });
  fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, from:{ x:m.x, y:m.y },
       who:m.n, spr:m.spr, severe: dmg >= p.maxhp * 0.18 });
  say(`${heavy ? '당겼던 것이 떨어졌다. ' : ''}${takenLine(m.n, dmg, p.maxhp, nextLine())} (${dmg})`, 'hit');
  if (m.drain && !m.cursed) {          // 흡혈하는: it heals off you
    const back = Math.max(1, Math.round(dmg * m.drain));
    m.hp = Math.min(m.maxhp, m.hp + back);
  }
  if (m.on && Math.random() < 0.28) afflict(p, m.on, 9 + rnd(9));
  corrode(m);
  reflect(m, dmg);
}

/* 부식. The other end of the anvil: rarely, something that eats
   metal takes a level of enhancement back off you. Only the four
   things that should be able to do it can, and only on a landed
   blow, and never through 불괴의.

   A level, never the item — losing a +7 sword to a mould would
   be a story about quitting, not a story about the dungeon. */
const CORRODERS = ['회색 곰팡이', '푸른 젤리', '미라', '망령'];
function corrode(m) {
  const p = G.player;
  if (!CORRODERS.includes(m.n) || Math.random() >= CORRODE_CHANCE) return;
  const worn = GEAR_SLOTS
    .map(k => p.equip[k]).filter(it => it && (it.plus || 0) > 0 && it.boon !== 'aegis');
  if (!worn.length) return;
  const it = worn[rnd(worn.length)];
  it.plus--;
  recalc(p);
  say(`${m.n}이(가) 남긴 것이 ${affixName(it)}을(를) 갉아먹었다. 한 단계 잃었다.`, 'bad');
  fx({ t:'corrode', x:p.x, y:p.y });
}

/* 거울 방패. Deliberately placed after the damage is applied, so
   a reflected killing blow still trades — you both go down. */
function reflect(m, dmg) {
  if (!G.monsters.includes(m)) return;
  // 거울 방패 and 가시의 각인 stack — one funnel so they can never
  // be applied twice or missed once.
  const g = gearBonus(G.player);
  /* 크랙이 켜지면 relicVal 을 건너뛰고 1로 굳어 있었다 — 먹인 정수
     아홉과 금화 780이 그 순간 사라진다는 뜻이다. 먹인 값을 흡수한다. */
  const rate = (hasRelic('mirror')
    ? (cracked('mirror') ? Math.max(1, relicVal('mirror') * 2) : relicVal('mirror'))
    : 0) + g.reflect;
  if (rate <= 0) return;
  /* 가시밭 prices the thorn on what the armour *stopped* rather
     than on what got through, so the tankier the build the harder
     it bites back — and it goes past the thing's own armour,
     because a hand on a spike does not care how thick the glove
     is. Nothing at all happens if nobody is hitting you. */
  if (hasResonance('bramble')) {
    const stopped = g.flatDR + Math.round(armourClass(G.player) * 0.5);
    hurtMonster(m, Math.max(1, Math.round((dmg + stopped) * (rate + BRAMBLE_BITE))),
                hasRelic('mirror') ? '거울 방패' : '가시', { pierce: true });
    return;
  }
  hurtMonster(m, Math.max(1, Math.round(dmg * rate)),
              hasRelic('mirror') ? '거울 방패' : '가시');
}

function monsterShoot(m) {
  const p = G.player;
  const ac = armourClass(p);
  fx({ t:'shot', fx:m.x, fy:m.y, tx:p.x, ty:p.y, kind:m.spr });
  if (p.iframe > 0) { say('구르며 흘려보냈다.', 'good'); fx({ t:'miss', x:p.x, y:p.y }); return; }
  const chance = clamp(0.20 + (m.atk * 1.25 - ac * 1.6) / 62, 0.05, 0.80);
  if (Math.random() > chance) {
    say(`${m.n}이(가) 쏘았지만 빗나갔다.`);
    fx({ t:'miss', x:p.x, y:p.y });
    return;
  }
  const dmg = hurtPlayer(sanctumSoak(Math.max(1, roll(2, Math.max(3, Math.floor(m.atk * 0.6)))
    - Math.floor(ac / 6) - gearBonus(p).flatDR)), { by: m });

  fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, from:{ x:m.x, y:m.y },
       who:m.n, spr:m.spr, arrow:true, severe: dmg >= p.maxhp * 0.18 });
  say(`멀리서 날아왔다. ${takenLine(m.n, dmg, p.maxhp, nextLine())} (${dmg})`, 'hit');
  if (!G.running) return;
  if (m.on && Math.random() < 0.22) afflict(p, m.on, 8 + rnd(8));
  reflect(m, dmg);
}

/* Movement shared by every AI, including what to do about a
   shut door: most things are simply stopped by one. */
/* 성역: 이미 조용해야 할 것들은 돌에 다가오지 못한다. 나머지는
   전부 다가온다 — 이건 벽이 아니라 결계다. */
function wardedOff(m) {
  const s2 = G.sanctum;
  if (!s2 || s2.left <= 0 || !UNDEAD.includes(m.spr)) return false;
  if (Math.max(Math.abs(s2.x - m.x), Math.abs(s2.y - m.y)) > 1) return false;
  return Math.hypot(m.x - s2.x, m.y - s2.y) <= 1.5;
}

function advance(m, sx, sy) {
  const p = G.player, L = G.level;
  /* 박힌 것은 걷지 않는다. 여기 한 줄로 막는다 — 몬스터가 걷는
     자리는 이 함수뿐이므로, 다른 곳에 같은 검사를 두면 언젠가 갈린다. */
  if (m.nailed) return;
  if (wardedOff(m)) { m.energy = Math.min(m.energy, 0); return; }

  const go = (a, b) => {
    if (!a && !b) return false;
    const nx = m.x + a, ny = m.y + b;
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return false;
    if (monsterAt(nx, ny) || (nx === p.x && ny === p.y)) return false;

    const t = L.tiles[idx(nx, ny)];
    if (isShut(t)) {
      if (!m.door) {
        /* 문 앞에서 멈춰 선 것. 「문을 부순다 — 문으로는 막을 수
           없다」고 적혀 있었다면, 그 줄은 방금 끝났다. 이쪽이 두
           거짓 중 좋은 쪽이다: 겁을 준 기록이 틀렸다는 것을 알게
           되고, 그래서 문 하나가 답이 된다.

           보는 것은 **문**이지 그것이 아니다. 닫힌 문은 시야를
           끊으므로 문 너머의 것은 애초에 안 보인다 — 것을 봐야
           한다고 걸었더니 이 줄은 영영 안 고쳐졌다. 문 뒤에 숨어
           문을 지켜보는 것, 그게 이 장면의 실제 모습이다. */
        if (L.vis[idx(nx, ny)] && hearsayFor(m)?.k === 'door') {
          say(`문 너머에서 무언가가 문을 두드리다 만다.`, 'warn');
          witness(m, 'door');
        }
        return false;
      }
      if (t === DOOR_LOCKED && m.door !== 'smash') return false;
      L.tiles[idx(nx, ny)] = m.door === 'smash' ? DOOR_BROKEN : DOOR_OPEN;
      say(`${m.n}이(가) 문을 ${m.door === 'smash' ? '부쉈다' : '열었다'}.`, 'warn');
      fx({ t:'door', x:nx, y:ny, state: m.door === 'smash' ? 'broken' : 'open' });
      /* 문이 부서지는 것을 봤다 — 「문 닫기가 확실히 통한다」가
         무너지는 자리. 이쪽은 나쁜 소식이고, 나쁜 소식이어야 한다.
         여기서도 보는 것은 문이다: 닫힌 문 너머의 것은 안 보이고,
         그래서 「것이 보일 때만」으로 걸면 이 줄도 영영 안 고쳐진다. */
      if (L.vis[idx(nx, ny)]) witness(m, 'door');
      return true;                    // opening costs the move
    }
    if (L.solid(nx, ny)) return false;

    m.x = nx; m.y = ny;
    if (t === WEB && !m.web) { m.snared = 1 + rnd(2); fx({ t:'struggle', x:nx, y:ny }); }
    return true;
  };
  return go(sx, sy) || go(sx, 0) || go(0, sy);
}

/* ═══ 흐름장 — 한 번 계산해서 전부가 쓴다 ═══════════════
   지금까지 몬스터는 `Math.sign(dx), Math.sign(dy)` 한 걸음으로
   쫓았다. 그건 경로가 아니라 **방향**이고, 방향으로 걷는 것들은
   벽 모서리에 끼고 복도에서 한 줄로 줄을 선다. 그리고 한 줄로 오는
   넷은 하나를 네 번 상대하는 것이라, 판이 위험해지지 않는다 —
   실측으로 체력 30% 아래에서 보낸 턴이 **0%**였다.

   외부 평가 보고서가 다익스트라 맵(흐름장)을 권했다. 그 보고서의
   성능 논거는 우리에게 안 맞지만(우리는 A*를 쓴 적이 없고 층당
   몬스터는 24가 상한이다) **행동** 논거는 정확하다: 흐름장은
   포위·측면 우회·막다른 길 피하기를 공짜로 준다.

   1664칸 BFS 한 번을 턴마다 한다. 그 한 번을 스물넷이 나눠 쓴다.

   두 장을 만든다. 하나는 「너에게로」, 하나는 그것을 뒤집은
   「너에게서 멀리」 — 도망치는 것이 방 구석에 스스로 갇히지 않게
   하는 것이 뒤집은 장의 전부다. 음수 배율 1.2는 도망자가 옆으로
   빠지는 길을 곧장 뒤로 가는 길보다 싸게 만든다(정석적인 값이다). */
const FLOW_FAR = 9999;
const flowTo = new Int16Array(MW * MH);
let flowTurn = -1, flowFrom = -1;

function flowField() {
  const p = G.player, L = G.level;
  const src = idx(p.x, p.y);
  if (flowTurn === G.turn && flowFrom === src) return flowTo;
  flowTurn = G.turn; flowFrom = src;
  flowTo.fill(FLOW_FAR);
  flowTo[src] = 0;
  const q = [src];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % MW, cy = (cur / MW) | 0, d = flowTo[cur];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const ni = idx(nx, ny);
      if (flowTo[ni] <= d + 1) continue;
      /* 닫힌 문은 벽이 아니다 — 문을 여는 것들이 있고, 못 여는
         것은 `advance`가 그 자리에서 되돌린다. 여기서 막으면
         문 하나가 층 전체의 흐름을 끊는다. */
      if (!walkable(L, nx, ny) && !isShut(L.tiles[ni])) continue;
      flowTo[ni] = d + 1;
      q.push(ni);
    }
  }
  return flowTo;
}

/* 이 칸에 붙어 서 있는 동료 수. 같은 높이가 여럿일 때 빈 쪽으로
   퍼지게 하는 값이고, 그 한 줄이 「한 줄로 오던 것」을 「둘러싸는
   것」으로 바꾼다. */
function crowdAt(self, x, y) {
  let n = 0;
  for (const o of G.monsters)
    if (o !== self && Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= 1) n++;
  return n;
}

/* 내리막으로 한 걸음. 같은 높이가 여럿이면 **덜 붐비는 쪽**을 고른다 —
   그것이 포위다. 한 줄로 서는 것은 길이 하나뿐이어서가 아니라 전부가
   같은 칸을 고르기 때문이었다. */
/* 흐름장 위에서 발을 디딜 수 있는 칸인가. 닫힌 문은 여기서 막지
   않는다 — 여는 것들이 있고, 못 여는 것은 `advance`가 되돌린다. */
const standable = (L, x, y) =>
  x >= 0 && y >= 0 && x < MW && y < MH && !monsterAt(x, y)
  && (walkable(L, x, y) || isShut(L.tiles[idx(x, y)]));

const STEPS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

function rollDown(m, uphill) {
  const f = flowField(), L = G.level;
  const here = f[idx(m.x, m.y)];
  if (here >= FLOW_FAR) return false;
  let best = null, bestScore = Infinity;
  for (const [dx, dy] of STEPS) {
    const nx = m.x + dx, ny = m.y + dy;
    if (!standable(L, nx, ny)) continue;
    const v = f[idx(nx, ny)];
    if (v >= FLOW_FAR) continue;
    const score = (uphill ? -1.2 * v : v) + crowdAt(m, nx, ny) * 0.34;
    if (score < bestScore) { bestScore = score; best = [dx, dy]; }
  }
  if (!best) return false;
  /* 내리막이 아니면 안 간다. 제자리보다 나쁜 칸으로 밀려가는 것은
     추격이 아니라 배회다 — 쫓을 때만 그렇고, 도망은 오르막이 목적이다. */
  const target = f[idx(m.x + best[0], m.y + best[1])];
  if (!uphill && target >= here) return false;
  const wasX = m.x, wasY = m.y;
  advance(m, best[0], best[1]);
  return m.x !== wasX || m.y !== wasY;
}

/* 도망. 예전에는 「플레이어 반대 방향으로 한 걸음」이었고, 그래서
   방 구석으로 스스로 걸어 들어가 거기서 죽었다. 이제 안전 장을
   따라 내려간다 — 열린 쪽으로 빠진다. 장이 막히면 옛 걸음으로
   돌아간다(한 칸짜리 굴에서는 그것이 유일한 수다). */
/* 버텨선 전사 옆에서는 물러날 수 없다. 「여기서는 아무도 못 지나간다」가
   규칙이 되는 자리 — 이것이 없으면 버팀은 그냥 방어 버프이고, 있으면
   **길을 막는 기술**이 된다. */
const retreat = m => (m.pinned > 0 ? false : rollDown(m, true))
  || advance(m, Math.sign(m.x - G.player.x), Math.sign(m.y - G.player.y));

/* ── telegraphed ground ───────────────────────────────────
   Mark tiles, print a countdown on them, then hit whatever is
   still standing there. Everything a boss does that is bigger
   than a punch goes through this, so a pattern is a shape plus
   a number and nothing else has to know about it.

   Friendly fire is deliberate: the emperor burns its own escort,
   which means a good position is one that puts something else in
   the fire with you. */
export function castPattern(m, key) {
  const spec = PATTERNS[key];
  if (!spec) return false;
  const L = G.level, p = G.player;
  const tiles = patternTiles(spec, m, p);
  if (!tiles.length) return false;

  G.hazards.push({
    key, tiles, left: spec.warn,
    dmg: Math.max(2, Math.round(m.atk * spec.dmgPct)),
    tone: spec.tone, from: { x: m.x, y: m.y },
    grow: spec.grow ? 1 : 0, r: spec.r || 0, owner: m.n,
  });
  m.cooling = m.cool || 4;
  say(`${m.n}${spec.say}`, 'warn');
  fx({ t:'wake', x:m.x, y:m.y });
  fx({ t:'telegraph', urgent: spec.warn <= 1 });
  return true;
}

function patternTiles(spec, m, p) {
  const L = G.level, out = [];
  const push = (x, y) => {
    if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) return;
    if (L.solid(x, y)) return;
    out.push(idx(x, y));
  };

  if (spec.reach && !spec.r) {
    /* A line, or a cross, drawn through the caster along the axis
       that actually contains you — so standing off the axis is
       the counterplay, and it is visible before it lands. */
    const horiz = Math.abs(p.y - m.y) <= Math.abs(p.x - m.x);
    const arms = spec.n === '십자' ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
               : horiz ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    push(m.x, m.y);
    for (const [dx, dy] of arms)
      for (let i = 1; i <= spec.reach; i++) {
        const x = m.x + dx * i, y = m.y + dy * i;
        if (L.solid(x, y)) break;         // walls stop it
        push(x, y);
      }
    return out;
  }

  // A blob, centred where you are standing *now*.
  const cx = spec.ring ? m.x : p.x, cy = spec.ring ? m.y : p.y;
  const r = spec.r || 1;
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r + 0.35) continue;
      if (spec.ring && d < r - 0.65) continue;   // a ring, not a disc
      push(x, y);
    }
  return out;
}

/* Ticked once per player turn, after the monsters have moved, so
   the count the player reads is the count they get to act on. */
function tickHazards() {
  const p = G.player;
  for (const h of [...G.hazards]) {
    if (--h.left > 0) continue;
    resolveHazard(h);
    if (!G.running) return;

    // 불길 walks outward for a few more turns.
    if (h.grow && h.grow < (PATTERNS[h.key].grow || 0)) {
      h.grow++;
      h.r = h.grow;
      h.tiles = patternTiles({ ...PATTERNS[h.key], r: h.r, ring: true },
                             { x: h.from.x, y: h.from.y }, p);
      h.left = 1;
      if (h.tiles.length) continue;
    }
    G.hazards.splice(G.hazards.indexOf(h), 1);
  }
}

function resolveHazard(h) {
  const p = G.player;
  const hit = new Set(h.tiles);
  fx({ t:'hazard', tiles: h.tiles, tone: h.tone });

  if (hit.has(idx(p.x, p.y))) {
    if (p.iframe > 0) {
      say('구르며 빠져나갔다.', 'good');
      fx({ t:'resist', x:p.x, y:p.y });
    } else {
      const ac = armourClass(p);
      const dmg = hurtPlayer(Math.max(1, Math.round((h.dmg - ac * 0.25) * (1 + (p.perm?.takeMore || 0)))), { by: { n: h.owner } });
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg, who:PATTERNS[h.key].n, spr:'trap',
           low: p.hp <= p.maxhp * 0.25 && p.hp + dmg > p.maxhp * 0.25, severe:true });
      say(`${h.owner}의 ${PATTERNS[h.key].n}에 ${dmg}의 피해.`, 'hit');
      if (!G.running) return;
    }
  }
  // Everything else standing in it, including the caster's own.
  for (const m of [...G.monsters])
    if (hit.has(idx(m.x, m.y)) && !m.disguise)
      hurtMonster(m, Math.round(h.dmg * 0.7), PATTERNS[h.key].n, { crossfire: true });
}

export const hazardAt = (x, y) => {
  const i = idx(x, y);
  for (const h of G.hazards) if (h.tiles.includes(i)) return h;
  return null;
};

/* ── the roll ─────────────────────────────────────────────
   The answer to a telegraph. Two tiles, one turn, and the next
   thing that swings at you this turn misses. Stamina is what
   stops it from being the answer to everything. */
/* 그림자 걸음 (도적): a roll costs one instead of two, which is
   the difference between rolling once a fight and rolling in
   and out of every one. */
export const rollCost = () => (G.player?.cls === 'rogue' ? 1 : ROLL_COST);

export function canRoll() {
  const p = G.player;
  return !!p && p.stam >= rollCost() && !has(p, 'paralyze') && !(p.stuck > 0);
}

/* ── 피할 것이 있는가 ──────────────────────────────────────
   구르기는 같은 방향을 빠르게 두 번 눌러 나간다. 그런데 재 보니
   260ms 창이 **보통 사람이 걸으려고 탭하는 속도**와 겹친다 — 탭 간격
   100·150·200ms에서 전부 굴렀고, 세 칸을 가고 기력이 2 빠졌다.
   그리고 기력은 두 턴에 하나씩 찬다. 즉 걸으려고 두 번 누를 때마다
   네 턴어치 방어 자원이 아무것도 아닌 곳에 나갔고, 스무 턴 뒤 오우거가
   붉은 별을 띄웠을 때 구를 기력이 없다. 오발과 벌이 스무 턴 떨어져
   있어서, 플레이어는 자기가 잘못 눌렀다고 생각하지 않는다 — 게임이
   고장 났다고 생각한다.

   피할 것이 없으면 구르지 않는다. 아무것도 없는 복도에서 구르는 것을
   의도한 사람은 없다. 거미줄·구덩이에 걸린 경우(stuck)는 예외 —
   그때는 구르기가 탈출 수단이다.

   판정은 규칙 쪽에 둔다. 화면이 「위협」을 따로 정의하면 두 곳이
   갈린다. */
export const threatened = () => {
  const p = G.player, L = G.level;
  if (!p || !L) return false;
  if (p.stuck > 0) return true;
  return G.monsters.some(m => m.awake && L.vis[idx(m.x, m.y)]
    && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 3);
};

export function dodgeRoll(dx, dy) {
  const p = G.player, L = G.level;
  if (!dx && !dy) return false;
  if (!canRoll()) { say(p.stam < rollCost() ? '숨이 차다.' : '움직일 수 없다.', 'warn'); return false; }

  let moved = 0;
  for (let i = 0; i < ROLL_DIST; i++) {
    const nx = p.x + dx, ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) break;
    if (L.solid(nx, ny) || monsterAt(nx, ny)) break;
    const t = L.tiles[idx(nx, ny)];
    if (t === CAMP || t === ALTAR || t === EVENT || t === ANVIL || L.shopAt.has(idx(nx, ny))) break;
    p.x = nx; p.y = ny; moved++;
  }
  if (!moved) { say('구를 자리가 없다.', 'warn'); return false; }

  p.stam -= rollCost();
  p.iframe = 1;
  p.stuck = 0;
  /* 굴렀다고 말한다. 여태 아무 말도 없어서, 실수로 구른 사람은 자기가
     세 칸 간 것도 기력이 빠진 것도 모른 채 지나갔다. */
  say(`몸을 던져 ${moved}칸 굴렀다. (기력 −${rollCost()})`, 'good');
  // …and a roll is one of the three things that earns a shade.
  gainShadow(1, 'roll');
  fx({ t:'roll', x:p.x, y:p.y, dx, dy, dist:moved });
  refreshFov();
  // A roll passes over ground rather than stopping on it: no
  // pickup, no trap, and the traps you skipped stay armed.
  endTurn();
  return true;
}

/* ── intent ───────────────────────────────────────────────
   The one idea worth stealing wholesale from Slay the Spire.
   A fight you cannot read is a dice roll; a fight where every
   enemy announces next turn is a puzzle — step back, shut the
   door, drink now or swing now. This mirrors the branches in
   monsterTurn above without touching a thing, so what the icon
   promises is what the monster does.

   Keep the two in step: any new branch up there needs a line
   down here, or the telegraph starts lying. */
export function predictIntent(m) {
  if (!m.awake || m.disguise) return null;
  const p = G.player, L = G.level;
  const dx = p.x - m.x, dy = p.y - m.y;
  const dist2 = dx * dx + dy * dy, dist = Math.sqrt(dist2);

  if (m.staggered > 0) return 'held';
  if (m.snared > 0 && !m.web) return 'held';
  if (m.wind > 0) return 'heavy';
  if (m.casts?.length && !m.cooling && dist2 > 2 && dist <= 9
      && lineClear(L, m.x, m.y, p.x, p.y)) return 'cast';
  if (m.thief) return 'flee';        // it is always running, adjacent or not
  if (dist2 <= 2) return m.heavy ? 'wind' : (m.on ? 'hex' : 'melee');
  if (m.ai === 'still') return 'watch';
  /* 보고 있는 동안에는 아무 예고도 없다. 그것이 예고다. */
  if (m.ai === 'unseen') return L.vis[idx(m.x, m.y)] ? 'watch' : 'close';
  if (m.ai === 'ranged' && m.rng
      && dist <= m.rng && dist >= 2.5 && lineClear(L, m.x, m.y, p.x, p.y)) return 'shoot';
  if (m.thief || ((m.ai === 'coward' || m.fleeing) && m.hp < m.maxhp * 0.35)) return 'flee';
  if (m.ai === 'erratic') return 'erratic';
  return 'close';
}

/* Recomputed once per player turn rather than per monster act,
   because what the player needs is the state of the board when
   it is their move again. */
function readIntents() {
  /* ── 어둠은 예고를 가린다 ──────────────────────────────
     기름 소모를 4배로 올리고 4분의 1로 낮춰 봤더니 도달 층이
     6.42 / 5.98 / 6.08 — 오차 안에서 같았다. 기름이 덜 무는 게
     아니라 **결과와 연결이 끊겨** 있었다. 불이 꺼져도 반경 2 안은
     그대로 보이고 싸움은 대개 붙어서 하므로, 어둠이 전투에 아무 값도
     안 매기고 있었다.

     예고(붉은 별)는 이 게임에서 가장 값진 정보다 — 읽으면 물러설 수
     있고 못 읽으면 2.5배를 맞는다. 그리고 그것은 **보는 것**이다.
     그래서 규칙 쪽에 둔다: 처음에 그리는 쪽만 가렸더니 봇은 규칙에서
     예고를 직접 읽으므로 아무것도 안 변했다 — 화면만 가리는 것은
     사람에게만 참인 규칙이고, 그런 것은 잴 수가 없다.

     방이 밝으면 제 불이 아니어도 보인다. 어둠의 값이지 근시의 값이
     아니다. 그리고 붙어 있는 것은 언제나 보인다 — 코앞에서 팔을
     당기는 것을 못 보는 것은 어둠이 아니라 부당함이다. */
  const p = G.player, L = G.level;
  const blind = p && L && G.depth > 0 && p.lightTurns <= 0 && !hasRelic('nighteye');
  for (const m of G.monsters) {
    const it = predictIntent(m);
    if (!blind || !it) { m.intent = it; continue; }
    const near = Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 1;
    const rid = L.roomOf[idx(m.x, m.y)];
    const lit = rid >= 0 && L.rooms[rid]?.lit;
    m.intent = (near || lit) ? it : null;
    /* 「고장이 아니다」는 처음 그 순간에 말해야 한다 — 규칙이 예고를
       실제로 삼킨 바로 그 자리에서. 그리고 `heavy`일 때만 건다:
       가벼운 예고가 사라진 것은 눈치채지도 못하지만, 2.5배짜리 한 방이
       무표시로 오는 것은 화면이 깨진 것처럼 보인다. 화면 쪽은 이 깃발을
       읽어 수업 카드를 한 번 띄운다 — 규칙은 수업이 있는 줄 모른다. */
    if (m.intent === null && it === 'heavy') G.darkAte = true;
  }
}

/* ── the fire ─────────────────────────────────────────────
   「불은 몸과 유물의 것, 모루는 쇠의 것」이라고 그어 놓고 그 선을
   같은 화면에서 두 번 넘었다 — 융합도 먹이기도 유물인데 둘 다 모루에
   있다. 선을 다시 긋는다: 모루는 쇠를 두들기는 곳이고, 유물을 거기
   올리는 것은 두들기려는 게 아니라 **불 옆에서만 그것들이 입을 열기
   때문이다.** 불은 이제 셋 중 하나를 주는 자리다 — 심지·지짐·휴식.

   One per floor, one choice, no take-backs. Rest is the safe
   pick and buys you nothing lasting. Enhancement is a small,
   certain, permanent gain. The enchant is the gamble: a real
   affix most of the time, a curse some of the time, and it can
   land on top of one you already had. The whole point is that
   at full health the first option is worthless and at 20% it is
   the only sane one. */
/* 0.40이면 모닥불 한 번에 몸이 새것이 된다. 재 보니 판의 60%를
   체력 90~100%에서 보냈고, 그 대부분이 이 한 줄에서 나왔다. */
/* 숨 돌리기가 단독 선택지가 되었으므로 심지·지짐과 겨룰 값이어야
   한다. 0.28은 「앉은 김에」의 값이었다. */
export const CAMP_HEAL = 0.34;
/* Gear climbs to 8 now that the odds gate it; a spell's plus is
   a multiplier, so it stays where it was. */
export const MAX_PLUS = 10;   // 8에서 올렸다 — 위쪽 네 칸이 벼랑이다
/* 정예가 남기는 것의 수. 셋을 굴려 놓고 하나만 가져간다. */
export const SPOIL_PICKS = 3;

/* ── 왜 내려가는가 ─────────────────────────────────────────
   아래에 있는 것이 세상을 먹고 있다. 그것을 죽이는 것 말고는
   방법이 없고, 그래서 사람들은 계속 내려보낸다. 아무도 돌아오지
   못했다 — 한 사람도.

   그래서 당신은 「모험가」가 아니라 「이번 사람」이다. 앞의 것들이
   어디까지 갔는지는 그들이 남긴 것으로만 안다. 이것이 기억(메타
   진행)이 왜 남는지도 같이 설명한다: 남는 것은 네 실력이 아니라
   앞서 죽은 자들이 벽에 긁어 놓은 것이다.

   빚 이야기를 한 번 썼다가 물렸다. 사명감이 있어야 이 가혹함이
   비극이 되지, 팔려 온 사람의 이야기면 그냥 불행이다. */
export const sentDown = () => (Meta.read().runs || 0) + 1;
export const MAX_SPELL_PLUS = 5;
const capFor = t => (t.type === 'spell' || t.kind === 'spell' ? MAX_SPELL_PLUS : MAX_PLUS);

/* ── 모루가 손댈 수 있는 것 ────────────────────────────────
   화면과 규칙이 서로 다른 답을 내고 있었다. 화면은 이름 붙은 물건을
   `capped: true`로 막아 놓고 「최대 +8」이라고 적었는데(+0인 물건에
   대고 하는 거짓말이다), 규칙 쪽 anvilStrike·anvilEnchant에는 unique
   검사가 아예 없었다. 실제로 재 보니 《약속》이 강화도 되고 인챈트도
   먹었다 — 데이터에 「접사가 붙지 않고, 벼려지지 않는다」고 적어 둔
   바로 그 물건이.

   그래서 판정을 한 자리로 모은다. 화면이 읽는 값과 규칙이 쓰는 값이
   같은 함수에서 나오면 둘이 갈릴 수가 없다. 그리고 막을 때는 **값을
   치르기 전에** 막는다 — 재료만 먹고 아무 일도 안 일어나는 것이
   이 화면에서 가장 나쁜 일이다. */
export function forgeBlock(t, mode) {
  if (!t) return '고를 수 있는 것이 없다';
  const it = t.type === 'item' ? t.item : (t.item || null);
  if (t.type === 'spell' || t.kind === 'spell') {
    if (mode === 'enchant' || mode === 'reroll') return null;
    return (plusOf(t) >= MAX_SPELL_PLUS) ? `더 연마할 수 없다 (최대 +${MAX_SPELL_PLUS})` : null;
  }
  if (!it) return '고를 수 있는 것이 없다';
  /* 이름 붙은 것은 이미 제 모습이다. 여기서 한 줄로 막고, 화면도
     같은 줄을 읽어 「왜 안 되는지」를 그대로 보여 준다. */
  /* 「이름이 붙은 것은 이미 제 모습이다」라며 막아 두었던 줄이다.
     그 한 줄이 이 물건들을 판 중반의 죽은 가지로 만들고 있었다 —
     강화가 곱이 된 지금 +8은 1.72배이고, 그것을 못 받는 무기는
     주우면 곧 뒤처진다. 이름이 붙었다고 자라지 못할 이유는 없다.
     대신 값이 다르다: 이름 붙은 것을 두들기는 데는 두 배가 든다
     (upgradeCostFor의 `dear`). */
  if (mode === 'reroll' && !it.pre && !it.suf) return '다시 굴릴 속성이 없다';
  if (mode === 'refine' && !(it.engrave || []).length) return '다시 새길 각인이 없다';
  if (mode === 'upgrade' && (it.plus || 0) >= MAX_PLUS) return `더 벼릴 수 없다 (최대 +${MAX_PLUS})`;
  return null;
}

export function campTargets() {
  const p = G.player, out = [];
  for (const [slot, label] of [['weapon', '무기'], ['body', '갑옷'], ['shield', '방패']]) {
    const it = p.equip[slot];
    // A named weapon is already what it is: the anvil has nothing
    // to add and everything to lose.
    if (it) {
      const t = { type:'item', item: it };
      out.push({
        key: `eq:${slot}`, label, name: affixName(it), kind: it.kind, item: it,
        plus: it.plus || 0, cap: MAX_PLUS,
        /* 모드마다 막히는 이유가 다르다. 화면은 이 세 줄을 그대로
           읽어서 「최대 +8」 같은 거짓말 대신 진짜 이유를 적는다. */
        block: {
          upgrade: forgeBlock(t, 'upgrade'),
          enchant: forgeBlock(t, 'enchant'),
          reroll:  forgeBlock(t, 'reroll'),
          refine:  forgeBlock(t, 'refine'),
        },
        capped: !!forgeBlock(t, 'upgrade'),
      });
    }
  }
  for (const s of spellList(p)) {
    const plus = p.spellPlus?.[s.id] || 0;
    const aff = p.spellAffix?.[s.id];
    const affN = aff ? SPELL_AFFIXES.find(a => a.id === aff)?.n : null;
    out.push({
      key: `sp:${s.id}`, label: '주문', kind: 'spell', spell: s,
      name: `${plus ? `+${plus} ` : ''}${affN ? affN + ' ' : ''}${s.name}`,
      plus, capped: plus >= MAX_SPELL_PLUS, cap: MAX_SPELL_PLUS,
      block: {
        upgrade: plus >= MAX_SPELL_PLUS ? `더 연마할 수 없다 (최대 +${MAX_SPELL_PLUS})` : null,
        enchant: null, reroll: null,
      },
    });
  }
  return out;
}

const targetOf = key => {
  const p = G.player;
  if (key.startsWith('eq:')) return { type: 'item', item: p.equip[key.slice(3)] };
  if (key.startsWith('sp:')) return { type: 'spell', id: key.slice(3) };
  return null;
};

/* What the bank is worth right now, or null if there is
   nothing on the table. The fire screen prints this next to
   "rest", because the price of resting *is* the pile. */
export function bankPurse2() {
  if (!(G.bank >= 2)) return null;
  return { floors: G.bank, ...bankPurse(G.bank, G.depth) };
}

/* Taking the pile. Deliberately its own option rather than a
   side effect of resting, so cashing out is a decision the
   player makes with their thumb — and so it can be refused. */
export function campCash() {
  const p = G.player, purse = bankPurse2();
  if (!purse) { say('걸린 판돈이 없다.'); return; }
  const got = goldGain(purse.gold);      // 한 번만 — 위 5191과 같은 병이었다
  p.gold += got;
  p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
  for (const k of ['scrap', 'dust', 'essence']) p.mats[k] += purse[k] || 0;
  G.bank = 0;
  say(`${purse.floors}층치 판돈을 챙겼다 — 금화 ${got}닢.`, 'level');
  fx({ t:'altar', x:p.x, y:p.y, result:'대성공' });
  spendCamp();
}

/* ── 불은 셋 중 하나만 준다 ───────────────────────────────
   원래는 한 번 앉으면 심지도 갈고 상처도 지지고 숨도 돌렸다. 장부를
   떠 보니(sim/hearth.mjs, 48판·앉기 178회) **상처를 260어치 지지고
   나면 기름이 480에서 519로 늘어 있었다** — 같은 호출 안에서 +200을
   먼저 줬기 때문이다. 상한 1100짜리 자원에서 순 비용 60. 「몸과 시계가
   같은 저울에 오른다」는 주석은 희망이었고, 저울이 없었다.
   그리고 앉기의 46%는 체력이 이미 가득이라 회복이 0이었다 —
   즉 절반은 아무 결정도 아닌 자리에서 불을 태우고 있었다.

   보충과 지출을 떼면 저울이 생긴다. 심지 · 지짐 · 숨, 셋 중 하나.
   불은 여전히 층마다 하나이므로 이제 「무엇을 포기하는가」가 매 층
   묻힌다 — 어두운 채로 성한 몸으로 갈 것인가, 밝은 채로 상한 몸으로
   갈 것인가. 지짐에 체력 8%를 붙인 것은 그것이 **안전한 선택**이
   되지 않게 하기 위해서다. 상처를 지지는 일은 아프다. */
export const CAMP_OIL = 340;     // 심지만 갈 때. 예전 200에 지짐 몫을 얹었다
export const WOUND_OIL = 260;    // 상처를 전부 지지는 데 드는 기름
export const CAMP_SEAR_HP = 0.08;

/* 앉는 순간 판돈은 탄다 — 어느 쪽을 고르든. */
function sitDown() {
  if (G.bank >= 2) say(`판돈 ${G.bank}층치가 불에 탔다.`, 'warn');
  G.bank = 0;
}

/* ① 심지를 갈다. */
export function campWick() {
  const p = G.player;
  sitDown();
  const oil = Math.min(oilCap() - p.lightTurns, CAMP_OIL);
  p.lightTurns += oil;
  say(oil > 0 ? `심지를 갈았다. 기름 +${oil}. 다음 층은 볼 수 있다.`
              : '심지는 아직 성하다. 태울 것이 없다.', 'good');
  spendCamp();
}

/* ② 지지다. 기름과 살을 함께 낸다. */
export function campSear() {
  const p = G.player;
  sitDown();
  const cost = Math.min(p.lightTurns, WOUND_OIL);
  const share = cost / WOUND_OIL;
  const burn = Math.max(1, Math.round(p.maxhp * CAMP_SEAR_HP));
  const mend = mendWound(share);          // 천장을 되돌리는 문은 하나다
  p.lightTurns -= cost;
  say(share >= 1 ? `불에 지졌다. 상처 ${mend}이(가) 닫혔다. (기름 −${cost})`
                 : `기름이 모자라 절반만 지졌다. 상처 ${mend}. (기름 −${cost})`, 'good');
  /* 지짐도 한 대다 — 그러니 단일 깔때기를 지난다. 여기서 죽을 수 있고,
     죽어야 한다: 상처를 지지려고 마지막 체력을 낸 것이니까. */
  hurtPlayer(burn, { by:'제 손으로 지진 불', combo:false });
  if (G.running) say('살이 타는 냄새가 손에 오래 남는다.', 'warn');
  if (G.running) spendCamp();
}

/* ③ 숨을 돌리다. */
export function campRest() {
  const p = G.player;
  sitDown();
  /* 불 앞에서는 셈이 풀린다. 앉는다는 것은 몸이 한 번 가라앉는
     일이고, 이 게임에서 그것을 살 수 있는 자리는 여기뿐이다. */
  G.gulped = 0;
  const heal = Math.min(p.maxhp - p.hp,
    Math.ceil(p.maxhp * CAMP_HEAL * (hasShackle('dryspring') ? 0.5 : 1)));
  p.hp += heal;
  p.mana = p.maxmana;
  const cured = ailList(p);
  p.ail = {};
  p.stuck = 0;
  if (heal) fx({ t:'heal', x:p.x, y:p.y, amt:heal });
  say(heal ? `불 앞에서 숨을 돌렸다. 체력 +${heal}. 이것으로 충분할 리 없다.`
           : '불 앞에 앉았다. 아직 성한 몸이라는 것이 이상하다.', 'good');
  if (cured.length) say(`${cured.map(k => AILMENTS[k].n).join(' · ')}이(가) 가셨다.`, 'good');
  spendCamp();
}

const plusOf = t =>
  t.type === 'item' ? (t.item?.plus || 0) : (G.player.spellPlus?.[t.id] || 0);

/* ── 모루의 값은 층을 따라간다 ─────────────────────────────
   실측: 13층에 도달한 영웅의 금화 중앙값이 12,597 인데 인챈트 한 번이
   130이다 — **96회분**을 들고 있고, 그 층 실제 장비의 평균 강화치는
   +0.28이다. 돈이 남아도는 것이 아니라 **나갈 구멍이 층을 못 따라간다**.
   1층 값을 그대로 두고 깊이에 따라 올린다: 13층이면 ×14.6.

   재료(가루·정수)는 안 올린다 — 그쪽은 분해·판매의 갈림이 이미
   살아 있고(sim/purse.mjs), 둘 다 올리면 후반에 모루가 통째로 닫힌다.
   막힌 것은 금화 쪽 하나다. */
export const ANVIL_STEP = 1.28;
export const anvilCost = (base, depth = G.depth) => {
  if (!base?.gold) return base;
  const mult = ANVIL_STEP ** Math.max(0, (depth || 1) - 1);
  return { ...base, gold: Math.round(base.gold * mult) };
};

export const upgradeCostFor = (key, careful = false) => {
  const t = targetOf(key);
  if (!t) return null;
  // 식은 모루 raises the bill as well as lowering the odds, so the
  // shackle bites the gold sink rather than only the dice.
  /* 이름 붙은 것은 두 배로 든다. 벼릴 수는 있게 하되 값이 달라야
     한다 — 안 그러면 「고유를 주웠으니 이제 모루는 이것만」이 되고,
     그러면 나머지 장비가 전부 죽은 가지가 된다. */
  const named = (t.item?.unique) ? 2 : 1;
  /* 그리고 「많이 쓰는」 절. 벌이만 두 배로 해 놓고 값을 안 올리면
     탐욕은 양날이 아니라 순증이 된다 — 지금까지는 반대로 순감이었다. */
  const dear = (hasShackle('coldanvil') ? 1.4 : 1) * named
             * (hasArcana('greed') ? 2 : 1);
  const raw = upgradeCost(plusOf(t));
  const base = {};
  for (const k of Object.keys(raw)) base[k] = Math.ceil(raw[k] * dear);
  if (!careful) return base;
  const out = {};
  for (const k of Object.keys(base)) out[k] = Math.ceil(base[k] * CAREFUL_MULT);
  return out;
};

/* Everything the fire screen needs to print the bet before the
   player takes it — the same numbers the roll actually uses, so
   what is shown and what happens cannot drift apart. */
export function upgradeOddsFor(key, careful = false, cat = null) {
  const t = targetOf(key);
  if (!t) return null;
  const plus = plusOf(t);
  const risk = careful ? { down: 0, breakPct: 0 } : upgradeRisk(plus);
  const spec = cat ? catalystById(cat) : null;
  const c = spec?.on === 'upgrade' ? spec.id : null;
  return {
    plus,
    cap: capFor(t),
    // The first strikes are certain on purpose. A 1% failure on
    // a +0 sword would teach a new player the wrong lesson about
    // a screen they have just met.
    /* A milestone strike is doing two jobs — the number and the
       engraving — so it is markedly harder than its neighbours.
       This is the risk the reward is attached to. */
    milestone: t.type === 'item' && isMilestone(plus),
    odds: c === 'core' ? 1
        : Math.max(0.05, Math.min(1, upgradeOdds(plus)
            + (careful ? CAREFUL_BONUS : 0)
            + (hasMemory('graver') ? 0.06 : 0)
            - (hasShackle('coldanvil') ? 0.08 : 0)
            - (t.type === 'item' && isMilestone(plus) ? ENGRAVE_PENALTY : 0))),
    crit: c === 'surge' ? 1 : careful ? 0 : UPGRADE_CRIT,
    down: c === 'flux' ? 0 : risk.down,
    // A spell cannot shatter; there is nothing to shatter. Nor
    // can a 불괴의 — that is what the 은총 is for — and a 수호의
    // 못 buys the same protection for one strike.
    // 정련의 촉매 deliberately does *not* stop a shatter: the two
    // catalysts have to answer different questions or the cheap
    // one makes the expensive one pointless.
    breakPct: c === 'ward' ? 0
            : t.type === 'item' && t.item?.boon !== 'aegis' ? risk.breakPct : 0,
    /* 화면이 「무엇을 걸고 있는지」를 전부 읽을 수 있어야 한다.
       저주도 판돈의 일부다. */
    hexPct: !careful && t.type === 'item' && plus >= UPGRADE_HEX_FROM ? UPGRADE_HEX_PCT : 0,
    cat: c,
  };
}

/* ── the anvil ────────────────────────────────────────────
   Enhancement used to live at the fire, competing with rest and
   enchant for a single use — so a whole run got four or five
   attempts total and the failure odds had nothing to bite on.
   The anvil is not spent. You strike it until the purse is
   empty, which is what makes going broke a way to play.

   `cat` is an optional catalyst id, consumed on the strike and
   only if it is a catalyst this action accepts.              */
export function anvilStrike(key, careful = false, cat = null) {
  const p = G.player, t = targetOf(key);
  if (!t) return;
  trace('anvil', { at: plusOf(t), gold: p.gold, careful: !!careful, cat: cat || null });
  const cap = capFor(t);
  const name = t.type === 'item'
    ? (t.item ? affixName(t.item) : null)
    : (spellList(p).find(s => s.id === t.id)?.name || '주문');
  /* 막는 것이 먼저, 값은 그다음. 순서가 뒤집혀 있으면 「재료만 먹고
     아무 일도 없었다」가 된다. */
  const why = forgeBlock(t, 'upgrade');
  if (why) { say(`${name} — ${why}.`, 'warn'); return; }
  const cost = upgradeCostFor(key, careful);
  if (!canAfford(cost)) { say(`재료가 모자란다 — ${costText(cost)}.`, 'warn'); return; }

  const c = useCatalyst(cat, 'upgrade');
  const bet = upgradeOddsFor(key, careful, c?.id);
  spend(cost);
  if (c) say(`${c.n}을(를) 함께 넣었다.`, 'good');

  if (c?.id === 'core' || Math.random() < bet.odds) {
    // 과감 pays double one time in eight; 폭주의 불씨 makes it
    // certain. That is the whole reason to take the risky strike
    // when the safe one is affordable.
    /* 두 단계, 그리고 아주 드물게 세 단계. 세 번째 칸은 +5 위에서만
       열린다 — 초반에 터지면 그 뒤가 전부 심심해진다. */
    let step = (c?.id === 'surge' || Math.random() < bet.crit) ? 2 : 1;
    if (step === 2 && bet.plus >= UPGRADE_SURGE_FROM && Math.random() < UPGRADE_SURGE) step = 3;
    if (t.type === 'item') {
      t.item.plus = Math.min(cap, (t.item.plus || 0) + step);
      recalc(p);
    } else {
      p.spellPlus = p.spellPlus || {};
      p.spellPlus[t.id] = Math.min(cap, (p.spellPlus[t.id] || 0) + step);
    }
    G.forged = (G.forged || 0) + step;
    // Every milestone crossed by this strike cuts its engraving.
    if (t.type === 'item') engraveUpTo(t.item);
    if (step >= 3) {
      say(`${name} — 쇠가 울부짖는다. 세 단계 올랐다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y, big:true, surge:true });
    } else if (step === 2) {
      say(`${name} — 쇠가 노래한다. 두 단계 올랐다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y, big:true });
    } else {
      say(t.type === 'item' ? `${name} — 날이 섰다.` : `${name}을(를) 연마했다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y });
    }
    return;
  }

  /* 대박. 실패한 손이 되레 맞는 일이 아주 드물게 있다. 부서지기
     직전까지 갔다가 살아 돌아오는 것이 이 화면에서 가장 기억에
     남는 순간이고, 그 순간은 만들어 줘야 생긴다. */
  if (Math.random() < JACKPOT.forge) {
    if (t.type === 'item') {
      t.item.plus = Math.min(cap, (t.item.plus || 0) + 1);
      engraveUpTo(t.item);
      recalc(p);
    } else {
      p.spellPlus = p.spellPlus || {};
      p.spellPlus[t.id] = Math.min(cap, (p.spellPlus[t.id] || 0) + 1);
    }
    G.forged = (G.forged || 0) + 1;
    say(`${name} — 꺼진 줄 알았던 불이 되살아났다.`, 'level');
    fx({ t:'forge', x:p.x, y:p.y, big:true, surge:true });
    return;
  }

  /* The strike failed. What that costs depends on how far out on
     the limb you already were — and on what you threw in with it. */
  if (bet.breakPct && Math.random() < bet.breakPct) {
    breakItem(t.item);
    say(`${name}이(가) 쨍 하고 갈라졌다. 남은 것은 손잡이뿐이다.`, 'bad');
    fx({ t:'shatter', x:p.x, y:p.y });
  } else if (bet.down) {
    if (t.type === 'item') { t.item.plus = Math.max(0, (t.item.plus || 0) - 1); recalc(p); }
    else p.spellPlus[t.id] = Math.max(0, (p.spellPlus[t.id] || 0) - 1);
    say(`${name} — 금이 갔다. 한 단계 물러섰다.`, 'warn');
    fx({ t:'forge', x:p.x, y:p.y, fail:true });
    /* 그리고 위쪽에서는 망가진 채로 남을 수 있다. 부서지면 다시
       구하면 되지만 저주는 들고 다녀야 한다 — 「신중」은 이것도
       사 준다(down이 0이므로 여기에 오지 않는다). */
    if (bet.hexPct && Math.random() < bet.hexPct) {
      const table = Math.random() < 0.5 ? PREFIXES : SUFFIXES;
      const a = pickAffixFor(table, t.item.kind, true);
      if (a) {
        t.item[table === PREFIXES ? 'pre' : 'suf'] = a.id;
        recalc(p);
        say(`식은 자리에 검은 것이 앉았다 — ${a.n}.`, 'bad');
        fx({ t:'enchant', x:p.x, y:p.y, cursed:true });
      }
    }
  } else {
    say(`${name} — 불꽃이 사그라든다. 아무 일도 없었다.`, 'warn');
    fx({ t:'forge', x:p.x, y:p.y, fail:true });
  }
}

/* Cut whatever engravings the item's plus has now earned. Driven
   off the plus rather than off the strike, so an item that jumped
   two steps at once gets both, and an item that was knocked back
   down and climbed again does not get a second copy. */
function engraveUpTo(it) {
  if (!it) return;
  const want = engraveSlots(it.plus);
  it.engrave = it.engrave || [];
  while (it.engrave.length < want) {
    const held = new Set(it.engrave);
    const pool = ENGRAVINGS.filter(e =>
      e.tags.includes(it.kind === 'weapon' ? 'weapon' : 'armour') && !held.has(e.id));
    if (!pool.length) break;
    const e = pool[rnd(pool.length)];
    it.engrave.push(e.id);
    G.engraved = (G.engraved || 0) + 1;
    say(`쇠에 무늬가 돋았다 — ${e.n} ${it.n}. ${e.t}`, 'level');
    lore('쇠에 돋은 무늬', `${e.n} ${it.n}`, e.t, it.spr);
    fx({ t:'engrave', x:G.player.x, y:G.player.y });
  }
}

/* Spend one, if it is there and if this action takes it. Returns
   the catalyst so the caller can name it and read its rule. */
function useCatalyst(id, on) {
  if (!id) return null;
  const p = G.player;
  const spec = catalystById(id);
  if (!spec || spec.on !== on) return null;
  const i = p.pack.findIndex(s => s.item.kind === 'cat' && s.item.id === id);
  if (i < 0) return null;
  removeItem(p, i);
  G.catUsed = (G.catUsed || 0) + 1;
  return spec;
}

export const catalystsHeld = (on) => {
  const p = G.player;
  if (!p) return [];
  return p.pack
    .map((s, i) => ({ idx: i, qty: s.qty, spec: catalystById(s.item.id), kind: s.item.kind }))
    .filter(x => x.kind === 'cat' && x.spec && (!on || x.spec.on === on))
    .map(x => ({ ...x.spec, qty: x.qty }));
};

/* ── fusion ───────────────────────────────────────────────
   Two relics into the fire. Six pairs are written to recognise
   each other and always produce the same 초월 relic; every other
   pair rolls on a printed table. The screen never names the six
   — the twelve relic descriptions do, and a player who reads
   them is being rewarded for reading them.

   `canFuse` is the whole gate: two relics held, the fire unspent,
   and the price on the table. */
export const canFuse = () => (G.player?.relics || []).length >= 2;

/* Do these two know each other? Reported without naming the
   result, so an undiscovered pair still has to be committed to.
   Once found, the ledger remembers and the screen says so. */
export function fusePreview(a, b) {
  if (!a || !b || a === b) return null;
  const f = fusionOf(a, b);
  if (!f) return { special: false };
  return { special: true, out: f.out, known: Meta.seen('fusions', f.out) };
}

/* 융합은 이제 모루에서 한다. 모닥불에서 하던 시절에는 심지·지짐·숨
   셋과 같은 한 번을 놓고 겨뤄야 했고, 그래서 **한 번도 안 일어났다** —
   24판에서 조합 가능한 짝을 든 턴이 46.2%(26,598턴 중 12,282턴)이고
   판의 절반이 짝을 손에 든 채 끝났는데 실제 조합은 0회였다.
   불에 넣는 일이면 모루가 더 맞는 자리이고, 모루는 초반에 재료가
   없어 놀고 있었다. 그리고 모루는 닳지 않으므로 융합도 이제 층의
   유일한 한 번을 잡아먹지 않는다. */
export function fuseRelics(a, b) {
  const p = G.player;
  if (!p || a === b) return;
  const ia = p.relics.indexOf(a), ib = p.relics.indexOf(b);
  if (ia < 0 || ib < 0) return;
  if (!canAfford(FUSE_COST)) { say(`재료가 모자란다 — ${costText(FUSE_COST)}.`, 'warn'); return; }
  spend(FUSE_COST);

  const f = fusionOf(a, b);
  const drop = () => {
    // Remove both, high index first so the low one does not shift.
    for (const i of [ia, ib].sort((x, y) => y - x)) { forgetRelic(p.relics[i]); p.relics.splice(i, 1); }
  };

  if (f) {
    drop();
    p.relics.push(f.out);
    const r = relicById(f.out);
    const first = Meta.see('fusions', f.out);
    Meta.see('relics', f.out);
    G.fused = (G.fused || 0) + 1;
    say(`${relicById(a).n}과(와) ${relicById(b).n}이(가) 서로를 알아본다.`, 'level');
    say(`— ${r.n}. ${r.t}${first ? ' (처음 찾아낸 조합)' : ''}`, 'level');
    fx({ t:'transcend', x:p.x, y:p.y });
    recalc(p);
    return;
  }

  const roll = pickWeighted(FUSE_ODDS);
  if (roll.id === 'new') {
    /* Rolled *before* the two are removed, so the fire can never
       hand back one of the things you just fed it. */
    const id = unownedRelic();
    drop();
    if (id) {
      p.relics.push(id);
      Meta.see('relics', id);
      const r = relicById(id);
      say(`쇳물에서 ${r.n}이(가) 떠올랐다.`, 'level');
      say(r.t, 'level');
      fx({ t:'altar', x:p.x, y:p.y, good:true });
    } else say('더 나올 유물이 없다. 둘 다 녹아 없어졌다.', 'warn');
  } else if (roll.id === 'tune') {
    const keep = Math.random() < 0.5 ? a : b;
    drop();
    p.relics.push(keep);
    p.tuned = p.tuned || {};
    const r = relicById(keep);
    // Half again of whatever the relic's number means, to two
    // decimals — the same funnel handles 체력 +3 and 흡혈 0.35.
    const gain = Math.round(r.v * 50) / 100;
    p.tuned[keep] = (p.tuned[keep] || 0) + gain;
    say(`${r.n}이(가) 다른 하나를 삼키고 정련되었다. (${r.v} → ${r.v + p.tuned[keep]})`, 'level');
    fx({ t:'forge', x:p.x, y:p.y, big:true });
  } else {
    drop();
    p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
    p.mats.essence += 2; p.mats.dust += 5;
    say('둘 다 녹아내렸다. 남은 것은 정수 2와 마력 가루 5뿐이다.', 'warn');
    fx({ t:'forge', x:p.x, y:p.y, fail:true });
  }
  recalc(p);
}

function pickWeighted(table) {
  const total = table.reduce((s, o) => s + o.w, 0);
  let n = Math.random() * total;
  for (const o of table) { if (n < o.w) return o; n -= o.w; }
  return table[table.length - 1];
}

/* Losing the sword off your own arm. Left unequipped rather than
   silently replaced: standing there with an empty hand is the
   point, and the player chose this. */
function breakItem(it) {
  const p = G.player;
  for (const slot of GEAR_SLOTS)
    if (p.equip[slot] === it) p.equip[slot] = null;
  const i = p.pack.findIndex(s => s.item === it);
  if (i >= 0) p.pack.splice(i, 1);
  G.broke = (G.broke || 0) + 1;
  recalc(p);
}

/* Enchant and reroll moved to the anvil with enhancement. The
   fire is for the body and the relics now; the anvil is for the
   metal, and all three metal actions cost materials rather than
   the one use a floor grants. */
/* ── 정수가 갈 두 곳 ──────────────────────────────────────
   정수는 재굴림 하나에만 1개씩 들어가서, 판이 끝날 때까지 주머니에
   쌓이기만 했다(sim/purse.mjs). 나가는 구멍이 없는 재료는 재료가
   아니라 점수다.

   둘 다 **이미 가진 것을 고쳐 쓰는** 일로 팠다. 새 물건을 주는 구멍을
   더 파면 그건 재료가 아니라 상점이 하나 더 생기는 것이고, 이 게임이
   모자란 것은 물건이 아니라 「고른 것을 밀고 갈 방법」이다.        */
export function anvilRefine(key) {
  const p = G.player, t = targetOf(key);
  if (!t) return;
  const why = forgeBlock(t, 'refine');
  if (why) { say(`${why}.`, 'warn'); return; }
  if (!canAfford(anvilCost(REFINE_COST))) { say(`재료가 모자란다 — ${costText(anvilCost(REFINE_COST))}.`, 'warn'); return; }
  const it = t.item;
  /* 가장 마지막에 돋은 것을 다시 굴린다. 고를 수 있게 하면 화면이
     한 겹 늘고, 실제로 마음에 안 드는 것은 대개 방금 나온 것이다. */
  const old = it.engrave[it.engrave.length - 1];
  const held = new Set(it.engrave);
  const pool = ENGRAVINGS.filter(e => e.tags.includes(it.kind) && !held.has(e.id));
  if (!pool.length) { say('이 물건에 더 새길 것이 없다.', 'warn'); return; }
  spend(anvilCost(REFINE_COST));
  const e = pool[rnd(pool.length)];
  it.engrave[it.engrave.length - 1] = e.id;
  /* 동사가 세계와 어긋나 있었다. 이 게임에서 각인은 대장장이가
     새기는 것이 아니라 **돋는 것**이다(engraveUpTo의 주석과 매뉴얼이
     둘 다 그렇게 쓴다) — 무엇이 나올지 모르는 이유가 그것이다.
     「갈아 내고 새긴다」는 그 이유를 지운다. 지지고, 다시 돋는다. */
  say(`${engraveById(old)?.n}이(가) 돋았던 자리를 다시 지졌다. 쇠가 다른 것을 내놓았다 — ${e.n}. ${e.t}`, 'level');
  fx({ t:'engrave', x:p.x, y:p.y });
  recalc(p);
}

/* 처음에 이 행위를 「조율」이라고 불렀다. 틀린 말이었다 — 이 게임의
   유물은 물건이 아니다. 자루가 굶고(hunger), 눈이 감기지 않고(eye),
   저울이 당신을 재고(scale), 장부에는 당신 줄이 비어 있다(ledger).
   그런 것들을 「맞춘다」는 것은 그것들에게 의지가 없다고 선언하는
   것이고, 유물 표 마흔 개가 부정하는 명제를 버튼 하나가 뒤집는다.

   그리고 값이 **정수**다. 매뉴얼이 정수를 「이름의 재화」라고 부른다.
   이름을 먹여서 물건을 조율한다는 것은 앞뒤가 안 맞는다 — 이름을
   먹는 것은 조율당하지 않는다. 그래서 먹인다. */
export const feedable = id => FEEDABLE.has(id);
export function attuneRelic(id) {
  const p = G.player;
  if (!hasRelic(id)) { say('그 유물이 없다.', 'warn'); return; }
  if (!feedable(id)) { say(`${relicById(id).n}은(는) 받아먹지 않는다.`, 'warn'); return; }
  p.tuned = p.tuned || {};
  const r = relicById(id);
  const step = attuneStep(r);
  if ((p.tuned[id] || 0) >= step * ATTUNE_MAX) {
    say(`${r.n}은(는) 더 안 먹는다.`, 'warn'); return;
  }
  if (!canAfford(anvilCost(ATTUNE_COST))) { say(`먹일 것이 모자란다 — ${costText(anvilCost(ATTUNE_COST))}.`, 'warn'); return; }
  spend(anvilCost(ATTUNE_COST));
  p.tuned[id] = (p.tuned[id] || 0) + step;
  say(`${r.n}에 이름을 먹였다. 조금 더 당신 쪽으로 왔다. (${r.v} → ${(r.v + p.tuned[id]).toFixed(2).replace(/\.?0+$/, '')})`, 'level');
  fx({ t:'enchant', x:p.x, y:p.y, cursed:false });
  recalc(p);
}
/* 유물의 v는 어떤 것은 비율(0.35)이고 어떤 것은 개수(6)다. 한 걸음의
   크기를 그 값의 크기에서 읽는다 — 0.35에 1을 더하면 한 걸음이 아니라
   다른 유물이 된다. */
/* 처음에 |v|<1.5 는 0.05 고정으로 놓았다. 그러면 같은 「한 걸음」이
   유물마다 15%에서 375%까지 벌어진다(v=1 은 +15%, v=2 는 +150%,
   grudge 0.04 는 +375%). 전부 **20%**로 통일한다 — 세 걸음이면 어느
   유물이든 +60%다. */
export const attuneStep = r => (Math.abs(r.v) < 1.5
  ? Math.round(r.v * 0.2 * 100) / 100
  : Math.max(1, Math.round(r.v * 0.2)));
export const attuneLeft = id => {
  const r = relicById(id);
  if (!r) return 0;
  const step = attuneStep(r);
  return ATTUNE_MAX - Math.round((G.player?.tuned?.[id] || 0) / step);
};

export function anvilEnchant(key, reroll, cat = null) {
  const p = G.player, t = targetOf(key);
  if (!t) return;
  const label = t.type === 'item'
    ? (t.item ? affixName(t.item) : '그것')
    : (spellList(p).find(s => s.id === t.id)?.name || '주문');
  const why = forgeBlock(t, reroll ? 'reroll' : 'enchant');
  if (why) { say(`${label} — ${why}.`, 'warn'); return; }
  const cost = anvilCost(reroll ? REROLL_COST : ENCHANT_COST);
  if (!canAfford(cost)) { say(`재료가 모자란다 — ${costText(cost)}.`, 'warn'); return; }
  const c = useCatalyst(cat, 'enchant');
  spend(cost);
  if (c) say(`${c.n}을(를) 함께 넣었다.`, 'good');

  if (t.type === 'spell') {
    p.spellAffix = p.spellAffix || {};
    const a = SPELL_AFFIXES[rnd(SPELL_AFFIXES.length)];
    const had = p.spellAffix[t.id];
    p.spellAffix[t.id] = a.id;
    const sp = spellList(p).find(s => s.id === t.id);
    say(had && had !== a.id
      ? `${sp?.name}의 성질이 뒤바뀌었다 — ${a.n}. ${a.note}.`
      : `${sp?.name}이(가) ${a.n} 주문이 되었다. ${a.note}.`, 'level');
    fx({ t:'enchant', x:p.x, y:p.y, cursed:false });
    return;
  }

  const it = t.item;
  if (!it) return;
  const tag = it.kind;
  // A reroll never inflicts a curse — it is the cure for one,
  // which is what keeps the enchant gamble survivable.
  /* 빈 물건에 거는 것은 싸고 안전하고, 이미 둘 다 붙은 물건을 다시
     건드리는 것은 도박이다. 그래야 「지금 멈출까」가 매번 결정이 된다. */
  const worn = (it.pre ? 1 : 0) + (it.suf ? 1 : 0);
  /* ① 서기의 깃펜 크랙. 판별하는 펜이 **적는 펜**이 된다 — 적힌
     것은 나쁘게 나오지 않는다. 인챈트의 도박에서 나쁜 면이 사라진다. */
  const cursed = !reroll && c?.id !== 'seal' && !cracked('quill')
              && Math.random() < ENCHANT_CURSE + ENCHANT_CURSE_STEP * worn;

  let usePrefix = Math.random() < 0.5;
  if (reroll) {
    const preCursed = !!PREFIXES.find(a => a.id === it.pre)?.curse;
    const sufCursed = !!SUFFIXES.find(a => a.id === it.suf)?.curse;
    if (preCursed !== sufCursed) usePrefix = preCursed;      // burn the curse first
    else if (!it.pre !== !it.suf) usePrefix = !!it.pre;      // otherwise the slot in use
  }
  const table = usePrefix ? PREFIXES : SUFFIXES;
  const a = pickAffixFor(table, tag, cursed);
  /* 여기까지 와서 빈손이면 이미 값을 치른 뒤다. 되돌려준다 —
     「불꽃이 사그라들 뿐이다」가 유료였다. */
  if (!a) { refund(cost); say('불꽃이 사그라들 뿐이다. 값은 돌려받았다.', 'warn'); return; }

  const slotKey = usePrefix ? 'pre' : 'suf';
  const replaced = it[slotKey];
  it[slotKey] = a.id;
  recalc(p);

  if (cursed) {
    say(`${it.n}에서 검은 연기가 피어오른다 — ${a.n}.`, 'warn');
  } else if (replaced && replaced !== a.id) {
    say(`${affixName(it)} — 이전의 성질을 밀어냈다.`, 'level');
  } else {
    say(`${affixName(it)} — 새 성질이 깃들었다.`, 'level');
  }
  /* 대박. 두 슬롯이 다 좋은 것으로 차고, 거기에 한 단계까지 얹힌다.
     몇 판에 한 번 나오라고 둔 숫자다 — 자주 나오면 그건 대박이
     아니라 기본값이고, 그러면 인챈트가 도박이 아니라 절차가 된다. */
  if (!cursed && !reroll && Math.random() < JACKPOT.enchant) {
    for (const [table, key] of [[PREFIXES, 'pre'], [SUFFIXES, 'suf']]) {
      const g = pickAffixFor(table, tag, false);
      if (g) it[key] = g.id;
    }
    it.plus = Math.min(MAX_PLUS, (it.plus || 0) + 1);
    recalc(p);
    say(`불이 하얗게 탄다 — ${affixName(it)}.`, 'level');
    fx({ t:'transcend', x:p.x, y:p.y });
    return;
  }

  /* 분광석 pays for both slots at once — the only way to land a
     prefix and a suffix from one roll. 그리고 아주 드물게 운으로도
     같은 일이 일어난다 — 촉매는 여전히 「확실하게」를 판다. */
  if (!cursed && !reroll && c?.id !== 'prism' && Math.random() < ENCHANT_TWIN) {
    const other = usePrefix ? SUFFIXES : PREFIXES;
    const b = pickAffixFor(other, tag, false);
    if (b) {
      it[usePrefix ? 'suf' : 'pre'] = b.id;
      recalc(p);
      say(`불이 두 번 갈라졌다 — ${affixName(it)}.`, 'level');
      fx({ t:'enchant', x:p.x, y:p.y, cursed:false, twin:true });
    }
  }
  if (c?.id === 'prism') {
    const other = usePrefix ? SUFFIXES : PREFIXES;
    const b = pickAffixFor(other, tag, false);
    if (b) {
      it[usePrefix ? 'suf' : 'pre'] = b.id;
      recalc(p);
      say(`분광석이 빛을 갈랐다 — ${affixName(it)}.`, 'level');
    }
  }
  fx({ t:'enchant', x:p.x, y:p.y, cursed });
}

/* Cursed rolls draw from the cursed pool only, so a bad outcome
   is genuinely bad rather than merely a weaker good one. */
function pickAffixFor(table, tag, cursed) {
  const pool = table.filter(a => a.tags.includes(tag) && !!a.curse === cursed);
  if (pool.length) return pool[rnd(pool.length)];
  return pickAffix(table, tag, false);
}

function spendCamp() {
  const L = G.level, p = G.player;
  G.campUses = Math.max(0, (G.campUses || 1) - 1);
  if (G.campUses > 0) {
    say(`불씨 항아리 덕에 불이 아직 살아 있다. (${G.campUses}회 남음)`, 'good');
  } else if (L.tiles[idx(p.x, p.y)] === CAMP) {
    L.tiles[idx(p.x, p.y)] = FLOOR;
    L.campSpent = true;
  }
  G.screen = 'play';
  endTurn();
}

/* Walking away without spending it. There was no way out of the
   fire screen at all, which meant arriving at full health with
   no materials forced you to burn the one real decision on the
   floor for nothing. The fire keeps: come back when it is worth
   something. */
export function leaveCamp() {
  G.screen = 'play';
  say('불은 그대로 두고 물러났다.');
}

/* ── the ? room ───────────────────────────────────────────
   events.js holds the offers; this holds every verb they are
   allowed to use. Keeping the API narrow is the point: an event
   can only do things the rules layer already knows how to do, so
   there is no path by which a piece of content invents a rule.

   Also the boundary that keeps events.js free of imports — no
   cycle, and the offers stay readable as plain descriptions. */
function eventApi() {
  const p = G.player;
  const api = {
    p, G, depth: G.depth,
    say, rnd,
    chance: q => Math.random() < q,

    /* state queries the gates use */
    hasRelic, cracked, crackHint, crackProgress, crackOf, crackLeft, nearestCrack, feedable,
    hasArcana, arcanaDue, arcanaOffer, takeArcana,
    godOffer, pledge, refuse, canRefuse, pledgeDue,
    powerOf, expectedPower, heatFor, HEAT_WORD, HEAT_MAX,
    hasAffix: key => (gearBonus(p)[key] || 0) > 0,
    canCast: () => spellList(p).length > 0,
    has: cost => canAfford(cost),

    /* costs */
    pay: cost => spend(cost),
    mats: got => {
      p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
      const parts = [];
      for (const k of ['scrap', 'dust', 'essence']) {
        if (!got[k]) continue;
        p.mats[k] += got[k];
        parts.push(`${MATS[k].n} ${got[k]}`);
      }
      if (parts.length) say(`${parts.join(' · ')}을(를) 얻었다.`, 'good');
    },
    /* 여기 있는 `gold`는 **주는** 함수여야 한다. 여태 값만 계산해
       돌려주고 지갑에는 손을 안 댔고, 그래서 부르는 쪽마다
       `api.p.gold += api.gold(g)`라고 적어야 했다 — 그 한 조각을
       빠뜨린 사건은 조용히 아무것도 주지 않는다. 실제로 새로 쓴
       사건에서 바로 그렇게 됐다. 이제 여기서 넣는다. */
    gold: n => { const got = goldGain(n); p.gold += got; return got; },
    /* 물건 하나. 깊이를 받아 굴리고, 배낭이 차 있으면 발밑에 둔다 —
       사건이 준 것이 「배낭이 가득 찼다」 한 줄로 사라지면 안 된다. */
    item: (depth = G.depth + 2, affix = true) => {
      const it = pickItem(depth);
      if (!it) return null;
      if (affix) rollAffixes(it, depth + 4, true);
      if (packRoom(p, it)) addItem(p, it);
      else { G.items.push({ ...it, x: p.x, y: p.y }); say('배낭이 차서 발밑에 두었다.', 'warn'); }
      fx({ t:'found', x:p.x, y:p.y, rar: rarityOf(it) });
      return it;
    },

    /* body */
    heal: n => {
      const got = Math.min(p.maxhp - p.hp, n);
      if (got <= 0) { say('이미 멀쩡하다.'); return; }
      p.hp += got; fx({ t:'heal', x:p.x, y:p.y, amt:got });
      say(`체력 +${got}.`, 'good');
    },
    hurt: (n, from) => {
      n = hurtPlayer(n, { by: { n: from || '사건' } });
      /* `dmg` was a name from the site this was copied out of and
         has never existed here. It threw the moment a ? room dealt
         damage that pushed you across the quarter-health line —
         which is exactly when the low-health flash was wanted. */
      fx({ t:'hit', on:'player', x:p.x, y:p.y, dmg:n, who: from || '사건', spr:'event',
           low: p.hp <= p.maxhp * 0.25 && p.hp + n > p.maxhp * 0.25,
           severe: n >= p.maxhp * 0.18 });
      say(`${n}의 피해.`, 'hit');
    },
    afflict: (kind, turns) => afflict(p, kind, turns),
    xp: n => gainXp(Math.round(n)),

    /* permanent gains — the reason a ? room is remembered */
    perm: (key, v) => {
      p.perm = p.perm || {};
      if (key === 'hitPctMul') p.perm[key] = (p.perm[key] || 1) * v;
      else p.perm[key] = (p.perm[key] || 0) + v;
      recalc(p);
    },
    permHp: n => { p.permHp = (p.permHp || 0) + n; recalc(p); if (n > 0) p.hp += n; },
    tune: (id, v) => { p.tuned = p.tuned || {}; p.tuned[id] = (p.tuned[id] || 0) + v; },
    infamy: v => { p.markup = (p.markup || 0) + v; },

    /* the floor */
    rouse: r => rouse(p.x, p.y, r, 1),
    burnOil: n => { p.lightTurns = Math.max(0, p.lightTurns - n); },
    /* 기름을 붓는 쪽. burnOil만 있고 이쪽이 없어서, 사건은 기름을
       태울 수만 있고 채울 수는 없었다 — 불에 관한 사건을 쓰려면
       양쪽이 다 있어야 한다. 상한은 통 크기가 정한다. */
    oil: n => { const got = Math.min(oilCap() - p.lightTurns, n);
      if (got > 0) p.lightTurns += got; return Math.max(0, got); },
    spawn: (spr, n) => spawnNear(spr, n, false),
    spawnElite: n => spawnNear(null, n, true),
    /* The room closes on you. Placed on the rings immediately
       around the player rather than scattered across the floor,
       because being surrounded is a different problem from being
       outnumbered — no corridor to back into, no door to shut,
       and the first turn is spent deciding which way out is
       cheapest. This is what a lost wager in the ? room costs. */
    surround: n => {
      const L = G.level, p = G.player, spots = [];
      for (let r = 1; r <= 3; r++)
        for (let y = p.y - r; y <= p.y + r; y++)
          for (let x = p.x - r; x <= p.x + r; x++) {
            if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) !== r) continue;
            if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) continue;
            if (L.solid(x, y) || monsterAt(x, y)) continue;
            spots.push({ x, y, r });
          }
      /* Nearest ring first, shuffled within it, so a small number
         lands in your face rather than politely three tiles off. */
      spots.sort((a, b) => a.r - b.r || Math.random() - 0.5);
      let made = 0;
      for (const s of spots) {
        if (made >= n) break;
        const m = pickMonster(G.depth + 1);
        if (!m) break;
        /* Down an energy, so the ring spends its first turn
           standing up. The punishment for losing the wager is the
           position, not four free hits — the player gets exactly
           one turn to pick a direction, roll, or drink, which is
           the turn that makes it a fight instead of a mugging. */
        Object.assign(m, { x:s.x, y:s.y, awake:true, energy:-1 });
        m.maxhp = m.hp;
        G.monsters.push(m);
        fx({ t:'reveal', x:s.x, y:s.y });
        made++;
      }
      if (made) {
        say(`사방에서 ${made}마리가 일어섰다.`, 'hit');
        fx({ t:'telegraph', urgent:true });
        fx({ t:'noise', x:p.x, y:p.y, r:6 });
      }
      rouse(p.x, p.y, 8, 1);
      return made;
    },
    wakeHalf: () => {
      let n = 0;
      for (const m of G.monsters) if (!m.awake && Math.random() < 0.5) { m.awake = true; n++; }
      return n;
    },
    resetClock: () => { G.floorTurn = 0; G.waves = 0; },
    spendClock: n => { G.floorTurn += n; },
    grantCamps: n => { G.campPromise = n; },
    openCamp: () => { G.campUses = Math.max(1, G.campUses); G.screen = 'camp'; },
    revealChests: better => {
      for (const it of G.items) if (it.kind === 'chest') {
        G.level.seen[idx(it.x, it.y)] = 1;
        if (better) {
          const extra = pickItem(G.depth + 3);
          if (extra) it.loot.push(extra);
          it.gold = Math.round((it.gold || 0) * 1.5);
        }
      }
    },
    /* Modifiers held for the next floor. Applied in enterDepth,
       then cleared, so they cannot leak into floor after floor. */
    nextFloor: mods => { G.nextMods = { ...(G.nextMods || {}), ...mods }; },

    /* things */
    gear: over => {
      const it = pickItem(G.depth + over);
      if (!it) return;
      rollAffixes(it, G.depth + over, true);
      addItem(p, it);
      say(`${nameOf(it)}을(를) 얻었다.`, 'good');
    },
    givePotion: (n, oneBad) => {
      const good = CONSUMABLES.filter(c => c.spr === 'potion' && !['potVenom', 'potMurk'].includes(c.id));
      const bad = CONSUMABLES.filter(c => ['potVenom', 'potMurk'].includes(c.id));
      for (let i = 0; i < n; i++) {
        const pool = (oneBad && i === n - 1) ? bad : good;
        addItem(p, { kind:'use', ...pool[rnd(pool.length)] });
      }
    },
    forge: (n, slot) => {
      const slots = slot ? [slot] : GEAR_SLOTS;
      const pick = slots.filter(k => p.equip[k]);
      if (!pick.length) { say('벼릴 것이 없다.', 'warn'); return; }
      const it = p.equip[pick[rnd(pick.length)]];
      it.plus = Math.min(MAX_PLUS, (it.plus || 0) + n);
      recalc(p);
      say(`${affixName(it)} — 벼려졌다.`, 'level');
      fx({ t:'forge', x:p.x, y:p.y });
    },
    reroll: () => {
      const it = p.equip.weapon;
      if (!it) { say('무기가 없다.', 'warn'); return; }
      it.pre = pickAffixFor(PREFIXES, it.kind, false)?.id || it.pre;
      it.suf = pickAffixFor(SUFFIXES, it.kind, false)?.id || it.suf;
      recalc(p);
      say(`${affixName(it)} — 다시 벼려졌다.`, 'level');
      fx({ t:'enchant', x:p.x, y:p.y });
    },
    honeSpell: () => {
      const list = spellList(p);
      if (!list.length) { say('연마할 주문이 없다.', 'warn'); return; }
      const sp = list[rnd(list.length)];
      p.spellPlus = p.spellPlus || {};
      p.spellPlus[sp.id] = Math.min(MAX_SPELL_PLUS, (p.spellPlus[sp.id] || 0) + 1);
      say(`${sp.name} +${p.spellPlus[sp.id]} — 문법이 손에 붙었다.`, 'level');
    },
    identifyAll: () => {
      let n = 0;
      for (const slot of p.pack) if (!isKnown(slot.item.id)) { identify(slot.item.id, true); n++; }
      return n;
    },
    relic: () => { const id = unownedRelic(); if (id) takeRelic(id); },
    dropRelic: id => {
      const i = (p.relics || []).indexOf(id);
      if (i >= 0) { forgetRelic(id); p.relics.splice(i, 1); }
      recalc(p);
    },
    /* 잊힌 사당: hand one back, pick from two. Routed through the
       swap screen so the same UI serves both cases. */
    tradeRelic: () => {
      const id = unownedRelic();
      if (!id) { say('바꿀 것이 없다.', 'warn'); return; }
      G.pendingRelic = id;
      G.screen = 'relic';
    },
  };
  return api;
}

function spawnNear(spr, n, elite) {
  const L = G.level, p = G.player;
  for (let i = 0; i < n; i++) {
    let spot = null;
    for (let t = 0; t < 40 && !spot; t++) {
      const s = L.randomFloor((x, y) => monsterAt(x, y) || (p.x === x && p.y === y));
      if (!s) break;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < 2 || d > 12) continue;
      spot = s;
    }
    if (!spot) continue;
    let m = spr ? MONSTERS.filter(x => x.spr === spr).sort((a, b) => b.d - a.d)[0] : null;
    m = m ? scaleMonster(m, G.depth) : pickMonster(G.depth);
    Object.assign(m, { x: spot.x, y: spot.y, awake: true, energy: 0 });
    if (elite) makeElite(m, G.depth);
    m.maxhp = m.hp;
    G.monsters.push(m);
  }
}

/* Which offer this floor holds. Rolled on arrival rather than on
   contact so the gate reads your state as it was when you walked
   in — otherwise you could farm an event by re-equipping at the
   doorstep. */
/* 발밑의 사건. 층에 하나였을 때는 L.eventId 한 줄이면 됐는데, 칸마다
   다르게 굴리기 시작한 뒤로는 「어느 칸에 서 있는가」가 답의 일부다.
   묻는 곳이 셋(화면·선택·발밑)이라 깔때기를 하나 둔다. */
export function eventHere() {
  const L = G.level, p = G.player;
  if (!L || !p) return null;
  return L.eventAt?.get(idx(p.x, p.y)) ?? null;
}

export function rollEvent(taken = []) {
  const api = eventApi();
  const pool = EVENTS.filter(e => !e.when || e.when(api))
    .filter(e => !taken.includes(e.id));
  if (!pool.length) return null;
  const total = pool.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of pool) { if (r < e.w) return e.id; r -= e.w; }
  return pool[0].id;
}

export function eventOffer() {
  /* 전리품 더미가 먼저다. 사건 자리에서 정예를 잡으면 둘이 겹칠 수
     있는데, 그때 화면에 뜬 것과 고른 것이 갈리면 안 된다. */
  if (G.fallen) {
    const f = G.fallen;
    return { id:'fallen', n:f.n, fallenOffer:true, t:f.t,
      opts: f.opts.map((o, i) => ({ i, id:o.id, n:o.n, t:o.t, can:true, odds:null, risk:'' })) };
  }
  if (G.spoils) {
    return {
      id: 'spoils', n: '전리품 더미', spoils: true,
      t: '쓰러진 것이 남긴 것들이다. 가져갈 수 있는 것은 하나뿐이고, 나머지는 여기 두고 간다.',
      opts: G.spoils.picks.map((it, i) => ({
        i, n: affixName(it), t: itemBlurb(it).split('\n').join(' · '),
        can: true, odds: null, risk: '',
        rar: rarityOf(it), spr: it.spr,
      })),
    };
  }
  const e = EVENTS.find(x => x.id === eventHere());
  if (!e) return null;
  const api = eventApi();
  return {
    id: e.id, n: e.n, t: e.t,      // 화면이 사건마다 다른 그림을 고를 수 있게
    opts: e.opts.map((o, i) => ({
      i, n: o.n, t: o.t, can: !o.need || o.need(api), odds: o.odds ?? null,
      risk: o.risk || '',
    })),
  };
}

/* 하나를 집고, 나머지는 두고 간다. 배낭이 가득 차 있으면 아무것도
   집히지 않는데, 그때 더미를 없애 버리면 나머지 둘까지 같이 사라진다
   — 「배낭이 가득 찼다」가 물건 셋을 지우는 문장이 되면 안 된다. */
function spoilsTake(i) {
  const p = G.player, sp = G.spoils;
  if (!sp) { G.screen = 'play'; return; }
  const it = sp.picks[i];
  if (!it) return;
  if (!packRoom(p, it)) {
    say(`배낭이 가득 찼다 — ${nameOf(it)}은(는) 더미에 그대로 있다.`, 'warn');
    return;
  }
  const idxAt = G.items.findIndex(o => o.kind === 'spoils' && o.x === p.x && o.y === p.y);
  if (idxAt >= 0) G.items.splice(idxAt, 1);
  G.spoils = null;
  G.screen = 'play';
  G.act = 'pick';
  addItem(p, it);
  const grade = rarityOf(it);
  if (grade >= 2) {
    G.rareFound = (G.rareFound || 0) + 1;
    fx({ t:'found', x:p.x, y:p.y, rar:grade });
    lore(RARITY[grade].n, affixName(it), itemBlurb(it), it.spr);
  } else {
    fx({ t:'found', x:p.x, y:p.y, rar:grade });
  }
  const left = sp.picks.filter((_, k) => k !== i).map(o => affixName(o)).join(', ');
  say(`${affixName(it)}을(를) 골랐다. ${left}은(는) 두고 간다.`, grade >= 2 ? 'level' : 'good');
  endTurn();
}

/* 더미를 안 열고 돌아설 수도 있어야 한다. 셋 다 쓸모없을 때가
   있고, 그때 억지로 하나를 집게 하면 배낭 한 칸이 벌이 된다. */
export function spoilsLeave() {
  if (!G.spoils) return;
  G.spoils = null;
  G.screen = 'play';
  say('더미를 그대로 두고 돌아섰다.');
}

export function eventChoose(i) {
  const L = G.level;
  if (G.fallen) return fallenTake(G.fallen.opts[i]?.id);
  if (G.spoils) return spoilsTake(i);
  const here = eventHere();
  const e = EVENTS.find(x => x.id === here);
  if (!e) { G.screen = 'play'; return; }
  const opt = e.opts[i];
  const api = eventApi();
  if (!opt || (opt.need && !opt.need(api))) return;

  /* Consumed before the effect runs: an option that opens another
     screen (the relic swap, the fire) must not leave the tile
     behind for a second helping. */
  Meta.see('events', e.id);
  G.eventsSeen = (G.eventsSeen || 0) + 1;
  const at = idx(G.player.x, G.player.y);
  if (L.tiles[at] === EVENT) L.tiles[at] = FLOOR;
  L.eventAt?.delete(at);
  G.screen = 'play';

  /* A wager, if the option declared one. The roll lives here
     rather than inside the option so the number the button
     printed is provably the number that was rolled — an option
     that rolls its own chance can drift from its label, and a
     gamble whose odds you cannot trust is just a surprise.

     The altar stakes an item. This stakes the floor: the losing
     branch does not take your gold, it puts the room around you. */
  if (opt.odds != null && opt.fail) {
    if (Math.random() < opt.odds) opt.run(api);
    else { say('걸었고, 졌다.', 'warn'); opt.fail(api); }
  } else opt.run(api);
  if (G.screen === 'play') endTurn();
}

/* ── the altar ────────────────────────────────────────────
   Pure luck, priced in advance. The odds are shown before you
   commit — a gamble you cannot price is not a decision, it is a
   surprise. Blood is cheap while you are healthy and lethal when
   you are not; gold costs nothing if you had nowhere to spend it;
   gear is the offer that actually hurts, and it pays the best. */
export const altarOffers = () => {
  const p = G.player;
  return ALTAR_OFFERS.map(o => ({
    ...o,
    detail: o.id === 'blood' ? `체력 ${p.hp} → ${Math.max(1, Math.ceil(p.hp * 0.6))}`
          : o.id === 'gold'  ? `금화 ${p.gold} → ${Math.floor(p.gold / 2)}`
          : '착용 중인 무기·갑옷·방패 하나가 사라진다',
    can: o.id === 'blood' ? p.hp > 6
       : o.id === 'gold'  ? p.gold >= 60
       : GEAR_SLOTS.some(k => p.equip[k]),
  }));
};

function altarRoll(odds) {
  const total = odds.reduce((s, [, w]) => s + w, 0);
  let r = rnd(total);
  for (const [name, w] of odds) { if (r < w) return name; r -= w; }
  return odds[odds.length - 1][0];
}

export function altarOffer(id) {
  const p = G.player;
  const offer = ALTAR_OFFERS.find(o => o.id === id);
  if (!offer) return;

  let weight = 1;                       // how much the gods got
  if (id === 'blood') {
    /* 여기는 깔때기를 안 지난다 — 일부러 그렇다. 이것은 맞은 것이
       아니라 **치른 값**이다. hurtPlayer를 지나면 숨이 잠기고(제단
       앞에서 전투 중이 아닌데) 상처가 남고 연격이 끊긴다. 현재 체력의
       40%라 죽지도 않는다. 우회 여덟 곳을 회수하면서 이 한 곳만
       남긴 이유를 여기 적어 둔다 — 안 적으면 다음 사람이 「빠뜨렸다」고
       생각하고 넣을 것이고, 그러면 제단이 조용히 함정이 된다. */
    const pay = Math.max(1, Math.floor(p.hp * 0.4));
    p.hp -= pay;
    weight = 1.0;
    say(`제단이 피를 받는다. 체력 -${pay}.`, 'warn');
  } else if (id === 'gold') {
    const pay = Math.floor(p.gold / 2);
    p.gold -= pay;
    weight = clamp(pay / (250 + G.depth * 90), 0.4, 2.0);
    say(`금화 ${pay}닢이 사라진다.`, 'warn');
  } else {
    const slots = GEAR_SLOTS.filter(k => p.equip[k]);
    const k = slots[rnd(slots.length)];
    const given = p.equip[k];
    weight = 1.1 + rarityOf(given) * 0.5 + (given.plus || 0) * 0.15;
    p.equip[k] = null;
    recalc(p);
    say(`${affixName(given)}이(가) 재가 되어 흩어진다.`, 'warn');
  }

  /* The roll happens now; the *reveal* happens in the UI, over
     about a second, with the marker slowing as it passes the
     segments it did not land on. Resolving instantly threw away
     the only part of a gamble that is actually enjoyable — the
     part where you can still see the jackpot going by. */
  const result = altarRoll(offer.odds);
  G.pendingAltar = { result, weight, odds: offer.odds, gave: id };
  return result;
}

/* Called by the UI when the wheel has finished moving. Kept
   apart from the roll so the outcome cannot be influenced by
   how long the animation ran. */
export function altarSettle() {
  const p = G.player, pend = G.pendingAltar;
  if (!pend) return;
  G.pendingAltar = null;

  fx({ t:'altar', result: pend.result, x:p.x, y:p.y });
  grantBoon(pend.result, pend.weight, pend.gave);

  G.level.tiles[idx(p.x, p.y)] = FLOOR;   // one use, then it is stone
  G.level.altar = null;
  G.screen = 'play';
  if (p.hp <= 0) { p.hp = 0; fx({ t:'death', x:p.x, y:p.y }); death({ n:'제단' }); return; }
  endTurn();
}

function grantBoon(result, weight, gave = 'blood') {
  const p = G.player, d = G.depth;

  if (result === '재앙') {
    const roll3 = rnd(3);
    if (roll3 === 0) {
      const slots = GEAR_SLOTS.filter(k => p.equip[k]);
      if (slots.length) {
        const it = p.equip[slots[rnd(slots.length)]];
        const table = Math.random() < 0.5 ? PREFIXES : SUFFIXES;
        const a = pickAffixFor(table, it.kind, true);
        if (a) { it[table === PREFIXES ? 'pre' : 'suf'] = a.id; recalc(p); }
        say(`${affixName(it)} — 저주가 스며든다.`, 'warn');
      }
    } else if (roll3 === 1) {
      let woke = 0;
      for (const m of G.monsters) if (!m.awake) { m.awake = true; woke++; }
      say(`제단이 비명을 지른다. ${woke}마리가 깨어났다.`, 'warn');
    } else {
      afflict(p, ['poison', 'blind', 'fear'][rnd(3)], 24);
      say('무언가가 몸에 들러붙었다.', 'warn');
    }
    return;
  }

  if (result === '허탕') { say('아무 일도 일어나지 않았다.', ''); return; }

  /* 대박. 대성공 위의 한 칸 — 기적. 제단은 이 판에서 가장 큰 도박인데
     가장 좋은 결과가 「좋은 물건 하나」에서 멈춰 있었다. 몇 판에 한 번,
     제단이 판을 통째로 바꾸는 일이 있어야 그 앞에 설 때 손이 떨린다. */
  if (result === '대성공' && Math.random() < JACKPOT.altar) {
    const id = unownedRelic();
    if (id) takeRelic(id);
    const it = pickItem(d + 18);
    if (it) {
      rollAffixes(it, d + 26, true);
      it.plus = 3 + rnd(3);
      addItem(p, it);
      say(`돌이 갈라지고 ${affixName(it)}이(가) 드러났다.`, 'level');
    }
    // permHp는 recalc이 이미 읽는 자리다 — 새 필드를 만들면 한 곳이 더 갈린다.
    p.permHp = (p.permHp || 0) + 12;
    recalc(p);
    say('— 기적. 제단이 대답 이상의 것을 했다.', 'level');
    fx({ t:'transcend', x:p.x, y:p.y });
    return;
  }

  if (result === '대성공') {
    /* Half of every jackpot is a relic. This is the luck route
       to a run-defining item — the reason to bleed on a stone
       when you already have a good sword. */
    if (Math.random() < 0.5) {
      const id = unownedRelic();
      if (id) { takeRelic(id); return; }
    }
    const pick = rnd(3);
    if (pick === 0) {
      const it = pickItem(d + 8);
      if (it) {
        rollAffixes(it, d + 14, true);
        it.plus = 1 + rnd(2);
        addItem(p, it);
        say(`제단이 ${affixName(it)}을(를) 내놓는다.`, 'level');
      }
    } else if (pick === 1) {
      const k = STATS[rnd(STATS.length)];
      p.stats[k] = Math.min(20, p.stats[k] + 1);
      recalc(p);
      say(`몸이 달라진다 — ${STAT_NAME[k]} +1. 영구적이다.`, 'level');
    } else {
      p.mats.essence += 1 + rnd(2);
      p.mats.dust += 4 + rnd(5);
      p.mats.scrap += 10 + rnd(12);
      say('제단 위에 재료가 수북이 쌓인다.', 'level');
    }
    return;
  }

  /* 성공. The reward never comes back in the coin it was paid in.
     Bleeding used to have a one-in-four chance of buying a heal
     and gold a one-in-four chance of buying gold — which is not a
     bargain with a god, it is change from a till. What you gave
     decides which door is *closed*; the rest are open. */
  /* Keyed by what the payout *is*, not by what buys it. The first
     version named the gold payout `blood` — after the offering it
     was written for — and the exclusion table then closed the
     wrong door: paying gold shut out materials and left gold wide
     open. The bench caught it at 33%. A lookup keyed on one thing
     and read as another is a bug waiting for a second reader. */
  const PAYOUTS = {
    gold: () => {
      const g = Math.round((160 + d * 70) * weight);
      p.gold += g; say(`금화 ${g}닢이 쏟아진다.`, 'good');
    },
    mats: () => {
      p.mats.scrap += Math.round((6 + d) * weight);
      p.mats.dust += Math.round((2 + d * 0.3) * weight);
      say('쓸 만한 재료가 남는다.', 'good');
    },
    gear: () => {
      const it = pickItem(d + 4);
      if (it) {
        rollAffixes(it, d + 6, true);
        if (!addItem(p, it)) { it.x = p.x; it.y = p.y; G.items.push(it); }
        say(`${affixName(it)}을(를) 얻었다.`, 'good');
      }
    },
    flesh: () => {
      const got = Math.min(p.maxhp - p.hp, Math.ceil(p.maxhp * 0.5));
      p.hp += got; p.mana = p.maxmana; p.ail = {};
      fx({ t:'heal', x:p.x, y:p.y, amt:got });
      say(`상처가 전부 닫힌다. 체력 +${got}.`, 'good');
    },
  };
  /* Each offering shuts the door it came through. Blood cannot buy
     blood back, gold cannot buy gold, and a burnt weapon does not
     come back as a weapon — it comes back as the thing you could
     not have bought. */
  const CLOSED = { blood: 'flesh', gold: 'gold', gear: 'gear' };
  const open = Object.keys(PAYOUTS).filter(k => k !== CLOSED[gave]);
  PAYOUTS[open[rnd(open.length)]]();
}

/* ── shops ──────────────────────────────────────────────── */
/* ── 신전 ─────────────────────────────────────────────────
   The one door in the plaza that does not sell you anything. It
   was a strictly worse alchemist — two potions the alchemist also
   had — which made it a sign hanging over nothing.

   It takes things off instead. Every other counter in the game
   adds: the anvil adds a plus, the fire adds a property, the
   altar adds a gamble. Nothing anywhere could remove a curse, so
   a cursed find was simply a dead find you carried to a merchant.
   Now it is a decision with a price on it. */
export const templeCost = it =>
  Math.max(60, Math.round(priceOf(it, true) * TEMPLE_SHARE));

export function templeOffers() {
  const p = G.player;
  const out = [];
  for (const k of GEAR_SLOTS) {
    const it = p.equip[k];
    if (it && isCursed(it) && !it.unique) out.push({ where:'equip', key:k, item:it });
  }
  p.pack.forEach((slot, i) => {
    if (isCursed(slot.item) && !slot.item.unique)
      out.push({ where:'pack', key:i, item:slot.item });
  });
  return out;
}

export function cleanse(offer) {
  const p = G.player;
  const it = offer.item;
  if (!isCursed(it)) { say('이미 깨끗하다.', 'warn'); return; }
  const cost = templeCost(it);
  if (p.gold < cost) { say('금화가 모자란다.', 'warn'); return; }
  p.gold -= cost;
  /* Only the cursed half comes off. A 저주받은 예리한 검 keeps
     its edge — the temple is not a reroll, it is a subtraction. */
  if (PREFIXES.find(a => a.id === it.pre)?.curse) it.pre = null;
  if (SUFFIXES.find(a => a.id === it.suf)?.curse) it.suf = null;
  recalc(p);
  fx({ t:'cleanse', x:p.x, y:p.y });
  say(`${nameOf(it)}에서 붙어 있던 것이 떨어져 나갔다. (-${cost})`, 'level');
}

/* 이 층의 수레가 끌고 온 짐. 층에 들어설 때 한 번 정해진다. */
export function wanderLoad() {
  if (G.loadAt === G.depth && G.load) return SHOP_LOADS.find(l => l.id === G.load) || null;
  const pool = loadsFor(G.depth);
  if (!pool.length) return null;
  const pick = pickWeighted(pool.map(l => ({ ...l, w: l.w })));
  G.load = pick.id; G.loadAt = G.depth;
  return pick;
}

export function shopStock(shop) {
  /* The weapon rack used to return here, which meant the quiver
     rack hung below an early return and the one shop that sells
     them never did. */
  if (shop.stock === 'weapon') {
    const out = WEAPONS.filter(w => w.d <= 12 && w.t !== 'wand')
      .map(w => ({ kind:'weapon', ...w }));
    if (shop.quivers)
      for (const q of QUIVERS)
        if (q.d <= Math.max(1, G.deepest || G.depth))
          out.push({ kind:'quiver', slot:'quiver', ...q });
    return out;
  }
  if (shop.stock === 'armour')
    return ARMOURS.filter(a => a.d <= 12).map(a => ({ kind:'armour', ...a }));
  /* 떠돌이 수레는 「오늘 무엇을 싣고 왔나」가 재고다. 짐은 층마다
     한 번 굴려 두고(G.load), 그 층에서는 안 바뀐다 — 화면을 닫았다
     열 때마다 물건이 바뀌면 그건 상인이 아니라 뽑기다. */
  const load = shop.wander ? wanderLoad() : null;
  const ids = load ? load.stock : shop.stock;
  const out = ids.map(id => makeConsumable(id)).filter(Boolean);
  /* Rods are read, not swung, so they hang with the scrolls
     rather than on the weapon rack — the one shelf a caster has
     any reason to walk to. */
  if (shop.rods)
    for (const w of WEAPONS)
      if (w.t === 'wand' && w.d <= Math.max(1, G.deepest || G.depth))
        out.push({ kind:'weapon', ...w });
  /* 닫힌 장부 halves the shelf. Deterministic on the shop id and
     the day's stock rather than random, so re-entering the door
     cannot reroll what is for sale. */
  if (hasShackle('ledger') && out.length > 1) out.length = Math.ceil(out.length / 2);
  /* The wandering merchant also deals in materials, which is what
     turns a purse of gold into a +1 you actually wanted. */
  /* 재료도 짐을 따른다. 예전에는 수레 하나가 셋을 늘 실었다 —
     그러면 「무엇을 싣고 왔나」가 재고에서 안 읽힌다. */
  const matList = load ? (load.mats || []) : (shop.mats || []);
  if (matList.length)
    for (const k of matList)
      out.push({ kind:'mat', mat:k, id:`mat_${k}`, spr: k === 'essence' ? 'amulet' : k === 'dust' ? 'potion' : 'armor',
                 n: MATS[k].n, cost: MATS[k].cost, desc: MATS[k].note });
  /* 행상인의 기억: the general store carries one relic you have
     already found, at a price that hurts. It is the only way a
     run can *choose* its first relic instead of being handed one,
     and it is bought with knowledge from previous runs. */
  if (shop.id === 1 && hasMemory('pedlar')) {
    const seen = Object.keys(Meta.read().relics || {})
      .map(relicById).filter(r => r && !r.fused && !hasRelic(r.id));
    if (seen.length) {
      // Stable within a run: the same relic is on the shelf every
      // time you walk back in, so "come back with more gold" works.
      const r = seen[(G.relicShelf ??= rnd(seen.length)) % seen.length];
      out.push({ kind:'relic', id:r.id, spr:r.spr, n:r.n, cost:1400, desc:r.t });
    }
  }
  /* Catalysts are the only thing worth crossing a floor for a
     merchant. He carries two, drawn from what the depth has
     unlocked — never the whole rack, or they stop being rare. */
  if (load ? load.cats : shop.cats) {
    const pool = CATALYSTS.filter(c => c.d <= Math.max(1, G.deepest || G.depth));
    const seen = new Set();
    for (let i = 0; i < 2 && pool.length; i++) {
      const c = pool[(shop.id * 7 + i * 3 + (G.deepest || 1)) % pool.length];
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ kind:'cat', ...c, desc: c.t });
    }
  }
  return out;
}

/* ── 행상의 기분 ─────────────────────────────────────────
   값이 「기본값 × 매력 × 평판」뿐이면 상점은 자판기다. 언제 가도
   같은 값이면 언제 갈지가 결정이 되지 않는다.

   그래서 행상마다 기분이 있다. 무작위가 아니라 **네 상태를 읽는다** —
   피를 흘리고 있는지, 불이 꺼져 가는지, 가방이 찼는지, 뒤에서 무엇이
   쫓아오는지. 그래서 흔들리되 읽을 수 있고, 읽을 수 있으니 「지금
   갈까 나중에 갈까」가 수가 된다.

   기분은 (행상, 층)으로 정해진다 — 한 층에서 나갔다 들어와도 안 바뀐다.
   값이 새로고침되면 그것은 흥정이 아니라 도박이다. */
export const MOODS = [
  { id:'flush',  n:'주머니가 두둑하다',   t:'사는 값 −25%, 파는 값도 −25%.',
    say:'「앞엣사람이 좋은 걸 놓고 갔거든. 본인은 안 왔지만.」',
    buy: () => 0.75, sell: () => 0.75 },
  { id:'vulture', n:'피 냄새를 맡았다',   t:'다칠수록 비싸게 부른다.',
    say:'「그 꼴로 또 내려간다고? …값은 그대로요.」',
    buy: p => 1 + (1 - p.hp / p.maxhp) * 0.8, sell: () => 1 },
  { id:'dark',   n:'어둠을 무서워한다',   t:'네 불이 꺼져 갈수록 비싸다.',
    say:'「불 없이 내려간 사람들 이야기는 안 하는 게 낫소.」',
    buy: p => G.depth > 0 && p.lightTurns < 200 ? 1.55 : 1.05, sell: () => 1 },
  { id:'scales', n:'무게를 잰다',        t:'가방이 무거울수록 후하게 사 준다.',
    say:'「많이도 들고 왔군. 그만큼 못 들고 갈 거요.」',
    buy: () => 1.1, sell: p => 1 + Math.min(0.6, p.pack.length * 0.05) },
  { id:'deaf',   n:'소란을 안다',        t:'소란이 크면 값을 올린다. 조용하면 깎아 준다.',
    say:'「아래가 시끄럽더군. 위험값은 받아야겠소.」',
    buy: () => (G.uproar || 0) >= 5 ? 1.45 : 0.9, sell: () => 1 },
  { id:'steady', n:'셈이 밝다',          t:'정가. 깎이지도 오르지도 않는다.',
    say:'「여기서 에누리해 봐야 갚을 사람이 없소.」',
    buy: () => 1, sell: () => 1 },
];

export function shopMood(shop) {
  if (!shop) return MOODS[MOODS.length - 1];
  /* 결정적이다 — 나갔다 들어와도 같은 값. 새로고침되는 값은 흥정이
     아니라 도박이고, 도박은 아래 haggle이 맡는다. */
  const k = (shop.id * 31 + (G.depth || 0) * 17 + (G.runSeed || 0)) % MOODS.length;
  return MOODS[k];
}

/* ── 흥정 ────────────────────────────────────────────────
   한 상점에 한 번. 걸면 값이 내려가거나, 상인이 상한다.
   실패한 상인은 이 방문 동안 사 주지 않는다 — 잃는 것이 금화가
   아니라 **출구**라서, 가진 것을 팔아 치우려던 계획이 통째로 어긋난다. */
export const HAGGLE_CUT = 0.72;
/* 화면이 부르는 확률과 여기서 굴리는 확률은 같은 한 줄이어야 한다.
   버튼에 적힌 숫자와 실제 굴림이 갈라지면 그것은 도박이 아니라 사기다. */
export const haggleOdds = () => clamp(0.42 + statB(G.player, 'chr') * 0.06, 0.15, 0.85);
export function haggle() {
  const p = G.player, shop = G.shop;
  if (!shop) return false;
  G.haggled = G.haggled || {};
  const key = `${shop.id}:${G.depth}`;
  if (G.haggled[key]) { say('한 번 흥정한 상대다. 두 번은 안 통한다.', 'warn'); return false; }
  const odds = haggleOdds();
  G.haggled[key] = true;
  if (Math.random() < odds) {
    G.haggleCut = { key, mult: HAGGLE_CUT };
    /* 값은 표가 말한다 — 화면의 가격표가 이미 내려가 있다. 로그는
        그 사이에 무슨 일이 있었는지를 말한다. */
    say('상대가 먼저 눈을 돌린다. 이 수레에서는 값이 내려갔다.', 'good');
    return true;
  }
  G.haggleSour = { key };
  say('상인이 등을 돌렸다. 이 수레는 오늘 아무것도 사 주지 않는다.', 'hit');
  return false;
}
export const haggleState = () => {
  const shop = G.shop; if (!shop) return null;
  const key = `${shop.id}:${G.depth}`;
  return { done: !!(G.haggled || {})[key],
           cut: G.haggleCut?.key === key ? G.haggleCut.mult : 1,
           sour: G.haggleSour?.key === key };
};

export const priceOf = (item, buying) => {
  const chrB = statB(G.player, 'chr');
  // Same spine as salvage: a +5 sword is worth five upgrades more
  // than the plain one, at the counter as well as at the anvil.
  const base = worthOf(item) || item.cost || 10;
  /* markup is the running total of what ? rooms did to your
     reputation: robbing a drunk raises it, settling a ledger
     lowers it. Selling prices move the other way. */
  const mk = (1 + (G.player.markup || 0)) * (hasShackle('ledger') ? 1.5 : 1);
  /* 기분과 흥정이 여기 한 곳에서만 값에 닿는다. 화면이 부르는 값과
     계산대가 받는 값이 갈라지면 그것은 흥정이 아니라 사기다. */
  const mood = shopMood(G.shop);
  const hag = haggleState();
  /* 짐마다 값이 다르다. 심지 수레는 싸게 넘기고(0.85) 재 수레는
     비싸게 부른다(1.25) — 「오늘 무엇을 싣고 왔나」가 재고만이 아니라
     값에도 나와야 그 수레가 기억에 남는다. 파는 값에는 안 건다:
     이쪽은 사람의 물건이지 수레의 물건이 아니다. */
  const cart = (buying && G.shop?.wander) ? (wanderLoad()?.cut ?? 1) : 1;
  /* ③ 웃는 가면의 크랙. 매력 18은 값을 몇 푼 깎을 뿐이었는데 —
     굳은 얼굴이 값의 절반을 깎는다. 파는 값은 안 건드린다: 양쪽을
     다 뒤집으면 상인이 자선 사업가가 된다. */
  const face = (buying && cracked('mask')) ? 0.5 : 1;
  const swing = (buying ? mood.buy(G.player) * (hag?.cut ?? 1)
                        : mood.sell(G.player)) * cart * face;
  /* 탐욕의 판 — 많이 벌고 많이 쓴다. 파는 값은 안 건드린다: 양쪽을
     다 올리면 되팔기가 무한 기계가 된다. */
  const greed = (buying && hasArcana('greed')) ? 2 : 1;
  return buying
    ? Math.max(1, Math.round(base * (1.25 - chrB * 0.03) * mk * swing * greed))
    : Math.max(1, Math.round(base * (0.42 + chrB * 0.02) / mk * swing));
};

export function buy(item) {
  const p = G.player, cost = priceOf(item, true);
  if (p.gold < cost) { say('금화가 모자란다.', 'warn'); return; }
  trace('buy', { n: item.n || item.id, cost, left: p.gold - cost });
  p.gold -= cost;
  if (item.kind === 'mat') {
    p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
    p.mats[item.mat]++;
    say(`${item.n}을(를) 샀다. (-${cost})`, 'good');
    return;
  }
  if (item.kind === 'cat') {
    addItem(p, makeCatalyst(item.id));
    say(`${item.n}을(를) 샀다. (-${cost})`, 'good');
    return;
  }
  if (item.kind === 'relic') {
    takeRelic(item.id);
    G.relicShelf = null;                 // the shelf restocks
    return;
  }
  /* A merchant names what he sells. Buying it teaches you the
     appearance for the rest of the run — otherwise the shop was
     a way to launder identification without spending anything. */
  identify(item.id, true);
  addItem(p, { ...item });
  say(`${item.n}을(를) 샀다. (-${cost})`, 'good');
}

export function sell(slotIdx) {
  const p = G.player, slot = p.pack[slotIdx];
  if (!slot) return;
  if (haggleState()?.sour) { say('상인이 고개를 젓는다. 오늘은 아니다.', 'warn'); return; }
  const gain = priceOf(slot.item, false);
  p.gold += gain;
  removeItem(p, slotIdx);
  say(`${slot.item.n}을(를) 팔았다. (+${gain})`, 'good');
}

/* ── endings ────────────────────────────────────────────── */
/* The shape of a run, assembled once at the end. Everything
   here was already in G — it was simply never collected, so a
   death printed three numbers and told no story. */
export function summarise(win, by) {
  const p = G.player;
  return {
    win, by,
    race: p.race, cls: p.cls, lv: p.lv,
    depth: G.depth, turn: G.turn,
    gold: p.gold, combo: G.bestCombo || 0,
    sent: G.sent || 1,          // 몇 번째로 내려간 사람이었나
    /* 가진 것이 아니라 번 것. 가진 것으로 세면 쓰는 것이 점수를
       깎는 일이 되고, 그러면 모루와 상점을 안 쓰는 쪽이 이득이 된다. */
    earned: G.goldEarned || 0,
    hp: p.hp, maxhp: p.maxhp,
    relics: [...(p.relics || [])],
    /* 받은 선물과 신. **다음 판의 보스가 이것을 지고 나온다** —
       강해져서 내려가는 것이 다음 용사가 만날 악마를 빚는 일이라는
       것이 여기 한 줄로 규칙이 된다(DESIGN.md §1).
       거절한 횟수도 같이 남긴다: 아무것도 안 받고 끝낸 판은 보스에게
       얹을 것이 없다. */
    god: G.god || null,
    gifts: [...(G.gifts || [])],
    refused: G.refused || 0,
    weapon: p.equip.weapon ? affixName(p.equip.weapon) : null,
    /* 이름이 아니라 물건 자체. 다음 판의 시체가 이걸 쥐고 있어야
       하는데, 이름만 남기면 그 물건을 다시 만들 수가 없다. */
    weaponItem: p.equip.weapon ? { ...p.equip.weapon } : null,
    weaponType: p.equip.weapon?.t || null,
    branch: G.branch?.n || null,
    bank: G.bank || 0,
    kills: G.kills || 0, opened: G.opened || 0,
    broke: G.broke || 0, forged: G.forged || 0,
    trans: G.transFound || 0, perfects: G.perfects || 0, fused: G.fused || 0,
    catUsed: G.catUsed || 0, engraved: G.engraved || 0,
    abyss: G.abyss || 0, memories: [...(G.memories || [])],
    reso: Object.keys(G.player?.reso || {}),
    events: G.eventsSeen || 0, waves: G.waves || 0,
    /* 무엇이 판을 끝냈는가. 화면은 「5층에서 미믹에게」라고 말하지만
       그를 죽인 것은 미믹이 아니라 79였던 천장이 48이 된 것이었다.
       살아 있는 동안에는 막대와 숫자가 그 일을 계속 말해 주는데,
       죽고 나면 그 수치가 결산 어디에도 없었다 — 판을 끝낸 값이
       결산에 없으면 다음 판에도 같은 일이 벌어진다. */
    wound: p.wound || 0,
    /* 그리고 안 쓴 것. 물약 셋을 배낭에 넣은 채로 죽는 것은 이
       게임에서 가장 흔한 죽음이고, 화면이 그걸 안 세면 다음 판에도
       똑같이 한다. 잔소리인 건 맞다 — 잔소리를 들어야 하는 판이다. */
    unused: (p.pack || []).reduce((n, sl) =>
      n + (sl.item?.kind === 'use' ? (sl.qty || 1) : 0), 0),
    tail: G.log.slice(-3).map(l => l.text),
  };
}

/* How far a named thing will follow you from where it stands. */
const NAMED_LEASH = 9;

/* How many awake things could put a hand on that tile if you
   stood there. Melee counts adjacency, archers count their range
   through clear line — the same two tests the monsters themselves
   run, so the mark on the floor cannot promise something the
   rules will not do.

   This is information, not mercy. Nearly every avoidable death in
   a roguelike is "I did not know how many were in reach of that
   square", and the answer was always on screen — spread across
   eight sprites, a range stat and a wall you had to trace by eye.
   Doing that arithmetic is not the interesting decision; acting
   on it is. */
export function threatAt(x, y) {
  const L = G.level;
  if (!L || L.solid(x, y)) return 0;
  let n = 0;
  for (const m of G.monsters) {
    if (!m.awake || m.disguise || m.fleeing) continue;
    if (m.named && !m.provoked && !hasShackle('shadow')) continue;   // it stays home
    const d = Math.hypot(m.x - x, m.y - y);
    if (m.ai === 'ranged' && m.rng) {
      if (d <= m.rng && lineClear(L, m.x, m.y, x, y)) n++;
    } else if (d <= 1.5 + (m.spd || 1) - 1) n++;
  }
  return n;
}

/* One in forty crits, and never on the boss — the frame is the
   reward, and a boss fight is already carrying its own. */
const PERFECT_CHANCE = 0.025;
const CORRODE_CHANCE = 0.03;

function death(killer) {
  const p = G.player;
  /* 여기 들어올 때 체력은 음수일 수 있다 — 그래야 순교가 「얼마나
     막아 냈는지」를 안다. 아래 분기들이 그 값을 읽고 나면 그때 자른다. */
  /* 역류의. Checked here rather than at each of the eleven places
     that can reduce you to zero, so it cannot be missed at one of
     them. Once per floor, and the floor has to end before it comes
     back — otherwise it is not a rescue, it is a second health bar. */
  /* 순교. Not a rescue and not a heal — a debt. Everything turned
     aside is written down, and it all arrives the moment the five
     turns end. The only way to win the bet is to finish the fight
     inside it. Checked here for the same reason 역류의 is: eleven
     things can bring you to zero and none of them should have to
     know about this. */
  /* ③ 순교자의 맹세 크랙. 이 게임에서 죽음은 되돌릴 수 없다 —
     그 한 줄을 판에 딱 한 번 부순다. 되살아나는 자리는 절반이고,
     맹세가 원래 지불하던 −40%는 그대로다. */
  if (cracked('martyr') && !G.martyred) {
    G.martyred = 1;
    p.hp = Math.max(1, Math.round(p.maxhp * 0.5));
    fx({ t:'martyrHold', x:p.x, y:p.y });
    say('맹세가 마지막 줄까지 탔다. 일어선다.', 'level');
    return;
  }
  if (p.martyr > 0) {
    p.martyrDebt = (p.martyrDebt || 0) + (1 - p.hp);
    p.hp = 1;
    fx({ t:'martyrHold', x:p.x, y:p.y });
    say('무릎이 꺾이지 않는다. 아직은.', 'warn');
    return;
  }
  if (hasBoon('tide') && !G.tideUsed) {
    G.tideUsed = true;
    p.hp = Math.max(1, Math.floor(p.maxhp * 0.5));
    say('역류 — 죽음이 뒤로 밀려났다. 체력이 절반까지 돌아왔다.', 'level');
    fx({ t:'tide', x:p.x, y:p.y });
    return;
  }
  G.running = false;
  /* ── 왜 죽었는지 ────────────────────────────────────────
     플레이어: 「질때는 슬로우모션으로 주인공 확대되면서 왜 죽는지 좀
     알법하게 게임오버 화면 구현해」.

     끝 화면이 여태 말한 것은 「무엇에게 죽었나」 하나였다. 그건
     사인(死因)이지 이유가 아니다. 이유는 **안 쓴 것**에 있다 —
     주머니에 물약이 셋 있었는데 안 마셨다든가, 한계돌파가 열려
     있었는데 안 눌렀다든가, 여유 시계를 백 턴 넘겨서 파도가 셋째로
     오고 있었다든가. 그것들을 여기서 한 번에 뜬다. */
  traceCloseFloor();
  trace('death', { by: killer.n, post: postMortem().map(r => `${r.k}: ${r.v}`) });
  G.ending = { win:false, by: killer.n, summary: summarise(false, killer.n),
               post: postMortem(killer) };
  fx({ t:'deathZoom', x:p.x, y:p.y });
  G.screen = 'end';
}

/* 부검. 규칙만 안다 — 화면은 이 목록을 줄로 읽을 뿐이다.
   두 조각으로 나눈다: **무엇이 때렸나**(지나간 일)와 **무엇을 안
   썼나**(다음 판에 쓸 것). 뒤쪽이 이 화면의 진짜 값이다. */
function lastBlowLines(p) {
  const blows = (G.lastBlows || []).slice(-4);
  if (!blows.length) return [];
  const out = [{ k: '마지막 네 대', v: blows.map(b => `${b.by} ${b.dmg}`).join(' → ') }];
  const worst = blows.reduce((a, b) => (b.dmg > a.dmg ? b : a));
  if (worst.dmg >= p.maxhp * 0.3)
    out.push({ k: '가장 컸던 한 대', hot: true,
      v: `${worst.by}에게 ${worst.dmg} — 최대 체력의 ${Math.round(worst.dmg / p.maxhp * 100)}%` });
  return out;
}
/* 안 쓴 것들. 여기가 「판단이 중요하다」를 사후에 가르치는 자리다 —
   주머니에 물약이 셋 있었는데 안 마셨다는 한 줄이, 다음 판의 손을
   바꾼다. */
const unspentPotions = p => (p.pack || [])
  .filter(s => s.item?.use && s.item.spr === 'potion')
  .reduce((n, s) => n + (s.qty || 1), 0);
const unspentArts = p => artList(p).filter(a =>
  (p.stam >= artCost(p, a)));
const crowdedBy = p => G.monsters.filter(m => m.awake
  && Math.hypot(m.x - p.x, m.y - p.y) <= 6).length;
/* 표로 둔다. if 를 여섯 개 늘어놓으면 이 함수가 곧 복잡도 15를 넘고
   (sim/knots.mjs 가 이 커밋에서 잡았다), 무엇보다 **줄을 하나 더
   붙이는 일**이 표에 한 줄 적는 일이 된다. */
const UNSPENT = [
  p => { const n = unspentPotions(p); return n && { k:'안 마신 물약', v:`${n}병이 주머니에 남았다` }; },
  p => { const a = unspentArts(p); return a.length && { k:'쓸 수 있었던 기예', v:a.map(x => x.name).join(' · ') }; },
  p => p.lightTurns <= 0 && { k:'불', v:'꺼진 채로 걷고 있었다' },
  () => { const o = G.floorTurn - floorBudget();
          return o > 0 && { k:'층의 여유', v:`${o}턴 넘겼다 — 파도가 ${pressureLevel()}번째였다` }; },
  () => (G.heat || 0) >= 45 && { k:'주목', v:`${G.heat} — ${HEAT_WORD(G.heat)}` },
  p => { const n = crowdedBy(p); return n >= 2 && { k:'둘러싸였다', v:`여섯 칸 안에 깨어 있는 것 ${n}` }; },
];
const unspentLines = p => UNSPENT.map(f => f(p)).filter(Boolean).map(r => ({ ...r, hot: true }));
const postMortem = () => [...lastBlowLines(G.player), ...unspentLines(G.player)];

function victory() {
  G.running = false;
  traceCloseFloor();
  trace('win', {});
  G.ending = { win:true, summary: summarise(true, null) };
  G.screen = 'end';
}

/* Shuffle the appearances for this run. Anything the player
   starts with is already known — you packed it yourself. */
function shuffleAppearances(p) {
  G.looks = {}; G.known = {};
  const pots = [...POTION_LOOKS], scrs = [...SCROLL_LOOKS];
  const take = arr => arr.splice(rnd(arr.length), 1)[0];
  for (const id of UNKNOWABLE) {
    const c = CONSUMABLES.find(x => x.id === id);
    G.looks[id] = c.spr === 'potion' ? `${take(pots)} 물약` : `${take(scrs)} 두루마리`;
  }
  for (const slot of p.pack) G.known[slot.item.id] = true;
}

export const isKnown = id => !id || !UNKNOWABLE.includes(id) || !!G.known[id];
export const lookOf = id => G.looks?.[id] || '알 수 없는 것';

/* What the player is allowed to call it. Every log line has to go
   through here: the inventory was hiding unidentified flasks
   correctly while "치유의 물약을(를) 주웠다" printed the answer in
   the log a line earlier, which made the whole system decorative. */
export const nameOf = it =>
  (it && it.kind === 'use' && !isKnown(it.id)) ? lookOf(it.id) : (it?.n || '무언가');

export function identify(id, quiet) {
  if (!id || G.known[id]) return false;
  G.known[id] = true;
  // The ledger remembers every flask ever named, which is what
  // 연금술사의 기억 is counting.
  Meta.see('items', id);
  const c = CONSUMABLES.find(x => x.id === id);
  if (c && !quiet) say(`${lookOf(id)}은(는) ${c.n}이었다.`, 'level');
  return true;
}

/* ── 판 상태의 정본 목록 ──────────────────────────────────
   판이 시작할 때 비워야 하고, 저장에 적어야 하고, 불러올 때 되살려야
   하는 값들. 세 곳에 손으로 적던 것을 한 표로 모은다.

   왜 모으는가: 리뷰가 재현한 치명 다섯 건이 **전부 셋 중 하나를
   빠뜨린 것**이었다.
     · G.gulped 를 `walkOffTolerance()` 로 비웠다 — 그 함수는 1만
       깎는다. 여덟 병 마신 판 뒤의 새 판이 첫 물약부터 34%였다.
     · G.relicBase 가 저장에 없었다 — 크랙이 주운 자리에서 즉시
       열리거나(불러오기), 앞 판의 셈을 물려받아 영영 안 열렸다.
       save.js 주석은 「크랙 계통 다섯」이라 적어 놓고 넷만 적었다.
     · G.famineSwell — 저장 당시 24였던 천장이 64로 불러와졌다.
     · G.task/taskDone — 잠긴 계단이 불러오기 한 번에 공짜로 열렸다.
     · G.uproar·goldEarned·relicsTaken… — 앞 판의 숫자가 끝 화면에.

   한 곳에 있으면 필드가 늘 때 한 줄만 더하면 되고, sim/save.mjs 가
   「이 표의 모든 키가 저장·복원 양쪽에 있는가」를 기계로 확인한다.
   값은 깊은 사본으로 넣는다 — 얕게 넣으면 판들이 같은 객체를 쓴다. */
export const RUN_FIELDS = {
  gulped: 0, relicBase: {}, famineSwell: 0,
  uproar: 0, uproarTier: 0, lastBlows: [], goldEarned: 0,
  haggled: {}, haggleCut: null, haggleSour: null,
  forced: {}, credited: {}, fallenSeen: {}, did: {}, lit: {},
  relicFloorAt: -1, relicsTaken: 0, relicSrc: {}, gearTaken: 0,
  /* 이물 — 이 판에서 무엇을 봤나, 그리고 그것을 불러들인 값들. */
  strange: null, strangeSeen: [], artsUsed: 0, sneaked: 0, floorArts: {},
  trace: [], floorTally: null,
  rareTaken: 0, rareFound: 0, resoFound: 0,
  floorTurns: {}, blowRatio: 0, funnelled: 0, clung: 0, clungSaid: 0,
  promiseFloor: 0, stillStep: false, taskDone: false, spoils: null,
};
export const resetRun = () => {
  for (const k of Object.keys(RUN_FIELDS)) G[k] = structuredClone(RUN_FIELDS[k]);
};

export function startGame(raceKey, classKey, base) {
  /* The ladder is read *before* the hero is built. 재의 무게 takes
     a slice of maximum health inside recalc, and recalc runs the
     moment createHero is called — set the shackles after that and
     the last rung of the ladder silently does nothing. */
  G.abyss = Meta.abyss();
  G.shackles = shacklesAt(G.abyss);
  G.player = createHero(raceKey, classKey, base);
  G.log = []; G.turn = 0; G.running = true; G.ending = null;
  G.trace = []; G.floorTally = null;
  G.fx = []; G.combo = 0; G.comboT = 0; G.bestCombo = 0;
  G.opened = 0; G.mimicsBitten = 0; G.trapsSprung = 0; G.kills = 0; G.eventsSeen = 0;
  G.ledger = {}; G.cracks = {}; G.relicFloors = {}; G.chainGuard = 0; G.murmured = {};
  G.heat = 0; G.provoked = 0;
  G.arcana = []; G.arcanaPick = null;
  G.god = null; G.godPick = null; G.gifts = []; G.refused = 0; G.piety = 0;
  G.martyred = 0;
  G.regionAt = null;
  G.broke = 0; G.forged = 0; G.transFound = 0; G.perfects = 0; G.fused = 0; G.catUsed = 0;
  resetRun();                            // 표가 비우는 것들 — RUN_FIELDS
  G.act = null;
  G.hpBand = new Array(10).fill(0);
  G.runSeed = Math.floor(Math.random() * 997);   // 판마다 행상의 기분표가 달라진다
  G.haggled = {}; G.haggleCut = null; G.haggleSour = null;
  G.engraved = 0; G.memories = []; G.relicShelf = null;
  G.branch = null; G.pendingBranch = null; G.pendingRelic = null;
  G.nextMods = null; G.campPromise = 0; G.deepest = 0;
  /* 여기 `walkOffTolerance()` 가 있었다. 새 판의 물약 내성을 비우려던
     자리인데 저 함수는 `if (G.gulped > 0) G.gulped--` — **1만 깎는다.**
     여덟 병 마신 판 뒤의 새 판이 첫 물약부터 34% 효율로 시작했고,
     아무 문장도 안 떴다. 이제 RUN_FIELDS 가 0으로 비운다. */
  G.floorTurn = 0; G.waves = 0; G.campUses = 1; G.hazards = []; G.snares = []; G.sanctum = null; G.bank = 0;
  /* 「한 판에 한 번씩만」 표시(fallenSeen·forced·credited)도 RUN_FIELDS
     에 있다. 안 비웠더니 두 번째 판에서 앞사람이 안 나왔고, 벤치가
     그걸 잡았다 — 「한 번만」의 범위가 판인지 세션인지가 갈리는 자리다. */
  G.tally = 0; G.hushUntil = -1; G.uniques = {}; G.fused = 0;
  /* 몇 번째로 내려가는 사람인가. 끝 화면이 이 숫자를 다시 읽는다 —
     앞의 것들이 전부 여기 어딘가에 있다는 뜻이고, 그래서 이 판의
     실패도 다음 사람에게는 자료가 된다. */
  G.sent = sentDown();
  G.pendingAltar = null;
  shuffleAppearances(G.player);

  /* ── what the last run left behind ──────────────────────
     Six memories, and none of them is a stat. Each hands over
     something the player already earned: the flask they named,
     the gold they dug out, the plus they ground. The curve is
     untouched; the starting line is not. */
  const meta = Meta.read();
  G.memories = MEMORIES.filter(x => memoryEarned(meta, x.id)).map(x => x.id);

  if (G.memories.includes('alchemy')) {
    // Everything ever named stays named. A player who has learned
    // what the red flask is should not have to learn it again.
    for (const id of Object.keys(meta.items || {})) G.known[id] = true;
  }
  if (G.memories.includes('smith')) {
    for (const slot of GEAR_SLOTS) {
      const it = G.player.equip[slot];
      if (it) it.plus = Math.max(it.plus || 0, 2);
    }
    recalc(G.player);
  }
  if (G.memories.includes('digger')) G.player.gold += 300;

  enterDepth(0);
  /* ── 여기서부터 이야기가 시작된다 ────────────────────────
     여태 이 게임에는 계기가 없었다. 왜 내려가는지, 누가 보냈는지,
     안 내려가면 어떻게 되는지 — 아무것도. 「던전이 있으니 들어간다」는
     설명이 아니라 설명의 부재다.

     빚이다. 당신은 스스로 온 것이 아니라 팔려 왔다. 목에 채운 것이
     그 값이고, 위에서는 아무도 당신이 돌아오기를 기다리지 않는다.
     이 세 줄이 「올라갈 수 없다」와 「죽으면 다음 사람이 내려간다」를
     동시에 설명한다 — 규칙이 곧 이야기가 되는 자리다. */
  say('갱구다. 아래에 있는 것이 세상을 먹고 있다.', 'warn');
  /* 첫 판에서 「앞의 0은 돌아오지 않았다」가 나왔다. 숫자를 그냥
     끼워 넣으면 이런 문장이 나온다 — 첫 사람에게는 첫 사람의 말이
     있어야 한다. */
  say(G.sent === 1
    ? '아무도 이 아래를 본 적이 없다. 네가 처음이다.'
    : `${G.sent}번째다. 앞의 ${G.sent - 1}명 중 아무도 돌아오지 않았다.`, 'bad');
  /* 오프닝 세 줄 중 둘만 번호를 알고 셋째만 몰랐다. 「사람들이 지쳤다」는
     근거 없는 주장인데, 숫자가 들어가면 그것이 산수가 된다. */
  say(G.sent === 1
    ? '배웅은 없다. 아직 아무도 이 일에 익숙하지 않다.'
    : `배웅은 없다. ${G.sent - 1}번을 배웅했으면 누구든 지친다.`, '');
  /* 그리고 어디로 가는지. 재 보니 들어선 자리에서 갱구까지 평균
     두 칸이다 — 「계단이 눈에 안 띈다」는 제보는 멀어서가 아니라
     **바로 옆에 있는데 그게 뭔지 몰라서**였다. 거리가 아니라 이름의
     문제이므로, 이름을 부른다. */
  say('발밑에서 바람이 올라온다. 갱구는 바로 옆이다 — 준비가 되면 그 위에 서라.', 'good');
  if (G.memories.length)
    say(`기억이 남아 있다 — ${G.memories.map(id => MEMORIES.find(x => x.id === id).n).join(' · ')}.`, 'good');
  if (G.abyss)
    say(`심연 ${G.abyss} — ${SHACKLES.slice(1, G.abyss + 1).map(x => x.k).join(' · ')}.`, 'warn');
  G.screen = 'play';
}

/* Does this run carry that memory? One reader so a memory can
   never be half-applied. */
export const hasMemory = id => (G.memories || []).includes(id);

/* Is this rule on this run? One reader, same shape as hasMemory,
   so a shackle can never be half-applied either. */
export const hasShackle = id => (G.shackles || []).includes(id);
