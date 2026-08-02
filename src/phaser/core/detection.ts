/**
 * detection — can the night watch see you?
 *
 * The counting-house break-in is the one scene in the demo with a fail state,
 * so its rules have to be legible enough that the player can reason about them
 * and stable enough that a near miss reads as a near miss rather than as noise.
 * Both of those come from the maths being simple and in one place.
 *
 * The model, from the design draft:
 *
 *  - a 64 native px cone, 90 degrees wide, facing the direction of travel (or
 *    the dwell facing) — and the lantern the guard carries IS that cone, drawn
 *    as a real light pool, so the player never has to guess where he is looking,
 *  - a 20 px peripheral radius that ignores the arc entirely,
 *  - and multipliers for what the PLAYER is standing in. Light is the whole
 *    mechanic: the goal is in the light and the road to it is dark.
 *
 * Pure — no Phaser, no scene, no stores.
 */

/** Where the player is standing, as far as being seen is concerned. */
export interface PlayerCover {
  /** Feet inside any nightOnly light pool. */
  inLightPool: boolean;
  /** Feet inside the guard's own carried lantern pool. */
  inGuardLantern: boolean;
  /** Behind a walk-behind foreground overlay: hard cover. */
  occluded: boolean;
  /** Standing still (no input) for longer than the freeze threshold. */
  stationary: boolean;
}

export interface DetectionTuning {
  /** Base cone reach, NATIVE px. */
  visionRangeNative: number;
  /** Full cone width in degrees. */
  visionArcDegrees: number;
  /** Radius inside which the arc does not matter, NATIVE px. */
  peripheralRangeNative: number;
}

export const DEFAULT_DETECTION: DetectionTuning = {
  visionRangeNative: 64,
  visionArcDegrees: 90,
  peripheralRangeNative: 20,
};

/** Standing still this long in shadow earns the freeze bonus. */
export const FREEZE_SECONDS = 1.0;
/** Cumulative seconds in view before the guard turns suspicious. */
export const SUSPICION_SECONDS = 0.35;
/** Cumulative seconds while suspicious before he is alerted. */
export const ALERT_SECONDS = 1.2;
/** Inside this range, in any state, he simply has you. NATIVE px. */
export const POINT_BLANK_NATIVE = 24;

/** Each alert level above 1 sharpens him. Level 3 posts him at the door. */
export const ALERT_LEVEL_VISION_BONUS = 0.2;

export interface RangeMultipliers {
  vision: number;
  peripheral: number;
}

/**
 * How the player's cover scales the guard's reach.
 *
 * Multiplicative and ordered so the strongest fact wins outright: hard
 * occlusion is zero whatever else is true, and being inside his own lantern is
 * 2.0 — there is no walking past him in the dark at arm's length.
 */
export function coverMultipliers(cover: PlayerCover): RangeMultipliers {
  if (cover.occluded) return { vision: 0, peripheral: 0 };
  if (cover.inGuardLantern) return { vision: 2.0, peripheral: 2.0 };
  if (cover.inLightPool) return { vision: 1.6, peripheral: 1.0 };
  // In shadow. Freezing multiplies on top of the shadow case: 0.55 * 0.7.
  if (cover.stationary) return { vision: 0.55 * 0.7, peripheral: 0.7 };
  return { vision: 0.55, peripheral: 1.0 };
}

/** Smallest absolute angle between two headings, in degrees. */
export function angleDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.abs(d);
}

export interface SightQuery {
  guardX: number;
  guardY: number;
  /** Guard heading in DEGREES, 0 = +x (right), 90 = +y (down). */
  guardFacingDeg: number;
  playerX: number;
  playerY: number;
  cover: PlayerCover;
  /** World px per native px. */
  scale: number;
  /** 1, 2 or 3. Above 1 the guard's vision gains 20% per level. */
  alertLevel?: number;
  tuning?: DetectionTuning;
}

export interface SightResult {
  seen: boolean;
  /** Distance guard->player in WORLD px, for telemetry and tests. */
  distance: number;
  /** The effective cone reach after cover, WORLD px. */
  visionRange: number;
  /** The effective peripheral reach after cover, WORLD px. */
  peripheralRange: number;
}

