/**
 * ambient.cjs — the 16 looping ambience beds.
 *
 * Method: filtered/granular noise bed + deterministic event sprinkles.
 *
 * Seamlessness is structural, not cosmetic:
 *   - the noise bed comes from `loopedNoise` (tail crossfaded onto the head)
 *   - every slow modulation uses `loopedDrift`, whose partials are exact
 *     integer multiples of 1/loopLength, so it is perfectly periodic
 *   - event sprinkles are placed with `addIntoWrapped`, so an event near the
 *     end continues over the wrap instead of being cut off
 *   - filters are applied with `filterLooped` (pre-rolled state)
 * There is no fade-in/fade-out anywhere: a faded bed is an audibly pumping bed.
 *
 * 22.05 kHz mono, 16-bit. See MANIFEST notes for why: BootScene loads ambience
 * as `.wav` only, and 16 beds at 44.1 kHz would blow the asset budget on their
 * own. 11 kHz of bandwidth is ample for wind, water, crowd and insect beds.
 */

'use strict';

const A = require('./lib/audio.cjs');
const I = require('./lib/instruments.cjs');
const C = require('./lib/compose.cjs');

const SR = 22050;

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

/**
 * Sprinkle `count` events across the loop with jittered spacing. The callback
 * returns a buffer; it is wrapped into the loop so nothing is truncated.
 */
function sprinkle(dst, count, rand, make, { spread = 0.55, gainRange = [0.6, 1] } = {}) {
  const L = dst.length;
  for (let k = 0; k < count; k++) {
    const base = (k + 0.5) / count;
    const pos = base + rand.norm() * (spread / count);
    const start = Math.round(((pos % 1) + 1) % 1 * L);
    const buf = make(k, rand);
    if (!buf) continue;
    A.addIntoWrapped(dst, buf, start, rand.range(gainRange[0], gainRange[1]));
  }
  return dst;
}

/**
 * Final stage for every bed: DC-block (loop-aware), set a consistent loudness,
 * then soft-limit the sparse loud events.
 *
 * Peak-normalising alone is wrong here. A bed like jungle-sounds is mostly a
 * quiet floor punctuated by a few loud bird calls, so normalising its peak to
 * 0.74 left the actual ambience at ~0.04 RMS — inaudible once the game mixes it
 * at 0.34. Targeting RMS instead makes every bed sit at a comparable perceived
 * level, and the limiter keeps the transients from clipping.
 */
function polish(bed, sr, { rms = 0.13, peak = 0.88, threshold = 0.62 } = {}) {
  A.dcBlock(bed, sr, true);
  A.normalizeRms(bed, rms);
  A.limit(bed, threshold);
  const p = A.peak(bed);
  if (p > peak) A.gain(bed, peak / p);
  return bed;
}

/** Amplitude-modulate a bed by a seamless slow drift. */
function breathe(buf, sr, rand, { depth = 0.4, lowHz = 0.04, highHz = 0.22, partials = 4 } = {}) {
  const d = A.loopedDrift(buf.length, sr, rand, { partials, lowHz, highHz });
  for (let i = 0; i < buf.length; i++) buf[i] *= 1 + depth * d[i];
  return buf;
}

/** A short bandpassed noise burst — the atom of most natural sounds. */
function burst(n, sr, rand, { f, q = 2, attack = 0.005, decay = 0.08, amp = 1 }) {
  const b = A.whiteNoise(n, rand);
  A.filter(b, 'bandpass', sr, f, q);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    b[i] *= A.percEnv(t, attack, decay) * amp * 2.2;
  }
  return b;
}

// ---------------------------------------------------------------------------
// Voice generators shared by several beds
// ---------------------------------------------------------------------------

/** Tropical bird call: 2-5 frequency-swept whistles. */
function birdCall(sr, rand, { base = 2400, syllables = 3, bright = 1 } = {}) {
  const sylN = Math.round(sr * 0.075);
  const gapN = Math.round(sr * 0.045);
  const total = syllables * (sylN + gapN);
  const out = A.buffer(total);
  const dir = rand.chance(0.5) ? 1 : -1;
  for (let s = 0; s < syllables; s++) {
    const f0 = base * (1 + dir * 0.14 * s) * rand.range(0.92, 1.08);
    const f1 = f0 * rand.range(1.1, 1.55);
    let ph = 0;
    const off = s * (sylN + gapN);
    for (let i = 0; i < sylN; i++) {
      const t = i / sylN;
      const f = Math.min(sr * 0.45, f0 + (f1 - f0) * Math.sin(Math.PI * t));
      ph += (2 * Math.PI * f) / sr;
      const env = Math.sin(Math.PI * t) ** 1.4;
      out[off + i] += (Math.sin(ph) + 0.22 * bright * Math.sin(2 * ph)) * env * 0.5;
    }
  }
  A.filter(out, 'highpass', sr, 900, 0.7);
  return out;
}

