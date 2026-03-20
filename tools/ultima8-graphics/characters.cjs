/**
 * Ultima 8 Style Character Sprite Generator
 * Creates detailed 24x48 character sprites with rich shading
 * Inspired by the large, detailed sprites of Ultima 8: Pagan
 */

const { PALETTE, blendDithered, DITHER_MATRIX } = require('./palette.cjs');

const CHAR_WIDTH = 24;
const CHAR_HEIGHT = 48;

function setPixel(ctx, x, y, color) {
  if (x >= 0 && x < CHAR_WIDTH && y >= 0 && y < CHAR_HEIGHT) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }
}

// Set pixel with dithering between palette shades for smooth gradients
function setDitheredPixel(ctx, x, y, palette, shadeLevel) {
  if (x < 0 || x >= CHAR_WIDTH || y < 0 || y >= CHAR_HEIGHT) return;
  const baseIdx = Math.floor(shadeLevel);
  const frac = shadeLevel - baseIdx;
  const idx1 = Math.max(0, Math.min(7, baseIdx));
  const idx2 = Math.max(0, Math.min(7, baseIdx + 1));

  if (frac < 0.01) {
    ctx.fillStyle = palette[idx1];
  } else if (frac > 0.99) {
    ctx.fillStyle = palette[idx2];
  } else {
    const threshold = Math.floor(frac * 16);
    ctx.fillStyle = blendDithered(palette[idx1], palette[idx2], x, y, threshold);
  }
  ctx.fillRect(x, y, 1, 1);
}

// Add shadow outline on right/bottom edges (consistent with top-left lighting)
function addShadowOutline(ctx) {
  const imgData = ctx.getImageData(0, 0, CHAR_WIDTH, CHAR_HEIGHT);
  const d = imgData.data;
  const pixels = [];

  for (let y = 0; y < CHAR_HEIGHT; y++) {
    for (let x = 0; x < CHAR_WIDTH; x++) {
      const i = (y * CHAR_WIDTH + x) * 4;
      if (d[i + 3] > 128) {
        // Check right neighbor
        if (x + 1 < CHAR_WIDTH) {
          const ri = (y * CHAR_WIDTH + x + 1) * 4;
          if (d[ri + 3] < 128) {
            pixels.push({ x: x + 1, y });
          }
        }
        // Check bottom neighbor
        if (y + 1 < CHAR_HEIGHT) {
          const bi = ((y + 1) * CHAR_WIDTH + x) * 4;
          if (d[bi + 3] < 128) {
            pixels.push({ x, y: y + 1 });
          }
        }
      }
    }
  }

  pixels.forEach(p => {
    setPixel(ctx, p.x, p.y, PALETTE.shadow[2]);
  });
}

// Add ground shadow ellipse at character feet
function addGroundShadow(ctx) {
  const cx = CHAR_WIDTH / 2;
  const ry = 1.5;
  const rx = 6;
  for (let y = CHAR_HEIGHT - 2; y < CHAR_HEIGHT; y++) {
    for (let x = 0; x < CHAR_WIDTH; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - (CHAR_HEIGHT - 1.5)) / ry;
      if (dx * dx + dy * dy <= 1) {
        const alpha = Math.max(0, 0.3 * (1 - (dx * dx + dy * dy)));
        ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(2)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

// Seeded random for consistent patterns
function seededRandom(x, y, seed = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

// Draw an ellipse with shading
function drawShadedEllipse(ctx, cx, cy, rx, ry, palette, lightAngle = -0.7) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const normalizedDist = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (normalizedDist <= 1) {
        // Calculate surface normal for lighting
        const nx = x / rx;
        const ny = y / ry;
        
        // Lighting (from top-left)
        const light = 1 - (nx * 0.4 + ny * 0.6);
        const shade = Math.max(0, Math.min(7, 2 + light * 4));
        
        setPixel(ctx, cx + x, cy + y, palette[Math.floor(shade)]);
      }
    }
  }
}

// Draw a rectangle with 3D shading
function drawShadedRect(ctx, x, y, w, h, palette, topLight = true) {
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let shade = 4;
      
      // Edge lighting
      if (topLight) {
        if (py === 0) shade = 6;
        else if (py === 1) shade = 5;
        else if (px === 0) shade = 5;
        else if (py === h - 1) shade = 2;
        else if (py === h - 2) shade = 3;
        else if (px === w - 1) shade = 2;
      }
      
      setPixel(ctx, x + px, y + py, palette[Math.floor(shade)]);
    }
  }
}

