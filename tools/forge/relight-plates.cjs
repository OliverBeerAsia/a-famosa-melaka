'use strict';
/**
 * MELAKA FORGE — RELIGHT PLATES
 * =============================
 * Derives every shipping time-of-day plate from the DAY master through the
 * Forge relight LUTs, then bakes the per-location practical light pass on top.
 *
 * Replaces `tools/generate-time-of-day-variants.cjs`, which applied a
 * multiply/screen/gradient filter to the raw Canva export. A filter moves every
 * colour the same way, so its "night" was just "day, slightly dimmer and
 * browner" — which is exactly how it read in-engine once the runtime
 * double-grade was (correctly) removed in Stage 0. A LUT lets each colour
 * behave the way its MATERIAL would: plaster goes moon-silver, foliage
 * collapses into the violet shadow anchor, water keeps a moon path, and the
 * lantern practicals stay above the compression window.
 *
 * THE DAY MASTER LIVES IN tools/forge/plate-masters/
 * ---------------------------------------------------
 * This tool WRITES assets/scenes/scene-<plate>.png (the canon-quantized day
 * plate), so it must not also READ it — a tool whose input is its own output is
 * not idempotent, and the determinism gate caught exactly that: the ramp
 * coherence pass below re-quantizes from the ORIGINAL pre-canon pixels, which
 * no longer exist once the day plate has been rewritten once. So the untouched
 * pre-Stage-2 day plates are snapshotted into tools/forge/plate-masters/ and
 * that directory is the only input. Everything in assets/scenes/ is output.
 *
 * PIPELINE (per location)
 *   1. read the DAY master  tools/forge/plate-masters/scene-<plate>.png (960x540)
 *   2. nearest-downscale to native 320x180 (the plates are already pixelated
 *      on a 3x grid, so this is lossless)
 *   3. quantize to the 50-colour canon  (tools/forge/palette.cjs)
 *   4. rewrite the DAY plate from the quantized native (so day and its
 *      variants are literally the same pixels under different light)
 *   5. per ToD: apply the LUT (dawn/dusk lerp base->sun across x, night is a
 *      single table), then BAKE THE LIGHT PASS from the location's lights[]
 *   6. nearest-upscale 3x back to 960x540 and write
 *
 * THE LIGHT PASS
 * --------------
 * Night's warmth does not come from the LUT — the LUT is deliberately cold
 * everywhere (a cool guard forces b-r >= 12 on every non-practical). Warmth
 * comes from PRACTICALS baked at the coordinates the location file already
 * declares in `lights[]`. Each pool is:
 *   - a hard 1-2px core of lantern-flame / sun-specular
 *   - concentric bands stepped through the accent + earth/terracotta ramps
 *   - an ordered-Bayer 4x4 dither on the band edges so the falloff is chunky
 *     pixel dither, never a smooth gradient and never anti-aliased
 * `window` lights additionally stamp a hard lit-window rectangle.
 *
 * Everything is deterministic: no Math.random, no Date.now. Running twice
 * produces byte-identical PNGs (gated by tools/forge/validate-canon.cjs).
 *
 * CLI
 *   node tools/forge/relight-plates.cjs                 all 5 locations
 *   node tools/forge/relight-plates.cjs rua-direita     one location
 *   node tools/forge/relight-plates.cjs --dry           report, write nothing
 *   node tools/forge/relight-plates.cjs --no-day        leave day masters alone
 *   node tools/forge/relight-plates.cjs --out /tmp/x    write elsewhere (CI)
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const P = require('./palette.cjs');
const R = require('./relight.cjs');

const REPO = path.resolve(__dirname, '../..');
const SCENES_DIR = path.join(REPO, 'assets', 'scenes');
const MASTERS_DIR = path.join(__dirname, 'plate-masters');
const LOCATIONS_DIR = path.join(REPO, 'src', 'data', 'locations');

// The historical plate size. Since Stage 3 the native size is per-location
// (`world.nativeWidth/Height` in the location file) — rua-direita composes at
// 640x360 for the scrolling camera — so these are defaults for callers that
// still ask for "a plate" without saying which.
const NATIVE_W = 320;
const NATIVE_H = 180;
const SCALE = 3;
const OUT_W = NATIVE_W * SCALE;   // 960
const OUT_H = NATIVE_H * SCALE;   // 540

// Overlays follow the plate contract exactly: the NATIVE cut-outs are masters
// (input, never written), the 3x relit sprites in assets/ are output.
const OVERLAYS_DIR = path.join(SCENES_DIR, 'overlays');
const OVERLAY_MASTERS_DIR = path.join(MASTERS_DIR, 'overlays');

const TODS = ['dawn', 'dusk', 'night'];

// ---------------------------------------------------------------------------
// LIGHT PASS SPEC
// ---------------------------------------------------------------------------
// Radii are NATIVE pixels (320x180 plate space) — the same space the location
// files author lights[] in, so no scaling happens here at all.
//
// bands: outermost -> innermost. `t` is the normalised falloff threshold the
// (dithered) distance term must clear; `mix` is how hard the pixel is pulled
// toward the band's colour; `lift` is a straight additive exposure bump in
// RGB, which is what actually makes a pool read as LIGHT rather than as a
// coloured decal.
const LIGHT_TYPES = {
  torch:       { radius: 16, core: 1, power: 1.00 },
  lantern:     { radius: 18, core: 1, power: 0.94 },
  cookingFire: { radius: 22, core: 2, power: 1.10 },
  window:      { radius: 11, core: 0, power: 0.86,
                 // hard-edged lit pane stamped at the light's coordinate
                 pane: { w: 4, h: 5, dy: -1 } },
};
const DEFAULT_LIGHT = LIGHT_TYPES.lantern;

/**
 * Per-time behaviour of the baked pass.
 *   dawn  off      — the lamps went out an hour ago
 *   dusk  partial  — lamps are being lit but the sky still dominates, so the
 *                    pools are small and only the hot inner bands survive
 *   night full     — the ONLY warmth in the frame
 */
