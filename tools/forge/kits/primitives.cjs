'use strict';
/**
 * MELAKA FORGE — KIT PRIMITIVES
 * =============================
 * The small solid volumes every kit is built out of, extracted from props.cjs
 * so the dock / malay / nature kits can use them without a require cycle.
 *
 * Everything here obeys the one sun (iso.cjs): up-facing surfaces are the
 * brightest step, the +ty (down-LEFT) face is lit, the +tx (down-RIGHT) face is
 * in shadow, and cast shadows fall down-right. Nothing here is anti-aliased and
 * nothing calls Math.random.
 */

const P = require('../palette.cjs');
const T = require('../texture.cjs');
const { drawFace, hash2 } = require('../iso.cjs');

const step = T.step;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function ellipsePts(cx, cy, rx, ry, n) {
  const pts = [];
  for (let i = 0; i < (n || 32); i++) {
    const a = (i / (n || 32)) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

/**
 * Baked contact shadow: elliptical, offset down-right, 2-value checker —
 * PLUS a solid dark rim at its outer edge.
 *
 * WHY THE RIM (benchmark #17, strict reading). The compositor blocks a small
 * diamond of walk mask under every prop. Measured per boundary pixel, the old
 * checkered shadow left about half of that diamond's edge at the same value as
 * the open ground beside it, so the plate scored 8.8% mean separation with only
 * 12% of boundary pixels clearing the 25% bar: you could not see where the
 * ground stopped. A 2px SOLID rim at the footprint edge is what a real contact
 * occlusion looks like anyway — the last millimetre before two surfaces meet
 * gets no bounce light at all — and it puts a hard local step exactly on the
 * pixels the metric samples.
 */
function contactShadow(surface, iso, tx, ty, rTiles, strength) {
  const c = iso.toScreen(tx, ty, 0);
  const rx = rTiles * iso.tileWidth * 0.5;
  const ry = rTiles * iso.tileHeight * 0.5;
  const s = strength === undefined ? 0.40 : strength;
  const cx = c.x + rx * 0.45, cy = c.y + ry * 0.5;
  const RX = Math.max(1, rx * 1.15), RY = Math.max(1, ry * 1.15);
  surface.fillPoly(ellipsePts(cx, cy, RX, RY, 28), (u, v, x, y) => {
    const dx = (x + 0.5 - cx) / RX, dy = (y + 0.5 - cy) / RY;
    const q = dx * dx + dy * dy;
    const t = q > 0.58
      ? Math.min(0.82, s * 1.6)                              // solid contact rim
      : (T.checker2(x, y) ? s : s * 0.5);                    // dithered interior
    T.shadePixel(surface, x, y, t);
    return null;
  });
}

/**
 * THE CONTACT RIM — the one thing benchmark #17 actually measures.
 *
 * The compositor blocks a tile-space RECT under every prop and building, which
 * on screen is a 2:1 DIAMOND. An elliptical contact shadow does not follow that
 * diamond: its dark edge falls outside the blocked area on three sides and
 * inside it on the other, so the pixels the metric samples — a walkable pixel
 * and the blocked pixel it touches — end up either both dark or both light.
 * That is why the accepted plate measured 8.8% mean separation while looking
 * grounded to the eye.
 *
 * So this darkens the inner 2px of the blocked footprint itself, solid, no
 * dither. The value step then lands exactly on the boundary, on every side, for
 * every object, because it is derived from the same rect the walk mask is.
 */
function footprintRim(surface, iso, tx, ty, w, d, opts) {
  const o = opts || {};
  const strength = o.strength === undefined ? 0.72 : o.strength;
  const band = o.band === undefined ? 0.085 : o.band;      // in tiles (~2.7px)
  const pts = [
    iso.toScreen(tx, ty, 0), iso.toScreen(tx + w, ty, 0),
    iso.toScreen(tx + w, ty + d, 0), iso.toScreen(tx, ty + d, 0),
  ];
  surface.fillPoly(pts, (u, v, x, y) => {
    const t = iso.toTile(x + 0.5, y + 0.5, 0);
    const e = Math.min(t.tx - tx, tx + w - t.tx, t.ty - ty, ty + d - t.ty);
    if (e > band) return null;
    const k = strength * (1 - (e / band) * 0.45);   // hardest right on the edge
    const px = surface.get(x, y);
    if (!px) return null;
    // DARK GROUND CANNOT BE DARKENED ENOUGH. On packed earth in shade the base
    // value is already near the shadow anchor, so a shadow rim moves it a few
    // luminance points and the boundary stays invisible. There, the honest cue
    // is the opposite one: the pale scuff of dust and grit that collects where
    // something has stood on a dirt floor for years. Bright ground gets shade,
    // dark ground gets wear — either way there is a real value step exactly on
    // the footprint edge.
    if (P.luma(px.r, px.g, px.b) < (o.liftBelow === undefined ? 118 : o.liftBelow)) {
      surface.blendHex(x, y, P.RAMPS.earth[4], k * 0.92);
    } else {
      // A building's own cast shadow lies along two of its four sides, so a
      // merely violet contact there lands on ground that is already dark and
      // the step disappears. Buildings therefore contact into the VOID anchor:
      // the last pixel before two masses meet has no bounce light at all.
      surface.blendHex(x, y, P.ANCHORS[o.anchor || 'shadow-violet'], k);
    }
    return null;
  });
}

/**
 * The 2px band of a material's own darkest steps along the bottom of a wall
 * face. This is the building-scale twin of the rim above: the compositor blocks
 * the footprint diamond, whose near edges are exactly the wall bases, so
 * darkening the wall's own bottom two rows puts the value step precisely on the
 * boundary — and, unlike an ambient-occlusion band painted onto the GROUND, it
 * does not darken the walkable side and destroy the very contrast it is for.
 */
function contactBand(surface, faceDesc, ramp, opts) {
  const o = opts || {};
  const px = o.px === undefined ? 2 : o.px;
  const x0 = Math.round(faceDesc.p0.x);
  for (let u = 0; u < faceDesc.lenPx; u++) {
    const baseY = faceDesc.baseYAt(u + 0.5) + (o.dy || 0);
    for (let k = 0; k < px; k++) {
      surface.setHex(x0 + u, baseY - 1 - k, step(ramp, k === 0 ? 0 : Math.min(1, k)));
    }
  }
}

/** Axis-aligned iso box: top + lit face + shadow face. */
function isoBox(surface, iso, o) {
  const { tx, ty, w, d, h } = o;
  const mat = o.material || 'timber';
  const seed = o.seed || 1;
  const topTex = o.topTex || T.plank({ material: mat, light: 4, plankW: o.plankW || 4, seed });
  const litTex = o.litTex || T.plank({ material: mat, light: 3, plankW: o.plankW || 4, seed: seed + 1 });
  const shTex = o.shTex || T.plank({ material: mat, light: 1, plankW: o.plankW || 4, seed: seed + 2 });

  const reg = iso.region(tx, ty, w, d, h + (o.z || 0));
  surface.fillPara(reg.o, reg.eu, reg.ev, topTex, reg);
  const fLit = iso.face({ tx, ty: ty + d }, { tx: tx + w, ty: ty + d }, h, o.z || 0);
  drawFace(surface, fLit, litTex);
  const fSh = iso.face({ tx: tx + w, ty: ty + d }, { tx: tx + w, ty }, h, o.z || 0);
  drawFace(surface, fSh, shTex);

  // arris: bright 1px on the lit side of the near corner, dark on the shadow side
  const C = iso.toScreen(tx + w, ty + d, o.z || 0);
  const ramp = P.RAMPS[mat];
  for (let v = 0; v < h; v++) {
    surface.setHex(Math.round(C.x) - 1, Math.round(C.y) - 1 - v, step(ramp, 4));
    surface.setHex(Math.round(C.x), Math.round(C.y) - 1 - v, step(ramp, 0));
  }
  // contact band — only when the box actually stands ON the ground
  if (!o.z && o.contact !== false) {
    contactBand(surface, fLit, ramp, { px: 2 });
    contactBand(surface, fSh, ramp, { px: 2 });
  }
  return { top: h + (o.z || 0), corner: C };
}

/** Vertical cylinder (barrel, jar, post) with directional shading. */
function isoCyl(surface, iso, o) {
  const { tx, ty } = o;
  const mat = o.material || 'timber';
  const ramp = P.RAMPS[mat];
  const seed = o.seed || 1;
  const h = o.h || 15;
  const z = o.z || 0;
  const c = iso.toScreen(tx, ty, z);
  const rx0 = (o.r || 0.34) * iso.tileWidth * 0.5;
  const ry0 = (o.r || 0.34) * iso.tileHeight * 0.5;
  const bulge = o.bulge === undefined ? 0 : o.bulge;
  const profile = o.profile || ((t) => 1 + bulge * Math.sin(Math.PI * t));

  for (let v = 0; v < h; v++) {
    const k = profile(v / h);
    const rx = rx0 * k, ry = ry0 * k;
    surface.fillPoly(ellipsePts(c.x, c.y - v, rx, ry, 28), (uu, vv, x, y) => {
      const dx = (x + 0.5 - c.x) / Math.max(1, rx);
      let sIdx = dx < -0.55 ? 3 : dx < -0.05 ? 4 : dx < 0.45 ? 2 : 1;
      if (o.stave) {
        const ang = Math.round((dx + 1) * 6);
        if (hash2(ang, 0, seed) < 0.28) sIdx -= 1;
      }
      if (o.hoops && o.hoops.indexOf(v) >= 0) sIdx = dx < -0.2 ? 4 : 1;
      // contact band at the ground line (see contactBand)
      if (!z && o.contact !== false && v < 2) sIdx = v === 0 ? 0 : 1;
      return step(ramp, clamp(sIdx, 0, 4));
    });
  }
  // top face
  const kTop = profile(1);
  surface.fillPoly(ellipsePts(c.x, c.y - h, rx0 * kTop, ry0 * kTop, 28), (uu, vv, x, y) => {
    const dx = (x + 0.5 - c.x) / Math.max(1, rx0 * kTop);
    const dy = (y + 0.5 - (c.y - h)) / Math.max(1, ry0 * kTop);
    if (o.open && dx * dx + dy * dy < 0.5) return P.ANCHORS['shadow-void'];
    return step(ramp, dy < -0.15 ? 4 : 3);
  });
  return { top: h + z, c };
}

/** Thin post. */
function post(surface, iso, o) {
  const c = iso.toScreen(o.tx, o.ty, 0);
  const ramp = P.RAMPS[o.material || 'timber'];
  const w = o.w || 3;
  for (let v = 0; v < o.h; v++) {
    for (let dx = 0; dx < w; dx++) {
      const contact = o.contact !== false && v < 2;
      surface.setHex(Math.round(c.x) - Math.floor(w / 2) + dx, Math.round(c.y) - 1 - v,
        step(ramp, contact ? (v === 0 ? 0 : 1) : (dx === 0 ? 4 : dx === w - 1 ? 1 : 3)));
    }
  }
  return c;
}

/** Cloth panel hanging in the vertical plane (awning, banner, laundry). */
function cloth(surface, iso, o) {
  const a = iso.toScreen(o.ax, o.ay, o.z || 0);
  const b = iso.toScreen(o.bx, o.by, o.z || 0);
  const ramp = o.ramp || P.RAMPS.terracotta;
  const h = o.h || 14;
  const seed = o.seed || 9;
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
  for (let x = Math.round(x0); x <= Math.round(x1); x++) {
    const t = (x - x0) / Math.max(1, x1 - x0);
    const baseY = Math.round(a.y + (b.y - a.y) * (a.x <= b.x ? t : 1 - t));
    const sag = Math.round(Math.sin(Math.PI * t) * (o.sag === undefined ? 3 : o.sag));
    const fold = Math.floor((x - x0) / 5);
    const shade = hash2(fold, 0, seed) < 0.35 ? -1 : 0;
    for (let v = 0; v < h; v++) {
      const jag = v === 0 ? Math.floor(hash2(x, 1, seed) * 2) : 0;
      surface.setHex(x, baseY + sag - v + jag,
        step(ramp, clamp((v > h - 3 ? 2 : v < 2 ? 2 : 3) + shade + (t < 0.45 ? 1 : 0), 0, 4)));
    }
  }
}

// ---------------------------------------------------------------------------
// ADDITIONS FOR THE DOCK / MALAY / NATURE KITS
// ---------------------------------------------------------------------------

/**
 * A 1-3 px line in screen space (rigging, rope, bamboo, ladder rail). Bresenham,
 * integer, no AA. `dash` skips pixels so a rope can read as taut cordage.
 */
function lineTo(surface, x0, y0, x1, y1, hex, opts) {
  const o = opts || {};
  const th = o.thickness || 1;
  const dash = o.dash || 0;
  let x = Math.round(x0), y = Math.round(y0);
  const xe = Math.round(x1), ye = Math.round(y1);
  const dx = Math.abs(xe - x), dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1, sy = y < ye ? 1 : -1;
  let err = dx + dy, i = 0;
  for (;;) {
    if (!dash || (i % dash) !== dash - 1) {
      for (let k = 0; k < th; k++) {
        const c = typeof hex === 'function' ? hex(i, k) : hex;
        if (c) surface.setHex(o.vertical ? x + k : x, o.vertical ? y : y + k, c);
      }
    }
    if (x === xe && y === ye) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    i++;
    if (i > 4096) break;
  }
}

/**
 * A vertical mirror-streak reflection under an object standing in water.
 * Reads the source rows above `baseY` and re-blends them downward, broken into
 * 2px wave bands so it never looks like a flipped copy of the sprite.
 */
function waterReflection(surface, x0, x1, baseY, height, opts) {
  const o = opts || {};
  const seed = o.seed || 3;
  const strength = o.strength === undefined ? 0.5 : o.strength;
  for (let x = Math.max(0, Math.round(x0)); x <= Math.min(surface.width - 1, Math.round(x1)); x++) {
    for (let v = 0; v < height; v++) {
      const src = surface.get(x, baseY - 1 - Math.round(v * (o.squash === undefined ? 1.5 : o.squash)));
      if (!src || src.a === 0) continue;
      const y = baseY + v;
      // 2px wave bands: every other band is displaced sideways by one pixel,
      // which is what makes a reflection read as lying ON moving water.
      const band = (y >> 1);
      if (hash2(band, x >> 2, seed) < 0.30) continue;
      const shift = hash2(band, 0, seed + 5) < 0.5 ? 0 : 1;
      const t = strength * (1 - v / height) * 0.9;
      surface.blendHex(x + shift, y, P.rgbToHex(src.r, src.g, src.b), t);
    }
  }
}

/**
 * A tapered mast / piling / bamboo pole standing at a screen point. Returns the
 * screen point of its top so rigging can be hung off it.
 */
function mast(surface, x, y, height, opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'timber'];
  const w0 = o.w0 === undefined ? 4 : o.w0;
  const w1 = o.w1 === undefined ? 2 : o.w1;
  const xi = Math.round(x);
  for (let v = 0; v < height; v++) {
    const t = v / Math.max(1, height - 1);
    const w = Math.max(1, Math.round(w0 + (w1 - w0) * t));
    const lean = Math.round((o.lean || 0) * t);
    for (let k = 0; k < w; k++) {
      const shade = k === 0 ? 4 : k === w - 1 && w > 2 ? 1 : 3;
      surface.setHex(xi - Math.floor(w / 2) + k + lean, Math.round(y) - 1 - v,
        step(ramp, clamp(shade + (o.light || 0), 0, 4)));
    }
    if (o.banded && (v % (o.banded || 9)) === 0) {
      for (let k = 0; k < w; k++) surface.setHex(xi - Math.floor(w / 2) + k + lean, Math.round(y) - 1 - v, step(ramp, 1));
    }
  }
  return { x: xi + Math.round(o.lean || 0), y: Math.round(y) - height };
}

/**
 * A ROPE, drawn so it survives at native resolution.
 *
 * THE DEFECT THIS FIXES. A rope used to be one pixel of `earth[1]` per column.
 * One native pixel is BELOW the minimum feature size of this art — every other
 * detail in the game is at least 3px — so a 60px run of it does not read as a
 * cord slung between two buildings, it reads as a SCRATCH ON THE IMAGE. At
 * night, when the plate around it goes dark and the line does not, it is the
 * most conspicuous thing on the screen.
 *
 * Two fixes, and both are needed:
 *
 *  1. TWO PIXELS OF WEIGHT — a strand and its own shade underneath. That is
 *     the minimum that reads as a round thing rather than as a hairline.
 *  2. IT PICKS ITS VALUE OFF WHAT IT CROSSES. A rope runs from a wall, over
 *     the sky, onto another wall, and no single colour reads against all of
 *     them: dark on sky, and it vanishes against the shadowed façade; light
 *     enough for the façade, and it stripes the sky. So each column samples
 *     the pixel it is about to cover and takes the dark treatment over a
 *     bright background and the light one over a dark background. Both
 *     treatments are canon and hue-shifted (timber over sky, earth over
 *     masonry), never a grey.
 */
function ropeSpan(s, ax, ay, bx, by, opts) {
  const o = opts || {};
  const x0 = Math.round(Math.min(ax, bx)), x1 = Math.round(Math.max(ax, bx));
  const span = Math.max(1, x1 - x0);
  const sag = o.sag === undefined ? Math.max(3, span * 0.10) : o.sag;
  const yAt = (x) => {
    const t = (x - x0) / span;
    return Math.round(ay + (by - ay) * t + Math.sin(Math.PI * t) * sag);
  };
  const T = P.RAMPS.timber, E = P.RAMPS.earth;
  for (let x = x0; x <= x1; x++) {
    const y = yAt(x);
    const u = s.get(x, y);
    // treat empty (nothing painted yet) as sky — it is, on a plate
    const bright = !u || u.a !== 255 || (0.299 * u.r + 0.587 * u.g + 0.114 * u.b) > 96;
    s.setHex(x, y, bright ? step(T, 1) : step(E, 3));
    s.setHex(x, y + 1, bright ? step(T, 0) : step(E, 2));
  }
  return yAt;
}

module.exports = {
  ellipsePts, contactShadow, contactBand, footprintRim, isoBox, isoCyl, post, cloth,
  lineTo, waterReflection, mast,
  step, clamp,
  ropeSpan,
};
