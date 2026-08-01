/**
 * instruments.cjs — the Melaka orchestra.
 *
 * Every voice is a pure function `(freq, dur, opts) -> Float64Array` rendering
 * one note (including its natural decay tail). Callers schedule them into a
 * mix buffer; the loop-fold in compose.cjs handles notes that spill past the
 * loop point.
 *
 * Palette, per docs/AUDIO_DIRECTION.md:
 *   Portuguese  — vihuela/lute (plucked gut), viola da gamba (bowed drone),
 *                 chapel choir/organum pad, church bell, martial reed-brass
 *   Malay       — saron/gender metallophone, bonang kettle-gongs, gong ageng,
 *                 rebana & kompang frame drums, suling bamboo flute, rebab
 *   Chinese     — pipa (bright pluck), erhu (thin bowed lead)
 */

'use strict';

const A = require('./audio.cjs');

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Karplus-Strong plucked string — vihuela / lute / pipa
// ---------------------------------------------------------------------------

/**
 * @param {number} freq  Hz
 * @param {number} dur   seconds of *scheduled* length; the render is longer to
 *                       let the string ring out naturally.
 */
function pluck(freq, dur, {
  sr = 44100, rand, damping = 0.5, brightness = 0.5, pickPos = 0.24,
  amp = 0.5, release = 1.1, body = 1,
} = {}) {
  const N = Math.max(2, Math.round(sr / freq));
  const total = Math.round((dur + release) * sr);
  const out = A.buffer(total);
  const line = new Float64Array(N);

  // Excitation: noise burst shaped by "brightness" (a one-pole lowpass on the
  // initial state) and a comb notch modelling the plucking position.
  let lp = 0;
  const a = Math.pow(brightness, 0.35);
  for (let i = 0; i < N; i++) {
    const w = rand ? rand.norm() : Math.sin(i * 12.9898) * 43758.5453 % 1;
    lp = lp * (1 - a) + w * a;
    line[i] = lp;
  }
  const pk = Math.max(1, Math.round(N * pickPos));
  for (let i = N - 1; i >= pk; i--) line[i] -= line[i - pk] * 0.62;
  // Kill DC so the string does not start with an offset thump.
  let mean = 0; for (let i = 0; i < N; i++) mean += line[i];
  mean /= N; for (let i = 0; i < N; i++) line[i] -= mean;

  // Loop filter: 2-point average (string damping) + adjustable loss.
  const loss = 1 - 0.0009 - damping * 0.004 - Math.min(0.02, freq / 60000);
  let p = 0, prev = 0;
  for (let i = 0; i < total; i++) {
    const cur = line[p];
    const filtered = (cur + prev) * 0.5;
    prev = cur;
    line[p] = filtered * loss;
    out[i] = cur;
    if (++p >= N) p = 0;
  }

  // Instrument body: a couple of resonances + gentle top roll-off.
  if (body > 0) {
    A.filter(out, 'peaking', sr, 118 * body, 1.1, 4.5);
    A.filter(out, 'peaking', sr, 415 * body, 0.9, 3.0);
    A.filter(out, 'lowpass', sr, 5200, 0.7);
    A.filter(out, 'highpass', sr, freq * 0.7, 0.6);
  }
  // Master release so the note truly ends inside its render window.
  const relStart = Math.round(dur * sr);
  for (let i = relStart; i < total; i++) {
    const t = (i - relStart) / (total - relStart);
    out[i] *= Math.pow(1 - t, 2.2);
  }
  return A.gain(out, amp);
}

// ---------------------------------------------------------------------------
// Bar/kettle metallophones — saron, gender, bonang
// ---------------------------------------------------------------------------

/**
 * Struck-metal voice: inharmonic partials, fast attack, per-partial decay.
 * `ombak` adds the paired-tuning beating characteristic of a real gamelan set.
 */
