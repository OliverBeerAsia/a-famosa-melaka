import { describe, it, expect } from 'vitest';
import {
  FALLBACK_AUDIO,
  normalizeAmbientLayers,
  resolveLocationAudio,
  resolveMixTarget,
  timeAmbientLayers,
} from './audioMix';

describe('normalizeAmbientLayers', () => {
  it('returns an empty list for nothing', () => {
    expect(normalizeAmbientLayers()).toEqual([]);
    expect(normalizeAmbientLayers([])).toEqual([]);
  });

  it('promotes bare keys to configs', () => {
    expect(normalizeAmbientLayers(['surf'])).toEqual([{ key: 'surf' }]);
  });

  it('keeps declared volumes', () => {
    expect(normalizeAmbientLayers([{ key: 'surf', volume: 0.4 }]))
      .toEqual([{ key: 'surf', volume: 0.4 }]);
  });

  it('dedupes by key with the last entry winning', () => {
    const out = normalizeAmbientLayers([
      { key: 'night-insects', volume: 0.1 },
      { key: 'night-insects', volume: 0.3 },
    ]);
    expect(out).toEqual([{ key: 'night-insects', volume: 0.3 }]);
  });

  it('drops malformed entries', () => {
    const out = normalizeAmbientLayers([{ key: '' }, null as never, { key: 'ok' }]);
    expect(out).toEqual([{ key: 'ok' }]);
  });

  it('preserves first-seen order', () => {
    const out = normalizeAmbientLayers(['a', 'b', { key: 'a', volume: 0.9 }]);
    expect(out.map((l) => l.key)).toEqual(['a', 'b']);
    expect(out[0].volume).toBe(0.9);
  });
});

describe('timeAmbientLayers', () => {
  it('adds nothing during the day', () => {
    expect(timeAmbientLayers('day')).toEqual([]);
  });

  it('adds birds at dawn and calls at dusk', () => {
    expect(timeAmbientLayers('dawn').map((l) => l.key)).toEqual(['morning-birds']);
    expect(timeAmbientLayers('dusk').map((l) => l.key)).toEqual(['evening-calls']);
  });

  it('adds two insect beds at night', () => {
    expect(timeAmbientLayers('night').map((l) => l.key))
      .toEqual(['night-insects', 'cricket-chorus']);
  });
});

describe('resolveLocationAudio', () => {
  it('falls back completely for a location with no audio block', () => {
    const out = resolveLocationAudio(null);
    expect(out.music).toBe(FALLBACK_AUDIO.music);
    expect(out.nightMusic).toBe(FALLBACK_AUDIO.nightMusic);
    expect(out.footstepSurface).toBe('stone');
    expect(out.ambientSounds).toEqual(FALLBACK_AUDIO.ambientSounds);
  });

  it('reuses the day track for night when no night track is declared', () => {
    const out = resolveLocationAudio({ music: 'music-quay' });
    expect(out.nightMusic).toBe('music-quay');
  });

  it('prefers a declared night track', () => {
    const out = resolveLocationAudio({ music: 'music-quay', nightMusic: 'music-quay-night' });
    expect(out.nightMusic).toBe('music-quay-night');
  });

  it('normalizes declared beds', () => {
    const out = resolveLocationAudio({ ambientSounds: ['surf', 'surf'] });
    expect(out.ambientSounds).toEqual([{ key: 'surf' }]);
  });

  it('keeps the declared footstep surface', () => {
    expect(resolveLocationAudio({ footstepSurface: 'wood' }).footstepSurface).toBe('wood');
  });
});

describe('resolveMixTarget', () => {
  const audio = resolveLocationAudio({
    music: 'music-street',
    nightMusic: 'music-street-night',
    ambientSounds: [{ key: 'market', volume: 0.3 }],
    nightAmbientSounds: [{ key: 'night-insects', volume: 0.05 }],
  });

  it('picks the day track and day beds in daylight', () => {
    const out = resolveMixTarget(audio, 'day', false);
    expect(out.musicKey).toBe('music-street');
    expect(out.ambient.map((l) => l.key)).toEqual(['market']);
  });

  it('picks the night track and unions the phase beds after dark', () => {
    const out = resolveMixTarget(audio, 'night', true);
    expect(out.musicKey).toBe('music-street-night');
    expect(out.ambient.map((l) => l.key)).toEqual(['night-insects', 'cricket-chorus']);
  });

  it('lets a phase bed override a location bed of the same name', () => {
    // The location asks for a very quiet night-insects; the night phase bed is
    // declared after it, so the phase volume is what actually plays.
    const out = resolveMixTarget(audio, 'night', true);
    expect(out.ambient.find((l) => l.key === 'night-insects')?.volume).toBe(0.2);
  });

  it('adds the dawn bed on top of the day beds', () => {
    const out = resolveMixTarget(audio, 'dawn', false);
    expect(out.ambient.map((l) => l.key)).toEqual(['market', 'morning-birds']);
  });

  it('never returns duplicate keys', () => {
    (['dawn', 'day', 'dusk', 'night'] as const).forEach((phase) => {
      const out = resolveMixTarget(audio, phase, phase === 'night' || phase === 'dusk');
      expect(new Set(out.ambient.map((l) => l.key)).size).toBe(out.ambient.length);
    });
  });
});
