/**
 * postfxParams — the numbers the MelakaPostFX shader is driven by.
 *
 * Phaser-free and data-only so the table is unit-testable and so the canvas
 * fallback (which has no shader) can read exactly the same vignette strength
 * the WebGL path uses. Game-feel spec §1.3.
 *
 * DERIVATION (kept here because the numbers are otherwise unfalsifiable):
 * the old screen-space stack darkened a corner by
 * `vignetteGradient(0.16) + edgeAO(aoAlpha * 1.0 top / 0.75 side) +
 * aoZone(top-band alpha)`. Summed at the `high` profile (aoAlpha 0.18) and
 * rounded to 0.02, that is `uVigStrength`. St Paul's is deliberately BELOW its
 * summed value: it is the open-hilltop frame and the old edge rects were
 * flattening its sky.
 */

import type { ResolvedVisualQuality } from '../visualProfile';

export interface PostFXLocationParams {
  /** Darkening at the extreme corner, 0..1. Edge midpoints get x0.42. */
  vigStrength: number;
  /** Peak grain swing, luma-only and symmetric (0.024 = +/-3/255). */
  grainAmt: number;
  /** How much of the horizon haze band is mixed in at its centre. */
  hazeAmt: number;
  /** Where the haze band sits, in screen uv (0 = top of frame). */
  hazeY: number;
}

/** Corner falloff exponent. Fixed — the shape is not a per-location decision. */
export const VIGNETTE_POWER = 2.4;

/** Edge midpoints are this fraction of the corner darkening. */
export const VIGNETTE_EDGE_RATIO = 0.42;

/** Grain is boosted at night, where flat shadow is where it reads. */
export const GRAIN_NIGHT_BOOST = 1.3;

/** The grain seed steps 8x a second, not per frame — film, not video noise. */
export const GRAIN_SEED_HZ = 8;

export const POSTFX_LOCATION_PARAMS: Record<string, PostFXLocationParams> = {
  'a-famosa-gate': { vigStrength: 0.34, grainAmt: 0.026, hazeAmt: 0.10, hazeY: 0.62 },
  'rua-direita': { vigStrength: 0.28, grainAmt: 0.024, hazeAmt: 0.08, hazeY: 0.60 },
  'st-pauls-church': { vigStrength: 0.26, grainAmt: 0.022, hazeAmt: 0.07, hazeY: 0.55 },
  'waterfront': { vigStrength: 0.22, grainAmt: 0.020, hazeAmt: 0.13, hazeY: 0.58 },
  'kampung': { vigStrength: 0.32, grainAmt: 0.028, hazeAmt: 0.11, hazeY: 0.64 },
};

/** Neutral params for any location without an entry (never on a shipping id). */
export const POSTFX_DEFAULT_PARAMS: PostFXLocationParams = {
  vigStrength: 0.26, grainAmt: 0.022, hazeAmt: 0.08, hazeY: 0.60,
};

export interface PostFXQualityScalars {
  vignette: number;
  grain: number;
  haze: number;
  /** Feedback flash is NEVER quality-scaled: it is information, not decoration. */
  flash: number;
}

export const POSTFX_QUALITY_SCALARS: Record<ResolvedVisualQuality, PostFXQualityScalars> = {
  high: { vignette: 1.00, grain: 1.00, haze: 1.00, flash: 1 },
  balanced: { vignette: 0.90, grain: 0.80, haze: 0.75, flash: 1 },
  low: { vignette: 0.70, grain: 0.00, haze: 0.30, flash: 1 },
};

export function postFXParamsFor(locationId: string): PostFXLocationParams {
  return POSTFX_LOCATION_PARAMS[locationId] ?? POSTFX_DEFAULT_PARAMS;
}

/** The four numbers actually pushed at the shader, after profile and phase. */
export interface ResolvedPostFX {
  vigStrength: number;
  grainAmt: number;
  hazeAmt: number;
  hazeY: number;
}

export function resolvePostFX(
  locationId: string,
  quality: ResolvedVisualQuality,
  isNight: boolean,
): ResolvedPostFX {
  const base = postFXParamsFor(locationId);
  const scalars = POSTFX_QUALITY_SCALARS[quality] ?? POSTFX_QUALITY_SCALARS.high;
  return {
    vigStrength: base.vigStrength * scalars.vignette,
    grainAmt: base.grainAmt * scalars.grain * (isNight ? GRAIN_NIGHT_BOOST : 1),
    hazeAmt: base.hazeAmt * scalars.haze,
    hazeY: base.hazeY,
  };
}

/** The grain seed for a scene clock reading, stepped at GRAIN_SEED_HZ. */
export function grainSeedFor(timeMs: number): number {
  return Math.floor(timeMs / (1000 / GRAIN_SEED_HZ));
}
