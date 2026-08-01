/**
 * audio.cjs — deterministic DSP core for the Melaka audio generator.
 *
 * No Date.now(), no Math.random(): every stochastic element is driven by a
 * seeded PRNG so the whole asset set is byte-reproducible.
 *
 * Buffers are plain Float64Array in [-1, 1] (headroom allowed; limited at the
 * end). Mono unless stated. Everything is written to be composable:
 *
 *     const buf = new Float64Array(n)
 *     addInto(buf, voiceRender(...), startSample)
 */

'use strict';

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) + helpers
// ---------------------------------------------------------------------------

/** Hash an arbitrary string into a 32-bit seed (xmur3). */
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Seeded PRNG. `seed` may be a number or a string. */
function rng(seed) {
  let a = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(next() * arr.length))];
  next.chance = (p) => next() < p;
  /** Gaussian-ish via sum of 3 uniforms; stays bounded, no rejection loop. */
  next.norm = () => (next() + next() + next() - 1.5) * 1.1547;
  return next;
}

// ---------------------------------------------------------------------------
// Buffer utilities
// ---------------------------------------------------------------------------

const buffer = (n) => new Float64Array(n);

/** dst[start + i] += src[i] * gain, clipped to dst bounds (no wrap). */
function addInto(dst, src, start, gain = 1) {
  const s = Math.round(start);
  const n = Math.min(src.length, dst.length - s);
  if (s >= dst.length) return dst;
  const from = s < 0 ? -s : 0;
  for (let i = from; i < n; i++) dst[s + i] += src[i] * gain;
  return dst;
}

/**
 * dst[(start + i) % dst.length] += src[i] * gain.
 * Used for the loop-fold: a voice that runs past the loop point re-enters at
 * the top exactly as a looping player would render it.
 */
function addIntoWrapped(dst, src, start, gain = 1) {
  const L = dst.length;
  let p = ((Math.round(start) % L) + L) % L;
  for (let i = 0; i < src.length; i++) {
    dst[p] += src[i] * gain;
    if (++p === L) p = 0;
  }
  return dst;
}

/**
 * Fold a rendered tail back onto the head. Given a linear buffer of
 * length loopLen + tailLen containing material scheduled only within
 * [0, loopLen), returns a loopLen buffer whose wrap point is sample-exact:
 * the decay that spilled past the end is summed into the beginning, which is
 * precisely what a seamless looping player produces.
 */
function foldTail(buf, loopLen) {
  const out = buffer(loopLen);
  for (let i = 0; i < loopLen; i++) out[i] = buf[i];
  for (let i = loopLen; i < buf.length; i++) out[(i - loopLen) % loopLen] += buf[i];
  return out;
}

function peak(buf) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > m) m = a; }
  return m;
}

function rms(buf, from = 0, to = buf.length) {
  let s = 0;
  for (let i = from; i < to; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, to - from));
}

function normalize(buf, target = 0.9) {
  const p = peak(buf);
  if (p < 1e-9) return buf;
  const g = target / p;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

function gain(buf, g) {
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

/**
 * Soft-knee limiter: samples below `threshold` pass through untouched, above it
 * they are compressed asymptotically toward 1.0. Unlike softClip this does not
 * change the level of quiet material, so it can be applied after setting a
 * target RMS without undoing it.
 */
function limit(buf, threshold = 0.7) {
  const room = 1 - threshold;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const a = Math.abs(x);
    if (a > threshold) {
      buf[i] = Math.sign(x) * (threshold + room * Math.tanh((a - threshold) / room));
    }
  }
  return buf;
}

/** Scale a buffer so its RMS hits `target`. */
function normalizeRms(buf, target = 0.12) {
  const r = rms(buf);
  if (r > 1e-9) gain(buf, target / r);
  return buf;
}

/** Soft saturation — tames peaks without the crunch of hard clipping. */
function softClip(buf, drive = 1) {
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive) / Math.tanh(drive);
  return buf;
}

/**
 * Remove DC offset (noise beds with asymmetric events can accumulate it).
 * `loop` pre-rolls the filter state over the tail so sample 0 is already in
 * steady state — without it the wrap point clicks, which is exactly what the
 * seam analyser flags on bass-heavy beds.
 */