function metallophone(freq, dur, {
  sr = 44100, amp = 0.4, decay = 1.5, ombak = 2.4, partials = null,
  strike = 0.004, tail = 1.4, damp = 1,
} = {}) {
  // saron/gender bar modes: strongly inharmonic upper partials
  const P = partials || [
    [1.00, 1.00, 1.00],
    [2.68, 0.42, 0.55],
    [4.94, 0.20, 0.32],
    [7.83, 0.10, 0.20],
    [10.9, 0.05, 0.13],
  ];
  const total = Math.round((dur + tail) * sr);
  const out = A.buffer(total);
  const beat = TAU * ombak / sr;
  for (const [ratio, pAmp, pDecayScale] of P) {
    const f = freq * ratio;
    if (f > sr * 0.47) continue;
    const w = TAU * f / sr;
    const dk = 1 / Math.max(0.02, decay * pDecayScale * damp);
    // Two slightly detuned copies => slow amplitude "ombak" beating.
    for (let i = 0; i < total; i++) {
      const t = i / sr;
      const env = t < strike ? t / strike : Math.exp(-(t - strike) * dk);
      if (env < 1e-5 && t > strike) break;
      const bmod = 0.5 + 0.5 * Math.cos(beat * i * ratio * 0.5);
      out[i] += Math.sin(w * i) * env * pAmp * (0.72 + 0.28 * bmod);
    }
  }
  // Mallet contact click
  const clickN = Math.round(0.006 * sr);
  for (let i = 0; i < clickN; i++) {
    out[i] += Math.sin(TAU * freq * 6.1 * i / sr) * Math.exp(-i / (clickN * 0.3)) * 0.10;
  }
  A.filter(out, 'highpass', sr, freq * 0.6, 0.7);
  A.filter(out, 'lowpass', sr, 9000, 0.7);
  // Guarantee silence at the end of the render window.
  const relStart = Math.round((dur + tail * 0.55) * sr);
  for (let i = relStart; i < total; i++) {
    const t = (i - relStart) / (total - relStart);
    out[i] *= Math.pow(1 - t, 2);
  }
  return A.gain(out, amp);
}

/** Bonang — kettle gongs: more nearly harmonic, longer sustain, rounder. */
function bonang(freq, dur, opts = {}) {
  return metallophone(freq, dur, Object.assign({
    decay: 2.4, ombak: 1.8, tail: 2.0,
    partials: [
      [1.00, 1.00, 1.00],
      [2.01, 0.34, 0.70],
      [3.02, 0.18, 0.45],
      [4.12, 0.09, 0.30],
      [5.60, 0.04, 0.20],
    ],
  }, opts));
}

/** Gong ageng — the great hanging gong that punctuates a gongan cycle. */
function gong(freq, {
  sr = 44100, amp = 0.5, decay = 6.5, rand,
} = {}) {
  const total = Math.round((decay * 1.35) * sr);
  const out = A.buffer(total);
  const P = [
    [1.00, 1.00, 1.00], [1.48, 0.55, 0.85], [2.21, 0.40, 0.60],
    [3.05, 0.26, 0.45], [4.34, 0.16, 0.32], [5.71, 0.10, 0.24],
    [7.30, 0.06, 0.18],
  ];
  for (const [ratio, pAmp, pDec] of P) {
    const f = freq * ratio;
    if (f > sr * 0.47) continue;
    const w = TAU * f / sr;
    const beat = TAU * (0.9 + ratio * 0.35) / sr;
    const dk = 1 / (decay * pDec);
    // A gong "blooms": upper partials swell in after the strike.
    const bloom = ratio > 1.2 ? 0.35 + ratio * 0.06 : 0.02;
    for (let i = 0; i < total; i++) {
      const t = i / sr;
      const swell = 1 - Math.exp(-t / bloom);
      const env = swell * Math.exp(-t * dk);
      if (env < 1e-5 && t > bloom * 2) break;
      out[i] += Math.sin(w * i + Math.sin(beat * i) * 0.6) * env * pAmp;
    }
  }
  // Strike transient
  const nN = Math.round(0.05 * sr);
  const n = A.whiteNoise(nN, rand || A.rng('gong'));
  A.filter(n, 'bandpass', sr, freq * 3.2, 1.2);
  for (let i = 0; i < nN; i++) out[i] += n[i] * Math.exp(-i / (nN * 0.18)) * 0.35;
  A.filter(out, 'lowpass', sr, 6500, 0.7);
  const rel = Math.round(decay * 1.05 * sr);
  for (let i = rel; i < total; i++) {
    const t = (i - rel) / (total - rel);
    out[i] *= Math.pow(1 - t, 2);
  }
  return A.gain(out, amp);
}

