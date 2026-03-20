#!/usr/bin/env node
/**
 * Generate Particle Sprite Sheets
 *
 * Creates tiny procedural particle sprite sheets for visual effects:
 *   dust.png      (12×4)  - 3 frames of 4×4 tan/gold dust puffs
 *   fire.png      (16×8)  - 4 frames of 4×8 orange-yellow flames
 *   rain.png      (2×8)   - single raindrop streak
 *   mist.png      (64×8)  - 2 frames of 32×8 white wisps
 *   fireflies.png (8×4)   - 2 frames of 4×4 yellow-green glow dots
 *   smoke.png     (24×8)  - 3 frames of 8×8 grey wisps
 *
 * All colors are drawn from the project palette for visual cohesion.
 *
 * Output: assets/sprites/particles/
 * Usage:  node tools/generate-particle-sprites.cjs
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { PALETTE, hexToRgb } = require('./ultima8-graphics/palette.cjs');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'particles');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

/** Set a single pixel with RGBA values (0-255). */
function putPixel(ctx, x, y, r, g, b, a) {
  const id = ctx.createImageData(1, 1);
  id.data[0] = r;
  id.data[1] = g;
  id.data[2] = b;
  id.data[3] = a;
  ctx.putImageData(id, x, y);
}

/** Parse a palette hex string and return { r, g, b }. */
function rgb(hex) {
  return hexToRgb(hex);
}

/** Lerp between two RGB colors. Returns { r, g, b }. */
function lerpRgb(c1, c2, t) {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
}

/** Save canvas to PNG in the output directory. */
function save(canvas, name) {
  const buf = canvas.toBuffer('image/png');
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, buf);
  console.log(`  ✓ ${name}  (${canvas.width}×${canvas.height})`);
}

// ---------------------------------------------------------------------------
// 1. dust.png  —  12×4, three 4×4 frames
// ---------------------------------------------------------------------------

function generateDust() {
  const canvas = createCanvas(12, 4);
  const ctx = canvas.getContext('2d');

  // Frame 0: small single-pixel dot centre
  const c0 = rgb(PALETTE.sand[5]);
  putPixel(ctx, 1, 1, c0.r, c0.g, c0.b, 180);
  putPixel(ctx, 2, 2, c0.r, c0.g, c0.b, 140);

  // Frame 1: slightly larger cluster
  const c1 = rgb(PALETTE.sand[4]);
  const ox1 = 4; // frame offset
  putPixel(ctx, ox1 + 1, 1, c1.r, c1.g, c1.b, 140);
  putPixel(ctx, ox1 + 2, 1, c1.r, c1.g, c1.b, 120);
  putPixel(ctx, ox1 + 1, 2, c1.r, c1.g, c1.b, 120);
  putPixel(ctx, ox1 + 2, 2, c1.r, c1.g, c1.b, 140);

  // Frame 2: dispersed, fading out
  const c2 = rgb(PALETTE.sand[3]);
  const ox2 = 8;
  putPixel(ctx, ox2 + 0, 0, c2.r, c2.g, c2.b, 100);
  putPixel(ctx, ox2 + 3, 0, c2.r, c2.g, c2.b, 80);
  putPixel(ctx, ox2 + 1, 2, c2.r, c2.g, c2.b, 100);
  putPixel(ctx, ox2 + 2, 3, c2.r, c2.g, c2.b, 80);

  save(canvas, 'dust.png');
}

// ---------------------------------------------------------------------------
// 2. fire.png  —  16×8, four 4×8 frames
// ---------------------------------------------------------------------------

