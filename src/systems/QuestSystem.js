/**
 * Quest System
 *
 * Manages quests, objectives, and progression:
 * - Loads quest definitions from JSON files via ContentManager
 * - Quest states and tracking
 * - Objective completion
 * - NPC dialogue modifications based on quest state
 * - Journal entries
 * - Rewards
 */

export default class QuestSystem {
  constructor(scene) {
    this.scene = scene;
    this.activeQuests = {};
    this.completedQuests = [];
    this.journal = [];
    
    // Quest definitions loaded from ContentManager
    this.questDefinitions = {};
    
    // Load quest definitions
    this.loadQuestDefinitions();
    
    this.setupEvents();
  }

  /**
   * Load quest definitions from ContentManager or cache
   */
  loadQuestDefinitions() {
    // Try to get from ContentManager first
    if (this.scene.contentManager) {
      const quests = this.scene.contentManager.getAllQuests();
      quests.forEach(quest => {
        this.questDefinitions[quest.id] = quest;
      });
      console.log(`QuestSystem: Loaded ${Object.keys(this.questDefinitions).length} quests from ContentManager`);
      return;
    }

    // Fallback: Load directly from cache
    const questIndex = this.scene.cache.json.get('quest-index');
    if (questIndex && questIndex.quests) {
      questIndex.quests.forEach(questId => {
        const questData = this.scene.cache.json.get(`quest-${questId}`);
        if (questData) {
          this.questDefinitions[questId] = questData;
        }
      });
      console.log(`QuestSystem: Loaded ${Object.keys(this.questDefinitions).length} quests from cache`);
    }

    // Ultimate fallback: hardcoded quest (for backward compatibility)
    if (Object.keys(this.questDefinitions).length === 0) {
      console.warn('QuestSystem: No quests loaded, using fallback');
      this.questDefinitions = this.getFallbackQuests();
    }
  }

  /**
   * Fallback quest definitions for backward compatibility
   */
  getFallbackQuests() {
    return {
      'merchants-seal': {
        id: 'merchants-seal',
        name: "The Merchant's Seal",
        description: "Help Fernão Gomes recover his stolen trading seal.",
        giver: 'fernao-gomes',
        triggerTopic: 'seal',
        stages: [
          {
            id: 'start',
            description: 'Speak with Fernão Gomes about his missing seal.',
            objectives: [
              { type: 'talk', target: 'fernao-gomes', topic: 'seal', completed: false }
            ],
            journalEntry: "Fernão Gomes has lost his trading seal. He suspects foul play.",
            nextStage: 'investigate'
          },
          {
            id: 'investigate',
            description: 'Investigate the theft by questioning locals.',
            objectives: [
              { type: 'talk', target: 'aminah', topic: 'seal', completed: false }
            ],
            journalEntry: "I should ask around the market.",
            nextStage: 'confront'
          },
          {
            id: 'confront',
            description: 'Confront Chen Wei at the waterfront.',
            objectives: [
              { type: 'talk', target: 'chen-wei', topic: 'seal', completed: false }
            ],
            journalEntry: "Chen Wei might know something.",
            nextStage: 'payment'
          },
          {
            id: 'payment',
            description: 'Pay 50 cruzados for the seal.',
            objectives: [
              { type: 'pay', target: 'chen-wei', amount: 50, completed: false }
            ],
            journalEntry: "Chen Wei wants 50 cruzados for the seal.",
            nextStage: 'return'
          },
          {
            id: 'return',
            description: 'Return the seal to Fernão Gomes.',
            objectives: [
              { type: 'give', target: 'fernao-gomes', item: 'trading-seal', completed: false }
            ],
            journalEntry: "I should return the seal to Fernão.",
            nextStage: 'complete'
          },
          {
            id: 'complete',
            description: 'Quest complete!',
            objectives: [],
            journalEntry: "I returned the seal to Fernão Gomes.",
            reward: { items: ['coin-pouch', 'coin-pouch'], reputation: { portuguese: 10 } }
          }
        ]
      }
    };
  }

