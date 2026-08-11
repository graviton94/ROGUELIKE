/* ═══════════════════════════════════════════════════════════
   audio.js — every sound in this game is made of arithmetic.

   The project's rule has always been "the pixels are drawn by
   code, there are no image files". Sound gets the same rule: no
   samples, no loading, no licences. Oscillators and a noise
   buffer, shaped by envelopes. The whole file is smaller than a
   single kick drum would have been.

   Two of these are not decoration but interface. The pattern
   warning fires when a boss marks the ground, which can happen
   off the edge of the map view — the ear finds it before the
   eye does. And the low-health pulse is the only channel that
   works while the player is staring at a monster instead of the
   health bar.

   Everything routes through one gain node so a single tap can
   silence the lot, and nothing is created until the first real
   gesture: browsers refuse to start audio before one, and
   asking for it earlier just logs warnings.
   ═══════════════════════════════════════════════════════════ */

let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;

/* ── where the sound is ───────────────────────────────────
   Everything used to arrive at the same volume from the middle
   of your head, which threw away the one thing sound is better
   at than a screen: telling you about somewhere you are not
   looking. A troll smashing a door two rooms west is information,
   and it was arriving as a noise with no address.

   So each sound may carry a place. juice.js already knows where
   every event happened; here that becomes a pan and a falloff.
   Deliberately gentle — this is a game played one-handed on a
   phone speaker, and hard panning on a phone speaker is just
   quieter. Anything without a place stays centred, which is
   correct for the interface sounds. */
let earX = 0, earY = 0;
export function listenAt(x, y) { earX = x; earY = y; }

/* Set once per effect by juice.js, so the whole vocabulary below
   stays a list of `sfx.hit()` with no coordinates threaded
   through forty signatures. Persists until the next event sets
   it, which is right: every sound one event makes comes from the
   same place. */
let pendingAt = null;
export function from(x, y) {
  pendingAt = (x == null || y == null) ? null : { x, y };
}

/* Nulled when there is no place, so the graph stays two nodes
   shorter for every sound that does not need one. */
function place(at) {
  at = at || pendingAt;
  if (!at || !ctx) return null;
  const dx = at.x - earX, dy = at.y - earY;
  const d = Math.hypot(dx, dy);
  const g = ctx.createGain();
  /* Half volume at eight tiles, a fifth at fifteen: audible far
     enough to be a warning, quiet enough not to be a nuisance. */
  g.gain.value = 1 / (1 + d * 0.13);
  let node = g;
  if (ctx.createStereoPanner) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.75, Math.min(0.75, dx / 9));
    g.connect(pan); node = pan;
  }
  node.connect(master);
  /* Far things lose their edge before they lose their volume,
     which is what actually makes distance readable. */
  if (d > 5) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(700, 9000 - d * 480);
    lp.connect(g);
    return lp;
  }
  return g;
}

const KEY = 'deepdelve.mute';

export function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // One second of white noise, reused by every percussive sound.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; return false; }
  return true;
}

export function loadPref() {
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.01);
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* private mode */ }
  return muted;
}

export const isMuted = () => muted;

/* ── primitives ───────────────────────────────────────────
   `tone` is a pitched blip with an exponential decay; `noise`
   is a filtered burst. Almost every sound below is one or two
   of these stacked with different envelopes. */
