/**
 * Journal UI - Portuguese Melaka Era Style
 * Explorer's journal design for 960x540 resolution
 */

import Phaser from 'phaser';

export default class JournalUI {
  constructor(scene) {
    this.scene = scene;
    this.isVisible = false;
    this.currentTab = 'quests';
    this.scrollOffset = 0;

    this.createUI();
    this.setupInput();
    this.setupEvents();
  }

  createUI() {
    const width = 550;
    const height = 400;
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

    // Leather cover
    this.cover = this.scene.add.rectangle(0, 0, width, height, 0x3D2817, 1);
    this.cover.setOrigin(0, 0);
    this.cover.setStrokeStyle(3, 0xD4AF37);
    this.container.add(this.cover);

    // Inner parchment
    this.page = this.scene.add.rectangle(15, 15, width - 30, height - 30, 0xF5E6D3, 1);
    this.page.setOrigin(0, 0);
    this.container.add(this.page);

    // Title
    this.titleText = this.scene.add.text(width / 2, 30, 'EXPLORER\'S JOURNAL', {
      font: 'bold 20px Cinzel, Georgia, serif',
      fill: '#3D2817'
    });
    this.titleText.setOrigin(0.5, 0);
    this.container.add(this.titleText);

    // Subtitle
    this.scene.add.text(width / 2, 55, 'Melaka, Anno Domini 1580', {
      font: 'italic 12px Crimson Text, serif',
      fill: '#8B7355'
    }).setOrigin(0.5, 0);
    this.container.add(this.scene.children.list[this.scene.children.list.length - 1]);

    // Tabs
    this.createTabs(width);

    // Content area
    this.contentContainer = this.scene.add.container(30, 100);
    this.container.add(this.contentContainer);

    // Instructions
    this.instructionText = this.scene.add.text(width / 2, height - 20, '[J] close • [Q/E] tabs • [↑↓] scroll', {
      font: '11px monospace',
      fill: '#5C4033'
    });
    this.instructionText.setOrigin(0.5, 1);
    this.container.add(this.instructionText);
  }

  createTabs(width) {
    const tabY = 75;

    this.questsTab = this.scene.add.text(width / 2 - 60, tabY, '[QUESTS]', {
      font: 'bold 14px Cinzel, serif',
      fill: '#8B0000'
    });
    this.questsTab.setOrigin(0.5, 0);
    this.questsTab.setInteractive({ useHandCursor: true });
    this.questsTab.on('pointerdown', () => this.switchTab('quests'));
    this.container.add(this.questsTab);

    this.journalTab = this.scene.add.text(width / 2 + 60, tabY, '[NOTES]', {
      font: '14px Cinzel, serif',
      fill: '#5C4033'
    });
    this.journalTab.setOrigin(0.5, 0);
    this.journalTab.setInteractive({ useHandCursor: true });
    this.journalTab.on('pointerdown', () => this.switchTab('journal'));
    this.container.add(this.journalTab);
  }

