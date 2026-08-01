'use strict';
/**
 * MELAKA FORGE — KIT: MALAY KAMPUNG ARCHITECTURE
 * ==============================================
 * The *rumah Melayu*: a timber house lifted clear of the ground on piles, with
 * a steep attap roof, walls of plank or woven bamboo (*kelarai*), a covered
 * verandah (*serambi*) and a ladder or short flight of steps up to the door.
 *
 * WHAT THE OLD PLATE GOT WRONG (art-critic defect #3, kampung)
 * The shipping kampung plate draws stilt houses roughly the height of the
 * player: piles about 8px, a body about 20px. A real one is:
 *
 *   piles          26 px   (clear of flood, snakes and the monsoon)
 *   floor beam      5 px
 *   wall            36 px  (head height inside, so a 32px player fits)
 *   roof rise       34 px  (steep, because it rains 2.5 m a year here)
 *   TOTAL         ~100 px  == 3.1 players. A landmark, not a kennel.
 *
 * The other identity carriers, in order of how much they matter at 3x:
 *   1. the roof OVERHANG — a metre of eave all round, deeply shadowing the wall
 *   2. the pile line, and the dark void you can see UNDER the house
 *   3. the ladder / anjung steps, which say "you enter here"
 *   4. the woven wall texture, distinct from Portuguese plaster at a glance
 *   5. crossed bargeboards at the gable apex (*silang gunting*)
 */

const P = require('../palette.cjs');
const T = require('../texture.cjs');
const { drawFace, hash2 } = require('../iso.cjs');
const { def } = require('./registry.cjs');
const { hull } = require('./arch-dock.cjs');
const {
  ellipsePts, contactShadow, footprintRim, isoBox, isoCyl, post, cloth, lineTo, clamp,
} = require('./primitives.cjs');

const step = T.step;

const M = {
  PILE: 26,
  FLOOR: 5,
  WALL: 36,
  RISE: 34,
  DOOR_W: 18,
  DOOR_H: 30,
};

// ---------------------------------------------------------------------------
// ATTAP ROOF
// ---------------------------------------------------------------------------
/**
 * A steep thatched roof over a tile footprint. Modelled on arch-portuguese's
 * `roof` but with palm thatch instead of pan tiles, a much bigger overhang, and
 * the sagging, layered eave line that thatch always has.
 */