const PASS = {
  dawn:  { strength: 0.00, radiusScale: 0.00, minBand: 5, isNight: false },
  dusk:  { strength: 0.62, radiusScale: 0.52, minBand: 2, isNight: false },
  night: { strength: 1.00, radiusScale: 1.00, minBand: 0, isNight: true },
};
// kept for API compatibility / reporting
const PASS_STRENGTH = { dawn: 0, dusk: PASS.dusk.strength, night: PASS.night.strength };

/**
 * THE POOL RAMP — a fixed 5-step warm ramp, outermost first.
 *
 * The pass REPLACES pixels with a ramp step rather than blending toward a
 * colour, and that is deliberate: a blend against arbitrary underlying colours
 * generates an unbounded palette (the first draft of this tool emitted 480
 * colours per plate), which is exactly the "no shared palette" failure the
 * canon exists to fix. Replacing with a fixed ramp means a relit plate's
 * palette is enumerable: LUT(base) + LUT(sun) + these 5 + the 2 pane colours.
 *
 * Texture survives because the BAND BOUNDARIES are ordered-dithered, so the
 * outer falloff is a speckle of ramp step 0 through the untouched relit
 * surface — chunky pixel dither, no AA, no smooth gradient.
 */
const POOL_RAMP = (() => {
  const flame = P.hexToRgb(P.ACCENTS['lantern-flame']);
  const brass = P.hexToRgb(P.ACCENTS['brass-gold']);
  const hot = P.hexToRgb(P.ACCENTS['sun-specular']);
  const terra2 = P.hexToRgb(P.RAMPS.terracotta[2]);
  const terra1 = P.hexToRgb(P.RAMPS.terracotta[1]);
  const violet = P.hexToRgb(P.ANCHORS['shadow-violet']);
  const snap = (c) => ({ r: P.snap4(c.r), g: P.snap4(c.g), b: P.snap4(c.b) });
  return [
    snap(P.mixRgb(terra1, violet, 0.34)),   // 0  the ember edge of the pool
    snap(P.mixRgb(terra2, brass, 0.42)),    // 1
    snap(P.mixRgb(brass, flame, 0.50)),     // 2
    flame,                                  // 3  lantern-flame proper
    hot,                                    // 4  the source itself
  ];
})();

// Falloff band thresholds on the dithered distance term, outer -> inner.
const BAND_T = [0.06, 0.24, 0.46, 0.68, 0.86];

// dither amplitude applied to the falloff term before banding: this is what
// turns a continuous radial falloff into chunky ordered-dither pixels
const DITHER_AMP = 0.34;

