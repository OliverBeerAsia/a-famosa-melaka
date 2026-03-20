/**
 * Ultima 8 Style Color Palette
 * Rich, atmospheric colors with 8 shade grades and dithering support
 * Based on the VGA 256-color aesthetic of Ultima 8: Pagan
 */

// Each material has 8 grades for smooth gradients (like VGA palette)
const PALETTE = {
  // Stone - fortress walls, cobblestones (blue-grey like U8)
  stone: [
    '#0A0A10', // 0 - deepest shadow
    '#1A1A25', // 1 - deep shadow
    '#2A2A3A', // 2 - shadow
    '#3A3A4A', // 3 - dark
    '#4A4A5A', // 4 - mid-dark
    '#5A5A6A', // 5 - mid
    '#6A6A7A', // 6 - mid-light
    '#7A7A8A', // 7 - light
  ],
  
  // Warm stone - sunlit Mediterranean stone
  warmStone: [
    '#1A1510', // 0
    '#2A2520', // 1
    '#3A3530', // 2
    '#4A4540', // 3
    '#5A5550', // 4
    '#6A6560', // 5
    '#7A7570', // 6
    '#8A8580', // 7
  ],
  
  // Terracotta - Portuguese roofs
  terracotta: [
    '#2A0A05', // 0
    '#4A1A0A', // 1
    '#6A2A10', // 2
    '#8A3A18', // 3
    '#AA4A20', // 4
    '#BA5A28', // 5
    '#CA6A30', // 6
    '#DA7A40', // 7
  ],
  
  // Whitewash - colonial buildings
  whitewash: [
    '#4A4540', // 0 - in shadow
    '#6A6560', // 1
    '#8A8580', // 2
    '#AAA5A0', // 3
    '#CAC5C0', // 4
    '#DAD5D0', // 5
    '#EAE5E0', // 6
    '#F5F0EB', // 7 - brightest
  ],
  
  // Wood - rich brown wood with grain
  wood: [
    '#0A0500', // 0
    '#1A0F05', // 1
    '#2A1A0A', // 2
    '#3A2510', // 3
    '#4A3018', // 4
    '#5A3B20', // 5
    '#6A4628', // 6
    '#7A5130', // 7
  ],
  
  // Light wood - bamboo, lighter furniture  
  lightWood: [
    '#2A2010', // 0
    '#3A3018', // 1
    '#4A4020', // 2
    '#5A5028', // 3
    '#6A6030', // 4
    '#7A7038', // 5
    '#8A8040', // 6
    '#9A9048', // 7
  ],
  
  // Jungle green - deep tropical vegetation
  jungle: [
    '#050A05', // 0 - deep shadow
    '#0A1508', // 1
    '#10200A', // 2
    '#152A10', // 3
    '#1A3515', // 4
    '#20401A', // 5
    '#35652A', // 6 - brighter highlight
    '#40753A', // 7 - tropical sunlight
  ],
  
  // Grass - lighter tropical grass  
  grass: [
    '#0A1505', // 0
    '#152510', // 1
    '#203518', // 2
    '#2A4520', // 3
    '#355528', // 4
    '#406530', // 5
    '#4A7538', // 6
    '#558540', // 7
  ],
  
  // Water - deep tropical sea (blue-green)
  water: [
    '#050A15', // 0 - deep
    '#0A1525', // 1
    '#102035', // 2
    '#152A45', // 3
    '#1A3555', // 4
    '#204065', // 5
    '#254A75', // 6
    '#2A5585', // 7 - surface shimmer
  ],
  
  // Sand/dirt - warm earth tones
  sand: [
    '#1A1510', // 0
    '#2A2518', // 1
    '#3A3520', // 2
    '#4A4528', // 3
    '#5A5530', // 4
    '#6A6538', // 5
    '#7A7540', // 6
    '#8A8548', // 7
  ],
  
  // Gold/brass - metallic accents
  gold: [
    '#2A1A05', // 0
    '#4A3010', // 1
    '#6A4518', // 2
    '#8A5A20', // 3
    '#AA7028', // 4
    '#CA8530', // 5
    '#DA9A40', // 6
    '#EAAF50', // 7
  ],
  
  // Deep shadow - for ambient occlusion
  shadow: [
    '#000000', // 0 - pure black
    '#050505', // 1
    '#0A0A0A', // 2
    '#101010', // 3
    '#151515', // 4
    '#1A1A1A', // 5
    '#202020', // 6
    '#252525', // 7
  ],
  
  // Skin tones - Portuguese (warm/pink-toned)
  skinPortuguese: [
    '#3A2218', // 0 - deeper, warmer shadow
    '#4A3222', // 1
    '#5A422A', // 2
    '#6A5235', // 3
    '#7E6245', // 4 - pink-warm mid
    '#8A6550', // 5 - distinctly warm
    '#9A7A5A', // 6
    '#AA8A65', // 7
  ],
  
  // Skin tones - Malay
  skinMalay: [
    '#2A1A10', // 0
    '#3A2A18', // 1
    '#4A3A20', // 2
    '#5A4A28', // 3
    '#6A5A30', // 4
    '#7A6A38', // 5
    '#8A7A40', // 6
    '#9A8A48', // 7
  ],
  
  // Skin tones - Chinese (cooler/neutral)
  skinChinese: [
    '#352A22', // 0 - cooler shadow
    '#453A2C', // 1
    '#554A38', // 2
    '#655A45', // 3
    '#756A55', // 4 - neutral mid
    '#7A6A58', // 5 - cooler
    '#8A7A65', // 6
    '#9A8A72', // 7
  ],
  
  // Portuguese red - clothing
  clothRed: [
    '#1A0505', // 0
    '#2A0A0A', // 1
    '#4A1010', // 2
    '#6A1818', // 3
    '#8A2020', // 4
    '#AA2828', // 5
    '#BA3030', // 6
    '#CA4040', // 7
  ],
  
  // Malay blue - batik clothing
  clothBlue: [
    '#05050A', // 0
    '#0A0A15', // 1
    '#151525', // 2
    '#202035', // 3
    '#2A2A45', // 4
    '#353555', // 5
    '#404065', // 6
    '#4A4A75', // 7
  ],
  
  // Chinese silk - purple/magenta
  clothSilk: [
    '#100510', // 0
    '#200A18', // 1
    '#301020', // 2
    '#401528', // 3
    '#501A30', // 4
    '#602038', // 5
    '#702540', // 6
    '#802A48', // 7
  ],
  
  // Thatch/bamboo
  thatch: [
    '#1A1508', // 0
    '#2A250F', // 1
    '#3A3518', // 2
    '#4A4520', // 3
    '#5A5528', // 4
    '#6A6530', // 5
    '#7A7538', // 6
    '#8A8540', // 7
  ],
  
  // Fire/flame
  fire: [
    '#2A0A00', // 0 - ember
    '#4A1500', // 1
    '#6A2000', // 2
    '#8A3000', // 3
    '#AA4500', // 4
    '#CA6000', // 5 - orange
    '#EA8000', // 6
    '#FFAA20', // 7 - yellow tip
  ],
  
  // Night - blue overlay tones
  night: [
    '#000005', // 0
    '#00000A', // 1
    '#050510', // 2
    '#0A0A18', // 3
    '#101020', // 4
    '#151528', // 5
    '#1A1A30', // 6
    '#202038', // 7
  ],

  // Specular highlights - for metallic and wet surface glints
  specular: [
    '#B0B0B0', // 0 - dull glint
    '#C0C0C0', // 1
    '#D0D0D0', // 2
    '#E0E0E0', // 3
    '#E0F0FF', // 4 - cool specular
    '#FFFAE0', // 5 - warm specular
    '#FFF5D0', // 6
    '#FFFFFF', // 7 - pure white highlight
  ],

  // Indigo - batik and Indian textiles
  indigo: [
    '#0A0A20', '#141430', '#1A1A40', '#202050',
    '#2A2A60', '#353570', '#404080', '#4A5090',
  ],

  // Turmeric yellow - ceremonial, spice trade
  turmericYellow: [
    '#2A1A05', '#4A3010', '#6A4A10', '#8A6518',
    '#AA8020', '#C89A28', '#E8A020', '#F0B830',
  ],

  // Lacquer red - Chinese temple/furniture
  lacquerRed: [
    '#1A0505', '#2A0808', '#3A0505', '#5A1010',
    '#801818', '#AA2020', '#CC2020', '#E03030',
  ],

  // Indian skin tones - Tamil/Dravidian
  skinIndian: [
    '#180C04', '#2A1808', '#3A2410', '#4A3018',
    '#5A3C20', '#6A4828', '#7A5430', '#8B5030',
  ],
};

