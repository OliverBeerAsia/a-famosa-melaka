/**
 * Weather System
 *
 * Creates atmospheric weather effects for tropical Melaka:
 * - Rain showers (tropical downpours)
 * - Heat shimmer (noon haze effect)
 * - Morning mist (waterfront fog)
 * - Humidity particles (ambient haze)
 *
 * Weather affects atmosphere and can influence NPC behavior.
 */

export default class WeatherSystem {
  constructor(scene) {
    this.scene = scene;

    // Weather state
    this.currentWeather = 'clear'; // clear, rain, mist, heatwave
    this.weatherIntensity = 0; // 0-1
    this.transitionProgress = 0;

    // Particle emitters
    this.rainEmitter = null;
    this.mistEmitter = null;
    this.humidityEmitter = null;

    // Visual effects
    this.heatShimmerEffect = null;
    this.rainOverlay = null;

    // Weather timing
    this.weatherTimer = null;
    this.minWeatherDuration = 120000; // 2 minutes minimum
    this.maxWeatherDuration = 300000; // 5 minutes maximum

    // Location-specific weather chances
    this.locationWeatherChances = {
      'waterfront': { mist: 0.3, rain: 0.2 },
      'kampung': { rain: 0.25, mist: 0.1 },
      'rua-direita': { rain: 0.15, heatwave: 0.2 },
      'a-famosa-gate': { rain: 0.15, heatwave: 0.15 },
      'st-pauls-church': { mist: 0.2, rain: 0.15 }
    };

    // Palette colors from Art Bible
    this.colors = {
      rain: 0x5DADE2,        // Water Light
      mist: 0xF5F5DC,        // Whitewash (fog color)
      humidity: 0xFFD700,    // Golden (dust motes)
      rainOverlay: 0x1E4D6B  // Water Deep
    };
  }

  /**
   * Initialize the weather system
   */
  initialize() {
    this.createRainSystem();
    this.createMistSystem();
    this.createHumidityParticles();
    this.createHeatShimmer();
    this.createRainOverlay();

    // Start weather cycle
    this.scheduleWeatherChange();

    // Listen for time changes
    this.scene.events.on('timeChanged', this.onTimeChanged, this);
    this.scene.events.on('locationChanged', this.onLocationChanged, this);

    console.log('WeatherSystem initialized');
  }

  /**
   * Create rain particle system
   */
  createRainSystem() {
    // Create rain particles
    const rainConfig = {
      x: { min: 0, max: this.scene.scale.width },
      y: -10,
      quantity: 0,
      frequency: 20,
      speedY: { min: 300, max: 400 },
      speedX: { min: -50, max: -30 }, // Slight wind angle
      scaleX: 0.5,
      scaleY: { min: 2, max: 4 },
      alpha: { start: 0.6, end: 0.2 },
      tint: this.colors.rain,
      lifespan: 1500,
      blendMode: 'ADD'
    };

    // Create a simple rectangle texture for rain drops
    const rainGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    rainGraphics.fillStyle(0xFFFFFF, 1);
    rainGraphics.fillRect(0, 0, 2, 8);
    rainGraphics.generateTexture('rain-drop', 2, 8);
    rainGraphics.destroy();

    this.rainEmitter = this.scene.add.particles(0, 0, 'rain-drop', rainConfig);
    this.rainEmitter.setDepth(1000);
    this.rainEmitter.stop();
  }

  /**
   * Create mist/fog particle system
   */
  createMistSystem() {
    // Create soft mist particles
    const mistGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    mistGraphics.fillStyle(0xFFFFFF, 0.3);
    mistGraphics.fillCircle(16, 16, 16);
    mistGraphics.generateTexture('mist-particle', 32, 32);
    mistGraphics.destroy();

    const mistConfig = {
      x: { min: 0, max: this.scene.scale.width },
      y: { min: 0, max: this.scene.scale.height },
      quantity: 0,
      frequency: 500,
      speedX: { min: 5, max: 20 },
      speedY: { min: -5, max: 5 },
      scale: { start: 1, end: 2 },
      alpha: { start: 0.2, end: 0 },
      tint: this.colors.mist,
      lifespan: 8000,
      blendMode: 'NORMAL'
    };

    this.mistEmitter = this.scene.add.particles(0, 0, 'mist-particle', mistConfig);
    this.mistEmitter.setDepth(900);
    this.mistEmitter.stop();
  }

