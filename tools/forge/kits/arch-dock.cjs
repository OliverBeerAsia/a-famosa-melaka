'use strict';
/**
 * MELAKA FORGE — KIT: THE QUAY
 * ============================
 * Everything the waterfront is built from: plank decks and their pilings, the
 * quay wall, godowns (the bonded warehouses that were the whole point of
 * Melaka), gangways, cranes, and the three hulls that made the port —
 * the Chinese JUNK, the Arab/Gujarati DHOW and the local SAMPAN.
 *
 * SCALE CANON (native px, player = 32)
 *   deck plank             4 px wide, laid across the quay
 *   piling                 7 px thick, standing 12-18 px proud of the deck
 *   godown eaves          58 px   (1.8 players — a warehouse you cannot see over)
 *   godown ridge          88 px
 *   cargo door            44 x 40 px  (a bale has to go through it)
 *   junk hull             34 px topsides, 150-210 px long, masts to 150 px
 *   dhow hull             24 px topsides, 120-150 px long
 *   sampan                10 px topsides, 46 px long
 *   crane jib             56 px to the sheave
 *
 * SHIPS ARE THE LANDMARK. Benchmark #6 wants a background silhouette and a
 * focal mass; on a quay that mass is a hull, so the junk is drawn big enough
 * to break the top of the frame with its rig and long enough to occupy a whole
 * flank. Anything smaller and the "port of the East" reads as a jetty.
 */

const P = require('../palette.cjs');
const T = require('../texture.cjs');
const { drawFace, hash2 } = require('../iso.cjs');
const ARCH = require('./arch-portuguese.cjs');
const { def } = require('./registry.cjs');
const {
  ellipsePts, contactShadow, footprintRim, isoBox, isoCyl, post, lineTo, waterReflection, mast, clamp,
  ropeSpan,
} = require('./primitives.cjs');

const step = T.step;

// ---------------------------------------------------------------------------
// DECK STRUCTURE
// ---------------------------------------------------------------------------

/**
 * The visible edge of a timber quay: a capping beam along a tile segment, the
 * pilings that carry it, fender timbers, and the dark band of water in the
 * quay's own shadow. Author it along whichever edge of the deck faces water.
 *
 * spec: { tx, ty, len, axis: 'h'|'tx'|'ty', drop, pilings, seed }
 *   axis 'h' runs along the (1,-1) tile direction = screen-horizontal.
 */
def('quay-edge', { collide: false, examine: false }, (s, iso, o) => {
  const A = { tx: o.tx, ty: o.ty };
  const B = o.axis === 'tx' ? { tx: o.tx + o.len, ty: o.ty }
    : o.axis === 'ty' ? { tx: o.tx, ty: o.ty + o.len }
      : { tx: o.tx + o.len, ty: o.ty - o.len };
  const a = iso.toScreen(A.tx, A.ty, 0);
  const b = iso.toScreen(B.tx, B.ty, 0);
  const x0 = Math.round(Math.min(a.x, b.x)), x1 = Math.round(Math.max(a.x, b.x));
  const seed = o.seed || 4;
  const drop = o.drop === undefined ? 9 : o.drop;    // px of wall showing
  const tim = P.RAMPS.timber, stone = P.RAMPS.stone;

  const yAt = (x) => {
    const t = (x - Math.min(a.x, b.x)) / Math.max(1, Math.abs(b.x - a.x));
    return Math.round((a.x <= b.x ? a.y + (b.y - a.y) * t : b.y + (a.y - b.y) * t));
  };

  // ORIENTATION. On a FAR edge (water beyond, up-screen) the quay wall faces
  // away from the camera and is simply not visible — all you see is the capping
  // beam, the fenders standing proud of it and the ships lying alongside. On a
  // NEAR edge (water toward the camera: the far side of a basin, or under a
  // pier) the wall IS visible and has to carry the whole sense of height.
  const far = o.orientation === 'far';

  for (let x = x0; x <= x1; x++) {
    const y = yAt(x);
    // Capping beam: lit top arris, then the beam, then a HARD dark underside.
    // That last row is the one benchmark #17 samples along the whole shoreline
    // — the longest single blocked/walkable boundary on the plate — so it is
    // the material's darkest step, not a mid tone. It is also just true: the
    // underside of a rubbing beam over water never sees the sun.
    s.setHex(x, y - 2, step(tim, 4));
    s.setHex(x, y - 1, step(tim, 3));
    s.setHex(x, y, step(tim, 0));
    if (o.orientation === 'far') { s.setHex(x, y + 1, step(tim, 0)); s.setHex(x, y + 2, step(tim, 1)); }
    if (far) {
      // the strip of water in the lee of the quay is darker and glassier
      for (let d = 1; d <= 4; d++) T.shadePixel(s, x, y - 2 - d, 0.26 * (1 - d / 5));
      if (hash2(Math.floor(x / 6), 0, seed + 2) > 0.72) s.setHex(x, y - 7, step(P.RAMPS.water, 4));
      continue;
    }
    // the wall / apron below it, in the quay's own shade
    for (let d = 1; d <= drop; d++) {
      const idx = d < 3 ? 2 : d < drop - 1 ? 1 : 0;
      s.setHex(x, y + d, step(stone, idx + (hash2(Math.floor(x / 11), d > 4 ? 1 : 0, seed) < 0.24 ? -1 : 0)));
    }
    // water darkens against the wall, then a 2px reflected-light bounce
    for (let d = 0; d < 5; d++) T.shadePixel(s, x, y + drop + 1 + d, 0.34 * (1 - d / 5));
  }

  // --- pilings ------------------------------------------------------------
  const nP = o.pilings === undefined ? Math.max(2, Math.round((x1 - x0) / 34)) : o.pilings;
  for (let i = 0; i <= nP; i++) {
    const x = Math.round(x0 + (x1 - x0) * (i / Math.max(1, nP)));
    const y = yAt(x);
    const tall = far ? true : hash2(i, 0, seed) > 0.55;
    const h = tall ? 16 + Math.round(hash2(i, 1, seed) * 5) : 0;
    // below the capping: the pile going down into the water
    if (!far) {
      for (let d = 0; d < drop + 7; d++) {
        for (let k = -3; k <= 3; k++) {
          s.setHex(x + k, y + d, step(tim, k < -1 ? 3 : k < 2 ? 2 : 0));
        }
      }
    }
    if (h) {
      // mooring post standing proud, with a rope-scarred head
      for (let v = 0; v < h; v++) {
        for (let k = -3; k <= 3; k++) {
          let idx = k < -1 ? 4 : k < 2 ? 3 : 1;
          if ((v % 9) === 3) idx -= 1;
          s.setHex(x + k, y - 3 - v, step(tim, clamp(idx, 0, 4)));
        }
      }
      for (let k = -4; k <= 4; k++) s.setHex(x + k, y - 3 - h, step(tim, k < 0 ? 4 : 2));
      for (let k = -4; k <= 4; k++) s.setHex(x + k, y - 4 - h, step(tim, 1));
      T.shadePixel(s, x + 5, y + 1, 0.3);
    }
    // reflection of the pile in the water below (near edges only — on a far
    // edge the reflection falls toward the camera, i.e. onto the deck)
    if (!far) waterReflection(s, x - 3, x + 3, y + drop + 2, 12, { seed: seed + i, strength: 0.45 });
  }
});

