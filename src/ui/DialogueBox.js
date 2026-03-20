/**
 * Dialogue Box UI - Portuguese Melaka Era Style
 *
 * Styled as an aged manuscript/scroll for 960x540 resolution
 */

import Phaser from 'phaser';

export default class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    this.isVisible = false;
    this.currentNPC = null;
    this.currentTopics = [];
    this.selectedTopicIndex = 0;
    this.isTyping = false;

    this.createUI();
    this.setupInput();
  }

  createUI() {
    // Dimensions for 960x540 resolution
    const width = 800;
    const height = 150;
    const x = 80;
    const y = 380;

    // Container
    this.container = this.scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(2000);
    this.container.setAlpha(0);

    // Shadow
    this.shadow = this.scene.add.rectangle(4, 4, width, height, 0x000000, 0.5);
    this.shadow.setOrigin(0, 0);
    this.container.add(this.shadow);

    // Parchment background
    this.scrollBg = this.scene.add.rectangle(0, 0, width, height, 0xD4C4A8, 1);
    this.scrollBg.setOrigin(0, 0);
    this.scrollBg.setStrokeStyle(3, 0xD4AF37);
    this.container.add(this.scrollBg);

    // Inner area
    this.innerBg = this.scene.add.rectangle(5, 5, width - 10, height - 10, 0xE8DCC8, 1);
    this.innerBg.setOrigin(0, 0);
    this.container.add(this.innerBg);

    // Wax seal
    this.sealBg = this.scene.add.circle(45, 45, 28, 0x8B0000, 1);
    this.sealBg.setStrokeStyle(2, 0x5C0000);
    this.container.add(this.sealBg);

    this.sealText = this.scene.add.text(45, 45, '?', {
      font: 'bold 24px Cinzel, Georgia, serif',
      fill: '#FFD700'
    });
    this.sealText.setOrigin(0.5, 0.5);
    this.container.add(this.sealText);

    // NPC name
    this.namePlate = this.scene.add.text(45, 80, '', {
      font: 'bold 12px Cinzel, Georgia, serif',
      fill: '#8B0000'
    });
    this.namePlate.setOrigin(0.5, 0);
    this.container.add(this.namePlate);

    // NPC title
    this.titleText = this.scene.add.text(45, 95, '', {
      font: 'italic 10px Crimson Text, Georgia, serif',
      fill: '#5C4033'
    });
    this.titleText.setOrigin(0.5, 0);
    this.container.add(this.titleText);

    // Main dialogue text
    this.dialogueText = this.scene.add.text(95, 15, '', {
      font: '16px Crimson Text, Georgia, serif',
      fill: '#2A1A0A',
      lineSpacing: 4,
      wordWrap: { width: width - 120 }
    });
    this.container.add(this.dialogueText);

    // Topics header
    this.topicsHeader = this.scene.add.text(95, height - 50, '— Ask About —', {
      font: 'italic 11px Crimson Text, Georgia, serif',
      fill: '#8B7355'
    });
    this.container.add(this.topicsHeader);

    // Topics text
    this.topicsText = this.scene.add.text(95, height - 35, '', {
      font: '14px Crimson Text, Georgia, serif',
      fill: '#3D2817'
    });
    this.container.add(this.topicsText);

    // Instructions
    this.instructionText = this.scene.add.text(width - 15, height - 12, '', {
      font: '10px monospace',
      fill: '#8B7355',
      align: 'right'
    });
    this.instructionText.setOrigin(1, 1);
    this.container.add(this.instructionText);
  }

  setupInput() {
    this.scene.events.on('startDialogue', this.show, this);

    // Number keys for topics
    const numberNames = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    this.topicKeys = [];
    
    numberNames.forEach((name, index) => {
      const key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[name]);
      key.on('down', () => {
        if (this.isVisible && !this.isTyping) {
          this.selectTopic(index);
        }
      });
      this.topicKeys.push(key);
    });

    this.escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => {
      if (this.isVisible) this.hide();
    });

    this.enterKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.enterKey.on('down', () => {
      if (this.isTyping) this.skipTyping();
    });

    this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.spaceKey.on('down', () => {
      if (this.isVisible && this.isTyping) this.skipTyping();
    });
  }

  show(npcData) {
    if (this.isVisible) return;

    this.currentNPC = npcData;
    this.isVisible = true;

    this.namePlate.setText(npcData.name);
    this.titleText.setText(npcData.title || '');
    this.sealText.setText(npcData.name.charAt(0).toUpperCase());

    this.typeText(npcData.dialogue.greeting, () => {
      this.showTopics();
    });

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });
  }

  hide() {
    if (!this.isVisible) return;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.isVisible = false;
        this.currentNPC = null;
        this.currentTopics = [];
      }
    });
  }

  typeText(text, onComplete) {
    this.isTyping = true;
    this.dialogueText.setText('');
    this.topicsText.setText('');
    this.topicsHeader.setVisible(false);
    this.instructionText.setText('[SPACE] skip');

    let index = 0;
    const typeSpeed = 18;

    this.typeTimer = this.scene.time.addEvent({
      delay: typeSpeed,
      callback: () => {
        this.dialogueText.setText(text.substring(0, index + 1));
        index++;

        if (index >= text.length) {
          this.typeTimer.remove();
          this.isTyping = false;
          if (onComplete) onComplete();
        }
      },
      loop: true
    });
  }

  skipTyping() {
    if (this.typeTimer) {
      this.typeTimer.remove();
      this.typeTimer = null;
    }
    this.isTyping = false;

    if (this.currentNPC?.dialogue?.greeting) {
      this.dialogueText.setText(this.currentNPC.dialogue.greeting);
    }
    this.showTopics();
  }

  showTopics() {
    if (!this.currentNPC?.dialogue?.topics) {
      this.instructionText.setText('[ESC] leave');
      this.topicsHeader.setVisible(false);
      return;
    }

    this.currentTopics = Object.keys(this.currentNPC.dialogue.topics);
    this.topicsHeader.setVisible(true);

    let topicsDisplay = '';
    this.currentTopics.forEach((topic, index) => {
      topicsDisplay += `[${index + 1}] ${this.capitalizeFirst(topic)}   `;
    });

    this.topicsText.setText(topicsDisplay);
    this.instructionText.setText('[1-9] ask • [ESC] leave');
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
  }

  selectTopic(index) {
    if (!this.isVisible || this.isTyping) return;
    if (index >= this.currentTopics.length) return;
    if (!this.currentNPC?.dialogue?.topics) return;

    const topicKey = this.currentTopics[index];
    const topicData = this.currentNPC.dialogue.topics[topicKey];

    if (!topicData?.text) return;

    this.scene.events.emit('topicDiscussed', {
      npcId: this.currentNPC.id,
      topic: topicKey,
      npcData: this.currentNPC
    });

    this.typeText(topicData.text, () => {
      this.showTopics();
    });
  }

  destroy() {
    this.scene.events.off('startDialogue', this.show, this);
    this.topicKeys.forEach(key => key.off('down'));
    this.escKey.off('down');
    this.enterKey.off('down');
    this.spaceKey.off('down');
    if (this.container) this.container.destroy();
    if (this.typeTimer) this.typeTimer.remove();
  }
}
