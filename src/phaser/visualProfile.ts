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

export interface LocationVisualPreset {
  fogTint: number;
  fogSpeed: number;
  hazeTint: number;
  sunAnchor: { x: number; y: number };
  aoZones: AOZone[];
  canopyShadows: CanopyShadowZone[];
}

export const VISUAL_PROFILES: Record<ResolvedVisualQuality, VisualProfile> = {
  high: {
    fogLayers: 3,
    fogBaseAlpha: 0.12,
    dustFrequencyMultiplier: 1,
    heatHazeEnabled: true,
    pointLightAlphaMultiplier: 1,
    shadowAlphaMultiplier: 1,
    aoAlpha: 0.32,
    grainAlpha: 0.09,
    sunShaftCount: 3,
    sunShaftAlpha: 0.095,
    canopyShadowAlpha: 1,
    colorGradeStrength: 1,
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
    aoAlpha: 0.25,
    grainAlpha: 0.065,
    sunShaftCount: 2,
    sunShaftAlpha: 0.075,
    canopyShadowAlpha: 0.9,
    colorGradeStrength: 0.88,
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
    aoAlpha: 0.16,
    grainAlpha: 0.035,
    sunShaftCount: 0,
    sunShaftAlpha: 0,
    canopyShadowAlpha: 0.78,
    colorGradeStrength: 0.7,
    maxCrowdSize: 5,
    weatherParticlesEnabled: false,
  },
};

export const LOCATION_VISUAL_PRESETS: Record<string, LocationVisualPreset> = {
  'a-famosa-gate': {
    fogTint: 0xb8a78b,
    fogSpeed: 0.45,
    hazeTint: 0xe4c693,
    sunAnchor: { x: 260, y: 90 },
    aoZones: [
      { x: 0, y: 0, width: 960, height: 220, alpha: 0.2 },
      { x: 300, y: 190, width: 360, height: 110, alpha: 0.18 },
    ],
    canopyShadows: [
      { x: -20, y: -40, width: 420, height: 220, alpha: 0.16 },
      { x: 690, y: -30, width: 340, height: 190, alpha: 0.12 },
    ],
  },
  'rua-direita': {
    fogTint: 0xc8b48e,
    fogSpeed: 0.38,
    hazeTint: 0xe9cf9f,
    sunAnchor: { x: 220, y: 82 },
    aoZones: [
      { x: 0, y: 0, width: 960, height: 180, alpha: 0.18 },
      { x: 330, y: 220, width: 300, height: 120, alpha: 0.14 },
    ],
    canopyShadows: [
      { x: -10, y: -20, width: 300, height: 160, alpha: 0.11 },
      { x: 690, y: -20, width: 300, height: 160, alpha: 0.11 },
      { x: 300, y: 150, width: 360, height: 120, alpha: 0.08 },
    ],
  },
  'st-pauls-church': {
    fogTint: 0xd5c6aa,
    fogSpeed: 0.3,
    hazeTint: 0xe5d5b5,
    sunAnchor: { x: 290, y: 76 },
    aoZones: [
      { x: 0, y: 0, width: 960, height: 200, alpha: 0.2 },
      { x: 360, y: 210, width: 250, height: 150, alpha: 0.16 },
    ],
    canopyShadows: [
      { x: -40, y: -35, width: 350, height: 200, alpha: 0.12 },
      { x: 700, y: -30, width: 300, height: 200, alpha: 0.1 },
    ],
  },
  waterfront: {
    fogTint: 0x9fb8c8,
    fogSpeed: 0.6,
    hazeTint: 0xcdd9de,
    sunAnchor: { x: 360, y: 74 },
    aoZones: [
      { x: 0, y: 0, width: 960, height: 170, alpha: 0.15 },
      { x: 390, y: 190, width: 190, height: 140, alpha: 0.18 },
    ],
    canopyShadows: [
      { x: -20, y: -20, width: 320, height: 140, alpha: 0.08 },
      { x: 700, y: -20, width: 280, height: 130, alpha: 0.08 },
    ],
  },
  kampung: {
    fogTint: 0xa8c09a,
    fogSpeed: 0.5,
    hazeTint: 0xd4d6ae,
    sunAnchor: { x: 240, y: 88 },
    aoZones: [
      { x: 0, y: 0, width: 960, height: 200, alpha: 0.18 },
      { x: 350, y: 220, width: 260, height: 150, alpha: 0.15 },
    ],
    canopyShadows: [
      { x: -40, y: -20, width: 400, height: 230, alpha: 0.16 },
      { x: 580, y: -25, width: 420, height: 230, alpha: 0.15 },
      { x: 250, y: 150, width: 420, height: 130, alpha: 0.09 },
    ],
  },
};

export function resolveVisualQualityMode(
  mode: VisualQualityMode,
  fallback: ResolvedVisualQuality = 'balanced'
): ResolvedVisualQuality {
  if (mode === 'auto') return fallback;
  return mode;
}
