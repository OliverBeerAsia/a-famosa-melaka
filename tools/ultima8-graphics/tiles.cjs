/**
 * Ultima 8 Style Tile Generator
 * Creates rich, detailed 32x32 tiles with dithering and atmospheric depth
 * Inspired by the VGA aesthetic of Ultima 8: Pagan
 */

const { createCanvas } = require('canvas');
const { PALETTE, DITHER_MATRIX, blendDithered, lerpColor } = require('./palette.cjs');

const TILE_SIZE = 32;

// Helper functions
function setPixel(ctx, x, y, color) {
  if (x >= 0 && x < TILE_SIZE && y >= 0 && y < TILE_SIZE) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }
}

// Seeded random for consistent patterns
function seededRandom(x, y, seed = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

// Get palette shade with dithering between adjacent levels
function getShade(palette, level, x, y) {
  const baseLevel = Math.floor(level);
  const fraction = level - baseLevel;
  const idx1 = Math.max(0, Math.min(7, baseLevel));
  const idx2 = Math.max(0, Math.min(7, baseLevel + 1));
  
  if (fraction < 0.01) return palette[idx1];
  if (fraction > 0.99) return palette[idx2];
  
  const threshold = Math.floor(fraction * 16);
  return blendDithered(palette[idx1], palette[idx2], x, y, threshold);
}

// ====================
// VARIANT SYSTEM - Post-processing weathering for tile variants
// ====================
function drawWithVariant(ctx, baseDrawFunc, variantSeed) {
  // Draw the base tile first
  baseDrawFunc(ctx);

  // Read back pixels for post-processing
  const imageData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const data = imageData.data;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const i = (y * TILE_SIZE + x) * 4;
      const noise = seededRandom(x, y, variantSeed);

      // Stain/crack darkening (15-25%) at seeded noise > 0.92
      if (noise > 0.92) {
        const darkenFactor = 0.75 + seededRandom(x, y, variantSeed + 1) * 0.10; // 75-85% = 15-25% darkening
        data[i]     = Math.floor(data[i] * darkenFactor);
        data[i + 1] = Math.floor(data[i + 1] * darkenFactor);
        data[i + 2] = Math.floor(data[i + 2] * darkenFactor);
      }

      // Moss/growth green tinting on variant-specific corners
      const cornerSeed = seededRandom(variantSeed, variantSeed + 7, 0);
      const cornerIdx = Math.floor(cornerSeed * 4); // 0=TL, 1=TR, 2=BL, 3=BR
      let inCorner = false;
      if (cornerIdx === 0 && x < 10 && y < 10) inCorner = true;
      if (cornerIdx === 1 && x > 22 && y < 10) inCorner = true;
      if (cornerIdx === 2 && x < 10 && y > 22) inCorner = true;
      if (cornerIdx === 3 && x > 22 && y > 22) inCorner = true;

      if (inCorner && seededRandom(x, y, variantSeed + 50) > 0.6) {
        // Green tint: boost green channel, slightly reduce red and blue
        data[i]     = Math.max(0, data[i] - 8);
        data[i + 1] = Math.min(255, data[i + 1] + 15);
        data[i + 2] = Math.max(0, data[i + 2] - 5);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ====================
// TILE VARIANTS - Worn/weathered (V1) and moss-growth/tropical-stained (V2)
// ====================

// Grass variants
function drawGrassV1(ctx) {
  drawWithVariant(ctx, drawGrass, 101); // worn/weathered
}
function drawGrassV2(ctx) {
  drawWithVariant(ctx, drawGrass, 202); // moss-growth/tropical-stained
}

// Fortress stone variants
function drawFortressStoneV1(ctx) {
  drawWithVariant(ctx, drawFortressStone, 301); // worn/weathered
}
function drawFortressStoneV2(ctx) {
  // Battle-damaged variant: extra darkening and crack patterns
  drawFortressStone(ctx);
  const imageData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const data = imageData.data;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const i = (y * TILE_SIZE + x) * 4;
      const noise = seededRandom(x, y, 402);

      // Battle damage: deep gouges and scoring
      if (noise > 0.88) {
        const darkenFactor = 0.65 + seededRandom(x, y, 403) * 0.10;
        data[i]     = Math.floor(data[i] * darkenFactor);
        data[i + 1] = Math.floor(data[i + 1] * darkenFactor);
        data[i + 2] = Math.floor(data[i + 2] * darkenFactor);
      }

      // Scorch marks in diagonal streaks
      const streak = Math.sin((x + y) * 0.8 + seededRandom(x, 0, 410) * 3);
      if (streak > 0.85 && seededRandom(x, y, 411) > 0.7) {
        data[i]     = Math.max(0, data[i] - 20);
        data[i + 1] = Math.max(0, data[i + 1] - 18);
        data[i + 2] = Math.max(0, data[i + 2] - 10);
      }

      // Moss in sheltered corners (bottom-left and top-right)
      const inCorner = (x < 8 && y > 24) || (x > 24 && y < 8);
      if (inCorner && seededRandom(x, y, 420) > 0.55) {
        data[i]     = Math.max(0, data[i] - 8);
        data[i + 1] = Math.min(255, data[i + 1] + 15);
        data[i + 2] = Math.max(0, data[i + 2] - 5);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// Whitewash wall variants
function drawWhitewashWallV1(ctx) {
  drawWithVariant(ctx, drawWhitewashWall, 501); // worn/weathered
}
function drawWhitewashWallV2(ctx) {
  drawWithVariant(ctx, drawWhitewashWall, 602); // moss-growth/tropical-stained
}

// Dirt path variants
function drawDirtPathV1(ctx) {
  drawWithVariant(ctx, drawDirtPath, 701); // worn/weathered
}
function drawDirtPathV2(ctx) {
  drawWithVariant(ctx, drawDirtPath, 802); // moss-growth/tropical-stained
}

// Dock wood variants
function drawDockWoodV1(ctx) {
  drawWithVariant(ctx, drawDockWood, 901); // worn/weathered
}
function drawDockWoodV2(ctx) {
  drawWithVariant(ctx, drawDockWood, 1002); // moss-growth/tropical-stained
}

// Church floor variants
function drawChurchFloorV1(ctx) {
  drawWithVariant(ctx, drawChurchFloor, 1101); // worn/weathered
}
function drawChurchFloorV2(ctx) {
  drawWithVariant(ctx, drawChurchFloor, 1202); // moss-growth/tropical-stained
}

// ====================
// COBBLESTONE TILE - Detailed stone street
// ====================
function drawCobblestone(ctx) {
  const p = PALETTE.stone;
  
  // Define individual cobblestones with varied sizes
  const stones = [
    { x: 1, y: 1, w: 13, h: 13 },
    { x: 17, y: 1, w: 13, h: 14 },
    { x: 1, y: 17, w: 14, h: 13 },
    { x: 18, y: 17, w: 13, h: 13 }
  ];
  
  // Base fill with dark mortar
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      setPixel(ctx, x, y, p[1]);
    }
  }
  
  stones.forEach((stone, idx) => {
    const seed = idx * 17;
    
    for (let sy = 0; sy < stone.h; sy++) {
      for (let sx = 0; sx < stone.w; sx++) {
        const px = stone.x + sx;
        const py = stone.y + sy;
        
        // Calculate 3D shading
        const centerX = stone.w / 2;
        const centerY = stone.h / 2;
        const dx = (sx - centerX) / centerX;
        const dy = (sy - centerY) / centerY;
        
        // Lighting from top-left
        let shade = 4 - dx * 1.5 - dy * 2;
        
        // Add surface texture noise
        const noise = seededRandom(px, py, seed) * 1.2;
        shade += noise - 0.6;
        
        // Edge darkening
        if (sx === 0 || sy === 0) shade += 0.5;
        if (sx === stone.w - 1 || sy === stone.h - 1) shade -= 1;
        
        // Top highlight
        if (sy < 2) shade += 1;
        // Left highlight
        if (sx < 2) shade += 0.5;
        // Bottom shadow
        if (sy > stone.h - 3) shade -= 1;
        // Right shadow
        if (sx > stone.w - 3) shade -= 0.5;
        
        shade = Math.max(1, Math.min(7, shade));
        setPixel(ctx, px, py, getShade(p, shade, px, py));
      }
    }
  });
  
  // Add mortar details
  for (let x = 0; x < TILE_SIZE; x++) {
    setPixel(ctx, x, 0, p[0]);
    setPixel(ctx, x, 15, p[0]);
    setPixel(ctx, x, 16, p[0]);
    setPixel(ctx, x, 31, p[0]);
  }
  for (let y = 0; y < TILE_SIZE; y++) {
    setPixel(ctx, 0, y, p[0]);
    setPixel(ctx, 15, y, p[0]);
    setPixel(ctx, 16, y, p[0]);
    setPixel(ctx, 31, y, p[0]);
  }
  
  // Wear marks and dirt
  const wearSpots = [[8, 8], [24, 12], [12, 24], [20, 20]];
  wearSpots.forEach(([wx, wy]) => {
    setPixel(ctx, wx, wy, PALETTE.sand[2]);
    setPixel(ctx, wx + 1, wy, PALETTE.sand[2]);
  });
}

// ====================
// GRASS TILE - Lush tropical grass with depth
// ====================
function drawGrass(ctx) {
  const g = PALETTE.grass;
  const j = PALETTE.jungle;
  
  // Base layer with noise variation
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const noise = seededRandom(x, y, 42);
      const shade = 2 + noise * 3;
      setPixel(ctx, x, y, getShade(g, shade, x, y));
    }
  }
  
  // Add grass blades (lighter tips)
  for (let i = 0; i < 40; i++) {
    const bx = Math.floor(seededRandom(i, 0, 99) * TILE_SIZE);
    const by = Math.floor(seededRandom(0, i, 99) * TILE_SIZE);
    const height = 2 + Math.floor(seededRandom(i, i, 99) * 3);
    
    for (let h = 0; h < height; h++) {
      const shade = 5 + (height - h) * 0.5;
      if (by - h >= 0) {
        setPixel(ctx, bx, by - h, getShade(g, shade, bx, by - h));
      }
    }
  }
  
  // Dark patches (shadows/depth)
  for (let i = 0; i < 8; i++) {
    const px = Math.floor(seededRandom(i * 3, 0, 77) * TILE_SIZE);
    const py = Math.floor(seededRandom(0, i * 3, 77) * TILE_SIZE);
    
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        if (seededRandom(px + dx, py + dy, 88) > 0.4) {
          setPixel(ctx, px + dx, py + dy, getShade(j, 2, px + dx, py + dy));
        }
      }
    }
  }
  
  // Occasional flowers
  if (seededRandom(15, 15, 123) > 0.7) {
    setPixel(ctx, 12, 10, PALETTE.fire[7]); // Yellow flower
    setPixel(ctx, 22, 18, PALETTE.clothRed[5]); // Red flower
  }
}

