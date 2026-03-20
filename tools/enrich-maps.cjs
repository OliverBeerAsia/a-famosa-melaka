#!/usr/bin/env node
/**
 * Map Enrichment Tool
 *
 * Adds tile variety (cobblestone variants, transition tiles) and
 * environmental storytelling objects to the 5 location maps.
 *
 * Usage: node tools/enrich-maps.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const MAPS_DIR = path.join(__dirname, '..', 'assets', 'maps');
const dryRun = process.argv.includes('--dry-run');

function loadMap(name) {
  const p = path.join(MAPS_DIR, `${name}-iso.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveMap(name, data) {
  const p = path.join(MAPS_DIR, `${name}-iso.json`);
  if (dryRun) {
    console.log(`  [dry-run] Would save ${p}`);
    return;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  console.log(`  Saved ${path.basename(p)}`);
}

// Simple seeded random for reproducible tile placement
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Find the highest firstgid in existing tilesets
 */
function maxFirstGid(map) {
  let max = 0;
  map.tilesets.forEach((ts) => {
    if (ts.firstgid > max) max = ts.firstgid;
  });
  return max;
}

/**
 * Add a tileset to the map if not already present
 */
function addTileset(map, gid, imageName, tileW, tileH, props) {
  const existing = map.tilesets.find(
    (ts) => ts.image && ts.image.includes(imageName)
  );
  if (existing) return existing.firstgid;

  const ts = {
    columns: 1,
    firstgid: gid,
    image: `../sprites/tiles/iso/${imageName}`,
    imageheight: tileH || 32,
    imagewidth: tileW || 64,
    margin: 0,
    name: imageName.replace('-iso.png', ''),
    spacing: 0,
    tilecount: 1,
    tileheight: tileH || 32,
    tilewidth: tileW || 64,
  };
  if (props) {
    ts.tiles = [{ id: 0, properties: props }];
  }
  map.tilesets.push(ts);
  return gid;
}

/**
 * Add an object to the Objects layer
 */
function addObject(map, obj) {
  const objectsLayer = map.layers.find((l) => l.name === 'Objects');
  if (!objectsLayer) return;

  // Generate unique ID
  let maxId = 0;
  objectsLayer.objects.forEach((o) => {
    if (o.id > maxId) maxId = o.id;
  });

  objectsLayer.objects.push({
    gid: obj.gid,
    height: obj.height || 16,
    id: maxId + 1,
    name: obj.name,
    rotation: 0,
    type: obj.type || '',
    visible: true,
    width: obj.width || 16,
    x: obj.x,
    y: obj.y,
  });
}

/**
 * Replace some ground tiles with variants for visual variety
 */
function addTileVariety(map, targetGid, variantGids, frequency, seed) {
  const groundLayer = map.layers.find((l) => l.name === 'Ground');
  if (!groundLayer) return;

  const rng = seededRandom(seed);
  let replaced = 0;

  for (let i = 0; i < groundLayer.data.length; i++) {
    if (groundLayer.data[i] === targetGid && rng() < frequency) {
      const variantIdx = Math.floor(rng() * variantGids.length);
      groundLayer.data[i] = variantGids[variantIdx];
      replaced++;
    }
  }

  return replaced;
}

// ============================================================
// ENRICH A FAMOSA GATE
// ============================================================
function enrichAFamosa() {
  console.log('\nA Famosa Gate:');
  const map = loadMap('a-famosa-gate');
  let nextGid = maxFirstGid(map) + 1;

  // Add laterite stone tileset (historical correction)
  const lateriteGid = addTileset(
    map,
    nextGid++,
    'laterite-stone-iso.png',
    64,
    32
  );

  // Add cobblestone variants
  const cobV1Gid = addTileset(map, nextGid++, 'cobblestone-v1-iso.png', 64, 32);
  const cobV2Gid = addTileset(map, nextGid++, 'cobblestone-v2-iso.png', 64, 32);
  const cobV3Gid = addTileset(map, nextGid++, 'cobblestone-v3-iso.png', 64, 32);

  // Replace some fortress-stone (gid 1) with laterite
  const groundLayer = map.layers.find((l) => l.name === 'Ground');
  const wallsLayer = map.layers.find((l) => l.name === 'Walls');

  // Replace fortress-stone wall tiles with laterite in Walls layer
  if (wallsLayer) {
    let lateriteCount = 0;
    for (let i = 0; i < wallsLayer.data.length; i++) {
      if (wallsLayer.data[i] === 1) {
        wallsLayer.data[i] = lateriteGid;
        lateriteCount++;
      }
    }
    console.log(`  Replaced ${lateriteCount} fortress-stone wall tiles with laterite`);
  }

  // Add cobblestone variety to ground
  const cobReplaced = addTileVariety(
    map,
    3,
    [cobV1Gid, cobV2Gid, cobV3Gid],
    0.3,
    42
  );
  console.log(`  Added ${cobReplaced} cobblestone variants`);

  // Add environmental objects
  const cannonGid = nextGid++;
  addTileset(map, cannonGid, 'cannon-iso.png', 64, 32);

  // Cannons on fortress walls
  addObject(map, {
    gid: cannonGid, name: 'cannon', x: 640, y: 128,
    width: 32, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: cannonGid, name: 'cannon', x: 960, y: 128,
    width: 32, height: 16, type: 'decoration',
  });

  // Extra barrels near gate (supplies)
  addObject(map, {
    gid: 21, name: 'barrel', x: 1100, y: 480,
    width: 16, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 21, name: 'barrel', x: 1120, y: 500,
    width: 16, height: 16, type: 'decoration',
  });

  // Crates near sentry post
  addObject(map, {
    gid: 22, name: 'crate', x: 1150, y: 460,
    width: 16, height: 16, type: 'decoration',
  });

  console.log('  Added 5 environmental objects (cannons, barrels, crates)');
  saveMap('a-famosa-gate', map);
}

