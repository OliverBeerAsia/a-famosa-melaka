#!/usr/bin/env node
'use strict';
/**
 * MELAKA FORGE — MISSING LORE-OBJECT SPRITES
 * ==========================================
 * Three of St Paul's seven lore objects have never had a sprite. The chain is:
 *
 *   <id>.location.json loreObjects[].id
 *     -> src/data/historical-objects.json objects[id].sprite
 *       -> a texture key registered from runtime-asset-manifest.json objects.static
 *
 * `crucifix`, `stone-tomb` and `stone-ruins` fall off the end of that chain, so
 * `resolveGameplaySpriteKey` returns `debug-prop-missing` and GameScene skips
 * the placement entirely. The result is three examinable objects that carry
 * real prose — the Jesuit crucifix, Francis Xavier's tomb, the Sultan's palace
 * ruins — and are simply absent from the hill. This file draws them.
 *
 * STYLE. The same law as every other Forge kit: canon hexes only, alpha 0 or
 * 255, one NW sun (up-facing brightest, +ty/down-left lit, +tx/down-right in
 * shadow), selective outline, no Math.random. They are authored at the native
 * grid the objects folder uses (16 wide) and drawn in 2:1 projection so they
 * agree with the plate they stand on — the legacy set was drawn in flat
 * elevation and does not.
 *
 * The rest of `assets/sprites/objects/` is still legacy; these three are the
 * first canon members of that folder, which is why the folder's allowlist entry
 * stays until the whole set is redrawn.
 *
 * CLI
 *   node tools/forge/lore-objects.cjs           render + install
 *   node tools/forge/lore-objects.cjs --check   gates only
 *   node tools/forge/lore-objects.cjs --sheet   also write a review sheet
 */

const fs = require('fs');
const path = require('path');
const P = require('./palette.cjs');
const { Surface } = require('./surface.cjs');
const { hash2 } = require('./iso.cjs');

const REPO = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO, 'assets', 'sprites', 'objects');
const REVIEW_DIR = path.join(REPO, 'docs', 'art-bible', 'forge', 'review');

const ST = P.RAMPS.stone;
const TB = P.RAMPS.timber;
const W = P.RAMPS.whitewash;
const FO = P.RAMPS.foliage;
const EA = P.RAMPS.earth;
const BRASS = P.ACCENTS['brass-gold'];
const FLAME = P.ACCENTS['lantern-flame'];
const SPEC = P.ACCENTS['sun-specular'];
const VOID = P.ANCHORS['shadow-void'];
const VIOLET = P.ANCHORS['shadow-violet'];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const st = (ramp, i) => ramp[clamp(Math.round(i), 0, ramp.length - 1)];
const px = (s, x, y, hex) => { if (hex) s.setHex(Math.round(x), Math.round(y), hex); };

/**
 * A 2:1 isometric box standing on the sprite's baseline. `w` and `d` are the
 * footprint half-extents in px along the two ground axes, `h` the height.
 * Top face brightest, +ty (down-left) lit, +tx (down-right) shadowed — the
 * single light model shared with iso.cjs so these sit in the plate.
 */
function isoBox(s, cx, baseY, w, d, h, ramp, base) {
  // ground diamond corners, in screen px
  const N = { x: cx, y: baseY - (w + d) / 2 };
  const E = { x: cx + w, y: baseY - (w - d) / 2 };
  const S = { x: cx, y: baseY };
  const Wp = { x: cx - d, y: baseY - (d - w) / 2 };
  // faces first (drawn from the bottom up so the top face lands last)
  for (let x = Math.round(Wp.x); x <= Math.round(S.x); x++) {
    const t = (x - Wp.x) / Math.max(1, S.x - Wp.x);
    const y0 = Math.round(Wp.y + (S.y - Wp.y) * t);
    for (let v = 0; v < h; v++) px(s, x, y0 - v, st(ramp, base + (v === h - 1 ? 1 : 0)));
  }
  for (let x = Math.round(S.x); x <= Math.round(E.x); x++) {
    const t = (x - S.x) / Math.max(1, E.x - S.x);
    const y0 = Math.round(S.y + (E.y - S.y) * t);
    for (let v = 0; v < h; v++) px(s, x, y0 - v, st(ramp, base - 2 + (v === h - 1 ? 1 : 0)));
  }
  // top face: scanline-fill the diamond at height h
  const top = [N, E, S, Wp].map((p) => ({ x: p.x, y: p.y - h }));
  fillPoly(s, top, (x, y) => st(ramp, base + 1 + (hash2(x >> 1, y >> 1, 3) < 0.2 ? -1 : 0)));
  return { N, E, S, W: Wp };
}

