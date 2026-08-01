/**
 * Dialogue-driven trade: money paid TO the player, goods handed over, and the
 * journal breadcrumbs that narrate the money trail.
 *
 * The load-bearing rule is that a payout or a breadcrumb fires exactly once,
 * no matter how many times a player re-reads the topic.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { onGameEvent } from '../phaser/eventBridge';
import { useGameStore, DEFAULT_TIME_STATE } from './gameStore';
import { useInventoryStore } from './inventoryStore';
import { useDialogueStore, type NPCData } from './dialogueStore';
import { useQuestStore } from './questStore';

const TRADER: Record<string, NPCData> = {
  trader: {
    id: 'trader',
    name: 'Test Trader',
    dialogue: {
      greeting: 'Speak plainly.',
      topics: {
        commission: {
          text: 'Forty cruzados, paid at the signing.',
          givesMoney: 40,
          journalEntry: 'Took a tally contract for 40 cruzados.',
        },
        'buy-lot': {
          text: 'Twenty, and it is yours.',
          takesMoney: 20,
          givesItem: 'pepper-pouch',
        },
        'sell-lot': {
          text: 'Fifty-five. You do not bargain well.',
          takesItem: 'pepper-pouch',
          givesMoney: 55,
          journalEntry: 'Sold the pepper for 55 cruzados.',
          journalCategory: 'quest',
        },
      },
    },
  },
};

function resetStores() {
  useGameStore.getState().updateTime({ ...DEFAULT_TIME_STATE });
  useInventoryStore.getState().clear();
  useQuestStore.getState().hydrateQuests([], [], [], {}, undefined, {}, [], [], null);
  useDialogueStore.setState({ unlockedTopics: {}, dialogueOverrides: {} });
  useDialogueStore.getState().setNPCData(TRADER);
  useDialogueStore.getState().startDialogue('trader');
}

/**
 * `givesItem` hands the item over through the 'item:pickup' event, which App
 * binds to the inventory at runtime. Stand that binding up so these tests
 * exercise the same path the game does.
 */
let unbindPickup: (() => void) | null = null;

describe('dialogue payouts', () => {
  beforeEach(() => {
    resetStores();
    unbindPickup = onGameEvent('item:pickup', (itemId) => {
      useInventoryStore.getState().addItem(itemId);
      useQuestStore.getState().recordObtain(itemId);
    });
  });

  afterEach(() => {
    unbindPickup?.();
    unbindPickup = null;
  });

  test('a commission credits the purse and writes one journal breadcrumb', () => {
    useDialogueStore.getState().selectTopic('commission');

    expect(useInventoryStore.getState().money).toBe(40);
    expect(useQuestStore.getState().journal.map((entry) => entry.text))
      .toContain('Took a tally contract for 40 cruzados.');
  });

  test('re-reading a paid topic does not pay again', () => {
    useDialogueStore.getState().selectTopic('commission');
    useDialogueStore.getState().selectTopic('commission');
    useDialogueStore.getState().selectTopic('commission');

    expect(useInventoryStore.getState().money).toBe(40);
    const breadcrumbs = useQuestStore.getState().journal
      .filter((entry) => entry.text.includes('tally contract'));
    expect(breadcrumbs).toHaveLength(1);
  });

  test('journal breadcrumbs use the authored category, defaulting to quest', () => {
    useDialogueStore.getState().selectTopic('commission');
    const entry = useQuestStore.getState().journal
      .find((candidate) => candidate.text.includes('tally contract'));
    expect(entry?.category).toBe('quest');
  });

  test('a full buy-low/sell-high flip nets the authored margin', () => {
    useDialogueStore.getState().selectTopic('commission');
    useDialogueStore.getState().selectTopic('buy-lot');

    expect(useInventoryStore.getState().money).toBe(20);
    expect(useInventoryStore.getState().hasItem('pepper-pouch')).toBe(true);

    useDialogueStore.getState().selectTopic('sell-lot');

    expect(useInventoryStore.getState().money).toBe(75);
    expect(useInventoryStore.getState().hasItem('pepper-pouch')).toBe(false);
  });

  test('a sale cannot be repeated once the goods are gone', () => {
    useDialogueStore.getState().selectTopic('commission');
    useDialogueStore.getState().selectTopic('buy-lot');
    useDialogueStore.getState().selectTopic('sell-lot');
    useDialogueStore.getState().selectTopic('sell-lot');

    expect(useInventoryStore.getState().money).toBe(75);
  });

  test('a purchase the player cannot afford takes nothing and gives nothing', () => {
    useDialogueStore.getState().selectTopic('buy-lot');

    expect(useInventoryStore.getState().money).toBe(0);
    expect(useInventoryStore.getState().hasItem('pepper-pouch')).toBe(false);
    expect(useDialogueStore.getState().currentText).toMatch(/not have enough cruzados/i);
  });
});

describe('authored money trail', () => {
  test('the shipped topics that pay out are the ones the journal describes', async () => {
    const npcs = (await import('../data/npcs.json')).default as Record<string, any>;
    const payouts: Array<[string, string, number]> = [];

    Object.entries(npcs).forEach(([npcId, npc]) => {
      Object.entries(npc.dialogue?.topics || {}).forEach(([topicKey, topic]: [string, any]) => {
        if (topic.givesMoney) payouts.push([npcId, topicKey, topic.givesMoney]);
      });
    });

    // Every coin the player is handed must be narrated somewhere in the
    // journal, or the money trail becomes invisible bookkeeping.
    payouts.forEach(([npcId, topicKey]) => {
      expect(npcs[npcId].dialogue.topics[topicKey].journalEntry, `${npcId}.${topicKey}`).toBeTruthy();
    });

    expect(payouts.length).toBeGreaterThanOrEqual(3);
  });
});
