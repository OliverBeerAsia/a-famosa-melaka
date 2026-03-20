/**
 * Reputation System
 *
 * Tracks player standing with different cultural factions in Melaka:
 * - Portuguese (colonial authorities, merchants, military)
 * - Chinese (merchant guild, traders)
 * - Malay (local population, kampung)
 * - Arab (sailors, traders)
 *
 * Reputation affects:
 * - NPC dialogue and attitude
 * - Available quest paths
 * - Prices at merchants
 * - Access to certain areas/information
 */

export default class ReputationSystem {
  constructor(scene) {
    this.scene = scene;

    // Reputation values (-100 to +100)
    // 0 = neutral, positive = favorable, negative = hostile
    this.reputation = {
      portuguese: 0,
      chinese: 0,
      malay: 0,
      arab: 0
    };

    // Reputation thresholds
    this.thresholds = {
      hostile: -50,
      unfriendly: -25,
      neutral: 0,
      friendly: 25,
      trusted: 50,
      honored: 75
    };

    // Track reputation history for quest consequences
    this.reputationHistory = [];

    // Flags for major events
    this.worldFlags = new Set();
  }

  /**
   * Initialize from saved data or defaults
   */
  initialize(savedData = null) {
    if (savedData) {
      this.reputation = savedData.reputation || this.reputation;
      this.reputationHistory = savedData.history || [];
      this.worldFlags = new Set(savedData.flags || []);
    }

    // Listen for reputation-affecting events
    this.scene.events.on('reputationChange', this.onReputationChange, this);
    this.scene.events.on('questCompleted', this.onQuestCompleted, this);
    this.scene.events.on('npcInteraction', this.onNpcInteraction, this);

    console.log('ReputationSystem initialized:', this.reputation);
  }

  /**
   * Get reputation with a faction
   */
  getReputation(faction) {
    return this.reputation[faction] || 0;
  }

  /**
   * Get reputation level name
   */
  getReputationLevel(faction) {
    const rep = this.getReputation(faction);

    if (rep <= this.thresholds.hostile) return 'hostile';
    if (rep <= this.thresholds.unfriendly) return 'unfriendly';
    if (rep < this.thresholds.friendly) return 'neutral';
    if (rep < this.thresholds.trusted) return 'friendly';
    if (rep < this.thresholds.honored) return 'trusted';
    return 'honored';
  }

  /**
   * Modify reputation with a faction
   */
  modifyReputation(faction, amount, reason = 'unknown') {
    if (!this.reputation.hasOwnProperty(faction)) {
      console.warn(`Unknown faction: ${faction}`);
      return;
    }

    const oldValue = this.reputation[faction];
    const oldLevel = this.getReputationLevel(faction);

    // Apply change with diminishing returns at extremes
    let actualChange = amount;
    if (amount > 0 && this.reputation[faction] > 50) {
      actualChange = Math.floor(amount * 0.5); // Harder to gain at high rep
    } else if (amount < 0 && this.reputation[faction] < -50) {
      actualChange = Math.floor(amount * 0.5); // Harder to lose at low rep
    }

    // Clamp to -100 to +100
    this.reputation[faction] = Math.max(-100,
      Math.min(100, this.reputation[faction] + actualChange)
    );

    const newLevel = this.getReputationLevel(faction);

    // Log the change
    this.reputationHistory.push({
      faction,
      change: actualChange,
      reason,
      timestamp: Date.now(),
      newValue: this.reputation[faction]
    });

    // Emit events
    this.scene.events.emit('reputationModified', {
      faction,
      oldValue,
      newValue: this.reputation[faction],
      change: actualChange,
      reason
    });

    // Check for level change
    if (oldLevel !== newLevel) {
      this.scene.events.emit('reputationLevelChanged', {
        faction,
        oldLevel,
        newLevel
      });

      // Show notification to player
      this.showReputationChange(faction, oldLevel, newLevel);
    }

    console.log(`Reputation with ${faction}: ${oldValue} -> ${this.reputation[faction]} (${reason})`);
  }

  /**
   * Show reputation change notification
   */
  showReputationChange(faction, oldLevel, newLevel) {
    const factionNames = {
      portuguese: 'Portuguese',
      chinese: 'Chinese Guild',
      malay: 'Malay Community',
      arab: 'Arab Traders'
    };

    const levelDescriptions = {
      hostile: 'now view you with hostility',
      unfriendly: 'are unfriendly toward you',
      neutral: 'are neutral toward you',
      friendly: 'consider you a friend',
      trusted: 'trust you deeply',
      honored: 'honor you as one of their own'
    };

    const message = `The ${factionNames[faction]} ${levelDescriptions[newLevel]}.`;

    // Emit for UI to display
    this.scene.events.emit('showMessage', {
      text: message,
      type: 'reputation',
      faction: faction
    });
  }

  /**
   * Handle reputation changes from quest outcomes
   */
  onReputationChange(data) {
    if (data.reputation) {
      Object.entries(data.reputation).forEach(([faction, amount]) => {
        this.modifyReputation(faction, amount, data.reason || 'quest_outcome');
      });
    }
  }

  /**
   * Handle quest completion
   */
  onQuestCompleted(data) {
    if (data.consequences && data.consequences.reputation) {
      Object.entries(data.consequences.reputation).forEach(([faction, amount]) => {
        this.modifyReputation(faction, amount, `quest_${data.questId}`);
      });
    }

    // Handle world flags
    if (data.consequences && data.consequences.worldChanges) {
      data.consequences.worldChanges.forEach(flag => {
        this.setWorldFlag(flag);
      });
    }
  }

