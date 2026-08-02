/**
 * FeedbackSystem — the feedback event table, in one place.
 *
 * Every tactile response the game makes to a player action is declared here as
 * data (`FEEDBACK_TABLE`) and dispatched from one subscriber set. The reason it
 * is one system rather than a `playSfx` call at each emitter is the failure
 * mode this project already lived through: five transition stings were
 * referenced by data, guarded at runtime by `cache.audio.exists`, and therefore
 * played as SILENCE for months without anything failing. When the table is one
 * object, "which events make a sound" is a question you can answer by reading
 * twenty lines, and `tools/validate-gameplay-assets.cjs` can check every key in
 * it against the files on disk.
 *
 * WHAT LIVES HERE
 *   - SFX key + absolute volume per event (the mixer applies the user's SFX
 *     volume on top);
 *   - the world-space particle bursts: the pickup sparkle, the coin burst
 *     whose COUNT is readable as the payout size, the dialogue-hands sparkle;
 *   - the screen flash / dim, delegated to `AtmosphereSystem`;
 *   - the camera-shake policy, which is deliberately restrictive (see below).
 *
 * WHAT DOES NOT
 *   The React-side UI pulses in the spec's table (panel slides, journal-tab
 *   pulses, purse count-downs) belong to the React layer and a `feedbackStore`.
 *   This system emits nothing extra for them: the same bridge events it
 *   listens to are already available to React.
 */

import Phaser from 'phaser';
import { eventBridge } from '../eventBridge';
import { worldDepth } from '../core/depth';
import type { SystemContext } from '../core/SystemContext';

/* ---------------------------------------------------------------------------
 * CAMERA-SHAKE POLICY — read this before adding a fourth site.
 *
 * This is not an action game. Shake is reserved for PHYSICAL IMPACT the player
 * caused or received. Exactly three sites are approved:
 *
 *   1. the A Famosa gate slam                    0.0035 / 140 ms
 *   2. a physical denial (locked door, blocked)  0.0020 /  90 ms
 *   3. a cannon, if one is ever fired in the demo 0.0060 / 220 ms
 *
 * `CameraSystem.shake(intensity, duration)` takes intensity as a VIEWPORT
 * FRACTION, so 0.0035 x 540 = 1.9 px — sub-sprite-pixel at 3x, which is
 * exactly right. Anything above 0.008 visibly breaks the pixel grid and must
 * be rejected in review. Shake also early-returns while a dialogue or panel is
 * open, and never fires more than once per 400 ms.
 *
 * A conversational refusal is NOT a physical denial and must never shake.
 * ------------------------------------------------------------------------ */
export const SHAKE = {
  gateSlam: { intensity: 0.0035, duration: 140 },
  denial: { intensity: 0.0020, duration: 90 },
  cannon: { intensity: 0.0060, duration: 220 },
} as const;

/** Hard ceiling from the spec. Anything above this breaks the pixel grid. */
export const SHAKE_MAX_INTENSITY = 0.008;
/** Minimum gap between shakes, whatever asks for them. */
const SHAKE_COOLDOWN_MS = 400;

/** Canon indices used by the bursts (see the spec's Appendix A). */
const CANON = {
  brassGold: 0xD8A428,     // 47
  lanternFlame: 0xF5C860,  // 48
  sunSpecular: 0xFFF4D4,   // 49
  flagCrimson: 0xB01C28,   // 46
} as const;

/** One row of the feedback table: which sound, how loud. */
interface SfxRow { key: string; volume: number }

/**
 * The sound half of the table. Volumes are absolute `playSfx` scales; they are
 * tuned so that the sounds a player hears hundreds of times (blips, panels,
 * examines) sit UNDER the ones they hear a handful of times (quest chime).
 */
