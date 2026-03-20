/**
 * Weather System
 *
 * Creates atmospheric weather effects for tropical Melaka:
 * - Rain showers (tropical downpours)
 * - Heat shimmer (noon haze effect)
 * - Morning mist (waterfront fog)
 * - Humidity particles (ambient haze)
 *
 * Weather affects atmosphere and can influence NPC/Crowd behavior.
 * Ported from archived JS version with TypeScript types and 960x540 coordinates.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';
import type { ResolvedVisualQuality } from '../visualProfile';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type WeatherType = 'clear' | 'rain' | 'mist' | 'heatwave';

interface WeatherChances {
  rain?: number;
  mist?: number;
  heatwave?: number;
}

/** Palette colors from Art Bible */
const WEATHER_COLORS = {
  rain: 0x5dade2,
  mist: 0xf5f5dc,
  humidity: 0xffd700,
  rainOverlay: 0x1e4d6b,
} as const;

/** Location-specific weather probabilities */
const LOCATION_WEATHER_CHANCES: Record<string, WeatherChances> = {
  waterfront: { mist: 0.3, rain: 0.2 },
  kampung: { rain: 0.25, mist: 0.1 },
  'rua-direita': { rain: 0.15, heatwave: 0.2 },
  'a-famosa-gate': { rain: 0.15, heatwave: 0.15 },
  'st-pauls-church': { mist: 0.2, rain: 0.15 },
};

export class WeatherSystem {
  private scene: Phaser.Scene;
  private quality: ResolvedVisualQuality;
  private particlesEnabled: boolean;

  // Weather state
  private currentWeather: WeatherType = 'clear';
  private weatherIntensity = 0;

  // Particle emitters
  private rainEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private mistEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private humidityEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private splashEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  // Visual overlays
  private heatShimmerOverlay: Phaser.GameObjects.Rectangle | null = null;
  private shimmerLines: Phaser.GameObjects.Rectangle[] = [];
  private rainOverlay: Phaser.GameObjects.Rectangle | null = null;

  // Timers
  private weatherTimer: Phaser.Time.TimerEvent | null = null;
  private readonly minWeatherDuration = 120000; // 2 min
  private readonly maxWeatherDuration = 300000; // 5 min

  // Current context
  private currentLocation: string = 'rua-direita';
  private currentTimeOfDay: TimeOfDay = 'day';

  constructor(scene: Phaser.Scene, quality: ResolvedVisualQuality) {
    this.scene = scene;
    this.quality = quality;
    this.particlesEnabled = quality !== 'low';
  }

  /** Create particle textures and emitters, start the weather cycle. */
  initialize(): void {
    this.createParticleTextures();

    if (this.particlesEnabled) {
      this.createRainSystem();
      this.createMistSystem();
      this.createHumidityParticles();
    }

    this.createHeatShimmer();
    this.createRainOverlay();

    // Start weather cycle
    this.scheduleWeatherChange();
  }

  /** Set the current location (adjusts weather probabilities). */
  setLocation(locationId: string): void {
    this.currentLocation = locationId;
  }

  /** Update time of day (adjusts weather behaviour). */
  setTimeOfDay(time: TimeOfDay): void {
    this.currentTimeOfDay = time;
    this.updateHumidityParticles();

    // Auto-clear inappropriate weather
    if (time === 'night' && this.currentWeather === 'heatwave') {
      this.stopHeatwave();
    }
    if (time !== 'dawn' && this.currentWeather === 'mist') {
      this.scene.time.delayedCall(30000, () => {
        if (this.currentWeather === 'mist') {
          this.stopMist();
        }
      });
    }
  }

  /** Check whether it is currently raining. */
  isRaining(): boolean {
    return this.currentWeather === 'rain';
  }

  /** Get current weather state for external queries. */
  getWeatherState(): { type: WeatherType; intensity: number } {
    return { type: this.currentWeather, intensity: this.weatherIntensity };
  }

  // ---------------------------------------------------------------------------
  // Particle texture creation
  // ---------------------------------------------------------------------------

