'use strict';
/**
 * MELAKA FORGE — KIT: A FAMOSA (FORTIFICATION)
 * ============================================
 * The laterite curtain wall, the Porta de Santiago gatehouse, flanking towers,
 * sentry boxes and garrison guns.
 *
 * THIS IS THE ONE SCREEN THAT IS ABOUT SCALE. The art critique's defect #3 is
 * that nothing in the game is bigger than the player; here that has to be
 * conspicuously untrue in the first half second. So the canon is:
 *
 *   curtain wall        112 px   = 3.5 players
 *   gatehouse block     168 px   = 5.2 players (it BREAKS the top of the frame)
 *   gate arch opening    64 px x 42 px wide  — a horseman rides through it
 *   flanking tower      140 px
 *   merlon               13 px tall x 11 wide, embrasure 9 px
 *   plinth / batter      20 px, stepped out 3 px
 *   cannon barrel        26 px long on a 13 px carriage
 *
 * MATERIAL. A Famosa was built of LATERITE — the iron-red laterite blocks the
 * Portuguese quarried locally — so the wall runs on the `terracotta` ramp, not
 * `stone`. That is also what keeps this screen from reading as the same grey
 * as St Paul's, and it puts a warm mass against the tropical sky.
 */

const P = require('../palette.cjs');
const T = require('../texture.cjs');
const { drawFace, hash2 } = require('../iso.cjs');
const { def } = require('./registry.cjs');
const { ellipsePts, contactShadow, isoBox, isoCyl, lineTo, clamp } = require('./primitives.cjs');

const step = T.step;

const F = {
  WALL: 112,
  GATE_H: 64,
  GATE_W: 42,
  TOWER: 140,
  MERLON_H: 13,
  MERLON_W: 11,
  EMBRASURE: 9,
  PLINTH: 20,
};

/** Endpoint of a wall run authored as {tx, ty, len, axis}. */
function runEnd(o) {
  if (o.axis === 'tx') return { tx: o.tx + o.len, ty: o.ty };
  if (o.axis === 'ty') return { tx: o.tx, ty: o.ty + o.len };
  return { tx: o.tx + o.len, ty: o.ty - o.len };   // 'h' — screen-horizontal
}

/**
 * A crenellated parapet drawn along a face's top edge. Merlons alternate with
 * embrasures; each merlon gets a lit left cheek, a shadowed right cheek and a
 * capping course, because a parapet drawn as a plain comb of rectangles is the
 * single most toy-castle-looking thing you can put on a wall.
 */
function parapet(surface, f, topV, opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'terracotta'];
  const mh = o.merlonH || F.MERLON_H;
  const mw = o.merlonW || F.MERLON_W;
  const gap = o.embrasure || F.EMBRASURE;
  const pitch = mw + gap;
  const phase = o.phase || 0;
  const x0 = Math.round(f.p0.x);
  for (let u = 0; u < f.lenPx; u++) {
    const baseY = f.baseYAt(u + 0.5);
    const x = x0 + u;
    const k = (u + phase) % pitch;
    // the walkway string course under the parapet, continuous
    for (let v = topV; v < topV + 4; v++) {
      surface.setHex(x, baseY - 1 - v, step(ramp, v === topV + 3 ? 4 : v === topV ? 1 : 3));
    }
    if (k < mw) {
      const local = k / mw;
      for (let v = topV + 4; v < topV + 4 + mh; v++) {
        let idx = local < 0.34 ? 4 : local < 0.72 ? 3 : 1;
        if (hash2(Math.floor(u / mw), Math.floor((v - topV) / 5), o.seed || 3) < 0.2) idx -= 1;
        surface.setHex(x, baseY - 1 - v, step(ramp, clamp(idx, 0, 4)));
      }
      // capping stone
      surface.setHex(x, baseY - 1 - (topV + 3 + mh), step(P.RAMPS.stone, 3));
      surface.setHex(x, baseY - 1 - (topV + 4 + mh), step(P.RAMPS.terracotta, 1));
      // the shadow the merlon throws into its own embrasure, down-right
      if (k >= mw - 1) {
        for (let v = topV + 4; v < topV + 4 + Math.round(mh * 0.55); v++) {
          T.shadePixel(surface, x + 1, baseY - 1 - v, 0.34);
          T.shadePixel(surface, x + 2, baseY - 1 - v, 0.18);
        }
      }
    } else {
      // embrasure floor, sloped and in deep shade
      surface.setHex(x, baseY - 1 - (topV + 4), step(ramp, 1));
      surface.setHex(x, baseY - 1 - (topV + 5), step(ramp, 0));
    }
  }
}

