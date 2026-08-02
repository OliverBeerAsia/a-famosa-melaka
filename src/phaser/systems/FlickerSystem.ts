/**
 * FlickerSystem — the 59 authored practicals stop being a still image at night.
 *
 * THE CONSTRAINT, STATED HONESTLY
 * -------------------------------
 * Our plates ship as RGBA composites with the time of day AND the light pools
 * already baked in (`relight-plates.cjs` light pass), and `compose-plate.cjs`
 * emits no index map. So classic in-place palette rotation — the Ultima VII
 * technique this is derived from — is simply not available at runtime, and a
 * shader that colour-matches 50 canon colours per pixel would be fragile and
 * pointless when we control the bake.
 *
 * THEREFORE: cycle offline, swap at runtime. `tools/forge/flame-pools.cjs`
 * pre-renders three palette STATES per radius class in canon colours; this
 * system lays a small ADDITIVE delta of that sprite over each baked pool and
 * advances its frame on the light type's own period. One texture-frame change
 * per tick, no per-frame work, no allocation.
 *
 *   type          period   states     dAlpha   dRadius   count in shipping data
 *   torch          900 ms  B A B C    +/-0.05  +/-1 px   5
 *   cookingFire   1200 ms  B A C B A  +/-0.07  +/-2 px   12
 *   lantern       1600 ms  B A B      +/-0.03   0        33
 *   window        3000 ms  B B A      +/-0.02   0        14   (a room behind
 *                                                              glass is nearly
 *                                                              steady)
 *
 * PHASE. Every instance is offset by the golden-ratio spreader in `core/phase`
 * and its period jittered +/-12 % from a position hash, so no two torches ever
 * pulse together and they never re-converge. That is benchmark item 9, which
 * this codebase failed 100 % before the v0.12 pass.
 *
 * CAP. At most 12 flickering practicals per location, chosen by distance to
 * the camera centre; the rest render their B state statically. Rua Direita has
 * 17 lights, so the cap costs nothing visible and bounds the worst case.
 */

import Phaser from 'phaser';
import { worldDepth } from '../core/depth';
import { phaseFor, frameAt, type PhasedTiming } from '../core/phase';
import { lightsAreLit } from '../core/lightingMath';
import type { SystemContext } from '../core/SystemContext';
import type { LocationLight } from '../core/LocationData';

/** Radius classes emitted by tools/forge/flame-pools.cjs. */
export const POOL_RADII = [34, 42, 50, 58] as const;

/** Frame index per palette state in the sheet: A hot, B base, C low. */
const STATE_FRAME = { A: 0, B: 1, C: 2 } as const;
type StateId = keyof typeof STATE_FRAME;

interface FlickerSpec {
  periodMs: number;
  /** The state sequence, one entry per step of the loop. */
  states: StateId[];
  /** Peak alpha deviation from the base. */
  dAlpha: number;
  /** Peak radius deviation, in NATIVE px. */
  dRadius: number;
  /** Alpha of the delta over the baked pool. */
  baseAlpha: number;
}

export const FLICKER_SPECS: Record<string, FlickerSpec> = {
  torch: { periodMs: 900, states: ['B', 'A', 'B', 'C'], dAlpha: 0.05, dRadius: 1, baseAlpha: 0.10 },
  cookingFire: { periodMs: 1200, states: ['B', 'A', 'C', 'B', 'A'], dAlpha: 0.07, dRadius: 2, baseAlpha: 0.10 },
  lantern: { periodMs: 1600, states: ['B', 'A', 'B'], dAlpha: 0.03, dRadius: 0, baseAlpha: 0.07 },
  window: { periodMs: 3000, states: ['B', 'B', 'A'], dAlpha: 0.02, dRadius: 0, baseAlpha: 0.05 },
};

/** Hard cap on animated practicals per location (spec §2.4). */
export const FLICKER_CAP = 12;