/**
 * QUANTIZATION POOL — canon MINUS the accents.
 *
 * Accents are small-area, deliberately-placed light sources; a quantizer must
 * never be allowed to *discover* them. rua-direita's golden earth sits ~14
 * units from `brass-gold`, so an unrestricted nearest() scattered thousands of
 * ground pixels onto the accent — and because accents are PRACTICALS (exempt
 * from the night compression window) the entire plaza came back at night as a
 * field of glowing gold speckle. Practicals enter a plate exactly one way: the
 * baked light pass below.
 */
const PLATE_POOL = P.CANON.filter((c) => c.ramp !== 'accent');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function bayer4(x, y) {
  return (P.BAYER4[y & 3][x & 3] + 0.5) / 16 - 0.5; // -0.5 .. +0.5
}

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

/** Discover the shipping locations from the location data (single source of truth). */
function discoverLocations() {
  const out = [];
  fs.readdirSync(LOCATIONS_DIR)
    .filter((f) => f.endsWith('.location.json'))
    .sort()
    .forEach((f) => {
      const id = f.replace('.location.json', '');
      const doc = JSON.parse(fs.readFileSync(path.join(LOCATIONS_DIR, f), 'utf8'));
      const variants = (doc.plate && doc.plate.variants) || {};
      const anyVariant = variants.night || variants.dusk || variants.dawn;
      if (!anyVariant) return;
      // "scene-a-famosa-night" -> plate stem "scene-a-famosa"
      const stem = anyVariant.replace(/-(dawn|dusk|night)$/, '');
      out.push({
        id,
        stem,
        // INPUT: the immutable master. OUTPUT: assets/scenes/<stem>.png.
        masterFile: path.join(MASTERS_DIR, `${stem}.png`),
        dayFile: path.join(SCENES_DIR, `${stem}.png`),
        variants,
        lights: doc.lights || [],
        // Foreground walk-behind occluders (Stage 3+). They are cut from the
        // SAME composed image as the plate and drawn back at the same pixel
        // coordinates, so they must go through the identical relight or the
        // player would see a differently-lit ghost of the building they are
        // standing in front of.
        overlays: doc.overlays || [],
        // Native plate size is per-location from Stage 3 onwards.
        nativeW: (doc.world && doc.world.nativeWidth) || NATIVE_W,
        nativeH: (doc.world && doc.world.nativeHeight) || NATIVE_H,
        scale: (doc.world && doc.world.scale) || SCALE,
      });
    });
  return out;
}

// --- cool-ramp coherence ---------------------------------------------------
// Nearest-colour quantization is per-pixel and material-blind, and THREE canon
// ramps are cool blues whose mid steps sit within ~30 units of each other:
// water, stone and sky. The Canva-era waterfront sea quantizes to a 2:1 dither
// of water-2 (#185470) and stone-1 (#383C58) — invisible at day, because at day
// those two ARE the same blue.
//
// At dusk they are not. `water` takes reflectFloor 0.92 and keyW 0.86 (it is
// reflecting the sunset), `stone` takes neither, so water-2 relights to #956D41
// and stone-1 to #362438 and a flat sea detonates into an orange/violet
// checkerboard. Same story for night, where water keeps a moon path and stone
// does not.
//
// So: inside the CONFUSION SET only, give a pixel back to the material its
// neighbourhood belongs to. The pixel is re-quantized from its ORIGINAL colour
// restricted to the winning ramp, so value and dither texture survive intact —
// only the material identity is corrected. Warm ramps are never touched, which
// is what keeps the timber pier, the deck and the roofs' edges crisp.
// The trigger is DAY-INDISTINGUISHABILITY, not window share: a pixel is only
// reassigned when the material it disagrees with is a colour it is already
// visually identical to (<= LUMA_EPS of luma apart). Real edges — deck against
// sea, roof against sky — differ by far more than that and are never touched,
// which is what keeps the pier, the quay and the rooflines crisp.
const COHERENCE_RADIUS = 2;    // 5x5 native px window
const COHERENCE_MODE_MIN = 0.28; // the window's mode must be this dominant
const LUMA_EPS = 15;           // "the same blue as far as the eye is concerned"
const COHERENCE_PASSES = 6;    // iterate to a fixed point (breaks early)

const RAMP_POOLS = (() => {
  const m = {};
  PLATE_POOL.forEach((c) => { (m[c.ramp] = m[c.ramp] || []).push(c); });
  return m;
})();