/**
 * A run of pilings standing alone in open water (the remains of an older
 * jetty, or the outer dolphins ships warp against). Cheap depth cue: they give
 * the water something to occlude.
 */
def('piling-row', { collide: false, examine: false }, (s, iso, o) => {
  const seed = o.seed || 8;
  const n = o.count || 4;
  const tim = P.RAMPS.timber;
  for (let i = 0; i < n; i++) {
    const c = iso.toScreen(o.tx + i * (o.stepTx === undefined ? 0.55 : o.stepTx),
      o.ty - i * (o.stepTy === undefined ? 0.55 : o.stepTy), 0);
    const h = 12 + Math.round(hash2(seed, i, 3) * 12);
    const w = i % 2 ? 3 : 4;
    for (let v = 0; v < h; v++) {
      for (let k = 0; k < w; k++) {
        let idx = k === 0 ? 4 : k < w - 1 ? 3 : 1;
        if ((v % 7) === 2) idx -= 1;
        s.setHex(Math.round(c.x) - Math.floor(w / 2) + k, Math.round(c.y) - v, step(tim, clamp(idx, 0, 4)));
      }
    }
    // waterline: a bright ring of disturbed water, then the reflection
    for (let k = -4; k <= 4; k++) s.setHex(Math.round(c.x) + k, Math.round(c.y) + 1, step(P.RAMPS.water, 4));
    waterReflection(s, c.x - 2, c.x + 2, Math.round(c.y) + 2, 10, { seed: seed + i, strength: 0.5 });
  }
});

/** A plank gangway sloping from the deck up to a ship's rail. */
def('gangway', { collide: false, examine: 'A gangway plank, bowed in the middle and slick with fish oil.' }, (s, iso, o) => {
  const a = iso.toScreen(o.tx, o.ty, o.z0 || 0);
  const b = iso.toScreen(o.tx + (o.dtx === undefined ? -1.2 : o.dtx), o.ty + (o.dty === undefined ? -1.2 : o.dty), o.z1 === undefined ? 22 : o.z1);
  const tim = P.RAMPS.timber;
  const W = o.width === undefined ? 11 : o.width;
  const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(a.x + (b.x - a.x) * t);
    const y = Math.round(a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * 2.5);
    for (let k = -Math.floor(W / 2); k <= Math.floor(W / 2); k++) {
      const idx = k < -W * 0.22 ? 4 : k < W * 0.2 ? 3 : 1;
      s.setHex(x + k, y, step(tim, idx));
    }
    // cleats every 7px so it reads as a ramp you can walk up
    if (i % 7 === 0) for (let k = -Math.floor(W / 2); k <= Math.floor(W / 2); k++) s.setHex(x + k, y, step(tim, 1));
    s.setHex(x - Math.floor(W / 2) - 1, y, step(tim, 0));
    s.setHex(x + Math.floor(W / 2) + 1, y + 1, step(tim, 0));
    T.shadePixel(s, x, y + 3, 0.30);
  }
});

// ---------------------------------------------------------------------------
// GODOWN  (the bonded warehouse)
// ---------------------------------------------------------------------------
/**
 * A long shed: plank or plastered walls, a big cargo door with a hoist beam
 * over it, small barred windows high up, and a heavy hipped or gabled roof.
 * `overlayFriendly` keeps the interior of the door dark so the block can be
 * emitted as a walk-behind foreground sprite.
 */
