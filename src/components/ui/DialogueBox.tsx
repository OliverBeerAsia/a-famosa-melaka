/**
 * Dialogue Box Component
 *
 * Displays NPC conversation with typewriter effect and topic selection.
 * Styled as a Portuguese-era parchment scroll.
 *
 * Features:
 * - Typewriter text effect with skip
 * - Topic-based conversation system
 * - Topic requirements (topics unlock other topics)
 * - Quest triggers
 * - Keyboard navigation (1-9 for topics, Space to skip, ESC to close)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDialogueStore } from '../../stores/dialogueStore';
import { useGameStore } from '../../stores/gameStore';
import { emitGameEvent, useGameEvent } from '../../phaser/eventBridge';

// Topic display names for better readability
const TOPIC_DISPLAY_NAMES: Record<string, string> = {
  'seal': 'The Missing Seal',
  'investigate': 'Investigation',
  'chen-wei': 'Chen Wei',
  'debt': 'The Debt',
  'spices': 'Spice Trade',
  'melaka': 'About Melaka',
  'portugal': 'Portugal',
  'chinese': 'Chinese Merchants',
  'weather': 'The Weather',
  'food': 'Local Food',
  'captain': 'The Captain',
  'church': 'St. Paul\'s Church',
  'rumors': 'Rumors',
  'family': 'Your Family',
  'advice': 'Advice',
  'fortress': 'A Famosa',
  'duty': 'Your Duty',
  'garrison': 'The Garrison',
  'war': 'War Stories',
  'sultan': 'The Sultanate',
  'dutch': 'The Dutch',
  'locals': 'Local People',
  'padre': 'Padre Tomás',
  'gomes': 'Fernão Gomes',
  'faith': 'The Faith',
  'conversion': 'Conversions',
  'xavier': 'St. Francis Xavier',
  'market': 'The Market',
  'gossip': 'Gossip',
  'kampung': 'The Kampung',
  'traditions': 'Traditions',
  'guild': 'Chinese Guild',
  'trade': 'Trade',
  'alternative': 'Another Way',
  'side-deal': 'The Deal',
  'settle-debt': 'Settle the Debt',
  'dig-deeper': 'Dig Deeper',
  'philosophy': 'Philosophy',
  'stories': 'Stories',
  'travels': 'Your Travels',
  'dhow': 'Your Ship',
  'cargo': 'The Cargo',
  'pirates': 'Pirates',
  'witness': 'What You Saw',
  'return-stolen-seal': 'Return the Seal',
};

/**
 * Portrait Image Component
 *
 * Displays character portrait with fallback to wax seal initial.
 */
