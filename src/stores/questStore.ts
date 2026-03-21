/**
 * Quest Store - Runtime Quest Progression
 *
 * Supports stage-id progression, branching paths, consequence application,
 * and objective tracking for authored JSON quest data.
 */

import { create } from 'zustand';
import { useGameStore } from './gameStore';
import { useInventoryStore } from './inventoryStore';
import { useDialogueStore, TopicData } from './dialogueStore';

export type ReputationFaction =
  | 'garrison'
  | 'church'
  | 'portuguese-merchants'
  | 'chinese-merchants'
  | 'kampung-community'
  | 'dockside-network';

export interface ReputationState {
  garrison: number;
  church: number;
  'portuguese-merchants': number;
  'chinese-merchants': number;
  'kampung-community': number;
  'dockside-network': number;
}

export interface ReputationRequirementMap extends Partial<Record<ReputationFaction, number>> {}

export interface ConditionalRequirements {
  time?: 'dawn' | 'day' | 'dusk' | 'night';
  location?: string;
  money?: number;
  itemsAll?: string[];
  talkedTo?: string[];
  topic?: string;
  reputation?: ReputationRequirementMap;
  maxReputation?: ReputationRequirementMap;
  worldFlagsAll?: string[];
  worldFlagsAny?: string[];
  worldFlagsNone?: string[];
  completedQuests?: string[];
  completedQuestPaths?: string[];
}

export interface QuestObjective {
  id: string;
  type: 'talk' | 'give' | 'find' | 'go' | 'pay' | 'explore' | 'location' | 'obtain' | 'search' | 'stealth' | 'escort' | 'wait' | 'collect' | string;
  target?: string;
  topic?: string;
  item?: string;
  amount?: number;
  destination?: string;
  time?: 'dawn' | 'day' | 'dusk' | 'night';
  days?: number;
  description: string;
  completed: boolean;
  optional?: boolean;
}

export interface QuestReward {
  items?: string[];
  money?: number;
  reputation?: Partial<Record<ReputationFaction, number>>;
}

export interface QuestConsequences {
  reputation?: Partial<Record<ReputationFaction, number>>;
  worldChanges?: string[];
  flags?: string[];
  npcReactions?: Record<string, string>;
}

export interface QuestPathRequirements {
  money?: number;
  talkedTo?: string[];
  topic?: string;
  time?: 'dawn' | 'day' | 'dusk' | 'night';
  location?: string;
  itemsAll?: string[];
  reputation?: ReputationRequirementMap;
  maxReputation?: ReputationRequirementMap;
  worldFlagsAll?: string[];
  worldFlagsAny?: string[];
  worldFlagsNone?: string[];
  completedQuests?: string[];
  completedQuestPaths?: string[];
}

export interface QuestPathOption {
  id: string;
  name: string;
  description?: string;
  requirements?: QuestPathRequirements;
  nextStage: string;
  risky?: boolean;
}

export interface QuestStage {
  id: string;
  description: string;
  objectives: QuestObjective[];
  journalEntry?: string;
  nextStage?: string;
  isBranching?: boolean;
  availablePaths?: QuestPathOption[];
  path?: string;
  isEnding?: boolean;
  reward?: QuestReward;
  givesItem?: string;
  warning?: string;
  consequenceText?: string;
  consequences?: QuestConsequences;
  endingVariants?: Record<string, { text?: string; reward?: QuestReward }>;
  endingType?: string;
  npcDialogueOverrides?: Record<string, Record<string, TopicData>>;
}

export interface QuestPrerequisite {
  questComplete?: string;
  reputation?: Partial<Record<ReputationFaction, number>>;
  completedQuestPaths?: string[];
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  giver?: string;
  triggerTopic?: string;
  prerequisite?: QuestPrerequisite;
  prerequisites?: string[];
  stages: QuestStage[];
  currentStageId: string;
  completed: boolean;
  selectedPath?: string;
}

export interface JournalEntry {
  id: string;
  text: string;
  timestamp: { hour: number; minute: number; day: number };
  timeString: string;
  category: 'quest' | 'discovery' | 'rumor';
}

export interface TrackedObjectiveRef {
  questId: string;
  objectiveId: string;
}

export interface TrackedObjectiveData {
  questId: string;
  questName: string;
  stageId: string;
  objective: QuestObjective;
}

export interface NarrativeCurrent {
  id: string;
  title: string;
  text: string;
  tone: 'favorable' | 'wary' | 'hostile';
}

