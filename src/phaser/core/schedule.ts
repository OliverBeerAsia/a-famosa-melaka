/**
 * schedule — pure resolution of "where is this person, right now, and are they
 * on their way somewhere".
 *
 * `npcs.json` gives every named NPC an hour-by-hour list of slots. Stage 5 adds
 * a station, a facing, a business idle, route hints and an `arriveBy` deadline
 * to each one; this module turns that data plus a clock reading into the three
 * answers `NPCSystem` needs:
 *
 *  1. which slot is live (`resolveSlot`),
 *  2. whether the NPC is on stage here at all (`slotPresence`),
 *  3. whether they should ALREADY be walking toward the next slot's station
 *     (`resolveDeparture`).
 *
 * (3) is the whole point of the stage. `arriveBy` is a deadline, not a start
 * time: the walk begins early enough that the player sees the transit rather
 * than a person who has teleported and is now standing somewhere new. Working
 * out how early is arithmetic over the game clock's minute hand, which is
 * exactly the kind of thing that belongs in a pure function with tests.
 *
 * Zero Phaser, zero stores.
 */

import { isHourInScheduleRange, normalizeHour } from './timeMath';

export interface SchedulePoint { x: number; y: number }

/** A door the fiction sends an NPC through. No interiors exist; see spec §2.2. */
export interface ScheduleDoor {
  door: string;
  x: number;
  y: number;
  /** Sound + pause vocabulary: door-creak, curtain, shutter, shutter-bar, ... */
  effect: string;
}

/**
 * One slot of an NPC's day. Everything past `available` is Stage 5 and
 * optional, so the pre-Stage-5 shape still resolves.
 */
export interface ScheduleSlot {
  startHour: number;
  endHour: number;
  activity: string;
  location: string;
  available: boolean;

  /** Sprite ORIGIN in native plate px. Feet are at y + 15. */
  station?: SchedulePoint;
  facing?: string;
  /** Business-idle key; see spec §2.3. Tier-0 renders these as a bob. */
  idle?: string;
  /** Waypoint HINTS, not a path — A* fills the gaps. */
  route?: SchedulePoint[];
  /** Hour by which the NPC is standing AT `station`. */
  arriveBy?: number;
  /** false = always teleport (cross-location moves). */
  onCameraWalk?: boolean;
  exit?: ScheduleDoor;
  enter?: ScheduleDoor;
  /** Cross-location departure: which location/door they leave FROM. */
  exitFrom?: ScheduleDoor & { location: string };
}

/** A moment inside a slot — the Angelus, a prayer, a social exchange. */
export interface ScheduleBeat {
  /** "HH:MM" game time. */
  at: string;
  kind: string;
  /** Game-MINUTES the beat holds for. */
  duration: number;
  idle?: string;
  /** Turn toward this world point (native px) for the duration. */
  face?: SchedulePoint | null;
  /** A beat only moves the NPC if it carries its own station. */
  station?: SchedulePoint;
}

export type SlotPresence =
  /** On stage here: draw them, let the player talk to them. */
  | 'present'
  /** Their slot puts them somewhere else, or indoors. */
  | 'absent';

/**
 * The live slot for an hour.
 *
 * Slots are authored to tile the day, but nothing enforces it, so a gap
 * resolves to null rather than to a neighbour — an NPC with a hole in their
 * schedule should visibly not be there, not silently inherit the last station.
 */
export function resolveSlot(schedule: ScheduleSlot[] | undefined, hour: number): ScheduleSlot | null {
  if (!schedule || schedule.length === 0) return null;
  const h = normalizeHour(hour);
  return schedule.find((slot) => isHourInScheduleRange(h, slot.startHour, slot.endHour)) ?? null;
}

/** Index of the live slot, or -1. Used to detect a slot CHANGE. */
export function resolveSlotIndex(schedule: ScheduleSlot[] | undefined, hour: number): number {
  if (!schedule || schedule.length === 0) return -1;
  const h = normalizeHour(hour);
  return schedule.findIndex((slot) => isHourInScheduleRange(h, slot.startHour, slot.endHour));
}

/** Is this NPC on stage in `locationId` during `slot`? */
export function slotPresence(
  slot: ScheduleSlot | null,
  locationId: string,
  homeLocation: string,
): SlotPresence {
  if (!slot) return homeLocation === locationId ? 'present' : 'absent';
  if (slot.available === false) return 'absent';
  if (slot.location && slot.location !== locationId) return 'absent';
  return 'present';
}

export interface SlotVisibility {
  /** Draw them: they are somewhere on this plate. */
  visible: boolean;
  /** Let the player talk to them. */
  talkable: boolean;
}

/**
 * The distinction the shipped schedule data quietly depends on: `available` is
 * about DIALOGUE, not about rendering.
 *
 * Three of the fourteen NPCs have slots that are `available: false` and yet are
 * the most important thing they do all day:
 *
 *  - Pak Salleh's 13:00 zuhr — `available: false`, station (479,233), the surau.
 *    Walking a named Malay NPC to the only non-Christian prayer house in the
 *    demo in the middle of the working day is worth more than any amount of
 *    dialogue about Melaka being multi-faith. Despawning him instead is the
 *    exact opposite of the intent.
 *  - Lin Mei's 18:00 — location `elsewhere`, station (560,262): the four-second
 *    lock-up at the counting-house door, telegraph T2, and the single most
 *    important animation in the theft path.
 *  - Chen Wei's 07:00 and 12:00 — `available: false` at his own door.
 *
 * So: a slot that names a STATION puts the character on the plate. `available`
 * only decides whether they will speak to you. A slot with no station is a fade
 * at a door — genuinely gone — and that is the only thing that despawns anyone.
 *
 * `isRealLocation` distinguishes a plate from a fiction ("home", "ship",
 * "elsewhere", "barracks"); a station under a fiction belongs to the NPC's home
 * plate, which is where they are standing while the fiction is that they are
 * indoors.
 */