// ====================
// FORTRESS STONE - Heavy fortress blocks
// ====================
function drawFortressStone(ctx) {
  const p = PALETTE.stone;
  
  // Large dressed stone block
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      // Base shading - lit from top-left
      let shade = 4;
      
      // Top edge - bright
      if (y < 3) shade = 6 - y * 0.5;
      // Left edge - medium bright
      else if (x < 3) shade = 5 - x * 0.3;
      // Bottom edge - dark
      else if (y > TILE_SIZE - 4) shade = 2 + (TILE_SIZE - y) * 0.3;
      // Right edge - darkest
      else if (x > TILE_SIZE - 4) shade = 1.5 + (TILE_SIZE - x) * 0.3;
      
      // Surface texture
      const noise = seededRandom(x, y, 33) * 0.8;
      shade += noise - 0.4;
      
      // Weathering and cracks
      if (seededRandom(x * 2, y * 2, 55) > 0.95) {
        shade -= 1.5;
      }
      
      shade = Math.max(0, Math.min(7, shade));
      setPixel(ctx, x, y, getShade(p, shade, x, y));
    }
  }
  
  // Carved edge detail
  for (let i = 2; i < TILE_SIZE - 2; i++) {
    setPixel(ctx, i, 2, p[6]);
    setPixel(ctx, 2, i, p[5]);
    setPixel(ctx, i, TILE_SIZE - 3, p[1]);
    setPixel(ctx, TILE_SIZE - 3, i, p[1]);
  }
}

