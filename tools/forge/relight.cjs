'use strict';
/**
 * MELAKA FORGE — RELIGHT (time-of-day LUT engine)
 * ===============================================
 * ONE master asset is authored at DAY. Dawn / dusk / night are produced by
 * remapping every canon index through a lookup table. Nothing is repainted,
 * nothing is alpha-blended at runtime, and — critically — the character tint
 * and the plate tint come from the SAME table, which is what kills the
 * "double-grade" (plate graded once at bake time, sprites graded again by a
 * runtime overlay, so nothing matches).
 *
 * WHY A LUT AND NOT A FILTER
 * --------------------------
 * A multiply/overlay filter moves every colour the same way, so night is just
 * "day, but darker" — a brown mush. A LUT lets each colour behave the way its
 * MATERIAL would behave:
 *   - whitewash at night goes moon-silver, not grey
 *   - foliage at night collapses almost to the shadow anchor (leaves have no
 *     practicals near them)
 *   - water at dusk REFLECTS THE SKY and gets *brighter* and more amber than
 *     it was at day, while everything around it darkens — the single strongest
 *     "this is a real evening" cue in the whole game
 *   - lantern-flame / brass / specular are PRACTICALS: they are exempt from
 *     value compression and get brighter relative to their surroundings
 *
 * THE MODEL (per time of day)
 *   1. value remap        v' = lo + (hi-lo) * v^gamma        (compression)
 *   2. saturation scale   s' = s * satMul
 *   3. split tone         shadows take the AMBIENT (sky bounce) colour,
 *                         highlights take the KEY colour; mixed by v.
 *   4. ramp overrides     per-material deviations (water reflects, foliage dies)
 *   5. practicals         exempt indices get lifted + kept warm
 *   6. cool guard (night) force b > r on every non-practical so night can
 *                         never drift brown
 *
 * SPATIAL BIAS
 * ------------
 * Dawn and dusk each emit TWO tables: `base` (away from the sun) and `sun`
 * (toward it). compose-plate/relight-asset lerp horizontally between them so a
 * plate gets a real cool->warm gradient across the frame instead of a flat
 * grade. Day and night emit one table (night's warmth comes from baked light
 * pools, not from a gradient).
 *
 * OUTPUT
 *   docs/art-bible/forge/relight-luts.json     hand-tunable; the shipped tables
 *   docs/art-bible/forge/relight-preview.png   visual proof (CLI --preview)
 *
 * CLI
 *   node tools/forge/relight.cjs                 write relight-luts.json
 *   node tools/forge/relight.cjs --preview       + render relight-preview.png
 *
 * API
 *   buildLuts()                    -> { day, dawn, dusk, night }
 *   lutFor(tod, variant)           -> Uint8 canon-index -> [r,g,b] table
 *   applyToImageData(img, tod, o)  -> relight an already-quantized image
 */

const fs = require('fs');
const path = require('path');
const P = require('./palette.cjs');

const {
  CANON, RAMPS, ACCENTS, ANCHORS,
  hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, mixRgb, luma, clamp,
} = P;

const OUT_DIR = path.resolve(__dirname, '../../docs/art-bible/forge');
const LUT_PATH = path.join(OUT_DIR, 'relight-luts.json');
const PREVIEW_PATH = path.join(OUT_DIR, 'relight-preview.png');

// Practicals: light SOURCES, not lit surfaces. Exempt from compression.
const PRACTICALS = new Set(['lantern-flame', 'sun-specular', 'brass-gold', 'flag-crimson']);
// flag-crimson is only half-exempt (a banner is lit, not emissive) -- see
// practicalStrength below.
const PRACTICAL_STRENGTH = {
  'lantern-flame': 1.00,
  'sun-specular': 0.85,
  'brass-gold': 0.70,
  'flag-crimson': 0.30,
};

