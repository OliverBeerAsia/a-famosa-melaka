#!/usr/bin/env node
'use strict';
/**
 * MELAKA FORGE — INVENTORY ITEM ICONS
 * ===================================
 * The last 27 files on `validate-canon.cjs`'s LEGACY_ALLOWLIST that a player
 * actually looks at up close. `tools/generate-ui-assets.cjs` drew them on the
 * old 184-colour palette, at 16x16 SHIPPED — i.e. one icon pixel per *screen*
 * pixel while the world around them runs three screen pixels to the art pixel.
 * Stretched into a 48px inventory socket, a 16px file is a blur with no grid.
 *
 * THE FOUR RULES (same as ui.cjs — this kit is the same kit)
 *  1. NATIVE FIRST. Authored 16x16, shipped at an exact x3 nearest upscale, so
 *     one art pixel is three screen pixels exactly like every plate and sprite.
 *  2. CANON ONLY. Exact hexes from palette.cjs. Alpha is 0 or 255, never
 *     between: an icon with a soft edge is the one asset the player sees at
 *     rest, and it announces "scaled photograph" louder than anything else.
 *  3. ONE SUN. NW key at ~30 deg. Top and left of every volume is lit, bottom
 *     and right fall away, the specular hit (when a material earns one) is a
 *     single pixel at the upper-left. The old set lit some icons from the
 *     right and some flat, which is why they never read as one drawer of stuff.
 *  4. DETERMINISTIC. hash2 only — same source, same bytes.
 *
 * SELECTIVE OUTLINE
 * -----------------
 * A uniform black keyline round a 16px icon eats a fifth of its area and
 * flattens every form inside it. So the outline is applied by `outline()` from
 * the finished silhouette, and it is NOT one colour: the down-right side of the
 * shape takes the void anchor (the side facing away from the key, where a real
 * object's own shadow is), the up-left side takes the shadow-violet anchor
 * (in light, so lighter). That single asymmetry is what makes a 14px object
 * read as having a top.
 *
 * SILHOUETTE FIRST
 * ----------------
 * At 14 usable pixels there is no room for detail, so each icon is designed as
 * a distinguishable OUTLINE before any colour goes in: a bottle is a neck and
 * shoulders, a key is a bow and a bit, a rosary is a ring with a tail. The
 * eight documents in the set are the hard case — they would all be the same
 * cream rectangle — so each one is separated by a distinct FOLD or FITTING
 * (seal colour, ribbon, roll, tear, tally column), never by its ruling.
 *
 * CLI
 *   node tools/forge/item-icons.cjs           render + install
 *   node tools/forge/item-icons.cjs --check   render to memory, run gates only
 *   node tools/forge/item-icons.cjs --sheet   also write a review contact sheet
 */

const fs = require('fs');
const path = require('path');
const P = require('./palette.cjs');
const { Surface } = require('./surface.cjs');
const { hash2 } = require('./iso.cjs');

const REPO = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO, 'assets', 'sprites', 'ui', 'items');
const REVIEW_DIR = path.join(REPO, 'docs', 'art-bible', 'forge', 'ui');

const N = 16;          // native authoring size
const SCALE = 3;       // shipped x3 -> 48x48

// ---------------------------------------------------------------------------
// MATERIALS
// ---------------------------------------------------------------------------
const W = P.RAMPS.whitewash;   // paper, lime, bone
const TC = P.RAMPS.terracotta; // wax, clay, dyed cloth
const ST = P.RAMPS.stone;      // steel, granite, pewter
const TB = P.RAMPS.timber;     // wood, cord, leather-dark
const FO = P.RAMPS.foliage;    // leaf, herb
const WA = P.RAMPS.water;      // indigo, glass, sea-silk
const EA = P.RAMPS.earth;      // leather, rice, sacking, spice
const SK = P.RAMPS.skin;       // ivory, husk, bone-warm
const CRIMSON = P.ACCENTS['flag-crimson'];
const BRASS = P.ACCENTS['brass-gold'];
const FLAME = P.ACCENTS['lantern-flame'];
const SPEC = P.ACCENTS['sun-specular'];
const VOID = P.ANCHORS['shadow-void'];
const VIOLET = P.ANCHORS['shadow-violet'];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const st = (ramp, i) => ramp[clamp(Math.round(i), 0, ramp.length - 1)];

// ---------------------------------------------------------------------------
// PRIMITIVES
// Everything below takes a Surface and paints INSIDE the 1px outline margin,
// i.e. x,y in [1, 14]. `outline()` claims the margin afterwards.
// ---------------------------------------------------------------------------

function px(s, x, y, hex) { if (hex) s.setHex(Math.round(x), Math.round(y), hex); }

function rect(s, x, y, w, h, hex) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(s, x + i, y + j, hex);
}

/**
 * A lit rectangular face. `ramp` step for the body; the top row and left column
 * step up, the bottom row and right column step down. This is the whole light
 * model for anything box-shaped, and it is applied identically everywhere so
 * the drawer reads as one set of objects under one lamp.
 */
function slab(s, x, y, w, h, ramp, base, opts) {
  const o = opts || {};
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let k = base;
      if (j === 0) k += 1;
      if (i === 0) k += (j === 0 ? 0 : 1);
      if (j === h - 1) k -= 1;
      if (i === w - 1) k -= (j === h - 1 ? 0 : 1);
      if (o.grain && ((i + j * 2) % o.grain === 0)) k -= 1;
      px(s, x + i, y + j, st(ramp, k));
    }
  }
}