// ====================
// PLAYER - Portuguese merchant/adventurer
// ====================
function drawPlayer(ctx) {
  const skin = PALETTE.skinPortuguese;
  const hair = PALETTE.wood;
  const shirt = PALETTE.clothRed;
  const pants = PALETTE.clothBlue;
  const boots = PALETTE.wood;
  const belt = PALETTE.wood;
  const gold = PALETTE.gold;
  
  // === HEAD (y: 4-16) ===
  // Hair (brown, styled) with strand noise
  for (let y = 4; y <= 8; y++) {
    for (let x = 8; x <= 15; x++) {
      const shade = 3 + (8 - y) * 0.3 + (x < 11 ? 1 : -0.5) + (seededRandom(x, y * 3, 1) - 0.5) * 1.5;
      setPixel(ctx, x, y, hair[Math.floor(Math.max(1, Math.min(6, shade)))]);
    }
  }
  // Hair highlight streak
  setPixel(ctx, 10, 5, hair[6]);
  // Hair sides
  for (let y = 6; y <= 11; y++) {
    setPixel(ctx, 7, y, hair[2]);
    setPixel(ctx, 16, y, hair[1]);
  }
  
  // Face
  for (let y = 8; y <= 15; y++) {
    for (let x = 8; x <= 15; x++) {
      // Basic face shading - lit from left
      let shade = 4;
      if (x < 10) shade = 6;
      else if (x > 14) shade = 2;
      if (y < 10) shade += 0.5;
      if (y > 14) shade -= 0.5;
      
      setPixel(ctx, x, y, skin[Math.floor(Math.max(1, Math.min(7, shade)))]);
    }
  }
  
  // Eyes (y: 11)
  setPixel(ctx, 9, 11, '#1A1510');
  setPixel(ctx, 10, 11, '#000000');
  setPixel(ctx, 13, 11, '#1A1510');
  setPixel(ctx, 14, 11, '#000000');
  // Eye highlights
  setPixel(ctx, 10, 10, skin[7]);
  setPixel(ctx, 14, 10, skin[7]);
  
  // Eyebrows
  setPixel(ctx, 9, 10, hair[3]);
  setPixel(ctx, 10, 9, hair[3]);
  setPixel(ctx, 13, 10, hair[3]);
  setPixel(ctx, 14, 9, hair[3]);
  
  // Nose
  setPixel(ctx, 11, 12, skin[6]);
  setPixel(ctx, 12, 12, skin[5]);
  setPixel(ctx, 11, 13, skin[5]);
  setPixel(ctx, 12, 13, skin[4]);
  
  // Mouth
  setPixel(ctx, 10, 14, skin[3]);
  setPixel(ctx, 11, 14, skin[2]);
  setPixel(ctx, 12, 14, skin[2]);
  setPixel(ctx, 13, 14, skin[3]);
  
  // Chin/jaw
  for (let x = 9; x <= 14; x++) {
    setPixel(ctx, x, 16, skin[3]);
  }
  
  // Ears
  setPixel(ctx, 7, 11, skin[4]);
  setPixel(ctx, 7, 12, skin[3]);
  setPixel(ctx, 16, 11, skin[2]);
  setPixel(ctx, 16, 12, skin[1]);
  
  // === NECK (y: 16-18) ===
  for (let y = 16; y <= 18; y++) {
    for (let x = 10; x <= 13; x++) {
      setPixel(ctx, x, y, skin[3]);
    }
  }
  
  // === COLLAR (y: 17-19) ===
  for (let x = 8; x <= 15; x++) {
    setPixel(ctx, x, 18, PALETTE.whitewash[6]);
    setPixel(ctx, x, 19, PALETTE.whitewash[5]);
  }
  
  // === TORSO/DOUBLET (y: 19-32) ===
  for (let y = 19; y <= 32; y++) {
    for (let x = 6; x <= 17; x++) {
      let shade = 2 + ((x - 6) / (17 - 6)) * 4;  // smooth gradient left to right
      // Vertical seam shadow
      if (x === 11 || x === 12) shade -= 0.5;
      setDitheredPixel(ctx, x, y, shirt, shade);
    }
  }
  
  // Gold buttons down front
  for (let y = 21; y <= 30; y += 3) {
    setPixel(ctx, 11, y, gold[6]);
    setPixel(ctx, 12, y, gold[5]);
    setPixel(ctx, 11, y + 1, gold[4]);
    setPixel(ctx, 12, y + 1, gold[3]);
  }
  
  // === BELT (y: 32-34) ===
  for (let x = 6; x <= 17; x++) {
    setPixel(ctx, x, 32, belt[5]);
    setPixel(ctx, x, 33, belt[4]);
    setPixel(ctx, x, 34, belt[3]);
  }
  // Belt buckle
  setPixel(ctx, 10, 32, gold[6]);
  setPixel(ctx, 11, 32, gold[6]);
  setPixel(ctx, 12, 32, gold[5]);
  setPixel(ctx, 13, 32, gold[5]);
  setPixel(ctx, 10, 33, gold[5]);
  setPixel(ctx, 11, 33, gold[4]);
  setPixel(ctx, 12, 33, gold[4]);
  setPixel(ctx, 13, 33, gold[3]);
  
  // === ARMS (y: 20-32) ===
  // Left arm (lit side)
  for (let y = 20; y <= 31; y++) {
    setPixel(ctx, 4, y, shirt[5]);
    setPixel(ctx, 5, y, shirt[6]);
  }
  // Left hand
  setPixel(ctx, 4, 32, skin[5]);
  setPixel(ctx, 5, 32, skin[6]);
  setPixel(ctx, 4, 33, skin[4]);
  setPixel(ctx, 5, 33, skin[5]);
  
  // Right arm (shadow side)
  for (let y = 20; y <= 31; y++) {
    setPixel(ctx, 18, y, shirt[3]);
    setPixel(ctx, 19, y, shirt[2]);
  }
  // Right hand
  setPixel(ctx, 18, 32, skin[3]);
  setPixel(ctx, 19, 32, skin[2]);
  setPixel(ctx, 18, 33, skin[2]);
  setPixel(ctx, 19, 33, skin[1]);
  
  // === PANTS (y: 34-42) ===
  // Left leg (lit)
  for (let y = 34; y <= 42; y++) {
    for (let x = 7; x <= 10; x++) {
      const shade = 3 + ((x - 7) / (10 - 7)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, pants, shade);
    }
  }
  // Right leg (shadow)
  for (let y = 34; y <= 42; y++) {
    for (let x = 13; x <= 16; x++) {
      const shade = 1 + ((x - 13) / (16 - 13)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, pants, shade);
    }
  }
  // Inner leg shadow
  for (let y = 35; y <= 41; y++) {
    setPixel(ctx, 11, y, pants[1]);
    setPixel(ctx, 12, y, pants[1]);
  }
  
  // === BOOTS (y: 42-46) ===
  // Left boot
  for (let y = 42; y <= 46; y++) {
    for (let x = 6; x <= 10; x++) {
      const shade = 3 + ((x - 6) / (10 - 6)) * 2;  // smooth gradient
      setDitheredPixel(ctx, x, y, boots, shade);
    }
  }
  // Right boot
  for (let y = 42; y <= 46; y++) {
    for (let x = 13; x <= 17; x++) {
      const shade = 1 + ((x - 13) / (17 - 13)) * 2;  // smooth gradient
      setDitheredPixel(ctx, x, y, boots, shade);
    }
  }
  
  // Boot soles
  for (let x = 6; x <= 10; x++) setPixel(ctx, x, 47, boots[1]);
  for (let x = 13; x <= 17; x++) setPixel(ctx, x, 47, boots[0]);

  // Specular highlights - gold button and belt buckle glint
  setPixel(ctx, 11, 21, PALETTE.specular[5]); // top button glint
  setPixel(ctx, 10, 32, PALETTE.specular[5]); // belt buckle glint
}

// ====================
// FERNÃO GOMES - Wealthy Portuguese merchant
// ====================
function drawFernaoGomes(ctx) {
  const skin = PALETTE.skinPortuguese;
  const gray = PALETTE.stone;
  const shirt = PALETTE.clothRed;
  const pants = PALETTE.shadow;
  const boots = PALETTE.wood;
  const gold = PALETTE.gold;
  
  // Gray/white hair and beard with strand noise
  for (let y = 4; y <= 8; y++) {
    for (let x = 8; x <= 15; x++) {
      const shade = 5 + (8 - y) * 0.3 + (seededRandom(x, y * 3, 2) - 0.5) * 1.5;
      setPixel(ctx, x, y, gray[Math.floor(Math.max(1, Math.min(6, shade)))]);
    }
  }
  // Hair highlight streak
  setPixel(ctx, 10, 5, gray[7]);
  
  // Face with beard
  for (let y = 8; y <= 15; y++) {
    for (let x = 8; x <= 15; x++) {
      if (y >= 13) {
        // Beard
        const shade = x < 10 ? 5 : x > 14 ? 3 : 4;
        setPixel(ctx, x, y, gray[shade]);
      } else {
        const shade = x < 10 ? 6 : x > 14 ? 2 : 4;
        setPixel(ctx, x, y, skin[shade]);
      }
    }
  }
  
  // Eyes
  setPixel(ctx, 9, 11, '#000000');
  setPixel(ctx, 14, 11, '#000000');
  
  // Beard continuation
  for (let y = 16; y <= 18; y++) {
    for (let x = 9; x <= 14; x++) {
      setPixel(ctx, x, y, gray[3]);
    }
  }
  
  // Rich merchant doublet with gold trim
  for (let y = 19; y <= 32; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 2 + ((x - 6) / (17 - 6)) * 4;  // smooth gradient
      setDitheredPixel(ctx, x, y, shirt, shade);
    }
    // Gold trim on edges
    setPixel(ctx, 6, y, gold[4]);
    setPixel(ctx, 17, y, gold[2]);
  }
  
  // Very ornate gold buttons
  for (let y = 21; y <= 30; y += 2) {
    setPixel(ctx, 11, y, gold[7]);
    setPixel(ctx, 12, y, gold[6]);
  }
  
  // Rich belt
  for (let x = 6; x <= 17; x++) {
    setPixel(ctx, x, 32, gold[5]);
    setPixel(ctx, x, 33, gold[4]);
    setPixel(ctx, x, 34, gold[3]);
  }
  
  // Arms
  for (let y = 20; y <= 31; y++) {
    setPixel(ctx, 4, y, shirt[5]);
    setPixel(ctx, 5, y, shirt[6]);
    setPixel(ctx, 18, y, shirt[2]);
    setPixel(ctx, 19, y, shirt[1]);
  }
  setPixel(ctx, 4, 32, skin[4]);
  setPixel(ctx, 5, 32, skin[5]);
  setPixel(ctx, 18, 32, skin[2]);
  setPixel(ctx, 19, 32, skin[1]);
  
  // Dark pants
  for (let y = 34; y <= 42; y++) {
    for (let x = 7; x <= 16; x++) {
      const shade = 1.5 + ((x - 7) / (16 - 7)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, pants, shade);
    }
  }

  // Fine boots
  for (let y = 42; y <= 46; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 1 + ((x - 6) / (17 - 6)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, boots, shade);
    }
  }

  // Facial details - crow's feet + heavier brow
  setPixel(ctx, 8, 11, skin[2]); // crow's foot left
  setPixel(ctx, 15, 11, skin[1]); // crow's foot right
  setPixel(ctx, 8, 9, gray[4]); // heavy brow left
  setPixel(ctx, 15, 9, gray[3]); // heavy brow right

  // Specular highlights - button and trim glint
  setPixel(ctx, 11, 21, PALETTE.specular[5]); // button glint
  setPixel(ctx, 6, 22, PALETTE.specular[5]); // trim glint
}

