'use strict';
/**
 * MELAKA FORGE — PALETTE CANON
 * ============================
 * The single source of truth for colour in "A Famosa: Streets of Golden Melaka".
 *
 * Replaces the 184-colour `tools/ultima8-graphics/palette.cjs` (23 materials x 8
 * pure-value slides) and the 48-colour flat `master-palette.cjs`.
 *
 * DESIGN LAW
 * ----------
 * 1. NOTHING IS HAND-AUTHORED. Every colour is derived from a ramp SPEC below.
 *    Edit a spec, re-run, the whole world re-derives. No hex lists to drift.
 * 2. ONE SUN, ONE WORLD. A single key light: NW, ~30 deg above the horizon,
 *    warm amber (SUN_MIX). A single ambient: deep violet-blue sky bounce
 *    (SHADOW_ANCHOR #181830). Every ramp is lit by *those two lights only*.
 * 3. HUE ROTATES. Each ramp swings >= 20 deg of hue across its 5 steps:
 *    toward the violet shadow anchor at the dark end, toward the amber sun at
 *    the light end. This is the #1 fix for the old "pure value slide" look --
 *    a value slide reads as a greyscale image someone tinted; a hue-rotated
 *    ramp reads as a lit surface.
 * 4. SHADOWS CONVERGE, BUT STAY DISTINCT. Step 0 of every ramp is pulled a
 *    fixed fraction toward SHADOW_ANCHOR so all dark ends belong to the same
 *    night; they never actually reach it, so terracotta shadow != foliage
 *    shadow and 5-step ramps keep 5 usable steps.
 * 5. NO PURE GREY, NO PURE BLACK, NO PURE WHITE. Grey slides are the failure
 *    mode we are correcting. Outlines use a material's own step 0
 *    (hue-shifted dark), never #000.
 * 6. DETERMINISTIC. No Math.random, no Date.now. Same specs -> same bytes.
 *
 * CANON SIZE: 50 colours.
 *   40  8 material ramps x 5 steps
 *    4  tropical sky ramp
 *    2  shared lighting anchors (violet shadow, void)
 *    4  accents (Portuguese crimson, brass gold, lantern flame, sun specular)
 * Per-screen budget stays <= 40 (benchmark gate #14); no single plate uses
 * skin + all cloth accents + the full sky band at once.
 *
 * CLI
 *   node tools/forge/palette.cjs            print the canon as a table
 *   node tools/forge/palette.cjs --sheet    render docs/art-bible/forge/palette-sheet.png
 *   node tools/forge/palette.cjs --check    run the self-validation gates
 */

const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// SUN CANON  (matches the two salvageable plates: waterfront + rua-direita)
// ---------------------------------------------------------------------------
const SUN = Object.freeze({
  azimuthDeg: 315,       // NW, screen-space top-left
  elevationDeg: 30,      // ~30 deg above horizon -> long-ish but readable shadows
  keyHex: '#FFE9B4',     // warm amber key
  ambientHex: '#181830', // deep violet-blue sky bounce == SHADOW_ANCHOR
  shadowOffset: [1, 1],  // native-pixel cast direction (SE) per unit height
});

const SHADOW_ANCHOR_HEX = '#181830'; // the one shadow every ramp leans into
const VOID_ANCHOR_HEX = '#0C0C18';   // deepest AO / night interstitial
const SUN_MIX_HEX = SUN.keyHex;

const SHADOW_HUE = 250; // violet-blue: the hue every dark end rotates toward
const SUN_HUE = 42;     // amber:       the hue every light end rotates toward

