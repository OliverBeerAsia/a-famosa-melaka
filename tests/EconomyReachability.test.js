/**
 * Economy + content-depth integrity.
 *
 * The "pay the debt" resolution of The Merchant's Seal asks for 500 cruzados
 * from a player who starts with none. These tests prove from the authored data
 * alone that the money is actually raisable, that the topic graph carrying it
 * is sound, that payouts cannot silently double-fire, that the day-4 silk
 * deadline is gated in the data, and that the four locations this pass owns
 * carry enough examinable prose to be worth walking around in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

const NPC_FILE = path.join(SRC, 'data', 'npcs.json');
const INVENTORY_FILE = path.join(SRC, 'stores', 'inventoryStore.ts');
const LOCATION_DIR = path.join(SRC, 'data', 'locations');
const MERCHANTS_SEAL = path.join(SRC, 'data', 'quests', 'merchants-seal.json');

/** The debt the payment path asks for. */
const DEBT_CRUZADOS = 500;
/** Locations this content pass owns (rua-direita is owned by the art stage). */
const OWNED_LOCATIONS = ['a-famosa-gate', 'waterfront', 'kampung', 'st-pauls-church'];

const npcs = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8'));
const merchantsSeal = JSON.parse(fs.readFileSync(MERCHANTS_SEAL, 'utf8'));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadLocation(id) {
  return readJson(path.join(LOCATION_DIR, `${id}.location.json`));
}

function loadAllLocations() {
  return fs.readdirSync(LOCATION_DIR)
    .filter((file) => file.endsWith('.location.json'))
    .map((file) => ({ id: file.replace('.location.json', ''), data: readJson(path.join(LOCATION_DIR, file)) }));
}

/** Item id -> declared cruzado value, scraped from ITEM_DEFINITIONS. */
function loadItemValues() {
  const source = fs.readFileSync(INVENTORY_FILE, 'utf8');
  const values = new Map();
  const blockMatcher = /'([a-z0-9-]+)':\s*\{([\s\S]*?)\n {2}\}/g;
  let match;
  while ((match = blockMatcher.exec(source)) !== null) {
    const valueMatch = /\bvalue:\s*(\d+)/.exec(match[2]);
    values.set(match[1], valueMatch ? Number(valueMatch[1]) : 0);
  }
  return values;
}

function eachTopic(callback) {
  Object.entries(npcs).forEach(([npcId, npc]) => {
    Object.entries(npc.dialogue?.topics || {}).forEach(([topicKey, topic]) => {
      callback(npcId, topicKey, topic);
    });
  });
}

/**
 * Walk the authored dialogue economy to a fixed point, starting from an empty
 * purse, and return the most coin a player could be holding.
 *
 * A topic is takeable when its intra-NPC `requires` chain has been walked, its
 * `availability` money/item conditions hold, and the player can actually
 * afford whatever it takes. Reputation gates are asserted separately (see the
 * quest-consequence test below) because reputation comes from quest stages,
 * not from dialogue.
 */
function simulateEconomy() {
  const itemValues = loadItemValues();
  let money = 0;
  const items = new Set();
  const visited = new Set();
  const trail = [];

  // World pickups: every coin pouch lying in a location is free money.
  loadAllLocations().forEach(({ id, data }) => {
    (data.items || []).forEach((entry) => {
      const value = itemValues.get(entry.itemId) || 0;
      if (entry.itemId === 'coin-pouch' && value > 0) {
        money += value;
        trail.push({ source: `${id}:${entry.id}`, delta: value });
      } else {
        items.add(entry.itemId);
      }
    });
  });

  let changed = true;
  while (changed) {
    changed = false;
    eachTopic((npcId, topicKey, topic) => {
      const id = `${npcId}.${topicKey}`;
      if (visited.has(id)) return;

      const requires = topic.requires || [];
      if (!requires.every((req) => visited.has(`${npcId}.${req}`))) return;

      const availability = topic.availability || {};
      if (availability.money && money < availability.money) return;
      if ((availability.itemsAll || []).some((itemId) => !items.has(itemId))) return;
      if (topic.takesItem && !items.has(topic.takesItem)) return;
      if (topic.takesMoney && money < topic.takesMoney) return;

      visited.add(id);
      changed = true;

      const delta = (topic.givesMoney || 0) - (topic.takesMoney || 0);
      if (topic.takesItem) items.delete(topic.takesItem);
      if (topic.givesItem) items.add(topic.givesItem);
      if (delta !== 0) {
        money += delta;
        trail.push({ source: id, delta });
      }
    });
  }

  return { money, trail };
}

