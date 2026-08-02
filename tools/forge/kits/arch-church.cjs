'use strict';
/**
 * MELAKA FORGE — KIT: THE CHURCH ON THE HILL
 * ==========================================
 * Nossa Senhora da Anunciada, the chapel the Portuguese raised on the summit
 * in 1521 and which the Dutch later renamed St Paul's.
 *
 * THE DEFECT THIS EXISTS TO FIX. The shipping plate draws a church whose nave
 * is about 80 native px — shorter than the 96px the player renders at. That is
 * not a small proportion error, it is the single most damaging thing in the
 * game's art, because a cathedral you can see over stops being a cathedral.
 *
 * SCALE CANON (native px, player = 32)
 *   plinth                 6
 *   nave wall             96      (3 players to the eaves)
 *   nave ridge           148      (4.6 players — the benchmark asks for >=140)
 *   west gable apex      154
 *   bell tower           196      (6.1 players; it breaks the top of the frame)
 *   buttress             10 wide, projecting 4, weathered top at 0.62 of the wall
 *   nave window          16 x 40, round-headed, in a 3px dressed surround
 *   west door            26 x 46
 *   gravestone            9-15 tall
 *
 * MATERIAL. Melaka laterite rubble rendered in lime — so `whitewash` for the
 * wall field with `stone` dressings at every opening, quoin and string course.
 * That reads distinctly against A Famosa's bare laterite two screens away, and
 * a white mass is what makes the hill read at a distance.
 */

const P = require('../palette.cjs');
const T = require('../texture.cjs');
const { drawFace, hash2 } = require('../iso.cjs');
const ARCH = require('./arch-portuguese.cjs');
const { def } = require('./registry.cjs');
const {
  ellipsePts, contactShadow, footprintRim, contactBand, isoBox, lineTo, clamp,
} = require('./primitives.cjs');

const step = T.step;

const C = {
  PLINTH: 6,
  NAVE: 96,
  RIDGE_RISE: 52,
  TOWER: 196,
  BUTTRESS_W: 10,
  WIN_W: 16,
  WIN_H: 40,
  DOOR_W: 26,
  DOOR_H: 46,
};

/**
 * A round-headed window with a dressed surround and a central mullion. Tall and
 * narrow: at 16x40 it is the proportion that says "church" rather than "house",
 * which is doing more work here than any amount of ornament.
 */
function lancet(surface, f, u0, v0, spec) {
  const s = spec || {};
  const w = s.width || C.WIN_W;
  const h = s.height || C.WIN_H;
  const stone = P.RAMPS.stone;
  const rect = h - w / 2;
  const x0 = Math.round(f.p0.x);
  const glass = s.lit ? P.ACCENTS['lantern-flame'] : P.ANCHORS['shadow-void'];
  for (let u = u0 - 3; u < u0 + w + 3; u++) {
    if (u < 0 || u >= f.lenPx) continue;
    const baseY = f.baseYAt(u + 0.5);
    const dxc = (u + 0.5) - (u0 + w / 2);
    const top = rect + Math.sqrt(Math.max(0, (w / 2) * (w / 2) - dxc * dxc));
    const topOut = rect + Math.sqrt(Math.max(0, (w / 2 + 3) * (w / 2 + 3) - dxc * dxc));
    const inSpan = u >= u0 && u < u0 + w;
    for (let v = v0; v < v0 + h + 6; v++) {
      const lv = v - v0;
      const y = baseY - 1 - v;
      if (inSpan && lv < top) {
        const mullion = Math.abs(dxc) < 1.2 && lv < rect;
        if (mullion) { surface.setHex(x0 + u, y, step(stone, 3)); continue; }
        // the glass is not flat: a slow gradient, brighter at the head
        surface.setHex(x0 + u, y, s.lit
          ? (hash2(u >> 1, v >> 1, s.seed || 3) > 0.4 ? glass : step(P.RAMPS.terracotta, 3))
          : (lv > h * 0.72 ? step(P.RAMPS.water, 0) : glass));
      } else if (Math.abs(dxc) < w / 2 + 3 && lv < topOut) {
        const jamb = Math.min(u - (u0 - 3), (u0 + w + 3) - u);
        const lit = dxc < 0;
        let idx = lit ? 4 : 2;
        if (jamb <= 1 || lv >= topOut - 1) idx = 1;
        surface.setHex(x0 + u, y, step(stone, idx));
      }
    }
    // sill + the drip shadow it throws
    if (Math.abs(dxc) < w / 2 + 3) {
      surface.setHex(x0 + u, baseY - 1 - (v0 - 1), step(stone, 4));
      surface.setHex(x0 + u, baseY - 1 - (v0 - 2), step(stone, 2));
      T.shadePixel(surface, x0 + u, baseY - 1 - (v0 - 3), 0.34);
    }
  }
}

