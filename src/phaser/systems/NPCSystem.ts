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
import { isHourInScheduleRange } from '../core/timeMath';
import { BreadcrumbTrail } from '../core/breadcrumbTrail';
import { directionBetween, type Direction } from '../core/interactionScore';
import { FollowBehavior } from './behaviors/FollowBehavior';
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
  schedule?: Array<{
    startHour: number;
    endHour: number;
    activity: string;
    location: string;
    available: boolean;
  }>;
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
  /** Open dialogue with an NPC (the scene owns the dialogue store wiring). */
  onTalk(npcData: NPCData): void;
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

    const player = this.ctx.player();
    const npcOverrides = this.ctx.location()?.npcPositions || {};

    Object.values(npcData).forEach((data) => {
      const isFollower = this.isActiveEscort(data.id);

      if (!isFollower && data.location !== this.ctx.locationId()) return;
      if (!isFollower && !this.isAvailableNow(data)) return;

      let x = data.position?.x || GAME_WIDTH / 2;
      let y = data.position?.y || GAME_HEIGHT / 2;

      if (isFollower && data.location !== this.ctx.locationId()) {
        // Spawn follower near the player
        x = (player?.x ?? x) - 30;
        y = player?.y ?? y;
      } else if (npcOverrides[data.id]) {
        x = npcOverrides[data.id].x;
        y = npcOverrides[data.id].y;
      }

      // In isometric mode, npcPositions are tile coordinates — convert to world
      const worldPos = this.deps.tileToWorld(x, y);
      if (worldPos) {
        x = worldPos.x;
        y = worldPos.y;
      }

      const sheetKey = `${data.sprite || data.id}-sheet`;
      const npcTexture = this.scene.textures.exists(sheetKey) ? sheetKey : 'debug-character-missing';
      if (npcTexture === 'debug-character-missing') {
        console.warn(
          `[NPCSystem] ${data.id} has no sprite sheet '${sheetKey}' — falling back to `
          + 'debug-character-missing. The cast will render as a placeholder.'
        );
      }
      const npc = this.scene.physics.add.sprite(x, y, npcTexture);

      // Scale up NPC to match scene backgrounds (same as player)
      npc.setScale(CHARACTER_SCALE);
      npc.setImmovable(!isFollower);
      npc.setDepth(worldDepth(y + FOOT_OFFSET));

      const shadow = this.scene.add.ellipse(x, y + 40, 50, 18, 0x000000, 0.24);
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
      const indicator = this.scene.add.circle(x, y - indicatorOffset(), 8, 0xFFD700);
      indicator.setVisible(false);
      indicator.setDepth(DEPTH_UI_INDICATOR);
      (npc as unknown as { indicator: Phaser.GameObjects.Arc }).indicator = indicator;

      if (isFollower) {
        this.followers.set(data.id, new FollowBehavior(this.scene, prefix || data.id));
      }

      console.log(`Created NPC: ${data.name} at (${x}, ${y})`);
    });
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

  /** Re-evaluate schedules and rebuild the cast. Called on every hour change. */
  recreate() {
    this.create();
    this.followerColliderAdded = false;
  }

  private clearSprites() {
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

  /** Is this NPC on stage at this location and hour? */
  isAvailableNow(data: NPCData): boolean {
    const here = this.ctx.locationId();
    if (!data.schedule || data.schedule.length === 0) return data.location === here;

    const slot = data.schedule.find((entry) =>
      isHourInScheduleRange(this.deps.currentHour(), entry.startHour, entry.endHour)
    );
    if (!slot) return data.location === here;
    if (slot.available === false) return false;
    if (slot.location && slot.location !== here) return false;
    return true;
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

  // -- per frame -----------------------------------------------------------

  /**
   * Depth-sort the cast, run followers, and light the indicator over whichever
   * NPC the interaction system is currently offering.
   */
  update(targetedNpcId: string | null) {
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
