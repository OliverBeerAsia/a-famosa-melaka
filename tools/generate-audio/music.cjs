/**
 * music.cjs — the seven looping cues.
 *
 * Each cue is hand-composed: a fixed mode, a written motif, real A/B/A'
 * sections with cadences, and layered instrumental entrances. Nothing here is
 * a random walk; the PRNG only supplies humanisation (micro-timing, velocity,
 * detune) so the result is reproducible but not machine-stiff.
 *
 * Loops are seamless by construction — see compose.cjs `Track.render`.
 */

'use strict';

const A = require('./lib/audio.cjs');
const I = require('./lib/instruments.cjs');
const C = require('./lib/compose.cjs');

const SR = 44100;

// ---------------------------------------------------------------------------
// Scheduling helper
// ---------------------------------------------------------------------------

/**
 * Play a list of notes.
 * note = { deg, beat (absolute, 0-based), len (beats), accent?, oct? }
 * `voice(freq, durSec, accent, rand)` renders one note.
 */
function play(tr, bus, notes, voice, {
  sc, octave = 0, pan = 0, gain = 1, rand, humanize = 0.012, cents = false,
  swing = 0,
}) {
  for (const n of notes) {
    const deg = n.deg;
    const cent = cents ? sc.cents(deg) : 0;
    const f = C.hz(sc.degree(deg) + 12 * (octave + (n.oct || 0)), cent);
    const durSec = tr.dur(n.len);
    const acc = n.accent ?? 0.8;
    let beat = n.beat;
    if (swing && Math.abs((beat * 2) % 2 - 1) < 1e-6) beat += swing;
    const jitter = rand ? rand.norm() * humanize : 0;
    const start = Math.round((beat * tr.spb + jitter) * tr.sr);
    if (start >= tr.loopSamples || start < -tr.sr) continue;
    const buf = voice(f, durSec, acc, rand);
    tr.place(bus, buf, start, { pan: pan + (rand ? rand.norm() * 0.05 : 0), gain: gain * acc });
  }
}

/** Repeat a bar-relative pattern across a bar range. */
function repeatBars(pattern, fromBar, toBar, beatsPerBar, mutate = null) {
  const out = [];
  for (let bar = fromBar; bar < toBar; bar++) {
    for (const p of pattern) {
      const n = Object.assign({}, p, { beat: bar * beatsPerBar + p.beat });
      out.push(mutate ? mutate(n, bar) : n);
    }
  }
  return out;
}

/** Standard bus effects: a room, a tilt, and a gentle stereo spread. */
function room(size, mix, damp = 0.34) {
  return (chans, sr) => {
    for (const c of chans) A.reverb(c, sr, { size, mix, damp });
  };
}

// ---------------------------------------------------------------------------
// Track 1 — music-main : "Saudade of the Strait"
// D aeolian, 72 BPM, 24 bars (80.0s)
// Intro (solo vihuela) -> A (gamelan enters) -> B (pipa lead) -> A' (tutti) -> cadence
// ---------------------------------------------------------------------------

