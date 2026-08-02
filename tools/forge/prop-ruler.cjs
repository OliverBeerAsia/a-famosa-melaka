#!/usr/bin/env node
'use strict';
/**
 * MELAKA FORGE — PROP RULER
 * =========================
 * Renders every prop in the kit registry, alone, on a neutral ground, at native
 * resolution, and MEASURES it. It exists because three separate defects were
 * only visible once the props were laid out side by side and their numbers put
 * underneath them:
 *
 *   SCALE      a hand-portable basket rendering taller than the stall table it
 *              is supposed to sit on. Each prop declares a real-world size
 *              CLASS below; the tool fails any prop whose drawn height falls
 *              outside that class's native-pixel band. The player is 32px, so
 *              these bands are all expressed against that.
 *   OUTLINE    plate-baked scenery must never carry a uniform dark keyline —
 *              that is what makes a prop read as a sticker pasted on the
 *              street. The tool measures what fraction of a prop's silhouette
 *              edge is drawn in near-black and fails anything ringed.
 *   CONTACT    benchmark #13: every ground-dwelling prop needs a contact
 *              shadow. The tool checks for darkened ground under the footprint
 *              and lists anything sitting on nothing.
 *
 * The contact sheet is the readability check — if you cannot NAME a prop from
 * its cell, the silhouette has failed regardless of what the numbers say.
 *
 * CLI
 *   node tools/forge/prop-ruler.cjs            audit, print the table
 *   node tools/forge/prop-ruler.cjs --sheet    + docs/art-bible/forge/review/prop-ruler.png
 *   node tools/forge/prop-ruler.cjs --strict   exit non-zero on any failure
 */

const fs = require('fs');
const path = require('path');
const P = require('./palette.cjs');
const ISO = require('./iso.cjs');
const { Surface } = require('./surface.cjs');
const { PROPS } = require('./kits/props.cjs');

const REPO = path.resolve(__dirname, '../..');
const REVIEW = path.join(REPO, 'docs/art-bible/forge/review/prop-ruler.png');

/**
 * SIZE CLASSES, in native px of drawn height. The player is 32.
 *
 * CALIBRATION NOTE. The first run flagged four props. Rendering them against a
 * 32px player bar showed THREE were the CLASS being wrong, not the art: a cloth
 * rack and a potted palm are things you walk past at head height, and a stack
 * of bales reaches a man's chest. Those classes were corrected rather than the
 * props shrunk — a ruler that makes you cut down good art to satisfy a number
 * somebody guessed is worse than no ruler. Only `anchor-stock` was a real
 * defect — but only in its SILHOUETTE. Checked against reality, a carrack
 * anchor is 2.5-3.5 m, and the player's 32px is about 1.75 m, so 46-64px is the
 * honest band for one: `waistHigh` was wrong and so was the `chestHigh` I first
 * corrected it to. It is classed `overhead` and the fix was thickening the
 * shank, which is what actually made it read as forged iron rather than wire.
 * A prop not listed here is unclassified and only gets the outline/contact
 * checks — add it to a class when you know what it is meant to be.
 */
const CLASS = {
  handheld:   { max: 14, why: 'a thing you could pick up and carry' },
  kneeHigh:   { max: 20, why: 'basket, sack, small barrel — knee height on a 32px figure' },
  waistHigh:  { max: 26, why: 'crate stack, trough, bollard, table' },
  table:      { min: 14, max: 24, why: 'stall counter — goods sit ON it' },
  chestHigh:  { max: 34, why: 'handcart, rack, coop' },
  overhead:   { max: 52, why: 'stall canopy, lantern post — you walk under it' },
  structure:  { max: 999, why: 'buildings, walls, trees, ships — no cap' },
};