/** Battered plinth: the wall thickens as it meets the ground. */
function plinth(surface, f, opts) {
  const o = opts || {};
  const ramp = P.RAMPS[o.material || 'terracotta'];
  const h = o.h || F.PLINTH;
  const x0 = Math.round(f.p0.x);
  for (let u = 0; u < f.lenPx; u++) {
    const baseY = f.baseYAt(u + 0.5);
    for (let v = 0; v < h; v++) {
      // value ramps DOWN toward the ground: the batter is in its own shade
      const t = v / h;
      let idx = (o.lit ? 3 : 1) + (t > 0.72 ? 1 : t > 0.34 ? 0 : -1);
      const block = Math.floor(u / 13), course = Math.floor(v / 6);
      if (hash2(block, course, o.seed || 5) < 0.24) idx -= 1;
      if ((v % 6) === 0) idx -= 1;
      surface.setHex(x0 + u, baseY - 1 - v, step(ramp, clamp(idx, 0, 4)));
    }
    // the chamfered top of the batter catches the sun, and the wall above it
    // is one step darker for 3px so the offset reads as a real set-back
    surface.setHex(x0 + u, baseY - 1 - h, step(P.RAMPS.stone, o.lit ? 4 : 2));
    surface.setHex(x0 + u, baseY - h, step(P.RAMPS.stone, o.lit ? 3 : 1));
    surface.setHex(x0 + u, baseY - h + 1, step(P.RAMPS.stone, 1));
    for (let k = 1; k <= 3; k++) T.shadePixel(surface, x0 + u, baseY - 2 - h - k, 0.30 * (1 - k / 4));
    // Benchmark #17: the strip of ground between the wall base and the first
    // WALKABLE row is blocked, and it was being painted in the same flagstone
    // as the plaza — so the boundary was invisible and 640px of it failed the
    // gate in one line. Lay a solid apron of the wall's own shadow across it.
    for (let k = 0; k < (o.apron === undefined ? 5 : o.apron); k++) {
      surface.setHex(x0 + u, baseY + k, step(ramp, k < 2 ? 0 : 1));
    }
    T.aoBand(surface, x0 + u, baseY + (o.apron === undefined ? 5 : o.apron) + 1, 2, 0.34);
  }
}

/**
 * A run of curtain wall, optionally pierced by the great gate.
 *
 * spec: {
 *   tx, ty, len, axis:'h'|'tx'|'ty',
 *   h,                      wall height to the walkway
 *   depth,                  tiles of rampart walk shown behind the parapet
 *   gate: { at, width, height, towerH, litLamp },
 *   towers: [{ at, h, w }], flanking towers as fractions along the run
 * }
 */