function generateFire() {
  const canvas = createCanvas(16, 8);
  const ctx = canvas.getContext('2d');

  // Colors: bottom (dark ember) to top (yellow tip)
  const cBottom = rgb(PALETTE.fire[2]); // dark orange
  const cMid    = rgb(PALETTE.fire[4]); // orange
  const cTop    = rgb(PALETTE.fire[7]); // yellow tip

  // Pre-defined flame shapes per frame (x offsets within a 4-wide column).
  // Each entry is [relX, y, colorLerp (0=bottom,1=top), alpha].
  const frames = [
    // Frame 0 — narrow upright flame
    [
      [1, 7, 0.0, 200], [2, 7, 0.0, 180],
      [1, 6, 0.1, 220], [2, 6, 0.15, 200],
      [1, 5, 0.3, 240], [2, 5, 0.25, 220],
      [1, 4, 0.5, 250], [2, 4, 0.45, 230],
      [1, 3, 0.65, 240], [2, 3, 0.6, 220],
      [1, 2, 0.8, 230],
      [1, 1, 0.95, 200],
    ],
    // Frame 1 — slightly wider, shifted
    [
      [1, 7, 0.0, 190], [2, 7, 0.0, 200],
      [1, 6, 0.15, 220], [2, 6, 0.1, 210],
      [0, 5, 0.2, 180], [1, 5, 0.35, 240], [2, 5, 0.3, 230],
      [1, 4, 0.5, 250], [2, 4, 0.55, 240],
      [1, 3, 0.7, 240], [2, 3, 0.65, 230],
      [2, 2, 0.85, 220],
      [2, 1, 0.95, 190],
    ],
    // Frame 2 — leaning left
    [
      [1, 7, 0.0, 210], [2, 7, 0.0, 190],
      [1, 6, 0.1, 220], [2, 6, 0.15, 210],
      [1, 5, 0.3, 240], [2, 5, 0.35, 230],
      [0, 4, 0.45, 220], [1, 4, 0.55, 250],
      [0, 3, 0.7, 230], [1, 3, 0.7, 240],
      [0, 2, 0.85, 210],
      [0, 1, 0.95, 180],
    ],
    // Frame 3 — leaning right, tall
    [
      [1, 7, 0.0, 200], [2, 7, 0.0, 200],
      [1, 6, 0.1, 220], [2, 6, 0.1, 220],
      [1, 5, 0.3, 240], [2, 5, 0.3, 230], [3, 5, 0.2, 180],
      [2, 4, 0.5, 250], [3, 4, 0.45, 220],
      [2, 3, 0.7, 240], [3, 3, 0.65, 220],
      [2, 2, 0.85, 220],
      [2, 1, 0.95, 200],
      [2, 0, 1.0, 160],
    ],
  ];

  for (let f = 0; f < 4; f++) {
    const ox = f * 4;
    for (const [rx, y, t, a] of frames[f]) {
      // Lerp: bottom half uses cBottom→cMid, top half uses cMid→cTop
      let c;
      if (t <= 0.5) {
        c = lerpRgb(cBottom, cMid, t * 2);
      } else {
        c = lerpRgb(cMid, cTop, (t - 0.5) * 2);
      }
      putPixel(ctx, ox + rx, y, c.r, c.g, c.b, a);
    }
  }

  save(canvas, 'fire.png');
}

// ---------------------------------------------------------------------------
// 3. rain.png  —  2×8, single raindrop streak
// ---------------------------------------------------------------------------

function generateRain() {
  const canvas = createCanvas(2, 8);
  const ctx = canvas.getContext('2d');

  const cLight = rgb(PALETTE.water[6]);
  const cBright = rgb(PALETTE.water[7]);

  // Top pixel transparent (row 0), then gradient from light to bright
  // Streak occupies column 0, with a faint secondary on column 1
  const alphas = [0, 40, 80, 120, 160, 200, 230, 255];
  for (let y = 0; y < 8; y++) {
    const t = y / 7;
    const c = lerpRgb(cLight, cBright, t);
    putPixel(ctx, 0, y, c.r, c.g, c.b, alphas[y]);
    // Faint secondary column for a bit of width
    if (y >= 3 && y <= 6) {
      putPixel(ctx, 1, y, c.r, c.g, c.b, Math.floor(alphas[y] * 0.3));
    }
  }

  save(canvas, 'rain.png');
}

// ---------------------------------------------------------------------------
// 4. mist.png  —  64×8, two 32×8 frames of semi-transparent wisps
// ---------------------------------------------------------------------------

function generateMist() {
  const canvas = createCanvas(64, 8);
  const ctx = canvas.getContext('2d');

  const cWisp = rgb(PALETTE.whitewash[6]);

  // Simple seeded pseudo-random for reproducibility
  let seed = 42;
  function rand() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed >> 16) / 32767;
  }

  // Generate a wispy cloud pattern for one 32×8 frame
  function drawWisp(ox, shiftY) {
    // Create a density map for the wisp
    for (let x = 0; x < 32; x++) {
      for (let y = 0; y < 8; y++) {
        // Bell curve density horizontally centred, vertically centred around row 3-4
        const cx = 16, cy = 3.5 + shiftY;
        const dx = (x - cx) / 12;
        const dy = (y - cy) / 3;
        const dist = dx * dx + dy * dy;
        const density = Math.exp(-dist * 2.5);

        // Add some noise
        const noise = rand() * 0.4;
        const value = density + noise * density;

        if (value > 0.25) {
          const alpha = Math.min(100, Math.floor(value * 100));
          putPixel(ctx, ox + x, y, cWisp.r, cWisp.g, cWisp.b, alpha);
        }
      }
    }
  }

  drawWisp(0, 0);    // Frame 0
  drawWisp(32, 0.5); // Frame 1, slightly shifted vertically

  save(canvas, 'mist.png');
}

// ---------------------------------------------------------------------------
// 5. fireflies.png  —  8×4, two 4×4 frames
// ---------------------------------------------------------------------------

