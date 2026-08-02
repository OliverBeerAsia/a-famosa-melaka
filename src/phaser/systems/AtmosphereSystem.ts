/**
 * AtmosphereSystem — everything between the plate and the characters that is
 * weather, air or lens.
 *
 * TWO FAMILIES NOW, NOT FOUR
 * --------------------------
 *  - **particles**: dust motes, heat haze, fireflies, dawn mist, fire embers.
 *    World-space, so they belong to the place. These are particles, not screen
 *    grades, and they stay.
 *  - **the lens**: ONE `MelakaPostFX` pipeline on the main camera, carrying
 *    grade + haze + vignette/AO + grain + feedback flash. Where the renderer
 *    is Canvas (Phaser.AUTO does pick it: blocklisted GPUs, some VMs,
 *    `--disable-gpu`) or `?fx=off` is set, it degrades to exactly two static
 *    objects and no per-frame work.
 *
 * WHAT THIS REPLACED (game-feel spec §1.7)
 * ----------------------------------------
 * 14-20 blended Game Objects and ~9 perpetual tweens per frame: four edge-AO
 * rects, two authored `visual.aoZones` rects, 2-3 `visual.canopyShadows`
 * ellipses, 0-3 tweened sun-shaft ellipses, 1-3 tweened fog ellipses, a SCREEN
 * grade rect, a MULTIPLY grade rect and a 128 px film-grain TileSprite built
 * from 2 300 `Phaser.Math.Between` calls at boot. Three of those were provably
 * inert on every shipping location; the grain was 1-screen-pixel noise over a
 * 3-screen-pixel image, i.e. a fourth pixel density on screen.
 *
 * Also gone: `createWaterAnimations()`, whose ADD particles were tinted
 * `0x5DADE2` — a colour that is not in the 50-colour canon and cannot be, since
 * canon water tops out at `water-4 #78BCB0`. Water motion is now the
 * pre-rendered palette cycle in `WaterCycleSystem`.
 *
 * The one rule that keeps this system honest is unchanged: where the PLATE
 * already carries a baked time-of-day grade, the runtime grade does not add
 * one. The LUT it does apply is near-identity by construction — worst canon
 * drift under 8/255, gated by `tools/forge/grade-lut.cjs`.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';
import { getLocationVisual } from '../core/LocationData';
import gradeFallback from '../../data/grade-fallback.json';
import { MelakaPostFX, MELAKA_POSTFX_KEY, ensureMelakaPostFX } from '../pipelines/MelakaPostFX';
import {
  VIGNETTE_EDGE_RATIO,
  VIGNETTE_POWER,
  grainSeedFor,
  resolvePostFX,
} from '../core/postfxParams';
import { WaterCycleSystem } from './WaterCycleSystem';
import type { SystemContext } from '../core/SystemContext';
import type { TimeOfDay } from '../core/timeMath';

/** Dust mote tuning per phase — golden hour carries the most visible dust. */
const DUST_CONFIG: Record<TimeOfDay, { frequency: number; alpha: number; tint: number }> = {
  dawn: { frequency: 200, alpha: 0.12, tint: 0xFFD4B8 },
  day: { frequency: 150, alpha: 0.15, tint: 0xF4E6D3 },
  dusk: { frequency: 80, alpha: 0.25, tint: 0xF4B41A },
  night: { frequency: 300, alpha: 0.08, tint: 0x8888AA },
};

/** Depth of the two Canvas-fallback objects. Below the UI band (1001). */
const FALLBACK_GRADE_DEPTH = 998;
const FALLBACK_VIGNETTE_DEPTH = 999;

/** How much the fog bank thickens or thins with the hour. */
export function fogTimeMultiplier(phase: TimeOfDay): number {
  switch (phase) {
    case 'dawn': return 1.35;
    case 'day': return 0.45;
    case 'dusk': return 1;
    case 'night': return 1.2;
    default: return 1;
  }
}

/** LUT texture key for a (location, phase) pair. See BootScene.loadGradeLuts. */
export function gradeLutKey(locationId: string, phase: TimeOfDay): string {
  return `lut-${locationId}-${phase}`;
}