// ---------------------------------------------------------------------------
// RAMP SPECS  -- the actual authored content of this file
// ---------------------------------------------------------------------------
// hue        base hue in degrees (the ramp's mid step)
// sat        base saturation 0..1 at the mid step
// vLo / vHi  value (HSV) at step 0 and step 4
// vGamma     >1 pushes steps toward the dark end (more shadow resolution)
// shadowRot  max degrees of rotation toward SHADOW_HUE at the dark end
// lightRot   max degrees of rotation toward SUN_HUE at the light end
// converge   how hard step 0 is pulled into SHADOW_ANCHOR (0..1)
// sunMix     how hard step 4 is pulled into SUN_MIX (0..1)
// steps      ramp length (5 for materials, 4 for sky/skin)
const RAMP_SPECS = [
  {
    key: 'whitewash', label: 'Whitewash / lime plaster',
    note: 'Portuguese colonial walls, church render, sailcloth.',
    // vGamma well under 1: plaster lives in the TOP half of the value range.
    // Only step 0 is a true shadow; steps 1-2 are the shaded face of a white
    // wall, which must still read white-ish or the whole city looks dirty.
    // High converge: a warm grey shadow on white plaster is the classic
    // amateur tell. Under a tropical sky, shade on lime render is COOL.
    hue: 40, sat: 0.15, vLo: 0.31, vHi: 0.97, vGamma: 0.68,
    shadowRot: 34, lightRot: 6, converge: 0.56, sunMix: 0.40, steps: 5,
  },
  {
    key: 'terracotta', label: 'Terracotta / laterite',
    note: 'Roof pans, fired brick, the fort\'s laterite blocks.',
    hue: 20, sat: 0.72, vLo: 0.22, vHi: 0.84, vGamma: 0.94,
    shadowRot: 32, lightRot: 14, converge: 0.34, sunMix: 0.15, steps: 5,
  },
  {
    key: 'stone', label: 'Stone (church / fort)',
    note: 'St Paul\'s masonry, A Famosa ashlar, cobbles, quay bollards.',
    // Cool base hue: rotating the LIGHT end toward the sun the short way runs
    // through cyan/green and turns sunlit masonry pond-coloured. So cool ramps
    // get a small lightRot and lean on sunMix (an RGB blend, hue-path-free) to
    // land a warm cream highlight.
    hue: 214, sat: 0.31, vLo: 0.19, vHi: 0.78, vGamma: 0.84,
    shadowRot: 24, lightRot: 5, converge: 0.40, sunMix: 0.44, steps: 5,
  },
  {
    key: 'timber', label: 'Timber / attap',
    note: 'Beams, planking, dhow hulls, palm thatch, bamboo.',
    hue: 28, sat: 0.60, vLo: 0.16, vHi: 0.74, vGamma: 1.0,
    shadowRot: 30, lightRot: 14, converge: 0.32, sunMix: 0.16, steps: 5,
  },
  {
    key: 'foliage', label: 'Foliage (jungle green)',
    note: 'Palms, banana, jungle canopy, kampung greenery.',
    hue: 104, sat: 0.66, vLo: 0.16, vHi: 0.73, vGamma: 1.02,
    shadowRot: 26, lightRot: 22, converge: 0.30, sunMix: 0.20, steps: 5,
  },
  {
    key: 'water', label: 'Water / strait',
    note: 'The Melaka Strait, harbour, river, wet stone.',
    hue: 198, sat: 0.74, vLo: 0.17, vHi: 0.70, vGamma: 0.96,
    shadowRot: 30, lightRot: 20, converge: 0.32, sunMix: 0.16, steps: 5,
  },
  {
    key: 'earth', label: 'Earth / sand (GOLDEN)',
    note: 'The "Golden" in Golden Melaka. Packed dirt streets, beach, dust.',
    hue: 38, sat: 0.60, vLo: 0.24, vHi: 0.92, vGamma: 0.86,
    shadowRot: 30, lightRot: 8, converge: 0.34, sunMix: 0.26, steps: 5,
  },
  {
    key: 'skin', label: 'Skin base (shared)',
    note: 'One shared ramp. Per-culture variants are HUE ROTATIONS of this ' +
          'ramp applied by remap-canon.cjs, never separate palettes.',
    hue: 24, sat: 0.46, vLo: 0.24, vHi: 0.84, vGamma: 0.95,
    shadowRot: 26, lightRot: 12, converge: 0.30, sunMix: 0.22, steps: 5,
  },
];

// Atmosphere ramp: kept separate from materials -- it is a light source, not a
// surface, so it does not converge to the shadow anchor.
const SKY_SPEC = {
  key: 'sky', label: 'Tropical sky',
  note: 'Horizon haze -> zenith. Day nominal #80C0F0 lands on step 2.',
  hue: 210, sat: 0.66, vLo: 0.40, vHi: 0.95, vGamma: 0.78,
  shadowRot: 20, lightRot: 8, converge: 0.16, sunMix: 0.40, steps: 4,
  atmosphere: true,
};

