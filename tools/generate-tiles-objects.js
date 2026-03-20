/**
 * Generate proper pixel art tiles and objects for the game
 * Tiles: 16x16, Objects: various sizes (16x16 to 32x48)
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Color palette
const PALETTE = {
  // Stone/fortress
  stoneLight: '#9E9E9E',
  stoneMid: '#6B6B6B',
  stoneDark: '#4A4A4A',
  
  // Cobblestone
  cobbleLight: '#8B7355',
  cobbleMid: '#6B5344',
  cobbleDark: '#4A3728',
  
  // Grass
  grassLight: '#5C8A4D',
  grassMid: '#4A7340',
  grassDark: '#3D5C32',
  
  // Water
  waterLight: '#4A8BA8',
  waterMid: '#3A7A98',
  waterDark: '#2A5A78',
  
  // Wood
  woodLight: '#A67B5B',
  woodMid: '#8B6342',
  woodDark: '#5C4033',
  
  // Terracotta
  terracottaLight: '#C65D3D',
  terracottaMid: '#A64B32',
  terracottaDark: '#8B3D28',
  
  // Sand
  sandLight: '#E8D4A8',
  sandMid: '#D4C498',
  sandDark: '#C4B488',
  
  // General
  black: '#1A1410',
  white: '#F5F5DC',
  gold: '#D4AF37',
  red: '#8B0000',
  green: '#1B5E20',
};

function createCanvas16(width = 16, height = 16) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// === TILES ===

function drawCobblestone(ctx) {
  // Base
  fillRect(ctx, 0, 0, 16, 16, PALETTE.cobbleMid);
  
  // Cobblestone pattern
  const stones = [
    { x: 1, y: 1, w: 5, h: 4 },
    { x: 7, y: 0, w: 4, h: 3 },
    { x: 12, y: 1, w: 3, h: 4 },
    { x: 0, y: 6, w: 4, h: 4 },
    { x: 5, y: 5, w: 5, h: 5 },
    { x: 11, y: 6, w: 4, h: 4 },
    { x: 1, y: 11, w: 5, h: 4 },
    { x: 7, y: 11, w: 4, h: 4 },
    { x: 12, y: 12, w: 3, h: 3 }
  ];
  
  stones.forEach(s => {
    fillRect(ctx, s.x, s.y, s.w, s.h, PALETTE.cobbleLight);
    // Highlight
    setPixel(ctx, s.x, s.y, PALETTE.sandMid);
    // Shadow
    setPixel(ctx, s.x + s.w - 1, s.y + s.h - 1, PALETTE.cobbleDark);
  });
}

function drawGrassTropical(ctx) {
  // Base grass
  fillRect(ctx, 0, 0, 16, 16, PALETTE.grassMid);
  
  // Variation
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(Math.random() * 16);
    const y = Math.floor(Math.random() * 16);
    setPixel(ctx, x, y, Math.random() > 0.5 ? PALETTE.grassLight : PALETTE.grassDark);
  }
  
  // Grass blades
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(Math.random() * 14) + 1;
    const y = Math.floor(Math.random() * 14) + 1;
    setPixel(ctx, x, y, PALETTE.grassLight);
    setPixel(ctx, x, y - 1, PALETTE.grassLight);
  }
}

function drawSandBeach(ctx) {
  // Base sand
  fillRect(ctx, 0, 0, 16, 16, PALETTE.sandMid);
  
  // Variation
  for (let i = 0; i < 15; i++) {
    const x = Math.floor(Math.random() * 16);
    const y = Math.floor(Math.random() * 16);
    setPixel(ctx, x, y, Math.random() > 0.5 ? PALETTE.sandLight : PALETTE.sandDark);
  }
  
  // Small shells/pebbles
  setPixel(ctx, 3, 5, PALETTE.white);
  setPixel(ctx, 12, 9, PALETTE.cobbleMid);
  setPixel(ctx, 7, 13, PALETTE.white);
}

function drawTerracottaFloor(ctx) {
  // Base terracotta
  fillRect(ctx, 0, 0, 16, 16, PALETTE.terracottaMid);
  
  // Tile pattern (2x2 tiles)
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const x = tx * 8;
      const y = ty * 8;
      
      // Tile highlight
      fillRect(ctx, x, y, 7, 1, PALETTE.terracottaLight);
      fillRect(ctx, x, y, 1, 7, PALETTE.terracottaLight);
      
      // Tile shadow
      fillRect(ctx, x + 7, y, 1, 8, PALETTE.terracottaDark);
      fillRect(ctx, x, y + 7, 8, 1, PALETTE.terracottaDark);
    }
  }
}

function drawWaterHarbor(ctx) {
  // Base water
  fillRect(ctx, 0, 0, 16, 16, PALETTE.waterMid);
  
  // Wave pattern
  for (let y = 0; y < 16; y += 4) {
    for (let x = 0; x < 16; x++) {
      const wave = Math.sin((x + y) * 0.5) > 0;
      setPixel(ctx, x, y, wave ? PALETTE.waterLight : PALETTE.waterDark);
      setPixel(ctx, x, y + 1, wave ? PALETTE.waterLight : PALETTE.waterMid);
    }
  }
}

function drawWoodDock(ctx) {
  // Planks running horizontally
  for (let y = 0; y < 16; y += 4) {
    fillRect(ctx, 0, y, 16, 3, PALETTE.woodMid);
    // Plank highlight
    fillRect(ctx, 0, y, 16, 1, PALETTE.woodLight);
    // Plank shadow
    fillRect(ctx, 0, y + 3, 16, 1, PALETTE.woodDark);
    
    // Nail holes
    setPixel(ctx, 2, y + 1, PALETTE.black);
    setPixel(ctx, 13, y + 1, PALETTE.black);
  }
}

// === OBJECTS ===

function drawAnchor(ctx, width = 24, height = 32) {
  const cx = Math.floor(width / 2);
  
  // Ring at top
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    const rx = cx + Math.cos(a) * 3;
    const ry = 4 + Math.sin(a) * 3;
    setPixel(ctx, Math.floor(rx), Math.floor(ry), PALETTE.stoneDark);
  }
  
  // Vertical shaft
  fillRect(ctx, cx - 1, 7, 3, 18, PALETTE.stoneMid);
  fillRect(ctx, cx, 7, 1, 18, PALETTE.stoneLight);
  
  // Horizontal crossbar
  fillRect(ctx, cx - 6, 10, 13, 2, PALETTE.stoneMid);
  
  // Curved flukes at bottom
  // Left fluke
  fillRect(ctx, cx - 6, 22, 3, 6, PALETTE.stoneMid);
  fillRect(ctx, cx - 8, 25, 3, 4, PALETTE.stoneMid);
  setPixel(ctx, cx - 9, 28, PALETTE.stoneDark);
  
  // Right fluke
  fillRect(ctx, cx + 4, 22, 3, 6, PALETTE.stoneMid);
  fillRect(ctx, cx + 6, 25, 3, 4, PALETTE.stoneMid);
  setPixel(ctx, cx + 9, 28, PALETTE.stoneDark);
}

function drawBarrel(ctx, width = 16, height = 20) {
  const cx = Math.floor(width / 2);
  
  // Barrel body (wider in middle)
  for (let y = 2; y < height - 2; y++) {
    const bulge = Math.sin((y - 2) / (height - 4) * Math.PI) * 2;
    const halfWidth = 5 + bulge;
    fillRect(ctx, cx - halfWidth, y, halfWidth * 2, 1, PALETTE.woodMid);
  }
  
  // Metal bands
  const bands = [4, Math.floor(height / 2), height - 5];
  bands.forEach(y => {
    fillRect(ctx, cx - 6, y, 12, 2, PALETTE.stoneDark);
  });
  
  // Top
  fillRect(ctx, cx - 4, 0, 8, 2, PALETTE.woodDark);
  
  // Highlight
  fillRect(ctx, cx - 3, 3, 2, height - 6, PALETTE.woodLight);
}

function drawCrate(ctx, width = 16, height = 16) {
  // Main box
  fillRect(ctx, 1, 2, 14, 13, PALETTE.woodMid);
  
  // Top face
  fillRect(ctx, 1, 0, 14, 2, PALETTE.woodLight);
  
  // Shadow side
  fillRect(ctx, 14, 2, 1, 13, PALETTE.woodDark);
  fillRect(ctx, 1, 14, 14, 1, PALETTE.woodDark);
  
  // Cross planks
  fillRect(ctx, 7, 2, 2, 13, PALETTE.woodDark);
  fillRect(ctx, 1, 7, 14, 2, PALETTE.woodDark);
  
  // Nails
  setPixel(ctx, 3, 4, PALETTE.stoneDark);
  setPixel(ctx, 12, 4, PALETTE.stoneDark);
  setPixel(ctx, 3, 11, PALETTE.stoneDark);
  setPixel(ctx, 12, 11, PALETTE.stoneDark);
}

function drawPalmTree(ctx, width = 32, height = 48) {
  const cx = Math.floor(width / 2);
  
  // Trunk
  for (let y = height - 1; y > 16; y--) {
    const wobble = Math.sin(y * 0.3) * 0.5;
    fillRect(ctx, cx - 2 + wobble, y, 4, 1, PALETTE.woodMid);
    setPixel(ctx, cx - 2 + wobble, y, PALETTE.woodLight);
  }
  
  // Trunk texture (horizontal lines)
  for (let y = height - 1; y > 18; y -= 3) {
    fillRect(ctx, cx - 2, y, 4, 1, PALETTE.woodDark);
  }
  
  // Coconuts
  setPixel(ctx, cx - 1, 17, PALETTE.cobbleDark);
  setPixel(ctx, cx, 17, PALETTE.cobbleDark);
  setPixel(ctx, cx + 1, 18, PALETTE.cobbleDark);
  
  // Fronds (palm leaves)
  const frondColors = [PALETTE.grassDark, PALETTE.grassMid, PALETTE.grassLight];
  
  // Draw multiple fronds
  const fronds = [
    { angle: -60, length: 14 },
    { angle: -30, length: 16 },
    { angle: 0, length: 12 },
    { angle: 30, length: 16 },
    { angle: 60, length: 14 },
    { angle: -80, length: 10 },
    { angle: 80, length: 10 },
  ];
  
  fronds.forEach(frond => {
    const rad = frond.angle * Math.PI / 180;
    for (let i = 0; i < frond.length; i++) {
      const x = cx + Math.cos(rad) * i;
      const y = 16 + Math.sin(rad) * i * 0.6 - Math.abs(Math.cos(rad)) * i * 0.3;
      const color = frondColors[i % 3];
      setPixel(ctx, Math.floor(x), Math.floor(y), color);
      setPixel(ctx, Math.floor(x), Math.floor(y) + 1, color);
    }
  });
}

function drawMarketStall1(ctx, width = 32, height = 32) {
  // Posts
  fillRect(ctx, 2, 8, 2, 24, PALETTE.woodDark);
  fillRect(ctx, 28, 8, 2, 24, PALETTE.woodDark);
  
  // Counter
  fillRect(ctx, 0, 20, 32, 3, PALETTE.woodMid);
  fillRect(ctx, 0, 20, 32, 1, PALETTE.woodLight);
  
  // Awning (colorful cloth)
  fillRect(ctx, 0, 0, 32, 10, PALETTE.red);
  // Stripes
  for (let x = 0; x < 32; x += 6) {
    fillRect(ctx, x, 0, 3, 10, PALETTE.gold);
  }
  // Scalloped edge
  for (let x = 0; x < 32; x += 4) {
    fillRect(ctx, x + 1, 9, 2, 2, PALETTE.red);
  }
  
  // Goods on counter
  fillRect(ctx, 5, 17, 4, 3, PALETTE.terracottaMid); // Pottery
  fillRect(ctx, 12, 18, 6, 2, PALETTE.sandMid); // Sack
  fillRect(ctx, 22, 16, 5, 4, PALETTE.green); // Vegetables
}

function drawMarketStall2(ctx, width = 32, height = 32) {
  // Similar structure, different colors
  fillRect(ctx, 2, 8, 2, 24, PALETTE.woodDark);
  fillRect(ctx, 28, 8, 2, 24, PALETTE.woodDark);
  
  // Counter
  fillRect(ctx, 0, 20, 32, 3, PALETTE.woodMid);
  
  // Awning (blue and white)
  fillRect(ctx, 0, 0, 32, 10, '#1A237E');
  for (let x = 0; x < 32; x += 6) {
    fillRect(ctx, x, 0, 3, 10, PALETTE.white);
  }
  
  // Spices on display
  fillRect(ctx, 4, 17, 5, 3, '#DAA520'); // Turmeric
  fillRect(ctx, 11, 17, 5, 3, '#8B0000'); // Chili
  fillRect(ctx, 18, 17, 5, 3, '#2E5A1C'); // Herbs
  fillRect(ctx, 25, 17, 4, 3, '#3D2817'); // Pepper
}

function drawLantern(ctx, width = 12, height = 20) {
  const cx = Math.floor(width / 2);
  
  // Hook at top
  setPixel(ctx, cx, 0, PALETTE.stoneDark);
  setPixel(ctx, cx, 1, PALETTE.stoneDark);
  
  // Top cap
  fillRect(ctx, cx - 3, 2, 6, 2, PALETTE.stoneDark);
  
  // Glass/paper body
  fillRect(ctx, cx - 2, 4, 4, 10, '#F4B41A');
  fillRect(ctx, cx - 1, 5, 2, 8, '#FFD700');
  
  // Frame
  setPixel(ctx, cx - 2, 4, PALETTE.woodDark);
  setPixel(ctx, cx + 1, 4, PALETTE.woodDark);
  setPixel(ctx, cx - 2, 13, PALETTE.woodDark);
  setPixel(ctx, cx + 1, 13, PALETTE.woodDark);
  
  // Bottom
  fillRect(ctx, cx - 3, 14, 6, 2, PALETTE.stoneDark);
  
  // Tassel
  fillRect(ctx, cx - 1, 16, 2, 3, PALETTE.red);
}

function drawSack(ctx, width = 14, height = 16) {
  const cx = Math.floor(width / 2);
  
  // Sack body
  fillRect(ctx, 2, 4, 10, 11, PALETTE.sandMid);
  
  // Tied top
  fillRect(ctx, cx - 2, 0, 4, 4, PALETTE.sandMid);
  setPixel(ctx, cx - 3, 3, PALETTE.sandDark);
  setPixel(ctx, cx + 2, 3, PALETTE.sandDark);
  
  // Tie
  fillRect(ctx, cx - 1, 3, 2, 1, PALETTE.cobbleDark);
  
  // Shading
  fillRect(ctx, 2, 4, 2, 11, PALETTE.sandLight);
  fillRect(ctx, 10, 4, 2, 11, PALETTE.sandDark);
  
  // Texture lines
  for (let y = 6; y < 14; y += 2) {
    setPixel(ctx, 4, y, PALETTE.sandDark);
    setPixel(ctx, 8, y, PALETTE.sandDark);
  }
}

function drawPottery(ctx, width = 12, height = 16) {
  const cx = Math.floor(width / 2);
  
  // Pot shape
  for (let y = 4; y < 15; y++) {
    const bulge = Math.sin((y - 4) / 11 * Math.PI) * 3;
    const halfWidth = 2 + bulge;
    fillRect(ctx, cx - halfWidth, y, halfWidth * 2, 1, PALETTE.terracottaMid);
  }
  
  // Rim
  fillRect(ctx, cx - 2, 2, 4, 2, PALETTE.terracottaMid);
  fillRect(ctx, cx - 3, 3, 6, 1, PALETTE.terracottaDark);
  
  // Decorative band
  fillRect(ctx, cx - 4, 8, 8, 1, PALETTE.gold);
  
  // Highlight
  fillRect(ctx, cx - 3, 5, 1, 8, PALETTE.terracottaLight);
  
  // Shadow
  fillRect(ctx, cx + 2, 5, 1, 8, PALETTE.terracottaDark);
}

function drawSpicePile(ctx, width = 16, height = 12) {
  // Base pile shape
  for (let y = 4; y < 11; y++) {
    const width = 14 - Math.abs(y - 7);
    const startX = 8 - width / 2;
    fillRect(ctx, startX, y, width, 1, '#DAA520'); // Turmeric yellow
  }
  
  // Highlights
  setPixel(ctx, 7, 4, '#FFD700');
  setPixel(ctx, 8, 5, '#FFD700');
  
  // Some darker bits
  setPixel(ctx, 5, 8, '#B8860B');
  setPixel(ctx, 10, 7, '#B8860B');
  setPixel(ctx, 6, 9, '#8B6914');
}

function drawStoneCross(ctx, width = 16, height = 24) {
  const cx = Math.floor(width / 2);
  
  // Vertical
  fillRect(ctx, cx - 2, 0, 4, 22, PALETTE.stoneMid);
  
  // Horizontal
  fillRect(ctx, cx - 6, 4, 12, 4, PALETTE.stoneMid);
  
  // Highlight
  fillRect(ctx, cx - 1, 0, 1, 22, PALETTE.stoneLight);
  fillRect(ctx, cx - 6, 5, 12, 1, PALETTE.stoneLight);
  
  // Base
  fillRect(ctx, cx - 4, 22, 8, 2, PALETTE.stoneDark);
}

function drawRopeCoil(ctx, width = 14, height = 10) {
  // Coiled rope
  for (let ring = 0; ring < 3; ring++) {
    const y = 3 + ring * 2;
    for (let x = 2; x < 12; x++) {
      setPixel(ctx, x, y, PALETTE.sandMid);
      setPixel(ctx, x, y + 1, PALETTE.sandDark);
    }
  }
  
  // Rope end
  fillRect(ctx, 10, 1, 2, 3, PALETTE.sandMid);
}

function drawShipMast(ctx, width = 16, height = 48) {
  const cx = Math.floor(width / 2);
  
  // Main mast
  fillRect(ctx, cx - 2, 0, 4, 48, PALETTE.woodMid);
  fillRect(ctx, cx - 1, 0, 1, 48, PALETTE.woodLight);
  
  // Cross beam
  fillRect(ctx, 0, 8, 16, 3, PALETTE.woodDark);
  
  // Crow's nest hint at top
  fillRect(ctx, cx - 4, 2, 8, 2, PALETTE.woodDark);
}

function drawFishingNet(ctx, width = 20, height = 16) {
  // Net pattern
  for (let y = 0; y < 16; y += 3) {
    for (let x = 0; x < 20; x += 3) {
      setPixel(ctx, x, y, PALETTE.sandDark);
      // Diagonal connections
      if (x < 18 && y < 14) {
        setPixel(ctx, x + 1, y + 1, PALETTE.sandDark);
        setPixel(ctx, x + 2, y + 2, PALETTE.sandDark);
      }
    }
  }
}

function drawDhowSail(ctx, width = 24, height = 32) {
  // Triangular lateen sail
  for (let y = 0; y < 28; y++) {
    const width = Math.floor((28 - y) * 0.8);
    fillRect(ctx, 2, y, width, 1, PALETTE.white);
  }
  
  // Sail lines
  for (let i = 0; i < 28; i += 4) {
    setPixel(ctx, 2 + i * 0.4, i, PALETTE.sandDark);
  }
  
  // Mast
  fillRect(ctx, 0, 0, 2, 32, PALETTE.woodDark);
}

function drawCargoCrate(ctx, width = 20, height = 18) {
  // Larger crate
  fillRect(ctx, 1, 2, 18, 15, PALETTE.woodMid);
  
  // Top
  fillRect(ctx, 1, 0, 18, 2, PALETTE.woodLight);
  
  // Side shadow
  fillRect(ctx, 18, 2, 1, 15, PALETTE.woodDark);
  
  // Bands
  fillRect(ctx, 0, 5, 20, 2, PALETTE.stoneDark);
  fillRect(ctx, 0, 12, 20, 2, PALETTE.stoneDark);
  
  // Markings
  setPixel(ctx, 8, 8, PALETTE.red);
  setPixel(ctx, 9, 8, PALETTE.red);
  setPixel(ctx, 10, 8, PALETTE.red);
  setPixel(ctx, 11, 8, PALETTE.red);
}

function drawMaritimeBarrel(ctx, width = 14, height = 18) {
  drawBarrel(ctx, width, height);
  // Add rope around it
  fillRect(ctx, 1, 8, 12, 1, PALETTE.sandMid);
}

// Save function
async function saveImage(canvas, folder, filename) {
  const outputPath = path.join(__dirname, '..', 'assets', 'sprites', folder, filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${folder}/${filename}`);
}

// Main
async function main() {
  console.log('Generating tiles and objects...\n');

  // === TILES (16x16) ===
  const tiles = [
    { name: 'cobblestone.png', draw: drawCobblestone },
    { name: 'grass-tropical.png', draw: drawGrassTropical },
    { name: 'sand-beach.png', draw: drawSandBeach },
    { name: 'terracotta-floor.png', draw: drawTerracottaFloor },
    { name: 'water-harbor.png', draw: drawWaterHarbor },
    { name: 'wood-dock.png', draw: drawWoodDock },
  ];

  for (const tile of tiles) {
    const { canvas, ctx } = createCanvas16(16, 16);
    tile.draw(ctx);
    await saveImage(canvas, 'tiles', tile.name);
  }

  // === OBJECTS (various sizes) ===
  
  // Anchor 24x32
  let { canvas, ctx } = createCanvas16(24, 32);
  drawAnchor(ctx, 24, 32);
  await saveImage(canvas, 'objects', 'anchor.png');

  // Barrel 16x20
  ({ canvas, ctx } = createCanvas16(16, 20));
  drawBarrel(ctx, 16, 20);
  await saveImage(canvas, 'objects', 'barrel.png');

  // Crate 16x16
  ({ canvas, ctx } = createCanvas16(16, 16));
  drawCrate(ctx, 16, 16);
  await saveImage(canvas, 'objects', 'crate.png');

  // Palm tree 32x48
  ({ canvas, ctx } = createCanvas16(32, 48));
  drawPalmTree(ctx, 32, 48);
  await saveImage(canvas, 'objects', 'palm-tree.png');

  // Market stall 1 32x32
  ({ canvas, ctx } = createCanvas16(32, 32));
  drawMarketStall1(ctx, 32, 32);
  await saveImage(canvas, 'objects', 'market-stall-1.png');

  // Market stall 2 32x32
  ({ canvas, ctx } = createCanvas16(32, 32));
  drawMarketStall2(ctx, 32, 32);
  await saveImage(canvas, 'objects', 'market-stall-2.png');

  // Lantern 12x20
  ({ canvas, ctx } = createCanvas16(12, 20));
  drawLantern(ctx, 12, 20);
  await saveImage(canvas, 'objects', 'lantern.png');

  // Sack 14x16
  ({ canvas, ctx } = createCanvas16(14, 16));
  drawSack(ctx, 14, 16);
  await saveImage(canvas, 'objects', 'sack.png');

  // Pottery 12x16
  ({ canvas, ctx } = createCanvas16(12, 16));
  drawPottery(ctx, 12, 16);
  await saveImage(canvas, 'objects', 'pottery.png');

  // Spice pile 16x12
  ({ canvas, ctx } = createCanvas16(16, 12));
  drawSpicePile(ctx, 16, 12);
  await saveImage(canvas, 'objects', 'spice-pile.png');

  // Stone cross 16x24
  ({ canvas, ctx } = createCanvas16(16, 24));
  drawStoneCross(ctx, 16, 24);
  await saveImage(canvas, 'objects', 'stone-cross.png');

  // Rope coil 14x10
  ({ canvas, ctx } = createCanvas16(14, 10));
  drawRopeCoil(ctx, 14, 10);
  await saveImage(canvas, 'objects', 'rope-coil.png');

  // Ship mast 16x48
  ({ canvas, ctx } = createCanvas16(16, 48));
  drawShipMast(ctx, 16, 48);
  await saveImage(canvas, 'objects', 'ship-mast.png');

  // Fishing net 20x16
  ({ canvas, ctx } = createCanvas16(20, 16));
  drawFishingNet(ctx, 20, 16);
  await saveImage(canvas, 'objects', 'fishing-net.png');

  // Dhow sail 24x32
  ({ canvas, ctx } = createCanvas16(24, 32));
  drawDhowSail(ctx, 24, 32);
  await saveImage(canvas, 'objects', 'dhow-sail.png');

  // Cargo crate 20x18
  ({ canvas, ctx } = createCanvas16(20, 18));
  drawCargoCrate(ctx, 20, 18);
  await saveImage(canvas, 'objects', 'cargo-crate.png');

  // Maritime barrel 14x18
  ({ canvas, ctx } = createCanvas16(14, 18));
  drawMaritimeBarrel(ctx, 14, 18);
  await saveImage(canvas, 'objects', 'maritime-barrel.png');

  console.log('\n✓ All tiles and objects generated!');
}

main().catch(console.error);

