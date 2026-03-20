/**
 * Pixel Art Sprite Generator
 * Creates actual pixel art sprites with detail for A Famosa
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');

// Color palette inspired by Portuguese Melaka
const PALETTE = {
  // Skin tones
  skin: '#D4A574',
  skinDark: '#B88A5C',
  skinLight: '#E8C9A0',

  // Portuguese colonial colors
  tunicRed: '#B8312F',
  tunicDark: '#8B1E1E',
  pantsBlue: '#4A5A6A',
  pantsDark: '#2E3A44',

  // Environment
  ground: '#8B7355',
  groundDark: '#6B5845',
  grass: '#5A8F3A',
  grassDark: '#3D6028',
  water: '#4A7BA7',
  waterDark: '#2E5A7A',
  stone: '#808080',
  stoneDark: '#5A5A5A',
  sand: '#C2A87D',

  // Accents
  white: '#FFFFFF',
  black: '#1A1A1A',
  gold: '#D4AF37',
  brown: '#654321'
};

function createPixelArtSprite(width, height, drawFunc, outputPath) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Disable smoothing for pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;

  // Transparent background
  ctx.clearRect(0, 0, width, height);

  // Draw the sprite
  drawFunc(ctx);

  // Save
  const buffer = canvas.toBuffer('image/png');
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

// Helper to draw a pixel
function pixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// Player character sprite (16x32) - Portuguese colonist
function drawPlayer(ctx) {
  const c = PALETTE;

  // Head (top center)
  pixel(ctx, 7, 4, c.skinDark);
  pixel(ctx, 8, 4, c.skinDark);
  pixel(ctx, 7, 5, c.skin);
  pixel(ctx, 8, 5, c.skin);
  pixel(ctx, 7, 6, c.skin);
  pixel(ctx, 8, 6, c.skin);

  // Eyes
  pixel(ctx, 6, 5, c.black);
  pixel(ctx, 9, 5, c.black);

  // Hair (dark brown)
  pixel(ctx, 6, 4, c.brown);
  pixel(ctx, 7, 3, c.brown);
  pixel(ctx, 8, 3, c.brown);
  pixel(ctx, 9, 4, c.brown);

  // Tunic (red/burgundy - Portuguese style)
  for (let y = 7; y <= 14; y++) {
    for (let x = 5; x <= 10; x++) {
      if (y === 7 || y === 14 || x === 5 || x === 10) {
        pixel(ctx, x, y, c.tunicDark);
      } else {
        pixel(ctx, x, y, c.tunicRed);
      }
    }
  }

  // Belt
  pixel(ctx, 5, 13, c.brown);
  pixel(ctx, 6, 13, c.brown);
  pixel(ctx, 7, 13, c.brown);
  pixel(ctx, 8, 13, c.brown);
  pixel(ctx, 9, 13, c.brown);
  pixel(ctx, 10, 13, c.brown);

  // Arms
  pixel(ctx, 4, 8, c.skinDark);
  pixel(ctx, 4, 9, c.skin);
  pixel(ctx, 11, 8, c.skinDark);
  pixel(ctx, 11, 9, c.skin);

  // Pants (blue)
  for (let y = 15; y <= 23; y++) {
    pixel(ctx, 6, y, y === 15 || y === 23 ? c.pantsDark : c.pantsBlue);
    pixel(ctx, 7, y, c.pantsBlue);
    pixel(ctx, 8, y, c.pantsBlue);
    pixel(ctx, 9, y, y === 15 || y === 23 ? c.pantsDark : c.pantsBlue);
  }

  // Boots
  for (let y = 24; y <= 27; y++) {
    pixel(ctx, 6, y, c.brown);
    pixel(ctx, 7, y, c.brown);
    pixel(ctx, 8, y, c.brown);
    pixel(ctx, 9, y, c.brown);
  }
}

// NPC sprite - Malay local
function drawNPC(ctx) {
  const c = PALETTE;

  // Head
  pixel(ctx, 7, 4, c.skinDark);
  pixel(ctx, 8, 4, c.skinDark);
  pixel(ctx, 7, 5, c.skinLight);
  pixel(ctx, 8, 5, c.skinLight);
  pixel(ctx, 7, 6, c.skinLight);
  pixel(ctx, 8, 6, c.skinLight);

  // Eyes
  pixel(ctx, 6, 5, c.black);
  pixel(ctx, 9, 5, c.black);

  // Hair (black)
  pixel(ctx, 6, 3, c.black);
  pixel(ctx, 7, 3, c.black);
  pixel(ctx, 8, 3, c.black);
  pixel(ctx, 9, 3, c.black);
  pixel(ctx, 6, 4, c.black);
  pixel(ctx, 9, 4, c.black);

  // Tunic (brown/tan)
  for (let y = 7; y <= 14; y++) {
    for (let x = 5; x <= 10; x++) {
      pixel(ctx, x, y, y === 7 || y === 14 ? c.groundDark : c.ground);
    }
  }

  // Sarong (darker pattern)
  for (let y = 15; y <= 23; y++) {
    for (let x = 6; x <= 9; x++) {
      pixel(ctx, x, y, (y + x) % 2 === 0 ? c.pantsDark : c.pantsBlue);
    }
  }

  // Feet
  pixel(ctx, 6, 24, c.skinDark);
  pixel(ctx, 7, 24, c.skinDark);
  pixel(ctx, 8, 24, c.skinDark);
  pixel(ctx, 9, 24, c.skinDark);
}

// Enhanced ground tile
function drawGround(ctx) {
  const c = PALETTE;
  // Dirt/stone texture
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const noise = Math.sin(x * 0.5 + y * 0.3) > 0 ? 0 : 1;
      pixel(ctx, x, y, noise ? c.ground : c.groundDark);
    }
  }
}

// Enhanced grass tile
function drawGrass(ctx) {
  const c = PALETTE;
  // Base grass
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      pixel(ctx, x, y, c.grass);
    }
  }
  // Grass blades
  pixel(ctx, 3, 5, c.grassDark);
  pixel(ctx, 3, 6, c.grassDark);
  pixel(ctx, 8, 3, c.grassDark);
  pixel(ctx, 8, 4, c.grassDark);
  pixel(ctx, 12, 8, c.grassDark);
  pixel(ctx, 12, 9, c.grassDark);
  pixel(ctx, 5, 11, c.grassDark);
  pixel(ctx, 5, 12, c.grassDark);
  pixel(ctx, 14, 13, c.grassDark);
  pixel(ctx, 14, 14, c.grassDark);
}

// Enhanced water tile (animated-looking)
function drawWater(ctx) {
  const c = PALETTE;
  // Wavy pattern
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const wave = Math.sin(x * 0.5 + y * 0.5) > 0;
      pixel(ctx, x, y, wave ? c.water : c.waterDark);
    }
  }
  // Highlights
  pixel(ctx, 4, 4, c.white);
  pixel(ctx, 11, 9, c.white);
}

// Enhanced stone tile (cobblestone)
function drawStone(ctx) {
  const c = PALETTE;
  // Base
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      pixel(ctx, x, y, c.stone);
    }
  }

  // Stone pattern (4 cobbles)
  // Top-left stone
  for (let y = 1; y < 7; y++) {
    for (let x = 1; x < 7; x++) {
      if (x === 1 || x === 6 || y === 1 || y === 6) {
        pixel(ctx, x, y, c.stoneDark);
      }
    }
  }

  // Top-right stone
  for (let y = 1; y < 7; y++) {
    for (let x = 9; x < 15; x++) {
      if (x === 9 || x === 14 || y === 1 || y === 6) {
        pixel(ctx, x, y, c.stoneDark);
      }
    }
  }

  // Bottom-left stone
  for (let y = 9; y < 15; y++) {
    for (let x = 1; x < 7; x++) {
      if (x === 1 || x === 6 || y === 9 || y === 14) {
        pixel(ctx, x, y, c.stoneDark);
      }
    }
  }

  // Bottom-right stone
  for (let y = 9; y < 15; y++) {
    for (let x = 9; x < 15; x++) {
      if (x === 9 || x === 14 || y === 9 || y === 14) {
        pixel(ctx, x, y, c.stoneDark);
      }
    }
  }
}

// Generate all sprites
console.log('Generating pixel art sprites...\n');

createPixelArtSprite(16, 32, drawPlayer, path.join(OUTPUT_DIR, 'characters', 'player.png'));
createPixelArtSprite(16, 32, drawNPC, path.join(OUTPUT_DIR, 'characters', 'npc.png'));
createPixelArtSprite(16, 16, drawGround, path.join(OUTPUT_DIR, 'tiles', 'ground.png'));
createPixelArtSprite(16, 16, drawGrass, path.join(OUTPUT_DIR, 'tiles', 'grass.png'));
createPixelArtSprite(16, 16, drawWater, path.join(OUTPUT_DIR, 'tiles', 'water.png'));
createPixelArtSprite(16, 16, drawStone, path.join(OUTPUT_DIR, 'tiles', 'stone.png'));

console.log('\n✅ Pixel art sprites created!');
console.log('Refresh your browser to see the new graphics.');
