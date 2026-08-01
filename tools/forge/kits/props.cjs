'use strict';
/**
 * MELAKA FORGE — KIT: PROPS
 * =========================
 * Street furniture and trade goods, drawn as real 2:1 iso volumes (art-critic
 * defect #5: every existing prop is a flat FRONT ELEVATION standing on iso
 * ground). Each prop:
 *   - has a top plane, a LIT (+ty, down-left) face and a SHADOW (+tx) face,
 *   - bakes a contact shadow (benchmark #13 is non-negotiable at our 17.8%
 *     character:screen ratio),
 *   - declares its blocked footprint and an examinable anchor.
 *
 * Sizes are in tiles for the footprint and NATIVE px for height, so the
 * benchmark scale rules are checkable: a barrel is 15px tall next to a 32px
 * player; a stall canopy tops out at 40px; nothing is player-height by accident.
 */

const P = require('../palette.cjs');
const T = require('../texture.cjs');
const { drawFace, hash2 } = require('../iso.cjs');

const step = T.step;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

function ellipsePts(cx, cy, rx, ry, n) {
  const pts = [];
  for (let i = 0; i < (n || 32); i++) {
    const a = (i / (n || 32)) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

/** Baked contact shadow: elliptical, offset down-right, 2-value checker. */
function contactShadow(surface, iso, tx, ty, rTiles, strength) {
  const c = iso.toScreen(tx, ty, 0);
  const rx = rTiles * iso.tileWidth * 0.5;
  const ry = rTiles * iso.tileHeight * 0.5;
  const s = strength === undefined ? 0.40 : strength;
  surface.fillPoly(ellipsePts(c.x + rx * 0.45, c.y + ry * 0.5, rx * 1.15, ry * 1.15, 24),
    (u, v, x, y) => { T.shadePixel(surface, x, y, T.checker2(x, y) ? s : s * 0.5); return null; });
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
      surface.setHex(Math.round(c.x) - Math.floor(w / 2) + dx, Math.round(c.y) - 1 - v,
        step(ramp, dx === 0 ? 4 : dx === w - 1 ? 1 : 3));
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
// PROP REGISTRY
// ---------------------------------------------------------------------------
const PROPS = {};
function def(key, meta, draw) { PROPS[key] = Object.assign({ key, draw }, meta); }

// --- cooperage / cargo ------------------------------------------------------
def('barrel', { collide: 0.55, examine: 'A stout oak barrel, hooped in iron.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.5);
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.46, h: o.h || 15, material: 'timber', seed: o.seed, stave: true, bulge: 0.13, hoops: [2, 7, 12] });
});

def('barrel-open', { collide: 0.55, examine: 'An open cask, half full of brackish water.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.5);
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.46, h: 13, material: 'timber', seed: o.seed, stave: true, hoops: [2, 10], open: true });
});

def('crate', { collide: 0.6, examine: 'A pine crate stencilled with a merchant\'s mark.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.3, o.ty + 0.3, 0.72);
  const w = o.w || 0.62, d = o.d || 0.62;
  isoBox(s, iso, { tx: o.tx, ty: o.ty, w, d, h: o.h || 14, material: 'timber', seed: o.seed, plankW: 4 });
  // corner batten + stencil mark
  const C = iso.toScreen(o.tx + w, o.ty + d, 0);
  const brass = P.ACCENTS['brass-gold'];
  s.setHex(Math.round(C.x) - 8, Math.round(C.y) - 9, brass);
  s.setHex(Math.round(C.x) - 7, Math.round(C.y) - 9, brass);
  s.setHex(Math.round(C.x) - 8, Math.round(C.y) - 8, brass);
});

def('crate-stack', { collide: 0.9, examine: 'Crates stacked two high, roped against the rain.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.45, o.ty + 0.45, 1.05);
  isoBox(s, iso, { tx: o.tx, ty: o.ty, w: 0.9, d: 0.9, h: 15, material: 'timber', seed: o.seed });
  isoBox(s, iso, { tx: o.tx + 0.14, ty: o.ty + 0.16, w: 0.6, d: 0.6, h: 12, z: 15, material: 'timber', seed: (o.seed || 1) + 3 });
});

