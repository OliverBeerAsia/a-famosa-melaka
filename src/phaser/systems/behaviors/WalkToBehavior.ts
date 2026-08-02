/**
 * WalkToBehavior — one character walking a fixed route to a station.
 *
 * The sibling of `FollowBehavior`: same shape, same seams, different source of
 * truth. A follower chases a breadcrumb trail the player is laying live; a
 * walker follows a path A* computed once (see core/pathfind) and reports when
 * it gets there.
 *
 * The decision half is the pure `resolveWalkStep` below — no sprite, no scene,
 * unit-testable. The class is the Phaser hands: velocity, walk/idle animation,
 * and the two recoveries that a painted plate makes mandatory.
 *
 * Two recoveries, both cheap and both load-bearing:
 *
 *  - **Stuck.** A walker that has not made progress for `stuckMs` is standing
 *    on geometry the path did not know about (a prop placed after the mask, a
 *    collision with another body). It is snapped to the nearest walkable point
 *    and the leg is retried. Without this an NPC can miss a schedule slot
 *    permanently and the whole day silently stops.
 *  - **Off-camera.** Walking a character the player cannot see is pure cost.
 *    The spec's contract is walk on camera, teleport + fade otherwise, so the
 *    OWNER decides (it knows the camera) and tells the behaviour which mode to
 *    run in; the behaviour never reads the camera itself.
 */

import Phaser from 'phaser';
import type { Point } from '../../core/pathfind';

export interface WalkTuning {
  /** How close (world px) counts as reaching an intermediate waypoint. */
  waypointTolerance: number;
  /** How close (world px) counts as arriving at the final station. */
  arriveTolerance: number;
  /**
   * Below this much progress (world px) over `stuckMs`, the walker is stuck.
   * Generous, because a diagonal squeeze past a corner is legitimately slow.
   */
  stuckProgress: number;
  /** How long (ms) of no progress before recovery fires. */
  stuckMs: number;
  /** How many recoveries before the walk is abandoned as impossible. */
  maxRecoveries: number;
}

export const DEFAULT_WALK_TUNING: WalkTuning = {
  waypointTolerance: 8,
  arriveTolerance: 6,
  stuckProgress: 4,
  stuckMs: 1200,
  maxRecoveries: 3,
};

export type WalkStep =
  | { action: 'arrived' }
  /** Reached `index`; the caller should advance to `nextIndex` and re-resolve. */
  | { action: 'advance'; nextIndex: number }
  | {
    action: 'move';
    vx: number;
    vy: number;
    direction: 'up' | 'down' | 'left' | 'right';
    /** Distance still to run on this leg, world px. */
    remaining: number;
  };

/**
 * Decide what a walker at (x, y) should do this frame. Pure.
 *
 * `index` is the waypoint currently being walked toward. The caller owns it;
 * this function only ever says "advance".
 */
export function resolveWalkStep(
  x: number,
  y: number,
  path: Point[],
  index: number,
  speed: number,
  tuning: WalkTuning = DEFAULT_WALK_TUNING,
): WalkStep {
  if (!path.length || index >= path.length) return { action: 'arrived' };

  const target = path[index];
  const isLast = index === path.length - 1;
  const dx = target.x - x;
  const dy = target.y - y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const tolerance = isLast ? tuning.arriveTolerance : tuning.waypointTolerance;
  if (distance <= tolerance) {
    return isLast ? { action: 'arrived' } : { action: 'advance', nextIndex: index + 1 };
  }

  const angle = Math.atan2(dy, dx);
  // Never overshoot the last waypoint: at 90 px/s and a 16 ms frame that is
  // 1.4 px, which matters only at the tolerance boundary — but overshooting
  // there is exactly what makes a character jitter on the spot forever.
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;

  const direction = Math.abs(vx) > Math.abs(vy)
    ? (vx < 0 ? 'left' : 'right')
    : (vy < 0 ? 'up' : 'down');

  return { action: 'move', vx, vy, direction, remaining: distance };
}

