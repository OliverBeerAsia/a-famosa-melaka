'use strict';
/**
 * MELAKA FORGE — KIT: PORTUGUESE COLONIAL ARCHITECTURE
 * ====================================================
 * Parameterised building modules for 1580s Melaka: lime-washed masonry
 * townhouses with terracotta pan-tile roofs, ground-floor arcades
 * (the Portuguese *alpendre* that Melaka's shophouse "five-foot way"
 * descends from), plaza wells and a pelourinho.
 *
 * METRIC SCALE CANON (art-critic defect #3: the church is currently shorter
 * than the player). Everything here is expressed in NATIVE px:
 *   player           32 px tall  (16x32 sprite)
 *   doorway          40 px       (1.25 player heights, head clearance)
 *   ground storey    48 px
 *   upper storey     42 px
 *   arcade pier      34 px to the springing, 46 px to the entablature
 *   window           13 x 17 px
 *   market canopy    40 px to the eave
 *   church nave     140 px+      (not built here — arch-church kit)
 *
 * LIGHT: see iso.cjs. Up-facing = brightest, +ty (down-left) = LIT,
 * +tx (down-right) = SHADOW. One sun, no exceptions.
 *
 * Every module returns `{ derived }` describing what the ENGINE needs:
 * blocked tile rects, door thresholds, light anchors, examinables.
 */

const P = require('../palette.cjs');
const T = require('../texture.cjs');
const { drawFace, hash2 } = require('../iso.cjs');

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const step = T.step;

const M = {
  STOREY: 48,
  UPPER: 42,
  DOOR_H: 40,
  DOOR_W: 20,
  WIN_W: 13,
  WIN_H: 17,
  PIER_H: 34,
};

// ---------------------------------------------------------------------------
// shared face features
// ---------------------------------------------------------------------------

/**
 * The dark recess seen through a door, arch or window. Never pure black.
 *
 * An interior must read as SHADED SPACE: a floor, a couple of goods
 * silhouettes, and — if lit — one warm pool falling off in 3 steps from a
 * single lamp. Filling the opening with a high-contrast scatter of flame and
 * dark (the first version) reads as a texture glitch, not a room.
 */
function interiorShader(opts) {
  const o = opts || {};
  const stone = P.RAMPS.stone;
  const timber = P.RAMPS.timber;
  const terr = P.RAMPS.terracotta;
  const void_ = P.ANCHORS['shadow-void'];
  const dim = P.ANCHORS['shadow-violet'];
  const seed = o.seed || 3;
  const W = o.width || M.DOOR_W;
  const H = o.height || M.DOOR_H;
  const glowU = o.glowU === undefined ? W * 0.58 : o.glowU;
  const glowV = o.glowV === undefined ? H * 0.42 : o.glowV;

  return (u, v, x, y) => {
    if (v < 2) return step(stone, 1);      // threshold stone
    if (v < 5) return step(timber, 0);     // floorboards, in shade

    // shelving / stacked goods against the back wall — two silhouette bands
    const shelfBand = (v > 7 && v < 10) || (v > 17 && v < 20);
    const goodsCol = (Math.floor(u / 4) & 1) === 0;

    if (o.lit) {
      // one lamp, three falloff steps, softened on a 2px block so the bands
      // do not read as concentric rings
      const du = (u - glowU) * 0.95, dv = (v - glowV) * 1.35;
      const jitter = (hash2(x >> 1, y >> 1, seed) - 0.5) * 2.0;
      const d = Math.sqrt(du * du + dv * dv) + jitter;
      if (shelfBand && d > 5) return d < 12 ? step(terr, 0) : void_;
      if (d < 3) return P.ACCENTS['lantern-flame'];
      if (d < 6) return step(terr, 3);
      if (d < 10) return step(terr, 1);
      if (d < 15) return dim;
      return void_;
    }

    if (shelfBand && goodsCol) return dim;
    if (v > (o.backFrom || 14) && hash2(x >> 2, y >> 2, seed) > 0.86) return dim;
    return void_;
  };
}

/** Top of an arched opening at face-column u (semicircular head). */
function archTopV(u, u0, w, rectH, rise) {
  const r = w / 2, uc = u0 + r;
  const dx = u - uc;
  const k = Math.max(0, r * r - dx * dx);
  return rectH + Math.sqrt(k) * ((rise === undefined ? r : rise) / r);
}

/**
 * Punch a doorway (round-headed, stone-dressed) into an already-drawn face.
 * u0 = face-local px of the left jamb.
 */