def('godown', { collide: false, examine: 'A bonded godown; pepper, tin and the customs seal on the door.' }, (s, iso, o) => {
  const seed = o.seed || 5;
  const w = o.w || 4, d = o.d || 2.6;
  const H = o.h === undefined ? 58 : o.h;
  const wallMat = o.wall || 'timber';
  const A = { tx: o.tx, ty: o.ty };
  const B = { tx: o.tx + w, ty: o.ty };
  const C = { tx: o.tx + w, ty: o.ty + d };
  const D = { tx: o.tx, ty: o.ty + d };

  T.castShadow(s, iso.footprintPoly(o.tx, o.ty, w, d, 0), { x: Math.round(H * 0.46), y: Math.round(H * 0.23) }, 0.34);

  const fLit = iso.face(D, C, H, 0);
  const fSh = iso.face(C, B, H, 0);
  const litTex = wallMat === 'timber'
    ? T.plank({ material: 'timber', light: 3, plankW: 6, seed })
    : T.plaster({ material: wallMat, light: 3, height: H, seed, dado: 12 });
  const shTex = wallMat === 'timber'
    ? T.plank({ material: 'timber', light: 1, plankW: 6, seed: seed + 1 })
    : T.plaster({ material: wallMat, light: 1, height: H, seed: seed + 1, dado: 12 });
  drawFace(s, fLit, litTex);
  drawFace(s, fSh, shTex);

  // stone plinth: a timber godown always sits on masonry or it rots
  [fLit, fSh].forEach((f, i) => {
    const x0 = Math.round(f.p0.x);
    for (let u = 0; u < f.lenPx; u++) {
      const baseY = f.baseYAt(u + 0.5);
      for (let v = 0; v < 7; v++) {
        s.setHex(x0 + u, baseY - 1 - v,
          step(P.RAMPS.stone, (i ? 1 : 3) + (v === 6 ? 1 : 0) - (hash2(Math.floor(u / 9), v > 3 ? 1 : 0, seed) < 0.2 ? 1 : 0)));
      }
      T.aoBand(s, x0 + u, baseY + 2, 3, 0.42);
    }
  });

  // corner arris
  {
    const c = iso.toScreen(C.tx, C.ty, 0);
    for (let v = 0; v < H; v++) {
      s.setHex(Math.round(c.x) - 1, Math.round(c.y) - 1 - v, step(P.RAMPS[wallMat], 4));
      s.setHex(Math.round(c.x), Math.round(c.y) - 1 - v, step(P.RAMPS[wallMat], 0));
    }
  }

  // --- cargo door on the lit face ----------------------------------------
  const doorW = o.doorWidth || 30, doorH = o.doorHeight || 40;
  const u0 = clamp(Math.round(fLit.lenPx * (o.doorAt === undefined ? 0.45 : o.doorAt) - doorW / 2), 5, fLit.lenPx - doorW - 5);
  const x0 = Math.round(fLit.p0.x);
  for (let u = u0 - 3; u < u0 + doorW + 3; u++) {
    if (u < 0 || u >= fLit.lenPx) continue;
    const baseY = fLit.baseYAt(u + 0.5);
    const inSpan = u >= u0 && u < u0 + doorW;
    for (let v = 0; v < doorH + 3; v++) {
      const y = baseY - 1 - v;
      if (inSpan && v < doorH) {
        if (o.doorOpen === false) {
          // heavy braced leaves: verticals + a diagonal brace, iron straps
          const lu = u - u0;
          const brace = Math.abs((lu / doorW) - (v / doorH)) < 0.07;
          let idx = brace ? 4 : (lu % 6 === 0 ? 1 : lu < doorW / 2 ? 3 : 2);
          if (v === 6 || v === doorH - 8) idx = 0;
          s.setHex(u + x0, y, step(P.RAMPS.timber, idx));
        } else {
          // a lit interior: stacked bales in silhouette, one lamp deep inside
          const lu = u - u0;
          const dd = Math.hypot((lu - doorW * 0.62) * 0.9, (v - doorH * 0.36) * 1.4);
          const stack = (v < 22 && ((Math.floor(lu / 7) + (v > 11 ? 1 : 0)) & 1) === 0);
          if (v < 2) s.setHex(u + x0, y, step(P.RAMPS.stone, 1));
          else if (stack && dd > 6) s.setHex(u + x0, y, dd < 15 ? step(P.RAMPS.terracotta, 0) : P.ANCHORS['shadow-void']);
          else if (dd < 4) s.setHex(u + x0, y, P.ACCENTS['lantern-flame']);
          else if (dd < 8) s.setHex(u + x0, y, step(P.RAMPS.terracotta, 2));
          else if (dd < 14) s.setHex(u + x0, y, P.ANCHORS['shadow-violet']);
          else s.setHex(u + x0, y, P.ANCHORS['shadow-void']);
        }
      } else if (v < doorH + 3) {
        // dressed stone jambs + lintel
        s.setHex(u + x0, y, step(P.RAMPS.stone, v >= doorH ? 4 : (u < u0 ? 3 : 1)));
      }
    }
  }
  // hoist beam projecting over the door, with a block and tackle
  {
    const hx = x0 + u0 + Math.round(doorW / 2);
    const hy = fLit.baseYAt(u0 + doorW / 2) - 1 - (H - 6);
    for (let k = 0; k < 14; k++) {
      s.setHex(hx - 1, hy + Math.round(k * 0.5), step(P.RAMPS.timber, 4));
      s.setHex(hx, hy + Math.round(k * 0.5), step(P.RAMPS.timber, 2));
      s.setHex(hx + 1, hy + Math.round(k * 0.5), step(P.RAMPS.timber, 1));
    }
    lineTo(s, hx, hy + 8, hx, hy + 26, step(P.RAMPS.earth, 2));
    for (let v = 0; v < 5; v++) for (let k = -2; k <= 2; k++) s.setHex(hx + k, hy + 26 + v, step(P.RAMPS.stone, k < 0 ? 3 : 1));
  }

  // high barred windows on both faces
  [[fLit, 3], [fSh, 1]].forEach(([f, lightIdx], fi) => {
    const n = Math.max(1, Math.floor(f.lenPx / 40));
    for (let i = 0; i < n; i++) {
      const wu = Math.round((i + 0.5) * (f.lenPx / n) - 6);
      if (wu < 6 || wu + 12 > f.lenPx - 6) continue;
      const fx0 = Math.round(f.p0.x);
      for (let u = wu; u < wu + 12; u++) {
        const baseY = f.baseYAt(u + 0.5);
        for (let v = H - 22; v < H - 8; v++) {
          const bar = ((u - wu) % 4) === 0;
          const lit = o.litWindows && fi === 0 && hash2(i, fi, seed) > 0.5;
          s.setHex(fx0 + u, baseY - 1 - v,
            bar ? step(P.RAMPS.timber, 1) : lit ? P.ACCENTS['lantern-flame'] : P.ANCHORS['shadow-void']);
        }
        // sill + lintel
        s.setHex(fx0 + u, baseY - 1 - (H - 23), step(P.RAMPS.stone, 4));
        s.setHex(fx0 + u, baseY - 1 - (H - 7), step(P.RAMPS.stone, lightIdx));
      }
    }
  });

  footprintRim(s, iso, o.tx, o.ty, w, d, { strength: 0.82, anchor: 'shadow-void' });

  ARCH.roof(s, iso, {
    tx: o.tx, ty: o.ty, w, d, z: H,
    type: o.roofType || 'gable', ridgeAxis: o.ridgeAxis || 'tx',
    rise: o.rise === undefined ? 26 : o.rise,
    overhang: o.overhang === undefined ? 0.24 : o.overhang,
    material: o.roofMaterial || 'terracotta',
    seed: seed + 40,
  });
});