/** Seagull cry: harsh, descending, with a rasp. */
function gullCry(sr, rand) {
  const n = Math.round(sr * rand.range(0.28, 0.45));
  const out = A.buffer(n);
  const f0 = rand.range(950, 1500);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f0 * (1.25 - 0.5 * t) * (1 + 0.06 * Math.sin(2 * Math.PI * 22 * i / sr));
    ph += (2 * Math.PI * f) / sr;
    const env = Math.min(1, t * 9) * Math.pow(1 - t, 1.5);
    // harsh: stacked odd harmonics + noise rasp
    out[i] = (Math.sin(ph) + 0.5 * Math.sin(3 * ph) + 0.3 * Math.sin(5 * ph)
      + rand.norm() * 0.18) * env * 0.45;
  }
  A.filter(out, 'bandpass', sr, f0 * 1.4, 0.8);
  return out;
}

/** Cicada / cricket: rapid amplitude-modulated narrowband buzz. */
function insectBuzz(sr, rand, { f = 4200, rate = 42, dur = 1.2, duty = 0.6, amp = 1 } = {}) {
  const n = Math.round(sr * dur);
  const out = A.whiteNoise(n, rand);
  A.filter(out, 'bandpass', sr, Math.min(f, sr * 0.44), 9);
  A.filter(out, 'bandpass', sr, Math.min(f, sr * 0.44), 9);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ph = (t * rate) % 1;
    const chirp = ph < duty ? Math.sin((Math.PI * ph) / duty) ** 0.6 : 0;
    const env = Math.min(1, t / 0.15) * Math.min(1, (dur - t) / 0.2);
    out[i] *= chirp * Math.max(0, env) * 3.2 * amp;
  }
  return out;
}

/**
 * Crowd walla: overlapping formant-filtered noise "syllables". Deliberately
 * unintelligible — the goal is the shape of many voices, not words.
 */
function wallaSyllable(sr, rand, { pitch = 150, dur = 0.22, female = false } = {}) {
  const n = Math.round(sr * dur);
  const out = A.buffer(n);
  const f0 = pitch * (female ? 1.7 : 1) * rand.range(0.85, 1.18);
  // vowel formant pairs (roughly a, e, i, o, u)
  const vowels = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870]];
  const [F1, F2] = rand.pick(vowels);
  const sc = female ? 1.15 : 1;
  const nH = Math.min(40, Math.floor(sr * 0.45 / f0));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const gl = f0 * (1 + 0.10 * Math.sin(Math.PI * t) - 0.06 * t);
    ph += (2 * Math.PI * gl) / sr;
    let s = 0;
    for (let h = 1; h <= nH; h++) s += Math.sin(ph * h) / (h * h * 0.55 + 1);
    out[i] = s * Math.sin(Math.PI * t) ** 0.8;
  }
  const a = Float64Array.from(out); A.filter(a, 'bandpass', sr, F1 * sc, 5);
  const b = Float64Array.from(out); A.filter(b, 'bandpass', sr, Math.min(F2 * sc, sr * 0.44), 6);
  for (let i = 0; i < n; i++) out[i] = a[i] * 1.0 + b[i] * 0.55 + out[i] * 0.12;
  A.filter(out, 'highpass', sr, 180, 0.7);
  return A.gain(out, 0.5);
}

// ---------------------------------------------------------------------------
// The beds
// ---------------------------------------------------------------------------

