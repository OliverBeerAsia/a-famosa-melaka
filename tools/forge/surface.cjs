'use strict';
/**
 * MELAKA FORGE — SURFACE
 * ======================
 * A tiny software raster target. We do NOT draw through node-canvas' 2D
 * context for artwork: every canvas path fill is anti-aliased, and AA is the
 * single most reliable way to destroy a pixel-art plate (benchmark gate #18:
 * "zero AA alpha"). node-canvas is used for exactly two things here: PNG
 * encoding, and the human-facing review overlays where AA is fine.
 *
 * Everything is integer-pixel, deterministic, and shader-driven: you give a
 * region (parallelogram / polygon / wall face) and a `shader(u, v, x, y)` that
 * returns a hex string (or null to leave the pixel alone). All the material
 * look lives in shaders (texture.cjs); all the geometry lives here + iso.cjs.
 *
 * Coverage rule for regions: a pixel belongs to a region if the region
 * contains its CENTRE (x+0.5, y+0.5), with half-open [0,1) parameter ranges.
 * Adjacent parallelograms therefore tile exactly — no seams, no double-writes.
 */

const fs = require('fs');
const path = require('path');

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

const _hexCache = new Map();
function parseHex(hex) {
  let c = _hexCache.get(hex);
  if (c) return c;
  const s = String(hex);
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
  if (!m) throw new Error('bad hex: ' + hex);
  c = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  _hexCache.set(hex, c);
  return c;
}

class Surface {
  constructor(width, height) {
    this.width = width | 0;
    this.height = height | 0;
    this.data = new Uint8ClampedArray(this.width * this.height * 4);
  }

  static from(width, height, fillHex) {
    const s = new Surface(width, height);
    if (fillHex) s.clear(fillHex);
    return s;
  }

  clone() {
    const s = new Surface(this.width, this.height);
    s.data.set(this.data);
    return s;
  }

  clear(hex) {
    const [r, g, b] = parseHex(hex);
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
  }

