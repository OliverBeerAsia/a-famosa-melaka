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
const { PROPS, def } = require('./registry.cjs');
const PRIM = require('./primitives.cjs');

const step = T.step;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// primitives now live in primitives.cjs so every kit can share them without a
// require cycle through this file.
const { ellipsePts, contactShadow, isoBox, isoCyl, post, cloth } = PRIM;

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

/**
 * One hessian sack, standing. THE SILHOUETTE IS THE WHOLE PROP: a sack is a
 * bulging bottom two thirds, a waisted shoulder and a gathered neck tied with
 * cord — the moment you draw it as an ellipsoid it becomes a boulder, which is
 * exactly what the first version of `sack-pile` did.
 */
function sackBody(s, iso, tx, ty, z, h, seed, ramp) {
  const c = iso.toScreen(tx, ty, z);
  const R = P.RAMPS[ramp || 'earth'];
  const wMax = 8;
  for (let v = 0; v < h; v++) {
    const t = v / h;
    // profile: wide belly (t~0.3), waisted shoulder (t~0.82), pinched neck
    let k;
    if (t < 0.72) k = 0.66 + 0.34 * Math.sin(Math.PI * (0.18 + t * 0.82));
    else if (t < 0.88) k = 0.62 - (t - 0.72) * 1.6;
    else k = 0.30;
    const rx = wMax * k, ry = Math.max(1.2, 4 * k);
    s.fillPoly(ellipsePts(c.x, c.y - v, rx, ry, 20), (uu, vv, x, y) => {
      const ddx = (x + 0.5 - c.x) / Math.max(1, rx);
      let idx = ddx < -0.45 ? 4 : ddx < 0.05 ? 3 : ddx < 0.55 ? 2 : 1;
      // slack folds: vertical creases that stay put down the whole sack, so
      // they read as cloth gathers rather than as speckle
      const crease = Math.floor((ddx + 1) * 3.5);
      if (hash2(crease, Math.floor(v / 9), seed) < 0.26) idx -= 1;
      if (v < 2) idx -= 2;                       // sits into its own shadow
      return step(R, clamp(idx, 0, 4));
    });
  }
  // gathered neck + cord tie + the little ears of surplus cloth above it
  const ny = Math.round(c.y) - h;
  for (let dx = -3; dx <= 3; dx++) s.setHex(Math.round(c.x) + dx, ny + 1, step(R, dx < 0 ? 2 : 1));
  for (let dx = -2; dx <= 2; dx++) s.setHex(Math.round(c.x) + dx, ny, step(R, 0));
  s.setHex(Math.round(c.x) - 3, ny - 1, step(R, 3));
  s.setHex(Math.round(c.x) - 2, ny - 2, step(R, 4));
  s.setHex(Math.round(c.x) + 2, ny - 1, step(R, 2));
  return { x: Math.round(c.x), y: ny };
}

def('sack-pile', { collide: 0.75, examine: 'Sacks of pepper, sagging under their own weight.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.3, o.ty + 0.3, 0.9);
  const ramp = o.ramp || 'earth';
  const seed = o.seed || 1;
  // back row first, then a sack lying on its side across the front — the mixed
  // orientation is what stops a stack of sacks reading as a cairn.
  [[0.02, 0.02, 17], [0.40, 0.10, 15], [0.22, 0.40, 16]].forEach(([dx, dy, h], i) => {
    sackBody(s, iso, o.tx + dx, o.ty + dy, 0, h, seed + i * 5, ramp);
  });
  const c = iso.toScreen(o.tx + 0.30, o.ty + 0.26, 15);
  const R = P.RAMPS[ramp];
  for (let dx = -11; dx <= 11; dx++) {
    const t = dx / 11;
    const hh = Math.round(5.5 * Math.sqrt(Math.max(0, 1 - t * t * 0.86)));
    for (let v = -hh; v <= hh; v++) {
      let idx = v < -hh * 0.35 ? 4 : v < hh * 0.3 ? 3 : 2;
      if (hash2(Math.floor(dx / 3), 0, seed + 41) < 0.24) idx -= 1;
      if (Math.abs(dx) > 8) idx -= 1;
      s.setHex(Math.round(c.x) + dx, Math.round(c.y) + v, step(R, clamp(idx, 0, 4)));
    }
  }
  T.aoBand(s, Math.round(c.x), Math.round(c.y) + 7, 2, 0.3);
});