function doorway(surface, f, u0, spec) {
  const s = spec || {};
  const w = s.width || M.DOOR_W;
  const h = s.height || M.DOOR_H;
  const rect = s.arched === false ? h : h - w / 2;
  const stone = P.RAMPS[s.dressing || 'stone'];
  const litSide = s.lit !== false;
  const inner = interiorShader({ seed: s.seed || 7, lit: s.litInterior, backFrom: 10, width: w, height: h });
  const x0 = Math.round(f.p0.x);

  for (let u = Math.floor(u0) - 2; u < Math.ceil(u0 + w) + 2; u++) {
    if (u < 0 || u >= f.lenPx) continue;
    const baseY = f.baseYAt(u + 0.5);
    const x = x0 + u;
    const inSpan = u >= u0 && u < u0 + w;
    const top = inSpan ? archTopV(u + 0.5, u0, w, rect, s.arched === false ? 0 : w / 2) : 0;
    for (let v = 0; v < h + 4; v++) {
      const y = baseY - 1 - v;
      if (inSpan && v < top) {
        surface.setHex(x, y, inner(u - u0, v, x, y));
      } else if (u >= u0 - 2 && u < u0 + w + 2) {
        // stone surround: 2px jambs + a voussoir ring following the arch
        const dj = Math.min(u - (u0 - 2), (u0 + w + 2) - u);
        const outer = archTopV(u + 0.5, u0 - 2, w + 4, rect, w / 2 + 2);
        if (v < outer + 2) {
          const lit = (u < u0) === litSide;
          surface.setHex(x, y, step(stone, lit ? 4 : 2) );
          if (dj <= 0.5 || v >= outer) surface.setHex(x, y, step(stone, 1));
        }
      }
    }
    // threshold: a worn stone step that reads as CONTACT with the street
    if (u >= u0 - 1 && u < u0 + w + 1) {
      surface.setHex(x, baseY - 1, step(stone, 4));
      surface.setHex(x, baseY, step(stone, 2));
      T.shadePixel(surface, x, baseY + 1, 0.30);
    }
  }
  return { u: u0 + w / 2, height: h };
}

/** A shuttered window; `lit` fills it with lantern flame for the night pass. */
function window_(surface, f, u0, v0, spec) {
  const s = spec || {};
  const w = s.width || M.WIN_W;
  const h = s.height || M.WIN_H;
  const stone = P.RAMPS[s.dressing || 'stone'];
  const timber = P.RAMPS.timber;
  const flame = P.ACCENTS['lantern-flame'];
  const void_ = P.ANCHORS['shadow-void'];
  const x0 = Math.round(f.p0.x);
  const seed = s.seed || 5;
  const shutter = s.shutters !== false;

  for (let u = Math.floor(u0) - 2; u < Math.ceil(u0 + w) + 2; u++) {
    if (u < 0 || u >= f.lenPx) continue;
    const baseY = f.baseYAt(u + 0.5);
    const x = x0 + u;
    for (let v = v0 - 2; v < v0 + h + 3; v++) {
      const y = baseY - 1 - v;
      const inU = u >= u0 && u < u0 + w;
      const inV = v >= v0 && v < v0 + h;
      if (inU && inV) {
        const lu = u - u0, lv = v - v0;
        if (shutter && (lu < 4 || lu >= w - 4)) {
          // shutter leaves: 3 louvre bands, lit leaf on the left
          const litLeaf = lu < 4;
          let sIdx = litLeaf ? 3 : 1;
          if ((lv % 4) === 0) sIdx -= 1;
          surface.setHex(x, y, step(timber, sIdx));
        } else if (s.lit) {
          surface.setHex(x, y, hash2(x, y >> 1, seed) > 0.35 ? flame : step(P.RAMPS.terracotta, 3));
        } else {
          surface.setHex(x, y, lv > h - 3 ? void_ : step(P.RAMPS.stone, 0));
        }
      } else if (u >= u0 - 2 && u < u0 + w + 2 && v >= v0 - 2 && v < v0 + h + 3) {
        // dressed stone surround; sill catches the sun, lintel throws shade
        let sIdx = 3;
        if (v >= v0 + h) sIdx = 1;              // lintel underside
        if (v < v0) sIdx = 4;                    // sill
        surface.setHex(x, y, step(stone, sIdx));
      }
    }
    // sill drip-shadow on the wall below
    if (u >= u0 - 2 && u < u0 + w + 2) {
      const y = baseY - 1 - (v0 - 3);
      T.shadePixel(surface, x, y, 0.32);
    }
  }
  return { u: u0 + w / 2, v: v0 + h / 2 };
}

/** Horizontal string course / cornice band across a face. */
function stringCourse(surface, f, v, spec) {
  const s = spec || {};
  const ramp = P.RAMPS[s.material || 'stone'];
  const th = s.thickness || 3;
  const x0 = Math.round(f.p0.x);
  for (let u = 0; u < f.lenPx; u++) {
    const baseY = f.baseYAt(u + 0.5);
    const x = x0 + u;
    for (let k = 0; k < th; k++) {
      surface.setHex(x, baseY - 1 - (v + k), step(ramp, k === th - 1 ? 4 : k === 0 ? 1 : 3));
    }
    T.shadePixel(surface, x, baseY - 1 - (v - 1), 0.35);
    T.shadePixel(surface, x, baseY - 1 - (v - 2), 0.18);
  }
}

// ---------------------------------------------------------------------------
// ROOFS
// ---------------------------------------------------------------------------

function roofBasis(iso, pts3, z0, z1) {
  return null; // placeholder — basis built inline below
}

/**
 * Terracotta roof over a tile-space footprint.
 * type: 'hip' | 'gable' | 'pent'
 * ridgeAxis: 'tx' (ridge runs along +tx) | 'ty'
 * Only the two camera-facing planes are drawn (+tx = shadow, +ty = lit).
 */
