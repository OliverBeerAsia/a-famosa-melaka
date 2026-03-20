#!/usr/bin/env node
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { PALETTE, hexToRgb, rgbToHex, lerpColor, DITHER_MATRIX } = require('./ultima8-graphics/palette.cjs');

// ---------------------------------------------------------------------------
// Output directories
// ---------------------------------------------------------------------------
const UI_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'ui');
const ITEMS_DIR = path.join(UI_DIR, 'items');

fs.mkdirSync(UI_DIR, { recursive: true });
fs.mkdirSync(ITEMS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) – deterministic output across runs
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(15801580); // seed: Melaka 1580

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setPixel(ctx, x, y, hex, alpha) {
  const c = hexToRgb(hex);
  if (!c) return;
  if (alpha !== undefined && alpha < 1) {
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
  } else {
    ctx.fillStyle = hex;
  }
  ctx.fillRect(x, y, 1, 1);
}

function fillRect(ctx, x, y, w, h, hex) {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, w, h);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function saveCanvas(canvas, filePath) {
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  console.log(`  -> ${path.relative(path.join(__dirname, '..'), filePath)}`);
}

// ---------------------------------------------------------------------------
// 1. Parchment Background (512×128)
// ---------------------------------------------------------------------------
function generateParchment() {
  console.log('Generating parchment-bg.png ...');
  const W = 512, H = 128;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Base parchment colors derived from palette warm tones
  const baseR = 212, baseG = 197, baseB = 160; // #D4C5A0

  // Pass 1 – base fill with per-pixel noise
  const imgData = ctx.createImageData(W, H);
  const d = imgData.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      // Noise offset
      const noise = (rng() - 0.5) * 30;
      // Low-frequency undulation
      const wave = Math.sin(x * 0.012 + y * 0.02) * 8 +
                   Math.sin(x * 0.007 - y * 0.015) * 6;

      d[idx]     = clamp(baseR + noise + wave, 0, 255);
      d[idx + 1] = clamp(baseG + noise + wave - 4, 0, 255);
      d[idx + 2] = clamp(baseB + noise + wave - 12, 0, 255);
      d[idx + 3] = 255;
    }
  }

  // Pass 2 – edge vignette
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const edgeX = Math.min(x, W - 1 - x) / (W * 0.15);
      const edgeY = Math.min(y, H - 1 - y) / (H * 0.2);
      const edgeFactor = clamp(Math.min(edgeX, edgeY), 0, 1);
      const darken = 1.0 - (1.0 - edgeFactor) * 0.35;
      d[idx]     = clamp(d[idx] * darken, 0, 255);
      d[idx + 1] = clamp(d[idx + 1] * darken, 0, 255);
      d[idx + 2] = clamp(d[idx + 2] * darken, 0, 255);
    }
  }

  // Pass 3 – stain marks (darker spots)
  const stainCount = 6;
  for (let s = 0; s < stainCount; s++) {
    const cx = Math.floor(rng() * W);
    const cy = Math.floor(rng() * H);
    const radius = 8 + Math.floor(rng() * 20);
    const intensity = 0.08 + rng() * 0.12;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const dist = Math.sqrt(dx * dx + dy * dy) / radius;
        if (dist > 1) continue;
        const falloff = (1 - dist * dist) * intensity;
        const idx = (py * W + px) * 4;
        d[idx]     = clamp(d[idx] * (1 - falloff), 0, 255);
        d[idx + 1] = clamp(d[idx + 1] * (1 - falloff * 1.1), 0, 255);
        d[idx + 2] = clamp(d[idx + 2] * (1 - falloff * 0.9), 0, 255);
      }
    }
  }

  // Pass 4 – crease / fold lines
  const creases = [
    { x: Math.floor(W * 0.33), vertical: true },
    { x: Math.floor(W * 0.66), vertical: true },
    { y: Math.floor(H * 0.5), vertical: false },
  ];
  for (const crease of creases) {
    if (crease.vertical) {
      for (let y = 0; y < H; y++) {
        const offset = Math.floor(Math.sin(y * 0.08) * 1.5);
        for (let dx = -1; dx <= 1; dx++) {
          const px = crease.x + dx + offset;
          if (px < 0 || px >= W) continue;
          const idx = (y * W + px) * 4;
          const factor = dx === 0 ? 0.88 : 0.94;
          d[idx]     = clamp(d[idx] * factor, 0, 255);
          d[idx + 1] = clamp(d[idx + 1] * factor, 0, 255);
          d[idx + 2] = clamp(d[idx + 2] * factor, 0, 255);
        }
      }
    } else {
      for (let x = 0; x < W; x++) {
        const offset = Math.floor(Math.sin(x * 0.06) * 1);
        for (let dy = -1; dy <= 1; dy++) {
          const py = crease.y + dy + offset;
          if (py < 0 || py >= H) continue;
          const idx = (py * W + x) * 4;
          const factor = dy === 0 ? 0.88 : 0.94;
          d[idx]     = clamp(d[idx] * factor, 0, 255);
          d[idx + 1] = clamp(d[idx + 1] * factor, 0, 255);
          d[idx + 2] = clamp(d[idx + 2] * factor, 0, 255);
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  saveCanvas(canvas, path.join(UI_DIR, 'parchment-bg.png'));
}

// ---------------------------------------------------------------------------
// 2. Border Corner – Azulejo (16×16)
// ---------------------------------------------------------------------------
function generateBorderCorner() {
  console.log('Generating border-corner.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  const blue = PALETTE.clothBlue;
  const white = PALETTE.whitewash;

  // Fill white base
  fillRect(ctx, 0, 0, S, S, white[7]);

  // Portuguese azulejo geometric floral pattern
  // Outer border (blue)
  for (let i = 0; i < S; i++) {
    setPixel(ctx, i, 0, blue[5]);    // top
    setPixel(ctx, i, S - 1, blue[5]);// bottom
    setPixel(ctx, 0, i, blue[5]);    // left
    setPixel(ctx, S - 1, i, blue[5]);// right
  }
  // Second border line
  for (let i = 1; i < S - 1; i++) {
    setPixel(ctx, i, 1, blue[3]);
    setPixel(ctx, i, S - 2, blue[3]);
    setPixel(ctx, 1, i, blue[3]);
    setPixel(ctx, S - 2, i, blue[3]);
  }

  // Diamond in center
  const center = 7;
  const diamondPixels = [
    [center, 3], [center, 4],
    [center - 1, 4], [center + 1, 4],
    [center - 2, 5], [center + 2, 5],
    [center - 3, 6], [center + 3, 6],
    [center - 3, 7], [center + 3, 7],
    [center - 4, 7], [center + 4, 7],
    [center - 3, 8], [center + 3, 8],
    [center - 3, 9], [center + 3, 9],
    [center - 2, 10], [center + 2, 10],
    [center - 1, 11], [center + 1, 11],
    [center, 11], [center, 12],
  ];
  for (const [px, py] of diamondPixels) {
    if (px >= 2 && px < S - 2 && py >= 2 && py < S - 2) {
      setPixel(ctx, px, py, blue[6]);
    }
  }

  // Floral dots in the four quadrants
  const dots = [
    [4, 4], [11, 4], [4, 11], [11, 11], // corner accents
    [7, 7], [8, 7], [7, 8], [8, 8],     // center fill
  ];
  for (const [px, py] of dots) {
    setPixel(ctx, px, py, blue[7]);
  }

  // Small accent crosses
  const crosses = [[4, 7], [11, 7], [7, 4], [7, 11]];
  for (const [cx, cy] of crosses) {
    if (cx >= 2 && cx < S - 2 && cy >= 2 && cy < S - 2) {
      setPixel(ctx, cx, cy, blue[4]);
    }
  }

  // White highlight dots on blue border intersections for depth
  setPixel(ctx, 0, 0, blue[7]);
  setPixel(ctx, S - 1, 0, blue[7]);
  setPixel(ctx, 0, S - 1, blue[7]);
  setPixel(ctx, S - 1, S - 1, blue[7]);

  saveCanvas(canvas, path.join(UI_DIR, 'border-corner.png'));
}

// ---------------------------------------------------------------------------
// 3. Portrait Frame (68×68)
// ---------------------------------------------------------------------------
function generatePortraitFrame() {
  console.log('Generating portrait-frame.png ...');
  const S = 68;
  const BORDER = 4;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  const gold = PALETTE.gold;

  // Transparent background
  ctx.clearRect(0, 0, S, S);

  // Draw frame border
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Determine if this pixel is in the frame (not the transparent center)
      const inCenter = x >= BORDER && x < S - BORDER && y >= BORDER && y < S - BORDER;
      if (inCenter) continue;

      // Distance from edge for bevel effect
      const distFromOuter = Math.min(x, y, S - 1 - x, S - 1 - y);
      const distFromInner = BORDER - 1 - distFromOuter;

      // Bevel: top-left gets lighter, bottom-right gets darker
      let shade;
      const isTopLeft = (x + y) < S;
      if (distFromOuter === 0) {
        // Outermost edge
        shade = isTopLeft ? gold[6] : gold[2];
      } else if (distFromOuter === BORDER - 1) {
        // Innermost edge (adjacent to portrait)
        shade = isTopLeft ? gold[3] : gold[6];
      } else {
        // Mid frame
        shade = isTopLeft ? gold[5] : gold[3];
      }

      // Highlight top-left corner specifically
      if (distFromOuter <= 1 && x < BORDER + 2 && y < BORDER + 2) {
        shade = gold[7];
      }
      // Darken bottom-right corner
      if (distFromOuter <= 1 && x >= S - BORDER - 2 && y >= S - BORDER - 2) {
        shade = gold[1];
      }

      setPixel(ctx, x, y, shade);
    }
  }

  // Corner ornaments – small diamond/dot motifs at each corner
  const ornamentColor = gold[7];
  const ornamentDark = gold[2];
  // Top-left ornament
  setPixel(ctx, 1, 1, ornamentColor);
  setPixel(ctx, 2, 1, ornamentColor);
  setPixel(ctx, 1, 2, ornamentColor);
  // Top-right ornament
  setPixel(ctx, S - 2, 1, ornamentColor);
  setPixel(ctx, S - 3, 1, ornamentColor);
  setPixel(ctx, S - 2, 2, ornamentColor);
  // Bottom-left ornament
  setPixel(ctx, 1, S - 2, ornamentDark);
  setPixel(ctx, 2, S - 2, ornamentDark);
  setPixel(ctx, 1, S - 3, ornamentDark);
  // Bottom-right ornament
  setPixel(ctx, S - 2, S - 2, ornamentDark);
  setPixel(ctx, S - 3, S - 2, ornamentDark);
  setPixel(ctx, S - 2, S - 3, ornamentDark);

  // Add small decorative ticks along edges (midpoints)
  const mid = Math.floor(S / 2);
  // Top edge
  setPixel(ctx, mid, 0, gold[7]);
  setPixel(ctx, mid - 1, 0, gold[6]);
  setPixel(ctx, mid + 1, 0, gold[6]);
  // Bottom edge
  setPixel(ctx, mid, S - 1, gold[1]);
  setPixel(ctx, mid - 1, S - 1, gold[2]);
  setPixel(ctx, mid + 1, S - 1, gold[2]);
  // Left edge
  setPixel(ctx, 0, mid, gold[6]);
  setPixel(ctx, 0, mid - 1, gold[7]);
  setPixel(ctx, 0, mid + 1, gold[5]);
  // Right edge
  setPixel(ctx, S - 1, mid, gold[2]);
  setPixel(ctx, S - 1, mid - 1, gold[3]);
  setPixel(ctx, S - 1, mid + 1, gold[1]);

  saveCanvas(canvas, path.join(UI_DIR, 'portrait-frame.png'));
}

// ---------------------------------------------------------------------------
// 4. Inventory Item Icons (16×16 each)
// ---------------------------------------------------------------------------

// Helper to draw a filled circle
function drawCircle(ctx, cx, cy, r, color) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        setPixel(ctx, cx + dx, cy + dy, color);
      }
    }
  }
}

