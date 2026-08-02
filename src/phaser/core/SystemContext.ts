/**
 * The slice of scene state every gameplay system is allowed to read.
 *
 * Systems are constructed with `(scene, ctx)`. The scene gives them Phaser
 * (display list, tweens, physics); this context gives them the handful of
 * *world* facts they need — which location, what hour, how big the world is —
 * without any of them holding a reference to GameScene itself.
 *
 * Every member is a getter rather than a value: the scene owns the state and
 * the systems read it live, so nothing goes stale across a time change or a
 * quality downgrade.
 */

import type Phaser from 'phaser';
import type { LocationRuntime } from './LocationData';
import type { TimeOfDay } from './timeMath';
import type { WalkMask } from './WalkMask';
import type { ResolvedVisualQuality, VisualProfile } from '../visualProfile';

export interface SystemContext {
  /** Location id currently loaded ('rua-direita', ...). */
  locationId(): string;
  /** Parsed <id>.location.json, already scaled into world px. */
  location(): LocationRuntime | undefined;
  /** Current phase of day. */
  timeOfDay(): TimeOfDay;
  /** Size of the walkable world in world px (viewport-sized on flip plates). */
  worldBounds(): { width: number; height: number };
  /** Active visual quality profile (particle counts, alpha multipliers). */
  visualProfile(): VisualProfile;
  /** Resolved quality tier. */
  quality(): ResolvedVisualQuality;
  /** The player sprite, once it exists. */
  player(): Phaser.Physics.Arcade.Sprite | null;
  /** Authoritative walkable surface, when the plate ships a mask. */
  walkMask(): WalkMask | null;
  /** True while this location runs the isometric tilemap path. */
  isIsometric(): boolean;
  /** True while any blocking UI (dialogue, journal, pause, rest) is up. */
  isUIOpen(): boolean;
  /**
   * True when the visible backdrop is a pre-baked time-of-day plate variant.
   * Runtime grading must go to zero where the plate already carries the grade,
   * or the scene is graded twice (the double-grade bug).
   */
  hasBakedTimeVariant(): boolean;
}