function musicMain() {
  const rand = A.rng('melaka:music-main:v1');
  const tr = new C.Track({ sr: SR, bpm: 72, beats: 4, bars: 24, tail: 9 });
  const sc = C.scale('D3', 'aeolian');
  const pel = C.scale('D3', 'pelogLike', { centsTable: C.PELOG_CENTS });
  const B = 4;

  // --- the germ: a descending fado sigh, arch-shaped over 4 bars ------------
  // A G F | E F D | A Bb C | Bb A F
  const germ = [
    { deg: 4, beat: 0.0, len: 1.5, accent: 0.95 },
    { deg: 3, beat: 1.5, len: 0.5, accent: 0.7 },
    { deg: 2, beat: 2.0, len: 2.0, accent: 0.85 },
    { deg: 1, beat: 4.0, len: 1.0, accent: 0.75 },
    { deg: 2, beat: 5.0, len: 1.0, accent: 0.7 },
    { deg: 0, beat: 6.0, len: 2.0, accent: 0.9 },
    { deg: 4, beat: 8.0, len: 1.0, accent: 0.85 },
    { deg: 5, beat: 9.0, len: 1.0, accent: 0.75 },
    { deg: 6, beat: 10.0, len: 2.0, accent: 0.9 },
    { deg: 5, beat: 12.0, len: 1.5, accent: 0.8 },
    { deg: 4, beat: 13.5, len: 0.5, accent: 0.65 },
    { deg: 2, beat: 14.0, len: 2.0, accent: 0.85 },
  ];
  const shift = (ns, dBeats, dDeg = 0) =>
    ns.map((n) => Object.assign({}, n, { beat: n.beat + dBeats, deg: n.deg + dDeg }));

  // Intro: bars 0-3, solo lute, germ stated bare and quiet.
  const intro = shift(germ.filter((n) => n.beat < 8), 0)
    .map((n) => Object.assign({}, n, { accent: n.accent * 0.72 }));
  const introTail = [
    { deg: 4, beat: 8, len: 2, accent: 0.6 },
    { deg: 2, beat: 10, len: 2, accent: 0.55 },
    { deg: 0, beat: 12, len: 3, accent: 0.7 },
    { deg: -1, beat: 15, len: 1, accent: 0.5 },  // leading C, pulls into A
  ];

  // A section: bars 4-11 — germ + an answering upper limb.
  const secA = shift(germ, 4 * B).concat(shift(germ, 8 * B, 0).map((n, i) => (
    // answer: same contour, lifted a third, last cell resolves down
    Object.assign({}, n, { deg: n.deg + (i > 8 ? 0 : 2), accent: n.accent * 0.92 })
  )));

  // B section: bars 12-17 — Chinese-pentatonic lead (pipa colour), higher.
  const bMotif = [
    { deg: 4, beat: 0, len: 0.5, accent: 0.9 },
    { deg: 6, beat: 0.5, len: 0.5, accent: 0.7 },
    { deg: 7, beat: 1, len: 1.5, accent: 0.85 },
    { deg: 6, beat: 2.5, len: 0.5, accent: 0.6 },
    { deg: 4, beat: 3, len: 1, accent: 0.8 },
    { deg: 3, beat: 4, len: 0.5, accent: 0.7 },
    { deg: 4, beat: 4.5, len: 1.5, accent: 0.75 },
    { deg: 2, beat: 6, len: 2, accent: 0.85 },
  ];
  const secB = shift(bMotif, 12 * B)
    .concat(shift(bMotif, 14 * B, 1))
    .concat(shift(bMotif.slice(0, 5), 16 * B, -1))
    .concat([
      { deg: 4, beat: 17 * B + 0, len: 1, accent: 0.8 },
      { deg: 5, beat: 17 * B + 1, len: 1, accent: 0.8 },
      { deg: 6, beat: 17 * B + 2, len: 2, accent: 0.9 },  // dominant approach
    ]);

  // A' : bars 18-23 — full ensemble, emotional peak, then cadence to the top.
  const secAp = shift(germ, 18 * B).map((n) => Object.assign({}, n, { accent: Math.min(1, n.accent * 1.12) }));
  const cadence = [
    { deg: 6, beat: 22 * B + 0, len: 1, accent: 0.9 },
    { deg: 5, beat: 22 * B + 1, len: 1, accent: 0.85 },
    { deg: 4, beat: 22 * B + 2, len: 2, accent: 0.9 },
    { deg: 3, beat: 23 * B + 0, len: 1, accent: 0.75 },
    { deg: 2, beat: 23 * B + 1, len: 1, accent: 0.7 },
    { deg: 0, beat: 23 * B + 2, len: 1.5, accent: 0.8 },
    // final pickup: the very note the intro opens on, so the seam sings
    { deg: -3, beat: 23 * B + 3.5, len: 0.5, accent: 0.5 },
  ];

  const lute = (f, d, acc) => I.pluck(f, d, {
    sr: SR, rand, amp: 0.42 * (0.6 + 0.4 * acc), damping: 0.42,
    brightness: 0.42 + acc * 0.2, release: 1.5,
  });
  play(tr, 'lute', intro.concat(introTail), lute, { sc, octave: 1, pan: -0.18, rand });
  play(tr, 'lute', secA, lute, { sc, octave: 1, pan: -0.18, rand });
  play(tr, 'lute', secAp.concat(cadence), lute, { sc, octave: 1, pan: -0.18, rand });

  // Pipa colour for B — brighter pluck, opposite side of the field.
  play(tr, 'pipa', secB, (f, d, acc) => I.pluck(f, d, {
    sr: SR, rand, amp: 0.30 * (0.6 + 0.4 * acc), damping: 0.22,
    brightness: 0.82, pickPos: 0.13, release: 0.9, body: 0.72,
  }), { sc, octave: 1, pan: 0.30, rand });

  // Erhu counter-line under B (thin bowed, one octave down)
  play(tr, 'erhu', [
    { deg: 0, beat: 12 * B, len: 3, accent: 0.55 },
    { deg: 2, beat: 13 * B, len: 3, accent: 0.5 },
    { deg: 4, beat: 14 * B, len: 4, accent: 0.6 },
    { deg: 3, beat: 15 * B + 1, len: 3, accent: 0.5 },
    { deg: 2, beat: 16 * B, len: 4, accent: 0.55 },
    { deg: 4, beat: 17 * B, len: 3.5, accent: 0.6 },
  ], (f, d, acc) => I.bowed(f, d, {
    sr: SR, rand, amp: 0.14 * acc, bright: 0.78, vibRate: 5.6, vibDepth: 0.008, attack: 0.14,
  }), { sc, octave: 1, pan: 0.42, rand });

  // --- gamelan bed: saron balungan (the skeletal melody), enters bar 4 -----
  const balungan = [];
  const balPitch = [0, 2, 4, 2, 0, -1, 0, 2];   // slow nuclear theme
  for (let bar = 4; bar < 24; bar++) {
    if (bar >= 12 && bar < 16) continue;          // thins out under B
    for (let k = 0; k < 4; k++) {
      balungan.push({
        deg: balPitch[(bar * 4 + k) % balPitch.length],
        beat: bar * B + k, len: 1, accent: k % 2 === 0 ? 0.8 : 0.6,
      });
    }
  }
  play(tr, 'saron', balungan, (f, d, acc) => I.metallophone(f, d, {
    sr: SR, amp: 0.20 * acc, decay: 1.25, ombak: 2.6, tail: 1.3,
  }), { sc: pel, octave: 1, pan: 0.2, rand, cents: true, humanize: 0.008 });

  // Bonang panerusan: doubles at twice the density from bar 8, high register.
  const bonPat = [];
  for (let bar = 8; bar < 24; bar++) {
    if (bar >= 12 && bar < 16) continue;
    for (let k = 0; k < 8; k++) {
      if (k % 2 === 1 && bar < 18) continue;      // sparser before the peak
      bonPat.push({
        deg: balPitch[(bar * 8 + k) % balPitch.length] + 2,
        beat: bar * B + k * 0.5, len: 0.5, accent: 0.5,
      });
    }
  }
  play(tr, 'bonang', bonPat, (f, d, acc) => I.bonang(f, d, {
    sr: SR, amp: 0.11 * acc, decay: 1.6, tail: 1.2,
  }), { sc: pel, octave: 2, pan: -0.32, rand, cents: true, humanize: 0.01 });

  // --- colotomic gongs -----------------------------------------------------
  for (const bar of [0, 8, 16]) {
    tr.place('gong', I.gong(C.hz(sc.degree(0) - 12), { sr: SR, amp: 0.34, decay: 8.5, rand }),
      tr.at(bar, 0), { pan: 0 });
  }
  for (const bar of [4, 12, 20]) {
    tr.place('gong', I.gong(C.hz(sc.degree(4) - 12), { sr: SR, amp: 0.18, decay: 5.0, rand }),
      tr.at(bar, 2), { pan: 0.15 });
  }

  // --- bass: viola da gamba, one root per bar (harmonic frame) -------------
  //   | Dm Dm Bb C | Dm F C Dm | Bb Gm C Dm | (B) Bb F C C | Dm Bb C Dm | F C |
  const bassLine = [0, 0, 5, 6, 0, 2, 6, 0, 5, 3, 6, 0, 5, 2, 6, 6, 0, 6, 0, 5, 6, 0, 6, 0];
  const bassNotes = bassLine.map((deg, bar) => ({ deg, beat: bar * B, len: 3.4, accent: bar % 4 === 0 ? 0.9 : 0.72 }));
  play(tr, 'bass', bassNotes, (f, d, acc) => I.bassPluck(f, d, {
    sr: SR, rand, amp: 0.30 * acc, decay: 1.1,
  }), { sc, octave: -1, pan: 0, rand });

  // Sustained gamba drone under A' only — thickens the peak.
  for (let bar = 18; bar < 24; bar += 2) {
    tr.place('drone', I.drone(C.hz(sc.degree(0)), tr.dur(8), { sr: SR, amp: 0.075, rand }),
      tr.at(bar, 0), { pan: -0.1 });
  }

  // --- frame drum: enters bar 8, gently ------------------------------------
  const drumPat = [];
  for (let bar = 8; bar < 24; bar++) {
    if (bar >= 12 && bar < 15) continue;
    drumPat.push({ t: bar * B + 0, kind: 'dum', a: 0.85 });
    drumPat.push({ t: bar * B + 1.5, kind: 'tak', a: 0.5 });
    drumPat.push({ t: bar * B + 2, kind: 'dum', a: 0.6 });
    drumPat.push({ t: bar * B + 3, kind: 'tak', a: 0.55 });
    if (bar % 4 === 3) drumPat.push({ t: bar * B + 3.5, kind: 'tak', a: 0.4 });
  }
  for (const d of drumPat) {
    const buf = d.kind === 'dum'
      ? I.drumLow(0, { sr: SR, amp: 0.26 * d.a, freq: 82, decay: 0.36, rand })
      : I.drumHigh(0, { sr: SR, amp: 0.17 * d.a, freq: 1650, decay: 0.05, rand });
    tr.place('perc', buf, Math.round((d.t * tr.spb + rand.norm() * 0.01) * SR),
      { pan: d.kind === 'dum' ? 0 : rand.range(-0.35, 0.35) });
  }

  return {
    key: 'music-main',
    seed: 'melaka:music-main:v1',
    bpm: 72, bars: 24, beats: 4, mode: 'D aeolian + pelog-inflected gamelan',
    channels: tr.render({
      busFx: {
        lute: room(1.05, 0.24), pipa: room(1.0, 0.26), erhu: room(1.2, 0.30),
        saron: room(1.15, 0.26), bonang: room(1.15, 0.28), gong: room(1.5, 0.34),
        perc: room(0.8, 0.14), bass: room(0.7, 0.08), drone: room(1.4, 0.30),
      },
      masterGain: 1.0,
    }),
    sr: SR, loopSamples: tr.loopSamples,
  };
}