function rampCoherencePass(id, original) {
  const NATIVE_W = id.width;
  const NATIVE_H = id.height;
  const d = id.data;
  const N = NATIVE_W * NATIVE_H;
  const idx = new Int16Array(N);
  for (let i = 0, p = 0; p < N; i += 4, p++) {
    idx[p] = P.nearest(d[i], d[i + 1], d[i + 2]).index;
  }
  const out = new Uint8ClampedArray(d);
  const counts = new Int16Array(P.CANON.length);
  let moved = 0;
  for (let y = 0; y < NATIVE_H; y++) {
    for (let x = 0; x < NATIVE_W; x++) {
      const self = P.CANON[idx[y * NATIVE_W + x]];
      if (self.ramp === 'anchor') continue;   // anchors are deliberate placements
      counts.fill(0);
      let total = 0, mode = -1, modeN = 0;
      for (let wy = Math.max(0, y - COHERENCE_RADIUS); wy <= Math.min(NATIVE_H - 1, y + COHERENCE_RADIUS); wy++) {
        for (let wx = Math.max(0, x - COHERENCE_RADIUS); wx <= Math.min(NATIVE_W - 1, x + COHERENCE_RADIUS); wx++) {
          const k = idx[wy * NATIVE_W + wx];
          const n = ++counts[k];
          total++;
          if (n > modeN) { modeN = n; mode = k; }
        }
      }
      const win = P.CANON[mode];
      if (win.ramp === self.ramp || win.ramp === 'anchor') continue;
      if (modeN / total < COHERENCE_MODE_MIN) continue;
      // only unify materials the eye cannot already tell apart at DAY
      if (Math.abs(P.luma(win.r, win.g, win.b) - P.luma(self.r, self.g, self.b)) > LUMA_EPS) continue;
      const i = (y * NATIVE_W + x) * 4;
      // re-quantize the ORIGINAL pixel, so the field keeps its value texture
      const c = P.nearest(original[i], original[i + 1], original[i + 2], RAMP_POOLS[win.ramp]);
      out[i] = c.r; out[i + 1] = c.g; out[i + 2] = c.b; out[i + 3] = 255;
      moved++;
    }
  }
  d.set(out);
  return moved;
}

/** True when every opaque pixel is already exactly a canon colour. */
function isAlreadyCanon(id) {
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const c = P.nearest(d[i], d[i + 1], d[i + 2]);
    if (c.r !== d[i] || c.g !== d[i + 1] || c.b !== d[i + 2]) return false;
  }
  return true;
}

/**
 * Master (scale x native) -> canon-quantized, ramp-coherent native ImageData.
 *
 * The ramp-coherence pass exists to repair CANVA-ERA plates, where a flat sea
 * quantized into a water/stone checkerboard that only reveals itself once the
 * two materials relight differently. A plate that comes out of
 * `compose-plate.cjs` is drawn FROM the canon with known materials, so it is
 * already 100% canon on the way in and coherence has nothing to fix and one
 * thing to break (it would happily "correct" a deliberately dithered ramp
 * transition). So the pass is skipped exactly when the input needs no
 * quantization at all — a self-configuring, deterministic test.
 */
async function loadNativeDay(file, W = NATIVE_W, H = NATIVE_H) {
  const img = await loadImage(file);
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, H);
  const id = ctx.getImageData(0, 0, W, H);
  const original = new Uint8ClampedArray(id.data);
  const preCanon = isAlreadyCanon(id);
  P.quantizeImageData(id, PLATE_POOL);
  if (!preCanon) {
    // Iterated to a fixed point: each pass strengthens the local mode, so the
    // next one reaches strays the first was not yet confident enough about.
    // Bounded (and deterministic) — it converges in 2-4 rounds on every plate.
    for (let pass = 0; pass < COHERENCE_PASSES; pass++) {
      if (rampCoherencePass(id, original) === 0) break;
    }
  }
  const used = new Set();
  for (let i = 0; i < id.data.length; i += 4) {
    if (id.data[i + 3] === 0) continue;
    used.add(P.nearest(id.data[i], id.data[i + 1], id.data[i + 2]).index);
  }
  return { id, used: used.size, preCanon };
}

/**
 * Relight a canon-quantized native ImageData in place through the LUT for `tod`.
 *
 * Dawn and dusk carry a spatial base->sun gradient (the sun is NW, so the warm
 * side is the LEFT edge). relight.cjs's own applyToImageData LERPS between the
 * two tables, which is correct for a truecolour consumer but wrong here: a lerp
 * invents a new colour per column and blew the plate palette out to ~480
 * entries. We ORDERED-DITHER the choice instead, so every output pixel is
 * literally an entry of `base` or `sun` and the transition still reads as a
 * gradient at 3x zoom.
 */
