'use strict';
/**
 * MELAKA FORGE — MATERIAL TEXTURES
 * ================================
 * Clustered-shading fills derived from the canon ramps in palette.cjs.
 *
 * THE RULES THESE EXIST TO ENFORCE  (art-critic defect #8: "pixelated paintings
 * with per-pixel noise and uniform 50% Bayer soup")
 *   1. NO per-pixel noise. Every variation is CLUSTERED: it lives on a lattice
 *      whose cell is >= 4 native px, so the eye reads "stone block", "plank",
 *      "roof pan" — a repeating unit — not "grain".
 *   2. NO field dither. Ordered dither is legal ONLY as a 2-3 px band at a
 *      ramp transition (`transitionBand`) or on a >20px atmospheric gradient
 *      (`skyGradient`). Never as a flat fill.
 *   3. 3-5 VALUES PER MATERIAL. Shaders take a `light` offset (from
 *      iso.FACE_LIGHT) and everything shifts together, so one sun rules.
 *   4. DETERMINISTIC. hash2() only.
 *
 * A shader is `(u, v, x, y) => hexString | null`. For ground fills u,v are
 * TILE coordinates; for wall faces they are face-local px; for roof planes they
 * are metric px in the plane.
 */

const P = require('./palette.cjs');
const { hash2 } = require('./iso.cjs');

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** ramp step accessor with clamping; `light` shifts the whole material. */
function step(ramp, i) { return ramp[clamp(Math.round(i), 0, ramp.length - 1)]; }

/**
 * The only legal dither: a 2-3 px checker band where two ramp steps meet.
 * t = 0 -> all `a`, t = 1 -> all `b`. Band width is controlled by the caller
 * (feed it a t that only moves across 2-3 px).
 */
const BAND2 = [[0, 2], [3, 1]];
function transitionBand(a, b, t, x, y) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const th = (BAND2[y & 1][x & 1] + 0.5) / 4;
  return t > th ? b : a;
}

// 4x4 ordered Bayer — atmospheric gradients ONLY (sky, deep water)
const BAYER4 = P.BAYER4;
function bayer(x, y) { return (BAYER4[y & 3][x & 3] + 0.5) / 16; }

// ---------------------------------------------------------------------------
// GROUND MATERIALS   (u, v are tile coords; 1 tile = tileWidth screen px)
// ---------------------------------------------------------------------------

/**
 * Cobbled street. Sub-divides each tile into `n` x `n` iso cells, so cobbles
 * are diamonds ~ (tileWidth/n) x (tileHeight/n) px — at n=4, 8x4 px. Each
 * cobble is ONE value (clustered), joints are one step down.
 */
function cobble(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'stone'];
  const n = o.n || 4;
  const L = (o.light === undefined ? 3 : o.light);
  const seed = o.seed || 11;
  const jointW = o.joint === undefined ? 0.13 : o.joint;
  return (tx, ty, x, y) => {
    // stagger alternate courses so cobbles don't line up into a grid
    const row = Math.floor(ty * n);
    const shift = (row & 1) ? 0.5 : 0;
    const cu = tx * n + shift;
    const fu = cu - Math.floor(cu), fv = ty * n - row;
    const i = Math.floor(cu), j = row;
    const h = hash2(i, j, seed);
    if (fu < jointW || fv < jointW) return step(ramp, L - 2);
    // ONE value per cobble. Keep the run of same-value cobbles high: too much
    // per-stone variation turns a street into fish scales.
    const s = L + (h < 0.12 ? 1 : h < 0.28 ? -1 : 0);
    return step(ramp, s);
  };
}

/** Packed golden earth / dust. Two cluster scales, zero per-pixel noise. */
function dirt(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'earth'];
  const L = (o.light === undefined ? 3 : o.light);
  const seed = o.seed || 23;
  const big = o.bigScale || 1.5;   // tiles
  const small = o.smallScale || 0.45;
  return (tx, ty, x, y) => {
    const hb = hash2(Math.floor(tx / big), Math.floor(ty / big), seed);
    const hs = hash2(Math.floor(tx / small), Math.floor(ty / small), seed + 7);
    let s = L;
    if (hb < 0.30) s -= 1;
    else if (hb > 0.80) s += 1;
    if (hs > 0.93) s -= 1;          // scattered pebbles / hoof-scuffs
    else if (hs < 0.05) s += 1;
    return step(ramp, s);
  };
}