// Shared lighting anchors -- referenced by every generator for contact
// shadows, cast shadows, ambient occlusion and night interstitial fill.
const ANCHOR_SPECS = [
  { key: 'shadow-violet', hex: SHADOW_ANCHOR_HEX, label: 'Shadow anchor (shared)',
    note: 'Every ramp\'s dark end leans into this. Cast + contact shadows.' },
  { key: 'shadow-void', hex: VOID_ANCHOR_HEX, label: 'Void anchor',
    note: 'Deepest AO, night interstitial, doorway interiors. Never pure black.' },
];

// Accents -- small-area, high-chroma. Never used as ground or wall fills.
const ACCENT_SPECS = [
  { key: 'flag-crimson', hex: '#B01C28', label: 'Portuguese crimson',
    note: 'Flags, Cross of Christ, soldiers\' sashes, lacquer, wax seals.' },
  { key: 'brass-gold', hex: '#D8A428', label: 'Brass / gold',
    note: 'Cannon furniture, censers, coin, temple trim, banner fringe.' },
  { key: 'lantern-flame', hex: '#F5C860', label: 'Lantern flame',
    note: 'THE night practical. Baked light pools + lit windows use this.' },
  { key: 'sun-specular', hex: '#FFF4D4', label: 'Sun specular',
    note: 'Wet stone glints, metal hits, water sparkle. <1% of any screen.' },
];

// ---------------------------------------------------------------------------
// colour maths
// ---------------------------------------------------------------------------
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => {
    const h = clamp(Math.round(x), 0, 255).toString(16).toUpperCase();
    return h.length === 1 ? '0' + h : h;
  }).join('');
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1); v = clamp(v, 0, 1);
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-9) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max <= 1e-9 ? 0 : d / max, v: max };
}

/** Signed shortest rotation from `from` to `to`, capped at `maxDeg`. */
function rotateToward(from, to, maxDeg) {
  let d = ((to - from + 540) % 360) - 180;
  return clamp(d, -maxDeg, maxDeg);
}

function mixRgb(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/** Perceptual-ish luminance 0..255 (Rec.601 -- matches how pixel art reads). */
function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

/** Snap to a 4-unit grid: retro feel, and keeps hand-edits reproducible. */
function snap4(v) { return clamp(Math.round(v / 4) * 4, 0, 252); }

// ---------------------------------------------------------------------------
// ramp generation
// ---------------------------------------------------------------------------
const SHADOW_RGB = hexToRgb(SHADOW_ANCHOR_HEX);
const SUN_RGB = hexToRgb(SUN_MIX_HEX);

/**
 * Saturation across the ramp: mid steps carry the most chroma, highlights
 * bleach out under the tropical sun, shadows stay coloured (never grey).
 */
function satCurve(u) {
  return (1.22 - 0.46 * u) * (0.86 + 0.30 * Math.sin(Math.PI * u));
}

function buildRamp(spec) {
  const n = spec.steps;
  const dShadow = rotateToward(spec.hue, SHADOW_HUE, spec.shadowRot);
  const dLight = rotateToward(spec.hue, SUN_HUE, spec.lightRot);
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 1 : i / (n - 1);

    // value
    const v = spec.vLo + (spec.vHi - spec.vLo) * Math.pow(u, spec.vGamma);

    // hue: base + shadow rotation below the midpoint, + sun rotation above
    const h = u < 0.5
      ? spec.hue + dShadow * (1 - u * 2)
      : spec.hue + dLight * ((u - 0.5) * 2);

    const s = clamp(spec.sat * satCurve(u), 0, 1);

    let rgb = hsvToRgb(h, s, v);
    // dark end converges on the one shared shadow
    rgb = mixRgb(rgb, SHADOW_RGB, spec.converge * Math.pow(1 - u, 2.1));
    // light end takes the warm key
    rgb = mixRgb(rgb, SUN_RGB, spec.sunMix * Math.pow(u, 2.4));

    const r = snap4(rgb.r), g = snap4(rgb.g), b = snap4(rgb.b);
    out.push({
      hex: rgbToHex(r, g, b), r, g, b,
      ramp: spec.key, step: i,
      name: `${spec.key}-${i}`,
      role: i === 0 ? 'shadow' : i === n - 1 ? 'highlight' : i === 1 ? 'dark' : i === 2 ? 'base' : 'light',
    });
  }
  return { spec, colours: out, hueRotation: Math.abs(dLight - dShadow), dShadow, dLight };
}

