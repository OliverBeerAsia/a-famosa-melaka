/**
 * AudioSystem — the location's mixer.
 *
 * Three independent buses, each with its own volume control in the settings
 * panel and its own lifecycle:
 *
 *  - **music**: one looping track at a time, crossfaded when the location or
 *    the phase of day changes.
 *  - **ambient**: a set of looping beds (surf, market chatter, cicadas) that is
 *    diffed against the target set on every sync — layers that are no longer
 *    wanted fade out, new ones fade in, shared ones stay put and just re-tween
 *    their volume. This is what makes a dusk->night change sound like a change
 *    rather than a cut.
 *  - **sfx**: one-shots, plus the throttled footstep tick.
 *
 * The tween-killing on fade-out is load-bearing, not defensive: a volume tween
 * that outlives its sound writes into a freed WebAudio source, and the
 * exception it throws aborts the WHOLE tween manager step — which is how an
 * audio race used to freeze the time-of-day plate crossfade.
 */

import Phaser from 'phaser';
import { useGameStore } from '../../stores/gameStore';
import type { SystemContext } from '../core/SystemContext';
import { isDarkPhase } from '../core/timeMath';
import {
  normalizeAmbientLayers,
  resolveLocationAudio,
  resolveMixTarget,
  type AmbientLayerConfig,
  type FootstepSurface,
} from '../core/audioMix';

export type { FootstepSurface, AmbientLayerConfig } from '../core/audioMix';

/** Minimum gap between footstep ticks, in ms. */
const FOOTSTEP_INTERVAL_MS = 260;

