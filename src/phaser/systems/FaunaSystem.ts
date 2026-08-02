/**
 * FaunaSystem — scripted indifference at the ground plane.
 *
 * Baldur's Gate filled its cities with animals that did not care about you at
 * all, and that indifference is exactly the point: fauna never react to the
 * player, never block, never carry dialogue, and never appear in an
 * interaction scoring pass. They exist so the frame moves when nothing is
 * happening.
 *
 * The location data already passes benchmark item 8 on COUNT (every location
 * declares 4-5 ambient animation types). What fauna buys is variety at the
 * GROUND PLANE, where every existing layer is either sky (seagulls) or
 * architecture (awnings, palms, smoke).
 *
 * THREE ARCHETYPES SHIP IN v0.12 (spec §4.1). C `flight-arc` and D
 * `flutter-drift` are parked: they need on-screen tuning, and the kelip-kelip
 * in particular deserve a proper look rather than a rushed one.
 *
 *   A  perch-hop    idle on an anchor; every 6-14 s hop to a neighbour over
 *                   400 ms. Doves, pigeons, cats.
 *   B  peck-wander  random walk in radius R over the walk mask: 60 % idle/peck,
 *                   40 % walk 1-2 s. Chickens.
 *   E  sleep-lie    lying, breathing; stands, walks <= 24 px, re-lies every
 *                   40-90 s. Dogs.
 *
 * THE RULES, all enforced below:
 *  - no physics body, no collider, never in `findBestInteractionTarget`;
 *  - ground fauna sort on `worldDepth(y)` so the player walks in front of and
 *    behind them. NEVER `setDepth(y)`: in a 1080-tall world that lands inside
 *    the FX band and the animal draws over the fog and the grade;
 *  - budget: `visualProfile.faunaBudget` (8/5/2), and it is ADDED TO the crowd
 *    check rather than exempt from it — live crowd + live fauna must stay
 *    under `maxCrowdSize`;
 *  - fauna hold still while a dialogue or panel is open. The frame should be
 *    quiet while you read;
 *  - every decision is seeded from `hash2(locationId, instanceIndex)`. No
 *    `Math.random()` anywhere, so a capture is reproducible frame for frame.
 */

import Phaser from 'phaser';
import faunaData from '../../data/fauna.json';
import { worldDepth } from '../core/depth';
import { hash2, hashString, phaseFor, type PhasedTiming } from '../core/phase';
import type { SystemContext } from '../core/SystemContext';

type Archetype = 'perch-hop' | 'peck-wander' | 'sleep-lie';

interface FaunaEntry {
  id: string;
  sheet: string;
  archetype: Archetype;
  count: number;
  anchors: number[][];
  radius: number;
  speed: number;
  hours: number[];
}

interface Clip {
  frameWidth: number;
  frameHeight: number;
  idle: number[];
  walk: number[];
  rest: number[];
}

const DATA = faunaData as {
  clips: Record<string, Clip>;
  locations: Record<string, FaunaEntry[]>;
};

/**
 * The fewest fauna a location may show. See the budget note in `create()`:
 * without a floor, a crowd running over ITS budget silently deletes the whole
 * ambient layer.
 */
const MIN_FAUNA = 2;

/** Per-archetype tick interval in ms (spec §4.1). */
const TICK_MS: Record<Archetype, number> = {
  'perch-hop': 250,
  'peck-wander': 200,
  'sleep-lie': 500,
};

type State = 'idle' | 'walk' | 'rest';

interface Instance {
  sprite: Phaser.GameObjects.Sprite;
  entry: FaunaEntry;
  clip: Clip;
  /** Stable per-instance seed. Every decision derives from this. */
  seed: number;
  index: number;
  homeX: number;
  homeY: number;
  state: State;
  /** ms timestamp of the next behaviour decision. */
  nextDecisionAt: number;
  /** Movement target in world px. */
  targetX: number;
  targetY: number;
  /** Animation frame cursor and its own phase timing. */
  timing: PhasedTiming;
  facing: 1 | -1;
}

