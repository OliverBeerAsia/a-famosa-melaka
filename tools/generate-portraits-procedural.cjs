#!/usr/bin/env node
/**
 * Procedural VGA Portrait Generator
 * Produces 512x512 Ultima VIII / Diablo style portraits using Node canvas.
 * Works at 128x128 internal resolution, scaled 4x with nearest-neighbor.
 *
 * Uses the project palette exclusively (tools/ultima8-graphics/palette.cjs).
 *
 * CLI:
 *   node tools/generate-portraits-procedural.cjs [--character <id>] [--all]
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { PALETTE, DITHER_MATRIX, blendDithered, hexToRgb } = require('./ultima8-graphics/palette.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const W = 128;          // working resolution
const H = 128;
const OUT_W = 512;      // output resolution
const OUT_H = 512;
const SCALE = OUT_W / W; // 4x

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'sprites', 'portraits');

// ---------------------------------------------------------------------------
// Seeded random (matches characters.cjs)
// ---------------------------------------------------------------------------
function seededRandom(x, y, seed = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
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

function setDitheredPixel(ctx, x, y, palette, shadeLevel) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
  const baseIdx = Math.floor(shadeLevel);
  const frac = shadeLevel - baseIdx;
  const idx1 = Math.max(0, Math.min(7, baseIdx));
  const idx2 = Math.max(0, Math.min(7, baseIdx + 1));

  if (frac < 0.01) {
    ctx.fillStyle = palette[idx1];
  } else if (frac > 0.99) {
    ctx.fillStyle = palette[idx2];
  } else {
    const threshold = Math.floor(frac * 16);
    ctx.fillStyle = blendDithered(palette[idx1], palette[idx2], ix, iy, threshold);
  }
  ctx.fillRect(ix, iy, 1, 1);
}

// ---------------------------------------------------------------------------
// Shape primitives
// ---------------------------------------------------------------------------

/** Draw a filled ellipse with SE directional lighting */
function drawShadedEllipse(ctx, cx, cy, rx, ry, palette, opts = {}) {
  const { lightX = -0.4, lightY = -0.6, baseShade = 2, shadeRange = 4, outline = false } = opts;
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const nd = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (nd <= 1) {
        const nx = dx / rx;
        const ny = dy / ry;
        const light = 1 - (nx * lightX + ny * lightY);
        const shade = Math.max(0, Math.min(7, baseShade + light * shadeRange));
        setDitheredPixel(ctx, cx + dx, cy + dy, palette, shade);
      }
    }
  }
  if (outline) {
    drawEllipseOutline(ctx, cx, cy, rx, ry, palette[0]);
  }
}

/** 1px outline around an ellipse */
function drawEllipseOutline(ctx, cx, cy, rx, ry, color) {
  const steps = Math.max(rx, ry) * 8;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const px = Math.round(cx + Math.cos(angle) * rx);
    const py = Math.round(cy + Math.sin(angle) * ry);
    setPixel(ctx, px, py, color);
  }
}

/** Draw a filled rectangle with SE lighting gradient */
function drawShadedRect(ctx, x, y, w, h, palette, opts = {}) {
  const { baseShade = 3, shadeRange = 3 } = opts;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      // SE lighting: top-left brighter, bottom-right darker
      const tx = px / Math.max(1, w - 1);
      const ty = py / Math.max(1, h - 1);
      const shade = baseShade + shadeRange * (1 - tx * 0.5 - ty * 0.5);
      setDitheredPixel(ctx, x + px, y + py, palette, shade);
    }
  }
}

/** Draw a horizontal line */
function drawHLine(ctx, x1, x2, y, color) {
  for (let x = x1; x <= x2; x++) setPixel(ctx, x, y, color);
}

/** Draw a vertical line */
function drawVLine(ctx, x, y1, y2, color) {
  for (let y = y1; y <= y2; y++) setPixel(ctx, x, y, color);
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------
function drawBackground(ctx, palette1, palette2, seed = 0) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Radial vignette: darker at edges, offset toward bottom-right
      const dx = (x - W * 0.4) / (W / 2);
      const dy = (y - H * 0.35) / (H / 2);
      const vignette = Math.sqrt(dx * dx + dy * dy);
      const vignetteFactor = Math.max(0, 1 - vignette * 0.6);

      // SE lighting gradient: bright top-left, dark bottom-right
      const seGrad = 1 - (x / W) * 0.4 - (y / H) * 0.5;
      const base = vignetteFactor * seGrad;

      // Map to shade index with slight noise
      const noise = (seededRandom(x, y, seed) - 0.5) * 0.8;
      const shade = Math.max(0, Math.min(7, base * 7 + noise));

      // Dither between palette1 and palette2
      const ditherVal = DITHER_MATRIX[y % 4][x % 4];
      const usePal = ditherVal < 10 ? palette1 : palette2;
      setDitheredPixel(ctx, x, y, usePal, shade);
    }
  }
}

// ---------------------------------------------------------------------------
// Face construction
// ---------------------------------------------------------------------------

/** Draw the head (oval shape with skin shading) */
function drawHead(ctx, cx, cy, skinPalette, opts = {}) {
  const { headRx = 18, headRy = 22, jawNarrow = 0.7 } = opts;

  // Main head ellipse
  for (let dy = -headRy; dy <= headRy; dy++) {
    for (let dx = -headRx; dx <= headRx; dx++) {
      // Jaw narrowing: bottom portion narrows
      let effRx = headRx;
      if (dy > headRy * 0.2) {
        const jawProgress = (dy - headRy * 0.2) / (headRy * 0.8);
        effRx = headRx * (1 - jawProgress * (1 - jawNarrow));
      }
      const nd = (dx * dx) / (effRx * effRx) + (dy * dy) / (headRy * headRy);
      if (nd <= 1) {
        // SE lighting (light from top-left, shadow on bottom-right)
        const nx = dx / effRx;
        const ny = dy / headRy;
        const light = 1 - (nx * 0.45 + ny * 0.55);
        // Slight warm glow at cheek area
        const cheekBoost = (dy > 0 && dy < headRy * 0.5 && Math.abs(dx) > effRx * 0.4) ? 0.3 : 0;
        const shade = Math.max(0, Math.min(7, 2 + light * 4 + cheekBoost));
        setDitheredPixel(ctx, cx + dx, cy + dy, skinPalette, shade);
      }
    }
  }
}

/** Draw ears */
function drawEars(ctx, cx, cy, skinPalette, opts = {}) {
  const { headRx = 18, earSize = 4 } = opts;
  // Left ear (lit side)
  drawShadedEllipse(ctx, cx - headRx - 1, cy + 2, earSize, earSize + 1, skinPalette, {
    baseShade: 4, shadeRange: 2
  });
  // Right ear (shadow side)
  drawShadedEllipse(ctx, cx + headRx + 1, cy + 2, earSize, earSize + 1, skinPalette, {
    baseShade: 2, shadeRange: 2
  });
}