def('fortress-wall', { collide: false, examine: 'The curtain wall of A Famosa, laterite cut from the hill behind it.' }, (s, iso, o) => {
  const seed = o.seed || 11;
  const H = o.h === undefined ? F.WALL : o.h;
  const A = { tx: o.tx, ty: o.ty };
  const B = runEnd(o);
  const depth = o.depth === undefined ? 1.6 : o.depth;

  // --- rampart walk seen over the parapet (the wall has THICKNESS) --------
  {
    const pts = [
      iso.toScreen(A.tx, A.ty, H), iso.toScreen(B.tx, B.ty, H),
      iso.toScreen(B.tx - depth, B.ty - depth, H), iso.toScreen(A.tx - depth, A.ty - depth, H),
    ];
    s.fillPoly(pts, T.flagstone({ material: 'stone', light: 1, n: 1.6, seed, wear: 1 }), {
      o: pts[0],
      eu: { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y },
      ev: { x: pts[3].x - pts[0].x, y: pts[3].y - pts[0].y },
      uLen: o.len * iso.tileWidth, vLen: depth * iso.tileWidth,
    });
  }

  const f = iso.face(A, B, H, 0);
  const x0 = Math.round(f.p0.x);
  const litTex = T.ashlar({ material: 'terracotta', light: 2, blockW: 13, blockH: 7, variance: 0.52, seed });
  drawFace(s, f, litTex);

  // A 700px run of coursed blocks is the largest flat region on this plate, so
  // it gets three kinds of incident: PILASTERS (the wall is thickened at
  // intervals and each buttress catches the sun on its left and throws a hard
  // shadow to its right), a granite string course, and weathering.
  const bay = o.bay === undefined ? 152 : o.bay;
  const pilW = 21;
  for (let u = 0; u < f.lenPx; u++) {
    const baseY = f.baseYAt(u + 0.5);
    const bu = ((u + 40) % bay);
    if (bu < pilW) {
      for (let v = 0; v < H + 4; v++) {
        const block = Math.floor(bu / 13), course = Math.floor(v / 7);
        let idx = (bu < pilW * 0.58 ? 4 : 3) + (hash2(block, course, seed + 17) < 0.2 ? -1 : 0);
        if ((v % 7) === 0) idx -= 1;
        s.setHex(x0 + u, baseY - 1 - v, step(P.RAMPS.terracotta, clamp(idx, 0, 4)));
      }
    } else if (bu < pilW + 7) {
      for (let v = 0; v < H + 4; v++) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.46 * (1 - (bu - pilW) / 7));
    }
    // LATERITE IS BLOTCHY. Coursed blocks alone leave one value covering ~15%
    // of the frame (the benchmark's flat-region gate is 12%), so the wall gets
    // large weathering patches on a 57x31px lattice — the scale of a rain
    // shadow, not of a stone — which pushes about a third of the face onto the
    // neighbouring ramp step without touching the coursing.
    for (let v = 0; v < H; v++) {
      // TWO OCTAVES. The coarse one (57x31, the scale of a rain shadow) breaks
      // the wall into weathered zones; on its own it leaves whole zones of
      // untouched coursing between them, which read as brick wallpaper. The
      // fine one (23x13, the scale of a patch of repointing) breaks those up.
      const patch = hash2(Math.floor((u + v * 0.3) / 57), Math.floor(v / 31), seed + 23);
      if (patch > 0.58) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.145);
      else if (patch < 0.28) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.06);
      const fine = hash2(Math.floor((u + v * 0.6) / 23), Math.floor(v / 13), seed + 37);
      if (fine > 0.74) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.075);
      else if (fine < 0.16) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.035);
    }
    for (let k = 0; k < 3; k++) {
      s.setHex(x0 + u, baseY - 1 - (Math.round(H * 0.58) + k),
        step(P.RAMPS.stone, k === 2 ? 4 : k === 0 ? 1 : 3));
    }
    T.shadePixel(s, x0 + u, baseY - 1 - (Math.round(H * 0.58) - 1), 0.34);
    // the wall-walk corbelling throws a hard shadow across the top of the wall
    for (let k = 0; k < 6; k++) T.shadePixel(s, x0 + u, baseY - 1 - (H - 3 - k), 0.34 * (1 - k / 6));
    // putlog holes (the scaffold sockets every fort wall keeps) — 3x3, sparse
    const ph = Math.floor(u / 37);
    if ((u % 37) < 3 && hash2(ph, 0, seed + 3) > 0.35) {
      for (let v = 0; v < 3; v++) s.setHex(x0 + u, baseY - 1 - (Math.round(H * 0.30) + v), P.ANCHORS['shadow-violet']);
    }
    // weather staining running down from the parapet
    if (hash2(Math.floor(u / 9), 1, seed + 7) > 0.78) {
      for (let v = Math.round(H * 0.62); v < H; v++) {
        if ((u % 9) < 2) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.16);
      }
    }
  }

  plinth(s, f, { material: 'terracotta', lit: true, seed: seed + 1 });
  parapet(s, f, H, { material: 'terracotta', seed: seed + 2 });

  // --- the gate ----------------------------------------------------------
  if (o.gate) {
    const g = o.gate;
    const gw = g.width || F.GATE_W;
    const gh = g.height || F.GATE_H;
    const gu = clamp(Math.round(f.lenPx * (g.at === undefined ? 0.5 : g.at) - gw / 2), 20, f.lenPx - gw - 20);
    const rise = gw / 2;
    const rect = gh - rise;

    // gatehouse block: a mass standing PROUD of the curtain, both sides
    const towerH = g.towerH === undefined ? 168 : g.towerH;
    const bw = gw + 46;
    const bu = gu - 23;
    for (let u = bu; u < bu + bw; u++) {
      if (u < 0 || u >= f.lenPx) continue;
      const baseY = f.baseYAt(u + 0.5);
      const lu = u - bu;
      for (let v = 0; v < towerH; v++) {
        // 4px of returned side wall at each end, in shade, so the block reads
        // as projecting rather than as a painted panel
        const sideSh = lu > bw - 5 ? -2 : lu < 4 ? 1 : 0;
        const block = Math.floor(lu / 13), course = Math.floor(v / 7);
        let idx = 3 + sideSh + (hash2(block, course, seed + 11) < 0.22 ? -1 : 0);
        if ((v % 7) === 0 || (lu % 13) === 0) idx -= 1;
        s.setHex(x0 + u, baseY - 1 - v, step(P.RAMPS.terracotta, clamp(idx, 0, 4)));
        const patch = hash2(Math.floor((u + v * 0.3) / 57), Math.floor(v / 31), seed + 23);
        if (patch > 0.58) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.145);
        else if (patch < 0.28) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.06);
      }
      // the shadow the block throws onto the curtain to its right
      for (let k = 1; k < 7; k++) {
        for (let v = 0; v < towerH; v++) {
          if (u === bu + bw - 1) T.shadePixel(s, x0 + u + k, baseY - 1 - v, 0.40 * (1 - k / 7));
        }
      }
    }

    // arch opening: dressed voussoirs, then a tunnel that gets darker inward
    for (let u = gu - 5; u < gu + gw + 5; u++) {
      if (u < 0 || u >= f.lenPx) continue;
      const baseY = f.baseYAt(u + 0.5);
      const inSpan = u >= gu && u < gu + gw;
      const dxc = (u + 0.5) - (gu + gw / 2);
      const top = inSpan ? rect + Math.sqrt(Math.max(0, rise * rise - dxc * dxc)) : 0;
      const topOut = rect + Math.sqrt(Math.max(0, (rise + 5) * (rise + 5) - dxc * dxc));
      for (let v = 0; v < gh + 10; v++) {
        const y = baseY - 1 - v;
        if (inSpan && v < top) {
          // THE TUNNEL. A gate passage is a barrel vault ~4 m deep, so what you
          // actually see is: a worn floor running away from you, side walls that
          // converge, a vault losing all its light overhead, and — small, and
          // ARCHED, and much brighter than anything around it — the slot of the
          // street on the far side. Painting that slot as a plain pale rectangle
          // (the first version) reads as a blank card taped into the arch.
          const nu = dxc / rise;                       // -1..1 across the opening
          const slotR = rise * 0.46;
          const slotTop = 11 + Math.sqrt(Math.max(0, slotR * slotR - dxc * dxc)) * 0.85;
          if (v < 3) s.setHex(x0 + u, y, step(P.RAMPS.stone, 2));       // sill, lit
          else if (v < 6) s.setHex(x0 + u, y, step(P.RAMPS.stone, 1));  // floor
          else if (Math.abs(nu) < 0.46 && v < slotTop) {
            // daylight beyond: pale at the far end, with the far kerb line
            const k = (v - 6) / Math.max(1, slotTop - 6);
            s.setHex(x0 + u, y, k < 0.22 ? step(P.RAMPS.earth, 3)
              : k < 0.72 ? step(P.RAMPS.earth, 4) : step(P.RAMPS.whitewash, 3));
          } else if (Math.abs(nu) < 0.52 && v < slotTop + 2) {
            s.setHex(x0 + u, y, P.ANCHORS['shadow-violet']);            // the far jamb
          } else if (Math.abs(nu) > 0.78) {
            // the near side wall of the passage, catching one bounce on the left
            s.setHex(x0 + u, y, nu < 0 && v < top * 0.7 ? P.ANCHORS['shadow-violet'] : P.ANCHORS['shadow-void']);
          } else if (v > top - 12) {
            s.setHex(x0 + u, y, P.ANCHORS['shadow-void']);              // the vault
          } else {
            s.setHex(x0 + u, y, P.ANCHORS['shadow-violet']);
          }
        } else if (v < topOut && Math.abs(dxc) < rise + 5) {
          // voussoir ring + jambs in dressed granite, distinct from laterite
          const jamb = Math.min(u - (gu - 5), (gu + gw + 5) - u);
          const lit = dxc < 0;
          let idx = lit ? 4 : 2;
          if (jamb <= 1 || v >= topOut - 1) idx = 1;
          // radiating joints in the arch ring
          if (v > rect && (Math.round(Math.atan2(v - rect, dxc) * 9) % 2) === 0) idx -= 1;
          s.setHex(x0 + u, y, step(P.RAMPS.stone, clamp(idx, 0, 4)));
        }
      }
      // threshold: a worn granite sill and the shade the arch throws forward
      if (inSpan) {
        s.setHex(x0 + u, baseY - 1, step(P.RAMPS.stone, 4));
        s.setHex(x0 + u, baseY, step(P.RAMPS.stone, 2));
        for (let k = 1; k < 5; k++) T.shadePixel(s, x0 + u, baseY + k, 0.32 * (1 - k / 5));
      }
    }

    // portcullis teeth hanging in the head of the arch
    for (let u = gu + 2; u < gu + gw - 2; u += 5) {
      const baseY = f.baseYAt(u + 0.5);
      for (let v = gh - 14; v < gh - 2; v++) s.setHex(x0 + u, baseY - 1 - v, step(P.RAMPS.stone, 1));
    }

    // escutcheon: the Cross of the Order of Christ over the arch
    {
      const cx = x0 + gu + Math.round(gw / 2);
      const cy = f.baseYAt(gu + gw / 2) - 1 - (gh + 26);
      for (let v = -13; v <= 13; v++) {
        for (let k = -11; k <= 11; k++) {
          const inShield = Math.abs(k) / 11 + Math.max(0, v) / 15 < 1 && v > -13;
          if (!inShield) continue;
          s.setHex(cx + k, cy + v, step(P.RAMPS.whitewash, k < -3 ? 4 : k < 5 ? 3 : 2));
        }
      }
      const cr = P.ACCENTS['flag-crimson'];
      for (let k = -7; k <= 7; k++) {
        const t = Math.abs(k) > 4 ? 3 : 2;
        for (let q = -t; q <= t; q++) { s.setHex(cx + k, cy - 1 + q, cr); s.setHex(cx - 1 + q, cy + k * 0.9, cr); }
      }
      for (let k = -12; k <= 12; k++) { s.setHex(cx + k, cy - 14, P.ACCENTS['brass-gold']); }
    }

    // gate lamps: the practicals that light the plaza at night
    if (g.lamps !== false) {
      [-1, 1].forEach((sgn) => {
        const lx = x0 + gu + Math.round(gw / 2) + sgn * Math.round(gw / 2 + 12);
        const ly = f.baseYAt(gu + gw / 2) - 1 - (gh - 6);
        for (let k = 0; k < 7; k++) s.setHex(lx + sgn * k, ly - Math.round(k * 0.4), step(P.RAMPS.stone, 2));
        const bx = lx + sgn * 7;
        for (let v = 0; v < 9; v++) {
          for (let k = -3; k <= 3; k++) {
            const edge = Math.abs(k) === 3 || v === 8 || v === 0;
            s.setHex(bx + k, ly + v, edge ? P.ACCENTS['brass-gold'] : P.ACCENTS['lantern-flame']);
          }
        }
      });
    }

    // parapet over the gatehouse, one course higher than the curtain
    parapet(s, f, towerH, { material: 'terracotta', seed: seed + 5, merlonH: 15, phase: 4 });
  }

  // --- flanking towers ---------------------------------------------------
  (o.towers || []).forEach((tw, i) => {
    const th = tw.h === undefined ? F.TOWER : tw.h;
    const twW = tw.w === undefined ? 62 : tw.w;
    const tu = clamp(Math.round(f.lenPx * tw.at - twW / 2), -20, f.lenPx - 4);
    for (let u = tu; u < tu + twW; u++) {
      if (u < 0 || u >= f.lenPx) continue;
      const baseY = f.baseYAt(u + 0.5);
      const lu = u - tu;
      for (let v = 0; v < th; v++) {
        const sideSh = lu > twW - 6 ? -2 : lu < 5 ? 1 : 0;
        const block = Math.floor(lu / 13), course = Math.floor(v / 7);
        let idx = 3 + sideSh + (hash2(block, course, seed + 20 + i) < 0.22 ? -1 : 0);
        if ((v % 7) === 0 || (lu % 13) === 0) idx -= 1;
        s.setHex(x0 + u, baseY - 1 - v, step(P.RAMPS.terracotta, clamp(idx, 0, 4)));
        const patch = hash2(Math.floor((u + v * 0.3) / 51), Math.floor(v / 29), seed + 29 + i);
        if (patch > 0.58) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.145);
        else if (patch < 0.28) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.06);
      }
      for (let k = 1; k < 8; k++) {
        if (u === tu + twW - 1) {
          for (let v = 0; v < th; v++) T.shadePixel(s, x0 + u + k, baseY - 1 - v, 0.42 * (1 - k / 8));
        }
      }
      // gun embrasure two thirds up
      if (lu > twW * 0.3 && lu < twW * 0.62) {
        for (let v = Math.round(th * 0.56); v < Math.round(th * 0.56) + 13; v++) {
          s.setHex(x0 + u, baseY - 1 - v, P.ANCHORS['shadow-void']);
        }
        s.setHex(x0 + u, baseY - 1 - (Math.round(th * 0.56) - 1), step(P.RAMPS.stone, 4));
        s.setHex(x0 + u, baseY - 1 - (Math.round(th * 0.56) + 13), step(P.RAMPS.stone, 2));
      }
    }
    const tf = { p0: { x: x0 + tu }, lenPx: twW, baseYAt: (u) => f.baseYAt(clamp(tu + u, 0, f.lenPx - 1)) };
    parapet(s, tf, th, { material: 'terracotta', seed: seed + 30 + i, merlonH: 14, phase: 2 });
    plinth(s, tf, { material: 'terracotta', lit: true, h: 26, seed: seed + 40 + i });
    // flagstaff on the left-hand tower
    if (tw.flag) {
      const fx = x0 + tu + Math.round(twW * 0.5);
      const fy = f.baseYAt(clamp(tu + twW * 0.5, 0, f.lenPx - 1)) - 1 - (th + 20);
      for (let v = 0; v < 34; v++) s.setHex(fx, fy + v, step(P.RAMPS.timber, 3));
      const cr = P.ACCENTS['flag-crimson'], wh = P.RAMPS.whitewash;
      for (let v = 0; v < 13; v++) {
        for (let k = 1; k < 21; k++) {
          const flap = Math.round(Math.sin(k * 0.3 + v * 0.18) * 1.3);
          s.setHex(fx + k, fy + 2 + v + flap,
            (k > 5 && k < 16 && v > 3 && v < 10) ? cr : (k % 8 < 5 ? step(wh, 4) : step(wh, 2)));
        }
      }
    }
  });
});

