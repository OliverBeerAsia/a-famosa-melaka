/**
 * Conditional requirement evaluation.
 *
 * A `ConditionalRequirements` block gates an exit, a dialogue branch or a quest
 * hotspot on the state of the world: money, items, who you have talked to, what
 * you have heard, the hour, your standing with each faction, and the world
 * flags the quest system sets.
 *
 * Every clause is an AND, and every clause is a veto — the block passes only if
 * nothing in it fails. Pulled out of the scene because both TransitionSystem
 * and QuestTriggerSystem ask the same question.
 */

import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useQuestStore, type ConditionalRequirements, type ReputationFaction } from '../../stores/questStore';

/**
 * Does the current world state satisfy `requirements`?
 * An absent block is vacuously true.
 */
export function meetsConditionalRequirements(
  requirements: ConditionalRequirements | undefined,
  locationId: string,
): boolean {
  if (!requirements) return true;

  const questState = useQuestStore.getState();
  const inventoryState = useInventoryStore.getState();
  const gameState = useGameStore.getState();

  if (requirements.money && inventoryState.money < requirements.money) return false;
  if (requirements.itemsAll?.length && !requirements.itemsAll.every((itemId) => inventoryState.hasItem(itemId))) {
    return false;
  }
  if (requirements.talkedTo?.length && !requirements.talkedTo.every((npcId) => questState.talkedToNPCs.includes(npcId))) {
    return false;
  }
  if (requirements.topic && !questState.seenTopics.includes(requirements.topic)) return false;
  if (requirements.time && gameState.time.timeOfDay !== requirements.time) return false;
  if (requirements.location && locationId !== requirements.location) return false;

  if (requirements.reputation) {
    const meetsRep = (Object.entries(requirements.reputation) as Array<[ReputationFaction, number]>)
      .every(([faction, minValue]) => (questState.reputation[faction] ?? 0) >= minValue);
    if (!meetsRep) return false;
  }

  if (requirements.maxReputation) {
    const underRep = (Object.entries(requirements.maxReputation) as Array<[ReputationFaction, number]>)
      .every(([faction, maxValue]) => (questState.reputation[faction] ?? 0) <= maxValue);
    if (!underRep) return false;
  }

  if (requirements.worldFlagsAll?.length && !requirements.worldFlagsAll.every((flag) => Boolean(questState.worldFlags[flag]))) {
    return false;
  }
  if (requirements.worldFlagsAny?.length && !requirements.worldFlagsAny.some((flag) => Boolean(questState.worldFlags[flag]))) {
    return false;
  }
  if (requirements.worldFlagsNone?.length && requirements.worldFlagsNone.some((flag) => Boolean(questState.worldFlags[flag]))) {
    return false;
  }
  if (requirements.completedQuests?.length && !requirements.completedQuests.every((questId) => questState.completedQuests.includes(questId))) {
    return false;
  }
  if (requirements.completedQuestPaths?.length) {
    const hasPaths = requirements.completedQuestPaths.every((token) => {
      const [questId, resolution] = token.split(':');
      return Boolean(questId && resolution && questState.getCompletedQuestResolution(questId) === resolution);
    });
    if (!hasPaths) return false;
  }

  return true;
}
