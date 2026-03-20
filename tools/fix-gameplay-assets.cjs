#!/usr/bin/env node

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const { nearestPaletteColor, hexToRgb, getAllPaletteColors } = require('./ultima8-graphics/palette.cjs');

const BASE = path.join(__dirname, '..', 'assets', 'sprites');

const DEFAULT_DIRS = [
  'characters',
  'tiles',
  'objects',
  'particles',
  'crowd',
];

const MAX_DIMENSION = 256;

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    dryRun: false,
    dir: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--dir') {
      args.dir = argv[++i] || null;
    } else if (arg.startsWith('--dir=')) {
      args.dir = arg.slice('--dir='.length) || null;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Directory walker — collect all .png files recursively
// ---------------------------------------------------------------------------

function walkPngs(dir) {
  const results = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkPngs(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      results.push(full);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Content bounding box — find the tightest rectangle around opaque pixels
// ---------------------------------------------------------------------------

function getContentBounds(imageData, width, height) {
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    // Fully transparent image — return original dimensions
    return { x: 0, y: 0, w: width, h: height };
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

// ---------------------------------------------------------------------------
// Nearest-neighbor downscale
// ---------------------------------------------------------------------------

function nearestNeighborScale(srcCanvas, dstWidth, dstHeight) {
  const srcCtx = srcCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const dst = createCanvas(dstWidth, dstHeight);
  const dstCtx = dst.getContext('2d');
  const dstData = dstCtx.createImageData(dstWidth, dstHeight);

  const xRatio = srcCanvas.width / dstWidth;
  const yRatio = srcCanvas.height / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * srcCanvas.width + srcX) * 4;
      const dstIdx = (y * dstWidth + x) * 4;
      dstData.data[dstIdx] = srcData.data[srcIdx];
      dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
      dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
      dstData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
    }
  }

  dstCtx.putImageData(dstData, 0, 0);
  return dst;
}

// ---------------------------------------------------------------------------
// Build a fast lookup cache from palette colors
// ---------------------------------------------------------------------------

function buildPaletteCache() {
  const colors = getAllPaletteColors();
  return colors.map((c) => ({ r: c.r, g: c.g, b: c.b, hex: c.hex }));
}

function findNearestCached(r, g, b, cache) {
  let bestDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < cache.length; i++) {
    const c = cache[i];
    const dist = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return cache[bestIdx];
}

// ---------------------------------------------------------------------------
// Process a single PNG file
// ---------------------------------------------------------------------------

async function processFile(filePath, dryRun, paletteCache) {
  const relPath = path.relative(path.join(__dirname, '..'), filePath);
  const changes = [];

  let img;
  try {
    img = await loadImage(filePath);
  } catch (err) {
    console.error(`  ERROR: could not load ${relPath}: ${err.message}`);
    return { file: relPath, changes: ['LOAD_ERROR'], error: true };
  }

  let width = img.width;
  let height = img.height;

  // Draw original image onto a canvas so we can read pixel data
  let canvas = createCanvas(width, height);
  let ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // -----------------------------------------------------------------------
  // Step (a): Check if oversized — crop to content bounding box + downscale
  // -----------------------------------------------------------------------
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const bounds = getContentBounds(imgData, width, height);

    // Crop to content bounding box
    const cropped = createCanvas(bounds.w, bounds.h);
    const croppedCtx = cropped.getContext('2d');
    croppedCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);

    let finalW = bounds.w;
    let finalH = bounds.h;

    // Downscale if still oversized after cropping
    if (finalW > MAX_DIMENSION || finalH > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / finalW, MAX_DIMENSION / finalH);
      finalW = Math.max(1, Math.floor(finalW * scale));
      finalH = Math.max(1, Math.floor(finalH * scale));
      canvas = nearestNeighborScale(cropped, finalW, finalH);
    } else {
      canvas = cropped;
    }

    width = canvas.width;
    height = canvas.height;
    ctx = canvas.getContext('2d');
    changes.push(`resized ${img.width}x${img.height} -> crop(${bounds.x},${bounds.y},${bounds.w},${bounds.h}) -> ${width}x${height}`);
  }

  // -----------------------------------------------------------------------
  // Step (b): Snap alpha and quantize colors
  // -----------------------------------------------------------------------
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let alphaSnapped = 0;
  let colorsQuantized = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Snap alpha
    const newAlpha = a < 128 ? 0 : 255;
    if (newAlpha !== a) {
      data[i + 3] = newAlpha;
      alphaSnapped++;
    }

    // Quantize opaque pixels to nearest palette color
    if (newAlpha === 255) {
      const nearest = findNearestCached(r, g, b, paletteCache);
      const nr = hexToRgb(nearest.hex);
      if (nr.r !== r || nr.g !== g || nr.b !== b) {
        data[i] = nr.r;
        data[i + 1] = nr.g;
        data[i + 2] = nr.b;
        colorsQuantized++;
      }
    } else {
      // Fully transparent pixels — zero out RGB to keep files clean
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }

  if (alphaSnapped > 0) {
    changes.push(`snapped ${alphaSnapped} pixels alpha to 0/255`);
  }
  if (colorsQuantized > 0) {
    changes.push(`quantized ${colorsQuantized} off-palette pixels`);
  }

  // -----------------------------------------------------------------------
  // Save if there were changes (and not a dry run)
  // -----------------------------------------------------------------------
  if (changes.length > 0) {
    if (!dryRun) {
      ctx.putImageData(imageData, 0, 0);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(filePath, buffer);
    }
    console.log(`  ${dryRun ? '[dry-run] ' : ''}${relPath}:`);
    for (const change of changes) {
      console.log(`    - ${change}`);
    }
  }

  return { file: relPath, changes, error: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node tools/fix-gameplay-assets.cjs [--dry-run] [--dir <specific-dir>]');
    console.log('');
    console.log('Walks gameplay asset directories and repairs common issues:');
    console.log('  - Crops and downscales oversized sprites (>256px) using nearest-neighbor');
    console.log('  - Snaps semi-transparent alpha to 0 or 255 (kills anti-aliasing)');
    console.log('  - Quantizes off-palette pixels to the nearest Ultima 8 palette color');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run   Report issues without modifying files');
    console.log('  --dir <dir> Process only a specific directory (relative to assets/sprites/)');
    console.log('  --help, -h  Show this help message');
    process.exit(0);
  }

  console.log(`fix-gameplay-assets${args.dryRun ? ' (DRY RUN)' : ''}`);
  console.log('='.repeat(50));

  // Determine which directories to scan
  let dirs;
  if (args.dir) {
    const resolved = path.isAbsolute(args.dir)
      ? args.dir
      : path.join(BASE, args.dir);
    if (!fs.existsSync(resolved)) {
      console.error(`Directory not found: ${resolved}`);
      process.exit(1);
    }
    dirs = [resolved];
  } else {
    dirs = DEFAULT_DIRS.map((d) => path.join(BASE, d));
  }

  // Pre-build the palette cache for fast nearest-color lookups
  const paletteCache = buildPaletteCache();
  console.log(`Palette cache: ${paletteCache.length} colors loaded`);
  console.log('');

  let totalFiles = 0;
  let totalFixed = 0;
  let totalErrors = 0;
  const allResults = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.log(`Skipping (not found): ${path.relative(path.join(__dirname, '..'), dir)}`);
      continue;
    }

    const dirRel = path.relative(path.join(__dirname, '..'), dir);
    const pngs = walkPngs(dir);

    if (pngs.length === 0) {
      console.log(`${dirRel}: no PNG files found`);
      continue;
    }

    console.log(`${dirRel}: ${pngs.length} PNG file(s)`);

    for (const png of pngs) {
      totalFiles++;
      const result = await processFile(png, args.dryRun, paletteCache);
      allResults.push(result);
      if (result.error) {
        totalErrors++;
      } else if (result.changes.length > 0) {
        totalFixed++;
      }
    }

    console.log('');
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log(`Files scanned:   ${totalFiles}`);
  console.log(`Files fixed:     ${totalFixed}`);
  console.log(`Files unchanged: ${totalFiles - totalFixed - totalErrors}`);
  console.log(`Errors:          ${totalErrors}`);

  if (args.dryRun && totalFixed > 0) {
    console.log('');
    console.log('Run without --dry-run to apply fixes.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
