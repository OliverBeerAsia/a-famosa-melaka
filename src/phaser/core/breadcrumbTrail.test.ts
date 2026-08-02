import { describe, it, expect } from 'vitest';
import { BreadcrumbTrail, DEFAULT_MIN_CRUMB_DISTANCE } from './breadcrumbTrail';
import {
  DEFAULT_FOLLOW_TUNING,
  resolveFollowStep,
} from '../systems/behaviors/FollowBehavior';

describe('BreadcrumbTrail', () => {
  it('starts empty', () => {
    const trail = new BreadcrumbTrail();
    expect(trail.length).toBe(0);
    expect(trail.head()).toBeNull();
    expect(trail.at(1)).toBeNull();
  });

  it('lays the first crumb unconditionally', () => {
    const trail = new BreadcrumbTrail();
    expect(trail.record(10, 10, 'down', false)).toBe(true);
    expect(trail.length).toBe(1);
  });

  it('ignores a leader who has barely moved', () => {
    const trail = new BreadcrumbTrail();
    trail.record(10, 10, 'down', false);
    expect(trail.record(10 + DEFAULT_MIN_CRUMB_DISTANCE - 0.5, 10, 'down', false)).toBe(false);
    expect(trail.length).toBe(1);
  });

  it('lays a crumb once the leader has moved far enough', () => {
    const trail = new BreadcrumbTrail();
    trail.record(0, 0, 'down', false);
    expect(trail.record(10, 0, 'right', true)).toBe(true);
    expect(trail.length).toBe(2);
  });

  it('does not grow past its cap, dropping the oldest crumb', () => {
    const trail = new BreadcrumbTrail(5);
    for (let i = 0; i < 20; i += 1) trail.record(i * 10, 0, 'right', true);
    expect(trail.length).toBe(5);
    expect(trail.head()!.x).toBe(190);
  });

  it('reads back crumbs by delay from the head', () => {
    const trail = new BreadcrumbTrail();
    [0, 10, 20, 30].forEach((x) => trail.record(x, 0, 'right', true));
    expect(trail.at(1)!.x).toBe(30);
    expect(trail.at(2)!.x).toBe(20);
    expect(trail.at(4)).toBeNull();   // needs MORE than `delay` crumbs
  });

  it('rejects a non-positive delay', () => {
    const trail = new BreadcrumbTrail();
    trail.record(0, 0, 'down', false);
    expect(trail.at(0)).toBeNull();
    expect(trail.at(-3)).toBeNull();
  });

  it('prefills to the requested depth even though the crumbs coincide', () => {
    const trail = new BreadcrumbTrail();
    trail.prefill(15, { x: 100, y: 200, facing: 'down', walking: false });
    expect(trail.length).toBe(15);
    expect(trail.at(15)).toBeNull();
    expect(trail.at(14)!.x).toBe(100);
  });

  it('prefill never exceeds the cap', () => {
    const trail = new BreadcrumbTrail(6);
    trail.prefill(50, { x: 1, y: 2, facing: 'up', walking: false });
    expect(trail.length).toBe(6);
  });

  it('clears', () => {
    const trail = new BreadcrumbTrail();
    trail.record(0, 0, 'down', false);
    trail.clear();
    expect(trail.length).toBe(0);
  });
});

describe('resolveFollowStep', () => {
  const speed = 200;
  const crumb = (x: number, y: number, facing = 'down') => ({ x, y, facing, walking: true });

  it('waits when the trail is not deep enough yet', () => {
    expect(resolveFollowStep(0, 0, null, speed)).toEqual({ action: 'wait' });
  });

  it('idles once inside the arrival distance', () => {
    const step = resolveFollowStep(0, 0, crumb(5, 5, 'left'), speed);
    expect(step).toEqual({ action: 'idle', facing: 'left' });
  });

  it('adopts the leader’s facing while idle', () => {
    const step = resolveFollowStep(100, 100, crumb(100, 100, 'up'), speed);
    expect(step.action).toBe('idle');
    expect((step as { facing: string }).facing).toBe('up');
  });

  it('falls back to facing the camera when the crumb has no facing', () => {
    const step = resolveFollowStep(0, 0, { x: 0, y: 0, facing: '', walking: false }, speed);
    expect((step as { facing: string }).facing).toBe('down');
  });

  it('moves toward the crumb at follow speed', () => {
    const step = resolveFollowStep(0, 0, crumb(50, 0), speed);
    expect(step.action).toBe('move');
    const move = step as { vx: number; vy: number; direction: string };
    expect(move.vx).toBeCloseTo(speed * DEFAULT_FOLLOW_TUNING.speedFactor, 5);
    expect(move.vy).toBeCloseTo(0, 5);
    expect(move.direction).toBe('right');
  });

  it('speeds up when it drifts past the catch-up distance', () => {
    const near = resolveFollowStep(0, 0, crumb(50, 0), speed) as { vx: number };
    const far = resolveFollowStep(0, 0, crumb(120, 0), speed) as { vx: number };
    expect(Math.abs(far.vx)).toBeGreaterThan(Math.abs(near.vx));
    expect(far.vx).toBeCloseTo(speed * DEFAULT_FOLLOW_TUNING.catchUpSpeedFactor, 5);
  });

  it('teleports rather than drifting forever when hopelessly far behind', () => {
    const step = resolveFollowStep(0, 0, crumb(500, 0), speed);
    expect(step).toEqual({ action: 'teleport', x: 500, y: 0 });
  });

  it('picks the dominant axis for the walk animation', () => {
    expect((resolveFollowStep(0, 0, crumb(0, -60), speed) as { direction: string }).direction).toBe('up');
    expect((resolveFollowStep(0, 0, crumb(0, 60), speed) as { direction: string }).direction).toBe('down');
    expect((resolveFollowStep(0, 0, crumb(-60, 0), speed) as { direction: string }).direction).toBe('left');
  });

  it('keeps the velocity magnitude equal to the chosen speed', () => {
    const move = resolveFollowStep(0, 0, crumb(30, 40), speed) as { vx: number; vy: number };
    expect(Math.hypot(move.vx, move.vy))
      .toBeCloseTo(speed * DEFAULT_FOLLOW_TUNING.speedFactor, 5);
  });

  it('is boundary-exact at the arrival distance', () => {
    const at = resolveFollowStep(0, 0, crumb(DEFAULT_FOLLOW_TUNING.arriveDistance, 0), speed);
    expect(at.action).toBe('idle');
    const just = resolveFollowStep(0, 0, crumb(DEFAULT_FOLLOW_TUNING.arriveDistance + 1, 0), speed);
    expect(just.action).toBe('move');
  });

  it('respects a custom tuning', () => {
    const tuning = { ...DEFAULT_FOLLOW_TUNING, arriveDistance: 100 };
    expect(resolveFollowStep(0, 0, crumb(50, 0), speed, tuning).action).toBe('idle');
  });
});
