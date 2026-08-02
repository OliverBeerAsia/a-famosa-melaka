/**
 * pathfind — A* over the walk mask.
 *
 * Stage 5 walks the cast between schedule stations, and "walk" on a painted
 * plate means "cross the walkable pixels without clipping a wall". The mask is
 * already the authority for the player's collision (see core/WalkMask); this
 * module makes it queryable as a graph.
 *
 * Three deliberate choices:
 *
 *  - **The grid is the NATIVE plate, not the world.** A 640x360 plate is 230k
 *    cells, which A* crosses in a few ms; the same search at world resolution
 *    would be 2M cells and nine times the work for no extra precision, because
 *    the mask has no detail below a native pixel anyway.
 *  - **8-directional, with corner-cutting refused.** A diagonal step is only
 *    legal when BOTH orthogonal neighbours it squeezes past are clear, so a
 *    character never slips through the diagonal gap between two crates.
 *  - **Paths are string-pulled.** Raw A* output is a staircase of single-pixel
 *    steps; walking it produces a visible zigzag. The pull keeps only the
 *    corners a straight line cannot see past, which is what turns the result
 *    into the two or three legs a person would actually walk.
 *
 * Everything here is pure — no Phaser, no scene — so it is unit-testable and
 * can run against a synthetic mask.
 */

export interface Point { x: number; y: number }

/**
 * The slice of `WalkMask` the search needs. Declared structurally so tests can
 * hand in a fake and so nothing here depends on the class.
 */
export interface WalkQuery {
  /** Native mask width in cells. */
  readonly width: number;
  /** Native mask height in cells. */
  readonly height: number;
  /** World px per native px. */
  readonly scale: number;
  /** Can a body of `halfWidth` WORLD px stand centred on this WORLD point? */
  canStand(worldX: number, worldY: number, halfWidth?: number): boolean;
}

export interface PathfindOptions {
  /** Half the character's body width in WORLD px. Default 0 (a point). */
  halfWidth?: number;
  /**
   * Vertical offset in WORLD px from the sprite origin to the feet, since the
   * mask is a floor and the origin is not on it. Default 0.
   */
  footOffset?: number;
  /** Give up after this many expanded nodes. Default 40000. */
  maxNodes?: number;
  /**
   * How far (native px) the search may drift to find a walkable stand-in when
   * the start or the goal is itself blocked. Default 24.
   */
  snapRadius?: number;
  /** Skip the string-pull and return the raw cell path. Default false. */
  raw?: boolean;
}

export interface PathResult {
  /** Waypoints in WORLD px, origin-space (footOffset already removed). */
  points: Point[];
  /** True when the goal itself was reached; false when only a near-miss was. */
  exact: boolean;
  /** Nodes expanded, for budgeting and tests. */
  nodes: number;
}

/** Octile distance: the true cost lower bound on an 8-connected grid. */
export function octile(dx: number, dy: number): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return ax > ay ? ax + (Math.SQRT2 - 1) * ay : ay + (Math.SQRT2 - 1) * ax;
}

const SQRT2 = Math.SQRT2;
/** dx, dy, cost — orthogonals first so ties prefer straight lines. */
const NEIGHBOURS: Array<[number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/**
 * A binary min-heap keyed by f-score.
 *
 * Phaser has no priority queue and a sorted array turns a 200-step path into
 * an O(n^2) insert storm; this keeps the open set at O(log n) per push/pop,
 * which is the difference between a 3 ms search and a dropped frame.
 */
class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];

  get size(): number { return this.items.length; }

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.keys.length && this.keys[l] < this.keys[smallest]) smallest = l;
        if (r < this.keys.length && this.keys[r] < this.keys[smallest]) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const ti = this.items[a]; this.items[a] = this.items[b]; this.items[b] = ti;
    const tk = this.keys[a]; this.keys[a] = this.keys[b]; this.keys[b] = tk;
  }
}

/** Walkability of a native cell for a body of `halfWidth` world px. */
function cellOpen(mask: WalkQuery, cx: number, cy: number, halfWidth: number): boolean {
  if (cx < 0 || cy < 0 || cx >= mask.width || cy >= mask.height) return false;
  // Sample the middle of the cell so a body that exactly straddles a boundary
  // does not depend on the floor() rounding at the edge.
  const s = mask.scale;
  return mask.canStand(cx * s + s / 2, cy * s + s / 2, halfWidth);
}