  setupEvents() {
    // Listen for dialogue topics
    this.scene.events.on('topicDiscussed', this.onTopicDiscussed, this);

    // Listen for item use/give
    this.scene.events.on('useItem', this.onItemUsed, this);

    // Listen for payments
    this.scene.events.on('paymentMade', this.onPaymentMade, this);
    
    // Listen for location exploration
    this.scene.events.on('locationEntered', this.onLocationEntered, this);
  }

  /**
   * Start a quest
   */
  startQuest(questId) {
    const questDef = this.questDefinitions[questId];
    if (!questDef) {
      console.warn(`Unknown quest: ${questId}`);
      return false;
    }

    if (this.activeQuests[questId]) {
      console.log(`Quest already active: ${questId}`);
      return false;
    }

    // Check prerequisites
    if (questDef.prerequisites && questDef.prerequisites.length > 0) {
      const unmet = questDef.prerequisites.filter(prereq => 
        !this.isQuestCompleted(prereq)
      );
      if (unmet.length > 0) {
        console.log(`Quest prerequisites not met: ${unmet.join(', ')}`);
        return false;
      }
    }

    // Create quest instance with deep-cloned objectives
    const quest = {
      id: questId,
      name: questDef.name,
      currentStage: questDef.stages[0].id,
      stageIndex: 0,
      startTime: Date.now(),
      objectives: JSON.parse(JSON.stringify(questDef.stages[0].objectives))
    };

    this.activeQuests[questId] = quest;

    // Add journal entry
    this.addJournalEntry(questDef.name, questDef.stages[0].journalEntry);

    // Emit event
    this.scene.events.emit('questStarted', quest);
    console.log(`Quest started: ${questDef.name}`);

    // Show notification
    this.scene.events.emit('showMessage', {
      title: 'New Quest',
      text: questDef.name,
      duration: 3000
    });

    return true;
  }

  /**
   * Get current quest stage
   */
  getQuestStage(questId) {
    const quest = this.activeQuests[questId];
    if (!quest) return null;

    const questDef = this.questDefinitions[questId];
    return questDef.stages.find(s => s.id === quest.currentStage);
  }

  /**
   * Get current objectives with completion status
   */
  getCurrentObjectives(questId) {
    const quest = this.activeQuests[questId];
    if (!quest) return [];
    
    return quest.objectives || [];
  }

  /**
   * Advance quest to next stage
   */
  advanceQuest(questId) {
    const quest = this.activeQuests[questId];
    if (!quest) return false;

    const questDef = this.questDefinitions[questId];
    const currentStage = this.getQuestStage(questId);

    if (!currentStage || !currentStage.nextStage) {
      // Quest complete
      this.completeQuest(questId);
      return true;
    }

    // Find next stage
    const nextStageIndex = questDef.stages.findIndex(s => s.id === currentStage.nextStage);
    if (nextStageIndex === -1) {
      console.warn(`Invalid next stage: ${currentStage.nextStage}`);
      return false;
    }

    // Update quest
    quest.currentStage = currentStage.nextStage;
    quest.stageIndex = nextStageIndex;
    
    // Deep clone objectives for the new stage
    const newStage = questDef.stages[nextStageIndex];
    quest.objectives = JSON.parse(JSON.stringify(newStage.objectives || []));

    // Add journal entry for new stage
    if (newStage.journalEntry) {
      this.addJournalEntry(questDef.name, newStage.journalEntry);
    }

    // Emit event
    this.scene.events.emit('questAdvanced', { quest, newStage });
    console.log(`Quest advanced to: ${newStage.description}`);

    // Check if this is the final stage
    if (newStage.id === 'complete') {
      this.completeQuest(questId);
    }

    return true;
  }

