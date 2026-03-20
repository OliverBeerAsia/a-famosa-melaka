/**
 * Market Area Tileset Generator
 * Creates tiles and objects specific to Rua Direita (Main Street)
 * Focus: Bustling commerce, market stalls, taverns, merchant buildings
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');

// Color palette
const PALETTE = {
  // Market colors
  awningRed: '#C1440E',
  awningOrange: '#E87722',
  awningYellow: '#F4B41A',
  awningBlue: '#4A6FA5',
  awningGreen: '#5A8F3A',

  // Building colors
  whitewash: '#F5E6D3',
  whitewashDark: '#D4C5B3',
  woodBrown: '#654321',
  woodDark: '#3D2814',
  terracotta: '#D4704A',

  // Ground
  cobble: '#9B8B7E',
  cobbleDark: '#7A6B5E',
  dirt: '#8B7355',

  // Goods
  spiceOrange: '#D4704A',
  spiceYellow: '#E8C14A',
  fabricRed: '#B8312F',
  fabricBlue: '#4A6FA5',

  // Misc
  black: '#1A1A1A',
  shadow: '#00000040',
  gold: '#D4AF37'
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

// ===== MARKET STALL COMPONENTS =====

// Market stall (complete with awning, 16x24)
function drawMarketStall(ctx) {
  const c = PALETTE;

  // Awning (striped, top 8 pixels)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const stripe = Math.floor(x / 4) % 2 === 0;
      px(ctx, x, y, stripe ? c.awningRed : c.awningYellow);
    }
  }

  // Awning shadow
  for (let x = 0; x < 16; x++) {
    px(ctx, x, 7, c.woodDark);
  }

  // Support posts
  for (let y = 8; y < 24; y++) {
    px(ctx, 2, y, c.woodBrown);
    px(ctx, 13, y, c.woodBrown);
  }

  // Counter/table
  for (let y = 14; y < 18; y++) {
    for (let x = 3; x < 13; x++) {
      px(ctx, x, y, c.woodBrown);
    }
  }

  // Goods on table (colorful blobs for spices/cloth)
  px(ctx, 5, 15, c.spiceOrange);
  px(ctx, 6, 15, c.spiceOrange);
  px(ctx, 8, 15, c.spiceYellow);
  px(ctx, 9, 15, c.spiceYellow);
  px(ctx, 11, 15, c.fabricRed);

  px(ctx, 4, 16, c.spiceYellow);
  px(ctx, 5, 16, c.spiceOrange);
  px(ctx, 7, 16, c.fabricBlue);
  px(ctx, 10, 16, c.spiceOrange);
}

// Market stall variant (blue/green awning)
function drawMarketStall2(ctx) {
  const c = PALETTE;

  // Awning (blue/green striped)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const stripe = Math.floor(x / 4) % 2 === 0;
      px(ctx, x, y, stripe ? c.awningBlue : c.awningGreen);
    }
  }

  for (let x = 0; x < 16; x++) {
    px(ctx, x, 7, c.woodDark);
  }

  // Support posts
  for (let y = 8; y < 24; y++) {
    px(ctx, 2, y, c.woodBrown);
    px(ctx, 13, y, c.woodBrown);
  }

  // Counter
  for (let y = 14; y < 18; y++) {
    for (let x = 3; x < 13; x++) {
      px(ctx, x, y, c.woodBrown);
    }
  }

  // Different goods
  px(ctx, 5, 15, c.fabricBlue);
  px(ctx, 6, 15, c.fabricBlue);
  px(ctx, 8, 15, c.fabricRed);
  px(ctx, 9, 15, c.fabricRed);
  px(ctx, 11, 15, c.spiceYellow);
}

// Hanging lantern (8x16)
function drawLantern(ctx) {
  const c = PALETTE;

  // Chain
  px(ctx, 3, 0, c.black);
  px(ctx, 4, 0, c.black);
  px(ctx, 3, 1, c.black);
  px(ctx, 4, 1, c.black);
  px(ctx, 3, 2, c.black);
  px(ctx, 4, 2, c.black);

  // Lantern body (golden)
  for (let y = 4; y < 12; y++) {
    for (let x = 2; x < 6; x++) {
      px(ctx, x, y, c.gold);
    }
  }

  // Dark outline
  for (let x = 2; x < 6; x++) {
    px(ctx, x, 4, c.woodDark);
    px(ctx, x, 11, c.woodDark);
  }
  for (let y = 4; y < 12; y++) {
    px(ctx, 2, y, c.woodDark);
    px(ctx, 5, y, c.woodDark);
  }

  // Light glow (center)
  px(ctx, 3, 7, c.awningYellow);
  px(ctx, 4, 7, c.awningYellow);
  px(ctx, 3, 8, c.awningYellow);
  px(ctx, 4, 8, c.awningYellow);
}

// Sack of goods (16x16)
function drawSack(ctx) {
  const c = PALETTE;

  // Sack shape
  const sackPixels = [
    [7, 5], [8, 5],
    [6, 6], [7, 6], [8, 6], [9, 6],
    [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7],
    [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8],
    [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9],
    [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10],
    [6, 11], [7, 11], [8, 11], [9, 11],
    [6, 12], [7, 12], [8, 12], [9, 12],
    [7, 13], [8, 13]
  ];

  sackPixels.forEach(([x, y]) => {
    px(ctx, x, y, c.dirt);
  });

  // Darker shading
  px(ctx, 5, 7, c.cobbleDark);
  px(ctx, 5, 8, c.cobbleDark);
  px(ctx, 5, 9, c.cobbleDark);

  // Tie at top
  px(ctx, 7, 4, c.woodDark);
  px(ctx, 8, 4, c.woodDark);
}

// Wine/oil amphora (16x16)
function drawAmphora(ctx) {
  const c = PALETTE;
  const clay = '#B8704A';
  const clayDark = '#8B503A';

  // Narrow neck
  px(ctx, 7, 3, clayDark);
  px(ctx, 8, 3, clayDark);

  // Handles
  px(ctx, 6, 5, clayDark);
  px(ctx, 9, 5, clayDark);
  px(ctx, 6, 6, clayDark);
  px(ctx, 9, 6, clayDark);

  // Body (wider)
  for (let y = 5; y < 13; y++) {
    const width = Math.min(4, 2 + Math.floor((y - 5) * 0.4));
    for (let x = 8 - width; x < 8 + width; x++) {
      px(ctx, x, y, clay);
    }
  }

  // Shading
  for (let y = 5; y < 13; y++) {
    px(ctx, 5, y, clayDark);
  }

  // Base
  for (let x = 6; x < 10; x++) {
    px(ctx, x, 13, clayDark);
  }
}

// Tavern sign (hanging, 16x16)
function drawTavernSign(ctx) {
  const c = PALETTE;

  // Hanging bracket (iron)
  px(ctx, 2, 1, c.black);
  px(ctx, 3, 1, c.black);
  px(ctx, 4, 1, c.black);
  px(ctx, 4, 2, c.black);
  px(ctx, 4, 3, c.black);

  // Sign board
  for (let y = 4; y < 11; y++) {
    for (let x = 5; x < 14; x++) {
      px(ctx, x, y, c.woodBrown);
    }
  }

  // Border
  for (let x = 5; x < 14; x++) {
    px(ctx, x, 4, c.woodDark);
    px(ctx, x, 10, c.woodDark);
  }
  for (let y = 4; y < 11; y++) {
    px(ctx, 5, y, c.woodDark);
    px(ctx, 13, y, c.woodDark);
  }

  // Goblet symbol (simple)
  px(ctx, 8, 6, c.awningYellow);
  px(ctx, 9, 6, c.awningYellow);
  px(ctx, 8, 7, c.awningYellow);
  px(ctx, 9, 7, c.awningYellow);
  px(ctx, 7, 8, c.awningYellow);
  px(ctx, 8, 8, c.awningYellow);
  px(ctx, 9, 8, c.awningYellow);
  px(ctx, 10, 8, c.awningYellow);
}

// Hanging cloth/fabric (decorative, 16x16)
function drawHangingCloth(ctx) {
  const c = PALETTE;

  // Rope/line
  for (let x = 0; x < 16; x++) {
    px(ctx, x, 2, c.woodDark);
  }

  // Fabric hanging (wavy)
  for (let y = 3; y < 14; y++) {
    const wave = Math.sin(y * 0.5) * 2;
    for (let x = 4 + wave; x < 12 + wave; x++) {
      if (x >= 0 && x < 16) {
        const stripe = y % 3 === 0;
        px(ctx, x, y, stripe ? c.fabricRed : c.fabricBlue);
      }
    }
  }
}

// Spice pile (colorful mound, 16x16)
function drawSpicePile(ctx) {
  const c = PALETTE;

  // Mound shape (orange spice - saffron/turmeric)
  const mound = [
    [7, 8], [8, 8],
    [6, 9], [7, 9], [8, 9], [9, 9],
    [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10],
    [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11],
    [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12]
  ];

  mound.forEach(([x, y]) => {
    px(ctx, x, y, c.spiceOrange);
  });

  // Highlights
  px(ctx, 7, 8, c.spiceYellow);
  px(ctx, 8, 9, c.spiceYellow);
}

// ===== GENERATE ALL =====

console.log('\n🏪 Generating Market Area Tileset...\n');

console.log('Market Structures:');
createSprite(16, 24, drawMarketStall, path.join(OUTPUT_DIR, 'objects', 'market-stall-1.png'));
createSprite(16, 24, drawMarketStall2, path.join(OUTPUT_DIR, 'objects', 'market-stall-2.png'));

console.log('\nMarket Objects:');
createSprite(8, 16, drawLantern, path.join(OUTPUT_DIR, 'objects', 'lantern.png'));
createSprite(16, 16, drawSack, path.join(OUTPUT_DIR, 'objects', 'sack.png'));
createSprite(16, 16, drawAmphora, path.join(OUTPUT_DIR, 'objects', 'amphora.png'));
createSprite(16, 16, drawTavernSign, path.join(OUTPUT_DIR, 'objects', 'tavern-sign.png'));
createSprite(16, 16, drawHangingCloth, path.join(OUTPUT_DIR, 'objects', 'hanging-cloth.png'));
createSprite(16, 16, drawSpicePile, path.join(OUTPUT_DIR, 'objects', 'spice-pile.png'));

console.log('\n✅ Market tileset complete!');
console.log('📦 8 new market-specific objects created');
console.log('🎨 Ready for Rua Direita (Main Street) map!');
