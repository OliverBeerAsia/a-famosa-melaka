/**
 * Crowd System
 *
 * Creates atmospheric background NPCs that make Melaka feel alive:
 * - Non-interactive crowd members walking through scenes
 * - Different crowd types per location
 * - Time-of-day density changes
 * - Weather reactions (seek shelter in rain)
 * - Cultural variety (Portuguese, Malay, Chinese, Arab, Indian)
 *
 * These are ATMOSPHERE, not interactive NPCs.
 */

export default class CrowdSystem {
  constructor(scene) {
    this.scene = scene;

    // Active crowd members
    this.crowdMembers = [];
    this.maxCrowdSize = 15; // Performance limit

    // Spawn timer
    this.spawnTimer = null;
    this.baseSpawnRate = 3000; // 3 seconds between spawns

    // Crowd types with visual characteristics
    this.crowdTypes = {
      portuguese_merchant: {
        color: 0x4A0000,      // Dark red doublet
        width: 8,
        height: 16,
        speed: 30,
        locations: ['rua-direita', 'waterfront', 'a-famosa-gate']
      },
      portuguese_soldier: {
        color: 0x4A4A4A,      // Grey armor
        width: 10,
        height: 18,
        speed: 35,
        locations: ['a-famosa-gate', 'rua-direita']
      },
      malay_local: {
        color: 0xC68642,      // Brown skin, colorful sarong implied
        width: 8,
        height: 15,
        speed: 28,
        locations: ['rua-direita', 'kampung', 'waterfront']
      },
      malay_woman: {
        color: 0xFF6347,      // Colorful baju kurung
        width: 8,
        height: 14,
        speed: 25,
        locations: ['rua-direita', 'kampung']
      },
      chinese_merchant: {
        color: 0x1E4D6B,      // Dark blue changshan
        width: 8,
        height: 16,
        speed: 28,
        locations: ['waterfront', 'rua-direita']
      },
      arab_trader: {
        color: 0xF5F5DC,      // White thawb
        width: 8,
        height: 16,
        speed: 30,
        locations: ['waterfront', 'rua-direita']
      },
      indian_merchant: {
        color: 0xFF8C00,      // Orange/saffron clothing
        width: 8,
        height: 15,
        speed: 28,
        locations: ['rua-direita', 'waterfront']
      },
      dock_worker: {
        color: 0x8B7355,      // Simple brown clothing
        width: 10,
        height: 16,
        speed: 35,
        locations: ['waterfront']
      },
      priest: {
        color: 0x1C1C1C,      // Black cassock
        width: 8,
        height: 17,
        speed: 20,
        locations: ['st-pauls-church', 'rua-direita']
      },
      child: {
        color: 0xFFE4C4,      // Light clothing
        width: 6,
        height: 10,
        speed: 45,            // Kids run!
        locations: ['kampung', 'rua-direita']
      }
    };

    // Location-specific crowd configurations
    this.locationConfigs = {
      'rua-direita': {
        maxCrowd: 12,
        density: 1.0,       // Busiest location
        paths: [
          { start: { x: -20, y: 200 }, end: { x: 660, y: 200 } },  // Main street
          { start: { x: 660, y: 250 }, end: { x: -20, y: 250 } },  // Return path
          { start: { x: 300, y: -20 }, end: { x: 300, y: 500 } },  // Cross street
          { start: { x: 150, y: 150 }, end: { x: 500, y: 300 } }   // Diagonal
        ],
        crowdTypes: ['portuguese_merchant', 'malay_local', 'malay_woman',
          'chinese_merchant', 'arab_trader', 'indian_merchant', 'child']
      },
      'waterfront': {
        maxCrowd: 10,
        density: 0.8,
        paths: [
          { start: { x: -20, y: 280 }, end: { x: 660, y: 280 } },  // Dock path
          { start: { x: 660, y: 320 }, end: { x: -20, y: 320 } },  // Return
          { start: { x: 200, y: 400 }, end: { x: 400, y: 150 } }   // To ships
        ],
        crowdTypes: ['dock_worker', 'chinese_merchant', 'arab_trader',
          'portuguese_merchant', 'malay_local']
      },
      'a-famosa-gate': {
        maxCrowd: 6,
        density: 0.5,        // More controlled area
        paths: [
          { start: { x: -20, y: 300 }, end: { x: 660, y: 300 } },
          { start: { x: 300, y: 400 }, end: { x: 300, y: 100 } }   // Through gate
        ],
        crowdTypes: ['portuguese_soldier', 'portuguese_merchant', 'malay_local']
      },
      'st-pauls-church': {
        maxCrowd: 4,
        density: 0.3,        // Quiet, sacred space
        paths: [
          { start: { x: 300, y: 400 }, end: { x: 300, y: 150 } },  // Up to church
          { start: { x: 150, y: 250 }, end: { x: 450, y: 250 } }   // Across
        ],
        crowdTypes: ['priest', 'portuguese_merchant', 'malay_local']
      },
      'kampung': {
        maxCrowd: 8,
        density: 0.7,
        paths: [
          { start: { x: -20, y: 250 }, end: { x: 660, y: 250 } },
          { start: { x: 200, y: 150 }, end: { x: 400, y: 350 } },
          { start: { x: 400, y: 150 }, end: { x: 200, y: 350 } }
        ],
        crowdTypes: ['malay_local', 'malay_woman', 'child']
      }
    };

    // Time-based density multipliers
    this.timeDensity = {
      dawn: 0.3,
      morning: 0.7,
      day: 1.0,
      golden: 0.9,
      dusk: 0.6,
      night: 0.2
    };

    // State
    this.currentLocation = null;
    this.paused = false;
  }

