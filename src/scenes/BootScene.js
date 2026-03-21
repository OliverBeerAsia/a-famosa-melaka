/**
 * Boot Scene
 *
 * Handles initial asset loading:
 * - Sprites (player, NPCs, tiles, objects)
 * - Tilemaps from Tiled JSON
 * - Audio (music and sound effects)
 *
 * Shows a simple loading screen while assets load
 */

import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Create loading bar
    this.createLoadingBar();

    // Load sprite assets
    this.loadSprites();

    // Load scene backgrounds (AI-generated Ultima VIII style)
    this.loadScenes();

    // Load tilemap
    this.loadTilemap();

    // Load game data
    this.loadData();

    // Load audio assets
    this.loadAudio();
  }

  loadAudio() {
    // Set up error handling for audio files - gracefully handle failures
    this.load.on('loaderror', (file) => {
      console.warn(`Failed to load audio: ${file.key} - game will continue without this audio`);
    });

    // Music tracks (WAV format for reliable browser decoding)
    this.load.audio('music-main', 'assets/audio/music/music-main.wav');
    this.load.audio('music-market', 'assets/audio/music/music-market.wav');
    this.load.audio('music-church', 'assets/audio/music/music-church.wav');
    this.load.audio('music-waterfront', 'assets/audio/music/music-waterfront.wav');
    this.load.audio('music-night', 'assets/audio/music/music-night.wav');
    this.load.audio('music-tension', 'assets/audio/music/music-tension.wav');
    this.load.audio('music-fortress', 'assets/audio/music/music-fortress.wav');

    // Ambient sound layers
    this.load.audio('base-tropical', 'assets/audio/sfx/base-tropical.wav');
    this.load.audio('fortress-ambience', 'assets/audio/sfx/fortress-ambience.wav');
    this.load.audio('distant-city', 'assets/audio/sfx/distant-city.wav');
    this.load.audio('market-crowd', 'assets/audio/sfx/market-crowd.wav');
    this.load.audio('street-life', 'assets/audio/sfx/street-life.wav');
    this.load.audio('church-bells', 'assets/audio/sfx/church-bells.wav');
    this.load.audio('sacred-calm', 'assets/audio/sfx/sacred-calm.wav');
    this.load.audio('water-lapping', 'assets/audio/sfx/water-lapping.wav');
    this.load.audio('harbor-activity', 'assets/audio/sfx/harbor-activity.wav');
    this.load.audio('seagulls', 'assets/audio/sfx/seagulls.wav');
    this.load.audio('village-life', 'assets/audio/sfx/village-life.wav');
    this.load.audio('jungle-sounds', 'assets/audio/sfx/jungle-sounds.wav');
    this.load.audio('morning-birds', 'assets/audio/sfx/morning-birds.wav');
    this.load.audio('night-insects', 'assets/audio/sfx/night-insects.wav');
    this.load.audio('cricket-chorus', 'assets/audio/sfx/cricket-chorus.wav');
    this.load.audio('evening-calls', 'assets/audio/sfx/evening-calls.wav');

    // Sound effects
    this.load.audio('sfx-menu-select', 'assets/audio/sfx/sfx-menu-select.wav');
    this.load.audio('sfx-dialogue-blip', 'assets/audio/sfx/sfx-dialogue-blip.wav');
    this.load.audio('sfx-item-pickup', 'assets/audio/sfx/sfx-item-pickup.wav');
    this.load.audio('sfx-door-open', 'assets/audio/sfx/sfx-door-open.wav');
    this.load.audio('sfx-footstep-stone', 'assets/audio/sfx/sfx-footstep-stone.wav');
    this.load.audio('sfx-footstep-wood', 'assets/audio/sfx/sfx-footstep-wood.wav');
    this.load.audio('sfx-footstep-dirt', 'assets/audio/sfx/sfx-footstep-dirt.wav');
    this.load.audio('sfx-coin-clink', 'assets/audio/sfx/sfx-coin-clink.wav');
  }

  createLoadingBar() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Loading text
    const loadingText = this.add.text(width / 2, height / 2 - 20, 'Loading...', {
      font: '16px monospace',
      fill: '#ffffff'
    });
    loadingText.setOrigin(0.5, 0.5);

    // Progress bar background
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 80, height / 2, 160, 20);

    // Update progress bar as assets load
    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(width / 2 - 78, height / 2 + 2, 156 * value, 16);
    });

    // Clean up loading bar when complete
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }

  loadSprites() {
    // Character sprites (single frame for static display)
    this.load.image('player', 'assets/sprites/characters/player.png');
    this.load.image('npc', 'assets/sprites/characters/npc.png');

    // Player sprite sheet for animations
    this.load.spritesheet('player-sheet', 'assets/sprites/characters/player-sheet.png', {
      frameWidth: 16,
      frameHeight: 32
    });

    // NPC sprites (6 demo characters) - single frame
    this.load.image('fernao-gomes', 'assets/sprites/characters/fernao-gomes.png');
    this.load.image('capitao-rodrigues', 'assets/sprites/characters/capitao-rodrigues.png');
    this.load.image('padre-tomas', 'assets/sprites/characters/padre-tomas.png');
    this.load.image('aminah', 'assets/sprites/characters/aminah.png');
    this.load.image('chen-wei', 'assets/sprites/characters/chen-wei.png');
    this.load.image('rashid', 'assets/sprites/characters/rashid.png');

    // NPC sprite sheets for animations
    this.load.spritesheet('fernao-gomes-sheet', 'assets/sprites/characters/fernao-gomes-sheet.png', {
      frameWidth: 16, frameHeight: 32
    });
    this.load.spritesheet('capitao-rodrigues-sheet', 'assets/sprites/characters/capitao-rodrigues-sheet.png', {
      frameWidth: 16, frameHeight: 32
    });
    this.load.spritesheet('padre-tomas-sheet', 'assets/sprites/characters/padre-tomas-sheet.png', {
      frameWidth: 16, frameHeight: 32
    });
    this.load.spritesheet('aminah-sheet', 'assets/sprites/characters/aminah-sheet.png', {
      frameWidth: 16, frameHeight: 32
    });
    this.load.spritesheet('chen-wei-sheet', 'assets/sprites/characters/chen-wei-sheet.png', {
      frameWidth: 16, frameHeight: 32
    });
    this.load.spritesheet('rashid-sheet', 'assets/sprites/characters/rashid-sheet.png', {
      frameWidth: 16, frameHeight: 32
    });

    // Tile sprites (for tilemap)
    this.load.image('ground', 'assets/sprites/tiles/ground.png');
    this.load.image('grass', 'assets/sprites/tiles/grass.png');
    this.load.image('water', 'assets/sprites/tiles/water.png');
    this.load.image('stone', 'assets/sprites/tiles/stone.png');

    // New atmospheric tiles
    this.load.image('wall-white', 'assets/sprites/tiles/wall-white.png');
    this.load.image('roof-terracotta', 'assets/sprites/tiles/roof-terracotta.png');
    this.load.image('fortress-stone', 'assets/sprites/tiles/fortress-stone.png');
    this.load.image('cobblestone', 'assets/sprites/tiles/cobblestone.png');
    this.load.image('door-wood', 'assets/sprites/tiles/door-wood.png');

    // Church tiles
    this.load.image('church-stone', 'assets/sprites/tiles/church-stone.png');
    this.load.image('church-floor', 'assets/sprites/tiles/church-floor.png');

    // Waterfront tiles
    this.load.image('dock-wood', 'assets/sprites/tiles/dock-wood.png');
    this.load.image('water-tile', 'assets/sprites/tiles/water-tile.png');

    // Kampung tiles
    this.load.image('dirt-path', 'assets/sprites/tiles/dirt-path.png');
    this.load.image('bamboo-floor', 'assets/sprites/tiles/bamboo-floor.png');
    this.load.image('thatch-roof', 'assets/sprites/tiles/thatch-roof.png');

    // Environmental objects
    this.load.image('palm-tree', 'assets/sprites/objects/palm-tree.png');
    this.load.image('bush', 'assets/sprites/objects/bush.png');
    this.load.image('flowers', 'assets/sprites/objects/flowers.png');
    this.load.image('barrel', 'assets/sprites/objects/barrel.png');
    this.load.image('awning', 'assets/sprites/objects/awning.png');
    this.load.image('crate', 'assets/sprites/objects/crate.png');
    this.load.image('pottery', 'assets/sprites/objects/pottery.png');

    // Market objects
    this.load.image('market-stall-1', 'assets/sprites/objects/market-stall-1.png');
    this.load.image('market-stall-2', 'assets/sprites/objects/market-stall-2.png');
    this.load.image('lantern', 'assets/sprites/objects/lantern.png');
    this.load.image('sack', 'assets/sprites/objects/sack.png');
    this.load.image('amphora', 'assets/sprites/objects/amphora.png');
    this.load.image('tavern-sign', 'assets/sprites/objects/tavern-sign.png');
    this.load.image('hanging-cloth', 'assets/sprites/objects/hanging-cloth.png');
    this.load.image('spice-pile', 'assets/sprites/objects/spice-pile.png');

    // Church objects
    this.load.image('stone-cross', 'assets/sprites/objects/stone-cross.png');
    this.load.image('gravestone', 'assets/sprites/objects/gravestone.png');
    this.load.image('arched-window', 'assets/sprites/objects/arched-window.png');
    this.load.image('wooden-pew', 'assets/sprites/objects/wooden-pew.png');
    this.load.image('altar', 'assets/sprites/objects/altar.png');
    this.load.image('bell', 'assets/sprites/objects/bell.png');

    // Waterfront objects
    this.load.image('rope-coil', 'assets/sprites/objects/rope-coil.png');
    this.load.image('ship-mast', 'assets/sprites/objects/ship-mast.png');
    this.load.image('cargo-crate', 'assets/sprites/objects/cargo-crate.png');
    this.load.image('fishing-net', 'assets/sprites/objects/fishing-net.png');
    this.load.image('anchor', 'assets/sprites/objects/anchor.png');
    this.load.image('maritime-barrel', 'assets/sprites/objects/maritime-barrel.png');
    this.load.image('dhow-sail', 'assets/sprites/objects/dhow-sail.png');

    // Kampung objects
    this.load.image('banana-tree', 'assets/sprites/objects/banana-tree.png');
    this.load.image('water-well', 'assets/sprites/objects/water-well.png');
    this.load.image('woven-mat', 'assets/sprites/objects/woven-mat.png');
    this.load.image('cooking-fire', 'assets/sprites/objects/cooking-fire.png');
    this.load.image('bamboo-fence', 'assets/sprites/objects/bamboo-fence.png');
    this.load.image('coconut', 'assets/sprites/objects/coconut.png');
  }

  loadScenes() {
    // AI-generated Ultima VIII style scene backgrounds
    // Opening/title screen
    this.load.image('opening-screen', 'assets/scenes/opening-screen.png');

    // Location transition scenes with time-of-day variants
    const locations = ['a-famosa', 'rua-direita', 'st-pauls', 'waterfront', 'kampung'];
    const times = ['', '-dawn', '-dusk', '-night'];

    locations.forEach(loc => {
      times.forEach(time => {
        const key = `scene-${loc}${time}`;
        const path = `assets/scenes/scene-${loc}${time === '' ? '' : time}.png`;
        this.load.image(key, path);
      });
    });

    // Specific key mapping for convenience (legacy support)
    this.load.image('scene-a-famosa-gate', 'assets/scenes/scene-a-famosa.png');
    this.load.image('scene-st-pauls-church', 'assets/scenes/scene-st-pauls.png');
  }

  loadTilemap() {
    // Load comprehensive tilesets
    this.load.image('portuguese-streets', 'assets/tilesets/Portuguese Colonial Streets tileset one.jpeg');
    this.load.image('master-tileset', 'assets/tilesets/master tileset.jpeg');

    // Load tilemap JSON from Tiled
    this.load.tilemapTiledJSON('melaka-demo', 'assets/maps/melaka-demo.json');
    this.load.tilemapTiledJSON('a-famosa-gate', 'assets/maps/a-famosa-gate.json');
    this.load.tilemapTiledJSON('rua-direita', 'assets/maps/rua-direita.json');
    this.load.tilemapTiledJSON('st-pauls-church', 'assets/maps/st-pauls-church.json');
    this.load.tilemapTiledJSON('waterfront', 'assets/maps/waterfront.json');
    this.load.tilemapTiledJSON('kampung', 'assets/maps/kampung.json');
  }

  loadData() {
    // Load NPC data
    this.load.json('npc-data', 'assets/data/npcs.json');

    // Load item/world objects data
    this.load.json('item-data', 'src/data/items.json');

    // Load cinematic scene definitions for background-based locations
    this.load.json('location-scenes', 'src/data/location-scenes.json');

    // Load historical lore objects
    this.load.json('historical-objects', 'src/data/historical-objects.json');

    // Load quest data
    this.load.json('quest-index', 'src/data/quests/index.json');
    this.load.json('quest-merchants-seal', 'src/data/quests/merchants-seal.json');
    this.load.json('quest-padres-dilemma', 'src/data/quests/padres-dilemma.json');
    this.load.json('quest-pirates-rumor', 'src/data/quests/pirates-rumor.json');
    this.load.json('quest-rashids-cargo', 'src/data/quests/rashids-cargo.json');

    // Load world/location data
    this.load.json('world-data', 'src/data/locations/world.json');
    this.load.json('zone-downtown', 'src/data/locations/downtown.json');
    this.load.json('zone-harbor', 'src/data/locations/harbor.json');
    this.load.json('zone-outskirts', 'src/data/locations/outskirts.json');
  }

  create() {
    console.log('Boot complete, starting game...');

    // Create particle texture for atmospheric effects
    this.createParticleTexture();

    // Create character animations
    this.createAnimations();

    // Transition to the title screen
    this.scene.start('TitleScene');
  }

  createAnimations() {
    // Player walk animations
    this.anims.create({
      key: 'player-walk-down',
      frames: this.anims.generateFrameNumbers('player-sheet', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
    this.anims.create({
      key: 'player-walk-left',
      frames: this.anims.generateFrameNumbers('player-sheet', { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1
    });
    this.anims.create({
      key: 'player-walk-right',
      frames: this.anims.generateFrameNumbers('player-sheet', { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1
    });
    this.anims.create({
      key: 'player-walk-up',
      frames: this.anims.generateFrameNumbers('player-sheet', { start: 12, end: 15 }),
      frameRate: 8,
      repeat: -1
    });
    
    // Player idle animations
    this.anims.create({
      key: 'player-idle-down',
      frames: [{ key: 'player-sheet', frame: 16 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'player-idle-left',
      frames: [{ key: 'player-sheet', frame: 17 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'player-idle-right',
      frames: [{ key: 'player-sheet', frame: 18 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'player-idle-up',
      frames: [{ key: 'player-sheet', frame: 19 }],
      frameRate: 1
    });

    console.log('Character animations created');
  }

  createParticleTexture() {
    // Create a simple circular particle texture
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 4); // 8x8 circle
    graphics.generateTexture('particle', 8, 8);
    graphics.destroy();
  }
}
