/**
 * Animated Sprite Generator
 * 
 * Creates sprite sheets for player and NPC animations:
 * - 4-directional walk cycles (4 frames each)
 * - Idle animations
 * - Character-specific color palettes
 * 
 * Run: node tools/create-animated-sprites.js
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'assets', 'sprites', 'characters');

// Character definitions with color palettes
const characters = {
  player: {
    name: 'Player',
    // Neutral traveler colors
    hair: '#3D2314',
    skin: '#E8B796',
    shirt: '#5A4A3A',
    pants: '#3A3A4A',
    shoes: '#2A2A2A',
    accent: '#8B7355'
  },
  'fernao-gomes': {
    name: 'Fernão Gomes',
    // Portuguese merchant - rich dark clothing with gold accents
    hair: '#1A1A1A',
    skin: '#D4A574',
    shirt: '#2A1A0A',  // Dark doublet
    pants: '#1A1A2A',
    shoes: '#1A1A1A',
    accent: '#FFD700',  // Gold trim
    hat: '#2A1A0A',
    ruff: '#F5F5DC'  // Collar ruff
  },
  'capitao-rodrigues': {
    name: 'Capitão Rodrigues',
    // Portuguese soldier - armor and helmet
    hair: '#3D2314',
    skin: '#D4A574',
    shirt: '#4A4A5A',  // Steel breastplate
    pants: '#3A3A4A',
    shoes: '#2A2A2A',
    accent: '#C0C0C0',  // Steel
    helmet: '#6A6A7A',  // Morion helmet
    sash: '#C41E3A'  // Red sash
  },
  'padre-tomas': {
    name: 'Padre Tomás',
    // Jesuit priest - black robes
    hair: '#5A4A3A',
    skin: '#E8B796',
    shirt: '#1A1A1A',  // Black cassock
    pants: '#1A1A1A',
    shoes: '#2A2A2A',
    accent: '#FFFFFF',  // White collar
    robe: '#1A1A1A'
  },
  aminah: {
    name: 'Aminah',
    // Malay woman - colorful sarong and kebaya
    hair: '#1A1A1A',
    skin: '#C4956A',
    shirt: '#4A8B5A',  // Green kebaya
    pants: '#8B4A6A',  // Batik sarong
    shoes: '#8B7355',
    accent: '#FFD700',
    headscarf: '#E8B796'
  },
  'chen-wei': {
    name: 'Chen Wei',
    // Chinese merchant - changshan robe
    hair: '#1A1A1A',
    skin: '#E8C896',
    shirt: '#1A3A5A',  // Blue changshan
    pants: '#1A2A3A',
    shoes: '#1A1A1A',
    accent: '#FFD700',
    cap: '#1A1A1A'
  },
  rashid: {
    name: 'Rashid',
    // Arab sailor - loose clothing, headwrap
    hair: '#1A1A1A',
    skin: '#C4956A',
    shirt: '#F5F5DC',  // White loose shirt
    pants: '#5A4A3A',
    shoes: '#8B7355',
    accent: '#C41E3A',
    headwrap: '#F5F5DC'
  }
};

// Frame dimensions
const FRAME_WIDTH = 16;
const FRAME_HEIGHT = 32;
const FRAMES_PER_DIRECTION = 4;
const DIRECTIONS = 4; // down, left, right, up

/**
 * Draw a character frame
 */
