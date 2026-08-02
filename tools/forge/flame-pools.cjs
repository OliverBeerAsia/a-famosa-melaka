'use strict';
/**
 * MELAKA FORGE — FLAME POOL DELTA SPRITES
 * =======================================
 * `assets/sprites/effects/flame-pool-<r>.png` — four sheets at native radii
 * 34, 42, 50, 58, three frames each, frame size 2r x 2r.
 *
 * WHAT THESE ARE FOR
 * ------------------
 * Our night and dusk plates have their light pools PAINTED IN
 * (`relight-plates.cjs` light pass), so classic in-place palette rotation is
 * not available at runtime — there is no index map to rotate. What is
 * available, and what actually reads, is a small ADDITIVE FLICKER DELTA
 * cycling on top of each baked pool. Three palette states presented in
 * sequence is exactly what Ultima VII's cycling did in effect, at the cost of
 * one texture-frame change per period tick.
 *
 * THE RULES THAT MAKE THEM PIXEL ART AND NOT A GLOW
 * ------------------------------------------------
 *  - canon colours ONLY, three per state, straight off the palette;
 *  - hard edges: alpha is 0 or 255, never in between. The falloff is carried
 *    by ORDERED-DITHER COVERAGE, not by an alpha ramp — an anti-aliased radial
 *    gradient is the single most reliable way to break a pixel-art frame
 *    (benchmark gate #18, "zero AA alpha");
 *  - a 2-px dithered ring at the outer edge so the pool does not end on a
 *    hard circle;
 *  - deterministic: the dither is a fixed 4x4 Bayer matrix, no RNG anywhere.
 *
 *   state   core        mid         ring        canon indices
 *   A hot   #FFF4D4     #F5C860     #D8A428     49 -> 48 -> 47
 *   B base  #F5C860     #D8A428     #B47844     48 -> 47 -> 8
 *   C low   #D8A428     #B47844     #844020     47 -> 8  -> 7
 *
 * CLI
 *   node tools/forge/flame-pools.cjs            # write the four sheets
 *   node tools/forge/flame-pools.cjs --out DIR
 */

const fs = require('fs');
const path = require('path');

const { Surface } = require('./surface.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'assets', 'sprites', 'effects');

/** Nearest-class assignment covers every authored radius (34..58). */
const RADII = [34, 42, 50, 58];

const STATES = [
  { id: 'A', core: '#FFF4D4', mid: '#F5C860', ring: '#D8A428' },
  { id: 'B', core: '#F5C860', mid: '#D8A428', ring: '#B47844' },
  { id: 'C', core: '#D8A428', mid: '#B47844', ring: '#844020' },
];

/** 4x4 ordered-Bayer thresholds, normalised to (0, 1). */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bayer = (x, y) => (BAYER4[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;

/**
 * Coverage as a function of normalised radius. Three flat bands, then a
 * dithered tail. Deliberately NOT smooth: a pool of light in this idiom is a
 * few stepped rings, not a gradient.
 */
function bandAt(t) {
  // COVERAGE, not alpha. Only the small core is solid; every band outward is
  // dithered at a lower density. This matters more than it looks: at ADD blend
  // over an ALREADY-BAKED pool, a solid disc adds its full value across ~250
  // screen px and reads as a decal stuck on the plate rather than as the
  // baked pool breathing. Measured in-engine at night on rua-direita — the
  // first cut used coverage 1.0 out to 0.82 and the delta drowned the pool it
  // was supposed to be modulating.
  if (t <= 0.26) return { band: 'core', coverage: 1 };
  if (t <= 0.46) return { band: 'core', coverage: 0.55 };
  if (t <= 0.66) return { band: 'mid', coverage: 0.42 };
  if (t <= 0.84) return { band: 'ring', coverage: 0.28 };
  if (t <= 1.0) {
    // The dithered outer edge, in normalised radius so it scales with the class.
    const u = (t - 0.84) / 0.16;
    return { band: 'ring', coverage: 0.28 * (1 - u) };
  }
  return { band: null, coverage: 0 };
}

function drawState(surface, ox, r, state) {
  const size = r * 2;
  const cx = r - 0.5;
  const cy = r - 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / r;
      // Light pools on a 2:1 iso ground plane are ellipses, not circles.
      const dy = ((y - cy) / r) * 2;
      const t = Math.sqrt(dx * dx + dy * dy);
      const { band, coverage } = bandAt(t);
      if (!band || coverage <= 0) continue;
      if (coverage < 1 && bayer(x, y) >= coverage) continue;
      surface.setHex(ox + x, y, state[band]);
    }
  }
}

function buildSheet(r) {
  const surface = new Surface(r * 2 * STATES.length, r * 2);
  STATES.forEach((state, i) => drawState(surface, i * r * 2, r, state));
  return surface;
}

/** The radius class a light of radius `r` renders with. */
function classFor(r) {
  let best = RADII[0];
  let bestD = Infinity;
  for (const c of RADII) {
    const d = Math.abs(c - r);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function run(argv) {
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : DEFAULT_OUT;
  fs.mkdirSync(outDir, { recursive: true });

  for (const r of RADII) {
    const sheet = buildSheet(r);
    const file = path.join(outDir, `flame-pool-${r}.png`);
    sheet.writePNG(file);
    console.log(`flame-pool-${r}.png  ${sheet.width}x${sheet.height}  (${STATES.length} frames of ${r * 2}x${r * 2})`);
  }
  return { ok: true };
}

module.exports = { run, buildSheet, classFor, RADII, STATES };

if (require.main === module) run(process.argv.slice(2));
