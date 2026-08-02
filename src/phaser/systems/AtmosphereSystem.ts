/**
 * AtmosphereSystem — everything between the plate and the characters that is
 * weather, air or lens.
 *
 * Four families, all driven by the same two inputs (phase of day, quality
 * profile) and nothing else:
 *
 *  - **particles**: dust motes, heat haze, fireflies, dawn mist, water sparkle,
 *    fire embers. World-space, so they belong to the place.
 *  - **fog**: drifting screen-space bands, alpha scaled per phase.
 *  - **contact/ambient occlusion**: the edge darkening and the authored AO
 *    zones and canopy shadows that give the painted plate depth.
 *  - **cinematic**: the colour-grade multiply/screen pair, film grain and sun
 *    shafts. These are the "lens", so the grade pair and grain are screen-space
 *    while the shafts are anchored to the plate's own sun.
 *
 * The one rule that keeps this system honest: where the PLATE already carries
 * a baked time-of-day grade, the runtime grade goes to zero
 * (`ctx.hasBakedTimeVariant()`). Grading a night plate again is the
 * double-grade bug, and it is why nights used to turn into crushed blue mud.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';
import { getLocationVisual } from '../core/LocationData';
import type { SystemContext } from '../core/SystemContext';
import type { TimeOfDay } from '../core/timeMath';

/** Dust mote tuning per phase — golden hour carries the most visible dust. */
const DUST_CONFIG: Record<TimeOfDay, { frequency: number; alpha: number; tint: number }> = {
  dawn: { frequency: 200, alpha: 0.12, tint: 0xFFD4B8 },
  day: { frequency: 150, alpha: 0.15, tint: 0xF4E6D3 },
  dusk: { frequency: 80, alpha: 0.25, tint: 0xF4B41A },
  night: { frequency: 300, alpha: 0.08, tint: 0x8888AA },
};

const TIME_COLOR_GRADE = {
  dawn: { multiply: 0x7A5A47, multiplyAlpha: 0.1, screen: 0xF4D7A1, screenAlpha: 0.075 },
  day: { multiply: 0x6A5A45, multiplyAlpha: 0.04, screen: 0xF2E2C5, screenAlpha: 0.035 },
  dusk: { multiply: 0x6C4632, multiplyAlpha: 0.14, screen: 0xE8B16C, screenAlpha: 0.08 },
  night: { multiply: 0x1C2D52, multiplyAlpha: 0.22, screen: 0x6F8CB8, screenAlpha: 0.045 },
} as const;

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

