/**
 * NightWatchSystem — the counting-house break-in.
 *
 * The `merchants-seal` theft path used to be a pure state machine: two
 * objectives resolved by two hotspots. This turns it into a scene on the
 * shipped waterfront plate — one watchman, an 18-waypoint loop, a lantern that
 * arrives around the corner before he does, and four lamp posts the player can
 * put out at a price.
 *
 * Three things carry the whole design:
 *
 *  - **The goal is in the light and the road to it is dark.** The counting
 *    house sits at the lit east end; the approach is the shadowed south quay.
 *    Detection scales with what the PLAYER is standing in (core/detection), so
 *    the light map the plate already ships IS the stealth level.
 *  - **The window is 27.8 seconds** — long enough to cross the last dark
 *    stretch, work the lock and slip in, with slack for a player who mistimes
 *    it once. A SUSPICIOUS guard is off his timetable and the window is void
 *    until he settles, so the player has to re-read him, not re-count.
 *  - **Caught is not game over.** A fine, a receipt, a reputation scratch and a
 *    night. Losing makes the honest path longer, never impossible.
 *
 * Data — patrol, senses, dousable lamps, consequences — is
 * `src/data/night-watch.json`, authored in native px like everything else.
 */

import Phaser from 'phaser';
import { CHARACTER_SCALE } from '../game';
import { worldDepth } from '../core/depth';
import { findPath, type Point } from '../core/pathfind';
import { resolveMove } from '../core/WalkMask';
import nightWatchData from '../../data/night-watch.json';
import {
  canSee,
  facingToDegrees,
  noiseRadiusNative,
  stepAwareness,
  type PlayerCover,
  type WatchState,
} from '../core/detection';
import type { SystemContext } from '../core/SystemContext';
import { useQuestStore } from '../../stores/questStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import {
  INTERACTION_PRIORITY,
  INTERACTION_RADIUS,
} from '../core/interactionScore';
import type {
  InteractionCandidate,
  InteractionScan,
  InteractionSystem,
} from './InteractionSystem';

interface Waypoint {
  id: string;
  x: number;
  y: number;
  dwell: number;
  face?: string;
  lit?: string | boolean;
}

interface DousableLight {
  lightIndex: number;
  light: { x: number; y: number };
  prop: string;
  propXY: { x: number; y: number };
  approach: { x: number; y: number };
}

const DATA = nightWatchData as unknown as {
  locationId: string;
  anchors: Record<string, any>;
  nightWatch: {
    activeHours: [number, number];
    sprite: string;
    lanternLight: { radius: number };
    speed: number;
    patrol: Waypoint[];
    senses: {
      visionRangeNative: number;
      visionArcDegrees: number;
      peripheralRangeNative: number;
    };
  };
  dousableLights: DousableLight[];
  consequenceChain: any;
};

/** Standing still this long earns the freeze bonus. */
const FREEZE_MS = 1000;
/** How long a doused lamp takes the guard to relight, ms. */
const RELIGHT_MS = 10000;
/** Alert level at which he abandons the loop and posts at the door. */
const POST_UP_ALERT_LEVEL = 3;
/** Closing speed once alerted, world px/s. */
const CHASE_SPEED = 140;
/** He has you at this range while chasing, world px. */
const GRAB_DISTANCE = 34;
/** Suspicious sweep: how long he stares at the last-known point, ms. */
const SWEEP_MS = 3000;
/** Seconds of quiet before a suspicious guard settles back to unaware. */
const CALM_TO_UNAWARE = 12;
/**
 * Half the guard's body for PATHING, world px — one native pixel each side.
 *
 * Deliberately narrower than the player's 18px stance, and the reason is the
 * patrol line rather than the man. The eighteen waypoints are authored to make
 * a *readable* circuit — down the dark south quay, along the lit upper one —
 * and A* exists here only to get him round the geometry that circuit clips, not
 * to plan a route of its own. Widening the search body makes it detour further
 * from the authored line at every prop: measured at 3 native px the loop ran
 * 68s against a 40-50s acceptance band, and the shape stopped reading as the
 * line the designer drew. At one native px he follows it, and the per-axis
 * `resolveMove` below still keeps him off actual wall pixels.
 *
 * Separately, six waypoints (W3, W6, W8, W13, W16 and above all W18, a
 * two-pixel sliver against the customs shed) were walkable as POINTS but not as
 * a body at all, which made his own route unreachable and deadlocked him at W18
 * having walked seventeen-eighteenths of a perfect loop. Those have been nudged
 * 1-2px and `validate-location-data.cjs` now asserts a 3-native-px body test —
 * a deliberate margin over what pathing needs — so a plate rebuild cannot
 * quietly reintroduce it.
 */
