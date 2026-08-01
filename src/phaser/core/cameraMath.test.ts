import { describe, expect, it } from 'vitest';
import {
  applyDeadzone,
  clampScroll,
  isScrolling,
  lookaheadOffset,
  DEADZONE_WIDTH,
  DEADZONE_HEIGHT,
  LOOKAHEAD_MAX,
} from '../core/cameraMath';

const VIEW = { w: 960, h: 540 };
const FLIP_SCREEN = { width: 960, height: 540 };   // pre-Stage-3 plates
const SCROLLING = { width: 1920, height: 1080 };   // Forge-composed rua-direita

describe('clampScroll', () => {
  it('pins a viewport-sized world at the origin wherever the player stands', () => {
    // This is the "camera ships as a visual no-op" contract: on the four
    // locations that still use 320x180 plates, nothing may move.
    for (const [x, y] of [[0, 0], [480, 270], [959, 539], [-100, 900]]) {
      expect(clampScroll(x, y, FLIP_SCREEN, VIEW.w, VIEW.h)).toEqual({ x: 0, y: 0 });
    }
  });

  it('centres the view on the player in the middle of a large world', () => {
    expect(clampScroll(960, 540, SCROLLING, VIEW.w, VIEW.h)).toEqual({ x: 480, y: 270 });
  });

  it('clamps at the world edges instead of showing the void', () => {
    expect(clampScroll(10, 10, SCROLLING, VIEW.w, VIEW.h)).toEqual({ x: 0, y: 0 });
    expect(clampScroll(1910, 1070, SCROLLING, VIEW.w, VIEW.h)).toEqual({ x: 960, y: 540 });
  });

  it('clamps each axis independently', () => {
    // Far right, vertically centred: x clamps, y follows.
    expect(clampScroll(1900, 540, SCROLLING, VIEW.w, VIEW.h)).toEqual({ x: 960, y: 270 });
  });

  it('centres a world narrower than the viewport rather than clamping to zero', () => {
    const narrow = { width: 640, height: 540 };
    expect(clampScroll(320, 270, narrow, VIEW.w, VIEW.h).x).toBe(-160);
  });
});

describe('applyDeadzone', () => {
  it('does not move while the target stays inside the deadzone', () => {
    const focus = { x: 500, y: 300 };
    const inside = applyDeadzone(focus.x, focus.y, focus.x + DEADZONE_WIDTH / 2 - 1, focus.y + DEADZONE_HEIGHT / 2 - 1);
    expect(inside).toEqual(focus);
  });

  it('drags the focus along once the target crosses the deadzone edge', () => {
    const moved = applyDeadzone(500, 300, 500 + DEADZONE_WIDTH, 300);
    // The focus ends exactly one half-deadzone behind the target.
    expect(moved.x).toBe(500 + DEADZONE_WIDTH - DEADZONE_WIDTH / 2);
    expect(moved.y).toBe(300);
  });

  it('is symmetric for the opposite direction', () => {
    const moved = applyDeadzone(500, 300, 500 - DEADZONE_HEIGHT * 4, 300 - DEADZONE_HEIGHT);
    expect(moved.y).toBe(300 - DEADZONE_HEIGHT + DEADZONE_HEIGHT / 2);
  });
});

describe('lookaheadOffset', () => {
  it('is zero when standing still', () => {
    expect(lookaheadOffset(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('leads in the direction of travel and saturates at the maximum', () => {
    expect(lookaheadOffset(1000, 0).x).toBe(LOOKAHEAD_MAX);
    expect(lookaheadOffset(-1000, 0).x).toBe(-LOOKAHEAD_MAX);
    expect(lookaheadOffset(0, 1000).y).toBe(LOOKAHEAD_MAX);
  });

  it('scales proportionally below the reference speed', () => {
    const half = lookaheadOffset(80, 0).x;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(LOOKAHEAD_MAX);
  });
});

describe('isScrolling', () => {
  it('is false for a plate that exactly fills the viewport', () => {
    expect(isScrolling(FLIP_SCREEN, VIEW.w, VIEW.h)).toBe(false);
  });

  it('is true as soon as either axis exceeds the viewport', () => {
    expect(isScrolling(SCROLLING, VIEW.w, VIEW.h)).toBe(true);
    expect(isScrolling({ width: 960, height: 1080 }, VIEW.w, VIEW.h)).toBe(true);
  });
});
