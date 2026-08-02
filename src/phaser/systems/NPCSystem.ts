/**
 * NPCSystem — the cast: who is present, where they stand, which way they look,
 * and who is walking with the player.
 *
 * Presence is data-driven. `npcs.json` gives each character a home location and
 * an optional schedule; `<id>.location.json` can override where they stand.
 * Every time the hour rolls over the scene calls `recreate()`, the schedule is
 * re-evaluated, and the cast on screen changes.
 *
 * The escort follower is no longer a special case welded into the update loop:
 * the player lays a `BreadcrumbTrail`, and any NPC with a `FollowBehavior`
 * walks it. That is the seam Stage 5's schedule walking extends — swap the
 * trail for a path over the walk mask and the steering, catch-up and
 * teleport-recovery already work.
 */

import Phaser from 'phaser';
import { CHARACTER_SCALE, GAME_WIDTH, GAME_HEIGHT, PLAYER_SPEED } from '../game';
import { worldDepth, DEPTH_UI_INDICATOR } from '../core/depth';
import { BreadcrumbTrail } from '../core/breadcrumbTrail';
import { directionBetween, type Direction } from '../core/interactionScore';
import { FollowBehavior } from './behaviors/FollowBehavior';
import { WalkToBehavior, pathLength } from './behaviors/WalkToBehavior';
import { findPathVia, type Point } from '../core/pathfind';
import {
  resolveBeat,
  resolveDeparture,
  resolveSlot,
  resolveSlotIndex,
  slotStation,
  slotVisibility,
  travelGameMinutes,
  type ScheduleBeat,
  type ScheduleSlot,
} from '../core/schedule';
import { getLocation } from '../core/LocationData';
import type { SystemContext } from '../core/SystemContext';
import {
  INTERACTION_PRIORITY,
  INTERACTION_RADIUS,
} from '../core/interactionScore';
import type {
  InteractionCandidate,
  InteractionScan,
  InteractionSystem,
} from './InteractionSystem';
import { useDialogueStore } from '../../stores/dialogueStore';
import { useGameStore } from '../../stores/gameStore';
import { useQuestStore } from '../../stores/questStore';

export interface NPCData {
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
  schedule?: ScheduleSlot[];
  beats?: ScheduleBeat[];
}

/** Sprites are anchored above their feet; this is the ground offset. */
const FOOT_OFFSET = 48;
/**
 * How high above an NPC the interaction pip floats.
 *
 * Computed on call, not at module load: `../game` imports GameScene, which
 * imports this module, so reading CHARACTER_SCALE at module scope hits the
 * circular import's temporal dead zone and takes the whole app down with
 * "Cannot access 'CHARACTER_SCALE' before initialization".
 */
const indicatorOffset = () => 20 * CHARACTER_SCALE;
/** Crumbs pre-laid on spawn so a follower does not snap across the screen. */
const FOLLOWER_PREFILL = 15;

/**
 * Walking pace for a scheduled NPC, world px/s.
 *
 * Slower than the player (PLAYER_SPEED 200) on purpose: an NPC who crosses the
 * street at the player's speed reads as chasing something. 90 is the same pace
 * the night watch keeps and puts Aminah's full-length Rua Direita walk at ~22
 * seconds, inside the spec's 20-35 s acceptance band.
 */
const NPC_WALK_SPEED = 90;
/** Half the NPC body, world px — used to keep A* off wall-hugging routes. */
const NPC_HALF_WIDTH = 9;
/** Sprite origin to feet, world px. The mask is a floor; the origin is not. */
const NPC_FOOT_OFFSET = 45;
/** How often the schedule is re-examined, ms. Once a second is plenty. */
const SCHEDULE_TICK_MS = 500;
/** How far ahead (game minutes) a walk may be prepared before it departs. */
const PREP_HORIZON_MINUTES = 45;
/** Door pause and fade, ms — the "gone indoors" fiction (spec 2.2). */
const DOOR_PAUSE_MS = 200;
/**
 * A shutter is not a door: Lin Mei turns her back and works the lock for four
 * seconds with an audible key, every day, whether or not the player is on the
 * theft path. It is telegraph T2, and the player who is planning a burglary has
 * just watched exactly where the lock is and exactly who has the key.
 */
const SHUTTER_PAUSE_MS = 4000;
const DOOR_FADE_MS = 350;
/** Cross-fade for an off-camera teleport. */
const TELEPORT_FADE_MS = 400;

/**
 * Per-NPC schedule state.
 *
 * The slot index is what makes a CHANGE detectable: an NPC who is in slot 3
 * this frame and slot 4 next frame has somewhere to be, and everything else in
 * this file hangs off that one transition.
 */
interface ScheduleState {
  /** Slot index the NPC is currently living in; -1 before the first resolve. */
  slotIndex: number;
  walker: WalkToBehavior | null;
  /** What the current walk is FOR. */
  intent: 'station' | 'exit' | null;
  /** The slot the current walk is heading into. */
  targetSlot: ScheduleSlot | null;
  /** A prepared but not yet departed walk. */
  pending: { index: number; path: Point[]; leadMinutes: number } | null;
  /** Business-idle key from the data. Tier-0 renders it as a breath. */
  idleKey: string | null;
  breath: Phaser.Tweens.Tween | null;
  /** The beat currently holding, so a beat is applied once rather than per frame. */
  beatKind: string | null;
}