// ---------------------------------------------------------------------------
// CANON assembly
// ---------------------------------------------------------------------------
const RAMPS = {};
const RAMP_META = {};
const CANON = [];

function pushRamp(spec) {
  const built = buildRamp(spec);
  RAMP_META[spec.key] = {
    key: spec.key, label: spec.label, note: spec.note,
    steps: spec.steps, hueRotation: built.hueRotation,
    dShadow: built.dShadow, dLight: built.dLight,
    atmosphere: !!spec.atmosphere, spec,
  };
  const hexes = [];
  built.colours.forEach((c) => {
    c.index = CANON.length;
    CANON.push(c);
    hexes.push(c.hex);
  });
  // named accessors so generators can read ramp.shadow / ramp.base / ramp.hi
  hexes.shadow = hexes[0];
  hexes.dark = hexes[1];
  hexes.base = hexes[Math.min(2, hexes.length - 1)];
  hexes.light = hexes[Math.min(3, hexes.length - 1)];
  hexes.hi = hexes[hexes.length - 1];
  hexes.key = spec.key;
  RAMPS[spec.key] = hexes;
}

RAMP_SPECS.forEach(pushRamp);
pushRamp(SKY_SPEC);

const ANCHORS = {};
ANCHOR_SPECS.forEach((a) => {
  const rgb = hexToRgb(a.hex);
  const c = {
    hex: a.hex.toUpperCase(), ...rgb, ramp: 'anchor', step: 0,
    name: a.key, role: 'anchor', label: a.label, note: a.note,
    index: CANON.length,
  };
  CANON.push(c);
  ANCHORS[a.key] = c.hex;
});

const ACCENTS = {};
ACCENT_SPECS.forEach((a) => {
  const rgb = hexToRgb(a.hex);
  const c = {
    hex: a.hex.toUpperCase(), ...rgb, ramp: 'accent', step: 0,
    name: a.key, role: 'accent', label: a.label, note: a.note,
    index: CANON.length,
  };
  CANON.push(c);
  ACCENTS[a.key] = c.hex;
});

Object.freeze(CANON);

// ---------------------------------------------------------------------------
// LEGACY MAP  old palette.cjs / master-palette.cjs name -> new ramp
// ---------------------------------------------------------------------------
// Existing generators (objects.cjs, tiles.cjs, characters.cjs) reference
// PALETTE.<name>[0..7]. remap-canon.cjs uses this table to translate a legacy
// 8-step index into a canon colour: legacyStep(i) -> ramp[round(i/7*(n-1))].
const LEGACY_MAP = {
  stone: { ramp: 'stone' },
  warmStone: { ramp: 'stone', hueNudge: +12 },
  terracotta: { ramp: 'terracotta' },
  whitewash: { ramp: 'whitewash' },
  wood: { ramp: 'timber' },
  lightWood: { ramp: 'timber', bias: +1 },
  thatch: { ramp: 'timber', bias: +1, hueNudge: +8 },
  jungle: { ramp: 'foliage' },
  grass: { ramp: 'foliage', bias: +1 },
  water: { ramp: 'water' },
  sky: { ramp: 'sky' },
  sand: { ramp: 'earth' },
  gold: { ramp: 'earth', bias: +1, accent: 'brass-gold' },
  turmericYellow: { ramp: 'earth', bias: +1, accent: 'brass-gold' },
  shadow: { anchor: 'shadow-void' },
  night: { anchor: 'shadow-violet' },
  specular: { accent: 'sun-specular' },
  fire: { accent: 'lantern-flame', ramp: 'terracotta' },
  skinPortuguese: { ramp: 'skin', hueNudge: +4, satScale: 0.95, bias: +1 },
  skinMalay: { ramp: 'skin', hueNudge: -4, satScale: 1.05 },
  skinChinese: { ramp: 'skin', hueNudge: +8, satScale: 0.80, bias: +1 },
  skinIndian: { ramp: 'skin', hueNudge: -6, satScale: 1.10, bias: -1 },
  clothRed: { accent: 'flag-crimson', ramp: 'terracotta' },
  lacquerRed: { accent: 'flag-crimson', ramp: 'terracotta' },
  clothBlue: { ramp: 'water', bias: -1 },
  indigo: { ramp: 'water', bias: -1, hueNudge: +18 },
  clothSilk: { ramp: 'terracotta', bias: -1, hueNudge: -18 },
};

