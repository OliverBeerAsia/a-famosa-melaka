#!/usr/bin/env node
'use strict';
/**
 * MELAKA FORGE — UI CHROME KIT
 * ============================
 * Replaces the hand-rolled `tools/generate-ui-assets.cjs` chrome (olive
 * gradient boxes authored in CSS-pixel units, i.e. at 1/3 of the world's pixel
 * density) with a NATIVE-RESOLUTION pixel-art kit that shares the world's grid.
 *
 * THE LAW THIS FILE ENFORCES
 * --------------------------
 *  1. NATIVE FIRST. Every piece is authored at native resolution — the same
 *     grid as the 320x180 plates and the 16x32 sprites — then shipped at an
 *     EXACT x3 nearest-neighbour upscale. One native pixel == three screen
 *     pixels == the smallest legal feature. No CSS hairlines anywhere.
 *  2. CANON ONLY. Every colour is an exact hex from tools/forge/palette.cjs.
 *     No mixing, no alpha blending, no gradients: alpha is 0 or 255, full stop.
 *  3. ONE SUN. NW key light at ~30 deg, per palette.cjs SUN. Top and left faces
 *     are lit, bottom and right faces are shaded, on every single piece — rails,
 *     bevels, brass plates, rivet domes, the coin, the wax seal.
 *  4. DETERMINISTIC. hash2() only. No Math.random, no Date.now. Same source ->
 *     same bytes, so the canon gate can byte-compare.
 *
 * THE MATERIAL STORY
 * ------------------
 *   parchment  aged rag paper, warm cream, clustered stains (NOT per-pixel
 *              noise) — the reading surface. earth/whitewash ramps.
 *   hardwood   dark tropical hardwood rails — chengal/merbau colour. Grain is
 *              a few sparse dark strokes on an 8px lattice, never a texture
 *              field. timber ramp.
 *   brass      tarnished brass corner plates, beads and rivets. Bright face is
 *              the brass-gold accent, tarnish walks down the earth ramp, the
 *              specular hit is a single native pixel of sun-specular.
 *   wax        Portuguese crimson seal, the recurring motif.
 *
 * 9-SLICE CONTRACT
 * ----------------
 * Panels/buttons are emitted as 9-slice sources: a `border` ring of native
 * pixels around a tileable middle. CSS consumes them with
 *   border: <border*3>px solid transparent;
 *   border-image: url(...) <border*3> fill repeat;
 * so corners land 1:1 (no scaling) and edges/middle tile. The middle field is
 * generated as a TORUS (every shader is a pure function of x mod M, y mod M)
 * so tiling is seamless — no visible seam grid on a big journal panel.
 *
 * CLI
 *   node tools/forge/ui.cjs             render + install into assets/sprites/ui
 *   node tools/forge/ui.cjs --check     render to a temp dir and run the gates
 *   node tools/forge/ui.cjs --sheet     also write a review contact sheet
 */

const fs = require('fs');
const path = require('path');
const P = require('./palette.cjs');
const { Surface } = require('./surface.cjs');
const { hash2 } = require('./iso.cjs');

const REPO = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO, 'assets', 'sprites', 'ui');
const REVIEW_DIR = path.join(REPO, 'docs', 'art-bible', 'forge', 'ui');

/** Shipped scale. Matches CHARACTER_SCALE and the plate upscale. */
const SCALE = 3;

// ---------------------------------------------------------------------------
// MATERIALS — every entry is an exact canon hex
// ---------------------------------------------------------------------------
const T = P.RAMPS.timber;      // #24101C #44201C #704828 #9C7C4C #C8B07C
const E = P.RAMPS.earth;       // #301C20 #643C24 #987438 #C8A860 #F0D498
const W = P.RAMPS.whitewash;   // #302C38 #6C6464 #ACA08C #DCD0B8 #FCECCC
const TC = P.RAMPS.terracotta; // #2C1020 #581814 #844020 #B47844 #DCB47C

const INK = T[0];              // the only outline colour in the kit

