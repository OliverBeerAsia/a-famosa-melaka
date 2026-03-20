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
 * Ported from archived JS version with TypeScript types and 960x540 coordinates.
 */

import Phaser from 'phaser';
import { CHARACTER_SCALE, GAME_WIDTH, GAME_HEIGHT } from '../game';
import type { ResolvedVisualQuality } from '../visualProfile';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

interface CrowdTypeConfig {
  spriteKey: string;
  speed: number;
  locations: string[];
}

interface PathConfig {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface LocationCrowdConfig {
  maxCrowd: number;
  density: number;
  paths: PathConfig[];
  crowdTypes: string[];
}

interface CrowdMember {
  id: string;
  type: string;
  sprite: Phaser.GameObjects.Image;
  path: PathConfig;
  speed: number;
  active: boolean;
}

/** Map crowd type names to sprite texture keys */
function getSpriteKey(typeName: string): string {
  switch (typeName) {
    case 'portuguese_merchant':
      return 'crowd-portuguese';
    case 'portuguese_soldier':
      return 'crowd-portuguese-guard';
    case 'dock_worker':
      return 'crowd-portuguese-worker';
    case 'priest':
      return 'crowd-portuguese-priest';
    case 'malay_local':
      return 'crowd-malay';
    case 'malay_woman':
      return 'crowd-malay-woman';
    case 'child':
      return 'crowd-malay-child';
    case 'chinese_merchant':
      return 'crowd-chinese';
    case 'arab_trader':
      return 'crowd-arab';
    case 'indian_merchant':
      return 'crowd-indian';
    default:
      return 'crowd-portuguese';
  }
}

/** All coordinates below are already in 960x540 space (original 320x180 values * 3). */
const CROWD_TYPES: Record<string, CrowdTypeConfig> = {
  portuguese_merchant: {
    spriteKey: 'crowd-portuguese',
    speed: 90,   // 30 * 3
    locations: ['rua-direita', 'waterfront', 'a-famosa-gate'],
  },
  portuguese_soldier: {
    spriteKey: 'crowd-portuguese-guard',
    speed: 105,  // 35 * 3
    locations: ['a-famosa-gate', 'rua-direita'],
  },
  malay_local: {
    spriteKey: 'crowd-malay',
    speed: 84,   // 28 * 3
    locations: ['rua-direita', 'kampung', 'waterfront'],
  },
  malay_woman: {
    spriteKey: 'crowd-malay-woman',
    speed: 75,   // 25 * 3
    locations: ['rua-direita', 'kampung'],
  },
  chinese_merchant: {
    spriteKey: 'crowd-chinese',
    speed: 84,
    locations: ['waterfront', 'rua-direita'],
  },
  arab_trader: {
    spriteKey: 'crowd-arab',
    speed: 90,
    locations: ['waterfront', 'rua-direita'],
  },
  indian_merchant: {
    spriteKey: 'crowd-indian',
    speed: 84,
    locations: ['rua-direita', 'waterfront'],
  },
  dock_worker: {
    spriteKey: 'crowd-portuguese-worker',
    speed: 105,
    locations: ['waterfront'],
  },
  priest: {
    spriteKey: 'crowd-portuguese-priest',
    speed: 60,   // 20 * 3
    locations: ['st-pauls-church', 'rua-direita'],
  },
  child: {
    spriteKey: 'crowd-malay-child',
    speed: 135,  // 45 * 3
    locations: ['kampung', 'rua-direita'],
  },
};

/** Location configs with paths scaled to 960x540 (original * 3). */
const LOCATION_CONFIGS: Record<string, LocationCrowdConfig> = {
  'rua-direita': {
    maxCrowd: 12,
    density: 1.0,
    paths: [
      { start: { x: -60, y: 600 }, end: { x: 1980, y: 600 } },
      { start: { x: 1980, y: 750 }, end: { x: -60, y: 750 } },
      { start: { x: 900, y: -60 }, end: { x: 900, y: 1500 } },
      { start: { x: 450, y: 450 }, end: { x: 1500, y: 900 } },
    ],
    crowdTypes: [
      'portuguese_merchant', 'malay_local', 'malay_woman',
      'chinese_merchant', 'arab_trader', 'indian_merchant', 'child',
    ],
  },
  waterfront: {
    maxCrowd: 10,
    density: 0.8,
    paths: [
      { start: { x: -60, y: 840 }, end: { x: 1980, y: 840 } },
      { start: { x: 1980, y: 960 }, end: { x: -60, y: 960 } },
      { start: { x: 600, y: 1200 }, end: { x: 1200, y: 450 } },
    ],
    crowdTypes: [
      'dock_worker', 'chinese_merchant', 'arab_trader',
      'portuguese_merchant', 'malay_local',
    ],
  },
  'a-famosa-gate': {
    maxCrowd: 6,
    density: 0.5,
    paths: [
      { start: { x: -60, y: 900 }, end: { x: 1980, y: 900 } },
      { start: { x: 900, y: 1200 }, end: { x: 900, y: 300 } },
    ],
    crowdTypes: ['portuguese_soldier', 'portuguese_merchant', 'malay_local'],
  },
  'st-pauls-church': {
    maxCrowd: 4,
    density: 0.3,
    paths: [
      { start: { x: 900, y: 1200 }, end: { x: 900, y: 450 } },
      { start: { x: 450, y: 750 }, end: { x: 1350, y: 750 } },
    ],
    crowdTypes: ['priest', 'portuguese_merchant', 'malay_local'],
  },
  kampung: {
    maxCrowd: 8,
    density: 0.7,
    paths: [
      { start: { x: -60, y: 750 }, end: { x: 1980, y: 750 } },
      { start: { x: 600, y: 450 }, end: { x: 1200, y: 1050 } },
      { start: { x: 1200, y: 450 }, end: { x: 600, y: 1050 } },
    ],
    crowdTypes: ['malay_local', 'malay_woman', 'child'],
  },
};

/** Time-of-day density multipliers (4-value system matching GameScene). */
const TIME_DENSITY: Record<TimeOfDay, number> = {
  dawn: 0.3,
  day: 1.0,
  dusk: 0.6,
  night: 0.2,
};

/** Maximum crowd size caps per visual quality tier. */
function getMaxCrowdCap(quality: ResolvedVisualQuality): number {
  switch (quality) {
    case 'low':
      return 5;
    case 'balanced':
      return 10;
    case 'high':
      return 15;
    default:
      return 10;
  }
}

export class CrowdSystem {
  private scene: Phaser.Scene;
  private quality: ResolvedVisualQuality;
  private crowdMembers: CrowdMember[] = [];
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private baseSpawnRate = 3000;
  private currentLocation: string | null = null;
  private currentTimeOfDay: TimeOfDay = 'day';
  private paused = false;