def('sack-pile', { collide: 0.75, examine: 'Sacks of pepper, sagging under their own weight.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.3, o.ty + 0.3, 0.85);
  const ramp = P.RAMPS.earth;
  const spots = [[0, 0, 12], [0.34, 0.06, 11], [0.16, 0.34, 10], [0.2, 0.18, 9]];
  spots.forEach(([dx, dy, h], i) => {
    const c = iso.toScreen(o.tx + dx, o.ty + dy, i === 3 ? 11 : 0);
    for (let v = 0; v < h; v++) {
      const k = 1 - Math.pow(v / h, 2.2) * 0.35;
      s.fillPoly(ellipsePts(c.x, c.y - v, 8 * k, 4 * k, 20), (uu, vv, x, y) => {
        const ddx = (x + 0.5 - c.x) / (8 * k);
        let idx = ddx < -0.4 ? 4 : ddx < 0.15 ? 3 : ddx < 0.6 ? 2 : 1;
        if (hash2(Math.floor(x / 4), Math.floor((y + v) / 3), (o.seed || 1) + i) < 0.2) idx -= 1;
        return step(ramp, clamp(idx, 0, 4));
      });
    }
    // tied neck
    s.setHex(Math.round(c.x), Math.round(c.y) - h, step(ramp, 1));
  });
});

def('basket', { collide: 0.45, examine: 'A rattan basket heaped with rambutan and mangosteen.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.42);
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.42, h: 9, material: 'timber', seed: o.seed, stave: true, profile: (t) => 0.78 + 0.28 * t });
  const c = iso.toScreen(o.tx, o.ty, 0);
  const fruit = [P.ACCENTS['flag-crimson'], P.RAMPS.terracotta[3], P.RAMPS.foliage[2], P.RAMPS.earth[4]];
  for (let i = 0; i < 12; i++) {
    const a = hash2(i, 0, (o.seed || 1) + 5) * Math.PI * 2;
    const rr = hash2(i, 1, (o.seed || 1) + 5) * 0.8;
    const px = Math.round(c.x + Math.cos(a) * 6.5 * rr);
    const py = Math.round(c.y - 10 + Math.sin(a) * 3 * rr);
    const col = fruit[i % fruit.length];
    s.setHex(px, py, col); s.setHex(px + 1, py, col); s.setHex(px, py + 1, col);
    s.setHex(px + 1, py + 1, P.RAMPS.terracotta[1]);
  }
});

def('amphora', { collide: 0.4, examine: 'A tall glazed jar — palm oil, or arrack.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.4);
  isoCyl(s, iso, {
    tx: o.tx, ty: o.ty, r: 0.4, h: 18, material: 'terracotta', seed: o.seed,
    profile: (t) => 0.55 + 0.85 * Math.sin(Math.PI * clamp(t * 0.86 + 0.07, 0, 1)),
  });
});

def('pot-row', { collide: 0.8, examine: 'Water jars set out to catch the afternoon rain.' }, (s, iso, o) => {
  [[0, 0, 13], [0.42, 0.1, 16], [0.16, 0.44, 11]].forEach(([dx, dy, h], i) => {
    contactShadow(s, iso, o.tx + dx, o.ty + dy, 0.38);
    isoCyl(s, iso, {
      tx: o.tx + dx, ty: o.ty + dy, r: 0.34, h, material: 'terracotta', seed: (o.seed || 1) + i,
      profile: (t) => 0.6 + 0.8 * Math.sin(Math.PI * clamp(t * 0.88 + 0.06, 0, 1)),
    });
  });
});

def('rope-coil', { collide: 0.5, examine: 'A coil of tarred hemp, stiff with salt.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.5);
  const c = iso.toScreen(o.tx, o.ty, 0);
  const ramp = P.RAMPS.earth;
  for (let v = 0; v < 6; v++) {
    for (let ring = 0; ring < 3; ring++) {
      const rr = 10 - ring * 3;
      s.fillPoly(ellipsePts(c.x, c.y - v, rr, rr * 0.5, 24), (uu, vv, x, y) => {
        const dx = (x + 0.5 - c.x) / rr;
        if (Math.abs(dx) > 0.999) return null;
        return step(ramp, ((ring + v) % 2) ? 2 : (dx < -0.2 ? 4 : 3));
      });
    }
  }
});

