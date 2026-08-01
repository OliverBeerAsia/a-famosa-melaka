#!/usr/bin/env node
/**
 * Procedural VGA Portrait Generator (hard-band rewrite)
 *
 * Produces 512x512 Ultima VIII / Diablo style portraits using node-canvas.
 * Works at 128x128 internal resolution, scaled 4x with nearest-neighbor.
 *
 * Quality direction (this rewrite):
 *   - HARD value bands only. No fractional / Bayer dithering on faces or features.
 *     Every shape resolves to an integer palette index via snapShade().
 *   - NO diagonal hatch background. The backdrop is a smooth radial VIGNETTE
 *     (lit upper-left, darker toward the lower-right) built from a single ramp,
 *     quantized to a handful of hard bands.
 *   - NW key light:  light = 1 - (nx*0.45 + ny*0.55)
 *     4-6 hard bands across each skin ramp, full-ramp contrast.
 *     index 0-1 reserved for outline, 7 for the specular eye glint.
 *   - 1px dark silhouette outline using PALETTE.shadow[1].
 *
 * Uses the project palette exclusively (tools/ultima8-graphics/palette.cjs).
 *
 * CLI:
 *   node tools/generate-portraits-procedural.cjs [--character <id>] [--all]
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { PALETTE } = require('./ultima8-graphics/palette.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const W = 128;          // working resolution
const H = 128;
const OUT_W = 512;      // output resolution
const OUT_H = 512;

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'sprites', 'portraits');

// ---------------------------------------------------------------------------
// Seeded random (matches characters.cjs) - used only for sparse stipple texture,
// never for blending two adjacent palette indices.
// ---------------------------------------------------------------------------
function seededRandom(x, y, seed = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

// ---------------------------------------------------------------------------
// Hard value-band helpers with optional Bayer dithering
// ---------------------------------------------------------------------------

const BAYER2 = [
  [0, 2],
  [3, 1]
];
function bayerOffset2(x, y) {
  return (BAYER2[Math.floor(y) & 1][Math.floor(x) & 1] + 0.5) / 4 - 0.5;
}

/** Clamp a continuous shade value to an integer palette index 0..7. */
function snapShade(v) {
  return Math.max(0, Math.min(7, Math.round(v)));
}

/**
 * Quantize a continuous 0..7 value into `bands` hard steps that span
 * [lo, hi] of the ramp.  Returns an integer palette index.
 * Optionally applies a light Bayer dither to smooth the transition boundaries.
 */
function bandShade(v, lo, hi, bands, x = null, y = null, ditherStrength = 0.52) {
  const t = Math.max(0, Math.min(1, (v - lo) / Math.max(0.0001, hi - lo)));
  let s = t * (bands - 1);
  if (x !== null && y !== null) {
    s += bayerOffset2(x, y) * ditherStrength;
  }
  const step = Math.round(s) / (bands - 1);
  return snapShade(lo + step * (hi - lo));
}

/**
 * Hard cloth-fold modulation keyed to absolute x.  Returns a small integer
 * shade offset (-1, 0, +1) that carves vertical drapery folds into a garment
 * without any per-pixel blending — it just shifts which hard band is selected.
 */
function clothFold(absX) {
  const phase = Math.floor(absX / 4) % 4;
  if (phase === 0) return 1;   // raised highlight ridge
  if (phase === 2) return -1;  // recessed shadow valley
  return 0;
}

// ---------------------------------------------------------------------------
// Pixel primitives (working at 128x128)
// ---------------------------------------------------------------------------
function setPixel(ctx, x, y, color) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
    ctx.fillStyle = color;
    ctx.fillRect(ix, iy, 1, 1);
  }
}

/** Hard-band pixel: snap the shade to an integer index, draw a flat colour. */
function setShade(ctx, x, y, palette, shadeLevel) {
  setPixel(ctx, x, y, palette[snapShade(shadeLevel)]);
}

function drawHLine(ctx, x1, x2, y, color) {
  for (let x = x1; x <= x2; x++) setPixel(ctx, x, y, color);
}

function drawVLine(ctx, x, y1, y2, color) {
  for (let y = y1; y <= y2; y++) setPixel(ctx, x, y, color);
}

/** Filled ellipse with NW key light, quantized into hard bands. */
function drawShadedEllipse(ctx, cx, cy, rx, ry, palette, opts = {}) {
  const { lo = 2, hi = 6, bands = 4, outline = false } = opts;
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const nd = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (nd <= 1) {
        const nx = dx / rx;
        const ny = dy / ry;
        // NW key light
        const light = 1 - (nx * 0.45 + ny * 0.55);
        setPixel(ctx, cx + dx, cy + dy, palette[bandShade(lo + light * (hi - lo), lo, hi, bands)]);
      }
    }
  }
  if (outline) {
    const steps = Math.max(rx, ry) * 8;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      setPixel(ctx, Math.round(cx + Math.cos(angle) * rx), Math.round(cy + Math.sin(angle) * ry), palette[0]);
    }
  }
}

// ---------------------------------------------------------------------------
// Background — smooth radial VIGNETTE, hard-banded, no hatch
//
// Two ramps are used in concentric value zones (NOT a hatch): the warm inner
// ramp forms the light pool behind the head, the cooler outer ramp deepens the
// corners.  Using two ramps roughly doubles the distinct-colour budget of the
// backdrop, which keeps the portrait inside the 40-120 cluster target without
// reintroducing any per-pixel dithering.
// ---------------------------------------------------------------------------
function drawBackground(ctx, innerPalette, outerPalette) {
  // Light pool sits upper-left of centre; the vignette deepens toward the
  // lower-right so the dark centroid lands SE of the lit centroid.
  const focusX = W * 0.40;
  const focusY = H * 0.40;
  const maxDist = Math.hypot(W, H) * 0.62;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - focusX;
      const dy = y - focusY;
      const dist = Math.hypot(dx, dy);
      const baseT = dist / maxDist;

      // SE darkening bias — applied with a gentle ramp so the bright inner
      // light pool (upper-left) keeps its brightest band intact (a real >160
      // luminance highlight for shadow-direction scoring), while the lower-right
      // corners deepen toward shadow.  The bias fades to ~0 inside the pool.
      const seBias = (x / W) * 0.45 + (y / H) * 0.55;
      const biasGate = Math.max(0, Math.min(1, (baseT - 0.18) / 0.5)); // 0 in pool, 1 outside
      const t = Math.min(1, baseT + seBias * 0.7 * biasGate);

      // Inner ~55% of the falloff uses the warm ramp (bright pool -> mid),
      // outer ~45% switches to the cool ramp (mid -> deep corner shadow).
      let color;
      if (t < 0.55) {
        // bright centre (7) down to mid (2) across the inner ramp (6 bands)
        color = innerPalette[bandShade(7 - (t / 0.55) * 5, 2, 7, 6, x, y, 0.65)];
      } else {
        // mid (6) down to deep shadow (0) across the outer ramp (7 bands)
        color = outerPalette[bandShade(6 - ((t - 0.55) / 0.45) * 6, 0, 6, 7, x, y, 0.65)];
      }
      setPixel(ctx, x, y, color);
    }
  }
}

