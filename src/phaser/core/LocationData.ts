/**
 * LocationData — the single source of truth for per-location world data.
 *
 * Every location ships one `src/data/locations/<id>.location.json` file whose
 * coordinates are authored in NATIVE plate pixels (320x180). This module is the
 * only place that multiplies by `world.scale` (3) to reach the 960x540 screen
 * space the engine renders in. Nothing downstream should ever scale again.
 *
 * Before Stage 1 this data lived in eight places (location-scenes.json plus
 * seven hardcoded TS tables) and drifted every time a plate was regenerated;
 * `tools/migrate-location-data.cjs` merged them and
 * `tools/validate-location-data.cjs` (pretest + prebuild) keeps every
 * coordinate inside the plate from now on.
 */

import aFamosaGate from '../../data/locations/a-famosa-gate.location.json';
import ruaDireita from '../../data/locations/rua-direita.location.json';
import stPaulsChurch from '../../data/locations/st-pauls-church.location.json';
import waterfront from '../../data/locations/waterfront.location.json';
import kampung from '../../data/locations/kampung.location.json';

// ---------------------------------------------------------------------------
// Types (world space — i.e. already multiplied by world.scale)
// ---------------------------------------------------------------------------

export type LightType = 'torch' | 'lantern' | 'cookingFire' | 'window';
export type FootstepSurface = 'stone' | 'wood' | 'dirt';
export type RuntimeMode = 'legacy-backdrop' | 'isometric';
export type AnimatedPropType =
  | 'torch' | 'palm-sway' | 'awning-flutter' | 'smoke' | 'seagull' | 'flag';

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface ShadeZone extends Rect { alpha: number }

export interface AmbientLayer { key: string; volume: number }

export interface LocationTransition {
  targetLocation: string;
  label: string;
  triggerArea: Rect;
  spawnAt: Point;
  requirements?: Record<string, unknown>;
  showWhenLocked?: boolean;
  lockedLabel?: string;
  blockedMessage?: string;
}

export interface LocationProp {
  sprite: string;
  x: number;
  y: number;
  scale?: number;
  examineText?: string;
  particles?: 'smoke' | 'steam' | 'dust';
}

export interface AnimatedProp { type: AnimatedPropType; x: number; y: number }
export interface LocationLight { type: LightType; x: number; y: number }

/**
 * A crowd route. `points` is the authored polyline (>= 2 points, world space);
 * `start`/`end` are its ends, kept so pre-Stage-3 straight-line consumers keep
 * working unchanged.
 */
export interface CrowdPath { start: Point; end: Point; points: Point[]; speed?: number; id?: string }

export interface LocationCrowd {
  maxCrowd: number;
  density: number;
  crowdTypes: string[];
  paths: CrowdPath[];
}

/**
 * A foreground occluder cut from the plate by the Forge compositor and drawn
 * back at the SAME pixel coordinates, so it is invisible until a character
 * walks behind it and `worldDepth(depthY)` sorts them underneath.
 */
export interface LocationOverlay {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** World-space y this occluder sorts at (its ground contact line). */
  depthY: number;
}

/** A prop painted INTO the plate. Data only — never drawn as a sprite. */
export interface LocationPlateProp {
  key: string;
  type: string;
  x: number;
  y: number;
  label?: string;
  examineText?: string;
  interactive?: boolean;
}

export interface LocationAudio {
  music: string;
  nightMusic: string;
  ambientSounds: AmbientLayer[];
  nightAmbientSounds: AmbientLayer[];
  footstepSurface: FootstepSurface;
  transitionSound: string | null;
}

export interface LocationVisual {
  /** Transition flash tint, [r, g, b] 0-255. Not a coordinate — never scaled. */
  transitionTint: number[];
  fogTint: number;
  fogSpeed: number;
  hazeTint: number;
  sunAnchor: Point;
  aoZones: ShadeZone[];
  canopyShadows: ShadeZone[];
}

export interface LocationItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  description: string;
}

export interface LocationLoreObject { id: string; x: number; y: number }

export interface LocationPlate {
  background: string;
  variants: Record<string, string>;
  runtimeMode: RuntimeMode;
  targetMode: string;
  authoringBasis: string;
  anchor: string;
  depthStrategy: string;
  tileWidth: number;
  tileHeight: number;
  isoMapKey?: string;
  mapFile?: string;
  /** Texture key of the walk mask (R = walkable, G = surface type), if any. */
  walkMask?: string;
  /** Authored intent; the camera actually decides from world vs viewport size. */
  camera?: 'scrolling' | 'fixed';
}

