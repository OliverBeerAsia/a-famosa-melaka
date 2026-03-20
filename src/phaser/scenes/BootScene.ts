/**
 * Boot Scene - Asset Loading
 *
 * Loads all game assets and initializes base systems.
 * Refactored for React+Phaser hybrid architecture.
 */

import Phaser from 'phaser';

const CHARACTER_IDS = [
  'player',
  'fernao-gomes',
  'capitao-rodrigues',
  'padre-tomas',
  'aminah',
  'chen-wei',
  'rashid',
  'siti',
  'alvares',
  'mak-enang',
] as const;

export class BootScene extends Phaser.Scene {
  private loadingText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.createLoadingUI();
    this.loadAssets();
  }

  private createLoadingUI() {
    const { width, height } = this.cameras.main;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0806);

    // Loading text
    this.loadingText = this.add.text(width / 2, height / 2 - 40, 'Loading...', {
      font: '24px Cinzel, Georgia, serif',
      color: '#D4AF37',
    });
    this.loadingText.setOrigin(0.5);

    // Progress bar background
    this.add.rectangle(width / 2, height / 2, 400, 20, 0x2A1A0A);

    // Progress bar
    this.progressBar = this.add.graphics();

    // Progress events
    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0xD4AF37, 1);
      this.progressBar.fillRect(width / 2 - 198, height / 2 - 8, 396 * value, 16);
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      this.loadingText.setText(`Loading: ${file.key}`);
    });
  }

  private loadAssets() {
    // Character sprites
    this.loadCharacterSprites();

    // Tiled maps for the eventual isometric rebuild
    this.loadTilemaps();

    // Tile sprites
    this.loadTileSprites();

    // Object sprites
    this.loadObjectSprites();

    // Scene backgrounds
    this.loadSceneBackgrounds();

    // Portraits
    this.loadPortraits();

    // Audio
    this.loadAudio();
  }

  private loadCharacterSprites() {
    CHARACTER_IDS.forEach((char) => {
      this.load.image(char, `sprites/characters/${char}.png`);
      this.load.spritesheet(`${char}-sheet`, `sprites/characters/${char}-sheet.png`, {
        frameWidth: 16,
        frameHeight: 32,
      });
    });

    // Fallback texture for any dynamically-added NPC without a dedicated sprite.
    this.load.image('npc', 'sprites/characters/npc.png');

    // Crowd atmosphere sprites
    const crowdTypes = ['portuguese', 'malay', 'chinese', 'arab', 'indian'];
    crowdTypes.forEach((type) => {
      this.load.image(`crowd-${type}`, `sprites/crowd/${type}.png`);
    });
  }

  private loadTilemaps() {
    const maps = [
      'melaka-demo',
      'a-famosa-gate',
      'rua-direita',
      'st-pauls-church',
      'waterfront',
      'kampung',
    ];

    maps.forEach((mapKey) => {
      this.load.tilemapTiledJSON(mapKey, `maps/${mapKey}.json`);
    });

    // Isometric map variants
    const isoMaps = ['a-famosa-gate', 'rua-direita', 'st-pauls-church', 'waterfront', 'kampung'];
    isoMaps.forEach((mapKey) => {
      this.load.tilemapTiledJSON(`${mapKey}-iso`, `maps/${mapKey}-iso.json`);
    });
  }

  private loadTileSprites() {
    const tiles = [
      'fortress-stone', 'wall-white', 'roof-terracotta', 'cobblestone', 'door-wood',
      'church-stone', 'church-floor', 'dock-wood', 'water-tile', 'dirt-path',
      'bamboo-floor', 'thatch-roof', 'grass-tropical', 'sand-beach',
    ];

    tiles.forEach((tile) => {
      this.load.image(tile, `sprites/tiles/${tile}.png`);
    });

    // Isometric tile sprite variants (64×32 diamond tiles)
    const isoTiles = [
      'fortress-stone', 'grass', 'cobblestone', 'wall-white',
      'dirt-path', 'bamboo-floor', 'thatch-roof',
      'church-stone', 'church-floor',
      'water-tile', 'dock-wood', 'roof-terracotta', 'door-wood',
    ];
    isoTiles.forEach((tile) => {
      this.load.image(`${tile}-iso`, `sprites/tiles/iso/${tile}-iso.png`);
    });
  }

  private loadObjectSprites() {
    const objects = [
      'palm-tree', 'bush', 'flowers', 'banana-tree', 'coconut',
      'barrel', 'pottery', 'crate', 'sack', 'amphora',
      'market-stall', 'market-stall-2', 'lantern', 'tavern-sign',
      'stone-cross', 'gravestone', 'arched-window', 'wooden-pew', 'altar', 'bell',
      'rope-coil', 'ship-mast', 'cargo-crate', 'fishing-net', 'anchor', 'dhow-sail',
      'hanging-cloth', 'woven-mat', 'cooking-fire', 'cannon',
      'balance-scale', 'betel-nut-tray', 'rice-mortar', 'fish-trap', 'prayer-mat',
      'porcelain', 'moored-sampan', 'hanging-oil-lantern', 'drying-fish-rack', 'laundry-line',
    ];

    objects.forEach((obj) => {
      // Try both regular and ai-objects folders
      this.load.image(obj, `sprites/objects/${obj}.png`);
    });

    // Animated object sprite sheets
    this.load.spritesheet('torch-flame', 'sprites/objects/torch-flame-sheet.png', { frameWidth: 8, frameHeight: 16 });
    this.load.spritesheet('palm-frond', 'sprites/objects/palm-frond-sheet.png', { frameWidth: 16, frameHeight: 48 });
    this.load.spritesheet('awning-flutter', 'sprites/objects/awning-flutter-sheet.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('smoke-column', 'sprites/objects/smoke-sheet.png', { frameWidth: 8, frameHeight: 16 });
    this.load.spritesheet('seagull', 'sprites/objects/seagull-sheet.png', { frameWidth: 16, frameHeight: 8 });
    this.load.spritesheet('flag-wave', 'sprites/objects/flag-sheet.png', { frameWidth: 16, frameHeight: 16 });
  }

  private loadSceneBackgrounds() {
    // Base day scenes - map internal keys to actual filenames
    const sceneMapping: Record<string, string> = {
      'scene-a-famosa-gate': 'scenes/scene-a-famosa.png',
      'scene-rua-direita': 'scenes/scene-rua-direita.png',
      'scene-st-pauls-church': 'scenes/scene-st-pauls.png',
      'scene-waterfront': 'scenes/scene-waterfront.png',
      'scene-kampung': 'scenes/scene-kampung.png',
      'title-background': 'scenes/opening-screen.png',
    };

    Object.entries(sceneMapping).forEach(([key, path]) => {
      this.load.image(key, path);
    });

    // Time-of-day scene variants (when generated)
    const locations = ['a-famosa', 'rua-direita', 'st-pauls', 'waterfront', 'kampung'];
    const times = ['dawn', 'dusk', 'night'];

    locations.forEach((location) => {
      times.forEach((time) => {
        const key = `scene-${location}-${time}`;
        this.load.image(key, `scenes/${key}.png`);
      });
    });
  }

  private loadPortraits() {
    CHARACTER_IDS.forEach((portrait) => {
      // Load high-quality portraits (256×256)
      this.load.image(`portrait-${portrait}`, `sprites/portraits/${portrait}.png`);
    });
  }

  private loadAudio() {
    // Music tracks
    const music = ['music-main', 'music-market', 'music-church', 'music-waterfront', 'music-night', 'music-tension', 'music-fortress'];
    music.forEach((track) => {
      this.load.audio(track, [`audio/music/${track}.ogg`, `audio/music/${track}.wav`]);
    });

    // Ambient sounds
    const ambient = [
      'base-tropical', 'fortress-ambience', 'distant-city', 'market-crowd',
      'street-life', 'church-bells', 'sacred-calm', 'water-lapping',
      'harbor-activity', 'seagulls', 'village-life', 'jungle-sounds',
      'morning-birds', 'night-insects', 'cricket-chorus', 'evening-calls',
    ];
    ambient.forEach((sound) => {
      this.load.audio(sound, `audio/sfx/${sound}.wav`);
    });

    // Sound effects
    const sfx = [
      'sfx-menu-select',
      'sfx-dialogue-blip',
      'sfx-item-pickup',
      'sfx-door-open',
      'sfx-footstep-stone',
      'sfx-footstep-wood',
      'sfx-footstep-dirt',
      'sfx-coin-clink',
    ];
    sfx.forEach((sound) => {
      this.load.audio(sound, `audio/sfx/${sound}.wav`);
    });
  }

  create() {
    // Create animations
    this.createAnimations();

    // Create animated object animations
    this.createAnimatedObjectAnims();

    // Create particle textures
    this.createParticleTexture();

    // Start game scene
    this.scene.start('GameScene');
  }

  private createAnimations() {
    const directions = ['down', 'left', 'right', 'up'];
    const frameRows = [0, 1, 2, 3];
    const framesPerRow = 4;

    CHARACTER_IDS.forEach((character) => {
      const sheetKey = `${character}-sheet`;
      if (!this.textures.exists(sheetKey)) return;

      directions.forEach((dir, index) => {
        const row = frameRows[index];
        const startFrame = row * framesPerRow;

        const walkKey = character === 'player' ? `walk-${dir}` : `${character}-walk-${dir}`;
        const idleKey = character === 'player' ? `idle-${dir}` : `${character}-idle-${dir}`;
        const talkKey = `${character}-talk-${dir}`;

        if (!this.anims.exists(walkKey)) {
          this.anims.create({
            key: walkKey,
            frames: this.anims.generateFrameNumbers(sheetKey, {
              start: startFrame,
              end: startFrame + 3,
            }),
            frameRate: 8,
            repeat: -1,
          });
        }

        if (!this.anims.exists(idleKey)) {
          this.anims.create({
            key: idleKey,
            frames: [
              { key: sheetKey, frame: startFrame },
              { key: sheetKey, frame: startFrame + 2 },
            ],
            frameRate: 2,
            repeat: -1,
          });
        }

        if (!this.anims.exists(talkKey)) {
          this.anims.create({
            key: talkKey,
            frames: [
              { key: sheetKey, frame: startFrame + 1 },
              { key: sheetKey, frame: startFrame + 3 },
            ],
            frameRate: 5,
            repeat: -1,
          });
        }
      });
    });
  }

  private createAnimatedObjectAnims() {
    if (this.textures.exists('torch-flame')) {
      this.anims.create({ key: 'torch-flicker', frames: this.anims.generateFrameNumbers('torch-flame', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    }
    if (this.textures.exists('palm-frond')) {
      this.anims.create({ key: 'palm-sway', frames: this.anims.generateFrameNumbers('palm-frond', { start: 0, end: 2 }), frameRate: 2, repeat: -1, yoyo: true });
    }
    if (this.textures.exists('awning-flutter')) {
      this.anims.create({ key: 'awning-flutter-anim', frames: this.anims.generateFrameNumbers('awning-flutter', { start: 0, end: 2 }), frameRate: 3, repeat: -1, yoyo: true });
    }
    if (this.textures.exists('smoke-column')) {
      this.anims.create({ key: 'smoke-rise', frames: this.anims.generateFrameNumbers('smoke-column', { start: 0, end: 3 }), frameRate: 4, repeat: -1 });
    }
    if (this.textures.exists('seagull')) {
      this.anims.create({ key: 'seagull-fly', frames: this.anims.generateFrameNumbers('seagull', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
    }
    if (this.textures.exists('flag-wave')) {
      this.anims.create({ key: 'flag-flutter', frames: this.anims.generateFrameNumbers('flag-wave', { start: 0, end: 2 }), frameRate: 4, repeat: -1, yoyo: true });
    }
  }

  private createParticleTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('particle', 8, 8);
    graphics.destroy();
  }
}