// ====================
// WATER TILE - Deep tropical water with shimmer
// ====================
function drawWater(ctx) {
  const w = PALETTE.water;
  
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      // Wave pattern
      const wave1 = Math.sin((x + y) * 0.3) * 0.5;
      const wave2 = Math.sin((x - y) * 0.2 + 1) * 0.3;
      const combined = wave1 + wave2;
      
      let shade = 3 + combined * 2;
      
      // Add ripple texture
      const noise = seededRandom(x, y, 88) * 0.5;
      shade += noise;
      
      shade = Math.max(0, Math.min(7, shade));
      setPixel(ctx, x, y, getShade(w, shade, x, y));
    }
  }
  
  // Specular highlights (sun reflection)
  const highlights = [[8, 6], [20, 14], [12, 22], [26, 8]];
  highlights.forEach(([hx, hy]) => {
    setPixel(ctx, hx, hy, '#6A8AAA');
    setPixel(ctx, hx + 1, hy, '#5A7A9A');
  });
  
  // Foam/bubble hints
  setPixel(ctx, 5, 12, w[6]);
  setPixel(ctx, 18, 20, w[6]);
}

// ====================
// DOCK WOOD - Weathered wooden planks
// ====================
function drawDockWood(ctx) {
  const w = PALETTE.wood;
  const lw = PALETTE.lightWood;
  
  // Draw horizontal planks
  const plankHeight = 8;
  
  for (let plank = 0; plank < 4; plank++) {
    const py = plank * plankHeight;
    const seed = plank * 23;
    
    for (let y = py; y < py + plankHeight && y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        // Wood grain - horizontal lines with variation
        const grainPhase = seededRandom(y, seed, 44) * 6;
        const grain = Math.sin(x * 0.3 + grainPhase) * 0.3;
        
        let shade = 4 + grain;
        
        // Plank edge highlight (top)
        if (y === py) shade = 6;
        else if (y === py + 1) shade = 5;
        // Plank edge shadow (bottom/gap)
        else if (y === py + plankHeight - 1) shade = 1;
        else if (y === py + plankHeight - 2) shade = 2;
        
        // Weathering variation
        const weather = seededRandom(x, y, seed) * 0.8;
        shade += weather - 0.4;
        
        shade = Math.max(0, Math.min(7, shade));
        setPixel(ctx, x, y, getShade(w, shade, x, y));
      }
    }
  }
  
  // Nail heads
  const nails = [[4, 3], [28, 3], [4, 11], [28, 11], [4, 19], [28, 19], [4, 27], [28, 27]];
  nails.forEach(([nx, ny]) => {
    setPixel(ctx, nx, ny, PALETTE.stone[2]);
    setPixel(ctx, nx + 1, ny, PALETTE.stone[1]);
  });
  
  // Wood knots
  setPixel(ctx, 12, 5, w[2]);
  setPixel(ctx, 22, 21, w[2]);
}

