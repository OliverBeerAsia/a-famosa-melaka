'use strict';
/**
 * MELAKA FORGE — HAIR AS SHAPED MASS
 * ==================================
 * Hair is a volume with a hairline, a parting, strand clusters and a silhouette
 * that breaks the skull outline. It is never a solid bib, and facial hair never
 * covers the mouth: the mouth opening is subtracted from every beard mass.
 */

const { Mask, spanMask, ellipseMask, rectMask, arcMask, polyMask, clamp } = require('./raster.cjs');
const { addMod } = require('./anatomy.cjs');
const { paintVolume } = require('./shade.cjs');

// ---------------------------------------------------------------------------
// HAIR STYLES
// ---------------------------------------------------------------------------
// lift       px the mass rises above the skull crown
// side       px the mass thickens outside the skull contour at the sides
// down       fraction of head height the side mass descends to
// hairline   fraction of head height where the hairline sits
// recede     0..1 temple recession (M-shaped hairline)
// peak       px of widow's-peak dip at the centre
// crownBare  0..1 amount of crown shaved (tonsure) or bald
// jag        strand-cluster notch depth in px
// lobes      extra volume [dxFromCx, dyFromTop, rx, ry]
const HAIR = {
  'none':        { lift: 0, side: 0, down: 0.00, hairline: 0.00, recede: 0, peak: 0, crownBare: 1, jag: 0, lobes: [] },
  'short-crop':  { lift: 1.5, side: 1.4, down: 0.52, hairline: 0.24, recede: 0.15, peak: 0, jag: 1.0, lobes: [] },
  'combed':      { lift: 2.5, side: 1.8, down: 0.56, hairline: 0.23, recede: 0.25, peak: 1.0, jag: 1.2, lobes: [[-0.4, 0.10, 3.8, 3.0]] },
  'receding':    { lift: 1.2, side: 2.0, down: 0.64, hairline: 0.36, recede: 0.55, peak: 1.2, jag: 1.0, lobes: [] },
  'balding':     { lift: 0.5, side: 1.6, down: 0.66, hairline: 0.38, recede: 0.85, peak: 0.2, crownBare: 0.80, jag: 1.0, lobes: [] },
  'tonsure':     { lift: 0.8, side: 2.2, down: 0.66, hairline: 0.38, recede: 0.45, peak: 0.0, crownBare: 0.58, jag: 0.7, lobes: [] },
  'slicked':     { lift: 1.5, side: 1.2, down: 0.54, hairline: 0.26, recede: 0.45, peak: 1.0, jag: 0.5, lobes: [[0.55, 0.24, 3.0, 4.0]] },
  'long-loose':  { lift: 2, side: 2.2, down: 1.28, hairline: 0.26, recede: 0.10, peak: 0.8, jag: 1.8, lobes: [] },
  'bun':         { lift: 2.0, side: 1.5, down: 0.52, hairline: 0.21, recede: 0.10, peak: 0.4, jag: 0.6, lobes: [[-1.02, 0.02, 4.0, 3.4]] },
  'curly':       { lift: 3.5, side: 2.6, down: 0.66, hairline: 0.26, recede: 0.20, peak: 1.2, jag: 1.7, lobes: [[-0.85, 0.16, 3.6, 3.4], [0.85, 0.18, 3.0, 3.2]] },
  'tied-back':   { lift: 1, side: 0.6, down: 0.54, hairline: 0.26, recede: 0.20, peak: 0.4, jag: 0.5, lobes: [[-1.05, 0.42, 2.0, 3.6]] },
  'wrapped':     { lift: 0, side: 1.0, down: 0.46, hairline: 0.26, recede: 0.10, peak: 0.5, jag: 0.9, lobes: [] },
  'veiled':      { lift: 0, side: 0.6, down: 0.40, hairline: 0.27, recede: 0.05, peak: 0.4, jag: 0.6, lobes: [] },
};

