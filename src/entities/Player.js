/**
 * Player Entity
 *
 * Represents the player character with:
 * - 8-directional movement (N, NE, E, SE, S, SW, W, NW)
 * - Smooth physics-based movement
 * - Collision detection
 * - Animation support (to be added when sprites are ready)
 */

import Phaser from 'phaser';
import { PLAYER_SPEED } from '../config';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    // Use sprite sheet for animations
    super(scene, x, y, 'player-sheet', 16); // Start with idle-down frame

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set up physics body
    this.setCollideWorldBounds(true);

    // Adjust hitbox size (character is 16x32, but hitbox can be smaller)
    this.body.setSize(12, 16); // Narrower hitbox for better feel
    this.body.setOffset(2, 16); // Offset so feet are at bottom

    // Player properties
    this.speed = PLAYER_SPEED;
    this.moving = false;

    // Facing direction (for interactions)
    this.facing = 'down'; // down, up, left, right

    // Animation state
    this.currentAnim = null;
  }

  /**
   * Update player movement based on input
   * Supports 8-directional movement
   */
  update(cursors, keys) {
    // Get input direction
    let velocityX = 0;
    let velocityY = 0;

    // Check arrow keys OR WASD
    if (cursors.left.isDown || keys.a.isDown) {
      velocityX = -1;
    } else if (cursors.right.isDown || keys.d.isDown) {
      velocityX = 1;
    }

    if (cursors.up.isDown || keys.w.isDown) {
      velocityY = -1;
    } else if (cursors.down.isDown || keys.s.isDown) {
      velocityY = 1;
    }

    // Normalize diagonal movement
    // Without this, moving diagonally would be faster (sqrt(2) * speed)
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= Math.SQRT1_2; // Same as dividing by sqrt(2)
      velocityY *= Math.SQRT1_2;
    }

    // Apply velocity
    this.setVelocity(velocityX * this.speed, velocityY * this.speed);

    // Update facing direction (for interactions and animations)
    this.updateFacing(velocityX, velocityY);

    // Track if moving
    this.moving = (velocityX !== 0 || velocityY !== 0);

    // Update animation based on movement and direction
    this.updateAnimation();
  }

  /**
   * Update player animation based on movement state
   */
  updateAnimation() {
    const animKey = this.moving
      ? `player-walk-${this.facing}`
      : `player-idle-${this.facing}`;

    // Only change animation if different
    if (this.currentAnim !== animKey) {
      this.currentAnim = animKey;
      this.anims.play(animKey, true);
    }
  }

  /**
   * Update which direction the player is facing
   * Used for interactions and animation selection
   */
  updateFacing(velocityX, velocityY) {
    if (velocityX === 0 && velocityY === 0) {
      return; // Keep current facing when not moving
    }

    // Determine primary direction (prioritize cardinal over diagonal)
    if (Math.abs(velocityX) > Math.abs(velocityY)) {
      // Moving more horizontally
      this.facing = velocityX < 0 ? 'left' : 'right';
    } else if (Math.abs(velocityY) > Math.abs(velocityX)) {
      // Moving more vertically
      this.facing = velocityY < 0 ? 'up' : 'down';
    } else {
      // Diagonal movement - choose based on angle
      if (velocityX < 0 && velocityY < 0) {
        this.facing = 'up'; // Northwest -> up
      } else if (velocityX > 0 && velocityY < 0) {
        this.facing = 'up'; // Northeast -> up
      } else if (velocityX < 0 && velocityY > 0) {
        this.facing = 'down'; // Southwest -> down
      } else if (velocityX > 0 && velocityY > 0) {
        this.facing = 'down'; // Southeast -> down
      }
    }
  }

  /**
   * Get the position in front of the player (for interactions)
   * Returns {x, y} coordinates
   */
  getFacingPosition(distance = 16) {
    const offsets = {
      up: { x: 0, y: -distance },
      down: { x: 0, y: distance },
      left: { x: -distance, y: 0 },
      right: { x: distance, y: 0 }
    };

    const offset = offsets[this.facing];
    return {
      x: this.x + offset.x,
      y: this.y + offset.y
    };
  }

  /**
   * Stop player movement (useful for cutscenes, dialogue, etc.)
   */
  stopMovement() {
    this.setVelocity(0, 0);
    this.moving = false;
  }
}
