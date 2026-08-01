/**
 * sfx.cjs — one-shot sound effects.
 *
 * 44.1 kHz mono: these are short, and transient detail (a coin, a footstep)
 * is exactly where sample rate is audible. Total cost is ~2 MB for all 13.
 *
 * 8 replace existing placeholders; 5 are the transition stings referenced by
 * `audio.transitionSound` in src/data/locations/*.location.json, which had no
 * files at all (the validator warned, the runtime silently skipped them).
 *
 * These do NOT loop, so they get proper fades to zero at both ends.
 */

'use strict';

const A = require('./lib/audio.cjs');
const I = require('./lib/instruments.cjs');
const Amb = require('./ambient.cjs');

const SR = 44100;

/** Trim to `dur`, fade the last 25 ms, guarantee it ends at true silence. */
function finish(buf, dur, { peak = 0.82, fadeOut = 0.025, fadeIn = 0.002 } = {}) {
  const n = Math.round(dur * SR);
  const out = A.buffer(n);
  for (let i = 0; i < n; i++) out[i] = buf[i] || 0;
  A.fadeIn(out, Math.round(fadeIn * SR));
  A.fadeOut(out, Math.round(fadeOut * SR));
  A.dcBlock(out, SR);
  return A.normalize(out, peak);
}

const noiseBurst = (dur, rand, o) => Amb.burst(Math.round(dur * SR), SR, rand, o);

// ---------------------------------------------------------------------------
// UI / interaction
// ---------------------------------------------------------------------------

/** sfx-menu-select — a small struck bonang, two notes. */
function menuSelect() {
  const rand = A.rng('melaka:sfx-menu-select:v1');
  const n = Math.round(0.5 * SR);
  const out = A.buffer(n);
  A.addInto(out, I.bonang(880, 0.06, { sr: SR, amp: 0.5, decay: 0.28, tail: 0.3 }), 0);
  A.addInto(out, I.bonang(1318, 0.06, { sr: SR, amp: 0.36, decay: 0.3, tail: 0.3 }), Math.round(0.055 * SR));
  A.filter(out, 'highpass', SR, 400, 0.7);
  return { key: 'sfx-menu-select', seed: 'melaka:sfx-menu-select:v1', dur: 0.5, channels: [finish(out, 0.5)], sr: SR };
}

/** sfx-dialogue-blip — Ultima-style speech tick: short, pitched, dry. */
function dialogueBlip() {
  const rand = A.rng('melaka:sfx-dialogue-blip:v1');
  const dur = 0.09;
  const n = Math.round(dur * SR);
  const out = A.buffer(n);
  const f = 620;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // square-ish tone through a fast decay = the classic RPG voice blip
    const ph = 2 * Math.PI * f * t * (1 + 0.6 * Math.exp(-t / 0.012));
    const sq = Math.sin(ph) + 0.33 * Math.sin(3 * ph) + 0.2 * Math.sin(5 * ph);
    out[i] = sq * A.percEnv(t, 0.002, 0.022);
  }
  A.filter(out, 'lowpass', SR, 3200, 0.8);
  A.filter(out, 'highpass', SR, 300, 0.7);
  return { key: 'sfx-dialogue-blip', seed: 'melaka:sfx-dialogue-blip:v1', dur, channels: [finish(out, dur, { peak: 0.7, fadeOut: 0.012 })], sr: SR };
}

/** sfx-item-pickup — rising three-note gamelan flourish. */
function itemPickup() {
  const rand = A.rng('melaka:sfx-item-pickup:v1');
  const dur = 0.75;
  const out = A.buffer(Math.round(dur * SR));
  const notes = [[659, 0], [880, 0.055], [1174, 0.11]];
  notes.forEach(([f, t], i) => {
    A.addInto(out, I.bonang(f, 0.06, { sr: SR, amp: 0.5 - i * 0.06, decay: 0.5, tail: 0.5 }), Math.round(t * SR));
  });
  // a light shimmer tail
  A.addInto(out, I.metallophone(2349, 0.04, { sr: SR, amp: 0.14, decay: 0.35, tail: 0.4 }), Math.round(0.15 * SR));
  A.reverb(out, SR, { size: 0.8, mix: 0.2 });
  A.filter(out, 'highpass', SR, 350, 0.7);
  return { key: 'sfx-item-pickup', seed: 'melaka:sfx-item-pickup:v1', dur, channels: [finish(out, dur)], sr: SR };
}

