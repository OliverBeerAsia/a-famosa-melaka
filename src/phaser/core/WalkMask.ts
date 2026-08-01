/**
 * WalkMask — the authoritative walkable surface for a composed plate.
 *
 * The Forge compositor emits `<id>-walk.png` alongside every plate it paints:
 * one native-resolution pixel per plate pixel, R = 255 walkable / 0 blocked and
 * G = the surface material id. Because it is generated from the SAME layout
 * that paints the plate, it can never drift out of sync with what the player
 * sees — which is exactly the failure mode the hand-maintained collision rects
 * had (`derived rects` are a greedy 8px-grid cover of this mask, kept in the
 * location file only as a coarse fallback for plates with no mask).
 *
 * Sampling is in WORLD space; the mask is native, so every lookup divides by
 * `scale` once. The class holds a plain Uint8Array copy of the two channels it
 * needs, so a lookup is an array index — cheap enough to run several times per
 * frame per moving character.
 */

/** G-channel material ids written by tools/forge/compose-plate.cjs. */
export const SURFACE_IDS = {
  none: 0,
  stone: 1,
  dirt: 2,
  wood: 3,
  sand: 4,
  water: 5,
  grass: 6,
  tile: 7,
} as const;

export type SurfaceName = keyof typeof SURFACE_IDS;

const SURFACE_NAMES: SurfaceName[] = [
  'none', 'stone', 'dirt', 'wood', 'sand', 'water', 'grass', 'tile',
];

/** Footstep bank for each mask material (the engine only ships three banks). */
const SURFACE_FOOTSTEP: Record<SurfaceName, 'stone' | 'wood' | 'dirt'> = {
  none: 'stone',
  stone: 'stone',
  tile: 'stone',
  wood: 'wood',
  dirt: 'dirt',
  sand: 'dirt',
  grass: 'dirt',
  water: 'stone',
};

export interface WalkMaskData {
  width: number;
  height: number;
  /** One byte per pixel: 1 walkable, 0 blocked. */
  walkable: Uint8Array;
  /** One byte per pixel: the G-channel surface id. */
  surface: Uint8Array;
}

export class WalkMask {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  private readonly walkableBits: Uint8Array;
  private readonly surfaceBits: Uint8Array;

  constructor(data: WalkMaskData, scale: number) {
    this.width = data.width;
    this.height = data.height;
    this.scale = scale;
    this.walkableBits = data.walkable;
    this.surfaceBits = data.surface;
  }

  /** Build from raw RGBA bytes (canvas/texture order). */
  static fromRGBA(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, scale: number): WalkMask {
    const n = width * height;
    const walkable = new Uint8Array(n);
    const surface = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
      walkable[p] = rgba[p * 4] >= 128 ? 1 : 0;
      surface[p] = rgba[p * 4 + 1];
    }
    return new WalkMask({ width, height, walkable, surface }, scale);
  }

  /** Walkable at a WORLD-space point? Off-mask reads as blocked. */
  isWalkable(worldX: number, worldY: number): boolean {
    const x = Math.floor(worldX / this.scale);
    const y = Math.floor(worldY / this.scale);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.walkableBits[y * this.width + x] === 1;
  }

  /**
   * Walkable for a character standing at (worldX, worldY) with a body of
   * `halfWidth` world px. Both feet corners and the centre must clear, so a
   * character cannot stand with half of itself inside a wall.
   */
  canStand(worldX: number, worldY: number, halfWidth = 0): boolean {
    if (!this.isWalkable(worldX, worldY)) return false;
    if (halfWidth <= 0) return true;
    return this.isWalkable(worldX - halfWidth, worldY) && this.isWalkable(worldX + halfWidth, worldY);
  }

  /** Surface material under a WORLD-space point. */
  surfaceAt(worldX: number, worldY: number): SurfaceName {
    const x = Math.floor(worldX / this.scale);
    const y = Math.floor(worldY / this.scale);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 'none';
    return SURFACE_NAMES[this.surfaceBits[y * this.width + x]] ?? 'none';
  }

  /** Footstep bank under a WORLD-space point. */
  footstepAt(worldX: number, worldY: number): 'stone' | 'wood' | 'dirt' {
    return SURFACE_FOOTSTEP[this.surfaceAt(worldX, worldY)];
  }

  /**
   * Nearest walkable world point to (worldX, worldY), searched in expanding
   * native-pixel rings. Used to rescue a character who ends up inside geometry
   * (a stale save, a scripted teleport) instead of letting them stick.
   * Returns null when nothing is walkable within `maxRadius` native px.
   */
  nearestWalkable(worldX: number, worldY: number, maxRadius = 48, halfWidth = 0): { x: number; y: number } | null {
    if (this.canStand(worldX, worldY, halfWidth)) return { x: worldX, y: worldY };
    const s = this.scale;
    for (let r = 1; r <= maxRadius; r++) {
      let best: { x: number; y: number; d2: number } | null = null;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const wx = worldX + dx * s;
          const wy = worldY + dy * s;
          if (!this.canStand(wx, wy, halfWidth)) continue;
          const d2 = dx * dx + dy * dy;
          if (!best || d2 < best.d2) best = { x: wx, y: wy, d2 };
        }
      }
      if (best) return { x: best.x, y: best.y };
    }
    return null;
  }
}

/**
 * Resolve a movement step against the mask, one axis at a time.
 *
 * Per-axis resolution is what makes walking along a wall feel right: a diagonal
 * into a wall keeps the component that is still legal instead of stopping dead.
 * Returns the position actually reached.
 */
export function resolveMove(
  mask: WalkMask,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  halfWidth = 0,
): { x: number; y: number; blockedX: boolean; blockedY: boolean } {
  let x = fromX;
  let y = fromY;
  let blockedX = false;
  let blockedY = false;

  if (toX !== fromX) {
    if (mask.canStand(toX, y, halfWidth)) x = toX;
    else blockedX = true;
  }
  if (toY !== fromY) {
    if (mask.canStand(x, toY, halfWidth)) y = toY;
    else blockedY = true;
  }
  // A diagonal whose X leg was rejected can still be legal once Y has moved
  // (inside corners), so give the rejected axis one second chance.
  if (blockedX && y !== fromY && mask.canStand(toX, y, halfWidth)) {
    x = toX;
    blockedX = false;
  }
  return { x, y, blockedX, blockedY };
}
