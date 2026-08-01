'use strict';
/**
 * MELAKA FORGE — KIT: NATURE
 * ==========================
 * Water, palms, banana, jungle canopy and shorelines.
 *
 * TWO DEBTS THIS FILE EXISTS TO PAY OFF
 *
 *  1. THE STICK-FIGURE PALM. `props.cjs:potted-palm` draws six straight
 *     one-pixel spines off a two-pixel trunk. At 3x that is a TV aerial. A
 *     coconut palm is: a trunk that TAPERS and CURVES and is ringed by old
 *     frond scars; a crown where fronds leave the same point at every angle
 *     including toward and away from the camera; each frond an arching midrib
 *     with PINNAE hanging off both sides, thinning to a whip at the tip; and a
 *     cluster of nuts in the throat. Six elements. Below about 30px of crown
 *     there is no room for them, so `palm` refuses to go smaller than that and
 *     smaller greenery is a different prop.
 *
 *  2. THE FLAT BLUE RECTANGLE. Water is ~30% of the waterfront frame, so it
 *     carries that screen. See `texture.cjs:water()` for the treatment; the
 *     props here apply it, add the shoreline, and bake the reflections that
 *     make objects sit IN the water rather than on top of a blue shape.
 *
 * Registered into the shared table (registry.cjs), so every entry here is
 * usable from a layout's `props` array by `"type"`.
 */

const P = require('../palette.cjs');
const T = require('../texture.cjs');
const { hash2 } = require('../iso.cjs');
const { def } = require('./registry.cjs');
const { ellipsePts, contactShadow, isoCyl, lineTo, waterReflection, clamp } = require('./primitives.cjs');

const step = T.step;

// ---------------------------------------------------------------------------
// authoring helper: layouts speak (s, dd); some of these props want a screen
// rectangle instead, so accept both.
// ---------------------------------------------------------------------------
function screenBand(iso, o) {
  if (o.y0 !== undefined) {
    return { x0: o.x0 === undefined ? 0 : o.x0, x1: o.x1 === undefined ? 1e4 : o.x1, y0: o.y0, y1: o.y1 };
  }
  const a = iso.toScreen((o.sFrom + o.ddFrom) / 2, (o.sFrom - o.ddFrom) / 2, 0);
  const b = iso.toScreen((o.sTo + o.ddTo) / 2, (o.sTo - o.ddTo) / 2, 0);
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
}

// ---------------------------------------------------------------------------
// WATER
// ---------------------------------------------------------------------------
/**
 * Paint open water over a screen rectangle. Authored as a prop rather than a
 * ground material because the compositor's ground pass shades in TILE space
 * and water's whole look lives in screen space (see texture.cjs:water). The
 * matching ground region underneath still owns the walk mask — author it as
 * `"walkable": false, "surface": "water"` and this repaints it.
 */
def('water-field', { collide: false, examine: false }, (s, iso, o) => {
  const r = screenBand(iso, o);
  const shader = T.water({
    seed: o.seed || 77,
    horizonY: o.horizonY === undefined ? r.y0 : o.horizonY,
    nearY: o.nearY === undefined ? r.y1 : o.nearY,
    topStep: o.topStep, botStep: o.botStep,
    glintX: o.glintX === undefined ? -1 : o.glintX,
    glintW: o.glintW,
    chop: o.chop,
  });
  const x1 = Math.min(s.width, r.x1);
  const y1 = Math.min(s.height, r.y1);

  // MASKING BY MATERIAL. A shoreline is rarely a screen rectangle, and painting
  // water as a rectangle would flood the quay. So the layout gives the compositor
  // a `backdrop` of the water ramp (which is what sets the walk mask to blocked),
  // and this repaints only the pixels that are still that backdrop — the water
  // then has exactly the shape of the land the ground pass carved out of it.
  let match = null;
  if (o.matchRamp !== false) {
    match = new Set(P.RAMPS[o.matchRamp || 'water'].map((h) => h.toUpperCase()));
  }
  const hex = (px) => P.rgbToHex(px.r, px.g, px.b).toUpperCase();

  for (let y = Math.max(0, Math.floor(r.y0)); y < y1; y++) {
    for (let x = Math.max(0, Math.floor(r.x0)); x < x1; x++) {
      if (match) {
        const px = s.get(x, y);
        if (!px || px.a === 0 || !match.has(hex(px))) continue;
      }
      s.setHex(x, y, shader(0, 0, x, y));
    }
  }
  // A horizon seam: 1px of pale haze where sea meets sky, then a 2px darker
  // line under it. Without it the two blues touch and the join reads as a
  // rendering error rather than as distance.
  if (o.horizonSeam !== false) {
    const hy = Math.round(o.horizonY === undefined ? r.y0 : o.horizonY);
    const onWater = (x, y) => {
      if (!match) return true;
      const px = s.get(x, y);
      return px && px.a !== 0 && match.has(hex(px));
    };
    for (let x = Math.max(0, Math.floor(r.x0)); x < x1; x++) {
      if (!onWater(x, hy)) continue;
      s.setHex(x, hy, T.hazed(P.RAMPS.water[4], 0.55));
      if (onWater(x, hy + 1)) s.setHex(x, hy + 1, step(P.RAMPS.water, 3));
    }
  }
});