/** A stepped buttress with a weathered sloping top. */
function buttress(surface, f, u0, h, seed) {
  const stone = P.RAMPS.stone;
  const x0 = Math.round(f.p0.x);
  const w = C.BUTTRESS_W;
  for (let u = u0; u < u0 + w; u++) {
    if (u < 0 || u >= f.lenPx) continue;
    const baseY = f.baseYAt(u + 0.5);
    const lu = u - u0;
    const top = Math.round(h * (0.62 + 0.10 * (1 - lu / w)));   // weathering slope
    for (let v = 0; v < top; v++) {
      const course = Math.floor(v / 8), block = Math.floor(lu / 6);
      let idx = lu < w * 0.55 ? 4 : 3;
      if (hash2(block, course, seed) < 0.22) idx -= 1;
      if ((v % 8) === 0) idx -= 1;
      surface.setHex(x0 + u, baseY - 1 - v, step(stone, clamp(idx, 0, 4)));
    }
    surface.setHex(x0 + u, baseY - 1 - top, step(stone, 4));     // weathering cap
    surface.setHex(x0 + u, baseY - top, step(stone, 1));
  }
  // the shadow the buttress throws down-right onto the wall
  for (let k = 1; k < 6; k++) {
    const u = u0 + w - 1 + k;
    if (u < 0 || u >= f.lenPx) continue;
    const baseY = f.baseYAt(u + 0.5);
    for (let v = 0; v < h * 0.68; v++) T.shadePixel(surface, x0 + u, baseY - 1 - v, 0.36 * (1 - k / 6));
  }
  // contact
  for (let u = u0; u < u0 + w; u++) {
    if (u < 0 || u >= f.lenPx) continue;
    const baseY = f.baseYAt(u + 0.5);
    surface.setHex(x0 + u, baseY - 1, step(stone, 0));
    surface.setHex(x0 + u, baseY - 2, step(stone, 1));
  }
}

/**
 * THE CHURCH.
 * spec: { tx, ty, w, d, naveH, rise, tower:{at,w,h}, litWindows, seed }
 */