// ---------------------------------------------------------------------------
// Track 2 — music-market : "Rua Direita"
// G mixolydian, 104 BPM, 32 bars (73.8s). Interlocking imbal, walking bass.
// ---------------------------------------------------------------------------

function musicMarket() {
  const rand = A.rng('melaka:music-market:v1');
  const tr = new C.Track({ sr: SR, bpm: 104, beats: 4, bars: 32, tail: 7 });
  const sc = C.scale('G3', 'mixolydian');
  const sle = C.scale('G3', 'slendroLike', { centsTable: C.SLENDRO_CENTS });
  const B = 4;

  // Germ: a bright hawking call — G A B | D B A G
  const germ = [
    { deg: 0, beat: 0, len: 0.5, accent: 0.95 },
    { deg: 1, beat: 0.5, len: 0.5, accent: 0.7 },
    { deg: 2, beat: 1, len: 1, accent: 0.9 },
    { deg: 4, beat: 2, len: 1.5, accent: 0.95 },
    { deg: 2, beat: 3.5, len: 0.5, accent: 0.65 },
    { deg: 1, beat: 4, len: 1, accent: 0.8 },
    { deg: 0, beat: 5, len: 1, accent: 0.85 },
    { deg: 4, beat: 6, len: 2, accent: 0.75 },
  ];
  const shift = (ns, d, dd = 0) => ns.map((n) => Object.assign({}, n, { beat: n.beat + d, deg: n.deg + dd }));

  // A (bars 4-11): rebab states the call; A2 (12-19) answers a step up;
  // B (20-27): suling takes it into the Chinese pentatonic; A' (28-31): tutti tag.
  const leadA = shift(germ, 4 * B).concat(shift(germ, 6 * B, 2)).concat(shift(germ, 8 * B, 0))
    .concat([
      { deg: 3, beat: 10 * B, len: 1, accent: 0.85 },
      { deg: 4, beat: 10 * B + 1, len: 1, accent: 0.8 },
      { deg: 5, beat: 10 * B + 2, len: 2, accent: 0.9 },
      { deg: 4, beat: 11 * B, len: 1.5, accent: 0.8 },
      { deg: 2, beat: 11 * B + 1.5, len: 0.5, accent: 0.6 },
      { deg: 0, beat: 11 * B + 2, len: 2, accent: 0.85 },
    ]);
  const leadA2 = shift(germ, 12 * B, 1).concat(shift(germ, 14 * B, 3))
    .concat(shift(germ.slice(0, 6), 16 * B, 1))
    .concat([
      { deg: 6, beat: 17 * B, len: 1, accent: 0.85 },
      { deg: 4, beat: 17 * B + 1, len: 1, accent: 0.75 },
      { deg: 2, beat: 17 * B + 2, len: 2, accent: 0.85 },
      { deg: 4, beat: 18 * B, len: 0.5, accent: 0.8 },
      { deg: 5, beat: 18 * B + 0.5, len: 0.5, accent: 0.7 },
      { deg: 6, beat: 18 * B + 1, len: 1, accent: 0.85 },
      { deg: 7, beat: 18 * B + 2, len: 2, accent: 0.95 },
      { deg: 4, beat: 19 * B, len: 2, accent: 0.8 },
      { deg: 2, beat: 19 * B + 2, len: 2, accent: 0.75 },
    ]);
  const leadB = [
    { deg: 4, beat: 20 * B, len: 1, accent: 0.9 },
    { deg: 6, beat: 20 * B + 1, len: 0.5, accent: 0.7 },
    { deg: 7, beat: 20 * B + 1.5, len: 1.5, accent: 0.85 },
    { deg: 6, beat: 20 * B + 3, len: 1, accent: 0.7 },
    { deg: 4, beat: 21 * B, len: 1.5, accent: 0.8 },
    { deg: 3, beat: 21 * B + 1.5, len: 0.5, accent: 0.65 },
    { deg: 2, beat: 21 * B + 2, len: 2, accent: 0.85 },
    { deg: 4, beat: 22 * B, len: 0.5, accent: 0.8 },
    { deg: 5, beat: 22 * B + 0.5, len: 0.5, accent: 0.7 },
    { deg: 6, beat: 22 * B + 1, len: 1, accent: 0.85 },
    { deg: 8, beat: 22 * B + 2, len: 2, accent: 0.9 },
    { deg: 7, beat: 23 * B, len: 1, accent: 0.8 },
    { deg: 6, beat: 23 * B + 1, len: 1, accent: 0.75 },
    { deg: 4, beat: 23 * B + 2, len: 2, accent: 0.85 },
  ];
  const leadBp = shift(leadB, 4 * B, -2);
  const tag = shift(germ, 28 * B).concat([
    { deg: 4, beat: 30 * B, len: 1, accent: 0.9 },
    { deg: 2, beat: 30 * B + 1, len: 1, accent: 0.8 },
    { deg: 1, beat: 30 * B + 2, len: 1, accent: 0.75 },
    { deg: 0, beat: 30 * B + 3, len: 2, accent: 0.9 },
    { deg: -3, beat: 31 * B + 2, len: 1, accent: 0.6 },
    { deg: -1, beat: 31 * B + 3, len: 1, accent: 0.55 },  // pickup into bar 0
  ]);

  const rebab = (f, d, acc) => I.bowed(f, d, {
    sr: SR, rand, amp: 0.20 * (0.6 + 0.4 * acc), bright: 0.72,
    vibRate: 5.4, vibDepth: 0.007, attack: 0.05, release: 0.12,
  });
  play(tr, 'rebab', leadA.concat(leadA2), rebab, { sc, octave: 1, pan: -0.24, rand });
  play(tr, 'rebab', tag, rebab, { sc, octave: 1, pan: -0.24, rand });
  play(tr, 'suling', leadB.concat(leadBp), (f, d, acc) => I.flute(f, d, {
    sr: SR, rand, amp: 0.22 * (0.6 + 0.4 * acc), breath: 0.07, attack: 0.04,
  }), { sc, octave: 1, pan: 0.26, rand });

  // --- imbal: two interlocking bonang parts, the engine of the cue ---------
  const [pA, pB] = C.imbal([0, 2, 4, 2], { bars: 28, beats: 4, subdiv: 4 });
  const offs = 4 * B;
  play(tr, 'imbalA', shift(pA, offs), (f, d, acc) => I.bonang(f, d, {
    sr: SR, amp: 0.085 * acc, decay: 0.7, tail: 0.6,
  }), { sc: sle, octave: 2, pan: -0.5, rand, cents: true, humanize: 0.006 });
  play(tr, 'imbalB', shift(pB, offs), (f, d, acc) => I.bonang(f, d, {
    sr: SR, amp: 0.085 * acc, decay: 0.7, tail: 0.6,
  }), { sc: sle, octave: 2, pan: 0.5, rand, cents: true, humanize: 0.006 });

  // Saron balungan through the whole cue (from bar 2) — the spine.
  const bal = [0, 4, 2, 0, 5, 4, 2, 1];
  const balNotes = [];
  for (let bar = 2; bar < 32; bar++) {
    for (let k = 0; k < 4; k++) {
      balNotes.push({ deg: bal[(bar * 4 + k) % bal.length], beat: bar * B + k, len: 1, accent: k === 0 ? 0.9 : 0.65 });
    }
  }
  play(tr, 'saron', balNotes, (f, d, acc) => I.metallophone(f, d, {
    sr: SR, amp: 0.17 * acc, decay: 0.85, ombak: 3.1, tail: 0.9,
  }), { sc: sle, octave: 1, pan: 0.1, rand, cents: true });

  // --- walking bass: the rhythm of trade ----------------------------------
  //  | G  G  C  D | G  Em C  D | ... walking quarters through the changes
  const changes = [0, 0, 3, 4, 0, 5, 3, 4, 0, 0, 3, 4, 2, 5, 4, 4,
    0, 3, 0, 4, 5, 3, 4, 0, 0, 3, 4, 1, 0, 5, 4, 4];
  const walk = [];
  for (let bar = 0; bar < 32; bar++) {
    const r = changes[bar], nx = changes[(bar + 1) % 32];
    const steps = [r, r + 2, r + 4, nx > r ? nx - 1 : nx + 1];
    for (let k = 0; k < 4; k++) {
      walk.push({ deg: steps[k], beat: bar * B + k, len: 0.9, accent: k === 0 ? 0.95 : 0.7 });
    }
  }
  play(tr, 'bass', walk, (f, d, acc) => I.bassPluck(f, d, {
    sr: SR, rand, amp: 0.26 * acc, decay: 0.32,
  }), { sc, octave: -1, pan: 0, rand });

  // --- percussion: kendang groove + shakers -------------------------------
  for (let bar = 0; bar < 32; bar++) {
    const hits = [
      [0, 'dum', 0.95], [1, 'tak', 0.5], [1.5, 'tak', 0.4], [2, 'dum', 0.7],
      [2.5, 'tak', 0.45], [3, 'tak', 0.6], [3.75, 'tak', bar % 2 ? 0.5 : 0.0],
    ];
    for (const [b, kind, a] of hits) {
      if (a <= 0) continue;
      const buf = kind === 'dum'
        ? I.drumLow(0, { sr: SR, amp: 0.24 * a, freq: 95, decay: 0.26, rand })
        : I.drumHigh(0, { sr: SR, amp: 0.16 * a, freq: 1900, decay: 0.045, rand });
      tr.place('perc', buf, Math.round(((bar * B + b) * tr.spb + rand.norm() * 0.008) * SR),
        { pan: kind === 'dum' ? 0 : rand.range(-0.4, 0.4) });
    }
    for (let s = 0; s < 8; s++) {
      if (bar < 4) break;
      tr.place('perc', I.shaker(0, { sr: SR, amp: (s % 2 ? 0.055 : 0.085), decay: 0.032, rand }),
        Math.round(((bar * B + s * 0.5) * tr.spb + rand.norm() * 0.006) * SR),
        { pan: rand.range(0.15, 0.55) });
    }
  }

  // Gong every 8 bars marks the gongan.
  for (const bar of [0, 8, 16, 24]) {
    tr.place('gong', I.gong(C.hz(sc.degree(0) - 12), { sr: SR, amp: 0.24, decay: 6.0, rand }), tr.at(bar, 0));
  }

  return {
    key: 'music-market',
    seed: 'melaka:music-market:v1',
    bpm: 104, bars: 32, beats: 4, mode: 'G mixolydian + slendro-inflected imbal',
    channels: tr.render({
      busFx: {
        rebab: room(0.85, 0.20), suling: room(0.9, 0.22),
        imbalA: room(0.8, 0.18), imbalB: room(0.8, 0.18), saron: room(0.85, 0.18),
        perc: room(0.6, 0.10), bass: room(0.5, 0.06), gong: room(1.3, 0.30),
      },
    }),
    sr: SR, loopSamples: tr.loopSamples,
  };
}

