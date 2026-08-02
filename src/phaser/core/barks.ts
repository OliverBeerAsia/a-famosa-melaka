/**
 * barks — choosing what an ambient resident says, and when.
 *
 * A resident is not a dialogue partner. They have five lines, they say one when
 * the player comes near, and the rules that keep that from grating are all
 * small and all worth testing:
 *
 *  - a per-resident cooldown, so walking past does not machine-gun them,
 *  - never the same line twice running,
 *  - the set reshuffled once per in-game DAY rather than per utterance, so a
 *    resident has an order they work through — which reads as a person with
 *    things on their mind rather than a random line generator,
 *  - and a reactive set that REPLACES the neutral one while a world flag holds,
 *    which is the cheapest reactivity in the project: about thirty words per
 *    location makes the whole city notice the quest.
 *
 * Pure — no Phaser, no stores.
 */

export interface FlagClause {
  worldFlagsAny?: string[];
  worldFlagsAll?: string[];
  worldFlagsNone?: string[];
}

export interface ReactiveBarkSet {
  when: FlagClause;
  barks: string[];
}

export interface BarkSets {
  barks: string[];
  nightBarks?: string[];
  reactiveBarks?: ReactiveBarkSet[];
}

/** Does a flag clause hold against the world flag table? */
export function clauseHolds(clause: FlagClause | undefined, flags: Record<string, boolean>): boolean {
  if (!clause) return true;
  if (clause.worldFlagsAll?.length && !clause.worldFlagsAll.every((f) => Boolean(flags[f]))) return false;
  if (clause.worldFlagsAny?.length && !clause.worldFlagsAny.some((f) => Boolean(flags[f]))) return false;
  if (clause.worldFlagsNone?.length && clause.worldFlagsNone.some((f) => Boolean(flags[f]))) return false;
  return true;
}

/**
 * Which set of lines is live right now.
 *
 * Reactive beats night beats neutral: a resident who has something to say about
 * the theft says it whatever the hour. The FIRST matching reactive set wins, in
 * authoring order, so overlapping flags are a deterministic authoring decision.
 */
export function activeBarkSet(
  sets: BarkSets,
  flags: Record<string, boolean>,
  isNight: boolean,
): string[] {
  const reactive = sets.reactiveBarks?.find((set) => set.barks.length > 0 && clauseHolds(set.when, flags));
  if (reactive) return reactive.barks;
  if (isNight && sets.nightBarks?.length) return sets.nightBarks;
  return sets.barks;
}

/**
 * A small deterministic hash. Two residents on the same day must not walk
 * through their lines in lockstep, and the same resident on the same day must
 * pick up where they left off across a reload — so the shuffle is seeded by
 * (id, day) rather than by Math.random.
 */
export function hashSeed(text: string, day: number): number {
  let h = 2166136261 ^ day;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** xorshift32 — enough randomness for shuffling five strings, and repeatable. */
function nextRandom(state: number): number {
  let x = state || 1;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17;
  x ^= x << 5; x >>>= 0;
  return x >>> 0;
}

/**
 * A deterministic order over `length` items, reshuffled each in-game day.
 *
 * Fisher-Yates driven by the seeded PRNG, so the same (id, day) always gives
 * the same order and two different residents give different ones.
 */
export function buildBarkOrder(length: number, id: string, day: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  let state = hashSeed(id, day) || 1;
  for (let i = length - 1; i > 0; i--) {
    state = nextRandom(state);
    const j = state % (i + 1);
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  return order;
}

export interface BarkCursor {
  /** Which in-game day the current order was built for. */
  day: number;
  /** Position in that order. */
  index: number;
  /** The line said last, so it is never repeated back to back. */
  lastText: string | null;
  /** Scene clock reading (ms) of the last utterance. */
  lastAt: number;
}

export const BARK_COOLDOWN_MS = 30000;
/** Proximity trigger, NATIVE px. The spec's figure; scaled by the caller. */
export const BARK_RADIUS_NATIVE = 56;

export interface BarkPick {
  text: string;
  cursor: BarkCursor;
}

/**
 * Pick the next line, or null if the resident should stay quiet.
 *
 * `force` bypasses the cooldown — that is the "or on interact" half of the
 * trigger, because a player who deliberately walks up and presses Space has
 * earned a line even if one was just said.
 */
export function pickBark(
  id: string,
  sets: BarkSets,
  flags: Record<string, boolean>,
  isNight: boolean,
  day: number,
  now: number,
  cursor: BarkCursor,
  force = false,
): BarkPick | null {
  const lines = activeBarkSet(sets, flags, isNight);
  if (!lines.length) return null;
  if (!force && now - cursor.lastAt < BARK_COOLDOWN_MS) return null;

  let next: BarkCursor = cursor.day === day
    ? { ...cursor }
    : { ...cursor, day, index: 0 };

  const order = buildBarkOrder(lines.length, id, day);
  let text = lines[order[next.index % order.length]];

  // Never the same line twice running — step once more if the shuffle wrapped
  // onto the line we just said. One step is enough: two identical lines cannot
  // be adjacent in a permutation of distinct indices unless there is only one.
  if (lines.length > 1 && text === next.lastText) {
    next.index += 1;
    text = lines[order[next.index % order.length]];
  }

  next.index += 1;
  next.lastText = text;
  next.lastAt = now;
  return { text, cursor: next };
}

/** A fresh cursor for a resident that has never spoken. */
export function newBarkCursor(): BarkCursor {
  return { day: -1, index: 0, lastText: null, lastAt: -BARK_COOLDOWN_MS };
}

/**
 * Is a resident on stage at this hour?
 *
 * `[start, end)` wrapping past midnight, and `[0, 24]` (or any full-day range)
 * meaning always — which is how the A Famosa gate sentry is authored, and a
 * fortress gate with nobody on it at 03:00 is the single loudest thing wrong
 * with the night city.
 */
export function residentOnStage(hours: [number, number] | undefined, hour: number): boolean {
  if (!hours) return true;
  const [start, end] = hours;
  if (start === end) return true;
  if (end - start >= 24) return true;
  const h = ((hour % 24) + 24) % 24;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end;
}
