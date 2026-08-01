import { afterEach, describe, test, expect } from 'vitest';
import {
  configureWorldDepth,
  worldDepth,
  DEPTH_WORLD_MIN,
  DEPTH_WORLD_MAX,
  DEPTH_FX_FLOOR,
  DEPTH_FX_SEAGULL,
  DEPTH_FX_CEILING,
  DEPTH_UI_FLOOR,
} from './depth';

/** The flip-screen viewport height these bands were originally sized for. */
const GAME_HEIGHT = 540;

describe('depth bands', () => {
  test('bands are ordered and non-overlapping', () => {
    expect(DEPTH_WORLD_MIN).toBeLessThan(DEPTH_WORLD_MAX);
    expect(DEPTH_WORLD_MAX).toBeLessThan(DEPTH_FX_FLOOR);
    expect(DEPTH_FX_FLOOR).toBeLessThanOrEqual(DEPTH_FX_SEAGULL);
    expect(DEPTH_FX_SEAGULL).toBeLessThanOrEqual(DEPTH_FX_CEILING);
    expect(DEPTH_FX_CEILING).toBeLessThan(DEPTH_UI_FLOOR);
  });
});

describe('worldDepth', () => {
  test('is monotonically non-decreasing in y', () => {
    let previous = -Infinity;
    for (let y = -200; y <= 1200; y += 7) {
      const depth = worldDepth(y);
      expect(depth).toBeGreaterThanOrEqual(previous);
      previous = depth;
    }
  });

  test('strictly increases across the unclamped range', () => {
    expect(worldDepth(100)).toBeLessThan(worldDepth(101));
    expect(worldDepth(0)).toBeLessThan(worldDepth(540));
  });

  test('quantizes to integers (no z-fighting on near-equal y)', () => {
    expect(worldDepth(123.9)).toBe(123);
    expect(Number.isInteger(worldDepth(456.78))).toBe(true);
  });

  test('clamps below the FX band for any y, including absurd ones', () => {
    for (const y of [0, 540, 656, 780, 781, 1500, 100000, Infinity]) {
      expect(worldDepth(y)).toBeLessThan(DEPTH_FX_FLOOR);
      expect(worldDepth(y)).toBeLessThanOrEqual(DEPTH_WORLD_MAX);
    }
  });

  test('clamps at or above the world floor for negative y', () => {
    for (const y of [-1, -100, -Infinity]) {
      expect(worldDepth(y)).toBeGreaterThanOrEqual(DEPTH_WORLD_MIN);
    }
  });

  test('NaN degrades to the world floor instead of poisoning depth sort', () => {
    expect(worldDepth(NaN)).toBe(DEPTH_WORLD_MIN);
  });
});

describe('configureWorldDepth (scrolling worlds)', () => {
  afterEach(() => {
    configureWorldDepth(GAME_HEIGHT);   // back to the flip-screen default
  });

  test('leaves the mapping untouched for a viewport-sized world', () => {
    expect(configureWorldDepth(GAME_HEIGHT)).toBe(1);
    expect(worldDepth(400)).toBe(400);
    expect(worldDepth(588)).toBe(588);
  });

  test('scales a 1080px world into the band instead of clamping it flat', () => {
    const scale = configureWorldDepth(1080);
    expect(scale).toBeLessThan(1);
    // The bottom of the world must still fit under the FX floor...
    expect(worldDepth(1080 + 48)).toBeLessThanOrEqual(DEPTH_WORLD_MAX);
    // ...and, crucially, must NOT collapse: the old clamp mapped every y over
    // 780 to the same depth, which killed walk-behind in the near quarter.
    expect(worldDepth(1080)).toBeGreaterThan(worldDepth(800));
    expect(worldDepth(800)).toBeGreaterThan(worldDepth(600));
  });

  test('preserves strict ordering across the whole tall world', () => {
    configureWorldDepth(1080);
    let previous = -1;
    for (let y = 0; y <= 1128; y += 24) {
      const d = worldDepth(y);
      expect(d).toBeGreaterThanOrEqual(previous);
      previous = d;
    }
    expect(previous).toBeLessThan(DEPTH_FX_FLOOR);
  });
});