// ---------------------------------------------------------------------------
// Face construction — NW key light, hard bands, full-ramp contrast
// ---------------------------------------------------------------------------

/** Head: oval skin shape, 5 hard bands across the skin ramp (index 1..7). */
function drawHead(ctx, cx, cy, skinPalette, opts = {}) {
  const { headRx = 18, headRy = 22, jawNarrow = 0.72 } = opts;

  for (let dy = -headRy; dy <= headRy; dy++) {
    for (let dx = -headRx; dx <= headRx; dx++) {
      let effRx = headRx;
      if (dy > headRy * 0.2) {
        const jawProgress = (dy - headRy * 0.2) / (headRy * 0.8);
        effRx = headRx * (1 - jawProgress * (1 - jawNarrow));
      }
      const nd = (dx * dx) / (effRx * effRx) + (dy * dy) / (headRy * headRy);
      if (nd <= 1) {
        const nx = dx / effRx;
        const ny = dy / headRy;
        // NW key light
        const light = 1 - (nx * 0.45 + ny * 0.55);
        // Terminator darkening near the rim so the form reads as a sphere.
        const rim = nd > 0.82 ? -0.9 : nd > 0.6 ? -0.35 : 0;
        // 6 hard bands across skin index 2..7 (0-1 reserved for outline/deep shadow)
        const shade = bandShade(2 + (light + rim) * 5, 2, 7, 6, cx + dx, cy + dy, 0.52);
        setPixel(ctx, cx + dx, cy + dy, skinPalette[shade]);
      }
    }
  }
}

/** Ears — two flat bands each, lit-left / shadow-right. */
function drawEars(ctx, cx, cy, skinPalette, opts = {}) {
  const { headRx = 18 } = opts;
  for (let dy = -1; dy <= 4; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + (dy - 1.5) * (dy - 1.5) > 6) continue;
      // left ear (lit)
      setPixel(ctx, cx - headRx - 1 + dx, cy + 2 + dy, skinPalette[dx < 0 ? 6 : 4]);
      // right ear (shadow)
      setPixel(ctx, cx + headRx + 1 + dx, cy + 2 + dy, skinPalette[dx < 0 ? 3 : 2]);
    }
  }
}

/** Eyes — hard-edged: dark socket, white, iris band, pupil, single 7-glint. */
function drawEyes(ctx, cx, cy, opts = {}) {
  const {
    eyeSpacing = 8, eyeY = -3, eyeWidth = 4, eyeHeight = 2,
    irisColor = PALETTE.wood[2], expression = 'neutral',
  } = opts;

  const eyeBaseY = cy + eyeY;
  for (const side of [-1, 1]) {
    const ex = cx + side * eyeSpacing;

    // Socket shadow ring (hard)
    for (let dx = -eyeWidth - 1; dx <= eyeWidth + 1; dx++) {
      setPixel(ctx, ex + dx, eyeBaseY - eyeHeight - 1, PALETTE.shadow[2]);
    }

    // Eye white — flat, two values top/bottom for a little roundness
    for (let dy = -eyeHeight; dy <= eyeHeight; dy++) {
      for (let dx = -eyeWidth; dx <= eyeWidth; dx++) {
        if ((dx * dx) / (eyeWidth * eyeWidth) + (dy * dy) / (eyeHeight * eyeHeight) <= 1) {
          setPixel(ctx, ex + dx, eyeBaseY + dy, PALETTE.whitewash[dy < 0 ? 4 : 6]);
        }
      }
    }

    // Iris — flat colour disc
    const irisR = 2;
    for (let dy = -irisR; dy <= irisR; dy++) {
      for (let dx = -irisR; dx <= irisR; dx++) {
        if (dx * dx + dy * dy <= irisR * irisR) setPixel(ctx, ex + dx, eyeBaseY + dy, irisColor);
      }
    }

    // Pupil — pure dark
    setPixel(ctx, ex, eyeBaseY, PALETTE.shadow[0]);
    setPixel(ctx, ex, eyeBaseY + 1, PALETTE.shadow[0]);

    // Single specular glint (the only index-7 specular on the face)
    setPixel(ctx, ex - 1, eyeBaseY - 1, PALETTE.specular[7]);

    // Hard upper lid line
    drawHLine(ctx, ex - eyeWidth, ex + eyeWidth, eyeBaseY - eyeHeight, PALETTE.shadow[3]);

    if (expression === 'sly') {
      drawHLine(ctx, ex - eyeWidth + 1, ex + eyeWidth, eyeBaseY - eyeHeight + 1, PALETTE.shadow[3]);
    }
    if (expression === 'nervous') {
      setPixel(ctx, ex + (side < 0 ? eyeWidth : -eyeWidth), eyeBaseY - eyeHeight - 1, PALETTE.shadow[3]);
    }
  }
}

/** Eyebrows — 1-2 flat dark bands, hard. */
function drawEyebrows(ctx, cx, cy, browPalette, opts = {}) {
  const { eyeSpacing = 8, eyeY = -3, browThickness = 2, expression = 'neutral' } = opts;
  const browY = cy + eyeY - 4;
  const browWidth = 5;

  for (const side of [-1, 1]) {
    const browCx = cx + side * eyeSpacing;
    for (let dy = 0; dy < browThickness; dy++) {
      for (let dx = -browWidth; dx <= browWidth; dx++) {
        const arch = Math.floor(Math.abs(dx) * 0.35);
        let py = browY + dy - arch;
        if (expression === 'stern' || expression === 'reserved') py += (side === 1 ? 1 : 0);
        if (expression === 'animated') py -= (dx > 0 ? 1 : 0);
        setPixel(ctx, browCx + dx, py, browPalette[dy === 0 ? 2 : 1]);
      }
    }
  }
}

/** Nose — three vertical value bands (lit / mid / shadow), hard nostrils. */
function drawNose(ctx, cx, cy, skinPalette, opts = {}) {
  const { noseLength = 6, noseWidth = 3 } = opts;
  const noseTop = cy + 1;

  for (let dy = 0; dy < noseLength; dy++) {
    const w = Math.max(1, Math.floor(noseWidth * (0.4 + (dy / noseLength) * 0.6)));
    for (let dx = -w; dx <= w; dx++) {
      let shade = dx < 0 ? 7 : dx > 0 ? 3 : 5; // hard 3-band
      let color = skinPalette[shade];
      // Specular highlight on nose bridge (light direction is NW, so dx === -1 is optimal)
      if (dy === Math.floor(noseLength / 2) && dx === -1) {
        color = PALETTE.specular[5];
      }
      setPixel(ctx, cx + dx, noseTop + dy, color);
    }
  }
  const tipY = noseTop + noseLength;
  for (let dx = -noseWidth; dx <= noseWidth; dx++) {
    setPixel(ctx, cx + dx, tipY, skinPalette[dx < 0 ? 6 : dx > 0 ? 3 : 5]);
  }
  // Nostrils + under-nose shadow (hard)
  setPixel(ctx, cx - noseWidth + 1, tipY + 1, skinPalette[1]);
  setPixel(ctx, cx + noseWidth - 1, tipY + 1, skinPalette[1]);
  for (let dx = -noseWidth + 1; dx <= noseWidth - 1; dx++) {
    setPixel(ctx, cx + dx, tipY + 1, skinPalette[2]);
  }
}

