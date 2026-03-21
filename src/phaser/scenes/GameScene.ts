/**
 * Game Scene - Main Gameplay
 *
 * Handles the game world, player, NPCs, and physics.
 * UI is managed by React - this scene emits events to the bridge.
 */

import Phaser from 'phaser';
import { eventBridge, emitGameEvent } from '../eventBridge';
import { useGameStore } from '../../stores/gameStore';
import { useDialogueStore } from '../../stores/dialogueStore';
import { useQuestStore } from '../../stores/questStore';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_SPEED, CHARACTER_SCALE, ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '../game';
import { IsometricRenderer } from '../systems/IsometricRenderer';
import { CrowdSystem } from '../systems/CrowdSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { EnvironmentObjectSystem } from '../systems/EnvironmentObjectSystem';
import locationScenesData from '../../data/location-scenes.json';
import objectiveMarkersData from '../../data/objective-markers.json';
import worldItemsData from '../../data/items.json';
import historicalObjectsData from '../../data/historical-objects.json';
import { getLocationName } from '../../data/locationNames';
import { getWorldItemsAtLocation } from '../../data/loader';
import { ITEM_DEFINITIONS } from '../../stores/inventoryStore';
import {
  LOCATION_VISUAL_PRESETS,
  VISUAL_PROFILES,
  type ResolvedVisualQuality,
  type VisualProfile,
  type VisualQualityMode,
  resolveVisualQualityMode,
} from '../visualProfile';

type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
type FootstepSurface = 'stone' | 'wood' | 'dirt';

interface SceneConfig {
  background: string;
  variants?: Partial<Record<Exclude<TimeOfDay, 'day'>, string>>;
  mapFile?: string;
  isoMapKey?: string;
  music?: string;
  nightMusic?: string;
  ambientSounds?: Array<string | AmbientLayerConfig>;
  nightAmbientSounds?: Array<string | AmbientLayerConfig>;
  footstepSurface?: FootstepSurface;
  projection?: ProjectionConfig;
  playerStart?: { x: number; y: number };
  npcPositions?: Record<string, { x: number; y: number }>;
  collisionRects?: Array<{ x: number; y: number; width: number; height: number }>;
  transitions?: TransitionConfig[];
}

interface TransitionConfig {
  targetLocation: string;
  label: string;
  triggerArea: { x: number; y: number; width: number; height: number };
  spawnAt?: { x: number; y: number };
}

interface AmbientLayerConfig {
  key: string;
  volume?: number;
}

interface ProjectionConfig {
  runtimeMode?: 'legacy-backdrop' | 'isometric-2:1';
  targetMode?: 'isometric-2:1';
  authoringBasis?: 'screen-space' | 'isometric-grid';
  tileWidth?: number;
  tileHeight?: number;
  anchor?: 'bottom-center';
  depthStrategy?: 'fixed-stage' | 'screen-y';
}

// Map location keys to scene background prefixes
const LOCATION_TO_SCENE: Record<string, string> = {
  'a-famosa-gate': 'a-famosa',
  'rua-direita': 'rua-direita',
  'st-pauls-church': 'st-pauls',
  'waterfront': 'waterfront',
  'kampung': 'kampung',
};

const DEFAULT_LOCATION_AUDIO: Record<string, {
  music: string;
  nightMusic: string;
  ambientSounds: AmbientLayerConfig[];
  nightAmbientSounds: AmbientLayerConfig[];
  footstepSurface: FootstepSurface;
}> = {
  'a-famosa-gate': {
    music: 'music-fortress',
    nightMusic: 'music-night',
    ambientSounds: [
      { key: 'base-tropical', volume: 0.32 },
      { key: 'fortress-ambience', volume: 0.5 },
      { key: 'distant-city', volume: 0.24 },
    ],
    nightAmbientSounds: [
      { key: 'fortress-ambience', volume: 0.35 },
      { key: 'distant-city', volume: 0.2 },
      { key: 'night-insects', volume: 0.24 },
    ],
    footstepSurface: 'stone',
  },
  'rua-direita': {
    music: 'music-market',
    nightMusic: 'music-night',
    ambientSounds: [
      { key: 'base-tropical', volume: 0.24 },
      { key: 'market-crowd', volume: 0.48 },
      { key: 'street-life', volume: 0.4 },
    ],
    nightAmbientSounds: [
      { key: 'street-life', volume: 0.22 },
      { key: 'distant-city', volume: 0.2 },
      { key: 'cricket-chorus', volume: 0.18 },
    ],
    footstepSurface: 'stone',
  },
  'st-pauls-church': {
    music: 'music-church',
    nightMusic: 'music-church',
    ambientSounds: [
      { key: 'base-tropical', volume: 0.18 },
      { key: 'church-bells', volume: 0.34 },
      { key: 'sacred-calm', volume: 0.42 },
    ],
    nightAmbientSounds: [
      { key: 'church-bells', volume: 0.18 },
      { key: 'sacred-calm', volume: 0.32 },
      { key: 'night-insects', volume: 0.14 },
    ],
    footstepSurface: 'stone',
  },
  'waterfront': {
    music: 'music-waterfront',
    nightMusic: 'music-night',
    ambientSounds: [
      { key: 'base-tropical', volume: 0.18 },
      { key: 'water-lapping', volume: 0.44 },
      { key: 'harbor-activity', volume: 0.34 },
      { key: 'seagulls', volume: 0.24 },
    ],
    nightAmbientSounds: [
      { key: 'water-lapping', volume: 0.4 },
      { key: 'harbor-activity', volume: 0.24 },
      { key: 'night-insects', volume: 0.18 },
    ],
    footstepSurface: 'wood',
  },
  'kampung': {
    music: 'music-main',
    nightMusic: 'music-night',
    ambientSounds: [
      { key: 'base-tropical', volume: 0.2 },
      { key: 'village-life', volume: 0.42 },
      { key: 'jungle-sounds', volume: 0.34 },
    ],
    nightAmbientSounds: [
      { key: 'village-life', volume: 0.18 },
      { key: 'jungle-sounds', volume: 0.34 },
      { key: 'cricket-chorus', volume: 0.24 },
    ],
    footstepSurface: 'dirt',
  },
};

interface NPCData {
  id: string;
  name: string;
  title?: string;
  location: string;
  position?: { x: number; y: number };
  sprite: string;
  dialogue: {
    greeting: string;
    topics: Record<string, { text: string; unlocks?: string[] }>;
  };
  schedule?: Array<{
    startHour: number;
    endHour: number;
    activity: string;
    location: string;
    available: boolean;
  }>;
}

interface WorldItemData {
  id: string;
  itemId: string;
  x: number;
  y: number;
  description: string;
}

interface WorldItemInstance {
  id: string;
  itemId: string;
  description: string;
  sprite: Phaser.GameObjects.Image;
  anchorX: number;
  anchorY: number;
  glow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface LoreObjectInstance {
  id: string;
  name: string;
  description: string;
  sprite: Phaser.GameObjects.Image;
  anchorX: number;
  anchorY: number;
  glow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface MarkerAnchor {
  x: number;
  y: number;
}

interface ObjectiveMarkerDefinition {
  questId: string;
  objectiveId: string;
  objectiveType: string;
  objectiveText: string;
  locationId: string;
  anchor: MarkerAnchor;
}

interface TransitionHotspot {
  config: TransitionConfig;
  glow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface QuestHotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  isAvailable: () => boolean;
  onInteract: () => void;
  glow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Arc;
  labelText: Phaser.GameObjects.Text;
}

type InteractionTargetType = 'npc' | 'item' | 'quest' | 'transition' | 'lore';

interface InteractionCandidate {
  type: InteractionTargetType;
  id: string;
  label: string;
  x: number;
  y: number;
  priority: number;
  score: number;
  interact: () => void;
}

// Art Bible time-of-day color configurations
const TIME_COLORS = {
  dawn: { color: 0xFFB6C1, alpha: 0.25, blendMode: 'MULTIPLY' },    // Pink/coral morning
  day: { color: 0xFFFFFF, alpha: 0.0, blendMode: 'NORMAL' },        // Clear tropical day
  dusk: { color: 0xF4A460, alpha: 0.3, blendMode: 'MULTIPLY' },     // Golden amber hour
  night: { color: 0x1a2f5c, alpha: 0.45, blendMode: 'MULTIPLY' },   // Deep blue night
} as const;

const TIME_COLOR_GRADE = {
  dawn: { multiply: 0x7A5A47, multiplyAlpha: 0.1, screen: 0xF4D7A1, screenAlpha: 0.075 },
  day: { multiply: 0x6A5A45, multiplyAlpha: 0.04, screen: 0xF2E2C5, screenAlpha: 0.035 },
  dusk: { multiply: 0x6C4632, multiplyAlpha: 0.14, screen: 0xE8B16C, screenAlpha: 0.08 },
  night: { multiply: 0x1C2D52, multiplyAlpha: 0.22, screen: 0x6F8CB8, screenAlpha: 0.045 },
} as const;

const TIME_CHARACTER_LIGHTING = {
  dawn: { tint: 0xF6D5AE, alpha: 0.98 },
  day: { tint: null, alpha: 1 },
  dusk: { tint: 0xEDC08A, alpha: 0.97 },
  night: { tint: 0x93A8D5, alpha: 0.9 },
} as const;

// Time ranges (24-hour format)
const TIME_RANGES = {
  dawn: { start: 5, end: 7 },
  day: { start: 7, end: 17 },
  dusk: { start: 17, end: 20 },
  night: { start: 20, end: 5 },
} as const;

const WORLD_ITEM_TYPE_FALLBACKS: Record<string, string> = {
  key: 'sack',
  document: 'scroll-rack',
  trade: 'spice-pile',
  consumable: 'flowers',
  valuable: 'ceramic-vase',
};

const LORE_SPRITE_ALIASES: Record<string, string> = {
  'coat-of-arms': 'tavern-sign',
  'stone-plaque': 'gravestone',
  keris: 'wayang-kulit-puppet',
  'ship-model': 'ship-mast',
  abacus: 'balance-scale',
  book: 'scroll-rack',
  scroll: 'scroll-rack',
  vase: 'ceramic-vase',
  'incense-burner': 'candelabra',
  gong: 'bell',
  chest: 'cargo-crate',
};

export class GameScene extends Phaser.Scene {
  private currentMap: string = 'rua-direita';
  private spawnOverride: { x: number; y: number } | null = null;
  private player!: Phaser.Physics.Arcade.Sprite;
  private npcs: Phaser.Physics.Arcade.Sprite[] = [];
  private npcDataMap: Map<Phaser.Physics.Arcade.Sprite, NPCData> = new Map();
  private npcSpriteById: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();
  private npcAnimationPrefixMap: Map<Phaser.Physics.Arcade.Sprite, string> = new Map();
  private npcFacingMap: Map<Phaser.Physics.Arcade.Sprite, 'up' | 'down' | 'left' | 'right'> = new Map();
  private activeDialogueNpc: Phaser.Physics.Arcade.Sprite | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private sceneConfig: SceneConfig | null = null;
  private sceneColliders: Phaser.Physics.Arcade.StaticGroup | null = null;
  private lightingOverlay!: Phaser.GameObjects.Rectangle;
  private currentHour: number = 10;
  private timeOfDay: TimeOfDay = 'day';
  private isTransitioningTime: boolean = false;
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;
  private ambientLayers: Map<string, Phaser.Sound.BaseSound> = new Map();
  private ambientBaseVolumes: Map<string, number> = new Map();
  private nextFootstepAt: number = 0;

  // Particle emitters for time-based effects
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private heatHazeEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private waterEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fireEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private fireflyEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private mistEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private currentBackground: Phaser.GameObjects.Image | null = null;
  private worldItems: WorldItemInstance[] = [];
  private loreObjects: LoreObjectInstance[] = [];
  private transitionHotspots: TransitionHotspot[] = [];
  private isoRenderer: IsometricRenderer | null = null;
  private isIsometric: boolean = false;
  private crowdSystem: CrowdSystem | null = null;
  private weatherSystem: WeatherSystem | null = null;
  private environmentObjects: EnvironmentObjectSystem | null = null;
  private questHotspots: QuestHotspot[] = [];
  private interactionPrompt: Phaser.GameObjects.Text | null = null;
  private activeInteractionTarget: InteractionCandidate | null = null;
  private playerShadow: Phaser.GameObjects.Ellipse | null = null;
  private npcShadowMap: Map<Phaser.Physics.Arcade.Sprite, Phaser.GameObjects.Ellipse> = new Map();
  private locationLightSources: Phaser.GameObjects.Arc[] = [];
  private fogLayers: Phaser.GameObjects.Ellipse[] = [];
  private aoOverlays: Phaser.GameObjects.Rectangle[] = [];
  private canopyShadows: Phaser.GameObjects.Ellipse[] = [];
  private colorGradeMultiplyOverlay: Phaser.GameObjects.Rectangle | null = null;
  private colorGradeScreenOverlay: Phaser.GameObjects.Rectangle | null = null;
  private filmGrainOverlay: Phaser.GameObjects.TileSprite | null = null;
  private sunShafts: Phaser.GameObjects.Ellipse[] = [];
  private visualQualityMode: VisualQualityMode = 'auto';
  private resolvedVisualQuality: ResolvedVisualQuality = 'balanced';
  private dynamicVisualQualityEnabled: boolean = true;
  private visualProfile: VisualProfile = VISUAL_PROFILES.balanced;
  private frameDeltas: number[] = [];
  private frameSampleCooldown: number = 0;
  private lastCharacterLightingSignature: string | null = null;
  private objectiveMarker: {
    definition: ObjectiveMarkerDefinition;
    beam: Phaser.GameObjects.Ellipse;
    beacon: Phaser.GameObjects.Arc;
    ring: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
  } | null = null;
  private lastObjectiveSignature: string | null = null;
  private bridgeUnsubscribers: Array<() => void> = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { mapKey?: string; spawnPoint?: { x: number; y: number } }) {
    const state = useGameStore.getState();

    if (data.mapKey) {
      this.currentMap = data.mapKey;
    } else if (state.currentLocation) {
      this.currentMap = state.currentLocation;
    }

    const pendingSpawn = state.pendingSpawnPoint?.mapKey === this.currentMap
      ? state.pendingSpawnPoint
      : null;

    this.spawnOverride = data.spawnPoint ?? (pendingSpawn
      ? { x: pendingSpawn.x, y: pendingSpawn.y }
      : null);

    if (!data.spawnPoint && pendingSpawn) {
      useGameStore.getState().clearPendingSpawnPoint();
    }

    this.currentHour = state.time.hour;
    this.visualQualityMode = state.visualQualityMode;
    this.dynamicVisualQualityEnabled = state.dynamicVisualQuality;
    this.resolvedVisualQuality = resolveVisualQualityMode(this.visualQualityMode, state.resolvedVisualQuality);
    this.visualProfile = VISUAL_PROFILES[this.resolvedVisualQuality];
  }

  create() {
    console.log('GameScene started - Loading:', this.currentMap);

    // Load scene config
    const sceneDefinitions = locationScenesData as Record<string, SceneConfig>;
    this.sceneConfig = sceneDefinitions[this.currentMap] || null;

    // Create scene background
    this.createSceneBackdrop();

    // Create atmosphere effects
    this.createAtmosphere();
    this.createWaterAnimations();
    this.createFireAnimations();
    this.createLocationLights();
    this.createAOOverlays();
    this.createFogLayers();
    this.createCanopyShadows();
    this.createCinematicLayers();
    useGameStore.getState().setResolvedVisualQuality(this.resolvedVisualQuality);

    // Create player
    this.createPlayer();

    // Create NPCs
    this.createNPCs();
    this.applyCharacterLighting(true);

    // Create world pickups for this location
    this.createWorldItems();

    // Create lore objects for this location
    this.createLoreObjects();

    // Create traversal and quest interaction hotspots
    this.createTransitionHotspots();
    this.createQuestHotspots();

    // Initialize atmosphere systems
    this.crowdSystem = new CrowdSystem(this, this.resolvedVisualQuality);
    this.crowdSystem.initialize(this.currentMap);
    this.crowdSystem.setTimeOfDay(this.timeOfDay);

    this.weatherSystem = new WeatherSystem(this, this.resolvedVisualQuality);
    this.weatherSystem.initialize();
    this.weatherSystem.setLocation(this.currentMap);
    this.weatherSystem.setTimeOfDay(this.timeOfDay);

    // Initialize environment decoration objects
    this.environmentObjects = new EnvironmentObjectSystem(this, this.resolvedVisualQuality);
    this.environmentObjects.initialize(this.currentMap);
    this.environmentObjects.setTimeOfDay(this.timeOfDay);

    // Set up camera
    this.setupCamera();

    // Set up input
    this.setupInput();

    // Set up React event listeners
    this.setupReactBridge();

    // Create lighting overlay
    this.createLighting();

    // Update game store with location
    this.updateLocationState();

    // Start location music and ambience once time-of-day state is resolved
    this.syncLocationAudio(true);

    // Show location name
    this.showLocationName();

    // Initialize tracked objective marker
    this.refreshObjectiveMarker(true);
    this.createInteractionPrompt();

    // Emit game ready
    emitGameEvent('game:ready');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  private createSceneBackdrop() {
    const runtimeMode = this.sceneConfig?.projection?.runtimeMode || 'legacy-backdrop';
    if (runtimeMode === 'isometric-2:1') {
      this.createIsometricWorld();
      return;
    }

    const width = GAME_WIDTH;
    const height = GAME_HEIGHT;

    // Clear existing colliders
    if (this.sceneColliders) {
      this.sceneColliders.clear(true, true);
      this.sceneColliders = null;
    }

    // Set physics bounds
    this.physics.world.setBounds(0, 0, width, height);

    // Draw background with time-of-day variant support
    const backgroundKey = this.getBackgroundKeyForTime();
    if (backgroundKey && this.textures.exists(backgroundKey)) {
      const bg = this.add.image(width / 2, height / 2, backgroundKey);
      const scaleX = width / bg.width;
      const scaleY = height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale);
      bg.setScrollFactor(0);
      bg.setDepth(-20);
      this.currentBackground = bg;
    } else if (this.sceneConfig?.background) {
      // Fallback to base background
      const bg = this.add.image(width / 2, height / 2, this.sceneConfig.background);
      const scaleX = width / bg.width;
      const scaleY = height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale);
      bg.setScrollFactor(0);
      bg.setDepth(-20);
      this.currentBackground = bg;
    } else {
      // Fallback gradient background
      const graphics = this.add.graphics();
      graphics.fillGradientStyle(0x1a0f05, 0x1a0f05, 0x3d2817, 0x3d2817, 1);
      graphics.fillRect(0, 0, width, height);
      graphics.setDepth(-20);
    }

    // Add vignette
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.3, 0.15, 0.15, 0.3);
    vignette.fillRect(0, 0, width, height);
    vignette.setScrollFactor(0);
    vignette.setDepth(-10);

