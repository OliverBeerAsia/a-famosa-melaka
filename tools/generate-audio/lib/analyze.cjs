/**
 * analyze.cjs — numeric QA for generated audio.
 *
 * We cannot listen to the output, so every musical/technical claim has to be
 * measurable. This module provides:
 *   - level stats (peak, RMS, crest, DC)
 *   - loop-seam analysis: sample discontinuity at the wrap, plus RMS and
 *     spectral-centroid similarity between the loop head and tail
 *   - onset detection -> note density + rhythmic-grid alignment
 *   - spectral centroid / flux over time -> catches both chaos and monotony
 *   - self-similarity of a chroma-ish band profile -> proves A/B structure
 */

'use strict';

const A = require('./audio.cjs');

// ---------------------------------------------------------------------------
// Minimal radix-2 FFT (in-place, real input via separate im array)
// ---------------------------------------------------------------------------

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/** Magnitude spectrum of a Hann-windowed frame starting at `off`. */
function spectrum(buf, off, size) {
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const x = buf[(off + i) % buf.length] || 0;
    re[i] = x * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  fft(re, im);
  const half = size >> 1;
  const mag = new Float64Array(half);
  for (let i = 0; i < half; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

function centroid(mag, sr, size) {
  let num = 0, den = 0;
  for (let i = 1; i < mag.length; i++) { num += (i * sr) / size * mag[i]; den += mag[i]; }
  return den > 1e-12 ? num / den : 0;
}

// ---------------------------------------------------------------------------
// Analyses
// ---------------------------------------------------------------------------

function levels(buf) {
  const p = A.peak(buf);
  const r = A.rms(buf);
  let dc = 0;
  for (let i = 0; i < buf.length; i++) dc += buf[i];
  dc /= buf.length;
  return {
    peak: +p.toFixed(4),
    rms: +r.toFixed(4),
    rmsDb: +(20 * Math.log10(Math.max(1e-9, r))).toFixed(2),
    crestDb: +(20 * Math.log10(Math.max(1e-9, p / Math.max(1e-9, r)))).toFixed(2),
    dc: +dc.toFixed(6),
  };
}

/**
 * Loop-seam check. A file is loop-safe when:
 *   - the step from the last sample to the first is no larger than typical
 *     sample-to-sample steps inside the file (stepRatio ~ 1)
 *   - head and tail RMS are within a few dB
 *   - head and tail spectral centroids are close
 * `stepRatio` is the killer metric: a click is by definition an outlier step.
 */
function loopSeam(buf, sr, fftSize = 2048) {
  const L = buf.length;
  // Distribution of |x[i+1]-x[i]| over the whole file.
  let sum = 0, max = 0;
  for (let i = 1; i < L; i++) {
    const d = Math.abs(buf[i] - buf[i - 1]);
    sum += d; if (d > max) max = d;
  }
  const meanStep = sum / (L - 1);
  const seamStep = Math.abs(buf[0] - buf[L - 1]);

  // Slope continuity: compare the derivative just before and just after wrap.
  const dBefore = buf[L - 1] - buf[L - 2];
  const dAfter = buf[1] - buf[0];

  const win = Math.min(Math.round(sr * 0.5), Math.floor(L / 4));
  const headRms = A.rms(buf, 0, win);
  const tailRms = A.rms(buf, L - win, L);
  const headC = centroid(spectrum(buf, 0, fftSize), sr, fftSize);
  const tailC = centroid(spectrum(buf, L - fftSize, fftSize), sr, fftSize);

  // Concatenate twice and look for an outlier step in the joint region: this
  // is exactly what a looping player produces.
  const jw = Math.round(sr * 0.02);
  let jointMax = 0;
  for (let i = -jw; i < jw; i++) {
    const a = buf[((i - 1) % L + L) % L];
    const b = buf[((i) % L + L) % L];
    const d = Math.abs(b - a);
    if (d > jointMax) jointMax = d;
  }
  // Reference: a high percentile of the step distribution over the WHOLE file.
  // Sampling one arbitrary window is unreliable — on a sparse bed that window
  // may land in near-silence and flag a perfectly clean wrap as a click.
  const stride = Math.max(1, Math.floor(L / 200000));
  const steps = [];
  for (let i = 1; i < L; i += stride) steps.push(Math.abs(buf[i] - buf[i - 1]));
  steps.sort((a, b) => a - b);
  const pct = (p) => steps[Math.min(steps.length - 1, Math.floor(steps.length * p))];
  const elsewhereMax = Math.max(pct(0.9999), 1e-9);

  return {
    seamStep: +seamStep.toFixed(6),
    meanStep: +meanStep.toFixed(6),
    maxStep: +max.toFixed(6),
    seamStepVsMean: +(seamStep / Math.max(1e-9, meanStep)).toFixed(2),
    seamStepVsMax: +(seamStep / Math.max(1e-9, max)).toFixed(4),
    slopeBefore: +dBefore.toFixed(6),
    slopeAfter: +dAfter.toFixed(6),
    headRms: +headRms.toFixed(4),
    tailRms: +tailRms.toFixed(4),
    rmsDeltaDb: +(20 * Math.log10(Math.max(1e-9, tailRms) / Math.max(1e-9, headRms))).toFixed(2),
    headCentroidHz: Math.round(headC),
    tailCentroidHz: Math.round(tailC),
    centroidRatio: +(tailC / Math.max(1e-6, headC)).toFixed(3),
    jointMaxStep: +jointMax.toFixed(6),
    elsewhereMaxStep: +elsewhereMax.toFixed(6),
    // < 1 means the wrap is indistinguishable from ordinary in-file transients.
    seamOutlierRatio: +(jointMax / elsewhereMax).toFixed(2),
  };
}

/**
 * Onset detection via spectral flux with adaptive median threshold.
 * Returns onset times plus a grid-alignment score against the stated tempo.
 */
function onsets(buf, sr, { bpm = null, hop = 512, size = 1024 } = {}) {
  const frames = Math.floor((buf.length - size) / hop);
  const flux = new Float64Array(Math.max(0, frames));
  let prev = null;
  for (let f = 0; f < frames; f++) {
    const raw = spectrum(buf, f * hop, size);
    // Log compression: without it, flux tracks loudness rather than novelty and
    // fires repeatedly on the beating tail of a metallophone.
    const mag = new Float64Array(raw.length);
    for (let i = 0; i < raw.length; i++) mag[i] = Math.log1p(raw[i] * 60);
    if (prev) {
      let s = 0;
      for (let i = 0; i < mag.length; i++) { const d = mag[i] - prev[i]; if (d > 0) s += d; }
      flux[f] = s;
    }
    prev = mag;
  }
  // adaptive threshold = local median * k
  const W = 21, times = [];
  const sorted = new Float64Array(W);
  for (let f = 1; f < frames - 1; f++) {
    const lo = Math.max(0, f - (W >> 1)), hi = Math.min(frames, lo + W);
    let m = 0;
    for (let i = lo; i < hi; i++) sorted[m++] = flux[i];
    const sub = Array.prototype.slice.call(sorted, 0, m).sort((a, b) => a - b);
    const med = sub[m >> 1];
    if (flux[f] > med * 2.2 + 1e-6 && flux[f] >= flux[f - 1] && flux[f] > flux[f + 1]) {
      const t = (f * hop) / sr;
      if (!times.length || t - times[times.length - 1] > 0.085) times.push(t);
    }
  }
  const dur = buf.length / sr;
  const out = { count: times.length, perSecond: +(times.length / dur).toFixed(2) };
  if (bpm) {
    const beat = 60 / bpm;
    const grid = beat / 4;  // 16th-note grid
    let aligned = 0, err = 0;
    for (const t of times) {
      const d = Math.abs(t / grid - Math.round(t / grid)) * grid;
      err += d;
      if (d < 0.035) aligned++;
    }
    out.gridAlignedPct = times.length ? Math.round((aligned / times.length) * 100) : 0;
    out.meanGridErrMs = times.length ? +((err / times.length) * 1000).toFixed(1) : 0;
  }
  // inter-onset-interval histogram, quantised to 10 ms — a composed piece
  // clusters on a few values; noise spreads flat.
  const ioi = {};
  for (let i = 1; i < times.length; i++) {
    const k = Math.round((times[i] - times[i - 1]) * 100) / 100;
    ioi[k] = (ioi[k] || 0) + 1;
  }
  const top = Object.entries(ioi).sort((a, b) => b[1] - a[1]).slice(0, 5);
  out.topIOIs = top.map(([k, v]) => `${k}s x${v}`);
  out.ioiConcentration = times.length > 1
    ? +(top.reduce((s, [, v]) => s + v, 0) / (times.length - 1)).toFixed(2) : 0;
  return out;
}

/**
 * Spectral evolution: centroid mean/spread over time and a coarse
 * self-similarity matrix summary. `sectionContrast` > 0 means the piece
 * actually changes between sections (A vs B); ~0 means monotony.
 */
function structure(buf, sr, { frames = 64, size = 4096 } = {}) {
  const step = Math.floor((buf.length - size) / frames);
  const profiles = [];
  const cents = [];
  for (let f = 0; f < frames; f++) {
    const mag = spectrum(buf, f * step, size);
    cents.push(centroid(mag, sr, size));
    // 12 log-spaced bands from 60 Hz to 8 kHz
    const bands = new Float64Array(12);
    for (let i = 1; i < mag.length; i++) {
      const hz = (i * sr) / size;
      if (hz < 60 || hz > 8000) continue;
      const b = Math.min(11, Math.floor((Math.log2(hz / 60) / Math.log2(8000 / 60)) * 12));
      bands[b] += mag[i];
    }
    let n = 0; for (let i = 0; i < 12; i++) n += bands[i] * bands[i];
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < 12; i++) bands[i] /= n;
    profiles.push(bands);
  }
  const mean = cents.reduce((s, c) => s + c, 0) / cents.length;
  const sd = Math.sqrt(cents.reduce((s, c) => s + (c - mean) ** 2, 0) / cents.length);

  const sim = (a, b) => { let s = 0; for (let i = 0; i < 12; i++) s += a[i] * b[i]; return s; };
  // near-diagonal similarity (local coherence) vs far-off similarity (contrast)
  let near = 0, nn = 0, far = 0, fn = 0;
  for (let i = 0; i < frames; i++) {
    for (let j = i + 1; j < frames; j++) {
      const s = sim(profiles[i], profiles[j]);
      if (j - i <= 3) { near += s; nn++; } else if (j - i > frames / 4) { far += s; fn++; }
    }
  }
  return {
    centroidMeanHz: Math.round(mean),
    centroidSdHz: Math.round(sd),
    centroidCv: +(sd / Math.max(1, mean)).toFixed(3),
    localCoherence: +(near / Math.max(1, nn)).toFixed(3),
    longRangeSim: +(far / Math.max(1, fn)).toFixed(3),
    sectionContrast: +((near / Math.max(1, nn)) - (far / Math.max(1, fn))).toFixed(3),
  };
}

/** Energy in coarse bands, as % of total — sanity check on tonal balance. */
function bandBalance(buf, sr) {
  const size = 8192;
  const nf = Math.max(1, Math.floor(buf.length / size) - 1);
  const edges = [0, 120, 500, 2000, 6000, sr / 2];
  const acc = new Float64Array(edges.length - 1);
  for (let f = 0; f < nf; f++) {
    const mag = spectrum(buf, f * size, size);
    for (let i = 1; i < mag.length; i++) {
      const hz = (i * sr) / size;
      for (let b = 0; b < acc.length; b++) {
        if (hz >= edges[b] && hz < edges[b + 1]) { acc[b] += mag[i] * mag[i]; break; }
      }
    }
  }
  let tot = 0; for (let i = 0; i < acc.length; i++) tot += acc[i];
  const names = ['sub<120', '120-500', '500-2k', '2k-6k', '6k+'];
  const out = {};
  for (let i = 0; i < acc.length; i++) out[names[i]] = +((acc[i] / Math.max(1e-12, tot)) * 100).toFixed(1);
  return out;
}

/** Full report for one mono channel (or a mono-summed stereo pair). */
function report(channels, sr, { bpm = null, label = '' } = {}) {
  const mono = channels.length === 1 ? channels[0] : (() => {
    const m = A.buffer(channels[0].length);
    for (let i = 0; i < m.length; i++) m[i] = (channels[0][i] + channels[1][i]) * 0.5;
    return m;
  })();
  return {
    label,
    durationSec: +(mono.length / sr).toFixed(3),
    sampleRate: sr,
    channels: channels.length,
    levels: levels(mono),
    seam: loopSeam(mono, sr),
    onsets: onsets(mono, sr, { bpm }),
    structure: structure(mono, sr),
    bands: bandBalance(mono, sr),
  };
}

module.exports = { fft, spectrum, centroid, levels, loopSeam, onsets, structure, bandBalance, report };