/** Draw eyes */
function drawEyes(ctx, cx, cy, opts = {}) {
  const { eyeSpacing = 8, eyeY = -4, eyeWidth = 5, eyeHeight = 3, irisColor = PALETTE.wood[2], expression = 'neutral' } = opts;

  const leftEyeX = cx - eyeSpacing;
  const rightEyeX = cx + eyeSpacing;
  const eyeBaseY = cy + eyeY;

  for (const ex of [leftEyeX, rightEyeX]) {
    const isLeft = ex === leftEyeX;

    // Eye white
    for (let dy = -eyeHeight; dy <= eyeHeight; dy++) {
      for (let dx = -eyeWidth; dx <= eyeWidth; dx++) {
        const nd = (dx * dx) / (eyeWidth * eyeWidth) + (dy * dy) / (eyeHeight * eyeHeight);
        if (nd <= 1) {
          // Slight shadow on top of eye
          const shade = dy < 0 ? 5 : 6;
          setPixel(ctx, ex + dx, eyeBaseY + dy, PALETTE.whitewash[shade]);
        }
      }
    }

    // Iris (2-3px circle)
    const irisR = 2;
    for (let dy = -irisR; dy <= irisR; dy++) {
      for (let dx = -irisR; dx <= irisR; dx++) {
        if (dx * dx + dy * dy <= irisR * irisR) {
          setPixel(ctx, ex + dx, eyeBaseY + dy, irisColor);
        }
      }
    }

    // Pupil
    setPixel(ctx, ex, eyeBaseY, PALETTE.shadow[0]);
    setPixel(ctx, ex + 1, eyeBaseY, PALETTE.shadow[0]);

    // Highlight dot (top-left of iris)
    setPixel(ctx, ex - 1, eyeBaseY - 1, PALETTE.specular[7]);

    // Eyelid line (top)
    drawHLine(ctx, ex - eyeWidth, ex + eyeWidth, eyeBaseY - eyeHeight - 1, PALETTE.shadow[3]);

    // Lower eyelid (subtle)
    for (let dx = -eyeWidth + 1; dx <= eyeWidth - 1; dx++) {
      setPixel(ctx, ex + dx, eyeBaseY + eyeHeight, PALETTE.shadow[5]);
    }

    // Expression adjustments
    if (expression === 'stern' || expression === 'reserved') {
      // Heavier brow
      drawHLine(ctx, ex - eyeWidth - 1, ex + eyeWidth + 1, eyeBaseY - eyeHeight - 2, PALETTE.shadow[2]);
    }
    if (expression === 'nervous') {
      // Raised inner brow
      if (isLeft) {
        setPixel(ctx, ex + eyeWidth - 1, eyeBaseY - eyeHeight - 2, PALETTE.shadow[3]);
      } else {
        setPixel(ctx, ex - eyeWidth + 1, eyeBaseY - eyeHeight - 2, PALETTE.shadow[3]);
      }
    }
    if (expression === 'sly') {
      // Narrowed eye
      drawHLine(ctx, ex - eyeWidth + 1, ex + eyeWidth - 1, eyeBaseY - eyeHeight, PALETTE.shadow[3]);
    }
  }
}

/** Draw eyebrows */
function drawEyebrows(ctx, cx, cy, browPalette, opts = {}) {
  const { eyeSpacing = 8, eyeY = -4, browThickness = 2, expression = 'neutral' } = opts;
  const browY = cy + eyeY - 5;
  const browWidth = 6;

  for (const side of [-1, 1]) {
    const browCx = cx + side * eyeSpacing;
    for (let dy = 0; dy < browThickness; dy++) {
      for (let dx = -browWidth; dx <= browWidth; dx++) {
        // Slight arch
        const archOffset = Math.floor(Math.abs(dx) * 0.3);
        const shade = dy === 0 ? 3 : 2;
        let py = browY + dy - archOffset;
        if (expression === 'stern') py += (side === 1 ? 1 : 0);
        if (expression === 'animated') py -= (dx > 0 ? 1 : 0);
        setPixel(ctx, browCx + dx, py, browPalette[shade]);
      }
    }
  }
}

/** Draw nose */
function drawNose(ctx, cx, cy, skinPalette, opts = {}) {
  const { noseLength = 6, noseWidth = 3 } = opts;
  const noseTop = cy + 2;

  // Nose bridge (subtle highlight on left, shadow on right)
  for (let dy = 0; dy < noseLength; dy++) {
    const w = Math.floor(noseWidth * (0.5 + (dy / noseLength) * 0.5));
    for (let dx = -w; dx <= w; dx++) {
      const shade = dx < 0 ? 6 : dx > 0 ? 3 : 5;
      setPixel(ctx, cx + dx, noseTop + dy, skinPalette[shade]);
    }
  }

  // Nose tip (slightly bulbous)
  const tipY = noseTop + noseLength;
  for (let dx = -noseWidth; dx <= noseWidth; dx++) {
    const shade = dx < 0 ? 6 : dx > 0 ? 3 : 5;
    setPixel(ctx, cx + dx, tipY, skinPalette[shade]);
  }

  // Nostrils
  setPixel(ctx, cx - noseWidth + 1, tipY + 1, skinPalette[1]);
  setPixel(ctx, cx + noseWidth - 1, tipY + 1, skinPalette[1]);

  // Nose shadow underneath
  for (let dx = -noseWidth; dx <= noseWidth; dx++) {
    setPixel(ctx, cx + dx, tipY + 1, skinPalette[2]);
  }
}

/** Draw mouth */
function drawMouth(ctx, cx, cy, skinPalette, opts = {}) {
  const { mouthWidth = 7, mouthY = 12, expression = 'neutral' } = opts;
  const my = cy + mouthY;

  // Upper lip (darker)
  for (let dx = -mouthWidth; dx <= mouthWidth; dx++) {
    const curve = Math.abs(dx) > mouthWidth - 2 ? 1 : 0;
    setPixel(ctx, cx + dx, my + curve, skinPalette[2]);
  }

  // Lower lip (highlight)
  for (let dx = -mouthWidth + 1; dx <= mouthWidth - 1; dx++) {
    setPixel(ctx, cx + dx, my + 1, skinPalette[3]);
    setPixel(ctx, cx + dx, my + 2, skinPalette[4]);
  }

  // Expression modifiers
  if (expression === 'smile' || expression === 'warm' || expression === 'animated') {
    // Upturned corners
    setPixel(ctx, cx - mouthWidth, my - 1, skinPalette[3]);
    setPixel(ctx, cx + mouthWidth, my - 1, skinPalette[3]);
    setPixel(ctx, cx - mouthWidth + 1, my - 1, skinPalette[2]);
    setPixel(ctx, cx + mouthWidth - 1, my - 1, skinPalette[2]);
  }
  if (expression === 'sly') {
    // Asymmetric smirk
    setPixel(ctx, cx + mouthWidth, my - 1, skinPalette[3]);
    setPixel(ctx, cx + mouthWidth - 1, my - 1, skinPalette[2]);
  }
  if (expression === 'stern' || expression === 'reserved') {
    // Slightly downturned
    setPixel(ctx, cx - mouthWidth, my + 1, skinPalette[2]);
    setPixel(ctx, cx + mouthWidth, my + 1, skinPalette[2]);
  }
  if (expression === 'nervous') {
    // Tighter mouth
    for (let dx = -mouthWidth + 2; dx <= mouthWidth - 2; dx++) {
      setPixel(ctx, cx + dx, my + 1, skinPalette[2]);
    }
  }

  // Lip shadow below
  for (let dx = -mouthWidth + 2; dx <= mouthWidth - 2; dx++) {
    setPixel(ctx, cx + dx, my + 3, skinPalette[2]);
  }
}

