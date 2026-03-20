/**
 * Enhanced Sprite Generator with Shadows and Detail
 * Creates high-quality pixel art with proper shading, highlights, and depth
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');

// Enhanced color palette with more shading levels
const PALETTE = {
  // Skin (3 levels)
  skinLight: '#E8C9A0',
  skin: '#D4A574',
  skinDark: '#B88A5C',
  skinShadow: '#8B6844',

  // Portuguese clothing
  tunicRed: '#B8312F',
  tunicRedDark: '#8B1E1E',
  tunicRedLight: '#D4443F',
  pantsBlue: '#4A5A6A',
  pantsBlueDark: '#2E3A44',
  pantsBlueLight: '#5A6A7A',

  // Ground & environment
  ground: '#8B7355',
  groundDark: '#6B5845',
  groundLight: '#A18968',
  cobble: '#9B8B7E',
  cobbleDark: '#7A6B5E',
  cobbleLight: '#AFA199',

  // Vegetation
  palmGreen: '#4A7C3B',
  palmDark: '#2E4D24',
  palmLight: '#5A9C4B',
  grassBright: '#5A8F3A',
  grassDark: '#3D6028',
  grassLight: '#7CAA5F',
  trunk: '#6B4423',
  trunkDark: '#4A2E15',

  // Architecture
  whitewash: '#F5E6D3',
  whitewashDark: '#D4C5B3',
  whitewashLight: '#FFF8ED',
  terracotta: '#D4704A',
  terracottaDark: '#A84D2E',
  terracottaLight: '#E8906A',

  // Accents
  gold: '#D4AF37',
  goldDark: '#B8941D',
  goldLight: '#F4CF57',

  // Shadows and highlights
  shadow: 'rgba(26, 20, 16, 0.5)',
  highlight: 'rgba(255, 248, 237, 0.3)',
  black: '#1A1A1A',
  white: '#FFFFFF',

  // Wood
  woodBrown: '#654321',
  woodDark: '#3D2814',
  woodLight: '#8B5A2B'
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

// Enhanced player sprite with shadows and detail (16x32)
function drawEnhancedPlayer(ctx) {
  const c = PALETTE;

  // Shadow on ground
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 29, 6, 2);

  // Hair (dark brown with highlights)
  px(ctx, 6, 4, c.trunkDark);
  px(ctx, 7, 3, c.trunk);
  px(ctx, 7, 4, c.trunk);
  px(ctx, 8, 3, c.trunk);
  px(ctx, 8, 4, c.trunk);
  px(ctx, 9, 4, c.trunkDark);
  px(ctx, 7, 2, c.trunkDark);
  px(ctx, 8, 2, c.trunkDark);

  // Head with shading
  px(ctx, 7, 5, c.skinLight);
  px(ctx, 8, 5, c.skin);
  px(ctx, 7, 6, c.skin);
  px(ctx, 8, 6, c.skinDark);
  px(ctx, 6, 5, c.skinDark);
  px(ctx, 9, 5, c.skinDark);

  // Eyes
  px(ctx, 6, 5, c.black);
  px(ctx, 9, 5, c.black);

  // Tunic with detailed shading
  // Main body
  for (let y = 7; y <= 14; y++) {
    for (let x = 5; x <= 10; x++) {
      if (y === 7 || y === 14) {
        px(ctx, x, y, c.tunicRedDark);
      } else if (x === 5 || x === 10) {
        px(ctx, x, y, c.tunicRedDark);
      } else if (x === 6 || x === 7) {
        px(ctx, x, y, y < 10 ? c.tunicRedLight : c.tunicRed);
      } else {
        px(ctx, x, y, y < 10 ? c.tunicRed : c.tunicRedDark);
      }
    }
  }

  // Belt with detail
  for (let x = 5; x <= 10; x++) {
    px(ctx, x, 13, c.woodDark);
  }
  px(ctx, 8, 13, c.goldDark);

  // Arms with shading
  px(ctx, 4, 8, c.skinDark);
  px(ctx, 4, 9, c.skin);
  px(ctx, 4, 10, c.skinDark);
  px(ctx, 11, 8, c.skinDark);
  px(ctx, 11, 9, c.skin);
  px(ctx, 11, 10, c.skinDark);

  // Pants with shading
  for (let y = 15; y <= 23; y++) {
    px(ctx, 6, y, y < 19 ? c.pantsBlueLight : c.pantsBlueDark);
    px(ctx, 7, y, c.pantsBlue);
    px(ctx, 8, y, c.pantsBlueDark);
    px(ctx, 9, y, y < 19 ? c.pantsBlueDark : c.pantsBlue);
  }

  // Boots with highlights
  for (let y = 24; y <= 28; y++) {
    for (let x = 6; x <= 9; x++) {
      if (y === 24 || x === 6) {
        px(ctx, x, y, c.woodDark);
      } else {
        px(ctx, x, y, c.woodBrown);
      }
    }
  }
}

// Enhanced palm tree with more detail (16x32)
function drawEnhancedPalmTree(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(6, 30, 4, 2);

  // Trunk with bark texture
  for (let y = 10; y < 32; y++) {
    const barkPattern = (y + 1) % 3 === 0;
    px(ctx, 7, y, barkPattern ? c.trunkDark : c.trunk);
    px(ctx, 8, y, c.trunk);

    // Texture marks
    if (y % 4 === 0) {
      px(ctx, 6, y, c.trunkDark);
      px(ctx, 9, y, c.trunkDark);
    }
  }

  // Center frond (upward, with detail)
  for (let y = 3; y < 10; y++) {
    const shade = y < 6 ? c.palmLight : c.palmGreen;
    px(ctx, 7, y, shade);
    px(ctx, 8, y, y < 7 ? c.palmGreen : c.palmDark);
  }
  px(ctx, 7, 2, c.palmDark);
  px(ctx, 8, 2, c.palmDark);

  // Left fronds with shading
  for (let i = 0; i < 6; i++) {
    px(ctx, 3 - i, 6 + i, i < 3 ? c.palmLight : c.palmGreen);
    px(ctx, 4 - i, 6 + i, c.palmGreen);
    px(ctx, 2 - i, 6 + i, c.palmDark);
  }

  // Right fronds
  for (let i = 0; i < 6; i++) {
    px(ctx, 12 + i, 6 + i, i < 3 ? c.palmLight : c.palmGreen);
    px(ctx, 11 + i, 6 + i, c.palmGreen);
    px(ctx, 13 + i, 6 + i, c.palmDark);
  }

  // Diagonal fronds with highlights
  for (let i = 0; i < 5; i++) {
    px(ctx, 4 - i, 7 + i, c.palmLight);
    px(ctx, 5 - i, 7 + i, c.grassLight);
    px(ctx, 11 + i, 7 + i, c.palmLight);
    px(ctx, 10 + i, 7 + i, c.grassLight);
  }
}

// Enhanced cobblestone with depth (16x16)
function drawEnhancedCobblestone(ctx) {
  const c = PALETTE;

  // Base color with slight variation
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const noise = (x + y) % 3 === 0;
      px(ctx, x, y, noise ? c.cobbleLight : c.cobble);
    }
  }

  // Individual stones with shading (4 large stones)
  const stones = [
    [1, 1, 6, 6],
    [9, 1, 14, 6],
    [1, 9, 6, 14],
    [9, 9, 14, 14]
  ];

  stones.forEach(([x1, y1, x2, y2]) => {
    // Dark edges
    for (let y = y1; y <= y2; y++) {
      px(ctx, x1, y, c.cobbleDark);
      px(ctx, x2, y, c.cobbleDark);
    }
    for (let x = x1; x <= x2; x++) {
      px(ctx, x, y1, c.cobbleDark);
      px(ctx, x, y2, c.cobbleDark);
    }

    // Highlight top-left
    px(ctx, x1 + 1, y1 + 1, c.cobbleLight);
    px(ctx, x1 + 2, y1 + 1, c.cobbleLight);
    px(ctx, x1 + 1, y1 + 2, c.cobbleLight);
  });

  // Mortar between stones
  for (let x = 0; x < 16; x++) {
    px(ctx, x, 7, c.groundDark);
    px(ctx, x, 8, c.groundDark);
  }
  for (let y = 0; y < 16; y++) {
    px(ctx, 7, y, c.groundDark);
    px(ctx, 8, y, c.groundDark);
  }
}

// Enhanced grass with detail (16x16)
function drawEnhancedGrass(ctx) {
  const c = PALETTE;

  // Base with color variation
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const light = (x + y * 3) % 5 === 0;
      px(ctx, x, y, light ? c.grassLight : c.grassBright);
    }
  }

  // Grass blades with highlights
  const blades = [
    [3, 4], [3, 5], [3, 6],
    [7, 2], [7, 3], [7, 4],
    [11, 7], [11, 8], [11, 9],
    [5, 11], [5, 12], [5, 13],
    [13, 12], [13, 13], [13, 14]
  ];

  blades.forEach(([x, y]) => {
    px(ctx, x, y, c.grassDark);
    if (x > 0) px(ctx, x - 1, y, c.grassLight);
  });
}

console.log('\n✨ Generating Enhanced Sprites with Shadows and Detail...\n');

console.log('Characters:');
createSprite(16, 32, drawEnhancedPlayer, path.join(OUTPUT_DIR, 'characters', 'player.png'));

console.log('\nVegetation:');
createSprite(16, 32, drawEnhancedPalmTree, path.join(OUTPUT_DIR, 'objects', 'palm-tree.png'));

console.log('\nTiles:');
createSprite(16, 16, drawEnhancedCobblestone, path.join(OUTPUT_DIR, 'tiles', 'cobblestone.png'));
createSprite(16, 16, drawEnhancedGrass, path.join(OUTPUT_DIR, 'tiles', 'grass.png'));

console.log('\n✅ Enhanced sprites complete!');
console.log('🎨 Features: Shadows, highlights, shading, texture detail');
console.log('📐 Proper depth and dimension added');