  /**
   * Initialize the crowd system
   */
  initialize(locationId) {
    this.currentLocation = locationId;

    // Start spawning
    this.startSpawning();

    // Listen for events
    this.scene.events.on('timeOfDayChanged', this.onTimeChanged, this);
    this.scene.events.on('weatherChanged', this.onWeatherChanged, this);
    this.scene.events.on('locationChanged', this.onLocationChanged, this);

    console.log(`CrowdSystem initialized for ${locationId}`);
  }

  /**
   * Start the spawn timer
   */
  startSpawning() {
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
    }

    const config = this.locationConfigs[this.currentLocation];
    if (!config) return;

    // Adjust spawn rate based on density
    const spawnRate = this.baseSpawnRate / config.density;

    this.spawnTimer = this.scene.time.addEvent({
      delay: spawnRate,
      callback: this.trySpawnCrowdMember,
      callbackScope: this,
      loop: true
    });

    // Initial population burst
    const initialCount = Math.floor(config.maxCrowd * 0.5);
    for (let i = 0; i < initialCount; i++) {
      this.scene.time.delayedCall(i * 200, () => {
        this.trySpawnCrowdMember();
      });
    }
  }

  /**
   * Try to spawn a new crowd member
   */
  trySpawnCrowdMember() {
    if (this.paused) return;

    const config = this.locationConfigs[this.currentLocation];
    if (!config) return;

    // Check crowd limit
    const timeMultiplier = this.getCurrentDensityMultiplier();
    const effectiveMax = Math.floor(config.maxCrowd * timeMultiplier);

    if (this.crowdMembers.length >= effectiveMax) {
      return;
    }

    // Pick a random crowd type valid for this location
    const validTypes = config.crowdTypes;
    const typeName = Phaser.Utils.Array.GetRandom(validTypes);
    const typeConfig = this.crowdTypes[typeName];

    // Pick a random path
    const path = Phaser.Utils.Array.GetRandom(config.paths);

    // Spawn the crowd member
    this.spawnCrowdMember(typeName, typeConfig, path);
  }

  /**
   * Spawn a crowd member
   */
  spawnCrowdMember(typeName, typeConfig, path) {
    // Create simple sprite (rectangle for now - would be actual sprites in production)
    const sprite = this.scene.add.rectangle(
      path.start.x,
      path.start.y,
      typeConfig.width,
      typeConfig.height,
      typeConfig.color,
      0.7
    );

    sprite.setDepth(50); // Below interactive NPCs
    sprite.setOrigin(0.5, 1); // Bottom center

    // Add slight variation
    const speedVariation = Phaser.Math.FloatBetween(0.8, 1.2);
    const actualSpeed = typeConfig.speed * speedVariation;

    // Calculate travel time
    const distance = Phaser.Math.Distance.Between(
      path.start.x, path.start.y,
      path.end.x, path.end.y
    );
    const duration = (distance / actualSpeed) * 1000;

    // Create crowd member object
    const crowdMember = {
      id: `crowd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: typeName,
      sprite: sprite,
      path: path,
      speed: actualSpeed,
      active: true
    };

    // Animate along path
    this.scene.tweens.add({
      targets: sprite,
      x: path.end.x,
      y: path.end.y,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        this.removeCrowdMember(crowdMember);
      }
    });

    // Add subtle bobbing animation (walking)
    this.scene.tweens.add({
      targets: sprite,
      scaleY: 0.95,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.crowdMembers.push(crowdMember);
  }

  /**
   * Remove a crowd member
   */
  removeCrowdMember(crowdMember) {
    const index = this.crowdMembers.findIndex(c => c.id === crowdMember.id);
    if (index !== -1) {
      this.scene.tweens.killTweensOf(crowdMember.sprite);
      crowdMember.sprite.destroy();
      this.crowdMembers.splice(index, 1);
    }
  }

  /**
   * Get current density multiplier based on time of day
   */
  getCurrentDensityMultiplier() {
    const timeSystem = this.scene.registry.get('timeSystem');
    if (!timeSystem) return 1.0;

    const timeOfDay = timeSystem.getTimeOfDay();
    return this.timeDensity[timeOfDay] || 1.0;
  }

  /**
   * Handle time of day changes
   */
  onTimeChanged(data) {
    const multiplier = this.timeDensity[data.timeOfDay] || 1.0;

    // If density decreased significantly, remove some crowd
    const config = this.locationConfigs[this.currentLocation];
    if (!config) return;

    const targetMax = Math.floor(config.maxCrowd * multiplier);

    while (this.crowdMembers.length > targetMax) {
      // Remove oldest crowd member
      const oldest = this.crowdMembers[0];
      if (oldest) {
        // Fade out and remove
        this.scene.tweens.add({
          targets: oldest.sprite,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            this.removeCrowdMember(oldest);
          }
        });
      }
      // Remove from tracking immediately to prevent double-removal
      this.crowdMembers.shift();
    }
  }

  /**
   * Handle weather changes
   */
  onWeatherChanged(data) {
    if (data.type === 'rain') {
      // Rain! Crowd seeks shelter - clear most crowd members
      this.paused = true;

      // Make crowd scatter
      this.crowdMembers.forEach(member => {
        // Speed up and run to edge
        this.scene.tweens.killTweensOf(member.sprite);

        const exitX = member.sprite.x < 320 ? -50 : 700;
        const distance = Math.abs(exitX - member.sprite.x);

        this.scene.tweens.add({
          targets: member.sprite,
          x: exitX,
          duration: distance * 10, // Fast!
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.removeCrowdMember(member);
          }
        });
      });

      console.log('Crowd seeking shelter from rain');
    } else if (data.type === 'clear' && this.paused) {
      // Rain stopped - resume
      this.paused = false;

      // Delay before crowd returns
      this.scene.time.delayedCall(5000, () => {
        this.startSpawning();
      });

      console.log('Crowd returning after rain');
    }
  }

  /**
   * Handle location changes
   */
  onLocationChanged(data) {
    // Clear all crowd
    this.clearAllCrowd();

    // Update location
    this.currentLocation = data.locationId;

    // Restart spawning for new location
    this.paused = false;
    this.startSpawning();
  }

  /**
   * Clear all crowd members
   */
  clearAllCrowd() {
    this.crowdMembers.forEach(member => {
      this.scene.tweens.killTweensOf(member.sprite);
      member.sprite.destroy();
    });
    this.crowdMembers = [];
  }

  /**
   * Pause crowd spawning (for cutscenes, etc.)
   */
  pause() {
    this.paused = true;
    if (this.spawnTimer) {
      this.spawnTimer.paused = true;
    }
  }

  /**
   * Resume crowd spawning
   */
  resume() {
    this.paused = false;
    if (this.spawnTimer) {
      this.spawnTimer.paused = false;
    }
  }

  /**
   * Get count of current crowd
   */
  getCrowdCount() {
    return this.crowdMembers.length;
  }

  /**
   * Update loop
   */
  update(time, delta) {
    // Could add more complex crowd behavior here:
    // - Avoiding player
    // - Stopping to "talk" to each other
    // - Reacting to events
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
    }

    this.clearAllCrowd();

    this.scene.events.off('timeOfDayChanged', this.onTimeChanged, this);
    this.scene.events.off('weatherChanged', this.onWeatherChanged, this);
    this.scene.events.off('locationChanged', this.onLocationChanged, this);
  }
}