// ---------------------------------------------------------------------------
// Track 3 — music-church : "St Paul's"
// A aeolian, 54 BPM, 20 bars (88.9s). Organum in parallel fifths, bell tolls.
// ---------------------------------------------------------------------------

function musicChurch() {
  const rand = A.rng('melaka:music-church:v1');
  const tr = new C.Track({ sr: SR, bpm: 54, beats: 4, bars: 20, tail: 12 });
  const sc = C.scale('A3', 'aeolian');
  const B = 4;

  // Chant subject — slow, stepwise, hovering around the fifth. 4 bars.
  const chant = [
    { deg: 0, beat: 0, len: 3, accent: 0.8 },
    { deg: 1, beat: 3, len: 1, accent: 0.6 },
    { deg: 2, beat: 4, len: 3, accent: 0.8 },
    { deg: 1, beat: 7, len: 1, accent: 0.6 },
    { deg: 4, beat: 8, len: 4, accent: 0.9 },
    { deg: 3, beat: 12, len: 2, accent: 0.7 },
    { deg: 2, beat: 14, len: 2, accent: 0.75 },
  ];
  const chant2 = [
    { deg: 4, beat: 0, len: 3, accent: 0.85 },
    { deg: 5, beat: 3, len: 1, accent: 0.6 },
    { deg: 4, beat: 4, len: 4, accent: 0.85 },
    { deg: 2, beat: 8, len: 3, accent: 0.75 },
    { deg: 3, beat: 11, len: 1, accent: 0.6 },
    { deg: 1, beat: 12, len: 2, accent: 0.7 },
    { deg: 0, beat: 14, len: 2, accent: 0.85 },
  ];
  const shift = (ns, d, dd = 0) => ns.map((n) => Object.assign({}, n, { beat: n.beat + d, deg: n.deg + dd }));

  // vox principalis (bars 0-3 alone), then organum doubling at the fifth
  // (bars 4-11), then a third voice at the octave for the peak (12-19).
  const principal = shift(chant, 0)
    .concat(shift(chant2, 4 * B))
    .concat(shift(chant, 8 * B, 2))
    .concat(shift(chant2, 12 * B, 2))
    .concat(shift(chant, 16 * B))
    .concat([
      // cadence: 2 - 1 - 0 open fifth, landing on the downbeat of the loop
      { deg: 1, beat: 18 * B + 2, len: 2, accent: 0.7 },
      { deg: 0, beat: 19 * B, len: 4, accent: 0.85 },
    ]);

  const voxLow = (f, d, acc) => I.choir(f, d, {
    sr: SR, rand, amp: 0.115 * (0.6 + 0.4 * acc), attack: 0.55, release: 1.1,
    voices: 3, spread: 8, vowel: 'ah',
  });
  const voxHigh = (f, d, acc) => I.choir(f, d, {
    sr: SR, rand, amp: 0.085 * (0.6 + 0.4 * acc), attack: 0.7, release: 1.3,
    voices: 2, spread: 11, vowel: 'oo',
  });

  play(tr, 'voxA', principal, voxLow, { sc, octave: 0, pan: -0.2, rand, humanize: 0.03 });
  // organum at the fifth from bar 4
  play(tr, 'voxB', principal.filter((n) => n.beat >= 4 * B).map((n) => Object.assign({}, n, { deg: n.deg + 4 })),
    voxLow, { sc, octave: 0, pan: 0.22, rand, humanize: 0.035 });
  // octave voice for the peak
  play(tr, 'voxC', principal.filter((n) => n.beat >= 12 * B && n.beat < 18 * B),
    voxHigh, { sc, octave: 1, pan: 0.05, rand, humanize: 0.04 });

  // Sustained pedal: viola da gamba on A, then E under the peak.
  tr.place('pedal', I.drone(C.hz(sc.degree(0) - 12), tr.dur(12 * B), { sr: SR, amp: 0.055, attack: 3, release: 3, rand }), tr.at(0, 0));
  tr.place('pedal', I.drone(C.hz(sc.degree(4) - 12), tr.dur(6 * B), { sr: SR, amp: 0.045, attack: 2.5, release: 3, rand }), tr.at(12, 0));
  tr.place('pedal', I.drone(C.hz(sc.degree(0) - 12), tr.dur(2 * B), { sr: SR, amp: 0.05, attack: 1.5, release: 3, rand }), tr.at(18, 0));

  // Lute doubling the chant, quietly — the Portuguese thread inside the chapel.
  play(tr, 'lute', shift(chant, 8 * B, 2).concat(shift(chant2, 12 * B, 2)),
    (f, d, acc) => I.pluck(f, d, {
      sr: SR, rand, amp: 0.16 * acc, damping: 0.5, brightness: 0.35, release: 2.0,
    }), { sc, octave: 1, pan: -0.35, rand });

  // Bell tolls: bars 0, 5, 10, 15 — the hour over the hill.
  for (const bar of [0, 5, 10, 15]) {
    tr.place('bell', I.churchBell(C.hz(sc.degree(0) + 12), { sr: SR, amp: 0.22, decay: 9.0, rand }),
      tr.at(bar, 0), { pan: rand.range(-0.15, 0.15) });
  }
  // A lower answering bell at the midpoint.
  tr.place('bell', I.churchBell(C.hz(sc.degree(-3)), { sr: SR, amp: 0.16, decay: 11.0, rand }),
    tr.at(10, 2), { pan: 0.25 });

  return {
    key: 'music-church',
    seed: 'melaka:music-church:v1',
    bpm: 54, bars: 20, beats: 4, mode: 'A aeolian, parallel-fifth organum',
    channels: tr.render({
      busFx: {
        voxA: room(1.9, 0.42, 0.22), voxB: room(1.9, 0.42, 0.22), voxC: room(2.0, 0.46, 0.2),
        lute: room(1.8, 0.36), pedal: room(1.9, 0.30), bell: room(2.0, 0.48, 0.18),
      },
      masterGain: 1.05,
    }),
    sr: SR, loopSamples: tr.loopSamples,
  };
}

