/**
 * Convert Tiled Orthogonal Map to Isometric
 *
 * Transforms a Tiled JSON map from orthogonal (16×16) to isometric (64×32):
 * - Changes orientation to "isometric"
 * - Updates tile dimensions to 64×32
 * - Points tileset images to iso/ variants
 * - Keeps tile layer data arrays unchanged (same IDs, same layout)
 *
 * Usage: node tools/convert-map-to-iso.cjs [mapName]
 *        Defaults to "a-famosa-gate".
 */

const fs = require('fs');
const path = require('path');

const MAPS_DIR = path.join(__dirname, '..', 'assets', 'maps');
const ISO_TILE_WIDTH = 64;
const ISO_TILE_HEIGHT = 32;

function convertMap(mapName) {
  const srcPath = path.join(MAPS_DIR, `${mapName}.json`);
  const outPath = path.join(MAPS_DIR, `${mapName}-iso.json`);

  if (!fs.existsSync(srcPath)) {
    console.error(`Source map not found: ${srcPath}`);
    process.exit(1);
  }

  const map = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

  console.log(`Converting: ${mapName}`);
  console.log(`  Original: ${map.orientation} ${map.tilewidth}×${map.tileheight}, ${map.width}×${map.height} tiles`);

  // Change orientation
  map.orientation = 'isometric';
  map.tilewidth = ISO_TILE_WIDTH;
  map.tileheight = ISO_TILE_HEIGHT;

  // Update tileset entries to point to iso tile sprites
  map.tilesets = map.tilesets.map((ts) => ({
    ...ts,
    image: ts.image
      .replace('../sprites/tiles/', '../sprites/tiles/iso/')
      .replace('.png', '-iso.png'),
    imagewidth: ISO_TILE_WIDTH,
    imageheight: ISO_TILE_HEIGHT,
    tilewidth: ISO_TILE_WIDTH,
    tileheight: ISO_TILE_HEIGHT,
  }));

  // Layer data stays unchanged — same tile IDs, same grid layout.
  // Phaser's isometric renderer handles the diamond positioning.

  console.log(`  Converted: isometric ${ISO_TILE_WIDTH}×${ISO_TILE_HEIGHT}, ${map.width}×${map.height} tiles`);

  fs.writeFileSync(outPath, JSON.stringify(map, null, 2));
  console.log(`  Output: ${outPath}`);
}

const mapName = process.argv[2] || 'a-famosa-gate';
convertMap(mapName);
console.log('\nDone!');
