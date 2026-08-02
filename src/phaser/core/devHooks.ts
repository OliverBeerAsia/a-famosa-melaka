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
  npcs(): Array<{ id: string | null; x: number; y: number }>;
  target(): { type: string; id: string; label: string } | null;
  counts(): Record<string, number | null>;
}

/** Publish the hook onto `window`. Call once per scene create, DEV only. */
export function installDebugHooks(hooks: DebugHooks) {
  (window as unknown as { __melakaDebug: DebugHooks }).__melakaDebug = hooks;
}