// ---------------------------------------------------------------------------
// Track 4 — music-waterfront : "The Quay"
// E dorian, 84 BPM, 6/8, 20 bars (85.7s). Rolling swell, creak and wave rhythm.
// ---------------------------------------------------------------------------

function musicWaterfront() {
  const rand = A.rng('melaka:music-waterfront:v1');
  const tr = new C.Track({ sr: SR, bpm: 84, beats: 6, bars: 20, tail: 9 });
  const sc = C.scale('E3', 'dorian');
  const pel = C.scale('E3', 'pelogBarang', { centsTable: C.PELOG_CENTS });
  const B = 6;

  // Germ in 6/8 — a rocking barcarolle figure.
  const germ = [
    { deg: 0, beat: 0, len: 1.5, accent: 0.9 },
    { deg: 2, beat: 1.5, len: 0.75, accent: 0.65 },
    { deg: 4, beat: 2.25, len: 0.75, accent: 0.7 },
    { deg: 3, beat: 3, len: 1.5, accent: 0.85 },
    { deg: 2, beat: 4.5, len: 0.75, accent: 0.6 },
    { deg: 1, beat: 5.25, len: 0.75, accent: 0.6 },
  ];
  const shift = (ns, d, dd = 0) => ns.map((n) => Object.assign({}, n, { beat: n.beat + d, deg: n.deg + dd }));

  const lead = []
    .concat(shift(germ, 2 * B))
    .concat(shift(germ, 3 * B, 2))
    .concat(shift(germ, 4 * B, 1))
    .concat([
      { deg: 4, beat: 5 * B, len: 3, accent: 0.9 },
      { deg: 3, beat: 5 * B + 3, len: 1.5, accent: 0.7 },
      { deg: 2, beat: 5 * B + 4.5, len: 1.5, accent: 0.75 },
    ])
    .concat(shift(germ, 6 * B))
    .concat(shift(germ, 7 * B, 3))
    // B section: the horizon opens — higher, longer notes
    .concat([
      { deg: 6, beat: 8 * B, len: 3, accent: 0.9 },
      { deg: 5, beat: 8 * B + 3, len: 3, accent: 0.8 },
      { deg: 4, beat: 9 * B, len: 4.5, accent: 0.85 },
      { deg: 6, beat: 9 * B + 4.5, len: 1.5, accent: 0.7 },
      { deg: 7, beat: 10 * B, len: 3, accent: 0.95 },
      { deg: 6, beat: 10 * B + 3, len: 1.5, accent: 0.7 },
      { deg: 4, beat: 10 * B + 4.5, len: 1.5, accent: 0.75 },
      { deg: 5, beat: 11 * B, len: 3, accent: 0.85 },
      { deg: 3, beat: 11 * B + 3, len: 3, accent: 0.8 },
    ])
    .concat(shift(germ, 12 * B))
    .concat(shift(germ, 13 * B, 2))
    .concat(shift(germ, 14 * B, 4))
    .concat([
      { deg: 4, beat: 15 * B, len: 3, accent: 0.9 },
      { deg: 2, beat: 15 * B + 3, len: 3, accent: 0.8 },
    ])
    .concat(shift(germ, 16 * B))
    .concat(shift(germ, 17 * B, 2))
    // cadence back to the top
    .concat([
      { deg: 4, beat: 18 * B, len: 3, accent: 0.85 },
      { deg: 3, beat: 18 * B + 3, len: 1.5, accent: 0.7 },
      { deg: 2, beat: 18 * B + 4.5, len: 1.5, accent: 0.7 },
      { deg: 1, beat: 19 * B, len: 3, accent: 0.75 },
      { deg: 0, beat: 19 * B + 3, len: 2.25, accent: 0.85 },
    ]);

  play(tr, 'gamba', lead, (f, d, acc) => I.bowed(f, d, {
    sr: SR, rand, amp: 0.19 * (0.6 + 0.4 * acc), bright: 0.42,
    vibRate: 4.4, vibDepth: 0.005, attack: 0.12, release: 0.28,
  }), { sc, octave: 0, pan: -0.22, rand, humanize: 0.02 });

  // Suling doubling an octave up over the B section only.
  play(tr, 'suling', lead.filter((n) => n.beat >= 8 * B && n.beat < 12 * B),
    (f, d, acc) => I.flute(f, d, { sr: SR, rand, amp: 0.13 * acc, breath: 0.08, attack: 0.09 }),
    { sc, octave: 1, pan: 0.3, rand, humanize: 0.03 });

  // Gamelan swell: gender arpeggio rolling like the tide, 3 notes per beat-pair
  const roll = [];
  for (let bar = 1; bar < 20; bar++) {
    const set = [0, 2, 4, 6, 4, 2];
    for (let k = 0; k < 6; k++) {
      roll.push({ deg: set[k] + (bar % 4 === 3 ? 1 : 0), beat: bar * B + k, len: 1, accent: k === 0 ? 0.75 : 0.45 });
    }
  }
  play(tr, 'gender', roll, (f, d, acc) => I.metallophone(f, d, {
    sr: SR, amp: 0.10 * acc, decay: 1.9, ombak: 1.9, tail: 1.4,
  }), { sc: pel, octave: 1, pan: 0.18, rand, cents: true, humanize: 0.012 });

  // Bass: root every bar, swelling in on the downbeat.
  const roots = [0, 0, 3, 3, 5, 5, 0, 4, 2, 2, 6, 6, 0, 3, 5, 4, 0, 3, 4, 0];
  play(tr, 'bass', roots.map((deg, bar) => ({ deg, beat: bar * B, len: 5, accent: 0.85 })),
    (f, d, acc) => I.bassPluck(f, d, { sr: SR, rand, amp: 0.28 * acc, decay: 1.6 }),
    { sc, octave: -1, pan: 0, rand });

  // Creak + swell percussion: a soft dum on 1 and 4 (the 6/8 rock), plus rope
  // creaks realised as short bowed glissandi high in the field.
  for (let bar = 0; bar < 20; bar++) {
    tr.place('perc', I.drumLow(0, { sr: SR, amp: 0.19, freq: 74, decay: 0.5, rand }), tr.at(bar, 0));
    tr.place('perc', I.drumLow(0, { sr: SR, amp: 0.11, freq: 74, decay: 0.4, rand }), tr.at(bar, 3));
    if (bar % 2 === 1) {
      tr.place('perc', I.drumHigh(0, { sr: SR, amp: 0.07, freq: 1200, decay: 0.09, rand }),
        tr.at(bar, 4.5), { pan: rand.range(-0.5, 0.5) });
    }
  }
  // Gong on the first bar of each 5-bar span (the tidal pulse).
  for (const bar of [0, 5, 10, 15]) {
    tr.place('gong', I.gong(C.hz(sc.degree(0) - 12), { sr: SR, amp: 0.26, decay: 7.5, rand }), tr.at(bar, 0));
  }

  return {
    key: 'music-waterfront',
    seed: 'melaka:music-waterfront:v1',
    bpm: 84, bars: 20, beats: 6, mode: 'E dorian, 6/8 barcarolle',
    channels: tr.render({
      busFx: {
        gamba: room(1.25, 0.28), suling: room(1.3, 0.30), gender: room(1.3, 0.30),
        bass: room(0.7, 0.10), perc: room(0.9, 0.18), gong: room(1.6, 0.36),
      },
    }),
    sr: SR, loopSamples: tr.loopSamples,
  };
}

