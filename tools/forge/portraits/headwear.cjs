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
const { mat, RAMPS } = require('./ramps.cjs');

function crownWidth(m, y) { return m.halfW(clamp(y, m.top + 1, m.chinY)); }

/** The single topmost pixel of each column of a mask — a crest, not a band. */
function topEdge(mask) {
  const out = new Mask(mask.w, mask.h);
  for (let x = 0; x < mask.w; x++) {
    for (let y = 0; y < mask.h; y++) {
      if (mask.get(x, y)) { out.set(x, y); break; }
    }
  }
  return out;
}

const BUILDERS = {
  none: () => ({ layers: [] }),

  /**
   * Portuguese infantry morion: comb crest + up-swept peaked brim.
   *
   * THE DEFECT THIS REPLACES. The first version read as a WHITE SAILOR CAP,
   * and for three separable reasons:
   *
   *  1. The comb was unioned with the bowl and shaded as ONE sphere, so there
   *     was no value step between them and the fin vanished. A morion IS its
   *     comb; without it the helmet is a bowler. The comb is now its own
   *     volume, on its own axis, with a dark seam cut where it meets the bowl.
   *  2. The brim was a flat lens. The whole point of a morion brim is that it
   *     sweeps UP into a point fore and aft, so the silhouette has two spikes
   *     well above the bowl's waist. Those peaks are now explicit vertices.
   *  3. The steel sat at the top of its ramp everywhere, which is what made it
   *     read WHITE. Polished steel is mostly mid-value with one small specular;
   *     the bowl is biased down and the highlight is a short crest run.
   */
  morion(m, o) {
    const W = m.W, H = m.H;
    const R = mat(o.mat || 'steel');
    const cy = m.top + 1;
    // EVERYTHING HERE IS MEASURED OFF `m.top`, THE HEADROOM, not off m.hh.
    // m.hh is the head's FULL height (47px on this skull), so the original
    // `combTop = cy - m.hh * 0.26` put the crest at y = -2 — off the top of an
    // 80px frame. The comb was silently clipped to a flat band across the
    // crown, which is the single biggest reason the helmet read as a cap.
    // There are only `m.top` rows above the skull; the whole helmet lives in
    // them, so they are budgeted explicitly.
    const bowlR = m.U * 1.02;
    const bowlTop = Math.max(2, m.top - 5);
    const bowlCy = m.top + 4;
    const bowl = ellipseMask(W, H, m.cx + m.turnPx * 0.15, bowlCy, bowlR, bowlCy - bowlTop)
      .and(rectMask(W, H, 0, 0, W - 1, m.top + 4));
    // The comb: a CRESCENT FIN, ~4px thick, standing proud of the crown. Drawn
    // as an outer arc and an inner arc so it stays a sliver — a filled wedge
    // this size covers the whole crown and turns back into a cap band.
    const combTop = Math.max(0, m.top - 9);
    const lean = m.turnPx * 0.10;
    const cxc = m.cx + lean;
    const cw = bowlR * 0.58;                 // the fin is NARROW: it is seen
    const comb = polyMask(W, H, [            // almost edge-on at this head turn
      [cxc - cw, bowlTop + 3.6],
      [cxc - cw * 0.62, combTop + 1.4],
      [cxc - cw * 0.06, combTop],
      [cxc + cw * 0.60, combTop + 1.6],
      [cxc + cw, bowlTop + 4.0],
      [cxc + cw * 0.70, bowlTop + 4.4],
      [cxc + cw * 0.44, combTop + 5.2],
      [cxc - cw * 0.04, combTop + 3.8],
      [cxc - cw * 0.50, combTop + 5.0],
      [cxc - cw * 0.72, bowlTop + 4.2],
    ]);
    // The brim: two real peaks, fore and aft, rising ABOVE the bowl's waist,
    // with the near side dipping so the underside shows.
    const brim = polyMask(W, H, [
      [m.cx - bowlR - 6.0, m.top + 0.6],              // rear peak
      [m.cx - bowlR - 2.2, m.top + 5.0],
      [m.cx - bowlR * 0.5, m.top + 7.0],
      [m.cx + bowlR * 0.5, m.top + 7.2],
      [m.cx + bowlR + 2.0, m.top + 5.2],
      [m.cx + bowlR + 5.6, m.top + 1.2],              // fore peak
      [m.cx + bowlR + 4.0, m.top + 6.6],
      [m.cx, m.top + 10.4],                           // the dipped near edge
      [m.cx - bowlR - 4.4, m.top + 7.0],
    ]);
    const mask = bowl.union(comb).or(brim);
    return {
      layers: [
        { mask: bowl, ramp: R, opts: { axis: 'sphere', bias: -0.05, spec: 0.18, rimDark: true } },
        { mask: brim, ramp: R, opts: { axis: 'cylX', bias: -0.25, rimDark: true } },
        { mask: comb, ramp: R, opts: { axis: 'cylX', bias: -0.10, rimDark: true } },
      ],
      mask,
      after(pic) {
        // The crest catches the key along its TOPMOST PIXEL PER COLUMN and
        // nowhere else. Using the comb's rim instead painted two thirds of a
        // 3px-thick fin at the ramp's brightest step, which is a white cap with
        // extra steps — the exact defect this rewrite exists to remove.
        pic.paint(topEdge(comb), RAMPS.whitewash[4]);   // the one true specular
        // the seam where the comb is riveted into the bowl: this dark line is
        // what separates the two volumes and makes the fin read as a fin
        pic.paint(comb.dilate(1).andNot(comb).and(bowl), R[0]);
        // the brim's dark underside, and the rivet band round the bowl's waist
        pic.paint(brim.minus(brim.erode(1)).and(rectMask(W, H, 0, m.top + 5, W - 1, H - 1)), R[0]);
        pic.paint(lineMask(W, H, m.cx - bowlR * 0.8, m.top + 2.4, m.cx + bowlR * 0.8, m.top + 3.0, 1).and(bowl), R[0]);
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

  /**
   * Malay tudung: cloth over the crown, framing the face, falling to the
   * shoulders.
   *
   * THE DEFECT THIS REPLACES. The first version's cloth mass read as HAIR, for
   * two reasons that compound:
   *
   *  1. It had no FOLD. A tudung is a rectangle of cloth folded over the crown
   *     and pinned under the chin; the folded hem is a bright edge that runs
   *     round the face, and it is the single feature that says "cloth" rather
   *     than "hairline". There wasn't one, so the mass had nothing but a
   *     smooth sphere shade — exactly what the hair builder produces.
   *  2. Its only surface detail was three arcs running from the crown to the
   *     shoulders in the DARKEST cloth step. Long dark strokes down a rounded
   *     mass over a head are parted hair. They are now gone: the crown carries
   *     the fold, and the folds live on the drape, below the brow, broken.
   *
   * The chin artefact that came with it was not from this builder at all — see
   * the cast-shadow note in drawHeadwear().
   */
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
    // The face opening. It now HUGS THE FACE CONTOUR instead of being one
    // oval: an oval leaves a wedge of cloth over each cheekbone, which is what
    // put a brown mass down the side of her face. Following m.left/m.right
    // brings the hem in against the cheek, so the cloth frames the face and
    // the jawline stays hers.
    const openTop = m.yBrow - 2.2;
    const open = spanMask(W, H, openTop, m.chinY + 3, (y) => {
      const yy = clamp(y, m.top, m.chinY);
      const t = clamp((y - openTop) / Math.max(1, m.chinY - openTop), 0, 1);
      // widest at the cheekbones, drawing back in toward the chin
      const k = 0.88 + 0.14 * Math.sin(t * Math.PI);
      return [m.centreX(yy) - m.halfW(yy) * k, m.centreX(yy) + m.halfW(yy) * k];
    });
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
        // 1. THE FOLDED HEM round the face opening — two pixels of the cloth's
        //    light step, with its own shadow a pixel further in. This is the
        //    whole "it is cloth, and it is folded over her head" read.
        const hem = mask.minus(mask.erode(2)).and(open.dilate(3));
        pic.paint(hem, R[R.length - 1]);
        pic.paint(hem.dilate(1).andNot(hem).and(mask), R[1]);
        // 2. THE CROWN FOLD — where the cloth turns over the top of the head.
        //    A single lit ridge with the shade under it, across the crown only.
        const ridge = arcMask(W, H, m.cx - m.U * 0.92, m.top + 5.0,
          m.cx + m.U * 0.86, m.top + 3.4, -1.6, 1).and(crown);
        pic.paint(ridge, R[R.length - 1]);
        // the shade UNDER the ridge, explicitly two rows down: an unbroken
        // dilate ring wrapped over the crest as well and cancelled it out
        ridge.forEach((x, y) => {
          for (let k = 1; k <= 2; k++) if (crown.get(x, y + k)) pic.set(x, y + k, R[k === 1 ? 1 : 2]);
        });
        // 3. DRAPE FOLDS — on the fall of the cloth, below the brow, and broken
        //    so they never read as strands of hair.
        for (let i = 0; i < 2; i++) {
          const arc = arcMask(W, H,
            m.cx + (i ? 1 : -1) * m.U * 0.86, m.yBrow + 2,
            m.cx + (i ? 1 : -1) * m.U * 1.5, m.chinY + 13, (i ? 1 : -1) * 1.4, 1).and(drape);
          const rows = new Map();
          arc.forEach((x, y) => { if (!rows.has(y)) rows.set(y, []); rows.get(y).push(x); });
          [...rows.keys()].sort((a, b) => a - b).forEach((y, k) => {
            if ((k + i * 2) % 7 >= 4) return;
            rows.get(y).forEach((x) => pic.set(x, y, R[0]));
          });
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
  // Headwear casts a shadow onto the brow — and ONLY onto the brow.
  //
  // This used to be the whole 2px ring of the headwear mask intersected with
  // the head. That is right for a hat, whose mass is entirely ABOVE the face,
  // and badly wrong for anything that surrounds it: a tudung's ring runs down
  // both cheeks and under the jaw, so it stamped a dark band across Aminah's
  // chin that read as a shadow with no object casting it. A cast shadow needs
  // something overhead, so the ring is kept only where the cloth is literally
  // above the pixel.
  // Two conditions, both necessary: the cloth has to be OVERHEAD (not merely
  // beside), and the pixel has to be in the brow band. The second is what a
  // face-hugging tudung needs — its hem runs a couple of pixels above half the
  // cheek, so the overhead test alone still painted a shadow all down the face.
  const ring = mask.dilate(2).andNot(mask).and(m.headMask)
    .and(rectMask(m.W, m.H, 0, 0, m.W - 1, m.yBrow + 3));
  const lit = new Mask(m.W, m.H);
  ring.forEach((x, y) => {
    for (let dy = 1; dy <= 4; dy++) if (mask.get(x, y - dy)) { lit.set(x, y); return; }
  });
  addMod(mods, m.W, lit, -1.15);
  return mask;
}

module.exports = { BUILDERS, drawHeadwear };