function attapRoof(surface, iso, s) {
  const o = s.overhang === undefined ? 0.42 : s.overhang;
  const z = s.z;
  const rise = s.rise === undefined ? M.RISE : s.rise;
  const seed = s.seed || 1;
  const x0 = s.tx - o, x1 = s.tx + s.w + o;
  const y0 = s.ty - o, y1 = s.ty + s.d + o;
  const S = (tx, ty, zz) => iso.toScreen(tx, ty, zz);
  const tw = iso.tileWidth;
  const type = s.type || 'gable';
  const axis = s.ridgeAxis || (s.w >= s.d ? 'tx' : 'ty');

  const litTex = T.attap({ light: 3, seed, course: s.course || 7 });
  const shadeTex = T.attap({ light: 1, seed: seed + 1, course: s.course || 7 });

  function quad(pts, tex, uLen, vLen) {
    surface.fillPoly(pts, tex, {
      o: pts[0],
      eu: { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y },
      ev: { x: pts[3].x - pts[0].x, y: pts[3].y - pts[0].y },
      uLen, vLen,
    });
  }
  function tri(pts, tex, uLen, vLen) {
    surface.fillPoly(pts, tex, {
      o: pts[0],
      eu: { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y },
      ev: { x: pts[2].x - pts[0].x, y: pts[2].y - pts[0].y },
      uLen, vLen,
    });
  }

  let ridge = null;
  if (axis === 'tx') {
    const my = (y0 + y1) / 2;
    const inset = type === 'hip' ? Math.min((y1 - y0) / 2, (x1 - x0) / 2 - 0.05) : 0;
    const R0 = S(x0 + inset, my, z + rise);
    const R1 = S(x1 - inset, my, z + rise);
    quad([S(x0, y1, z), S(x1, y1, z), R1, R0], litTex, (x1 - x0) * tw, ((y1 - y0) / 2) * tw * 0.9);
    if (type === 'hip') {
      tri([S(x1, y1, z), S(x1, y0, z), R1], shadeTex, (y1 - y0) * tw, rise * 1.4);
    } else {
      // gable end: vertical boarding in shade, then the crossed bargeboards
      tri([S(x1, y1, z), S(x1, y0, z), S(x1, my, z + rise)],
        T.plank({ material: 'timber', light: 1, plankW: 4, seed: seed + 4 }), (y1 - y0) * tw, rise);
      gableFinial(surface, S(x1, my, z + rise), S(x1, y1, z), S(x1, y0, z), seed);
    }
    ridge = [R0, R1];
  } else {
    const mx = (x0 + x1) / 2;
    const inset = type === 'hip' ? Math.min((x1 - x0) / 2, (y1 - y0) / 2 - 0.05) : 0;
    const R0 = S(mx, y0 + inset, z + rise);
    const R1 = S(mx, y1 - inset, z + rise);
    quad([S(x1, y0, z), S(x1, y1, z), R1, R0], shadeTex, (y1 - y0) * tw, ((x1 - x0) / 2) * tw * 0.9);
    if (type === 'hip') {
      tri([S(x1, y1, z), S(x0, y1, z), R1], litTex, (x1 - x0) * tw, rise * 1.4);
    } else {
      tri([S(x1, y1, z), S(x0, y1, z), S(mx, y1, z + rise)],
        T.plank({ material: 'timber', light: 3, plankW: 4, seed: seed + 4 }), (x1 - x0) * tw, rise);
      gableFinial(surface, S(mx, y1, z + rise), S(x1, y1, z), S(x0, y1, z), seed);
    }
    ridge = [R0, R1];
  }

  // ridge: a bound roll of thatch, lighter on top with a dark under-line
  if (ridge) {
    const [a, b] = ridge;
    const n = Math.max(1, Math.round(Math.abs(b.x - a.x)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);
      surface.setHex(x, y - 2, step(P.RAMPS.timber, 4));
      surface.setHex(x, y - 1, step(P.RAMPS.timber, 3));
      surface.setHex(x, y, step(P.RAMPS.timber, 1));
      if ((i % 9) === 0) { surface.setHex(x, y - 1, step(P.RAMPS.earth, 1)); surface.setHex(x, y, step(P.RAMPS.earth, 1)); }
    }
  }

  // eave: thatch hangs in a ragged, layered lip and throws a deep shadow
  const eaves = [[S(x0, y1, z), S(x1, y1, z)], [S(x1, y1, z), S(x1, y0, z)]];
  eaves.forEach(([a, b], k) => {
    const n = Math.max(1, Math.round(Math.abs(b.x - a.x)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);
      const jag = Math.floor(hash2(Math.floor(x / 3), k, seed + 7) * 3);
      for (let v = 0; v < 2 + jag; v++) {
        surface.setHex(x, y + v, step(P.RAMPS.timber, v === 0 ? (k ? 1 : 2) : 0));
      }
      T.shadePixel(surface, x, y + 3 + jag, 0.44);
      T.shadePixel(surface, x, y + 4 + jag, 0.26);
      T.shadePixel(surface, x, y + 5 + jag, 0.12);
    }
  });
}

/** Crossed bargeboards at a gable apex — the *silang gunting*. */
function gableFinial(surface, apex, a, b, seed) {
  const tim = P.RAMPS.timber;
  [[a, 4], [b, 1]].forEach(([p, idx]) => {
    lineTo(surface, apex.x, apex.y, p.x, p.y, step(tim, idx), { thickness: 2 });
  });
  // the two boards crossing and projecting past the ridge
  const dx = Math.sign(a.x - b.x) || 1;
  for (let k = 0; k < 9; k++) {
    surface.setHex(Math.round(apex.x) - dx * k, Math.round(apex.y) - 4 - k, step(tim, 4));
    surface.setHex(Math.round(apex.x) + dx * k, Math.round(apex.y) - 4 - k, step(tim, 2));
  }
  if (seed !== undefined) { /* deterministic by construction */ }
}