// ---------------------------------------------------------------------------
// Hair styles
// ---------------------------------------------------------------------------

/** Short European male hair */
function drawHairShortMale(ctx, cx, cy, hairPalette, opts = {}) {
  const { headRx = 18, headRy = 22, receding = false, tousled = false } = opts;
  const hairTop = cy - headRy - 3;
  const hairBot = cy - headRy * 0.3;

  for (let dy = hairTop; dy <= hairBot; dy++) {
    const progress = (dy - hairTop) / (hairBot - hairTop);
    let halfWidth = headRx * (0.5 + progress * 0.6);
    if (receding && progress < 0.3) halfWidth *= 0.7;
    if (tousled) halfWidth += (seededRandom(dy, 0, 42) - 0.3) * 3;

    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const shade = 2 + (1 - Math.abs(dx) / halfWidth) * 3 +
                    (1 - progress) * 1.5 +
                    (seededRandom(cx + dx, dy, 7) - 0.5) * 1.5;
      setDitheredPixel(ctx, cx + dx, dy, hairPalette, Math.max(0, Math.min(7, shade)));
    }
  }

  // Side hair
  for (let dy = cy - headRy * 0.3; dy <= cy + 2; dy++) {
    for (let side of [-1, 1]) {
      const sideX = cx + side * (headRx + 1);
      const shade = side === -1 ? 3 : 1;
      setPixel(ctx, sideX, dy, hairPalette[shade]);
      setPixel(ctx, sideX + side, dy, hairPalette[shade - 1 < 0 ? 0 : shade - 1]);
    }
  }
}

/** Gray/white hair for elderly characters */
function drawHairGray(ctx, cx, cy, opts = {}) {
  drawHairShortMale(ctx, cx, cy, PALETTE.stone, { ...opts, receding: true });
}

/** Tonsured hair (for priest) */
function drawHairTonsure(ctx, cx, cy, hairPalette, opts = {}) {
  const { headRx = 18, headRy = 22 } = opts;

  // Ring of hair around sides and back, bald on top
  const hairTop = cy - headRy - 2;
  const hairBot = cy + 2;

  for (let dy = hairTop; dy <= hairBot; dy++) {
    const progress = (dy - hairTop) / (hairBot - hairTop);
    const halfWidth = headRx * (0.4 + progress * 0.6);

    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      // Only draw hair on sides (not top center)
      const isSide = Math.abs(dx) > halfWidth * 0.5;
      const isBottom = progress > 0.6;
      if (isSide || isBottom) {
        const shade = 2 + (seededRandom(cx + dx, dy, 11) - 0.5) * 2;
        setDitheredPixel(ctx, cx + dx, dy, hairPalette, Math.max(0, Math.min(7, shade)));
      }
    }
  }
}

/** Ming-era topknot */
function drawHairTopknot(ctx, cx, cy, hairPalette, opts = {}) {
  const { headRx = 18, headRy = 22 } = opts;

  // Slicked back hair at sides
  const hairTop = cy - headRy - 1;
  for (let dy = hairTop; dy <= cy + 2; dy++) {
    const progress = (dy - hairTop) / (cy + 2 - hairTop);
    const halfWidth = headRx * (0.3 + progress * 0.7);
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const shade = 1 + (1 - Math.abs(dx) / halfWidth) * 2 +
                    (seededRandom(cx + dx, dy, 19) - 0.5) * 0.5;
      setDitheredPixel(ctx, cx + dx, dy, hairPalette, Math.max(0, Math.min(6, shade)));
    }
  }

  // Topknot bun
  const bunCx = cx;
  const bunCy = cy - headRy - 5;
  drawShadedEllipse(ctx, bunCx, bunCy, 5, 4, hairPalette, {
    baseShade: 1, shadeRange: 3
  });
}

/** Female hair with jade hairpin */
function drawHairFemalePin(ctx, cx, cy, hairPalette, opts = {}) {
  const { headRx = 18, headRy = 22 } = opts;

  // Long flowing hair swept up
  const hairTop = cy - headRy - 3;
  for (let dy = hairTop; dy <= cy + headRy * 0.3; dy++) {
    const progress = (dy - hairTop) / (cy + headRy * 0.3 - hairTop);
    let halfWidth = headRx * (0.6 + progress * 0.5);
    if (dy > cy) halfWidth += (dy - cy) * 0.3;

    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const shade = 1 + (1 - Math.abs(dx) / halfWidth) * 3 +
                    (1 - progress) * 1.5 +
                    (seededRandom(cx + dx, dy, 23) - 0.5) * 1;
      setDitheredPixel(ctx, cx + dx, dy, hairPalette, Math.max(0, Math.min(7, shade)));
    }
  }

  // Jade hairpin
  const pinX = cx + 6;
  const pinY = cy - headRy - 1;
  for (let dy = -2; dy <= 2; dy++) {
    setPixel(ctx, pinX, pinY + dy, PALETTE.jungle[5]);
  }
  // Pin ornament
  drawShadedEllipse(ctx, pinX, pinY - 3, 2, 2, PALETTE.jungle, {
    baseShade: 4, shadeRange: 2
  });
}

/** Headscarf / tudung */
function drawTudung(ctx, cx, cy, clothPalette, opts = {}) {
  const { headRx = 18, headRy = 22, draped = true } = opts;

  const scarfTop = cy - headRy - 2;
  const scarfBot = cy + headRy * 0.6;

  for (let dy = scarfTop; dy <= scarfBot; dy++) {
    const progress = (dy - scarfTop) / (scarfBot - scarfTop);
    let halfWidth = headRx * (0.7 + progress * 0.5);
    if (dy > cy && draped) halfWidth += (dy - cy) * 0.5;

    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const nd = (dx * dx) / (halfWidth * halfWidth);
      if (nd <= 1) {
        const nx = dx / halfWidth;
        const ny = (dy - cy) / headRy;
        const light = 1 - (nx * 0.35 + ny * 0.3);
        const shade = Math.max(0, Math.min(7, 2 + light * 4 +
          (seededRandom(cx + dx, dy, 31) - 0.5) * 0.8));
        setDitheredPixel(ctx, cx + dx, dy, clothPalette, shade);
      }
    }
  }
}

