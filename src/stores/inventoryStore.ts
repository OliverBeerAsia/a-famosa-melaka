/**
 * Inventory Store - Item Management
 *
 * Manages player inventory, money, and item interactions.
 */

import { create } from 'zustand';

export interface InventoryItem {
  instanceId: string;
  id: string;
  name: string;
  description: string;
  type: 'key' | 'document' | 'trade' | 'consumable' | 'valuable';
  value?: number;
  stackable?: boolean;
  quantity?: number;
}

// Item definitions - base data for all items
export const ITEM_DEFINITIONS: Record<string, Omit<InventoryItem, 'instanceId'>> = {
  // Quest items - The Merchant's Seal
  'trading-seal': {
    id: 'trading-seal',
    name: "Fernão's Trading Seal",
    description: "An official Portuguese trading seal bearing Gomes' merchant mark. Required for authorizing shipments under Crown law.",
    type: 'key',
  },
  'bribe-note': {
    id: 'bribe-note',
    name: 'Customs Receipt',
    description: "A crumpled receipt from the customs inspector for 'fortress maintenance donations.' Evidence of corruption.",
    type: 'document',
  },
  'letter-of-credit': {
    id: 'letter-of-credit',
    name: 'Letter of Credit',
    description: "A letter from Chen Wei's guild establishing you as a trusted trading partner. Opens doors in Chinese merchant circles.",
    type: 'document',
    value: 100,
  },

  // Quest items - The Padre's Dilemma
  'convert-list': {
    id: 'convert-list',
    name: 'Convert Registry',
    description: 'A list of recent converts to Christianity, with notes on their sincerity and former beliefs.',
    type: 'document',
  },
  'malay-charm': {
    id: 'malay-charm',
    name: 'Malay Charm',
    description: 'A traditional protective amulet. The Padre would not approve of its pagan origins.',
    type: 'key',
  },

  // Quest items - Rashid's Cargo
  'cargo-manifest': {
    id: 'cargo-manifest',
    name: 'Cargo Manifest',
    description: 'Official documentation of goods aboard the dhow Al-Rashida.',
    type: 'document',
  },
  'smuggled-goods': {
    id: 'smuggled-goods',
    name: 'Contraband Package',
    description: 'A suspicious package wrapped in oilcloth. Best not to ask what is inside.',
    type: 'trade',
    value: 50,
  },

  // General items
  'coin-pouch': {
    id: 'coin-pouch',
    name: 'Coin Pouch',
    description: 'A leather pouch containing Portuguese cruzados.',
    type: 'valuable',
    value: 10,
    stackable: true,
  },
  'spice-sample': {
    id: 'spice-sample',
    name: 'Spice Sample',
    description: 'A small bundle of precious spices - cinnamon, pepper, and nutmeg. Worth a fortune in Europe.',
    type: 'trade',
    value: 5,
  },
  'letter': {
    id: 'letter',
    name: 'Sealed Letter',
    description: 'A letter sealed with wax. The seal bears an unfamiliar crest.',
    type: 'document',
  },
  'key-warehouse': {
    id: 'key-warehouse',
    name: 'Warehouse Key',
    description: 'A heavy iron key that opens the Gomes warehouse.',
    type: 'key',
  },
  'portuguese-wine': {
    id: 'portuguese-wine',
    name: 'Portuguese Wine',
    description: 'A bottle of fine wine from Porto. A valuable commodity in these parts.',
    type: 'trade',
    value: 15,
  },
  'medicinal-herbs': {
    id: 'medicinal-herbs',
    name: 'Medicinal Herbs',
    description: 'A bundle of local herbs used for traditional remedies. The dukun knows their secrets.',
    type: 'consumable',
    value: 3,
  },
  'rosary': {
    id: 'rosary',
    name: 'Rosary',
    description: 'A wooden rosary with ivory beads. Blessed by Padre Tomás himself.',
    type: 'valuable',
    value: 8,
  },
  'chinese-silk': {
    id: 'chinese-silk',
    name: 'Silk Bolt',
    description: 'A bolt of fine Chinese silk, smooth as water and lustrous as moonlight.',
    type: 'trade',
    value: 25,
  },
  'kampung-rice': {
    id: 'kampung-rice',
    name: 'Rice Bundle',
    description: 'A bundle of locally grown rice. The staple of Malay cuisine.',
    type: 'consumable',
    value: 2,
  },
  'arabic-incense': {
    id: 'arabic-incense',
    name: 'Frankincense',
    description: 'Aromatic resin from the Arabian peninsula. Used in religious ceremonies and perfumes.',
    type: 'trade',
    value: 12,
  },

  // Rashid's Cargo quest items
  'wrapped-bundle': {
    id: 'wrapped-bundle',
    name: 'Wrapped Bundle',
    description: "A carefully wrapped bundle from Rashid. He claims it contains spices, but it's heavier than expected.",
    type: 'key',
  },
  'delivery-payment': {
    id: 'delivery-payment',
    name: 'Delivery Payment',
    description: 'Coins received from Mak Enang for the delivery. Twenty cruzados as promised.',
    type: 'valuable',
    value: 20,
  },
  'job-payment': {
    id: 'job-payment',
    name: "Rashid's Payment",
    description: 'Twenty cruzados from Rashid for completing the delivery.',
    type: 'valuable',
    value: 20,
  },
  'informant-reward': {
    id: 'informant-reward',
    name: "Informant's Reward",
    description: 'A garrison-issued payment for reporting smuggling activity.',
    type: 'valuable',
    value: 15,
  },
  'rosary-blessed': {
    id: 'rosary-blessed',
    name: 'Blessed Rosary',
    description: 'A rosary blessed by Padre Tomás in gratitude.',
    type: 'valuable',
    value: 25,
  },
  'letter-of-commendation': {
    id: 'letter-of-commendation',
    name: 'Letter of Commendation',
    description: 'A commendation from Capitão Rodrigues for service to the city.',
    type: 'document',
    value: 50,
  },
  'arab-amulet': {
    id: 'arab-amulet',
    name: "Sailor's Amulet",
    description: 'An amulet from Rashid, marked with prayers for safe passage.',
    type: 'valuable',
    value: 30,
  },

  // Additional trade goods
  'pepper-pouch': {
    id: 'pepper-pouch',
    name: 'Black Pepper',
    description: "Piper nigrum from the Malabar coast. 'Black gold' that drives the spice trade.",
    type: 'trade',
    value: 8,
  },
  'nutmeg': {
    id: 'nutmeg',
    name: 'Nutmeg',
    description: 'The precious seed from the Banda Islands. Wars have been fought over this spice.',
    type: 'trade',
    value: 15,
  },
  'cloves': {
    id: 'cloves',
    name: 'Cloves',
    description: 'Aromatic flower buds from Ternate. Worth their weight in silver in European markets.',
    type: 'trade',
    value: 12,
  },
};