def('spice-sack-row', { collide: 1.1, examine: 'Open sacks of pepper, clove and nutmeg, mouths rolled back for the buyer\'s hand.' }, (s, iso, o) => {
  const seed = o.seed || 1;
  const ramps = ['earth', 'timber', 'terracotta', 'earth'];
  [[0, 0], [0.42, 0.08], [0.10, 0.44], [0.52, 0.50]].forEach(([dx, dy], i) => {
    contactShadow(s, iso, o.tx + dx, o.ty + dy, 0.5, 0.34);
    const h = 12 + (i % 3) * 2;
    const c = iso.toScreen(o.tx + dx, o.ty + dy, 0);
    const R = P.RAMPS[ramps[i]];
    // squat open sack: rolled-down collar and a heaped cone of spice on top
    for (let v = 0; v < h; v++) {
      const k = 0.72 + 0.3 * Math.sin(Math.PI * (0.2 + (v / h) * 0.7));
      s.fillPoly(ellipsePts(c.x, c.y - v, 7 * k, 3.4 * k, 18), (uu, vv, x, y) => {
        const ddx = (x + 0.5 - c.x) / Math.max(1, 7 * k);
        let idx = ddx < -0.45 ? 4 : ddx < 0.05 ? 3 : ddx < 0.55 ? 2 : 1;
        if (hash2(Math.floor((ddx + 1) * 3), Math.floor(v / 7), seed + i) < 0.24) idx -= 1;
        return step(R, clamp(idx, 0, 4));
      });
    }
    const heap = i === 1 ? P.RAMPS.earth : i === 2 ? P.RAMPS.terracotta : P.RAMPS.timber;
    for (let v = 0; v < 5; v++) {
      s.fillPoly(ellipsePts(c.x, c.y - h - v, 6 - v * 1.1, 3 - v * 0.55, 16), (uu, vv, x, y) => {
        const ddx = (x + 0.5 - c.x) / 6;
        return step(heap, ddx < -0.2 ? 4 : ddx < 0.4 ? 3 : 2);
      });
    }
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

/**
 * A spoked cart wheel standing in the vertical plane at a screen point.
 * The debt this replaces drew a 360-step circle one pixel at a time with
 * radial spokes every 45 deg: at r=8 that is a scribbled disc, because the
 * spokes converge into a solid blob within 3px of the hub and the "rim" is a
 * one-pixel aliased ring. A wheel at this size has to be built as a RING with
 * a felloe of real thickness, an iron tyre one step darker, six spokes that
 * STOP short of the hub, and a hub boss — five elements, no scribble.
 */
function cartWheel(s, cx, cy, r, lit, seed) {
  const timber = P.RAMPS.timber;
  const iron = P.RAMPS.stone;
  const ry = r * 0.94;                      // wheels lean a hair into the iso
  const L = lit ? 0 : -2;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const q = (dx * dx) / (r * r) + (dy * dy) / (ry * ry);
      if (q > 1.02) continue;
      const px = Math.round(cx) + dx, py = Math.round(cy) + dy;
      if (q > 0.80) {                        // iron tyre
        s.setHex(px, py, step(iron, clamp((dx < 0 ? 3 : 1) + L, 0, 4)));
        continue;
      }
      if (q > 0.55) {                        // felloe (timber rim)
        s.setHex(px, py, step(timber, clamp((dx < -r * 0.3 ? 4 : dx < r * 0.3 ? 3 : 1) + L, 0, 4)));
        continue;
      }
      if (q < 0.055) {                       // hub boss
        s.setHex(px, py, step(timber, clamp((dx < 0 ? 4 : 2) + L, 0, 4)));
        continue;
      }
      // six spokes, drawn by angle so they never merge into a disc
      const ang = Math.atan2(dy / ry, dx / r);
      const k = Math.abs(((ang / Math.PI * 3 + 6.5) % 1) - 0.5);
      if (k < 0.085) s.setHex(px, py, step(timber, clamp((dx < 0 ? 3 : 1) + L, 0, 4)));
    }
  }
  // the shadow the wheel throws on itself where the cart body overhangs it
  for (let dx = -Math.ceil(r * 0.7); dx <= Math.ceil(r * 0.7); dx++) {
    T.shadePixel(s, Math.round(cx) + dx, Math.round(cy) - Math.round(ry * 0.72), 0.30);
  }
  if (seed !== undefined) { /* seed reserved: wear marks, kept deterministic */ }
}

def('handcart', { collide: 1.0, examine: 'A two-wheeled handcart, shafts resting on the cobbles.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx + 0.45, o.ty + 0.3, 1.15, 0.32);
  // far wheel first, then the body, then the near wheel: the body must occlude
  // the top of the far wheel or the cart reads as a box floating between discs
  const far = iso.toScreen(o.tx + 0.10, o.ty + 0.06, 0);
  cartWheel(s, far.x, far.y - 8, 8, false, o.seed);
  isoBox(s, iso, { tx: o.tx, ty: o.ty, w: 1.0, d: 0.55, h: 9, z: 7, material: 'timber', seed: o.seed });
  const near = iso.toScreen(o.tx + 0.94, o.ty + 0.66, 0);
  cartWheel(s, near.x, near.y - 8, 8, true, o.seed);
  // axle stub + shafts sloping down to the ground
  const ax = iso.toScreen(o.tx + 0.5, o.ty + 0.36, 0);
  for (let dx = -14; dx <= 14; dx++) s.setHex(Math.round(ax.x) + dx, Math.round(ax.y) - 8, step(P.RAMPS.timber, 1));
  for (let k = 0; k < 18; k++) {
    const c = iso.toScreen(o.tx - 0.03 - k * 0.028, o.ty + 0.14 + k * 0.028, 0);
    const y = Math.round(c.y) - 12 + Math.round(k * 0.62);
    s.setHex(Math.round(c.x), y, step(P.RAMPS.timber, 4));
    s.setHex(Math.round(c.x), y + 1, step(P.RAMPS.timber, 2));
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

// ---------------------------------------------------------------------------
// The rest of the kit. These register into the SAME table (registry.cjs), and
// are required here because `compose-plate.cjs` only imports this module — so
// this is where the full prop vocabulary is assembled.
// ---------------------------------------------------------------------------
require('./nature.cjs');
require('./arch-dock.cjs');
require('./arch-malay.cjs');
require('./arch-fortress.cjs');
require('./arch-church.cjs');

module.exports = { PROPS, isoBox, isoCyl, post, cloth, contactShadow, ellipsePts };
