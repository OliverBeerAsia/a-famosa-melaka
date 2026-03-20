/**
 * NPC Sprite Generator
 *
 * Creates period-accurate character sprites for the 6 demo NPCs:
 * - Fernão Gomes (Portuguese merchant)
 * - Capitão Rodrigues (Portuguese fortress captain)
 * - Padre Tomás (Jesuit priest)
 * - Aminah (Malay market vendor)
 * - Chen Wei (Chinese guild representative)
 * - Rashid (Arab sailor)
 *
 * Each sprite: 16x32 pixels with shadows, period clothing, and cultural accuracy
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'characters');

// Enhanced color palette for NPCs
const PALETTE = {
  // Skin tones (varied for different ethnicities)
  skinPortuguese: '#D4A574',
  skinPortugueseDark: '#B88A5C',
  skinMalay: '#C9955A',
  skinMalayDark: '#A67542',
  skinChinese: '#E8C9A0',
  skinChineseDark: '#D4A574',
  skinArab: '#C4956B',
  skinArabDark: '#A67D53',

  // Portuguese clothing
  merchantRed: '#8B1E1E',
  merchantRedLight: '#B8312F',
  merchantGold: '#D4AF37',
  captainBlue: '#2E3A74',
  captainBlueLight: '#4A5A9A',
  priestBlack: '#1A1A1A',
  priestWhite: '#F5E6D3',

  // Malay clothing
  batikBlue: '#2E4A6A',
  batikBlueDark: '#1A2E44',
  batikGold: '#D4A537',
  kebayaWhite: '#F5E6D3',

  // Chinese clothing
  silkGreen: '#3A5A3A',
  silkGreenDark: '#2A4A2A',
  silkGold: '#D4AF37',

  // Arab clothing
  robeWhite: '#F5E6D3',
  robeWhiteDark: '#D4C5B3',
  turbanRed: '#8B3A3A',

  // Hair colors
  hairBlack: '#1A1A1A',
  hairBrown: '#4A2E15',
  hairGray: '#6A6A6A',

  // Common
  shadow: 'rgba(26, 20, 16, 0.5)',
  black: '#1A1A1A',
  white: '#FFFFFF',
  woodBrown: '#654321'
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

// 1. Fernão Gomes - Portuguese Merchant (wealthy, red doublet, gold trim)
function drawFernaoGomes(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 29, 6, 2);

  // Hair (brown with gray)
  px(ctx, 6, 4, c.hairBrown);
  px(ctx, 7, 3, c.hairGray);
  px(ctx, 7, 4, c.hairBrown);
  px(ctx, 8, 3, c.hairGray);
  px(ctx, 8, 4, c.hairBrown);
  px(ctx, 9, 4, c.hairBrown);

  // Head
  px(ctx, 7, 5, c.skinPortuguese);
  px(ctx, 8, 5, c.skinPortuguese);
  px(ctx, 7, 6, c.skinPortuguese);
  px(ctx, 8, 6, c.skinPortugueseDark);

  // Eyes
  px(ctx, 6, 5, c.black);
  px(ctx, 9, 5, c.black);

  // Beard (gray-brown)
  px(ctx, 6, 6, c.hairGray);
  px(ctx, 7, 7, c.hairBrown);
  px(ctx, 8, 7, c.hairGray);
  px(ctx, 9, 6, c.hairGray);

  // Rich red doublet with gold trim
  for (let y = 8; y <= 14; y++) {
    for (let x = 5; x <= 10; x++) {
      if (y === 8 || y === 14) {
        px(ctx, x, y, c.merchantGold); // Gold trim
      } else if (x === 5 || x === 10) {
        px(ctx, x, y, c.merchantRed);
      } else {
        px(ctx, x, y, y < 11 ? c.merchantRedLight : c.merchantRed);
      }
    }
  }

  // Gold buttons
  px(ctx, 7, 9, c.merchantGold);
  px(ctx, 8, 11, c.merchantGold);

  // Arms
  px(ctx, 4, 9, c.skinPortugueseDark);
  px(ctx, 4, 10, c.skinPortuguese);
  px(ctx, 11, 9, c.skinPortugueseDark);
  px(ctx, 11, 10, c.skinPortuguese);

  // Dark breeches
  for (let y = 15; y <= 23; y++) {
    px(ctx, 6, y, c.priestBlack);
    px(ctx, 7, y, c.priestBlack);
    px(ctx, 8, y, c.priestBlack);
    px(ctx, 9, y, c.priestBlack);
  }

  // Boots
  for (let y = 24; y <= 28; y++) {
    for (let x = 6; x <= 9; x++) {
      px(ctx, x, y, c.hairBrown);
    }
  }
}

// 2. Capitão Rodrigues - Fortress Captain (military blue, armor elements)
function drawCapitaoRodrigues(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 29, 6, 2);

  // Hair (dark, military cut)
  px(ctx, 6, 3, c.hairBlack);
  px(ctx, 7, 3, c.hairBlack);
  px(ctx, 8, 3, c.hairBlack);
  px(ctx, 9, 3, c.hairBlack);
  px(ctx, 7, 4, c.hairBlack);
  px(ctx, 8, 4, c.hairBlack);

  // Head
  px(ctx, 7, 5, c.skinPortuguese);
  px(ctx, 8, 5, c.skinPortuguese);
  px(ctx, 7, 6, c.skinPortuguese);
  px(ctx, 8, 6, c.skinPortugueseDark);

  // Eyes (stern)
  px(ctx, 6, 5, c.black);
  px(ctx, 9, 5, c.black);

  // Mustache
  px(ctx, 6, 6, c.hairBlack);
  px(ctx, 9, 6, c.hairBlack);

  // Military blue doublet with high collar
  for (let y = 7; y <= 14; y++) {
    for (let x = 5; x <= 10; x++) {
      if (y === 7) {
        px(ctx, x, y, c.captainBlueLight); // Collar
      } else if (x === 7 || x === 8) {
        px(ctx, x, y, c.captainBlueLight); // Center highlight
      } else {
        px(ctx, x, y, c.captainBlue);
      }
    }
  }

  // Belt with sword (gold buckle)
  for (let x = 5; x <= 10; x++) {
    px(ctx, x, 13, c.hairBrown);
  }
  px(ctx, 8, 13, c.merchantGold);

  // Sword hilt
  px(ctx, 4, 13, c.merchantGold);
  px(ctx, 4, 14, c.merchantGold);

  // Dark military breeches
  for (let y = 15; y <= 23; y++) {
    px(ctx, 6, y, c.captainBlue);
    px(ctx, 7, y, c.captainBlue);
    px(ctx, 8, y, c.captainBlueDark);
    px(ctx, 9, y, c.captainBlueDark);
  }

  // Military boots
  for (let y = 24; y <= 28; y++) {
    for (let x = 6; x <= 9; x++) {
      px(ctx, x, y, c.hairBlack);
    }
  }
}

// 3. Padre Tomás - Jesuit Priest (black cassock, white collar)
function drawPadreTomas(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 29, 6, 2);

  // Tonsure hairstyle (bald top, ring of hair)
  px(ctx, 6, 4, c.hairBrown);
  px(ctx, 9, 4, c.hairBrown);
  px(ctx, 6, 5, c.hairBrown);
  px(ctx, 9, 5, c.hairBrown);

  // Head
  px(ctx, 7, 4, c.skinPortuguese);
  px(ctx, 8, 4, c.skinPortuguese);
  px(ctx, 7, 5, c.skinPortuguese);
  px(ctx, 8, 5, c.skinPortuguese);
  px(ctx, 7, 6, c.skinPortuguese);
  px(ctx, 8, 6, c.skinPortugueseDark);

  // Eyes (kind)
  px(ctx, 6, 5, c.black);
  px(ctx, 9, 5, c.black);

  // White collar (priest's collar)
  px(ctx, 6, 7, c.priestWhite);
  px(ctx, 7, 7, c.priestWhite);
  px(ctx, 8, 7, c.priestWhite);
  px(ctx, 9, 7, c.priestWhite);

  // Black cassock (long, simple)
  for (let y = 8; y <= 28; y++) {
    for (let x = 5; x <= 10; x++) {
      if (x === 5 || x === 10) {
        px(ctx, x, y, c.black); // Edges darker
      } else {
        px(ctx, x, y, c.priestBlack);
      }
    }
  }

  // Rope belt
  px(ctx, 6, 14, c.hairBrown);
  px(ctx, 7, 14, c.hairBrown);
  px(ctx, 8, 14, c.hairBrown);
  px(ctx, 9, 14, c.hairBrown);

  // Cross pendant
  px(ctx, 7, 9, c.merchantGold);
  px(ctx, 8, 9, c.merchantGold);
  px(ctx, 8, 10, c.merchantGold);
}

// 4. Aminah - Malay Market Vendor (kebaya, batik sarong, headscarf)
function drawAminah(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 29, 6, 2);

  // Headscarf (tudung - traditional Malay)
  for (let y = 2; y <= 5; y++) {
    for (let x = 6; x <= 9; x++) {
      if (y === 2 || x === 6 || x === 9) {
        px(ctx, x, y, c.batikBlueDark);
      } else {
        px(ctx, x, y, c.batikBlue);
      }
    }
  }

  // Face (showing under tudung)
  px(ctx, 7, 5, c.skinMalay);
  px(ctx, 8, 5, c.skinMalay);
  px(ctx, 7, 6, c.skinMalay);
  px(ctx, 8, 6, c.skinMalayDark);

  // Eyes
  px(ctx, 7, 5, c.black);
  px(ctx, 8, 5, c.black);

  // Kebaya (traditional lace blouse) - white/cream
  for (let y = 7; y <= 14; y++) {
    for (let x = 5; x <= 10; x++) {
      if (y === 7 || x === 5 || x === 10) {
        px(ctx, x, y, c.priestWhite);
      } else {
        px(ctx, x, y, c.kebayaWhite);
      }
    }
  }

  // Gold brooch
  px(ctx, 7, 8, c.batikGold);
  px(ctx, 8, 8, c.batikGold);

  // Arms
  px(ctx, 4, 9, c.skinMalayDark);
  px(ctx, 4, 10, c.skinMalay);
  px(ctx, 11, 9, c.skinMalayDark);
  px(ctx, 11, 10, c.skinMalay);

  // Batik sarong (patterned)
  for (let y = 15; y <= 28; y++) {
    for (let x = 5; x <= 10; x++) {
      const pattern = (x + y) % 3;
      if (pattern === 0) {
        px(ctx, x, y, c.batikGold);
      } else if (pattern === 1) {
        px(ctx, x, y, c.batikBlue);
      } else {
        px(ctx, x, y, c.batikBlueDark);
      }
    }
  }
}

// 5. Chen Wei - Chinese Guild Representative (silk changshan, scholarly)
function drawChenWei(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 29, 6, 2);

  // Traditional Chinese hairstyle (queue braid) - top knot
  px(ctx, 7, 2, c.hairBlack);
  px(ctx, 8, 2, c.hairBlack);
  px(ctx, 7, 3, c.hairBlack);
  px(ctx, 8, 3, c.hairBlack);
  px(ctx, 6, 4, c.hairBlack);
  px(ctx, 9, 4, c.hairBlack);

  // Head
  px(ctx, 7, 4, c.skinChinese);
  px(ctx, 8, 4, c.skinChinese);
  px(ctx, 7, 5, c.skinChinese);
  px(ctx, 8, 5, c.skinChinese);
  px(ctx, 7, 6, c.skinChineseDark);
  px(ctx, 8, 6, c.skinChineseDark);

  // Eyes
  px(ctx, 6, 5, c.black);
  px(ctx, 9, 5, c.black);

  // Thin mustache and beard
  px(ctx, 7, 6, c.hairBlack);
  px(ctx, 8, 6, c.hairBlack);

  // Silk changshan (traditional Chinese robe) - green with gold trim
  for (let y = 7; y <= 26; y++) {
    for (let x = 5; x <= 10; x++) {
      if (y === 7 || x === 7 || x === 8) {
        px(ctx, x, y, c.silkGold); // Gold center and collar
      } else if (x === 5 || x === 10) {
        px(ctx, x, y, c.silkGreenDark);
      } else {
        px(ctx, x, y, c.silkGreen);
      }
    }
  }

  // Sash/belt
  for (let x = 5; x <= 10; x++) {
    px(ctx, x, 14, c.silkGold);
  }

  // Black shoes
  for (let y = 27; y <= 28; y++) {
    for (let x = 6; x <= 9; x++) {
      px(ctx, x, y, c.hairBlack);
    }
  }
}

// 6. Rashid - Arab Sailor (white robe, red turban, weathered)
function drawRashid(ctx) {
  const c = PALETTE;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 29, 6, 2);

  // Red turban (imama)
  for (let y = 2; y <= 4; y++) {
    for (let x = 6; x <= 9; x++) {
      px(ctx, x, y, c.turbanRed);
    }
  }
  px(ctx, 5, 3, c.turbanRed);
  px(ctx, 10, 3, c.turbanRed);

  // Hair showing
  px(ctx, 6, 4, c.hairBlack);
  px(ctx, 9, 4, c.hairBlack);

  // Head
  px(ctx, 7, 5, c.skinArab);
  px(ctx, 8, 5, c.skinArab);
  px(ctx, 7, 6, c.skinArab);
  px(ctx, 8, 6, c.skinArabDark);

  // Eyes
  px(ctx, 6, 5, c.black);
  px(ctx, 9, 5, c.black);

  // Full beard
  px(ctx, 6, 6, c.hairBlack);
  px(ctx, 7, 7, c.hairBlack);
  px(ctx, 8, 7, c.hairBlack);
  px(ctx, 9, 6, c.hairBlack);
  px(ctx, 6, 7, c.hairBlack);
  px(ctx, 9, 7, c.hairBlack);

  // White thobe (sailor's robe)
  for (let y = 8; y <= 26; y++) {
    for (let x = 5; x <= 10; x++) {
      if (x === 5 || x === 10) {
        px(ctx, x, y, c.robeWhiteDark);
      } else {
        px(ctx, x, y, c.robeWhite);
      }
    }
  }

  // Rope belt (sailor)
  for (let x = 5; x <= 10; x++) {
    px(ctx, x, 14, c.hairBrown);
  }

  // Arms showing
  px(ctx, 4, 9, c.skinArabDark);
  px(ctx, 4, 10, c.skinArab);
  px(ctx, 11, 9, c.skinArabDark);
  px(ctx, 11, 10, c.skinArab);

  // Simple sandals
  px(ctx, 6, 27, c.hairBrown);
  px(ctx, 7, 27, c.hairBrown);
  px(ctx, 8, 28, c.hairBrown);
  px(ctx, 9, 28, c.hairBrown);
}

console.log('\n✨ Generating 6 Demo NPC Sprites...\n');

createSprite(16, 32, drawFernaoGomes, path.join(OUTPUT_DIR, 'fernao-gomes.png'));
createSprite(16, 32, drawCapitaoRodrigues, path.join(OUTPUT_DIR, 'capitao-rodrigues.png'));
createSprite(16, 32, drawPadreTomas, path.join(OUTPUT_DIR, 'padre-tomas.png'));
createSprite(16, 32, drawAminah, path.join(OUTPUT_DIR, 'aminah.png'));
createSprite(16, 32, drawChenWei, path.join(OUTPUT_DIR, 'chen-wei.png'));
createSprite(16, 32, drawRashid, path.join(OUTPUT_DIR, 'rashid.png'));

console.log('\n✅ All NPC sprites complete!');
console.log('📐 16x32 pixels, period-accurate clothing, cultural diversity');
console.log('🎨 Portuguese, Malay, Chinese, and Arab characters represented\n');
