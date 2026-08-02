/**
 * TransitionSystem — the exits, and the act of taking one.
 *
 * Each transition is a trigger rectangle plus a marker, a glow and a hover
 * label. Locked exits can still show (`showWhenLocked`) so the player learns
 * the map's shape before they can walk it, and refuse with the location's own
 * `blockedMessage`.
 *
 * Taking an exit is a three-beat sequence, and the ordering is load-bearing:
 * a location-tinted flash, then a fade to black, then `scene.restart()` on the
 * fade-out callback. The restart is what rebuilds the world — which is why the
 * scene's cleanup has to be exception-free (see BackdropSystem.destroy): a
 * throw in teardown leaves the scene half-shut-down and the restart never
 * completes.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';
import { getLocation } from '../core/LocationData';
import { getLocationName } from '../../data/locationNames';
import { meetsConditionalRequirements } from '../core/requirements';
import { showLocationCard } from '../core/notify';
import { TEXT_COLOR, TYPE, textStyle } from '../core/typography';
import { emitGameEvent } from '../eventBridge';
import type { SystemContext } from '../core/SystemContext';
import {
  INTERACTION_PRIORITY,
  INTERACTION_RADIUS,
  rectContains,
} from '../core/interactionScore';
import type {
  InteractionCandidate,
  InteractionScan,
  InteractionSystem,
} from './InteractionSystem';
import type { ConditionalRequirements } from '../../stores/questStore';

export interface TransitionConfig {
  targetLocation: string;
  label: string;
  triggerArea: { x: number; y: number; width: number; height: number };
  spawnAt?: { x: number; y: number };
  requirements?: ConditionalRequirements;
  showWhenLocked?: boolean;
  lockedLabel?: string;
  blockedMessage?: string;
}

interface TransitionHotspot {
  config: TransitionConfig;
  glow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

export interface TransitionDeps {
  /** Toast for a refused exit. */
  notify(text: string): void;
  /** Fired just before the scene restarts, so audio can play the arrival sting. */
  onDeparting(targetLocation: string): void;
}

