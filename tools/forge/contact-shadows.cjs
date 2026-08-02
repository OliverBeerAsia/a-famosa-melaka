#!/usr/bin/env node
'use strict';
/**
 * MELAKA FORGE — CONTACT SHADOW SHEET  (benchmark item 13)
 * ========================================================
 * Every sprite the engine composites onto a plate — player, NPC, crowd actor,
 * item pickup, fauna — currently meets the ground with nothing under it. The
 * PAINTED props do not have this problem: `primitives.cjs contactShadow()`
 * bakes an ellipse under each one at compose time. Moving sprites cannot use
 * that, because the shadow has to move with them, so they need a sprite of
 * their own. Without it a character reads as a decal pasted on a photograph,
 * which is the single most common failure mode of 2.5D pixel art and is what
 * benchmark item 13 exists to prevent.
 *
 * THIS FILE SHIPS DATA ONLY. Engine wiring (attach a shadow image per actor,
 * depth just under `worldDepth(y)`, scale-by-actor-width) is a later ENGINE
 * task — see docs/art-bible/forge/contact-shadows.md for the contract the
 * sheet is authored against.
 *
 * THE SPEC, AND WHY EACH PART OF IT
 * ---------------------------------
 *  · **2:1 ellipse.** The shadow lies ON the ground, and the ground is a 2:1
 *    isometric plane, so a circle is wrong — it reads as a ball under the feet.
 *    Width:height is exactly 2:1 in every frame, like every other ground form
 *    the Forge draws.
 *  · **>= 60% of foot width.** Narrower and the eye reads the sprite as
 *    hovering with a smudge below it rather than as standing on something.
 *    These run at 75%, comfortably over the bar, because a 16px actor rounds
 *    badly at 60% (9.6px) and a shadow with an odd half-pixel has no centre.
 *  · **25-45% opacity, EXPRESSED AS DITHER DENSITY.** Alpha stays 0 or 255 —
 *    a partial-alpha shadow is anti-aliasing, and it is the exact defect the
 *    canon gate fails builds over. Density does the job instead: about 62% of
 *    the core pixels are set, thinning to 16% at the rim, which averages ~40%,
 *    inside the window and — more importantly — gives the falloff a real pixel
 *    texture instead of a soft edge.
 *  · **Two tones, never black.** Core is the `shadow-void` anchor, the skirt is
 *    `shadow-violet`. Pure black is not in the canon and never will be: a black
 *    shadow on a warm plate reads as a hole.
 *  · **NW sun.** `palette.cjs SUN` is azimuth 315 / elevation 30, so the shadow
 *    is displaced DOWN-RIGHT of the foot. That displacement is BAKED IN: the
 *    frame's centre is the actor's foot anchor and the ellipse sits offset
 *    inside it, so a consumer just centres the frame on the feet and cannot get
 *    the sun direction wrong by handing it the wrong sign.
 *
 * LAYOUT
 *   assets/sprites/effects/contact-shadows.png — 120x20, three 40x20 frames,
 *   left to right: small (16px actors), medium (24px), large (32px).
 *   Uniform frame size on purpose: Phaser slices a sheet on a fixed grid, and
 *   three differently-sized frames in one strip cannot be loaded as one sheet.
 *
 * `assets/sprites/effects/` is deliberately NOT yet in the gameplay-asset
 * spec's allowedDirectories, so validate-gameplay-assets emits one `warn` for
 * this file. That is accurate rather than an oversight: the directory becomes a
 * promoted shipping class when Stage 5 moves the particles into it and the
 * engine actually draws from it.
 *
 * CLI
 *   node tools/forge/contact-shadows.cjs           render + install
 *   node tools/forge/contact-shadows.cjs --check   gates only
 *   node tools/forge/contact-shadows.cjs --sheet   also write a review sheet
 */

const fs = require('fs');
const path = require('path');
const P = require('./palette.cjs');
const { Surface } = require('./surface.cjs');