/** A lit ellipsoid — bags, seeds, fruit, wax blobs, pommels. */
function blob(s, cx, cy, rx, ry, ramp, base, opts) {
  const o = opts || {};
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const q = dx * dx + dy * dy;
      if (q > 1.02) continue;
      // litness: NW is (-1,-1); the terminator runs SE
      const lit = -(dx + dy) / 1.4142;
      let k = base + (lit > 0.55 ? 2 : lit > 0.05 ? 1 : lit > -0.5 ? 0 : -1);
      if (q > 0.82 && lit < 0) k -= 1;                       // rim falls off
      if (o.speckle && hash2(x, y, o.speckle) < 0.16) k -= 1;
      px(s, x, y, st(ramp, k));
    }
  }
  if (o.spec !== false && rx >= 2 && ry >= 2) {
    px(s, Math.round(cx - rx * 0.42), Math.round(cy - ry * 0.5), o.specHex || st(ramp, base + 3));
  }
}

/** A vertical cylinder — bottles, phials, posts, candles. */
function column(s, x, y, w, h, ramp, base) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const t = w === 1 ? 0.5 : i / (w - 1);
      let k = base + (t < 0.3 ? 1 : t < 0.62 ? 0 : -1);
      if (j === 0) k += 1;
      px(s, x + i, y + j, st(ramp, k));
    }
  }
}

/** A run of pixels between two points (Bresenham, no AA). */
function line(s, x0, y0, x1, y1, hex) {
  let x = Math.round(x0), y = Math.round(y0);
  const X = Math.round(x1), Y = Math.round(y1);
  const dx = Math.abs(X - x), dy = -Math.abs(Y - y);
  const sx = x < X ? 1 : -1, sy = y < Y ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 64; guard++) {
    px(s, x, y, hex);
    if (x === X && y === Y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/**
 * A sheet of paper/parchment seen slightly turned, with a curled corner. Every
 * document in the set starts here and is then separated by its FITTING, never
 * by its ruling — eight sheets of ruled cream are eight identical icons.
 */
function sheet(s, x, y, w, h, ramp, base, opts) {
  const o = opts || {};
  slab(s, x, y, w, h, ramp, base);
  if (o.curl !== false) {
    // dog-eared bottom-right: two steps of shadow reading as a lifted corner
    px(s, x + w - 1, y + h - 1, st(ramp, base - 2));
    px(s, x + w - 2, y + h - 1, st(ramp, base - 1));
    px(s, x + w - 1, y + h - 2, st(ramp, base - 1));
  }
  (o.rules || []).forEach((ry) => {
    for (let i = 1; i < w - 1; i += 1) {
      if (hash2(i, ry, o.seed || 3) < 0.28) continue;
      px(s, x + i, y + ry, st(ramp, base - 2));
    }
  });
}

/** A blob of sealing wax with its own impression. The recurring motif. */
function seal(s, cx, cy, r, hex) {
  blob(s, cx, cy, r, r, [VOID, VIOLET, hex || CRIMSON, hex || CRIMSON, SPEC], 2, { spec: false });
  px(s, cx - 1, cy - 1, SPEC);
  px(s, cx, cy, VOID);
}

/** Twisted cord / drawstring / rosary thread. */
function cord(s, pts, hex, alt) {
  for (let i = 1; i < pts.length; i++) {
    line(s, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], i % 2 ? hex : (alt || hex));
  }
}

/**
 * SELECTIVE OUTLINE. Run last. Every transparent pixel orthogonally touching
 * the silhouette becomes outline; which anchor it takes depends on WHERE it
 * sits relative to the body it hugs — down-right of the form gets the void
 * anchor, up-left gets shadow-violet. See the header.
 */
function outline(s) {
  const src = s.clone();
  const solid = (x, y) => {
    if (x < 0 || y < 0 || x >= s.width || y >= s.height) return false;
    return src.get(x, y).a === 255;
  };
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (solid(x, y)) continue;
      const up = solid(x, y - 1), left = solid(x - 1, y);
      const down = solid(x, y + 1), right = solid(x + 1, y);
      if (!(up || left || down || right)) continue;
      // A pixel with the body BELOW/RIGHT of it lies up-left of the form.
      const upLeft = (down || right) && !(up || left);
      s.setHex(x, y, upLeft ? VIOLET : VOID);
    }
  }
}

