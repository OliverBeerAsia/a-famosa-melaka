import { describe, it, expect } from 'vitest';
import { WalkMask } from './WalkMask';
import { findPath, findPathVia, lineOpen, octile, stringPull } from './pathfind';

/**
 * Build a mask from an ASCII map. '.' walkable, '#' blocked.
 * One character per NATIVE cell; `scale` world px per cell.
 */
function maskFromAscii(rows: string[], scale = 3): WalkMask {
  const height = rows.length;
  const width = rows[0].length;
  const walkable = new Uint8Array(width * height);
  const surface = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    expect(row.length).toBe(width);
    for (let x = 0; x < width; x++) {
      walkable[y * width + x] = row[x] === '#' ? 0 : 1;
      surface[y * width + x] = 1;
    }
  });
  return new WalkMask({ width, height, walkable, surface }, scale);
}

/** Native cell coordinates of a world-space waypoint. */
const cellsOf = (points: Array<{ x: number; y: number }>, scale = 3) =>
  points.map((p) => ({ x: Math.floor(p.x / scale), y: Math.floor(p.y / scale) }));

/** Every consecutive pair walkable in a straight line? */
function legsAreClear(mask: WalkMask, points: Array<{ x: number; y: number }>, scale = 3) {
  const cells = cellsOf(points, scale);
  for (let i = 1; i < cells.length; i++) {
    if (!lineOpen(mask, cells[i - 1].x, cells[i - 1].y, cells[i].x, cells[i].y, 0)) return false;
  }
  return true;
}

describe('octile', () => {
  it('is the straight-line cost on an axis', () => {
    expect(octile(5, 0)).toBe(5);
    expect(octile(0, -4)).toBe(4);
  });

  it('charges sqrt(2) for the diagonal part', () => {
    expect(octile(3, 3)).toBeCloseTo(3 * Math.SQRT2, 6);
  });

  it('never exceeds the true 8-connected cost', () => {
    // 4 diagonals + 2 straights
    expect(octile(6, 4)).toBeCloseTo(2 + 4 * Math.SQRT2, 6);
  });
});

describe('findPath', () => {
  const open = maskFromAscii([
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
  ]);

  it('returns a two-point path across empty ground', () => {
    const path = findPath(open, { x: 3, y: 3 }, { x: 27, y: 12 });
    expect(path).not.toBeNull();
    expect(path!.exact).toBe(true);
    // String-pulled: no corner is needed on open ground.
    expect(path!.points.length).toBe(2);
  });

  it('ends on the goal cell', () => {
    const path = findPath(open, { x: 3, y: 3 }, { x: 27, y: 12 })!;
    const last = path.points[path.points.length - 1];
    expect(Math.floor(last.x / 3)).toBe(9);
    expect(Math.floor(last.y / 3)).toBe(4);
  });

  it('routes around a wall and every leg stays walkable', () => {
    const mask = maskFromAscii([
      '..........',
      '....#.....',
      '....#.....',
      '....#.....',
      '..........',
    ]);
    const path = findPath(mask, { x: 3, y: 3 }, { x: 24, y: 6 })!;
    expect(path).not.toBeNull();
    expect(path.exact).toBe(true);
    expect(path.points.length).toBeGreaterThan(2);
    expect(legsAreClear(mask, path.points)).toBe(true);
  });

  it('refuses to cut a diagonal corner between two blocks', () => {
    // The only "route" from top-left to bottom-right squeezes the corner at
    // (1,1)/(2,2). An 8-dir search that cuts corners would report a path.
    const mask = maskFromAscii([
      '...#',
      '...#',
      '###.',
      '....',
    ]);
    const path = findPath(mask, { x: 1, y: 1 }, { x: 10, y: 10 });
    // No legal route exists; A* falls back to closest approach, never exact.
    expect(path === null || path.exact === false).toBe(true);
  });

  it('returns null when start and goal are both walled in', () => {
    const mask = maskFromAscii([
      '#####',
      '#####',
      '#####',
    ]);
    expect(findPath(mask, { x: 3, y: 3 }, { x: 9, y: 3 }, { snapRadius: 1 })).toBeNull();
  });

  it('snaps a blocked start onto the nearest open cell', () => {
    const mask = maskFromAscii([
      '.....',
      '..#..',
      '.....',
    ]);
    // Start inside the block: still finds a route out.
    const path = findPath(mask, { x: 7, y: 4 }, { x: 12, y: 7 });
    expect(path).not.toBeNull();
    expect(path!.exact).toBe(true);
  });

  it('reports closest approach when the goal is enclosed', () => {
    const mask = maskFromAscii([
      '.......',
      '.#####.',
      '.#...#.',
      '.#####.',
      '.......',
    ]);
    const path = findPath(mask, { x: 1, y: 1 }, { x: 10, y: 7 }, { snapRadius: 0 });
    expect(path).not.toBeNull();
    expect(path!.exact).toBe(false);
  });

  it('honours the node budget instead of hanging', () => {
    const path = findPath(open, { x: 3, y: 3 }, { x: 27, y: 12 }, { maxNodes: 3 });
    expect(path).not.toBeNull();
    expect(path!.nodes).toBeLessThanOrEqual(3);
    expect(path!.exact).toBe(false);
  });

  it('applies footOffset when sampling and removes it from the result', () => {
    // Row 0 is blocked, row 1 is open. With a 3px foot offset a point at y=0
    // has its FEET at y=3, i.e. in the open row, so the path is legal.
    const mask = maskFromAscii([
      '#####',
      '.....',
      '.....',
    ]);
    const path = findPath(mask, { x: 1, y: 0 }, { x: 12, y: 0 }, { footOffset: 3 });
    expect(path).not.toBeNull();
    expect(path!.exact).toBe(true);
    // Returned in origin space: y is one row above the walkable row it used.
    expect(path!.points[0].y).toBeLessThan(3);
  });

  it('respects a body half-width', () => {
    // A one-cell-wide corridor: a point can pass, a 3-world-px half-width cannot.
    const mask = maskFromAscii([
      '..#..',
      '..#..',
      '.....',
      '..#..',
      '..#..',
    ]);
    const thin = findPath(mask, { x: 1, y: 1 }, { x: 13, y: 1 }, { halfWidth: 0 });
    expect(thin!.exact).toBe(true);
    const wide = findPath(mask, { x: 1, y: 1 }, { x: 13, y: 1 }, { halfWidth: 3, snapRadius: 0 });
    expect(wide === null || wide.exact === false).toBe(true);
  });
});