/** Build the hair mass (a Mask) without painting it. */
function hairMask(m, spec) {
  const s = { crownBare: 0, ...(HAIR[spec.hair && spec.hair.style] || HAIR['short-crop']), ...(spec.hair && spec.hair.over || {}) };
  const W = m.W, H = m.H;
  if (spec.hair && spec.hair.style === 'none') return new Mask(W, H);
  const rand = spec.rand;
  const topY = m.top - s.lift;
  const downY = m.top + s.down * m.hh;
  const hairY = m.top + s.hairline * m.hh;

  // 1. the mass, hugging and overshooting the skull contour
  let mass = spanMask(W, H, topY, downY, (y) => {
    const yy = Math.max(y, m.top);
    const t = clamp((y - topY) / Math.max(1, downY - topY), 0, 1);
    const grow = s.side * (0.55 + 0.75 * Math.min(1, t * 1.7));
    return [m.left(yy) - grow, m.right(yy) + grow];
  });
  // cranium cap above the skull top
  mass.or(spanMask(W, H, topY, m.top + 1, (y) => {
    const t = clamp((m.top + 1 - y) / Math.max(1, s.lift + 1), 0, 1);
    const w = m.halfW(m.top + 2 + t * 2) * (1 - 0.30 * t * t) + s.side * 0.5;
    return [m.centreX(m.top) - w, m.centreX(m.top) + w];
  }));

  // 2. lobes (buns, curl volumes, tails)
  (s.lobes || []).forEach(([dx, dy, rx, ry]) => {
    mass.or(ellipseMask(W, H, m.cx + dx * m.U, m.top + dy * m.hh, rx, ry));
  });

  // 3. the hairline: carve the forehead back out of the mass
  const face = spanMask(W, H, m.top - 4, m.chinY + 2, (y) => {
    const yy = clamp(y, m.top, m.chinY);
    return [m.left(yy) + 0.4, m.right(yy) - 0.4];
  });
  const foreheadCut = new Mask(W, H);
  for (let x = 0; x < W; x++) {
    const t = clamp((x - m.centreX(hairY)) / Math.max(1, m.halfW(hairY)), -1, 1);
    // M-shaped recession: temples pull the hairline up, centre may peak down
    const recede = s.recede * m.hh * 0.17 * Math.pow(Math.abs(t), 1.6);
    const peak = s.peak * (1 - Math.min(1, Math.abs(t) * 3.0));
    const yLine = hairY - recede + peak;
    for (let y = Math.round(yLine); y < H; y++) foreheadCut.set(x, y);
  }
  mass.andNot(foreheadCut.and(face));

  // 4. crown baldness / tonsure — a bare disc on top of the skull
  if (s.crownBare > 0) {
    const cy = m.top + m.hh * (0.02 + 0.10 * s.crownBare);
    const bare = ellipseMask(W, H, m.centreX(cy) + m.turnPx * 0.2, cy,
      m.U * (0.30 + 0.68 * s.crownBare), m.hh * (0.06 + 0.26 * s.crownBare));
    mass.andNot(bare);
  }

  // 5. strand clusters: notch the silhouette so it is not a helmet
  if (s.jag > 0 && rand) {
    const bb = mass.bbox();
    if (bb) {
      const notches = 5 + Math.round(rand() * 4);
      for (let i = 0; i < notches; i++) {
        const side = i % 2 ? 1 : -1;
        const py = m.top - s.lift + (m.hh * s.down + s.lift) * rand();
        const yy = clamp(py, m.top, m.chinY);
        const px = m.centreX(yy) + side * (m.halfW(yy) + s.side * 1.35);
        mass.andNot(ellipseMask(W, H, px, py, s.jag * (0.7 + rand() * 0.6), s.jag * (0.8 + rand())));
      }
      // and a notch or two out of the very top of the mass
      for (let i = 0; i < 2; i++) {
        mass.andNot(ellipseMask(W, H, m.cx + (rand() - 0.5) * m.U * 1.6, m.top - s.lift - 0.5,
          s.jag * (0.8 + rand()), s.jag * (0.7 + rand() * 0.7)));
      }
      // and add a few clumps back out past the edge
      for (let i = 0; i < notches - 2; i++) {
        const side = i % 2 ? 1 : -1;
        const py = m.top + m.hh * (0.10 + rand() * 0.5);
        const px = m.centreX(py) + side * (m.halfW(py) + s.side * 0.8);
        mass.or(ellipseMask(W, H, px, py, s.jag * 0.9, s.jag * (1.0 + rand())));
      }
    }
  }

  if (spec.hair && spec.hair.tuckEar) mass.andNot(m.earMask.dilate(1));
  return mass;
}