// ====================
// CAPITÃO RODRIGUES - Fortress captain in armor
// ====================
function drawCapitaoRodrigues(ctx) {
  const skin = PALETTE.skinPortuguese;
  const metal = PALETTE.stone;
  const red = PALETTE.clothRed;
  const wood = PALETTE.wood;
  
  // Morion helmet
  for (let y = 2; y <= 7; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = x < 10 ? 6 : x > 14 ? 2 : 4;
      setPixel(ctx, x, y, metal[shade]);
    }
  }
  // Helmet crest
  for (let y = 0; y <= 4; y++) {
    setPixel(ctx, 11, y, metal[5]);
    setPixel(ctx, 12, y, metal[4]);
  }
  // Helmet brim
  for (let x = 4; x <= 19; x++) {
    setPixel(ctx, x, 7, metal[x < 10 ? 5 : 3]);
  }
  
  // Face under helmet
  for (let y = 8; y <= 14; y++) {
    for (let x = 8; x <= 15; x++) {
      const shade = x < 10 ? 5 : x > 14 ? 2 : 4;
      setPixel(ctx, x, y, skin[shade]);
    }
  }
  // Stern eyes
  setPixel(ctx, 9, 10, '#000000');
  setPixel(ctx, 14, 10, '#000000');
  // Heavy brows
  setPixel(ctx, 8, 9, wood[3]);
  setPixel(ctx, 9, 9, wood[3]);
  setPixel(ctx, 14, 9, wood[3]);
  setPixel(ctx, 15, 9, wood[3]);
  
  // Gorget (neck armor)
  for (let x = 8; x <= 15; x++) {
    setPixel(ctx, x, 15, metal[4]);
    setPixel(ctx, x, 16, metal[3]);
    setPixel(ctx, x, 17, metal[2]);
  }
  
  // Breastplate
  for (let y = 17; y <= 32; y++) {
    for (let x = 6; x <= 17; x++) {
      let shade = 4;
      // Curved breastplate lighting
      const centerX = 11.5;
      const dist = Math.abs(x - centerX);
      shade = 5 - dist * 0.4;
      if (y < 20) shade += 0.5;
      if (y > 30) shade -= 0.5;
      
      setPixel(ctx, x, y, metal[Math.floor(Math.max(1, Math.min(6, shade)))]);
    }
  }
  
  // Red officer's sash
  for (let y = 24; y <= 28; y++) {
    for (let x = 6; x <= 17; x++) {
      const edgeBoost = (y === 24 || y === 28) ? 1 : 0;
      const shade = 2 + ((x - 6) / (17 - 6)) * 4 + edgeBoost;  // smooth gradient
      setDitheredPixel(ctx, x, y, red, shade);
    }
  }
  
  // Armored arms
  for (let y = 18; y <= 31; y++) {
    setPixel(ctx, 4, y, metal[5]);
    setPixel(ctx, 5, y, metal[4]);
    setPixel(ctx, 18, y, metal[2]);
    setPixel(ctx, 19, y, metal[1]);
  }
  // Gauntlets
  for (let y = 32; y <= 34; y++) {
    setPixel(ctx, 4, y, metal[4]);
    setPixel(ctx, 5, y, metal[3]);
    setPixel(ctx, 18, y, metal[2]);
    setPixel(ctx, 19, y, metal[1]);
  }
  
  // Tassets (thigh armor)
  for (let y = 33; y <= 38; y++) {
    for (let x = 7; x <= 16; x++) {
      setPixel(ctx, x, y, metal[x < 11 ? 4 : 2]);
    }
  }
  
  // Military pants
  for (let y = 38; y <= 42; y++) {
    for (let x = 7; x <= 16; x++) {
      const shade = 1 + ((x - 7) / (16 - 7)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, red, shade);
    }
  }

  // Armored boots
  for (let y = 42; y <= 46; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 1 + ((x - 6) / (17 - 6)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, metal, shade);
    }
  }

  // Facial details - scar + jaw tension
  setPixel(ctx, 10, 11, skin[2]); // scar start
  setPixel(ctx, 11, 12, skin[2]); // scar middle
  setPixel(ctx, 12, 13, skin[1]); // scar end
  setPixel(ctx, 9, 14, skin[2]); // jaw tension

  // Specular highlights on metal
  setPixel(ctx, 11, 20, PALETTE.specular[3]); // breastplate apex
  setPixel(ctx, 12, 19, PALETTE.specular[2]); // breastplate upper
  setPixel(ctx, 11, 3, PALETTE.specular[4]); // helmet crest
  setPixel(ctx, 4, 33, PALETTE.specular[1]); // gauntlet edge
}

