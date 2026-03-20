/**
 * Ultima 8 Style Object Sprite Generator
 * Creates detailed environmental objects with proper shading
 */

const { createCanvas } = require('canvas');
const { PALETTE } = require('./palette.cjs');

function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// Ambient occlusion - graded shadow at object base
function addAmbientOcclusion(ctx, baseY, leftX, rightX, height) {
  const width = rightX - leftX;
  const cx = (leftX + rightX) / 2;
  const rx = width / 2 + 1;
  for (let row = 0; row < height && row < 3; row++) {
    const y = baseY + row;
    const alphaBase = row === 0 ? 0.5 : row === 1 ? 0.3 : 0.15;
    for (let x = leftX - 1; x <= rightX + 1; x++) {
      const dx = (x - cx) / rx;
      const ellipticFalloff = Math.max(0, 1 - dx * dx);
      const alpha = alphaBase * ellipticFalloff;
      if (alpha > 0.05) {
        ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(2)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function seededRandom(x, y, seed = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

// Palm tree - tall tropical tree (16x48)
function drawPalmTree(ctx) {
  const trunk = PALETTE.wood;
  const leaves = PALETTE.jungle;
  
  // Trunk (curved, textured)
  for (let y = 20; y < 48; y++) {
    const wobble = Math.sin(y * 0.3) * 0.5;
    const cx = 8 + Math.floor(wobble);
    for (let x = cx - 2; x <= cx + 1; x++) {
      if (x >= 0 && x < 16) {
        const shade = x === cx - 2 ? trunk.light : x === cx + 1 ? trunk.darkest : trunk.mid;
        setPixel(ctx, x, y, shade);
      }
    }
    // Ring texture
    if (y % 4 === 0) {
      for (let x = cx - 2; x <= cx + 1; x++) {
        if (x >= 0 && x < 16) setPixel(ctx, x, y, trunk.dark);
      }
    }
  }
  
  // Palm fronds (radiating from top)
  const frondAngles = [
    { dx: -7, dy: 4, len: 12 },
    { dx: -5, dy: -2, len: 10 },
    { dx: -2, dy: -5, len: 8 },
    { dx: 2, dy: -5, len: 8 },
    { dx: 5, dy: -2, len: 10 },
    { dx: 7, dy: 4, len: 12 }
  ];
  
  const topY = 18;
  const topX = 8;
  
  frondAngles.forEach(frond => {
    for (let i = 0; i < frond.len; i++) {
      const t = i / frond.len;
      const x = Math.round(topX + frond.dx * t);
      const y = Math.round(topY + frond.dy * t - (1 - t) * 3);
      if (x >= 0 && x < 16 && y >= 0 && y < 48) {
        setPixel(ctx, x, y, i < 3 ? leaves.light : leaves.mid);
        // Frond width
        if (x > 0) setPixel(ctx, x - 1, y, leaves.dark);
        if (x < 15) setPixel(ctx, x + 1, y, leaves.darkest);
      }
    }
  });
  
  // Coconuts
  setPixel(ctx, 7, 19, trunk.dark);
  setPixel(ctx, 8, 19, trunk.mid);
  setPixel(ctx, 9, 20, trunk.dark);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 46, 4, 12, 2);
}

// Market stall with goods (32x32)
function drawMarketStall(ctx) {
  const wood = PALETTE.wood;
  const cloth = PALETTE.clothRed;
  const gold = PALETTE.gold;
  
  // Awning (striped)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 32; x++) {
      const stripe = Math.floor(x / 4) % 2;
      setPixel(ctx, x, y, stripe ? cloth.mid : PALETTE.whitewash.mid);
    }
  }
  // Awning shadow
  for (let x = 0; x < 32; x++) {
    const stripe = Math.floor(x / 4) % 2;
    setPixel(ctx, x, 7, stripe ? cloth.dark : PALETTE.whitewash.dark);
  }
  
  // Support poles
  for (let y = 0; y < 32; y++) {
    setPixel(ctx, 2, y, wood.mid);
    setPixel(ctx, 3, y, wood.dark);
    setPixel(ctx, 28, y, wood.mid);
    setPixel(ctx, 29, y, wood.dark);
  }
  
  // Counter/table
  for (let y = 18; y < 22; y++) {
    for (let x = 4; x < 28; x++) {
      const shade = y === 18 ? wood.light : y === 21 ? wood.darkest : wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }
  
  // Goods on counter - spices in bowls
  // Bowl 1
  for (let y = 14; y < 18; y++) {
    for (let x = 6; x < 12; x++) {
      if (y === 14) {
        setPixel(ctx, x, y, gold.mid); // Spice (turmeric)
      } else {
        setPixel(ctx, x, y, PALETTE.terracotta.mid);
      }
    }
  }
  
  // Bowl 2  
  for (let y = 14; y < 18; y++) {
    for (let x = 14; x < 20; x++) {
      if (y === 14) {
        setPixel(ctx, x, y, cloth.dark); // Spice (chili)
      } else {
        setPixel(ctx, x, y, PALETTE.terracotta.dark);
      }
    }
  }
  
  // Bowl 3
  for (let y = 14; y < 18; y++) {
    for (let x = 22; x < 28; x++) {
      if (y === 14) {
        setPixel(ctx, x, y, PALETTE.jungle.dark); // Spice (herbs)
      } else {
        setPixel(ctx, x, y, PALETTE.terracotta.mid);
      }
    }
  }
  
  // Front panel with shadow
  for (let y = 22; y < 30; y++) {
    for (let x = 4; x < 28; x++) {
      setPixel(ctx, x, y, wood.dark);
    }
  }

  // Wood grain texture on counter and front panel
  for (let y = 19; y < 30; y++) {
    if (y % 3 === 0) {
      for (let x = 5; x < 27; x++) {
        if (seededRandom(x, y, 10) > 0.7) setPixel(ctx, x, y, wood.darkest);
      }
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 30, 3, 29, 2);
}

// Barrel (16x20)
function drawBarrel(ctx) {
  const wood = PALETTE.wood;
  const metal = PALETTE.stone;
  
  // Barrel body (curved)
  for (let y = 2; y < 18; y++) {
    const bulge = Math.sin((y - 2) / 16 * Math.PI) * 2;
    const left = Math.floor(4 - bulge);
    const right = Math.floor(11 + bulge);
    
    for (let x = left; x <= right; x++) {
      let shade;
      if (x === left) shade = wood.lightest;
      else if (x === left + 1) shade = wood.light;
      else if (x === right) shade = wood.darkest;
      else if (x === right - 1) shade = wood.dark;
      else shade = wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }
  
  // Metal bands
  for (let band of [4, 9, 14]) {
    const bulge = Math.sin((band - 2) / 16 * Math.PI) * 2;
    const left = Math.floor(4 - bulge);
    const right = Math.floor(11 + bulge);
    for (let x = left; x <= right; x++) {
      setPixel(ctx, x, band, x <= left + 1 ? metal.light : x >= right - 1 ? metal.darkest : metal.mid);
    }
  }
  
  // Top rim
  for (let x = 4; x <= 11; x++) {
    setPixel(ctx, x, 1, wood.light);
    setPixel(ctx, x, 2, wood.dark);
  }
  
  // Wood grain detail
  for (let y = 3; y < 17; y++) {
    if (y % 4 === 0) {
      const bulge = Math.sin((y - 2) / 16 * Math.PI) * 2;
      const left = Math.floor(4 - bulge);
      const right = Math.floor(11 + bulge);
      for (let x = left + 1; x < right; x++) {
        if (seededRandom(x, y, 1) > 0.6) setPixel(ctx, x, y, wood.dark);
      }
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 18, 4, 12, 2);
}

// Crate (16x16)
function drawCrate(ctx) {
  const wood = PALETTE.wood;
  
  // Main body
  for (let y = 2; y < 14; y++) {
    for (let x = 1; x < 15; x++) {
      let shade;
      if (y === 2) shade = wood.light;
      else if (x === 1) shade = wood.light;
      else if (y === 13) shade = wood.darkest;
      else if (x === 14) shade = wood.dark;
      else shade = wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }
  
  // Horizontal planks
  for (let x = 1; x < 15; x++) {
    setPixel(ctx, x, 5, wood.dark);
    setPixel(ctx, x, 10, wood.dark);
  }
  
  // Vertical supports
  for (let y = 2; y < 14; y++) {
    setPixel(ctx, 4, y, wood.dark);
    setPixel(ctx, 11, y, wood.dark);
  }
  
  // Corner brackets
  setPixel(ctx, 2, 3, PALETTE.stone.mid);
  setPixel(ctx, 13, 3, PALETTE.stone.mid);
  setPixel(ctx, 2, 12, PALETTE.stone.mid);
  setPixel(ctx, 13, 12, PALETTE.stone.mid);

  // Wood grain detail on planks
  for (let y = 3; y < 13; y++) {
    if (y % 3 === 0) {
      for (let x = 2; x < 14; x++) {
        if (seededRandom(x, y, 2) > 0.6) setPixel(ctx, x, y, wood.dark);
      }
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 1, 15, 2);
}

// Pottery/amphora (16x24)
function drawPottery(ctx) {
  const clay = PALETTE.terracotta;
  
  // Neck
  for (let y = 0; y < 4; y++) {
    for (let x = 6; x < 10; x++) {
      setPixel(ctx, x, y, x === 6 ? clay.light : x === 9 ? clay.dark : clay.mid);
    }
  }
  
  // Lip/rim
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 0, clay.lightest);
  }
  
  // Handles
  for (let y = 4; y < 8; y++) {
    setPixel(ctx, 4, y, clay.mid);
    setPixel(ctx, 3, y, clay.light);
    setPixel(ctx, 11, y, clay.dark);
    setPixel(ctx, 12, y, clay.darkest);
  }
  
  // Body (curved)
  for (let y = 4; y < 20; y++) {
    const t = (y - 4) / 16;
    const bulge = Math.sin(t * Math.PI) * 4;
    const left = Math.floor(6 - bulge);
    const right = Math.floor(9 + bulge);
    
    for (let x = left; x <= right; x++) {
      let shade;
      if (x === left) shade = clay.lightest;
      else if (x === left + 1) shade = clay.light;
      else if (x === right) shade = clay.darkest;
      else if (x === right - 1) shade = clay.dark;
      else shade = clay.mid;
      setPixel(ctx, x, y, shade);
    }
  }
  
  // Decorative band
  const bandY = 10;
  const bulge = Math.sin((bandY - 4) / 16 * Math.PI) * 4;
  for (let x = Math.floor(6 - bulge); x <= Math.floor(9 + bulge); x++) {
    setPixel(ctx, x, bandY, PALETTE.gold.mid);
    setPixel(ctx, x, bandY + 1, PALETTE.gold.dark);
  }
  
  // Base
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 20, clay.dark);
    setPixel(ctx, x, 21, clay.darkest);
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 22, 3, 13, 2);
}

// Lantern (8x16)
function drawLantern(ctx) {
  const metal = PALETTE.stone;
  const gold = PALETTE.gold;
  
  // Hook at top
  setPixel(ctx, 3, 0, metal.mid);
  setPixel(ctx, 4, 0, metal.mid);
  setPixel(ctx, 4, 1, metal.mid);
  
  // Top cap
  for (let x = 2; x < 6; x++) {
    setPixel(ctx, x, 2, metal.light);
    setPixel(ctx, x, 3, metal.mid);
  }
  
  // Glass panels (glowing)
  for (let y = 4; y < 12; y++) {
    for (let x = 2; x < 6; x++) {
      if (x === 2) setPixel(ctx, x, y, gold.lightest);
      else if (x === 5) setPixel(ctx, x, y, gold.mid);
      else setPixel(ctx, x, y, gold.light);
    }
  }
  
  // Frame bars
  setPixel(ctx, 1, 4, metal.mid);
  setPixel(ctx, 1, 11, metal.mid);
  setPixel(ctx, 6, 4, metal.dark);
  setPixel(ctx, 6, 11, metal.dark);
  
  // Bottom
  for (let x = 2; x < 6; x++) {
    setPixel(ctx, x, 12, metal.mid);
    setPixel(ctx, x, 13, metal.dark);
  }
  
  // Glow effect
  setPixel(ctx, 3, 7, '#FFFFFF');
  setPixel(ctx, 4, 8, '#FFFFFF');
}

// Stone cross (16x32)
function drawStoneCross(ctx) {
  const stone = PALETTE.stone;
  
  // Vertical beam
  for (let y = 0; y < 32; y++) {
    for (let x = 5; x < 11; x++) {
      let shade;
      if (x === 5) shade = stone.light;
      else if (x === 10) shade = stone.darkest;
      else shade = stone.mid;
      setPixel(ctx, x, y, shade);
    }
  }
  
  // Horizontal beam
  for (let y = 6; y < 12; y++) {
    for (let x = 0; x < 16; x++) {
      if (x < 5 || x > 10) {
        let shade;
        if (y === 6) shade = stone.light;
        else if (y === 11) shade = stone.darkest;
        else shade = stone.mid;
        setPixel(ctx, x, y, shade);
      }
    }
  }
  
  // Top highlight
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 0, stone.lightest);
  }
  for (let x = 0; x < 16; x++) {
    setPixel(ctx, x, 6, stone.lightest);
  }
  
  // Weathering details
  setPixel(ctx, 7, 4, stone.dark);
  setPixel(ctx, 8, 15, stone.dark);
  setPixel(ctx, 6, 22, stone.dark);
  setPixel(ctx, 3, 9, stone.dark);
  setPixel(ctx, 12, 8, stone.dark);
  
  // Base
  for (let y = 28; y < 32; y++) {
    for (let x = 3; x < 13; x++) {
      setPixel(ctx, x, y, y === 28 ? stone.mid : stone.dark);
    }
  }

  // Stone pitting (~5% density)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 16; x++) {
      if (seededRandom(x, y, 3) > 0.95) {
        setPixel(ctx, x, y, stone.dark);
      }
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 31, 3, 13, 2);
}

// Fishing net (16x16)
function drawFishingNet(ctx) {
  const rope = PALETTE.thatch;
  
  // Net pattern (diagonal mesh)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) {
        setPixel(ctx, x, y, rope.mid);
      }
    }
  }
  
  // Knots at intersections
  for (let y = 0; y < 16; y += 4) {
    for (let x = 0; x < 16; x += 4) {
      setPixel(ctx, x, y, rope.dark);
    }
  }
  
  // Cork floats
  setPixel(ctx, 2, 1, PALETTE.whitewash.mid);
  setPixel(ctx, 6, 1, PALETTE.whitewash.mid);
  setPixel(ctx, 10, 1, PALETTE.whitewash.mid);
  setPixel(ctx, 14, 1, PALETTE.whitewash.mid);
}

