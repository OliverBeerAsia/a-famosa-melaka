'use strict';
/**
 * MELAKA FORGE — TORSO, COSTUME, ACCESSORIES (Melaka, c.1580)
 * ===========================================================
 * Shoulder width, slope, posture and lean are per-character skeleton params —
 * they are half of the silhouette-uniqueness budget. Costume is period- and
 * culture-specific:
 *   Portuguese  doublet, small ruff or falling band, gorget, sash
 *   Jesuit      black cassock, white clerical band
 *   Malay       baju with shawl/selendang, kain over a bare shoulder
 *   Chinese     Ming merchant robe, standing (mandarin) collar, frog closure
 *   Omani       dishdasha with embroidered placket, khanjar cord
 *   Tamil       angavastram over one shoulder with a woven border
 */

const { Mask, spanMask, ellipseMask, rectMask, polyMask, arcMask, lineMask, clamp } = require('./raster.cjs');
const { paintVolume } = require('./shade.cjs');
const { addMod } = require('./anatomy.cjs');
const { mat, skinRamp } = require('./ramps.cjs');

/**
 * A CLOTH FOLD, drawn as clustered dabs along its crest.
 *
 * THE DEFECT THIS REPLACES. Every fold used to be `pic.paint(arc, hex)` — an
 * unbroken 1px stroke running the whole height of the torso. At 80px native
 * that is a 40-pixel hairline, and a 40-pixel hairline over a flat field does
 * not read as a fold in cloth; it reads as a SCRATCH ON THE IMAGE. Half the
 * cast had two of them.
 *
 * What real cloth does, and what pixel art has always drawn, is a fold that
 * catches the light in BROKEN CLUSTERS: three or four pixels together where the
 * crest turns into the key, then nothing where it turns away, then another
 * cluster. So the arc is still the geometry — the fold goes exactly where it
 * went before — but only the lit runs of it are painted, they are 1-2px wide
 * instead of always 1, and the fold FADES OUT before the bottom of the frame
 * rather than running off the edge like a ruled line.
 *
 *   dir     which way the cluster thickens (toward the fold's lit side)
 *   period  cluster pitch down the fold
 *   run     how many rows of each period are painted
 *   fade    fraction of the fold's length after which it dies out
 */
function foldCluster(pic, bodyMask, arc, hex, opts) {
  const o = opts || {};
  const rows = new Map();
  arc.forEach((x, y) => {
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(x);
  });
  const ys = [...rows.keys()].sort((a, b) => a - b);
  const n = ys.length;
  if (!n) return;
  const period = o.period == null ? 7 : o.period;
  const run = o.run == null ? 4 : o.run;
  const fade = o.fade == null ? 0.84 : o.fade;
  const dir = o.dir == null ? 1 : o.dir;
  const seed = o.seed == null ? 0 : o.seed;
  ys.forEach((y, i) => {
    if (i / Math.max(1, n - 1) > fade) return;         // the fold dies out
    const phase = (i + seed) % period;
    if (phase >= run) return;                          // the gap between clusters
    // fat in the middle of a cluster, single-pixel at its ends: a highlight
    // that starts and stops at full width is a dash, which is the same defect
    // one size up.
    const wide = phase > 0 && phase < run - 1;
    rows.get(y).forEach((x) => {
      pic.set(x, y, hex);
      if (wide && bodyMask.get(x + dir, y)) pic.set(x + dir, y, hex);
    });
  });
}

function buildTorso(m, spec) {
  const W = m.W, H = m.H;
  const g = spec.body || {};
  const shoulderHalf = (g.shoulderW == null ? 1.9 : g.shoulderW) * m.U;
  const run = g.shoulderRun == null ? 9 : g.shoulderRun;   // how fast the trapezius flares
  const lean = g.lean == null ? 0 : g.lean;                 // px of body lean
  const drop = g.shoulderDrop == null ? 0 : g.shoulderDrop; // asymmetric slope
  // shoulderRaise: how high the bust is cropped. A hunched elder's shoulders
  // climb toward the jaw; a soldier squares them low and wide. This is the
  // single biggest lever on how much of the frame the torso occupies, and
  // therefore on silhouette uniqueness.
  const y0 = m.neckBottom - 2 - (g.shoulderRaise || 0);
  const cxT = m.cx + (g.shift || 0);

  const mask = spanMask(W, H, y0, H - 1, (y) => {
    const t = clamp((y - y0) / run, 0, 1);
    const e = Math.pow(t, g.roundShoulder == null ? 0.55 : g.roundShoulder);
    let w = m.neckW * 1.05 + (shoulderHalf - m.neckW * 1.05) * e;
    if (y > y0 + run) w = shoulderHalf * (1 + 0.055 * ((y - y0 - run) / 6));
    const c = cxT + lean * (t + Math.max(0, (y - y0 - run) / 10));
    return [c - w * (1 + drop * 0.10), c + w * (1 - drop * 0.10)];
  });
  // asymmetric shoulder height (posture): shave the high side down
  if (drop) {
    const rows = Math.abs(drop) * 7;
    const cut = spanMask(W, H, y0, y0 + rows, (y) => {
      const t = (y - y0) / Math.max(1, rows);
      const side = drop > 0 ? 1 : -1;
      const edge = cxT + side * (shoulderHalf * (0.24 + 0.80 * Math.pow(t, 0.7)));
      return side > 0 ? [edge, W - 1] : [0, edge];
    });
    mask.andNot(cut);
  }
  return { mask, shoulderHalf, y0, cxT };
}

