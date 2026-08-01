#!/usr/bin/env node
/**
 * ONE-SHOT CODEMOD — unified location data.
 *
 * Merges every per-location authoring source that existed before Stage 1 into
 * `src/data/locations/<id>.location.json`:
 *
 *   src/data/location-scenes.json ............ plate, collision, spawns, transitions, audio keys
 *   src/data/environment-objects.json ........ legacyProps  -> props
 *   src/data/items.json ...................... world-items  -> items
 *   src/data/historical-objects.json ......... positions    -> loreObjects
 *   GameScene.ts LOCATION_LIGHTS ............. -> lights
 *   GameScene.ts firePositions ............... -> fires
 *   GameScene.ts DEFAULT_LOCATION_AUDIO ...... -> audio
 *   GameScene.ts LOCATION_TINT ............... -> visual.transitionTint
 *   GameScene.ts TRANSITION_SOUNDS ........... -> audio.transitionSound
 *   EnvironmentObjectSystem.ts ANIMATED_OBJECTS -> animatedProps
 *   visualProfile.ts LOCATION_VISUAL_PRESETS . -> visual
 *   CrowdSystem.ts LOCATION_CONFIGS .......... -> crowd
 *
 * ALL coordinates are converted from 960x540 screen pixels to NATIVE 320x180
 * plate pixels by dividing by `world.scale` (3). The engine multiplies once, in
 * core/LocationData.ts. Any coordinate that lands outside the native canvas (or
 * inside a collision rect, for spawn-like coords) is clamped to the nearest
 * in-bounds walkable value and listed in tools/migration-report.md.
 *
 * Usage: node tools/migrate-location-data.cjs [--dry]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'locations');
const REPORT = path.join(ROOT, 'tools', 'migration-report.md');

const SCALE = 3;
const NATIVE_W = 320;
const NATIVE_H = 180;

const DRY = process.argv.includes('--dry');

// ---------------------------------------------------------------------------
// TS table extraction
// ---------------------------------------------------------------------------

/**
 * Pull a top-level `const NAME ... = { ... }` object literal out of a TS source
 * file and eval it. The tables involved are plain data (strings, numbers, hex
 * literals, nested objects/arrays), so this is safe and exact for a one-shot.
 */
function extractObjectLiteral(source, declRegex, label) {
  const match = declRegex.exec(source);
  if (!match) throw new Error(`Could not locate ${label}`);
  const open = source.indexOf('{', match.index + match[0].length - 1);
  if (open < 0) throw new Error(`Could not locate opening brace of ${label}`);

  let depth = 0;
  let inString = null;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const literal = source.slice(open, i + 1);
        // Strip trailing TS assertions that can appear inside values.
        const cleaned = literal.replace(/ as [A-Za-z][\w.]*/g, '');
        // SAFETY: this is a developer-run, one-shot codemod. The only input is
        // first-party TypeScript source already checked into this repo, and the
        // extracted spans are pure data literals (strings/numbers/nested
        // objects). No user or network input ever reaches here, so eval is the
        // pragmatic way to read TS object literals without adding a parser dep.
        // eslint-disable-next-line no-eval
        return eval(`(${cleaned})`);
      }
    }
  }
  throw new Error(`Unbalanced braces while reading ${label}`);
}