def('church', {
  collide: false,
  examine: 'The church on the hill. From its door you can see every ship that enters the strait.',
}, (s, iso, o) => {
  const seed = o.seed || 3;
  const w = o.w || 5.0, d = o.d || 2.8;
  const H = o.naveH === undefined ? C.NAVE : o.naveH;
  const rise = o.rise === undefined ? C.RIDGE_RISE : o.rise;
  const wallMat = o.wall || 'whitewash';
  const stone = P.RAMPS.stone;

  const A = { tx: o.tx, ty: o.ty };
  const B = { tx: o.tx + w, ty: o.ty };
  const Cc = { tx: o.tx + w, ty: o.ty + d };
  const D = { tx: o.tx, ty: o.ty + d };

  // --- cast shadow: a 148px mass throws a long one --------------------------
  T.castShadow(s, iso.footprintPoly(o.tx, o.ty, w, d, 0),
    { x: Math.round((H + rise) * 0.42), y: Math.round((H + rise) * 0.21) }, 0.36);

  const fLit = iso.face(D, Cc, H, 0);
  const fSh = iso.face(Cc, B, H, 0);
  drawFace(s, fLit, T.plaster({ material: wallMat, light: 3, height: H, seed, dado: 14 }));
  drawFace(s, fSh, T.plaster({ material: wallMat, light: 1, height: H, seed: seed + 1, dado: 14 }));

  // --- plinth ---------------------------------------------------------------
  [[fLit, 3], [fSh, 1]].forEach(([f, li]) => {
    const x0 = Math.round(f.p0.x);
    for (let u = 0; u < f.lenPx; u++) {
      const baseY = f.baseYAt(u + 0.5);
      for (let v = 0; v < C.PLINTH; v++) {
        s.setHex(x0 + u, baseY - 1 - v, step(stone, (v === C.PLINTH - 1 ? li + 1 : li)
          - (hash2(Math.floor(u / 11), v > 2 ? 1 : 0, seed) < 0.22 ? 1 : 0)));
      }
    }
  });

  // --- quoins at the near corner -------------------------------------------
  {
    const c = iso.toScreen(Cc.tx, Cc.ty, 0);
    for (let v = 0; v < H; v++) {
      const band = Math.floor(v / 9) & 1;
      s.setHex(Math.round(c.x) - (band ? 2 : 1), Math.round(c.y) - 1 - v, step(stone, 4));
      s.setHex(Math.round(c.x), Math.round(c.y) - 1 - v, step(stone, 1));
    }
  }

  // --- buttresses + lancets on the long lit face ---------------------------
  const bays = Math.max(2, Math.round(fLit.lenPx / 52));
  const pitch = fLit.lenPx / bays;
  for (let i = 0; i <= bays; i++) {
    buttress(s, fLit, Math.round(i * pitch) - C.BUTTRESS_W / 2, H, seed + 10 + i);
  }
  for (let i = 0; i < bays; i++) {
    const u0 = Math.round((i + 0.5) * pitch - C.WIN_W / 2);
    if (u0 < 6 || u0 + C.WIN_W > fLit.lenPx - 6) continue;
    lancet(s, fLit, u0, 34, {
      lit: (o.litWindows || []).indexOf(i) >= 0, seed: seed + 30 + i,
    });
  }
  // one lancet on the shadow face so the east end is not blank
  if (fSh.lenPx > 40) {
    lancet(s, fSh, Math.round(fSh.lenPx / 2 - C.WIN_W / 2), 38, { seed: seed + 60 });
  }

  // --- string course under the eaves ---------------------------------------
  ARCH.stringCourse(s, fLit, H - 10, { material: 'stone', thickness: 3 });
  ARCH.stringCourse(s, fSh, H - 10, { material: 'stone', thickness: 3 });

  // --- the great west door, in the middle of the lit face ------------------
  {
    const u0 = Math.round(fLit.lenPx * (o.doorAt === undefined ? 0.5 : o.doorAt) - C.DOOR_W / 2);
    ARCH.doorway(s, fLit, u0, {
      width: C.DOOR_W, height: C.DOOR_H, seed: seed + 5, litInterior: true, lit: true,
    });
    // a pediment / hood mould over it, and the date stone
    const x0 = Math.round(fLit.p0.x);
    for (let u = u0 - 6; u < u0 + C.DOOR_W + 6; u++) {
      if (u < 0 || u >= fLit.lenPx) continue;
      const baseY = fLit.baseYAt(u + 0.5);
      const dxc = Math.abs((u + 0.5) - (u0 + C.DOOR_W / 2));
      const hood = Math.round(C.DOOR_H + 8 - dxc * 0.22);
      for (let k = 0; k < 3; k++) s.setHex(x0 + u, baseY - 1 - (hood + k), step(stone, k === 2 ? 4 : 3));
      if (dxc < 7) {
        for (let v = hood + 6; v < hood + 14; v++) {
          s.setHex(x0 + u, baseY - 1 - v, hash2(u, v, seed + 9) > 0.55 ? step(stone, 4) : step(stone, 2));
        }
      }
    }
  }

  footprintRim(s, iso, o.tx, o.ty, w, d, { strength: 0.82, anchor: 'shadow-void' });
  contactBand(s, fLit, P.RAMPS[wallMat], { px: 2 });
  contactBand(s, fSh, P.RAMPS[wallMat], { px: 2 });

  // --- roof -----------------------------------------------------------------
  ARCH.roof(s, iso, {
    tx: o.tx, ty: o.ty, w, d, z: H,
    type: 'gable', ridgeAxis: 'tx', rise,
    overhang: 0.10, material: 'terracotta', seed: seed + 70,
  });

  // --- the bell tower -------------------------------------------------------
  const tw = o.tower && o.tower.w ? o.tower.w : 1.7;
  const th = o.tower && o.tower.h ? o.tower.h : C.TOWER;
  const tAt = o.tower && o.tower.at !== undefined ? o.tower.at : 0.0;
  // The tower stands at the WEST end and projects toward the camera, so it has
  // the larger ty and is therefore painted after the nave — which is the only
  // way the occlusion comes out right (a tower drawn behind the nave it is
  // supposed to stand in front of reads as a chimney).
  const ttx = o.tx + tAt * (w - tw) - tw * 0.10;
  const tty = o.ty + d * 0.52;
  {
    T.castShadow(s, iso.footprintPoly(ttx, tty, tw, tw, 0),
      { x: Math.round(th * 0.42), y: Math.round(th * 0.21) }, 0.34);
    const TA = { tx: ttx, ty: tty };
    const TB = { tx: ttx + tw, ty: tty };
    const TC = { tx: ttx + tw, ty: tty + tw };
    const TD = { tx: ttx, ty: tty + tw };
    const tLit = iso.face(TD, TC, th, 0);
    const tSh = iso.face(TC, TB, th, 0);
    drawFace(s, tLit, T.plaster({ material: wallMat, light: 3, height: th, seed: seed + 80, dado: 14 }));
    drawFace(s, tSh, T.plaster({ material: wallMat, light: 1, height: th, seed: seed + 81, dado: 14 }));
    // stone quoins up the near corner
    const tc = iso.toScreen(TC.tx, TC.ty, 0);
    for (let v = 0; v < th; v++) {
      const band = Math.floor(v / 9) & 1;
      s.setHex(Math.round(tc.x) - (band ? 2 : 1), Math.round(tc.y) - 1 - v, step(stone, 4));
      s.setHex(Math.round(tc.x), Math.round(tc.y) - 1 - v, step(stone, 1));
    }
    // three string courses divide the shaft into stages
    [0.34, 0.58, 0.80].forEach((k) => {
      ARCH.stringCourse(s, tLit, Math.round(th * k), { material: 'stone', thickness: 3 });
      ARCH.stringCourse(s, tSh, Math.round(th * k), { material: 'stone', thickness: 3 });
    });
    // belfry: a tall louvred opening on each visible face, with the bell in it
    [[tLit, true], [tSh, false]].forEach(([f, isLit], fi) => {
      const bw = Math.max(10, Math.round(f.lenPx * 0.42));
      const u0 = Math.round(f.lenPx / 2 - bw / 2);
      const x0 = Math.round(f.p0.x);
      const v0 = Math.round(th * 0.84);
      for (let u = u0 - 3; u < u0 + bw + 3; u++) {
        if (u < 0 || u >= f.lenPx) continue;
        const baseY = f.baseYAt(u + 0.5);
        const dxc = (u + 0.5) - (u0 + bw / 2);
        const hh = 26;
        const top = hh - 6 + Math.sqrt(Math.max(0, (bw / 2) * (bw / 2) - dxc * dxc));
        for (let v = v0; v < v0 + top + 4; v++) {
          const lv = v - v0;
          const y = baseY - 1 - v;
          if (Math.abs(dxc) < bw / 2 && lv < top) {
            // louvre boards, and the bell hanging behind them
            const bell = fi === 0 && Math.abs(dxc) < bw * 0.22 && lv > 5 && lv < 19;
            s.setHex(x0 + u, y, bell ? P.ACCENTS['brass-gold']
              : (lv % 4 === 0 ? step(P.RAMPS.timber, 1) : P.ANCHORS['shadow-void']));
          } else if (Math.abs(dxc) < bw / 2 + 3 && lv < top + 3) {
            s.setHex(x0 + u, y, step(stone, isLit ? (dxc < 0 ? 4 : 2) : 1));
          }
        }
      }
    });
    // cornice, then the pyramidal cap and the cross
    [tLit, tSh].forEach((f, fi) => {
      const x0 = Math.round(f.p0.x);
      for (let u = -2; u < f.lenPx + 2; u++) {
        const uu = clamp(u, 0, f.lenPx - 1);
        const baseY = f.baseYAt(uu + 0.5);
        for (let k = 0; k < 4; k++) {
          s.setHex(x0 + u, baseY - 1 - (th + k), step(stone, k === 3 ? 4 : fi ? 1 : 3));
        }
      }
    });
    const cap = o.tower && o.tower.cap ? o.tower.cap : 30;
    const apex = iso.toScreen(ttx + tw / 2, tty + tw / 2, th + 4);
    const halfW = Math.round(tw * iso.tileWidth * 0.5) + 2;
    for (let k = 0; k < cap; k++) {
      const t = k / cap;
      const hw = Math.round(halfW * (1 - t));
      for (let dx = -hw; dx <= hw; dx++) {
        const lit = dx < -hw * 0.15;
        s.setHex(Math.round(apex.x) + dx, Math.round(apex.y) - k,
          step(P.RAMPS.terracotta, lit ? (((k + dx) % 5) === 0 ? 2 : 4) : (((k + dx) % 5) === 0 ? 0 : 2)));
      }
    }
    const cy = Math.round(apex.y) - cap;
    for (let k = 0; k < 12; k++) s.setHex(Math.round(apex.x), cy - k, step(stone, 4));
    for (let k = -4; k <= 4; k++) s.setHex(Math.round(apex.x) + k, cy - 8, step(stone, k < 0 ? 4 : 2));
    // no footprintRim here: the tower's footprint overlaps the nave's, and a
    // rim drawn across it would lay a dark diagonal over the nave wall
    contactBand(s, tLit, P.RAMPS[wallMat], { px: 2 });
    contactBand(s, tSh, P.RAMPS[wallMat], { px: 2 });
  }
});