const WOOD = {
  out: T[0],
  body: T[1],   // shaded face of a hardwood rail
  lit: T[2],    // sunlit face
  hi: T[3],     // the 1px bevel catching the NW key
  grain: T[0],
};

const PARCH = {
  base: E[4],   // #F0D498 warm rag paper
  warm: E[3],   // #C8A860 age patch
  stain: E[2],  // #987438 deep stain / frame's inner shadow
  sheen: W[4],  // #FCECCC
};

/** Tarnished brass, dark -> bright -> specular. */
const BRASS = [E[0], E[1], E[2], E[3], P.ACCENTS['brass-gold'], P.ACCENTS['sun-specular']];
const [b0, b1, b2, b3, b4, b5] = BRASS;

const WAX = {
  out: TC[0],
  deep: TC[1],
  body: P.ACCENTS['flag-crimson'],
  lit: TC[2],
  rim: TC[3],
};

// ---------------------------------------------------------------------------
// SHARED GEOMETRY
// ---------------------------------------------------------------------------

/**
 * Sparse hardwood grain. Strokes run ALONG the rail and are confined to an
 * 8px lattice cell so a 9-slice edge tile repeats without clipping a stroke.
 */
const GRAIN_CELL = 8;
function grainHit(along, across, seed) {
  const c = Math.floor(along / GRAIN_CELL);
  if (hash2(c, across, seed) > 0.34) return false;
  const len = 2 + Math.floor(hash2(c, across + 61, seed) * 3);       // 2..4 px
  const start = Math.floor(hash2(c, across + 131, seed) * (GRAIN_CELL - len));
  const o = along - c * GRAIN_CELL;
  return o >= start && o < start + len;
}

/**
 * Aged parchment as a TORUS shader over an M x M tile.
 * Stains are clustered blobs with a chunky wobbled edge (art-critic rule: no
 * per-pixel noise), plus a sparse 2x2 fleck lattice for paper tooth.
 */
function parchmentField(M, seed) {
  const blobs = [];
  const n = Math.max(2, Math.round((M * M) / 2600));
  for (let i = 0; i < n; i++) {
    blobs.push({
      cx: hash2(i, 3, seed) * M,
      cy: hash2(i, 7, seed) * M,
      r: 5 + hash2(i, 11, seed) * (M > 24 ? 7 : 2),
      core: hash2(i, 17, seed) < 0.34,   // a few stains have a darker heart
    });
  }
  return (u, v) => {
    const x = ((u % M) + M) % M;
    const y = ((v % M) + M) % M;
    let col = PARCH.base;
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      let dx = Math.abs(x - b.cx); if (dx > M / 2) dx = M - dx;
      let dy = Math.abs(y - b.cy); if (dy > M / 2) dy = M - dy;
      // wobble on a 3px lattice: the stain edge is chunky, not a vector circle
      const wob = b.r * (0.80 + 0.40 * hash2(Math.floor(x / 3), Math.floor(y / 3), seed + i * 13));
      const d2 = dx * dx + dy * dy;
      if (d2 < wob * wob) {
        col = PARCH.warm;
        if (b.core && d2 < (wob * 0.42) * (wob * 0.42)) col = PARCH.stain;
      }
    }
    // paper tooth: 2x2 flecks on a 4px lattice, sparse — one step, never darker
    if (col === PARCH.base && (x & 3) < 2 && (y & 3) < 2
        && hash2(Math.floor(x / 4), Math.floor(y / 4), seed + 977) < 0.05) {
      col = PARCH.warm;
    }
    return col;
  };
}

/**
 * The frame ring shared by every panel, button and plaque.
 *
 * `d` is the chebyshev-ish distance to the nearest edge, so the four rails
 * mitre at 45 deg automatically. `lit` is true when the nearest edge is the top
 * or the left one — that is the whole lighting model, and it is the same model
 * the plates and sprites use.
 *
 * profile(d, lit, along, seed) -> hex
 */