export const FEEDBACK_SFX: Record<string, SfxRow | SfxRow[]> = {
  'item:pickup': { key: 'sfx-item-pickup', volume: 0.38 },
  'item:examine': { key: 'sfx-examine-soft', volume: 0.22 },
  'prop:examine': { key: 'sfx-examine-soft', volume: 0.22 },
  'dialogue:start': { key: 'sfx-menu-select', volume: 0.30 },
  'dialogue:end': { key: 'sfx-panel-close', volume: 0.24 },
  'dialogue:topic:selected': { key: 'sfx-dialogue-blip', volume: 0.28 },
  'dialogue:item:given': { key: 'sfx-item-pickup', volume: 0.20 },
  'dialogue:money:paid': { key: 'sfx-coin-clink', volume: 0.34 },
  'quest:start': { key: 'sfx-quest-chime', volume: 0.42 },
  'quest:advance': { key: 'sfx-journal-quill', volume: 0.30 },
  'quest:complete': [
    { key: 'sfx-quest-chime', volume: 0.50 },
    { key: 'church-bells', volume: 0.18 },
  ],
  'journal:updated': { key: 'sfx-journal-quill', volume: 0.22 },
  'player:rest:start': { key: 'sfx-rest-chime', volume: 0.28 },
  'game:save': { key: 'sfx-save-seal', volume: 0.34 },
  'game:load': { key: 'sfx-menu-select', volume: 0.30 },
  'feedback:denied': { key: 'sfx-denied-thud', volume: 0.30 },
  'ui:inventory:toggle': { key: 'sfx-panel-open', volume: 0.26 },
  'ui:journal:toggle': { key: 'sfx-panel-open', volume: 0.26 },
  'ui:pause:toggle': { key: 'sfx-menu-select', volume: 0.24 },
  'ui:page:turn': { key: 'sfx-page-turn', volume: 0.24 },
  'time:day-passed': { key: 'church-bells', volume: 0.20 },
};

/**
 * Coin-burst particle count. The payout size is READABLE FROM THE BURST — the
 * Ultima VII / Diablo II trick. 25 coins per particle, 1 to 6.
 */
export function coinBurstCount(amount: number): number {
  const n = Math.round((Number.isFinite(amount) ? amount : 0) / 25);
  return Math.max(1, Math.min(6, n));
}

export interface FeedbackDeps {
  playSfx(key: string, volumeScale: number): void;
  /** Screen flash / dim, owned by AtmosphereSystem. */
  flash(amount: number, durationMs: number, colour?: number): void;
  /** Held dim for as long as a panel is up. */
  setHeldFlash(amount: number, durationMs?: number): void;
  shake(intensity: number, duration: number): void;
  /** Where the last examined/picked world item was, for the sparkle. */
  lastInteractionPoint(): { x: number; y: number } | null;
  /** The NPC currently in dialogue, for the hands sparkle and the coin burst. */
  dialoguePoint(): { x: number; y: number } | null;
}