/** A *guarita* — the round sentry box on a bastion corner. */
def('sentry-box', { collide: 0.6, examine: 'A guarita. The sentry inside it can see three miles of strait.' }, (s, iso, o) => {
  const seed = o.seed || 13;
  contactShadow(s, iso, o.tx, o.ty, 0.9, 0.36);
  const H = o.h || 40;
  isoCyl(s, iso, { tx: o.tx, ty: o.ty, r: 0.8, h: H, material: 'stone', seed, profile: (t) => (t < 0.1 ? 1.12 : 1) });
  const c = iso.toScreen(o.tx, o.ty, 0);
  // the slit
  for (let v = Math.round(H * 0.5); v < Math.round(H * 0.5) + 14; v++) {
    for (let k = -3; k <= 3; k++) s.setHex(Math.round(c.x) + k, Math.round(c.y) - v, P.ANCHORS['shadow-void']);
  }
  for (let k = -4; k <= 4; k++) s.setHex(Math.round(c.x) + k, Math.round(c.y) - Math.round(H * 0.5) + 1, step(P.RAMPS.stone, 4));
  // corbel ring + conical cap
  s.fillPoly(ellipsePts(c.x, c.y - H, 14, 7, 26), (u, v, x, y) =>
    step(P.RAMPS.stone, (x < c.x ? 4 : 2)));
  for (let k = 0; k < 16; k++) {
    const rr = 13 - k * 0.82;
    if (rr < 1) break;
    s.fillPoly(ellipsePts(c.x, c.y - H - 2 - k, rr, rr * 0.5, 22), (u, v, x, y) =>
      step(P.RAMPS.terracotta, x < c.x - rr * 0.2 ? 4 : x < c.x + rr * 0.3 ? 3 : 1));
  }
  for (let v = 0; v < 5; v++) s.setHex(Math.round(c.x), Math.round(c.y) - H - 18 - v, P.ACCENTS['brass-gold']);
});

