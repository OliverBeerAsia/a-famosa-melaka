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

export type ReputationFaction = 'portuguese' | 'chinese' | 'malay' | 'arab';

export interface ReputationState {
  portuguese: number;
  chinese: number;
  malay: number;
  arab: number;
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

interface PathValidation {
  allowed: boolean;
  reason?: string;
}

const DEFAULT_REPUTATION: ReputationState = {
  portuguese: 0,
  chinese: 0,
  malay: 0,
  arab: 0,
};

export interface QuestState {
  activeQuests: Quest[];
  completedQuests: string[];
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
    talkedToNPCs?: string[],
    seenTopics?: string[],
    trackedObjective?: TrackedObjectiveRef | null
  ) => void;

  getActiveQuests: () => Quest[];
  getQuestStage: (questId: string) => QuestStage | null;
  getTrackedObjective: () => TrackedObjectiveData | null;
  isQuestActive: (questId: string) => boolean;
  isQuestCompleted: (questId: string) => boolean;
}

let journalCounter = 0;

function clampReputation(value: number): number {
  return Math.max(-100, Math.min(100, value));
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
    journal: [],
    worldFlags: {},
    reputation: { ...DEFAULT_REPUTATION },
    talkedToNPCs: [],
    seenTopics: [],
    trackedObjective: null,

    startQuest: (quest) => {
      const { activeQuests, completedQuests, reputation } = get();
      if (activeQuests.some((active) => active.id === quest.id)) return false;
      if (completedQuests.includes(quest.id)) return false;

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

      const requirements = option.requirements;
      if (!requirements) return { allowed: true };

      if (requirements.money && useInventoryStore.getState().money < requirements.money) {
        return { allowed: false, reason: `Requires ${requirements.money} cruzados.` };
      }

      if (requirements.talkedTo?.length) {
        const hasTalkedToAll = requirements.talkedTo.every((npcId) => get().talkedToNPCs.includes(npcId));
        if (!hasTalkedToAll) {
          return { allowed: false, reason: 'You need to gather more testimony before choosing this path.' };
        }
      }

      if (requirements.topic && !get().seenTopics.includes(requirements.topic)) {
        return { allowed: false, reason: `You must discuss topic "${requirements.topic}" first.` };
      }

      if (requirements.time && useGameStore.getState().time.timeOfDay !== requirements.time) {
        return { allowed: false, reason: `This path is only available during ${requirements.time}.` };
      }

      return { allowed: true };
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

      set({
        activeQuests: activeQuests.filter((active) => active.id !== questId),
        completedQuests: completedQuests.includes(questId)
          ? completedQuests
          : [...completedQuests, questId],
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
      talkedToNPCs,
      seenTopics,
      trackedObjective
    ) => {
      set({
        activeQuests: quests,
        completedQuests,
        journal,
        worldFlags: worldFlags || {},
        reputation: reputation || { ...DEFAULT_REPUTATION },
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

    isQuestActive: (questId) => get().activeQuests.some((active) => active.id === questId),

    isQuestCompleted: (questId) => get().completedQuests.includes(questId),
  };
});
