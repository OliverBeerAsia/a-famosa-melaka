/**
 * Content Manager
 * 
 * Centralized system for loading and managing game content:
 * - Quest definitions from JSON files
 * - Location data and transitions
 * - NPC data with dialogue modifications
 * - Items and world objects
 * 
 * This enables scaling up content without modifying code.
 */

export default class ContentManager {
  constructor(scene) {
    this.scene = scene;
    
    // Loaded content caches
    this.quests = {};
    this.locations = {};
    this.zones = {};
    this.npcs = {};
    this.items = {};
    
    // World data
    this.worldData = null;
    
    // Track what's been loaded
    this.loadedContent = new Set();
  }

  /**
   * Initialize content manager - load core data
   */
  async initialize() {
    console.log('ContentManager: Initializing...');
    
    // Load world structure
    this.loadWorldData();
    
    // Load all quest definitions
    this.loadQuests();
    
    // Load all location data
    this.loadLocations();
    
    // Load NPC data (already cached by BootScene)
    this.loadNPCs();
    
    console.log('ContentManager: Initialization complete');
    console.log(`  - ${Object.keys(this.quests).length} quests loaded`);
    console.log(`  - ${Object.keys(this.locations).length} locations loaded`);
    console.log(`  - ${Object.keys(this.npcs).length} NPCs loaded`);
  }

  /**
   * Load world structure data
   */
  loadWorldData() {
    try {
      this.worldData = this.scene.cache.json.get('world-data');
      
      if (this.worldData && this.worldData.zones) {
        this.worldData.zones.forEach(zone => {
          this.zones[zone.id] = zone;
        });
      }
    } catch (e) {
      console.warn('ContentManager: Could not load world data', e);
    }
  }

  /**
   * Load all quest definitions from JSON
   */
  loadQuests() {
    // Load quest index
    const questIndex = this.scene.cache.json.get('quest-index');
    
    if (!questIndex || !questIndex.quests) {
      console.warn('ContentManager: No quest index found');
      return;
    }

    // Load each quest definition
    questIndex.quests.forEach(questId => {
      const questData = this.scene.cache.json.get(`quest-${questId}`);
      if (questData) {
        this.quests[questId] = questData;
        console.log(`  Loaded quest: ${questData.name}`);
      } else {
        console.warn(`  Quest not found: ${questId}`);
      }
    });
  }

  /**
   * Load all location data
   */
  loadLocations() {
    // Load zone data files
    const zoneFiles = ['downtown', 'harbor', 'outskirts'];
    
    zoneFiles.forEach(zoneId => {
      const zoneData = this.scene.cache.json.get(`zone-${zoneId}`);
      if (zoneData && zoneData.locations) {
        Object.values(zoneData.locations).forEach(location => {
          this.locations[location.id] = location;
        });
      }
    });
  }

  /**
   * Load NPC data
   */
  loadNPCs() {
    const npcData = this.scene.cache.json.get('npc-data');
    if (npcData) {
      Object.keys(npcData).forEach(npcId => {
        this.npcs[npcId] = npcData[npcId];
      });
    }
  }

  /**
   * Get quest definition by ID
   */
  getQuest(questId) {
    return this.quests[questId] || null;
  }

  /**
   * Get all quest definitions
   */
  getAllQuests() {
    return Object.values(this.quests);
  }

  /**
   * Get quests by location
   */
  getQuestsByLocation(locationId) {
    return Object.values(this.quests).filter(quest => 
      quest.locations && quest.locations.includes(locationId)
    );
  }

  /**
   * Get quests given by a specific NPC
   */
  getQuestsByGiver(npcId) {
    return Object.values(this.quests).filter(quest => 
      quest.giver === npcId
    );
  }

  /**
   * Get location data by ID
   */
  getLocation(locationId) {
    return this.locations[locationId] || null;
  }

  /**
   * Get all locations in a zone
   */
  getLocationsByZone(zoneId) {
    return Object.values(this.locations).filter(loc => loc.zone === zoneId);
  }

  /**
   * Get transitions from a location
   */
  getTransitions(locationId) {
    const location = this.locations[locationId];
    return location ? (location.transitions || []) : [];
  }

