#!/usr/bin/env node
/**
 * generate-interim-screens.cjs
 *
 * INTERIM title / loading cards for the demo.
 *
 * The shipped opening-screen.png and scene-loading-ribeira.png were quantized
 * 19th-century oil paintings of LISBON's Praça do Comércio — wrong city, wrong
 * century, wrong medium, and nothing like the game's pixel art. These cards are
 * deliberately simple stand-ins until the Stage 6 hand-authored title panorama:
 * canon palette only, chunky 3px pixel grid, zero anti-aliasing.
 *
 * Everything is drawn at the native 320x180 resolution with hard-edged rects
 * filled with exact palette-canon colours, then nearest-neighbour upscaled 3x to
 * 960x540 — the same grid the scene plates and 3x sprites share.
 *
 * Usage:
 *   node tools/generate-interim-screens.cjs [--outdir assets/scenes]
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { PALETTE } = require('./ultima8-graphics/palette.cjs');

const NATIVE_W = 320;
const NATIVE_H = 180;
const SCALE = 3; // -> 960x540, matching CHARACTER_SCALE / plate pixelation

// ---------------------------------------------------------------------------
// Palette picks (canon only — see tools/ultima8-graphics/palette.cjs)
// ---------------------------------------------------------------------------
const C = {
  skyHigh: PALETTE.sky[3], // #3A5AB0 zenith
  skyMid: PALETTE.sky[4], // #4A6AC0
  skyLow: PALETTE.sky[5], // #6A8AD0 toward the horizon
  skyGlow: PALETTE.sky[6], // #8AAADD haze right above the skyline
  seaFar: PALETTE.water[5],
  seaMid: PALETTE.water[4],
  seaNear: PALETTE.water[3],
  seaShimmer: PALETTE.water[7],
  silhouette: PALETTE.shadow[3], // near-black landmass/architecture
  silhouetteSoft: PALETTE.shadow[5] || PALETTE.shadow[4], // second silhouette plane
  titleGold: PALETTE.gold[7],
  titleGoldDim: PALETTE.gold[5],
  titleShadow: PALETTE.shadow[0],
  subtitle: PALETTE.sky[7],
};

// ---------------------------------------------------------------------------
// 5x7 blocky pixel font (uppercase + a couple of marks). Rendered as solid
// rects so the lettering keeps hard pixel edges at every scale.
// ---------------------------------------------------------------------------
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
const GLYPH_W = 5;
const GLYPH_H = 7;

function textWidth(text, scale, tracking = 1) {
  if (!text.length) return 0;
  return text.length * (GLYPH_W + tracking) * scale - tracking * scale;
}

function drawText(ctx, text, x, y, scale, color, tracking = 1) {
  ctx.fillStyle = color;
  let cursor = x;
  for (const rawChar of text.toUpperCase()) {
    const glyph = FONT[rawChar] || FONT[' '];
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < GLYPH_W; col++) {
        if (glyph[row][col] !== '#') continue;
        ctx.fillRect(cursor + col * scale, y + row * scale, scale, scale);
      }
    }
    cursor += (GLYPH_W + tracking) * scale;
  }
}

/** Centred text with a hard 1-unit drop shadow (no glow, no AA). */
function drawCenteredText(ctx, text, y, scale, color, shadowColor, tracking = 1) {
  const w = textWidth(text, scale, tracking);
  const x = Math.round((NATIVE_W - w) / 2);
  if (shadowColor) drawText(ctx, text, x + scale, y + scale, scale, shadowColor, tracking);
  drawText(ctx, text, x, y, scale, color, tracking);
  return { x, w };
}

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------
const HORIZON = 108; // native y where the land/sea meets the sky

function drawSky(ctx) {
  const bands = [
    [0, 40, C.skyHigh],
    [40, 74, C.skyMid],
    [74, 98, C.skyLow],
    [98, HORIZON, C.skyGlow],
  ];
  for (const [y0, y1, color] of bands) {
    ctx.fillStyle = color;
    ctx.fillRect(0, y0, NATIVE_W, y1 - y0);
  }

  // Low sun sitting in clear sky above the roofline — flat disc, hard edges.
  ctx.fillStyle = C.titleGoldDim;
  const cx = 250;
  const cy = 78;
  for (let dy = -8; dy <= 8; dy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, 64 - dy * dy)));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

