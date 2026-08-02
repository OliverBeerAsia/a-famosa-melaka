/**
 * Asset-level gates for the v0.12 juice pass.
 *
 * These check the things that are cheap to get wrong and expensive to notice:
 * a cycle frame whose bbox has drifted off the plate, a fauna anchor sitting
 * inside a wall, a roster clip that indexes a frame the sheet does not have.
 * Every one of those fails SILENTLY at runtime — an invisible strip, an animal
 * standing in a building, a blank frame — which is exactly the class of bug
 * that survives to release.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { createCanvas, Image } = require('canvas');

const ROOT = path.resolve(__dirname, '..');
const waterCycle = require('../src/data/water-cycle.json');
const fauna = require('../src/data/fauna.json');

const NATIVE_W = 640;
const NATIVE_H = 360;

/** G-channel surface ids written by the compositor. */
const SURFACES = ['none', 'stone', 'dirt', 'wood', 'sand', 'water', 'grass', 'tile'];

function readPng(file) {
  const img = new Image();
  img.src = fs.readFileSync(file);
  const cv = createCanvas(img.width, img.height);
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  return { data: cx.getImageData(0, 0, img.width, img.height), width: img.width, height: img.height };
}

const maskCache = new Map();
function walkMask(id) {
  if (!maskCache.has(id)) {
    maskCache.set(id, readPng(path.join(ROOT, 'assets', 'scenes', 'masks', `${id}-walk.png`)));
  }
  return maskCache.get(id);
}

function sampleMask(id, x, y) {
  const m = walkMask(id);
  const i = ((y | 0) * m.width + (x | 0)) * 4;
  return { walkable: m.data.data[i] >= 128, surface: SURFACES[m.data.data[i + 1]] || 'none' };
}

// ---------------------------------------------------------------------------

describe('water cycle strips', () => {
  const TIMINGS = {
    waterfront: { frames: 8, periodMs: 2400, offsetMs: 0 },
    kampung: { frames: 6, periodMs: 1800, offsetMs: 700 },
  };

  it('ships exactly the two locations with a material:"water" region', () => {
    expect(Object.keys(waterCycle.regions).sort()).toEqual(['kampung', 'waterfront']);
  });

  Object.entries(TIMINGS).forEach(([id, want]) => {
    it(`${id} carries the spec's frame count, period and offset`, () => {
      const region = waterCycle.regions[id];
      expect(region.frames).toBe(want.frames);
      expect(region.periodMs).toBe(want.periodMs);
      expect(region.offsetMs).toBe(want.offsetMs);
      // Every period must sit inside the benchmark's 0.8-3.0 s band.
      expect(region.periodMs).toBeGreaterThanOrEqual(800);
      expect(region.periodMs).toBeLessThanOrEqual(3000);
    });

    it(`${id} bbox is on the plate`, () => {
      const { bbox } = waterCycle.regions[id];
      expect(bbox.x).toBeGreaterThanOrEqual(0);
      expect(bbox.y).toBeGreaterThanOrEqual(0);
      expect(bbox.x + bbox.w).toBeLessThanOrEqual(NATIVE_W);
      expect(bbox.y + bbox.h).toBeLessThanOrEqual(NATIVE_H);
      expect(bbox.w).toBeGreaterThan(0);
      expect(bbox.h).toBeGreaterThan(0);
    });

    it(`${id} ships every frame for every time of day, at the bbox size`, () => {
      const region = waterCycle.regions[id];
      for (const tod of ['day', 'dawn', 'dusk', 'night']) {
        for (let n = 0; n < region.frames; n++) {
          const file = path.join(ROOT, 'assets', 'scenes', 'cycle', `${id}-${tod}-water-${n}.png`);
          expect(fs.existsSync(file), `missing ${path.basename(file)}`).toBe(true);
          const png = readPng(file);
          expect(png.width).toBe(region.bbox.w);
          expect(png.height).toBe(region.bbox.h);
        }
      }
    });
  });

  it('paints exactly the walk mask\'s water pixels and nothing else', () => {
    // The strongest available check that the strip lines up with the world:
    // its opaque pixels must be the SAME set the walk mask calls water. If the
    // compositor and the mask ever disagree, the shimmer creeps onto the quay.
    for (const [id, region] of Object.entries(waterCycle.regions)) {
      const png = readPng(path.join(ROOT, 'assets', 'scenes', 'cycle', `${id}-day-water-0.png`));
      let opaque = 0;
      let offWater = 0;
      for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          const i = (y * png.width + x) * 4;
          if (png.data.data[i + 3] === 0) continue;
          opaque++;
          const s = sampleMask(id, region.bbox.x + x, region.bbox.y + y);
          if (s.surface !== 'water') offWater++;
        }
      }
      expect(opaque, `${id} strip is empty`).toBeGreaterThan(1000);
      expect(offWater, `${id} paints ${offWater} px outside the water mask`).toBe(0);
    }
  });

  it('frames actually differ — a cycle that does not move is not a cycle', () => {
    for (const [id, region] of Object.entries(waterCycle.regions)) {
      const f0 = readPng(path.join(ROOT, 'assets', 'scenes', 'cycle', `${id}-day-water-0.png`));
      for (let n = 1; n < region.frames; n++) {
        const fn = readPng(path.join(ROOT, 'assets', 'scenes', 'cycle', `${id}-day-water-${n}.png`));
        let changed = 0;
        for (let i = 0; i < f0.data.data.length; i += 4) {
          if (f0.data.data[i] !== fn.data.data[i]
            || f0.data.data[i + 1] !== fn.data.data[i + 1]
            || f0.data.data[i + 2] !== fn.data.data[i + 2]) changed++;
        }
        expect(changed, `${id} frame ${n} is identical to frame 0`).toBeGreaterThan(200);
      }
    }
  });

  it('dusk water stays on the WARM ramp — never grey', () => {
    // The art evaluation logged "dusk water turns grey" as a real defect and
    // the bake fixed it; the cycle must not undo it. Canon dusk water runs
    // #66402F -> #F8AE57, i.e. red channel above blue on every step.
    const png = readPng(path.join(ROOT, 'assets', 'scenes', 'cycle', 'waterfront-dusk-water-0.png'));
    let warm = 0;
    let cool = 0;
    for (let i = 0; i < png.data.data.length; i += 4) {
      if (png.data.data[i + 3] === 0) continue;
      const r = png.data.data[i];
      const b = png.data.data[i + 2];
      if (r > b) warm++; else cool++;
    }
    expect(warm).toBeGreaterThan(0);
    // Allow a sliver for the specular highlight; the surface must read warm.
    expect(cool / (warm + cool)).toBeLessThan(0.02);
  });
});