/** sfx-coin-clink — small metal discs, several irregular clinks. */
function coinClink() {
  const rand = A.rng('melaka:sfx-coin-clink:v1');
  const dur = 0.55;
  const out = A.buffer(Math.round(dur * SR));
  for (let k = 0; k < 5; k++) {
    const len = Math.round(0.3 * SR);
    const c = A.buffer(len);
    const f = rand.range(2400, 4600);
    // inharmonic disc partials
    for (const [r, a] of [[1, 1], [1.59, 0.6], [2.14, 0.4], [2.92, 0.22], [3.5, 0.12]]) {
      const ff = f * r;
      if (ff > SR * 0.45) continue;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        c[i] += Math.sin(2 * Math.PI * ff * t) * Math.exp(-t / (0.055 / (r * 0.6))) * a;
      }
    }
    A.addInto(c, noiseBurst(0.01, rand, { f: f * 1.6, q: 1.2, decay: 0.004 }), 0, 0.35);
    A.addInto(out, c, Math.round(rand.range(0, 0.18) * SR), rand.range(0.45, 1));
  }
  A.filter(out, 'highpass', SR, 900, 0.7);
  return { key: 'sfx-coin-clink', seed: 'melaka:sfx-coin-clink:v1', dur, channels: [finish(out, dur)], sr: SR };
}

/** sfx-door-open — heavy timber: latch, a long creak, a closing thud. */
function doorOpen() {
  const rand = A.rng('melaka:sfx-door-open:v1');
  const dur = 1.6;
  const out = A.buffer(Math.round(dur * SR));

  // iron latch
  A.addInto(out, noiseBurst(0.09, rand, { f: 2600, q: 1.6, decay: 0.02, amp: 0.8 }), 0, 0.55);
  A.addInto(out, noiseBurst(0.09, rand, { f: 1200, q: 1.2, decay: 0.03, amp: 0.8 }), Math.round(0.012 * SR), 0.45);

  // the creak: stick-slip on a swept resonant filter
  const cLen = Math.round(0.85 * SR);
  const creak = A.whiteNoise(cLen, rand);
  const bq = new A.Biquad('bandpass', SR, 380, 16);
  for (let i = 0; i < cLen; i++) {
    const t = i / cLen;
    if (i % 32 === 0) bq.set('bandpass', SR, 340 + 420 * t + 60 * Math.sin(2 * Math.PI * 5 * t), 16);
    // stick-slip: gate the noise with an irregular sawtooth
    const grind = 0.45 + 0.55 * Math.abs(Math.sin(2 * Math.PI * (14 + 8 * t) * t));
    creak[i] = bq.process(creak[i]) * grind * Math.sin(Math.PI * t) ** 0.6;
  }
  A.addInto(out, creak, Math.round(0.1 * SR), 1.4);

  // hinge groan (low body)
  const gLen = Math.round(0.7 * SR);
  const groan = A.buffer(gLen);
  for (let i = 0; i < gLen; i++) {
    const t = i / gLen;
    const ph = 2 * Math.PI * 92 * (i / SR) * (1 + 0.25 * t);
    groan[i] = (Math.sin(ph) + 0.45 * Math.sin(ph * 2.3)) * Math.sin(Math.PI * t) * 0.35;
  }
  A.addInto(out, groan, Math.round(0.15 * SR), 0.6);

  // final thud
  A.addInto(out, I.drumLow(0, { sr: SR, amp: 0.55, freq: 68, decay: 0.16, rand }), Math.round(1.05 * SR));
  A.reverb(out, SR, { size: 1.1, mix: 0.2 });
  return { key: 'sfx-door-open', seed: 'melaka:sfx-door-open:v1', dur, channels: [finish(out, dur)], sr: SR };
}