  constructor(scene: Phaser.Scene, quality: ResolvedVisualQuality) {
    this.scene = scene;
    this.quality = quality;
  }

  /** Initialize crowd system for a given location. */
  initialize(locationId: string): void {
    this.currentLocation = locationId;
    this.startSpawning();

    // Listen for weather events from WeatherSystem
    this.scene.events.on('weatherChanged', this.onWeatherChanged, this);
  }

  /** Change the current location, clearing and respawning crowd. */
  setLocation(locationId: string): void {
    this.clearAllCrowd();
    this.currentLocation = locationId;
    this.paused = false;
    this.startSpawning();
  }

  /** Update time-of-day density factor. */
  setTimeOfDay(time: TimeOfDay): void {
    this.currentTimeOfDay = time;

    // Cull crowd if density dropped
    const config = this.currentLocation ? LOCATION_CONFIGS[this.currentLocation] : null;
    if (!config) return;

    const effectiveMax = this.getEffectiveMax(config);

    while (this.crowdMembers.length > effectiveMax) {
      const oldest = this.crowdMembers.shift();
      if (oldest) {
        this.scene.tweens.add({
          targets: oldest.sprite,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            this.removeCrowdMember(oldest);
          },
        });
      }
    }
  }

  /** Start the spawn timer for the current location. */
  private startSpawning(): void {
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
      this.spawnTimer = null;
    }

    const config = this.currentLocation ? LOCATION_CONFIGS[this.currentLocation] : null;
    if (!config) return;

    const spawnRate = this.baseSpawnRate / config.density;

    this.spawnTimer = this.scene.time.addEvent({
      delay: spawnRate,
      callback: this.trySpawnCrowdMember,
      callbackScope: this,
      loop: true,
    });

