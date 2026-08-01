import Phaser from 'phaser';
import {
  clampScroll,
  isScrolling,
  lookaheadOffset,
  DEADZONE_HEIGHT,
  DEADZONE_WIDTH,
  FOLLOW_LERP,
  LOOKAHEAD_EASE,
  type CameraWorldSize,
} from '../core/cameraMath';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';

export * from '../core/cameraMath';

/**
 * CameraSystem — the one place that decides what the 960x540 viewport is
 * looking at.
 *
 * Before Stage 3 the world was always exactly the viewport, so `startFollow`
 * was a no-op and every screen was a framed flip-screen. Plates composed by the
 * Forge from Stage 3 onwards are 640x360 native (1920x1080 world), so the
 * camera has to travel — and the moment it does, three things that used to be
 * free stop being free: the plate must live in world space instead of being
 * pinned to the screen, every full-screen FX rectangle needs `scrollFactor(0)`,
 * and the follow has to have a deadzone or the whole street slides under the
 * player on every keypress.
 *
 * On a location whose world IS the viewport this class is deliberately inert:
 * the bounds clamp pins the scroll at (0,0) and the result is pixel-identical
 * to the pre-Stage-3 camera.
 */

// ---------------------------------------------------------------------------

export class CameraSystem {
  private readonly scene: Phaser.Scene;
  private world: CameraWorldSize = { width: GAME_WIDTH, height: GAME_HEIGHT };
  private target: Phaser.GameObjects.Components.Transform | null = null;
  private lookX = 0;
  private lookY = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private get camera(): Phaser.Cameras.Scene2D.Camera {
    return this.scene.cameras.main;
  }

  /** Set the world the camera may travel over (world-space px). */
  setWorld(world: CameraWorldSize): void {
    this.world = world;
    const cam = this.camera;
    cam.setZoom(1.0);
    cam.setBounds(0, 0, world.width, world.height);
  }

  get scrolling(): boolean {
    return isScrolling(this.world, this.camera.width, this.camera.height);
  }

  /**
   * Follow a sprite. Phaser's own follow does lerp + deadzone; we keep it (it
   * runs after physics, in the render step, which is where a camera belongs)
   * and layer the lookahead on top as a follow offset.
   */
  follow(target: Phaser.GameObjects.Components.Transform & { x: number; y: number }): void {
    this.target = target;
    this.lookX = 0;
    this.lookY = 0;
    const cam = this.camera;
    cam.startFollow(target as unknown as Phaser.GameObjects.GameObject, true, FOLLOW_LERP, FOLLOW_LERP);
    if (this.scrolling) {
      cam.setDeadzone(DEADZONE_WIDTH, DEADZONE_HEIGHT);
      cam.setFollowOffset(0, 0);
      // Start framed on the player rather than panning in from the corner.
      cam.centerOn(target.x, target.y);
    } else {
      // Viewport-sized world: no deadzone, no lookahead, bounds pin the scroll.
      cam.setDeadzone(0, 0);
      cam.setFollowOffset(0, 0);
    }
  }

  stopFollow(): void {
    this.target = null;
    this.camera.stopFollow();
  }

  /**
   * Ease the lookahead offset toward the player's current velocity.
   * `delta` is milliseconds, as Phaser hands it to `Scene.update`.
   */
  update(delta: number, velocityX: number, velocityY: number): void {
    if (!this.target || !this.scrolling) return;
    const want = lookaheadOffset(velocityX, velocityY);
    const t = Math.min(1, (delta / 1000) * LOOKAHEAD_EASE);
    this.lookX += (want.x - this.lookX) * t;
    this.lookY += (want.y - this.lookY) * t;
    // Phaser's follow offset is SUBTRACTED from the target position, so a
    // positive lookahead has to be negated to lead the player.
    this.camera.setFollowOffset(-this.lookX, -this.lookY);
  }

  /** Snap the camera onto the target immediately (spawn, teleport, load). */
  snapTo(x: number, y: number): void {
    this.lookX = 0;
    this.lookY = 0;
    this.camera.setFollowOffset(0, 0);
    this.camera.centerOn(x, y);
  }

  /**
   * Screen shake. `intensity` is a fraction of the viewport (0.005 is a firm
   * thud, 0.02 is a cannon), `duration` in ms.
   */
  shake(intensity = 0.006, duration = 180): void {
    this.camera.shake(duration, intensity, false);
  }

  /** Where the camera would sit if it were centred on (x, y) right now. */
  scrollFor(x: number, y: number): { x: number; y: number } {
    return clampScroll(x, y, this.world, this.camera.width, this.camera.height);
  }
}

export default CameraSystem;
