/**
 * Boot Scene - Asset Loading
 *
 * Loads all game assets and initializes base systems.
 * Refactored for React+Phaser hybrid architecture.
 */

import Phaser from 'phaser';
import runtimeAssetManifest from '../../data/runtime-asset-manifest.json';
import { ITEM_DEFINITIONS } from '../../stores/inventoryStore';

const CHARACTER_IDS = runtimeAssetManifest.characters.named as readonly string[];
const CROWD_IDS = runtimeAssetManifest.crowd.sprites as readonly string[];
const BASE_MAP_IDS = runtimeAssetManifest.maps.base as readonly string[];
const ISO_MAP_IDS = runtimeAssetManifest.maps.isometric as readonly string[];
const BASE_TILE_IDS = runtimeAssetManifest.tiles.base as readonly string[];
const ISO_TILE_IDS = runtimeAssetManifest.tiles.isometric as readonly string[];
const STATIC_OBJECT_IDS = runtimeAssetManifest.objects.static as readonly string[];
const ITEM_ICON_IDS = Object.keys(ITEM_DEFINITIONS);

const ANIMATED_OBJECT_SHEETS = [
  { key: 'torch-flame', file: 'torch-flame-sheet.png', frameWidth: 8, frameHeight: 16 },
  { key: 'palm-frond', file: 'palm-frond-sheet.png', frameWidth: 16, frameHeight: 48 },
  { key: 'awning-flutter', file: 'awning-flutter-sheet.png', frameWidth: 16, frameHeight: 16 },
  { key: 'smoke-column', file: 'smoke-sheet.png', frameWidth: 8, frameHeight: 16 },
  { key: 'seagull', file: 'seagull-sheet.png', frameWidth: 16, frameHeight: 8 },
  { key: 'flag-wave', file: 'flag-sheet.png', frameWidth: 16, frameHeight: 16 },
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

    // Audio
    this.loadAudio();
  }

  private loadCharacterSprites() {
    CHARACTER_IDS.forEach((char) => {
      this.load.spritesheet(`${char}-sheet`, `sprites/characters/${char}-sheet.png`, {
        frameWidth: 16,
        frameHeight: 32,
      });
    });

    CROWD_IDS.forEach((type) => {
      this.load.image(`crowd-${type}`, `sprites/crowd/${type}.png`);
    });
  }

  private loadTilemaps() {
    BASE_MAP_IDS.forEach((mapKey) => {
      this.load.tilemapTiledJSON(mapKey, `maps/${mapKey}.json`);
    });

    ISO_MAP_IDS.forEach((mapKey) => {
      this.load.tilemapTiledJSON(`${mapKey}-iso`, `maps/${mapKey}-iso.json`);
    });
  }

  private loadTileSprites() {
    BASE_TILE_IDS.forEach((tile) => {
      this.load.image(tile, `sprites/tiles/${tile}.png`);
    });

    ISO_TILE_IDS.forEach((tile) => {
      this.load.image(`${tile}-iso`, `sprites/tiles/iso/${tile}-iso.png`);
    });
  }

  private loadObjectSprites() {
    STATIC_OBJECT_IDS.forEach((obj) => {
      this.load.image(obj, `sprites/objects/${obj}.png`);
    });

    ITEM_ICON_IDS.forEach((itemId) => {
      this.load.image(`item-${itemId}`, `sprites/ui/items/${itemId}.png`);
    });

    ANIMATED_OBJECT_SHEETS.forEach((sheet) => {
      this.load.spritesheet(sheet.key, `sprites/objects/${sheet.file}`, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    });
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
    this.createDebugTextures();
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
    const directions = ['down', 'left', 'right', 'up'] as const;
    const framesPerRow = runtimeAssetManifest.characters.sheet.columns;
    const idleRow = 4;
    const talkRow = 5;

    CHARACTER_IDS.forEach((character) => {
      const sheetKey = `${character}-sheet`;
      if (!this.textures.exists(sheetKey)) return;

      directions.forEach((dir, index) => {
        const walkStartFrame = index * framesPerRow;
        const idleFrame = (idleRow * framesPerRow) + index;
        const talkFrame = (talkRow * framesPerRow) + index;

        const walkKey = character === 'player' ? `walk-${dir}` : `${character}-walk-${dir}`;
        const idleKey = character === 'player' ? `idle-${dir}` : `${character}-idle-${dir}`;
        const talkKey = `${character}-talk-${dir}`;

        if (!this.anims.exists(walkKey)) {
          this.anims.create({
            key: walkKey,
            frames: this.anims.generateFrameNumbers(sheetKey, {
              start: walkStartFrame,
              end: walkStartFrame + 3,
            }),
            frameRate: 8,
            repeat: -1,
          });
        }

        if (!this.anims.exists(idleKey)) {
          this.anims.create({
            key: idleKey,
            frames: [{ key: sheetKey, frame: idleFrame }],
            frameRate: 1,
          });
        }

        if (!this.anims.exists(talkKey)) {
          this.anims.create({
            key: talkKey,
            frames: [{ key: sheetKey, frame: talkFrame }],
            frameRate: 1,
            repeat: -1,
          });
        }
      });
    });
  }

  private createDebugTextures() {
    const character = this.add.graphics();
    character.fillStyle(0x5a1136, 1);
    character.fillRect(0, 0, 16, 32);
    character.lineStyle(2, 0xf7d354, 1);
    character.strokeRect(1, 1, 14, 30);
    character.lineBetween(2, 2, 14, 30);
    character.lineBetween(14, 2, 2, 30);
    character.generateTexture('debug-character-missing', 16, 32);
    character.destroy();

    const prop = this.add.graphics();
    prop.fillStyle(0x27314f, 1);
    prop.fillRect(0, 0, 16, 16);
    prop.lineStyle(2, 0xf7d354, 1);
    prop.strokeRect(1, 1, 14, 14);
    prop.lineBetween(2, 2, 14, 14);
    prop.lineBetween(14, 2, 2, 14);
    prop.generateTexture('debug-prop-missing', 16, 16);
    prop.destroy();
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