// ---------------------------------------------------------------------------
// STILT HOUSE
// ---------------------------------------------------------------------------
def('stilt-house', { collide: false, examine: 'A rumah panggung on ironwood piles; the shade beneath it is the family\'s workshop.' }, (s, iso, o) => {
  const seed = o.seed || 1;
  const w = o.w || 2.6, d = o.d || 2.2;
  const pileH = o.pileH === undefined ? M.PILE : o.pileH;
  const wallH = o.wallH === undefined ? M.WALL : o.wallH;
  const floorZ = pileH + M.FLOOR;
  const tim = P.RAMPS.timber;

  // --- ground shadow: a house on piles casts a big soft pool -------------
  T.castShadow(s, iso.footprintPoly(o.tx - 0.2, o.ty - 0.2, w + 0.4, d + 0.4, 0),
    { x: Math.round((floorZ + wallH) * 0.4), y: Math.round((floorZ + wallH) * 0.2) }, 0.42);

  // --- the dark void under the house ------------------------------------
  // This is what sells "lifted off the ground": a solid band of shadow between
  // the pile line and the floor beams, not a gap you can see grass through.
  const under = iso.footprintPoly(o.tx, o.ty, w, d, 0).map((p) => ({ x: p.x, y: p.y }));
  s.fillPoly(under, (u, v, x, y) => {
    T.shadePixel(s, x, y, T.checker2(x, y) ? 0.52 : 0.36); return null;
  });

  // --- piles -------------------------------------------------------------
  const nx = Math.max(2, Math.round(w / 0.85)), ny = Math.max(2, Math.round(d / 0.85));
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const edge = i === 0 || j === 0 || i === nx || j === ny;
      if (!edge && (i + j) % 2) continue;
      const px = o.tx + (i / nx) * w, py = o.ty + (j / ny) * d;
      const c = iso.toScreen(px, py, 0);
      const back = (i + j) < (nx + ny) * 0.45;
      // stone pad under each pile
      for (let k = -4; k <= 4; k++) {
        s.setHex(Math.round(c.x) + k, Math.round(c.y), step(P.RAMPS.stone, k < 0 ? 3 : 1));
        s.setHex(Math.round(c.x) + k, Math.round(c.y) - 1, step(P.RAMPS.stone, k < 0 ? 4 : 2));
      }
      for (let v = 2; v < pileH; v++) {
        for (let k = -2; k <= 2; k++) {
          let idx = k < -0.5 ? 4 : k < 1.5 ? 3 : 1;
          if (back) idx -= 2;
          s.setHex(Math.round(c.x) + k, Math.round(c.y) - 1 - v, step(tim, clamp(idx, 0, 4)));
        }
      }
    }
  }

  // --- floor beams -------------------------------------------------------
  const A = { tx: o.tx, ty: o.ty }, B = { tx: o.tx + w, ty: o.ty };
  const C = { tx: o.tx + w, ty: o.ty + d }, D = { tx: o.tx, ty: o.ty + d };
  const beamLit = iso.face(D, C, M.FLOOR, pileH);
  const beamSh = iso.face(C, B, M.FLOOR, pileH);
  drawFace(s, beamLit, T.plank({ material: 'timber', light: 4, plankW: 22, seed }));
  drawFace(s, beamSh, T.plank({ material: 'timber', light: 2, plankW: 22, seed: seed + 1 }));

  // --- walls -------------------------------------------------------------
  const fLit = iso.face(D, C, wallH, floorZ);
  const fSh = iso.face(C, B, wallH, floorZ);
  const wallTex = o.wallTexture === 'plank'
    ? [T.plank({ material: 'timber', light: 3, plankW: 5, seed: seed + 2 }),
      T.plank({ material: 'timber', light: 1, plankW: 5, seed: seed + 3 })]
    : [T.woven({ light: 3, seed: seed + 2, strip: 4 }),
      T.woven({ light: 1, seed: seed + 3, strip: 4 })];
  drawFace(s, fLit, wallTex[0]);
  drawFace(s, fSh, wallTex[1]);

  // corner post + arris
  {
    const c = iso.toScreen(C.tx, C.ty, floorZ);
    for (let v = 0; v < wallH; v++) {
      s.setHex(Math.round(c.x) - 2, Math.round(c.y) - 1 - v, step(tim, 4));
      s.setHex(Math.round(c.x) - 1, Math.round(c.y) - 1 - v, step(tim, 3));
      s.setHex(Math.round(c.x), Math.round(c.y) - 1 - v, step(tim, 0));
    }
  }

  // --- door + shuttered windows on the lit face --------------------------
  const x0 = Math.round(fLit.p0.x);
  const du = clamp(Math.round(fLit.lenPx * (o.doorAt === undefined ? 0.5 : o.doorAt) - M.DOOR_W / 2), 4, fLit.lenPx - M.DOOR_W - 4);
  for (let u = du - 2; u < du + M.DOOR_W + 2; u++) {
    if (u < 0 || u >= fLit.lenPx) continue;
    const baseY = fLit.baseYAt(u + 0.5);
    const inSpan = u >= du && u < du + M.DOOR_W;
    for (let v = 0; v < M.DOOR_H + 2; v++) {
      const y = baseY - 1 - v;
      if (inSpan && v < M.DOOR_H) {
        const lu = u - du;
        if (o.doorLit) {
          const dd = Math.hypot((lu - M.DOOR_W * 0.5) * 1.1, (v - M.DOOR_H * 0.4) * 1.2);
          s.setHex(u + x0, y, dd < 4 ? P.ACCENTS['lantern-flame'] : dd < 9 ? step(P.RAMPS.terracotta, 2) : dd < 15 ? P.ANCHORS['shadow-violet'] : P.ANCHORS['shadow-void']);
        } else {
          s.setHex(u + x0, y, v < 3 ? step(tim, 1) : P.ANCHORS['shadow-void']);
        }
      } else if (v < M.DOOR_H + 2) {
        s.setHex(u + x0, y, step(tim, v >= M.DOOR_H ? 4 : (u < du ? 3 : 1)));
      }
    }
  }
  // windows: two per face, low sills (people sit on the floor), timber shutters
  [[fLit, floorZ, 0], [fSh, floorZ, 1]].forEach(([f, fz, side]) => {
    const n = Math.max(1, Math.floor(f.lenPx / 34));
    for (let i = 0; i < n; i++) {
      const wu = Math.round((i + 0.72) * (f.lenPx / (n + 0.5)) - 7);
      if (wu < 4 || wu + 14 > f.lenPx - 4) continue;
      if (side === 0 && wu < du + M.DOOR_W + 3 && wu + 14 > du - 3) continue;
      const fx0 = Math.round(f.p0.x);
      for (let u = wu; u < wu + 14; u++) {
        const baseY = f.baseYAt(u + 0.5);
        for (let v = 8; v < 26; v++) {
          const lu = u - wu;
          const lit = o.litWindows && side === 0 && hash2(i, side, seed) > 0.45;
          let c;
          if (lu < 4 || lu >= 10) {
            c = step(tim, (lu < 4 ? 3 : 1) - ((v % 4) === 0 ? 1 : 0));   // louvred shutter
          } else {
            c = lit ? P.ACCENTS['lantern-flame'] : P.ANCHORS['shadow-void'];
          }
          s.setHex(fx0 + u, baseY - 1 - v, c);
        }
        s.setHex(fx0 + u, baseY - 1 - 7, step(tim, 4));      // sill
        s.setHex(fx0 + u, baseY - 1 - 26, step(tim, side ? 1 : 2));
        T.shadePixel(s, fx0 + u, baseY - 1 - 6, 0.3);
      }
    }
  });

  footprintRim(s, iso, o.tx, o.ty, w, d, { strength: 0.82, anchor: 'shadow-void' });

  attapRoof(s, iso, {
    tx: o.tx, ty: o.ty, w, d, z: floorZ + wallH,
    type: o.roofType || 'gable', ridgeAxis: o.ridgeAxis || 'tx',
    rise: o.rise === undefined ? M.RISE : o.rise,
    overhang: o.overhang, seed: seed + 20,
  });

  // --- the steps up to the door ------------------------------------------
  if (o.steps !== false) {
    const doorPt = fLit.at(du + M.DOOR_W / 2, 0);
    const sx = Math.round(doorPt.x), sy = Math.round(doorPt.y);
    const nS = Math.max(3, Math.round(floorZ / 7));
    for (let i = 0; i < nS; i++) {
      const wdt = 13 - Math.floor(i * 0.4);
      const y = sy + Math.round((i + 1) * (floorZ / nS)) - 1;
      const xx = sx - Math.round(wdt / 2) - Math.round(i * 1.5);
      for (let k = 0; k < wdt; k++) {
        s.setHex(xx + k, y, step(tim, 4));
        s.setHex(xx + k, y + 1, step(tim, 2));
        s.setHex(xx + k, y + 2, step(tim, 0));
      }
    }
    T.aoBand(s, sx, sy + floorZ + 3, 3, 0.4);
  }
});