/**
 * The customs shed / counting house: smaller, plastered, arcaded on its front,
 * and flying the Cross of Christ — the Portuguese administrative presence on a
 * quay that is otherwise Chinese and Malay.
 */
def('customs-shed', { collide: false, examine: 'The customs house. Every bale on this quay is written into a ledger inside.' }, (s, iso, o) => {
  const seed = o.seed || 6;
  const w = o.w || 3, d = o.d || 2.4;
  const H = o.h === undefined ? 50 : o.h;
  ARCH.townhouse(s, iso, {
    tx: o.tx, ty: o.ty, w, d, floors: 1, groundH: H,
    wall: o.wall || 'whitewash',
    roof: { type: 'hip', ridgeAxis: o.ridgeAxis || 'tx', rise: o.rise === undefined ? 24 : o.rise },
    windows: { perStorey: 2, skipGround: false, litFloors: o.litFloors || [0], litChance: 0.6 },
    doors: [{ face: 'ty', at: o.doorAt === undefined ? 0.5 : o.doorAt, litInterior: true, lamp: true, label: 'customs' }],
    dado: 12, seed,
  }, null);

  // flagstaff + Portuguese banner on the ridge
  const c = iso.toScreen(o.tx + w * 0.2, o.ty + 0.1, 0);
  const topY = Math.round(c.y) - H - (o.rise === undefined ? 24 : o.rise) - 26;
  for (let v = 0; v < 26; v++) s.setHex(Math.round(c.x), topY + v, step(P.RAMPS.timber, 3));
  const cr = P.ACCENTS['flag-crimson'], wh = P.RAMPS.whitewash;
  for (let v = 0; v < 11; v++) {
    const wob = Math.round(Math.sin(v * 0.5) * 1.2);
    for (let k = 1; k < 17; k++) {
      const flap = Math.round(Math.sin(k * 0.32 + v * 0.2) * 1.1);
      s.setHex(Math.round(c.x) + k + wob, topY + 2 + v + flap,
        (k > 4 && k < 13 && v > 2 && v < 8) ? cr : (k % 7 < 4 ? step(wh, 4) : step(wh, 2)));
    }
  }
});

/** Timber shear-legs crane with a rope, sheave and cargo hook. */
def('quay-crane', { collide: 0.7, examine: 'Shear-legs for swinging cargo out of a hold; the rope is thicker than a man\'s wrist.' }, (s, iso, o) => {
  const seed = o.seed || 7;
  contactShadow(s, iso, o.tx, o.ty, 1.1, 0.34);
  const c = iso.toScreen(o.tx, o.ty, 0);
  const H = o.h || 58;
  const tim = P.RAMPS.timber;
  const apex = { x: Math.round(c.x) + (o.reach === undefined ? -14 : o.reach), y: Math.round(c.y) - H };
  // two legs meeting at the apex, one lit one in shade
  [[-13, 4], [11, 3]].forEach(([dx, lit], i) => {
    lineTo(s, c.x + dx, c.y, apex.x, apex.y, step(tim, i === 0 ? 4 : 2), { thickness: 3 });
    lineTo(s, c.x + dx + (i ? 3 : -1), c.y, apex.x, apex.y, step(tim, i === 0 ? 3 : 1));
    T.aoBand(s, Math.round(c.x + dx), Math.round(c.y) + 2, 3, 0.42);
  });
  // back stay
  ropeSpan(s, apex.x, apex.y, c.x + 26, c.y - 4, { sag: 2 });   // the stay
  // sheave block + fall
  for (let v = 0; v < 5; v++) for (let k = -3; k <= 3; k++) s.setHex(apex.x + k, apex.y + v, step(tim, k < 0 ? 4 : 1));
  const hookY = apex.y + (o.hook === undefined ? 30 : o.hook);
  lineTo(s, apex.x, apex.y + 5, apex.x, hookY, step(P.RAMPS.earth, 3));
  for (let k = -4; k <= 4; k++) s.setHex(apex.x + k, hookY, step(P.RAMPS.stone, k < 0 ? 3 : 1));
  for (let v = 1; v < 6; v++) {
    s.setHex(apex.x - 4, hookY + v, step(P.RAMPS.stone, 3));
    s.setHex(apex.x + 4, hookY + v, step(P.RAMPS.stone, 1));
  }
  if (o.load !== false) {
    // a netted bale swinging on the hook
    isoBox(s, iso, { tx: o.tx - 0.9, ty: o.ty - 0.9, w: 0.7, d: 0.7, h: 13, z: 8, material: 'earth', seed, plankW: 6 });
  }
});

/** A capstan for warping ships alongside. */
def('capstan', { collide: 0.6, examine: 'A capstan; eight men and a chanty bring a junk alongside on it.' }, (s, iso, o) => {
  contactShadow(s, iso, o.tx, o.ty, 0.75, 0.36);
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.6, h: 14, material: 'timber', seed: o.seed, stave: true, profile: (t) => 0.82 + 0.26 * (1 - t) });
  const c = iso.toScreen(o.tx, o.ty, 0);
  // capstan bars sticking out of the drumhead
  [[-16, 3], [15, 2], [-9, -4], [10, -3]].forEach(([dx, dy], i) => {
    lineTo(s, c.x, c.y - 14, c.x + dx, c.y - 14 + dy, step(P.RAMPS.timber, dx < 0 ? 4 : 1), { thickness: 2 });
  });
  for (let k = -8; k <= 8; k++) s.setHex(Math.round(c.x) + k, Math.round(c.y) - 16, step(P.RAMPS.timber, k < 0 ? 4 : 2));
});

