/**
 * cameraMath — the geometry behind CameraSystem, with no Phaser in it.
 *
 * Camera behaviour is the kind of thing that is easy to get subtly wrong and
 * impossible to eyeball (does the deadzone drift? does the clamp show a strip
 * of void at the world edge?), so the arithmetic lives here where it can be
 * tested directly, and `CameraSystem` is only the wiring that hands it to
 * Phaser.
 *
 * All sizes are WORLD pixels; the viewport defaults to the game canvas.
 */

export interface CameraWorldSize {
  width: number;
  height: number;
}

/** Follow lerp. Low enough to lag slightly behind, high enough not to swim. */
export const FOLLOW_LERP = 0.12;

/** Deadzone: a quarter of the viewport, so small steps move nothing. */
export const DEADZONE_WIDTH = 160;
export const DEADZONE_HEIGHT = 90;

/** How far ahead of the player the camera leans, at full walking speed. */
export const LOOKAHEAD_MAX = 60;

/** Velocity (px/s) at which lookahead reaches LOOKAHEAD_MAX. */
const LOOKAHEAD_REFERENCE_SPEED = 160;

/** How fast the lookahead offset itself eases toward its target (per second). */
export const LOOKAHEAD_EASE = 3.5;

// ---------------------------------------------------------------------------
// Pure math (unit-testable without a Phaser scene)
// ---------------------------------------------------------------------------

/**
 * The scroll (top-left of the viewport) that centres `focus`, clamped so the
 * camera never shows anything outside the world.
 *
 * A world smaller than the viewport in an axis is CENTRED in that axis rather
 * than clamped to 0, which is what keeps a 960x540 plate exactly where it has
 * always been.
 */
export function clampScroll(
  focusX: number,
  focusY: number,
  world: CameraWorldSize,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  const clampAxis = (focus: number, worldSize: number, viewSize: number) => {
    if (worldSize <= viewSize) return (worldSize - viewSize) / 2;
    const raw = focus - viewSize / 2;
    return Math.min(Math.max(raw, 0), worldSize - viewSize);
  };
  return {
    x: clampAxis(focusX, world.width, viewWidth),
    y: clampAxis(focusY, world.height, viewHeight),
  };
}

/**
 * Move `current` toward `target` only as far as the deadzone demands: while the
 * target is inside the deadzone rectangle around the current focus, the camera
 * does not move at all.
 */
export function applyDeadzone(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  deadzoneWidth = DEADZONE_WIDTH,
  deadzoneHeight = DEADZONE_HEIGHT,
): { x: number; y: number } {
  const halfW = deadzoneWidth / 2;
  const halfH = deadzoneHeight / 2;
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  return {
    x: Math.abs(dx) <= halfW ? currentX : targetX - Math.sign(dx) * halfW,
    y: Math.abs(dy) <= halfH ? currentY : targetY - Math.sign(dy) * halfH,
  };
}

/** Velocity-proportional lookahead, saturating at LOOKAHEAD_MAX. */
export function lookaheadOffset(
  velocityX: number,
  velocityY: number,
  max = LOOKAHEAD_MAX,
): { x: number; y: number } {
  const scale = (v: number) => {
    const t = Math.max(-1, Math.min(1, v / LOOKAHEAD_REFERENCE_SPEED));
    return t * max;
  };
  return { x: scale(velocityX), y: scale(velocityY) };
}

/** True when the world is larger than the viewport in either axis. */
export function isScrolling(world: CameraWorldSize, viewWidth: number, viewHeight: number): boolean {
  return world.width > viewWidth || world.height > viewHeight;
}

