/**
 * PlayerSystem — the avatar: spawning, movement, collision and footfall.
 *
 * Two things here are subtler than they look.
 *
 * **Spawn safety.** A saved position, or a transition authored against an older
 * plate, can point anywhere. If the requested spawn is off the world or inside
 * geometry, the player is snapped back to the location's own spawn rather than
 * loaded into a wall. This is the runtime half of `coordVersion` — saveStore
 * drops stale positions, and this catches anything that still lands badly.
 *
 * **Walk-mask collision runs POST_UPDATE, not in update().** On a masked plate
 * the mask IS the collision geometry, so there are no static bodies to collide
 * against — the player is simply not allowed to END a frame standing somewhere
 * unwalkable. Resolving before Arcade has moved the body would always be one
 * frame stale and would let the player's feet cross into a wall first.
 * Resolution is per axis, so walking into a wall diagonally slides along it
 * instead of stopping dead — something the old 8px collision rects could never
 * do.
 */

import Phaser from 'phaser';
import { CHARACTER_SCALE, GAME_WIDTH, GAME_HEIGHT, PLAYER_SPEED } from '../game';
import { worldDepth } from '../core/depth';
import { resolveMove } from '../core/WalkMask';
import type { SystemContext } from '../core/SystemContext';
import type { Direction } from '../core/interactionScore';
import type { FootstepSurface } from '../core/audioMix';
import { useGameStore } from '../../stores/gameStore';

/**
 * Distance from the player sprite's origin down to its ground contact point.
 * The sprite is 16x32 at 3x with a centred origin, so its feet sit ~44px below
 * the origin — that is the point the walk mask is sampled at, and the point
 * `worldDepth` sorts on.
 */
export const WALK_FOOT_OFFSET = 44;

/** Half-width of the player's stance, in world px, for the both-shoulders test. */
const stanceHalfWidth = () => 6 * CHARACTER_SCALE;

/** Sprite anchor-to-ground offset used for depth sorting. */
const DEPTH_FOOT_OFFSET = 48;

export interface PlayerSystemDeps {
  /** Iso path only: convert authored tile coordinates to world px. */
  tileToWorld(x: number, y: number): { x: number; y: number } | null;
  /** Static colliders to collide the player against, if the plate has any. */
  colliders(): Phaser.Physics.Arcade.StaticGroup | null;
  /** Play a footstep for the surface underfoot (throttled by the audio system). */
  footstep(surface: FootstepSurface | null): void;
  /** Movement keys, owned by the scene's input setup. */
  input(): {
    left: boolean; right: boolean; up: boolean; down: boolean;
  };
}