/** Cloth / pepper bales, roped — a different silhouette from crates and sacks. */
def('bale-stack', { collide: 0.85, examine: 'Bales of Gujarati cloth, roped in threes and stencilled for Goa.' }, (s, iso, o) => {
  const seed = o.seed || 3;
  contactShadow(s, iso, o.tx + 0.35, o.ty + 0.35, 1.0, 0.36);
  const layers = [[0, 0, 0, 1.0, 0.8], [0.06, 0.1, 12, 0.85, 0.66], [0.16, 0.2, 23, 0.6, 0.5]];
  layers.forEach(([dx, dy, z, w, d], i) => {
    isoBox(s, iso, {
      tx: o.tx + dx, ty: o.ty + dy, w, d, h: 12, z, material: 'earth', seed: seed + i, plankW: 9,
    });
    // the ropes: two bands over the top and down both visible faces
    const C = iso.toScreen(o.tx + dx + w, o.ty + dy + d, z);
    const A2 = iso.toScreen(o.tx + dx, o.ty + dy + d, z);
    [0.32, 0.68].forEach((f) => {
      const px = Math.round(A2.x + (C.x - A2.x) * f);
      const py = Math.round(A2.y + (C.y - A2.y) * f);
      for (let v = 0; v < 12; v++) s.setHex(px, py - v, step(P.RAMPS.timber, 1));
      for (let k = 0; k < 9; k++) s.setHex(px + k, py - 12 - Math.round(k * 0.5), step(P.RAMPS.timber, 2));
    });
  });
});

/** Fish drying on a bamboo rack — the smell of the whole quarter. */
def('drying-rack-fish', { collide: 0.9, examine: 'Split ikan bilis drying on rattan; the smell reaches the church steps.' }, (s, iso, o) => {
  const seed = o.seed || 11;
  contactShadow(s, iso, o.tx + 0.5, o.ty + 0.2, 1.1, 0.28);
  post(s, iso, { tx: o.tx, ty: o.ty, h: 26, material: 'timber', w: 3 });
  post(s, iso, { tx: o.tx + 1.1, ty: o.ty - 1.1, h: 26, material: 'timber', w: 3 });
  const a = iso.toScreen(o.tx, o.ty, 0), b = iso.toScreen(o.tx + 1.1, o.ty - 1.1, 0);
  for (let row = 0; row < 3; row++) {
    const y0 = Math.round(a.y) - 24 + row * 8;
    const y1 = Math.round(b.y) - 24 + row * 8;
    ropeSpan(s, a.x, y0, b.x, y1, { sag: 1.5 });
    const n = Math.round(Math.abs(b.x - a.x));
    for (let k = 3; k < n - 2; k += 4) {
      const t = k / n;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      if (hash2(row, k, seed) < 0.2) continue;
      for (let v = 1; v < 6; v++) {
        s.setHex(x, y + v, step(P.RAMPS.whitewash, v < 3 ? 3 : 2));
        s.setHex(x + 1, y + v, step(P.RAMPS.earth, v < 3 ? 3 : 1));
      }
    }
  }
});

// ---------------------------------------------------------------------------
// HULLS
// ---------------------------------------------------------------------------
/**
 * Shared hull painter. Draws a sheer profile in screen space at a waterline,
 * with strake planking, a wale, the shadowed inboard side and a reflection.
 *
 *   len       overall length in px, measured along screen x
 *   topsides  freeboard at midships
 *   bowRise / sternRise  extra height at each end (this is the whole character
 *             of the type: a junk has a towering transom stern, a dhow a long
 *             raked stem)
 *   facing    +1 bow to the right, -1 bow to the left
 */
function hull(s, x0, waterY, o) {
  const len = o.len;
  const topsides = o.topsides;
  const bowRise = o.bowRise || 0;
  const sternRise = o.sternRise || 0;
  const facing = o.facing === undefined ? 1 : o.facing;
  const ramp = P.RAMPS[o.material || 'timber'];
  const trim = P.RAMPS[o.trim || 'terracotta'];
  const seed = o.seed || 1;
  const draft = o.draft === undefined ? 5 : o.draft;
  const belly = o.belly === undefined ? 0.16 : o.belly;

  const profile = (t) => {           // t = 0 at stern, 1 at bow
    const u = facing > 0 ? t : 1 - t;
    const mid = Math.sin(Math.PI * Math.min(1, 0.16 + t * 0.84));
    const ends = Math.pow(Math.max(0, u - 0.62) / 0.38, 2.1) * bowRise
      + Math.pow(Math.max(0, 0.34 - u) / 0.34, 1.7) * sternRise;
    return topsides * (0.72 + 0.28 * mid) + ends;
  };

  const top = [];
  for (let i = 0; i <= len; i++) {
    const t = i / len;
    const u = facing > 0 ? t : 1 - t;
    const h = profile(t);
    // the hull narrows to nothing at the ends
    const bottom = draft * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.02) / 0.96)));
    const x = Math.round(x0 + i);
    const yTop = Math.round(waterY - h);
    const yBot = Math.round(waterY + bottom);
    top.push({ x, yTop, yBot });
    for (let y = yTop; y <= yBot; y++) {
      const v = (y - yTop) / Math.max(1, yBot - yTop);
      // strakes: 4px courses running the length, each keeping one value
      const strake = Math.floor((y - yTop) / 4);
      let idx = v < 0.18 ? 4 : v < 0.5 ? 3 : v < 0.78 ? 2 : 1;
      if (hash2(strake, Math.floor(i / 13), seed) < 0.26) idx -= 1;
      if ((y - yTop) % 4 === 0) idx -= 1;                 // seam between strakes
      if (y > waterY - 2) idx = Math.min(idx, 1);         // boot-top, wet
      s.setHex(x, y, step(ramp, clamp(idx, 0, 4)));
    }
    // the wale: a heavy rubbing strake in the trim colour, a third down
    const wy = yTop + Math.round((yBot - yTop) * 0.34);
    s.setHex(x, wy, step(trim, 3));
    s.setHex(x, wy + 1, step(trim, 1));
    // gunwale / caprail
    s.setHex(x, yTop, step(ramp, 4));
    s.setHex(x, yTop - 1, step(trim, 2));
    // ribs showing above the rail at intervals (frames / stanchions)
    if (o.frames !== false && (i % 11) === 4 && h > topsides * 0.8) {
      for (let v2 = 2; v2 < 5; v2++) s.setHex(x, yTop - v2, step(ramp, 2));
    }
  }

  // inboard shade: you see a sliver of the far side and the deck cargo
  if (o.inboard !== false) {
    for (let i = 4; i < len - 4; i++) {
      const p = top[i];
      const h = profile(i / len);
      if (h < topsides * 0.75) continue;
      for (let v = 1; v < 4; v++) T.shadePixel(s, p.x, p.yTop + v, 0.30);
    }
  }

  // waterline sparkle + reflection
  for (let i = 0; i < len; i++) {
    const x = x0 + i;
    if (hash2(Math.floor(i / 3), 0, seed + 5) > 0.55) s.setHex(Math.round(x), waterY + Math.round(draft * 0.9), step(P.RAMPS.water, 4));
  }
  waterReflection(s, x0, x0 + len, waterY + Math.round(draft) + 2, o.reflect === undefined ? 22 : o.reflect,
    { seed: seed + 3, strength: 0.5, squash: 1.6 });
  return { top, profile };
}

