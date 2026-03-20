/**
 * Waterfront Tileset Generator
 *
 * Creates maritime/harbor tiles:
 * - Dock wood planks
 * - Water (animated-ready)
 * - Rope coils
 * - Ship mast
 * - Cargo crates (different from market)
 * - Fishing nets
 * - Anchor
 * - Barrels (maritime style)
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'tiles');
const OBJECTS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'objects');

const PALETTE = {
  // Dock wood (weathered, sun-bleached)
  dockWood: '#9A8A6A',
  dockWoodDark: '#7A6A4A',
  dockWoodLight: '#BAA A8A',

  // Water
  waterDeep: '#2A4A6A',
  waterMid: '#4A6A8A',
  waterLight: '#6A8AAA',
  waterFoam: '#A A CACA',

  // Rope
  rope: '#8B7355',
  ropeDark: '#6B5845',

  // Ship elements
  sailCloth: '#F5E6D3',
  sailClothDark: '#D4C5B3',
  mast: '#4A2E15',
  mastDark: '#2A1E05',

  // Metal
  ironGray: '#5A5A5A',
  ironDark: '#3A3A3A',

  // Cargo
  crateWood: '#8B5A2B',
  crateWoodDark: '#6B3A1B',

  // Nets
  netBrown: '#7A6A4A',
  netBrownDark: '#5A4A2A',

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

// Dock wood planks (16x16) - horizontal planks
function drawDockWood(ctx) {
  const c = PALETTE;

  // Horizontal planks (3 planks per tile)
  for (let plankY = 0; plankY < 16; plankY += 5) {
    for (let y = plankY; y < Math.min(plankY + 4, 16); y++) {
      for (let x = 0; x < 16; x++) {
        const grain = (x + y) % 3;
        if (y === plankY) {
          px(ctx, x, y, c.dockWoodDark);
        } else if (grain === 0) {
          px(ctx, x, y, c.dockWoodLight);
        } else {
          px(ctx, x, y, c.dockWood);
        }
      }
    }

    // Gaps between planks
    if (plankY + 4 < 16) {
      for (let x = 0; x < 16; x++) {
        px(ctx, x, plankY + 4, c.dockWoodDark);
      }
    }
  }

  // Nails
  px(ctx, 3, 2, c.ironGray);
  px(ctx, 12, 2, c.ironGray);
  px(ctx, 3, 7, c.ironGray);
  px(ctx, 12, 7, c.ironGray);
  px(ctx, 3, 12, c.ironGray);
  px(ctx, 12, 12, c.ironGray);
}

// Water tile (16x16) - will look good tiled
function drawWaterTile(ctx) {
  const c = PALETTE;

  // Base water with wave pattern
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const wave = Math.sin((x + y) * 0.4) > 0.3;
      const depth = y < 8;

      if (wave && depth) {
        px(ctx, x, y, c.waterLight);
      } else if (wave) {
        px(ctx, x, y, c.waterMid);
      } else if (depth) {
        px(ctx, x, y, c.waterMid);
      } else {
        px(ctx, x, y, c.waterDeep);
      }
    }
  }

  // Foam highlights
  px(ctx, 4, 3, c.waterFoam);
  px(ctx, 11, 8, c.waterFoam);
  px(ctx, 7, 13, c.waterFoam);
}

// Rope coil (object, 16x16)
function drawRopeCoil(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 14, 6, 2);

  // Coiled rope (circular pattern)
  // Outer loop
  for (let x = 5; x < 11; x++) {
    px(ctx, x, 8, c.ropeDark);
    px(ctx, x, 13, c.rope);
  }
  for (let y = 8; y < 14; y++) {
    px(ctx, 5, y, c.ropeDark);
    px(ctx, 10, y, c.rope);
  }

  // Inner loops
  px(ctx, 6, 9, c.rope);
  px(ctx, 7, 9, c.rope);
  px(ctx, 8, 9, c.rope);
  px(ctx, 9, 9, c.ropeDark);

  px(ctx, 6, 11, c.ropeDark);
  px(ctx, 7, 11, c.rope);
  px(ctx, 8, 11, c.rope);
  px(ctx, 9, 11, c.ropeDark);

  px(ctx, 7, 10, c.rope);
  px(ctx, 8, 10, c.ropeDark);
}

// Ship mast (object, 16x32)
function drawShipMast(ctx) {
  const c = PALETTE;

  // Mast pole
  for (let y = 2; y < 30; y++) {
    px(ctx, 7, y, y % 3 === 0 ? c.mastDark : c.mast);
    px(ctx, 8, y, c.mast);
  }

  // Cross beam (yard)
  for (let x = 2; x < 14; x++) {
    px(ctx, x, 8, c.mastDark);
    px(ctx, x, 9, c.mast);
  }

  // Furled sail
  for (let x = 3; x < 13; x++) {
    px(ctx, x, 10, c.sailClothDark);
    px(ctx, x, 11, c.sailCloth);
  }

  // Ropes
  px(ctx, 4, 12, c.ropeDark);
  px(ctx, 5, 13, c.ropeDark);
  px(ctx, 10, 12, c.ropeDark);
  px(ctx, 11, 13, c.ropeDark);
}

// Cargo crate (object, 16x20) - larger than market crates
function drawCargoCrate(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(3, 18, 10, 2);

  // Crate body
  for (let y = 8; y < 18; y++) {
    for (let x = 3; x < 13; x++) {
      if (y === 8 || y === 17) {
        px(ctx, x, y, c.crateWoodDark);
      } else if (x === 3 || x === 12) {
        px(ctx, x, y, c.crateWoodDark);
      } else if (x < 8) {
        px(ctx, x, y, c.crateWood);
      } else {
        px(ctx, x, y, c.crateWoodDark);
      }
    }
  }

  // Metal straps
  for (let x = 3; x < 13; x++) {
    px(ctx, x, 10, c.ironGray);
    px(ctx, x, 15, c.ironGray);
  }

  // Stencil marking (cargo label)
  px(ctx, 6, 12, c.black);
  px(ctx, 7, 12, c.black);
  px(ctx, 6, 13, c.black);
  px(ctx, 7, 13, c.black);
}

// Fishing net (object, 16x16)
function drawFishingNet(ctx) {
  const c = PALETTE;

  // Draped net pattern
  for (let y = 4; y < 15; y++) {
    for (let x = 2; x < 14; x++) {
      const isNet = (x + y) % 2 === 0;
      if (isNet) {
        px(ctx, x, y, y < 10 ? c.netBrown : c.netBrownDark);
      }
    }
  }

  // Net weights at bottom
  px(ctx, 4, 14, c.ironDark);
  px(ctx, 8, 14, c.ironDark);
  px(ctx, 12, 14, c.ironDark);

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(2, 15, 12, 1);
}

// Anchor (object, 16x24)
function drawAnchor(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 22, 6, 2);

  // Anchor shaft
  for (let y = 4; y < 20; y++) {
    px(ctx, 7, y, c.ironGray);
    px(ctx, 8, y, c.ironDark);
  }

  // Top ring
  px(ctx, 6, 4, c.ironGray);
  px(ctx, 7, 3, c.ironGray);
  px(ctx, 8, 3, c.ironGray);
  px(ctx, 9, 4, c.ironDark);

  // Anchor flukes (bottom prongs)
  // Left fluke
  for (let i = 0; i < 5; i++) {
    px(ctx, 5 - i, 16 + i, c.ironGray);
    px(ctx, 4 - i, 16 + i, c.ironDark);
  }

  // Right fluke
  for (let i = 0; i < 5; i++) {
    px(ctx, 10 + i, 16 + i, c.ironDark);
    px(ctx, 11 + i, 16 + i, c.ironGray);
  }

  // Fluke tips (curved)
  px(ctx, 1, 20, c.ironGray);
  px(ctx, 14, 20, c.ironDark);
}

// Maritime barrel (object, 16x20) - weathered
function drawMaritimeBarrel(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(4, 18, 8, 2);

  // Barrel body
  for (let y = 8; y < 18; y++) {
    const bulge = Math.abs(y - 13) < 2 ? 1 : 0;
    for (let x = 4 - bulge; x < 12 + bulge; x++) {
      if (x === 4 - bulge || x === 11 + bulge) {
        px(ctx, x, y, c.dockWoodDark);
      } else if (x < 8) {
        px(ctx, x, y, c.dockWood);
      } else {
        px(ctx, x, y, c.dockWoodDark);
      }
    }
  }

  // Iron bands
  for (let x = 4; x < 12; x++) {
    px(ctx, x, 9, c.ironGray);
    px(ctx, x, 13, c.ironGray);
    px(ctx, x, 16, c.ironGray);
  }

  // Top
  for (let x = 4; x < 12; x++) {
    px(ctx, x, 8, c.dockWoodDark);
  }
}

// Dhow sail (object, 16x32) - Arab sailing vessel element
function drawDhowSail(ctx) {
  const c = PALETTE;

  // Mast
  for (let y = 4; y < 30; y++) {
    px(ctx, 3, y, c.mastDark);
  }

  // Triangular lateen sail
  for (let y = 6; y < 26; y++) {
    const width = Math.floor((y - 6) * 0.5);
    for (let x = 4; x < 4 + width && x < 15; x++) {
      if (x === 4 || x === 4 + width - 1) {
        px(ctx, x, y, c.sailClothDark);
      } else {
        px(ctx, x, y, c.sailCloth);
      }
    }
  }

  // Boom (diagonal spar)
  for (let i = 0; i < 20; i++) {
    px(ctx, 3 + Math.floor(i * 0.5), 6 + i, c.mastDark);
  }
}

console.log('\n⚓ Generating Waterfront Tileset...\n');

console.log('Tiles:');
createSprite(16, 16, drawDockWood, path.join(OUTPUT_DIR, 'dock-wood.png'));
createSprite(16, 16, drawWaterTile, path.join(OUTPUT_DIR, 'water-tile.png'));

console.log('\nObjects:');
createSprite(16, 16, drawRopeCoil, path.join(OBJECTS_DIR, 'rope-coil.png'));
createSprite(16, 32, drawShipMast, path.join(OBJECTS_DIR, 'ship-mast.png'));
createSprite(16, 20, drawCargoCrate, path.join(OBJECTS_DIR, 'cargo-crate.png'));
createSprite(16, 16, drawFishingNet, path.join(OBJECTS_DIR, 'fishing-net.png'));
createSprite(16, 24, drawAnchor, path.join(OBJECTS_DIR, 'anchor.png'));
createSprite(16, 20, drawMaritimeBarrel, path.join(OBJECTS_DIR, 'maritime-barrel.png'));
createSprite(16, 32, drawDhowSail, path.join(OBJECTS_DIR, 'dhow-sail.png'));

console.log('\n✅ Waterfront tileset complete!');
console.log('⚓ Maritime atmosphere: docks, ships, cargo, nautical elements');
console.log('🌊 Ready for The Waterfront Quay\n');