// ---------------------------------------------------------------------------
// CHURCHYARD
// ---------------------------------------------------------------------------
/**
 * A Portuguese ledger headstone. Four silhouettes — round-headed, shouldered,
 * a broken shaft and a plain slab — because a graveyard drawn from one stamp
 * reads as a fence. Each carries a couple of bright scratches that read as an
 * inscription at 3x without pretending to be legible letters.
 */
def('gravestone', { collide: 0.34, examine: 'A headstone, its Portuguese worn to grooves. EM TERRA ESTRANHA — in a strange land.' }, (s, iso, o) => {
  const seed = o.seed || 5;
  const kind = o.kind === undefined ? Math.floor(hash2(seed, 1, 3) * 4) : o.kind;
  const stone = P.RAMPS.stone;
  contactShadow(s, iso, o.tx, o.ty, 0.42, 0.34);
  const c = iso.toScreen(o.tx, o.ty, 0);
  const h = o.h === undefined ? 11 + Math.round(hash2(seed, 2, 7) * 5) : o.h;
  const halfW = kind === 3 ? 7 : 5;
  const lean = Math.round((hash2(seed, 3, 11) - 0.5) * 3);
  for (let v = 0; v < h; v++) {
    const t = v / h;
    let hw = halfW;
    if (kind === 0) hw = t > 0.78 ? Math.round(halfW * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.78) / 0.22, 2)))) : halfW;
    if (kind === 1 && t > 0.72) hw = halfW - 2;
    if (kind === 2 && t > 0.62) break;                      // broken shaft
    const dx0 = Math.round(lean * t);
    for (let dx = -hw; dx <= hw; dx++) {
      let idx = dx < -hw * 0.3 ? 4 : dx < hw * 0.35 ? 3 : 1;
      if (hash2(Math.floor(dx / 3), Math.floor(v / 4), seed) < 0.2) idx -= 1;
      if (v < 2) idx = v === 0 ? 0 : 1;                     // contact band
      s.setHex(Math.round(c.x) + dx + dx0, Math.round(c.y) - 1 - v, step(stone, clamp(idx, 0, 4)));
    }
  }
  // inscription: three short scratch lines, and a cross incised at the head
  const topY = Math.round(c.y) - h;
  for (let i = 0; i < 3; i++) {
    const lw = 3 + Math.round(hash2(seed, i + 5, 13) * 4);
    for (let k = 0; k < lw; k++) s.setHex(Math.round(c.x) - 3 + k, topY + 8 + i * 3, step(stone, 0));
  }
  if (kind !== 2) {
    for (let k = -2; k <= 2; k++) s.setHex(Math.round(c.x) + k, topY + 4, step(stone, 0));
    for (let k = 0; k < 5; k++) s.setHex(Math.round(c.x), topY + 2 + k, step(stone, 0));
  }
});