/** A garrison gun on a naval carriage. */
def('cannon', { collide: 0.7, examine: 'A bronze demi-culverin on a garrison carriage, muzzle out toward the strait.' }, (s, iso, o) => {
  const seed = o.seed || 17;
  contactShadow(s, iso, o.tx + 0.2, o.ty + 0.1, 1.2, 0.36);
  const c = iso.toScreen(o.tx, o.ty, 0);
  const dir = o.facing === undefined ? -1 : o.facing;   // -1 = muzzle screen-left
  const tim = P.RAMPS.timber, brass = P.ACCENTS['brass-gold'], iron = P.RAMPS.stone;
  // carriage: two trucks and a stepped bracket
  [[-8, 0], [9, 2]].forEach(([dx, dy], i) => {
    for (let a = 0; a < 22; a++) {
      const rad = (a / 22) * Math.PI * 2;
      s.setHex(Math.round(c.x + dx + Math.cos(rad) * 4), Math.round(c.y + dy - 4 + Math.sin(rad) * 4), step(tim, i ? 1 : 3));
    }
    for (let k = -2; k <= 2; k++) s.setHex(Math.round(c.x + dx + k), Math.round(c.y + dy - 4), step(tim, 4));
  });
  for (let v = 0; v < 9; v++) {
    const wdt = 13 - Math.round(v * 0.5);
    for (let k = -wdt; k <= wdt; k++) {
      let idx = k < -wdt * 0.3 ? 4 : k < wdt * 0.4 ? 3 : 1;
      if ((k % 5) === 0) idx -= 1;
      s.setHex(Math.round(c.x) + k, Math.round(c.y) - 4 - v, step(tim, clamp(idx, 0, 4)));
    }
  }
  // barrel: reinforced breech, tapering chase, muzzle swell, two trunnions
  const by = Math.round(c.y) - 15;
  for (let k = 0; k < 30; k++) {
    const t = k / 30;
    const x = Math.round(c.x) + dir * (k - 12);
    const r = t < 0.22 ? 5 : t < 0.5 ? 4 : t > 0.9 ? 4.6 : 3.4;
    for (let v = -Math.round(r); v <= Math.round(r); v++) {
      let idx = v < -r * 0.35 ? 4 : v < r * 0.3 ? 3 : 1;
      if ((k % 9) === 0) idx -= 1;
      s.setHex(x, by + v, step(P.RAMPS.terracotta, clamp(idx, 0, 4)));
    }
    if (k === 0 || k === 6 || k === 29) for (let v = -Math.round(r); v <= Math.round(r); v++) s.setHex(x, by + v, brass);
  }
  // muzzle bore
  for (let v = -2; v <= 2; v++) s.setHex(Math.round(c.x) + dir * 18, by + v, P.ANCHORS['shadow-void']);
  // cascabel + a shot pyramid beside the gun
  s.setHex(Math.round(c.x) - dir * 13, by, brass);
  if (o.shot !== false) {
    [[0, 0], [5, 1], [10, 2], [2.5, -2], [7.5, -1], [5, -4]].forEach(([dx, dy], i) => {
      const px = Math.round(c.x) + 20 + dx, py = Math.round(c.y) + 1 + dy;
      s.fillPoly(ellipsePts(px, py, 3.2, 3.0, 14), (u, v, x, y) =>
        step(iron, x < px - 1 ? 3 : x < px + 1 ? 2 : 0));
      if (seed) s.setHex(px - 1, py - 2, step(iron, 4));
    });
  }
});

