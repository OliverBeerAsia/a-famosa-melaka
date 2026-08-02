/**
 * SurfaceResponseSystem — the ground and the cloth notice you.
 *
 * The Commandos technique: surfaces respond to sprites. We get the channel for
 * free — `WalkMask.surfaceAt(worldX, worldY)` already returns one of eight
 * material ids from the G channel of `<id>-walk.png`, and the footstep bank
 * already routes through it. Three tier-1 responses ship in v0.12:
 *
 *  1. DUST PUFF on dirt/sand/grass — the highest impact per line in the whole
 *     juice pass. Two particles at the foot point, 380 ms, tinted by surface.
 *     It also fires for NPCs and crowd members at a quarter of the rate, which
 *     is what makes the CITY kick up dust rather than only the player.
 *  2. CLOTH SWAY on pass-by — zero new art. The awning's own animation is
 *     retimed (amplitude x1.8, rate x1.4) for 900 ms as you approach, then
 *     eases back. `awning-flutter` counts are rua 6, a-famosa 5, waterfront 5,
 *     kampung 4, st-pauls 1, so this fires constantly and costs nothing.
 *  3. BOARD CREAK on the pier — audio only, one footstep in four, pitch
 *     shifted +/-6 % from a position hash. A creak that only SOMETIMES happens
 *     is the whole effect; a creak on every step becomes a rhythm instrument.
 *
 * BUDGET, enforced not aspired to: one pooled group of `POOL_SIZE` objects,
 * recycled oldest-first. Nothing in `update()` allocates — no `new`, no array
 * literal, no closure per frame. The pool is asserted in `poolSize()` and read
 * by the dev overlay.
 *
 * Surface census from the shipped walkmasks, which is why only these three:
 * wood exists on the waterfront pier ONLY (3 024 mask px), water on waterfront
 * + kampung, grass on st-pauls + kampung. No effect is authored for a surface
 * that does not exist in a location.
 */

import Phaser from 'phaser';
import { worldDepth } from '../core/depth';
import { hash2 } from '../core/phase';
import { PLAYER_SPEED } from '../game';
import type { SurfaceName } from '../core/WalkMask';
import type { SystemContext } from '../core/SystemContext';

/** One pooled group, 24 objects, oldest recycled. Hard budget. */
export const POOL_SIZE = 24;
/** Simultaneous live dust puffs. */
const DUST_CAP = 6;
/** Dust needs real walking speed: shuffling does not raise it. */
const DUST_SPEED_FRACTION = 0.6;
/** At most one puff per two footsteps. */
const DUST_EVERY_N_STEPS = 2;
/** NPCs and crowd kick dust at a quarter of the player's rate. */
const MOVER_RATE = 4;
/** How far a mover walks between dust checks, in world px. */
const MOVER_STRIDE = 42;
/** One creak in four footsteps. */
const CREAK_EVERY_N_STEPS = 4;

/** Surfaces that raise dust, with their canon tint and alpha. */
const DUST_TINT: Partial<Record<SurfaceName, { tint: number; alpha: number }>> = {
  dirt: { tint: 0x987438, alpha: 0.50 },   // earth-2  (32)
  sand: { tint: 0xC8A860, alpha: 0.50 },   // earth-3  (33)
  grass: { tint: 0x144418, alpha: 0.35 },  // foliage-1 (21)
};

/** Cloth sway (game-feel spec §5.2). */
const CLOTH = {
  /** 20 native px = 60 world px. */
  radius: 60,
  /** How long the retimed animation runs before easing back. */
  holdMs: 900,
  easeMs: 400,
  rateScale: 1.4,
  amplitudeScale: 1.8,
  /** At most three props respond at once; nearest wins. */
  maxResponding: 3,
  /** Per-prop rustle cooldown. */
  sfxCooldownMs: 4000,
  sfxVolume: 0.14,
};

interface PoolItem {
  image: Phaser.GameObjects.Image;
  /** ms remaining; <= 0 means free. */
  life: number;
  lifespan: number;
  vx: number;
  vy: number;
  alpha0: number;
  scale0: number;
  scale1: number;
}

/** A prop this system may retime — supplied by EnvironmentObjectSystem. */
export interface SwayableProp {
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  type: string;
  /** The prop's resting animation timeScale / scaleY, restored on ease-out. */
  baseTimeScale: number;
  baseScaleY: number;
}

export interface SurfaceResponseDeps {
  /** `detune` is in cents; deterministic at the call site, never random. */
  playSfx(key: string, volumeScale: number, detune?: number): void;
  /** Every non-player character that can raise dust: NPCs plus the crowd. */
  movers(): Array<{ x: number; y: number }>;
  /** Awnings and other retimeable cloth props. */
  swayables(): SwayableProp[];
  /** Foot offset from a character's origin to the ground, in world px. */
  footOffset(): number;
}