export interface LocationRuntime {
  id: string;
  name: string;
  /**
   * Bumped whenever this location's coordinate space changes (a plate rebuild
   * at a new native size). A save carrying an older version has its stored
   * position discarded and the player snapped to `playerStart` — the
   * alternative is loading into the middle of a building.
   */
  coordVersion: number;
  /** Native plate size and the single scale factor applied to every coordinate. */
  world: { scale: number; nativeWidth: number; nativeHeight: number };
  /** World-space canvas size (native * scale). */
  size: { width: number; height: number };
  plate: LocationPlate;
  collisionRects: Rect[];
  playerStart: Point;
  npcPositions: Record<string, Point>;
  transitions: LocationTransition[];
  props: LocationProp[];
  plateProps: LocationPlateProp[];
  overlays: LocationOverlay[];
  animatedProps: AnimatedProp[];
  lights: LocationLight[];
  fires: Point[];
  audio: LocationAudio;
  visual: LocationVisual;
  crowd: LocationCrowd;
  items: LocationItem[];
  loreObjects: LocationLoreObject[];
}

// ---------------------------------------------------------------------------
// Native -> world transform
// ---------------------------------------------------------------------------

const RAW_LOCATIONS: Record<string, any> = {
  'a-famosa-gate': aFamosaGate,
  'rua-direita': ruaDireita,
  'st-pauls-church': stPaulsChurch,
  'waterfront': waterfront,
  'kampung': kampung,
};

const scalePoint = (p: any, s: number): Point => ({ x: p.x * s, y: p.y * s });
const scaleRect = (r: any, s: number): Rect => ({
  x: r.x * s, y: r.y * s, width: r.width * s, height: r.height * s,
});
const scaleZone = (z: any, s: number): ShadeZone => ({ ...scaleRect(z, s), alpha: z.alpha });

/**
 * Structural validation. Throws on a malformed location file rather than
 * letting a missing field surface as an invisible NaN coordinate at runtime.
 */
function validateShape(id: string, raw: any): void {
  const fail = (msg: string): never => {
    throw new Error(`[LocationData] ${id}.location.json: ${msg}`);
  };
  if (!raw || typeof raw !== 'object') fail('not an object');
  if (raw.id !== id) fail(`id mismatch (file says "${raw.id}")`);
  if (!raw.world || typeof raw.world.scale !== 'number' || raw.world.scale <= 0) {
    fail('missing or invalid world.scale');
  }
  if (typeof raw.world.nativeWidth !== 'number' || typeof raw.world.nativeHeight !== 'number') {
    fail('missing world.nativeWidth / world.nativeHeight');
  }
  if (!raw.plate?.background) fail('missing plate.background');
  if (!Array.isArray(raw.collision?.rects)) fail('missing collision.rects');
  if (!raw.spawns?.player) fail('missing spawns.player');
  for (const key of ['transitions', 'props', 'animatedProps', 'lights', 'fires', 'items', 'loreObjects'] as const) {
    if (!Array.isArray(raw[key])) fail(`missing array "${key}"`);
  }
  if (!raw.audio?.music) fail('missing audio.music');
  if (!raw.crowd || !Array.isArray(raw.crowd.paths)) fail('missing crowd.paths');
}