describe('Economy reachability', () => {
  test('the 500-cruzado debt is raisable from an empty purse through authored play', () => {
    const { money, trail } = simulateEconomy();
    const ledger = trail.map((entry) => `${entry.source}: ${entry.delta > 0 ? '+' : ''}${entry.delta}`).join('\n');

    expect(money, `money trail:\n${ledger}`).toBeGreaterThanOrEqual(DEBT_CRUZADOS);
  });

  test('the debt is not raisable from the counting-house advance alone', () => {
    // The advance is meant to close a gap the player has already mostly
    // closed, not to be the whole answer. If this ever inverts, the errands
    // stop mattering.
    const advance = npcs['chen-wei'].dialogue.topics['seal-advance'];
    expect(advance.givesMoney).toBeGreaterThan(0);
    expect(advance.givesMoney).toBeLessThan(DEBT_CRUZADOS);
    expect(advance.availability.money).toBeGreaterThan(0);
  });

  test('every payout topic is gated so it cannot be farmed', () => {
    const problems = [];
    eachTopic((npcId, topicKey, topic) => {
      if (!topic.givesMoney) return;
      const gatedByGoods = Boolean(topic.takesItem);
      const gatedByChain = (topic.requires || []).length > 0;
      if (!gatedByGoods && !gatedByChain) {
        problems.push(`${npcId}.${topicKey} pays out with no goods taken and no requires chain`);
      }
    });
    expect(problems).toEqual([]);
  });

  test('payout and journal topic keys are globally unique', () => {
    // dialogueStore latches first-selection payouts on questStore.seenTopics,
    // which is keyed by topic id alone across all NPCs. A duplicate key would
    // silently swallow the second NPC's payout or breadcrumb.
    const owners = new Map();
    const collisions = [];
    eachTopic((npcId, topicKey, topic) => {
      if (!topic.givesMoney && !topic.journalEntry) return;
      if (owners.has(topicKey)) {
        collisions.push(`${topicKey}: ${owners.get(topicKey)} and ${npcId}`);
      }
      owners.set(topicKey, npcId);
    });
    expect(collisions).toEqual([]);
  });

  test('goods bought or handed over in dialogue can actually be obtained', () => {
    const sources = new Set();
    loadAllLocations().forEach(({ data }) => (data.items || []).forEach((entry) => sources.add(entry.itemId)));
    eachTopic((_npcId, _topicKey, topic) => {
      if (topic.givesItem) sources.add(topic.givesItem);
    });

    const orphans = [];
    eachTopic((npcId, topicKey, topic) => {
      if (topic.takesItem && !sources.has(topic.takesItem)) {
        orphans.push(`${npcId}.${topicKey} takes unobtainable ${topic.takesItem}`);
      }
    });
    expect(orphans).toEqual([]);
  });

  test('every traded item is defined in ITEM_DEFINITIONS', () => {
    const known = loadItemValues();
    const missing = [];
    eachTopic((npcId, topicKey, topic) => {
      [topic.givesItem, topic.takesItem].filter(Boolean).forEach((itemId) => {
        if (!known.has(itemId)) missing.push(`${npcId}.${topicKey}: ${itemId}`);
      });
    });
    expect(missing).toEqual([]);
  });

  test('the counting-house advance is gated on reputation the quest actually grants', () => {
    const gate = npcs['chen-wei'].dialogue.topics['seal-advance'].availability.reputation;
    expect(gate).toBeTruthy();

    // Reputation earned on the linear stages before the branch point.
    const earned = {};
    for (const stage of merchantsSeal.stages) {
      Object.entries(stage.consequences?.reputation || {}).forEach(([faction, value]) => {
        earned[faction] = (earned[faction] || 0) + value;
      });
      if (stage.nextStage === 'choose-path') break;
    }

    Object.entries(gate).forEach(([faction, required]) => {
      expect(earned[faction] || 0).toBeGreaterThanOrEqual(required);
    });
  });
});

