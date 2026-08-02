/**
 * FollowBehavior — one character walking another character's path.
 *
 * Generalised from the hard-coded Siti escort. The decision half is the pure
 * `resolveFollowStep` below; the class is only the Phaser hands that apply it
 * to a sprite (velocity + walk/idle animation). Stage 5's schedule walking
 * extends the same seam: swap the breadcrumb trail for a path from the walk
 * mask and the steering, easing, catch-up and teleport-recovery all still hold.
 *
 * Four regimes, in order of precedence:
 *   - **teleport**: hopelessly far behind (stuck on geometry, or the leader
 *     changed location) — snap onto the trail rather than drift forever,
 *   - **catch up**: a long way back, move faster than the leader,
 *   - **follow**: normal, slightly slower than the leader so the gap is stable,
 *   - **idle**: close enough, stop and face the way the leader faced.
 */

import Phaser from 'phaser';
import type { Breadcrumb } from '../../core/breadcrumbTrail';

export interface FollowTuning {
  /** How many crumbs behind the leader the follower aims for. */
  followDelay: number;
  /** Fraction of the leader's speed at a normal following distance. */
  speedFactor: number;
  /** Fraction of the leader's speed when catching up. */
  catchUpSpeedFactor: number;
  /** Gap beyond which the follower speeds up. */
  catchUpDistance: number;
  /** Gap under which the follower stops and idles. */
  arriveDistance: number;
  /** Gap beyond which the follower gives up and snaps onto the trail. */
  teleportDistance: number;
}

/** The tuning the escort has always used. */
export const DEFAULT_FOLLOW_TUNING: FollowTuning = {
  // Tighter tracking around corners than a longer delay gives.
  followDelay: 10,
  speedFactor: 0.95,
  catchUpSpeedFactor: 1.15,
  catchUpDistance: 75,
  arriveDistance: 15,
  teleportDistance: 280,
};

export type FollowStep =
  | { action: 'wait' }
  | { action: 'teleport'; x: number; y: number }
  | { action: 'move'; vx: number; vy: number; direction: 'up' | 'down' | 'left' | 'right' }
  | { action: 'idle'; facing: string };

/**
 * Decide what the follower should do this frame. Pure: no sprite, no scene.
 *
 * `target` is the breadcrumb the follower is walking toward; null means the
 * trail is not long enough yet and the follower should simply wait.
 */
export function resolveFollowStep(
  followerX: number,
  followerY: number,
  target: Breadcrumb | null,
  baseSpeed: number,
  tuning: FollowTuning = DEFAULT_FOLLOW_TUNING,
): FollowStep {
  if (!target) return { action: 'wait' };

  const dx = target.x - followerX;
  const dy = target.y - followerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= tuning.arriveDistance) {
    return { action: 'idle', facing: target.facing || 'down' };
  }

  if (distance > tuning.teleportDistance) {
    return { action: 'teleport', x: target.x, y: target.y };
  }

  const speed = distance > tuning.catchUpDistance
    ? baseSpeed * tuning.catchUpSpeedFactor
    : baseSpeed * tuning.speedFactor;

  const angle = Math.atan2(dy, dx);
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;

  const direction = Math.abs(vx) > Math.abs(vy)
    ? (vx < 0 ? 'left' : 'right')
    : (vy < 0 ? 'up' : 'down');

  return { action: 'move', vx, vy, direction };
}

/** Applies `resolveFollowStep` to a sprite. */
export class FollowBehavior {
  private readonly scene: Phaser.Scene;
  private readonly animPrefix: string;
  private readonly tuning: FollowTuning;

  constructor(
    scene: Phaser.Scene,
    animPrefix: string,
    tuning: FollowTuning = DEFAULT_FOLLOW_TUNING,
  ) {
    this.scene = scene;
    this.animPrefix = animPrefix;
    this.tuning = tuning;
  }

  get followDelay(): number {
    return this.tuning.followDelay;
  }

  /**
   * Drive one frame. Returns the step taken so the caller can react — a
   * teleport means the follower's position is not meaningful this frame, and
   * anything keyed off "have they arrived" should sit that frame out.
   */
  update(
    sprite: Phaser.Physics.Arcade.Sprite,
    target: Breadcrumb | null,
    baseSpeed: number,
  ): FollowStep {
    const step = resolveFollowStep(sprite.x, sprite.y, target, baseSpeed, this.tuning);

    switch (step.action) {
      case 'teleport':
        sprite.setPosition(step.x, step.y);
        break;
      case 'move': {
        sprite.setVelocity(step.vx, step.vy);
        const animKey = `${this.animPrefix}-walk-${step.direction}`;
        if (this.scene.anims.exists(animKey) && sprite.anims.currentAnim?.key !== animKey) {
          sprite.play(animKey);
        }
        break;
      }
      case 'idle': {
        sprite.setVelocity(0, 0);
        const idleKey = `${this.animPrefix}-idle-${step.facing}`;
        if (this.scene.anims.exists(idleKey) && sprite.anims.currentAnim?.key !== idleKey) {
          sprite.play(idleKey);
        }
        break;
      }
      case 'wait':
      default:
        break;
    }

    return step;
  }
}