// ====================
// PADRE TOMÁS - Jesuit priest
// ====================
function drawPadreTomas(ctx) {
  const skin = PALETTE.skinPortuguese;
  const black = PALETTE.shadow;
  const white = PALETTE.whitewash;
  const gold = PALETTE.gold;
  
  // Tonsured head (bald top)
  for (let y = 4; y <= 7; y++) {
    for (let x = 8; x <= 15; x++) {
      setPixel(ctx, x, y, skin[x < 10 ? 6 : x > 14 ? 3 : 5]);
    }
  }
  // Gray hair ring
  for (let y = 7; y <= 10; y++) {
    setPixel(ctx, 7, y, PALETTE.stone[4]);
    setPixel(ctx, 16, y, PALETTE.stone[3]);
  }
  
  // Kind face
  for (let y = 8; y <= 15; y++) {
    for (let x = 8; x <= 15; x++) {
      const shade = x < 10 ? 5 : x > 14 ? 2 : 4;
      setPixel(ctx, x, y, skin[shade]);
    }
  }
  // Gentle eyes
  setPixel(ctx, 9, 11, '#1A1A1A');
  setPixel(ctx, 14, 11, '#1A1A1A');
  // Smile lines
  setPixel(ctx, 9, 14, skin[3]);
  setPixel(ctx, 14, 14, skin[3]);
  
  // White collar (Roman collar)
  for (let x = 8; x <= 15; x++) {
    setPixel(ctx, x, 16, white[7]);
    setPixel(ctx, x, 17, white[6]);
    setPixel(ctx, x, 18, white[5]);
  }
  
  // Black cassock (long robe)
  for (let y = 18; y <= 44; y++) {
    // Flowing robe shape - wider at bottom
    const width = y < 30 ? 6 : 7 + Math.floor((y - 30) / 4);
    const left = 12 - width;
    const right = 11 + width;

    for (let x = left; x <= right; x++) {
      const shade = 2 + ((x - left) / Math.max(1, right - left)) * 4;  // smooth gradient
      setDitheredPixel(ctx, x, y, black, shade);
    }
  }
  
  // Gold crucifix
  setPixel(ctx, 11, 22, gold[6]);
  setPixel(ctx, 12, 22, gold[5]);
  setPixel(ctx, 10, 23, gold[5]);
  setPixel(ctx, 11, 23, gold[5]);
  setPixel(ctx, 12, 23, gold[4]);
  setPixel(ctx, 13, 23, gold[4]);
  setPixel(ctx, 11, 24, gold[4]);
  setPixel(ctx, 12, 24, gold[4]);
  setPixel(ctx, 11, 25, gold[3]);
  setPixel(ctx, 12, 25, gold[3]);
  
  // Hands clasped in prayer
  for (let y = 30; y <= 33; y++) {
    setPixel(ctx, 10, y, skin[4]);
    setPixel(ctx, 11, y, skin[5]);
    setPixel(ctx, 12, y, skin[4]);
    setPixel(ctx, 13, y, skin[3]);
  }
  
  // Sandals
  for (let x = 7; x <= 16; x++) {
    setPixel(ctx, x, 45, PALETTE.wood[4]);
    setPixel(ctx, x, 46, PALETTE.wood[3]);
  }
  setPixel(ctx, 8, 47, skin[3]);
  setPixel(ctx, 9, 47, skin[4]);
  setPixel(ctx, 14, 47, skin[3]);
  setPixel(ctx, 15, 47, skin[2]);
}

// ====================
// AMINAH - Malay market vendor
// ====================
function drawAminah(ctx) {
  const skin = PALETTE.skinMalay;
  const cloth = PALETTE.clothSilk;
  const batik = PALETTE.clothBlue;
  const gold = PALETTE.gold;
  
  // Tudung (headscarf)
  for (let y = 2; y <= 20; y++) {
    let width = y < 8 ? 4 + y : 12;
    if (y > 14) width = 12 - (y - 14);
    const left = 12 - Math.floor(width / 2);
    const right = 11 + Math.ceil(width / 2);
    
    for (let x = left; x <= right; x++) {
      const shade = x < 10 ? 5 : x > 14 ? 2 : 4;
      setPixel(ctx, x, y, cloth[shade]);
    }
  }
  
  // Face visible
  for (let y = 9; y <= 14; y++) {
    for (let x = 9; x <= 14; x++) {
      const shade = x < 11 ? 5 : x > 13 ? 2 : 4;
      setPixel(ctx, x, y, skin[shade]);
    }
  }
  // Eyes
  setPixel(ctx, 10, 11, '#000000');
  setPixel(ctx, 13, 11, '#000000');
  // Warm smile
  setPixel(ctx, 10, 13, skin[3]);
  setPixel(ctx, 11, 13, skin[2]);
  setPixel(ctx, 12, 13, skin[2]);
  setPixel(ctx, 13, 13, skin[3]);
  
  // Gold necklace
  for (let x = 9; x <= 14; x++) {
    setPixel(ctx, x, 17, gold[x < 11 ? 6 : x > 13 ? 3 : 5]);
  }
  // Pendant
  setPixel(ctx, 11, 18, gold[5]);
  setPixel(ctx, 12, 18, gold[4]);
  
  // Baju kurung (traditional blouse)
  for (let y = 18; y <= 30; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 2 + ((x - 6) / (17 - 6)) * 4;  // smooth gradient
      setDitheredPixel(ctx, x, y, cloth, shade);
    }
  }
  
  // Arms
  for (let y = 20; y <= 29; y++) {
    setPixel(ctx, 4, y, cloth[5]);
    setPixel(ctx, 5, y, cloth[6]);
    setPixel(ctx, 18, y, cloth[2]);
    setPixel(ctx, 19, y, cloth[1]);
  }
  setPixel(ctx, 4, 30, skin[4]);
  setPixel(ctx, 5, 30, skin[5]);
  setPixel(ctx, 18, 30, skin[2]);
  setPixel(ctx, 19, 30, skin[1]);
  
  // Batik sarong (patterned skirt)
  for (let y = 30; y <= 44; y++) {
    for (let x = 5; x <= 18; x++) {
      // Batik pattern
      const pattern = ((x + y) % 4 < 2);
      const shade = pattern ? (x < 10 ? 5 : x > 14 ? 2 : 4) : (x < 10 ? 3 : x > 14 ? 1 : 2);
      setPixel(ctx, x, y, batik[shade]);
    }
  }
  
  // Bare feet
  setPixel(ctx, 8, 45, skin[4]);
  setPixel(ctx, 9, 45, skin[5]);
  setPixel(ctx, 10, 45, skin[4]);
  setPixel(ctx, 13, 45, skin[3]);
  setPixel(ctx, 14, 45, skin[2]);
  setPixel(ctx, 15, 45, skin[2]);

  // Headscarf fringe (at boundary of headscarf and face)
  setPixel(ctx, 9, 8, cloth[6]); // fringe light
  setPixel(ctx, 10, 8, cloth[3]); // fringe dark
  setPixel(ctx, 11, 8, cloth[5]); // fringe light

  // Specular highlights - silk and gold
  setPixel(ctx, 9, 17, PALETTE.specular[5]); // necklace glint
  setPixel(ctx, 8, 22, PALETTE.specular[4]); // silk highlight
  setPixel(ctx, 7, 25, PALETTE.specular[4]); // silk fold
}

