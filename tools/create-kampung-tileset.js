/**
 * Kampung Tileset Generator
 *
 * Creates Malay village tiles:
 * - Bamboo structures
 * - Thatch roofing
 * - Tropical dirt path
 * - Banana trees
 * - Coconut palms
 * - Water well
 * - Woven mat
 * - Cooking fire
 * - Bamboo fence
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'tiles');
const OBJECTS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'objects');

const PALETTE = {
  // Bamboo
  bamboo: '#A A 8A6A',
  bambooDark: '#8A7A5A',
  bambooLight: '#CABAAA',
  bambooJoint: '#7A6A4A',

  // Thatch
  thatch: '#C4A574',
  thatchDark: '#A48554',
  thatchLight: '#D4B584',

  // Tropical earth
  dirtPath: '#9A7A5A',
  dirtPathDark: '#7A5A3A',
  dirtPathLight: '#BAA A7A',

  // Tropical vegetation
  bananaGreen: '#5A8A3A',
  bananaGreenDark: '#3A6A1A',
  bananaGreenLight: '#7AAA5A',
  bananaYellow: '#D4B41A',

  coconutBrown: '#8B5A2B',
  coconutBrownDark: '#6B3A1B',

  // Village elements
  stoneWell: '#8A7A6A',
  stoneWellDark: '#6A5A4A',

  mat: '#B8941D',
  matDark: '#987A1D',

  fireOrange: '#D4704A',
  fireRed: '#B8312F',
  fireYellow: '#F4B41A',

  smoke: 'rgba(100, 100, 100, 0.3)',
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

// Tropical dirt path (16x16)
function drawDirtPath(ctx) {
  const c = PALETTE;

  // Base dirt with variation
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const variation = (x * 2 + y * 3) % 5;
      if (variation === 0) {
        px(ctx, x, y, c.dirtPathLight);
      } else if (variation === 1) {
        px(ctx, x, y, c.dirtPathDark);
      } else {
        px(ctx, x, y, c.dirtPath);
      }
    }
  }

  // Small stones/pebbles
  px(ctx, 3, 5, c.stoneWellDark);
  px(ctx, 11, 8, c.stoneWellDark);
  px(ctx, 7, 13, c.stoneWellDark);
}

// Bamboo floor/platform (16x16)
function drawBambooFloor(ctx) {
  const c = PALETTE;

  // Horizontal bamboo slats
  for (let y = 0; y < 16; y += 4) {
    for (let i = 0; i < 3; i++) {
      for (let x = 0; x < 16; x++) {
        const grain = x % 3;
        if (grain === 0) {
          px(ctx, x, y + i, c.bambooDark);
        } else if (grain === 1) {
          px(ctx, x, y + i, c.bambooLight);
        } else {
          px(ctx, x, y + i, c.bamboo);
        }
      }
    }

    // Gap between slats
    if (y + 3 < 16) {
      for (let x = 0; x < 16; x++) {
        px(ctx, x, y + 3, c.bambooDark);
      }
    }
  }

  // Bamboo joints (darker bands)
  px(ctx, 4, 1, c.bambooJoint);
  px(ctx, 11, 5, c.bambooJoint);
  px(ctx, 7, 9, c.bambooJoint);
  px(ctx, 14, 13, c.bambooJoint);
}

// Thatch roofing (16x16)
function drawThatchRoof(ctx) {
  const c = PALETTE;

  // Layered thatch pattern
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const layer = y % 3;
      const texture = (x + y) % 4;

      if (layer === 0) {
        px(ctx, x, y, c.thatchDark);
      } else if (texture === 0) {
        px(ctx, x, y, c.thatchLight);
      } else {
        px(ctx, x, y, c.thatch);
      }
    }
  }

  // Straw strands
  for (let y = 0; y < 16; y += 2) {
    for (let x = 0; x < 16; x += 3) {
      px(ctx, x, y, c.thatchDark);
    }
  }
}

// Banana tree (object, 16x32)
function drawBananaTree(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 30, 6, 2);

  // Trunk (short, thick)
  for (let y = 20; y < 30; y++) {
    px(ctx, 7, y, c.coconutBrownDark);
    px(ctx, 8, y, c.coconutBrown);
  }

  // Large banana leaves (spreading outward)
  // Left leaves
  for (let i = 0; i < 8; i++) {
    px(ctx, 4 - Math.floor(i / 2), 12 + i, c.bananaGreen);
    px(ctx, 5 - Math.floor(i / 2), 12 + i, c.bananaGreenLight);
  }

  // Right leaves
  for (let i = 0; i < 8; i++) {
    px(ctx, 11 + Math.floor(i / 2), 12 + i, c.bananaGreen);
    px(ctx, 10 + Math.floor(i / 2), 12 + i, c.bananaGreenDark);
  }

  // Center leaves (upward)
  for (let y = 8; y < 20; y++) {
    px(ctx, 7, y, c.bananaGreenLight);
    px(ctx, 8, y, c.bananaGreen);
  }

  // Banana bunch
  for (let y = 18; y < 22; y++) {
    px(ctx, 6, y, c.bananaYellow);
    px(ctx, 7, y, c.bananaYellow);
    px(ctx, 9, y, c.bananaYellow);
  }
}

// Water well (object, 16x24)
function drawWaterWell(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(3, 22, 10, 2);

  // Stone well cylinder
  for (let y = 14; y < 22; y++) {
    for (let x = 4; x < 12; x++) {
      if (x === 4 || x === 11) {
        px(ctx, x, y, c.stoneWellDark);
      } else if (x < 8) {
        px(ctx, x, y, c.stoneWell);
      } else {
        px(ctx, x, y, c.stoneWellDark);
      }
    }
  }

  // Well interior (dark/water)
  for (let y = 15; y < 20; y++) {
    for (let x = 5; x < 11; x++) {
      px(ctx, x, y, c.black);
    }
  }

  // Water glimmer
  px(ctx, 6, 18, c.white);
  px(ctx, 9, 17, c.white);

  // Wooden frame above
  for (let y = 8; y < 14; y++) {
    px(ctx, 4, y, c.coconutBrownDark);
    px(ctx, 11, y, c.coconutBrownDark);
  }

  // Crossbeam
  for (let x = 4; x < 12; x++) {
    px(ctx, x, 8, c.coconutBrownDark);
    px(ctx, x, 9, c.coconutBrown);
  }

  // Rope/bucket
  px(ctx, 7, 10, c.thatchDark);
  px(ctx, 8, 11, c.thatchDark);
  px(ctx, 7, 12, c.coconutBrown);
  px(ctx, 8, 12, c.coconutBrown);
}

// Woven mat (object, 16x16)
function drawWovenMat(ctx) {
  const c = PALETTE;

  // Woven pattern
  for (let y = 4; y < 14; y++) {
    for (let x = 2; x < 14; x++) {
      const weave = (x + y) % 2;
      if (y === 4 || y === 13 || x === 2 || x === 13) {
        px(ctx, x, y, c.matDark);
      } else if (weave === 0) {
        px(ctx, x, y, c.mat);
      } else {
        px(ctx, x, y, c.matDark);
      }
    }
  }

  // Frayed edges
  px(ctx, 1, 5, c.matDark);
  px(ctx, 1, 9, c.matDark);
  px(ctx, 14, 7, c.matDark);
  px(ctx, 14, 11, c.matDark);

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(2, 14, 12, 1);
}

// Cooking fire (object, 16x20)
function drawCookingFire(ctx) {
  const c = PALETTE;

  // Stone ring
  for (let angle = 0; angle < 8; angle++) {
    const x = 8 + Math.floor(Math.cos(angle * Math.PI / 4) * 4);
    const y = 14 + Math.floor(Math.sin(angle * Math.PI / 4) * 3);
    px(ctx, x, y, c.stoneWellDark);
  }

  // Fire (animated-ready with multiple frames)
  // Base (coals)
  px(ctx, 7, 13, c.fireRed);
  px(ctx, 8, 13, c.fireRed);
  px(ctx, 9, 13, c.fireOrange);

  // Flames
  px(ctx, 7, 11, c.fireOrange);
  px(ctx, 8, 10, c.fireYellow);
  px(ctx, 9, 11, c.fireOrange);
  px(ctx, 8, 9, c.fireYellow);

  // Smoke
  ctx.fillStyle = c.smoke;
  ctx.fillRect(7, 6, 3, 3);

  // Cooking pot
  px(ctx, 6, 12, c.black);
  px(ctx, 7, 12, c.stoneWellDark);
  px(ctx, 8, 12, c.stoneWellDark);
  px(ctx, 9, 12, c.stoneWellDark);
  px(ctx, 10, 12, c.black);
}

// Bamboo fence (object, 16x24)
function drawBambooFence(ctx) {
  const c = PALETTE;

  // Vertical bamboo poles
  for (let x = 2; x < 14; x += 3) {
    for (let y = 8; y < 22; y++) {
      if (y % 4 === 0) {
        px(ctx, x, y, c.bambooJoint);
      } else {
        px(ctx, x, y, c.bamboo);
      }
      px(ctx, x + 1, y, c.bambooDark);
    }
  }

  // Horizontal bamboo supports
  for (let x = 2; x < 14; x++) {
    px(ctx, x, 10, c.bambooDark);
    px(ctx, x, 11, c.bamboo);
    px(ctx, x, 16, c.bambooDark);
    px(ctx, x, 17, c.bamboo);
  }

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(2, 22, 12, 1);
}

// Coconut on ground (object, 16x16)
function drawCoconut(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 14, 6, 2);

  // Coconut shell
  for (let y = 8; y < 14; y++) {
    for (let x = 5; x < 11; x++) {
      if (y === 8 || y === 13 || x === 5 || x === 10) {
        px(ctx, x, y, c.coconutBrownDark);
      } else if (x < 8) {
        px(ctx, x, y, c.coconutBrown);
      } else {
        px(ctx, x, y, c.coconutBrownDark);
      }
    }
  }

  // Fiber texture
  px(ctx, 6, 9, c.thatchDark);
  px(ctx, 7, 10, c.thatchDark);
  px(ctx, 9, 11, c.thatchDark);

  // Eyes (three dark spots)
  px(ctx, 6, 10, c.black);
  px(ctx, 8, 9, c.black);
  px(ctx, 9, 10, c.black);
}

console.log('\n🏝️  Generating Kampung Tileset...\n');

console.log('Tiles:');
createSprite(16, 16, drawDirtPath, path.join(OUTPUT_DIR, 'dirt-path.png'));
createSprite(16, 16, drawBambooFloor, path.join(OUTPUT_DIR, 'bamboo-floor.png'));
createSprite(16, 16, drawThatchRoof, path.join(OUTPUT_DIR, 'thatch-roof.png'));

console.log('\nObjects:');
createSprite(16, 32, drawBananaTree, path.join(OBJECTS_DIR, 'banana-tree.png'));
createSprite(16, 24, drawWaterWell, path.join(OBJECTS_DIR, 'water-well.png'));
createSprite(16, 16, drawWovenMat, path.join(OBJECTS_DIR, 'woven-mat.png'));
createSprite(16, 20, drawCookingFire, path.join(OBJECTS_DIR, 'cooking-fire.png'));
createSprite(16, 24, drawBambooFence, path.join(OBJECTS_DIR, 'bamboo-fence.png'));
createSprite(16, 16, drawCoconut, path.join(OBJECTS_DIR, 'coconut.png'));

console.log('\n✅ Kampung tileset complete!');
console.log('🏝️  Tropical village atmosphere: bamboo, thatch, banana trees');
console.log('🌴 Ready for The Kampung Quarter\n');