interface PathValidation {
  allowed: boolean;
  reason?: string;
}

const DEFAULT_REPUTATION: ReputationState = {
  garrison: 0,
  church: 0,
  'portuguese-merchants': 0,
  'chinese-merchants': 0,
  'kampung-community': 0,
  'dockside-network': 0,
};

const SIGNIFICANT_REPUTATION_THRESHOLD = 12;

const FACTION_DISPLAY_NAMES: Record<ReputationFaction, string> = {
  garrison: 'Garrison',
  church: 'Church',
  'portuguese-merchants': 'Portuguese Merchants',
  'chinese-merchants': 'Chinese Merchants',
  'kampung-community': 'Kampung Community',
  'dockside-network': 'Dockside Network',
};

const FACTION_NARRATIVE: Record<ReputationFaction, { favorable: string; wary: string; hostile: string }> = {
  garrison: {
    favorable: 'The garrison treats you as a useful hand in matters of order.',
    wary: 'The garrison watches you, uncertain whether you serve order or profit.',
    hostile: 'The garrison regards you as a liability around gates, inspections, and patrols.',
  },
  church: {
    favorable: 'Church figures speak to you as someone who can be trusted with delicate matters of conscience.',
    wary: 'The Church listens, but withholds full confidence until your conduct settles.',
    hostile: 'Church trust has cooled; your name now carries doubt where mercy and witness are concerned.',
  },
  'portuguese-merchants': {
    favorable: 'Portuguese merchants see you as someone who can move paper, favors, and cargo without waste.',
    wary: 'Portuguese merchants weigh your usefulness against the trouble you attract.',
    hostile: 'Portuguese merchants now treat you as dangerous to contracts, credit, or orderly trade.',
  },
  'chinese-merchants': {
    favorable: 'Chinese merchants regard you as precise, discreet, and worth doing business with.',
    wary: 'Chinese merchants still read you carefully before showing their ledgers or trust.',
    hostile: 'Chinese merchants believe you disturb the balance of trade more than you help it.',
  },
  'kampung-community': {
    favorable: 'The kampung speaks of you as someone who understands that survival is not always lawful.',
    wary: 'The kampung has not closed its doors, but neither has it taken you fully into confidence.',
    hostile: 'The kampung remembers the harm attached to your name and keeps its distance.',
  },
  'dockside-network': {
    favorable: 'Dockside brokers and sailors treat you as someone who understands harbor realities.',
    wary: 'The docks still deal with you, but rumor travels ahead of your footsteps.',
    hostile: 'The dockside network marks you as unsafe company for smuggling, passage, or quiet work.',
  },
};

export function getFactionDisplayName(faction: ReputationFaction): string {
  return FACTION_DISPLAY_NAMES[faction];
}

export function getReputationBand(value: number): 'favorable' | 'wary' | 'hostile' {
  if (value >= SIGNIFICANT_REPUTATION_THRESHOLD) return 'favorable';
  if (value <= -SIGNIFICANT_REPUTATION_THRESHOLD) return 'hostile';
  return 'wary';
}

export function describeNarrativeCurrent(faction: ReputationFaction, value: number): NarrativeCurrent | null {
  if (Math.abs(value) < SIGNIFICANT_REPUTATION_THRESHOLD) return null;

  const tone = getReputationBand(value);
  return {
    id: faction,
    title: getFactionDisplayName(faction),
    text: FACTION_NARRATIVE[faction][tone],
    tone,
  };
}

export interface QuestState {
  activeQuests: Quest[];
  completedQuests: string[];
  completedQuestResolutions: Record<string, string>;
  journal: JournalEntry[];
  worldFlags: Record<string, boolean>;
  reputation: ReputationState;
  talkedToNPCs: string[];
  seenTopics: string[];
  trackedObjective: TrackedObjectiveRef | null;

  startQuest: (quest: Quest) => boolean;
  advanceQuest: (questId: string, newStageId?: string) => void;
  selectQuestPath: (questId: string, pathId: string) => boolean;
  requestPathSelection: (pathId: string) => boolean;
  canSelectPath: (questId: string, pathId: string) => PathValidation;
  completeObjective: (questId: string, objectiveId: string) => void;
  completeQuest: (questId: string, resolution?: string) => void;
  addJournalEntry: (text: string, category?: 'quest' | 'discovery' | 'rumor') => void;