function drawRing(s, border, profile, seed) {
  const { width: w, height: h } = s;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dl = x, dt = y, dr = w - 1 - x, db = h - 1 - y;
      const d = Math.min(dl, dt, dr, db);
      if (d >= border) continue;
      // nearest edge wins; ties resolve to the lit side (top/left) so the
      // mitre diagonal reads as a raised frame under a NW key.
      const lit = (dt === d) || (dl === d);
      const along = (dt === d || db === d) ? x : y;
      const c = profile(d, lit, along, seed);
      if (c) s.setHex(x, y, c);
    }
  }
}

/**
 * Standard panel rail profile for a 6px border. Read from the outside in:
 *
 *   d0  ink outline
 *   d1  bevel — the lit lip catching the NW key (dark side gets ink instead)
 *   d2  rail crown
 *   d3  rail falling away from the light  <- the two rows that make it TIMBER
 *   d4  brass bead inlay
 *   d5  the frame's shadow cast onto the recessed field
 *
 * Rows d2/d3 carry the grain, so grain reads as a rail feature and never as a
 * texture field.
 */
function railProfile(border, opts) {
  const o = opts || {};
  const bead = o.bead === undefined ? true : o.bead;
  const inner = o.inner || { lit: PARCH.stain, dark: PARCH.warm };
  return (d, lit, along, seed) => {
    if (d === 0) return INK;
    if (border >= 5 && d === 1) return lit ? WOOD.hi : INK;
    if (bead && d === border - 2) return lit ? b4 : b1;
    if (d === border - 1) return lit ? inner.lit : inner.dark;
    // rail body: crown then fall-off, so a 6px border still reads as a
    // rounded piece of timber and not a flat tan band.
    const crown = d === 2;
    const base = lit
      ? (crown ? WOOD.lit : WOOD.body)
      : (crown ? WOOD.body : INK);
    return grainHit(along, d, seed) ? WOOD.grain : base;
  };
}

// --- brass corner pieces (6x6) ---------------------------------------------
// A tarnished brass plate with a 3x3 rivet dome. NW-lit; the SAME art is
// stamped at all four corners (the sun does not rotate with the corner).
const PLATE6 = [
  [INK, INK, INK, INK, INK, INK],
  [INK, b3, b3, b3, b3, b1],
  [INK, b3, b5, b4, b2, b1],
  [INK, b3, b4, b4, b1, b1],
  [INK, b3, b2, b1, b1, b1],
  [INK, b1, b1, b1, b1, b0],
];

// A plain L-bracket for secondary panels: brass without the rivet, so the
// dialogue box stays the hero.
const BRACKET6 = [
  [INK, INK, INK, INK, INK, INK],
  [INK, b4, b4, b4, b4, b4],
  [INK, b4, b2, b1, b1, b1],
  [INK, b4, b1, null, null, null],
  [INK, b4, b1, null, null, null],
  [INK, b4, b1, null, null, null],
];

function stampCorners(s, art) {
  const n = art.length;
  const { width: w, height: h } = s;
  const spots = [[0, 0], [w - n, 0], [0, h - n], [w - n, h - n]];
  for (const [ox, oy] of spots) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = art[y][x];
        if (c) s.setHex(ox + x, oy + y, c);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// PIECES
// ---------------------------------------------------------------------------

/**
 * 9-slice panel: hardwood rails + brass + aged parchment field.
 * @returns {{surface: Surface, slice: number}}
 */
function panel(opts) {
  const border = opts.border;
  const M = opts.middle;
  const size = M + border * 2;
  const s = new Surface(opts.width || size, opts.height || size);
  const seed = opts.seed;

  // field first — the rails paint over it
  const field = opts.field === 'recess'
    ? () => T[0]
    : parchmentField(M, seed + 5);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      s.setHex(x, y, field(x - border, y - border));
    }
  }

  drawRing(s, border, railProfile(border, opts.rail), seed);
  if (opts.corner === 'plate') stampCorners(s, PLATE6);
  else if (opts.corner === 'bracket') stampCorners(s, BRACKET6);

  return { surface: s, slice: border * SCALE };
}