function roof(surface, iso, spec) {
  const s = spec;
  const o = s.overhang === undefined ? 0.16 : s.overhang;
  const z = s.z;
  const rise = s.rise === undefined ? 20 : s.rise;
  const mat = s.material || 'terracotta';
  const wallMat = s.wallMaterial || 'whitewash';
  const seed = s.seed || 1;
  const x0 = s.tx - o, x1 = s.tx + s.w + o;
  const y0 = s.ty - o, y1 = s.ty + s.d + o;
  const S = (tx, ty, zz) => iso.toScreen(tx, ty, zz);

  const litTex = T.roofTile({ material: mat, light: 3, seed });
  const shadeTex = T.roofTile({ material: mat, light: 1, seed: seed + 1 });
  const topTex = T.roofTile({ material: mat, light: 4, seed: seed + 2 });

  const type = s.type || 'hip';
  const axis = s.ridgeAxis || (s.w >= s.d ? 'tx' : 'ty');

  function quad(pts, tex, uLen, vLen) {
    const basis = {
      o: pts[0],
      eu: { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y },
      ev: { x: pts[3].x - pts[0].x, y: pts[3].y - pts[0].y },
      uLen, vLen,
    };
    surface.fillPoly(pts, tex, basis);
  }
  function tri(pts, tex, uLen, vLen) {
    const basis = {
      o: pts[0],
      eu: { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y },
      ev: { x: pts[2].x - pts[0].x, y: pts[2].y - pts[0].y },
      uLen, vLen,
    };
    surface.fillPoly(pts, tex, basis);
  }

  const tw = iso.tileWidth;
  const ridgePts = [];

  if (type === 'pent') {
    // single slope, high at the back (-ty), low at the front eave (+ty)
    const pts = [S(x0, y1, z), S(x1, y1, z), S(x1, y0, z + rise), S(x0, y0, z + rise)];
    quad([pts[0], pts[1], pts[2], pts[3]], litTex, (x1 - x0) * tw, (y1 - y0) * tw * 0.7);
    // the +tx end triangle in roof shade
    tri([S(x1, y1, z), S(x1, y0, z + rise), S(x1, y0, z)], shadeTex, (y1 - y0) * tw, rise);
    ridgePts.push(S(x0, y0, z + rise), S(x1, y0, z + rise));
  } else if (axis === 'tx') {
    const my = (y0 + y1) / 2;
    const inset = type === 'hip' ? Math.min((y1 - y0) / 2, (x1 - x0) / 2 - 0.05) : 0;
    const R0 = S(x0 + inset, my, z + rise);
    const R1 = S(x1 - inset, my, z + rise);
    // LIT plane: eave D->C, up to the ridge
    quad([S(x0, y1, z), S(x1, y1, z), R1, R0], litTex, (x1 - x0) * tw, ((y1 - y0) / 2) * tw * 0.8);
    // SHADOW plane at the +tx end
    if (type === 'hip') {
      tri([S(x1, y1, z), S(x1, y0, z), R1], shadeTex, (y1 - y0) * tw, rise * 1.4);
    } else {
      // gable end: a BOARDED tympanum, not plaster. A plaster gable in the
      // wall's lit step reads as a white sail hung off the roof.
      tri([S(x1, y1, z), S(x1, y0, z), S(x1, (y0 + y1) / 2, z + rise)],
        T.plank({ material: 'timber', light: 1, plankW: 5, seed: seed + 4 }),
        (y1 - y0) * tw, rise);
      // barge board
      surface.fillPoly([S(x1, y1, z), S(x1, y1, z - 3), S(x1, my, z + rise - 3), S(x1, my, z + rise)],
        T.flat(step(P.RAMPS.timber, 1)));
    }
    ridgePts.push(R0, R1);
  } else {
    const mx = (x0 + x1) / 2;
    const inset = type === 'hip' ? Math.min((x1 - x0) / 2, (y1 - y0) / 2 - 0.05) : 0;
    const R0 = S(mx, y0 + inset, z + rise);
    const R1 = S(mx, y1 - inset, z + rise);
    // SHADOW plane: the +tx eave B->C
    quad([S(x1, y0, z), S(x1, y1, z), R1, R0], shadeTex, (y1 - y0) * tw, ((x1 - x0) / 2) * tw * 0.8);
    // LIT plane at the +ty end
    if (type === 'hip') {
      tri([S(x1, y1, z), S(x0, y1, z), R1], litTex, (x1 - x0) * tw, rise * 1.4);
    } else {
      tri([S(x1, y1, z), S(x0, y1, z), S((x0 + x1) / 2, y1, z + rise)],
        T.plank({ material: 'timber', light: 3, plankW: 5, seed: seed + 4 }),
        (x1 - x0) * tw, rise);
    }
    ridgePts.push(R0, R1);
  }

  // ridge capping: a 2px run of the brightest terracotta with a dark under-line
  if (ridgePts.length === 2) {
    const [a, b] = ridgePts;
    const n = Math.max(1, Math.round(Math.abs(b.x - a.x)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);
      surface.setHex(x, y - 1, step(P.RAMPS[mat], 4));
      surface.setHex(x, y, step(P.RAMPS[mat], 3));
      surface.setHex(x, y + 1, step(P.RAMPS[mat], 1));
    }
  }

  // eave fascia + the shadow it throws on the wall below (grounding, cheap)
  const eaveEdges = [[S(x0, y1, z), S(x1, y1, z)], [S(x1, y1, z), S(x1, y0, z)]];
  eaveEdges.forEach(([a, b], k) => {
    const n = Math.max(1, Math.round(Math.abs(b.x - a.x)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);
      surface.setHex(x, y, step(P.RAMPS[mat], k === 0 ? 1 : 0));
      surface.setHex(x, y + 1, step(P.RAMPS.timber, k === 0 ? 1 : 0));
      T.shadePixel(surface, x, y + 2, 0.42);
      T.shadePixel(surface, x, y + 3, 0.22);
    }
  });
}

