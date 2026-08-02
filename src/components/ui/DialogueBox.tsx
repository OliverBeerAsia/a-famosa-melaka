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
  'church': 'The Church on the Hill',
  'rumors': 'Rumors',
  'family': 'Your Family',
  'advice': 'Advice',
  'fortress': 'A Famosa',
  'duty': 'Your Duty',
  'garrison': 'The Garrison',
  'war': 'War Stories',
  'sultan': 'The Sultanate',
  'english': 'The English',
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
  'rest': 'Rest/Wait',
  'rest-dawn': 'Awaken at Dawn',
  'rest-noon': 'Awaken at Noon',
  'rest-night': 'Awaken at Night',
};

/** Topics shown per page — one per [1]-[9] hotkey. */
const TOPICS_PER_PAGE = 9;

/**
 * Portrait Image Component
 *
 * Displays character portrait with fallback to wax seal initial.
 */
function PortraitImage({ npcId, npcName }: { npcId: string; npcName: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="ui-portrait-frame flex items-center justify-center">
        <div className="wax-seal">
          {npcName.charAt(0).toUpperCase()}
        </div>
      </div>
    );
  }

  // The portrait is 80x80 native art shipped at x3; it is presented at its
  // full 240x240 so its pixel grid matches the world's. Anything smaller is a
  // downscale, i.e. a blurred or aliased portrait.
  return (
    <div className="ui-portrait-frame">
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
  const isResting = useGameStore((state) => state.isResting);

  // Displayed text (for typewriter effect)
  const [displayedText, setDisplayedText] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);

  // Topic paging: only TOPICS_PER_PAGE fit the 1-9 hotkeys, so anything beyond
  // that is reachable by cycling pages with [0] / arrow keys.
  const [topicPage, setTopicPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(availableTopics.length / TOPICS_PER_PAGE));
  const currentPage = Math.min(topicPage, pageCount - 1);
  const pageStart = currentPage * TOPICS_PER_PAGE;
  const visibleTopics = availableTopics.slice(pageStart, pageStart + TOPICS_PER_PAGE);

  // Reset to the first page whenever we start talking to a different NPC
  const npcId = currentNPC?.id;
  useEffect(() => {
    setTopicPage(0);
  }, [npcId]);

  // Keep the page in range when the topic list shrinks
  useEffect(() => {
    setTopicPage((prev) => (prev > pageCount - 1 ? pageCount - 1 : prev));
  }, [pageCount]);

  const cyclePage = useCallback((direction: 1 | -1) => {
    setTopicPage((prev) => {
      const clamped = Math.min(prev, pageCount - 1);
      return (clamped + direction + pageCount) % pageCount;
    });
  }, [pageCount]);

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
    if (isResting) return;
    if (isTyping) {
      setDisplayedText(currentText);
      setTyping(false);
      setTypingComplete(true);
      skipTyping();
    }
  }, [isTyping, currentText, setTyping, skipTyping, isResting]);

  // Handle topic selection (index is relative to the visible page)
  const handleTopicSelect = useCallback((index: number) => {
    if (isResting) return;
    const topic = availableTopics[pageStart + index];
    if (!typingComplete || !topic) return;

    // The topic list re-sorts after each answer, so return to the first page
    setTopicPage(0);
    selectTopic(topic);
  }, [typingComplete, availableTopics, pageStart, selectTopic, isResting]);

  // Handle close
  const handleClose = useCallback(() => {
    if (isResting) return;
    endDialogue();
    setDialogueOpen(false);
    emitGameEvent('ui:dialogue:close');
  }, [endDialogue, setDialogueOpen, isResting]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if no dialogue is open or if resting
      if (!currentNPC || isResting) return;

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
      } else if (e.key === '0' || e.key === 'ArrowRight') {
        if (pageCount <= 1) return;
        e.preventDefault();
        cyclePage(1);
      } else if (e.key === 'ArrowLeft') {
        if (pageCount <= 1) return;
        e.preventDefault();
        cyclePage(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentNPC, isTyping, handleSkip, handleClose, handleTopicSelect, isResting, cyclePage, pageCount]);

  if (!currentNPC) return null;
  const portraitKey = currentNPC.portrait || currentNPC.id;
  const locationId = (currentNPC as { location?: string }).location;
  const locationLabel = locationId ? getLocationName(locationId) : 'Melaka';

  const formatTopic = (topic: string): string => {
    if (topic.startsWith('pay-')) {
      const overrides = useDialogueStore.getState().dialogueOverrides[currentNPC.id] || {};
      const topicData = overrides[topic] || currentNPC.dialogue.topics[topic];
      const moneyMatch = topicData?.takesMoney;
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

  // Topic importance — a chrome variant, not a tint: quest-critical rows get
  // the brass bead, everything else the plain hardwood plaque.
  const getTopicStyle = (topic: string): string => {
    const topicData = currentNPC.dialogue.topics[topic];
    if (!topicData) return '';

    if (topicData.questTrigger || topicData.questCritical) return 'ui-topic-btn--quest';
    if (topicData.takesMoney) return 'ui-topic-btn--trade';
    if (topicData.givesItem) return 'ui-topic-btn--item';
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
    <div className="absolute bottom-3 left-0 right-0 mx-auto w-[min(940px,97vw)] animate-fade-in z-50">
      {/* Portrait column sits beside the text so the 240px portrait does not
          push the topic list off a 540px-tall screen. */}
      <div className="ui-dialogue-shell">
        <div className="ui-parchment-panel flex gap-5">
          {/* Left column: the portrait plus the speaker's card, so the column
              heights stay close and the parchment has no dead corner. */}
          <div className="hidden md:block w-[276px] shrink-0">
            <PortraitImage npcId={portraitKey} npcName={currentNPC.name} />
            <h3 className="ui-heading type-h2 mt-3">
              {currentNPC.name}
            </h3>
            {currentNPC.title && (
              <p className="ui-body-soft type-body">
                {currentNPC.title}
              </p>
            )}
            <p className="ui-caption mt-1">{locationLabel}</p>
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            {/* Repeated for the narrow layout, where the portrait is hidden. */}
            <div className="md:hidden mb-2">
              <h3 className="ui-heading type-h2">{currentNPC.name}</h3>
              <p className="ui-caption">{locationLabel}</p>
            </div>

            <div className="ui-dialogue-text min-h-[72px]">
              {displayedText}
              {isTyping && <span className="typewriter-cursor" />}
            </div>

            {availableTopics.length > 0 && (
              <div className={`mt-auto pt-3 transition-opacity duration-300 ${typingComplete ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <p className="ui-caption mb-2 flex items-center justify-between gap-3">
                  <span>Ask about</span>
                  {pageCount > 1 && (
                    <span className="normal-case tracking-normal">
                      Page {currentPage + 1} / {pageCount}
                    </span>
                  )}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {visibleTopics.map((topic, index) => (
                    <button
                      key={topic}
                      onClick={() => handleTopicSelect(index)}
                      className={`ui-topic-btn ${getTopicStyle(topic)}`}
                    >
                      <span className="ui-topic-number">[{index + 1}]</span>
                      <span className="flex-1 text-left">{formatTopic(topic)}</span>
                      {getTopicTag(topic) && (
                        <span className="ui-topic-tag">{getTopicTag(topic)}</span>
                      )}
                    </button>
                  ))}
                </div>
                {pageCount > 1 && (
                  <div className="mt-2">
                    <button
                      onClick={() => cyclePage(1)}
                      className="ui-topic-btn"
                      title="Show the next page of topics"
                    >
                      <span className="ui-topic-number">[0]</span>
                      <span className="flex-1 text-left">
                        More topics ({availableTopics.length - visibleTopics.length} others)
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="ui-rule mt-3" />
            <div className="flex items-center justify-between gap-6 pt-2">
              <span className="ui-keys whitespace-nowrap">
                {isTyping
                  ? '[SPACE] skip'
                  : pageCount > 1
                    ? '[1-9] ask • [0/←→] more topics • [ESC] close'
                    : '[1-9] ask • [ESC] close'}
              </span>
              <span className="ui-caption type-caption-tight truncate">Melaka remembers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
