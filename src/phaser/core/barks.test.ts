import { describe, it, expect } from 'vitest';
import {
  activeBarkSet,
  BARK_COOLDOWN_MS,
  buildBarkOrder,
  clauseHolds,
  newBarkCursor,
  pickBark,
  residentOnStage,
  type BarkSets,
} from './barks';

const SETS: BarkSets = {
  barks: ['one', 'two', 'three', 'four', 'five'],
  nightBarks: ['night-a', 'night-b'],
  reactiveBarks: [
    { when: { worldFlagsAny: ['seal-stolen'] }, barks: ['everyone is careful with their doors'] },
  ],
};

describe('clauseHolds', () => {
  it('is true for an absent clause', () => {
    expect(clauseHolds(undefined, {})).toBe(true);
  });

  it('honours any / all / none', () => {
    expect(clauseHolds({ worldFlagsAny: ['a', 'b'] }, { b: true })).toBe(true);
    expect(clauseHolds({ worldFlagsAny: ['a', 'b'] }, { c: true })).toBe(false);
    expect(clauseHolds({ worldFlagsAll: ['a', 'b'] }, { a: true })).toBe(false);
    expect(clauseHolds({ worldFlagsAll: ['a', 'b'] }, { a: true, b: true })).toBe(true);
    expect(clauseHolds({ worldFlagsNone: ['a'] }, { a: true })).toBe(false);
    expect(clauseHolds({ worldFlagsNone: ['a'] }, {})).toBe(true);
  });
});

describe('activeBarkSet', () => {
  it('uses the neutral set by default', () => {
    expect(activeBarkSet(SETS, {}, false)).toEqual(SETS.barks);
  });

  it('swaps to the night set after dark', () => {
    expect(activeBarkSet(SETS, {}, true)).toEqual(SETS.nightBarks);
  });

  it('lets a reactive set beat both', () => {
    expect(activeBarkSet(SETS, { 'seal-stolen': true }, true)).toEqual(SETS.reactiveBarks![0].barks);
  });

  it('falls back to neutral when there is no night set', () => {
    const noNight: BarkSets = { barks: ['x'] };
    expect(activeBarkSet(noNight, {}, true)).toEqual(['x']);
  });
});

describe('buildBarkOrder', () => {
  it('is a permutation of every index', () => {
    const order = buildBarkOrder(5, 'rua-cooper', 3);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('is deterministic for the same resident and day', () => {
    expect(buildBarkOrder(5, 'rua-cooper', 3)).toEqual(buildBarkOrder(5, 'rua-cooper', 3));
  });

  it('differs between residents on the same day', () => {
    const a = buildBarkOrder(5, 'rua-cooper', 3);
    const b = buildBarkOrder(5, 'rua-water-carrier', 3);
    expect(a).not.toEqual(b);
  });

  it('reshuffles between days', () => {
    const day3 = buildBarkOrder(5, 'rua-cooper', 3);
    const day4 = buildBarkOrder(5, 'rua-cooper', 4);
    expect(day3).not.toEqual(day4);
  });
});

describe('pickBark', () => {
  it('speaks the first time it is asked', () => {
    const pick = pickBark('rua-cooper', SETS, {}, false, 1, 0, newBarkCursor());
    expect(pick).not.toBeNull();
    expect(SETS.barks).toContain(pick!.text);
  });

  it('stays quiet inside the cooldown', () => {
    const first = pickBark('rua-cooper', SETS, {}, false, 1, 1000, newBarkCursor())!;
    expect(pickBark('rua-cooper', SETS, {}, false, 1, 1000 + BARK_COOLDOWN_MS - 1, first.cursor)).toBeNull();
  });

  it('speaks again once the cooldown expires', () => {
    const first = pickBark('rua-cooper', SETS, {}, false, 1, 1000, newBarkCursor())!;
    const second = pickBark('rua-cooper', SETS, {}, false, 1, 1000 + BARK_COOLDOWN_MS, first.cursor);
    expect(second).not.toBeNull();
  });

  it('bypasses the cooldown when forced (interact)', () => {
    const first = pickBark('rua-cooper', SETS, {}, false, 1, 1000, newBarkCursor())!;
    const forced = pickBark('rua-cooper', SETS, {}, false, 1, 1001, first.cursor, true);
    expect(forced).not.toBeNull();
  });

  it('never repeats a line back to back', () => {
    let cursor = newBarkCursor();
    let now = 0;
    let previous: string | null = null;
    for (let i = 0; i < 20; i++) {
      const pick = pickBark('rua-cooper', SETS, {}, false, 1, now, cursor, true)!;
      expect(pick.text).not.toBe(previous);
      previous = pick.text;
      cursor = pick.cursor;
      now += 100;
    }
  });

  it('works through the whole set before repeating one', () => {
    let cursor = newBarkCursor();
    const heard = new Set<string>();
    for (let i = 0; i < SETS.barks.length; i++) {
      const pick = pickBark('rua-cooper', SETS, {}, false, 1, i * 100, cursor, true)!;
      heard.add(pick.text);
      cursor = pick.cursor;
    }
    expect(heard.size).toBe(SETS.barks.length);
  });

  it('handles a single-line set without looping forever', () => {
    const one: BarkSets = { barks: ['only'] };
    let cursor = newBarkCursor();
    const first = pickBark('x', one, {}, false, 1, 0, cursor, true)!;
    cursor = first.cursor;
    const second = pickBark('x', one, {}, false, 1, 1, cursor, true)!;
    expect(second.text).toBe('only');
  });

  it('is null when there is nothing to say', () => {
    expect(pickBark('x', { barks: [] }, {}, false, 1, 0, newBarkCursor())).toBeNull();
  });

  it('restarts the order on a new day', () => {
    const first = pickBark('rua-cooper', SETS, {}, false, 1, 0, newBarkCursor())!;
    const nextDay = pickBark('rua-cooper', SETS, {}, false, 2, BARK_COOLDOWN_MS, first.cursor)!;
    expect(nextDay.cursor.day).toBe(2);
    expect(nextDay.cursor.index).toBe(1);
  });
});

describe('residentOnStage', () => {
  it('handles a normal daytime window', () => {
    expect(residentOnStage([7, 18], 12)).toBe(true);
    expect(residentOnStage([7, 18], 18)).toBe(false);
    expect(residentOnStage([7, 18], 6)).toBe(false);
  });

  it('treats [0, 24] as always — the gate sentry', () => {
    expect(residentOnStage([0, 24], 3)).toBe(true);
    expect(residentOnStage([0, 24], 15)).toBe(true);
  });

  it('wraps past midnight', () => {
    expect(residentOnStage([22, 4], 23)).toBe(true);
    expect(residentOnStage([22, 4], 2)).toBe(true);
    expect(residentOnStage([22, 4], 12)).toBe(false);
  });

  it('defaults to on stage with no hours at all', () => {
    expect(residentOnStage(undefined, 3)).toBe(true);
  });
});