function drawCharacterFrame(ctx, x, y, character, direction, frame, isWalking) {
  const palette = characters[character];
  
  // Calculate walk cycle offset
  const walkOffset = isWalking ? Math.sin(frame * Math.PI / 2) * 1 : 0;
  const bobOffset = isWalking ? Math.abs(Math.sin(frame * Math.PI / 2)) * 1 : 0;
  
  // Leg animation offset
  const leftLegOffset = isWalking ? Math.sin(frame * Math.PI / 2) * 2 : 0;
  const rightLegOffset = isWalking ? -Math.sin(frame * Math.PI / 2) * 2 : 0;
  
  // Base position
  const baseX = x;
  const baseY = y - bobOffset;
  
  // Draw shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(baseX + 3, y + 28, 10, 3);
  
  // Draw based on direction
  switch (direction) {
    case 0: // Down (facing camera)
      drawCharacterDown(ctx, baseX, baseY, palette, leftLegOffset, rightLegOffset, character);
      break;
    case 1: // Left
      drawCharacterSide(ctx, baseX, baseY, palette, leftLegOffset, true, character);
      break;
    case 2: // Right
      drawCharacterSide(ctx, baseX, baseY, palette, leftLegOffset, false, character);
      break;
    case 3: // Up (back to camera)
      drawCharacterUp(ctx, baseX, baseY, palette, leftLegOffset, rightLegOffset, character);
      break;
  }
}

function drawCharacterDown(ctx, x, y, palette, leftLeg, rightLeg, charId) {
  // Shoes/feet with walking animation
  ctx.fillStyle = palette.shoes;
  ctx.fillRect(x + 4, y + 26 + leftLeg, 3, 4);
  ctx.fillRect(x + 9, y + 26 + rightLeg, 3, 4);
  
  // Pants/legs
  ctx.fillStyle = palette.pants;
  ctx.fillRect(x + 4, y + 18, 3, 8 + leftLeg);
  ctx.fillRect(x + 9, y + 18, 3, 8 + rightLeg);
  
  // Body/shirt
  ctx.fillStyle = palette.shirt;
  ctx.fillRect(x + 3, y + 10, 10, 10);
  
  // Arms
  ctx.fillRect(x + 1, y + 12, 2, 6);
  ctx.fillRect(x + 13, y + 12, 2, 6);
  
  // Accent (belt or trim)
  ctx.fillStyle = palette.accent;
  ctx.fillRect(x + 3, y + 17, 10, 2);
  
  // Head/face
  ctx.fillStyle = palette.skin;
  ctx.fillRect(x + 4, y + 2, 8, 8);
  
  // Hair
  ctx.fillStyle = palette.hair;
  ctx.fillRect(x + 4, y + 1, 8, 3);
  ctx.fillRect(x + 3, y + 2, 2, 2);
  ctx.fillRect(x + 11, y + 2, 2, 2);
  
  // Eyes
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(x + 5, y + 5, 2, 2);
  ctx.fillRect(x + 9, y + 5, 2, 2);
  
  // Special character features
  if (charId === 'capitao-rodrigues') {
    // Morion helmet
    ctx.fillStyle = palette.helmet;
    ctx.fillRect(x + 3, y, 10, 4);
    ctx.fillRect(x + 5, y - 1, 6, 2);
    // Red sash
    ctx.fillStyle = palette.sash;
    ctx.fillRect(x + 3, y + 10, 2, 8);
  }
  
  if (charId === 'padre-tomas') {
    // Cassock extends down
    ctx.fillStyle = palette.robe;
    ctx.fillRect(x + 3, y + 10, 10, 18);
    // White collar
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + 5, y + 9, 6, 2);
  }
  
  if (charId === 'fernao-gomes' && palette.ruff) {
    // Ruff collar
    ctx.fillStyle = palette.ruff;
    ctx.fillRect(x + 4, y + 9, 8, 2);
  }
  
  if (charId === 'aminah' && palette.headscarf) {
    // Headscarf
    ctx.fillStyle = palette.headscarf;
    ctx.fillRect(x + 3, y + 1, 10, 3);
  }
  
  if (charId === 'chen-wei' && palette.cap) {
    // Chinese cap
    ctx.fillStyle = palette.cap;
    ctx.fillRect(x + 4, y, 8, 2);
  }
  
  if (charId === 'rashid' && palette.headwrap) {
    // Headwrap/turban
    ctx.fillStyle = palette.headwrap;
    ctx.fillRect(x + 3, y, 10, 4);
    ctx.fillRect(x + 2, y + 1, 2, 2);
    ctx.fillRect(x + 12, y + 1, 2, 2);
  }
}

