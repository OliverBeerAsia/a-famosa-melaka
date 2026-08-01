/**
 * compose.cjs — musical scaffolding: tuning, scales, a bar/beat scheduler and
 * the seamless-loop renderer.
 *
 * TUNING NOTE
 * -----------
 * A real gamelan is not in 12-TET, and a vihuela is. Forcing either onto the
 * other sounds broken rather than fused. So: pitch *classes* come from 12-TET
 * (so the plucked/bowed Portuguese voices and the metallophones agree
 * harmonically), while the metallophone voices carry small per-degree cent
 * offsets ("pelogOffsets"/"slendroOffsets") plus paired-tuning beating. That
 * gives the shimmering, slightly-out-of-true gamelan colour without wrecking
 * the counterpoint — the same compromise used by most fusion scores.
 */

'use strict';

const A = require('./audio.cjs');

// ---------------------------------------------------------------------------
// Pitch
// ---------------------------------------------------------------------------

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A2", "Db4", "F#3" -> MIDI number. */
function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + NOTE_INDEX[m[1]] + acc;
}

/** MIDI (float allowed) -> Hz, with optional cent offset. */
const hz = (m, cents = 0) => 440 * Math.pow(2, (m - 69) / 12 + cents / 1200);

// Scale degree patterns (semitones from tonic).
const SCALES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  // Pentatonic frames — these are the pitch sets that read as "gamelan" to a
  // 12-TET ear. pelogLike ~ pathet nem (1 2 3 5 6 of a pelog scale);
  // slendroLike ~ the near-equidistant 5-tone slendro.
  pelogLike: [0, 1, 3, 7, 8],
  pelogBarang: [0, 2, 3, 7, 9],
  slendroLike: [0, 2, 5, 7, 9],
  chinesePenta: [0, 2, 4, 7, 9],      // gong mode
  chineseYu: [0, 3, 5, 7, 10],        // yu (minor) mode
};

// Cent deviations applied to metallophone voices only, per scale degree.
// Derived from measured pelog/slendro sets (Surakarta-ish), scaled down so the
// clash with the 12-TET voices stays a shimmer rather than a sour note.
const PELOG_CENTS = [0, -26, +18, -12, +30];
const SLENDRO_CENTS = [0, +14, -22, +9, -16];

/**
 * Build a playable scale object.
 * `degree(n)` maps any integer (negative / >len) to a MIDI number, octave-wrapped.
 */