/** A bamboo picket fence along a tile segment. */
def('kampung-fence', { collide: false, examine: 'A bamboo fence, lashed with rattan and mended a dozen times.' }, (s, iso, o) => {
  const seed = o.seed || 13;
  const a = iso.toScreen(o.tx, o.ty, 0);
  const b = o.axis === 'tx' ? iso.toScreen(o.tx + o.len, o.ty, 0)
    : o.axis === 'ty' ? iso.toScreen(o.tx, o.ty + o.len, 0)
      : iso.toScreen(o.tx + o.len, o.ty - o.len, 0);
  const n = Math.max(2, Math.round(Math.abs(b.x - a.x) / 5));
  const H = o.h || 20;
  const fol = P.RAMPS.foliage, tim = P.RAMPS.timber;
  // rails first
  [0.35, 0.72].forEach((f) => {
    lineTo(s, a.x, a.y - H * f, b.x, b.y - H * f, step(tim, 2), { thickness: 2 });
  });
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(a.x + (b.x - a.x) * t);
    const y = Math.round(a.y + (b.y - a.y) * t);
    const hh = H - Math.round(hash2(i, 0, seed) * 4);
    const lean = hash2(i, 1, seed) < 0.16 ? 1 : 0;
    for (let v = 0; v < hh; v++) {
      const xx = x + Math.round(lean * (v / hh) * 2);
      s.setHex(xx, y - v, step(fol, 1));
      s.setHex(xx + 1, y - v, step(fol, 3));
      if ((v % 7) === 0) s.setHex(xx + 1, y - v, step(fol, 1));
    }
    s.setHex(x + 1, y - hh, step(fol, 4));
    T.shadePixel(s, x + 2, y + 1, 0.28);
  }
});