  private createParticleTextures(): void {
    // Rain drop (2x8 white rectangle)
    if (!this.scene.textures.exists('rain-drop')) {
      const rainGfx = this.scene.make.graphics({ x: 0, y: 0 });
      rainGfx.fillStyle(0xffffff, 1);
      rainGfx.fillRect(0, 0, 2, 8);
      rainGfx.generateTexture('rain-drop', 2, 8);
      rainGfx.destroy();
    }

    // Mist particle (soft circle 32x32)
    if (!this.scene.textures.exists('mist-particle')) {
      const mistGfx = this.scene.make.graphics({ x: 0, y: 0 });
      mistGfx.fillStyle(0xffffff, 0.3);
      mistGfx.fillCircle(16, 16, 16);
      mistGfx.generateTexture('mist-particle', 32, 32);
      mistGfx.destroy();
    }

    // Dust mote (small circle 4x4)
    if (!this.scene.textures.exists('dust-mote')) {
      const dustGfx = this.scene.make.graphics({ x: 0, y: 0 });
      dustGfx.fillStyle(0xffffff, 1);
      dustGfx.fillCircle(2, 2, 2);
      dustGfx.generateTexture('dust-mote', 4, 4);
      dustGfx.destroy();
    }

    // Rain splash (soft circle 8x8)
    if (!this.scene.textures.exists('rain-splash')) {
      const splashGfx = this.scene.make.graphics({ x: 0, y: 0 });
      splashGfx.fillStyle(0xffffff, 0.5);
      splashGfx.fillCircle(4, 4, 4);
      splashGfx.generateTexture('rain-splash', 8, 8);
      splashGfx.destroy();
    }
  }

  // ---------------------------------------------------------------------------
  // Rain
  // ---------------------------------------------------------------------------

  private createRainSystem(): void {
    this.rainEmitter = this.scene.add.particles(0, 0, 'rain-drop', {
      x: { min: 0, max: GAME_WIDTH },
      y: -10,
      quantity: 0,
      frequency: 20,
      speedY: { min: 300, max: 400 },
      speedX: { min: -50, max: -30 },
      scaleX: 0.5,
      scaleY: { min: 2, max: 4 },
      alpha: { start: 0.6, end: 0.2 },
      tint: WEATHER_COLORS.rain,
      lifespan: 1500,
      blendMode: 'ADD',
    });
    this.rainEmitter.setDepth(1000);
    this.rainEmitter.stop();
  }

  private startRain(intensity = 0.5): void {
    this.currentWeather = 'rain';
    this.weatherIntensity = intensity;

    if (this.rainEmitter) {
      const particleCount = Math.floor(5 + intensity * 15);
      this.rainEmitter.setQuantity(particleCount);
      this.rainEmitter.start();
    }

    // Darken overlay
    if (this.rainOverlay) {
      this.scene.tweens.add({
        targets: this.rainOverlay,
        alpha: 0.15 * intensity,
        duration: 2000,
        ease: 'Sine.easeIn',
      });
    }

    this.startRainSplashes();
    this.scene.events.emit('weatherChanged', { type: 'rain', intensity });
  }