function drawHair(pic, m, spec, ramp, mods) {
  const mass = spec._hairMask || hairMask(m, spec);
  if (!mass.count()) return mass;
  paintVolume(pic, mass, ramp, { axis: 'sphere', bias: -0.85, rimDark: true });

  const rand = spec.rand;
  const s = { ...(HAIR[spec.hair && spec.hair.style] || HAIR['short-crop']) };
  // parting + strand streaks: 2 dark, 2 light, following the mass
  const bb = mass.bbox();
  if (bb && rand) {
    const partX = m.cx + (spec.hair && spec.hair.part != null ? spec.hair.part : -0.45) * m.U;
    const streaks = 3 + Math.round(rand() * 3);
    for (let i = 0; i < streaks; i++) {
      const x0 = partX + (rand() - 0.5) * m.U * 0.5;
      const x1 = bb.x0 + rand() * (bb.x1 - bb.x0);
      const y0 = bb.y0 + 1 + rand() * 2;
      const y1 = y0 + 3 + rand() * (bb.y1 - y0 - 2);
      const bow = (x1 - x0) * 0.25;
      const a = arcMask(m.W, m.H, x0, y0, x1, y1, bow, 1).and(mass);
      pic.paint(a, i % 2 === 0 ? ramp[0] : ramp[Math.min(2, ramp.length - 1)]);
    }
  }
  // hair casts onto the forehead
  const brow = mass.dilate(1).andNot(mass).and(m.headMask);
  addMod(mods, m.W, brow, -0.62);
  void s;
  return mass;
}

// ---------------------------------------------------------------------------
// FACIAL HAIR
// ---------------------------------------------------------------------------
// cover  0..1 how much of the jaw the beard wraps
// top    fraction of head height where the beard starts on the cheek
// drop   px the beard extends below the chin
// width  multiplier on the chin coverage
const BEARDS = {
  none:        null,
  stubble:     { cover: 0.9, top: 0.70, drop: 0, width: 1.0, shade: true },
  goatee:      { cover: 0.0, top: 0.86, drop: 2.5, width: 0.46 },
  vandyke:     { cover: 0.0, top: 0.86, drop: 3.0, width: 0.42, moustacheLink: true },
  pointed:     { cover: 0.30, top: 0.80, drop: 5.0, width: 0.52, taper: 0.35 },
  'short-full':{ cover: 0.82, top: 0.68, drop: 1.6, width: 0.98 },
  full:        { cover: 0.88, top: 0.66, drop: 3.0, width: 0.94 },
  'wispy-chin':{ cover: 0.0, top: 0.92, drop: 5.5, width: 0.26, wispy: true },
  mutton:      { cover: 0.9, top: 0.56, drop: -1.0, width: 0.30 },
};

const MOUSTACHES = {
  none:   null,
  thin:   { w: 0.60, h: 1, droop: 0, gap: 1 },
  full:   { w: 0.80, h: 2, droop: 0, gap: 1 },
  waxed:  { w: 1.00, h: 1, droop: -2.0, gap: 1, curl: true },
  droop:  { w: 0.70, h: 1, droop: 3.4, gap: 1, thin: true },
  walrus: { w: 0.88, h: 2, droop: 1.6, gap: 0 },
};