// --- street furniture -------------------------------------------------------
def('bench', { collide: 0.7, examine: 'A worn bench under the arcade.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.4, o.ty + 0.15, 0.9);
  isoBox(s, iso, { tx: o.tx, ty: o.ty, w: 1.0, d: 0.28, h: 3, z: 8, material: 'timber', seed: o.seed });
  [[0.06, 0.06], [0.82, 0.06]].forEach(([dx, dy]) => {
    isoBox(s, iso, { tx: o.tx + dx, ty: o.ty + dy, w: 0.12, d: 0.16, h: 8, material: 'timber', seed: (o.seed || 1) + 2 });
  });
});

def('water-trough', { collide: 0.9, examine: 'A stone trough; the water is warm and green.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.4, o.ty + 0.2, 1.0);
  isoBox(s, iso, {
    tx: o.tx, ty: o.ty, w: 1.1, d: 0.5, h: 9, material: 'stone', seed: o.seed,
    topTex: T.ashlar({ material: 'stone', light: 4, blockW: 9, blockH: 5, seed: o.seed }),
    litTex: T.ashlar({ material: 'stone', light: 3, blockW: 9, blockH: 5, seed: o.seed }),
    shTex: T.ashlar({ material: 'stone', light: 1, blockW: 9, blockH: 5, seed: o.seed }),
  });
  const reg = iso.region(o.tx + 0.1, o.ty + 0.08, 0.9, 0.34, 9);
  s.fillPara(reg.o, reg.eu, reg.ev, (u, v, x, y) =>
    step(P.RAMPS.water, ((x + y) & 3) === 0 ? 3 : 2), reg);
});

def('bollard', { collide: 0.3, examine: 'A capstan-headed mooring post, rope-scarred.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.34);
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.3, h: 13, material: 'stone', seed: o.seed, profile: (t) => (t > 0.82 ? 1.25 : 1) });
});

def('lantern-post', { collide: 0.3, light: { type: 'lantern', radius: 46 }, examine: 'A pitch lantern on an iron bracket.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.3);
  const c = post(s, iso, { tx: o.tx, ty: o.ty, h: o.h || 40, material: 'timber', w: 3 });
  const topY = Math.round(c.y) - (o.h || 40);
  const brass = P.ACCENTS['brass-gold'];
  const flame = P.ACCENTS['lantern-flame'];
  for (let dx = -3; dx <= 3; dx++) { s.setHex(Math.round(c.x) + dx, topY - 1, brass); }
  for (let v = 0; v < 8; v++) {
    for (let dx = -3; dx <= 3; dx++) {
      const edge = Math.abs(dx) === 3 || v === 7;
      s.setHex(Math.round(c.x) + dx, topY + v, edge ? brass : (v > 1 && v < 6 && Math.abs(dx) < 3 ? flame : P.RAMPS.terracotta[3]));
    }
  }
  for (let dx = -2; dx <= 2; dx++) s.setHex(Math.round(c.x) + dx, topY + 8, P.RAMPS.terracotta[1]);
});

def('brazier', { collide: 0.4, light: { type: 'fire', radius: 52 }, examine: 'A charcoal brazier; skewers of grilled fish sputter over it.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.45);
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.36, h: 11, material: 'stone', seed: o.seed, profile: (t) => 0.7 + 0.45 * t });
  const c = iso.toScreen(o.tx, o.ty, 0);
  const flame = P.ACCENTS['lantern-flame'];
  s.fillPoly(ellipsePts(c.x, c.y - 11, 6, 3, 18), (uu, vv, x, y) =>
    hash2(x, y, o.seed || 1) > 0.4 ? flame : P.ACCENTS['flag-crimson']);
  for (let i = 0; i < 5; i++) {
    s.setHex(Math.round(c.x) - 2 + i, Math.round(c.y) - 13 - (i % 2), flame);
  }
});