// ---------------------------------------------------------------------------
// MODULE: TOWNHOUSE
// ---------------------------------------------------------------------------
/**
 * spec: {
 *   tx, ty, w, d,            tile-space footprint
 *   floors: 1|2|3,
 *   wall: 'whitewash'|'stone'|'terracotta',
 *   roof: {type, ridgeAxis, rise, material},
 *   doors:   [{face:'ty'|'tx', at: 0..1, lit}],
 *   windows: {perStorey: n, litFloors: [1], skipGround: true},
 *   colour:  optional wall ramp override for variety,
 *   seed
 * }
 */
function townhouse(surface, iso, spec, out) {
  const s = spec;
  const seed = s.seed || 1;
  const floors = s.floors || 2;
  const groundH = s.groundH || M.STOREY;
  const upperH = s.upperH || M.UPPER;
  const H = groundH + (floors - 1) * upperH;
  const wallMat = s.wall || 'whitewash';
  const derived = { blocked: [], doors: [], lights: [], examinables: [] };

  const A = { tx: s.tx, ty: s.ty };
  const B = { tx: s.tx + s.w, ty: s.ty };
  const C = { tx: s.tx + s.w, ty: s.ty + s.d };
  const D = { tx: s.tx, ty: s.ty + s.d };

  // --- cast shadow on the ground, down-right (sun NW) -----------------------
  if (s.castShadow !== false) {
    const off = { x: Math.round(H * 0.46), y: Math.round(H * 0.23) };
    T.castShadow(surface, iso.footprintPoly(s.tx, s.ty, s.w, s.d, 0), off, 0.44);
  }

  // --- walls ----------------------------------------------------------------
  const fLit = iso.face(D, C, H, 0);      // +ty face, down-left, LIT
  const fShade = iso.face(C, B, H, 0);    // +tx face, down-right, SHADOW

  const litTex = T.plaster({ material: wallMat, light: 3, height: H, seed, dado: s.dado === undefined ? 9 : s.dado });
  const shadeTex = T.plaster({ material: wallMat, light: 1, height: H, seed: seed + 1, dado: s.dado === undefined ? 9 : s.dado });
  drawFace(surface, fLit, litTex);
  drawFace(surface, fShade, shadeTex);

  // corner rib: 1px of the brighter step on the lit side of the near corner,
  // 1px of the dark step on the shadow side — reads as a real arris, and is
  // the ONLY outline plate scenery gets (benchmark #16).
  {
    const cx = Math.round(iso.toScreen(C.tx, C.ty, 0).x);
    const cyBase = Math.round(iso.toScreen(C.tx, C.ty, 0).y);
    for (let v = 0; v < H; v++) {
      surface.setHex(cx - 1, cyBase - 1 - v, step(P.RAMPS[wallMat], 4));
      surface.setHex(cx, cyBase - 1 - v, step(P.RAMPS[wallMat], 0));
    }
  }

  // storey string courses
  for (let f = 1; f < floors; f++) {
    const v = groundH + (f - 1) * upperH;
    stringCourse(surface, fLit, v, { material: 'stone', thickness: 3 });
    stringCourse(surface, fShade, v, { material: 'stone', thickness: 3 });
  }

  // --- openings -------------------------------------------------------------
  const faces = { ty: fLit, tx: fShade };
  (s.doors || []).forEach((dspec, i) => {
    const f = faces[dspec.face || 'ty'];
    if (!f) return;
    const u0 = clamp(Math.round(f.lenPx * (dspec.at === undefined ? 0.5 : dspec.at) - M.DOOR_W / 2), 3, f.lenPx - M.DOOR_W - 3);
    const info = doorway(surface, f, u0, {
      seed: seed + 10 + i, litInterior: dspec.litInterior,
      lit: dspec.face !== 'tx', width: dspec.width, height: dspec.height,
    });
    const p = f.at(info.u, 0);
    derived.doors.push({ x: Math.round(p.x), y: Math.round(p.y), face: dspec.face || 'ty', label: dspec.label });
    if (dspec.lamp) {
      derived.lights.push({ x: Math.round(p.x), y: Math.round(p.y) - M.DOOR_H - 4, type: 'lantern', radius: 42 });
    }
  });

  const wspec = s.windows || {};
  const perStorey = wspec.perStorey === undefined ? 2 : wspec.perStorey;
  if (perStorey > 0) {
    ['ty', 'tx'].forEach((fk) => {
      const f = faces[fk];
      const n = Math.max(1, Math.min(perStorey, Math.floor(f.lenPx / 26)));
      for (let fl = 0; fl < floors; fl++) {
        if (fl === 0 && wspec.skipGround !== false) continue;
        const vBase = groundH + (fl - 1) * upperH + 13;
        for (let i = 0; i < n; i++) {
          const u0 = Math.round((i + 0.5) * (f.lenPx / n) - M.WIN_W / 2);
          if (u0 < 4 || u0 + M.WIN_W > f.lenPx - 4) continue;
          const lit = (wspec.litFloors || []).indexOf(fl) >= 0 &&
            hash2(i, fl, seed + (fk === 'ty' ? 0 : 9)) > (wspec.litChance === undefined ? 0.45 : 1 - wspec.litChance);
          window_(surface, f, u0, vBase, { seed: seed + 20 + i, lit });
          if (lit) {
            const p = f.at(u0 + M.WIN_W / 2, vBase + M.WIN_H / 2);
            derived.lights.push({ x: Math.round(p.x), y: Math.round(p.y), type: 'window', radius: 34, nightOnly: true });
          }
        }
      }
    });
  }

  // balcony: a projecting timber gallery on the lit face (upper storey)
  if (s.balcony) {
    const f = fLit;
    const v = groundH + 4;
    const x0 = Math.round(f.p0.x);
    const uA = Math.round(f.lenPx * (s.balcony.from === undefined ? 0.15 : s.balcony.from));
    const uB = Math.round(f.lenPx * (s.balcony.to === undefined ? 0.85 : s.balcony.to));
    for (let u = uA; u < uB; u++) {
      const baseY = f.baseYAt(u + 0.5);
      const x = x0 + u;
      for (let k = 0; k < 3; k++) surface.setHex(x, baseY - 1 - (v + k), step(P.RAMPS.timber, k === 2 ? 4 : 2));
      for (let k = 3; k < 13; k++) {
        const rail = ((u % 4) === 0) || k === 12;
        surface.setHex(x, baseY - 1 - (v + k), rail ? step(P.RAMPS.timber, 3) : null || step(P.RAMPS.timber, 3));
        if (!rail) surface.setHex(x, baseY - 1 - (v + k), (k === 12) ? step(P.RAMPS.timber, 4) : step(P.RAMPS[wallMat], 0));
      }
      T.shadePixel(surface, x, baseY - 1 - (v - 1), 0.40);
      T.shadePixel(surface, x, baseY - 1 - (v - 2), 0.20);
    }
  }

  // --- roof -----------------------------------------------------------------
  const rs = s.roof || {};
  roof(surface, iso, {
    tx: s.tx, ty: s.ty, w: s.w, d: s.d, z: H,
    type: rs.type || 'hip', ridgeAxis: rs.ridgeAxis,
    rise: rs.rise === undefined ? (s.w + s.d) * 3.2 : rs.rise,
    overhang: rs.overhang, material: rs.material || 'terracotta',
    wallMaterial: wallMat, seed: seed + 40,
  });

  // --- ground contact AO ----------------------------------------------------
  [fLit, fShade].forEach((f) => {
    const x0 = Math.round(f.p0.x);
    for (let u = 0; u < f.lenPx; u++) {
      const baseY = f.baseYAt(u + 0.5);
      T.aoBand(surface, x0 + u, baseY + 2, 3, 0.40);
    }
  });

  derived.blocked.push({ tx: s.tx, ty: s.ty, w: s.w, d: s.d });
  if (out) mergeDerived(out, derived);
  return derived;
}

