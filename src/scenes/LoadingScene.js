/**
 * Location Transition Scene - Ultima VIII Style
 * 
 * Shows beautiful AI-generated scene artwork when traveling between locations.
 * Only appears for location-to-location transitions, NOT at game start.
 * 
 * Features:
 * - Full-screen location artwork
 * - Historical location information
 * - 5-second atmospheric pause
 */

import Phaser from 'phaser';

export default class LoadingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoadingScene' });
  }

  init(data) {
    this.targetMap = data.mapKey || 'rua-direita';
    this.fromMap = data.fromMap || null;
  }

  create() {
    const { width, height } = this.cameras.main;

    // === FULL SCREEN BACKGROUND ===
    this.createBackground(width, height);

    // === LOCATION INFO OVERLAY ===
    this.createOverlay(width, height);

    // === FADE IN ===
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // === TRANSITION TIMER ===
    // 5 seconds to appreciate the artwork
    this.time.delayedCall(5000, () => {
      this.transitionToGame();
    });
  }

  createBackground(width, height) {
    const locationData = this.getLocationData(this.targetMap);
    const sceneKey = `scene-${this.targetMap}`;

    // Try to load AI-generated scene
    if (this.textures.exists(sceneKey)) {
      const bgImage = this.add.image(width / 2, height / 2, sceneKey);
      
      // Scale to cover entire screen
      const scaleX = width / bgImage.width;
      const scaleY = height / bgImage.height;
      const scale = Math.max(scaleX, scaleY);
      bgImage.setScale(scale);

      // Subtle Ken Burns effect (slow zoom)
      this.tweens.add({
        targets: bgImage,
        scale: scale * 1.03,
        duration: 6000,
        ease: 'Linear'
      });
    } else {
      // Fallback: atmospheric colored background
      this.createFallbackBackground(width, height, locationData);
    }

    // Vignette effect for depth
    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 0);
    vignette.fillRect(0, 0, width, height);
    
    // Edge darkening
    const edgeOverlay = this.add.graphics();
    edgeOverlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0, 0, 0.6);
    edgeOverlay.fillRect(0, 0, width * 0.15, height);
    edgeOverlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.6, 0.6, 0);
    edgeOverlay.fillRect(width * 0.85, 0, width * 0.15, height);
  }

  createFallbackBackground(width, height, locationData) {
    const graphics = this.add.graphics();
    
    // Location-specific color schemes
    const colorSchemes = {
      'a-famosa-gate': { top: 0x4A6FA5, mid: 0x8B7355, bottom: 0x3D2817 },
      'rua-direita': { top: 0xE8B86D, mid: 0xA67B5B, bottom: 0x4A3728 },
      'st-pauls-church': { top: 0x87CEEB, mid: 0xE8DCC8, bottom: 0x5C8A4D },
      'waterfront': { top: 0xF4B41A, mid: 0x4A8BA8, bottom: 0x2A4A5A },
      'kampung': { top: 0xE8A83C, mid: 0x6B8E4E, bottom: 0x3D4A28 }
    };
    
    const scheme = colorSchemes[this.targetMap] || colorSchemes['rua-direita'];
    
    // Gradient background
    for (let y = 0; y < height; y++) {
      const ratio = y / height;
      let color;
      
      if (ratio < 0.4) {
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(scheme.top),
          Phaser.Display.Color.ValueToColor(scheme.mid),
          100, ratio / 0.4 * 100
        );
      } else {
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(scheme.mid),
          Phaser.Display.Color.ValueToColor(scheme.bottom),
          100, (ratio - 0.4) / 0.6 * 100
        );
      }
      
      graphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      graphics.fillRect(0, y, width, 1);
    }
  }

  createOverlay(width, height) {
    const locationData = this.getLocationData(this.targetMap);

    // Bottom info panel with gradient
    const panelHeight = 160;
    const panel = this.add.graphics();
    panel.fillGradientStyle(0x0A0806, 0x0A0806, 0x0A0806, 0x0A0806, 0, 0, 0.95, 0.95);
    panel.fillRect(0, height - panelHeight, width, panelHeight);

    // Top decorative line
    this.add.graphics()
      .lineStyle(2, 0xD4AF37, 0.8)
      .lineBetween(width * 0.1, height - panelHeight + 8, width * 0.9, height - panelHeight + 8);

    // Location name (large)
    const titleY = height - panelHeight + 18;
    
    this.add.text(width / 2, titleY + 2, locationData.name, {
      font: 'bold 28px Cinzel, Georgia, serif',
      fill: '#000000'
    }).setOrigin(0.5, 0).setAlpha(0.5);

    const titleText = this.add.text(width / 2, titleY, locationData.name, {
      font: 'bold 28px Cinzel, Georgia, serif',
      fill: '#F4E4C8'
    }).setOrigin(0.5, 0);
    titleText.setStroke('#8B0000', 2);

    // Portuguese subtitle
    this.add.text(width / 2, titleY + 35, locationData.portuguese, {
      font: 'italic 14px Crimson Text, Georgia, serif',
      fill: '#D4AF37'
    }).setOrigin(0.5, 0);

    // Decorative separator
    this.add.text(width / 2, titleY + 55, '❧ ❧ ❧', {
      font: '12px serif',
      fill: '#8B7355'
    }).setOrigin(0.5, 0);

    // Description (single line)
    this.add.text(width / 2, titleY + 75, locationData.description.replace('\n', ' '), {
      font: '12px Crimson Text, Georgia, serif',
      fill: '#B8A082',
      align: 'center',
      wordWrap: { width: width - 100 }
    }).setOrigin(0.5, 0);

    // Compass rose in corner
    this.createCompassRose(40, height - panelHeight - 30);

    // Year badge
    this.add.text(width - 20, height - panelHeight + 15, '1580', {
      font: 'bold 12px Cinzel, serif',
      fill: '#D4AF37'
    }).setOrigin(1, 0);

    // Animated loading dots
    this.createLoadingIndicator(width / 2, height - 12);

    // Fade in text elements
    this.fadeInElements(titleText);
  }

  createCompassRose(x, y) {
    const dirs = [
      { label: 'N', angle: -90 },
      { label: 'E', angle: 0 },
      { label: 'S', angle: 90 },
      { label: 'W', angle: 180 }
    ];

    dirs.forEach(d => {
      const rad = d.angle * Math.PI / 180;
      const px = x + Math.cos(rad) * 25;
      const py = y + Math.sin(rad) * 25;
      this.add.text(px, py, d.label, {
        font: '10px Cinzel, serif',
        fill: '#8B7355'
      }).setOrigin(0.5, 0.5);
    });

    const center = this.add.text(x, y, '✦', {
      font: '16px serif',
      fill: '#D4AF37'
    }).setOrigin(0.5, 0.5);

    this.tweens.add({
      targets: center,
      angle: 360,
      duration: 15000,
      repeat: -1,
      ease: 'Linear'
    });
  }

  createLoadingIndicator(x, y) {
    // Just a subtle "preparing" text, not intrusive
    const text = this.add.text(x, y, '', {
      font: '10px Crimson Text, serif',
      fill: '#5C4033'
    }).setOrigin(0.5, 0.5);

    let dots = '';
    this.time.addEvent({
      delay: 500,
      callback: () => {
        dots = dots.length >= 3 ? '' : dots + '·';
        text.setText(`Preparing your journey${dots}`);
      },
      loop: true
    });
  }

  fadeInElements(titleText) {
    titleText.setAlpha(0);
    this.tweens.add({
      targets: titleText,
      alpha: 1,
      y: titleText.y - 10,
      duration: 800,
      delay: 300,
      ease: 'Power2'
    });
  }

  getLocationData(mapKey) {
    const locations = {
      'a-famosa-gate': {
        name: 'A Famosa Fortress',
        portuguese: 'Porta de Santiago',
        description: 'The imposing stone gateway of the Portuguese fortress.\nGuards in morion helmets watch all who pass beneath the crowned archway.',
        quote: 'Who holds Melaka has his hands on the throat of Venice.',
        quoteAuthor: '— Tomé Pires, Suma Oriental'
      },
      'rua-direita': {
        name: 'Rua Direita',
        portuguese: 'The Main Street',
        description: 'The bustling commercial heart of colonial Melaka.\nMerchants hawk spices, silk, and porcelain beneath colorful awnings.',
        quote: 'A city of such great trade that its equal cannot be found.',
        quoteAuthor: '— Fernão Mendes Pinto'
      },
      'st-pauls-church': {
        name: "St. Paul's Church",
        portuguese: 'Igreja de Nossa Senhora',
        description: 'The whitewashed church atop the hill overlooks the strait.\nPadre Tomás tends to his flock and offers counsel to troubled souls.',
        quote: 'In Melaka I found both gold and souls for God.',
        quoteAuthor: '— St. Francis Xavier'
      },
      'waterfront': {
        name: 'The Waterfront',
        portuguese: 'O Cais',
        description: 'Ships from Arabia, India, and China crowd the busy harbor.\nThe smell of salt, tar, and exotic spices fills the humid air.',
        quote: 'The ships seem like a forest of masts.',
        quoteAuthor: '— Anonymous Portuguese Sailor'
      },
      'kampung': {
        name: 'Kampung Quarter',
        portuguese: 'Bairro Malaio',
        description: 'Traditional Malay houses on stilts nestle among palm trees.\nThe sound of gamelan music drifts through the tropical evening.',
        quote: 'Here live the true people of this land.',
        quoteAuthor: '— Malay Proverb'
      }
    };

    return locations[mapKey] || locations['rua-direita'];
  }

  transitionToGame() {
    this.cameras.main.fadeOut(800, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { mapKey: this.targetMap });
    });
  }
}