export class AudioSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;

  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;
  private ambientLayers: Map<string, Phaser.Sound.BaseSound> = new Map();
  private ambientBaseVolumes: Map<string, number> = new Map();
  private nextFootstepAt: number = 0;

  constructor(scene: Phaser.Scene, ctx: SystemContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  // -- location config -----------------------------------------------------

  /**
   * The location's audio block, with the global fallback filled in.
   * Authoritative per-location audio lives in <id>.location.json.
   */
  getSceneAudioConfig() {
    return resolveLocationAudio(this.ctx.location()?.audio);
  }

  /** The surface the location declares, used when no walk mask says otherwise. */
  defaultFootstepSurface(): FootstepSurface {
    return this.getSceneAudioConfig().footstepSurface;
  }

  // -- sync ----------------------------------------------------------------

  /**
   * Bring music and ambience in line with the location and the current phase.
   * `force` shortens the fades — used on scene start, where a slow fade-in
   * would leave the first two seconds of a location silent.
   */
  syncLocationAudio(force: boolean = false) {
    const phase = this.ctx.timeOfDay();
    const target = resolveMixTarget(this.getSceneAudioConfig(), phase, isDarkPhase(phase));
    this.syncMusicTrack(target.musicKey, force);
    this.syncAmbientLayers(target.ambient, force);
  }

  private syncMusicTrack(trackKey: string | null, force: boolean = false) {
    const targetVolume = useGameStore.getState().musicVolume;

    if (!trackKey || !this.scene.cache.audio.exists(trackKey)) {
      this.stopCurrentMusic();
      return;
    }

    if (!force && this.currentMusicKey === trackKey && this.currentMusic) {
      this.setSoundVolume(this.currentMusic, targetVolume);
      return;
    }

    const previousTrack = this.currentMusic;
    this.currentMusic = this.scene.sound.add(trackKey, { loop: true, volume: 0 });
    this.currentMusicKey = trackKey;
    this.currentMusic.play();

    this.scene.tweens.add({
      targets: this.currentMusic,
      volume: targetVolume,
      duration: force ? 600 : 1200,
      ease: 'Sine.easeInOut',
    });

    if (previousTrack) {
      const fadingTrack = previousTrack;
      // Kill anything still fading this track in: a tween that survives the
      // destroy() below writes `volume` into a freed WebAudio source, and the
      // exception it throws aborts the WHOLE tween manager step.
      this.scene.tweens.killTweensOf(fadingTrack);
      this.scene.tweens.add({
        targets: fadingTrack,
        volume: 0,
        duration: 900,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.scene.tweens.killTweensOf(fadingTrack);
          fadingTrack.stop();
          fadingTrack.destroy();
        },
      });
    }
  }

  private syncAmbientLayers(targetLayers: AmbientLayerConfig[], force: boolean = false) {
    const uniqueLayers = normalizeAmbientLayers(targetLayers);
    const targetKeys = new Set(uniqueLayers.map((layer) => layer.key));

    this.ambientLayers.forEach((sound, key) => {
      if (targetKeys.has(key)) return;
      this.fadeOutAmbientLayer(key, sound);
    });

    uniqueLayers.forEach((layer) => {
      if (!this.scene.cache.audio.exists(layer.key)) return;

      this.ambientBaseVolumes.set(layer.key, layer.volume ?? 0.25);
      const targetVolume = this.getAmbientTargetVolume(layer);
      const existing = this.ambientLayers.get(layer.key);

      if (existing) {
        this.scene.tweens.killTweensOf(existing);
        this.scene.tweens.add({
          targets: existing,
          volume: targetVolume,
          duration: force ? 300 : 700,
          ease: 'Sine.easeInOut',
        });
        return;
      }

      const sound = this.scene.sound.add(layer.key, { loop: true, volume: 0 });
      sound.play();
      this.ambientLayers.set(layer.key, sound);

      this.scene.tweens.add({
        targets: sound,
        volume: targetVolume,
        duration: force ? 500 : 1000,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private getAmbientTargetVolume(layer: AmbientLayerConfig): number {
    const baseVolume = layer.volume ?? 0.25;
    return baseVolume * useGameStore.getState().ambientVolume;
  }

  private fadeOutAmbientLayer(key: string, sound: Phaser.Sound.BaseSound) {
    this.ambientLayers.delete(key);
    this.ambientBaseVolumes.delete(key);

    this.scene.tweens.killTweensOf(sound);
    this.scene.tweens.add({
      targets: sound,
      volume: 0,
      duration: 700,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.scene.tweens.killTweensOf(sound);
        sound.stop();
        sound.destroy();
      },
    });
  }

  // -- volumes -------------------------------------------------------------

  private setSoundVolume(sound: Phaser.Sound.BaseSound, volume: number) {
    (sound as Phaser.Sound.BaseSound & { volume: number }).volume = volume;
  }

  setMusicVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    useGameStore.getState().setMusicVolume(clampedVolume);
    if (this.currentMusic) this.setSoundVolume(this.currentMusic, clampedVolume);
  }

  setAmbientVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    useGameStore.getState().setAmbientVolume(clampedVolume);

    this.ambientLayers.forEach((sound, key) => {
      const baseVolume = this.ambientBaseVolumes.get(key) ?? 0.25;
      this.setSoundVolume(sound, baseVolume * clampedVolume);
    });
  }

  // -- one-shots -----------------------------------------------------------

  /**
   * `detune` is in CENTS and exists for the surface responses: a pier board
   * that creaks at exactly the same pitch every fourth step stops being a
   * creak and becomes a rhythm instrument. It is deterministic at the call
   * site (a position hash), never random here.
   */
  playSfx(soundKey: string, volumeScale: number = 1, detune: number = 0) {
    if (!this.scene.cache.audio.exists(soundKey)) return;

    const sfxVolume = useGameStore.getState().sfxVolume;
    const clampedVolume = Math.max(0, Math.min(1, sfxVolume * volumeScale));
    if (clampedVolume <= 0) return;

    this.scene.sound.play(soundKey, detune
      ? { volume: clampedVolume, detune }
      : { volume: clampedVolume });
  }

  /**
   * Throttled footstep tick. The caller supplies the surface (the walk mask
   * carries a surface id per pixel, so on a composed plate the footstep follows
   * what the player is actually standing on); omitting it falls back to the
   * location's declared surface.
   */
  /**
   * Returns true only on the ticks where a step ACTUALLY sounded. The surface
   * responses (dust, pier creak) hang off that return value, so a footstep
   * and the puff it raises can never disagree about how often a step happened
   * — the throttle lives in exactly one place.
   */
  footstep(surface?: FootstepSurface | null): boolean {
    if (this.scene.time.now < this.nextFootstepAt) return false;
    const resolved = surface || this.defaultFootstepSurface();
    this.playSfx(`sfx-footstep-${resolved}`, 0.24);
    this.nextFootstepAt = this.scene.time.now + FOOTSTEP_INTERVAL_MS;
    return true;
  }

  /** Fire the location's arrival sting, if it declares one. */
  playTransitionSound(locationAudio?: { transitionSound?: string | null }) {
    const sfxKey = locationAudio?.transitionSound;
    if (sfxKey && this.scene.cache.audio.exists(sfxKey)) {
      this.scene.sound.play(sfxKey, { volume: 0.4 });
    }
  }

  // -- teardown ------------------------------------------------------------

  private stopCurrentMusic() {
    if (!this.currentMusic) {
      this.currentMusicKey = null;
      return;
    }
    this.currentMusic.stop();
    this.currentMusic.destroy();
    this.currentMusic = null;
    this.currentMusicKey = null;
  }

  /** Hard stop of every bus. Called from the scene's cleanup. */
  destroy() {
    this.stopCurrentMusic();
    this.ambientLayers.forEach((sound) => {
      sound.stop();
      sound.destroy();
    });
    this.ambientLayers.clear();
    this.ambientBaseVolumes.clear();
  }
}
