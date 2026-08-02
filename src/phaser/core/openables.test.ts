import { describe, it, expect } from 'vitest';
import {
  evaluateLock,
  isWitnessed,
  lockRefusal,
  openableLabel,
  openedFlag,
  resolveContents,
} from './openables';
import type { LocationOpenable } from './LocationData';

const base = (over: Partial<LocationOpenable> = {}): LocationOpenable => ({
  id: 'bonded-chest',
  prop: 'bonded-chest',
  anchor: { x: 0, y: 0 },
  approach: { x: 0, y: 0 },
  label: 'Open the bonded chest',
  lock: null,
  contents: [],
  emptyText: 'Sound wood, sound iron.',
  witnessed: false,
  reopenable: false,
  ...over,
});

const world = (over: Partial<{
  worldFlags: Record<string, boolean>;
  questFlags: Record<string, boolean>;
  items: string[];
}> = {}) => ({
  worldFlags: over.worldFlags ?? {},
  questFlags: over.questFlags ?? {},
  hasItem: (id: string) => (over.items ?? []).includes(id),
});

describe('evaluateLock', () => {
  it('opens an unlocked container', () => {
    expect(evaluateLock(base(), world())).toEqual({ open: true });
  });

  it('refuses without the key and opens with it', () => {
    const chest = base({ lock: { needs: 'key-warehouse', flagsAny: [], flagsNone: [] } });
    expect(evaluateLock(chest, world())).toEqual({ open: false, reason: 'needs-item', itemId: 'key-warehouse' });
    expect(evaluateLock(chest, world({ items: ['key-warehouse'] }))).toEqual({ open: true });
  });

  it('honours flagsAny as a permission', () => {
    const drawer = base({ lock: { needs: null, flagsAny: ['counting-house-entered'], flagsNone: [] } });
    expect(evaluateLock(drawer, world())).toEqual({ open: false, reason: 'needs-flag' });
    expect(evaluateLock(drawer, world({ worldFlags: { 'counting-house-entered': true } }))).toEqual({ open: true });
  });

  it('honours flagsNone as a prohibition, before anything else', () => {
    const powder = base({ lock: { needs: null, flagsAny: [], flagsNone: ['magazine-tampered'] } });
    expect(evaluateLock(powder, world())).toEqual({ open: true });
    expect(evaluateLock(powder, world({ worldFlags: { 'magazine-tampered': true } })))
      .toEqual({ open: false, reason: 'blocked-flag' });
  });

  it('reads the quest pseudo-flags the drafts use', () => {
    const strongbox = base({ lock: { needs: null, flagsAny: ['quest-active:merchants-seal'], flagsNone: [] } });
    expect(evaluateLock(strongbox, world())).toEqual({ open: false, reason: 'needs-flag' });
    expect(evaluateLock(strongbox, world({ questFlags: { 'quest-active:merchants-seal': true } })))
      .toEqual({ open: true });
  });

  it('needs BOTH key and standing on the tin godown', () => {
    const godown = base({
      lock: { needs: 'key-warehouse', flagsAny: ['dockside-cover', 'quest-complete:customs-ledger'], flagsNone: [] },
    });
    expect(evaluateLock(godown, world({ items: ['key-warehouse'] }))).toEqual({ open: false, reason: 'needs-flag' });
    expect(evaluateLock(godown, world({ worldFlags: { 'dockside-cover': true } })))
      .toEqual({ open: false, reason: 'needs-item', itemId: 'key-warehouse' });
    expect(evaluateLock(godown, world({ items: ['key-warehouse'], worldFlags: { 'dockside-cover': true } })))
      .toEqual({ open: true });
  });
});

describe('resolveContents', () => {
  it('sums money, collects items and flags', () => {
    const y = resolveContents([{ money: 30 }, { itemId: 'letter-of-credit', count: 1 }, { flag: 'saw-it' }]);
    expect(y).toEqual({ money: 30, items: [{ itemId: 'letter-of-credit', count: 1 }], flags: ['saw-it'] });
  });

  it('defaults an item count to one', () => {
    expect(resolveContents([{ itemId: 'egg' }]).items).toEqual([{ itemId: 'egg', count: 1 }]);
  });

  it('drops a zero-money entry rather than announcing nothing', () => {
    expect(resolveContents([{ money: 0 }, { flag: 'tin-tally-checked' }]))
      .toEqual({ money: 0, items: [], flags: ['tin-tally-checked'] });
  });

  it('handles missing contents', () => {
    expect(resolveContents(undefined)).toEqual({ money: 0, items: [], flags: [] });
  });
});

describe('openedFlag', () => {
  it('is namespaced by location so two coops do not share a flag', () => {
    expect(openedFlag('rua-direita', 'street-chicken-coop')).not.toBe(openedFlag('kampung', 'kampung-coop'));
    expect(openedFlag('kampung', 'kampung-coop')).toBe('opened:kampung:kampung-coop');
  });
});

describe('openableLabel', () => {
  it('is the authored label until it is emptied', () => {
    expect(openableLabel(base(), false)).toBe('Open the bonded chest');
  });

  it('keeps the verb on a reopenable container', () => {
    expect(openableLabel(base({ reopenable: true }), true)).toBe('Open the bonded chest');
  });

  it('becomes a re-look on a one-shot container', () => {
    expect(openableLabel(base(), true)).toBe('Look in the bonded chest');
    expect(openableLabel(base({ label: 'Force the ledger drawer' }), true)).toBe('Look in the ledger drawer');
  });
});

describe('lockRefusal', () => {
  it('names the item when one is known', () => {
    const text = lockRefusal({ open: false, reason: 'needs-item', itemId: 'key-warehouse' }, 'Warehouse Key');
    expect(text).toContain('warehouse key');
  });

  it('never reads as an empty string for a real refusal', () => {
    expect(lockRefusal({ open: false, reason: 'needs-flag' }).length).toBeGreaterThan(0);
    expect(lockRefusal({ open: false, reason: 'blocked-flag' }).length).toBeGreaterThan(0);
  });

  it('is empty for an open verdict', () => {
    expect(lockRefusal({ open: true })).toBe('');
  });
});

describe('isWitnessed', () => {
  it('needs the flag, the daylight and a witness', () => {
    const crates = base({ witnessed: true });
    expect(isWitnessed(crates, true, [100], 240)).toBe(true);
    expect(isWitnessed(crates, false, [100], 240)).toBe(false);
    expect(isWitnessed(crates, true, [900], 240)).toBe(false);
    expect(isWitnessed(base({ witnessed: false }), true, [10], 240)).toBe(false);
  });

  it('is false with nobody around at all', () => {
    expect(isWitnessed(base({ witnessed: true }), true, [], 240)).toBe(false);
  });
});