/** Translate a legacy `PALETTE.<name>[i]` (i in 0..7) to a canon hex. */
function fromLegacy(name, legacyStep) {
  const m = LEGACY_MAP[name];
  if (!m) return null;
  if (m.anchor && legacyStep <= 3) return ANCHORS[m.anchor];
  if (m.accent && legacyStep >= 6 && !m.ramp) return ACCENTS[m.accent];
  const key = m.ramp || 'stone';
  const ramp = RAMPS[key];
  const n = ramp.length;
  let idx = Math.round((legacyStep / 7) * (n - 1)) + (m.bias || 0);
  return ramp[clamp(idx, 0, n - 1)];
}

// ---------------------------------------------------------------------------
// lookup API
// ---------------------------------------------------------------------------
const _byHex = new Map();
CANON.forEach((c) => _byHex.set(c.hex.toUpperCase(), c));

/** Canon index for an exact hex, or -1. */
function index(hex) {
  const c = _byHex.get(String(hex).toUpperCase().replace(/^([0-9A-F])/, '#$1'));
  if (c) return c.index;
  const norm = String(hex).toUpperCase();
  const c2 = _byHex.get(norm.startsWith('#') ? norm : '#' + norm);
  return c2 ? c2.index : -1;
}

const _nearestCache = new Map();
/**
 * Nearest canon colour to an arbitrary RGB.
 * Weighted RGB distance (2,4,3) approximates perceptual distance far better
 * than plain euclidean and stops greens collapsing into greys.
 * Optional `pool` restricts the search (e.g. only material ramps).
 */
function nearest(r, g, b, pool) {
  const list = pool || CANON;
  if (!pool) {
    const k = (r << 16) | (g << 8) | b;
    const hit = _nearestCache.get(k);
    if (hit !== undefined) return hit;
    let best = null, bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const dr = c.r - r, dg = c.g - g, db = c.b - b;
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < bestD) { bestD = d; best = c; }
    }
    _nearestCache.set(k, best);
    return best;
  }
  let best = null, bestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const dr = c.r - r, dg = c.g - g, db = c.b - b;
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** Ramp array (with .shadow/.dark/.base/.light/.hi) for a material or legacy name. */
function rampFor(material) {
  if (RAMPS[material]) return RAMPS[material];
  const m = LEGACY_MAP[material];
  if (m && m.ramp) return RAMPS[m.ramp];
  return null;
}

/** Quantize an ImageData-like {data,width,height} in place. Returns colours-used count. */
function quantizeImageData(img, pool) {
  const d = img.data;
  const used = new Set();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const c = nearest(d[i], d[i + 1], d[i + 2], pool);
    d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = 255;
    used.add(c.index);
  }
  return used.size;
}