// ---------------------------------------------------------------------------
// Footsteps
// ---------------------------------------------------------------------------

function footstep(key, seed, { thumpF, thumpDecay, scuffF, scuffQ, scuffDecay, scuffGain, lp, grit = 0 }) {
  const rand = A.rng(seed);
  const dur = 0.3;
  const out = A.buffer(Math.round(dur * SR));
  // heel impact
  const th = A.buffer(Math.round(0.2 * SR));
  for (let i = 0; i < th.length; i++) {
    const t = i / SR;
    const f = thumpF * (1 + 0.5 * Math.exp(-t / 0.008));
    th[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / thumpDecay);
  }
  A.addInto(out, th, 0, 0.6);
  // surface scuff
  A.addInto(out, noiseBurst(0.16, rand, { f: scuffF, q: scuffQ, decay: scuffDecay }), 0, scuffGain);
  // loose grit / gravel for dirt
  if (grit) {
    for (let k = 0; k < 7; k++) {
      A.addInto(out, noiseBurst(0.03, rand, { f: rand.range(2500, 6000), q: 2.5, decay: 0.006 }),
        Math.round(rand.range(0.005, 0.09) * SR), grit * rand.range(0.3, 1));
    }
  }
  A.filter(out, 'lowpass', SR, lp, 0.8);
  A.filter(out, 'highpass', SR, 55, 0.7);
  return { key, seed, dur, channels: [finish(out, dur, { peak: 0.75 })], sr: SR };
}

const footstepStone = () => footstep('sfx-footstep-stone', 'melaka:sfx-footstep-stone:v1',
  { thumpF: 110, thumpDecay: 0.03, scuffF: 2200, scuffQ: 0.9, scuffDecay: 0.022, scuffGain: 0.5, lp: 7000 });
const footstepWood = () => footstep('sfx-footstep-wood', 'melaka:sfx-footstep-wood:v1',
  { thumpF: 155, thumpDecay: 0.07, scuffF: 900, scuffQ: 1.4, scuffDecay: 0.04, scuffGain: 0.45, lp: 4200 });
const footstepDirt = () => footstep('sfx-footstep-dirt', 'melaka:sfx-footstep-dirt:v1',
  { thumpF: 85, thumpDecay: 0.035, scuffF: 1400, scuffQ: 0.6, scuffDecay: 0.05, scuffGain: 0.55, lp: 3400, grit: 0.22 });

// ---------------------------------------------------------------------------
// Location transition stings (previously missing entirely)
// ---------------------------------------------------------------------------

/** sfx-gate-creak — A Famosa: the fortress gate swinging on iron hinges. */
function gateCreak() {
  const rand = A.rng('melaka:sfx-gate-creak:v1');
  const dur = 2.4;
  const out = A.buffer(Math.round(dur * SR));

  // A much bigger, slower version of the door creak — lower, longer, stonier.
  const cLen = Math.round(1.7 * SR);
  const creak = A.whiteNoise(cLen, rand);
  const bq = new A.Biquad('bandpass', SR, 220, 20);
  const bq2 = new A.Biquad('bandpass', SR, 440, 12);
  for (let i = 0; i < cLen; i++) {
    const t = i / cLen;
    if (i % 32 === 0) {
      bq.set('bandpass', SR, 190 + 260 * Math.pow(t, 0.8) + 40 * Math.sin(2 * Math.PI * 3.1 * t), 20);
      bq2.set('bandpass', SR, 380 + 520 * Math.pow(t, 0.8), 12);
    }
    const grind = 0.35 + 0.65 * Math.abs(Math.sin(2 * Math.PI * (7 + 6 * t) * t));
    const x = creak[i];
    creak[i] = (bq.process(x) * 1.0 + bq2.process(x) * 0.5) * grind * Math.sin(Math.PI * t) ** 0.5;
  }
  A.addInto(out, creak, Math.round(0.06 * SR), 1.5);

  // massive timber groan
  const gLen = Math.round(1.5 * SR);
  const groan = A.buffer(gLen);
  for (let i = 0; i < gLen; i++) {
    const t = i / gLen;
    const ph = 2 * Math.PI * 54 * (i / SR) * (1 + 0.18 * t);
    groan[i] = (Math.sin(ph) + 0.5 * Math.sin(ph * 2.2) + 0.25 * Math.sin(ph * 3.7))
      * Math.sin(Math.PI * t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 6 * t)) * 0.45;
  }
  A.addInto(out, groan, 0, 0.8);
  // chain rattle
  for (let k = 0; k < 9; k++) {
    A.addInto(out, noiseBurst(0.04, rand, { f: rand.range(1800, 4200), q: 2.2, decay: 0.008 }),
      Math.round(rand.range(0.1, 1.5) * SR), rand.range(0.1, 0.3));
  }
  // final boom against the stone jamb
  A.addInto(out, I.drumLow(0, { sr: SR, amp: 0.7, freq: 52, decay: 0.3, rand }), Math.round(1.72 * SR));
  A.reverb(out, SR, { size: 1.7, mix: 0.3, damp: 0.28 });
  return { key: 'sfx-gate-creak', seed: 'melaka:sfx-gate-creak:v1', dur, channels: [finish(out, dur)], sr: SR };
}