export interface InventoryState {
  items: InventoryItem[];
  money: number;
  maxSlots: number;
  selectedSlot: number;

  // Actions
  addItem: (itemId: string, quantity?: number) => boolean;
  removeItem: (instanceId: string) => void;
  removeFirstItemById: (itemId: string) => boolean;
  hasItem: (itemId: string) => boolean;
  getItemCount: (itemId: string) => number;
  addMoney: (amount: number) => void;
  removeMoney: (amount: number) => boolean;
  setSelectedSlot: (slot: number) => void;
  examineItem: (instanceId: string) => string | null;
  useItem: (instanceId: string) => void;
  hydrateInventory: (items: InventoryItem[], money: number) => void;
  clear: () => void;
}

let instanceCounter = 0;

function syncInstanceCounter(items: InventoryItem[]) {
  let highest = 0;
  items.forEach((item) => {
    const match = item.instanceId.match(/-(\d+)$/);
    if (!match) return;

    const value = Number.parseInt(match[1], 10);
    if (!Number.isNaN(value)) {
      highest = Math.max(highest, value);
    }
  });
  instanceCounter = highest;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  money: 0,
  maxSlots: 20,
  selectedSlot: 0,

  addItem: (itemId, quantity = 1) => {
    const { items, maxSlots } = get();
    const definition = ITEM_DEFINITIONS[itemId];

    if (!definition) {
      console.warn(`Unknown item: ${itemId}`);
      return false;
    }

    // Check if stackable and already exists
    if (definition.stackable) {
      const existing = items.find((item) => item.id === itemId);
      if (existing) {
        set({
          items: items.map((item) =>
            item.instanceId === existing.instanceId
              ? { ...item, quantity: (item.quantity || 1) + quantity }
              : item
          ),
        });
        return true;
      }
    }

    // Check capacity
    if (items.length >= maxSlots) {
      console.warn('Inventory full');
      return false;
    }

    // Add new item
    const newItem: InventoryItem = {
      ...definition,
      instanceId: `${itemId}-${++instanceCounter}`,
      quantity: definition.stackable ? quantity : undefined,
    };

    set({ items: [...items, newItem] });

    // Update money if it's a coin pouch
    if (itemId === 'coin-pouch' && definition.value) {
      get().addMoney(definition.value * quantity);
    }

    return true;
  },

  removeItem: (instanceId) => {
    const { items } = get();
    const item = items.find((i) => i.instanceId === instanceId);

    if (item && item.stackable && (item.quantity || 1) > 1) {
      // Reduce stack
      set({
        items: items.map((i) =>
          i.instanceId === instanceId
            ? { ...i, quantity: (i.quantity || 1) - 1 }
            : i
        ),
      });
    } else {
      // Remove entirely
      set({ items: items.filter((i) => i.instanceId !== instanceId) });
    }
  },

  removeFirstItemById: (itemId) => {
    const item = get().items.find((entry) => entry.id === itemId);
    if (!item) return false;
    get().removeItem(item.instanceId);
    return true;
  },

  hasItem: (itemId) => {
    return get().items.some((item) => item.id === itemId);
  },

  getItemCount: (itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return 0;
    return item.quantity || 1;
  },

  addMoney: (amount) => {
    set((state) => ({ money: state.money + amount }));
  },

  removeMoney: (amount) => {
    const { money } = get();
    if (money < amount) return false;
    set({ money: money - amount });
    return true;
  },

  setSelectedSlot: (slot) => {
    const { maxSlots } = get();
    set({ selectedSlot: Math.max(0, Math.min(slot, maxSlots - 1)) });
  },

  examineItem: (instanceId) => {
    const item = get().items.find((i) => i.instanceId === instanceId);
    if (!item) return null;

    let details = item.description;
    if (item.value) {
      details += ` Worth approximately ${item.value} cruzados.`;
    }
    if (item.quantity && item.quantity > 1) {
      details += ` (x${item.quantity})`;
    }
    return details;
  },

  useItem: (instanceId) => {
    const item = get().items.find((i) => i.instanceId === instanceId);
    if (!item) return;

    // Handle item use based on type
    if (item.type === 'consumable') {
      get().removeItem(instanceId);
      // Trigger effect - would emit event to Phaser
      console.log(`Used ${item.name}`);
    }
  },

  hydrateInventory: (items, money) => {
    syncInstanceCounter(items);
    set({
      items,
      money,
      selectedSlot: 0,
    });
  },

  clear: () => {
    instanceCounter = 0;
    set({ items: [], money: 0, selectedSlot: 0 });
  },
}));