function drawSea(ctx) {
  const bands = [
    [HORIZON, 128, C.seaFar],
    [128, 152, C.seaMid],
    [152, NATIVE_H, C.seaNear],
  ];
  for (const [y0, y1, color] of bands) {
    ctx.fillStyle = color;
    ctx.fillRect(0, y0, NATIVE_W, y1 - y0);
  }

  // Sun glitter + wave dashes: fixed pattern, no randomness (reproducible).
  ctx.fillStyle = C.seaShimmer;
  const dashes = [
    [226, 114, 12], [236, 118, 8], [218, 122, 16], [232, 126, 10],
    [24, 120, 14], [58, 132, 10], [140, 128, 18], [96, 140, 12],
    [180, 138, 16], [268, 134, 14], [40, 150, 20], [200, 156, 16],
    [110, 162, 22], [286, 158, 12], [150, 170, 18], [60, 172, 14],
  ];
  for (const [x, y, w] of dashes) ctx.fillRect(x, y, w, 1);
}

/** Simple blocky landmark silhouettes along the horizon strip. */
function drawSkyline(ctx) {
  const S = C.silhouette;
  const SOFT = C.silhouetteSoft;

  // Far headland (second plane, slightly lighter so the city reads in front).
  ctx.fillStyle = SOFT;
  ctx.fillRect(0, 100, 96, HORIZON - 100);
  for (let i = 0; i < 26; i++) {
    ctx.fillRect(i * 2, 100 - Math.round(Math.sin(i / 4) * 3 + 3), 2, 8);
  }
  ctx.fillRect(252, 102, 68, HORIZON - 102);

  ctx.fillStyle = S;

  // --- St Paul's hill + church (left) ---------------------------------------
  // hill
  for (let i = 0; i <= 34; i++) {
    const h = Math.round(20 - Math.abs(i - 17) * 0.9);
    ctx.fillRect(22 + i * 2, HORIZON - h, 2, h);
  }
  // church body, gable and cross (kept clear of the title banner)
  ctx.fillRect(52, 80, 26, 16);
  ctx.fillRect(56, 74, 18, 6);
  ctx.fillRect(60, 69, 10, 5);
  ctx.fillRect(64, 62, 2, 7);
  ctx.fillRect(61, 65, 8, 2);

  // --- A Famosa gate (centre) ----------------------------------------------
  ctx.fillRect(120, 82, 44, 26);
  for (let i = 0; i < 6; i++) ctx.fillRect(120 + i * 8, 78, 5, 4); // crenellations
  ctx.fillRect(134, 92, 16, 16); // arch void filled — silhouette stays solid
  ctx.fillRect(112, 88, 8, 20);
  ctx.fillRect(164, 88, 8, 20);

  // --- Godowns / shophouse roofline (right of the gate) ---------------------
  const roofs = [
    [176, 94, 18, 14], [194, 90, 14, 18], [208, 96, 20, 12],
    [228, 92, 16, 16], [244, 98, 14, 10],
  ];
  for (const [x, y, w, h] of roofs) {
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x + 2, y - 3, w - 4, 3); // ridge
  }

  // --- Palms (foreground silhouette, framing) ------------------------------
  drawPalm(ctx, 20, HORIZON + 4, 1);
  drawPalm(ctx, 300, HORIZON + 2, -1);

  // --- Ships on the strait --------------------------------------------------
  drawShip(ctx, 96, 126, 1);
  drawShip(ctx, 214, 138, -1);
}

