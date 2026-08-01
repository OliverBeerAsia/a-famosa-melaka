#!/usr/bin/env node
'use strict';
/**
 * STAGE 4 — HAND EDITS ON TOP OF install-plate.cjs
 * ================================================
 * install-plate folds the compositor's output into the location files, but
 * three things are DESIGN decisions it cannot make, and Stage 3 established
 * that its automatic answers are wrong:
 *
 *   1. spawnAt for exits into a plate whose size just changed. The layout files
 *      only carry correct values where the author knew the target's new size;
 *      rua-direita's were authored against the old 320x180 A Famosa and
 *      waterfront, so they are hand-mirrored onto the reciprocal exit here.
 *   2. Where an item or a lore object stands. install-plate's nearest-walkable
 *      snap lines them up along walls; each one below is placed against the
 *      painted prop it describes (see plateProps in the location file).
 *   3. Crowd budget, which scales with the world, not with the path count.
 *
 * Keeping them in a script rather than in the JSON means a re-render of the
 * plates costs one install + one run of this, instead of an afternoon.
 *
 *   node tools/forge/stage4-handedits.cjs          apply + verify
 *   node tools/forge/stage4-handedits.cjs --check  verify only
 */
const fs = require('fs');
const path = require('path');
const { mask, nearest, CONTACT } = require('./probe-walk.cjs');

const ROOT = path.resolve(__dirname, '../..');
const CHECK = process.argv.includes('--check');

/** Exits whose spawnAt must be mirrored onto the reciprocal exit by hand. */
const SPAWN_AT = {
  'rua-direita': {
    // west street  -> mouth of A Famosa's east gate (its 624,288 trigger)
    'a-famosa-gate@0': [600, 305],
    // east street  -> head of the waterfront's west quay (its 0,314 trigger)
    'waterfront@0': [34, 325],
    // south gate   -> just inside A Famosa's arch (its 300,190 trigger)
    'a-famosa-gate@1': [320, 222],
    // church steps -> the churchyard, clear of St Paul's own 268,344 exit
    'st-pauls-church@0': [320, 325],
  },
  'a-famosa-gate': {
    // service gate -> the waterfront shore road, clear of the frame edge
    'waterfront@0': [132, 330],
  },
  waterfront: {
    // north path -> the kampung's shore track, below its own trigger
    'kampung@0': [320, 135],
  },
  'st-pauls-church': {
    // down the hill -> the head of Rua Direita's stair (its 484,126 trigger)
    'rua-direita@0': [512, 150],
  },
};

/** NPC positions the compositor put a hair inside a wall. */
const NPCS = { waterfront: { rashid: [131, 229], 'lin-mei': [428, 277] } };

const CROWD = { 'rua-direita': 14, waterfront: 14, 'a-famosa-gate': 12, kampung: 10, 'st-pauls-church': 8 };