/**
 * The shoreline where water meets land: wet sand, a foam lip and the darker
 * band of water that always sits right against a beach.
 * Authored as a polyline of screen points so a river bank can wander.
 */
def('shore-edge', { collide: false, examine: false }, (s, iso, o) => {
  const pts = o.points || [];
  if (pts.length < 2) return;
  const seed = o.seed || 5;
  const waterAbove = o.waterAbove !== false;   // water on the -y side
  const foam = P.RAMPS.whitewash;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.abs(bx - ax));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = Math.round(ax + (bx - ax) * t);
      const y = Math.round(ay + (by - ay) * t);
      const wob = Math.round((hash2(Math.floor(x / 7), 0, seed) - 0.5) * 4);
      const yy = y + wob;
      const dir = waterAbove ? -1 : 1;
      // Wet sand, drying out inland — but kept SHALLOW and short. Darkening
      // the land side of a shoreline is the one thing that destroys the
      // benchmark #17 step there, because the water it borders is already the
      // darkest thing on the plate. Three pixels of damp, then dry sand.
      for (let d = 1; d < 4; d++) {
        T.shadePixel(s, x, yy - dir * d, 0.15 * (1 - d / 4));
      }
      // a bright lip of dried, wind-blown sand just inland of the wet line
      if (hash2(Math.floor(x / 6), 2, seed + 7) > 0.4) {
        s.setHex(x, yy - dir * 4, step(P.RAMPS.earth, 4));
      }
      // foam: a broken 2px lip, only where the hash says a wave is breaking
      const brk = hash2(Math.floor(x / 5), 1, seed + 3);
      if (brk > 0.42) {
        s.setHex(x, yy + dir * 1, step(foam, 4));
        if (brk > 0.74) s.setHex(x, yy + dir * 2, step(foam, 3));
        if (brk > 0.88) s.setHex(x + 1, yy + dir * 3, step(foam, 2));
      }
      // the shadow the beach throws into the shallows
      for (let d = 1; d < 4; d++) T.shadePixel(s, x, yy + dir * (2 + d), 0.20);
    }
  }
});

/** A sampan / hull reflection stamped into water already painted. */
def('water-reflection', { collide: false, examine: false }, (s, iso, o) => {
  waterReflection(s, o.x0, o.x1, o.baseY, o.height || 20, { seed: o.seed, strength: o.strength, squash: o.squash });
});

// ---------------------------------------------------------------------------
// PALMS
// ---------------------------------------------------------------------------
/**
 * One coconut palm. `h` is trunk height in NATIVE px measured to the crown
 * throat, so a 32px player standing under a `h: 74` palm has the correct
 * "the trees are much taller than me" reading the kampung needs.
 */