  /**
   * Complete a quest
   */
  completeQuest(questId) {
    const quest = this.activeQuests[questId];
    if (!quest) return false;

    const questDef = this.questDefinitions[questId];
    const finalStage = questDef.stages.find(s => s.id === 'complete');

    // Grant rewards
    if (finalStage && finalStage.reward) {
      this.grantReward(finalStage.reward);
    }

    // Move to completed
    this.completedQuests.push({
      ...quest,
      completedTime: Date.now()
    });
    delete this.activeQuests[questId];

    // Emit event
    this.scene.events.emit('questCompleted', quest);
    console.log(`Quest completed: ${questDef.name}`);

    // Show completion message
    this.scene.events.emit('showMessage', {
      title: 'Quest Complete!',
      text: `You have completed "${questDef.name}"`,
      duration: 5000
    });

    return true;
  }

  /**
   * Grant quest reward
   */
  grantReward(reward) {
    if (reward.items && this.scene.inventory) {
      reward.items.forEach(itemId => {
        this.scene.inventory.addItem(itemId);
      });
    }

    if (reward.money && this.scene.inventory) {
      this.scene.inventory.addMoney(reward.money);
    }

    // Future: handle reputation, experience, etc.
  }

  /**
   * Check if an objective is complete
   */
  checkObjective(questId, objectiveType, target, extra = {}) {
    const quest = this.activeQuests[questId];
    if (!quest) return false;
    
    const stage = this.getQuestStage(questId);
    if (!stage) return false;

    let objectiveCompleted = false;

    // Check objectives in quest instance (not stage definition)
    quest.objectives.forEach(obj => {
      if (obj.type === objectiveType && obj.target === target && !obj.completed) {
        // Additional checks based on type
        if (objectiveType === 'talk' && extra.topic && obj.topic && obj.topic !== extra.topic) {
          return;
        }
        if (objectiveType === 'give' && extra.item && obj.item !== extra.item) {
          return;
        }
        if (objectiveType === 'pay' && extra.amount && extra.amount < obj.amount) {
          return;
        }

        obj.completed = true;
        objectiveCompleted = true;
        console.log(`Objective completed: ${obj.type} ${obj.target}`);
      }
    });

    // Check if all required objectives are complete
    const requiredComplete = quest.objectives
      .filter(obj => !obj.optional)
      .every(obj => obj.completed);

    if (requiredComplete && objectiveCompleted) {
      this.advanceQuest(questId);
    }

    return objectiveCompleted;
  }

  /**
   * Handle topic discussed event
   */
  onTopicDiscussed(data) {
    const { npcId, topic } = data;

    // Check all active quests for matching objectives
    Object.keys(this.activeQuests).forEach(questId => {
      this.checkObjective(questId, 'talk', npcId, { topic });
    });

    // Check if this topic should start a quest
    Object.values(this.questDefinitions).forEach(questDef => {
      if (questDef.giver === npcId && questDef.triggerTopic === topic) {
        if (!this.activeQuests[questDef.id] && !this.isQuestCompleted(questDef.id)) {
          this.startQuest(questDef.id);
        }
      }
    });
  }

  /**
   * Handle item used event
   */
  onItemUsed(data) {
    const { item, target } = data;
    if (!target || !target.npcData) return;

    const npcId = target.npcData.id;
    const itemId = item.id;

    // Check for give objectives
    Object.keys(this.activeQuests).forEach(questId => {
      this.checkObjective(questId, 'give', npcId, { item: itemId });
    });

    // Special case: Giving seal to Fernão
    if (npcId === 'fernao-gomes' && itemId === 'trading-seal') {
      if (this.scene.inventory) {
        this.scene.inventory.removeItemById('trading-seal');
      }
    }
  }

  /**
   * Handle payment made event
   */
  onPaymentMade(data) {
    const { target, amount } = data;

    Object.keys(this.activeQuests).forEach(questId => {
      this.checkObjective(questId, 'pay', target, { amount });
    });
  }