// ---------------------------------------------------------------------------
// THE 27 ICONS
// Each entry: id -> draw(surface). Ordered as the inventory lists them.
// ---------------------------------------------------------------------------
const ICONS = {
  // --- trade goods --------------------------------------------------------
  'pepper-pouch': (s) => {
    // open sack, mouth rolled back, black peppercorns heaped above the rim AND
    // spilling down the right side — the spill is what says "loose goods"
    // rather than "jar with a lid", which is what a flat dark cap reads as.
    // The corns are seen DOWN INTO the open mouth, not heaped on top of it: a
    // dark cap sitting on a sack is a lid, and read as one. A dark ellipse
    // inside a rolled rim is an opening, and the few corns spilled on the
    // ground beside it settle the question.
    blob(s, 8, 10, 5.5, 4.5, EA, 2, { speckle: 11 });
    for (let x = 3; x <= 13; x++) px(s, x, 5, st(EA, 3));   // rolled rim, far
    for (let x = 3; x <= 13; x++) px(s, x, 7, st(EA, 4));   // rolled rim, near
    px(s, 3, 6, st(EA, 4)); px(s, 13, 6, st(EA, 1));
    for (let y = 5; y <= 7; y++) {
      for (let x = 4; x <= 12; x++) {
        const dx = (x - 8) / 4.4, dy = (y - 6) / 1.5;
        if (dx * dx + dy * dy > 1) continue;
        px(s, x, y, hash2(x, y, 5) < 0.42 ? VIOLET : VOID);
      }
    }
    px(s, 5, 6, st(ST, 1));                                 // one lit corn
    [[13, 13], [12, 14], [2, 13]].forEach(([x, y]) => { px(s, x, y, VOID); });
  },

  cloves: (s) => {
    // a handful of nail-shaped buds, each a dark stalk with a bud head
    const buds = [[5, 4], [9, 3], [7, 6], [11, 6], [4, 8], [8, 9], [12, 9], [6, 11], [10, 12]];
    buds.forEach(([x, y], i) => {
      const lean = i % 2 ? 1 : -1;
      line(s, x, y, x + lean, y + 3, st(TB, 1));
      px(s, x, y + 1, st(TB, 2));
      px(s, x - 1, y - 1, st(TC, 2));       // the four-lobed head
      px(s, x, y - 1, st(TC, 3));
      px(s, x + 1, y - 1, st(TC, 1));
      px(s, x, y - 2, st(TC, 3));
    });
  },

  nutmeg: (s) => {
    // The nut in its scarlet mace. The mace is drawn as ARCS OF LATITUDE over
    // the nut's own curvature, not as rays from the centre — rays out of a
    // round body read as a splat or a spider, which is what the first pass did.
    blob(s, 8, 9, 5, 4.6, SK, 2, { speckle: 7 });
    // the nut's own seam, and mace clinging over the CROWN only — a full
    // lattice round the equator reads as a hot-cross bun
    for (let y = 6; y <= 12; y++) px(s, 8, y, st(SK, 1));
    for (let x = 4; x <= 12; x++) {
      const t = (x - 8) / 4.6;
      const q = 1 - t * t;
      if (q <= 0) continue;
      const y = Math.round(9 - Math.sqrt(q) * 4.3);
      px(s, x, y, x <= 8 ? CRIMSON : st(TC, 1));
      px(s, x, y + 1, x <= 8 ? st(TC, 2) : st(TC, 1));
    }
    [[5, 8], [7, 6], [10, 6], [12, 9]].forEach(([x, y], i) => {
      line(s, x, y, x + (x < 8 ? -1 : 1), y + 3, i < 2 ? CRIMSON : st(TC, 1));
    });
    px(s, 6, 8, st(SK, 4));
  },

  cloves_unused: null,

  /**
   * The Stage 5 openables put eggs in two chicken coops (dependency D7), and a
   * coop that yields a flag instead of an egg is a coop that is pretending.
   *
   * Two eggs in a nest of straw: the ovoid reads at 16px only if the highlight
   * is a single NW pixel and the shadow side is two ramp steps down, which is
   * the same light model every other icon in this drawer is built to.
   */
  egg: (s) => {
    // nest: a shallow bowl of dry straw
    for (let x = 2; x <= 13; x++) px(s, x, 13, st(EA, hash2(x, 13, 7) < 0.4 ? 2 : 1));
    for (let x = 3; x <= 12; x++) px(s, x, 12, st(EA, hash2(x, 12, 7) < 0.5 ? 3 : 2));
    line(s, 2, 12, 4, 11, st(EA, 2));
    line(s, 13, 12, 11, 11, st(EA, 1));

    // the two eggs, back one first so the front overlaps it
    const egg = (cx, cy, rx, ry) => {
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          // Slightly ovoid: narrower at the top, which is what stops it reading
          // as a ball bearing.
          const squash = 1 + (y < 0 ? 0.22 : 0);
          if ((x * x) / (rx * rx / squash) + (y * y) / (ry * ry) > 1) continue;
          const lit = (-x) + (-y) * 0.7;
          px(s, cx + x, cy + y, st(SK, lit > 2 ? 5 : lit > 0 ? 4 : lit > -2 ? 3 : 2));
        }
      }
      px(s, cx - 1, cy - 2, st(W, 4));   // the one NW specular pixel
    };
    egg(10, 8, 3, 4);
    egg(6, 9, 3, 4);
  },

  'spice-sample': (s) => {
    // a measured heap of turmeric on a folded paper — a SAMPLE, not a sack
    for (let i = 2; i <= 13; i++) px(s, i, 13, st(W, 3));
    for (let i = 3; i <= 12; i++) px(s, i, 12, st(W, 2));
    for (let y = 11; y >= 5; y--) {
      const half = Math.round((11 - y) === 0 ? 5 : 5 - (11 - y) * 0.78);
      for (let x = 8 - half; x <= 8 + half; x++) {
        const lit = (8 - x) + (11 - y) * 0.6;
        let k = 2 + (lit > 1.6 ? 2 : lit > 0 ? 1 : 0);
        if (hash2(x, y, 13) < 0.18) k -= 1;
        px(s, x, y, st(EA, k));
      }
    }
    px(s, 6, 6, FLAME);
  },

  'chinese-silk': (s) => {
    // a bolt: the roll's end-grain spiral on the left, the fall of cloth right
    for (let y = 3; y <= 12; y++) {
      for (let x = 2; x <= 5; x++) {
        px(s, x, y, st(WA, x === 2 ? 3 : x === 3 ? 4 : 2));
      }
    }
    for (let y = 4; y <= 11; y++) px(s, 3, y, st(WA, (y % 3) ? 4 : 2));  // spiral
    for (let y = 4; y <= 11; y++) {
      for (let x = 6; x <= 13; x++) {
        const fold = (x + Math.floor(y / 3)) % 4;
        px(s, x, y, st(WA, fold === 0 ? 4 : fold === 1 ? 3 : fold === 2 ? 2 : 1));
      }
    }
    for (let x = 6; x <= 13; x++) px(s, x, 7, BRASS);   // the gold selvedge band
    px(s, 7, 5, st(WA, 4));
  },

  'kampung-rice': (s) => {
    // a tied sack of padi, belly-heavy, with the neck bound above
    blob(s, 8, 10, 5.5, 4.5, EA, 2, { speckle: 17 });
    rect(s, 6, 4, 5, 3, st(SK, 3));
    px(s, 6, 4, st(SK, 4)); px(s, 10, 6, st(SK, 1));
    for (let x = 5; x <= 11; x++) px(s, x, 7, st(TB, 2));   // the binding
    px(s, 5, 7, st(TB, 3));
    px(s, 6, 8, st(EA, 4));
    px(s, 9, 3, st(SK, 4)); px(s, 8, 2, st(SK, 3));         // a few loose ears
  },

  'medicinal-herbs': (s) => {
    // A bundle laid DIAGONALLY: cut stem-ends at the lower right, the twine
    // across the waist, leaves fanning up and left. Both symmetrical versions
    // failed — leaves fanning up off a bottom stem is a tree, leaves hanging
    // down off a top binding is a figure in a hat. A diagonal has neither
    // silhouette, and it is how a bunch actually lies on a shelf.
    for (let i = 0; i < 4; i++) {
      line(s, 10 + i * 0.6, 11, 12 + i * 0.5, 14, st(TB, i % 2 ? 3 : 2));
    }
    cord(s, [[8, 11], [11, 10], [12, 12], [9, 13]], st(TC, 2), st(TC, 3));
    const sprigs = [[-6, -2], [-6, -5], [-4, -7], [-1, -8], [2, -7]];
    sprigs.forEach(([dx, dy], i) => {
      const ox = 10, oy = 11;
      const ex = ox + dx, ey = oy + dy;
      line(s, ox, oy, ex, ey, st(FO, 1));
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let k = 1; k <= steps; k += 1) {
        const t = k / steps;
        const lx = Math.round(ox + dx * t), ly = Math.round(oy + dy * t);
        px(s, lx - 1, ly, st(FO, 4));
        px(s, lx, ly, st(FO, 3));
        px(s, lx + 1, ly, st(FO, i > 2 ? 2 : 1));
      }
      px(s, ex, ey, st(FO, i < 2 ? 4 : 3));
      px(s, ex, ey - 1, st(FO, 2));
    });
    px(s, 4, 5, st(FO, 4));
  },

  'smuggled-goods': (s) => {
    // a crate with its lid PRISED and a strap cut — contraband, not cargo
    slab(s, 2, 5, 12, 8, TB, 2, { grain: 5 });
    for (let x = 2; x <= 13; x++) px(s, x, 5, st(TB, 4));
    rect(s, 2, 4, 12, 1, st(TB, 3));
    px(s, 13, 4, st(TB, 1));
    for (let y = 6; y <= 12; y++) { px(s, 6, y, st(TB, 1)); px(s, 9, y, st(TB, 1)); }
    // the cut strap, hanging
    for (let x = 2; x <= 13; x++) px(s, x, 9, st(EA, 2));
    px(s, 8, 9, VOID); px(s, 9, 10, st(EA, 1)); px(s, 9, 11, st(EA, 1));
    px(s, 3, 6, st(TB, 4));
  },

  'wrapped-bundle': (s) => {
    // cloth-wrapped and cross-corded, with the knot's ears standing proud
    blob(s, 8, 9, 6, 5, W, 2);
    for (let y = 4; y <= 13; y++) px(s, 8, y, st(TB, 2));
    for (let x = 2; x <= 13; x++) px(s, x, 9, st(TB, 2));
    px(s, 8, 9, st(TB, 3));
    px(s, 6, 7, st(TB, 3)); px(s, 10, 7, st(TB, 1));      // knot ears
    px(s, 7, 6, st(TB, 3)); px(s, 9, 6, st(TB, 1));
    px(s, 5, 6, st(W, 4));
  },

  'tin-ingots-unused': null,

  // --- money --------------------------------------------------------------
  'coin-pouch': (s) => {
    // leather purse, drawn shut, one cruzado escaping at the mouth
    blob(s, 8, 10, 5.5, 4.5, TB, 2);
    for (let x = 5; x <= 11; x++) px(s, x, 6, st(TB, 3));
    px(s, 5, 6, st(TB, 4)); px(s, 11, 6, st(TB, 1));
    for (let x = 6; x <= 10; x++) px(s, x, 5, st(EA, 2));   // gathered neck
    px(s, 6, 5, st(EA, 3));
    blob(s, 10, 4, 2.4, 2.4, [VOID, st(EA, 1), BRASS, FLAME, SPEC], 2, { spec: false });
    px(s, 9, 3, SPEC);
    px(s, 6, 8, st(TB, 4));
  },

  'job-payment': (s) => {
    // A counted stack of coin, edge-on, with the top coin seen as a full disc.
    // A straight-sided stack of bars is a ladder (and read as one against the
    // ruled documents); rounding every tier's ends is what makes it money.
    for (let i = 0; i < 4; i++) {
      const y = 13 - i * 2;
      for (let x = 4; x <= 12; x++) {
        const edge = x === 4 || x === 12;
        px(s, x, y, edge ? st(EA, 1) : x < 7 ? FLAME : x > 10 ? st(EA, 1) : BRASS);
        if (!edge) px(s, x, y + 1, st(EA, 1));
      }
    }
    // top coin, face up
    blob(s, 8, 5, 4.4, 2.4, [VOID, st(EA, 1), BRASS, FLAME, SPEC], 2, { spec: false });
    px(s, 6, 4, SPEC);
    for (let x = 7; x <= 9; x++) px(s, x, 5, st(EA, 1));     // the struck cross
    px(s, 8, 4, st(EA, 1)); px(s, 8, 6, st(EA, 1));
  },

  'delivery-payment': (s) => {
    // A SEALED pay-purse: cloth over coin, wrung into a narrow neck, corded
    // twice and sealed across the knot so it cannot be opened unseen. The neck
    // is the read — without it the body is a bowl, which is what it was.
    blob(s, 8, 11, 5.5, 3.6, W, 2);
    for (let y = 6; y <= 8; y++) {
      const half = y === 6 ? 2 : 1;
      for (let x = 8 - half; x <= 8 + half; x++) px(s, x, y, st(W, x < 8 ? 4 : x === 8 ? 3 : 2));
    }
    for (let x = 5; x <= 11; x++) px(s, x, 9, st(TB, 2));
    px(s, 5, 9, st(TB, 3)); px(s, 11, 9, st(TB, 1));
    px(s, 4, 10, st(TB, 2)); px(s, 3, 11, st(TB, 1));       // the loose end
    for (let x = 6; x <= 10; x++) px(s, x, 5, st(W, 3));    // the gathered ears
    px(s, 6, 5, st(W, 4));
    seal(s, 9, 12, 2, CRIMSON);
    px(s, 6, 10, st(W, 4));
  },

  'informant-reward': (s) => {
    // coin pushed across a table under a folded scrap — a payment, in secret
    sheet(s, 2, 4, 9, 7, W, 3, { rules: [2, 4], seed: 9 });
    px(s, 2, 4, st(W, 4));
    for (let i = 0; i < 3; i++) {
      blob(s, 10 + i, 12 - i, 2.2, 2.2, [VOID, st(EA, 1), BRASS, FLAME, SPEC], 2, { spec: false });
    }
    px(s, 11, 9, SPEC);
  },

  // --- documents ----------------------------------------------------------
  letter: (s) => {
    // a folded letter, address side up, crimson wax dead centre
    sheet(s, 2, 3, 12, 10, W, 3, { rules: [3, 5, 7], seed: 21 });
    for (let x = 2; x <= 13; x++) px(s, x, 8, st(W, 2));   // the fold
    seal(s, 8, 8, 2, CRIMSON);
    px(s, 3, 4, st(W, 4));
  },

  'letter-of-credit': (s) => {
    // a banker's bill: ruled body, a blue-wax seal, and a torn counterfoil
    // down the left — the indenture edge that proves it is the true half
    sheet(s, 4, 2, 10, 12, W, 3, { rules: [3, 5, 7, 9], seed: 33 });
    for (let y = 2; y <= 13; y++) px(s, 3, y, st(W, (y % 2) ? 2 : 4));   // tear
    seal(s, 10, 11, 2, st(WA, 2));
    for (let x = 5; x <= 11; x++) px(s, x, 4, st(WA, 2));   // the sum, in ink
    px(s, 5, 3, st(W, 4));
  },

  'letter-of-commendation': (s) => {
    // a rolled patent: the roll's end left, the open face right, brass ferrule
    for (let y = 2; y <= 13; y++) {
      px(s, 2, y, st(W, 2)); px(s, 3, y, st(W, 4)); px(s, 4, y, st(W, 3));
    }
    sheet(s, 5, 3, 9, 10, W, 3, { rules: [2, 4, 6], seed: 45, curl: false });
    for (let y = 3; y <= 12; y++) px(s, 5, y, st(W, 4));
    px(s, 2, 2, BRASS); px(s, 3, 2, FLAME); px(s, 4, 2, BRASS);
    px(s, 2, 13, BRASS); px(s, 3, 13, BRASS); px(s, 4, 13, st(EA, 1));
    seal(s, 11, 11, 2, CRIMSON);
  },

  'cargo-manifest': (s) => {
    // A TALLY BOARD, not a sheet: a hardwood board with the manifest clipped
    // to it under a brass bar. Eight documents cannot be told apart by their
    // ruling at 14px, so each one is separated by its FITTING — this one owns
    // the only rectangle in the set with a dark timber frame around it.
    slab(s, 2, 2, 12, 12, TB, 2, { grain: 6 });
    slab(s, 4, 4, 8, 9, W, 3);
    for (let x = 3; x <= 12; x++) px(s, x, 3, BRASS);       // the clip bar
    px(s, 3, 3, FLAME); px(s, 12, 3, st(EA, 1));
    px(s, 7, 2, BRASS); px(s, 8, 2, st(EA, 1));
    for (let y = 6; y <= 11; y += 2) {
      for (let x = 5; x <= 8; x++) px(s, x, y, st(TB, 2));
      for (let x = 10; x <= 11; x++) px(s, x, y, st(TB, 1));
    }
    px(s, 9, 5, st(TB, 2)); px(s, 9, 7, st(TB, 2)); px(s, 9, 9, st(TB, 2));
    px(s, 4, 4, st(W, 4));
  },

  'convert-list': (s) => {
    // A BOUND REGISTER: the mission's roll of names, closed, its spine to the
    // left and the cross of the Order tooled on the cover. A book silhouette
    // (spine + fore-edge leaves) can never be confused with a loose sheet.
    slab(s, 4, 2, 10, 12, TC, 2, { grain: 7 });
    for (let y = 2; y <= 13; y++) {                          // the spine
      px(s, 2, y, st(TC, 1)); px(s, 3, y, st(TC, 3));
    }
    px(s, 2, 2, st(TC, 2)); px(s, 3, 2, st(TC, 4));
    for (let y = 3; y <= 12; y++) {                          // fore-edge leaves
      px(s, 13, y, st(W, (y % 2) ? 3 : 2));
    }
    for (let y = 5; y <= 11; y++) px(s, 8, y, BRASS);        // the cross, tooled
    for (let x = 6; x <= 10; x++) px(s, x, 7, BRASS);
    px(s, 8, 5, FLAME); px(s, 6, 7, FLAME);
    px(s, 5, 3, st(TC, 4));
    px(s, 11, 12, BRASS); px(s, 11, 13, st(EA, 1));          // the clasp
  },

  'bribe-note': (s) => {
    // A SCRAP, and deliberately the only document that does not fill its frame:
    // torn from something larger, folded to the palm, creased twice, no seal —
    // nobody signs a bribe. Its small size IS the read.
    slab(s, 4, 6, 9, 7, W, 3);
    for (let x = 4; x <= 12; x++) px(s, x, 6, st(W, hash2(x, 1, 7) < 0.5 ? 4 : 2));
    for (let x = 4; x <= 12; x++) if (hash2(x, 2, 7) < 0.45) px(s, x, 5, st(W, 4));
    for (let y = 6; y <= 12; y++) px(s, 8, y, st(W, 2));     // the vertical crease
    for (let x = 4; x <= 12; x++) px(s, x, 10, st(W, 2));    // the horizontal one
    px(s, 9, 10, st(W, 4)); px(s, 7, 10, st(W, 4));
    for (let x = 5; x <= 7; x++) px(s, x, 8, st(TB, 2));     // three hurried words
    for (let x = 10; x <= 12; x++) px(s, x, 8, st(TB, 1));
    px(s, 11, 12, VIOLET); px(s, 12, 11, VIOLET);            // a dirty thumb
  },

  'trading-seal': (s) => {
    // THE QUEST OBJECT. A matrix seal: brass handle above, the engraved die
    // below, its device cut into the face. It must not read as a wax blob.
    column(s, 7, 2, 3, 4, [VOID, st(EA, 1), BRASS, FLAME, SPEC], 2);
    px(s, 7, 2, SPEC);
    rect(s, 6, 6, 5, 1, BRASS);
    px(s, 6, 6, FLAME); px(s, 10, 6, st(EA, 1));
    slab(s, 3, 7, 11, 6, [VOID, st(EA, 1), BRASS, FLAME, SPEC], 2);
    // the device: a cross of the Order struck into the die
    for (let y = 8; y <= 12; y++) px(s, 8, y, st(EA, 0));
    for (let x = 5; x <= 11; x++) px(s, x, 10, st(EA, 0));
    px(s, 5, 8, SPEC);
  },

  'key-warehouse': (s) => {
    // a warded key: ring bow left, long shank, two bits down-right
    // The bow is a true ANNULUS — a ring of plotted points leaves a lumpy
    // sausage at 6px across, and the hole is the whole reason a key reads.
    for (let y = 1; y <= 9; y++) {
      for (let x = 1; x <= 9; x++) {
        const dx = (x - 5) / 3.4, dy = (y - 5) / 3.4;
        const q = dx * dx + dy * dy;
        if (q > 1.02 || q < 0.30) continue;
        px(s, x, y, st(ST, (dx + dy) < -0.4 ? 4 : (dx + dy) < 0.4 ? 3 : 1));
      }
    }
    line(s, 6, 8, 12, 13, st(ST, 3));
    line(s, 7, 8, 13, 13, st(ST, 1));
    px(s, 11, 14, st(ST, 3)); px(s, 12, 14, st(ST, 2));     // the bits
    px(s, 9, 13, st(ST, 3)); px(s, 9, 14, st(ST, 2));
    px(s, 3, 3, st(ST, 4));
  },

  // --- devotional ---------------------------------------------------------
  rosary: (s) => {
    // a loop of decade beads with the crucifix hanging from the join
    const beads = [];
    for (let a = 0; a < 12; a++) {
      const t = (a / 12) * Math.PI * 2 - Math.PI / 2;
      beads.push([8 + Math.cos(t) * 4.4, 6 + Math.sin(t) * 4.2]);
    }
    beads.forEach(([x, y], i) => {
      px(s, x, y, st(TB, i % 5 === 0 ? 4 : 2));
      px(s, x - 0.5, y - 0.5, st(TB, i % 5 === 0 ? 4 : 3));
    });
    for (let y = 11; y <= 14; y++) px(s, 8, y, st(TB, 2));
    for (let y = 12; y <= 14; y++) px(s, 8, y, st(TC, 1));
    for (let x = 7; x <= 9; x++) px(s, x, 13, st(TC, 1));
    px(s, 5, 3, st(TB, 4));
  },

  'rosary-blessed': (s) => {
    // the same beads in bone, strung on brass, the crucifix catching the light
    const beads = [];
    for (let a = 0; a < 12; a++) {
      const t = (a / 12) * Math.PI * 2 - Math.PI / 2;
      beads.push([8 + Math.cos(t) * 4.4, 6 + Math.sin(t) * 4.2]);
    }
    beads.forEach(([x, y], i) => {
      px(s, x, y, i % 5 === 0 ? BRASS : st(W, 3));
      px(s, x - 0.5, y - 0.5, i % 5 === 0 ? FLAME : st(W, 4));
    });
    for (let y = 11; y <= 14; y++) px(s, 8, y, BRASS);
    for (let x = 7; x <= 9; x++) px(s, x, 13, BRASS);
    px(s, 8, 12, FLAME); px(s, 8, 14, FLAME);
    px(s, 7, 12, SPEC);
  },

  'arabic-incense': (s) => {
    // a footed brass censer with three ribbons of smoke standing off it
    for (let x = 5; x <= 10; x++) px(s, x, 13, st(EA, 1));
    px(s, 6, 12, st(EA, 2)); px(s, 9, 12, st(EA, 1));
    blob(s, 8, 10, 4.2, 3, [VOID, st(EA, 1), BRASS, FLAME, SPEC], 2, { spec: false });
    for (let x = 4; x <= 11; x++) px(s, x, 8, BRASS);
    px(s, 4, 8, FLAME); px(s, 11, 8, st(EA, 1));
    for (let x = 6; x <= 10; x++) px(s, x, 7, st(TC, 2));  // the coal glow
    px(s, 8, 7, FLAME);
    // ONE ribbon of smoke, not three. Three parallel wobbling columns over a
    // bowl read as a claw; a single rising S-curve reads as smoke.
    for (let y = 6; y >= 1; y--) {
      const wob = Math.round(Math.sin((6 - y) * 0.62) * 1.3);
      px(s, 8 + wob, y, st(ST, y < 3 ? 1 : 2));
      if (y < 3) px(s, 8 + wob + 1, y, st(ST, 1));
    }
    px(s, 6, 9, FLAME);
  },

  'malay-charm': (s) => {
    // a tangkal: a folded verse in a bound leather sleeve, worn on a cord.
    // The cord CLOSES into a loop — two open ends running off to the corners
    // read as horns on the sleeve rather than as something you wear.
    cord(s, [[8, 4], [5, 2], [8, 1], [11, 2], [8, 4]], st(TB, 2), st(TB, 3));
    slab(s, 5, 5, 7, 8, TB, 2, { grain: 4 });
    rect(s, 6, 6, 5, 6, st(FO, 2));
    px(s, 6, 6, st(FO, 3));
    for (let y = 7; y <= 10; y += 2) for (let x = 7; x <= 9; x++) px(s, x, y, st(EA, 3));
    px(s, 8, 13, BRASS); px(s, 7, 13, st(EA, 1)); px(s, 9, 13, st(EA, 1));
    px(s, 5, 5, st(TB, 4));
  },

  'arab-amulet': (s) => {
    // a silver plate on a closed cord, its stone set at the centre
    cord(s, [[8, 4], [5, 2], [8, 1], [11, 2], [8, 4]], st(ST, 2), st(ST, 3));
    slab(s, 5, 5, 7, 8, ST, 2);
    for (let y = 6; y <= 11; y++) { px(s, 5, y, st(ST, 4)); px(s, 11, y, st(ST, 1)); }
    px(s, 5, 3, st(ST, 4)); px(s, 11, 3, st(ST, 2));
    blob(s, 8, 8, 2, 2, WA, 2, { spec: false });
    px(s, 7, 7, st(WA, 4));
    for (let x = 6; x <= 10; x++) px(s, x, 11, st(ST, 1));  // the inscription
    px(s, 8, 13, st(ST, 3));
  },

  // --- drink --------------------------------------------------------------
  'portuguese-wine': (s) => {
    // a shouldered bottle, corded neck, wax over the cork, dark glass
    column(s, 7, 2, 3, 3, TC, 1);
    px(s, 7, 2, st(TC, 3));
    for (let x = 6; x <= 10; x++) px(s, x, 5, st(TB, 2));
    // shoulders
    px(s, 6, 6, st(WA, 2)); px(s, 10, 6, st(WA, 0));
    for (let y = 6; y <= 13; y++) {
      const w = y === 6 ? 5 : 7;
      const x0 = 8 - Math.floor(w / 2);
      for (let i = 0; i < w; i++) {
        const t = i / (w - 1);
        px(s, x0 + i, y, st(WA, t < 0.22 ? 3 : t < 0.5 ? 2 : t < 0.8 ? 1 : 0));
      }
    }
    for (let y = 8; y <= 12; y++) px(s, 6, y, st(WA, 4));   // the highlight run
    rect(s, 6, 9, 5, 3, st(W, 3));                          // the label
    px(s, 6, 9, st(W, 4));
    for (let x = 7; x <= 9; x++) px(s, x, 10, CRIMSON);
    px(s, 7, 3, st(TC, 4));
  },
};