    // Create collision rects if defined
    if (this.sceneConfig?.collisionRects?.length) {
      this.sceneColliders = this.physics.add.staticGroup();
      this.sceneConfig.collisionRects.forEach((rect) => {
        const collider = this.add.rectangle(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          rect.width,
          rect.height,
          0x000000,
          0
        );
        this.physics.add.existing(collider, true);
        this.sceneColliders!.add(collider);
      });
    }
  }

  private createIsometricWorld() {
    this.isIsometric = true;

    // Clean up any existing colliders
    if (this.sceneColliders) {
      this.sceneColliders.clear(true, true);
      this.sceneColliders = null;
    }

    const isoMapKey = this.sceneConfig?.isoMapKey || `${this.currentMap}-iso`;

    // All known tileset names → iso texture keys.
    // The IsometricRenderer's addTilesetImage will silently skip
    // any tileset not present in the JSON, so it's safe to list all.
    const tilesetMappings = [
      { name: 'fortress-stone', textureKey: 'fortress-stone-iso' },
      { name: 'grass', textureKey: 'grass-iso' },
      { name: 'cobblestone', textureKey: 'cobblestone-iso' },
      { name: 'wall-white', textureKey: 'wall-white-iso' },
      { name: 'dirt-path', textureKey: 'dirt-path-iso' },
      { name: 'bamboo-floor', textureKey: 'bamboo-floor-iso' },
      { name: 'thatch-roof', textureKey: 'thatch-roof-iso' },
      { name: 'church-stone', textureKey: 'church-stone-iso' },
      { name: 'church-floor', textureKey: 'church-floor-iso' },
      { name: 'water-tile', textureKey: 'water-tile-iso' },
      { name: 'dock-wood', textureKey: 'dock-wood-iso' },
      { name: 'roof-terracotta', textureKey: 'roof-terracotta-iso' },
      { name: 'door-wood', textureKey: 'door-wood-iso' },
    ];

    this.isoRenderer = new IsometricRenderer(this, isoMapKey, tilesetMappings);
    this.isoRenderer.create();

    // Set physics and camera bounds to isometric world size
    const bounds = this.isoRenderer.getWorldBounds();
    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);

    // Add a dark background behind the tilemap
    const bg = this.add.rectangle(bounds.width / 2, bounds.height / 2, bounds.width, bounds.height, 0x1a0f05);
    bg.setDepth(-20);
  }

  private getBackgroundKeyForTime(): string | null {
    const scenePrefix = LOCATION_TO_SCENE[this.currentMap];
    if (!scenePrefix) return null;

    // For day, use the base scene (no suffix)
    if (this.timeOfDay === 'day') {
      // Map to existing scene names
      const daySceneMap: Record<string, string> = {
        'a-famosa': 'scene-a-famosa-gate',
        'rua-direita': 'scene-rua-direita',
        'st-pauls': 'scene-st-pauls-church',
        'waterfront': 'scene-waterfront',
        'kampung': 'scene-kampung',
      };
      return daySceneMap[scenePrefix] || null;
    }

    // For other times, use the variant
    return `scene-${scenePrefix}-${this.timeOfDay}`;
  }

  private updateBackgroundForTime() {
    const newBackgroundKey = this.getBackgroundKeyForTime();

    if (!newBackgroundKey || !this.textures.exists(newBackgroundKey)) {
      console.log(`Background not found: ${newBackgroundKey}, keeping current`);
      return;
    }

    if (this.currentBackground) {
      // Crossfade to new background
      const width = GAME_WIDTH;
      const height = GAME_HEIGHT;

      const newBg = this.add.image(width / 2, height / 2, newBackgroundKey);
      const scaleX = width / newBg.width;
      const scaleY = height / newBg.height;
      const scale = Math.max(scaleX, scaleY);
      newBg.setScale(scale);
      newBg.setScrollFactor(0);
      newBg.setDepth(-21); // Behind current
      newBg.setAlpha(0);

      // Fade in new, fade out old
      this.tweens.add({
        targets: newBg,
        alpha: 1,
        duration: 2000,
        ease: 'Sine.easeInOut',
      });

      this.tweens.add({
        targets: this.currentBackground,
        alpha: 0,
        duration: 2000,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (this.currentBackground) {
            this.currentBackground.destroy();
          }
          newBg.setDepth(-20);
          this.currentBackground = newBg;
        }
      });
    }
  }

  private createAtmosphere() {
    const worldBounds = this.isIsometric && this.isoRenderer
      ? this.isoRenderer.getWorldBounds()
      : { width: GAME_WIDTH, height: GAME_HEIGHT };

    // Dust motes - intensity varies by time of day
    const dustParticles = this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: worldBounds.width },
      y: { min: 0, max: worldBounds.height },
      quantity: 1,
      frequency: 150,
      lifespan: { min: 8000, max: 12000 },
      speedX: { min: -5, max: 5 },
      speedY: { min: -8, max: -3 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0, end: 0.15 },
      tint: 0xF4E6D3,
      blendMode: 'ADD',
      emitting: true,
    });
    dustParticles.setDepth(900);
    this.dustEmitter = dustParticles;

    // Heat haze - only during day/dusk
    const heatHazeParticles = this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: worldBounds.width },
      y: { min: worldBounds.height * 0.3, max: worldBounds.height },
      quantity: 1,
      frequency: 300,
      lifespan: { min: 5000, max: 8000 },
      speedX: { min: -3, max: 3 },
      speedY: { min: -5, max: 0 },
      scale: { start: 1.5, end: 2.5 },
      alpha: { start: 0, end: 0.05 },
      tint: 0xF4B41A,
      blendMode: 'ADD',
      emitting: true,
    });
    heatHazeParticles.setDepth(500);
    this.heatHazeEmitter = heatHazeParticles;

    // Create firefly texture for night
    this.createFireflyTexture();

    // Create mist texture for dawn
    this.createMistTexture();

    // Set initial particle states based on current time
    this.updateParticlesForTime();
  }

  private createFireflyTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Soft glowing center
    graphics.fillStyle(0xFFFF88, 1);
    graphics.fillCircle(4, 4, 2);
    // Glow halo
    graphics.fillStyle(0xAAFF44, 0.5);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('firefly', 8, 8);
    graphics.destroy();
  }

  private createMistTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Soft diffuse mist blob
    graphics.fillStyle(0xFFFFFF, 0.3);
    graphics.fillCircle(16, 16, 16);
    graphics.fillStyle(0xFFFFFF, 0.15);
    graphics.fillCircle(16, 16, 24);
    graphics.generateTexture('mist', 48, 48);
    graphics.destroy();
  }

  private updateParticlesForTime() {
    // Update dust motes - more visible at golden hour
    if (this.dustEmitter) {
      const dustConfig = {
        dawn: { frequency: 200, alpha: 0.12, tint: 0xFFD4B8 },
        day: { frequency: 150, alpha: 0.15, tint: 0xF4E6D3 },
        dusk: { frequency: 80, alpha: 0.25, tint: 0xF4B41A },  // Golden hour - more dust
        night: { frequency: 300, alpha: 0.08, tint: 0x8888AA },
      };
      const config = dustConfig[this.timeOfDay];
      const frequency = Math.max(40, Math.round(config.frequency * this.visualProfile.dustFrequencyMultiplier));
      this.dustEmitter.setFrequency(frequency);
      this.dustEmitter.setParticleTint(config.tint);
    }

    // Heat haze - only during day and dusk
    if (this.heatHazeEmitter) {
      const showHeatHaze = this.visualProfile.heatHazeEnabled && (this.timeOfDay === 'day' || this.timeOfDay === 'dusk');
      this.heatHazeEmitter.stop();
      if (showHeatHaze) {
        this.heatHazeEmitter.start();
      }
    }

    // Fireflies - only at night, especially in kampung
    this.updateFireflies();

    // Mist - only at dawn, especially at waterfront
    this.updateMist();

    // Fire/Torches - only at dusk and night
    const showFire = this.timeOfDay === 'night' || this.timeOfDay === 'dusk';
    this.fireEmitters.forEach((emitter) => {
      if (showFire) {
        emitter.start();
      } else {
        emitter.stop();
      }
    });
  }

  private updateFireflies() {
    const showFireflies = this.timeOfDay === 'night';
    const isKampung = this.currentMap === 'kampung';
    const worldBounds = this.isIsometric && this.isoRenderer
      ? this.isoRenderer.getWorldBounds()
      : { width: GAME_WIDTH, height: GAME_HEIGHT };

    if (showFireflies) {
      if (!this.fireflyEmitter) {
        const fireflyParticles = this.add.particles(0, 0, 'firefly', {
          x: { min: 50, max: Math.max(60, worldBounds.width - 50) },
          y: { min: worldBounds.height * 0.4, max: worldBounds.height * 0.8 },
          quantity: 1,
          frequency: isKampung ? 400 : 800,  // More fireflies in kampung
          lifespan: { min: 3000, max: 6000 },
          speedX: { min: -8, max: 8 },
          speedY: { min: -5, max: 5 },
          scale: { start: 0.4, end: 0.8 },
          alpha: { start: 0.8, end: 0, ease: 'Sine.easeInOut' },
          blendMode: 'ADD',
          emitting: true,
        });
        fireflyParticles.setDepth(950);
        this.fireflyEmitter = fireflyParticles;
      } else {
        this.fireflyEmitter.start();
        this.fireflyEmitter.setFrequency(isKampung ? 400 : 800);
      }
    } else if (this.fireflyEmitter) {
      this.fireflyEmitter.stop();
    }
  }

  private updateMist() {
    const showMist = this.timeOfDay === 'dawn';
    const isWaterfront = this.currentMap === 'waterfront';
    const worldBounds = this.isIsometric && this.isoRenderer
      ? this.isoRenderer.getWorldBounds()
      : { width: GAME_WIDTH, height: GAME_HEIGHT };

    if (showMist) {
      if (!this.mistEmitter) {
        const mistParticles = this.add.particles(0, 0, 'mist', {
          x: { min: 0, max: worldBounds.width },
          y: { min: worldBounds.height * 0.6, max: worldBounds.height },
          quantity: 1,
          frequency: isWaterfront ? 500 : 1000,  // More mist at waterfront
          lifespan: { min: 8000, max: 15000 },
          speedX: { min: 3, max: 8 },
          speedY: { min: -2, max: 2 },
          scale: { start: 0.5, end: 1.5 },
          alpha: { start: 0.3, end: 0 },
          blendMode: 'SCREEN',
          emitting: true,
        });
        mistParticles.setDepth(800);
        this.mistEmitter = mistParticles;
      } else {
        this.mistEmitter.start();
        this.mistEmitter.setFrequency(isWaterfront ? 500 : 1000);
      }
    } else if (this.mistEmitter) {
      this.mistEmitter.stop();
    }
  }

  private createWaterAnimations() {
    if (this.currentMap !== 'waterfront') return;
    const worldBounds = this.isIsometric && this.isoRenderer
      ? this.isoRenderer.getWorldBounds()
      : { width: GAME_WIDTH, height: GAME_HEIGHT };

    this.waterEmitter = this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: worldBounds.width },
      y: { min: worldBounds.height * 0.55, max: worldBounds.height },
      quantity: 1,
      frequency: 200,
      lifespan: { min: 2000, max: 4000 },
      scale: { start: 0.1, end: 0.2 },
      alpha: { start: 0, end: 0.3 },
      tint: 0x5DADE2,
      blendMode: 'ADD',
      emitting: true
    });
    this.waterEmitter.setDepth(-5);
    
    this.tweens.add({
      targets: this.waterEmitter,
      particleSpeedX: { from: -2, to: 2 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private createFireAnimations() {
    this.fireEmitters = [];
    const lightAlpha = this.visualProfile.pointLightAlphaMultiplier;

    const firePositions: Record<string, Array<{ x: number; y: number }>> = {
      'a-famosa-gate': [{ x: 420, y: 240 }, { x: 540, y: 240 }],
      'rua-direita': [{ x: 300, y: 300 }, { x: 680, y: 310 }],
      'st-pauls-church': [{ x: 470, y: 230 }, { x: 560, y: 240 }],
      'waterfront': [{ x: 210, y: 260 }, { x: 730, y: 250 }],
      'kampung': [{ x: 260, y: 300 }, { x: 600, y: 300 }],
    };

    const positions = firePositions[this.currentMap] || [];
    const isDark = this.timeOfDay === 'night' || this.timeOfDay === 'dusk';

    positions.forEach((pos) => {
      const emitter = this.add.particles(pos.x, pos.y, 'particle', {
        quantity: 1,
        frequency: 80,
        lifespan: { min: 600, max: 1000 },
        speedY: { min: -40, max: -20 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.6 * lightAlpha, end: 0 },
        tint: [0xFF6347, 0xFF8C00, 0xF4B41A],
        blendMode: 'ADD',
        emitting: isDark
      });
      emitter.setDepth(961);
      this.fireEmitters.push(emitter);
    });
  }

  private createPlayer() {
    let spawnX = GAME_WIDTH / 2;
    let spawnY = GAME_HEIGHT - 48;

    if (this.spawnOverride) {
      spawnX = this.spawnOverride.x;
      spawnY = this.spawnOverride.y;
    } else if (this.sceneConfig?.playerStart) {
      spawnX = this.sceneConfig.playerStart.x;
      spawnY = this.sceneConfig.playerStart.y;
    }

    // In isometric mode, playerStart is in tile coordinates — convert to world
    if (this.isIsometric && this.isoRenderer && !this.spawnOverride) {
      const worldPos = this.isoRenderer.tileToWorld(spawnX, spawnY);
      spawnX = worldPos.x;
      spawnY = worldPos.y;
    }

    this.player = this.physics.add.sprite(spawnX, spawnY, 'player-sheet');

    // Scale up character to match 960×540 scene backgrounds
    // Original sprite is 16×32 (designed for 320×180), scaled for current resolution
    this.player.setScale(CHARACTER_SCALE);

    // Adjust physics body to match scaled sprite
    // Original hitbox would be ~12×16 at feet, scaled up proportionally
    // Body size is in world coords, so multiply by scale
    if (this.player.body) {
      this.player.body.setSize(12 * CHARACTER_SCALE, 16 * CHARACTER_SCALE);
      this.player.body.setOffset(2 * CHARACTER_SCALE, 16 * CHARACTER_SCALE);
    }

    this.player.setCollideWorldBounds(true);

    // In isometric mode, use y-based depth sorting; in legacy mode, fixed high depth
    if (this.isIsometric) {
      this.player.setDepth(this.player.y);
    } else {
      this.player.setDepth(1000);
    }

    this.playerShadow = this.add.ellipse(
      this.player.x,
      this.player.y + 40,
      54,
      20,
      0x000000,
      0.28
    );
    this.playerShadow.setDepth(this.player.depth - 1);

    // Set up collision with scene colliders (legacy mode)
    if (this.sceneColliders) {
      this.physics.add.collider(this.player, this.sceneColliders);
    }

    // Set up collision with tilemap walls (isometric mode)
    if (this.isIsometric && this.isoRenderer) {
      const wallsLayer = this.isoRenderer.getCollisionLayer();
      if (wallsLayer) {
        this.physics.add.collider(this.player, wallsLayer);
      }
    }

    // Play idle animation
    if (this.anims.exists('idle-down')) {
      this.player.play('idle-down');
    }
  }

  private createNPCs() {
    this.npcs = [];
    this.npcDataMap.clear();
    this.npcSpriteById.clear();
    this.npcAnimationPrefixMap.clear();
    this.npcFacingMap.clear();
    this.npcShadowMap.clear();

    const npcData = useDialogueStore.getState().allNPCData as unknown as Record<string, NPCData>;
    if (!npcData || Object.keys(npcData).length === 0) {
      console.warn('NPC data not loaded');
      return;
    }

    const npcOverrides = this.sceneConfig?.npcPositions || {};

    Object.values(npcData).forEach((data) => {
      if (data.location !== this.currentMap) return;
      if (!this.isNpcAvailableAtCurrentTime(data)) return;

      let x = data.position?.x || GAME_WIDTH / 2;
      let y = data.position?.y || GAME_HEIGHT / 2;

      if (npcOverrides[data.id]) {
        x = npcOverrides[data.id].x;
        y = npcOverrides[data.id].y;
      }

      // In isometric mode, npcPositions are tile coordinates — convert to world
      if (this.isIsometric && this.isoRenderer) {
        const worldPos = this.isoRenderer.tileToWorld(x, y);
        x = worldPos.x;
        y = worldPos.y;
      }

      const sheetKey = `${data.sprite || data.id}-sheet`;
      const npcTexture = this.textures.exists(sheetKey) ? sheetKey : 'debug-character-missing';
      const npc = this.physics.add.sprite(x, y, npcTexture);

      // Scale up NPC to match scene backgrounds (same as player)
      npc.setScale(CHARACTER_SCALE);

      npc.setImmovable(true);
      npc.setDepth(y);

      const shadow = this.add.ellipse(x, y + 40, 50, 18, 0x000000, 0.24);
      shadow.setDepth(npc.depth - 1);
      this.npcShadowMap.set(npc, shadow);

      // Store NPC data reference
      this.npcDataMap.set(npc, data);
      this.npcSpriteById.set(data.id, npc);
      this.npcFacingMap.set(npc, 'down');
      this.npcAnimationPrefixMap.set(npc, this.getNpcAnimationPrefix(data) || '');
      this.npcs.push(npc);

      const animationPrefix = this.npcAnimationPrefixMap.get(npc);
      if (animationPrefix && this.anims.exists(`${animationPrefix}-idle-down`)) {
        npc.play(`${animationPrefix}-idle-down`);
      }

      // Add interaction indicator (golden dot) - adjusted for scaled NPC
      const indicatorOffset = 20 * CHARACTER_SCALE; // 60 pixels above for 3x scale
      const indicator = this.add.circle(x, y - indicatorOffset, 8, 0xFFD700);
      indicator.setVisible(false);
      indicator.setDepth(1001);
      (npc as unknown as { indicator: Phaser.GameObjects.Arc }).indicator = indicator;

      console.log(`Created NPC: ${data.name} at (${x}, ${y})`);
    });
  }

  private getNpcAnimationPrefix(data: NPCData): string | null {
    const candidates = [data.id, data.sprite].filter((value): value is string => Boolean(value));
    return candidates.find((candidate) => this.anims.exists(`${candidate}-idle-down`)) || null;
  }

  private isHourInScheduleRange(hour: number, startHour: number, endHour: number): boolean {
    if (startHour === endHour) return true;
    if (startHour < endHour) {
      return hour >= startHour && hour < endHour;
    }
    return hour >= startHour || hour < endHour;
  }

  private isNpcAvailableAtCurrentTime(data: NPCData): boolean {
    if (!data.schedule || data.schedule.length === 0) {
      return data.location === this.currentMap;
    }

    const slot = data.schedule.find((entry) =>
      this.isHourInScheduleRange(this.currentHour, entry.startHour, entry.endHour)
    );
    if (!slot) return data.location === this.currentMap;
    if (slot.available === false) return false;
    if (slot.location && slot.location !== this.currentMap) return false;
    return true;
  }

  private createWorldItems() {
    const worldItems = getWorldItemsAtLocation(this.currentMap) as WorldItemData[];
    this.worldItems = [];

    worldItems.forEach((item) => {
      const spriteKey = this.resolveWorldItemSpriteKey(item.itemId);
      const sprite = this.add.image(item.x, item.y, spriteKey);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(this.getWorldItemScale(spriteKey));
      sprite.setDepth(item.y + 1);

      const markerY = item.y - Math.max(22, sprite.displayHeight) - 8;
      const glow = this.add.ellipse(item.x, item.y - 4, 34, 18, 0xF4B41A, 0.18);
      glow.setDepth(979);
      glow.setBlendMode(Phaser.BlendModes.ADD);

      const marker = this.add.circle(item.x, markerY, 7, 0xF4B41A, 0.9);
      marker.setStrokeStyle(2, 0x3b2509, 1);
      marker.setDepth(sprite.depth + 1);

      const itemName = ITEM_DEFINITIONS[item.itemId]?.name || item.itemId;
      const label = this.add.text(item.x, markerY - 12, itemName, {
        font: '12px Cinzel, Georgia, serif',
        color: '#F4E6BE',
        stroke: '#000000',
        strokeThickness: 2,
      });
      label.setOrigin(0.5, 1);
      label.setDepth(sprite.depth + 2);
      label.setVisible(false);

      this.worldItems.push({
        id: item.id,
        itemId: item.itemId,
        description: item.description,
        sprite,
        anchorX: item.x,
        anchorY: item.y,
        glow,
        marker,
        label,
      });
    });
  }

  private createLoreObjects() {
    const objects = (historicalObjectsData as any).objects || {};
    this.loreObjects = [];

    Object.values(objects).forEach((obj: any) => {
      if (obj.location !== this.currentMap) return;

      const x = obj.position?.x || 0;
      const y = obj.position?.y || 0;
      const spriteKey = this.resolveGameplaySpriteKey(obj.sprite);
      const sprite = this.add.image(x, y, spriteKey);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(3);
      sprite.setDepth(y + 1);

      const markerY = y - Math.max(22, sprite.displayHeight) - 8;
      const glow = this.add.ellipse(x, y - 4, 36, 20, 0xD4AF37, 0.12);
      glow.setDepth(979);
      glow.setBlendMode(Phaser.BlendModes.ADD);

      const marker = this.add.circle(x, markerY, 6, 0xD4AF37, 0.7);
      marker.setStrokeStyle(2, 0x3b2509, 0.8);
      marker.setDepth(sprite.depth + 1);

      const label = this.add.text(x, markerY - 12, obj.name, {
        font: 'italic 11px Cinzel, Georgia, serif',
        color: '#D4AF37',
        stroke: '#000000',
        strokeThickness: 2,
      });
      label.setOrigin(0.5, 1);
      label.setDepth(sprite.depth + 2);
      label.setVisible(false);

      this.loreObjects.push({
        id: obj.id,
        name: obj.name,
        description: obj.examineText || obj.description,
        sprite,
        anchorX: x,
        anchorY: y,
        glow,
        marker,
        label,
      });
    });
  }

  private resolveGameplaySpriteKey(preferredKey?: string): string {
    if (preferredKey && this.textures.exists(preferredKey)) {
      return preferredKey;
    }

    const alias = preferredKey ? LORE_SPRITE_ALIASES[preferredKey] : null;
    if (alias && this.textures.exists(alias)) {
      return alias;
    }

    return 'debug-prop-missing';
  }

  private createTransitionHotspots() {
    this.transitionHotspots.forEach((hotspot) => {
      hotspot.glow.destroy();
      hotspot.marker.destroy();
      hotspot.label.destroy();
    });
    this.transitionHotspots = [];

    (this.sceneConfig?.transitions || []).forEach((transition) => {
      const x = transition.triggerArea.x + (transition.triggerArea.width / 2);
      const y = transition.triggerArea.y + (transition.triggerArea.height / 2);

      const glow = this.add.ellipse(x, y, 54, 22, 0xF4B41A, 0.12);
      glow.setDepth(978);
      glow.setBlendMode(Phaser.BlendModes.ADD);

      const marker = this.add.arc(x, y, 10, 200, 340, false, 0xF4B41A, 0.85);
      marker.setStrokeStyle(2, 0x3b2509, 1);
      marker.setDepth(979);

      const label = this.add.text(x, y - 24, transition.label, {
        font: 'italic 11px Cinzel, Georgia, serif',
        color: '#F4E6BE',
        stroke: '#000000',
        strokeThickness: 2,
      });
      label.setOrigin(0.5, 1);
      label.setDepth(980);
      label.setVisible(false);

      this.transitionHotspots.push({
        config: transition,
        glow,
        marker,
        label,
      });
    });
  }

  private createQuestHotspots() {
    this.questHotspots.forEach((hotspot) => {
      hotspot.glow.destroy();
      hotspot.marker.destroy();
      hotspot.labelText.destroy();
    });
    this.questHotspots = [];

    if (this.currentMap !== 'waterfront') return;

    this.questHotspots.push(this.createQuestHotspot({
      id: 'merchants-seal-counting-house-entry',
      label: 'Slip into the counting house',
      x: 620,
      y: 250,
      radius: 90,
      isAvailable: () => this.isMerchantsSealTheftEntryAvailable(),
      onInteract: () => {
        emitGameEvent('quest:path:request', 'theft');
        useQuestStore.getState().recordLocation(this.currentMap);
        useQuestStore.getState().recordStealth('counting-house');

        const stage = useQuestStore.getState().getQuestStage('merchants-seal');
        if (stage?.id === 'theft-choice') {
          emitGameEvent('quest:path:request', 'proceed-theft');
        }

        this.showNotification('You slip into the counting house.');
      },
    }));

    this.questHotspots.push(this.createQuestHotspot({
      id: 'merchants-seal-drawer-search',
      label: 'Search the ledger drawer',
      x: 575,
      y: 235,
      radius: 78,
      isAvailable: () => this.isMerchantsSealDrawerAvailable(),
      onInteract: () => {
        useQuestStore.getState().recordSearch('counting-house-drawer');
        this.showNotification('You recover the trading seal.');
      },
    }));
  }

  private createQuestHotspot(config: {
    id: string;
    label: string;
    x: number;
    y: number;
    radius: number;
    isAvailable: () => boolean;
    onInteract: () => void;
  }): QuestHotspot {
    const glow = this.add.ellipse(config.x, config.y, 44, 18, 0xCFA34A, 0.1);
    glow.setDepth(978);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    const marker = this.add.circle(config.x, config.y, 7, 0xCFA34A, 0.85);
    marker.setStrokeStyle(2, 0x3b2509, 1);
    marker.setDepth(979);

    const labelText = this.add.text(config.x, config.y - 22, config.label, {
      font: 'italic 11px Cinzel, Georgia, serif',
      color: '#F4E6BE',
      stroke: '#000000',
      strokeThickness: 2,
    });
    labelText.setOrigin(0.5, 1);
    labelText.setDepth(980);
    labelText.setVisible(false);

    return {
      ...config,
      glow,
      marker,
      labelText,
    };
  }

  private isMerchantsSealTheftEntryAvailable(): boolean {
    const stage = useQuestStore.getState().getQuestStage('merchants-seal');
    if (!stage) return false;
    return ['choose-path', 'theft-attempt', 'theft-choice'].includes(stage.id) && this.timeOfDay === 'night';
  }

  private isMerchantsSealDrawerAvailable(): boolean {
    const stage = useQuestStore.getState().getQuestStage('merchants-seal');
    return Boolean(stage?.id === 'theft-success' && this.timeOfDay === 'night');
  }

  private createLocationLights() {
    // Light type definitions inspired by the archived LightingSystem
    type LightType = 'torch' | 'lantern' | 'cookingFire' | 'window';

    interface LightTypeConfig {
      color: number;
      radius: number;
      intensity: number;
      flicker: boolean;
      flickerSpeed: number;
      flickerAmount: number;
      nightOnly: boolean;
    }

    const LIGHT_TYPE_CONFIGS: Record<LightType, LightTypeConfig> = {
      torch: {
        color: 0xFF8C00,
        radius: 140,
        intensity: 0.8,
        flicker: true,
        flickerSpeed: 100,
        flickerAmount: 0.2,
        nightOnly: false,
      },
      lantern: {
        color: 0xFFD700,
        radius: 96,
        intensity: 0.7,
        flicker: false,
        flickerSpeed: 0,
        flickerAmount: 0,
        nightOnly: false,
      },
      cookingFire: {
        color: 0xFF6347,
        radius: 192,
        intensity: 0.9,
        flicker: true,
        flickerSpeed: 80,
        flickerAmount: 0.3,
        nightOnly: false,
      },
      window: {
        color: 0xFFFACD,
        radius: 72,
        intensity: 0.5,
        flicker: false,
        flickerSpeed: 0,
        flickerAmount: 0,
        nightOnly: true,
      },
    };

    // Location light definitions (coordinates already in 960x540 space)
    const LOCATION_LIGHTS: Record<string, Array<{ x: number; y: number; type: LightType }>> = {
      'rua-direita': [
        { x: 300, y: 300, type: 'lantern' },
        { x: 680, y: 310, type: 'lantern' },
        { x: 360, y: 450, type: 'lantern' },
        { x: 900, y: 540, type: 'torch' },
        { x: 600, y: 1050, type: 'window' },
        { x: 1200, y: 1050, type: 'window' },
        { x: 480, y: 660, type: 'torch' },
      ],
      'a-famosa-gate': [
        { x: 420, y: 240, type: 'torch' },
        { x: 540, y: 240, type: 'torch' },
        { x: 600, y: 450, type: 'torch' },
        { x: 900, y: 900, type: 'torch' },
        { x: 300, y: 750, type: 'torch' },
        { x: 1500, y: 750, type: 'torch' },
      ],
      'st-pauls-church': [
        { x: 470, y: 230, type: 'lantern' },
        { x: 560, y: 240, type: 'lantern' },
        { x: 750, y: 600, type: 'lantern' },
        { x: 1050, y: 600, type: 'lantern' },
        { x: 900, y: 900, type: 'window' },
      ],
      waterfront: [
        { x: 210, y: 260, type: 'lantern' },
        { x: 730, y: 250, type: 'lantern' },
        { x: 450, y: 900, type: 'lantern' },
        { x: 1050, y: 840, type: 'lantern' },
        { x: 1650, y: 900, type: 'lantern' },
        { x: 750, y: 450, type: 'torch' },
      ],
      kampung: [
        { x: 260, y: 300, type: 'cookingFire' },
        { x: 600, y: 300, type: 'cookingFire' },
        { x: 1350, y: 900, type: 'cookingFire' },
        { x: 900, y: 540, type: 'torch' },
      ],
    };

    const lightDefs = LOCATION_LIGHTS[this.currentMap] || [];
    const lightAlpha = this.visualProfile.pointLightAlphaMultiplier;

    // Clean up any previous light graphics (they are stored separately from the Arc array)
    this.locationLightSources.forEach((glow) => glow.destroy());
    this.locationLightSources = [];

    // We use a sentinel Arc per light so the existing cleanup/visibility code still works.
    // The actual graduated glow is drawn with Graphics objects stored inside the Arc's data.
    lightDefs.forEach((def, index) => {
      const typeConfig = LIGHT_TYPE_CONFIGS[def.type];

      // Create graduated radial gradient using Graphics
      const gfx = this.add.graphics();
      gfx.setPosition(def.x, def.y);
      gfx.setDepth(960);
      gfx.setBlendMode(Phaser.BlendModes.ADD);

      const steps = 10;
      for (let i = steps; i > 0; i--) {
        const stepRadius = (typeConfig.radius / steps) * i;
        const alpha = (typeConfig.intensity / steps) * (steps - i + 1) * 0.5 * lightAlpha;
        gfx.fillStyle(typeConfig.color, alpha);
        gfx.fillCircle(0, 0, stepRadius);
      }

      gfx.setVisible(false);

      // Flicker effect: use a timer to redraw at random intensity
      if (typeConfig.flicker) {
        this.time.addEvent({
          delay: typeConfig.flickerSpeed,
          loop: true,
          callback: () => {
            if (!gfx.active) return;
            const variation = Phaser.Math.FloatBetween(
              -typeConfig.flickerAmount,
              typeConfig.flickerAmount,
            );
            const currentIntensity = Math.max(0.1, Math.min(1, typeConfig.intensity + variation));

            gfx.clear();
            for (let i = steps; i > 0; i--) {
              const stepRadius = (typeConfig.radius / steps) * i;
              const alpha = (currentIntensity / steps) * (steps - i + 1) * 0.5 * lightAlpha;
              gfx.fillStyle(typeConfig.color, alpha);
              gfx.fillCircle(0, 0, stepRadius);
            }
          },
        });
      } else {
        // Non-flickering lights get a gentle pulse tween
        this.tweens.add({
          targets: gfx,
          alpha: { from: 0.7, to: 1.0 },
          duration: 1800 + index * 250,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      // Store night-only flag on the graphics object for visibility toggling
      gfx.setData('nightOnly', typeConfig.nightOnly);

      // We store the Graphics as an Arc via casting so the existing array/cleanup works.
      // Actually, let's use a wrapper Arc as a sentinel that we keep in the array.
      // Better: just store references in the array via a cast — both Arc and Graphics
      // extend GameObject, so the destroy() and setVisible() calls work fine.
      this.locationLightSources.push(gfx as unknown as Phaser.GameObjects.Arc);
    });

    this.updateLocationLightsForTime();
  }

  private updateLocationLightsForTime() {
    const isNightTime = this.timeOfDay === 'dusk' || this.timeOfDay === 'night';

    this.locationLightSources.forEach((glow) => {
      const nightOnly = glow.getData?.('nightOnly') ?? false;
      if (nightOnly) {
        glow.setVisible(isNightTime);
      } else {
        glow.setVisible(isNightTime);
      }
    });
  }

  private createAOOverlays() {
    const preset = LOCATION_VISUAL_PRESETS[this.currentMap];
    if (!preset) return;

    this.aoOverlays = [];

    // Global edge darkening to reinforce painted-scene depth.
    const edgeAlpha = this.visualProfile.aoAlpha;
    const top = this.add.rectangle(GAME_WIDTH / 2, 32, GAME_WIDTH, 64, 0x000000, edgeAlpha);
    const bottom = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 32, GAME_WIDTH, 64, 0x000000, edgeAlpha * 0.9);
    const left = this.add.rectangle(32, GAME_HEIGHT / 2, 64, GAME_HEIGHT, 0x000000, edgeAlpha * 0.75);
    const right = this.add.rectangle(GAME_WIDTH - 32, GAME_HEIGHT / 2, 64, GAME_HEIGHT, 0x000000, edgeAlpha * 0.75);

    [top, bottom, left, right].forEach((overlay) => {
      overlay.setDepth(940);
      overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
      overlay.setScrollFactor(0);
      this.aoOverlays.push(overlay);
    });

    preset.aoZones.forEach((zone) => {
      const rect = this.add.rectangle(
        zone.x + zone.width / 2,
        zone.y + zone.height / 2,
        zone.width,
        zone.height,
        0x000000,
        zone.alpha * this.visualProfile.aoAlpha
      );
      rect.setDepth(941);
      rect.setBlendMode(Phaser.BlendModes.MULTIPLY);
      rect.setScrollFactor(0);
      this.aoOverlays.push(rect);
    });
  }

  private createCanopyShadows() {
    const preset = LOCATION_VISUAL_PRESETS[this.currentMap];
    this.canopyShadows.forEach((shadow) => shadow.destroy());
    this.canopyShadows = [];
    if (!preset) return;

    preset.canopyShadows.forEach((zone) => {
      const shadow = this.add.ellipse(
        zone.x + zone.width / 2,
        zone.y + zone.height / 2,
        zone.width,
        zone.height,
        0x000000,
        zone.alpha * this.visualProfile.canopyShadowAlpha
      );
      shadow.setDepth(942);
      shadow.setBlendMode(Phaser.BlendModes.MULTIPLY);
      shadow.setScrollFactor(0);
      this.canopyShadows.push(shadow);
    });
  }

  private createFilmGrainTexture() {
    const textureKey = 'film-grain';
    if (this.textures.exists(textureKey)) return;

    const size = 128;
    const graphics = this.add.graphics({ x: 0, y: 0 });
    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    for (let i = 0; i < 2300; i += 1) {
      graphics.fillRect(
        Phaser.Math.Between(0, size - 1),
        Phaser.Math.Between(0, size - 1),
        1,
        1
      );
    }
    graphics.generateTexture(textureKey, size, size);
    graphics.destroy();
  }

  private createSunShafts() {
    const preset = LOCATION_VISUAL_PRESETS[this.currentMap];
    this.sunShafts.forEach((shaft) => shaft.destroy());
    this.sunShafts = [];
    if (!preset || this.visualProfile.sunShaftCount <= 0) return;

    const count = this.visualProfile.sunShaftCount;
    for (let i = 0; i < count; i += 1) {
      const x = preset.sunAnchor.x + i * 24;
      const y = preset.sunAnchor.y + 140 + i * 20;
      const width = 70 + i * 22;
      const height = 390 + i * 90;
      const shaft = this.add.ellipse(x, y, width, height, preset.hazeTint, this.visualProfile.sunShaftAlpha);
      shaft.setDepth(903 + i);
      shaft.setBlendMode(Phaser.BlendModes.SCREEN);
      shaft.setScrollFactor(0);
      shaft.setAngle(Phaser.Math.Between(-9, 9));
      this.sunShafts.push(shaft);

      this.tweens.add({
        targets: shaft,
        alpha: {
          from: this.visualProfile.sunShaftAlpha * 0.7,
          to: this.visualProfile.sunShaftAlpha * 1.1,
        },
        duration: 2600 + i * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createCinematicLayers() {
    const preset = LOCATION_VISUAL_PRESETS[this.currentMap];
    if (!preset) return;

    this.createFilmGrainTexture();

    if (this.colorGradeMultiplyOverlay) {
      this.colorGradeMultiplyOverlay.destroy();
      this.colorGradeMultiplyOverlay = null;
    }
    if (this.colorGradeScreenOverlay) {
      this.colorGradeScreenOverlay.destroy();
      this.colorGradeScreenOverlay = null;
    }
    if (this.filmGrainOverlay) {
      this.filmGrainOverlay.destroy();
      this.filmGrainOverlay = null;
    }

    this.colorGradeScreenOverlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      preset.hazeTint,
      0
    );
    this.colorGradeScreenOverlay.setScrollFactor(0);
    this.colorGradeScreenOverlay.setDepth(944);
    this.colorGradeScreenOverlay.setBlendMode(Phaser.BlendModes.SCREEN);

    this.colorGradeMultiplyOverlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x2B2014,
      0
    );
    this.colorGradeMultiplyOverlay.setScrollFactor(0);
    this.colorGradeMultiplyOverlay.setDepth(945);
    this.colorGradeMultiplyOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.filmGrainOverlay = this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      'film-grain'
    );
    this.filmGrainOverlay.setScrollFactor(0);
    this.filmGrainOverlay.setDepth(946);
    this.filmGrainOverlay.setBlendMode(Phaser.BlendModes.OVERLAY);
    this.filmGrainOverlay.setTint(0xC2A989);

    this.createSunShafts();
    this.updateCinematicForTime();
  }

  private updateCinematicForTime() {
    const preset = LOCATION_VISUAL_PRESETS[this.currentMap];
    if (!preset) return;

    const grade = TIME_COLOR_GRADE[this.timeOfDay];
    const strength = this.visualProfile.colorGradeStrength;

    if (this.colorGradeMultiplyOverlay) {
      this.colorGradeMultiplyOverlay.setFillStyle(grade.multiply, grade.multiplyAlpha * strength);
    }
    if (this.colorGradeScreenOverlay) {
      this.colorGradeScreenOverlay.setFillStyle(
        this.timeOfDay === 'night' ? grade.screen : preset.hazeTint,
        grade.screenAlpha * strength
      );
    }

    if (this.filmGrainOverlay) {
      const nightBoost = this.timeOfDay === 'night' ? 1.35 : 1;
      this.filmGrainOverlay.setAlpha(this.visualProfile.grainAlpha * nightBoost);
    }

    const showShafts = this.timeOfDay === 'dawn' || this.timeOfDay === 'day' || this.timeOfDay === 'dusk';
    const timeScale = this.timeOfDay === 'day' ? 0.65 : this.timeOfDay === 'dawn' ? 1.05 : 0.85;
    this.sunShafts.forEach((shaft) => {
      shaft.setVisible(showShafts);
      shaft.setAlpha(this.visualProfile.sunShaftAlpha * timeScale);
      shaft.setFillStyle(this.timeOfDay === 'dusk' ? 0xE8B16C : preset.hazeTint, this.visualProfile.sunShaftAlpha * timeScale);
    });
  }

  private createFogLayers() {
    const preset = LOCATION_VISUAL_PRESETS[this.currentMap];
    if (!preset) return;

    this.fogLayers.forEach((layer) => layer.destroy());
    this.fogLayers = [];

    const baseY = GAME_HEIGHT * 0.6;
    const profileFogLayers = this.visualProfile.fogLayers;
    for (let i = 0; i < profileFogLayers; i += 1) {
      const width = GAME_WIDTH * (0.8 + i * 0.2);
      const height = 120 + i * 40;
      const x = Phaser.Math.Between(120, GAME_WIDTH - 120);
      const y = baseY + i * 30;
      const fog = this.add.ellipse(
        x,
        y,
        width,
        height,
        preset.fogTint,
        this.visualProfile.fogBaseAlpha
      );
      fog.setDepth(905 + i);
      fog.setScrollFactor(0);
      fog.setBlendMode(Phaser.BlendModes.SCREEN);
      this.fogLayers.push(fog);

      const drift = (30 + i * 18) * preset.fogSpeed;
      this.tweens.add({
        targets: fog,
        x: x + drift,
        duration: 9000 + i * 2200,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }

    this.updateFogForTime();
  }

  private getFogTimeMultiplier(): number {
    switch (this.timeOfDay) {
      case 'dawn':
        return 1.35;
      case 'day':
        return 0.45;
      case 'dusk':
        return 1;
      case 'night':
        return 1.2;
      default:
        return 1;
    }
  }

  private updateFogForTime() {
    const multiplier = this.getFogTimeMultiplier();
    const baseAlpha = this.visualProfile.fogBaseAlpha * multiplier;
    const visible = multiplier > 0.2;
    const blendMode = this.timeOfDay === 'night' ? Phaser.BlendModes.MULTIPLY : Phaser.BlendModes.SCREEN;

    this.fogLayers.forEach((layer, index) => {
      const alpha = Math.max(0, baseAlpha - index * 0.015);
      layer.setVisible(visible && alpha > 0.01);
      layer.setAlpha(alpha);
      layer.setBlendMode(blendMode);
    });
  }

  private applyVisualProfile() {
    this.visualProfile = VISUAL_PROFILES[this.resolvedVisualQuality];
    useGameStore.getState().setResolvedVisualQuality(this.resolvedVisualQuality);

    if (this.heatHazeEmitter) {
      if (!this.visualProfile.heatHazeEnabled) {
        this.heatHazeEmitter.stop();
      } else if (this.timeOfDay === 'day' || this.timeOfDay === 'dusk') {
        this.heatHazeEmitter.start();
      }
    }

    this.locationLightSources.forEach((light) => light.destroy());
    this.locationLightSources = [];
    this.createLocationLights();

    this.aoOverlays.forEach((overlay) => overlay.destroy());
    this.aoOverlays = [];
    this.createAOOverlays();

    this.createCanopyShadows();
    this.createFogLayers();
    this.createCinematicLayers();

    this.updateParticlesForTime();
    this.updateFogForTime();
    this.updateCinematicForTime();
    this.applyCharacterLighting(true);
  }

  private setVisualQualityMode(mode: VisualQualityMode) {
    this.visualQualityMode = mode;
    this.resolvedVisualQuality = resolveVisualQualityMode(mode, this.resolvedVisualQuality);
    this.applyVisualProfile();
  }

  private setDynamicVisualQuality(enabled: boolean) {
    this.dynamicVisualQualityEnabled = enabled;
    if (!enabled || this.visualQualityMode !== 'auto') return;
    this.resolvedVisualQuality = 'balanced';
    this.applyVisualProfile();
  }

  private downgradeQuality() {
    if (this.resolvedVisualQuality === 'high') {
      this.resolvedVisualQuality = 'balanced';
    } else if (this.resolvedVisualQuality === 'balanced') {
      this.resolvedVisualQuality = 'low';
    }
    this.applyVisualProfile();
  }

  private upgradeQuality() {
    if (this.resolvedVisualQuality === 'low') {
      this.resolvedVisualQuality = 'balanced';
    } else if (this.resolvedVisualQuality === 'balanced') {
      this.resolvedVisualQuality = 'high';
    }
    this.applyVisualProfile();
  }

  private updateAdaptiveQuality(deltaMs: number) {
    this.frameDeltas.push(deltaMs);
    if (this.frameDeltas.length > 90) {
      this.frameDeltas.shift();
    }

    if (!this.dynamicVisualQualityEnabled || this.visualQualityMode !== 'auto') return;
    if (this.frameSampleCooldown > 0) {
      this.frameSampleCooldown -= 1;
      return;
    }
    if (this.frameDeltas.length < 45) return;

    const averageDelta = this.frameDeltas.reduce((sum, value) => sum + value, 0) / this.frameDeltas.length;
    if (averageDelta > 19.5 && this.resolvedVisualQuality !== 'low') {
      this.downgradeQuality();
      this.frameSampleCooldown = 180;
      return;
    }
    if (averageDelta < 14.5 && this.resolvedVisualQuality !== 'high') {
      this.upgradeQuality();
      this.frameSampleCooldown = 220;
    }
  }

  private getObjectiveAnchors() {
    return (objectiveMarkersData as { anchors: Record<string, Record<string, MarkerAnchor>> }).anchors || {};
  }

  private findLocationForAnchorKey(anchorKey: string): string | null {
    const anchors = this.getObjectiveAnchors();
    return Object.keys(anchors).find((locationId) => Boolean(anchors[locationId]?.[anchorKey])) || null;
  }

  private resolveObjectiveMarker(): ObjectiveMarkerDefinition | null {
    const tracked = useQuestStore.getState().getTrackedObjective();
    if (!tracked) return null;

    const objective = tracked.objective;
    const anchors = this.getObjectiveAnchors();
    const npcData = useDialogueStore.getState().allNPCData as Record<string, { location?: string }>;
    const worldItems = (worldItemsData as { 'world-items': Record<string, Array<{ itemId: string; x: number; y: number }>> })['world-items'] || {};

    let locationId: string | null = null;
    let anchorKey: string | null = null;
    let directAnchor: MarkerAnchor | null = null;

    if (['talk', 'give', 'pay'].includes(objective.type) && objective.target) {
      locationId = npcData[objective.target]?.location || null;
      anchorKey = `npc:${objective.target}`;
    } else if (['location', 'go', 'explore'].includes(objective.type) && objective.target) {
      locationId = objective.target;
      anchorKey = `location:${objective.target}`;
    } else if (['search', 'stealth'].includes(objective.type) && objective.target) {
      anchorKey = `poi:${objective.target}`;
      locationId = this.findLocationForAnchorKey(anchorKey);
    } else if (objective.type === 'escort') {
      if (objective.target) {
        anchorKey = `poi:${objective.target}`;
        locationId = this.findLocationForAnchorKey(anchorKey);
      }
      if (!locationId && objective.destination) {
        anchorKey = `location:${objective.destination}`;
        locationId = objective.destination;
      }
    } else if (['obtain', 'find', 'collect'].includes(objective.type)) {
      const itemId = objective.item || objective.target;
      if (itemId) {
        const match = Object.entries(worldItems).find(([, entries]) =>
          entries.some((entry) => entry.itemId === itemId)
        );
        if (match) {
          locationId = match[0];
          const found = match[1].find((entry) => entry.itemId === itemId);
          if (found) {
            directAnchor = { x: found.x, y: found.y };
          }
        }
      }
    }

    if (!locationId) {
      locationId = this.currentMap;
    }

    const locationAnchors = anchors[locationId] || {};
    let anchor: MarkerAnchor | null = directAnchor || (anchorKey ? locationAnchors[anchorKey] || null : null);
    if (!anchor && objective.target) {
      anchor = locationAnchors[`poi:${objective.target}`] || null;
    }

    if (!anchor) {
      anchor = locationAnchors[`location:${locationId}`] || { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
    }

    return {
      questId: tracked.questId,
      objectiveId: objective.id,
      objectiveType: objective.type,
      objectiveText: objective.description,
      locationId,
      anchor,
    };
  }

  private destroyObjectiveMarker() {
    if (!this.objectiveMarker) return;
    this.objectiveMarker.beam.destroy();
    this.objectiveMarker.beacon.destroy();
    this.objectiveMarker.ring.destroy();
    this.objectiveMarker.label.destroy();
    this.objectiveMarker = null;
  }

  private refreshObjectiveMarker(force: boolean = false) {
    const definition = this.resolveObjectiveMarker();
    const signature = definition
      ? `${definition.questId}:${definition.objectiveId}:${definition.locationId}:${definition.anchor.x}:${definition.anchor.y}`
      : 'none';

    if (!force && signature === this.lastObjectiveSignature) {
      return;
    }

    this.lastObjectiveSignature = signature;

    if (!definition || definition.locationId !== this.currentMap) {
      this.destroyObjectiveMarker();
      return;
    }

    this.destroyObjectiveMarker();

    const beam = this.add.ellipse(
      definition.anchor.x,
      definition.anchor.y - 46,
      20,
      94,
      0xF0D9A1,
      0.12 * this.visualProfile.colorGradeStrength
    );
    beam.setDepth(988);
    beam.setBlendMode(Phaser.BlendModes.SCREEN);

    const ring = this.add.circle(definition.anchor.x, definition.anchor.y + 2, 18, 0xD4AF37, 0.22);
    ring.setStrokeStyle(2, 0xF4B41A, 0.75);
    ring.setDepth(989);

    const beacon = this.add.circle(definition.anchor.x, definition.anchor.y - 22, 7, 0xFFD36A, 0.9);
    beacon.setDepth(990);
    beacon.setBlendMode(Phaser.BlendModes.ADD);

    const label = this.add.text(definition.anchor.x, definition.anchor.y - 38, 'Objective', {
      font: '11px Cinzel, Georgia, serif',
      color: '#F4E6BE',
      stroke: '#000000',
      strokeThickness: 2,
    });
    label.setOrigin(0.5, 1);
    label.setDepth(991);

    this.objectiveMarker = { definition, beam, beacon, ring, label };
  }

  private updateObjectiveMarker() {
    this.refreshObjectiveMarker(false);
    if (!this.objectiveMarker) return;

    this.objectiveMarker.beam.setAlpha(0.08 + Math.sin(this.time.now / 260) * 0.03);
    const pulse = 1 + Math.sin(this.time.now / 220) * 0.12;
    this.objectiveMarker.ring.setScale(pulse);
    this.objectiveMarker.beacon.setScale(1 + Math.sin(this.time.now / 180) * 0.08);
  }

  private setupCamera() {
    // Reset zoom in case we arrived via a transition that zoomed in
    this.cameras.main.setZoom(1.0);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    if (this.isIsometric && this.isoRenderer) {
      const bounds = this.isoRenderer.getWorldBounds();
      this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    } else {
      this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.keys = {
      space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      i: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I),
      j: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      esc: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      f6: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F6),
      f7: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F7),
      f8: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F8),
      f9: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F9),
      f10: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F10),
      t: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T),
      y: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Y),
    };

    // Space for interaction
    this.keys.space.on('down', () => {
      if (!this.isAnyUIOpen()) {
        this.tryInteract();
      }
    });

    // I for inventory toggle (emit to React)
    this.keys.i.on('down', () => {
      emitGameEvent('ui:inventory:toggle');
    });

    // J for journal toggle (emit to React)
    this.keys.j.on('down', () => {
      emitGameEvent('ui:journal:toggle');
    });

    // ESC for pause (emit to React)
    this.keys.esc.on('down', () => {
      emitGameEvent('ui:pause:toggle');
    });

    if (import.meta.env.DEV) {
      const locations = ['a-famosa-gate', 'rua-direita', 'st-pauls-church', 'waterfront', 'kampung'];
      [this.keys.f6, this.keys.f7, this.keys.f8, this.keys.f9, this.keys.f10].forEach((key, index) => {
        key.on('down', () => {
          if (!this.isAnyUIOpen()) {
            this.switchLocation(locations[index]);
          }
        });
      });

      this.keys.t.on('down', () => {
        if (!this.isAnyUIOpen()) {
          this.advanceTime(3);
        }
      });

      this.keys.y.on('down', () => {
        if (!this.isAnyUIOpen()) {
          this.advanceTime(-3);
        }
      });
    }
  }

  private setupReactBridge() {
    this.cleanupBridgeListeners();

    const on = (event: string, callback: (...args: unknown[]) => void) => {
      this.bridgeUnsubscribers.push(eventBridge.on(event, callback));
    };

    // Listen for UI events from React
    on('ui:inventory:toggle', () => {
      useGameStore.getState().toggleInventory();
    });

    on('ui:journal:toggle', () => {
      useGameStore.getState().toggleJournal();
    });

    on('ui:pause:toggle', () => {
      useGameStore.getState().togglePause();
    });

    on('ui:dialogue:close', () => {
      useGameStore.getState().setDialogueOpen(false);
      this.stopDialogueAnimation();
    });

    on('ui:topic:select', (...args: unknown[]) => {
      // Topic selection handled by dialogueStore
      const topicKey = args[0] as string;
      console.log('Topic selected:', topicKey);

      // Play dialogue sound effect
      this.playSfx('sfx-dialogue-blip', 0.28);
    });

    on('ui:travel:to', (...args: unknown[]) => {
      if (!import.meta.env.DEV) return;
      const targetLocation = args[0] as string;
      if (!targetLocation || typeof targetLocation !== 'string') return;
      if (this.isAnyUIOpen()) return;
      this.switchLocation(targetLocation);
    });

    on('settings:music:volume', (...args: unknown[]) => {
      const volume = args[0] as number;
      if (typeof volume !== 'number') return;
      this.updateMusicVolume(volume);
    });

    on('settings:sfx:volume', (...args: unknown[]) => {
      const volume = args[0] as number;
      if (typeof volume !== 'number') return;
      useGameStore.getState().setSfxVolume(volume);
    });

    on('settings:ambient:volume', (...args: unknown[]) => {
      const volume = args[0] as number;
      if (typeof volume !== 'number') return;
      this.updateAmbientVolumes(volume);
    });

    on('settings:visual:mode', (...args: unknown[]) => {
      const mode = args[0] as VisualQualityMode;
      this.setVisualQualityMode(mode);
    });

    on('settings:visual:dynamic', (...args: unknown[]) => {
      this.setDynamicVisualQuality(Boolean(args[0]));
    });

    // Listen for quest events to provide feedback
    on('quest:start', (...args: unknown[]) => {
      const questId = args[0] as string;
      console.log('Quest started in Phaser:', questId);

      // Show quest notification
      this.showNotification('New Quest Started');
    });

    on('item:pickup', (...args: unknown[]) => {
      const itemId = args[0] as string;
      const itemName = args[1] as string;
      console.log('Item picked up in Phaser:', itemId);

      // Show pickup notification
      this.showNotification(`Acquired: ${itemName}`);

      // Play pickup sound
      this.playSfx('sfx-item-pickup', 0.38);
    });

    on('dialogue:item:given', () => {
      this.playSfx('sfx-item-pickup', 0.2);
    });

    on('dialogue:money:paid', () => {
      this.playSfx('sfx-coin-clink', 0.34);
    });
  }

  private cleanupBridgeListeners() {
    this.bridgeUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.bridgeUnsubscribers = [];
  }

  private cleanup() {
    // Clean up atmosphere systems
    this.crowdSystem?.destroy();
    this.crowdSystem = null;
    this.weatherSystem?.destroy();
    this.weatherSystem = null;
    this.environmentObjects?.destroy();
    this.environmentObjects = null;

    // Clean up isometric renderer
    if (this.isoRenderer) {
      this.isoRenderer.destroy();
      this.isoRenderer = null;
    }
    this.isIsometric = false;

    this.stopLocationAudio();
    this.stopDialogueAnimation();
    this.cleanupBridgeListeners();
    this.destroyObjectiveMarker();
    this.lastObjectiveSignature = null;
    this.npcShadowMap.forEach((shadow) => shadow.destroy());
    this.npcShadowMap.clear();
    this.locationLightSources.forEach((glow) => glow.destroy());
    this.locationLightSources = [];
    this.fogLayers.forEach((layer) => layer.destroy());
    this.fogLayers = [];
    this.aoOverlays.forEach((overlay) => overlay.destroy());
    this.aoOverlays = [];
    this.canopyShadows.forEach((shadow) => shadow.destroy());
    this.canopyShadows = [];
    this.sunShafts.forEach((shaft) => shaft.destroy());
    this.sunShafts = [];
    if (this.dustEmitter) {
      this.dustEmitter.destroy();
    }
    if (this.heatHazeEmitter) {
      this.heatHazeEmitter.destroy();
    }
    if (this.fireflyEmitter) {
      this.fireflyEmitter.destroy();
      this.fireflyEmitter = null;
    }
    if (this.mistEmitter) {
      this.mistEmitter.destroy();
      this.mistEmitter = null;
    }
    if (this.waterEmitter) {
      this.waterEmitter.destroy();
      this.waterEmitter = null;
    }
    this.fireEmitters.forEach((emitter) => emitter.destroy());
    this.fireEmitters = [];
    if (this.colorGradeMultiplyOverlay) {
      this.colorGradeMultiplyOverlay.destroy();
      this.colorGradeMultiplyOverlay = null;
    }
    if (this.colorGradeScreenOverlay) {
      this.colorGradeScreenOverlay.destroy();
      this.colorGradeScreenOverlay = null;
    }
    if (this.filmGrainOverlay) {
      this.filmGrainOverlay.destroy();
      this.filmGrainOverlay = null;
    }
    this.frameDeltas = [];
    this.frameSampleCooldown = 0;
    this.lastCharacterLightingSignature = null;
    if (this.playerShadow) {
      this.playerShadow.destroy();
      this.playerShadow = null;
    }
    this.worldItems.forEach((item) => {
      item.sprite.destroy();
      item.glow.destroy();
      item.marker.destroy();
      item.label.destroy();
    });
    this.worldItems = [];
    this.loreObjects.forEach((obj) => {
      obj.sprite.destroy();
      obj.glow.destroy();
      obj.marker.destroy();
      obj.label.destroy();
    });
    this.loreObjects = [];
    this.transitionHotspots.forEach((hotspot) => {
      hotspot.glow.destroy();
      hotspot.marker.destroy();
      hotspot.label.destroy();
    });
    this.transitionHotspots = [];
    this.questHotspots.forEach((hotspot) => {
      hotspot.glow.destroy();
      hotspot.marker.destroy();
      hotspot.labelText.destroy();
    });
    this.questHotspots = [];
    if (this.interactionPrompt) {
      this.interactionPrompt.destroy();
      this.interactionPrompt = null;
    }
    this.activeInteractionTarget = null;
    this.npcs = [];
    this.npcDataMap.clear();
    this.npcSpriteById.clear();
    this.npcAnimationPrefixMap.clear();
    this.npcFacingMap.clear();
    this.activeDialogueNpc = null;
  }

  private getNpcDirectionToPlayer(npc: Phaser.Physics.Arcade.Sprite): 'up' | 'down' | 'left' | 'right' {
    const dx = this.player.x - npc.x;
    const dy = this.player.y - npc.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? 'left' : 'right';
    }
    return dy < 0 ? 'up' : 'down';
  }

  private setNpcFacing(
    npc: Phaser.Physics.Arcade.Sprite,
    direction: 'up' | 'down' | 'left' | 'right'
  ) {
    const currentFacing = this.npcFacingMap.get(npc);
    if (currentFacing === direction) return;

    this.npcFacingMap.set(npc, direction);

    const npcData = this.npcDataMap.get(npc);
    const animationPrefix = this.npcAnimationPrefixMap.get(npc) || npcData?.id;
    if (!npcData) return;

    if (this.activeDialogueNpc === npc) {
      const talkKey = `${animationPrefix}-talk-${direction}`;
      if (this.anims.exists(talkKey)) {
        npc.play(talkKey, true);
      }
      return;
    }

    const idleKey = `${animationPrefix}-idle-${direction}`;
    if (this.anims.exists(idleKey)) {
      npc.play(idleKey, true);
    }
  }

  private stopDialogueAnimation() {
    if (!this.activeDialogueNpc) return;

    const npcData = this.npcDataMap.get(this.activeDialogueNpc);
    if (npcData) {
      const facing = this.npcFacingMap.get(this.activeDialogueNpc) || 'down';
      const animationPrefix = this.npcAnimationPrefixMap.get(this.activeDialogueNpc) || npcData.id;
      const idleKey = `${animationPrefix}-idle-${facing}`;
      if (this.anims.exists(idleKey)) {
        this.activeDialogueNpc.play(idleKey, true);
      }
    }

    this.activeDialogueNpc = null;
  }

  private showNotification(text: string) {
    const notification = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.2,
      text,
      {
        font: 'bold 18px Cinzel, Georgia, serif',
        color: '#F4B41A',
        stroke: '#000000',
        strokeThickness: 3,
      }
    );
    notification.setOrigin(0.5, 0.5);
    notification.setScrollFactor(0);
    notification.setDepth(1002);
    notification.setAlpha(0);

    // Animate in and out
    this.tweens.add({
      targets: notification,
      alpha: 1,
      y: GAME_HEIGHT * 0.15,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: notification,
            alpha: 0,
            y: GAME_HEIGHT * 0.1,
            duration: 400,
            onComplete: () => notification.destroy(),
          });
        });
      },
    });
  }

  private createLighting() {
    this.lightingOverlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0
    );
    this.lightingOverlay.setDepth(950);
    this.lightingOverlay.setScrollFactor(0);

    // Apply initial time-based lighting
    this.updateTimeOfDay();
    this.applyLightingForTime(false);
  }

  private updateTimeOfDay() {
    const hour = this.currentHour;
    let newTime: typeof this.timeOfDay;

    if (hour >= TIME_RANGES.dawn.start && hour < TIME_RANGES.dawn.end) {
      newTime = 'dawn';
    } else if (hour >= TIME_RANGES.day.start && hour < TIME_RANGES.dusk.start) {
      newTime = 'day';
    } else if (hour >= TIME_RANGES.dusk.start && hour < TIME_RANGES.night.start) {
      newTime = 'dusk';
    } else {
      newTime = 'night';
    }

    if (newTime !== this.timeOfDay) {
      const previousTime = this.timeOfDay;
      this.timeOfDay = newTime;
      this.applyLightingForTime(true);
      this.updateParticlesForTime();
      this.updateBackgroundForTime();
      this.updateLocationLightsForTime();
      this.updateFogForTime();
      this.updateCinematicForTime();
      this.applyCharacterLighting(true);
      this.syncLocationAudio();

      // Update atmosphere systems with new time
      this.crowdSystem?.setTimeOfDay(newTime);
      this.weatherSystem?.setTimeOfDay(newTime);
      this.environmentObjects?.setTimeOfDay(newTime);

      console.log(`Time changed: ${previousTime} → ${newTime} (hour: ${hour})`);
    }
  }

  private applyLightingForTime(animate: boolean = true) {
    if (this.isTransitioningTime) return;

    const config = TIME_COLORS[this.timeOfDay];

    if (animate) {
      this.isTransitioningTime = true;

      // Smooth transition to new lighting
      this.tweens.add({
        targets: this.lightingOverlay,
        alpha: config.alpha,
        duration: 2000,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.isTransitioningTime = false;
        }
      });

      // We need to transition the fill color too
      // Create a temporary overlay for crossfade
      const transitionOverlay = this.add.rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        config.color,
        0
      );
      transitionOverlay.setDepth(949);
      transitionOverlay.setScrollFactor(0);

      this.tweens.add({
        targets: transitionOverlay,
        alpha: config.alpha,
        duration: 2000,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          // Update the main overlay and destroy transition
          this.lightingOverlay.setFillStyle(config.color, config.alpha);
          transitionOverlay.destroy();
        }
      });
    } else {
      // Immediate application
      this.lightingOverlay.setFillStyle(config.color, config.alpha);
    }
  }

  private advanceTime(hours: number) {
    const previousHour = this.currentHour;
    const currentDay = useGameStore.getState().time.day;
    const rawHour = previousHour + hours;
    const dayDelta = Math.floor(rawHour / 24);
    const normalizedHour = ((rawHour % 24) + 24) % 24;

    this.currentHour = normalizedHour;
    this.updateTimeOfDay();

    // Update game store with new time
    const nextDay = Math.max(1, currentDay + dayDelta);
    useGameStore.getState().updateTime({
      hour: this.currentHour,
      day: nextDay,
      timeOfDay: this.timeOfDay
    });

    if (dayDelta > 0) {
      emitGameEvent('time:day-passed', dayDelta, nextDay);
    }

    // Show time notification
    const timeNames: Record<typeof this.timeOfDay, string> = {
      dawn: 'Dawn',
      day: 'Day',
      dusk: 'Golden Hour',
      night: 'Night'
    };
    this.showNotification(`Time: ${this.currentHour}:00 - ${timeNames[this.timeOfDay]}`);
  }

  private updateLocationState() {
    const name = getLocationName(this.currentMap);
    const gameStore = useGameStore.getState();
    gameStore.updatePlayer({
      x: this.player.x,
      y: this.player.y,
      location: this.currentMap,
    });
    gameStore.setLocation(this.currentMap, name);
    emitGameEvent('player:location', this.currentMap, name);
  }

  private createInteractionPrompt() {
    this.interactionPrompt = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 28,
      '',
      {
        font: 'bold 16px Cinzel, Georgia, serif',
        color: '#F4E6C8',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        backgroundColor: 'rgba(26, 14, 7, 0.78)',
        padding: { x: 10, y: 6 },
      }
    );
    this.interactionPrompt.setOrigin(0.5, 1);
    this.interactionPrompt.setScrollFactor(0);
    this.interactionPrompt.setDepth(1002);
    this.interactionPrompt.setVisible(false);
  }

  private setInteractionPrompt(text: string | null, type?: InteractionTargetType) {
    if (!this.interactionPrompt) return;

    if (!text) {
      this.interactionPrompt.setVisible(false);
      return;
    }

    const promptStyle = {
      npc: { color: '#F4E6C8', backgroundColor: 'rgba(64, 38, 16, 0.78)' },
      item: { color: '#FFE19E', backgroundColor: 'rgba(81, 53, 10, 0.82)' },
      quest: { color: '#F4D66A', backgroundColor: 'rgba(89, 61, 12, 0.84)' },
      transition: { color: '#BEE7FF', backgroundColor: 'rgba(16, 41, 56, 0.82)' },
      lore: { color: '#E7D7B4', backgroundColor: 'rgba(56, 42, 25, 0.82)' },
    }[type || 'npc'];

    this.interactionPrompt.setText(text);
    this.interactionPrompt.setStyle({
      color: promptStyle.color,
      backgroundColor: promptStyle.backgroundColor,
    });
    this.interactionPrompt.setVisible(true);
  }

  private resolveWorldItemSpriteKey(itemId: string): string {
    const iconKey = `item-${itemId}`;
    if (this.textures.exists(iconKey)) {
      return iconKey;
    }

    const itemType = ITEM_DEFINITIONS[itemId]?.type;
    return this.resolveGameplaySpriteKey(
      (itemType && WORLD_ITEM_TYPE_FALLBACKS[itemType]) || 'crate'
    );
  }

  private getWorldItemScale(spriteKey: string): number {
    return spriteKey.startsWith('item-') ? 2.5 : 3;
  }

  private getFacingVector(): Phaser.Math.Vector2 {
    const facing = useGameStore.getState().player.facing;
    switch (facing) {
      case 'up':
        return new Phaser.Math.Vector2(0, -1);
      case 'left':
        return new Phaser.Math.Vector2(-1, 0);
      case 'right':
        return new Phaser.Math.Vector2(1, 0);
      case 'down':
      default:
        return new Phaser.Math.Vector2(0, 1);
    }
  }

  private getDirectionBetween(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): 'up' | 'down' | 'left' | 'right' {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? 'left' : 'right';
    }
    return dy < 0 ? 'up' : 'down';
  }

  private setPlayerFacing(direction: 'up' | 'down' | 'left' | 'right') {
    useGameStore.getState().updatePlayer({ facing: direction });

    const idleKey = `idle-${direction}`;
    if (
      this.anims.exists(idleKey)
      && this.player.body
      && this.player.body.velocity.lengthSq() < 9
      && this.player.anims.currentAnim?.key !== idleKey
    ) {
      this.player.play(idleKey);
    }
  }

  private scoreInteractionTarget(
    x: number,
    y: number,
    maxDistance: number
  ): { distance: number; score: number } | null {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    if (distance > maxDistance) return null;

    const direction = new Phaser.Math.Vector2(x - this.player.x, y - this.player.y);
    if (direction.lengthSq() === 0) {
      return { distance, score: 0 };
    }

    direction.normalize();
    const alignment = direction.dot(this.getFacingVector());
    if (alignment < -0.35 && distance > 44) return null;

    const facingBias = Phaser.Math.Clamp(alignment, -1, 1) * 28;
    const closeBonus = distance < 52 ? 14 : 0;
    return {
      distance,
      score: distance - facingBias - closeBonus,
    };
  }

  private findBestInteractionTarget(): InteractionCandidate | null {
    const candidates: InteractionCandidate[] = [];

    for (const npc of this.npcs) {
      const npcData = this.npcDataMap.get(npc);
      if (!npcData) continue;
      const scored = this.scoreInteractionTarget(npc.x, npc.y, 90);
      if (!scored) continue;

      candidates.push({
        type: 'npc',
        id: npcData.id,
        label: `Talk to ${npcData.name}`,
        x: npc.x,
        y: npc.y,
        priority: 0,
        score: scored.score,
        interact: () => this.startDialogue(npcData),
      });
    }

    for (const item of this.worldItems) {
      const scored = this.scoreInteractionTarget(item.anchorX, item.anchorY, 86);
      if (!scored) continue;
      const itemName = ITEM_DEFINITIONS[item.itemId]?.name || item.itemId;

      candidates.push({
        type: 'item',
        id: item.id,
        label: `Take ${itemName}`,
        x: item.anchorX,
        y: item.anchorY,
        priority: 1,
        score: scored.score,
        interact: () => {
          const itemIndex = this.worldItems.findIndex((entry) => entry.id === item.id);
          if (itemIndex < 0) return;

          const worldItem = this.worldItems[itemIndex];
          emitGameEvent('item:pickup', worldItem.itemId, itemName);
          emitGameEvent('item:examine', worldItem.itemId, worldItem.description);
          this.showNotification(`Found: ${itemName}`);

          worldItem.sprite.destroy();
          worldItem.glow.destroy();
          worldItem.marker.destroy();
          worldItem.label.destroy();
          this.worldItems.splice(itemIndex, 1);
        },
      });
    }

    for (const hotspot of this.questHotspots) {
      if (!hotspot.isAvailable()) continue;
      const scored = this.scoreInteractionTarget(hotspot.x, hotspot.y, hotspot.radius);
      if (!scored) continue;

      candidates.push({
        type: 'quest',
        id: hotspot.id,
        label: hotspot.label,
        x: hotspot.x,
        y: hotspot.y,
        priority: 1,
        score: scored.score,
        interact: hotspot.onInteract,
      });
    }

    for (const hotspot of this.transitionHotspots) {
      const x = hotspot.config.triggerArea.x + (hotspot.config.triggerArea.width / 2);
      const y = hotspot.config.triggerArea.y + (hotspot.config.triggerArea.height / 2);
      const withinArea = Phaser.Geom.Rectangle.Contains(
        new Phaser.Geom.Rectangle(
          hotspot.config.triggerArea.x,
          hotspot.config.triggerArea.y,
          hotspot.config.triggerArea.width,
          hotspot.config.triggerArea.height
        ),
        this.player.x,
        this.player.y
      );
      const scored = withinArea ? { distance: 0, score: -100 } : this.scoreInteractionTarget(x, y, 96);
      if (!scored) continue;

      candidates.push({
        type: 'transition',
        id: hotspot.config.targetLocation,
        label: `Travel to ${getLocationName(hotspot.config.targetLocation)}`,
        x,
        y,
        priority: withinArea ? 0 : 3,
        score: scored.score,
        interact: () => this.switchLocation(hotspot.config.targetLocation, hotspot.config.spawnAt),
      });
    }

    for (const obj of this.loreObjects) {
      const scored = this.scoreInteractionTarget(obj.anchorX, obj.anchorY, 82);
      if (!scored) continue;

      candidates.push({
        type: 'lore',
        id: obj.id,
        label: `Examine ${obj.name}`,
        x: obj.anchorX,
        y: obj.anchorY,
        priority: 2,
        score: scored.score,
        interact: () => emitGameEvent('message:show', obj.name, obj.description),
      });
    }

    return candidates.sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      return left.score - right.score;
    })[0] || null;
  }

  private updateInteractionTarget() {
    this.activeInteractionTarget = this.findBestInteractionTarget();
    this.setInteractionPrompt(
      this.activeInteractionTarget ? `[Space] ${this.activeInteractionTarget.label}` : null,
      this.activeInteractionTarget?.type
    );
  }

  private showLocationName() {
    const name = getLocationName(this.currentMap);

    const titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 3, name, {
      font: 'bold 32px Cinzel, Georgia, serif',
      color: '#F4B41A',
      stroke: '#000000',
      strokeThickness: 3,
    });
    titleText.setOrigin(0.5, 0.5);
    titleText.setScrollFactor(0);
    titleText.setDepth(1001);
    titleText.setAlpha(0);

    // Fade in then out
    this.tweens.add({
      targets: titleText,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: titleText,
            alpha: 0,
            duration: 1000,
            onComplete: () => titleText.destroy(),
          });
        });
      },
    });
  }

  private isAnyUIOpen(): boolean {
    const state = useGameStore.getState();
    return state.isDialogueOpen || state.isInventoryOpen || state.isJournalOpen || state.isMessageOpen || state.isPaused;
  }

  private tryInteract() {
    const candidate = this.activeInteractionTarget || this.findBestInteractionTarget();
    if (!candidate) return;

    if (candidate.type !== 'transition') {
      this.setPlayerFacing(this.getDirectionBetween(this.player.x, this.player.y, candidate.x, candidate.y));
    }

    candidate.interact();
  }

  private startDialogue(npcData: NPCData) {
    this.stopDialogueAnimation();
    this.player.setVelocity(0, 0);

    const npc = this.npcSpriteById.get(npcData.id);
    if (npc) {
      this.setPlayerFacing(this.getDirectionBetween(this.player.x, this.player.y, npc.x, npc.y));
      const direction = this.getNpcDirectionToPlayer(npc);
      this.npcFacingMap.set(npc, direction);
      const animationPrefix = this.npcAnimationPrefixMap.get(npc) || npcData.id;
      const talkKey = `${animationPrefix}-talk-${direction}`;
      if (this.anims.exists(talkKey)) {
        npc.play(talkKey, true);
      }
      this.activeDialogueNpc = npc;
    }

    this.activeInteractionTarget = null;
    this.setInteractionPrompt(null);

    // Emit dialogue event to React
    emitGameEvent('dialogue:start', {
      id: npcData.id,
      name: npcData.name,
      title: npcData.title,
      portrait: `portrait-${npcData.id}`,
      dialogue: npcData.dialogue,
    });

    // Update game store
    useGameStore.getState().setDialogueOpen(true);
  }

  // Location-specific tint colors for transition flash [R, G, B]
  private static readonly LOCATION_TINT: Record<string, number[]> = {
    'a-famosa-gate': [40, 30, 20],
    'rua-direita': [50, 40, 10],
    'st-pauls-church': [30, 30, 40],
    'waterfront': [10, 30, 50],
    'kampung': [10, 40, 15],
  };

  // Location-specific transition sound keys
  private static readonly TRANSITION_SOUNDS: Record<string, string> = {
    'a-famosa-gate': 'sfx-gate-creak',
    'rua-direita': 'sfx-crowd-murmur',
    'st-pauls-church': 'sfx-wind-hilltop',
    'waterfront': 'sfx-waves-crash',
    'kampung': 'sfx-birds-tropical',
  };

  private switchLocation(mapKey: string, spawnPoint?: { x: number; y: number }) {
    if (mapKey === this.currentMap) return;

    console.log('Switching to:', mapKey);

    // Location-specific color tint flash before fade-to-black
    const tint = GameScene.LOCATION_TINT[mapKey] || [0, 0, 0];
    const tintOverlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      Phaser.Display.Color.GetColor(tint[0], tint[1], tint[2]), 0
    );
    tintOverlay.setDepth(9998);
    tintOverlay.setScrollFactor(0);

    // Flash tint in, then fade to black
    this.tweens.add({
      targets: tintOverlay,
      alpha: 0.3,
      duration: 100,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.cameras.main.fadeOut(300, 0, 0, 0);
      },
    });

    // Subtle camera zoom during transition
    this.cameras.main.zoomTo(1.05, 200);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      tintOverlay.destroy();

      // Play location-specific transition sound if available
      const sfxKey = GameScene.TRANSITION_SOUNDS[mapKey];
      if (sfxKey && this.cache.audio.exists(sfxKey)) {
        this.sound.play(sfxKey, { volume: 0.4 });
      }

      // Emit scene change event
      emitGameEvent('scene:change', mapKey);

      // Restart scene with new map
      this.scene.restart({ mapKey, spawnPoint });
    });
  }

  update(time: number, delta: number) {
    this.updateAdaptiveQuality(this.game.loop.delta);
    this.updateObjectiveMarker();
    this.updateCinematicMotion();
    this.updateCharacterShadows();

    // Update atmosphere systems
    this.crowdSystem?.update(time, delta);
    this.weatherSystem?.update(time, delta);
    this.environmentObjects?.update(time, delta);

    // Don't update if UI is open
    if (this.isAnyUIOpen()) {
      this.player.setVelocity(0, 0);
      this.activeInteractionTarget = null;
      this.setInteractionPrompt(null);
      return;
    }

    // Player movement
    this.updatePlayerMovement();
    this.updateInteractionTarget();

    // Dynamic depth sorting in isometric mode
    if (this.isIsometric) {
      this.player.setDepth(this.player.y);
      this.npcs.forEach((npc) => {
        npc.setDepth(npc.y);
        const shadow = this.npcShadowMap.get(npc);
        if (shadow) shadow.setDepth(npc.y - 1);
      });
    }

    // Update NPC indicators
    this.updateNPCIndicators();
    this.updateWorldItemIndicators();
    this.updateHotspotIndicators();

    // Update player position in store
    useGameStore.getState().updatePlayer({
      x: this.player.x,
      y: this.player.y,
    });
  }

  private updatePlayerMovement() {
    let velocityX = 0;
    let velocityY = 0;

    // Arrow keys or WASD
    if (this.cursors.left.isDown || this.keys.a.isDown) {
      velocityX = -PLAYER_SPEED;
    } else if (this.cursors.right.isDown || this.keys.d.isDown) {
      velocityX = PLAYER_SPEED;
    }

    if (this.cursors.up.isDown || this.keys.w.isDown) {
      velocityY = -PLAYER_SPEED;
    } else if (this.cursors.down.isDown || this.keys.s.isDown) {
      velocityY = PLAYER_SPEED;
    }

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    const hasInput = velocityX !== 0 || velocityY !== 0;
    let targetVelocityX = velocityX;
    let targetVelocityY = velocityY;

    // In isometric mode, rotate input 45° so WASD aligns with diamond axes
    if (this.isIsometric) {
      targetVelocityX = velocityX - velocityY;
      targetVelocityY = (velocityX + velocityY) * 0.5;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      const blend = hasInput ? 0.28 : 0.34;
      let nextVelocityX = Phaser.Math.Linear(body.velocity.x, targetVelocityX, blend);
      let nextVelocityY = Phaser.Math.Linear(body.velocity.y, targetVelocityY, blend);

      if (!hasInput && Math.abs(nextVelocityX) < 6) nextVelocityX = 0;
      if (!hasInput && Math.abs(nextVelocityY) < 6) nextVelocityY = 0;

      this.player.setVelocity(nextVelocityX, nextVelocityY);
      this.updateFootstepAudio(nextVelocityX, nextVelocityY);
    } else {
      this.player.setVelocity(targetVelocityX, targetVelocityY);
      this.updateFootstepAudio(targetVelocityX, targetVelocityY);
    }

    // Update animation
    if (hasInput) {
      let direction = 'down';
      if (Math.abs(velocityX) > Math.abs(velocityY)) {
        direction = velocityX < 0 ? 'left' : 'right';
      } else {
        direction = velocityY < 0 ? 'up' : 'down';
      }

      const animKey = `walk-${direction}`;
      if (this.anims.exists(animKey) && this.player.anims.currentAnim?.key !== animKey) {
        this.player.play(animKey);
      }

      this.setPlayerFacing(direction as 'up' | 'down' | 'left' | 'right');
    } else {
      // Idle
      const direction = useGameStore.getState().player.facing;
      const idleKey = `idle-${direction}`;
      if (this.anims.exists(idleKey) && this.player.anims.currentAnim?.key !== idleKey) {
        this.player.play(idleKey);
      }
    }
  }

  private normalizeAmbientLayers(layers?: Array<string | AmbientLayerConfig>): AmbientLayerConfig[] {
    if (!layers || layers.length === 0) return [];

    const deduped = new Map<string, AmbientLayerConfig>();
    layers.forEach((layer) => {
      if (typeof layer === 'string') {
        deduped.set(layer, { key: layer });
        return;
      }

      if (!layer?.key) return;
      deduped.set(layer.key, layer);
    });

    return [...deduped.values()];
  }

  private getSceneAudioConfig() {
    const fallback = DEFAULT_LOCATION_AUDIO[this.currentMap] || {
      music: 'music-main',
      nightMusic: 'music-night',
      ambientSounds: [{ key: 'base-tropical', volume: 0.25 }],
      nightAmbientSounds: [{ key: 'base-tropical', volume: 0.18 }, { key: 'night-insects', volume: 0.2 }],
      footstepSurface: 'stone' as FootstepSurface,
    };

    return {
      music: this.sceneConfig?.music || fallback.music,
      nightMusic: this.sceneConfig?.nightMusic || fallback.nightMusic || this.sceneConfig?.music || fallback.music,
      ambientSounds: this.normalizeAmbientLayers(this.sceneConfig?.ambientSounds).length > 0
        ? this.normalizeAmbientLayers(this.sceneConfig?.ambientSounds)
        : fallback.ambientSounds,
      nightAmbientSounds: this.normalizeAmbientLayers(this.sceneConfig?.nightAmbientSounds).length > 0
        ? this.normalizeAmbientLayers(this.sceneConfig?.nightAmbientSounds)
        : fallback.nightAmbientSounds,
      footstepSurface: this.sceneConfig?.footstepSurface || fallback.footstepSurface,
    };
  }

  private getTimeAmbientLayers(): AmbientLayerConfig[] {
    switch (this.timeOfDay) {
      case 'dawn':
        return [{ key: 'morning-birds', volume: 0.18 }];
      case 'dusk':
        return [{ key: 'evening-calls', volume: 0.15 }];
      case 'night':
        return [
          { key: 'night-insects', volume: 0.2 },
          { key: 'cricket-chorus', volume: 0.18 },
        ];
      default:
        return [];
    }
  }

  private getAmbientTargetVolume(layer: AmbientLayerConfig): number {
    const baseVolume = layer.volume ?? 0.25;
    return baseVolume * useGameStore.getState().ambientVolume;
  }

  private syncLocationAudio(force: boolean = false) {
    const audio = this.getSceneAudioConfig();
    const isDark = this.timeOfDay === 'night' || this.timeOfDay === 'dusk';
    const targetMusicKey = isDark ? audio.nightMusic : audio.music;
    const ambientLayers = [
      ...(isDark ? audio.nightAmbientSounds : audio.ambientSounds),
      ...this.getTimeAmbientLayers(),
    ];

    this.syncMusicTrack(targetMusicKey, force);
    this.syncAmbientLayers(ambientLayers, force);
  }

  private syncMusicTrack(trackKey: string | null, force: boolean = false) {
    const targetVolume = useGameStore.getState().musicVolume;

    if (!trackKey || !this.cache.audio.exists(trackKey)) {
      this.stopCurrentMusic();
      return;
    }

    if (!force && this.currentMusicKey === trackKey && this.currentMusic) {
      this.setSoundVolume(this.currentMusic, targetVolume);
      return;
    }

    const previousTrack = this.currentMusic;
    this.currentMusic = this.sound.add(trackKey, {
      loop: true,
      volume: 0,
    });
    this.currentMusicKey = trackKey;
    this.currentMusic.play();

    this.tweens.add({
      targets: this.currentMusic,
      volume: targetVolume,
      duration: force ? 600 : 1200,
      ease: 'Sine.easeInOut',
    });

    if (previousTrack) {
      const fadingTrack = previousTrack;
      this.tweens.add({
        targets: fadingTrack,
        volume: 0,
        duration: 900,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          fadingTrack.stop();
          fadingTrack.destroy();
        },
      });
    }
  }

  private syncAmbientLayers(targetLayers: AmbientLayerConfig[], force: boolean = false) {
    const uniqueLayers = this.normalizeAmbientLayers(targetLayers);
    const targetKeys = new Set(uniqueLayers.map((layer) => layer.key));

    this.ambientLayers.forEach((sound, key) => {
      if (targetKeys.has(key)) return;
      this.fadeOutAmbientLayer(key, sound);
    });

    uniqueLayers.forEach((layer) => {
      if (!this.cache.audio.exists(layer.key)) return;

      this.ambientBaseVolumes.set(layer.key, layer.volume ?? 0.25);
      const targetVolume = this.getAmbientTargetVolume(layer);
      const existing = this.ambientLayers.get(layer.key);

      if (existing) {
        this.tweens.add({
          targets: existing,
          volume: targetVolume,
          duration: force ? 300 : 700,
          ease: 'Sine.easeInOut',
        });
        return;
      }

      const sound = this.sound.add(layer.key, {
        loop: true,
        volume: 0,
      });
      sound.play();
      this.ambientLayers.set(layer.key, sound);

      this.tweens.add({
        targets: sound,
        volume: targetVolume,
        duration: force ? 500 : 1000,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private fadeOutAmbientLayer(key: string, sound: Phaser.Sound.BaseSound) {
    this.ambientLayers.delete(key);
    this.ambientBaseVolumes.delete(key);

    this.tweens.add({
      targets: sound,
      volume: 0,
      duration: 700,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        sound.stop();
        sound.destroy();
      },
    });
  }

  private stopCurrentMusic() {
    if (!this.currentMusic) {
      this.currentMusicKey = null;
      return;
    }

    this.currentMusic.stop();
    this.currentMusic.destroy();
    this.currentMusic = null;
    this.currentMusicKey = null;
  }

  private stopLocationAudio() {
    this.stopCurrentMusic();
    this.ambientLayers.forEach((sound) => {
      sound.stop();
      sound.destroy();
    });
    this.ambientLayers.clear();
    this.ambientBaseVolumes.clear();
  }

  private setSoundVolume(sound: Phaser.Sound.BaseSound, volume: number) {
    (sound as Phaser.Sound.BaseSound & { volume: number }).volume = volume;
  }

  private updateMusicVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    useGameStore.getState().setMusicVolume(clampedVolume);

    if (this.currentMusic) {
      this.setSoundVolume(this.currentMusic, clampedVolume);
    }
  }

  private updateAmbientVolumes(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    useGameStore.getState().setAmbientVolume(clampedVolume);

    this.ambientLayers.forEach((sound, key) => {
      const baseVolume = this.ambientBaseVolumes.get(key) ?? 0.25;
      this.setSoundVolume(sound, baseVolume * clampedVolume);
    });
  }

  private playSfx(soundKey: string, volumeScale: number = 1) {
    if (!this.cache.audio.exists(soundKey)) return;

    const sfxVolume = useGameStore.getState().sfxVolume;
    const clampedVolume = Math.max(0, Math.min(1, sfxVolume * volumeScale));
    if (clampedVolume <= 0) return;

    this.sound.play(soundKey, { volume: clampedVolume });
  }

  private updateFootstepAudio(velocityX: number, velocityY: number) {
    if (velocityX === 0 && velocityY === 0) return;
    if (this.time.now < this.nextFootstepAt) return;

    const footstepSurface = this.getSceneAudioConfig().footstepSurface;
    this.playSfx(`sfx-footstep-${footstepSurface}`, 0.24);
    this.nextFootstepAt = this.time.now + 260;
  }

  private updateCinematicMotion() {
    if (this.filmGrainOverlay) {
      this.filmGrainOverlay.tilePositionX += 0.35;
      this.filmGrainOverlay.tilePositionY += 0.22;
    }

    this.sunShafts.forEach((shaft, index) => {
      const wobble = Math.sin((this.time.now / 1400) + index * 0.6) * 2.2;
      shaft.setAngle(wobble);
    });
  }

  private getShadowConfig() {
    switch (this.timeOfDay) {
      case 'dawn':
        return { alpha: 0.3, offsetX: -18, offsetY: 48, length: 1.5, flatten: 0.82, angle: -9 };
      case 'day':
        return { alpha: 0.2, offsetX: 0, offsetY: 42, length: 1, flatten: 1, angle: 0 };
      case 'dusk':
        return { alpha: 0.34, offsetX: 18, offsetY: 50, length: 1.5, flatten: 0.82, angle: 9 };
      case 'night':
        return { alpha: 0.42, offsetX: 4, offsetY: 44, length: 1.12, flatten: 0.92, angle: 2 };
      default:
        return { alpha: 0.26, offsetX: 0, offsetY: 44, length: 1.1, flatten: 0.9, angle: 0 };
    }
  }

  private applyCharacterLighting(force: boolean = false) {
    const lighting = TIME_CHARACTER_LIGHTING[this.timeOfDay];
    const signature = `${this.timeOfDay}:${lighting.tint ?? 'none'}:${lighting.alpha.toFixed(2)}`;
    if (!force && signature === this.lastCharacterLightingSignature) return;

    this.lastCharacterLightingSignature = signature;

    if (lighting.tint === null) {
      this.player.clearTint();
      this.npcs.forEach((npc) => npc.clearTint());
    } else {
      this.player.setTint(lighting.tint);
      this.npcs.forEach((npc) => npc.setTint(lighting.tint));
    }

    this.player.setAlpha(lighting.alpha);
    this.npcs.forEach((npc) => npc.setAlpha(lighting.alpha));
  }

  private updateCharacterShadows() {
    const config = this.getShadowConfig();
    const baseAlpha = config.alpha * this.visualProfile.shadowAlphaMultiplier;

    if (this.playerShadow) {
      this.playerShadow.setPosition(this.player.x + config.offsetX, this.player.y + config.offsetY);
      this.playerShadow.setDepth(this.player.depth - 1);
      this.playerShadow.setAlpha(baseAlpha);
      this.playerShadow.setScale(config.length, config.flatten);
      this.playerShadow.setAngle(config.angle);
    }

    this.npcShadowMap.forEach((shadow, npc) => {
      shadow.setPosition(npc.x + config.offsetX, npc.y + config.offsetY);
      shadow.setDepth(npc.depth - 1);
      shadow.setAlpha(baseAlpha * 0.9);
      shadow.setScale(config.length * 0.95, config.flatten);
      shadow.setAngle(config.angle);
    });
  }

  private updateNPCIndicators() {
    const targetedNpcId = this.activeInteractionTarget?.type === 'npc'
      ? this.activeInteractionTarget.id
      : null;

    for (const npc of this.npcs) {
      const indicator = (npc as unknown as { indicator: Phaser.GameObjects.Arc }).indicator;
      const npcData = this.npcDataMap.get(npc);
      if (indicator) {
        // Update indicator position to follow NPC (in case NPC moves)
        const indicatorOffset = 20 * CHARACTER_SCALE;
        indicator.setPosition(npc.x, npc.y - indicatorOffset);
        const isTargeted = npcData?.id === targetedNpcId;
        indicator.setVisible(isTargeted);
        if (isTargeted) {
          this.setNpcFacing(npc, this.getNpcDirectionToPlayer(npc));

          // Pulse effect
          indicator.setScale(1 + Math.sin(this.time.now / 200) * 0.3);
        }
      }
    }
  }

  private updateWorldItemIndicators() {
    const targetedItemId = this.activeInteractionTarget?.type === 'item'
      ? this.activeInteractionTarget.id
      : null;

    this.worldItems.forEach((item) => {
      const nearby = item.id === targetedItemId;

      item.label.setVisible(nearby);
      item.glow.setScale(nearby ? 1.15 + Math.sin(this.time.now / 230) * 0.08 : 1 + Math.sin(this.time.now / 450) * 0.03);
      item.glow.setAlpha(nearby ? 0.26 : 0.16);
      item.marker.setScale(nearby ? 1 + Math.sin(this.time.now / 200) * 0.2 : 1);
      item.marker.setAlpha(nearby ? 1 : 0.8);
    });
  }

  private updateHotspotIndicators() {
    const targetedTransitionId = this.activeInteractionTarget?.type === 'transition'
      ? this.activeInteractionTarget.id
      : null;
    const targetedQuestId = this.activeInteractionTarget?.type === 'quest'
      ? this.activeInteractionTarget.id
      : null;

    this.transitionHotspots.forEach((hotspot) => {
      const nearby = hotspot.config.targetLocation === targetedTransitionId;

      hotspot.label.setVisible(nearby);
      hotspot.glow.setAlpha(nearby ? 0.2 : 0.08);
      hotspot.glow.setScale(nearby ? 1.1 + Math.sin(this.time.now / 260) * 0.06 : 1);
      hotspot.marker.setScale(nearby ? 1 + Math.sin(this.time.now / 210) * 0.15 : 1);
    });

    this.questHotspots.forEach((hotspot) => {
      const visible = hotspot.isAvailable();
      hotspot.glow.setVisible(visible);
      hotspot.marker.setVisible(visible);
      hotspot.labelText.setVisible(false);

      if (!visible) return;

      const nearby = hotspot.id === targetedQuestId;
      hotspot.labelText.setVisible(nearby);
      hotspot.glow.setAlpha(nearby ? 0.22 : 0.08);
      hotspot.glow.setScale(nearby ? 1.1 + Math.sin(this.time.now / 240) * 0.08 : 1);
      hotspot.marker.setScale(nearby ? 1 + Math.sin(this.time.now / 200) * 0.2 : 1);
    });
  }
}