/** Hardwood plaque (buttons, topic rows, HUD chips) — no parchment. */
function plaque(opts) {
  const border = opts.border;
  const M = opts.middle;
  const size = M + border * 2;
  const s = new Surface(size, size);
  const seed = opts.seed;
  const face = opts.face;

  // The face is FLAT. A plaque's middle slice is only M px wide, so any grain
  // baked into it repeats every M px across a 300px button and reads as
  // machine stitching. Grain belongs on the rails, where the tile is the whole
  // rail run.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) s.setHex(x, y, face);
  }

  const pressed = !!opts.pressed;
  const beadLit = opts.beadLit || b4;
  const beadDark = opts.beadDark || b1;
  drawRing(s, border, (d, lit) => {
    const up = pressed ? !lit : lit;
    if (d === 0) return INK;
    if (d === border - 2) return up ? beadLit : beadDark;
    if (d === border - 1) return up ? WOOD.hi : INK;
    return up ? WOOD.lit : WOOD.body;
  }, seed);

  return { surface: s, slice: border * SCALE };
}

/**
 * Screen-framing corner bracket, emitted as a 2x2 atlas (NW / NE / SW / SE).
 *
 * A bracket has to follow the two screen edges it sits on, so unlike the panel
 * corner plate it cannot be the same art four times — it needs four
 * orientations. It is NOT a mirror though: each of the four is generated with
 * the real NW key, so the top and left arms are lit and the bottom and right
 * arms fall away, whichever corner they are standing in. Mirroring would rotate
 * the sun, which is the one thing the whole palette canon exists to prevent.
 */
function screenCornerAtlas() {
  const N = 24, B = 6;
  const atlas = new Surface(N * 2, N * 2);
  const variants = [
    { ox: 0, oy: 0, left: true, top: true },
    { ox: N, oy: 0, left: false, top: true },
    { ox: 0, oy: N, left: true, top: false },
    { ox: N, oy: N, left: false, top: false },
  ];

  for (const v of variants) {
    const s = new Surface(N, N);
    const profile = railProfile(B, { bead: true, inner: { lit: T[0], dark: T[0] } });
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const du = v.top ? y : N - 1 - y;      // distance from the horizontal edge
        const dv = v.left ? x : N - 1 - x;     // distance from the vertical edge
        if (du >= B && dv >= B) continue;      // outside the L
        const d = Math.min(du, dv);
        const lit = du === d ? v.top : v.left;
        const along = du === d ? dv : du;
        // square off the far end of each arm
        if (du === N - 1 || dv === N - 1) { s.setHex(x, y, INK); continue; }
        s.setHex(x, y, profile(d, lit, along, 3307));
      }
    }
    // brass plate at the OUTER corner of the bracket
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        const c = PLATE6[y][x];
        if (!c) continue;
        s.setHex(v.left ? x : N - 1 - x, v.top ? y : N - 1 - y, c);
      }
    }
    atlas.composite(s, v.ox, v.oy);
  }
  return atlas;
}

/**
 * Progress gauge trough — a recessed hardwood channel with brass end ferrules.
 * Horizontal 9-slice: `border-image-slice: 0 18 fill`, so it stretches to any
 * width while the caps stay 1:1. The channel interior is rows 2..5 (4 native px
 * = 12 css px), which is exactly where the fill bar sits.
 */
function gaugeTrough() {
  const Wd = 24, H = 8, F = 6;
  const s = new Surface(Wd, H);
  // A recess inverts the bevel: the light rakes past the top lip into shadow,
  // and catches the far (bottom) wall of the channel.
  const woodCol = [INK, WOOD.body, INK, E[0], E[0], WOOD.lit, WOOD.hi, INK];
  const brassCol = [INK, b2, b1, b0, b0, b2, b4, INK];
  for (let x = 0; x < Wd; x++) {
    const ferrule = x < F || x >= Wd - F;
    for (let y = 0; y < H; y++) {
      let c = (ferrule ? brassCol : woodCol)[y];
      if (x === 0 || x === Wd - 1) c = INK;
      if (!ferrule && y === 1 && grainHit(x - F, y, 907)) c = WOOD.grain;
      s.setHex(x, y, c);
    }
  }
  for (let y = 1; y < H - 1; y++) { s.setHex(F - 1, y, b1); s.setHex(Wd - F, y, b1); }
  return { surface: s, slice: F * SCALE };
}