// ---------------------------------------------------------------------------
// TIME-OF-DAY SPECS
// ---------------------------------------------------------------------------
// vLo/vHi/vGamma  value compression window (0..1 of original value)
// satMul          global saturation scale
// ambient         colour poured into the SHADOWS (the sky bounce)
// key             colour poured into the HIGHLIGHTS (the sun / moon)
// ambientW/keyW   how much of each
// hazeW           flat atmospheric wash toward `haze`, strongest in shadows
// sunBias         extra key weight for the `sun` variant (spatial gradient)
// rampOverrides   per-material deviation from the global model
const TOD_SPECS = {
  day: {
    label: 'Day — high tropical sun, NW key',
    vLo: 0.00, vHi: 1.00, vGamma: 1.00,
    satMul: 1.00,
    ambient: '#3A4A80', ambientW: 0.00,
    key: '#FFE9B4', keyW: 0.00,
    haze: '#B8D8D8', hazeW: 0.00,
    sunBias: 0.00,
    identity: true,
    rampOverrides: {},
  },

  dawn: {
    label: 'Dawn — sea mist, low cool sun rising off the strait',
    // Dawn is DIMMER than day and much softer. Blacks lift a little (mist
    // scatters light into the shadows) but the ceiling drops hard: nothing is
    // fully lit yet. Overall ~0.75x day luma.
    vLo: 0.045, vHi: 0.54, vGamma: 0.96,
    satMul: 0.66,                     // dawn is the DESATURATED time of day
    ambient: '#3A4C7C', ambientW: 0.60, ambientLift: 0.05,
    key: '#F8CCA4', keyW: 0.26, keyLift: 0.09,
    haze: '#68809E', hazeW: 0.13,     // the mist itself
    sunBias: 0.50,                    // `sun` variant: warm pink-gold east side
    sunKey: '#FFAE78',
    rampOverrides: {
      // wet-at-dawn: the strait is a flat pale mirror of a colourless sky.
      // reflectFloor makes even the dark water steps take the sky, not the
      // violet ambient -- that flatness IS what dawn water looks like.
      // water mirrors the sky, and at dawn the sky is still COLD -- so water
      // gets its own cold key. Handing it the warm sun key is what turns dawn
      // seas into that dead greenish grey.
      water: { vLo: 0.14, vHi: 0.50, vGamma: 0.76, satMul: 0.70, ambientW: 0.30, key: '#BCCCEC', keyW: 0.52, reflectFloor: 0.72, haze: '#7C96C8', hazeW: 0.22 },
      sky: { vLo: 0.22, vHi: 0.70, satMul: 0.62, ambientW: 0.24, key: '#D0D8EC', keyW: 0.54, reflectFloor: 0.80, haze: '#93A8C6', hazeW: 0.20 },
      // foliage holds its own colour better than anything else at dawn
      foliage: { vHi: 0.44, satMul: 0.88, ambientW: 0.50 },
      // plaster is the first thing the rising sun finds
      whitewash: { vHi: 0.62, keyW: 0.36 },
      stone: { vHi: 0.56, keyW: 0.32 },
      skin: { vHi: 0.58, satMul: 0.82, keyW: 0.32 },
    },
  },

  dusk: {
    label: 'Dusk — the golden hour, deep amber key, violet shadows',
    // Gamma well above 1 pushes the midrange DOWN: everything not directly hit
    // by the low sun falls into shadow. That value redistribution is what
    // "long shadows" looks like when you only have a LUT. The result must NOT
    // be a flat orange filter -- the SPREAD between shadow and lit is the
    // whole effect, so the ceiling stays high while the floor drops.
    vLo: 0.02, vHi: 0.86, vGamma: 1.55,
    satMul: 1.20,                     // dusk is the MOST saturated time of day
    ambient: '#2A1840', ambientW: 0.62, ambientLift: 0.02, // violet, not black
    key: '#FF9C3C', keyW: 0.58, keyLift: 0.14,
    haze: '#7A3830', hazeW: 0.12,
    sunBias: 0.28,
    sunKey: '#FF7A2C',
    rampOverrides: {
      // THE dusk shot: the strait stops being a dark blue field and becomes a
      // burning mirror of the sky -- BRIGHTER than at day, and amber, while
      // every solid surface around it darkens. reflectFloor 0.9 means even
      // water's deepest step reflects the sunset instead of taking ambient.
      water: { vLo: 0.34, vHi: 1.00, vGamma: 0.55, satMul: 1.40, ambientW: 0.18, keyW: 0.86, reflectFloor: 0.92, haze: '#FF8A3A', hazeW: 0.26 },
      sky: { vLo: 0.18, vHi: 1.00, vGamma: 0.70, satMul: 1.34, ambientW: 0.30, keyW: 0.78, reflectFloor: 0.85, haze: '#E86A34', hazeW: 0.28 },
      // plaster and stone are what the golden hour is FOR: they hold the light
      whitewash: { vHi: 0.94, vGamma: 1.30, keyW: 0.64, satMul: 1.24 },
      stone: { vHi: 0.88, vGamma: 1.34, keyW: 0.60, satMul: 1.28 },
      terracotta: { vHi: 0.86, keyW: 0.56, satMul: 1.26 },
      // wood, dirt and greenery drop into silhouette first -- this is the
      // contrast that stops dusk reading as a filter laid over everything
      timber: { vHi: 0.46, vGamma: 1.95, ambientW: 0.80, keyW: 0.34, keyLift: 0.06, satMul: 0.96 },
      earth: { vHi: 0.56, vGamma: 1.75, ambientW: 0.76, keyW: 0.42, keyLift: 0.08, satMul: 1.00 },
      foliage: { vHi: 0.50, vGamma: 1.95, ambientW: 0.70, satMul: 0.92, keyW: 0.34 },
      skin: { keyW: 0.56 },
    },
  },

  night: {
    label: 'Night — moonlit, value-compressed, warm practicals survive',
    // Hard compression into the bottom third of the range. This is the single
    // most important number in the file: if vHi goes much above 0.32 the scene
    // reads "overcast evening", not "night".
    vLo: 0.028, vHi: 0.27, vGamma: 1.34,
    satMul: 0.55,
    ambient: '#101838', ambientW: 0.70, ambientLift: 0.03,
    key: '#8FA8D8', keyW: 0.52, keyLift: 0.04,   // moonlight, cool silver-blue
    haze: '#121A38', hazeW: 0.26,
    sunBias: 0.00,
    coolGuard: 12,                    // force b - r >= 12 on every lit surface
    rampOverrides: {
      // moon hits plaster and stone hardest -- these are the shapes you
      // navigate by at night, so they get the widest window
      whitewash: { vHi: 0.44, keyW: 0.60, satMul: 0.48 },
      stone: { vHi: 0.38, keyW: 0.56, satMul: 0.52 },
      // water keeps a moon path: reflective, so even its dark steps catch it
      water: { vLo: 0.05, vHi: 0.37, keyW: 0.56, keyLift: 0.06, satMul: 0.82, reflectFloor: 0.50 },
      sky: { vLo: 0.05, vHi: 0.26, keyW: 0.26, satMul: 0.72, ambientW: 0.76 },
      // vegetation is a black mass at night -- but a VIOLET black mass
      foliage: { vHi: 0.18, ambientW: 0.84, satMul: 0.46, keyW: 0.22 },
      // timber and earth sit near lantern light: fractionally warmer than the
      // cool guard would otherwise allow
      timber: { vHi: 0.20, ambientW: 0.76, coolGuard: 3 },
      earth: { vHi: 0.20, ambientW: 0.76, coolGuard: 3 },
      skin: { vHi: 0.34, keyW: 0.36, coolGuard: 0 },   // faces stay readable
    },
  },
};

