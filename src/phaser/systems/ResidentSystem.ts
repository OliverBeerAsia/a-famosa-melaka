/**
 * ResidentSystem — the tier the world was missing.
 *
 * The game had named NPCs (14, quest-bearing, static) and CrowdSystem
 * transients (spawned on a timer, routed once, destroyed). Nothing in between,
 * and the gap is exactly the reason the plates read as stage sets: a fishwife
 * who has stood at the same stall for thirty years is not through-traffic, and
 * modelling her as a spawn-and-destroy tween is why she keeps vanishing.
 *
 * A resident is created once on location enter, torn down on exit, and never
 * routed away. They have no dialogue tree — only barks, rendered as world-space
 * floating text so they can never be mistaken for a conversation. All fifteen
 * use crowd sheets already registered in BootScene, so the whole tier costs no
 * new art.
 *
 * Data lives in `src/data/residents.json`, keyed by location — NOT in the
 * location file, which the plate compositor regenerates wholesale and which
 * therefore silently drops hand-authored additions. The selection rules are the
 * pure functions in core/barks.
 */

import Phaser from 'phaser';
import { CHARACTER_SCALE } from '../game';
import { worldDepth } from '../core/depth';
import { TEXT_COLOR, TYPE, textStyle } from '../core/typography';
import { getLocationResidents, type LocationResident } from '../core/LocationData';
import {
  BARK_RADIUS_NATIVE,
  newBarkCursor,
  pickBark,
  residentOnStage,
  type BarkCursor,
} from '../core/barks';
import type { SystemContext } from '../core/SystemContext';
import { useQuestStore } from '../../stores/questStore';
import {
  INTERACTION_PRIORITY,
  INTERACTION_RADIUS,
} from '../core/interactionScore';
import type {
  InteractionCandidate,
  InteractionScan,
  InteractionSystem,
} from './InteractionSystem';

/** How long a bark stays legible before it fades. */
const BARK_HOLD_MS = 3200;
/** Seconds a resident spends walking one leg of its little station loop. */
const LOOP_LEG_MS = 5200;
/** Pause at each end of the loop, so it reads as working rather than pacing. */
const LOOP_PAUSE_MS = 2600;

interface ResidentInstance {
  data: LocationResident;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  bark: Phaser.GameObjects.Text | null;
  cursor: BarkCursor;
  /** True while the player is inside the proximity radius (edge-triggered). */
  wasNear: boolean;
}

export interface ResidentDeps {
  /** Current hour, for the on-stage window. */
  currentHour(): number;
  /** Current in-game day, for the per-day bark reshuffle. */
  currentDay(): number;
}