  recordTalk: (npcId: string, topic: string) => void;
  recordLocation: (locationId: string) => void;
  recordObtain: (itemId: string) => void;
  recordGive: (npcId: string, itemId: string) => void;
  recordPay: (npcId: string, amount: number) => void;
  recordSearch: (target: string) => void;
  recordStealth: (target: string) => void;
  recordEscort: (target: string, destination?: string) => void;
  recordWait: (days?: number) => void;
  setTrackedObjective: (questId: string, objectiveId: string) => boolean;
  clearTrackedObjective: () => void;

  hydrateQuests: (
    quests: Quest[],
    completedQuests: string[],
    journal: JournalEntry[],
    worldFlags?: Record<string, boolean>,
    reputation?: ReputationState,
    completedQuestResolutions?: Record<string, string>,
    talkedToNPCs?: string[],
    seenTopics?: string[],
    trackedObjective?: TrackedObjectiveRef | null
  ) => void;

  getActiveQuests: () => Quest[];
  getQuestStage: (questId: string) => QuestStage | null;
  getTrackedObjective: () => TrackedObjectiveData | null;
  getNarrativeCurrents: () => NarrativeCurrent[];
  getCompletedQuestResolution: (questId: string) => string | null;
  isQuestActive: (questId: string) => boolean;
  isQuestCompleted: (questId: string) => boolean;
}

let journalCounter = 0;