  setupInput() {
    this.jKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.jKey.on('down', () => this.toggle());

    this.qKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.qKey.on('down', () => {
      if (this.isVisible) this.switchTab('quests');
    });

    this.eKeyJournal = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.eKeyJournal.on('down', () => {
      if (this.isVisible) this.switchTab('journal');
    });

    this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

    this.escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => {
      if (this.isVisible) this.hide();
    });
  }

  setupEvents() {
    this.scene.events.on('questStarted', () => this.refresh());
    this.scene.events.on('questAdvanced', () => this.refresh());
    this.scene.events.on('questCompleted', () => this.refresh());
    this.scene.events.on('journalUpdated', () => this.refresh());
  }

  toggle() {
    if (this.isVisible) this.hide();
    else this.show();
  }

  show() {
    this.isVisible = true;
    this.container.setVisible(true);
    this.refresh();

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150
    });

    this.scene.events.emit('journalOpened');
  }

  hide() {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 100,
      onComplete: () => {
        this.isVisible = false;
        this.container.setVisible(false);
        this.scene.events.emit('journalClosed');
      }
    });
  }

  switchTab(tab) {
    this.currentTab = tab;
    this.scrollOffset = 0;

    if (tab === 'quests') {
      this.questsTab.setStyle({ fill: '#8B0000', fontStyle: 'bold' });
      this.journalTab.setStyle({ fill: '#5C4033', fontStyle: 'normal' });
    } else {
      this.questsTab.setStyle({ fill: '#5C4033', fontStyle: 'normal' });
      this.journalTab.setStyle({ fill: '#8B0000', fontStyle: 'bold' });
    }

    this.refresh();
  }

  refresh() {
    this.contentContainer.removeAll(true);

    if (this.currentTab === 'quests') {
      this.renderQuests();
    } else {
      this.renderJournal();
    }
  }

  renderQuests() {
    if (!this.scene.questSystem) return;

    let yOffset = 0;
    const lineHeight = 22;
    const contentWidth = 480;

    const activeQuests = this.scene.questSystem.getActiveQuests();

    if (activeQuests.length === 0) {
      const noQuests = this.scene.add.text(0, yOffset, 'No active quests.\nSpeak with townsfolk to find work...', {
        font: 'italic 14px Crimson Text, serif',
        fill: '#8B7355',
        lineSpacing: 4
      });
      this.contentContainer.add(noQuests);
      return;
    }

    activeQuests.forEach(quest => {
      const questTitle = this.scene.add.text(0, yOffset, `⚜ ${quest.name}`, {
        font: 'bold 16px Crimson Text, serif',
        fill: '#3D2817'
      });
      this.contentContainer.add(questTitle);
      yOffset += lineHeight + 4;

      const stage = this.scene.questSystem.getQuestStage(quest.id);
      if (stage) {
        stage.objectives.forEach(obj => {
          const check = obj.completed ? '✓' : '○';
          const color = obj.completed ? '#228B22' : '#5C4033';
          const objText = this.scene.add.text(15, yOffset, `${check} ${this.formatObjective(obj)}`, {
            font: '13px Crimson Text, serif',
            fill: color
          });
          this.contentContainer.add(objText);
          yOffset += lineHeight - 4;
        });
      }
      yOffset += 8;
    });
  }

  renderJournal() {
    if (!this.scene.questSystem) return;

    let yOffset = 0;
    const journal = this.scene.questSystem.getJournal();

    if (journal.length === 0) {
      const noEntries = this.scene.add.text(0, yOffset, 'Journal is empty.\nYour adventures await...', {
        font: 'italic 14px Crimson Text, serif',
        fill: '#8B7355',
        lineSpacing: 4
      });
      this.contentContainer.add(noEntries);
      return;
    }

    [...journal].reverse().slice(0, 8).forEach(entry => {
      const header = this.scene.add.text(0, yOffset, `[${entry.timeString}]`, {
        font: '10px monospace',
        fill: '#8B7355'
      });
      this.contentContainer.add(header);
      yOffset += 16;

      const text = this.scene.add.text(0, yOffset, entry.text, {
        font: '13px Crimson Text, serif',
        fill: '#3D2817',
        wordWrap: { width: 480 }
      });
      this.contentContainer.add(text);
      yOffset += text.height + 12;
    });
  }

  formatObjective(obj) {
    switch (obj.type) {
      case 'talk': return `Talk to ${this.formatNPCName(obj.target)}`;
      case 'give': return `Give ${obj.item} to ${this.formatNPCName(obj.target)}`;
      case 'pay': return `Pay ${obj.amount} cruzados`;
      case 'find': return `Find ${obj.target}`;
      case 'go': return `Go to ${obj.target}`;
      default: return obj.description || 'Unknown';
    }
  }

  formatNPCName(npcId) {
    const names = {
      'fernao-gomes': 'Fernão Gomes',
      'capitao-rodrigues': 'Capitão Rodrigues',
      'padre-tomas': 'Padre Tomás',
      'aminah': 'Aminah',
      'chen-wei': 'Chen Wei',
      'rashid': 'Rashid'
    };
    return names[npcId] || npcId;
  }

  update() {
    if (!this.isVisible) return;

    if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 25);
      this.contentContainer.setY(100 - this.scrollOffset);
    }
    if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
      this.scrollOffset += 25;
      this.contentContainer.setY(100 - this.scrollOffset);
    }
  }

  destroy() {
    this.jKey.off('down');
    this.qKey.off('down');
    this.eKeyJournal.off('down');
    this.escKey.off('down');

    this.scene.events.off('questStarted');
    this.scene.events.off('questAdvanced');
    this.scene.events.off('questCompleted');
    this.scene.events.off('journalUpdated');

    this.container.destroy();
  }
}