/** Portuguese church bell — hum / prime / tierce / quint / nominal. */
function churchBell(freq, {
  sr = 44100, amp = 0.5, decay = 7.0, rand,
} = {}) {
  const total = Math.round(decay * 1.4 * sr);
  const out = A.buffer(total);
  const P = [
    [0.50, 0.60, 1.30], // hum
    [1.00, 1.00, 1.00], // prime
    [1.19, 0.62, 0.85], // minor tierce
    [1.50, 0.48, 0.70], // quint
    [2.00, 0.75, 0.55], // nominal
    [2.53, 0.28, 0.38],
    [3.00, 0.20, 0.30],
    [4.10, 0.12, 0.20],
    [5.42, 0.07, 0.14],
  ];
  for (const [ratio, pAmp, pDec] of P) {
    const f = freq * ratio;
    if (f > sr * 0.47) continue;
    const w = TAU * f / sr;
    const dk = 1 / (decay * pDec);
    const beat = TAU * (0.7 + ratio * 0.9) / sr;
    for (let i = 0; i < total; i++) {
      const t = i / sr;
      const env = Math.exp(-t * dk) * (0.8 + 0.2 * Math.cos(beat * i));
      if (env < 1e-5) break;
      out[i] += Math.sin(w * i) * env * pAmp;
    }
  }
  const nN = Math.round(0.04 * sr);
  const n = A.whiteNoise(nN, rand || A.rng('bell'));
  A.filter(n, 'bandpass', sr, freq * 5, 1.4);
  for (let i = 0; i < nN; i++) out[i] += n[i] * Math.exp(-i / (nN * 0.15)) * 0.28;
  const rel = Math.round(decay * 1.1 * sr);
  for (let i = rel; i < total; i++) out[i] *= Math.pow(1 - (i - rel) / (total - rel), 2);
  return A.gain(out, amp);
}

// ---------------------------------------------------------------------------
// Bowed & blown sustained voices
// ---------------------------------------------------------------------------

/** Band-limited sawtooth sample (additive, so it never aliases). */
function sawSample(phase, freq, sr) {
  const nH = Math.max(1, Math.floor(sr * 0.45 / freq));
  let s = 0;
  for (let h = 1; h <= nH; h++) s += Math.sin(phase * h) / h;
  return s * (2 / Math.PI);
}

/**
 * Bowed string — viola da gamba (low, `bright:0.3`), rebab / erhu (`bright:0.8`).
 * Slow attack, vibrato that fades in, formant-ish resonances.
 */
function bowed(freq, dur, {
  sr = 44100, amp = 0.28, attack = 0.09, release = 0.22, bright = 0.5,
  vibRate = 5.1, vibDepth = 0.006, rand, drift = 0.0025,
} = {}) {
  const total = Math.round((dur + release + 0.05) * sr);
  const out = A.buffer(total);
  const nH = Math.max(1, Math.min(48, Math.floor(sr * 0.45 / freq)));
  // Harmonic weights: brighter => slower rolloff. Odd harmonics slightly up
  // for a reedy, nasal rebab/erhu colour.
  const weights = [];
  const rolloff = 1.35 - bright * 0.55;
  for (let h = 1; h <= nH; h++) {
    const odd = h % 2 === 1 ? 1.12 : 0.86;
    weights.push(odd / Math.pow(h, rolloff));
  }
  let phase = 0;
  const dr = rand || A.rng('bow');
  const driftPhase = dr() * TAU;
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const env = A.adsr(t, dur, attack, attack * 1.6, 0.86, release);
    if (env <= 0 && t > dur) break;
    const vibIn = Math.min(1, Math.max(0, (t - attack * 1.2) / 0.4));
    const vib = 1 + Math.sin(TAU * vibRate * t) * vibDepth * vibIn
      + Math.sin(TAU * 0.37 * t + driftPhase) * drift;
    phase += TAU * freq * vib / sr;
    let s = 0;
    for (let h = 1; h <= nH; h++) s += Math.sin(phase * h) * weights[h - 1];
    // bow noise
    out[i] = (s * 0.55 + dr.norm() * 0.012 * (0.4 + bright)) * env;
  }
  A.filter(out, 'peaking', sr, 300 + bright * 500, 1.0, 3.5);
  A.filter(out, 'peaking', sr, 1150 + bright * 900, 0.8, 2.5);
  A.filter(out, 'lowpass', sr, 1400 + bright * 5200, 0.8);
  A.filter(out, 'highpass', sr, freq * 0.55, 0.7);
  return A.gain(out, amp);
}

/** Suling — bamboo flute: near-sine with breath chiff and air noise. */
function flute(freq, dur, {
  sr = 44100, amp = 0.3, attack = 0.055, release = 0.14, breath = 0.05, rand,
} = {}) {
  const total = Math.round((dur + release + 0.05) * sr);
  const out = A.buffer(total);
  const dr = rand || A.rng('flute');
  const ph0 = dr() * TAU;
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const env = A.adsr(t, dur, attack, 0.12, 0.88, release);
    if (env <= 0 && t > dur) break;
    const vib = 1 + Math.sin(TAU * 4.6 * t + ph0) * 0.0045 * Math.min(1, t / 0.35);
    const w = TAU * freq * vib * t;
    out[i] = (Math.sin(w) + 0.20 * Math.sin(2 * w) + 0.07 * Math.sin(3 * w)) * env * 0.6;
  }
  // breath: bandpassed noise tracking the note
  const nb = A.whiteNoise(total, dr);
  A.filter(nb, 'bandpass', sr, freq * 2.1, 0.8);
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const env = A.adsr(t, dur, attack * 0.5, 0.1, 0.75, release);
    const chiff = Math.exp(-t / 0.045) * 1.8;
    out[i] += nb[i] * env * breath * (1 + chiff);
  }
  A.filter(out, 'lowpass', sr, 6000, 0.7);
  return A.gain(out, amp);
}

