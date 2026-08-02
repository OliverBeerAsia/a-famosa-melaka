/**
 * InteractionSystem — what "[Space]" acts on, and the prompt that says so.
 *
 * This system owns no world objects of its own. Every system that puts
 * something interactable into the world (NPCs, pickups, lore objects, painted
 * scenery, exits, quest hotspots) registers a PROVIDER here; once a frame the
 * system asks each provider for its candidates, scores them with the pure
 * ranking in core/interactionScore, and lights the winner.
 *
 * That inversion is the point. Adding a new kind of interactable — Stage 5's
 * openable doors and containers — is a `registerProvider` call in the system
 * that owns them, not another loop welded into a 150-line
 * `findBestInteractionTarget`.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';
import { DEPTH_UI_PROMPT } from '../core/depth';
import { TYPE, textStyle } from '../core/typography';
import type { SystemContext } from '../core/SystemContext';
import {
  directionBetween,
  pickBestCandidate,
  scoreInteractionTarget,
  type Direction,
  type InteractionTargetType,
} from '../core/interactionScore';

export interface InteractionCandidate {
  type: InteractionTargetType;
  id: string;
  label: string;
  x: number;
  y: number;
  priority: number;
  score: number;
  interact: () => void;
}

/**
 * What a provider is handed each scan: the player's position and facing, plus
 * the scoring helper, so no provider has to re-derive the reach maths.
 */
export interface InteractionScan {
  playerX: number;
  playerY: number;
  facing: Direction;
  /** Score a point; null when it is out of reach or behind the player. */
  score(x: number, y: number, maxDistance: number): { distance: number; score: number } | null;
}

export type InteractionProvider = (scan: InteractionScan) => InteractionCandidate[];

export interface InteractionDeps {
  /** Which way the player is currently facing. */
  facing(): Direction;
  /** Turn the player to look at a point (skipped for exits). */
  facePlayerToward(x: number, y: number): void;
}

/** Prompt colours per target type. Scenery reads one step quieter than lore. */
const PROMPT_STYLES: Record<InteractionTargetType, { color: string; backgroundColor: string }> = {
  npc: { color: '#F4E6C8', backgroundColor: 'rgba(64, 38, 16, 0.78)' },
  item: { color: '#FFE19E', backgroundColor: 'rgba(81, 53, 10, 0.82)' },
  quest: { color: '#F4D66A', backgroundColor: 'rgba(89, 61, 12, 0.84)' },
  transition: { color: '#BEE7FF', backgroundColor: 'rgba(16, 41, 56, 0.82)' },
  lore: { color: '#E7D7B4', backgroundColor: 'rgba(56, 42, 25, 0.82)' },
  // Painted scenery reads one step quieter than a lore object: it is the
  // street, not a museum piece.
  scenery: { color: '#CFC3A6', backgroundColor: 'rgba(44, 36, 24, 0.78)' },
};

export class InteractionSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: InteractionDeps;

  private providers: InteractionProvider[] = [];
  private prompt: Phaser.GameObjects.Text | null = null;
  private active: InteractionCandidate | null = null;

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: InteractionDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  /** Register a source of interactables. Order does not affect ranking. */
  registerProvider(provider: InteractionProvider) {
    this.providers.push(provider);
  }

  createPrompt() {
    // display 16, not the standard's example of 24.
    //
    // The standard's own rule is "if a string does not fit at a legal size, the
    // container changes — never the size", and this container CANNOT change: it
    // is pinned to the 960px viewport. At 24px the longest real prompt
    // ("[Space] Travel to St Paul's Church Hill", 39 glyphs) is 936px before
    // padding and overflows. 16px is the next legal rung down and the ladder's
    // designated size for button-tier legends, which is what a prompt is.
    this.prompt = this.scene.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 28,
      '',
      textStyle(TYPE.displayLabel, {
        align: 'center',
        backgroundColor: 'rgba(26, 14, 7, 0.78)',
        padding: { x: 10, y: 6 },
      })
    );
    this.prompt.setOrigin(0.5, 1);
    this.prompt.setScrollFactor(0);
    this.prompt.setDepth(DEPTH_UI_PROMPT);
    this.prompt.setVisible(false);
  }

  private setPrompt(text: string | null, type?: InteractionTargetType) {
    if (!this.prompt) return;

    if (!text) {
      this.prompt.setVisible(false);
      return;
    }

    const style = PROMPT_STYLES[type || 'npc'];
    this.prompt.setText(text);
    this.prompt.setStyle({ color: style.color, backgroundColor: style.backgroundColor });
    this.prompt.setVisible(true);
  }

  /** Build the scan context for this frame. */
  private makeScan(): InteractionScan | null {
    const player = this.ctx.player();
    if (!player) return null;
    const facing = this.deps.facing();
    return {
      playerX: player.x,
      playerY: player.y,
      facing,
      score: (x, y, maxDistance) =>
        scoreInteractionTarget(player.x, player.y, facing, x, y, maxDistance),
    };
  }

  /** Ask every provider and rank the field. */
  findBestTarget(): InteractionCandidate | null {
    const scan = this.makeScan();
    if (!scan) return null;

    const candidates: InteractionCandidate[] = [];
    for (const provider of this.providers) {
      const found = provider(scan);
      for (const candidate of found) candidates.push(candidate);
    }
    return pickBestCandidate(candidates);
  }

  /** Per-frame: re-target and update the prompt. */
  update() {
    this.active = this.findBestTarget();
    this.setPrompt(
      this.active ? `[Space] ${this.active.label}` : null,
      this.active?.type,
    );
  }

  /** The target the prompt is currently offering, if any. */
  getActiveTarget(): InteractionCandidate | null {
    return this.active;
  }

  /** Drop the current target and hide the prompt (UI opened, dialogue started). */
  clear() {
    this.active = null;
    this.setPrompt(null);
  }

  /**
   * Act on the current target. Falls back to a fresh scan so a keypress on the
   * very first frame of a scene still works.
   */
  tryInteract() {
    const candidate = this.active || this.findBestTarget();
    if (!candidate) return;

    // Walking through an exit should not spin the player round to face it.
    if (candidate.type !== 'transition') {
      const player = this.ctx.player();
      if (player) {
        this.deps.facePlayerToward(candidate.x, candidate.y);
      }
    }

    candidate.interact();
  }

  destroy() {
    this.providers = [];
    if (this.prompt) {
      this.prompt.destroy();
      this.prompt = null;
    }
    this.active = null;
  }
}

export { directionBetween };