function generateFireflies() {
  const canvas = createCanvas(8, 4);
  const ctx = canvas.getContext('2d');

  const cGlow = rgb(PALETTE.grass[7]); // yellow-green

  // Frame 0: small bright dot at (1,1) with faint halo
  putPixel(ctx, 1, 1, cGlow.r, cGlow.g, cGlow.b, 255); // core
  putPixel(ctx, 0, 1, cGlow.r, cGlow.g, cGlow.b, 50);  // halo left
  putPixel(ctx, 2, 1, cGlow.r, cGlow.g, cGlow.b, 50);  // halo right
  putPixel(ctx, 1, 0, cGlow.r, cGlow.g, cGlow.b, 50);  // halo top
  putPixel(ctx, 1, 2, cGlow.r, cGlow.g, cGlow.b, 50);  // halo bottom

  // Frame 1: slightly larger/brighter, shifted to (5,2) in second frame
  const ox = 4;
  putPixel(ctx, ox + 1, 1, cGlow.r, cGlow.g, cGlow.b, 255); // core
  putPixel(ctx, ox + 2, 1, cGlow.r, cGlow.g, cGlow.b, 255); // core expanded
  putPixel(ctx, ox + 1, 2, cGlow.r, cGlow.g, cGlow.b, 200); // core expanded
  putPixel(ctx, ox + 0, 1, cGlow.r, cGlow.g, cGlow.b, 80);  // halo
  putPixel(ctx, ox + 3, 1, cGlow.r, cGlow.g, cGlow.b, 80);  // halo
  putPixel(ctx, ox + 1, 0, cGlow.r, cGlow.g, cGlow.b, 80);  // halo
  putPixel(ctx, ox + 2, 0, cGlow.r, cGlow.g, cGlow.b, 60);  // halo
  putPixel(ctx, ox + 2, 2, cGlow.r, cGlow.g, cGlow.b, 80);  // halo
  putPixel(ctx, ox + 1, 3, cGlow.r, cGlow.g, cGlow.b, 60);  // halo
  putPixel(ctx, ox + 2, 3, cGlow.r, cGlow.g, cGlow.b, 40);  // halo

  save(canvas, 'fireflies.png');
}

// ---------------------------------------------------------------------------
// 6. smoke.png  —  24×8, three 8×8 frames of grey wisps
// ---------------------------------------------------------------------------

function generateSmoke() {
  const canvas = createCanvas(24, 8);
  const ctx = canvas.getContext('2d');

  const cDark  = rgb(PALETTE.shadow[5]); // #1A1A1A
  const cMid   = rgb(PALETTE.shadow[6]); // #202020
  const cLight = rgb(PALETTE.shadow[7]); // #252525

  // Each frame is a column of rising, dispersing smoke.
  // Frame 0: compact cluster at bottom
  const f0 = [
    // [relX, y, color, alpha]
    [3, 7, cDark, 150], [4, 7, cDark, 140],
    [3, 6, cDark, 145], [4, 6, cMid, 135],
    [3, 5, cMid, 130],  [4, 5, cMid, 125],
    [2, 4, cMid, 100],  [3, 4, cMid, 120], [4, 4, cLight, 110],
    [3, 3, cLight, 100], [4, 3, cLight, 90],
    [3, 2, cLight, 80],
  ];

  // Frame 1: mid-dispersal
  const f1 = [
    [3, 7, cDark, 130], [4, 7, cDark, 120],
    [2, 6, cDark, 120], [3, 6, cMid, 125], [4, 6, cMid, 115], [5, 6, cDark, 100],
    [2, 5, cMid, 110],  [3, 5, cMid, 120], [4, 5, cMid, 115], [5, 5, cMid, 100],
    [2, 4, cMid, 100],  [3, 4, cLight, 110], [4, 4, cLight, 105], [5, 4, cMid, 90],
    [2, 3, cLight, 90], [3, 3, cLight, 95],  [4, 3, cLight, 90],  [5, 3, cLight, 80],
    [3, 2, cLight, 80], [4, 2, cLight, 75],
    [3, 1, cLight, 60],
  ];

  // Frame 2: fully dispersed
  const f2 = [
    [3, 7, cDark, 100], [4, 7, cDark, 90],
    [1, 6, cDark, 80],  [2, 6, cDark, 90],  [5, 6, cDark, 85],  [6, 6, cDark, 80],
    [1, 5, cMid, 85],   [2, 5, cMid, 95],   [5, 5, cMid, 90],   [6, 5, cMid, 80],
    [1, 4, cMid, 80],   [3, 4, cLight, 90],  [4, 4, cLight, 85],  [6, 4, cMid, 75],
    [1, 3, cLight, 70], [2, 3, cLight, 80],  [5, 3, cLight, 75],  [6, 3, cLight, 65],
    [2, 2, cLight, 65], [3, 2, cLight, 70],  [4, 2, cLight, 65],  [5, 2, cLight, 60],
    [2, 1, cLight, 55], [3, 1, cLight, 60],  [4, 1, cLight, 55],  [5, 1, cLight, 50],
    [3, 0, cLight, 45], [4, 0, cLight, 40],
  ];

  const allFrames = [f0, f1, f2];
  for (let f = 0; f < 3; f++) {
    const ox = f * 8;
    for (const [rx, y, c, a] of allFrames[f]) {
      putPixel(ctx, ox + rx, y, c.r, c.g, c.b, a);
    }
  }

  save(canvas, 'smoke.png');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('Generating particle sprite sheets...');
  console.log(`  Output: ${OUT_DIR}\n`);

  ensureOutDir();

  generateDust();
  generateFire();
  generateRain();
  generateMist();
  generateFireflies();
  generateSmoke();

  console.log('\nDone! 6 particle sprite sheets generated.');
}

main();
