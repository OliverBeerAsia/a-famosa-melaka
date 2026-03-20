/**
 * Game Data Loader
 *
 * Loads all JSON game data (NPCs, items, quests) and populates React stores.
 * This runs during app initialization before the game starts.
 */

import { useDialogueStore, NPCData, TopicData } from '../stores/dialogueStore';
import { ITEM_DEFINITIONS } from '../stores/inventoryStore';
import { useQuestStore, Quest, QuestStage, QuestObjective } from '../stores/questStore';

// Import JSON data directly (Vite handles this)
import npcsData from './npcs.json';
import worldItemsData from './items.json';

// Quest imports
import questIndexData from './quests/index.json';
import merchantsSealQuest from './quests/merchants-seal.json';
import padresDilemmaQuest from './quests/padres-dilemma.json';
import piratesRumorQuest from './quests/pirates-rumor.json';
import rashidsCargoQuest from './quests/rashids-cargo.json';

export interface RawQuestData {
  id: string;
  name: string;
  description: string;
  startLocation?: string;
  questGiver?: string;
  giver?: string;
  triggerTopic?: string;
  prerequisite?: {
    questComplete?: string;
    reputation?: Record<'portuguese' | 'chinese' | 'malay' | 'arab', number>;
  };
  prerequisites?: string[];
  stages: RawQuestStage[];
  items?: Record<string, { id: string; name: string; description: string; questItem?: boolean }>;
  dialogueOverrides?: Record<string, Record<string, Record<string, string>>>;
}

export interface RawQuestStage {
  id: string;
  description: string;
  objectives?: RawObjective[];
  journalEntry?: string;
  nextStage?: string;
  isBranching?: boolean;
  availablePaths?: {
    id: string;
    name: string;
    description?: string;
    nextStage: string;
    risky?: boolean;
    requirements?: {
      money?: number;
      talkedTo?: string[];
      topic?: string;
      time?: 'dawn' | 'day' | 'dusk' | 'night';
    };
  }[];
  path?: string;
  isEnding?: boolean;
  reward?: {
    items?: string[];
    money?: number;
    reputation?: Record<'portuguese' | 'chinese' | 'malay' | 'arab', number>;
  };
  givesItem?: string;
  warning?: string;
  consequenceText?: string;
  consequences?: {
    reputation?: Record<'portuguese' | 'chinese' | 'malay' | 'arab', number>;
    worldChanges?: string[];
    flags?: string[];
    npcReactions?: Record<string, string>;
  };
  endingVariants?: Record<string, { text?: string; reward?: RawQuestStage['reward'] }>;
  endingType?: string;
  npcDialogueOverrides?: Record<string, Record<string, unknown>>;
}

export interface RawObjective {
  id?: string;
  type: string;
  target?: string;
  topic?: string;
  item?: string;
  amount?: number;
  completed?: boolean;
  optional?: boolean;
  description?: string;
  destination?: string;
  time?: 'dawn' | 'day' | 'dusk' | 'night';
  days?: number;
}

interface RuntimeNPCData extends NPCData {
  sprite?: string;
  location?: string;
  position?: { x: number; y: number };
  schedule?: Array<{
    startHour: number;
    endHour: number;
    activity: string;
    location: string;
    available: boolean;
  }>;
}

const QUEST_SUPPORT_NPCS: Record<string, RuntimeNPCData> = {};

// Store all loaded quests by ID
const questDataCache: Map<string, RawQuestData> = new Map();

/**
 * Load all game data and populate stores
 */
export async function loadGameData(): Promise<void> {
  console.log('[DataLoader] Loading game data...');

  // Cache quest data first so quest hooks can be injected into NPC dialogue
  loadQuestData();

  // Load NPC data into dialogue store
  loadNPCData();

  // Load item definitions into inventory store
  loadItemDefinitions();

  console.log('[DataLoader] Game data loaded successfully');
}

/**
 * Load NPC data into dialogue store
 */
function loadNPCData(): void {
  const baseNPCs = npcsData as unknown as Record<string, RuntimeNPCData>;
  const npcs: Record<string, RuntimeNPCData> = {};

  Object.entries({ ...baseNPCs, ...QUEST_SUPPORT_NPCS }).forEach(([npcId, npc]) => {
    npcs[npcId] = {
      ...npc,
      dialogue: {
        ...npc.dialogue,
        topics: { ...(npc.dialogue?.topics || {}) },
      },
    };
  });

  questDataCache.forEach((quest) => {
    const giverId = quest.giver || quest.questGiver;
    const triggerTopic = quest.triggerTopic;
    if (!giverId || !triggerTopic) return;

    const giver = npcs[giverId];
    if (!giver) return;

    const existingTopic = giver.dialogue.topics[triggerTopic] as TopicData | undefined;
    giver.dialogue.topics[triggerTopic] = {
      text: existingTopic?.text || `I need your help regarding "${quest.name}".`,
      ...existingTopic,
      questTrigger: true,
      questId: quest.id,
    };
  });

  // Set NPC data in dialogue store
  useDialogueStore.getState().setNPCData(npcs as unknown as Record<string, NPCData>);

  console.log(`[DataLoader] Loaded ${Object.keys(npcs).length} NPCs`);
}

