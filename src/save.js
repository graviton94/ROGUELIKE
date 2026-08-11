/* ═══════════════════════════════════════════════════════════
   save.js — three slots in localStorage.

   game.js still knows nothing about the browser: it holds plain
   state, and this file reaches in, flattens it, and puts it
   back. That is why the headless simulation keeps working.

   The awkward parts are the level's four TypedArrays and two
   Maps. JSON would turn a Uint8Array into an object with 2640
   numbered keys, so they go out as base64 instead — about 3.5 KB
   each instead of ~15 KB of JSON.
   ═══════════════════════════════════════════════════════════ */

import { G, say, refreshFov } from './game.js';
import { Level, THEMES, MW, MH, idx } from './world.js';
import { BRANCHES } from './data.js';

const PREFIX = 'deepdelve.slot.';
export const SLOTS = 3;
const FORMAT = 5;

/* ── byte packing ───────────────────────────────────────── */
function toB64(bytes) {
  let s = '';
  const CHUNK = 8192;              // spreading 2640 is fine, but be safe
  for (let i = 0; i < bytes.length; i += CHUNK)
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

function fromB64(str, length) {
  const bin = atob(str);
  const out = new Uint8Array(length);
  for (let i = 0; i < bin.length && i < length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── the level ──────────────────────────────────────────── */
function packLevel(L) {
  // roomOf is Int16 holding -1..rooms.length; shift by one so it
  // fits in a byte. Rooms never exceed ~15 per floor.
  const rooms = new Uint8Array(MW * MH);
  for (let i = 0; i < rooms.length; i++) rooms[i] = Math.min(254, L.roomOf[i] + 1);

  return {
    depth: L.depth,
    tiles: toB64(L.tiles),
    seen:  toB64(L.seen),
    vis:   toB64(L.vis),
    roomOf: toB64(rooms),
    rooms: L.rooms,
    entry: L.entry,
    camp: L.camp || null,
    merchant: L.merchant || null,
    altar: L.altar || null,
    theme: L.theme?.id || 'plain',
    campSpent: !!L.campSpent,
    event: L.event || null,
    eventId: L.eventId || null,
    downRoom: L.downRoom ? L.rooms.indexOf(L.downRoom) : -1,
    shopAt: [...L.shopAt],
    keeperAt: [...(L.keeperAt || [])],
    signAt: [...(L.signAt || [])],
    traps: [...L.traps].map(([i, t]) => [i, t.kind, t.seen ? 1 : 0]),
  };
}

function unpackLevel(d) {
  /* Build the instance without running the constructor — that
     would generate a brand new dungeon and throw away the one
     being restored. Object.create keeps solid()/opaque()/etc. */
  const L = Object.create(Level.prototype);
  const n = MW * MH;
  L.depth  = d.depth;
  L.tiles  = fromB64(d.tiles, n);
  L.seen   = fromB64(d.seen, n);
  L.vis    = fromB64(d.vis, n);

  const rooms8 = fromB64(d.roomOf, n);
  L.roomOf = new Int16Array(n);
  for (let i = 0; i < n; i++) L.roomOf[i] = rooms8[i] - 1;

  L.rooms  = d.rooms || [];
  L.entry  = d.entry || { x: 0, y: 0 };
  L.camp   = d.camp || null;
  L.merchant = d.merchant || null;
  L.altar = d.altar || null;
  L.event = d.event || null;
  L.eventId = d.eventId || null;
  L.branch = {};                 // generation-time only; nothing reads it after
  L.theme = THEMES[d.theme] || THEMES.plain;
  L.campSpent = !!d.campSpent;
  L.downRoom = d.downRoom >= 0 ? L.rooms[d.downRoom] : undefined;
  L.shopAt = new Map(d.shopAt || []);
  L.keeperAt = new Map(d.keeperAt || []);
  L.signAt = new Map(d.signAt || []);
  L.traps  = new Map((d.traps || []).map(([i, kind, seen]) => [i, { kind, seen: !!seen }]));
  return L;
}

/* ── the whole run ──────────────────────────────────────── */
export function snapshot() {
  if (!G.player || !G.level) return null;
  return {
    format: FORMAT,
    savedAt: Date.now(),
    depth: G.depth,
    turn: G.turn,
    combo: G.combo, comboT: G.comboT, bestCombo: G.bestCombo,
    opened: G.opened, mimicsBitten: G.mimicsBitten, trapsSprung: G.trapsSprung,
    detectPulse: G.detectPulse || 0,
    looks: G.looks || {}, known: G.known || {},
    branch: G.branch?.id || 'plain',
    floorTurn: G.floorTurn || 0, waves: G.waves || 0, campUses: G.campUses ?? 1,
    deepest: G.deepest || 0, campPromise: G.campPromise || 0,
    hazards: G.hazards || [], bank: G.bank || 0,
    kills: G.kills || 0, eventsSeen: G.eventsSeen || 0,
    broke: G.broke || 0, forged: G.forged || 0, tideUsed: !!G.tideUsed,
    transFound: G.transFound || 0, perfects: G.perfects || 0, fused: G.fused || 0,
    catUsed: G.catUsed || 0,
    nextMods: G.nextMods || null,
    player: G.player,
    monsters: G.monsters,
    items: G.items,
    log: G.log.slice(-40),
    level: packLevel(G.level),
  };
}

export function apply(data) {
  if (!data || data.format !== FORMAT) return false;
  G.depth   = data.depth;
  G.turn    = data.turn;
  G.combo   = data.combo || 0;
  G.comboT  = data.comboT || 0;
  G.bestCombo = data.bestCombo || 0;
  G.opened  = data.opened || 0;
  G.mimicsBitten = data.mimicsBitten || 0;
  G.trapsSprung  = data.trapsSprung || 0;
  G.detectPulse  = data.detectPulse || 0;
  G.looks = data.looks || {};
  G.known = data.known || {};
  G.branch = BRANCHES.find(b => b.id === data.branch) || BRANCHES[0];
  G.floorTurn = data.floorTurn || 0;
  G.waves = data.waves || 0;
  G.campUses = data.campUses ?? 1;
  G.deepest = data.deepest || data.depth || 0;
  G.campPromise = data.campPromise || 0;
  G.hazards = data.hazards || [];
  G.bank = data.bank || 0;
  G.kills = data.kills || 0;
  G.eventsSeen = data.eventsSeen || 0;
  G.broke = data.broke || 0;
  G.tideUsed = !!data.tideUsed;
  G.transFound = data.transFound || 0;
  G.perfects = data.perfects || 0;
  G.fused = data.fused || 0;
  G.catUsed = data.catUsed || 0;
  G.forged = data.forged || 0;
  G.pendingAltar = null;
  G.nextMods = data.nextMods || null;
  G.pendingBranch = null;
  G.pendingRelic = null;
  G.player  = data.player;
  G.monsters = data.monsters || [];
  G.items    = data.items || [];
  G.log      = data.log || [];
  G.level    = unpackLevel(data.level);
  G.fx = [];
  G.ending = null;
  G.running = true;
  G.shop = null;

  // Older saves predate a field; fill the gaps rather than crash.
  const p = G.player;
  p.ail = p.ail || {};
  p.spellPlus = p.spellPlus || {};
  p.spellAffix = p.spellAffix || {};
  p.stuck = p.stuck || 0;
  p.keys = p.keys || 0;
  p.mats = p.mats || { scrap: 0, dust: 0, essence: 0 };
  p.might = p.might || 0;
  p.iron = p.iron || 0;
  p.relics = p.relics || [];
  p.boneHp = p.boneHp || 0;
  p.seedAc = p.seedAc || 0;
  p.grudge = p.grudge || 0;
  p.perm = p.perm || {};
  p.tuned = p.tuned || {};
  p.markup = p.markup || 0;
  p.permHp = p.permHp || 0;
  p.iframe = p.iframe || 0;
  if (p.stam == null) p.stam = 0;

  refreshFov();
  return true;
}

/* ── slots ──────────────────────────────────────────────── */
const key = slot => `${PREFIX}${slot}`;

export function write(slot, data) {
  try {
    localStorage.setItem(key(slot), JSON.stringify(data));
    return true;
  } catch (e) {
    // Quota or a private-browsing window that refuses writes.
    say('저장에 실패했다. 브라우저 저장 공간을 확인하시오.', 'warn');
    return false;
  }
}

export function read(slot) {
  try {
    const raw = localStorage.getItem(key(slot));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clear(slot) {
  try { localStorage.removeItem(key(slot)); } catch { /* nothing to do */ }
}

/* A cheap header for the slot list — never parses the level. */
export function describe(slot) {
  const d = read(slot);
  if (!d || !d.player) return null;
  return {
    slot,
    race: d.player.race, cls: d.player.cls,
    lv: d.player.lv, depth: d.depth, turn: d.turn,
    hp: d.player.hp, maxhp: d.player.maxhp,
    bestCombo: d.bestCombo || 0,
    savedAt: d.savedAt || 0,
  };
}

export const anySaved = () => {
  for (let i = 0; i < SLOTS; i++) if (describe(i)) return true;
  return false;
};

export function save(slot) {
  const snap = snapshot();
  return snap ? write(slot, snap) : false;
}

export function load(slot) {
  const d = read(slot);
  return d ? apply(d) : false;
}

export const available = () => {
  try {
    const probe = '__dd__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch { return false; }
};
