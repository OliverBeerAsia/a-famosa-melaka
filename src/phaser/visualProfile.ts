export type VisualQualityMode = 'auto' | 'high' | 'balanced' | 'low';
export type ResolvedVisualQuality = 'high' | 'balanced' | 'low';

export interface VisualProfile {
  dustFrequencyMultiplier: number;
  heatHazeEnabled: boolean;
  pointLightAlphaMultiplier: number;
  shadowAlphaMultiplier: number;
  /**
   * Strength of the quest-hotspot pulse tint. Retained ONLY because
   * `QuestTriggerSystem` reads it as a "how loud is this build" scalar; the
   * screen-space colour grade it was named for is now the MelakaPostFX LUT.
   */
  colorGradeStrength: number;
  /**
   * The shared people-and-animals ceiling for a location.
   *
   * ONE number, deliberately: crowd extras and fauna both draw on it, so a
   * street cannot end up with a full crowd AND a full menagerie by each system
   * reading its own budget. `CrowdSystem` takes this minus `faunaBudget` as its
   * own cap, which is what leaves the fauna layer room to exist.
   */
  maxCrowdSize: number;
  weatherParticlesEnabled: boolean;
  /** Flicker/fauna/surface-response instance budget shares this ceiling. */
  faunaBudget: number;
}

/**
 * REMOVED in the v0.12 juice pass (game-feel spec §1.7): `fogLayers`,
 * `fogBaseAlpha`, `aoAlpha`, `grainAlpha`, `sunShaftCount`, `sunShaftAlpha`
 * and `canopyShadowAlpha`. Every one of them scaled a screen-space Game Object
 * that no longer exists — the fog ellipses, edge-AO rects, film-grain
 * TileSprite, sun-shaft ellipses and canopy-shadow ellipses all collapsed into
 * one shader pass. Their replacements are the four quality scalars in
 * `core/postfxParams.POSTFX_QUALITY_SCALARS` (vignette / grain / haze / flash),
 * which is also where the per-location numbers live.
 */

export interface AOZone {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
}

export interface CanopyShadowZone {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
}

/**
 * Per-location visual presets now live in `src/data/locations/<id>.location.json`
 * under `visual` and are read through `core/LocationData` (see LocationVisual).
 * Only the quality-tier profiles below remain here.
 */

export const VISUAL_PROFILES: Record<ResolvedVisualQuality, VisualProfile> = {
  high: {
    dustFrequencyMultiplier: 1,
    heatHazeEnabled: true,
    pointLightAlphaMultiplier: 1,
    shadowAlphaMultiplier: 1,
    colorGradeStrength: 0.7,
    // Stage 5 raised the crowd from a measured 0.3-1.1 on screen to the
    // benchmark's 2-5 band, which needs a real ceiling: 24 people on Rua
    // Direita plus the fauna that share this same budget. See the note on
    // `maxCrowdSize` above and CrowdSystem.getMaxCrowdCap.
    maxCrowdSize: 40,
    weatherParticlesEnabled: true,
    faunaBudget: 8,
  },
  balanced: {
    dustFrequencyMultiplier: 1.15,
    heatHazeEnabled: true,
    pointLightAlphaMultiplier: 0.88,
    shadowAlphaMultiplier: 0.92,
    colorGradeStrength: 0.62,
    maxCrowdSize: 32,
    weatherParticlesEnabled: true,
    faunaBudget: 5,
  },
  low: {
    dustFrequencyMultiplier: 1.45,
    heatHazeEnabled: false,
    pointLightAlphaMultiplier: 0.65,
    shadowAlphaMultiplier: 0.8,
    colorGradeStrength: 0.5,
    maxCrowdSize: 14,
    weatherParticlesEnabled: false,
    faunaBudget: 2,
  },
};


export function resolveVisualQualityMode(
  mode: VisualQualityMode,
  fallback: ResolvedVisualQuality = 'balanced'
): ResolvedVisualQuality {
  if (mode === 'auto') return fallback;
  return mode;
}