def('step-stone', { collide: 0.5, examine: 'A mounting block, hollowed by two centuries of boots.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.2, o.ty + 0.2, 0.6);
  isoBox(s, iso, {
    tx: o.tx, ty: o.ty, w: 0.55, d: 0.55, h: 7, material: 'stone', seed: o.seed,
    topTex: T.ashlar({ material: 'stone', light: 4, blockW: 12, blockH: 8, seed: o.seed }),
    litTex: T.ashlar({ material: 'stone', light: 3, blockW: 12, blockH: 8, seed: o.seed }),
    shTex: T.ashlar({ material: 'stone', light: 1, blockW: 12, blockH: 8, seed: o.seed }),
  });
});

def('padrao', { collide: 0.45, examine: 'A stone padrão cut with the Cross of the Order of Christ.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.5);
  isoBox(s, iso, {
    tx: o.tx, ty: o.ty, w: 0.42, d: 0.42, h: 26, material: 'stone', seed: o.seed,
    topTex: T.ashlar({ material: 'stone', light: 4, blockW: 10, blockH: 7, seed: o.seed }),
    litTex: T.ashlar({ material: 'stone', light: 3, blockW: 10, blockH: 7, seed: o.seed }),
    shTex: T.ashlar({ material: 'stone', light: 1, blockW: 10, blockH: 7, seed: o.seed }),
  });
  const c = iso.toScreen(o.tx + 0.21, o.ty + 0.21, 0);
  const cr = P.ACCENTS['flag-crimson'];
  for (let k = -3; k <= 3; k++) { s.setHex(Math.round(c.x) - 4, Math.round(c.y) - 16 + k, cr); }
  for (let k = -3; k <= 3; k++) { s.setHex(Math.round(c.x) - 4 + k, Math.round(c.y) - 16, cr); }
});

// --- market -----------------------------------------------------------------
/**
 * Market stall: 4 posts, a striped cloth canopy topping out at 40px (the
 * benchmark scale marker), a trestle table and goods. `culture` swaps the
 * canopy palette and what is on the table — this is the cheapest way to hit
 * benchmark #20 (2+ legible culture-specific identity objects per screen).
 */
