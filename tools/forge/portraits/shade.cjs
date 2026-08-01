'use strict';
/**
 * Volume shading for non-skin masses (hair, cloth, metal, backdrops).
 * One sun (NW, canon), quantised into a 4-step canon material ramp.
 */

const { clamp } = require('./raster.cjs');
const { SUN_L } = require('./anatomy.cjs');

/**
 * Paint a mask as a lit volume.
 * opts.axis     'sphere' (default) | 'cylX' (horizontal cylinder, e.g. a turban
 *               roll) | 'cylY' (vertical, e.g. a neck / sleeve) | 'flat'
 * opts.bias     shifts the whole mass brighter/darker (-1..+1 in ramp steps)
 * opts.spec     0..1 extra highlight strength on the lit rim
 * opts.rimDark  darken the outer 1px ring (contact / occlusion)
 */
function paintVolume(pic, mask, ramp, opts = {}) {
  const bb = mask.bbox();
  if (!bb) return;
  const cx = (bb.x0 + bb.x1 + 1) / 2, cy = (bb.y0 + bb.y1 + 1) / 2;
  const rx = Math.max(1, (bb.x1 - bb.x0 + 1) / 2), ry = Math.max(1, (bb.y1 - bb.y0 + 1) / 2);
  const axis = opts.axis || 'sphere';
  const bias = opts.bias || 0;
  const n = ramp.length;
  const rim = opts.rimDark ? mask.rim(1) : null;

  mask.forEach((x, y) => {
    let nx = clamp((x + 0.5 - cx) / rx, -1, 1);
    let ny = clamp((y + 0.5 - cy) / ry, -1, 1);
    if (axis === 'cylX') nx = 0;   // horizontal axis -> shades vertically
    if (axis === 'cylY') ny = 0;   // vertical axis   -> shades horizontally
    let d;
    if (axis === 'flat') d = 0.62;
    else {
      const nz = Math.sqrt(Math.max(0.03, 1 - nx * nx * 0.9 - ny * ny * 0.7));
      d = nx * SUN_L[0] + ny * SUN_L[1] + nz * SUN_L[2];
    }
    let v = (d - 0.20) * (n - 0.02) * 1.12 + bias;
    if (rim && rim.get(x, y)) v -= 0.9;
    pic.set(x, y, ramp[clamp(Math.round(v), 0, n - 1)]);
  });

  if (opts.spec) {
    // a single specular arc on the NW shoulder of the mass
    const hi = ramp[n - 1];
    mask.forEach((x, y) => {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const r = Math.hypot(nx + 0.42, ny + 0.46);
      if (r < 0.30 * opts.spec + 0.16) pic.set(x, y, hi);
    });
  }
}

/** Flat two-value fill used for diegetic backdrops (no gradients allowed). */
function paintBackdrop(pic, split, twoValues, opts = {}) {
  const { w, h } = pic;
  const [dark, light] = twoValues;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    pic.set(x, y, split(x, y) ? light : dark);
  }
  void opts;
}

module.exports = { paintVolume, paintBackdrop };