function scale(tonicName, mode, { centsTable = null } = {}) {
  const root = midi(tonicName);
  const steps = SCALES[mode];
  if (!steps) throw new Error(`unknown mode ${mode}`);
  const n = steps.length;
  return {
    root, mode, steps, size: n,
    degree(i) {
      const oct = Math.floor(i / n);
      const k = ((i % n) + n) % n;
      return root + steps[k] + 12 * oct;
    },
    /** Cent offset for the metallophone tuning at degree i (0 if none). */
    cents(i) {
      if (!centsTable) return 0;
      const k = ((i % n) + n) % n;
      return centsTable[k % centsTable.length];
    },
    /** Nearest scale degree index for a MIDI pitch (used for voice-leading). */
    nearest(m) {
      let best = 0, bd = 1e9;
      for (let i = -14; i <= 21; i++) {
        const d = Math.abs(this.degree(i) - m);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    },
  };
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * A Track renders into a linear buffer of `loopSamples + tailSamples`, then
 * folds the tail back onto the head. Because notes are only ever *scheduled*
 * inside [0, loopSamples), the fold reproduces exactly what a looping player
 * outputs — the wrap is sample-accurate and click-free by construction, with
 * no crossfade and no fade-out at the end.
 */
class Track {
  /**
   * @param {object} o
   * @param {number} o.sr        sample rate
   * @param {number} o.bpm       tempo
   * @param {number} o.beats     beats per bar
   * @param {number} o.bars      total bars in the loop
   * @param {number} o.tail      extra render seconds for decays (default 8)
   */
  constructor({ sr, bpm, beats = 4, bars, tail = 8, channels = 2 }) {
    this.sr = sr; this.bpm = bpm; this.beats = beats; this.bars = bars;
    this.spb = 60 / bpm;                       // seconds per beat
    this.loopSec = bars * beats * this.spb;
    this.loopSamples = Math.round(this.loopSec * sr);
    this.tailSamples = Math.round(tail * sr);
    this.nch = channels;
    this.buses = new Map();
  }

  /** Get (or lazily create) a named bus; each bus is [L, R] or [M]. */
  bus(name) {
    if (!this.buses.has(name)) {
      const n = this.loopSamples + this.tailSamples;
      this.buses.set(name, Array.from({ length: this.nch }, () => A.buffer(n)));
    }
    return this.buses.get(name);
  }

  /** bar (0-based) + beat (0-based, float) -> sample index. */
  at(bar, beat = 0) {
    return Math.round(((bar * this.beats) + beat) * this.spb * this.sr);
  }

  /** beats -> seconds */
  dur(beats) { return beats * this.spb; }

  /**
   * Place a rendered note. `pan` in [-1, 1]. Notes scheduled at/after the loop
   * point are dropped (they would double up after folding).
   */
  place(busName, samples, startSample, { pan = 0, gain = 1 } = {}) {
    if (startSample >= this.loopSamples) return;
    const b = this.bus(busName);
    if (this.nch === 1) { A.addInto(b[0], samples, startSample, gain); return; }
    const p = Math.max(-1, Math.min(1, pan));
    const l = Math.cos((Math.PI / 4) * (p + 1));
    const r = Math.sin((Math.PI / 4) * (p + 1));
    A.addInto(b[0], samples, startSample, gain * l);
    A.addInto(b[1], samples, startSample, gain * r);
  }

  /** Convenience: place at a musical position. */
  note(busName, samples, bar, beat, opts) {
    this.place(busName, samples, this.at(bar, beat), opts);
  }

  /**
   * Finalise: run per-bus processing, sum, fold the tail, master.
   * @param {Record<string, (chans: Float64Array[], sr: number) => void>} busFx
   */
  render({
    busFx = {}, masterGain = 1, targetPeak = 0.89, lowcut = 42,
    tiltLowDb = -6.5, tiltHighDb = 4.5, presenceDb = 2.5,
  } = {}) {
    const n = this.loopSamples + this.tailSamples;
    const mix = Array.from({ length: this.nch }, () => A.buffer(n));
    for (const [name, chans] of this.buses) {
      const fx = busFx[name];
      if (fx) fx(chans, this.sr);
      for (let c = 0; c < this.nch; c++) {
        for (let i = 0; i < n; i++) mix[c][i] += chans[c][i];
      }
    }
    const out = mix.map((c) => A.foldTail(c, this.loopSamples));
    for (const c of out) {
      A.gain(c, masterGain);
      // Master EQ + highpass MUST be loop-aware: a plain one-pass filter starts
      // from zero state at sample 0, which both dulls the first few ms and
      // leaves a state mismatch at the wrap (an audible tick every loop).
      A.filterLooped(c, 'highpass', this.sr, lowcut, 0.7);
      A.filterLooped(c, 'lowshelf', this.sr, 150, 0.7, tiltLowDb);
      A.filterLooped(c, 'peaking', this.sr, 2600, 0.8, presenceDb);
      A.filterLooped(c, 'highshelf', this.sr, 4200, 0.7, tiltHighDb);
      A.softClip(c, 1.25);
    }
    // Normalise jointly so the stereo image is preserved.
    let p = 0;
    for (const c of out) p = Math.max(p, A.peak(c));
    if (p > 1e-9) for (const c of out) A.gain(c, targetPeak / p);
    return out;
  }
}

// ---------------------------------------------------------------------------
// Melodic material
// ---------------------------------------------------------------------------

/**
 * Grow a melodic phrase from a short motif by transposition / inversion /
 * rhythmic augmentation, then cadence onto a stable degree. This is what keeps
 * output sounding *composed* rather than randomly walked: every phrase is a
 * transformation of a fixed germ, not a fresh dice roll.
 *
 * @returns {{deg:number, beat:number, len:number, accent:number}[]}
 */
function developPhrase(motif, {
  bars, beats = 4, transforms = ['id'], rand, restProb = 0.1,
}) {
  const out = [];
  const motifBeats = motif.reduce((s, n) => Math.max(s, n.beat + n.len), 0);
  const reps = Math.max(1, Math.round((bars * beats) / motifBeats));
  let cursor = 0;
  for (let r = 0; r < reps; r++) {
    const tf = transforms[r % transforms.length];
    for (const nte of motif) {
      let deg = nte.deg;
      let len = nte.len;
      if (typeof tf === 'object') {
        if (tf.t) deg += tf.t;
        if (tf.invert) deg = (tf.axis ?? 0) * 2 - deg;
        if (tf.stretch) len *= tf.stretch;
      } else if (typeof tf === 'number') deg += tf;
      const beat = cursor + nte.beat * (typeof tf === 'object' && tf.stretch ? tf.stretch : 1);
      if (beat >= bars * beats) continue;
      if (rand && rand() < restProb && nte.accent < 0.9) continue;
      out.push({ deg, beat, len: Math.min(len, bars * beats - beat), accent: nte.accent ?? 0.8 });
    }
    cursor += motifBeats * (typeof tf === 'object' && tf.stretch ? tf.stretch : 1);
    if (cursor >= bars * beats) break;
  }
  return out;
}

/**
 * Interlocking gamelan figuration (imbal): two players alternate offbeats to
 * produce a single fast line neither one plays alone.
 */
function imbal(degPair, { bars, beats = 4, subdiv = 4 }) {
  const a = [], b = [];
  const total = bars * beats * subdiv;
  for (let s = 0; s < total; s++) {
    const beat = s / subdiv;
    const idx = Math.floor(s / 2) % degPair.length;
    if (s % 2 === 0) a.push({ deg: degPair[idx], beat, len: 1 / subdiv, accent: 0.7 });
    else b.push({ deg: degPair[(idx + 1) % degPair.length] + 2, beat, len: 1 / subdiv, accent: 0.55 });
  }
  return [a, b];
}

/**
 * Colotomic structure — the gong/kenong punctuation that defines a gongan.
 * Returns sample-free descriptors: {bar, beat, kind}.
 */
function colotomic(bars, { beats = 4, gongEvery = 8, kenongEvery = 2 } = {}) {
  const ev = [];
  for (let bar = 0; bar < bars; bar++) {
    if (bar % gongEvery === 0) ev.push({ bar, beat: 0, kind: 'gong' });
    if (bar % kenongEvery === kenongEvery - 1) ev.push({ bar, beat: beats - 1, kind: 'kenong' });
    ev.push({ bar, beat: beats / 2, kind: 'kempul' });
  }
  return ev;
}

module.exports = {
  midi, hz, scale, SCALES, PELOG_CENTS, SLENDRO_CENTS,
  Track, developPhrase, imbal, colotomic,
};
