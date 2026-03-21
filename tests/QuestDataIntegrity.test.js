const fs = require('fs');
const path = require('path');

const QUEST_DIR = path.join(__dirname, '..', 'src', 'data', 'quests');
const NPC_FILE = path.join(__dirname, '..', 'src', 'data', 'npcs.json');
const INVENTORY_FILE = path.join(__dirname, '..', 'src', 'stores', 'inventoryStore.ts');

// Keep in sync with loader quest-support NPCs.
const RUNTIME_SUPPORT_NPCS = new Set(['mak-enang']);

function loadQuestFiles() {
  return fs.readdirSync(QUEST_DIR)
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .map((file) => JSON.parse(fs.readFileSync(path.join(QUEST_DIR, file), 'utf8')));
}

function loadQuestIndex() {
  const indexPath = path.join(QUEST_DIR, 'index.json');
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

function loadNPCIds() {
  const npcs = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8'));
  return new Set([...Object.keys(npcs), ...RUNTIME_SUPPORT_NPCS]);
}

function loadInventoryItemIds() {
  const source = fs.readFileSync(INVENTORY_FILE, 'utf8');
  const ids = new Set();
  const itemIdMatcher = /'([^']+)':\s*\{/g;
  let match;
  while ((match = itemIdMatcher.exec(source)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

function collectQuestPathRequests(node, results = []) {
  if (!node || typeof node !== 'object') {
    return results;
  }

  if (Array.isArray(node)) {
    node.forEach((value) => collectQuestPathRequests(value, results));
    return results;
  }

  if (typeof node.questPath === 'string') {
    results.push({
      questPath: node.questPath,
      questCritical: Boolean(node.questCritical),
      requires: Array.isArray(node.requires) ? node.requires : [],
    });
  }

  Object.values(node).forEach((value) => {
    if (value && typeof value === 'object') {
      collectQuestPathRequests(value, results);
    }
  });

  return results;
}

function validateItemReference(itemId, context, knownItemIds, missing) {
  if (!itemId) return;
  if (!knownItemIds.has(itemId)) {
    missing.push(`${context}: ${itemId}`);
  }
}

function mergeReputation(base, delta = {}) {
  const next = { ...base };
  Object.entries(delta).forEach(([faction, value]) => {
    next[faction] = (next[faction] || 0) + value;
  });
  return next;
}

function collectQuestOutcomes(quest) {
  if (!quest?.stages?.length) return [];

  const stagesById = new Map(quest.stages.map((stage) => [stage.id, stage]));
  const outcomes = [];

  const walk = (stageId, reputation, trail = new Set()) => {
    const stage = stagesById.get(stageId);
    if (!stage) return;

    const visitKey = `${stageId}:${Array.from(trail).join('|')}`;
    if (trail.has(visitKey)) return;

    const nextTrail = new Set(trail);
    nextTrail.add(visitKey);

    const afterReward = mergeReputation(reputation, (stage.reward || {}).reputation);
    const afterConsequences = mergeReputation(afterReward, (stage.consequences || {}).reputation);

    if (stage.isBranching && stage.availablePaths?.length) {
      stage.availablePaths.forEach((path) => {
        walk(path.nextStage, afterConsequences, new Set([...nextTrail, path.id]));
      });
      return;
    }

    if (stage.isEnding || !stage.nextStage) {
      outcomes.push(afterConsequences);
      return;
    }

    walk(stage.nextStage, afterConsequences, nextTrail);
  };

  walk(quest.stages[0].id, {});
  return outcomes;
}

function collectReachableStageIds(quest) {
  const stageById = new Map(quest.stages.map((stage) => [stage.id, stage]));
  const visited = new Set();
  const queue = quest.stages[0] ? [quest.stages[0].id] : [];

  while (queue.length > 0) {
    const stageId = queue.shift();
    if (!stageId || visited.has(stageId)) continue;
    visited.add(stageId);

    const stage = stageById.get(stageId);
    if (!stage) continue;

    if (stage.isBranching && stage.availablePaths?.length) {
      stage.availablePaths.forEach((option) => {
        if (option?.nextStage) {
          queue.push(option.nextStage);
        }
      });
      continue;
    }

    if (stage.nextStage) {
      queue.push(stage.nextStage);
    }
  }

  return visited;
}

describe('Quest Data Integrity', () => {
  test('quest index references existing quest data files', () => {
    const questIndex = loadQuestIndex();
    const quests = loadQuestFiles();
    const availableIds = new Set(quests.map((quest) => quest.id));

    expect(questIndex.quests.length).toBeGreaterThan(0);
    questIndex.quests.forEach((questId) => {
      expect(availableIds.has(questId)).toBe(true);
    });
  });

  test('all talk/objective NPC references exist at runtime', () => {
    const quests = loadQuestFiles();
    const npcIds = loadNPCIds();
    const missingNPCRefs = [];

    quests.forEach((quest) => {
      (quest.stages || []).forEach((stage) => {
        (stage.objectives || []).forEach((objective) => {
          if (objective.type === 'talk' && objective.target && !npcIds.has(objective.target)) {
            missingNPCRefs.push(`${quest.id}:${stage.id}:objective talk target ${objective.target}`);
          }
        });

        const overrides = stage.npcDialogueOverrides || {};
        Object.keys(overrides).forEach((npcId) => {
          if (!npcIds.has(npcId)) {
            missingNPCRefs.push(`${quest.id}:${stage.id}:override npc ${npcId}`);
          }
        });
      });
    });

    expect(missingNPCRefs).toEqual([]);
  });

  test('all quest item references exist in inventory definitions', () => {
    const quests = loadQuestFiles();
    const itemIds = loadInventoryItemIds();
    const missingItems = [];

    quests.forEach((quest) => {
      (quest.stages || []).forEach((stage) => {
        validateItemReference(stage.givesItem, `${quest.id}:${stage.id}:stage.givesItem`, itemIds, missingItems);

        (stage.objectives || []).forEach((objective) => {
          validateItemReference(objective.item, `${quest.id}:${stage.id}:objective.item`, itemIds, missingItems);
        });

        ((stage.reward || {}).items || []).forEach((itemId) => {
          validateItemReference(itemId, `${quest.id}:${stage.id}:reward.items`, itemIds, missingItems);
        });

        const endingVariants = stage.endingVariants || {};
        Object.entries(endingVariants).forEach(([variant, variantData]) => {
          (((variantData || {}).reward || {}).items || []).forEach((itemId) => {
            validateItemReference(
              itemId,
              `${quest.id}:${stage.id}:endingVariant(${variant}).reward.items`,
              itemIds,
              missingItems
            );
          });
        });

        const overrides = stage.npcDialogueOverrides || {};
        Object.entries(overrides).forEach(([npcId, topics]) => {
          Object.entries(topics || {}).forEach(([topicKey, topicData]) => {
            validateItemReference(
              topicData.givesItem,
              `${quest.id}:${stage.id}:override ${npcId}.${topicKey}.givesItem`,
              itemIds,
              missingItems
            );
            validateItemReference(
              topicData.takesItem,
              `${quest.id}:${stage.id}:override ${npcId}.${topicKey}.takesItem`,
              itemIds,
              missingItems
            );
          });
        });
      });
    });

    expect(missingItems).toEqual([]);
  });

  test('quest trigger pairs are unique per giver/topic', () => {
    const quests = loadQuestFiles();
    const pairs = new Set();

    quests.forEach((quest) => {
      const giverId = quest.giver || quest.questGiver;
      const triggerTopic = quest.triggerTopic;
      if (!giverId || !triggerTopic) return;

      const key = `${giverId}:${triggerTopic}`;
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    });
  });

  test('quest prerequisite reputation gates are reachable from prerequisite quest outcomes', () => {
    const quests = loadQuestFiles();
    const questById = new Map(quests.map((quest) => [quest.id, quest]));
    const unreachable = [];

    quests.forEach((quest) => {
      const prerequisite = quest.prerequisite;
      if (!prerequisite?.questComplete || !prerequisite.reputation) return;

      const prerequisiteQuest = questById.get(prerequisite.questComplete);
      const outcomes = collectQuestOutcomes(prerequisiteQuest);
      const isReachable = outcomes.some((outcome) =>
        Object.entries(prerequisite.reputation).every(([faction, minValue]) => (outcome[faction] || 0) >= minValue)
      );

      if (!isReachable) {
        unreachable.push(`${quest.id}: unreachable gate from ${prerequisite.questComplete}`);
      }
    });

    expect(unreachable).toEqual([]);
  });

  test('every quest stage is reachable from the quest start', () => {
    const quests = loadQuestFiles();
    const unreachable = [];

    quests.forEach((quest) => {
      const reachable = collectReachableStageIds(quest);
      const missing = (quest.stages || [])
        .map((stage) => stage.id)
        .filter((stageId) => !reachable.has(stageId));

      if (missing.length > 0) {
        unreachable.push(`${quest.id}: ${missing.join(', ')}`);
      }
    });

    expect(unreachable).toEqual([]);
  });

  test('branching quest paths resolve to authored stages and avoid dead ends', () => {
    const quests = loadQuestFiles();
    const brokenBranches = [];

    quests.forEach((quest) => {
      const stageById = new Map(quest.stages.map((stage) => [stage.id, stage]));

      quest.stages.forEach((stage) => {
        if (stage.isBranching && stage.availablePaths?.length) {
          stage.availablePaths.forEach((option) => {
            const targetStage = stageById.get(option.nextStage);
            if (!targetStage) {
              brokenBranches.push(`${quest.id}:${stage.id}:${option.id} targets missing stage ${option.nextStage}`);
              return;
            }

            if (
              !targetStage.isBranching
              && !targetStage.isEnding
              && !targetStage.nextStage
              && (!targetStage.objectives || targetStage.objectives.length === 0)
            ) {
              brokenBranches.push(`${quest.id}:${stage.id}:${option.id} lands on dead-end stage ${targetStage.id}`);
            }
          });
        }
      });
    });

    expect(brokenBranches).toEqual([]);
  });

  test('customs-ledger keeps four authored, gated resolutions', () => {
    const quests = loadQuestFiles();
    const customsLedger = quests.find((quest) => quest.id === 'customs-ledger');

    expect(customsLedger).toBeTruthy();

    const stageById = new Map((customsLedger.stages || []).map((stage) => [stage.id, stage]));
    const choiceStage = stageById.get('choose-path');

    expect(choiceStage?.isBranching).toBe(true);
    expect(choiceStage?.availablePaths).toHaveLength(4);

    (choiceStage.availablePaths || []).forEach((path) => {
      expect(Array.isArray(path.requirements?.talkedTo)).toBe(true);
      expect(path.requirements?.talkedTo?.length || 0).toBeGreaterThanOrEqual(2);
      if (path.id !== 'ledger-trail') {
        expect(Array.isArray(path.requirements?.worldFlagsAny)).toBe(true);
        expect(path.requirements?.worldFlagsAny?.length || 0).toBeGreaterThan(0);
      }
      expect(stageById.has(path.nextStage)).toBe(true);
      expect(stageById.get(path.nextStage)?.isEnding).toBe(true);
    });
  });

  test('customs-spine witness NPCs have live dialogue payloads, not null placeholders', () => {
    const npcs = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8'));
    const customsWitnesses = ['gaspar-mesquita', 'diogo-almeida', 'lin-mei', 'pak-salleh'];

    customsWitnesses.forEach((npcId) => {
      const npc = npcs[npcId];
      expect(npc).toBeTruthy();
      expect(npc.dialogue).toBeTruthy();
      expect(typeof npc.dialogue.greeting).toBe('string');
      expect(Object.keys(npc.dialogue.topics || {}).length).toBeGreaterThan(0);
    });
  });

  test('dialogue-driven quest paths are gated and point at real branch ids', () => {
    const quests = loadQuestFiles();
    const npcData = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8'));
    const availablePathIds = new Set();

    quests.forEach((quest) => {
      (quest.stages || []).forEach((stage) => {
        (stage.availablePaths || []).forEach((option) => {
          availablePathIds.add(option.id);
        });
      });
    });

    const requests = collectQuestPathRequests(npcData);
    const missingPathIds = [];
    const ungatedRequests = [];

    requests.forEach((request) => {
      if (!availablePathIds.has(request.questPath)) {
        missingPathIds.push(request.questPath);
      }

      if (!request.questCritical && (!request.requires || request.requires.length === 0)) {
        ungatedRequests.push(request.questPath);
      }
    });

    expect(missingPathIds).toEqual([]);
    expect(ungatedRequests).toEqual([]);
  });
});