function drawPalm(s, iso, o) {
  const seed = o.seed || 1;
  const c = iso.toScreen(o.tx, o.ty, 0);
  const H = Math.max(30, o.h || 66);
  const lean = o.lean === undefined ? (hash2(seed, 7, 3) - 0.5) * 22 : o.lean;
  const fol = P.RAMPS.foliage;
  const tim = P.RAMPS.timber;
  const haze = o.haze || 0;
  const col = (ramp, i) => (haze ? T.hazed(step(ramp, i), haze) : step(ramp, i));

  // --- trunk: curved, tapered, ringed ------------------------------------
  const bend = (t) => lean * t * t;                 // leans away with height
  let topX = c.x, topY = c.y - H;
  for (let v = 0; v < H; v++) {
    const t = v / H;
    const w = Math.max(2, Math.round(5.2 - 2.8 * t));
    const x0 = Math.round(c.x + bend(t)) - Math.floor(w / 2);
    const y = Math.round(c.y) - 1 - v;
    for (let k = 0; k < w; k++) {
      let idx = k === 0 ? 4 : k === w - 1 ? 1 : k < w / 2 ? 3 : 2;
      // frond-scar rings every 4-5px: the single detail that says "palm"
      if ((v % (4 + (Math.floor(v / 17) % 2))) === 0) idx -= 1;
      s.setHex(x0 + k, y, col(tim, clamp(idx, 0, 4)));
    }
    if (v === H - 1) { topX = Math.round(c.x + bend(1)); topY = y; }
  }

  // --- crown -------------------------------------------------------------
  // Fronds at 9 angles around the full circle. Angles pointing "away" are
  // drawn shorter and higher, which is what gives the crown volume instead of
  // the flat fan the old prop had.
  const nF = o.fronds || 9;
  const R = o.crown || Math.round(25 + H * 0.22);
  const fronds = [];
  for (let i = 0; i < nF; i++) {
    const a = (i / nF) * Math.PI * 2 + hash2(seed, i, 11) * 0.24;
    const away = Math.sin(a) < 0;               // upper half of the circle
    fronds.push({ a, away, len: R * (away ? 0.72 : 1) * (0.82 + hash2(seed, i, 13) * 0.3), i });
  }
  // paint the away-fronds first so the near ones overlap them
  fronds.sort((p, q) => (p.away === q.away ? p.i - q.i : (p.away ? -1 : 1)));

  fronds.forEach((fr) => {
    const dirX = Math.cos(fr.a), dirY = Math.sin(fr.a) * 0.5;
    const droop = 0.9 + hash2(seed, fr.i, 17) * 0.7;
    const lit = dirX < 0;                        // sun is screen-left
    const base = lit ? 3 : 1;
    let prev = null;
    for (let k = 0; k <= fr.len; k++) {
      const t = k / fr.len;
      // midrib: leaves the throat rising, then arches over and droops
      const px = Math.round(topX + dirX * k);
      const py = Math.round(topY + dirY * k - Math.sin(Math.PI * Math.min(1, t * 0.8)) * 5 + droop * t * t * fr.len * 0.42);
      if (prev && (Math.abs(px - prev.x) > 1 || Math.abs(py - prev.y) > 1)) {
        lineTo(s, prev.x, prev.y, px, py, col(fol, base + 1));
      }
      prev = { x: px, y: py };
      s.setHex(px, py, col(fol, base + 1));
      if (t < 0.62) s.setHex(px, py + 1, col(fol, base));   // 2px midrib near the throat
      // PINNAE: leaflets hanging off both sides, longest at mid-frond,
      // shortening to a whip at the tip. Drawn every 2px so they cluster.
      if (k % 2 === 0 && t > 0.10) {
        const pl = Math.round((2.4 + 3.8 * Math.sin(Math.PI * t)) * (1 - t * 0.30));
        for (let q = 1; q <= pl; q++) {
          const sag = Math.round(q * 0.75);
          s.setHex(px, py + q + sag - 1, col(fol, base + (q < pl * 0.5 ? 1 : 0)));
          if (q <= pl - 1) s.setHex(px - 1, py - q + Math.round(q * 0.25), col(fol, base + 2));
        }
      }
    }
  });

  // --- coconuts + throat -------------------------------------------------
  if (o.nuts !== false) {
    for (let i = 0; i < 4; i++) {
      const nx = topX - 4 + i * 3 + Math.round(hash2(seed, i, 23) * 2);
      const ny = topY + 2 + (i % 2) * 3;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        s.setHex(nx + dx, ny + dy, step(P.RAMPS.timber, dx === 0 ? 3 : dx === 2 ? 1 : 2));
      }
    }
  }
  for (let dx = -3; dx <= 3; dx++) s.setHex(topX + dx, topY + 1, col(fol, dx < 0 ? 2 : 0));
  return { topX, topY };
}