function drawCharacterSide(ctx, x, y, palette, legOffset, facingLeft, charId) {
  const flip = facingLeft ? 0 : 1;
  
  // Feet with walking animation
  ctx.fillStyle = palette.shoes;
  ctx.fillRect(x + 5 + flip * 2, y + 26 + legOffset, 4, 4);
  ctx.fillRect(x + 7 - flip * 2, y + 26 - legOffset, 4, 4);
  
  // Legs
  ctx.fillStyle = palette.pants;
  ctx.fillRect(x + 6, y + 18, 4, 8 + legOffset);
  
  // Body
  ctx.fillStyle = palette.shirt;
  ctx.fillRect(x + 4, y + 10, 8, 10);
  
  // Arm (visible on one side)
  ctx.fillRect(x + (facingLeft ? 10 : 2), y + 12, 2, 6);
  
  // Accent
  ctx.fillStyle = palette.accent;
  ctx.fillRect(x + 4, y + 17, 8, 2);
  
  // Head
  ctx.fillStyle = palette.skin;
  ctx.fillRect(x + 5, y + 2, 6, 8);
  
  // Hair (side view)
  ctx.fillStyle = palette.hair;
  ctx.fillRect(x + 5, y + 1, 6, 3);
  ctx.fillRect(x + (facingLeft ? 9 : 5), y + 2, 2, 4);
  
  // Eye (one visible)
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(x + (facingLeft ? 6 : 9), y + 5, 2, 2);
  
  // Character-specific features
  if (charId === 'capitao-rodrigues') {
    ctx.fillStyle = palette.helmet;
    ctx.fillRect(x + 4, y, 8, 4);
    ctx.fillStyle = palette.sash;
    ctx.fillRect(x + 4, y + 10, 2, 8);
  }
  
  if (charId === 'padre-tomas') {
    ctx.fillStyle = palette.robe;
    ctx.fillRect(x + 4, y + 10, 8, 18);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + 5, y + 9, 6, 2);
  }
}

function drawCharacterUp(ctx, x, y, palette, leftLeg, rightLeg, charId) {
  // Feet
  ctx.fillStyle = palette.shoes;
  ctx.fillRect(x + 4, y + 26 + leftLeg, 3, 4);
  ctx.fillRect(x + 9, y + 26 + rightLeg, 3, 4);
  
  // Legs
  ctx.fillStyle = palette.pants;
  ctx.fillRect(x + 4, y + 18, 3, 8 + leftLeg);
  ctx.fillRect(x + 9, y + 18, 3, 8 + rightLeg);
  
  // Body
  ctx.fillStyle = palette.shirt;
  ctx.fillRect(x + 3, y + 10, 10, 10);
  
  // Arms
  ctx.fillRect(x + 1, y + 12, 2, 6);
  ctx.fillRect(x + 13, y + 12, 2, 6);
  
  // Accent
  ctx.fillStyle = palette.accent;
  ctx.fillRect(x + 3, y + 17, 10, 2);
  
  // Head (back of head - just hair)
  ctx.fillStyle = palette.hair;
  ctx.fillRect(x + 4, y + 2, 8, 8);
  
  // Character-specific back features
  if (charId === 'capitao-rodrigues') {
    ctx.fillStyle = palette.helmet;
    ctx.fillRect(x + 3, y, 10, 5);
    ctx.fillRect(x + 5, y - 1, 6, 2);
  }
  
  if (charId === 'padre-tomas') {
    ctx.fillStyle = palette.robe;
    ctx.fillRect(x + 3, y + 10, 10, 18);
  }
  
  if (charId === 'rashid') {
    ctx.fillStyle = palette.headwrap;
    ctx.fillRect(x + 3, y, 10, 5);
  }
}

/**
 * Generate sprite sheet for a character
 */