// Dithering patterns for VGA-style gradients (4x4 Bayer matrix)
const DITHER_MATRIX = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

// Get dithered color between two palette indices
function getDitheredColor(palette, idx1, idx2, x, y) {
  const threshold = DITHER_MATRIX[y % 4][x % 4];
  return threshold < 8 ? palette[idx1] : palette[idx2];
}

// Blend two colors with dithering
function blendDithered(color1, color2, x, y, threshold = 8) {
  const ditherValue = DITHER_MATRIX[y % 4][x % 4];
  return ditherValue < threshold ? color1 : color2;
}

// Parse hex color to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// RGB to hex
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// Interpolate between two colors
function lerpColor(color1, color2, t) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
}

// Add named shade accessors to every palette material (index 0-7)
Object.keys(PALETTE).forEach(key => {
  const arr = PALETTE[key];
  arr.darkest  = arr[0];
  arr.dark     = arr[1];
  arr.midDark  = arr[2];
  arr.mid      = arr[3];
  arr.midLight = arr[4];
  arr.light    = arr[5];
  arr.bright   = arr[6];
  arr.lightest = arr[7];
});

// Find nearest palette color for a given hex color
function nearestPaletteColor(hex) {
  const target = hexToRgb(hex);
  if (!target) return hex;
  let bestDist = Infinity;
  let bestColor = hex;
  Object.values(PALETTE).forEach(shades => {
    for (let i = 0; i < 8; i++) {
      const c = hexToRgb(shades[i]);
      if (!c) continue;
      const dist = (c.r - target.r) ** 2 + (c.g - target.g) ** 2 + (c.b - target.b) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestColor = shades[i];
      }
    }
  });
  return bestColor;
}

// Collect all palette colors into a flat array for quantization
function getAllPaletteColors() {
  const colors = [];
  Object.values(PALETTE).forEach(shades => {
    for (let i = 0; i < 8; i++) {
      const rgb = hexToRgb(shades[i]);
      if (rgb) colors.push({ hex: shades[i], ...rgb });
    }
  });
  return colors;
}

module.exports = {
  PALETTE,
  DITHER_MATRIX,
  getDitheredColor,
  blendDithered,
  hexToRgb,
  rgbToHex,
  lerpColor,
  nearestPaletteColor,
  getAllPaletteColors
};