function clampReputation(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

function normalizeReputationState(
  input?: Partial<Record<ReputationFaction, number>> | Record<string, number> | null
): ReputationState {
  if (!input) return { ...DEFAULT_REPUTATION };

  const normalized: ReputationState = { ...DEFAULT_REPUTATION };

  const legacyAliases: Record<string, ReputationFaction[]> = {
    portuguese: ['garrison', 'portuguese-merchants'],
    chinese: ['chinese-merchants'],
    malay: ['kampung-community'],
    arab: ['dockside-network'],
  };

  Object.entries(input).forEach(([rawFaction, rawValue]) => {
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return;

    const faction = rawFaction as ReputationFaction;
    if (faction in DEFAULT_REPUTATION) {
      normalized[faction] = clampReputation(rawValue);
      return;
    }

    const mappedFactions = legacyAliases[rawFaction] || [];
    mappedFactions.forEach((mappedFaction) => {
      normalized[mappedFaction] = clampReputation(rawValue);
    });
  });

  return normalized;
}

function checkConditionalRequirements(
  requirements: ConditionalRequirements | undefined,
  state: Pick<QuestState, 'reputation' | 'worldFlags' | 'talkedToNPCs' | 'seenTopics' | 'completedQuests' | 'completedQuestResolutions'>,
  inventoryState: ReturnType<typeof useInventoryStore.getState>,
  gameState: ReturnType<typeof useGameStore.getState>
): PathValidation {
  if (!requirements) return { allowed: true };

  if (requirements.money && inventoryState.money < requirements.money) {
    return { allowed: false, reason: `Requires ${requirements.money} cruzados.` };
  }

  if (requirements.itemsAll?.length) {
    const hasAllItems = requirements.itemsAll.every((itemId) => inventoryState.hasItem(itemId));
    if (!hasAllItems) {
      return { allowed: false, reason: 'You are missing the required documents or goods for this approach.' };
    }
  }

  if (requirements.talkedTo?.length) {
    const hasTalkedToAll = requirements.talkedTo.every((npcId) => state.talkedToNPCs.includes(npcId));
    if (!hasTalkedToAll) {
      return { allowed: false, reason: 'You need to gather more testimony before choosing this path.' };
    }
  }

  if (requirements.topic && !state.seenTopics.includes(requirements.topic)) {
    return { allowed: false, reason: `You must discuss topic "${requirements.topic}" first.` };
  }

  if (requirements.time && gameState.time.timeOfDay !== requirements.time) {
    return { allowed: false, reason: `This path is only available during ${requirements.time}.` };
  }

  if (requirements.location && gameState.currentLocation !== requirements.location) {
    return { allowed: false, reason: `You need to be in ${requirements.location} to pursue this route.` };
  }

  if (requirements.reputation) {
    const meetsRep = (Object.entries(requirements.reputation) as Array<[ReputationFaction, number]>)
      .every(([faction, minValue]) => (state.reputation[faction] ?? 0) >= minValue);
    if (!meetsRep) {
      return { allowed: false, reason: 'You do not yet have enough trust with the right people.' };
    }
  }

  if (requirements.maxReputation) {
    const underRep = (Object.entries(requirements.maxReputation) as Array<[ReputationFaction, number]>)
      .every(([faction, maxValue]) => (state.reputation[faction] ?? 0) <= maxValue);
    if (!underRep) {
      return { allowed: false, reason: 'You are too closely associated with the wrong side for this path.' };
    }
  }

  if (requirements.worldFlagsAll?.length) {
    const hasAllFlags = requirements.worldFlagsAll.every((flag) => Boolean(state.worldFlags[flag]));
    if (!hasAllFlags) {
      return { allowed: false, reason: 'The city has not shifted into position for this route yet.' };
    }
  }

  if (requirements.worldFlagsAny?.length) {
    const hasAnyFlag = requirements.worldFlagsAny.some((flag) => Boolean(state.worldFlags[flag]));
    if (!hasAnyFlag) {
      return { allowed: false, reason: 'You still need leverage, rumor, or proof before this path opens.' };
    }
  }

  if (requirements.worldFlagsNone?.length) {
    const hasBlockedFlag = requirements.worldFlagsNone.some((flag) => Boolean(state.worldFlags[flag]));
    if (hasBlockedFlag) {
      return { allowed: false, reason: 'Events in the city have already closed off this route.' };
    }
  }

  if (requirements.completedQuests?.length) {
    const hasAllQuests = requirements.completedQuests.every((questId) => state.completedQuests.includes(questId));
    if (!hasAllQuests) {
      return { allowed: false, reason: 'You need more standing in the city before this opens.' };
    }
  }

  if (requirements.completedQuestPaths?.length) {
    const hasAllPaths = requirements.completedQuestPaths.every((token) => {
      const [questId, resolution] = token.split(':');
      if (!questId || !resolution) return false;
      return state.completedQuestResolutions[questId] === resolution;
    });
    if (!hasAllPaths) {
      return { allowed: false, reason: 'Your earlier choices have not opened this route.' };
    }
  }

  return { allowed: true };
}

function mergeDialogueOverrides(
  target: Record<string, Record<string, TopicData>>,
  source: Record<string, Record<string, TopicData>>
) {
  Object.entries(source).forEach(([npcId, topics]) => {
    if (!target[npcId]) {
      target[npcId] = {};
    }
    target[npcId] = { ...target[npcId], ...topics };
  });
}

export const useQuestStore = create<QuestState>((set, get) => {
  const getFirstIncompleteObjective = (
    quests: Quest[]
  ): TrackedObjectiveRef | null => {
    for (const quest of quests) {
      const stage = quest.stages.find((candidate) => candidate.id === quest.currentStageId);
      if (!stage || stage.isBranching || !stage.objectives?.length) continue;

      const nextRequired = stage.objectives.find((objective) => !objective.completed && !objective.optional)
        || stage.objectives.find((objective) => !objective.completed);
      if (nextRequired) {
        return { questId: quest.id, objectiveId: nextRequired.id };
      }
    }
    return null;
  };

  const resolveTrackedObjective = (quests: Quest[], tracked: TrackedObjectiveRef | null): TrackedObjectiveRef | null => {
    if (tracked) {
      const quest = quests.find((candidate) => candidate.id === tracked.questId);
      const stage = quest?.stages.find((candidate) => candidate.id === quest.currentStageId);
      const objective = stage?.objectives.find((candidate) => candidate.id === tracked.objectiveId);
      if (objective && !objective.completed) {
        return tracked;
      }
    }
    return getFirstIncompleteObjective(quests);
  };

  const syncTrackedObjective = () => {
    set((state) => {
      const nextTracked = resolveTrackedObjective(state.activeQuests, state.trackedObjective);
      if (
        state.trackedObjective?.questId === nextTracked?.questId
        && state.trackedObjective?.objectiveId === nextTracked?.objectiveId
      ) {
        return state;
      }
      return { trackedObjective: nextTracked };
    });
  };

  const syncDialogueOverrides = () => {
    const aggregated: Record<string, Record<string, TopicData>> = {};

    get().activeQuests.forEach((quest) => {
      const stage = quest.stages.find((s) => s.id === quest.currentStageId);
      if (!stage) return;

      if (stage.npcDialogueOverrides) {
        mergeDialogueOverrides(aggregated, stage.npcDialogueOverrides);
      }

      stage.objectives.forEach((objective, idx) => {
        if (objective.type !== 'pay' || objective.completed || !objective.target || !objective.amount) return;

        const key = `pay-${quest.id}-${stage.id}-${idx}`;
        if (!aggregated[objective.target]) {
          aggregated[objective.target] = {};
        }
        aggregated[objective.target][key] = {
          text: `I can pay ${objective.amount} cruzados now.`,
          takesMoney: objective.amount,
          questCritical: true,
          questPath: 'payment',
        };
      });
    });

    useDialogueStore.getState().replaceDialogueOverrides(aggregated);
  };

  const applyReputationChange = (delta: Partial<Record<ReputationFaction, number>>) => {
    set((state) => {
      const reputation: ReputationState = { ...state.reputation };
      (Object.keys(delta) as ReputationFaction[]).forEach((faction) => {
        const change = delta[faction] ?? 0;
        reputation[faction] = clampReputation((reputation[faction] ?? 0) + change);
      });
      return { reputation };
    });
  };

  const applyReward = (reward?: QuestReward) => {
    if (!reward) return;

    const inventory = useInventoryStore.getState();
    if (reward.money) {
      inventory.addMoney(reward.money);
    }
    if (reward.items?.length) {
      reward.items.forEach((itemId) => {
        inventory.addItem(itemId);
      });
    }
    if (reward.reputation) {
      applyReputationChange(reward.reputation);
    }
  };

  const applyConsequences = (consequences?: QuestConsequences) => {
    if (!consequences) return;

    if (consequences.reputation) {
      applyReputationChange(consequences.reputation);
    }

    if (consequences.worldChanges?.length || consequences.flags?.length) {
      set((state) => {
        const worldFlags = { ...state.worldFlags };
        (consequences.worldChanges || []).forEach((flag) => {
          worldFlags[flag] = true;
        });
        (consequences.flags || []).forEach((flag) => {
          worldFlags[flag] = true;
        });
        return { worldFlags };
      });
    }
  };

  const isStageComplete = (stage: QuestStage): boolean => {
    if (stage.isBranching) return false;
    if (!stage.objectives || stage.objectives.length === 0) return true;

    const required = stage.objectives.filter((objective) => !objective.optional);
    if (required.length > 0) {
      return required.every((objective) => objective.completed);
    }
    return stage.objectives.every((objective) => objective.completed);
  };

  const applyStageOutcome = (quest: Quest, stage: QuestStage) => {
    if (stage.consequenceText) {
      get().addJournalEntry(stage.consequenceText, 'discovery');
    }

    if (stage.givesItem) {
      useInventoryStore.getState().addItem(stage.givesItem);
    }

    applyReward(stage.reward);
    applyConsequences(stage.consequences);

    if (stage.endingVariants && quest.selectedPath) {
      const variant = stage.endingVariants[quest.selectedPath];
      if (variant?.text) {
        get().addJournalEntry(variant.text, 'quest');
      }
      if (variant?.reward) {
        applyReward(variant.reward);
      }
    }
  };

  const resolveCurrentStage = (questId: string) => {
    const quest = get().activeQuests.find((q) => q.id === questId);
    if (!quest) return;

    const stage = quest.stages.find((s) => s.id === quest.currentStageId);
    if (!stage) return;

    if (!isStageComplete(stage)) return;

    applyStageOutcome(quest, stage);

    if (stage.isBranching) {
      syncDialogueOverrides();
      return;
    }

    if (stage.isEnding) {
      get().completeQuest(questId, stage.endingType || quest.selectedPath);
      return;
    }

    if (stage.nextStage) {
      get().advanceQuest(questId, stage.nextStage);
      return;
    }

    get().completeQuest(questId, quest.selectedPath);
  };

  const markMatchingObjectives = (
    matcher: (objective: QuestObjective, quest: Quest, stage: QuestStage) => boolean
  ) => {
    const matches: Array<{ questId: string; objectiveId: string }> = [];

    get().activeQuests.forEach((quest) => {
      const stage = quest.stages.find((s) => s.id === quest.currentStageId);
      if (!stage || stage.isBranching) return;

      stage.objectives.forEach((objective) => {
        if (objective.completed) return;
        if (matcher(objective, quest, stage)) {
          matches.push({ questId: quest.id, objectiveId: objective.id });
        }
      });
    });

    matches.forEach(({ questId, objectiveId }) => {
      get().completeObjective(questId, objectiveId);
    });
  };

  return {
    activeQuests: [],
    completedQuests: [],
    completedQuestResolutions: {},
    journal: [],
    worldFlags: {},
    reputation: { ...DEFAULT_REPUTATION },
    talkedToNPCs: [],
    seenTopics: [],
    trackedObjective: null,

    startQuest: (quest) => {
      const { activeQuests, completedQuests, completedQuestResolutions, reputation } = get();
      if (activeQuests.some((active) => active.id === quest.id)) return false;
      if (completedQuests.includes(quest.id)) return false;
      if (completedQuestResolutions[quest.id]) return false;

      if (quest.prerequisites?.length) {
        const unmet = quest.prerequisites.some((id) => !completedQuests.includes(id));
        if (unmet) return false;
      }

      if (quest.prerequisite?.questComplete && !completedQuests.includes(quest.prerequisite.questComplete)) {
        return false;
      }

      if (quest.prerequisite?.reputation) {
        const meetsRep = (Object.entries(quest.prerequisite.reputation) as Array<[ReputationFaction, number]>)
          .every(([faction, minValue]) => (reputation[faction] ?? 0) >= minValue);
        if (!meetsRep) return false;
      }

      if (quest.prerequisite?.completedQuestPaths?.length) {
        const hasRequiredPaths = quest.prerequisite.completedQuestPaths.every((token) => {
          const [questId, resolution] = token.split(':');
          return Boolean(questId && resolution && completedQuestResolutions[questId] === resolution);
        });
        if (!hasRequiredPaths) return false;
      }

      const firstStage = quest.stages[0];
      if (!firstStage) return false;

      const newQuest: Quest = {
        ...quest,
        currentStageId: firstStage.id,
        completed: false,
      };

      set({ activeQuests: [...activeQuests, newQuest] });
      get().addJournalEntry(`New Quest: ${newQuest.name} - ${newQuest.description}`, 'quest');
      if (firstStage.journalEntry) {
        get().addJournalEntry(firstStage.journalEntry, 'quest');
      }
      if (firstStage.warning) {
        get().addJournalEntry(firstStage.warning, 'rumor');
      }

      set((state) => ({
        trackedObjective: state.trackedObjective || getFirstIncompleteObjective([...state.activeQuests]),
      }));

      syncDialogueOverrides();
      resolveCurrentStage(newQuest.id);
      syncTrackedObjective();
      return true;
    },

    advanceQuest: (questId, newStageId) => {
      let didAdvance = false;
      let nextStage: QuestStage | undefined;

      set((state) => ({
        activeQuests: state.activeQuests.map((quest) => {
          if (quest.id !== questId) return quest;

          const currentIdx = quest.stages.findIndex((stage) => stage.id === quest.currentStageId);
          if (currentIdx === -1) return quest;

          const fallbackNext = quest.stages[currentIdx + 1]?.id;
          const targetStageId = newStageId ?? fallbackNext;
          if (!targetStageId) return quest;

          const exists = quest.stages.some((stage) => stage.id === targetStageId);
          if (!exists) return quest;

          didAdvance = true;
          nextStage = quest.stages.find((stage) => stage.id === targetStageId);
          return { ...quest, currentStageId: targetStageId };
        }),
      }));

      if (!didAdvance || !nextStage) return;

      if (nextStage.journalEntry) {
        get().addJournalEntry(nextStage.journalEntry, 'quest');
      }
      if (nextStage.warning) {
        get().addJournalEntry(nextStage.warning, 'rumor');
      }

      syncDialogueOverrides();
      resolveCurrentStage(questId);
      syncTrackedObjective();
    },

    selectQuestPath: (questId, pathId) => {
      const validation = get().canSelectPath(questId, pathId);
      if (!validation.allowed) {
        if (validation.reason) {
          get().addJournalEntry(validation.reason, 'rumor');
        }
        return false;
      }

      const quest = get().activeQuests.find((active) => active.id === questId);
      if (!quest) return false;

      const stage = quest.stages.find((candidate) => candidate.id === quest.currentStageId);
      if (!stage || !stage.isBranching || !stage.availablePaths?.length) return false;

      const path = stage.availablePaths.find((option) => option.id === pathId);
      if (!path) return false;

      set((state) => ({
        activeQuests: state.activeQuests.map((active) =>
          active.id === questId ? { ...active, selectedPath: path.id } : active
        ),
      }));

      get().addJournalEntry(`Path Chosen: ${path.name}`, 'quest');
      get().advanceQuest(questId, path.nextStage);
      syncTrackedObjective();
      return true;
    },

    requestPathSelection: (pathId) => {
      const branchingQuest = get().activeQuests.find((quest) => {
        const stage = quest.stages.find((candidate) => candidate.id === quest.currentStageId);
        return Boolean(stage?.isBranching && stage.availablePaths?.some((option) => option.id === pathId));
      });

      if (!branchingQuest) return false;
      return get().selectQuestPath(branchingQuest.id, pathId);
    },

    canSelectPath: (questId, pathId) => {
      const quest = get().activeQuests.find((active) => active.id === questId);
      if (!quest) return { allowed: false, reason: 'Quest is not active.' };

      const stage = quest.stages.find((candidate) => candidate.id === quest.currentStageId);
      if (!stage || !stage.isBranching || !stage.availablePaths?.length) {
        return { allowed: false, reason: 'No path selection is available right now.' };
      }

      const option = stage.availablePaths.find((candidate) => candidate.id === pathId);
      if (!option) return { allowed: false, reason: 'Selected path was not found.' };

      return checkConditionalRequirements(
        option.requirements,
        get(),
        useInventoryStore.getState(),
        useGameStore.getState()
      );
    },

    completeObjective: (questId, objectiveId) => {
      let didUpdate = false;

      set((state) => ({
        activeQuests: state.activeQuests.map((quest) => {
          if (quest.id !== questId) return quest;

          const stageIndex = quest.stages.findIndex((stage) => stage.id === quest.currentStageId);
          if (stageIndex === -1) return quest;

          const stage = quest.stages[stageIndex];
          const objectives = stage.objectives.map((objective) => {
            if (objective.id !== objectiveId || objective.completed) return objective;
            didUpdate = true;
            return { ...objective, completed: true };
          });

          if (!didUpdate) return quest;

          const stages = quest.stages.map((candidate, idx) =>
            idx === stageIndex ? { ...candidate, objectives } : candidate
          );
          return { ...quest, stages };
        }),
      }));

      if (!didUpdate) return;
      resolveCurrentStage(questId);
      syncDialogueOverrides();
      syncTrackedObjective();
    },

    completeQuest: (questId, resolution) => {
      const { activeQuests, completedQuests } = get();
      const quest = activeQuests.find((active) => active.id === questId);
      if (!quest) return;

      set((state) => {
        const worldFlags = { ...state.worldFlags, [`quest-complete:${questId}`]: true };
        if (resolution) {
          worldFlags[`quest-outcome:${questId}:${resolution}`] = true;
        }

        return {
          activeQuests: activeQuests.filter((active) => active.id !== questId),
          completedQuests: completedQuests.includes(questId)
            ? completedQuests
            : [...completedQuests, questId],
          completedQuestResolutions: resolution
            ? { ...state.completedQuestResolutions, [questId]: resolution }
            : state.completedQuestResolutions,
          worldFlags,
        };
      });

      const resolutionText = resolution ? ` (${resolution})` : '';
      get().addJournalEntry(`Quest Completed: ${quest.name}${resolutionText}`, 'quest');
      syncDialogueOverrides();
      syncTrackedObjective();
    },

    addJournalEntry: (text, category = 'discovery') => {
      const gameTime = useGameStore.getState().time;
      const timestamp = { hour: gameTime.hour, minute: gameTime.minute, day: gameTime.day };
      const timeString = `Day ${timestamp.day}, ${timestamp.hour.toString().padStart(2, '0')}:${timestamp.minute.toString().padStart(2, '0')}`;

      const entry: JournalEntry = {
        id: `journal-${++journalCounter}`,
        text,
        timestamp,
        timeString,
        category,
      };

      set((state) => ({ journal: [...state.journal, entry] }));
    },

    recordTalk: (npcId, topic) => {
      set((state) => ({
        talkedToNPCs: state.talkedToNPCs.includes(npcId) ? state.talkedToNPCs : [...state.talkedToNPCs, npcId],
        seenTopics: state.seenTopics.includes(topic) ? state.seenTopics : [...state.seenTopics, topic],
      }));

      markMatchingObjectives((objective) => {
        if (objective.type !== 'talk') return false;
        if (objective.target && objective.target !== npcId) return false;
        if (objective.topic && objective.topic !== topic) return false;
        return true;
      });
    },

    recordLocation: (locationId) => {
      markMatchingObjectives((objective) => {
        if (!['go', 'explore', 'location'].includes(objective.type)) return false;
        if (objective.target && objective.target !== locationId) return false;
        if (objective.time && useGameStore.getState().time.timeOfDay !== objective.time) return false;
        return true;
      });
    },

    recordObtain: (itemId) => {
      markMatchingObjectives((objective) => {
        if (!['obtain', 'find', 'collect'].includes(objective.type)) return false;
        if (objective.item && objective.item !== itemId) return false;
        if (objective.target && objective.target !== itemId) return false;
        return !objective.item || objective.item === itemId;
      });
    },

    recordGive: (npcId, itemId) => {
      markMatchingObjectives((objective) => {
        if (objective.type !== 'give') return false;
        if (objective.target && objective.target !== npcId) return false;
        if (objective.item && objective.item !== itemId) return false;
        return true;
      });
    },

    recordPay: (npcId, amount) => {
      markMatchingObjectives((objective) => {
        if (objective.type !== 'pay') return false;
        if (objective.target && objective.target !== npcId) return false;
        if (objective.amount && amount < objective.amount) return false;
        return true;
      });
    },

    recordSearch: (target) => {
      markMatchingObjectives((objective) => objective.type === 'search' && (!objective.target || objective.target === target));
    },

    recordStealth: (target) => {
      markMatchingObjectives((objective) => objective.type === 'stealth' && (!objective.target || objective.target === target));
    },

    recordEscort: (target, destination) => {
      markMatchingObjectives((objective) => {
        if (objective.type !== 'escort') return false;
        if (objective.target && objective.target !== target) return false;
        if (objective.destination && destination && objective.destination !== destination) return false;
        return true;
      });
    },

    recordWait: (days = 1) => {
      markMatchingObjectives((objective) => {
        if (objective.type !== 'wait') return false;
        if (objective.days && days < objective.days) return false;
        return true;
      });
    },

    setTrackedObjective: (questId, objectiveId) => {
      const quest = get().activeQuests.find((candidate) => candidate.id === questId);
      if (!quest) return false;
      const stage = quest.stages.find((candidate) => candidate.id === quest.currentStageId);
      if (!stage) return false;
      const objective = stage.objectives.find((candidate) => candidate.id === objectiveId);
      if (!objective || objective.completed) return false;

      set({ trackedObjective: { questId, objectiveId } });
      return true;
    },

    clearTrackedObjective: () => {
      set({ trackedObjective: null });
      syncTrackedObjective();
    },

    hydrateQuests: (
      quests,
      completedQuests,
      journal,
      worldFlags,
      reputation,
      completedQuestResolutions,
      talkedToNPCs,
      seenTopics,
      trackedObjective
    ) => {
      set({
        activeQuests: quests,
        completedQuests,
        journal,
        worldFlags: worldFlags || {},
        reputation: normalizeReputationState(reputation),
        completedQuestResolutions: completedQuestResolutions || {},
        talkedToNPCs: talkedToNPCs || [],
        seenTopics: seenTopics || [],
        trackedObjective: trackedObjective || null,
      });
      syncDialogueOverrides();
      syncTrackedObjective();
    },

    getActiveQuests: () => get().activeQuests,

    getQuestStage: (questId) => {
      const quest = get().activeQuests.find((active) => active.id === questId);
      if (!quest) return null;
      return quest.stages.find((stage) => stage.id === quest.currentStageId) || null;
    },

    getTrackedObjective: () => {
      const { activeQuests, trackedObjective } = get();
      const resolved = resolveTrackedObjective(activeQuests, trackedObjective);
      if (!resolved) return null;

      const quest = activeQuests.find((candidate) => candidate.id === resolved.questId);
      if (!quest) return null;
      const stage = quest.stages.find((candidate) => candidate.id === quest.currentStageId);
      if (!stage) return null;
      const objective = stage.objectives.find((candidate) => candidate.id === resolved.objectiveId);
      if (!objective || objective.completed) return null;

      return {
        questId: quest.id,
        questName: quest.name,
        stageId: stage.id,
        objective,
      };
    },

    getNarrativeCurrents: () => {
      const reputation = get().reputation;
      return (Object.entries(reputation) as Array<[ReputationFaction, number]>)
        .map(([faction, value]) => describeNarrativeCurrent(faction, value))
        .filter((entry): entry is NarrativeCurrent => Boolean(entry))
        .sort((left, right) => {
          const leftStrength = Math.abs(reputation[left.id as ReputationFaction] || 0);
          const rightStrength = Math.abs(reputation[right.id as ReputationFaction] || 0);
          return rightStrength - leftStrength;
        });
    },

    getCompletedQuestResolution: (questId) => get().completedQuestResolutions[questId] || null,

    isQuestActive: (questId) => get().activeQuests.some((active) => active.id === questId),

    isQuestCompleted: (questId) => get().completedQuests.includes(questId),
  };
});
