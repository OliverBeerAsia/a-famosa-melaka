/**
 * Dialogue Store - NPC Conversation State
 *
 * Manages active dialogue, topics, and conversation history.
 * Handles topic requirements, unlocks, and quest triggers.
 */

import { create } from 'zustand';
import { emitGameEvent } from '../phaser/eventBridge';
import { useInventoryStore } from './inventoryStore';
import { useQuestStore } from './questStore';

export interface NPCData {
  id: string;
  name: string;
  title?: string;
  portrait?: string;
  dialogue: {
    greeting: string;
    greetingQuestActive?: string;
    greetingQuestComplete?: string;
    farewell?: string;
    topics: Record<string, TopicData>;
  };
  questGiver?: boolean;
  questId?: string;
}

export interface TopicData {
  text: string;
  requires?: string[];
  unlocks?: string[];
  questTrigger?: boolean;
  questId?: string;
  questCritical?: boolean;
  questPath?: string;
  givesItem?: string;
  takesItem?: string;
  takesMoney?: number;
}

export interface DialogueState {
  // Current conversation
  currentNPC: NPCData | null;
  currentText: string;
  availableTopics: string[];
  isTyping: boolean;

  // All NPC data for reference
  allNPCData: Record<string, NPCData>;

  // Unlocked topics per NPC (persisted)
  unlockedTopics: Record<string, string[]>;

  // Quest-related dialogue overrides
  dialogueOverrides: Record<string, Record<string, TopicData>>;

  // Actions
  setNPCData: (npcs: Record<string, NPCData>) => void;
  startDialogue: (npcId: string) => void;
  endDialogue: () => void;
  selectTopic: (topic: string) => void;
  setTyping: (typing: boolean) => void;
  skipTyping: () => void;
  unlockTopic: (npcId: string, topic: string) => void;
  setDialogueOverride: (npcId: string, overrides: Record<string, TopicData>) => void;
  replaceDialogueOverrides: (overrides: Record<string, Record<string, TopicData>>) => void;
  clearDialogueOverride: (npcId: string) => void;
  getTopicsForNPC: (npcId: string) => string[];
  isTopicAvailable: (npcId: string, topicKey: string) => boolean;

  // Serialization
  getUnlockedTopics: () => Record<string, string[]>;
  loadUnlockedTopics: (topics: Record<string, string[]>) => void;
}

const INITIAL_TOPIC_LIMIT = 5;
const TOPIC_REVEAL_BATCH = 2;

