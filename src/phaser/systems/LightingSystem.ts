/**
 * LightingSystem — every light in the world, and the one place a character's
 * tint and alpha are written.
 *
 * Three layers:
 *
 *  1. **The time-of-day overlay** — a full-screen tint rectangle. Suppressed to
 *     zero alpha where the plate already ships a baked variant, because grading
 *     a night plate again is the double-grade bug.
 *  2. **Location practicals** — the torches, lanterns, cooking fires and lit
 *     windows the location data declares, drawn as stepped radial gradients and
 *     flickered on a timer. Skipped entirely on a Forge-composed plate, whose
 *     night/dusk variants have those pools PAINTED IN at the same coordinates.
 *  3. **Character lighting** — the tint/alpha pass over the player and NPCs,
 *     plus their contact shadows.
 *
 * The alpha compositor is the load-bearing part. Character alpha is a product
 * of independent factors (time-of-day lighting x stealth) and is written in
 * exactly one place: `applyCompositedAlpha()`. Never call `setAlpha()` on a
 * character anywhere else — set a factor instead.
 */

import Phaser from 'phaser';
import type { SystemContext } from '../core/SystemContext';
import {
  characterLightingSignature,
  compositeAlpha,
  getShadowConfig,
  lightsAreLit,
  TIME_CHARACTER_LIGHTING,
  TIME_COLORS,
} from '../core/lightingMath';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';

type LightType = 'torch' | 'lantern' | 'cookingFire' | 'window';

interface LightTypeConfig {
  color: number;
  radius: number;
  intensity: number;
  flicker: boolean;
  flickerSpeed: number;
  flickerAmount: number;
  nightOnly: boolean;
}

const LIGHT_TYPE_CONFIGS: Record<LightType, LightTypeConfig> = {
  torch: {
    color: 0xFF8C00, radius: 140, intensity: 0.8,
    flicker: true, flickerSpeed: 100, flickerAmount: 0.2, nightOnly: false,
  },
  lantern: {
    color: 0xFFD700, radius: 96, intensity: 0.7,
    flicker: false, flickerSpeed: 0, flickerAmount: 0, nightOnly: false,
  },
  cookingFire: {
    color: 0xFF6347, radius: 192, intensity: 0.9,
    flicker: true, flickerSpeed: 80, flickerAmount: 0.3, nightOnly: false,
  },
  window: {
    color: 0xFFFACD, radius: 72, intensity: 0.5,
    flicker: false, flickerSpeed: 0, flickerAmount: 0, nightOnly: true,
  },
};

/** How the system finds the characters it lights. */
export interface CharacterSource {
  playerShadow(): Phaser.GameObjects.Ellipse | null;
  npcs(): Phaser.Physics.Arcade.Sprite[];
  npcShadow(npc: Phaser.Physics.Arcade.Sprite): Phaser.GameObjects.Ellipse | undefined;
}