  inside(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  /** Opaque write. */
  setHex(x, y, hex) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b] = parseHex(hex);
    const i = (y * this.width + x) * 4;
    const d = this.data;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }

  setRGBA(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a === undefined ? 255 : a;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
  }

  /** Blend `hex` over the existing pixel at coverage t (0..1). Quantize later. */
  blendHex(x, y, hex, t) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    if (t <= 0) return;
    const [r, g, b] = parseHex(hex);
    const i = (y * this.width + x) * 4;
    const d = this.data;
    if (d[i + 3] === 0) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
    d[i] = d[i] + (r - d[i]) * t;
    d[i + 1] = d[i + 1] + (g - d[i + 1]) * t;
    d[i + 2] = d[i + 2] + (b - d[i + 2]) * t;
    d[i + 3] = 255;
  }

  fillRect(x0, y0, w, h, shader) {
    const fn = typeof shader === 'function' ? shader : () => shader;
    const xa = Math.max(0, Math.floor(x0)), xb = Math.min(this.width, Math.ceil(x0 + w));
    const ya = Math.max(0, Math.floor(y0)), yb = Math.min(this.height, Math.ceil(y0 + h));
    for (let y = ya; y < yb; y++) {
      for (let x = xa; x < xb; x++) {
        const c = fn(x - x0, y - y0, x, y);
        if (c) this.setHex(x, y, c);
      }
    }
  }

  /**
   * Parallelogram defined by screen origin `o` and edge vectors `eu`, `ev`.
   * shader receives (u, v, x, y) where u in [0,uLen), v in [0,vLen).
   * uLen/vLen default to the screen lengths of eu/ev (pass metric lengths for
   * planes seen at an angle, e.g. roof slopes).
   */
  fillPara(o, eu, ev, shader, opts) {
    const uLen = (opts && opts.uLen) || Math.hypot(eu.x, eu.y);
    const vLen = (opts && opts.vLen) || Math.hypot(ev.x, ev.y);
    const det = eu.x * ev.y - eu.y * ev.x;
    if (Math.abs(det) < 1e-9) return;
    const xs = [o.x, o.x + eu.x, o.x + ev.x, o.x + eu.x + ev.x];
    const ys = [o.y, o.y + eu.y, o.y + ev.y, o.y + eu.y + ev.y];
    const xa = Math.max(0, Math.floor(Math.min(...xs)));
    const xb = Math.min(this.width, Math.ceil(Math.max(...xs)));
    const ya = Math.max(0, Math.floor(Math.min(...ys)));
    const yb = Math.min(this.height, Math.ceil(Math.max(...ys)));
    const fn = typeof shader === 'function' ? shader : () => shader;
    for (let y = ya; y < yb; y++) {
      const py = y + 0.5 - o.y;
      for (let x = xa; x < xb; x++) {
        const px = x + 0.5 - o.x;
        const a = (px * ev.y - py * ev.x) / det;
        if (a < 0 || a >= 1) continue;
        const b = (eu.x * py - eu.y * px) / det;
        if (b < 0 || b >= 1) continue;
        const c = fn(a * uLen, b * vLen, x, y);
        if (c) this.setHex(x, y, c);
      }
    }
  }

  /**
   * Arbitrary polygon (screen-space points), affine-parameterised by an
   * optional planar basis {o, eu, ev, uLen, vLen}. Projection of a plane is
   * affine, so this is EXACT for any planar 3D polygon (roofs included).
   */
  fillPoly(points, shader, basis) {
    if (points.length < 3) return;
    const fn = typeof shader === 'function' ? shader : () => shader;
    let det = 0, o = null, eu = null, ev = null, uLen = 1, vLen = 1;
    if (basis) {
      o = basis.o; eu = basis.eu; ev = basis.ev;
      uLen = basis.uLen === undefined ? Math.hypot(eu.x, eu.y) : basis.uLen;
      vLen = basis.vLen === undefined ? Math.hypot(ev.x, ev.y) : basis.vLen;
      det = eu.x * ev.y - eu.y * ev.x;
    }
    let ya = Infinity, yb = -Infinity;
    for (const p of points) { if (p.y < ya) ya = p.y; if (p.y > yb) yb = p.y; }
    ya = Math.max(0, Math.floor(ya));
    yb = Math.min(this.height, Math.ceil(yb));
    const n = points.length;
    const xsBuf = [];
    for (let y = ya; y < yb; y++) {
      const sy = y + 0.5;
      xsBuf.length = 0;
      for (let i = 0; i < n; i++) {
        const p = points[i], q = points[(i + 1) % n];
        if ((p.y <= sy && q.y > sy) || (q.y <= sy && p.y > sy)) {
          xsBuf.push(p.x + (sy - p.y) / (q.y - p.y) * (q.x - p.x));
        }
      }
      if (xsBuf.length < 2) continue;
      xsBuf.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xsBuf.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xsBuf[k] - 0.5));
        const xb2 = Math.min(this.width, Math.ceil(xsBuf[k + 1] - 0.5));
        for (let x = xa; x < xb2; x++) {
          let u = x - xsBuf[k], v = y - ya;
          if (det) {
            const px = x + 0.5 - o.x, py = sy - o.y;
            u = ((px * ev.y - py * ev.x) / det) * uLen;
            v = ((eu.x * py - eu.y * px) / det) * vLen;
          }
          const c = fn(u, v, x, y);
          if (c) this.setHex(x, y, c);
        }
      }
    }
  }

  /** Alpha-composite another surface at (dx, dy). */
  composite(other, dx, dy) {
    const od = other.data;
    for (let y = 0; y < other.height; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.height) continue;
      for (let x = 0; x < other.width; x++) {
        const tx = x + dx;
        if (tx < 0 || tx >= this.width) continue;
        const si = (y * other.width + x) * 4;
        const a = od[si + 3];
        if (a === 0) continue;
        const di = (ty * this.width + tx) * 4;
        const d = this.data;
        if (a === 255) {
          d[di] = od[si]; d[di + 1] = od[si + 1]; d[di + 2] = od[si + 2]; d[di + 3] = 255;
        } else {
          const t = a / 255;
          d[di] = d[di] + (od[si] - d[di]) * t;
          d[di + 1] = d[di + 1] + (od[si + 1] - d[di + 1]) * t;
          d[di + 2] = d[di + 2] + (od[si + 2] - d[di + 2]) * t;
          d[di + 3] = Math.max(d[di + 3], a);
        }
      }
    }
  }

  /** Bounding box of non-transparent pixels, or null. */
  opaqueBounds() {
    let x0 = this.width, y0 = this.height, x1 = -1, y1 = -1;
    const d = this.data;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (d[(y * this.width + x) * 4 + 3] !== 0) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  }

  crop(x0, y0, w, h) {
    const s = new Surface(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = x + x0, sy = y + y0;
        if (sx < 0 || sy < 0 || sx >= this.width || sy >= this.height) continue;
        const si = (sy * this.width + sx) * 4, di = (y * w + x) * 4;
        s.data[di] = this.data[si]; s.data[di + 1] = this.data[si + 1];
        s.data[di + 2] = this.data[si + 2]; s.data[di + 3] = this.data[si + 3];
      }
    }
    return s;
  }

  scaleNearest(n) {
    const s = new Surface(this.width * n, this.height * n);
    for (let y = 0; y < s.height; y++) {
      const sy = (y / n) | 0;
      for (let x = 0; x < s.width; x++) {
        const sx = (x / n) | 0;
        const si = (sy * this.width + sx) * 4, di = (y * s.width + x) * 4;
        s.data[di] = this.data[si]; s.data[di + 1] = this.data[si + 1];
        s.data[di + 2] = this.data[si + 2]; s.data[di + 3] = this.data[si + 3];
      }
    }
    return s;
  }

  /** Snap every pixel to the nearest canon colour. Returns Set of indices used. */
  quantize(palette, pool) {
    const used = new Set();
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const c = palette.nearest(d[i], d[i + 1], d[i + 2], pool);
      d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b;
      if (d[i + 3] > 0) d[i + 3] = 255;
      used.add(c.index);
    }
    return used;
  }

  toPNGBuffer() {
    const { createCanvas, createImageData } = require('canvas');
    const cv = createCanvas(this.width, this.height);
    const ctx = cv.getContext('2d');
    const img = createImageData(new Uint8ClampedArray(this.data), this.width, this.height);
    ctx.putImageData(img, 0, 0);
    return cv.toBuffer('image/png');
  }

  writePNG(outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, this.toPNGBuffer());
    return outPath;
  }

  /** node-canvas Canvas holding this surface (for review overlays). */
  toCanvas() {
    const { createCanvas, createImageData } = require('canvas');
    const cv = createCanvas(this.width, this.height);
    const ctx = cv.getContext('2d');
    ctx.putImageData(createImageData(new Uint8ClampedArray(this.data), this.width, this.height), 0, 0);
    return cv;
  }
}

module.exports = { Surface, parseHex, clamp };
