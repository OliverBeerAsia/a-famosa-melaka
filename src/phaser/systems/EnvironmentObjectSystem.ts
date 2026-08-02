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
import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '../game';
import type { ResolvedVisualQuality } from '../visualProfile';
import environmentData from '../../data/environment-objects.json';
import { emitGameEvent } from '../eventBridge';
import { worldDepth, DEPTH_FX_SEAGULL } from '../core/depth';
import { goldenFraction, hash2, phaseFor } from '../core/phase';
import { getLocationAnimatedProps, getLocationProps } from '../core/LocationData';

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
  /** Iso-grid clusters. Only used when a location runs in isometric mode —
   *  the shipping legacy-backdrop layout lives in <id>.location.json props. */
  clusters: ClusterDef[];
}

interface PlacedObject {
  image: Phaser.GameObjects.Image;
  examineText?: string;
  clusterId: string;
  /** Human-readable name shown as the examine message title. */
  label: string;
}

/** 'spice-pile' -> 'Spice Pile' — a readable title for the examine overlay. */
function labelFromSprite(sprite: string): string {
  return sprite
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface AnimatedPlacement {
  sprite: Phaser.GameObjects.Sprite;
  type: string;
  /** Resting animation rate, restored after a pass-by sway. */
  baseTimeScale: number;
  /** Resting vertical scale, the amplitude channel on the tween fallback. */
  baseScaleY: number;
}

/**
 * Base loop lengths for the phase spreader (game-feel spec §2.4). Each
 * instance gets `offset = period * frac(i * GOLDEN)` and its own period
 * jittered +/-12 % from a position hash, so same-type props never flap in
 * lockstep and never re-converge.
 */
const ANIM_PERIOD_MS: Record<string, number> = {
  'awning-flutter': 1100,
  'palm-sway': 2200,
  smoke: 1700,
  seagull: 900,
  torch: 900,
  flag: 1200,
};

/**
 * The single active instance, so `SurfaceResponseSystem` can retime awnings on
 * a pass-by without `WorldObjectSystem` (which owns this system) having to
 * grow a pass-through getter for it. One GameScene is alive at a time, and the
 * reference is cleared in `destroy()`.
 */
let activeEnvironment: EnvironmentObjectSystem | null = null;

/** Props the surface-response layer may retime. Empty before the scene builds. */
export function activeSwayableProps(): Array<{
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  type: string;
  baseTimeScale: number;
  baseScaleY: number;
}> {
  return activeEnvironment?.swayableProps() ?? [];
}


export class EnvironmentObjectSystem {
  private scene: Phaser.Scene;
  private quality: ResolvedVisualQuality;
  private placedObjects: PlacedObject[] = [];
  private animatedPlacements: AnimatedPlacement[] = [];
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private managedTweens: Phaser.Tweens.Tween[] = [];
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
    activeEnvironment = this;

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
    const isIsoMode = (this.scene as any).isIsometric;

    // Legacy painted-plate: the curated pixel-positioned prop list in
    // <id>.location.json is the authoritative layout, so SKIP the iso-grid
    // clusters (which mis-place/oversize/duplicate on a fixed 960x540 plate).
    // ONLY use props if we are NOT in isometric mode.
    const legacyProps = getLocationProps(locationId);
    if (!isIsoMode && legacyProps.length > 0) {
      for (const p of legacyProps) {
        if (!this.scene.textures.exists(p.sprite)) continue;
        const image = this.scene.add.image(p.x, p.y, p.sprite);
        image.setOrigin(0.5, 1);
        image.setDepth(worldDepth(p.y));
        image.setScale(p.scale ?? 2);
        const placed: PlacedObject = {
          image,
          examineText: p.examineText,
          clusterId: 'legacy',
          label: labelFromSprite(p.sprite),
        };
        if (p.examineText) {
          image.setInteractive({ useHandCursor: true });
          image.on('pointerdown', () => this.onExamineObject(placed));
        }
        if (p.particles) this.attachParticles(p.x, p.y, p.particles);
        this.placedObjects.push(placed);
      }
      return;
    }

    if (!locationDef) return;

    for (const cluster of locationDef.clusters) {
      // Convert tile coordinates to world position
      let baseX: number;
      let baseY: number;
      const isoRenderer = (this.scene as any).isoRenderer;

      if (isIsoMode && isoRenderer) {
        // Use true isometric tilemap conversion
        const worldPos = isoRenderer.tileToWorld(cluster.centerTile.x, cluster.centerTile.y);
        baseX = worldPos.x;
        baseY = worldPos.y;
      } else {
        // Orthogonal grid calculation for legacy mode fallback (960x540 screen)
        baseX = cluster.centerTile.x * ISO_TILE_WIDTH;
        baseY = cluster.centerTile.y * ISO_TILE_HEIGHT;
      }

      for (const objDef of cluster.objects) {
        const worldX = baseX + objDef.offsetX;
        const worldY = baseY + objDef.offsetY;

        // Legacy painted-plate is a fixed 960x540 image. Iso-authored clusters
        // can compute positions off the plate (e.g. tileX 16 * 64 = 1024) — skip
        // those so props don't float off-screen / mis-place over the backdrop.
        // ONLY perform this off-screen check when NOT in isometric mode (which has a large scrollable world bounds).
        if (!isIsoMode && (worldX < 24 || worldX > 936 || worldY < 24 || worldY > 528)) {
          continue;
        }

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
        image.setDepth(worldDepth(worldY)); // Y-sort depth (clamped under FX band)

        // Props sit on the painted plate beside 3x characters. 2x keeps tall
        // props (shelving/stalls) from towering while staying readable; 3x
        // (tuned for the 64px iso tile world) made them oversized.
        image.setScale(2);

        const placed: PlacedObject = {
          image,
          examineText: objDef.examineText,
          clusterId: cluster.id,
          label: labelFromSprite(objDef.sprite),
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
    const animDefs = getLocationAnimatedProps(locationId);
    if (!animDefs) return;

    // Only place animated objects on balanced/high quality
    const maxAnimated = this.quality === 'high' ? animDefs.length : Math.min(animDefs.length, 4);

    // Instance index is counted PER TYPE, so the golden-ratio spread is
    // computed inside each family: six awnings spread across the awning loop
    // rather than across a mixed list where they would clump.
    const perType = new Map<string, number>();
    const nextIndex = (type: string): number => {
      const i = perType.get(type) ?? 0;
      perType.set(type, i + 1);
      return i;
    };

    for (let i = 0; i < maxAnimated; i++) {
      const def = animDefs[i];
      const index = nextIndex(def.type);

      switch (def.type) {
        case 'torch':
          this.createTorchEffect(def.x, def.y, index);
          break;
        case 'smoke':
          this.attachParticles(def.x, def.y, 'smoke', index);
          break;
        case 'seagull':
          this.createSeagullLoop(def.x, def.y, index);
          break;
        case 'flag':
          this.createFlagWave(def.x, def.y, index);
          break;
        case 'palm-sway':
          this.createPalmSway(def.x, def.y, index);
          break;
        case 'awning-flutter':
          this.createAwningFlutter(def.x, def.y, index);
          break;
      }
    }
  }

  /**
   * Start a sprite animation OUT OF PHASE with its siblings.
   *
   * This is the fix for the defect the v0.12 pass exists to kill: every
   * `sprite.play(key)` in this file used to start on frame 0 with no delay, so
   * Rua Direita's six awnings flapped in lockstep and its three palms swayed as
   * one object — benchmark item 9 failing 100 %.
   *
   *  - the START FRAME comes from the golden-ratio offset, so instance i opens
   *    on a different frame of the loop;
   *  - `timeScale` carries the +/-12 % position-seeded period jitter, so they
   *    also drift apart instead of re-converging after one cycle.
   *
   * Both are pure functions of (index, x, y): the scene looks identical on
   * every run, which is what makes the benchmark-9 gate testable at all.
   */
  private playPhased(
    sprite: Phaser.GameObjects.Sprite,
    animKey: string,
    type: string,
    index: number,
    x: number,
    y: number,
  ): number {
    const base = ANIM_PERIOD_MS[type] ?? 1200;
    const timing = phaseFor(index, base, x, y);
    const frac = goldenFraction(index);

    // The phase offset goes in through `play({ startFrame })`, which is the
    // ONE place Phaser applies it without fighting itself.
    //
    // Two approaches were measured and rejected first, both of which LOOK
    // right and silently do nothing:
    //   - `anims.setCurrentFrame(...)` after `play()`: `play()` has already
    //     armed the frame clock, so the swap is cosmetic and the instances
    //     re-converge inside one cycle (71-88 % lockstep for two palms);
    //   - `anims.setProgress(0.618)`: it resolves the frame with an EXACT
    //     match on the frame's own `progress` value, so any figure that is not
    //     already a frame boundary matches nothing and the call no-ops.
    const anim = this.scene.anims.get(animKey);
    const frameCount = anim?.frames.length ?? 1;
    const startFrame = frameCount > 1 ? Math.floor(frac * frameCount) % frameCount : 0;
    sprite.play({ key: animKey, startFrame });

    // The period jitter rides on `timeScale`, so instances that start apart
    // also drift apart instead of re-syncing on a shared tick grid.
    const timeScale = base / timing.periodMs;
    sprite.anims.timeScale = timeScale;
    return timeScale;
  }

  /** Awnings and other cloth the surface-response layer may retime. */
  swayableProps(): Array<{
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    type: string;
    baseTimeScale: number;
    baseScaleY: number;
  }> {
    return this.animatedPlacements;
  }

  /**
   * Create a flickering torch glow effect.
   */
  private createTorchEffect(x: number, y: number, index: number): void {
    if (this.scene.anims.exists('torch-flicker') && this.scene.textures.exists('torch-flame')) {
      const flame = this.scene.add.sprite(x, y, 'torch-flame');
      flame.setOrigin(0.5, 1);
      flame.setScale(3);
      flame.setDepth(worldDepth(y));
      const timeScale = this.playPhased(flame, 'torch-flicker', 'torch', index, x, y);
      this.animatedPlacements.push({
        sprite: flame,
        type: 'torch',
        baseTimeScale: timeScale,
        baseScaleY: flame.scaleY,
      });
    }

    // The torch PROP keeps its own sprite animation; the light pool's flicker
    // belongs to the light (see FlickerSystem), which is why this glow is a
    // small halo on the flame and not a lighting rig.
    const glow = this.scene.add.ellipse(x, y, 40, 40, 0xFFAA20, 0.15);
    glow.setDepth(worldDepth(y) - 1);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    const timing = phaseFor(index, ANIM_PERIOD_MS.torch, x, y);
    const tween = this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.1, to: 0.25 },
      scaleX: { from: 0.9, to: 1.1 },
      scaleY: { from: 0.9, to: 1.1 },
      duration: timing.periodMs / 2,
      delay: timing.offsetMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.managedTweens.push(tween);

    this.animatedPlacements.push({
      sprite: glow as unknown as Phaser.GameObjects.Sprite,
      type: 'torch',
      baseTimeScale: 1,
      baseScaleY: 1,
    });
  }

  /**
   * Create a looping seagull path.
   */
  private createSeagullLoop(x: number, y: number, index: number): void {
    const bird = this.scene.textures.exists('seagull')
      ? this.scene.add.sprite(x, y, 'seagull')
      : this.scene.add.ellipse(x, y, 6, 3, 0xFFFFFF, 0.8);
    bird.setDepth(DEPTH_FX_SEAGULL); // Sky layer — FX band, below the UI band (>= 1001)

    let birdTimeScale = 1;
    if (bird instanceof Phaser.GameObjects.Sprite && this.scene.anims.exists('seagull-fly')) {
      birdTimeScale = this.playPhased(bird, 'seagull-fly', 'seagull', index, x, y);
      bird.setScale(2.5);
    }

    // Deterministic per-instance variation, replacing four `Math.random()`
    // calls: the same gull always flies the same orbit, so a capture is
    // reproducible frame for frame.
    const h1 = hash2(x, y);
    const h2 = hash2(y, x);
    const rx = 120 + h1 * 80;
    const ry = 30 + h2 * 20;
    const duration = 8000 + hash2(x + 7, y + 13) * 4000;
    const startAngle = goldenFraction(index) * Math.PI * 2;

    const tween = this.scene.tweens.addCounter({
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
    this.managedTweens.push(tween);

    this.animatedPlacements.push({
      sprite: bird as unknown as Phaser.GameObjects.Sprite,
      type: 'seagull',
      baseTimeScale: birdTimeScale,
      baseScaleY: bird.scaleY,
    });
  }

  /**
   * Create a flag wave effect.
   *
   * Depth goes through `worldDepth` like everything else in the world. Raw y
   * was safe only while the world was exactly the 540px viewport; in a
   * 1080-tall scrolling world any prop below y=800 lands INSIDE the FX band and
   * draws over the fog and the colour grade (a-famosa's palm at y=909 did).
   */
  private createFlagWave(x: number, y: number, index: number): void {
    if (this.scene.textures.exists('flag-wave') && this.scene.anims.exists('flag-flutter')) {
      const flag = this.scene.add.sprite(x, y, 'flag-wave');
      flag.setOrigin(0.5, 1);
      flag.setScale(3);
      flag.setDepth(worldDepth(y - 10));
      const timeScale = this.playPhased(flag, 'flag-flutter', 'flag', index, x, y);
      this.animatedPlacements.push({
        sprite: flag,
        type: 'flag',
        baseTimeScale: timeScale,
        baseScaleY: flag.scaleY,
      });
      return;
    }

    const flag = this.scene.add.rectangle(x, y, 24, 16, 0xCC2020, 0.9);
    flag.setDepth(worldDepth(y - 10));

    const timing = phaseFor(index, ANIM_PERIOD_MS.flag, x, y);
    const tween = this.scene.tweens.add({
      targets: flag,
      scaleX: { from: 0.85, to: 1.15 },
      angle: { from: -3, to: 3 },
      duration: timing.periodMs / 2,
      delay: timing.offsetMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.managedTweens.push(tween);

    this.animatedPlacements.push({
      sprite: flag as unknown as Phaser.GameObjects.Sprite,
      type: 'flag',
      baseTimeScale: 1,
      baseScaleY: flag.scaleY,
    });
  }

  /**
   * Create a palm tree sway effect.
   */
  private createPalmSway(x: number, y: number, index: number): void {
    if (this.scene.textures.exists('palm-frond') && this.scene.anims.exists('palm-sway')) {
      const palm = this.scene.add.sprite(x, y, 'palm-frond');
      palm.setOrigin(0.5, 1);
      palm.setScale(3);
      palm.setDepth(worldDepth(y));
      const timeScale = this.playPhased(palm, 'palm-sway', 'palm-sway', index, x, y);

      this.animatedPlacements.push({
        sprite: palm,
        type: 'palm-sway',
        baseTimeScale: timeScale,
        baseScaleY: palm.scaleY,
      });
      return;
    }

    if (!this.scene.textures.exists('palm-tree')) return;

    const palm = this.scene.add.image(x, y, 'palm-tree');
    palm.setOrigin(0.5, 1);
    palm.setScale(3);
    palm.setDepth(worldDepth(y));

    const timing = phaseFor(index, ANIM_PERIOD_MS['palm-sway'], x, y);
    const tween = this.scene.tweens.add({
      targets: palm,
      angle: { from: -2, to: 2 },
      duration: timing.periodMs,
      delay: timing.offsetMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.managedTweens.push(tween);

    this.animatedPlacements.push({
      sprite: palm as unknown as Phaser.GameObjects.Sprite,
      type: 'palm-sway',
      baseTimeScale: 1,
      baseScaleY: palm.scaleY,
    });
  }

  /**
   * Create awning flutter effect.
   */
  private createAwningFlutter(x: number, y: number, index: number): void {
    if (this.scene.textures.exists('awning-flutter') && this.scene.anims.exists('awning-flutter-anim')) {
      const awning = this.scene.add.sprite(x, y, 'awning-flutter');
      awning.setOrigin(0.5, 0);
      awning.setScale(3);
      awning.setDepth(worldDepth(y - 20));
      const timeScale = this.playPhased(
        awning, 'awning-flutter-anim', 'awning-flutter', index, x, y,
      );

      this.animatedPlacements.push({
        sprite: awning,
        type: 'awning-flutter',
        baseTimeScale: timeScale,
        baseScaleY: awning.scaleY,
      });
      return;
    }

    if (!this.scene.textures.exists('awning')) return;

    const awning = this.scene.add.image(x, y, 'awning');
    awning.setOrigin(0.5, 0);
    awning.setScale(3);
    awning.setDepth(worldDepth(y - 20));

    const timing = phaseFor(index, ANIM_PERIOD_MS['awning-flutter'], x, y);
    const tween = this.scene.tweens.add({
      targets: awning,
      scaleY: { from: 2.9, to: 3.1 },
      duration: timing.periodMs,
      delay: timing.offsetMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.managedTweens.push(tween);

    this.animatedPlacements.push({
      sprite: awning as unknown as Phaser.GameObjects.Sprite,
      type: 'awning-flutter',
      baseTimeScale: 1,
      baseScaleY: awning.scaleY,
    });
  }

  /**
   * Attach particle emitter for smoke, steam, or dust effects.
   */
  private attachParticles(x: number, y: number, type: 'smoke' | 'steam' | 'dust', index: number = 0): void {
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
    emitter.setDepth(worldDepth(y + 10));
    // Three cooking fires that all puff on the same beat read as one machine.
    // Stagger the first emission by the golden-ratio offset and let each
    // column keep its own jittered interval.
    if (type === 'smoke') {
      const timing = phaseFor(index, ANIM_PERIOD_MS.smoke, x, y);
      emitter.setFrequency(Math.round(timing.periodMs / 3.4));
      emitter.stop();
      this.scene.time.delayedCall(timing.offsetMs, () => {
        if (emitter.active) emitter.start();
      });
    }
    this.particleEmitters.push(emitter);
  }

  /**
   * Handle examining a decorative object.
   */
  private onExamineObject(obj: PlacedObject): void {
    if (!obj.examineText) return;

    // Emit an event the React UI layer actually listens for. ('examine' was a
    // dead event name — nothing subscribed to it — and it was emitted through a
    // CommonJS require() that throws in this ESM/Vite module.)
    emitGameEvent('message:show', obj.label, obj.examineText);
    // ...and the feedback channel, so examining a prop is audible. Separate
    // from `item:examine`, which is a PICKABLE item.
    emitGameEvent('prop:examine', obj.label, obj.examineText);
  }

  /**
   * Update loop — called from GameScene.update().
   * Handles depth sorting for objects near the player.
   */
  update(_time: number, _delta: number): void {
    const player = (this.scene as any).player;
    
    // Re-sort object depths based on Y position (for proper layering with player)
    for (const obj of this.placedObjects) {
      if (obj.image.active) {
        obj.image.setDepth(worldDepth(obj.image.y));
        
        // Dynamic occlusion check for tall props in legacy-backdrop mode
        if (player) {
          const img = obj.image;
          const px = player.x;
          const py = player.y;
          const pw = img.displayWidth;
          const ph = img.displayHeight;
          
          // Only perform check for props tall enough to block character views
          if (ph > 40) {
            // Player's feet are at py + 48 (since origin is 0.5, 0.5 and height is 96 scaled)
            const feetY = py + 48;
            const isBehind = feetY < img.y + 6 && 
                             feetY > img.y - ph - 10 && 
                             px > img.x - pw/2 - 10 && 
                             px < img.x + pw/2 + 10;
            
            if (isBehind) {
              img.setAlpha(0.35);
            } else {
              img.setAlpha(1.0);
            }
          }
        }
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
    if (activeEnvironment === this) activeEnvironment = null;
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

    this.managedTweens.forEach((tween) => tween.remove());
    this.managedTweens = [];
  }
}