/** Keffiyeh headscarf */
function drawKeffiyeh(ctx, cx, cy, clothPalette, opts = {}) {
  const { headRx = 18, headRy = 22 } = opts;

  // Wrapped cloth over head, draping over shoulders
  const scarfTop = cy - headRy - 3;
  const scarfBot = cy + headRy * 0.8;

  for (let dy = scarfTop; dy <= scarfBot; dy++) {
    const progress = (dy - scarfTop) / (scarfBot - scarfTop);
    let halfWidth = headRx * (0.6 + progress * 0.7);

    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const nd = (dx * dx) / (halfWidth * halfWidth);
      if (nd <= 1) {
        const light = 1 - (dx / halfWidth * 0.3 + progress * 0.3);
        // Checkered pattern for keffiyeh
        const pattern = ((Math.floor((cx + dx) / 3) + Math.floor(dy / 3)) % 2 === 0) ? 0.5 : 0;
        const shade = Math.max(0, Math.min(7, 2 + light * 3.5 + pattern));
        setDitheredPixel(ctx, cx + dx, dy, clothPalette, shade);
      }
    }
  }
}

/** Songkok cap */
function drawSongkok(ctx, cx, cy, capPalette, opts = {}) {
  const { headRy = 22 } = opts;
  const capTop = cy - headRy - 8;
  const capBot = cy - headRy + 2;
  const capWidth = 14;

  // Flat-topped cylindrical cap
  for (let dy = capTop; dy <= capBot; dy++) {
    const progress = (dy - capTop) / (capBot - capTop);
    const hw = capWidth * (0.8 + progress * 0.2);
    for (let dx = -hw; dx <= hw; dx++) {
      const light = 1 - (dx / hw * 0.3 + progress * 0.4);
      const shade = Math.max(0, Math.min(7, 1 + light * 3));
      setDitheredPixel(ctx, cx + dx, dy, capPalette, shade);
    }
  }
}

/** Morion helmet */
function drawMorionHelmet(ctx, cx, cy, opts = {}) {
  const { headRy = 22 } = opts;
  const metalPalette = PALETTE.stone;
  const helmetTop = cy - headRy - 10;
  const helmetBot = cy - headRy + 4;

  // Main dome
  for (let dy = helmetTop; dy <= helmetBot; dy++) {
    const progress = (dy - helmetTop) / (helmetBot - helmetTop);
    const hw = 16 * Math.sin(progress * Math.PI * 0.9);
    for (let dx = -hw; dx <= hw; dx++) {
      const light = 1 - (dx / Math.max(1, hw) * 0.3 + (1 - progress) * 0.2);
      const shade = Math.max(0, Math.min(7, 2 + light * 4));
      setDitheredPixel(ctx, cx + dx, dy, metalPalette, shade);
    }
  }

  // Crest (raised ridge on top)
  for (let dy = helmetTop - 2; dy <= helmetTop + 4; dy++) {
    setPixel(ctx, cx, dy, metalPalette[6]);
    setPixel(ctx, cx + 1, dy, metalPalette[5]);
  }

  // Brim
  const brimY = helmetBot;
  for (let dx = -20; dx <= 20; dx++) {
    const shade = 3 + (1 - Math.abs(dx) / 20) * 3;
    setDitheredPixel(ctx, cx + dx, brimY, metalPalette, shade);
    setDitheredPixel(ctx, cx + dx, brimY + 1, metalPalette, shade - 1);
  }

  // Metal specular
  setPixel(ctx, cx - 4, helmetTop + 3, PALETTE.specular[4]);
  setPixel(ctx, cx - 3, helmetTop + 2, PALETTE.specular[3]);
}

/** Merchant's cap */
function drawMerchantCap(ctx, cx, cy, capPalette, opts = {}) {
  const { headRy = 22 } = opts;
  const capTop = cy - headRy - 5;
  const capBot = cy - headRy + 2;

  // Rounded soft cap
  for (let dy = capTop; dy <= capBot; dy++) {
    const progress = (dy - capTop) / (capBot - capTop);
    const hw = 16 * Math.sin(Math.max(0.1, progress) * Math.PI * 0.7);
    for (let dx = -hw; dx <= hw; dx++) {
      const light = 1 - (dx / Math.max(1, hw) * 0.3);
      const shade = Math.max(0, Math.min(7, 2 + light * 3 +
        (seededRandom(cx + dx, dy, 37) - 0.5) * 0.8));
      setDitheredPixel(ctx, cx + dx, dy, capPalette, shade);
    }
  }
}

// ---------------------------------------------------------------------------
// Facial hair
// ---------------------------------------------------------------------------

/** Full beard */
function drawBeard(ctx, cx, cy, beardPalette, opts = {}) {
  const { beardLength = 12, beardWidth = 14 } = opts;
  const beardTop = cy + 8;
  const beardBot = beardTop + beardLength;

  for (let dy = beardTop; dy <= beardBot; dy++) {
    const progress = (dy - beardTop) / (beardBot - beardTop);
    const hw = beardWidth * (1 - progress * 0.4);
    for (let dx = -hw; dx <= hw; dx++) {
      const nd = (dx * dx) / (hw * hw);
      if (nd <= 1) {
        const shade = 2 + (1 - nd) * 2 + (1 - progress) * 1.5 +
                      (seededRandom(cx + dx, dy, 41) - 0.5) * 2;
        setDitheredPixel(ctx, cx + dx, dy, beardPalette, Math.max(0, Math.min(7, shade)));
      }
    }
  }
}

/** Mustache */
function drawMustache(ctx, cx, cy, beardPalette, opts = {}) {
  const { width = 10, thick = false } = opts;
  const mustY = cy + 9;
  const thickness = thick ? 3 : 2;

  for (let dy = 0; dy < thickness; dy++) {
    for (let dx = -width; dx <= width; dx++) {
      if (Math.abs(dx) < 2) continue; // gap in center
      // Droop at ends
      const droop = Math.floor(Math.abs(dx) / (width * 0.6));
      const shade = 2 + (1 - Math.abs(dx) / width) * 3 +
                    (seededRandom(cx + dx, mustY + dy, 43) - 0.5) * 1;
      setDitheredPixel(ctx, cx + dx, mustY + dy + droop, beardPalette,
        Math.max(0, Math.min(7, shade)));
    }
  }
}