/** Sand / beach — same machinery, warmer and flatter. */
function sand(opts) {
  return dirt(Object.assign({ material: 'earth', light: 4, bigScale: 2.2, smallScale: 0.7 }, opts));
}

/** Flagstone / large slabs (church forecourt, quay). */
function flagstone(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'stone'];
  const n = o.n || 2;
  const L = (o.light === undefined ? 3 : o.light);
  const seed = o.seed || 31;
  const wear = o.wear === undefined ? 1 : o.wear;
  return (tx, ty, x, y) => {
    const j = Math.floor(ty * n);
    // Rows are staggered by a per-row amount and slabs are PAIRED at random,
    // so the paving has 1x and 2x slab widths instead of one uniform grid.
    // A regular grid of randomly-valued cells is a chessboard, not paving.
    const cu = tx * n + hash2(0, j, seed + 3) * 0.7;
    let i = Math.floor(cu);
    let wide = false;
    if (hash2(i - (i & 1), j, seed + 11) < 0.30) { i -= (i & 1); wide = true; }
    const fu = cu - Math.floor(cu), fv = ty * n - j;
    if (fu < 0.035 || fv < 0.05) return step(ramp, L - 2);  // joint (thin)
    if (wide && ((cu - i) > 0.965 && (cu - i) < 1.035)) return step(ramp, L - 2);

    let s = L;
    // most slabs sit at the base value; only ~22% deviate
    const h = hash2(i, j, seed);
    if (h < 0.11) s -= 1; else if (h > 0.89) s += 1;

    // WORN PATHS: darker lanes running ALONG the street (constant tx+ty), broken
    // into segments across it, so they read as traffic rather than blotches.
    if (wear) {
      const lane = Math.floor((tx + ty) / 1.7);
      const seg = Math.floor((tx - ty) / 4.5);
      if (hash2(lane, seg, seed + 31) > 0.74) s -= 1;
    }

    // PATCHED REPAIRS: ~7% of slabs are relaid as small setts
    if (hash2(i, j, seed + 53) > 0.93) {
      const su = Math.floor(fu * 2), sv = Math.floor(fv * 2);
      if (fu * 2 - su < 0.16 || fv * 2 - sv < 0.22) return step(ramp, L - 2);
      return step(ramp, L - 1 + (hash2(su + i, sv + j, seed + 7) > 0.62 ? 1 : 0));
    }

    // Lit arris on the up-left (NW-facing) edge — but only on SOME slabs. A
    // highlight on every slab edge rebuilds the very lattice the staggering was
    // meant to destroy, and the paving reads as a game board.
    if (fu < 0.11 && hash2(i, j, seed + 71) > 0.52) s += 1;
    return step(ramp, s);
  };
}

/**
 * Trodden earth roadway. Large FLAT patches with sparse, deliberately placed
 * incidents — cart ruts along the street, dark damp patches, and scatter whose
 * density is driven by `hotspots` (stall fronts, doorways, the well), so the
 * street looks used where people actually stand.
 *
 * opts.ruts:     [{ s, w }]  cart ruts on constant tx+ty lines
 * opts.hotspots: [{ s, dd, r }] screen-space density centres (r in px)
 */
function trodden(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'earth'];
  const L = (o.light === undefined ? 2 : o.light);
  const seed = o.seed || 61;
  const ruts = o.ruts || [];
  const hots = o.hotspots || [];
  return (tx, ty, x, y) => {
    const s0 = tx + ty, dd = tx - ty;
    let s = L;

    // Patch boundaries are WOBBLED before the lattice lookup, otherwise a
    // coarse lattice on an iso ground paints hard-edged 80px diamonds that read
    // as leftover map regions rather than as ground.
    const wob = (hash2(Math.floor(tx / 0.55), Math.floor(ty / 0.55), seed + 3) - 0.5) * 0.62;
    const wob2 = (hash2(Math.floor(ty / 0.55), Math.floor(tx / 0.55), seed + 9) - 0.5) * 0.62;

    // big flat patches: 2.6-tile lattice, only ~28% deviate at all
    const hb = hash2(Math.floor((tx + wob) / 2.6), Math.floor((ty + wob2) / 2.6), seed);
    if (hb < 0.15) s -= 1; else if (hb > 0.87) s += 1;
    // secondary patches, sparser still
    const hm = hash2(Math.floor((tx + wob2) / 1.15), Math.floor((ty + wob) / 1.15), seed + 5);
    if (hm > 0.93) s += 1; else if (hm < 0.07) s -= 1;

    // cart ruts: two-value grooves along the street
    for (let k = 0; k < ruts.length; k++) {
      const d = Math.abs(s0 - ruts[k].s);
      const w = ruts[k].w === undefined ? 0.34 : ruts[k].w;
      if (d < w) {
        // broken, not continuous — a rut fades in and out along its length
        if (hash2(Math.floor(dd / 2.2), k, seed + 17) > 0.22) s -= (d < w * 0.45 ? 2 : 1);
      }
    }

    // incident density: 0 in the open street, 1 at a stall front or doorway
    let dens = 0;
    for (let k = 0; k < hots.length; k++) {
      const dx = (dd - hots[k].dd) * 16, dy = (s0 - hots[k].s) * 8;
      const t = 1 - Math.sqrt(dx * dx + dy * dy) / (hots[k].r || 40);
      if (t > dens) dens = t;
    }
    if (dens > 0) {
      const hd = hash2(Math.floor(tx / 0.22), Math.floor(ty / 0.22), seed + 13);
      if (hd > 1 - 0.10 * dens) s -= 1;        // scuffed / damp underfoot
      else if (hd < 0.06 * dens) s += 1;       // spilled straw and chaff
    }
    return step(ramp, s);
  };
}