  /**
   * Create ambient humidity/dust particles
   */
  createHumidityParticles() {
    // Small floating particles visible in golden light
    const dustGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    dustGraphics.fillStyle(0xFFFFFF, 1);
    dustGraphics.fillCircle(2, 2, 2);
    dustGraphics.generateTexture('dust-mote', 4, 4);
    dustGraphics.destroy();

    const humidityConfig = {
      x: { min: 0, max: this.scene.scale.width },
      y: { min: 0, max: this.scene.scale.height },
      quantity: 1,
      frequency: 200,
      speedX: { min: -10, max: 10 },
      speedY: { min: -20, max: 5 },
      scale: { min: 0.5, max: 1.5 },
      alpha: { start: 0, end: 0.4, ease: 'Sine.easeInOut' },
      tint: this.colors.humidity,
      lifespan: 6000,
      blendMode: 'ADD'
    };

    this.humidityEmitter = this.scene.add.particles(0, 0, 'dust-mote', humidityConfig);
    this.humidityEmitter.setDepth(800);

    // Dust motes always active during golden hour, reduced otherwise
    this.updateHumidityParticles();
  }

  /**
   * Create heat shimmer effect (shader-like distortion)
   */
  createHeatShimmer() {
    // Create a subtle overlay that simulates heat distortion
    // This is a simplified version - full implementation would use shaders
    this.heatShimmerOverlay = this.scene.add.rectangle(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      this.scene.scale.width,
      this.scene.scale.height,
      0xFFFFFF,
      0
    );
    this.heatShimmerOverlay.setDepth(850);
    this.heatShimmerOverlay.setBlendMode('ADD');

    // Animated shimmer lines
    this.shimmerLines = [];
    for (let i = 0; i < 5; i++) {
      const line = this.scene.add.rectangle(
        this.scene.scale.width / 2,
        100 + (i * 80),
        this.scene.scale.width,
        3,
        0xFFFFFF,
        0
      );
      line.setDepth(851);
      line.setBlendMode('ADD');
      this.shimmerLines.push(line);
    }
  }

  /**
   * Create rain overlay (darkening effect during rain)
   */
  createRainOverlay() {
    this.rainOverlay = this.scene.add.rectangle(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      this.scene.scale.width,
      this.scene.scale.height,
      this.colors.rainOverlay,
      0
    );
    this.rainOverlay.setDepth(899);
    this.rainOverlay.setBlendMode('MULTIPLY');
  }

  /**
   * Update humidity particles based on time of day
   */
  updateHumidityParticles() {
    const timeSystem = this.scene.registry.get('timeSystem');
    if (!timeSystem) return;

    const timeOfDay = timeSystem.getTimeOfDay();

    // Golden hour = maximum dust motes
    if (timeOfDay === 'golden' || timeOfDay === 'dusk') {
      this.humidityEmitter.setFrequency(100);
      this.humidityEmitter.setQuantity(2);
    } else if (timeOfDay === 'day' || timeOfDay === 'morning') {
      this.humidityEmitter.setFrequency(300);
      this.humidityEmitter.setQuantity(1);
    } else {
      // Night/dawn - fireflies instead of dust
      this.humidityEmitter.setFrequency(500);
      this.humidityEmitter.setQuantity(1);
      // Change color to firefly yellow-green
      this.humidityEmitter.setParticleTint(0x9ACD32);
    }
  }

  /**
   * Start rain weather
   */
  startRain(intensity = 0.5) {
    this.currentWeather = 'rain';
    this.weatherIntensity = intensity;

    // Start rain particles
    const particleCount = Math.floor(5 + (intensity * 15));
    this.rainEmitter.setQuantity(particleCount);
    this.rainEmitter.start();

    // Darken screen
    this.scene.tweens.add({
      targets: this.rainOverlay,
      alpha: 0.15 * intensity,
      duration: 2000,
      ease: 'Sine.easeIn'
    });

    // Play rain ambient sound
    this.scene.events.emit('weatherChanged', { type: 'rain', intensity });

    // Create splash effects on ground
    this.startRainSplashes();

    console.log(`Rain started - intensity: ${intensity}`);
  }

