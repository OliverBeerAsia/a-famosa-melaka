/**
 * A breadcrumb trail: where a leader has been, in order, for anything that
 * follows them.
 *
 * The escort follower walks the player's own path rather than steering toward
 * the player directly — that is why Siti rounds a corner the way a person does
 * instead of cutting through the wall the player just walked around. A crumb is
 * only laid when the leader has actually moved, so standing still does not
 * flush the trail and teleport the follower onto the leader's feet.
 *
 * Pure and Phaser-free: this is the shared substrate for Stage 5's walk-to
 * behaviours as well as the escort follower.
 */

export interface Breadcrumb {
  x: number;
  y: number;
  facing: string;
  walking: boolean;
}

/** Trail length in crumbs. At ~1 crumb/frame this is ~2.5s of history. */
export const DEFAULT_TRAIL_LENGTH = 150;
/** A leader must move this far (world px) before a new crumb is laid. */
export const DEFAULT_MIN_CRUMB_DISTANCE = 2;

export class BreadcrumbTrail {
  private crumbs: Breadcrumb[] = [];
  private readonly maxLength: number;
  private readonly minDistance: number;

  constructor(
    maxLength: number = DEFAULT_TRAIL_LENGTH,
    minDistance: number = DEFAULT_MIN_CRUMB_DISTANCE,
  ) {
    this.maxLength = maxLength;
    this.minDistance = minDistance;
  }

  get length(): number {
    return this.crumbs.length;
  }

  /**
   * Lay a crumb if the leader has moved far enough since the last one.
   * Returns true when a crumb was actually laid.
   */
  record(x: number, y: number, facing: string, walking: boolean): boolean {
    const last = this.crumbs[this.crumbs.length - 1];
    if (last) {
      const dx = x - last.x;
      const dy = y - last.y;
      if (Math.sqrt(dx * dx + dy * dy) <= this.minDistance) return false;
    }

    this.crumbs.push({ x, y, facing, walking });
    if (this.crumbs.length > this.maxLength) this.crumbs.shift();
    return true;
  }

  /**
   * Seed the trail with `count` copies of one crumb.
   *
   * Used on spawn and after a location change: without it the trail is empty,
   * the follower has nothing to walk toward, and the first frame snaps them
   * across the screen.
   */
  prefill(count: number, crumb: Breadcrumb) {
    // Pushed directly rather than via record(): every crumb here is at the same
    // position, so the min-distance test would reject all but the first and the
    // trail would still be one crumb deep.
    const target = Math.min(count, this.maxLength);
    while (this.crumbs.length < target) this.crumbs.push({ ...crumb });
  }

  /**
   * The crumb `delay` steps behind the head, or null while the trail is still
   * shorter than that. `delay` of 1 is the most recent crumb.
   */
  at(delay: number): Breadcrumb | null {
    if (delay <= 0) return null;
    if (this.crumbs.length <= delay) return null;
    return this.crumbs[this.crumbs.length - delay] ?? null;
  }

  /** The most recent crumb, if any. */
  head(): Breadcrumb | null {
    return this.crumbs[this.crumbs.length - 1] ?? null;
  }

  clear() {
    this.crumbs = [];
  }
}