// ---------------------------------------------------------------------------
// COLLARS
// ---------------------------------------------------------------------------
const COLLARS = {
  none: () => {},

  /** Small late-16th-c. ruff — a pleated band, not a cartwheel. */
  ruff(pic, m, t, o, mods) {
    const R = mat(o.collarMat || 'linen-white');
    const cy = m.neckBottom - 0.5;
    const band = ellipseMask(m.W, m.H, m.neckCx, cy, m.neckW * 1.90, 2.6)
      .andNot(ellipseMask(m.W, m.H, m.neckCx, cy - 1.8, m.neckW * 1.00, 2.2));
    paintVolume(pic, band, R, { axis: 'cylX', bias: -0.15, rimDark: true });
    for (let i = -3; i <= 3; i++) {
      const a = m.neckCx + i * (m.neckW * 0.62);
      pic.paint(lineMask(m.W, m.H, a, cy - 2.2, a + i * 0.3, cy + 2.2, 1).and(band), R[1]);
    }
    addMod(mods, m.W, band.dilate(1).andNot(band).and(m.neckMask), -1.2);
  },

  /** Falling band / plain linen collar over the doublet. */
  band(pic, m, t, o) {
    const R = mat(o.collarMat || 'linen-white');
    const cy = m.neckBottom + 0.5;
    const c = polyMask(m.W, m.H, [
      [m.neckCx - m.neckW * 2.4, cy + 3.0],
      [m.neckCx - m.neckW * 1.0, cy - 0.8],
      [m.neckCx + m.neckW * 1.0, cy - 0.8],
      [m.neckCx + m.neckW * 2.4, cy + 3.0],
      [m.neckCx, cy + 4.4],
    ]).and(t.mask);
    paintVolume(pic, c, R, { axis: 'cylX', bias: 0.25, rimDark: true });
  },

  /** Jesuit cassock: dark cloth to the throat with a white band. */
  clerical(pic, m, t, o) {
    const R = mat(o.collarMat || 'linen-white');
    const cy = m.neckBottom - 1.0;
    const band = spanMask(m.W, m.H, cy, cy + 1.8, (y) => {
      const w = m.neckW * (1.06 + 0.10 * (y - cy));
      return [m.neckCx - w, m.neckCx + w];
    });
    paintVolume(pic, band, R, { axis: 'cylX', bias: 0.4 });
    // the cassock's centre closure
    const dark = mat(o.mat || 'wool-black');
    pic.paint(lineMask(m.W, m.H, m.neckCx + 1, cy + 3, m.neckCx + 2, m.H - 1, 1).and(t.mask), dark[0]);
    for (let i = 0; i < 4; i++) {
      pic.paint(ellipseMask(m.W, m.H, m.neckCx + 1.4 + i * 0.2, cy + 5 + i * 4, 0.7, 0.7).and(t.mask), dark[3]);
    }
  },

  /** Doublet V-opening with a shirt showing and a button column. */
  doublet(pic, m, t, o) {
    const R = mat(o.shirtMat || 'linen-white');
    const cy = m.neckBottom - 1;
    const v = polyMask(m.W, m.H, [
      [m.neckCx - m.neckW * 1.5, cy],
      [m.neckCx + m.neckW * 1.5, cy],
      [m.neckCx + 0.5, cy + 9],
    ]).and(t.mask);
    paintVolume(pic, v, R, { axis: 'cylY', bias: 0.2 });
    const B = mat(o.buttonMat || 'brass');
    for (let i = 0; i < 4; i++) {
      const y = cy + 9 + i * 4;
      pic.paint(ellipseMask(m.W, m.H, m.neckCx + 1.0, y, 0.9, 0.9).and(t.mask), B[2]);
      pic.paint(ellipseMask(m.W, m.H, m.neckCx + 1.4, y + 0.5, 0.4, 0.4).and(t.mask), B[0]);
    }
    // lapel edges
    pic.paint(lineMask(m.W, m.H, m.neckCx - m.neckW * 1.5, cy, m.neckCx - 0.5, cy + 10, 1).and(t.mask), mat(o.mat || 'wool-black')[0]);
    pic.paint(lineMask(m.W, m.H, m.neckCx + m.neckW * 1.5, cy, m.neckCx + 1.5, cy + 10, 1).and(t.mask), mat(o.mat || 'wool-black')[3]);
  },

  /** Ming standing collar + diagonal robe closure. */
  mandarin(pic, m, t, o) {
    const R = mat(o.collarMat || 'linen-white');
    const cy = m.neckBottom - 3.5;
    const stand = spanMask(m.W, m.H, cy, cy + 4.2, (y) => {
      const w = m.neckW * (1.16 + 0.05 * (y - cy));
      return [m.neckCx - w, m.neckCx + w];
    }).andNot(m.neckMask.erode(1));
    paintVolume(pic, stand, R, { axis: 'cylX', bias: 0.35, rimDark: true });
    const D = mat(o.mat || 'wool-indigo');
    // the diagonal overlap sweeping to the wearer's right
    const diag = polyMask(m.W, m.H, [
      [m.neckCx - m.neckW * 1.2, cy + 4.2],
      [m.neckCx + m.neckW * 3.0, cy + 10.5],
      [m.neckCx + m.neckW * 3.0, cy + 13.0],
      [m.neckCx - m.neckW * 1.2, cy + 6.6],
    ]).and(t.mask);
    paintVolume(pic, diag, D, { axis: 'flat', bias: -1.2 });
    // frog buttons along the closure
    const B = mat('brass');
    for (let i = 0; i < 3; i++) {
      pic.paint(ellipseMask(m.W, m.H, m.neckCx + m.neckW * (0.6 + i * 1.1), cy + 6.0 + i * 2.0, 0.8, 0.8).and(t.mask), B[2]);
    }
  },

  /** Plain round neck with an embroidered placket (dishdasha). */
  placket(pic, m, t, o) {
    const R = mat(o.trimMat || 'brass');
    const cy = m.neckBottom + 0.5;
    const ring = ellipseMask(m.W, m.H, m.neckCx, cy + 1.0, m.neckW * 1.5, 2.6)
      .andNot(ellipseMask(m.W, m.H, m.neckCx, cy + 0.4, m.neckW * 1.15, 2.0));
    paintVolume(pic, ring.and(t.mask), R, { axis: 'cylX', bias: 0.2 });
    const strip = rectMask(m.W, m.H, m.neckCx - 1.0, cy + 2.5, m.neckCx + 1.0, cy + 12).and(t.mask);
    paintVolume(pic, strip, R, { axis: 'cylY', bias: -0.2 });
    for (let i = 0; i < 4; i++) {
      pic.paint(lineMask(m.W, m.H, m.neckCx - 1, cy + 4 + i * 2.2, m.neckCx + 1, cy + 4 + i * 2.2, 1).and(strip), R[0]);
    }
  },

  /** Malay baju neckline: a slit with a narrow trim, shawl over the shoulders. */
  baju(pic, m, t, o) {
    const R = mat(o.trimMat || 'brass');
    const cy = m.neckBottom + 0.5;
    const ring = ellipseMask(m.W, m.H, m.neckCx, cy + 1.2, m.neckW * 1.45, 2.8)
      .andNot(ellipseMask(m.W, m.H, m.neckCx, cy + 0.6, m.neckW * 1.10, 2.2));
    paintVolume(pic, ring.and(t.mask), R, { axis: 'cylX', bias: 0.15 });
    pic.paint(lineMask(m.W, m.H, m.neckCx, cy + 3.0, m.neckCx + 0.6, cy + 7.5, 1).and(t.mask), R[0]);
  },

  /** Tamil angavastram: cloth over one shoulder with a woven border. */
  angavastram(pic, m, t, o) {
    const R = mat(o.wrapMat || 'linen-white');
    const B = mat(o.borderMat || 'wool-crimson');
    const side = o.side == null ? -1 : o.side;
    const y0 = t.y0 - 1;
    const band = polyMask(m.W, m.H, [
      [t.cxT + side * t.shoulderHalf * 1.05, y0 + 1],
      [t.cxT + side * t.shoulderHalf * 0.30, y0 + 1],
      [t.cxT - side * t.shoulderHalf * 0.95, m.H - 1],
      [t.cxT - side * t.shoulderHalf * 0.20, m.H - 1],
    ]).and(t.mask);
    paintVolume(pic, band, R, { axis: 'cylY', bias: 0.25, rimDark: true });
    const border = polyMask(m.W, m.H, [
      [t.cxT + side * t.shoulderHalf * 0.42, y0 + 1],
      [t.cxT + side * t.shoulderHalf * 0.30, y0 + 1],
      [t.cxT - side * t.shoulderHalf * 0.95, m.H - 1],
      [t.cxT - side * t.shoulderHalf * 0.74, m.H - 1],
    ]).and(band);
    paintVolume(pic, border, B, { axis: 'flat', bias: 0.6 });
    // Fold lines in the drape — clustered, not ruled. See foldCluster().
    for (let i = 0; i < 3; i++) {
      const arc = arcMask(m.W, m.H,
        t.cxT + side * t.shoulderHalf * (0.9 - i * 0.22), y0 + 2 + i,
        t.cxT - side * t.shoulderHalf * (0.3 + i * 0.2), m.H - 1, side * 2, 1).and(band);
      foldCluster(pic, band, arc, R[0], { dir: -side, period: 7 + i, run: 4, seed: i * 3, fade: 0.9 });
    }
  },

  /** Bare shoulder with a kain / towel slung over it. */
  kain(pic, m, t, o) {
    const R = mat(o.wrapMat || 'cotton-ochre');
    const side = o.side == null ? 1 : o.side;
    const band = polyMask(m.W, m.H, [
      [t.cxT + side * t.shoulderHalf * 1.10, t.y0 + 2],
      [t.cxT + side * t.shoulderHalf * 0.42, t.y0 + 1],
      [t.cxT + side * t.shoulderHalf * 0.30, m.H - 1],
      [t.cxT + side * t.shoulderHalf * 1.15, m.H - 1],
    ]).and(t.mask);
    paintVolume(pic, band, R, { axis: 'cylY', bias: 0.2, rimDark: true });
    for (let i = 0; i < 3; i++) {
      const arc = arcMask(m.W, m.H,
        t.cxT + side * t.shoulderHalf * (1.05 - i * 0.2), t.y0 + 3 + i * 2,
        t.cxT + side * t.shoulderHalf * (0.36 + i * 0.12), m.H - 1, -side * 1.6, 1).and(band);
      foldCluster(pic, band, arc, R[0], { dir: side, period: 6 + i, run: 4, seed: i * 4, fade: 0.9 });
    }
  },
};