    // Initial population burst
    const initialCount = Math.floor(config.maxCrowd * 0.5);
    for (let i = 0; i < initialCount; i++) {
      this.scene.time.delayedCall(i * 200, () => {
        this.trySpawnCrowdMember();
      });
    }
  }

  /** Compute effective max considering quality cap and time density. */
  private getEffectiveMax(config: LocationCrowdConfig): number {
    const qualityCap = getMaxCrowdCap(this.quality);
    const timeMultiplier = TIME_DENSITY[this.currentTimeOfDay] ?? 1.0;
    const locationMax = Math.min(config.maxCrowd, qualityCap);
    return Math.floor(locationMax * timeMultiplier);
  }

  /** Attempt to spawn a new crowd member. */
  private trySpawnCrowdMember(): void {
    if (this.paused) return;

    const config = this.currentLocation ? LOCATION_CONFIGS[this.currentLocation] : null;
    if (!config) return;

    const effectiveMax = this.getEffectiveMax(config);
    if (this.crowdMembers.length >= effectiveMax) return;

    const typeName = Phaser.Utils.Array.GetRandom(config.crowdTypes) as string;
    const typeConfig = CROWD_TYPES[typeName];
    if (!typeConfig) return;

    const path = Phaser.Utils.Array.GetRandom(config.paths) as PathConfig;
    this.spawnCrowdMember(typeName, typeConfig, path);
  }

  /** Spawn a single crowd member sprite along a path. */
  private spawnCrowdMember(typeName: string, typeConfig: CrowdTypeConfig, path: PathConfig): void {
    const spriteKey = getSpriteKey(typeName);

    // Check if texture exists, fall back to 'particle' if not
    const textureKey = this.scene.textures.exists(spriteKey) ? spriteKey : 'particle';
    const sprite = this.scene.add.image(path.start.x, path.start.y, textureKey);

    sprite.setScale(CHARACTER_SCALE);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(sprite.y); // depth sort by Y
    sprite.setAlpha(0.7);

    // Speed variation
    const speedVariation = Phaser.Math.FloatBetween(0.8, 1.2);
    const actualSpeed = typeConfig.speed * speedVariation;

    // Calculate travel time
    const distance = Phaser.Math.Distance.Between(
      path.start.x, path.start.y,
      path.end.x, path.end.y,
    );
    const duration = (distance / actualSpeed) * 1000;

    const crowdMember: CrowdMember = {
      id: `crowd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: typeName,
      sprite,
      path,
      speed: actualSpeed,
      active: true,
    };

    // Movement tween
    this.scene.tweens.add({
      targets: sprite,
      x: path.end.x,
      y: path.end.y,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        // Keep depth sorted by Y position as it moves
        sprite.setDepth(sprite.y);
      },
      onComplete: () => {
        this.removeCrowdMember(crowdMember);
      },
    });

    // Walking bobbing animation
    this.scene.tweens.add({
      targets: sprite,
      scaleY: CHARACTER_SCALE * 0.95,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.crowdMembers.push(crowdMember);
  }

  /** Remove a crowd member and destroy its sprite. */
  private removeCrowdMember(crowdMember: CrowdMember): void {
    const index = this.crowdMembers.findIndex((c) => c.id === crowdMember.id);
    if (index !== -1) {
      this.scene.tweens.killTweensOf(crowdMember.sprite);
      crowdMember.sprite.destroy();
      this.crowdMembers.splice(index, 1);
    }
  }

  /** Handle weather change events. */
  private onWeatherChanged(data: { type: string; intensity: number }): void {
    if (data.type === 'rain') {
      // Rain: crowd seeks shelter
      this.paused = true;

      this.crowdMembers.forEach((member) => {
        this.scene.tweens.killTweensOf(member.sprite);

        const exitX = member.sprite.x < GAME_WIDTH / 2 ? -150 : GAME_WIDTH + 150;
        const dist = Math.abs(exitX - member.sprite.x);

        this.scene.tweens.add({
          targets: member.sprite,
          x: exitX,
          duration: dist * 10,
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.removeCrowdMember(member);
          },
        });
      });
    } else if (data.type === 'clear' && this.paused) {
      this.paused = false;
      this.scene.time.delayedCall(5000, () => {
        this.startSpawning();
      });
    }
  }

  /** Clear all crowd members immediately. */
  private clearAllCrowd(): void {
    this.crowdMembers.forEach((member) => {
      this.scene.tweens.killTweensOf(member.sprite);
      member.sprite.destroy();
    });
    this.crowdMembers = [];
  }

  /** Pause crowd spawning (for cutscenes etc.). */
  pause(): void {
    this.paused = true;
    if (this.spawnTimer) {
      this.spawnTimer.paused = true;
    }
  }

  /** Resume crowd spawning. */
  resume(): void {
    this.paused = false;
    if (this.spawnTimer) {
      this.spawnTimer.paused = false;
    }
  }

  /** Get the current crowd count. */
  getCrowdCount(): number {
    return this.crowdMembers.length;
  }

  /** Per-frame update (reserved for future crowd AI). */
  update(_time: number, _delta: number): void {
    // Could add: avoid player, crowd stopping to chat, reacting to events
  }

  /** Clean up all resources. */
  destroy(): void {
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
      this.spawnTimer = null;
    }

    this.clearAllCrowd();

    this.scene.events.off('weatherChanged', this.onWeatherChanged, this);
  }
}