/** sfx-waves-crash — Waterfront: one big wave breaking on the quay. */
function wavesCrash() {
  const rand = A.rng('melaka:sfx-waves-crash:v1');
  const dur = 2.6;
  const n = Math.round(dur * SR);
  const out = A.whiteNoise(n, rand);
  // Swell in with a rising lowpass, break into bright spray, drain away.
  const bq = new A.Biquad('lowpass', SR, 300, 0.9);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    if (i % 64 === 0) {
      const cut = t < 0.42 ? 300 + 5200 * Math.pow(t / 0.42, 2)
        : 5500 * Math.pow(1 - (t - 0.42) / 0.58, 0.8) + 260;
      bq.set('lowpass', SR, Math.max(200, cut), 0.9);
    }
    const env = t < 0.42 ? Math.pow(t / 0.42, 1.5) : Math.pow(1 - (t - 0.42) / 0.58, 1.3);
    out[i] = bq.process(out[i]) * env * 2.6;
  }
  // low body of the impact
  A.addInto(out, I.drumLow(0, { sr: SR, amp: 0.35, freq: 46, decay: 0.45, rand }), Math.round(0.4 * SR));
  // spray fizz
  const fz = A.whiteNoise(Math.round(1.1 * SR), rand);
  A.filter(fz, 'highpass', SR, 4500, 0.7);
  for (let i = 0; i < fz.length; i++) fz[i] *= Math.pow(1 - i / fz.length, 2.2);
  A.addInto(out, fz, Math.round(0.45 * SR), 0.35);
  A.filter(out, 'highpass', SR, 40, 0.7);
  return { key: 'sfx-waves-crash', seed: 'melaka:sfx-waves-crash:v1', dur, channels: [finish(out, dur)], sr: SR };
}

/** sfx-crowd-murmur — Rua Direita: a swell of market voices. */
function crowdMurmur() {
  const rand = A.rng('melaka:sfx-crowd-murmur:v1');
  const dur = 2.2;
  const n = Math.round(dur * SR);
  const out = A.buffer(n);
  for (let k = 0; k < 55; k++) {
    const nSyl = rand.int(2, 4);
    let off = Math.round(rand.range(0, dur - 0.6) * SR);
    for (let s = 0; s < nSyl; s++) {
      const syl = Amb.wallaSyllable(SR, rand, {
        pitch: rand.range(95, 235), dur: rand.range(0.13, 0.3), female: rand.chance(0.45),
      });
      A.addInto(out, syl, off, rand.range(0.4, 1));
      off += Math.round(syl.length * rand.range(0.8, 1.2));
    }
  }
  // arch envelope: the crowd swells up as you arrive and settles
  for (let i = 0; i < n; i++) {
    const t = i / n;
    out[i] *= Math.sin(Math.PI * Math.pow(t, 0.8)) ** 0.7;
  }
  A.filter(out, 'bandpass', SR, 900, 0.45);
  A.reverb(out, SR, { size: 0.8, mix: 0.22 });
  return { key: 'sfx-crowd-murmur', seed: 'melaka:sfx-crowd-murmur:v1', dur, channels: [finish(out, dur)], sr: SR };
}