function dcBlock(buf, sr, loop = false) {
  const r = 1 - (2 * Math.PI * 8) / sr;
  let x1 = 0, y1 = 0;
  if (loop) {
    const pre = Math.min(buf.length, Math.round(sr * 0.5));
    for (let i = buf.length - pre; i < buf.length; i++) {
      const x = buf[i]; const y = x - x1 + r * y1; x1 = x; y1 = y;
    }
  }
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = x - x1 + r * y1;
    x1 = x; y1 = y; buf[i] = y;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

/** Exponential-ish percussive envelope value at time t (seconds). */
function percEnv(t, attack, decay) {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / Math.max(1e-5, decay));
}

/** ADSR value at time t for a note of length `dur` (seconds). */
function adsr(t, dur, a, d, s, r) {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 + (s - 1) * ((t - a) / d);
  if (t < dur) return s;
  const rt = t - dur;
  if (rt >= r) return 0;
  return s * (1 - rt / r);
}

/** Equal-power fade helpers, used on ambience event sprinkles. */
function fadeIn(buf, n) {
  const k = Math.min(n, buf.length);
  for (let i = 0; i < k; i++) buf[i] *= Math.sin((Math.PI / 2) * (i / k));
  return buf;
}
function fadeOut(buf, n) {
  const k = Math.min(n, buf.length);
  const L = buf.length;
  for (let i = 0; i < k; i++) buf[L - 1 - i] *= Math.sin((Math.PI / 2) * (i / k));
  return buf;
}

// ---------------------------------------------------------------------------
// Biquad filters (RBJ audio EQ cookbook)
// ---------------------------------------------------------------------------

function biquadCoeffs(type, sr, f0, Q, gainDb = 0) {
  const w0 = (2 * Math.PI * Math.min(f0, sr * 0.49)) / sr;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const alpha = sw / (2 * Q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lowpass':
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'highpass':
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'bandpass': // constant 0 dB peak gain
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'notch':
      b0 = 1; b1 = -2 * cw; b2 = 1;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'peaking':
      b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
    case 'lowshelf': {
      const s2 = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cw + s2);
      b1 = 2 * A * ((A - 1) - (A + 1) * cw);
      b2 = A * ((A + 1) - (A - 1) * cw - s2);
      a0 = (A + 1) + (A - 1) * cw + s2;
      a1 = -2 * ((A - 1) + (A + 1) * cw);
      a2 = (A + 1) + (A - 1) * cw - s2; break;
    }
    case 'highshelf': {
      const s2 = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cw + s2);
      b1 = -2 * A * ((A - 1) + (A + 1) * cw);
      b2 = A * ((A + 1) + (A - 1) * cw - s2);
      a0 = (A + 1) - (A - 1) * cw + s2;
      a1 = 2 * ((A - 1) - (A + 1) * cw);
      a2 = (A + 1) - (A - 1) * cw - s2; break;
    }
    default: throw new Error(`unknown biquad type ${type}`);
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