/** base-tropical — wind in palm fronds, distant jungle, occasional bird. */
function baseTropical(dur = 40) {
  const rand = A.rng('melaka:base-tropical:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 1300, 0.7);
  A.filterLooped(bed, 'highpass', SR, 90, 0.7);
  A.gain(bed, 0.55);
  breathe(bed, SR, rand, { depth: 0.5, lowHz: 0.03, highHz: 0.14 });

  // frond rustle: brighter noise, gated by its own slower drift
  const frond = A.loopedNoise('white', n, SR, rand, 1.5);
  A.filterLooped(frond, 'bandpass', SR, 3400, 0.6);
  A.filterLooped(frond, 'highpass', SR, 1800, 0.7);
  const g = A.loopedDrift(n, SR, rand, { partials: 6, lowHz: 0.08, highHz: 0.5 });
  for (let i = 0; i < n; i++) bed[i] += frond[i] * 0.16 * Math.max(0, 0.35 + 0.65 * g[i]);

  sprinkle(bed, 7, rand, () => A.gain(birdCall(SR, rand, {
    base: rand.range(1900, 3200), syllables: rand.int(2, 4),
  }), 0.13), { gainRange: [0.5, 1.0] });
  sprinkle(bed, 4, rand, () => A.gain(insectBuzz(SR, rand, {
    f: rand.range(3600, 5200), rate: rand.range(28, 46), dur: rand.range(1.5, 3.0),
  }), 0.045));

  A.dcBlock(bed, SR, true);
  return { key: 'base-tropical', seed: 'melaka:base-tropical:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** morning-birds — dawn chorus. */
function morningBirds(dur = 36) {
  const rand = A.rng('melaka:morning-birds:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 900, 0.7);
  A.gain(bed, 0.22);
  breathe(bed, SR, rand, { depth: 0.35 });

  // dense, layered calls — three "distances", quieter and duller further away
  const layers = [
    { count: 22, gain: 0.20, lp: 0 },
    { count: 16, gain: 0.10, lp: 3200 },
    { count: 12, gain: 0.05, lp: 1800 },
  ];
  for (const L of layers) {
    sprinkle(bed, L.count, rand, () => {
      const b = birdCall(SR, rand, { base: rand.range(1800, 4200), syllables: rand.int(2, 5) });
      if (L.lp) A.filter(b, 'lowpass', SR, L.lp, 0.7);
      return A.gain(b, L.gain);
    }, { spread: 0.85, gainRange: [0.5, 1.0] });
  }
  // a few low coos for depth
  sprinkle(bed, 5, rand, () => A.gain(birdCall(SR, rand, { base: rand.range(500, 750), syllables: 2, bright: 0.3 }), 0.10));
  A.dcBlock(bed, SR, true);
  return { key: 'morning-birds', seed: 'melaka:morning-birds:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** night-insects — rhythmic tropical night. */
function nightInsects(dur = 40) {
  const rand = A.rng('melaka:night-insects:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 700, 0.7);
  A.gain(bed, 0.18);

  // A continuous cicada wall built from long overlapping buzzes at fixed
  // pitches — the "wall" is what makes a tropical night read as tropical.
  for (const f of [3900, 4600, 5400, 6300]) {
    const layer = A.buffer(n);
    sprinkle(layer, Math.round(dur / 3), rand, () => insectBuzz(SR, rand, {
      f: f * rand.range(0.96, 1.04), rate: rand.range(34, 52), dur: rand.range(3.0, 5.0),
    }), { spread: 0.9 });
    breathe(layer, SR, rand, { depth: 0.45, lowHz: 0.05, highHz: 0.3 });
    for (let i = 0; i < n; i++) bed[i] += layer[i] * 0.085;
  }
  // slow pulsing chorus underneath
  const pulse = A.loopedNoise('white', n, SR, rand, 1.5);
  A.filterLooped(pulse, 'bandpass', SR, 2800, 6);
  const d = A.loopedDrift(n, SR, rand, { partials: 3, lowHz: 1.6, highHz: 3.4 });
  for (let i = 0; i < n; i++) bed[i] += pulse[i] * 0.10 * Math.max(0, d[i]);

  A.dcBlock(bed, SR, true);
  return { key: 'night-insects', seed: 'melaka:night-insects:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** cricket-chorus — denser, warmer, lower than the cicada wall. */
function cricketChorus(dur = 34) {
  const rand = A.rng('melaka:cricket-chorus:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('brown', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 400, 0.7);
  A.gain(bed, 0.14);

  for (let k = 0; k < 6; k++) {
    const f = 3000 + k * 420 + rand.range(-120, 120);
    const rate = 22 + k * 3.5;
    const layer = A.buffer(n);
    sprinkle(layer, Math.round(dur / 2.2), rand, () => insectBuzz(SR, rand, {
      f, rate: rate * rand.range(0.95, 1.05), dur: rand.range(1.6, 3.2), duty: 0.35,
    }), { spread: 0.95 });
    breathe(layer, SR, rand, { depth: 0.5, lowHz: 0.06, highHz: 0.4 });
    for (let i = 0; i < n; i++) bed[i] += layer[i] * 0.075;
  }
  A.dcBlock(bed, SR, true);
  return { key: 'cricket-chorus', seed: 'melaka:cricket-chorus:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** evening-calls — dusk handover: last birds over first insects. */
function eveningCalls(dur = 32) {
  const rand = A.rng('melaka:evening-calls:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 1000, 0.7);
  A.gain(bed, 0.30);
  breathe(bed, SR, rand, { depth: 0.4 });

  sprinkle(bed, 9, rand, () => A.gain(birdCall(SR, rand, {
    base: rand.range(1400, 2600), syllables: rand.int(2, 3), bright: 0.6,
  }), 0.14), { spread: 0.8 });
  for (let k = 0; k < 3; k++) {
    const layer = A.buffer(n);
    sprinkle(layer, Math.round(dur / 4), rand, () => insectBuzz(SR, rand, {
      f: 3400 + k * 700, rate: rand.range(26, 40), dur: rand.range(2.0, 3.5),
    }), { spread: 0.9 });
    breathe(layer, SR, rand, { depth: 0.55, lowHz: 0.04, highHz: 0.2 });
    for (let i = 0; i < n; i++) bed[i] += layer[i] * 0.055;
  }
  // distant frog croaks
  sprinkle(bed, 6, rand, () => {
    const len = Math.round(SR * 0.22);
    const b = A.buffer(len);
    const f = rand.range(180, 300);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const gate = ((t * 26) % 1) < 0.5 ? 1 : 0.15;
      b[i] = Math.sin(2 * Math.PI * f * t) * gate * A.percEnv(t, 0.01, 0.09) * 0.5;
    }
    A.filter(b, 'lowpass', SR, 1200, 1.4);
    return A.gain(b, 0.10);
  });
  A.dcBlock(bed, SR, true);
  return { key: 'evening-calls', seed: 'melaka:evening-calls:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** fortress-ambience — stone, wind through battlements, distant boots. */
function fortressAmbience(dur = 36) {
  const rand = A.rng('melaka:fortress-ambience:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('brown', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 520, 0.7);
  A.filterLooped(bed, 'highpass', SR, 55, 0.7);
  A.gain(bed, 0.6);
  breathe(bed, SR, rand, { depth: 0.55, lowHz: 0.03, highHz: 0.16 });

  // wind whistling round a stone corner: resonant noise with drifting pitch
  const whistle = A.loopedNoise('white', n, SR, rand, 1.5);
  const drift = A.loopedDrift(n, SR, rand, { partials: 4, lowHz: 0.05, highHz: 0.25 });
  const bq = new A.Biquad('bandpass', SR, 700, 9);
  for (let i = 0; i < n; i++) {
    if (i % 128 === 0) bq.set('bandpass', SR, 620 + drift[i] * 260, 9);
    whistle[i] = bq.process(whistle[i]);
  }
  for (let i = 0; i < n; i++) bed[i] += whistle[i] * 0.30 * Math.max(0, 0.3 + 0.7 * drift[i]);

  // distant boots on stone — pairs of steps, heavily filtered and reverbed
  sprinkle(bed, 5, rand, () => {
    const step = A.buffer(Math.round(SR * 0.9));
    for (let s = 0; s < 4; s++) {
      const b = burst(Math.round(SR * 0.12), SR, rand, { f: rand.range(900, 1500), q: 1.4, decay: 0.05 });
      A.addInto(step, b, Math.round(s * SR * 0.22), 0.6);
    }
    A.filter(step, 'lowpass', SR, 1600, 0.7);
    A.reverb(step, SR, { size: 1.6, mix: 0.5, damp: 0.3 });
    return A.gain(step, 0.075);
  });
  // a far-off gull or two over the walls
  sprinkle(bed, 2, rand, () => {
    const g = gullCry(SR, rand); A.filter(g, 'lowpass', SR, 2200, 0.7); return A.gain(g, 0.05);
  });
  A.dcBlock(bed, SR, true);
  return { key: 'fortress-ambience', seed: 'melaka:fortress-ambience:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** distant-city — muffled town below: crowd smear + far bells. */
function distantCity(dur = 36) {
  const rand = A.rng('melaka:distant-city:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 600, 0.7, 0, 2);
  A.gain(bed, 0.4);
  breathe(bed, SR, rand, { depth: 0.4, lowHz: 0.04, highHz: 0.18 });

  // heavily lowpassed walla — the sound of a town, not of words
  const walla = A.buffer(n);
  for (let k = 0; k < 90; k++) {
    const s = wallaSyllable(SR, rand, { pitch: rand.range(105, 200), dur: rand.range(0.16, 0.34), female: rand.chance(0.4) });
    A.addIntoWrapped(walla, s, Math.round(rand() * n), rand.range(0.3, 1));
  }
  A.filterLooped(walla, 'lowpass', SR, 700, 0.7, 0, 2);
  for (let i = 0; i < n; i++) bed[i] += walla[i] * 0.16;

  // far church bell, twice
  sprinkle(bed, 2, rand, () => {
    const b = I.churchBell(rand.range(300, 340), { sr: SR, amp: 0.5, decay: 5.0, rand });
    A.filter(b, 'lowpass', SR, 1400, 0.7);
    A.reverb(b, SR, { size: 1.8, mix: 0.5 });
    return A.gain(b, 0.075);
  }, { spread: 0.9 });
  A.dcBlock(bed, SR, true);
  return { key: 'distant-city', seed: 'melaka:distant-city:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** market-crowd — multicultural bargaining, close and busy. */
function marketCrowd(dur = 38) {
  const rand = A.rng('melaka:market-crowd:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'bandpass', SR, 700, 0.5);
  A.gain(bed, 0.22);

  // Three rings of voices: near (clear), mid, far (smeared into a hum).
  const rings = [
    { count: 130, gain: 0.24, lp: 0, pitch: [95, 210] },
    { count: 190, gain: 0.13, lp: 2200, pitch: [100, 230] },
    { count: 240, gain: 0.07, lp: 900, pitch: [90, 240] },
  ];
  for (const R of rings) {
    const layer = A.buffer(n);
    for (let k = 0; k < R.count; k++) {
      // syllables come in short bursts of 2-5: speech, not a random hiss
      const nSyl = rand.int(2, 5);
      const at = Math.round(rand() * n);
      let off = 0;
      for (let s = 0; s < nSyl; s++) {
        const syl = wallaSyllable(SR, rand, {
          pitch: rand.range(R.pitch[0], R.pitch[1]),
          dur: rand.range(0.13, 0.3), female: rand.chance(0.42),
        });
        A.addIntoWrapped(layer, syl, at + off, rand.range(0.55, 1));
        off += Math.round(syl.length * rand.range(0.75, 1.15));
      }
    }
    if (R.lp) A.filterLooped(layer, 'lowpass', SR, R.lp, 0.7);
    for (let i = 0; i < n; i++) bed[i] += layer[i] * R.gain;
  }
  // laughter + a few calls that cut through
  sprinkle(bed, 7, rand, () => {
    const len = Math.round(SR * rand.range(0.5, 0.9));
    const b = A.buffer(len);
    const p = rand.range(130, 260);
    for (let s = 0; s < 5; s++) {
      const syl = wallaSyllable(SR, rand, { pitch: p * (1 - s * 0.06), dur: 0.1, female: rand.chance(0.5) });
      A.addInto(b, syl, Math.round(s * SR * 0.115), 1 - s * 0.13);
    }
    return A.gain(b, 0.16);
  }, { spread: 0.9 });

  A.dcBlock(bed, SR, true);
  A.reverb(bed, SR, { size: 0.7, mix: 0.14, loop: true });
  return { key: 'market-crowd', seed: 'melaka:market-crowd:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** street-life — cart wheels, footfalls, coins, pottery. */
function streetLife(dur = 36) {
  const rand = A.rng('melaka:street-life:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('brown', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 300, 0.7);
  A.gain(bed, 0.25);
  breathe(bed, SR, rand, { depth: 0.35 });

  // cart wheels: a rolling rumble made of dense low clatter
  const cart = A.buffer(n);
  for (let k = 0; k < 3; k++) {
    const len = Math.round(SR * rand.range(3.5, 6));
    const c = A.buffer(len);
    const rate = rand.range(7, 12);
    for (let s = 0; s < Math.floor(len / SR * rate); s++) {
      const b = burst(Math.round(SR * 0.06), SR, rand, { f: rand.range(200, 700), q: 1.1, decay: 0.03 });
      A.addInto(c, b, Math.round((s / rate) * SR + rand.norm() * 0.01 * SR), rand.range(0.4, 1));
    }
    for (let i = 0; i < len; i++) c[i] *= Math.sin(Math.PI * (i / len)) ** 0.7;
    A.filter(c, 'lowpass', SR, 1100, 0.8);
    A.addIntoWrapped(cart, c, Math.round(rand() * n), 0.22);
  }
  for (let i = 0; i < n; i++) bed[i] += cart[i];

  // footfalls
  sprinkle(bed, 16, rand, () => {
    const b = burst(Math.round(SR * 0.11), SR, rand, { f: rand.range(700, 1400), q: 1.5, decay: 0.035 });
    A.filter(b, 'lowpass', SR, 2400, 0.7);
    return A.gain(b, 0.11);
  }, { spread: 0.9 });
  // pottery / coin clinks
  sprinkle(bed, 12, rand, () => {
    const len = Math.round(SR * 0.28);
    const b = A.buffer(len);
    const f = rand.range(1700, 3600);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      b[i] = (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2.41 * t)
        + 0.3 * Math.sin(2 * Math.PI * f * 3.77 * t)) * A.percEnv(t, 0.001, 0.05);
    }
    return A.gain(b, 0.07);
  }, { spread: 0.95 });

  A.dcBlock(bed, SR, true);
  A.reverb(bed, SR, { size: 0.9, mix: 0.16, loop: true });
  return { key: 'street-life', seed: 'melaka:street-life:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** church-bells — occasional tolls echoing over the hill. */
function churchBells(dur = 40) {
  const rand = A.rng('melaka:church-bells:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('brown', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 380, 0.7);
  A.gain(bed, 0.12);
  breathe(bed, SR, rand, { depth: 0.4 });

  // A slow peal: 3 strikes on the tonic, then a lower answering bell.
  const strikes = [
    { at: 0.04, f: 262, amp: 0.60, dec: 7.5 },
    { at: 0.13, f: 262, amp: 0.48, dec: 7.0 },
    { at: 0.22, f: 196, amp: 0.52, dec: 8.5 },
    { at: 0.52, f: 262, amp: 0.55, dec: 7.5 },
    { at: 0.61, f: 330, amp: 0.40, dec: 6.0 },
    { at: 0.70, f: 196, amp: 0.46, dec: 8.5 },
  ];
  for (const s of strikes) {
    const b = I.churchBell(s.f, { sr: SR, amp: s.amp, decay: s.dec, rand });
    A.reverb(b, SR, { size: 1.9, mix: 0.42, damp: 0.2 });
    A.addIntoWrapped(bed, b, Math.round(s.at * n), 0.5);
  }
  A.dcBlock(bed, SR, true);
  return { key: 'church-bells', seed: 'melaka:church-bells:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** sacred-calm — quiet stone room with distant Latin chant. */
function sacredCalm(dur = 40) {
  const rand = A.rng('melaka:sacred-calm:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('brown', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 280, 0.7);
  A.gain(bed, 0.16);
  breathe(bed, SR, rand, { depth: 0.3, lowHz: 0.02, highHz: 0.1 });

  // Distant chant: an aeolian cell sung on 'oo', drowned in a big room.
  const sc = C.scale('A3', 'aeolian');
  const chant = A.buffer(n);
  const cell = [0, 1, 2, 1, 0, -2, 0];
  const noteLen = (dur / (cell.length * 2)) * 0.9;
  for (let rep = 0; rep < 2; rep++) {
    for (let k = 0; k < cell.length; k++) {
      const idx = rep * cell.length + k;
      const v = I.choir(C.hz(sc.degree(cell[k] + (rep ? 2 : 0))), noteLen * 0.85, {
        sr: SR, rand, amp: 0.24, attack: 0.5, release: 0.8, voices: 2, spread: 9, vowel: 'oo',
      });
      A.addIntoWrapped(chant, v, Math.round(idx * noteLen * SR + n * 0.03));
    }
  }
  A.filterLooped(chant, 'lowpass', SR, 1500, 0.7);
  A.reverb(chant, SR, { size: 2.0, mix: 0.55, damp: 0.18 });
  for (let i = 0; i < n; i++) bed[i] += chant[i] * 0.30;

  // rare distant footstep in the nave
  sprinkle(bed, 3, rand, () => {
    const b = burst(Math.round(SR * 0.15), SR, rand, { f: rand.range(600, 1100), q: 1.3, decay: 0.05 });
    A.reverb(b, SR, { size: 2.0, mix: 0.6, damp: 0.2 });
    return A.gain(b, 0.06);
  });
  A.dcBlock(bed, SR, true);
  return { key: 'sacred-calm', seed: 'melaka:sacred-calm:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** water-lapping — waves against a wooden dock and stone quay. */
function waterLapping(dur = 38) {
  const rand = A.rng('melaka:water-lapping:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('brown', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 420, 0.7);
  A.gain(bed, 0.35);

  // Individual wave swells: filtered noise with a rise-and-hiss envelope, at a
  // slightly irregular period so it never sounds like a metronome.
  const waves = A.buffer(n);
  const period = 3.1;
  const count = Math.max(1, Math.round(dur / period));
  for (let k = 0; k < count; k++) {
    const len = Math.round(SR * rand.range(1.9, 2.9));
    const w = A.whiteNoise(len, rand);
    const bq = new A.Biquad('lowpass', SR, 400, 0.9);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      if (i % 64 === 0) bq.set('lowpass', SR, 320 + 2400 * Math.pow(t, 1.6), 0.9);
      w[i] = bq.process(w[i]);
    }
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // swell up, then a bright hiss as it breaks and drains
      const env = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 1.6);
      w[i] *= env * 1.8;
    }
    A.addIntoWrapped(waves, w, Math.round(((k / count) + rand.norm() * 0.08 / count) * n), rand.range(0.65, 1));
  }
  for (let i = 0; i < n; i++) bed[i] += waves[i] * 0.42;

  // hull knock / rope creak against the dock
  sprinkle(bed, 5, rand, () => {
    const len = Math.round(SR * 0.5);
    const b = A.buffer(len);
    const f = rand.range(70, 130);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      b[i] = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.7 * t))
        * A.percEnv(t, 0.004, 0.12);
    }
    A.filter(b, 'lowpass', SR, 900, 1.2);
    return A.gain(b, 0.11);
  });
  A.dcBlock(bed, SR, true);
  return { key: 'water-lapping', seed: 'melaka:water-lapping:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** harbor-activity — sailors, cargo, rope and timber. */
function harborActivity(dur = 36) {
  const rand = A.rng('melaka:harbor-activity:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 800, 0.7);
  A.gain(bed, 0.20);
  breathe(bed, SR, rand, { depth: 0.35 });

  // rope creaks: pitch-swept resonant noise (a stick-slip squeal)
  sprinkle(bed, 9, rand, () => {
    const len = Math.round(SR * rand.range(0.5, 1.1));
    const b = A.whiteNoise(len, rand);
    const f0 = rand.range(280, 620), f1 = f0 * rand.range(1.3, 2.2);
    const bq = new A.Biquad('bandpass', SR, f0, 14);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      if (i % 48 === 0) bq.set('bandpass', SR, f0 + (f1 - f0) * t, 14);
      b[i] = bq.process(b[i]) * Math.sin(Math.PI * t) ** 0.8;
    }
    return A.gain(b, 0.20);
  }, { spread: 0.9 });

  // timber groans
  sprinkle(bed, 6, rand, () => {
    const len = Math.round(SR * rand.range(0.6, 1.2));
    const b = A.buffer(len);
    const f = rand.range(55, 105);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const ph = 2 * Math.PI * f * (i / SR) * (1 + 0.1 * t);
      b[i] = (Math.sin(ph) + 0.5 * Math.sin(ph * 2.4) + 0.25 * Math.sin(ph * 4.1))
        * Math.sin(Math.PI * t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 9 * t));
    }
    A.filter(b, 'lowpass', SR, 700, 1.1);
    return A.gain(b, 0.13);
  });

  // cargo thumps + a few shouted syllables
  sprinkle(bed, 8, rand, () => {
    const b = burst(Math.round(SR * 0.25), SR, rand, { f: rand.range(120, 320), q: 0.9, decay: 0.07 });
    A.filter(b, 'lowpass', SR, 900, 0.8);
    return A.gain(b, 0.14);
  }, { spread: 0.95 });
  sprinkle(bed, 5, rand, () => {
    const s = wallaSyllable(SR, rand, { pitch: rand.range(110, 180), dur: 0.3 });
    return A.gain(s, 0.11);
  });
  A.dcBlock(bed, SR, true);
  A.reverb(bed, SR, { size: 1.1, mix: 0.18, loop: true });
  return { key: 'harbor-activity', seed: 'melaka:harbor-activity:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** seagulls — circling the harbour. */
function seagulls(dur = 32) {
  const rand = A.rng('melaka:seagulls:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'bandpass', SR, 900, 0.4);
  A.gain(bed, 0.08);

  // near gulls call in bursts of 3-5 cries; far gulls are single and dull
  sprinkle(bed, 7, rand, () => {
    const nCry = rand.int(3, 5);
    const out = A.buffer(Math.round(SR * (nCry * 0.42 + 0.5)));
    for (let c = 0; c < nCry; c++) {
      A.addInto(out, gullCry(SR, rand), Math.round(c * SR * rand.range(0.32, 0.5)), 1 - c * 0.11);
    }
    return A.gain(out, 0.30);
  }, { spread: 0.85 });
  sprinkle(bed, 9, rand, () => {
    const g = gullCry(SR, rand);
    A.filter(g, 'lowpass', SR, 2000, 0.7);
    A.reverb(g, SR, { size: 1.4, mix: 0.35 });
    return A.gain(g, 0.10);
  }, { spread: 0.95 });
  A.dcBlock(bed, SR, true);
  return { key: 'seagulls', seed: 'melaka:seagulls:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** village-life — kampung: children, chickens, domestic work. */
function villageLife(dur = 36) {
  const rand = A.rng('melaka:village-life:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 900, 0.7);
  A.gain(bed, 0.18);
  breathe(bed, SR, rand, { depth: 0.35 });

  // children at play — high, short, bursty syllables
  sprinkle(bed, 10, rand, () => {
    const nSyl = rand.int(2, 4);
    const out = A.buffer(Math.round(SR * (nSyl * 0.24 + 0.3)));
    for (let s = 0; s < nSyl; s++) {
      const syl = wallaSyllable(SR, rand, { pitch: rand.range(240, 380), dur: rand.range(0.14, 0.26), female: true });
      A.addInto(out, syl, Math.round(s * SR * rand.range(0.16, 0.28)), rand.range(0.6, 1));
    }
    return A.gain(out, 0.15);
  }, { spread: 0.9 });

  // adult conversation, further off
  sprinkle(bed, 8, rand, () => {
    const out = A.buffer(Math.round(SR * 0.9));
    for (let s = 0; s < 4; s++) {
      A.addInto(out, wallaSyllable(SR, rand, { pitch: rand.range(100, 190), dur: 0.2, female: rand.chance(0.5) }),
        Math.round(s * SR * 0.21), 0.8);
    }
    A.filter(out, 'lowpass', SR, 1600, 0.7);
    return A.gain(out, 0.09);
  });

  // chickens
  sprinkle(bed, 7, rand, () => {
    const len = Math.round(SR * 0.35);
    const b = A.buffer(len);
    const f = rand.range(420, 700);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const cluck = ((t * 11) % 1) < 0.3 ? 1 : 0.08;
      b[i] = Math.sin(2 * Math.PI * f * (i / SR) * (1 + 0.2 * t)) * cluck * Math.pow(1 - t, 1.2);
    }
    A.filter(b, 'bandpass', SR, 900, 1.1);
    return A.gain(b, 0.10);
  });

  // pestle/mortar and cloth work — soft rhythmic thumps
  sprinkle(bed, 4, rand, () => {
    const out = A.buffer(Math.round(SR * 2.2));
    const rate = rand.range(1.6, 2.4);
    for (let s = 0; s < 5; s++) {
      const b = burst(Math.round(SR * 0.14), SR, rand, { f: rand.range(180, 380), q: 1.0, decay: 0.05 });
      A.addInto(out, b, Math.round((s / rate) * SR), 0.8);
    }
    A.filter(out, 'lowpass', SR, 1200, 0.8);
    return A.gain(out, 0.11);
  });
  A.dcBlock(bed, SR, true);
  return { key: 'village-life', seed: 'melaka:village-life:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

/** jungle-sounds — the green edge: rustle, birds, distant monkeys. */
function jungleSounds(dur = 36) {
  const rand = A.rng('melaka:jungle-sounds:v1');
  const n = Math.round(dur * SR);
  const bed = A.loopedNoise('pink', n, SR, rand, 2.0);
  A.filterLooped(bed, 'lowpass', SR, 2000, 0.7);
  A.filterLooped(bed, 'highpass', SR, 140, 0.7);
  A.gain(bed, 0.30);
  breathe(bed, SR, rand, { depth: 0.5, lowHz: 0.05, highHz: 0.3 });

  // leaf rustle bursts
  sprinkle(bed, 14, rand, () => {
    const len = Math.round(SR * rand.range(0.25, 0.7));
    const b = A.whiteNoise(len, rand);
    A.filter(b, 'bandpass', SR, rand.range(2600, 5200), 0.7);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      b[i] *= Math.sin(Math.PI * t) ** 1.4 * (0.6 + 0.4 * Math.sin(2 * Math.PI * rand.range(8, 20) * t));
    }
    return A.gain(b, 0.12);
  }, { spread: 0.95 });

  sprinkle(bed, 10, rand, () => A.gain(birdCall(SR, rand, {
    base: rand.range(1600, 3800), syllables: rand.int(2, 5),
  }), 0.16), { spread: 0.9 });

  // distant monkey whoops
  sprinkle(bed, 4, rand, () => {
    const len = Math.round(SR * 0.55);
    const b = A.buffer(len);
    const f0 = rand.range(320, 520);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const f = f0 * (1 + 0.7 * Math.sin(Math.PI * t) ** 2);
      ph += (2 * Math.PI * f) / SR;
      b[i] = (Math.sin(ph) + 0.35 * Math.sin(2 * ph)) * Math.sin(Math.PI * t) ** 0.9;
    }
    A.filter(b, 'lowpass', SR, 2200, 0.8);
    A.reverb(b, SR, { size: 1.5, mix: 0.4 });
    return A.gain(b, 0.10);
  });
  // cicada layer
  for (let k = 0; k < 2; k++) {
    const layer = A.buffer(n);
    sprinkle(layer, Math.round(dur / 5), rand, () => insectBuzz(SR, rand, {
      f: 4200 + k * 900, rate: rand.range(30, 48), dur: rand.range(2.5, 4.5),
    }), { spread: 0.9 });
    breathe(layer, SR, rand, { depth: 0.5 });
    for (let i = 0; i < n; i++) bed[i] += layer[i] * 0.06;
  }
  A.dcBlock(bed, SR, true);
  return { key: 'jungle-sounds', seed: 'melaka:jungle-sounds:v1', dur, channels: [polish(bed, SR)], sr: SR };
}

const BEDS = {
  'base-tropical': baseTropical,
  'morning-birds': morningBirds,
  'night-insects': nightInsects,
  'cricket-chorus': cricketChorus,
  'evening-calls': eveningCalls,
  'fortress-ambience': fortressAmbience,
  'distant-city': distantCity,
  'market-crowd': marketCrowd,
  'street-life': streetLife,
  'church-bells': churchBells,
  'sacred-calm': sacredCalm,
  'water-lapping': waterLapping,
  'harbor-activity': harborActivity,
  'seagulls': seagulls,
  'village-life': villageLife,
  'jungle-sounds': jungleSounds,
};

module.exports = { BEDS, SR, wallaSyllable, birdCall, gullCry, insectBuzz, burst, sprinkle, breathe };
