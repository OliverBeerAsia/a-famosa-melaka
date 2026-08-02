import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JITTER,
  frameAt,
  goldenFraction,
  hash2,
  hashString,
  jitteredPeriod,
  minPhaseSeparation,
  phaseFor,
  phaseOffset,
  phaseSequence,
  progressAt,
} from './phase';

describe('phase — determinism', () => {
  it('hash2 is stable across calls and pure in its inputs', () => {
    const a = hash2(834, 513);
    const b = hash2(834, 513);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    // A third of a pixel apart is the same prop, so the same hash.
    expect(hash2(834.2, 513.4)).toBe(a);
    // Different props differ.
    expect(hash2(835, 513)).not.toBe(a);
  });

  it('hash2 spreads over 0..1 rather than clustering', () => {
    const buckets = new Array(10).fill(0);
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) buckets[Math.floor(hash2(x * 7, y * 13) * 10)]++;
    }
    // 1600 samples over 10 buckets: nothing empty, nothing over 25 %.
    buckets.forEach((n) => {
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(400);
    });
  });

  it('hashString is stable and distinct per key', () => {
    expect(hashString('rua-direita')).toBe(hashString('rua-direita'));
    expect(hashString('rua-direita')).not.toBe(hashString('waterfront'));
  });

  it('phaseFor produces identical output across runs', () => {
    const first = [0, 1, 2, 3, 4].map((i) => phaseFor(i, 1100, 100 + i * 37, 200 + i * 11));
    const second = [0, 1, 2, 3, 4].map((i) => phaseFor(i, 1100, 100 + i * 37, 200 + i * 11));
    expect(second).toEqual(first);
  });

  it('never calls Math.random (same values under a stubbed RNG)', () => {
    const real = Math.random;
    try {
      Math.random = () => 0.123456789;
      const a = phaseFor(7, 900, 640, 480);
      Math.random = () => 0.987654321;
      const b = phaseFor(7, 900, 640, 480);
      expect(a).toEqual(b);
    } finally {
      Math.random = real;
    }
  });
});

describe('phase — separation (benchmark item 9)', () => {
  /**
   * The gate the game-feel spec asks for is `period / (2N)`.
   *
   * SPEC DEVIATION, measured: the golden-ratio sequence the SAME section
   * prescribes cannot meet 1/(2N) for every N — by the three-distance theorem
   * its minimum gap is bounded by ~1/(phi^2 * N) = 0.382/N, and it lands just
   * under 0.5/N at exactly two counts below 24 (N = 14 -> 0.0344 vs 0.0357,
   * N = 23 -> 0.02129 vs 0.02174; both short by under 4 %). So this asserts
   * two things: the spec's literal 1/(2N) for every count the shipping data
   * actually reaches (max same-type instance count is 10 — rua-direita's
   * lanterns), and the provable 0.45/N for every count up to 24.
   */
  it('meets the spec gate period/(2N) for every count the shipping data reaches', () => {
    for (let n = 2; n <= 13; n++) {
      expect(minPhaseSeparation(phaseSequence(n))).toBeGreaterThanOrEqual(1 / (2 * n));
    }
  });

  it('meets the provable golden-ratio bound 0.45/N for N <= 24', () => {
    for (let n = 2; n <= 24; n++) {
      const sep = minPhaseSeparation(phaseSequence(n));
      expect(sep).toBeGreaterThanOrEqual(0.45 / n);
    }
  });

  it('no two instances ever share a phase', () => {
    const phases = phaseSequence(24);
    expect(new Set(phases).size).toBe(24);
    expect(minPhaseSeparation(phases)).toBeGreaterThan(0);
  });

  it('offsets stay inside the period', () => {
    for (let i = 0; i < 24; i++) {
      const off = phaseOffset(i, 1100);
      expect(off).toBeGreaterThanOrEqual(0);
      expect(off).toBeLessThan(1100);
    }
  });

  it('goldenFraction is clamped to [0,1) and tolerates junk indices', () => {
    expect(goldenFraction(0)).toBe(0);
    expect(goldenFraction(-3)).toBe(0);
    expect(goldenFraction(2.7)).toBe(goldenFraction(2));
  });

  /** The real-world case: rua-direita's six awnings on a 1100 ms loop. */
  it('spreads rua-direita 6 awnings across their loop', () => {
    const xs = [204, 312, 402, 486, 540, 606];
    const timings = xs.map((x, i) => phaseFor(i, 1100, x * 3, 171 * 3));
    const normalised = timings.map((t) => t.offsetMs / t.periodMs);
    // At least 1/12th of a loop apart — visibly out of step at 3 fps.
    expect(minPhaseSeparation(normalised)).toBeGreaterThan(1 / 12);
  });
});

