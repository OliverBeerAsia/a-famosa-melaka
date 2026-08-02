/**
 * OpenableSystem — the Ultima VII container verb.
 *
 * Fourteen openables across the five plates, every one of them hung on a prop
 * that is ALREADY PAINTED. The whole feature ships without a single new sprite:
 * the prompt reads "Open the X", the notification fires, the contents land in
 * the inventory, and every subsequent look reads the `emptyText` — which is the
 * line the player will read most often and therefore the writing that matters.
 *
 * State lives in the quest store's world flags (`opened:<location>:<id>`),
 * which the save file already persists and the coordVersion discipline already
 * covers, so a save from before this pass simply has none of them set.
 *
 * The rules — locks, contents, witnesses, labels — are the pure functions in
 * core/openables. This is the Phaser and store half.
 */

import Phaser from 'phaser';
import { emitGameEvent } from '../eventBridge';
import { getLocationOpenables, type LocationOpenable } from '../core/LocationData';
import {
  evaluateLock,
  isWitnessed,
  lockRefusal,
  openableLabel,
  openedFlag,
  resolveContents,
  WITNESS_RADIUS_NATIVE,
  WITNESSED_FLAG,
  type OpenableWorld,
} from '../core/openables';
import type { SystemContext } from '../core/SystemContext';
import { useQuestStore } from '../../stores/questStore';
import { useInventoryStore, ITEM_DEFINITIONS } from '../../stores/inventoryStore';
import {
  INTERACTION_PRIORITY,
  INTERACTION_RADIUS,
} from '../core/interactionScore';
import type {
  InteractionCandidate,
  InteractionScan,
  InteractionSystem,
} from './InteractionSystem';

export interface OpenableDeps {
  /** Toast for the open notification. */
  notify(text: string): void;
  /**
   * World positions of everyone who could see this: named NPCs, residents,
   * crowd. The system does not own any of them, so it asks.
   */
  witnesses(): Array<{ x: number; y: number }>;
  /** Fire a sound cue for the open, if the scene has one. */
  playSfx?(key: string, volumeScale?: number): void;
}

export class OpenableSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: OpenableDeps;

  private openables: LocationOpenable[] = [];

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: OpenableDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  create() {
    this.openables = getLocationOpenables(this.ctx.locationId());
  }

  count(): number { return this.openables.length; }

  // -- world facts ---------------------------------------------------------

  /**
   * The quest pseudo-flags the drafts lock against.
   *
   * `quest-active:<id>` and `quest-complete:<id>` are not world flags — they
   * are questions about quest state — so they are resolved here, once per
   * evaluation, rather than being mirrored into the flag table where they would
   * immediately go stale.
   */
  private questFlags(): Record<string, boolean> {
    const state = useQuestStore.getState();
    const out: Record<string, boolean> = {};
    state.activeQuests.forEach((quest) => { out[`quest-active:${quest.id}`] = true; });
    state.completedQuests.forEach((id) => {
      out[`quest-complete:${id}`] = true;
      // A completed quest is not still active, but the drafts read
      // `quest-active:` as "this quest is in play", which a finished quest is.
      out[`quest-active:${id}`] = true;
    });
    return out;
  }

  private world(): OpenableWorld {
    return {
      worldFlags: useQuestStore.getState().worldFlags,
      questFlags: this.questFlags(),
      hasItem: (itemId: string) => useInventoryStore.getState().hasItem(itemId),
    };
  }

  private isOpened(openable: LocationOpenable): boolean {
    return Boolean(useQuestStore.getState().worldFlags[openedFlag(this.ctx.locationId(), openable.id)]);
  }

  // -- interaction ---------------------------------------------------------

  /**
   * Openables sit at ITEM priority, not scenery.
   *
   * A crate you can open is a different promise from a crate you can read a
   * sentence about, and the painted-scenery provider offers the same prop at
   * the same coordinates — so an openable has to outrank its own examine text
   * or the player would never reach it.
   */
  registerInteractions(interaction: InteractionSystem) {
    interaction.registerProvider((scan: InteractionScan) => {
      const out: InteractionCandidate[] = [];
      for (const openable of this.openables) {
        const scored = scan.score(openable.approach.x, openable.approach.y, INTERACTION_RADIUS.item);
        if (!scored) continue;
        out.push({
          type: 'item',
          id: `openable:${openable.id}`,
          label: openableLabel(openable, this.isOpened(openable)),
          x: openable.anchor.x,
          y: openable.anchor.y,
          priority: INTERACTION_PRIORITY.item,
          score: scored.score,
          interact: () => this.open(openable),
        });
      }
      return out;
    });
  }

  /** Open (or re-look at) a container. */
  private open(openable: LocationOpenable) {
    const world = this.world();
    const verdict = evaluateLock(openable, world);
    if (!verdict.open) {
      const itemName = verdict.reason === 'needs-item'
        ? ITEM_DEFINITIONS[verdict.itemId]?.name
        : undefined;
      emitGameEvent('message:show', openable.label, lockRefusal(verdict, itemName));
      return;
    }

    if (this.isOpened(openable)) {
      emitGameEvent('message:show', openable.label, openable.emptyText);
      return;
    }

    this.grant(openable);
  }

  /** Hand over the contents, set the flags, and record the opening. */
  private grant(openable: LocationOpenable) {
    const quests = useQuestStore.getState();
    const inventory = useInventoryStore.getState();
    const yielded = resolveContents(openable.contents);

    if (yielded.money > 0) inventory.addMoney(yielded.money);
    yielded.items.forEach(({ itemId, count }) => {
      for (let i = 0; i < count; i++) inventory.addItem(itemId);
      emitGameEvent('item:pickup', itemId, ITEM_DEFINITIONS[itemId]?.name || itemId);
      quests.recordObtain(itemId);
    });

    const flags = [
      openedFlag(this.ctx.locationId(), openable.id),
      ...yielded.flags,
      ...(openable.onOpen?.flags || []),
    ];

    if (this.wasWitnessed(openable)) flags.push(WITNESSED_FLAG);
    quests.setWorldFlags(flags);

    if (openable.onOpen?.reputation) {
      quests.applyReputationDelta(openable.onOpen.reputation);
    }

    // The quest layer's `search` objectives name openables by id, so opening
    // one IS completing the objective — no separate hotspot needed.
    quests.recordSearch(openable.id);

    this.deps.playSfx?.('sfx-door-open', 0.7);
    const notification = openable.onOpen?.notification;
    if (notification) {
      emitGameEvent('message:show', openable.label, notification);
    } else {
      this.deps.notify(openable.emptyText);
    }
  }

  /**
   * Was the player seen?
   *
   * Daylight plus anyone within 80 native px. Note that the rua-direita cooper
   * resident stands 44 px from Alvares's tally crates from 07:00 to 18:00,
   * which is not an accident.
   */
  private wasWitnessed(openable: LocationOpenable): boolean {
    const scale = this.ctx.location()?.world.scale ?? 3;
    const phase = this.ctx.timeOfDay();
    const distances = this.deps.witnesses().map((w) => (
      Phaser.Math.Distance.Between(w.x, w.y, openable.anchor.x, openable.anchor.y)
    ));
    return isWitnessed(
      openable,
      phase === 'day' || phase === 'dawn',
      distances,
      WITNESS_RADIUS_NATIVE * scale,
    );
  }

  destroy() {
    this.openables = [];
  }
}