const REPO = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO, 'assets', 'sprites', 'effects');
const OUT_FILE = path.join(OUT_DIR, 'contact-shadows.png');
const REVIEW_DIR = path.join(REPO, 'docs', 'art-bible', 'forge', 'review');

const VOID = P.ANCHORS['shadow-void'];
const VIOLET = P.ANCHORS['shadow-violet'];

const FRAME_W = 40;
const FRAME_H = 20;

/**
 * One frame per actor footprint width. `rx` is HALF the ellipse width, so the
 * shadow is 2*rx wide and 2*rx/2 tall; `foot` is the sprite width it is cut for.
 */
const FRAMES = [
  { name: 'small', foot: 16, rx: 6 },
  { name: 'medium', foot: 24, rx: 9 },
  { name: 'large', foot: 32, rx: 12 },
];

/** The 4x4 ordered matrix, normalised to (0,1). The only legal dither. */
const BAYER = P.BAYER4;
function threshold(x, y) { return (BAYER[y & 3][x & 3] + 0.5) / 16; }

/**
 * Density profile across the ellipse. Flat-then-falloff rather than a smooth
 * ramp: a linear density gradient over 6 pixels is a gradient, and gradients
 * are what the style gate rejects. Two plateaus and one short transition read
 * as an occlusion with an edge.
 */
function densityAt(q) {                 // q = normalised squared radius, 0..1
  if (q <= 0.36) return 0.62;           // under the foot: near-solid occlusion
  if (q <= 0.75) return 0.34;
  return 0.16;                          // the skirt, where bounce light gets in
}

function drawFrame(surface, ox, spec) {
  const rx = spec.rx;
  const ry = rx / 2;                                    // 2:1, always
  // The foot anchor is the frame centre; the ellipse is displaced down-right
  // by the sun. Same proportions as primitives.cjs contactShadow so a moving
  // actor's shadow and a painted prop's shadow agree.
  const cx = ox + FRAME_W / 2 + Math.round(rx * 0.42);
  const cy = FRAME_H / 2 + Math.round(ry * 0.5);
  let set = 0, inside = 0;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const q = dx * dx + dy * dy;
      if (q > 1.0) continue;
      inside++;
      const d = densityAt(q);
      if (threshold(x, y) >= d) continue;
      surface.setHex(x, y, q <= 0.36 ? VOID : VIOLET);
      set++;
    }
  }
  return { inside, set, density: set / inside, rx, ry, cx: cx - ox, cy };
}

function build() {
  const sheet = new Surface(FRAME_W * FRAMES.length, FRAME_H);
  const stats = FRAMES.map((f, i) => Object.assign(
    { name: f.name, foot: f.foot, index: i, frameX: i * FRAME_W },
    drawFrame(sheet, i * FRAME_W, f),
  ));
  return { sheet, stats };
}

// ---------------------------------------------------------------------------
function gate(sheet, stats) {
  const problems = [];
  const allowed = new Set([VOID, VIOLET].map((h) => h.toUpperCase()));
  const d = sheet.data;
  let partial = 0;
  const used = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a !== 0 && a !== 255) partial++;
    if (a === 0) continue;
    used.add(P.rgbToHex(d[i], d[i + 1], d[i + 2]).toUpperCase());
  }
  if (partial) problems.push(`${partial} partial-alpha pixel(s) — a soft shadow is anti-aliasing`);
  used.forEach((h) => { if (!allowed.has(h)) problems.push(`off-anchor colour ${h}`); });
  if (used.size !== 2) problems.push(`${used.size} tone(s) — the spec is exactly 2`);

  stats.forEach((s) => {
    const width = s.rx * 2;
    const pct = width / s.foot;
    if (pct < 0.60) problems.push(`${s.name}: ellipse is ${(pct * 100).toFixed(0)}% of a ${s.foot}px foot — benchmark 13 wants >= 60%`);
    if (Math.abs(s.rx / s.ry - 2) > 0.01) problems.push(`${s.name}: ${s.rx * 2}x${s.ry * 2} is not a 2:1 ground ellipse`);
    if (s.density < 0.25 || s.density > 0.45) {
      problems.push(`${s.name}: implied opacity ${(s.density * 100).toFixed(0)}% is outside the 25-45% window`);
    }
    if (s.cx <= FRAME_W / 2 || s.cy <= FRAME_H / 2) {
      problems.push(`${s.name}: the ellipse is not displaced down-right of the foot anchor — the sun is NW`);
    }
  });
  return problems;
}