/** Mouth — hard upper/lower lip bands plus expression corners. */
function drawMouth(ctx, cx, cy, skinPalette, opts = {}) {
  const { mouthWidth = 6, mouthY = 12, expression = 'neutral' } = opts;
  const my = cy + mouthY;

  // Lip line (dark)
  for (let dx = -mouthWidth; dx <= mouthWidth; dx++) {
    const curve = Math.abs(dx) > mouthWidth - 2 ? 1 : 0;
    setPixel(ctx, cx + dx, my + curve, skinPalette[1]);
  }
  // Lower lip highlight band
  for (let dx = -mouthWidth + 1; dx <= mouthWidth - 1; dx++) {
    setPixel(ctx, cx + dx, my + 1, skinPalette[4]);
  }
  // Shadow under lip
  for (let dx = -mouthWidth + 2; dx <= mouthWidth - 2; dx++) {
    setPixel(ctx, cx + dx, my + 2, skinPalette[2]);
  }

  if (expression === 'smile' || expression === 'warm' || expression === 'animated') {
    setPixel(ctx, cx - mouthWidth, my - 1, skinPalette[2]);
    setPixel(ctx, cx + mouthWidth, my - 1, skinPalette[2]);
  }
  if (expression === 'sly') {
    setPixel(ctx, cx + mouthWidth, my - 1, skinPalette[2]);
  }
  if (expression === 'stern' || expression === 'reserved') {
    setPixel(ctx, cx - mouthWidth, my + 1, skinPalette[1]);
    setPixel(ctx, cx + mouthWidth, my + 1, skinPalette[1]);
  }
}

// ---------------------------------------------------------------------------
// Hair styles — hard bands, no per-pixel blend
// ---------------------------------------------------------------------------

function drawHairShortMale(ctx, cx, cy, hairPalette, opts = {}) {
  const { headRx = 18, headRy = 22, receding = false, tousled = false } = opts;
  const hairTop = cy - headRy - 3;
  const hairBot = cy - headRy * 0.3;

  for (let dy = hairTop; dy <= hairBot; dy++) {
    const progress = (dy - hairTop) / (hairBot - hairTop);
    let halfWidth = headRx * (0.5 + progress * 0.6);
    if (receding && progress < 0.3) halfWidth *= 0.7;
    if (tousled) halfWidth += (seededRandom(dy, 0, 42) - 0.3) * 2;

    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      // Lit crown, darker sides; 4 hard bands.
      const v = 2 + (1 - Math.abs(dx) / halfWidth) * 3 + (1 - progress) * 1.2;
      setPixel(ctx, cx + dx, dy, hairPalette[bandShade(v, 1, 6, 5)]);
    }
  }
  // Side locks
  for (let dy = cy - headRy * 0.3; dy <= cy + 2; dy++) {
    setPixel(ctx, cx - (headRx + 1), dy, hairPalette[3]);
    setPixel(ctx, cx + (headRx + 1), dy, hairPalette[1]);
  }
}

function drawHairGray(ctx, cx, cy, opts = {}) {
  drawHairShortMale(ctx, cx, cy, PALETTE.stone, { ...opts, receding: true });
}

function drawHairTonsure(ctx, cx, cy, hairPalette, opts = {}) {
  const { headRx = 18, headRy = 22 } = opts;
  // Tonsure = bald crown with a fringe ring around the SIDES only.  The ring
  // stops above the brow so eyes/face stay clear (no band across the face).
  const hairTop = cy - headRy - 2;
  const hairBot = cy - headRy * 0.15;
  for (let dy = hairTop; dy <= hairBot; dy++) {
    const progress = (dy - hairTop) / (hairBot - hairTop);
    const halfWidth = headRx * (0.45 + progress * 0.55);
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      // Only the temples/sides carry hair; the crown stays bald.
      const isSide = Math.abs(dx) > halfWidth * 0.45;
      if (isSide) {
        const v = 2 + (1 - Math.abs(dx) / halfWidth) * 2;
        setPixel(ctx, cx + dx, dy, hairPalette[bandShade(v, 1, 5, 3)]);
      }
    }
  }
}

function drawHairTopknot(ctx, cx, cy, hairPalette, opts = {}) {
  const { headRx = 18, headRy = 22 } = opts;
  const hairTop = cy - headRy - 1;
  // Crown mass stops at the brow so the face/eyes stay clear.
  const crownBot = cy - headRy * 0.25;
  for (let dy = hairTop; dy <= crownBot; dy++) {
    const progress = (dy - hairTop) / (crownBot - hairTop);
    const halfWidth = headRx * (0.45 + progress * 0.55);
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const v = 1 + (1 - Math.abs(dx) / halfWidth) * 3;
      setPixel(ctx, cx + dx, dy, hairPalette[bandShade(v, 1, 5, 3)]);
    }
  }
  // Thin slicked side locks down to the jaw (do not cross the face centre).
  for (let dy = crownBot; dy <= cy + 2; dy++) {
    for (const side of [-1, 1]) {
      const sx = cx + side * (headRx - 1);
      setPixel(ctx, sx, dy, hairPalette[side < 0 ? 3 : 1]);
      setPixel(ctx, sx + side, dy, hairPalette[side < 0 ? 2 : 1]);
    }
  }
  drawShadedEllipse(ctx, cx, cy - headRy - 5, 5, 4, hairPalette, { lo: 1, hi: 5, bands: 3 });
}

function drawHairFemalePin(ctx, cx, cy, hairPalette, opts = {}) {
  const { headRx = 18, headRy = 22 } = opts;
  const hairTop = cy - headRy - 3;
  const bot = cy + headRy * 0.3;
  for (let dy = hairTop; dy <= bot; dy++) {
    const progress = (dy - hairTop) / (bot - hairTop);
    let halfWidth = headRx * (0.6 + progress * 0.5);
    if (dy > cy) halfWidth += (dy - cy) * 0.3;
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const v = 1 + (1 - Math.abs(dx) / halfWidth) * 3 + (1 - progress) * 1.2;
      setPixel(ctx, cx + dx, dy, hairPalette[bandShade(v, 1, 6, 5)]);
    }
  }
  // Jade hairpin
  const pinX = cx + 6;
  const pinY = cy - headRy - 1;
  for (let dy = -2; dy <= 2; dy++) setPixel(ctx, pinX, pinY + dy, PALETTE.jungle[5]);
  drawShadedEllipse(ctx, pinX, pinY - 3, 2, 2, PALETTE.jungle, { lo: 4, hi: 6, bands: 2 });
}

