/**
 * Generate Isometric Tile Sprites
 *
 * Reads flat tile PNGs and renders them onto 64×32 canvases
 * using an isometric diamond transform.
 * Output: assets/sprites/tiles/iso/{name}-iso.png
 *
 * Uses Python/PIL for image processing (more reliable PNG support).
 *
 * Usage: node tools/generate-iso-tiles.cjs [tile1 tile2 ...]
 *        Defaults to the 4 tilesets used by a-famosa-gate.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'tiles');
const OUT_DIR = path.join(SRC_DIR, 'iso');
const ISO_WIDTH = 64;
const ISO_HEIGHT = 32;
const SRC_SIZE = 16;

// Auto-discover all tile PNGs in the source directory (excluding iso/ subfolder and animated tiles)
function discoverTiles() {
  const files = fs.readdirSync(SRC_DIR).filter(f => {
    return f.endsWith('.png') && !f.includes('-iso') && !f.includes('-animated');
  });
  return files.map(f => f.replace('.png', ''));
}

function main() {
  const tiles = process.argv.length > 2 ? process.argv.slice(2) : discoverTiles();

  console.log('Generating isometric tile sprites...');
  console.log(`  Source: ${SRC_DIR}`);
  console.log(`  Output: ${OUT_DIR}`);
  console.log(`  Tiles:  ${tiles.join(', ')}\n`);

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // Write a temporary Python script to disk, then execute it
  const pyScript = `
import sys, os
from PIL import Image, ImageDraw
import numpy as np

SRC_DIR = ${JSON.stringify(SRC_DIR)}
OUT_DIR = ${JSON.stringify(OUT_DIR)}
SRC_SIZE = ${SRC_SIZE}
ISO_W = ${ISO_WIDTH}
ISO_H = ${ISO_HEIGHT}
tiles = ${JSON.stringify(tiles)}

generated = 0
for tile_name in tiles:
    src_path = os.path.join(SRC_DIR, f"{tile_name}.png")
    out_path = os.path.join(OUT_DIR, f"{tile_name}-iso.png")

    if not os.path.exists(src_path):
        print(f"  SKIP: {tile_name} - not found")
        continue

    try:
        img = Image.open(src_path)
        img.load()
        img = img.convert("RGBA")
    except Exception as e:
        print(f"  FAIL: {tile_name} - {e}")
        continue

    # Sample center 16x16 if larger
    if img.width > SRC_SIZE or img.height > SRC_SIZE:
        cx = (img.width - SRC_SIZE) // 2
        cy = (img.height - SRC_SIZE) // 2
        img = img.crop((cx, cy, cx + SRC_SIZE, cy + SRC_SIZE))
    elif img.width < SRC_SIZE or img.height < SRC_SIZE:
        img = img.resize((SRC_SIZE, SRC_SIZE), Image.NEAREST)

    # Create output image with transparency
    iso_arr = np.zeros((ISO_H, ISO_W, 4), dtype=np.uint8)

    # Create diamond mask
    mask = Image.new("L", (ISO_W, ISO_H), 0)
    mask_draw = ImageDraw.Draw(mask)
    diamond = [
        (ISO_W // 2, 0),       # top
        (ISO_W, ISO_H // 2),   # right
        (ISO_W // 2, ISO_H),   # bottom
        (0, ISO_H // 2),       # left
    ]
    mask_draw.polygon(diamond, fill=255)
    mask_arr = np.array(mask)

    # For each pixel in the output, reverse-map to source coordinates.
    # Isometric transform: x' = 2*sx - 2*sy + 32, y' = sx + sy
    # Inverse: sx = (x' - 32 + 2*y') / 4, sy = (2*y' - x' + 32) / 4
    src_arr = np.array(img)

    for oy in range(ISO_H):
        for ox in range(ISO_W):
            if mask_arr[oy, ox] == 0:
                continue
            sx = (ox - 32 + 2 * oy) / 4.0
            sy = (2 * oy - ox + 32) / 4.0
            si = int(sx) % SRC_SIZE
            sj = int(sy) % SRC_SIZE
            if 0 <= si < SRC_SIZE and 0 <= sj < SRC_SIZE:
                iso_arr[oy, ox] = src_arr[sj, si]

    # Perspective shading: simulate 3/4 view lighting
    # Top half of diamond: brighten by 5%, bottom half: darken by 8%
    for oy in range(ISO_H):
        for ox in range(ISO_W):
            if iso_arr[oy, ox, 3] == 0:
                continue
            if oy < ISO_H / 2:
                # Top half: brighten by 5%
                for ch in range(3):
                    iso_arr[oy, ox, ch] = min(255, int(iso_arr[oy, ox, ch] * 1.05))
            else:
                # Bottom half: darken by 8%
                for ch in range(3):
                    iso_arr[oy, ox, ch] = int(iso_arr[oy, ox, ch] * 0.92)

    iso = Image.fromarray(iso_arr)
    iso.save(out_path)
    generated += 1
    print(f"  OK: {tile_name} ({img.width}x{img.height} -> {ISO_W}x{ISO_H}) -> {os.path.basename(out_path)}")

print(f"\\nDone! Generated {generated}/{len(tiles)} isometric tiles.")
`;

  const tmpScript = path.join(__dirname, '_generate_iso_tiles_tmp.py');
  try {
    fs.writeFileSync(tmpScript, pyScript);
    const output = execFileSync('python3', [tmpScript], { encoding: 'utf8' });
    console.log(output);
  } catch (err) {
    console.error('Python script failed:', err.stderr || err.message);
    process.exit(1);
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpScript); } catch (_) { /* ignore */ }
  }
}

main();