// Helper to draw a single-pixel line (Bresenham)
function drawLine(ctx, x0, y0, x1, y1, color) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    setPixel(ctx, x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function generateTradingSeal() {
  console.log('Generating trading-seal.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const red = PALETTE.clothRed;

  // Wax seal body – dark red circle
  drawCircle(ctx, 7, 8, 5, red[4]);
  drawCircle(ctx, 7, 8, 4, red[5]);
  drawCircle(ctx, 7, 8, 3, red[6]);

  // Highlight on top-left
  setPixel(ctx, 5, 6, red[7]);
  setPixel(ctx, 6, 6, red[7]);
  setPixel(ctx, 5, 7, red[7]);

  // Shadow on bottom-right
  setPixel(ctx, 9, 10, red[3]);
  setPixel(ctx, 10, 9, red[3]);
  setPixel(ctx, 10, 10, red[2]);

  // Impression mark (cross/seal pattern in center)
  setPixel(ctx, 7, 7, red[3]);
  setPixel(ctx, 7, 8, red[3]);
  setPixel(ctx, 7, 9, red[3]);
  setPixel(ctx, 6, 8, red[3]);
  setPixel(ctx, 8, 8, red[3]);

  // Outer rim detail
  setPixel(ctx, 7, 3, red[3]);
  setPixel(ctx, 7, 13, red[3]);
  setPixel(ctx, 2, 8, red[3]);
  setPixel(ctx, 12, 8, red[3]);

  // Small bit of ribbon at top
  setPixel(ctx, 6, 2, red[4]);
  setPixel(ctx, 7, 2, red[5]);
  setPixel(ctx, 8, 2, red[4]);
  setPixel(ctx, 5, 1, red[3]);
  setPixel(ctx, 9, 1, red[3]);

  saveCanvas(canvas, path.join(ITEMS_DIR, 'trading-seal.png'));
}

function generateCoinPouch() {
  console.log('Generating coin-pouch.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const wood = PALETTE.wood; // brown leather
  const gold = PALETTE.gold;

  // Pouch body (rounded bag shape)
  // Bottom half – wide
  for (let y = 7; y <= 14; y++) {
    const halfWidth = Math.floor(4 + (1 - Math.abs(y - 10) / 5) * 2);
    for (let x = 7 - halfWidth; x <= 7 + halfWidth; x++) {
      if (x < 0 || x >= S) continue;
      const shade = x < 7 ? wood[5] : wood[4];
      setPixel(ctx, x, y, shade);
    }
  }
  // Top cinch
  for (let x = 5; x <= 9; x++) {
    setPixel(ctx, x, 6, wood[6]);
    setPixel(ctx, x, 5, wood[5]);
  }
  // Tie string
  setPixel(ctx, 7, 4, wood[3]);
  setPixel(ctx, 7, 3, wood[3]);
  setPixel(ctx, 6, 3, wood[2]);
  setPixel(ctx, 8, 3, wood[2]);

  // Leather highlight
  setPixel(ctx, 5, 8, wood[6]);
  setPixel(ctx, 5, 9, wood[6]);
  setPixel(ctx, 5, 10, wood[6]);

  // Shadow on right
  setPixel(ctx, 10, 10, wood[2]);
  setPixel(ctx, 10, 11, wood[2]);
  setPixel(ctx, 9, 12, wood[2]);

  // Gold coins peeking out of top
  setPixel(ctx, 6, 5, gold[6]);
  setPixel(ctx, 7, 4, gold[7]);
  setPixel(ctx, 8, 5, gold[5]);
  setPixel(ctx, 9, 4, gold[6]);
  setPixel(ctx, 9, 5, gold[4]);

  // Coin edge detail
  setPixel(ctx, 7, 3, gold[4]);

  saveCanvas(canvas, path.join(ITEMS_DIR, 'coin-pouch.png'));
}

function generateSpiceSample() {
  console.log('Generating spice-sample.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const terra = PALETTE.terracotta;
  const fire = PALETTE.fire;
  const sand = PALETTE.sand;

  // Small bowl/pile of spice
  // Pile shape – mound from bottom center
  const pilePixels = [
    // Bottom layer (widest)
    [4, 13], [5, 13], [6, 13], [7, 13], [8, 13], [9, 13], [10, 13], [11, 13],
    [4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12],
    // Middle layer
    [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11],
    [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10],
    // Upper layer
    [6, 9], [7, 9], [8, 9], [9, 9],
    // Peak
    [7, 8], [8, 8],
  ];

  for (const [px, py] of pilePixels) {
    // Gradient: lighter on top, darker at base
    const heightFactor = (13 - py) / 5;
    let color;
    if (heightFactor > 0.7) color = fire[6]; // bright orange top
    else if (heightFactor > 0.4) color = fire[5];
    else if (heightFactor > 0.2) color = terra[5];
    else color = terra[4];

    // Left side slightly lighter (light source)
    if (px < 7) color = lerpColor(color, fire[7], 0.15);
    // Right side darker
    if (px > 9) color = lerpColor(color, terra[2], 0.2);

    setPixel(ctx, px, py, color);
  }

  // Scattered grains around base
  setPixel(ctx, 3, 14, terra[4]);
  setPixel(ctx, 12, 14, terra[3]);
  setPixel(ctx, 5, 14, fire[5]);
  setPixel(ctx, 10, 14, terra[5]);
  setPixel(ctx, 7, 14, fire[4]);

  // Shadow under pile
  for (let x = 4; x <= 11; x++) {
    setPixel(ctx, x, 14, sand[2], 0.5);
  }

  saveCanvas(canvas, path.join(ITEMS_DIR, 'spice-sample.png'));
}

function generateLetter() {
  console.log('Generating letter.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const parchment = PALETTE.sand;
  const red = PALETTE.clothRed;
  const wood = PALETTE.wood;

  // Folded parchment body
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 12; x++) {
      let shade = parchment[6];
      // Fold shadow in middle
      if (y === 8) shade = parchment[4];
      if (y === 7) shade = parchment[5];
      // Edges slightly darker
      if (x === 3 || x === 12) shade = parchment[5];
      if (y === 3 || y === 13) shade = parchment[5];
      setPixel(ctx, x, y, shade);
    }
  }

  // Fold crease highlight above fold
  for (let x = 4; x <= 11; x++) {
    setPixel(ctx, x, 6, parchment[7]);
  }

  // Corner fold (top-right)
  setPixel(ctx, 12, 3, '#00000000'); // transparent – folded away
  setPixel(ctx, 11, 3, parchment[4]);
  setPixel(ctx, 12, 4, parchment[4]);
  setPixel(ctx, 11, 4, parchment[3]);

  // Text lines (implied)
  for (let x = 5; x <= 10; x++) {
    if (x % 2 === 0) {
      setPixel(ctx, x, 5, wood[3]);
      setPixel(ctx, x, 10, wood[3]);
      setPixel(ctx, x, 12, wood[3]);
    }
  }

  // Wax seal on front (center-bottom)
  drawCircle(ctx, 7, 11, 1, red[5]);
  setPixel(ctx, 7, 11, red[6]);
  setPixel(ctx, 7, 10, red[4]);
  setPixel(ctx, 8, 11, red[4]);

  saveCanvas(canvas, path.join(ITEMS_DIR, 'letter.png'));
}

function generateRosary() {
  console.log('Generating rosary.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const gold = PALETTE.gold;
  const wood = PALETTE.wood;

  // Rosary beads arranged in a curved/oval loop
  // Bead positions forming a rough oval
  const beadPositions = [
    // Top arc
    [6, 2], [8, 2], [10, 3],
    // Right side
    [11, 5], [11, 7], [11, 9],
    // Bottom arc
    [10, 11], [8, 12], [6, 12],
    // Left side
    [4, 11], [3, 9], [3, 7], [3, 5],
    // Close top
    [4, 3],
  ];

  // Draw string between beads (darker gold)
  for (let i = 0; i < beadPositions.length; i++) {
    const [x1, y1] = beadPositions[i];
    const [x2, y2] = beadPositions[(i + 1) % beadPositions.length];
    drawLine(ctx, x1, y1, x2, y2, gold[2]);
  }

  // Draw beads
  for (const [bx, by] of beadPositions) {
    setPixel(ctx, bx, by, gold[5]);
    // Highlight
    if (bx > 6) setPixel(ctx, bx, by, gold[6]);
  }

  // Cross hanging from bottom center
  const crossX = 7, crossY = 13;
  // Vertical bar
  setPixel(ctx, crossX, 13, gold[6]);
  setPixel(ctx, crossX, 14, gold[5]);
  setPixel(ctx, crossX, 15, gold[4]);
  // Horizontal bar
  setPixel(ctx, crossX - 1, 14, gold[5]);
  setPixel(ctx, crossX + 1, 14, gold[5]);
  // Cross highlight
  setPixel(ctx, crossX, 13, gold[7]);

  // String from loop to cross
  drawLine(ctx, 7, 12, 7, 13, gold[3]);

  // Add a larger "Our Father" bead at cardinal points
  setPixel(ctx, 7, 2, gold[7]); // top center, brighter
  setPixel(ctx, 11, 7, gold[7]); // right
  setPixel(ctx, 3, 7, gold[7]); // left

  saveCanvas(canvas, path.join(ITEMS_DIR, 'rosary.png'));
}

function generateMedicinalHerbs() {
  console.log('Generating medicinal-herbs.png ...');
  const S = 16;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const jungle = PALETTE.jungle;
  const grass = PALETTE.grass;
  const wood = PALETTE.wood;
  const sand = PALETTE.sand;

  // Leaf bundle – several leaves spreading from a central tie point

  // Stems converging at center-bottom
  drawLine(ctx, 7, 10, 4, 3, grass[3]);
  drawLine(ctx, 7, 10, 7, 2, grass[3]);
  drawLine(ctx, 7, 10, 10, 3, grass[3]);
  drawLine(ctx, 7, 10, 3, 6, grass[3]);
  drawLine(ctx, 7, 10, 11, 5, grass[3]);

  // Leaf shapes – small ovals at stem tips
  // Leaf 1 (top-left)
  const leaves = [
    { cx: 4, cy: 3, color: jungle[6] },
    { cx: 7, cy: 2, color: grass[6] },
    { cx: 10, cy: 3, color: jungle[5] },
    { cx: 3, cy: 6, color: grass[5] },
    { cx: 11, cy: 5, color: jungle[6] },
  ];

  for (const leaf of leaves) {
    // Each leaf is a small 3x2 or 2x3 oval
    setPixel(ctx, leaf.cx, leaf.cy, leaf.color);
    setPixel(ctx, leaf.cx - 1, leaf.cy, leaf.color);
    setPixel(ctx, leaf.cx + 1, leaf.cy, leaf.color);
    setPixel(ctx, leaf.cx, leaf.cy - 1, leaf.color);
    setPixel(ctx, leaf.cx, leaf.cy + 1, lerpColor(leaf.color, jungle[3], 0.3));
    // Highlight
    setPixel(ctx, leaf.cx - 1, leaf.cy - 1, lerpColor(leaf.color, grass[7], 0.4));
  }

  // Extra leaf detail
  setPixel(ctx, 5, 4, grass[6]);
  setPixel(ctx, 9, 4, jungle[5]);
  setPixel(ctx, 6, 2, grass[5]);
  setPixel(ctx, 8, 2, jungle[6]);

  // Tie string (brown, wrapping around bundle base)
  for (let x = 5; x <= 9; x++) {
    setPixel(ctx, x, 10, sand[4]);
    setPixel(ctx, x, 11, sand[3]);
  }
  // String wrap detail
  setPixel(ctx, 6, 10, wood[5]);
  setPixel(ctx, 8, 10, wood[5]);
  setPixel(ctx, 7, 10, wood[6]);
  setPixel(ctx, 7, 11, wood[5]);

  // Hanging string tails
  setPixel(ctx, 6, 12, sand[3]);
  setPixel(ctx, 8, 12, sand[3]);
  setPixel(ctx, 5, 13, sand[2]);
  setPixel(ctx, 9, 13, sand[2]);

  saveCanvas(canvas, path.join(ITEMS_DIR, 'medicinal-herbs.png'));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('=== Generating UI Assets ===\n');

  generateParchment();
  generateBorderCorner();
  generatePortraitFrame();

  console.log('');
  console.log('--- Item Icons ---');
  generateTradingSeal();
  generateCoinPouch();
  generateSpiceSample();
  generateLetter();
  generateRosary();
  generateMedicinalHerbs();

  console.log('\nDone! All UI assets generated.');
}

main();