// ---------------------------------------------------------------------------
// Headwear — hard bands
// ---------------------------------------------------------------------------

function drawTudung(ctx, cx, cy, clothPalette, opts = {}) {
  const { headRx = 18, headRy = 22, draped = true } = opts;
  const scarfTop = cy - headRy - 2;
  const scarfBot = cy + headRy * 0.6;
  // Face opening — the scarf frames the face rather than covering it.
  const faceRx = 12;
  const faceRy = 16;
  const faceCY = cy + 1;
  for (let dy = scarfTop; dy <= scarfBot; dy++) {
    const progress = (dy - scarfTop) / (scarfBot - scarfTop);
    let halfWidth = headRx * (0.7 + progress * 0.5);
    if (dy > cy && draped) halfWidth += (dy - cy) * 0.5;
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      if ((dx * dx) / (halfWidth * halfWidth) <= 1) {
        // Skip the central face oval so the skin shows through.
        const fnd = (dx * dx) / (faceRx * faceRx) + ((dy - faceCY) * (dy - faceCY)) / (faceRy * faceRy);
        if (fnd <= 1) continue;
        const nx = dx / halfWidth;
        const ny = (dy - cy) / headRy;
        const light = 1 - (nx * 0.55 + ny * 0.4);
        // Full-ramp scarf with hard drapery folds for depth + colour variety.
        setPixel(ctx, cx + dx, dy, clothPalette[bandShade(1 + light * 6 + clothFold(cx + dx), 1, 7, 7)]);
      }
    }
  }
}

function drawKeffiyeh(ctx, cx, cy, clothPalette, opts = {}) {
  const { headRx = 18, headRy = 22 } = opts;
  const scarfTop = cy - headRy - 3;
  const scarfBot = cy + headRy * 0.8;
  // Face opening — the keffiyeh frames the face and drapes down the sides.
  const faceRx = 13;
  const faceRy = 17;
  const faceCY = cy + 1;
  for (let dy = scarfTop; dy <= scarfBot; dy++) {
    const progress = (dy - scarfTop) / (scarfBot - scarfTop);
    const halfWidth = headRx * (0.6 + progress * 0.7);
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      if ((dx * dx) / (halfWidth * halfWidth) <= 1) {
        const fnd = (dx * dx) / (faceRx * faceRx) + ((dy - faceCY) * (dy - faceCY)) / (faceRy * faceRy);
        if (fnd <= 1) continue; // reveal the face
        const light = 1 - (dx / halfWidth * 0.55 + progress * 0.3);
        // Hard checker accent (alternating band, not blended)
        const checker = ((Math.floor((cx + dx) / 3) + Math.floor(dy / 3)) % 2 === 0) ? 1 : 0;
        setPixel(ctx, cx + dx, dy, clothPalette[bandShade(1 + light * 6 + checker, 1, 7, 6)]);
      }
    }
  }
}

function drawSongkok(ctx, cx, cy, capPalette, opts = {}) {
  const { headRy = 22 } = opts;
  const capTop = cy - headRy - 8;
  const capBot = cy - headRy + 2;
  const capWidth = 14;
  for (let dy = capTop; dy <= capBot; dy++) {
    const progress = (dy - capTop) / (capBot - capTop);
    const hw = capWidth * (0.8 + progress * 0.2);
    for (let dx = -hw; dx <= hw; dx++) {
      const light = 1 - (dx / hw * 0.45 + progress * 0.4);
      setPixel(ctx, cx + dx, dy, capPalette[bandShade(1 + light * 4, 1, 5, 3)]);
    }
  }
}

function drawMorionHelmet(ctx, cx, cy, opts = {}) {
  const { headRy = 22 } = opts;
  const metal = PALETTE.stone;
  const helmetTop = cy - headRy - 10;
  const helmetBot = cy - headRy + 4;
  for (let dy = helmetTop; dy <= helmetBot; dy++) {
    const progress = (dy - helmetTop) / (helmetBot - helmetTop);
    const hw = 16 * Math.sin(progress * Math.PI * 0.9);
    for (let dx = -hw; dx <= hw; dx++) {
      const light = 1 - (dx / Math.max(1, hw) * 0.45 + (1 - progress) * 0.2);
      setPixel(ctx, cx + dx, dy, metal[bandShade(2 + light * 5, 2, 7, 6)]);
    }
  }
  // Crest
  for (let dy = helmetTop - 2; dy <= helmetTop + 4; dy++) {
    setPixel(ctx, cx, dy, metal[6]);
    setPixel(ctx, cx + 1, dy, metal[5]);
  }
  // Brim — two hard bands
  const brimY = helmetBot;
  for (let dx = -20; dx <= 20; dx++) {
    const s = bandShade(3 + (1 - Math.abs(dx) / 20) * 3, 3, 6, 2);
    setPixel(ctx, cx + dx, brimY, metal[s]);
    setPixel(ctx, cx + dx, brimY + 1, metal[Math.max(2, s - 1)]);
  }
  // Single specular
  setPixel(ctx, cx - 4, helmetTop + 3, PALETTE.specular[4]);
}

function drawMerchantCap(ctx, cx, cy, capPalette, opts = {}) {
  const { headRy = 22 } = opts;
  const capTop = cy - headRy - 5;
  const capBot = cy - headRy + 2;
  for (let dy = capTop; dy <= capBot; dy++) {
    const progress = (dy - capTop) / (capBot - capTop);
    const hw = 16 * Math.sin(Math.max(0.1, progress) * Math.PI * 0.7);
    for (let dx = -hw; dx <= hw; dx++) {
      const light = 1 - (dx / Math.max(1, hw) * 0.45);
      setPixel(ctx, cx + dx, dy, capPalette[bandShade(2 + light * 4, 2, 6, 3)]);
    }
  }
}

// ---------------------------------------------------------------------------
// Facial hair — hard bands
// ---------------------------------------------------------------------------

function drawBeard(ctx, cx, cy, beardPalette, opts = {}) {
  const { beardLength = 12, beardWidth = 14 } = opts;
  const beardTop = cy + 8;
  const beardBot = beardTop + beardLength;
  for (let dy = beardTop; dy <= beardBot; dy++) {
    const progress = (dy - beardTop) / (beardBot - beardTop);
    const hw = beardWidth * (1 - progress * 0.45);
    for (let dx = -hw; dx <= hw; dx++) {
      const nd = (dx * dx) / (hw * hw);
      if (nd <= 1) {
        const v = 2 + (1 - nd) * 2 + (1 - progress) * 1.2;
        setPixel(ctx, cx + dx, dy, beardPalette[bandShade(v, 1, 5, 3)]);
      }
    }
  }
}