/** Trimmed/short beard */
function drawStubble(ctx, cx, cy, beardPalette, opts = {}) {
  const { width = 14 } = opts;
  const stubbleTop = cy + 8;
  const stubbleBot = cy + 14;

  for (let dy = stubbleTop; dy <= stubbleBot; dy++) {
    const progress = (dy - stubbleTop) / (stubbleBot - stubbleTop);
    const hw = width * (1 - progress * 0.3);
    for (let dx = -hw; dx <= hw; dx++) {
      // Sparse stipple pattern
      if (seededRandom(cx + dx, dy, 47) > 0.45) {
        const shade = 1 + (seededRandom(cx + dx, dy, 48) - 0.5) * 2;
        setDitheredPixel(ctx, cx + dx, dy, beardPalette, Math.max(0, Math.min(4, shade)));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Clothing
// ---------------------------------------------------------------------------

/** Portuguese doublet (upper torso garment) */
function drawDoublet(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 30, height = 32, trimPalette = null, hasButtons = true, hasCollar = true } = opts;
  const torsoTop = cy + 22;
  const torsoBot = torsoTop + height;

  // White ruff collar
  if (hasCollar) {
    const collarY = torsoTop - 3;
    for (let dy = 0; dy < 4; dy++) {
      const hw = 12 + dy * 1;
      for (let dx = -hw; dx <= hw; dx++) {
        const shade = 4 + (1 - Math.abs(dx) / hw) * 2 +
                      (seededRandom(cx + dx, collarY + dy, 51) - 0.5) * 1;
        setDitheredPixel(ctx, cx + dx, collarY + dy, PALETTE.whitewash,
          Math.max(2, Math.min(7, shade)));
      }
    }
  }

  // Main doublet body
  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.7 + progress * 0.1);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      // SE lighting: left brighter, right and bottom darker
      const light = 1 - (nx * 0.45 + progress * 0.4);
      const shade = Math.max(0, Math.min(7, 1.5 + light * 4.5 +
        (seededRandom(cx + dx, dy, 53) - 0.5) * 0.5));
      setDitheredPixel(ctx, cx + dx, dy, clothPalette, shade);
    }
  }

  // Trim on edges
  if (trimPalette) {
    for (let dy = torsoTop; dy <= torsoBot; dy++) {
      const progress = (dy - torsoTop) / (torsoBot - torsoTop);
      const hw = Math.floor(width * (0.7 + progress * 0.1));
      setPixel(ctx, cx - hw, dy, trimPalette[4]);
      setPixel(ctx, cx + hw, dy, trimPalette[2]);
    }
  }

  // Buttons down center
  if (hasButtons) {
    for (let dy = torsoTop + 3; dy <= torsoBot - 2; dy += 4) {
      setPixel(ctx, cx, dy, PALETTE.gold[6]);
      setPixel(ctx, cx + 1, dy, PALETTE.gold[5]);
      setPixel(ctx, cx, dy + 1, PALETTE.gold[4]);
      setPixel(ctx, cx + 1, dy + 1, PALETTE.gold[3]);
    }
  }
}

/** Jesuit cassock (long black robe) */
function drawCassock(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 28, height = 38 } = opts;
  const torsoTop = cy + 20;
  const torsoBot = torsoTop + height;

  // White clerical collar
  const collarY = torsoTop - 2;
  for (let dx = -6; dx <= 6; dx++) {
    setPixel(ctx, cx + dx, collarY, PALETTE.whitewash[6]);
    setPixel(ctx, cx + dx, collarY + 1, PALETTE.whitewash[5]);
  }

  // Long robe
  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.6 + progress * 0.2);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.35 + progress * 0.2);
      const shade = Math.max(0, Math.min(7, 1 + light * 3 +
        (seededRandom(cx + dx, dy, 57) - 0.5) * 0.5));
      setDitheredPixel(ctx, cx + dx, dy, clothPalette, shade);
    }
  }

  // Wooden crucifix
  const crossX = cx + 2;
  const crossY = torsoTop + 8;
  drawVLine(ctx, crossX, crossY, crossY + 10, PALETTE.wood[5]);
  drawHLine(ctx, crossX - 3, crossX + 3, crossY + 3, PALETTE.wood[5]);
  // Cord
  for (let dx = -4; dx <= 4; dx++) {
    setPixel(ctx, cx + dx, torsoTop + 1, PALETTE.wood[3]);
  }
}

/** Baju kurung (traditional Malay blouse) */
function drawBajuKurung(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 28, height = 34, accentPalette = null } = opts;
  const torsoTop = cy + 20;
  const torsoBot = torsoTop + height;

  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.6 + progress * 0.15);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.3 + progress * 0.25);
      let shade = Math.max(0, Math.min(7, 2 + light * 4));
      // Subtle batik-like pattern
      if (accentPalette && ((Math.floor((cx + dx) / 4) + Math.floor(dy / 4)) % 3 === 0)) {
        setDitheredPixel(ctx, cx + dx, dy, accentPalette, shade);
      } else {
        setDitheredPixel(ctx, cx + dx, dy, clothPalette, shade);
      }
    }
  }
}

/** Chinese changshan robe */
function drawChangshan(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 28, height = 36, accentPalette = null } = opts;
  const torsoTop = cy + 20;
  const torsoBot = torsoTop + height;

  // Mandarin collar
  const collarY = torsoTop - 3;
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      if (Math.abs(dx) < 2 && dy > 1) continue; // V opening
      const shade = 3 + (1 - Math.abs(dx) / 8) * 2;
      setDitheredPixel(ctx, cx + dx, collarY + dy, clothPalette, Math.max(0, Math.min(7, shade)));
    }
  }

  // Robe body
  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.65 + progress * 0.15);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.3 + progress * 0.2);
      const shade = Math.max(0, Math.min(7, 2 + light * 3.5));
      setDitheredPixel(ctx, cx + dx, dy, clothPalette, shade);
    }
  }

  // Front closure line (asymmetric, characteristic of changshan)
  for (let dy = torsoTop; dy <= torsoBot - 4; dy++) {
    setPixel(ctx, cx + 3, dy, clothPalette[1]);
    if (accentPalette && dy % 5 === 0) {
      // Frog button
      setPixel(ctx, cx + 4, dy, accentPalette[5]);
      setPixel(ctx, cx + 5, dy, accentPalette[4]);
    }
  }
}

/** Arab thawb */
function drawThawb(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 28, height = 36 } = opts;
  const torsoTop = cy + 20;
  const torsoBot = torsoTop + height;

  for (let dy = torsoTop; dy <= torsoBot; dy++) {
    const progress = (dy - torsoTop) / (torsoBot - torsoTop);
    const hw = width * (0.6 + progress * 0.2);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.25 + progress * 0.2);
      const shade = Math.max(0, Math.min(7, 3 + light * 3.5 +
        (seededRandom(cx + dx, dy, 61) - 0.5) * 0.5));
      setDitheredPixel(ctx, cx + dx, dy, clothPalette, shade);
    }
  }

  // Neckline
  for (let dx = -5; dx <= 5; dx++) {
    setPixel(ctx, cx + dx, torsoTop, clothPalette[6]);
  }
}