// ---------------------------------------------------------------------------
// ACCESSORIES
// ---------------------------------------------------------------------------
const ACCESSORIES = {
  /** Steel gorget over the shoulders. */
  gorget(pic, m, t) {
    const R = mat('steel');
    const cy = m.neckBottom + 1;
    const g = ellipseMask(m.W, m.H, m.neckCx, cy + 2.5, m.neckW * 2.6, 4.4)
      .andNot(ellipseMask(m.W, m.H, m.neckCx, cy - 0.6, m.neckW * 1.12, 3.0))
      .and(t.mask);
    paintVolume(pic, g, R, { axis: 'cylX', bias: 0.35, spec: 0.55, rimDark: true });
    pic.paint(arcMask(m.W, m.H, m.neckCx - m.neckW * 2.4, cy + 4.5, m.neckCx + m.neckW * 2.4, cy + 4.5, -1.6, 1).and(g), R[0]);
  },
  /** Officer's crimson sash across the chest. */
  sash(pic, m, t, o) {
    const R = mat(o && o.mat || 'wool-crimson');
    const side = (o && o.side) || -1;
    const band = polyMask(m.W, m.H, [
      [t.cxT + side * t.shoulderHalf * 0.98, t.y0 + 3],
      [t.cxT + side * t.shoulderHalf * 0.58, t.y0 + 3],
      [t.cxT - side * t.shoulderHalf * 0.85, m.H - 1],
      [t.cxT - side * t.shoulderHalf * 0.35, m.H - 1],
    ]).and(t.mask);
    paintVolume(pic, band, R, { axis: 'cylY', bias: 0.2, rimDark: true });
  },
  /** Merchant's chain of office. */
  chain(pic, m, t) {
    const R = mat('brass');
    const cy = m.neckBottom + 2;
    const arc = arcMask(m.W, m.H, m.neckCx - m.neckW * 2.0, cy + 1, m.neckCx + m.neckW * 2.0, cy + 1, 4.6, 1).and(t.mask);
    let i = 0;
    arc.forEach((x, y) => { if (i++ % 2 === 0) pic.set(x, y, R[2]); else pic.set(x, y, R[1]); });
  },
  /** Leather satchel strap (the notary runner). */
  strap(pic, m, t, o) {
    const R = mat('leather');
    const side = (o && o.side) || 1;
    const band = polyMask(m.W, m.H, [
      [t.cxT + side * t.shoulderHalf * 0.92, t.y0 + 2],
      [t.cxT + side * t.shoulderHalf * 0.62, t.y0 + 2],
      [t.cxT - side * t.shoulderHalf * 0.62, m.H - 1],
      [t.cxT - side * t.shoulderHalf * 0.30, m.H - 1],
    ]).and(t.mask);
    paintVolume(pic, band, R, { axis: 'cylY', bias: 0.1, rimDark: true });
  },
  /** Gold hoop earring. */
  earring(pic, m) {
    const R = mat('brass');
    const x = m.earCx + m.turnDir * 0.2, y = m.earCy + 3.2 * (m.earSize || 1);
    const hoop = ellipseMask(m.W, m.H, x, y, 1.6, 1.9).andNot(ellipseMask(m.W, m.H, x, y, 0.7, 1.0));
    paintVolume(pic, hoop, R, { axis: 'sphere', bias: 0.5 });
  },
  /** Prayer beads / tasbih at the neck. */
  beads(pic, m, t) {
    const R = mat('timber-wall');
    const cy = m.neckBottom + 3;
    for (let i = -3; i <= 3; i++) {
      const x = m.neckCx + i * 1.8;
      const y = cy + Math.abs(i) * 0.9;
      pic.paint(ellipseMask(m.W, m.H, x, y, 0.8, 0.8).and(t.mask), i % 2 ? R[1] : R[2]);
    }
  },
  /** Khanjar cord across the chest (Omani nakhoda). */
  cord(pic, m, t, o) {
    const R = mat('brass');
    const side = (o && o.side) || -1;
    const band = polyMask(m.W, m.H, [
      [t.cxT + side * t.shoulderHalf * 0.86, t.y0 + 4],
      [t.cxT + side * t.shoulderHalf * 0.70, t.y0 + 4],
      [t.cxT - side * t.shoulderHalf * 0.52, m.H - 1],
      [t.cxT - side * t.shoulderHalf * 0.36, m.H - 1],
    ]).and(t.mask);
    paintVolume(pic, band, R, { axis: 'cylY', bias: -0.1 });
  },
};

