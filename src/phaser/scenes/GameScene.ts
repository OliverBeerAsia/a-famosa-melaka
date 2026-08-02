/**
 * Game Scene - Main Gameplay
 *
 * Handles the game world, player, NPCs, and physics.
 * UI is managed by React - this scene emits events to the bridge.
 */

import Phaser from 'phaser';
import { emitGameEvent } from '../eventBridge';
import { useGameStore } from '../../stores/gameStore';
import { useDialogueStore } from '../../stores/dialogueStore';
import { useQuestStore } from '../../stores/questStore';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';
import { IsometricRenderer } from '../systems/IsometricRenderer';
import { CrowdSystem } from '../systems/CrowdSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { configureWorldDepth } from '../core/depth';
import type { WalkMask } from '../core/WalkMask';
import { formatClock, TIME_PHASE_NAMES, type TimeOfDay } from '../core/timeMath';
import { TimeSystem } from '../systems/TimeSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { AtmosphereSystem } from '../systems/AtmosphereSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { FlickerSystem } from '../systems/FlickerSystem';
import { SurfaceResponseSystem } from '../systems/SurfaceResponseSystem';
import { FeedbackSystem } from '../systems/FeedbackSystem';
import { FaunaSystem } from '../systems/FaunaSystem';
import { WALK_FOOT_OFFSET } from '../systems/PlayerSystem';
import { BackdropSystem } from '../systems/BackdropSystem';
import { NPCSystem, type NPCData } from '../systems/NPCSystem';
import { ResidentSystem } from '../systems/ResidentSystem';
import { OpenableSystem } from '../systems/OpenableSystem';
import { NightWatchSystem } from '../systems/NightWatchSystem';
import { WorldObjectSystem } from '../systems/WorldObjectSystem';
import { activeSwayableProps } from '../systems/EnvironmentObjectSystem';
import { TransitionSystem, type TransitionConfig } from '../systems/TransitionSystem';
import { QuestTriggerSystem } from '../systems/QuestTriggerSystem';
import { PlayerSystem } from '../systems/PlayerSystem';
import { VisualQualitySystem } from '../systems/VisualQualitySystem';
import { UIBridgeSystem } from '../systems/UIBridgeSystem';
import { installDebugHooks } from '../core/devHooks';
import { InteractionSystem } from '../systems/InteractionSystem';
import { directionBetween, type Direction } from '../core/interactionScore';
import { STEALTH_ALPHA } from '../core/lightingMath';
import { showNotification } from '../core/notify';
import type { SystemContext } from '../core/SystemContext';
import { getLocation, type LocationRuntime } from '../core/LocationData';
import { getLocationName } from '../../data/locationNames';
import {
  type ResolvedVisualQuality,
  type VisualProfile,
  type VisualQualityMode,
  resolveVisualQualityMode,
} from '../visualProfile';

export class GameScene extends Phaser.Scene {
  private currentMap: string = 'rua-direita';
  private spawnOverride: { x: number; y: number } | null = null;
  private playerSystem!: PlayerSystem;
  private quality!: VisualQualitySystem;
  private npcSystem!: NPCSystem;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private location: LocationRuntime | undefined;
  /** The world clock. Owns hour/minute/day and the derived phase of day. */
  private clock!: TimeSystem;
  private audio!: AudioSystem;

  private atmosphere!: AtmosphereSystem;
  private lighting!: LightingSystem;
  /** Additive flicker deltas over the plate's baked light pools. */
  private flicker!: FlickerSystem;
  /** Dust, cloth sway and the pier creak. */
  private surfaceResponse!: SurfaceResponseSystem;
  /** The feedback event table: SFX, bursts, flash and the shake policy. */
  private feedback!: FeedbackSystem;
  /** Ambient fauna — scripted indifference at the ground plane. */
  private fauna!: FaunaSystem;
  /** Where the last interaction target stood, for the pickup sparkle. */
  private lastTargetPoint: { x: number; y: number } | null = null;
  /** The NPC currently in dialogue, for the coin burst and hands sparkle. */
  private dialogueNpcPoint: { x: number; y: number } | null = null;
  private cameraSystem: CameraSystem | null = null;
  private backdrop!: BackdropSystem;
  private worldObjects!: WorldObjectSystem;
  private transitions!: TransitionSystem;
  private questTriggers!: QuestTriggerSystem;
  private crowdSystem: CrowdSystem | null = null;
  /** The persistent unnamed inhabitants — the tier between cast and crowd. */
  private residents!: ResidentSystem;
  /** The Ultima VII container verb. */
  private openables!: OpenableSystem;
  /** The counting-house break-in: patrol, detection, consequences. */
  private nightWatch!: NightWatchSystem;
  private weatherSystem: WeatherSystem | null = null;
  private interaction!: InteractionSystem;
  private uiBridge!: UIBridgeSystem;
  /** Store subscriptions the scene owns directly (quest-driven stealth). */
  private storeUnsubscribers: Array<() => void> = [];
  private isResting: boolean = false;