  /**
   * Create rain splash effects
   */
  startRainSplashes() {
    // Create splash particle emitter
    if (this.splashEmitter) {
      this.splashEmitter.destroy();
    }

    const splashGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    splashGraphics.fillStyle(0xFFFFFF, 0.5);
    splashGraphics.fillCircle(4, 4, 4);
    splashGraphics.generateTexture('rain-splash', 8, 8);
    splashGraphics.destroy();

    const splashConfig = {
      x: { min: 0, max: this.scene.scale.width },
      y: { min: this.scene.scale.height - 100, max: this.scene.scale.height },
      quantity: Math.floor(this.weatherIntensity * 3),
      frequency: 100,
      speedY: { min: -30, max: -10 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.4, end: 0 },
      tint: this.colors.rain,
      lifespan: 300,
      blendMode: 'ADD'
    };

    this.splashEmitter = this.scene.add.particles(0, 0, 'rain-splash', splashConfig);
    this.splashEmitter.setDepth(100);
  }

  /**
   * Stop rain weather
   */
  stopRain() {
    // Fade out rain
    this.scene.tweens.add({
      targets: this.rainOverlay,
      alpha: 0,
      duration: 3000,
      ease: 'Sine.easeOut'
    });

    // Stop emitters after fade
    this.scene.time.delayedCall(1000, () => {
      this.rainEmitter.stop();
      if (this.splashEmitter) {
        this.splashEmitter.stop();
      }
    });

    this.currentWeather = 'clear';
    this.scene.events.emit('weatherChanged', { type: 'clear', intensity: 0 });

    console.log('Rain stopped');
  }

  /**
   * Start mist weather (morning fog)
   */
  startMist(intensity = 0.5) {
    this.currentWeather = 'mist';
    this.weatherIntensity = intensity;

    // Start mist particles
    this.mistEmitter.setQuantity(Math.floor(2 + (intensity * 5)));
    this.mistEmitter.start();

    // Add white overlay for fog effect
    this.scene.tweens.add({
      targets: this.heatShimmerOverlay,
      alpha: 0.1 * intensity,
      duration: 3000,
      ease: 'Sine.easeIn'
    });

    this.scene.events.emit('weatherChanged', { type: 'mist', intensity });

    console.log(`Mist started - intensity: ${intensity}`);
  }

  /**
   * Stop mist weather
   */
  stopMist() {
    this.scene.tweens.add({
      targets: this.heatShimmerOverlay,
      alpha: 0,
      duration: 5000,
      ease: 'Sine.easeOut'
    });

    this.scene.time.delayedCall(2000, () => {
      this.mistEmitter.stop();
    });

    this.currentWeather = 'clear';
    this.scene.events.emit('weatherChanged', { type: 'clear', intensity: 0 });

    console.log('Mist cleared');
  }

