/**
 * Character Selection Scene
 * 
 * Player chooses their character before starting the game.
 * Ultima VIII style with character portraits and descriptions.
 */

import Phaser from 'phaser';

export default class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterSelectScene' });
    this.selectedCharacter = 0;
    this.characters = [
      {
        id: 'merchant',
        name: 'Merchant\'s Agent',
        title: 'Portuguese Trading Company',
        description: 'A young agent of the Casa da Índia, sent to Melaka to oversee spice trade operations. Quick-witted and ambitious.',
        stats: { diplomacy: 3, trade: 4, combat: 1 }
      },
      {
        id: 'explorer',
        name: 'Explorer',
        title: 'Royal Cartographer',
        description: 'A mapmaker and adventurer, documenting the exotic lands of the East for the Portuguese crown. Curious and observant.',
        stats: { diplomacy: 2, trade: 2, combat: 3 }
      },
      {
        id: 'missionary',
        name: 'Missionary',
        title: 'Society of Jesus',
        description: 'A Jesuit priest following in the footsteps of Francis Xavier. Seeks to spread the faith while learning from local cultures.',
        stats: { diplomacy: 4, trade: 1, combat: 1 }
      }
    ];
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.createBackground(width, height);

    // Title
    this.createTitle(width);

    // Character panels
    this.createCharacterPanels(width, height);

    // Description panel
    this.createDescriptionPanel(width, height);

    // Controls
    this.createControls(width, height);

    // Input
    this.setupInput();

    // Fade in
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // Select first character
    this.selectCharacter(0);
  }

  createBackground(width, height) {
    // Dark atmospheric background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0806);

    // Parchment texture effect
    const parchment = this.add.graphics();
    parchment.fillStyle(0x1a1410, 0.9);
    parchment.fillRect(40, 40, width - 80, height - 80);
    parchment.lineStyle(3, 0xD4AF37);
    parchment.strokeRect(40, 40, width - 80, height - 80);

    // Inner border
    parchment.lineStyle(1, 0x8B7355);
    parchment.strokeRect(50, 50, width - 100, height - 100);
  }

  createTitle(width) {
    // Decorative line
    this.add.text(width / 2, 60, '════════════════════════════════', {
      font: '16px serif',
      fill: '#D4AF37'
    }).setOrigin(0.5, 0);

    // Title
    this.add.text(width / 2, 85, 'Choose Your Character', {
      font: 'bold 36px Cinzel, Georgia, serif',
      fill: '#F4E4C8'
    }).setOrigin(0.5, 0);

    // Subtitle
    this.add.text(width / 2, 125, 'Who will you be in the streets of Melaka?', {
      font: 'italic 18px Crimson Text, Georgia, serif',
      fill: '#D4AF37'
    }).setOrigin(0.5, 0);

    // Decorative line
    this.add.text(width / 2, 150, '════════════════════════════════', {
      font: '16px serif',
      fill: '#D4AF37'
    }).setOrigin(0.5, 0);
  }

  createCharacterPanels(width, height) {
    this.characterPanels = [];
    const panelWidth = 220;
    const panelHeight = 200;
    const startX = (width - (panelWidth * 3 + 40)) / 2;
    const y = 200;

    this.characters.forEach((char, index) => {
      const x = startX + index * (panelWidth + 20);

      // Panel background
      const panel = this.add.graphics();
      panel.fillStyle(0x2A1A0A, 0.9);
      panel.fillRoundedRect(x, y, panelWidth, panelHeight, 8);
      panel.lineStyle(2, 0x5C4033);
      panel.strokeRoundedRect(x, y, panelWidth, panelHeight, 8);

      // Selection highlight (hidden initially)
      const highlight = this.add.graphics();
      highlight.lineStyle(4, 0xD4AF37);
      highlight.strokeRoundedRect(x - 2, y - 2, panelWidth + 4, panelHeight + 4, 10);
      highlight.setVisible(false);

      // Character portrait placeholder (colored circle for now)
      const portraitColors = [0x8B0000, 0x2E5A1C, 0x1A1A3A];
      const portrait = this.add.circle(x + panelWidth / 2, y + 70, 50, portraitColors[index]);
      portrait.setStrokeStyle(3, 0xD4AF37);

      // Portrait initial
      const initial = this.add.text(x + panelWidth / 2, y + 70, char.name.charAt(0), {
        font: 'bold 48px Cinzel, serif',
        fill: '#F4E4C8'
      }).setOrigin(0.5, 0.5);

      // Character name
      const nameText = this.add.text(x + panelWidth / 2, y + 135, char.name, {
        font: 'bold 18px Cinzel, Georgia, serif',
        fill: '#F4E4C8'
      }).setOrigin(0.5, 0);

      // Title
      const titleText = this.add.text(x + panelWidth / 2, y + 160, char.title, {
        font: 'italic 12px Crimson Text, serif',
        fill: '#D4AF37'
      }).setOrigin(0.5, 0);

      // Make interactive
      const hitArea = this.add.rectangle(x + panelWidth / 2, y + panelHeight / 2, panelWidth, panelHeight, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => this.selectCharacter(index));
      hitArea.on('pointerover', () => this.selectCharacter(index));

      this.characterPanels.push({
        panel, highlight, portrait, initial, nameText, titleText, hitArea
      });
    });
  }

  createDescriptionPanel(width, height) {
    const panelY = 420;
    const panelWidth = 700;
    const panelHeight = 80;
    const x = (width - panelWidth) / 2;

    // Background
    this.descBg = this.add.graphics();
    this.descBg.fillStyle(0x1A1410, 0.9);
    this.descBg.fillRoundedRect(x, panelY, panelWidth, panelHeight, 6);
    this.descBg.lineStyle(2, 0x8B7355);
    this.descBg.strokeRoundedRect(x, panelY, panelWidth, panelHeight, 6);

    // Description text
    this.descText = this.add.text(width / 2, panelY + 15, '', {
      font: '16px Crimson Text, Georgia, serif',
      fill: '#D4C4A8',
      align: 'center',
      wordWrap: { width: panelWidth - 40 }
    }).setOrigin(0.5, 0);
  }

  createControls(width, height) {
    // Start button
    const btnY = height - 55;
    
    this.startBtnBg = this.add.graphics();
    this.startBtnBg.fillStyle(0x8B0000, 0.9);
    this.startBtnBg.fillRoundedRect(width / 2 - 120, btnY, 240, 40, 6);
    this.startBtnBg.lineStyle(3, 0xD4AF37);
    this.startBtnBg.strokeRoundedRect(width / 2 - 120, btnY, 240, 40, 6);

    this.startBtn = this.add.text(width / 2, btnY + 20, 'Begin Journey', {
      font: 'bold 20px Cinzel, Georgia, serif',
      fill: '#F4E4C8'
    }).setOrigin(0.5, 0.5);
    this.startBtn.setInteractive({ useHandCursor: true });
    this.startBtn.on('pointerdown', () => this.startGame());
    this.startBtn.on('pointerover', () => {
      this.startBtnBg.clear();
      this.startBtnBg.fillStyle(0xA52A2A, 1);
      this.startBtnBg.fillRoundedRect(width / 2 - 120, btnY, 240, 40, 6);
      this.startBtnBg.lineStyle(3, 0xFFD700);
      this.startBtnBg.strokeRoundedRect(width / 2 - 120, btnY, 240, 40, 6);
    });
    this.startBtn.on('pointerout', () => {
      this.startBtnBg.clear();
      this.startBtnBg.fillStyle(0x8B0000, 0.9);
      this.startBtnBg.fillRoundedRect(width / 2 - 120, btnY, 240, 40, 6);
      this.startBtnBg.lineStyle(3, 0xD4AF37);
      this.startBtnBg.strokeRoundedRect(width / 2 - 120, btnY, 240, 40, 6);
    });

    // Controls hint
    this.add.text(width / 2, height - 8, '← → Select  •  Enter Begin  •  Esc Back', {
      font: '11px monospace',
      fill: '#5C4033'
    }).setOrigin(0.5, 1);
  }

  setupInput() {
    this.input.keyboard.on('keydown-LEFT', () => {
      this.selectCharacter(this.selectedCharacter - 1);
    });
    this.input.keyboard.on('keydown-RIGHT', () => {
      this.selectCharacter(this.selectedCharacter + 1);
    });
    this.input.keyboard.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard.on('keydown-SPACE', () => this.startGame());
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('TitleScene');
    });
  }

  selectCharacter(index) {
    // Wrap around
    if (index < 0) index = this.characters.length - 1;
    if (index >= this.characters.length) index = 0;

    this.selectedCharacter = index;

    // Update panel highlights
    this.characterPanels.forEach((panel, i) => {
      panel.highlight.setVisible(i === index);
    });

    // Update description
    const char = this.characters[index];
    this.descText.setText(char.description);

    // Play sound
    if (this.cache.audio.exists('sfx-menu-select')) {
      this.sound.play('sfx-menu-select', { volume: 0.3 });
    }
  }

  startGame() {
    const selectedChar = this.characters[this.selectedCharacter];
    
    // Store selection in registry
    this.registry.set('playerCharacter', selectedChar.id);
    this.registry.set('playerName', selectedChar.name);

    // Fade out and go to loading screen
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LoadingScene', { mapKey: 'rua-direita' });
    });
  }
}