/** Timber decking / boardwalk laid along the tx axis. */
function deck(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'timber'];
  const L = (o.light === undefined ? 3 : o.light);
  const seed = o.seed || 41;
  const n = o.n || 4;             // planks per tile
  return (tx, ty, x, y) => {
    const j = Math.floor(ty * n);
    const fv = ty * n - j;
    if (fv < 0.10) return step(ramp, L - 2);
    const board = Math.floor(tx * 0.6);
    const h = hash2(board, j, seed);
    let s = L + (h < 0.22 ? -1 : h > 0.80 ? 1 : 0);
    if ((tx * 0.6 - board) < 0.04) s -= 2;   // butt joints
    return step(ramp, s);
  };
}

// ---------------------------------------------------------------------------
// WALL MATERIALS   (u = px along the face, v = px up from the base)
// ---------------------------------------------------------------------------

/**
 * Lime plaster / whitewash. A white wall must stay WHITE in shade, so the
 * ramp's vGamma keeps steps 1-3 in the top half of the value range. The look
 * comes from: an eave shadow, a splash-stained dado with a 3px transition
 * band, and sparse large weather-blotches (never speckle).
 */
function plaster(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'whitewash'];
  const L = (o.light === undefined ? 3 : o.light);
  const seed = o.seed || 5;
  const dado = o.dado === undefined ? 9 : o.dado;      // px of stained base
  const eave = o.eave === undefined ? 4 : o.eave;      // px of roof shadow
  const height = o.height || 48;
  return (u, v, x, y) => {
    let s = L;
    // large soft weathering blotches on a 9x7 px lattice (readable clusters)
    const h = hash2(Math.floor(u / 9), Math.floor(v / 7), seed);
    if (h < 0.16) s -= 1;
    else if (h > 0.90) s += 1;
    // vertical rain-streaks under the eaves: 3px wide, every ~13px, top third
    if (v > height * 0.55) {
      const c = Math.floor(u / 13);
      if (hash2(c, 3, seed + 2) > 0.72 && (u % 13) < 3) s -= 1;
    }
    // eave shadow at the top, with a 3px checker transition band
    if (v >= height - eave) return step(ramp, s - 2);
    if (v >= height - eave - 3) {
      return transitionBand(step(ramp, s), step(ramp, s - 2), (v - (height - eave - 3)) / 3, x, y);
    }
    // splash dado at the base + 3px band
    if (v < dado) return step(ramp, s - 2);
    if (v < dado + 3) {
      return transitionBand(step(ramp, s - 2), step(ramp, s), (v - dado) / 3, x, y);
    }
    return step(ramp, s);
  };
}

/** Coursed ashlar / laterite blocks. Blocks are the cluster unit. */
function ashlar(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'stone'];
  const L = (o.light === undefined ? 3 : o.light);
  const seed = o.seed || 17;
  const bw = o.blockW || 10, bh = o.blockH || 6;
  return (u, v, x, y) => {
    const row = Math.floor(v / bh);
    const off = (row & 1) ? bw / 2 : 0;
    const col = Math.floor((u + off) / bw);
    const fu = (u + off) - col * bw, fv = v - row * bh;
    if (fu < 1 || fv < 1) return step(ramp, L - 2);           // mortar joint
    // Most block faces are FLAT. A bright bevel plus a dark bevel on every
    // single block turns coursed masonry into quilted upholstery — so only the
    // 1px top arris catches the NW sun, and only ~20% of blocks shift value.
    const h = hash2(col, row, seed);
    let s = L + (h < 0.10 ? -1 : h > 0.90 ? 1 : 0);
    if (fv >= bh - 1) s += 1;
    return step(ramp, s);
  };
}