function relightNative(id, tod, frame = {}) {
  // `frame` places this image inside its PLATE, so a foreground overlay cut
  // from the plate takes the sun gradient of the column it was cut from rather
  // than a fresh gradient across its own 80px width.
  const originX = frame.originX || 0;
  const originY = frame.originY || 0;
  const plateW = frame.plateW || id.width;
  const W = id.width;
  const H = id.height;
  const spec = R.TOD_SPECS[tod];
  const base = R.lutFor(tod, 'base');
  const sun = (spec && spec.sunBias) ? R.lutFor(tod, 'sun') : null;
  const d = id.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] === 0) continue;
      const px = originX + x;
      const py = originY + y;
      const c = P.nearest(d[i], d[i + 1], d[i + 2]);
      let out = base[c.index];
      if (sun) {
        const t = 1 - px / (plateW - 1);           // warm side = left edge
        if (t + bayer4(px, py) > 0.5) out = sun[c.index];
      }
      d[i] = out.r; d[i + 1] = out.g; d[i + 2] = out.b; d[i + 3] = 255;
    }
  }
  return id;
}

/**
 * Bake one practical into the native ImageData.
 * Coordinates are NATIVE plate pixels, exactly as authored in the location
 * file's lights[] — no scaling happens anywhere in this tool.
 */
function bakeLight(id, light, pass, frame = {}) {
  const kind = LIGHT_TYPES[light.type] || DEFAULT_LIGHT;
  const R0 = Math.round(kind.radius * pass.radiusScale);
  const power = kind.power * pass.strength;
  if (power <= 0 || R0 <= 0) return;
  // A `window` marked nightOnly is a shuttered pane: it is dark at dusk and
  // lit at night, which is the whole point of authoring the flag.
  if (light.nightOnly && !pass.isNight) return;

  // Frame maps PLATE coordinates onto this image, so the same light bakes into
  // a foreground overlay exactly where it baked into the plate behind it.
  const originX = frame.originX || 0;
  const originY = frame.originY || 0;
  const NATIVE_W = id.width;
  const NATIVE_H = id.height;
  const cx = Math.round(light.x) - originX;
  const cy = Math.round(light.y) - originY;
  const d = id.data;
  const put = (x, y, c) => {
    const i = (y * NATIVE_W + x) * 4;
    // Never light an empty pixel: on an overlay that would grow the cut-out.
    if (d[i + 3] === 0) return;
    d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = 255;
  };
  // The ordered dither must key off PLATE coordinates for the same reason.
  const bayer = (x, y) => bayer4(x + originX, y + originY);

  // --- radial pool -------------------------------------------------------
  for (let y = cy - R0; y <= cy + R0; y++) {
    if (y < 0 || y >= NATIVE_H) continue;
    for (let x = cx - R0; x <= cx + R0; x++) {
      if (x < 0 || x >= NATIVE_W) continue;
      const dx = x - cx;
      const dy = (y - cy) * 1.28;           // pools are wider than they are tall
      const dist = Math.sqrt(dx * dx + dy * dy) / R0;
      if (dist >= 1) continue;

      // inverse-square-ish falloff, then ordered-dithered so the band EDGES
      // break into pixels instead of into a smooth ring
      let f = (1 - dist);
      f = f * f * power;
      f += bayer(x, y) * DITHER_AMP * (1 - f);

      // innermost band this pixel clears
      let band = -1;
      for (let b = 0; b < BAND_T.length; b++) if (f >= BAND_T[b]) band = b;
      if (band < pass.minBand) continue;
      put(x, y, POOL_RAMP[band]);
    }
  }

  // --- lit window pane (hard edges, no falloff) --------------------------
  if (kind.pane) {
    const pw = kind.pane.w;
    const ph = kind.pane.h;
    const px0 = cx - (pw >> 1);
    const py0 = cy + (kind.pane.dy || 0) - (ph >> 1);
    for (let y = py0; y < py0 + ph; y++) {
      if (y < 0 || y >= NATIVE_H) continue;
      for (let x = px0; x < px0 + pw; x++) {
        if (x < 0 || x >= NATIVE_W) continue;
        // panes are mullioned: a flame frame around a hotter interior
        const edge = (x === px0 || x === px0 + pw - 1 || y === py0 || y === py0 + ph - 1);
        put(x, y, POOL_RAMP[edge ? 3 : 4]);
      }
    }
  }

  // --- hot core (the flame / coals themselves) ---------------------------
  if (kind.core) {
    for (let y = cy; y < cy + kind.core; y++) {
      if (y < 0 || y >= NATIVE_H) continue;
      for (let x = cx; x < cx + kind.core; x++) {
        if (x < 0 || x >= NATIVE_W) continue;
        put(x, y, POOL_RAMP[4]);
      }
    }
  }
}

