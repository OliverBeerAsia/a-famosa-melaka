/**
 * Save Store - Game Persistence
 *
 * Handles save/load functionality for both web (localStorage) and Electron (userData).
 */

import { create } from 'zustand';
import { useGameStore, TimeState, PlayerState } from './gameStore';
import { useInventoryStore, InventoryItem } from './inventoryStore';
import { useQuestStore, Quest, JournalEntry, TrackedObjectiveRef } from './questStore';
import { useDialogueStore } from './dialogueStore';
import { getLocationName } from '../data/locationNames';

// Save data version for migration support
const SAVE_VERSION = 3;

export interface SaveSlotMeta {
  index: number;
  timestamp: number;
  location: string;
  locationName: string;
  playtime: number; // seconds
  isEmpty: boolean;
}

export interface SaveData {
  version: number;
  timestamp: number;
  playtime: number;
  player: PlayerState;
  time: TimeState;
  inventory: {
    items: InventoryItem[];
    money: number;
  };
  quests: {
    activeQuests: Quest[];
    completedQuests: string[];
    journal: JournalEntry[];
    worldFlags?: Record<string, boolean>;
    reputation?: {
      portuguese: number;
      chinese: number;
      malay: number;
      arab: number;
    };
    talkedToNPCs?: string[];
    seenTopics?: string[];
    trackedObjective?: TrackedObjectiveRef | null;
  };
  dialogue: {
    unlockedTopics: Record<string, string[]>;
  };
}

export interface SaveState {
  slots: SaveSlotMeta[];
  currentSlotIndex: number | null;
  sessionStartTime: number;
  totalPlaytime: number;

  // Actions
  initializeSlots: () => Promise<void>;
  saveGame: (slotIndex: number) => Promise<boolean>;
  loadGame: (slotIndex: number) => Promise<boolean>;
  getSlotMeta: (slotIndex: number) => Promise<SaveSlotMeta>;
  findMostRecentSlot: () => Promise<number | null>;
  deleteSave: (slotIndex: number) => Promise<void>;
  autoSave: () => Promise<boolean>;
}

const STORAGE_PREFIX = 'melaka_save_';
const AUTOSAVE_SLOT = 0;
const MAX_SLOTS = 4; // 1 autosave + 3 manual

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

// Storage helpers
async function saveToStorage(key: string, data: string): Promise<void> {
  if (isElectron) {
    // Electron: use IPC to save to userData
    // @ts-ignore
    await window.electronAPI.saveData(key, data);
  } else {
    // Web: use localStorage
    localStorage.setItem(key, data);
  }
}

async function loadFromStorage(key: string): Promise<string | null> {
  if (isElectron) {
    // @ts-ignore
    return await window.electronAPI.loadData(key);
  } else {
    return localStorage.getItem(key);
  }
}

async function removeFromStorage(key: string): Promise<void> {
  if (isElectron) {
    // @ts-ignore
    await window.electronAPI.removeData(key);
  } else {
    localStorage.removeItem(key);
  }
}

function isValidSlotIndex(slotIndex: number): boolean {
  return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < MAX_SLOTS;
}

function emptySlotMeta(slotIndex: number): SaveSlotMeta {
  return {
    index: slotIndex,
    timestamp: 0,
    location: '',
    locationName: slotIndex === AUTOSAVE_SLOT ? 'Autosave' : `Slot ${slotIndex}`,
    playtime: 0,
    isEmpty: true,
  };
}