  /**
   * Start heat shimmer effect (noon heatwave)
   */
  startHeatwave(intensity = 0.5) {
    this.currentWeather = 'heatwave';
    this.weatherIntensity = intensity;

    // Animate shimmer lines
    this.shimmerLines.forEach((line, index) => {
      this.scene.tweens.add({
        targets: line,
        alpha: 0.05 * intensity,
        y: line.y + 10,
        duration: 2000 + (index * 200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });

    // Add slight screen distortion effect
    this.scene.tweens.add({
      targets: this.heatShimmerOverlay,
      alpha: 0.03 * intensity,
      duration: 1000
    });

    this.scene.events.emit('weatherChanged', { type: 'heatwave', intensity });

    console.log(`Heatwave started - intensity: ${intensity}`);
  }

  /**
   * Stop heat shimmer
   */
  stopHeatwave() {
    // Stop shimmer animations
    this.shimmerLines.forEach(line => {
      this.scene.tweens.killTweensOf(line);
      line.setAlpha(0);
    });

    this.scene.tweens.add({
      targets: this.heatShimmerOverlay,
      alpha: 0,
      duration: 2000
    });

    this.currentWeather = 'clear';
    this.scene.events.emit('weatherChanged', { type: 'clear', intensity: 0 });

    console.log('Heatwave ended');
  }

  /**
   * Schedule random weather changes
   */
  scheduleWeatherChange() {
    const delay = Phaser.Math.Between(this.minWeatherDuration, this.maxWeatherDuration);

    this.weatherTimer = this.scene.time.delayedCall(delay, () => {
      this.randomWeatherEvent();
      this.scheduleWeatherChange(); // Schedule next change
    });
  }

  /**
   * Trigger a random weather event based on location and time
   */
  randomWeatherEvent() {
    // Get current location
    const location = this.scene.currentMap || 'rua-direita';
    const chances = this.locationWeatherChances[location] || {};

    // Get time of day
    const timeSystem = this.scene.registry.get('timeSystem');
    const timeOfDay = timeSystem ? timeSystem.getTimeOfDay() : 'day';

    // Modify chances based on time
    let rainChance = chances.rain || 0.1;
    let mistChance = chances.mist || 0.05;
    let heatwaveChance = chances.heatwave || 0.1;

    // Mist more likely at dawn
    if (timeOfDay === 'dawn') {
      mistChance *= 2;
      heatwaveChance = 0;
    }
    // Heatwave only at noon/afternoon
    else if (timeOfDay === 'day') {
      heatwaveChance *= 1.5;
      mistChance = 0;
    }
    // No weather events at night (mostly)
    else if (timeOfDay === 'night') {
      rainChance *= 0.5;
      mistChance = 0;
      heatwaveChance = 0;
    }

    // Roll for weather
    const roll = Math.random();

    if (this.currentWeather !== 'clear') {
      // Currently has weather - chance to clear
      if (roll < 0.4) {
        this.clearWeather();
      }
    } else {
      // Currently clear - chance for weather
      if (roll < rainChance) {
        this.startRain(Phaser.Math.FloatBetween(0.3, 0.8));
      } else if (roll < rainChance + mistChance) {
        this.startMist(Phaser.Math.FloatBetween(0.3, 0.7));
      } else if (roll < rainChance + mistChance + heatwaveChance) {
        this.startHeatwave(Phaser.Math.FloatBetween(0.4, 0.8));
      }
    }
  }

  /**
   * Clear current weather
   */
  clearWeather() {
    switch (this.currentWeather) {
      case 'rain':
        this.stopRain();
        break;
      case 'mist':
        this.stopMist();
        break;
      case 'heatwave':
        this.stopHeatwave();
        break;
    }
  }

  /**
   * Force specific weather (for scripted events)
   */
  setWeather(type, intensity = 0.5) {
    // Clear current weather first
    this.clearWeather();

    // Start new weather after brief delay
    this.scene.time.delayedCall(500, () => {
      switch (type) {
        case 'rain':
          this.startRain(intensity);
          break;
        case 'mist':
          this.startMist(intensity);
          break;
        case 'heatwave':
          this.startHeatwave(intensity);
          break;
        case 'clear':
          // Already cleared
          break;
      }
    });
  }

  /**
   * Handle time of day changes
   */
  onTimeChanged(data) {
    this.updateHumidityParticles();

    // Auto-clear inappropriate weather
    const timeOfDay = data.timeOfDay;

    if (timeOfDay === 'night' && this.currentWeather === 'heatwave') {
      this.stopHeatwave();
    }

    if (timeOfDay !== 'dawn' && timeOfDay !== 'morning' && this.currentWeather === 'mist') {
      // Mist burns off after morning
      this.scene.time.delayedCall(30000, () => {
        if (this.currentWeather === 'mist') {
          this.stopMist();
        }
      });
    }
  }

  /**
   * Handle location changes
   */
  onLocationChanged(data) {
    // Weather persists across locations but intensity might vary
    // Waterfront has more mist, kampung has more rain, etc.
  }

  /**
   * Get current weather state
   */
  getWeatherState() {
    return {
      type: this.currentWeather,
      intensity: this.weatherIntensity
    };
  }

  /**
   * Check if it's raining (for NPC behavior)
   */
  isRaining() {
    return this.currentWeather === 'rain';
  }

  /**
   * Update loop
   */
  update(time, delta) {
    // Humidity particles follow camera
    if (this.humidityEmitter && this.scene.cameras.main) {
      const cam = this.scene.cameras.main;
      this.humidityEmitter.setPosition(cam.scrollX, cam.scrollY);
    }

    // Rain follows camera
    if (this.rainEmitter && this.scene.cameras.main) {
      const cam = this.scene.cameras.main;
      this.rainEmitter.setPosition(cam.scrollX, cam.scrollY);
    }
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.weatherTimer) {
      this.weatherTimer.destroy();
    }

    if (this.rainEmitter) {
      this.rainEmitter.destroy();
    }

    if (this.mistEmitter) {
      this.mistEmitter.destroy();
    }

    if (this.humidityEmitter) {
      this.humidityEmitter.destroy();
    }

    if (this.splashEmitter) {
      this.splashEmitter.destroy();
    }

    this.scene.events.off('timeChanged', this.onTimeChanged, this);
    this.scene.events.off('locationChanged', this.onLocationChanged, this);
  }
}