def('palm', { collide: 0.4, examine: 'A coconut palm, its trunk ringed by a century of fallen fronds.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.7, 0.34);
  drawPalm(s, iso, o);
});

def('palm-cluster', { collide: 0.9, examine: 'A stand of coconut palms; the shade under them is the coolest place for a hundred paces.' }, (s, iso, o) => {
  const seed = o.seed || 1;
  const n = o.count || 3;
  const spread = o.spread === undefined ? 0.85 : o.spread;
  const specs = [];
  for (let i = 0; i < n; i++) {
    specs.push({
      tx: o.tx + (hash2(seed, i, 31) - 0.4) * spread,
      ty: o.ty + (hash2(seed, i, 37) - 0.4) * spread,
      h: Math.round((o.h || 64) * (0.74 + hash2(seed, i, 41) * 0.5)),
      seed: seed + i * 9,
      haze: o.haze,
    });
  }
  specs.sort((a, b) => (a.tx + a.ty) - (b.tx + b.ty));
  specs.forEach((sp) => {
    contactShadow(s, iso, sp.tx, sp.ty, 0.66, 0.30);
    drawPalm(s, iso, sp);
  });
});

// ---------------------------------------------------------------------------
// BANANA
// ---------------------------------------------------------------------------
/**
 * A banana clump (*pisang*). The read is entirely in the leaf: a huge paddle
 * with a pale midrib, torn into strips along its length by the monsoon. Three
 * or four of those, plus the sheath-layered pseudostem, is the whole plant.
 */