const GUARD_HALF_WIDTH = 3;
/**
 * Sprite origin to feet, world px — the SAME convention as every other
 * character and as the patrol data itself.
 *
 * This was the bug that made the watchman grind to a halt on the W1->W2 leg:
 * the sprite was bottom-anchored (its y WAS its feet) while all eighteen
 * waypoints are authored as ORIGIN points whose feet are at y+15 native, and
 * which the validator checks at exactly that offset. Pathing at the origin row
 * put the whole corridor between the counting-house door and the customs shed
 * inside the shed's mask block — every pixel of it — so A* had nowhere to go
 * and he stood in the dark shuffling for the rest of the night.
 */
const GUARD_FOOT_OFFSET = 45;
/**
 * No progress for this long means the route is lying about the ground.
 *
 * 900ms, not 2s: the recovery itself is invisible (he skips a leg point or
 * steps onto the waypoint) but the WAIT is not — a watchman standing still for
 * two seconds in the middle of an empty quay reads as a scripted post, and the
 * player re-plans the whole approach around a pause that was a glitch.
 */
const STUCK_RECOMPUTE_MS = 900;
/**
 * Player sprite origin to feet, world px.
 *
 * The player is centre-anchored at 3x on a 16x32 sheet, so its contact point is
 * ~45px below the origin — the same offset PlayerSystem samples the mask at.
 */
const PLAYER_FOOT_OFFSET = 45;

export interface NightWatchDeps {
  notify(text: string): void;
  playSfx?(key: string, volumeScale?: number): void;
  /** Take the player somewhere, with a spawn point (the caught chain). */
  travelTo(locationId: string, spawnAt?: { x: number; y: number }): void;
  /** Move the world clock (the caught chain wakes the player at 06:00). */
  advanceHours(hours: number): void;
  /** Current hour, for the active window. */
  currentHour(): number;
  /** Freeze/unfreeze player input during the caught cutaway. */
  setCutscene(active: boolean): void;
  /**
   * A lamp went out or came back on. The lighting rig owns the practicals, so
   * it is told rather than reaching in here — and this stays a local callback
   * rather than a new bridge event while the juice pass owns that file.
   */
  onLightsChanged?(dousedIndices: number[]): void;
}

