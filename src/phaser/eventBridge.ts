/**
 * Phaser-React Event Bridge
 *
 * Enables bidirectional communication between Phaser game and React UI.
 * Uses a simple EventEmitter pattern for decoupled messaging.
 */

type EventCallback = (...args: unknown[]) => void;

class GameEventBridge {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private phaserGame: Phaser.Game | null = null;

  /**
   * Register a Phaser game instance
   */
  setGame(game: Phaser.Game) {
    this.phaserGame = game;
  }

  /**
   * Get the Phaser game instance
   */
  getGame(): Phaser.Game | null {
    return this.phaserGame;
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Subscribe to an event once
   */
  once(event: string, callback: EventCallback): () => void {
    const wrapper = (...args: unknown[]) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
  }
}

// Singleton instance
export const eventBridge = new GameEventBridge();

// Event type definitions for TypeScript support
export interface GameEvents {
  // Phaser -> React events
  'game:ready': [];
  'game:paused': [paused: boolean];
  'time:update': [hour: number, minute: number, timeOfDay: string];
  'player:move': [x: number, y: number];
  'player:location': [locationId: string, locationName: string];
  'npc:interact': [npcData: NPCInteractionData];
  'dialogue:start': [npcData: NPCInteractionData];
  'dialogue:end': [];
  'dialogue:topic:selected': [npcId: string, topicKey: string];
  'dialogue:item:given': [npcId: string, itemId: string];
  'dialogue:money:paid': [npcId: string, amount: number];
  'item:pickup': [itemId: string, itemName: string];
  'item:examine': [itemId: string, description: string];
  'quest:path:request': [pathId: string];
  'quest:start': [questId: string];
  'quest:advance': [questId: string, stage: number];
  'quest:complete': [questId: string, resolution: string];
  'message:show': [title: string, text: string];

  // React -> Phaser events
  'ui:inventory:toggle': [];
  'ui:journal:toggle': [];
  'ui:pause:toggle': [];
  'ui:dialogue:close': [];
  'ui:topic:select': [topicKey: string];
  'ui:travel:to': [locationId: string];
  'settings:music:volume': [volume: number];
  'settings:sfx:volume': [volume: number];
  'settings:ambient:volume': [volume: number];
  'settings:visual:mode': [mode: 'auto' | 'high' | 'balanced' | 'low'];
  'settings:visual:dynamic': [enabled: boolean];
  'game:save': [];
  'game:load': [slotIndex: number];
  'scene:change': [sceneKey: string, data?: Record<string, unknown>];
  'time:day-passed': [days: number, currentDay: number];
}

export interface NPCInteractionData {
  id: string;
  name: string;
  title?: string;
  portrait?: string;
  dialogue: {
    greeting: string;
    topics: Record<string, { text: string; unlocks?: string[] }>;
  };
}

// Type-safe emit helper
export function emitGameEvent<K extends keyof GameEvents>(
  event: K,
  ...args: GameEvents[K]
) {
  eventBridge.emit(event, ...args);
}

// Type-safe subscribe helper
export function onGameEvent<K extends keyof GameEvents>(
  event: K,
  callback: (...args: GameEvents[K]) => void
): () => void {
  return eventBridge.on(event, callback as EventCallback);
}

// React hook for event subscription
import { useEffect } from 'react';

export function useGameEvent<K extends keyof GameEvents>(
  event: K,
  callback: (...args: GameEvents[K]) => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const unsubscribe = onGameEvent(event, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
