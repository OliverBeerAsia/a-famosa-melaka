'use strict';
/**
 * MELAKA FORGE — PORTRAIT RASTER PRIMITIVES
 * =========================================
 * A tiny indexed-pixel raster layer. No anti-aliasing anywhere: every write is
 * a whole pixel, every colour is a canon hex string, alpha is 0 or 255.
 *
 * The unit of work is a Mask (Uint8 coverage buffer). Shapes build masks;
 * masks get painted with a shade function. Masks are also what the uniqueness
 * gate measures (silhouette IoU), so shape and gate share one representation.
 */

const { createCanvas } = require('canvas');

// ---------------------------------------------------------------------------
// Mask
// ---------------------------------------------------------------------------
class Mask {
  constructor(w, h, data) {
    this.w = w; this.h = h;
    this.d = data || new Uint8Array(w * h);
  }
  static like(m) { return new Mask(m.w, m.h); }
  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inside(x, y) ? this.d[y * this.w + x] : 0; }
  set(x, y, v = 1) { if (this.inside(x, y)) this.d[y * this.w + x] = v; }
  clone() { return new Mask(this.w, this.h, this.d.slice()); }
  count() { let n = 0; for (let i = 0; i < this.d.length; i++) if (this.d[i]) n++; return n; }
  or(o) { for (let i = 0; i < this.d.length; i++) if (o.d[i]) this.d[i] = 1; return this; }
  andNot(o) { for (let i = 0; i < this.d.length; i++) if (o.d[i]) this.d[i] = 0; return this; }
  and(o) { for (let i = 0; i < this.d.length; i++) if (!o.d[i]) this.d[i] = 0; return this; }
  minus(o) { return this.clone().andNot(o); }
  union(o) { return this.clone().or(o); }
  intersect(o) { return this.clone().and(o); }
  forEach(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.d[y * this.w + x]) fn(x, y);
    }
  }
  /** 4-neighbour dilation, n times. */
  dilate(n = 1) {
    let cur = this;
    for (let k = 0; k < n; k++) {
      const out = Mask.like(cur);
      for (let y = 0; y < cur.h; y++) for (let x = 0; x < cur.w; x++) {
        if (cur.get(x, y) || cur.get(x - 1, y) || cur.get(x + 1, y) ||
            cur.get(x, y - 1) || cur.get(x, y + 1)) out.set(x, y);
      }
      cur = out;
    }
    return cur;
  }
  erode(n = 1) {
    let cur = this;
    for (let k = 0; k < n; k++) {
      const out = Mask.like(cur);
      for (let y = 0; y < cur.h; y++) for (let x = 0; x < cur.w; x++) {
        if (cur.get(x, y) && cur.get(x - 1, y) && cur.get(x + 1, y) &&
            cur.get(x, y - 1) && cur.get(x, y + 1)) out.set(x, y);
      }
      cur = out;
    }
    return cur;
  }
  /** Outline ring just OUTSIDE the mask. */
  ring(n = 1) { return this.dilate(n).andNot(this); }
  /** Inner ring (rim), just INSIDE the mask. */
  rim(n = 1) { return this.clone().andNot(this.erode(n)); }
  bbox() {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    this.forEach((x, y) => {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    });
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }
}

function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.d.length; i++) {
    const p = a.d[i] ? 1 : 0, q = b.d[i] ? 1 : 0;
    if (p & q) inter++;
    if (p | q) uni++;
  }
  return uni === 0 ? 0 : inter / uni;
}

// ---------------------------------------------------------------------------
// shape builders (all return a Mask)
// ---------------------------------------------------------------------------
/** Rows described by a function y -> [xLeft, xRight] (inclusive) or null. */
function spanMask(w, h, y0, y1, fn) {
  const m = new Mask(w, h);
  for (let y = Math.max(0, Math.round(y0)); y <= Math.min(h - 1, Math.round(y1)); y++) {
    const s = fn(y);
    if (!s) continue;
    const a = Math.round(s[0]), b = Math.round(s[1]);
    for (let x = Math.max(0, a); x <= Math.min(w - 1, b); x++) m.set(x, y);
  }
  return m;
}

function ellipseMask(w, h, cx, cy, rx, ry) {
  const m = new Mask(w, h);
  if (rx <= 0 || ry <= 0) return m;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) m.set(x, y);
  }
  return m;
}

/** Superellipse: n=2 ellipse, n>2 squarer, n<2 diamond-ish. */
function superMask(w, h, cx, cy, rx, ry, n) {
  const m = new Mask(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = Math.abs((x + 0.5 - cx) / rx), dy = Math.abs((y + 0.5 - cy) / ry);
    if (Math.pow(dx, n) + Math.pow(dy, n) <= 1) m.set(x, y);
  }
  return m;
}