// ====================
// WHITEWASH WALL - Portuguese colonial building
// ====================
function drawWhitewashWall(ctx) {
  const ww = PALETTE.whitewash;
  
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      // Base shade with subtle variation
      let shade = 5;
      
      // Texture from plaster
      const noise = seededRandom(x, y, 22) * 1.5;
      shade += noise - 0.75;
      
      // Weathering/dirt near bottom
      if (y > TILE_SIZE - 6) {
        shade -= (y - (TILE_SIZE - 6)) * 0.3;
      }
      
      // Age stains
      if (seededRandom(x * 3, y * 3, 66) > 0.92) {
        shade -= 1.5;
      }
      
      shade = Math.max(0, Math.min(7, shade));
      setPixel(ctx, x, y, getShade(ww, shade, x, y));
    }
  }
  
  // Cracks
  let crackY = 8;
  for (let x = 5; x < 20; x++) {
    crackY += Math.floor(seededRandom(x, crackY, 77) * 3) - 1;
    crackY = Math.max(4, Math.min(TILE_SIZE - 4, crackY));
    setPixel(ctx, x, crackY, ww[1]);
  }
}

// ====================
// TERRACOTTA ROOF - Portuguese clay tiles
// ====================
function drawTerracottaRoof(ctx) {
  const t = PALETTE.terracotta;
  
  // Curved tile rows
  for (let y = 0; y < TILE_SIZE; y++) {
    const rowPhase = Math.floor(y / 8);
    
    for (let x = 0; x < TILE_SIZE; x++) {
      // Curved tile shape
      const tileY = y % 8;
      const curve = Math.sin(tileY / 8 * Math.PI);
      
      let shade = 3 + curve * 3;
      
      // Row offset for overlap effect
      if (tileY < 2) shade = 6; // Top of tile (highlighted)
      if (tileY > 6) shade = 2; // Bottom (shadowed/overlap)
      
      // Horizontal variation
      const noise = seededRandom(x, y, rowPhase * 11) * 0.6;
      shade += noise;
      
      shade = Math.max(0, Math.min(7, shade));
      setPixel(ctx, x, y, getShade(t, shade, x, y));
    }
  }
  
  // Tile edge lines
  for (let x = 0; x < TILE_SIZE; x++) {
    setPixel(ctx, x, 7, t[1]);
    setPixel(ctx, x, 15, t[1]);
    setPixel(ctx, x, 23, t[1]);
    setPixel(ctx, x, 31, t[1]);
  }
}

// ====================
// DIRT PATH - Worn earth path
// ====================
function drawDirtPath(ctx) {
  const s = PALETTE.sand;
  
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      // Base dirt with variation
      let shade = 3;
      
      const noise = seededRandom(x, y, 44) * 2;
      shade += noise;
      
      // Footprint impressions (darker spots)
      if (seededRandom(x * 2, y * 2, 55) > 0.9) {
        shade -= 1.5;
      }
      
      shade = Math.max(0, Math.min(7, shade));
      setPixel(ctx, x, y, getShade(s, shade, x, y));
    }
  }
  
  // Scattered pebbles
  const pebbles = [[5, 8], [22, 12], [10, 24], [28, 6], [15, 18]];
  pebbles.forEach(([px, py]) => {
    setPixel(ctx, px, py, PALETTE.stone[4]);
    setPixel(ctx, px + 1, py, PALETTE.stone[3]);
    setPixel(ctx, px, py + 1, PALETTE.stone[2]);
  });
  
  // Grass tufts at edges
  setPixel(ctx, 2, 4, PALETTE.grass[4]);
  setPixel(ctx, 28, 20, PALETTE.grass[3]);
}

