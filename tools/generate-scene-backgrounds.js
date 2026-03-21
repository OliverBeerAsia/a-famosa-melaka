/**
 * Scene Background Generator - Ultima VIII style
 *
 * Creates detailed, atmospheric backgrounds inspired by Ultima VIII-era dense isometric pixel art
 * with historically accurate 1580s Portuguese Melaka architecture
 *
 * Features:
 * - Ordered dithering for smooth gradients
 * - Textured surfaces (stone, wood, plaster)
 * - Atmospheric depth with color separation
 * - Period-accurate architectural details
 * - No painted-in people (NPCs are separate sprites)
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'scenes');

// Extended Art Bible palette for detailed backgrounds
const PALETTE = {
  // Sky gradient colors
  skyDeep: '#1a3a5c',
  skyMid: '#4a7ba7',
  skyLight: '#7eb5d6',
  skyHorizon: '#c9dae8',
  sunsetGold: '#e8b84a',
  sunsetOrange: '#d4763a',
  sunsetPink: '#d49a8a',

  // Portuguese colonial architecture
  whitewashBright: '#f5f0e6',
  whitewashMid: '#e8dcc8',
  whitewashShadow: '#c4b8a4',
  whitewashDark: '#9a8f7d',

  // Terracotta roofing
  terracottaLight: '#d4724a',
  terracottaMid: '#b85a3a',
  terracottaDark: '#8a3a2a',
  terracottaShadow: '#5c2a1a',

  // Stone fortress
  stoneLight: '#a89a8a',
  stoneMid: '#8a7a6a',
  stoneDark: '#6a5a4a',
  stoneShadow: '#4a3a2a',
  stoneHighlight: '#c8baa8',

  // Wood tones
  woodLight: '#c4a060',
  woodMid: '#9a7a40',
  woodDark: '#6a5030',
  woodShadow: '#4a3520',
  woodHighlight: '#d8b878',

  // Tropical vegetation
  jungleLight: '#5a9a4a',
  jungleMid: '#3a7a3a',
  jungleDark: '#2a5a2a',
  jungleShadow: '#1a3a1a',
  palmGreen: '#4a8a3a',

  // Water
  waterLight: '#5aaab8',
  waterMid: '#3a8a9a',
  waterDark: '#2a6a7a',
  waterDeep: '#1a4a5a',
  waterHighlight: '#8acad8',

  // Ground surfaces
  cobbleLight: '#9a8a7a',
  cobbleMid: '#7a6a5a',
  cobbleDark: '#5a4a3a',
  dirtLight: '#b89a6a',
  dirtMid: '#9a7a4a',
  dirtDark: '#7a5a3a',
  sandLight: '#e8d8a8',
  sandMid: '#d4c490',
  sandDark: '#b0a070',

  // Accents
  azulejoBlue: '#2a5a8a',
  azulejoWhite: '#e8e8f0',
  ironBlack: '#2a2a2a',
  ironRust: '#6a4030',
  goldAccent: '#d4a030',
  redCloth: '#a82020',

  // Shadows and atmosphere
  shadowLight: 'rgba(0,0,0,0.15)',
  shadowMid: 'rgba(0,0,0,0.3)',
  shadowDark: 'rgba(0,0,0,0.5)',
  mistLight: 'rgba(200,220,240,0.2)',
  dustHaze: 'rgba(180,160,120,0.15)',
  goldenHaze: 'rgba(220,180,80,0.12)'
};

// Bayer 4x4 dithering matrix for Ultima VIII style gradients
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

function createCanvas2D(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function saveCanvas(canvas, filename) {
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, buffer);
  console.log('Created:', filename);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function lerpColor(color1, color2, t) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
}

// Dithered gradient for Ultima VIII style skies
function drawDitheredGradient(ctx, x, y, width, height, colors) {
  for (let py = 0; py < height; py++) {
    const t = py / height;
    const colorIndex = t * (colors.length - 1);
    const i = Math.floor(colorIndex);
    const localT = colorIndex - i;

    const color1 = colors[Math.min(i, colors.length - 1)];
    const color2 = colors[Math.min(i + 1, colors.length - 1)];

    for (let px = 0; px < width; px++) {
      const threshold = BAYER_4X4[py % 4][px % 4] / 16;
      const useColor2 = localT > threshold;
      ctx.fillStyle = useColor2 ? color2 : color1;
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
}

// Textured rectangle with noise
function drawTexturedRect(ctx, x, y, w, h, baseColor, variation = 10) {
  const base = hexToRgb(baseColor);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const noise = (Math.random() - 0.5) * variation;
      ctx.fillStyle = rgbToHex(
        base.r + noise,
        base.g + noise,
        base.b + noise
      );
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
}

// Stone texture with mortar lines
function drawStoneWall(ctx, x, y, w, h, stoneColor, mortarColor, stoneW = 24, stoneH = 12) {
  // Fill with mortar
  ctx.fillStyle = mortarColor;
  ctx.fillRect(x, y, w, h);

  // Draw stones with offset pattern
  let row = 0;
  for (let py = y; py < y + h; py += stoneH + 2) {
    const offset = (row % 2) * (stoneW / 2);
    for (let px = x - stoneW + offset; px < x + w; px += stoneW + 2) {
      const actualX = Math.max(x, px);
      const actualW = Math.min(px + stoneW, x + w) - actualX;
      if (actualW > 0) {
        // Stone base
        const base = hexToRgb(stoneColor);
        const variation = Math.random() * 15 - 7;
        ctx.fillStyle = rgbToHex(base.r + variation, base.g + variation, base.b + variation);
        ctx.fillRect(actualX, py, actualW, stoneH);

        // Highlight top edge
        ctx.fillStyle = PALETTE.stoneHighlight;
        ctx.fillRect(actualX, py, actualW, 1);

        // Shadow bottom edge
        ctx.fillStyle = PALETTE.stoneShadow;
        ctx.fillRect(actualX, py + stoneH - 1, actualW, 1);
      }
    }
    row++;
  }
}

// Terracotta roof tiles
function drawTerracottaRoof(ctx, x, y, w, h) {
  // Base layer
  ctx.fillStyle = PALETTE.terracottaDark;
  ctx.fillRect(x, y, w, h);

  // Tile rows
  for (let py = y; py < y + h; py += 8) {
    const offset = ((py - y) / 8 % 2) * 10;
    for (let px = x + offset; px < x + w; px += 20) {
      // Individual tile
      const tileW = Math.min(18, x + w - px);
      if (tileW > 0) {
        // Curved tile shape simulation
        ctx.fillStyle = PALETTE.terracottaLight;
        ctx.fillRect(px, py, tileW, 2);
        ctx.fillStyle = PALETTE.terracottaMid;
        ctx.fillRect(px, py + 2, tileW, 4);
        ctx.fillStyle = PALETTE.terracottaDark;
        ctx.fillRect(px, py + 6, tileW, 2);
      }
    }
  }

  // Shadow at bottom
  ctx.fillStyle = PALETTE.terracottaShadow;
  ctx.fillRect(x, y + h - 3, w, 3);
}

// Wooden planks texture
function drawWoodPlanks(ctx, x, y, w, h, horizontal = true) {
  const plankSize = horizontal ? 16 : 12;

  for (let i = 0; i < (horizontal ? h : w); i += plankSize) {
    const variation = Math.random() * 20 - 10;
    const base = hexToRgb(PALETTE.woodMid);
    ctx.fillStyle = rgbToHex(base.r + variation, base.g + variation * 0.8, base.b + variation * 0.5);

    if (horizontal) {
      ctx.fillRect(x, y + i, w, plankSize - 1);
      // Wood grain
      for (let g = 0; g < 3; g++) {
        ctx.fillStyle = PALETTE.woodDark;
        const grainY = y + i + 2 + g * 4 + Math.random() * 2;
        ctx.fillRect(x, grainY, w, 1);
      }
      // Gap between planks
      ctx.fillStyle = PALETTE.woodShadow;
      ctx.fillRect(x, y + i + plankSize - 1, w, 1);
    } else {
      ctx.fillRect(x + i, y, plankSize - 1, h);
      ctx.fillStyle = PALETTE.woodShadow;
      ctx.fillRect(x + i + plankSize - 1, y, 1, h);
    }
  }
}

// Cobblestone ground texture
function drawCobblestones(ctx, x, y, w, h) {
  // Base dirt
  ctx.fillStyle = PALETTE.dirtMid;
  ctx.fillRect(x, y, w, h);

  // Irregular cobblestones
  for (let py = y; py < y + h; py += 14) {
    const rowOffset = (Math.floor((py - y) / 14) % 2) * 8;
    for (let px = x + rowOffset; px < x + w; px += 16) {
      const stoneW = 12 + Math.random() * 4;
      const stoneH = 10 + Math.random() * 4;
      const actualX = Math.max(x, px);
      const actualW = Math.min(stoneW, x + w - px);

      if (actualW > 4) {
        // Stone with variation
        const shade = Math.random() * 30 - 15;
        const base = hexToRgb(PALETTE.cobbleMid);
        ctx.fillStyle = rgbToHex(base.r + shade, base.g + shade, base.b + shade);
        ctx.fillRect(actualX + 1, py + 1, actualW - 2, stoneH - 2);

        // Highlight
        ctx.fillStyle = PALETTE.cobbleLight;
        ctx.fillRect(actualX + 1, py + 1, actualW - 2, 1);
        ctx.fillRect(actualX + 1, py + 1, 1, stoneH - 2);

        // Shadow
        ctx.fillStyle = PALETTE.cobbleDark;
        ctx.fillRect(actualX + 1, py + stoneH - 2, actualW - 2, 1);
        ctx.fillRect(actualX + actualW - 2, py + 1, 1, stoneH - 2);
      }
    }
  }
}

// Portuguese colonial window with shutters
function drawWindow(ctx, x, y, w, h, open = false) {
  // Window recess (dark)
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(x, y, w, h);

  // Frame
  ctx.fillStyle = PALETTE.whitewashShadow;
  ctx.fillRect(x - 2, y - 2, w + 4, 3);
  ctx.fillRect(x - 2, y + h - 1, w + 4, 3);
  ctx.fillRect(x - 2, y, 3, h);
  ctx.fillRect(x + w - 1, y, 3, h);

  // Window sill
  ctx.fillStyle = PALETTE.whitewashMid;
  ctx.fillRect(x - 4, y + h, w + 8, 4);
  ctx.fillStyle = PALETTE.whitewashDark;
  ctx.fillRect(x - 4, y + h + 3, w + 8, 2);

  // Shutters
  if (!open) {
    const shutterW = w / 2 - 1;
    ctx.fillStyle = PALETTE.woodMid;
    ctx.fillRect(x, y, shutterW, h);
    ctx.fillRect(x + w - shutterW, y, shutterW, h);

    // Shutter slats
    ctx.fillStyle = PALETTE.woodDark;
    for (let sy = y + 4; sy < y + h - 4; sy += 6) {
      ctx.fillRect(x + 2, sy, shutterW - 4, 2);
      ctx.fillRect(x + w - shutterW + 2, sy, shutterW - 4, 2);
    }
  }
}

// Arched doorway (Portuguese style)
function drawArchedDoor(ctx, x, y, w, h, hasArch = true) {
  // Door recess
  ctx.fillStyle = '#0a0a15';
  ctx.fillRect(x, y + (hasArch ? h * 0.15 : 0), w, h * (hasArch ? 0.85 : 1));

  if (hasArch) {
    // Arch
    ctx.fillStyle = '#0a0a15';
    ctx.beginPath();
    ctx.arc(x + w/2, y + h * 0.15, w/2, Math.PI, 0, false);
    ctx.fill();

    // Arch stone border
    ctx.strokeStyle = PALETTE.stoneMid;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + w/2, y + h * 0.15, w/2 + 2, Math.PI, 0, false);
    ctx.stroke();
  }

  // Door frame
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(x - 3, y + (hasArch ? h * 0.15 : 0), 4, h * (hasArch ? 0.85 : 1));
  ctx.fillRect(x + w - 1, y + (hasArch ? h * 0.15 : 0), 4, h * (hasArch ? 0.85 : 1));

  // Threshold
  ctx.fillStyle = PALETTE.stoneDark;
  ctx.fillRect(x - 4, y + h - 3, w + 8, 5);
}

// Decorative balcony
function drawBalcony(ctx, x, y, w) {
  // Platform
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(x, y + 5, w, 2);

  // Decorative brackets
  const bracketSpacing = 40;
  for (let bx = x + 10; bx < x + w - 10; bx += bracketSpacing) {
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(bx, y + 7, 6, 12);
    ctx.fillRect(bx - 3, y + 15, 12, 4);
  }

  // Iron railing
  ctx.fillStyle = PALETTE.ironBlack;
  ctx.fillRect(x, y - 20, w, 2);
  ctx.fillRect(x, y - 2, w, 2);

  // Railing posts
  for (let rx = x + 8; rx < x + w - 5; rx += 12) {
    ctx.fillRect(rx, y - 20, 2, 20);
  }
}

// Palm tree
function drawPalmTree(ctx, x, y, height, frondCount = 7) {
  // Trunk with texture
  const trunkW = 12;
  for (let ty = 0; ty < height; ty += 8) {
    const taper = 1 - (ty / height) * 0.3;
    const segW = trunkW * taper;
    const segX = x - segW/2;

    ctx.fillStyle = ty % 16 < 8 ? PALETTE.woodMid : PALETTE.woodDark;
    ctx.fillRect(segX, y + ty, segW, 8);

    // Ring detail
    ctx.fillStyle = PALETTE.woodShadow;
    ctx.fillRect(segX, y + ty + 7, segW, 1);
  }

  // Fronds
  const frondColors = [PALETTE.jungleDark, PALETTE.jungleMid, PALETTE.palmGreen];
  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2;
    const frondLength = 50 + Math.random() * 20;

    ctx.fillStyle = frondColors[f % frondColors.length];

    // Draw frond as series of leaves
    for (let fl = 0; fl < frondLength; fl += 4) {
      const fx = x + Math.cos(angle) * fl;
      const fy = y - 10 + Math.sin(angle) * fl * 0.5 + (fl * fl * 0.003);
      const leafW = 8 - (fl / frondLength) * 6;
      ctx.fillRect(fx - leafW/2, fy, leafW, 4);
    }
  }
}

// Market awning
function drawAwning(ctx, x, y, w, h, stripeColor1, stripeColor2) {
  const stripeW = 12;
  for (let sx = 0; sx < w; sx += stripeW * 2) {
    ctx.fillStyle = stripeColor1;
    ctx.fillRect(x + sx, y, Math.min(stripeW, w - sx), h);
    if (sx + stripeW < w) {
      ctx.fillStyle = stripeColor2;
      ctx.fillRect(x + sx + stripeW, y, Math.min(stripeW, w - sx - stripeW), h);
    }
  }

  // Scalloped edge
  ctx.fillStyle = stripeColor1;
  for (let sx = x; sx < x + w; sx += 16) {
    ctx.beginPath();
    ctx.arc(sx + 8, y + h, 8, 0, Math.PI, false);
    ctx.fill();
  }

  // Shadow under awning
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x, y + h + 6, w, 20);

  // Support poles
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(x + 4, y, 4, h + 60);
  ctx.fillRect(x + w - 8, y, 4, h + 60);
}

// Wooden barrel
function drawBarrel(ctx, x, y, w, h) {
  // Barrel body
  const bulge = w * 0.15;

  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(x + bulge/2, y, w - bulge, h);
  ctx.fillRect(x, y + h * 0.3, w, h * 0.4);

  // Metal bands
  ctx.fillStyle = PALETTE.ironBlack;
  ctx.fillRect(x, y + 3, w, 3);
  ctx.fillRect(x, y + h * 0.45, w, 3);
  ctx.fillRect(x, y + h - 6, w, 3);

  // Highlight
  ctx.fillStyle = PALETTE.woodHighlight;
  ctx.fillRect(x + w * 0.3, y + 8, 2, h - 16);
}

// Crate
function drawCrate(ctx, x, y, w, h) {
  // Main body
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(x, y, w, h);

  // Planks
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillRect(x + w/2 - 1, y, 2, h);

  // Cross braces
  ctx.fillRect(x + 4, y + h/3, w - 8, 2);
  ctx.fillRect(x + 4, y + h * 2/3, w - 8, 2);
}

// ============================================================================
// RUA DIREITA - Market Street (Main commercial thoroughfare)
// ============================================================================
function generateRuaDireita() {
  const width = 960;
  const height = 540;
  const { canvas, ctx } = createCanvas2D(width, height);

  // === SKY - Golden afternoon with dithered gradient ===
  drawDitheredGradient(ctx, 0, 0, width, 180, [
    PALETTE.skyMid,
    PALETTE.skyLight,
    PALETTE.skyHorizon,
    PALETTE.sunsetGold
  ]);

  // === BACKGROUND BUILDINGS (far) ===
  // These create depth - lighter, less detailed

  // Far left building silhouette
  ctx.fillStyle = PALETTE.whitewashShadow;
  ctx.fillRect(0, 80, 120, 200);
  drawTerracottaRoof(ctx, -10, 60, 140, 25);

  // Far center-left building
  ctx.fillStyle = PALETTE.whitewashDark;
  ctx.fillRect(100, 100, 150, 180);
  drawTerracottaRoof(ctx, 90, 75, 170, 30);

  // Far center building (church tower hint)
  ctx.fillStyle = PALETTE.whitewashShadow;
  ctx.fillRect(380, 40, 60, 160);
  ctx.fillStyle = PALETTE.whitewashDark;
  ctx.fillRect(378, 35, 64, 8);
  // Cross
  ctx.fillStyle = PALETTE.ironBlack;
  ctx.fillRect(407, 20, 4, 20);
  ctx.fillRect(400, 27, 18, 4);

  // Far right buildings
  ctx.fillStyle = PALETTE.whitewashShadow;
  ctx.fillRect(500, 90, 180, 190);
  drawTerracottaRoof(ctx, 490, 65, 200, 30);

  ctx.fillStyle = PALETTE.whitewashDark;
  ctx.fillRect(700, 70, 260, 210);
  drawTerracottaRoof(ctx, 690, 45, 280, 30);

  // === MIDGROUND - Main buildings with full detail ===

  // LEFT BUILDING - Portuguese merchant house
  const leftBldgX = 0;
  const leftBldgY = 140;
  const leftBldgW = 220;
  const leftBldgH = 260;

  // Wall with texture
  drawTexturedRect(ctx, leftBldgX, leftBldgY, leftBldgW, leftBldgH, PALETTE.whitewashMid, 8);

  // Roof
  drawTerracottaRoof(ctx, leftBldgX - 15, leftBldgY - 40, leftBldgW + 30, 45);

  // Shadow under eaves
  ctx.fillStyle = PALETTE.whitewashShadow;
  ctx.fillRect(leftBldgX, leftBldgY, leftBldgW, 15);

  // Second floor windows with shutters
  drawWindow(ctx, 30, leftBldgY + 30, 40, 55, false);
  drawWindow(ctx, 90, leftBldgY + 30, 40, 55, true);
  drawWindow(ctx, 150, leftBldgY + 30, 40, 55, false);

  // Balcony
  drawBalcony(ctx, 20, leftBldgY + 100, 180);

  // Ground floor - large merchant doorway
  drawArchedDoor(ctx, 70, leftBldgY + 130, 80, 130);

  // Decorative azulejo panel
  ctx.fillStyle = PALETTE.azulejoBlue;
  ctx.fillRect(165, leftBldgY + 140, 40, 60);
  ctx.fillStyle = PALETTE.azulejoWhite;
  for (let ay = 0; ay < 6; ay++) {
    for (let ax = 0; ax < 4; ax++) {
      if ((ax + ay) % 2 === 0) {
        ctx.fillRect(167 + ax * 9, leftBldgY + 142 + ay * 9, 7, 7);
      }
    }
  }

  // CENTER BUILDING - Colonnade/arcade
  const centerX = 280;
  const centerY = 150;

  ctx.fillStyle = PALETTE.whitewashMid;
  ctx.fillRect(centerX, centerY, 400, 250);

  drawTerracottaRoof(ctx, centerX - 10, centerY - 35, 420, 40);

  // Arcade arches
  const archWidth = 65;
  const archHeight = 120;
  for (let i = 0; i < 5; i++) {
    const ax = centerX + 30 + i * 75;

    // Deep shadow in arcade
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(ax, centerY + 85, archWidth, archHeight);

    // Arch top
    ctx.beginPath();
    ctx.arc(ax + archWidth/2, centerY + 85, archWidth/2, Math.PI, 0, false);
    ctx.fill();

    // Arch stone detail
    ctx.strokeStyle = PALETTE.whitewashShadow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ax + archWidth/2, centerY + 85, archWidth/2 + 2, Math.PI, 0, false);
    ctx.stroke();

    // Column
    ctx.fillStyle = PALETTE.whitewashBright;
    ctx.fillRect(ax - 6, centerY + 85, 8, archHeight);
    ctx.fillStyle = PALETTE.whitewashShadow;
    ctx.fillRect(ax - 8, centerY + 80, 12, 8);
    ctx.fillRect(ax - 8, centerY + 85 + archHeight - 5, 12, 8);
  }

  // Upper floor windows
  for (let i = 0; i < 4; i++) {
    drawWindow(ctx, centerX + 50 + i * 95, centerY + 20, 35, 50, i % 2 === 0);
  }

  // Sign board
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(centerX + 170, centerY + 60, 80, 25);
  ctx.fillStyle = PALETTE.goldAccent;
  ctx.fillRect(centerX + 175, centerY + 65, 70, 15);

  // RIGHT BUILDING - Taller merchant house
  const rightBldgX = 740;
  const rightBldgY = 100;

  drawTexturedRect(ctx, rightBldgX, rightBldgY, 220, 300, PALETTE.whitewashBright, 8);

  drawTerracottaRoof(ctx, rightBldgX - 15, rightBldgY - 45, 250, 50);

  // Windows - 3 floors
  for (let floor = 0; floor < 3; floor++) {
    for (let w = 0; w < 3; w++) {
      drawWindow(ctx, rightBldgX + 25 + w * 65, rightBldgY + 25 + floor * 85, 38, 55, floor === 1);
    }
  }

  // Ground floor shop front
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(rightBldgX + 10, rightBldgY + 270, 200, 80);
  drawArchedDoor(ctx, rightBldgX + 80, rightBldgY + 260, 60, 90, false);

  // Balconies
  drawBalcony(ctx, rightBldgX + 15, rightBldgY + 90, 190);
  drawBalcony(ctx, rightBldgX + 15, rightBldgY + 175, 190);

  // === MARKET STALLS AND AWNINGS ===

  // Left awning - red/white stripes
  drawAwning(ctx, 230, 280, 120, 30, PALETTE.redCloth, PALETTE.whitewashBright);

  // Market table under awning
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(235, 340, 110, 20);
  drawWoodPlanks(ctx, 235, 340, 110, 20, true);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(245, 360, 8, 35);
  ctx.fillRect(327, 360, 8, 35);

  // Right awning - orange/gold
  drawAwning(ctx, 580, 290, 140, 28, PALETTE.sunsetOrange, PALETTE.sunsetGold);

  // Market table
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(585, 348, 130, 18);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(595, 366, 6, 30);
  ctx.fillRect(699, 366, 6, 30);

  // === GROUND - Cobblestone street ===
  drawCobblestones(ctx, 0, 395, width, 145);

  // Drainage channel down center
  ctx.fillStyle = PALETTE.stoneDark;
  ctx.fillRect(450, 395, 60, 145);
  ctx.fillStyle = '#1a2a3a';
  ctx.fillRect(455, 400, 50, 135);

  // === STREET DETAILS ===

  // Barrels near left building
  drawBarrel(ctx, 200, 360, 25, 35);
  drawBarrel(ctx, 180, 365, 22, 30);

  // Crates near right
  drawCrate(ctx, 730, 370, 30, 25);
  drawCrate(ctx, 755, 375, 25, 20);

  // Hanging lantern (left building)
  ctx.fillStyle = PALETTE.ironBlack;
  ctx.fillRect(208, 240, 2, 25);
  ctx.fillStyle = PALETTE.goldAccent;
  ctx.fillRect(200, 265, 18, 22);
  ctx.fillStyle = '#fff8e0';
  ctx.fillRect(204, 269, 10, 14);

  // Hanging sign (center arcade)
  ctx.fillStyle = PALETTE.ironBlack;
  ctx.fillRect(380, 195, 2, 15);
  ctx.fillRect(370, 210, 24, 2);
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(365, 212, 34, 24);

  // === ATMOSPHERIC OVERLAYS ===

  // Golden dust haze (thicker at bottom)
  const dustGradient = ctx.createLinearGradient(0, 0, 0, height);
  dustGradient.addColorStop(0, 'rgba(220,180,100,0.05)');
  dustGradient.addColorStop(0.5, 'rgba(200,160,80,0.12)');
  dustGradient.addColorStop(1, 'rgba(180,140,60,0.18)');
  ctx.fillStyle = dustGradient;
  ctx.fillRect(0, 0, width, height);

  // Warm light from right (late afternoon sun)
  const sunGradient = ctx.createLinearGradient(width, 0, 0, height);
  sunGradient.addColorStop(0, 'rgba(255,200,100,0.15)');
  sunGradient.addColorStop(0.6, 'rgba(255,180,80,0.05)');
  sunGradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sunGradient;
  ctx.fillRect(0, 0, width, height);

  saveCanvas(canvas, 'scene-rua-direita.png');
}

// ============================================================================
// A FAMOSA - Fortress Gate
// ============================================================================
function generateAFamosa() {
  const width = 960;
  const height = 540;
  const { canvas, ctx } = createCanvas2D(width, height);

  // === SKY ===
  drawDitheredGradient(ctx, 0, 0, width, 220, [
    PALETTE.skyDeep,
    PALETTE.skyMid,
    PALETTE.skyLight,
    PALETTE.skyHorizon
  ]);

  // Distant mountains/hills silhouette
  ctx.fillStyle = PALETTE.jungleShadow;
  ctx.beginPath();
  ctx.moveTo(0, 200);
  ctx.lineTo(100, 160);
  ctx.lineTo(200, 180);
  ctx.lineTo(350, 140);
  ctx.lineTo(500, 170);
  ctx.lineTo(650, 130);
  ctx.lineTo(800, 160);
  ctx.lineTo(900, 145);
  ctx.lineTo(width, 175);
  ctx.lineTo(width, 220);
  ctx.lineTo(0, 220);
  ctx.closePath();
  ctx.fill();

  // === FORTRESS WALLS ===

  // Left wall section
  drawStoneWall(ctx, 0, 150, 320, 250, PALETTE.stoneMid, PALETTE.stoneDark, 28, 14);

  // Left wall crenellations
  for (let i = 0; i < 8; i++) {
    const crenX = i * 40;
    drawStoneWall(ctx, crenX, 115, 28, 40, PALETTE.stoneMid, PALETTE.stoneDark, 28, 14);
  }

  // Right wall section
  drawStoneWall(ctx, 640, 150, 320, 250, PALETTE.stoneMid, PALETTE.stoneDark, 28, 14);

  // Right wall crenellations
  for (let i = 0; i < 8; i++) {
    const crenX = 650 + i * 40;
    drawStoneWall(ctx, crenX, 115, 28, 40, PALETTE.stoneMid, PALETTE.stoneDark, 28, 14);
  }

  // === MAIN GATE (A Famosa) ===
  const gateX = 320;
  const gateW = 320;

  // Gate structure
  drawStoneWall(ctx, gateX, 80, gateW, 320, PALETTE.stoneLight, PALETTE.stoneMid, 30, 16);

  // Gate towers
  drawStoneWall(ctx, gateX - 30, 50, 70, 350, PALETTE.stoneMid, PALETTE.stoneDark, 26, 14);
  drawStoneWall(ctx, gateX + gateW - 40, 50, 70, 350, PALETTE.stoneMid, PALETTE.stoneDark, 26, 14);

  // Tower tops
  for (let i = 0; i < 2; i++) {
    const towerX = i === 0 ? gateX - 35 : gateX + gateW - 45;
    // Crenellations
    for (let c = 0; c < 3; c++) {
      drawStoneWall(ctx, towerX + 5 + c * 25, 20, 18, 35, PALETTE.stoneMid, PALETTE.stoneDark);
    }
  }

  // Main archway
  const archX = gateX + 90;
  const archW = 140;
  const archY = 160;

  ctx.fillStyle = '#0a0a15';
  ctx.fillRect(archX, archY + 60, archW, 200);

  // Arch
  ctx.beginPath();
  ctx.arc(archX + archW/2, archY + 60, archW/2, Math.PI, 0, false);
  ctx.fill();

  // Arch stone detail
  ctx.strokeStyle = PALETTE.stoneHighlight;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(archX + archW/2, archY + 60, archW/2 + 4, Math.PI, 0, false);
  ctx.stroke();

  // Keystone
  ctx.fillStyle = PALETTE.stoneHighlight;
  ctx.fillRect(archX + archW/2 - 12, archY - 15, 24, 30);

  // Portuguese coat of arms above gate
  ctx.fillStyle = PALETTE.whitewashBright;
  ctx.fillRect(archX + archW/2 - 40, archY - 80, 80, 55);
  ctx.fillStyle = PALETTE.stoneMid;
  ctx.fillRect(archX + archW/2 - 38, archY - 78, 76, 51);
  // Shield shape
  ctx.fillStyle = '#8B0000';
  ctx.fillRect(archX + archW/2 - 30, archY - 70, 60, 40);
  // Cross
  ctx.fillStyle = PALETTE.whitewashBright;
  ctx.fillRect(archX + archW/2 - 3, archY - 68, 6, 36);
  ctx.fillRect(archX + archW/2 - 20, archY - 55, 40, 6);

  // === GROUND ===

  // Sandy approach
  drawTexturedRect(ctx, 0, 400, width, 140, PALETTE.sandMid, 15);

  // Stone path to gate
  drawCobblestones(ctx, 340, 400, 280, 140);

  // Grass/vegetation at edges
  ctx.fillStyle = PALETTE.jungleMid;
  ctx.fillRect(0, 395, 150, 15);
  ctx.fillRect(width - 150, 395, 150, 15);

  // === CANNONS ===
  // Left cannon
  ctx.fillStyle = PALETTE.ironBlack;
  ctx.fillRect(100, 360, 50, 18);
  ctx.fillRect(95, 372, 20, 25);
  // Wheels
  ctx.beginPath();
  ctx.arc(110, 390, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(140, 390, 15, 0, Math.PI * 2);
  ctx.fill();

  // Right cannon
  ctx.fillRect(width - 150, 360, 50, 18);
  ctx.fillRect(width - 115, 372, 20, 25);
  ctx.beginPath();
  ctx.arc(width - 140, 390, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width - 110, 390, 15, 0, Math.PI * 2);
  ctx.fill();

  // === PALM TREES ===
  drawPalmTree(ctx, 50, 180, 180);
  drawPalmTree(ctx, width - 60, 160, 200);

  // Small palms
  drawPalmTree(ctx, 200, 280, 100);
  drawPalmTree(ctx, width - 180, 290, 90);

  // === ATMOSPHERIC ===

  // Dust haze
  const dustGradient = ctx.createLinearGradient(0, 200, 0, height);
  dustGradient.addColorStop(0, 'rgba(180,160,120,0.08)');
  dustGradient.addColorStop(1, 'rgba(180,160,120,0.2)');
  ctx.fillStyle = dustGradient;
  ctx.fillRect(0, 0, width, height);

  saveCanvas(canvas, 'scene-a-famosa.png');
}

// ============================================================================
// ST PAUL'S CHURCH - Hilltop church
// ============================================================================
function generateStPauls() {
  const width = 960;
  const height = 540;
  const { canvas, ctx } = createCanvas2D(width, height);

  // === SKY - Serene blue ===
  drawDitheredGradient(ctx, 0, 0, width, 200, [
    '#2a5a8a',
    PALETTE.skyMid,
    PALETTE.skyLight,
    '#e8e0d0'
  ]);

  // === HILLSIDE ===

  // Background trees
  ctx.fillStyle = PALETTE.jungleShadow;
  ctx.fillRect(0, 180, width, 60);

  for (let i = 0; i < 30; i++) {
    const tx = i * 35 + Math.random() * 20 - 10;
    const th = 40 + Math.random() * 40;
    ctx.fillStyle = i % 3 === 0 ? PALETTE.jungleDark : PALETTE.jungleShadow;
    ctx.beginPath();
    ctx.moveTo(tx, 240);
    ctx.lineTo(tx + 15, 240 - th);
    ctx.lineTo(tx + 30, 240);
    ctx.closePath();
    ctx.fill();
  }

  // Hill
  ctx.fillStyle = PALETTE.jungleMid;
  ctx.fillRect(0, 230, width, 310);

  // Grass texture
  for (let y = 240; y < height; y += 3) {
    for (let x = 0; x < width; x += 8) {
      const shade = Math.random() * 20 - 10;
      const base = hexToRgb(PALETTE.jungleMid);
      ctx.fillStyle = rgbToHex(base.r + shade, base.g + shade, base.b + shade * 0.5);
      ctx.fillRect(x, y, 6, 3);
    }
  }

  // === STONE PATH ===
  drawCobblestones(ctx, 350, 280, 260, 260);

  // Steps going up
  for (let s = 0; s < 6; s++) {
    ctx.fillStyle = s % 2 === 0 ? PALETTE.stoneMid : PALETTE.stoneDark;
    ctx.fillRect(360, 280 + s * 20, 240, 20);
    ctx.fillStyle = PALETTE.stoneHighlight;
    ctx.fillRect(360, 280 + s * 20, 240, 2);
  }

  // === CHURCH ===
  const churchX = 300;
  const churchY = 80;
  const churchW = 360;
  const churchH = 200;

  // Main building
  drawTexturedRect(ctx, churchX, churchY + 60, churchW, churchH, PALETTE.whitewashBright, 8);

  // Peaked roof
  ctx.fillStyle = PALETTE.terracottaDark;
  ctx.beginPath();
  ctx.moveTo(churchX - 20, churchY + 65);
  ctx.lineTo(churchX + churchW/2, churchY - 30);
  ctx.lineTo(churchX + churchW + 20, churchY + 65);
  ctx.closePath();
  ctx.fill();

  // Roof tiles
  for (let ty = 0; ty < 80; ty += 10) {
    const roofY = churchY - 20 + ty;
    const roofLeft = churchX + (ty * 2);
    const roofRight = churchX + churchW - (ty * 2);
    ctx.fillStyle = ty % 20 < 10 ? PALETTE.terracottaMid : PALETTE.terracottaDark;
    ctx.fillRect(roofLeft, roofY, roofRight - roofLeft, 10);
  }

  // Bell tower
  const towerX = churchX + churchW/2 - 35;
  const towerY = churchY - 90;

  drawTexturedRect(ctx, towerX, towerY, 70, 95, PALETTE.whitewashBright, 6);

  // Tower roof
  ctx.fillStyle = PALETTE.terracottaDark;
  ctx.beginPath();
  ctx.moveTo(towerX - 8, towerY + 5);
  ctx.lineTo(towerX + 35, towerY - 35);
  ctx.lineTo(towerX + 78, towerY + 5);
  ctx.closePath();
  ctx.fill();

  // Cross
  ctx.fillStyle = PALETTE.ironBlack;
  ctx.fillRect(towerX + 32, towerY - 55, 6, 30);
  ctx.fillRect(towerX + 22, towerY - 48, 26, 5);

  // Bell opening
  ctx.fillStyle = '#0a0a15';
  ctx.fillRect(towerX + 15, towerY + 20, 40, 50);
  ctx.beginPath();
  ctx.arc(towerX + 35, towerY + 20, 20, Math.PI, 0, false);
  ctx.fill();

  // Bell
  ctx.fillStyle = PALETTE.goldAccent;
  ctx.fillRect(towerX + 27, towerY + 35, 16, 20);

  // Rose window
  ctx.fillStyle = '#0a0a15';
  ctx.beginPath();
  ctx.arc(churchX + churchW/2, churchY + 100, 35, 0, Math.PI * 2);
  ctx.fill();

  // Stained glass hint
  ctx.fillStyle = PALETTE.azulejoBlue;
  ctx.beginPath();
  ctx.arc(churchX + churchW/2, churchY + 100, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.goldAccent;
  ctx.beginPath();
  ctx.arc(churchX + churchW/2, churchY + 100, 12, 0, Math.PI * 2);
  ctx.fill();

  // Main door
  drawArchedDoor(ctx, churchX + churchW/2 - 40, churchY + 150, 80, 110);

  // Side windows
  drawWindow(ctx, churchX + 30, churchY + 90, 35, 55, false);
  drawWindow(ctx, churchX + 85, churchY + 90, 35, 55, false);
  drawWindow(ctx, churchX + churchW - 65, churchY + 90, 35, 55, false);
  drawWindow(ctx, churchX + churchW - 120, churchY + 90, 35, 55, false);

  // === GRAVESTONES ===
  const graves = [
    { x: 120, y: 340 }, { x: 160, y: 350 }, { x: 200, y: 335 },
    { x: 720, y: 345 }, { x: 770, y: 355 }, { x: 820, y: 340 }
  ];

  graves.forEach(g => {
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(g.x, g.y, 22, 35);
    ctx.fillStyle = PALETTE.stoneMid;
    ctx.fillRect(g.x + 2, g.y + 2, 18, 3);
    // Cross on gravestone
    ctx.fillStyle = PALETTE.stoneHighlight;
    ctx.fillRect(g.x + 9, g.y + 8, 4, 15);
    ctx.fillRect(g.x + 5, g.y + 12, 12, 3);
  });

  // === TREES ===
  // Cypress trees (typical of Portuguese church grounds)
  const cypresses = [
    { x: 80, y: 150, h: 180 },
    { x: 140, y: 180, h: 140 },
    { x: 780, y: 160, h: 170 },
    { x: 850, y: 190, h: 130 }
  ];

  cypresses.forEach(c => {
    // Trunk
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(c.x - 4, c.y + c.h - 30, 8, 30);

    // Foliage (pointed oval)
    ctx.fillStyle = PALETTE.jungleDark;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + c.h/2, 18, c.h/2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.jungleShadow;
    ctx.beginPath();
    ctx.ellipse(c.x - 5, c.y + c.h/2, 10, c.h/2 - 10, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // === ATMOSPHERIC ===

  // Divine light from above
  const lightGradient = ctx.createRadialGradient(
    churchX + churchW/2, churchY, 50,
    churchX + churchW/2, churchY + 100, 300
  );
  lightGradient.addColorStop(0, 'rgba(255,255,240,0.2)');
  lightGradient.addColorStop(0.5, 'rgba(255,255,220,0.08)');
  lightGradient.addColorStop(1, 'rgba(255,255,220,0)');
  ctx.fillStyle = lightGradient;
  ctx.fillRect(0, 0, width, height);

  saveCanvas(canvas, 'scene-st-pauls.png');
}

// ============================================================================
// WATERFRONT - Harbor and docks
// ============================================================================
function generateWaterfront() {
  const width = 960;
  const height = 540;
  const { canvas, ctx } = createCanvas2D(width, height);

  // === SKY ===
  drawDitheredGradient(ctx, 0, 0, width, 160, [
    PALETTE.skyMid,
    PALETTE.skyLight,
    PALETTE.sunsetPink,
    PALETTE.sunsetGold
  ]);

  // === WATER ===
  // Ocean with wave pattern
  for (let y = 160; y < 320; y++) {
    const t = (y - 160) / 160;
    const waveOffset = Math.sin(y * 0.1) * 3;

    for (let x = 0; x < width; x++) {
      const waveX = Math.sin((x + waveOffset) * 0.05 + y * 0.02) * 0.5 + 0.5;
      const color = lerpColor(
        lerpColor(PALETTE.waterLight, PALETTE.waterMid, t),
        lerpColor(PALETTE.waterMid, PALETTE.waterDark, t),
        waveX
      );
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Wave highlights
  ctx.fillStyle = PALETTE.waterHighlight;
  for (let i = 0; i < 25; i++) {
    const wx = i * 40 + Math.sin(i) * 15;
    const wy = 180 + Math.sin(i * 0.7) * 20;
    ctx.fillRect(wx, wy, 20, 2);
  }
  for (let i = 0; i < 20; i++) {
    const wx = i * 50 + 10 + Math.cos(i) * 20;
    const wy = 240 + Math.cos(i * 0.5) * 25;
    ctx.fillRect(wx, wy, 25, 2);
  }

  // === SHIPS ===

  // Portuguese carrack (left)
  const carX = -30;
  const carY = 100;

  // Hull
  ctx.fillStyle = PALETTE.woodDark;
  ctx.beginPath();
  ctx.moveTo(carX, carY + 120);
  ctx.lineTo(carX + 50, carY + 140);
  ctx.lineTo(carX + 200, carY + 140);
  ctx.lineTo(carX + 240, carY + 100);
  ctx.lineTo(carX + 200, carY + 60);
  ctx.lineTo(carX + 50, carY + 60);
  ctx.closePath();
  ctx.fill();

  // Hull planking
  ctx.strokeStyle = PALETTE.woodShadow;
  ctx.lineWidth = 1;
  for (let py = carY + 70; py < carY + 135; py += 10) {
    ctx.beginPath();
    ctx.moveTo(carX + 10, py);
    ctx.lineTo(carX + 230, py);
    ctx.stroke();
  }

  // Forecastle and sterncastle
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(carX + 10, carY + 40, 60, 50);
  ctx.fillRect(carX + 170, carY + 20, 70, 70);

  // Masts
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(carX + 80, carY - 60, 8, 180);
  ctx.fillRect(carX + 140, carY - 80, 8, 200);
  ctx.fillRect(carX + 195, carY - 40, 6, 120);

  // Furled sails
  ctx.fillStyle = PALETTE.whitewashMid;
  ctx.fillRect(carX + 55, carY - 30, 60, 25);
  ctx.fillRect(carX + 115, carY - 50, 60, 30);

  // Crow's nest
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(carX + 132, carY - 60, 24, 15);

  // Portuguese flag
  ctx.fillStyle = '#006600';
  ctx.fillRect(carX + 142, carY - 100, 30, 20);
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(carX + 152, carY - 100, 20, 20);

  // Arab dhow (right)
  const dhowX = width - 200;
  const dhowY = 160;

  // Hull
  ctx.fillStyle = PALETTE.woodMid;
  ctx.beginPath();
  ctx.moveTo(dhowX, dhowY + 60);
  ctx.lineTo(dhowX + 30, dhowY + 80);
  ctx.lineTo(dhowX + 140, dhowY + 80);
  ctx.lineTo(dhowX + 180, dhowY + 40);
  ctx.lineTo(dhowX + 140, dhowY + 30);
  ctx.lineTo(dhowX + 30, dhowY + 30);
  ctx.closePath();
  ctx.fill();

  // Lateen sail
  ctx.fillStyle = PALETTE.whitewashBright;
  ctx.beginPath();
  ctx.moveTo(dhowX + 70, dhowY + 40);
  ctx.lineTo(dhowX + 90, dhowY - 80);
  ctx.lineTo(dhowX + 160, dhowY + 50);
  ctx.closePath();
  ctx.fill();

  // Mast
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(dhowX + 85, dhowY - 80, 5, 150);

  // === WAREHOUSES ===

  // Left warehouse
  drawTexturedRect(ctx, 180, 200, 180, 120, PALETTE.whitewashMid, 8);
  drawTerracottaRoof(ctx, 170, 170, 200, 35);

  // Windows and doors
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(200, 230, 40, 60);
  ctx.fillRect(260, 230, 40, 60);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(320, 250, 30, 70);

  // Right warehouse
  drawTexturedRect(ctx, 420, 210, 200, 110, PALETTE.whitewashShadow, 8);
  drawTerracottaRoof(ctx, 410, 175, 220, 40);

  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(440, 240, 35, 50);
  ctx.fillRect(500, 240, 35, 50);
  ctx.fillRect(560, 240, 35, 50);

  // === DOCK ===
  drawWoodPlanks(ctx, 0, 320, width, 220, true);

  // Dock edge
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(0, 320, width, 8);

  // Dock posts
  for (let px = 50; px < width; px += 120) {
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(px, 300, 15, 50);
    ctx.fillStyle = PALETTE.woodShadow;
    ctx.fillRect(px, 300, 15, 5);

    // Rope coil
    ctx.fillStyle = PALETTE.sandMid;
    ctx.beginPath();
    ctx.arc(px + 7, 355, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // === CARGO ===
  // Barrels
  drawBarrel(ctx, 100, 380, 28, 40);
  drawBarrel(ctx, 135, 385, 25, 35);
  drawBarrel(ctx, 700, 375, 30, 42);

  // Crates
  drawCrate(ctx, 280, 390, 35, 30);
  drawCrate(ctx, 320, 395, 30, 25);
  drawCrate(ctx, 305, 365, 40, 30);

  drawCrate(ctx, 550, 385, 35, 30);
  drawCrate(ctx, 520, 390, 30, 25);

  // Fishing nets
  ctx.strokeStyle = PALETTE.sandDark;
  ctx.lineWidth = 1;
  for (let nx = 400; nx < 480; nx += 8) {
    ctx.beginPath();
    ctx.moveTo(nx, 400);
    ctx.lineTo(nx + 4, 440);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(nx, 420);
    ctx.lineTo(nx + 20, 420);
    ctx.stroke();
  }

  // === ATMOSPHERIC ===

  // Sea mist
  const mistGradient = ctx.createLinearGradient(0, 150, 0, 350);
  mistGradient.addColorStop(0, 'rgba(200,220,240,0.25)');
  mistGradient.addColorStop(0.5, 'rgba(200,220,240,0.1)');
  mistGradient.addColorStop(1, 'rgba(200,220,240,0)');
  ctx.fillStyle = mistGradient;
  ctx.fillRect(0, 0, width, height);

  saveCanvas(canvas, 'scene-waterfront.png');
}

// ============================================================================
// KAMPUNG - Malay Village
// ============================================================================
function generateKampung() {
  const width = 960;
  const height = 540;
  const { canvas, ctx } = createCanvas2D(width, height);

  // === SKY ===
  drawDitheredGradient(ctx, 0, 0, width, 150, [
    PALETTE.skyLight,
    '#a8d8b8',
    '#c8e8c0',
    '#e8f0d8'
  ]);

  // === JUNGLE BACKGROUND ===

  // Dense treeline
  ctx.fillStyle = PALETTE.jungleShadow;
  ctx.fillRect(0, 120, width, 80);

  // Individual tree canopies
  for (let i = 0; i < 40; i++) {
    const tx = i * 25 + Math.random() * 15 - 10;
    const ty = 100 + Math.random() * 50;
    const tw = 30 + Math.random() * 20;
    const th = 40 + Math.random() * 30;

    ctx.fillStyle = i % 4 === 0 ? PALETTE.jungleDark :
                    i % 4 === 1 ? PALETTE.jungleMid :
                    i % 4 === 2 ? PALETTE.palmGreen : PALETTE.jungleShadow;
    ctx.beginPath();
    ctx.ellipse(tx + tw/2, ty + th/2, tw/2, th/2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // === GROUND ===

  // Dirt path
  drawTexturedRect(ctx, 250, 350, 460, 190, PALETTE.dirtMid, 12);

  // Grass areas
  ctx.fillStyle = PALETTE.jungleMid;
  ctx.fillRect(0, 300, 260, 240);
  ctx.fillRect(700, 300, 260, 240);

  // Grass detail
  for (let y = 300; y < height; y += 4) {
    for (let x = 0; x < 260; x += 6) {
      const shade = Math.random() * 25 - 12;
      const base = hexToRgb(PALETTE.jungleMid);
      ctx.fillStyle = rgbToHex(base.r + shade, base.g + shade, base.b + shade * 0.5);
      ctx.fillRect(x, y, 5, 4);
    }
    for (let x = 700; x < width; x += 6) {
      const shade = Math.random() * 25 - 12;
      const base = hexToRgb(PALETTE.jungleMid);
      ctx.fillStyle = rgbToHex(base.r + shade, base.g + shade, base.b + shade * 0.5);
      ctx.fillRect(x, y, 5, 4);
    }
  }

  // === MALAY HOUSES (Rumah Kampung) ===

  // House 1 - Left
  const h1x = 50;
  const h1y = 200;

  // Stilts
  ctx.fillStyle = PALETTE.woodDark;
  for (let sx of [70, 130, 190]) {
    ctx.fillRect(sx, h1y + 100, 10, 100);
  }

  // Platform
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(h1x, h1y + 95, 170, 12);

  // House body (bamboo walls)
  drawTexturedRect(ctx, h1x + 10, h1y + 20, 150, 80, PALETTE.woodLight, 15);

  // Vertical bamboo strips
  ctx.fillStyle = PALETTE.woodMid;
  for (let bx = h1x + 20; bx < h1x + 150; bx += 15) {
    ctx.fillRect(bx, h1y + 25, 2, 70);
  }

  // Attap roof (palm thatch)
  ctx.fillStyle = '#7a6a4a';
  ctx.beginPath();
  ctx.moveTo(h1x - 20, h1y + 25);
  ctx.lineTo(h1x + 85, h1y - 40);
  ctx.lineTo(h1x + 190, h1y + 25);
  ctx.closePath();
  ctx.fill();

  // Thatch texture
  ctx.strokeStyle = '#5a4a3a';
  ctx.lineWidth = 2;
  for (let ty = h1y - 30; ty < h1y + 20; ty += 8) {
    ctx.beginPath();
    ctx.moveTo(h1x - 10 + (ty - h1y + 40) * 0.5, ty);
    ctx.lineTo(h1x + 180 - (ty - h1y + 40) * 0.5, ty);
    ctx.stroke();
  }

  // Door and window
  ctx.fillStyle = '#1a1a15';
  ctx.fillRect(h1x + 60, h1y + 35, 35, 55);
  ctx.fillRect(h1x + 115, h1y + 40, 25, 30);

  // Ladder
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(h1x + 65, h1y + 95, 5, 80);
  ctx.fillRect(h1x + 90, h1y + 95, 5, 80);
  for (let ly = h1y + 105; ly < h1y + 170; ly += 15) {
    ctx.fillRect(h1x + 65, ly, 30, 4);
  }

  // House 2 - Center back
  const h2x = 380;
  const h2y = 150;

  // Stilts
  ctx.fillStyle = PALETTE.woodDark;
  for (let sx of [400, 480, 560]) {
    ctx.fillRect(sx, h2y + 100, 12, 120);
  }

  // Platform
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(h2x, h2y + 95, 200, 12);

  // House body
  drawTexturedRect(ctx, h2x + 10, h2y + 10, 180, 90, '#c8a870', 12);

  // Bamboo strips
  ctx.fillStyle = PALETTE.woodMid;
  for (let bx = h2x + 20; bx < h2x + 180; bx += 18) {
    ctx.fillRect(bx, h2y + 15, 2, 80);
  }

  // Roof
  ctx.fillStyle = '#6a5a4a';
  ctx.beginPath();
  ctx.moveTo(h2x - 25, h2y + 15);
  ctx.lineTo(h2x + 100, h2y - 60);
  ctx.lineTo(h2x + 225, h2y + 15);
  ctx.closePath();
  ctx.fill();

  // Thatch lines
  ctx.strokeStyle = '#4a3a2a';
  for (let ty = h2y - 50; ty < h2y + 10; ty += 10) {
    ctx.beginPath();
    ctx.moveTo(h2x - 15 + (ty - h2y + 60) * 0.5, ty);
    ctx.lineTo(h2x + 215 - (ty - h2y + 60) * 0.5, ty);
    ctx.stroke();
  }

  // Door and windows
  ctx.fillStyle = '#1a1a15';
  ctx.fillRect(h2x + 75, h2y + 25, 50, 65);
  ctx.fillRect(h2x + 30, h2y + 35, 28, 35);
  ctx.fillRect(h2x + 142, h2y + 35, 28, 35);

  // House 3 - Right
  const h3x = 700;
  const h3y = 180;

  // Stilts
  ctx.fillStyle = PALETTE.woodDark;
  for (let sx of [720, 790, 860]) {
    ctx.fillRect(sx, h3y + 100, 10, 110);
  }

  // Platform
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(h3x, h3y + 95, 180, 10);

  // House body
  drawTexturedRect(ctx, h3x + 10, h3y + 15, 160, 85, PALETTE.woodLight, 15);

  // Roof
  ctx.fillStyle = '#8a7a5a';
  ctx.beginPath();
  ctx.moveTo(h3x - 15, h3y + 20);
  ctx.lineTo(h3x + 90, h3y - 45);
  ctx.lineTo(h3x + 195, h3y + 20);
  ctx.closePath();
  ctx.fill();

  // Door
  ctx.fillStyle = '#1a1a15';
  ctx.fillRect(h3x + 65, h3y + 30, 40, 60);

  // === PALM TREES ===
  drawPalmTree(ctx, 280, 140, 180);
  drawPalmTree(ctx, 650, 160, 160);
  drawPalmTree(ctx, 920, 200, 140);

  // === BANANA PLANTS ===
  // Left side
  ctx.fillStyle = PALETTE.jungleDark;
  ctx.fillRect(20, 320, 6, 60);

  // Large leaves
  const bananaLeaves = [
    { x: 0, y: 280, w: 50, h: 25, angle: -0.3 },
    { x: 30, y: 290, w: 55, h: 22, angle: 0.2 },
    { x: 10, y: 300, w: 45, h: 20, angle: -0.5 },
  ];

  bananaLeaves.forEach(leaf => {
    ctx.save();
    ctx.translate(leaf.x + leaf.w/2, leaf.y + leaf.h/2);
    ctx.rotate(leaf.angle);
    ctx.fillStyle = PALETTE.palmGreen;
    ctx.beginPath();
    ctx.ellipse(0, 0, leaf.w/2, leaf.h/2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // === VILLAGE DETAILS ===

  // Fire pit (cold - just stones)
  ctx.fillStyle = PALETTE.stoneDark;
  for (let fx = 450; fx < 510; fx += 12) {
    ctx.fillRect(fx, 430, 10, 8);
  }
  ctx.fillStyle = PALETTE.stoneShadow;
  ctx.fillRect(455, 425, 50, 8);

  // Chicken coop fence
  ctx.fillStyle = PALETTE.woodMid;
  ctx.fillRect(560, 420, 90, 4);
  ctx.fillRect(560, 420, 4, 50);
  ctx.fillRect(646, 420, 4, 50);
  ctx.fillRect(560, 445, 90, 4);
  // Fence posts
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(580, 420, 4, 55);
  ctx.fillRect(610, 420, 4, 55);

  // Water jars
  ctx.fillStyle = PALETTE.terracottaDark;
  ctx.fillRect(240, 410, 20, 30);
  ctx.fillRect(265, 415, 18, 25);
  ctx.fillStyle = '#1a1a15';
  ctx.fillRect(243, 410, 14, 5);
  ctx.fillRect(268, 415, 12, 5);

  // === ATMOSPHERIC ===

  // Warm humid haze
  const hazeGradient = ctx.createLinearGradient(0, 0, 0, height);
  hazeGradient.addColorStop(0, 'rgba(180,220,180,0.12)');
  hazeGradient.addColorStop(0.5, 'rgba(200,200,150,0.1)');
  hazeGradient.addColorStop(1, 'rgba(180,160,120,0.15)');
  ctx.fillStyle = hazeGradient;
  ctx.fillRect(0, 0, width, height);

  saveCanvas(canvas, 'scene-kampung.png');
}

// ============================================================================
// OPENING SCREEN - Title screen background
// ============================================================================
function generateOpeningScreen() {
  const width = 960;
  const height = 540;
  const { canvas, ctx } = createCanvas2D(width, height);

  // === DRAMATIC SUNSET SKY ===
  drawDitheredGradient(ctx, 0, 0, width, 280, [
    '#1a0a20',  // Deep purple night
    '#4a2a4a',  // Purple dusk
    '#8a3a3a',  // Deep red
    '#d4603a',  // Orange sunset
    '#e8a040',  // Golden horizon
    '#f0d080'   // Bright horizon
  ]);

  // === SILHOUETTED CITYSCAPE ===

  // Distant hills/jungle
  ctx.fillStyle = '#1a2a1a';
  ctx.beginPath();
  ctx.moveTo(0, 280);
  for (let x = 0; x <= width; x += 20) {
    const h = 250 + Math.sin(x * 0.01) * 30 + Math.sin(x * 0.03) * 15;
    ctx.lineTo(x, h);
  }
  ctx.lineTo(width, 540);
  ctx.lineTo(0, 540);
  ctx.closePath();
  ctx.fill();

  // A Famosa fortress silhouette (center)
  ctx.fillStyle = '#0a0a0a';

  // Left tower
  ctx.fillRect(350, 200, 50, 150);
  // Crenellations
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(350 + i * 18, 185, 12, 20);
  }

  // Main gate
  ctx.fillRect(400, 180, 160, 170);
  // Gate arch (lighter to show opening)
  ctx.fillStyle = '#2a1a1a';
  ctx.fillRect(440, 230, 80, 120);
  ctx.beginPath();
  ctx.arc(480, 230, 40, Math.PI, 0, false);
  ctx.fill();

  ctx.fillStyle = '#0a0a0a';
  // Right tower
  ctx.fillRect(560, 200, 50, 150);
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(560 + i * 18, 185, 12, 20);
  }

  // Church silhouette (left background)
  ctx.fillRect(100, 220, 120, 130);
  // Bell tower
  ctx.fillRect(140, 160, 40, 70);
  // Cross
  ctx.fillRect(157, 140, 6, 25);
  ctx.fillRect(150, 150, 20, 5);
  // Peaked roof
  ctx.beginPath();
  ctx.moveTo(90, 225);
  ctx.lineTo(160, 180);
  ctx.lineTo(230, 225);
  ctx.closePath();
  ctx.fill();

  // Warehouse silhouettes (right)
  ctx.fillRect(700, 250, 100, 100);
  ctx.fillRect(780, 260, 120, 90);
  ctx.fillRect(860, 240, 100, 110);

  // Ship masts in harbor
  ctx.fillRect(750, 180, 4, 120);
  ctx.fillRect(780, 160, 4, 140);
  ctx.fillRect(850, 190, 4, 110);

  // Palm tree silhouettes
  // Left palm
  ctx.fillRect(45, 280, 8, 80);
  for (let f = 0; f < 6; f++) {
    const angle = (f / 6) * Math.PI * 2;
    ctx.fillStyle = '#0a0a0a';
    for (let fl = 0; fl < 40; fl += 5) {
      const fx = 50 + Math.cos(angle) * fl;
      const fy = 270 + Math.sin(angle) * fl * 0.4;
      ctx.fillRect(fx - 3, fy, 6, 4);
    }
  }

  // Right palm
  ctx.fillRect(890, 300, 8, 70);
  for (let f = 0; f < 6; f++) {
    const angle = (f / 6) * Math.PI * 2;
    for (let fl = 0; fl < 35; fl += 5) {
      const fx = 895 + Math.cos(angle) * fl;
      const fy = 290 + Math.sin(angle) * fl * 0.4;
      ctx.fillRect(fx - 3, fy, 6, 4);
    }
  }

  // === WATER REFLECTION ===
  // Harbor water at bottom
  ctx.fillStyle = '#1a2a3a';
  ctx.fillRect(0, 350, width, 190);

  // Sunset reflection on water
  for (let y = 360; y < 540; y += 4) {
    const t = (y - 360) / 180;
    const reflectionWidth = 200 - t * 150;
    const alpha = 0.4 - t * 0.3;
    ctx.fillStyle = `rgba(232, 160, 64, ${alpha})`;
    ctx.fillRect(width/2 - reflectionWidth/2, y, reflectionWidth, 3);
  }

  // Water ripples
  ctx.fillStyle = '#2a3a4a';
  for (let y = 370; y < 540; y += 15) {
    for (let x = 0; x < width; x += 60) {
      const offset = Math.sin(y * 0.1 + x * 0.02) * 10;
      ctx.fillRect(x + offset, y, 40, 2);
    }
  }

  // === ATMOSPHERIC GLOW ===
  // Sun glow on horizon
  const sunGlow = ctx.createRadialGradient(width/2, 260, 20, width/2, 260, 250);
  sunGlow.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
  sunGlow.addColorStop(0.3, 'rgba(255, 150, 80, 0.2)');
  sunGlow.addColorStop(1, 'rgba(255, 100, 50, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, width, 350);

  // Vignette effect
  const vignette = ctx.createRadialGradient(width/2, height/2, 200, width/2, height/2, 500);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  saveCanvas(canvas, 'opening-screen.png');
}

// ============================================================================
// MAIN
// ============================================================================

console.log('Generating Ultima VIII-style scene backgrounds...');
console.log('1580s Portuguese Melaka - detailed and atmospheric\n');

generateOpeningScreen();
generateRuaDireita();
generateAFamosa();
generateStPauls();
generateWaterfront();
generateKampung();

console.log('\nDone! All 6 backgrounds regenerated (including opening screen).');
console.log('Refresh the game to see the new detailed backgrounds.');
