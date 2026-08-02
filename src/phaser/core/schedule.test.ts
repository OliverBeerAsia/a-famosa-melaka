import { describe, it, expect } from 'vitest';
import {
  parseClock,
  resolveBeat,
  resolveDeparture,
  resolveSlot,
  resolveSlotIndex,
  slotPresence,
  slotVisibility,
  slotStation,
  travelGameMinutes,
  type ScheduleSlot,
} from './schedule';

/** Aminah's shipped shape, trimmed to what the resolver reads. */
const AMINAH: ScheduleSlot[] = [
  {
    startHour: 5, endHour: 6, activity: 'Setting up', location: 'rua-direita',
    available: false, station: { x: 110, y: 248 }, arriveBy: 5,
  },
  {
    startHour: 6, endHour: 19, activity: 'Selling', location: 'rua-direita',
    available: true, station: { x: 104, y: 236 }, facing: 'down', idle: 'fan', arriveBy: 6,
  },
  {
    startHour: 19, endHour: 20, activity: 'Walking home', location: 'rua-direita',
    available: true, station: { x: 612, y: 248 }, arriveBy: 19,
    route: [{ x: 240, y: 262 }, { x: 440, y: 248 }],
  },
  {
    startHour: 20, endHour: 22, activity: 'At home', location: 'kampung',
    available: true, station: { x: 250, y: 272 }, arriveBy: 20, onCameraWalk: false,
  },
  {
    startHour: 22, endHour: 5, activity: 'Asleep', location: 'home',
    available: false, arriveBy: 22,
  },
];

describe('resolveSlot', () => {
  it('finds the slot covering the hour', () => {
    expect(resolveSlot(AMINAH, 13)?.activity).toBe('Selling');
    expect(resolveSlot(AMINAH, 19)?.activity).toBe('Walking home');
  });

  it('is half-open on the end hour', () => {
    expect(resolveSlot(AMINAH, 6)?.activity).toBe('Selling');
    expect(resolveSlot(AMINAH, 5)?.activity).toBe('Setting up');
  });

  it('handles a slot that wraps midnight', () => {
    expect(resolveSlot(AMINAH, 23)?.activity).toBe('Asleep');
    expect(resolveSlot(AMINAH, 2)?.activity).toBe('Asleep');
    expect(resolveSlot(AMINAH, 4)?.activity).toBe('Asleep');
  });

  it('normalizes an out-of-range hour', () => {
    expect(resolveSlot(AMINAH, 26)?.activity).toBe('Asleep');
  });

  it('returns null for an empty or missing schedule', () => {
    expect(resolveSlot([], 10)).toBeNull();
    expect(resolveSlot(undefined, 10)).toBeNull();
  });

  it('reports the index so a slot CHANGE can be detected', () => {
    expect(resolveSlotIndex(AMINAH, 13)).toBe(1);
    expect(resolveSlotIndex(AMINAH, 19)).toBe(2);
    expect(resolveSlotIndex([], 13)).toBe(-1);
  });
});

describe('slotPresence', () => {
  it('is present when the slot is available here', () => {
    expect(slotPresence(resolveSlot(AMINAH, 13), 'rua-direita', 'rua-direita')).toBe('present');
  });

  it('is absent when the slot names another location', () => {
    expect(slotPresence(resolveSlot(AMINAH, 21), 'rua-direita', 'rua-direita')).toBe('absent');
    expect(slotPresence(resolveSlot(AMINAH, 21), 'kampung', 'rua-direita')).toBe('present');
  });

  it('is absent when the slot is unavailable, even at home', () => {
    expect(slotPresence(resolveSlot(AMINAH, 23), 'rua-direita', 'rua-direita')).toBe('absent');
  });

  it('falls back to the home location with no schedule', () => {
    expect(slotPresence(null, 'rua-direita', 'rua-direita')).toBe('present');
    expect(slotPresence(null, 'kampung', 'rua-direita')).toBe('absent');
  });
});

describe('slotVisibility', () => {
  const isReal = (id: string) => ['rua-direita', 'kampung', 'waterfront'].includes(id);

  it('is visible and talkable during a normal available slot', () => {
    expect(slotVisibility(resolveSlot(AMINAH, 13), 'rua-direita', 'rua-direita', isReal))
      .toEqual({ visible: true, talkable: true });
  });

  it('is nothing at all in a location the slot does not name', () => {
    expect(slotVisibility(resolveSlot(AMINAH, 13), 'kampung', 'rua-direita', isReal))
      .toEqual({ visible: false, talkable: false });
  });

  it('keeps Pak Salleh AT the surau: unavailable, stationed, still on the plate', () => {
    // available:false + a station + a real location = praying in public.
    const zuhr: ScheduleSlot = {
      startHour: 13, endHour: 14, activity: 'Zuhr at the surau', location: 'kampung',
      available: false, station: { x: 479, y: 233 }, idle: 'pray-kneel',
    };
    expect(slotVisibility(zuhr, 'kampung', 'kampung', isReal))
      .toEqual({ visible: true, talkable: false });
  });

  it("keeps Lin Mei's lock-up on the quay even though the slot says 'elsewhere'", () => {
    const lockUp: ScheduleSlot = {
      startHour: 18, endHour: 7, activity: 'Family supper', location: 'elsewhere',
      available: false, station: { x: 560, y: 262 }, idle: 'tally',
    };
    // `elsewhere` is a fiction, so the station belongs to her home plate.
    expect(slotVisibility(lockUp, 'waterfront', 'waterfront', isReal))
      .toEqual({ visible: true, talkable: false });
    expect(slotVisibility(lockUp, 'kampung', 'waterfront', isReal))
      .toEqual({ visible: false, talkable: false });
  });

  it('despawns a slot that is unavailable with NO station — a fade at a door', () => {
    const asleep = resolveSlot(AMINAH, 23);
    expect(asleep?.station).toBeUndefined();
    expect(slotVisibility(asleep, 'rua-direita', 'rua-direita', isReal))
      .toEqual({ visible: false, talkable: false });
  });

  it('still shows an available slot that carries no station', () => {
    const bare: ScheduleSlot = {
      startHour: 8, endHour: 9, activity: 'About', location: 'rua-direita', available: true,
    };
    expect(slotVisibility(bare, 'rua-direita', 'rua-direita', isReal))
      .toEqual({ visible: true, talkable: true });
  });

  it('falls back to the home location with no schedule at all', () => {
    expect(slotVisibility(null, 'rua-direita', 'rua-direita', isReal))
      .toEqual({ visible: true, talkable: true });
    expect(slotVisibility(null, 'kampung', 'rua-direita', isReal))
      .toEqual({ visible: false, talkable: false });
  });
});