/** Military breastplate */
function drawBreastplate(ctx, cx, cy, opts = {}) {
  const metalPalette = PALETTE.stone;
  const torsoTop = cy + 20;
  const plateHeight = 24;

  for (let dy = 0; dy < plateHeight; dy++) {
    const progress = dy / plateHeight;
    const hw = 22 * (0.7 + progress * 0.15);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.3 + progress * 0.3);
      const shade = Math.max(0, Math.min(7, 3 + light * 3.5));
      setDitheredPixel(ctx, cx + dx, torsoTop + dy, metalPalette, shade);
    }
  }

  // Center ridge
  for (let dy = 0; dy < plateHeight; dy++) {
    setPixel(ctx, cx, torsoTop + dy, metalPalette[6]);
  }

  // Specular highlight
  setPixel(ctx, cx - 5, torsoTop + 4, PALETTE.specular[5]);
  setPixel(ctx, cx - 4, torsoTop + 5, PALETTE.specular[4]);
}

/** Traditional sarong */
function drawSarong(ctx, cx, cy, clothPalette, opts = {}) {
  const { width = 26, startY = 42, height = 20, accentPalette = null } = opts;
  const top = cy + startY;
  const bot = top + height;

  for (let dy = top; dy <= bot; dy++) {
    const progress = (dy - top) / (bot - top);
    const hw = width * (0.8 + progress * 0.1);
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / hw;
      const light = 1 - (nx * 0.25 + progress * 0.2);
      let shade = Math.max(0, Math.min(7, 2 + light * 4));

      // Batik pattern for sarong
      if (accentPalette && ((Math.floor((cx + dx) / 5) + Math.floor(dy / 5)) % 2 === 0)) {
        setDitheredPixel(ctx, cx + dx, dy, accentPalette, shade);
      } else {
        setDitheredPixel(ctx, cx + dx, dy, clothPalette, shade);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Neck
// ---------------------------------------------------------------------------
function drawNeck(ctx, cx, cy, skinPalette) {
  const neckTop = cy + 18;
  const neckBot = cy + 23;
  const neckHW = 6;

  for (let dy = neckTop; dy <= neckBot; dy++) {
    for (let dx = -neckHW; dx <= neckHW; dx++) {
      const shade = 2 + (1 - Math.abs(dx) / neckHW) * 2;
      setDitheredPixel(ctx, cx + dx, dy, skinPalette, shade);
    }
  }
}

// ---------------------------------------------------------------------------
// Dark outline around the full silhouette
// ---------------------------------------------------------------------------
function addDarkOutline(ctx) {
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;
  const outlinePixels = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] > 128) {
        // Check all 4 neighbors for transparent
        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) {
            outlinePixels.push({ x, y });
            break;
          }
          const ni = (ny * W + nx) * 4;
          if (d[ni + 3] < 128) {
            outlinePixels.push({ x, y });
            break;
          }
        }
      }
    }
  }

  for (const p of outlinePixels) {
    setPixel(ctx, p.x, p.y, PALETTE.shadow[1]);
  }
}

// ---------------------------------------------------------------------------
// Character configs
// ---------------------------------------------------------------------------

