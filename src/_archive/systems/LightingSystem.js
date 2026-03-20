/**
 * Lighting System
 *
 * Advanced lighting for atmospheric Melaka:
 * - Time-of-day ambient lighting with proper color grading
 * - Point light sources (torches, lanterns, windows, fires)
 * - Golden hour special rendering
 * - Interior darkness
 * - Dynamic shadows (simplified)
 *
 * Works alongside TimeSystem to create the "Golden Melaka" look.
 */

export default class LightingSystem {
  constructor(scene) {
    this.scene = scene;

    // Lighting layers
    this.ambientOverlay = null;
    this.shadowLayer = null;
    this.lightMask = null;

    // Point lights
    this.pointLights = [];

    // Time-based lighting presets from Art Bible
    this.lightingPresets = {
      dawn: {
        ambient: 0xFFE4B5,    // Soft peachy
        ambientAlpha: 0.15,
        shadowColor: 0x9370DB, // Purple-tinted
        shadowAlpha: 0.2,
        lightIntensity: 0.6
      },
      morning: {
        ambient: 0xFFFACD,    // Lemon chiffon
        ambientAlpha: 0.10,
        shadowColor: 0x4A4A4A,
        shadowAlpha: 0.15,
        lightIntensity: 0.8
      },
      day: {
        ambient: 0xFFFFFF,    // Neutral white (harsh)
        ambientAlpha: 0.05,
        shadowColor: 0x4A4A4A,
        shadowAlpha: 0.25,    // Short, dark shadows
        lightIntensity: 1.0
      },
      golden: {
        // THE signature look
        ambient: 0xFFD700,    // Pure gold
        ambientAlpha: 0.20,
        shadowColor: 0xB8860B, // Warm golden shadow
        shadowAlpha: 0.15,
        lightIntensity: 0.9,
        special: true         // Enable extra effects
      },
      dusk: {
        ambient: 0xFF8C00,    // Deep orange
        ambientAlpha: 0.25,
        shadowColor: 0x9370DB, // Purple shadows
        shadowAlpha: 0.25,
        lightIntensity: 0.7
      },
      night: {
        ambient: 0x191970,    // Midnight blue
        ambientAlpha: 0.40,
        shadowColor: 0x0C0C30,
        shadowAlpha: 0.5,
        lightIntensity: 0.3   // Point lights become crucial
      }
    };

    // Current state
    this.currentPreset = 'day';
    this.transitionDuration = 3000; // 3 seconds for lighting transitions

    // Light source definitions
    this.lightSourceTypes = {
      torch: {
        radius: 48,
        color: 0xFF8C00,
        intensity: 0.8,
        flicker: true,
        flickerSpeed: 100,
        flickerAmount: 0.2
      },
      lantern: {
        radius: 32,
        color: 0xFFD700,
        intensity: 0.7,
        flicker: false
      },
      cookingFire: {
        radius: 64,
        color: 0xFF6347,
        intensity: 0.9,
        flicker: true,
        flickerSpeed: 80,
        flickerAmount: 0.3
      },
      window: {
        radius: 24,
        color: 0xFFFACD,
        intensity: 0.5,
        flicker: false,
        nightOnly: true
      },
      candle: {
        radius: 16,
        color: 0xFFE4B5,
        intensity: 0.4,
        flicker: true,
        flickerSpeed: 150,
        flickerAmount: 0.15
      },
      moonlight: {
        radius: 1000,
        color: 0xC0C0C0,
        intensity: 0.1,
        flicker: false,
        global: true
      }
    };
  }

  /**
   * Initialize the lighting system
   */
  initialize() {
    this.createAmbientOverlay();
    this.createShadowLayer();
    this.createLightMaskLayer();

    // Listen for time changes
    this.scene.events.on('timeOfDayChanged', this.onTimeOfDayChanged, this);

    // Set initial lighting based on current time
    const timeSystem = this.scene.registry.get('timeSystem');
    if (timeSystem) {
      const timeOfDay = timeSystem.getTimeOfDay();
      this.setLightingPreset(timeOfDay, false);
    }

    console.log('LightingSystem initialized');
  }