function drawGarment(pic, m, spec, mods) {
  const t = buildTorso(m, spec);
  const g = spec.garment || {};
  const base = mat(g.mat || 'cotton-brown');

  // bare skin torso (fisherman) is a legal option
  if (g.bare) {
    const skin = skinRamp(spec.culture);
    paintVolume(pic, t.mask, [skin[0], skin[1], skin[2], skin[3]], { axis: 'cylY', bias: -0.35, rimDark: true });
  } else {
    paintVolume(pic, t.mask, base, { axis: 'cylY', bias: g.bias == null ? -0.1 : g.bias, rimDark: true });
    // Shoulder folds, so cloth reads as cloth. Drawn as CLUSTERED dabs along
    // the fold, never as one continuous 1px stroke — see foldCluster().
    const seamL = arcMask(m.W, m.H, t.cxT - t.shoulderHalf * 0.66, t.y0 + 2, t.cxT - t.shoulderHalf * 0.44, m.H - 6, -1.2, 1).and(t.mask);
    const seamR = arcMask(m.W, m.H, t.cxT + t.shoulderHalf * 0.70, t.y0 + 3, t.cxT + t.shoulderHalf * 0.52, m.H - 8, 1.2, 1).and(t.mask);
    foldCluster(pic, t.mask, seamL, base[Math.max(0, 1)], { dir: -1, period: 8, run: 5, seed: 3 });
    foldCluster(pic, t.mask, seamR, base[Math.min(base.length - 1, 3)], { dir: 1, period: 7, run: 4, seed: 11 });
  }

  const collar = COLLARS[g.collar || 'none'];
  if (!collar) throw new Error('unknown collar: ' + g.collar);
  collar(pic, m, t, g, mods);

  (g.accessories || []).forEach((a) => {
    const name = typeof a === 'string' ? a : a.name;
    const fn = ACCESSORIES[name];
    if (!fn) throw new Error('unknown accessory: ' + name);
    fn(pic, m, t, typeof a === 'string' ? null : a);
  });

  // the head casts onto the chest
  addMod(mods, m.W, new Mask(m.W, m.H), 0);
  return t.mask;
}

module.exports = { buildTorso, COLLARS, ACCESSORIES, drawGarment, foldCluster };