def('market-stall', { collide: 1.4, examine: 'A market stall, its awning bleached by the sun.' }, (s, iso, o) => {
  const w = o.w || 1.5, d = o.d || 1.0;
  const culture = o.culture || 'malay';
  const canopyH = o.canopyH || 40;
  contactShadow(s, iso, o.tx + w / 2, o.ty + d / 2, Math.max(w, d) * 1.25, 0.30);

  // rear posts first, then table, then front posts + canopy (painter's order)
  const posts = [[0.06, 0.06], [w - 0.1, 0.06], [0.06, d - 0.1], [w - 0.1, d - 0.1]];
  posts.slice(0, 2).forEach(([dx, dy], i) =>
    post(s, iso, { tx: o.tx + dx, ty: o.ty + dy, h: canopyH, material: 'timber', w: 3 }));

  // trestle table + goods
  isoBox(s, iso, { tx: o.tx + 0.08, ty: o.ty + 0.12, w: w - 0.2, d: d - 0.35, h: 3, z: 15, material: 'timber', seed: o.seed });
  const gtop = 18;
  const goodsRamp = culture === 'chinese' ? P.RAMPS.terracotta
    : culture === 'spice' ? P.RAMPS.earth
      : culture === 'fish' ? P.RAMPS.water : P.RAMPS.foliage;
  for (let i = 0; i < 9; i++) {
    const gx = o.tx + 0.16 + (i % 3) * ((w - 0.4) / 3);
    const gy = o.ty + 0.18 + Math.floor(i / 3) * ((d - 0.5) / 3);
    const c = iso.toScreen(gx, gy, gtop);
    const rr = 3 + Math.floor(hash2(i, 0, o.seed || 1) * 2);
    s.fillPoly(ellipsePts(c.x, c.y, rr, rr * 0.55, 14), (uu, vv, x, y) => {
      const dx = (x + 0.5 - c.x) / rr;
      return step(goodsRamp, dx < -0.3 ? 4 : dx < 0.3 ? 3 : 2);
    });
  }
  if (culture === 'malay') {
    // bolts of batik standing on end — reads instantly as a cloth stall
    for (let i = 0; i < 3; i++) {
      const c = iso.toScreen(o.tx + 0.22 + i * 0.34, o.ty + d - 0.28, gtop);
      for (let v = 0; v < 13; v++) {
        for (let dx = -2; dx <= 2; dx++) {
          const r = i === 0 ? P.ACCENTS['flag-crimson'] : i === 1 ? P.RAMPS.foliage[2] : P.RAMPS.water[3];
          s.setHex(Math.round(c.x) + dx, Math.round(c.y) - v, (v % 4 === 0) ? P.RAMPS.terracotta[1] : (dx < 0 ? r : P.RAMPS.terracotta[2]));
        }
      }
    }
  }

  posts.slice(2).forEach(([dx, dy]) =>
    post(s, iso, { tx: o.tx + dx, ty: o.ty + dy, h: canopyH, material: 'timber', w: 3 }));

  // canopy: a shallow gable of striped cloth
  const stripe = culture === 'chinese' ? P.RAMPS.terracotta
    : culture === 'fish' ? P.RAMPS.water : P.RAMPS.earth;
  const p = [
    iso.toScreen(o.tx - 0.12, o.ty + d + 0.06, canopyH),
    iso.toScreen(o.tx + w + 0.12, o.ty + d + 0.06, canopyH),
    iso.toScreen(o.tx + w + 0.12, o.ty + d / 2, canopyH + 9),
    iso.toScreen(o.tx - 0.12, o.ty + d / 2, canopyH + 9),
  ];
  s.fillPoly(p, (u, v, x, y) => {
    const band = Math.floor(u / 5) % 2;
    return band ? step(stripe, v < 3 ? 1 : 3) : step(P.RAMPS.whitewash, v < 3 ? 2 : 4);
  }, { o: p[0], eu: { x: p[1].x - p[0].x, y: p[1].y - p[0].y }, ev: { x: p[3].x - p[0].x, y: p[3].y - p[0].y }, uLen: Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y), vLen: 22 });
  // scalloped valance hanging off the front eave + its shadow on the goods
  const a = p[0], b = p[1];
  for (let x = Math.round(a.x); x <= Math.round(b.x); x++) {
    const t = (x - a.x) / Math.max(1, b.x - a.x);
    const yy = Math.round(a.y + (b.y - a.y) * t);
    const scallop = ((x - Math.round(a.x)) % 7 < 4) ? 5 : 3;
    for (let v = 0; v < scallop; v++) {
      s.setHex(x, yy + v, step(((Math.floor((x - a.x) / 6)) % 2) ? stripe : P.RAMPS.whitewash, v === scallop - 1 ? 1 : 3));
    }
    T.shadePixel(s, x, yy + scallop, 0.35);
  }
});

def('signboard-chinese', { collide: 0.35, examine: 'A lacquered guild board, its gilt characters flaking.' }, (s, iso, o) => {
  const c = iso.toScreen(o.tx, o.ty, 0);
  const h = o.h || 44;
  contactShadow(s, iso, o.tx, o.ty, 0.32);
  post(s, iso, { tx: o.tx, ty: o.ty, h, material: 'timber', w: 4 });
  const cr = P.ACCENTS['flag-crimson'];
  const gold = P.ACCENTS['brass-gold'];
  const bx = Math.round(c.x) - 5, by = Math.round(c.y) - h;
  for (let v = 0; v < 30; v++) {
    for (let dx = 0; dx < 12; dx++) {
      const edge = dx === 0 || dx === 11 || v === 0 || v === 29;
      s.setHex(bx + dx, by + v, edge ? gold : (dx < 4 ? cr : P.RAMPS.terracotta[1]));
    }
  }
  // three stacked "characters" as 4x4 gold glyph blocks
  for (let g = 0; g < 3; g++) {
    for (let a2 = 0; a2 < 5; a2++) for (let b2 = 0; b2 < 5; b2++) {
      if (hash2(a2, b2 + g * 7, (o.seed || 1) + 3) > 0.45) s.setHex(bx + 4 + a2, by + 4 + g * 8 + b2, gold);
    }
  }
  // a paper lantern hanging off the bracket
  const lc = { x: bx + 16, y: by + 6 };
  for (let v = 0; v < 11; v++) {
    const rr = 5 - Math.abs(v - 5) * 0.55;
    for (let dx = -Math.round(rr); dx <= Math.round(rr); dx++) {
      s.setHex(lc.x + dx, lc.y + v, dx < -rr * 0.3 ? P.ACCENTS['lantern-flame'] : cr);
    }
  }
  for (let dx = 0; dx < 6; dx++) s.setHex(bx + 11 + dx, by + 4, P.RAMPS.timber[1]);
});