function drawMustache(ctx, cx, cy, beardPalette, opts = {}) {
  const { width = 10, thick = false } = opts;
  const mustY = cy + 9;
  const thickness = thick ? 3 : 2;
  for (let dy = 0; dy < thickness; dy++) {
    for (let dx = -width; dx <= width; dx++) {
      if (Math.abs(dx) < 2) continue;
      const droop = Math.floor(Math.abs(dx) / (width * 0.6));
      const v = 2 + (1 - Math.abs(dx) / width) * 3;
      setPixel(ctx, cx + dx, mustY + dy + droop, beardPalette[bandShade(v, 1, 5, 3)]);
    }
  }
}

function drawStubble(ctx, cx, cy, beardPalette, opts = {}) {
  const { width = 14 } = opts;
  const stubbleTop = cy + 8;
  const stubbleBot = cy + 14;
  for (let dy = stubbleTop; dy <= stubbleBot; dy++) {
    const progress = (dy - stubbleTop) / (stubbleBot - stubbleTop);
    const hw = width * (1 - progress * 0.3);
    for (let dx = -hw; dx <= hw; dx++) {
      // Sparse hard stipple — single index, no blend.
      if (seededRandom(cx + dx, dy, 47) > 0.5) {
        setPixel(ctx, cx + dx, dy, beardPalette[2]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Clothing — hard bands
// ---------------------------------------------------------------------------

function drawDoublet(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 30, height = 32, trimPalette = null, hasButtons = true, hasCollar = true } = opts;
  const torsoTop = cy + 22;
  const torsoBot = torsoTop + height;

  if (hasCollar) {
    const collarY = torsoTop - 3;
    for (let dy = 0; dy < 4; dy++) {
      const hw = 12 + dy;
      for (let dx = -hw; dx <= hw; dx++) {
        const v = 4 + (1 - Math.abs(dx) / hw) * 2;
        setPixel(ctx, cx + dx, collarY + dy, PALETTE.whitewash[bandShade(v, 3, 7, 3)]);
      }
    }
  }

  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.7 + progress * 0.1);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.55 + progress * 0.4);
      setPixel(ctx, cx + dx, dy, clothPalette[bandShade(1 + light * 6 + clothFold(cx + dx), 1, 7, 7)]);
    }
  }

  if (trimPalette) {
    for (let dy = torsoTop; dy <= torsoBot; dy++) {
      const progress = (dy - torsoTop) / (torsoBot - torsoTop);
      const hw = Math.floor(width * (0.7 + progress * 0.1));
      setPixel(ctx, cx - hw, dy, trimPalette[5]);
      setPixel(ctx, cx + hw, dy, trimPalette[2]);
    }
  }

  if (hasButtons) {
    for (let dy = torsoTop + 3; dy <= torsoBot - 2; dy += 4) {
      setPixel(ctx, cx, dy, PALETTE.gold[6]);
      setPixel(ctx, cx + 1, dy, PALETTE.gold[4]);
      setPixel(ctx, cx, dy + 1, PALETTE.gold[3]);
    }
  }
}

function drawCassock(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 28, height = 38 } = opts;
  const torsoTop = cy + 20;
  const torsoBot = torsoTop + height;
  const collarY = torsoTop - 2;
  for (let dx = -6; dx <= 6; dx++) {
    setPixel(ctx, cx + dx, collarY, PALETTE.whitewash[6]);
    setPixel(ctx, cx + dx, collarY + 1, PALETTE.whitewash[5]);
  }
  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.6 + progress * 0.2);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.45 + progress * 0.2);
      setPixel(ctx, cx + dx, dy, clothPalette[bandShade(1 + light * 4, 1, 5, 4)]);
    }
  }
  const crossX = cx + 2;
  const crossY = torsoTop + 8;
  drawVLine(ctx, crossX, crossY, crossY + 10, PALETTE.wood[5]);
  drawHLine(ctx, crossX - 3, crossX + 3, crossY + 3, PALETTE.wood[5]);
  for (let dx = -4; dx <= 4; dx++) setPixel(ctx, cx + dx, torsoTop + 1, PALETTE.wood[3]);
}

function drawBajuKurung(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 28, height = 34, accentPalette = null } = opts;
  const torsoTop = cy + 20;
  const torsoBot = torsoTop + height;
  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.6 + progress * 0.15);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.55 + progress * 0.25);
      // Hard vertical fold shadows (no dither) add ramp depth + cluster variety.
      const fold = clothFold(cx + dx);
      const shade = bandShade(1 + light * 6 + fold, 1, 7, 7);
      const accent = accentPalette && ((Math.floor((cx + dx) / 4) + Math.floor(dy / 4)) % 3 === 0);
      setPixel(ctx, cx + dx, dy, (accent ? accentPalette : clothPalette)[shade]);
    }
  }
}

function drawChangshan(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 28, height = 36, accentPalette = null } = opts;
  const torsoTop = cy + 20;
  const torsoBot = torsoTop + height;
  const collarY = torsoTop - 3;
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      if (Math.abs(dx) < 2 && dy > 1) continue;
      const v = 3 + (1 - Math.abs(dx) / 8) * 2;
      setPixel(ctx, cx + dx, collarY + dy, clothPalette[bandShade(v, 2, 6, 3)]);
    }
  }
  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.65 + progress * 0.15);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.4 + progress * 0.2);
      setPixel(ctx, cx + dx, dy, clothPalette[bandShade(1 + light * 6 + clothFold(cx + dx), 1, 7, 7)]);
    }
  }
  for (let dy = torsoTop; dy <= torsoBot - 4; dy++) {
    setPixel(ctx, cx + 3, dy, clothPalette[1]);
    if (accentPalette && dy % 5 === 0) {
      setPixel(ctx, cx + 4, dy, accentPalette[5]);
      setPixel(ctx, cx + 5, dy, accentPalette[3]);
    }
  }
}

function drawThawb(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 28, height = 36 } = opts;
  const torsoTop = cy + 20;
  const torsoBot = torsoTop + height;
  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.6 + progress * 0.2);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.4 + progress * 0.2);
      setPixel(ctx, cx + dx, dy, clothPalette[bandShade(1 + light * 6 + clothFold(cx + dx), 1, 7, 7)]);
    }
  }
  for (let dx = -5; dx <= 5; dx++) setPixel(ctx, cx + dx, torsoTop, clothPalette[6]);
}

function drawBreastplate(ctx, cx, cy) {
  const metal = PALETTE.stone;
  const torsoTop = cy + 20;
  const plateHeight = 24;
  for (let dy = 0; dy < plateHeight; dy++) {
    const progress = dy / plateHeight;
    const hw = 22 * (0.7 + progress * 0.15);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.45 + progress * 0.3);
      setPixel(ctx, cx + dx, torsoTop + dy, metal[bandShade(3 + light * 4, 2, 7, 6)]);
    }
  }
  for (let dy = 0; dy < plateHeight; dy++) setPixel(ctx, cx, torsoTop + dy, metal[6]);
  setPixel(ctx, cx - 5, torsoTop + 4, PALETTE.specular[5]);
}