const CHARACTER_CONFIGS = {
  'player': {
    skinPalette: 'skinPortuguese',
    hairPalette: 'wood',
    clothPalette1: 'clothRed',
    clothPalette2: 'wood',
    bgPalette1: 'gold',
    bgPalette2: 'terracotta',
    hairStyle: 'shortMale',
    hairOpts: { tousled: true },
    clothing: 'doublet',
    clothOpts: { trimPalette: null, hasButtons: true, hasCollar: true },
    facialHair: null,
    headwear: null,
    expression: 'neutral',
    eyeColor: PALETTE.jungle[4], // hazel
    accessories: [],
    seed: 1,
  },
  'fernao-gomes': {
    skinPalette: 'skinPortuguese',
    hairPalette: 'stone',
    clothPalette1: 'clothRed',
    clothPalette2: 'gold',
    bgPalette1: 'gold',
    bgPalette2: 'terracotta',
    hairStyle: 'shortMale',
    hairOpts: { receding: true },
    clothing: 'doublet',
    clothOpts: { trimPalette: 'gold', hasButtons: true, hasCollar: true },
    facialHair: 'beard',
    facialHairPalette: 'stone',
    facialHairOpts: { beardLength: 14, beardWidth: 16 },
    headwear: 'merchantCap',
    headwearPalette: 'clothRed',
    expression: 'neutral',
    eyeColor: PALETTE.wood[3],
    accessories: [],
    seed: 2,
  },
  'capitao-rodrigues': {
    skinPalette: 'skinPortuguese',
    hairPalette: 'wood',
    clothPalette1: 'clothBlue',
    clothPalette2: 'stone',
    bgPalette1: 'stone',
    bgPalette2: 'sand',
    hairStyle: 'none',
    clothing: 'breastplate',
    clothOpts: {},
    facialHair: 'mustache',
    facialHairPalette: 'wood',
    facialHairOpts: { width: 12, thick: true },
    headwear: 'morion',
    expression: 'stern',
    eyeColor: PALETTE.wood[2],
    accessories: [],
    seed: 3,
  },
  'padre-tomas': {
    skinPalette: 'skinPortuguese',
    hairPalette: 'stone',
    clothPalette1: 'shadow',
    clothPalette2: 'wood',
    bgPalette1: 'sand',
    bgPalette2: 'warmStone',
    hairStyle: 'tonsure',
    clothing: 'cassock',
    clothOpts: {},
    facialHair: null,
    headwear: null,
    expression: 'neutral',
    eyeColor: PALETTE.wood[3],
    accessories: ['crucifix'],
    seed: 4,
  },
  'aminah': {
    skinPalette: 'skinMalay',
    hairPalette: 'shadow',
    clothPalette1: 'gold',
    clothPalette2: 'clothSilk',
    bgPalette1: 'gold',
    bgPalette2: 'sand',
    hairStyle: 'none',
    clothing: 'bajuKurung',
    clothOpts: { accentPalette: 'clothSilk' },
    facialHair: null,
    headwear: 'tudung',
    headwearPalette: 'gold',
    expression: 'warm',
    eyeColor: PALETTE.wood[2],
    accessories: [],
    seed: 5,
  },
  'chen-wei': {
    skinPalette: 'skinChinese',
    hairPalette: 'shadow',
    clothPalette1: 'clothBlue',
    clothPalette2: 'clothSilk',
    bgPalette1: 'sand',
    bgPalette2: 'warmStone',
    hairStyle: 'topknot',
    clothing: 'changshan',
    clothOpts: { accentPalette: 'clothSilk' },
    facialHair: 'stubble',
    facialHairPalette: 'shadow',
    facialHairOpts: { width: 8 },
    headwear: null,
    expression: 'reserved',
    eyeColor: PALETTE.wood[2],
    accessories: [],
    seed: 6,
  },
  'rashid': {
    skinPalette: 'skinMalay',
    hairPalette: 'shadow',
    clothPalette1: 'sand',
    clothPalette2: 'clothRed',
    bgPalette1: 'sand',
    bgPalette2: 'terracotta',
    hairStyle: 'none',
    clothing: 'thawb',
    clothOpts: {},
    facialHair: 'beard',
    facialHairPalette: 'shadow',
    facialHairOpts: { beardLength: 10, beardWidth: 12 },
    headwear: 'keffiyeh',
    headwearPalette: 'sand',
    expression: 'animated',
    eyeColor: PALETTE.wood[2],
    accessories: [],
    seed: 7,
  },
  'siti': {
    skinPalette: 'skinMalay',
    hairPalette: 'shadow',
    clothPalette1: 'clothSilk',
    clothPalette2: 'jungle',
    bgPalette1: 'jungle',
    bgPalette2: 'sand',
    hairStyle: 'none',
    clothing: 'bajuKurung',
    clothOpts: { accentPalette: 'jungle', width: 26, height: 30 },
    facialHair: null,
    headwear: 'tudung',
    headwearPalette: 'clothSilk',
    headwearOpts: { draped: true },
    expression: 'nervous',
    eyeColor: PALETTE.wood[3],
    accessories: [],
    seed: 8,
  },
  'alvares': {
    skinPalette: 'skinPortuguese',
    hairPalette: 'wood',
    clothPalette1: 'clothBlue',
    clothPalette2: 'stone',
    bgPalette1: 'stone',
    bgPalette2: 'sand',
    hairStyle: 'shortMale',
    hairOpts: {},
    clothing: 'doublet',
    clothOpts: { hasCollar: false, hasButtons: true },
    facialHair: 'stubble',
    facialHairPalette: 'wood',
    facialHairOpts: { width: 12 },
    headwear: null,
    expression: 'stern',
    eyeColor: PALETTE.wood[2],
    accessories: [],
    seed: 9,
  },
  'mak-enang': {
    skinPalette: 'skinMalay',
    hairPalette: 'stone',
    clothPalette1: 'jungle',
    clothPalette2: 'wood',
    bgPalette1: 'jungle',
    bgPalette2: 'wood',
    hairStyle: 'shortMale',
    hairOpts: { receding: true },
    clothing: 'bajuKurung',
    clothOpts: { accentPalette: 'wood', width: 26 },
    facialHair: null,
    headwear: null,
    expression: 'wise',
    eyeColor: PALETTE.wood[2],
    accessories: ['herbPouch'],
    seed: 10,
    wrinkles: true,
    elderly: true,
  },
  'gaspar-mesquita': {
    skinPalette: 'skinPortuguese',
    hairPalette: 'wood',
    clothPalette1: 'clothRed',
    clothPalette2: 'gold',
    bgPalette1: 'gold',
    bgPalette2: 'terracotta',
    hairStyle: 'shortMale',
    hairOpts: {},
    clothing: 'doublet',
    clothOpts: { trimPalette: 'gold', hasButtons: true, hasCollar: true },
    facialHair: 'mustache',
    facialHairPalette: 'wood',
    facialHairOpts: { width: 8 },
    headwear: null,
    expression: 'neutral',
    eyeColor: PALETTE.wood[3],
    accessories: ['quill'],
    seed: 11,
  },
  'diogo-almeida': {
    skinPalette: 'skinPortuguese',
    hairPalette: 'wood',
    clothPalette1: 'clothSilk',
    clothPalette2: 'gold',
    bgPalette1: 'terracotta',
    bgPalette2: 'wood',
    hairStyle: 'shortMale',
    hairOpts: { tousled: true },
    clothing: 'doublet',
    clothOpts: { trimPalette: 'gold', hasButtons: true, hasCollar: true },
    facialHair: 'stubble',
    facialHairPalette: 'wood',
    facialHairOpts: { width: 10 },
    headwear: null,
    expression: 'sly',
    eyeColor: PALETTE.wood[3],
    accessories: [],
    seed: 12,
  },
  'lin-mei': {
    skinPalette: 'skinChinese',
    hairPalette: 'shadow',
    clothPalette1: 'clothSilk',
    clothPalette2: 'gold',
    bgPalette1: 'clothSilk',
    bgPalette2: 'gold',
    hairStyle: 'femalePin',
    clothing: 'changshan',
    clothOpts: { accentPalette: 'gold', width: 26 },
    facialHair: null,
    headwear: null,
    expression: 'reserved',
    eyeColor: PALETTE.wood[2],
    accessories: [],
    seed: 13,
  },
  'pak-salleh': {
    skinPalette: 'skinMalay',
    hairPalette: 'stone',
    clothPalette1: 'wood',
    clothPalette2: 'clothRed',
    bgPalette1: 'wood',
    bgPalette2: 'sand',
    hairStyle: 'shortMale',
    hairOpts: { receding: true },
    clothing: 'bajuKurung',
    clothOpts: { accentPalette: 'clothRed' },
    facialHair: 'stubble',
    facialHairPalette: 'stone',
    facialHairOpts: { width: 12 },
    headwear: 'songkok',
    headwearPalette: 'shadow',
    expression: 'wise',
    eyeColor: PALETTE.wood[2],
    accessories: [],
    seed: 14,
    wrinkles: true,
    elderly: true,
  },
};

// ---------------------------------------------------------------------------
// Accessory drawing
// ---------------------------------------------------------------------------

function drawAccessories(ctx, cx, cy, accessories, config) {
  for (const acc of accessories) {
    if (acc === 'quill') {
      // Quill behind ear
      const qx = cx + 20;
      const qy = cy - 10;
      for (let dy = -8; dy <= 4; dy++) {
        setPixel(ctx, qx + Math.floor(dy * 0.3), qy + dy, PALETTE.whitewash[6]);
      }
      // Feather
      for (let dx = 0; dx < 4; dx++) {
        setPixel(ctx, qx + dx - 1, qy - 8 - dx, PALETTE.whitewash[5]);
      }
    }
    if (acc === 'herbPouch') {
      // Small pouch at waist
      const px = cx + 20;
      const py = cy + 42;
      drawShadedEllipse(ctx, px, py, 5, 4, PALETTE.wood, {
        baseShade: 2, shadeRange: 3
      });
      // Strap
      drawVLine(ctx, px, py - 8, py - 2, PALETTE.wood[3]);
    }
  }
}