// ====================
// THATCH ROOF - Traditional Malay
// ====================
function drawThatchRoof(ctx) {
  const th = PALETTE.thatch;
  
  // Layered thatch bundles
  for (let y = 0; y < TILE_SIZE; y++) {
    const layer = Math.floor(y / 6);
    const layerOffset = layer % 2 === 0 ? 0 : 3;
    
    for (let x = 0; x < TILE_SIZE; x++) {
      const localY = y % 6;
      
      // Thatch strand shading
      let shade = 4;
      if (localY === 0) shade = 6; // Top of layer (lit)
      else if (localY === 5) shade = 2; // Bottom (shadow)
      
      // Individual strand variation
      const strand = (x + layerOffset) % 3;
      shade += (strand - 1) * 0.3;
      
      const noise = seededRandom(x, y, layer * 7) * 0.6;
      shade += noise;
      
      shade = Math.max(0, Math.min(7, shade));
      setPixel(ctx, x, y, getShade(th, shade, x, y));
    }
  }
  
  // Binding ropes
  for (let x = 0; x < TILE_SIZE; x++) {
    setPixel(ctx, x, 10, PALETTE.wood[4]);
    setPixel(ctx, x, 22, PALETTE.wood[4]);
  }
}

// ====================
// BAMBOO FLOOR - Kampung house floor
// ====================
function drawBambooFloor(ctx) {
  const g = PALETTE.grass;
  const lw = PALETTE.lightWood;
  
  // Bamboo slats (vertical)
  const slatWidth = 4;
  
  for (let slat = 0; slat < 8; slat++) {
    const sx = slat * slatWidth;
    const seed = slat * 13;
    
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = sx; x < sx + slatWidth && x < TILE_SIZE; x++) {
        const localX = x - sx;
        
        // Curved bamboo surface
        const curve = Math.sin(localX / slatWidth * Math.PI);
        let shade = 3 + curve * 2;
        
        // Edge highlight/shadow
        if (localX === 0) shade = 5;
        if (localX === slatWidth - 1) shade = 2;
        
        // Node rings every 8 pixels
        if (y % 8 === 0 || y % 8 === 1) shade -= 1;
        
        const noise = seededRandom(x, y, seed) * 0.4;
        shade += noise;
        
        shade = Math.max(0, Math.min(7, shade));
        setPixel(ctx, x, y, getShade(g, shade, x, y));
      }
    }
  }
}

// ====================
// CHURCH FLOOR - Checkered stone
// ====================
function drawChurchFloor(ctx) {
  const light = PALETTE.warmStone;
  const dark = PALETTE.stone;
  
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const checker = (Math.floor(x / 16) + Math.floor(y / 16)) % 2;
      const p = checker === 0 ? light : dark;
      
      // 3D tile effect
      const localX = x % 16;
      const localY = y % 16;
      
      let shade = 4;
      
      // Beveled edges
      if (localY < 2) shade = 6;
      else if (localX < 2) shade = 5;
      else if (localY > 13) shade = 2;
      else if (localX > 13) shade = 2;
      
      const noise = seededRandom(x, y, 11) * 0.5;
      shade += noise;
      
      shade = Math.max(0, Math.min(7, shade));
      setPixel(ctx, x, y, getShade(p, shade, x, y));
    }
  }
  
  // Grout lines
  for (let i = 0; i < TILE_SIZE; i++) {
    setPixel(ctx, i, 0, PALETTE.shadow[3]);
    setPixel(ctx, i, 16, PALETTE.shadow[3]);
    setPixel(ctx, 0, i, PALETTE.shadow[3]);
    setPixel(ctx, 16, i, PALETTE.shadow[3]);
  }
}