describe('slotStation', () => {
  it('prefers the slot station over the location anchor', () => {
    expect(slotStation(resolveSlot(AMINAH, 13), { x: 1, y: 2 })).toEqual({ x: 104, y: 236 });
  });

  it('falls back to the anchor when the slot has none', () => {
    expect(slotStation(resolveSlot(AMINAH, 23), { x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
  });

  it('returns null when there is neither', () => {
    expect(slotStation(null, null)).toBeNull();
  });
});

describe('parseClock / resolveBeat', () => {
  const beats = [
    { at: '12:00', kind: 'angelus', duration: 3, idle: 'pray-standing' },
    { at: '13:15', kind: 'zuhr', duration: 10, idle: 'pray-kneel' },
  ];

  it('parses HH:MM', () => {
    expect(parseClock('12:00')).toBe(720);
    expect(parseClock('9:05')).toBe(545);
    expect(parseClock('nope')).toBeNull();
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('12:99')).toBeNull();
  });

  it('holds for the beat duration and no longer', () => {
    expect(resolveBeat(beats, 12, 0)?.kind).toBe('angelus');
    expect(resolveBeat(beats, 12, 2)?.kind).toBe('angelus');
    expect(resolveBeat(beats, 12, 3)).toBeNull();
    expect(resolveBeat(beats, 11, 59)).toBeNull();
  });

  it('resolves the later beat too', () => {
    expect(resolveBeat(beats, 13, 20)?.kind).toBe('zuhr');
    expect(resolveBeat(beats, 13, 25)).toBeNull();
  });

  it('is null with no beats', () => {
    expect(resolveBeat(undefined, 12, 0)).toBeNull();
    expect(resolveBeat([], 12, 0)).toBeNull();
  });
});

describe('travelGameMinutes', () => {
  it('converts a walk length into game minutes', () => {
    // 1500 world px at 100 px/s = 15 real seconds = 6 game minutes.
    expect(travelGameMinutes(1500, 100)).toBeCloseTo(6, 6);
  });

  it('is zero for a zero speed rather than infinite', () => {
    expect(travelGameMinutes(500, 0)).toBe(0);
  });
});

describe('resolveDeparture', () => {
  it('does not fire when the deadline is further out than the lead', () => {
    // 13:00, next distinct slot is 19:00 — nowhere near.
    expect(resolveDeparture(AMINAH, 13, 0, 12)).toBeNull();
  });

  it('fires once the walk has to start to meet arriveBy', () => {
    // 18:50 with a 12-minute walk: the 19:00 slot is 10 minutes away.
    const departure = resolveDeparture(AMINAH, 18, 50, 12);
    expect(departure).not.toBeNull();
    expect(departure!.slot.activity).toBe('Walking home');
    expect(departure!.minutesUntilDeadline).toBe(10);
  });

  it('does not fire a minute too early', () => {
    expect(resolveDeparture(AMINAH, 18, 47, 12)).toBeNull();
  });

  it('never pre-departs with a zero lead — the slot change does the work', () => {
    // With no travel budget there is nothing to leave early FOR: the walk
    // starts when resolveSlot itself rolls over at 19:00.
    expect(resolveDeparture(AMINAH, 18, 59, 0)).toBeNull();
    expect(resolveSlot(AMINAH, 19)?.activity).toBe('Walking home');
  });

  it('never reports the slot the NPC is already in', () => {
    // 06:30, current slot runs to 19:00; nothing to depart for.
    expect(resolveDeparture(AMINAH, 6, 30, 30)).toBeNull();
  });

  it('handles a deadline across midnight', () => {
    // 21:50 with a 12-minute lead: the 22:00 "Asleep" slot is 10 minutes off.
    const departure = resolveDeparture(AMINAH, 21, 50, 12);
    expect(departure?.slot.activity).toBe('Asleep');
    expect(departure?.minutesUntilDeadline).toBe(10);
  });

  it('is null with no schedule', () => {
    expect(resolveDeparture(undefined, 12, 0, 10)).toBeNull();
    expect(resolveDeparture([], 12, 0, 10)).toBeNull();
  });
});
