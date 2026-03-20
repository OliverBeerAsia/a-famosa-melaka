/**
 * Church Tileset Generator for St. Paul's
 *
 * Creates sacred/ecclesiastical tiles:
 * - Church stone (darker, weathered)
 * - Stone cross
 * - Arched window
 * - Gravestone
 * - Church floor tiles
 * - Altar stone
 * - Bell
 * - Wooden pews
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'tiles');
const OBJECTS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'objects');

const PALETTE = {
  // Church stone (weathered, darker)
  churchStone: '#6A5A4A',
  churchStoneDark: '#4A3A2A',
  churchStoneLight: '#8A7A6A',

  // Sacred elements
  cross: '#8B7355',
  crossDark: '#6B5845',
  gold: '#D4AF37',
  goldDark: '#B8941D',

  // Stone/masonry
  stone: '#7A6A5A',
  stoneDark: '#5A4A3A',
  stoneLight: '#9A8A7A',

  // Wood (pews, doors)
  woodBrown: '#654321',
  woodDark: '#3D2814',
  woodLight: '#8B5A2B',

  // Glass (windows)
  glassBlue: '#4A6A8A',
  glassBlueDark: '#2A4A6A',

  // Ground/floor
  floorStone: '#8A7A6A',
  floorStoneDark: '#6A5A4A',

  // Vegetation (overgrown)
  mossGreen: '#4A6A3A',
  mossGreenDark: '#2A4A1A',

  shadow: 'rgba(26, 20, 16, 0.5)',
  black: '#1A1A1A',
  white: '#FFFFFF'
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

// Church stone tile (16x16) - weathered, darker than fortress stone
function drawChurchStone(ctx) {
  const c = PALETTE;

  // Base with weathering pattern
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const weathering = (x * 3 + y * 2) % 5;
      if (weathering === 0) {
        px(ctx, x, y, c.churchStoneDark);
      } else if (weathering === 1) {
        px(ctx, x, y, c.churchStoneLight);
      } else {
        px(ctx, x, y, c.churchStone);
      }
    }
  }

  // Moss/age marks
  px(ctx, 3, 2, c.mossGreenDark);
  px(ctx, 4, 2, c.mossGreen);
  px(ctx, 11, 8, c.mossGreenDark);
  px(ctx, 12, 8, c.mossGreen);
  px(ctx, 7, 13, c.mossGreenDark);
}

// Church floor tile (16x16) - polished stone
function drawChurchFloor(ctx) {
  const c = PALETTE;

  // Alternating pattern for classic church floor
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const checker = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2);
      if (checker === 0) {
        px(ctx, x, y, c.floorStone);
      } else {
        px(ctx, x, y, c.floorStoneDark);
      }
    }
  }

  // Grout lines
  for (let i = 0; i < 16; i += 4) {
    for (let j = 0; j < 16; j++) {
      px(ctx, i, j, c.stoneDark);
      px(ctx, j, i, c.stoneDark);
    }
  }
}

// Stone cross (object, 16x32)
function drawStoneCross(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 30, 6, 2);

  // Vertical beam
  for (let y = 4; y < 28; y++) {
    px(ctx, 7, y, y < 16 ? c.stoneLight : c.stone);
    px(ctx, 8, y, y < 16 ? c.stone : c.stoneDark);
  }

  // Horizontal beam
  for (let x = 4; x < 12; x++) {
    px(ctx, x, 10, x < 8 ? c.stoneLight : c.stone);
    px(ctx, x, 11, x < 8 ? c.stone : c.stoneDark);
  }

  // Base pedestal
  for (let y = 28; y < 30; y++) {
    for (let x = 6; x < 10; x++) {
      px(ctx, x, y, c.stoneDark);
    }
  }

  // Gold inlay at center
  px(ctx, 7, 10, c.gold);
  px(ctx, 8, 10, c.goldDark);
}

// Gravestone (object, 16x24)
function drawGravestone(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 22, 6, 2);

  // Stone slab (rounded top)
  for (let y = 8; y < 20; y++) {
    for (let x = 5; x < 11; x++) {
      if (y === 8 && (x === 5 || x === 10)) continue; // Rounded corners

      if (x === 5 || x === 10) {
        px(ctx, x, y, c.stoneDark);
      } else if (x === 6 || x === 7) {
        px(ctx, x, y, y < 14 ? c.stoneLight : c.stone);
      } else {
        px(ctx, x, y, y < 14 ? c.stone : c.stoneDark);
      }
    }
  }

  // Cross engraving
  px(ctx, 7, 11, c.crossDark);
  px(ctx, 8, 11, c.crossDark);
  px(ctx, 8, 12, c.crossDark);
  px(ctx, 8, 13, c.crossDark);

  // Moss at base
  px(ctx, 6, 18, c.mossGreen);
  px(ctx, 7, 19, c.mossGreenDark);
  px(ctx, 9, 18, c.mossGreen);
}

// Arched window (object, 16x32)
function drawArchedWindow(ctx) {
  const c = PALETTE;

  // Stone frame
  for (let y = 6; y < 28; y++) {
    px(ctx, 4, y, c.churchStoneDark);
    px(ctx, 11, y, c.churchStoneDark);
  }

  // Arch top
  px(ctx, 5, 6, c.churchStoneDark);
  px(ctx, 6, 5, c.churchStoneDark);
  px(ctx, 7, 4, c.churchStoneDark);
  px(ctx, 8, 4, c.churchStoneDark);
  px(ctx, 9, 5, c.churchStoneDark);
  px(ctx, 10, 6, c.churchStoneDark);

  // Glass (stained blue)
  for (let y = 8; y < 26; y++) {
    for (let x = 5; x < 11; x++) {
      if (y < 7 && (x < 6 || x > 9)) continue;
      const shimmer = (x + y) % 3 === 0;
      px(ctx, x, y, shimmer ? c.glassBlue : c.glassBlueDark);
    }
  }

  // Window cross divider
  for (let y = 8; y < 26; y++) {
    px(ctx, 7, y, c.stoneDark);
    px(ctx, 8, y, c.stoneDark);
  }
  for (let x = 5; x < 11; x++) {
    px(ctx, x, 16, c.stoneDark);
    px(ctx, x, 17, c.stoneDark);
  }
}

// Wooden pew (object, 16x16)
function drawWoodenPew(ctx) {
  const c = PALETTE;

  // Pew bench
  for (let y = 10; y < 14; y++) {
    for (let x = 2; x < 14; x++) {
      if (y === 10) {
        px(ctx, x, y, c.woodDark);
      } else {
        px(ctx, x, y, c.woodBrown);
      }
    }
  }

  // Pew back
  for (let y = 4; y < 10; y++) {
    px(ctx, 2, y, c.woodDark);
    px(ctx, 3, y, c.woodBrown);
    px(ctx, 4, y, c.woodLight);
  }

  // Top rail
  for (let x = 2; x < 5; x++) {
    px(ctx, x, 4, c.woodDark);
  }

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(2, 14, 12, 1);
}

// Altar stone (object, 16x24)
function drawAltar(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(2, 22, 12, 2);

  // Altar base
  for (let y = 18; y < 22; y++) {
    for (let x = 3; x < 13; x++) {
      px(ctx, x, y, c.stoneDark);
    }
  }

  // Altar top
  for (let y = 14; y < 18; y++) {
    for (let x = 2; x < 14; x++) {
      if (y === 14) {
        px(ctx, x, y, c.stoneLight);
      } else {
        px(ctx, x, y, c.stone);
      }
    }
  }

  // Cloth draping
  for (let x = 3; x < 13; x++) {
    px(ctx, x, 14, c.white);
  }
  px(ctx, 4, 15, c.white);
  px(ctx, 5, 16, c.white);
  px(ctx, 10, 16, c.white);
  px(ctx, 11, 15, c.white);

  // Candles
  px(ctx, 5, 12, c.goldDark);
  px(ctx, 5, 11, c.gold);
  px(ctx, 5, 10, c.gold);
  px(ctx, 10, 12, c.goldDark);
  px(ctx, 10, 11, c.gold);
  px(ctx, 10, 10, c.gold);

  // Gold cross on altar
  px(ctx, 7, 13, c.gold);
  px(ctx, 8, 13, c.gold);
  px(ctx, 8, 12, c.gold);
  px(ctx, 8, 14, c.goldDark);
}

// Church bell (object, 16x24)
function drawBell(ctx) {
  const c = PALETTE;

  // Wooden beam support
  for (let x = 3; x < 13; x++) {
    px(ctx, x, 6, c.woodDark);
    px(ctx, x, 7, c.woodBrown);
  }

  // Support posts
  for (let y = 6; y < 22; y++) {
    px(ctx, 3, y, c.woodDark);
    px(ctx, 12, y, c.woodDark);
  }

  // Bell shape (bronze/gold)
  px(ctx, 7, 10, c.gold);
  px(ctx, 8, 10, c.gold);
  px(ctx, 6, 11, c.goldDark);
  px(ctx, 7, 11, c.gold);
  px(ctx, 8, 11, c.gold);
  px(ctx, 9, 11, c.goldDark);

  for (let y = 12; y < 16; y++) {
    px(ctx, 5, y, c.goldDark);
    px(ctx, 6, y, c.gold);
    px(ctx, 7, y, c.gold);
    px(ctx, 8, y, c.gold);
    px(ctx, 9, y, c.gold);
    px(ctx, 10, y, c.goldDark);
  }

  // Bell rim
  for (let x = 5; x < 11; x++) {
    px(ctx, x, 16, c.goldDark);
  }

  // Clapper
  px(ctx, 7, 13, c.woodDark);
  px(ctx, 8, 14, c.woodDark);
  px(ctx, 7, 15, c.woodBrown);
}

console.log('\n⛪ Generating Church Tileset for St. Paul\'s...\n');

console.log('Tiles:');
createSprite(16, 16, drawChurchStone, path.join(OUTPUT_DIR, 'church-stone.png'));
createSprite(16, 16, drawChurchFloor, path.join(OUTPUT_DIR, 'church-floor.png'));

console.log('\nObjects:');
createSprite(16, 32, drawStoneCross, path.join(OBJECTS_DIR, 'stone-cross.png'));
createSprite(16, 24, drawGravestone, path.join(OBJECTS_DIR, 'gravestone.png'));
createSprite(16, 32, drawArchedWindow, path.join(OBJECTS_DIR, 'arched-window.png'));
createSprite(16, 16, drawWoodenPew, path.join(OBJECTS_DIR, 'wooden-pew.png'));
createSprite(16, 24, drawAltar, path.join(OBJECTS_DIR, 'altar.png'));
createSprite(16, 24, drawBell, path.join(OBJECTS_DIR, 'bell.png'));

console.log('\n✅ Church tileset complete!');
console.log('🏛️  Sacred atmosphere: weathered stone, stained glass, crosses');
console.log('⛪ Ready for St. Paul\'s Church Hill\n');
