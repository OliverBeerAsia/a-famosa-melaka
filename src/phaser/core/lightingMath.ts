/**
 * Pure lighting tables and the alpha compositor.
 *
 * The engine has exactly three things that dim or tint a character or the
 * screen, and every one of them is a plain function of the phase of day:
 * the full-screen tint, the per-character tint/alpha, and the contact-shadow
 * shape. Keeping them here — Phaser-free — is what lets the compositor be
 * tested, which matters because the alpha bug it fixes (stealth and time-of-day
 * fighting each other for `player.alpha`) is invisible in a screenshot.
 */

import relightRuntime from '../../data/relight-runtime.json';
import type { TimeOfDay } from './timeMath';

/** Art Bible full-screen time-of-day tint. */
export const TIME_COLORS: Record<TimeOfDay, { color: number; alpha: number }> = {
  dawn: { color: 0xFFB6C1, alpha: 0.25 },    // Pink/coral morning
  day: { color: 0xFFFFFF, alpha: 0.0 },      // Clear tropical day
  dusk: { color: 0xF4A460, alpha: 0.3 },     // Golden amber hour
  night: { color: 0x1a2f5c, alpha: 0.45 },   // Deep blue night
};

/**
 * Per-time character tint, DERIVED from the Forge relight LUTs.
 *
 * Generated into src/data/relight-runtime.json by `npm run forge:relight` from
 * exactly the tables that bake the plates, so a sprite composited onto a night
 * plate is lit by the same night. Hand-picked tints here were the double-grade
 * in miniature: the backdrop said 0.36x day and the characters said 0.9 alpha
 * and a taste-picked blue.
 *
 * Do not hand-edit — fix the specs in tools/forge/relight.cjs and regenerate.
 */
export const TIME_CHARACTER_LIGHTING: Record<
  TimeOfDay,
  { tint: number | null; alpha: number }
> = {
  dawn: relightRuntime.times.dawn,
  day: relightRuntime.times.day,
  dusk: relightRuntime.times.dusk,
  night: relightRuntime.times.night,
};

/** Player opacity while sneaking on the theft path. */
export const STEALTH_ALPHA = 0.4;

export interface ShadowConfig {
  alpha: number;
  offsetX: number;
  offsetY: number;
  length: number;
  flatten: number;
  angle: number;
}

/**
 * Contact-shadow shape for the phase: long and raked at dawn/dusk, tight and
 * dark under a high sun, soft and near-centred at night.
 */
export function getShadowConfig(phase: TimeOfDay): ShadowConfig {
  switch (phase) {
    case 'dawn':
      return { alpha: 0.3, offsetX: -18, offsetY: 48, length: 1.5, flatten: 0.82, angle: -9 };
    case 'day':
      return { alpha: 0.2, offsetX: 0, offsetY: 42, length: 1, flatten: 1, angle: 0 };
    case 'dusk':
      return { alpha: 0.34, offsetX: 18, offsetY: 50, length: 1.5, flatten: 0.82, angle: 9 };
    case 'night':
      return { alpha: 0.42, offsetX: 4, offsetY: 44, length: 1.12, flatten: 0.92, angle: 2 };
    default:
      return { alpha: 0.26, offsetX: 0, offsetY: 44, length: 1.1, flatten: 0.9, angle: 0 };
  }
}

/**
 * The single alpha compositor.
 *
 * Time-of-day lighting and stealth mode are INDEPENDENT dimming factors, so
 * they multiply. Writing either one straight onto the sprite is the bug this
 * function exists to prevent: the per-time lighting pass used to fight the
 * stealth subscriber and reset the player to full opacity mid-theft.
 */
export function compositeAlpha(lightingAlpha: number, stealthAlpha: number): number {
  return lightingAlpha * stealthAlpha;
}

/**
 * Cheap identity for a character-lighting state, so a re-apply that would
 * change nothing can be skipped.
 */
export function characterLightingSignature(phase: TimeOfDay): string {
  const lighting = TIME_CHARACTER_LIGHTING[phase];
  return `${phase}:${lighting.tint ?? 'none'}:${lighting.alpha.toFixed(2)}`;
}

/** True for the phases whose practical lights are lit. */
export function lightsAreLit(phase: TimeOfDay): boolean {
  return phase === 'dusk' || phase === 'night';
}
