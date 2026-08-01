'use strict';
/**
 * MELAKA FORGE — FACE FEATURE LIBRARIES
 * =====================================
 * Brow / eye / nose / mouth / ear / age libraries. Each entry is a shape rule,
 * not a stamp: it is evaluated against the skull metrics, so the same "aquiline"
 * nose is a different set of pixels on a broad skull than on a gaunt one.
 *
 * Everything writes either into the shade-modifier field (folds, sockets,
 * highlights — so they read as lit form) or as explicit pixels (lid lines,
 * irises, lip lines).
 */

const { Mask, ellipseMask, rectMask, arcMask, lineMask, polyMask, clamp } = require('./raster.cjs');
const { addMod } = require('./anatomy.cjs');

// ---------------------------------------------------------------------------
// BROWS
// ---------------------------------------------------------------------------
const BROWS = {
  straight: { bow: -0.6, thick: 1, len: 1.00, innerDy: 0, outerDy: 0 },
  arched:   { bow: -2.0, thick: 1, len: 0.96, innerDy: 0.5, outerDy: 0.5 },
  angled:   { bow: -0.4, thick: 2, len: 1.02, innerDy: 1.2, outerDy: -0.8 }, // stern
  bushy:    { bow: -1.0, thick: 2, len: 1.10, innerDy: 0, outerDy: 0.4 },
  thin:     { bow: -1.4, thick: 1, len: 0.86, innerDy: 0, outerDy: 0.3 },
  worried:  { bow: -0.8, thick: 1, len: 0.94, innerDy: -1.3, outerDy: 1.4 },
  heavy:    { bow: -0.3, thick: 2, len: 1.06, innerDy: 0.8, outerDy: 0.2 },
};

function drawBrows(pic, m, spec, skin, mods, colour) {
  const b = BROWS[spec.brow] || BROWS.straight;
  const y = m.yBrow - 1.1 + (spec.browDy || 0);
  const axis = m.axisAt(y);
  const gapN = spec.eyeGapNear * m.U, gapF = spec.eyeGapFar * m.U;
  const half = spec.eyeW * m.U * 0.5 * b.len;
  const d = m.turnDir;
  [[-d, gapN, 1.0], [d, gapF, 0.82]].forEach(([side, gap, squash]) => {
    const cxE = axis + side * gap;
    const inner = axis + side * (gap - half * squash);
    const outer = axis + side * (gap + half * squash);
    const yi = y + b.innerDy, yo = y + b.outerDy;
    const mask = arcMask(m.W, m.H, inner, yi, outer, yo, b.bow, b.thick)
      .and(m.headMask);
    pic.paint(mask, colour);
    addMod(mods, m.W, mask.dilate(1).andNot(mask), -0.5);
    void cxE; void squash;
  });
}

// ---------------------------------------------------------------------------
// EYES
// ---------------------------------------------------------------------------
const EYES = {
  round:    { openH: 3.4, lid: 1, socket: 1.0, w: 1.00, tilt: 0 },
  almond:   { openH: 3.0, lid: 1, socket: 0.9, w: 1.04, tilt: 0.4 },
  narrow:   { openH: 2.2, lid: 1, socket: 0.8, w: 1.10, tilt: 0.5 },
  hooded:   { openH: 2.6, lid: 2, socket: 1.1, w: 1.00, tilt: 0.2 },
  deepset:  { openH: 2.8, lid: 1, socket: 1.5, w: 0.98, tilt: 0 },
  wide:     { openH: 3.6, lid: 1, socket: 0.7, w: 1.08, tilt: -0.2 },
  downturn: { openH: 2.8, lid: 1, socket: 1.0, w: 1.00, tilt: -0.6 },
  squint:   { openH: 2.0, lid: 2, socket: 1.2, w: 0.96, tilt: 0.3 },
};

