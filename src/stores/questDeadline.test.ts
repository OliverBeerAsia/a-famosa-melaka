/**
 * Day-window gating and the silk-consignment deadline.
 *
 * Chen Wei's silk sails for Canton on day 4. After that the customs favour is
 * worth nothing to him, so the diplomatic route to the seal must close on its
 * own, be narrated once, and never re-narrate.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { useGameStore, DEFAULT_TIME_STATE } from './gameStore';
import { useInventoryStore } from './inventoryStore';
import { useDialogueStore } from './dialogueStore';
import {
  useQuestStore,
  meetsDayRequirement,
  SILK_CONSIGNMENT_SHIP_DAY,
  type Quest,
} from './questStore';

function setDay(day: number) {
  useGameStore.getState().updateTime({ ...DEFAULT_TIME_STATE, day });
}

function resetStores() {
  setDay(1);
  useInventoryStore.getState().clear();
  useQuestStore.getState().hydrateQuests([], [], [], {}, undefined, {}, [], [], null);
}

/** Minimal branching quest whose only path expires with the silk. */
function deadlineQuest(): Quest {
  return {
    id: 'merchants-seal',
    name: 'The Merchant’s Seal',
    description: 'test fixture',
    currentStageId: 'choose-path',
    completed: false,
    stages: [
      {
        id: 'choose-path',
        description: 'Decide how to recover the seal.',
        isBranching: true,
        objectives: [],
        availablePaths: [
          {
            id: 'diplomatic',
            name: 'Diplomatic Solution',
            requirements: { dayBefore: SILK_CONSIGNMENT_SHIP_DAY },
            nextStage: 'done',
          },
          {
            id: 'payment',
            name: 'Pay the Debt',
            nextStage: 'done',
          },
        ],
      },
      {
        id: 'done',
        description: 'Resolved.',
        objectives: [],
        isEnding: true,
      },
    ],
  };
}

describe('meetsDayRequirement', () => {
  test('passes when nothing is required', () => {
    expect(meetsDayRequirement(9)).toBe(true);
    expect(meetsDayRequirement(9, {})).toBe(true);
  });

  test('dayBefore is exclusive - live up to the day before, dead on the day', () => {
    expect(meetsDayRequirement(1, { dayBefore: 4 })).toBe(true);
    expect(meetsDayRequirement(3, { dayBefore: 4 })).toBe(true);
    expect(meetsDayRequirement(4, { dayBefore: 4 })).toBe(false);
    expect(meetsDayRequirement(12, { dayBefore: 4 })).toBe(false);
  });

  test('dayAtLeast is inclusive', () => {
    expect(meetsDayRequirement(2, { dayAtLeast: 3 })).toBe(false);
    expect(meetsDayRequirement(3, { dayAtLeast: 3 })).toBe(true);
  });

  test('both bounds compose into a window', () => {
    const window = { dayAtLeast: 2, dayBefore: 4 };
    expect([1, 2, 3, 4, 5].map((day) => meetsDayRequirement(day, window)))
      .toEqual([false, true, true, false, false]);
  });
});

describe('quest path day gating', () => {
  beforeEach(resetStores);

  test('the diplomatic path is selectable before the junk sails', () => {
    useQuestStore.getState().startQuest(deadlineQuest());
    setDay(3);

    expect(useQuestStore.getState().canSelectPath('merchants-seal', 'diplomatic').allowed).toBe(true);
  });

  test('the diplomatic path is refused once the junk has sailed', () => {
    useQuestStore.getState().startQuest(deadlineQuest());
    setDay(SILK_CONSIGNMENT_SHIP_DAY);

    const validation = useQuestStore.getState().canSelectPath('merchants-seal', 'diplomatic');
    expect(validation.allowed).toBe(false);
    expect(validation.reason).toMatch(/sailed/i);
  });

  test('the payment path never expires, so the quest cannot softlock', () => {
    useQuestStore.getState().startQuest(deadlineQuest());
    setDay(SILK_CONSIGNMENT_SHIP_DAY + 6);

    expect(useQuestStore.getState().canSelectPath('merchants-seal', 'payment').allowed).toBe(true);
  });

  test('selecting an expired path is rejected and leaves the quest unbranched', () => {
    useQuestStore.getState().startQuest(deadlineQuest());
    setDay(SILK_CONSIGNMENT_SHIP_DAY);

    expect(useQuestStore.getState().selectQuestPath('merchants-seal', 'diplomatic')).toBe(false);
    const quest = useQuestStore.getState().activeQuests.find((entry) => entry.id === 'merchants-seal');
    expect(quest?.selectedPath).toBeUndefined();
    expect(quest?.currentStageId).toBe('choose-path');
  });
});