/** A raised ledger slab over a tomb — a horizontal note among the verticals. */
def('tomb-slab', { collide: 0.9, examine: 'A ledger slab. A Dutch name has been cut across a Portuguese one.' }, (s, iso, o) => {
  const seed = o.seed || 7;
  contactShadow(s, iso, o.tx + 0.4, o.ty + 0.25, 1.1, 0.34);
  isoBox(s, iso, {
    tx: o.tx, ty: o.ty, w: o.w || 1.0, d: o.d || 0.55, h: 7, material: 'stone', seed,
    topTex: T.ashlar({ material: 'stone', light: 4, blockW: 15, blockH: 10, seed }),
    litTex: T.ashlar({ material: 'stone', light: 3, blockW: 15, blockH: 10, seed }),
    shTex: T.ashlar({ material: 'stone', light: 1, blockW: 15, blockH: 10, seed }),
  });
  // an incised cross and two lines of inscription on the top face
  const reg = iso.region(o.tx + 0.1, o.ty + 0.08, (o.w || 1.0) - 0.2, (o.d || 0.55) - 0.16, 7);
  s.fillPara(reg.o, reg.eu, reg.ev, (u, v, x, y) => {
    const cross = (Math.abs(u - 12) < 1.6 && v > 3 && v < 13) || (Math.abs(v - 8) < 1.6 && u > 6 && u < 18);
    if (cross) return step(P.RAMPS.stone, 1);
    if (v > 4 && v < 12 && u > 24 && ((Math.floor(v / 3) + Math.floor(u / 7)) & 1) === 0) return step(P.RAMPS.stone, 2);
    return null;
  }, reg);
});