export class LightingSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly characters: CharacterSource;

  private overlay: Phaser.GameObjects.Rectangle | null = null;
  private isTransitioningTime = false;
  private lightSources: Phaser.GameObjects.GameObject[] = [];
  private lightTimers: Phaser.Time.TimerEvent[] = [];

  // Independent dimming factors, composited in exactly one place.
  private lightingAlpha = 1;
  private stealthAlpha = 1;
  private lastSignature: string | null = null;

  constructor(scene: Phaser.Scene, ctx: SystemContext, characters: CharacterSource) {
    this.scene = scene;
    this.ctx = ctx;
    this.characters = characters;
  }

  // -- practicals ----------------------------------------------------------

  /**
   * Build the location's practical lights.
   *
   * A Forge-composed plate has its practicals BAKED into the night and dusk
   * variants at these exact coordinates (relight-plates.cjs light pass), so the
   * runtime additive glow would be the double-grade bug in a new costume:
   * seventeen 140px ADD discs stacked on seventeen painted pools. Where the
   * plate carries the light, the runtime does not add any.
   */
  createLocationLights() {
    this.destroyLights();

    if (this.ctx.location()?.plate.authoringBasis === 'forge-compositor') return;

    const lightDefs = this.ctx.location()?.lights ?? [];
    const lightAlpha = this.ctx.visualProfile().pointLightAlphaMultiplier;

    lightDefs.forEach((def, index) => {
      const typeConfig = LIGHT_TYPE_CONFIGS[def.type as LightType];
      if (!typeConfig) return;

      // Graduated radial gradient, drawn as concentric fills.
      const gfx = this.scene.add.graphics();
      gfx.setPosition(def.x, def.y);
      gfx.setDepth(960);
      gfx.setBlendMode(Phaser.BlendModes.ADD);

      const steps = 10;
      const draw = (intensity: number) => {
        gfx.clear();
        for (let i = steps; i > 0; i--) {
          const stepRadius = (typeConfig.radius / steps) * i;
          const alpha = (intensity / steps) * (steps - i + 1) * 0.5 * lightAlpha;
          gfx.fillStyle(typeConfig.color, alpha);
          gfx.fillCircle(0, 0, stepRadius);
        }
      };
      draw(typeConfig.intensity);
      gfx.setVisible(false);

      if (typeConfig.flicker) {
        // Redraw at a jittered intensity. Tracked so the timer dies with the
        // scene rather than ticking against a destroyed Graphics.
        this.lightTimers.push(this.scene.time.addEvent({
          delay: typeConfig.flickerSpeed,
          loop: true,
          callback: () => {
            if (!gfx.active) return;
            const variation = Phaser.Math.FloatBetween(
              -typeConfig.flickerAmount,
              typeConfig.flickerAmount,
            );
            draw(Math.max(0.1, Math.min(1, typeConfig.intensity + variation)));
          },
        }));
      } else {
        // Non-flickering lights get a gentle pulse tween
        this.scene.tweens.add({
          targets: gfx,
          alpha: { from: 0.7, to: 1.0 },
          duration: 1800 + index * 250,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      gfx.setData('nightOnly', typeConfig.nightOnly);
      this.lightSources.push(gfx);
    });

    this.updateLocationLightsForTime();
  }

  /** Practicals are lit at dusk and night, dark otherwise. */
  updateLocationLightsForTime() {
    const lit = lightsAreLit(this.ctx.timeOfDay());
    this.lightSources.forEach((glow) => {
      (glow as Phaser.GameObjects.Graphics).setVisible(lit);
    });
  }

  private destroyLights() {
    this.lightTimers.forEach((timer) => timer.remove(false));
    this.lightTimers = [];
    this.lightSources.forEach((glow) => {
      this.scene.tweens.killTweensOf(glow);
      glow.destroy();
    });
    this.lightSources = [];
  }

  // -- screen overlay ------------------------------------------------------

  /** Create the full-screen tint rectangle and apply the current phase to it. */
  createOverlay() {
    this.overlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0
    );
    this.overlay.setDepth(950);
    this.overlay.setScrollFactor(0);
  }

  /**
   * Bring the overlay in line with the phase.
   *
   * `animate` crossfades over 2s via a throwaway second rectangle, because a
   * Rectangle's fill colour cannot itself be tweened.
   */
  applyLightingForTime(animate: boolean = true) {
    if (!this.overlay) return;
    if (this.isTransitioningTime) return;

    const baseConfig = TIME_COLORS[this.ctx.timeOfDay()];
    // Baked time-of-day plates already carry this tint — applying it again
    // double-grades the backdrop, so the overlay goes fully transparent.
    const config = this.ctx.hasBakedTimeVariant()
      ? { color: baseConfig.color, alpha: 0 }
      : baseConfig;

    if (!animate) {
      this.overlay.setFillStyle(config.color, config.alpha);
      return;
    }

    this.isTransitioningTime = true;

    const overlay = this.overlay;
    this.scene.tweens.add({
      targets: overlay,
      alpha: config.alpha,
      duration: 2000,
      ease: 'Sine.easeInOut',
      onComplete: () => { this.isTransitioningTime = false; },
    });

    const transitionOverlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, config.color, 0
    );
    transitionOverlay.setDepth(949);
    transitionOverlay.setScrollFactor(0);

    this.scene.tweens.add({
      targets: transitionOverlay,
      alpha: config.alpha,
      duration: 2000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        overlay.setFillStyle(config.color, config.alpha);
        transitionOverlay.destroy();
      },
    });
  }

  // -- characters ----------------------------------------------------------

  /**
   * Tint and dim the cast for the current phase.
   *
   * `force` bypasses the signature early-out — needed after NPCs are
   * re-created on a schedule change, since a fresh sprite carries no tint even
   * though the lighting state has not moved.
   */
  applyCharacterLighting(force: boolean = false) {
    const phase = this.ctx.timeOfDay();
    const signature = characterLightingSignature(phase);
    if (!force && signature === this.lastSignature) return;
    this.lastSignature = signature;

    const lighting = TIME_CHARACTER_LIGHTING[phase];
    const player = this.ctx.player();
    const npcs = this.characters.npcs();

    if (lighting.tint === null) {
      player?.clearTint();
      npcs.forEach((npc) => npc.clearTint());
    } else {
      player?.setTint(lighting.tint);
      npcs.forEach((npc) => npc.setTint(lighting.tint as number));
    }

    this.lightingAlpha = lighting.alpha;
    this.applyCompositedAlpha();
  }

  /** Stealth is a player-only factor; NPCs never sneak. */
  setStealthAlpha(alpha: number) {
    this.stealthAlpha = alpha;
    this.applyCompositedAlpha();
  }

  getStealthAlpha(): number {
    return this.stealthAlpha;
  }

  /**
   * The single writer for player/NPC alpha. Time-of-day lighting and stealth
   * multiply, so neither clobbers the other.
   */
  applyCompositedAlpha() {
    const player = this.ctx.player();
    if (player) player.setAlpha(compositeAlpha(this.lightingAlpha, this.stealthAlpha));
    this.characters.npcs().forEach((npc) => npc.setAlpha(this.lightingAlpha));
  }

  /** Per-frame: keep every contact shadow under its character. */
  updateCharacterShadows() {
    const config = getShadowConfig(this.ctx.timeOfDay());
    const baseAlpha = config.alpha * this.ctx.visualProfile().shadowAlphaMultiplier;

    const player = this.ctx.player();
    const playerShadow = this.characters.playerShadow();
    if (playerShadow && player) {
      playerShadow.setPosition(player.x + config.offsetX, player.y + config.offsetY);
      playerShadow.setDepth(player.depth - 1);
      playerShadow.setAlpha(baseAlpha);
      playerShadow.setScale(config.length, config.flatten);
      playerShadow.setAngle(config.angle);
    }

    this.characters.npcs().forEach((npc) => {
      const shadow = this.characters.npcShadow(npc);
      if (!shadow) return;
      shadow.setPosition(npc.x + config.offsetX, npc.y + config.offsetY);
      shadow.setDepth(npc.depth - 1);
      shadow.setAlpha(baseAlpha * 0.9);
      shadow.setScale(config.length * 0.95, config.flatten);
      shadow.setAngle(config.angle);
    });
  }

  // -- lifecycle -----------------------------------------------------------

  /** The phase of day changed. */
  setTimeOfDay(animate: boolean) {
    this.applyLightingForTime(animate);
    this.updateLocationLightsForTime();
    this.applyCharacterLighting(true);
  }

  /** The quality tier changed: practicals are drawn at a profile-scaled alpha. */
  applyQuality() {
    this.createLocationLights();
  }

  destroy() {
    this.destroyLights();
    this.overlay = null;
    this.lastSignature = null;
    this.isTransitioningTime = false;
  }
}