/** Vertical plank wall (godowns, stalls, kampung). */
function plank(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'timber'];
  const L = (o.light === undefined ? 3 : o.light);
  const seed = o.seed || 29;
  const w = o.plankW || 5;
  return (u, v, x, y) => {
    const col = Math.floor(u / w);
    const fu = u - col * w;
    const h = hash2(col, 0, seed);
    let s = L + (h < 0.26 ? -1 : h > 0.78 ? 1 : 0);
    if (fu < 1) s -= 2;                    // shadow gap between boards
    else if (fu > w - 2) s += 1;           // lit edge
    if (hash2(col, Math.floor(v / 11), seed + 3) > 0.93) s -= 1;   // knot / stain band
    return step(ramp, s);
  };
}

/** Timber frame + plaster infill (upper storeys, kampung shophouses). */
function halfTimber(opts) {
  const o = opts || {};
  const wall = plaster(Object.assign({}, o, { eave: o.eave === undefined ? 3 : o.eave, dado: 0 }));
  const beam = P.RAMPS[o.beamMaterial || 'timber'];
  const L = (o.light === undefined ? 3 : o.light);
  const bay = o.bay || 22;
  return (u, v, x, y) => {
    const fu = u % bay;
    if (fu < 3) return step(beam, L - 1);
    if (v < 3 || v > (o.height || 44) - 4) return step(beam, L - 1);
    return wall(u, v, x, y);
  };
}

// ---------------------------------------------------------------------------
// ROOF MATERIALS   (u = px along the eave, v = px up the slope)
// ---------------------------------------------------------------------------

/**
 * Portuguese/Chinese pan-and-cover terracotta tiles. The repeating unit is a
 * 5px pan: shadow-groove | base | highlight-crown | base | shadow-groove.
 * Courses every 6px. This is the single most identity-carrying texture in the
 * game — it is what makes a roof read as Melaka and not as a brown triangle.
 */
function roofTile(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'terracotta'];
  const L = (o.light === undefined ? 3 : o.light);
  const seed = o.seed || 13;
  const pan = o.pan || 5, course = o.course || 6;
  return (u, v, x, y) => {
    const p = Math.floor(u / pan), fu = u - p * pan;
    const c = Math.floor(v / course), fv = v - c * course;
    // per-pan weathering, constant down the whole pan = clustered, not noise
    const h = hash2(p, Math.floor(c / 3), seed);
    let s = L + (h < 0.20 ? -1 : h > 0.84 ? 1 : 0);
    if (fu < 1) s -= 2;                 // groove between pans
    else if (fu === 2) s += 1;          // crown catches the sun
    else if (fu >= pan - 1) s -= 1;
    if (fv < 1) s -= 1;                 // course overlap line
    else if (fv === 1) s += (fu >= 1 && fu <= 3) ? 1 : 0;
    return step(ramp, s);
  };
}

/** Attap / nipah thatch: 5px courses with a ragged 2px lower edge. */
function thatch(opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'timber'];
  const L = (o.light === undefined ? 3 : o.light);
  const seed = o.seed || 19;
  const course = o.course || 5;
  return (u, v, x, y) => {
    const c = Math.floor(v / course), fv = v - c * course;
    const jag = Math.floor(hash2(Math.floor(u / 3), c, seed) * 2);
    let s = L + (hash2(Math.floor(u / 7), c, seed + 5) > 0.72 ? 1 : 0);
    if (fv < 1 + jag) s -= 2;
    else if (fv > course - 2) s += 1;
    return step(ramp, s);
  };
}

// ---------------------------------------------------------------------------
// ATMOSPHERE
// ---------------------------------------------------------------------------

/**
 * Tropical sky. The ONE place a 4x4 Bayer field is legal: a >20px vertical
 * gradient. Bands are still restricted to 3px at each ramp transition, so the
 * result is a banded sky, not a fog of noise.
 */