export class AtmosphereSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;

  // particles
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private heatHazeEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private waterEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fireEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private fireflyEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private mistEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  // screen/world FX layers
  private fogLayers: Phaser.GameObjects.Ellipse[] = [];
  private aoOverlays: Phaser.GameObjects.Rectangle[] = [];
  private canopyShadows: Phaser.GameObjects.Ellipse[] = [];
  private colorGradeMultiplyOverlay: Phaser.GameObjects.Rectangle | null = null;
  private colorGradeScreenOverlay: Phaser.GameObjects.Rectangle | null = null;
  private filmGrainOverlay: Phaser.GameObjects.TileSprite | null = null;
  private sunShafts: Phaser.GameObjects.Ellipse[] = [];

  constructor(scene: Phaser.Scene, ctx: SystemContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  /** Build every layer, in the order the scene has always built them. */
  create() {
    this.createParticles();
    this.createWaterAnimations();
    this.createFireAnimations();
    this.createAOOverlays();
    this.createFogLayers();
    this.createCanopyShadows();
    this.createCinematicLayers();
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

  private createWaterAnimations() {
    if (this.ctx.locationId() !== 'waterfront') return;
    const worldBounds = this.ctx.worldBounds();

    this.waterEmitter = this.scene.add.particles(0, 0, 'particle', {
      x: { min: 0, max: worldBounds.width },
      y: { min: worldBounds.height * 0.55, max: worldBounds.height },
      quantity: 1,
      frequency: 200,
      lifespan: { min: 2000, max: 4000 },
      scale: { start: 0.1, end: 0.2 },
      alpha: { start: 0, end: 0.3 },
      tint: 0x5DADE2,
      blendMode: 'ADD',
      emitting: true,
    });
    this.waterEmitter.setDepth(-5);

    this.scene.tweens.add({
      targets: this.waterEmitter,
      particleSpeedX: { from: -2, to: 2 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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

  // -- occlusion -----------------------------------------------------------

  private createAOOverlays() {
    const preset = getLocationVisual(this.ctx.locationId());
    this.aoOverlays.forEach((overlay) => overlay.destroy());
    this.aoOverlays = [];
    if (!preset) return;

    // Global edge darkening to reinforce painted-scene depth.
    const edgeAlpha = this.ctx.visualProfile().aoAlpha;
    const top = this.scene.add.rectangle(GAME_WIDTH / 2, 32, GAME_WIDTH, 64, 0x000000, edgeAlpha);
    const bottom = this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 32, GAME_WIDTH, 64, 0x000000, edgeAlpha * 0.9);
    const left = this.scene.add.rectangle(32, GAME_HEIGHT / 2, 64, GAME_HEIGHT, 0x000000, edgeAlpha * 0.75);
    const right = this.scene.add.rectangle(GAME_WIDTH - 32, GAME_HEIGHT / 2, 64, GAME_HEIGHT, 0x000000, edgeAlpha * 0.75);

    [top, bottom, left, right].forEach((overlay) => {
      overlay.setDepth(940);
      overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
      overlay.setScrollFactor(0);
      this.aoOverlays.push(overlay);
    });

    preset.aoZones.forEach((zone) => {
      const rect = this.scene.add.rectangle(
        zone.x + zone.width / 2,
        zone.y + zone.height / 2,
        zone.width,
        zone.height,
        0x000000,
        zone.alpha * this.ctx.visualProfile().aoAlpha
      );
      rect.setDepth(941);
      rect.setBlendMode(Phaser.BlendModes.MULTIPLY);
      // Authored in plate coordinates, so it belongs to the WORLD; on a
      // viewport-sized plate this is identical to the old scrollFactor(0).
      rect.setScrollFactor(1);
      this.aoOverlays.push(rect);
    });
  }

  private createCanopyShadows() {
    const preset = getLocationVisual(this.ctx.locationId());
    this.canopyShadows.forEach((shadow) => shadow.destroy());
    this.canopyShadows = [];
    if (!preset) return;

    preset.canopyShadows.forEach((zone) => {
      const shadow = this.scene.add.ellipse(
        zone.x + zone.width / 2,
        zone.y + zone.height / 2,
        zone.width,
        zone.height,
        0x000000,
        zone.alpha * this.ctx.visualProfile().canopyShadowAlpha
      );
      shadow.setDepth(942);
      shadow.setBlendMode(Phaser.BlendModes.MULTIPLY);
      shadow.setScrollFactor(1);   // canopy sits over a place, not over the view
      this.canopyShadows.push(shadow);
    });
  }

  // -- fog -----------------------------------------------------------------

  private createFogLayers() {
    const preset = getLocationVisual(this.ctx.locationId());
    this.fogLayers.forEach((layer) => layer.destroy());
    this.fogLayers = [];
    if (!preset) return;

    const baseY = GAME_HEIGHT * 0.6;
    const profileFogLayers = this.ctx.visualProfile().fogLayers;
    for (let i = 0; i < profileFogLayers; i += 1) {
      const width = GAME_WIDTH * (0.8 + i * 0.2);
      const height = 120 + i * 40;
      const x = Phaser.Math.Between(120, GAME_WIDTH - 120);
      const y = baseY + i * 30;
      const fog = this.scene.add.ellipse(
        x, y, width, height, preset.fogTint, this.ctx.visualProfile().fogBaseAlpha
      );
      fog.setDepth(905 + i);
      fog.setScrollFactor(0);
      fog.setBlendMode(Phaser.BlendModes.SCREEN);
      this.fogLayers.push(fog);

      const drift = (30 + i * 18) * preset.fogSpeed;
      this.scene.tweens.add({
        targets: fog,
        x: x + drift,
        duration: 9000 + i * 2200,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }

    this.updateFogForTime();
  }

  updateFogForTime() {
    const multiplier = fogTimeMultiplier(this.ctx.timeOfDay());
    const baseAlpha = this.ctx.visualProfile().fogBaseAlpha * multiplier;
    const visible = multiplier > 0.2;
    const blendMode = this.ctx.timeOfDay() === 'night'
      ? Phaser.BlendModes.MULTIPLY
      : Phaser.BlendModes.SCREEN;

    this.fogLayers.forEach((layer, index) => {
      const alpha = Math.max(0, baseAlpha - index * 0.015);
      layer.setVisible(visible && alpha > 0.01);
      layer.setAlpha(alpha);
      layer.setBlendMode(blendMode);
    });
  }

  // -- cinematic -----------------------------------------------------------

  private createFilmGrainTexture() {
    const textureKey = 'film-grain';
    if (this.scene.textures.exists(textureKey)) return;

    const size = 128;
    const graphics = this.scene.add.graphics({ x: 0, y: 0 });
    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    for (let i = 0; i < 2300; i += 1) {
      graphics.fillRect(
        Phaser.Math.Between(0, size - 1),
        Phaser.Math.Between(0, size - 1),
        1,
        1
      );
    }
    graphics.generateTexture(textureKey, size, size);
    graphics.destroy();
  }

  private createSunShafts() {
    const preset = getLocationVisual(this.ctx.locationId());
    this.sunShafts.forEach((shaft) => shaft.destroy());
    this.sunShafts = [];
    const profile = this.ctx.visualProfile();
    if (!preset || profile.sunShaftCount <= 0) return;

    for (let i = 0; i < profile.sunShaftCount; i += 1) {
      const x = preset.sunAnchor.x + i * 24;
      const y = preset.sunAnchor.y + 140 + i * 20;
      const width = 70 + i * 22;
      const height = 390 + i * 90;
      const shaft = this.scene.add.ellipse(x, y, width, height, preset.hazeTint, profile.sunShaftAlpha);
      shaft.setDepth(903 + i);
      shaft.setBlendMode(Phaser.BlendModes.SCREEN);
      shaft.setScrollFactor(1);    // anchored to the plate's sun, not the view
      shaft.setAngle(Phaser.Math.Between(-9, 9));
      this.sunShafts.push(shaft);

      this.scene.tweens.add({
        targets: shaft,
        alpha: {
          from: profile.sunShaftAlpha * 0.7,
          to: profile.sunShaftAlpha * 1.1,
        },
        duration: 2600 + i * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createCinematicLayers() {
    const preset = getLocationVisual(this.ctx.locationId());
    if (!preset) return;

    this.createFilmGrainTexture();

    if (this.colorGradeMultiplyOverlay) {
      this.colorGradeMultiplyOverlay.destroy();
      this.colorGradeMultiplyOverlay = null;
    }
    if (this.colorGradeScreenOverlay) {
      this.colorGradeScreenOverlay.destroy();
      this.colorGradeScreenOverlay = null;
    }
    if (this.filmGrainOverlay) {
      this.filmGrainOverlay.destroy();
      this.filmGrainOverlay = null;
    }

    this.colorGradeScreenOverlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, preset.hazeTint, 0
    );
    this.colorGradeScreenOverlay.setScrollFactor(0);
    this.colorGradeScreenOverlay.setDepth(944);
    this.colorGradeScreenOverlay.setBlendMode(Phaser.BlendModes.SCREEN);

    this.colorGradeMultiplyOverlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x2B2014, 0
    );
    this.colorGradeMultiplyOverlay.setScrollFactor(0);
    this.colorGradeMultiplyOverlay.setDepth(945);
    this.colorGradeMultiplyOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.filmGrainOverlay = this.scene.add.tileSprite(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'film-grain'
    );
    this.filmGrainOverlay.setScrollFactor(0);
    this.filmGrainOverlay.setDepth(946);
    this.filmGrainOverlay.setBlendMode(Phaser.BlendModes.OVERLAY);
    this.filmGrainOverlay.setTint(0xC2A989);

    this.createSunShafts();
    this.updateCinematicForTime();
  }

  updateCinematicForTime() {
    const preset = getLocationVisual(this.ctx.locationId());
    if (!preset) return;

    const phase = this.ctx.timeOfDay();
    const profile = this.ctx.visualProfile();
    const grade = TIME_COLOR_GRADE[phase];
    // Baked time-of-day plates already contain this grade — don't apply it twice.
    const strength = this.ctx.hasBakedTimeVariant() ? 0 : profile.colorGradeStrength;

    if (this.colorGradeMultiplyOverlay) {
      this.colorGradeMultiplyOverlay.setFillStyle(grade.multiply, grade.multiplyAlpha * strength);
    }
    if (this.colorGradeScreenOverlay) {
      this.colorGradeScreenOverlay.setFillStyle(
        phase === 'night' ? grade.screen : preset.hazeTint,
        grade.screenAlpha * strength
      );
    }

    if (this.filmGrainOverlay) {
      const nightBoost = phase === 'night' ? 1.35 : 1;
      this.filmGrainOverlay.setAlpha(profile.grainAlpha * nightBoost);
    }

    const showShafts = phase === 'dawn' || phase === 'day' || phase === 'dusk';
    const timeScale = phase === 'day' ? 0.65 : phase === 'dawn' ? 1.05 : 0.85;
    this.sunShafts.forEach((shaft) => {
      shaft.setVisible(showShafts);
      shaft.setAlpha(profile.sunShaftAlpha * timeScale);
      shaft.setFillStyle(phase === 'dusk' ? 0xE8B16C : preset.hazeTint, profile.sunShaftAlpha * timeScale);
    });
  }

  // -- frame / phase / quality --------------------------------------------

  /** Per-frame motion. Keep screen-space grain fixed; only the shafts drift. */
  update() {
    this.sunShafts.forEach((shaft, index) => {
      const wobble = Math.sin((this.scene.time.now / 1400) + index * 0.6) * 2.2;
      shaft.setAngle(wobble);
    });
  }

  /** The phase of day changed. */
  setTimeOfDay() {
    this.updateParticlesForTime();
    this.updateFogForTime();
    this.updateCinematicForTime();
  }

  /**
   * The quality tier changed: rebuild every layer whose geometry depends on it.
   * Ordering matches the pre-decomposition `applyVisualProfile`.
   */
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

    this.createAOOverlays();
    this.createCanopyShadows();
    this.createFogLayers();
    this.createCinematicLayers();

    this.updateParticlesForTime();
    this.updateFogForTime();
    this.updateCinematicForTime();
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
    this.waterEmitter?.destroy();
    this.waterEmitter = null;
    this.fireEmitters.forEach((emitter) => emitter.destroy());
    this.fireEmitters = [];

    this.fogLayers.forEach((layer) => layer.destroy());
    this.fogLayers = [];
    this.aoOverlays.forEach((overlay) => overlay.destroy());
    this.aoOverlays = [];
    this.canopyShadows.forEach((shadow) => shadow.destroy());
    this.canopyShadows = [];
    this.sunShafts.forEach((shaft) => shaft.destroy());
    this.sunShafts = [];

    this.colorGradeMultiplyOverlay?.destroy();
    this.colorGradeMultiplyOverlay = null;
    this.colorGradeScreenOverlay?.destroy();
    this.colorGradeScreenOverlay = null;
    this.filmGrainOverlay?.destroy();
    this.filmGrainOverlay = null;
  }
}