def('cloth-rack', { collide: 0.8, examine: 'Bolts of Gujarati cloth on a bamboo rack.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.4, o.ty + 0.2, 0.9, 0.32);
  post(s, iso, { tx: o.tx, ty: o.ty, h: 34, material: 'timber', w: 3 });
  post(s, iso, { tx: o.tx + 1.0, ty: o.ty - 1.0, h: 34, material: 'timber', w: 3 });
  const ramps = [P.RAMPS.water, P.RAMPS.foliage, P.RAMPS.terracotta];
  for (let i = 0; i < 3; i++) {
    cloth(s, iso, {
      ax: o.tx + 0.12 + i * 0.02, ay: o.ty - i * 0.02,
      bx: o.tx + 0.95, by: o.ty - 0.95, z: 32 - i * 9,
      ramp: ramps[i], h: 9, sag: 2, seed: (o.seed || 1) + i,
    });
  }
});

def('handcart', { collide: 1.0, examine: 'A two-wheeled handcart, shafts resting on the cobbles.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.45, o.ty + 0.3, 1.1, 0.32);
  isoBox(s, iso, { tx: o.tx, ty: o.ty, w: 1.0, d: 0.55, h: 8, z: 7, material: 'timber', seed: o.seed });
  // wheels: dark rims with spokes, one lit one in shade
  [[o.tx + 0.08, o.ty + 0.62], [o.tx + 0.86, o.ty + 0.62]].forEach(([wx, wy], i) => {
    const c = iso.toScreen(wx, wy, 0);
    for (let a = 0; a < 360; a += 6) {
      const rad = a * Math.PI / 180;
      const px = Math.round(c.x + Math.cos(rad) * 8);
      const py = Math.round(c.y - 8 + Math.sin(rad) * 8);
      s.setHex(px, py, step(P.RAMPS.timber, i ? 1 : 3));
      if (a % 45 === 0) {
        for (let t = 0; t < 8; t++) {
          s.setHex(Math.round(c.x + Math.cos(rad) * t), Math.round(c.y - 8 + Math.sin(rad) * t), step(P.RAMPS.timber, i ? 1 : 2));
        }
      }
    }
  });
  // shafts
  for (let k = 0; k < 14; k++) {
    const c = iso.toScreen(o.tx - 0.02 - k * 0.03, o.ty + 0.18 + k * 0.03, 0);
    s.setHex(Math.round(c.x), Math.round(c.y) - 9 + Math.round(k * 0.5), step(P.RAMPS.timber, 3));
  }
});

// --- vegetation -------------------------------------------------------------
def('potted-palm', { collide: 0.5, examine: 'A young coconut palm in a cracked jar.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.55);
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.42, h: 10, material: 'terracotta', seed: o.seed, profile: (t) => 0.75 + 0.3 * t });
  const c = iso.toScreen(o.tx, o.ty, 0);
  const trunkH = o.h || 26;
  for (let v = 0; v < trunkH; v++) {
    const wob = Math.round(Math.sin(v * 0.22) * 1.6);
    s.setHex(Math.round(c.x) + wob - 1, Math.round(c.y) - 10 - v, step(P.RAMPS.timber, 4));
    s.setHex(Math.round(c.x) + wob, Math.round(c.y) - 10 - v, step(P.RAMPS.timber, 2));
    if (v % 4 === 0) s.setHex(Math.round(c.x) + wob, Math.round(c.y) - 10 - v, step(P.RAMPS.timber, 1));
  }
  const tx0 = Math.round(c.x) + Math.round(Math.sin(trunkH * 0.22) * 1.6);
  const ty0 = Math.round(c.y) - 10 - trunkH;
  const fronds = [[-11, 5], [-8, -3], [-3, -7], [3, -7], [8, -3], [11, 5]];
  fronds.forEach(([fx, fy], i) => {
    for (let k = 0; k < 13; k++) {
      const t = k / 13;
      const px = Math.round(tx0 + fx * t);
      const py = Math.round(ty0 + fy * t + (1 - t) * -2 + t * t * 4);
      const lit = fx < 0;
      s.setHex(px, py, step(P.RAMPS.foliage, lit ? 4 : 2));
      s.setHex(px, py + 1, step(P.RAMPS.foliage, lit ? 3 : 1));
      if (k > 3) s.setHex(px, py - 1, step(P.RAMPS.foliage, lit ? 3 : 2));
    }
  });
});