// ---------------------------------------------------------------------------
// Wrinkles for elderly characters
// ---------------------------------------------------------------------------
function drawWrinkles(ctx, cx, cy, skinPalette) {
  // Forehead lines
  for (let i = 0; i < 3; i++) {
    const wy = cy - 12 + i * 3;
    for (let dx = -8; dx <= 8; dx++) {
      if (seededRandom(dx, wy, 71) > 0.4) {
        setPixel(ctx, cx + dx, wy, skinPalette[2]);
      }
    }
  }
  // Crow's feet
  for (let side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const wx = cx + side * (12 + i);
      const wy = cy - 3 + i;
      setPixel(ctx, wx, wy, skinPalette[2]);
    }
  }
  // Nasolabial folds
  for (let dy = 0; dy < 6; dy++) {
    setPixel(ctx, cx - 5 - Math.floor(dy * 0.3), cy + 5 + dy, skinPalette[2]);
    setPixel(ctx, cx + 5 + Math.floor(dy * 0.3), cy + 5 + dy, skinPalette[2]);
  }
}

// ---------------------------------------------------------------------------
// Main portrait drawing function
// ---------------------------------------------------------------------------

function drawPortrait(ctx, characterId, config) {
  const cx = W / 2;     // 64
  const cy = H / 2 - 8; // 56 - offset upward so head is centered, body visible

  const skinPal = PALETTE[config.skinPalette];
  const hairPal = PALETTE[config.hairPalette];
  const clothPal1 = PALETTE[config.clothPalette1];
  const bgPal1 = PALETTE[config.bgPalette1];
  const bgPal2 = PALETTE[config.bgPalette2];

  // 1. Background
  drawBackground(ctx, bgPal1, bgPal2, config.seed);

  // 2. Clothing (drawn first, behind head)
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
      // Draw doublet underneath first
      drawDoublet(ctx, cx, cy, PALETTE[config.clothPalette2], { hasCollar: false, hasButtons: false });
      drawBreastplate(ctx, cx, cy, config.clothOpts || {});
      break;
    default:
      break;
  }

  // 2b. Sarong for characters that need it
  if (config.accessories && config.accessories.includes('sarong')) {
    drawSarong(ctx, cx, cy, PALETTE[config.clothPalette2], {
      accentPalette: PALETTE[config.clothPalette1],
    });
  }

  // 3. Neck
  drawNeck(ctx, cx, cy, skinPal);

  // 4. Head
  drawHead(ctx, cx, cy, skinPal);

  // 5. Ears (before hair/headwear which may overlap)
  drawEars(ctx, cx, cy, skinPal);

  // 6. Facial features
  drawEyes(ctx, cx, cy, {
    expression: config.expression,
    irisColor: config.eyeColor,
  });
  drawEyebrows(ctx, cx, cy, hairPal, { expression: config.expression });
  drawNose(ctx, cx, cy, skinPal);
  drawMouth(ctx, cx, cy, skinPal, { expression: config.expression });

  // 6b. Wrinkles for elderly characters
  if (config.wrinkles) {
    drawWrinkles(ctx, cx, cy, skinPal);
  }

  // 7. Facial hair
  if (config.facialHair) {
    const fhPal = PALETTE[config.facialHairPalette || config.hairPalette];
    const fhOpts = config.facialHairOpts || {};
    switch (config.facialHair) {
      case 'beard':
        drawBeard(ctx, cx, cy, fhPal, fhOpts);
        break;
      case 'mustache':
        drawMustache(ctx, cx, cy, fhPal, fhOpts);
        break;
      case 'stubble':
        drawStubble(ctx, cx, cy, fhPal, fhOpts);
        break;
    }
  }

  // 8. Hair
  switch (config.hairStyle) {
    case 'shortMale':
      drawHairShortMale(ctx, cx, cy, hairPal, config.hairOpts || {});
      break;
    case 'gray':
      drawHairGray(ctx, cx, cy, config.hairOpts || {});
      break;
    case 'tonsure':
      drawHairTonsure(ctx, cx, cy, hairPal, config.hairOpts || {});
      break;
    case 'topknot':
      drawHairTopknot(ctx, cx, cy, hairPal, config.hairOpts || {});
      break;
    case 'femalePin':
      drawHairFemalePin(ctx, cx, cy, hairPal, config.hairOpts || {});
      break;
    case 'none':
      // No visible hair (covered by headwear or bald)
      break;
  }

  // 9. Headwear
  if (config.headwear) {
    const hwPal = PALETTE[config.headwearPalette || config.clothPalette1];
    const hwOpts = config.headwearOpts || {};
    switch (config.headwear) {
      case 'morion':
        drawMorionHelmet(ctx, cx, cy, hwOpts);
        break;
      case 'merchantCap':
        drawMerchantCap(ctx, cx, cy, hwPal, hwOpts);
        break;
      case 'tudung':
        drawTudung(ctx, cx, cy, hwPal, hwOpts);
        break;
      case 'keffiyeh':
        drawKeffiyeh(ctx, cx, cy, hwPal, hwOpts);
        break;
      case 'songkok':
        drawSongkok(ctx, cx, cy, hwPal, hwOpts);
        break;
    }
  }

  // 10. Accessories
  if (config.accessories && config.accessories.length > 0) {
    drawAccessories(ctx, cx, cy, config.accessories, config);
  }

  // 11. Dark silhouette outline (1px)
  addDarkOutline(ctx);
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

// ---------------------------------------------------------------------------
// Generate a single portrait
// ---------------------------------------------------------------------------

function generatePortrait(characterId) {
  const config = CHARACTER_CONFIGS[characterId];
  if (!config) {
    console.error(`Unknown character: ${characterId}`);
    return null;
  }

  // Create 128x128 working canvas
  const workCanvas = createCanvas(W, H);
  const workCtx = workCanvas.getContext('2d');
  workCtx.imageSmoothingEnabled = false;

  // Draw portrait
  drawPortrait(workCtx, characterId, config);

  // Scale up 4x
  const outCanvas = scaleUp(workCanvas);

  return outCanvas;
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

  // Ensure output directory exists
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log(`Generating ${characters.length} VGA portrait(s)...`);
  console.log(`Working resolution: ${W}x${H} -> Output: ${OUT_W}x${OUT_H}`);
  console.log(`Output directory: ${OUT_DIR}\n`);

  for (const id of characters) {
    const canvas = generatePortrait(id);
    if (!canvas) continue;

    const outPath = path.join(OUT_DIR, `${id}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buffer);

    const sizeKb = (buffer.length / 1024).toFixed(1);
    console.log(`  ${id}.png (${sizeKb} KB)`);
  }

  console.log('\nDone!');
}

main();
