/**
 * Generate proper pixel art character sprites for gameplay
 * These are 16x32 pixel characters in the classic JRPG style
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Palette for Portuguese Melaka era
const PALETTE = {
  // Skin tones
  skinLight: '#E8C4A8',
  skinMed: '#D4A574',
  skinDark: '#8B6D4A',
  skinDeep: '#5C4A32',
  
  // Hair
  hairBlack: '#1A1410',
  hairBrown: '#3D2817',
  hairGrey: '#6B6B6B',
  hairWhite: '#A8A8A8',
  
  // Portuguese clothing
  redDeep: '#8B0000',
  redMid: '#A52A2A',
  goldBright: '#FFD700',
  goldDark: '#B8860B',
  whiteCream: '#F5F5DC',
  blueNavy: '#1A237E',
  greenDark: '#1B5E20',
  
  // Malay/Local clothing
  batiRed: '#8B0000',
  batiGold: '#DAA520',
  songketPurple: '#4A148C',
  
  // Chinese clothing
  silkRed: '#B71C1C',
  silkGold: '#FFC107',
  silkBlue: '#0D47A1',
  
  // Common
  black: '#000000',
  outline: '#1A1410',
  white: '#FFFFFF',
  brownMid: '#5C4033',
  brownLight: '#8B7355',
  greyMid: '#5A5A5A',
  greyLight: '#8B8B8B',
};

function createSprite(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// Player - Portuguese merchant agent
function drawPlayer(ctx) {
  // Head (x: 5-10, y: 2-9)
  for (let x = 6; x <= 9; x++) {
    for (let y = 3; y <= 8; y++) {
      setPixel(ctx, x, y, PALETTE.skinMed);
    }
  }
  // Hair (top and sides)
  for (let x = 6; x <= 9; x++) {
    setPixel(ctx, x, 2, PALETTE.hairBrown);
    setPixel(ctx, x, 3, PALETTE.hairBrown);
  }
  setPixel(ctx, 5, 4, PALETTE.hairBrown);
  setPixel(ctx, 5, 5, PALETTE.hairBrown);
  setPixel(ctx, 10, 4, PALETTE.hairBrown);
  setPixel(ctx, 10, 5, PALETTE.hairBrown);
  
  // Eyes
  setPixel(ctx, 6, 5, PALETTE.black);
  setPixel(ctx, 9, 5, PALETTE.black);
  
  // Doublet (red Portuguese style)
  for (let x = 5; x <= 10; x++) {
    for (let y = 9; y <= 18; y++) {
      setPixel(ctx, x, y, PALETTE.redDeep);
    }
  }
  // Gold buttons down center
  for (let y = 10; y <= 17; y += 2) {
    setPixel(ctx, 7, y, PALETTE.goldBright);
    setPixel(ctx, 8, y, PALETTE.goldBright);
  }
  
  // Sleeves
  for (let y = 10; y <= 16; y++) {
    setPixel(ctx, 4, y, PALETTE.redMid);
    setPixel(ctx, 11, y, PALETTE.redMid);
  }
  
  // Hands
  setPixel(ctx, 4, 17, PALETTE.skinMed);
  setPixel(ctx, 11, 17, PALETTE.skinMed);
  
  // Pants
  for (let x = 5; x <= 6; x++) {
    for (let y = 19; y <= 26; y++) {
      setPixel(ctx, x, y, PALETTE.brownMid);
    }
  }
  for (let x = 9; x <= 10; x++) {
    for (let y = 19; y <= 26; y++) {
      setPixel(ctx, x, y, PALETTE.brownMid);
    }
  }
  
  // Boots
  for (let x = 4; x <= 6; x++) {
    for (let y = 27; y <= 30; y++) {
      setPixel(ctx, x, y, PALETTE.hairBlack);
    }
  }
  for (let x = 9; x <= 11; x++) {
    for (let y = 27; y <= 30; y++) {
      setPixel(ctx, x, y, PALETTE.hairBlack);
    }
  }
}

// Fernão Gomes - Portuguese merchant (wealthy, older)
function drawFernaoGomes(ctx) {
  // Head - slightly rounder, older
  for (let x = 5; x <= 10; x++) {
    for (let y = 3; y <= 9; y++) {
      setPixel(ctx, x, y, PALETTE.skinLight);
    }
  }
  // Beard
  for (let x = 6; x <= 9; x++) {
    for (let y = 7; y <= 10; y++) {
      setPixel(ctx, x, y, PALETTE.hairGrey);
    }
  }
  // Hair (balding with grey)
  for (let x = 5; x <= 10; x++) {
    setPixel(ctx, x, 2, PALETTE.hairGrey);
  }
  setPixel(ctx, 4, 4, PALETTE.hairGrey);
  setPixel(ctx, 11, 4, PALETTE.hairGrey);
  
  // Eyes
  setPixel(ctx, 6, 5, PALETTE.black);
  setPixel(ctx, 9, 5, PALETTE.black);
  
  // Rich velvet coat (dark red)
  for (let x = 4; x <= 11; x++) {
    for (let y = 10; y <= 20; y++) {
      setPixel(ctx, x, y, PALETTE.redDeep);
    }
  }
  // Gold trim
  for (let y = 10; y <= 20; y++) {
    setPixel(ctx, 4, y, PALETTE.goldDark);
    setPixel(ctx, 11, y, PALETTE.goldDark);
  }
  // Gold chain/necklace
  for (let x = 5; x <= 10; x++) {
    setPixel(ctx, x, 11, PALETTE.goldBright);
  }
  
  // Hands
  setPixel(ctx, 3, 18, PALETTE.skinLight);
  setPixel(ctx, 12, 18, PALETTE.skinLight);
  
  // Pants
  for (let x = 5; x <= 6; x++) {
    for (let y = 21; y <= 27; y++) {
      setPixel(ctx, x, y, PALETTE.black);
    }
  }
  for (let x = 9; x <= 10; x++) {
    for (let y = 21; y <= 27; y++) {
      setPixel(ctx, x, y, PALETTE.black);
    }
  }
  
  // Boots
  for (let x = 4; x <= 6; x++) {
    for (let y = 28; y <= 31; y++) {
      setPixel(ctx, x, y, PALETTE.brownMid);
    }
  }
  for (let x = 9; x <= 11; x++) {
    for (let y = 28; y <= 31; y++) {
      setPixel(ctx, x, y, PALETTE.brownMid);
    }
  }
}

// Capitão Rodrigues - Military commander
function drawCapitaoRodrigues(ctx) {
  // Head
  for (let x = 6; x <= 9; x++) {
    for (let y = 3; y <= 8; y++) {
      setPixel(ctx, x, y, PALETTE.skinMed);
    }
  }
  
  // Morion helmet
  for (let x = 5; x <= 10; x++) {
    setPixel(ctx, x, 1, PALETTE.greyMid);
    setPixel(ctx, x, 2, PALETTE.greyLight);
    setPixel(ctx, x, 3, PALETTE.greyMid);
  }
  // Helmet crest
  setPixel(ctx, 7, 0, PALETTE.redDeep);
  setPixel(ctx, 8, 0, PALETTE.redDeep);
  
  // Mustache
  setPixel(ctx, 5, 7, PALETTE.hairBlack);
  setPixel(ctx, 6, 7, PALETTE.hairBlack);
  setPixel(ctx, 9, 7, PALETTE.hairBlack);
  setPixel(ctx, 10, 7, PALETTE.hairBlack);
  
  // Eyes
  setPixel(ctx, 6, 5, PALETTE.black);
  setPixel(ctx, 9, 5, PALETTE.black);
  
  // Armor/breastplate
  for (let x = 5; x <= 10; x++) {
    for (let y = 9; y <= 17; y++) {
      setPixel(ctx, x, y, PALETTE.greyMid);
    }
  }
  // Armor highlights
  setPixel(ctx, 7, 11, PALETTE.greyLight);
  setPixel(ctx, 8, 11, PALETTE.greyLight);
  setPixel(ctx, 7, 14, PALETTE.greyLight);
  setPixel(ctx, 8, 14, PALETTE.greyLight);
  
  // Red sash
  for (let x = 5; x <= 10; x++) {
    setPixel(ctx, x, 18, PALETTE.redDeep);
    setPixel(ctx, x, 19, PALETTE.redDeep);
  }
  
  // Arms (armor)
  for (let y = 10; y <= 15; y++) {
    setPixel(ctx, 4, y, PALETTE.greyMid);
    setPixel(ctx, 11, y, PALETTE.greyMid);
  }
  
  // Hands
  setPixel(ctx, 4, 16, PALETTE.skinMed);
  setPixel(ctx, 11, 16, PALETTE.skinMed);
  
  // Pants
  for (let x = 5; x <= 6; x++) {
    for (let y = 20; y <= 26; y++) {
      setPixel(ctx, x, y, PALETTE.brownMid);
    }
  }
  for (let x = 9; x <= 10; x++) {
    for (let y = 20; y <= 26; y++) {
      setPixel(ctx, x, y, PALETTE.brownMid);
    }
  }
  
  // Boots
  for (let x = 4; x <= 6; x++) {
    for (let y = 27; y <= 31; y++) {
      setPixel(ctx, x, y, PALETTE.hairBlack);
    }
  }
  for (let x = 9; x <= 11; x++) {
    for (let y = 27; y <= 31; y++) {
      setPixel(ctx, x, y, PALETTE.hairBlack);
    }
  }
}

// Padre Tomás - Jesuit priest
function drawPadreTomas(ctx) {
  // Head - tonsure hairstyle
  for (let x = 6; x <= 9; x++) {
    for (let y = 3; y <= 9; y++) {
      setPixel(ctx, x, y, PALETTE.skinLight);
    }
  }
  // Tonsure (bald top with hair ring)
  for (let x = 6; x <= 9; x++) {
    setPixel(ctx, x, 2, PALETTE.skinLight);
  }
  setPixel(ctx, 5, 3, PALETTE.hairBrown);
  setPixel(ctx, 5, 4, PALETTE.hairBrown);
  setPixel(ctx, 10, 3, PALETTE.hairBrown);
  setPixel(ctx, 10, 4, PALETTE.hairBrown);
  
  // Eyes
  setPixel(ctx, 6, 5, PALETTE.black);
  setPixel(ctx, 9, 5, PALETTE.black);
  
  // Black cassock/robe
  for (let x = 4; x <= 11; x++) {
    for (let y = 10; y <= 29; y++) {
      setPixel(ctx, x, y, PALETTE.black);
    }
  }
  // White collar
  for (let x = 6; x <= 9; x++) {
    setPixel(ctx, x, 10, PALETTE.whiteCream);
  }
  
  // Hands in prayer
  setPixel(ctx, 7, 16, PALETTE.skinLight);
  setPixel(ctx, 8, 16, PALETTE.skinLight);
  
  // Rosary/cross
  setPixel(ctx, 7, 18, PALETTE.goldBright);
  setPixel(ctx, 8, 18, PALETTE.goldBright);
  setPixel(ctx, 7, 19, PALETTE.goldBright);
  setPixel(ctx, 8, 19, PALETTE.goldBright);
  
  // Feet peeking out
  setPixel(ctx, 5, 30, PALETTE.brownMid);
  setPixel(ctx, 6, 30, PALETTE.brownMid);
  setPixel(ctx, 9, 30, PALETTE.brownMid);
  setPixel(ctx, 10, 30, PALETTE.brownMid);
}

// Aminah - Malay market vendor
function drawAminah(ctx) {
  // Head
  for (let x = 6; x <= 9; x++) {
    for (let y = 4; y <= 9; y++) {
      setPixel(ctx, x, y, PALETTE.skinDark);
    }
  }
  
  // Headscarf/Tudung (colorful)
  for (let x = 5; x <= 10; x++) {
    setPixel(ctx, x, 2, PALETTE.batiRed);
    setPixel(ctx, x, 3, PALETTE.batiRed);
    setPixel(ctx, x, 4, PALETTE.batiRed);
  }
  setPixel(ctx, 4, 4, PALETTE.batiRed);
  setPixel(ctx, 4, 5, PALETTE.batiRed);
  setPixel(ctx, 4, 6, PALETTE.batiRed);
  setPixel(ctx, 11, 4, PALETTE.batiRed);
  setPixel(ctx, 11, 5, PALETTE.batiRed);
  setPixel(ctx, 11, 6, PALETTE.batiRed);
  // Gold trim on headscarf
  for (let x = 5; x <= 10; x++) {
    setPixel(ctx, x, 4, PALETTE.batiGold);
  }
  
  // Eyes
  setPixel(ctx, 6, 6, PALETTE.black);
  setPixel(ctx, 9, 6, PALETTE.black);
  
  // Baju Kurung (traditional top)
  for (let x = 5; x <= 10; x++) {
    for (let y = 10; y <= 17; y++) {
      setPixel(ctx, x, y, PALETTE.songketPurple);
    }
  }
  // Gold embroidery
  setPixel(ctx, 7, 11, PALETTE.batiGold);
  setPixel(ctx, 8, 11, PALETTE.batiGold);
  setPixel(ctx, 7, 14, PALETTE.batiGold);
  setPixel(ctx, 8, 14, PALETTE.batiGold);
  
  // Sleeves
  for (let y = 11; y <= 16; y++) {
    setPixel(ctx, 4, y, PALETTE.songketPurple);
    setPixel(ctx, 11, y, PALETTE.songketPurple);
  }
  
  // Hands
  setPixel(ctx, 4, 17, PALETTE.skinDark);
  setPixel(ctx, 11, 17, PALETTE.skinDark);
  
  // Sarong (batik pattern)
  for (let x = 5; x <= 10; x++) {
    for (let y = 18; y <= 28; y++) {
      setPixel(ctx, x, y, PALETTE.batiRed);
    }
  }
  // Batik pattern
  for (let y = 19; y <= 27; y += 2) {
    setPixel(ctx, 6, y, PALETTE.batiGold);
    setPixel(ctx, 9, y, PALETTE.batiGold);
  }
  
  // Feet (sandals)
  setPixel(ctx, 5, 29, PALETTE.brownMid);
  setPixel(ctx, 6, 29, PALETTE.brownMid);
  setPixel(ctx, 9, 29, PALETTE.brownMid);
  setPixel(ctx, 10, 29, PALETTE.brownMid);
}

// Chen Wei - Chinese merchant
function drawChenWei(ctx) {
  // Head
  for (let x = 6; x <= 9; x++) {
    for (let y = 3; y <= 9; y++) {
      setPixel(ctx, x, y, PALETTE.skinLight);
    }
  }
  
  // Hair (queue/ponytail with cap)
  for (let x = 5; x <= 10; x++) {
    setPixel(ctx, x, 1, PALETTE.hairBlack);
    setPixel(ctx, x, 2, PALETTE.hairBlack);
  }
  // Queue going back
  setPixel(ctx, 7, 0, PALETTE.hairBlack);
  setPixel(ctx, 8, 0, PALETTE.hairBlack);
  
  // Fu Manchu mustache & goatee
  setPixel(ctx, 5, 7, PALETTE.hairBlack);
  setPixel(ctx, 10, 7, PALETTE.hairBlack);
  setPixel(ctx, 7, 8, PALETTE.hairBlack);
  setPixel(ctx, 8, 8, PALETTE.hairBlack);
  
  // Eyes
  setPixel(ctx, 6, 5, PALETTE.black);
  setPixel(ctx, 9, 5, PALETTE.black);
  
  // Silk changshan (long robe)
  for (let x = 5; x <= 10; x++) {
    for (let y = 10; y <= 27; y++) {
      setPixel(ctx, x, y, PALETTE.silkBlue);
    }
  }
  // Gold frog buttons
  for (let y = 11; y <= 16; y += 2) {
    setPixel(ctx, 5, y, PALETTE.silkGold);
    setPixel(ctx, 6, y, PALETTE.silkGold);
  }
  // Wide sleeves
  for (let y = 11; y <= 18; y++) {
    setPixel(ctx, 3, y, PALETTE.silkBlue);
    setPixel(ctx, 4, y, PALETTE.silkBlue);
    setPixel(ctx, 11, y, PALETTE.silkBlue);
    setPixel(ctx, 12, y, PALETTE.silkBlue);
  }
  
  // Hands
  setPixel(ctx, 3, 19, PALETTE.skinLight);
  setPixel(ctx, 12, 19, PALETTE.skinLight);
  
  // Shoes
  setPixel(ctx, 6, 28, PALETTE.black);
  setPixel(ctx, 7, 28, PALETTE.black);
  setPixel(ctx, 8, 28, PALETTE.black);
  setPixel(ctx, 9, 28, PALETTE.black);
}

// Rashid - Arab sailor
function drawRashid(ctx) {
  // Head
  for (let x = 6; x <= 9; x++) {
    for (let y = 3; y <= 9; y++) {
      setPixel(ctx, x, y, PALETTE.skinDeep);
    }
  }
  
  // Turban/head covering
  for (let x = 4; x <= 11; x++) {
    setPixel(ctx, x, 1, PALETTE.whiteCream);
    setPixel(ctx, x, 2, PALETTE.whiteCream);
    setPixel(ctx, x, 3, PALETTE.whiteCream);
  }
  
  // Full beard
  for (let x = 5; x <= 10; x++) {
    for (let y = 7; y <= 10; y++) {
      setPixel(ctx, x, y, PALETTE.hairBlack);
    }
  }
  
  // Eyes
  setPixel(ctx, 6, 5, PALETTE.black);
  setPixel(ctx, 9, 5, PALETTE.black);
  
  // Open vest over bare chest
  for (let x = 5; x <= 10; x++) {
    for (let y = 10; y <= 18; y++) {
      setPixel(ctx, x, y, PALETTE.skinDeep);
    }
  }
  // Vest sides
  for (let y = 10; y <= 17; y++) {
    setPixel(ctx, 4, y, PALETTE.greenDark);
    setPixel(ctx, 5, y, PALETTE.greenDark);
    setPixel(ctx, 10, y, PALETTE.greenDark);
    setPixel(ctx, 11, y, PALETTE.greenDark);
  }
  
  // Wide sailor pants (white)
  for (let x = 4; x <= 11; x++) {
    for (let y = 19; y <= 27; y++) {
      setPixel(ctx, x, y, PALETTE.whiteCream);
    }
  }
  // Sash at waist
  for (let x = 4; x <= 11; x++) {
    setPixel(ctx, x, 18, PALETTE.redDeep);
    setPixel(ctx, x, 19, PALETTE.redDeep);
  }
  
  // Bare feet
  setPixel(ctx, 5, 28, PALETTE.skinDeep);
  setPixel(ctx, 6, 28, PALETTE.skinDeep);
  setPixel(ctx, 9, 28, PALETTE.skinDeep);
  setPixel(ctx, 10, 28, PALETTE.skinDeep);
}

// Generic NPC
function drawNPC(ctx) {
  // Simple peasant/commoner
  // Head
  for (let x = 6; x <= 9; x++) {
    for (let y = 3; y <= 8; y++) {
      setPixel(ctx, x, y, PALETTE.skinMed);
    }
  }
  // Hair
  for (let x = 6; x <= 9; x++) {
    setPixel(ctx, x, 2, PALETTE.hairBrown);
    setPixel(ctx, x, 3, PALETTE.hairBrown);
  }
  
  // Eyes
  setPixel(ctx, 6, 5, PALETTE.black);
  setPixel(ctx, 9, 5, PALETTE.black);
  
  // Simple tunic
  for (let x = 5; x <= 10; x++) {
    for (let y = 9; y <= 18; y++) {
      setPixel(ctx, x, y, PALETTE.brownLight);
    }
  }
  
  // Arms
  for (let y = 10; y <= 15; y++) {
    setPixel(ctx, 4, y, PALETTE.brownLight);
    setPixel(ctx, 11, y, PALETTE.brownLight);
  }
  
  // Hands
  setPixel(ctx, 4, 16, PALETTE.skinMed);
  setPixel(ctx, 11, 16, PALETTE.skinMed);
  
  // Pants
  for (let x = 5; x <= 6; x++) {
    for (let y = 19; y <= 26; y++) {
      setPixel(ctx, x, y, PALETTE.brownMid);
    }
  }
  for (let x = 9; x <= 10; x++) {
    for (let y = 19; y <= 26; y++) {
      setPixel(ctx, x, y, PALETTE.brownMid);
    }
  }
  
  // Feet
  setPixel(ctx, 5, 27, PALETTE.brownMid);
  setPixel(ctx, 6, 27, PALETTE.brownMid);
  setPixel(ctx, 9, 27, PALETTE.brownMid);
  setPixel(ctx, 10, 27, PALETTE.brownMid);
}

// Save PNG
async function saveSprite(canvas, filename) {
  const outputPath = path.join(__dirname, '..', 'assets', 'sprites', 'characters', filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${filename}`);
}

// Main
async function main() {
  console.log('Generating pixel art character sprites...\n');

  // Player
  const { canvas: playerCanvas, ctx: playerCtx } = createSprite(16, 32);
  drawPlayer(playerCtx);
  await saveSprite(playerCanvas, 'player.png');

  // Fernão Gomes
  const { canvas: fernaoCanvas, ctx: fernaoCtx } = createSprite(16, 32);
  drawFernaoGomes(fernaoCtx);
  await saveSprite(fernaoCanvas, 'fernao-gomes.png');

  // Capitão Rodrigues
  const { canvas: capitaoCanvas, ctx: capitaoCtx } = createSprite(16, 32);
  drawCapitaoRodrigues(capitaoCtx);
  await saveSprite(capitaoCanvas, 'capitao-rodrigues.png');

  // Padre Tomás
  const { canvas: padreCanvas, ctx: padreCtx } = createSprite(16, 32);
  drawPadreTomas(padreCtx);
  await saveSprite(padreCanvas, 'padre-tomas.png');

  // Aminah
  const { canvas: aminahCanvas, ctx: aminahCtx } = createSprite(16, 32);
  drawAminah(aminahCtx);
  await saveSprite(aminahCanvas, 'aminah.png');

  // Chen Wei
  const { canvas: chenCanvas, ctx: chenCtx } = createSprite(16, 32);
  drawChenWei(chenCtx);
  await saveSprite(chenCanvas, 'chen-wei.png');

  // Rashid
  const { canvas: rashidCanvas, ctx: rashidCtx } = createSprite(16, 32);
  drawRashid(rashidCtx);
  await saveSprite(rashidCanvas, 'rashid.png');

  // Generic NPC
  const { canvas: npcCanvas, ctx: npcCtx } = createSprite(16, 32);
  drawNPC(npcCtx);
  await saveSprite(npcCanvas, 'npc.png');

  console.log('\n✓ All character sprites generated!');
}

main().catch(console.error);

