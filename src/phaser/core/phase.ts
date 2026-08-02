/**
 * phase.ts — deterministic phase spreading for repeated animation instances.
 *
 * THE DEFECT THIS EXISTS TO KILL
 * ------------------------------
 * Every animated prop of the same type in a location used to start on the same
 * animation frame: `EnvironmentObjectSystem` called `sprite.play(key)` with no
 * `startFrame` and no delay, so Rua Direita's six awnings flapped in lockstep
 * and its three palms swayed as one object. That is benchmark item 9 ("no
 * same-loop instances in phase") failing 100 %. The tween fallbacks *did*
 * randomise — with `Math.random()`, which violates the project's determinism
 * norm (same layout -> same bytes, same scene -> same frame).
 *
 * THE FIX
 * -------
 * A golden-ratio low-discrepancy sequence for the phase OFFSET, and a
 * position-seeded hash for a ±12 % PERIOD jitter:
 *
 *     offset_i = period * frac(i * GOLDEN)      // maximal spread, any count
 *     period_i = period * (1 ± 0.12 * hash(x,y))// so they also drift apart
 *
 * The offset spreads instances that exist *now*; the period jitter stops them
 * from ever re-converging. Both are pure functions of (index, x, y), so the
 * scene looks identical on every run and in every capture — which is what makes
 * the benchmark-9 gate testable at all.
 *
 * WHY GOLDEN RATIO AND NOT i/N
 * ----------------------------
 * `i/N` needs N up front. Props are created one at a time, some are skipped for
 * quality tier, and fauna spawn and despawn on a clock — so N is not known when
 * instance i is placed. The golden-ratio (Kronecker) sequence is optimal for
 * *any* prefix length: by the three-distance theorem its gaps only ever take
 * two or three distinct values, and the smallest is bounded below by
 * ~1/(phi^2 * N) = 0.382/N. See `phase.test.ts` for the measured bound.
 *
 * Phaser-free on purpose: this is unit-tested directly.
 */

/** frac(golden ratio) — the classic low-discrepancy additive step. */
export const GOLDEN = 0.6180339887498949;

/** Default period jitter, ±12 % (game-feel spec §2.4). */
export const DEFAULT_JITTER = 0.12;

/**
 * Deterministic 0..1 hash of two numbers.
 *
 * Coordinates arrive as world pixels (floats, but always at or near integers
 * after the native->world scale), so they are rounded before mixing: two props
 * a third of a pixel apart must not get different flicker periods, and the same
 * prop must hash identically whether it was reached through the plate loader or
 * the location JSON.
 */
export function hash2(x: number, y: number): number {
  let h = Math.imul(Math.round(x) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(y) | 0, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2d);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Deterministic 0..1 hash of a string (location ids, sprite keys). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** frac(i * GOLDEN) — the normalised phase of the i-th instance, in [0, 1). */
export function goldenFraction(index: number): number {
  const i = Math.max(0, Math.floor(index));
  const f = (i * GOLDEN) % 1;
  return f < 0 ? f + 1 : f;
}

/** Phase offset in ms for the i-th instance of a loop of `periodMs`. */
export function phaseOffset(index: number, periodMs: number): number {
  return periodMs * goldenFraction(index);
}

/** Position-seeded period multiplier in [1 - amount, 1 + amount]. */
export function periodJitter(x: number, y: number, amount: number = DEFAULT_JITTER): number {
  return 1 + amount * (hash2(x, y) * 2 - 1);
}

/** `periodMs` jittered by ±`amount`, seeded from the instance's position. */
export function jitteredPeriod(
  periodMs: number,
  x: number,
  y: number,
  amount: number = DEFAULT_JITTER,
): number {
  return periodMs * periodJitter(x, y, amount);
}

export interface PhasedTiming {
  /** Where in its own loop this instance starts, in ms. */
  offsetMs: number;
  /** This instance's own loop length, in ms (base ± jitter). */
  periodMs: number;
}

/**
 * The whole spreader in one call: give it the instance's index among
 * same-type instances in this location plus its world position, get back a
 * start offset and a private period.
 */
export function phaseFor(
  index: number,
  basePeriodMs: number,
  x: number,
  y: number,
  amount: number = DEFAULT_JITTER,
): PhasedTiming {
  const periodMs = jitteredPeriod(basePeriodMs, x, y, amount);
  return { offsetMs: phaseOffset(index, periodMs), periodMs };
}

/**
 * Which frame of an `frameCount`-frame loop this instance is showing at `nowMs`.
 * Used by the flicker and water-cycle swappers, which advance a texture rather
 * than driving a Phaser animation.
 */
export function frameAt(
  nowMs: number,
  timing: PhasedTiming,
  frameCount: number,
): number {
  if (frameCount <= 1 || timing.periodMs <= 0) return 0;
  const t = (nowMs + timing.offsetMs) % timing.periodMs;
  const f = Math.floor((t / timing.periodMs) * frameCount);
  return f < 0 ? 0 : f >= frameCount ? frameCount - 1 : f;
}

/**
 * Progress through the loop, 0..1, at `nowMs`. For tween/timeScale users.
 */
export function progressAt(nowMs: number, timing: PhasedTiming): number {
  if (timing.periodMs <= 0) return 0;
  const t = (nowMs + timing.offsetMs) % timing.periodMs;
  return (t < 0 ? t + timing.periodMs : t) / timing.periodMs;
}

/**
 * Smallest CIRCULAR gap between normalised phases, in [0, 1).
 *
 * Circular because a loop wraps: phases 0.99 and 0.01 are 0.02 apart, not 0.98.
 * The benchmark-9 gate is an assertion on this number.
 */
export function minPhaseSeparation(phases: number[]): number {
  const n = phases.length;
  if (n < 2) return 1;
  const sorted = phases.map((p) => ((p % 1) + 1) % 1).sort((a, b) => a - b);
  let min = 1 + sorted[0] - sorted[n - 1];
  for (let i = 1; i < n; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap < min) min = gap;
  }
  return min;
}

/** The normalised phases the spreader hands out for `count` instances. */
export function phaseSequence(count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(goldenFraction(i));
  return out;
}