/** Fixed-size portrait frame. Centre is a dark recess the <img> covers. */
function portraitFrame(art, border) {
  const size = art + border * 2;
  const { surface } = panel({
    border, middle: art, width: size, height: size,
    field: 'recess', corner: 'plate', seed: 271,
    rail: { inner: { lit: T[0], dark: T[1] } },
  });
  return surface;
}

/** Recessed inventory socket, 16x16 native -> 48 css px. */
function inventorySlot(selected) {
  const N = 16;
  const s = Surface.from(N, N, E[0]);
  // recess: the bevel is INVERTED (top/left dark, bottom/right lit)
  drawRing(s, 3, (d, lit) => {
    if (d === 0) return selected ? b4 : INK;
    if (d === 1) return lit ? (selected ? b2 : T[0]) : WOOD.lit;
    return lit ? T[1] : T[2];
  }, 613);
  // brass corner ticks, 3px L inside the socket lip
  const tick = selected ? b4 : b2;
  const spots = [[3, 3, 1, 1], [N - 4, 3, -1, 1], [3, N - 4, 1, -1], [N - 4, N - 4, -1, -1]];
  for (const [x, y, sx, sy] of spots) {
    s.setHex(x, y, tick);
    s.setHex(x + sx, y, tick);
    s.setHex(x, y + sy, tick);
  }
  return s;
}

/** Journal / scroll rod: horizontal 9-slice (left/right ferrules, tiling middle). */
function scrollRod() {
  const Wd = 48, H = 6, F = 8;
  const s = new Surface(Wd, H);
  const woodRow = [INK, WOOD.hi, WOOD.lit, WOOD.body, WOOD.body, INK];
  const brassRow = [INK, b4, b3, b2, b1, INK];
  for (let x = 0; x < Wd; x++) {
    const ferrule = x < F || x >= Wd - F;
    const edge = x === 0 || x === Wd - 1;
    for (let y = 0; y < H; y++) {
      let c = ferrule ? brassRow[y] : woodRow[y];
      if (edge) c = INK;
      if (!ferrule && grainHit(x - F, y, 733)) c = WOOD.grain;
      s.setHex(x, y, c);
    }
  }
  // ferrule seams read as banding, not a smear
  for (let y = 1; y < H - 1; y++) { s.setHex(F - 1, y, b1); s.setHex(Wd - F, y, b1); }
  return { surface: s, slice: F * SCALE };
}

/**
 * Wax seal — the recurring motif. 20x20 native -> 60 css px.
 * A pressed crimson blob with the Cross of Christ impressed into it.
 */
function waxSeal() {
  const N = 20, R = 9, c = 9.5;
  const s = new Surface(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      // wobbled rim on a 2px lattice: poured wax, not a vector disc
      const wob = R * (0.90 + 0.16 * hash2(Math.floor(x / 2), Math.floor(y / 2), 401));
      const d = Math.hypot(dx, dy);
      if (d > wob) continue;
      let col = WAX.body;
      if (d > wob - 1.2) col = (dx + dy) < 0 ? WAX.lit : WAX.out;   // NW rim lit
      else if (d > wob - 2.6 && (dx + dy) > 1.5) col = WAX.deep;    // SE falls off
      else if (d < wob - 2.6 && (dx + dy) < -3.5) col = WAX.rim;    // NW crest
      s.setHex(x, y, col);
    }
  }
  // impressed cross — cut in, so it is dark with a lit lower-right lip
  for (let i = 4; i <= 15; i++) {
    s.setHex(i, 9, WAX.deep); s.setHex(9, i, WAX.deep);
    s.setHex(i, 10, WAX.out); s.setHex(10, i, WAX.out);
    s.setHex(i, 11, WAX.lit); s.setHex(11, i, WAX.lit);
  }
  return s;
}

