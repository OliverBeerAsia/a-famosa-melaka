/**
 * Pure clock maths for the world clock.
 *
 * Zero Phaser, zero stores, zero side effects — every function here is a
 * total function of its arguments, which is what makes the day/night cycle
 * testable without booting a scene.
 *
 * The engine's authoritative clock is `TimeSystem`, which is a thin stateful
 * wrapper around these functions.
 */

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** Time ranges (24-hour clock). Night wraps past midnight. */
export const TIME_RANGES = {
  dawn: { start: 5, end: 7 },
  day: { start: 7, end: 17 },
  dusk: { start: 17, end: 20 },
  night: { start: 20, end: 5 },
} as const;

/** Human-readable phase names, as shown in the time notification. */
export const TIME_PHASE_NAMES: Record<TimeOfDay, string> = {
  dawn: 'Dawn',
  day: 'Day',
  dusk: 'Golden Hour',
  night: 'Night',
};

/** Wrap any hour (including negatives) into [0, 24). */
export function normalizeHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

/**
 * Which phase of day an hour belongs to.
 *
 * Boundaries are half-open on the start: 07:00 is `day`, 16:59 is still `day`,
 * 17:00 is `dusk`. Anything not covered by dawn/day/dusk is night, which is how
 * the wrap past midnight is handled without a special case.
 */
export function resolveTimeOfDay(hour: number): TimeOfDay {
  const h = normalizeHour(hour);
  if (h >= TIME_RANGES.dawn.start && h < TIME_RANGES.dawn.end) return 'dawn';
  if (h >= TIME_RANGES.day.start && h < TIME_RANGES.dusk.start) return 'day';
  if (h >= TIME_RANGES.dusk.start && h < TIME_RANGES.night.start) return 'dusk';
  return 'night';
}

/** True when the phase is one the world lights itself for. */
export function isDarkPhase(phase: TimeOfDay): boolean {
  return phase === 'night' || phase === 'dusk';
}

export interface HourAdvance {
  hour: number;
  /** Whole days crossed; negative when the clock is wound backwards. */
  dayDelta: number;
}

/**
 * Advance (or rewind) the hour hand, reporting how many midnights were crossed.
 *
 * `Math.floor` on the raw hour is what makes rewinding past midnight report
 * -1 rather than 0 — the day counter is clamped to >= 1 by the caller.
 */
export function advanceHour(hour: number, delta: number): HourAdvance {
  const raw = hour + delta;
  return { hour: normalizeHour(raw), dayDelta: Math.floor(raw / 24) };
}

export interface MinuteAdvance {
  minute: number;
  /** Whole hours crossed by this minute advance. */
  hourDelta: number;
}

/** Advance the minute hand, reporting whole hours crossed. */
export function advanceMinute(minute: number, delta: number): MinuteAdvance {
  const raw = minute + delta;
  return { minute: ((raw % 60) + 60) % 60, hourDelta: Math.floor(raw / 60) };
}

/**
 * Hours of sleep needed to reach `targetHour` from `fromHour`.
 *
 * Resting at exactly the target hour sleeps a full day round rather than
 * being a no-op — "rest until noon" at noon means tomorrow noon.
 */
export function hoursUntil(fromHour: number, targetHour: number): number {
  const diff = (normalizeHour(targetHour) - normalizeHour(fromHour) + 24) % 24;
  return diff === 0 ? 24 : diff;
}

/** `9:05` — hour unpadded, minute zero-padded, as the HUD has always shown it. */
export function formatClock(hour: number, minute: number): string {
  return `${normalizeHour(hour)}:${Math.floor(minute).toString().padStart(2, '0')}`;
}

/**
 * Does `hour` fall inside a schedule slot?
 *
 * A slot whose start equals its end is an all-day slot (that is how the NPC
 * data expresses "always"); a slot whose end is before its start wraps past
 * midnight (a night watchman's 20->05).
 */
export function isHourInScheduleRange(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}
