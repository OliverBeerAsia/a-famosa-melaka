'use strict';
/**
 * MELAKA FORGE — ISOMETRIC MATH
 * =============================
 * ONE projection for the whole game (art-critic defect #5: the shipping plates
 * currently mix 1-point perspective, genuine 2:1 iso and flat front elevations
 * on the same screen).
 *
 * THE PROJECTION
 *   screen.x = originX + (tx - ty) * tileWidth  / 2
 *   screen.y = originY + (tx + ty) * tileHeight / 2 - z
 * with tileWidth = 2 * tileHeight (true 2:1) and z in NATIVE PIXELS (verticals
 * stay vertical and unforeshortened, which is what makes 16x32 character
 * sprites legal on this ground).
 *
 * SCREEN DIRECTIONS (memorise these — every kit depends on them)
 *   +tx  -> down-RIGHT   (+tw/2, +th/2)
 *   +ty  -> down-LEFT    (-tw/2, +th/2)
 *   (1,-1) tile step -> pure screen HORIZONTAL (+tw, 0)   <- streets run on this
 *   (1, 1) tile step -> pure screen VERTICAL   (0, +th)   <- depth / sort axis
 *
 * LIGHT (from palette.cjs SUN: azimuth 315 deg = NW, i.e. screen upper-left)
 *   roof / ground (up-facing) : brightest
 *   +ty face (down-LEFT)      : LIT      — normal points toward the sun
 *   +tx face (down-RIGHT)     : SHADOW
 *   cast shadows fall down-RIGHT (+x, +y)
 * A box's two visible faces are always +tx and +ty; they meet at the footprint's
 * bottom corner C = (tx+w, ty+d). The LIT face is the left one, the SHADOW face
 * the right one.
 *
 * DEPTH
 *   depth(tx, ty) = tx + ty  (== screen y of the ground point / (th/2))
 * Painter's order is a stable sort on the FRONT-most footprint corner, so an
 * object is drawn after everything it can overlap.
 */

const FACE = Object.freeze({
  TX: '+tx',   // down-right, shadow side
  TY: '+ty',   // down-left, lit side
  TOP: 'top',
});

/** Relative brightness offset (in ramp steps) for each surface orientation. */
const FACE_LIGHT = Object.freeze({
  top: 1,      // roofs / ground: brightest
  '+ty': 0,    // lit vertical face
  '+tx': -2,   // shadow vertical face
  '-ty': -3,   // (only visible on cutaways / interiors)
  '-tx': -1,
});

function createIso(opts) {
  const tileWidth = (opts && opts.tileWidth) || 32;
  const tileHeight = (opts && opts.tileHeight) || (tileWidth / 2);
  const originX = (opts && opts.originX) || 0;
  const originY = (opts && opts.originY) || 0;
  const hw = tileWidth / 2, hh = tileHeight / 2;

  const iso = {
    tileWidth, tileHeight, originX, originY, hw, hh,

    /** Continuous tile coord -> screen point. z is native px of elevation. */
    toScreen(tx, ty, z) {
      return {
        x: originX + (tx - ty) * hw,
        y: originY + (tx + ty) * hh - (z || 0),
      };
    },

    /** Screen point (at elevation z) -> continuous tile coord. */
    toTile(sx, sy, z) {
      const dx = sx - originX;
      const dy = sy - originY + (z || 0);
      return { tx: dy / tileHeight + dx / tileWidth, ty: dy / tileHeight - dx / tileWidth };
    },

    /** Centre of tile cell (i, j). */
    centre(i, j, z) { return iso.toScreen(i + 0.5, j + 0.5, z); },

    /** Painter's-algorithm key. Higher = nearer the camera = drawn later. */
    depth(tx, ty, z) { return (tx + ty) - (z || 0) * 1e-6; },

    /** Screen y of the ground point under a tile coord (the engine's sort key). */
    groundY(tx, ty) { return originY + (tx + ty) * hh; },

    /** Parallelogram spec for one ground cell: {o, eu, ev}. */
    cell(i, j, z) {
      return {
        o: iso.toScreen(i, j, z),
        eu: { x: hw, y: hh },   // +tx edge
        ev: { x: -hw, y: hh },  // +ty edge
        uLen: tileWidth, vLen: tileWidth,
      };
    },

    /** Parallelogram covering a tile-space rect [tx,tx+w) x [ty,ty+d). */
    region(tx, ty, w, d, z) {
      return {
        o: iso.toScreen(tx, ty, z),
        eu: { x: hw * w, y: hh * w },
        ev: { x: -hw * d, y: hh * d },
        uLen: tileWidth * w, vLen: tileWidth * d,
      };
    },

    /** Screen polygon (4 pts) of a tile-space rect at elevation z. */
    footprintPoly(tx, ty, w, d, z) {
      return [
        iso.toScreen(tx, ty, z),
        iso.toScreen(tx + w, ty, z),
        iso.toScreen(tx + w, ty + d, z),
        iso.toScreen(tx, ty + d, z),
      ];
    },

    /**
     * A vertical wall face standing on the tile-space segment a->b, `height`
     * native px tall. Returns a descriptor whose `each(cb)` walks the face
     * column by column; cb(x, yTop, yBottom, u, baseY).
     *
     * u runs 0..lenPx along the face (screen-horizontal distance, which is the
     * axis wall textures repeat on), v runs 0 at the bottom pixel row upward.
     * Because x depends only on u, the inverse is exact — no seams, no AA.
     */
    face(a, b, height, z) {
      let p0 = iso.toScreen(a.tx, a.ty, z);
      let p1 = iso.toScreen(b.tx, b.ty, z);
      let flip = false;
      if (p1.x < p0.x) { const t = p0; p0 = p1; p1 = t; flip = true; }
      const lenPx = p1.x - p0.x;
      return {
        p0, p1, height, lenPx, flip,
        /** screen point for face-local (u, v) */
        at(u, v) {
          const t = lenPx === 0 ? 0 : u / lenPx;
          return { x: p0.x + u, y: Math.round(p0.y + (p1.y - p0.y) * t) - v };
        },
        baseYAt(u) {
          const t = lenPx === 0 ? 0 : u / lenPx;
          return Math.round(p0.y + (p1.y - p0.y) * t);
        },
        poly() {
          return [
            { x: p0.x, y: p0.y - height }, { x: p1.x, y: p1.y - height },
            { x: p1.x, y: p1.y }, { x: p0.x, y: p0.y },
          ];
        },
      };
    },
  };
  return iso;
}

