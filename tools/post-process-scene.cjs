#!/usr/bin/env node
/**
 * post-process-scene.cjs
 *
 * Converts a raw raster image (e.g. a painterly Canva Magic Media export) into a
 * spec-compliant pixel-art SCENE PLATE for the game:
 *   1. Resize to target dimensions (default 960x540)
 *        - downscale uses area/bilinear sampling (preserves painterly detail),
 *          then quantization supplies the hard pixel-art edges
 *        - use --nearest to force nearest-neighbour resize instead
 *   2. Ordered (Bayer 8x8) dithering quantization to the locked Ultima-8 master
 *      palette — this is what turns smooth gradients into honest dithered ramps
 *      and guarantees palette compliance with no anti-aliasing.
 *   3. Force opaque alpha (scenes are full-frame backdrops).
 *   4. Save as PNG.
 *
 * Unlike post-process-gemini-sprite.cjs (flat nearest-colour, ≤16x32, cropped),
 * this operates at full scene scale and DITHERS, so it works on large painterly
 * sources without banding.
 *
 * Usage:
 *   node tools/post-process-scene.cjs <input.png> <output.png> [options]
 *
 * Options:
 *   --width  W       Target width  (default 960)
 *   --height H       Target height (default 540)
 *   --spread S       Dither spread in 0-255 RGB units (default 36). Higher =
 *                    more aggressive dithering between palette levels.
 *   --nearest        Use nearest-neighbour resize (for already-pixel sources)
 *   --no-dither      Plain nearest-colour quantization (debug/compare)
 *   --keep-alpha     Preserve source alpha instead of forcing opaque
 *   --help           Show this help
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const { getAllPaletteColors } = require('./ultima8-graphics/palette.cjs');

// --- 8x8 Bayer ordered-dither matrix, normalised to [-0.5, 0.5] ------------
const BAYER8 = [
  [ 0, 32,  8, 40,  2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44,  4, 36, 14, 46,  6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [ 3, 35, 11, 43,  1, 33,  9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47,  7, 39, 13, 45,  5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];
function bayerOffset(x, y) {
  // 0..63 -> roughly -0.5..0.5
  return (BAYER8[y & 7][x & 7] + 0.5) / 64 - 0.5;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    input: null, output: null,
    width: 960, height: 540,
    spread: 36, nearest: false, dither: true,
    keepAlpha: false, help: false,
  };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--nearest') opts.nearest = true;
    else if (a === '--no-dither') opts.dither = false;
    else if (a === '--keep-alpha') opts.keepAlpha = true;
    else if (a === '--width') opts.width = parseInt(args[++i], 10);
    else if (a === '--height') opts.height = parseInt(args[++i], 10);
    else if (a === '--spread') opts.spread = parseFloat(args[++i]);
    else if (a.startsWith('-')) { console.error(`Unknown option "${a}"`); process.exit(1); }
    else positional.push(a);
  }
  if (opts.help) return opts;
  if (positional.length < 2) {
    console.error('Error: <input.png> and <output.png> are required. Use --help.');
    process.exit(1);
  }
  opts.input = path.resolve(positional[0]);
  opts.output = path.resolve(positional[1]);
  return opts;
}

// Flat palette table for fast quantization
let _table = null;
function paletteTable() {
  if (!_table) _table = getAllPaletteColors(); // [{hex,r,g,b}, ...]
  return _table;
}
function nearest(r, g, b) {
  const t = paletteTable();
  let best = Infinity, br = r, bg = g, bb = b;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const dr = c.r - r, dg = c.g - g, db = c.b - b;
    const d = dr * dr + dg * dg + db * db;
    if (d < best) { best = d; br = c.r; bg = c.g; bb = c.b; if (d === 0) break; }
  }
  return [br, bg, bb];
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 38).join('\n'));
    return;
  }
  if (!fs.existsSync(opts.input)) {
    console.error(`Error: input not found: ${opts.input}`);
    process.exit(1);
  }
  const { width: W, height: H } = opts;
  console.log(`[scene] in=${opts.input}`);
  console.log(`[scene] out=${opts.output}  target=${W}x${H}  dither=${opts.dither} spread=${opts.spread} resize=${opts.nearest ? 'nearest' : 'smooth'}`);

  const img = await loadImage(opts.input);
  console.log(`[scene] source=${img.width}x${img.height}`);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  // Smooth downscale keeps painterly detail; quantization supplies hard edges.
  ctx.imageSmoothingEnabled = !opts.nearest;
  if (ctx.imageSmoothingEnabled && ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, H);

  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const spread = opts.spread;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!opts.keepAlpha) d[i + 3] = 255;
      else if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (opts.dither) {
        const o = bayerOffset(x, y) * spread;
        r += o; g += o; b += o;
      }
      const [nr, ng, nb] = nearest(r, g, b);
      d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
    }
  }
  ctx.putImageData(id, 0, 0);

  const outDir = path.dirname(opts.output);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(opts.output, canvas.toBuffer('image/png'));
  const kb = (fs.statSync(opts.output).size / 1024).toFixed(1);
  console.log(`[scene] saved ${opts.output} (${W}x${H}, ${kb} KB)`);
}

main().catch(e => { console.error('Error:', e.message || e); process.exit(1); });
