'use strict';
/**
 * MELAKA FORGE — PORTRAIT GENERATOR
 * =================================
 * Renders the named cast as 80x80 native pixel bios, nearest-upscaled x3 to
 * 240x240 so the portrait pixel grid matches the world's (16x32 sprites at
 * CHARACTER_SCALE 3, plates pixelated to 320x180 and upscaled x3).
 *
 *   node tools/forge/portraits/generate.cjs             render + gate + sheets
 *   node tools/forge/portraits/generate.cjs --write     ...and install finals
 *   node tools/forge/portraits/generate.cjs --only siti
 *
 * GATES (non-zero exit on failure)
 *   1. silhouette IoU  — every pair of portraits must differ: IoU < 0.85
 *   2. palette         — every pixel is canon, or a canon-derived skin step
 *   3. alpha           — 0 or 255 only (portraits are fully opaque)
 *   4. contrast        — the silhouette must separate from its backdrop
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const { Mask, Picture, iou, rng, clamp } = require('./raster.cjs');
const { buildHead, skinField, paintSkin } = require('./anatomy.cjs');
const F = require('./features.cjs');
const { drawHair, drawFacialHair } = require('./hair.cjs');
const { drawHeadwear } = require('./headwear.cjs');
const { drawGarment } = require('./garments.cjs');
const { paintVolume } = require('./shade.cjs');
const { skinRamp, mat, backdrop, isLegal, RAMPS, ACCENTS, VOID } = require('./ramps.cjs');
const { CAST } = require('./characters.cjs');

const NATIVE = 80;
const SCALE = 3;
const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'assets/sprites/portraits');
const REVIEW_DIR = path.join(__dirname, 'review');

// ---------------------------------------------------------------------------
// BACKDROPS — flat, two-value, diegetic. Never a gradient, never a halo.
// ---------------------------------------------------------------------------
const PATTERNS = {
  'warehouse-timber': (x) => (x + 4) % 27 < 14,                            // wide plank faces
  'fort-stone':       (x, y) => y < 31,                                    // coping course
  'church-stone':     (x) => x < 31,                                       // pier edge
  'church-dim':       (x, y) => x + y * 0.35 < 46,                         // a shaft of light
  'market-awning':    (x, y) => Math.floor((x + y * 0.35) / 17) % 2 === 0, // striped canvas
  'harbour-sky':      (x, y) => y < 46,                                    // sky over water
  'counting-house':   (x) => x < 49,                                       // wall / shutter edge
  'ledger-shelf':     (x, y) => y > 26 && y < 52,                          // a shelf of ledgers
  'kampung-attap':    (x, y) => y < 24 + x * 0.18,                          // attap eave
  'street-wall':      (x, y) => x + y * 0.2 < 54,
  'tin-store':        (x, y) => y > 36 && x > 32,                          // dark stack, lit wall
  'textile-bolts':    (x) => Math.floor(x / 19) % 2 === 0,                 // bolts on end
  'river-edge':       (x, y) => y < 42,
  'gate-shadow':      (x, y) => x > 46 || y < 13,
};

function paintBackdrop(pic, name) {
  const [a, b] = backdrop(name);
  const p = PATTERNS[name] || (() => false);
  for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) pic.set(x, y, p(x, y) ? b : a);
}

// ---------------------------------------------------------------------------
// render one portrait
// ---------------------------------------------------------------------------
function faceLayers(pic, m, spec, skin, mods, sil) {
  F.drawStructure(m, spec.face, mods);
  F.drawEar(pic, m, spec.face, skin, mods);
  F.drawNose(pic, m, spec.face, skin, mods, spec.face.lineHex);
  F.drawEyes(pic, m, spec.face, skin, mods, spec.face.lineHex);
  F.drawBrows(pic, m, spec.face, skin, mods, spec.face.browHex);
  F.drawAge(pic, m, spec.face, skin, mods);
  const fh = drawFacialHair(pic, m, spec, mat((spec.beard && spec.beard.mat) || (spec.moustache && spec.moustache.mat) || 'hair-black'), mods);
  F.drawMouth(pic, m, spec.face, skin, mods, spec.face.lipLineHex);
  const hr = drawHair(pic, m, spec, mat((spec.hair && spec.hair.mat) || 'hair-black'), mods);
  if (sil) { sil.or(fh); sil.or(hr); }
}

function render(spec) {
  const pic = new Picture(NATIVE, NATIVE);
  paintBackdrop(pic, spec.backdrop);

  const m = buildHead(NATIVE, NATIVE, spec.head);
  const skin = skinRamp(spec.culture);

  // per-character palette wiring — skin is the ONLY culture-varying ramp
  const face = spec.face;
  face.scleraHex = RAMPS.whitewash[3];
  face.irisHex = spec.face.iris || RAMPS.timber[1];
  face.pupilHex = VOID;
  face.lineHex = RAMPS.timber[0];
  face.lipLineHex = RAMPS.terracotta[0];
  face.mouthInnerHex = VOID;
  face.toothHex = RAMPS.whitewash[3];
  face.browHex = mat((spec.hair && spec.hair.mat) || 'hair-black')[1];

  const field = skinField(m);
  const mods = new Float32Array(NATIVE * NATIVE);
  const scratchMods = new Float32Array(NATIVE * NATIVE);
  const sil = new Mask(NATIVE, NATIVE);

  // pass 1 — collect the shading modifiers (folds, sockets, cast shadows)
  spec.rand = rng(spec.seed);
  const scratch = new Picture(NATIVE, NATIVE);
  faceLayers(scratch, m, spec, skin, mods, null);
  drawHeadwear(scratch, m, spec, mods);

  // skin, lit by the canon sun
  const skinArea = m.headMask.union(m.neckMask).or(m.earMask);
  paintSkin(pic, skinArea, field, mods, skin);
  sil.or(skinArea);

  // pass 2 — the actual pixels, over the skin
  spec.rand = rng(spec.seed);
  faceLayers(pic, m, spec, skin, scratchMods, sil);
  const torso = drawGarment(pic, m, spec, scratchMods);
  sil.or(torso);
  const hw = drawHeadwear(pic, m, spec, scratchMods);
  sil.or(hw);

  // a 1px contact darkening where the figure meets the backdrop keeps the
  // silhouette readable inside the dark UI frame at any zoom
  const halo = sil.ring(1);
  halo.forEach((x, y) => {
    const cur = pic.get(x, y);
    const [a, b] = backdrop(spec.backdrop);
    pic.set(x, y, cur === b ? a : shadeDown(a));
  });

  return { pic, m, sil };
}

const DARKER = {};
function shadeDown(hex) {
  if (DARKER[hex]) return DARKER[hex];
  // step one down inside whichever canon ramp this hex belongs to
  for (const key of Object.keys(RAMPS)) {
    const r = RAMPS[key];
    const i = r.indexOf(hex);
    if (i > 0) { DARKER[hex] = r[i - 1]; return DARKER[hex]; }
    if (i === 0) { DARKER[hex] = require('./ramps.cjs').SHADOW; return DARKER[hex]; }
  }
  DARKER[hex] = hex;
  return hex;
}

// ---------------------------------------------------------------------------
// gates
// ---------------------------------------------------------------------------
function gate(results) {
  const problems = [];
  const notes = [];

  // 1. silhouette uniqueness
  let worst = { v: 0, a: '', b: '' };
  const pairs = [];
  for (let i = 0; i < results.length; i++) for (let j = i + 1; j < results.length; j++) {
    const v = iou(results[i].sil, results[j].sil);
    pairs.push({ a: results[i].spec.id, b: results[j].spec.id, v });
    if (v > worst.v) worst = { v, a: results[i].spec.id, b: results[j].spec.id };
    if (v >= 0.85) problems.push(`silhouette IoU ${v.toFixed(3)} >= 0.85: ${results[i].spec.id} vs ${results[j].spec.id}`);
  }
  pairs.sort((p, q) => q.v - p.v);
  notes.push(`silhouette IoU: worst ${worst.v.toFixed(3)} (${worst.a} vs ${worst.b}), mean ${(pairs.reduce((s, p) => s + p.v, 0) / pairs.length).toFixed(3)}`);

  // 2. palette legality + budget
  results.forEach((r) => {
    const counts = r.pic.colourCounts();
    const bad = [...counts.keys()].filter((h) => !isLegal(h));
    if (bad.length) problems.push(`${r.spec.id}: off-palette ${bad.slice(0, 6).join(' ')}`);
    if (counts.size > 40) problems.push(`${r.spec.id}: ${counts.size} colours (budget 40)`);
    r.colours = counts.size;
  });
  notes.push(`colours per portrait: ${Math.min(...results.map((r) => r.colours))}-${Math.max(...results.map((r) => r.colours))}`);

  // 3. opacity
  results.forEach((r) => {
    const holes = r.pic.px.filter((c) => !c).length;
    if (holes) problems.push(`${r.spec.id}: ${holes} transparent pixels`);
  });

  // 4. contrast against the backdrop
  // Separation is measured in luma AND hue: the canon deliberately gives every
  // ramp a different hue path, so a violet-black doublet reads clearly against
  // warm timber even when their luma is close. Luma-only would fail that.
  const { luma } = require('./ramps.cjs');
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const hexLuma = (h) => luma(...rgb(h));
  const sep = (a, b) => {
    const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
    const dL = Math.abs(hexLuma(a) - hexLuma(b));
    const dE = Math.hypot(r1 - r2, g1 - g2, b1 - b2);
    return Math.max(dL, dE * 0.62);
  };
  results.forEach((r) => {
    const bg = backdrop(r.spec.backdrop);
    const rim = r.sil.rim(1);
    let sum = 0, n = 0;
    rim.forEach((x, y) => {
      const c = r.pic.get(x, y);
      if (!c) return;
      sum += Math.min(sep(c, bg[0]), sep(c, bg[1]));
      n++;
    });
    r.contrast = n ? sum / n : 0;
    if (r.contrast < 18) problems.push(`${r.spec.id}: silhouette/backdrop separation ${r.contrast.toFixed(1)} < 18`);
  });
  notes.push(`edge separation: ${Math.min(...results.map((r) => r.contrast)).toFixed(1)}-${Math.max(...results.map((r) => r.contrast)).toFixed(1)}`);

  return { problems, notes, pairs };
}

// ---------------------------------------------------------------------------
// contact sheets
// ---------------------------------------------------------------------------
function contactSheet(results, file, cell, cols, label) {
  const pad = 6, lab = label ? 14 : 0;
  const rows = Math.ceil(results.length / cols);
  const W = cols * (cell + pad) + pad, H = rows * (cell + pad + lab) + pad;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#14141C';           // the dark UI frame this art lives inside
  ctx.fillRect(0, 0, W, H);
  results.forEach((r, i) => {
    const cxi = i % cols, cyi = Math.floor(i / cols);
    const x = pad + cxi * (cell + pad), y = pad + cyi * (cell + pad + lab);
    ctx.drawImage(r.pic.upscale(SCALE).toCanvas(), x, y, cell, cell);
    ctx.strokeStyle = '#3A3A4A';
    ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    if (label) {
      ctx.fillStyle = '#C8C8D8';
      ctx.font = '11px monospace';
      ctx.fillText(r.spec.id, x + 1, y + cell + 11);
    }
  });
  fs.writeFileSync(file, cv.toBuffer('image/png'));
  return file;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const cast = only ? CAST.filter((c) => c.id === only) : CAST;
  if (!cast.length) throw new Error('no such character: ' + only);

  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  const results = cast.map((spec) => {
    const r = render(spec);
    r.spec = spec;
    return r;
  });

  const res = gate(results);

  contactSheet(results, path.join(REVIEW_DIR, 'contact-sheet.png'), 240, 5, true);
  contactSheet(results, path.join(REVIEW_DIR, 'contact-sheet-50.png'), 120, 8, true);
  contactSheet(results, path.join(REVIEW_DIR, 'contact-sheet-native.png'), 80, 8, true);

  if (argv.includes('--write')) {
    if (res.problems.length) {
      console.error('refusing to write finals — gates failed');
    } else {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      results.forEach((r) => {
        fs.writeFileSync(path.join(OUT_DIR, r.spec.id + '.png'), r.pic.upscale(SCALE).toPNG());
      });
      console.log(`wrote ${results.length} portraits to ${path.relative(ROOT, OUT_DIR)}`);
    }
  }

  res.notes.forEach((n) => console.log('  ' + n));
  console.log('  top pairs: ' + res.pairs.slice(0, 5).map((p) => `${p.a}/${p.b} ${p.v.toFixed(2)}`).join(', '));
  if (res.problems.length) {
    console.error('\nFAILED GATES:');
    res.problems.forEach((p) => console.error('  ! ' + p));
    process.exitCode = 1;
  } else {
    console.log('\nall portrait gates pass');
  }
}

if (require.main === module) main();

module.exports = { render, gate, CAST, NATIVE, SCALE };
