/**
 * Pure interaction targeting.
 *
 * Deciding what "[Space]" acts on is the single most-felt piece of maths in the
 * game — get it wrong and the player talks to a barrel instead of the merchant
 * standing in front of them. It is therefore expressed here as plain functions
 * over plain numbers: no Phaser, no display objects, no scene.
 *
 * The rule, in order:
 *  1. anything past the candidate's own reach is out,
 *  2. anything meaningfully BEHIND the player is out unless it is almost
 *     touching them (you cannot examine what you have your back to),
 *  3. what is left is ranked by `priority` first — an NPC always beats the
 *     scenery they are standing next to — and only then by `score`, which is
 *     distance biased toward whatever the player is facing.
 *
 * Lower score wins (it is a distance, not a rating).
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export type InteractionTargetType =
  | 'npc' | 'item' | 'quest' | 'transition' | 'lore' | 'scenery';

/** Reach, in world px, for each kind of target. */
export const INTERACTION_RADIUS: Record<InteractionTargetType, number> = {
  npc: 90,
  item: 86,
  transition: 96,
  lore: 82,
  // Painted scenery gets the tightest reach of anything: it must never shadow
  // a person, a pickup, a lore object or an exit.
  scenery: 56,
  // Quest hotspots declare their own radius; this is only the default.
  quest: 78,
};

/**
 * Priority band per target type. Lower wins outright, before score is even
 * compared. Transitions are special-cased by the caller (standing inside an
 * exit trigger promotes it), so their entry here is the "walk toward it" case.
 */
export const INTERACTION_PRIORITY: Record<InteractionTargetType, number> = {
  npc: 0,
  item: 1,
  quest: 1,
  lore: 2,
  transition: 3,
  scenery: 4,
};

/** How strongly facing the target pulls it up the ranking. */
export const FACING_BIAS = 28;
/** Bonus for a target already within arm's reach. */
export const CLOSE_BONUS = 14;
/** Distance under which the close bonus applies. */
export const CLOSE_DISTANCE = 52;
/**
 * Alignment below which a target counts as "behind" the player.
 * -1 is directly behind, +1 directly ahead.
 */
export const BEHIND_ALIGNMENT = -0.35;
/** Targets closer than this are reachable even when behind the player. */
export const BEHIND_GRACE_DISTANCE = 44;

export interface Vec2 { x: number; y: number }

/** Unit vector for a facing direction. Screen space, so +y is down. */
export function facingVector(facing: Direction | string | undefined): Vec2 {
  switch (facing) {
    case 'up': return { x: 0, y: -1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    case 'down':
    default: return { x: 0, y: 1 };
  }
}

/** The cardinal direction from one point to another; ties resolve vertically. */
export function directionBetween(fromX: number, fromY: number, toX: number, toY: number): Direction {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

export interface ScoredTarget {
  distance: number;
  /** Lower is better. */
  score: number;
}

/**
 * Score a candidate at (x, y) for a player at (playerX, playerY) facing
 * `facing`. Returns null when the candidate is unreachable.
 */
export function scoreInteractionTarget(
  playerX: number,
  playerY: number,
  facing: Direction | string | undefined,
  x: number,
  y: number,
  maxDistance: number,
): ScoredTarget | null {
  const dx = x - playerX;
  const dy = y - playerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > maxDistance) return null;

  // Standing exactly on the target: no direction to speak of, best possible score.
  if (dx === 0 && dy === 0) return { distance, score: 0 };

  const inv = 1 / distance;
  const face = facingVector(facing);
  const alignment = (dx * inv) * face.x + (dy * inv) * face.y;
  if (alignment < BEHIND_ALIGNMENT && distance > BEHIND_GRACE_DISTANCE) return null;

  const clamped = Math.max(-1, Math.min(1, alignment));
  const facingBias = clamped * FACING_BIAS;
  const closeBonus = distance < CLOSE_DISTANCE ? CLOSE_BONUS : 0;

  return { distance, score: distance - facingBias - closeBonus };
}

export interface RankableCandidate {
  priority: number;
  score: number;
}

/**
 * Rank candidates: priority band first, then score within the band.
 * Stable for equal keys, so declaration order breaks exact ties.
 */
export function rankCandidates<T extends RankableCandidate>(candidates: T[]): T[] {
  return [...candidates].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    return left.score - right.score;
  });
}

/** The winning candidate, or null when nothing is in reach. */
export function pickBestCandidate<T extends RankableCandidate>(candidates: T[]): T | null {
  return rankCandidates(candidates)[0] ?? null;
}

/** Is a point inside an axis-aligned rectangle? */
export function rectContains(
  rect: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
): boolean {
  return x >= rect.x && x <= rect.x + rect.width
    && y >= rect.y && y <= rect.y + rect.height;
}