function drawEyes(pic, m, spec, skin, mods, dark) {
  const e = EYES[spec.eye] || EYES.almond;
  const y = m.yEye + (spec.eyeDy || 0);
  const axis = m.axisAt(y);
  const d = m.turnDir;
  const sclera = spec.scleraHex;
  const halfW = spec.eyeW * m.U * 0.5 * e.w;

  [[-d, spec.eyeGapNear * m.U, 1.0], [d, spec.eyeGapFar * m.U, 0.78]].forEach(([side, gap, squash]) => {
    const c = axis + side * gap;
    const rx = Math.max(1.6, halfW * squash);
    const ry = Math.max(1.15, e.openH * 0.5);
    const cy = y + e.tilt * side * -d * 0.5;

    // socket: a shaded hollow under the brow, wider than the eye
    const socket = ellipseMask(m.W, m.H, c, cy - 0.8, rx + 1.3, ry + 1.5).and(m.headMask);
    addMod(mods, m.W, socket, -0.45 * e.socket, 1);

    // the opening
    const open = ellipseMask(m.W, m.H, c, cy, rx, ry);
    pic.paint(open, sclera);

    // iris, looking slightly toward the viewer; at this scale the pupil is a
    // single darker pixel inside it, not a second shape
    const ix = c + side * -d * 0.30 * rx;
    const iris = ellipseMask(m.W, m.H, ix, cy + 0.25, Math.max(1.2, rx * 0.56), Math.max(1.2, ry * 0.86));
    pic.paint(iris.and(open), spec.irisHex || dark);
    pic.paint(ellipseMask(m.W, m.H, ix, cy + 0.3, 0.55, 0.55).and(open), spec.pupilHex || dark);

    // upper lid line — the single most important pixel row in a pixel face.
    // It sits ON the top edge of the opening so the white below survives.
    const lid = arcMask(m.W, m.H, c - rx - 0.5, cy - ry - 0.15, c + rx + 0.5, cy - ry - 0.15, -0.8, e.lid);
    pic.paint(lid.and(m.headMask), dark);
    // outer corner: one dark pixel anchors the eye in the socket
    pic.paint(ellipseMask(m.W, m.H, c + side * rx * 0.92, cy + 0.35, 0.7, 0.7).and(m.headMask), dark);
    // lower lid: a lit ridge, never a line
    const low = arcMask(m.W, m.H, c - rx, cy + ry + 0.7, c + rx, cy + ry + 0.7, 0.5, 1).and(m.headMask);
    addMod(mods, m.W, low, +0.70);
  });
}

// ---------------------------------------------------------------------------
// NOSES
// ---------------------------------------------------------------------------
const NOSES = {
  straight: { wing: 0.30, len: 1.00, tipDrop: 0, ridge: 1.0, bulb: 0.9 },
  aquiline: { wing: 0.28, len: 1.06, tipDrop: 0.6, ridge: 1.2, bulb: 0.8 },
  hooked:   { wing: 0.30, len: 1.10, tipDrop: 1.4, ridge: 1.1, bulb: 1.0 },
  broad:    { wing: 0.44, len: 0.92, tipDrop: 0, ridge: 0.8, bulb: 1.3 },
  button:   { wing: 0.28, len: 0.82, tipDrop: -0.4, ridge: 0.7, bulb: 1.0 },
  bulbous:  { wing: 0.40, len: 0.96, tipDrop: 0.5, ridge: 0.9, bulb: 1.5 },
  long:     { wing: 0.28, len: 1.14, tipDrop: 0.3, ridge: 1.1, bulb: 0.85 },
  fine:     { wing: 0.24, len: 0.98, tipDrop: 0, ridge: 1.0, bulb: 0.7 },
};