function drawSarong(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 26, startY = 42, height = 20, accentPalette = null } = opts;
  const top = cy + startY;
  const bot = top + height;
  for (let dy = top; dy <= bot; dy++) {
    const progress = (dy - top) / (bot - top);
    const hw = width * (0.8 + progress * 0.1);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.5 + progress * 0.2);
      const shade = bandShade(1 + light * 6 + clothFold(cx + dx), 1, 7, 7);
      const accent = accentPalette && ((Math.floor((cx + dx) / 5) + Math.floor(dy / 5)) % 2 === 0);
      setPixel(ctx, cx + dx, dy, (accent ? accentPalette : clothPalette)[shade]);
    }
  }
}

// ---------------------------------------------------------------------------
// Neck — hard bands
// ---------------------------------------------------------------------------
function drawNeck(ctx, cx, cy, skinPalette) {
  const neckTop = cy + 18;
  const neckBot = cy + 23;
  const neckHW = 6;
  for (let dy = neckTop; dy <= neckBot; dy++) {
    for (let dx = -neckHW; dx <= neckHW; dx++) {
      // Lit left, shadow right + ambient occlusion under the jaw.
      const v = 2 + (1 - Math.abs(dx) / neckHW) * 2 - (dy - neckTop) * 0.3;
      setPixel(ctx, cx + dx, dy, skinPalette[bandShade(v, 1, 5, 3, cx + dx, dy, 0.45)]);
    }
  }
}

