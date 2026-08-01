'use strict';
/**
 * MELAKA FORGE — PORTRAIT SKELETON
 * ================================
 * The seeded skeleton every face is built on. A head is NOT a template with a
 * recolour: it is a skull shape (7 in the library) driving a per-row contour
 * function, plus independent jaw / brow / cheek / neck / shoulder parameters,
 * posed in a 3/4 turn.
 *
 * Construction of the 3/4 view (the whole reason faces read as heads and not
 * as masks):
 *   - the silhouette centre drifts toward the turn as it descends (crown over
 *     the spine, chin over the turned face plane),
 *   - the back-of-skull side gains width, the face side loses it,
 *   - the face axis sits `turnPx` off the crown centre,
 *   - the far eye is closer to the axis and narrower than the near eye,
 *   - the visible ear is on the back-of-skull side only,
 *   - an aquiline nose may break the face-side contour.
 *
 * Light is the canon sun: NW, 30 deg up, warm amber key, violet ambient.
 */

const { Mask, spanMask, ellipseMask, curve, clamp } = require('./raster.cjs');

// ---------------------------------------------------------------------------
// SKULL LIBRARY — relative half-widths at the control rows
// ---------------------------------------------------------------------------
// temple  widest cranium (fraction of the head's half-width unit)
// brow    at the brow ridge
// cheek   at the cheekbone
// jaw     at the jaw angle (gonion)
// chin    at the chin
// crownN  superellipse exponent for the top of the skull (2.0 round, 3.4 flat)
// chinN   1 = pointed chin taper, 2 = square
const SKULLS = {
  oval:     { temple: 0.94, brow: 0.97, cheek: 0.95, jaw: 0.78, chin: 0.46, crownN: 2.3, chinN: 1.5 },
  long:     { temple: 0.86, brow: 0.90, cheek: 0.88, jaw: 0.74, chin: 0.44, crownN: 2.6, chinN: 1.6 },
  square:   { temple: 0.96, brow: 1.00, cheek: 1.00, jaw: 0.96, chin: 0.72, crownN: 3.1, chinN: 2.4 },
  heart:    { temple: 0.98, brow: 1.00, cheek: 0.94, jaw: 0.66, chin: 0.36, crownN: 2.4, chinN: 1.2 },
  broad:    { temple: 1.00, brow: 1.02, cheek: 1.05, jaw: 0.90, chin: 0.60, crownN: 2.8, chinN: 2.0 },
  diamond:  { temple: 0.82, brow: 0.90, cheek: 1.04, jaw: 0.70, chin: 0.40, crownN: 2.5, chinN: 1.3 },
  round:    { temple: 0.98, brow: 1.00, cheek: 1.02, jaw: 0.88, chin: 0.62, crownN: 2.1, chinN: 2.2 },
  gaunt:    { temple: 0.88, brow: 0.92, cheek: 0.82, jaw: 0.70, chin: 0.42, crownN: 2.7, chinN: 1.4 },
  shrunken: { temple: 0.90, brow: 0.92, cheek: 0.86, jaw: 0.72, chin: 0.50, crownN: 2.2, chinN: 1.8 },
};