/** native ImageData -> nearest-upscaled PNG buffer (default 3x) */
function encodeUpscaled(id, scale = SCALE) {
  const work = createCanvas(id.width, id.height);
  work.getContext('2d').putImageData(id, 0, 0);
  const out = createCanvas(id.width * scale, id.height * scale);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(work, 0, 0, id.width, id.height, 0, 0, out.width, out.height);
  return out.toBuffer('image/png');
}

function cloneImageData(id) {
  const cv = createCanvas(id.width, id.height);
  const ctx = cv.getContext('2d');
  const copy = ctx.createImageData(id.width, id.height);
  copy.data.set(id.data);
  return copy;
}

function statsOf(id) {
  const d = id.data;
  const used = new Set();
  let sum = 0, n = 0, warm = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = P.luma(d[i], d[i + 1], d[i + 2]);
    sum += l; n++;
    if (d[i] > d[i + 2] + 6) warm++;
    used.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  }
  return { meanLuma: sum / n, colours: used.size, warmPct: (warm / n) * 100 };
}

// ---------------------------------------------------------------------------
// RUNTIME CHARACTER TINT
// ---------------------------------------------------------------------------
// Plates are baked; sprites are not. If the two grades come from different
// numbers you get the double-grade back in a new outfit — a night plate at
// 0.36x day with characters hand-tinted to a taste-picked blue. So the sprite
// tint is DERIVED from the same LUT the plate went through: a single
// multiplicative tint is the best rank-1 approximation of the table.
//
//   tint_ch = 255 * SUM(w_r * out_r,ch) / SUM(w_r * in_r,ch)
//
// summed over the MATERIAL ramps only (sky is atmosphere, accents are
// practicals and neither appears on a person), with `skin` carrying half the
// total weight: a character is mostly cloth by area but it is the FACE that
// has to stay readable, and the LUT already gives skin its own widened window
// and waives the night cool guard for exactly that reason.
//
// Alpha stays 1.0 at every hour. The old table faded characters to 0.9 at
// night, which does not read as darkness — it reads as a ghost, because the
// plate shows through the sprite. Darkness is the tint's job.
const TINT_RAMPS = ['whitewash', 'terracotta', 'stone', 'timber', 'foliage', 'water', 'earth', 'skin'];
const SKIN_SHARE = 0.5;

function characterTintFor(tod) {
  const lut = R.lutFor(tod, 'base');
  const others = TINT_RAMPS.filter((r) => r !== 'skin');
  const weightFor = (ramp) => (ramp === 'skin' ? SKIN_SHARE : (1 - SKIN_SHARE) / others.length);

  const num = [0, 0, 0];
  const den = [0, 0, 0];
  P.CANON.forEach((c, i) => {
    if (!TINT_RAMPS.includes(c.ramp)) return;
    const w = weightFor(c.ramp);
    const o = lut[i];
    num[0] += w * o.r; num[1] += w * o.g; num[2] += w * o.b;
    den[0] += w * c.r; den[1] += w * c.g; den[2] += w * c.b;
  });
  const ch = num.map((n, k) => P.clamp(Math.round(255 * (n / Math.max(1, den[k]))), 0, 255));
  return { r: ch[0], g: ch[1], b: ch[2] };
}