function drawPalm(ctx, x, baseY, dir) {
  ctx.fillStyle = C.silhouette;
  const trunkH = 40;
  for (let i = 0; i < trunkH; i++) {
    ctx.fillRect(x + Math.round((i / trunkH) * 5) * dir, baseY - i, 3, 1);
  }
  const topX = x + 5 * dir;
  const topY = baseY - trunkH;

  // Fronds: each is a short drooping arc, 2px thick, hard-edged.
  const fronds = [
    [-16, -5], [-12, -9], [-6, -11], [6, -11], [12, -9], [16, -5], [-14, 2], [14, 2],
  ];
  for (const [dx, dy] of fronds) {
    const steps = 9;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      ctx.fillRect(
        topX + Math.round(dx * t),
        topY + Math.round(dy * t) + Math.round(t * t * 6),
        2,
        2
      );
    }
  }
  ctx.fillRect(topX - 3, topY - 3, 7, 6); // crown
}

function drawShip(ctx, x, y, dir) {
  ctx.fillStyle = C.silhouette;
  ctx.fillRect(x, y, 26, 3); // hull
  ctx.fillRect(x + 3, y - 2, 20, 2);
  ctx.fillRect(x + 8, y - 16, 1, 16); // main mast
  ctx.fillRect(x + 17, y - 11, 1, 11); // mizzen
  // lateen sails as stepped triangles
  for (let i = 0; i < 8; i++) ctx.fillRect(x + 9, y - 15 + i, Math.max(1, 7 - i), 1);
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 18, y - 10 + i, Math.max(1, 5 - i), 1);
  if (dir < 0) ctx.fillRect(x - 3, y, 3, 2);
  else ctx.fillRect(x + 26, y, 3, 2);
}

/** Flat banner plate behind the lettering so the title always reads. */
function drawBanner(ctx, y, h) {
  ctx.fillStyle = C.titleShadow;
  ctx.fillRect(0, y, NATIVE_W, h);
  ctx.fillStyle = C.titleGoldDim;
  ctx.fillRect(0, y, NATIVE_W, 1);
  ctx.fillRect(0, y + h - 1, NATIVE_W, 1);
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
function renderCard(kind) {
  const canvas = createCanvas(NATIVE_W, NATIVE_H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.antialias = 'none';

  drawSky(ctx);
  drawSkyline(ctx);
  drawSea(ctx);

  if (kind === 'opening') {
    drawBanner(ctx, 16, 46);
    drawCenteredText(ctx, 'A FAMOSA', 22, 3, C.titleGold, C.titleShadow, 1);
    drawCenteredText(ctx, 'STREETS OF GOLDEN MELAKA', 48, 1, C.subtitle, C.titleShadow, 1);
    drawCenteredText(ctx, 'MELAKA 1580', 164, 1, C.titleGoldDim, C.titleShadow, 1);
  } else {
    // Banner sits over the sea so the skyline stays readable behind it.
    drawBanner(ctx, 126, 24);
    drawCenteredText(ctx, 'LOADING...', 131, 2, C.titleGold, C.titleShadow, 1);
    drawCenteredText(ctx, 'A FAMOSA  STREETS OF GOLDEN MELAKA', 164, 1, C.subtitle, C.titleShadow, 1);
  }

  // Nearest-neighbour upscale to the shipping resolution.
  const out = createCanvas(NATIVE_W * SCALE, NATIVE_H * SCALE);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.antialias = 'none';
  octx.drawImage(canvas, 0, 0, NATIVE_W, NATIVE_H, 0, 0, out.width, out.height);
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  let outDir = path.join(__dirname, '..', 'assets', 'scenes');
  const flagIndex = argv.indexOf('--outdir');
  if (flagIndex !== -1 && argv[flagIndex + 1]) outDir = path.resolve(argv[flagIndex + 1]);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const targets = [
    { kind: 'opening', file: 'opening-screen.png' },
    { kind: 'loading', file: 'scene-loading-ribeira.png' },
  ];

  for (const t of targets) {
    const canvas = renderCard(t.kind);
    const outPath = path.join(outDir, t.file);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log(
      `[screens] ${t.file} — ${canvas.width}x${canvas.height} (native ${NATIVE_W}x${NATIVE_H}, ${SCALE}x)`
    );
  }
}

main();