const SIZES = {
  barrel: 'kneeHigh', 'barrel-open': 'kneeHigh', crate: 'kneeHigh',
  'crate-stack': 'waistHigh', 'sack-pile': 'kneeHigh', 'spice-sack-row': 'kneeHigh',
  basket: 'kneeHigh', amphora: 'kneeHigh', 'pot-row': 'kneeHigh',
  'rope-coil': 'handheld', bench: 'kneeHigh', 'water-trough': 'waistHigh',
  bollard: 'kneeHigh', 'lantern-post': 'overhead', brazier: 'waistHigh',
  'step-stone': 'handheld', 'market-stall': 'overhead', 'signboard-chinese': 'overhead',
  'cloth-rack': 'overhead', handcart: 'chestHigh', 'potted-palm': 'overhead',
  'banana-clump': 'structure', 'chicken-coop': 'kneeHigh', 'laundry-line': 'structure',
  'bale-stack': 'chestHigh', 'net-pile': 'kneeHigh', 'anchor-stock': 'overhead',
  capstan: 'waistHigh', 'drying-rack-fish': 'overhead', 'mat-rolls': 'kneeHigh',
  'rice-mortar': 'kneeHigh', 'arms-rack': 'overhead', cannon: 'waistHigh',
  'powder-store': 'chestHigh', 'sentry-box': 'structure', gravestone: 'kneeHigh',
  'tomb-slab': 'handheld', 'stone-cross': 'structure', padrao: 'structure',
  scrub: 'kneeHigh', palm: 'structure', 'shade-tree': 'structure',
};

const NEUTRAL = P.RAMPS.earth[2];
const CELL = 96;              // native px per test cell

function lum(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

function renderOne(key) {
  const def = PROPS[key];
  const s = new Surface(CELL, CELL);
  s.clear(NEUTRAL);
  const iso = ISO.createIso({ tileWidth: 32, tileHeight: 16, originX: CELL / 2, originY: CELL - 26 });
  const spec = { tx: 0, ty: 0, seed: 7, s: 0, dd: 0 };
  // props that need a run/extent to draw anything at all
  Object.assign(spec, { len: 2, count: 3, w: 1, d: 1, h: undefined, axis: 'h', blades: 20, ships: [] });
  const groundBefore = s.clone();
  try { def.draw(s, iso, spec); } catch (e) { return { key, error: e.message.slice(0, 60) }; }

  // --- measure the silhouette -------------------------------------------
  const d = s.data, gb = groundBefore.data;
  let minY = 1e9, maxY = -1, minX = 1e9, maxX = -1, drawn = 0;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const i = (y * CELL + x) * 4;
      if (d[i] === gb[i] && d[i + 1] === gb[i + 1] && d[i + 2] === gb[i + 2]) continue;
      drawn++;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
    }
  }
  if (!drawn) return { key, error: 'drew nothing' };
  const baseY = CELL - 26;                       // the ground line of this cell
  const height = Math.max(0, baseY - minY);      // px standing above the ground

  // --- outline discipline -------------------------------------------------
  // Sample the ring just outside the changed area: how much of it is near-black?
  let edge = 0, dark = 0;
  for (let y = Math.max(1, minY); y <= Math.min(CELL - 2, maxY); y++) {
    for (let x = Math.max(1, minX); x <= Math.min(CELL - 2, maxX); x++) {
      const i = (y * CELL + x) * 4;
      const changed = !(d[i] === gb[i] && d[i + 1] === gb[i + 1] && d[i + 2] === gb[i + 2]);
      if (!changed) continue;
      let border = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = ((y + dy) * CELL + (x + dx)) * 4;
        if (d[j] === gb[j] && d[j + 1] === gb[j + 1] && d[j + 2] === gb[j + 2]) { border = true; break; }
      }
      if (!border) continue;
      edge++;
      if (lum(d[i], d[i + 1], d[i + 2]) < 40) dark++;
    }
  }
  const outlineRatio = edge ? dark / edge : 0;

  // --- contact: is the ground under the footprint darkened? --------------
  let contact = false;
  for (let y = baseY - 1; y <= Math.min(CELL - 1, baseY + 6) && !contact; y++) {
    for (let x = Math.max(0, minX); x <= Math.min(CELL - 1, maxX); x++) {
      const i = (y * CELL + x) * 4;
      if (d[i] === gb[i] && d[i + 1] === gb[i + 1] && d[i + 2] === gb[i + 2]) continue;
      if (lum(d[i], d[i + 1], d[i + 2]) < lum(gb[i], gb[i + 1], gb[i + 2]) - 12) { contact = true; break; }
    }
  }

  const cls = SIZES[key];
  const band = cls ? CLASS[cls] : null;
  const problems = [];
  if (band) {
    if (band.max !== undefined && height > band.max) problems.push(`${height}px > ${cls} max ${band.max}`);
    if (band.min !== undefined && height < band.min) problems.push(`${height}px < ${cls} min ${band.min}`);
  }
  if (outlineRatio > 0.55) problems.push(`${(outlineRatio * 100).toFixed(0)}% of its edge is near-black — full keyline`);
  if (!contact && cls !== 'structure') problems.push('no contact shadow (benchmark 13)');

  return { key, surface: s, height, cls: cls || '-', outlineRatio, contact, problems };
}

