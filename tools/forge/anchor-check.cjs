#!/usr/bin/env node
'use strict';
/**
 * Scratch: report, for a proposed anchor list, whether each point is on
 * walkable ground at feet level and — for lore objects, which only need to be
 * REACHABLE — how far the nearest walkable ground is.
 *
 *   node tools/forge/anchor-check.cjs <id> < JSON [[label,x,y],...] on stdin
 */
const { mask, nearest, CONTACT } = require('./probe-walk.cjs');

const id = process.argv[2];
let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  const m = mask(id);
  const list = JSON.parse(raw);
  let bad = 0;
  for (const [label, x, y] of list) {
    const ok = m.feet(x, y);
    if (ok) { console.log(`  OK      ${label.padEnd(28)} (${x},${y})`); continue; }
    const n = nearest(m, x, y, 40);
    bad++;
    console.log(`  BLOCKED ${label.padEnd(28)} (${x},${y})  nearest walkable origin ${n ? `(${n.x},${n.y}) ${n.moved}px` : '>40px away'}`);
  }
  console.log(`  ${list.length - bad}/${list.length} on walkable ground (contact offset ${CONTACT})`);
});
