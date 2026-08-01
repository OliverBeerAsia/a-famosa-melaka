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
import { CameraSystem } from '../systems/CameraSystem';
import { configureWorldDepth, worldDepth } from '../core/depth';
import { WalkMask, resolveMove } from '../core/WalkMask';
import {
  getLocation,
  getLocationItems,
  getLocationPlateProps,
  getLocationVisual,
  LOCATION_IDS,
  type LocationRuntime,
} from '../core/LocationData';
import relightRuntime from '../../data/relight-runtime.json';
import objectiveMarkersData from '../../data/objective-markers.json';
import historicalObjectsData from '../../data/historical-objects.json';
import { getLocationName } from '../../data/locationNames';
import { ITEM_DEFINITIONS, useInventoryStore } from '../../stores/inventoryStore';
import type { ConditionalRequirements, ReputationFaction } from '../../stores/questStore';
import {
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
  requirements?: ConditionalRequirements;
  showWhenLocked?: boolean;
  lockedLabel?: string;
  blockedMessage?: string;
}

interface AmbientLayerConfig {
  key: string;
  volume?: number;
}

interface ProjectionConfig {
  runtimeMode?: 'legacy-backdrop' | 'isometric';
  tileWidth?: number;
  tileHeight?: number;
}

// Map location keys to scene background prefixes
const LOCATION_TO_SCENE: Record<string, string> = {
  'a-famosa-gate': 'a-famosa',
  'rua-direita': 'rua-direita',
  'st-pauls-church': 'st-pauls',
  'waterfront': 'waterfront',
  'kampung': 'kampung',
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

type InteractionTargetType = 'npc' | 'item' | 'quest' | 'transition' | 'lore' | 'scenery';

/**
 * Plate-prop labels come from the kits, so some are hand-written sentences
 * ("The wall of A Famosa") and some are bare type names ("lantern post").
 * Only the first letter is touched — title-casing the rest would turn the
 * written ones into "The Wall Of A Famosa".
 */
const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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

// Player opacity while sneaking on the theft path (composited with lighting alpha)
const STEALTH_ALPHA = 0.4;

/**
 * Distance from the player sprite's origin down to its ground contact point.
 * The sprite is 16x32 at 3x with a centred origin, so its feet sit ~44px below
 * the origin — that is the point the walk mask is sampled at, and the point
 * `worldDepth` sorts on.
 */
const WALK_FOOT_OFFSET = 44;

/**
 * Per-time character tint, DERIVED from the Forge relight LUTs.
 *
 * Generated into src/data/relight-runtime.json by `npm run forge:relight` from
 * exactly the tables that bake the plates (docs/art-bible/forge/relight-luts.json),
 * so a sprite composited onto a night plate is lit by the same night. Hand-picked
 * tints here were the double-grade in miniature: the backdrop said 0.36x day and
 * the characters said 0.9 alpha and a taste-picked blue.
 *
 * Do not hand-edit — fix the specs in tools/forge/relight.cjs and regenerate.
 */
const TIME_CHARACTER_LIGHTING: Record<
  TimeOfDay,
  { tint: number | null; alpha: number }
> = {
  dawn: relightRuntime.times.dawn,
  day: relightRuntime.times.day,
  dusk: relightRuntime.times.dusk,
  night: relightRuntime.times.night,
};

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
  private location: LocationRuntime | undefined;
  private sceneColliders: Phaser.Physics.Arcade.StaticGroup | null = null;
  private lightingOverlay!: Phaser.GameObjects.Rectangle;
  private currentHour: number = 10;
  private currentMinute: number = 0;
  private clockTickAccumulator: number = 0;
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
  private cameraSystem: CameraSystem | null = null;
  /** Authoritative walkable surface for plates that ship a mask. */
  private walkMask: WalkMask | null = null;
  /** Last position the player was legally standing at (walk-mask rollback). */
  private lastWalkableX = 0;
  private lastWalkableY = 0;
  /** Foreground occluders cut from the plate, keyed for time-of-day swaps. */
  private plateOverlays: Phaser.GameObjects.Image[] = [];
  private worldItems: WorldItemInstance[] = [];
  private loreObjects: LoreObjectInstance[] = [];
  /**
   * Examine-only hotspots for props the compositor painted into the plate.
   * No display object of their own: the plate already draws them.
   */
  private plateHotspots: { key: string; label: string; examineText: string; x: number; y: number }[] = [];
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
  // Character alpha is composed from independent factors (time-of-day lighting ×
  // stealth mode) and written in exactly one place: applyCompositedCharacterAlpha().
  // Never call player.setAlpha()/npc.setAlpha() directly — set a factor instead.
  private lightingAlpha: number = 1;
  private stealthAlpha: number = 1;
  private objectiveMarker: {
    definition: ObjectiveMarkerDefinition;
    beam: Phaser.GameObjects.Ellipse;
    beacon: Phaser.GameObjects.Arc;
    ring: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
  } | null = null;
  private lastObjectiveSignature: string | null = null;
  private bridgeUnsubscribers: Array<() => void> = [];
  private playerHistory: Array<{ x: number; y: number; facing: string; walking: boolean }> = [];
  private followerColliderAdded: boolean = false;
  private isResting: boolean = false;

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
    this.currentMinute = state.time.minute || 0;
    this.visualQualityMode = state.visualQualityMode;
    this.dynamicVisualQualityEnabled = state.dynamicVisualQuality;
    this.resolvedVisualQuality = resolveVisualQualityMode(this.visualQualityMode, state.resolvedVisualQuality);
    this.visualProfile = VISUAL_PROFILES[this.resolvedVisualQuality];
  }

  create() {
    console.log('GameScene started - Loading:', this.currentMap);

    // Load location data. src/data/locations/<id>.location.json is the single
    // source of truth; core/LocationData has already scaled every native plate
    // coordinate into this scene's 960x540 world space.
    this.location = getLocation(this.currentMap);
    this.sceneConfig = this.location ? {
      background: this.location.plate.background,
      variants: this.location.plate.variants as SceneConfig['variants'],
      mapFile: this.location.plate.mapFile,
      isoMapKey: this.location.plate.isoMapKey,
      music: this.location.audio.music,
      nightMusic: this.location.audio.nightMusic,
      ambientSounds: this.location.audio.ambientSounds,
      nightAmbientSounds: this.location.audio.nightAmbientSounds,
      footstepSurface: this.location.audio.footstepSurface,
      projection: {
        runtimeMode: this.location.plate.runtimeMode,
        tileWidth: this.location.plate.tileWidth,
        tileHeight: this.location.plate.tileHeight,
      },
      playerStart: this.location.playerStart,
      npcPositions: this.location.npcPositions,
      collisionRects: this.location.collisionRects,
      transitions: this.location.transitions as TransitionConfig[],
    } : null;

    // The depth band is fixed but the world is not: tell it how tall this
    // location is BEFORE anything Y-sorted is created.
    configureWorldDepth(this.worldBounds().height);

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

    this.playerHistory = [];
    this.followerColliderAdded = false;
    this.isResting = false;

    // Pre-fill history to prevent follower snapping on spawn/scene transition
    const tracked = useQuestStore.getState().getTrackedObjective();
    if (tracked && tracked.objective && tracked.objective.type === 'escort' && tracked.objective.target === 'siti') {
      const playerState = useGameStore.getState().player;
      for (let i = 0; i < 15; i++) {
        this.playerHistory.push({
          x: this.player.x,
          y: this.player.y,
          facing: playerState.facing || 'down',
          walking: false
        });
      }
    }

    // Create NPCs
    this.createNPCs();
    this.applyCharacterLighting(true);

    // Create world pickups for this location
    this.createWorldItems();

    // Create lore objects for this location
    this.createLoreObjects();
    this.createPlateHotspots();

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

    // DEV-only acceptance hook. Plate installs have to be walked end to end —
    // every exit taken through the real switchLocation path, every arrival
    // checked against the walk mask — and driving that with raw keystrokes is
    // not repeatable. Stripped from production by the import.meta.env.DEV guard.
    if (import.meta.env.DEV) {
      (window as any).__melakaDebug = {
        location: () => this.currentMap,
        player: () => ({ x: this.player.x, y: this.player.y }),
        camera: () => ({
          x: this.cameras.main.scrollX,
          y: this.cameras.main.scrollY,
          w: this.cameras.main.width,
          h: this.cameras.main.height,
        }),
        world: () => this.worldBounds(),
        timeOfDay: () => this.timeOfDay,
        // "Can a character stand with their ORIGIN here?" — the same feet-level,
        // both-shoulders test the movement code uses, not a raw pixel read.
        walkable: (x: number, y: number) =>
          this.walkMask?.canStand(x, y + WALK_FOOT_OFFSET, 6 * CHARACTER_SCALE) ?? null,
        place: (x: number, y: number) => { this.player.setPosition(x, y); },
        transitions: () => this.transitionHotspots.map((h) => ({
          target: h.config.targetLocation,
          label: h.config.label,
          trigger: h.config.triggerArea,
          spawnAt: h.config.spawnAt,
        })),
        interact: () => this.tryInteract(),
        counts: () => ({
          npcs: this.npcs.length,
          items: this.worldItems.length,
          lore: this.loreObjects.length,
          scenery: this.plateHotspots.length,
          overlays: this.plateOverlays.length,
          crowd: (this.crowdSystem as any)?.crowdMembers?.length ?? null,
        }),
      };
    }
    this.createInteractionPrompt();

    // Subscribe to quest changes to handle stealth mode opacity on theft path
    const unsubQuest = useQuestStore.subscribe((state) => {
      const stage = state.getQuestStage('merchants-seal');
      if (stage?.id === 'theft-success') {
        if (this.player && this.stealthAlpha !== STEALTH_ALPHA) {
          // Claim the stealth factor immediately so a re-fired subscription
          // can't restart the fade; it is composited once the screen is black.
          this.stealthAlpha = STEALTH_ALPHA;
          this.isResting = true;
          this.cameras.main.fadeOut(500, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            if (this.player) {
              this.applyCompositedCharacterAlpha();
              this.player.setPosition(620, 250);
            }
            this.cameras.main.fadeIn(500, 0, 0, 0);
            this.cameras.main.once('camerafadeincomplete', () => {
              this.isResting = false;
            });
          });
        }
      } else if (this.stealthAlpha !== 1.0) {
        this.stealthAlpha = 1.0;
        this.applyCompositedCharacterAlpha();
      }
    });
    this.bridgeUnsubscribers.push(unsubQuest);

    // Emit game ready
    emitGameEvent('game:ready');

    // Walk-mask collision has to run after Arcade physics has moved the body,
    // which is POST_UPDATE — resolving in update() would always be one frame
    // stale and let the player's feet cross into a wall before being pushed out.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.applyWalkMaskCollision, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  /**
   * The size of the world the player can move through, in world px.
   *
   * Pre-Stage-3 plates are 320x180 native = exactly the 960x540 viewport, so
   * this returns the viewport and every camera/particle/bounds calculation
   * behaves exactly as it did. A Forge-composed plate (640x360 native) returns
   * 1920x1080 and the same calculations start scrolling.
   */
  private worldBounds(): { width: number; height: number } {
    if (this.isIsometric && this.isoRenderer) return this.isoRenderer.getWorldBounds();
    if (this.location) return this.location.size;
    return { width: GAME_WIDTH, height: GAME_HEIGHT };
  }

  private createSceneBackdrop() {
    const runtimeMode = this.sceneConfig?.projection?.runtimeMode || 'legacy-backdrop';
    if (runtimeMode === 'isometric') {
      this.createIsometricWorld();
      return;
    }

    const { width, height } = this.worldBounds();

    // Clear existing colliders
    if (this.sceneColliders) {
      this.sceneColliders.clear(true, true);
      this.sceneColliders = null;
    }

    // Set physics bounds
    this.physics.world.setBounds(0, 0, width, height);

    // Draw background with time-of-day variant support
    const backgroundKey = this.getBackgroundKeyForTime();
    const plateKey = (backgroundKey && this.textures.exists(backgroundKey))
      ? backgroundKey
      : (this.sceneConfig?.background && this.textures.exists(this.sceneConfig.background)
        ? this.sceneConfig.background
        : null);

    if (plateKey) {
      this.currentBackground = this.placePlate(plateKey);
    } else {
      // Fallback gradient background
      const graphics = this.add.graphics();
      graphics.fillGradientStyle(0x1a0f05, 0x1a0f05, 0x3d2817, 0x3d2817, 1);
      graphics.fillRect(0, 0, width, height);
      graphics.setDepth(-20);
    }

    // Add vignette — screen space, so it frames the VIEW rather than the world.
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.16, 0.07, 0.07, 0.16);
    vignette.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    vignette.setScrollFactor(0);
    vignette.setDepth(-10);

    this.createWalkMask();
    this.createPlateOverlays();

    // Collision rects are the fallback for plates with no walk mask. Where a
    // mask exists it is authoritative (the rects are a coarse 8px cover of it),
    // and building both would block the player twice with different edges.
    if (!this.walkMask && this.sceneConfig?.collisionRects?.length) {
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

  /**
   * Put a plate into the world at 1:1 world pixels, top-left anchored.
   *
   * The plate is world-space (scroll factor 1) even when it exactly fills the
   * viewport: at that size scrolling is clamped to (0,0) so the two are
   * identical, and having ONE placement rule is what stops the flip-screen and
   * scrolling paths from drifting apart.
   */
  private placePlate(textureKey: string, depth = -20): Phaser.GameObjects.Image {
    const { width, height } = this.worldBounds();
    const plate = this.add.image(0, 0, textureKey);
    plate.setOrigin(0, 0);
    plate.setScale(width / plate.width, height / plate.height);
    plate.setScrollFactor(1);
    plate.setDepth(depth);
    return plate;
  }

  /** Load the location's walk mask into a sampler, if it ships one. */
  private createWalkMask() {
    this.walkMask = null;
    const key = this.location?.plate.walkMask;
    if (!key || !this.textures.exists(key)) return;

    const source = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = this.textures.createCanvas(`${key}-sampler`, source.width, source.height);
    if (!canvas) return;
    canvas.context.imageSmoothingEnabled = false;
    canvas.context.drawImage(source as CanvasImageSource, 0, 0);
    const rgba = canvas.context.getImageData(0, 0, source.width, source.height).data;
    this.walkMask = WalkMask.fromRGBA(rgba, source.width, source.height, this.location!.world.scale);
    this.textures.remove(`${key}-sampler`);
  }

  /**
   * Foreground occluders: the pieces of the plate a character can walk BEHIND.
   *
   * They are drawn at the exact pixels they were cut from, so while nothing is
   * behind them they are invisible (they reproduce the plate underneath), and
   * `worldDepth(depthY)` puts them in front of any character standing further
   * up the street. Relit per time of day by the same LUT as the plate.
   */
  private createPlateOverlays() {
    this.plateOverlays.forEach((o) => o.destroy());
    this.plateOverlays = [];

    (this.location?.overlays ?? []).forEach((overlay) => {
      const key = this.overlayTextureKey(overlay.key);
      if (!this.textures.exists(key)) return;
      const image = this.add.image(overlay.x, overlay.y, key);
      image.setOrigin(0, 0);
      image.setScrollFactor(1);
      image.setDepth(worldDepth(overlay.depthY));
      image.setData('overlayKey', overlay.key);
      this.plateOverlays.push(image);
    });
  }

  private overlayTextureKey(baseKey: string): string {
    return this.timeOfDay === 'day' ? baseKey : `${baseKey}-${this.timeOfDay}`;
  }

  /** Crossfade the occluders alongside the plate when the hour changes. */
  private updatePlateOverlaysForTime() {
    this.plateOverlays.forEach((image) => {
      const baseKey = image.getData('overlayKey') as string;
      const key = this.overlayTextureKey(baseKey);
      if (!this.textures.exists(key) || image.texture.key === key) return;

      const replacement = this.add.image(image.x, image.y, key);
      replacement.setOrigin(0, 0);
      replacement.setScrollFactor(1);
      replacement.setDepth(image.depth);
      replacement.setData('overlayKey', baseKey);
      replacement.setAlpha(0);
      this.tweens.add({ targets: replacement, alpha: 1, duration: 2000, ease: 'Sine.easeInOut' });
      this.tweens.add({
        targets: image,
        alpha: 0,
        duration: 2000,
        ease: 'Sine.easeInOut',
        onComplete: () => image.destroy(),
      });
      const index = this.plateOverlays.indexOf(image);
      if (index !== -1) this.plateOverlays[index] = replacement;
    });
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
      { name: 'cobblestone-v1', textureKey: 'cobblestone-v1-iso' },
      { name: 'cobblestone-v2', textureKey: 'cobblestone-v2-iso' },
      { name: 'cobblestone-v3', textureKey: 'cobblestone-v3-iso' },
      { name: 'cobblestone-grass-h', textureKey: 'cobblestone-grass-h-iso' },
      { name: 'cobblestone-grass-v', textureKey: 'cobblestone-grass-v-iso' },
      { name: 'cobblestone-dirt-v', textureKey: 'cobblestone-dirt-v-iso' },
      { name: 'laterite-stone', textureKey: 'laterite-stone-iso' },
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

    // Neutral void behind the authored tilemap; it should not read as walkable soil.
    const bg = this.add.rectangle(bounds.width / 2, bounds.height / 2, bounds.width, bounds.height, 0x060504);
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

  /**
   * True when the visible backdrop is a pre-baked time-of-day plate variant
   * (scene-<location>-dawn/dusk/night).
   *
   * Those plates already carry the time-of-day grade, so the full-screen
   * plate-wide overlays (TIME_COLORS lighting tint + TIME_COLOR_GRADE
   * multiply/screen) must be suppressed — otherwise the scene is graded twice
   * and nights turn into crushed blue mud. Character lighting is unaffected:
   * sprites are not baked, so they still need the runtime tint/alpha pass.
   */
  private hasBakedTimeVariant(): boolean {
    if (this.isIsometric) return false;
    // 'day' uses the base plate, which carries no baked grade.
    if (this.timeOfDay === 'day') return false;
    const key = this.getBackgroundKeyForTime();
    return !!key && this.textures.exists(key);
  }

  private updateBackgroundForTime() {
    const newBackgroundKey = this.getBackgroundKeyForTime();

    if (!newBackgroundKey || !this.textures.exists(newBackgroundKey)) {
      console.log(`Background not found: ${newBackgroundKey}, keeping current`);
      return;
    }

    if (this.currentBackground) {
      // Crossfade to new background
      const newBg = this.placePlate(newBackgroundKey, -21); // -21: behind current
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

      this.updatePlateOverlaysForTime();
    }
  }

  private createAtmosphere() {
    const worldBounds = this.worldBounds();

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
    heatHazeParticles.setDepth(850);
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
    const worldBounds = this.worldBounds();

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
    const worldBounds = this.worldBounds();

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
    const worldBounds = this.worldBounds();

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

    const positions = this.location?.fires ?? [];
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

    const defaultStart = this.sceneConfig?.playerStart;
    if (this.spawnOverride) {
      spawnX = this.spawnOverride.x;
      spawnY = this.spawnOverride.y;
    } else if (defaultStart) {
      spawnX = defaultStart.x;
      spawnY = defaultStart.y;
    }

    // Snap-to-spawn safety net. A saved position (or a transition authored
    // against an older plate) can point anywhere; if it is off the world or
    // inside geometry, fall back to the location's own spawn rather than
    // loading the player into a wall. This is the runtime half of
    // `coordVersion` — saveStore drops stale positions, and this catches
    // anything that still lands badly.
    const bounds = this.worldBounds();
    const offWorld = spawnX < 0 || spawnY < 0 || spawnX > bounds.width || spawnY > bounds.height;
    const unwalkable = !!this.walkMask
      && !this.walkMask.canStand(spawnX, spawnY + WALK_FOOT_OFFSET, 6 * CHARACTER_SCALE);
    if ((offWorld || unwalkable) && defaultStart) {
      console.warn(
        `[GameScene] spawn (${Math.round(spawnX)}, ${Math.round(spawnY)}) is `
        + `${offWorld ? 'outside the world' : 'not walkable'} — snapping to ${this.currentMap}'s default spawn`);
      spawnX = defaultStart.x;
      spawnY = defaultStart.y;
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
      // Arcade body size/offset are in SOURCE-TEXTURE pixels; Phaser multiplies
      // them by the sprite's scale itself. Passing pre-scaled numbers here gave
      // a 108x144 body around a 48x96 sprite — three times too big, which is
      // why a spawn near the bottom of the new 1080px-tall world was shoved
      // 138px north by collideWorldBounds.
      this.player.body.setSize(12, 16);
      this.player.body.setOffset(2, 16);
    }

    this.player.setCollideWorldBounds(true);
    this.lastWalkableX = this.player.x;
    this.lastWalkableY = this.player.y;

    // Y-based depth sorting in both modes so the player walks behind/in-front
    // of props and NPCs (Ultima VII-style overlap). Kept under the FX band.
    this.player.setDepth(worldDepth(this.player.y + 48));

    this.playerShadow = this.add.ellipse(
      this.player.x,
      this.player.y + 40,
      54,
      20,
      0x000000,
      0.28
    );
    this.playerShadow.setDepth(this.player.depth - 1);

    if (this.sceneColliders) {
      this.physics.add.collider(this.player, this.sceneColliders);
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
      let isFollower = false;
      if (data.id === 'siti') {
        const tracked = useQuestStore.getState().getTrackedObjective();
        if (tracked && tracked.objective && tracked.objective.type === 'escort' && tracked.objective.target === 'siti') {
          isFollower = true;
        }
      }

      if (!isFollower && data.location !== this.currentMap) return;
      if (!isFollower && !this.isNpcAvailableAtCurrentTime(data)) return;

      let x = data.position?.x || GAME_WIDTH / 2;
      let y = data.position?.y || GAME_HEIGHT / 2;

      if (isFollower && data.location !== this.currentMap) {
        // Spawn follower near the player
        x = this.player.x - 30;
        y = this.player.y;
      } else if (npcOverrides[data.id]) {
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

      npc.setImmovable(!isFollower);
      npc.setDepth(worldDepth(y + 48));

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

  private recreateNPCs() {
    this.npcs.forEach((npc) => {
      const ind = (npc as any).indicator;
      if (ind) ind.destroy();
      const shadow = this.npcShadowMap.get(npc);
      if (shadow) shadow.destroy();
      npc.destroy();
    });

    this.npcs = [];
    this.npcDataMap.clear();
    this.npcSpriteById.clear();
    this.npcAnimationPrefixMap.clear();
    this.npcFacingMap.clear();
    this.npcShadowMap.clear();
    this.followerColliderAdded = false;

    this.createNPCs();

    // Freshly-spawned sprites carry no tint, and this runs at every schedule
    // change — including the one advanceTime() fires AFTER updateTimeOfDay().
    // Without this, the NPCs that appear when the clock rolls over stand on a
    // night plate at full daylight brightness while the player is correctly
    // tinted: the double-grade, inverted. Forced, because the lighting
    // signature has not changed and the early-out would otherwise skip it.
    this.applyCharacterLighting(true);
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
    const worldItems = (this.location?.items ?? []) as WorldItemData[];
    this.worldItems = [];

    worldItems.forEach((item) => {
      const spriteKey = this.resolveWorldItemSpriteKey(item.itemId);
      const sprite = this.add.image(item.x, item.y, spriteKey);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(this.getWorldItemScale(spriteKey));
      sprite.setDepth(worldDepth(item.y));

      const markerY = item.y - Math.max(22, sprite.displayHeight) - 8;
      const glow = this.add.ellipse(item.x, item.y - 4, 26, 13, 0xF4B41A, 0.1);
      glow.setDepth(979);
      glow.setBlendMode(Phaser.BlendModes.ADD);

      // Subtle interaction pip (was a big bright disc that read as a coin).
      const marker = this.add.circle(item.x, markerY, 3.5, 0xF4B41A, 0.7);
      marker.setStrokeStyle(1, 0x3b2509, 0.8);
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

  /**
   * Painted props carry prose but no sprite. Coordinates are already in world
   * px (LocationData scaled them); anchors are bottom-centre like every other
   * ground-standing thing, and a prop can legitimately be anchored just off the
   * frame (a wall running past the edge), which is fine — the radius check in
   * the interaction scan is what decides whether it is reachable.
   */
  private createPlateHotspots() {
    this.plateHotspots = getLocationPlateProps(this.currentMap)
      .filter((p: any) => typeof p.examineText === 'string' && p.examineText.length > 0)
      .map((p: any) => ({
        key: p.key,
        label: titleCase(p.label || p.type || p.key),
        examineText: p.examineText,
        x: p.x,
        y: p.y,
      }));
  }

  private createLoreObjects() {
    // Positions come from <id>.location.json (native px, already scaled by
    // LocationData); the prose/sprite/historical note stay in
    // historical-objects.json. tools/validate-location-data.cjs guarantees every
    // id resolves and every coordinate is on the plate, so there is no runtime
    // bounds filter here any more — an off-plate lore object is a build failure.
    const objects = (historicalObjectsData as any).objects || {};
    this.loreObjects = [];

    (this.location?.loreObjects ?? []).forEach((placement) => {
      const obj = objects[placement.id];
      if (!obj) return;

      const x = placement.x;
      const y = placement.y;

      const spriteKey = this.resolveGameplaySpriteKey(obj.sprite);
      // Unresolved lore sprites fall back to the (now invisible) placeholder —
      // skip them entirely so we don't leave floating markers with no object.
      if (spriteKey === 'debug-prop-missing') return;
      const sprite = this.add.image(x, y, spriteKey);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(2); // match prop scale on the plate (3x was oversized)
      sprite.setDepth(worldDepth(y));

      const markerY = y - Math.max(22, sprite.displayHeight) - 8;
      const glow = this.add.ellipse(x, y - 4, 28, 14, 0xD4AF37, 0.06);
      glow.setDepth(979);
      glow.setBlendMode(Phaser.BlendModes.ADD);

      // Subtle interaction pip (was a big gold disc that read as a coin).
      const marker = this.add.circle(x, markerY, 3, 0xD4AF37, 0.55);
      marker.setStrokeStyle(1, 0x3b2509, 0.7);
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

  private meetsConditionalRequirements(requirements?: ConditionalRequirements): boolean {
    if (!requirements) return true;

    const questState = useQuestStore.getState();
    const inventoryState = useInventoryStore.getState();
    const gameState = useGameStore.getState();

    if (requirements.money && inventoryState.money < requirements.money) return false;
    if (requirements.itemsAll?.length && !requirements.itemsAll.every((itemId) => inventoryState.hasItem(itemId))) {
      return false;
    }
    if (requirements.talkedTo?.length && !requirements.talkedTo.every((npcId) => questState.talkedToNPCs.includes(npcId))) {
      return false;
    }
    if (requirements.topic && !questState.seenTopics.includes(requirements.topic)) return false;
    if (requirements.time && gameState.time.timeOfDay !== requirements.time) return false;
    if (requirements.location && this.currentMap !== requirements.location) return false;

    if (requirements.reputation) {
      const meetsRep = (Object.entries(requirements.reputation) as Array<[ReputationFaction, number]>)
        .every(([faction, minValue]) => (questState.reputation[faction] ?? 0) >= minValue);
      if (!meetsRep) return false;
    }

    if (requirements.maxReputation) {
      const underRep = (Object.entries(requirements.maxReputation) as Array<[ReputationFaction, number]>)
        .every(([faction, maxValue]) => (questState.reputation[faction] ?? 0) <= maxValue);
      if (!underRep) return false;
    }

    if (requirements.worldFlagsAll?.length && !requirements.worldFlagsAll.every((flag) => Boolean(questState.worldFlags[flag]))) {
      return false;
    }
    if (requirements.worldFlagsAny?.length && !requirements.worldFlagsAny.some((flag) => Boolean(questState.worldFlags[flag]))) {
      return false;
    }
    if (requirements.worldFlagsNone?.length && requirements.worldFlagsNone.some((flag) => Boolean(questState.worldFlags[flag]))) {
      return false;
    }
    if (requirements.completedQuests?.length && !requirements.completedQuests.every((questId) => questState.completedQuests.includes(questId))) {
      return false;
    }
    if (requirements.completedQuestPaths?.length) {
      const hasPaths = requirements.completedQuestPaths.every((token) => {
        const [questId, resolution] = token.split(':');
        return Boolean(questId && resolution && questState.getCompletedQuestResolution(questId) === resolution);
      });
      if (!hasPaths) return false;
    }

    return true;
  }

  private isTransitionAvailable(config: TransitionConfig): boolean {
    return this.meetsConditionalRequirements(config.requirements);
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
      const available = this.isTransitionAvailable(transition);
      const visible = available || Boolean(transition.showWhenLocked);

      const glow = this.add.ellipse(x, y, 54, 22, 0xF4B41A, 0.12);
      glow.setDepth(978);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setVisible(visible);

      const marker = this.add.arc(x, y, 10, 200, 340, false, 0xF4B41A, 0.85);
      marker.setStrokeStyle(2, 0x3b2509, 1);
      marker.setDepth(979);
      marker.setVisible(visible);

      const label = this.add.text(x, y - 24, available ? transition.label : (transition.lockedLabel || transition.label), {
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
        const quest = useQuestStore.getState().activeQuests.find(q => q.id === 'merchants-seal');
        if (quest) {
          if (quest.currentStageId === 'choose-path') {
            emitGameEvent('quest:path:request', 'theft');
          }
          useQuestStore.getState().recordLocation(this.currentMap);
          useQuestStore.getState().recordStealth('counting-house');
          this.showNotification('You sneak close to the counting house door...');
        }
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
    // A Forge-composed plate has its practicals BAKED into the night and dusk
    // variants at these exact coordinates (relight-plates.cjs light pass), so
    // the runtime additive glow would be the double-grade bug in a new
    // costume: seventeen 140px ADD discs stacked on seventeen painted pools.
    // Where the plate carries the light, the runtime does not add any.
    if (this.location?.plate.authoringBasis === 'forge-compositor') {
      this.locationLightSources.forEach((glow) => glow.destroy());
      this.locationLightSources = [];
      return;
    }

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

    const lightDefs = this.location?.lights ?? [];
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
    const preset = getLocationVisual(this.currentMap);
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
      // Authored in plate coordinates, so it belongs to the WORLD; on a
      // viewport-sized plate this is identical to the old scrollFactor(0).
      rect.setScrollFactor(1);
      this.aoOverlays.push(rect);
    });
  }

  private createCanopyShadows() {
    const preset = getLocationVisual(this.currentMap);
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
      shadow.setScrollFactor(1);   // canopy sits over a place, not over the view
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
    const preset = getLocationVisual(this.currentMap);
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
      shaft.setScrollFactor(1);    // anchored to the plate's sun, not the view
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
    const preset = getLocationVisual(this.currentMap);
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
    const preset = getLocationVisual(this.currentMap);
    if (!preset) return;

    const grade = TIME_COLOR_GRADE[this.timeOfDay];
    // Baked time-of-day plates already contain this grade — don't apply it twice.
    const strength = this.hasBakedTimeVariant() ? 0 : this.visualProfile.colorGradeStrength;

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
    const preset = getLocationVisual(this.currentMap);
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
    const worldItems: Record<string, Array<{ itemId: string; x: number; y: number }>> =
      Object.fromEntries(LOCATION_IDS.map((id) => [id, getLocationItems(id)]));

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
    this.cameraSystem = new CameraSystem(this);
    this.cameraSystem.setWorld(this.worldBounds());
    this.cameraSystem.follow(this.player);
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

      // Handle rest/sleeping action
      if (topicKey === 'rest-dawn' || topicKey === 'rest-noon' || topicKey === 'rest-night') {
        const targetHour = topicKey === 'rest-dawn' ? 6 : (topicKey === 'rest-noon' ? 12 : 21);
        const diff = (targetHour - this.currentHour + 24) % 24;
        const finalHours = diff === 0 ? 24 : diff;
        
        // Lock player inputs instantly
        this.isResting = true;
        useGameStore.getState().setResting(true);
        if (this.player) {
          this.player.setVelocity(0, 0);
          const facing = useGameStore.getState().player.facing || 'down';
          // Player anims are registered UNPREFIXED in BootScene ('idle-down' etc.)
          this.player.anims.play(`idle-${facing}`, true);
        }

        // Wait 1.5 seconds for player to read the dialogue before fading to black and advancing time
        this.time.delayedCall(1500, () => {
          this.cameras.main.fadeOut(1000, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            // Close dialogue
            useDialogueStore.getState().endDialogue();
            useGameStore.getState().setDialogueOpen(false);
            this.stopDialogueAnimation();
            
            // Set exact minute to 0, advance time without crossfade transition (instant lighting)
            this.currentMinute = 0;
            this.advanceTime(finalHours, false);
            
            // Fade back in
            this.cameras.main.fadeIn(1000, 0, 0, 0);
            this.cameras.main.once('camerafadeincomplete', () => {
              // Unlock player inputs
              this.isResting = false;
              useGameStore.getState().setResting(false);
            });
          });
        });
      }
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
    if (this.sceneColliders) {
      // Arcade Physics registers its SHUTDOWN listener when the scene BOOTS;
      // ours is registered in create(). So by the time this runs, the physics
      // world — and the static tree this group removes itself from — is already
      // gone, and clear() throws `Cannot read properties of undefined (reading
      // 'size')`. That exception aborted the REST of cleanup() and left the
      // scene half-shut-down, so scene.restart() never completed — and every
      // in-game location transition goes through scene.restart().
      // Phaser destroys the group with the scene regardless, so dropping the
      // reference is the whole job here; the explicit clear only matters while
      // the world is still alive (the two mid-scene rebuild sites above).
      if (this.physics?.world) {
        this.sceneColliders.clear(true, true);
      }
      this.sceneColliders = null;
    }
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
    // Plain data, no display objects to destroy — but it must still be cleared,
    // or the old location's scenery stays examinable in the new one.
    this.plateHotspots = [];
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

  private updateTimeOfDay(animate: boolean = true) {
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
      this.applyLightingForTime(animate);
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

    const baseConfig = TIME_COLORS[this.timeOfDay];
    // Baked time-of-day plates already carry this tint — applying it again
    // double-grades the backdrop, so the overlay goes fully transparent.
    const config = this.hasBakedTimeVariant()
      ? { color: baseConfig.color, alpha: 0 }
      : baseConfig;

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

  private advanceTime(hours: number, animate: boolean = true) {
    const previousHour = this.currentHour;
    const currentDay = useGameStore.getState().time.day;
    const rawHour = previousHour + hours;
    const dayDelta = Math.floor(rawHour / 24);
    const normalizedHour = ((rawHour % 24) + 24) % 24;

    this.currentHour = normalizedHour;
    this.updateTimeOfDay(animate);

    // Update game store with new time
    const nextDay = Math.max(1, currentDay + dayDelta);
    useGameStore.getState().updateTime({
      hour: this.currentHour,
      day: nextDay,
      timeOfDay: this.timeOfDay,
      minute: this.currentMinute
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
    const minStr = this.currentMinute.toString().padStart(2, '0');
    this.showNotification(`Time: ${this.currentHour}:${minStr} - ${timeNames[this.timeOfDay]}`);

    // Refresh NPC scheduled layouts
    this.recreateNPCs();
  }

  private advanceMinutes(minutes: number) {
    let nextMinute = this.currentMinute + minutes;
    let hourDelta = Math.floor(nextMinute / 60);
    this.currentMinute = nextMinute % 60;
    
    if (hourDelta > 0) {
      this.advanceTime(hourDelta);
    } else {
      // Just update game store minutes
      useGameStore.getState().updateTime({
        minute: this.currentMinute
      });
    }
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
      // Painted scenery reads one step quieter than a lore object: it is the
      // street, not a museum piece.
      scenery: { color: '#CFC3A6', backgroundColor: 'rgba(44, 36, 24, 0.78)' },
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
    // Pickups sit on the painted plate; keep icons small so they read as
    // items, not oversized props (was 2.5/3, which dwarfed characters).
    return spriteKey.startsWith('item-') ? 1.5 : 1.6;
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
      const available = this.isTransitionAvailable(hotspot.config);
      if (!available && !hotspot.config.showWhenLocked) continue;

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
        label: available
          ? `Travel to ${getLocationName(hotspot.config.targetLocation)}`
          : (hotspot.config.lockedLabel || hotspot.config.label),
        x,
        y,
        priority: withinArea ? (available ? 0 : 2) : (available ? 3 : 4),
        score: scored.score,
        interact: () => {
          if (!available) {
            this.showNotification(hotspot.config.blockedMessage || 'That route is not safe or open to you yet.');
            return;
          }
          this.switchLocation(hotspot.config.targetLocation, hotspot.config.spawnAt);
        },
      });
    }

    // Props the Forge compositor PAINTED INTO the plate. They own no sprite —
    // drawing them again would double-image every crate on the street — so the
    // data is all that is left of them, and without this loop the examine prose
    // the content pass wrote for a barrel or a market stall is unreachable in a
    // Forge location (`props` is empty in every one of them by construction).
    // Lowest priority and the tightest radius of any candidate: scenery must
    // never shadow an NPC, an item, a lore object or an exit.
    for (const p of this.plateHotspots) {
      const scored = this.scoreInteractionTarget(p.x, p.y, 56);
      if (!scored) continue;

      candidates.push({
        type: 'scenery',
        id: p.key,
        label: `Examine ${p.label}`,
        x: p.x,
        y: p.y,
        priority: 4,
        score: scored.score,
        interact: () => emitGameEvent('message:show', p.label, p.examineText),
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
    return this.isResting || state.isDialogueOpen || state.isInventoryOpen || state.isJournalOpen || state.isMessageOpen || state.isPaused;
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

    useDialogueStore.getState().startDialogue(npcData.id);
    useGameStore.getState().setDialogueOpen(true);

    emitGameEvent('dialogue:start', {
      id: npcData.id,
      name: npcData.name,
      title: npcData.title,
      portrait: `portrait-${npcData.id}`,
      dialogue: npcData.dialogue,
    });
  }

  private switchLocation(mapKey: string, spawnPoint?: { x: number; y: number }) {
    if (mapKey === this.currentMap) return;

    console.log('Switching to:', mapKey);

    // Location-specific color tint flash before fade-to-black
    const tint = getLocation(mapKey)?.visual.transitionTint ?? [0, 0, 0];
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
      const sfxKey = getLocation(mapKey)?.audio.transitionSound;
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

    // Tick game clock: 1 game minute every 2.5 real seconds (2500ms)
    if (!this.isAnyUIOpen()) {
      this.clockTickAccumulator += delta;
      if (this.clockTickAccumulator >= 2500) {
        this.clockTickAccumulator -= 2500;
        this.advanceMinutes(1);
      }
    }

    // Don't update if UI is open
    if (this.isAnyUIOpen()) {
      this.player.setVelocity(0, 0);
      this.activeInteractionTarget = null;
      this.setInteractionPrompt(null);
      return;
    }

    // Player movement
    this.updatePlayerMovement();
    this.updateFollowers();

    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    this.cameraSystem?.update(delta, body?.velocity.x ?? 0, body?.velocity.y ?? 0);

    if (this.isIsometric && this.isoRenderer) {
      this.isoRenderer.update(this.player.x, this.player.y);
    }

    this.updateInteractionTarget();

    // Dynamic Y-depth sorting (both legacy-backdrop and isometric modes) so
    // moving characters occlude/are occluded by props at the correct y.
    this.player.setDepth(worldDepth(this.player.y + 48));
    this.npcs.forEach((npc) => {
      const depth = worldDepth(npc.y + 48);
      npc.setDepth(depth);
      const shadow = this.npcShadowMap.get(npc);
      if (shadow) shadow.setDepth(depth - 1);
    });

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

  /**
   * Walk-mask collision, applied AFTER the physics step.
   *
   * On a masked plate the mask is the collision geometry, so there are no
   * static bodies to collide against — the player is simply not allowed to end
   * a frame standing somewhere unwalkable. Resolution is per axis (see
   * `resolveMove`) so walking into a wall diagonally slides along it instead of
   * stopping dead, which is what the 8px-grid rects could never do.
   */
  private applyWalkMaskCollision() {
    if (!this.walkMask || !this.player) return;

    const halfWidth = 6 * CHARACTER_SCALE;
    const x = this.player.x;
    const y = this.player.y;

    if (this.walkMask.canStand(x, y + WALK_FOOT_OFFSET, halfWidth)) {
      this.lastWalkableX = x;
      this.lastWalkableY = y;
      return;
    }

    const resolved = resolveMove(
      this.walkMask,
      this.lastWalkableX, this.lastWalkableY + WALK_FOOT_OFFSET,
      x, y + WALK_FOOT_OFFSET,
      halfWidth,
    );
    this.player.setPosition(resolved.x, resolved.y - WALK_FOOT_OFFSET);
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      if (resolved.blockedX) body.setVelocityX(0);
      if (resolved.blockedY) body.setVelocityY(0);
    }
    this.lastWalkableX = this.player.x;
    this.lastWalkableY = this.player.y;
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

  private updateFollowers() {
    // 1. Record player history
    const playerState = useGameStore.getState().player;
    const isWalking = (this.player.body as Phaser.Physics.Arcade.Body)?.speed > 0;
    
    const lastEntry = this.playerHistory[this.playerHistory.length - 1];
    const distanceMoved = lastEntry ? Phaser.Math.Distance.Between(this.player.x, this.player.y, lastEntry.x, lastEntry.y) : 999;
    
    if (distanceMoved > 2 || this.playerHistory.length === 0) {
      this.playerHistory.push({
        x: this.player.x,
        y: this.player.y,
        facing: playerState.facing,
        walking: isWalking
      });
      // Cap history
      if (this.playerHistory.length > 150) {
        this.playerHistory.shift();
      }
    }

    // 2. Check and run escort follower behavior for Siti
    const tracked = useQuestStore.getState().getTrackedObjective();
    const isEscortingSiti = tracked && tracked.objective && tracked.objective.type === 'escort' && tracked.objective.target === 'siti';
    
    const sitiSprite = this.npcSpriteById.get('siti');
    if (sitiSprite && sitiSprite.active) {
      if (isEscortingSiti) {
        sitiSprite.setImmovable(false);
        
        // Ensure follower has active physics colliders with scene walls, added once
        if (this.sceneColliders && !this.followerColliderAdded) {
          this.physics.add.collider(sitiSprite, this.sceneColliders);
          this.followerColliderAdded = true;
        }

        const followDelay = 10; // frame delay for footstep trail (tighter tracking around corners)
        if (this.playerHistory.length > followDelay) {
          const target = this.playerHistory[this.playerHistory.length - followDelay];
          const dist = Phaser.Math.Distance.Between(sitiSprite.x, sitiSprite.y, target.x, target.y);
          
          if (dist > 15) {
            // Speed catch-up boost if follower starts drifting
            let speed = PLAYER_SPEED * 0.95;
            if (dist > 75) {
              speed = PLAYER_SPEED * 1.15;
            }
            
            // Teleport fallback if stuck or too far
            if (dist > 280) {
              sitiSprite.setPosition(target.x, target.y);
              return;
            }

            const angle = Phaser.Math.Angle.Between(sitiSprite.x, sitiSprite.y, target.x, target.y);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            sitiSprite.setVelocity(vx, vy);

            let dir = 'down';
            if (Math.abs(vx) > Math.abs(vy)) {
              dir = vx < 0 ? 'left' : 'right';
            } else {
              dir = vy < 0 ? 'up' : 'down';
            }

            const animKey = `siti-walk-${dir}`;
            if (this.anims.exists(animKey) && sitiSprite.anims.currentAnim?.key !== animKey) {
              sitiSprite.play(animKey);
            }
          } else {
            sitiSprite.setVelocity(0, 0);
            const playerFacing = target.facing || 'down';
            const idleKey = `siti-idle-${playerFacing}`;
            if (this.anims.exists(idleKey) && sitiSprite.anims.currentAnim?.key !== idleKey) {
              sitiSprite.play(idleKey);
            }
          }
        }

        // 3. Quest completion check: Waterfront at night near Rashid's dhow (x:280, y:280)
        // Verify BOTH player and Siti are near the target destination dhow
        if (this.currentMap === 'waterfront' && this.timeOfDay === 'night') {
          const distPlayerToRashid = Phaser.Math.Distance.Between(this.player.x, this.player.y, 280, 280);
          const distSitiToRashid = Phaser.Math.Distance.Between(sitiSprite.x, sitiSprite.y, 280, 280);
          
          if (distPlayerToRashid < 120 && distSitiToRashid < 120) {
            useQuestStore.getState().recordEscort('siti', 'waterfront');
            console.log('Siti successfully escorted to the waterfront at night!');
          }
        }
      } else {
        sitiSprite.setImmovable(true);
        sitiSprite.setVelocity(0, 0);
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
    // Authoritative per-location audio lives in <id>.location.json; this
    // fallback only covers a location id with no data file at all.
    const audio = this.location?.audio;
    const fallback = {
      music: 'music-main',
      nightMusic: 'music-night',
      ambientSounds: [{ key: 'base-tropical', volume: 0.25 }],
      nightAmbientSounds: [{ key: 'base-tropical', volume: 0.18 }, { key: 'night-insects', volume: 0.2 }],
      footstepSurface: 'stone' as FootstepSurface,
    };

    const ambient = this.normalizeAmbientLayers(audio?.ambientSounds);
    const nightAmbient = this.normalizeAmbientLayers(audio?.nightAmbientSounds);

    return {
      music: audio?.music || fallback.music,
      nightMusic: audio?.nightMusic || audio?.music || fallback.nightMusic,
      ambientSounds: ambient.length > 0 ? ambient : fallback.ambientSounds,
      nightAmbientSounds: nightAmbient.length > 0 ? nightAmbient : fallback.nightAmbientSounds,
      footstepSurface: (audio?.footstepSurface as FootstepSurface) || fallback.footstepSurface,
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
      // Kill anything still fading this track in: a tween that survives the
      // destroy() below writes `volume` into a freed WebAudio source, and the
      // exception it throws aborts the WHOLE tween manager step — which is how
      // an audio race ends up freezing the time-of-day plate crossfade.
      this.tweens.killTweensOf(fadingTrack);
      this.tweens.add({
        targets: fadingTrack,
        volume: 0,
        duration: 900,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.tweens.killTweensOf(fadingTrack);
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
        this.tweens.killTweensOf(existing);
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

    this.tweens.killTweensOf(sound);
    this.tweens.add({
      targets: sound,
      volume: 0,
      duration: 700,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tweens.killTweensOf(sound);
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

    // The walk mask carries a surface id per pixel (G channel), so on a
    // composed plate the footstep follows what the player is actually standing
    // on — stone in the street, wood on the arcade boards — instead of one
    // sound for the whole location.
    const footstepSurface = this.walkMask
      ? this.walkMask.footstepAt(this.player.x, this.player.y + WALK_FOOT_OFFSET)
      : this.getSceneAudioConfig().footstepSurface;
    this.playSfx(`sfx-footstep-${footstepSurface}`, 0.24);
    this.nextFootstepAt = this.time.now + 260;
  }

  private updateCinematicMotion() {
    // Keep screen-space grain fixed; motion reads like the exposed terrain base is drifting.
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

    const tint = lighting.tint;
    if (tint === null) {
      this.player.clearTint();
      this.npcs.forEach((npc) => npc.clearTint());
    } else {
      this.player.setTint(tint);
      this.npcs.forEach((npc) => npc.setTint(tint));
    }

    this.lightingAlpha = lighting.alpha;
    this.applyCompositedCharacterAlpha();
  }

  /**
   * Single writer for player/NPC alpha.
   *
   * Time-of-day lighting and stealth mode are independent dimming factors; they
   * multiply so neither clobbers the other (previously the per-time lighting
   * pass fought the stealth subscriber and reset the player to full opacity).
   * Stealth applies to the player only — NPCs never sneak.
   */
  private applyCompositedCharacterAlpha() {
    if (this.player) {
      this.player.setAlpha(this.lightingAlpha * this.stealthAlpha);
    }
    this.npcs.forEach((npc) => npc.setAlpha(this.lightingAlpha));
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
      const available = this.isTransitionAvailable(hotspot.config);
      const visible = available || Boolean(hotspot.config.showWhenLocked);
      const nearby = hotspot.config.targetLocation === targetedTransitionId;

      hotspot.glow.setVisible(visible);
      hotspot.marker.setVisible(visible);
      hotspot.label.setVisible(visible && nearby);
      hotspot.label.setText(available ? hotspot.config.label : (hotspot.config.lockedLabel || hotspot.config.label));

      if (!visible) return;

      hotspot.glow.setAlpha(available ? (nearby ? 0.2 : 0.08) : (nearby ? 0.15 : 0.05));
      hotspot.glow.setScale(nearby ? 1.1 + Math.sin(this.time.now / 260) * 0.06 : 1);
      hotspot.marker.setScale(nearby ? 1 + Math.sin(this.time.now / 210) * 0.15 : 1);
      hotspot.marker.setAlpha(available ? 0.9 : 0.55);
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