/** A battened Chinese lug sail: the single most identity-carrying shape here. */
function lugSail(s, x, y, w, h, opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'earth'];
  const seed = o.seed || 2;
  const lean = o.lean === undefined ? 5 : o.lean;
  for (let v = 0; v < h; v++) {
    const t = v / h;
    const ww = Math.round(w * (0.62 + 0.38 * (1 - t)));
    const off = Math.round(lean * t);
    const batten = (v % 7) === 0;
    for (let k = 0; k < ww; k++) {
      const bell = Math.round(Math.sin(Math.PI * (k / ww)) * (o.belly === undefined ? 1.6 : o.belly));
      let idx = k < ww * 0.28 ? 4 : k < ww * 0.7 ? 3 : 2;
      if (hash2(Math.floor(k / 6), Math.floor(v / 7), seed) < 0.22) idx -= 1;
      if (batten) idx = 1;
      s.setHex(x + k + off, y + v - bell, step(ramp, clamp(idx, 0, 4)));
    }
    if (batten) {
      // battens project past the leech
      s.setHex(x + ww + off, y + v, step(P.RAMPS.timber, 2));
      s.setHex(x + ww + off + 1, y + v, step(P.RAMPS.timber, 1));
    }
  }
}

/**
 * CHINESE JUNK. High transom stern, bluff bow with a painted oculus, three
 * masts, battened lug sails. Anchored at a tile point; `len` in px.
 */
def('junk', { collide: false, examine: 'A Fujian junk, high in the stern, her battened sails brailed against the mast.' }, (s, iso, o) => {
  const c = iso.toScreen(o.tx, o.ty, 0);
  const len = o.len || 190;
  const facing = o.facing === undefined ? 1 : o.facing;
  const seed = o.seed || 21;
  const waterY = Math.round(c.y);
  const x0 = Math.round(c.x - len / 2);

  // rig first for the masts BEHIND the hull? no: hull occludes mast feet, so
  // masts are drawn first and the hull painted over their heels.
  const mastAt = o.masts || [0.24, 0.52, 0.80];
  const heads = mastAt.map((f, i) => {
    const mx = x0 + Math.round(len * (facing > 0 ? f : 1 - f));
    const mh = Math.round((o.mastH || 132) * (i === 1 ? 1 : i === 0 ? 0.74 : 0.86));
    return mast(s, mx, waterY - 14, mh, { w0: 5, w1: 3, lean: facing * -3, banded: 0 });
  });
  // sails hang on the fore and main
  lugSail(s, heads[1].x - Math.round((o.sailW || 62) * 0.42), heads[1].y + 10, o.sailW || 62, Math.round((o.mastH || 132) * 0.62), { seed, lean: facing * 5 });
  lugSail(s, heads[0].x - Math.round((o.sailW || 62) * 0.34), heads[0].y + 12, Math.round((o.sailW || 62) * 0.72), Math.round((o.mastH || 132) * 0.44), { seed: seed + 4, lean: facing * 4, material: 'timber' });
  // rigging: stays fore and aft from every masthead
  heads.forEach((hd, i) => {
    lineTo(s, hd.x, hd.y + 2, x0 + (facing > 0 ? 6 : len - 6), waterY - 16, step(P.RAMPS.earth, 2), { dash: 3 });
    lineTo(s, hd.x, hd.y + 2, x0 + (facing > 0 ? len - 6 : 6), waterY - 20, step(P.RAMPS.earth, 2), { dash: 3 });
    // a pennant
    if (i === 1) {
      for (let k = 0; k < 12; k++) s.setHex(hd.x + facing * k, hd.y - 2 + Math.round(Math.sin(k * 0.6)), P.ACCENTS['flag-crimson']);
    }
  });

  const res = hull(s, x0, waterY, {
    len, topsides: o.topsides || 34, bowRise: o.bowRise === undefined ? 10 : o.bowRise,
    sternRise: o.sternRise === undefined ? 30 : o.sternRise,
    facing, material: 'timber', trim: 'terracotta', seed, draft: 6, reflect: 26,
  });

  // transom: a slab of decorated stern gallery at the high end
  const sx = facing > 0 ? x0 + 2 : x0 + len - 14;
  const th = Math.round((o.topsides || 34) + (o.sternRise === undefined ? 30 : o.sternRise));
  for (let k = 0; k < 13; k++) {
    for (let v = 0; v < th - 6; v++) {
      let idx = k < 4 ? 3 : k < 9 ? 2 : 1;
      if ((v % 6) === 0) idx -= 1;
      s.setHex(sx + k, waterY - th + 4 + v, step(P.RAMPS.timber, clamp(idx, 0, 4)));
    }
  }
  // gallery rail + a red panel with gold characters: the ship's name board
  for (let k = 0; k < 13; k++) s.setHex(sx + k, waterY - th + 3, step(P.RAMPS.timber, 4));
  for (let k = 2; k < 11; k++) {
    for (let v = 0; v < 9; v++) {
      s.setHex(sx + k, waterY - th + 8 + v,
        hash2(k, v, seed + 9) > 0.66 ? P.ACCENTS['brass-gold'] : P.ACCENTS['flag-crimson']);
    }
  }
  // the oculus on the bow — a junk always has eyes
  const bx = facing > 0 ? x0 + len - 16 : x0 + 6;
  const by = waterY - Math.round((o.topsides || 34) * 0.62);
  for (let k = 0; k < 9; k++) {
    for (let v = 0; v < 5; v++) {
      const inEye = Math.hypot((k - 4) / 4.2, (v - 2) / 2.4) < 1;
      if (!inEye) continue;
      s.setHex(bx + k, by + v, step(P.RAMPS.whitewash, 4));
    }
  }
  for (let k = 3; k < 6; k++) for (let v = 1; v < 4; v++) s.setHex(bx + k, by + v, P.ANCHORS['shadow-void']);

  // deck cargo showing above the rail amidships
  for (let i = 0; i < 5; i++) {
    const px = x0 + Math.round(len * (0.34 + i * 0.08));
    const h = res.profile((px - x0) / len);
    for (let k = 0; k < 9; k++) {
      for (let v = 0; v < 8; v++) {
        s.setHex(px + k, Math.round(waterY - h) - 8 + v, step(P.RAMPS.earth, k < 3 ? 4 : k < 7 ? 3 : 1));
      }
    }
  }
});