function readSource(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const gameSceneSrc = readSource('src/phaser/scenes/GameScene.ts');
const envObjSrc = readSource('src/phaser/systems/EnvironmentObjectSystem.ts');
const visualProfileSrc = readSource('src/phaser/visualProfile.ts');
const crowdSrc = readSource('src/phaser/systems/CrowdSystem.ts');

const TABLES = {
  DEFAULT_LOCATION_AUDIO: extractObjectLiteral(
    gameSceneSrc, /const DEFAULT_LOCATION_AUDIO[^=]*=\s*/, 'DEFAULT_LOCATION_AUDIO'),
  firePositions: extractObjectLiteral(
    gameSceneSrc, /const firePositions[^=]*=\s*/, 'firePositions'),
  LOCATION_LIGHTS: extractObjectLiteral(
    gameSceneSrc, /const LOCATION_LIGHTS[^=]*=\s*/, 'LOCATION_LIGHTS'),
  LOCATION_TINT: extractObjectLiteral(
    gameSceneSrc, /readonly LOCATION_TINT[^=]*=\s*/, 'LOCATION_TINT'),
  TRANSITION_SOUNDS: extractObjectLiteral(
    gameSceneSrc, /readonly TRANSITION_SOUNDS[^=]*=\s*/, 'TRANSITION_SOUNDS'),
  ANIMATED_OBJECTS: extractObjectLiteral(
    envObjSrc, /const ANIMATED_OBJECTS[^=]*=\s*/, 'ANIMATED_OBJECTS'),
  LOCATION_VISUAL_PRESETS: extractObjectLiteral(
    visualProfileSrc, /const LOCATION_VISUAL_PRESETS[^=]*=\s*/, 'LOCATION_VISUAL_PRESETS'),
  LOCATION_CONFIGS: extractObjectLiteral(
    crowdSrc, /const LOCATION_CONFIGS[^=]*=\s*/, 'LOCATION_CONFIGS'),
};

// ---------------------------------------------------------------------------
// JSON sources
// ---------------------------------------------------------------------------

function readJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

const scenes = readJSON('src/data/location-scenes.json');
const environment = readJSON('src/data/environment-objects.json').locations || {};
const worldItems = readJSON('src/data/items.json')['world-items'] || {};
const historical = readJSON('src/data/historical-objects.json').objects || {};
const worldMeta = readJSON('src/data/locations/world.json').locations || {};

const LOCATION_IDS = Object.keys(scenes);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const report = [];
function flag(locationId, kind, what, from, to, why) {
  report.push({ locationId, kind, what, from, to, why });
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

const toNative = (v) => Math.round(v / SCALE);
/** Collision rects round consistently so edges still meet the canvas border. */
const rectToNative = (r) => ({
  x: Math.round(r.x / SCALE),
  y: Math.round(r.y / SCALE),
  width: Math.round(r.width / SCALE),
  height: Math.round(r.height / SCALE),
});

/**
 * Walkable native bounding box, derived from the perimeter collision rects:
 * the largest axis-aligned box that no full-width/full-height wall covers.
 */
function walkableBox(rects) {
  let minX = 0, minY = 0, maxX = NATIVE_W, maxY = NATIVE_H;
  for (const r of rects) {
    const spansFullHeight = r.y <= 0 && r.y + r.height >= NATIVE_H;
    const spansFullWidth = r.x <= 0 && r.x + r.width >= NATIVE_W;
    if (spansFullWidth && !spansFullHeight) {
      if (r.y <= minY) minY = Math.max(minY, r.y + r.height);
      else maxY = Math.min(maxY, r.y);
    } else if (spansFullHeight && !spansFullWidth) {
      if (r.x <= minX) minX = Math.max(minX, r.x + r.width);
      else maxX = Math.min(maxX, r.x);
    }
  }
  return { minX, minY, maxX, maxY };
}

function clampPoint(locationId, kind, what, x, y, box, why) {
  const cx = Math.min(Math.max(x, box.minX + 2), box.maxX - 2);
  const cy = Math.min(Math.max(y, box.minY + 2), box.maxY - 2);
  if (cx !== x || cy !== y) {
    flag(locationId, kind, what, `${x},${y}`, `${cx},${cy}`, why);
  }
  return { x: cx, y: cy };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function normalizeAmbient(list) {
  return (list || []).map((entry) =>
    typeof entry === 'string' ? { key: entry, volume: 0.3 } : { ...entry });
}

const built = {};

for (const id of LOCATION_IDS) {
  const scene = scenes[id];
  const audioTable = TABLES.DEFAULT_LOCATION_AUDIO[id] || {};
  const visualPreset = TABLES.LOCATION_VISUAL_PRESETS[id] || {};
  const crowdConfig = TABLES.LOCATION_CONFIGS[id] || {};

  const collisionRects = (scene.collisionRects || []).map(rectToNative);
  const box = walkableBox(collisionRects);

  // --- spawns -------------------------------------------------------------
  const playerNative = {
    x: toNative(scene.playerStart.x),
    y: toNative(scene.playerStart.y),
  };
  const player = clampPoint(id, 'spawn', 'player', playerNative.x, playerNative.y, box,
    'playerStart outside the walkable box');

  const npcs = {};
  for (const [npcId, pos] of Object.entries(scene.npcPositions || {})) {
    const p = clampPoint(id, 'npc', npcId, toNative(pos.x), toNative(pos.y), box,
      'npc spawn outside the walkable box');
    npcs[npcId] = p;
  }

  // --- transitions --------------------------------------------------------
  const transitions = (scene.transitions || []).map((t) => {
    const spawn = clampPoint(id, 'transition', `${t.targetLocation} spawnAt`,
      toNative(t.spawnAt.x), toNative(t.spawnAt.y), box,
      'transition spawnAt outside the walkable box');
    const out = {
      targetLocation: t.targetLocation,
      label: t.label,
      triggerArea: rectToNative(t.triggerArea),
      spawnAt: spawn,
    };
    if (t.requirements) out.requirements = t.requirements;
    if (t.showWhenLocked !== undefined) out.showWhenLocked = t.showWhenLocked;
    if (t.lockedLabel) out.lockedLabel = t.lockedLabel;
    if (t.blockedMessage) out.blockedMessage = t.blockedMessage;
    return out;
  });

  // --- props --------------------------------------------------------------
  const props = ((environment[id] || {}).legacyProps || []).map((p) => {
    const nx = toNative(p.x);
    const ny = toNative(p.y);
    const c = { x: Math.min(Math.max(nx, 0), NATIVE_W), y: Math.min(Math.max(ny, 0), NATIVE_H) };
    if (c.x !== nx || c.y !== ny) {
      flag(id, 'prop', p.sprite, `${nx},${ny}`, `${c.x},${c.y}`, 'prop outside the native canvas');
    }
    const out = { sprite: p.sprite, x: c.x, y: c.y };
    if (p.scale !== undefined) out.scale = p.scale;
    if (p.examineText) out.examineText = p.examineText;
    if (p.particles) out.particles = p.particles;
    return out;
  });

  // --- animated props -----------------------------------------------------
  const animatedProps = (TABLES.ANIMATED_OBJECTS[id] || []).map((a) => {
    const nx = toNative(a.x);
    const ny = toNative(a.y);
    const c = { x: Math.min(Math.max(nx, 0), NATIVE_W), y: Math.min(Math.max(ny, 0), NATIVE_H) };
    if (c.x !== nx || c.y !== ny) {
      flag(id, 'animatedProp', a.type, `${nx},${ny}`, `${c.x},${c.y}`, 'animated prop outside the native canvas');
    }
    return { type: a.type, x: c.x, y: c.y };
  });

  // --- lights -------------------------------------------------------------
  const lights = (TABLES.LOCATION_LIGHTS[id] || []).map((l, i) => {
    const nx = toNative(l.x);
    const ny = toNative(l.y);
    const c = { x: Math.min(Math.max(nx, 4), NATIVE_W - 4), y: Math.min(Math.max(ny, 4), NATIVE_H - 4) };
    if (c.x !== nx || c.y !== ny) {
      flag(id, 'light', `${l.type}#${i}`, `${nx},${ny}`, `${c.x},${c.y}`,
        'night light off-canvas (authored for the old ~1920px world)');
    }
    return { type: l.type, x: c.x, y: c.y };
  });

  // --- fires --------------------------------------------------------------
  const fires = (TABLES.firePositions[id] || []).map((f, i) => {
    const nx = toNative(f.x);
    const ny = toNative(f.y);
    const c = { x: Math.min(Math.max(nx, 4), NATIVE_W - 4), y: Math.min(Math.max(ny, 4), NATIVE_H - 4) };
    if (c.x !== nx || c.y !== ny) {
      flag(id, 'fire', `fire#${i}`, `${nx},${ny}`, `${c.x},${c.y}`, 'fire emitter off-canvas');
    }
    return c;
  });

  // --- crowd --------------------------------------------------------------
  // Crowd paths intentionally start/end just off the visible edge so extras
  // walk in and out. Allow a margin, but anything far outside is rotten data
  // authored for the abandoned ~1920x1080 scrolling world.
  const OFFSCREEN_MARGIN = 20;
  const clampPathPoint = (pt, label) => {
    const nx = toNative(pt.x);
    const ny = toNative(pt.y);
    const cx = Math.min(Math.max(nx, -OFFSCREEN_MARGIN), NATIVE_W + OFFSCREEN_MARGIN);
    const cy = Math.min(Math.max(ny, box.minY + 2), box.maxY - 2);
    if (cx !== nx || cy !== ny) {
      flag(id, 'crowdPath', label, `${nx},${ny}`, `${cx},${cy}`,
        'crowd path off the visible plate (extras walked below/outside the screen)');
    }
    return { x: cx, y: cy };
  };

  const crowd = {
    maxCrowd: crowdConfig.maxCrowd ?? 6,
    density: crowdConfig.density ?? 0.5,
    crowdTypes: crowdConfig.crowdTypes || [],
    paths: (crowdConfig.paths || []).map((p, i) => ({
      start: clampPathPoint(p.start, `path#${i}.start`),
      end: clampPathPoint(p.end, `path#${i}.end`),
    })),
  };

  // --- items --------------------------------------------------------------
  const items = (worldItems[id] || []).map((it) => {
    const p = clampPoint(id, 'item', it.id, toNative(it.x), toNative(it.y), box,
      'world item outside the walkable box');
    return { id: it.id, itemId: it.itemId, x: p.x, y: p.y, description: it.description };
  });

  // --- lore objects -------------------------------------------------------
  const loreObjects = Object.values(historical)
    .filter((o) => o.location === id)
    .map((o) => {
      const nx = toNative(o.position?.x ?? 0);
      const ny = toNative(o.position?.y ?? 0);
      const cx = Math.min(Math.max(nx, 8), NATIVE_W - 8);
      const cy = Math.min(Math.max(ny, 8), NATIVE_H - 8);
      if (cx !== nx || cy !== ny) {
        flag(id, 'loreObject', o.id, `${nx},${ny}`, `${cx},${cy}`,
          'lore object off the native plate (silently dropped at runtime)');
      }
      return { id: o.id, x: cx, y: cy };
    });

  // --- assemble -----------------------------------------------------------
  built[id] = {
    id,
    name: worldMeta[id]?.name || id,
    world: {
      scale: SCALE,
      nativeWidth: NATIVE_W,
      nativeHeight: NATIVE_H,
    },
    plate: {
      background: scene.background,
      variants: scene.variants || {},
      runtimeMode: scene.projection?.runtimeMode || 'legacy-backdrop',
      targetMode: scene.projection?.targetMode || 'isometric-2:1',
      authoringBasis: scene.projection?.authoringBasis || 'isometric-grid',
      anchor: scene.projection?.anchor || 'bottom-center',
      depthStrategy: scene.projection?.depthStrategy || 'screen-y',
      tileWidth: scene.projection?.tileWidth ?? 64,
      tileHeight: scene.projection?.tileHeight ?? 32,
      isoMapKey: scene.isoMapKey,
      mapFile: scene.mapFile,
    },
    collision: { rects: collisionRects },
    spawns: { player },
    npcs,
    transitions,
    props,
    animatedProps,
    lights,
    fires,
    audio: {
      music: scene.music || audioTable.music,
      nightMusic: scene.nightMusic || audioTable.nightMusic,
      ambientSounds: normalizeAmbient(audioTable.ambientSounds || scene.ambientSounds),
      nightAmbientSounds: normalizeAmbient(audioTable.nightAmbientSounds || scene.nightAmbientSounds),
      footstepSurface: scene.footstepSurface || audioTable.footstepSurface || 'stone',
      transitionSound: TABLES.TRANSITION_SOUNDS[id] || null,
    },
    visual: {
      transitionTint: TABLES.LOCATION_TINT[id] || [0, 0, 0],
      fogTint: visualPreset.fogTint,
      fogSpeed: visualPreset.fogSpeed,
      hazeTint: visualPreset.hazeTint,
      sunAnchor: visualPreset.sunAnchor
        ? { x: toNative(visualPreset.sunAnchor.x), y: toNative(visualPreset.sunAnchor.y) }
        : { x: 80, y: 28 },
      aoZones: (visualPreset.aoZones || []).map((z) => ({ ...rectToNative(z), alpha: z.alpha })),
      canopyShadows: (visualPreset.canopyShadows || []).map((z) => ({ ...rectToNative(z), alpha: z.alpha })),
    },
    crowd,
    items,
    loreObjects,
  };
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

if (!DRY) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [id, data] of Object.entries(built)) {
    fs.writeFileSync(path.join(OUT_DIR, `${id}.location.json`), JSON.stringify(data, null, 2) + '\n');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'),
    JSON.stringify({ locations: LOCATION_IDS }, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const byLocation = {};
for (const r of report) (byLocation[r.locationId] ||= []).push(r);

let md = `# Location data migration report\n\n`;
md += `Generated by \`tools/migrate-location-data.cjs\`.\n\n`;
md += `Screen-pixel (960x540) coordinates from the pre-Stage-1 sources were divided by `;
md += `\`world.scale\` (${SCALE}) into native ${NATIVE_W}x${NATIVE_H} plate pixels. Coordinates that landed `;
md += `outside the native canvas (or outside the location's walkable box) were clamped to the `;
md += `nearest in-bounds value and are listed below — these are the "rotten coordinates" the audit `;
md += `identified, mostly authored for an abandoned ~1920x1080 scrolling world.\n\n`;
md += `**Total clamped coordinates: ${report.length}**\n\n`;

const kindCounts = {};
for (const r of report) kindCounts[r.kind] = (kindCounts[r.kind] || 0) + 1;
md += `| Kind | Clamped |\n|---|---|\n`;
for (const [k, v] of Object.entries(kindCounts).sort((a, b) => b[1] - a[1])) {
  md += `| ${k} | ${v} |\n`;
}
md += `\n`;

for (const id of LOCATION_IDS) {
  const rows = byLocation[id] || [];
  md += `## ${id}\n\n`;
  if (!rows.length) {
    md += `No out-of-bounds coordinates.\n\n`;
    continue;
  }
  md += `| Kind | What | Native (was) | Native (clamped) | Why |\n|---|---|---|---|---|\n`;
  for (const r of rows) {
    md += `| ${r.kind} | ${r.what} | ${r.from} | ${r.to} | ${r.why} |\n`;
  }
  md += `\n`;
}

md += `## Follow-up\n\n`;
md += `Clamping only makes coordinates *legal*, not *good*. Crowd paths and night lights were `;
md += `re-anchored by hand onto visible walkable ground / plausible light sources in a manual pass `;
md += `after this codemod ran (milestone M1 "visible city"). Re-running this codemod would `;
md += `overwrite that hand work — it is a one-shot, kept for provenance.\n`;

if (!DRY) fs.writeFileSync(REPORT, md);

console.log(`[migrate] wrote ${LOCATION_IDS.length} location files to ${path.relative(ROOT, OUT_DIR)}`);
console.log(`[migrate] ${report.length} coordinates clamped — see ${path.relative(ROOT, REPORT)}`);
for (const [k, v] of Object.entries(kindCounts)) console.log(`           ${k}: ${v}`);