def('banana-plant', { collide: 0.7, examine: 'A clump of pisang, its leaves shredded to ribbons by the monsoon.' }, (s, iso, o) => {
  const seed = o.seed || 1;
  contactShadow(s, iso, o.tx, o.ty, 0.85, 0.34);
  const fol = P.RAMPS.foliage;
  const stems = o.count || 2;
  for (let i = 0; i < stems; i++) {
    const c = iso.toScreen(o.tx + (i - (stems - 1) / 2) * 0.24, o.ty + (i % 2) * 0.16, 0);
    const H = Math.round((o.h || 42) * (0.8 + hash2(seed, i, 3) * 0.4));
    // pseudostem: overlapping sheaths, so it is banded, not a pole
    for (let v = 0; v < H; v++) {
      const w = Math.max(3, Math.round(6 - v / H * 2));
      for (let k = 0; k < w; k++) {
        let idx = k === 0 ? 4 : k < w / 2 ? 3 : k === w - 1 ? 1 : 2;
        if ((v % 7) === 0) idx -= 1;
        s.setHex(Math.round(c.x) - Math.floor(w / 2) + k, Math.round(c.y) - 1 - v, step(fol, clamp(idx, 0, 4)));
      }
    }
    const tx0 = Math.round(c.x), ty0 = Math.round(c.y) - H;
    const nL = 4;
    for (let l = 0; l < nL; l++) {
      const a = -0.15 + (l / (nL - 1)) * (Math.PI + 0.3);
      const len = 23 + Math.round(hash2(seed, l + i * 5, 7) * 12);
      const lit = Math.cos(a) < 0;
      const half = 8.5;
      for (let k = 0; k < len; k++) {
        const t = k / len;
        const px = Math.round(tx0 + Math.cos(a) * k);
        const py = Math.round(ty0 + Math.sin(a) * k * 0.80 + t * t * 11);
        const wdt = Math.round(half * Math.sin(Math.PI * Math.min(1, 0.15 + t)) * (1 - t * 0.3));
        for (let q = -wdt; q <= wdt; q++) {
          // tear the blade into strips: whole runs of the leaf are missing
          if (hash2(l + i * 5, Math.floor(k / 7), seed + 11) < 0.14 && Math.abs(q) > wdt * 0.35) continue;
          const idx = q === 0 ? (lit ? 4 : 3)
            : lit ? (q < 0 ? 4 : 3) : (q < 0 ? 2 : 1);
          s.setHex(px, py + q, step(fol, idx));
        }
      }
    }
    if (i === 0 && o.fruit !== false) {
      // a hand of green bananas hanging under the crown
      for (let b = 0; b < 5; b++) {
        for (let k = 0; k < 6; k++) {
          s.setHex(tx0 - 2 + b, ty0 + 5 + k + Math.abs(b - 2), step(fol, b < 2 ? 3 : 2));
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// JUNGLE MASS  (background silhouette plane, benchmark #6)
// ---------------------------------------------------------------------------
/**
 * A band of jungle canopy across the back of a frame. Built as overlapping
 * lobes on two depth layers: the far layer is hazed hard and nearly flat, the
 * near layer keeps two more value steps and gets a lit rim on its upper-left.
 * The lobe outline is deliberately IRREGULAR at 3-6px scale — a canopy drawn
 * with smooth arcs reads as broccoli.
 */
def('canopy-band', { collide: false, examine: false }, (s, iso, o) => {
  const r = screenBand(iso, o);
  const seed = o.seed || 61;
  const layers = o.layers || 2;
  const fol = P.RAMPS.foliage;
  for (let L = 0; L < layers; L++) {
    const haze = (o.haze === undefined ? 0.42 : o.haze) * (1 - L / layers);
    const baseY = Math.round(r.y1 - L * (o.step === undefined ? 13 : o.step));
    const amp = (o.amp === undefined ? 20 : o.amp) * (1 - L * 0.18);
    const litIdx = L === layers - 1 ? 4 : 3;
    // A canopy is not a coloured rectangle with a wiggly top. Below the lit
    // shoulder it has to keep breaking into LOBES all the way down, or a 50px
    // deep band renders as one flat slab — which is exactly what the first
    // version did. So the interior is shaded on a 9x6 px lattice (clustered,
    // never per-pixel) and every local bump in the profile gets its own lit
    // crown, giving the mass a read of overlapping tree tops.
    const cols = [0, 1, 2, 3, 4].map((i) => T.hazed(step(fol, i), haze));
    const x0i = Math.max(0, Math.floor(r.x0)), x1i = Math.min(s.width, r.x1);
    const profile = (x) => {
      const jit = (hash2(Math.floor(x / 3), L, seed) - 0.5) * 5;
      return amp * (0.55 + 0.45 * Math.sin(x / 27 + L * 2.1))
        * (0.7 + 0.3 * Math.sin(x / 9.5 + L)) + jit + (o.base === undefined ? 16 : o.base);
    };
    for (let x = x0i; x < x1i; x++) {
      const h = profile(x);
      const top = Math.round(baseY - h);
      // is this column near the crest of a lobe? (compare with neighbours)
      const crest = h >= profile(x - 5) && h >= profile(x + 5);
      for (let y = top; y < baseY; y++) {
        const d = y - top;
        const deep = d / Math.max(1, h);
        // interior lobes: a coarse lattice with its own little crowns
        const lob = hash2(Math.floor(x / 9), Math.floor(y / 6), seed + L * 7);
        let idx = deep < 0.10 ? litIdx : deep < 0.30 ? litIdx - 1 : deep < 0.62 ? 2 : 1;
        if (lob > 0.80) idx += 1;
        else if (lob < 0.26) idx -= 1;
        // the top 2px of each interior lobe cell catches the sun
        if ((y % 6) === 0 && lob > 0.55 && deep > 0.12) idx += 1;
        s.setHex(x, y, cols[clamp(idx, 0, 4)]);
      }
      if (crest) {
        for (let k = 0; k < 3; k++) s.setHex(x, top + k, cols[clamp(litIdx + (k === 0 ? 0 : -1), 0, 4)]);
        s.setHex(x + 1, top + 1, cols[clamp(litIdx, 0, 4)]);
      }
      // dark undergrowth line where this layer meets the one in front
      s.setHex(x, baseY - 1, cols[0]);
    }
  }
  // a few crowns breaking the skyline so it is not one continuous hedge
  (o.crowns || []).forEach((cw, i) => {
    drawPalm(s, iso, { tx: cw.tx, ty: cw.ty, h: cw.h || 58, seed: seed + i * 7, haze: (o.haze === undefined ? 0.42 : o.haze) * 0.55, nuts: false });
  });
});

/** Low scrub / lalang grass — fills the awkward ground between canopy and sand. */
def('scrub', { collide: false, examine: false }, (s, iso, o) => {
  const seed = o.seed || 9;
  const c = iso.toScreen(o.tx, o.ty, 0);
  const fol = P.RAMPS.foliage;
  const n = o.blades || 26;
  const spreadX = o.spreadX || 16;
  for (let i = 0; i < n; i++) {
    const bx = Math.round(c.x + (hash2(seed, i, 3) - 0.5) * spreadX * 2);
    const by = Math.round(c.y + (hash2(seed, i, 5) - 0.5) * (o.spreadY || 6));
    const h = 4 + Math.round(hash2(seed, i, 7) * (o.h || 7));
    const curl = hash2(seed, i, 11) < 0.5 ? -1 : 1;
    const lit = curl < 0;
    for (let v = 0; v < h; v++) {
      const gx = bx + Math.round(curl * (v / h) * (v / h) * 3);
      s.setHex(gx, by - v, step(fol, lit ? 3 : 1));
      s.setHex(gx + 1, by - v, step(fol, lit ? 4 : 2));
    }
  }
});

/** A single mature shade tree (angsana / rain tree) for a village common. */
def('shade-tree', { collide: 0.8, examine: 'An old rain tree; the whole kampung takes its afternoons under it.' }, (s, iso, o) => {
  const seed = o.seed || 3;
  contactShadow(s, iso, o.tx, o.ty, 1.9, 0.36);
  const c = iso.toScreen(o.tx, o.ty, 0);
  const H = o.h || 52;
  const tim = P.RAMPS.timber, fol = P.RAMPS.foliage;
  // buttressed trunk
  for (let v = 0; v < H; v++) {
    const t = v / H;
    const w = Math.max(4, Math.round(11 - 7 * Math.pow(t, 0.55)));
    for (let k = 0; k < w; k++) {
      const idx = k === 0 ? 4 : k < w * 0.4 ? 3 : k === w - 1 ? 1 : 2;
      s.setHex(Math.round(c.x) - Math.floor(w / 2) + k, Math.round(c.y) - 1 - v, step(tim, idx));
    }
  }
  // limbs
  [[-1, 0.9], [1, 0.85], [-1, 0.6], [1, 0.55]].forEach(([dir, at], i) => {
    const y0 = Math.round(c.y) - Math.round(H * at);
    lineTo(s, c.x, y0, c.x + dir * (14 + i * 3), y0 - 10 - i * 2, step(tim, dir < 0 ? 3 : 1), { thickness: 2 });
  });
  // crown: overlapping lobes, flat-topped the way a rain tree is
  const cy = Math.round(c.y) - H - 8;
  const lobes = [[0, 0, 30, 13], [-20, 5, 20, 10], [21, 6, 19, 9], [-9, -7, 18, 9], [11, -8, 17, 8]];
  lobes.forEach(([dx, dy, rx, ry], i) => {
    s.fillPoly(ellipsePts(c.x + dx, cy + dy, rx, ry, 26), (uu, vv, x, y) => {
      const ddx = (x + 0.5 - (c.x + dx)) / rx, ddy = (y + 0.5 - (cy + dy)) / ry;
      let idx = ddy < -0.35 ? 4 : ddx < -0.2 ? 3 : ddx < 0.4 ? 2 : 1;
      if (hash2(Math.floor(x / 4), Math.floor(y / 3), seed + i) < 0.22) idx -= 1;
      return step(fol, clamp(idx, 0, 4));
    });
  });
});

module.exports = { drawPalm, screenBand };