/** Bamboo drying rack with sarongs and kain hung out. */
def('drying-rack', { collide: 0.7, examine: 'Sarong and kain drying on a bamboo pole, stiff with salt.' }, (s, iso, o) => {
  const seed = o.seed || 17;
  contactShadow(s, iso, o.tx + 0.5, o.ty - 0.2, 0.9, 0.28);
  const H = o.h || 34;
  post(s, iso, { tx: o.tx, ty: o.ty, h: H, material: 'foliage', w: 3 });
  post(s, iso, { tx: o.tx + 1.3, ty: o.ty - 1.3, h: H, material: 'foliage', w: 3 });
  const ramps = [P.RAMPS.terracotta, P.RAMPS.foliage, P.RAMPS.water, P.RAMPS.earth];
  const a = iso.toScreen(o.tx, o.ty, 0), b = iso.toScreen(o.tx + 1.3, o.ty - 1.3, 0);
  lineTo(s, a.x, a.y - H + 2, b.x, b.y - H + 2, step(P.RAMPS.foliage, 4), { thickness: 2 });
  for (let i = 0; i < 3; i++) {
    const t = 0.14 + i * 0.3;
    cloth(s, iso, {
      ax: o.tx + 0.1 + i * 0.36, ay: o.ty - 0.1 - i * 0.36,
      bx: o.tx + 0.42 + i * 0.36, by: o.ty - 0.42 - i * 0.36,
      z: H - 3, ramp: ramps[(i + seed) % ramps.length], h: 17, sag: 2, seed: seed + i,
    });
    if (t > 1) break;
  }
});

