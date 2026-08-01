export type VisualQualityMode = 'auto' | 'high' | 'balanced' | 'low';
export type ResolvedVisualQuality = 'high' | 'balanced' | 'low';

export interface VisualProfile {
  fogLayers: number;
  fogBaseAlpha: number;
  dustFrequencyMultiplier: number;
  heatHazeEnabled: boolean;
  pointLightAlphaMultiplier: number;
  shadowAlphaMultiplier: number;
  aoAlpha: number;
  grainAlpha: number;
  sunShaftCount: number;
  sunShaftAlpha: number;
  canopyShadowAlpha: number;
  colorGradeStrength: number;
  maxCrowdSize: number;
  weatherParticlesEnabled: boolean;
}

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
    fogLayers: 3,
    fogBaseAlpha: 0.12,
    dustFrequencyMultiplier: 1,
    heatHazeEnabled: true,
    pointLightAlphaMultiplier: 1,
    shadowAlphaMultiplier: 1,
    aoAlpha: 0.18,
    grainAlpha: 0.05,
    sunShaftCount: 3,
    sunShaftAlpha: 0.095,
    canopyShadowAlpha: 0.6,
    colorGradeStrength: 0.7,
    maxCrowdSize: 15,
    weatherParticlesEnabled: true,
  },
  balanced: {
    fogLayers: 2,
    fogBaseAlpha: 0.09,
    dustFrequencyMultiplier: 1.15,
    heatHazeEnabled: true,
    pointLightAlphaMultiplier: 0.88,
    shadowAlphaMultiplier: 0.92,
    aoAlpha: 0.15,
    grainAlpha: 0.04,
    sunShaftCount: 2,
    sunShaftAlpha: 0.075,
    canopyShadowAlpha: 0.55,
    colorGradeStrength: 0.62,
    maxCrowdSize: 10,
    weatherParticlesEnabled: true,
  },
  low: {
    fogLayers: 1,
    fogBaseAlpha: 0.05,
    dustFrequencyMultiplier: 1.45,
    heatHazeEnabled: false,
    pointLightAlphaMultiplier: 0.65,
    shadowAlphaMultiplier: 0.8,
    aoAlpha: 0.1,
    grainAlpha: 0.025,
    sunShaftCount: 0,
    sunShaftAlpha: 0,
    canopyShadowAlpha: 0.5,
    colorGradeStrength: 0.5,
    maxCrowdSize: 5,
    weatherParticlesEnabled: false,
  },
};


export function resolveVisualQualityMode(
  mode: VisualQualityMode,
  fallback: ResolvedVisualQuality = 'balanced'
): ResolvedVisualQuality {
  if (mode === 'auto') return fallback;
  return mode;
}