function PortraitImage({ npcId, npcName }: { npcId: string; npcName: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    // Fallback to wax seal style
    return (
      <div className="wax-seal flex-shrink-0">
        {npcName.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-16 h-16 rounded border-2 border-gold/50 overflow-hidden bg-leather-100 shadow-inner">
      <img
        src={`/sprites/portraits/${npcId}.png`}
        alt={npcName}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export function DialogueBox() {
  const {
    currentNPC,
    currentText,
    availableTopics,
    isTyping,
    setTyping,
    skipTyping,
    selectTopic,
    endDialogue,
    startDialogue,
  } = useDialogueStore();

  const setDialogueOpen = useGameStore((state) => state.setDialogueOpen);

  // Displayed text (for typewriter effect)
  const [displayedText, setDisplayedText] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);

  // Listen for dialogue start events from Phaser
  useGameEvent('dialogue:start', (npcData) => {
    // Use the npc id to start dialogue via store
    startDialogue(npcData.id);
    setDialogueOpen(true);
  }, [startDialogue, setDialogueOpen]);

  // Typewriter effect
  useEffect(() => {
    if (!currentText) return;

    setDisplayedText('');
    setTypingComplete(false);
    setTyping(true);

    let index = 0;
    const speed = 18; // ms per character
    let cancelled = false;

    const timer = setInterval(() => {
      if (cancelled) return;

      if (index < currentText.length) {
        setDisplayedText(currentText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
        setTyping(false);
        setTypingComplete(true);
      }
    }, speed);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentText, setTyping]);

  // Handle skip typing
  const handleSkip = useCallback(() => {
    if (isTyping) {
      setDisplayedText(currentText);
      setTyping(false);
      setTypingComplete(true);
      skipTyping();
    }
  }, [isTyping, currentText, setTyping, skipTyping]);

  // Handle topic selection
  const handleTopicSelect = useCallback((index: number) => {
    if (!typingComplete || !availableTopics[index]) return;

    const topic = availableTopics[index];
    selectTopic(topic);
  }, [typingComplete, availableTopics, selectTopic]);

  // Handle close
  const handleClose = useCallback(() => {
    endDialogue();
    setDialogueOpen(false);
    emitGameEvent('ui:dialogue:close');
  }, [endDialogue, setDialogueOpen]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if no dialogue is open
      if (!currentNPC) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (isTyping) {
          handleSkip();
        }
      } else if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        handleTopicSelect(index);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentNPC, isTyping, handleSkip, handleClose, handleTopicSelect]);

  if (!currentNPC) return null;

  // Format topic name for display
  const formatTopic = (topic: string): string => {
    if (topic.startsWith('pay-')) {
      const moneyMatch = currentNPC.dialogue.topics[topic]?.takesMoney;
      return moneyMatch ? `Pay ${moneyMatch} cruzados` : 'Make Payment';
    }

    // Check custom display names first
    if (TOPIC_DISPLAY_NAMES[topic]) {
      return TOPIC_DISPLAY_NAMES[topic];
    }

    // Default: convert kebab-case to Title Case
    return topic
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get topic importance indicator
  const getTopicStyle = (topic: string): string => {
    const topicData = currentNPC.dialogue.topics[topic];
    if (!topicData) return '';

    if (topicData.questTrigger || topicData.questCritical) {
      return 'border-gold bg-gold/10'; // Important topics
    }
    if (topicData.takesMoney) {
      return 'border-amber-600/50 bg-amber-900/20';
    }
    if (topicData.givesItem) {
      return 'border-emerald-600/50 bg-emerald-900/20'; // Items
    }
    return '';
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[800px] max-w-[95vw] animate-fade-in z-50">
      {/* Shadow */}
      <div className="absolute inset-0 translate-x-1 translate-y-1 bg-black/50 rounded" />

      {/* Main container */}
      <div className="relative bg-parchment-200 border-2 border-gold rounded shadow-parchment">
        <div className="bg-parchment-100 m-1 p-4">
          {/* Header with portrait and NPC info */}
          <div className="flex gap-4 mb-3">
            {/* Character portrait with wax seal fallback */}
            <PortraitImage npcId={currentNPC.id} npcName={currentNPC.name} />

            {/* NPC info and dialogue */}
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <h3 className="font-cinzel text-crimson font-bold text-sm">
                  {currentNPC.name}
                </h3>
                {currentNPC.title && (
                  <p className="text-sepia-light text-xs italic">
                    {currentNPC.title}
                  </p>
                )}
              </div>

              {/* Dialogue text */}
              <div className="text-leather-200 font-crimson text-base leading-relaxed min-h-[60px]">
                {displayedText}
                {isTyping && <span className="typewriter-cursor" />}
              </div>
            </div>
          </div>

          {/* Topics section */}
          {typingComplete && availableTopics.length > 0 && (
            <div className="border-t border-sepia-light/30 pt-3 mt-2">
              <p className="text-sepia-light text-xs italic mb-2">
                — Ask About —
              </p>
              <div className="flex flex-wrap gap-2">
                {availableTopics.slice(0, 9).map((topic, index) => (
                  <button
                    key={topic}
                    onClick={() => handleTopicSelect(index)}
                    className={`topic-btn text-sm ${getTopicStyle(topic)}`}
                  >
                    <span className="text-gold mr-1">[{index + 1}]</span>
                    {formatTopic(topic)}
                  </button>
                ))}
              </div>
              {availableTopics.length > 9 && (
                <p className="text-sepia-light/50 text-xs mt-2">
                  + {availableTopics.length - 9} more topics...
                </p>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="text-right mt-2">
            <span className="text-sepia-light text-xs font-mono">
              {isTyping ? '[SPACE] skip' : '[1-9] ask • [ESC] leave'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
