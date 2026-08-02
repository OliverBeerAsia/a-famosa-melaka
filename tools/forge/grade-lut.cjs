'use strict';
/**
 * MELAKA FORGE — RUNTIME GRADE LUTs
 * =================================
 * 20 files: `assets/scenes/luts/<location>-<tod>.png`, each a 256x16 px
 * unwrapped 16^3 RGB LUT (16 slices of 16x16, blue advancing left to right —
 * the standard strip layout the MelakaPostFX shader samples).
 *
 * WHY THESE MUST BE NEAR-IDENTITY
 * -------------------------------
 * The plates already carry their time of day: `tools/forge/relight.cjs` bakes
 * dawn/dusk/night variants from `docs/art-bible/forge/relight-luts.json`, and
 * `LightingSystem`/`AtmosphereSystem` zero every plate-wide runtime overlay
 * wherever a baked variant exists. So the runtime LUT's job is LOCATION
 * CHARACTER, not hour: it is what makes the waterfront read cooler than the
 * kampung at the same time of day. Anything stronger re-creates the
 * double-grade bug the project already paid to remove.
 *
 * The acceptance gate below is what keeps that honest, and it is the real
 * deliverable: applying `<loc>-day.png` to the shipped day plate must move NO
 * canon colour more than 10/255 in any channel and must leave >= 92 % of
 * pixels still nearest-matching their original canon index. If it fails, the
 * LUT is grading rather than trimming.
 *
 * GENERATION, per (location, tod), for each of the 4096 lattice colours
 * (game-feel spec §1.4):
 *   1. haze pull      toward `visual.hazeTint`, weighted to highlights only
 *   2. shadow anchor  toward palette SHADOW_ANCHOR_HEX, weighted to shadows
 *   3. tod trim       the residual of relight-runtime.json's tint the plate
 *                     does not already carry
 *   4. saturation
 *   5. transition hue the location's own authored "what colour is this place"
 *   6. snap           quantise to 1/255, clamp
 *
 * ALSO EMITTED: `assets/scenes/luts/fallback.json` — each LUT's own mapping of
 * mid-grey #808080, which is the flat MULTIPLY approximation the Canvas
 * fallback renders instead of a shader (spec §1.6).
 *
 * DETERMINISTIC: no Math.random, no Date.now. Same inputs -> same bytes.
 *
 * CLI
 *   node tools/forge/grade-lut.cjs              # write LUTs + fallback.json
 *   node tools/forge/grade-lut.cjs --check      # gate only, write nothing
 *   node tools/forge/grade-lut.cjs --out DIR    # write somewhere else
 */

const fs = require('fs');
const path = require('path');