/** Total length of a path in world px — used to budget `arriveBy` departures. */
export function pathLength(path: Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

export type WalkOutcome = 'walking' | 'arrived' | 'failed';

export interface WalkToDeps {
  /** Rescue a walker who ended up on unwalkable ground. */
  nearestWalkable(x: number, y: number): Point | null;
}

/** Applies `resolveWalkStep` to a sprite, with stuck recovery. */
export class WalkToBehavior {
  private readonly scene: Phaser.Scene;
  private readonly tuning: WalkTuning;
  private readonly deps: WalkToDeps;

  private animPrefix: string;
  private path: Point[] = [];
  private index = 0;
  private outcome: WalkOutcome = 'arrived';
  private lastProgressAt = 0;
  private lastX = 0;
  private lastY = 0;
  private recoveries = 0;
  private speed = 90;
  /** Facing to settle into on arrival, if the caller asked for one. */
  private finalFacing: string | null = null;

  constructor(
    scene: Phaser.Scene,
    animPrefix: string,
    deps: WalkToDeps,
    tuning: WalkTuning = DEFAULT_WALK_TUNING,
  ) {
    this.scene = scene;
    this.animPrefix = animPrefix;
    this.deps = deps;
    this.tuning = tuning;
  }

  setAnimPrefix(prefix: string) { this.animPrefix = prefix; }

  /** Is this walker still on its way? */
  isWalking(): boolean { return this.outcome === 'walking'; }
  getOutcome(): WalkOutcome { return this.outcome; }
  /** Where this walk ends, for the caller's own arrival bookkeeping. */
  destination(): Point | null { return this.path[this.path.length - 1] ?? null; }
  remainingPath(): Point[] { return this.path.slice(this.index); }

  /**
   * Start a walk. `path` is in world px and must already be routed — this
   * behaviour does no pathfinding of its own, so the owner is free to cache,
   * throttle or precompute routes however it likes.
   */
  start(path: Point[], speed: number, finalFacing?: string) {
    this.path = path.slice();
    this.index = 0;
    this.speed = speed;
    this.finalFacing = finalFacing ?? null;
    this.recoveries = 0;
    this.lastProgressAt = this.scene.time.now;
    this.outcome = path.length > 0 ? 'walking' : 'arrived';
  }

  /** Abandon the walk without moving the sprite. */
  cancel() {
    this.path = [];
    this.index = 0;
    this.outcome = 'arrived';
  }

  /**
   * Skip the walk: put the character at the destination now.
   *
   * This is the off-camera branch of the spec's contract, and the branch every
   * cross-location move takes. Fading is the caller's business — it owns the
   * sprite's alpha and knows whether anyone is watching.
   */
  teleportToEnd(sprite: Phaser.Physics.Arcade.Sprite) {
    const end = this.destination();
    if (end) {
      const safe = this.deps.nearestWalkable(end.x, end.y) ?? end;
      sprite.setPosition(safe.x, safe.y);
    }
    sprite.setVelocity(0, 0);
    this.playIdle(sprite, this.finalFacing || 'down');
    this.path = [];
    this.index = 0;
    this.outcome = 'arrived';
  }

  /**
   * Drive one frame. Returns the outcome so the owner can react to arrival on
   * the same frame it happens rather than one frame late.
   */
  update(sprite: Phaser.Physics.Arcade.Sprite): WalkOutcome {
    if (this.outcome !== 'walking') return this.outcome;

    // Resolve at most twice: once normally, and once more if the first result
    // was "advance" (so a waypoint reached this frame is consumed immediately
    // instead of costing a frame of standing still on top of it).
    let step = resolveWalkStep(sprite.x, sprite.y, this.path, this.index, this.speed, this.tuning);
    if (step.action === 'advance') {
      this.index = step.nextIndex;
      step = resolveWalkStep(sprite.x, sprite.y, this.path, this.index, this.speed, this.tuning);
    }

    if (step.action === 'arrived') {
      sprite.setVelocity(0, 0);
      this.playIdle(sprite, this.finalFacing || 'down');
      this.outcome = 'arrived';
      this.path = [];
      return 'arrived';
    }

    if (step.action === 'advance') {
      this.index = step.nextIndex;
      return 'walking';
    }

    this.trackProgress(sprite);
    if (this.outcome !== 'walking') return this.outcome;

    sprite.setVelocity(step.vx, step.vy);
    const animKey = `${this.animPrefix}-walk-${step.direction}`;
    if (this.scene.anims.exists(animKey) && sprite.anims.currentAnim?.key !== animKey) {
      sprite.play(animKey);
    }
    return 'walking';
  }

  /**
   * No progress for `stuckMs` means the path is lying about the ground. Snap
   * onto the nearest walkable point and keep going; give up after
   * `maxRecoveries` so a genuinely impossible walk does not thrash forever.
   */
  private trackProgress(sprite: Phaser.Physics.Arcade.Sprite) {
    const now = this.scene.time.now;
    const moved = Math.hypot(sprite.x - this.lastX, sprite.y - this.lastY);
    if (moved >= this.tuning.stuckProgress) {
      this.lastX = sprite.x;
      this.lastY = sprite.y;
      this.lastProgressAt = now;
      return;
    }
    if (now - this.lastProgressAt < this.tuning.stuckMs) return;

    this.lastProgressAt = now;
    this.recoveries += 1;
    if (this.recoveries > this.tuning.maxRecoveries) {
      // Out of ideas: stop where we are rather than vibrating against a wall.
      sprite.setVelocity(0, 0);
      this.playIdle(sprite, this.finalFacing || 'down');
      this.outcome = 'failed';
      this.path = [];
      return;
    }

    const rescue = this.deps.nearestWalkable(sprite.x, sprite.y);
    if (rescue) {
      sprite.setPosition(rescue.x, rescue.y);
      this.lastX = rescue.x;
      this.lastY = rescue.y;
    } else if (this.path[this.index]) {
      // Nothing walkable nearby at all — jump straight to the waypoint we were
      // heading for; it was verified walkable when the path was built.
      const wp = this.path[this.index];
      sprite.setPosition(wp.x, wp.y);
      this.lastX = wp.x;
      this.lastY = wp.y;
    }
  }

  private playIdle(sprite: Phaser.Physics.Arcade.Sprite, facing: string) {
    const idleKey = `${this.animPrefix}-idle-${facing}`;
    if (this.scene.anims.exists(idleKey) && sprite.anims.currentAnim?.key !== idleKey) {
      sprite.play(idleKey);
    }
  }
}