function tone(freq, dur, {
  type = 'square', gain = 0.2, slide = 0, delay = 0, detune = 0, at = null,
} = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  if (detune) o.detune.setValueAtTime(detune, t0);
  // A hard 0 is illegal for exponential ramps, so decay to near-silence.
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(place(at) || master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(dur, { gain = 0.2, delay = 0, hp = 0, lp = 8000, q = 1, at = null } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = src;
  if (hp) {
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp; f.Q.value = q;
    node.connect(f); node = f;
  }
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass'; lpf.frequency.value = lp;
  node.connect(lpf); lpf.connect(g); g.connect(place(at) || master);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

/* ── the vocabulary ───────────────────────────────────────
   Named for the event that causes them, not for what they
   sound like, so juice.js can stay a list of `sfx.hit()` and
   the mixing decisions all live here. */
export const sfx = {
  /* A landed blow: a click of contact plus a body thud. The
     weapon family shifts the pitch, so a dagger and a maul do
     not sound like the same object. */
  hit(kind = 'sword', power = 1) {
    const base = { dagger: 900, sword: 620, axe: 470, spear: 760, mace: 330, great: 250 }[kind] || 620;
    noise(0.05 + power * 0.03, { gain: 0.16 * power, hp: 1200, lp: 7000 });
    tone(base, 0.07, { type: 'square', gain: 0.10 * power, slide: 0.45 });
  },

  /* The one that should make you sit up. A rising third under
     the impact, which is the cheapest "that was good" in music. */
  crit() {
    noise(0.09, { gain: 0.22, hp: 900 });
    tone(520, 0.10, { type: 'square', gain: 0.16, slide: 2.0 });
    tone(780, 0.14, { type: 'triangle', gain: 0.13, slide: 1.6, delay: 0.04 });
  },

  sneak() {
    tone(1400, 0.05, { type: 'triangle', gain: 0.10, slide: 0.4 });
    tone(300, 0.16, { type: 'square', gain: 0.16, slide: 2.4, delay: 0.03 });
  },

  /* Death of a monster: a downward collapse. `over` is overkill,
     so erasing something at full health is audibly bigger. */
  kill(over = 0) {
    noise(0.12 + over * 0.08, { gain: 0.16 + over * 0.08, lp: 2600 });
    tone(320, 0.16 + over * 0.10, { type: 'sawtooth', gain: 0.13, slide: 0.28 });
    if (over > 0.8) tone(160, 0.30, { type: 'square', gain: 0.14, slide: 0.35, delay: 0.05 });
  },

  /* Taking damage. Deliberately the ugliest sound in the set:
     low, buzzy, and it does not resolve. */
  hurt(severe = false) {
    noise(severe ? 0.18 : 0.09, { gain: severe ? 0.26 : 0.15, lp: 1400 });
    tone(severe ? 90 : 140, severe ? 0.26 : 0.13,
         { type: 'sawtooth', gain: severe ? 0.20 : 0.12, slide: 0.55 });
  },

  miss() { noise(0.05, { gain: 0.07, hp: 2600 }); },

  /* The dodge: a short whoosh that sweeps upward, so a
     successful roll reads as an escape rather than a step. */
  roll() {
    noise(0.16, { gain: 0.13, hp: 500, lp: 5200 });
    tone(240, 0.16, { type: 'sine', gain: 0.10, slide: 3.2 });
  },

  /* Marked ground. This is interface, not flavour — the shape
     can be off the edge of the view. Two beats, and the second
     is higher, which reads as "counting down". */
  warn(urgent = false) {
    tone(urgent ? 880 : 620, 0.09, { type: 'square', gain: 0.13 });
    tone(urgent ? 1170 : 780, 0.11, { type: 'square', gain: 0.12, delay: 0.10 });
  },

  /* The pattern going off. */
  blast() {
    noise(0.34, { gain: 0.28, lp: 1800 });
    tone(70, 0.36, { type: 'sawtooth', gain: 0.20, slide: 0.5 });
  },

  step() { noise(0.03, { gain: 0.035, hp: 1800, lp: 4200 }); },
  door() { noise(0.10, { gain: 0.10, hp: 300, lp: 2200 }); tone(180, 0.10, { type:'square', gain:0.07, slide:0.7 }); },
  pick() { tone(880, 0.05, { type: 'triangle', gain: 0.10 }); tone(1320, 0.07, { type:'triangle', gain:0.08, delay:0.04 }); },
  heal() { tone(520, 0.16, { type: 'sine', gain: 0.12, slide: 1.6 }); tone(780, 0.20, { type:'sine', gain:0.09, slide:1.4, delay:0.06 }); },

  /* Levelling: a plain major arpeggio. It is a cliché because
     it works — three notes and everyone knows what happened. */
  levelup() {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.20, { type: 'triangle', gain: 0.13, delay: i * 0.07 }));
  },

  /* A relic. Lower and longer than a level, because it is a
     change in kind rather than a step on a ladder. */
  relic() {
    [392, 587, 784].forEach((f, i) =>
      tone(f, 0.42, { type: 'sine', gain: 0.14, delay: i * 0.09 }));
    noise(0.3, { gain: 0.06, hp: 3000 });
  },

  /* The gamble resolving. `n` is how far up the ladder the
     result landed, so a jackpot climbs and a disaster falls —
     and the tick of the wheel before it is a separate call so
     the anticipation can be as long as the animation. */
  tick(step = 0) { tone(700 + step * 40, 0.03, { type: 'square', gain: 0.07 }); },
  jackpot() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone(f, 0.5, { type: 'triangle', gain: 0.15, delay: i * 0.06 }));
    noise(0.5, { gain: 0.10, hp: 2000 });
  },
  bust() {
    [392, 330, 262, 196].forEach((f, i) =>
      tone(f, 0.34, { type: 'sawtooth', gain: 0.14, delay: i * 0.08 }));
  },

  /* The combo ladder. Pitch rises with the streak, so the chain
     is audible without looking at the chip. */
  combo(n) {
    const step = Math.min(n, 20);
    tone(440 * Math.pow(2, step / 24), 0.08, { type: 'square', gain: 0.10 });
  },

  /* Below a quarter health. Fires once per crossing, not per
     turn — a heartbeat you cannot ignore but that does not
     become the soundtrack. */
  lowHp() {
    tone(110, 0.22, { type: 'sine', gain: 0.20 });
    tone(110, 0.22, { type: 'sine', gain: 0.16, delay: 0.24 });
  },

  death() {
    [330, 262, 196, 147, 98].forEach((f, i) =>
      tone(f, 0.7, { type: 'sawtooth', gain: 0.16, delay: i * 0.13 }));
    noise(0.9, { gain: 0.12, lp: 900, delay: 0.1 });
  },

  victory() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
      tone(f, 0.6, { type: 'triangle', gain: 0.16, delay: i * 0.13 }));
  },
};