// ---------------------------------------------------------------------------
// Track 5 — music-night : "Kampung After Dark"
// B aeolian, 60 BPM, 22 bars (88.0s). Sparse, gamelan-forward, warm.
// ---------------------------------------------------------------------------

function musicNight() {
  const rand = A.rng('melaka:music-night:v1');
  const tr = new C.Track({ sr: SR, bpm: 60, beats: 4, bars: 22, tail: 11 });
  const sc = C.scale('B2', 'aeolian');
  const pel = C.scale('B2', 'pelogLike', { centsTable: C.PELOG_CENTS });
  const B = 4;

  // Germ: four notes, wide spacing, lots of air.
  const germ = [
    { deg: 4, beat: 0, len: 2, accent: 0.7 },
    { deg: 2, beat: 2.5, len: 1.5, accent: 0.55 },
    { deg: 0, beat: 4, len: 3, accent: 0.75 },
    { deg: 1, beat: 7, len: 1, accent: 0.45 },
  ];
  const shift = (ns, d, dd = 0) => ns.map((n) => Object.assign({}, n, { beat: n.beat + d, deg: n.deg + dd }));

  const lead = []
    .concat(shift(germ, 0))
    .concat(shift(germ, 2 * B, 2))
    .concat(shift(germ, 4 * B, -1))
    .concat([
      { deg: 4, beat: 6 * B, len: 2, accent: 0.7 },
      { deg: 6, beat: 6 * B + 2, len: 2, accent: 0.65 },
      { deg: 5, beat: 7 * B, len: 3, accent: 0.7 },
      { deg: 4, beat: 7 * B + 3, len: 1, accent: 0.5 },
    ])
    // B: the flute answers, higher and slower
    .concat(shift(germ, 8 * B, 3))
    .concat(shift(germ, 10 * B, 1))
    .concat([
      { deg: 6, beat: 12 * B, len: 4, accent: 0.75 },
      { deg: 4, beat: 13 * B, len: 2, accent: 0.6 },
      { deg: 3, beat: 13 * B + 2, len: 2, accent: 0.6 },
    ])
    .concat(shift(germ, 14 * B))
    .concat(shift(germ, 16 * B, 2))
    .concat(shift(germ, 18 * B, -1))
    .concat([
      { deg: 2, beat: 20 * B, len: 3, accent: 0.65 },
      { deg: 1, beat: 20 * B + 3, len: 1, accent: 0.45 },
      { deg: 0, beat: 21 * B, len: 3, accent: 0.7 },
    ]);

  // Gender (soft metallophone) carries the tune at night.
  play(tr, 'gender', lead, (f, d, acc) => I.metallophone(f, d, {
    sr: SR, amp: 0.19 * (0.6 + 0.4 * acc), decay: 2.6, ombak: 1.6, tail: 2.2,
  }), { sc: pel, octave: 2, pan: -0.15, rand, cents: true, humanize: 0.02 });

  // Suling shadows the lead from bar 8 (the B limb).
  play(tr, 'suling', lead.filter((n) => n.beat >= 8 * B && n.beat < 14 * B),
    (f, d, acc) => I.flute(f, d, { sr: SR, rand, amp: 0.11 * acc, breath: 0.09, attack: 0.12, release: 0.25 }),
    { sc, octave: 2, pan: 0.3, rand, humanize: 0.035 });

  // Lute arpeggio, very quiet, an octave below — the human in the dark.
  const arp = [];
  for (let bar = 2; bar < 22; bar += 2) {
    const set = [0, 2, 4, 2];
    for (let k = 0; k < 4; k++) arp.push({ deg: set[k], beat: bar * B + k * 2, len: 2, accent: 0.45 });
  }
  play(tr, 'lute', arp, (f, d, acc) => I.pluck(f, d, {
    sr: SR, rand, amp: 0.20 * acc, damping: 0.55, brightness: 0.3, release: 2.2,
  }), { sc, octave: 1, pan: 0.34, rand });

  // Bass: sustained low root, changing every 4 bars.
  const lows = [0, 5, 3, 6, 0, 4];
  lows.forEach((deg, i) => {
    tr.place('bass', I.drone(C.hz(sc.degree(deg)), tr.dur(4 * B), { sr: SR, amp: 0.062, attack: 2.0, release: 2.4, rand }),
      tr.at(i * 4, 0), { pan: 0 });
  });

  // Gong ageng, twice — deep and slow.
  tr.place('gong', I.gong(C.hz(sc.degree(0) - 12), { sr: SR, amp: 0.28, decay: 10.0, rand }), tr.at(0, 0));
  tr.place('gong', I.gong(C.hz(sc.degree(3) - 12), { sr: SR, amp: 0.19, decay: 8.0, rand }), tr.at(11, 0));

  // A single soft frame-drum heartbeat every other bar from bar 6.
  for (let bar = 6; bar < 22; bar += 2) {
    tr.place('perc', I.drumLow(0, { sr: SR, amp: 0.10, freq: 66, decay: 0.55, rand }), tr.at(bar, 0));
  }

  return {
    key: 'music-night',
    seed: 'melaka:music-night:v1',
    bpm: 60, bars: 22, beats: 4, mode: 'B aeolian / pelog-inflected, sparse',
    channels: tr.render({
      busFx: {
        gender: room(1.5, 0.34), suling: room(1.5, 0.34), lute: room(1.4, 0.30),
        bass: room(1.2, 0.18), gong: room(1.7, 0.40), perc: room(1.1, 0.20),
      },
    }),
    sr: SR, loopSamples: tr.loopSamples,
  };
}