// ====================
// CHURCH STONE - Interior wall
// ====================
function drawChurchStone(ctx) {
  const p = PALETTE.warmStone;
  
  // Large cut blocks (16x16 each, 4 per tile)
  for (let blockY = 0; blockY < 2; blockY++) {
    for (let blockX = 0; blockX < 2; blockX++) {
      const bx = blockX * 16;
      const by = blockY * 16;
      const seed = blockX + blockY * 2;
      
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const px = bx + x;
          const py = by + y;
          
          let shade = 4;
          
          // Edge lighting
          if (y < 2) shade = 6;
          else if (x < 2) shade = 5;
          else if (y > 13) shade = 2;
          else if (x > 13) shade = 2;
          
          const noise = seededRandom(px, py, seed * 17) * 0.6;
          shade += noise;
          
          shade = Math.max(0, Math.min(7, shade));
          setPixel(ctx, px, py, getShade(p, shade, px, py));
        }
      }
    }
  }
  
  // Mortar lines
  for (let i = 0; i < TILE_SIZE; i++) {
    setPixel(ctx, i, 0, p[1]);
    setPixel(ctx, i, 15, p[1]);
    setPixel(ctx, i, 16, p[1]);
    setPixel(ctx, i, 31, p[1]);
    setPixel(ctx, 0, i, p[1]);
    setPixel(ctx, 15, i, p[1]);
    setPixel(ctx, 16, i, p[1]);
    setPixel(ctx, 31, i, p[1]);
  }
}

// ====================
// COBBLESTONE VARIANTS - Different stone arrangements
// ====================
function drawCobblestoneVariant(ctx, variant) {
  const p = PALETTE.stone;
  const seedOffset = variant * 137;

  // Different stone layouts per variant
  const layouts = [
    // Variant 1: smaller, more irregular stones
    [
      { x: 1, y: 1, w: 9, h: 9 }, { x: 12, y: 1, w: 8, h: 10 },
      { x: 22, y: 1, w: 9, h: 9 }, { x: 1, y: 12, w: 10, h: 8 },
      { x: 13, y: 13, w: 7, h: 7 }, { x: 22, y: 12, w: 9, h: 9 },
      { x: 1, y: 22, w: 9, h: 9 }, { x: 12, y: 22, w: 8, h: 9 },
      { x: 22, y: 23, w: 9, h: 8 },
    ],
    // Variant 2: mixed large and small
    [
      { x: 1, y: 1, w: 18, h: 9 }, { x: 21, y: 1, w: 10, h: 10 },
      { x: 1, y: 12, w: 10, h: 18 }, { x: 13, y: 12, w: 8, h: 8 },
      { x: 23, y: 13, w: 8, h: 7 }, { x: 13, y: 22, w: 18, h: 9 },
    ],
    // Variant 3: cracked/worn
    [
      { x: 1, y: 1, w: 14, h: 14 }, { x: 17, y: 1, w: 14, h: 13 },
      { x: 1, y: 17, w: 13, h: 14 }, { x: 16, y: 16, w: 15, h: 15 },
    ],
  ];

  const stones = layouts[variant % layouts.length];

  // Base mortar fill
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      setPixel(ctx, x, y, p[1]);
    }
  }

  stones.forEach((stone, idx) => {
    const seed = idx * 17 + seedOffset;
    for (let sy = 0; sy < stone.h; sy++) {
      for (let sx = 0; sx < stone.w; sx++) {
        const px = stone.x + sx;
        const py = stone.y + sy;
        if (px >= TILE_SIZE || py >= TILE_SIZE) continue;

        const centerX = stone.w / 2;
        const centerY = stone.h / 2;
        const dx = (sx - centerX) / centerX;
        const dy = (sy - centerY) / centerY;

        let shade = 4 - dx * 1.5 - dy * 2;
        shade += seededRandom(px, py, seed) * 1.2 - 0.6;
        if (sy < 2) shade += 1;
        if (sx < 2) shade += 0.5;
        if (sy > stone.h - 3) shade -= 1;
        if (sx > stone.w - 3) shade -= 0.5;

        // Variant 3: extra cracks
        if (variant === 2 && seededRandom(px * 3, py * 3, seedOffset) > 0.9) {
          shade -= 2;
        }

        shade = Math.max(1, Math.min(7, shade));
        setPixel(ctx, px, py, getShade(p, shade, px, py));
      }
    }
  });

  // Wear marks (variant-specific positions)
  const wearSeeds = [seedOffset + 42, seedOffset + 77, seedOffset + 13];
  for (let i = 0; i < 3 + variant; i++) {
    const wx = Math.floor(seededRandom(i, 0, wearSeeds[variant % 3]) * 28) + 2;
    const wy = Math.floor(seededRandom(0, i, wearSeeds[variant % 3]) * 28) + 2;
    setPixel(ctx, wx, wy, PALETTE.sand[2]);
    setPixel(ctx, wx + 1, wy, PALETTE.sand[2]);
  }
}

function drawCobblestoneV1(ctx) { drawCobblestoneVariant(ctx, 0); }
function drawCobblestoneV2(ctx) { drawCobblestoneVariant(ctx, 1); }
function drawCobblestoneV3(ctx) { drawCobblestoneVariant(ctx, 2); }