function fillPoly(s, pts, shade) {
  const ys = pts.map((p) => p.y);
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(s, x, y, shade(x, y));
    }
  }
}

/** Baked contact shadow — a 2-value checker ellipse, offset down-right. */
function contact(s, cx, baseY, rx, ry) {
  for (let y = Math.round(baseY - ry); y <= Math.round(baseY + ry); y++) {
    for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
      const dx = (x - cx - rx * 0.28) / rx, dy = (y - baseY) / ry;
      const q = dx * dx + dy * dy;
      if (q > 1) continue;
      if (!s.inside(x, y)) continue;
      if (s.get(x, y).a === 255) continue;
      px(s, x, y, q > 0.62 ? VOID : ((x + y) & 1) ? VIOLET : VOID);
    }
  }
}

/** Selective outline: void down-right of the form, shadow-violet up-left. */
function outline(s) {
  const src = s.clone();
  const solid = (x, y) => (x >= 0 && y >= 0 && x < s.width && y < s.height && src.get(x, y).a === 255);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (solid(x, y)) continue;
      const up = solid(x, y - 1), left = solid(x - 1, y);
      const down = solid(x, y + 1), right = solid(x + 1, y);
      if (!(up || left || down || right)) continue;
      s.setHex(x, y, ((down || right) && !(up || left)) ? VIOLET : VOID);
    }
  }
}