/**
 * Load item definitions - they're already in the inventory store
 * This function just logs them for verification
 */
function loadItemDefinitions(): void {
  console.log(`[DataLoader] Loaded ${Object.keys(ITEM_DEFINITIONS).length} item definitions`);
}

/**
 * Get world items at a specific location
 */
export function getWorldItemsAtLocation(locationId: string): WorldItem[] {
  const worldItems = worldItemsData as { 'world-items': Record<string, WorldItem[]> };
  return worldItems['world-items'][locationId] || [];
}

interface WorldItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  description: string;
}

/**
 * Load and cache quest data
 */
function loadQuestData(): void {
  questDataCache.clear();

  const questMap: Record<string, RawQuestData> = {
    'merchants-seal': merchantsSealQuest as unknown as RawQuestData,
    'padres-dilemma': padresDilemmaQuest as unknown as RawQuestData,
    'pirates-rumor': piratesRumorQuest as unknown as RawQuestData,
    'rashids-cargo': rashidsCargoQuest as unknown as RawQuestData,
  };

  const questIds = ((questIndexData as unknown as { quests?: string[] }).quests || [])
    .filter((id) => !!questMap[id]);

  const quests = questIds.length
    ? questIds.map((id) => questMap[id])
    : Object.values(questMap);

  for (const quest of quests) {
    questDataCache.set(quest.id, quest);
    console.log(`[DataLoader] Cached quest: ${quest.id} - ${quest.name}`);
  }

  console.log(`[DataLoader] Loaded ${quests.length} quests`);
}

/**
 * Get quest data by ID
 */
export function getQuestData(questId: string): RawQuestData | undefined {
  return questDataCache.get(questId);
}

/**
 * Start a quest by ID
 */
export function startQuest(questId: string): void {
  const questData = questDataCache.get(questId);
  if (!questData) {
    console.warn(`[DataLoader] Quest not found: ${questId}`);
    return;
  }

  // Convert raw quest data to Quest interface
  const quest = convertToQuest(questData);
  useQuestStore.getState().startQuest(quest);

  console.log(`[DataLoader] Started quest: ${questId}`);
}

/**
 * Convert raw quest JSON to Quest interface
 */
function convertToQuest(raw: RawQuestData): Quest {
  const stages: QuestStage[] = raw.stages.map((stage, index) => ({
    id: stage.id,
    description: stage.description,
    objectives: (stage.objectives || []).map((obj) => convertObjective(obj)),
    journalEntry: stage.journalEntry,
    nextStage: stage.nextStage,
    isBranching: stage.isBranching,
    availablePaths: stage.availablePaths,
    path: stage.path,
    isEnding: stage.isEnding,
    reward: stage.reward,
    givesItem: stage.givesItem,
    warning: stage.warning,
    consequenceText: stage.consequenceText,
    consequences: stage.consequences,
    endingVariants: stage.endingVariants,
    endingType: stage.endingType,
    npcDialogueOverrides: stage.npcDialogueOverrides as QuestStage['npcDialogueOverrides'],
  }));

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    giver: raw.giver || raw.questGiver,
    triggerTopic: raw.triggerTopic,
    prerequisite: raw.prerequisite,
    prerequisites: raw.prerequisites,
    stages,
    currentStageId: stages[0]?.id || 'start',
    completed: false,
  };
}

/**
 * Convert raw objective to QuestObjective interface
 */
function convertObjective(raw: RawObjective): QuestObjective {
  const identity = raw.id || [
    raw.type,
    raw.target || 'none',
    raw.topic || 'none',
    raw.item || 'none',
    raw.amount?.toString() || 'none',
    raw.destination || 'none',
  ].join('-');
  return {
    id: identity,
    type: raw.type as QuestObjective['type'],
    target: raw.target,
    topic: raw.topic,
    item: raw.item,
    amount: raw.amount,
    destination: raw.destination,
    time: raw.time,
    days: raw.days,
    description: raw.description || `${raw.type} ${raw.target || raw.item || ''}`,
    completed: raw.completed || false,
    optional: raw.optional || false,
  };
}

/**
 * Get NPC data by ID (for external use)
 */
export function getNPCData(npcId: string): NPCData | undefined {
  return useDialogueStore.getState().allNPCData[npcId];
}

/**
 * Get all NPC IDs for a location
 */
export function getNPCsAtLocation(locationId: string): string[] {
  const npcs = useDialogueStore.getState().allNPCData;
  return Object.values(npcs)
    .filter((npc) => (npc as NPCData & { location?: string }).location === locationId)
    .map((npc) => npc.id);
}

/**
 * Apply quest dialogue overrides for a specific quest stage
 */
export function applyQuestDialogueOverrides(
  questId: string,
  npcOverrides: Record<string, Record<string, { text: string; unlocks?: string[]; givesItem?: string }>>
): void {
  const dialogueStore = useDialogueStore.getState();

  for (const [npcId, topics] of Object.entries(npcOverrides)) {
    dialogueStore.setDialogueOverride(npcId, topics);
  }

  console.log(`[DataLoader] Applied dialogue overrides for quest: ${questId}`);
}