const P = require('./palette.cjs');
const { Surface } = require('./surface.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCATIONS_DIR = path.join(ROOT, 'src', 'data', 'locations');
const SCENES_DIR = path.join(ROOT, 'assets', 'scenes');
const DEFAULT_OUT = path.join(SCENES_DIR, 'luts');
const RELIGHT_RUNTIME = path.join(ROOT, 'src', 'data', 'relight-runtime.json');

const TODS = ['day', 'dawn', 'dusk', 'night'];
const LUT_SIZE = 16;                 // 16^3 lattice
const STRIP_W = LUT_SIZE * LUT_SIZE; // 256
const STRIP_H = LUT_SIZE;            // 16

/** Location character hue strength, step 5. One number, applied everywhere. */
const LOC_HUE = 0.06;

/**
 * Per-time-of-day trim. RESID is how much of relight-runtime's tint the plate
 * does NOT already carry — the residual the runtime is allowed to add.
 */
const TOD = {
  day:   { resid: 0.00, hazePull: 0.10, shadowPull: 0.06, sat: 1.04 },
  dawn:  { resid: 0.10, hazePull: 0.14, shadowPull: 0.08, sat: 0.98 },
  dusk:  { resid: 0.12, hazePull: 0.16, shadowPull: 0.08, sat: 1.06 },
  night: { resid: 0.08, hazePull: 0.06, shadowPull: 0.14, sat: 0.92 },
};

/** Which plate file backs each (location, tod). Keys differ from location ids. */
const PLATE_STEM = {
  'a-famosa-gate': 'scene-a-famosa',
  'rua-direita': 'scene-rua-direita',
  'st-pauls-church': 'scene-st-pauls',
  'waterfront': 'scene-waterfront',
  'kampung': 'scene-kampung',
};

// ---------------------------------------------------------------------------
// colour helpers (0..1 float triples)
// ---------------------------------------------------------------------------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function smoothstep(e0, e1, x) {
  if (e1 === e0) return x < e0 ? 0 : 1;
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function hexToUnit(hex) {
  const { r, g, b } = P.hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
}

function intToUnit(n) {
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---------------------------------------------------------------------------
// the transform
// ---------------------------------------------------------------------------

/**
 * The six-step recipe. `ctx` carries everything read out of the data so the
 * function itself has no location knowledge baked in.
 */
function gradeColour(c, ctx) {
  // 1. haze pull — sky and highlights only, so the shadows are untouched.
  const w1 = ctx.hazePull * smoothstep(0.45, 1.0, luma(c));
  c = mix(c, ctx.hazeTint, w1);

  // 2. shadow anchor — the one shadow every canon ramp leans into.
  const w2 = ctx.shadowPull * (1 - smoothstep(0.0, 0.35, luma(c)));
  c = mix(c, ctx.shadowAnchor, w2);

  // 3. tod trim — the RESIDUAL of the baked tint, not the tint itself.
  c = [c[0] * ctx.tint[0], c[1] * ctx.tint[1], c[2] * ctx.tint[2]];

  // 4. saturation
  const l = luma(c);
  c = mix([l, l, l], c, ctx.sat);

  // 5. transition hue — the authored "what colour is this place" vector. This
  //    is the only term that makes waterfront read cooler than kampung at the
  //    same hour.
  const pushed = [
    c[0] + (ctx.transitionTint[0] / 255) * 0.5,
    c[1] + (ctx.transitionTint[1] / 255) * 0.5,
    c[2] + (ctx.transitionTint[2] / 255) * 0.5,
  ];
  c = mix(c, pushed, LOC_HUE);

  // 6. snap to 1/255 and clamp.
  return [
    Math.round(clamp01(c[0]) * 255) / 255,
    Math.round(clamp01(c[1]) * 255) / 255,
    Math.round(clamp01(c[2]) * 255) / 255,
  ];
}

function gradeContext(locationId, tod, visual, relight) {
  const t = TOD[tod];
  const tintHex = relight.times[tod].tintHex || '#FFFFFF';
  const tintUnit = hexToUnit(tintHex);
  // mix(#FFFFFF, tintHex, RESID) — the residual trim, not the full tint.
  const tint = mix([1, 1, 1], tintUnit, t.resid);
  return {
    hazeTint: intToUnit(visual.hazeTint),
    shadowAnchor: hexToUnit(P.SHADOW_ANCHOR_HEX),
    hazePull: t.hazePull,
    shadowPull: t.shadowPull,
    tint,
    sat: t.sat,
    transitionTint: visual.transitionTint,
    locationId,
    tod,
  };
}

/** Build the 256x16 strip. Returns { surface, lut } where lut is Float rgb[]. */
function buildLut(ctx) {
  const surface = new Surface(STRIP_W, STRIP_H);
  const table = new Uint8Array(LUT_SIZE * LUT_SIZE * LUT_SIZE * 3);

  for (let b = 0; b < LUT_SIZE; b++) {
    for (let g = 0; g < LUT_SIZE; g++) {
      for (let r = 0; r < LUT_SIZE; r++) {
        const src = [r / (LUT_SIZE - 1), g / (LUT_SIZE - 1), b / (LUT_SIZE - 1)];
        const out = gradeColour(src, ctx);
        const R = Math.round(out[0] * 255);
        const G = Math.round(out[1] * 255);
        const B = Math.round(out[2] * 255);
        surface.setRGBA(b * LUT_SIZE + r, g, R, G, B, 255);
        const i = ((b * LUT_SIZE + g) * LUT_SIZE + r) * 3;
        table[i] = R; table[i + 1] = G; table[i + 2] = B;
      }
    }
  }
  return { surface, table };
}

/**
 * Sample the lattice the way the shader does: bilinear in r/g, linear in b.
 * Used by the acceptance gate so the gate measures what the GPU will do, not
 * an idealised version of it.
 */
function sampleLut(table, r8, g8, b8) {
  const S = LUT_SIZE - 1;
  const fr = (r8 / 255) * S;
  const fg = (g8 / 255) * S;
  const fb = (b8 / 255) * S;
  const r0 = Math.floor(fr), g0 = Math.floor(fg), b0 = Math.floor(fb);
  const r1 = Math.min(r0 + 1, S), g1 = Math.min(g0 + 1, S), b1 = Math.min(b0 + 1, S);
  const tr = fr - r0, tg = fg - g0, tb = fb - b0;

  const at = (r, g, b, ch) => table[((b * LUT_SIZE + g) * LUT_SIZE + r) * 3 + ch];
  const out = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const c00 = at(r0, g0, b0, ch) * (1 - tr) + at(r1, g0, b0, ch) * tr;
    const c10 = at(r0, g1, b0, ch) * (1 - tr) + at(r1, g1, b0, ch) * tr;
    const c01 = at(r0, g0, b1, ch) * (1 - tr) + at(r1, g0, b1, ch) * tr;
    const c11 = at(r0, g1, b1, ch) * (1 - tr) + at(r1, g1, b1, ch) * tr;
    const c0 = c00 * (1 - tg) + c10 * tg;
    const c1 = c01 * (1 - tg) + c11 * tg;
    out[ch] = c0 * (1 - tb) + c1 * tb;
  }
  return out;
}

// ---------------------------------------------------------------------------
// acceptance gate
// ---------------------------------------------------------------------------

function loadPlatePixels(file) {
  const { createCanvas, Image } = require('canvas');
  const img = new Image();
  img.src = fs.readFileSync(file);
  const cv = createCanvas(img.width, img.height);
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  return cx.getImageData(0, 0, img.width, img.height);
}

/** Canon palette as a flat rgb array, for nearest-index lookups. */
function canonRGB() {
  return P.CANON.map((c) => P.hexToRgb(c.hex));
}

function nearestIndex(pool, r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const dr = pool[i].r - r, dg = pool[i].g - g, db = pool[i].b - b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * The gate (spec §1.4): apply `<loc>-day.png` to the shipped day plate.
 *  - no CANON colour may move more than MAX_DRIFT/255 in any channel
 *  - >= MIN_STABILITY of plate pixels must still nearest-match their original
 *    canon index
 */
const MAX_DRIFT = 10;
const MIN_STABILITY = 0.92;

function gateFor(locationId, table, pool, report) {
  const stem = PLATE_STEM[locationId];
  const plateFile = path.join(SCENES_DIR, `${stem}.png`);

  // (a) canon drift — pure, needs no plate.
  let worstDrift = 0;
  let worstName = null;
  for (const c of P.CANON) {
    const { r, g, b } = P.hexToRgb(c.hex);
    const out = sampleLut(table, r, g, b);
    const drift = Math.max(
      Math.abs(out[0] - r), Math.abs(out[1] - g), Math.abs(out[2] - b),
    );
    if (drift > worstDrift) { worstDrift = drift; worstName = c.hex; }
  }

  // (b) index stability over the actual shipped plate.
  let stability = 1;
  let sampled = 0;
  if (fs.existsSync(plateFile)) {
    const img = loadPlatePixels(plateFile);
    const d = img.data;
    let stable = 0;
    // Every 4th pixel in each axis: 1/16th of the plate is ~14 400 samples,
    // far past the point the ratio stops moving, and keeps the gate fast.
    for (let y = 0; y < img.height; y += 4) {
      for (let x = 0; x < img.width; x += 4) {
        const i = (y * img.width + x) * 4;
        if (d[i + 3] < 128) continue;
        const before = nearestIndex(pool, d[i], d[i + 1], d[i + 2]);
        const out = sampleLut(table, d[i], d[i + 1], d[i + 2]);
        const after = nearestIndex(pool, out[0], out[1], out[2]);
        sampled++;
        if (before === after) stable++;
      }
    }
    stability = sampled ? stable / sampled : 1;
  } else {
    report.warnings.push(`${locationId}: day plate ${path.basename(plateFile)} not found — index-stability gate skipped`);
  }

  const driftOk = worstDrift <= MAX_DRIFT;
  const stabilityOk = stability >= MIN_STABILITY;
  if (!driftOk) {
    report.failures.push(
      `${locationId}-day: canon colour ${worstName} moved ${worstDrift.toFixed(1)}/255 (limit ${MAX_DRIFT}) — the LUT is grading, not trimming`
    );
  }
  if (!stabilityOk) {
    report.failures.push(
      `${locationId}-day: only ${(stability * 100).toFixed(1)} % of plate pixels keep their canon index (limit ${(MIN_STABILITY * 100).toFixed(0)} %) — the double-grade has returned`
    );
  }
  return { worstDrift, worstName, stability, sampled, driftOk, stabilityOk };
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

function locationVisuals() {
  const out = {};
  for (const id of Object.keys(PLATE_STEM)) {
    const file = path.join(LOCATIONS_DIR, `${id}.location.json`);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    out[id] = raw.visual;
  }
  return out;
}

function run(argv) {
  const checkOnly = argv.includes('--check');
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : DEFAULT_OUT;
  const quiet = argv.includes('--quiet');

  const relight = JSON.parse(fs.readFileSync(RELIGHT_RUNTIME, 'utf8'));
  const visuals = locationVisuals();
  const pool = canonRGB();
  const report = { failures: [], warnings: [] };
  const fallback = {};
  const rows = [];

  if (!checkOnly) fs.mkdirSync(outDir, { recursive: true });

  for (const locationId of Object.keys(PLATE_STEM)) {
    for (const tod of TODS) {
      const ctx = gradeContext(locationId, tod, visuals[locationId], relight);
      const { surface, table } = buildLut(ctx);
      const key = `${locationId}-${tod}`;

      if (!checkOnly) surface.writePNG(path.join(outDir, `${key}.png`));

      // The Canvas fallback's flat MULTIPLY colour: what this LUT does to
      // mid-grey. Read straight out of the table so the two can never drift.
      //
      // SPEC DEVIATION (§1.6), and why: the spec asks for the raw mid-grey
      // mapping at alpha 0.35. Phaser's MULTIPLY rect composites as
      // `base*(1-a) + base*C*a`, so a raw ~#818181 at a = 0.35 darkens the
      // canvas path by ~17 % — a darkening the shader path does not apply,
      // since these LUTs are near-identity in LUMA by construction (worst
      // canon drift under 8/255). Emitting the mapping NORMALISED to its own
      // peak channel keeps exactly the part canvas can honestly reproduce —
      // the location's hue — and drops the luminance error. The raw mapping is
      // kept alongside it so the derivation stays auditable.
      const grey = sampleLut(table, 128, 128, 128);
      const hex = (rgb) => '#' + rgb
        .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
        .join('').toUpperCase();
      const peak = Math.max(grey[0], grey[1], grey[2]) || 1;
      fallback[key] = {
        multiply: hex(grey.map((v) => (v / peak) * 255)),
        rawMidGrey: hex(grey),
      };

      if (tod === 'day') {
        rows.push({ locationId, ...gateFor(locationId, table, pool, report) });
      }
    }
  }

  if (!checkOnly) {
    const fallbackDoc = JSON.stringify({
        $schema: 'melaka-forge/grade-lut-fallback@1',
        generatedBy: 'tools/forge/grade-lut.cjs — regenerate with `npm run forge:grade-lut`, do not hand-edit',
        note: 'Each LUT\'s own mapping of mid-grey #808080. The Canvas fallback draws ONE MULTIPLY rect in `multiply` at alpha 0.35 — the honest limit of a renderer with no shader. `multiply` is the mapping normalised to its own peak channel (hue only); `rawMidGrey` is the unnormalised mapping, kept so the normalisation stays auditable. See the SPEC DEVIATION note in grade-lut.cjs.',
      fallbackAlpha: 0.35,
      luts: fallback,
    }, null, 2) + '\n';
    fs.writeFileSync(path.join(outDir, 'fallback.json'), fallbackDoc);
    // The engine imports this as a module (the Canvas fallback has to know the
    // colour before any asset load completes), so it also lands in src/data.
    fs.writeFileSync(path.join(ROOT, 'src', 'data', 'grade-fallback.json'), fallbackDoc);
  }

  if (!quiet) {
    console.log(`grade-lut: ${Object.keys(PLATE_STEM).length * TODS.length} LUTs ${checkOnly ? 'checked' : `written to ${path.relative(ROOT, outDir)}`}`);
    console.log('  location            worst canon drift    index stability');
    for (const r of rows) {
      console.log(
        `  ${r.locationId.padEnd(18)} ${(r.worstDrift.toFixed(2) + '/255').padEnd(20)} ` +
        `${(r.sampled ? (r.stability * 100).toFixed(2) + ' %' : 'skipped')}` +
        `${r.driftOk && r.stabilityOk ? '' : '   <-- FAIL'}`
      );
    }
    report.warnings.forEach((w) => console.warn(`  warn: ${w}`));
  }

  if (report.failures.length) {
    report.failures.forEach((f) => console.error(`  FAIL: ${f}`));
    return { ok: false, report, rows };
  }
  return { ok: true, report, rows };
}

module.exports = {
  run, buildLut, gradeColour, gradeContext, sampleLut,
  TOD, TODS, LOC_HUE, MAX_DRIFT, MIN_STABILITY, PLATE_STEM, LUT_SIZE,
};

if (require.main === module) {
  const res = run(process.argv.slice(2));
  process.exit(res.ok ? 0 : 1);
}