/** A standing stone cross — the churchyard's vertical accent. */
def('stone-cross', { collide: 0.4, examine: 'A cross of Melaka granite, set up for the sailors the strait kept.' }, (s, iso, o) => {
  const seed = o.seed || 9;
  const stone = P.RAMPS.stone;
  contactShadow(s, iso, o.tx, o.ty, 0.55, 0.36);
  const c = iso.toScreen(o.tx, o.ty, 0);
  // stepped base
  for (let tier = 0; tier < 2; tier++) {
    const hw = 11 - tier * 4;
    for (let v = 0; v < 4; v++) {
      for (let dx = -hw; dx <= hw; dx++) {
        s.setHex(Math.round(c.x) + dx, Math.round(c.y) - 1 - tier * 4 - v,
          step(stone, v === 3 ? 4 : dx < -hw * 0.3 ? 3 : dx < hw * 0.3 ? 2 : 1));
      }
    }
  }
  const H = o.h || 40;
  const base = Math.round(c.y) - 9;
  for (let v = 0; v < H; v++) {
    for (let dx = -3; dx <= 3; dx++) {
      let idx = dx < -1 ? 4 : dx < 2 ? 3 : 1;
      if (hash2(dx, Math.floor(v / 7), seed) < 0.2) idx -= 1;
      s.setHex(Math.round(c.x) + dx, base - v, step(stone, clamp(idx, 0, 4)));
    }
  }
  const ay = base - H;
  for (let dx = -11; dx <= 11; dx++) {
    for (let v = 0; v < 6; v++) {
      s.setHex(Math.round(c.x) + dx, ay + 4 + v, step(stone, dx < -3 ? 4 : dx < 3 ? 3 : 1));
    }
  }
  for (let v = 0; v < 10; v++) {
    for (let dx = -3; dx <= 3; dx++) s.setHex(Math.round(c.x) + dx, ay - v, step(stone, dx < -1 ? 4 : dx < 2 ? 3 : 1));
  }
});

/**
 * The churchyard terrace wall. THIS IS THE ANTI-FLOATING-ISLAND DEVICE: it
 * gives the summit a built edge, and the town roofs painted behind it read as
 * being BELOW that edge rather than floating beside it. Author it along the
 * crest, with a `gap` where the steps come up.
 */
def('terrace-wall', { collide: false, examine: 'The churchyard wall. Below it the roofs of the town go down to the water.' }, (s, iso, o) => {
  const seed = o.seed || 11;
  const A = { tx: o.tx, ty: o.ty };
  const B = o.axis === 'tx' ? { tx: o.tx + o.len, ty: o.ty }
    : o.axis === 'ty' ? { tx: o.tx, ty: o.ty + o.len }
      : { tx: o.tx + o.len, ty: o.ty - o.len };
  const H = o.h === undefined ? 16 : o.h;
  const f = iso.face(A, B, H, 0);
  const x0 = Math.round(f.p0.x);
  const stone = P.RAMPS[o.material || 'stone'];
  const cap = P.RAMPS.stone;
  const gapFrom = o.gapFrom === undefined ? -1 : o.gapFrom * f.lenPx;
  const gapTo = o.gapTo === undefined ? -1 : o.gapTo * f.lenPx;

  // Piers every ~68px. A 640px run of plain coursing reads as a concrete
  // parapet; buttressed piers with their own cast shadow read as a retaining
  // wall holding a hill up, which is the whole point of the thing.
  const pier = o.pier === undefined ? 68 : o.pier;
  const pierW = 13;
  for (let u = 0; u < f.lenPx; u++) {
    if (gapFrom >= 0 && u >= gapFrom && u < gapTo) continue;
    const baseY = f.baseYAt(u + 0.5);
    const pu = (u + 24) % pier;
    const onPier = pu < pierW;
    const hh = onPier ? H + 5 : H;
    for (let v = 0; v < hh; v++) {
      // rubble, not ashlar: the course height and the block width both wobble,
      // so the wall reads as something built out of what the hill provided
      const course = Math.floor(v / 6);
      const jog = Math.floor(hash2(0, course, seed + 3) * 7);
      const block = Math.floor((u + jog) / (10 + Math.floor(hash2(course, 1, seed) * 7)));
      const hb = hash2(block, course, seed);
      let idx = (onPier ? (pu < pierW * 0.55 ? 4 : 3) : 3) + (hb < 0.28 ? -1 : hb > 0.88 ? 1 : 0);
      if ((v % 6) === 0) idx -= 1;
      if (((u + jog) % (10 + Math.floor(hash2(course, 1, seed) * 7))) === 0) idx -= 1;
      s.setHex(x0 + u, baseY - 1 - v, step(stone, clamp(idx, 0, 4)));
    }
    if (onPier) {
      s.setHex(x0 + u, baseY - 1 - hh, step(cap, 4));
      s.setHex(x0 + u, baseY - hh, step(cap, 1));
    } else if (pu >= pierW && pu < pierW + 5) {
      for (let v = 0; v < H; v++) T.shadePixel(s, x0 + u, baseY - 1 - v, 0.34 * (1 - (pu - pierW) / 5));
    }
    // coping: a bright capping run, then the dark reveal under it
    s.setHex(x0 + u, baseY - 1 - H, step(cap, 4));
    s.setHex(x0 + u, baseY - H, step(cap, 2));
    // contact with the terrace behind
    s.setHex(x0 + u, baseY - 1, step(stone, 0));
    s.setHex(x0 + u, baseY - 2, step(stone, 1));
    T.aoBand(s, x0 + u, baseY + 2, 2, 0.3);
  }
});