function generateSpriteSheet(characterId) {
  // Sprite sheet: 4 directions x 4 frames = 16 frames
  // Plus 4 idle frames (one per direction) = 20 frames total
  // Layout: Row 0 = walk down, Row 1 = walk left, Row 2 = walk right, Row 3 = walk up
  //         Row 4 = idle (down, left, right, up)
  
  const sheetWidth = FRAME_WIDTH * FRAMES_PER_DIRECTION;
  const sheetHeight = FRAME_HEIGHT * 5; // 4 walk rows + 1 idle row
  
  const canvas = createCanvas(sheetWidth, sheetHeight);
  const ctx = canvas.getContext('2d');
  
  // Transparent background
  ctx.clearRect(0, 0, sheetWidth, sheetHeight);
  
  // Draw walk animations (4 frames per direction)
  for (let dir = 0; dir < DIRECTIONS; dir++) {
    for (let frame = 0; frame < FRAMES_PER_DIRECTION; frame++) {
      const x = frame * FRAME_WIDTH;
      const y = dir * FRAME_HEIGHT;
      drawCharacterFrame(ctx, x, y, characterId, dir, frame, true);
    }
  }
  
  // Draw idle frames (1 per direction)
  for (let dir = 0; dir < DIRECTIONS; dir++) {
    const x = dir * FRAME_WIDTH;
    const y = 4 * FRAME_HEIGHT;
    drawCharacterFrame(ctx, x, y, characterId, dir, 0, false);
  }
  
  return canvas;
}

/**
 * Save sprite sheet as PNG
 */
function saveSpriteSheet(canvas, filename) {
  const buffer = canvas.toBuffer('image/png');
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`  ✓ Created ${filename}`);
}

/**
 * Generate all character sprite sheets
 */
function generateAllSprites() {
  console.log('Generating animated sprite sheets...\n');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate sprite sheet for each character
  for (const charId of Object.keys(characters)) {
    const canvas = generateSpriteSheet(charId);
    saveSpriteSheet(canvas, `${charId}-sheet.png`);
  }
  
  console.log('\n✅ Sprite sheets generated!');
  console.log('\nSprite sheet format:');
  console.log('- Size: 64x160 pixels (4 frames x 5 rows)');
  console.log('- Frame size: 16x32 pixels');
  console.log('- Row 0: Walk Down (4 frames)');
  console.log('- Row 1: Walk Left (4 frames)');
  console.log('- Row 2: Walk Right (4 frames)');
  console.log('- Row 3: Walk Up (4 frames)');
  console.log('- Row 4: Idle (Down, Left, Right, Up)');
  console.log('\nTo use in Phaser:');
  console.log('this.load.spritesheet("player", "player-sheet.png", { frameWidth: 16, frameHeight: 32 });');
}

// Check if canvas is available
try {
  require('canvas');
  generateAllSprites();
} catch (e) {
  console.log('Note: canvas module not installed. Installing...');
  console.log('Run: npm install canvas');
  console.log('Then: node tools/create-animated-sprites.js');
  
  // Create a simpler fallback without canvas
  console.log('\nCreating placeholder sprite data instead...');
  
  // Generate sprite sheet metadata
  const metadata = {
    frameWidth: 16,
    frameHeight: 32,
    animations: {
      'walk-down': { start: 0, end: 3, frameRate: 8, repeat: -1 },
      'walk-left': { start: 4, end: 7, frameRate: 8, repeat: -1 },
      'walk-right': { start: 8, end: 11, frameRate: 8, repeat: -1 },
      'walk-up': { start: 12, end: 15, frameRate: 8, repeat: -1 },
      'idle-down': { start: 16, end: 16, frameRate: 1, repeat: 0 },
      'idle-left': { start: 17, end: 17, frameRate: 1, repeat: 0 },
      'idle-right': { start: 18, end: 18, frameRate: 1, repeat: 0 },
      'idle-up': { start: 19, end: 19, frameRate: 1, repeat: 0 }
    },
    characters: Object.keys(characters)
  };
  
  const metadataPath = path.join(outputDir, 'sprite-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`Created sprite metadata: ${metadataPath}`);
}