/** An open cooking fire: stone hearth, logs, flame, a blackened pot on a tripod. */
def('cook-fire', {
  collide: 0.5, light: { type: 'fire', radius: 58 },
  examine: 'A cooking fire under a clay pot; rice, ikan bilis and a great deal of smoke.',
}, (s, iso, o) => {
  const seed = o.seed || 19;
  const c = iso.toScreen(o.tx, o.ty, 0);
  contactShadow(s, iso, o.tx, o.ty, 0.85, 0.30);
  // hearth stones
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const px = c.x + Math.cos(a) * 11, py = c.y + Math.sin(a) * 5.5;
    s.fillPoly(ellipsePts(px, py, 3.4, 2.4, 12), (uu, vv, x, y) => {
      const dx = (x + 0.5 - px) / 3.4;
      return step(P.RAMPS.stone, dx < -0.3 ? 4 : dx < 0.3 ? 3 : 1);
    });
  }
  // ash bed + embers
  s.fillPoly(ellipsePts(c.x, c.y, 8, 4, 18), (uu, vv, x, y) =>
    hash2(x >> 1, y >> 1, seed) > 0.72 ? P.ACCENTS['flag-crimson'] : step(P.RAMPS.stone, 1));
  // logs
  [[-7, 2, 3], [5, -1, 1]].forEach(([dx, dy, idx]) => {
    for (let k = 0; k < 11; k++) s.setHex(Math.round(c.x + dx + k * (dx < 0 ? 1 : -1) * 0.9), Math.round(c.y + dy - k * 0.2), step(P.RAMPS.timber, idx));
  });
  // flame: three tongues, clustered, never a speckle field
  const flame = P.ACCENTS['lantern-flame'];
  [[0, 12], [-4, 8], [4, 7]].forEach(([dx, fh], i) => {
    for (let v = 0; v < fh; v++) {
      const wdt = Math.max(1, Math.round(2.6 * (1 - v / fh)));
      for (let k = -wdt; k <= wdt; k++) {
        s.setHex(Math.round(c.x + dx + Math.sin(v * 0.5 + i) * 1.2) + k, Math.round(c.y) - 2 - v,
          v > fh * 0.6 ? flame : (k < 0 ? flame : P.ACCENTS['flag-crimson']));
      }
    }
  });
  // tripod + pot
  [[-11, 4], [11, 3], [0, -6]].forEach(([dx, dy]) => {
    lineTo(s, c.x + dx, c.y + dy, c.x, c.y - 20, step(P.RAMPS.timber, dx < 0 ? 4 : 1));
  });
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.42, h: 9, z: 20, material: 'stone', seed, profile: (t) => 0.62 + 0.55 * Math.sin(Math.PI * clamp(t * 0.9 + 0.06, 0, 1)) });
});

/** A small surau / prayer house: square plan, two-tier pyramidal attap roof. */
def('surau', { collide: false, examine: 'The kampung surau. Its drum calls the village to prayer five times a day.' }, (s, iso, o) => {
  const seed = o.seed || 23;
  const w = o.w || 2.4, d = o.d || 2.4;
  const pileH = o.pileH === undefined ? 16 : o.pileH;
  const wallH = o.wallH === undefined ? 40 : o.wallH;
  const floorZ = pileH + 5;
  const tim = P.RAMPS.timber;

  T.castShadow(s, iso.footprintPoly(o.tx, o.ty, w, d, 0), { x: 30, y: 15 }, 0.42);
  s.fillPoly(iso.footprintPoly(o.tx, o.ty, w, d, 0), (u, v, x, y) => {
    T.shadePixel(s, x, y, T.checker2(x, y) ? 0.5 : 0.34); return null;
  });
  // piles
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) {
    if ((i + j) % 2 && !(i === 0 || j === 0 || i === 3 || j === 3)) continue;
    const c = iso.toScreen(o.tx + (i / 3) * w, o.ty + (j / 3) * d, 0);
    for (let v = 0; v < pileH; v++) {
      for (let k = -2; k <= 2; k++) s.setHex(Math.round(c.x) + k, Math.round(c.y) - 1 - v, step(P.RAMPS.stone, k < 0 ? 3 : 1));
    }
  }
  const A = { tx: o.tx, ty: o.ty }, B = { tx: o.tx + w, ty: o.ty };
  const C = { tx: o.tx + w, ty: o.ty + d }, D = { tx: o.tx, ty: o.ty + d };
  drawFace(s, iso.face(D, C, 5, pileH), T.plank({ material: 'timber', light: 4, plankW: 20, seed }));
  drawFace(s, iso.face(C, B, 5, pileH), T.plank({ material: 'timber', light: 2, plankW: 20, seed }));
  drawFace(s, iso.face(D, C, wallH, floorZ), T.plank({ material: 'timber', light: 3, plankW: 6, seed: seed + 1 }));
  drawFace(s, iso.face(C, B, wallH, floorZ), T.plank({ material: 'timber', light: 1, plankW: 6, seed: seed + 2 }));

  // carved fretwork band under the eaves, and a tall arched opening
  const f = iso.face(D, C, wallH, floorZ);
  const x0 = Math.round(f.p0.x);
  for (let u = 0; u < f.lenPx; u++) {
    const baseY = f.baseYAt(u + 0.5);
    for (let v = wallH - 8; v < wallH - 2; v++) {
      const on = ((u + v) % 6) < 3;
      s.setHex(x0 + u, baseY - 1 - v, on ? step(tim, 4) : P.ANCHORS['shadow-violet']);
    }
  }
  const au = Math.round(f.lenPx * 0.5) - 9;
  for (let u = au; u < au + 18; u++) {
    if (u < 0 || u >= f.lenPx) continue;
    const baseY = f.baseYAt(u + 0.5);
    const r = 9, dx = u - (au + r);
    const top = 20 + Math.sqrt(Math.max(0, r * r - dx * dx));
    for (let v = 0; v < top; v++) s.setHex(x0 + u, baseY - 1 - v, v < 2 ? step(tim, 1) : P.ANCHORS['shadow-void']);
    for (let k = 0; k < 2; k++) s.setHex(x0 + u, baseY - 1 - Math.floor(top + k), step(tim, 4));
  }

  footprintRim(s, iso, o.tx, o.ty, w, d, { strength: 0.80, anchor: 'shadow-void' });
  // two-tier pyramidal roof
  attapRoof(s, iso, { tx: o.tx, ty: o.ty, w, d, z: floorZ + wallH, type: 'hip', ridgeAxis: 'tx', rise: 16, overhang: 0.5, seed: seed + 5, course: 6 });
  attapRoof(s, iso, { tx: o.tx + w * 0.18, ty: o.ty + d * 0.18, w: w * 0.64, d: d * 0.64, z: floorZ + wallH + 20, type: 'hip', ridgeAxis: 'tx', rise: 20, overhang: 0.3, seed: seed + 9, course: 6 });
  // finial
  const cTop = iso.toScreen(o.tx + w / 2, o.ty + d / 2, floorZ + wallH + 42);
  for (let v = 0; v < 12; v++) s.setHex(Math.round(cTop.x), Math.round(cTop.y) - v, step(P.RAMPS.timber, 4));
  for (let k = -3; k <= 3; k++) s.setHex(Math.round(cTop.x) + k, Math.round(cTop.y) - 8, P.ACCENTS['brass-gold']);
});