  /**
   * Get NPC data by ID
   */
  getNPC(npcId) {
    return this.npcs[npcId] || null;
  }

  /**
   * Get NPCs by location
   */
  getNPCsByLocation(locationId) {
    return Object.values(this.npcs).filter(npc => npc.location === locationId);
  }

  /**
   * Get dialogue modifications for NPC based on quest state
   */
  getDialogueModifications(npcId, questId, stageId) {
    const quest = this.quests[questId];
    if (!quest || !quest.dialogueModifications) {
      return null;
    }

    const npcMods = quest.dialogueModifications[npcId];
    if (!npcMods) {
      return null;
    }

    return npcMods[stageId] || null;
  }

  /**
   * Get zone data by ID
   */
  getZone(zoneId) {
    return this.zones[zoneId] || null;
  }

  /**
   * Get all zones
   */
  getAllZones() {
    return Object.values(this.zones);
  }

  /**
   * Check if content has been loaded
   */
  isLoaded(contentKey) {
    return this.loadedContent.has(contentKey);
  }

  /**
   * Mark content as loaded
   */
  markLoaded(contentKey) {
    this.loadedContent.add(contentKey);
  }

  /**
   * Get atmospheric settings for a location
   */
  getAtmosphere(locationId) {
    const location = this.locations[locationId];
    if (!location) {
      return {
        particleDensity: 1.0,
        lightTint: '#FFFFFF'
      };
    }

    return location.atmosphere || {
      particleDensity: 1.0,
      lightTint: '#FFFFFF'
    };
  }

  /**
   * Get music for a location and time of day
   */
  getMusic(locationId, timeOfDay) {
    const location = this.locations[locationId];
    if (!location) {
      return 'music-main';
    }

    if (timeOfDay === 'night' && location.nightMusic) {
      return location.nightMusic;
    }

    return location.music || 'music-main';
  }

  /**
   * Get ambient sounds for a location
   */
  getAmbientSounds(locationId) {
    const location = this.locations[locationId];
    return location ? (location.ambientSounds || []) : [];
  }

  /**
   * Validate content integrity
   */
  validateContent() {
    const issues = [];

    // Check quest references
    Object.values(this.quests).forEach(quest => {
      // Check giver NPC exists
      if (quest.giver && !this.npcs[quest.giver]) {
        issues.push(`Quest "${quest.name}" references unknown NPC: ${quest.giver}`);
      }

      // Check dialogue modification NPCs exist
      if (quest.dialogueModifications) {
        Object.keys(quest.dialogueModifications).forEach(npcId => {
          if (!this.npcs[npcId]) {
            issues.push(`Quest "${quest.name}" has dialogue for unknown NPC: ${npcId}`);
          }
        });
      }
    });

    // Check location references
    Object.values(this.locations).forEach(location => {
      // Check NPC references
      if (location.npcs) {
        location.npcs.forEach(npcId => {
          if (!this.npcs[npcId]) {
            issues.push(`Location "${location.name}" references unknown NPC: ${npcId}`);
          }
        });
      }

      // Check transition targets
      if (location.transitions) {
        location.transitions.forEach(trans => {
          if (!this.locations[trans.targetLocation]) {
            issues.push(`Location "${location.name}" has transition to unknown location: ${trans.targetLocation}`);
          }
        });
      }
    });

    if (issues.length > 0) {
      console.warn('ContentManager: Validation issues found:');
      issues.forEach(issue => console.warn(`  - ${issue}`));
    } else {
      console.log('ContentManager: Content validation passed');
    }

    return issues;
  }

  /**
   * Generate content summary for debugging
   */
  getSummary() {
    return {
      quests: Object.keys(this.quests).length,
      locations: Object.keys(this.locations).length,
      zones: Object.keys(this.zones).length,
      npcs: Object.keys(this.npcs).length,
      questList: Object.values(this.quests).map(q => ({ id: q.id, name: q.name })),
      locationList: Object.values(this.locations).map(l => ({ id: l.id, name: l.name, zone: l.zone }))
    };
  }
}


