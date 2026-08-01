'use strict';
/**
 * MELAKA FORGE — PORTRAIT COLOUR
 * ==============================
 * Every colour a portrait can use, derived from the canon in
 * `tools/forge/palette.cjs`. Two categories:
 *
 *  1. CANON EXACTLY — cloth, metal, hair, backdrops. Straight ramp steps and
 *     accents, no modification.
 *  2. SKIN — the canon `skin` ramp SPEC re-derived with a per-culture hue /
 *     saturation / value offset, using the identical ramp maths as
 *     `palette.cjs` (same sun, same shadow anchor, same convergence, same
 *     4-unit snap). This is the sanctioned exception: the canon note on the
 *     skin ramp says per-culture variants are hue rotations of it.
 *
 * The green-Aminah bug came from a portrait reading the `foliage` ramp for
 * skin. Skin can now ONLY come from `skinRamp()`, which can only come from the
 * skin spec.
 */

const P = require('../palette.cjs');

const { RAMPS, ACCENTS, ANCHORS, RAMP_META, SHADOW_HUE, SUN_HUE,
  SHADOW_ANCHOR_HEX, SUN_MIX_HEX,
  hexToRgb, rgbToHex, hsvToRgb, mixRgb, rotateToward, snap4, clamp, luma } = P;

const SHADOW_RGB = hexToRgb(SHADOW_ANCHOR_HEX);
const SUN_RGB = hexToRgb(SUN_MIX_HEX);

// identical to palette.cjs satCurve — kept in lockstep by construction
function satCurve(u) { return (1.22 - 0.46 * u) * (0.86 + 0.30 * Math.sin(Math.PI * u)); }

function deriveRamp(spec) {
  const n = spec.steps;
  const dShadow = rotateToward(spec.hue, SHADOW_HUE, spec.shadowRot);
  const dLight = rotateToward(spec.hue, SUN_HUE, spec.lightRot);
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 1 : i / (n - 1);
    const v = spec.vLo + (spec.vHi - spec.vLo) * Math.pow(u, spec.vGamma);
    const h = u < 0.5 ? spec.hue + dShadow * (1 - u * 2) : spec.hue + dLight * ((u - 0.5) * 2);
    const s = clamp(spec.sat * satCurve(u), 0, 1);
    let rgb = hsvToRgb(h, s, v);
    rgb = mixRgb(rgb, SHADOW_RGB, spec.converge * Math.pow(1 - u, 2.1));
    rgb = mixRgb(rgb, SUN_RGB, spec.sunMix * Math.pow(u, 2.4));
    out.push(rgbToHex(snap4(rgb.r), snap4(rgb.g), snap4(rgb.b)));
  }
  return out;
}

const SKIN_SPEC = RAMP_META.skin.spec;

// ---------------------------------------------------------------------------
// per-culture skin: offsets on the ONE canon skin spec
// ---------------------------------------------------------------------------
// dh  hue offset (deg)   ds  saturation offset   dLo/dHi  value-end offsets
const SKIN_OFFSETS = {
  portuguese:      { dh: +3, ds: -0.07, dLo: +0.03, dHi: +0.07 },
  'portuguese-sun':{ dh: +1, ds: +0.02, dLo: +0.01, dHi: -0.01 }, // weathered, outdoor
  malay:           { dh: -2, ds: +0.06, dLo: +0.00, dHi: -0.04 },
  chinese:         { dh: +7, ds: -0.04, dLo: +0.02, dHi: +0.03 },
  arab:            { dh: -1, ds: +0.04, dLo: +0.01, dHi: -0.02 },
  tamil:           { dh: -3, ds: +0.08, dLo: -0.01, dHi: -0.09 },
};

const _skinCache = new Map();
function skinRamp(culture) {
  const key = SKIN_OFFSETS[culture] ? culture : 'malay';
  if (_skinCache.has(key)) return _skinCache.get(key);
  const o = SKIN_OFFSETS[key];
  const ramp = deriveRamp({
    ...SKIN_SPEC,
    hue: SKIN_SPEC.hue + o.dh,
    sat: SKIN_SPEC.sat + o.ds,
    vLo: SKIN_SPEC.vLo + o.dLo,
    vHi: SKIN_SPEC.vHi + o.dHi,
  });
  ramp.shadow = ramp[0]; ramp.dark = ramp[1]; ramp.base = ramp[2];
  ramp.light = ramp[3]; ramp.hi = ramp[4];
  _skinCache.set(key, ramp);
  return ramp;
}

/** Every skin hex the pipeline may emit — used by the off-palette gate. */
function allSkinHexes() {
  return Object.keys(SKIN_OFFSETS).flatMap((c) => Array.from(skinRamp(c)));
}