/** items + loreObjects, each set against the painted prop it belongs to. */
const ANCHORS = {
  waterfront: {
    'portuguese-carrack-model': [568, 261],   // customs shed
    'chinese-abacus': [620, 270],             // Chinese signboard
    'bonded-warehouse-ledger': [492, 290],    // godown
    'quay-service-lantern': [334, 278],       // lantern post
    'dock-tally-board': [274, 239],           // quay crane
    'bonded-chest': [478, 297],               // crate stack
    'chinese-junk-anchor': [290, 220],        // anchor stock
    'porcelain-vase': [261, 290],             // amphora
    'incense-burner': [606, 308],             // pot row by the guild house
    'dhow-sail': [36, 342],                   // beached perahu
    'tin-ingots': [466, 279],                 // bale stack
    'carrack-rigging': [213, 263],            // rope coil
    'harbor-customs-ledger': [366, 288],      // godown
    'junk-batten-sail': [525, 268],           // sack pile, eastern pier
    'quay-pilot-lantern': [128, 344],         // outer lantern post
    'coin-pouch-2': [270, 334],               // market stall
    'bribe-note-1': [352, 292],               // godown door
  },
  kampung: {
    'keris-display': [219, 183],              // stilt house
    'gamelan-gong': [302, 228],               // shade tree
    'malay-manuscript': [500, 236],           // surau
    'medicine-chest': [146, 215],             // drying rack / healer's verandah
    'rice-mortar': [250, 258],                // baskets
    'fish-trap': [190, 316],                  // beached perahu
    'prayer-mat': [476, 236],                 // surau
    'wayang-kulit-puppet': [286, 288],        // market stall
    'surau-prayer-niche': [452, 236],         // surau
    'batik-cloth': [530, 248],                // drying rack
    'healers-herb-rack': [245, 301],          // drying rack
    'ablution-jar': [418, 237],               // amphora
    'coastal-fish-rack': [108, 316],          // shore
    'herbs-1': [228, 299],                    // drying rack
  },
  'a-famosa-gate': {
    'portuguese-coat-of-arms': [300, 212],    // the gate arch
    'albuquerque-plaque': [270, 282],         // padrao
    'cannon-bronze': [94, 248],               // cannon
    'powder-magazine-cask': [53, 263],        // powder store
    'fortress-watch-lantern': [590, 233],     // east lantern post
    'fortress-banner-line': [540, 240],       // wall by the town approach
    'gate-customs-ledger': [226, 225],        // sentry box
    'service-route-lantern': [318, 313],      // lantern on the service route
    'seized-goods-chest': [120, 324],         // market stall
    'inspection-scale': [408, 272],           // pelourinho
    'cargo-manifest-1': [206, 227],           // sentry box
    'key-warehouse-1': [184, 307],            // praca well
  },
  'st-pauls-church': {
    'jesuit-crucifix': [392, 196],            // church door
    'francis-xavier-tomb': [56, 232],         // tomb slab
    'grave-portuguese': [168, 306],           // gravestone
    'sultan-palace-ruins': [16, 196],         // the old terrace wall
    'processional-cross': [136, 250],         // stone cross
    'mission-study-lantern': [574, 233],      // east lantern post
    'schoolyard-bench': [232, 194],           // bench
    'rosary-1': [290, 307],                   // churchyard well
  },
};

const locFile = (id) => path.join(ROOT, 'src/data/locations', `${id}.location.json`);
const read = (id) => JSON.parse(fs.readFileSync(locFile(id), 'utf8'));
const write = (id, doc) => fs.writeFileSync(locFile(id), JSON.stringify(doc, null, 2) + '\n');

const problems = [];
const changes = [];

// ---------------------------------------------------------------------------
for (const [id, budget] of Object.entries(CROWD)) {
  const doc = read(id);
  if (doc.crowd.maxCrowd !== budget) {
    changes.push(`${id}: crowd.maxCrowd ${doc.crowd.maxCrowd} -> ${budget}`);
    doc.crowd.maxCrowd = budget;
    if (!CHECK) write(id, doc);
  }
}

for (const [id, byNpc] of Object.entries(NPCS)) {
  const doc = read(id);
  let dirty = false;
  for (const [npc, [x, y]] of Object.entries(byNpc)) {
    const p = doc.npcs[npc];
    if (!p) { problems.push(`${id}: npc ${npc} not in the location file`); continue; }
    if (p.x !== x || p.y !== y) {
      changes.push(`${id}: npcs.${npc} (${p.x},${p.y}) -> (${x},${y})`);
      doc.npcs[npc] = { x, y };
      dirty = true;
    }
  }
  if (dirty && !CHECK) write(id, doc);
}

for (const [id, byTarget] of Object.entries(SPAWN_AT)) {
  const doc = read(id);
  const seen = {};
  let dirty = false;
  doc.transitions.forEach((t) => {
    const n = (seen[t.targetLocation] = (seen[t.targetLocation] ?? -1) + 1);
    const want = byTarget[`${t.targetLocation}@${n}`];
    if (!want) return;
    if (t.spawnAt.x !== want[0] || t.spawnAt.y !== want[1]) {
      changes.push(`${id}: -> ${t.targetLocation}[${n}] spawnAt (${t.spawnAt.x},${t.spawnAt.y}) -> (${want[0]},${want[1]})`);
      t.spawnAt = { x: want[0], y: want[1] };
      dirty = true;
    }
  });
  if (dirty && !CHECK) write(id, doc);
}