// ---------------------------------------------------------------------------
// MODULE: ARCADE / COLONNADE STRIP
// ---------------------------------------------------------------------------
/**
 * A covered walkway of round arches on square piers — the *alpendre*. Rendered
 * so the openings stay TRANSPARENT, which lets the compositor emit it as a
 * foreground overlay sprite the player can walk behind (benchmark #7).
 *
 * spec: { tx, ty, len, axis:'h'|'tx'|'ty', bays, pierH, roofDepth, rise, seed }
 *   axis 'h'  -> runs along the (1,-1) tile direction = screen-horizontal.
 */
function arcade(surface, iso, spec, out) {
  const s = spec;
  const seed = s.seed || 2;
  const derived = { blocked: [], doors: [], lights: [], examinables: [] };
  const A = { tx: s.tx, ty: s.ty };
  const B = s.axis === 'tx' ? { tx: s.tx + s.len, ty: s.ty }
    : s.axis === 'ty' ? { tx: s.tx, ty: s.ty + s.len }
      : { tx: s.tx + s.len, ty: s.ty - s.len };
  const pierH = s.pierH || M.PIER_H;
  const entH = s.entablature === undefined ? 12 : s.entablature;
  const H = pierH + entH;
  const f = iso.face(A, B, H, 0);
  const bays = s.bays || Math.max(1, Math.round(f.lenPx / 34));
  const pitch = f.lenPx / bays;
  const pw = s.pierW || 9;
  const wallMat = s.wall || 'whitewash';
  const stone = P.RAMPS[s.dressing || 'stone'];
  const x0 = Math.round(f.p0.x);

  const pierLit = T.ashlar({ material: s.dressing || 'stone', light: 4, blockW: 9, blockH: 7, seed });
  const pierShade = T.ashlar({ material: s.dressing || 'stone', light: 2, blockW: 9, blockH: 7, seed: seed + 1 });
  const entLit = T.plaster({ material: wallMat, light: 3, height: entH, dado: 0, eave: 3, seed: seed + 2 });
  const recess = interiorShader({ seed: seed + 6, backFrom: 16 });

  for (let u = 0; u < f.lenPx; u++) {
    const baseY = f.baseYAt(u + 0.5);
    const x = x0 + u;
    const bay = Math.floor(u / pitch);
    const fu = u - bay * pitch;
    const inPierL = fu < pw;
    const inPierR = fu >= pitch - pw;
    const isPier = inPierL || inPierR;

    // --- entablature band + cornice, continuous across the whole strip
    for (let v = pierH; v < H; v++) {
      surface.setHex(x, baseY - 1 - v, entLit(u, v - pierH, x, baseY - 1 - v));
    }
    for (let k = 0; k < 3; k++) {
      surface.setHex(x, baseY - 1 - (H + k), step(stone, k === 2 ? 4 : 3));
    }

    if (isPier) {
      // pier shaft: lit on its left 60%, shadow on the right (one sun)
      const local = inPierL ? fu : fu - (pitch - pw);
      const tex = local < pw * 0.62 ? pierLit : pierShade;
      for (let v = 0; v < pierH; v++) {
        surface.setHex(x, baseY - 1 - v, tex(local, v, x, baseY - 1 - v));
      }
      // moulded base + impost capital
      for (let v = 0; v < 4; v++) surface.setHex(x, baseY - 1 - v, step(stone, v === 3 ? 4 : 2));
      for (let v = pierH - 4; v < pierH; v++) surface.setHex(x, baseY - 1 - v, step(stone, v === pierH - 1 ? 4 : 3));
      // contact shadow on the pavement
      T.aoBand(surface, x, baseY + 2, 3, 0.46);
      T.shadePixel(surface, x + Math.round(pierH * 0.30), baseY + 1, 0.24);
    } else {
      // --- spandrel above the arch (transparent below the arc)
      const su = fu - pw;
      const span = pitch - 2 * pw;
      const r = span / 2;
      const springV = s.springV === undefined ? pierH - 14 : s.springV;
      const top = archTopV(su, 0, span, springV, r);
      // Openings are transparent by default so the compositor can emit the
      // colonnade as a walk-behind overlay. `opaqueOpenings` fills the recess
      // instead, for arcades applied straight onto a building's ground floor.
      if (s.opaqueOpenings) {
        for (let v = 0; v < top; v++) {
          surface.setHex(x, baseY - 1 - v, recess(su, v, x, baseY - 1 - v));
        }
      }
      for (let v = Math.floor(top); v < pierH; v++) {
        surface.setHex(x, baseY - 1 - v, entLit(u, v - springV, x, baseY - 1 - v));
      }
      // voussoir ring: 3px of dressed stone following the arc
      for (let k = 0; k < 3; k++) {
        const y = baseY - 1 - Math.floor(top + k);
        surface.setHex(x, y, step(stone, k === 0 ? 2 : 4));
      }
      // soffit shade just under the arc so the opening reads as depth
      surface.setHex(x, baseY - Math.floor(top), step(P.RAMPS.stone, 1));
    }
  }

  // --- pent roof over the walkway, sloping up and back --------------------
  const rd = s.roofDepth === undefined ? 1.6 : s.roofDepth;
  const rise = s.rise === undefined ? 14 : s.rise;
  if (rd > 0) {
    const back = { tx: -rd, ty: -rd };
    const p = [
      iso.toScreen(A.tx, A.ty, H + 3),
      iso.toScreen(B.tx, B.ty, H + 3),
      iso.toScreen(B.tx + back.tx, B.ty + back.ty, H + 3 + rise),
      iso.toScreen(A.tx + back.tx, A.ty + back.ty, H + 3 + rise),
    ];
    // A lean-to seen almost edge-on is a SHALLOW band. With the default pan
    // grooves it reads as a plank fence, so widen the pans and tighten the
    // courses: horizontal lines have to win at this foreshortening.
    surface.fillPoly(p, T.roofTile({ material: 'terracotta', light: 3, pan: 8, course: 4, seed: seed + 5 }), {
      o: p[0],
      eu: { x: p[1].x - p[0].x, y: p[1].y - p[0].y },
      ev: { x: p[3].x - p[0].x, y: p[3].y - p[0].y },
      uLen: Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y),
      vLen: Math.hypot(p[3].x - p[0].x, p[3].y - p[0].y) * 1.25,
    });
    // eave line + its shadow on the entablature
    const n = Math.max(1, Math.round(Math.abs(p[1].x - p[0].x)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(p[0].x + (p[1].x - p[0].x) * t);
      const y = Math.round(p[0].y + (p[1].y - p[0].y) * t);
      surface.setHex(x, y, step(P.RAMPS.terracotta, 1));
      surface.setHex(x, y + 1, step(P.RAMPS.timber, 1));
      T.shadePixel(surface, x, y + 2, 0.40);
      // top edge where the lean-to meets the wall: bright capping + dark
      // reveal, so the band terminates as a ROOF and not as fence planking
      const ry = Math.round(p[3].y + (p[2].y - p[3].y) * t);
      surface.setHex(x, ry, step(P.RAMPS.terracotta, 4));
      surface.setHex(x, ry - 1, step(P.RAMPS.terracotta, 0));
    }
  }

  // piers block movement; the walkway between them does not
  for (let b = 0; b <= bays; b++) {
    const uu = clamp(b * pitch, 0, f.lenPx - 1);
    const pt = f.at(uu, 0);
    derived.blocked.push({ screen: { x: pt.x - 4, y: pt.y - 3, w: 9, h: 6 } });
  }
  derived.overlayDepthY = Math.round(Math.max(f.p0.y, f.p1.y));
  if (out) mergeDerived(out, derived);
  return derived;
}

