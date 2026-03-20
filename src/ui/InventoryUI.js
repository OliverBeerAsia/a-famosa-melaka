/**
 * Inventory UI - Portuguese Melaka Era Style
 * Merchant's satchel design for 960x540 resolution
 */

import Phaser from 'phaser';

export default class InventoryUI {
  constructor(scene) {
    this.scene = scene;
    this.isVisible = false;
    this.selectedSlot = 0;
    this.itemSlots = [];

    this.cols = 5;
    this.rows = 4;
    this.slotSize = 48;
    this.slotPadding = 6;
    this.margin = 20;

    this.createUI();
    this.setupInput();
    this.setupEvents();
  }

  createUI() {
    const contentWidth = (this.slotSize + this.slotPadding) * this.cols;
    const contentHeight = (this.slotSize + this.slotPadding) * this.rows;
    const width = contentWidth + this.margin * 2 + 100;
    const height = contentHeight + this.margin * 2 + 80;
    const x = (960 - width) / 2;
    const y = (540 - height) / 2;

    this.container = this.scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(3000);
    this.container.setVisible(false);

    // Shadow
    this.shadow = this.scene.add.rectangle(5, 5, width, height, 0x000000, 0.5);
    this.shadow.setOrigin(0, 0);
    this.container.add(this.shadow);

    // Leather background
    this.leatherBg = this.scene.add.rectangle(0, 0, width, height, 0x3D2817, 1);
    this.leatherBg.setOrigin(0, 0);
    this.leatherBg.setStrokeStyle(3, 0xD4AF37);
    this.container.add(this.leatherBg);

    // Inner parchment
    this.parchment = this.scene.add.rectangle(10, 10, width - 20, height - 20, 0xD4C4A8, 1);
    this.parchment.setOrigin(0, 0);
    this.container.add(this.parchment);

    // Title
    this.titleText = this.scene.add.text(width / 2, 25, 'MERCHANT\'S SATCHEL', {
      font: 'bold 18px Cinzel, Georgia, serif',
      fill: '#8B0000'
    });
    this.titleText.setOrigin(0.5, 0);
    this.container.add(this.titleText);

    // Coin pouch
    const pouchX = width - 60;
    const pouchY = 70;
    
    this.pouchBg = this.scene.add.ellipse(pouchX, pouchY, 60, 45, 0x5C4033, 1);
    this.pouchBg.setStrokeStyle(2, 0x3D2817);
    this.container.add(this.pouchBg);

    this.moneyText = this.scene.add.text(pouchX, pouchY, '0', {
      font: 'bold 16px Cinzel, serif',
      fill: '#FFD700'
    });
    this.moneyText.setOrigin(0.5, 0.5);
    this.container.add(this.moneyText);

    this.currencyLabel = this.scene.add.text(pouchX, pouchY + 28, 'cruzados', {
      font: '10px Crimson Text, serif',
      fill: '#D4AF37'
    });
    this.currencyLabel.setOrigin(0.5, 0);
    this.container.add(this.currencyLabel);

    // Grid
    const gridStartX = this.margin + 15;
    const gridStartY = 55;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const slotX = gridStartX + col * (this.slotSize + this.slotPadding);
        const slotY = gridStartY + row * (this.slotSize + this.slotPadding);
        const slot = this.createSlot(slotX, slotY, row * this.cols + col);
        this.itemSlots.push(slot);
      }
    }

    // Description
    const descY = gridStartY + contentHeight + 8;
    this.descBg = this.scene.add.rectangle(gridStartX, descY, contentWidth, 35, 0xC4B498, 1);
    this.descBg.setOrigin(0, 0);
    this.descBg.setStrokeStyle(1, 0x8B7355);
    this.container.add(this.descBg);

    this.descText = this.scene.add.text(gridStartX + 8, descY + 6, 'Select an item...', {
      font: '12px Crimson Text, serif',
      fill: '#3D2817',
      wordWrap: { width: contentWidth - 16 }
    });
    this.container.add(this.descText);

    // Instructions
    this.instructionText = this.scene.add.text(width / 2, height - 15, '[I] close • [←→↑↓] select • [E] examine', {
      font: '11px monospace',
      fill: '#5C4033'
    });
    this.instructionText.setOrigin(0.5, 1);
    this.container.add(this.instructionText);
  }

  createSlot(x, y, index) {
    const border = this.scene.add.rectangle(x, y, this.slotSize, this.slotSize, 0x5C4033, 1);
    border.setOrigin(0, 0);
    border.setStrokeStyle(2, 0x3D2817);
    this.container.add(border);

    const bg = this.scene.add.rectangle(x + 3, y + 3, this.slotSize - 6, this.slotSize - 6, 0x2A1A0A, 1);
    bg.setOrigin(0, 0);
    this.container.add(bg);

    const highlight = this.scene.add.rectangle(x, y, this.slotSize, this.slotSize);
    highlight.setOrigin(0, 0);
    highlight.setStrokeStyle(3, 0xFFD700);
    highlight.setAlpha(0);
    this.container.add(highlight);

    const icon = this.scene.add.rectangle(x + this.slotSize / 2, y + this.slotSize / 2, this.slotSize - 12, this.slotSize - 12, 0x000000, 0);
    this.container.add(icon);

    return { index, x, y, border, bg, highlight, icon, item: null };
  }

  setupInput() {
    this.iKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.iKey.on('down', () => this.toggle());

    this.arrowKeys = this.scene.input.keyboard.createCursorKeys();

    this.eKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.eKey.on('down', () => {
      if (this.isVisible) this.examineSelected();
    });

    this.escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => {
      if (this.isVisible) this.hide();
    });
  }

  setupEvents() {
    this.scene.events.on('itemAdded', () => this.refresh());
    this.scene.events.on('itemRemoved', () => this.refresh());
  }

  toggle() {
    if (this.isVisible) this.hide();
    else this.show();
  }

  show() {
    this.isVisible = true;
    this.container.setVisible(true);
    this.refresh();
    this.selectSlot(0);

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150
    });

    this.scene.events.emit('inventoryOpened');
  }

  hide() {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 100,
      onComplete: () => {
        this.isVisible = false;
        this.container.setVisible(false);
        this.scene.events.emit('inventoryClosed');
      }
    });
  }

  refresh() {
    if (!this.scene.inventory) return;

    const items = this.scene.inventory.getItems();

    this.itemSlots.forEach((slot, index) => {
      slot.item = items[index] || null;
      if (slot.item) {
        slot.icon.setFillStyle(this.getItemColor(slot.item.id), 1);
      } else {
        slot.icon.setFillStyle(0x000000, 0);
      }
    });

    const money = this.scene.inventory.getTotalMoney();
    this.moneyText.setText(money.toString());
  }

  getItemColor(itemId) {
    const colors = {
      'trading-seal': 0xC41E3A,
      'coin-pouch': 0xFFD700,
      'spice-sample': 0xFF8C00,
      'letter': 0xF5DEB3,
      'key-warehouse': 0x708090,
      'portuguese-wine': 0x722F37,
      'medicinal-herbs': 0x228B22,
      'rosary': 0xD4AF37
    };
    return colors[itemId] || 0x8B7355;
  }

  selectSlot(index) {
    index = Math.max(0, Math.min(index, this.itemSlots.length - 1));

    if (this.selectedSlot !== null && this.itemSlots[this.selectedSlot]) {
      this.itemSlots[this.selectedSlot].highlight.setAlpha(0);
    }

    this.selectedSlot = index;
    const slot = this.itemSlots[index];
    slot.highlight.setAlpha(1);

    if (slot.item) {
      this.descText.setText(`${slot.item.name}: ${slot.item.description}`);
    } else {
      this.descText.setText('Empty slot');
    }
  }

  examineSelected() {
    const slot = this.itemSlots[this.selectedSlot];
    if (slot.item && this.scene.inventory) {
      const desc = this.scene.inventory.examineItem(slot.item.instanceId);
      if (desc) this.descText.setText(desc);
    }
  }

  update() {
    if (!this.isVisible) return;

    if (Phaser.Input.Keyboard.JustDown(this.arrowKeys.left)) {
      if (this.selectedSlot % this.cols > 0) this.selectSlot(this.selectedSlot - 1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.arrowKeys.right)) {
      if (this.selectedSlot % this.cols < this.cols - 1) this.selectSlot(this.selectedSlot + 1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.arrowKeys.up)) {
      if (this.selectedSlot >= this.cols) this.selectSlot(this.selectedSlot - this.cols);
    }
    if (Phaser.Input.Keyboard.JustDown(this.arrowKeys.down)) {
      if (this.selectedSlot < this.itemSlots.length - this.cols) this.selectSlot(this.selectedSlot + this.cols);
    }
  }

  destroy() {
    this.iKey.off('down');
    this.eKey.off('down');
    this.escKey.off('down');
    this.scene.events.off('itemAdded');
    this.scene.events.off('itemRemoved');
    this.container.destroy();
  }
}
