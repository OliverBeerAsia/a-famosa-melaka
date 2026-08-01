import { describe, expect, it } from 'vitest';
import { WalkMask, resolveMove, SURFACE_IDS } from './WalkMask';

/**
 * A 4x3 native mask, scale 3 (so 12x9 world px):
 *
 *   . . # .      # = blocked
 *   . . # .      the left two columns are stone, the right one is wood
 *   . . . .
 */
function makeMask(scale = 3): WalkMask {
  const w = 4;
  const h = 3;
  const rgba = new Uint8Array(w * h * 4);
  const set = (x: number, y: number, walkable: boolean, surface: number) => {
    const i = (y * w + x) * 4;
    rgba[i] = walkable ? 255 : 0;
    rgba[i + 1] = surface;
    rgba[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const blocked = x === 2 && y < 2;
      set(x, y, !blocked, x === 3 ? SURFACE_IDS.wood : SURFACE_IDS.stone);
    }
  }
  return WalkMask.fromRGBA(rgba, w, h, scale);
}

describe('WalkMask sampling', () => {
  const mask = makeMask();

  it('maps world pixels onto native mask pixels via the scale', () => {
    expect(mask.isWalkable(0, 0)).toBe(true);      // native (0,0)
    expect(mask.isWalkable(6, 0)).toBe(false);     // native (2,0) — blocked
    expect(mask.isWalkable(8, 5)).toBe(false);     // still inside native (2,1)
    expect(mask.isWalkable(8, 7)).toBe(true);      // native (2,2) — open again
  });

  it('treats anything off the mask as blocked', () => {
    expect(mask.isWalkable(-1, 0)).toBe(false);
    expect(mask.isWalkable(0, -1)).toBe(false);
    expect(mask.isWalkable(12, 0)).toBe(false);
    expect(mask.isWalkable(0, 9)).toBe(false);
  });

  it('requires the whole body width to clear, not just the centre', () => {
    // Centre at native x=1 is open, but a 3px half-width reaches into x=2.
    expect(mask.isWalkable(4, 0)).toBe(true);
    expect(mask.canStand(4, 0, 3)).toBe(false);
    expect(mask.canStand(4, 0, 1)).toBe(true);
  });

  it('reports the surface material for footsteps', () => {
    expect(mask.surfaceAt(0, 0)).toBe('stone');
    expect(mask.surfaceAt(9, 0)).toBe('wood');
    expect(mask.footstepAt(9, 0)).toBe('wood');
    expect(mask.footstepAt(0, 0)).toBe('stone');
    expect(mask.footstepAt(-5, 0)).toBe('stone');   // off-mask default
  });

  it('finds the nearest walkable point when a position is stuck in geometry', () => {
    const rescued = mask.nearestWalkable(6, 0);
    expect(rescued).not.toBeNull();
    expect(mask.isWalkable(rescued!.x, rescued!.y)).toBe(true);
    // It should not have travelled further than one native pixel.
    expect(Math.abs(rescued!.x - 6) + Math.abs(rescued!.y - 0)).toBeLessThanOrEqual(3);
  });

  it('returns the original point when it is already walkable', () => {
    expect(mask.nearestWalkable(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('resolveMove', () => {
  const mask = makeMask();

  it('allows a fully legal move', () => {
    const r = resolveMove(mask, 0, 0, 3, 0);
    expect(r).toMatchObject({ x: 3, y: 0, blockedX: false, blockedY: false });
  });

  it('blocks the offending axis only, so the player slides along a wall', () => {
    // Walking right into the blocked column while also moving down: x is
    // refused at first, but once y has moved past the wall it is allowed.
    const r = resolveMove(mask, 3, 3, 6, 7);
    expect(r.y).toBe(7);
    expect(r.x).toBe(6);
    expect(r.blockedX).toBe(false);
  });

  it('keeps the vertical component when only the horizontal one is blocked', () => {
    const r = resolveMove(mask, 3, 0, 6, 3);
    expect(r.blockedX).toBe(true);   // native (2,0) and (2,1) are both blocked
    expect(r.y).toBe(3);
  });

  it('never moves out of a blocked start position into another blocked one', () => {
    const r = resolveMove(mask, 3, 0, 6, 0);
    expect(r).toMatchObject({ x: 3, y: 0, blockedX: true });
  });
});
