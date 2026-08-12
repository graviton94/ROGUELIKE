import * as Game from '../src/game.js';
import { G } from '../src/game.js';
import { idx, MW, MH, DOWN, CAMP, ANVIL, PROP, walkable } from '../src/world.js';
import { ENCHANT_COST } from '../src/data.js';
import * as BOWDATA from '../src/data.js';
export const ARTUSE = {};
function useArtCounted(id) { ARTUSE[id] = (ARTUSE[id]||0)+1; Game.cast(id); }
const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const prev = new Int32Array(MW*MH);
function route(pred) { return routeAvoiding(pred, true) || routeAvoiding(pred, false); }

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

function routeAvoiding(pred, dodgeTraps) {
  const L = G.level, p = G.player;
  const ducked = duckedNamed();
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

function runBot(race, cls, clear, opt = {}) {
  Game.startGame(race, cls, Game.rollStats());
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
  Game.descend();
  const st = { crits: 0, sneaks: 0, kills: 0, misses: 0, camps: 0, elites: 0, named: 0, shops: 0, broke: 0, events: 0, rolls: 0, branch: {} };
  let path = null, guard = 0, depthAt = G.depth;
  const hist = [];
  let traded = false;   // one visit per floor; the bot has no other reason to stop

  while (G.running && guard++ < 60000) {
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
    if (arts.length) {
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

      const brace = art('brace');
      if (can(brace) && !(p.brace > 0)
          && (adjA.length >= 2 || shooters.length || adjA.some(m => m.heavy)))
        { useArtCounted('brace'); continue; }

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

      const martyr = art('martyr');
      if (canPray(martyr) && !(p.martyr > 0)
          && p.hp < p.maxhp * 0.3 && adjA.length >= 2)
        { useArtCounted('martyr'); continue; }

      const judge = art('judge');
      if (canPray(judge) && dead.length >= 2) { useArtCounted('judge'); continue; }

      const sanctum = art('sanctum');
      const onHoly = G.sanctum && G.sanctum.left > 0
        && G.sanctum.x === p.x && G.sanctum.y === p.y;
      if (canPray(sanctum) && !onHoly
          && (adjA.length >= 2 || dead.length >= 1 || p.hp < p.maxhp * 0.5))
        { useArtCounted('sanctum'); continue; }

      // Anathema pays for itself on the things that outlast a
      // trade: healers, and anything with a big pool.
      const anath = art('anathema');
      if (canPray(anath)) {
        const worth = seen.find(m => !m.cursed
          && (m.regen > 0 || m.named || m.maxhp >= p.maxhp * 1.2));
        if (worth) { useArtCounted('anathema'); continue; }
      }
    }

    /* Loose an arrow rather than walk into a fight you could have
       finished from here. Only past arm's length — a bow up close
       is half a blow, so stepping back and shooting is the whole
       point of carrying one. */
    if (Game.canShoot()) {
      const t = Game.shotTarget();
      if (t && Math.hypot(t.x - p.x, t.y - p.y) > 1.6) { Game.shoot(); continue; }
    }

    const spells = Game.spellList(p);
    if (spells.length && p.mana > 0) {
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

      const nuke = has('smite') || has('bolt');
      if (afford(nuke) && far.length) { Game.cast(nuke.id); continue; }
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

    if (G.depth !== depthAt) { depthAt = G.depth; path = null; traded = false; }

    /* The fire is the body and the relics now. Cash the wager if
       there is one, otherwise rest — the bot does not gamble on
       fusion, so these numbers stay a floor. */
    if (G.screen === 'camp') {
      const purse = Game.bankPurse2();
      if (purse && p.hp > p.maxhp * 0.7) Game.campCash();
      else Game.campRest();
      st.camps++;
      continue;
    }

    /* The anvil does not run out, so the bot hammers until it
       cannot pay — which is exactly the behaviour the place was
       built to allow. It pays for 신중 whenever a miss would cost
       more than the materials and it can afford the doubled bill. */
    if (G.screen === 'anvil') {
      let hits = 0;
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
        }
      }
      st.anvils = (st.anvils || 0) + 1;
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
      return !worn || score(it) > score(worn);
    });
    if (better >= 0) { Game.equip(better); continue; }

    // Break spare gear rather than hauling it.
    const junk = p.pack.findIndex(sl => Game.canSalvage(sl.item));
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
    if (hit) { path = null; Game.step(hit[0], hit[1]); continue; }

    if (!path || !path.length) {
      const holding = clear && !Game.pressureLevel();
      path = (holding && G.monsters.length
              ? route((x, y) => { const m = Game.monsterAt(x, y);
                                  return m && !(m.named && !m.provoked && !willFight(m)); }) : null)
          || route((x, y) => G.items.some(i => i.kind === 'relic' && i.x === x && i.y === y))
          || (traded ? null : route((x, y) => G.level.shopAt.get(idx(x, y)) === 7))
          || route((x, y) => G.level.tiles[idx(x, y)] === CAMP)
          // The anvil is worth a detour whenever there is anything
          // to spend. Without this the bot only ever stood on one
          // by accident and the whole economy read as unused.
          || (Game.canAfford({ scrap: 6, gold: 140 })
              ? route((x, y) => G.level.tiles[idx(x, y)] === ANVIL) : null)
          || route((x, y) => G.level.tiles[idx(x, y)] === 14)
          || route((x, y) => G.level.tiles[idx(x, y)] === DOWN);
      if (!path) {
        if (G.level.tiles[idx(p.x, p.y)] === DOWN) { Game.descend(); continue; }
        Game.step(0, 0); continue;
      }
    }

    const next = path.shift();
    const nx = next % MW, ny = (next / MW) | 0;
    Game.step(Math.sign(nx - p.x), Math.sign(ny - p.y));
    if (p.x !== nx || p.y !== ny) path = null;   // blocked, re-plan next tick

    if (!path?.length && G.level.tiles[idx(p.x, p.y)] === DOWN
        && !(clear && !Game.pressureLevel() && G.monsters.length)) Game.descend();
  }

  return { depth: G.depth, lv: G.player.lv, win: !!G.ending?.win, turn: G.turn,
           killer: G.ending?.by || '?',
           relics: (G.player.relics || []).length, waves: G.waves || 0,
           best: G.bestCombo || 0, stuck: guard >= 60000,
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
           arrowsAtEnd: 0,
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