// ---------------------------------------------------------------------------
// CLOTH / HAIR / METAL — canon steps only, assembled into 4-step working ramps
// ---------------------------------------------------------------------------
const R = RAMPS;
const V = ANCHORS['shadow-void'];      // #0C0C18
const SH = ANCHORS['shadow-violet'];   // #181830

/** m[0] deepest -> m[3] highlight. All entries are canon hexes. */
const MATS = {
  // --- cloth -------------------------------------------------------------
  'linen-white':   [R.whitewash[1], R.whitewash[2], R.whitewash[3], R.whitewash[4]],
  'linen-cream':   [R.earth[1], R.earth[2], R.earth[3], R.earth[4]],
  'wool-black':    [V, SH, R.stone[1], R.stone[2]],
  'wool-charcoal': [SH, R.stone[1], R.stone[2], R.stone[3]],
  'wool-indigo':   [R.water[0], R.water[1], R.water[2], R.water[3]],
  'wool-crimson':  [R.terracotta[0], R.terracotta[1], ACCENTS['flag-crimson'], R.terracotta[2]],
  'wool-rust':     [R.terracotta[0], R.terracotta[1], R.terracotta[2], R.terracotta[3]],
  'silk-teal':     [R.water[1], R.water[2], R.water[3], R.water[4]],
  'silk-green':    [R.foliage[1], R.foliage[2], R.foliage[3], R.foliage[4]],
  'cotton-ochre':  [R.earth[0], R.earth[1], R.earth[2], R.earth[3]],
  'cotton-brown':  [R.timber[0], R.timber[1], R.timber[2], R.timber[3]],
  'batik-plum':    [R.terracotta[0], R.terracotta[1], R.timber[2], R.earth[2]],
  // --- hair --------------------------------------------------------------
  'hair-black':    [V, V, SH, R.stone[1]],
  'hair-darkbrown':[V, R.timber[0], R.timber[1], R.timber[2]],
  'hair-brown':    [R.timber[0], R.timber[0], R.timber[1], R.timber[2]],
  'hair-grey':     [R.stone[0], R.stone[1], R.stone[2], R.stone[3]],
  'hair-silver':   [R.stone[1], R.stone[2], R.stone[3], R.whitewash[3]],
  'hair-saltpep':  [R.timber[0], R.timber[1], R.timber[2], R.stone[3]],
  // --- hard materials ----------------------------------------------------
  'steel':         [R.stone[0], R.stone[1], R.stone[3], R.whitewash[4]],
  'brass':         [R.timber[1], R.terracotta[2], ACCENTS['brass-gold'], R.earth[4]],
  'leather':       [R.timber[0], R.timber[1], R.timber[2], R.earth[2]],
  'stone-wall':    [R.stone[1], R.stone[2], R.stone[3], R.stone[4]],
  'timber-wall':   [R.timber[1], R.timber[2], R.timber[3], R.timber[4]],
};

function mat(name) {
  const m = MATS[name];
  if (!m) throw new Error('unknown material: ' + name);
  return m;
}

/** Backdrops are strictly two flat canon values — no gradients, ever. */
const BACKDROPS = {
  'warehouse-timber': [R.timber[1], R.timber[2]],
  'fort-stone':       [R.stone[1], R.stone[2]],
  'church-stone':     [R.stone[1], R.stone[2]],
  'church-dim':       [SH, R.stone[1]],
  'market-awning':    [R.earth[1], R.whitewash[2]],
  'harbour-sky':      [R.sky[1], R.sky[2]],
  'counting-house':   [R.whitewash[1], R.whitewash[2]],
  'ledger-shelf':     [R.timber[1], R.stone[1]],
  'kampung-attap':    [R.timber[1], R.foliage[1]],
  'street-wall':      [R.earth[1], R.earth[2]],
  'tin-store':        [R.stone[1], R.stone[2]],
  'textile-bolts':    [R.terracotta[1], R.terracotta[2]],
  'river-edge':       [R.water[2], R.water[3]],
  'gate-shadow':      [R.stone[1], R.earth[1]],
};

function backdrop(name) {
  const b = BACKDROPS[name];
  if (!b) throw new Error('unknown backdrop: ' + name);
  return b;
}

/** Canon membership check for the off-palette gate. */
const CANON_SET = new Set(P.CANON.map((c) => c.hex.toUpperCase()));
const SKIN_SET = new Set(allSkinHexes().map((h) => h.toUpperCase()));
function isLegal(hex) {
  const h = String(hex).toUpperCase();
  return CANON_SET.has(h) || SKIN_SET.has(h);
}

module.exports = {
  skinRamp, allSkinHexes, SKIN_OFFSETS,
  MATS, mat, BACKDROPS, backdrop,
  RAMPS: R, ACCENTS, ANCHORS, VOID: V, SHADOW: SH,
  isLegal, CANON_SET, SKIN_SET, luma, deriveRamp,
};