class Biquad {
  constructor(type, sr, f0, Q, gainDb = 0) {
    this.set(type, sr, f0, Q, gainDb);
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  set(type, sr, f0, Q, gainDb = 0) { Object.assign(this, biquadCoeffs(type, sr, f0, Q, gainDb)); }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
  run(buf) { for (let i = 0; i < buf.length; i++) buf[i] = this.process(buf[i]); return buf; }
}

/** One-shot filter over a buffer. `passes` cascades for a steeper slope. */
function filter(buf, type, sr, f0, Q = 0.707, gainDb = 0, passes = 1) {
  for (let p = 0; p < passes; p++) new Biquad(type, sr, f0, Q, gainDb).run(buf);
  return buf;
}

/**
 * Filter a *loop* buffer: pre-rolls the filter state over the tail of the
 * buffer so the filter is already in its steady state at sample 0. Without
 * this, every filtered ambience loop clicks at the wrap point.
 */
function filterLooped(buf, type, sr, f0, Q = 0.707, gainDb = 0, passes = 1) {
  const pre = Math.min(buf.length, Math.round(sr * 0.5));
  for (let p = 0; p < passes; p++) {
    const bq = new Biquad(type, sr, f0, Q, gainDb);
    for (let i = buf.length - pre; i < buf.length; i++) bq.process(buf[i]);
    for (let i = 0; i < buf.length; i++) buf[i] = bq.process(buf[i]);
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Noise sources
// ---------------------------------------------------------------------------

function whiteNoise(n, rand) {
  const b = buffer(n);
  for (let i = 0; i < n; i++) b[i] = rand.norm() * 0.5;
  return b;
}

/** Paul Kellet's economical pink-noise approximation. */
function pinkNoise(n, rand) {
  const b = buffer(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    b[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return b;
}

/** Brown/red noise — the bed under waves and wind. */
function brownNoise(n, rand) {
  const b = buffer(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (rand() * 2 - 1)) / 1.02;
    b[i] = last * 3.5;
  }
  return b;
}

/**
 * Seamless noise bed: generates `n + xf` samples then equal-power crossfades
 * the tail over the head, so the noise loops without a seam.
 */
function loopedNoise(kind, n, sr, rand, xfSec = 1.5) {
  const xf = Math.min(Math.round(sr * xfSec), Math.floor(n / 2));
  const gen = kind === 'pink' ? pinkNoise : kind === 'brown' ? brownNoise : whiteNoise;
  const raw = gen(n + xf, rand);
  const out = buffer(n);
  for (let i = 0; i < n; i++) out[i] = raw[i];
  for (let i = 0; i < xf; i++) {
    const t = i / xf;
    const a = Math.cos((Math.PI / 2) * t);   // head weight
    const b = Math.sin((Math.PI / 2) * t);   // tail weight
    out[i] = out[i] * b + raw[n + i] * a;
  }
  return out;
}

// ---------------------------------------------------------------------------
// LFO / modulation
// ---------------------------------------------------------------------------

/** Sine LFO sampled per-sample; phase in turns. Loop-safe if freq*len is int. */
function lfo(n, sr, freq, depth = 1, phase = 0, offset = 0) {
  const b = buffer(n);
  const w = (2 * Math.PI * freq) / sr;
  for (let i = 0; i < n; i++) b[i] = offset + depth * Math.sin(w * i + phase * 2 * Math.PI);
  return b;
}

/**
 * Smooth random control signal that loops seamlessly: a sum of sinusoids whose
 * frequencies are exact integer multiples of 1/loopLen.
 */
function loopedDrift(n, sr, rand, { partials = 5, lowHz = 0.03, highHz = 0.4 } = {}) {
  const b = buffer(n);
  const loopSec = n / sr;
  const used = new Set();
  for (let p = 0; p < partials; p++) {
    // quantise to an integer number of cycles per loop => perfectly periodic
    let k = Math.max(1, Math.round(rand.range(lowHz, highHz) * loopSec));
    while (used.has(k)) k++;
    used.add(k);
    const amp = 1 / (p + 1);
    const ph = rand() * 2 * Math.PI;
    const w = (2 * Math.PI * k) / n;
    for (let i = 0; i < n; i++) b[i] += amp * Math.sin(w * i + ph);
  }
  return normalize(b, 1);
}

// ---------------------------------------------------------------------------
// Delay / reverb
// ---------------------------------------------------------------------------

class Comb {
  constructor(sizeSamples, feedback, damp) {
    this.buf = new Float64Array(Math.max(1, Math.round(sizeSamples)));
    this.i = 0; this.fb = feedback; this.damp = damp; this.store = 0;
  }
  process(x) {
    const y = this.buf[this.i];
    this.store = y * (1 - this.damp) + this.store * this.damp;
    this.buf[this.i] = x + this.store * this.fb;
    if (++this.i >= this.buf.length) this.i = 0;
    return y;
  }
}

class Allpass {
  constructor(sizeSamples, feedback = 0.5) {
    this.buf = new Float64Array(Math.max(1, Math.round(sizeSamples)));
    this.i = 0; this.fb = feedback;
  }
  process(x) {
    const y = this.buf[this.i];
    const out = -x + y;
    this.buf[this.i] = x + y * this.fb;
    if (++this.i >= this.buf.length) this.i = 0;
    return out;
  }
}

/**
 * Freeverb-flavoured Schroeder reverb (mono in / mono out).
 * `size` scales the comb delays (0.5 = small room, 1.6 = stone church).
 */
function reverb(buf, sr, { size = 1, damp = 0.35, mix = 0.28, predelay = 0.012, loop = false } = {}) {
  const scale = (sr / 44100) * size;
  const combTunings = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apTunings = [556, 441, 341, 225];
  const fb = Math.min(0.94, 0.78 + 0.1 * size);
  const combs = combTunings.map((t) => new Comb(t * scale, fb, damp));
  const aps = apTunings.map((t) => new Allpass(t * scale, 0.5));
  const pd = Math.round(predelay * sr);
  const L = buf.length;
  const step = (i) => {
    // One-shot buffers must read silence before the predelay; only a loop may
    // legitimately wrap round to its own tail.
    const j = i - pd;
    const x = (j >= 0 ? buf[j] : (loop ? buf[((j % L) + L) % L] : 0)) * 0.12;
    let acc = 0;
    for (let c = 0; c < combs.length; c++) acc += combs[c].process(x);
    for (let a = 0; a < aps.length; a++) acc = aps[a].process(acc);
    return acc;
  };
  // Loop mode: the input is periodic, so run one discarded pass to let the
  // network converge to its periodic steady state. The kept pass then wraps
  // seamlessly (no truncated tail at the end, no empty room at sample 0).
  if (loop) for (let i = 0; i < L; i++) step(i);
  const wet = buffer(L);
  for (let i = 0; i < L; i++) wet[i] = step(i);
  for (let i = 0; i < L; i++) buf[i] = buf[i] * (1 - mix * 0.5) + wet[i] * mix * 3.2;
  return buf;
}

/** Simple feedback echo, handy for hilltop wind and church space. */
function echo(buf, sr, timeSec, feedback = 0.3, mix = 0.25) {
  const d = Math.round(timeSec * sr);
  const line = new Float64Array(d);
  let p = 0;
  for (let i = 0; i < buf.length; i++) {
    const y = line[p];
    line[p] = buf[i] + y * feedback;
    if (++p >= d) p = 0;
    buf[i] += y * mix;
  }
  return buf;
}

/** Static stereo widener: mid/side with a light side-only highpass. */
function widen(L, R, sr, amount = 0.35) {
  for (let i = 0; i < L.length; i++) {
    const m = (L[i] + R[i]) * 0.5;
    const s = (L[i] - R[i]) * 0.5 * (1 + amount * 2);
    L[i] = m + s; R[i] = m - s;
  }
  filter(L, 'highpass', sr, 22, 0.707);
  filter(R, 'highpass', sr, 22, 0.707);
  return [L, R];
}

// ---------------------------------------------------------------------------
// WAV output
// ---------------------------------------------------------------------------

/**
 * Write 16-bit PCM RIFF/WAVE. `channels` is an array of Float64Array of equal
 * length. Canonical 44-byte header, no extra chunks, no extensible format —
 * exactly what browsers' decodeAudioData expects.
 */
function writeWav(filePath, channels, sr) {
  const fs = require('fs');
  const path = require('path');
  const nch = channels.length;
  const frames = channels[0].length;
  const bytesPerSample = 2;
  const dataBytes = frames * nch * bytesPerSample;
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);              // PCM fmt chunk size
  buf.writeUInt16LE(1, 20);               // audioFormat = PCM
  buf.writeUInt16LE(nch, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * nch * bytesPerSample, 28); // byteRate
  buf.writeUInt16LE(nch * bytesPerSample, 32);      // blockAlign
  buf.writeUInt16LE(16, 34);              // bitsPerSample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);

  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nch; c++) {
      let v = channels[c][i];
      if (v > 1) v = 1; else if (v < -1) v = -1;
      // symmetric scaling; -32768 reserved so +1.0 and -1.0 map evenly
      buf.writeInt16LE(Math.round(v * 32767), o);
      o += 2;
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
  return { bytes: buf.length, frames, sr, channels: nch };
}

module.exports = {
  hashSeed, rng,
  buffer, addInto, addIntoWrapped, foldTail,
  peak, rms, normalize, normalizeRms, limit, gain, softClip, dcBlock,
  percEnv, adsr, fadeIn, fadeOut,
  Biquad, biquadCoeffs, filter, filterLooped,
  whiteNoise, pinkNoise, brownNoise, loopedNoise,
  lfo, loopedDrift,
  Comb, Allpass, reverb, echo, widen,
  writeWav,
};