function facialHairMask(m, spec) {
  const W = m.W, H = m.H;
  const out = new Mask(W, H);
  const b = BEARDS[(spec.beard && spec.beard.style) || 'none'];
  const mo = MOUSTACHES[(spec.moustache && spec.moustache.style) || 'none'];
  const d = m.turnDir;

  if (b && !b.shade) {
    const y0 = m.top + b.top * m.hh;
    const y1 = m.chinY + b.drop;
    const mass = spanMask(W, H, y0, y1, (y) => {
      const yy = Math.min(y, m.chinY);
      const hw = m.halfW(yy);
      const c = m.centreX(yy);
      let w;
      if (y <= m.chinY) {
        const t = clamp((y - y0) / Math.max(1, m.chinY - y0), 0, 1);
        w = hw * (b.width * (0.55 + 0.45 * t)) * (b.cover > 0 ? (0.6 + 0.5 * b.cover) : 1);
        if (b.cover > 0) w = Math.max(w, hw * (0.30 + 0.72 * b.cover) * (0.5 + 0.6 * t));
      } else {
        const t = clamp((y - m.chinY) / Math.max(1, y1 - m.chinY), 0, 1);
        const taper = b.taper != null ? b.taper : 0.75;
        w = hw * b.width * (1 - t * (1 - taper)) * (b.wispy ? 0.55 * (1 - t * 0.5) : 1);
        if (b.cover > 0) w *= 1.0;
      }
      const cc = m.axisAt(Math.min(y, m.chinY)) * 0.6 + c * 0.4;
      return [cc - w, cc + w];
    });
    // beards hang below the jaw but never balloon past the shoulders
    out.or(mass);
    if (b.cover > 0) {
      // sideburn connection up to the ear
      out.or(spanMask(W, H, m.yEye + 1, m.chinY, (y) => {
        const hw = m.halfW(y), c = m.centreX(y);
        const t = clamp((y - m.yEye) / Math.max(1, m.chinY - m.yEye), 0, 1);
        const th = 1.4 + 2.2 * b.cover * t;
        return d > 0 ? [c - hw - 0.4, c - hw + th] : [c + hw - th, c + hw + 0.4];
      }));
    }
  }

  if (mo) {
    const y = m.yMouth - 1.6;
    const ax = m.axisAt(y);
    const half = mo.w * m.U * 0.52;
    const mm = polyMask(W, H, [
      [ax - d * half * 1.02, y - mo.h * 0.5],
      [ax + d * half * 0.86, y - mo.h * 0.5],
      [ax + d * half * 0.80, y + mo.h * 0.5 + 0.6],
      [ax - d * half * 0.96, y + mo.h * 0.5 + 0.6],
    ]);
    out.or(mm);
    if (mo.droop > 0) {
      [[-d, 1.0], [d, 0.85]].forEach(([side, k]) => {
        const x = ax + side * half * 0.94;
        out.or(spanMask(W, H, y, y + mo.droop * k, (yy) => {
          const t = (yy - y) / Math.max(1, mo.droop * k);
          const w = (mo.thin ? 0.9 : 1.4) * (1 - 0.45 * t);
          const xx = x + side * t * 1.2;
          return [xx - w, xx + w];
        }));
      });
    }
    if (mo.curl) {
      [[-d, 1.0], [d, 0.8]].forEach(([side, k]) => {
        const x = ax + side * half * 1.02;
        out.or(arcMask(W, H, x, y + 0.5, x + side * 3.0 * k, y - 2.4 * k, side * 1.6, 1));
      });
    }
  }

  // THE RULE: facial hair never covers the mouth opening
  const mouthClear = ellipseMask(W, H, m.axisAt(m.yMouth), m.yMouth + 0.4, m.U * 0.46, 2.2);
  out.andNot(mouthClear);
  return out;
}

function drawFacialHair(pic, m, spec, ramp, mods) {
  const b = BEARDS[(spec.beard && spec.beard.style) || 'none'];
  if (b && b.shade) {
    // stubble is a value shift on skin, not a mass
    const y0 = m.top + b.top * m.hh;
    const area = spanMask(m.W, m.H, y0, m.chinY + 1, (y) => {
      const hw = m.halfW(Math.min(y, m.chinY)), c = m.centreX(Math.min(y, m.chinY));
      return [c - hw * 0.92, c + hw * 0.92];
    }).and(m.headMask);
    addMod(mods, m.W, area, -0.62);
  }
  const mask = facialHairMask(m, spec);
  if (!mask.count()) return mask;
  paintVolume(pic, mask, ramp, { axis: 'sphere', bias: -0.75, rimDark: true });
  // strand direction: a few darker fibres so it is not a flat shape
  const rand = spec.rand;
  const bb = mask.bbox();
  if (bb && rand) {
    for (let i = 0; i < 4; i++) {
      const x0 = bb.x0 + rand() * (bb.x1 - bb.x0);
      const y0 = bb.y0 + rand() * 2;
      const a = arcMask(m.W, m.H, x0, y0, x0 + (rand() - 0.5) * 4, bb.y1 - rand() * 2, (rand() - 0.5) * 3, 1).and(mask);
      pic.paint(a, i % 2 ? ramp[0] : ramp[Math.min(2, ramp.length - 1)]);
    }
  }
  addMod(mods, m.W, mask.dilate(1).andNot(mask).and(m.headMask), -0.8);
  return mask;
}

module.exports = { HAIR, BEARDS, MOUSTACHES, hairMask, drawHair, facialHairMask, drawFacialHair };