/**
 * THE BURIAL-PLOT KERB — the seam dressing.
 *
 * THE DEFECT. The graveyard's dirt sat inside a perfect screen rhombus against
 * the churchyard grass, and the eye read the straight edge as a rendering
 * artefact rather than as a place. The hard edge itself is CORRECT and stays:
 * ground regions are cut by point-in-polygon with no feathering, because a
 * feathered edge on a 640x360 plate is anti-aliasing by another name and it is
 * exactly what makes pixel art look like a downscaled photograph.
 *
 * So the fix is the one a real churchyard uses. A burial plot is not a colour
 * change in the turf, it is a plot with a BUILT EDGE — a low rubble kerb, half
 * of it robbed out for somebody's wall, loose stones lying where it went, and
 * lalang growing through the gaps. Draw that and the boundary stops being a
 * seam and becomes the reason the ground changes.
 *
 * `poly` arrives from the compositor via the layout's `edgeOf`, so the kerb is
 * derived from the very polygon that cut the ground and cannot drift off it.
 * Author the ground as an IRREGULAR poly and the kerb wanders with it for free.
 */
def('plot-kerb', { collide: false, examine: false }, (s, iso, o) => {
  const seed = o.seed || 31;
  const poly = o.poly || [];
  if (poly.length < 3) return;
  const stone = P.RAMPS.stone;
  const fol = P.RAMPS.foliage;
  const earth = P.RAMPS.earth;
  const H = o.h === undefined ? 4 : o.h;
  const blk = o.block === undefined ? 11 : o.block;     // rubble course length
  const robbed = o.robbed === undefined ? 0.16 : o.robbed;

  // --- 1. resample the outline into screen pixels, carrying arclength -------
  // `edgeFrom`/`edgeTo` dress only PART of the outline. A burial plot is kerbed
  // all the way round; a five-foot-way is kerbed on the street side and runs
  // off the plate on the other three, and putting a kerb along an edge the
  // player can never reach draws a line across the middle of nothing.
  const pts = poly.map((p) => iso.toScreen(p.tx, p.ty, 0));
  const cen = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
  const eFrom = o.edgeFrom === undefined ? 0 : o.edgeFrom;
  const eTo = o.edgeTo === undefined ? pts.length - 1 : o.edgeTo;
  const samples = [];
  let arc = 0;
  for (let e = eFrom; e <= eTo; e++) {
    const a = pts[e % pts.length], b = pts[(e + 1) % pts.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(len * 2));
    // A (1,1) tile edge projects to a PURE VERTICAL on screen, so iso.face()
    // (which indexes by screen x) cannot draw it at all. Walking the projected
    // segment handles every orientation, and `steep` picks the profile: a
    // near-horizontal run shows the kerb's face, a near-vertical one shows it
    // end-on as a 3px-wide band.
    const steep = Math.abs(dy) > Math.abs(dx);
    for (let i = 0; i < n; i++) {
      const f = i / n;
      samples.push({
        x: Math.round(a.x + dx * f), y: Math.round(a.y + dy * f),
        t: arc + len * f, steep,
      });
    }
    arc += len;
  }

  const outward = (sm) => {
    const vx = sm.x - cen.x, vy = sm.y - cen.y;
    const m = Math.hypot(vx, vy) || 1;
    return { x: vx / m, y: vy / m };
  };

  // --- 2. the kerb run ------------------------------------------------------
  samples.forEach((sm) => {
    const bi = Math.floor(sm.t / blk);
    const gone = hash2(bi, 7, seed) < robbed;
    if (gone) {
      // Robbed out: the plot's dirt spills a pixel or two over the line, which
      // is what breaks the straight edge even where there is no stone left.
      const nrm = outward(sm);
      for (let k = 0; k <= 2; k++) {
        const x = sm.x + Math.round(nrm.x * k), y = sm.y + Math.round(nrm.y * k);
        if (hash2(x, y, seed + 5) < 0.42 - k * 0.11) s.setHex(x, y, step(earth, 1 + (k & 1)));
      }
      return;
    }
    const joint = (sm.t % blk) < 1.2;
    const wob = hash2(bi, 3, seed) < 0.3 ? -1 : 0;        // a settled course
    // The cap is the only bright value in the run, and a CONSTANT bright cap
    // is what turned the first pass into a white pipe laid round the plot —
    // an unbroken 1px highlight tracks the eye exactly as well as the hard
    // colour edge it was meant to hide. Per-block, so half the stones catch
    // the sun and half do not.
    const cap = 3 + (hash2(bi, 5, seed) > 0.52 ? 1 : 0) + wob;
    if (sm.steep) {
      for (let k = 0; k < 3; k++) {
        let idx = (k === 0 ? cap : k === 1 ? 2 : 0) + (joint ? -2 : 0);
        s.setHex(sm.x - 1 + k, sm.y, step(stone, clamp(idx, 0, 4)));
      }
      T.shadePixel(s, sm.x + 2, sm.y, 0.30);
    } else {
      const h = H + wob;
      for (let v = 0; v < h; v++) {
        let idx = v === h - 1 ? cap : v === h - 2 ? 3 : v === 0 ? 0 : 2;
        if (joint && v < h - 1) idx -= 2;
        s.setHex(sm.x, sm.y - v, step(stone, clamp(idx, 0, 4)));
      }
      T.shadePixel(s, sm.x + 1, sm.y + 1, 0.32);          // cast, down-right
    }
  });

  // --- 3. loose stones where the kerb went ---------------------------------
  const period = o.stoneEvery === undefined ? 23 : o.stoneEvery;
  if (period > 0) samples.forEach((sm) => {
    if (Math.abs(sm.t % period) > 0.6) return;
    const i = Math.floor(sm.t / period);
    if (hash2(i, 11, seed) > 0.62) return;
    const nrm = outward(sm);
    const off = 3 + Math.round(hash2(i, 13, seed) * 4);
    const cx = Math.round(sm.x + nrm.x * off), cy = Math.round(sm.y + nrm.y * off * 0.6);
    const rx = 2 + Math.round(hash2(i, 17, seed) * 2), ry = 1 + Math.round(hash2(i, 19, seed));
    T.shadePixel(s, cx + 1, cy + ry, 0.34);
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1.05) continue;
        s.setHex(cx + dx, cy + dy, step(stone, dy < 0 ? 4 : dx < 0 ? 3 : 1));
      }
    }
  });

  // --- 4. the scrub line ----------------------------------------------------
  // Lalang straddling the kerb. Foliage crossing the boundary is what stops the
  // eye tracking the line, and it is also just what an unswept plot looks like.
  const tuft = o.tuftEvery === undefined ? 14 : o.tuftEvery;
  if (tuft > 0) samples.forEach((sm) => {
    if (Math.abs(sm.t % tuft) > 0.6) return;
    const i = Math.floor(sm.t / tuft);
    if (hash2(i, 23, seed) > 0.70) return;
    const n = 5 + Math.round(hash2(i, 29, seed) * 5);
    for (let k = 0; k < n; k++) {
      const bx = Math.round(sm.x + (hash2(i, k + 31, seed) - 0.5) * 11);
      const by = Math.round(sm.y + (hash2(i, k + 37, seed) - 0.5) * 4);
      const bh = 3 + Math.round(hash2(i, k + 41, seed) * 5);
      const curl = hash2(i, k + 43, seed) < 0.5 ? -1 : 1;
      const lit = curl < 0;
      for (let v = 0; v < bh; v++) {
        const gx = bx + Math.round(curl * (v / bh) * (v / bh) * 2);
        s.setHex(gx, by - v, step(fol, lit ? 3 : 1));
        s.setHex(gx + 1, by - v, step(fol, lit ? 4 : 2));
      }
    }
  });

  // --- 5. the gutter, and the wear that crosses the line -------------------
  // A KERB ALONE IS STILL A LINE. What stops a paving/street boundary reading
  // as a cut is that the two materials INTERPENETRATE at it: grit and mud off
  // the roadway wash up against the kerb and get trodden a few pixels onto the
  // pavement, and the gutter beside it stays permanently damp. Both are
  // authored as sparse, clustered incident — never a feathered blend, which on
  // a 640x360 plate is anti-aliasing wearing a hat.
  if (o.gutter) {
    samples.forEach((sm) => {
      const nrm = outward(sm);
      const gx = Math.round(sm.x + nrm.x * 1.6), gy = Math.round(sm.y + nrm.y * 1.2) + 1;
      if (hash2(gx, gy, seed + 61) < 0.72) T.shadePixel(s, gx, gy, 0.30);
    });
  }
  const scatter = o.scatter === undefined ? 0 : o.scatter;
  if (scatter > 0) {
    const mat = P.RAMPS[o.scatterMat || 'earth'];
    samples.forEach((sm) => {
      const nrm = outward(sm);
      for (let k = -3; k <= 3; k++) {
        const x = Math.round(sm.x - nrm.x * k), y = Math.round(sm.y - nrm.y * k * 0.6) - (k > 0 ? 1 : 0);
        // density falls off away from the kerb on BOTH sides, so the wear
        // straddles the boundary instead of stopping dead at it
        const d = 1 - Math.abs(k) / 3.6;
        if (hash2(x, y, seed + 67) < scatter * d) s.setHex(x, y, step(mat, k < 0 ? 2 : 1));
      }
    });
  }
});

module.exports = { C, lancet, buttress };