// ============================================================
// ENRICH RUA DIREITA
// ============================================================
function enrichRuaDireita() {
  console.log('\nRua Direita:');
  const map = loadMap('rua-direita');
  let nextGid = maxFirstGid(map) + 1;

  // Add cobblestone variants
  const cobV1Gid = addTileset(map, nextGid++, 'cobblestone-v1-iso.png', 64, 32);
  const cobV2Gid = addTileset(map, nextGid++, 'cobblestone-v2-iso.png', 64, 32);
  const cobV3Gid = addTileset(map, nextGid++, 'cobblestone-v3-iso.png', 64, 32);

  // Add transition tile
  const transGid = addTileset(map, nextGid++, 'cobblestone-grass-h-iso.png', 64, 32);

  // Cobblestone variety
  const cobReplaced = addTileVariety(
    map,
    3,
    [cobV1Gid, cobV2Gid, cobV3Gid],
    0.25,
    77
  );
  console.log(`  Added ${cobReplaced} cobblestone variants`);

  // Add transition tiles at cobblestone/grass borders
  const ground = map.layers.find((l) => l.name === 'Ground');
  let transCount = 0;
  if (ground) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width - 1; x++) {
        const idx = y * map.width + x;
        const curr = ground.data[idx];
        const next = ground.data[idx + 1];
        // Place transition where cobblestone meets grass
        if (
          (curr === 3 && next === 2) ||
          ([cobV1Gid, cobV2Gid, cobV3Gid].includes(curr) && next === 2)
        ) {
          ground.data[idx] = transGid;
          transCount++;
        }
      }
    }
  }
  console.log(`  Added ${transCount} transition tiles`);

  // Add new objects: betel vendor, tin ingot display, extra stalls
  addObject(map, {
    gid: 32, name: 'spice-pile', x: 800, y: 400,
    width: 16, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 32, name: 'spice-pile', x: 850, y: 420,
    width: 16, height: 16, type: 'decoration',
  });

  // Lanterns along the street
  addObject(map, {
    gid: 35, name: 'lantern', x: 500, y: 320,
    width: 8, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 35, name: 'lantern', x: 700, y: 320,
    width: 8, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 35, name: 'lantern', x: 900, y: 320,
    width: 8, height: 16, type: 'decoration',
  });

  console.log('  Added 5 environmental objects (spice piles, lanterns)');
  saveMap('rua-direita', map);
}

// ============================================================
// ENRICH ST PAUL'S CHURCH
// ============================================================
function enrichStPauls() {
  console.log("\nSt. Paul's Church:");
  const map = loadMap('st-pauls-church');
  let nextGid = maxFirstGid(map) + 1;

  // Add transition tiles at church/grass border
  const transGid = addTileset(map, nextGid++, 'cobblestone-grass-v-iso.png', 64, 32);

  // Add a few transition tiles
  const ground = map.layers.find((l) => l.name === 'Ground');
  let transCount = 0;
  if (ground) {
    for (let y = 0; y < map.height - 1; y++) {
      for (let x = 0; x < map.width; x++) {
        const idx = y * map.width + x;
        const below = (y + 1) * map.width + x;
        if (ground.data[idx] === 10 && ground.data[below] === 2) {
          ground.data[below] = transGid;
          transCount++;
        }
      }
    }
  }
  console.log(`  Added ${transCount} transition tiles`);

  // Add extra gravestones and objects for environmental storytelling
  addObject(map, {
    gid: 40, name: 'gravestone', x: 350, y: 600,
    width: 16, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 40, name: 'gravestone', x: 400, y: 620,
    width: 16, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 40, name: 'gravestone', x: 320, y: 640,
    width: 16, height: 16, type: 'decoration',
  });

  // Flowers near graves
  addObject(map, {
    gid: 25, name: 'flowers', x: 360, y: 620,
    width: 16, height: 16, type: 'decoration',
  });

  // Extra palm tree on hill
  addObject(map, {
    gid: 20, name: 'palm-tree', x: 200, y: 300,
    width: 16, height: 32, type: 'decoration',
  });

  console.log('  Added 5 environmental objects (gravestones, flowers, palm)');
  saveMap('st-pauls-church', map);
}

