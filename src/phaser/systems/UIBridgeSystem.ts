/**
 * UIBridgeSystem — the wire between the React UI and the running world.
 *
 * React owns every panel (dialogue, journal, inventory, pause, settings) and
 * talks to the engine only through `eventBridge`. This system is the engine
 * side of that contract: it subscribes on scene create, unsubscribes on
 * shutdown, and translates each UI event into a call on whichever system owns
 * the behaviour.
 *
 * Almost everything here is one-line delegation. The exception is REST, which
 * is a genuine little cutscene — lock input, hold a beat so the player can read
 * the line, fade to black, close the dialogue, jump the clock with the lighting
 * crossfade suppressed (the world should be different when the screen comes
 * back, not seen changing), fade in, unlock. It lives here because it is
 * triggered by a dialogue topic and touches four systems at once.
 */

import Phaser from 'phaser';
import { eventBridge } from '../eventBridge';
import { hoursUntil } from '../core/timeMath';
import { useGameStore } from '../../stores/gameStore';
import { useDialogueStore } from '../../stores/dialogueStore';
import type { VisualQualityMode } from '../visualProfile';

/** Dialogue topics that put the player to bed, and the hour each wakes at. */
const REST_TOPICS: Record<string, number> = {
  'rest-dawn': 6,
  'rest-noon': 12,
  'rest-night': 21,
};

/** Beat before the fade, so the player can read the innkeeper's line. */
const REST_READ_DELAY_MS = 1500;
const REST_FADE_MS = 1000;

export interface UIBridgeDeps {
  currentHour(): number;
  isUIOpen(): boolean;
  notify(text: string): void;
  playSfx(key: string, volumeScale?: number): void;
  setMusicVolume(volume: number): void;
  setAmbientVolume(volume: number): void;
  setVisualMode(mode: VisualQualityMode): void;
  setDynamicVisual(enabled: boolean): void;
  travelTo(locationId: string): void;
  /** Stop the NPC's talk loop. */
  endDialogueAnimation(): void;
  /** Freeze the player where they stand and hold their idle pose. */
  freezePlayer(): void;
  /** Jump the clock. `animate: false` applies the new lighting instantly. */
  advanceTime(hours: number, animate: boolean): void;
  /** Zero the minute hand before a rest jump. */
  setMinute(minute: number): void;
  /** Lock/unlock world input for a cutscene. */
  setResting(resting: boolean): void;
}

export class UIBridgeSystem {
  private readonly scene: Phaser.Scene;
  private readonly deps: UIBridgeDeps;
  private unsubscribers: Array<() => void> = [];

  constructor(scene: Phaser.Scene, deps: UIBridgeDeps) {
    this.scene = scene;
    this.deps = deps;
  }

  create() {
    this.destroy();

    const on = (event: string, callback: (...args: unknown[]) => void) => {
      this.unsubscribers.push(eventBridge.on(event, callback));
    };

    // -- panels ------------------------------------------------------------
    on('ui:inventory:toggle', () => useGameStore.getState().toggleInventory());
    on('ui:journal:toggle', () => useGameStore.getState().toggleJournal());
    on('ui:pause:toggle', () => useGameStore.getState().togglePause());

    on('ui:dialogue:close', () => {
      useGameStore.getState().setDialogueOpen(false);
      this.deps.endDialogueAnimation();
    });

    on('ui:topic:select', (...args: unknown[]) => {
      // Topic selection itself is handled by dialogueStore.
      const topicKey = args[0] as string;
      console.log('Topic selected:', topicKey);
      this.deps.playSfx('sfx-dialogue-blip', 0.28);

      const wakeHour = REST_TOPICS[topicKey];
      if (wakeHour !== undefined) this.beginRest(wakeHour);
    });

    // -- dev travel --------------------------------------------------------
    on('ui:travel:to', (...args: unknown[]) => {
      if (!import.meta.env.DEV) return;
      const targetLocation = args[0] as string;
      if (!targetLocation || typeof targetLocation !== 'string') return;
      if (this.deps.isUIOpen()) return;
      this.deps.travelTo(targetLocation);
    });

    // -- settings ----------------------------------------------------------
    on('settings:music:volume', (...args: unknown[]) => {
      const volume = args[0] as number;
      if (typeof volume !== 'number') return;
      this.deps.setMusicVolume(volume);
    });

    on('settings:sfx:volume', (...args: unknown[]) => {
      const volume = args[0] as number;
      if (typeof volume !== 'number') return;
      useGameStore.getState().setSfxVolume(volume);
    });

    on('settings:ambient:volume', (...args: unknown[]) => {
      const volume = args[0] as number;
      if (typeof volume !== 'number') return;
      this.deps.setAmbientVolume(volume);
    });

    on('settings:visual:mode', (...args: unknown[]) => {
      this.deps.setVisualMode(args[0] as VisualQualityMode);
    });

    on('settings:visual:dynamic', (...args: unknown[]) => {
      this.deps.setDynamicVisual(Boolean(args[0]));
    });

    // -- world feedback ----------------------------------------------------
    on('quest:start', (...args: unknown[]) => {
      console.log('Quest started in Phaser:', args[0] as string);
      this.deps.notify('New Quest Started');
    });

    on('item:pickup', (...args: unknown[]) => {
      const itemId = args[0] as string;
      const itemName = args[1] as string;
      console.log('Item picked up in Phaser:', itemId);
      this.deps.notify(`Acquired: ${itemName}`);
      this.deps.playSfx('sfx-item-pickup', 0.38);
    });

    on('dialogue:item:given', () => this.deps.playSfx('sfx-item-pickup', 0.2));
    on('dialogue:money:paid', () => this.deps.playSfx('sfx-coin-clink', 0.34));
  }

  /**
   * Sleep until `wakeHour`. Resting at exactly that hour sleeps a full round.
   */
  private beginRest(wakeHour: number) {
    const hours = hoursUntil(this.deps.currentHour(), wakeHour);

    // Lock player input instantly, before the delay — otherwise the player can
    // walk away during the beat and wake up somewhere else.
    this.deps.setResting(true);
    this.deps.freezePlayer();

    this.scene.time.delayedCall(REST_READ_DELAY_MS, () => {
      this.scene.cameras.main.fadeOut(REST_FADE_MS, 0, 0, 0);
      this.scene.cameras.main.once('camerafadeoutcomplete', () => {
        useDialogueStore.getState().endDialogue();
        useGameStore.getState().setDialogueOpen(false);
        this.deps.endDialogueAnimation();

        // Land on the hour, and apply the new lighting instantly: the world
        // should be different when the screen comes back, not seen changing.
        this.deps.setMinute(0);
        this.deps.advanceTime(hours, false);

        this.scene.cameras.main.fadeIn(REST_FADE_MS, 0, 0, 0);
        this.scene.cameras.main.once('camerafadeincomplete', () => {
          this.deps.setResting(false);
        });
      });
    });
  }

  destroy() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
  }
}
