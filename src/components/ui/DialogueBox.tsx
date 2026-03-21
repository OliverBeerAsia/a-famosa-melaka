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
import { getLocationName } from '../../data/locationNames';
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
    return (
      <div className="wax-seal ui-portrait-fallback flex-shrink-0">
        {npcName.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="ui-portrait-frame flex-shrink-0">
      <img
        src={`/sprites/portraits/${npcId}.png`}
        alt={npcName}
        className="ui-portrait-image"
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
  const portraitKey = currentNPC.portrait || currentNPC.id;
  const locationId = (currentNPC as { location?: string }).location;
  const locationLabel = locationId ? getLocationName(locationId) : 'Melaka';

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

  const getTopicTag = (topic: string): string | null => {
    const topicData = currentNPC.dialogue.topics[topic];
    if (!topicData) return null;

    if (topicData.questTrigger || topicData.questCritical) return 'Quest';
    if (topicData.takesMoney) return 'Trade';
    if (topicData.givesItem || topicData.takesItem) return 'Item';
    if (topicData.unlocks && topicData.unlocks.length > 0) return 'Lead';
    return null;
  };

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(920px,96vw)] animate-fade-in z-50">
      <div className="absolute inset-0 translate-x-2 translate-y-2 bg-black/45 rounded-[20px] blur-[1px]" />

      <div className="relative ui-dialogue-shell p-3 md:p-4">
        <div className="ui-parchment-panel p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:gap-5">
            <div className="flex items-start gap-4 md:w-[260px]">
              <PortraitImage npcId={portraitKey} npcName={currentNPC.name} />

              <div className="min-w-0 pt-1">
                <p className="ui-caption mb-1">{locationLabel}</p>
                <h3 className="font-cinzel text-crimson font-bold text-lg leading-tight">
                  {currentNPC.name}
                </h3>
                {currentNPC.title && (
                  <p className="text-sepia-light text-xs italic leading-snug mt-1">
                    {currentNPC.title}
                  </p>
                )}
                <p className="text-sepia-light/80 text-[11px] uppercase tracking-[0.2em] mt-3">
                  Speak carefully. Answers are not always free.
                </p>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="ui-dialogue-text">
                {displayedText}
                {isTyping && <span className="typewriter-cursor" />}
              </div>
            </div>
          </div>

          {typingComplete && availableTopics.length > 0 && (
            <div className="ui-topic-panel">
              <p className="ui-caption mb-3">
                Ask about
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableTopics.slice(0, 9).map((topic, index) => (
                  <button
                    key={topic}
                    onClick={() => handleTopicSelect(index)}
                    className={`topic-btn ui-topic-btn ${getTopicStyle(topic)}`}
                  >
                    <span className="ui-topic-number">[{index + 1}]</span>
                    <span className="flex-1 text-left leading-snug">{formatTopic(topic)}</span>
                    {getTopicTag(topic) && (
                      <span className="ui-topic-tag">{getTopicTag(topic)}</span>
                    )}
                  </button>
                ))}
              </div>
              {availableTopics.length > 9 && (
                <p className="text-sepia-light/60 text-xs mt-2">
                  + {availableTopics.length - 9} more topics...
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-sepia-light/20">
            <span className="text-sepia-light text-xs font-mono">
              {isTyping ? '[SPACE] skip' : '[1-9] ask • [ESC] close'}
            </span>
            <span className="text-sepia-light/60 text-[11px] uppercase tracking-[0.18em]">
              Melaka remembers everything
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