// ============================================================
// ENRICH WATERFRONT
// ============================================================
function enrichWaterfront() {
  console.log('\nWaterfront:');
  const map = loadMap('waterfront');
  let nextGid = maxFirstGid(map) + 1;

  // Add cobblestone variants for the dock area
  const cobV1Gid = addTileset(map, nextGid++, 'cobblestone-v1-iso.png', 64, 32);
  const cobV2Gid = addTileset(map, nextGid++, 'cobblestone-v2-iso.png', 64, 32);

  // Replace some cobblestone with variants
  const cobReplaced = addTileVariety(
    map,
    3,
    [cobV1Gid, cobV2Gid],
    0.2,
    99
  );
  console.log(`  Added ${cobReplaced} cobblestone variants`);

  // Add more cargo objects for busy harbor feel
  addObject(map, {
    gid: 52, name: 'cargo-crate', x: 600, y: 320,
    width: 16, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 52, name: 'cargo-crate', x: 620, y: 340,
    width: 16, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 52, name: 'cargo-crate', x: 610, y: 360,
    width: 16, height: 16, type: 'decoration',
  });

  // Rope coils on dock
  addObject(map, {
    gid: 54, name: 'rope-coil', x: 400, y: 380,
    width: 16, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 54, name: 'rope-coil', x: 800, y: 360,
    width: 16, height: 16, type: 'decoration',
  });

  // Additional fishing nets
  addObject(map, {
    gid: 55, name: 'fishing-net', x: 300, y: 420,
    width: 32, height: 16, type: 'decoration',
  });

  // Extra barrels
  addObject(map, {
    gid: 53, name: 'maritime-barrel', x: 500, y: 300,
    width: 16, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 53, name: 'maritime-barrel', x: 520, y: 310,
    width: 16, height: 16, type: 'decoration',
  });

  console.log('  Added 8 environmental objects (cargo, rope, nets, barrels)');
  saveMap('waterfront', map);
}

// ============================================================
// ENRICH KAMPUNG
// ============================================================
function enrichKampung() {
  console.log('\nKampung:');
  const map = loadMap('kampung');
  let nextGid = maxFirstGid(map) + 1;

  // Add cobblestone-dirt transition for path edges
  const transGid = addTileset(map, nextGid++, 'cobblestone-dirt-v-iso.png', 64, 32);

  // Transition tiles at dirt/grass borders
  const ground = map.layers.find((l) => l.name === 'Ground');
  let transCount = 0;
  if (ground) {
    for (let y = 0; y < map.height - 1; y++) {
      for (let x = 0; x < map.width; x++) {
        const idx = y * map.width + x;
        const below = (y + 1) * map.width + x;
        if (ground.data[idx] === 11 && ground.data[below] === 2) {
          ground.data[below] = transGid;
          transCount++;
        }
      }
    }
  }
  console.log(`  Added ${transCount} dirt-grass transition tiles`);

  // More cooking fires (village life)
  addObject(map, {
    gid: 62, name: 'cooking-fire', x: 500, y: 400,
    width: 16, height: 16, type: 'decoration',
  });

  // Extra woven mats (daily life)
  addObject(map, {
    gid: 63, name: 'woven-mat', x: 600, y: 350,
    width: 16, height: 16, type: 'decoration',
  });
  addObject(map, {
    gid: 63, name: 'woven-mat', x: 700, y: 380,
    width: 16, height: 16, type: 'decoration',
  });

  // More palm and banana trees (lush tropical feel)
  addObject(map, {
    gid: 60, name: 'banana-tree', x: 200, y: 300,
    width: 16, height: 32, type: 'decoration',
  });
  addObject(map, {
    gid: 60, name: 'banana-tree', x: 900, y: 400,
    width: 16, height: 32, type: 'decoration',
  });
  addObject(map, {
    gid: 20, name: 'palm-tree', x: 150, y: 250,
    width: 16, height: 32, type: 'decoration',
  });

  // Pottery (water storage)
  addObject(map, {
    gid: 23, name: 'pottery', x: 650, y: 320,
    width: 16, height: 16, type: 'decoration',
  });

  // Extra bamboo fences
  addObject(map, {
    gid: 64, name: 'bamboo-fence', x: 350, y: 450,
    width: 16, height: 16, type: 'decoration',
  });

  console.log('  Added 8 environmental objects (fire, mats, trees, pottery, fence)');
  saveMap('kampung', map);
}

// ============================================================
// MAIN
// ============================================================
console.log('Map Enrichment Tool');
console.log('=' .repeat(50));
if (dryRun) console.log('[DRY RUN MODE - no files will be modified]');

enrichAFamosa();
enrichRuaDireita();
enrichStPauls();
enrichWaterfront();
enrichKampung();

console.log('\n' + '='.repeat(50));
console.log('Done! All 5 maps enriched with tile variety and objects.');