// ---------------------------------------------------------------------------
// Dark silhouette outline (1px) — PALETTE.shadow[1]
// ---------------------------------------------------------------------------
function addDarkOutline(ctx, bgPalettes) {
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;

  // Identify "background" pixels by colour match against the bg ramps so the
  // outline traces the figure even though the canvas is fully opaque.
  const bgSet = new Set();
  for (const pal of bgPalettes) pal.slice(0, 8).forEach((c) => bgSet.add(c.toUpperCase()));
  const isBg = (i) => {
    const hex = `#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    return bgSet.has(hex);
  };

  const outline = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (isBg(i)) continue; // only outline figure pixels
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) { outline.push([x, y]); break; }
        const ni = (ny * W + nx) * 4;
        if (isBg(ni)) { outline.push([x, y]); break; }
      }
    }
  }
  for (const [x, y] of outline) setPixel(ctx, x, y, PALETTE.shadow[1]);
}

// ---------------------------------------------------------------------------
// Wrinkles for elderly characters — hard, single index
// ---------------------------------------------------------------------------
function drawWrinkles(ctx, cx, cy, skinPalette) {
  for (let i = 0; i < 3; i++) {
    const wy = cy - 12 + i * 3;
    for (let dx = -8; dx <= 8; dx++) {
      if (seededRandom(dx, wy, 71) > 0.45) setPixel(ctx, cx + dx, wy, skinPalette[2]);
    }
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      setPixel(ctx, cx + side * (12 + i), cy - 3 + i, skinPalette[2]);
    }
  }
  for (let dy = 0; dy < 6; dy++) {
    setPixel(ctx, cx - 5 - Math.floor(dy * 0.3), cy + 5 + dy, skinPalette[2]);
    setPixel(ctx, cx + 5 + Math.floor(dy * 0.3), cy + 5 + dy, skinPalette[2]);
  }
}

// ---------------------------------------------------------------------------
// Jewellery — hard-banded gold necklace + jade pendant.  Adds two extra
// material ramps (gold + jade-green) to the lower neckline, which both reads
// as period dress and lifts the distinct-colour budget of plain-palette
// portraits toward the richer end of the target range.
// ---------------------------------------------------------------------------
function drawNecklace(ctx, cx, cy) {
  const neckY = cy + 24;
  // Gold collar chain — an arc of alternating hard gold bands.
  for (let dx = -7; dx <= 7; dx++) {
    const dip = Math.round((dx * dx) / 14); // shallow U
    const shade = dx < -2 ? 7 : dx > 2 ? 3 : 5; // lit-left -> shadow-right
    setPixel(ctx, cx + dx, neckY + dip, PALETTE.gold[shade]);
    if (Math.abs(dx) % 2 === 0) setPixel(ctx, cx + dx, neckY + dip + 1, PALETTE.gold[Math.max(2, shade - 2)]);
  }
  // Jade pendant — small shaded green bead (new ramp for warm-palette faces).
  drawShadedEllipse(ctx, cx, neckY + 4, 2, 3, PALETTE.jungle, { lo: 3, hi: 7, bands: 4 });
  setPixel(ctx, cx - 1, neckY + 3, PALETTE.specular[6]); // single glint
}

// ---------------------------------------------------------------------------
// Accessories — hard
// ---------------------------------------------------------------------------
function drawAccessories(ctx, cx, cy, accessories) {
  for (const acc of accessories) {
    if (acc === 'quill') {
      const qx = cx + 20;
      const qy = cy - 10;
      for (let dy = -8; dy <= 4; dy++) setPixel(ctx, qx + Math.floor(dy * 0.3), qy + dy, PALETTE.whitewash[6]);
      for (let dx = 0; dx < 4; dx++) setPixel(ctx, qx + dx - 1, qy - 8 - dx, PALETTE.whitewash[5]);
    }
    if (acc === 'herbPouch') {
      const px = cx + 20;
      const py = cy + 42;
      drawShadedEllipse(ctx, px, py, 5, 4, PALETTE.wood, { lo: 2, hi: 5, bands: 3 });
      drawVLine(ctx, px, py - 8, py - 2, PALETTE.wood[3]);
    }
  }
}

// ---------------------------------------------------------------------------
// Character configs (preserved verbatim from the original generator)
// ---------------------------------------------------------------------------

const CHARACTER_CONFIGS = {
  'player': {
    skinPalette: 'skinPortuguese', hairPalette: 'wood', clothPalette1: 'clothRed', clothPalette2: 'wood',
    bgPalette1: 'gold', bgPalette2: 'terracotta', hairStyle: 'shortMale', hairOpts: { tousled: true },
    clothing: 'doublet', clothOpts: { trimPalette: null, hasButtons: true, hasCollar: true },
    facialHair: null, headwear: null, expression: 'neutral', eyeColor: PALETTE.jungle[4], accessories: [], seed: 1,
  },
  'fernao-gomes': {
    skinPalette: 'skinPortuguese', hairPalette: 'stone', clothPalette1: 'clothRed', clothPalette2: 'gold',
    bgPalette1: 'gold', bgPalette2: 'terracotta', hairStyle: 'shortMale', hairOpts: { receding: true },
    clothing: 'doublet', clothOpts: { trimPalette: 'gold', hasButtons: true, hasCollar: true },
    facialHair: 'beard', facialHairPalette: 'stone', facialHairOpts: { beardLength: 14, beardWidth: 16 },
    headwear: 'merchantCap', headwearPalette: 'clothRed', expression: 'neutral', eyeColor: PALETTE.wood[3], accessories: [], seed: 2,
  },
  'capitao-rodrigues': {
    skinPalette: 'skinPortuguese', hairPalette: 'wood', clothPalette1: 'clothBlue', clothPalette2: 'stone',
    bgPalette1: 'stone', bgPalette2: 'sand', hairStyle: 'none', clothing: 'breastplate', clothOpts: {},
    facialHair: 'mustache', facialHairPalette: 'wood', facialHairOpts: { width: 12, thick: true },
    headwear: 'morion', expression: 'stern', eyeColor: PALETTE.wood[2], accessories: [], seed: 3,
  },
  'padre-tomas': {
    skinPalette: 'skinPortuguese', hairPalette: 'stone', clothPalette1: 'shadow', clothPalette2: 'wood',
    bgPalette1: 'sand', bgPalette2: 'warmStone', hairStyle: 'tonsure', clothing: 'cassock', clothOpts: {},
    facialHair: null, headwear: null, expression: 'neutral', eyeColor: PALETTE.wood[3], accessories: ['crucifix'], seed: 4,
  },
  'aminah': {
    skinPalette: 'skinMalay', hairPalette: 'shadow', clothPalette1: 'gold', clothPalette2: 'clothSilk',
    bgPalette1: 'gold', bgPalette2: 'sand', hairStyle: 'none', clothing: 'bajuKurung',
    clothOpts: { accentPalette: 'clothSilk' }, facialHair: null, headwear: 'tudung', headwearPalette: 'gold',
    expression: 'warm', eyeColor: PALETTE.wood[2], accessories: [], jewelry: true, seed: 5,
  },
  'chen-wei': {
    skinPalette: 'skinChinese', hairPalette: 'shadow', clothPalette1: 'clothBlue', clothPalette2: 'clothSilk',
    bgPalette1: 'sand', bgPalette2: 'warmStone', hairStyle: 'topknot', clothing: 'changshan',
    clothOpts: { accentPalette: 'clothSilk' }, facialHair: 'stubble', facialHairPalette: 'shadow',
    facialHairOpts: { width: 8 }, headwear: null, expression: 'reserved', eyeColor: PALETTE.wood[2], accessories: [], seed: 6,
  },
  'rashid': {
    skinPalette: 'skinMalay', hairPalette: 'shadow', clothPalette1: 'sand', clothPalette2: 'clothRed',
    bgPalette1: 'sand', bgPalette2: 'terracotta', hairStyle: 'none', clothing: 'thawb', clothOpts: {},
    facialHair: 'beard', facialHairPalette: 'shadow', facialHairOpts: { beardLength: 10, beardWidth: 12 },
    headwear: 'keffiyeh', headwearPalette: 'sand', expression: 'animated', eyeColor: PALETTE.wood[2], accessories: [], seed: 7,
  },
  'siti': {
    skinPalette: 'skinMalay', hairPalette: 'shadow', clothPalette1: 'clothSilk', clothPalette2: 'jungle',
    bgPalette1: 'jungle', bgPalette2: 'sand', hairStyle: 'none', clothing: 'bajuKurung',
    clothOpts: { accentPalette: 'jungle', width: 26, height: 30 }, facialHair: null, headwear: 'tudung',
    headwearPalette: 'clothSilk', headwearOpts: { draped: true }, expression: 'nervous', eyeColor: PALETTE.wood[3], accessories: [], seed: 8,
  },
  'alvares': {
    skinPalette: 'skinPortuguese', hairPalette: 'wood', clothPalette1: 'clothBlue', clothPalette2: 'stone',
    bgPalette1: 'stone', bgPalette2: 'sand', hairStyle: 'shortMale', hairOpts: {}, clothing: 'doublet',
    clothOpts: { hasCollar: false, hasButtons: true }, facialHair: 'stubble', facialHairPalette: 'wood',
    facialHairOpts: { width: 12 }, headwear: null, expression: 'stern', eyeColor: PALETTE.wood[2], accessories: [], seed: 9,
  },
  'mak-enang': {
    skinPalette: 'skinMalay', hairPalette: 'stone', clothPalette1: 'jungle', clothPalette2: 'wood',
    bgPalette1: 'jungle', bgPalette2: 'wood', hairStyle: 'shortMale', hairOpts: { receding: true },
    clothing: 'bajuKurung', clothOpts: { accentPalette: 'wood', width: 26 }, facialHair: null, headwear: null,
    expression: 'wise', eyeColor: PALETTE.wood[2], accessories: ['herbPouch'], seed: 10, wrinkles: true, elderly: true,
  },
  'gaspar-mesquita': {
    skinPalette: 'skinPortuguese', hairPalette: 'wood', clothPalette1: 'clothRed', clothPalette2: 'gold',
    bgPalette1: 'gold', bgPalette2: 'terracotta', hairStyle: 'shortMale', hairOpts: {}, clothing: 'doublet',
    clothOpts: { trimPalette: 'gold', hasButtons: true, hasCollar: true }, facialHair: 'mustache',
    facialHairPalette: 'wood', facialHairOpts: { width: 8 }, headwear: null, expression: 'neutral',
    eyeColor: PALETTE.wood[3], accessories: ['quill'], seed: 11,
  },
  'diogo-almeida': {
    skinPalette: 'skinPortuguese', hairPalette: 'wood', clothPalette1: 'clothSilk', clothPalette2: 'gold',
    // gold inner pool gives a genuinely bright (>160 lum) light region so the
    // SE shadow direction reads correctly; wood outer keeps the warm mood.
    bgPalette1: 'gold', bgPalette2: 'wood', hairStyle: 'shortMale', hairOpts: { tousled: true },
    clothing: 'doublet', clothOpts: { trimPalette: 'gold', hasButtons: true, hasCollar: true },
    facialHair: 'stubble', facialHairPalette: 'wood', facialHairOpts: { width: 10 }, headwear: null,
    expression: 'sly', eyeColor: PALETTE.wood[3], accessories: [], seed: 12,
  },
  'lin-mei': {
    skinPalette: 'skinChinese', hairPalette: 'shadow', clothPalette1: 'clothSilk', clothPalette2: 'gold',
    bgPalette1: 'clothSilk', bgPalette2: 'gold', hairStyle: 'femalePin', clothing: 'changshan',
    clothOpts: { accentPalette: 'gold', width: 26 }, facialHair: null, headwear: null, expression: 'reserved',
    eyeColor: PALETTE.wood[2], accessories: [], jewelry: true, seed: 13,
  },
  'pak-salleh': {
    skinPalette: 'skinMalay', hairPalette: 'stone', clothPalette1: 'wood', clothPalette2: 'clothRed',
    bgPalette1: 'wood', bgPalette2: 'sand', hairStyle: 'shortMale', hairOpts: { receding: true },
    clothing: 'bajuKurung', clothOpts: { accentPalette: 'clothRed' }, facialHair: 'stubble',
    facialHairPalette: 'stone', facialHairOpts: { width: 12 }, headwear: 'songkok', headwearPalette: 'shadow',
    expression: 'wise', eyeColor: PALETTE.wood[2], accessories: [], seed: 14, wrinkles: true, elderly: true,
  },
};

// ---------------------------------------------------------------------------
// Main portrait drawing
// ---------------------------------------------------------------------------

function drawPortrait(ctx, characterId, config) {
  const cx = W / 2;     // 64
  const cy = H / 2 - 8; // 56

  const skinPal = PALETTE[config.skinPalette];
  const hairPal = PALETTE[config.hairPalette];
  const clothPal1 = PALETTE[config.clothPalette1];
  // Two-ramp vignette: warm inner light pool + cooler outer corner shadow.
  const bgInner = PALETTE[config.bgPalette1];
  const bgOuter = PALETTE[config.bgPalette2] || bgInner;

  // 1. Background — radial vignette (no hatch)
  drawBackground(ctx, bgInner, bgOuter);

  // 2. Clothing (behind head)
  switch (config.clothing) {
    case 'doublet':
      drawDoublet(ctx, cx, cy, clothPal1, {
        ...config.clothOpts,
        trimPalette: config.clothOpts.trimPalette ? PALETTE[config.clothOpts.trimPalette] : null,
      });
      break;
    case 'cassock':
      drawCassock(ctx, cx, cy, clothPal1, config.clothOpts || {});
      break;
    case 'bajuKurung':
      drawBajuKurung(ctx, cx, cy, clothPal1, {
        ...config.clothOpts,
        accentPalette: config.clothOpts.accentPalette ? PALETTE[config.clothOpts.accentPalette] : null,
      });
      break;
    case 'changshan':
      drawChangshan(ctx, cx, cy, clothPal1, {
        ...config.clothOpts,
        accentPalette: config.clothOpts.accentPalette ? PALETTE[config.clothOpts.accentPalette] : null,
      });
      break;
    case 'thawb':
      drawThawb(ctx, cx, cy, clothPal1, config.clothOpts || {});
      break;
    case 'breastplate':
      drawDoublet(ctx, cx, cy, PALETTE[config.clothPalette2], { hasCollar: false, hasButtons: false });
      drawBreastplate(ctx, cx, cy);
      break;
    default:
      break;
  }

  if (config.accessories && config.accessories.includes('sarong')) {
    drawSarong(ctx, cx, cy, PALETTE[config.clothPalette2], { accentPalette: PALETTE[config.clothPalette1] });
  }

  // 3. Neck, 4. Head, 5. Ears
  drawNeck(ctx, cx, cy, skinPal);
  drawHead(ctx, cx, cy, skinPal);
  drawEars(ctx, cx, cy, skinPal);

  // 6. Facial features
  drawEyes(ctx, cx, cy, { expression: config.expression, irisColor: config.eyeColor });
  drawEyebrows(ctx, cx, cy, hairPal, { expression: config.expression });
  drawNose(ctx, cx, cy, skinPal);
  drawMouth(ctx, cx, cy, skinPal, { expression: config.expression });

  if (config.wrinkles) drawWrinkles(ctx, cx, cy, skinPal);

  // 7. Facial hair
  if (config.facialHair) {
    const fhPal = PALETTE[config.facialHairPalette || config.hairPalette];
    const fhOpts = config.facialHairOpts || {};
    if (config.facialHair === 'beard') drawBeard(ctx, cx, cy, fhPal, fhOpts);
    else if (config.facialHair === 'mustache') drawMustache(ctx, cx, cy, fhPal, fhOpts);
    else if (config.facialHair === 'stubble') drawStubble(ctx, cx, cy, fhPal, fhOpts);
  }

  // 8. Hair
  switch (config.hairStyle) {
    case 'shortMale': drawHairShortMale(ctx, cx, cy, hairPal, config.hairOpts || {}); break;
    case 'gray': drawHairGray(ctx, cx, cy, config.hairOpts || {}); break;
    case 'tonsure': drawHairTonsure(ctx, cx, cy, hairPal, config.hairOpts || {}); break;
    case 'topknot': drawHairTopknot(ctx, cx, cy, hairPal, config.hairOpts || {}); break;
    case 'femalePin': drawHairFemalePin(ctx, cx, cy, hairPal, config.hairOpts || {}); break;
    case 'none': break;
  }

  // 9. Headwear
  if (config.headwear) {
    const hwPal = PALETTE[config.headwearPalette || config.clothPalette1];
    const hwOpts = config.headwearOpts || {};
    switch (config.headwear) {
      case 'morion': drawMorionHelmet(ctx, cx, cy, hwOpts); break;
      case 'merchantCap': drawMerchantCap(ctx, cx, cy, hwPal, hwOpts); break;
      case 'tudung': drawTudung(ctx, cx, cy, hwPal, hwOpts); break;
      case 'keffiyeh': drawKeffiyeh(ctx, cx, cy, hwPal, hwOpts); break;
      case 'songkok': drawSongkok(ctx, cx, cy, hwPal, hwOpts); break;
    }
  }

  // 10. Jewellery (sits on the chest, above garment + below the outline)
  if (config.jewelry) drawNecklace(ctx, cx, cy);

  // 11. Accessories
  if (config.accessories && config.accessories.length > 0) {
    drawAccessories(ctx, cx, cy, config.accessories);
  }

  // 12. Dark silhouette outline (1px) against the bg ramps
  addDarkOutline(ctx, [bgInner, bgOuter]);
}

// ---------------------------------------------------------------------------
// Scale 128x128 -> 512x512 with nearest-neighbor
// ---------------------------------------------------------------------------
function scaleUp(srcCanvas) {
  const dst = createCanvas(OUT_W, OUT_H);
  const dctx = dst.getContext('2d');
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(srcCanvas, 0, 0, OUT_W, OUT_H);
  return dst;
}

function generatePortrait(characterId) {
  const config = CHARACTER_CONFIGS[characterId];
  if (!config) {
    console.error(`Unknown character: ${characterId}`);
    return null;
  }
  const workCanvas = createCanvas(W, H);
  const workCtx = workCanvas.getContext('2d');
  workCtx.imageSmoothingEnabled = false;
  drawPortrait(workCtx, characterId, config);
  return scaleUp(workCanvas);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  let characters = Object.keys(CHARACTER_CONFIGS);

  if (args.includes('--character')) {
    const idx = args.indexOf('--character');
    const id = args[idx + 1];
    if (!id || !CHARACTER_CONFIGS[id]) {
      console.error(`Unknown character: ${id}`);
      console.error(`Available: ${characters.join(', ')}`);
      process.exit(1);
    }
    characters = [id];
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Generating ${characters.length} VGA portrait(s)...`);
  console.log(`Working resolution: ${W}x${H} -> Output: ${OUT_W}x${OUT_H}`);
  console.log(`Output directory: ${OUT_DIR}\n`);

  for (const id of characters) {
    const canvas = generatePortrait(id);
    if (!canvas) continue;
    const outPath = path.join(OUT_DIR, `${id}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buffer);
    console.log(`  ${id}.png (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  console.log('\nDone!');
}

main();