// ---------------------------------------------------------------------------
// Track 6 — music-tension : "Something Is Missing"
// E phrygian, 96 BPM, 24 bars (60.0s). Low drone, ostinato, dissonant clusters.
// ---------------------------------------------------------------------------

function musicTension() {
  const rand = A.rng('melaka:music-tension:v1');
  const tr = new C.Track({ sr: SR, bpm: 96, beats: 4, bars: 24, tail: 8 });
  const sc = C.scale('E3', 'phrygian');
  const pel = C.scale('E3', 'pelogLike', { centsTable: C.PELOG_CENTS });
  const B = 4;

  // Ostinato: E F E C — the phrygian b2 grinding against the tonic.
  const ost = [
    { deg: 0, beat: 0, len: 0.5, accent: 0.85 },
    { deg: 1, beat: 0.75, len: 0.5, accent: 0.6 },
    { deg: 0, beat: 1.5, len: 0.5, accent: 0.7 },
    { deg: -2, beat: 2.5, len: 0.5, accent: 0.65 },
    { deg: 0, beat: 3, len: 0.75, accent: 0.55 },
  ];
  const ostNotes = repeatBars(ost, 0, 24, B);
  play(tr, 'ost', ostNotes, (f, d, acc) => I.metallophone(f, d, {
    sr: SR, amp: 0.13 * acc, decay: 0.55, ombak: 4.2, tail: 0.5,
  }), { sc: pel, octave: 1, pan: -0.28, rand, cents: true, humanize: 0.007 });

  // Second ostinato voice a tritone-ish cluster above, entering bar 8.
  play(tr, 'ost2', repeatBars(ost, 8, 24, B).map((n) => Object.assign({}, n, { deg: n.deg + 3 })),
    (f, d, acc) => I.metallophone(f, d, {
      sr: SR, amp: 0.075 * acc, decay: 0.45, ombak: 5.6, tail: 0.45,
    }), { sc: pel, octave: 2, pan: 0.32, rand, cents: true, humanize: 0.009 });

  // Low drone on E across the whole loop, with a second drone on F from bar 12
  // — the semitone rub that makes the cue anxious.
  tr.place('drone', I.drone(C.hz(sc.degree(0) - 12), tr.dur(24 * B), { sr: SR, amp: 0.085, attack: 1.5, release: 2.5, rand }), tr.at(0, 0));
  tr.place('drone', I.drone(C.hz(sc.degree(1) - 12), tr.dur(8 * B), { sr: SR, amp: 0.045, attack: 2.5, release: 3.0, rand }), tr.at(12, 0));

  // Brass stabs: sparse, dotted, martial-anxious. Bars 4, 10, 16, 20-23.
  const stabs = [
    { deg: 0, beat: 4 * B, len: 0.75, accent: 0.9 },
    { deg: 1, beat: 4 * B + 1, len: 1.5, accent: 0.8 },
    { deg: 0, beat: 10 * B, len: 0.75, accent: 0.85 },
    { deg: -2, beat: 10 * B + 1, len: 1.5, accent: 0.75 },
    { deg: 4, beat: 16 * B, len: 0.75, accent: 0.95 },
    { deg: 3, beat: 16 * B + 1, len: 0.75, accent: 0.8 },
    { deg: 1, beat: 16 * B + 2, len: 2, accent: 0.9 },
    { deg: 0, beat: 20 * B, len: 1, accent: 0.85 },
    { deg: 1, beat: 21 * B, len: 1, accent: 0.9 },
    { deg: 3, beat: 22 * B, len: 1, accent: 0.95 },
    { deg: 4, beat: 23 * B, len: 2, accent: 1.0 },
  ];
  play(tr, 'brass', stabs, (f, d, acc) => I.reedBrass(f, d, {
    sr: SR, rand, amp: 0.17 * acc, cutoff: 1900, attack: 0.03,
  }), { sc, octave: 0, pan: 0.1, rand });

  // Bowed high line — a thin, held dissonance across the B limb.
  play(tr, 'strings', [
    { deg: 5, beat: 8 * B, len: 6, accent: 0.5 },
    { deg: 6, beat: 11 * B, len: 5, accent: 0.5 },
    { deg: 5, beat: 14 * B, len: 6, accent: 0.55 },
    { deg: 4, beat: 17 * B, len: 6, accent: 0.5 },
  ], (f, d, acc) => I.bowed(f, d, {
    sr: SR, rand, amp: 0.075 * acc, bright: 0.55, attack: 0.9, release: 0.8, vibDepth: 0.003,
  }), { sc, octave: 1, pan: -0.4, rand });

  // Heartbeat percussion — accelerating density in the last 8 bars.
  for (let bar = 0; bar < 24; bar++) {
    tr.place('perc', I.drumLow(0, { sr: SR, amp: 0.20, freq: 70, decay: 0.3, rand }), tr.at(bar, 0));
    tr.place('perc', I.drumLow(0, { sr: SR, amp: 0.12, freq: 70, decay: 0.24, rand }), tr.at(bar, 0.65));
    if (bar >= 16) {
      tr.place('perc', I.drumHigh(0, { sr: SR, amp: 0.09, freq: 2400, decay: 0.035, rand }),
        tr.at(bar, 2), { pan: rand.range(-0.45, 0.45) });
      tr.place('perc', I.drumHigh(0, { sr: SR, amp: 0.07, freq: 2400, decay: 0.035, rand }),
        tr.at(bar, 3.5), { pan: rand.range(-0.45, 0.45) });
    }
  }
  tr.place('gong', I.gong(C.hz(sc.degree(0) - 12), { sr: SR, amp: 0.24, decay: 6.5, rand }), tr.at(0, 0));
  tr.place('gong', I.gong(C.hz(sc.degree(1) - 12), { sr: SR, amp: 0.15, decay: 5.5, rand }), tr.at(12, 0));

  return {
    key: 'music-tension',
    seed: 'melaka:music-tension:v1',
    bpm: 96, bars: 24, beats: 4, mode: 'E phrygian, semitone-rub drone',
    channels: tr.render({
      busFx: {
        ost: room(0.9, 0.20), ost2: room(0.9, 0.22), brass: room(1.0, 0.20),
        strings: room(1.3, 0.30), drone: room(1.2, 0.20), perc: room(0.7, 0.12),
        gong: room(1.5, 0.34),
      },
    }),
    sr: SR, loopSamples: tr.loopSamples,
  };
}

// ---------------------------------------------------------------------------
// Track 7 — music-fortress : "A Famosa"
// D dorian, 88 BPM, 24 bars (65.5s). Martial, brass-tinged, dotted rhythm.
// ---------------------------------------------------------------------------

