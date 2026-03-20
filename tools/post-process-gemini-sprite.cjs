#!/usr/bin/env node
/**
 * post-process-gemini-sprite.cjs
 *
 * Takes a raw Gemini 1024x1024 output PNG and makes it spec-compliant
 * for the game's pixel-art pipeline:
 *   1. Detect content bounding box (alpha > 10)
 *   2. Crop to content + 2 px padding
 *   3. Resize to target dimensions (default 16x32) with nearest-neighbor
 *   4. Snap alpha: < 128 -> 0, >= 128 -> 255
 *   5. Quantize every opaque pixel to nearest Ultima 8 palette color
 *   6. Apply 1 px dark outline on silhouette edge (optional)
 *   7. Save as PNG
 *
 * Usage:
 *   node tools/post-process-gemini-sprite.cjs <input.png> <output.png> [options]
 *
 * Options:
 *   --width  W       Target width  (default 16)
 *   --height H       Target height (default 32)
 *   --no-outline     Skip the 1 px silhouette outline pass
 *   --help           Show this help message
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const { PALETTE, nearestPaletteColor, hexToRgb, getAllPaletteColors } = require('./ultima8-graphics/palette.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`
post-process-gemini-sprite.cjs

Converts a raw Gemini 1024x1024 PNG into a spec-compliant pixel-art sprite
quantized to the Ultima 8 palette.

Usage:
  node tools/post-process-gemini-sprite.cjs <input.png> <output.png> [options]

Arguments:
  input.png          Path to the source image (any resolution)
  output.png         Path where the processed sprite will be saved

Options:
  --width  W         Target sprite width  in pixels (default: 16)
  --height H         Target sprite height in pixels (default: 32)
  --no-outline       Skip the 1 px dark silhouette outline pass
  --help, -h         Show this help message and exit

Examples:
  node tools/post-process-gemini-sprite.cjs raw.png player.png
  node tools/post-process-gemini-sprite.cjs raw.png npc.png --width 16 --height 32
  node tools/post-process-gemini-sprite.cjs raw.png icon.png --width 16 --height 16 --no-outline
`.trim());
}

function parseArgs(argv) {
  const args = argv.slice(2); // strip node + script
  const opts = {
    input: null,
    output: null,
    width: 16,
    height: 32,
    outline: true,
    help: false,
  };

  const positional = [];
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--help' || a === '-h') {
      opts.help = true;
      i++;
    } else if (a === '--no-outline') {
      opts.outline = false;
      i++;
    } else if (a === '--width') {
      i++;
      if (i >= args.length) { console.error('Error: --width requires a value'); process.exit(1); }
      opts.width = parseInt(args[i], 10);
      if (isNaN(opts.width) || opts.width < 1) { console.error('Error: --width must be a positive integer'); process.exit(1); }
      i++;
    } else if (a === '--height') {
      i++;
      if (i >= args.length) { console.error('Error: --height requires a value'); process.exit(1); }
      opts.height = parseInt(args[i], 10);
      if (isNaN(opts.height) || opts.height < 1) { console.error('Error: --height must be a positive integer'); process.exit(1); }
      i++;
    } else if (a.startsWith('-')) {
      console.error(`Error: Unknown option "${a}". Use --help for usage.`);
      process.exit(1);
    } else {
      positional.push(a);
      i++;
    }
  }

  if (opts.help) return opts;

  if (positional.length < 2) {
    console.error('Error: Both <input.png> and <output.png> are required.');
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  opts.input = path.resolve(positional[0]);
  opts.output = path.resolve(positional[1]);
  return opts;
}

// ---------------------------------------------------------------------------
// Pre-build a flat lookup table of palette RGB values for fast quantization
// ---------------------------------------------------------------------------

let _paletteRgbCache = null;

function getPaletteRgbTable() {
  if (_paletteRgbCache) return _paletteRgbCache;
  _paletteRgbCache = getAllPaletteColors(); // [{hex, r, g, b}, ...]
  return _paletteRgbCache;
}

/** Find nearest palette color by Euclidean distance in RGB space (fast path). */
function quantizePixel(r, g, b) {
  const table = getPaletteRgbTable();
  let bestDist = Infinity;
  let bestR = r, bestG = g, bestB = b;
  for (let i = 0; i < table.length; i++) {
    const c = table[i];
    const dr = c.r - r;
    const dg = c.g - g;
    const db = c.b - b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestR = c.r;
      bestG = c.g;
      bestB = c.b;
      if (dist === 0) break; // exact match
    }
  }
  return { r: bestR, g: bestG, b: bestB };
}

// ---------------------------------------------------------------------------
// Image processing pipeline
// ---------------------------------------------------------------------------

/**
 * Step 1 -- Detect content bounding box (pixels with alpha > threshold).
 * Returns { x, y, w, h } or null if image is fully transparent.
 */
function detectBoundingBox(imageData, width, height, alphaThreshold = 10) {
  const data = imageData.data;
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null; // fully transparent

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Step 6 -- Snap alpha channel: < 128 -> 0, >= 128 -> 255
 */
function snapAlpha(imageData) {
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i] < 128 ? 0 : 255;
  }
}