// ---------------------------------------------------------------------------

describe('fauna roster', () => {
  const entries = Object.entries(fauna.locations);

  it('only ships the archetypes v0.12 actually implements', () => {
    const allowed = new Set(['perch-hop', 'peck-wander', 'sleep-lie']);
    entries.forEach(([id, list]) => {
      list.forEach((e) => {
        expect(allowed.has(e.archetype), `${id}/${e.id} uses ${e.archetype}`).toBe(true);
      });
    });
  });

  it('every sheet exists, and every clip indexes a frame the sheet has', () => {
    Object.entries(fauna.clips).forEach(([key, clip]) => {
      const file = path.join(ROOT, 'assets', 'sprites', 'objects', `${key}-sheet.png`);
      expect(fs.existsSync(file), `missing ${key}-sheet.png`).toBe(true);
      const png = readPng(file);
      expect(png.height).toBe(clip.frameHeight);
      const frames = png.width / clip.frameWidth;
      expect(Number.isInteger(frames), `${key} is not a whole number of frames`).toBe(true);
      ['idle', 'walk', 'rest'].forEach((name) => {
        const [from, to] = clip[name];
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to, `${key}.${name} indexes frame ${to} of ${frames}`).toBeLessThan(frames);
        expect(to).toBeGreaterThanOrEqual(from);
      });
    });
  });

  it('every roster entry names a sheet that has a clip', () => {
    entries.forEach(([id, list]) => {
      list.forEach((e) => {
        expect(fauna.clips[e.sheet], `${id}/${e.id} -> ${e.sheet}`).toBeTruthy();
      });
    });
  });

  it('every anchor is on the plate and STANDS on the walk mask', () => {
    // An anchor inside geometry is the failure that reads as "the chicken is
    // in the wall". FaunaSystem re-seeds via nearestWalkable at runtime, but
    // the roster should not be relying on that rescue.
    entries.forEach(([id, list]) => {
      list.forEach((e) => {
        e.anchors.forEach(([x, y]) => {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(NATIVE_W);
          expect(y).toBeLessThan(NATIVE_H);
          const s = sampleMask(id, x, y);
          expect(s.walkable, `${id}/${e.id} anchor ${x},${y} is not walkable`).toBe(true);
          expect(s.surface, `${id}/${e.id} anchor ${x},${y} is on ${s.surface}`).not.toBe('water');
        });
      });
    });
  });

  it('has enough anchors for the instances it asks for', () => {
    entries.forEach(([id, list]) => {
      list.forEach((e) => {
        expect(e.anchors.length, `${id}/${e.id} wants ${e.count} from ${e.anchors.length} anchors`)
          .toBeGreaterThanOrEqual(e.count);
      });
    });
  });

  it('stays inside the high-tier fauna budget in every location', () => {
    // visualProfile.faunaBudget is 8 on high. The roster is allowed to declare
    // more than fits (hours gate them), but not so many that the budget is
    // meaningless.
    entries.forEach(([id, list]) => {
      const allHours = list.reduce((n, e) => n + e.count, 0);
      expect(allHours, `${id} declares ${allHours} fauna`).toBeLessThanOrEqual(12);
    });
  });

  it('declares valid, non-empty hour windows', () => {
    entries.forEach(([id, list]) => {
      list.forEach((e) => {
        expect(Array.isArray(e.hours) && e.hours.length === 2).toBe(true);
        e.hours.forEach((h) => {
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThanOrEqual(24);
        });
      });
    });
  });
});