// ====================
// CHEN WEI - Chinese guild representative
// ====================
function drawChenWei(ctx) {
  const skin = PALETTE.skinChinese;
  const silk = PALETTE.clothSilk;
  const gold = PALETTE.gold;
  const black = PALETTE.shadow;
  
  // Sifangjin cap (Ming-era, shorter than Qing cap)
  for (let y = 3; y <= 6; y++) {
    for (let x = 7; x <= 16; x++) {
      setPixel(ctx, x, y, black[y < 5 ? 4 : 3]);
    }
  }
  // Topknot bump at crown
  setPixel(ctx, 11, 2, black[4]);
  setPixel(ctx, 12, 2, black[3]);
  setPixel(ctx, 11, 3, black[5]);
  setPixel(ctx, 12, 3, black[4]);

  // Hair (pulled back) with strand noise
  for (let y = 7; y <= 9; y++) {
    for (let x = 8; x <= 15; x++) {
      const shade = 2 + (seededRandom(x, y * 3, 6) - 0.5) * 1.5;
      setPixel(ctx, x, y, black[Math.floor(Math.max(1, Math.min(5, shade)))]);
    }
  }
  // Hair highlight streak
  setPixel(ctx, 11, 8, black[4]);
  
  // Dignified face
  for (let y = 9; y <= 15; y++) {
    for (let x = 8; x <= 15; x++) {
      const shade = x < 10 ? 5 : x > 14 ? 2 : 4;
      setPixel(ctx, x, y, skin[shade]);
    }
  }
  // Eyes
  setPixel(ctx, 9, 11, '#000000');
  setPixel(ctx, 14, 11, '#000000');
  // Thin mustache
  for (let x = 9; x <= 14; x++) {
    setPixel(ctx, x, 14, black[3]);
  }
  // Goatee
  setPixel(ctx, 11, 15, black[3]);
  setPixel(ctx, 12, 15, black[3]);
  setPixel(ctx, 11, 16, black[2]);
  setPixel(ctx, 12, 16, black[2]);
  
  // Zhiduo (Ming-era long silk robe)
  for (let y = 17; y <= 44; y++) {
    for (let x = 5; x <= 18; x++) {
      const shade = 2 + ((x - 5) / (18 - 5)) * 4;  // smooth gradient
      setDitheredPixel(ctx, x, y, silk, shade);
    }
    // Gold trim
    setPixel(ctx, 5, y, gold[4]);
    setPixel(ctx, 6, y, gold[3]);
    setPixel(ctx, 17, y, gold[2]);
    setPixel(ctx, 18, y, gold[1]);
  }
  
  // Cross-collar V-shape (Ming zhiduo style)
  setPixel(ctx, 10, 17, gold[5]);
  setPixel(ctx, 13, 17, gold[4]);
  setPixel(ctx, 9, 18, gold[5]);
  setPixel(ctx, 14, 18, gold[4]);
  setPixel(ctx, 11, 17, skin[4]); // V-opening showing skin
  setPixel(ctx, 12, 17, skin[3]);
  setPixel(ctx, 11, 18, skin[3]);
  setPixel(ctx, 12, 18, skin[2]);
  
  // Hands in sleeves
  for (let y = 20; y <= 32; y++) {
    setPixel(ctx, 3, y, silk[5]);
    setPixel(ctx, 4, y, silk[6]);
    setPixel(ctx, 19, y, silk[2]);
    setPixel(ctx, 20, y, silk[1]);
  }
  
  // Silk shoes
  for (let x = 7; x <= 16; x++) {
    setPixel(ctx, x, 45, silk[3]);
    setPixel(ctx, x, 46, silk[2]);
  }

  // Specular highlights - silk fold and gold collar
  setPixel(ctx, 8, 22, PALETTE.specular[4]); // silk fold
  setPixel(ctx, 7, 28, PALETTE.specular[4]); // silk fold lower
  setPixel(ctx, 5, 18, PALETTE.specular[5]); // gold collar glint
}

// ====================
// RASHID - Arab sailor
// ====================
function drawRashid(ctx) {
  const skin = PALETTE.skinMalay;
  const white = PALETTE.whitewash;
  const blue = PALETTE.clothBlue;
  const black = PALETTE.shadow;
  
  // Keffiyeh (headscarf)
  for (let y = 2; y <= 18; y++) {
    let width = y < 6 ? 4 + y : 10;
    const left = 12 - Math.floor(width / 2);
    const right = 11 + Math.ceil(width / 2);
    
    for (let x = left; x <= right; x++) {
      const shade = x < 10 ? 6 : x > 14 ? 3 : 5;
      setPixel(ctx, x, y, white[shade]);
    }
  }
  // Agal (black cord)
  for (let x = 8; x <= 15; x++) {
    setPixel(ctx, x, 6, black[4]);
    setPixel(ctx, x, 7, black[3]);
  }
  
  // Face with thick beard
  for (let y = 8; y <= 15; y++) {
    for (let x = 9; x <= 14; x++) {
      if (y >= 12) {
        // Thick black beard
        setPixel(ctx, x, y, black[x < 11 ? 4 : 3]);
      } else {
        const shade = x < 11 ? 5 : 3;
        setPixel(ctx, x, y, skin[shade]);
      }
    }
  }
  // Eyes
  setPixel(ctx, 10, 10, '#000000');
  setPixel(ctx, 13, 10, '#000000');
  
  // Beard continuation
  for (let y = 16; y <= 18; y++) {
    for (let x = 10; x <= 13; x++) {
      setPixel(ctx, x, y, black[3]);
    }
  }
  
  // Loose white shirt
  for (let y = 18; y <= 30; y++) {
    for (let x = 5; x <= 18; x++) {
      const shade = 3 + ((x - 5) / (18 - 5)) * 4;  // smooth gradient
      setDitheredPixel(ctx, x, y, white, shade);
    }
  }

  // Blue sash
  for (let y = 29; y <= 32; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 2 + ((x - 6) / (17 - 6)) * 4;  // smooth gradient
      setDitheredPixel(ctx, x, y, blue, shade);
    }
  }
  
  // Arms
  for (let y = 20; y <= 28; y++) {
    setPixel(ctx, 3, y, white[6]);
    setPixel(ctx, 4, y, white[7]);
    setPixel(ctx, 19, y, white[3]);
    setPixel(ctx, 20, y, white[2]);
  }
  setPixel(ctx, 3, 29, skin[4]);
  setPixel(ctx, 4, 29, skin[5]);
  setPixel(ctx, 19, 29, skin[2]);
  setPixel(ctx, 20, 29, skin[1]);
  
  // Baggy sirwal (pants)
  for (let y = 32; y <= 42; y++) {
    const width = y < 38 ? 6 : 6 - (y - 38);
    const left = 12 - width;
    const right = 11 + width;
    for (let x = left; x <= right; x++) {
      const shade = 2 + ((x - left) / Math.max(1, right - left)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, blue, shade);
    }
  }
  
  // Bare feet (sailor)
  setPixel(ctx, 9, 43, skin[4]);
  setPixel(ctx, 10, 43, skin[5]);
  setPixel(ctx, 13, 43, skin[3]);
  setPixel(ctx, 14, 43, skin[2]);
}