/** A beached perahu / sampan pulled up above the tideline (no reflection). */
def('perahu-beached', { collide: 0.9, examine: 'A perahu hauled above the tideline, her seams freshly payed with damar.' }, (s, iso, o) => {
  const c = iso.toScreen(o.tx, o.ty, 0);
  const len = o.len || 56;
  contactShadow(s, iso, o.tx, o.ty, 1.8, 0.34);
  hull(s, Math.round(c.x - len / 2), Math.round(c.y), {
    len, topsides: o.topsides || 12, bowRise: 9, sternRise: 7,
    facing: o.facing === undefined ? 1 : o.facing,
    material: 'timber', trim: 'earth', seed: o.seed || 43, draft: 2, reflect: 0,
    frames: false, inboard: true,
  });
  // rollers and a paddle leaning on the hull
  for (let i = 0; i < 2; i++) {
    const rx = Math.round(c.x - len * 0.2 + i * len * 0.4);
    for (let k = -9; k <= 9; k++) s.setHex(rx + k, Math.round(c.y) + 2, step(P.RAMPS.timber, k < 0 ? 3 : 1));
  }
  lineTo(s, c.x + len * 0.32, c.y + 2, c.x + len * 0.44, c.y - 20, step(P.RAMPS.timber, 3), { thickness: 2 });
});

/** A clump of bamboo — vertical accent, reads instantly as South-East Asia. */
def('bamboo-clump', { collide: 0.6, examine: 'A clump of buluh; the whole kampung is built and cooked with it.' }, (s, iso, o) => {
  const seed = o.seed || 27;
  contactShadow(s, iso, o.tx, o.ty, 0.8, 0.30);
  const fol = P.RAMPS.foliage;
  const n = o.count || 7;
  for (let i = 0; i < n; i++) {
    const c = iso.toScreen(o.tx + (hash2(seed, i, 3) - 0.5) * 0.7, o.ty + (hash2(seed, i, 5) - 0.5) * 0.5, 0);
    const H = Math.round((o.h || 54) * (0.6 + hash2(seed, i, 7) * 0.6));
    const lean = (hash2(seed, i, 11) - 0.5) * 9;
    const lit = i % 2 === 0;
    for (let v = 0; v < H; v++) {
      const t = v / H;
      const x = Math.round(c.x + lean * t * t);
      s.setHex(x, Math.round(c.y) - 1 - v, step(fol, lit ? 4 : 2));
      s.setHex(x + 1, Math.round(c.y) - 1 - v, step(fol, lit ? 3 : 1));
      if ((v % 11) === 0) { s.setHex(x, Math.round(c.y) - 1 - v, step(fol, 1)); s.setHex(x + 1, Math.round(c.y) - 1 - v, step(fol, 1)); }
      // leaf sprays off the upper nodes
      if (v > H * 0.55 && (v % 11) === 1) {
        const dir = (i % 2) ? 1 : -1;
        for (let k = 1; k < 8; k++) {
          s.setHex(x + dir * k, Math.round(c.y) - 1 - v - Math.round(k * 0.6), step(fol, lit ? 4 : 2));
          if (k < 5) s.setHex(x + dir * k, Math.round(c.y) - v - Math.round(k * 0.6), step(fol, lit ? 3 : 1));
        }
      }
    }
  }
});