const TOD_ORDER = ['day', 'dawn', 'dusk', 'night'];

// ---------------------------------------------------------------------------
// the model
// ---------------------------------------------------------------------------
function resolveParams(spec, rampKey) {
  const o = (spec.rampOverrides && spec.rampOverrides[rampKey]) || {};
  return {
    vLo: o.vLo !== undefined ? o.vLo : spec.vLo,
    vHi: o.vHi !== undefined ? o.vHi : spec.vHi,
    vGamma: o.vGamma !== undefined ? o.vGamma : spec.vGamma,
    satMul: o.satMul !== undefined ? o.satMul : spec.satMul,
    ambient: o.ambient || spec.ambient,
    ambientW: o.ambientW !== undefined ? o.ambientW : spec.ambientW,
    ambientLift: o.ambientLift !== undefined ? o.ambientLift : (spec.ambientLift || 0),
    key: o.key || spec.key,
    keyW: o.keyW !== undefined ? o.keyW : spec.keyW,
    keyLift: o.keyLift !== undefined ? o.keyLift : (spec.keyLift || 0),
    haze: o.haze || spec.haze,
    hazeW: o.hazeW !== undefined ? o.hazeW : spec.hazeW,
    coolGuard: o.coolGuard !== undefined ? o.coolGuard : (spec.coolGuard || 0),
    // A REFLECTIVE surface does not take the key light in proportion to its
    // own local value -- it takes the colour of the SKY regardless of how dark
    // the surface itself is. Without this, dusk water keeps violet shadows in
    // its dark steps and the strait never catches fire.
    reflectFloor: o.reflectFloor !== undefined ? o.reflectFloor : 0,
  };
}

