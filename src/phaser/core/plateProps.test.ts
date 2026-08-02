import { describe, it, expect } from 'vitest';
import { getLocationPlateProps, LOCATION_IDS } from './LocationData';
import { INTERACTION_RADIUS } from './interactionScore';

/**
 * The examine path over painted scenery.
 *
 * Props the Forge compositor paints INTO the plate own no display object, so
 * their `examineText` is the only thing left of them at runtime. These tests
 * lock the contract that makes them reachable:
 *   1. a prop marked `interactive` must carry prose, or nothing can be said
 *      about it when the player presses Space,
 *   2. prose must be substantive rather than a placeholder,
 *   3. the props are on the plate, within reach of a player who can stand
 *      near them.
 */
describe('plate props: the examine path', () => {
  const allProps = LOCATION_IDS.flatMap((id) =>
    getLocationPlateProps(id).map((p: any) => ({ ...p, locationId: id }))
  );

  it('finds plate props in the shipping locations', () => {
    expect(allProps.length).toBeGreaterThan(100);
  });

  it('every prop flagged interactive carries examine prose', () => {
    const interactive = allProps.filter((p) => p.interactive);
    expect(interactive.length).toBeGreaterThan(0);

    const mute = interactive.filter(
      (p) => typeof p.examineText !== 'string' || p.examineText.length === 0
    );
    expect(mute.map((p) => `${p.locationId}:${p.key}`)).toEqual([]);
  });

  it('interactive prose is substantive, not a placeholder', () => {
    const thin = allProps
      .filter((p) => p.interactive)
      .filter((p) => (p.examineText as string).trim().length < 20);
    expect(thin.map((p) => `${p.locationId}:${p.key}`)).toEqual([]);
  });

  it('every prop with prose has a label the prompt can show', () => {
    const unnamed = allProps
      .filter((p) => typeof p.examineText === 'string' && p.examineText.length > 0)
      .filter((p) => !(p.label || p.type || p.key));
    expect(unnamed).toEqual([]);
  });

  it('every prop with prose has finite world coordinates', () => {
    const offGrid = allProps
      .filter((p) => typeof p.examineText === 'string' && p.examineText.length > 0)
      .filter((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y));
    expect(offGrid.map((p) => `${p.locationId}:${p.key}`)).toEqual([]);
  });

  it('prop keys are unique within a location', () => {
    LOCATION_IDS.forEach((id) => {
      const keys = getLocationPlateProps(id).map((p: any) => p.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  it('no interactive prop is stranded beyond examine reach of every other', () => {
    // A prop the player can never stand near is unreachable prose. There is no
    // walkability check here (that is the walk mask's job) — this is the weaker
    // but still useful guard that interactive props sit inside the plate's own
    // populated area rather than off in a corner on their own.
    LOCATION_IDS.forEach((id) => {
      const props = getLocationPlateProps(id) as any[];
      const interactive = props.filter((p) => p.interactive);
      interactive.forEach((p) => {
        const hasNeighbour = props.some((other) =>
          other.key !== p.key
          && Math.hypot(other.x - p.x, other.y - p.y) < INTERACTION_RADIUS.scenery * 6
        );
        expect(hasNeighbour, `${id}:${p.key} is isolated on the plate`).toBe(true);
      });
    });
  });
});
