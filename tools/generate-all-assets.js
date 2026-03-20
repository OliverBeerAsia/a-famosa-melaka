/**
 * Complete Pixel Art Asset Generator for A Famosa: Streets of Golden Melaka
 *
 * Generates ALL game assets following the Art Bible specifications:
 * - Characters (16x32 with 4-direction walk cycles)
 * - Tiles (16x16)
 * - Objects (various sizes on 16px grid)
 * - UI Elements
 * - Particle Effects
 * - Crowd Silhouettes
 *
 * Uses the official 32-color palette from the Art Bible
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');

// =============================================================================
// OFFICIAL 32-COLOR PALETTE FROM ART BIBLE
// =============================================================================

const PALETTE = {
  // Architecture (8 colors)
  portugueseStone: '#8B7355',
  whitewash: '#F5F5DC',
  whitewashShadow: '#D4C4A8',
  terracotta: '#CD5C5C',
  terracottaDark: '#8B3A3A',
  darkWood: '#5D4037',
  warmWood: '#8B6914',
  ironMetal: '#4A4A4A',

  // Nature (8 colors)
  jungleDark: '#228B22',
  jungleMid: '#32CD32',
  jungleLight: '#90EE90',
  palmTrunk: '#8B7765',
  waterDeep: '#1E4D6B',
  waterMid: '#2E8B8B',
  waterLight: '#5DADE2',
  sand: '#F4D03F',

  // Golden Hour / Atmosphere (6 colors)
  goldenBright: '#FFD700',
  goldenMid: '#DAA520',
  goldenShadow: '#B8860B',
  sunsetOrange: '#FF8C00',
  duskPurple: '#9370DB',
  nightBlue: '#191970',

  // Skin Tones (5 colors)
  portugueseFair: '#FDBCB4',
  portugueseShadow: '#D4A59A',
  malayLocal: '#C68642',
  malayShadow: '#8B5A2B',
  chinese: '#FFE4C4',

  // UI and Accents (5 colors)
  parchment: '#F5DEB3',
  parchmentDark: '#DEB887',
  inkBlack: '#1C1C1C',
  portugueseRed: '#8B0000',
  spiceOrange: '#FF6347'
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function saveCanvas(canvas, outputPath) {
  const buffer = canvas.toBuffer('image/png');
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, buffer);
  console.log('  Created: ' + path.basename(outputPath));
}

function createCanvas2D(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  return { canvas, ctx };
}

function pixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

// =============================================================================
// CHARACTER SPRITE GENERATORS
// Each creates a 64x128 sprite sheet (4 columns x 4 rows = 16 frames)
// Columns: Down, Left, Right, Up
// Rows: 4 frames of walk animation
// =============================================================================

function createCharacterSpriteSheet(name, drawCharFunc) {
  // 64x128 sprite sheet: 4 directions x 4 frames
  const { canvas, ctx } = createCanvas2D(64, 128);

  const directions = ['down', 'left', 'right', 'up'];

  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      const x = dir * 16;
      const y = frame * 32;
      drawCharFunc(ctx, x, y, directions[dir], frame);
    }
  }

  saveCanvas(canvas, path.join(OUTPUT_DIR, 'characters', name + '-sheet.png'));
  return canvas;
}

// Player Character - Generic Portuguese colonist/traveler
function drawPlayer(ctx, x, y, direction, frame) {
  const P = PALETTE;
  const legOffset = [0, 1, 0, -1][frame]; // Walk animation

  // Hair (dark brown)
  rect(ctx, x + 6, y + 1, 4, 2, P.darkWood);

  // Head
  rect(ctx, x + 6, y + 2, 4, 4, P.portugueseFair);
  pixel(ctx, x + 6, y + 2, P.portugueseShadow);
  pixel(ctx, x + 9, y + 2, P.portugueseShadow);

  // Eyes (direction-dependent)
  if (direction === 'down') {
    pixel(ctx, x + 6, y + 4, P.inkBlack);
    pixel(ctx, x + 9, y + 4, P.inkBlack);
  } else if (direction === 'left') {
    pixel(ctx, x + 6, y + 4, P.inkBlack);
  } else if (direction === 'right') {
    pixel(ctx, x + 9, y + 4, P.inkBlack);
  }

  // Doublet (burgundy Portuguese style)
  rect(ctx, x + 5, y + 6, 6, 9, P.portugueseRed);
  rect(ctx, x + 5, y + 6, 1, 9, P.terracottaDark);
  rect(ctx, x + 10, y + 6, 1, 9, P.terracottaDark);

  // White collar detail
  rect(ctx, x + 6, y + 6, 4, 1, P.whitewash);

  // Belt
  rect(ctx, x + 5, y + 13, 6, 1, P.darkWood);
  pixel(ctx, x + 7, y + 13, P.goldenMid); // Belt buckle

  // Arms
  rect(ctx, x + 4, y + 7, 1, 4, P.portugueseRed);
  rect(ctx, x + 11, y + 7, 1, 4, P.portugueseRed);
  pixel(ctx, x + 4, y + 11, P.portugueseFair); // Hands
  pixel(ctx, x + 11, y + 11, P.portugueseFair);

  // Pants (dark blue)
  rect(ctx, x + 5, y + 15, 3, 9, P.waterDeep);
  rect(ctx, x + 8, y + 15, 3, 9, P.waterDeep);

  // Walk animation - leg movement
  if (frame === 1 || frame === 3) {
    rect(ctx, x + 5, y + 15 + legOffset, 3, 9, P.waterDeep);
    rect(ctx, x + 8, y + 15 - legOffset, 3, 9, P.waterDeep);
  }

  // Boots
  rect(ctx, x + 5, y + 24, 3, 4, P.darkWood);
  rect(ctx, x + 8, y + 24, 3, 4, P.darkWood);
}

// Fernao Gomes - Portuguese Merchant with ruff collar
function drawFernaoGomes(ctx, x, y, direction, frame) {
  const P = PALETTE;

  // Hair (receding, grey-brown)
  rect(ctx, x + 6, y + 1, 4, 2, P.palmTrunk);
  pixel(ctx, x + 6, y + 1, P.whitewashShadow); // Balding
  pixel(ctx, x + 9, y + 1, P.whitewashShadow);

  // Head
  rect(ctx, x + 6, y + 2, 4, 4, P.portugueseFair);
  pixel(ctx, x + 6, y + 2, P.portugueseShadow);
  pixel(ctx, x + 9, y + 2, P.portugueseShadow);

  // Beard (neat)
  rect(ctx, x + 6, y + 5, 4, 2, P.palmTrunk);

  // Eyes
  if (direction === 'down' || direction === 'left' || direction === 'right') {
    if (direction !== 'left') pixel(ctx, x + 9, y + 3, P.inkBlack);
    if (direction !== 'right') pixel(ctx, x + 6, y + 3, P.inkBlack);
  }

  // RUFF COLLAR (distinctive Portuguese 1580s)
  rect(ctx, x + 4, y + 6, 8, 2, P.whitewash);
  pixel(ctx, x + 4, y + 6, P.whitewashShadow);
  pixel(ctx, x + 11, y + 6, P.whitewashShadow);

  // Doublet (dark blue, wealthy)
  rect(ctx, x + 5, y + 8, 6, 7, P.waterDeep);
  rect(ctx, x + 5, y + 8, 1, 7, P.nightBlue);
  rect(ctx, x + 10, y + 8, 1, 7, P.nightBlue);

  // Gold trim
  pixel(ctx, x + 6, y + 8, P.goldenMid);
  pixel(ctx, x + 9, y + 8, P.goldenMid);

  // Merchant's cap
  rect(ctx, x + 5, y + 0, 6, 2, P.nightBlue);

  // Belt with coin purse
  rect(ctx, x + 5, y + 14, 6, 1, P.darkWood);
  rect(ctx, x + 9, y + 13, 2, 3, P.goldenShadow); // Coin purse

  // Arms
  rect(ctx, x + 4, y + 8, 1, 5, P.waterDeep);
  rect(ctx, x + 11, y + 8, 1, 5, P.waterDeep);
  pixel(ctx, x + 4, y + 13, P.portugueseFair);
  pixel(ctx, x + 11, y + 13, P.portugueseFair);

  // Pants
  rect(ctx, x + 5, y + 15, 3, 8, P.nightBlue);
  rect(ctx, x + 8, y + 15, 3, 8, P.nightBlue);

  // Boots
  rect(ctx, x + 5, y + 23, 3, 5, P.darkWood);
  rect(ctx, x + 8, y + 23, 3, 5, P.darkWood);
}

// Capitao Rodrigues - Guard Captain with morion helmet
function drawCapitaoRodrigues(ctx, x, y, direction, frame) {
  const P = PALETTE;

  // MORION HELMET (distinctive comb shape)
  rect(ctx, x + 5, y + 0, 6, 2, P.ironMetal);
  rect(ctx, x + 7, y + 0, 2, 1, P.ironMetal); // Comb
  rect(ctx, x + 4, y + 2, 8, 1, P.ironMetal); // Brim

  // Face visible under helmet
  rect(ctx, x + 6, y + 3, 4, 3, P.portugueseFair);

  // Mustache (military style)
  rect(ctx, x + 6, y + 5, 4, 1, P.darkWood);

  // Eyes
  if (direction === 'down') {
    pixel(ctx, x + 6, y + 4, P.inkBlack);
    pixel(ctx, x + 9, y + 4, P.inkBlack);
  }

  // BREASTPLATE
  rect(ctx, x + 5, y + 6, 6, 8, P.ironMetal);
  // Breastplate detail
  pixel(ctx, x + 7, y + 7, P.whitewashShadow);
  pixel(ctx, x + 8, y + 7, P.whitewashShadow);
  rect(ctx, x + 6, y + 9, 4, 1, P.whitewashShadow);

  // Portuguese military sash (red)
  rect(ctx, x + 4, y + 8, 1, 6, P.portugueseRed);
  rect(ctx, x + 11, y + 8, 1, 6, P.portugueseRed);

  // Belt
  rect(ctx, x + 5, y + 13, 6, 1, P.darkWood);

  // Sword at belt
  rect(ctx, x + 3, y + 11, 1, 8, P.ironMetal);
  pixel(ctx, x + 3, y + 11, P.goldenMid); // Hilt

  // Arms (armored)
  rect(ctx, x + 4, y + 6, 1, 5, P.ironMetal);
  rect(ctx, x + 11, y + 6, 1, 5, P.ironMetal);
  pixel(ctx, x + 4, y + 11, P.portugueseFair);
  pixel(ctx, x + 11, y + 11, P.portugueseFair);

  // Pants
  rect(ctx, x + 5, y + 14, 3, 9, P.waterDeep);
  rect(ctx, x + 8, y + 14, 3, 9, P.waterDeep);

  // Boots
  rect(ctx, x + 5, y + 23, 3, 5, P.darkWood);
  rect(ctx, x + 8, y + 23, 3, 5, P.darkWood);
}

// Padre Tomas - Jesuit Priest with black cassock
function drawPadreTomas(ctx, x, y, direction, frame) {
  const P = PALETTE;

  // Tonsured hair (period-accurate)
  rect(ctx, x + 6, y + 1, 4, 2, P.palmTrunk);
  rect(ctx, x + 7, y + 0, 2, 2, P.portugueseFair); // Bald top

  // Head
  rect(ctx, x + 6, y + 2, 4, 4, P.portugueseFair);
  pixel(ctx, x + 6, y + 2, P.portugueseShadow);
  pixel(ctx, x + 9, y + 2, P.portugueseShadow);

  // Eyes (kind, downcast)
  if (direction === 'down') {
    pixel(ctx, x + 6, y + 4, P.inkBlack);
    pixel(ctx, x + 9, y + 4, P.inkBlack);
  }

  // WHITE CLERICAL COLLAR
  rect(ctx, x + 6, y + 6, 4, 1, P.whitewash);

  // BLACK JESUIT CASSOCK (floor-length)
  rect(ctx, x + 5, y + 7, 6, 18, P.inkBlack);
  rect(ctx, x + 5, y + 7, 1, 18, P.ironMetal); // Highlight
  rect(ctx, x + 10, y + 7, 1, 18, P.ironMetal);

  // Wooden crucifix on cord
  pixel(ctx, x + 7, y + 9, P.warmWood);
  pixel(ctx, x + 8, y + 9, P.warmWood);
  pixel(ctx, x + 7, y + 10, P.warmWood);
  pixel(ctx, x + 7, y + 11, P.warmWood);
  pixel(ctx, x + 7, y + 12, P.warmWood);

  // Hands clasped (holding prayer book or rosary)
  rect(ctx, x + 6, y + 13, 4, 2, P.portugueseFair);
  rect(ctx, x + 6, y + 15, 4, 2, P.darkWood); // Prayer book

  // Feet (barely visible under cassock)
  pixel(ctx, x + 6, y + 25, P.darkWood);
  pixel(ctx, x + 9, y + 25, P.darkWood);
}

// Aminah - Malay Market Vendor with baju kurung and tudung
function drawAminah(ctx, x, y, direction, frame) {
  const P = PALETTE;

  // TUDUNG HEADSCARF (modest covering)
  rect(ctx, x + 5, y + 0, 6, 3, P.goldenMid);
  rect(ctx, x + 4, y + 2, 8, 3, P.goldenMid);
  pixel(ctx, x + 5, y + 0, P.goldenShadow);
  pixel(ctx, x + 10, y + 0, P.goldenShadow);

  // Face (visible)
  rect(ctx, x + 6, y + 2, 4, 4, P.malayLocal);
  pixel(ctx, x + 6, y + 2, P.malayShadow);
  pixel(ctx, x + 9, y + 2, P.malayShadow);

  // Eyes
  if (direction === 'down') {
    pixel(ctx, x + 6, y + 3, P.inkBlack);
    pixel(ctx, x + 9, y + 3, P.inkBlack);
  }

  // Smile
  pixel(ctx, x + 7, y + 5, P.malayShadow);
  pixel(ctx, x + 8, y + 5, P.malayShadow);

  // BAJU KURUNG (traditional Malay blouse)
  rect(ctx, x + 4, y + 6, 8, 10, P.spiceOrange); // Warm batik color
  rect(ctx, x + 4, y + 6, 1, 10, P.terracottaDark);
  rect(ctx, x + 11, y + 6, 1, 10, P.terracottaDark);

  // Batik pattern (simple geometric)
  pixel(ctx, x + 6, y + 8, P.goldenBright);
  pixel(ctx, x + 9, y + 8, P.goldenBright);
  pixel(ctx, x + 7, y + 10, P.goldenBright);
  pixel(ctx, x + 8, y + 10, P.goldenBright);
  pixel(ctx, x + 6, y + 12, P.goldenBright);
  pixel(ctx, x + 9, y + 12, P.goldenBright);

  // Arms
  rect(ctx, x + 3, y + 7, 1, 5, P.spiceOrange);
  rect(ctx, x + 12, y + 7, 1, 5, P.spiceOrange);
  pixel(ctx, x + 3, y + 12, P.malayLocal);
  pixel(ctx, x + 12, y + 12, P.malayLocal);

  // Simple gold earrings
  pixel(ctx, x + 5, y + 4, P.goldenBright);
  pixel(ctx, x + 10, y + 4, P.goldenBright);

  // SARONG/SKIRT
  rect(ctx, x + 5, y + 16, 6, 10, P.sunsetOrange);
  rect(ctx, x + 5, y + 16, 1, 10, P.terracottaDark);
  rect(ctx, x + 10, y + 16, 1, 10, P.terracottaDark);

  // Feet
  pixel(ctx, x + 6, y + 26, P.malayLocal);
  pixel(ctx, x + 9, y + 26, P.malayLocal);
}

// Chen Wei - Chinese Guild Representative with changshan robe
function drawChenWei(ctx, x, y, direction, frame) {
  const P = PALETTE;

  // MING-ERA TOPKNOT (not Qing queue)
  rect(ctx, x + 7, y + 0, 2, 2, P.inkBlack);

  // Hair
  rect(ctx, x + 6, y + 1, 4, 2, P.inkBlack);

  // Head
  rect(ctx, x + 6, y + 2, 4, 4, P.chinese);
  pixel(ctx, x + 6, y + 2, P.portugueseShadow);
  pixel(ctx, x + 9, y + 2, P.portugueseShadow);

  // Eyes
  if (direction === 'down') {
    pixel(ctx, x + 6, y + 3, P.inkBlack);
    pixel(ctx, x + 9, y + 3, P.inkBlack);
  }

  // Small beard (wispy)
  pixel(ctx, x + 7, y + 6, P.ironMetal);
  pixel(ctx, x + 8, y + 6, P.ironMetal);

  // CHANGSHAN ROBE (long traditional gown, dark blue silk)
  rect(ctx, x + 4, y + 6, 8, 18, P.waterDeep);
  rect(ctx, x + 4, y + 6, 1, 18, P.nightBlue);
  rect(ctx, x + 11, y + 6, 1, 18, P.nightBlue);

  // MANDARIN COLLAR
  rect(ctx, x + 6, y + 6, 4, 1, P.waterMid);
  pixel(ctx, x + 6, y + 6, P.nightBlue);
  pixel(ctx, x + 9, y + 6, P.nightBlue);

  // Robe front closure (frog buttons)
  pixel(ctx, x + 7, y + 8, P.goldenMid);
  pixel(ctx, x + 7, y + 10, P.goldenMid);
  pixel(ctx, x + 7, y + 12, P.goldenMid);

  // Wide sleeves
  rect(ctx, x + 3, y + 7, 2, 6, P.waterDeep);
  rect(ctx, x + 11, y + 7, 2, 6, P.waterDeep);

  // Hands (holding abacus or ledger)
  rect(ctx, x + 5, y + 13, 6, 2, P.chinese);
  rect(ctx, x + 5, y + 15, 6, 3, P.warmWood); // Ledger

  // Feet
  pixel(ctx, x + 6, y + 24, P.inkBlack);
  pixel(ctx, x + 9, y + 24, P.inkBlack);
}

// Rashid - Arab Sailor with thawb, keffiyeh, and jambiya
function drawRashid(ctx, x, y, direction, frame) {
  const P = PALETTE;

  // KEFFIYEH HEADSCARF
  rect(ctx, x + 5, y + 0, 6, 3, P.whitewash);
  rect(ctx, x + 4, y + 2, 2, 4, P.whitewash); // Side drape
  rect(ctx, x + 10, y + 2, 2, 4, P.whitewash);
  pixel(ctx, x + 5, y + 0, P.whitewashShadow);
  pixel(ctx, x + 10, y + 0, P.whitewashShadow);

  // Headband (agal)
  rect(ctx, x + 5, y + 2, 6, 1, P.inkBlack);

  // Face (weathered, sun-darkened)
  rect(ctx, x + 6, y + 3, 4, 3, P.malayLocal);
  pixel(ctx, x + 6, y + 3, P.malayShadow);
  pixel(ctx, x + 9, y + 3, P.malayShadow);

  // TRIMMED BEARD
  rect(ctx, x + 6, y + 5, 4, 2, P.darkWood);

  // Eyes
  if (direction === 'down') {
    pixel(ctx, x + 6, y + 4, P.inkBlack);
    pixel(ctx, x + 9, y + 4, P.inkBlack);
  }

  // THAWB ROBE (white, weathered and salt-stained)
  rect(ctx, x + 4, y + 7, 8, 16, P.whitewash);
  rect(ctx, x + 4, y + 7, 1, 16, P.whitewashShadow);
  rect(ctx, x + 11, y + 7, 1, 16, P.whitewashShadow);

  // Salt stains / weathering
  pixel(ctx, x + 6, y + 18, P.whitewashShadow);
  pixel(ctx, x + 8, y + 20, P.whitewashShadow);
  pixel(ctx, x + 9, y + 16, P.whitewashShadow);

  // Belt with JAMBIYA DAGGER
  rect(ctx, x + 5, y + 12, 6, 1, P.darkWood);
  rect(ctx, x + 3, y + 11, 2, 4, P.ironMetal); // Curved dagger
  pixel(ctx, x + 3, y + 11, P.goldenMid); // Decorative hilt

  // Arms (gesturing, animated)
  rect(ctx, x + 3, y + 8, 1, 4, P.whitewash);
  rect(ctx, x + 12, y + 8, 1, 4, P.whitewash);
  pixel(ctx, x + 3, y + 12, P.malayLocal);
  pixel(ctx, x + 12, y + 12, P.malayLocal);

  // Feet (sandals)
  pixel(ctx, x + 6, y + 23, P.darkWood);
  pixel(ctx, x + 9, y + 23, P.darkWood);
}

// =============================================================================
// OBJECT GENERATORS
// =============================================================================

function createObject(name, width, height, drawFunc) {
  const { canvas, ctx } = createCanvas2D(width, height);
  drawFunc(ctx);
  saveCanvas(canvas, path.join(OUTPUT_DIR, 'objects', name + '.png'));
}

function drawMarketStall(ctx) {
  const P = PALETTE;

  // Wooden frame
  rect(ctx, 4, 32, 40, 4, P.darkWood); // Base
  rect(ctx, 4, 16, 4, 20, P.warmWood); // Left post
  rect(ctx, 40, 16, 4, 20, P.warmWood); // Right post

  // Striped awning (terracotta and cream)
  for (let i = 0; i < 5; i++) {
    rect(ctx, 2 + i * 9, 8, 9, 10, i % 2 === 0 ? P.terracotta : P.whitewash);
  }
  rect(ctx, 2, 6, 44, 2, P.darkWood); // Awning frame

  // Counter
  rect(ctx, 6, 28, 36, 6, P.warmWood);
  rect(ctx, 6, 28, 36, 1, P.darkWood);

  // Goods on counter
  // Spice pile (orange)
  rect(ctx, 10, 24, 6, 4, P.spiceOrange);
  rect(ctx, 11, 23, 4, 1, P.sunsetOrange);

  // Pottery (terracotta)
  rect(ctx, 20, 22, 4, 6, P.terracotta);
  rect(ctx, 21, 21, 2, 1, P.terracottaDark);

  // Fruit (green)
  rect(ctx, 30, 24, 5, 4, P.jungleMid);
  pixel(ctx, 32, 23, P.jungleDark);

  // Sacks below
  rect(ctx, 8, 36, 8, 6, P.parchment);
  rect(ctx, 32, 36, 8, 6, P.parchmentDark);
}

function drawCannon(ctx) {
  const P = PALETTE;

  // Wooden carriage
  rect(ctx, 4, 20, 24, 8, P.warmWood);
  rect(ctx, 4, 20, 24, 2, P.darkWood);

  // Wheels
  rect(ctx, 2, 24, 8, 8, P.darkWood);
  rect(ctx, 4, 26, 4, 4, P.warmWood);
  rect(ctx, 22, 24, 8, 8, P.darkWood);
  rect(ctx, 24, 26, 4, 4, P.warmWood);

  // Bronze barrel
  rect(ctx, 6, 12, 20, 8, P.goldenShadow);
  rect(ctx, 6, 12, 20, 2, P.goldenMid);
  rect(ctx, 4, 14, 4, 4, P.goldenMid); // Muzzle

  // Barrel rings
  rect(ctx, 10, 12, 2, 8, P.goldenMid);
  rect(ctx, 18, 12, 2, 8, P.goldenMid);
}

function drawBarrel(ctx) {
  const P = PALETTE;

  // Barrel body
  rect(ctx, 2, 2, 12, 14, P.warmWood);
  rect(ctx, 2, 2, 1, 14, P.darkWood);
  rect(ctx, 13, 2, 1, 14, P.darkWood);

  // Metal bands
  rect(ctx, 1, 4, 14, 2, P.ironMetal);
  rect(ctx, 1, 10, 14, 2, P.ironMetal);

  // Top
  rect(ctx, 3, 0, 10, 2, P.darkWood);
}

function drawLantern(ctx) {
  const P = PALETTE;

  // Frame
  rect(ctx, 4, 0, 8, 2, P.ironMetal);
  rect(ctx, 4, 14, 8, 2, P.ironMetal);
  rect(ctx, 4, 2, 2, 12, P.ironMetal);
  rect(ctx, 10, 2, 2, 12, P.ironMetal);

  // Glass/light
  rect(ctx, 6, 2, 4, 12, P.goldenBright);
  rect(ctx, 6, 4, 4, 8, P.sunsetOrange);
}

function drawPalmTree(ctx) {
  const P = PALETTE;

  // Trunk
  rect(ctx, 6, 16, 4, 32, P.palmTrunk);
  rect(ctx, 6, 16, 1, 32, P.darkWood);

  // Trunk texture
  for (let y = 18; y < 46; y += 4) {
    rect(ctx, 6, y, 4, 1, P.darkWood);
  }

  // Fronds (radiating out)
  // Center
  rect(ctx, 5, 4, 6, 14, P.jungleMid);
  rect(ctx, 6, 2, 4, 2, P.jungleMid);

  // Left frond
  rect(ctx, 0, 6, 6, 3, P.jungleMid);
  rect(ctx, 0, 6, 2, 3, P.jungleDark);

  // Right frond
  rect(ctx, 10, 6, 6, 3, P.jungleMid);
  rect(ctx, 14, 6, 2, 3, P.jungleDark);

  // Highlights
  pixel(ctx, 7, 4, P.jungleLight);
  pixel(ctx, 8, 4, P.jungleLight);
}

function drawWaterWell(ctx) {
  const P = PALETTE;

  // Stone base (circular)
  rect(ctx, 2, 20, 28, 12, P.portugueseStone);
  rect(ctx, 4, 18, 24, 2, P.portugueseStone);
  rect(ctx, 2, 20, 28, 2, P.whitewashShadow);

  // Inner dark (water)
  rect(ctx, 6, 20, 20, 8, P.waterDeep);

  // Wooden frame
  rect(ctx, 0, 4, 4, 20, P.warmWood);
  rect(ctx, 28, 4, 4, 20, P.warmWood);
  rect(ctx, 0, 2, 32, 4, P.darkWood);

  // Rope and bucket
  rect(ctx, 15, 6, 2, 10, P.parchmentDark);
  rect(ctx, 12, 14, 8, 6, P.warmWood);
}

// =============================================================================
// UI ELEMENT GENERATORS
// =============================================================================

function createUIElements() {
  console.log('\nCreating UI elements...');
  const uiDir = path.join(OUTPUT_DIR, 'ui');
  ensureDir(uiDir);

  const P = PALETTE;

  // Dialogue box background (256x64)
  {
    const { canvas, ctx } = createCanvas2D(256, 64);

    // Parchment background
    rect(ctx, 0, 0, 256, 64, P.parchment);

    // Dark wood frame
    rect(ctx, 0, 0, 256, 4, P.darkWood);
    rect(ctx, 0, 60, 256, 4, P.darkWood);
    rect(ctx, 0, 0, 4, 64, P.darkWood);
    rect(ctx, 252, 0, 4, 64, P.darkWood);

    // Inner border
    rect(ctx, 4, 4, 248, 2, P.warmWood);
    rect(ctx, 4, 58, 248, 2, P.warmWood);
    rect(ctx, 4, 4, 2, 56, P.warmWood);
    rect(ctx, 250, 4, 2, 56, P.warmWood);

    // Corner decorations (Portuguese scroll motif)
    rect(ctx, 4, 4, 8, 8, P.goldenMid);
    rect(ctx, 244, 4, 8, 8, P.goldenMid);
    rect(ctx, 4, 52, 8, 8, P.goldenMid);
    rect(ctx, 244, 52, 8, 8, P.goldenMid);

    saveCanvas(canvas, path.join(uiDir, 'dialogue-box.png'));
  }

  // Portrait frame (52x52)
  {
    const { canvas, ctx } = createCanvas2D(52, 52);

    // Frame
    rect(ctx, 0, 0, 52, 52, P.darkWood);
    rect(ctx, 2, 2, 48, 48, P.warmWood);
    rect(ctx, 4, 4, 44, 44, P.parchment);

    // Gold corners
    rect(ctx, 0, 0, 6, 6, P.goldenMid);
    rect(ctx, 46, 0, 6, 6, P.goldenMid);
    rect(ctx, 0, 46, 6, 6, P.goldenMid);
    rect(ctx, 46, 46, 6, 6, P.goldenMid);

    saveCanvas(canvas, path.join(uiDir, 'portrait-frame.png'));
  }

  // Inventory slot (20x20)
  {
    const { canvas, ctx } = createCanvas2D(20, 20);

    rect(ctx, 0, 0, 20, 20, P.darkWood);
    rect(ctx, 1, 1, 18, 18, P.parchment);
    rect(ctx, 2, 2, 16, 16, P.parchmentDark);

    saveCanvas(canvas, path.join(uiDir, 'inventory-slot.png'));
  }

  // Button (48x16)
  {
    const { canvas, ctx } = createCanvas2D(48, 16);

    rect(ctx, 0, 0, 48, 16, P.darkWood);
    rect(ctx, 1, 1, 46, 14, P.warmWood);
    rect(ctx, 2, 2, 44, 12, P.parchment);
    rect(ctx, 2, 2, 44, 2, P.whitewash); // Highlight

    saveCanvas(canvas, path.join(uiDir, 'button.png'));
  }

  // Journal page (128x160)
  {
    const { canvas, ctx } = createCanvas2D(128, 160);

    // Parchment
    rect(ctx, 0, 0, 128, 160, P.parchment);

    // Aged edges
    rect(ctx, 0, 0, 128, 2, P.parchmentDark);
    rect(ctx, 0, 158, 128, 2, P.parchmentDark);
    rect(ctx, 0, 0, 2, 160, P.parchmentDark);
    rect(ctx, 126, 0, 2, 160, P.parchmentDark);

    // Lines for text
    for (let y = 20; y < 150; y += 12) {
      rect(ctx, 10, y, 108, 1, P.whitewashShadow);
    }

    // Red margin line
    rect(ctx, 16, 8, 1, 144, P.portugueseRed);

    saveCanvas(canvas, path.join(uiDir, 'journal-page.png'));
  }

  // Coin icon (16x16)
  {
    const { canvas, ctx } = createCanvas2D(16, 16);

    // Gold coin
    rect(ctx, 4, 2, 8, 12, P.goldenMid);
    rect(ctx, 2, 4, 12, 8, P.goldenMid);
    rect(ctx, 6, 4, 4, 8, P.goldenBright);
    rect(ctx, 4, 6, 8, 4, P.goldenBright);

    // Cross design (Portuguese cruzado)
    rect(ctx, 7, 4, 2, 8, P.goldenShadow);
    rect(ctx, 4, 7, 8, 2, P.goldenShadow);

    saveCanvas(canvas, path.join(uiDir, 'coin.png'));
  }
}

// =============================================================================
// PARTICLE/EFFECT GENERATORS
// =============================================================================

function createParticles() {
  console.log('\nCreating particle effects...');
  const particleDir = path.join(OUTPUT_DIR, 'particles');
  ensureDir(particleDir);

  const P = PALETTE;

  // Fire particle sheet (4 frames, 8x8 each = 32x8)
  {
    const { canvas, ctx } = createCanvas2D(32, 8);

    for (let frame = 0; frame < 4; frame++) {
      const x = frame * 8;
      const flicker = frame % 2;

      // Fire core
      rect(ctx, x + 3, 4 - flicker, 2, 4 + flicker, P.goldenBright);
      rect(ctx, x + 2, 5, 4, 3, P.sunsetOrange);
      rect(ctx, x + 1, 6, 6, 2, P.spiceOrange);

      // Sparks
      if (frame === 1) pixel(ctx, x + 1, 2, P.goldenBright);
      if (frame === 3) pixel(ctx, x + 5, 1, P.goldenBright);
    }

    saveCanvas(canvas, path.join(particleDir, 'fire.png'));
  }

  // Smoke particle sheet (4 frames, 8x8 each)
  {
    const { canvas, ctx } = createCanvas2D(32, 8);

    for (let frame = 0; frame < 4; frame++) {
      const x = frame * 8;
      const rise = frame;

      rect(ctx, x + 2, 6 - rise, 4, 3, P.whitewashShadow);
      rect(ctx, x + 3, 5 - rise, 2, 2, P.whitewash);
    }

    saveCanvas(canvas, path.join(particleDir, 'smoke.png'));
  }

  // Dust mote (single 4x4)
  {
    const { canvas, ctx } = createCanvas2D(4, 4);
    pixel(ctx, 1, 1, P.goldenBright);
    pixel(ctx, 2, 1, P.goldenMid);
    pixel(ctx, 1, 2, P.goldenMid);
    pixel(ctx, 2, 2, P.goldenBright);
    saveCanvas(canvas, path.join(particleDir, 'dust.png'));
  }

  // Rain drop (4x8)
  {
    const { canvas, ctx } = createCanvas2D(4, 8);
    rect(ctx, 1, 0, 2, 8, P.waterLight);
    pixel(ctx, 1, 0, P.waterMid);
    pixel(ctx, 2, 0, P.waterMid);
    saveCanvas(canvas, path.join(particleDir, 'rain.png'));
  }

  // Water splash (8x8)
  {
    const { canvas, ctx } = createCanvas2D(8, 8);
    pixel(ctx, 3, 2, P.waterLight);
    pixel(ctx, 4, 2, P.waterLight);
    pixel(ctx, 2, 3, P.waterLight);
    pixel(ctx, 5, 3, P.waterLight);
    pixel(ctx, 1, 4, P.waterMid);
    pixel(ctx, 6, 4, P.waterMid);
    pixel(ctx, 2, 5, P.waterMid);
    pixel(ctx, 5, 5, P.waterMid);
    saveCanvas(canvas, path.join(particleDir, 'splash.png'));
  }
}

// =============================================================================
// CROWD SILHOUETTE GENERATORS
// =============================================================================

function createCrowdSilhouettes() {
  console.log('\nCreating crowd silhouettes...');
  const crowdDir = path.join(OUTPUT_DIR, 'crowd');
  ensureDir(crowdDir);

  const P = PALETTE;

  // Portuguese silhouette (8x16)
  {
    const { canvas, ctx } = createCanvas2D(8, 16);
    // Hat
    rect(ctx, 2, 0, 4, 2, P.ironMetal);
    // Head
    rect(ctx, 2, 2, 4, 3, P.portugueseShadow);
    // Body
    rect(ctx, 1, 5, 6, 7, P.portugueseRed);
    // Legs
    rect(ctx, 2, 12, 2, 4, P.waterDeep);
    rect(ctx, 4, 12, 2, 4, P.waterDeep);
    saveCanvas(canvas, path.join(crowdDir, 'portuguese.png'));
  }

  // Malay silhouette (8x16)
  {
    const { canvas, ctx } = createCanvas2D(8, 16);
    // Head with headscarf
    rect(ctx, 2, 0, 4, 4, P.goldenShadow);
    rect(ctx, 2, 4, 4, 2, P.malayShadow);
    // Body
    rect(ctx, 1, 6, 6, 6, P.spiceOrange);
    // Sarong
    rect(ctx, 1, 12, 6, 4, P.sunsetOrange);
    saveCanvas(canvas, path.join(crowdDir, 'malay.png'));
  }

  // Chinese silhouette (8x16)
  {
    const { canvas, ctx } = createCanvas2D(8, 16);
    // Topknot
    rect(ctx, 3, 0, 2, 2, P.inkBlack);
    // Head
    rect(ctx, 2, 2, 4, 3, P.chinese);
    // Robe
    rect(ctx, 1, 5, 6, 11, P.waterDeep);
    saveCanvas(canvas, path.join(crowdDir, 'chinese.png'));
  }

  // Arab silhouette (8x16)
  {
    const { canvas, ctx } = createCanvas2D(8, 16);
    // Keffiyeh
    rect(ctx, 1, 0, 6, 3, P.whitewashShadow);
    // Face
    rect(ctx, 2, 3, 4, 2, P.malayShadow);
    // Thawb
    rect(ctx, 1, 5, 6, 11, P.whitewash);
    saveCanvas(canvas, path.join(crowdDir, 'arab.png'));
  }
}

// =============================================================================
// ANIMATED TILE GENERATORS
// =============================================================================

function createAnimatedTiles() {
  console.log('\nCreating animated tiles...');
  const P = PALETTE;

  // Water animation (4 frames, 16x16 each = 64x16)
  {
    const { canvas, ctx } = createCanvas2D(64, 16);

    for (let frame = 0; frame < 4; frame++) {
      const xOff = frame * 16;
      const offset = frame * 2;

      // Base water
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          const wave = Math.sin((px + offset) * 0.5 + py * 0.3) > 0;
          pixel(ctx, xOff + px, py, wave ? P.waterMid : P.waterDeep);
        }
      }

      // Highlights
      pixel(ctx, xOff + (4 + offset) % 16, 4, P.waterLight);
      pixel(ctx, xOff + (11 + offset) % 16, 9, P.waterLight);
      pixel(ctx, xOff + (7 + offset) % 16, 13, P.waterLight);
    }

    saveCanvas(canvas, path.join(OUTPUT_DIR, 'tiles', 'water-animated.png'));
  }

  // Torch animation (4 frames, 16x32 each = 64x32)
  {
    const { canvas, ctx } = createCanvas2D(64, 32);

    for (let frame = 0; frame < 4; frame++) {
      const xOff = frame * 16;
      const flicker = [0, 1, 0, -1][frame];

      // Torch handle
      rect(ctx, xOff + 6, 16, 4, 14, P.darkWood);
      rect(ctx, xOff + 5, 14, 6, 3, P.ironMetal);

      // Flame
      rect(ctx, xOff + 5, 6 + flicker, 6, 10 - flicker, P.sunsetOrange);
      rect(ctx, xOff + 6, 4 + flicker, 4, 8 - flicker, P.goldenBright);
      rect(ctx, xOff + 7, 2 + flicker, 2, 6 - flicker, P.goldenBright);

      // Glow effect pixels
      pixel(ctx, xOff + 4, 8, P.spiceOrange);
      pixel(ctx, xOff + 11, 8, P.spiceOrange);

      if (frame === 1 || frame === 3) {
        pixel(ctx, xOff + 5, 3, P.goldenBright);
        pixel(ctx, xOff + 10, 5, P.goldenBright);
      }
    }

    saveCanvas(canvas, path.join(OUTPUT_DIR, 'tiles', 'torch-animated.png'));
  }

  // Flag animation (3 frames, 16x24 each = 48x24)
  {
    const { canvas, ctx } = createCanvas2D(48, 24);

    for (let frame = 0; frame < 3; frame++) {
      const xOff = frame * 16;
      const wave = frame;

      // Pole
      rect(ctx, xOff + 1, 0, 2, 24, P.darkWood);

      // Portuguese flag (simplified)
      rect(ctx, xOff + 3, 2 + wave, 12, 10 - wave, P.portugueseRed);
      rect(ctx, xOff + 3, 2 + wave, 4, 10 - wave, P.jungleMid);

      // Wave effect
      if (frame === 1) {
        pixel(ctx, xOff + 14, 4, P.portugueseRed);
        pixel(ctx, xOff + 14, 8, P.portugueseRed);
      }
      if (frame === 2) {
        rect(ctx, xOff + 14, 3, 1, 3, P.portugueseRed);
        rect(ctx, xOff + 14, 8, 1, 2, P.portugueseRed);
      }
    }

    saveCanvas(canvas, path.join(OUTPUT_DIR, 'tiles', 'flag-animated.png'));
  }
}

// =============================================================================
// MAIN
// =============================================================================

console.log('============================================================');
console.log('A Famosa: Streets of Golden Melaka - Asset Generator');
console.log('Following Art Bible 32-color palette specifications');
console.log('============================================================');

console.log('\n--- Creating Character Sprite Sheets ---');
createCharacterSpriteSheet('player', drawPlayer);
createCharacterSpriteSheet('fernao-gomes', drawFernaoGomes);
createCharacterSpriteSheet('capitao-rodrigues', drawCapitaoRodrigues);
createCharacterSpriteSheet('padre-tomas', drawPadreTomas);
createCharacterSpriteSheet('aminah', drawAminah);
createCharacterSpriteSheet('chen-wei', drawChenWei);
createCharacterSpriteSheet('rashid', drawRashid);

console.log('\n--- Creating Objects ---');
createObject('market-stall', 48, 48, drawMarketStall);
createObject('cannon', 32, 32, drawCannon);
createObject('barrel', 16, 16, drawBarrel);
createObject('lantern', 16, 16, drawLantern);
createObject('palm-tree', 16, 48, drawPalmTree);
createObject('water-well', 32, 32, drawWaterWell);

createUIElements();
createParticles();
createCrowdSilhouettes();
createAnimatedTiles();

console.log('\n============================================================');
console.log('Asset generation complete!');
console.log('============================================================');
console.log('\nGenerated:');
console.log('  - 7 character sprite sheets (64x128 each, 16 frames)');
console.log('  - 6 object sprites (various sizes)');
console.log('  - 6 UI elements');
console.log('  - 5 particle effects');
console.log('  - 4 crowd silhouettes');
console.log('  - 3 animated tile sets');
console.log('\nAll assets use the official 32-color Art Bible palette.');
