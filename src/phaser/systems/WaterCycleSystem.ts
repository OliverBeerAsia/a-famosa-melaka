/**
 * WaterCycleSystem — the harbour moves.
 *
 * Benchmark technique 3 is Ultima VII's palette cycling: rotate a handful of
 * indices under the water and the whole strait animates for free. We cannot do
 * that in place — our plates ship as RGBA composites with the hour and the
 * practicals already baked in, and the compositor emits no index map — so the
 * cycling happens OFFLINE (`compose-plate.cjs --cycle`) and the runtime just
 * presents the frames in sequence. That is what U7 did in effect: a small set
 * of palette states shown in order.
 *
 * The cost is one `setTexture` per period tick, per region. There is no
 * per-frame work at all: the swap runs on a Phaser timer, not in `update()`.
 *
 *   location     region                 frames   period    offset
 *   waterfront   backdrop + basin       8        2400 ms   0
 *   kampung      river                  6        1800 ms   +700 ms
 *
 * The kampung offset exists so that if the two were ever on screen together
 * they would never tick on the same frame. They cannot be (they are separate
 * locations) — but the rule is the rule, and the day someone builds a vista
 * that shows both, it already holds.
 *
 * WHAT THIS REPLACED: `AtmosphereSystem.createWaterAnimations()`, which emitted
 * ADD particles tinted `0x5DADE2` — a colour that is not in the 50-colour canon
 * and cannot be, since canon water tops out at `water-4 #78BCB0`.
 */

import Phaser from 'phaser';
import waterCycle from '../../data/water-cycle.json';
import { phaseFor, frameAt, type PhasedTiming } from '../core/phase';
import type { SystemContext } from '../core/SystemContext';
import type { TimeOfDay } from '../core/timeMath';

interface CycleRegion {
  bbox: { x: number; y: number; w: number; h: number };
  frames: number;
  periodMs: number;
  offsetMs: number;
  order: number[];
}

const REGIONS = (waterCycle as { regions: Record<string, CycleRegion> }).regions;

/**
 * The plate sits at depth -20 (and -21 while a time-of-day crossfade is in
 * flight), so -19 puts the water patch directly over the plate and under
 * everything else in the world.
 */
const CYCLE_DEPTH = -19;

/** Texture key for one cycle frame. Mirrors BootScene.loadWaterCycle. */
export function waterFrameKey(locationId: string, tod: TimeOfDay, n: number): string {
  return `water-${locationId}-${tod}-${n}`;
}

/** True when this location ships a cycle (waterfront and kampung only). */
export function hasWaterCycle(locationId: string): boolean {
  return Boolean(REGIONS[locationId]);
}

export class WaterCycleSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;

  private image: Phaser.GameObjects.Image | null = null;
  private region: CycleRegion | null = null;
  private timing: PhasedTiming | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private frameIndex = 0;

  constructor(scene: Phaser.Scene, ctx: SystemContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  create() {
    this.destroy();

    const id = this.ctx.locationId();
    const region = REGIONS[id];
    if (!region) return;

    const scale = this.ctx.location()?.world.scale ?? 3;
    const firstKey = waterFrameKey(id, this.ctx.timeOfDay(), 0);
    if (!this.scene.textures.exists(firstKey)) {
      // No strips on disk. Silence is correct here: the plate's own painted
      // water is still there and still right, it simply does not move.
      return;
    }

    this.region = region;
    // The manifest is in NATIVE plate px, like every other authored
    // coordinate. This is the one place it is multiplied by world.scale.
    const image = this.scene.add.image(region.bbox.x * scale, region.bbox.y * scale, firstKey);
    image.setOrigin(0, 0);
    image.setScale(scale);
    image.setDepth(CYCLE_DEPTH);
    image.setScrollFactor(1);
    this.image = image;

    // The per-region offset goes through the same spreader everything else
    // uses, seeded on the bbox so it is stable across runs.
    this.timing = phaseFor(0, region.periodMs, region.bbox.x, region.bbox.y, 0);
    this.timing.offsetMs = region.offsetMs;

    this.startTimer();
    this.applyFrame();
  }

  private startTimer() {
    this.timer?.remove(false);
    this.timer = null;
    if (!this.region) return;

    // `low` freezes on frame 0: still correct, still canon, zero ticks.
    if (this.ctx.quality() === 'low') return;

    const msPerFrame = this.region.periodMs / this.region.frames;
    this.timer = this.scene.time.addEvent({
      delay: msPerFrame,
      loop: true,
      callback: () => {
        if (!this.region || !this.image?.active) return;
        this.frameIndex = (this.frameIndex + 1) % this.region.order.length;
        this.applyFrame();
      },
    });
  }

  /** Write the current frame's texture. The whole runtime cost lives here. */
  private applyFrame() {
    if (!this.image?.active || !this.region) return;
    const n = this.region.order[this.frameIndex] ?? 0;
    const key = waterFrameKey(this.ctx.locationId(), this.ctx.timeOfDay(), n);
    if (this.scene.textures.exists(key)) this.image.setTexture(key);
  }

  /**
   * The hour changed: swap the key prefix and KEEP the frame index, so the
   * water does not visibly reset to frame 0 in the middle of a crossfade.
   */
  setTimeOfDay() {
    this.applyFrame();
  }

  /** Quality changed: `low` freezes, everything else ticks. */
  applyQuality() {
    if (this.ctx.quality() === 'low') {
      this.timer?.remove(false);
      this.timer = null;
      this.frameIndex = 0;
      this.applyFrame();
      return;
    }
    if (!this.timer) this.startTimer();
  }

  /** For the DEV acceptance hook. */
  debugState(): { active: boolean; frame: number; frames: number; periodMs: number } | null {
    if (!this.region) return null;
    return {
      active: Boolean(this.timer),
      frame: this.region.order[this.frameIndex] ?? 0,
      frames: this.region.frames,
      periodMs: this.region.periodMs,
    };
  }

  /** Which frame this region SHOULD be on at `nowMs`. Used by the tests. */
  expectedFrameAt(nowMs: number): number {
    if (!this.region || !this.timing) return 0;
    return frameAt(nowMs, this.timing, this.region.frames);
  }

  destroy() {
    this.timer?.remove(false);
    this.timer = null;
    this.image?.destroy();
    this.image = null;
    this.region = null;
    this.timing = null;
    this.frameIndex = 0;
  }
}

export default WaterCycleSystem;