// Anchor (16x24)
function drawAnchor(ctx) {
  const metal = PALETTE.stone;
  
  // Ring at top
  for (let y = 0; y < 4; y++) {
    setPixel(ctx, 6, y, metal.mid);
    setPixel(ctx, 9, y, metal.dark);
  }
  setPixel(ctx, 7, 0, metal.light);
  setPixel(ctx, 8, 0, metal.mid);
  setPixel(ctx, 7, 3, metal.dark);
  setPixel(ctx, 8, 3, metal.darkest);
  
  // Shank (vertical)
  for (let y = 4; y < 20; y++) {
    setPixel(ctx, 7, y, metal.light);
    setPixel(ctx, 8, y, metal.dark);
  }
  
  // Stock (horizontal bar near top)
  for (let x = 3; x < 13; x++) {
    setPixel(ctx, x, 6, metal.light);
    setPixel(ctx, x, 7, metal.mid);
    setPixel(ctx, x, 8, metal.dark);
  }
  
  // Crown and arms
  for (let y = 18; y < 22; y++) {
    for (let x = 2; x < 6; x++) {
      setPixel(ctx, x, y, x === 2 ? metal.light : metal.mid);
    }
    for (let x = 10; x < 14; x++) {
      setPixel(ctx, x, y, x === 13 ? metal.darkest : metal.dark);
    }
  }
  
  // Flukes (pointed ends)
  setPixel(ctx, 1, 22, metal.light);
  setPixel(ctx, 2, 22, metal.mid);
  setPixel(ctx, 2, 23, metal.dark);
  setPixel(ctx, 14, 22, metal.dark);
  setPixel(ctx, 13, 22, metal.mid);
  setPixel(ctx, 13, 23, metal.darkest);

  // Rivet dots at stock bar ends
  setPixel(ctx, 3, 7, PALETTE.stone.light);
  setPixel(ctx, 12, 7, PALETTE.stone.light);
}

// Woven mat (16x8)
function drawWovenMat(ctx) {
  const fiber = PALETTE.thatch;
  
  // Woven pattern
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const weave = (Math.floor(x / 2) + Math.floor(y / 2)) % 2;
      const shade = weave ? fiber.mid : fiber.dark;
      setPixel(ctx, x, y, shade);
    }
  }
  
  // Edge fringe
  for (let x = 0; x < 16; x += 2) {
    setPixel(ctx, x, 7, fiber.light);
  }
  
  // Wear patterns
  setPixel(ctx, 5, 3, fiber.darkest);
  setPixel(ctx, 10, 5, fiber.darkest);
}

// Cooking fire (16x16)
function drawCookingFire(ctx) {
  const stone = PALETTE.stone;
  const fire = PALETTE.terracotta;
  const gold = PALETTE.gold;
  
  // Stone ring
  for (let y = 10; y < 16; y++) {
    for (let x = 2; x < 14; x++) {
      const dist = Math.sqrt((x - 8) ** 2 + (y - 13) ** 2);
      if (dist > 4 && dist < 7) {
        setPixel(ctx, x, y, stone.mid);
      }
    }
  }
  
  // Fire (animated look)
  const flames = [
    { x: 7, y: 8, c: gold.lightest },
    { x: 8, y: 7, c: gold.light },
    { x: 9, y: 8, c: fire.light },
    { x: 6, y: 9, c: fire.mid },
    { x: 7, y: 9, c: gold.light },
    { x: 8, y: 9, c: fire.light },
    { x: 9, y: 9, c: fire.mid },
    { x: 10, y: 9, c: fire.dark },
    { x: 6, y: 10, c: fire.dark },
    { x: 7, y: 10, c: fire.mid },
    { x: 8, y: 10, c: fire.mid },
    { x: 9, y: 10, c: fire.dark },
    { x: 10, y: 10, c: fire.darkest }
  ];
  
  flames.forEach(f => setPixel(ctx, f.x, f.y, f.c));
  
  // Embers/coals
  setPixel(ctx, 7, 11, fire.darkest);
  setPixel(ctx, 8, 11, fire.dark);
  setPixel(ctx, 9, 11, fire.darkest);
  
  // Smoke wisps
  setPixel(ctx, 8, 4, PALETTE.whitewash.dark);
  setPixel(ctx, 7, 3, PALETTE.whitewash.mid);
  setPixel(ctx, 9, 2, PALETTE.whitewash.light);
}

// Betel nut tray - universal social offering (16×12)
function drawBetelNutTray(ctx) {
  const brass = PALETTE.gold;
  const green = PALETTE.jungle;
  const white = PALETTE.whitewash;
  const red = PALETTE.clothRed;

  // Brass tray (oval)
  for (let y = 4; y < 12; y++) {
    const w = y < 6 ? 5 + y : y > 9 ? 5 + (12 - y) : 8;
    for (let x = 8 - w; x <= 7 + w; x++) {
      if (x >= 0 && x < 16) {
        const shade = x < 4 ? brass.light : x > 12 ? brass.dark : brass.mid;
        setPixel(ctx, x, y, shade);
      }
    }
  }
  // Betel leaf (green)
  setPixel(ctx, 4, 6, green.mid);
  setPixel(ctx, 5, 6, green.light);
  setPixel(ctx, 5, 7, green.mid);
  // Areca nut (brown)
  setPixel(ctx, 8, 6, PALETTE.wood.mid);
  setPixel(ctx, 9, 6, PALETTE.wood.dark);
  // Lime paste (white dot)
  setPixel(ctx, 11, 7, white.lightest);
  // Red betel juice stain
  setPixel(ctx, 7, 8, red.dark);
}

// Tin ingot stack (16×16)
function drawTinIngots(ctx) {
  const metal = PALETTE.stone;

  // Stack of 3 ingots with Portuguese stamps
  for (let row = 0; row < 3; row++) {
    const y = 4 + row * 4;
    const offset = row % 2 === 0 ? 0 : 2;
    for (let iy = 0; iy < 3; iy++) {
      for (let ix = 2 + offset; ix < 14 + offset && ix < 16; ix++) {
        let shade;
        if (iy === 0) shade = metal.light;
        else if (iy === 2) shade = metal.dark;
        else shade = metal.mid;
        if (ix === 2 + offset) shade = metal.bright;
        if (ix === 13 + offset || ix === 15) shade = metal.darkest;
        setPixel(ctx, ix, y + iy, metal[Math.max(0, Math.min(7, [5, 4, 2][iy]))]);
      }
    }
    // Stamp mark (cross)
    setPixel(ctx, 8 + offset, y + 1, PALETTE.gold.mid);
  }
}

// Balance scale (16×20)
function drawBalanceScale(ctx) {
  const metal = PALETTE.gold;
  const wood = PALETTE.wood;

  // Vertical post
  for (let y = 4; y < 18; y++) {
    setPixel(ctx, 7, y, wood.mid);
    setPixel(ctx, 8, y, wood.dark);
  }
  // Base
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 18, wood.mid);
    setPixel(ctx, x, 19, wood.dark);
  }
  // Beam
  for (let x = 1; x < 15; x++) {
    setPixel(ctx, x, 4, metal.light);
    setPixel(ctx, x, 5, metal.mid);
  }
  // Fulcrum triangle
  setPixel(ctx, 7, 3, metal.bright);
  setPixel(ctx, 8, 3, metal.light);
  // Left pan (chains + dish)
  setPixel(ctx, 2, 6, metal.mid);
  setPixel(ctx, 2, 7, metal.mid);
  for (let x = 0; x < 5; x++) {
    setPixel(ctx, x, 8, metal.mid);
    setPixel(ctx, x, 9, metal.dark);
  }
  // Right pan
  setPixel(ctx, 13, 6, metal.mid);
  setPixel(ctx, 13, 7, metal.mid);
  for (let x = 11; x < 16; x++) {
    setPixel(ctx, x, 8, metal.mid);
    setPixel(ctx, x, 9, metal.dark);
  }
}

// Rice mortar/lesung (16×16)
function drawRiceMortar(ctx) {
  const wood = PALETTE.wood;

  // Mortar body (wide bowl carved from wood)
  for (let y = 6; y < 16; y++) {
    const t = (y - 6) / 10;
    const w = 3 + Math.floor(t * 4);
    for (let x = 8 - w; x <= 7 + w; x++) {
      if (x >= 0 && x < 16) {
        const shade = x < 5 ? wood.light : x > 11 ? wood.darkest : wood.mid;
        setPixel(ctx, x, y, shade);
      }
    }
  }
  // Rim highlight
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 6, wood.bright);
  }
  // Pestle (diagonal stick)
  for (let i = 0; i < 8; i++) {
    setPixel(ctx, 10 + Math.floor(i / 2), i, wood.mid);
    setPixel(ctx, 11 + Math.floor(i / 2), i, wood.dark);
  }
}

// Fish trap/bubu (16×20)
function drawFishTrap(ctx) {
  const bamboo = PALETTE.lightWood;

  // Conical bamboo trap shape
  for (let y = 0; y < 18; y++) {
    const w = Math.floor(2 + y * 0.4);
    for (let x = 8 - w; x <= 7 + w; x++) {
      if (x >= 0 && x < 16) {
        // Woven lattice pattern
        if ((x + y) % 3 === 0 || y % 4 === 0) {
          const shade = x < 6 ? bamboo.light : x > 10 ? bamboo.dark : bamboo.mid;
          setPixel(ctx, x, y, shade);
        }
      }
    }
  }
  // Opening at top
  setPixel(ctx, 7, 0, bamboo.dark);
  setPixel(ctx, 8, 0, bamboo.dark);
  // Base ring
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 18, bamboo.midDark);
    setPixel(ctx, x, 19, bamboo.dark);
  }
}

// Prayer mat (16×10)
function drawPrayerMat(ctx) {
  const fiber = PALETTE.clothRed;
  const border = PALETTE.gold;

  // Mat body with subtle pattern
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 16; x++) {
      // Border
      if (x === 0 || x === 15 || y === 0 || y === 9) {
        setPixel(ctx, x, y, border.mid);
      } else {
        // Prayer niche motif (mihrab arch shape)
        const isArch = y < 4 && Math.abs(x - 8) < (4 - y);
        const shade = isArch ? fiber.light : (x + y) % 2 === 0 ? fiber.mid : fiber.midDark;
        setPixel(ctx, x, y, shade);
      }
    }
  }
  // Gold corner accents
  setPixel(ctx, 1, 1, border.bright);
  setPixel(ctx, 14, 1, border.bright);
  setPixel(ctx, 1, 8, border.bright);
  setPixel(ctx, 14, 8, border.bright);
}

// Cannon (32×16)
function drawCannon(ctx) {
  const bronze = PALETTE.gold;
  const wood = PALETTE.wood;

  // Wooden carriage
  for (let y = 10; y < 16; y++) {
    for (let x = 4; x < 28; x++) {
      const shade = y < 12 ? wood.light : y > 14 ? wood.darkest : wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }
  // Wheels
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= 3) {
        setPixel(ctx, 6 + dx, 14 + dy, wood.dark);
        setPixel(ctx, 26 + dx, 14 + dy, wood.dark);
      }
    }
  }
  setPixel(ctx, 6, 14, PALETTE.stone.mid); // axle
  setPixel(ctx, 26, 14, PALETTE.stone.mid);
  // Bronze barrel
  for (let y = 4; y < 10; y++) {
    for (let x = 2; x < 30; x++) {
      const shade = y < 6 ? bronze.light : y > 8 ? bronze.dark : bronze.mid;
      setPixel(ctx, x, y, shade);
    }
  }
  // Muzzle
  for (let y = 5; y < 9; y++) {
    setPixel(ctx, 0, y, bronze.darkest);
    setPixel(ctx, 1, y, bronze.dark);
  }
  // Decorative band
  for (let y = 4; y < 10; y++) {
    setPixel(ctx, 10, y, bronze.bright);
    setPixel(ctx, 20, y, bronze.bright);
  }
  // Touch hole
  setPixel(ctx, 28, 5, PALETTE.shadow.mid);

  // Rivet dots at band positions
  setPixel(ctx, 10, 5, PALETTE.stone.light);
  setPixel(ctx, 10, 8, PALETTE.stone.light);
  setPixel(ctx, 20, 5, PALETTE.stone.light);
  setPixel(ctx, 20, 8, PALETTE.stone.light);
}

