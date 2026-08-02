import { describe, it, expect } from 'vitest';
import {
  BEHIND_GRACE_DISTANCE,
  CLOSE_BONUS,
  directionBetween,
  facingVector,
  FACING_BIAS,
  INTERACTION_PRIORITY,
  INTERACTION_RADIUS,
  pickBestCandidate,
  rankCandidates,
  rectContains,
  scoreInteractionTarget,
} from './interactionScore';

describe('facingVector', () => {
  it('maps each direction to a unit vector in screen space', () => {
    expect(facingVector('up')).toEqual({ x: 0, y: -1 });
    expect(facingVector('down')).toEqual({ x: 0, y: 1 });
    expect(facingVector('left')).toEqual({ x: -1, y: 0 });
    expect(facingVector('right')).toEqual({ x: 1, y: 0 });
  });

  it('defaults to facing the camera', () => {
    expect(facingVector(undefined)).toEqual({ x: 0, y: 1 });
    expect(facingVector('sideways')).toEqual({ x: 0, y: 1 });
  });
});

describe('directionBetween', () => {
  it('picks the dominant axis', () => {
    expect(directionBetween(0, 0, 100, 10)).toBe('right');
    expect(directionBetween(0, 0, -100, 10)).toBe('left');
    expect(directionBetween(0, 0, 10, 100)).toBe('down');
    expect(directionBetween(0, 0, 10, -100)).toBe('up');
  });

  it('resolves a perfect diagonal vertically', () => {
    expect(directionBetween(0, 0, 50, 50)).toBe('down');
    expect(directionBetween(0, 0, 50, -50)).toBe('up');
  });
});

describe('scoreInteractionTarget', () => {
  it('rejects anything past its reach', () => {
    expect(scoreInteractionTarget(0, 0, 'down', 0, 100, 90)).toBeNull();
  });

  it('accepts a target exactly at the reach limit', () => {
    expect(scoreInteractionTarget(0, 0, 'down', 0, 90, 90)).not.toBeNull();
  });

  it('scores a coincident target as perfect', () => {
    expect(scoreInteractionTarget(100, 100, 'down', 100, 100, 90))
      .toEqual({ distance: 0, score: 0 });
  });

  it('prefers what the player is facing over what is beside them', () => {
    const ahead = scoreInteractionTarget(0, 0, 'down', 0, 70, 90)!;
    const beside = scoreInteractionTarget(0, 0, 'down', 70, 0, 90)!;
    expect(ahead.distance).toBeCloseTo(beside.distance, 5);
    expect(ahead.score).toBeLessThan(beside.score);
  });

  it('applies the full facing bias to a perfectly aligned target', () => {
    const aligned = scoreInteractionTarget(0, 0, 'right', 70, 0, 90)!;
    expect(aligned.score).toBeCloseTo(70 - FACING_BIAS, 5);
  });

  it('rejects a distant target behind the player', () => {
    expect(scoreInteractionTarget(0, 0, 'down', 0, -80, 90)).toBeNull();
  });

  it('still reaches something behind but almost touching', () => {
    const behindClose = scoreInteractionTarget(0, 0, 'down', 0, -(BEHIND_GRACE_DISTANCE - 4), 90);
    expect(behindClose).not.toBeNull();
  });

  it('gives a close bonus inside arm’s reach', () => {
    const near = scoreInteractionTarget(0, 0, 'right', 40, 0, 90)!;
    // 40 - facing bias - close bonus
    expect(near.score).toBeCloseTo(40 - FACING_BIAS - CLOSE_BONUS, 5);
  });

  it('does not give the close bonus just outside it', () => {
    const far = scoreInteractionTarget(0, 0, 'right', 60, 0, 90)!;
    expect(far.score).toBeCloseTo(60 - FACING_BIAS, 5);
  });

  it('reports the true euclidean distance', () => {
    const diag = scoreInteractionTarget(0, 0, 'down', 30, 40, 90)!;
    expect(diag.distance).toBeCloseTo(50, 5);
  });

  it('is symmetric under translation', () => {
    const atOrigin = scoreInteractionTarget(0, 0, 'down', 0, 60, 90)!;
    const elsewhere = scoreInteractionTarget(900, 700, 'down', 900, 760, 90)!;
    expect(elsewhere.score).toBeCloseTo(atOrigin.score, 10);
  });
});

describe('rankCandidates / pickBestCandidate', () => {
  const c = (priority: number, score: number, id: string) => ({ priority, score, id });

  it('returns null for an empty field', () => {
    expect(pickBestCandidate([])).toBeNull();
  });

  it('lets priority beat score outright', () => {
    const best = pickBestCandidate([c(4, -100, 'scenery'), c(0, 900, 'npc')])!;
    expect(best.id).toBe('npc');
  });

  it('falls back to score inside a band', () => {
    const best = pickBestCandidate([c(1, 40, 'far-item'), c(1, 10, 'near-item')])!;
    expect(best.id).toBe('near-item');
  });

  it('does not mutate the input array', () => {
    const input = [c(4, 0, 'a'), c(0, 0, 'b')];
    rankCandidates(input);
    expect(input[0].id).toBe('a');
  });

  it('ranks a full realistic field the way the player expects', () => {
    const field = [
      { ...c(INTERACTION_PRIORITY.scenery, -20, 'barrel') },
      { ...c(INTERACTION_PRIORITY.npc, 50, 'merchant') },
      { ...c(INTERACTION_PRIORITY.item, 5, 'rope') },
      { ...c(INTERACTION_PRIORITY.transition, -60, 'gate') },
      { ...c(INTERACTION_PRIORITY.lore, 0, 'plaque') },
    ];
    expect(rankCandidates(field).map((f) => f.id))
      .toEqual(['merchant', 'rope', 'plaque', 'gate', 'barrel']);
  });
});

describe('INTERACTION_RADIUS', () => {
  it('gives scenery the tightest reach of anything', () => {
    const others = Object.entries(INTERACTION_RADIUS)
      .filter(([k]) => k !== 'scenery')
      .map(([, v]) => v);
    expect(INTERACTION_RADIUS.scenery).toBeLessThan(Math.min(...others));
  });
});

describe('rectContains', () => {
  const rect = { x: 10, y: 20, width: 100, height: 50 };

  it('accepts interior and edge points', () => {
    expect(rectContains(rect, 50, 40)).toBe(true);
    expect(rectContains(rect, 10, 20)).toBe(true);
    expect(rectContains(rect, 110, 70)).toBe(true);
  });

  it('rejects points outside', () => {
    expect(rectContains(rect, 9, 40)).toBe(false);
    expect(rectContains(rect, 50, 71)).toBe(false);
  });
});