  /**
   * Create the ambient color overlay
   */
  createAmbientOverlay() {
    this.ambientOverlay = this.scene.add.rectangle(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      this.scene.scale.width,
      this.scene.scale.height,
      0xFFFFFF,
      0
    );
    this.ambientOverlay.setScrollFactor(0);
    this.ambientOverlay.setDepth(950);
    this.ambientOverlay.setBlendMode('MULTIPLY');
  }

  /**
   * Create shadow layer for directional shadows
   */
  createShadowLayer() {
    this.shadowLayer = this.scene.add.rectangle(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      this.scene.scale.width,
      this.scene.scale.height,
      0x000000,
      0
    );
    this.shadowLayer.setScrollFactor(0);
    this.shadowLayer.setDepth(100); // Below most objects
    this.shadowLayer.setBlendMode('MULTIPLY');
  }

  /**
   * Create light mask layer for point lights
   */
  createLightMaskLayer() {
    // This will hold the combined light from all point sources
    // Using a render texture for better performance with multiple lights
    this.lightContainer = this.scene.add.container(0, 0);
    this.lightContainer.setDepth(951);
  }

  /**
   * Add a point light source
   */
  addPointLight(x, y, type = 'torch', id = null) {
    const config = this.lightSourceTypes[type];
    if (!config) {
      console.warn(`Unknown light type: ${type}`);
      return null;
    }

    // Create light graphic
    const lightGraphic = this.scene.add.graphics();
    this.drawLightGradient(lightGraphic, config);

    lightGraphic.setPosition(x, y);
    lightGraphic.setDepth(949);
    lightGraphic.setBlendMode('ADD');

    const light = {
      id: id || `light_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      type,
      config,
      graphic: lightGraphic,
      active: true,
      baseIntensity: config.intensity,
      currentIntensity: config.intensity,
      flickerTimer: null
    };

    // Start flicker animation if needed
    if (config.flicker) {
      this.startFlicker(light);
    }

    // Handle night-only lights
    if (config.nightOnly) {
      const timeSystem = this.scene.registry.get('timeSystem');
      const timeOfDay = timeSystem ? timeSystem.getTimeOfDay() : 'day';
      light.active = (timeOfDay === 'night' || timeOfDay === 'dusk');
      lightGraphic.setVisible(light.active);
    }

    this.pointLights.push(light);
    return light;
  }

  /**
   * Draw radial gradient for light
   */
  drawLightGradient(graphics, config) {
    const steps = 10;
    const radius = config.radius;

    graphics.clear();

    for (let i = steps; i > 0; i--) {
      const stepRadius = (radius / steps) * i;
      const alpha = (config.intensity / steps) * (steps - i + 1) * 0.5;

      graphics.fillStyle(config.color, alpha);
      graphics.fillCircle(0, 0, stepRadius);
    }
  }

  /**
   * Start flicker animation for a light
   */
  startFlicker(light) {
    const config = light.config;

    light.flickerTimer = this.scene.time.addEvent({
      delay: config.flickerSpeed,
      callback: () => {
        if (!light.active) return;

        // Random intensity variation
        const variation = Phaser.Math.FloatBetween(
          -config.flickerAmount,
          config.flickerAmount
        );
        light.currentIntensity = Math.max(0.1,
          Math.min(1, light.baseIntensity + variation)
        );

        // Redraw with new intensity
        const modifiedConfig = { ...config, intensity: light.currentIntensity };
        this.drawLightGradient(light.graphic, modifiedConfig);
      },
      loop: true
    });
  }

  /**
   * Remove a point light
   */
  removePointLight(idOrLight) {
    const id = typeof idOrLight === 'string' ? idOrLight : idOrLight.id;
    const index = this.pointLights.findIndex(l => l.id === id);

    if (index !== -1) {
      const light = this.pointLights[index];

      if (light.flickerTimer) {
        light.flickerTimer.destroy();
      }

      light.graphic.destroy();
      this.pointLights.splice(index, 1);
    }
  }

  /**
   * Set lighting based on time of day preset
   */
  setLightingPreset(presetName, animate = true) {
    const preset = this.lightingPresets[presetName];
    if (!preset) {
      console.warn(`Unknown lighting preset: ${presetName}`);
      return;
    }

    this.currentPreset = presetName;

    if (animate) {
      // Smooth transition to new lighting
      this.scene.tweens.add({
        targets: this.ambientOverlay,
        alpha: preset.ambientAlpha,
        duration: this.transitionDuration,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          // Gradually shift color during transition
        }
      });

      this.scene.tweens.add({
        targets: this.shadowLayer,
        alpha: preset.shadowAlpha,
        duration: this.transitionDuration,
        ease: 'Sine.easeInOut'
      });
    } else {
      // Immediate change
      this.ambientOverlay.setAlpha(preset.ambientAlpha);
      this.shadowLayer.setAlpha(preset.shadowAlpha);
    }

    // Update ambient color
    this.ambientOverlay.setFillStyle(preset.ambient, preset.ambientAlpha);
    this.shadowLayer.setFillStyle(preset.shadowColor, preset.shadowAlpha);

    // Update point light visibility based on time
    this.updatePointLightVisibility(presetName);

    // Special golden hour effects
    if (preset.special) {
      this.enableGoldenHourEffects();
    } else {
      this.disableGoldenHourEffects();
    }

    // Emit event for other systems
    this.scene.events.emit('lightingChanged', {
      preset: presetName,
      ambient: preset.ambient,
      intensity: preset.lightIntensity
    });
  }

  /**
   * Update point light visibility based on time
   */
  updatePointLightVisibility(timeOfDay) {
    const isNightTime = (timeOfDay === 'night' || timeOfDay === 'dusk');

    this.pointLights.forEach(light => {
      if (light.config.nightOnly) {
        light.active = isNightTime;
        light.graphic.setVisible(isNightTime);
      }

      // Increase light intensity at night
      if (isNightTime && !light.config.nightOnly) {
        light.baseIntensity = light.config.intensity * 1.3;
      } else {
        light.baseIntensity = light.config.intensity;
      }
    });
  }

  /**
   * Enable special golden hour visual effects
   */
  enableGoldenHourEffects() {
    if (this.goldenHourActive) return;
    this.goldenHourActive = true;

    // Create golden light rays (god rays effect)
    if (!this.lightRays) {
      this.lightRays = [];

      for (let i = 0; i < 3; i++) {
        const ray = this.scene.add.rectangle(
          100 + (i * 200),
          0,
          30 + (i * 10),
          this.scene.scale.height,
          0xFFD700,
          0
        );
        ray.setOrigin(0.5, 0);
        ray.setScrollFactor(0);
        ray.setDepth(948);
        ray.setBlendMode('ADD');
        ray.setRotation(Phaser.Math.DegToRad(15 - (i * 5)));
        this.lightRays.push(ray);
      }
    }

    // Animate rays fading in
    this.lightRays.forEach((ray, index) => {
      this.scene.tweens.add({
        targets: ray,
        alpha: 0.08,
        duration: 2000,
        delay: index * 500,
        ease: 'Sine.easeIn'
      });

      // Subtle movement
      this.scene.tweens.add({
        targets: ray,
        x: ray.x + 20,
        duration: 10000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });
  }

  /**
   * Disable golden hour effects
   */
  disableGoldenHourEffects() {
    if (!this.goldenHourActive) return;
    this.goldenHourActive = false;

    if (this.lightRays) {
      this.lightRays.forEach(ray => {
        this.scene.tweens.killTweensOf(ray);
        this.scene.tweens.add({
          targets: ray,
          alpha: 0,
          duration: 2000,
          ease: 'Sine.easeOut'
        });
      });
    }
  }

  /**
   * Create lights from map data
   */
  createLightsFromMap(mapData) {
    if (!mapData || !mapData.lights) return;

    mapData.lights.forEach(lightDef => {
      this.addPointLight(
        lightDef.x,
        lightDef.y,
        lightDef.type || 'torch',
        lightDef.id
      );
    });
  }

  /**
   * Create lights for a location
   */
  setupLocationLights(locationId) {
    // Clear existing lights
    this.clearAllPointLights();

    // Location-specific light placement
    const locationLights = {
      'rua-direita': [
        { x: 120, y: 200, type: 'lantern' },
        { x: 300, y: 150, type: 'lantern' },
        { x: 480, y: 220, type: 'torch' },
        { x: 200, y: 350, type: 'window' },
        { x: 400, y: 350, type: 'window' },
        { x: 600, y: 180, type: 'lantern' }
      ],
      'a-famosa-gate': [
        { x: 200, y: 150, type: 'torch' },
        { x: 400, y: 150, type: 'torch' },
        { x: 300, y: 300, type: 'torch' },
        { x: 100, y: 250, type: 'torch' },
        { x: 500, y: 250, type: 'torch' }
      ],
      'st-pauls-church': [
        { x: 250, y: 200, type: 'candle' },
        { x: 350, y: 200, type: 'candle' },
        { x: 300, y: 150, type: 'candle' },
        { x: 300, y: 300, type: 'window' }
      ],
      'waterfront': [
        { x: 150, y: 300, type: 'lantern' },
        { x: 350, y: 280, type: 'lantern' },
        { x: 550, y: 300, type: 'lantern' },
        { x: 250, y: 150, type: 'torch' }
      ],
      'kampung': [
        { x: 200, y: 250, type: 'cookingFire' },
        { x: 450, y: 300, type: 'cookingFire' },
        { x: 300, y: 180, type: 'torch' }
      ]
    };

    const lights = locationLights[locationId] || [];
    lights.forEach(lightDef => {
      this.addPointLight(lightDef.x, lightDef.y, lightDef.type);
    });

    console.log(`Created ${lights.length} lights for ${locationId}`);
  }

  /**
   * Clear all point lights
   */
  clearAllPointLights() {
    this.pointLights.forEach(light => {
      if (light.flickerTimer) {
        light.flickerTimer.destroy();
      }
      light.graphic.destroy();
    });
    this.pointLights = [];
  }

  /**
   * Handle time of day changes
   */
  onTimeOfDayChanged(data) {
    this.setLightingPreset(data.timeOfDay, true);
  }

  /**
   * Get current lighting intensity (for other systems)
   */
  getLightIntensity() {
    const preset = this.lightingPresets[this.currentPreset];
    return preset ? preset.lightIntensity : 1.0;
  }

  /**
   * Check if point is lit (for NPC behavior, stealth, etc.)
   */
  isPointLit(x, y) {
    // Check if point is within any light radius
    for (const light of this.pointLights) {
      if (!light.active) continue;

      const distance = Phaser.Math.Distance.Between(light.x, light.y, x, y);
      if (distance < light.config.radius) {
        return true;
      }
    }

    // Daytime is always "lit"
    return this.currentPreset !== 'night';
  }

  /**
   * Update loop
   */
  update(time, delta) {
    // Update any dynamic lighting effects here
  }

  /**
   * Clean up
   */
  destroy() {
    this.clearAllPointLights();

    if (this.ambientOverlay) {
      this.ambientOverlay.destroy();
    }

    if (this.shadowLayer) {
      this.shadowLayer.destroy();
    }

    if (this.lightRays) {
      this.lightRays.forEach(ray => ray.destroy());
    }

    this.scene.events.off('timeOfDayChanged', this.onTimeOfDayChanged, this);
  }
}
