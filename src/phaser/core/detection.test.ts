import { describe, it, expect } from 'vitest';
import {
  ALERT_SECONDS,
  angleDelta,
  canSee,
  coverMultipliers,
  facingToDegrees,
  noiseRadiusNative,
  POINT_BLANK_NATIVE,
  stepAwareness,
  SUSPICION_SECONDS,
  type PlayerCover,
} from './detection';

const SCALE = 3;
const shadow: PlayerCover = { inLightPool: false, inGuardLantern: false, occluded: false, stationary: false };

const query = (over: Partial<Parameters<typeof canSee>[0]> = {}) => canSee({
  guardX: 0, guardY: 0, guardFacingDeg: 0,
  playerX: 0, playerY: 0,
  cover: shadow,
  scale: SCALE,
  ...over,
});

describe('coverMultipliers', () => {
  it('gives shadow 0.55 and freezing 0.385', () => {
    expect(coverMultipliers(shadow).vision).toBeCloseTo(0.55, 6);
    expect(coverMultipliers({ ...shadow, stationary: true }).vision).toBeCloseTo(0.55 * 0.7, 6);
  });

  it('gives a light pool 1.6 and the guard lantern 2.0', () => {
    expect(coverMultipliers({ ...shadow, inLightPool: true }).vision).toBe(1.6);
    expect(coverMultipliers({ ...shadow, inGuardLantern: true }).vision).toBe(2.0);
  });

  it('zeroes everything behind an occluder, whatever else is true', () => {
    expect(coverMultipliers({ inLightPool: true, inGuardLantern: true, occluded: true, stationary: false }))
      .toEqual({ vision: 0, peripheral: 0 });
  });

  it('lets the guard lantern beat a light pool', () => {
    expect(coverMultipliers({ ...shadow, inLightPool: true, inGuardLantern: true }).vision).toBe(2.0);
  });
});

describe('angleDelta', () => {
  it('wraps the short way round', () => {
    expect(angleDelta(10, 350)).toBe(20);
    expect(angleDelta(-170, 170)).toBe(20);
    expect(angleDelta(0, 180)).toBe(180);
  });
});

describe('canSee — the acceptance cases', () => {
  it('A4a: frozen in shadow 40 native px away is NOT seen', () => {
    // Directly ahead, so the arc is not what saves the player: the range is.
    const result = query({
      playerX: 40 * SCALE,
      cover: { ...shadow, stationary: true },
    });
    // 64 * 0.55 * 0.7 = 24.6 native px of reach against 40 px of distance.
    expect(result.seen).toBe(false);
  });

  it('A4b: standing in a light pool 100 native px away IS seen', () => {
    const result = query({
      playerX: 100 * SCALE,
      cover: { ...shadow, inLightPool: true },
    });
    // 64 * 1.6 = 102.4 native px of reach against 100 px of distance.
    expect(result.seen).toBe(true);
  });

  it('sees straight ahead in shadow inside 35 native px', () => {
    expect(query({ playerX: 30 * SCALE }).seen).toBe(true);
    expect(query({ playerX: 40 * SCALE }).seen).toBe(false);
  });

  it('does not see behind itself outside the peripheral radius', () => {
    const behind = query({ playerX: -30 * SCALE, cover: { ...shadow, inLightPool: true } });
    expect(behind.seen).toBe(false);
  });

  it('sees behind itself INSIDE the peripheral radius', () => {
    expect(query({ playerX: -18 * SCALE, cover: { ...shadow, inLightPool: true } }).seen).toBe(true);
  });

  it('has you at point blank whatever the facing or the cover', () => {
    const result = query({
      playerX: -(POINT_BLANK_NATIVE - 2) * SCALE,
      cover: { ...shadow, stationary: true },
    });
    expect(result.seen).toBe(true);
  });

  it('is blind behind an occluder at arm\'s length', () => {
    expect(query({ playerX: 4, cover: { ...shadow, occluded: true } }).seen).toBe(false);
  });

  it('narrows to the 90-degree arc', () => {
    // 30 degrees off axis, inside the arc.
    const inside = query({
      playerX: Math.cos(Math.PI / 6) * 90 * SCALE,
      playerY: Math.sin(Math.PI / 6) * 90 * SCALE,
      cover: { ...shadow, inLightPool: true },
    });
    // 60 degrees off axis, outside it.
    const outside = query({
      playerX: Math.cos(Math.PI / 3) * 90 * SCALE,
      playerY: Math.sin(Math.PI / 3) * 90 * SCALE,
      cover: { ...shadow, inLightPool: true },
    });
    expect(inside.seen).toBe(true);
    expect(outside.seen).toBe(false);
  });

  it('gains 20% reach per alert level', () => {
    const at1 = query({ playerX: 38 * SCALE, alertLevel: 1 });
    const at2 = query({ playerX: 38 * SCALE, alertLevel: 2 });
    expect(at1.seen).toBe(false);
    expect(at2.seen).toBe(true);
  });
});

