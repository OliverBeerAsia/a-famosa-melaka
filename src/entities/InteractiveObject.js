/**
 * Interactive Object
 *
 * Represents an object in the world that can be:
 * - Examined (shows description)
 * - Used (triggers actions)
 * - Picked up (adds to inventory)
 */

import Phaser from 'phaser';

export default class InteractiveObject extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, data) {
    super(scene, x, y, data.sprite || 'crate');

    this.scene = scene;
    this.objectData = data;
    this.objectId = data.id;
    this.objectType = data.type || 'examine'; // examine, pickup, use, container

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Configure physics
    this.body.setImmovable(true);

    // Interaction properties
    this.interactionRadius = data.interactionRadius || 24;
    this.isInteractable = true;
    this.hasBeenPickedUp = false;

    // Visual setup
    this.setDepth(this.y);
    this.setupVisualFeedback();
  }

  setupVisualFeedback() {
    // Highlight indicator when player is nearby
    this.highlight = this.scene.add.rectangle(
      this.x,
      this.y - 4,
      this.width + 4,
      this.height + 4,
      0xF4B41A,
      0
    );
    this.highlight.setStrokeStyle(2, 0xF4B41A);
    this.highlight.setDepth(this.y - 1);
  }

  /**
   * Check if player is in interaction range
   */
  isPlayerNearby(player) {
    if (!player) return false;
    const distance = Phaser.Math.Distance.Between(
      this.x, this.y,
      player.x, player.y
    );
    return distance <= this.interactionRadius;
  }

  /**
   * Show highlight when player approaches
   */
  showHighlight() {
    if (!this.isInteractable) return;

    this.scene.tweens.add({
      targets: this.highlight,
      alpha: 0.8,
      duration: 200
    });
  }

  /**
   * Hide highlight when player moves away
   */
  hideHighlight() {
    this.scene.tweens.add({
      targets: this.highlight,
      alpha: 0,
      duration: 200
    });
  }

  /**
   * Main interaction handler
   */
  interact() {
    if (!this.isInteractable) return false;

    switch (this.objectType) {
      case 'examine':
        return this.examine();
      case 'pickup':
        return this.pickup();
      case 'use':
        return this.use();
      case 'container':
        return this.openContainer();
      default:
        return this.examine();
    }
  }

  /**
   * Examine the object (show description)
   */
  examine() {
    const description = this.objectData.description || 'You see nothing special.';
    this.scene.events.emit('showMessage', {
      title: this.objectData.name || 'Object',
      text: description
    });
    return true;
  }

  /**
   * Pick up the object (add to inventory)
   */
  pickup() {
    if (this.hasBeenPickedUp) return false;

    const itemId = this.objectData.itemId;
    if (!itemId) {
      this.examine();
      return false;
    }

    // Try to add to inventory
    if (this.scene.inventory && this.scene.inventory.addItem(itemId)) {
      this.hasBeenPickedUp = true;

      // Visual feedback
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        y: this.y - 20,
        duration: 300,
        onComplete: () => {
          this.setVisible(false);
          this.highlight.setVisible(false);
          this.isInteractable = false;
        }
      });

      // Show pickup message
      this.scene.events.emit('showMessage', {
        title: 'Picked up',
        text: this.objectData.pickupText || `You picked up ${this.objectData.name || 'an item'}.`
      });

      return true;
    }

    return false;
  }

  /**
   * Use the object (trigger action)
   */
  use() {
    // Emit use event for game logic to handle
    this.scene.events.emit('objectUsed', {
      object: this,
      objectId: this.objectId,
      data: this.objectData
    });

    // Show use text if defined
    if (this.objectData.useText) {
      this.scene.events.emit('showMessage', {
        title: this.objectData.name || 'Object',
        text: this.objectData.useText
      });
    }

    return true;
  }

  /**
   * Open container (show contents)
   */
  openContainer() {
    const contents = this.objectData.contents || [];

    if (contents.length === 0) {
      this.scene.events.emit('showMessage', {
        title: this.objectData.name || 'Container',
        text: 'The container is empty.'
      });
      return true;
    }

    // Add all items to inventory
    let pickedUp = 0;
    contents.forEach(itemId => {
      if (this.scene.inventory && this.scene.inventory.addItem(itemId)) {
        pickedUp++;
      }
    });

    if (pickedUp > 0) {
      this.objectData.contents = []; // Empty the container
      this.scene.events.emit('showMessage', {
        title: this.objectData.name || 'Container',
        text: `You found ${pickedUp} item${pickedUp > 1 ? 's' : ''} inside.`
      });
    }

    return true;
  }

  /**
   * Update loop
   */
  update(player) {
    if (!this.isInteractable) return;

    // Update highlight position
    if (this.highlight) {
      this.highlight.setPosition(this.x, this.y - 4);
    }

    // Check player proximity
    if (player && this.isPlayerNearby(player)) {
      this.showHighlight();
    } else {
      this.hideHighlight();
    }

    // Update depth sorting
    this.setDepth(this.y);
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.highlight) {
      this.highlight.destroy();
    }
    super.destroy();
  }
}

