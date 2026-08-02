/**
 * `window.__melakaDebug` — the DEV-only acceptance hook.
 *
 * Plate installs have to be walked end to end: every exit taken through the
 * real `switchLocation` path, every arrival checked against the walk mask,
 * every location visited at every phase of day. Driving that with raw
 * keystrokes is not repeatable, so the engine exposes a small, STABLE surface
 * that an automated pass drives instead.
 *
 * Stable is the operative word. The shape below deliberately does not mirror
 * the scene's internals — an acceptance script must not have to know which
 * system currently owns the cast — so decomposition work like this can move
 * things around without breaking the harness.
 *
 * Stripped from production builds by the `import.meta.env.DEV` guard at the
 * call site.
 */

export interface DebugHooks {
  location(): string;
  player(): { x: number; y: number };
  camera(): { x: number; y: number; w: number; h: number };
  world(): { width: number; height: number };
  timeOfDay(): string;
  /** "Can a character stand with their ORIGIN here?" — feet-level, both shoulders. */
  walkable(x: number, y: number): boolean | null;
  place(x: number, y: number): void;
  transitions(): Array<{ target: string; label: string }>;
  travel(target: string, spawnPoint?: { x: number; y: number }): void;
  interact(): void;
  advanceTime(hours: number): void;
  /**
   * The clock, as {hour, minute, day}.
   *
   * Stage 5's acceptance assertions are all of the form "at 19:00, Aminah is
   * observed leaving her stall" — which an automated pass cannot check without
   * being able to READ the clock it just moved. `advanceTime` alone is not
   * enough: a harness that only knows how many hours it asked for cannot tell a
   * missed step from a wrapped day.
   */
  clock(): { hour: number; minute: number; day: number };
  /** The night watch, when one is on duty: state, alert level, position. */
  nightWatch(): {
    onDuty: boolean;
    state: string;
    alertLevel: number;
    x: number | null;
    y: number | null;
    dousedLights: number[];
  };
  /** Ambient residents present in this location, with live positions. */
  residents(): Array<{ id: string; x: number; y: number }>;
  npcs(): Array<{ id: string | null; x: number; y: number }>;
  target(): { type: string; id: string; label: string } | null;
  counts(): Record<string, number | null>;
  /**
   * Pin the visual tier for a capture.
   *
   * The dynamic quality governor downgrades on a slow frame, and a headless
   * capture is always a slow frame — so without this an acceptance run silently
   * measures the `low` profile (no grain, four animated props instead of
   * fifteen) and reports it as the shipping look. A harness that cannot pin the
   * tier is measuring the harness.
   */
  setQuality(mode: 'auto' | 'high' | 'balanced' | 'low', dynamic?: boolean): void;
  /**
   * The v0.12 juice probe: what the lens is doing, and whether anything is in
   * phase with anything else.
   *
   * `propPhases` is the benchmark-9 evidence — the CURRENT animation frame
   * index of every animated prop, grouped by type. Two same-type props on the
   * same frame in more than 15 % of sampled captures is the defect this pass
   * exists to kill, and reading it out of the live scene is the only way to
   * prove it is gone.
   */
  juice(): {
    postFX: boolean;
    lut: string | null;
    vignette: number;
    grain: number;
    haze: number;
    /** frame index per animated prop, keyed by prop type. */
    propPhases: Record<string, number[]>;
    /** step index per flickering practical, keyed by its state sequence. */
    flickerPhases: Record<string, number[]>;
    /** live / capacity for the surface-response pool. */
    surfacePool: { live: number; capacity: number };
    /** Water palette cycle, where this location ships one. */
    water: { active: boolean; frame: number; frames: number; periodMs: number } | null;
    /** Live ambient fauna, with the depth each one sorts at. */
    fauna: Array<{ id: string; state: string; x: number; y: number; depth: number; standing: boolean }>;
    /** Live crowd members — fauna + crowd must stay under maxCrowdSize. */
    crowd: number;
  };
}

/** Publish the hook onto `window`. Call once per scene create, DEV only. */
export function installDebugHooks(hooks: DebugHooks) {
  (window as unknown as { __melakaDebug: DebugHooks }).__melakaDebug = hooks;
}