function drawNose(pic, m, spec, skin, mods, dark) {
  const n = NOSES[spec.nose] || NOSES.straight;
  const yTop = m.yBrow + 1;
  const yBase = m.yNoseBase + n.tipDrop;
  const axTop = m.axisAt(yTop), axBase = m.axisAt(yBase);
  const d = m.turnDir;
  const wing = n.wing * m.U;

  // shadow side is always down-right (canon sun is NW)
  const yShade = yTop + (yBase - yTop) * 0.34;   // the ridge only reads below the brow
  const shadow = polyMask(m.W, m.H, [
    [axTop + 0.6, yShade],
    [axBase + wing * 0.80, yBase - 0.8],
    [axBase + wing * 0.95, yBase + 1.0],
    [axTop + 1.5, yShade + 1],
  ]).and(m.headMask);
  addMod(mods, m.W, shadow, -0.80);

  // lit ridge
  const ridge = polyMask(m.W, m.H, [
    [axTop - 0.3, yShade],
    [axBase - wing * 0.30, yBase - 1.4],
    [axBase + 0.2, yBase - 1.4],
    [axTop + 0.5, yShade],
  ]);
  addMod(mods, m.W, ridge, +0.70 * n.ridge);

  // tip / ball
  const tip = ellipseMask(m.W, m.H, axBase + 0.2, yBase - 0.4, wing * 0.72 * n.bulb, 1.5 * n.bulb);
  addMod(mods, m.W, tip, +0.5);
  addMod(mods, m.W, ellipseMask(m.W, m.H, axBase + 0.2, yBase + 1.1, wing * 0.95 * n.bulb, 1.1), -1.0);

  // nostrils: near one reads, far one is a hint
  const nearX = axBase - d * wing * 0.92, farX = axBase + d * wing * 0.86;
  pic.paint(ellipseMask(m.W, m.H, nearX, yBase, 0.9, 0.7).and(m.headMask), dark);
  addMod(mods, m.W, ellipseMask(m.W, m.H, farX, yBase - 0.2, 0.8, 0.6), -1.2);
  // wing creases
  addMod(mods, m.W, arcMask(m.W, m.H, nearX - 1, yBase - 1.6, nearX - 1.4, yBase + 0.6, -0.8, 1), -0.7);
}

// ---------------------------------------------------------------------------
// MOUTHS
// ---------------------------------------------------------------------------
const MOUTHS = {
  thin:      { w: 0.66, bow: 0.0, lip: 0.5, open: 0, corner: 0 },
  full:      { w: 0.70, bow: 0.4, lip: 1.2, open: 0, corner: 0 },
  wide:      { w: 0.88, bow: 0.2, lip: 0.8, open: 0, corner: 0 },
  pursed:    { w: 0.54, bow: 0.0, lip: 1.0, open: 0, corner: -0.4 },
  downturn:  { w: 0.72, bow: 1.5, lip: 0.7, open: 0, corner: 1.2 },
  smirk:     { w: 0.74, bow: 0.3, lip: 0.6, open: 0, corner: -1.3, asym: true },
  smile:     { w: 0.84, bow: -1.5, lip: 0.9, open: 0, corner: -1.4 },
  laugh:     { w: 0.86, bow: -1.8, lip: 0.9, open: 2, corner: -1.6 },
  set:       { w: 0.70, bow: 0.1, lip: 0.6, open: 0, corner: 0.5 },
};