/**
 * Choir / organum pad — stacked detuned saws through vowel formants.
 * The backbone of the St Paul's cue.
 */
function choir(freq, dur, {
  sr = 44100, amp = 0.16, attack = 0.5, release = 0.9, voices = 3, spread = 7,
  vowel = 'ah', rand,
} = {}) {
  const total = Math.round((dur + release + 0.1) * sr);
  const out = A.buffer(total);
  const dr = rand || A.rng('choir');
  const F = vowel === 'oo' ? [[380, 1.0], [820, 0.4], [2500, 0.12]]
    : vowel === 'eh' ? [[560, 1.0], [1700, 0.55], [2600, 0.22]]
      : [[730, 1.0], [1150, 0.6], [2600, 0.22]]; // 'ah'
  for (let v = 0; v < voices; v++) {
    const det = Math.pow(2, ((v - (voices - 1) / 2) * spread + dr.norm() * 2) / 1200);
    const f = freq * det;
    const nH = Math.max(1, Math.min(40, Math.floor(sr * 0.45 / f)));
    const ph0 = dr() * TAU;
    const wob = 0.15 + dr() * 0.25;
    for (let i = 0; i < total; i++) {
      const t = i / sr;
      const env = A.adsr(t, dur, attack, 0.35, 0.85, release);
      if (env <= 0 && t > dur) break;
      const vibr = 1 + Math.sin(TAU * (4.2 + v * 0.4) * t + ph0) * 0.0035 * Math.min(1, t / attack);
      const ph = TAU * f * vibr * t + ph0;
      let s = 0;
      for (let h = 1; h <= nH; h++) s += Math.sin(ph * h) / h;
      out[i] += s * env * (1 + Math.sin(TAU * wob * t) * 0.08) / voices;
    }
  }
  // formant shaping
  const dry = Float64Array.from(out);
  out.fill(0);
  for (const [ff, fa] of F) {
    const band = Float64Array.from(dry);
    A.filter(band, 'bandpass', sr, ff, 3.5);
    for (let i = 0; i < total; i++) out[i] += band[i] * fa;
  }
  for (let i = 0; i < total; i++) out[i] += dry[i] * 0.18;
  A.filter(out, 'lowpass', sr, 4200, 0.7);
  A.filter(out, 'highpass', sr, freq * 0.6, 0.7);
  return A.gain(out, amp * 1.4);
}

/**
 * Reed-brass — the martial colour for A Famosa. A pulse wave with PWM through
 * a resonant lowpass that opens with the envelope, plus a touch of drive.
 */
function reedBrass(freq, dur, {
  sr = 44100, amp = 0.22, attack = 0.035, release = 0.14, cutoff = 2400, rand,
} = {}) {
  const total = Math.round((dur + release + 0.05) * sr);
  const raw = A.buffer(total);
  const dr = rand || A.rng('brass');
  const nH = Math.max(1, Math.min(40, Math.floor(sr * 0.45 / freq)));
  const ph0 = dr() * TAU;
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const env = A.adsr(t, dur, attack, 0.09, 0.82, release);
    if (env <= 0 && t > dur) break;
    const pw = 0.42 + 0.1 * Math.sin(TAU * 0.6 * t + ph0);
    const ph = TAU * freq * t + ph0;
    // pulse = saw(ph) - saw(ph + 2*pi*pw), built additively (no aliasing)
    let s = 0;
    for (let h = 1; h <= nH; h++) {
      s += (Math.sin(ph * h) - Math.sin((ph + TAU * pw) * h)) / h;
    }
    raw[i] = s * 0.4 * env;
  }
  // envelope-tracked lowpass: brass "opens up" as it is pushed
  const bq = new A.Biquad('lowpass', sr, cutoff, 1.6);
  const out = A.buffer(total);
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const e = A.adsr(t, dur, attack, 0.09, 0.82, release);
    if (i % 64 === 0) bq.set('lowpass', sr, Math.max(220, cutoff * (0.35 + 0.85 * e)), 1.6);
    out[i] = bq.process(raw[i]);
  }
  A.softClip(out, 1.6);
  A.filter(out, 'peaking', sr, 1000, 1.0, 3);
  A.filter(out, 'highpass', sr, freq * 0.7, 0.7);
  return A.gain(out, amp);
}

