/**
 * Boot Scene - Asset Loading
 *
 * Loads all game assets and initializes base systems.
 * Refactored for React+Phaser hybrid architecture.
 */

import Phaser from 'phaser';
import runtimeAssetManifest from '../../data/runtime-asset-manifest.json';
import type { TileVariantManifest } from '../core/tileVariants';
import { ITEM_DEFINITIONS } from '../../stores/inventoryStore';
import { anyLocationUsesIsometric, getLocation, LOCATION_IDS } from '../core/LocationData';

const CHARACTER_IDS = runtimeAssetManifest.characters.named as readonly string[];
const CROWD_IDS = runtimeAssetManifest.crowd.sprites as readonly string[];
const BASE_MAP_IDS = runtimeAssetManifest.maps.base as readonly string[];
const ISO_MAP_IDS = runtimeAssetManifest.maps.isometric as readonly string[];
const BASE_TILE_IDS = runtimeAssetManifest.tiles.base as readonly string[];
const ISO_TILE_IDS = runtimeAssetManifest.tiles.isometric as readonly string[];
const TILE_VARIANTS = runtimeAssetManifest.tileVariants as TileVariantManifest;
const STATIC_OBJECT_IDS = runtimeAssetManifest.objects.static as readonly string[];
const ITEM_ICON_IDS = Object.keys(ITEM_DEFINITIONS);

/**
 * True only if at least one location's plate.runtimeMode is 'isometric'.
 * Every location currently ships as 'legacy-backdrop' (a painted plate with
 * Y-sorted sprites composited on top), so the isometric tilemaps and their
 * ~60 tile textures are dead weight at boot and are skipped.
 */
const ISO_ASSETS_NEEDED = anyLocationUsesIsometric();

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

    // Loading text — display face per docs/design/typography-standard.md
    // ("Applying this to Phaser"): legal size, hard 1-glyph-pixel shadow.
    this.loadingText = this.add.text(width / 2, height / 2 - 40, 'Loading...', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '24px',
      color: '#F0D498',
      shadow: { offsetX: 3, offsetY: 3, color: '#24101C', blur: 0, fill: true },
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

    // Category label only — raw asset keys ("sfx-wind-hilltop") are not
    // player-facing copy.
    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      const kind = file.type === 'audio' ? 'sounds'
        : file.type === 'image' || file.type === 'spritesheet' ? 'artwork'
        : 'the city';
      this.loadingText.setText(`Loading ${kind}...`);
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

    // Isometric tilemaps are only needed when a location actually runs in
    // isometric mode. Every shipping location is 'legacy-backdrop', so this
    // skips 5 tilemap JSONs on boot. Flip a location's plate.runtimeMode to
    // 'isometric' in its .location.json and these load again automatically.
    if (!ISO_ASSETS_NEEDED) return;

    ISO_MAP_IDS.forEach((mapKey) => {
      this.load.tilemapTiledJSON(`${mapKey}-iso`, `maps/${mapKey}-iso.json`);
    });
  }

  private loadTileSprites() {
    BASE_TILE_IDS.forEach((tile) => {
      this.load.image(tile, `sprites/tiles/${tile}.png`);
    });

    // Iso tile textures and their procedural variants are only consumed by
    // IsometricRenderer. Gated for the same reason as the iso tilemaps above —
    // together that is ~60 textures the legacy-backdrop build never draws.
    if (!ISO_ASSETS_NEEDED) return;

    ISO_TILE_IDS.forEach((tile) => {
      this.load.image(`${tile}-iso`, `sprites/tiles/iso/${tile}-iso.png`);
    });

    // Load procedurally-generated tile variants (6–8 per surface type)
    // Keys: "cobblestone-var-0" … "cobblestone-var-7", "fortress-var-0" … etc.
    Object.entries(TILE_VARIANTS).forEach(([prefix, count]) => {
      for (let i = 0; i < count; i++) {
        this.load.image(
          `${prefix}-var-${i}`,
          `sprites/tiles/${prefix}${i}.png`
        );
      }
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

    this.loadPlateCompanions();
  }

  /**
   * Walk masks and foreground occluders for plates composed by the Forge.
   *
   * Both are declared per-location in `<id>.location.json`, so this loads
   * exactly what exists — a location with no `plate.walkMask` and no
   * `overlays` (everything except rua-direita until Stage 4) loads nothing and
   * boots exactly as before.
   */
  private loadPlateCompanions() {
    LOCATION_IDS.forEach((id) => {
      const location = getLocation(id);
      if (!location) return;

      const maskKey = location.plate.walkMask;
      if (maskKey) this.load.image(maskKey, `scenes/masks/${maskKey}.png`);

      location.overlays.forEach((overlay) => {
        this.load.image(overlay.key, `scenes/overlays/${overlay.key}.png`);
        (['dawn', 'dusk', 'night'] as const).forEach((time) => {
          this.load.image(`${overlay.key}-${time}`, `scenes/overlays/${overlay.key}-${time}.png`);
        });
      });
    });
  }

  private loadAudio() {
    // Music tracks
    const music = ['music-main', 'music-market', 'music-church', 'music-waterfront', 'music-night', 'music-tension', 'music-fortress'];
    music.forEach((track) => {
      // Ogg only: there is no .wav on disk, and Vite's SPA fallback answers
      // missing paths with index.html + HTTP 200, which Phaser then feeds to
      // decodeAudioData ("Unable to decode audio data").
      this.load.audio(track, `audio/music/${track}.ogg`);
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
      // Location transition stings referenced by audio.transitionSound in
      // src/data/locations/*.location.json
      'sfx-gate-creak',
      'sfx-waves-crash',
      'sfx-crowd-murmur',
      'sfx-birds-tropical',
      'sfx-wind-hilltop',
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

    // Prop fallback is intentionally INVISIBLE in-game: an unresolved decorative
    // prop / world-item / lore sprite should silently vanish, never render as a
    // glaring placeholder box over the painted plate. (Characters stay visible
    // above so a missing NPC is still spottable.)
    const prop = this.add.graphics();
    prop.fillStyle(0x000000, 0);
    prop.fillRect(0, 0, 16, 16);
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