function build(id: string, raw: any): LocationRuntime {
  validateShape(id, raw);
  const s: number = raw.world.scale;

  const npcPositions: Record<string, Point> = {};
  for (const [npcId, p] of Object.entries(raw.npcs || {})) {
    npcPositions[npcId] = scalePoint(p, s);
  }

  return {
    id,
    name: raw.name,
    coordVersion: raw.coordVersion ?? 1,
    world: raw.world,
    size: { width: raw.world.nativeWidth * s, height: raw.world.nativeHeight * s },
    plate: raw.plate,
    collisionRects: raw.collision.rects.map((r: any) => scaleRect(r, s)),
    playerStart: scalePoint(raw.spawns.player, s),
    npcPositions,
    transitions: raw.transitions.map((t: any) => ({
      ...t,
      triggerArea: scaleRect(t.triggerArea, s),
      spawnAt: scalePoint(t.spawnAt, s),
    })),
    props: raw.props.map((p: any) => ({ ...p, x: p.x * s, y: p.y * s })),
    plateProps: (raw.plateProps || []).map((p: any) => ({ ...p, x: p.x * s, y: p.y * s })),
    overlays: (raw.overlays || []).map((o: any) => ({
      key: o.key,
      x: o.x * s,
      y: o.y * s,
      width: o.width * s,
      height: o.height * s,
      depthY: o.depthY * s,
    })),
    animatedProps: raw.animatedProps.map((p: any) => ({ type: p.type, x: p.x * s, y: p.y * s })),
    lights: raw.lights.map((l: any) => ({ type: l.type, x: l.x * s, y: l.y * s })),
    fires: raw.fires.map((f: any) => scalePoint(f, s)),
    audio: raw.audio,
    visual: {
      transitionTint: raw.visual.transitionTint,
      fogTint: raw.visual.fogTint,
      fogSpeed: raw.visual.fogSpeed,
      hazeTint: raw.visual.hazeTint,
      sunAnchor: scalePoint(raw.visual.sunAnchor, s),
      aoZones: (raw.visual.aoZones || []).map((z: any) => scaleZone(z, s)),
      canopyShadows: (raw.visual.canopyShadows || []).map((z: any) => scaleZone(z, s)),
    },
    crowd: {
      maxCrowd: raw.crowd.maxCrowd,
      density: raw.crowd.density,
      crowdTypes: raw.crowd.crowdTypes || [],
      paths: raw.crowd.paths.map((p: any) => {
        // Two authoring forms collapse to one runtime shape: a polyline whose
        // ends are also exposed as start/end.
        const points: Point[] = Array.isArray(p.points)
          ? p.points.map((pt: any) => scalePoint(pt, s))
          : [scalePoint(p.start, s), scalePoint(p.end, s)];
        return {
          id: p.id,
          speed: p.speed,
          points,
          start: points[0],
          end: points[points.length - 1],
        };
      }),
    },
    items: raw.items.map((i: any) => ({ ...i, x: i.x * s, y: i.y * s })),
    loreObjects: raw.loreObjects.map((o: any) => ({ id: o.id, x: o.x * s, y: o.y * s })),
  };
}

const LOCATIONS: Record<string, LocationRuntime> = Object.fromEntries(
  Object.entries(RAW_LOCATIONS).map(([id, raw]) => [id, build(id, raw)])
);

// ---------------------------------------------------------------------------
// Typed accessors
// ---------------------------------------------------------------------------

/** Every known location id, in authoring order. */
export const LOCATION_IDS: string[] = Object.keys(LOCATIONS);

/** World data for a location, or undefined if the id is unknown. */
export function getLocation(id: string): LocationRuntime | undefined {
  return LOCATIONS[id];
}

/** World data for a location; throws if the id is unknown. */
export function requireLocation(id: string): LocationRuntime {
  const location = LOCATIONS[id];
  if (!location) throw new Error(`[LocationData] unknown location "${id}"`);
  return location;
}

export const getLocationAudio = (id: string) => getLocation(id)?.audio;
export const getLocationVisual = (id: string) => getLocation(id)?.visual;
export const getLocationCrowd = (id: string) => getLocation(id)?.crowd;
export const getLocationLights = (id: string) => getLocation(id)?.lights ?? [];
export const getLocationFires = (id: string) => getLocation(id)?.fires ?? [];
export const getLocationProps = (id: string) => getLocation(id)?.props ?? [];
export const getLocationOverlays = (id: string) => getLocation(id)?.overlays ?? [];
export const getLocationPlateProps = (id: string) => getLocation(id)?.plateProps ?? [];
export const getLocationAnimatedProps = (id: string) => getLocation(id)?.animatedProps ?? [];
export const getLocationItems = (id: string) => getLocation(id)?.items ?? [];
export const getLocationLoreObjects = (id: string) => getLocation(id)?.loreObjects ?? [];
export const getLocationTransitions = (id: string) => getLocation(id)?.transitions ?? [];

/** True when at least one location actually runs the isometric tilemap path. */
export function anyLocationUsesIsometric(): boolean {
  return Object.values(LOCATIONS).some((l) => l.plate.runtimeMode === 'isometric');
}

/** Iso tilemap keys for the locations that actually run in isometric mode. */
export function isometricMapKeys(): string[] {
  return Object.values(LOCATIONS)
    .filter((l) => l.plate.runtimeMode === 'isometric' && l.plate.isoMapKey)
    .map((l) => l.plate.isoMapKey as string);
}

export default LOCATIONS;
