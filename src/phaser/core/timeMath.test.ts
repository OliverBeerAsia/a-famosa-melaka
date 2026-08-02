import { describe, it, expect } from 'vitest';
import {
  advanceHour,
  advanceMinute,
  formatClock,
  hoursUntil,
  isDarkPhase,
  isHourInScheduleRange,
  normalizeHour,
  resolveTimeOfDay,
  TIME_RANGES,
} from './timeMath';

describe('normalizeHour', () => {
  it('leaves in-range hours alone', () => {
    expect(normalizeHour(0)).toBe(0);
    expect(normalizeHour(23)).toBe(23);
  });

  it('wraps forwards and backwards', () => {
    expect(normalizeHour(24)).toBe(0);
    expect(normalizeHour(27)).toBe(3);
    expect(normalizeHour(-1)).toBe(23);
    expect(normalizeHour(-25)).toBe(23);
  });
});

describe('resolveTimeOfDay', () => {
  it('maps each boundary hour to the phase that starts there', () => {
    expect(resolveTimeOfDay(TIME_RANGES.dawn.start)).toBe('dawn');
    expect(resolveTimeOfDay(TIME_RANGES.day.start)).toBe('day');
    expect(resolveTimeOfDay(TIME_RANGES.dusk.start)).toBe('dusk');
    expect(resolveTimeOfDay(TIME_RANGES.night.start)).toBe('night');
  });

  it('treats the hour before a boundary as the previous phase', () => {
    expect(resolveTimeOfDay(4)).toBe('night');
    expect(resolveTimeOfDay(6)).toBe('dawn');
    expect(resolveTimeOfDay(16)).toBe('day');
    expect(resolveTimeOfDay(19)).toBe('dusk');
  });

  it('covers the wrap past midnight as night', () => {
    expect(resolveTimeOfDay(23)).toBe('night');
    expect(resolveTimeOfDay(0)).toBe('night');
    expect(resolveTimeOfDay(3)).toBe('night');
  });

  it('normalizes out-of-range hours first', () => {
    expect(resolveTimeOfDay(36)).toBe('day');
    expect(resolveTimeOfDay(-2)).toBe('night');
  });

  it('assigns every hour of the day to exactly one phase', () => {
    const phases = Array.from({ length: 24 }, (_, h) => resolveTimeOfDay(h));
    expect(phases).toHaveLength(24);
    expect(new Set(phases)).toEqual(new Set(['dawn', 'day', 'dusk', 'night']));
  });
});

describe('isDarkPhase', () => {
  it('is true for the phases that light the practicals', () => {
    expect(isDarkPhase('night')).toBe(true);
    expect(isDarkPhase('dusk')).toBe(true);
    expect(isDarkPhase('dawn')).toBe(false);
    expect(isDarkPhase('day')).toBe(false);
  });
});

describe('advanceHour', () => {
  it('advances without crossing midnight', () => {
    expect(advanceHour(10, 3)).toEqual({ hour: 13, dayDelta: 0 });
  });

  it('reports a day when it crosses midnight', () => {
    expect(advanceHour(23, 2)).toEqual({ hour: 1, dayDelta: 1 });
  });

  it('reports multiple days for long skips', () => {
    expect(advanceHour(12, 50)).toEqual({ hour: 14, dayDelta: 2 });
  });

  it('reports a negative day when wound backwards past midnight', () => {
    expect(advanceHour(1, -3)).toEqual({ hour: 22, dayDelta: -1 });
  });

  it('is a no-op for a zero delta', () => {
    expect(advanceHour(7, 0)).toEqual({ hour: 7, dayDelta: 0 });
  });
});

describe('advanceMinute', () => {
  it('advances within the hour', () => {
    expect(advanceMinute(10, 5)).toEqual({ minute: 15, hourDelta: 0 });
  });

  it('rolls into the next hour', () => {
    expect(advanceMinute(59, 1)).toEqual({ minute: 0, hourDelta: 1 });
  });

  it('rolls multiple hours', () => {
    expect(advanceMinute(30, 150)).toEqual({ minute: 0, hourDelta: 3 });
  });
});

describe('hoursUntil', () => {
  it('measures forwards within the day', () => {
    expect(hoursUntil(10, 21)).toBe(11);
  });

  it('wraps past midnight', () => {
    expect(hoursUntil(22, 6)).toBe(8);
  });

  it('sleeps a full round when already at the target hour', () => {
    expect(hoursUntil(12, 12)).toBe(24);
  });
});

describe('formatClock', () => {
  it('pads the minute but not the hour', () => {
    expect(formatClock(9, 5)).toBe('9:05');
    expect(formatClock(21, 30)).toBe('21:30');
    expect(formatClock(0, 0)).toBe('0:00');
  });
});

describe('isHourInScheduleRange', () => {
  it('handles a normal daytime slot', () => {
    expect(isHourInScheduleRange(9, 8, 17)).toBe(true);
    expect(isHourInScheduleRange(8, 8, 17)).toBe(true);
    expect(isHourInScheduleRange(17, 8, 17)).toBe(false);
    expect(isHourInScheduleRange(7, 8, 17)).toBe(false);
  });

  it('handles a slot that wraps past midnight', () => {
    expect(isHourInScheduleRange(22, 20, 5)).toBe(true);
    expect(isHourInScheduleRange(2, 20, 5)).toBe(true);
    expect(isHourInScheduleRange(12, 20, 5)).toBe(false);
  });

  it('treats start === end as an all-day slot', () => {
    expect(isHourInScheduleRange(3, 0, 0)).toBe(true);
    expect(isHourInScheduleRange(15, 9, 9)).toBe(true);
  });
});