export class ResidentSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: ResidentDeps;

  private residents: ResidentInstance[] = [];

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: ResidentDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  // -- reads ---------------------------------------------------------------

  count(): number { return this.residents.length; }

  /** Residents inside the camera's view — the benchmark counts per screen. */
  onScreenCount(camera: Phaser.Cameras.Scene2D.Camera | undefined): number {
    // Guarded: the acceptance harness reads counts across a scene restart, and
    // for a frame or two during teardown there is no main camera to ask.
    const view = camera?.worldView;
    if (!view) return 0;
    return this.residents.reduce((n, r) => (view.contains(r.sprite.x, r.sprite.y) ? n + 1 : n), 0);
  }

  list(): Array<{ id: string; x: number; y: number }> {
    return this.residents.map((r) => ({ id: r.data.id, x: r.sprite.x, y: r.sprite.y }));
  }

  // -- creation ------------------------------------------------------------

  create() {
    this.destroyAll();
    const hour = this.deps.currentHour();

    getLocationResidents(this.ctx.locationId()).forEach((data) => {
      if (!residentOnStage(data.hours, hour)) return;
      this.spawn(data);
    });
  }

  /**
   * Re-evaluate the roster on an hour change.
   *
   * Residents already on stage are LEFT ALONE — the whole point of the tier is
   * that they persist, and destroying and rebuilding one every hour would
   * reproduce exactly the pop the schedule pass is removing. Only arrivals and
   * departures touch the display list.
   */
  refresh() {
    const hour = this.deps.currentHour();
    const definitions = getLocationResidents(this.ctx.locationId());

    // Departures.
    for (let i = this.residents.length - 1; i >= 0; i--) {
      const resident = this.residents[i];
      if (residentOnStage(resident.data.hours, hour)) continue;
      this.despawn(resident);
      this.residents.splice(i, 1);
    }

    // Arrivals.
    const present = new Set(this.residents.map((r) => r.data.id));
    definitions.forEach((data) => {
      if (present.has(data.id)) return;
      if (!residentOnStage(data.hours, hour)) return;
      this.spawn(data);
    });
  }

  private spawn(data: LocationResident) {
    const textureKey = this.scene.textures.exists(data.sprite) ? data.sprite : 'crowd-portuguese';
    if (textureKey !== data.sprite) {
      console.warn(
        `[ResidentSystem] resident '${data.id}' wants sprite '${data.sprite}', which is not `
        + 'a loaded crowd texture — falling back to crowd-portuguese.'
      );
    }

    const { x, y } = data.station;
    const sprite = this.scene.add.image(x, y, textureKey);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(CHARACTER_SCALE);
    sprite.setDepth(worldDepth(y));

    const shadow = this.scene.add.ellipse(x, y - 2, 38, 12, 0x000000, 0.22);
    shadow.setDepth(worldDepth(y) - 1);

    const instance: ResidentInstance = {
      data,
      sprite,
      shadow,
      bark: null,
      cursor: newBarkCursor(),
      wasNear: false,
    };

    this.startIdle(instance);
    this.startLoop(instance);
    this.residents.push(instance);
  }

  /**
   * Tier-0 business idle: a 2-frame ±1 px vertical bob.
   *
   * The full vocabulary is 20 overlay strips (spec §2.3) and it is a Stage 6
   * cost. At our sprite scale a static figure with a slow bob reads as "doing
   * something" from three metres, which is the only distance that matters — so
   * the idle KEY is carried in the data now and the art can land later without
   * the schedules moving.
   */
  private startIdle(resident: ResidentInstance) {
    // Vary the phase so three residents on one plate do not breathe in unison.
    const delay = (resident.data.id.charCodeAt(0) * 37) % 600;
    this.scene.tweens.add({
      targets: resident.sprite,
      y: resident.sprite.y - 1,
      duration: 340,
      delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.syncShadow(resident),
    });
  }

  /**
   * The small station loop.
   *
   * A resident is not routed away, but standing perfectly still for an hour is
   * its own kind of dead. The authored `route` is a there-and-back of 40-60 px
   * around the station, walked slowly with a pause at each end — the fishwife
   * stepping to the brazier and back, not a patrol.
   */
  private startLoop(resident: ResidentInstance) {
    const route = resident.data.route;
    if (!route || route.length < 2) return;

    const legs = route.slice(1).map((point) => ({
      x: point.x,
      y: point.y,
      duration: LOOP_LEG_MS,
      hold: LOOP_PAUSE_MS,
    }));

    this.scene.tweens.chain({
      targets: resident.sprite,
      loop: -1,
      tweens: legs.map((leg) => ({
        x: leg.x,
        y: leg.y,
        duration: leg.duration,
        hold: leg.hold,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          resident.sprite.setDepth(worldDepth(resident.sprite.y));
          this.syncShadow(resident);
        },
      })),
    });
  }

  private syncShadow(resident: ResidentInstance) {
    resident.shadow.setPosition(resident.sprite.x, resident.sprite.y - 2);
    resident.shadow.setDepth(worldDepth(resident.sprite.y) - 1);
    if (resident.bark) {
      resident.bark.setPosition(resident.sprite.x, resident.sprite.y - 78);
    }
  }

  // -- barks ---------------------------------------------------------------

  /**
   * Say a line, if there is one to say and the cooldown allows it.
   * `force` is the "or on interact" branch of the trigger.
   */
  speak(resident: ResidentInstance, force = false) {
    const flags = useQuestStore.getState().worldFlags;
    const pick = pickBark(
      resident.data.id,
      resident.data,
      flags,
      this.ctx.timeOfDay() === 'night',
      this.deps.currentDay(),
      this.scene.time.now,
      resident.cursor,
      force,
    );
    if (!pick) return;
    resident.cursor = pick.cursor;
    this.showBark(resident, pick.text);
  }

  /**
   * World-space floating text, never the dialogue box.
   *
   * A resident who opens the dialogue panel has been promoted to a character
   * the player will then try to ask about the quest, and the whole tier stops
   * working. The line hangs over their head and fades.
   */
  private showBark(resident: ResidentInstance, text: string) {
    if (resident.bark) resident.bark.destroy();

    const bark = this.scene.add.text(
      resident.sprite.x,
      resident.sprite.y - 78,
      text,
      textStyle(TYPE.body, {
        color: TEXT_COLOR.parch,
        align: 'center',
        backgroundColor: 'rgba(26, 14, 7, 0.72)',
        padding: { x: 6, y: 3 },
      })
    );
    // Barks run to a sentence and a half; wrap them rather than letting one
    // run off both edges of a 960px viewport.
    bark.setWordWrapWidth(360, true);
    bark.setOrigin(0.5, 1);
    bark.setDepth(worldDepth(resident.sprite.y) + 4);
    bark.setAlpha(0);
    resident.bark = bark;

    this.scene.tweens.add({
      targets: bark,
      alpha: 1,
      duration: 180,
      onComplete: () => {
        this.scene.time.delayedCall(BARK_HOLD_MS, () => {
          if (!bark.active) return;
          this.scene.tweens.add({
            targets: bark,
            alpha: 0,
            duration: 320,
            onComplete: () => {
              if (resident.bark === bark) resident.bark = null;
              bark.destroy();
            },
          });
        });
      },
    });
  }

  // -- interaction ---------------------------------------------------------

  /**
   * Residents are offered at SCENERY priority and reach, deliberately.
   *
   * They must never outrank a named NPC, a pickup or an exit — the player who
   * presses Space next to Aminah and the water carrier is talking to Aminah.
   */
  registerInteractions(interaction: InteractionSystem) {
    interaction.registerProvider((scan: InteractionScan) => {
      const out: InteractionCandidate[] = [];
      for (const resident of this.residents) {
        const scored = scan.score(resident.sprite.x, resident.sprite.y, INTERACTION_RADIUS.scenery);
        if (!scored) continue;
        out.push({
          type: 'scenery',
          id: `resident:${resident.data.id}`,
          label: `Pass the time with the ${resident.data.role.toLowerCase()}`,
          x: resident.sprite.x,
          y: resident.sprite.y,
          priority: INTERACTION_PRIORITY.scenery,
          score: scored.score,
          interact: () => this.speak(resident, true),
        });
      }
      return out;
    });
  }

  // -- per frame -----------------------------------------------------------

  /**
   * Depth-sort and fire proximity barks.
   *
   * Edge-triggered on ENTERING the radius rather than level-triggered: a player
   * who stands next to the cooper does not get a line every thirty seconds
   * forever, they get one when they arrive.
   */
  update() {
    const player = this.ctx.player();
    if (!player) return;
    const radius = BARK_RADIUS_NATIVE * (this.ctx.location()?.world.scale ?? 3);
    const uiOpen = this.ctx.isUIOpen();

    for (const resident of this.residents) {
      resident.sprite.setDepth(worldDepth(resident.sprite.y));
      resident.shadow.setDepth(worldDepth(resident.sprite.y) - 1);

      const near = Phaser.Math.Distance.Between(
        player.x, player.y, resident.sprite.x, resident.sprite.y,
      ) <= radius;

      if (near && !resident.wasNear && !uiOpen) this.speak(resident);
      resident.wasNear = near;
    }
  }

  // -- teardown ------------------------------------------------------------

  private despawn(resident: ResidentInstance) {
    this.scene.tweens.killTweensOf(resident.sprite);
    this.scene.tweens.killTweensOf(resident.shadow);
    resident.bark?.destroy();
    resident.sprite.destroy();
    resident.shadow.destroy();
  }

  private destroyAll() {
    this.residents.forEach((resident) => this.despawn(resident));
    this.residents = [];
  }

  destroy() {
    this.destroyAll();
  }
}
