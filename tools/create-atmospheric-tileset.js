/**
 * Atmospheric Tileset Generator for A Famosa
 * Creates Portuguese colonial architecture, tropical vegetation, and environmental objects
 * Focused on creating that "Humid. Golden. Crowded. Exotic." atmosphere
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');

// Expanded Portuguese Melaka Color Palette (32 colors)
const PALETTE = {
  // Skin tones
  skin: '#D4A574',
  skinDark: '#B88A5C',
  skinLight: '#E8C9A0',

  // Portuguese Architecture
  whitewash: '#F5E6D3',      // Whitewashed walls
  whitewashDark: '#D4C5B3',
  terracotta: '#D4704A',      // Roof tiles
  terracottaDark: '#A84D2E',
  woodBrown: '#654321',        // Doors, beams
  woodDark: '#3D2814',

  // Fortress
  fortressStone: '#8B8680',   // Grey stone
  fortressDark: '#5A5550',
  fortressLight: '#A39E98',

  // Ground & Nature
  cobble: '#9B8B7E',          // Cobblestone
  cobbleDark: '#7A6B5E',
  dirt: '#8B7355',
  dirtDark: '#6B5845',
  sand: '#C2A87D',

  // Vegetation - Lush tropical
  palmGreen: '#4A7C3B',       // Palm leaves
  palmDark: '#2E4D24',
  grassBright: '#5A8F3A',
  grassDark: '#3D6028',
  leafLight: '#7CAA5F',
  trunk: '#6B4423',

  // Water & Sky
  waterBlue: '#4A7BA7',
  waterDark: '#2E5A7A',
  waterLight: '#6B9BC7',
  skyBlue: '#87CEEB',

  // Market & Accents
  awningRed: '#C1440E',       // Market stalls
  awningOrange: '#E87722',
  awningYellow: '#F4B41A',
  fabricBlue: '#4A6FA5',

  // Metallic & Details
  gold: '#D4AF37',
  goldDark: '#B8941D',
  iron: '#4A4A4A',

  // Misc
  white: '#FFFFFF',
  black: '#1A1A1A',
  shadow: '#00000040'
};

function createSprite(width, height, drawFunc, outputPath) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  drawFunc(ctx);

  const buffer = canvas.toBuffer('image/png');
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ ${path.basename(outputPath)}`);
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// ===== ARCHITECTURE TILES =====

// Whitewashed wall (Portuguese colonial)
function drawWhitewashWall(ctx) {
  const c = PALETTE;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      // Textured white with slight variation
      const isShade = (x + y) % 7 === 0;
      px(ctx, x, y, isShade ? c.whitewashDark : c.whitewash);
    }
  }
  // Mortar lines (subtle)
  for (let x = 0; x < 16; x++) {
    px(ctx, x, 0, c.whitewashDark);
  }
}

// Terracotta roof tile
function drawTerracottaRoof(ctx) {
  const c = PALETTE;
  // Curved tile pattern
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const curve = Math.sin(x * 0.8) * 2;
      const isDark = y < 8 + curve;
      px(ctx, x, y, isDark ? c.terracottaDark : c.terracotta);
    }
  }
  // Highlights
  px(ctx, 4, 2, c.terracotta);
  px(ctx, 11, 2, c.terracotta);
}

// Fortress stone (grey, weathered)
function drawFortressStone(ctx) {
  const c = PALETTE;
  // Large stone blocks
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      px(ctx, x, y, c.fortressStone);
    }
  }

  // Stone edges (darker mortar)
  for (let x = 0; x < 16; x++) {
    px(ctx, x, 0, c.fortressDark);
    px(ctx, x, 7, c.fortressDark);
    px(ctx, x, 8, c.fortressDark);
  }
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, c.fortressDark);
    px(ctx, 8, y, c.fortressDark);
  }

  // Weathering/texture
  px(ctx, 3, 3, c.fortressDark);
  px(ctx, 5, 11, c.fortressDark);
  px(ctx, 12, 5, c.fortressLight);
  px(ctx, 10, 13, c.fortressLight);
}

// Cobblestone street
function drawCobblestone(ctx) {
  const c = PALETTE;
  // Base
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      px(ctx, x, y, c.cobble);
    }
  }

  // Individual stones (smaller than before)
  const stones = [
    [2, 2, 5, 5], [9, 2, 12, 5],
    [2, 9, 5, 12], [9, 9, 12, 12]
  ];

  stones.forEach(([x1, y1, x2, y2]) => {
    for (let y = y1; y <= y2; y++) {
      px(ctx, x1, y, c.cobbleDark);
      px(ctx, x2, y, c.cobbleDark);
    }
    for (let x = x1; x <= x2; x++) {
      px(ctx, x, y1, c.cobbleDark);
      px(ctx, x, y2, c.cobbleDark);
    }
  });
}

// Wooden door
function drawWoodenDoor(ctx) {
  const c = PALETTE;
  // Door frame
  for (let y = 0; y < 16; y++) {
    for (let x = 4; x < 12; x++) {
      px(ctx, x, y, c.woodBrown);
    }
  }
  // Darker edges
  for (let y = 0; y < 16; y++) {
    px(ctx, 4, y, c.woodDark);
    px(ctx, 11, y, c.woodDark);
  }
  // Wood planks
  for (let x = 5; x < 11; x++) {
    px(ctx, x, 5, c.woodDark);
    px(ctx, x, 10, c.woodDark);
  }
  // Door handle
  px(ctx, 9, 8, c.iron);
}

// ===== VEGETATION =====

// Palm tree (16x32 tall sprite)
function drawPalmTree(ctx) {
  const c = PALETTE;

  // Trunk (centered, brown)
  for (let y = 8; y < 32; y++) {
    px(ctx, 7, y, c.trunk);
    px(ctx, 8, y, c.trunk);
    // Texture
    if (y % 4 === 0) {
      px(ctx, 6, y, c.woodDark);
      px(ctx, 9, y, c.woodDark);
    }
  }

  // Palm fronds (top, spreading outward)
  // Center frond (up)
  for (let y = 3; y < 9; y++) {
    px(ctx, 7, y, c.palmGreen);
    px(ctx, 8, y, c.palmGreen);
  }
  px(ctx, 7, 2, c.palmDark);
  px(ctx, 8, 2, c.palmDark);

  // Left frond
  for (let i = 0; i < 5; i++) {
    px(ctx, 4 - i, 6 + i, c.palmGreen);
    px(ctx, 3 - i, 6 + i, c.palmDark);
  }

  // Right frond
  for (let i = 0; i < 5; i++) {
    px(ctx, 11 + i, 6 + i, c.palmGreen);
    px(ctx, 12 + i, 6 + i, c.palmDark);
  }

  // Diagonal fronds
  for (let i = 0; i < 4; i++) {
    px(ctx, 5 - i, 7 + i, c.leafLight);
    px(ctx, 10 + i, 7 + i, c.leafLight);
  }
}

// Small bush/tropical plant (16x16)
function drawTropicalBush(ctx) {
  const c = PALETTE;
  // Bushy shape
  const bushPixels = [
    [7, 4], [8, 4],
    [6, 5], [7, 5], [8, 5], [9, 5],
    [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
    [6, 7], [7, 7], [8, 7], [9, 7],
    [7, 8], [8, 8], [9, 8],
    [7, 9], [8, 9]
  ];

  bushPixels.forEach(([x, y]) => {
    const isLight = (x + y) % 2 === 0;
    px(ctx, x, y, isLight ? c.leafLight : c.grassBright);
  });

  // Dark outline
  bushPixels.forEach(([x, y]) => {
    if (y === 4 || y === 9) px(ctx, x, y, c.palmDark);
  });

  // Base/soil
  px(ctx, 7, 10, c.dirt);
  px(ctx, 8, 10, c.dirt);
}

// Frangipani flowers (decorative, 16x16)
function drawFlowers(ctx) {
  const c = PALETTE;
  // Small flowering plant
  // Stems
  px(ctx, 5, 8, c.palmGreen);
  px(ctx, 5, 9, c.palmGreen);
  px(ctx, 10, 8, c.palmGreen);
  px(ctx, 10, 9, c.palmGreen);

  // Flowers (pink/white)
  const white = '#FFE4E1';
  const pink = '#FFB6C1';

  // Left flower
  px(ctx, 4, 6, pink);
  px(ctx, 5, 6, white);
  px(ctx, 6, 6, pink);
  px(ctx, 5, 5, white);
  px(ctx, 5, 7, pink);

  // Right flower
  px(ctx, 9, 6, pink);
  px(ctx, 10, 6, white);
  px(ctx, 11, 6, pink);
  px(ctx, 10, 5, white);
  px(ctx, 10, 7, pink);

  // Leaves
  px(ctx, 4, 9, c.leafLight);
  px(ctx, 6, 9, c.leafLight);
  px(ctx, 9, 9, c.leafLight);
  px(ctx, 11, 9, c.leafLight);
}

// ===== ENVIRONMENTAL OBJECTS =====

// Wooden barrel (16x16)
function drawBarrel(ctx) {
  const c = PALETTE;
  // Barrel shape
  for (let y = 4; y < 14; y++) {
    const bulge = y > 7 && y < 10 ? 1 : 0;
    for (let x = 5 - bulge; x < 11 + bulge; x++) {
      px(ctx, x, y, c.woodBrown);
    }
  }

  // Metal bands
  for (let x = 4; x < 12; x++) {
    px(ctx, x, 6, c.iron);
    px(ctx, x, 11, c.iron);
  }

  // Top (ellipse)
  px(ctx, 6, 3, c.woodDark);
  px(ctx, 7, 3, c.woodDark);
  px(ctx, 8, 3, c.woodDark);
  px(ctx, 9, 3, c.woodDark);
  px(ctx, 5, 4, c.woodDark);
  px(ctx, 10, 4, c.woodDark);

  // Shading
  for (let y = 5; y < 13; y++) {
    px(ctx, 5, y, c.woodDark);
  }
}

// Market stall awning (16x16 top piece)
function drawAwning(ctx) {
  const c = PALETTE;
  // Striped awning
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const stripe = Math.floor(x / 4) % 2 === 0;
      px(ctx, x, y, stripe ? c.awningRed : c.awningYellow);
    }
  }

  // Shadow underneath
  for (let x = 0; x < 16; x++) {
    px(ctx, x, 7, c.terracottaDark);
  }

  // Support poles suggestion (edges)
  for (let y = 8; y < 16; y++) {
    px(ctx, 2, y, c.woodBrown);
    px(ctx, 13, y, c.woodBrown);
  }
}

// Crate (16x16)
function drawCrate(ctx) {
  const c = PALETTE;
  // Box shape
  for (let y = 6; y < 14; y++) {
    for (let x = 4; x < 12; x++) {
      px(ctx, x, y, c.woodBrown);
    }
  }

  // Planks
  for (let x = 4; x < 12; x++) {
    px(ctx, x, 8, c.woodDark);
    px(ctx, x, 11, c.woodDark);
  }
  for (let y = 6; y < 14; y++) {
    px(ctx, 6, y, c.woodDark);
    px(ctx, 9, y, c.woodDark);
  }

  // Top (isometric view hint)
  for (let x = 4; x < 12; x++) {
    px(ctx, x, 5, c.woodDark);
  }
}

// Pottery/vase (16x16)
function drawPottery(ctx) {
  const c = PALETTE;
  const clay = '#B8704A';
  const clayDark = '#8B503A';

  // Vase shape
  // Top
  for (let x = 6; x < 10; x++) {
    px(ctx, x, 5, clayDark);
  }
  // Neck
  px(ctx, 7, 6, clay);
  px(ctx, 8, 6, clay);
  // Body
  for (let y = 7; y < 12; y++) {
    const width = 2 + Math.floor((y - 7) * 0.6);
    for (let x = 8 - width; x < 8 + width; x++) {
      px(ctx, x, y, clay);
    }
  }
  // Base
  for (let x = 5; x < 11; x++) {
    px(ctx, x, 12, clayDark);
  }

  // Shading
  for (let y = 7; y < 12; y++) {
    px(ctx, 5, y, clayDark);
  }
}

// ===== GENERATE ALL TILES =====

console.log('\n🎨 Generating Atmospheric Tileset for Portuguese Melaka...\n');

console.log('Architecture:');
createSprite(16, 16, drawWhitewashWall, path.join(OUTPUT_DIR, 'tiles', 'wall-white.png'));
createSprite(16, 16, drawTerracottaRoof, path.join(OUTPUT_DIR, 'tiles', 'roof-terracotta.png'));
createSprite(16, 16, drawFortressStone, path.join(OUTPUT_DIR, 'tiles', 'fortress-stone.png'));
createSprite(16, 16, drawCobblestone, path.join(OUTPUT_DIR, 'tiles', 'cobblestone.png'));
createSprite(16, 16, drawWoodenDoor, path.join(OUTPUT_DIR, 'tiles', 'door-wood.png'));

console.log('\nVegetation:');
createSprite(16, 32, drawPalmTree, path.join(OUTPUT_DIR, 'objects', 'palm-tree.png'));
createSprite(16, 16, drawTropicalBush, path.join(OUTPUT_DIR, 'objects', 'bush.png'));
createSprite(16, 16, drawFlowers, path.join(OUTPUT_DIR, 'objects', 'flowers.png'));

console.log('\nEnvironmental Objects:');
createSprite(16, 16, drawBarrel, path.join(OUTPUT_DIR, 'objects', 'barrel.png'));
createSprite(16, 16, drawAwning, path.join(OUTPUT_DIR, 'objects', 'awning.png'));
createSprite(16, 16, drawCrate, path.join(OUTPUT_DIR, 'objects', 'crate.png'));
createSprite(16, 16, drawPottery, path.join(OUTPUT_DIR, 'objects', 'pottery.png'));

console.log('\n✅ Atmospheric tileset complete!');
console.log('📦 Total: 12 new tiles/objects created');
console.log('🎨 Palette: Portuguese colonial + tropical atmosphere');
console.log('\nNext: Build the A Famosa fortress gate map in Tiled!');