/** sfx-birds-tropical — Kampung: a flutter of birds taking off. */
function birdsTropical() {
  const rand = A.rng('melaka:sfx-birds-tropical:v1');
  const dur = 2.0;
  const n = Math.round(dur * SR);
  const out = A.buffer(n);
  for (let k = 0; k < 9; k++) {
    const b = Amb.birdCall(SR, rand, { base: rand.range(1700, 3900), syllables: rand.int(2, 5) });
    A.addInto(out, b, Math.round(rand.range(0, 1.5) * SR), rand.range(0.35, 1));
  }
  // wingbeats: rhythmic low-mid noise puffs
  for (let k = 0; k < 3; k++) {
    const start = rand.range(0.05, 0.9);
    const rate = rand.range(11, 16);
    for (let w = 0; w < 8; w++) {
      A.addInto(out, noiseBurst(0.05, rand, { f: rand.range(320, 700), q: 0.8, decay: 0.014 }),
        Math.round((start + w / rate) * SR), 0.35 * Math.pow(0.88, w));
    }
  }
  A.filter(out, 'highpass', SR, 260, 0.7);
  A.reverb(out, SR, { size: 1.0, mix: 0.24 });
  return { key: 'sfx-birds-tropical', seed: 'melaka:sfx-birds-tropical:v1', dur, channels: [finish(out, dur)], sr: SR };
}

/** sfx-wind-hilltop — St Paul's: a gust across the exposed hill. */
function windHilltop() {
  const rand = A.rng('melaka:sfx-wind-hilltop:v1');
  const dur = 2.8;
  const n = Math.round(dur * SR);
  const out = A.brownNoise(n, rand);
  A.filter(out, 'lowpass', SR, 900, 0.7);
  A.gain(out, 0.7);

  // whistling round the ruined stone: a resonant band sweeping with the gust
  const wh = A.whiteNoise(n, rand);
  const bq = new A.Biquad('bandpass', SR, 700, 11);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.sin(Math.PI * Math.pow(t, 0.85)) ** 1.2;
    if (i % 64 === 0) bq.set('bandpass', SR, 520 + 900 * env + 90 * Math.sin(2 * Math.PI * 1.7 * t), 11);
    wh[i] = bq.process(wh[i]) * env;
  }
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.sin(Math.PI * Math.pow(t, 0.85)) ** 1.1;
    out[i] = out[i] * env + wh[i] * 1.5;
  }
  // a lone distant gull for the hilltop's view of the strait
  const g = Amb.gullCry(SR, rand);
  A.filter(g, 'lowpass', SR, 2600, 0.7);
  A.addInto(out, g, Math.round(1.5 * SR), 0.16);
  A.echo(out, SR, 0.21, 0.22, 0.16);
  A.filter(out, 'highpass', SR, 45, 0.7);
  return { key: 'sfx-wind-hilltop', seed: 'melaka:sfx-wind-hilltop:v1', dur, channels: [finish(out, dur)], sr: SR };
}

const SFX = {
  'sfx-menu-select': menuSelect,
  'sfx-dialogue-blip': dialogueBlip,
  'sfx-item-pickup': itemPickup,
  'sfx-coin-clink': coinClink,
  'sfx-door-open': doorOpen,
  'sfx-footstep-stone': footstepStone,
  'sfx-footstep-wood': footstepWood,
  'sfx-footstep-dirt': footstepDirt,
  // transition stings (new)
  'sfx-gate-creak': gateCreak,
  'sfx-waves-crash': wavesCrash,
  'sfx-crowd-murmur': crowdMurmur,
  'sfx-birds-tropical': birdsTropical,
  'sfx-wind-hilltop': windHilltop,
};

module.exports = { SFX, SR };