function rectMask(w, h, x0, y0, x1, y1) {
  const m = new Mask(w, h);
  for (let y = Math.max(0, Math.round(y0)); y <= Math.min(h - 1, Math.round(y1)); y++)
    for (let x = Math.max(0, Math.round(x0)); x <= Math.min(w - 1, Math.round(x1)); x++) m.set(x, y);
  return m;
}

/** Even-odd scanline polygon fill. pts = [[x,y], ...] */
function polyMask(w, h, pts) {
  const m = new Mask(w, h);
  if (pts.length < 3) return m;
  let ymin = 1e9, ymax = -1e9;
  pts.forEach((p) => { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); });
  for (let y = Math.max(0, Math.floor(ymin)); y <= Math.min(h - 1, Math.ceil(ymax)); y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
        xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.max(0, Math.round(xs[i])); x <= Math.min(w - 1, Math.round(xs[i + 1] - 0.5)); x++) m.set(x, y);
    }
  }
  return m;
}

/** Thick line as a mask (Bresenham + square brush). */
function lineMask(w, h, x0, y0, x1, y1, thick = 1) {
  const m = new Mask(w, h);
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const r = Math.floor((thick - 1) / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    for (let dy = -r; dy <= thick - 1 - r; dy++) for (let dx = -r; dx <= thick - 1 - r; dx++) m.set(x + dx, y + dy);
  }
  return m;
}

/**
 * A quadratic arc, thickened. Used for brows, mouths, wrinkles, strand notches.
 * bow > 0 bends downward (a frown / a hanging strand), bow < 0 bends up.
 */
function arcMask(w, h, x0, y0, x1, y1, bow, thick = 1) {
  const m = new Mask(w, h);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + bow;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(bow) * 2, 2) * 2;
  const r = Math.floor((thick - 1) / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const x = Math.round(u * u * x0 + 2 * u * t * mx + t * t * x1);
    const y = Math.round(u * u * y0 + 2 * u * t * my + t * t * y1);
    for (let dy = -r; dy <= thick - 1 - r; dy++) for (let dx = -r; dx <= thick - 1 - r; dx++) m.set(x + dx, y + dy);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Picture — the paintable surface
// ---------------------------------------------------------------------------
class Picture {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.px = new Array(w * h).fill(null); // hex string or null (transparent)
  }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? null : this.px[y * this.w + x]; }
  set(x, y, hex) { if (x >= 0 && y >= 0 && x < this.w && y < this.h && hex) this.px[y * this.w + x] = hex; }
  /** Paint a mask. shade(x, y) -> hex | null (null skips the pixel). */
  paint(mask, shade) {
    if (typeof shade === 'string') { const c = shade; shade = () => c; }
    mask.forEach((x, y) => { const c = shade(x, y); if (c) this.set(x, y, c); });
    return this;
  }
  fill(hex) { this.px.fill(hex); return this; }
  /** Nearest-neighbour integer upscale. */
  upscale(f) {
    const out = new Picture(this.w * f, this.h * f);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.px[y * this.w + x];
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
        out.px[(y * f + dy) * out.w + (x * f + dx)] = c;
      }
    }
    return out;
  }
  colourCounts() {
    const m = new Map();
    this.px.forEach((c) => { if (c) m.set(c, (m.get(c) || 0) + 1); });
    return m;
  }
  toCanvas() {
    const cv = createCanvas(this.w, this.h);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i];
      if (!c) { img.data[i * 4 + 3] = 0; continue; }
      img.data[i * 4] = parseInt(c.slice(1, 3), 16);
      img.data[i * 4 + 1] = parseInt(c.slice(3, 5), 16);
      img.data[i * 4 + 2] = parseInt(c.slice(5, 7), 16);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  toPNG() { return this.toCanvas().toBuffer('image/png'); }
}

// ---------------------------------------------------------------------------
// deterministic RNG (seeded; no Math.random anywhere in the pipeline)
// ---------------------------------------------------------------------------
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rng(seed) {
  let s = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return function next() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// smooth 1-D interpolation over control points [[y, value], ...] (sorted)
function curve(points, y) {
  if (y <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (y >= last[0]) return last[1];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    if (y >= a[0] && y <= b[0]) {
      const t = (y - a[0]) / (b[0] - a[0]);
      const s = 0.5 - 0.5 * Math.cos(Math.PI * t); // cosine ease
      return a[1] + (b[1] - a[1]) * s;
    }
  }
  return last[1];
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

module.exports = {
  Mask, Picture, iou,
  spanMask, ellipseMask, superMask, rectMask, polyMask, lineMask, arcMask,
  rng, hashSeed, curve, clamp,
};