// Market stall variant 1 - Fish stall with blue/white awning (32x32)
function drawMarketStall1(ctx) {
  const wood = PALETTE.wood;
  const blue = PALETTE.clothBlue;
  const white = PALETTE.whitewash;
  const fish = PALETTE.water;

  // Awning (blue/white stripes)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 32; x++) {
      const stripe = Math.floor(x / 4) % 2;
      const shade = y < 2 ? 'light' : y > 6 ? 'dark' : 'mid';
      setPixel(ctx, x, y, stripe ? blue[shade] : white[shade]);
    }
  }
  // Awning scalloped bottom
  for (let x = 0; x < 32; x++) {
    const scallop = Math.sin(x * Math.PI / 4) > 0.3;
    if (scallop) {
      const stripe = Math.floor(x / 4) % 2;
      setPixel(ctx, x, 8, stripe ? blue.darkest : white.midDark);
    }
  }

  // Support poles
  for (let y = 0; y < 32; y++) {
    setPixel(ctx, 2, y, wood.light);
    setPixel(ctx, 3, y, wood.dark);
    setPixel(ctx, 28, y, wood.mid);
    setPixel(ctx, 29, y, wood.darkest);
  }

  // Counter/table
  for (let y = 18; y < 22; y++) {
    for (let x = 4; x < 28; x++) {
      const shade = y === 18 ? wood.light : y === 21 ? wood.darkest : wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // Fish on counter - three fish
  // Fish 1
  for (let dx = 0; dx < 7; dx++) {
    const fy = 16 + (dx === 0 || dx === 6 ? 1 : 0);
    setPixel(ctx, 6 + dx, fy, dx < 2 ? fish.mid : dx > 5 ? fish.dark : fish.light);
    setPixel(ctx, 6 + dx, fy + 1, fish.mid);
  }
  setPixel(ctx, 6, 16, fish.dark); // tail
  setPixel(ctx, 12, 17, fish.darkest); // eye

  // Fish 2
  for (let dx = 0; dx < 6; dx++) {
    const fy = 15 + (dx === 0 || dx === 5 ? 1 : 0);
    setPixel(ctx, 15 + dx, fy, dx < 2 ? fish.mid : dx > 4 ? fish.dark : fish.light);
    setPixel(ctx, 15 + dx, fy + 1, fish.midDark);
  }
  setPixel(ctx, 15, 15, fish.dark);
  setPixel(ctx, 20, 16, fish.darkest);

  // Fish 3
  for (let dx = 0; dx < 5; dx++) {
    const fy = 16 + (dx === 0 || dx === 4 ? 1 : 0);
    setPixel(ctx, 23 + dx, fy, dx < 1 ? fish.mid : dx > 3 ? fish.dark : fish.light);
    setPixel(ctx, 23 + dx, fy + 1, fish.mid);
  }
  setPixel(ctx, 23, 16, fish.dark);

  // Front panel
  for (let y = 22; y < 30; y++) {
    for (let x = 4; x < 28; x++) {
      setPixel(ctx, x, y, y < 24 ? wood.mid : wood.dark);
    }
  }

  // Wood grain texture on front panel
  for (let y = 23; y < 30; y++) {
    if (y % 3 === 0) {
      for (let x = 5; x < 27; x++) {
        if (seededRandom(x, y, 11) > 0.7) setPixel(ctx, x, y, wood.darkest);
      }
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 30, 3, 29, 2);
}

// Market stall variant 2 - Cloth stall with green awning (32x32)
function drawMarketStall2(ctx) {
  const wood = PALETTE.wood;
  const green = PALETTE.jungle;
  const white = PALETTE.whitewash;
  const silk = PALETTE.clothSilk;
  const red = PALETTE.clothRed;

  // Awning (green/white stripes)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 32; x++) {
      const stripe = Math.floor(x / 4) % 2;
      const shade = y < 2 ? 'light' : y > 6 ? 'dark' : 'mid';
      setPixel(ctx, x, y, stripe ? green[shade] : white[shade]);
    }
  }
  // Scalloped bottom
  for (let x = 0; x < 32; x++) {
    const scallop = Math.sin(x * Math.PI / 4) > 0.3;
    if (scallop) {
      const stripe = Math.floor(x / 4) % 2;
      setPixel(ctx, x, 8, stripe ? green.darkest : white.midDark);
    }
  }

  // Support poles
  for (let y = 0; y < 32; y++) {
    setPixel(ctx, 2, y, wood.light);
    setPixel(ctx, 3, y, wood.dark);
    setPixel(ctx, 28, y, wood.mid);
    setPixel(ctx, 29, y, wood.darkest);
  }

  // Counter
  for (let y = 18; y < 22; y++) {
    for (let x = 4; x < 28; x++) {
      const shade = y === 18 ? wood.light : y === 21 ? wood.darkest : wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // Cloth bolts on counter
  // Silk bolt (purple roll)
  for (let y = 14; y < 18; y++) {
    for (let x = 6; x < 13; x++) {
      const rollShade = y === 14 ? silk.light : y === 17 ? silk.darkest : silk.mid;
      setPixel(ctx, x, y, rollShade);
    }
  }
  // End circles of roll
  setPixel(ctx, 6, 15, silk.bright);
  setPixel(ctx, 6, 16, silk.light);

  // Red cloth bolt
  for (let y = 14; y < 18; y++) {
    for (let x = 15; x < 22; x++) {
      const rollShade = y === 14 ? red.light : y === 17 ? red.darkest : red.mid;
      setPixel(ctx, x, y, rollShade);
    }
  }
  setPixel(ctx, 15, 15, red.bright);
  setPixel(ctx, 15, 16, red.light);

  // Draped fabric sample
  for (let y = 15; y < 18; y++) {
    for (let x = 23; x < 27; x++) {
      setPixel(ctx, x, y, silk.light);
    }
  }
  setPixel(ctx, 23, 18, silk.mid); // hanging edge

  // Front panel
  for (let y = 22; y < 30; y++) {
    for (let x = 4; x < 28; x++) {
      setPixel(ctx, x, y, y < 24 ? wood.mid : wood.dark);
    }
  }

  // Wood grain texture on front panel
  for (let y = 23; y < 30; y++) {
    if (y % 3 === 0) {
      for (let x = 5; x < 27; x++) {
        if (seededRandom(x, y, 12) > 0.7) setPixel(ctx, x, y, wood.darkest);
      }
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 30, 3, 29, 2);
}

// Tavern sign - hanging bracket with cup pictogram (16x16)
function drawTavernSign(ctx) {
  const metal = PALETTE.stone;
  const wood = PALETTE.wood;

  // Metal bracket (L-shape from wall)
  setPixel(ctx, 1, 0, metal.light);
  setPixel(ctx, 1, 1, metal.mid);
  setPixel(ctx, 2, 1, metal.mid);
  setPixel(ctx, 3, 1, metal.mid);
  setPixel(ctx, 4, 1, metal.dark);
  // Bracket curve down
  setPixel(ctx, 4, 2, metal.mid);
  setPixel(ctx, 4, 3, metal.dark);

  // Hanging chains (2 lines)
  setPixel(ctx, 4, 4, metal.mid);
  setPixel(ctx, 11, 2, metal.mid);
  setPixel(ctx, 11, 3, metal.mid);
  setPixel(ctx, 11, 4, metal.dark);

  // Wooden sign body
  for (let y = 5; y < 13; y++) {
    for (let x = 3; x < 13; x++) {
      let shade;
      if (y === 5) shade = wood.light;
      else if (x === 3) shade = wood.light;
      else if (y === 12) shade = wood.darkest;
      else if (x === 12) shade = wood.dark;
      else shade = wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // Cup pictogram (3x4px)
  setPixel(ctx, 7, 7, wood.lightest);  // cup top-left
  setPixel(ctx, 8, 7, wood.lightest);  // cup top-right
  setPixel(ctx, 7, 8, wood.lightest);  // cup left
  setPixel(ctx, 8, 8, wood.bright);    // cup right
  setPixel(ctx, 7, 9, wood.lightest);  // cup bottom-left
  setPixel(ctx, 8, 9, wood.bright);    // cup bottom-right
  setPixel(ctx, 7, 10, wood.bright);   // base left
  setPixel(ctx, 8, 10, wood.bright);   // base right
  setPixel(ctx, 9, 8, wood.bright);    // handle

  // Contact shadow
  for (let x = 4; x < 14; x++) {
    setPixel(ctx, x, 13, PALETTE.shadow.mid);
  }
}

// Awning - angled fabric with stripes (16x16)
function drawAwning(ctx) {
  const red = PALETTE.clothRed;
  const white = PALETTE.whitewash;

  // Angled awning (from top-left to bottom-right slant)
  for (let y = 0; y < 12; y++) {
    const startX = Math.floor(y * 0.3);
    for (let x = startX; x < 16; x++) {
      const stripe = Math.floor((x + y) / 3) % 2;
      let shade;
      if (y === 0) shade = 'light';
      else if (y < 3) shade = 'bright';
      else if (y > 9) shade = 'dark';
      else shade = 'mid';
      setPixel(ctx, x, y, stripe ? red[shade] : white[shade]);
    }
  }

  // Scalloped bottom edge
  for (let x = 0; x < 16; x++) {
    const scY = 12 + (Math.sin(x * Math.PI / 3) > 0 ? 0 : 1);
    const stripe = Math.floor((x + scY) / 3) % 2;
    setPixel(ctx, x, scY, stripe ? red.dark : white.midDark);
    if (scY === 12) {
      setPixel(ctx, x, 13, stripe ? red.darkest : white.dark);
    }
  }

  // Shadow beneath awning
  for (let x = 0; x < 16; x++) {
    setPixel(ctx, x, 14, PALETTE.shadow.mid);
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Hanging cloth - cloth draped between top corners (16x16)
function drawHangingCloth(ctx) {
  const silk = PALETTE.clothSilk;

  // Top rod/attachment points
  setPixel(ctx, 1, 0, PALETTE.stone.mid);
  setPixel(ctx, 14, 0, PALETTE.stone.mid);

  // Cloth with parabolic sag
  for (let x = 1; x < 15; x++) {
    // Catenary/parabolic curve: lowest at center
    const t = (x - 1) / 13; // 0 to 1
    const sag = Math.pow((t - 0.5) * 2, 2); // 1 at edges, 0 at center
    const topY = Math.floor(1 + (1 - sag) * 6); // hangs down up to 6 pixels from top
    const clothHeight = 4; // cloth thickness

    for (let y = topY; y < topY + clothHeight && y < 16; y++) {
      let shade;
      if (y === topY) shade = silk.light;
      else if (y === topY + clothHeight - 1) shade = silk.darkest;
      else if (x < 5) shade = silk.bright;
      else if (x > 11) shade = silk.dark;
      else shade = silk.mid;

      // Subtle diamond pattern
      if ((x + y) % 4 === 0) {
        shade = silk.midLight;
      }
      setPixel(ctx, x, y, shade);
    }
  }

  // Bottom fringe
  for (let x = 4; x < 12; x += 2) {
    setPixel(ctx, x, 11, silk.mid);
    setPixel(ctx, x, 12, silk.dark);
  }

  // Contact shadow
  for (let x = 3; x < 13; x++) {
    setPixel(ctx, x, 14, PALETTE.shadow.light);
  }
}

// Spice pile - conical pile of golden spice (16x16)
function drawSpicePile(ctx) {
  const spice = PALETTE.gold;

  // Conical pile (triangle silhouette)
  for (let y = 3; y < 14; y++) {
    const halfWidth = Math.floor((y - 3) * 0.7) + 1;
    const cx = 8;
    for (let x = cx - halfWidth; x <= cx + halfWidth; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x < cx - halfWidth + 1) shade = spice.light;
        else if (x > cx + halfWidth - 1) shade = spice.dark;
        else if (y < 6) shade = spice.bright;
        else if (y > 11) shade = spice.midDark;
        else shade = spice.mid;

        // Granular texture
        const grain = ((x * 7 + y * 13) % 5);
        if (grain === 0) shade = spice.light;
        else if (grain === 1) shade = spice.midDark;

        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Scattered granules at base
  setPixel(ctx, 3, 14, spice.mid);
  setPixel(ctx, 5, 13, spice.dark);
  setPixel(ctx, 11, 13, spice.mid);
  setPixel(ctx, 12, 14, spice.midDark);
  setPixel(ctx, 7, 14, spice.mid);

  // Contact shadow
  for (let x = 4; x < 13; x++) {
    setPixel(ctx, x, 15, PALETTE.shadow.mid);
  }
}

// Gravestone - rounded-top rectangle with cross (16x16)
function drawGravestone(ctx) {
  const stone = PALETTE.stone;
  const moss = PALETTE.jungle;

  // Rounded top arch
  for (let x = 5; x < 11; x++) {
    const dist = Math.abs(x - 8);
    const topY = dist <= 1 ? 1 : dist <= 2 ? 2 : 3;
    for (let y = topY; y < 13; y++) {
      let shade;
      if (x === 5) shade = stone.light;
      else if (x === 10) shade = stone.darkest;
      else if (y === topY) shade = stone.lightest;
      else if (y > 11) shade = stone.dark;
      else shade = stone.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // Cross motif
  setPixel(ctx, 7, 4, stone.bright);
  setPixel(ctx, 8, 4, stone.bright);
  setPixel(ctx, 7, 5, stone.bright);
  setPixel(ctx, 8, 5, stone.bright);
  setPixel(ctx, 6, 5, stone.bright); // horizontal
  setPixel(ctx, 9, 5, stone.bright); // horizontal
  setPixel(ctx, 7, 6, stone.bright);
  setPixel(ctx, 8, 6, stone.bright);
  setPixel(ctx, 7, 7, stone.bright);
  setPixel(ctx, 8, 7, stone.bright);

  // Weathering crack
  setPixel(ctx, 7, 9, stone.dark);
  setPixel(ctx, 8, 10, stone.darkest);

  // Moss at base
  setPixel(ctx, 5, 12, moss.midDark);
  setPixel(ctx, 6, 12, moss.mid);
  setPixel(ctx, 6, 11, moss.midDark);
  setPixel(ctx, 10, 12, moss.mid);
  setPixel(ctx, 9, 12, moss.midDark);

  // Ground level / base
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 13, stone.dark);
  }

  // Stone pitting (~5% density)
  for (let y = 1; y < 13; y++) {
    for (let x = 5; x < 11; x++) {
      if (seededRandom(x, y, 4) > 0.95) {
        setPixel(ctx, x, y, stone.dark);
      }
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 4, 12, 2);
}

// Altar - white stone block with gold trim and cross (16x16)
function drawAltar(ctx) {
  const white = PALETTE.whitewash;
  const gold = PALETTE.gold;
  const cloth = PALETTE.clothRed;

  // Main altar block
  for (let y = 3; y < 13; y++) {
    for (let x = 2; x < 14; x++) {
      let shade;
      if (y === 3) shade = white.lightest;
      else if (x === 2) shade = white.bright;
      else if (y === 12) shade = white.midDark;
      else if (x === 13) shade = white.mid;
      else shade = white.light;
      setPixel(ctx, x, y, shade);
    }
  }

  // Gold trim line
  for (let x = 2; x < 14; x++) {
    setPixel(ctx, x, 5, gold.light);
    setPixel(ctx, x, 6, gold.mid);
  }

  // Cloth drape on front (scalloped)
  for (let x = 3; x < 13; x++) {
    const scallop = Math.sin(x * Math.PI / 3);
    const drapY = 8 + (scallop > 0 ? 0 : 1);
    for (let y = 7; y <= drapY; y++) {
      setPixel(ctx, x, y, y === 7 ? cloth.light : cloth.mid);
    }
    // Scalloped edge
    setPixel(ctx, x, drapY + 1, cloth.dark);
  }

  // Tiny cross on top
  setPixel(ctx, 8, 1, gold.bright);
  setPixel(ctx, 7, 2, gold.mid);
  setPixel(ctx, 8, 2, gold.bright);
  setPixel(ctx, 9, 2, gold.mid);
  setPixel(ctx, 8, 3, gold.light);

  // Stone pitting (~5% density)
  for (let y = 3; y < 13; y++) {
    for (let x = 2; x < 14; x++) {
      if (seededRandom(x, y, 5) > 0.95) {
        setPixel(ctx, x, y, white.midDark);
      }
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 13, 2, 14, 2);
}

// Wooden pew - side-on profile (16x16)
function drawWoodenPew(ctx) {
  const wood = PALETTE.wood;

  // Back rest (vertical plank)
  for (let y = 2; y < 11; y++) {
    for (let x = 2; x < 5; x++) {
      let shade;
      if (x === 2) shade = wood.light;
      else if (x === 4) shade = wood.dark;
      else shade = wood.mid;
      if (y === 2) shade = wood.lightest;
      setPixel(ctx, x, y, shade);
    }
  }

  // Seat (horizontal plank)
  for (let x = 2; x < 14; x++) {
    setPixel(ctx, x, 8, wood.light);
    setPixel(ctx, x, 9, wood.mid);
    setPixel(ctx, x, 10, wood.dark);
  }

  // Front leg
  for (let y = 10; y < 14; y++) {
    setPixel(ctx, 12, y, wood.mid);
    setPixel(ctx, 13, y, wood.dark);
  }

  // Back leg
  for (let y = 10; y < 14; y++) {
    setPixel(ctx, 2, y, wood.light);
    setPixel(ctx, 3, y, wood.mid);
  }

  // Back rest top detail (rounded)
  setPixel(ctx, 3, 1, wood.bright);
  setPixel(ctx, 2, 2, wood.light);

  // Wood grain on seat and back rest
  setPixel(ctx, 6, 9, wood.dark);
  setPixel(ctx, 9, 9, wood.dark);
  for (let y = 3; y < 10; y++) {
    if (y % 3 === 0) {
      for (let x = 2; x < 5; x++) {
        if (seededRandom(x, y, 6) > 0.5) setPixel(ctx, x, y, wood.dark);
      }
    }
  }
  for (let x = 3; x < 13; x++) {
    if (seededRandom(x, 9, 7) > 0.6) setPixel(ctx, x, 9, wood.dark);
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 2, 14, 2);
}

// Dhow sail - triangular lateen sail (16x32)
function drawDhowSail(ctx) {
  const sail = PALETTE.whitewash;

  // Triangular lateen sail
  // Sail runs from top-center to bottom-left, with right edge being the mast line
  for (let y = 1; y < 28; y++) {
    // Width increases as we go down
    const maxWidth = Math.floor((y / 28) * 14);
    const windBillow = Math.sin(y * Math.PI / 28) * 2; // wind pushes middle out

    for (let x = 1; x < 1 + maxWidth; x++) {
      const billowX = x + Math.floor(windBillow * Math.sin((x / maxWidth) * Math.PI));
      if (billowX >= 0 && billowX < 16) {
        let shade;
        // Lighting from top-left
        if (x < 3) shade = sail.lightest;
        else if (y < 5) shade = sail.bright;
        else if (x > maxWidth - 2) shade = sail.midDark;
        else if (y > 22) shade = sail.mid;
        else shade = sail.light;

        // Wrinkle lines (horizontal creases)
        if (y % 6 === 0 && x > 1 && x < maxWidth - 1) {
          shade = sail.mid;
        }

        setPixel(ctx, billowX, y, shade);
      }
    }
  }

  // Yard arm (diagonal spar at top)
  for (let i = 0; i < 12; i++) {
    const sx = Math.floor(i * 1.2);
    const sy = Math.floor(i * 0.3);
    if (sx < 16 && sy < 32) {
      setPixel(ctx, sx, sy, PALETTE.wood.mid);
    }
  }

  // Sheet line (rope at bottom)
  for (let i = 0; i < 8; i++) {
    setPixel(ctx, i, 28 + Math.floor(i * 0.3), PALETTE.thatch.mid);
  }

  // Contact shadow
  for (let x = 0; x < 14; x++) {
    setPixel(ctx, x, 30, PALETTE.shadow.mid);
    setPixel(ctx, x, 31, PALETTE.shadow.light);
  }
}

// Ship mast - tapered pole with crow's nest and rigging (16x32)
function drawShipMast(ctx) {
  const wood = PALETTE.wood;
  const rope = PALETTE.thatch;

  // Main mast pole (tapered: 3px at bottom, 2px middle, 1px at top)
  for (let y = 0; y < 32; y++) {
    const cx = 8;
    let halfW;
    if (y < 4) halfW = 0;       // 1px wide at very top
    else if (y < 16) halfW = 1; // 2px wide
    else halfW = 1;             // 3px wide at bottom, but offset

    for (let x = cx - halfW; x <= cx + halfW; x++) {
      let shade;
      if (x < cx) shade = wood.light;
      else if (x > cx) shade = wood.dark;
      else shade = wood.mid;
      setPixel(ctx, x, y, shade);
    }
    // Extra width at base
    if (y > 24) {
      setPixel(ctx, cx - 2, y, wood.light);
      setPixel(ctx, cx + 2, y, wood.darkest);
    }
  }

  // Crow's nest platform near top (y 5-7)
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 5, wood.light);
    setPixel(ctx, x, 6, wood.mid);
    setPixel(ctx, x, 7, wood.dark);
  }
  // Nest railing
  setPixel(ctx, 4, 3, wood.mid);
  setPixel(ctx, 4, 4, wood.mid);
  setPixel(ctx, 11, 3, wood.dark);
  setPixel(ctx, 11, 4, wood.dark);

  // Rope rigging (diagonals)
  // Left rigging
  for (let i = 0; i < 10; i++) {
    const rx = 4 - Math.floor(i * 0.4);
    const ry = 7 + i * 2;
    if (rx >= 0 && ry < 32) {
      setPixel(ctx, rx, ry, rope.mid);
    }
  }
  // Right rigging
  for (let i = 0; i < 10; i++) {
    const rx = 11 + Math.floor(i * 0.4);
    const ry = 7 + i * 2;
    if (rx < 16 && ry < 32) {
      setPixel(ctx, rx, ry, rope.dark);
    }
  }

  // Contact shadow
  for (let x = 5; x < 12; x++) {
    setPixel(ctx, x, 31, PALETTE.shadow.mid);
  }
}

// Bamboo fence - vertical poles with horizontal ties (16x16)
function drawBambooFence(ctx) {
  const bamboo = PALETTE.lightWood;

  // Vertical bamboo poles (2px wide, spaced 4px apart)
  const poleXs = [1, 5, 9, 13];
  for (const px of poleXs) {
    for (let y = 0; y < 14; y++) {
      setPixel(ctx, px, y, bamboo.light);
      if (px + 1 < 16) setPixel(ctx, px + 1, y, bamboo.dark);

      // Node rings every 6 rows
      if (y % 6 === 0) {
        setPixel(ctx, px, y, bamboo.midDark);
        if (px + 1 < 16) setPixel(ctx, px + 1, y, bamboo.darkest);
      }
    }
  }

  // Horizontal tie bars
  for (let x = 0; x < 16; x++) {
    setPixel(ctx, x, 4, bamboo.mid);
    setPixel(ctx, x, 10, bamboo.mid);
  }

  // Rope ties at intersections
  for (const px of poleXs) {
    setPixel(ctx, px, 4, PALETTE.thatch.mid);
    setPixel(ctx, px, 10, PALETTE.thatch.mid);
  }

  // Contact shadow
  for (let x = 0; x < 16; x++) {
    setPixel(ctx, x, 14, PALETTE.shadow.mid);
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Bell - church bell shape (16x16)
function drawBell(ctx) {
  const metal = PALETTE.gold;

  // Bell top mount
  setPixel(ctx, 7, 0, PALETTE.stone.mid);
  setPixel(ctx, 8, 0, PALETTE.stone.mid);
  setPixel(ctx, 7, 1, PALETTE.stone.dark);
  setPixel(ctx, 8, 1, PALETTE.stone.dark);

  // Bell crown (narrow top)
  for (let x = 6; x < 10; x++) {
    setPixel(ctx, x, 2, metal.lightest);
    setPixel(ctx, x, 3, metal.bright);
  }

  // Bell body (widening)
  for (let y = 4; y < 12; y++) {
    const t = (y - 4) / 8;
    const halfW = Math.floor(2 + t * 4);
    for (let x = 8 - halfW; x <= 7 + halfW; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x <= 8 - halfW + 1) shade = metal.light;
        else if (x >= 7 + halfW - 1) shade = metal.midDark;
        else if (y < 6) shade = metal.bright;
        else shade = metal.mid;
        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Bell lip (widest part, flared)
  for (let x = 3; x < 13; x++) {
    setPixel(ctx, x, 12, x < 6 ? metal.light : x > 10 ? metal.dark : metal.mid);
    setPixel(ctx, x, 13, x < 6 ? metal.mid : x > 10 ? metal.darkest : metal.midDark);
  }

  // Clapper inside
  setPixel(ctx, 8, 9, metal.darkest);
  setPixel(ctx, 8, 10, metal.dark);
  setPixel(ctx, 7, 11, metal.darkest);
  setPixel(ctx, 8, 11, metal.darkest);

  // Contact shadow
  for (let x = 3; x < 13; x++) {
    setPixel(ctx, x, 14, PALETTE.shadow.mid);
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Sack - rounded lumpy bag (16x16)
function drawSack(ctx) {
  const cloth = PALETTE.thatch;
  const rope = PALETTE.wood;

  // Bag body (rounded shape)
  for (let y = 4; y < 14; y++) {
    const t = (y - 4) / 10;
    const halfW = Math.floor(Math.sin(t * Math.PI) * 6) + 1;
    for (let x = 8 - halfW; x <= 7 + halfW; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x <= 8 - halfW + 1) shade = cloth.light;
        else if (x >= 7 + halfW - 1) shade = cloth.dark;
        else if (y < 6) shade = cloth.bright;
        else if (y > 12) shade = cloth.midDark;
        else shade = cloth.mid;

        // Lumpy texture
        const lump = ((x * 3 + y * 7) % 5);
        if (lump === 0) shade = cloth.midLight;
        if (lump === 3) shade = cloth.midDark;

        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Tied top (gathered)
  for (let x = 6; x < 10; x++) {
    setPixel(ctx, x, 3, cloth.mid);
    setPixel(ctx, x, 4, cloth.mid);
  }
  setPixel(ctx, 7, 2, cloth.light);
  setPixel(ctx, 8, 2, cloth.mid);

  // Rope tie
  setPixel(ctx, 6, 4, rope.mid);
  setPixel(ctx, 7, 3, rope.mid);
  setPixel(ctx, 8, 3, rope.dark);
  setPixel(ctx, 9, 4, rope.dark);

  // Contact shadow
  for (let x = 3; x < 13; x++) {
    setPixel(ctx, x, 14, PALETTE.shadow.mid);
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Amphora - taller/narrower pottery variant (16x24)
function drawAmphora(ctx) {
  const clay = PALETTE.terracotta;

  // Narrow neck
  for (let y = 0; y < 6; y++) {
    for (let x = 6; x < 10; x++) {
      setPixel(ctx, x, y, x === 6 ? clay.light : x === 9 ? clay.dark : clay.mid);
    }
  }

  // Flared lip/rim
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 0, clay.lightest);
    setPixel(ctx, x, 1, clay.bright);
  }

  // Handles (taller than base pottery)
  for (let y = 4; y < 10; y++) {
    setPixel(ctx, 4, y, clay.light);
    setPixel(ctx, 3, y, clay.bright);
    setPixel(ctx, 11, y, clay.dark);
    setPixel(ctx, 12, y, clay.darkest);
  }

  // Body (narrower, more elongated curve)
  for (let y = 6; y < 20; y++) {
    const t = (y - 6) / 14;
    const bulge = Math.sin(t * Math.PI) * 3.5;
    const left = Math.floor(7 - bulge);
    const right = Math.floor(8 + bulge);

    for (let x = left; x <= right; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x === left) shade = clay.lightest;
        else if (x === left + 1) shade = clay.light;
        else if (x === right) shade = clay.darkest;
        else if (x === right - 1) shade = clay.dark;
        else shade = clay.mid;
        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Decorative band
  const bandY = 12;
  const bulge = Math.sin((bandY - 6) / 14 * Math.PI) * 3.5;
  for (let x = Math.floor(7 - bulge); x <= Math.floor(8 + bulge); x++) {
    setPixel(ctx, x, bandY, PALETTE.gold.mid);
    setPixel(ctx, x, bandY + 1, PALETTE.gold.dark);
  }

  // Pointed base
  for (let x = 6; x < 10; x++) {
    setPixel(ctx, x, 20, clay.dark);
  }
  setPixel(ctx, 7, 21, clay.darkest);
  setPixel(ctx, 8, 21, clay.darkest);

  // Contact shadow
  for (let x = 5; x < 12; x++) {
    setPixel(ctx, x, 22, PALETTE.shadow.mid);
    setPixel(ctx, x, 23, PALETTE.shadow.light);
  }
}

// Rope coil - coiled rope viewed from above (16x16)
function drawRopeCoil(ctx) {
  const rope = PALETTE.thatch;

  // Spiral coil from above
  for (let y = 2; y < 14; y++) {
    for (let x = 2; x < 14; x++) {
      const dx = x - 8;
      const dy = y - 8;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Concentric rings with spiral break
      const ring = dist + angle / (2 * Math.PI) * 1.5;
      if (dist < 6 && dist > 1) {
        if (Math.floor(ring * 2) % 2 === 0) {
          let shade;
          if (dx < -2) shade = rope.light;
          else if (dx > 2) shade = rope.dark;
          else if (dy < -2) shade = rope.bright;
          else shade = rope.mid;
          setPixel(ctx, x, y, shade);
        }
      }
    }
  }

  // Center hole (dark)
  setPixel(ctx, 7, 7, rope.darkest);
  setPixel(ctx, 8, 7, rope.darkest);
  setPixel(ctx, 7, 8, rope.darkest);
  setPixel(ctx, 8, 8, rope.dark);

  // Rope end trailing off
  setPixel(ctx, 12, 9, rope.mid);
  setPixel(ctx, 13, 10, rope.mid);
  setPixel(ctx, 13, 11, rope.dark);

  // Contact shadow
  for (let x = 2; x < 14; x++) {
    setPixel(ctx, x, 14, PALETTE.shadow.mid);
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Cargo crate - crate with shipping marks (16x16)
function drawCargoCrate(ctx) {
  const wood = PALETTE.wood;

  // Main body
  for (let y = 2; y < 14; y++) {
    for (let x = 1; x < 15; x++) {
      let shade;
      if (y === 2) shade = wood.light;
      else if (x === 1) shade = wood.light;
      else if (y === 13) shade = wood.darkest;
      else if (x === 14) shade = wood.dark;
      else shade = wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // Horizontal planks
  for (let x = 1; x < 15; x++) {
    setPixel(ctx, x, 5, wood.dark);
    setPixel(ctx, x, 10, wood.dark);
  }

  // Vertical supports
  for (let y = 2; y < 14; y++) {
    setPixel(ctx, 4, y, wood.dark);
    setPixel(ctx, 11, y, wood.dark);
  }

  // Metal corner brackets
  setPixel(ctx, 2, 3, PALETTE.stone.mid);
  setPixel(ctx, 3, 3, PALETTE.stone.mid);
  setPixel(ctx, 2, 4, PALETTE.stone.mid);
  setPixel(ctx, 13, 3, PALETTE.stone.dark);
  setPixel(ctx, 12, 3, PALETTE.stone.dark);
  setPixel(ctx, 13, 4, PALETTE.stone.dark);
  setPixel(ctx, 2, 12, PALETTE.stone.mid);
  setPixel(ctx, 3, 12, PALETTE.stone.mid);
  setPixel(ctx, 13, 12, PALETTE.stone.dark);
  setPixel(ctx, 12, 12, PALETTE.stone.dark);

  // Shipping mark (X mark)
  setPixel(ctx, 6, 6, PALETTE.clothRed.mid);
  setPixel(ctx, 7, 7, PALETTE.clothRed.mid);
  setPixel(ctx, 8, 8, PALETTE.clothRed.mid);
  setPixel(ctx, 9, 9, PALETTE.clothRed.mid);
  setPixel(ctx, 9, 6, PALETTE.clothRed.mid);
  setPixel(ctx, 8, 7, PALETTE.clothRed.mid);
  setPixel(ctx, 7, 8, PALETTE.clothRed.mid);
  setPixel(ctx, 6, 9, PALETTE.clothRed.mid);

  // Contact shadow
  for (let x = 2; x < 16; x++) {
    setPixel(ctx, x, 14, PALETTE.shadow.mid);
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Arched window - stone frame with dark interior (16x16)
function drawArchedWindow(ctx) {
  const stone = PALETTE.stone;
  const dark = PALETTE.shadow;

  // Stone frame (outer)
  for (let y = 0; y < 14; y++) {
    for (let x = 2; x < 14; x++) {
      // Arched top
      if (y < 4) {
        const dist = Math.sqrt(Math.pow(x - 8, 2) + Math.pow(y - 4, 2));
        if (dist <= 6 && dist > 4) {
          setPixel(ctx, x, y, x < 8 ? stone.light : stone.dark);
        } else if (dist <= 4) {
          setPixel(ctx, x, y, dark.mid); // dark interior
        }
      } else {
        // Rectangular part
        if (x <= 3 || x >= 12) {
          // Stone frame sides
          setPixel(ctx, x, y, x <= 3 ? stone.light : stone.dark);
        } else {
          // Dark interior
          setPixel(ctx, x, y, dark.mid);
        }
      }
    }
  }

  // Arch keystone
  setPixel(ctx, 7, 0, stone.bright);
  setPixel(ctx, 8, 0, stone.bright);

  // Window sill
  for (let x = 2; x < 14; x++) {
    setPixel(ctx, x, 13, stone.light);
    setPixel(ctx, x, 14, stone.mid);
  }

  // Interior cross bar (simple window divider)
  for (let y = 4; y < 13; y++) {
    setPixel(ctx, 8, y, stone.midDark);
  }
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 8, stone.midDark);
  }

  // Contact shadow under sill
  for (let x = 2; x < 14; x++) {
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Water well - circular stone well with crossbeam and rope (16x32)
function drawWaterWell(ctx) {
  const stone = PALETTE.stone;
  const wood = PALETTE.wood;
  const rope = PALETTE.thatch;

  // Wooden posts (two vertical supports)
  for (let y = 2; y < 20; y++) {
    setPixel(ctx, 3, y, wood.light);
    setPixel(ctx, 4, y, wood.dark);
    setPixel(ctx, 11, y, wood.mid);
    setPixel(ctx, 12, y, wood.darkest);
  }

  // Cross-beam at top
  for (let x = 3; x < 13; x++) {
    setPixel(ctx, x, 2, wood.light);
    setPixel(ctx, x, 3, wood.mid);
    setPixel(ctx, x, 4, wood.dark);
  }

  // Roof peak (small A-frame)
  setPixel(ctx, 7, 0, wood.light);
  setPixel(ctx, 8, 0, wood.mid);
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 1, wood.mid);
  }

  // Rope hanging from beam
  for (let y = 5; y < 18; y++) {
    setPixel(ctx, 8, y, rope.mid);
  }
  // Rope knot / bucket
  setPixel(ctx, 7, 17, rope.dark);
  setPixel(ctx, 8, 17, rope.mid);
  setPixel(ctx, 9, 17, rope.dark);
  setPixel(ctx, 7, 18, wood.mid); // bucket
  setPixel(ctx, 8, 18, wood.dark);
  setPixel(ctx, 9, 18, wood.darkest);

  // Winch/handle
  setPixel(ctx, 13, 3, wood.mid);
  setPixel(ctx, 14, 2, wood.mid);
  setPixel(ctx, 14, 3, wood.dark);

  // Circular stone well wall
  for (let y = 20; y < 28; y++) {
    const t = (y - 20) / 8;
    const halfW = Math.floor(5 + Math.sin(t * Math.PI) * 2);
    for (let x = 8 - halfW; x <= 7 + halfW; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x <= 8 - halfW + 1) shade = stone.light;
        else if (x >= 7 + halfW - 1) shade = stone.darkest;
        else if (y === 20) shade = stone.bright;
        else shade = stone.mid;
        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Dark well interior (top of wall)
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 20, PALETTE.shadow.darkest);
    setPixel(ctx, x, 21, PALETTE.shadow.dark);
  }

  // Contact shadow
  for (let x = 2; x < 14; x++) {
    setPixel(ctx, x, 28, PALETTE.shadow.mid);
    setPixel(ctx, x, 29, PALETTE.shadow.mid);
    setPixel(ctx, x, 30, PALETTE.shadow.light);
    setPixel(ctx, x, 31, PALETTE.shadow.light);
  }
}

// Banana tree - curved trunk with large leaf fans and banana bunch (16x48)
function drawBananaTree(ctx) {
  const trunk = PALETTE.jungle;
  const leaf = PALETTE.jungle;
  const fruit = PALETTE.gold;

  // Trunk (slightly curved, thicker than palm)
  for (let y = 18; y < 46; y++) {
    const wobble = Math.sin(y * 0.15) * 1.5;
    const cx = 8 + Math.floor(wobble);
    for (let x = cx - 2; x <= cx + 2; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x <= cx - 2) shade = trunk.light;
        else if (x >= cx + 2) shade = trunk.darkest;
        else if (x < cx) shade = trunk.midLight;
        else shade = trunk.mid;
        setPixel(ctx, x, y, shade);
      }
    }
    // Trunk texture (horizontal fibrous lines)
    if (y % 3 === 0) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        if (x >= 0 && x < 16) setPixel(ctx, x, y, trunk.midDark);
      }
    }
  }

  // Large drooping leaf fans (4-5 leaves radiating from top)
  const leaves = [
    { dx: -8, dy: 6, len: 14 },   // left drooping
    { dx: -6, dy: -3, len: 12 },  // upper left
    { dx: -2, dy: -8, len: 10 },  // top
    { dx: 3, dy: -7, len: 10 },   // upper right
    { dx: 7, dy: 5, len: 14 },    // right drooping
    { dx: 5, dy: -1, len: 11 },   // right mid
  ];

  const topX = 8;
  const topY = 16;

  for (const lf of leaves) {
    for (let i = 0; i < lf.len; i++) {
      const t = i / lf.len;
      const droop = t * t * 3; // leaves droop at ends
      const lx = Math.round(topX + lf.dx * t);
      const ly = Math.round(topY + lf.dy * t + droop);
      if (lx >= 0 && lx < 16 && ly >= 0 && ly < 48) {
        // Wide leaves (3px wide)
        setPixel(ctx, lx, ly, i < 3 ? leaf.bright : leaf.mid);
        if (lx > 0) setPixel(ctx, lx - 1, ly, leaf.midLight);
        if (lx < 15) setPixel(ctx, lx + 1, ly, leaf.dark);
        // Mid-rib line
        setPixel(ctx, lx, ly, leaf.midDark);
      }
    }
  }

  // Banana bunch (hanging below leaf crown)
  for (let y = 18; y < 23; y++) {
    for (let x = 4; x < 7; x++) {
      setPixel(ctx, x, y, fruit.mid);
    }
  }
  // Individual banana details
  setPixel(ctx, 4, 18, fruit.light);
  setPixel(ctx, 5, 18, fruit.bright);
  setPixel(ctx, 6, 19, fruit.dark);
  setPixel(ctx, 3, 20, fruit.mid); // hanging banana
  setPixel(ctx, 3, 21, fruit.midDark);
  // Stem
  setPixel(ctx, 5, 17, trunk.dark);

  // Contact shadow at base
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 46, PALETTE.shadow.mid);
    setPixel(ctx, x, 47, PALETTE.shadow.light);
  }
}

// Coconut - round brown coconut with husk texture and three dots (16x16)
function drawCoconut(ctx) {
  const husk = PALETTE.wood;

  // Round coconut body
  for (let y = 3; y < 13; y++) {
    const t = (y - 3) / 10;
    const halfW = Math.floor(Math.sin(t * Math.PI) * 5) + 1;
    for (let x = 8 - halfW; x <= 7 + halfW; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x <= 8 - halfW + 1) shade = husk.light;
        else if (x >= 7 + halfW - 1) shade = husk.darkest;
        else if (y < 5) shade = husk.bright;
        else if (y > 11) shade = husk.dark;
        else shade = husk.mid;

        // Fibrous husk texture
        const fiber = ((x * 5 + y * 11) % 7);
        if (fiber === 0) shade = husk.midLight;
        if (fiber === 3) shade = husk.midDark;

        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Three dots (eyes of the coconut)
  setPixel(ctx, 7, 5, husk.darkest);
  setPixel(ctx, 9, 5, husk.darkest);
  setPixel(ctx, 8, 7, husk.darkest);

  // Contact shadow
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 13, PALETTE.shadow.mid);
    setPixel(ctx, x, 14, PALETTE.shadow.mid);
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Hanging oil lantern - lantern on chain bracket (16x16)
function drawHangingOilLantern(ctx) {
  const metal = PALETTE.stone;
  const glow = PALETTE.gold;

  // Wall bracket
  setPixel(ctx, 1, 0, metal.mid);
  setPixel(ctx, 2, 0, metal.mid);
  setPixel(ctx, 3, 0, metal.mid);
  setPixel(ctx, 3, 1, metal.dark);

  // Chain
  setPixel(ctx, 4, 1, metal.mid);
  setPixel(ctx, 5, 2, metal.dark);
  setPixel(ctx, 6, 2, metal.mid);
  setPixel(ctx, 7, 3, metal.dark);

  // Lantern top cap
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 4, metal.light);
    setPixel(ctx, x, 5, metal.mid);
  }

  // Glass panels (glowing)
  for (let y = 6; y < 12; y++) {
    for (let x = 5; x < 11; x++) {
      let shade;
      if (x === 5) shade = glow.bright;
      else if (x === 10) shade = glow.mid;
      else if (y < 8) shade = glow.lightest;
      else shade = glow.light;
      setPixel(ctx, x, y, shade);
    }
  }

  // Flame highlight
  setPixel(ctx, 7, 8, '#FFFFFF');
  setPixel(ctx, 8, 7, '#FFFFEE');

  // Metal frame bars
  setPixel(ctx, 4, 6, metal.mid);
  setPixel(ctx, 4, 11, metal.mid);
  setPixel(ctx, 11, 6, metal.dark);
  setPixel(ctx, 11, 11, metal.dark);

  // Bottom cap
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 12, metal.mid);
    setPixel(ctx, x, 13, metal.dark);
  }

  // Glow aura beneath
  setPixel(ctx, 6, 14, glow.darkest);
  setPixel(ctx, 7, 14, glow.dark);
  setPixel(ctx, 8, 14, glow.dark);
  setPixel(ctx, 9, 14, glow.darkest);
}

// Drying fish rack - wooden A-frame with hanging fish (16x16)
function drawDryingFishRack(ctx) {
  const wood = PALETTE.wood;
  const fish = PALETTE.water;

  // A-frame legs
  for (let y = 0; y < 14; y++) {
    // Left leg (angled inward)
    const lx = Math.floor(1 + y * 0.3);
    setPixel(ctx, lx, y, wood.light);
    setPixel(ctx, lx + 1, y, wood.dark);

    // Right leg (angled inward)
    const rx = Math.floor(14 - y * 0.3);
    setPixel(ctx, rx, y, wood.mid);
    setPixel(ctx, rx - 1, y, wood.dark);
  }

  // Horizontal crossbar
  for (let x = 3; x < 13; x++) {
    setPixel(ctx, x, 3, wood.light);
    setPixel(ctx, x, 4, wood.dark);
  }

  // Hanging fish (3 fish dangling)
  // Fish 1
  for (let y = 5; y < 10; y++) {
    setPixel(ctx, 5, y, fish.mid);
    setPixel(ctx, 6, y, fish.dark);
  }
  setPixel(ctx, 5, 10, fish.midDark); // tail
  setPixel(ctx, 4, 10, fish.dark);

  // Fish 2
  for (let y = 5; y < 9; y++) {
    setPixel(ctx, 8, y, fish.light);
    setPixel(ctx, 9, y, fish.mid);
  }
  setPixel(ctx, 8, 9, fish.midDark);
  setPixel(ctx, 7, 9, fish.dark);

  // Fish 3
  for (let y = 5; y < 10; y++) {
    setPixel(ctx, 11, y, fish.mid);
    setPixel(ctx, 12, y, fish.dark);
  }
  setPixel(ctx, 11, 10, fish.midDark);
  setPixel(ctx, 13, 10, fish.dark);

  // Contact shadow
  for (let x = 3; x < 13; x++) {
    setPixel(ctx, x, 14, PALETTE.shadow.mid);
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Laundry line - cloth between two poles with gentle sway (16x16)
function drawLaundryLine(ctx) {
  const wood = PALETTE.wood;
  const silk = PALETTE.clothSilk;
  const white = PALETTE.whitewash;

  // Left pole
  for (let y = 0; y < 14; y++) {
    setPixel(ctx, 1, y, wood.light);
    setPixel(ctx, 2, y, wood.dark);
  }

  // Right pole
  for (let y = 0; y < 14; y++) {
    setPixel(ctx, 13, y, wood.mid);
    setPixel(ctx, 14, y, wood.darkest);
  }

  // Clothesline rope (slight sag)
  for (let x = 2; x < 14; x++) {
    const sag = Math.floor(Math.pow((x - 8) / 6, 2) * -1 + 2);
    setPixel(ctx, x, sag, PALETTE.thatch.mid);
  }

  // Hanging cloth 1 (white garment)
  for (let y = 3; y < 9; y++) {
    for (let x = 4; x < 7; x++) {
      const sway = y > 6 ? 1 : 0; // slight sway at bottom
      setPixel(ctx, x + sway, y, y < 5 ? white.light : white.mid);
    }
  }
  setPixel(ctx, 5, 9, white.midDark); // drip edge

  // Hanging cloth 2 (colored garment)
  for (let y = 3; y < 10; y++) {
    for (let x = 9; x < 12; x++) {
      setPixel(ctx, x, y, y < 5 ? silk.light : y > 8 ? silk.dark : silk.mid);
    }
  }

  // Contact shadow
  for (let x = 1; x < 15; x++) {
    setPixel(ctx, x, 14, PALETTE.shadow.mid);
    setPixel(ctx, x, 15, PALETTE.shadow.light);
  }
}

// Moored sampan - small boat at dock (16x16)
function drawMooredSampan(ctx) {
  const wood = PALETTE.wood;
  const water = PALETTE.water;

  // Water underneath
  for (let y = 10; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      setPixel(ctx, x, y, y < 12 ? water.midDark : water.dark);
    }
  }

  // Boat hull (curved, viewed from above/side)
  for (let y = 4; y < 12; y++) {
    const t = (y - 4) / 8;
    const halfW = Math.floor(Math.sin(t * Math.PI) * 7);
    for (let x = 8 - halfW; x <= 7 + halfW; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x <= 8 - halfW + 1) shade = wood.light;
        else if (x >= 7 + halfW - 1) shade = wood.darkest;
        else if (y < 6) shade = wood.bright;
        else if (y > 10) shade = wood.dark;
        else shade = wood.mid;
        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Bow (pointed front)
  setPixel(ctx, 8, 3, wood.light);
  setPixel(ctx, 7, 3, wood.mid);

  // Interior (darker)
  for (let y = 6; y < 10; y++) {
    for (let x = 5; x < 11; x++) {
      setPixel(ctx, x, y, wood.dark);
    }
  }

  // Seat plank
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 8, wood.mid);
  }

  // Mooring rope
  setPixel(ctx, 2, 5, PALETTE.thatch.mid);
  setPixel(ctx, 1, 4, PALETTE.thatch.mid);
  setPixel(ctx, 0, 3, PALETTE.thatch.dark);

  // Water ripples around boat
  setPixel(ctx, 2, 11, water.midLight);
  setPixel(ctx, 13, 11, water.midLight);
  setPixel(ctx, 5, 12, water.mid);
  setPixel(ctx, 10, 13, water.mid);
}

// Fruit basket - woven basket with tropical fruits (16x16)
function drawFruitBasket(ctx) {
  const thatch = PALETTE.thatch;
  const gold = PALETTE.gold;
  const red = PALETTE.clothRed;
  const green = PALETTE.jungle;

  // Basket body (woven pattern)
  for (let y = 6; y < 14; y++) {
    const t = (y - 6) / 8;
    const halfW = Math.floor(3 + t * 3);
    for (let x = 8 - halfW; x <= 7 + halfW; x++) {
      if (x >= 0 && x < 16) {
        const weave = (Math.floor(x / 2) + Math.floor(y / 2)) % 2;
        let shade;
        if (x <= 8 - halfW + 1) shade = thatch.light;
        else if (x >= 7 + halfW - 1) shade = thatch.dark;
        else shade = weave ? thatch.mid : thatch.midDark;
        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Basket rim
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 6, thatch.bright);
    setPixel(ctx, x, 7, thatch.light);
  }

  // Fruits piled at top
  // Gold/mango
  setPixel(ctx, 6, 4, gold.bright);
  setPixel(ctx, 7, 4, gold.light);
  setPixel(ctx, 6, 5, gold.mid);
  setPixel(ctx, 7, 5, gold.midDark);
  // Red fruit
  setPixel(ctx, 8, 3, red.bright);
  setPixel(ctx, 9, 3, red.light);
  setPixel(ctx, 8, 4, red.mid);
  setPixel(ctx, 9, 4, red.dark);
  // Green fruit
  setPixel(ctx, 10, 4, green.bright);
  setPixel(ctx, 10, 5, green.mid);
  setPixel(ctx, 5, 5, green.light);
  setPixel(ctx, 5, 4, green.bright);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 4, 12, 2);
}

// Coconut water stand - wooden stand with split coconuts (16x24)
function drawCoconutWaterStand(ctx) {
  const wood = PALETTE.wood;
  const lightW = PALETTE.lightWood;
  const water = PALETTE.water;

  // Stand legs (4 legs)
  for (let y = 12; y < 22; y++) {
    setPixel(ctx, 2, y, wood.light);
    setPixel(ctx, 3, y, wood.dark);
    setPixel(ctx, 12, y, wood.mid);
    setPixel(ctx, 13, y, wood.darkest);
  }

  // Stand top platform
  for (let y = 10; y < 13; y++) {
    for (let x = 1; x < 15; x++) {
      const shade = y === 10 ? wood.light : y === 12 ? wood.darkest : wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // Wood grain on stand
  for (let x = 2; x < 14; x++) {
    if (seededRandom(x, 11, 20) > 0.6) setPixel(ctx, x, 11, wood.dark);
  }

  // Split coconut 1 (left)
  for (let y = 6; y < 10; y++) {
    for (let x = 2; x < 7; x++) {
      const shade = x < 4 ? lightW.light : x > 5 ? lightW.dark : lightW.mid;
      setPixel(ctx, x, y, shade);
    }
  }
  // White flesh inside
  setPixel(ctx, 3, 7, PALETTE.whitewash.light);
  setPixel(ctx, 4, 7, PALETTE.whitewash.mid);
  setPixel(ctx, 5, 7, PALETTE.whitewash.midDark);
  // Water inside
  setPixel(ctx, 4, 8, water.light);

  // Split coconut 2 (right)
  for (let y = 6; y < 10; y++) {
    for (let x = 9; x < 14; x++) {
      const shade = x < 11 ? lightW.light : x > 12 ? lightW.dark : lightW.mid;
      setPixel(ctx, x, y, shade);
    }
  }
  setPixel(ctx, 10, 7, PALETTE.whitewash.light);
  setPixel(ctx, 11, 7, PALETTE.whitewash.mid);
  setPixel(ctx, 12, 7, PALETTE.whitewash.midDark);
  setPixel(ctx, 11, 8, water.light);

  // Water drips below stand
  setPixel(ctx, 5, 13, water.mid);
  setPixel(ctx, 5, 14, water.light);
  setPixel(ctx, 11, 14, water.mid);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 22, 1, 14, 2);
}

// Bench - simple wooden bench (32x16)
function drawBench(ctx) {
  const wood = PALETTE.wood;

  // Back rest
  for (let y = 1; y < 6; y++) {
    for (let x = 2; x < 30; x++) {
      let shade;
      if (y === 1) shade = wood.bright;
      else if (x === 2) shade = wood.light;
      else if (x === 29) shade = wood.darkest;
      else if (y === 5) shade = wood.dark;
      else shade = wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // Seat plank
  for (let y = 6; y < 9; y++) {
    for (let x = 1; x < 31; x++) {
      let shade;
      if (y === 6) shade = wood.light;
      else if (y === 8) shade = wood.darkest;
      else shade = wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // 4 legs
  const legXs = [3, 4, 27, 28];
  for (let i = 0; i < legXs.length; i++) {
    const lx = legXs[i];
    const isLeft = i % 2 === 0;
    for (let y = 9; y < 14; y++) {
      setPixel(ctx, lx, y, isLeft ? wood.light : wood.dark);
    }
  }

  // Wood grain on seat
  for (let x = 2; x < 30; x++) {
    if (seededRandom(x, 7, 21) > 0.6) setPixel(ctx, x, 7, wood.dark);
  }

  // Wood grain on back rest
  for (let y = 2; y < 5; y++) {
    if (y % 3 === 0) {
      for (let x = 3; x < 29; x++) {
        if (seededRandom(x, y, 22) > 0.7) setPixel(ctx, x, y, wood.dark);
      }
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 2, 30, 2);
}

// Wine jug - Portuguese wine jug (8x16)
function drawWineJug(ctx) {
  const clay = PALETTE.terracotta;

  // Narrow neck
  for (let y = 1; y < 5; y++) {
    setPixel(ctx, 3, y, clay.light);
    setPixel(ctx, 4, y, clay.mid);
  }

  // Lip/rim
  setPixel(ctx, 2, 0, clay.bright);
  setPixel(ctx, 3, 0, clay.lightest);
  setPixel(ctx, 4, 0, clay.bright);
  setPixel(ctx, 5, 0, clay.light);

  // Handle (right side)
  for (let y = 3; y < 8; y++) {
    setPixel(ctx, 6, y, clay.dark);
  }
  setPixel(ctx, 5, 3, clay.mid);
  setPixel(ctx, 5, 8, clay.mid);

  // Body (curved)
  for (let y = 5; y < 13; y++) {
    const t = (y - 5) / 8;
    const bulge = Math.sin(t * Math.PI) * 2;
    const left = Math.floor(3 - bulge);
    const right = Math.floor(4 + bulge);
    for (let x = left; x <= right; x++) {
      if (x >= 0 && x < 8) {
        let shade;
        if (x === left) shade = clay.light;
        else if (x === right) shade = clay.darkest;
        else if (x < 3) shade = clay.bright;
        else shade = clay.mid;
        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Base
  setPixel(ctx, 2, 13, clay.dark);
  setPixel(ctx, 3, 13, clay.midDark);
  setPixel(ctx, 4, 13, clay.dark);
  setPixel(ctx, 5, 13, clay.darkest);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 1, 6, 2);
}

// Sugar cone - conical sugar loaf on paper (16x16)
function drawSugarCone(ctx) {
  const white = PALETTE.whitewash;
  const paper = PALETTE.thatch;

  // Paper wrap at base
  for (let y = 11; y < 15; y++) {
    for (let x = 4; x < 12; x++) {
      setPixel(ctx, x, y, y === 11 ? paper.light : y > 13 ? paper.dark : paper.mid);
    }
  }

  // Conical sugar loaf
  for (let y = 2; y < 12; y++) {
    const halfW = Math.floor((y - 2) * 0.45) + 1;
    const cx = 8;
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x < cx - halfW + 1) shade = white.lightest;
        else if (x > cx + halfW - 1) shade = white.mid;
        else if (y < 5) shade = white.bright;
        else shade = white.light;

        // Granular sugar texture
        if (seededRandom(x, y, 23) > 0.85) shade = white.midDark;

        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Top point highlight
  setPixel(ctx, 8, 2, '#FFFFFF');

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 15, 4, 12, 1);
}

// Handcart - two-wheeled market cart (32x16)
function drawHandcart(ctx) {
  const wood = PALETTE.wood;
  const metal = PALETTE.stone;

  // Flat bed
  for (let y = 4; y < 8; y++) {
    for (let x = 4; x < 28; x++) {
      const shade = y === 4 ? wood.light : y === 7 ? wood.darkest : wood.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // Side rails
  for (let y = 2; y < 8; y++) {
    setPixel(ctx, 4, y, wood.light);
    setPixel(ctx, 5, y, wood.mid);
    setPixel(ctx, 26, y, wood.mid);
    setPixel(ctx, 27, y, wood.dark);
  }

  // Handles (extending left)
  for (let x = 0; x < 5; x++) {
    setPixel(ctx, x, 5, wood.light);
    setPixel(ctx, x, 6, wood.dark);
  }

  // Wood grain on bed
  for (let y = 5; y < 7; y++) {
    for (let x = 5; x < 27; x++) {
      if (seededRandom(x, y, 24) > 0.7) setPixel(ctx, x, y, wood.dark);
    }
  }

  // Wheels (two circles)
  // Left wheel
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 3 && dist > 1.5) {
        setPixel(ctx, 8 + dx, 11 + dy, dx < 0 ? wood.light : wood.darkest);
      }
    }
  }
  setPixel(ctx, 8, 11, metal.mid); // axle

  // Right wheel
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 3 && dist > 1.5) {
        setPixel(ctx, 24 + dx, 11 + dy, dx < 0 ? wood.light : wood.darkest);
      }
    }
  }
  setPixel(ctx, 24, 11, metal.mid); // axle

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 4, 28, 2);
}

// Pelourinho - Portuguese colonial pillory (16x32)
function drawPelourinho(ctx) {
  const stone = PALETTE.stone;
  const metal = PALETTE.stone;

  // Ornate capital/top (wider, decorated)
  for (let y = 0; y < 4; y++) {
    for (let x = 4; x < 12; x++) {
      let shade;
      if (y === 0) shade = stone.lightest;
      else if (x === 4) shade = stone.light;
      else if (x === 11) shade = stone.dark;
      else shade = stone.bright;
      setPixel(ctx, x, y, shade);
    }
  }
  // Decorative ball on top
  setPixel(ctx, 7, 0, stone.lightest);
  setPixel(ctx, 8, 0, stone.bright);

  // Iron bracket / arm
  for (let x = 10; x < 14; x++) {
    setPixel(ctx, x, 5, metal.light);
    setPixel(ctx, x, 6, metal.mid);
    setPixel(ctx, x, 7, metal.dark);
  }
  // Ring at end of bracket
  setPixel(ctx, 13, 4, metal.mid);
  setPixel(ctx, 14, 5, metal.mid);
  setPixel(ctx, 14, 6, metal.dark);
  setPixel(ctx, 13, 7, metal.darkest);

  // Column shaft
  for (let y = 4; y < 26; y++) {
    for (let x = 6; x < 10; x++) {
      let shade;
      if (x === 6) shade = stone.light;
      else if (x === 9) shade = stone.dark;
      else shade = stone.mid;
      setPixel(ctx, x, y, shade);
    }
  }

  // Column fluting detail (vertical grooves)
  for (let y = 6; y < 24; y++) {
    if (y % 2 === 0) {
      setPixel(ctx, 7, y, stone.midDark);
    }
  }

  // Base (stepped, wider)
  for (let y = 26; y < 28; y++) {
    for (let x = 4; x < 12; x++) {
      setPixel(ctx, x, y, y === 26 ? stone.mid : stone.dark);
    }
  }
  for (let y = 28; y < 30; y++) {
    for (let x = 3; x < 13; x++) {
      setPixel(ctx, x, y, y === 28 ? stone.midDark : stone.darkest);
    }
  }

  // Stone pitting
  for (let y = 4; y < 26; y++) {
    for (let x = 6; x < 10; x++) {
      if (seededRandom(x, y, 25) > 0.95) setPixel(ctx, x, y, stone.dark);
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 30, 3, 13, 2);
}

// Candelabra - multi-arm candle holder (8x16)
function drawCandelabra(ctx) {
  const gold = PALETTE.gold;
  const fire = PALETTE.fire;

  // Central stem
  for (let y = 6; y < 14; y++) {
    setPixel(ctx, 3, y, gold.light);
    setPixel(ctx, 4, y, gold.mid);
  }

  // Base (wider, decorative)
  for (let x = 1; x < 7; x++) {
    setPixel(ctx, x, 14, gold.mid);
    setPixel(ctx, x, 15, gold.dark);
  }
  setPixel(ctx, 2, 13, gold.light);
  setPixel(ctx, 5, 13, gold.midDark);

  // Left arm
  setPixel(ctx, 1, 5, gold.light);
  setPixel(ctx, 2, 5, gold.mid);
  setPixel(ctx, 2, 6, gold.mid);

  // Right arm
  setPixel(ctx, 5, 5, gold.mid);
  setPixel(ctx, 6, 5, gold.midDark);
  setPixel(ctx, 5, 6, gold.mid);

  // Center cup top
  setPixel(ctx, 3, 5, gold.bright);
  setPixel(ctx, 4, 5, gold.light);

  // Candle stubs
  // Left candle
  setPixel(ctx, 1, 3, PALETTE.whitewash.light);
  setPixel(ctx, 1, 4, PALETTE.whitewash.mid);
  // Center candle
  setPixel(ctx, 3, 3, PALETTE.whitewash.light);
  setPixel(ctx, 4, 3, PALETTE.whitewash.mid);
  setPixel(ctx, 3, 4, PALETTE.whitewash.light);
  setPixel(ctx, 4, 4, PALETTE.whitewash.mid);
  // Right candle
  setPixel(ctx, 6, 3, PALETTE.whitewash.light);
  setPixel(ctx, 6, 4, PALETTE.whitewash.mid);

  // Flames (3)
  setPixel(ctx, 1, 2, fire.lightest);
  setPixel(ctx, 1, 1, gold.lightest);
  setPixel(ctx, 3, 2, fire.lightest);
  setPixel(ctx, 4, 1, gold.lightest);
  setPixel(ctx, 6, 2, fire.lightest);
  setPixel(ctx, 6, 1, gold.lightest);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 15, 1, 7, 1);
}

// Iron fence - cemetery railing (16x16)
function drawIronFence(ctx) {
  const metal = PALETTE.stone;

  // Horizontal rails (top and bottom)
  for (let x = 0; x < 16; x++) {
    setPixel(ctx, x, 2, metal.light);
    setPixel(ctx, x, 3, metal.mid);
    setPixel(ctx, x, 11, metal.mid);
    setPixel(ctx, x, 12, metal.dark);
  }

  // Vertical bars
  for (let barX = 1; barX < 16; barX += 3) {
    for (let y = 0; y < 14; y++) {
      setPixel(ctx, barX, y, metal.light);
      if (barX + 1 < 16) setPixel(ctx, barX + 1, y, metal.dark);
    }
    // Decorative spear tips at top
    if (barX > 0 && barX < 15) {
      setPixel(ctx, barX, 0, metal.bright);
      if (barX + 1 < 16) setPixel(ctx, barX + 1, 0, metal.light);
      // Point
      if (barX > 0) setPixel(ctx, barX, -1 >= 0 ? -1 : 0, metal.lightest);
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 0, 16, 2);
}

// Scroll rack - Chinese document shelf (16x24)
function drawScrollRack(ctx) {
  const wood = PALETTE.wood;
  const scroll = PALETTE.thatch;

  // Shelf frame (vertical sides)
  for (let y = 0; y < 22; y++) {
    setPixel(ctx, 1, y, wood.light);
    setPixel(ctx, 2, y, wood.mid);
    setPixel(ctx, 13, y, wood.mid);
    setPixel(ctx, 14, y, wood.dark);
  }

  // Horizontal shelves (3 shelves)
  const shelfYs = [0, 7, 14, 21];
  for (const sy of shelfYs) {
    for (let x = 1; x < 15; x++) {
      setPixel(ctx, x, sy, wood.light);
      if (sy + 1 < 24) setPixel(ctx, x, sy + 1, wood.dark);
    }
  }

  // Wood grain on shelves
  for (const sy of shelfYs) {
    for (let x = 3; x < 13; x++) {
      if (seededRandom(x, sy, 26) > 0.6) setPixel(ctx, x, sy, wood.midDark);
    }
  }

  // Scroll cylinders on each shelf
  // Top shelf scrolls
  for (let s = 0; s < 3; s++) {
    const sx = 4 + s * 3;
    for (let y = 2; y < 6; y++) {
      setPixel(ctx, sx, y, scroll.light);
      setPixel(ctx, sx + 1, y, scroll.mid);
      setPixel(ctx, sx + 2, y, scroll.dark);
    }
    // Scroll end caps
    setPixel(ctx, sx, 2, scroll.bright);
    setPixel(ctx, sx + 2, 2, scroll.midDark);
  }

  // Middle shelf scrolls
  for (let s = 0; s < 2; s++) {
    const sx = 5 + s * 4;
    for (let y = 9; y < 13; y++) {
      setPixel(ctx, sx, y, scroll.light);
      setPixel(ctx, sx + 1, y, scroll.mid);
      setPixel(ctx, sx + 2, y, scroll.dark);
    }
    setPixel(ctx, sx, 9, scroll.bright);
  }

  // Bottom shelf scrolls
  for (let s = 0; s < 3; s++) {
    const sx = 3 + s * 3;
    for (let y = 16; y < 20; y++) {
      setPixel(ctx, sx, y, scroll.light);
      setPixel(ctx, sx + 1, y, scroll.mid);
      setPixel(ctx, sx + 2, y, scroll.dark);
    }
  }

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 22, 1, 15, 2);
}

// Fish basket - woven bamboo with fish (16x16)
function drawFishBasket(ctx) {
  const bamboo = PALETTE.lightWood;
  const fish = PALETTE.water;

  // Basket body (rounded woven shape)
  for (let y = 4; y < 14; y++) {
    const t = (y - 4) / 10;
    const halfW = Math.floor(Math.sin(t * Math.PI) * 6) + 1;
    for (let x = 8 - halfW; x <= 7 + halfW; x++) {
      if (x >= 0 && x < 16) {
        const weave = (Math.floor(x / 2) + Math.floor(y / 2)) % 2;
        let shade;
        if (x <= 8 - halfW + 1) shade = bamboo.light;
        else if (x >= 7 + halfW - 1) shade = bamboo.dark;
        else shade = weave ? bamboo.mid : bamboo.midDark;
        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Basket rim
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 4, bamboo.bright);
  }

  // Fish visible through gaps
  setPixel(ctx, 6, 7, fish.light);
  setPixel(ctx, 7, 7, fish.mid);
  setPixel(ctx, 8, 8, fish.light);
  setPixel(ctx, 9, 8, fish.mid);
  setPixel(ctx, 7, 10, fish.mid);
  setPixel(ctx, 8, 10, fish.dark);
  setPixel(ctx, 10, 9, fish.midDark);

  // Fish tail poking out
  setPixel(ctx, 5, 6, fish.mid);
  setPixel(ctx, 4, 5, fish.dark);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 3, 13, 2);
}

// Herb drying rack - wooden A-frame with herbs (16x24)
function drawHerbDryingRack(ctx) {
  const wood = PALETTE.wood;
  const herb = PALETTE.jungle;

  // A-frame left leg
  for (let y = 0; y < 22; y++) {
    const lx = Math.floor(2 + y * 0.2);
    setPixel(ctx, lx, y, wood.light);
    setPixel(ctx, lx + 1, y, wood.dark);
  }

  // A-frame right leg
  for (let y = 0; y < 22; y++) {
    const rx = Math.floor(13 - y * 0.2);
    setPixel(ctx, rx, y, wood.mid);
    setPixel(ctx, rx - 1, y, wood.dark);
  }

  // Horizontal crossbar
  for (let x = 4; x < 12; x++) {
    setPixel(ctx, x, 4, wood.light);
    setPixel(ctx, x, 5, wood.dark);
  }

  // Second crossbar lower
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 10, wood.light);
    setPixel(ctx, x, 11, wood.dark);
  }

  // Hanging herb bundles (from top bar)
  // Bundle 1
  for (let y = 6; y < 12; y++) {
    setPixel(ctx, 5, y, herb.mid);
    setPixel(ctx, 6, y, herb.dark);
    if (y > 9) setPixel(ctx, 5, y, herb.midDark);
  }
  setPixel(ctx, 5, 5, PALETTE.thatch.mid); // tie

  // Bundle 2
  for (let y = 6; y < 13; y++) {
    setPixel(ctx, 8, y, herb.light);
    setPixel(ctx, 9, y, herb.mid);
    if (y > 10) setPixel(ctx, 8, y, herb.dark);
  }
  setPixel(ctx, 8, 5, PALETTE.thatch.mid); // tie

  // Bundle 3
  for (let y = 6; y < 11; y++) {
    setPixel(ctx, 10, y, herb.mid);
    setPixel(ctx, 11, y, herb.darkest);
  }
  setPixel(ctx, 10, 5, PALETTE.thatch.mid); // tie

  // Hanging herb bundles (from lower bar)
  for (let y = 12; y < 18; y++) {
    setPixel(ctx, 6, y, herb.midLight);
    setPixel(ctx, 7, y, herb.mid);
    if (y > 15) { setPixel(ctx, 6, y, herb.midDark); setPixel(ctx, 7, y, herb.dark); }
  }
  setPixel(ctx, 6, 11, PALETTE.thatch.mid);

  for (let y = 12; y < 17; y++) {
    setPixel(ctx, 9, y, herb.light);
    setPixel(ctx, 10, y, herb.mid);
  }
  setPixel(ctx, 9, 11, PALETTE.thatch.mid);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 22, 3, 13, 2);
}

// Rice pot - clay pot on stone tripod with steam (16x16)
function drawRicePot(ctx) {
  const clay = PALETTE.terracotta;
  const stone = PALETTE.stone;

  // Stone cooking tripod (3 stones)
  // Left stone
  setPixel(ctx, 3, 12, stone.light);
  setPixel(ctx, 4, 12, stone.mid);
  setPixel(ctx, 3, 13, stone.mid);
  setPixel(ctx, 4, 13, stone.dark);
  // Right stone
  setPixel(ctx, 11, 12, stone.mid);
  setPixel(ctx, 12, 12, stone.dark);
  setPixel(ctx, 11, 13, stone.midDark);
  setPixel(ctx, 12, 13, stone.darkest);
  // Front stone
  setPixel(ctx, 7, 13, stone.mid);
  setPixel(ctx, 8, 13, stone.dark);
  setPixel(ctx, 7, 14, stone.midDark);
  setPixel(ctx, 8, 14, stone.darkest);

  // Pot body (rounded)
  for (let y = 5; y < 12; y++) {
    const t = (y - 5) / 7;
    const halfW = Math.floor(Math.sin(t * Math.PI) * 4) + 2;
    for (let x = 8 - halfW; x <= 7 + halfW; x++) {
      if (x >= 0 && x < 16) {
        let shade;
        if (x === 8 - halfW) shade = clay.light;
        else if (x === 7 + halfW) shade = clay.darkest;
        else if (y < 7) shade = clay.bright;
        else shade = clay.mid;
        setPixel(ctx, x, y, shade);
      }
    }
  }

  // Pot rim
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 5, clay.lightest);
  }

  // Lid
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 4, clay.light);
  }
  setPixel(ctx, 7, 3, clay.mid);
  setPixel(ctx, 8, 3, clay.midDark);

  // Steam wisps
  setPixel(ctx, 6, 2, PALETTE.whitewash.mid);
  setPixel(ctx, 7, 1, PALETTE.whitewash.light);
  setPixel(ctx, 9, 2, PALETTE.whitewash.mid);
  setPixel(ctx, 8, 0, PALETTE.whitewash.bright);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 3, 13, 2);
}

// Wayang kulit puppet - shadow puppet on stick (16x24)
function drawWayangKulitPuppet(ctx) {
  const wood = PALETTE.wood;
  const gold = PALETTE.gold;

  // Control stick (vertical, from bottom)
  for (let y = 14; y < 24; y++) {
    setPixel(ctx, 7, y, wood.light);
    setPixel(ctx, 8, y, wood.dark);
  }

  // Puppet body (flat ornate silhouette)
  // Head (elaborate headdress)
  for (let y = 0; y < 4; y++) {
    const w = y < 2 ? 2 : 3;
    for (let x = 7 - w; x <= 8 + w; x++) {
      if (x >= 0 && x < 16) {
        setPixel(ctx, x, y, y === 0 ? wood.bright : wood.mid);
      }
    }
  }
  // Headdress point
  setPixel(ctx, 8, 0, gold.bright);
  setPixel(ctx, 9, 0, gold.mid);
  setPixel(ctx, 10, 1, gold.midDark);

  // Torso
  for (let y = 4; y < 9; y++) {
    for (let x = 5; x < 11; x++) {
      setPixel(ctx, x, y, x < 7 ? wood.light : x > 9 ? wood.darkest : wood.mid);
    }
  }

  // Gold trim on torso
  setPixel(ctx, 5, 4, gold.mid);
  setPixel(ctx, 10, 4, gold.midDark);
  setPixel(ctx, 5, 8, gold.mid);
  setPixel(ctx, 10, 8, gold.midDark);
  for (let x = 5; x < 11; x++) {
    setPixel(ctx, x, 6, gold.mid);
  }

  // Arms (extended, ornate)
  // Left arm
  for (let i = 0; i < 5; i++) {
    const ax = 4 - i;
    const ay = 5 + i;
    if (ax >= 0 && ay < 14) {
      setPixel(ctx, ax, ay, wood.light);
      setPixel(ctx, ax, ay + 1, wood.mid);
    }
  }
  // Right arm
  for (let i = 0; i < 5; i++) {
    const ax = 11 + i;
    const ay = 5 + i;
    if (ax < 16 && ay < 14) {
      setPixel(ctx, ax, ay, wood.mid);
      setPixel(ctx, ax, ay + 1, wood.dark);
    }
  }

  // Skirt/lower body (flared)
  for (let y = 9; y < 14; y++) {
    const w = 3 + (y - 9);
    for (let x = 8 - w; x <= 7 + w; x++) {
      if (x >= 0 && x < 16) {
        setPixel(ctx, x, y, x < 7 ? wood.light : x > 9 ? wood.darkest : wood.mid);
      }
    }
  }

  // Gold trim on skirt
  for (let y = 10; y < 14; y += 2) {
    const w = 3 + (y - 9);
    setPixel(ctx, 8 - w, y, gold.mid);
    setPixel(ctx, 7 + w, y, gold.midDark);
  }

  // Arm control sticks (thin diagonal)
  setPixel(ctx, 1, 12, wood.mid);
  setPixel(ctx, 0, 14, wood.dark);
  setPixel(ctx, 14, 12, wood.mid);
  setPixel(ctx, 15, 14, wood.dark);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 23, 6, 10, 1);
}

// Spice pile pepper - black pepper pile (16x16)
function drawSpicePilePepper(ctx) {
  const shadow = PALETTE.shadow;

  // Conical pile (dark mound)
  for (let y = 4; y < 14; y++) {
    const halfW = Math.floor((y - 4) * 0.65) + 1;
    const cx = 8;
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      if (x >= 0 && x < 16) {
        // Use shadow shades 3-6 for the dark pepper
        let shadeIdx;
        if (x < cx - halfW + 1) shadeIdx = 5;
        else if (x > cx + halfW - 1) shadeIdx = 3;
        else if (y < 7) shadeIdx = 6;
        else if (y > 11) shadeIdx = 3;
        else shadeIdx = 4;

        // Peppercorn texture variation
        const grain = seededRandom(x, y, 27);
        if (grain > 0.8) shadeIdx = Math.min(7, shadeIdx + 1);
        else if (grain < 0.15) shadeIdx = Math.max(0, shadeIdx - 1);

        setPixel(ctx, x, y, shadow[shadeIdx]);
      }
    }
  }

  // Scattered peppercorns at base
  setPixel(ctx, 3, 13, shadow[4]);
  setPixel(ctx, 5, 14, shadow[5]);
  setPixel(ctx, 11, 13, shadow[3]);
  setPixel(ctx, 12, 14, shadow[4]);
  setPixel(ctx, 7, 14, shadow[5]);
  setPixel(ctx, 9, 13, shadow[3]);

  // Ambient occlusion at base
  addAmbientOcclusion(ctx, 14, 4, 12, 2);
}

module.exports = {
  drawPalmTree,
  drawMarketStall,
  drawBarrel,
  drawCrate,
  drawPottery,
  drawLantern,
  drawStoneCross,
  drawFishingNet,
  drawAnchor,
  drawWovenMat,
  drawCookingFire,
  drawBetelNutTray,
  drawTinIngots,
  drawBalanceScale,
  drawRiceMortar,
  drawFishTrap,
  drawPrayerMat,
  drawCannon,
  // Sprint 1B - HIGH priority
  drawMarketStall1,
  drawMarketStall2,
  drawTavernSign,
  drawAwning,
  drawHangingCloth,
  drawSpicePile,
  drawGravestone,
  drawAltar,
  drawWoodenPew,
  drawDhowSail,
  drawShipMast,
  drawBambooFence,
  // Sprint 1C - MEDIUM priority
  drawBell,
  drawSack,
  drawAmphora,
  drawRopeCoil,
  drawCargoCrate,
  drawArchedWindow,
  drawWaterWell,
  drawBananaTree,
  drawCoconut,
  drawHangingOilLantern,
  drawDryingFishRack,
  drawLaundryLine,
  drawMooredSampan,
  // Phase 3 - Art elevation
  addAmbientOcclusion,
  drawFruitBasket,
  drawCoconutWaterStand,
  drawBench,
  drawWineJug,
  drawSugarCone,
  drawHandcart,
  drawPelourinho,
  drawCandelabra,
  drawIronFence,
  drawScrollRack,
  drawFishBasket,
  drawHerbDryingRack,
  drawRicePot,
  drawWayangKulitPuppet,
  drawSpicePilePepper,
};