describe('Dialogue topic graph', () => {
  test('every requires/unlocks target exists on the same NPC', () => {
    const broken = [];
    Object.entries(npcs).forEach(([npcId, npc]) => {
      const topics = npc.dialogue?.topics || {};
      Object.entries(topics).forEach(([topicKey, topic]) => {
        [...(topic.requires || []), ...(topic.unlocks || [])].forEach((target) => {
          if (!topics[target]) broken.push(`${npcId}.${topicKey} -> ${target}`);
        });
      });
    });
    expect(broken).toEqual([]);
  });

  test('no topic requires itself, directly or in a cycle', () => {
    const cyclic = [];
    Object.entries(npcs).forEach(([npcId, npc]) => {
      const topics = npc.dialogue?.topics || {};
      const resolving = new Set();
      const resolved = new Set();

      const walk = (key, stack) => {
        if (resolved.has(key)) return;
        if (resolving.has(key)) {
          cyclic.push(`${npcId}: ${[...stack, key].join(' -> ')}`);
          return;
        }
        resolving.add(key);
        (topics[key]?.requires || []).forEach((req) => {
          if (topics[req]) walk(req, [...stack, key]);
        });
        resolving.delete(key);
        resolved.add(key);
      };

      Object.keys(topics).forEach((key) => walk(key, []));
    });
    expect(cyclic).toEqual([]);
  });

  test('every greeting variant carries a condition and text', () => {
    const problems = [];
    Object.entries(npcs).forEach(([npcId, npc]) => {
      (npc.dialogue?.greetingVariants || []).forEach((variant, i) => {
        if (!variant.text) problems.push(`${npcId}.greetingVariants[${i}]: no text`);
        if (!variant.when || Object.keys(variant.when).length === 0) {
          problems.push(`${npcId}.greetingVariants[${i}]: no condition (would mask the base greeting)`);
        }
      });
    });
    expect(problems).toEqual([]);
  });

  test('the six principal NPCs react to how the seal was resolved', () => {
    const principals = ['fernao-gomes', 'capitao-rodrigues', 'padre-tomas', 'aminah', 'chen-wei', 'rashid'];
    principals.forEach((npcId) => {
      const npc = npcs[npcId];
      expect(npc, npcId).toBeTruthy();
      expect((npc.dialogue.greetingVariants || []).length, `${npcId} greetingVariants`).toBeGreaterThanOrEqual(3);

      const postQuest = Object.values(npc.dialogue.topics).filter((topic) => {
        const availability = topic.availability || {};
        return (availability.completedQuests || []).includes('merchants-seal')
          || (availability.worldFlagsAny || []).some((flag) =>
            ['merchant-seal-settled', 'gomes-chen-partnership', 'inspector-removed', 'seal-stolen'].includes(flag));
      });
      expect(postQuest.length, `${npcId} post-quest topics`).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Silk consignment deadline', () => {
  test('the diplomatic path is closed by day 4 in the quest data', () => {
    const choosePath = merchantsSeal.stages.find((stage) => stage.id === 'choose-path');
    const diplomatic = choosePath.availablePaths.find((option) => option.id === 'diplomatic');

    expect(diplomatic.requirements.dayBefore).toBe(4);
    expect(diplomatic.requirements.worldFlagsNone).toContain('silk-consignment-shipped');
  });

  test('the topics that open the diplomatic path expire with it', () => {
    const chenWei = npcs['chen-wei'].dialogue.topics;
    ['alternative', 'side-deal'].forEach((topicKey) => {
      expect(chenWei[topicKey].availability?.dayBefore, topicKey).toBe(4);
    });
  });

  test('the payment path carries no deadline, so the quest can never be softlocked', () => {
    const choosePath = merchantsSeal.stages.find((stage) => stage.id === 'choose-path');
    const payment = choosePath.availablePaths.find((option) => option.id === 'payment');
    expect(payment.requirements?.dayBefore).toBeUndefined();
  });
});

describe('Examinable prose', () => {
  OWNED_LOCATIONS.forEach((locationId) => {
    test(`${locationId} offers at least 12 examinable objects`, () => {
      const location = loadLocation(locationId);
      const props = (location.props || []).filter((prop) => prop.examineText);
      // In a Forge location `props` is empty by construction — the compositor
      // paints them INTO the plate and leaves the prose behind in plateProps,
      // which GameScene.createPlateHotspots turns back into examine targets.
      const painted = (location.plateProps || []).filter((prop) => prop.examineText);
      const lore = location.loreObjects || [];
      expect(props.length + painted.length + lore.length).toBeGreaterThanOrEqual(12);
    });

    test(`${locationId} props all carry layered examine prose`, () => {
      const location = loadLocation(locationId);
      const thin = (location.props || [])
        .map((prop, i) => ({ prop, i }))
        .filter(({ prop }) => !prop.examineText || prop.examineText.split(/\s+/).length < 30)
        .map(({ prop, i }) => `props[${i}] (${prop.sprite})`);
      expect(thin).toEqual([]);
    });
  });
});
