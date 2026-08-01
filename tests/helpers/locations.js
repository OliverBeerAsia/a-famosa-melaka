/**
 * Test helper — reads the unified location data
 * (`src/data/locations/<id>.location.json`) and returns it in the 960x540
 * SCREEN space the engine renders in, by multiplying every native coordinate by
 * `world.scale` exactly the way `src/phaser/core/LocationData.ts` does.
 *
 * Tests that assert against other screen-space data (objective-markers.json)
 * should use `loadLocationsScreenSpace()`; tests that only care about structure
 * can use `loadLocationsNative()`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOCATIONS_DIR = path.join(__dirname, '..', '..', 'src', 'data', 'locations');

/** Raw location files, keyed by id, with coordinates still in native plate px. */
export function loadLocationsNative() {
  const out = {};
  for (const file of fs.readdirSync(LOCATIONS_DIR)) {
    if (!file.endsWith('.location.json')) continue;
    const id = file.replace(/\.location\.json$/, '');
    out[id] = JSON.parse(fs.readFileSync(path.join(LOCATIONS_DIR, file), 'utf8'));
  }
  return out;
}

const scalePoint = (p, s) => ({ x: p.x * s, y: p.y * s });
const scaleRect = (r, s) => ({
  x: r.x * s, y: r.y * s, width: r.width * s, height: r.height * s,
});

/** Locations with every coordinate multiplied into 960x540 screen space. */
export function loadLocationsScreenSpace() {
  const out = {};
  for (const [id, loc] of Object.entries(loadLocationsNative())) {
    const s = loc.world.scale;
    out[id] = {
      ...loc,
      playerStart: scalePoint(loc.spawns.player, s),
      npcPositions: Object.fromEntries(
        Object.entries(loc.npcs || {}).map(([npcId, p]) => [npcId, scalePoint(p, s)])
      ),
      collisionRects: (loc.collision?.rects || []).map((r) => scaleRect(r, s)),
      transitions: (loc.transitions || []).map((t) => ({
        ...t,
        triggerArea: scaleRect(t.triggerArea, s),
        spawnAt: scalePoint(t.spawnAt, s),
      })),
      items: (loc.items || []).map((i) => ({ ...i, x: i.x * s, y: i.y * s })),
      loreObjects: (loc.loreObjects || []).map((o) => ({ ...o, x: o.x * s, y: o.y * s })),
    };
  }
  return out;
}