describe('facingToDegrees', () => {
  it('matches the atan2 convention (y grows downward)', () => {
    expect(facingToDegrees('right')).toBe(0);
    expect(facingToDegrees('down')).toBe(90);
    expect(facingToDegrees('left')).toBe(180);
    expect(facingToDegrees('up')).toBe(-90);
  });
});

describe('stepAwareness', () => {
  const base = {
    state: 'unaware' as const, exposure: 0, seen: false, dt: 0.1,
    noise: false, distance: 500, scale: SCALE, calm: 0,
  };

  it('needs sustained exposure to turn suspicious', () => {
    let s = { ...base, seen: true };
    let out = stepAwareness(s);
    expect(out.state).toBe('unaware');
    for (let i = 0; i < Math.ceil(SUSPICION_SECONDS / 0.1); i++) {
      out = stepAwareness({ ...s, state: out.state, exposure: out.exposure, calm: out.calm });
    }
    expect(out.state).toBe('suspicious');
  });

  it('turns suspicious immediately on a noise event', () => {
    expect(stepAwareness({ ...base, noise: true }).state).toBe('suspicious');
  });

  it('escalates from suspicious to alerted after sustained exposure', () => {
    let out = { state: 'suspicious' as const, exposure: 0, calm: 0, escalated: false };
    for (let i = 0; i < Math.ceil(ALERT_SECONDS / 0.1) + 1; i++) {
      const next = stepAwareness({ ...base, seen: true, state: out.state, exposure: out.exposure, calm: out.calm });
      out = { ...next, state: next.state as 'suspicious' };
      if (next.state === 'alerted') break;
    }
    expect(out.state).toBe('alerted');
  });

  it('goes straight to alerted at point blank', () => {
    const out = stepAwareness({ ...base, seen: true, distance: 10 });
    expect(out.state).toBe('alerted');
    expect(out.escalated).toBe(true);
  });

  it('decays exposure and accumulates calm when unseen', () => {
    const out = stepAwareness({ ...base, exposure: 0.2, dt: 0.2 });
    expect(out.exposure).toBeLessThan(0.2);
    expect(out.calm).toBeGreaterThan(0);
  });

  it('reports the escalation frame exactly once', () => {
    const first = stepAwareness({ ...base, noise: true });
    expect(first.escalated).toBe(true);
    const second = stepAwareness({ ...base, state: 'suspicious', exposure: first.exposure, calm: first.calm });
    expect(second.escalated).toBe(false);
  });
});

describe('noiseRadiusNative', () => {
  it('is silent on stone and dirt', () => {
    expect(noiseRadiusNative({ running: false, onWood: false, moving: true })).toBe(0);
  });

  it('carries 34 on the wooden pier', () => {
    expect(noiseRadiusNative({ running: false, onWood: true, moving: true })).toBe(34);
  });

  it('carries 48 running, on any surface', () => {
    expect(noiseRadiusNative({ running: true, onWood: false, moving: true })).toBe(48);
  });

  it('is silent standing still on wood', () => {
    expect(noiseRadiusNative({ running: false, onWood: true, moving: false })).toBe(0);
  });
});
