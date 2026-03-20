/**
 * Inventory System
 *
 * Manages the player's inventory:
 * - Item storage and management
 * - Pick up, examine, use, and combine items
 * - Inventory capacity limits
 * - Item data and descriptions
 */

export default class InventorySystem {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.maxItems = 20;
    this.selectedItem = null;

    // Item definitions
    this.itemDefinitions = {
      'trading-seal': {
        id: 'trading-seal',
        name: 'Trading Seal',
        description: 'A wax seal bearing the mark of Fernão Gomes. Essential for authorizing spice shipments.',
        icon: 'trading-seal',
        usable: true,
        questItem: true
      },
      'coin-pouch': {
        id: 'coin-pouch',
        name: 'Coin Pouch',
        description: 'A leather pouch containing 50 cruzados. The currency of Portuguese Melaka.',
        icon: 'coin-pouch',
        usable: true,
        value: 50
      },
      'spice-sample': {
        id: 'spice-sample',
        name: 'Spice Sample',
        description: 'A small pouch of cloves from the Moluccas. Worth more than gold in Europe.',
        icon: 'spice-sample',
        usable: false
      },
      'letter': {
        id: 'letter',
        name: 'Sealed Letter',
        description: 'A letter sealed with wax. The seal bears an unfamiliar crest.',
        icon: 'letter',
        usable: true,
        readable: true,
        content: 'To Chen Wei of the Merchant Guild: The debt must be collected. Take the seal as collateral. - L.M.'
      },
      'key-warehouse': {
        id: 'key-warehouse',
        name: 'Warehouse Key',
        description: 'An iron key that opens the warehouse on Rua Direita.',
        icon: 'key',
        usable: true
      },
      'portuguese-wine': {
        id: 'portuguese-wine',
        name: 'Portuguese Wine',
        description: 'A bottle of fine wine from Porto. A valuable trade good and gift.',
        icon: 'wine-bottle',
        usable: true,
        giftValue: 'high'
      },
      'medicinal-herbs': {
        id: 'medicinal-herbs',
        name: 'Medicinal Herbs',
        description: 'Local herbs used by Malay healers. Aminah might know their uses.',
        icon: 'herbs',
        usable: true
      },
      'rosary': {
        id: 'rosary',
        name: 'Rosary Beads',
        description: 'Blessed rosary beads. Padre Tomás would appreciate these.',
        icon: 'rosary',
        usable: false
      }
    };
  }

  /**
   * Add an item to the inventory
   * @param {string} itemId - The item definition ID
   * @returns {boolean} - Whether the item was successfully added
   */
  addItem(itemId) {
    if (this.items.length >= this.maxItems) {
      this.scene.events.emit('inventoryFull');
      console.log('Inventory full!');
      return false;
    }

    const itemDef = this.itemDefinitions[itemId];
    if (!itemDef) {
      console.warn(`Unknown item: ${itemId}`);
      return false;
    }

    // Create item instance
    const item = {
      ...itemDef,
      instanceId: `${itemId}-${Date.now()}`
    };

    this.items.push(item);
    this.scene.events.emit('itemAdded', item);
    console.log(`Picked up: ${item.name}`);
    return true;
  }

  /**
   * Remove an item from the inventory
   * @param {string} instanceId - The unique instance ID
   * @returns {object|null} - The removed item or null
   */
  removeItem(instanceId) {
    const index = this.items.findIndex(item => item.instanceId === instanceId);
    if (index === -1) return null;

    const [removed] = this.items.splice(index, 1);
    this.scene.events.emit('itemRemoved', removed);

    if (this.selectedItem?.instanceId === instanceId) {
      this.selectedItem = null;
    }

    return removed;
  }

  /**
   * Remove item by definition ID (first match)
   * @param {string} itemId - The item definition ID
   * @returns {object|null} - The removed item or null
   */
  removeItemById(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      return this.removeItem(item.instanceId);
    }
    return null;
  }

  /**
   * Check if player has an item
   * @param {string} itemId - The item definition ID
   * @returns {boolean}
   */
  hasItem(itemId) {
    return this.items.some(item => item.id === itemId);
  }

  /**
   * Get item count for a specific item type
   * @param {string} itemId - The item definition ID
   * @returns {number}
   */
  getItemCount(itemId) {
    return this.items.filter(item => item.id === itemId).length;
  }

  /**
   * Get all items
   * @returns {array}
   */
  getItems() {
    return [...this.items];
  }

  /**
   * Select an item for use
   * @param {string} instanceId - The unique instance ID
   */
  selectItem(instanceId) {
    const item = this.items.find(i => i.instanceId === instanceId);
    if (item) {
      this.selectedItem = item;
      this.scene.events.emit('itemSelected', item);
    }
  }

  /**
   * Deselect current item
   */
  deselectItem() {
    this.selectedItem = null;
    this.scene.events.emit('itemDeselected');
  }

  /**
   * Examine an item (show description)
   * @param {string} instanceId - The unique instance ID
   */
  examineItem(instanceId) {
    const item = this.items.find(i => i.instanceId === instanceId);
    if (item) {
      this.scene.events.emit('examineItem', item);
      return item.description;
    }
    return null;
  }

  /**
   * Use an item
   * @param {string} instanceId - The unique instance ID
   * @param {object} target - Optional target for the item
   * @returns {boolean} - Whether the item was used successfully
   */
  useItem(instanceId, target = null) {
    const item = this.items.find(i => i.instanceId === instanceId);
    if (!item) return false;

    if (!item.usable) {
      this.scene.events.emit('itemNotUsable', item);
      return false;
    }

    // Emit use event for quest/game logic to handle
    this.scene.events.emit('useItem', { item, target });

    // Handle readable items
    if (item.readable && item.content) {
      this.scene.events.emit('readItem', item);
    }

    return true;
  }

  /**
   * Use selected item on a target
   * @param {object} target - The target (NPC, object, etc.)
   * @returns {boolean}
   */
  useSelectedItemOn(target) {
    if (!this.selectedItem) return false;
    return this.useItem(this.selectedItem.instanceId, target);
  }

  /**
   * Get total value of coins/currency in inventory
   * @returns {number}
   */
  getTotalMoney() {
    return this.items
      .filter(item => item.value)
      .reduce((total, item) => total + item.value, 0);
  }

  /**
   * Spend money (removes coin pouches as needed)
   * @param {number} amount - Amount to spend
   * @returns {boolean} - Whether payment was successful
   */
  spendMoney(amount) {
    if (this.getTotalMoney() < amount) {
      return false;
    }

    let remaining = amount;
    const toRemove = [];

    for (const item of this.items) {
      if (item.value && remaining > 0) {
        if (item.value <= remaining) {
          remaining -= item.value;
          toRemove.push(item.instanceId);
        }
      }
    }

    // Remove used coin pouches
    toRemove.forEach(id => this.removeItem(id));

    // If we overpaid, we'd need change - simplified for demo
    this.scene.events.emit('moneySpent', amount);
    return true;
  }

  /**
   * Clear inventory
   */
  clear() {
    this.items = [];
    this.selectedItem = null;
    this.scene.events.emit('inventoryCleared');
  }

  /**
   * Save inventory state
   * @returns {object}
   */
  save() {
    return {
      items: this.items.map(item => ({
        id: item.id,
        instanceId: item.instanceId
      }))
    };
  }

  /**
   * Load inventory state
   * @param {object} data
   */
  load(data) {
    this.clear();
    if (data.items) {
      data.items.forEach(saved => {
        const itemDef = this.itemDefinitions[saved.id];
        if (itemDef) {
          this.items.push({
            ...itemDef,
            instanceId: saved.instanceId
          });
        }
      });
    }
  }
}