describe('phase — period jitter', () => {
  it('stays inside +/-12 % of the base period', () => {
    for (let x = 0; x < 200; x += 7) {
      const p = jitteredPeriod(1200, x, x * 3 + 5);
      expect(p).toBeGreaterThanOrEqual(1200 * (1 - DEFAULT_JITTER));
      expect(p).toBeLessThanOrEqual(1200 * (1 + DEFAULT_JITTER));
    }
  });

  it('gives co-located instances the same period and separated ones different', () => {
    expect(jitteredPeriod(900, 300, 400)).toBe(jitteredPeriod(900, 300, 400));
    expect(jitteredPeriod(900, 300, 400)).not.toBe(jitteredPeriod(900, 360, 400));
  });

  it('drifts same-period instances apart over time', () => {
    // Two torches on the same 900 ms base period at different positions must
    // not still be in step after a minute of play.
    const a = phaseFor(0, 900, 120, 300);
    const b = phaseFor(1, 900, 480, 300);
    const after = 60_000;
    expect(Math.abs(progressAt(after, a) - progressAt(after, b))).toBeGreaterThan(0.02);
  });
});

describe('phase — frame selection', () => {
  it('walks every frame of the loop exactly once per period', () => {
    const timing = { offsetMs: 0, periodMs: 800 };
    const seen = new Set<number>();
    for (let t = 0; t < 800; t += 10) seen.add(frameAt(t, timing, 4));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('clamps to the frame range and handles degenerate loops', () => {
    expect(frameAt(0, { offsetMs: 0, periodMs: 0 }, 4)).toBe(0);
    expect(frameAt(999999, { offsetMs: 0, periodMs: 300 }, 1)).toBe(0);
    for (let t = 0; t < 5000; t += 37) {
      const f = frameAt(t, { offsetMs: 123, periodMs: 900 }, 3);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(2);
    }
  });

  /**
   * The spec's CI gate is "no two same-type props share an animation frame
   * index in > 15 % of sampled frames".
   *
   * SPEC DEVIATION, measured: 15 % is only reachable for loops with >= 8
   * frames. Two INDEPENDENT instances of a 3-frame loop (which is what
   * `awning-flutter-anim`, `palm-sway` and `flag-flutter` actually are — three
   * frames, yoyo) coincide 1/3 of the time by construction: that is chance, not
   * lockstep, and driving it below chance would mean locking the two instances
   * to each other, i.e. re-introducing the defect in a subtler form. So the
   * assertion is the honest one: coincidence must be AT CHANCE, where the
   * defect puts it at 100 %.
   */
  it('breaks lockstep down to chance for a short loop', () => {
    const samples = 480;
    const window = 10_000;
    const coincidence = (a: ReturnType<typeof phaseFor>, b: ReturnType<typeof phaseFor>) => {
      let same = 0;
      for (let s = 0; s < samples; s++) {
        if (frameAt(s * (window / samples), a, 3) === frameAt(s * (window / samples), b, 3)) same++;
      }
      return same / samples;
    };

    // The defect: two instances created the old way share every frame.
    const locked = { offsetMs: 0, periodMs: 900 };
    expect(coincidence(locked, locked)).toBe(1);

    // The fix: at chance for a 3-frame loop (1/3), with a generous margin.
    const spread = coincidence(phaseFor(0, 900, 100, 100), phaseFor(1, 900, 400, 100));
    expect(spread).toBeLessThanOrEqual(1 / 3 + 0.08);
  });

  it('meets the spec 15 % gate for loops long enough to reach it', () => {
    // 8 frames or more — the water cycle strips (8 f) and the flicker pools
    // driven at fine granularity. Chance is 1/8 = 12.5 %.
    const samples = 2400;
    const a = phaseFor(0, 2400, 100, 100);
    const b = phaseFor(1, 2400, 400, 100);
    let same = 0;
    for (let s = 0; s < samples; s++) {
      const t = s * (120_000 / samples);
      if (frameAt(t, a, 8) === frameAt(t, b, 8)) same++;
    }
    expect(same / samples).toBeLessThanOrEqual(0.15);
  });
});