/**
 * The one escort the demo ships. Kept as data rather than branching so the
 * Stage 5 pass can add entries (or read them from quest data) without
 * reopening the update loop.
 */
const ESCORTS = [{
  npcId: 'siti',
  objectiveType: 'escort',
  /** Where the escort is discharged, and how close both parties must be. */
  destination: { locationId: 'waterfront', x: 280, y: 280, radius: 120, requiresNight: true },
}];

export interface NPCSystemDeps {
  /** Iso path only: convert authored tile coordinates to world px. */
  tileToWorld(x: number, y: number): { x: number; y: number } | null;
  /** Static colliders the follower should also collide with, if any. */
  colliders(): Phaser.Physics.Arcade.StaticGroup | null;
  /** Current hour, for schedule resolution. */
  currentHour(): number;
  /** Current minute, for departure timing and beats. */
  currentMinute?(): number;
  /** Open dialogue with an NPC (the scene owns the dialogue store wiring). */
  onTalk(npcData: NPCData): void;
  /** Play a door/curtain/shutter cue. Optional — silence is a valid engine. */
  playEffect?(effect: string): void;
}

export class NPCSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: NPCSystemDeps;

  private sprites: Phaser.Physics.Arcade.Sprite[] = [];
  private dataMap = new Map<Phaser.Physics.Arcade.Sprite, NPCData>();
  private spriteById = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private animationPrefixMap = new Map<Phaser.Physics.Arcade.Sprite, string>();
  private facingMap = new Map<Phaser.Physics.Arcade.Sprite, Direction>();
  private shadowMap = new Map<Phaser.Physics.Arcade.Sprite, Phaser.GameObjects.Ellipse>();
  private activeDialogueNpc: Phaser.Physics.Arcade.Sprite | null = null;

  private trail = new BreadcrumbTrail();
  private followers = new Map<string, FollowBehavior>();
  private followerColliderAdded = false;

  private scheduleState = new Map<string, ScheduleState>();
  private lastScheduleTick = 0;
  /** Sprites mid-despawn: excluded from the roster so nothing re-targets them. */
  private departing = new Set<Phaser.Physics.Arcade.Sprite>();

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: NPCSystemDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  // -- reads ---------------------------------------------------------------

  getNpcs(): Phaser.Physics.Arcade.Sprite[] { return this.sprites; }
  getData(npc: Phaser.Physics.Arcade.Sprite): NPCData | undefined { return this.dataMap.get(npc); }
  getSpriteById(id: string): Phaser.Physics.Arcade.Sprite | undefined { return this.spriteById.get(id); }
  getShadow(npc: Phaser.Physics.Arcade.Sprite) { return this.shadowMap.get(npc); }
  getTrail(): BreadcrumbTrail { return this.trail; }

  // -- spawning ------------------------------------------------------------

  /** Spawn the cast for this location and hour. */
  create() {
    this.clearSprites();

    const npcData = useDialogueStore.getState().allNPCData as unknown as Record<string, NPCData>;
    if (!npcData || Object.keys(npcData).length === 0) {
      console.warn('NPC data not loaded');
      return;
    }

    Object.values(npcData).forEach((data) => {
      // The dialogue store's table is merged from quest overrides and can carry
      // a hole; a hole is not a person.
      if (!data || !data.id) return;
      const isFollower = this.isActiveEscort(data.id);
      if (!isFollower && !this.isAvailableNow(data)) return;

      const spawn = this.spawnPointFor(data, isFollower);
      const npc = this.spawnNpc(data, spawn, isFollower);
      // Face the way the live slot says, and start its business idle.
      const slot = resolveSlot(data.schedule, this.deps.currentHour());
      if (slot) this.applyStationPose(npc, slot);
    });
  }

  /**
   * Where an NPC stands right now, in world px.
   *
   * Precedence: the live schedule slot's `station` (native px, Stage 5) beats
   * the location file's authored anchor, which beats the NPC's own legacy
   * `position`. Stations are the reason the cast is in the right PLACE before
   * any of them can walk — spec ordering step 4.
   */
  private spawnPointFor(data: NPCData, isFollower: boolean): Point {
    const player = this.ctx.player();
    const npcOverrides = this.ctx.location()?.npcPositions || {};

    if (isFollower && data.location !== this.ctx.locationId()) {
      return { x: (player?.x ?? GAME_WIDTH / 2) - 30, y: player?.y ?? GAME_HEIGHT / 2 };
    }

    const slot = resolveSlot(data.schedule, this.deps.currentHour());
    const station = slotStation(slot, null);
    if (station) return this.toWorld(station);

    if (npcOverrides[data.id]) return { ...npcOverrides[data.id] };

    let x = data.position?.x || GAME_WIDTH / 2;
    let y = data.position?.y || GAME_HEIGHT / 2;
    // In isometric mode, npcPositions are tile coordinates — convert to world.
    const worldPos = this.deps.tileToWorld(x, y);
    if (worldPos) { x = worldPos.x; y = worldPos.y; }
    return { x, y };
  }

  /** Native plate px -> world px, using the location's single scale factor. */
  private toWorld(p: Point): Point {
    const scale = this.ctx.location()?.world.scale ?? 1;
    return { x: p.x * scale, y: p.y * scale };
  }

  /** Build the sprite, shadow, indicator and schedule state for one NPC. */
  private spawnNpc(data: NPCData, at: Point, isFollower: boolean): Phaser.Physics.Arcade.Sprite {
    const sheetKey = `${data.sprite || data.id}-sheet`;
    const npcTexture = this.scene.textures.exists(sheetKey) ? sheetKey : 'debug-character-missing';
    if (npcTexture === 'debug-character-missing') {
      console.warn(
        `[NPCSystem] ${data.id} has no sprite sheet '${sheetKey}' — falling back to `
        + 'debug-character-missing. The cast will render as a placeholder.'
      );
    }
    const npc = this.scene.physics.add.sprite(at.x, at.y, npcTexture);

    // Scale up NPC to match scene backgrounds (same as player)
    npc.setScale(CHARACTER_SCALE);
    npc.setImmovable(!isFollower);
    npc.setDepth(worldDepth(at.y + FOOT_OFFSET));

    const shadow = this.scene.add.ellipse(at.x, at.y + 40, 50, 18, 0x000000, 0.24);
    shadow.setDepth(npc.depth - 1);
    this.shadowMap.set(npc, shadow);

    this.dataMap.set(npc, data);
    this.spriteById.set(data.id, npc);
    this.facingMap.set(npc, 'down');
    const prefix = this.resolveAnimationPrefix(data) || '';
    this.animationPrefixMap.set(npc, prefix);
    this.sprites.push(npc);

    if (prefix && this.scene.anims.exists(`${prefix}-idle-down`)) {
      npc.play(`${prefix}-idle-down`);
    }

    // Add interaction indicator (golden dot) - adjusted for scaled NPC
    const indicator = this.scene.add.circle(at.x, at.y - indicatorOffset(), 8, 0xFFD700);
    indicator.setVisible(false);
    indicator.setDepth(DEPTH_UI_INDICATOR);
    (npc as unknown as { indicator: Phaser.GameObjects.Arc }).indicator = indicator;

    if (isFollower) {
      this.followers.set(data.id, new FollowBehavior(this.scene, prefix || data.id));
    }

    this.scheduleState.set(data.id, {
      slotIndex: resolveSlotIndex(data.schedule, this.deps.currentHour()),
      walker: null,
      intent: null,
      targetSlot: null,
      pending: null,
      idleKey: null,
      breath: null,
      beatKind: null,
    });

    return npc;
  }

  /**
   * Pre-fill the trail so a follower spawned alongside the player does not lurch
   * on the first frame of a scene.
   */
  primeTrail() {
    const player = this.ctx.player();
    if (!player || this.followers.size === 0) return;
    this.trail.prefill(FOLLOWER_PREFILL, {
      x: player.x,
      y: player.y,
      facing: useGameStore.getState().player.facing || 'down',
      walking: false,
    });
  }

  /**
   * Rebuild the cast from scratch.
   *
   * Kept for the cases that genuinely need it (a fresh scene, a debug jump);
   * the HOUR change no longer goes through here — see `onHourChanged`.
   */
  recreate() {
    this.create();
    this.followerColliderAdded = false;
  }

  private clearSprites() {
    this.scheduleState.forEach((state) => {
      state.breath?.remove();
      state.walker?.cancel();
    });
    this.scheduleState.clear();
    this.departing.clear();
    this.sprites.forEach((npc) => {
      const indicator = (npc as unknown as { indicator?: Phaser.GameObjects.Arc }).indicator;
      if (indicator) indicator.destroy();
      const shadow = this.shadowMap.get(npc);
      if (shadow) shadow.destroy();
      npc.destroy();
    });
    this.sprites = [];
    this.dataMap.clear();
    this.spriteById.clear();
    this.animationPrefixMap.clear();
    this.facingMap.clear();
    this.shadowMap.clear();
    this.followers.clear();
    this.activeDialogueNpc = null;
  }

  // -- schedules -----------------------------------------------------------

  /**
   * Is this NPC on stage at this location and hour?
   *
   * "On stage" is VISIBILITY, not dialogue availability — see
   * `core/schedule.slotVisibility`. Pak Salleh kneeling at the surau is
   * `available: false` and is still the most watchable thing in the kampung.
   */
  isAvailableNow(data: NPCData): boolean {
    return this.visibility(data).visible;
  }

  /** Visibility + talkability for the live slot. */
  private visibility(data: NPCData) {
    const slot = resolveSlot(data.schedule, this.deps.currentHour());
    return slotVisibility(
      slot,
      this.ctx.locationId(),
      data.location,
      (id) => Boolean(getLocation(id)),
    );
  }

  private resolveAnimationPrefix(data: NPCData): string | null {
    const candidates = [data.id, data.sprite].filter((v): v is string => Boolean(v));
    return candidates.find((c) => this.scene.anims.exists(`${c}-idle-down`)) || null;
  }

  private isActiveEscort(npcId: string): boolean {
    const escort = ESCORTS.find((e) => e.npcId === npcId);
    if (!escort) return false;
    const tracked = useQuestStore.getState().getTrackedObjective();
    return Boolean(
      tracked?.objective
      && tracked.objective.type === escort.objectiveType
      && tracked.objective.target === escort.npcId
    );
  }

  /** True when any escort is currently active (used to prime the trail). */
  hasActiveEscort(): boolean {
    return ESCORTS.some((e) => this.isActiveEscort(e.npcId));
  }

  // -- facing / dialogue ---------------------------------------------------

  directionToPlayer(npc: Phaser.Physics.Arcade.Sprite): Direction {
    const player = this.ctx.player();
    if (!player) return 'down';
    return directionBetween(npc.x, npc.y, player.x, player.y);
  }

  /** A sprite Phaser has not yet torn down, safe to animate. */
  private isAlive(sprite: Phaser.Physics.Arcade.Sprite): boolean {
    return Boolean(sprite.active && sprite.anims);
  }

  setFacing(npc: Phaser.Physics.Arcade.Sprite, direction: Direction) {
    if (!this.isAlive(npc)) return;
    if (this.facingMap.get(npc) === direction) return;
    this.facingMap.set(npc, direction);

    const npcData = this.dataMap.get(npc);
    if (!npcData) return;
    const prefix = this.animationPrefixMap.get(npc) || npcData.id;

    if (this.activeDialogueNpc === npc) {
      const talkKey = `${prefix}-talk-${direction}`;
      if (this.scene.anims.exists(talkKey)) npc.play(talkKey, true);
      return;
    }

    const idleKey = `${prefix}-idle-${direction}`;
    if (this.scene.anims.exists(idleKey)) npc.play(idleKey, true);
  }

  /**
   * Turn an NPC to the player and start their talk loop.
   * Returns the sprite so the caller can align the player to it.
   */
  beginDialogue(npcId: string): Phaser.Physics.Arcade.Sprite | undefined {
    const npc = this.spriteById.get(npcId);
    if (!npc || !this.isAlive(npc)) return undefined;

    const direction = this.directionToPlayer(npc);
    this.facingMap.set(npc, direction);
    const prefix = this.animationPrefixMap.get(npc) || npcId;
    const talkKey = `${prefix}-talk-${direction}`;
    if (this.scene.anims.exists(talkKey)) npc.play(talkKey, true);
    this.activeDialogueNpc = npc;
    return npc;
  }

  /**
   * Drop the talk loop back to idle.
   *
   * Guarded on the sprite still being alive: this is also called from the
   * scene's cleanup, and by then Phaser may already have destroyed the sprite
   * and freed its animation component. Playing into that throws, and a throw in
   * teardown aborts the REST of cleanup — which is how a location transition
   * (every one of which goes through scene.restart) ends up half-shut-down and
   * never completing.
   */
  stopDialogueAnimation() {
    if (!this.activeDialogueNpc) return;
    if (!this.isAlive(this.activeDialogueNpc)) {
      this.activeDialogueNpc = null;
      return;
    }

    const npcData = this.dataMap.get(this.activeDialogueNpc);
    if (npcData) {
      const facing = this.facingMap.get(this.activeDialogueNpc) || 'down';
      const prefix = this.animationPrefixMap.get(this.activeDialogueNpc) || npcData.id;
      const idleKey = `${prefix}-idle-${facing}`;
      if (this.scene.anims.exists(idleKey)) this.activeDialogueNpc.play(idleKey, true);
    }

    this.activeDialogueNpc = null;
  }

  // -- interaction ---------------------------------------------------------

  /** Offer every present NPC as a "Talk to ..." candidate. */
  registerInteractions(interaction: InteractionSystem) {
    interaction.registerProvider((scan: InteractionScan) => {
      const out: InteractionCandidate[] = [];
      for (const npc of this.sprites) {
        const npcData = this.dataMap.get(npc);
        if (!npcData) continue;
        // Visible but not available: they are praying, or locking up, or have
        // their back to you. You can watch. You cannot interrupt.
        if (!this.visibility(npcData).talkable) continue;
        const scored = scan.score(npc.x, npc.y, INTERACTION_RADIUS.npc);
        if (!scored) continue;
        out.push({
          type: 'npc',
          id: npcData.id,
          label: `Talk to ${npcData.name}`,
          x: npc.x,
          y: npc.y,
          priority: INTERACTION_PRIORITY.npc,
          score: scored.score,
          interact: () => this.deps.onTalk(npcData),
        });
      }
      return out;
    });
  }

  // -- schedule walking ----------------------------------------------------

  /**
   * The hour rolled over.
   *
   * This USED to be `recreate()` — destroy every sprite, rebuild the ones the
   * new hour allows — which is why the cast popped on the hour and why nobody
   * was ever seen going anywhere. Now each NPC is transitioned individually:
   * someone whose slot changed walks, someone whose slot did not is left
   * entirely alone.
   *
   * The walk itself is usually already under way by the time this fires, since
   * `arriveBy` is a deadline and the departure logic in `tickSchedules` starts
   * the walk early enough for the player to see it. This is the backstop for
   * everyone the player was not there to watch.
   */
  onHourChanged() {
    const npcData = useDialogueStore.getState().allNPCData as unknown as Record<string, NPCData>;
    if (!npcData) return;
    const hour = this.deps.currentHour();

    Object.values(npcData).forEach((data) => {
      if (!data || !data.id) return;
      if (this.isActiveEscort(data.id)) return;

      const sprite = this.spriteById.get(data.id);
      const present = this.visibility(data).visible;
      const slot = resolveSlot(data.schedule, hour);
      const index = resolveSlotIndex(data.schedule, hour);

      if (!sprite && present) {
        this.arrive(data, slot);
        return;
      }
      if (!sprite) return;

      const state = this.scheduleState.get(data.id);
      if (state) state.slotIndex = index;

      if (!present) {
        // Already walking to the door? Let the walk finish and fade there.
        if (state?.intent === 'exit') return;
        this.departNow(sprite, data, slot, state);
        return;
      }

      // Present before and after. If they are not standing where the new slot
      // says, and nothing started the walk early, move them now.
      const station = slotStation(slot, null);
      if (!station || !state) return;
      if (state.intent === 'station') return;
      const target = this.toWorld(station);
      if (Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y) < 12) {
        if (slot) this.applyStationPose(sprite, slot);
        return;
      }
      this.beginStationWalk(sprite, data, slot!, target, /* urgent */ true);
    });
  }

  /**
   * Per-frame schedule tick, throttled.
   *
   * Two jobs: drive whatever walks are in flight, and start the ones whose
   * `arriveBy` deadline is now close enough that the walk has to begin for the
   * player to see the transit rather than the aftermath.
   */
  private tickSchedules() {
    const now = this.scene.time.now;
    const walkedThisFrame = this.driveWalkers();
    if (now - this.lastScheduleTick < SCHEDULE_TICK_MS) return;
    this.lastScheduleTick = now;

    const hour = this.deps.currentHour();
    const minute = this.deps.currentMinute?.() ?? 0;

    for (const sprite of this.sprites) {
      const data = this.dataMap.get(sprite);
      if (!data || this.isActiveEscort(data.id)) continue;
      const state = this.scheduleState.get(data.id);
      if (!state || state.intent) continue;
      if (walkedThisFrame.has(data.id)) continue;

      this.applyBeat(sprite, data, hour, minute, state);
      this.prepareDeparture(sprite, data, state, hour, minute);
    }
  }

  /** Step every active walk; returns the ids that moved. */
  private driveWalkers(): Set<string> {
    const moved = new Set<string>();
    for (const sprite of this.sprites) {
      const data = this.dataMap.get(sprite);
      if (!data) continue;
      const state = this.scheduleState.get(data.id);
      if (!state?.walker || !state.walker.isWalking()) continue;

      moved.add(data.id);
      const outcome = state.walker.update(sprite);
      if (outcome === 'walking') continue;

      if (state.intent === 'exit') {
        this.finishExit(sprite, state);
      } else {
        this.finishStationWalk(sprite, state);
      }
    }
    return moved;
  }

  /**
   * Work out whether the next slot's walk has to start now.
   *
   * The path is computed ONCE when the slot comes over the horizon and cached,
   * because the lead time is a function of the path's own length — you cannot
   * know how early to leave until you know how far it is. Then the walk starts
   * on the frame the remaining game-minutes drop below that lead.
   */
  private prepareDeparture(
    sprite: Phaser.Physics.Arcade.Sprite,
    data: NPCData,
    state: ScheduleState,
    hour: number,
    minute: number,
  ) {
    const horizon = resolveDeparture(data.schedule, hour, minute, PREP_HORIZON_MINUTES);
    if (!horizon) { state.pending = null; return; }

    const slot = horizon.slot;
    const goesElsewhere = !slotVisibility(
      slot, this.ctx.locationId(), data.location, (id) => Boolean(getLocation(id)),
    ).visible;

    // Where this walk ends: the next station, or the door they leave by.
    const exitDoor = this.exitDoorFor(slot);
    const endNative = goesElsewhere
      ? (exitDoor ? { x: exitDoor.x, y: exitDoor.y } : null)
      : slotStation(slot, null);
    if (!endNative) {
      // Nothing to walk to (a fade-out with no named door): let the hour change
      // handle it rather than inventing a destination.
      state.pending = null;
      return;
    }

    if (!state.pending || state.pending.index !== horizon.index) {
      const path = this.routeTo(sprite, this.toWorld(endNative), slot.route);
      if (!path) { state.pending = null; return; }
      state.pending = {
        index: horizon.index,
        path,
        leadMinutes: travelGameMinutes(pathLength(path), NPC_WALK_SPEED),
      };
    }

    if (horizon.minutesUntilDeadline > state.pending.leadMinutes) return;

    const path = state.pending.path;
    state.pending = null;
    if (goesElsewhere) {
      this.startWalk(sprite, data, state, path, 'exit', slot);
    } else {
      this.startWalk(sprite, data, state, path, 'station', slot);
    }
  }

  /** Which door a slot leaves this location by, if it names one. */
  private exitDoorFor(slot: ScheduleSlot | null) {
    if (!slot) return null;
    if (slot.exit) return slot.exit;
    // Diogo's cross-location move: the new slot describes the door he uses to
    // leave the location he is currently standing in.
    if (slot.exitFrom && slot.exitFrom.location === this.ctx.locationId()) return slot.exitFrom;
    return null;
  }

  /** Route from where a sprite is to a world point, honouring the slot hints. */
  private routeTo(
    sprite: Phaser.Physics.Arcade.Sprite,
    to: Point,
    hints: Point[] | undefined,
  ): Point[] | null {
    const mask = this.ctx.walkMask();
    if (!mask) return [to];
    const worldHints = (hints || []).map((h) => this.toWorld(h));
    const result = findPathVia(mask, { x: sprite.x, y: sprite.y }, worldHints, to, {
      halfWidth: NPC_HALF_WIDTH,
      footOffset: NPC_FOOT_OFFSET,
    });
    return result?.points ?? null;
  }

  /** Begin a walk, on camera or teleported depending on who is watching. */
  private startWalk(
    sprite: Phaser.Physics.Arcade.Sprite,
    data: NPCData,
    state: ScheduleState,
    path: Point[],
    intent: 'station' | 'exit',
    slot: ScheduleSlot,
  ) {
    const prefix = this.animationPrefixMap.get(sprite) || data.id;
    if (!state.walker) {
      state.walker = new WalkToBehavior(this.scene, prefix, {
        // The mask is a floor and the sprite origin is not on it, so the rescue
        // is asked about the FEET and answered back in origin space.
        nearestWalkable: (x, y) => {
          const found = this.ctx.walkMask()?.nearestWalkable(
            x, y + NPC_FOOT_OFFSET, 48, NPC_HALF_WIDTH,
          );
          return found ? { x: found.x, y: found.y - NPC_FOOT_OFFSET } : null;
        },
      });
    }
    state.walker.setAnimPrefix(prefix);
    state.intent = intent;
    state.targetSlot = slot;
    state.breath?.remove();
    state.breath = null;

    state.walker.start(path, NPC_WALK_SPEED, slot.facing || 'down');

    // The spec's contract: walk on camera, teleport + cross-fade otherwise.
    // `onCameraWalk: false` is an always-teleport (every cross-location move).
    const end = path[path.length - 1];
    const watched = slot.onCameraWalk !== false && this.isWatched(sprite, end);
    if (!watched) {
      state.walker.teleportToEnd(sprite);
      this.crossFade(sprite);
      if (intent === 'exit') this.finishExit(sprite, state);
      else this.finishStationWalk(sprite, state);
    }
  }

  /**
   * The hour rolled over and this NPC should be gone.
   *
   * If the slot names a door they walk to it and fade there (on camera); with
   * no door, or with nobody watching, they simply fade out where they stand.
   */
  private departNow(
    sprite: Phaser.Physics.Arcade.Sprite,
    data: NPCData,
    slot: ScheduleSlot | null,
    state: ScheduleState | undefined,
  ) {
    if (!state) { this.removeSprite(sprite); return; }
    const door = this.exitDoorFor(slot);
    if (!door || !slot) {
      state.targetSlot = slot;
      this.finishExit(sprite, state);
      return;
    }

    const target = this.toWorld({ x: door.x, y: door.y });
    if (!this.isWatched(sprite, target)) {
      state.targetSlot = slot;
      this.finishExit(sprite, state);
      return;
    }

    const path = this.routeTo(sprite, target, slot.route);
    if (!path) {
      state.targetSlot = slot;
      this.finishExit(sprite, state);
      return;
    }
    this.startWalk(sprite, data, state, path, 'exit', slot);
  }

  /** Force a station walk that is already overdue (the hour has rolled). */
  private beginStationWalk(
    sprite: Phaser.Physics.Arcade.Sprite,
    data: NPCData,
    slot: ScheduleSlot,
    target: Point,
    urgent: boolean,
  ) {
    const state = this.scheduleState.get(data.id);
    if (!state) return;
    const path = this.routeTo(sprite, target, slot.route);
    if (!path) {
      sprite.setPosition(target.x, target.y);
      this.applyStationPose(sprite, slot);
      return;
    }
    // Overdue walks that nobody can see are simply taken, not animated.
    const effectiveSlot = urgent && !this.isWatched(sprite, target)
      ? { ...slot, onCameraWalk: false }
      : slot;
    this.startWalk(sprite, data, state, path, 'station', effectiveSlot);
  }

  /** Is either end of this walk on screen? */
  private isWatched(sprite: Phaser.Physics.Arcade.Sprite, end: Point): boolean {
    const view = this.scene.cameras.main?.worldView;
    if (!view) return false;
    return view.contains(sprite.x, sprite.y) || view.contains(end.x, end.y);
  }

  private crossFade(sprite: Phaser.Physics.Arcade.Sprite) {
    sprite.setAlpha(0);
    this.scene.tweens.add({ targets: sprite, alpha: 1, duration: TELEPORT_FADE_MS });
  }

  private finishStationWalk(sprite: Phaser.Physics.Arcade.Sprite, state: ScheduleState) {
    state.intent = null;
    if (state.targetSlot) this.applyStationPose(sprite, state.targetSlot);
    state.targetSlot = null;
  }

  /**
   * Arrive at a door and go "indoors".
   *
   * No interiors exist, so indoors is: reach the door, play its effect, hold
   * 200 ms facing it, fade over 350 ms, despawn. The effect vocabulary is what
   * makes the two quarters of the city sound different — a Malay stilt house
   * has a cloth doorway, a Portuguese warehouse has a bar and a latch.
   */
  private finishExit(sprite: Phaser.Physics.Arcade.Sprite, state: ScheduleState) {
    const door = this.exitDoorFor(state.targetSlot);
    state.intent = null;
    state.targetSlot = null;
    if (this.departing.has(sprite)) return;
    this.departing.add(sprite);

    sprite.setVelocity(0, 0);
    if (door?.effect && door.effect !== 'none') this.deps.playEffect?.(door.effect);
    // Face the door they are working at, so the lock-up reads as a back turned
    // rather than a person standing sideways next to a wall.
    if (door) {
      const at = this.toWorld({ x: door.x, y: door.y });
      this.setFacing(sprite, directionBetween(sprite.x, sprite.y, at.x, at.y));
    }

    const pause = door?.effect === 'shutter' || door?.effect === 'shutter-bar'
      ? SHUTTER_PAUSE_MS
      : DOOR_PAUSE_MS;
    const shadow = this.shadowMap.get(sprite);
    const indicator = (sprite as unknown as { indicator?: Phaser.GameObjects.Arc }).indicator;
    this.scene.time.delayedCall(pause, () => {
      if (!sprite.active) return;
      this.scene.tweens.add({
        targets: [sprite, shadow].filter(Boolean) as Phaser.GameObjects.GameObject[],
        alpha: 0,
        duration: DOOR_FADE_MS,
        onComplete: () => {
          indicator?.destroy();
          this.removeSprite(sprite);
        },
      });
    });
  }

  /**
   * An NPC comes back on stage: fade in at the door they enter by, then walk to
   * the station. Off camera it is simply a fade-in already at the station.
   */
  private arrive(data: NPCData, slot: ScheduleSlot | null) {
    if (!data || this.spriteById.has(data.id)) return;
    const station = slotStation(slot, this.nativeAnchorFor(data));
    if (!station) return;
    const target = this.toWorld(station);

    const door = slot?.enter;
    const enterAt = door ? this.toWorld({ x: door.x, y: door.y }) : target;
    const watched = slot?.onCameraWalk !== false
      && Boolean(this.scene.cameras.main?.worldView.contains(enterAt.x, enterAt.y));

    const sprite = this.spawnNpc(data, watched ? enterAt : target, false);
    this.crossFade(sprite);
    if (slot) this.applyStationPose(sprite, slot);
    if (door?.effect && door.effect !== 'none' && watched) this.deps.playEffect?.(door.effect);

    if (watched && slot && (enterAt.x !== target.x || enterAt.y !== target.y)) {
      this.beginStationWalk(sprite, data, slot, target, false);
    }
  }

  /** The location file's authored anchor for an NPC, in NATIVE px. */
  private nativeAnchorFor(data: NPCData): Point | null {
    const override = this.ctx.location()?.npcPositions?.[data.id];
    if (!override) return null;
    const scale = this.ctx.location()?.world.scale ?? 1;
    return { x: override.x / scale, y: override.y / scale };
  }

  /**
   * Stand at a station: face the authored way, run the business idle.
   *
   * Tier-0 for the idle vocabulary, per spec §2.3: no new character art, just
   * the shipped idle animation plus a slow vertical breath. It reads as "doing
   * something" from three metres, which is the only distance that matters at
   * this sprite scale, and the idle KEY is carried in the data so the overlay
   * strips can land in Stage 6 without any schedule moving.
   */
  private applyStationPose(sprite: Phaser.Physics.Arcade.Sprite, slot: ScheduleSlot) {
    const data = this.dataMap.get(sprite);
    if (!data) return;
    const state = this.scheduleState.get(data.id);
    sprite.setVelocity(0, 0);
    this.setFacing(sprite, (slot.facing as Direction) || 'down');
    if (!state) return;

    state.idleKey = slot.idle ?? null;
    state.breath?.remove();
    state.breath = null;
    // `idle-breathe` IS the shipped animation; anything else is a business idle
    // with no art yet, and gets the Tier-0 breath on top.
    if (!slot.idle || slot.idle === 'idle-breathe') return;
    state.breath = this.scene.tweens.add({
      targets: sprite,
      scaleY: CHARACTER_SCALE * 0.97,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Apply the beat holding at this clock reading — a facing and an idle. */
  private applyBeat(
    sprite: Phaser.Physics.Arcade.Sprite,
    data: NPCData,
    hour: number,
    minute: number,
    state: ScheduleState,
  ) {
    const beat = resolveBeat(data.beats, hour, minute);
    const kind = beat ? `${beat.at}:${beat.kind}` : null;
    if (kind === state.beatKind) return;
    state.beatKind = kind;

    if (!beat) {
      const slot = resolveSlot(data.schedule, hour);
      if (slot) this.applyStationPose(sprite, slot);
      return;
    }

    if (beat.station) {
      const target = this.toWorld(beat.station);
      sprite.setPosition(target.x, target.y);
    }
    if (beat.face) {
      const face = this.toWorld(beat.face);
      this.setFacing(sprite, directionBetween(sprite.x, sprite.y, face.x, face.y));
    }
  }

  /** Tear one sprite out of every roster it is in. */
  private removeSprite(sprite: Phaser.Physics.Arcade.Sprite) {
    const data = this.dataMap.get(sprite);
    const shadow = this.shadowMap.get(sprite);
    if (shadow) shadow.destroy();
    if (data) {
      this.scheduleState.get(data.id)?.breath?.remove();
      this.scheduleState.delete(data.id);
      this.spriteById.delete(data.id);
      this.followers.delete(data.id);
    }
    this.dataMap.delete(sprite);
    this.animationPrefixMap.delete(sprite);
    this.facingMap.delete(sprite);
    this.shadowMap.delete(sprite);
    this.departing.delete(sprite);
    if (this.activeDialogueNpc === sprite) this.activeDialogueNpc = null;
    const index = this.sprites.indexOf(sprite);
    if (index >= 0) this.sprites.splice(index, 1);
    sprite.destroy();
  }

  // -- per frame -----------------------------------------------------------

  /**
   * Depth-sort the cast, run followers, and light the indicator over whichever
   * NPC the interaction system is currently offering.
   */
  update(targetedNpcId: string | null) {
    this.tickSchedules();
    this.sprites.forEach((npc) => {
      const depth = worldDepth(npc.y + FOOT_OFFSET);
      npc.setDepth(depth);
      const shadow = this.shadowMap.get(npc);
      if (shadow) shadow.setDepth(depth - 1);
    });

    this.updateFollowers();
    this.updateIndicators(targetedNpcId);
  }

  private updateIndicators(targetedNpcId: string | null) {
    for (const npc of this.sprites) {
      const indicator = (npc as unknown as { indicator?: Phaser.GameObjects.Arc }).indicator;
      if (!indicator) continue;
      const npcData = this.dataMap.get(npc);

      // Follow the NPC in case they move
      indicator.setPosition(npc.x, npc.y - indicatorOffset());
      const isTargeted = npcData?.id === targetedNpcId;
      indicator.setVisible(isTargeted);
      if (isTargeted) {
        this.setFacing(npc, this.directionToPlayer(npc));
        indicator.setScale(1 + Math.sin(this.scene.time.now / 200) * 0.3);
      }
    }
  }

  /** Lay a crumb and step every active follower along the trail. */
  private updateFollowers() {
    const player = this.ctx.player();
    if (!player) return;

    const playerState = useGameStore.getState().player;
    const isWalking = ((player.body as Phaser.Physics.Arcade.Body | null)?.speed ?? 0) > 0;
    this.trail.record(player.x, player.y, playerState.facing, isWalking);

    for (const escort of ESCORTS) {
      const sprite = this.spriteById.get(escort.npcId);
      if (!sprite || !sprite.active) continue;

      const behavior = this.followers.get(escort.npcId);
      if (!behavior || !this.isActiveEscort(escort.npcId)) {
        // Not (or no longer) escorting: plant them.
        sprite.setImmovable(true);
        sprite.setVelocity(0, 0);
        continue;
      }

      sprite.setImmovable(false);

      // Follower needs its own collider against the scene walls, added once.
      const colliders = this.deps.colliders();
      if (colliders && !this.followerColliderAdded) {
        this.scene.physics.add.collider(sprite, colliders);
        this.followerColliderAdded = true;
      }

      const step = behavior.update(sprite, this.trail.at(behavior.followDelay), PLAYER_SPEED);
      // A teleport means the follower's position is meaningless this frame —
      // do not let it satisfy the arrival check.
      if (step.action === 'teleport') continue;

      this.checkEscortArrival(escort, sprite, player);
    }
  }

  /** Both parties near the drop-off, at the right hour, completes the escort. */
  private checkEscortArrival(
    escort: typeof ESCORTS[number],
    sprite: Phaser.Physics.Arcade.Sprite,
    player: Phaser.Physics.Arcade.Sprite,
  ) {
    const dest = escort.destination;
    if (this.ctx.locationId() !== dest.locationId) return;
    if (dest.requiresNight && this.ctx.timeOfDay() !== 'night') return;

    const playerDist = Phaser.Math.Distance.Between(player.x, player.y, dest.x, dest.y);
    const followerDist = Phaser.Math.Distance.Between(sprite.x, sprite.y, dest.x, dest.y);

    if (playerDist < dest.radius && followerDist < dest.radius) {
      useQuestStore.getState().recordEscort(escort.npcId, dest.locationId);
      console.log(`${escort.npcId} successfully escorted to the ${dest.locationId}!`);
    }
  }

  destroy() {
    this.clearSprites();
    this.trail.clear();
    this.followerColliderAdded = false;
  }
}