  /**
   * The read-only view of scene state handed to every system.
   *
   * Getters, not values — the scene stays the owner of this state and the
   * systems always see the live version of it.
   */
  private readonly ctx: SystemContext = {
    locationId: () => this.currentMap,
    location: () => this.location,
    timeOfDay: () => this.timeOfDay,
    worldBounds: () => this.worldBounds(),
    visualProfile: () => this.quality.getProfile(),
    quality: () => this.quality.getResolved(),
    player: () => this.player ?? null,
    walkMask: () => this.walkMask,
    isIsometric: () => this.isIsometric,
    isUIOpen: () => this.isAnyUIOpen(),
    hasBakedTimeVariant: () => this.backdrop.hasBakedTimeVariant(),
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  // Read-only views onto the clock. Everything that used to read the scene's
  // own hour/minute/timeOfDay fields still reads exactly the same values —
  // there is simply one owner of them now.
  private get timeOfDay(): TimeOfDay { return this.clock.getPhase(); }
  private get currentHour(): number { return this.clock.getHour(); }
  private get currentMinute(): number { return this.clock.getMinute(); }

  // The backdrop owns the plate, the walk mask and the world's size; the scene
  // reads them through it rather than keeping its own copies.
  private get walkMask(): WalkMask | null { return this.backdrop?.walkMask() ?? null; }
  private get sceneColliders(): Phaser.Physics.Arcade.StaticGroup | null {
    return this.backdrop?.colliders() ?? null;
  }
  private get isIsometric(): boolean { return this.backdrop?.isIsometric() ?? false; }
  /**
   * The player sprite. Non-null from `createPlayer` onward; the `!` matches the
   * pre-decomposition field, which was likewise only valid after create().
   */
  private get player(): Phaser.Physics.Arcade.Sprite {
    return this.playerSystem.getSprite()!;
  }
  private get playerShadow(): Phaser.GameObjects.Ellipse | null {
    return this.playerSystem?.getShadow() ?? null;
  }
  private get npcs(): Phaser.Physics.Arcade.Sprite[] { return this.npcSystem?.getNpcs() ?? []; }
  private get isoRenderer(): IsometricRenderer | null { return this.backdrop?.renderer() ?? null; }

  /**
   * The size of the world the player can move through, in world px.
   * Delegated to the backdrop once it exists; before that (the
   * `configureWorldDepth` call at the top of create) the location's own size is
   * the answer, exactly as it was.
   */
  private worldBounds(): { width: number; height: number } {
    if (this.backdrop) return this.backdrop.worldBounds();
    return this.location?.size ?? { width: GAME_WIDTH, height: GAME_HEIGHT };
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

    this.clock = this.createClock(state.time.hour, state.time.minute || 0, state.time.day);
    // Visual quality is resolved before create() so every system that reads
    // the profile (particles, lights, shadows) sees the right tier first time.
    this.quality = new VisualQualitySystem(
      {
        mode: state.visualQualityMode,
        resolved: state.resolvedVisualQuality,
        dynamic: state.dynamicVisualQuality,
      },
      (resolved) => this.applyVisualQuality(resolved),
    );
  }

  create() {
    console.log('GameScene started - Loading:', this.currentMap);

    // Load location data. src/data/locations/<id>.location.json is the single
    // source of truth; core/LocationData has already scaled every native plate
    // coordinate into this scene's 960x540 world space.
    this.location = getLocation(this.currentMap);
    // The depth band is fixed but the world is not: tell it how tall this
    // location is BEFORE anything Y-sorted is created.
    configureWorldDepth(this.worldBounds().height);

    this.audio = new AudioSystem(this, this.ctx);
    this.backdrop = new BackdropSystem(this, this.ctx);

    // Create scene background (plate, walk mask, occluders, colliders)
    this.backdrop.create();

    // Create atmosphere effects (particles, fog, occlusion, cinematic layers)
    this.atmosphere = new AtmosphereSystem(this, this.ctx);
    this.atmosphere.create();
    this.lighting = new LightingSystem(this, this.ctx, {
      playerShadow: () => this.playerShadow,
      npcs: () => this.npcs,
      npcShadow: (npc) => this.npcSystem?.getShadow(npc),
    });
    this.lighting.createLocationLights();
    useGameStore.getState().setResolvedVisualQuality(this.quality.getResolved());

    // Create the player
    this.playerSystem = new PlayerSystem(this, this.ctx, {
      tileToWorld: (x, y) => (this.isIsometric && this.isoRenderer
        ? this.isoRenderer.tileToWorld(x, y)
        : null),
      colliders: () => this.sceneColliders,
      // One tick, two consumers: the sound, and the ground responding to it.
      // `audio.footstep` owns the throttle and reports whether a step actually
      // sounded, so the dust puff can never drift out of step with the sound.
      footstep: (surface) => {
        if (!this.audio.footstep(surface)) return;
        const body = this.player?.body as Phaser.Physics.Arcade.Body | null;
        const speed = body
          ? Math.hypot(body.velocity.x, body.velocity.y)
          : 0;
        this.surfaceResponse?.onPlayerFootstep(this.player.x, this.player.y, speed);
      },
      input: () => ({
        left: this.cursors.left.isDown || this.keys.a.isDown,
        right: this.cursors.right.isDown || this.keys.d.isDown,
        up: this.cursors.up.isDown || this.keys.w.isDown,
        down: this.cursors.down.isDown || this.keys.s.isDown,
      }),
    });
    this.playerSystem.create(this.spawnOverride);

    this.isResting = false;

    // Create the cast, then pre-fill the breadcrumb trail so an escort
    // follower spawned alongside the player does not lurch on the first frame.
    this.npcSystem = new NPCSystem(this, this.ctx, {
      tileToWorld: (x, y) => (this.isIsometric && this.isoRenderer
        ? this.isoRenderer.tileToWorld(x, y)
        : null),
      colliders: () => this.sceneColliders,
      currentHour: () => this.currentHour,
      currentMinute: () => this.currentMinute,
      onTalk: (npcData) => this.startDialogue(npcData),
      playEffect: (effect) => this.playDoorEffect(effect),
    });
    this.npcSystem.create();
    this.npcSystem.primeTrail();
    this.lighting.applyCharacterLighting(true);

    // Pickups, lore objects and the examine-only painted scenery
    this.worldObjects = new WorldObjectSystem(this, this.ctx, {
      notify: (text) => this.showNotification(text),
    });
    this.worldObjects.create();

    // Traversal and quest interaction hotspots
    this.transitions = new TransitionSystem(this, this.ctx, {
      // TransitionSystem only calls `notify` for a REFUSED exit, so this is
      // exactly the physical-denial case in the feedback table: a blocked
      // route may thud and nudge the camera. A conversational refusal goes
      // through `showNotification` elsewhere and does neither.
      notify: (text) => {
        emitGameEvent('feedback:denied', text, true);
        this.showNotification(text);
      },
      onDeparting: (target) => {
        emitGameEvent('world:transition:start', this.currentMap, target);
        this.audio.playTransitionSound(getLocation(target)?.audio);
      },
    });
    this.transitions.create();

    this.questTriggers = new QuestTriggerSystem(this, this.ctx, {
      notify: (text) => this.showNotification(text),
      worldScale: () => this.location?.world.scale ?? 1,
    });
    this.questTriggers.create();

    // The living-world tier: residents who are always here, containers that
    // open, and (on the waterfront after dark) the watchman.
    this.residents = new ResidentSystem(this, this.ctx, {
      currentHour: () => this.currentHour,
      currentDay: () => useGameStore.getState().time.day,
    });
    this.residents.create();

    this.openables = new OpenableSystem(this, this.ctx, {
      notify: (text) => this.showNotification(text),
      witnesses: () => this.witnessPositions(),
      playSfx: (key, scale) => this.audio.playSfx(key, scale),
    });
    this.openables.create();

    this.nightWatch = new NightWatchSystem(this, this.ctx, {
      notify: (text) => this.showNotification(text),
      playSfx: (key, scale) => this.audio.playSfx(key, scale),
      travelTo: (locationId, spawnAt) => this.transitions.switchLocation(locationId, spawnAt),
      advanceHours: (hours) => this.advanceTime(hours, false),
      currentHour: () => this.currentHour,
      setCutscene: (active) => { this.isResting = active; },
    });
    this.nightWatch.create();

    // Interaction targeting. Each family of interactables registers itself as
    // a provider; the system scores and ranks them with the pure logic in
    // core/interactionScore.
    this.interaction = new InteractionSystem(this, this.ctx, {
      facing: () => (useGameStore.getState().player.facing || 'down') as Direction,
      facePlayerToward: (x, y) => {
        this.playerSystem.setFacing(directionBetween(this.player.x, this.player.y, x, y));
      },
    });
    this.npcSystem.registerInteractions(this.interaction);
    this.worldObjects.registerInteractions(this.interaction);
    this.transitions.registerInteractions(this.interaction);
    this.questTriggers.registerInteractions(this.interaction);
    this.openables.registerInteractions(this.interaction);
    this.nightWatch.registerInteractions(this.interaction);
    // Residents last: they are offered at scenery priority and must never
    // outrank a named NPC, a pickup or an exit.
    this.residents.registerInteractions(this.interaction);

    // Initialize atmosphere systems
    this.crowdSystem = new CrowdSystem(this, this.quality.getResolved());
    this.crowdSystem.initialize(this.currentMap);
    this.crowdSystem.setTimeOfDay(this.timeOfDay);

    this.weatherSystem = new WeatherSystem(this, this.quality.getResolved());
    this.weatherSystem.initialize();
    this.weatherSystem.setLocation(this.currentMap);
    this.weatherSystem.setTimeOfDay(this.timeOfDay);

    // Sprite-backed and animated props (torches, flags, seagulls)
    this.worldObjects.createEnvironment();

    // Set up camera
    this.setupCamera();

    // The juice layer. Order matters only in that the flicker cap is chosen by
    // distance to the camera centre, so the camera has to exist first.
    this.flicker = new FlickerSystem(this, this.ctx);
    this.flicker.create();

    this.surfaceResponse = new SurfaceResponseSystem(this, this.ctx, {
      playSfx: (key, scale, detune) => this.audio.playSfx(key, scale, detune),
      // NPCs and crowd members raise dust at a quarter of the player's rate —
      // this is what makes the CITY kick up dust and not just the player.
      movers: () => this.collectMovers(),
      swayables: () => activeSwayableProps(),
      footOffset: () => WALK_FOOT_OFFSET,
    });
    this.surfaceResponse.create();

    // Fauna share the crowd's ceiling, so they need to see how many crowd
    // members are already alive.
    this.fauna = new FaunaSystem(this, this.ctx, () => this.crowdCount());
    this.fauna.create();

    this.feedback = new FeedbackSystem(this, this.ctx, {
      playSfx: (key, scale) => this.audio.playSfx(key, scale),
      flash: (amount, duration, colour) => this.atmosphere.flash(amount, duration, colour),
      setHeldFlash: (amount, duration) => this.atmosphere.setHeldFlash(amount, duration),
      shake: (intensity, duration) => this.cameraSystem?.shake(intensity, duration),
      lastInteractionPoint: () => this.lastTargetPoint,
      dialoguePoint: () => this.dialogueNpcPoint,
    });
    this.feedback.create();

    // Set up input
    this.setupInput();

    // Set up React event listeners
    this.uiBridge = new UIBridgeSystem(this, {
      currentHour: () => this.currentHour,
      isUIOpen: () => this.isAnyUIOpen(),
      notify: (text) => this.showNotification(text),
      playSfx: (key, scale) => this.audio.playSfx(key, scale),
      setMusicVolume: (v) => this.audio.setMusicVolume(v),
      setAmbientVolume: (v) => this.audio.setAmbientVolume(v),
      setVisualMode: (mode) => this.quality.setMode(mode),
      setDynamicVisual: (enabled) => this.quality.setDynamic(enabled),
      travelTo: (locationId) => this.transitions.switchLocation(locationId),
      endDialogueAnimation: () => this.npcSystem?.stopDialogueAnimation(),
      freezePlayer: () => {
        this.playerSystem.halt();
        // Player anims are registered UNPREFIXED in BootScene ('idle-down').
        const facing = useGameStore.getState().player.facing || 'down';
        this.player?.anims.play(`idle-${facing}`, true);
      },
      advanceTime: (hours, animate) => this.advanceTime(hours, animate),
      setMinute: (minute) => this.clock.setMinute(minute),
      setResting: (resting) => {
        this.isResting = resting;
        useGameStore.getState().setResting(resting);
        // Showing the hours PASS is worth more than a number changing, so the
        // React layer gets both ends of the rest as separate events.
        if (resting) emitGameEvent('player:rest:start', 0);
        else emitGameEvent('player:rest:complete', this.currentHour, this.timeOfDay);
      },
    });
    this.uiBridge.create();

    // Create the time-of-day overlay and resolve the real phase of day. The
    // clock starts on 'day' whatever the hour is (see createClock) so this is
    // the sync that crossfades a night arrival onto the baked night plate.
    this.lighting.createOverlay();
    this.clock.syncPhase();
    this.lighting.applyLightingForTime(false);

    // Update game store with location
    this.updateLocationState();

    // Start location music and ambience once time-of-day state is resolved
    this.syncLocationAudio(true);

    // Show location name
    this.transitions.showLocationName();
    // The scene is built and on screen: the asymmetric arrival beat (fade out
    // fast, fade in slow) hangs off this.
    emitGameEvent('world:transition:complete', this.currentMap);

    // DEV-only acceptance hook (see core/devHooks for what it is for).
    if (import.meta.env.DEV) this.installDebugHooks();

    this.interaction.createPrompt();

    // Subscribe to quest changes to handle stealth mode opacity on theft path
    const unsubQuest = useQuestStore.subscribe((state) => {
      const stage = state.getQuestStage('merchants-seal');
      if (stage?.id === 'theft-success') {
        if (this.player && this.lighting.getStealthAlpha() !== STEALTH_ALPHA) {
          // Claim the stealth factor immediately so a re-fired subscription
          // can't restart the fade; it is composited once the screen is black.
          this.lighting.setStealthAlpha(STEALTH_ALPHA);
          this.isResting = true;
          this.cameras.main.fadeOut(500, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            if (this.player) {
              this.lighting.applyCompositedAlpha();
              this.player.setPosition(620, 250);
            }
            this.cameras.main.fadeIn(500, 0, 0, 0);
            this.cameras.main.once('camerafadeincomplete', () => {
              this.isResting = false;
            });
          });
        }
      } else if (this.lighting.getStealthAlpha() !== 1.0) {
        this.lighting.setStealthAlpha(1.0);
      }
    });
    this.storeUnsubscribers.push(unsubQuest);

    // Emit game ready
    emitGameEvent('game:ready');

    // Walk-mask collision has to run after Arcade physics has moved the body,
    // which is POST_UPDATE — resolving in update() would always be one frame
    // stale and let the player's feet cross into a wall before being pushed out.
    this.events.on(
      Phaser.Scenes.Events.POST_UPDATE,
      () => this.playerSystem.applyWalkMaskCollision(),
      this,
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  /**
   * Put a plate into the world at 1:1 world pixels, top-left anchored.
   *
   * The plate is world-space (scroll factor 1) even when it exactly fills the
   * viewport: at that size scrolling is clamped to (0,0) so the two are
   * identical, and having ONE placement rule is what stops the flip-screen and
   * scrolling paths from drifting apart.
   */
  /** Load the location's walk mask into a sampler, if it ships one. */
  /**
   * Foreground occluders: the pieces of the plate a character can walk BEHIND.
   *
   * They are drawn at the exact pixels they were cut from, so while nothing is
   * behind them they are invisible (they reproduce the plate underneath), and
   * `worldDepth(depthY)` puts them in front of any character standing further
   * up the street. Relit per time of day by the same LUT as the plate.
   */
  /** Crossfade the occluders alongside the plate when the hour changes. */
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
        this.interaction.tryInteract();
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
            this.transitions.switchLocation(locations[index]);
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

  private cleanup() {
    // Clean up atmosphere systems
    this.crowdSystem?.destroy();
    this.crowdSystem = null;
    this.weatherSystem?.destroy();
    this.weatherSystem = null;

    this.backdrop?.destroy();

    this.audio?.destroy();
    this.npcSystem?.stopDialogueAnimation();
    this.uiBridge?.destroy();
    this.storeUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.storeUnsubscribers = [];
    this.transitions?.destroy();
    this.questTriggers?.destroy();
    this.residents?.destroy();
    this.openables?.destroy();
    this.nightWatch?.destroy();
    this.npcSystem?.destroy();
    this.lighting?.destroy();
    this.flicker?.destroy();
    this.fauna?.destroy();
    this.surfaceResponse?.destroy();
    this.feedback?.destroy();
    this.atmosphere?.destroy();
    this.quality?.destroy();
    this.playerSystem?.destroy();
    this.worldObjects?.destroy();
    this.interaction?.destroy();
  }

  /**
   * The quality tier moved: rebuild the layers whose geometry depends on it.
   *
   * Order matters and matches the pre-decomposition `applyVisualProfile`:
   * practical lights, then the atmosphere layers, then a forced re-light of the
   * cast (whose tint the rebuild does not touch).
   */
  private applyVisualQuality(resolved: ResolvedVisualQuality) {
    useGameStore.getState().setResolvedVisualQuality(resolved);
    this.lighting?.applyQuality();
    this.flicker?.applyQuality();
    this.fauna?.applyQuality();
    this.atmosphere?.applyQuality();
    this.lighting?.applyCharacterLighting(true);
  }

  /** Publish the stable acceptance surface. See core/devHooks. */
  private installDebugHooks() {
    installDebugHooks({
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
      walkable: (x, y) => this.playerSystem.canStandAt(x, y),
      place: (x, y) => { this.player.setPosition(x, y); },
      transitions: () => this.transitions.listExits(),
      travel: (target, spawnPoint) => this.transitions.switchLocation(target, spawnPoint),
      interact: () => this.interaction.tryInteract(),
      advanceTime: (hours) => this.advanceTime(hours),
      clock: () => ({
        hour: this.currentHour,
        minute: this.currentMinute,
        day: useGameStore.getState().time.day,
      }),
      nightWatch: () => {
        const at = this.nightWatch?.position() ?? null;
        return {
          onDuty: this.nightWatch?.isOnDuty() ?? false,
          state: this.nightWatch?.getState() ?? 'none',
          alertLevel: this.nightWatch?.getAlertLevel() ?? 0,
          x: at?.x ?? null,
          y: at?.y ?? null,
          dousedLights: this.nightWatch?.dousedLights() ?? [],
        };
      },
      residents: () => this.residents?.list() ?? [],
      npcs: () => this.npcs.map((npc) => ({
        id: this.npcSystem.getData(npc)?.id ?? null,
        x: npc.x,
        y: npc.y,
      })),
      target: () => {
        const t = this.interaction.getActiveTarget();
        return t ? { type: t.type, id: t.id, label: t.label } : null;
      },
      setQuality: (mode, dynamic) => {
        if (dynamic !== undefined) this.quality.setDynamic(dynamic);
        this.quality.setMode(mode);
      },
      juice: () => {
        const propPhases: Record<string, number[]> = {};
        activeSwayableProps().forEach((prop) => {
          const anims = (prop.sprite as Phaser.GameObjects.Sprite).anims;
          if (!anims?.currentFrame) return;
          (propPhases[prop.type] ||= []).push(anims.currentFrame.index);
        });
        const flickerPhases: Record<string, number[]> = {};
        this.flicker?.debugPhases().forEach((f) => {
          (flickerPhases[f.type] ||= []).push(f.step);
        });
        return {
          ...this.atmosphere.debugLens(),
          propPhases,
          flickerPhases,
          surfacePool: {
            live: this.surfaceResponse?.liveCount() ?? 0,
            capacity: this.surfaceResponse?.poolSize() ?? 0,
          },
          water: this.atmosphere.debugWater(),
          fauna: this.fauna?.debugFauna() ?? [],
          crowd: this.crowdCount(),
        };
      },
      counts: () => ({
        npcs: this.npcs.length,
        items: this.worldObjects.itemCount(),
        lore: this.worldObjects.loreCount(),
        scenery: this.worldObjects.hotspotCount(),
        overlays: this.backdrop.overlayCount(),
        crowd: this.crowdSystem?.getCrowdCount() ?? null,
        crowdOnScreen: this.crowdSystem?.getOnScreenCount(this.cameras.main) ?? null,
        residents: this.residents?.count() ?? 0,
        residentsOnScreen: this.residents?.onScreenCount(this.cameras.main) ?? 0,
        openables: this.openables?.count() ?? 0,
      }),
    });
  }

  private showNotification(text: string) {
    showNotification(this, text);
  }

  /**
   * Everyone who could see the player open something.
   *
   * The openables system owns none of these populations, so it asks: named
   * NPCs, ambient residents and, for the crowd, the fact that a transient is on
   * the same screen at all. Deliberately generous — being seen should be the
   * default in a busy street at noon.
   */
  private witnessPositions(): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = this.npcs.map((npc) => ({ x: npc.x, y: npc.y }));
    this.residents?.list().forEach((resident) => out.push({ x: resident.x, y: resident.y }));
    return out;
  }

  /**
   * The door vocabulary (spec 2.2), mapped onto the shipped SFX bank.
   *
   * The distinction between `curtain` and `door-creak` is not decoration: a
   * Malay stilt house has a cloth doorway and a Portuguese warehouse has a bar
   * and a latch, and the player hears the difference between the two quarters
   * before noticing they have heard anything. Until the bank carries real
   * shutter/plank/curtain cues, the mapping approximates with volume — see the
   * bridge/asset wishlist in the Stage 5 report.
   */
  private playDoorEffect(effect: string) {
    switch (effect) {
      case 'door-creak': this.audio.playSfx('sfx-door-open', 1); break;
      case 'door-iron': this.audio.playSfx('sfx-gate-creak', 0.9); break;
      case 'church-door': this.audio.playSfx('sfx-gate-creak', 0.65); break;
      case 'shutter': this.audio.playSfx('sfx-door-open', 0.7); break;
      case 'shutter-bar':
        this.audio.playSfx('sfx-door-open', 0.7);
        this.time.delayedCall(220, () => this.audio.playSfx('sfx-gate-creak', 0.85));
        break;
      case 'plank-creak': this.audio.playSfx('sfx-door-open', 0.45); break;
      // A cloth doorway has no latch. Silence is the correct cue.
      case 'curtain':
      case 'none':
      default:
        break;
    }
  }

  /**
   * Every non-player character that can raise dust: the scheduled cast plus
   * the crowd. Read through the same private-field probe the DEV acceptance
   * hook already uses, so `CrowdSystem` needs no new public surface.
   */
  /** Live crowd members, read through the same probe the dev hook uses. */
  private crowdCount(): number {
    const crowd = (this.crowdSystem as unknown as { crowdMembers?: unknown[] })?.crowdMembers;
    return Array.isArray(crowd) ? crowd.length : 0;
  }

  private moverBuffer: Array<{ x: number; y: number }> = [];
  private collectMovers(): Array<{ x: number; y: number }> {
    // Reused array: this is called once per frame and must not allocate.
    this.moverBuffer.length = 0;
    const npcs = this.npcs;
    for (let i = 0; i < npcs.length; i++) this.moverBuffer.push(npcs[i]);
    const crowd = (this.crowdSystem as unknown as {
      crowdMembers?: Array<{ sprite?: { x: number; y: number } } & { x?: number; y?: number }>;
    })?.crowdMembers;
    if (Array.isArray(crowd)) {
      for (let i = 0; i < crowd.length; i++) {
        const m = crowd[i];
        const point = m?.sprite ?? (typeof m?.x === 'number' ? m as { x: number; y: number } : null);
        if (point) this.moverBuffer.push(point as { x: number; y: number });
      }
    }
    return this.moverBuffer;
  }

  /**
   * Build the world clock and connect it to everything that reacts to time.
   *
   * The clock itself is pure (see systems/TimeSystem) — this is the entire
   * surface where a moved hour becomes a relit plate, a re-scheduled cast and
   * a crossfaded music track.
   *
   * It deliberately starts on the neutral 'day' phase whatever the hour is:
   * the real phase is resolved by the `syncPhase()` call in `createLighting()`,
   * once the lighting rig and plate exist to be crossfaded.
   */
  private createClock(hour: number, minute: number, day: number): TimeSystem {
    return new TimeSystem({ hour, minute, day, phase: 'day' }, {
      onPhaseChanged: (phase, previous, animate) => {
        this.lighting.setTimeOfDay(animate);
        this.flicker?.setTimeOfDay();
        this.fauna?.setTimeOfDay();
        this.atmosphere.setTimeOfDay();
        this.backdrop.setTimeOfDay();
        this.syncLocationAudio();

        // Update atmosphere systems with new time
        this.crowdSystem?.setTimeOfDay(phase);
        this.weatherSystem?.setTimeOfDay(phase);
        this.worldObjects.setTimeOfDay();

        console.log(`Time changed: ${previous} → ${phase} (hour: ${this.clock.getHour()})`);
      },
      onTimeChanged: (snapshot, movedHours) => {
        useGameStore.getState().updateTime(movedHours
          ? {
            hour: snapshot.hour,
            day: snapshot.day,
            timeOfDay: snapshot.phase,
            minute: snapshot.minute,
          }
          : { minute: snapshot.minute });
      },
      onDayPassed: (dayDelta, day) => {
        emitGameEvent('time:day-passed', dayDelta, day);
      },
      onHoursAdvanced: (snapshot) => {
        this.showNotification(
          `Time: ${formatClock(snapshot.hour, snapshot.minute)} - ${TIME_PHASE_NAMES[snapshot.phase]}`
        );
        // Refresh NPC scheduled layouts. Freshly-spawned sprites carry no
        // tint, and this runs at every schedule change — including the one the
        // clock fires AFTER a phase change — so the re-light is forced.
        // Per-NPC slot transition, NOT a destroy-and-rebuild: an NPC whose
        // slot did not change is left entirely alone, and one whose slot did
        // is usually already walking (see NPCSystem.prepareDeparture).
        this.npcSystem.onHourChanged();
        this.residents?.refresh();
        this.nightWatch?.onHourChanged();
        this.lighting.applyCharacterLighting(true);
      },
    });
  }

  private advanceTime(hours: number, animate: boolean = true) {
    this.clock.advanceHours(hours, animate);
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

  /** Pick a world item up: notify, emit, and remove it from the world. */
  private isAnyUIOpen(): boolean {
    const state = useGameStore.getState();
    return this.isResting || state.isDialogueOpen || state.isInventoryOpen || state.isJournalOpen || state.isMessageOpen || state.isPaused;
  }

  private startDialogue(npcData: NPCData) {
    this.npcSystem.stopDialogueAnimation();
    this.player.setVelocity(0, 0);

    const npc = this.npcSystem.beginDialogue(npcData.id);
    if (npc) {
      this.playerSystem.setFacing(directionBetween(this.player.x, this.player.y, npc.x, npc.y));
      // Where the coin burst and the hands sparkle happen.
      this.dialogueNpcPoint = { x: npc.x, y: npc.y };
    }

    this.interaction.clear();

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

  update(time: number, delta: number) {
    this.quality.update(this.game.loop.delta);

    this.atmosphere.update();
    this.flicker.update();
    this.lighting.updateCharacterShadows();

    // Update atmosphere systems
    this.crowdSystem?.update(time, delta);
    this.weatherSystem?.update(time, delta);
    // Dust decays and cloth eases back whether or not a panel is open, so
    // this runs BEFORE the UI early-out — a puff frozen mid-air behind an
    // inventory panel is the sort of detail that reads as a broken frame.
    this.surfaceResponse.update(delta);
    this.fauna.update(time, delta);

    // Tick the world clock (1 game minute every 2.5 real seconds)
    if (!this.isAnyUIOpen()) {
      this.clock.update(delta);
    }

    // Don't update if UI is open
    if (this.isAnyUIOpen()) {
      this.player.setVelocity(0, 0);
      this.interaction.clear();
      return;
    }

    // Player movement
    this.playerSystem.update();

    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    this.cameraSystem?.update(delta, body?.velocity.x ?? 0, body?.velocity.y ?? 0);

    this.backdrop.update(this.player.x, this.player.y);

    this.interaction.update();
    const target = this.interaction.getActiveTarget();
    // Remember where the target stood: `item:pickup` fires AFTER the sprite is
    // gone, and the sparkle has to happen where the item was.
    if (target) this.lastTargetPoint = { x: target.x, y: target.y };

    // Y-depth sorting (both legacy-backdrop and isometric modes) so moving
    // characters occlude/are occluded by props at the correct y. The player's
    // own depth is set by PlayerSystem as it moves.
    // Depth-sort the cast, run followers, and light the targeted NPC.
    this.npcSystem.update(target?.type === 'npc' ? target.id : null);
    this.residents.update();
    this.nightWatch.update(time, delta);
    this.worldObjects.update(time, delta, target?.type === 'item' ? target.id : null);
    this.transitions.update(target?.type === 'transition' ? target.id : null);
    this.questTriggers.update(target?.type === 'quest' ? target.id : null);

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
  private syncLocationAudio(force: boolean = false) {
    this.audio.syncLocationAudio(force);
  }

  private playSfx(soundKey: string, volumeScale: number = 1) {
    this.audio.playSfx(soundKey, volumeScale);
  }

  /**
   * Single writer for player/NPC alpha.
   *
   * Time-of-day lighting and stealth mode are independent dimming factors; they
   * multiply so neither clobbers the other (previously the per-time lighting
   * pass fought the stealth subscriber and reset the player to full opacity).
   * Stealth applies to the player only — NPCs never sneak.
   */
}