/**
 * Is the player currently visible to the guard?
 *
 * Three ways to be seen, cheapest test first: point blank, peripheral radius,
 * then the cone. Hard occlusion zeroes every reach, so a player behind the bale
 * stack is invisible at any distance — which is free, because the two shipped
 * foreground overlays already have geometry and depth.
 */
export function canSee(query: SightQuery): SightResult {
  const tuning = query.tuning ?? DEFAULT_DETECTION;
  const scale = query.scale;
  const multipliers = coverMultipliers(query.cover);
  const alertBonus = 1 + Math.max(0, (query.alertLevel ?? 1) - 1) * ALERT_LEVEL_VISION_BONUS;

  const visionRange = tuning.visionRangeNative * scale * multipliers.vision * alertBonus;
  const peripheralRange = tuning.peripheralRangeNative * scale * multipliers.peripheral * alertBonus;

  const dx = query.playerX - query.guardX;
  const dy = query.playerY - query.guardY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const result = { seen: false, distance, visionRange, peripheralRange };
  if (query.cover.occluded) return result;

  if (distance <= POINT_BLANK_NATIVE * scale) return { ...result, seen: true };
  if (distance <= peripheralRange) return { ...result, seen: true };
  if (distance > visionRange) return result;

  const bearing = Math.atan2(dy, dx) * (180 / Math.PI);
  const withinArc = angleDelta(bearing, query.guardFacingDeg) <= tuning.visionArcDegrees / 2;
  return { ...result, seen: withinArc };
}

/** Cardinal facing -> heading in degrees, matching `canSee`'s convention. */
export function facingToDegrees(facing: string): number {
  switch (facing) {
    case 'up': return -90;
    case 'down': return 90;
    case 'left': return 180;
    default: return 0;
  }
}

export type WatchState = 'unaware' | 'suspicious' | 'alerted';

export interface AwarenessInput {
  state: WatchState;
  /** Cumulative seconds the player has been visible in the current state. */
  exposure: number;
  seen: boolean;
  /** Seconds since the last frame. */
  dt: number;
  /** A noise event reached him this frame. */
  noise: boolean;
  /** Distance in WORLD px. */
  distance: number;
  scale: number;
  /** Seconds since he last saw or heard anything, while suspicious. */
  calm: number;
}

export interface AwarenessResult {
  state: WatchState;
  exposure: number;
  calm: number;
  /** True on the frame the state moved up, so the caller can telegraph it. */
  escalated: boolean;
}

/**
 * Advance the three-state awareness machine.
 *
 * The important property is that a SUSPICIOUS guard is off his timetable: the
 * 27.8-second unwatched window at the counting-house door is void until he
 * settles back to unaware, so the player has to re-read him rather than
 * re-count. That is enforced by the caller, but this is where the state that
 * causes it lives.
 */
export function stepAwareness(input: AwarenessInput): AwarenessResult {
  const pointBlank = input.seen && input.distance <= POINT_BLANK_NATIVE * input.scale;
  let { state, exposure, calm } = input;
  let escalated = false;

  if (pointBlank && state !== 'alerted') {
    return { state: 'alerted', exposure: 0, calm: 0, escalated: true };
  }

  if (input.seen || input.noise) {
    exposure += input.dt;
    calm = 0;
  } else {
    exposure = Math.max(0, exposure - input.dt * 0.5);
    calm += input.dt;
  }

  if (state === 'unaware' && (exposure >= SUSPICION_SECONDS || input.noise)) {
    state = 'suspicious';
    exposure = 0;
    escalated = true;
  } else if (state === 'suspicious') {
    if (exposure >= ALERT_SECONDS) {
      state = 'alerted';
      exposure = 0;
      escalated = true;
    }
  }

  return { state, exposure, calm, escalated };
}

/** Noise reach in NATIVE px for what the player just did. */
export function noiseRadiusNative(action: {
  running: boolean;
  onWood: boolean;
  moving: boolean;
}): number {
  if (action.running) return 48;
  if (action.moving && action.onWood) return 34;
  return 0;
}

/** One-shot noise events, NATIVE px. */
export const NOISE_OPEN_CONTAINER = 40;
export const NOISE_FAILED_LOCK = 56;