function drawMouth(pic, m, spec, skin, mods, dark) {
  const mo = MOUTHS[spec.mouth] || MOUTHS.set;
  const y = m.yMouth + (spec.mouthDy || 0);
  const axis = m.axisAt(y);
  const d = m.turnDir;
  const half = mo.w * m.U * 0.5;
  const xN = axis - d * half * 1.02, xF = axis + d * half * 0.84; // far side foreshortened

  const yN = y + (mo.asym ? mo.corner : mo.corner * 0.5);
  const yF = y + (mo.asym ? 0 : mo.corner * 0.5);

  // the mouth is THREE painted rows at this scale, not one line: a shadowed
  // upper lip, the dark closure, a lit lower lip. Anything less disappears.
  if (mo.lip >= 0.7) {
    const upper = arcMask(m.W, m.H, xN + d * 0.5, yN - 1.2, xF - d * 0.4, yF - 1.2, mo.bow * 0.9, 1).and(m.headMask);
    pic.paint(upper, skin[1]);
  }

  const line = arcMask(m.W, m.H, xN, yN, xF, yF, mo.bow, mo.lip >= 0.9 ? 2 : 1).and(m.headMask);
  pic.paint(line, spec.lipLineHex || dark);

  const lower = arcMask(m.W, m.H, xN + d * 0.9, yN + (mo.lip >= 0.9 ? 2.1 : 1.2), xF - d * 0.8,
    yF + (mo.lip >= 0.9 ? 2.1 : 1.2), mo.bow * 0.8, 1).and(m.headMask);
  pic.paint(lower, skin[3]);

  if (mo.open) {
    const inner = arcMask(m.W, m.H, xN + d * 1.6, yN + 0.3, xF - d * 1.4, yF + 0.3, mo.bow * 0.5, mo.open);
    pic.paint(inner.and(m.headMask), spec.mouthInnerHex || dark);
  }

  // corners tuck into the cheek; a shadow under the lower lip lifts the chin
  pic.paint(ellipseMask(m.W, m.H, xN, yN + 0.2, 0.8, 0.8).and(m.headMask), spec.lipLineHex || dark);
  addMod(mods, m.W, arcMask(m.W, m.H, xN + d * 1.4, yN + 3.2, xF - d * 1.2, yF + 3.2, mo.bow * 0.6, 1).and(m.headMask), -0.55);
}

// ---------------------------------------------------------------------------
// EAR
// ---------------------------------------------------------------------------
function drawEar(pic, m, spec, skin, mods) {
  if (!m.earSize) return;
  const inner = ellipseMask(m.W, m.H, m.earCx + m.turnDir * 0.4, m.earCy, 0.9 * m.earSize, 1.9 * m.earSize);
  addMod(mods, m.W, inner, -1.3);
  addMod(mods, m.W, m.earMask.rim(1), -0.4);
}

