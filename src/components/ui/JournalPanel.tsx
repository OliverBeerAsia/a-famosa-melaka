/**
 * Journal Panel Component
 *
 * Displays quest log, notes, and discoveries in an explorer's journal style.
 */

import React, { useState, useEffect } from 'react';
import { useQuestStore, JournalEntry } from '../../stores/questStore';
import { useGameStore } from '../../stores/gameStore';
import { useDialogueStore } from '../../stores/dialogueStore';

type TabType = 'quests' | 'notes' | 'discoveries';

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

  // Filter journal entries by category
  const discoveryEntries = journal.filter((e) => e.category === 'discovery');
  const rumorEntries = journal.filter((e) => e.category === 'rumor');
  const narrativeCurrents = getNarrativeCurrents();

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
        case 'ArrowUp':
          setScrollOffset((prev) => Math.max(0, prev - 25));
          break;
        case 'ArrowDown':
          setScrollOffset((prev) => prev + 25);
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

  // Render quest list
  const renderQuests = () => {
    if (activeQuests.length === 0) {
      return (
        <>
          {narrativeCurrents.length > 0 ? (
            <div className="mb-4 rounded border border-gold/20 bg-parchment-300/35 p-3">
              <h3 className="font-cinzel text-xs uppercase tracking-wide text-gold mb-2">City Currents</h3>
              <div className="space-y-2">
                {narrativeCurrents.slice(0, 3).map((current) => (
                  <div key={current.id}>
                    <p className="text-leather-200 text-sm font-semibold">{current.title}</p>
                    <p className="text-sepia text-xs leading-5">{current.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <p className="text-sepia-light italic">
            No active quests.
            <br />
            Speak with townsfolk to find work...
          </p>
        </>
      );
    }

    return (
      <>
        {narrativeCurrents.length > 0 ? (
          <div className="mb-4 rounded border border-gold/20 bg-parchment-300/35 p-3">
            <h3 className="font-cinzel text-xs uppercase tracking-wide text-gold mb-2">City Currents</h3>
            <div className="space-y-2">
              {narrativeCurrents.slice(0, 3).map((current) => (
                <div key={current.id}>
                  <p className="text-leather-200 text-sm font-semibold">{current.title}</p>
                  <p className="text-sepia text-xs leading-5">{current.text}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {activeQuests.map((quest) => {
      const stage = getQuestStage(quest.id);

      return (
        <div key={quest.id} className="mb-4">
          <h3 className="font-crimson text-leather-200 font-semibold flex items-center gap-2">
            <span className="text-gold">⚜</span>
            {quest.name}
          </h3>
          {stage && (
            <>
              <ul className="ml-4 mt-2 space-y-1">
                {stage.objectives.map((obj) => (
                  <li
                    key={obj.id}
                    className={`flex items-center gap-2 text-sm ${
                      obj.completed ? 'text-green-600' : 'text-sepia'
                    }`}
                  >
                    {trackedObjective?.questId === quest.id && trackedObjective?.objectiveId === obj.id ? (
                      <span className="text-gold text-[11px]">◆</span>
                    ) : (
                      <span className="text-sepia-light/50 text-[11px]">·</span>
                    )}
                    <span>{obj.completed ? '✓' : '○'}</span>
                    <button
                      onClick={() => setTrackedObjective(quest.id, obj.id)}
                      disabled={obj.completed}
                      className={`text-left ${
                        obj.completed
                          ? 'cursor-default'
                          : 'hover:text-leather-200 underline decoration-dotted underline-offset-2'
                      }`}
                      title={obj.completed ? 'Objective completed' : 'Track objective'}
                    >
                      {formatObjective(obj)}
                    </button>
                  </li>
                ))}
              </ul>

              {stage.isBranching && stage.availablePaths?.length ? (
                <div className="mt-3 ml-4 p-2 border border-gold/20 rounded bg-parchment-300/30">
                  <p className="text-xs text-sepia-light mb-2">
                    Paths now emerge through conversation, evidence, payment, or after-dark risk in the world.
                  </p>
                  <ul className="space-y-1 text-xs text-leather-200">
                    {stage.availablePaths.map((path) => (
                      <li key={path.id}>
                        <span className="text-gold">•</span> {path.name}
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
      </>
    );
  };

  // Render journal entries
  const renderJournal = (entries: JournalEntry[]) => {
    if (entries.length === 0) {
      return (
        <p className="text-sepia-light italic">
          Journal is empty.
          <br />
          Your adventures await...
        </p>
      );
    }

    return [...entries].reverse().slice(0, 10).map((entry) => (
      <div key={entry.id} className="mb-3">
        <span className="text-sepia-light text-xs font-mono">
          [{entry.timeString}]
        </span>
        <p className="text-leather-200 font-crimson text-sm mt-1">
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
      <div className="relative w-[550px] h-[400px]">
        {/* Shadow */}
        <div className="absolute inset-0 translate-x-1 translate-y-1 bg-black/50 rounded" />

        {/* Main container - leather cover */}
        <div className="relative bg-leather-200 border-2 border-gold rounded shadow-parchment h-full flex flex-col">
          {/* Inner parchment */}
          <div className="bg-parchment-100 m-2 flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="text-center py-3 border-b border-sepia-light/30">
              <h2 className="font-cinzel text-leather-200 text-xl font-bold">
                EXPLORER'S JOURNAL
              </h2>
              <p className="text-sepia-light text-xs italic">
                Melaka, Anno Domini 1580
              </p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center gap-4 py-2 border-b border-sepia-light/20">
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

            {/* Content */}
            <div
              className="flex-1 overflow-hidden px-4 py-3"
              style={{ transform: `translateY(-${scrollOffset}px)` }}
            >
              {currentTab === 'quests' && renderQuests()}
              {currentTab === 'notes' && renderJournal(rumorEntries)}
              {currentTab === 'discoveries' && renderJournal(discoveryEntries)}
            </div>

            {/* Instructions */}
            <div className="text-center py-2 border-t border-sepia-light/20">
              <span className="text-sepia text-xs font-mono">
                [J] close • [Q/E] tabs • [↑↓] scroll
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
