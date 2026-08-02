/**
 * openables — the lock, the contents and the prose of a container.
 *
 * The Ultima VII container verb, reduced to the smallest thing that is still
 * the real feature: an openable is NOT a new prop. It is a flag on a prop that
 * already exists, plus contents, plus two lines of writing. All fourteen ship
 * without a single new sprite.
 *
 * This module is the pure half — what a lock means, whether it opens, what the
 * player gets — so the system on top of it stays Phaser hands and store writes.
 */

import type { LocationOpenable, OpenableContent } from './LocationData';

/**
 * The world facts a lock is evaluated against.
 *
 * `questFlags` carries the two pseudo-flags the drafts use — `quest-active:<id>`
 * and `quest-complete:<id>` — resolved by the caller, because the flag table
 * itself has no notion of a quest stage and inventing one here would put quest
 * logic in a coordinate module.
 */
export interface OpenableWorld {
  worldFlags: Record<string, boolean>;
  questFlags: Record<string, boolean>;
  hasItem(itemId: string): boolean;
}

export type OpenVerdict =
  | { open: true }
  | { open: false; reason: 'needs-item'; itemId: string }
  | { open: false; reason: 'needs-flag' }
  | { open: false; reason: 'blocked-flag' };

const flagSet = (world: OpenableWorld, flag: string): boolean =>
  Boolean(world.worldFlags[flag]) || Boolean(world.questFlags[flag]);

/**
 * Can this container be opened right now?
 *
 * `flagsAny` is a permission (one of these must hold), `flagsNone` a
 * prohibition, `needs` an item in hand. All three must pass; an absent lock
 * always passes.
 */
export function evaluateLock(openable: LocationOpenable, world: OpenableWorld): OpenVerdict {
  const lock = openable.lock;
  if (!lock) return { open: true };

  if (lock.flagsNone?.length && lock.flagsNone.some((f) => flagSet(world, f))) {
    return { open: false, reason: 'blocked-flag' };
  }
  if (lock.flagsAny?.length && !lock.flagsAny.some((f) => flagSet(world, f))) {
    return { open: false, reason: 'needs-flag' };
  }
  if (lock.needs && !world.hasItem(lock.needs)) {
    return { open: false, reason: 'needs-item', itemId: lock.needs };
  }
  return { open: true };
}

/** The world flag that records a container as already emptied. */
export function openedFlag(locationId: string, openableId: string): string {
  return `opened:${locationId}:${openableId}`;
}

export interface OpenableYield {
  money: number;
  items: Array<{ itemId: string; count: number }>;
  flags: string[];
}

/**
 * Flatten `contents` into what the player actually receives.
 *
 * A zero-money entry is dropped rather than pushed as "0 cruzados": the tally
 * crates are authored with `{ money: 0 }` because the payoff is the flag, and
 * telling the player they found no money is worse than saying nothing.
 */
export function resolveContents(contents: OpenableContent[] | undefined): OpenableYield {
  const out: OpenableYield = { money: 0, items: [], flags: [] };
  for (const entry of contents || []) {
    if (typeof entry.money === 'number' && entry.money > 0) out.money += entry.money;
    if (entry.itemId) out.items.push({ itemId: entry.itemId, count: entry.count ?? 1 });
    if (entry.flag) out.flags.push(entry.flag);
  }
  return out;
}

/** The prompt verb: the authored label until it is emptied, then a re-look. */
export function openableLabel(openable: LocationOpenable, alreadyOpened: boolean): string {
  if (!alreadyOpened) return openable.label;
  return openable.reopenable ? openable.label : `Look in the ${shortName(openable)}`;
}

/** "Force the ledger drawer" -> "ledger drawer". Best-effort, prose-safe. */
function shortName(openable: LocationOpenable): string {
  const words = openable.label.split(' ');
  const withoutVerb = words.slice(1);
  const stripped = withoutVerb[0] === 'the' || withoutVerb[0] === 'a'
    ? withoutVerb.slice(1)
    : withoutVerb;
  return (stripped.length ? stripped : withoutVerb).join(' ') || 'container';
}

/** Message shown when a lock refuses. Deliberately in the world's voice. */
export function lockRefusal(verdict: OpenVerdict, itemName?: string): string {
  switch (verdict.open ? 'open' : verdict.reason) {
    case 'needs-item':
      return itemName
        ? `Locked. The ward would take the ${itemName.toLowerCase()}, if you had it.`
        : 'Locked, and you have nothing that fits the ward.';
    case 'needs-flag':
      return 'Not yours to open, and not now.';
    case 'blocked-flag':
      return 'Somebody has been here since you last looked. It is shut against you.';
    default:
      return '';
  }
}

/**
 * Is opening this being watched?
 *
 * Daylight plus a witness within `radius` world px. The cooper resident stands
 * 44 native px from Alvares's tally crates from 07:00 to 18:00, which is not an
 * accident — opening them without the contract is theft in front of the one man
 * on the street who would know what he was looking at.
 */
export function isWitnessed(
  openable: LocationOpenable,
  isDaylight: boolean,
  witnessDistances: number[],
  radius: number,
): boolean {
  if (!openable.witnessed) return false;
  if (!isDaylight) return false;
  return witnessDistances.some((d) => d <= radius);
}

/** Witness reach in NATIVE px, per the spec. */
export const WITNESS_RADIUS_NATIVE = 80;
/** The flag a witnessed opening sets. */
export const WITNESSED_FLAG = 'petty-theft-witnessed';
