/**
 * Detailed Character Sprite Generator for A Famosa
 *
 * Creates properly shaded, animated character sprites with cultural details
 * to match the detailed isometric environment.
 *
 * Features:
 * - 3-tone shading (light, mid, dark) for depth
 * - Proper proportions (3-head rule)
 * - Actual walking animation (4 frames per direction)
 * - Cultural-specific clothing and accessories
 * - Pixel-perfect 16x32 sprites
 *
 * Run: node tools/create-detailed-character-sprites.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outputDir = path.join(__dirname, '..', 'assets', 'sprites', 'characters');

// Simple PNG encoder
class SimplePNG {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  fillRect(x, y, w, h, r, g, b, a = 255) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setPixel(x + dx, y + dy, r, g, b, a);
      }
    }
  }

  toBuffer() {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const ihdrChunk = this.makeChunk('IHDR', ihdr);

    const rawData = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      rawData[y * (this.width * 4 + 1)] = 0;
      for (let x = 0; x < this.width; x++) {
        const srcI = (y * this.width + x) * 4;
        const dstI = y * (this.width * 4 + 1) + 1 + x * 4;
        rawData[dstI] = this.data[srcI];
        rawData[dstI + 1] = this.data[srcI + 1];
        rawData[dstI + 2] = this.data[srcI + 2];
        rawData[dstI + 3] = this.data[srcI + 3];
      }
    }

    const compressed = zlib.deflateSync(rawData);
    const idatChunk = this.makeChunk('IDAT', compressed);
    const iendChunk = this.makeChunk('IEND', Buffer.alloc(0));
    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  }

  makeChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = this.crc32(crcData);
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);
    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
  }

  crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
}

// Color utilities
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 128, g: 128, b: 128 };
}

// Create a shaded palette from base color
function createShades(baseHex) {
  const base = hexToRgb(baseHex);
  return {
    light: { r: Math.min(255, base.r + 40), g: Math.min(255, base.g + 40), b: Math.min(255, base.b + 40) },
    mid: base,
    dark: { r: Math.max(0, base.r - 40), g: Math.max(0, base.g - 40), b: Math.max(0, base.b - 40) }
  };
}

// Enhanced character palettes with cultural details
const characters = {
  player: {
    skin: createShades('#D9A066'),
    hair: createShades('#4A3020'),
    shirt: createShades('#6B5D4F'),
    pants: createShades('#4A4A5A'),
    shoes: createShades('#2A2520'),
    belt: createShades('#8B6F47')
  },
  'fernao-gomes': {
    skin: createShades('#D4A574'),
    hair: createShades('#3D2314'),
    doublet: createShades('#2D1A0F'),      // Dark Portuguese doublet
    pants: createShades('#1A1520'),
    shoes: createShades('#1A1A1A'),
    ruff: { light: {r:250,g:245,b:230}, mid: {r:245,g:240,b:220}, dark: {r:220,g:210,b:190} },
    gold: createShades('#D4AF37')
  },
  'capitao-rodrigues': {
    skin: createShades('#D4A574'),
    hair: createShades('#5A4530'),
    beard: createShades('#4A3520'),
    armor: createShades('#6B6B7B'),        // Steel breastplate
    tunic: createShades('#8B2635'),        // Red Portuguese tunic
    pants: createShades('#3A3A4A'),
    boots: createShades('#2A2520'),
    helmet: createShades('#7B7B8B')
  },
  'padre-tomas': {
    skin: createShades('#E8C4A0'),
    hair: createShades('#6B5D4F'),
    cassock: createShades('#1A1A1A'),      // Black Jesuit cassock
    collar: { light: {r:255,g:255,b:255}, mid: {r:250,g:250,b:250}, dark: {r:230,g:230,b:230} },
    cross: createShades('#C0C0C0'),
    rope: createShades('#8B7355')
  },
  aminah: {
    skin: createShades('#B8845F'),
    hair: createShades('#1A1515'),
    baju: createShades('#3A7A4A'),         // Green Malay baju kurung
    sarong: createShades('#7A3A5A'),       // Batik-patterned sarong
    shoes: createShades('#8B7355'),
    headscarf: createShades('#D4A574'),
    jewelry: createShades('#D4AF37')
  },
  'chen-wei': {
    skin: createShades('#E8D0A0'),
    hair: createShades('#1A1515'),
    changshan: createShades('#1A3555'),    // Blue Chinese changshan
    pants: createShades('#1A2530'),
    shoes: createShades('#1A1A1A'),
    cap: createShades('#1A1515'),
    trim: createShades('#D4AF37')          // Gold trim
  },
  rashid: {
    skin: createShades('#B8845F'),
    hair: createShades('#2A2520'),
    beard: createShades('#1A1515'),
    thobe: createShades('#F5F0E8'),        // White/cream thobe
    vest: createShades('#8B3535'),         // Red vest
    pants: createShades('#5A4A3A'),
    shoes: createShades('#8B7355'),
    turban: createShades('#F5F0E8'),
    sash: createShades('#C41E3A')
  }
};

// Draw a pixel with shading
function drawPixel(png, x, y, shade, alpha = 255) {
  png.setPixel(x, y, shade.r, shade.g, shade.b, alpha);
}

// Draw detailed character sprite
function drawDetailedCharacter(png, x, y, palette, charId, direction = 'down', frame = 0) {
  // Frame offset for walk animation (0-3)
  const walkOffset = frame % 2 === 0 ? 0 : (frame === 1 ? 1 : -1);

  // Shadow
  png.fillRect(x + 4, y + 30, 8, 2, 0, 0, 0, 60);

  // === FEET & LEGS ===
  const legY = y + 20;
  const leftLegX = x + 5;
  const rightLegX = x + 9;

  if (direction === 'down' || direction === 'up') {
    // Standing/walking forward - legs apart based on frame
    drawLeg(png, leftLegX + (frame === 1 ? -1 : frame === 3 ? 0 : 0), legY, palette, charId);
    drawLeg(png, rightLegX + (frame === 1 ? 0 : frame === 3 ? 1 : 0), legY, palette, charId);
  } else {
    // Side walking - one leg forward
    if (frame % 2 === 0) {
      drawLeg(png, leftLegX, legY, palette, charId);
      drawLeg(png, rightLegX, legY + 1, palette, charId);
    } else {
      drawLeg(png, leftLegX, legY + 1, palette, charId);
      drawLeg(png, rightLegX, legY, palette, charId);
    }
  }

  // === BODY/TORSO ===
  drawTorso(png, x, y, palette, charId);

  // === HEAD ===
  drawHead(png, x, y, palette, charId, direction);

  // === CHARACTER-SPECIFIC DETAILS ===
  addCharacterDetails(png, x, y, palette, charId);
}

function drawLeg(png, x, y, palette, charId) {
  const shoes = palette.shoes || palette.boots || { light: {r:60,g:50,b:40}, mid: {r:40,g:35,b:30}, dark: {r:30,g:25,b:20} };
  const pants = palette.pants || palette.sarong || palette.cassock || palette.thobe ||
                { light: {r:80,g:80,b:90}, mid: {r:60,g:60,b:70}, dark: {r:40,g:40,b:50} };

  // Pants (upper leg)
  drawPixel(png, x, y, pants.dark);
  drawPixel(png, x + 1, y, pants.mid);
  drawPixel(png, x + 2, y, pants.dark);
  drawPixel(png, x, y + 1, pants.mid);
  drawPixel(png, x + 1, y + 1, pants.light);
  drawPixel(png, x + 2, y + 1, pants.mid);

  // Lower leg
  drawPixel(png, x, y + 2, pants.dark);
  drawPixel(png, x + 1, y + 2, pants.mid);
  drawPixel(png, x + 2, y + 2, pants.dark);
  drawPixel(png, x, y + 3, pants.dark);
  drawPixel(png, x + 1, y + 3, pants.mid);
  drawPixel(png, x + 2, y + 3, pants.dark);

  // Shoes/boots
  drawPixel(png, x, y + 4, shoes.dark);
  drawPixel(png, x + 1, y + 4, shoes.mid);
  drawPixel(png, x + 2, y + 4, shoes.mid);
  drawPixel(png, x, y + 5, shoes.dark);
  drawPixel(png, x + 1, y + 5, shoes.mid);
  drawPixel(png, x + 2, y + 5, shoes.dark);
  drawPixel(png, x + 3, y + 5, shoes.dark);
}

function drawTorso(png, x, y, palette, charId) {
  const bodyY = y + 11;
  const shirt = palette.shirt || palette.doublet || palette.armor || palette.cassock ||
                palette.baju || palette.changshan || palette.thobe;

  // Main torso (9 pixels wide, 9 pixels tall)
  for (let dy = 0; dy < 9; dy++) {
    for (let dx = 0; dx < 9; dx++) {
      const px = x + 3 + dx;
      const py = bodyY + dy;

      // Add depth shading
      if (dx === 0 || dx === 8) {
        drawPixel(png, px, py, shirt.dark);
      } else if (dx === 1 || dx === 7) {
        drawPixel(png, px, py, shirt.mid);
      } else if (dx >= 2 && dx <= 4) {
        drawPixel(png, px, py, shirt.light);
      } else {
        drawPixel(png, px, py, shirt.mid);
      }
    }
  }

  // Belt/sash
  const belt = palette.belt || palette.sash || shirt;
  for (let dx = 0; dx < 9; dx++) {
    const px = x + 3 + dx;
    drawPixel(png, px, bodyY + 8, belt.dark);
  }
}

function drawHead(png, x, y, palette, charId, direction) {
  const headY = y + 2;
  const skin = palette.skin;

  // Head (9x9 oval shape)
  const headPixels = [
    [0,0,0,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,0,0,0]
  ];

  for (let dy = 0; dy < 9; dy++) {
    for (let dx = 0; dx < 9; dx++) {
      if (headPixels[dy][dx]) {
        const px = x + 3 + dx;
        const py = headY + dy;

        // Shading: left side lighter
        if (dx <= 3) {
          drawPixel(png, px, py, skin.light);
        } else if (dx <= 5) {
          drawPixel(png, px, py, skin.mid);
        } else {
          drawPixel(png, px, py, skin.dark);
        }
      }
    }
  }

  // Hair
  const hair = palette.hair;
  const hairPixels = [
    [0,0,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1],
    [1,1,0,0,0,0,0,1,1]
  ];

  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 9; dx++) {
      if (hairPixels[dy][dx]) {
        const px = x + 3 + dx;
        const py = headY + dy;
        drawPixel(png, px, py, dx < 4 ? hair.mid : hair.dark);
      }
    }
  }

  // Eyes (simple dots)
  if (direction === 'down') {
    drawPixel(png, x + 5, y + 6, {r: 40, g: 30, b: 20});
    drawPixel(png, x + 9, y + 6, {r: 40, g: 30, b: 20});
  } else if (direction === 'left') {
    drawPixel(png, x + 5, y + 6, {r: 40, g: 30, b: 20});
  } else if (direction === 'right') {
    drawPixel(png, x + 9, y + 6, {r: 40, g: 30, b: 20});
  }
}

function addCharacterDetails(png, x, y, palette, charId) {
  // Fernão Gomes - Portuguese ruff collar
  if (charId === 'fernao-gomes' && palette.ruff) {
    for (let dx = 0; dx < 10; dx++) {
      drawPixel(png, x + 3 + dx, y + 10, palette.ruff.light);
      if (dx % 2 === 0) {
        drawPixel(png, x + 3 + dx, y + 9, palette.ruff.mid);
      }
    }
    // Gold chain
    for (let dx = 3; dx <= 9; dx++) {
      if (dx % 2 === 0) {
        drawPixel(png, x + dx, y + 12, palette.gold.mid);
      }
    }
  }

  // Capitão Rodrigues - helmet
  if (charId === 'capitao-rodrigues' && palette.helmet) {
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 9; dx++) {
        const px = x + 3 + dx;
        const shade = dx < 4 ? palette.helmet.light : palette.helmet.mid;
        drawPixel(png, px, y + dy, shade);
      }
    }
    // Plume
    drawPixel(png, x + 7, y - 1, {r: 200, g: 50, b: 50});
    drawPixel(png, x + 7, y, {r: 180, g: 40, b: 40});
  }

  // Padre Tomás - white collar and cross
  if (charId === 'padre-tomas' && palette.collar) {
    for (let dx = 3; dx <= 9; dx++) {
      drawPixel(png, x + dx, y + 10, palette.collar.light);
      drawPixel(png, x + dx, y + 11, palette.collar.mid);
    }
    // Cross
    drawPixel(png, x + 6, y + 13, palette.cross.light);
    drawPixel(png, x + 6, y + 14, palette.cross.mid);
    drawPixel(png, x + 5, y + 14, palette.cross.mid);
    drawPixel(png, x + 7, y + 14, palette.cross.mid);
  }

  // Aminah - headscarf
  if (charId === 'aminah' && palette.headscarf) {
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 10; dx++) {
        if (dy < 2 || dx < 2 || dx > 7) {
          const px = x + 3 + dx;
          const py = y + dy;
          drawPixel(png, px, py, palette.headscarf.mid);
        }
      }
    }
    // Gold earring
    drawPixel(png, x + 4, y + 7, palette.jewelry.mid);
  }

  // Chen Wei - cap with button
  if (charId === 'chen-wei' && palette.cap) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 1; dx <= 7; dx++) {
        drawPixel(png, x + 3 + dx, y + dy, palette.cap.dark);
      }
    }
    drawPixel(png, x + 6, y, palette.trim.mid); // Button
    // Trim on collar
    for (let dx = 3; dx <= 9; dx++) {
      drawPixel(png, x + dx, y + 11, palette.trim.dark);
    }
  }

  // Rashid - turban and beard
  if (charId === 'rashid') {
    // Turban
    if (palette.turban) {
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 10; dx++) {
          const px = x + 3 + dx;
          const py = y + dy;
          drawPixel(png, px, py, palette.turban.mid);
        }
      }
      // Turban fold
      for (let dx = 0; dx < 3; dx++) {
        drawPixel(png, x + 10 + dx, y + 1, palette.turban.dark);
      }
    }
    // Beard
    if (palette.beard) {
      drawPixel(png, x + 4, y + 8, palette.beard.dark);
      drawPixel(png, x + 5, y + 8, palette.beard.mid);
      drawPixel(png, x + 6, y + 8, palette.beard.mid);
      drawPixel(png, x + 7, y + 8, palette.beard.mid);
      drawPixel(png, x + 8, y + 8, palette.beard.dark);
      drawPixel(png, x + 5, y + 9, palette.beard.mid);
      drawPixel(png, x + 6, y + 9, palette.beard.dark);
      drawPixel(png, x + 7, y + 9, palette.beard.mid);
    }
  }
}

function generateSpriteSheet(charId, palette) {
  // 4 frames x 5 rows (down, left, right, up, idle) = 64x160
  const png = new SimplePNG(64, 160);

  const directions = ['down', 'left', 'right', 'up', 'down']; // last row is idle (down)

  for (let row = 0; row < 5; row++) {
    const direction = directions[row];
    const isIdle = row === 4;

    for (let col = 0; col < 4; col++) {
      const frame = isIdle ? 0 : col; // Idle uses frame 0 only
      drawDetailedCharacter(png, col * 16, row * 32, palette, charId, direction, frame);
    }
  }

  return png.toBuffer();
}

function generateCharacterSprite(charId, palette) {
  const png = new SimplePNG(16, 32);
  drawDetailedCharacter(png, 0, 0, palette, charId, 'down', 0);
  return png.toBuffer();
}

// Main generation
function generate() {
  console.log('🎨 Generating detailed character sprites...\n');
  console.log('Features:');
  console.log('  • 3-tone shading for depth');
  console.log('  • Cultural-specific clothing details');
  console.log('  • 4-frame walk animations');
  console.log('  • Proper proportions (16x32)\n');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [charId, palette] of Object.entries(characters)) {
    // Generate single sprite
    const singleSprite = generateCharacterSprite(charId, palette);
    const singlePath = path.join(outputDir, `${charId}.png`);
    fs.writeFileSync(singlePath, singleSprite);
    console.log(`  ✓ ${charId}.png`);

    // Generate sprite sheet
    const spriteSheet = generateSpriteSheet(charId, palette);
    const sheetPath = path.join(outputDir, `${charId}-sheet.png`);
    fs.writeFileSync(sheetPath, spriteSheet);
    console.log(`  ✓ ${charId}-sheet.png (animated)`);
  }

  // Generic NPC
  const npcSprite = generateCharacterSprite('player', characters.player);
  fs.writeFileSync(path.join(outputDir, 'npc.png'), npcSprite);
  console.log(`  ✓ npc.png\n`);

  console.log('✅ Detailed character sprites generated!');
  console.log('\nCultural details added:');
  console.log('  • Fernão Gomes: Portuguese ruff collar, gold chain');
  console.log('  • Capitão Rodrigues: Steel helmet with red plume');
  console.log('  • Padre Tomás: Black cassock, white collar, silver cross');
  console.log('  • Aminah: Malay headscarf, batik sarong, gold earring');
  console.log('  • Chen Wei: Chinese cap with button, gold trim');
  console.log('  • Rashid: Arab turban, beard, white thobe, red vest\n');
}

generate();