export class TransitionSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: TransitionDeps;

  private hotspots: TransitionHotspot[] = [];

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: TransitionDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  /** For the DEV acceptance hook. */
  listExits() {
    return this.hotspots.map((h) => ({
      target: h.config.targetLocation,
      label: h.config.label,
      trigger: h.config.triggerArea,
      spawnAt: h.config.spawnAt,
    }));
  }

  isAvailable(config: TransitionConfig): boolean {
    return meetsConditionalRequirements(config.requirements, this.ctx.locationId());
  }

  // -- creation ------------------------------------------------------------

  create() {
    this.destroyHotspots();

    const transitions = (this.ctx.location()?.transitions ?? []) as TransitionConfig[];
    transitions.forEach((transition) => {
      const x = transition.triggerArea.x + (transition.triggerArea.width / 2);
      const y = transition.triggerArea.y + (transition.triggerArea.height / 2);
      const available = this.isAvailable(transition);
      const visible = available || Boolean(transition.showWhenLocked);

      const glow = this.scene.add.ellipse(x, y, 54, 22, 0xF4B41A, 0.12);
      glow.setDepth(978);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setVisible(visible);

      const marker = this.scene.add.arc(x, y, 10, 200, 340, false, 0xF4B41A, 0.85);
      marker.setStrokeStyle(2, 0x3b2509, 1);
      marker.setDepth(979);
      marker.setVisible(visible);

      const label = this.scene.add.text(
        x, y - 24,
        available ? transition.label : (transition.lockedLabel || transition.label),
        textStyle(TYPE.body, { color: TEXT_COLOR.parch })
      );
      label.setOrigin(0.5, 1);
      label.setDepth(980);
      label.setVisible(false);

      this.hotspots.push({ config: transition, glow, marker, label });
    });
  }

  /** The big name card shown on arrival. */
  showLocationName() {
    showLocationCard(this.scene, getLocationName(this.ctx.locationId()));
  }

  // -- interaction ---------------------------------------------------------

  registerInteractions(interaction: InteractionSystem) {
    // Standing INSIDE the trigger rect promotes the exit to the top of the
    // field — that is what makes walking into a doorway just work.
    interaction.registerProvider((scan: InteractionScan) => {
      const out: InteractionCandidate[] = [];
      for (const hotspot of this.hotspots) {
        const available = this.isAvailable(hotspot.config);
        if (!available && !hotspot.config.showWhenLocked) continue;

        const area = hotspot.config.triggerArea;
        const x = area.x + (area.width / 2);
        const y = area.y + (area.height / 2);
        const withinArea = rectContains(area, scan.playerX, scan.playerY);
        const scored = withinArea
          ? { distance: 0, score: -100 }
          : scan.score(x, y, INTERACTION_RADIUS.transition);
        if (!scored) continue;

        out.push({
          type: 'transition',
          id: hotspot.config.targetLocation,
          label: available
            ? `Travel to ${getLocationName(hotspot.config.targetLocation)}`
            : (hotspot.config.lockedLabel || hotspot.config.label),
          x,
          y,
          priority: withinArea
            ? (available ? 0 : 2)
            : (available ? INTERACTION_PRIORITY.transition : 4),
          score: scored.score,
          interact: () => {
            if (!available) {
              this.deps.notify(
                hotspot.config.blockedMessage || 'That route is not safe or open to you yet.'
              );
              return;
            }
            this.switchLocation(hotspot.config.targetLocation, hotspot.config.spawnAt);
          },
        });
      }
      return out;
    });
  }

  // -- travel --------------------------------------------------------------

  switchLocation(mapKey: string, spawnPoint?: { x: number; y: number }) {
    if (mapKey === this.ctx.locationId()) return;

    console.log('Switching to:', mapKey);

    // Location-specific colour tint flash before fade-to-black
    const tint = getLocation(mapKey)?.visual.transitionTint ?? [0, 0, 0];
    const tintOverlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      Phaser.Display.Color.GetColor(tint[0], tint[1], tint[2]), 0
    );
    tintOverlay.setDepth(9998);
    tintOverlay.setScrollFactor(0);

    // Flash tint in, then fade to black
    this.scene.tweens.add({
      targets: tintOverlay,
      alpha: 0.3,
      duration: 100,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.scene.cameras.main.fadeOut(300, 0, 0, 0);
      },
    });

    // Subtle camera zoom during transition
    this.scene.cameras.main.zoomTo(1.05, 200);

    this.scene.cameras.main.once('camerafadeoutcomplete', () => {
      tintOverlay.destroy();

      this.deps.onDeparting(mapKey);
      emitGameEvent('scene:change', mapKey);

      // Restart the scene with the new map
      this.scene.scene.restart({ mapKey, spawnPoint });
    });
  }

  // -- per frame -----------------------------------------------------------

  update(targetedTransitionId: string | null) {
    this.hotspots.forEach((hotspot) => {
      const available = this.isAvailable(hotspot.config);
      const visible = available || Boolean(hotspot.config.showWhenLocked);
      const nearby = hotspot.config.targetLocation === targetedTransitionId;

      hotspot.glow.setVisible(visible);
      hotspot.marker.setVisible(visible);
      hotspot.label.setVisible(visible && nearby);
      hotspot.label.setText(
        available ? hotspot.config.label : (hotspot.config.lockedLabel || hotspot.config.label)
      );

      if (!visible) return;

      hotspot.glow.setAlpha(available ? (nearby ? 0.2 : 0.08) : (nearby ? 0.15 : 0.05));
      hotspot.glow.setScale(nearby ? 1.1 + Math.sin(this.scene.time.now / 260) * 0.06 : 1);
      hotspot.marker.setScale(nearby ? 1 + Math.sin(this.scene.time.now / 210) * 0.15 : 1);
      hotspot.marker.setAlpha(available ? 0.9 : 0.55);
    });
  }

  private destroyHotspots() {
    this.hotspots.forEach((hotspot) => {
      hotspot.glow.destroy();
      hotspot.marker.destroy();
      hotspot.label.destroy();
    });
    this.hotspots = [];
  }

  destroy() {
    this.destroyHotspots();
  }
}