// ---------------------------------------------------------------------------
const SPRITES = {
  /**
   * `crucifix` — the Jesuit crucifix at the west door. Dark tropical hardwood
   * with a pale corpus and a brass INRI plate; it reads against the whitewashed
   * church because it is the darkest vertical on the porch.
   */
  crucifix: { w: 16, h: 32, draw: (s) => {
    const cx = 8, baseY = 30;
    // stepped stone foot, in projection
    isoBox(s, cx, baseY, 5, 3, 3, ST, 2);
    isoBox(s, cx, baseY - 3, 3, 2, 2, ST, 3);
    // shaft
    for (let y = 6; y <= 25; y++) {
      for (let dx = -1; dx <= 1; dx++) {
        px(s, cx + dx, y, st(TB, dx < 0 ? 3 : dx === 0 ? 2 : 1));
      }
    }
    // arms
    for (let x = 2; x <= 13; x++) {
      px(s, x, 11, st(TB, 3));
      px(s, x, 12, st(TB, 2));
      px(s, x, 13, st(TB, 1));
    }
    px(s, 2, 11, st(TB, 4)); px(s, 13, 13, st(TB, 0));
    // the corpus — three strokes, no face: at 16px a face becomes a smear
    px(s, cx, 9, st(W, 3)); px(s, cx, 10, st(W, 2));
    for (let x = 5; x <= 11; x++) px(s, x, 12, st(W, x < 8 ? 3 : 2));
    for (let y = 13; y <= 18; y++) px(s, cx, y, st(W, 2));
    px(s, cx - 1, 14, st(W, 3)); px(s, cx + 1, 14, st(W, 1));
    px(s, cx - 1, 17, st(W, 3)); px(s, cx + 1, 18, st(W, 1));
    // INRI plate + the halo hit
    px(s, cx - 1, 8, BRASS); px(s, cx, 8, FLAME); px(s, cx + 1, 8, BRASS);
    px(s, cx - 1, 7, BRASS);
    px(s, 6, 12, SPEC);
    contact(s, cx, baseY + 1, 6, 2);
  } },

  /**
   * `stone-tomb` — the ledger tomb kept for Francis Xavier: a raised chest
   * tomb with a moulded plinth and an incised cross on the slab. Low and
   * horizontal on purpose, so it never competes with a headstone.
   */
  'stone-tomb': { w: 16, h: 16, draw: (s) => {
    // Built from the TOP DIAMOND down rather than from a generic box: the slab
    // is the thing you look at, so its ellipse of rows is authored first and
    // the two side faces are hung off its lower edge. Composing it out of two
    // stacked isoBoxes put the slab a pixel adrift of the chest and the whole
    // tomb collapsed into a dark blob.
    const cx = 8, cy = 6, rx = 7, ry = 3, H = 5;
    const halfAt = (x) => ry * (1 - Math.abs(x - cx) / rx);
    // side faces
    for (let x = cx - rx; x <= cx + rx; x++) {
      const hh = halfAt(x);
      if (hh < 0) continue;
      const y0 = Math.round(cy + hh);
      const lit = x < cx;
      for (let v = 0; v < H; v++) {
        let k = lit ? 3 : 1;
        if (v === 0) k += 1;                                  // the oversail lip
        if (v === H - 1) k -= 1;                              // plinth in shade
        if (hash2(x, v, 11) < 0.14) k -= 1;                   // weathering
        px(s, x, y0 + v, st(ST, clamp(k, 0, 4)));
      }
      px(s, x, y0 + H, st(ST, 0));                            // contact course
    }
    // top face
    for (let x = cx - rx; x <= cx + rx; x++) {
      const hh = halfAt(x);
      if (hh < 0) continue;
      for (let y = Math.round(cy - hh); y <= Math.round(cy + hh); y++) {
        // The slab is a LIT plane, not a specular one: pinning the whole top
        // face at the ramp's brightest step blew it out to near-white and the
        // tomb read as a snowdrift. Body at step 3, the highlight sparingly.
        const h = hash2(x, y, 5);
        px(s, x, y, st(ST, h > 0.84 ? 4 : h < 0.16 ? 2 : 3));
      }
    }
    // the incised cross, cut along the slab's own two axes
    for (let k = -4; k <= 4; k++) {
      px(s, cx + k, Math.round(cy + k * ry / rx), st(ST, 1));
      px(s, cx + k, Math.round(cy - k * ry / rx), st(ST, 1));
    }
    px(s, cx, cy, st(ST, 0));
    // a candle stub left at the head
    px(s, 3, 4, st(W, 3)); px(s, 3, 3, FLAME);
    px(s, cx - 4, cy - 2, SPEC);
    contact(s, cx, cy + ry + H + 1, 8, 2);
  } },

  /**
   * `stone-ruins` — what is left of the Sultan's palace on the crest: a broken
   * laterite wall stub with its coursing exposed, a fallen block, and lalang
   * already in the joints. Ruin reads through BROKEN COURSES, not through a
   * grey mass, so the top edge of every stub is stepped and none of them agree.
   */
  'stone-ruins': { w: 16, h: 16, draw: (s) => {
    // TWO STUBS OF A LATERITE WALL, running down-right on the +tx axis, one
    // tall and one low, with a gap between them where the wall has gone. Ruin
    // reads through COURSING AND A BROKEN CROWN — a lump of stone-coloured
    // pixels with grass on top is a hill, which is what the first pass was.
    // The broken profile is AUTHORED, not hashed. At 12 columns a random crown
    // is just noise; a designed one — a standing pier, a robbed-out notch, a
    // second pier — is a wall with a hole in it, and that shape is the whole
    // read at this size.
    const CROWN = [11, 11, 10, 10, 5, 3, 3, 4, 9, 9, 8, 6];
    for (let i = 0; i < CROWN.length; i++) {
      const x = 2 + i;
      const baseY = 13 + Math.round(i * 0.18);
      for (let v = 0; v < CROWN[i]; v++) {
        const y = baseY - v;
        const course = Math.floor(v / 3);
        const jog = (course & 1) ? 2 : 0;                      // stretcher bond
        const block = Math.floor((x + jog) / 4);
        const hb = hash2(block, course, 13);
        let k = 2 + (hb < 0.30 ? -1 : hb > 0.82 ? 1 : 0);
        if (v % 3 === 0) k -= 1;                               // the bed joint
        if ((x + jog) % 4 === 0) k -= 1;                       // the perpend
        if (v === CROWN[i] - 1) k = 4;                         // sunlit break
        if (v === 0) k = 0;                                    // contact course
        px(s, x, y, st(ST, clamp(k, 0, 4)));
      }
    }
    // a fallen block, lying in front of the notch where it came out
    for (let x = 6; x <= 9; x++) {
      const b = 15 - Math.round((x - 6) * 0.4);
      px(s, x, b, st(EA, 1)); px(s, x, b - 1, st(EA, x < 8 ? 3 : 2));
    }
    // lalang in the joints at the FOOT only — grass on the crown reads as turf
    [[1, 14], [10, 15], [14, 14]].forEach(([x, y], i) => {
      for (let k = 0; k < 2; k++) {
        const h = 2 + ((i + k) % 2);
        for (let v = 0; v < h; v++) px(s, x + k, y - v, st(FO, k === 0 ? 3 : 1));
      }
    });
    contact(s, 8, 15, 8, 2);
  } },
};