function skyGradient(opts) {
  const o = opts || {};
  const ramp = P.RAMPS.sky;
  const y0 = o.y0 || 0, y1 = o.y1 || 40;
  const topStep = o.topStep === undefined ? ramp.length - 1 : o.topStep;
  const botStep = o.botStep === undefined ? 1 : o.botStep;
  return (u, v, x, y) => {
    const t = clamp((y - y0) / Math.max(1, y1 - y0), 0, 1);
    const f = topStep + (botStep - topStep) * t;
    const lo = Math.floor(f), hi = Math.min(ramp.length - 1, lo + 1);
    const frac = f - lo;
    // Narrow dithered zone: most of the sky is FLAT banded colour and only the
    // seam between two ramp steps is Bayered. A gradient dithered end to end is
    // a noise field, which is the thing this whole module exists to stop.
    if (frac < 0.34) return step(ramp, lo);
    if (frac > 0.66) return step(ramp, hi);
    return bayer(x, y) < (frac - 0.34) / 0.32 ? step(ramp, hi) : step(ramp, lo);
  };
}

/**
 * Distant haze: pull a colour toward the PALE horizon step of the sky ramp.
 * (Mixing toward the zenith step instead turns distance navy-blue, which reads
 * as sea — the exact failure the first rua-direita render produced.)
 */
function hazed(hex, amount) {
  // Haze target = pale sky warmed toward the golden ground bounce. Pure sky
  // haze turns the distance grey-blue and reads as sea; Melaka's air is dusty.
  const sky = P.hexToRgb(P.RAMPS.sky[P.RAMPS.sky.length - 1]);
  const warm = P.hexToRgb(P.RAMPS.earth[4]);
  const a = P.hexToRgb(hex), b = P.mixRgb(sky, warm, 0.42);
  const m = P.mixRgb(a, b, clamp(amount, 0, 1));
  return P.nearest(m.r, m.g, m.b).hex;
}

/** Solid fill shader. */
function flat(hex) { return () => hex; }

// ---------------------------------------------------------------------------
// SHADING OPERATORS  (applied to already-drawn pixels)
// ---------------------------------------------------------------------------

/**
 * Ambient-occlusion contact band. Darkens `depth` px above a baseline using a
 * 2-3px checker so the object reads as SITTING on the ground rather than
 * pasted onto it. Uses the shared violet shadow anchor, never black.
 */
function aoBand(surface, x, y, depth, strength) {
  const anchor = P.ANCHORS['shadow-violet'];
  for (let d = 0; d < depth; d++) {
    const base = (strength || 0.42) * (1 - d / depth);
    surface.blendHex(x, y - d, anchor, base * (checker2(x, y - d) ? 1 : 0.6));
  }
}

/** Darken a pixel toward the shadow anchor (cast shadows on ground). */
function shadePixel(surface, x, y, t) {
  surface.blendHex(x, y, P.ANCHORS['shadow-violet'], t);
}

/**
 * 2x2-BLOCK checker. Shadows and AO must dither on a 2px grid, never 1px: a
 * 1px checker over a large area is a 50% Bayer field by another name, and it
 * is what drives the isolated-pixel metric through the roof. At 3x upscale a
 * 2px block is a chunky, deliberate 6px screen cell.
 */
function checker2(x, y) { return ((x >> 1) + (y >> 1)) & 1; }

/**
 * Cast a flat ground shadow for a polygon, offset down-right (sun is NW).
 * Rendered as a 2-value checker so it reads as pixel art, not a blur.
 */
function castShadow(surface, poly, offset, strength) {
  const off = offset || { x: 6, y: 3 };
  const pts = poly.map((p) => ({ x: p.x + off.x, y: p.y + off.y }));
  const s = strength === undefined ? 0.38 : strength;
  surface.fillPoly(pts, (u, v, x, y) => {
    shadePixel(surface, x, y, checker2(x, y) ? s : s * 0.55);
    return null;
  });
}

/**
 * Selective outline for a silhouette against the background: darkest own-hue
 * step on the shadow (down-right) side only. Plate scenery must NOT get a
 * uniform outline (benchmark #16) — this is for props read against ground.
 */
function selectiveOutline(surface, poly, ramp, sides) {
  const s = sides || { x: 1, y: 1 };
  const dark = ramp[0];
  const pts = poly.map((p) => ({ x: p.x + s.x, y: p.y + s.y }));
  surface.fillPoly(pts, (u, v, x, y) => null);
  return dark;
}

module.exports = {
  step, transitionBand, bayer, hash2,
  cobble, dirt, sand, flagstone, trodden, deck,
  plaster, ashlar, plank, halfTimber,
  roofTile, thatch,
  skyGradient, hazed, flat,
  aoBand, shadePixel, castShadow, selectiveOutline, checker2,
  clamp,
};
