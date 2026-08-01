#!/usr/bin/env node
/**
 * fix-checkerboard-sky.cjs
 *
 * The Canva Magic Media plate exports for st-pauls and a-famosa are isometric
 * plazas floating on an EMPTY near-white background (the design's transparency
 * checkerboard flattened to white on export). When that near-white area goes
 * through the Bayer-dither quantizer it lands between two palette whites
 * (#FFFFFF / #F5F0EB) and comes out as a 3px white CHECKERBOARD "sky" — the
 * single most obviously broken thing on screen.
 *
 * This tool detects that empty background on the MASTER export and refills it
 * with a flat tropical sky built from 2-3 horizontal bands of the palette
 * canon's sky-blue ramp (tools/ultima8-graphics/palette.cjs). The result is a
 * new master which the normal pipeline derives everything from: rederive-scenes
 * -> post-process-scene.cjs produces the day plate, and forge/relight-plates.cjs
 * relights that into dawn/dusk/night — so every variant gets a real sky.
 *
 * Detection is a flood fill inward from the image border over "empty" pixels
 * (near-white AND near-neutral), so in-scene whites — whitewashed walls, the
 * pale plaza stone — are never touched: they are not connected to the border.
 *
 * Usage:
 *   node tools/fix-checkerboard-sky.cjs <input.png> <output.png> [options]
 *
 * Options:
 *   --threshold N   Min channel value for an "empty" pixel (default 244)
 *   --tolerance N   Max channel spread (max-min) for an "empty" pixel (default 10)
 *   --feather N     Fringe passes that eat the anti-aliased silhouette edge (default 3)
 *   --mask FILE     Also write a black/white mask PNG for inspection
 *   --help
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { PALETTE, hexToRgb } = require('./ultima8-graphics/palette.cjs');

// Flat tropical sky: three horizontal bands off the canon sky ramp, deepest at
// the top (zenith) brightening toward the horizon. Fractions are of image height.
//
// The ramp deliberately stops at index 5 (#6A8AD0) rather than the pale
// 6/7 entries: the night ToD grade darkens the ground far more than a pale sky,
// and anything brighter than this leaves the night variant with a sky LIGHTER
// than the lit plaza — which reads as fog, not night.
const SKY_BANDS = [
  { until: 0.34, hex: PALETTE.sky[3] }, // #3A5AB0 mid sky (zenith)
  { until: 0.62, hex: PALETTE.sky[4] }, // #4A6AC0 upper-mid sky
  { until: 1.01, hex: PALETTE.sky[5] }, // #6A8AD0 bright day sky (toward horizon)
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    input: null,
    output: null,
    threshold: 244,
    tolerance: 10,
    feather: 3,
    mask: null,
    help: false,
  };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--threshold') opts.threshold = parseInt(args[++i], 10);
    else if (a === '--tolerance') opts.tolerance = parseInt(args[++i], 10);
    else if (a === '--feather') opts.feather = parseInt(args[++i], 10);
    else if (a === '--mask') opts.mask = args[++i];
    else if (a.startsWith('-')) {
      console.error(`Unknown option "${a}"`);
      process.exit(1);
    } else positional.push(a);
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

/** Band colour {r,g,b} for a given row. */
function skyColorForRow(y, height) {
  const t = y / height;
  for (const band of SKY_BANDS) {
    if (t < band.until) return hexToRgb(band.hex);
  }
  return hexToRgb(SKY_BANDS[SKY_BANDS.length - 1].hex);
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 34).join('\n'));
    return Promise.resolve();
  }
  if (!fs.existsSync(opts.input)) {
    console.error(`Error: input not found: ${opts.input}`);
    process.exit(1);
  }

  return loadImage(opts.input).then((img) => {
    const W = img.width;
    const H = img.height;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, W, H);
    const d = imageData.data;

    const isEmpty = (i, threshold, tolerance) => {
      // A transparent source pixel is empty background by definition.
      if (d[i + 3] < 128) return true;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      return min >= threshold && max - min <= tolerance;
    };

    // --- Flood fill inward from the border over empty pixels -----------------
    const mask = new Uint8Array(W * H);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const p = y * W + x;
      if (mask[p]) return;
      if (!isEmpty(p * 4, opts.threshold, opts.tolerance)) return;
      mask[p] = 1;
      stack.push(p);
    };
    for (let x = 0; x < W; x++) {
      push(x, 0);
      push(x, H - 1);
    }
    for (let y = 0; y < H; y++) {
      push(0, y);
      push(W - 1, y);
    }
    while (stack.length) {
      const p = stack.pop();
      const x = p % W;
      const y = (p - x) / W;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }

    // --- Feather: eat the anti-aliased halo hugging the plate silhouette -----
    // Each pass adds *slightly* darker near-neutral pixels touching the mask, so
    // no pale ghost outline survives between the new sky and the artwork.
    for (let pass = 0; pass < opts.feather; pass++) {
      const relThreshold = opts.threshold - 12 * (pass + 1);
      const relTolerance = opts.tolerance + 6 * (pass + 1);
      const additions = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (mask[p]) continue;
          if (!isEmpty(p * 4, relThreshold, relTolerance)) continue;
          const touches =
            (x > 0 && mask[p - 1]) ||
            (x < W - 1 && mask[p + 1]) ||
            (y > 0 && mask[p - W]) ||
            (y < H - 1 && mask[p + W]);
          if (touches) additions.push(p);
        }
      }
      if (!additions.length) break;
      for (const p of additions) mask[p] = 1;
    }

    // --- Repaint the masked region with flat sky bands -----------------------
    let filled = 0;
    for (let y = 0; y < H; y++) {
      const { r: sr, g: sg, b: sb } = skyColorForRow(y, H);
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (!mask[p]) continue;
        const i = p * 4;
        d[i] = sr;
        d[i + 1] = sg;
        d[i + 2] = sb;
        d[i + 3] = 255;
        filled++;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const outDir = path.dirname(opts.output);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(opts.output, canvas.toBuffer('image/png'));

    const pct = ((filled / (W * H)) * 100).toFixed(1);
    console.log(`[sky] ${path.basename(opts.input)} ${W}x${H} — refilled ${filled} px (${pct}% of frame)`);
    console.log(`[sky] saved ${opts.output}`);

    if (opts.mask) {
      const mCanvas = createCanvas(W, H);
      const mCtx = mCanvas.getContext('2d');
      const mData = mCtx.createImageData(W, H);
      for (let p = 0; p < W * H; p++) {
        const v = mask[p] ? 255 : 0;
        mData.data[p * 4] = v;
        mData.data[p * 4 + 1] = v;
        mData.data[p * 4 + 2] = v;
        mData.data[p * 4 + 3] = 255;
      }
      mCtx.putImageData(mData, 0, 0);
      fs.writeFileSync(path.resolve(opts.mask), mCanvas.toBuffer('image/png'));
      console.log(`[sky] mask written to ${opts.mask}`);
    }
  });
}

main().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