function buildRuntime() {
  const doc = {
    $schema: 'melaka-forge/relight-runtime@1',
    generatedBy: 'tools/forge/relight-plates.cjs — regenerate with `npm run forge:relight`, do not hand-edit',
    note: 'Per-time-of-day multiplicative sprite tint derived from the SAME relight LUTs '
        + '(docs/art-bible/forge/relight-luts.json) that bake the plates, so composited '
        + 'characters sit in the light their backdrop was lit by. Plate-wide runtime '
        + 'overlays stay OFF wherever a baked variant exists — this tint is the whole '
        + 'runtime lighting pass for characters.',
    source: 'docs/art-bible/forge/relight-luts.json',
    weighting: { ramps: TINT_RAMPS, skinShare: SKIN_SHARE },
    times: {},
  };
  const dayL = P.CANON.reduce((a, c) => a + P.luma(c.r, c.g, c.b), 0) / P.CANON.length;
  R.TOD_ORDER.forEach((tod) => {
    const t = characterTintFor(tod);
    const lut = R.lutFor(tod, 'base');
    const mean = lut.reduce((a, c) => a + P.luma(c.r, c.g, c.b), 0) / lut.length;
    const identity = t.r >= 254 && t.g >= 254 && t.b >= 254;
    doc.times[tod] = {
      // 0xRRGGBB for Phaser setTint(); null means "clear the tint" (day)
      tint: identity ? null : (t.r << 16) | (t.g << 8) | t.b,
      tintHex: P.rgbToHex(t.r, t.g, t.b),
      alpha: 1,
      lumaRatio: Number((mean / dayL).toFixed(3)),
    };
  });
  return doc;
}

// ---------------------------------------------------------------------------
async function relightLocation(loc, opts) {
  if (!fs.existsSync(loc.masterFile)) {
    throw new Error(
      `missing day master for ${loc.id}: ${path.relative(REPO, loc.masterFile)}\n` +
      'Masters are the untouched pre-canon plates and are the ONLY input to this tool. ' +
      'Snapshot one with: cp assets/scenes/<stem>.png tools/forge/plate-masters/'
    );
  }
  const outDir = opts.outDir || SCENES_DIR;
  const overlayOutDir = opts.outDir ? path.join(outDir, 'overlays') : OVERLAYS_DIR;
  fs.mkdirSync(outDir, { recursive: true });

  const W = loc.nativeW;
  const H = loc.nativeH;
  const scale = loc.scale;

  const { id: nativeDay, used, preCanon } = await loadNativeDay(loc.masterFile, W, H);
  const dayStats = statsOf(nativeDay);
  const report = {
    id: loc.id, canonColours: used, lights: loc.lights.length,
    overlays: loc.overlays.length, native: `${W}x${H}`, preCanon, times: {},
  };
  report.times.day = { ...dayStats, ratio: 1 };

  // Foreground occluders, loaded once and relit alongside the plate.
  const overlays = [];
  for (const o of loc.overlays) {
    const src = path.join(OVERLAY_MASTERS_DIR, `${o.key}.png`);
    if (!fs.existsSync(src)) throw new Error(`missing overlay ${path.relative(REPO, src)} for ${loc.id}`);
    // eslint-disable-next-line no-await-in-loop
    const img = await loadImage(src);
    const cv = createCanvas(img.width, img.height);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, img.width, img.height);
    P.quantizeImageData(id, PLATE_POOL);
    overlays.push({ spec: o, day: id });
  }

  // 1. day master, re-emitted from the canon-quantized native
  if (opts.writeDay) {
    const buf = encodeUpscaled(nativeDay, scale);
    fs.writeFileSync(opts.outDir ? path.join(outDir, `${loc.stem}.png`) : loc.dayFile, buf);
  }

  // 2. the derived times — plate first, then every overlay through the exact
  //    same LUT and light pass at its own plate coordinates.
  for (const tod of TODS) {
    const key = loc.variants[tod];
    if (!key) continue;
    const pass = PASS[tod];
    const work = cloneImageData(nativeDay);
    relightNative(work, tod, { plateW: W });

    if (pass && pass.strength > 0) {
      // stable order: the location file's own order, which is data, not chance
      loc.lights.forEach((l) => bakeLight(work, l, pass));
    }

    const s = statsOf(work);
    report.times[tod] = { ...s, ratio: s.meanLuma / dayStats.meanLuma };

    if (!opts.dry) {
      fs.writeFileSync(path.join(outDir, `${key}.png`), encodeUpscaled(work, scale));
      if (overlays.length) fs.mkdirSync(overlayOutDir, { recursive: true });
      overlays.forEach(({ spec, day }) => {
        const frame = { originX: spec.x, originY: spec.y, plateW: W };
        const ov = cloneImageData(day);
        relightNative(ov, tod, frame);
        if (pass && pass.strength > 0) loc.lights.forEach((l) => bakeLight(ov, l, pass, frame));
        fs.writeFileSync(path.join(overlayOutDir, `${spec.key}-${tod}.png`), encodeUpscaled(ov, scale));
      });
    }
  }

  // 3. the day overlays are re-emitted from the canon quantization for the
  //    same reason the day plate is: day and its variants must be the same
  //    pixels under different light.
  if (opts.writeDay && overlays.length) {
    fs.mkdirSync(overlayOutDir, { recursive: true });
    overlays.forEach(({ spec, day }) => {
      fs.writeFileSync(path.join(overlayOutDir, `${spec.key}.png`), encodeUpscaled(day, scale));
    });
  }
  return report;
}