// ---------------------------------------------------------------------------
// Percussion — rebana / kompang frame drums, kendang
// ---------------------------------------------------------------------------

/** Low open stroke ("dum"): pitch-dropping membrane + body thump. */
function drumLow(dur, { sr = 44100, amp = 0.42, freq = 88, decay = 0.34, rand } = {}) {
  const total = Math.round((decay * 2.2 + 0.05) * sr);
  const out = A.buffer(total);
  const dr = rand || A.rng('drum');
  let ph = 0;
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const env = Math.exp(-t / decay);
    if (env < 1e-4) break;
    const f = freq * (1 + 0.75 * Math.exp(-t / 0.035));
    ph += TAU * f / sr;
    out[i] = (Math.sin(ph) + 0.28 * Math.sin(ph * 1.59) + 0.12 * Math.sin(ph * 2.14)) * env;
  }
  const nN = Math.round(0.03 * sr);
  const n = A.whiteNoise(nN, dr);
  A.filter(n, 'lowpass', sr, 900, 0.8);
  for (let i = 0; i < nN; i++) out[i] += n[i] * Math.exp(-i / (nN * 0.22)) * 0.5;
  A.filter(out, 'lowpass', sr, 2600, 0.7);
  A.filter(out, 'highpass', sr, 42, 0.7);
  return A.gain(out, amp);
}

/** Rim/slap stroke ("tak"): short bandpassed crack. */
function drumHigh(dur, { sr = 44100, amp = 0.3, freq = 1750, decay = 0.055, rand } = {}) {
  const total = Math.round((decay * 4 + 0.02) * sr);
  const dr = rand || A.rng('tak');
  const out = A.whiteNoise(total, dr);
  A.filter(out, 'bandpass', sr, freq, 1.1);
  A.filter(out, 'highpass', sr, 380, 0.7);
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    out[i] = out[i] * Math.exp(-t / decay) * 1.9
      + Math.sin(TAU * freq * 0.42 * t) * Math.exp(-t / (decay * 0.5)) * 0.22;
  }
  return A.gain(out, amp);
}

/** Small hand-shaker / kemanak tick — keeps busy cues moving. */
function shaker(dur, { sr = 44100, amp = 0.14, decay = 0.04, tone = 6200, rand } = {}) {
  const total = Math.round((decay * 5 + 0.01) * sr);
  const dr = rand || A.rng('shk');
  const out = A.whiteNoise(total, dr);
  A.filter(out, 'bandpass', sr, tone, 0.9);
  A.filter(out, 'highpass', sr, 2500, 0.7);
  for (let i = 0; i < total; i++) out[i] *= Math.exp(-(i / sr) / decay) * 2.2;
  return A.gain(out, amp);
}

/** Sub/bass voice — gender panembung or plucked gamba bass. */
function bassPluck(freq, dur, { sr = 44100, amp = 0.34, decay = 0.9, rand } = {}) {
  const total = Math.round((dur + decay + 0.1) * sr);
  const out = A.buffer(total);
  const dr = rand || A.rng('bass');
  const ph0 = dr() * 0.3;
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const env = (t < 0.008 ? t / 0.008 : 1) * Math.exp(-t / (decay + dur * 0.4));
    if (env < 1e-4 && t > 0.02) break;
    const w = TAU * freq * t + ph0;
    out[i] = (Math.sin(w) * 1.0 + Math.sin(2 * w) * 0.32 * Math.exp(-t / 0.35)
      + Math.sin(3 * w) * 0.12 * Math.exp(-t / 0.18)) * env;
  }
  A.filter(out, 'lowpass', sr, 1400, 0.8);
  A.filter(out, 'highpass', sr, 35, 0.7);
  return A.gain(out, amp);
}

/** Sustained low drone (viola da gamba open string / shruti-like bed). */
function drone(freq, dur, { sr = 44100, amp = 0.12, attack = 1.2, release = 1.6, rand } = {}) {
  return bowed(freq, dur, {
    sr, amp, attack, release, bright: 0.24, vibRate: 3.4, vibDepth: 0.002, rand,
  });
}

module.exports = {
  pluck, metallophone, bonang, gong, churchBell,
  bowed, flute, choir, reedBrass,
  drumLow, drumHigh, shaker, bassPluck, drone,
  sawSample,
};
