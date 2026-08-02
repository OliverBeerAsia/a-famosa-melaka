import { describe, it, expect } from 'vitest';
import {
  characterLightingSignature,
  compositeAlpha,
  getShadowConfig,
  lightsAreLit,
  STEALTH_ALPHA,
  TIME_CHARACTER_LIGHTING,
  TIME_COLORS,
} from './lightingMath';
import type { TimeOfDay } from './timeMath';

const PHASES: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];

describe('TIME_COLORS', () => {
  it('is fully transparent at midday and heaviest at night', () => {
    expect(TIME_COLORS.day.alpha).toBe(0);
    expect(TIME_COLORS.night.alpha).toBeGreaterThan(TIME_COLORS.dusk.alpha);
    expect(TIME_COLORS.dusk.alpha).toBeGreaterThan(TIME_COLORS.day.alpha);
  });

  it('covers every phase with a legal alpha', () => {
    PHASES.forEach((p) => {
      expect(TIME_COLORS[p].alpha).toBeGreaterThanOrEqual(0);
      expect(TIME_COLORS[p].alpha).toBeLessThanOrEqual(1);
    });
  });
});

describe('TIME_CHARACTER_LIGHTING', () => {
  it('has an entry for every phase, sourced from the relight runtime', () => {
    PHASES.forEach((p) => {
      const entry = TIME_CHARACTER_LIGHTING[p];
      expect(entry).toBeDefined();
      expect(typeof entry.alpha).toBe('number');
      expect(entry.alpha).toBeGreaterThan(0);
      expect(entry.alpha).toBeLessThanOrEqual(1);
      expect(entry.tint === null || typeof entry.tint === 'number').toBe(true);
    });
  });
});

describe('compositeAlpha', () => {
  it('is a no-op when neither factor dims', () => {
    expect(compositeAlpha(1, 1)).toBe(1);
  });

  it('multiplies the two factors rather than letting one win', () => {
    expect(compositeAlpha(0.8, STEALTH_ALPHA)).toBeCloseTo(0.32, 5);
  });

  it('keeps stealth dimming after a lighting re-apply', () => {
    // The regression: a lighting pass that wrote alpha directly reset the
    // player to full opacity mid-theft. Composited, stealth survives.
    const beforeLightingChange = compositeAlpha(1, STEALTH_ALPHA);
    const afterLightingChange = compositeAlpha(0.75, STEALTH_ALPHA);
    expect(beforeLightingChange).toBeLessThan(1);
    expect(afterLightingChange).toBeLessThan(beforeLightingChange);
  });

  it('is commutative in its factors', () => {
    expect(compositeAlpha(0.5, 0.4)).toBeCloseTo(compositeAlpha(0.4, 0.5), 10);
  });
});

describe('getShadowConfig', () => {
  it('rakes the shadow opposite ways at dawn and dusk', () => {
    expect(getShadowConfig('dawn').offsetX).toBeLessThan(0);
    expect(getShadowConfig('dusk').offsetX).toBeGreaterThan(0);
    expect(getShadowConfig('dawn').angle).toBe(-getShadowConfig('dusk').angle);
  });

  it('is shortest and roundest under a high sun', () => {
    const day = getShadowConfig('day');
    expect(day.length).toBe(1);
    expect(day.flatten).toBe(1);
    expect(day.offsetX).toBe(0);
  });

  it('lengthens the shadow at the golden hours', () => {
    expect(getShadowConfig('dawn').length).toBeGreaterThan(getShadowConfig('day').length);
    expect(getShadowConfig('dusk').length).toBeGreaterThan(getShadowConfig('day').length);
  });

  it('is darkest at night', () => {
    const alphas = PHASES.map((p) => getShadowConfig(p).alpha);
    expect(Math.max(...alphas)).toBe(getShadowConfig('night').alpha);
  });

  it('always sits below the sprite origin', () => {
    PHASES.forEach((p) => expect(getShadowConfig(p).offsetY).toBeGreaterThan(0));
  });
});

describe('characterLightingSignature', () => {
  it('is stable for the same phase', () => {
    expect(characterLightingSignature('night')).toBe(characterLightingSignature('night'));
  });

  it('differs between phases', () => {
    const sigs = new Set(PHASES.map(characterLightingSignature));
    expect(sigs.size).toBe(PHASES.length);
  });
});

describe('lightsAreLit', () => {
  it('lights the practicals only after the sun is down', () => {
    expect(lightsAreLit('dusk')).toBe(true);
    expect(lightsAreLit('night')).toBe(true);
    expect(lightsAreLit('dawn')).toBe(false);
    expect(lightsAreLit('day')).toBe(false);
  });
});