/**
 * Draw a wall face with a shader. shader(u, v, x, y) -> hex|null.
 *   u: 0..lenPx along the face (left to right on screen)
 *   v: 0 at the bottom pixel row of the wall, increasing upward
 * `clipTop`/`clipBottom` trim rows (used for arcade openings).
 */
function drawFace(surface, faceDesc, shader, opts) {
  const o = opts || {};
  const h = o.height === undefined ? faceDesc.height : o.height;
  const uFrom = o.uFrom === undefined ? 0 : o.uFrom;
  const uTo = o.uTo === undefined ? faceDesc.lenPx : o.uTo;
  const vFrom = o.vFrom === undefined ? 0 : o.vFrom;
  const vTo = o.vTo === undefined ? h : o.vTo;
  const dy = o.dy || 0;
  const x0 = Math.round(faceDesc.p0.x);
  for (let u = Math.max(0, Math.floor(uFrom)); u < Math.min(faceDesc.lenPx, Math.ceil(uTo)); u++) {
    const baseY = faceDesc.baseYAt(u + 0.5) + dy;
    const x = x0 + u;
    for (let v = vFrom; v < vTo; v++) {
      const y = baseY - 1 - v;
      const c = shader(u, v, x, y);
      if (c) surface.setHex(x, y, c);
    }
  }
}

/** Fill a tile-space rect of GROUND with a shader taking (ftx, fty) tile coords. */
function fillGround(surface, iso, tilePoly, shader, opts) {
  const o = opts || {};
  const z = o.z || 0;
  const pts = tilePoly.map((p) => iso.toScreen(p.tx, p.ty, z));
  surface.fillPoly(pts, (u, v, x, y) => {
    const t = iso.toTile(x + 0.5, y + 0.5, z);
    return shader(t.tx, t.ty, x, y);
  });
}

/** Point-in-polygon in tile space. */
function tileInPoly(tx, ty, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.ty > ty) !== (b.ty > ty) &&
        tx < (b.tx - a.tx) * (ty - a.ty) / (b.ty - a.ty) + a.tx) inside = !inside;
  }
  return inside;
}

/** Tile-space rect -> polygon. */
function rectPoly(tx, ty, w, d) {
  return [{ tx, ty }, { tx: tx + w, ty }, { tx: tx + w, ty: ty + d }, { tx, ty: ty + d }];
}

/** Deterministic integer hash -> [0,1). NEVER Math.random. */
function hash2(i, j, seed) {
  let h = (i | 0) * 374761393 + (j | 0) * 668265263 + ((seed | 0) + 1) * 2246822519;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** Legacy-compatible seeded random (mined from tools/ultima8-graphics/tiles.cjs). */
function seededRandom(x, y, seed) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + (seed || 0) * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

module.exports = {
  createIso, drawFace, fillGround, tileInPoly, rectPoly,
  hash2, seededRandom, FACE, FACE_LIGHT,
};