/** A halberd rack / arms stand beside a guard post. */
def('arms-rack', { collide: 0.5, examine: 'A rack of pikes and halberds, hafts polished by nervous hands.' }, (s, iso, o) => {
  const seed = o.seed || 19;
  contactShadow(s, iso, o.tx + 0.3, o.ty + 0.1, 0.8, 0.30);
  isoBox(s, iso, { tx: o.tx, ty: o.ty, w: 0.9, d: 0.28, h: 5, z: 22, material: 'timber', seed });
  isoBox(s, iso, { tx: o.tx, ty: o.ty, w: 0.9, d: 0.28, h: 4, material: 'timber', seed: seed + 1 });
  const a = iso.toScreen(o.tx + 0.05, o.ty + 0.14, 0);
  for (let i = 0; i < 6; i++) {
    const x = Math.round(a.x) + i * 5;
    const lean = (i % 2) ? 1 : -1;
    for (let v = 0; v < 46; v++) {
      s.setHex(x + Math.round(lean * v * 0.06), Math.round(a.y) - 2 - v, step(P.RAMPS.timber, i % 2 ? 3 : 1));
    }
    // head: a pike point or a halberd axe
    const hx = x + Math.round(lean * 46 * 0.06), hy = Math.round(a.y) - 48;
    if (i % 3 === 0) {
      for (let v = 0; v < 7; v++) for (let k = -2; k <= 2; k++) {
        if (Math.abs(k) > 2 - v * 0.35) continue;
        s.setHex(hx + k, hy - v, step(P.RAMPS.stone, k < 0 ? 4 : 2));
      }
    } else {
      for (let v = 0; v < 6; v++) for (let k = 0; k < 5; k++) {
        if (hash2(k, v, seed + i) < 0.12) continue;
        s.setHex(hx + k - 1, hy - v, step(P.RAMPS.stone, k < 2 ? 4 : 1));
      }
    }
  }
});