// ====================
// SITI - Young Malay servant seeking sanctuary
// ====================
function drawSiti(ctx) {
  const skin = PALETTE.skinMalay;
  const cloth = PALETTE.clothBlue;

  // Tudung (headscarf) - humble cloth, not silk
  for (let y = 2; y <= 20; y++) {
    let width = y < 8 ? 4 + y : 12;
    if (y > 14) width = 12 - (y - 14);
    const left = 12 - Math.floor(width / 2);
    const right = 11 + Math.ceil(width / 2);

    for (let x = left; x <= right; x++) {
      const shade = x < 10 ? 5 : x > 14 ? 2 : 4;
      setPixel(ctx, x, y, cloth[shade]);
    }
  }

  // Face visible
  for (let y = 9; y <= 14; y++) {
    for (let x = 9; x <= 14; x++) {
      const shade = x < 11 ? 5 : x > 13 ? 2 : 4;
      setPixel(ctx, x, y, skin[shade]);
    }
  }
  // Eyes
  setPixel(ctx, 10, 11, '#000000');
  setPixel(ctx, 13, 11, '#000000');
  // Modest expression
  setPixel(ctx, 10, 13, skin[3]);
  setPixel(ctx, 11, 13, skin[2]);
  setPixel(ctx, 12, 13, skin[2]);
  setPixel(ctx, 13, 13, skin[3]);

  // Simple kebaya blouse (no necklace, no jewelry)
  for (let y = 18; y <= 30; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 2 + ((x - 6) / (17 - 6)) * 4;  // smooth gradient
      setDitheredPixel(ctx, x, y, cloth, shade);
    }
  }

  // Arms
  for (let y = 20; y <= 29; y++) {
    setPixel(ctx, 4, y, cloth[5]);
    setPixel(ctx, 5, y, cloth[6]);
    setPixel(ctx, 18, y, cloth[2]);
    setPixel(ctx, 19, y, cloth[1]);
  }
  // Hands
  setPixel(ctx, 4, 30, skin[4]);
  setPixel(ctx, 5, 30, skin[5]);
  setPixel(ctx, 18, 30, skin[2]);
  setPixel(ctx, 19, 30, skin[1]);

  // Simple sarong (no batik pattern - plain cloth for servant)
  for (let y = 30; y <= 44; y++) {
    for (let x = 5; x <= 18; x++) {
      const shade = 2 + ((x - 5) / (18 - 5)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, cloth, shade);
    }
  }

  // Bare feet
  setPixel(ctx, 8, 45, skin[4]);
  setPixel(ctx, 9, 45, skin[5]);
  setPixel(ctx, 10, 45, skin[4]);
  setPixel(ctx, 13, 45, skin[3]);
  setPixel(ctx, 14, 45, skin[2]);
  setPixel(ctx, 15, 45, skin[2]);

  // Headscarf fringe (at boundary of headscarf and face)
  setPixel(ctx, 9, 8, cloth[6]); // fringe light
  setPixel(ctx, 10, 8, cloth[3]); // fringe dark
  setPixel(ctx, 11, 8, cloth[5]); // fringe light
}

// ====================
// ALVARES - Wealthy Portuguese antagonist
// ====================
function drawAlvares(ctx) {
  const skin = PALETTE.skinPortuguese;
  const dark = PALETTE.shadow;
  const white = PALETTE.whitewash;
  const gold = PALETTE.gold;
  const boots = PALETTE.wood;

  // Dark receding hair (short, y:4-7 only) with strand noise
  for (let y = 4; y <= 7; y++) {
    for (let x = 9; x <= 14; x++) {
      const shade = 3 + (7 - y) * 0.5 + (seededRandom(x, y * 3, 9) - 0.5) * 1.5;
      setPixel(ctx, x, y, dark[Math.floor(Math.max(1, Math.min(6, shade)))]);
    }
  }
  // Hair highlight streak
  setPixel(ctx, 11, 5, dark[5]);
  // Receding hairline - narrower at top
  for (let y = 4; y <= 5; y++) {
    setPixel(ctx, 8, y, dark[2]);
    setPixel(ctx, 15, y, dark[1]);
  }

  // Face (clean-shaven, no beard)
  for (let y = 8; y <= 15; y++) {
    for (let x = 8; x <= 15; x++) {
      const shade = x < 10 ? 6 : x > 14 ? 2 : 4;
      setPixel(ctx, x, y, skin[shade]);
    }
  }
  // Eyes
  setPixel(ctx, 9, 11, '#000000');
  setPixel(ctx, 14, 11, '#000000');
  // Eyebrows (heavy)
  setPixel(ctx, 9, 10, dark[4]);
  setPixel(ctx, 10, 10, dark[4]);
  setPixel(ctx, 13, 10, dark[4]);
  setPixel(ctx, 14, 10, dark[4]);
  // Nose
  setPixel(ctx, 11, 12, skin[6]);
  setPixel(ctx, 12, 12, skin[5]);
  // Thin-lipped mouth
  setPixel(ctx, 10, 14, skin[2]);
  setPixel(ctx, 11, 14, skin[2]);
  setPixel(ctx, 12, 14, skin[2]);
  setPixel(ctx, 13, 14, skin[2]);
  // Chin/jaw
  for (let x = 9; x <= 14; x++) {
    setPixel(ctx, x, 16, skin[3]);
  }

  // Ears
  setPixel(ctx, 7, 11, skin[4]);
  setPixel(ctx, 7, 12, skin[3]);
  setPixel(ctx, 16, 11, skin[2]);
  setPixel(ctx, 16, 12, skin[1]);

  // Wide white ruff collar (y:17-19)
  for (let y = 17; y <= 19; y++) {
    for (let x = 7; x <= 16; x++) {
      const shade = y === 17 ? 7 : y === 18 ? 6 : 5;
      setPixel(ctx, x, y, white[shade]);
    }
  }

  // Rich dark doublet - stocky/wide build (x:5-18)
  for (let y = 19; y <= 32; y++) {
    for (let x = 5; x <= 18; x++) {
      let shade = 2 + ((x - 5) / (18 - 5)) * 4;  // smooth gradient
      // Vertical seam shadow
      if (x === 11 || x === 12) shade -= 0.5;
      setDitheredPixel(ctx, x, y, dark, shade);
    }
  }

  // Gold chain across chest (y:22-23)
  for (let x = 7; x <= 16; x++) {
    if (x % 2 === 0) {
      setPixel(ctx, x, 22, gold[5]);
      setPixel(ctx, x, 23, gold[4]);
    }
  }

  // Gold belt buckle (y:32-33)
  for (let x = 5; x <= 18; x++) {
    setPixel(ctx, x, 32, dark[5]);
    setPixel(ctx, x, 33, dark[4]);
  }
  setPixel(ctx, 10, 32, gold[6]);
  setPixel(ctx, 11, 32, gold[6]);
  setPixel(ctx, 12, 32, gold[5]);
  setPixel(ctx, 13, 32, gold[5]);
  setPixel(ctx, 10, 33, gold[5]);
  setPixel(ctx, 11, 33, gold[4]);
  setPixel(ctx, 12, 33, gold[4]);
  setPixel(ctx, 13, 33, gold[3]);

  // Arms (stocky, wide sleeves)
  for (let y = 20; y <= 31; y++) {
    setPixel(ctx, 3, y, dark[5]);
    setPixel(ctx, 4, y, dark[6]);
    setPixel(ctx, 19, y, dark[2]);
    setPixel(ctx, 20, y, dark[1]);
  }
  // Hands
  setPixel(ctx, 3, 32, skin[5]);
  setPixel(ctx, 4, 32, skin[4]);
  setPixel(ctx, 19, 32, skin[2]);
  setPixel(ctx, 20, 32, skin[1]);

  // Dark pants (y:34-42)
  for (let y = 34; y <= 42; y++) {
    for (let x = 7; x <= 16; x++) {
      const shade = 2 + ((x - 7) / (16 - 7)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, dark, shade);
    }
  }
  // Inner leg shadow
  for (let y = 35; y <= 41; y++) {
    setPixel(ctx, 11, y, dark[1]);
    setPixel(ctx, 12, y, dark[1]);
  }

  // Fine boots (y:42-46)
  for (let y = 42; y <= 46; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 2 + ((x - 6) / (17 - 6)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, boots, shade);
    }
  }
  // Boot soles
  for (let x = 6; x <= 10; x++) setPixel(ctx, x, 47, boots[1]);
  for (let x = 13; x <= 17; x++) setPixel(ctx, x, 47, boots[0]);

  // Facial details - sneer + furrowed brow
  setPixel(ctx, 10, 14, skin[1]); // sneer line (overwrites mouth)
  setPixel(ctx, 13, 14, skin[1]); // sneer line
  setPixel(ctx, 9, 9, dark[5]); // furrowed brow left
  setPixel(ctx, 14, 9, dark[5]); // furrowed brow right

  // Specular highlights - gold chain
  setPixel(ctx, 8, 22, PALETTE.specular[5]); // chain glint
  setPixel(ctx, 12, 22, PALETTE.specular[5]); // chain glint
  setPixel(ctx, 10, 32, PALETTE.specular[5]); // buckle glint
}

