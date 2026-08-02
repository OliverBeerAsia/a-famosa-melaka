/**
 * Depth bands — the single source of truth for render ordering.
 *
 * World objects (player, NPCs, world items, lore objects, environment props)
 * are Y-sorted: their render depth equals floor(y), so an entity standing
 * lower on screen (larger y) draws in front of one standing higher (smaller y),
 * giving Ultima VII-style overlap/occlusion.
 *
 * The world band is clamped to [DEPTH_WORLD_MIN, DEPTH_WORLD_MAX]. Scene space
 * is 960x540 so character/item y maxes out near 540, and the largest authored
 * environment prop worldY is ~656; the clamp ceiling (780) is purely defensive
 * so a world depth can never collide with the FX/lighting band which starts at
 * DEPTH_FX_FLOOR (mist=800, fog=905+, lights/grade/grain=940-961). UI,
 * indicators and notifications live at DEPTH_UI_FLOOR (1001) and above and must
 * always stay on top.
 *
 * IMPORTANT: do not raise DEPTH_WORLD_MAX to or above DEPTH_FX_FLOOR, and do
 * not change the fixed FX/lighting/UI depths used elsewhere in the engine.
 *
 * This module is deliberately Phaser-free so it can be unit-tested directly.
 */

/** Lowest depth a Y-sorted world object may occupy. */
export const DEPTH_WORLD_MIN = 0;
/** Highest depth a Y-sorted world object may occupy (must stay < DEPTH_FX_FLOOR). */
export const DEPTH_WORLD_MAX = 780;
/** Bottom of the screen-space FX / lighting band. */
export const DEPTH_FX_FLOOR = 800;
/** Top of the FX band — everything at or above DEPTH_UI_FLOOR is UI. */
export const DEPTH_FX_CEILING = 1000;
/** Bottom of the UI / HUD / indicator band. */
export const DEPTH_UI_FLOOR = 1001;

/** Seagulls fly in the sky, so they sit inside the FX band, above all props. */
export const DEPTH_FX_SEAGULL = 900;

/**
 * Named slots inside the UI band, so the handful of screen-space overlays stop
 * carrying bare numbers around. Values are exactly what they have always been.
 */
/** Interaction indicators pinned over an NPC's head. */
export const DEPTH_UI_INDICATOR = 1001;
/** The location name card shown on arrival. */
export const DEPTH_UI_NAME_CARD = 1001;
/** Toasts and the interaction prompt — one step above the name card. */
export const DEPTH_UI_NOTIFICATION = 1002;
/** The interaction prompt strip along the bottom of the screen. */
export const DEPTH_UI_PROMPT = 1002;

/**
 * Sprites are anchored above their feet, so a character standing at the very
 * bottom of the world sorts at y + this much. The depth scale has to leave room
 * for it or the last row of the world would clamp flat.
 */
const FOOT_HEADROOM = 96;

/**
 * World height -> depth scale. 1 for every world that fits inside the band
 * (all 320x180 plates: y never exceeds 780), less than 1 for a taller
 * scrolling world.
 */
let depthScale = 1;

/**
 * Tell the depth band how tall the current world is.
 *
 * The band is fixed (world depths must stay below DEPTH_FX_FLOOR = 800), but
 * the WORLD is not: a Forge-composed 640x360 plate is 1080px tall, and mapping
 * y straight to depth would clamp everything below y=780 to a single value —
 * i.e. the bottom quarter of the street would lose Y-sorting entirely and
 * characters would stop going behind the near buildings. So y is scaled into
 * the band instead. Ordering is preserved exactly; only the resolution changes.
 *
 * Call once per location, before any world object is created.
 */
export function configureWorldDepth(worldHeight: number): number {
  const needed = worldHeight + FOOT_HEADROOM;
  depthScale = needed > DEPTH_WORLD_MAX ? DEPTH_WORLD_MAX / needed : 1;
  return depthScale;
}

/** The scale currently in force (1 unless a tall world configured otherwise). */
export function getWorldDepthScale(): number {
  return depthScale;
}

/**
 * Quantized, clamped Y-sort depth for a world object at world-space `y`.
 * Math.floor avoids z-fighting between near-equal y values.
 */
export function worldDepth(y: number): number {
  if (!Number.isFinite(y)) return DEPTH_WORLD_MIN;
  const scaled = y * depthScale;
  if (scaled < DEPTH_WORLD_MIN) return DEPTH_WORLD_MIN;
  if (scaled > DEPTH_WORLD_MAX) return DEPTH_WORLD_MAX;
  return Math.floor(scaled);
}