// ordered Bayer 4x4 -- only legal on gradients wider than 20 native px
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// ---------------------------------------------------------------------------
// self-validation gates
// ---------------------------------------------------------------------------
function check() {
  const problems = [];
  const notes = [];

  Object.values(RAMP_META).forEach((m) => {
    if (m.hueRotation < 20) {
      problems.push(`ramp ${m.key}: hue rotation ${m.hueRotation.toFixed(1)} deg < 20 deg`);
    }
    const cols = CANON.filter((c) => c.ramp === m.key);
    // no pure-grey slide
    const maxSat = Math.max(...cols.map((c) => rgbToHsv(c.r, c.g, c.b).s));
    if (maxSat < 0.10) problems.push(`ramp ${m.key}: max saturation ${maxSat.toFixed(2)} -- reads grey`);
    // steps must stay distinguishable after snap4
    for (let i = 1; i < cols.length; i++) {
      const a = cols[i - 1], b = cols[i];
      const d = Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
      if (d < 14) problems.push(`ramp ${m.key}: steps ${i - 1}/${i} collapse (dist ${d.toFixed(1)})`);
      if (luma(b.r, b.g, b.b) - luma(a.r, a.g, a.b) < 8) {
        problems.push(`ramp ${m.key}: steps ${i - 1}/${i} lack value separation`);
      }
    }
    notes.push(`${m.key.padEnd(11)} rot ${m.hueRotation.toFixed(0).padStart(3)} deg  ` +
      `luma ${luma(cols[0].r, cols[0].g, cols[0].b).toFixed(0).padStart(3)} -> ` +
      `${luma(cols[cols.length - 1].r, cols[cols.length - 1].g, cols[cols.length - 1].b).toFixed(0).padStart(3)}`);
  });

  // canon uniqueness
  const seen = new Map();
  CANON.forEach((c) => {
    if (seen.has(c.hex)) problems.push(`duplicate hex ${c.hex}: ${seen.get(c.hex)} / ${c.name}`);
    seen.set(c.hex, c.name);
  });

  // no pure black or pure white
  CANON.forEach((c) => {
    if (c.r === 0 && c.g === 0 && c.b === 0) problems.push(`${c.name} is pure black`);
    if (c.r >= 252 && c.g >= 252 && c.b >= 252) problems.push(`${c.name} is pure white`);
  });

  return { problems, notes, size: CANON.length };
}

// ---------------------------------------------------------------------------
// CLI: swatch sheet
// ---------------------------------------------------------------------------
const SHEET_PATH = path.resolve(__dirname, '../../docs/art-bible/forge/palette-sheet.png');