describe('stringPull', () => {
  it('collapses a straight staircase to its two ends', () => {
    const mask = maskFromAscii(['.....', '.....', '.....']);
    const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    expect(stringPull(mask, cells, 0)).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
  });

  it('keeps the corner a wall forces', () => {
    const mask = maskFromAscii([
      '..#..',
      '..#..',
      '.....',
    ]);
    const cells = [
      { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 },
      { x: 3, y: 2 }, { x: 4, y: 1 }, { x: 4, y: 0 },
    ];
    const pulled = stringPull(mask, cells, 0);
    expect(pulled.length).toBeGreaterThan(2);
    expect(pulled.length).toBeLessThan(cells.length);
    expect(pulled[0]).toEqual(cells[0]);
    expect(pulled[pulled.length - 1]).toEqual(cells[cells.length - 1]);
  });

  it('leaves a two-point path alone', () => {
    const mask = maskFromAscii(['..', '..']);
    const cells = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(stringPull(mask, cells, 0)).toEqual(cells);
  });
});

describe('findPathVia', () => {
  const mask = maskFromAscii([
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
  ]);

  it('bends the route through its hints', () => {
    const direct = findPath(mask, { x: 1, y: 1 }, { x: 28, y: 1 })!;
    const viaHint = findPathVia(mask, { x: 1, y: 1 }, [{ x: 14, y: 13 }], { x: 28, y: 1 })!;
    expect(direct.points.length).toBe(2);
    // The hint forces a corner the direct line does not have.
    expect(viaHint.points.length).toBeGreaterThan(direct.points.length);
    const cells = cellsOf(viaHint.points);
    expect(cells.some((c) => c.y >= 4)).toBe(true);
  });

  it('drops an unreachable hint rather than failing the walk', () => {
    const walled = maskFromAscii([
      '.....',
      '.....',
      '#####',
      '.....',
    ]);
    // The hint is on the far side of a full-width wall; the goal is not.
    const path = findPathVia(walled, { x: 1, y: 1 }, [{ x: 7, y: 10 }], { x: 13, y: 1 }, { snapRadius: 0 });
    expect(path).not.toBeNull();
    expect(path!.exact).toBe(true);
  });

  it('does not repeat the joint between two legs', () => {
    const path = findPathVia(mask, { x: 1, y: 1 }, [{ x: 14, y: 13 }], { x: 28, y: 1 })!;
    for (let i = 1; i < path.points.length; i++) {
      expect(path.points[i]).not.toEqual(path.points[i - 1]);
    }
  });
});