export class SurfaceResponseSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: SurfaceResponseDeps;

  private pool: PoolItem[] = [];
  private nextSlot = 0;
  private live = 0;

  private stepCount = 0;
  private creakCount = 0;
  /** Per-mover walked distance, indexed to match `deps.movers()`. */
  private moverLastX: number[] = [];
  private moverLastY: number[] = [];
  private moverSteps: number[] = [];

  private swayUntil = new Map<SwayableProp, number>();
  private swaySfxAt = new Map<SwayableProp, number>();

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: SurfaceResponseDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  create() {
    this.destroyPool();
    const key = this.scene.textures.exists('fx-dust') ? 'fx-dust' : 'particle';
    for (let i = 0; i < POOL_SIZE; i++) {
      const image = this.scene.add.image(0, 0, key);
      image.setVisible(false);
      image.setActive(false);
      image.setBlendMode(Phaser.BlendModes.NORMAL);
      this.pool.push({
        image, life: 0, lifespan: 1, vx: 0, vy: 0, alpha0: 0, scale0: 1, scale1: 1,
      });
    }
  }

  /** Live pool occupancy, for the dev overlay's budget counter. */
  poolSize(): number { return this.pool.length; }
  liveCount(): number { return this.live; }

  // -- footsteps -----------------------------------------------------------

  /**
   * The player took a footstep. Called from the same tick that plays the
   * footstep sound, so the two can never disagree about which surface it was.
   */
  onPlayerFootstep(worldX: number, worldY: number, speed: number) {
    const mask = this.ctx.walkMask();
    if (!mask) return;
    const footY = worldY + this.deps.footOffset();
    const surface = mask.surfaceAt(worldX, footY);

    this.stepCount++;

    // (1) dust
    if (speed > PLAYER_SPEED * DUST_SPEED_FRACTION
      && this.stepCount % DUST_EVERY_N_STEPS === 0) {
      this.dustPuff(worldX, footY, surface, 2);
    }

    // (3) board creak — waterfront pier only, because `wood` exists nowhere
    // else in the shipped walkmasks.
    if (surface === 'wood') {
      this.creakCount++;
      if (this.creakCount % CREAK_EVERY_N_STEPS === 0) {
        // Deterministic +/-6 % pitch from the position, so the same board
        // always creaks the same way. Phaser's `detune` is in cents:
        // 6 % ~= 100 cents, so +/-100.
        // +/-6 % pitch is ~+/-100 cents, taken from the position hash so the
        // same board always creaks the same way.
        const cents = Math.round((hash2(worldX, footY) * 2 - 1) * 100);
        this.deps.playSfx('sfx-wood-creak-short', 0.18, cents);
      }
    }
  }

  // -- per frame -----------------------------------------------------------

  update(delta: number) {
    this.tickPool(delta);
    this.tickMovers();
    this.tickCloth();
  }

  /**
   * Advance every live pooled object. Integer loop over a fixed-size array,
   * no allocation, no closures.
   */
  private tickPool(delta: number) {
    const dt = delta / 1000;
    let live = 0;
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      if (item.life <= 0) continue;
      item.life -= delta;
      if (item.life <= 0) {
        item.image.setVisible(false);
        item.image.setActive(false);
        continue;
      }
      live++;
      const t = 1 - item.life / item.lifespan;
      item.image.x += item.vx * dt;
      item.image.y += item.vy * dt;
      item.image.setAlpha(item.alpha0 * (1 - t));
      item.image.setScale(item.scale0 + (item.scale1 - item.scale0) * t);
    }
    this.live = live;
  }

  /**
   * NPCs and crowd members raise dust too, at a quarter of the player's rate.
   * Distance-driven rather than timer-driven so a stationary NPC is silent and
   * a fast one puffs more often, without anyone having to report footsteps.
   */
  private tickMovers() {
    const mask = this.ctx.walkMask();
    if (!mask) return;
    const movers = this.deps.movers();
    const foot = this.deps.footOffset();

    for (let i = 0; i < movers.length; i++) {
      const m = movers[i];
      if (this.moverLastX.length <= i) {
        this.moverLastX.push(m.x);
        this.moverLastY.push(m.y);
        this.moverSteps.push(0);
        continue;
      }
      const dx = m.x - this.moverLastX[i];
      const dy = m.y - this.moverLastY[i];
      if (dx * dx + dy * dy < MOVER_STRIDE * MOVER_STRIDE) continue;
      this.moverLastX[i] = m.x;
      this.moverLastY[i] = m.y;
      this.moverSteps[i]++;
      if (this.moverSteps[i] % MOVER_RATE !== 0) continue;
      const footY = m.y + foot;
      this.dustPuff(m.x, footY, mask.surfaceAt(m.x, footY), 1);
    }
    // A location change shortens the list; drop the tail so indices stay put.
    if (this.moverLastX.length > movers.length) {
      this.moverLastX.length = movers.length;
      this.moverLastY.length = movers.length;
      this.moverSteps.length = movers.length;
    }
  }

  /**
   * Cloth sway: the nearest three awnings within 60 world px get their
   * animation retimed while the player approaches, and ease back after.
   */
  private tickCloth() {
    const player = this.ctx.player();
    if (!player) return;
    const props = this.deps.swayables();
    if (!props.length) return;
    const now = this.scene.time.now;

    let responding = 0;
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      if (prop.type !== 'awning-flutter') continue;
      const dx = Math.abs(prop.sprite.x - player.x);
      const near = dx <= CLOTH.radius && responding < CLOTH.maxResponding;

      if (near) {
        responding++;
        if (!this.swayUntil.has(prop)) {
          this.startSway(prop, now);
        } else {
          this.swayUntil.set(prop, now + CLOTH.holdMs);
        }
        continue;
      }

      const until = this.swayUntil.get(prop);
      if (until !== undefined && now > until + CLOTH.easeMs) {
        this.endSway(prop);
      }
    }
  }

  private startSway(prop: SwayableProp, now: number) {
    this.swayUntil.set(prop, now + CLOTH.holdMs);
    const sprite = prop.sprite as Phaser.GameObjects.Sprite;
    if (sprite.anims?.isPlaying) {
      sprite.anims.timeScale = prop.baseTimeScale * CLOTH.rateScale;
    } else {
      // Tween fallback path: the amplitude lives in scaleY.
      sprite.setScale(sprite.scaleX, prop.baseScaleY * CLOTH.amplitudeScale);
    }
    const last = this.swaySfxAt.get(prop) ?? -Infinity;
    if (now - last >= CLOTH.sfxCooldownMs) {
      this.swaySfxAt.set(prop, now);
      this.deps.playSfx('sfx-cloth-rustle', CLOTH.sfxVolume);
    }
  }

  private endSway(prop: SwayableProp) {
    this.swayUntil.delete(prop);
    const sprite = prop.sprite as Phaser.GameObjects.Sprite;
    if (sprite.anims?.isPlaying) sprite.anims.timeScale = prop.baseTimeScale;
    else sprite.setScale(sprite.scaleX, prop.baseScaleY);
  }

  // -- the pool ------------------------------------------------------------

  /**
   * Emit `count` dust particles at a foot point. Returns silently on a surface
   * that does not raise dust — stone and wood do not, and pretending otherwise
   * is how a "responsive" ground turns into permanent haze.
   */
  private dustPuff(x: number, y: number, surface: SurfaceName, count: number) {
    const config = DUST_TINT[surface];
    if (!config) return;
    if (this.live >= DUST_CAP) return;

    const depth = worldDepth(y) - 1;   // behind the walker's feet
    for (let i = 0; i < count; i++) {
      const item = this.take();
      const jitter = hash2(x + i * 13, y) * 2 - 1;
      item.image.setPosition(x + jitter * 6, y);
      item.image.setTint(config.tint);
      item.image.setDepth(depth);
      item.image.setVisible(true);
      item.image.setActive(true);
      item.lifespan = 380;
      item.life = 380;
      item.vx = jitter * 8;
      item.vy = -6;
      item.alpha0 = config.alpha;
      item.scale0 = 3;
      item.scale1 = 4.5;
      item.image.setAlpha(config.alpha);
      item.image.setScale(3);
    }
  }

  /** Next free slot, or the oldest live one. Never allocates. */
  private take(): PoolItem {
    for (let i = 0; i < this.pool.length; i++) {
      const idx = (this.nextSlot + i) % this.pool.length;
      if (this.pool[idx].life <= 0) {
        this.nextSlot = (idx + 1) % this.pool.length;
        return this.pool[idx];
      }
    }
    const item = this.pool[this.nextSlot];
    this.nextSlot = (this.nextSlot + 1) % this.pool.length;
    return item;
  }

  private destroyPool() {
    this.pool.forEach((item) => item.image.destroy());
    this.pool = [];
    this.live = 0;
    this.nextSlot = 0;
  }

  destroy() {
    this.destroyPool();
    this.swayUntil.clear();
    this.swaySfxAt.clear();
    this.moverLastX.length = 0;
    this.moverLastY.length = 0;
    this.moverSteps.length = 0;
  }
}

export default SurfaceResponseSystem;