  private startRainSplashes(): void {
    if (!this.particlesEnabled) return;

    if (this.splashEmitter) {
      this.splashEmitter.destroy();
      this.splashEmitter = null;
    }

    this.splashEmitter = this.scene.add.particles(0, 0, 'rain-splash', {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: GAME_HEIGHT - 100, max: GAME_HEIGHT },
      quantity: Math.floor(this.weatherIntensity * 3),
      frequency: 100,
      speedY: { min: -30, max: -10 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.4, end: 0 },
      tint: WEATHER_COLORS.rain,
      lifespan: 300,
      blendMode: 'ADD',
    });
    this.splashEmitter.setDepth(100);
  }

  private stopRain(): void {
    if (this.rainOverlay) {
      this.scene.tweens.add({
        targets: this.rainOverlay,
        alpha: 0,
        duration: 3000,
        ease: 'Sine.easeOut',
      });
    }

    this.scene.time.delayedCall(1000, () => {
      this.rainEmitter?.stop();
      this.splashEmitter?.stop();
    });

    this.currentWeather = 'clear';
    this.scene.events.emit('weatherChanged', { type: 'clear', intensity: 0 });
  }

  // ---------------------------------------------------------------------------
  // Mist
  // ---------------------------------------------------------------------------

  private createMistSystem(): void {
    this.mistEmitter = this.scene.add.particles(0, 0, 'mist-particle', {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: 0, max: GAME_HEIGHT },
      quantity: 0,
      frequency: 500,
      speedX: { min: 5, max: 20 },
      speedY: { min: -5, max: 5 },
      scale: { start: 1, end: 2 },
      alpha: { start: 0.2, end: 0 },
      tint: WEATHER_COLORS.mist,
      lifespan: 8000,
      blendMode: 'NORMAL',
    });
    this.mistEmitter.setDepth(900);
    this.mistEmitter.stop();
  }

  private startMist(intensity = 0.5): void {
    this.currentWeather = 'mist';
    this.weatherIntensity = intensity;

    if (this.mistEmitter) {
      this.mistEmitter.setQuantity(Math.floor(2 + intensity * 5));
      this.mistEmitter.start();
    }

    if (this.heatShimmerOverlay) {
      this.scene.tweens.add({
        targets: this.heatShimmerOverlay,
        alpha: 0.1 * intensity,
        duration: 3000,
        ease: 'Sine.easeIn',
      });
    }

    this.scene.events.emit('weatherChanged', { type: 'mist', intensity });
  }

  private stopMist(): void {
    if (this.heatShimmerOverlay) {
      this.scene.tweens.add({
        targets: this.heatShimmerOverlay,
        alpha: 0,
        duration: 5000,
        ease: 'Sine.easeOut',
      });
    }

    this.scene.time.delayedCall(2000, () => {
      this.mistEmitter?.stop();
    });

    this.currentWeather = 'clear';
    this.scene.events.emit('weatherChanged', { type: 'clear', intensity: 0 });
  }

  // ---------------------------------------------------------------------------
  // Humidity / dust motes
  // ---------------------------------------------------------------------------

  private createHumidityParticles(): void {
    this.humidityEmitter = this.scene.add.particles(0, 0, 'dust-mote', {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: 0, max: GAME_HEIGHT },
      quantity: 1,
      frequency: 200,
      speedX: { min: -10, max: 10 },
      speedY: { min: -20, max: 5 },
      scale: { min: 0.5, max: 1.5 },
      alpha: { start: 0, end: 0.4 },
      tint: WEATHER_COLORS.humidity,
      lifespan: 6000,
      blendMode: 'ADD',
    });
    this.humidityEmitter.setDepth(800);
    this.updateHumidityParticles();
  }

  private updateHumidityParticles(): void {
    if (!this.humidityEmitter) return;

    switch (this.currentTimeOfDay) {
      case 'dusk':
        this.humidityEmitter.setFrequency(100);
        this.humidityEmitter.setQuantity(2);
        break;
      case 'day':
        this.humidityEmitter.setFrequency(300);
        this.humidityEmitter.setQuantity(1);
        break;
      case 'dawn':
      case 'night':
      default:
        this.humidityEmitter.setFrequency(500);
        this.humidityEmitter.setQuantity(1);
        this.humidityEmitter.setParticleTint(0x9acd32); // firefly green
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Heat shimmer / heatwave
  // ---------------------------------------------------------------------------

  private createHeatShimmer(): void {
    this.heatShimmerOverlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0xffffff, 0,
    );
    this.heatShimmerOverlay.setDepth(850);
    this.heatShimmerOverlay.setBlendMode('ADD');

    this.shimmerLines = [];
    for (let i = 0; i < 5; i++) {
      const line = this.scene.add.rectangle(
        GAME_WIDTH / 2,
        100 + i * 80,
        GAME_WIDTH, 3,
        0xffffff, 0,
      );
      line.setDepth(851);
      line.setBlendMode('ADD');
      this.shimmerLines.push(line);
    }
  }

  private startHeatwave(intensity = 0.5): void {
    this.currentWeather = 'heatwave';
    this.weatherIntensity = intensity;

    this.shimmerLines.forEach((line, index) => {
      this.scene.tweens.add({
        targets: line,
        alpha: 0.05 * intensity,
        y: line.y + 10,
        duration: 2000 + index * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    if (this.heatShimmerOverlay) {
      this.scene.tweens.add({
        targets: this.heatShimmerOverlay,
        alpha: 0.03 * intensity,
        duration: 1000,
      });
    }

    this.scene.events.emit('weatherChanged', { type: 'heatwave', intensity });
  }

  private stopHeatwave(): void {
    this.shimmerLines.forEach((line) => {
      this.scene.tweens.killTweensOf(line);
      line.setAlpha(0);
    });

    if (this.heatShimmerOverlay) {
      this.scene.tweens.add({
        targets: this.heatShimmerOverlay,
        alpha: 0,
        duration: 2000,
      });
    }

    this.currentWeather = 'clear';
    this.scene.events.emit('weatherChanged', { type: 'clear', intensity: 0 });
  }

  // ---------------------------------------------------------------------------
  // Rain overlay (darkening)
  // ---------------------------------------------------------------------------

  private createRainOverlay(): void {
    this.rainOverlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      WEATHER_COLORS.rainOverlay, 0,
    );
    this.rainOverlay.setDepth(899);
    this.rainOverlay.setBlendMode('MULTIPLY');
  }

  // ---------------------------------------------------------------------------
  // Weather scheduling
  // ---------------------------------------------------------------------------

  private scheduleWeatherChange(): void {
    const delay = Phaser.Math.Between(this.minWeatherDuration, this.maxWeatherDuration);

    this.weatherTimer = this.scene.time.delayedCall(delay, () => {
      this.randomWeatherEvent();
      this.scheduleWeatherChange();
    });
  }

  private randomWeatherEvent(): void {
    const chances = LOCATION_WEATHER_CHANCES[this.currentLocation] ?? {};

    let rainChance = chances.rain ?? 0.1;
    let mistChance = chances.mist ?? 0.05;
    let heatwaveChance = chances.heatwave ?? 0.1;

    // Modify by time
    switch (this.currentTimeOfDay) {
      case 'dawn':
        mistChance *= 2;
        heatwaveChance = 0;
        break;
      case 'day':
        heatwaveChance *= 1.5;
        mistChance = 0;
        break;
      case 'night':
        rainChance *= 0.5;
        mistChance = 0;
        heatwaveChance = 0;
        break;
    }

    const roll = Math.random();

    if (this.currentWeather !== 'clear') {
      if (roll < 0.4) {
        this.clearWeather();
      }
    } else {
      if (roll < rainChance) {
        this.startRain(Phaser.Math.FloatBetween(0.3, 0.8));
      } else if (roll < rainChance + mistChance) {
        this.startMist(Phaser.Math.FloatBetween(0.3, 0.7));
      } else if (roll < rainChance + mistChance + heatwaveChance) {
        this.startHeatwave(Phaser.Math.FloatBetween(0.4, 0.8));
      }
    }
  }

  /** Clear whatever weather is active. */
  private clearWeather(): void {
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

  /** Force a specific weather type (for scripted events). */
  setWeather(type: WeatherType, intensity = 0.5): void {
    this.clearWeather();
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
          break;
      }
    });
  }

  /** Per-frame update. */
  update(_time: number, _delta: number): void {
    // Particle emitters follow the camera for full-screen coverage
    const cam = this.scene.cameras.main;
    if (!cam) return;

    if (this.humidityEmitter) {
      this.humidityEmitter.setPosition(cam.scrollX, cam.scrollY);
    }
    if (this.rainEmitter) {
      this.rainEmitter.setPosition(cam.scrollX, cam.scrollY);
    }
  }

  /** Clean up all resources. */
  destroy(): void {
    if (this.weatherTimer) {
      this.weatherTimer.destroy();
      this.weatherTimer = null;
    }
    this.rainEmitter?.destroy();
    this.rainEmitter = null;
    this.mistEmitter?.destroy();
    this.mistEmitter = null;
    this.humidityEmitter?.destroy();
    this.humidityEmitter = null;
    this.splashEmitter?.destroy();
    this.splashEmitter = null;

    if (this.heatShimmerOverlay) {
      this.heatShimmerOverlay.destroy();
      this.heatShimmerOverlay = null;
    }
    this.shimmerLines.forEach((line) => line.destroy());
    this.shimmerLines = [];
    if (this.rainOverlay) {
      this.rainOverlay.destroy();
      this.rainOverlay = null;
    }
  }
}