function musicFortress() {
  const rand = A.rng('melaka:music-fortress:v1');
  const tr = new C.Track({ sr: SR, bpm: 88, beats: 4, bars: 24, tail: 8 });
  const sc = C.scale('D3', 'dorian');
  const pel = C.scale('D3', 'pelogBarang', { centsTable: C.PELOG_CENTS });
  const B = 4;

  // Germ: a dotted fanfare — D . D A | B A F D
  const germ = [
    { deg: 0, beat: 0, len: 0.75, accent: 0.95 },
    { deg: 0, beat: 0.75, len: 0.25, accent: 0.6 },
    { deg: 4, beat: 1, len: 1, accent: 0.9 },
    { deg: 5, beat: 2, len: 0.75, accent: 0.8 },
    { deg: 4, beat: 2.75, len: 0.25, accent: 0.6 },
    { deg: 2, beat: 3, len: 1, accent: 0.85 },
    { deg: 0, beat: 4, len: 1.5, accent: 0.9 },
    { deg: -1, beat: 5.5, len: 0.5, accent: 0.6 },
    { deg: 0, beat: 6, len: 2, accent: 0.85 },
  ];
  const shift = (ns, d, dd = 0) => ns.map((n) => Object.assign({}, n, { beat: n.beat + d, deg: n.deg + dd }));

  const fanfare = []
    .concat(shift(germ, 0))
    .concat(shift(germ, 2 * B, 0))
    .concat(shift(germ, 4 * B, 3))
    .concat([
      { deg: 4, beat: 6 * B, len: 0.75, accent: 0.9 },
      { deg: 5, beat: 6 * B + 0.75, len: 0.25, accent: 0.6 },
      { deg: 6, beat: 6 * B + 1, len: 1, accent: 0.9 },
      { deg: 4, beat: 6 * B + 2, len: 2, accent: 0.85 },
      { deg: 2, beat: 7 * B, len: 1.5, accent: 0.8 },
      { deg: 0, beat: 7 * B + 2, len: 2, accent: 0.9 },
    ])
    // B limb: the view from the walls — broader, held
    .concat([
      { deg: 5, beat: 12 * B, len: 2, accent: 0.85 },
      { deg: 4, beat: 12 * B + 2, len: 2, accent: 0.8 },
      { deg: 2, beat: 13 * B, len: 3, accent: 0.85 },
      { deg: 4, beat: 13 * B + 3, len: 1, accent: 0.7 },
      { deg: 6, beat: 14 * B, len: 2, accent: 0.9 },
      { deg: 5, beat: 14 * B + 2, len: 2, accent: 0.8 },
      { deg: 4, beat: 15 * B, len: 4, accent: 0.9 },
    ])
    .concat(shift(germ, 16 * B))
    .concat(shift(germ, 18 * B, 2))
    .concat(shift(germ, 20 * B, 0))
    .concat([
      { deg: 5, beat: 22 * B, len: 1, accent: 0.9 },
      { deg: 4, beat: 22 * B + 1, len: 1, accent: 0.85 },
      { deg: 2, beat: 22 * B + 2, len: 2, accent: 0.85 },
      { deg: 1, beat: 23 * B, len: 1, accent: 0.7 },
      { deg: 0, beat: 23 * B + 1, len: 2, accent: 0.9 },
    ]);

  play(tr, 'brass', fanfare, (f, d, acc) => I.reedBrass(f, d, {
    sr: SR, rand, amp: 0.17 * (0.6 + 0.4 * acc), cutoff: 2500, attack: 0.028,
  }), { sc, octave: 0, pan: -0.2, rand, humanize: 0.009 });

  // Second brass at the fifth below from bar 4 — a real fanfare needs a pair.
  play(tr, 'brass2', fanfare.filter((n) => n.beat >= 4 * B).map((n) => Object.assign({}, n, { deg: n.deg - 3 })),
    (f, d, acc) => I.reedBrass(f, d, {
      sr: SR, rand, amp: 0.10 * acc, cutoff: 1700, attack: 0.035,
    }), { sc, octave: 0, pan: 0.26, rand, humanize: 0.011 });

  // Saron ostinato underneath — the colony's other half.
  const bal = [0, 2, 4, 5, 4, 2, 0, -1];
  const balNotes = [];
  for (let bar = 2; bar < 24; bar++) {
    for (let k = 0; k < 4; k++) {
      balNotes.push({ deg: bal[(bar * 4 + k) % bal.length], beat: bar * B + k, len: 1, accent: k === 0 ? 0.85 : 0.6 });
    }
  }
  play(tr, 'saron', balNotes, (f, d, acc) => I.metallophone(f, d, {
    sr: SR, amp: 0.13 * acc, decay: 0.9, ombak: 3.0, tail: 0.9,
  }), { sc: pel, octave: 1, pan: 0.22, rand, cents: true });

  // Bass: marching roots.
  const roots = [0, 0, 5, 5, 3, 3, 4, 4, 0, 0, 5, 5, 2, 2, 6, 4, 0, 0, 5, 3, 4, 4, 6, 0];
  const bassNotes = [];
  roots.forEach((deg, bar) => {
    bassNotes.push({ deg, beat: bar * B, len: 0.9, accent: 0.95 });
    bassNotes.push({ deg, beat: bar * B + 1.5, len: 0.5, accent: 0.6 });
    bassNotes.push({ deg: deg + 4, beat: bar * B + 2, len: 0.9, accent: 0.75 });
    bassNotes.push({ deg, beat: bar * B + 3, len: 0.9, accent: 0.7 });
  });
  play(tr, 'bass', bassNotes, (f, d, acc) => I.bassPluck(f, d, {
    sr: SR, rand, amp: 0.24 * acc, decay: 0.3,
  }), { sc, octave: -1, pan: 0, rand });

  // Military frame drum: dotted march.
  for (let bar = 0; bar < 24; bar++) {
    const hits = [
      [0, 'dum', 0.95], [0.75, 'tak', 0.45], [1, 'tak', 0.5],
      [2, 'dum', 0.75], [2.75, 'tak', 0.45], [3, 'tak', 0.5], [3.5, 'tak', 0.4],
    ];
    for (const [b, kind, a] of hits) {
      const buf = kind === 'dum'
        ? I.drumLow(0, { sr: SR, amp: 0.25 * a, freq: 88, decay: 0.22, rand })
        : I.drumHigh(0, { sr: SR, amp: 0.15 * a, freq: 2100, decay: 0.04, rand });
      tr.place('perc', buf, Math.round(((bar * B + b) * tr.spb + rand.norm() * 0.007) * SR),
        { pan: kind === 'dum' ? 0 : rand.range(-0.4, 0.4) });
    }
  }
  for (const bar of [0, 8, 16]) {
    tr.place('gong', I.gong(C.hz(sc.degree(0) - 12), { sr: SR, amp: 0.22, decay: 6.0, rand }), tr.at(bar, 0));
  }

  return {
    key: 'music-fortress',
    seed: 'melaka:music-fortress:v1',
    bpm: 88, bars: 24, beats: 4, mode: 'D dorian, dotted march',
    channels: tr.render({
      busFx: {
        brass: room(1.35, 0.28), brass2: room(1.35, 0.28), saron: room(1.2, 0.24),
        bass: room(0.7, 0.10), perc: room(1.0, 0.18), gong: room(1.6, 0.34),
      },
    }),
    sr: SR, loopSamples: tr.loopSamples,
  };
}

const TRACKS = {
  'music-main': musicMain,
  'music-market': musicMarket,
  'music-church': musicChurch,
  'music-waterfront': musicWaterfront,
  'music-night': musicNight,
  'music-tension': musicTension,
  'music-fortress': musicFortress,
};

module.exports = { TRACKS, SR };