export function slotVisibility(
  slot: ScheduleSlot | null,
  locationId: string,
  homeLocation: string,
  isRealLocation: (id: string) => boolean,
): SlotVisibility {
  if (!slot) {
    const here = homeLocation === locationId;
    return { visible: here, talkable: here };
  }

  const slotLocation = slot.location && isRealLocation(slot.location)
    ? slot.location
    : homeLocation;
  if (slotLocation !== locationId) return { visible: false, talkable: false };

  const talkable = slot.available !== false
    && (!slot.location || slot.location === locationId);

  // An unavailable slot that names an EXIT is a DEPARTURE, not a station: the
  // station is the last thing they do on their way out (Lin Mei's four-second
  // lock-up at the counting-house door, Chen Wei barring it at 19:00). Those
  // are walked and then faded by the departure path, so a cold spawn into one
  // must not leave a person standing at a door all night — which would also
  // park a witness beside the building the player is trying to burgle.
  if (slot.available === false && slot.exit) return { visible: false, talkable: false };

  if (slot.station) return { visible: true, talkable };
  // No station and unavailable: they have gone through a door.
  if (slot.available === false) return { visible: false, talkable: false };
  return { visible: true, talkable };
}

/**
 * Where an NPC stands during a slot, in NATIVE px.
 *
 * A slot with no station falls back to the location file's authored anchor,
 * which is what every pre-Stage-5 NPC used and what the validator checks.
 * Returns null when neither exists.
 */
export function slotStation(
  slot: ScheduleSlot | null,
  fallback: SchedulePoint | null,
): SchedulePoint | null {
  if (slot?.station) return slot.station;
  return fallback;
}

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

/** Parse "HH:MM" into minutes-since-midnight. Returns null on a malformed value. */
export function parseClock(at: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(at);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * The beat holding at this clock reading, if any.
 *
 * Beats do not stack: the FIRST match wins, in authoring order, which makes
 * overlapping beats a deterministic authoring decision rather than a race.
 */
export function resolveBeat(
  beats: ScheduleBeat[] | undefined,
  hour: number,
  minute: number,
): ScheduleBeat | null {
  if (!beats || beats.length === 0) return null;
  const now = normalizeHour(hour) * 60 + minute;
  for (const beat of beats) {
    const start = parseClock(beat.at);
    if (start === null) continue;
    const end = start + Math.max(1, beat.duration || 1);
    // Beats never wrap midnight in the shipped data, but a beat that would is
    // handled rather than silently dropped.
    if (end <= 24 * 60) {
      if (now >= start && now < end) return beat;
    } else if (now >= start || now < end - 24 * 60) {
      return beat;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Departures
// ---------------------------------------------------------------------------

/**
 * How many GAME minutes a walk of `worldPx` takes at `speed` world px/s.
 *
 * The world clock runs one game minute per `realSecondsPerGameMinute` real
 * seconds (2.5 in the shipped TimeSystem), so a 30-second walk is 12 game
 * minutes and an NPC crossing Rua Direita has to set off at 18:48 to be at the
 * east lane by 19:00.
 */
export function travelGameMinutes(
  worldPx: number,
  speed: number,
  realSecondsPerGameMinute = 2.5,
): number {
  if (speed <= 0) return 0;
  const realSeconds = worldPx / speed;
  return realSeconds / realSecondsPerGameMinute;
}

export interface Departure {
  /** The slot being walked toward. */
  slot: ScheduleSlot;
  /** Its index in the schedule array. */
  index: number;
  /** Game minutes until its `arriveBy` deadline. */
  minutesUntilDeadline: number;
}

/**
 * Should this NPC already be walking toward a LATER slot's station?
 *
 * Looks ahead across the next `lookaheadHours` hours for the first slot that is
 * not the current one, and reports it when the walk needs to start now to meet
 * its `arriveBy`. `leadMinutes` is what the caller computed from the actual
 * path length — pass 0 and this degenerates to "change on the hour", which is
 * the pre-Stage-5 behaviour.
 *
 * Returns null when the NPC has nowhere to be yet.
 */
export function resolveDeparture(
  schedule: ScheduleSlot[] | undefined,
  hour: number,
  minute: number,
  leadMinutes: number,
  lookaheadHours = 2,
): Departure | null {
  if (!schedule || schedule.length === 0) return null;
  const currentIndex = resolveSlotIndex(schedule, hour);

  for (let ahead = 1; ahead <= lookaheadHours; ahead++) {
    const futureHour = normalizeHour(hour + ahead);
    const index = resolveSlotIndex(schedule, futureHour);
    if (index < 0 || index === currentIndex) continue;

    const slot = schedule[index];
    // `arriveBy` is the deadline; without one the slot's own start hour is.
    const deadlineHour = slot.arriveBy ?? slot.startHour;
    // Minutes from now to that deadline, forwards only.
    const nowMinutes = normalizeHour(hour) * 60 + minute;
    let deadlineMinutes = normalizeHour(deadlineHour) * 60;
    if (deadlineMinutes <= nowMinutes) deadlineMinutes += 24 * 60;
    const until = deadlineMinutes - nowMinutes;

    // Only the NEXT distinct slot can be departed for; a slot two changes away
    // is not this walk's business.
    if (until > leadMinutes) return null;
    return { slot, index, minutesUntilDeadline: until };
  }
  return null;
}