function renderSheet(outPath = SHEET_PATH) {
  const { createCanvas } = require('canvas');

  const LABEL_W = 210;
  const SW = 128, SH = 86, GAP = 6;
  const MAXSTEPS = 5;
  const ROWS = Object.keys(RAMP_META).length + 2; // + anchors + accents
  const TOP = 108;
  const W = LABEL_W + MAXSTEPS * (SW + GAP) + 250;
  const H = TOP + ROWS * (SH + GAP) + 108;

  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#14141C';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#F0E4C8';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('MELAKA FORGE — PALETTE CANON', 24, 44);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#9AA8C0';
  ctx.fillText(
    `${CANON.length} colours · 8 material ramps × 5 + sky × 4 + 2 anchors + 4 accents · ` +
    `sun NW ${SUN.elevationDeg}° key ${SUN.keyHex} · ambient ${SUN.ambientHex}`, 24, 70);
  ctx.fillText('dark end rotates toward violet shadow anchor · light end toward amber sun · every ramp ≥20° of hue', 24, 92);

  function swatch(x, y, c, sub) {
    ctx.fillStyle = c.hex;
    ctx.fillRect(x, y, SW, SH);
    const L = luma(c.r, c.g, c.b);
    ctx.fillStyle = L > 128 ? 'rgba(20,20,28,0.85)' : 'rgba(245,240,225,0.9)';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(c.hex, x + 8, y + SH - 26);
    ctx.font = '12px sans-serif';
    ctx.fillText(sub, x + 8, y + SH - 9);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, SW - 1, SH - 1);
  }

  let y = TOP;
  Object.values(RAMP_META).forEach((m) => {
    const cols = CANON.filter((c) => c.ramp === m.key);
    ctx.fillStyle = m.atmosphere ? '#8AC8E8' : '#F0E4C8';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(m.key, 24, y + 24);
    ctx.fillStyle = '#8892A8';
    ctx.font = '12px sans-serif';
    ctx.fillText(m.label.slice(0, 30), 24, y + 43);
    ctx.fillText(m.note.slice(0, 34), 24, y + 60);
    ctx.fillStyle = '#5A6478';
    ctx.fillText(`hue ${m.spec.hue}° · rot ${m.hueRotation.toFixed(0)}°`, 24, y + 78);

    cols.forEach((c, i) => {
      swatch(LABEL_W + i * (SW + GAP), y, c, `${c.role} · #${c.index}`);
    });

    // ramp diagnostics on the right
    const x2 = LABEL_W + MAXSTEPS * (SW + GAP) + 12;
    const hs = cols.map((c) => rgbToHsv(c.r, c.g, c.b));
    ctx.fillStyle = '#7A8498';
    ctx.font = '12px monospace';
    ctx.fillText('hue ' + hs.map((h) => h.h.toFixed(0).padStart(3)).join(' '), x2, y + 26);
    ctx.fillText('sat ' + hs.map((h) => (h.s * 100).toFixed(0).padStart(3)).join(' '), x2, y + 44);
    ctx.fillText('val ' + cols.map((c) => luma(c.r, c.g, c.b).toFixed(0).padStart(3)).join(' '), x2, y + 62);
    y += SH + GAP;
  });

  // anchors
  ctx.fillStyle = '#C8B0F0';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('anchors', 24, y + 24);
  ctx.fillStyle = '#8892A8';
  ctx.font = '12px sans-serif';
  ctx.fillText('shared lighting — every ramp', 24, y + 43);
  ctx.fillText('dark end leans into these', 24, y + 60);
  CANON.filter((c) => c.ramp === 'anchor').forEach((c, i) => {
    swatch(LABEL_W + i * (SW + GAP), y, c, c.name);
  });
  y += SH + GAP;

  // accents
  ctx.fillStyle = '#F0B860';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('accents', 24, y + 24);
  ctx.fillStyle = '#8892A8';
  ctx.font = '12px sans-serif';
  ctx.fillText('small-area, high chroma —', 24, y + 43);
  ctx.fillText('never a ground or wall fill', 24, y + 60);
  CANON.filter((c) => c.ramp === 'accent').forEach((c, i) => {
    swatch(LABEL_W + i * (SW + GAP), y, c, c.name);
  });
  y += SH + GAP;

  // footer: the whole canon as a compact strip (what a screen actually pulls from)
  ctx.fillStyle = '#9AA8C0';
  ctx.font = '13px sans-serif';
  ctx.fillText('full canon strip (index order) — per-screen budget ≤40 of these', 24, y + 28);
  const stripW = Math.floor((W - 48) / CANON.length);
  CANON.forEach((c, i) => {
    ctx.fillStyle = c.hex;
    ctx.fillRect(24 + i * stripW, y + 40, stripW - 1, 40);
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, cv.toBuffer('image/png'));
  return outPath;
}

// ---------------------------------------------------------------------------
module.exports = {
  CANON, RAMPS, RAMP_META, RAMP_SPECS, SKY_SPEC, ANCHORS, ACCENTS,
  SUN, SHADOW_ANCHOR_HEX, VOID_ANCHOR_HEX, SUN_MIX_HEX, SHADOW_HUE, SUN_HUE,
  LEGACY_MAP, fromLegacy,
  index, nearest, rampFor, quantizeImageData,
  hexToRgb, rgbToHex, hsvToRgb, rgbToHsv, mixRgb, luma, clamp, rotateToward, snap4,
  BAYER4, check, renderSheet, SHEET_PATH,
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const res = check();
  if (argv.includes('--sheet')) {
    const p = renderSheet();
    console.log('wrote ' + path.relative(process.cwd(), p));
  }
  if (!argv.includes('--sheet') || argv.includes('--check')) {
    console.log(`canon: ${res.size} colours`);
    res.notes.forEach((n) => console.log('  ' + n));
    Object.values(RAMP_META).forEach((m) => {
      const cols = CANON.filter((c) => c.ramp === m.key);
      console.log(`  ${m.key.padEnd(11)} ${cols.map((c) => c.hex).join(' ')}`);
    });
    console.log(`  anchors     ${CANON.filter((c) => c.ramp === 'anchor').map((c) => c.hex).join(' ')}`);
    console.log(`  accents     ${CANON.filter((c) => c.ramp === 'accent').map((c) => c.hex).join(' ')}`);
  }
  if (res.problems.length) {
    console.error('\nFAILED GATES:');
    res.problems.forEach((p) => console.error('  ! ' + p));
    process.exitCode = 1;
  } else {
    console.log('\nall palette gates pass');
  }
}
