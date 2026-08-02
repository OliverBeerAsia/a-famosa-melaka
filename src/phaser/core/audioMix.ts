/**
 * Pure mixer maths: which ambient beds a given place and hour should be
 * playing, and how a mixed list of keys/configs collapses into a unique set.
 *
 * No Phaser, no stores — AudioSystem owns the sounds, this owns the decision
 * about which sounds there should be.
 */

import type { TimeOfDay } from './timeMath';

export type FootstepSurface = 'stone' | 'wood' | 'dirt';

export interface AmbientLayerConfig {
  key: string;
  volume?: number;
}

/** Default volume for a layer that declares none. */
export const DEFAULT_AMBIENT_VOLUME = 0.25;

/** Used only when a location id has no data file at all. */
export const FALLBACK_AUDIO = {
  music: 'music-main',
  nightMusic: 'music-night',
  ambientSounds: [{ key: 'base-tropical', volume: 0.25 }] as AmbientLayerConfig[],
  nightAmbientSounds: [
    { key: 'base-tropical', volume: 0.18 },
    { key: 'night-insects', volume: 0.2 },
  ] as AmbientLayerConfig[],
  footstepSurface: 'stone' as FootstepSurface,
};

/** Phase-of-day beds layered on top of whatever the location asks for. */
export function timeAmbientLayers(phase: TimeOfDay): AmbientLayerConfig[] {
  switch (phase) {
    case 'dawn':
      return [{ key: 'morning-birds', volume: 0.18 }];
    case 'dusk':
      return [{ key: 'evening-calls', volume: 0.15 }];
    case 'night':
      return [
        { key: 'night-insects', volume: 0.2 },
        { key: 'cricket-chorus', volume: 0.18 },
      ];
    default:
      return [];
  }
}

/**
 * Collapse a mixed list of bare keys and configs into unique configs.
 *
 * Later entries win, which is what lets a phase bed override a location bed of
 * the same name (night-insects at the waterfront) instead of the two of them
 * being started twice at different volumes.
 */
export function normalizeAmbientLayers(
  layers?: Array<string | AmbientLayerConfig>
): AmbientLayerConfig[] {
  if (!layers || layers.length === 0) return [];

  const deduped = new Map<string, AmbientLayerConfig>();
  layers.forEach((layer) => {
    if (typeof layer === 'string') {
      deduped.set(layer, { key: layer });
      return;
    }
    if (!layer?.key) return;
    deduped.set(layer.key, layer);
  });

  return [...deduped.values()];
}

export interface LocationAudioBlock {
  music?: string | null;
  nightMusic?: string | null;
  ambientSounds?: Array<string | AmbientLayerConfig>;
  nightAmbientSounds?: Array<string | AmbientLayerConfig>;
  footstepSurface?: string | null;
}

export interface ResolvedLocationAudio {
  music: string;
  nightMusic: string;
  ambientSounds: AmbientLayerConfig[];
  nightAmbientSounds: AmbientLayerConfig[];
  footstepSurface: FootstepSurface;
}

/** A location's audio block with every gap filled from the global fallback. */
export function resolveLocationAudio(audio?: LocationAudioBlock | null): ResolvedLocationAudio {
  const ambient = normalizeAmbientLayers(audio?.ambientSounds);
  const nightAmbient = normalizeAmbientLayers(audio?.nightAmbientSounds);

  return {
    music: audio?.music || FALLBACK_AUDIO.music,
    nightMusic: audio?.nightMusic || audio?.music || FALLBACK_AUDIO.nightMusic,
    ambientSounds: ambient.length > 0 ? ambient : FALLBACK_AUDIO.ambientSounds,
    nightAmbientSounds: nightAmbient.length > 0 ? nightAmbient : FALLBACK_AUDIO.nightAmbientSounds,
    footstepSurface: (audio?.footstepSurface as FootstepSurface) || FALLBACK_AUDIO.footstepSurface,
  };
}

/**
 * The full target state of the mixer for a location at a phase: one music
 * track and the deduped union of the location beds and the phase beds.
 */
export function resolveMixTarget(
  audio: ResolvedLocationAudio,
  phase: TimeOfDay,
  isDark: boolean,
): { musicKey: string; ambient: AmbientLayerConfig[] } {
  return {
    musicKey: isDark ? audio.nightMusic : audio.music,
    ambient: normalizeAmbientLayers([
      ...(isDark ? audio.nightAmbientSounds : audio.ambientSounds),
      ...timeAmbientLayers(phase),
    ]),
  };
}
