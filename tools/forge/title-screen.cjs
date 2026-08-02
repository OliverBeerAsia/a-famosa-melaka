#!/usr/bin/env node
'use strict';
/**
 * MELAKA FORGE — TITLE / LOADING SCREENS
 * ======================================
 * `src/data/plate-layouts/title-panorama.json`
 *   -> compose-plate (screen mode: no walk mask, no derived engine data)
 *   -> relight LUT  (dusk for the title, night for the loading interstitial)
 *   -> baked lamp pass (the same one the world plates get)
 *   -> nearest-upscale x3
 *   -> assets/scenes/opening-screen.png
 *      assets/scenes/scene-loading-ribeira.png
 *
 * WHY THIS EXISTS. Both screens were the last hand-authored plates in the game
 * and the last two entries on `validate-canon.cjs`'s LEGACY_ALLOWLIST that a
 * player sees before anything else. They were also the reason
 * `.ui-screen-scrim` had to be fully OPAQUE in a band at the top and bottom:
 * the old plates had "A FAMOSA" and "MELAKA 1580" PAINTED INTO THEM, so a
 * translucent scrim let the baked type ghost through behind the real React
 * title. Type belongs to the UI layer. This panorama has none, so the scrim
 * goes back to an even veil — see src/styles/index.css.
 *
 * ONE SOURCE, TWO SCREENS. The loading interstitial is the same roadstead an
 * hour later: the night LUT, which drops it to ~0.35x the day's luma and puts
 * every lamp pool at full strength. That is a calmer, darker frame to read a
 * loading line over, and it costs one more LUT pass rather than a second
 * composition to keep in sync.
 *
 * DETERMINISTIC: no Math.random, no Date.now. Same layout -> same bytes.
 *
 * CLI
 *   node tools/forge/title-screen.cjs            render + install
 *   node tools/forge/title-screen.cjs --check     gates only, writes nothing
 *   node tools/forge/title-screen.cjs --out DIR   write somewhere else
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const P = require('./palette.cjs');
const RP = require('./relight-plates.cjs');
const { compose } = require('./compose-plate.cjs');

const REPO = path.resolve(__dirname, '../..');
const LAYOUT = path.join(REPO, 'src/data/plate-layouts/title-panorama.json');
const SCENES = path.join(REPO, 'assets', 'scenes');
const SCALE = 3;

/** file <- time of day. Both derive from the one composed day panorama. */
const SCREENS = [
  { file: 'opening-screen.png', tod: 'dusk', what: 'title' },
  { file: 'scene-loading-ribeira.png', tod: 'night', what: 'loading interstitial' },
];

function toImageData(surface) {
  const cv = createCanvas(surface.width, surface.height);
  const ctx = cv.getContext('2d');
  const id = ctx.createImageData(surface.width, surface.height);
  id.data.set(surface.data);
  return id;
}

function cloneImageData(id) {
  const cv = createCanvas(id.width, id.height);
  const copy = cv.getContext('2d').createImageData(id.width, id.height);
  copy.data.set(id.data);
  return copy;
}

function build() {
  const layout = JSON.parse(fs.readFileSync(LAYOUT, 'utf8'));
  const res = compose(layout, {});
  const day = toImageData(res.plate);
  const lights = res.engine.lights;
  return SCREENS.map((s) => {
    const id = cloneImageData(day);
    // Order matters and matches relight-plates.cjs exactly: remap through the
    // LUT first, THEN bake the lamps. Baking first would push the pools through
    // the night compression and the lanterns would go out.
    RP.relightNative(id, s.tod, { plateW: id.width });
    const pass = RP.PASS[s.tod];
    lights.forEach((l) => RP.bakeLight(id, l, pass));
    return Object.assign({ id, native: { w: day.width, h: day.height } }, s);
  });
}

// ---------------------------------------------------------------------------
function gate(screens) {
  const problems = [];
  screens.forEach((s) => {
    const allowed = RP.derivedPalette(s.tod);
    const d = s.id.data;
    const offenders = new Map();
    let partial = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a !== 0 && a !== 255) partial++;
      if (a === 0) { problems.push(`${s.file}: transparent pixel — a screen must be opaque`); break; }
      const k = ((d[i] & 255) << 16) | ((d[i + 1] & 255) << 8) | (d[i + 2] & 255);
      if (!allowed.has(k)) offenders.set(k, (offenders.get(k) || 0) + 1);
    }
    if (partial) problems.push(`${s.file}: ${partial} partial-alpha pixel(s)`);
    if (offenders.size) {
      const worst = [...offenders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([k, n]) => `${P.rgbToHex((k >> 16) & 255, (k >> 8) & 255, k & 255)} x${n}`).join(' ');
      problems.push(`${s.file}: ${offenders.size} colour(s) outside the ${s.tod} derived palette — ${worst}`);
    }
    // The screen fills the viewport exactly; anything else letterboxes or crops.
    const w = s.native.w * SCALE, h = s.native.h * SCALE;
    if (w !== 960 || h !== 540) problems.push(`${s.file}: ships at ${w}x${h}, must be 960x540`);
    const counts = new Set();
    for (let i = 0; i < d.length; i += 4) counts.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    s.colours = counts.size;
  });
  return problems;
}

function meanLuma(id) {
  const d = id.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return sum / (d.length / 4);
}

module.exports = { build, gate, SCREENS, LAYOUT };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 && argv[outIdx + 1] ? path.resolve(REPO, argv[outIdx + 1]) : SCENES;
  const screens = build();
  const problems = gate(screens);

  console.log(`Forge title screens — ${screens[0].native.w}x${screens[0].native.h} native, shipped x${SCALE}`);
  screens.forEach((s) => console.log(
    `  ${s.file.padEnd(28)} ${s.tod.padEnd(5)}  ${String(s.colours).padStart(3)} colours  ` +
    `mean luma ${meanLuma(s.id).toFixed(1)}  (${s.what})`));

  if (problems.length) {
    console.error('\nFAILED GATES:');
    problems.forEach((p) => console.error('  ! ' + p));
    process.exit(1);
  }
  if (!argv.includes('--check')) {
    fs.mkdirSync(outDir, { recursive: true });
    screens.forEach((s) => fs.writeFileSync(path.join(outDir, s.file), RP.encodeUpscaled(s.id, SCALE)));
    console.log(`\ninstalled ${screens.length} screen(s) into ${path.relative(REPO, outDir)}`);
  }
  console.log('all title-screen gates pass');
}