for (const [id, byId] of Object.entries(ANCHORS)) {
  const doc = read(id);
  let dirty = false;
  const seen = new Set();
  for (const list of ['items', 'loreObjects']) {
    for (const e of doc[list] || []) {
      const want = byId[e.id];
      if (!want) continue;
      seen.add(e.id);
      if (e.x !== want[0] || e.y !== want[1]) {
        changes.push(`${id}: ${list} ${e.id} (${e.x},${e.y}) -> (${want[0]},${want[1]})`);
        e.x = want[0]; e.y = want[1];
        dirty = true;
      }
    }
  }
  Object.keys(byId).filter((k) => !seen.has(k))
    .forEach((k) => problems.push(`${id}: anchor "${k}" matches nothing in items/loreObjects`));
  if (dirty && !CHECK) write(id, doc);
}

// ---------------------------------------------------------------------------
// Objective-marker anchors are DERIVED (native px * world.scale), and a plate
// rebuild moves every NPC under them. tests/ObjectiveMarkerIntegrity guards the
// drift; this keeps them in sync so the guard never has to fire.
{
  const file = path.join(ROOT, 'src/data/objective-markers.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  let dirty = false;
  for (const id of Object.keys(doc.anchors || {})) {
    const loc = read(id);
    const s = loc.world.scale;
    const a = doc.anchors[id];
    const set = (key, x, y) => {
      if (a[key] && a[key].x === x && a[key].y === y) return;
      changes.push(`objective-markers: ${id}.${key} ${a[key] ? `(${a[key].x},${a[key].y})` : '(new)'} -> (${x},${y})`);
      a[key] = { x, y };
      dirty = true;
    };
    Object.entries(loc.npcs || {}).forEach(([npc, p]) => set(`npc:${npc}`, p.x * s, p.y * s));
    // The location-level anchor is "go to this place" — the authored spawn.
    set(`location:${id}`, loc.spawns.player.x * s, loc.spawns.player.y * s);
  }
  if (dirty && !CHECK) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Verify everything that has to stand on walkable ground actually does. The
// walk mask changes with every re-render, so this is the part that has to run
// again even when nothing above changed.
console.log(changes.length ? changes.map((c) => `  ${c}`).join('\n') : '  (no changes)');
console.log('\nwalkability check (feet at origin + ' + CONTACT + ' native px):');

const ids = [...new Set([...Object.keys(ANCHORS), ...Object.keys(SPAWN_AT), ...Object.keys(NPCS)])];
const masks = {};
const maskFor = (id) => (masks[id] || (masks[id] = mask(id)));

for (const id of ids) {
  const doc = read(id);
  const m = maskFor(id);
  const check = (what, x, y) => {
    if (m.feet(x, y)) return;
    const n = nearest(m, x, y, 40);
    problems.push(`${id}: ${what} at (${x},${y}) is NOT walkable at the feet` +
      (n ? ` — nearest is (${n.x},${n.y}), ${n.moved}px away` : ' — nothing walkable within 40px'));
  };
  (doc.items || []).forEach((e) => check(`items.${e.id}`, e.x, e.y));
  (doc.loreObjects || []).forEach((e) => check(`loreObjects.${e.id}`, e.x, e.y));
  Object.entries(doc.npcs || {}).forEach(([k, p]) => check(`npcs.${k}`, p.x, p.y));
  check('spawns.player', doc.spawns.player.x, doc.spawns.player.y);
}
// Inbound spawnAt is checked against the TARGET's mask.
for (const id of ['rua-direita', 'a-famosa-gate', 'waterfront', 'kampung', 'st-pauls-church']) {
  const doc = read(id);
  doc.transitions.forEach((t) => {
    const target = read(t.targetLocation);
    if (!target.plate.walkMask) return;
    const m = maskFor(t.targetLocation);
    if (m.feet(t.spawnAt.x, t.spawnAt.y)) return;
    const n = nearest(m, t.spawnAt.x, t.spawnAt.y, 40);
    problems.push(`${id} -> ${t.targetLocation}: spawnAt (${t.spawnAt.x},${t.spawnAt.y}) is NOT walkable in the target` +
      (n ? ` — nearest is (${n.x},${n.y}), ${n.moved}px away` : ' — nothing walkable within 40px'));
  });
}

if (problems.length) {
  problems.forEach((p) => console.log(`  FAIL ${p}`));
  console.log(`\n${problems.length} problem(s) — fix the tables above, then re-run.`);
  process.exit(1);
}
console.log('  all clear');