export class PlayerSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: PlayerSystemDeps;

  private sprite: Phaser.Physics.Arcade.Sprite | null = null;
  private shadow: Phaser.GameObjects.Ellipse | null = null;
  /** Last position the player was legally standing at (walk-mask rollback). */
  private lastWalkableX = 0;
  private lastWalkableY = 0;

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: PlayerSystemDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  getSprite(): Phaser.Physics.Arcade.Sprite | null { return this.sprite; }
  getShadow(): Phaser.GameObjects.Ellipse | null { return this.shadow; }

  // -- spawn ---------------------------------------------------------------

  create(spawnOverride: { x: number; y: number } | null) {
    let spawnX = GAME_WIDTH / 2;
    let spawnY = GAME_HEIGHT - 48;

    const defaultStart = this.ctx.location()?.playerStart;
    if (spawnOverride) {
      spawnX = spawnOverride.x;
      spawnY = spawnOverride.y;
    } else if (defaultStart) {
      spawnX = defaultStart.x;
      spawnY = defaultStart.y;
    }

    // Snap-to-spawn safety net.
    const bounds = this.ctx.worldBounds();
    const mask = this.ctx.walkMask();
    const offWorld = spawnX < 0 || spawnY < 0 || spawnX > bounds.width || spawnY > bounds.height;
    const unwalkable = !!mask
      && !mask.canStand(spawnX, spawnY + WALK_FOOT_OFFSET, stanceHalfWidth());
    if ((offWorld || unwalkable) && defaultStart) {
      console.warn(
        `[PlayerSystem] spawn (${Math.round(spawnX)}, ${Math.round(spawnY)}) is `
        + `${offWorld ? 'outside the world' : 'not walkable'} — snapping to `
        + `${this.ctx.locationId()}'s default spawn`);
      spawnX = defaultStart.x;
      spawnY = defaultStart.y;
    }

    // In isometric mode, playerStart is in tile coordinates — convert to world
    if (!spawnOverride) {
      const worldPos = this.deps.tileToWorld(spawnX, spawnY);
      if (worldPos) {
        spawnX = worldPos.x;
        spawnY = worldPos.y;
      }
    }

    const player = this.scene.physics.add.sprite(spawnX, spawnY, 'player-sheet');
    this.sprite = player;

    // Scale up character to match 960x540 scene backgrounds. The source sprite
    // is 16x32 (designed for 320x180).
    player.setScale(CHARACTER_SCALE);

    if (player.body) {
      // Arcade body size/offset are in SOURCE-TEXTURE pixels; Phaser multiplies
      // them by the sprite's scale itself. Passing pre-scaled numbers here gave
      // a 108x144 body around a 48x96 sprite — three times too big, which is
      // why a spawn near the bottom of the 1080px-tall world was shoved 138px
      // north by collideWorldBounds.
      player.body.setSize(12, 16);
      player.body.setOffset(2, 16);
    }

    player.setCollideWorldBounds(true);
    this.lastWalkableX = player.x;
    this.lastWalkableY = player.y;

    // Y-based depth sorting in both modes so the player walks behind/in-front
    // of props and NPCs (Ultima VII-style overlap). Kept under the FX band.
    player.setDepth(worldDepth(player.y + DEPTH_FOOT_OFFSET));

    this.shadow = this.scene.add.ellipse(player.x, player.y + 40, 54, 20, 0x000000, 0.28);
    this.shadow.setDepth(player.depth - 1);

    const colliders = this.deps.colliders();
    if (colliders) this.scene.physics.add.collider(player, colliders);

    // Play idle animation. Player anims are registered UNPREFIXED in BootScene.
    if (this.scene.anims.exists('idle-down')) player.play('idle-down');
  }

  // -- facing --------------------------------------------------------------

  setFacing(direction: Direction) {
    useGameStore.getState().updatePlayer({ facing: direction });
    const player = this.sprite;
    if (!player) return;

    const idleKey = `idle-${direction}`;
    if (
      this.scene.anims.exists(idleKey)
      && player.body
      && player.body.velocity.lengthSq() < 9
      && player.anims.currentAnim?.key !== idleKey
    ) {
      player.play(idleKey);
    }
  }

  /** Stop dead and hold the current idle pose (rest, dialogue). */
  halt() {
    const player = this.sprite;
    if (!player) return;
    player.setVelocity(0, 0);
  }

  // -- movement ------------------------------------------------------------

  update() {
    const player = this.sprite;
    if (!player) return;

    const keys = this.deps.input();
    let velocityX = 0;
    let velocityY = 0;

    if (keys.left) velocityX = -PLAYER_SPEED;
    else if (keys.right) velocityX = PLAYER_SPEED;

    if (keys.up) velocityY = -PLAYER_SPEED;
    else if (keys.down) velocityY = PLAYER_SPEED;

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    const hasInput = velocityX !== 0 || velocityY !== 0;
    let targetVelocityX = velocityX;
    let targetVelocityY = velocityY;

    // In isometric mode, rotate input 45 degrees so WASD aligns with the
    // diamond axes.
    if (this.ctx.isIsometric()) {
      targetVelocityX = velocityX - velocityY;
      targetVelocityY = (velocityX + velocityY) * 0.5;
    }

    const body = player.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      const blend = hasInput ? 0.28 : 0.34;
      let nextVelocityX = Phaser.Math.Linear(body.velocity.x, targetVelocityX, blend);
      let nextVelocityY = Phaser.Math.Linear(body.velocity.y, targetVelocityY, blend);

      if (!hasInput && Math.abs(nextVelocityX) < 6) nextVelocityX = 0;
      if (!hasInput && Math.abs(nextVelocityY) < 6) nextVelocityY = 0;

      player.setVelocity(nextVelocityX, nextVelocityY);
      this.tickFootstep(nextVelocityX, nextVelocityY);
    } else {
      player.setVelocity(targetVelocityX, targetVelocityY);
      this.tickFootstep(targetVelocityX, targetVelocityY);
    }

    if (hasInput) {
      const direction: Direction = Math.abs(velocityX) > Math.abs(velocityY)
        ? (velocityX < 0 ? 'left' : 'right')
        : (velocityY < 0 ? 'up' : 'down');

      const animKey = `walk-${direction}`;
      if (this.scene.anims.exists(animKey) && player.anims.currentAnim?.key !== animKey) {
        player.play(animKey);
      }
      this.setFacing(direction);
    } else {
      const direction = useGameStore.getState().player.facing;
      const idleKey = `idle-${direction}`;
      if (this.scene.anims.exists(idleKey) && player.anims.currentAnim?.key !== idleKey) {
        player.play(idleKey);
      }
    }

    // Keep the player Y-sorted against props and the cast.
    player.setDepth(worldDepth(player.y + DEPTH_FOOT_OFFSET));
  }

  /**
   * The walk mask carries a surface id per pixel (G channel), so on a composed
   * plate the footstep follows what the player is actually standing on — stone
   * in the street, wood on the arcade boards — instead of one sound for the
   * whole location.
   */
  private tickFootstep(velocityX: number, velocityY: number) {
    if (velocityX === 0 && velocityY === 0) return;
    const player = this.sprite;
    const mask = this.ctx.walkMask();
    if (!player) return;
    this.deps.footstep(mask
      ? mask.footstepAt(player.x, player.y + WALK_FOOT_OFFSET) as FootstepSurface
      : null);
  }

  /** Walk-mask collision. Must run on POST_UPDATE — see the class comment. */
  applyWalkMaskCollision() {
    const mask = this.ctx.walkMask();
    const player = this.sprite;
    if (!mask || !player) return;

    const halfWidth = stanceHalfWidth();
    const x = player.x;
    const y = player.y;

    if (mask.canStand(x, y + WALK_FOOT_OFFSET, halfWidth)) {
      this.lastWalkableX = x;
      this.lastWalkableY = y;
      return;
    }

    const resolved = resolveMove(
      mask,
      this.lastWalkableX, this.lastWalkableY + WALK_FOOT_OFFSET,
      x, y + WALK_FOOT_OFFSET,
      halfWidth,
    );
    player.setPosition(resolved.x, resolved.y - WALK_FOOT_OFFSET);
    const body = player.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      if (resolved.blockedX) body.setVelocityX(0);
      if (resolved.blockedY) body.setVelocityY(0);
    }
    this.lastWalkableX = player.x;
    this.lastWalkableY = player.y;
  }

  /** "Can a character stand with their ORIGIN here?" — the DEV probe. */
  canStandAt(x: number, y: number): boolean | null {
    return this.ctx.walkMask()?.canStand(x, y + WALK_FOOT_OFFSET, stanceHalfWidth()) ?? null;
  }

  destroy() {
    if (this.shadow) {
      this.shadow.destroy();
      this.shadow = null;
    }
    this.sprite = null;
  }
}