/**
 * Nearest open cell to (cx, cy), searched in expanding square rings.
 * Mirrors `WalkMask.nearestWalkable` but stays in cell space.
 */
function snapToOpen(
  mask: WalkQuery, cx: number, cy: number, halfWidth: number, radius: number,
): { x: number; y: number } | null {
  if (cellOpen(mask, cx, cy, halfWidth)) return { x: cx, y: cy };
  for (let r = 1; r <= radius; r++) {
    let best: { x: number; y: number; d2: number } | null = null;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!cellOpen(mask, cx + dx, cy + dy, halfWidth)) continue;
        const d2 = dx * dx + dy * dy;
        if (!best || d2 < best.d2) best = { x: cx + dx, y: cy + dy, d2 };
      }
    }
    if (best) return { x: best.x, y: best.y };
  }
  return null;
}

/**
 * Is the straight segment between two cells entirely open?
 *
 * Supercover DDA rather than plain Bresenham: a diagonal that only touches a
 * cell corner still counts as entering it, so the string-pull cannot produce a
 * leg that shaves a wall the raw path respected.
 */
export function lineOpen(
  mask: WalkQuery, ax: number, ay: number, bx: number, by: number, halfWidth: number,
): boolean {
  let x = ax;
  let y = ay;
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx - dy;

  if (!cellOpen(mask, x, y, halfWidth)) return false;
  let guard = dx + dy + 2;
  while ((x !== bx || y !== by) && guard-- > 0) {
    const e2 = 2 * err;
    if (e2 > -dy && e2 < dx) {
      // A true diagonal step: both orthogonal neighbours must also be open, or
      // the line squeezes through a corner the walker cannot.
      if (!cellOpen(mask, x + sx, y, halfWidth) || !cellOpen(mask, x, y + sy, halfWidth)) return false;
      x += sx;
      y += sy;
      err += dx - dy;
    } else if (e2 > -dy) {
      x += sx;
      err -= dy;
    } else {
      y += sy;
      err += dx;
    }
    if (!cellOpen(mask, x, y, halfWidth)) return false;
  }
  return true;
}

/**
 * Drop every waypoint a straight line can see past.
 *
 * Greedy from the start: keep extending the current leg while the segment to
 * the candidate is clear, and commit a corner only when it is not. On an open
 * street this collapses a 300-cell staircase to two points.
 */