export class FeedbackSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: FeedbackDeps;
  private readonly unsubscribers: Array<() => void> = [];
  private lastShakeAt = -Infinity;

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: FeedbackDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  create() {
    // The sound half of the table, wired generically.
    Object.keys(FEEDBACK_SFX).forEach((event) => {
      this.on(event, () => this.playRow(FEEDBACK_SFX[event]));
    });

    // The world half. Each of these ALSO gets its row's sound above; the
    // handlers here add the particles, the flash and the shake.
    this.on('item:pickup', () => this.pickupSparkle());
    this.on('dialogue:item:given', () => this.handsSparkle());
    this.on('dialogue:money:paid', (...args) => this.coinBurst(Number(args[1] ?? 0)));
    this.on('quest:complete', () => this.deps.flash(0.10, 260, CANON.sunSpecular));
    this.on('feedback:denied', (...args) => this.denied(Boolean(args[1])));

    // The two HELD dims. Dialogue drops the world 6 %; pause drops it 10 %.
    this.on('dialogue:start', () => this.deps.setHeldFlash(-0.06, 200));
    this.on('dialogue:end', () => this.deps.setHeldFlash(0, 200));
    this.on('ui:dialogue:close', () => {
      // DialogueBox emits `ui:dialogue:close`; `dialogue:end` is the Phaser-side
      // name. Listening to both means the dim is released either way — a dim
      // that sticks because one of two names was not emitted is the worst
      // possible outcome for a purely cosmetic effect.
      this.deps.setHeldFlash(0, 200);
      this.playRow(FEEDBACK_SFX['dialogue:end']);
    });

    // The gate slam: the one location whose arrival is a physical event.
    this.on('world:transition:start', (...args) => {
      if (args[1] === 'a-famosa-gate') {
        this.scene.time.delayedCall(90, () => this.shake(SHAKE.gateSlam));
      }
    });
  }

  // -- dispatch ------------------------------------------------------------

  private on(event: string, handler: (...args: unknown[]) => void) {
    this.unsubscribers.push(eventBridge.on(event, handler));
  }

  private playRow(row: SfxRow | SfxRow[] | undefined) {
    if (!row) return;
    if (Array.isArray(row)) row.forEach((r) => this.deps.playSfx(r.key, r.volume));
    else this.deps.playSfx(row.key, row.volume);
  }

  // -- shake ---------------------------------------------------------------

  /** The only door to `CameraSystem.shake`. Enforces the policy above. */
  private shake(spec: { intensity: number; duration: number }) {
    if (spec.intensity > SHAKE_MAX_INTENSITY) {
      console.warn(`[FeedbackSystem] refusing shake at ${spec.intensity} — above the ${SHAKE_MAX_INTENSITY} pixel-grid limit`);
      return;
    }
    // A shake while you are reading a panel is a bug, not a beat.
    if (this.ctx.isUIOpen()) return;
    const now = this.scene.time.now;
    if (now - this.lastShakeAt < SHAKE_COOLDOWN_MS) return;
    this.lastShakeAt = now;
    this.deps.shake(spec.intensity, spec.duration);
  }

  private denied(physical: boolean) {
    // Only a PHYSICAL denial shakes. A merchant saying no does not move the
    // camera; a locked door does.
    if (physical) this.shake(SHAKE.denial);
  }

  // -- particle bursts -----------------------------------------------------

  /**
   * The Diablo-II beat: the item SPRITE leaves, it does not just vanish.
   * `WorldObjectSystem` removes the sprite; this is the trace it leaves.
   */
  private pickupSparkle() {
    const at = this.deps.lastInteractionPoint();
    if (!at) return;
    this.sparkle(at.x, at.y, 5, 420, 22);
  }

  private handsSparkle() {
    const at = this.deps.dialoguePoint();
    if (!at) return;
    // Native y - 30 is roughly where a 16x32 character's hands are.
    this.sparkle(at.x, at.y - 30 * 3, 3, 360, 18);
  }

  private sparkle(x: number, y: number, count: number, lifespan: number, speed: number) {
    if (!this.scene.textures.exists('particle')) return;
    const emitter = this.scene.add.particles(x, y, 'particle', {
      lifespan,
      speed: { min: speed * 0.5, max: speed },
      angle: { min: 0, max: 360 },
      gravityY: -14,
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [CANON.lanternFlame, CANON.brassGold],
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(worldDepth(y) + 1);
    emitter.explode(count);
    this.scene.time.delayedCall(lifespan + 60, () => emitter.destroy());
  }

  /**
   * The coin burst. `n = clamp(round(amount / 25), 1, 6)` particles arc up
   * ~30 world px and fall, staggered 40 ms apart, over 520 ms — so a 20-real
   * payment and a 150-real payment do not look the same.
   */
  private coinBurst(amount: number) {
    const at = this.deps.dialoguePoint() ?? this.deps.lastInteractionPoint();
    if (!at || !this.scene.textures.exists('particle')) return;
    const n = coinBurstCount(amount);

    const emitter = this.scene.add.particles(at.x, at.y - 40, 'particle', {
      lifespan: 520,
      speedY: { min: -120, max: -80 },
      speedX: { min: -45, max: 45 },
      gravityY: 260,
      scale: { start: 0.5, end: 0.32 },
      alpha: { start: 1, end: 0.2 },
      tint: CANON.brassGold,
      blendMode: 'NORMAL',
      emitting: false,
    });
    emitter.setDepth(worldDepth(at.y) + 2);
    for (let i = 0; i < n; i++) {
      this.scene.time.delayedCall(i * 40, () => {
        if (emitter.active) emitter.explode(1);
      });
    }
    this.scene.time.delayedCall(520 + n * 40 + 80, () => emitter.destroy());
  }

  destroy() {
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers.length = 0;
  }
}

export default FeedbackSystem;
