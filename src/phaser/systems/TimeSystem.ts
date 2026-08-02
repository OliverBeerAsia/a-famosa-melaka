/**
 * TimeSystem — the world clock.
 *
 * Owns hour/minute/day and the derived phase of day, and nothing else: it has
 * no Phaser imports and touches no stores, so it can be ticked in a unit test.
 * Everything the rest of the engine does when the clock moves (relighting the
 * plate, re-spawning scheduled NPCs, crossfading the music) is expressed as a
 * handler the scene supplies at construction.
 *
 * The scene calls `update(deltaMs)` once a frame while the world is running;
 * one game minute passes every `tickMs` of real time.
 */

import {
  advanceHour,
  advanceMinute,
  resolveTimeOfDay,
  type TimeOfDay,
} from '../core/timeMath';

/** 1 game minute per 2.5 real seconds. */
export const CLOCK_TICK_MS = 2500;

export interface TimeSnapshot {
  hour: number;
  minute: number;
  day: number;
  phase: TimeOfDay;
}

export interface TimeSystemHandlers {
  /**
   * The phase of day changed. Fired BEFORE `onTimeChanged`, mirroring the
   * original ordering where lighting/audio/particles were re-applied before
   * the store was told the new time.
   */
  onPhaseChanged?: (phase: TimeOfDay, previous: TimeOfDay, animate: boolean) => void;
  /** Hour and/or minute moved. Carries the full snapshot. */
  onTimeChanged?: (snapshot: TimeSnapshot, movedHours: boolean) => void;
  /** One or more midnights were crossed. */
  onDayPassed?: (dayDelta: number, day: number) => void;
  /** An explicit hour advance finished (rest, debug key, quest skip). */
  onHoursAdvanced?: (snapshot: TimeSnapshot) => void;
}

export class TimeSystem {
  private hour: number;
  private minute: number;
  private day: number;
  private phase: TimeOfDay;
  private accumulator = 0;
  private readonly tickMs: number;
  private readonly handlers: TimeSystemHandlers;

  /**
   * `init.phase` overrides the phase derived from `init.hour`.
   *
   * The scene uses it to start every location on the neutral 'day' phase and
   * then call `syncPhase()` once the lighting rig exists — that first sync is
   * what crossfades a night arrival from the base plate onto the baked night
   * variant, and skipping it (by deriving the phase up front) would silently
   * change how a scene looks in its first two seconds.
   */
  constructor(
    init: { hour?: number; minute?: number; day?: number; phase?: TimeOfDay },
    handlers: TimeSystemHandlers = {},
    tickMs: number = CLOCK_TICK_MS,
  ) {
    this.hour = init.hour ?? 10;
    this.minute = init.minute ?? 0;
    this.day = init.day ?? 1;
    this.phase = init.phase ?? resolveTimeOfDay(this.hour);
    this.handlers = handlers;
    this.tickMs = tickMs;
  }

  getHour(): number { return this.hour; }
  getMinute(): number { return this.minute; }
  getDay(): number { return this.day; }
  getPhase(): TimeOfDay { return this.phase; }

  snapshot(): TimeSnapshot {
    return { hour: this.hour, minute: this.minute, day: this.day, phase: this.phase };
  }

  /** Set the minute hand without advancing anything (used by the rest flow). */
  setMinute(minute: number) {
    this.minute = minute;
  }

  /**
   * Resolve the phase from the current hour, firing `onPhaseChanged` if it
   * moved. Called on every hour change and once at scene start.
   */
  syncPhase(animate: boolean = true) {
    const next = resolveTimeOfDay(this.hour);
    if (next === this.phase) return;
    const previous = this.phase;
    this.phase = next;
    this.handlers.onPhaseChanged?.(next, previous, animate);
  }

  /**
   * Tick real time forward. Returns true if a game minute elapsed.
   *
   * The accumulator is decremented rather than reset so a long frame does not
   * silently swallow the remainder.
   */
  update(deltaMs: number): boolean {
    this.accumulator += deltaMs;
    if (this.accumulator < this.tickMs) return false;
    this.accumulator -= this.tickMs;
    this.advanceMinutes(1);
    return true;
  }

  /** Advance the minute hand, rolling into hours when it wraps. */
  advanceMinutes(minutes: number) {
    const { minute, hourDelta } = advanceMinute(this.minute, minutes);
    this.minute = minute;
    if (hourDelta > 0) {
      this.advanceHours(hourDelta);
      return;
    }
    this.handlers.onTimeChanged?.(this.snapshot(), false);
  }

  /**
   * Advance (or rewind) whole hours: re-resolves the phase, rolls the day, and
   * reports the result. `animate` is passed through to the phase handler so a
   * fade-to-black rest can apply the new lighting instantly.
   */
  advanceHours(hours: number, animate: boolean = true) {
    const { hour, dayDelta } = advanceHour(this.hour, hours);
    this.hour = hour;
    this.syncPhase(animate);

    const nextDay = Math.max(1, this.day + dayDelta);
    this.day = nextDay;

    this.handlers.onTimeChanged?.(this.snapshot(), true);
    if (dayDelta > 0) this.handlers.onDayPassed?.(dayDelta, nextDay);
    this.handlers.onHoursAdvanced?.(this.snapshot());
  }
}