delete ICONS.cloves_unused;
delete ICONS['tin-ingots-unused'];

// ---------------------------------------------------------------------------
function build() {
  const wanted = fs.existsSync(OUT_DIR)
    ? fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')).sort()
    : Object.keys(ICONS).sort();
  return wanted.map((id) => {
    const draw = ICONS[id];
    if (!draw) throw new Error(`no icon recipe for "${id}" — the inventory expects it`);
    const s = new Surface(N, N);
    draw(s);
    outline(s);
    return { id, name: `${id}.png`, surface: s };
  });
}

// ---------------------------------------------------------------------------
// GATES — the same three validate-canon.cjs applies, run here so the tool
// cannot install a file that would fail CI.
// ---------------------------------------------------------------------------
function gate(pieces) {
  const problems = [];
  const canon = new Set(P.CANON.map((c) => `${c.r},${c.g},${c.b}`));
  pieces.forEach((p) => {
    const d = p.surface.data;
    const used = new Set();
    let partial = 0, opaque = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a !== 0 && a !== 255) partial++;
      if (a === 0) continue;
      opaque++;
      used.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    }
    used.forEach((k) => { if (!canon.has(k)) problems.push(`${p.name}: off-canon rgb(${k})`); });
    if (partial) problems.push(`${p.name}: ${partial} partial-alpha pixel(s) — pixel art has no soft edges`);
    // Coverage: an icon that fills its frame has no silhouette left, and one
    // that barely marks it is invisible in a 48px socket.
    const cover = opaque / (N * N);
    if (cover < 0.18) problems.push(`${p.name}: only ${(cover * 100).toFixed(0)}% coverage — too small to read`);
    if (cover > 0.86) problems.push(`${p.name}: ${(cover * 100).toFixed(0)}% coverage — no silhouette left`);
    if (used.size > 16) problems.push(`${p.name}: ${used.size} colours — a 16px icon must stay under 16`);
    p.colours = used.size;
    p.cover = cover;
  });
  return problems;
}

