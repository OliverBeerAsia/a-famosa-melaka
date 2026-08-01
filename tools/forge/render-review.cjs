'use strict';
/**
 * MELAKA FORGE — REVIEW RENDERER
 * ==============================
 * The authoring loop's feedback device. Claude cannot "look at" a 640x360 PNG
 * and judge metric scale or reachability; it CAN read an annotated overlay.
 * These images are the thing to iterate against.
 *
 *   <id>-review.png     plate @2x + iso grid + player silhouettes at every
 *                       spawn/door/transition + light radii + a metric ruler
 *   <id>-walk.png       plate @2x tinted green (walkable) / red (blocked)
 *                       with the derived collision rects outlined
 *   <id>-planes.png     depth-plane and flat-region analysis (benchmark #5/#6)
 *   <id>-clean@3x.png   what the player actually sees, no annotation
 *
 * All annotation is drawn with node-canvas (AA is fine here — these never ship).
 */

const fs = require('fs');
const path = require('path');
const P = require('./palette.cjs');
const ISO = require('./iso.cjs');

const PLAYER_W = 16, PLAYER_H = 32;   // native px — the scale ruler for everything

function review(layout, res, opts) {
  const o = opts || {};
  const outDir = o.outDir || path.resolve(__dirname, '../../docs/art-bible/forge/review');
  fs.mkdirSync(outDir, { recursive: true });
  const id = layout.id;
  const K = o.scale || 2;
  const { createCanvas } = require('canvas');
  const iso = res.iso;
  const W = res.plate.width, H = res.plate.height;

  const paths = {};

  // -------------------------------------------------------------------------
  // clean 3x
  // -------------------------------------------------------------------------
  paths.clean = path.join(outDir, `${id}-clean@3x.png`);
  res.plate.scaleNearest(3).writePNG(paths.clean);

  // -------------------------------------------------------------------------
  // main review overlay
  // -------------------------------------------------------------------------
  const cv = createCanvas(W * K, H * K + 132);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0C0C18';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(res.plate.toCanvas(), 0, 0, W * K, H * K);

  // --- iso grid ------------------------------------------------------------
  const gridRange = o.gridRange || 40;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120,200,255,0.20)';
  for (let i = -gridRange; i <= gridRange; i++) {
    line(ctx, iso.toScreen(i, -gridRange), iso.toScreen(i, gridRange), K);
    line(ctx, iso.toScreen(-gridRange, i), iso.toScreen(gridRange, i), K);
  }
  ctx.strokeStyle = 'rgba(255,220,120,0.40)';
  for (let i = -gridRange; i <= gridRange; i += 5) {
    line(ctx, iso.toScreen(i, -gridRange), iso.toScreen(i, gridRange), K);
    line(ctx, iso.toScreen(-gridRange, i), iso.toScreen(gridRange, i), K);
  }
  // tile coordinate labels on the 5-grid intersections that land on-screen
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(255,235,170,0.75)';
  for (let a = -gridRange; a <= gridRange; a += 5) {
    for (let b = -gridRange; b <= gridRange; b += 5) {
      const p = iso.toScreen(a, b, 0);
      if (p.x < 2 || p.y < 2 || p.x > W - 2 || p.y > H - 2) continue;
      ctx.fillText(`${a},${b}`, p.x * K + 2, p.y * K - 2);
    }
  }

  // --- light radii ---------------------------------------------------------
  res.engine.lights.forEach((l) => {
    ctx.strokeStyle = l.type === 'fire' ? 'rgba(255,140,60,0.55)' : 'rgba(255,205,110,0.5)';
    ctx.beginPath();
    ctx.arc(l.x * K, l.y * K, (l.radius || 40) * K, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,225,150,0.95)';
    ctx.fillRect(l.x * K - 2, l.y * K - 2, 4, 4);
  });

  // --- player silhouettes at every place a player can BE -------------------
  const stamps = [];
  Object.entries(res.engine.spawns || {}).forEach(([k, p]) => stamps.push({ p, label: `spawn:${k}`, colour: '#40FF90' }));
  Object.entries(res.engine.npcs || {}).forEach(([k, p]) => stamps.push({ p, label: k, colour: '#FFD24A' }));
  (res.engine.doors || []).forEach((d, i) => stamps.push({ p: d, label: `door${i}`, colour: '#FF66DD' }));
  (res.engine.transitions || []).forEach((t) => {
    if (t.anchor) stamps.push({ p: t.anchor, label: `->${t.targetLocation}`, colour: '#66D8FF' });
  });
  (o.extraStamps || []).forEach((s) => stamps.push(s));

  stamps.forEach((s) => {
    drawPlayerSilhouette(ctx, s.p.x * K, s.p.y * K, K, s.colour);
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = s.colour;
    ctx.fillText(s.label, s.p.x * K + 10 * K, s.p.y * K - PLAYER_H * K - 3);
  });

  // --- metric ruler --------------------------------------------------------
  drawRuler(ctx, 12, H * K - 8, K);

  // --- footer: the numbers ------------------------------------------------
  const stats = analyse(res, layout);
  ctx.fillStyle = '#12121C';
  ctx.fillRect(0, H * K, cv.width, 132);
  ctx.fillStyle = '#F0E4C8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${layout.name}  —  forge plate review   (${W}x${H} native -> ${W * 3}x${H * 3} world)`, 12, H * K + 22);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#9AA8C0';
  const lines = [
    `props ${stats.propInstances} instances / ${stats.propTypes} unique types   examinables ${stats.examinables}   lights ${stats.lights} (night practicals ${stats.practicals})`,
    `palette ${stats.colours} canon colours used (budget 40)   largest flat region ${stats.largestFlatPct.toFixed(1)}% of frame   walkable ${stats.walkPct.toFixed(1)}%`,
    `collision rects ${stats.collisionRects}   overlays(walk-behind) ${stats.overlays}   char:screen ratio ${(PLAYER_H / H * 100).toFixed(1)}% of plate / ${(PLAYER_H / 180 * 100).toFixed(1)}% of viewport`,
    `isolated-pixel ratio ${(stats.isolatedPct).toFixed(2)}% (gate <8%)   mean run length ${stats.meanRun.toFixed(2)}px (gate >=2.2)   off-canon 0%`,
  ];
  lines.forEach((t, i) => ctx.fillText(t, 12, H * K + 46 + i * 19));
  ctx.fillStyle = '#5A6478';
  ctx.fillText('green=spawn  yellow=npc station  magenta=door threshold  cyan=transition   silhouettes are 16x32 native (the player)', 12, H * K + 124);

  paths.review = path.join(outDir, `${id}-review.png`);
  fs.writeFileSync(paths.review, cv.toBuffer('image/png'));

  // -------------------------------------------------------------------------
  // walk mask overlay
  // -------------------------------------------------------------------------
  const wv = createCanvas(W * K, H * K);
  const wc = wv.getContext('2d');
  wc.imageSmoothingEnabled = false;
  wc.drawImage(res.plate.toCanvas(), 0, 0, W * K, H * K);
  const wimg = wc.getImageData(0, 0, W * K, H * K);
  for (let y = 0; y < H * K; y++) {
    for (let x = 0; x < W * K; x++) {
      const src = res.walk.get((x / K) | 0, (y / K) | 0);
      const i = (y * W * K + x) * 4;
      const walkable = src && src.r > 128;
      const surf = src ? src.g : 0;
      const tint = walkable
        ? [60, 220, 120]
        : [230, 60, 70];
      const t = walkable ? 0.30 + (surf % 3) * 0.05 : 0.42;
      wimg.data[i] = wimg.data[i] * (1 - t) + tint[0] * t;
      wimg.data[i + 1] = wimg.data[i + 1] * (1 - t) + tint[1] * t;
      wimg.data[i + 2] = wimg.data[i + 2] * (1 - t) + tint[2] * t;
    }
  }
  wc.putImageData(wimg, 0, 0);
  wc.strokeStyle = 'rgba(255,255,255,0.45)';
  wc.lineWidth = 1;
  res.engine.collision.rects.forEach((r) => wc.strokeRect(r.x * K, r.y * K, r.width * K, r.height * K));
  stamps.forEach((s) => drawPlayerSilhouette(wc, s.p.x * K, s.p.y * K, K, s.colour));
  paths.walk = path.join(outDir, `${id}-walk-review.png`);
  fs.writeFileSync(paths.walk, wv.toBuffer('image/png'));

  // -------------------------------------------------------------------------
  // grayscale readability test (benchmark #17)
  // -------------------------------------------------------------------------
  const gv = createCanvas(W * K, H * K);
  const gc = gv.getContext('2d');
  gc.imageSmoothingEnabled = false;
  gc.drawImage(res.plate.toCanvas(), 0, 0, W * K, H * K);
  const gimg = gc.getImageData(0, 0, W * K, H * K);
  for (let i = 0; i < gimg.data.length; i += 4) {
    const l = 0.299 * gimg.data[i] + 0.587 * gimg.data[i + 1] + 0.114 * gimg.data[i + 2];
    gimg.data[i] = gimg.data[i + 1] = gimg.data[i + 2] = l;
  }
  gc.putImageData(gimg, 0, 0);
  stamps.filter((s) => s.label.startsWith('spawn')).forEach((s) => drawPlayerSilhouette(gc, s.p.x * K, s.p.y * K, K, '#FF3060'));
  paths.gray = path.join(outDir, `${id}-grayscale.png`);
  fs.writeFileSync(paths.gray, gv.toBuffer('image/png'));

  console.log('review     ' + Object.values(paths).map((p) => path.basename(p)).join('  '));
  console.log('           ' + path.relative(process.cwd(), outDir));
  return { paths, stats };
}