export const useDialogueStore = create<DialogueState>((set, get) => ({
  currentNPC: null,
  currentText: '',
  availableTopics: [],
  isTyping: false,
  allNPCData: {},
  unlockedTopics: {},
  dialogueOverrides: {},

  setNPCData: (npcs) => set({ allNPCData: npcs }),

  startDialogue: (npcId) => {
    const { allNPCData, unlockedTopics, dialogueOverrides } = get();
    const npc = allNPCData[npcId];

    if (!npc) {
      console.warn(`NPC not found: ${npcId}`);
      return;
    }

    // Merge dialogue overrides if any
    const mergedDialogue = { ...npc.dialogue };
    if (dialogueOverrides[npcId]) {
      mergedDialogue.topics = {
        ...mergedDialogue.topics,
        ...dialogueOverrides[npcId],
      };
    }

    const npcWithOverrides: NPCData = {
      ...npc,
      dialogue: mergedDialogue,
    };

    const seededTopics = seedTopicsForDialogue(npcWithOverrides, unlockedTopics[npcId] || []);
    const available = getVisibleTopics(npcWithOverrides, seededTopics);

    const questId = npc.questId;
    const questStore = useQuestStore.getState();
    let greeting = mergedDialogue.greeting;
    if (questId && questStore.isQuestCompleted(questId) && mergedDialogue.greetingQuestComplete) {
      greeting = mergedDialogue.greetingQuestComplete;
    } else if (questId && questStore.isQuestActive(questId) && mergedDialogue.greetingQuestActive) {
      greeting = mergedDialogue.greetingQuestActive;
    }

    set({
      currentNPC: npcWithOverrides,
      currentText: greeting,
      availableTopics: available,
      isTyping: true,
      unlockedTopics: {
        ...unlockedTopics,
        [npcId]: seededTopics,
      },
    });
  },

  endDialogue: () => set({
    currentNPC: null,
    currentText: '',
    availableTopics: [],
    isTyping: false,
  }),

  selectTopic: (topic) => {
    const { currentNPC, unlockedTopics } = get();
    if (!currentNPC) return;

    // Check for override first, then base topic
    const topicData = currentNPC.dialogue.topics[topic];
    if (!topicData) {
      console.warn(`Topic not found: ${topic}`);
      return;
    }

    const inventoryStore = useInventoryStore.getState();

    if (topicData.takesMoney && topicData.takesMoney > 0 && inventoryStore.money < topicData.takesMoney) {
      set({
        currentText: `I do not have enough cruzados (${topicData.takesMoney} required).`,
        isTyping: true,
      });
      return;
    }

    if (topicData.takesItem && !inventoryStore.hasItem(topicData.takesItem)) {
      set({
        currentText: `I do not have ${topicData.takesItem}.`,
        isTyping: true,
      });
      return;
    }

    if (topicData.takesItem) {
      inventoryStore.removeFirstItemById(topicData.takesItem);
      emitGameEvent('dialogue:item:given', currentNPC.id, topicData.takesItem);
    }

    if (topicData.takesMoney && topicData.takesMoney > 0) {
      inventoryStore.removeMoney(topicData.takesMoney);
      emitGameEvent('dialogue:money:paid', currentNPC.id, topicData.takesMoney);
    }

    // Set the new text and start typing
    set({ currentText: topicData.text, isTyping: true });

    let nextUnlocked = dedupeTopics([...(unlockedTopics[currentNPC.id] || []), topic]);

    // Handle topic unlocks
    if (topicData.unlocks) {
      topicData.unlocks.forEach((unlockTopic) => {
        get().unlockTopic(currentNPC.id, unlockTopic);
      });
      nextUnlocked = dedupeTopics([...nextUnlocked, ...topicData.unlocks]);
    }

    nextUnlocked = revealNextTopics(currentNPC, nextUnlocked);
    const available = getVisibleTopics(currentNPC, nextUnlocked);
    set((state) => ({
      availableTopics: available,
      unlockedTopics: {
        ...state.unlockedTopics,
        [currentNPC.id]: nextUnlocked,
      },
    }));

    // Handle quest trigger
    const topicQuestId = topicData.questId || currentNPC.questId;
    if (topicData.questTrigger && topicQuestId) {
      emitGameEvent('quest:start', topicQuestId);
    }

    // Handle item gifts
    if (topicData.givesItem) {
      emitGameEvent('item:pickup', topicData.givesItem, topicData.givesItem);
    }

    if (topicData.questPath) {
      emitGameEvent('quest:path:request', topicData.questPath);
    }

    emitGameEvent('dialogue:topic:selected', currentNPC.id, topic);

    // Emit topic selection for Phaser debug hooks
    emitGameEvent('ui:topic:select', topic);
  },

  setTyping: (typing) => set({ isTyping: typing }),

  skipTyping: () => set({ isTyping: false }),

  unlockTopic: (npcId, topic) => set((state) => {
    const current = state.unlockedTopics[npcId] || [];
    if (current.includes(topic)) return state;

    return {
      unlockedTopics: {
        ...state.unlockedTopics,
        [npcId]: [...current, topic],
      },
    };
  }),

  setDialogueOverride: (npcId, overrides) => set((state) => ({
    dialogueOverrides: {
      ...state.dialogueOverrides,
      [npcId]: {
        ...state.dialogueOverrides[npcId],
        ...overrides,
      },
    },
  })),

  replaceDialogueOverrides: (overrides) => set({ dialogueOverrides: overrides }),

  clearDialogueOverride: (npcId) => set((state) => {
    const { [npcId]: _, ...rest } = state.dialogueOverrides;
    return { dialogueOverrides: rest };
  }),

  getTopicsForNPC: (npcId) => {
    return get().unlockedTopics[npcId] || [];
  },

  isTopicAvailable: (npcId, topicKey) => {
    const { allNPCData, unlockedTopics } = get();
    const npc = allNPCData[npcId];
    if (!npc) return false;

    const visible = getVisibleTopics(npc, unlockedTopics[npcId] || []);
    return visible.includes(topicKey);
  },

  getUnlockedTopics: () => get().unlockedTopics,

  loadUnlockedTopics: (topics) => set({ unlockedTopics: topics }),
}));