def('banana-clump', { collide: 0.7, examine: 'A clump of pisang, leaves torn by the monsoon.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.8, 0.34);
  const c = iso.toScreen(o.tx, o.ty, 0);
  for (let i = 0; i < 3; i++) {
    const bx = Math.round(c.x) + (i - 1) * 6;
    const hh = 24 + i * 5;
    for (let v = 0; v < hh; v++) {
      s.setHex(bx - 1, Math.round(c.y) - v, step(P.RAMPS.foliage, 3));
      s.setHex(bx, Math.round(c.y) - v, step(P.RAMPS.foliage, 1));
    }
    for (let l = 0; l < 4; l++) {
      const ang = (l / 4) * Math.PI - 0.3;
      for (let k = 0; k < 12; k++) {
        const px = Math.round(bx + Math.cos(ang) * k * 1.2);
        const py = Math.round(c.y - hh + Math.sin(ang) * k * 0.5 - k * 0.4);
        const lit = Math.cos(ang) < 0;
        for (let wdt = -2; wdt <= 2; wdt++) {
          if (Math.abs(wdt) === 2 && (k % 3)) continue;
          s.setHex(px, py + wdt, step(P.RAMPS.foliage, lit ? (wdt < 0 ? 4 : 3) : (wdt < 0 ? 2 : 1)));
        }
      }
    }
  }
});

def('chicken-coop', { collide: 0.7, examine: 'A rattan coop; the birds are asleep in the heat.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.3, o.ty + 0.3, 0.8);
  isoBox(s, iso, { tx: o.tx, ty: o.ty, w: 0.7, d: 0.6, h: 11, material: 'timber', seed: o.seed, plankW: 3 });
  const C = iso.toScreen(o.tx + 0.7, o.ty + 0.6, 0);
  for (let v = 2; v < 10; v += 2) {
    for (let dx = -13; dx < 0; dx++) s.setHex(Math.round(C.x) + dx, Math.round(C.y) - v, step(P.RAMPS.timber, 1));
  }
});

def('laundry-line', { collide: 0, examine: 'Washing strung between the upper storeys.' }, (s, iso, o) => {
  const a = iso.toScreen(o.tx, o.ty, o.z || 60);
  const b = iso.toScreen(o.tx + (o.len || 2), o.ty - (o.len || 2), o.z || 60);
  const x0 = Math.round(Math.min(a.x, b.x)), x1 = Math.round(Math.max(a.x, b.x));
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / Math.max(1, x1 - x0);
    const y = Math.round(a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * 4);
    s.setHex(x, y, step(P.RAMPS.earth, 1));
  }
  const ramps = [P.RAMPS.whitewash, P.RAMPS.water, P.RAMPS.whitewash, P.RAMPS.foliage];
  for (let i = 0; i < 4; i++) {
    const t = 0.16 + i * 0.22;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * 4);
    const wdt = 5 + (i % 2) * 2, hh = 12 + (i % 3) * 4;
    for (let dx = 0; dx < wdt; dx++) {
      for (let v = 1; v < hh; v++) {
        const flap = Math.round(Math.sin(v * 0.4 + i) * 0.9);
        s.setHex(x + dx + flap, y + v, step(ramps[i], dx < wdt * 0.45 ? 4 : (v % 5 === 0 ? 2 : 3)));
      }
    }
  }
});

module.exports = { PROPS, isoBox, isoCyl, post, cloth, contactShadow, ellipsePts };