/** smoothstep 0..1 -- how "lit" a value counts as, for the split tone */
function litness(v) {
  const t = clamp((v - 0.12) / 0.76, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Split-tone in two SEPARATE operations, which is the whole trick:
 *   `w`    luminance-PRESERVING tint -- transfers the light's hue without
 *          changing how bright the surface is. This is what a coloured light
 *          actually does to a mid-tone.
 *   `lift` an ordinary blend that DOES brighten.
 * Fusing the two (a plain mix toward a bright key colour) is why naive
 * relighting makes night bright and dusk flat: every tint silently doubled as
 * an exposure change, so the value compression window meant nothing.
 */
function applyTint(rgb, hex, w, lift) {
  if (!w && !lift) return rgb;
  const t = hexToRgb(hex);
  const tl = Math.max(1, luma(t.r, t.g, t.b));
  let out = rgb;
  if (w) {
    const k = luma(rgb.r, rgb.g, rgb.b) / tl;
    out = mixRgb(out, { r: t.r * k, g: t.g * k, b: t.b * k }, w);
  }
  if (lift) out = mixRgb(out, t, lift);
  return out;
}

function relightColour(c, spec, variant) {
  if (spec.identity) return { r: c.r, g: c.g, b: c.b };

  const p = resolveParams(spec, c.ramp);
  const hsv = rgbToHsv(c.r, c.g, c.b);

  // 1. value compression
  const v2 = clamp(p.vLo + (p.vHi - p.vLo) * Math.pow(hsv.v, p.vGamma), 0, 1);
  // 2. saturation
  const s2 = clamp(hsv.s * p.satMul, 0, 1);
  let out = hsvToRgb(hsv.h, s2, v2);

  // 3. split tone: ambient into shadow, key into light
  let L = litness(hsv.v);
  if (p.reflectFloor) L = Math.max(L, p.reflectFloor);
  out = applyTint(out, p.ambient, p.ambientW * (1 - L), p.ambientLift * (1 - L));
  if (variant === 'sun' && spec.sunBias) {
    // the sun side of the frame: more key, and a hotter key colour
    const kw = clamp(p.keyW * L + spec.sunBias * (0.35 + 0.65 * L), 0, 1);
    out = applyTint(out, spec.sunKey || p.key, kw, p.keyLift * L * 1.5);
  } else {
    out = applyTint(out, p.key, p.keyW * L, p.keyLift * L);
  }

  // 4. atmospheric haze -- a real lift (scattered light), strongest on the
  //    dark/distant end where there is least surface luminance to compete
  if (p.hazeW) out = mixRgb(out, hexToRgb(p.haze), p.hazeW * (1 - 0.55 * L));

  // 5. practicals: light sources do not obey the compression window
  const strength = PRACTICAL_STRENGTH[c.name];
  if (strength) {
    // reassert the original colour, and at night push it ABOVE its day value
    const boost = spec.vHi < 0.6 ? 1.10 : 1.0;
    const orig = { r: c.r * boost, g: c.g * boost, b: c.b * boost };
    out = mixRgb(out, orig, strength);
  }

  // 6. cool guard: night can never go brown
  if (p.coolGuard && !strength) {
    const need = p.coolGuard;
    if (out.b - out.r < need) {
      const fix = (need - (out.b - out.r)) / 2;
      out.b += fix; out.r -= fix * 0.6;
    }
  }

  return {
    r: clamp(Math.round(out.r), 0, 255),
    g: clamp(Math.round(out.g), 0, 255),
    b: clamp(Math.round(out.b), 0, 255),
  };
}

/** Build every LUT. Returns { tod: { label, variants: { base:[[r,g,b]...] } } } */
function buildLuts() {
  const out = {};
  TOD_ORDER.forEach((tod) => {
    const spec = TOD_SPECS[tod];
    const variants = { base: CANON.map((c) => relightColour(c, spec, 'base')) };
    if (spec.sunBias) variants.sun = CANON.map((c) => relightColour(c, spec, 'sun'));
    out[tod] = {
      label: spec.label,
      gradient: spec.sunBias
        ? { axis: 'x', from: 'base', to: 'sun', note: 'lerp toward the sun side of the frame' }
        : null,
      variants,
    };
  });
  return out;
}

let _lutCache = null;
function lutFor(tod, variant = 'base') {
  if (!_lutCache) _lutCache = buildLuts();
  const t = _lutCache[tod] || _lutCache.day;
  return t.variants[variant] || t.variants.base;
}

/**
 * Relight an ImageData that is ALREADY quantized to the canon.
 * opts.gradient=true blends base->sun horizontally (dawn/dusk).
 */
function applyToImageData(img, tod, opts = {}) {
  const base = lutFor(tod, 'base');
  const sun = opts.gradient ? lutFor(tod, 'sun') : null;
  const d = img.data;
  const w = img.width;
  for (let i = 0, px = 0; i < d.length; i += 4, px++) {
    if (d[i + 3] === 0) continue;
    const c = P.nearest(d[i], d[i + 1], d[i + 2]);
    const a = base[c.index];
    if (sun) {
      // sun is NW: the warm side of the frame is the LEFT edge
      const t = 1 - (px % w) / Math.max(1, w - 1);
      const b = sun[c.index];
      d[i] = Math.round(a.r + (b.r - a.r) * t);
      d[i + 1] = Math.round(a.g + (b.g - a.g) * t);
      d[i + 2] = Math.round(a.b + (b.b - a.b) * t);
    } else {
      d[i] = a.r; d[i + 1] = a.g; d[i + 2] = a.b;
    }
    d[i + 3] = 255;
  }
  return img;
}

// ---------------------------------------------------------------------------
// self-validation
// ---------------------------------------------------------------------------
function check(luts) {
  const problems = [];
  const stats = {};
  const dayL = CANON.map((c) => luma(c.r, c.g, c.b));
  const dayMean = dayL.reduce((a, b) => a + b, 0) / dayL.length;

  TOD_ORDER.forEach((tod) => {
    const v = luts[tod].variants.base;
    const L = v.map((c) => luma(c.r, c.g, c.b));
    const mean = L.reduce((a, b) => a + b, 0) / L.length;
    // how many entries read blue (b > r) among non-practicals
    let cool = 0, warm = 0;
    CANON.forEach((c, i) => {
      if (PRACTICAL_STRENGTH[c.name]) return;
      if (v[i].b > v[i].r) cool++; else warm++;
    });
    stats[tod] = { mean: mean.toFixed(1), ratioOfDay: (mean / dayMean).toFixed(2), cool, warm };

    if (tod === 'night') {
      if (mean / dayMean > 0.45) problems.push(`night mean luma ${(mean / dayMean * 100).toFixed(0)}% of day -- not compressed enough`);
      if (warm > 2) problems.push(`night: ${warm} non-practical colours still read warm (b<=r) -- night is browning`);
      const lanternIdx = CANON.findIndex((c) => c.name === 'lantern-flame');
      if (luma(v[lanternIdx].r, v[lanternIdx].g, v[lanternIdx].b) < 150) {
        problems.push('night: lantern-flame practical is not bright enough to read as a light source');
      }
    }
    if (tod === 'dusk') {
      // water must be brighter and warmer at dusk than at day (sky reflection)
      const wIdx = CANON.filter((c) => c.ramp === 'water').map((c) => c.index);
      const dayW = wIdx.reduce((a, i) => a + luma(CANON[i].r, CANON[i].g, CANON[i].b), 0) / wIdx.length;
      const duskW = wIdx.reduce((a, i) => a + luma(v[i].r, v[i].g, v[i].b), 0) / wIdx.length;
      if (duskW <= dayW) problems.push(`dusk: water not reflecting the sky (luma ${duskW.toFixed(0)} <= day ${dayW.toFixed(0)})`);
      const warmW = wIdx.filter((i) => v[i].r > v[i].b).length;
      if (warmW < 3) problems.push(`dusk: only ${warmW}/5 water steps read warm`);
    }
    if (tod === 'dawn') {
      const sat = v.map((c) => rgbToHsv(c.r, c.g, c.b).s).reduce((a, b) => a + b, 0) / v.length;
      const daySat = CANON.map((c) => rgbToHsv(c.r, c.g, c.b).s).reduce((a, b) => a + b, 0) / CANON.length;
      if (sat > daySat * 0.92) problems.push('dawn: not desaturated relative to day');
      if (mean / dayMean > 0.90) problems.push(`dawn mean luma ${(mean / dayMean * 100).toFixed(0)}% of day -- dawn must be dimmer than noon`);
      if (mean / dayMean < 0.55) problems.push(`dawn mean luma ${(mean / dayMean * 100).toFixed(0)}% of day -- too dark, dawn is not night`);
    }
    if (tod === 'dusk') {
      // the effect is the SPREAD, not the average: dusk must have a wider
      // shadow-to-light range than day or it reads as an orange filter
      const spread = Math.max(...L) - Math.min(...L);
      const daySpread = Math.max(...dayL) - Math.min(...dayL);
      if (spread < daySpread * 0.92) problems.push(`dusk value spread ${spread.toFixed(0)} < day ${daySpread.toFixed(0)} -- reads as a flat filter`);
    }
    // no colour may go pure black at any time
    v.forEach((c, i) => {
      if (c.r + c.g + c.b < 12) problems.push(`${tod}: ${CANON[i].name} crushed to black`);
    });
  });

  return { problems, stats };
}

// ---------------------------------------------------------------------------
// preview render
// ---------------------------------------------------------------------------
const PLATE = path.resolve(__dirname, '../../assets/scenes/scene-waterfront.png');

async function renderPreview(luts, outPath = PREVIEW_PATH) {
  const { createCanvas, loadImage } = require('canvas');

  // --- load the real plate and knock it down to native 320x180 ------------
  const img = await loadImage(PLATE);
  const NW = 320, NH = 180;
  const src = createCanvas(NW, NH);
  const sctx = src.getContext('2d');
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(img, 0, 0, NW, NH);
  const nativeDay = sctx.getImageData(0, 0, NW, NH);
  // quantize to canon once; every ToD panel starts from this
  const usedCount = P.quantizeImageData(nativeDay);

  const PANEL_W = 320 * 2;          // draw the plate at 2x so it is readable
  const PANEL_H = 180 * 2;
  const SWATCH_COLS = 10, SWATCH_ROWS = 5;
  const CELL = 64;
  const SWATCH_H = SWATCH_ROWS * CELL;
  const PAD = 18;
  const HEAD = 96;
  const CAPTION = 34;

  const W = PAD + TOD_ORDER.length * (PANEL_W + PAD);
  const H = HEAD + CAPTION + PANEL_H + 16 + SWATCH_H + 78;

  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#101018';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#F0E4C8';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('MELAKA FORGE — RELIGHT LUTs', PAD, 46);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#93A0BC';
  ctx.fillText(
    `one authored DAY master → per-canon-index remap · ${CANON.length}-colour canon · ` +
    `waterfront plate quantized to ${usedCount} canon colours · same table drives plate AND sprites (no double-grade)`,
    PAD, 74);

  for (let t = 0; t < TOD_ORDER.length; t++) {
    const tod = TOD_ORDER[t];
    const spec = TOD_SPECS[tod];
    const lut = luts[tod];
    const x = PAD + t * (PANEL_W + PAD);

    // caption
    ctx.fillStyle = '#F0E4C8';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(tod.toUpperCase(), x, HEAD + 4);
    ctx.fillStyle = '#7E8AA6';
    ctx.font = '14px sans-serif';
    ctx.fillText(spec.label.replace(/^[^—]*— /, ''), x, HEAD + 24);

    // --- plate ------------------------------------------------------------
    const work = createCanvas(NW, NH);
    const wctx = work.getContext('2d');
    const id = wctx.createImageData(NW, NH);
    id.data.set(nativeDay.data);
    const base = lut.variants.base;
    const sun = lut.variants.sun;
    for (let py = 0; py < NH; py++) {
      for (let px = 0; px < NW; px++) {
        const i = (py * NW + px) * 4;
        const c = P.nearest(id.data[i], id.data[i + 1], id.data[i + 2]);
        const a = base[c.index];
        if (sun) {
          // sun is NW -> the warm side is the LEFT of the frame
          const g = 1 - px / (NW - 1);
          const b = sun[c.index];
          id.data[i] = Math.round(a.r + (b.r - a.r) * g);
          id.data[i + 1] = Math.round(a.g + (b.g - a.g) * g);
          id.data[i + 2] = Math.round(a.b + (b.b - a.b) * g);
        } else {
          id.data[i] = a.r; id.data[i + 1] = a.g; id.data[i + 2] = a.b;
        }
      }
    }
    wctx.putImageData(id, 0, 0);
    ctx.drawImage(work, x, HEAD + CAPTION, PANEL_W, PANEL_H);
    ctx.strokeStyle = '#2A2A38';
    ctx.strokeRect(x + 0.5, HEAD + CAPTION + 0.5, PANEL_W - 1, PANEL_H - 1);

    // --- canon grid -------------------------------------------------------
    const gy = HEAD + CAPTION + PANEL_H + 16;
    CANON.forEach((c, i) => {
      const col = i % SWATCH_COLS, row = Math.floor(i / SWATCH_COLS);
      const cx = x + col * CELL, cy = gy + row * CELL;
      const rc = base[i];
      ctx.fillStyle = rgbToHex(rc.r, rc.g, rc.b);
      ctx.fillRect(cx, cy, CELL - 2, CELL - 2);
      if (sun) {
        const sc = sun[i];
        ctx.fillStyle = rgbToHex(sc.r, sc.g, sc.b);
        ctx.beginPath();
        ctx.moveTo(cx + CELL - 2, cy);
        ctx.lineTo(cx + CELL - 2, cy + CELL - 2);
        ctx.lineTo(cx + CELL - 26, cy + CELL - 2);
        ctx.closePath();
        ctx.fill();
      }
    });

    // --- readout ----------------------------------------------------------
    const L = base.map((c) => luma(c.r, c.g, c.b));
    const mean = L.reduce((a, b) => a + b, 0) / L.length;
    const sat = base.map((c) => rgbToHsv(c.r, c.g, c.b).s).reduce((a, b) => a + b, 0) / base.length;
    let cool = 0;
    CANON.forEach((c, i) => { if (!PRACTICAL_STRENGTH[c.name] && base[i].b > base[i].r) cool++; });
    ctx.fillStyle = '#6E7A96';
    ctx.font = '14px monospace';
    const ry = gy + SWATCH_H + 22;
    ctx.fillText(`mean luma ${mean.toFixed(0).padStart(3)}   mean sat ${(sat * 100).toFixed(0).padStart(2)}%   cool ${cool}/${CANON.length - 4}`, x, ry);
    ctx.fillText(sun ? 'corner wedge = sun-side variant (spatial gradient)' : 'single table (no spatial gradient)', x, ry + 20);
    ctx.fillText(`water ramp: ${RAMPS.water.map((h, k) => rgbToHex(base[P.index(h)].r, base[P.index(h)].g, base[P.index(h)].b)).join(' ')}`, x, ry + 40);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, cv.toBuffer('image/png'));
  return outPath;
}

// ---------------------------------------------------------------------------
function writeLuts(luts, outPath = LUT_PATH) {
  const doc = {
    $schema: 'melaka-forge/relight-luts@1',
    generatedBy: 'tools/forge/relight.cjs (deterministic — regenerate, do not hand-merge)',
    hint: 'Values here are hand-tunable for a one-off fix, but the SPECS in relight.cjs are the source of truth. Re-running overwrites this file.',
    canonSize: CANON.length,
    canon: CANON.map((c) => ({ index: c.index, name: c.name, hex: c.hex, ramp: c.ramp, step: c.step })),
    sun: P.SUN,
    times: {},
  };
  TOD_ORDER.forEach((tod) => {
    const t = luts[tod];
    doc.times[tod] = {
      label: t.label,
      gradient: t.gradient,
      spec: TOD_SPECS[tod],
      variants: Object.fromEntries(Object.entries(t.variants).map(([k, arr]) => [
        k, arr.map((c) => rgbToHex(c.r, c.g, c.b)),
      ])),
    };
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
  return outPath;
}

module.exports = {
  TOD_SPECS, TOD_ORDER, PRACTICAL_STRENGTH,
  buildLuts, lutFor, applyToImageData, relightColour,
  check, writeLuts, renderPreview, LUT_PATH, PREVIEW_PATH,
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const luts = buildLuts();
  const res = check(luts);
  const p = writeLuts(luts);
  console.log('wrote ' + path.relative(process.cwd(), p));
  TOD_ORDER.forEach((t) => {
    const s = res.stats[t];
    console.log(`  ${t.padEnd(6)} mean luma ${String(s.mean).padStart(5)} (${s.ratioOfDay}x day)  cool ${s.cool}  warm ${s.warm}`);
  });
  const run = async () => {
    if (argv.includes('--preview')) {
      const pp = await renderPreview(luts);
      console.log('wrote ' + path.relative(process.cwd(), pp));
    }
    if (res.problems.length) {
      console.error('\nFAILED GATES:');
      res.problems.forEach((x) => console.error('  ! ' + x));
      process.exitCode = 1;
    } else {
      console.log('\nall relight gates pass');
    }
  };
  run();
}