/** Brass cruzado, 8x8 native -> 24 css px. */
function coin() {
  const N = 8, c = 4;
  const s = new Surface(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      if (d > 3.7) continue;
      let col = b4;
      if (d > 2.8) col = (dx + dy) < 0 ? b3 : b1;
      else if ((dx + dy) < -2) col = b5;
      else if ((dx + dy) > 1.6) col = b2;
      s.setHex(x, y, col);
    }
  }
  // struck cross
  s.setHex(3, 2, b1); s.setHex(3, 3, b1); s.setHex(3, 4, b1); s.setHex(3, 5, b1);
  s.setHex(2, 3, b1); s.setHex(4, 3, b1); s.setHex(5, 3, b1);
  return s;
}

// ---------------------------------------------------------------------------
// MANIFEST
// ---------------------------------------------------------------------------
function build() {
  const out = [];
  const add = (name, res, note) => {
    const surface = res.surface || res;
    out.push({ name, surface, slice: res.slice || 0, note });
  };

  // --- panels -------------------------------------------------------------
  // middle 192 -> the parchment tile is 576 css px, so even the widest panel
  // shows well under two repeats and the stain cluster never reads as wallpaper.
  add('dialogue-box.png', panel({
    border: 6, middle: 192, corner: 'plate', seed: 1580,
  }), 'dialogue 9-slice — hardwood rails, brass corner plates + rivets, aged parchment');

  add('panel-parchment.png', panel({
    border: 6, middle: 192, corner: 'bracket', seed: 1511,
  }), 'journal / inventory 9-slice — same rails, brass L-brackets');

  add('portrait-frame.png', portraitFrame(80, 6),
    'fixed 92x92 native (80px portrait window + 6px frame) -> 276 css px');

  // --- buttons ------------------------------------------------------------
  add('button-default.png', plaque({ border: 4, middle: 8, face: WOOD.lit, seed: 21, beadLit: b3 }),
    'button 9-slice, raised');
  add('button-hover.png', plaque({ border: 4, middle: 8, face: WOOD.hi, seed: 21, beadLit: b4 }),
    'button 9-slice, key catches the brass');
  add('button-active.png', plaque({ border: 4, middle: 8, face: WOOD.body, seed: 21, pressed: true }),
    'button 9-slice, pressed (bevel inverted)');
  add('button-disabled.png', plaque({ border: 4, middle: 8, face: E[0], seed: 21, beadLit: b1, beadDark: b0 }),
    'button 9-slice, unavailable — brass gone dead, no lit lip');

  // --- topic rows ---------------------------------------------------------
  add('topic-row.png', plaque({ border: 4, middle: 8, face: WOOD.body, seed: 57, beadLit: b2, beadDark: b0 }),
    'dialogue topic row, resting');
  add('topic-row-hover.png', plaque({ border: 4, middle: 8, face: WOOD.lit, seed: 57, beadLit: b4 }),
    'dialogue topic row, hover');
  add('topic-row-quest.png', plaque({ border: 4, middle: 8, face: WOOD.body, seed: 57, beadLit: b4, beadDark: b2 }),
    'dialogue topic row, quest-critical (brass bead)');

  // --- HUD ----------------------------------------------------------------
  add('hud-plate.png', plaque({ border: 4, middle: 4, face: WOOD.body, seed: 88, beadLit: b2, beadDark: b0 }),
    'HUD chip 9-slice — dark plaque, muted brass');

  // --- fittings -----------------------------------------------------------
  add('inventory-slot.png', inventorySlot(false), 'recessed socket, 16x16 native');
  add('inventory-slot-selected.png', inventorySlot(true), 'recessed socket, brass ring');
  add('scroll-rod.png', scrollRod(), 'journal scroll end — horizontal 9-slice, brass ferrules');
  add('gauge-trough.png', gaugeTrough(), 'progress channel — horizontal 9-slice, brass ferrules');
  add('screen-corner.png', screenCornerAtlas(),
    'title/credits screen bracket — 2x2 atlas: NW, NE / SW, SE (each 24 native = 72 css)');
  add('wax-seal.png', waxSeal(), 'wax seal motif, 20x20 native -> 60 css px');
  add('coin-icon.png', coin(), 'cruzado, 8x8 native -> 24 css px');

  return out;
}

