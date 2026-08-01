/**
 * Journal Panel Component
 *
 * Displays quest log, notes, and discoveries in an explorer's journal style.
 */

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useQuestStore, JournalEntry } from '../../stores/questStore';
import { useGameStore } from '../../stores/gameStore';
import { useDialogueStore } from '../../stores/dialogueStore';

type TabType = 'quests' | 'notes' | 'discoveries';

/** Maximum journal entries rendered per tab (most recent kept). */
const MAX_RENDERED_ENTRIES = 50;
/** Pixels moved per arrow-key press. */
const SCROLL_STEP = 25;

export function JournalPanel() {
  const {
    activeQuests,
    journal,
    trackedObjective,
    getQuestStage,
    getNarrativeCurrents,
    setTrackedObjective,
  } = useQuestStore();
  const setJournalOpen = useGameStore((state) => state.setJournalOpen);
  const npcData = useDialogueStore((state) => state.allNPCData);

  const [currentTab, setCurrentTab] = useState<TabType>('quests');
  const [scrollOffset, setScrollOffset] = useState(0);

  // Scroll clamping: the content pane is translated upward, so the offset must
  // never exceed the amount of content that actually overflows the viewport.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const maxScrollRef = useRef(0);

  // Filter journal entries by category
  const questEntries = journal.filter((e) => e.category === 'quest');
  const discoveryEntries = journal.filter((e) => e.category === 'discovery');
  const rumorEntries = journal.filter((e) => e.category === 'rumor');
  const narrativeCurrents = getNarrativeCurrents();

  // Measure overflow after every render that can change content height
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const max = Math.max(0, content.scrollHeight - viewport.clientHeight);
    maxScrollRef.current = max;
    setScrollOffset((prev) => Math.min(prev, max));
  }, [currentTab, journal, activeQuests, narrativeCurrents.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
        case 'j':
        case 'J':
          setJournalOpen(false);
          break;
        case 'q':
        case 'Q':
          setCurrentTab('quests');
          setScrollOffset(0);
          break;
        case 'e':
        case 'E':
          setCurrentTab('notes');
          setScrollOffset(0);
          break;
        case 'd':
        case 'D':
          setCurrentTab('discoveries');
          setScrollOffset(0);
          break;
        case 'ArrowUp':
          setScrollOffset((prev) => Math.max(0, prev - SCROLL_STEP));
          break;
        case 'ArrowDown':
          setScrollOffset((prev) => Math.min(maxScrollRef.current, prev + SCROLL_STEP));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setJournalOpen]);

  // Format NPC names
  const formatNPCName = (npcId: string) => {
    return npcData[npcId]?.name || npcId;
  };

  // Format objective text
  const formatObjective = (
    obj: { type: string; target?: string; item?: string; amount?: number; description?: string; destination?: string; days?: number }
  ) => {
    switch (obj.type) {
      case 'talk':
        return `Talk to ${formatNPCName(obj.target || '')}`;
      case 'give':
        return `Give ${obj.item} to ${formatNPCName(obj.target || '')}`;
      case 'pay':
        return `Pay ${obj.amount} cruzados`;
      case 'explore':
      case 'location':
        return `Explore ${obj.target}`;
      case 'find':
      case 'obtain':
      case 'collect':
        return `Find ${obj.item || obj.target || 'the required item'}`;
      case 'search':
        return `Search ${obj.target}`;
      case 'stealth':
        return `Sneak through ${obj.target}`;
      case 'escort':
        return `Escort ${obj.target}${obj.destination ? ` to ${obj.destination}` : ''}`;
      case 'wait':
        return `Wait ${obj.days || 1} day(s)`;
      case 'go':
        return `Go to ${obj.target}`;
      default:
        return obj.description || 'Unknown objective';
    }
  };

  // Render the narrative quest log (category 'quest' journal entries).
  // These are written by questStore on quest start, stage advance, path choice
  // and completion, and were previously never displayed anywhere.
  const renderQuestChronicle = () => {
    if (questEntries.length === 0) return null;

    const entries = questEntries.slice(-MAX_RENDERED_ENTRIES);

    return (
      <div className="mt-5 pt-3">
        <h3 className="ui-caption ui-accent mb-2">
          Chronicle
        </h3>
        {questEntries.length > entries.length && (
          <p className="ui-body-soft text-xs italic mb-2">
            Showing the most recent {entries.length} of {questEntries.length} entries.
          </p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="mb-3">
            <span className="ui-keys text-xs">
              [{entry.timeString}]
            </span>
            <p className="ui-body font-crimson text-base mt-1 whitespace-pre-line">
              {entry.text}
            </p>
          </div>
        ))}
      </div>
    );
  };

  // Render quest list
  const renderQuests = () => {
    if (activeQuests.length === 0) {
      return (
        <>
          {narrativeCurrents.length > 0 ? (
            <div className="mb-4 ui-description-panel">
              <h3 className="ui-caption ui-accent mb-2">City Currents</h3>
              <div className="space-y-2">
                {narrativeCurrents.slice(0, 3).map((current) => (
                  <div key={current.id}>
                    <p className="ui-body text-base font-semibold">{current.title}</p>
                    <p className="ui-body-soft text-sm leading-5">{current.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <p className="ui-body-soft italic">
            No active quests.
            <br />
            Speak with townsfolk to find work...
          </p>
          {renderQuestChronicle()}
        </>
      );
    }

    return (
      <>
        {narrativeCurrents.length > 0 ? (
          <div className="mb-4 ui-description-panel">
            <h3 className="ui-caption ui-accent mb-2">City Currents</h3>
            <div className="space-y-2">
              {narrativeCurrents.slice(0, 3).map((current) => (
                <div key={current.id}>
                  <p className="ui-body text-base font-semibold">{current.title}</p>
                  <p className="ui-body-soft text-sm leading-5">{current.text}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {activeQuests.map((quest) => {
      const stage = getQuestStage(quest.id);

      return (
        <div key={quest.id} className="mb-4">
          <h3 className="font-crimson ui-body font-semibold flex items-center gap-2">
            <span className="ui-accent">⚜</span>
            {quest.name}
          </h3>
          {stage && (
            <>
              <ul className="ml-4 mt-2 space-y-1">
                {stage.objectives.map((obj) => (
                  <li
                    key={obj.id}
                    className={`flex items-center gap-2 text-sm ${
                      obj.completed ? 'ui-done' : 'ui-body-soft'
                    }`}
                  >
                    {trackedObjective?.questId === quest.id && trackedObjective?.objectiveId === obj.id ? (
                      <span className="ui-accent text-xs">◆</span>
                    ) : (
                      <span className="ui-body-soft text-xs">·</span>
                    )}
                    <span>{obj.completed ? '✓' : '○'}</span>
                    <button
                      onClick={() => setTrackedObjective(quest.id, obj.id)}
                      disabled={obj.completed}
                      className={`text-left ${
                        obj.completed
                          ? 'cursor-default'
                          : 'underline decoration-dotted underline-offset-2'
                      }`}
                      title={obj.completed ? 'Objective completed' : 'Track objective'}
                    >
                      {formatObjective(obj)}
                    </button>
                  </li>
                ))}
              </ul>

              {stage.isBranching && stage.availablePaths?.length ? (
                <div className="mt-3 ml-4 ui-description-panel">
                  <p className="ui-body-soft text-sm mb-2">
                    Paths now emerge through conversation, evidence, payment, or after-dark risk in the world.
                  </p>
                  <ul className="space-y-1 text-sm ui-body">
                    {stage.availablePaths.map((path) => (
                      <li key={path.id}>
                        <span className="ui-accent">•</span> {path.name}
                        {path.description ? ` — ${path.description}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      );
        })}
        {renderQuestChronicle()}
      </>
    );
  };

  // Render journal entries
  const renderJournal = (entries: JournalEntry[]) => {
    if (entries.length === 0) {
      return (
        <p className="ui-body-soft italic">
          Journal is empty.
          <br />
          Your adventures await...
        </p>
      );
    }

    return [...entries].reverse().slice(0, MAX_RENDERED_ENTRIES).map((entry) => (
      <div key={entry.id} className="mb-3">
        <span className="ui-keys text-xs">
          [{entry.timeString}]
        </span>
        <p className="ui-body font-crimson text-base mt-1 whitespace-pre-line">
          {entry.text}
        </p>
      </div>
    ));
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setJournalOpen(false)}
      />

      {/* Panel */}
      <div className="relative w-[620px] h-[460px]">
        {/* Main container — parchment 9-slice with hardwood scroll rods */}
        <div className="ui-panel-shell h-full">
          <div className="ui-parchment-panel h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="text-center pb-2">
              <div className="ui-scroll-rod mb-2" />
              <h2 className="ui-heading text-base">
                EXPLORER&apos;S JOURNAL
              </h2>
              <p className="ui-body-soft text-sm italic">
                Melaka, Anno Domini 1580
              </p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center gap-2 py-1">
              <button
                onClick={() => {
                  setCurrentTab('quests');
                  setScrollOffset(0);
                }}
                className={`journal-tab ${
                  currentTab === 'quests'
                    ? 'journal-tab-active'
                    : 'journal-tab-inactive'
                }`}
              >
                [QUESTS]
              </button>
              <button
                onClick={() => {
                  setCurrentTab('notes');
                  setScrollOffset(0);
                }}
                className={`journal-tab ${
                  currentTab === 'notes'
                    ? 'journal-tab-active'
                    : 'journal-tab-inactive'
                }`}
              >
                [NOTES]
              </button>
              <button
                onClick={() => {
                  setCurrentTab('discoveries');
                  setScrollOffset(0);
                }}
                className={`journal-tab ${
                  currentTab === 'discoveries'
                    ? 'journal-tab-active'
                    : 'journal-tab-inactive'
                }`}
              >
                [DISCOVERIES]
              </button>
            </div>

            <div className="ui-rule" />

            {/* Content */}
            <div ref={viewportRef} className="flex-1 overflow-hidden">
              <div
                ref={contentRef}
                className="px-2 py-3"
                style={{ transform: `translateY(-${scrollOffset}px)` }}
              >
                {currentTab === 'quests' && renderQuests()}
                {currentTab === 'notes' && renderJournal(rumorEntries)}
                {currentTab === 'discoveries' && renderJournal(discoveryEntries)}
              </div>
            </div>

            {/* Instructions */}
            <div className="text-center pt-2">
              <div className="ui-scroll-rod mb-2" />
              <span className="ui-keys">
                [J] close • [Q/E/D] tabs • [↑↓] scroll
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
