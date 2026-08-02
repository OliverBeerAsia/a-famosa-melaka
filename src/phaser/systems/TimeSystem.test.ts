import { describe, it, expect, vi } from 'vitest';
import { TimeSystem, CLOCK_TICK_MS, type TimeSnapshot } from './TimeSystem';
import type { TimeOfDay } from '../core/timeMath';

const makeHandlers = () => ({
  onPhaseChanged: vi.fn(),
  onTimeChanged: vi.fn(),
  onDayPassed: vi.fn(),
  onHoursAdvanced: vi.fn(),
});

describe('TimeSystem', () => {
  it('resolves its starting phase from the starting hour', () => {
    expect(new TimeSystem({ hour: 10 }).getPhase()).toBe('day');
    expect(new TimeSystem({ hour: 22 }).getPhase()).toBe('night');
    expect(new TimeSystem({ hour: 6 }).getPhase()).toBe('dawn');
  });

  it('defaults to 10:00 on day 1', () => {
    const clock = new TimeSystem({});
    expect(clock.snapshot()).toEqual({ hour: 10, minute: 0, day: 1, phase: 'day' });
  });

  it('does not fire a phase change for the starting phase', () => {
    const handlers = makeHandlers();
    // eslint-disable-next-line no-new
    new TimeSystem({ hour: 22 }, handlers);
    expect(handlers.onPhaseChanged).not.toHaveBeenCalled();
  });

  it('honours an explicit starting phase and syncs it on demand', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 22, phase: 'day' }, handlers);
    expect(clock.getPhase()).toBe('day');
    clock.syncPhase(false);
    expect(clock.getPhase()).toBe('night');
    expect(handlers.onPhaseChanged).toHaveBeenCalledWith('night', 'day', false);
  });

  it('ticks a game minute every CLOCK_TICK_MS', () => {
    const clock = new TimeSystem({ hour: 10, minute: 0 });
    expect(clock.update(CLOCK_TICK_MS - 1)).toBe(false);
    expect(clock.getMinute()).toBe(0);
    expect(clock.update(1)).toBe(true);
    expect(clock.getMinute()).toBe(1);
  });

  it('carries the accumulator remainder rather than dropping it', () => {
    const clock = new TimeSystem({ hour: 10, minute: 0 });
    clock.update(CLOCK_TICK_MS + 2000);
    expect(clock.getMinute()).toBe(1);
    // 2000ms of credit carried; 500 more should tick again.
    expect(clock.update(500)).toBe(true);
    expect(clock.getMinute()).toBe(2);
  });

  it('rolls minutes into hours and re-resolves the phase', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 16, minute: 59 }, handlers);
    clock.advanceMinutes(1);
    expect(clock.getHour()).toBe(17);
    expect(clock.getMinute()).toBe(0);
    expect(clock.getPhase()).toBe('dusk');
    expect(handlers.onPhaseChanged).toHaveBeenCalledWith('dusk', 'day', true);
  });

  it('reports minute-only movement without an hour move', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 10, minute: 0 }, handlers);
    clock.advanceMinutes(5);
    expect(handlers.onTimeChanged).toHaveBeenCalledTimes(1);
    const [snapshot, movedHours] = handlers.onTimeChanged.mock.calls[0] as [TimeSnapshot, boolean];
    expect(snapshot.minute).toBe(5);
    expect(movedHours).toBe(false);
    expect(handlers.onHoursAdvanced).not.toHaveBeenCalled();
  });

  it('advances hours and reports the snapshot', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 10, minute: 30, day: 2 }, handlers);
    clock.advanceHours(3);
    expect(clock.snapshot()).toEqual({ hour: 13, minute: 30, day: 2, phase: 'day' });
    expect(handlers.onHoursAdvanced).toHaveBeenCalledWith(clock.snapshot());
    expect(handlers.onDayPassed).not.toHaveBeenCalled();
  });

  it('rolls the day and announces it when crossing midnight', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 23, day: 3 }, handlers);
    clock.advanceHours(2);
    expect(clock.getDay()).toBe(4);
    expect(handlers.onDayPassed).toHaveBeenCalledWith(1, 4);
  });

  it('never lets the day counter fall below 1 when wound backwards', () => {
    const clock = new TimeSystem({ hour: 1, day: 1 });
    clock.advanceHours(-3);
    expect(clock.getHour()).toBe(22);
    expect(clock.getDay()).toBe(1);
  });

  it('does not announce a day for a backwards crossing', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 1, day: 4 }, handlers);
    clock.advanceHours(-3);
    expect(handlers.onDayPassed).not.toHaveBeenCalled();
  });

  it('passes the animate flag through to the phase handler', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 19 }, handlers);
    clock.advanceHours(2, false);
    const [, , animate] = handlers.onPhaseChanged.mock.calls[0] as [TimeOfDay, TimeOfDay, boolean];
    expect(animate).toBe(false);
  });

  it('fires the phase handler once per phase, not once per hour', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 8 }, handlers);
    clock.advanceHours(1);
    clock.advanceHours(1);
    expect(handlers.onPhaseChanged).not.toHaveBeenCalled();
    clock.advanceHours(7); // 10 -> 17
    expect(handlers.onPhaseChanged).toHaveBeenCalledTimes(1);
  });

  it('setMinute moves the minute hand without any notification', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 10, minute: 42 }, handlers);
    clock.setMinute(0);
    expect(clock.getMinute()).toBe(0);
    expect(handlers.onTimeChanged).not.toHaveBeenCalled();
  });

  it('syncPhase is idempotent', () => {
    const handlers = makeHandlers();
    const clock = new TimeSystem({ hour: 10 }, handlers);
    clock.syncPhase();
    clock.syncPhase();
    expect(handlers.onPhaseChanged).not.toHaveBeenCalled();
  });

  it('survives a full simulated day of ticks with a consistent phase', () => {
    const clock = new TimeSystem({ hour: 0, minute: 0, day: 1 });
    for (let i = 0; i < 24 * 60; i += 1) clock.update(CLOCK_TICK_MS);
    expect(clock.getHour()).toBe(0);
    expect(clock.getMinute()).toBe(0);
    expect(clock.getDay()).toBe(2);
    expect(clock.getPhase()).toBe('night');
  });
});