async function run(opts = {}) {
  const only = opts.only || [];
  const locations = discoverLocations()
    .filter((l) => !only.length || only.includes(l.id) || only.includes(l.stem.replace(/^scene-/, '')));
  const reports = [];
  for (const loc of locations) {
    // eslint-disable-next-line no-await-in-loop
    reports.push(await relightLocation(loc, opts));
  }
  return reports;
}

/**
 * The complete set of colours a relit plate for `tod` is allowed to contain.
 * This is what the CI canon gate checks membership against — a ToD plate is
 * NOT in the day canon, it is in the canon's deterministic LUT image plus the
 * baked pool ramp.
 */
function derivedPalette(tod) {
  const out = new Set();
  const add = (c) => out.add(((c.r & 255) << 16) | ((c.g & 255) << 8) | (c.b & 255));
  if (tod === 'day') {
    P.CANON.forEach(add);
    return out;
  }
  R.lutFor(tod, 'base').forEach(add);
  const spec = R.TOD_SPECS[tod];
  if (spec && spec.sunBias) R.lutFor(tod, 'sun').forEach(add);
  const pass = PASS[tod];
  if (pass && pass.strength > 0) POOL_RAMP.forEach(add);
  return out;
}

const RUNTIME_PATH = path.join(REPO, 'src', 'data', 'relight-runtime.json');

function writeRuntime(outPath = RUNTIME_PATH) {
  fs.writeFileSync(outPath, JSON.stringify(buildRuntime(), null, 2) + '\n');
  return outPath;
}

module.exports = {
  run, relightLocation, discoverLocations, bakeLight, relightNative,
  loadNativeDay, encodeUpscaled, derivedPalette,
  buildRuntime, writeRuntime, characterTintFor, RUNTIME_PATH,
  LIGHT_TYPES, PASS, PASS_STRENGTH, POOL_RAMP, TODS,
  NATIVE_W, NATIVE_H, SCALE, SCENES_DIR, OVERLAYS_DIR, OVERLAY_MASTERS_DIR,
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flags = [];
  const only = [];
  let outDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') { outDir = path.resolve(argv[++i]); continue; }
    if (argv[i].startsWith('--')) { flags.push(argv[i]); continue; }
    only.push(argv[i]);
  }
  const opts = {
    only,
    dry: flags.includes('--dry'),
    writeDay: !flags.includes('--no-day') && !flags.includes('--dry'),
    outDir,
  };

  run(opts).then((reports) => {
    if (!opts.dry && !opts.outDir) {
      console.log('wrote ' + path.relative(REPO, writeRuntime()));
      const rt = buildRuntime().times;
      Object.entries(rt).forEach(([t, v]) => {
        console.log(`  sprite tint ${t.padEnd(6)} ${v.tintHex}  alpha ${v.alpha}  (lut luma ${v.lumaRatio}x day)`);
      });
    }
    reports.forEach((r) => {
      console.log(`${r.id}  (${r.canonColours} canon colours, ${r.lights} lights)`);
      Object.entries(r.times).forEach(([t, s]) => {
        console.log(
          `  ${t.padEnd(6)} luma ${s.meanLuma.toFixed(1).padStart(6)} ` +
          `(${s.ratio.toFixed(2)}x day)  colours ${String(s.colours).padStart(3)}  ` +
          `warm ${s.warmPct.toFixed(1).padStart(5)}%`
        );
      });
    });
    const bad = reports.filter((r) => r.times.night && r.times.night.ratio > 0.5);
    if (bad.length) {
      console.error('\nFAILED: night is not dark enough on: ' + bad.map((b) => b.id).join(', '));
      process.exitCode = 1;
    } else {
      console.log(`\n${reports.length} location(s) relit${opts.dry ? ' (dry run)' : ''}`);
    }
  }).catch((e) => { console.error(e); process.exit(1); });
}