/** ARAB / GUJARATI DHOW. Low, sleek, long raked stem, single lateen yard. */
def('dhow', { collide: false, examine: 'A dhow down from Gujarat with the monsoon; her sewn planking is caulked with fish oil and lime.' }, (s, iso, o) => {
  const c = iso.toScreen(o.tx, o.ty, 0);
  const len = o.len || 140;
  const facing = o.facing === undefined ? -1 : o.facing;
  const seed = o.seed || 31;
  const waterY = Math.round(c.y);
  const x0 = Math.round(c.x - len / 2);

  // mast raked forward with a very long lateen yard
  const mx = x0 + Math.round(len * (facing > 0 ? 0.42 : 0.58));
  const mh = o.mastH || 104;
  const head = mast(s, mx, waterY - 10, mh, { w0: 4, w1: 2, lean: facing * 8 });
  const yardLen = o.yard || 120;
  const yx0 = head.x - Math.round(yardLen * (facing > 0 ? 0.30 : 0.70));
  for (let k = 0; k < yardLen; k++) {
    const yy = Math.round(head.y + 6 + (k - yardLen * 0.3) * 0.42 * facing);
    s.setHex(yx0 + k, yy, step(P.RAMPS.timber, 4));
    s.setHex(yx0 + k, yy + 1, step(P.RAMPS.timber, 2));
  }
  // the sail: a big triangle hanging under the yard
  if (o.sail !== false) {
    for (let k = 6; k < yardLen - 6; k++) {
      const t = k / yardLen;
      const yy = Math.round(head.y + 8 + (k - yardLen * 0.3) * 0.42 * facing);
      const dropH = Math.round((mh * 0.62) * Math.sin(Math.PI * clamp(t * 0.92 + 0.04, 0, 1)) * (facing > 0 ? t * 0.6 + 0.4 : (1 - t) * 0.6 + 0.4));
      for (let v = 0; v < dropH; v++) {
        const bell = Math.round(Math.sin(Math.PI * (v / Math.max(1, dropH))) * 2);
        let idx = t < 0.45 ? 4 : t < 0.78 ? 3 : 2;
        if (hash2(Math.floor(k / 9), Math.floor(v / 11), seed) < 0.2) idx -= 1;
        if (v === dropH - 1) idx = 1;
        s.setHex(yx0 + k + bell, yy + v, step(P.RAMPS.whitewash, clamp(idx, 0, 4)));
      }
    }
  }
  lineTo(s, head.x, head.y + 2, x0 + (facing > 0 ? len - 4 : 4), waterY - 14, step(P.RAMPS.earth, 2), { dash: 3 });

  hull(s, x0, waterY, {
    len, topsides: o.topsides || 24,
    bowRise: o.bowRise === undefined ? 26 : o.bowRise,
    sternRise: o.sternRise === undefined ? 8 : o.sternRise,
    facing, material: 'timber', trim: 'earth', seed, draft: 5, reflect: 18, frames: false,
  });
  // the long raked stem, drawn past the end of the hull
  const stemX = facing > 0 ? x0 + len : x0;
  for (let k = 0; k < 22; k++) {
    const x = stemX + facing * k;
    const y = waterY - Math.round((o.topsides || 24) * 0.9) - Math.round(k * 1.15);
    if (y < 0) break;
    for (let w = 0; w < 3; w++) s.setHex(x, y + w, step(P.RAMPS.timber, w === 0 ? 4 : w === 1 ? 3 : 1));
  }
});

/** A sampan / small lighter, drawn low in the water. */
def('sampan', { collide: false, examine: 'A sampan, sculled with one oar over the stern.' }, (s, iso, o) => {
  const c = iso.toScreen(o.tx, o.ty, 0);
  const len = o.len || 46;
  const seed = o.seed || 41;
  const waterY = Math.round(c.y);
  const x0 = Math.round(c.x - len / 2);
  hull(s, x0, waterY, {
    len, topsides: o.topsides || 10, bowRise: 6, sternRise: 5,
    facing: o.facing === undefined ? 1 : o.facing,
    material: 'timber', trim: 'earth', seed, draft: 3, reflect: 10, frames: false, inboard: false,
  });
  // the rattan hoop awning amidships — the shape that says sampan
  if (o.awning !== false) {
    const ax = x0 + Math.round(len * 0.36), aw = Math.round(len * 0.34);
    for (let k = 0; k < aw; k++) {
      const t = k / aw;
      const h = Math.round(11 * Math.sin(Math.PI * clamp(t * 0.9 + 0.05, 0, 1)));
      for (let v = 0; v < 3; v++) {
        s.setHex(ax + k, waterY - 10 - h + v, step(P.RAMPS.timber, v === 0 ? 4 : k < aw * 0.4 ? 3 : 1));
      }
      if ((k % 6) === 0) {
        for (let v = 0; v < h; v++) s.setHex(ax + k, waterY - 10 - h + v, step(P.RAMPS.timber, 1));
      }
    }
  }
  // sculling oar over the stern
  const ox = o.facing === -1 ? x0 + len - 2 : x0 + 2;
  lineTo(s, ox, waterY - 12, ox + (o.facing === -1 ? 16 : -16), waterY + 4, step(P.RAMPS.timber, 3));
});