/** A powder barrel stack under a tarpaulin — garrison clutter with silhouette. */
def('powder-store', { collide: 0.8, examine: 'Powder barrels under a tarred canvas; no one smokes within twenty paces.' }, (s, iso, o) => {
  const seed = o.seed || 23;
  contactShadow(s, iso, o.tx + 0.3, o.ty + 0.3, 1.0, 0.36);
  [[0, 0], [0.5, 0.1], [0.2, 0.5]].forEach(([dx, dy], i) => {
    isoCyl(s, iso, {
      tx: o.tx + dx, ty: o.ty + dy, r: 0.46, h: 15, material: 'timber',
      seed: seed + i, stave: true, bulge: 0.13, hoops: [2, 7, 12],
    });
  });
  // canvas thrown over the top: one continuous form, folds not speckle
  const c = iso.toScreen(o.tx + 0.28, o.ty + 0.28, 15);
  for (let k = -22; k <= 22; k++) {
    const t = Math.abs(k) / 22;
    const hh = Math.round(9 * Math.sqrt(Math.max(0, 1 - t * t)));
    for (let v = -hh; v <= hh + 6; v++) {
      let idx = v < -hh * 0.3 ? 4 : v < hh * 0.4 ? 3 : 1;
      if (hash2(Math.floor(k / 4), 0, seed + 5) < 0.26) idx -= 1;
      s.setHex(Math.round(c.x) + k, Math.round(c.y) + v, step(P.RAMPS.earth, clamp(idx, 0, 4)));
    }
  }
});

module.exports = { F, parapet, plinth };