// ---------------------------------------------------------------------------
function build() {
  return Object.entries(SPRITES).map(([id, spec]) => {
    const s = new Surface(spec.w, spec.h);
    spec.draw(s);
    outline(s);
    return { id, name: `${id}.png`, surface: s };
  });
}

function gate(pieces) {
  const problems = [];
  const canon = new Set(P.CANON.map((c) => `${c.r},${c.g},${c.b}`));
  pieces.forEach((p) => {
    const d = p.surface.data;
    const used = new Set();
    let partial = 0, opaque = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a !== 0 && a !== 255) partial++;
      if (a === 0) continue;
      opaque++;
      used.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    }
    used.forEach((k) => { if (!canon.has(k)) problems.push(`${p.name}: off-canon rgb(${k})`); });
    if (partial) problems.push(`${p.name}: ${partial} partial-alpha pixel(s)`);
    if (!opaque) problems.push(`${p.name}: nothing drawn`);
    p.colours = used.size;
    p.cover = opaque / (p.surface.width * p.surface.height);
  });
  return problems;
}

function contactSheet(pieces, outPath) {
  const { createCanvas } = require('canvas');
  const K = 10, PAD = 16, CELL = 200, HEAD = 64;
  const cv = createCanvas(pieces.length * CELL, HEAD + 32 * K + 60);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#14141C';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#F0E4C8';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('MELAKA FORGE — LORE-OBJECT SPRITES', 16, 34);
  pieces.forEach((p, i) => {
    const cx = i * CELL + PAD;
    ctx.drawImage(p.surface.scaleNearest(K).toCanvas(), cx, HEAD);
    ctx.fillStyle = '#F0E4C8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(p.id, cx, HEAD + 32 * K + 20);
    ctx.fillStyle = '#8892A8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${p.surface.width}x${p.surface.height} · ${p.colours} col`, cx, HEAD + 32 * K + 38);
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, cv.toBuffer('image/png'));
  return outPath;
}

module.exports = { build, gate, SPRITES, OUT_DIR };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const pieces = build();
  const problems = gate(pieces);
  console.log(`Forge lore-object sprites — ${pieces.length} sprite(s)`);
  pieces.forEach((p) => console.log(
    `  ${p.id.padEnd(14)} ${p.surface.width}x${p.surface.height}  ${p.colours} col  ${(p.cover * 100).toFixed(0)}% cover`));
  if (problems.length) {
    console.error('\nFAILED GATES:');
    problems.forEach((x) => console.error('  ! ' + x));
    process.exit(1);
  }
  if (!argv.includes('--check')) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    pieces.forEach((p) => p.surface.writePNG(path.join(OUT_DIR, p.name)));
    console.log(`\ninstalled ${pieces.length} file(s) into ${path.relative(REPO, OUT_DIR)}`);
  }
  if (argv.includes('--sheet')) {
    console.log('review sheet: ' + path.relative(REPO, contactSheet(pieces, path.join(REVIEW_DIR, 'lore-objects.png'))));
  }
  console.log('all lore-object gates pass');
}