/**
 * Step 7 -- Quantize each opaque pixel to nearest Ultima 8 palette color.
 */
function quantizeToPalette(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // skip transparent
    const q = quantizePixel(data[i], data[i + 1], data[i + 2]);
    data[i]     = q.r;
    data[i + 1] = q.g;
    data[i + 2] = q.b;
  }
}

/**
 * Step 8 -- Apply 1 px dark outline.
 * Any transparent pixel that is 4-directionally adjacent to an opaque pixel
 * gets filled with the shadow outline color.
 */
function applyOutline(imageData, width, height) {
  const outlineHex = PALETTE.shadow[1]; // '#050505'
  const outlineRgb = hexToRgb(outlineHex);
  if (!outlineRgb) {
    console.warn('Warning: Could not parse outline color, skipping outline pass.');
    return;
  }

  const data = imageData.data;

  // Build a boolean alpha map (true = opaque)
  const opaque = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      opaque[y * width + x] = data[idx + 3] > 0 ? 1 : 0;
    }
  }

  // Collect outline pixel positions (transparent pixels adjacent to opaque)
  const outlinePixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (opaque[y * width + x]) continue; // already opaque
      // Check 4 neighbors
      const hasOpaqueNeighbor =
        (x > 0          && opaque[y * width + (x - 1)]) ||
        (x < width - 1  && opaque[y * width + (x + 1)]) ||
        (y > 0          && opaque[(y - 1) * width + x]) ||
        (y < height - 1 && opaque[(y + 1) * width + x]);
      if (hasOpaqueNeighbor) {
        outlinePixels.push({ x, y });
      }
    }
  }

  // Write outline pixels
  for (const p of outlinePixels) {
    const idx = (p.y * width + p.x) * 4;
    data[idx]     = outlineRgb.r;
    data[idx + 1] = outlineRgb.g;
    data[idx + 2] = outlineRgb.b;
    data[idx + 3] = 255;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printUsage();
    process.exit(0);
  }

  // Validate input file
  if (!fs.existsSync(opts.input)) {
    console.error(`Error: Input file not found: ${opts.input}`);
    process.exit(1);
  }

  const targetW = opts.width;
  const targetH = opts.height;

  console.log(`[post-process] Input:  ${opts.input}`);
  console.log(`[post-process] Output: ${opts.output}`);
  console.log(`[post-process] Target: ${targetW}x${targetH}  outline=${opts.outline}`);

  // ---- Load image ----
  const img = await loadImage(opts.input);
  const srcW = img.width;
  const srcH = img.height;
  console.log(`[post-process] Source size: ${srcW}x${srcH}`);

  // Draw source image onto a canvas to get raw pixel data
  const srcCanvas = createCanvas(srcW, srcH);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(img, 0, 0);
  const srcImageData = srcCtx.getImageData(0, 0, srcW, srcH);

  // ---- Step 1: Detect bounding box ----
  const bbox = detectBoundingBox(srcImageData, srcW, srcH, 10);
  if (!bbox) {
    console.error('Error: Input image is fully transparent -- nothing to process.');
    process.exit(1);
  }
  console.log(`[post-process] Content bounds: x=${bbox.x} y=${bbox.y} w=${bbox.w} h=${bbox.h}`);

  // ---- Step 2: Crop to content + 2 px padding ----
  const pad = 2;
  const cropX = Math.max(0, bbox.x - pad);
  const cropY = Math.max(0, bbox.y - pad);
  const cropW = Math.min(srcW - cropX, bbox.w + pad * 2);
  const cropH = Math.min(srcH - cropY, bbox.h + pad * 2);

  const cropCanvas = createCanvas(cropW, cropH);
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  console.log(`[post-process] Cropped: ${cropW}x${cropH} (with ${pad}px padding)`);

  // ---- Step 3: Resize to target with nearest-neighbor ----
  const outCanvas = createCanvas(targetW, targetH);
  const outCtx = outCanvas.getContext('2d');
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(cropCanvas, 0, 0, targetW, targetH);

  // Get the pixel data of the resized image
  const outImageData = outCtx.getImageData(0, 0, targetW, targetH);

  // ---- Step 4: Snap alpha ----
  snapAlpha(outImageData);

  // ---- Step 5: Quantize to palette ----
  quantizeToPalette(outImageData);

  // ---- Step 6: Apply outline (unless --no-outline) ----
  if (opts.outline) {
    applyOutline(outImageData, targetW, targetH);
  }

  // Write processed data back to canvas
  outCtx.putImageData(outImageData, 0, 0);

  // ---- Step 7: Save ----
  const outDir = path.dirname(opts.output);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const buffer = outCanvas.toBuffer('image/png');
  fs.writeFileSync(opts.output, buffer);

  // Summary
  const sizeKB = (buffer.length / 1024).toFixed(1);
  console.log(`[post-process] Saved ${opts.output} (${targetW}x${targetH}, ${sizeKB} KB)`);
  console.log('[post-process] Done.');
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