/** `?fx=off` forces the Canvas fallback, for the A/B parity screenshots. */
export function postFXDisabledByFlag(search?: string): boolean {
  const q = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  return /(^|[?&])fx=off(&|$)/.test(q);
}

const FALLBACK_LUTS = (gradeFallback as {
  fallbackAlpha: number;
  luts: Record<string, { multiply: string; rawMidGrey: string }>;
}).luts;
const FALLBACK_ALPHA = (gradeFallback as { fallbackAlpha: number }).fallbackAlpha;

export class AtmosphereSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;

  // particles (world-space; these are not screen grades and they stay)
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private heatHazeEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fireEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private fireflyEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private mistEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Pre-rendered water palette cycling (waterfront + kampung only). */
  private water: WaterCycleSystem | null = null;

  // the lens
  private pipeline: MelakaPostFX | null = null;
  private usingPipeline = false;
  private fallbackVignette: Phaser.GameObjects.Graphics | null = null;
  private fallbackGrade: Phaser.GameObjects.Rectangle | null = null;
  private flashTween: Phaser.Tweens.Tween | null = null;
  /** Held flash level (dialogue/pause dim), which pulses tween on top of. */
  private baseFlash = 0;

  constructor(scene: Phaser.Scene, ctx: SystemContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  /** Build the particle layers, then attach the lens. */
  create() {
    this.createParticles();
    this.createFireAnimations();
    this.water = new WaterCycleSystem(this.scene, this.ctx);
    this.water.create();
    this.createLens();
  }

  /** The water cycle's live state, for the DEV acceptance hook. */
  debugWater() {
    return this.water?.debugState() ?? null;
  }

  // -- particles -----------------------------------------------------------

  private createParticles() {
    const worldBounds = this.ctx.worldBounds();

    // Dust motes - intensity varies by time of day
    const dustParticles = this.scene.add.particles(0, 0, 'particle', {
      x: { min: 0, max: worldBounds.width },
      y: { min: 0, max: worldBounds.height },
      quantity: 1,
      frequency: 150,
      lifespan: { min: 8000, max: 12000 },
      speedX: { min: -5, max: 5 },
      speedY: { min: -8, max: -3 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0, end: 0.15 },
      tint: 0xF4E6D3,
      blendMode: 'ADD',
      emitting: true,
    });
    dustParticles.setDepth(900);
    this.dustEmitter = dustParticles;

    // Heat haze - only during day/dusk
    const heatHazeParticles = this.scene.add.particles(0, 0, 'particle', {
      x: { min: 0, max: worldBounds.width },
      y: { min: worldBounds.height * 0.3, max: worldBounds.height },
      quantity: 1,
      frequency: 300,
      lifespan: { min: 5000, max: 8000 },
      speedX: { min: -3, max: 3 },
      speedY: { min: -5, max: 0 },
      scale: { start: 1.5, end: 2.5 },
      alpha: { start: 0, end: 0.05 },
      tint: 0xF4B41A,
      blendMode: 'ADD',
      emitting: true,
    });
    heatHazeParticles.setDepth(850);
    this.heatHazeEmitter = heatHazeParticles;

    this.createFireflyTexture();
    this.createMistTexture();

    this.updateParticlesForTime();
  }

  private createFireflyTexture() {
    if (this.scene.textures.exists('firefly')) return;
    const graphics = this.scene.make.graphics({ x: 0, y: 0 });
    // Soft glowing center
    graphics.fillStyle(0xFFFF88, 1);
    graphics.fillCircle(4, 4, 2);
    // Glow halo
    graphics.fillStyle(0xAAFF44, 0.5);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('firefly', 8, 8);
    graphics.destroy();
  }

  private createMistTexture() {
    if (this.scene.textures.exists('mist')) return;
    const graphics = this.scene.make.graphics({ x: 0, y: 0 });
    // Soft diffuse mist blob
    graphics.fillStyle(0xFFFFFF, 0.3);
    graphics.fillCircle(16, 16, 16);
    graphics.fillStyle(0xFFFFFF, 0.15);
    graphics.fillCircle(16, 16, 24);
    graphics.generateTexture('mist', 48, 48);
    graphics.destroy();
  }

  private createFireAnimations() {
    this.fireEmitters.forEach((emitter) => emitter.destroy());
    this.fireEmitters = [];
    const lightAlpha = this.ctx.visualProfile().pointLightAlphaMultiplier;

    const positions = this.ctx.location()?.fires ?? [];
    const phase = this.ctx.timeOfDay();
    const isDark = phase === 'night' || phase === 'dusk';

    positions.forEach((pos) => {
      const emitter = this.scene.add.particles(pos.x, pos.y, 'particle', {
        quantity: 1,
        frequency: 80,
        lifespan: { min: 600, max: 1000 },
        speedY: { min: -40, max: -20 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.6 * lightAlpha, end: 0 },
        tint: [0xFF6347, 0xFF8C00, 0xF4B41A],
        blendMode: 'ADD',
        emitting: isDark,
      });
      emitter.setDepth(961);
      this.fireEmitters.push(emitter);
    });
  }

  updateParticlesForTime() {
    const phase = this.ctx.timeOfDay();
    const profile = this.ctx.visualProfile();

    // Update dust motes - more visible at golden hour
    if (this.dustEmitter) {
      const config = DUST_CONFIG[phase];
      const frequency = Math.max(40, Math.round(config.frequency * profile.dustFrequencyMultiplier));
      this.dustEmitter.setFrequency(frequency);
      this.dustEmitter.setParticleTint(config.tint);
    }

    // Heat haze - only during day and dusk
    if (this.heatHazeEmitter) {
      const showHeatHaze = profile.heatHazeEnabled && (phase === 'day' || phase === 'dusk');
      this.heatHazeEmitter.stop();
      if (showHeatHaze) this.heatHazeEmitter.start();
    }

    this.updateFireflies();
    this.updateMist();

    // Fire/Torches - only at dusk and night
    const showFire = phase === 'night' || phase === 'dusk';
    this.fireEmitters.forEach((emitter) => {
      if (showFire) emitter.start();
      else emitter.stop();
    });
  }

  private updateFireflies() {
    const showFireflies = this.ctx.timeOfDay() === 'night';
    const isKampung = this.ctx.locationId() === 'kampung';
    const worldBounds = this.ctx.worldBounds();

    if (showFireflies) {
      if (!this.fireflyEmitter) {
        const fireflyParticles = this.scene.add.particles(0, 0, 'firefly', {
          x: { min: 50, max: Math.max(60, worldBounds.width - 50) },
          y: { min: worldBounds.height * 0.4, max: worldBounds.height * 0.8 },
          quantity: 1,
          frequency: isKampung ? 400 : 800,  // More fireflies in kampung
          lifespan: { min: 3000, max: 6000 },
          speedX: { min: -8, max: 8 },
          speedY: { min: -5, max: 5 },
          scale: { start: 0.4, end: 0.8 },
          alpha: { start: 0.8, end: 0, ease: 'Sine.easeInOut' },
          blendMode: 'ADD',
          emitting: true,
        });
        fireflyParticles.setDepth(950);
        this.fireflyEmitter = fireflyParticles;
      } else {
        this.fireflyEmitter.start();
        this.fireflyEmitter.setFrequency(isKampung ? 400 : 800);
      }
    } else if (this.fireflyEmitter) {
      this.fireflyEmitter.stop();
    }
  }

  private updateMist() {
    const showMist = this.ctx.timeOfDay() === 'dawn';
    const isWaterfront = this.ctx.locationId() === 'waterfront';
    const worldBounds = this.ctx.worldBounds();

    if (showMist) {
      if (!this.mistEmitter) {
        const mistParticles = this.scene.add.particles(0, 0, 'mist', {
          x: { min: 0, max: worldBounds.width },
          y: { min: worldBounds.height * 0.6, max: worldBounds.height },
          quantity: 1,
          frequency: isWaterfront ? 500 : 1000,  // More mist at waterfront
          lifespan: { min: 8000, max: 15000 },
          speedX: { min: 3, max: 8 },
          speedY: { min: -2, max: 2 },
          scale: { start: 0.5, end: 1.5 },
          alpha: { start: 0.3, end: 0 },
          blendMode: 'SCREEN',
          emitting: true,
        });
        mistParticles.setDepth(800);
        this.mistEmitter = mistParticles;
      } else {
        this.mistEmitter.start();
        this.mistEmitter.setFrequency(isWaterfront ? 500 : 1000);
      }
    } else if (this.mistEmitter) {
      this.mistEmitter.stop();
    }
  }

  // -- the lens ------------------------------------------------------------

  /** True when the shader path is live (for the dev overlay / acceptance hook). */
  hasPipeline(): boolean {
    return this.usingPipeline;
  }

  /** What the lens is actually doing right now. DEV acceptance hook. */
  debugLens() {
    const numbers = this.lensNumbers();
    return {
      postFX: this.usingPipeline,
      lut: this.usingPipeline
        ? gradeLutKey(this.ctx.locationId(), this.ctx.timeOfDay())
        : null,
      vignette: numbers.vigStrength,
      grain: numbers.grainAmt,
      haze: numbers.hazeAmt * fogTimeMultiplier(this.ctx.timeOfDay()),
    };
  }

  private createLens() {
    const webgl = this.scene.game.renderer.type === Phaser.WEBGL;
    const wanted = webgl
      && !postFXDisabledByFlag()
      && ensureMelakaPostFX(this.scene.game);

    // Every camera-manager access in this system is optional-chained. It is
    // live during `create()`, but the whole class of bug this guards against
    // cost a day once already (a throw in `destroy()` aborted scene teardown
    // and `scene.restart()` never completed, so every exit silently did
    // nothing) — and there is no version of "attach the grade" that is worth
    // taking the scene down for.
    const camera = this.scene.cameras?.main;
    if (wanted && camera) {
      camera.setPostPipeline(MELAKA_POSTFX_KEY);
      const found = camera.getPostPipeline(MELAKA_POSTFX_KEY);
      const pipeline = (Array.isArray(found) ? found[0] : found) as unknown as MelakaPostFX | undefined;
      if (pipeline instanceof MelakaPostFX) {
        this.pipeline = pipeline;
        this.usingPipeline = true;
        this.applyLensParams();
        return;
      }
      // Registration failed (shader compile error on an odd driver). Fall
      // through rather than shipping an ungraded, unvignetted frame.
      camera.resetPostPipeline();
      console.warn('[AtmosphereSystem] MelakaPostFX unavailable — using the Canvas fallback');
    }

    this.createCanvasFallbackFX();
  }

  /**
   * The Canvas fallback: exactly two objects, no per-frame work.
   *
   * 1. a vignette `Graphics` at corner alpha `vigStrength`, edge alpha
   *    `vigStrength x 0.42` — the same two numbers the shader's falloff hits;
   * 2. one MULTIPLY `Rectangle` in the LUT's own flat approximation.
   *
   * Haze and grain are OFF here. Flash is not: feedback is game information,
   * so it degrades to an alpha/colour tween on the fallback rect rather than
   * being lost.
   */
  private createCanvasFallbackFX() {
    this.destroyLens();
    const { vigStrength } = this.lensNumbers();

    const grade = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      this.fallbackGradeColour(), FALLBACK_ALPHA,
    );
    grade.setScrollFactor(0);
    grade.setDepth(FALLBACK_GRADE_DEPTH);
    grade.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.fallbackGrade = grade;

    const vignette = this.scene.add.graphics();
    vignette.setScrollFactor(0);
    vignette.setDepth(FALLBACK_VIGNETTE_DEPTH);
    this.paintFallbackVignette(vignette, vigStrength);
    this.fallbackVignette = vignette;
  }

  /**
   * Four edge gradients. They sum at the corners, which is exactly the
   * behaviour the shader's radial falloff reproduces: edge midpoints at
   * `strength x 0.42`, corners at `strength`.
   */
  private paintFallbackVignette(g: Phaser.GameObjects.Graphics, strength: number) {
    g.clear();
    const edge = strength * VIGNETTE_EDGE_RATIO;
    const bandX = Math.round(GAME_WIDTH * 0.34);
    const bandY = Math.round(GAME_HEIGHT * 0.34);
    const black = 0x000000;

    // top / bottom
    g.fillGradientStyle(black, black, black, black, edge, edge, 0, 0);
    g.fillRect(0, 0, GAME_WIDTH, bandY);
    g.fillGradientStyle(black, black, black, black, 0, 0, edge, edge);
    g.fillRect(0, GAME_HEIGHT - bandY, GAME_WIDTH, bandY);
    // left / right
    g.fillGradientStyle(black, black, black, black, edge, 0, edge, 0);
    g.fillRect(0, 0, bandX, GAME_HEIGHT);
    g.fillGradientStyle(black, black, black, black, 0, edge, 0, edge);
    g.fillRect(GAME_WIDTH - bandX, 0, bandX, GAME_HEIGHT);
  }

  private fallbackGradeColour(): number {
    const key = `${this.ctx.locationId()}-${this.ctx.timeOfDay()}`;
    const hex = FALLBACK_LUTS[key]?.multiply ?? '#FFFFFF';
    return parseInt(hex.replace('#', ''), 16);
  }

  /** The resolved per-location / per-profile / per-phase numbers. */
  private lensNumbers() {
    return resolvePostFX(
      this.ctx.locationId(),
      this.ctx.quality(),
      this.ctx.timeOfDay() === 'night',
    );
  }

  /** Push location, phase and quality into whichever lens is live. */
  private applyLensParams() {
    const preset = getLocationVisual(this.ctx.locationId());
    const numbers = this.lensNumbers();

    if (this.pipeline) {
      this.pipeline.configure({
        lutKey: gradeLutKey(this.ctx.locationId(), this.ctx.timeOfDay()),
        vigStrength: numbers.vigStrength,
        vigPower: VIGNETTE_POWER,
        grainAmt: numbers.grainAmt,
        hazeColour: preset?.fogTint ?? 0xB8B4CB,
        // The fog bank still thickens and thins with the hour; it is one
        // uniform now instead of three tweened ellipses.
        hazeAmt: numbers.hazeAmt * fogTimeMultiplier(this.ctx.timeOfDay()),
        hazeY: numbers.hazeY,
        hazeSpeed: preset?.fogSpeed ?? 0.4,
      });
      return;
    }

    if (this.fallbackGrade) {
      this.fallbackGrade.setFillStyle(this.fallbackGradeColour(), FALLBACK_ALPHA);
    }
    if (this.fallbackVignette) {
      this.paintFallbackVignette(this.fallbackVignette, numbers.vigStrength);
    }
  }

  // -- feedback flash ------------------------------------------------------

  /**
   * A one-shot feedback flash (game-feel spec §3).
   *
   * `amount` > 0 mixes toward `colour`; `amount` < 0 darkens (the dialogue and
   * pause dims). Never quality-scaled — this is information, not decoration.
   * On Canvas it degrades to an alpha step on the fallback rect so feedback is
   * never simply lost.
   */
  flash(amount: number, durationMs: number, colour: number = 0xFFF4D4) {
    this.flashTween?.remove();
    this.flashTween = null;

    if (this.pipeline) {
      this.pipeline.setFlash(amount, colour);
      const counter = { v: amount };
      this.flashTween = this.scene.tweens.add({
        targets: counter,
        v: this.baseFlash,
        duration: durationMs,
        ease: 'Sine.easeOut',
        onUpdate: () => this.pipeline?.setFlash(counter.v, colour),
        onComplete: () => {
          this.pipeline?.setFlash(this.baseFlash, colour);
          this.flashTween = null;
        },
      });
      return;
    }

    const rect = this.fallbackGrade;
    if (!rect) return;
    const restoreColour = this.fallbackGradeColour();
    rect.setFillStyle(amount > 0 ? colour : 0x000000, FALLBACK_ALPHA + Math.abs(amount) * 1.6);
    this.flashTween = this.scene.tweens.add({
      targets: rect,
      alpha: 1,
      duration: Math.min(durationMs, 120),
      onComplete: () => {
        rect.setFillStyle(restoreColour, FALLBACK_ALPHA);
        rect.setAlpha(1);
        this.flashTween = null;
      },
    });
  }

  /**
   * A HELD dim, released by calling with 0. Used by dialogue (−0.06) and pause
   * (−0.10), where the world stays down for as long as the panel is up.
   */
  setHeldFlash(amount: number, durationMs: number = 200, colour: number = 0xFFF4D4) {
    this.baseFlash = amount;
    if (!this.pipeline) {
      if (this.fallbackGrade) {
        this.fallbackGrade.setFillStyle(
          amount < 0 ? 0x000000 : this.fallbackGradeColour(),
          FALLBACK_ALPHA + Math.abs(amount) * 1.6,
        );
      }
      return;
    }
    this.flashTween?.remove();
    const counter = { v: this.pipeline.getFlash() };
    this.flashTween = this.scene.tweens.add({
      targets: counter,
      v: amount,
      duration: durationMs,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.pipeline?.setFlash(counter.v, colour),
      onComplete: () => { this.flashTween = null; },
    });
  }

  // -- frame / phase / quality --------------------------------------------

  /**
   * Per-frame: advance the shader clock and the 8 Hz grain seed. That is the
   * entire per-frame cost of the lens — there are no tweens left to drive.
   */
  update() {
    if (!this.pipeline) return;
    const now = this.scene.time.now;
    this.pipeline.tick(now, grainSeedFor(now));
  }

  /** The phase of day changed. */
  setTimeOfDay() {
    this.updateParticlesForTime();
    // Swap the water strips to the new hour's frames, keeping the frame index
    // so the harbour does not reset mid-crossfade.
    this.water?.setTimeOfDay();
    this.applyLensParams();
  }

  /** The quality tier changed. Only the lens numbers and the emitters move. */
  applyQuality() {
    const profile = this.ctx.visualProfile();
    if (this.heatHazeEmitter) {
      const phase = this.ctx.timeOfDay();
      if (!profile.heatHazeEnabled) {
        this.heatHazeEmitter.stop();
      } else if (phase === 'day' || phase === 'dusk') {
        this.heatHazeEmitter.start();
      }
    }

    this.applyLensParams();
    this.water?.applyQuality();
    this.updateParticlesForTime();
  }

  private destroyLens() {
    this.flashTween?.remove();
    this.flashTween = null;
    this.fallbackVignette?.destroy();
    this.fallbackVignette = null;
    this.fallbackGrade?.destroy();
    this.fallbackGrade = null;
  }

  destroy() {
    this.dustEmitter?.destroy();
    this.dustEmitter = null;
    this.heatHazeEmitter?.destroy();
    this.heatHazeEmitter = null;
    this.fireflyEmitter?.destroy();
    this.fireflyEmitter = null;
    this.mistEmitter?.destroy();
    this.mistEmitter = null;
    this.fireEmitters.forEach((emitter) => emitter.destroy());
    this.fireEmitters = [];
    this.water?.destroy();
    this.water = null;

    if (this.usingPipeline) {
      // The pipeline instance belongs to the camera, which survives a scene
      // restart — hand it back rather than destroying a shared object.
      //
      // THE GUARD IS LOAD-BEARING. `destroy()` runs on SHUTDOWN as well as on
      // a location change, and on shutdown the camera manager may already be
      // gone: `cameras.main` is undefined and this line throws. A throw in
      // teardown leaves the scene half-shut-down and `scene.restart()` never
      // completes — which is exactly how this bug presented, as "walking
      // through an exit silently does nothing".
      this.pipeline?.setFlash(0);
      try {
        this.scene.cameras?.main?.resetPostPipeline();
      } catch (error) {
        console.warn('[AtmosphereSystem] post-pipeline detach skipped:', error);
      }
      this.pipeline = null;
      this.usingPipeline = false;
    }
    this.destroyLens();
  }
}
