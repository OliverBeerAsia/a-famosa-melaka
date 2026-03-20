/**
 * NPC Entity
 *
 * Interactive non-player character with:
 * - Position and sprite rendering
 * - Daily schedule (tied to time system)
 * - Dialogue interaction
 * - Facing direction
 * - Interaction radius
 */

import Phaser from 'phaser';

export default class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, npcData) {
    super(scene, x, y, npcData.sprite);

    this.scene = scene;
    this.npcData = npcData;

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Configure physics
    this.setCollideWorldBounds(true);
    this.body.setImmovable(true); // NPCs don't move when bumped

    // Interaction properties
    this.interactionRadius = 24; // pixels
    this.isInteractable = true;
    this.facing = 'down'; // Default facing direction

    // Schedule tracking
    this.currentScheduleSlot = null;

    // Visual feedback
    this.setupVisualFeedback();

    // Setup animations
    this.setupAnimations();

    // Initialize schedule
    this.updateSchedule();

    // Listen for time changes
    if (scene.events) {
      scene.events.on('hourChanged', this.updateSchedule, this);
    }
  }

  setupAnimations() {
    const spriteKey = this.npcData.sprite;
    const sheetKey = `${spriteKey}-sheet`;

    // Check if spritesheet exists
    if (!this.scene.textures.exists(sheetKey)) {
      console.log(`NPC: No spritesheet found for ${this.npcData.id}, using static image.`);
      return;
    }

    // Create unique animation keys for this NPC (to avoid conflicts)
    this.animKeys = {
      idleDown: `${this.npcData.id}-idle-down`,
      idleLeft: `${this.npcData.id}-idle-left`,
      idleRight: `${this.npcData.id}-idle-right`,
      idleUp: `${this.npcData.id}-idle-up`,
      walkDown: `${this.npcData.id}-walk-down`,
      walkLeft: `${this.npcData.id}-walk-left`,
      walkRight: `${this.npcData.id}-walk-right`,
      walkUp: `${this.npcData.id}-walk-up`
    };

    // Define frame ranges for 16-frame sheet (4x4)
    const frameRanges = {
      down: { start: 0, end: 3 },
      left: { start: 4, end: 7 },
      right: { start: 8, end: 11 },
      up: { start: 12, end: 15 }
    };

    // Create the animations
    Object.keys(frameRanges).forEach(dir => {
      const range = frameRanges[dir];
      const dirUpper = dir.charAt(0).toUpperCase() + dir.slice(1);
      
      // Idle (just use first frame of walk for now)
      if (!this.scene.anims.exists(this.animKeys[`idle${dirUpper}`])) {
        this.scene.anims.create({
          key: this.animKeys[`idle${dirUpper}`],
          frames: [{ key: sheetKey, frame: range.start }],
          frameRate: 1
        });
      }
      
      // Walk
      if (!this.scene.anims.exists(this.animKeys[`walk${dirUpper}`])) {
        this.scene.anims.create({
          key: this.animKeys[`walk${dirUpper}`],
          frames: this.scene.anims.generateFrameNumbers(sheetKey, { 
            start: range.start, end: range.end 
          }),
          frameRate: 6,
          repeat: -1
        });
      }
    });

    this.hasAnimations = true;
    
    // Set initial animation
    this.play(this.animKeys.idleDown);
  }

  /**
   * Set up visual feedback for interaction
   */
  setupVisualFeedback() {
    // Interaction indicator (small circle above head when player is nearby)
    this.interactionIndicator = this.scene.add.circle(
      this.x,
      this.y - 20,
      2,
      0xF4B41A,
      0
    );
    this.interactionIndicator.setDepth(2000);
  }

  /**
   * Update NPC schedule based on current time
   */
  updateSchedule() {
    if (!this.scene.timeSystem || !this.npcData.schedule) return;

    const currentHour = this.scene.timeSystem.currentHour;
    let activeSchedule = null;

    // Find the active schedule slot for this hour
    for (const slot of this.npcData.schedule) {
      if (currentHour >= slot.startHour && currentHour < slot.endHour) {
        activeSchedule = slot;
        break;
      }
    }

    // If schedule changed, update NPC state
    if (activeSchedule && activeSchedule !== this.currentScheduleSlot) {
      this.currentScheduleSlot = activeSchedule;
      this.applySchedule(activeSchedule);
    }
  }

  /**
   * Apply a schedule slot (position, availability, etc.)
   */
  applySchedule(schedule) {
    // Update availability
    this.isInteractable = schedule.available !== false;

    // Update alpha based on availability
    this.setAlpha(this.isInteractable ? 1.0 : 0.6);

    console.log(`${this.npcData.name}: Now ${schedule.activity} (${schedule.location})`);
  }

  /**
   * Check if player is in interaction range
   */
  isPlayerNearby(player) {
    const distance = Phaser.Math.Distance.Between(
      this.x, this.y,
      player.x, player.y
    );
    return distance <= this.interactionRadius;
  }

  /**
   * Show interaction indicator
   */
  showInteractionIndicator() {
    if (!this.isInteractable) return;
    if (!this.scene || !this.scene.tweens) return;

    this.scene.tweens.add({
      targets: this.interactionIndicator,
      alpha: 1,
      scale: 1.5,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  /**
   * Hide interaction indicator
   */
  hideInteractionIndicator() {
    if (!this.scene || !this.scene.tweens) return;

    this.scene.tweens.add({
      targets: this.interactionIndicator,
      alpha: 0,
      scale: 1,
      duration: 200
    });
  }

  /**
   * Interact with this NPC (called when player presses space nearby)
   */
  interact() {
    if (!this.isInteractable) {
      console.log(`${this.npcData.name} is not available right now`);
      return false;
    }

    if (!this.scene || !this.scene.events) {
      console.warn('Cannot interact: scene no longer available');
      return false;
    }

    // Face the player
    this.facePlayer();

    // Trigger dialogue
    this.scene.events.emit('startDialogue', this.npcData);

    return true;
  }

  /**
   * Face towards the player
   */
  facePlayer() {
    if (!this.scene.player) return;

    const dx = this.scene.player.x - this.x;
    const dy = this.scene.player.y - this.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left';
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
    }

    if (this.hasAnimations) {
      const dirUpper = this.facing.charAt(0).toUpperCase() + this.facing.slice(1);
      this.play(this.animKeys[`idle${dirUpper}`]);
    }
  }

  /**
   * Update loop
   */
  update(player) {
    // Update interaction indicator position
    if (this.interactionIndicator) {
      this.interactionIndicator.setPosition(this.x, this.y - 20);
    }

    // Check player proximity
    if (player && this.isPlayerNearby(player)) {
      this.showInteractionIndicator();
    } else {
      this.hideInteractionIndicator();
    }

    // Update depth for proper rendering order
    this.setDepth(this.y);
  }

  /**
   * Cleanup
   */
  destroy() {
    // Remove event listeners (check scene exists first)
    if (this.scene && this.scene.events) {
      this.scene.events.off('hourChanged', this.updateSchedule, this);
    }

    // Destroy visual elements
    if (this.interactionIndicator) {
      this.interactionIndicator.destroy();
    }

    super.destroy();
  }
}