// ====================
// EDGE TRANSITION TILES - Dithered blending between surfaces
// ====================
function drawTransitionTile(ctx, drawA, drawB, direction) {
  // Draw both tiles to temp canvases, then dither-blend along edge
  const canvasA = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctxA = canvasA.getContext('2d');
  ctxA.imageSmoothingEnabled = false;
  drawA(ctxA);

  const canvasB = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctxB = canvasB.getContext('2d');
  ctxB.imageSmoothingEnabled = false;
  drawB(ctxB);

  const dataA = ctxA.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const dataB = ctxB.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const out = ctx.createImageData(TILE_SIZE, TILE_SIZE);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const i = (y * TILE_SIZE + x) * 4;

      // Blend factor: 0 = fully A, 1 = fully B
      let blend;
      if (direction === 'horizontal') {
        blend = x / (TILE_SIZE - 1);
      } else {
        blend = y / (TILE_SIZE - 1);
      }

      // Add dithered noise at the transition edge
      const noise = seededRandom(x, y, 55) * 0.3 - 0.15;
      blend = Math.max(0, Math.min(1, blend + noise));

      // Dither: use Bayer matrix threshold
      const threshold = DITHER_MATRIX[y % 4][x % 4] / 16;
      const useB = blend > threshold;

      const src = useB ? dataB : dataA;
      out.data[i] = src.data[i];
      out.data[i + 1] = src.data[i + 1];
      out.data[i + 2] = src.data[i + 2];
      out.data[i + 3] = src.data[i + 3];
    }
  }

  ctx.putImageData(out, 0, 0);
}

function drawCobblestoneToGrassH(ctx) {
  drawTransitionTile(ctx, drawCobblestone, drawGrass, 'horizontal');
}

function drawCobblestoneToGrassV(ctx) {
  drawTransitionTile(ctx, drawCobblestone, drawGrass, 'vertical');
}

function drawCobblestoneToDirtH(ctx) {
  drawTransitionTile(ctx, drawCobblestone, drawDirtPath, 'horizontal');
}

function drawCobblestoneToDirtV(ctx) {
  drawTransitionTile(ctx, drawCobblestone, drawDirtPath, 'vertical');
}

// New transition pairs
function drawGrassToSandH(ctx) {
  drawTransitionTile(ctx, drawGrass, drawDirtPath, 'horizontal');
}
function drawGrassToSandV(ctx) {
  drawTransitionTile(ctx, drawGrass, drawDirtPath, 'vertical');
}
function drawDirtToGrassH(ctx) {
  drawTransitionTile(ctx, drawDirtPath, drawGrass, 'horizontal');
}
function drawDirtToGrassV(ctx) {
  drawTransitionTile(ctx, drawDirtPath, drawGrass, 'vertical');
}
function drawCobblestoneToWaterH(ctx) {
  drawTransitionTile(ctx, drawCobblestone, drawWater, 'horizontal');
}
function drawCobblestoneToWaterV(ctx) {
  drawTransitionTile(ctx, drawCobblestone, drawWater, 'vertical');
}
function drawFortressToCobbH(ctx) {
  drawTransitionTile(ctx, drawFortressStone, drawCobblestone, 'horizontal');
}
function drawFortressToCobbV(ctx) {
  drawTransitionTile(ctx, drawFortressStone, drawCobblestone, 'vertical');
}

// ====================
// ANIMATED WATER - 4 frames with shifted wave phase
// ====================
function drawWaterFrame(ctx, phase) {
  const w = PALETTE.water;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const wave1 = Math.sin((x + y) * 0.3 + phase * 2.1) * 0.5;
      const wave2 = Math.sin((x - y) * 0.2 + 1 + phase * 1.4) * 0.3;
      const combined = wave1 + wave2;

      let shade = 3 + combined * 2;
      shade += seededRandom(x, y, 88 + phase) * 0.5;

      // Subtle depth gradient: darker at tile edges, lighter at center
      if (x < 4 || x > 28 || y < 4 || y > 28) {
        shade -= 0.5;
      } else if (x >= 12 && x <= 20 && y >= 12 && y <= 20) {
        shade += 0.3;
      }

      shade = Math.max(0, Math.min(7, shade));
      setPixel(ctx, x, y, getShade(w, shade, x, y));
    }
  }

  // Shifting specular highlights based on phase
  const baseHighlights = [[8, 6], [20, 14], [12, 22], [26, 8]];
  baseHighlights.forEach(([hx, hy]) => {
    const px = (hx + phase * 3) % TILE_SIZE;
    const py = (hy + phase * 2) % TILE_SIZE;
    setPixel(ctx, px, py, '#6A8AAA');
    if (px + 1 < TILE_SIZE) setPixel(ctx, px + 1, py, '#5A7A9A');
  });

  // Caustic light patterns: 4-6 specular pixels per frame at seeded positions that shift between frames
  const numCaustics = 4 + Math.floor(seededRandom(phase, 0, 200) * 3); // 4-6 caustics
  for (let c = 0; c < numCaustics; c++) {
    const cx = Math.floor(seededRandom(c, phase, 210) * (TILE_SIZE - 2)) + 1;
    const cy = Math.floor(seededRandom(phase, c, 220) * (TILE_SIZE - 2)) + 1;
    setPixel(ctx, cx, cy, PALETTE.specular[2]);
  }

  // Foam
  const foamX = (5 + phase * 7) % TILE_SIZE;
  const foamY = (12 + phase * 5) % TILE_SIZE;
  setPixel(ctx, foamX, foamY, w[6]);
}