// ====================
// MAK ENANG - Elderly Malay kampung healer
// ====================
function drawMakEnang(ctx) {
  // Aged skin: shift indices -1 for darker, older appearance
  const skin = PALETTE.skinMalay;
  const skinShade = (idx) => skin[Math.max(0, idx - 1)];
  const gray = PALETTE.stone;
  const cloth = PALETTE.thatch;
  const herb = PALETTE.wood;

  // Headscarf in earth tones
  for (let y = 2; y <= 20; y++) {
    let width = y < 8 ? 4 + y : 12;
    if (y > 14) width = 12 - (y - 14);
    const left = 12 - Math.floor(width / 2);
    const right = 11 + Math.ceil(width / 2);

    for (let x = left; x <= right; x++) {
      const shade = x < 10 ? 5 : x > 14 ? 2 : 4;
      setPixel(ctx, x, y, cloth[shade]);
    }
  }

  // Gray hair peeking under headscarf at temples
  for (let y = 8; y <= 10; y++) {
    setPixel(ctx, 8, y, gray[4]);
    setPixel(ctx, 15, y, gray[3]);
  }

  // Face visible (aged, darker skin tones)
  for (let y = 9; y <= 14; y++) {
    for (let x = 9; x <= 14; x++) {
      const shade = x < 11 ? 4 : x > 13 ? 1 : 3;
      setPixel(ctx, x, y, skinShade(shade));
    }
  }
  // Eyes (wise, slightly squinted)
  setPixel(ctx, 10, 11, '#000000');
  setPixel(ctx, 13, 11, '#000000');
  // Wrinkle lines around eyes
  setPixel(ctx, 9, 11, skinShade(2));
  setPixel(ctx, 14, 11, skinShade(1));
  // Kind smile
  setPixel(ctx, 10, 13, skinShade(2));
  setPixel(ctx, 11, 13, skinShade(1));
  setPixel(ctx, 12, 13, skinShade(1));
  setPixel(ctx, 13, 13, skinShade(2));

  // Simple baju (blouse) in earth tones - thinner build
  for (let y = 18; y <= 30; y++) {
    for (let x = 7; x <= 16; x++) {
      const shade = 2 + ((x - 7) / (16 - 7)) * 4;  // smooth gradient
      setDitheredPixel(ctx, x, y, cloth, shade);
    }
  }

  // Thinner arms (single pixel width each side)
  for (let y = 20; y <= 29; y++) {
    setPixel(ctx, 5, y, cloth[5]);
    setPixel(ctx, 6, y, cloth[4]);
    setPixel(ctx, 17, y, cloth[2]);
    setPixel(ctx, 18, y, cloth[1]);
  }
  // Hands (aged skin)
  setPixel(ctx, 5, 30, skinShade(4));
  setPixel(ctx, 6, 30, skinShade(3));
  setPixel(ctx, 17, 30, skinShade(2));
  setPixel(ctx, 18, 30, skinShade(1));

  // Herb pouch at waist (2x2 pixels)
  setPixel(ctx, 7, 31, herb[4]);
  setPixel(ctx, 8, 31, herb[3]);
  setPixel(ctx, 7, 32, herb[3]);
  setPixel(ctx, 8, 32, herb[2]);

  // Simple plain sarong in earth tones
  for (let y = 30; y <= 44; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 2 + ((x - 6) / (17 - 6)) * 3;  // smooth gradient
      setDitheredPixel(ctx, x, y, cloth, shade);
    }
  }

  // Bare feet (aged skin)
  setPixel(ctx, 8, 45, skinShade(4));
  setPixel(ctx, 9, 45, skinShade(3));
  setPixel(ctx, 10, 45, skinShade(3));
  setPixel(ctx, 13, 45, skinShade(2));
  setPixel(ctx, 14, 45, skinShade(1));
  setPixel(ctx, 15, 45, skinShade(1));

  // Forehead wrinkles
  setPixel(ctx, 10, 9, skin[Math.max(0, 1)]); // wrinkle 1
  setPixel(ctx, 11, 9, skin[Math.max(0, 1)]); // wrinkle 1
  setPixel(ctx, 12, 9, skin[Math.max(0, 1)]); // wrinkle 1
  setPixel(ctx, 13, 9, skin[Math.max(0, 1)]); // wrinkle 1

  // Headscarf fringe (at boundary of headscarf and face)
  setPixel(ctx, 9, 8, cloth[6]); // fringe light
  setPixel(ctx, 10, 8, cloth[3]); // fringe dark
  setPixel(ctx, 11, 8, cloth[5]); // fringe light
}