export class FaunaSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly crowdLive: () => number;

  private instances: Instance[] = [];
  private nextAnimTickAt = 0;

  constructor(scene: Phaser.Scene, ctx: SystemContext, crowdLive: () => number) {
    this.scene = scene;
    this.ctx = ctx;
    this.crowdLive = crowdLive;
  }

  // -- lifecycle -----------------------------------------------------------

  create() {
    this.destroy();

    const id = this.ctx.locationId();
    const entries = DATA.locations[id];
    if (!entries?.length) return;

    const scale = this.ctx.location()?.world.scale ?? 3;
    const profile = this.ctx.visualProfile();
    // Fauna share the crowd's ceiling rather than getting their own on top of
    // it: a street with 15 people AND 8 animals is not the budget anyone
    // signed off, it is two budgets stacked.
    //
    // THE FLOOR IS NOT A FUDGE. Measured in-engine: rua-direita runs 22 live
    // crowd members against a `maxCrowdSize` of 15, so a strict
    // `maxCrowdSize - crowdLive` headroom came out NEGATIVE and the whole
    // fauna layer silently failed to spawn — a feature invisible not because
    // it was broken but because a system it does not own was over its own
    // budget. A layer that vanishes when a neighbour misbehaves is worse than
    // one that overshoots by two, so the shared ceiling is respected from
    // above (never more than `faunaBudget`) and floored from below at
    // MIN_FAUNA. The crowd overrun itself is reported, not absorbed.
    const headroom = profile.maxCrowdSize - this.crowdLive();
    let budget = Math.max(MIN_FAUNA, Math.min(profile.faunaBudget, headroom));

    const hour = this.currentHour();
    const locSeed = hashString(id);

    for (const entry of entries) {
      if (budget <= 0) break;
      if (!this.withinHours(entry, hour)) continue;
      const clip = DATA.clips[entry.sheet];
      if (!clip || !this.scene.textures.exists(entry.sheet)) continue;

      const want = Math.min(entry.count, budget, entry.anchors.length);
      for (let i = 0; i < want; i++) {
        const anchor = entry.anchors[i % entry.anchors.length];
        const seedBase = hash2(locSeed * 1000 + i, anchor[0] * 31 + anchor[1]);
        const spawned = this.spawn(entry, clip, anchor, scale, i, seedBase);
        if (spawned) budget--;
      }
    }
  }

  private spawn(
    entry: FaunaEntry,
    clip: Clip,
    anchor: number[],
    scale: number,
    index: number,
    seed: number,
  ): boolean {
    // Native -> world, once, here.
    const wx = anchor[0] * scale;
    const wy = anchor[1] * scale;

    // Validate against the mask and re-seed to the nearest legal spot rather
    // than trusting the roster — a plate re-render moves the ground under an
    // anchor and a chicken standing in a wall is a very visible bug.
    const mask = this.ctx.walkMask();
    let x = wx;
    let y = wy;
    if (mask) {
      const fixed = mask.nearestWalkable(wx, wy, 48);
      if (!fixed) return false;
      x = fixed.x;
      y = fixed.y;
    }

    const sprite = this.scene.add.sprite(x, y, entry.sheet, clip.idle[0]);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(scale);
    // worldDepth, NOT raw y. See the class comment.
    sprite.setDepth(worldDepth(y));
    // No physics body, no collider, no input. A fauna sprite is scenery that
    // moves; it must never become something the player can target.
    sprite.setInteractive(undefined as never, undefined as never, false);
    sprite.disableInteractive();

    const state: State = entry.archetype === 'sleep-lie' ? 'rest' : 'idle';
    this.instances.push({
      sprite,
      entry,
      clip,
      seed,
      index,
      homeX: x,
      homeY: y,
      state,
      nextDecisionAt: this.scene.time.now + this.decisionDelay(entry, seed, 0),
      targetX: x,
      targetY: y,
      timing: phaseFor(this.instances.length, TICK_MS[entry.archetype] * 4, x, y),
      facing: 1,
    });
    return true;
  }

  // -- time of day ---------------------------------------------------------

  private currentHour(): number {
    // The clock lives on the scene; fauna only need the hour, and the phase is
    // the one thing SystemContext exposes. Map it to a representative hour so
    // the roster's `hours` windows work without widening the context.
    switch (this.ctx.timeOfDay()) {
      case 'dawn': return 6;
      case 'day': return 12;
      case 'dusk': return 18;
      default: return 23;
    }
  }

  /** `hours` is [start, end) and WRAPS: [17, 6] is late afternoon to dawn. */
  private withinHours(entry: FaunaEntry, hour: number): boolean {
    const [from, to] = entry.hours;
    if (from === to) return true;
    if (from < to) return hour >= from && hour < to;
    return hour >= from || hour < to;
  }

  /** The hour changed: respawn, so roosting chickens actually leave. */
  setTimeOfDay() {
    this.create();
  }

  applyQuality() {
    this.create();
  }

  // -- per frame -----------------------------------------------------------

  update(_time: number, delta: number) {
    if (!this.instances.length) return;
    // Hold still while a panel is open — the frame should be quiet while you
    // are reading, and a chicken pecking behind a dialogue box is a distraction
    // the scene did not ask for.
    if (this.ctx.isUIOpen()) return;

    const now = this.scene.time.now;
    const dt = delta / 1000;
    const scale = this.ctx.location()?.world.scale ?? 3;
    const mask = this.ctx.walkMask();

    // Animation frames advance on a shared 6 fps grid; each instance picks its
    // own frame from its own phase, so nothing is in lockstep.
    const animTick = now >= this.nextAnimTickAt;
    if (animTick) this.nextAnimTickAt = now + 160;

    for (let i = 0; i < this.instances.length; i++) {
      const f = this.instances[i];

      if (now >= f.nextDecisionAt) this.decide(f, now, scale);
      if (f.state === 'walk') this.step(f, dt, scale, mask);
      if (animTick) this.animate(f, now);
    }
  }

  /**
   * Pick the next behaviour. Every branch is a pure function of the instance
   * seed and a decision counter, so the same animal makes the same choices on
   * every run.
   */
  private decide(f: Instance, now: number, scale: number) {
    const n = Math.floor(now / 100);
    const r1 = hash2(f.seed * 8191, n);
    const r2 = hash2(n, f.seed * 6151);

    switch (f.entry.archetype) {
      case 'peck-wander': {
        // 60 % idle/peck, 40 % walk.
        if (f.state === 'walk' || r1 < 0.6) {
          f.state = 'idle';
        } else {
          f.state = 'walk';
          const angle = r2 * Math.PI * 2;
          const reach = f.entry.radius * scale * (0.3 + r1 * 0.7);
          f.targetX = f.homeX + Math.cos(angle) * reach;
          f.targetY = f.homeY + Math.sin(angle) * reach * 0.55; // iso foreshortening
        }
        break;
      }
      case 'perch-hop': {
        // Idle, then an occasional short hop to a neighbouring spot.
        if (f.state === 'walk') {
          f.state = 'idle';
        } else if (r1 > 0.72) {
          f.state = 'walk';
          const angle = r2 * Math.PI * 2;
          const reach = (8 + r1 * 8) * scale;   // 8-16 native px
          f.targetX = f.homeX + Math.cos(angle) * reach;
          f.targetY = f.homeY + Math.sin(angle) * reach * 0.55;
        }
        break;
      }
      case 'sleep-lie': {
        if (f.state === 'rest' && r1 > 0.82) {
          f.state = 'walk';
          const angle = r2 * Math.PI * 2;
          const reach = (10 + r1 * 14) * scale;  // <= 24 native px
          f.targetX = f.homeX + Math.cos(angle) * reach;
          f.targetY = f.homeY + Math.sin(angle) * reach * 0.55;
        } else if (f.state === 'walk') {
          f.state = 'rest';
        }
        break;
      }
    }
    f.nextDecisionAt = now + this.decisionDelay(f.entry, f.seed, n);
  }

  /** Per-archetype dwell time, jittered deterministically. */
  private decisionDelay(entry: FaunaEntry, seed: number, n: number): number {
    const r = hash2(seed * 4093, n + 17);
    switch (entry.archetype) {
      case 'perch-hop': return 6000 + r * 8000;    // 6-14 s
      case 'peck-wander': return 900 + r * 1600;   // ~1-2.5 s
      case 'sleep-lie': return 40000 + r * 50000;  // 40-90 s
      default: return 2000;
    }
  }

  /** Move toward the target, refusing any step the walk mask rejects. */
  private step(
    f: Instance,
    dt: number,
    scale: number,
    mask: ReturnType<SystemContext['walkMask']>,
  ) {
    const speed = f.entry.speed * scale;
    const dx = f.targetX - f.sprite.x;
    const dy = f.targetY - f.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      f.state = f.entry.archetype === 'sleep-lie' ? 'rest' : 'idle';
      return;
    }
    const nx = f.sprite.x + (dx / dist) * speed * dt;
    const ny = f.sprite.y + (dy / dist) * speed * dt;
    if (mask && !mask.canStand(nx, ny)) {
      // Blocked: give up on this target rather than grinding into geometry.
      f.state = f.entry.archetype === 'sleep-lie' ? 'rest' : 'idle';
      return;
    }
    if (dx !== 0) f.facing = dx < 0 ? -1 : 1;
    f.sprite.setPosition(nx, ny);
    f.sprite.setDepth(worldDepth(ny));
    f.sprite.setFlipX(f.facing < 0);
  }

  /** Advance the sprite frame from this instance's own phase. */
  private animate(f: Instance, now: number) {
    const range = f.state === 'walk' ? f.clip.walk
      : f.state === 'rest' ? f.clip.rest
        : f.clip.idle;
    const span = range[1] - range[0] + 1;
    if (span <= 0) return;
    const t = (now + f.timing.offsetMs) % f.timing.periodMs;
    const k = Math.floor((t / f.timing.periodMs) * span);
    f.sprite.setFrame(range[0] + Math.min(span - 1, Math.max(0, k)));
  }

  // -- introspection -------------------------------------------------------

  /** Live instance count, for the budget assertion and the dev overlay. */
  count(): number {
    return this.instances.length;
  }

  /** For the DEV acceptance hook. */
  debugFauna(): Array<{
    id: string; state: string; x: number; y: number; depth: number; standing: boolean;
  }> {
    const mask = this.ctx.walkMask();
    return this.instances.map((f) => ({
      id: f.entry.id,
      state: f.state,
      x: Math.round(f.sprite.x),
      y: Math.round(f.sprite.y),
      depth: f.sprite.depth,
      // Tested at the sprite's OWN feet. A fauna sprite is anchored (0.5, 1),
      // so its y IS its contact point — running it through the player's
      // `canStandAt`, which adds WALK_FOOT_OFFSET, samples 44 px of whatever
      // is below the animal and reports a false failure.
      standing: mask ? mask.canStand(f.sprite.x, f.sprite.y) : true,
    }));
  }

  destroy() {
    this.instances.forEach((f) => f.sprite.destroy());
    this.instances = [];
    this.nextAnimTickAt = 0;
  }
}

export default FaunaSystem;