function contactSheet(sheet, stats, outPath) {
  const { createCanvas } = require('canvas');
  const K = 8, PAD = 24, HEAD = 78;
  const cv = createCanvas(sheet.width * K + PAD * 2, HEAD + sheet.height * K + 90);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#987438';                                  // on warm earth,
  ctx.fillRect(0, 0, cv.width, cv.height);                    // where they live
  ctx.fillStyle = '#2C1020';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('MELAKA FORGE — CONTACT SHADOWS (benchmark 13)', PAD, 34);
  ctx.font = '13px sans-serif';
  ctx.fillText('2:1 ground ellipses · 2 anchor tones · opacity by dither density · alpha 0/255 only', PAD, 56);
  ctx.drawImage(sheet.scaleNearest(K).toCanvas(), PAD, HEAD);
  stats.forEach((s) => {
    const x = PAD + s.frameX * K;
    ctx.strokeStyle = 'rgba(44,16,32,0.5)';
    ctx.strokeRect(x, HEAD, FRAME_W * K, FRAME_H * K);
    // the foot anchor, so the baked sun offset is visible
    ctx.fillStyle = '#B01C28';
    ctx.fillRect(x + (FRAME_W / 2) * K - 3, HEAD + (FRAME_H / 2) * K - 3, 6, 6);
    ctx.fillStyle = '#2C1020';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${s.name} · ${s.foot}px actor`, x + 6, HEAD + FRAME_H * K + 22);
    ctx.font = '11px sans-serif';
    ctx.fillText(`${s.rx * 2}x${s.ry * 2} (${((s.rx * 2 / s.foot) * 100).toFixed(0)}% of foot) · ${(s.density * 100).toFixed(0)}% density`,
      x + 6, HEAD + FRAME_H * K + 40);
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, cv.toBuffer('image/png'));
  return outPath;
}

module.exports = { build, gate, FRAMES, FRAME_W, FRAME_H, OUT_FILE };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const { sheet, stats } = build();
  const problems = gate(sheet, stats);
  console.log(`Forge contact shadows — ${sheet.width}x${sheet.height}, ${FRAMES.length} frames of ${FRAME_W}x${FRAME_H}`);
  stats.forEach((s) => console.log(
    `  ${s.name.padEnd(7)} ${s.foot}px actor  ellipse ${String(s.rx * 2).padStart(2)}x${s.ry * 2}` +
    `  ${((s.rx * 2 / s.foot) * 100).toFixed(0)}% of foot  ${(s.density * 100).toFixed(0)}% implied opacity` +
    `  offset +${s.cx - FRAME_W / 2},+${s.cy - FRAME_H / 2}`));
  if (problems.length) {
    console.error('\nFAILED GATES:');
    problems.forEach((p) => console.error('  ! ' + p));
    process.exit(1);
  }
  if (!argv.includes('--check')) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    sheet.writePNG(OUT_FILE);
    console.log(`\ninstalled ${path.relative(REPO, OUT_FILE)}`);
  }
  if (argv.includes('--sheet')) {
    console.log('review sheet: ' + path.relative(REPO, contactSheet(sheet, stats, path.join(REVIEW_DIR, 'contact-shadows.png'))));
  }
  console.log('all contact-shadow gates pass');
}