// Indian/Tamil merchant crowd sprite - Dravidian skin, jama coat, pagri turban
function drawCrowdIndian(ctx) {
  const skin = PALETTE.skinIndian;  // Uses new Indian skin palette
  const cloth = PALETTE.clothRed;   // Jama coat in deep red
  const white = PALETTE.whitewash;
  const gold = PALETTE.gold;

  // Pagri turban (wound cloth)
  for (let y = 2; y <= 8; y++) {
    for (let x = 7; x <= 16; x++) {
      const stripe = (x + y) % 3 === 0;
      const shade = x < 10 ? 6 : x > 14 ? 3 : 5;
      setPixel(ctx, x, y, stripe ? gold[shade - 1] : white[shade]);
    }
  }

  // Face
  for (let y = 8; y <= 15; y++) {
    for (let x = 8; x <= 15; x++) {
      const shade = x < 10 ? 5 : x > 14 ? 2 : 4;
      setPixel(ctx, x, y, skin[shade]);
    }
  }
  // Eyes
  setPixel(ctx, 9, 11, '#000000');
  setPixel(ctx, 14, 11, '#000000');
  // Mustache
  for (let x = 10; x <= 13; x++) {
    setPixel(ctx, x, 13, PALETTE.shadow[3]);
  }

  // Neck
  for (let y = 16; y <= 17; y++) {
    for (let x = 10; x <= 13; x++) {
      setPixel(ctx, x, y, skin[3]);
    }
  }

  // Jama coat (long fitted coat) - cross-wrap front
  for (let y = 18; y <= 38; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 2 + ((x - 6) / 11) * 4;
      setDitheredPixel(ctx, x, y, cloth, shade);
    }
    // Gold trim on wrap edge (diagonal)
    const trimX = 10 + Math.floor((y - 18) * 0.2);
    if (trimX >= 6 && trimX <= 17) {
      setPixel(ctx, trimX, y, gold[4]);
    }
  }

  // Arms
  for (let y = 20; y <= 32; y++) {
    setPixel(ctx, 4, y, cloth[5]);
    setPixel(ctx, 5, y, cloth[6]);
    setPixel(ctx, 18, y, cloth[2]);
    setPixel(ctx, 19, y, cloth[1]);
  }
  // Hands
  setPixel(ctx, 4, 33, skin[4]);
  setPixel(ctx, 5, 33, skin[5]);
  setPixel(ctx, 18, 33, skin[2]);
  setPixel(ctx, 19, 33, skin[1]);

  // Dhoti/veshti (lower garment) - white wrapped cloth
  for (let y = 38; y <= 44; y++) {
    for (let x = 6; x <= 17; x++) {
      const shade = 3 + ((x - 6) / 11) * 3;
      setDitheredPixel(ctx, x, y, white, shade);
    }
  }

  // Sandals
  for (let x = 7; x <= 16; x++) {
    setPixel(ctx, x, 45, PALETTE.wood[4]);
    setPixel(ctx, x, 46, PALETTE.wood[3]);
  }
}

// Character metadata for directional transforms
const CHARACTER_META = {
  player: {
    drawFunc: drawPlayer,
    hairColor: PALETTE.wood,
    skinColor: PALETTE.skinPortuguese,
    mainCloth: PALETTE.clothRed,
    headTop: 4, headBottom: 16,  // y-range of head in 24×48 space
    faceLeft: 8, faceRight: 15,
    legSplit: 11, // x-center between legs
    legTop: 34, legBottom: 47,
    hasHelmet: false, hasLongRobe: false,
  },
  'fernao-gomes': {
    drawFunc: drawFernaoGomes,
    hairColor: PALETTE.stone,  // gray hair
    skinColor: PALETTE.skinPortuguese,
    mainCloth: PALETTE.clothRed,
    headTop: 4, headBottom: 18,  // beard extends lower
    faceLeft: 8, faceRight: 15,
    legSplit: 11, legTop: 34, legBottom: 46,
    hasHelmet: false, hasLongRobe: false,
  },
  'capitao-rodrigues': {
    drawFunc: drawCapitaoRodrigues,
    hairColor: PALETTE.stone,  // morion helmet
    skinColor: PALETTE.skinPortuguese,
    mainCloth: PALETTE.stone,   // armor
    headTop: 0, headBottom: 14,  // helmet extends higher
    faceLeft: 8, faceRight: 15,
    legSplit: 11, legTop: 38, legBottom: 46,
    hasHelmet: true, hasLongRobe: false,
  },
  'padre-tomas': {
    drawFunc: drawPadreTomas,
    hairColor: PALETTE.skinPortuguese,  // tonsured
    skinColor: PALETTE.skinPortuguese,
    mainCloth: PALETTE.shadow,   // black cassock
    headTop: 4, headBottom: 15,
    faceLeft: 8, faceRight: 15,
    legSplit: 11, legTop: 44, legBottom: 47,
    hasHelmet: false, hasLongRobe: true,
  },
  aminah: {
    drawFunc: drawAminah,
    hairColor: PALETTE.clothSilk,  // headscarf
    skinColor: PALETTE.skinMalay,
    mainCloth: PALETTE.clothSilk,
    headTop: 2, headBottom: 14,
    faceLeft: 9, faceRight: 14,
    legSplit: 11, legTop: 30, legBottom: 45,
    hasHelmet: false, hasLongRobe: true,  // sarong counts as long
  },
  'chen-wei': {
    drawFunc: drawChenWei,
    hairColor: PALETTE.shadow,  // black cap
    skinColor: PALETTE.skinChinese,
    mainCloth: PALETTE.clothSilk,
    headTop: 3, headBottom: 16,
    faceLeft: 8, faceRight: 15,
    legSplit: 11, legTop: 44, legBottom: 46,
    hasHelmet: false, hasLongRobe: true,  // changshan
  },
  rashid: {
    drawFunc: drawRashid,
    hairColor: PALETTE.whitewash,  // keffiyeh
    skinColor: PALETTE.skinMalay,
    mainCloth: PALETTE.whitewash,
    headTop: 2, headBottom: 18,
    faceLeft: 9, faceRight: 14,
    legSplit: 11, legTop: 32, legBottom: 43,
    hasHelmet: false, hasLongRobe: false,
  },
  siti: {
    drawFunc: drawSiti,
    hairColor: PALETTE.clothBlue,
    skinColor: PALETTE.skinMalay,
    mainCloth: PALETTE.clothBlue,
    headTop: 2, headBottom: 14,
    faceLeft: 9, faceRight: 14,
    legSplit: 11, legTop: 30, legBottom: 45,
    hasHelmet: false, hasLongRobe: true,
  },
  alvares: {
    drawFunc: drawAlvares,
    hairColor: PALETTE.shadow,
    skinColor: PALETTE.skinPortuguese,
    mainCloth: PALETTE.shadow,
    headTop: 4, headBottom: 16,
    faceLeft: 8, faceRight: 15,
    legSplit: 11, legTop: 34, legBottom: 46,
    hasHelmet: false, hasLongRobe: false,
  },
  'mak-enang': {
    drawFunc: drawMakEnang,
    hairColor: PALETTE.thatch,
    skinColor: PALETTE.skinMalay,
    mainCloth: PALETTE.thatch,
    headTop: 2, headBottom: 14,
    faceLeft: 9, faceRight: 14,
    legSplit: 11, legTop: 30, legBottom: 45,
    hasHelmet: false, hasLongRobe: true,
  },
  'crowd-indian': {
    drawFunc: drawCrowdIndian,
    hairColor: PALETTE.whitewash,
    skinColor: PALETTE.skinIndian || PALETTE.skinMalay,
    mainCloth: PALETTE.clothRed,
    headTop: 2, headBottom: 15,
    faceLeft: 8, faceRight: 15,
    legSplit: 11, legTop: 38, legBottom: 46,
    hasHelmet: false, hasLongRobe: true,
  },
};

module.exports = {
  CHAR_WIDTH,
  CHAR_HEIGHT,
  drawPlayer,
  drawFernaoGomes,
  drawCapitaoRodrigues,
  drawPadreTomas,
  drawAminah,
  drawChenWei,
  drawRashid,
  drawSiti,
  drawAlvares,
  drawMakEnang,
  drawCrowdIndian,
  CHARACTER_META,
  setPixel,
  setDitheredPixel,
  seededRandom,
  drawShadedEllipse,
  drawShadedRect,
  addShadowOutline,
  addGroundShadow,
};
