/**
 * Title Scene - Sierra/LucasArts Style
 * 
 * Features:
 * - Full-screen AI-generated opening artwork
 * - Integrated Start Game / Continue / Options buttons
 * - Period-appropriate styling
 */

import Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
    this.selectedOption = 0;
    this.menuOptions = ['New Game', 'Continue', 'Options'];
  }

  create() {
    const { width, height } = this.cameras.main;

    // === FULL SCREEN BACKGROUND ===
    this.createBackground(width, height);

    // === TITLE OVERLAY ===
    this.createTitleOverlay(width, height);

    // === MENU BUTTONS ===
    this.createMenu(width, height);

    // === FOOTER ===
    this.createFooter(width, height);

    // === INPUT ===
    this.setupInput();

    // === FADE IN ===
    this.cameras.main.fadeIn(1500, 0, 0, 0);

    // === MUSIC ===
    this.playTitleMusic();
  }

  createBackground(width, height) {
    // Fill entire screen with dark color first
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0806);

    // Try to load AI-generated scene
    if (this.textures.exists('opening-screen')) {
      const bgImage = this.add.image(width / 2, height / 2, 'opening-screen');
      
      // Scale to COVER entire screen (may crop edges)
      const scaleX = width / bgImage.width;
      const scaleY = height / bgImage.height;
      const scale = Math.max(scaleX, scaleY);
      bgImage.setScale(scale);
      
      // Subtle animation
      this.tweens.add({
        targets: bgImage,
        scale: scale * 1.02,
        duration: 20000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else {
      this.createFallbackBackground(width, height);
    }

    // Bottom gradient overlay for menu readability
    const menuOverlay = this.add.graphics();
    menuOverlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.95, 0.95);
    menuOverlay.fillRect(0, height - 250, width, 250);
    
    // Top gradient for title readability
    const topOverlay = this.add.graphics();
    topOverlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.8, 0.8, 0, 0);
    topOverlay.fillRect(0, 0, width, 180);
  }

  createFallbackBackground(width, height) {
    const graphics = this.add.graphics();
    
    for (let y = 0; y < height; y++) {
      const ratio = y / height;
      let r, g, b;
      
      if (ratio < 0.4) {
        r = Math.floor(200 - ratio * 150);
        g = Math.floor(120 - ratio * 100);
        b = Math.floor(40);
      } else {
        const darkRatio = (ratio - 0.4) / 0.6;
        r = Math.floor(80 - darkRatio * 60);
        g = Math.floor(60 - darkRatio * 40);
        b = Math.floor(40 - darkRatio * 30);
      }
      
      graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
      graphics.fillRect(0, y, width, 1);
    }
  }

  createTitleOverlay(width, height) {
    // Decorative line above title
    this.add.text(width / 2, 50, '════════════════════════════════════════════', {
      font: '18px serif',
      fill: '#D4AF37'
    }).setOrigin(0.5, 0);

    // Main title
    this.add.text(width / 2 + 3, 88, 'A FAMOSA', {
      font: 'bold 64px Cinzel, Georgia, serif',
      fill: '#000000'
    }).setOrigin(0.5, 0);

    this.titleText = this.add.text(width / 2, 85, 'A FAMOSA', {
      font: 'bold 64px Cinzel, Georgia, serif',
      fill: '#F4E4C8'
    }).setOrigin(0.5, 0);
    this.titleText.setStroke('#8B0000', 4);

    // Subtitle
    this.add.text(width / 2, 160, 'Streets of Golden Melaka', {
      font: 'italic 28px Crimson Text, Georgia, serif',
      fill: '#D4AF37'
    }).setOrigin(0.5, 0);

    // Decorative line below subtitle
    this.add.text(width / 2, 200, '════════════════════════════════════════════', {
      font: '18px serif',
      fill: '#D4AF37'
    }).setOrigin(0.5, 0);

    // Title glow animation
    this.tweens.add({
      targets: this.titleText,
      alpha: { from: 1, to: 0.85 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createMenu(width, height) {
    const menuStartY = height - 160;
    const menuSpacing = 50;
    this.menuTexts = [];
    this.menuBgs = [];

    this.menuOptions.forEach((option, index) => {
      const y = menuStartY + index * menuSpacing;
      
      // Button background
      const bg = this.add.graphics();
      bg.fillStyle(0x3D2817, index === 0 ? 0.9 : 0.7);
      bg.fillRoundedRect(width / 2 - 150, y - 12, 300, 48, 6);
      bg.lineStyle(3, index === 0 ? 0xD4AF37 : 0x8B7355);
      bg.strokeRoundedRect(width / 2 - 150, y - 12, 300, 48, 6);
      this.menuBgs.push(bg);
      
      // Button text
      const text = this.add.text(width / 2, y + 12, option, {
        font: index === 0 ? 'bold 26px Cinzel, Georgia, serif' : '24px Cinzel, Georgia, serif',
        fill: index === 0 ? '#F4E4C8' : '#A89070'
      });
      text.setOrigin(0.5, 0.5);
      text.setInteractive({ useHandCursor: true });
      
      text.on('pointerover', () => this.selectOption(index));
      text.on('pointerdown', () => this.confirmSelection());
      
      this.menuTexts.push(text);
    });

    // Selection indicator
    this.selector = this.add.text(width / 2 - 170, menuStartY + 12, '❧', {
      font: '28px serif',
      fill: '#D4AF37'
    }).setOrigin(0.5, 0.5);

    this.tweens.add({
      targets: this.selector,
      x: width / 2 - 175,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createFooter(width, height) {
    // Controls hint at very bottom (above the quote)
    this.add.text(width / 2, height - 12,
      '↑↓ Navigate  •  Enter Select  •  F Fullscreen',
      {
        font: '12px monospace',
        fill: '#5C4033'
      }
    ).setOrigin(0.5, 1);
  }

  setupInput() {
    this.input.keyboard.on('keydown-UP', () => this.selectOption(this.selectedOption - 1));
    this.input.keyboard.on('keydown-DOWN', () => this.selectOption(this.selectedOption + 1));
    this.input.keyboard.on('keydown-ENTER', () => this.confirmSelection());
    this.input.keyboard.on('keydown-SPACE', () => this.confirmSelection());
  }

  selectOption(index) {
    if (index < 0) index = this.menuOptions.length - 1;
    if (index >= this.menuOptions.length) index = 0;

    this.selectedOption = index;

    // Update text styles
    this.menuTexts.forEach((text, i) => {
      const isSelected = i === index;
      text.setStyle({
        font: isSelected ? 'bold 26px Cinzel, Georgia, serif' : '24px Cinzel, Georgia, serif',
        fill: isSelected ? '#F4E4C8' : '#A89070'
      });
    });

    // Redraw button backgrounds
    const { width, height } = this.cameras.main;
    const menuStartY = height - 160;
    
    this.menuBgs.forEach((bg, i) => {
      bg.clear();
      bg.fillStyle(0x3D2817, i === index ? 0.9 : 0.7);
      bg.fillRoundedRect(width / 2 - 150, menuStartY + i * 50 - 12, 300, 44, 6);
      bg.lineStyle(3, i === index ? 0xD4AF37 : 0x5C4033);
      bg.strokeRoundedRect(width / 2 - 150, menuStartY + i * 50 - 12, 300, 44, 6);
    });

    // Move selector
    this.selector.setY(menuStartY + index * 50 + 10);

    // Sound
    if (this.cache.audio.exists('sfx-menu-select')) {
      this.sound.play('sfx-menu-select', { volume: 0.3 });
    }
  }

  confirmSelection() {
    const option = this.menuOptions[this.selectedOption];

    switch (option) {
      case 'New Game':
        this.startNewGame();
        break;
      case 'Continue':
        this.continueGame();
        break;
      case 'Options':
        this.showOptions();
        break;
    }
  }

  startNewGame() {
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.registry.destroy();
      this.scene.start('GameScene', { mapKey: 'rua-direita' });
    });
  }

  continueGame() {
    const hasSave = this.registry.get('hasSave');
    if (hasSave) {
      this.cameras.main.fadeOut(1500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    } else {
      this.showMessage('No saved game found.\nStart a new adventure!');
    }
  }

  showOptions() {
    this.showMessage('Options coming soon...\n\nF - Toggle Fullscreen\nM - Toggle Music');
  }

  showMessage(text) {
    const { width, height } = this.cameras.main;
    
    const boxWidth = 400;
    const boxHeight = 140;
    
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1410, 0.95);
    bg.fillRoundedRect(width / 2 - boxWidth / 2, height / 2 - boxHeight / 2, boxWidth, boxHeight, 10);
    bg.lineStyle(3, 0xD4AF37);
    bg.strokeRoundedRect(width / 2 - boxWidth / 2, height / 2 - boxHeight / 2, boxWidth, boxHeight, 10);
    
    const message = this.add.text(width / 2, height / 2, text, {
      font: '20px Crimson Text, Georgia, serif',
      fill: '#F5E6D3',
      align: 'center',
      lineSpacing: 10
    });
    message.setOrigin(0.5, 0.5);

    const closeHandler = () => {
      bg.destroy();
      message.destroy();
      this.input.keyboard.off('keydown', closeHandler);
    };
    this.input.keyboard.on('keydown', closeHandler);
    this.time.delayedCall(4000, closeHandler);
  }

  playTitleMusic() {
    if (this.cache.audio.exists('music-main')) {
      if (!this.titleMusic || !this.titleMusic.isPlaying) {
        this.titleMusic = this.sound.add('music-main', { loop: true, volume: 0.4 });
        this.titleMusic.play();
      }
    }
  }

  shutdown() {
    if (this.titleMusic) {
      this.titleMusic.stop();
    }
  }
}