/**
 * An Admiralty anchor leaning against the quay wall. Pure silhouette value: a
 * shank, a stock across it and two arms with palms — nothing else on a dock
 * has that shape, so it reads as "port" from across the frame.
 */
def('anchor-stock', { collide: 0.6, examine: 'A ship\'s anchor, stock and all, leaning where the smith left it.' }, (s, iso, o) => {
  const seed = o.seed || 5;
  contactShadow(s, iso, o.tx, o.ty, 1.0, 0.34);
  const c = iso.toScreen(o.tx, o.ty, 0);
  const H = o.h || 46;
  const lean = o.lean === undefined ? 7 : o.lean;
  const iron = P.RAMPS.stone;
  const cx = Math.round(c.x), cy = Math.round(c.y);
  const shankX = (v) => cx + Math.round(lean * (v / H));
  // shank
  for (let v = 0; v < H; v++) {
    const x = shankX(v);
    s.setHex(x - 1, cy - 4 - v, step(iron, 4));
    s.setHex(x, cy - 4 - v, step(iron, 3));
    s.setHex(x + 1, cy - 4 - v, step(iron, 1));
  }
  // ring at the head
  const hx = shankX(H), hy = cy - 4 - H;
  for (let a = 0; a < 20; a++) {
    const rad = (a / 20) * Math.PI * 2;
    s.setHex(hx + Math.round(Math.cos(rad) * 5), hy - 5 + Math.round(Math.sin(rad) * 4), step(iron, Math.cos(rad) < 0 ? 4 : 1));
  }
  // timber stock across the shank, just under the ring
  const sy = hy + 5;
  for (let k = -15; k <= 15; k++) {
    const t = Math.abs(k) / 15;
    for (let q = 0; q < 3 - Math.round(t * 1.2); q++) {
      s.setHex(hx + k, sy + Math.round(k * 0.28) + q, step(P.RAMPS.timber, k < 0 ? (q ? 3 : 4) : (q ? 1 : 2)));
    }
  }
  // arms + palms at the crown
  [-1, 1].forEach((dir) => {
    for (let k = 0; k < 18; k++) {
      const t = k / 18;
      const x = cx + dir * Math.round(k * 0.92);
      const y = cy - 4 - Math.round(Math.sin(t * 1.35) * 15);
      s.setHex(x, y, step(iron, dir < 0 ? 4 : 2));
      s.setHex(x, y + 1, step(iron, dir < 0 ? 3 : 1));
    }
    const px = cx + dir * 17, py = cy - 4 - 15;
    for (let v = -5; v <= 3; v++) {
      for (let k = -4; k <= 4; k++) {
        if (Math.abs(k) + Math.abs(v) > 7) continue;
        s.setHex(px + k, py + v, step(iron, dir < 0 ? (k < 0 ? 4 : 3) : (k < 0 ? 2 : 1)));
      }
    }
  });
  if (seed) T.aoBand(s, cx, cy + 2, 3, 0.4);
});

/** A heap of nets and floats — soft mass against all the boxes. */
def('net-pile', { collide: 0.7, examine: 'Cast nets heaped over their floats, still stiff with salt.' }, (s, iso, o) => {
  const seed = o.seed || 7;
  contactShadow(s, iso, o.tx + 0.2, o.ty + 0.2, 0.9, 0.32);
  const c = iso.toScreen(o.tx, o.ty, 0);
  const ramp = P.RAMPS.earth;
  for (let v = 0; v < 14; v++) {
    const k = 1 - Math.pow(v / 14, 1.7) * 0.7;
    s.fillPoly(ellipsePts(c.x, c.y - v, 15 * k, 7 * k, 22), (uu, vv, x, y) => {
      const dx = (x + 0.5 - c.x) / Math.max(1, 15 * k);
      let idx = dx < -0.4 ? 4 : dx < 0.15 ? 3 : dx < 0.6 ? 2 : 1;
      // the mesh: a 3px lattice that keeps its own value, never speckle
      if (((x + y) % 3) === 0) idx -= 1;
      if (hash2(Math.floor(x / 5), Math.floor((y + v) / 4), seed) < 0.2) idx -= 1;
      return step(ramp, clamp(idx, 0, 4));
    });
  }
  // cork floats round the edge
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.round(c.x + Math.cos(a) * 15), py = Math.round(c.y + Math.sin(a) * 7);
    for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) {
      s.setHex(px + q, py + r, step(P.RAMPS.timber, q < 0 ? 4 : 2));
    }
  }
});

/** Far-off sails on the strait: a 2-value silhouette, hazed hard. */
def('distant-sails', { collide: false, examine: false }, (s, iso, o) => {
  const seed = o.seed || 51;
  const haze = o.haze === undefined ? 0.62 : o.haze;
  const hullC = T.hazed(P.RAMPS.timber[1], haze);
  const sailC = T.hazed(P.RAMPS.whitewash[3], haze);
  (o.ships || []).forEach((sh, i) => {
    const x = sh.x, y = sh.y, k = sh.scale === undefined ? 1 : sh.scale;
    const len = Math.round(26 * k);
    for (let d = 0; d < len; d++) {
      const t = d / len;
      const h = Math.round(3 * k * Math.sin(Math.PI * clamp(0.1 + t * 0.9, 0, 1)));
      for (let v = 0; v <= h; v++) s.setHex(x + d, y - v, hullC);
    }
    const mh = Math.round(20 * k);
    const mx = x + Math.round(len * 0.45);
    for (let v = 0; v < mh; v++) s.setHex(mx, y - 3 - v, hullC);
    for (let v = 0; v < mh - 4; v++) {
      const w = Math.round((mh - v) * 0.42 * k);
      for (let q = 0; q < w; q++) {
        if (hash2(q, v, seed + i) < 0.06) continue;
        s.setHex(mx + 1 + q, y - 3 - v, sailC);
      }
    }
    for (let d = -2; d < len + 2; d++) s.setHex(x + d, y + 1, T.hazed(P.RAMPS.water[3], haze * 0.5));
  });
});

module.exports = { hull, lugSail };
