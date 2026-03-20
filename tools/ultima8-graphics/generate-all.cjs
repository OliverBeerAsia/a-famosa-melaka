/**
 * Ultima 8 Style Graphics Generator
 * 
 * Generates all game sprites with rich, atmospheric Ultima 8 quality
 * - 32x32 tiles with dithering and depth
 * - 24x48 character sprites with detailed shading
 * - Atmospheric objects
 * 
 * Run: node tools/ultima8-graphics/generate-all.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Import modules
const { PALETTE } = require('./palette.cjs');
const tiles = require('./tiles.cjs');
const characters = require('./characters.cjs');
const detailedObjects = require('./objects.cjs');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveCanvas(canvas, filepath) {
  const buffer = canvas.toBuffer('image/png');
  const dir = path.dirname(filepath);
  ensureDir(dir);
  fs.writeFileSync(filepath, buffer);
  console.log(`  ✓ ${path.basename(filepath)}`);
}

// Create a 32x32 tile, then also save a 16x16 version for compatibility
function createTile(drawFunc, name) {
  // Full 32x32 version
  const canvas32 = createCanvas(32, 32);
  const ctx32 = canvas32.getContext('2d');
  ctx32.imageSmoothingEnabled = false;
  ctx32.clearRect(0, 0, 32, 32);
  drawFunc(ctx32);
  
  // Scale down to 16x16 for the game (current maps expect 16x16)
  const canvas16 = createCanvas(16, 16);
  const ctx16 = canvas16.getContext('2d');
  ctx16.imageSmoothingEnabled = false;
  ctx16.drawImage(canvas32, 0, 0, 32, 32, 0, 0, 16, 16);
  
  saveCanvas(canvas16, path.join(OUTPUT_DIR, 'tiles', `${name}.png`));
}

// Create character sprite (24x48 scaled to 16x32 for compatibility)
function createCharacter(drawFunc, name) {
  const canvasFull = createCanvas(24, 48);
  const ctxFull = canvasFull.getContext('2d');
  ctxFull.imageSmoothingEnabled = false;
  ctxFull.clearRect(0, 0, 24, 48);
  drawFunc(ctxFull);
  
  // Scale to 16x32 for game compatibility
  const canvas = createCanvas(16, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvasFull, 0, 0, 24, 48, 0, 0, 16, 32);
  
  saveCanvas(canvas, path.join(OUTPUT_DIR, 'characters', `${name}.png`));
}

// Create sprite sheet (20 frames: 4 directions × 4 walk + 4 idle)
function createCharacterSheet(drawFunc, name) {
  const frameW = 16;
  const frameH = 32;
  const cols = 4;
  const rows = 5;
  
  const canvas = createCanvas(frameW * cols, frameH * rows);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Create base character
  const charCanvas = createCanvas(24, 48);
  const charCtx = charCanvas.getContext('2d');
  charCtx.imageSmoothingEnabled = false;
  drawFunc(charCtx);
  
  // Draw frames with slight variations for animation
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.save();
      
      // Add walking bounce for walk frames
      let offsetY = 0;
      if (row < 4) {
        offsetY = Math.abs(Math.sin(col * Math.PI / 2)) * 2;
      }
      
      ctx.drawImage(
        charCanvas, 
        0, 0, 24, 48,
        col * frameW, row * frameH + Math.floor(offsetY), frameW, frameH - Math.floor(offsetY)
      );
      ctx.restore();
    }
  }
  
  saveCanvas(canvas, path.join(OUTPUT_DIR, 'characters', `${name}-sheet.png`));
}

// Create detailed object sprites
function createObject(drawFunc, name, srcW, srcH, destW, destH) {
  const canvasSrc = createCanvas(srcW, srcH);
  const ctxSrc = canvasSrc.getContext('2d');
  ctxSrc.imageSmoothingEnabled = false;
  ctxSrc.clearRect(0, 0, srcW, srcH);
  drawFunc(ctxSrc);
  
  // Scale if needed
  if (destW !== srcW || destH !== srcH) {
    const canvasDest = createCanvas(destW, destH);
    const ctxDest = canvasDest.getContext('2d');
    ctxDest.imageSmoothingEnabled = false;
    ctxDest.drawImage(canvasSrc, 0, 0, srcW, srcH, 0, 0, destW, destH);
    saveCanvas(canvasDest, path.join(OUTPUT_DIR, 'objects', `${name}.png`));
  } else {
    saveCanvas(canvasSrc, path.join(OUTPUT_DIR, 'objects', `${name}.png`));
  }
}

// Additional tile drawing functions for compatibility
function drawGround(ctx) {
  const s = PALETTE.sand;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const noise = tiles.seededRandom(x, y, 99) * 2;
      const shade = 2 + noise;
      ctx.fillStyle = s[Math.floor(Math.max(0, Math.min(7, shade)))];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawStone(ctx) {
  tiles.drawCobblestone(ctx);
}

function drawWaterTile(ctx) {
  tiles.drawWater(ctx);
}

function drawDoorWood(ctx) {
  const w = PALETTE.wood;
  const m = PALETTE.stone;
  
  // Door frame
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      let shade = 4;
      if (x < 4 || x > 27) shade = 2; // Frame
      else if (y < 4) shade = 5; // Top
      else if (y > 27) shade = 2; // Bottom
      else {
        // Door panels
        const panelX = ((x - 4) % 12) / 12;
        const panelY = ((y - 4) % 12) / 12;
        shade = 3 + Math.sin(panelX * Math.PI) + Math.sin(panelY * Math.PI) * 0.5;
      }
      ctx.fillStyle = w[Math.floor(Math.max(0, Math.min(7, shade)))];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Door handle
  ctx.fillStyle = m[5];
  ctx.fillRect(22, 14, 3, 4);
  ctx.fillStyle = m[3];
  ctx.fillRect(23, 15, 2, 2);
}

// Simple object drawing functions
function drawSimpleObject(ctx, w, h, palette, shape = 'rect') {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let shade = 4;
      if (shape === 'rect') {
        if (y < 2) shade = 6;
        else if (x < 2) shade = 5;
        else if (y > h - 3) shade = 2;
        else if (x > w - 3) shade = 2;
      }
      ctx.fillStyle = palette[Math.floor(shade)];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawPalmTree(ctx) {
  const trunk = PALETTE.wood;
  const leaves = PALETTE.jungle;
  
  // Trunk
  for (let y = 20; y < 48; y++) {
    for (let x = 6; x < 10; x++) {
      const shade = x < 8 ? 5 : 3;
      ctx.fillStyle = trunk[shade];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  // Fronds
  const fronds = [[-5, -8], [-3, -10], [0, -12], [3, -10], [5, -8]];
  fronds.forEach(([dx, dy]) => {
    for (let i = 0; i < 8; i++) {
      const fx = 8 + Math.floor(dx * i / 8);
      const fy = 20 + Math.floor(dy * i / 8);
      ctx.fillStyle = leaves[i < 4 ? 5 : 4];
      ctx.fillRect(fx, fy, 2, 1);
    }
  });
}

function drawBarrel(ctx) {
  const w = PALETTE.wood;
  const m = PALETTE.stone;
  
  for (let y = 2; y < 18; y++) {
    const bulge = Math.sin((y - 2) / 16 * Math.PI) * 3;
    for (let x = Math.floor(5 - bulge); x <= Math.floor(10 + bulge); x++) {
      if (x >= 0 && x < 16) {
        const shade = x < 6 ? 5 : x > 9 ? 2 : 4;
        ctx.fillStyle = w[shade];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // Bands
  [5, 10, 15].forEach(by => {
    for (let x = 3; x < 13; x++) {
      ctx.fillStyle = m[4];
      ctx.fillRect(x, by, 1, 1);
    }
  });
}

function drawCrate(ctx) {
  drawSimpleObject(ctx, 16, 16, PALETTE.wood);
  // Planks
  for (let x = 0; x < 16; x++) {
    ctx.fillStyle = PALETTE.wood[2];
    ctx.fillRect(x, 5, 1, 1);
    ctx.fillRect(x, 10, 1, 1);
  }
}

function drawPottery(ctx) {
  const c = PALETTE.terracotta;
  for (let y = 0; y < 24; y++) {
    const t = y / 24;
    const bulge = Math.sin(t * Math.PI) * 5;
    for (let x = Math.floor(8 - bulge); x <= Math.floor(7 + bulge); x++) {
      if (x >= 0 && x < 16) {
        const shade = x < 6 ? 6 : x > 9 ? 2 : 4;
        ctx.fillStyle = c[shade];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawLantern(ctx) {
  const m = PALETTE.stone;
  const g = PALETTE.gold;
  // Frame
  for (let y = 0; y < 16; y++) {
    ctx.fillStyle = m[4];
    ctx.fillRect(2, y, 1, 1);
    ctx.fillRect(5, y, 1, 1);
  }
  // Glass (glowing)
  for (let y = 3; y < 13; y++) {
    ctx.fillStyle = g[6];
    ctx.fillRect(3, y, 2, 1);
  }
}

function drawStoneCross(ctx) {
  const s = PALETTE.stone;
  // Vertical
  for (let y = 0; y < 32; y++) {
    for (let x = 5; x < 11; x++) {
      const shade = x < 7 ? 5 : x > 9 ? 2 : 4;
      ctx.fillStyle = s[shade];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Horizontal
  for (let y = 8; y < 14; y++) {
    for (let x = 0; x < 16; x++) {
      if (x < 5 || x > 10) {
        const shade = y < 10 ? 5 : 2;
        ctx.fillStyle = s[shade];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawBush(ctx) {
  const l = PALETTE.jungle;
  for (let y = 4; y < 16; y++) {
    const width = y < 10 ? (y - 4) * 1.5 : (16 - y) * 2;
    for (let x = Math.floor(8 - width); x <= Math.floor(7 + width); x++) {
      if (x >= 0 && x < 16) {
        const noise = tiles.seededRandom(x, y, 55);
        ctx.fillStyle = l[Math.floor(3 + noise * 3)];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawFlowers(ctx) {
  const s = PALETTE.grass;
  // Stems and base
  for (let y = 8; y < 16; y++) {
    ctx.fillStyle = s[4];
    ctx.fillRect(4, y, 1, 1);
    ctx.fillRect(8, y, 1, 1);
    ctx.fillRect(12, y, 1, 1);
  }
  // Flowers
  ctx.fillStyle = PALETTE.clothRed[5];
  ctx.fillRect(3, 6, 3, 2);
  ctx.fillStyle = PALETTE.gold[6];
  ctx.fillRect(7, 4, 3, 2);
  ctx.fillStyle = PALETTE.clothSilk[5];
  ctx.fillRect(11, 7, 3, 2);
}

console.log('🎨 Generating Ultima 8 Style Graphics\n');
console.log('━'.repeat(50));

// Generate Tiles
console.log('\n📦 TILES (32x32 → 16x16):');
createTile(tiles.drawCobblestone, 'cobblestone');
createTile(tiles.drawGrass, 'grass');
createTile(tiles.drawFortressStone, 'fortress-stone');
createTile(tiles.drawWater, 'water');
createTile(tiles.drawDockWood, 'dock-wood');
createTile(tiles.drawWhitewashWall, 'wall-white');
createTile(tiles.drawTerracottaRoof, 'roof-terracotta');
createTile(tiles.drawDirtPath, 'dirt-path');
createTile(tiles.drawThatchRoof, 'thatch-roof');
createTile(tiles.drawBambooFloor, 'bamboo-floor');
createTile(tiles.drawChurchFloor, 'church-floor');
createTile(tiles.drawChurchStone, 'church-stone');
createTile(drawStone, 'stone');
createTile(drawGround, 'ground');
createTile(drawWaterTile, 'water-tile');
createTile(drawDoorWood, 'door-wood');
// Cobblestone variants
createTile(tiles.drawCobblestoneV1, 'cobblestone-v1');
createTile(tiles.drawCobblestoneV2, 'cobblestone-v2');
createTile(tiles.drawCobblestoneV3, 'cobblestone-v3');
// Edge transitions
createTile(tiles.drawCobblestoneToGrassH, 'cobblestone-grass-h');
createTile(tiles.drawCobblestoneToGrassV, 'cobblestone-grass-v');
createTile(tiles.drawCobblestoneToDirtH, 'cobblestone-dirt-h');
createTile(tiles.drawCobblestoneToDirtV, 'cobblestone-dirt-v');
// Animated water frames
createTile(tiles.drawWaterFrame0, 'water-frame-0');
createTile(tiles.drawWaterFrame1, 'water-frame-1');
createTile(tiles.drawWaterFrame2, 'water-frame-2');
// Laterite stone (historical A Famosa correction)
createTile(tiles.drawLateriteStone, 'laterite-stone');

// Tile variants (art elevation pass)
createTile(tiles.drawGrassV1, 'grass-v1');
createTile(tiles.drawGrassV2, 'grass-v2');
createTile(tiles.drawFortressStoneV1, 'fortress-stone-v1');
createTile(tiles.drawFortressStoneV2, 'fortress-stone-v2');
createTile(tiles.drawWhitewashWallV1, 'wall-white-v1');
createTile(tiles.drawWhitewashWallV2, 'wall-white-v2');
createTile(tiles.drawDirtPathV1, 'dirt-path-v1');
createTile(tiles.drawDirtPathV2, 'dirt-path-v2');
createTile(tiles.drawDockWoodV1, 'dock-wood-v1');
createTile(tiles.drawDockWoodV2, 'dock-wood-v2');
createTile(tiles.drawChurchFloorV1, 'church-floor-v1');
createTile(tiles.drawChurchFloorV2, 'church-floor-v2');
// New tile transitions
createTile(tiles.drawGrassToSandH, 'grass-sand-h');
createTile(tiles.drawGrassToSandV, 'grass-sand-v');
createTile(tiles.drawDirtToGrassH, 'dirt-grass-h');
createTile(tiles.drawDirtToGrassV, 'dirt-grass-v');
createTile(tiles.drawCobblestoneToWaterH, 'cobblestone-water-h');
createTile(tiles.drawCobblestoneToWaterV, 'cobblestone-water-v');
createTile(tiles.drawFortressToCobbH, 'fortress-cobblestone-h');
createTile(tiles.drawFortressToCobbV, 'fortress-cobblestone-v');
// 4th water animation frame
createTile(tiles.drawWaterFrame3, 'water-frame-3');

// Generate Characters (static sprites only — sheets are generated by generate-character-sheets-v2.cjs)
console.log('\n👤 CHARACTERS (24x48 → 16x32 static):');
createCharacter(characters.drawPlayer, 'player');
createCharacter(characters.drawFernaoGomes, 'fernao-gomes');
createCharacter(characters.drawCapitaoRodrigues, 'capitao-rodrigues');
createCharacter(characters.drawPadreTomas, 'padre-tomas');
createCharacter(characters.drawAminah, 'aminah');
createCharacter(characters.drawChenWei, 'chen-wei');
createCharacter(characters.drawRashid, 'rashid');
createCharacter(characters.drawSiti, 'siti');
createCharacter(characters.drawAlvares, 'alvares');
createCharacter(characters.drawMakEnang, 'mak-enang');
// Indian crowd sprite (historical accuracy)
if (characters.drawCrowdIndian) {
  createCharacter(characters.drawCrowdIndian, 'crowd-indian');
}
// Generic NPC
createCharacter(characters.drawAminah, 'npc');

// Crowd sprites (saved to crowd/ directory)
console.log('\n👥 CROWD SPRITES:');
function createCrowdSprite(drawFunc, name) {
  const canvasFull = createCanvas(24, 48);
  const ctxFull = canvasFull.getContext('2d');
  ctxFull.imageSmoothingEnabled = false;
  ctxFull.clearRect(0, 0, 24, 48);
  drawFunc(ctxFull);
  const canvas = createCanvas(16, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvasFull, 0, 0, 24, 48, 0, 0, 16, 32);
  saveCanvas(canvas, path.join(OUTPUT_DIR, 'crowd', `${name}.png`));
}
if (characters.drawCrowdIndian) {
  createCrowdSprite(characters.drawCrowdIndian, 'indian');
}

// Generate Objects (detailed versions from objects.cjs)
console.log('\n🏺 OBJECTS (detailed):');
createObject(detailedObjects.drawPalmTree, 'palm-tree', 16, 48, 16, 48);
createObject(detailedObjects.drawMarketStall, 'market-stall', 32, 32, 32, 32);
createObject(detailedObjects.drawBarrel, 'barrel', 16, 20, 16, 20);
createObject(detailedObjects.drawCrate, 'crate', 16, 16, 16, 16);
createObject(detailedObjects.drawPottery, 'pottery', 16, 24, 16, 24);
createObject(detailedObjects.drawLantern, 'lantern', 8, 16, 8, 16);
createObject(detailedObjects.drawStoneCross, 'stone-cross', 16, 32, 16, 32);
createObject(detailedObjects.drawFishingNet, 'fishing-net', 16, 16, 16, 16);
createObject(detailedObjects.drawAnchor, 'anchor', 16, 24, 16, 24);
createObject(detailedObjects.drawWovenMat, 'woven-mat', 16, 8, 16, 8);
createObject(detailedObjects.drawCookingFire, 'cooking-fire', 16, 16, 16, 16);
// New historical objects
createObject(detailedObjects.drawBetelNutTray, 'betel-nut-tray', 16, 12, 16, 12);
createObject(detailedObjects.drawTinIngots, 'tin-ingots', 16, 16, 16, 16);
createObject(detailedObjects.drawBalanceScale, 'balance-scale', 16, 20, 16, 20);
createObject(detailedObjects.drawRiceMortar, 'rice-mortar', 16, 16, 16, 16);
createObject(detailedObjects.drawFishTrap, 'fish-trap', 16, 20, 16, 20);
createObject(detailedObjects.drawPrayerMat, 'prayer-mat', 16, 10, 16, 10);
createObject(detailedObjects.drawCannon, 'cannon', 32, 16, 32, 16);
// Simplified fallback versions
createObject(drawBush, 'bush', 16, 16, 16, 16);
createObject(drawFlowers, 'flowers', 16, 16, 16, 16);

// Maritime barrel (uses existing drawBarrel from objects.cjs)
createObject(detailedObjects.drawBarrel, 'maritime-barrel', 16, 20, 16, 20);

// Sprint 1B - HIGH priority detailed objects
createObject(detailedObjects.drawMarketStall1, 'market-stall-1', 32, 32, 32, 32);
createObject(detailedObjects.drawMarketStall2, 'market-stall-2', 32, 32, 32, 32);
createObject(detailedObjects.drawTavernSign, 'tavern-sign', 16, 16, 16, 16);
createObject(detailedObjects.drawAwning, 'awning', 16, 16, 16, 16);
createObject(detailedObjects.drawHangingCloth, 'hanging-cloth', 16, 16, 16, 16);
createObject(detailedObjects.drawSpicePile, 'spice-pile', 16, 16, 16, 16);
createObject(detailedObjects.drawGravestone, 'gravestone', 16, 16, 16, 16);
createObject(detailedObjects.drawAltar, 'altar', 16, 16, 16, 16);
createObject(detailedObjects.drawWoodenPew, 'wooden-pew', 16, 16, 16, 16);
createObject(detailedObjects.drawDhowSail, 'dhow-sail', 16, 32, 16, 32);
createObject(detailedObjects.drawShipMast, 'ship-mast', 16, 32, 16, 32);
createObject(detailedObjects.drawBambooFence, 'bamboo-fence', 16, 16, 16, 16);

// Sprint 1C - MEDIUM priority detailed objects
createObject(detailedObjects.drawBell, 'bell', 16, 16, 16, 16);
createObject(detailedObjects.drawSack, 'sack', 16, 16, 16, 16);
createObject(detailedObjects.drawAmphora, 'amphora', 16, 24, 16, 24);
createObject(detailedObjects.drawRopeCoil, 'rope-coil', 16, 16, 16, 16);
createObject(detailedObjects.drawCargoCrate, 'cargo-crate', 16, 16, 16, 16);
createObject(detailedObjects.drawArchedWindow, 'arched-window', 16, 16, 16, 16);
createObject(detailedObjects.drawWaterWell, 'water-well', 16, 32, 16, 32);
createObject(detailedObjects.drawBananaTree, 'banana-tree', 16, 48, 16, 48);
createObject(detailedObjects.drawCoconut, 'coconut', 16, 16, 16, 16);
createObject(detailedObjects.drawHangingOilLantern, 'hanging-oil-lantern', 16, 16, 16, 16);
createObject(detailedObjects.drawDryingFishRack, 'drying-fish-rack', 16, 16, 16, 16);
createObject(detailedObjects.drawLaundryLine, 'laundry-line', 16, 16, 16, 16);
createObject(detailedObjects.drawMooredSampan, 'moored-sampan', 16, 16, 16, 16);

// Art elevation pass - 15 new object sprites
console.log('\n🎨 NEW OBJECTS (art elevation):');
createObject(detailedObjects.drawFruitBasket, 'fruit-basket', 16, 16, 16, 16);
createObject(detailedObjects.drawCoconutWaterStand, 'coconut-water-stand', 16, 24, 16, 24);
createObject(detailedObjects.drawBench, 'bench', 32, 16, 32, 16);
createObject(detailedObjects.drawWineJug, 'wine-jug', 8, 16, 8, 16);
createObject(detailedObjects.drawSugarCone, 'sugar-cone', 16, 16, 16, 16);
createObject(detailedObjects.drawHandcart, 'handcart', 32, 16, 32, 16);
createObject(detailedObjects.drawPelourinho, 'pelourinho', 16, 32, 16, 32);
createObject(detailedObjects.drawCandelabra, 'candelabra', 8, 16, 8, 16);
createObject(detailedObjects.drawIronFence, 'iron-fence', 16, 16, 16, 16);
createObject(detailedObjects.drawScrollRack, 'scroll-rack', 16, 24, 16, 24);
createObject(detailedObjects.drawFishBasket, 'fish-basket', 16, 16, 16, 16);
createObject(detailedObjects.drawHerbDryingRack, 'herb-drying-rack', 16, 24, 16, 24);
createObject(detailedObjects.drawRicePot, 'rice-pot', 16, 16, 16, 16);
createObject(detailedObjects.drawWayangKulitPuppet, 'wayang-kulit-puppet', 16, 24, 16, 24);
createObject(detailedObjects.drawSpicePilePepper, 'spice-pile-pepper', 16, 16, 16, 16);

console.log('\n' + '━'.repeat(50));
console.log('✅ All Ultima 8 style graphics generated!');
console.log('\nGraphics created with:');
console.log('  • Rich 8-shade color palettes');
console.log('  • Dithering for smooth gradients');
console.log('  • Detailed shading and texture');
console.log('\nRun "npm start" to see the new graphics in-game.');