// ---------------------------------------------------------------------------
// AGE / CHARACTER MARKS
// ---------------------------------------------------------------------------
function drawAge(pic, m, spec, skin, mods) {
  const age = clamp(spec.age || 0, 0, 1);
  if (age <= 0.02) return;
  const d = m.turnDir;
  const axis = m.axisAt(m.yBrow);

  // forehead lines
  const lines = age > 0.66 ? 3 : age > 0.38 ? 2 : 1;
  for (let i = 0; i < lines; i++) {
    const yy = m.yBrow - 3 - i * 2.2;
    const hw = m.halfW(yy) * 0.60;
    addMod(mods, m.W, arcMask(m.W, m.H, m.centreX(yy) - hw, yy, m.centreX(yy) + hw, yy, -1.2, 1).and(m.headMask), -0.55 * age);
  }
  // crow's feet
  [[-d, m.axisAt(m.yEye) - d * spec.eyeGapNear * m.U], [d, m.axisAt(m.yEye) + d * spec.eyeGapFar * m.U]]
    .forEach(([side, ex], k) => {
      const x0 = ex + side * spec.eyeW * m.U * 0.55;
      for (let i = 0; i < (age > 0.5 ? 2 : 1); i++) {
        addMod(mods, m.W, lineMask(m.W, m.H, x0, m.yEye - 0.5 + i * 2, x0 + side * 2.2, m.yEye - 1.5 + i * 2.6, 1).and(m.headMask), -0.8 * age * (k ? 0.7 : 1));
      }
    });
  // nasolabial folds
  const nw = (NOSES[spec.nose] || NOSES.straight).wing * m.U;
  const nx = m.axisAt(m.yNoseBase) - d * nw;
  const mx = m.axisAt(m.yMouth) - d * (MOUTHS[spec.mouth] || MOUTHS.set).w * m.U * 0.52;
  addMod(mods, m.W, arcMask(m.W, m.H, nx - d * 0.4, m.yNoseBase + 0.4, mx - d * 0.6, m.yMouth + 1.2, d * 1.0, 1).and(m.headMask), -1.0 * age);
  if (age > 0.45) {
    const fx = m.axisAt(m.yNoseBase) + d * nw;
    addMod(mods, m.W, arcMask(m.W, m.H, fx + d * 0.3, m.yNoseBase + 0.4, fx + d * 0.9, m.yMouth + 0.6, -d * 0.6, 1).and(m.headMask), -0.7 * age);
  }
  // under-eye hollows + sagging cheeks
  if (age > 0.5) {
    const ey = m.yEye + 2.4;
    [[-d, spec.eyeGapNear], [d, spec.eyeGapFar]].forEach(([side, gap]) => {
      addMod(mods, m.W, arcMask(m.W, m.H, m.axisAt(ey) + side * (gap * m.U - 2), ey, m.axisAt(ey) + side * (gap * m.U + 2), ey, 0.9, 1).and(m.headMask), -0.7 * age);
    });
    // neck cords
    addMod(mods, m.W, arcMask(m.W, m.H, m.neckCx - m.neckW * 0.5, m.chinY + 3, m.neckCx - m.neckW * 0.3, m.neckBottom - 1, 0.6, 1).and(m.neckMask), -0.5 * age);
  }
  // hollow cheeks (gaunt characters push this up)
  if (spec.cheekHollow) {
    [[-d, 1.0], [d, 0.7]].forEach(([side, k]) => {
      const cy = (m.yNoseBase + m.yJaw) / 2;
      const cxx = m.centreX(cy) + side * m.halfW(cy) * 0.62;
      addMod(mods, m.W, ellipseMask(m.W, m.H, cxx, cy, 2.6, 3.6).and(m.headMask), -1.15 * spec.cheekHollow * k, 1);
    });
  }
  // cheekbone catchlights
  if (spec.cheekBoneHi) {
    [[-d, 1.0], [d, 0.6]].forEach(([side, k]) => {
      const cy = m.yCheek - 0.5;
      const cxx = m.centreX(cy) + side * m.halfW(cy) * 0.66;
      addMod(mods, m.W, ellipseMask(m.W, m.H, cxx, cy, 2.4, 1.8).and(m.headMask), +0.9 * spec.cheekBoneHi * k);
    });
  }
  // scar
  if (spec.scar) {
    const s = spec.scar;
    addMod(mods, m.W, lineMask(m.W, m.H, s[0], s[1], s[2], s[3], 1).and(m.headMask), -1.4);
    addMod(mods, m.W, lineMask(m.W, m.H, s[0] + 1, s[1], s[2] + 1, s[3], 1).and(m.headMask), +0.9);
  }
}

/** Jaw / chin / temple structure that must sit under everything else. */
function drawStructure(m, spec, mods) {
  const d = m.turnDir;
  // shadow under the jaw and along the neck
  const under = m.neckMask.clone().and(rectMask(m.W, m.H, 0, m.chinY - 6, m.W - 1, m.chinY + 3));
  addMod(mods, m.W, under, -0.95);
  // bounce off the chest keeps the throat from going to a flat black block
  addMod(mods, m.W, m.neckMask.clone().and(rectMask(m.W, m.H, 0, m.chinY + 4, m.W - 1, m.H - 1)), +0.55);
  // temple hollow
  [[-d, 1.0], [d, 0.55]].forEach(([side, k]) => {
    const ty = m.yBrow - 2;
    const tx = m.centreX(ty) + side * m.halfW(ty) * 0.80;
    addMod(mods, m.W, ellipseMask(m.W, m.H, tx, ty, 2.4, 3.0).and(m.headMask), -0.32 * k);
  });
  // chin ball
  const cy = m.chinY - 2.4;
  addMod(mods, m.W, ellipseMask(m.W, m.H, m.axisAt(cy), cy, m.U * 0.24, 1.9).and(m.headMask), +0.55);
  // rim of the whole head reads darker (ambient occlusion against the backdrop)
  addMod(mods, m.W, m.headMask.rim(1), -0.50);
}

module.exports = { BROWS, EYES, NOSES, MOUTHS, drawBrows, drawEyes, drawNose, drawMouth, drawEar, drawAge, drawStructure };
