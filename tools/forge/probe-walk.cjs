#!/usr/bin/env node
'use strict';
/**
 * Scratch probe for hand-anchoring spawns/items against a walk mask.
 *
 *   node tools/forge/probe-walk.cjs <location-id> <x> <y> [<x> <y> ...]
 *
 * Reports, per point, whether the FEET (origin + 15 native px, matching
 * validate-location-data's CONTACT_OFFSET_NATIVE and GameScene's sampling)
 * land on walkable ground, and the nearest origin that would.
 */
const fs = require('fs');
const path = require('path');
const { createCanvas, Image } = require('canvas');

const ROOT = path.resolve(__dirname, '../..');
const CONTACT = 15;

function mask(id) {
  const loc = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/locations', `${id}.location.json`), 'utf8'));
  const img = new Image();
  img.src = fs.readFileSync(path.join(ROOT, 'assets/scenes/masks', `${loc.plate.walkMask}.png`));
  const cv = createCanvas(img.width, img.height);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  const at = (x, y) => {
    const px = Math.round(x); const py = Math.round(y);
    if (px < 0 || py < 0 || px >= img.width || py >= img.height) return false;
    return data[(py * img.width + px) * 4] >= 128;
  };
  return { loc, w: img.width, h: img.height, at, feet: (x, y) => at(x, y + CONTACT) };
}

function nearest(m, x, y, maxR = 80) {
  if (m.feet(x, y)) return { x, y, moved: 0 };
  let best = null;
  for (let r = 1; r <= maxR && !best; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!m.feet(x + dx, y + dy)) continue;
        const d2 = dx * dx + dy * dy;
        if (!best || d2 < best.d2) best = { x: x + dx, y: y + dy, moved: r, d2 };
      }
    }
  }
  return best;
}

if (require.main === module) {
  const [id, ...rest] = process.argv.slice(2);
  const m = mask(id);
  console.log(`${id}: mask ${m.w}x${m.h}`);
  for (let i = 0; i < rest.length; i += 2) {
    const x = Number(rest[i]); const y = Number(rest[i + 1]);
    const ok = m.feet(x, y);
    const n = ok ? null : nearest(m, x, y);
    console.log(`  (${x},${y}) feet(${x},${y + CONTACT}) ${ok ? 'WALKABLE' : 'BLOCKED -> nearest ' + (n ? `(${n.x},${n.y}) [${n.moved}px]` : 'none within 80px')}`);
  }
}

module.exports = { mask, nearest, CONTACT };
