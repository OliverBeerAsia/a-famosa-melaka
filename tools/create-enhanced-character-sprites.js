/**
 * Enhanced Character Sprite Generator
 * 
 * Creates more detailed character sprites using pure JavaScript
 * without external dependencies.
 * 
 * Run: node tools/create-enhanced-character-sprites.js
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
    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    
    // IHDR chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type (RGBA)
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace
    
    const ihdrChunk = this.makeChunk('IHDR', ihdr);
    
    // IDAT chunk (image data)
    const rawData = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      rawData[y * (this.width * 4 + 1)] = 0; // filter byte
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
    
    // IEND chunk
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

// Parse hex color to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 128, g: 128, b: 128 };
}

// Character color palettes
const characters = {
  player: {
    hair: '#3D2314', skin: '#E8B796', shirt: '#5A4A3A',
    pants: '#3A3A4A', shoes: '#2A2A2A', accent: '#8B7355'
  },
  'fernao-gomes': {
    hair: '#1A1A1A', skin: '#D4A574', shirt: '#2A1A0A',
    pants: '#1A1A2A', shoes: '#1A1A1A', accent: '#FFD700',
    ruff: '#F5F5DC'
  },
  'capitao-rodrigues': {
    hair: '#3D2314', skin: '#D4A574', shirt: '#4A4A5A',
    pants: '#3A3A4A', shoes: '#2A2A2A', accent: '#C0C0C0',
    helmet: '#6A6A7A', sash: '#C41E3A'
  },
  'padre-tomas': {
    hair: '#5A4A3A', skin: '#E8B796', shirt: '#1A1A1A',
    pants: '#1A1A1A', shoes: '#2A2A2A', accent: '#FFFFFF'
  },
  aminah: {
    hair: '#1A1A1A', skin: '#C4956A', shirt: '#4A8B5A',
    pants: '#8B4A6A', shoes: '#8B7355', accent: '#FFD700',
    headscarf: '#E8B796'
  },
  'chen-wei': {
    hair: '#1A1A1A', skin: '#E8C896', shirt: '#1A3A5A',
    pants: '#1A2A3A', shoes: '#1A1A1A', accent: '#FFD700',
    cap: '#1A1A1A'
  },
  rashid: {
    hair: '#1A1A1A', skin: '#C4956A', shirt: '#F5F5DC',
    pants: '#5A4A3A', shoes: '#8B7355', accent: '#C41E3A',
    headwrap: '#F5F5DC'
  }
};

function drawCharacter(png, offsetX, offsetY, palette, charId) {
  const c = (colorName) => {
    const color = palette[colorName];
    return color ? hexToRgb(color) : { r: 128, g: 128, b: 128 };
  };

  // Shadow
  png.fillRect(offsetX + 3, offsetY + 28, 10, 3, 0, 0, 0, 80);

  // Feet/shoes
  const shoes = c('shoes');
  png.fillRect(offsetX + 4, offsetY + 26, 3, 4, shoes.r, shoes.g, shoes.b);
  png.fillRect(offsetX + 9, offsetY + 26, 3, 4, shoes.r, shoes.g, shoes.b);

  // Legs/pants
  const pants = c('pants');
  png.fillRect(offsetX + 4, offsetY + 18, 3, 8, pants.r, pants.g, pants.b);
  png.fillRect(offsetX + 9, offsetY + 18, 3, 8, pants.r, pants.g, pants.b);

  // Body/shirt
  const shirt = c('shirt');
  png.fillRect(offsetX + 3, offsetY + 10, 10, 10, shirt.r, shirt.g, shirt.b);
  
  // Arms
  png.fillRect(offsetX + 1, offsetY + 12, 2, 6, shirt.r, shirt.g, shirt.b);
  png.fillRect(offsetX + 13, offsetY + 12, 2, 6, shirt.r, shirt.g, shirt.b);

  // Belt/accent
  const accent = c('accent');
  png.fillRect(offsetX + 3, offsetY + 17, 10, 2, accent.r, accent.g, accent.b);

  // Head/skin
  const skin = c('skin');
  png.fillRect(offsetX + 4, offsetY + 2, 8, 8, skin.r, skin.g, skin.b);

  // Hair
  const hair = c('hair');
  png.fillRect(offsetX + 4, offsetY + 1, 8, 3, hair.r, hair.g, hair.b);
  png.fillRect(offsetX + 3, offsetY + 2, 2, 2, hair.r, hair.g, hair.b);
  png.fillRect(offsetX + 11, offsetY + 2, 2, 2, hair.r, hair.g, hair.b);

  // Eyes
  png.fillRect(offsetX + 5, offsetY + 5, 2, 2, 26, 26, 26);
  png.fillRect(offsetX + 9, offsetY + 5, 2, 2, 26, 26, 26);

  // Character-specific features
  if (charId === 'capitao-rodrigues') {
    const helmet = c('helmet');
    png.fillRect(offsetX + 3, offsetY, 10, 4, helmet.r, helmet.g, helmet.b);
    png.fillRect(offsetX + 5, offsetY - 1, 6, 2, helmet.r, helmet.g, helmet.b);
    const sash = c('sash');
    png.fillRect(offsetX + 3, offsetY + 10, 2, 8, sash.r, sash.g, sash.b);
  }

  if (charId === 'padre-tomas') {
    // Long black robe
    png.fillRect(offsetX + 3, offsetY + 18, 10, 12, shirt.r, shirt.g, shirt.b);
    // White collar
    png.fillRect(offsetX + 5, offsetY + 9, 6, 2, 255, 255, 255);
  }

  if (charId === 'fernao-gomes' && palette.ruff) {
    const ruff = c('ruff');
    png.fillRect(offsetX + 4, offsetY + 9, 8, 2, ruff.r, ruff.g, ruff.b);
  }

  if (charId === 'aminah' && palette.headscarf) {
    const scarf = c('headscarf');
    png.fillRect(offsetX + 3, offsetY + 1, 10, 3, scarf.r, scarf.g, scarf.b);
  }

  if (charId === 'chen-wei' && palette.cap) {
    const cap = c('cap');
    png.fillRect(offsetX + 4, offsetY, 8, 2, cap.r, cap.g, cap.b);
  }

  if (charId === 'rashid' && palette.headwrap) {
    const wrap = c('headwrap');
    png.fillRect(offsetX + 3, offsetY, 10, 4, wrap.r, wrap.g, wrap.b);
    png.fillRect(offsetX + 2, offsetY + 1, 2, 2, wrap.r, wrap.g, wrap.b);
    png.fillRect(offsetX + 12, offsetY + 1, 2, 2, wrap.r, wrap.g, wrap.b);
  }
}

function generateCharacterSprite(charId, palette) {
  // 16x32 sprite
  const png = new SimplePNG(16, 32);
  drawCharacter(png, 0, 0, palette, charId);
  return png.toBuffer();
}

function generateSpriteSheet(charId, palette) {
  // 4 frames x 5 rows = 64x160
  // Rows: walk-down, walk-left, walk-right, walk-up, idle
  const png = new SimplePNG(64, 160);
  
  // For simplicity, draw same pose in all frames (animation can be added later)
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      drawCharacter(png, col * 16, row * 32, palette, charId);
    }
  }
  
  return png.toBuffer();
}

// Main generation
function generate() {
  console.log('Generating enhanced character sprites...\n');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [charId, palette] of Object.entries(characters)) {
    // Generate single sprite (replacement for existing)
    const singleSprite = generateCharacterSprite(charId, palette);
    const singlePath = path.join(outputDir, `${charId}.png`);
    fs.writeFileSync(singlePath, singleSprite);
    console.log(`  ✓ ${charId}.png (16x32)`);

    // Generate sprite sheet for animations
    const spriteSheet = generateSpriteSheet(charId, palette);
    const sheetPath = path.join(outputDir, `${charId}-sheet.png`);
    fs.writeFileSync(sheetPath, spriteSheet);
    console.log(`  ✓ ${charId}-sheet.png (64x160)`);
  }

  // Also generate generic NPC
  const npcSprite = generateCharacterSprite('player', characters.player);
  fs.writeFileSync(path.join(outputDir, 'npc.png'), npcSprite);
  console.log(`  ✓ npc.png (16x32)`);

  console.log('\n✅ Character sprites generated!');
  console.log('\nSprite sheet layout (64x160):');
  console.log('- Row 0: Walk Down');
  console.log('- Row 1: Walk Left');
  console.log('- Row 2: Walk Right');
  console.log('- Row 3: Walk Up');
  console.log('- Row 4: Idle');
}

generate();