// ---------------------------------------------------------------------------
// MODULE: PLAZA WELL
// ---------------------------------------------------------------------------
function well(surface, iso, spec, out) {
  const s = spec;
  const seed = s.seed || 4;
  const derived = { blocked: [], doors: [], lights: [], examinables: [] };
  const r = s.r === undefined ? 0.62 : s.r;       // tiles
  const wallH = s.wallH === undefined ? 15 : s.wallH;
  const cx = s.tx, cy = s.ty;
  const stone = P.RAMPS.stone;
  const timber = P.RAMPS.timber;
  const c = iso.toScreen(cx, cy, 0);
  const rx = r * iso.tileWidth, ry = r * iso.tileHeight;

  // cast shadow first
  surface.fillPoly(ellipsePts(c.x + 7, c.y + 4, rx, ry, 16), (u, v, x, y) => {
    T.shadePixel(surface, x, y, T.checker2(x, y) ? 0.36 : 0.20); return null;
  });

  // drum: rings of the ellipse swept down the wall height
  for (let v = 0; v < wallH; v++) {
    const pts = ellipsePts(c.x, c.y - v, rx, ry, 40);
    surface.fillPoly(pts, (uu, vv, x, y) => {
      const dx = (x + 0.5 - c.x) / rx;
      const lit = -dx;                             // sun from screen-left
      let sIdx = lit > 0.35 ? 4 : lit > -0.1 ? 3 : lit > -0.55 ? 2 : 1;
      const course = Math.floor(v / 5);
      const block = Math.floor((Math.atan2((y + v - c.y) / ry, dx) + Math.PI) / (Math.PI / 6));
      if (hash2(block, course, seed) < 0.24) sIdx -= 1;
      if ((v % 5) === 0) sIdx -= 1;                // coursing
      return step(stone, sIdx);
    });
  }
  // coping rim + dark water
  surface.fillPoly(ellipsePts(c.x, c.y - wallH, rx, ry, 40), (uu, vv, x, y) => {
    const dx = (x + 0.5 - c.x) / rx, dy = (y + 0.5 - (c.y - wallH)) / ry;
    const d2 = dx * dx + dy * dy;
    if (d2 < 0.42) {
      return d2 < 0.28 ? P.ANCHORS['shadow-void'] : step(P.RAMPS.water, 1);
    }
    return step(stone, dy < -0.1 ? 3 : 4);
  });

  // timber A-frame + windlass + bucket
  const legs = [[-rx * 0.82, 0], [rx * 0.82, 0]];
  const topY = c.y - wallH - 26;
  legs.forEach(([lx], i) => {
    const bx = Math.round(c.x + lx);
    for (let k = 0; k <= 26; k++) {
      const t = k / 26;
      const x = Math.round(bx + (c.x - bx) * t * 0.55);
      const y = Math.round(c.y - wallH + 3 - k);
      surface.setHex(x, y, step(timber, i === 0 ? 4 : 2));
      surface.setHex(x + 1, y, step(timber, i === 0 ? 3 : 1));
    }
  });
  for (let x = Math.round(c.x - rx * 0.5); x <= Math.round(c.x + rx * 0.5); x++) {
    surface.setHex(x, topY + 2, step(timber, 4));
    surface.setHex(x, topY + 3, step(timber, 2));
    surface.setHex(x, topY + 4, step(timber, 1));
  }
  // rope + bucket
  for (let k = 0; k < 14; k++) surface.setHex(Math.round(c.x + 1), topY + 5 + k, step(P.RAMPS.earth, 3));
  for (let by = 0; by < 7; by++) {
    for (let bx = -4; bx <= 4; bx++) {
      const w = 4 - Math.abs(by - 3) * 0.3;
      if (Math.abs(bx) > w) continue;
      surface.setHex(Math.round(c.x + 1 + bx), topY + 19 + by,
        step(timber, bx < 0 ? 4 : bx < 2 ? 3 : 1));
    }
  }
  T.aoBand(surface, Math.round(c.x), Math.round(c.y + ry), 2, 0.3);

  derived.blocked.push({ tx: cx - r, ty: cy - r, w: r * 2, d: r * 2 });
  derived.examinables.push({
    x: Math.round(c.x), y: Math.round(c.y + ry), key: s.key || 'plaza-well',
    label: s.label || 'The public well',
  });
  if (out) mergeDerived(out, derived);
  return derived;
}

