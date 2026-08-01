'use strict';
/**
 * MELAKA FORGE — HEADWEAR (1580 Melaka)
 * =====================================
 * Period-specific and culture-specific. Headwear does most of the silhouette
 * work in a portrait, so every entry is a genuinely different mass, not a
 * recoloured band: a morion has a comb and swept brim, a massar is a wrapped
 * roll, a tudung frames the face and falls to the shoulders, a futou is a
 * two-tier flat cap.
 *
 * Each builder returns { mask, layers:[{mask, ramp, opts}], shadow }.
 */

const { Mask, spanMask, ellipseMask, rectMask, polyMask, arcMask, lineMask, clamp } = require('./raster.cjs');
const { paintVolume } = require('./shade.cjs');
const { addMod } = require('./anatomy.cjs');
const { mat } = require('./ramps.cjs');

function crownWidth(m, y) { return m.halfW(clamp(y, m.top + 1, m.chinY)); }

const BUILDERS = {
  none: () => ({ layers: [] }),

  /** Portuguese infantry morion: comb crest + up-swept peaked brim. */
  morion(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'steel');
    const cy = m.top + 1;
    const bowlR = m.U * 1.16, bowlH = m.hh * 0.40;
    const bowl = ellipseMask(W, H, m.cx + m.turnPx * 0.15, cy + 1.5, bowlR, bowlH)
      .and(rectMask(W, H, 0, 0, W - 1, cy + 3));
    // comb: a raised fin along the crown, seen slightly from the side
    const comb = polyMask(W, H, [
      [m.cx - bowlR * 0.86, cy + 1.5],
      [m.cx - bowlR * 0.30, cy - m.hh * 0.16],
      [m.cx + bowlR * 0.34, cy - m.hh * 0.15],
      [m.cx + bowlR * 0.88, cy + 2.0],
      [m.cx + bowlR * 0.60, cy + 2.6],
      [m.cx - bowlR * 0.60, cy + 2.6],
    ]);
    // brim: sweeps out and up on both sides
    const brim = polyMask(W, H, [
      [m.cx - bowlR - 5.2, cy + 1.0],
      [m.cx - bowlR * 0.7, cy + 3.6],
      [m.cx + bowlR * 0.7, cy + 3.8],
      [m.cx + bowlR + 5.0, cy + 1.6],
      [m.cx + bowlR + 3.6, cy + 3.4],
      [m.cx, cy + 5.4],
      [m.cx - bowlR - 3.8, cy + 3.0],
    ]);
    const mask = bowl.union(comb).or(brim);
    return {
      layers: [
        { mask: bowl.union(comb), ramp: R, opts: { axis: 'sphere', bias: 0.2, spec: 0.7, rimDark: true } },
        { mask: brim, ramp: R, opts: { axis: 'cylX', bias: -0.3, rimDark: true } },
      ],
      mask,
      after(pic) {
        pic.paint(comb.rim(1).and(comb), R[3]);
        pic.paint(lineMask(W, H, m.cx - bowlR * 0.5, cy + 4.2, m.cx + bowlR * 0.5, cy + 4.4, 1).and(bowl), R[0]);
      },
    };
  },

  /** Soft Portuguese barrete / flat cap, slumping to one side. */
  'flat-cap'(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'wool-black');
    const lean = (o.lean == null ? -1 : o.lean);
    const cy = m.top + 1.2;
    const band = spanMask(W, H, cy + 1, cy + 4, (y) => [m.left(y + 1) - 1.0, m.right(y + 1) + 1.0]);
    const crown = ellipseMask(W, H, m.cx + lean * 2.2, cy - 1.6, m.U * 1.16, m.hh * 0.20);
    const mask = band.union(crown);
    return {
      mask,
      layers: [
        { mask: crown, ramp: R, opts: { axis: 'sphere', bias: 0.35, rimDark: true } },
        { mask: band, ramp: R, opts: { axis: 'cylX', bias: -0.1, rimDark: true } },
      ],
      after(pic) { pic.paint(band.intersect(crown.dilate(1)), R[0]); },
    };
  },

  /** Tall-crowned Portuguese hat — the customs man's status marker. */
  'tall-hat'(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'wool-black');
    const cy = m.top + 1;
    const crown = polyMask(W, H, [
      [m.cx - m.U * 0.86, cy + 1],
      [m.cx - m.U * 0.78, cy - m.hh * 0.30],
      [m.cx + m.U * 0.80, cy - m.hh * 0.31],
      [m.cx + m.U * 0.92, cy + 1],
    ]);
    const brim = ellipseMask(W, H, m.cx + m.turnPx * 0.2, cy + 1.6, m.U * 1.34, 2.1);
    const band = rectMask(W, H, m.cx - m.U * 0.86, cy - 1.6, m.cx + m.U * 0.92, cy + 0.4).and(crown);
    return {
      mask: crown.union(brim),
      layers: [
        { mask: crown, ramp: R, opts: { axis: 'cylY', bias: 0.15, rimDark: true } },
        { mask: brim, ramp: R, opts: { axis: 'cylX', bias: -0.35, rimDark: true } },
        { mask: band, ramp: mat(o.bandMat || 'wool-crimson'), opts: { axis: 'cylX', bias: 0.1 } },
      ],
    };
  },

  /** Ming-era black gauze cap (futou) — two tiers, low rear rise. */
  futou(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'wool-black');
    const cy = m.top + 1;
    const lower = spanMask(W, H, cy - 0.5, cy + 4.4, (y) => [m.left(y + 2.5) - 1.0, m.right(y + 2.5) + 1.0]);
    const upper = rectMask(W, H, m.cx - m.U * 0.70 + m.turnPx * 0.2, cy - m.hh * 0.10,
      m.cx + m.U * 0.68 + m.turnPx * 0.2, cy + 1.0);
    const back = ellipseMask(W, H, m.cx - m.turnDir * m.U * 0.92, cy + 1.6, 2.6, 2.2);
    const mask = lower.union(upper).or(back);
    return {
      mask,
      layers: [
        { mask: upper.union(back), ramp: R, opts: { axis: 'cylX', bias: 0.3, rimDark: true } },
        { mask: lower, ramp: R, opts: { axis: 'cylX', bias: -0.15, rimDark: true } },
      ],
      after(pic) { pic.paint(lineMask(W, H, m.cx - m.U * 0.7, cy + 0.9, m.cx + m.U * 0.7, cy + 0.9, 1).and(mask), R[0]); },
    };
  },

  /** Omani massar: a wide wrapped turban, folds running diagonally. */
  'turban-omani'(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'linen-white');
    const cy = m.top + 0.5;
    const roll = ellipseMask(W, H, m.cx + m.turnPx * 0.1, cy + 1.0, m.U * 1.30, m.hh * 0.27);
    const top = ellipseMask(W, H, m.cx - m.turnDir * 1.4, cy - m.hh * 0.10, m.U * 1.02, m.hh * 0.19);
    const tail = polyMask(W, H, [
      [m.cx + m.turnDir * m.U * 1.10, cy + 2.0],
      [m.cx + m.turnDir * m.U * 1.42, cy + 5.4],
      [m.cx + m.turnDir * m.U * 1.06, cy + 5.0],
    ]);
    const mask = roll.union(top).or(tail);
    return {
      mask,
      layers: [{ mask, ramp: R, opts: { axis: 'sphere', bias: 0.25, rimDark: true } }],
      after(pic) {
        for (let i = 0; i < 4; i++) {
          const y0 = cy - 1.5 + i * 1.8;
          pic.paint(arcMask(W, H, m.cx - m.U * 1.3, y0 + 1.6, m.cx + m.U * 1.3, y0 - 1.2, -1.4, 1).and(mask), R[0]);
        }
      },
    };
  },

  /** South-Indian merchant's wrapped turban with a fanned crest. */
  'turban-tamil'(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'linen-white');
    const A = mat(o.accentMat || 'wool-crimson');
    const cy = m.top + 0.8;
    const roll = ellipseMask(W, H, m.cx + m.turnPx * 0.1, cy + 1.4, m.U * 1.22, m.hh * 0.24);
    const dome = ellipseMask(W, H, m.cx + m.turnDir * 1.0, cy - m.hh * 0.09, m.U * 0.96, m.hh * 0.17);
    const fan = polyMask(W, H, [
      [m.cx - m.turnDir * m.U * 0.66, cy - m.hh * 0.05],
      [m.cx - m.turnDir * m.U * 1.30, cy - m.hh * 0.24],
      [m.cx - m.turnDir * m.U * 1.24, cy + m.hh * 0.06],
    ]);
    const mask = roll.union(dome).or(fan);
    return {
      mask,
      layers: [
        { mask, ramp: R, opts: { axis: 'sphere', bias: 0.2, rimDark: true } },
        { mask: spanMask(W, H, cy + 2.2, cy + 3.4, (y) => [m.left(y + 1) - 1.6, m.right(y + 1) + 1.6]).and(mask), ramp: A, opts: { axis: 'cylX', bias: 0.2 } },
      ],
      after(pic) {
        for (let i = 0; i < 3; i++) {
          pic.paint(arcMask(W, H, m.cx - m.U * 1.2, cy + 0.2 + i * 1.5, m.cx + m.U * 1.2, cy - 0.8 + i * 1.5, -1.0, 1).and(roll.union(dome)), R[0]);
        }
      },
    };
  },

  /** Malay tudung: cloth over the crown, framing the face, falling to the shoulders. */
  tudung(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'cotton-ochre');
    const cy = m.top - 1.4;
    const cap = spanMask(W, H, cy, m.chinY + 13, (y) => {
      const yy = clamp(y, m.top, m.chinY);
      const t = clamp((y - cy) / (m.chinY + 13 - cy), 0, 1);
      const grow = 1.2 + 4.6 * Math.pow(t, 1.7);
      return [m.left(yy) - grow, m.right(yy) + grow];
    });
    cap.or(ellipseMask(W, H, m.centreX(m.top) + m.turnPx * 0.2, m.top + 1.2, m.U * 1.04, m.hh * 0.19));
    // the face opening: an oval seated on the brow, so the cloth reads as a
    // frame around the face rather than a band across the forehead
    const oy = m.yBrow + (m.chinY - m.yBrow) * 0.56;
    const open = ellipseMask(W, H, m.axisAt(oy) - m.turnDir * 0.4, oy,
      m.U * 0.74, (m.chinY - m.yBrow) * 0.68 + 3);
    const mask = cap.minus(open);
    const crown = mask.intersect(rectMask(W, H, 0, 0, W - 1, m.yBrow));
    const drape = mask.minus(crown);
    return {
      mask,
      layers: [
        { mask: crown, ramp: R, opts: { axis: 'sphere', bias: 0.25, rimDark: true } },
        { mask: drape, ramp: R, opts: { axis: 'cylX', bias: 0.30, rimDark: true } },
      ],
      after(pic) {
        for (let i = -1; i <= 1; i++) {
          pic.paint(arcMask(W, H, m.cx + i * m.U * 0.7, m.top + 2, m.cx + i * m.U * 1.5, m.chinY + 13, i * 1.5, 1).and(mask), R[0]);
        }
      },
    };
  },

  /** Loose selendang / shawl: hair shows at the front, cloth over the back. */
  selendang(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'batik-plum');
    const cy = m.top + 0.4;
    const cap = spanMask(W, H, cy, m.chinY + 10, (y) => {
      const yy = clamp(y, m.top, m.chinY);
      const t = clamp((y - cy) / (m.chinY + 10 - cy), 0, 1);
      const grow = 1.0 + 5.5 * Math.pow(t, 1.6);
      return [m.left(yy) - grow, m.right(yy) + grow];
    });
    const openTop = m.top + m.hh * 0.16;
    const open = spanMask(W, H, openTop, m.chinY + 1, (y) => {
      const yy = clamp(y, m.top, m.chinY);
      return [m.centreX(yy) - m.halfW(yy) * 1.06, m.centreX(yy) + m.halfW(yy) * 1.06];
    });
    // cut the front third away so the hairline reads
    const mask = cap.minus(open.and(rectMask(W, H, 0, 0, W - 1, m.yEye)));
    mask.andNot(spanMask(W, H, openTop, m.chinY, (y) => {
      const yy = clamp(y, m.top, m.chinY);
      return [m.centreX(yy) - m.halfW(yy) * 0.98, m.centreX(yy) + m.halfW(yy) * 0.98];
    }));
    return {
      mask,
      layers: [{ mask, ramp: R, opts: { axis: 'sphere', bias: 0.0, rimDark: true } }],
      after(pic) {
        pic.paint(arcMask(W, H, m.cx - m.U * 1.1, m.top + 3, m.cx - m.U * 1.5, m.chinY + 8, -2, 1).and(mask), R[0]);
        pic.paint(arcMask(W, H, m.cx + m.U * 1.0, m.top + 4, m.cx + m.U * 1.6, m.chinY + 8, 2, 1).and(mask), R[3]);
      },
    };
  },

  /** Tight batik headwrap with a knot — the kampung elder's. */
  headwrap(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'batik-plum');
    const cy = m.top + 0.6;
    const band = spanMask(W, H, cy, m.top + m.hh * 0.30, (y) => [m.left(y + 1) - 1.2, m.right(y + 1) + 1.2]);
    band.or(ellipseMask(W, H, m.centreX(m.top) + m.turnPx * 0.2, m.top + 1.4, m.U * 1.02, m.hh * 0.16));
    const knot = ellipseMask(W, H, m.cx - m.turnDir * m.U * 0.86, m.top - 0.4, 2.6, 2.2);
    const mask = band.union(knot);
    return {
      mask,
      layers: [
        { mask: band, ramp: R, opts: { axis: 'cylX', bias: 0.15, rimDark: true } },
        { mask: knot, ramp: R, opts: { axis: 'sphere', bias: 0.4, rimDark: true } },
      ],
      after(pic) {
        pic.paint(arcMask(W, H, m.cx - m.U, m.top + 4.0, m.cx + m.U, m.top + 2.6, -1.0, 1).and(band), R[0]);
        pic.paint(arcMask(W, H, m.cx - m.U, m.top + 2.0, m.cx + m.U, m.top + 1.0, -0.8, 1).and(band), R[3]);
      },
    };
  },

  /** Malay tanjak / twisted kain, peaked to one side — the fisherman's. */
  tanjak(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'cotton-ochre');
    const cy = m.top + 1.0;
    const band = spanMask(W, H, cy, m.top + m.hh * 0.24, (y) => [m.left(y + 1) - 1.4, m.right(y + 1) + 1.4]);
    const peak = polyMask(W, H, [
      [m.cx + m.turnDir * m.U * 0.10, cy + 1.5],
      [m.cx + m.turnDir * m.U * 0.62, cy - m.hh * 0.20],
      [m.cx + m.turnDir * m.U * 1.24, cy - m.hh * 0.02],
      [m.cx + m.turnDir * m.U * 1.16, cy + 2.4],
    ]);
    const mask = band.union(peak);
    return {
      mask,
      layers: [
        { mask: band, ramp: R, opts: { axis: 'cylX', bias: 0.1, rimDark: true } },
        { mask: peak, ramp: R, opts: { axis: 'sphere', bias: 0.35, rimDark: true } },
      ],
      after(pic) {
        pic.paint(lineMask(W, H, m.cx + m.turnDir * m.U * 0.2, cy + 1.2, m.cx + m.turnDir * m.U * 1.0, cy - m.hh * 0.10, 1).and(peak), R[0]);
      },
    };
  },

  /** Simple linen coif tied under the chin — young servant. */
  kerchief(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'linen-cream');
    const cy = m.top - 0.2;
    const cap = spanMask(W, H, cy, m.top + m.hh * 0.42, (y) => {
      const yy = clamp(y, m.top, m.chinY);
      return [m.left(yy) - 1.3, m.right(yy) + 1.3];
    });
    cap.or(ellipseMask(W, H, m.centreX(m.top) + m.turnPx * 0.2, m.top + 1.0, m.U * 1.04, m.hh * 0.17));
    const open = spanMask(W, H, m.top + m.hh * 0.22, m.chinY, (y) => {
      const yy = clamp(y, m.top, m.chinY);
      return [m.centreX(yy) - m.halfW(yy) * 0.96, m.centreX(yy) + m.halfW(yy) * 0.96];
    });
    const back = spanMask(W, H, m.top + m.hh * 0.30, m.chinY + 3, (y) => {
      const yy = clamp(y, m.top, m.chinY);
      const side = -m.turnDir;
      const c = m.centreX(yy), hw = m.halfW(yy);
      return side < 0 ? [c - hw - 1.6, c - hw + 1.2] : [c + hw - 1.2, c + hw + 1.6];
    });
    const mask = cap.minus(open).or(back);
    return {
      mask,
      layers: [{ mask, ramp: R, opts: { axis: 'sphere', bias: 0.15, rimDark: true } }],
      after(pic) {
        pic.paint(arcMask(W, H, m.cx - m.U * 0.9, m.top + 3.2, m.cx + m.U * 0.9, m.top + 2.2, -1.2, 1).and(mask), R[0]);
      },
    };
  },
};

function drawHeadwear(pic, m, spec, mods) {
  const hw = spec.headwear;
  if (!hw || !hw.style || hw.style === 'none') return new Mask(m.W, m.H);
  const b = BUILDERS[hw.style];
  if (!b) throw new Error('unknown headwear: ' + hw.style);
  const built = b(m, hw);
  (built.layers || []).forEach((l) => paintVolume(pic, l.mask, l.ramp, l.opts || {}));
  if (built.after) built.after(pic);
  const mask = built.mask || new Mask(m.W, m.H);
  // headwear casts a shadow onto the brow
  addMod(mods, m.W, mask.dilate(2).andNot(mask).and(m.headMask), -1.15);
  return mask;
}

module.exports = { BUILDERS, drawHeadwear };
