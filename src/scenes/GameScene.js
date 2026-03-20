/**
 * Game Scene
 *
 * Main gameplay scene:
 * - Loads and renders the tilemap
 * - Creates the player entity
 * - Handles input and player movement
 * - Manages camera following
 * - Will handle NPC interactions, dialogue, inventory, etc.
 */

import Phaser from 'phaser';
import Player from '../entities/Player';
import NPC from '../entities/NPC';
import InteractiveObject from '../entities/InteractiveObject';
import TimeSystem from '../systems/TimeSystem';
import AmbientSoundSystem from '../systems/AmbientSoundSystem';
import InventorySystem from '../systems/InventorySystem';
import QuestSystem from '../systems/QuestSystem';
import MusicSystem from '../systems/MusicSystem';
import ContentManager from '../systems/ContentManager';
import DialogueBox from '../ui/DialogueBox';
import InventoryUI from '../ui/InventoryUI';
import JournalUI from '../ui/JournalUI';
import MessageBox from '../ui/MessageBox';

const USE_SCENE_BACKDROPS = true;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    // Start with the market (Rua Direita)
    this.currentMap = 'rua-direita';
    this.npcs = [];
    this.interactiveObjects = [];
  }

  init(data) {
    // Allow passing in which map to load
    if (data.mapKey) {
      this.currentMap = data.mapKey;
    }
  }

  create() {
    console.log('GameScene started - Loading:', this.currentMap);

    // Initialize ContentManager (persistent across scene restarts)
    this.createContentManager();

    // Load cinematic scene metadata (if available)
    const sceneDefinitions = USE_SCENE_BACKDROPS ? (this.cache.json.get('location-scenes') || {}) : {};
    this.sceneConfig = USE_SCENE_BACKDROPS ? (sceneDefinitions[this.currentMap] || null) : null;
    this.usingSceneBackground = !!this.sceneConfig;
    this.sceneColliders = null;
    this.backgroundImage = null;

    // Either create the cinematic backdrop or fall back to tilemaps
    if (this.sceneConfig) {
      this.createSceneBackdrop();
    } else {
      this.createTilemap();
    }

    if (!this.worldWidth || !this.worldHeight) {
      this.worldWidth = this.scale.width;
      this.worldHeight = this.scale.height;
      this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    }

    // Create atmospheric effects
    this.createAtmosphere();

    // Create time system and lighting
    this.createTimeSystem();

    // Create ambient sound system
    this.createAmbientSound();

    // Create inventory system (persistent across scene restarts)
    this.createInventory();

    // Create quest system (persistent across scene restarts)
    this.createQuestSystem();

    // Create UI elements
    this.createUI();

    // Create NPCs
    this.createNPCs();

    // Create interactive objects
    this.createInteractiveObjects();

    // Create the player
    this.createPlayer();

    // Set up camera
    this.setupCamera();

    // Set up input
    this.setupInput();

    // Display controls hint
    this.showControls();

    // Show location name
    this.showLocationName();

    // Create environmental animations (water, fire, etc.)
    this.createEnvironmentalAnimations();

    // Emit location entered event for quest system
    this.events.emit('locationEntered', { locationId: this.currentMap });

    // Debug mode flag
    this.debugMode = false;
  }

  createContentManager() {
    // Use registry to persist ContentManager across scene restarts
    if (!this.registry.get('contentManager')) {
      this.contentManager = new ContentManager(this);
      this.contentManager.initialize();
      this.registry.set('contentManager', this.contentManager);
      
      // Validate content in development
      this.contentManager.validateContent();
    } else {
      this.contentManager = this.registry.get('contentManager');
      this.contentManager.scene = this; // Update scene reference
    }
  }

  createTilemap() {
    // Create tilemap from Tiled JSON - use current map
    this.map = this.make.tilemap({ key: this.currentMap });

    if (!this.map) {
      console.error(`Failed to load tilemap: ${this.currentMap}`);
      return;
    }

    // Add the new comprehensive tilesets
    const allTilesets = [];

    // Try to add both tilesets (they're defined in the map JSON)
    try {
      const portugueseTileset = this.map.addTilesetImage('portuguese-streets', 'portuguese-streets');
      if (portugueseTileset) {
        allTilesets.push(portugueseTileset);
        console.log('Loaded Portuguese Streets tileset');
      }
    } catch (e) {
      console.log('Portuguese Streets tileset not in this map');
    }

    try {
      const masterTileset = this.map.addTilesetImage('master-tileset', 'master-tileset');
      if (masterTileset) {
        allTilesets.push(masterTileset);
        console.log('Loaded Master tileset');
      }
    } catch (e) {
      console.log('Master tileset not in this map');
    }

    // Fallback: Try loading old individual tilesets for backward compatibility
    if (allTilesets.length === 0) {
      console.log('New tilesets not found, trying old tileset structure...');
      const oldTilesetNames = [
        'fortress-stone', 'grass', 'wall-white', 'cobblestone', 'roof-terracotta',
        'door-wood', 'ground', 'water', 'stone', 'church-stone', 'church-floor',
        'dock-wood', 'water-tile', 'dirt-path', 'bamboo-floor', 'thatch-roof'
      ];

      oldTilesetNames.forEach(name => {
        try {
          const tileset = this.map.addTilesetImage(name, name);
          if (tileset) {
            allTilesets.push(tileset);
          }
        } catch (e) {
          // Silently skip
        }
      });
    }

    if (allTilesets.length === 0) {
      console.error(`No tilesets loaded for map: ${this.currentMap}`);
      return;
    }

    // Create tile layers with all available tilesets
    if (this.map.getLayer('Ground')) {
      this.groundLayer = this.map.createLayer('Ground', allTilesets, 0, 0);
      // Scale down from 32x32 to 16x16 (the project's target size)
      this.groundLayer.setScale(0.5);
      console.log('Created Ground layer');
    }

    // Walls layer with collision
    if (this.map.getLayer('Walls')) {
      this.wallsLayer = this.map.createLayer('Walls', allTilesets, 0, 0);
      this.wallsLayer.setScale(0.5);
      this.wallsLayer.setCollisionByProperty({ collides: true });
      console.log('Created Walls layer');
    }

    // Buildings/Structures layers
    if (this.map.getLayer('Buildings')) {
      this.buildingsLayer = this.map.createLayer('Buildings', allTilesets, 0, 0);
      this.buildingsLayer.setScale(0.5);
      console.log('Created Buildings layer');
    }

    if (this.map.getLayer('Church')) {
      this.churchLayer = this.map.createLayer('Church', allTilesets, 0, 0);
      this.churchLayer.setScale(0.5);
      console.log('Created Church layer');
    }

    if (this.map.getLayer('Docks')) {
      this.docksLayer = this.map.createLayer('Docks', allTilesets, 0, 0);
      this.docksLayer.setScale(0.5);
      console.log('Created Docks layer');
    }

    if (this.map.getLayer('Structures')) {
      this.structuresLayer = this.map.createLayer('Structures', allTilesets, 0, 0);
      this.structuresLayer.setScale(0.5);
      console.log('Created Structures layer');
    }

    if (this.map.getLayer('Fortress Walls')) {
      this.fortressLayer = this.map.createLayer('Fortress Walls', allTilesets, 0, 0);
      this.fortressLayer.setScale(0.5);
      this.fortressLayer.setCollisionByProperty({ collides: true });
      console.log('Created Fortress Walls layer');
    }

    // Create objects from object layer
    this.createMapObjects();

    // Set world bounds to tilemap size (scaled down)
    this.worldWidth = this.map.widthInPixels * 0.5;
    this.worldHeight = this.map.heightInPixels * 0.5;
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    console.log(`Map dimensions: ${this.worldWidth}x${this.worldHeight}`);
  }

  createSceneBackdrop() {
    const width = this.scale.width;
    const height = this.scale.height;

    if (this.sceneColliders) {
      this.sceneColliders.clear(true, true);
      this.sceneColliders = null;
    }

    this.map = null;
    this.worldWidth = width;
    this.worldHeight = height;

    // Determine initial texture based on time of day
    const timeOfDay = this.timeSystem?.getTimeOfDay() || 'day';
    let textureKey = this.sceneConfig.background;
    if (this.sceneConfig.variants && this.sceneConfig.variants[timeOfDay]) {
      textureKey = this.sceneConfig.variants[timeOfDay];
    }

    // Draw the background artwork
    this.backgroundImage = this.add.image(width / 2, height / 2, textureKey);
    this.backgroundImage.setOrigin(0.5, 0.5);
    const scaleX = width / this.backgroundImage.width;
    const scaleY = height / this.backgroundImage.height;
    const scale = Math.max(scaleX, scaleY);
    this.backgroundImage.setScale(scale);
    this.backgroundImage.setScrollFactor(0);
    this.backgroundImage.setDepth(-20);

    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.3, 0.15, 0.15, 0.3);
    vignette.fillRect(0, 0, width, height);
    vignette.setScrollFactor(0);
    vignette.setDepth(-10);

    // Set physics bounds to the visible area
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Optional invisible colliders to block the player
    if (Array.isArray(this.sceneConfig.collisionRects) && this.sceneConfig.collisionRects.length > 0) {
      this.sceneColliders = this.physics.add.staticGroup();
      this.sceneConfig.collisionRects.forEach(rect => {
        const collider = this.add.rectangle(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          rect.width,
          rect.height,
          0x000000,
          0
        );
        collider.setOrigin(0.5, 0.5);
        collider.setScrollFactor(0);
        this.physics.add.existing(collider, true);
        this.sceneColliders.add(collider);
      });
    }
  }

  createMapObjects() {
    if (!this.map) {
      return;
    }

    // Get the Objects layer from Tiled
    const objectLayer = this.map.getObjectLayer('Objects');

    if (!objectLayer) return;

    // Create sprites for each object
    objectLayer.objects.forEach(obj => {
      // Objects in Tiled have their origin at bottom-left
      // We need to adjust for Phaser's center origin for sprites
      const x = obj.x + obj.width / 2;
      const y = obj.y - obj.height / 2;

      // Create the sprite
      const sprite = this.add.sprite(x, y, obj.name);

      // Depth sorting for isometric feel (objects higher up appear behind)
      sprite.setDepth(y);
    });
  }

  createAtmosphere() {
    const mapWidth = this.worldWidth || this.scale.width;
    const mapHeight = this.worldHeight || this.scale.height;

    // Create dust mote particles
    // These float slowly through the air, giving a sense of heat and stillness
    this.dustMotes = this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: mapWidth },
      y: { min: 0, max: mapHeight },
      quantity: 1,
      frequency: 150, // One particle every 150ms
      lifespan: { min: 8000, max: 12000 },
      speedX: { min: -5, max: 5 },
      speedY: { min: -8, max: -3 }, // Slow upward drift
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0, end: 0.15, ease: 'Sine.easeInOut' },
      tint: 0xF4E6D3, // Warm whitewash color
      blendMode: 'ADD',
      emitting: true
    });
    this.dustMotes.setDepth(900); // Below UI, above most objects

    // Create heat haze particles
    // Larger, very subtle distortion effect
    this.heatHaze = this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: mapWidth },
      y: { min: mapHeight * 0.3, max: mapHeight }, // Lower half of screen
      quantity: 1,
      frequency: 300,
      lifespan: { min: 5000, max: 8000 },
      speedX: { min: -3, max: 3 },
      speedY: { min: -5, max: 0 },
      scale: { start: 1.5, end: 2.5 },
      alpha: { start: 0, end: 0.05, ease: 'Sine.easeInOut' },
      tint: 0xF4B41A, // Golden warmth
      blendMode: 'ADD',
      emitting: true
    });
    this.heatHaze.setDepth(500); // Behind most objects
  }

  createTimeSystem() {
    // Initialize time system
    this.timeSystem = new TimeSystem(this);

    // Create lighting overlay (rectangle covering the whole map)
    const mapWidth = this.worldWidth || this.scale.width;
    const mapHeight = this.worldHeight || this.scale.height;

    this.lightingOverlay = this.add.rectangle(
      mapWidth / 2,
      mapHeight / 2,
      mapWidth,
      mapHeight,
      0x000000,
      0
    );
    this.lightingOverlay.setDepth(950); // Above objects, below UI

    // Update lighting when hour changes
    this.events.on('hourChanged', this.updateLighting, this);

    // Initial lighting setup
    this.updateLighting();

    // Display time in UI (upper right corner) - for 960x540
    this.timeText = this.add.text(950, 10, '', {
      font: '18px Cinzel, monospace',
      fill: '#F4B41A',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.timeText.setOrigin(1, 0);
    this.timeText.setScrollFactor(0);
    this.timeText.setDepth(1000);
  }

  updateLighting() {
    if (!this.timeSystem) return;
    
    const alpha = this.timeSystem.getLightingAlpha();
    const tint = this.timeSystem.getLightingTint();
    const timeOfDay = this.timeSystem.getTimeOfDay();

    // Smoothly transition overlay alpha
    this.tweens.add({
      targets: this.lightingOverlay,
      alpha: alpha,
      duration: 1000,
      ease: 'Linear'
    });

    // Apply tint to overlay
    this.lightingOverlay.setFillStyle(tint, alpha);

    // Update background image if using scene backdrops
    if (this.usingSceneBackground && this.sceneConfig && this.backgroundImage) {
      let targetTexture = this.sceneConfig.background;
      
      if (this.sceneConfig.variants && this.sceneConfig.variants[timeOfDay]) {
        targetTexture = this.sceneConfig.variants[timeOfDay];
      }
      
      if (this.backgroundImage.texture.key !== targetTexture) {
        // Fade out/in effect for texture change
        this.tweens.add({
          targets: this.backgroundImage,
          alpha: 0.5,
          duration: 500,
          onComplete: () => {
            this.backgroundImage.setTexture(targetTexture);
            this.tweens.add({
              targets: this.backgroundImage,
              alpha: 1,
              duration: 500
            });
          }
        });
      }
    }

    // Update ambient sounds for time of day
    if (this.ambientSound) {
      this.ambientSound.setTimeOfDay(timeOfDay);
    }
  }

  createAmbientSound() {
    // Initialize ambient sound system
    this.ambientSound = new AmbientSoundSystem(this);

    // Set location-specific ambient sounds
    this.ambientSound.setLocation(this.currentMap);

    // Set time-of-day sounds
    if (this.timeSystem) {
      this.ambientSound.setTimeOfDay(this.timeSystem.getTimeOfDay());
    }

    // Listen for hour changes to update time-based sounds
    this.events.on('hourChanged', () => {
      const newTimeOfDay = this.timeSystem.getTimeOfDay();
      this.ambientSound.setTimeOfDay(newTimeOfDay);
      // Also update music for time of day
      if (this.musicSystem) {
        this.musicSystem.updateTimeOfDay(newTimeOfDay);
      }
    });

    // Initialize music system
    this.musicSystem = new MusicSystem(this);
    this.musicSystem.currentLocation = this.currentMap;
    this.musicSystem.setLocation(this.currentMap);
  }

  createInventory() {
    // Use registry to persist inventory across scene restarts
    if (!this.registry.get('inventory')) {
      this.inventory = new InventorySystem(this);
      this.registry.set('inventory', this.inventory);
    } else {
      this.inventory = this.registry.get('inventory');
      this.inventory.scene = this; // Update scene reference
    }
  }

  createQuestSystem() {
    // Use registry to persist quests across scene restarts
    if (!this.registry.get('questSystem')) {
      this.questSystem = new QuestSystem(this);
      this.registry.set('questSystem', this.questSystem);
    } else {
      this.questSystem = this.registry.get('questSystem');
      this.questSystem.scene = this; // Update scene reference
    }
  }

  createUI() {
    // Initialize dialogue UI
    this.dialogueBox = new DialogueBox(this);

    // Initialize inventory UI
    this.inventoryUI = new InventoryUI(this);

    // Initialize journal UI
    this.journalUI = new JournalUI(this);

    // Initialize message box for object interactions
    this.messageBox = new MessageBox(this);
  }

  createInteractiveObjects() {
    // 1. Load world pickup items
    const itemData = this.cache.json.get('item-data');
    if (itemData && itemData['world-items']) {
      const locationItems = itemData['world-items'][this.currentMap] || [];

      locationItems.forEach(item => {
        // Skip if already picked up (check registry)
        if (this.registry.get(`pickedUp-${item.id}`)) {
          return;
        }

        const obj = new InteractiveObject(this, item.x, item.y, {
          id: item.id,
          itemId: item.itemId,
          name: this.getItemName(item.itemId),
          description: item.description,
          sprite: this.getItemSprite(item.itemId),
          type: 'pickup',
          pickupText: `You picked up ${this.getItemName(item.itemId)}.`
        });

        this.interactiveObjects.push(obj);
      });
    }

    // 2. Load historical/lore objects
    const loreData = this.cache.json.get('historical-objects');
    if (loreData && loreData.objects) {
      Object.values(loreData.objects).forEach(loreObj => {
        if (loreObj.location === this.currentMap) {
          const x = loreObj.position?.x || 0;
          const y = loreObj.position?.y || 0;

          const obj = new InteractiveObject(this, x, y, {
            id: loreObj.id,
            name: loreObj.name,
            description: loreObj.examineText || loreObj.description,
            sprite: loreObj.sprite || 'crate',
            type: 'examine',
            interactionRadius: 32
          });

          this.interactiveObjects.push(obj);
          console.log(`Created Lore Object: ${loreObj.name} at ${loreObj.location}`);
        }
      });
    }

    // Listen for item pickup to mark as collected
    this.events.on('itemAdded', (item) => {
      // Find and mark the world item as picked up
      if (itemData && itemData['world-items']) {
        const locationItems = itemData['world-items'][this.currentMap] || [];
        const worldItem = locationItems.find(i => i.itemId === item.id);
        if (worldItem) {
          this.registry.set(`pickedUp-${worldItem.id}`, true);
        }
      }
    });
  }

  getItemName(itemId) {
    const names = {
      'trading-seal': 'Trading Seal',
      'coin-pouch': 'Coin Pouch',
      'spice-sample': 'Spice Sample',
      'letter': 'Sealed Letter',
      'key-warehouse': 'Warehouse Key',
      'portuguese-wine': 'Portuguese Wine',
      'medicinal-herbs': 'Medicinal Herbs',
      'rosary': 'Rosary Beads'
    };
    return names[itemId] || itemId;
  }

  getItemSprite(itemId) {
    const sprites = {
      'trading-seal': 'pottery',
      'coin-pouch': 'sack',
      'spice-sample': 'spice-pile',
      'letter': 'crate',
      'portuguese-wine': 'barrel',
      'medicinal-herbs': 'flowers',
      'rosary': 'pottery'
    };
    return sprites[itemId] || 'crate';
  }

  createNPCs() {
    // Load NPC data
    const npcData = this.cache.json.get('npc-data');
    if (!npcData) {
      console.warn('NPC data not loaded');
      return;
    }

    // Create NPCs that belong to this location
    const npcOverrides = this.sceneConfig?.npcPositions || {};

    Object.values(npcData).forEach(data => {
      if (data.location === this.currentMap) {
        let spawnX = data.position?.x || 0;
        let spawnY = data.position?.y || 0;

        if (npcOverrides[data.id]) {
          spawnX = npcOverrides[data.id].x;
          spawnY = npcOverrides[data.id].y;
        }

        const npc = new NPC(this, spawnX, spawnY, data);
        this.npcs.push(npc);
        console.log(`Created NPC: ${data.name} at ${data.location}`);
      }
    });
  }

  createPlayer() {
    // Create player at spawn point - bottom center by default
    const worldWidth = this.worldWidth || this.scale.width;
    const worldHeight = this.worldHeight || this.scale.height;

    let spawnX = worldWidth / 2;
    let spawnY = worldHeight - 48;

    if (this.sceneConfig?.playerStart) {
      spawnX = this.sceneConfig.playerStart.x;
      spawnY = this.sceneConfig.playerStart.y;
    } else if (this.map) {
      spawnX = this.map.widthInPixels / 2;
      spawnY = this.map.heightInPixels - 48;
    }

    this.player = new Player(this, spawnX, spawnY);

    // Set up collision with walls layer
    if (this.wallsLayer) {
      this.physics.add.collider(this.player, this.wallsLayer);
    }

    if (this.sceneColliders) {
      this.physics.add.collider(this.player, this.sceneColliders);
    }

    // Keep player within world bounds
    this.player.setCollideWorldBounds(true);

    // Depth sorting for player (so they appear correctly with objects)
    this.player.setDepth(1000); // Player always on top for now
  }

  setupCamera() {
    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Set camera bounds to world size
    const worldWidth = this.worldWidth || this.scale.width;
    const worldHeight = this.worldHeight || this.scale.height;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // Optional: Add camera zoom control
    // this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
    //   const currentZoom = this.cameras.main.zoom;
    //   this.cameras.main.setZoom(currentZoom + (deltaY > 0 ? -0.1 : 0.1));
    // });
  }

  setupInput() {
    // Cursor keys for movement
    this.cursors = this.input.keyboard.createCursorKeys();

    // Additional keys
    this.keys = {
      space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      shift: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      one: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      two: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      three: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      four: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      five: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
      t: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
      y: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y)
    };

    // Space bar for interaction with NPCs and objects
    this.keys.space.on('down', () => {
      this.tryInteract();
    });

    // Location switchers (for demo) - Uses F6-F10 to avoid dialogue conflicts
    this.keys.f6 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F6);
    this.keys.f7 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F7);
    this.keys.f8 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F8);
    this.keys.f9 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
    this.keys.f10 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F10);

    this.keys.f6.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('a-famosa-gate');
    });

    this.keys.f7.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('rua-direita');
    });

    this.keys.f8.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('st-pauls-church');
    });

    this.keys.f9.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('waterfront');
    });

    this.keys.f10.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('kampung');
    });
    
    // Also keep number keys for when NOT in dialogue (legacy support)
    this.keys.one.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('a-famosa-gate');
    });

    this.keys.two.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('rua-direita');
    });

    this.keys.three.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('st-pauls-church');
    });

    this.keys.four.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('waterfront');
    });

    this.keys.five.on('down', () => {
      if (!this.isUIOpen()) this.switchLocation('kampung');
    });

    // Time controls (for testing)
    this.keys.t.on('down', () => {
      // Advance time by 1 hour
      this.timeSystem.currentHour = (this.timeSystem.currentHour + 1) % 24;
      this.updateLighting();
      console.log('Time advanced to:', this.timeSystem.getTimeString());
    });

    this.keys.y.on('down', () => {
      // Speed up time
      this.timeSystem.timeScale = this.timeSystem.timeScale === 60 ? 600 : 60;
      this.timeSystem.timer.remove();
      this.timeSystem.startTimer();
      console.log('Time scale:', this.timeSystem.timeScale === 60 ? 'Normal' : 'Fast');
    });

    // Debug mode (F3)
    this.keys.f3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    this.keys.f3.on('down', () => {
      this.toggleDebugMode();
    });

    // Quick quest complete for testing (F4)
    this.keys.f4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F4);
    this.keys.f4.on('down', () => {
      if (this.debugMode) {
        this.debugAdvanceQuest();
      }
    });

    // Give money for testing (F5)
    this.keys.f5 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
    this.keys.f5.on('down', () => {
      if (this.debugMode && this.inventory) {
        this.inventory.addMoney(100);
        this.showDebugMessage('Added 100 cruzados');
      }
    });
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    console.log('Debug mode:', this.debugMode ? 'ON' : 'OFF');
    
    // Toggle physics debug
    if (this.physics.world.drawDebug !== undefined) {
      this.physics.world.drawDebug = this.debugMode;
    }
    
    // Show/hide debug overlay
    if (this.debugMode) {
      this.showDebugOverlay();
    } else {
      this.hideDebugOverlay();
    }
    
    this.showDebugMessage(`Debug Mode: ${this.debugMode ? 'ON' : 'OFF'}`);
  }

  showDebugOverlay() {
    // Create debug text overlay
    if (this.debugText) this.debugText.destroy();
    
    this.debugText = this.add.text(10, 10, '', {
      font: '12px monospace',
      fill: '#00FF00',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 }
    });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(2000);
  }

  hideDebugOverlay() {
    if (this.debugText) {
      this.debugText.destroy();
      this.debugText = null;
    }
  }

  showDebugMessage(message) {
    const debugMsg = this.add.text(480, 100, message, {
      font: 'bold 16px monospace',
      fill: '#00FF00',
      backgroundColor: '#000000dd',
      padding: { x: 12, y: 6 }
    });
    debugMsg.setOrigin(0.5, 0.5);
    debugMsg.setScrollFactor(0);
    debugMsg.setDepth(2001);
    
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: debugMsg,
        alpha: 0,
        duration: 500,
        onComplete: () => debugMsg.destroy()
      });
    });
  }

  debugAdvanceQuest() {
    const activeQuests = this.questSystem.getActiveQuests();
    if (activeQuests.length > 0) {
      const quest = activeQuests[0];
      this.questSystem.advanceQuest(quest.id);
      this.showDebugMessage(`Advanced quest: ${quest.name}`);
    } else {
      this.showDebugMessage('No active quests to advance');
    }
  }

  switchLocation(mapKey) {
    // Don't switch to same location
    if (mapKey === this.currentMap) return;
    
    console.log('Switching to:', mapKey);
    
    // Fade out current scene
    this.cameras.main.fadeOut(300, 0, 0, 0);
    
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Go through loading interstitial
      this.scene.start('LoadingScene', { 
        mapKey: mapKey, 
        fromMap: this.currentMap 
      });
    });
  }

  // Check if any UI panel is open (dialogue, inventory, journal)
  isUIOpen() {
    return (
      (this.dialogueBox && this.dialogueBox.isVisible) ||
      (this.inventoryUI && this.inventoryUI.isVisible) ||
      (this.journalUI && this.journalUI.isVisible) ||
      (this.messageBox && this.messageBox.isVisible)
    );
  }

  showControls() {
    // Show controls on screen - for 960x540
    const controlsText = this.add.text(480, 10,
      'Arrows: Move  |  Space: Interact  |  I: Inventory  |  J: Journal  |  F: Fullscreen',
      {
        font: '14px Crimson Text, Georgia, serif',
        fill: '#D4C4A8',
        backgroundColor: '#1A1410dd',
        padding: { x: 12, y: 6 }
      }
    );
    controlsText.setOrigin(0.5, 0);
    controlsText.setScrollFactor(0);
    controlsText.setDepth(1000);

    // Fade out after 5 seconds
    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: controlsText,
        alpha: 0,
        duration: 800,
        onComplete: () => controlsText.destroy()
      });
    });
  }

  showLocationName() {
    const locationNames = {
      'a-famosa-gate': 'A Famosa Fortress',
      'rua-direita': 'Rua Direita',
      'st-pauls-church': 'St. Paul\'s Church',
      'waterfront': 'The Waterfront',
      'kampung': 'Kampung Quarter'
    };

    const locationName = locationNames[this.currentMap] || this.currentMap;

    // Location title (fades in then out) - for 960x540
    const titleText = this.add.text(480, 220, locationName, {
      font: 'bold 32px Cinzel, Georgia, serif',
      fill: '#F4B41A',
      stroke: '#000000',
      strokeThickness: 3
    });
    titleText.setOrigin(0.5, 0.5);
    titleText.setScrollFactor(0);
    titleText.setDepth(1001);
    titleText.setAlpha(0);

    // Fade in
    this.tweens.add({
      targets: titleText,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: titleText,
            alpha: 0,
            duration: 1000,
            onComplete: () => titleText.destroy()
          });
        });
      }
    });
  }

  createEnvironmentalAnimations() {
    // 1. Water animations for Waterfront
    if (this.currentMap === 'waterfront') {
      this.createWaterAnimations();
    }

    // 2. Torch/Fire animations for all scenes at night
    this.createFireAnimations();

    // 3. Location-specific atmospheric additions
    this.addLocationAtmosphere();
  }

  createWaterAnimations() {
    const width = this.scale.width;
    const height = this.scale.height;

    // Create subtle white foam/sparkle on the water edge
    // Based on collision rect for y=360+ in waterfront
    this.waterParticles = this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: width },
      y: { min: 400, max: height },
      quantity: 1,
      frequency: 200,
      lifespan: { min: 2000, max: 4000 },
      scale: { start: 0.1, end: 0.2 },
      alpha: { start: 0, end: 0.3, ease: 'Sine.easeInOut' },
      tint: 0x5DADE2,
      blendMode: 'ADD',
      emitting: true
    });
    this.waterParticles.setDepth(-5); // Above background, below player/objects
    
    // Animate the particles to move horizontally like waves
    this.tweens.add({
      targets: this.waterParticles,
      speedX: { from: -2, to: 2 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createFireAnimations() {
    this.fireEmitters = [];
    
    // Only show fires at night/dusk
    const timeOfDay = this.timeSystem?.getTimeOfDay() || 'day';
    const isDark = timeOfDay === 'night' || timeOfDay === 'dusk';

    // Find predefined torch positions for each location
    const firePositions = {
      'a-famosa-gate': [
        { x: 380, y: 220 }, { x: 580, y: 220 }
      ],
      'rua-direita': [
        { x: 220, y: 280 }, { x: 740, y: 280 }
      ],
      'st-pauls-church': [
        { x: 420, y: 240 }, { x: 620, y: 240 }
      ],
      'waterfront': [
        { x: 150, y: 320 }, { x: 810, y: 320 }
      ],
      'kampung': [
        { x: 380, y: 300 }, { x: 580, y: 300 }
      ]
    };

    const positions = firePositions[this.currentMap] || [];
    
    positions.forEach(pos => {
      const emitter = this.add.particles(pos.x, pos.y, 'particle', {
        quantity: 1,
        frequency: 80,
        lifespan: { min: 600, max: 1000 },
        speedY: { min: -40, max: -20 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.6, end: 0 },
        tint: [0xFF6347, 0xFF8C00, 0xF4B41A],
        blendMode: 'ADD',
        emitting: isDark
      });
      emitter.setDepth(pos.y + 10);
      this.fireEmitters.push(emitter);
      
      // Add a subtle golden glow
      const glow = this.add.circle(pos.x, pos.y, 40, 0xF4B41A, 0.15);
      glow.setDepth(pos.y - 1);
      glow.setVisible(isDark);
      
      // Animate the glow to flicker
      this.tweens.add({
        targets: glow,
        scale: { from: 0.8, to: 1.2 },
        alpha: { from: 0.1, to: 0.25 },
        duration: 200,
        yoyo: true,
        repeat: -1,
        ease: 'Cubic.easeInOut'
      });
      
      emitter.glow = glow;
    });

    // Update emitters when time of day changes
    this.events.on('hourChanged', () => {
      const currentTimeOfDay = this.timeSystem.getTimeOfDay();
      const dark = currentTimeOfDay === 'night' || currentTimeOfDay === 'dusk';
      this.fireEmitters.forEach(e => {
        e.emitting = dark;
        if (e.glow) e.glow.setVisible(dark);
      });
    });
  }

  addLocationAtmosphere() {
    // Add location-specific particles
    if (this.currentMap === 'st-pauls-church') {
      // Petal particles for the church hill
      this.add.particles(0, 0, 'particle', {
        x: { min: 0, max: this.scale.width },
        y: { min: -100, max: 0 },
        quantity: 1,
        frequency: 1000,
        lifespan: 10000,
        speedX: { min: -20, max: 20 },
        speedY: { min: 10, max: 30 },
        scale: { start: 0.2, end: 0.1 },
        alpha: { start: 0, end: 0.4, ease: 'Linear' },
        tint: 0xF5F5DC, // Whitewash color for petals
        emitting: true
      }).setDepth(1100);
    }

    if (this.currentMap === 'rua-direita') {
      // Dust particles more active in the market
      this.dustMotes.setFrequency(100);
      this.dustMotes.setQuantity(2);
    }
  }

  tryInteract() {
    // Check if any NPC is nearby and interactable
    for (const npc of this.npcs) {
      if (npc.isPlayerNearby(this.player)) {
        npc.interact();
        return; // Only interact with one thing at a time
      }
    }

    // Check if any interactive object is nearby
    for (const obj of this.interactiveObjects) {
      if (obj.isPlayerNearby && obj.isPlayerNearby(this.player)) {
        obj.interact();
        return;
      }
    }
  }

  update(time, delta) {
    // Don't process movement if UI is open
    const uiOpen = this.inventoryUI?.isVisible || this.journalUI?.isVisible || this.dialogueBox?.isVisible;

    // Update player with input (disabled when UI is open)
    if (!uiOpen) {
      this.player.update(this.cursors, this.keys);
    }

    // Update time display
    if (this.timeText && this.timeSystem) {
      this.timeText.setText(this.timeSystem.getTimeString());
    }

    // Update debug overlay
    if (this.debugMode && this.debugText) {
      this.updateDebugOverlay();
    }

    // Update all NPCs
    this.npcs.forEach(npc => {
      npc.update(this.player);
    });

    // Update all interactive objects
    this.interactiveObjects.forEach(obj => {
      if (obj.update) obj.update(this.player);
    });

    // Update UI elements
    if (this.inventoryUI) this.inventoryUI.update();
    if (this.journalUI) this.journalUI.update();
  }

  updateDebugOverlay() {
    const playerPos = this.player ? `${Math.round(this.player.x)}, ${Math.round(this.player.y)}` : 'N/A';
    const timeStr = this.timeSystem ? this.timeSystem.getTimeString() : 'N/A';
    const timeOfDay = this.timeSystem ? this.timeSystem.getTimeOfDay() : 'N/A';
    const activeQuests = this.questSystem ? this.questSystem.getActiveQuests() : [];
    const money = this.inventory ? this.inventory.getMoney() : 0;
    
    let questInfo = 'None';
    if (activeQuests.length > 0) {
      const quest = activeQuests[0];
      questInfo = `${quest.name} (${quest.currentStage})`;
    }

    const debugInfo = [
      `=== DEBUG MODE ===`,
      `Location: ${this.currentMap}`,
      `Player: ${playerPos}`,
      `Time: ${timeStr} (${timeOfDay})`,
      `Money: ${money} cruzados`,
      `Active Quest: ${questInfo}`,
      `NPCs: ${this.npcs.length}`,
      `Objects: ${this.interactiveObjects.length}`,
      ``,
      `F3: Toggle Debug`,
      `F4: Advance Quest`,
      `F5: Add Money`
    ].join('\n');

    this.debugText.setText(debugInfo);
  }
}
