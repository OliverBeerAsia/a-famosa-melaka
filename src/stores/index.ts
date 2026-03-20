/**
 * Store exports
 */

export { useGameStore, useTime, usePlayer, useLocation, useVolumes } from './gameStore';
export type { GameState, TimeState, PlayerState } from './gameStore';

export { useDialogueStore } from './dialogueStore';
export type { DialogueState, NPCData, TopicData } from './dialogueStore';

export { useInventoryStore, ITEM_DEFINITIONS } from './inventoryStore';
export type { InventoryState, InventoryItem } from './inventoryStore';

export { useQuestStore } from './questStore';
export type { QuestState, Quest, QuestStage, QuestObjective, JournalEntry } from './questStore';

export { useSaveStore, formatPlaytime, formatTimestamp } from './saveStore';
export type { SaveState, SaveData, SaveSlotMeta } from './saveStore';