describe('silk consignment world events', () => {
  beforeEach(resetStores);

  const journalTexts = () => useQuestStore.getState().journal.map((entry) => entry.text);

  test('day 3 warns once that the junk clears on the fourth day', () => {
    useQuestStore.getState().startQuest(deadlineQuest());
    setDay(SILK_CONSIGNMENT_SHIP_DAY - 1);

    useQuestStore.getState().recordWait(1);
    useQuestStore.getState().recordWait(1);

    const warnings = journalTexts().filter((text) => text.includes('clears for Canton'));
    expect(warnings).toHaveLength(1);
    expect(useQuestStore.getState().worldFlags['silk-consignment-warned']).toBe(true);
  });

  test('day 4 closes the route, sets the flag, and narrates it once', () => {
    useQuestStore.getState().startQuest(deadlineQuest());
    setDay(SILK_CONSIGNMENT_SHIP_DAY);

    useQuestStore.getState().recordWait(1);
    useQuestStore.getState().recordWait(1);

    expect(useQuestStore.getState().worldFlags['silk-consignment-shipped']).toBe(true);
    const closures = journalTexts().filter((text) => text.includes('The Canton junk sailed'));
    expect(closures).toHaveLength(1);
  });

  test('a player who already freed the silk gets the good version of the news', () => {
    useQuestStore.getState().startQuest(deadlineQuest());
    useQuestStore.setState({ worldFlags: { ...useQuestStore.getState().worldFlags, 'inspector-removed': true } });
    setDay(SILK_CONSIGNMENT_SHIP_DAY);

    useQuestStore.getState().recordWait(1);

    expect(journalTexts().some((text) => text.includes('released and taxed in order'))).toBe(true);
    expect(journalTexts().some((text) => text.includes('did not sail with her'))).toBe(false);
  });

  test('nothing is narrated when the seal quest is not in play', () => {
    setDay(SILK_CONSIGNMENT_SHIP_DAY);
    useQuestStore.getState().recordWait(1);

    expect(useQuestStore.getState().journal).toHaveLength(0);
    expect(useQuestStore.getState().worldFlags['silk-consignment-shipped']).toBeUndefined();
  });
});

describe('dialogue topics honour the day window', () => {
  beforeEach(() => {
    resetStores();
    useDialogueStore.setState({ unlockedTopics: {}, dialogueOverrides: {} });
    useDialogueStore.getState().setNPCData({
      'chen-wei': {
        id: 'chen-wei',
        name: 'Chen Wei',
        dialogue: {
          greeting: 'Welcome to the counting house.',
          topics: {
            trade: { text: 'Silk, porcelain, tea.' },
            'side-deal': { text: 'Honor for honor.', availability: { dayBefore: SILK_CONSIGNMENT_SHIP_DAY } },
          },
        },
      },
    });
  });

  test('the expiring topic is offered before the deadline', () => {
    setDay(2);
    useDialogueStore.getState().startDialogue('chen-wei');
    expect(useDialogueStore.getState().availableTopics).toContain('side-deal');
  });

  test('the expiring topic is gone after the deadline', () => {
    setDay(SILK_CONSIGNMENT_SHIP_DAY);
    useDialogueStore.getState().startDialogue('chen-wei');
    expect(useDialogueStore.getState().availableTopics).not.toContain('side-deal');
    expect(useDialogueStore.getState().availableTopics).toContain('trade');
  });
});