/** Legacy chrome the kit replaces. Unreferenced by CSS or components. */
const STALE = [
  'border-corner.png', 'scroll-top.png', 'parchment-bg.png', 'button.png',
  'coin.png', 'journal-icon.png', 'sword-icon.png', 'journal-page.png',
  'health-orb.png', 'energy-orb.png',
];

// ---------------------------------------------------------------------------
// GATES
// ---------------------------------------------------------------------------
function gate(pieces) {
  const problems = [];
  const canon = new Set(P.CANON.map((c) => `${c.r},${c.g},${c.b}`));
  pieces.forEach((p) => {
    const d = p.surface.data;
    const used = new Set();
    let partial = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a !== 0 && a !== 255) partial++;
      if (a === 0) continue;
      used.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    }
    used.forEach((k) => {
      if (!canon.has(k)) problems.push(`${p.name}: off-canon rgb(${k})`);
    });
    if (partial) problems.push(`${p.name}: ${partial} partial-alpha pixel(s)`);
    if (used.size > 24) problems.push(`${p.name}: ${used.size} colours — UI chrome must stay under 24`);
    p.colours = used.size;
  });
  return problems;
}

function contactSheet(pieces, outPath) {
  const { createCanvas } = require('canvas');
  const COLS = 4, CELL = 320, PAD = 16, HEAD = 84;
  const rows = Math.ceil(pieces.length / COLS);
  const cv = createCanvas(COLS * CELL, HEAD + rows * (CELL + 40));
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#14141C';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#F0E4C8';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('MELAKA FORGE — UI CHROME KIT', 20, 40);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#9AA8C0';
  ctx.fillText('native-resolution parchment / hardwood / brass, shipped at exact x3', 20, 64);

  pieces.forEach((p, i) => {
    const cx = (i % COLS) * CELL, cy = HEAD + Math.floor(i / COLS) * (CELL + 40);
    const s = p.surface;
    const k = Math.max(1, Math.min(Math.floor((CELL - PAD * 2) / s.width), Math.floor((CELL - PAD * 2) / s.height), 8));
    const big = s.scaleNearest(k);
    ctx.drawImage(big.toCanvas(), cx + PAD, cy + PAD);
    ctx.fillStyle = '#F0E4C8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(p.name, cx + PAD, cy + CELL + 4);
    ctx.fillStyle = '#8892A8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${s.width}x${s.height} native x3 = ${s.width * SCALE}x${s.height * SCALE}` +
      (p.slice ? ` · slice ${p.slice}` : '') + ` · ${p.colours} col`, cx + PAD, cy + CELL + 22);
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

module.exports = { build, gate, write, SCALE, STALE, OUT_DIR };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const pieces = build();
  const problems = gate(pieces);

  console.log(`Forge UI kit — ${pieces.length} piece(s), native authored, shipped x${SCALE}`);
  pieces.forEach((p) => {
    console.log(`  ${p.name.padEnd(28)} ${String(p.surface.width + 'x' + p.surface.height).padStart(7)}` +
      ` -> ${String(p.surface.width * SCALE + 'x' + p.surface.height * SCALE).padStart(9)}` +
      (p.slice ? `  slice ${String(p.slice).padStart(2)}` : '          ') +
      `  ${p.colours} col  ${p.note || ''}`);
  });

  if (problems.length) {
    console.error('\nFAILED GATES:');
    problems.forEach((p) => console.error('  ! ' + p));
    process.exit(1);
  }

  if (!argv.includes('--check')) {
    write(pieces, OUT_DIR);
    let removed = 0;
    STALE.forEach((f) => {
      const p = path.join(OUT_DIR, f);
      if (fs.existsSync(p)) { fs.unlinkSync(p); removed++; }
    });
    console.log(`\ninstalled ${pieces.length} file(s) into ${path.relative(REPO, OUT_DIR)}` +
      (removed ? `, removed ${removed} superseded legacy file(s)` : ''));
  }

  if (argv.includes('--sheet')) {
    console.log('review sheet: ' + path.relative(REPO, contactSheet(pieces, path.join(REVIEW_DIR, 'ui-kit.png'))));
  }

  console.log('all UI kit gates pass');
}