// ---------------------------------------------------------------------------
// MODULE: PELOURINHO  (the pillory — every Portuguese praça had one)
// ---------------------------------------------------------------------------
function pelourinho(surface, iso, spec, out) {
  const s = spec;
  const derived = { blocked: [], doors: [], lights: [], examinables: [] };
  const stone = P.RAMPS.stone;
  const c = iso.toScreen(s.tx, s.ty, 0);
  const rx = 0.55 * iso.tileWidth, ry = 0.55 * iso.tileHeight;
  const H = s.height || 58;

  surface.fillPoly(ellipsePts(c.x + 9, c.y + 5, rx * 1.1, ry * 1.1, 16), (u, v, x, y) => {
    T.shadePixel(surface, x, y, T.checker2(x, y) ? 0.36 : 0.20); return null;
  });
  // three stepped octagonal plinths
  for (let tier = 0; tier < 3; tier++) {
    const k = 1 - tier * 0.26;
    for (let v = 0; v < 4; v++) {
      surface.fillPoly(ellipsePts(c.x, c.y - tier * 4 - v, rx * k, ry * k, 8), (uu, vv, x, y) => {
        const dx = (x + 0.5 - c.x) / (rx * k);
        return step(stone, v === 3 ? 4 : dx < -0.2 ? 3 : dx < 0.35 ? 2 : 1);
      });
    }
  }
  // shaft
  const base = c.y - 12;
  for (let v = 0; v < H; v++) {
    for (let dx = -4; dx <= 4; dx++) {
      const taper = Math.abs(dx) > 4 - Math.floor(v / 30) ? null : 1;
      if (!taper) continue;
      let sIdx = dx < -1 ? 4 : dx < 2 ? 3 : 1;
      if ((v % 9) === 0) sIdx -= 1;
      surface.setHex(Math.round(c.x + dx), base - v, step(stone, sIdx));
    }
  }
  // capital + iron ring + a small cross finial
  for (let v = H; v < H + 5; v++) {
    for (let dx = -6; dx <= 6; dx++) {
      surface.setHex(Math.round(c.x + dx), base - v, step(stone, v === H + 4 ? 4 : dx < 0 ? 3 : 2));
    }
  }
  const brass = P.ACCENTS['brass-gold'];
  for (let dx = -5; dx <= 5; dx++) surface.setHex(Math.round(c.x + dx), base - H + 8, brass);
  for (let v = H + 5; v < H + 13; v++) surface.setHex(Math.round(c.x), base - v, step(stone, 4));
  for (let dx = -3; dx <= 3; dx++) surface.setHex(Math.round(c.x + dx), base - H - 9, step(stone, 4));

  derived.blocked.push({ tx: s.tx - 0.5, ty: s.ty - 0.5, w: 1, d: 1 });
  derived.examinables.push({
    x: Math.round(c.x), y: Math.round(c.y), key: s.key || 'pelourinho',
    label: s.label || 'The pelourinho',
  });
  if (out) mergeDerived(out, derived);
  return derived;
}