function main() {
  const argv = process.argv.slice(2);
  const keys = Object.keys(PROPS).sort();
  const rows = keys.map(renderOne);
  const bad = rows.filter((r) => r.problems && r.problems.length);
  const errs = rows.filter((r) => r.error);

  console.log(`Forge prop ruler — ${rows.length} props (player = 32 native px)`);
  console.log('prop                 h(px)  class        outline  contact  notes');
  rows.forEach((r) => {
    if (r.error) { console.log(`  ${r.key.padEnd(20)} ${'—'.padStart(5)}  ${'-'.padEnd(11)}  ${'-'.padStart(6)}   ${'-'.padStart(6)}   ${r.error}`); return; }
    console.log(`  ${r.key.padEnd(20)} ${String(r.height).padStart(5)}  ${String(r.cls).padEnd(11)}  ` +
      `${(r.outlineRatio * 100).toFixed(0).padStart(5)}%   ${(r.contact ? 'yes' : 'NO').padStart(6)}   ${r.problems.join('; ')}`);
  });
  console.log(`\n${bad.length} prop(s) with problems, ${errs.length} that would not render standalone`);

  if (argv.includes('--sheet')) {
    const { createCanvas } = require('canvas');
    const drawable = rows.filter((r) => r.surface);
    const COLS = 10, K = 2, PAD = 6, LAB = 26, C = CELL * K + PAD;
    const rowsN = Math.ceil(drawable.length / COLS);
    const cv = createCanvas(COLS * C + PAD, 60 + rowsN * (C + LAB));
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#14141C'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#F0E4C8'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText('MELAKA FORGE — PROP RULER (player = 32 native px)', 12, 32);
    drawable.forEach((r, i) => {
      const cx = PAD + (i % COLS) * C, cy = 60 + Math.floor(i / COLS) * (C + LAB);
      ctx.drawImage(r.surface.scaleNearest(K).toCanvas(), cx, cy);
      ctx.fillStyle = r.problems.length ? '#F08050' : '#8FA8C0';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(r.key.slice(0, 20), cx, cy + CELL * K + 12);
      ctx.font = '10px monospace';
      ctx.fillText(`${r.height}px ${r.cls}${r.contact ? '' : ' NOSHADOW'}`, cx, cy + CELL * K + 23);
    });
    fs.mkdirSync(path.dirname(REVIEW), { recursive: true });
    fs.writeFileSync(REVIEW, cv.toBuffer('image/png'));
    console.log('sheet: ' + path.relative(REPO, REVIEW));
  }

  if (argv.includes('--strict') && bad.length) process.exit(1);
}

module.exports = { renderOne, CLASS, SIZES };
if (require.main === module) main();