  /**
   * Handle location entered event
   */
  onLocationEntered(data) {
    const { locationId } = data;
    
    Object.keys(this.activeQuests).forEach(questId => {
      this.checkObjective(questId, 'explore', locationId, {});
    });
  }

  /**
   * Add entry to journal
   */
  addJournalEntry(questName, text) {
    const entry = {
      id: `journal-${Date.now()}`,
      questName,
      text,
      timestamp: Date.now(),
      timeString: this.scene.timeSystem ? this.scene.timeSystem.getTimeString() : '??:??'
    };

    this.journal.push(entry);
    this.scene.events.emit('journalUpdated', entry);

    console.log(`Journal: ${text}`);
  }

  /**
   * Get journal entries
   */
  getJournal() {
    return [...this.journal];
  }

  /**
   * Get active quests
   */
  getActiveQuests() {
    return Object.values(this.activeQuests);
  }

  /**
   * Get active quest details with current objectives
   */
  getActiveQuestDetails() {
    return Object.values(this.activeQuests).map(quest => {
      const questDef = this.questDefinitions[quest.id];
      const stage = this.getQuestStage(quest.id);
      return {
        id: quest.id,
        name: questDef.name,
        description: questDef.description,
        currentStage: quest.currentStage,
        stageDescription: stage ? stage.description : '',
        objectives: quest.objectives
      };
    });
  }

  /**
   * Check if a quest is active
   */
  isQuestActive(questId) {
    return !!this.activeQuests[questId];
  }

  /**
   * Check if a quest is completed
   */
  isQuestCompleted(questId) {
    return this.completedQuests.some(q => q.id === questId);
  }

  /**
   * Get quest state for NPC dialogue modifications
   */
  getQuestStateForNPC(npcId) {
    const states = [];

    Object.keys(this.activeQuests).forEach(questId => {
      const quest = this.activeQuests[questId];
      const stage = this.getQuestStage(questId);

      if (stage) {
        // Check if this NPC is relevant to current objectives
        const relevantObjective = quest.objectives.find(obj => obj.target === npcId);
        if (relevantObjective) {
          states.push({
            questId,
            stage: quest.currentStage,
            objective: relevantObjective
          });
        }
      }
    });

    return states;
  }

  /**
   * Get modified dialogue for NPC based on quest state
   */
  getModifiedDialogue(npcId) {
    let modifications = null;
    
    // Check active quests for dialogue modifications
    Object.keys(this.activeQuests).forEach(questId => {
      const quest = this.activeQuests[questId];
      const questDef = this.questDefinitions[questId];
      
      if (questDef.dialogueModifications && questDef.dialogueModifications[npcId]) {
        const stageMods = questDef.dialogueModifications[npcId][quest.currentStage];
        if (stageMods) {
          modifications = stageMods;
        }
      }
    });
    
    // Check completed quests for final dialogue state
    this.completedQuests.forEach(quest => {
      const questDef = this.questDefinitions[quest.id];
      if (questDef && questDef.dialogueModifications && questDef.dialogueModifications[npcId]) {
        const completeMods = questDef.dialogueModifications[npcId]['complete'];
        if (completeMods) {
          modifications = completeMods;
        }
      }
    });
    
    return modifications;
  }

  /**
   * Save quest state
   */
  save() {
    return {
      activeQuests: this.activeQuests,
      completedQuests: this.completedQuests,
      journal: this.journal
    };
  }

  /**
   * Load quest state
   */
  load(data) {
    if (data.activeQuests) this.activeQuests = data.activeQuests;
    if (data.completedQuests) this.completedQuests = data.completedQuests;
    if (data.journal) this.journal = data.journal;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.scene.events.off('topicDiscussed', this.onTopicDiscussed, this);
    this.scene.events.off('useItem', this.onItemUsed, this);
    this.scene.events.off('paymentMade', this.onPaymentMade, this);
    this.scene.events.off('locationEntered', this.onLocationEntered, this);
  }
}