/** Rolled pandan mats and a rice mortar — the small change of a village yard. */
def('mat-rolls', { collide: 0.5, examine: 'Rolled pandan mats and a rice mortar worn smooth on the inside.' }, (s, iso, o) => {
  const seed = o.seed || 29;
  contactShadow(s, iso, o.tx + 0.2, o.ty + 0.2, 0.7, 0.32);
  const earth = P.RAMPS.earth;
  for (let i = 0; i < 3; i++) {
    const c = iso.toScreen(o.tx + i * 0.12, o.ty + i * 0.06, i * 6);
    for (let k = -11; k <= 11; k++) {
      const t = Math.abs(k) / 11;
      const hh = Math.round(3.2 * Math.sqrt(Math.max(0, 1 - t * t * 0.6)));
      for (let v = -hh; v <= hh; v++) {
        let idx = v < -hh * 0.3 ? 4 : v < hh * 0.4 ? 3 : 1;
        if ((k % 5) === 0) idx -= 1;
        s.setHex(Math.round(c.x) + k, Math.round(c.y) + v, step(earth, clamp(idx, 0, 4)));
      }
    }
    // the spiral end of the roll
    s.setHex(Math.round(c.x) - 11, Math.round(c.y), step(earth, 0));
    if (seed) s.setHex(Math.round(c.x) + 11, Math.round(c.y) - 1, step(earth, 4));
  }
  isoCyl(s, iso, { tx: o.tx + 0.62, ty: o.ty + 0.5, r: 0.44, h: 15, material: 'timber', seed, open: true, profile: (t) => 0.86 + 0.2 * t });
});

/** A well-head with a bucket and a wet apron — every kampung has exactly one. */
def('kampung-well', { collide: 0.7, examine: 'The village well. The apron around it is never dry.' }, (s, iso, o) => {
  const seed = o.seed || 31;
  const c = iso.toScreen(o.tx, o.ty, 0);
  // wet apron: a darker, cooler ring of ground
  s.fillPoly(ellipsePts(c.x, c.y, 26, 13, 24), (u, v, x, y) => {
    T.shadePixel(s, x, y, T.checker2(x, y) ? 0.24 : 0.12); return null;
  });
  contactShadow(s, iso, o.tx, o.ty, 0.9, 0.34);
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.75, h: 13, material: 'stone', seed, profile: () => 1 });
  // coping
  s.fillPoly(ellipsePts(c.x, c.y - 13, 12, 6, 26), (u, v, x, y) => {
    const dx = (x + 0.5 - c.x) / 12, dy = (y + 0.5 - (c.y - 13)) / 6;
    if (dx * dx + dy * dy < 0.44) return P.ANCHORS['shadow-void'];
    return step(P.RAMPS.stone, dy < -0.15 ? 4 : 3);
  });
  // bamboo frame + bucket
  [[-11, 4], [11, 1]].forEach(([dx, idx]) => {
    lineTo(s, c.x + dx, c.y - 12, c.x + dx * 0.3, c.y - 40, step(P.RAMPS.foliage, idx), { thickness: 2 });
  });
  for (let k = -6; k <= 6; k++) s.setHex(Math.round(c.x) + k, Math.round(c.y) - 40, step(P.RAMPS.foliage, k < 0 ? 4 : 1));
  lineTo(s, c.x + 2, c.y - 39, c.x + 2, c.y - 24, step(P.RAMPS.earth, 2));
  for (let v = 0; v < 7; v++) {
    for (let k = -4; k <= 4; k++) {
      if (Math.abs(k) > 4 - v * 0.3) continue;
      s.setHex(Math.round(c.x) + 2 + k, Math.round(c.y) - 24 + v, step(P.RAMPS.timber, k < 0 ? 4 : k < 2 ? 3 : 1));
    }
  }
});

module.exports = { attapRoof, M };