export class NightWatchSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: NightWatchDeps;

  private sprite: Phaser.Physics.Arcade.Sprite | null = null;
  private shadow: Phaser.GameObjects.Ellipse | null = null;
  private lantern: Phaser.GameObjects.Ellipse | null = null;

  private waypointIndex = 0;
  /** The waypoint he is currently standing at and dwelling on, if any. */
  private dwellAt: Waypoint | null = null;
  /**
   * The routed path to the current waypoint.
   *
   * Waypoints are verified walkable but the STRAIGHT LINE between two of them
   * is not — W1 at the counting-house door and W2 on the south face of the
   * customs shed have the shed's mask block between them, and a guard who walks
   * the chord instead of the route simply grinds against it forever. A* over
   * the same mask the player collides with is the fix, and the patrol data is
   * unchanged: the waypoints are still exactly where the design put them.
   */
  private legPath: Point[] = [];
  private legIndex = 0;
  /** Scene time of the last real progress, for stuck recovery. */
  private lastProgressAt = 0;
  private lastX = 0;
  private lastY = 0;
  private dwellUntil = 0;
  private facingDeg = 90;
  private state: WatchState = 'unaware';
  private exposure = 0;
  private calm = 0;
  private lastKnown: { x: number; y: number } | null = null;
  private sweepUntil = 0;
  private alertLevel = 1;

  private playerStillSince = 0;
  private lastPlayerX = 0;
  private lastPlayerY = 0;
  private pendingNoise = 0;
  private caught = false;

  /** Doused lamp light indices, and when each relights. */
  private doused = new Map<number, number>();
  private relightingIndex: number | null = null;

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: NightWatchDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  // -- reads ---------------------------------------------------------------

  /** Is the watchman on the quay right now? */
  isOnDuty(): boolean {
    if (this.ctx.locationId() !== DATA.locationId) return false;
    const [from, to] = DATA.nightWatch.activeHours;
    const hour = this.deps.currentHour();
    return from < to ? hour >= from && hour < to : hour >= from || hour < to;
  }

  getState(): WatchState { return this.state; }
  getAlertLevel(): number { return this.alertLevel; }
  /** Light indices currently out, for the lighting rig to skip. */
  dousedLights(): number[] { return [...this.doused.keys()]; }
  position(): { x: number; y: number } | null {
    return this.sprite ? { x: this.sprite.x, y: this.sprite.y } : null;
  }

  // -- lifecycle -----------------------------------------------------------

  create() {
    this.destroySprite();
    this.doused.clear();
    if (!this.isOnDuty()) return;
    this.spawn();
  }

  /** Called on the hour: he comes on at 22:00 and goes off at 04:00. */
  onHourChanged() {
    if (this.isOnDuty()) {
      if (!this.sprite) this.spawn();
      return;
    }
    // Off duty: the night's alert level and doused lamps reset with the watch.
    this.destroySprite();
    this.doused.clear();
    this.alertLevel = 1;
    this.state = 'unaware';
  }

  /**
   * He appears at W1 — the counting-house door — and begins the loop.
   *
   * Telegraph T5: the first thing the player ever sees the watch do is stand
   * exactly where the player wants to be.
   */
  private spawn() {
    const start = this.toWorld(DATA.nightWatch.patrol[0]);
    const key = this.scene.textures.exists(DATA.nightWatch.sprite)
      ? DATA.nightWatch.sprite
      : 'crowd-portuguese-guard';

    const sprite = this.scene.physics.add.sprite(start.x, start.y, key);
    sprite.setScale(CHARACTER_SCALE);
    sprite.setImmovable(true);
    sprite.setDepth(worldDepth(start.y + GUARD_FOOT_OFFSET));
    this.sprite = sprite;

    this.shadow = this.scene.add.ellipse(start.x, start.y + GUARD_FOOT_OFFSET, 40, 13, 0x000000, 0.24);
    this.shadow.setDepth(worldDepth(start.y + GUARD_FOOT_OFFSET) - 1);

    // The lantern he carries IS the cone: the player never has to guess where
    // he is looking, and the pool arrives around a corner before he does.
    const radius = DATA.nightWatch.lanternLight.radius * this.scale();
    this.lantern = this.scene.add.ellipse(start.x, start.y, radius * 2, radius * 1.2, 0xFFC98A, 0.16);
    this.lantern.setBlendMode(Phaser.BlendModes.ADD);
    this.lantern.setDepth(worldDepth(start.y) - 2);

    // He STARTS at W1, the counting-house door, dwelling there — telegraph T5.
    this.waypointIndex = 0;
    this.legPath = [];
    this.legIndex = 0;
    this.dwellAt = DATA.nightWatch.patrol[0];
    this.dwellUntil = this.scene.time.now + DATA.nightWatch.patrol[0].dwell * 1000;
    this.state = 'unaware';
    this.exposure = 0;
    this.calm = 0;
    this.caught = false;
  }

  private scale(): number { return this.ctx.location()?.world.scale ?? 3; }
  private toWorld(p: { x: number; y: number }) {
    const s = this.scale();
    return { x: p.x * s, y: p.y * s };
  }

  // -- dousing -------------------------------------------------------------

  /**
   * The lamp posts ARE the practicals.
   *
   * Verified on the shipped data: for all four `lantern-post` props on the
   * waterfront, `light.y == prop.y - 42` and `light.x == prop.x` exactly. So
   * dousing needs nothing painted to be legible — the post the player is
   * standing at is visibly the thing that goes dark.
   */
  registerInteractions(interaction: InteractionSystem) {
    interaction.registerProvider((scan: InteractionScan) => {
      if (!this.isOnDuty()) return [];
      const out: InteractionCandidate[] = [];
      for (const lamp of DATA.dousableLights) {
        if (this.doused.has(lamp.lightIndex)) continue;
        const approach = this.toWorld(lamp.approach);
        const scored = scan.score(approach.x, approach.y, INTERACTION_RADIUS.item);
        if (!scored) continue;
        out.push({
          type: 'quest',
          id: `douse:${lamp.prop}`,
          label: 'Douse the lantern',
          x: approach.x,
          y: approach.y,
          priority: INTERACTION_PRIORITY.quest,
          score: scored.score,
          interact: () => this.douse(lamp),
        });
      }
      return out;
    });
  }

  /**
   * Put a lamp out. Not free: on his next pass he sees the dead lamp, goes
   * suspicious THERE, relights it over ten seconds, and the night's alert level
   * rises. At level 3 he stops patrolling and posts at the door for the rest of
   * the night — which ends the attempt without ever catching the player, and is
   * the cleanest possible failure: nothing happened to you, and you still lost.
   */
  private douse(lamp: DousableLight) {
    this.doused.set(lamp.lightIndex, 0);
    this.deps.playSfx?.('sfx-door-open', 0.4);
    this.deps.notify('The wick gutters and the pool of light goes out.');
    this.deps.onLightsChanged?.(this.dousedLights());
  }

  // -- per frame -----------------------------------------------------------

  update(_time: number, delta: number) {
    if (!this.sprite || this.caught) return;
    const player = this.ctx.player();
    if (!player) return;
    const dt = delta / 1000;

    this.trackPlayerStillness(player);
    const sight = this.look(player);
    const noise = this.hear(player);

    const awareness = stepAwareness({
      state: this.state,
      exposure: this.exposure,
      seen: sight.seen,
      dt,
      noise,
      distance: sight.distance,
      scale: this.scale(),
      calm: this.calm,
    });
    if (awareness.escalated) this.onEscalate(awareness.state, player);
    this.state = awareness.state;
    this.exposure = awareness.exposure;
    this.calm = awareness.calm;

    if (sight.seen || noise) this.lastKnown = { x: player.x, y: player.y };

    switch (this.state) {
      case 'alerted':
        this.legPath = [];
        this.chase(player, dt);
        break;
      case 'suspicious':
        this.legPath = [];
        this.investigate(dt);
        break;
      default:
        this.patrol(dt);
        break;
    }

    this.syncFurniture();
  }

  /** Freezing behind the bale stack works — but only if you actually froze. */
  private trackPlayerStillness(player: Phaser.Physics.Arcade.Sprite) {
    const moved = Phaser.Math.Distance.Between(
      player.x, player.y, this.lastPlayerX, this.lastPlayerY,
    ) > 1;
    if (moved) {
      this.playerStillSince = this.scene.time.now;
      this.lastPlayerX = player.x;
      this.lastPlayerY = player.y;
    }
  }

  private cover(player: Phaser.Physics.Arcade.Sprite): PlayerCover {
    const scale = this.scale();
    // The PLAYER is centre-anchored, so its feet are below its origin; the
    // guard is bottom-anchored and its y IS its feet. Getting these two the
    // same way round is the difference between a patrol and a man vibrating
    // against the quay edge.
    const feetY = player.y + PLAYER_FOOT_OFFSET;
    const location = this.ctx.location();

    // Any nightOnly pool the player's feet are inside, skipping doused ones.
    const inLightPool = (location?.lights ?? []).some((light, index) => {
      if (!(light as any).nightOnly) return false;
      if (this.doused.has(index + 1)) return false;
      const radius = ((light as any).radius ?? 40) * scale;
      return Phaser.Math.Distance.Between(light.x, light.y, player.x, feetY) <= radius;
    });

    const lanternRadius = DATA.nightWatch.lanternLight.radius * scale
      * (this.state === 'suspicious' ? 1.4 : 1);
    const inGuardLantern = this.sprite
      ? Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y) <= lanternRadius
      : false;

    // The two shipped foreground overlays become hard cover, which is free:
    // they already have geometry and depth.
    const occluded = (location?.overlays ?? []).some((overlay) => (
      player.x >= overlay.x && player.x <= overlay.x + overlay.width
      && feetY >= overlay.y && feetY <= overlay.y + overlay.height
    ));

    return {
      inLightPool,
      inGuardLantern,
      occluded,
      stationary: this.scene.time.now - this.playerStillSince >= FREEZE_MS,
    };
  }

  private look(player: Phaser.Physics.Arcade.Sprite) {
    return canSee({
      guardX: this.sprite!.x,
      guardY: this.sprite!.y,
      guardFacingDeg: this.facingDeg,
      playerX: player.x,
      playerY: player.y,
      cover: this.cover(player),
      scale: this.scale(),
      alertLevel: this.alertLevel,
      tuning: {
        visionRangeNative: DATA.nightWatch.senses.visionRangeNative,
        visionArcDegrees: DATA.nightWatch.senses.visionArcDegrees,
        peripheralRangeNative: DATA.nightWatch.senses.peripheralRangeNative,
      },
    });
  }

  /**
   * Noise: the wooden pier carries, stone and dirt do not, running carries
   * further than either. One-shot events (a container, a failed lock) are
   * pushed in by whoever caused them.
   */
  private hear(player: Phaser.Physics.Arcade.Sprite): boolean {
    const scale = this.scale();
    const body = player.body as Phaser.Physics.Arcade.Body | null;
    const speed = body?.speed ?? 0;
    const mask = this.ctx.walkMask();
    const onWood = mask ? mask.surfaceAt(player.x, player.y + PLAYER_FOOT_OFFSET) === 'wood' : false;

    let radius = noiseRadiusNative({ running: speed > 220, onWood, moving: speed > 4 });
    if (this.pendingNoise > radius) radius = this.pendingNoise;
    this.pendingNoise = 0;
    if (radius <= 0) return false;

    return Phaser.Math.Distance.Between(
      this.sprite!.x, this.sprite!.y, player.x, player.y,
    ) <= radius * scale;
  }

  /** A one-shot noise event from elsewhere (opening a container, a lock). */
  makeNoise(radiusNative: number) {
    this.pendingNoise = Math.max(this.pendingNoise, radiusNative);
  }

  private onEscalate(next: WatchState, player: Phaser.Physics.Arcade.Sprite) {
    if (next === 'suspicious') {
      this.lastKnown = { x: player.x, y: player.y };
      this.sweepUntil = this.scene.time.now + SWEEP_MS;
      this.deps.playSfx?.('sfx-menu-select', 0.4);
    } else if (next === 'alerted') {
      this.deps.playSfx?.('sfx-gate-creak', 0.9);
      this.deps.notify('"You there — stand where you are!"');
    }
  }

  // -- behaviours ----------------------------------------------------------

  private patrol(dt: number) {
    const sprite = this.sprite!;
    // Alert level 3: he stops patrolling and posts at the door for the night.
    const patrol = DATA.nightWatch.patrol;
    if (this.alertLevel >= POST_UP_ALERT_LEVEL) {
      this.waypointIndex = 0;
      const post = this.toWorld(patrol[0]);
      this.stepToward(post.x, post.y, dt);
      this.facingDeg = facingToDegrees('down');
      return;
    }

    if (this.scene.time.now < this.dwellUntil) {
      // Face the way the waypoint he is STANDING at says — at W17 that is down
      // at the counting-house door, 51px away and inside detection range.
      if (this.dwellAt?.face) this.facingDeg = facingToDegrees(this.dwellAt.face);
      return;
    }
    this.dwellAt = null;

    const wp = patrol[this.waypointIndex];
    if (!this.followLeg(this.toWorld(wp), dt)) return;

    // He arrived. If this waypoint's lamp is out, that is a thing he notices.
    this.noticeDousedLamp(wp);

    // The dwell belongs to the waypoint he has just REACHED, not to the next
    // one: the six seconds are spent standing at the counting-house door, the
    // five with his hands over the brazier, and the four looking down at the
    // door from under the east lantern.
    this.dwellAt = wp;
    this.dwellUntil = this.scene.time.now + (wp.dwell || 0) * 1000;
    this.waypointIndex = (this.waypointIndex + 1) % patrol.length;
    this.legPath = [];
    this.legIndex = 0;
  }

  /** He sees the dead lamp, goes suspicious there, and relights it. */
  private noticeDousedLamp(wp: Waypoint) {
    if (this.doused.size === 0) return;
    const scale = this.scale();
    for (const index of this.doused.keys()) {
      const lamp = DATA.dousableLights.find((l) => l.lightIndex === index);
      if (!lamp) continue;
      const post = this.toWorld(lamp.propXY);
      const here = this.toWorld(wp);
      if (Phaser.Math.Distance.Between(post.x, post.y, here.x, here.y) > 60 * scale) continue;

      this.doused.delete(index);
      this.relightingIndex = index;
      this.alertLevel = Math.min(POST_UP_ALERT_LEVEL, this.alertLevel + 1);
      this.dwellUntil = this.scene.time.now + RELIGHT_MS;
      this.state = 'suspicious';
      this.calm = 0;
      this.deps.onLightsChanged?.(this.dousedLights());
      this.deps.notify(
        this.alertLevel >= POST_UP_ALERT_LEVEL
          ? 'He relights it, looks a long time down the quay, and goes back to the door to stay.'
          : 'He finds the dead lamp, and takes his time relighting it.'
      );
      this.relightingIndex = null;
      return;
    }
  }

  /** Walk to the last-known point, sweep, then rejoin the loop. */
  private investigate(dt: number) {
    if (this.lastKnown) {
      const arrived = this.stepToward(this.lastKnown.x, this.lastKnown.y, dt);
      if (arrived) this.lastKnown = null;
    } else if (this.scene.time.now > this.sweepUntil) {
      // Slow sweep, then settle if it has been quiet long enough.
      this.facingDeg += 40 * dt;
      if (this.calm >= CALM_TO_UNAWARE) {
        this.state = 'unaware';
        this.exposure = 0;
        this.dwellUntil = 0;
      }
    }
  }

  /** One shout, a 140 px/s close, and a grab. No combat. */
  private chase(player: Phaser.Physics.Arcade.Sprite, dt: number) {
    const sprite = this.sprite!;
    const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, player.x, player.y);
    if (distance <= GRAB_DISTANCE) { this.onCaught(); return; }
    this.stepToward(player.x, player.y, dt, CHASE_SPEED);
  }

  /**
   * Walk the routed leg to `target`, computing it on first call.
   * Returns true once the far end is reached.
   */
  private followLeg(target: Point, dt: number): boolean {
    const sprite = this.sprite!;
    if (this.legPath.length === 0) {
      const mask = this.ctx.walkMask();
      const routed = mask
        ? findPath(mask, { x: sprite.x, y: sprite.y }, target, {
          halfWidth: GUARD_HALF_WIDTH,
          footOffset: GUARD_FOOT_OFFSET,
        })
        : null;
      this.legPath = routed?.points.length ? routed.points : [target];
      this.legIndex = 0;
    }

    const leg = this.legPath[this.legIndex];
    if (!this.stepToward(leg.x, leg.y, dt)) return false;
    this.legIndex += 1;
    return this.legIndex >= this.legPath.length;
  }

  /**
   * Move toward a point at the watch pace, refusing unwalkable ground.
   * Returns true on arrival.
   *
   * Resolution is PER AXIS (`resolveMove`), the same way the player's own
   * collision works, so a diagonal into a wall slides along it instead of
   * stopping dead. The previous version snapped to `nearestWalkable` on any
   * refusal, which put him back where he came from and produced a watchman
   * vibrating against the same two pixels for the whole night.
   */
  private stepToward(x: number, y: number, dt: number, speed = DATA.nightWatch.speed): boolean {
    const sprite = this.sprite!;
    const dx = x - sprite.x;
    const dy = y - sprite.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 4) return true;
    this.facingDeg = Math.atan2(dy, dx) * (180 / Math.PI);

    const step = Math.min(distance, speed * dt);
    const nx = sprite.x + (dx / distance) * step;
    const ny = sprite.y + (dy / distance) * step;

    const mask = this.ctx.walkMask();
    if (!mask) {
      sprite.setPosition(nx, ny);
      return false;
    }

    // Resolve against the FEET row, then put the origin back above it.
    const moved = resolveMove(
      mask,
      sprite.x, sprite.y + GUARD_FOOT_OFFSET,
      nx, ny + GUARD_FOOT_OFFSET,
      GUARD_HALF_WIDTH,
    );
    sprite.setPosition(moved.x, moved.y - GUARD_FOOT_OFFSET);
    this.trackProgress();
    return false;
  }

  /**
   * Stuck recovery.
   *
   * A patrol that stops is worse than no patrol: the player reads a stationary
   * guard as a scripted post and re-plans the whole approach around a lie. So
   * two seconds without progress recomputes the route, and four gives up on the
   * geometry and steps him onto the waypoint, which the validator has already
   * proved is walkable.
   */
  private trackProgress() {
    const sprite = this.sprite!;
    const now = this.scene.time.now;
    if (Math.hypot(sprite.x - this.lastX, sprite.y - this.lastY) >= 3) {
      this.lastX = sprite.x;
      this.lastY = sprite.y;
      this.lastProgressAt = now;
      return;
    }
    if (now - this.lastProgressAt < STUCK_RECOMPUTE_MS) return;

    this.lastProgressAt = now;
    if (this.legPath.length > 0 && this.legIndex < this.legPath.length - 1) {
      // Skip the leg point we cannot reach and try the next one.
      this.legIndex += 1;
      return;
    }
    const wp = this.toWorld(DATA.nightWatch.patrol[this.waypointIndex]);
    sprite.setPosition(wp.x, wp.y);
    this.lastX = wp.x;
    this.lastY = wp.y;
    this.legPath = [];
    this.legIndex = 0;
  }

  private syncFurniture() {
    const sprite = this.sprite!;
    const depth = worldDepth(sprite.y + GUARD_FOOT_OFFSET);
    sprite.setDepth(depth);
    if (this.shadow) {
      this.shadow.setPosition(sprite.x, sprite.y + GUARD_FOOT_OFFSET);
      this.shadow.setDepth(depth - 1);
    }
    if (this.lantern) {
      // Light leads the man: the pool is pushed a little ahead of his facing so
      // it turns a corner ~1.4 s before he does.
      const lead = 26;
      const rad = this.facingDeg * (Math.PI / 180);
      this.lantern.setPosition(
        sprite.x + Math.cos(rad) * lead,
        sprite.y + GUARD_FOOT_OFFSET + Math.sin(rad) * lead,
      );
      this.lantern.setDepth(depth - 2);
      const scale = this.state === 'suspicious' ? 1.4 : 1;
      this.lantern.setScale(scale);
      this.lantern.setAlpha(this.state === 'unaware' ? 0.16 : 0.22);
    }
  }

  // -- consequences --------------------------------------------------------

  /**
   * Caught is not game over.
   *
   * Guard shout, fade, and the player wakes at the A Famosa Gate spawn at 06:00
   * the following day with Rodrigues 42 px away, facing them, speaking first.
   * A fine of at most 40 cruzados — receipted, because Mesquita issues them in
   * his own hand, which no thief would do — a light reputation scratch, and the
   * quest back at `choose-path` with the theft path still selectable. A SECOND
   * catch closes the theft path and nothing else: payment, diplomatic and
   * investigate-truth all still complete.
   */
  private onCaught() {
    if (this.caught) return;
    this.caught = true;

    const quests = useQuestStore.getState();
    const inventory = useInventoryStore.getState();
    const chain = DATA.consequenceChain.onCaught;
    const secondCatch = Boolean(quests.worldFlags['theft-attempt-1-failed']);

    this.deps.setCutscene(true);
    this.deps.playSfx?.('sfx-gate-creak', 1);

    // Flags. The second catch adds the closers; the first clears the night's
    // alert so the player is not punished twice for the same evening.
    const set: string[] = [...chain.flags.set];
    if (secondCatch) set.push(...chain.flags.setOnSecondCatch);
    quests.setWorldFlags(set);
    quests.setWorldFlags(chain.flags.clear as string[], false);
    quests.applyReputationDelta(chain.reputation as Record<string, number>);

    // The fine, receipted.
    const fine = Math.min(inventory.money, 40);
    if (fine > 0) inventory.removeMoney(fine);
    inventory.addItem('bribe-note');

    // Confiscations. The seal goes back to Chen Wei; the warehouse key goes
    // into the fortress strongbox, which means the second attempt's barred
    // shutter now needs it re-obtained.
    if (inventory.hasItem('trading-seal')) {
      this.removeItem('trading-seal');
      quests.setWorldFlags(['seal-returned-to-chen']);
    }
    if (inventory.hasItem('key-warehouse')) this.removeItem('key-warehouse');

    quests.addJournalEntry(
      secondCatch
        ? 'Taken off the quay a second time. The Capitão did not raise his voice, which was worse. '
          + `${fine} cruzados fined and written down. That door is shut to me now.`
        : 'The watchman had me by the arm before I heard him. A fine of '
          + `${fine} cruzados, a receipt for it in Senhor Mesquita's own hand, and a night I `
          + 'will not get back. Nobody laid a complaint. That is somehow not a comfort.',
      'quest',
    );

    this.deps.notify(
      secondCatch
        ? 'Taken a second time. The counting house is closed to you.'
        : `Fined ${fine} cruzados, and a receipt for it.`
    );

    // Quest state: back to choose-path, theft still open (unless closed above).
    const quest = quests.activeQuests.find((q) => q.id === 'merchants-seal');
    if (quest) quests.advanceQuest('merchants-seal', 'choose-path');

    this.destroySprite();

    // Wake at the gate at 06:00 the following day.
    //
    // No fade of our own: `switchLocation` already flashes the location tint,
    // fades to black and restarts the scene, and nesting a second fade inside
    // its `camerafadeoutcomplete` handler is how the whole transition ends up
    // stuck half-way — the camera never finishes, the restart never fires, and
    // the player is left frozen on a quay with the clock stopped.
    const hour = this.deps.currentHour();
    const hoursToSix = ((6 - hour) + 24) % 24 || 24;
    this.deps.advanceHours(hoursToSix);
    this.deps.setCutscene(false);
    this.deps.travelTo('a-famosa-gate', { x: 320, y: 264 });
  }

  private removeItem(itemId: string) {
    const inventory = useInventoryStore.getState();
    const held = inventory.items.find((entry) => entry.id === itemId);
    if (held) inventory.removeItem(held.instanceId);
  }

  // -- teardown ------------------------------------------------------------

  private destroySprite() {
    this.sprite?.destroy();
    this.shadow?.destroy();
    this.lantern?.destroy();
    this.sprite = null;
    this.shadow = null;
    this.lantern = null;
  }

  destroy() {
    this.destroySprite();
    this.doused.clear();
  }
}