const SUN_L = (() => {
  const v = [-0.44, -0.56, 0.70];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

/**
 * @param p.skull      key of SKULLS
 * @param p.cx         crown centre x
 * @param p.top        y of the crown
 * @param p.chinY      y of the chin
 * @param p.halfW      head half-width unit in px
 * @param p.turn       -1..1, +1 = face turned toward image-right
 * @param p.jawScale   extra multiplier on jaw + chin width (heavy vs delicate)
 * @param p.cheekBone  extra multiplier at the cheek row
 * @param p.browY,eyeY,noseBaseY,mouthY  fractions of head height (defaults are
 *                     the classical thirds, shifted per character)
 * @param p.noseBreak  px the nose pushes past the face-side contour
 */
function buildHead(W, H, p) {
  const skull = SKULLS[p.skull] || SKULLS.oval;
  const cx = p.cx, top = p.top, chinY = p.chinY;
  const hh = chinY - top;
  const U = p.halfW;
  const turn = clamp(p.turn == null ? 0.7 : p.turn, -1, 1);
  const turnDir = turn >= 0 ? 1 : -1;
  const turnPx = turn * U * 0.42;

  const yTemple = top + 0.24 * hh;
  const yBrow = top + (p.browY != null ? p.browY : 0.44) * hh;
  const yEye = top + (p.eyeY != null ? p.eyeY : 0.52) * hh;
  const yCheek = top + 0.64 * hh;
  const yNoseBase = top + (p.noseBaseY != null ? p.noseBaseY : 0.72) * hh;
  const yMouth = top + (p.mouthY != null ? p.mouthY : 0.845) * hh;
  const yJaw = top + 0.84 * hh;

  const jawScale = p.jawScale == null ? 1 : p.jawScale;
  const cheekScale = p.cheekBone == null ? 1 : p.cheekBone;

  const wTemple = U * skull.temple;
  const lower = [
    [yTemple, wTemple],
    [yBrow, U * skull.brow],
    [yCheek, U * skull.cheek * cheekScale],
    [yCheek + (yJaw - yCheek) * 0.5, U * (skull.cheek * 0.55 + skull.jaw * 0.45) * jawScale],
    [yJaw, U * skull.jaw * jawScale],
    [yJaw + (chinY - yJaw) * 0.45, U * (skull.jaw * 0.40 + skull.chin * 0.60) * jawScale],
    [chinY - 1.2, U * skull.chin * jawScale],
    [chinY + 0.4, U * skull.chin * jawScale * 0.60],
  ];

  function halfW(y) {
    if (y <= yTemple) {
      const rc = yTemple - top + 0.9;
      const t = clamp((yTemple - y) / rc, 0, 1);
      const n = skull.crownN;
      return wTemple * Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n);
    }
    return curve(lower, y);
  }

  // silhouette centre drifts toward the turn as it descends
  function centreX(y) {
    const t = clamp((y - top) / hh, 0, 1.2);
    return cx + turnPx * (0.62 * t * t + 0.10 * t);
  }
  // face plane axis: where eyes / nose / mouth are centred
  function axisAt(y) {
    const t = clamp((y - top) / hh, 0, 1.2);
    return cx + turnPx * (0.72 + 0.34 * t);
  }

  const backMul = 1 + 0.17 * Math.abs(turn);   // back-of-skull side gains
  const faceMul = 1 - 0.11 * Math.abs(turn);   // face side loses

  function left(y) {
    const m = turnDir > 0 ? backMul : faceMul;
    let x = centreX(y) - halfW(y) * m;
    if (turnDir < 0) x -= noseBreakAt(y);
    return x;
  }
  function right(y) {
    const m = turnDir > 0 ? faceMul : backMul;
    let x = centreX(y) + halfW(y) * m;
    if (turnDir > 0) x += noseBreakAt(y);
    return x;
  }
  const noseBreak = p.noseBreak || 0;
  function noseBreakAt(y) {
    if (!noseBreak) return 0;
    const y0 = yBrow + 1, y1 = yNoseBase + 1;
    if (y < y0 || y > y1) return 0;
    const t = (y - y0) / (y1 - y0);
    return noseBreak * Math.sin(Math.PI * Math.pow(t, 0.85));
  }

  const headMask = spanMask(W, H, top, chinY + 1, (y) => [left(y), right(y) - 0.001]);

  // --- ear on the back-of-skull side ---------------------------------------
  const earSize = p.earSize == null ? 1 : p.earSize;
  const earCy = (yEye + yNoseBase) / 2;
  const earCx = turnDir > 0 ? left(earCy) + 1.2 : right(earCy) - 1.2;
  const earMask = earSize <= 0 ? new Mask(W, H)
    : ellipseMask(W, H, earCx, earCy, 1.7 * earSize, 3.2 * earSize);

  // --- neck ----------------------------------------------------------------
  const neckW = (p.neckW == null ? 0.62 : p.neckW) * U;
  const neckTop = chinY - Math.round(hh * 0.10);
  const neckBottom = chinY + (p.neckLen == null ? 7 : p.neckLen);
  const neckCx = cx + turnPx * 0.30 + (p.neckLean || 0);
  const neckMask = spanMask(W, H, neckTop, neckBottom, (y) => {
    const t = clamp((y - neckTop) / Math.max(1, neckBottom - neckTop), 0, 1);
    const w = neckW * (0.90 + 0.34 * t * t);
    const c = neckCx + (p.neckTilt || 0) * t;
    return [c - w, c + w];
  });

  return {
    W, H, cx, top, chinY, hh, U, turn, turnDir, turnPx,
    yTemple, yBrow, yEye, yCheek, yNoseBase, yMouth, yJaw,
    neckTop, neckBottom, neckCx, neckW,
    halfW, centreX, axisAt, left, right,
    headMask, earMask, neckMask,
    earCx, earCy, earSize,
    skullKey: p.skull, params: p,
  };
}

// ---------------------------------------------------------------------------
// SKIN SHADING — one sun, spherical-ish falloff, plus painted modifier fields
// ---------------------------------------------------------------------------
/**
 * Returns a shade-index field (Float32Array of 0..4) for the head volume.
 * Callers add local modifiers (sockets, folds, highlights) before painting.
 */
function skinField(m, opts = {}) {
  const { W, H } = m;
  const f = new Float32Array(W * H);
  const yMid = (m.top + m.chinY) / 2;
  const flatten = opts.flatten == null ? 0.72 : opts.flatten;
  for (let y = 0; y < H; y++) {
    const hw = Math.max(1, m.halfW(y));
    const c = m.centreX(y);
    for (let x = 0; x < W; x++) {
      const nx = clamp((x + 0.5 - c) / hw, -1, 1);
      const ny = clamp((y + 0.5 - yMid) / (m.hh * 0.62), -1, 1);
      const nz = Math.sqrt(Math.max(0.02, 1 - flatten * (nx * nx * 0.86 + ny * ny * 0.42)));
      const d = nx * SUN_L[0] + ny * SUN_L[1] + nz * SUN_L[2];
      // Skin lives in the TOP half of its ramp: a face is a lit object, not a
      // sphere in a void. The full dark end is reserved for painted shadow
      // (sockets, under the jaw, under the nose), which arrives via `mods`.
      f[y * W + x] = clamp(2.10 + (d - 0.62) * 3.35, 0.80, 3.98);
    }
  }
  return f;
}

/** Paint a skin region from a shade field + modifier map. */
function paintSkin(pic, mask, field, mods, skin) {
  const W = pic.w;
  mask.forEach((x, y) => {
    const i = y * W + x;
    const v = clamp(field[i] + (mods ? mods[i] : 0), 0, 4);
    pic.set(x, y, skin[Math.min(4, Math.round(v))]);
  });
}

/** Add a modifier over a mask (feathered by `soft` extra rings at half value). */
function addMod(mods, W, mask, amount, soft = 0) {
  mask.forEach((x, y) => { mods[y * W + x] += amount; });
  if (soft > 0) {
    const ring = mask.dilate(soft).andNot(mask);
    ring.forEach((x, y) => { mods[y * W + x] += amount * 0.45; });
  }
  return mods;
}

module.exports = { SKULLS, buildHead, skinField, paintSkin, addMod, SUN_L };
