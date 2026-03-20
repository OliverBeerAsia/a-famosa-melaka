/**
 * Environment Object System
 *
 * Renders decorative object clusters from environment-objects.json to enrich
 * each location with market stalls, barrels, palm trees, cultural artifacts,
 * and other atmosphere objects. Also handles animated objects (torches, flags,
 * smoke, seagulls) and attaches particle emitters where specified.
 *
 * Respects the visual quality tier: 'low' skips decorative objects entirely.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '../game';
import type { ResolvedVisualQuality } from '../visualProfile';
import environmentData from '../../data/environment-objects.json';

interface ObjectDef {
  sprite: string;
  offsetX: number;
  offsetY: number;
  examineText?: string;
  particles?: 'smoke' | 'steam' | 'dust';
}

interface ClusterDef {
  id: string;
  centerTile: { x: number; y: number };
  objects: ObjectDef[];
}

interface LocationDef {
  clusters: ClusterDef[];
}

interface PlacedObject {
  image: Phaser.GameObjects.Image;
  examineText?: string;
  clusterId: string;
}

interface AnimatedPlacement {
  sprite: Phaser.GameObjects.Sprite;
  type: string;
}

// Animated object definitions per location
const ANIMATED_OBJECTS: Record<string, Array<{
  type: 'torch' | 'palm-sway' | 'awning-flutter' | 'smoke' | 'seagull' | 'flag';
  x: number;
  y: number;
}>> = {
  'a-famosa-gate': [
    { type: 'torch', x: 300, y: 300 },
    { type: 'torch', x: 680, y: 310 },
    { type: 'flag', x: 480, y: 120 },
  ],
  'rua-direita': [
    { type: 'torch', x: 360, y: 450 },
    { type: 'awning-flutter', x: 400, y: 280 },
    { type: 'awning-flutter', x: 700, y: 260 },
    { type: 'smoke', x: 820, y: 200 },
  ],
  'st-pauls-church': [
    { type: 'torch', x: 480, y: 240 },
    { type: 'palm-sway', x: 200, y: 400 },
    { type: 'palm-sway', x: 750, y: 380 },
  ],
  'waterfront': [
    { type: 'seagull', x: 300, y: 100 },
    { type: 'seagull', x: 600, y: 80 },
    { type: 'seagull', x: 850, y: 120 },
    { type: 'flag', x: 720, y: 160 },
  ],
  'kampung': [
    { type: 'smoke', x: 500, y: 380 },
    { type: 'smoke', x: 650, y: 400 },
    { type: 'palm-sway', x: 100, y: 350 },
    { type: 'palm-sway', x: 800, y: 320 },
  ],
};

export class EnvironmentObjectSystem {
  private scene: Phaser.Scene;
  private quality: ResolvedVisualQuality;
  private placedObjects: PlacedObject[] = [];
  private animatedPlacements: AnimatedPlacement[] = [];
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private currentLocation: string = '';

  constructor(scene: Phaser.Scene, quality: ResolvedVisualQuality) {
    this.scene = scene;
    this.quality = quality;
  }

  /**
   * Initialize environment objects for a location.
   * Call this after the scene background is loaded.
   */
  initialize(locationId: string): void {
    this.currentLocation = locationId;

    // Low quality: skip all decorative objects for performance
    if (this.quality === 'low') return;

    this.placeStaticObjects(locationId);
    this.placeAnimatedObjects(locationId);
  }

  /**
   * Place static decorative objects from the data file.
   */
  private placeStaticObjects(locationId: string): void {
    const locations = (environmentData as { locations: Record<string, LocationDef> }).locations;
    const locationDef = locations[locationId];
    if (!locationDef) return;

    for (const cluster of locationDef.clusters) {
      // Convert tile coordinates to world position (960x540 space)
      const baseX = cluster.centerTile.x * ISO_TILE_WIDTH;
      const baseY = cluster.centerTile.y * ISO_TILE_HEIGHT;

      for (const objDef of cluster.objects) {
        const worldX = baseX + objDef.offsetX;
        const worldY = baseY + objDef.offsetY;

        // Check if the sprite texture exists before creating
        if (!this.scene.textures.exists(objDef.sprite)) {
          // Try with common alternative names
          const altKey = objDef.sprite.replace(/-/g, '_');
          if (!this.scene.textures.exists(altKey)) {
            continue; // Skip objects whose sprites haven't been loaded
          }
        }

        const image = this.scene.add.image(worldX, worldY, objDef.sprite);
        image.setOrigin(0.5, 1); // Bottom-center anchor for depth sorting
        image.setDepth(worldY); // Y-sort depth

        // Scale if needed (sprites are 16px native, displayed at scene scale)
        // Objects are already at the right size for 960x540 if we use CHARACTER_SCALE
        image.setScale(3); // Match CHARACTER_SCALE

        const placed: PlacedObject = {
          image,
          examineText: objDef.examineText,
          clusterId: cluster.id,
        };

        // If object has examine text, make it interactive
        if (objDef.examineText) {
          image.setInteractive({ useHandCursor: true });
          image.on('pointerdown', () => {
            this.onExamineObject(placed);
          });
        }

        // Attach particle emitter if specified
        if (objDef.particles) {
          this.attachParticles(worldX, worldY, objDef.particles);
        }

        this.placedObjects.push(placed);
      }
    }
  }

  /**
   * Place animated objects (torches, flags, smoke, etc.)
   */
  private placeAnimatedObjects(locationId: string): void {
    const animDefs = ANIMATED_OBJECTS[locationId];
    if (!animDefs) return;

    // Only place animated objects on balanced/high quality
    const maxAnimated = this.quality === 'high' ? animDefs.length : Math.min(animDefs.length, 4);

    for (let i = 0; i < maxAnimated; i++) {
      const def = animDefs[i];

      switch (def.type) {
        case 'torch':
          this.createTorchEffect(def.x, def.y);
          break;
        case 'smoke':
          this.attachParticles(def.x, def.y, 'smoke');
          break;
        case 'seagull':
          this.createSeagullLoop(def.x, def.y);
          break;
        case 'flag':
          this.createFlagWave(def.x, def.y);
          break;
        case 'palm-sway':
          this.createPalmSway(def.x, def.y);
          break;
        case 'awning-flutter':
          this.createAwningFlutter(def.x, def.y);
          break;
      }
    }
  }

  /**
   * Create a flickering torch glow effect.
   */
  private createTorchEffect(x: number, y: number): void {
    // Create a simple pulsing glow circle
    const glow = this.scene.add.ellipse(x, y, 40, 40, 0xFFAA20, 0.15);
    glow.setDepth(y - 1);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    // Flicker tween
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.1, to: 0.25 },
      scaleX: { from: 0.9, to: 1.1 },
      scaleY: { from: 0.9, to: 1.1 },
      duration: 300 + Math.random() * 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Store for cleanup
    this.animatedPlacements.push({
      sprite: glow as unknown as Phaser.GameObjects.Sprite,
      type: 'torch',
    });
  }

  /**
   * Create a looping seagull path.
   */
  private createSeagullLoop(x: number, y: number): void {
    // Simple elliptical path using a small white dot
    const bird = this.scene.add.ellipse(x, y, 6, 3, 0xFFFFFF, 0.8);
    bird.setDepth(10000); // Always on top (sky)

    const rx = 120 + Math.random() * 80;
    const ry = 30 + Math.random() * 20;
    const duration = 8000 + Math.random() * 4000;
    const startAngle = Math.random() * Math.PI * 2;

    // Circular flight path
    this.scene.tweens.addCounter({
      from: 0,
      to: 360,
      duration,
      repeat: -1,
      onUpdate: (tween) => {
        const angle = Phaser.Math.DegToRad(tween.getValue() ?? 0) + startAngle;
        bird.x = x + Math.cos(angle) * rx;
        bird.y = y + Math.sin(angle) * ry;
      },
    });

    this.animatedPlacements.push({
      sprite: bird as unknown as Phaser.GameObjects.Sprite,
      type: 'seagull',
    });
  }

  /**
   * Create a flag wave effect.
   */
  private createFlagWave(x: number, y: number): void {
    // Use a small colored rectangle to represent a waving flag
    const flag = this.scene.add.rectangle(x, y, 24, 16, 0xCC2020, 0.9);
    flag.setDepth(y - 10);

    this.scene.tweens.add({
      targets: flag,
      scaleX: { from: 0.85, to: 1.15 },
      angle: { from: -3, to: 3 },
      duration: 600 + Math.random() * 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.animatedPlacements.push({
      sprite: flag as unknown as Phaser.GameObjects.Sprite,
      type: 'flag',
    });
  }

  /**
   * Create a palm tree sway effect.
   */
  private createPalmSway(x: number, y: number): void {
    // Subtle rotation on palm tree tops
    if (!this.scene.textures.exists('palm-tree')) return;

    const palm = this.scene.add.image(x, y, 'palm-tree');
    palm.setOrigin(0.5, 1);
    palm.setScale(3);
    palm.setDepth(y);

    this.scene.tweens.add({
      targets: palm,
      angle: { from: -2, to: 2 },
      duration: 2000 + Math.random() * 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.animatedPlacements.push({
      sprite: palm as unknown as Phaser.GameObjects.Sprite,
      type: 'palm-sway',
    });
  }

  /**
   * Create awning flutter effect.
   */
  private createAwningFlutter(x: number, y: number): void {
    if (!this.scene.textures.exists('awning')) return;

    const awning = this.scene.add.image(x, y, 'awning');
    awning.setOrigin(0.5, 0);
    awning.setScale(3);
    awning.setDepth(y - 20);

    this.scene.tweens.add({
      targets: awning,
      scaleY: { from: 2.9, to: 3.1 },
      duration: 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.animatedPlacements.push({
      sprite: awning as unknown as Phaser.GameObjects.Sprite,
      type: 'awning-flutter',
    });
  }

  /**
   * Attach particle emitter for smoke, steam, or dust effects.
   */
  private attachParticles(x: number, y: number, type: 'smoke' | 'steam' | 'dust'): void {
    // Create a 2x2 white pixel texture for particles if not already created
    const texKey = '__env_particle';
    if (!this.scene.textures.exists(texKey)) {
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0xFFFFFF);
      gfx.fillRect(0, 0, 2, 2);
      gfx.generateTexture(texKey, 2, 2);
      gfx.destroy();
    }

    let config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

    switch (type) {
      case 'smoke':
        config = {
          x,
          y: y - 8,
          speed: { min: 5, max: 15 },
          angle: { min: 250, max: 290 },
          scale: { start: 1.5, end: 3 },
          alpha: { start: 0.25, end: 0 },
          tint: 0x888888,
          lifespan: 3000,
          frequency: 500,
          quantity: 1,
        };
        break;
      case 'steam':
        config = {
          x,
          y: y - 4,
          speed: { min: 8, max: 20 },
          angle: { min: 255, max: 285 },
          scale: { start: 1, end: 2.5 },
          alpha: { start: 0.2, end: 0 },
          tint: 0xCCCCCC,
          lifespan: 2000,
          frequency: 400,
          quantity: 1,
        };
        break;
      case 'dust':
        config = {
          x,
          y,
          speed: { min: 3, max: 10 },
          angle: { min: 180, max: 360 },
          scale: { start: 1, end: 0.5 },
          alpha: { start: 0.15, end: 0 },
          tint: 0xAA9977,
          lifespan: 4000,
          frequency: 1000,
          quantity: 1,
        };
        break;
    }

    const emitter = this.scene.add.particles(0, 0, texKey, config);
    emitter.setDepth(y + 10);
    this.particleEmitters.push(emitter);
  }

  /**
   * Handle examining a decorative object.
   */
  private onExamineObject(obj: PlacedObject): void {
    if (!obj.examineText) return;

    // Emit an event that the React UI layer can pick up
    const { emitGameEvent } = require('../eventBridge');
    emitGameEvent('examine', {
      type: 'environment-object',
      text: obj.examineText,
    });
  }

  /**
   * Update loop — called from GameScene.update().
   * Handles depth sorting for objects near the player.
   */
  update(_time: number, _delta: number): void {
    // Re-sort object depths based on Y position (for proper layering with player)
    for (const obj of this.placedObjects) {
      if (obj.image.active) {
        obj.image.setDepth(obj.image.y);
      }
    }
  }

  /**
   * Set visibility based on time of day.
   * Some objects (like cooking fires) are more visible at night.
   */
  setTimeOfDay(time: 'dawn' | 'day' | 'dusk' | 'night'): void {
    // Torch effects: visible at dusk/night, hidden during day/dawn
    const showTorches = time === 'dusk' || time === 'night';
    for (const anim of this.animatedPlacements) {
      if (anim.type === 'torch') {
        anim.sprite.setVisible(showTorches);
      }
    }
  }

  /**
   * Clean up all objects and emitters.
   */
  destroy(): void {
    for (const obj of this.placedObjects) {
      obj.image.destroy();
    }
    this.placedObjects = [];

    for (const anim of this.animatedPlacements) {
      anim.sprite.destroy();
    }
    this.animatedPlacements = [];

    for (const emitter of this.particleEmitters) {
      emitter.destroy();
    }
    this.particleEmitters = [];

    // Clean up tweens targeting our objects
    this.scene.tweens.killAll();
  }
}