function migrateLegacyQuests(rawQuests: unknown): Quest[] {
  if (!Array.isArray(rawQuests)) return [];

  return rawQuests.map((rawQuest, questIndex) => {
    const quest = rawQuest as Record<string, unknown>;
    const rawStages = Array.isArray(quest.stages) ? quest.stages as Array<Record<string, unknown>> : [];
    const migratedStages = rawStages.map((rawStage, stageIndex) => {
      const rawObjectives = Array.isArray(rawStage.objectives)
        ? rawStage.objectives as Array<Record<string, unknown>>
        : [];
      const objectives = rawObjectives.map((objective, objectiveIndex) => ({
        id: String(objective.id || `${objective.type || 'objective'}-${objectiveIndex}`),
        type: String(objective.type || 'talk'),
        target: objective.target as string | undefined,
        topic: objective.topic as string | undefined,
        item: objective.item as string | undefined,
        amount: typeof objective.amount === 'number' ? objective.amount : undefined,
        description: String(objective.description || 'Objective'),
        completed: Boolean(objective.completed),
        optional: Boolean(objective.optional),
      }));

      return {
        id: String(rawStage.id ?? stageIndex),
        description: String(rawStage.description || 'Quest Stage'),
        objectives,
        journalEntry: rawStage.journalEntry as string | undefined,
        nextStage: rawStage.nextStage as string | undefined,
        isBranching: Boolean(rawStage.isBranching),
        availablePaths: rawStage.availablePaths as Quest['stages'][number]['availablePaths'],
        path: rawStage.path as string | undefined,
        isEnding: Boolean(rawStage.isEnding),
        reward: rawStage.reward as Quest['stages'][number]['reward'] | undefined,
        givesItem: rawStage.givesItem as string | undefined,
        warning: rawStage.warning as string | undefined,
        consequenceText: rawStage.consequenceText as string | undefined,
        consequences: rawStage.consequences as Quest['stages'][number]['consequences'] | undefined,
        endingVariants: rawStage.endingVariants as Quest['stages'][number]['endingVariants'] | undefined,
        endingType: rawStage.endingType as string | undefined,
        npcDialogueOverrides: rawStage.npcDialogueOverrides as Quest['stages'][number]['npcDialogueOverrides'] | undefined,
      };
    });

    const currentStageIdx = typeof quest.currentStage === 'number'
      ? Math.max(0, quest.currentStage)
      : 0;
    const currentStageId = typeof quest.currentStageId === 'string'
      ? quest.currentStageId
      : String(migratedStages[currentStageIdx]?.id ?? 0);

    return {
      id: String(quest.id || `legacy-quest-${questIndex}`),
      name: String(quest.name || 'Legacy Quest'),
      description: String(quest.description || ''),
      giver: quest.giver as string | undefined,
      triggerTopic: quest.triggerTopic as string | undefined,
      prerequisite: quest.prerequisite as Quest['prerequisite'] | undefined,
      prerequisites: quest.prerequisites as string[] | undefined,
      stages: migratedStages,
      currentStageId,
      completed: Boolean(quest.completed),
      selectedPath: quest.selectedPath as string | undefined,
    };
  });
}