function drawWaterFrame0(ctx) { drawWaterFrame(ctx, 0); }
function drawWaterFrame1(ctx) { drawWaterFrame(ctx, 1); }
function drawWaterFrame2(ctx) { drawWaterFrame(ctx, 2); }
function drawWaterFrame3(ctx) { drawWaterFrame(ctx, 3); }

// ====================
// LATERITE STONE - A Famosa fortress (reddish-brown, NOT grey)
// ====================
function drawLateriteStone(ctx) {
  // Mix of warmStone and terracotta for reddish-brown tropical stone
  const p = PALETTE.warmStone;
  const t = PALETTE.terracotta;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let shade = 4;
      if (y < 3) shade = 6 - y * 0.5;
      else if (x < 3) shade = 5 - x * 0.3;
      else if (y > TILE_SIZE - 4) shade = 2 + (TILE_SIZE - y) * 0.3;
      else if (x > TILE_SIZE - 4) shade = 1.5 + (TILE_SIZE - x) * 0.3;

      const noise = seededRandom(x, y, 33) * 0.8;
      shade += noise - 0.4;

      if (seededRandom(x * 2, y * 2, 55) > 0.95) shade -= 1.5;
      shade = Math.max(0, Math.min(7, shade));

      // Blend warmStone and terracotta for laterite look
      const useTerracotta = seededRandom(x, y, 77) > 0.5;
      const palette = useTerracotta ? t : p;
      setPixel(ctx, x, y, getShade(palette, shade, x, y));
    }
  }

  // Carved edge detail
  for (let i = 2; i < TILE_SIZE - 2; i++) {
    setPixel(ctx, i, 2, lerpColor(p[6], t[6], 0.5));
    setPixel(ctx, 2, i, lerpColor(p[5], t[5], 0.5));
    setPixel(ctx, i, TILE_SIZE - 3, lerpColor(p[1], t[1], 0.5));
    setPixel(ctx, TILE_SIZE - 3, i, lerpColor(p[1], t[1], 0.5));
  }
}

// Legacy support functions (scaled from 32 to 16)
function createLegacyTile(drawFunc) {
  const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawFunc(ctx);
  return canvas;
}

module.exports = {
  TILE_SIZE,
  setPixel,
  seededRandom,
  getShade,
  drawWithVariant,
  drawCobblestone,
  drawGrass,
  drawFortressStone,
  drawWater,
  drawDockWood,
  drawWhitewashWall,
  drawTerracottaRoof,
  drawDirtPath,
  drawThatchRoof,
  drawBambooFloor,
  drawChurchFloor,
  drawChurchStone,
  // Cobblestone variants
  drawCobblestoneV1,
  drawCobblestoneV2,
  drawCobblestoneV3,
  // Tile variants (Phase 2)
  drawGrassV1,
  drawGrassV2,
  drawFortressStoneV1,
  drawFortressStoneV2,
  drawWhitewashWallV1,
  drawWhitewashWallV2,
  drawDirtPathV1,
  drawDirtPathV2,
  drawDockWoodV1,
  drawDockWoodV2,
  drawChurchFloorV1,
  drawChurchFloorV2,
  // Transitions
  drawCobblestoneToGrassH,
  drawCobblestoneToGrassV,
  drawCobblestoneToDirtH,
  drawCobblestoneToDirtV,
  // New transition pairs (Phase 2)
  drawGrassToSandH,
  drawGrassToSandV,
  drawDirtToGrassH,
  drawDirtToGrassV,
  drawCobblestoneToWaterH,
  drawCobblestoneToWaterV,
  drawFortressToCobbH,
  drawFortressToCobbV,
  // Animated water (4-frame cycle)
  drawWaterFrame0,
  drawWaterFrame1,
  drawWaterFrame2,
  drawWaterFrame3,
  // Laterite (historical correction)
  drawLateriteStone,
};