export function stringPull(
  mask: WalkQuery, cells: Point[], halfWidth: number,
): Point[] {
  if (cells.length <= 2) return cells.slice();
  const out: Point[] = [cells[0]];
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    if (!lineOpen(mask, cells[anchor].x, cells[anchor].y, cells[i].x, cells[i].y, halfWidth)) {
      out.push(cells[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(cells[cells.length - 1]);
  return out;
}

/**
 * Find a walkable route between two WORLD-space points.
 *
 * Both ends are given in sprite-ORIGIN space; `footOffset` is added before
 * sampling and removed from the result, so callers pass and receive the same
 * coordinates they use everywhere else.
 *
 * Returns null when no route exists at all. When the goal is unreachable but a
 * near cell is, the closest-approach path is returned with `exact: false` —
 * an NPC who cannot quite reach the doorway should still walk to the doorway,
 * not stand still forever.
 */
export function findPath(
  mask: WalkQuery,
  from: Point,
  to: Point,
  options: PathfindOptions = {},
): PathResult | null {
  const halfWidth = options.halfWidth ?? 0;
  const footOffset = options.footOffset ?? 0;
  const maxNodes = options.maxNodes ?? 40000;
  const snapRadius = options.snapRadius ?? 24;

  const s = mask.scale;
  const toCell = (p: Point) => ({
    x: Math.floor(p.x / s),
    y: Math.floor((p.y + footOffset) / s),
  });

  const startRaw = toCell(from);
  const goalRaw = toCell(to);

  const start = snapToOpen(mask, startRaw.x, startRaw.y, halfWidth, snapRadius);
  const goal = snapToOpen(mask, goalRaw.x, goalRaw.y, halfWidth, snapRadius);
  if (!start || !goal) return null;

  const W = mask.width;
  const H = mask.height;
  const index = (x: number, y: number) => y * W + x;
  const startIdx = index(start.x, start.y);
  const goalIdx = index(goal.x, goal.y);

  const toWorld = (cell: Point): Point => ({
    x: cell.x * s + s / 2,
    y: cell.y * s + s / 2 - footOffset,
  });

  if (startIdx === goalIdx) {
    return { points: [toWorld(goal)], exact: true, nodes: 0 };
  }

  // Flat typed arrays rather than Maps: a 230k-cell plate allocates 2.7 MB
  // once and indexes in O(1), where a Map of that size spends most of the
  // search in hashing.
  const gScore = new Float32Array(W * H).fill(Infinity);
  const cameFrom = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);

  const open = new MinHeap();
  gScore[startIdx] = 0;
  open.push(startIdx, octile(goal.x - start.x, goal.y - start.y));

  let nodes = 0;
  let best = startIdx;
  let bestH = octile(goal.x - start.x, goal.y - start.y);
  let found = false;

  while (open.size > 0 && nodes < maxNodes) {
    const current = open.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    nodes++;

    if (current === goalIdx) { found = true; break; }

    const cx = current % W;
    const cy = (current - cx) / W;

    const h = octile(goal.x - cx, goal.y - cy);
    if (h < bestH) { bestH = h; best = current; }

    for (const [dx, dy, cost] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nIdx = index(nx, ny);
      if (closed[nIdx]) continue;
      if (!cellOpen(mask, nx, ny, halfWidth)) continue;
      // No corner cutting: a diagonal needs both of its orthogonal shoulders.
      if (dx !== 0 && dy !== 0) {
        if (!cellOpen(mask, cx + dx, cy, halfWidth)) continue;
        if (!cellOpen(mask, cx, cy + dy, halfWidth)) continue;
      }
      const tentative = gScore[current] + cost;
      if (tentative >= gScore[nIdx]) continue;
      gScore[nIdx] = tentative;
      cameFrom[nIdx] = current;
      open.push(nIdx, tentative + octile(goal.x - nx, goal.y - ny));
    }
  }

  const endIdx = found ? goalIdx : best;
  if (endIdx === startIdx && !found) return null;

  // Walk the parent chain back and reverse it.
  const cells: Point[] = [];
  let cursor = endIdx;
  let guard = W * H;
  while (cursor !== -1 && guard-- > 0) {
    const x = cursor % W;
    cells.push({ x, y: (cursor - x) / W });
    if (cursor === startIdx) break;
    cursor = cameFrom[cursor];
  }
  cells.reverse();

  const simplified = options.raw ? cells : stringPull(mask, cells, halfWidth);
  return {
    points: simplified.map(toWorld),
    exact: found,
    nodes,
  };
}

/**
 * Route through a list of authored waypoint HINTS.
 *
 * The schedule data gives hints, not paths: "go down the middle of the street,
 * then along the quay edge". Each consecutive pair is pathfound independently
 * and the results are concatenated, so the line stays readable while A* still
 * guarantees every step is walkable. A hint that cannot be reached is dropped
 * rather than clamped, per the spec's rule for failed hints.
 */
export function findPathVia(
  mask: WalkQuery,
  from: Point,
  hints: Point[],
  to: Point,
  options: PathfindOptions = {},
): PathResult | null {
  const stops = [...hints, to];
  const points: Point[] = [];
  let cursor = from;
  let nodes = 0;
  let exact = true;
  let any = false;

  for (let i = 0; i < stops.length; i++) {
    const leg = findPath(mask, cursor, stops[i], options);
    if (!leg) {
      // A hint we cannot reach is skipped; the destination is not.
      if (i < stops.length - 1) continue;
      exact = false;
      break;
    }
    nodes += leg.nodes;
    any = true;
    if (i === stops.length - 1) exact = leg.exact;
    // The first point of every leg is where we already are.
    for (let p = points.length === 0 ? 0 : 1; p < leg.points.length; p++) {
      points.push(leg.points[p]);
    }
    cursor = leg.points[leg.points.length - 1] ?? cursor;
  }

  if (!any || points.length === 0) return null;
  return { points, exact, nodes };
}