export const useSaveStore = create<SaveState>((set, get) => ({
  slots: [],
  currentSlotIndex: null,
  sessionStartTime: Date.now(),
  totalPlaytime: 0,

  initializeSlots: async () => {
    const slots: SaveSlotMeta[] = [];

    for (let i = 0; i < MAX_SLOTS; i++) {
      const meta = await get().getSlotMeta(i);
      slots.push(meta);
    }

    set({ slots, sessionStartTime: Date.now() });
  },

  getSlotMeta: async (slotIndex: number): Promise<SaveSlotMeta> => {
    if (!isValidSlotIndex(slotIndex)) {
      return emptySlotMeta(AUTOSAVE_SLOT);
    }

    try {
      const raw = await loadFromStorage(`${STORAGE_PREFIX}slot_${slotIndex}`);
      if (!raw) {
        return emptySlotMeta(slotIndex);
      }

      const data: SaveData = JSON.parse(raw);
      return {
        index: slotIndex,
        timestamp: data.timestamp,
        location: data.player.location,
        locationName: getLocationName(data.player.location),
        playtime: data.playtime,
        isEmpty: false,
      };
    } catch {
      return emptySlotMeta(slotIndex);
    }
  },

  findMostRecentSlot: async (): Promise<number | null> => {
    let latest: { slotIndex: number; timestamp: number } | null = null;

    for (let i = 0; i < MAX_SLOTS; i++) {
      const meta = await get().getSlotMeta(i);
      if (meta.isEmpty) continue;

      if (!latest || meta.timestamp > latest.timestamp) {
        latest = { slotIndex: i, timestamp: meta.timestamp };
      }
    }

    return latest?.slotIndex ?? null;
  },

  saveGame: async (slotIndex: number): Promise<boolean> => {
    if (!isValidSlotIndex(slotIndex)) {
      console.warn(`Invalid save slot index: ${slotIndex}`);
      return false;
    }

    try {
      const gameState = useGameStore.getState();
      const inventoryState = useInventoryStore.getState();
      const questState = useQuestStore.getState();
      const dialogueState = useDialogueStore.getState();

      // Calculate current playtime
      const { sessionStartTime, totalPlaytime } = get();
      const sessionTime = Math.floor((Date.now() - sessionStartTime) / 1000);
      const newPlaytime = totalPlaytime + sessionTime;

      const saveData: SaveData = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        playtime: newPlaytime,
        player: gameState.player,
        time: gameState.time,
        inventory: {
          items: inventoryState.items,
          money: inventoryState.money,
        },
        quests: {
          activeQuests: questState.activeQuests,
          completedQuests: questState.completedQuests,
          journal: questState.journal,
          worldFlags: questState.worldFlags,
          reputation: questState.reputation,
          talkedToNPCs: questState.talkedToNPCs,
          seenTopics: questState.seenTopics,
          trackedObjective: questState.trackedObjective,
        },
        dialogue: {
          unlockedTopics: dialogueState.unlockedTopics,
        },
      };

      await saveToStorage(
        `${STORAGE_PREFIX}slot_${slotIndex}`,
        JSON.stringify(saveData)
      );

      // Update slot metadata
      const { slots } = get();
      const updatedSlots = [...slots];
      updatedSlots[slotIndex] = {
        index: slotIndex,
        timestamp: saveData.timestamp,
        location: saveData.player.location,
        locationName: getLocationName(saveData.player.location),
        playtime: saveData.playtime,
        isEmpty: false,
      };

      set({
        slots: updatedSlots,
        currentSlotIndex: slotIndex,
        sessionStartTime: Date.now(),
        totalPlaytime: newPlaytime,
      });

      console.log(`Game saved to slot ${slotIndex}`);
      return true;
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  },

  loadGame: async (slotIndex: number): Promise<boolean> => {
    if (!isValidSlotIndex(slotIndex)) {
      console.warn(`Invalid load slot index: ${slotIndex}`);
      return false;
    }

    try {
      const raw = await loadFromStorage(`${STORAGE_PREFIX}slot_${slotIndex}`);
      if (!raw) {
        console.warn(`No save data in slot ${slotIndex}`);
        return false;
      }

      const saveData: SaveData = JSON.parse(raw);
      const migratedActiveQuests = migrateLegacyQuests(saveData.quests.activeQuests);

      // Validate version
      if (saveData.version !== SAVE_VERSION) {
        console.warn(`Save version mismatch: ${saveData.version} vs ${SAVE_VERSION}`);
        // Could add migration logic here
      }

      // Restore game state
      const gameStore = useGameStore.getState();
      gameStore.updatePlayer(saveData.player);
      gameStore.updateTime(saveData.time);
      gameStore.setLocation(saveData.player.location, getLocationName(saveData.player.location));
      gameStore.closeAllPanels();

      // Restore inventory
      const inventoryStore = useInventoryStore.getState();
      inventoryStore.hydrateInventory(saveData.inventory.items, saveData.inventory.money);

      // Restore quests
      const questStore = useQuestStore.getState();
      questStore.hydrateQuests(
        migratedActiveQuests,
        saveData.quests.completedQuests,
        saveData.quests.journal,
        saveData.quests.worldFlags,
        saveData.quests.reputation,
        saveData.quests.talkedToNPCs,
        saveData.quests.seenTopics,
        saveData.quests.trackedObjective
      );

      // Restore dialogue unlocks
      const dialogueStore = useDialogueStore.getState();
      dialogueStore.loadUnlockedTopics(saveData.dialogue.unlockedTopics);

      set({
        currentSlotIndex: slotIndex,
        sessionStartTime: Date.now(),
        totalPlaytime: saveData.playtime,
      });

      await get().initializeSlots();

      console.log(`Game loaded from slot ${slotIndex}`);
      return true;
    } catch (error) {
      console.error('Failed to load game:', error);
      return false;
    }
  },

  deleteSave: async (slotIndex: number) => {
    if (!isValidSlotIndex(slotIndex)) {
      return;
    }

    await removeFromStorage(`${STORAGE_PREFIX}slot_${slotIndex}`);

    const { slots } = get();
    const updatedSlots = [...slots];
    updatedSlots[slotIndex] = emptySlotMeta(slotIndex);

    set({ slots: updatedSlots });
    console.log(`Deleted save in slot ${slotIndex}`);
  },

  autoSave: async (): Promise<boolean> => {
    return get().saveGame(AUTOSAVE_SLOT);
  },
}));

// Format playtime for display
export function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Format timestamp for display
export function formatTimestamp(timestamp: number): string {
  if (timestamp === 0) return 'Empty';

  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