/** The radius class a light of native radius `r` renders with. */
export function poolClassFor(r: number): number {
  let best: number = POOL_RADII[0];
  let bestD = Infinity;
  for (const c of POOL_RADII) {
    const d = Math.abs(c - r);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function poolTextureKey(radiusClass: number): string {
  return `flame-pool-${radiusClass}`;
}

interface Practical {
  sprite: Phaser.GameObjects.Sprite;
  spec: FlickerSpec;
  timing: PhasedTiming;
  baseScale: number;
  radiusClass: number;
  nightOnly: boolean;
  /** Last frame written, so the swap is a no-op when nothing moved. */
  lastStep: number;
  animated: boolean;
}

export class FlickerSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private practicals: Practical[] = [];

  constructor(scene: Phaser.Scene, ctx: SystemContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  create() {
    this.destroyPracticals();

    const lights = this.ctx.location()?.lights ?? [];
    if (!lights.length) return;
    const scale = this.ctx.location()?.world.scale ?? 3;

    // Which 12 animate: nearest to the camera centre. The rest still draw
    // their base state — they are just static, which at 40 px across and
    // 0.07 alpha nobody can tell from a slow lantern.
    const camera = this.scene.cameras.main;
    const cx = camera.scrollX + camera.width / 2;
    const cy = camera.scrollY + camera.height / 2;
    const ranked = lights
      .map((light, index) => ({ light, index, d2: (light.x - cx) ** 2 + (light.y - cy) ** 2 }))
      .sort((a, b) => a.d2 - b.d2);
    const animated = new Set(ranked.slice(0, FLICKER_CAP).map((r) => r.index));

    // Instance index is per TYPE, so the golden-ratio spread is computed
    // within each family — ten lanterns spread across the lantern loop, not
    // across a mixed list where they would clump.
    const perType = new Map<string, number>();

    lights.forEach((light, index) => {
      const spec = FLICKER_SPECS[light.type];
      if (!spec) return;
      const radiusClass = poolClassFor(light.radius);
      const key = poolTextureKey(radiusClass);
      if (!this.scene.textures.exists(key)) return;

      const i = perType.get(light.type) ?? 0;
      perType.set(light.type, i + 1);

      const sprite = this.scene.add.sprite(light.x, light.y, key, STATE_FRAME.B);
      sprite.setOrigin(0.5, 0.5);
      // Native radius -> world px. The sheet frame is 2r native wide, so the
      // world scale is the ONLY multiplier: never scale by radius again.
      const baseScale = scale;
      sprite.setScale(baseScale);
      sprite.setBlendMode(Phaser.BlendModes.ADD);
      sprite.setAlpha(spec.baseAlpha);
      // worldDepth so a passing character occludes the pool correctly. NOT
      // raw y: in a 1080-tall world that lands inside the FX band.
      sprite.setDepth(worldDepth(light.y));

      this.practicals.push({
        sprite,
        spec,
        timing: phaseFor(i, spec.periodMs, light.x, light.y),
        baseScale,
        radiusClass,
        nightOnly: light.nightOnly,
        lastStep: -1,
        animated: animated.has(index),
      });
    });

    this.setTimeOfDay();
  }

  /**
   * Per frame: advance whichever practicals have crossed a step boundary.
   * Everything else is a compare-and-skip, so a still night costs one loop.
   */
  update() {
    if (!this.practicals.length) return;
    const now = this.scene.time.now;

    for (const p of this.practicals) {
      if (!p.animated || !p.sprite.visible) continue;
      const steps = p.spec.states.length;
      const step = frameAt(now, p.timing, steps);
      if (step === p.lastStep) continue;
      p.lastStep = step;

      const state = p.spec.states[step];
      p.sprite.setFrame(STATE_FRAME[state]);

      // A hot state is brighter and (for a flame) a touch bigger; a low state
      // is dimmer and smaller. Lanterns and windows keep their radius.
      const lift = state === 'A' ? 1 : state === 'C' ? -1 : 0;
      p.sprite.setAlpha(p.spec.baseAlpha + lift * p.spec.dAlpha);
      if (p.spec.dRadius) {
        p.sprite.setScale(p.baseScale * (1 + (lift * p.spec.dRadius) / p.radiusClass));
      }
    }
  }

  /** Practicals are lit at dusk and night, dark otherwise. */
  setTimeOfDay() {
    const phase = this.ctx.timeOfDay();
    const lit = lightsAreLit(phase);
    const dark = phase === 'night' || phase === 'dusk';
    this.practicals.forEach((p) => {
      p.sprite.setVisible(lit && (!p.nightOnly || dark));
      // Force the next update to write a frame rather than skipping on a
      // stale `lastStep` from before the lights went out.
      p.lastStep = -1;
    });
  }

  /** The quality tier changed: `low` freezes every pool on its base state. */
  applyQuality() {
    const freeze = this.ctx.quality() === 'low';
    this.practicals.forEach((p) => {
      p.animated = p.animated && !freeze;
      if (freeze) {
        p.sprite.setFrame(STATE_FRAME.B);
        p.sprite.setAlpha(p.spec.baseAlpha);
        p.sprite.setScale(p.baseScale);
      }
    });
  }

  /** For the DEV acceptance hook / benchmark-9 capture. */
  debugPhases(): Array<{ type: string; step: number; periodMs: number; offsetMs: number }> {
    const now = this.scene.time.now;
    return this.practicals.map((p) => ({
      type: p.spec.states.join(''),
      step: frameAt(now, p.timing, p.spec.states.length),
      periodMs: p.timing.periodMs,
      offsetMs: p.timing.offsetMs,
    }));
  }

  private destroyPracticals() {
    this.practicals.forEach((p) => p.sprite.destroy());
    this.practicals = [];
  }

  destroy() {
    this.destroyPracticals();
  }
}

export default FlickerSystem;