function dedupeTopics(topics: string[]): string[] {
  return [...new Set(topics)];
}

function getEligibleTopics(npc: NPCData, unlockedTopics: string[]): string[] {
  const available: string[] = [];

  for (const [key, topic] of Object.entries(npc.dialogue.topics)) {
    if (topic.requires && topic.requires.length > 0) {
      const meetsRequirements = topic.requires.every((req) =>
        unlockedTopics.includes(req)
      );
      if (!meetsRequirements) continue;
    }

    available.push(key);
  }

  return available;
}

function prioritizeTopics(npc: NPCData, topics: string[]): string[] {
  return [...topics].sort((left, right) => {
    const leftData = npc.dialogue.topics[left];
    const rightData = npc.dialogue.topics[right];

    const leftPriority = Number(Boolean(
      leftData.questTrigger
      || leftData.questCritical
      || leftData.givesItem
      || leftData.takesItem
      || leftData.takesMoney
      || isActiveQuestTopic(npc.id, left)
    ));
    const rightPriority = Number(Boolean(
      rightData.questTrigger
      || rightData.questCritical
      || rightData.givesItem
      || rightData.takesItem
      || rightData.takesMoney
      || isActiveQuestTopic(npc.id, right)
    ));

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return 0;
  });
}

function isActiveQuestTopic(npcId: string, topicKey: string): boolean {
  return useQuestStore.getState().activeQuests.some((quest) => {
    const stage = quest.stages.find((candidate) => candidate.id === quest.currentStageId);
    return Boolean(stage?.objectives?.some((objective) =>
      objective.type === 'talk'
      && objective.target === npcId
      && objective.topic === topicKey
      && !objective.completed
    ));
  });
}

function seedTopicsForDialogue(npc: NPCData, unlockedTopics: string[]): string[] {
  if (unlockedTopics.length > 0) {
    return dedupeTopics(unlockedTopics);
  }

  const eligible = prioritizeTopics(npc, getEligibleTopics(npc, unlockedTopics));
  return eligible.slice(0, INITIAL_TOPIC_LIMIT);
}

function revealNextTopics(npc: NPCData, unlockedTopics: string[]): string[] {
  const eligible = prioritizeTopics(npc, getEligibleTopics(npc, unlockedTopics));
  const unrevealed = eligible.filter((topic) => !unlockedTopics.includes(topic));
  if (unrevealed.length === 0) {
    return dedupeTopics(unlockedTopics);
  }

  return dedupeTopics([
    ...unlockedTopics,
    ...unrevealed.slice(0, TOPIC_REVEAL_BATCH),
  ]);
}

function getVisibleTopics(npc: NPCData, unlockedTopics: string[]): string[] {
  const eligible = getEligibleTopics(npc, unlockedTopics);
  const visible = eligible.filter((topic) => unlockedTopics.includes(topic));

  if (visible.length > 0) {
    return prioritizeTopics(npc, visible);
  }

  return seedTopicsForDialogue(npc, unlockedTopics);
}