// ---------------------------------------------------------------------------
// MODULE: STONE STAIR (street -> higher ground, e.g. the climb to St Paul's)
// ---------------------------------------------------------------------------
function stair(surface, iso, spec, out) {
  const s = spec;
  const derived = { blocked: [], doors: [], lights: [], examinables: [] };
  const stone = P.RAMPS.stone;
  const steps = s.steps || 6;
  const riseEach = s.riseEach || 4;
  const w = s.w || 2;
  for (let i = 0; i < steps; i++) {
    const z = i * riseEach;
    const ty = s.ty - i * (s.depthEach || 0.4);
    // tread
    const reg = iso.region(s.tx, ty, w, s.depthEach || 0.4, z);
    surface.fillPara(reg.o, reg.eu, reg.ev, (u, v, x, y) => step(stone, i % 2 ? 4 : 3), reg);
    // riser
    const f = iso.face({ tx: s.tx, ty: ty + (s.depthEach || 0.4) }, { tx: s.tx + w, ty: ty + (s.depthEach || 0.4) }, riseEach, z);
    drawFace(surface, f, T.ashlar({ material: 'stone', light: 2, blockW: 9, blockH: 4, seed: 60 + i }));
  }
  derived.walkableOverride = { tx: s.tx, ty: s.ty - steps * (s.depthEach || 0.4), w, d: steps * (s.depthEach || 0.4) + 0.4 };
  if (out) mergeDerived(out, derived);
  return derived;
}

// ---------------------------------------------------------------------------
// MODULE: DISTANT ROOFLINE  (background silhouette plane, benchmark #6)
// ---------------------------------------------------------------------------
function distantRoofline(surface, iso, spec, out) {
  const s = spec;
  const derived = { blocked: [], doors: [], lights: [], examinables: [] };
  const baseY = s.baseY;              // screen y the distant blocks stand on
  const minH = s.minH === undefined ? 10 : s.minH;
  const maxH = s.maxH === undefined ? 24 : s.maxH;
  const x0 = s.x0 === undefined ? 0 : s.x0;
  const x1 = s.x1 === undefined ? surface.width : s.x1;
  const haze = s.haze === undefined ? 0.42 : s.haze;
  const seed = s.seed || 71;
  const wallHex = T.hazed(P.RAMPS[s.wall || 'whitewash'][2], haze);
  const wallHex2 = T.hazed(P.RAMPS[s.wall || 'whitewash'][1], haze);
  const roofHex = T.hazed(P.RAMPS.terracotta[2], haze);
  const roofHex2 = T.hazed(P.RAMPS.terracotta[1], haze);

  let x = x0, i = 0;
  while (x < x1) {
    const w = 16 + Math.floor(hash2(i, 0, seed) * 24);
    const h = minH + Math.floor(hash2(i, 1, seed) * (maxH - minH));
    const rr = 4 + Math.floor(hash2(i, 2, seed) * 6);
    const top = baseY - h;
    for (let px = x; px < Math.min(x1, x + w); px++) {
      for (let py = top; py < baseY; py++) {
        surface.setHex(px, py, (px - x) < w * 0.55 ? wallHex : wallHex2);
      }
    }
    // simple hipped silhouette + a 1px lit ridge so the band still reads as roofs
    for (let k = 0; k < rr; k++) {
      const inset = Math.round(k * (w / (rr * 2.4)));
      for (let px = x + inset; px < Math.min(x1, x + w - inset); px++) {
        surface.setHex(px, top - k, (px - x) < w * 0.5 ? roofHex : roofHex2);
      }
    }
    x += w - 1 - Math.floor(hash2(i, 3, seed) * 3);
    i++;
  }
  if (out) mergeDerived(out, derived);
  return derived;
}

// ---------------------------------------------------------------------------
function ellipsePts(cx, cy, rx, ry, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function mergeDerived(out, d) {
  ['blocked', 'doors', 'lights', 'examinables'].forEach((k) => {
    if (d[k] && d[k].length) out[k] = (out[k] || []).concat(d[k]);
  });
  return out;
}

module.exports = {
  M, townhouse, arcade, well, pelourinho, stair, distantRoofline, roof,
  doorway, window_, stringCourse, interiorShader, archTopV, ellipsePts, mergeDerived,
};