function contactSheet(pieces, outPath) {
  const { createCanvas } = require('canvas');
  const COLS = 7, CELL = 132, PAD = 10, HEAD = 76, K = 7;
  const rows = Math.ceil(pieces.length / COLS);
  const cv = createCanvas(COLS * CELL, HEAD + rows * (CELL + 30));
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#14141C';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#F0E4C8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('MELAKA FORGE — INVENTORY ITEM ICONS', 18, 36);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#9AA8C0';
  ctx.fillText(`${pieces.length} icons · 16x16 native, canon only, NW key, selective outline · shipped x3`, 18, 58);

  pieces.forEach((p, i) => {
    const cx = (i % COLS) * CELL, cy = HEAD + Math.floor(i / COLS) * (CELL + 30);
    ctx.fillStyle = '#24242E';
    ctx.fillRect(cx + PAD - 2, cy + PAD - 2, N * K + 4, N * K + 4);
    ctx.drawImage(p.surface.scaleNearest(K).toCanvas(), cx + PAD, cy + PAD);
    ctx.fillStyle = '#F0E4C8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(p.id, cx + PAD, cy + N * K + PAD + 14);
    ctx.fillStyle = '#8892A8';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${p.colours} col · ${(p.cover * 100).toFixed(0)}% cover`, cx + PAD, cy + N * K + PAD + 27);
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, cv.toBuffer('image/png'));
  return outPath;
}

function write(pieces, dir) {
  fs.mkdirSync(dir, { recursive: true });
  return pieces.map((p) => {
    const file = path.join(dir, p.name);
    p.surface.scaleNearest(SCALE).writePNG(file);
    return file;
  });
}

module.exports = { build, gate, write, ICONS, OUT_DIR, N, SCALE };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const pieces = build();
  const problems = gate(pieces);

  console.log(`Forge item icons — ${pieces.length} icon(s), ${N}x${N} native, shipped x${SCALE}`);
  pieces.forEach((p) => {
    console.log(`  ${p.id.padEnd(26)} ${String(p.colours).padStart(2)} col  ` +
      `${String((p.cover * 100).toFixed(0)).padStart(3)}% cover`);
  });

  if (problems.length) {
    console.error('\nFAILED GATES:');
    problems.forEach((p) => console.error('  ! ' + p));
    process.exit(1);
  }

  if (!argv.includes('--check')) {
    write(pieces, OUT_DIR);
    console.log(`\ninstalled ${pieces.length} file(s) into ${path.relative(REPO, OUT_DIR)} at ${N * SCALE}x${N * SCALE}`);
  }
  if (argv.includes('--sheet')) {
    console.log('review sheet: ' + path.relative(REPO, contactSheet(pieces, path.join(REVIEW_DIR, 'item-icons.png'))));
  }
  console.log('all item-icon gates pass');
}