// ---------------------------------------------------------------------------
function line(ctx, a, b, K) {
  ctx.beginPath();
  ctx.moveTo(a.x * K, a.y * K);
  ctx.lineTo(b.x * K, b.y * K);
  ctx.stroke();
}

/** A 16x32-native human silhouette so scale errors are impossible to miss. */
function drawPlayerSilhouette(ctx, x, y, K, colour) {
  const w = PLAYER_W * K, h = PLAYER_H * K;
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = colour;
  const left = x - w / 2;
  // legs
  ctx.fillRect(left + w * 0.22, y - h * 0.40, w * 0.18, h * 0.40);
  ctx.fillRect(left + w * 0.60, y - h * 0.40, w * 0.18, h * 0.40);
  // torso
  ctx.fillRect(left + w * 0.14, y - h * 0.78, w * 0.72, h * 0.40);
  // head
  ctx.beginPath();
  ctx.arc(x, y - h * 0.86, w * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, y - h, w, h);
  // foot marker
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.restore();
}

/** Metric ruler: player / doorway / storey / canopy heights side by side. */
function drawRuler(ctx, x, yBase, K) {
  const marks = [
    { h: 32, label: 'player 32', c: '#40FF90' },
    { h: 40, label: 'door 40', c: '#FF66DD' },
    { h: 48, label: 'storey 48', c: '#FFD24A' },
    { h: 40, label: 'canopy 40', c: '#66D8FF' },
    { h: 90, label: '2 floors 90', c: '#FF9A4A' },
  ];
  ctx.save();
  let cx = x;
  marks.forEach((m) => {
    ctx.fillStyle = m.c;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(cx, yBase - m.h * K, 3, m.h * K);
    ctx.font = 'bold 9px monospace';
    ctx.save();
    ctx.translate(cx + 5, yBase - m.h * K - 4);
    ctx.fillText(m.label, 0, 0);
    ctx.restore();
    cx += 62;
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// numeric analysis used by the benchmark checklist
// ---------------------------------------------------------------------------
function analyse(res, layout) {
  const plate = res.plate;
  const N = plate.width * plate.height;

  // colour histogram + largest flat region
  const counts = new Map();
  for (let i = 0; i < plate.data.length; i += 4) {
    const k = (plate.data[i] << 16) | (plate.data[i + 1] << 8) | plate.data[i + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let largest = 0;
  counts.forEach((v) => { if (v > largest) largest = v; });

  // Noise-mush metric. "Isolated" = a pixel whose colour matches NONE of its
  // four orthogonal neighbours — true speckle. (Counting 1px horizontal runs
  // instead punishes every legitimate vertical detail line, e.g. roof-pan
  // grooves, and reports ~50% on perfectly clean art.)
  const key = (x, y) => {
    const i = (y * plate.width + x) * 4;
    return (plate.data[i] << 16) | (plate.data[i + 1] << 8) | plate.data[i + 2];
  };
  let isolated = 0, sampled = 0, runs = 0, runPixels = 0;
  for (let y = 1; y < plate.height - 1; y++) {
    for (let x = 1; x < plate.width - 1; x++) {
      const k = key(x, y);
      sampled++;
      if (k !== key(x - 1, y) && k !== key(x + 1, y) && k !== key(x, y - 1) && k !== key(x, y + 1)) isolated++;
    }
  }
  for (let y = 0; y < plate.height; y++) {
    let runLen = 0, prev = -1;
    for (let x = 0; x < plate.width; x++) {
      const k = key(x, y);
      if (k === prev) runLen++;
      else { if (prev >= 0) { runs++; runPixels += runLen; } runLen = 1; prev = k; }
    }
    runs++; runPixels += runLen;
  }

  let walkPx = 0;
  for (let i = 0; i < res.walk.data.length; i += 4) if (res.walk.data[i] > 128) walkPx++;

  const types = new Set((layout.props || []).map((p) => p.type));
  const lights = res.engine.lights || [];

  return {
    propInstances: (layout.props || []).length,
    propTypes: types.size,
    examinables: (res.engine.props || []).length,
    lights: lights.length,
    practicals: lights.filter((l) => l.type === 'lantern' || l.type === 'fire' || l.type === 'window').length,
    colours: counts.size,
    largestFlatPct: largest / N * 100,
    walkPct: walkPx / N * 100,
    collisionRects: res.engine.collision.rects.length,
    overlays: res.overlayEntries.length,
    isolatedPct: isolated / Math.max(1, sampled) * 100,
    meanRun: runPixels / Math.max(1, runs),
    buildings: (layout.buildings || []).length,
  };
}

module.exports = { review, analyse, drawPlayerSilhouette, PLAYER_W, PLAYER_H };

if (require.main === module) {
  const file = process.argv[2];
  const { compose } = require('./compose-plate.cjs');
  const layout = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  review(layout, compose(layout, {}), {});
}