  /**
   * Handle NPC interactions that affect reputation
   */
  onNpcInteraction(data) {
    // Small reputation gains for positive interactions
    if (data.type === 'helped' && data.npcCulture) {
      this.modifyReputation(data.npcCulture, 1, `helped_${data.npcId}`);
    }
  }

  /**
   * Set a world flag (for tracking major events)
   */
  setWorldFlag(flag) {
    this.worldFlags.add(flag);
    this.scene.events.emit('worldFlagSet', { flag });
    console.log(`World flag set: ${flag}`);
  }

  /**
   * Check if a world flag is set
   */
  hasWorldFlag(flag) {
    return this.worldFlags.has(flag);
  }

  /**
   * Get dialogue modifier based on reputation
   */
  getDialogueModifier(npcCulture) {
    const level = this.getReputationLevel(npcCulture);

    return {
      hostile: {
        greetingModifier: 'hostile',
        topicsAvailable: ['minimal'],
        priceModifier: 1.5
      },
      unfriendly: {
        greetingModifier: 'cold',
        topicsAvailable: ['basic'],
        priceModifier: 1.25
      },
      neutral: {
        greetingModifier: 'normal',
        topicsAvailable: ['standard'],
        priceModifier: 1.0
      },
      friendly: {
        greetingModifier: 'warm',
        topicsAvailable: ['standard', 'friendly'],
        priceModifier: 0.9
      },
      trusted: {
        greetingModifier: 'trusted',
        topicsAvailable: ['standard', 'friendly', 'secret'],
        priceModifier: 0.8
      },
      honored: {
        greetingModifier: 'honored',
        topicsAvailable: ['all'],
        priceModifier: 0.7
      }
    }[level];
  }

  /**
   * Check if player has access to certain content based on reputation
   */
  hasAccess(requirement) {
    if (requirement.faction && requirement.minLevel) {
      const currentLevel = this.getReputationLevel(requirement.faction);
      const levels = ['hostile', 'unfriendly', 'neutral', 'friendly', 'trusted', 'honored'];
      const currentIndex = levels.indexOf(currentLevel);
      const requiredIndex = levels.indexOf(requirement.minLevel);
      return currentIndex >= requiredIndex;
    }
    return true;
  }

  /**
   * Get price modifier for merchants of a given culture
   */
  getPriceModifier(culture) {
    const modifier = this.getDialogueModifier(culture);
    return modifier ? modifier.priceModifier : 1.0;
  }

  /**
   * Get overall standing summary
   */
  getStandingSummary() {
    return {
      portuguese: {
        value: this.reputation.portuguese,
        level: this.getReputationLevel('portuguese'),
        description: this.getStandingDescription('portuguese')
      },
      chinese: {
        value: this.reputation.chinese,
        level: this.getReputationLevel('chinese'),
        description: this.getStandingDescription('chinese')
      },
      malay: {
        value: this.reputation.malay,
        level: this.getReputationLevel('malay'),
        description: this.getStandingDescription('malay')
      },
      arab: {
        value: this.reputation.arab,
        level: this.getReputationLevel('arab'),
        description: this.getStandingDescription('arab')
      }
    };
  }

  /**
   * Get descriptive text for a faction standing
   */
  getStandingDescription(faction) {
    const level = this.getReputationLevel(faction);
    const descriptions = {
      portuguese: {
        hostile: 'The Portuguese authorities view you as a threat. Guards watch you closely.',
        unfriendly: 'Portuguese officials are suspicious of your motives.',
        neutral: 'You are just another face in the colonial city.',
        friendly: 'Portuguese merchants nod respectfully when you pass.',
        trusted: 'You are known as a friend to Portuguese interests.',
        honored: 'You are celebrated as a hero of the Estado da India.'
      },
      chinese: {
        hostile: 'The Chinese guild has marked you as untrustworthy. Doors close at your approach.',
        unfriendly: 'Chinese merchants regard you with cold suspicion.',
        neutral: 'The Chinese community treats you as any other outsider.',
        friendly: 'Chinese traders offer you tea and fair prices.',
        trusted: 'The guild considers you a valuable trading partner.',
        honored: 'You are welcomed as an honored guest in Chinese homes.'
      },
      malay: {
        hostile: 'The kampung falls silent when you approach. You are not welcome here.',
        unfriendly: 'Malay villagers watch you with wary eyes.',
        neutral: 'You are a stranger in the kampung, tolerated but not embraced.',
        friendly: 'Malay families offer you food and share their stories.',
        trusted: 'The village elders speak openly with you.',
        honored: 'You are treated as family in the kampung.'
      },
      arab: {
        hostile: 'Arab sailors spit when they see you. Their dhows will not carry you.',
        unfriendly: 'Arab traders turn away when you approach their stalls.',
        neutral: 'Arab merchants deal with you fairly but without warmth.',
        friendly: 'Arab sailors share tales and palm wine with you.',
        trusted: 'You are known in coffee houses from Melaka to Aden.',
        honored: 'Arab captains would sail into storm for you.'
      }
    };

    return descriptions[faction][level];
  }

  /**
   * Save state
   */
  getSaveData() {
    return {
      reputation: { ...this.reputation },
      history: this.reputationHistory.slice(-50), // Keep last 50 entries
      flags: Array.from(this.worldFlags)
    };
  }

  /**
   * Clean up
   */
  destroy() {
    this.scene.events.off('reputationChange', this.onReputationChange, this);
    this.scene.events.off('questCompleted', this.onQuestCompleted, this);
    this.scene.events.off('npcInteraction', this.onNpcInteraction, this);
  }
}
