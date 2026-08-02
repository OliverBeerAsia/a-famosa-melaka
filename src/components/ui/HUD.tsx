/**
 * HUD Component
 *
 * Displays time/location, quest tracker, and quick-travel controls.
 */

import React from 'react';
import { useGameStore, useTime, useLocation } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useQuestStore, QuestObjective } from '../../stores/questStore';
import { getLocationName } from '../../data/locationNames';
import { useDialogueStore } from '../../stores/dialogueStore';

function formatObjective(objective: QuestObjective): string {
  switch (objective.type) {
    case 'talk':
      return `Speak with ${objective.target || 'contact'}`;
    case 'give':
      return `Deliver ${objective.item || 'item'} to ${objective.target || 'contact'}`;
    case 'pay':
      return `Pay ${objective.amount || 0} cruzados`;
    case 'go':
    case 'location':
    case 'explore':
      return `Travel to ${getLocationName(objective.target || '')}`;
    case 'obtain':
    case 'find':
    case 'collect':
      return `Acquire ${objective.item || objective.target || 'item'}`;
    case 'wait':
      return `Wait ${objective.days || 1} day(s)`;
    case 'stealth':
      return `Move quietly through ${objective.target || 'the area'}`;
    case 'escort':
      return `Escort ${objective.target || 'target'}${objective.destination ? ` to ${objective.destination}` : ''}`;
    case 'search':
      return `Search ${objective.target || 'the area'}`;
    default:
      return objective.description;
  }
}

export function HUD() {
  const time = useTime();
  const location = useLocation();
  const trackedObjectiveData = useQuestStore((state) => state.getTrackedObjective());
  const activeQuestCount = useQuestStore((state) => state.activeQuests.length);
  const narrativeCurrents = useQuestStore((state) => state.getNarrativeCurrents());
  const npcData = useDialogueStore((state) => state.allNPCData);
  const isDialogueOpen = useGameStore((state) => state.isDialogueOpen);
  const isPaused = useGameStore((state) => state.isPaused);
  const onboarding = useGameStore((state) => state.onboarding);
  const completeTutorialBanner = useGameStore((state) => state.completeTutorialBanner);
  const inventoryItemCount = useInventoryStore((state) => state.items.length);

  React.useEffect(() => {
    if (onboarding && !onboarding.hasCompletedTutorialBanner) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          completeTutorialBanner();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [onboarding?.hasCompletedTutorialBanner, completeTutorialBanner]);

  // Format time string
  const timeString = `${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}`;

  // Time of day is carried by the CLOCK'S COLOUR, not by a second word beside
  // it: "Day 1 · day" read as a stutter, and the typography standard says to
  // emphasise with colour rather than with more type. All four are canon.
  const timeColors: Record<string, string> = {
    dawn: '#F5C860',   // lantern-flame
    day: '#D8A428',    // brass
    dusk: '#B47844',   // terracotta-3
    night: '#6098C8',  // sky-2
  };

  // Don't show during dialogue to reduce clutter
  if (isDialogueOpen) return null;

  const trackedQuestName = trackedObjectiveData?.questName || null;
  const trackedObjective = trackedObjectiveData?.objective || null;

  const tutorialHint = (() => {
    // Fires wherever the player currently stands (they spawn at A Famosa Gate,
    // not Rua Direita), so the very first screen always states a goal.
    if (activeQuestCount === 0 && !onboarding.hasStartedDialogue) {
      return {
        title: 'First Lead',
        text: location.id === 'rua-direita'
          ? 'Find Fernão Gomes here in Rua Direita and press [Space] to begin the investigation.'
          : 'Head to Rua Direita, find Fernão Gomes, and press [Space] to begin the investigation.',
      };
    }

    if (activeQuestCount > 0 && !onboarding.hasOpenedJournal) {
      return {
        title: 'Journal',
        text: 'Press [J] to review your current lead and keep the city\'s names and promises straight.',
      };
    }

    if (inventoryItemCount > 0 && !onboarding.hasOpenedInventory) {
      return {
        title: 'Inventory',
        text: 'Press [I] to inspect what you carry. Important clues now travel with you.',
      };
    }

    return null;
  })();

  const getObjectiveLocation = (objective: QuestObjective | null): string | null => {
    if (!objective) return null;

    if (['location', 'go', 'explore'].includes(objective.type)) {
      return objective.target || null;
    }

    if (['talk', 'give', 'pay'].includes(objective.type) && objective.target) {
      const npc = npcData[objective.target] as { location?: string } | undefined;
      return npc?.location || null;
    }

    if (objective.type === 'escort' && objective.destination) {
      return objective.destination;
    }

    return null;
  };

  const trackedObjectiveLocation = getObjectiveLocation(trackedObjective);

  const currentHighlights = narrativeCurrents.slice(0, 2);

  const getTravelHint = (from: string, to: string | null): string | null => {
    if (!to || from === to) return null;

    const hints: Record<string, Partial<Record<string, string>>> = {
      'rua-direita': {
        'a-famosa-gate': 'Follow the west street toward the fortress gate.',
        'waterfront': 'Head east along the market frontage to reach the quay.',
        'st-pauls-church': 'Climb north from the market toward the church hill.',
      },
      'waterfront': {
        'rua-direita': 'Take the west lane back toward the market street.',
        'a-famosa-gate': 'Use the bonded service lane north toward the fortress customs gate.',
        'kampung': 'Follow the eastern path beyond the docks into the kampung.',
      },
      'a-famosa-gate': {
        'rua-direita': 'Pass east through the gate approach into town.',
        'waterfront': 'Use the guarded service gate toward the bonded quay lane.',
      },
      'st-pauls-church': {
        'rua-direita': 'Descend south toward the market quarter.',
      },
      'kampung': {
        'waterfront': 'Walk west along the shoreline path to the harbor.',
      },
    };

    return hints[from]?.[to] || `Travel to ${getLocationName(to)} through the district exits.`;
  };

  const travelHint = getTravelHint(location.id, trackedObjectiveLocation);

  return (
    <>
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
        {/* Location indicator */}
        <div className="ui-chip">
          <span className="type-h2" style={{ color: 'var(--parch)' }}>{location.name}</span>
        </div>

        {/* Time indicator */}
        <div className="ui-chip flex flex-col items-end">
          <span
            className="type-numeral"
            style={{ color: timeColors[time.timeOfDay] || 'var(--brass)' }}
            title={time.timeOfDay}
          >
            {timeString}
          </span>
          <span className="type-caption" style={{ color: 'var(--parch-warm)' }}>
            Day {time.day}
          </span>
        </div>
      </div>

      {/* Quest tracker */}
      {(trackedQuestName && trackedObjective) || tutorialHint ? (
        <div className="absolute top-20 left-4 max-w-[420px] pointer-events-none">
          <div className="ui-chip">
            <p className="type-caption" style={{ color: 'var(--brass)' }}>
              {trackedQuestName && trackedObjective ? 'Quest Tracker' : tutorialHint?.title}
            </p>
            {trackedQuestName && trackedObjective ? (
              <>
                <p className="type-body" style={{ color: 'var(--parch)' }}>{trackedQuestName}</p>
                <p className="type-body" style={{ color: 'var(--parch-warm)' }}>{formatObjective(trackedObjective)}</p>
                {trackedObjectiveLocation && trackedObjectiveLocation !== location.id && (
                  <p className="type-body mt-1" style={{ color: 'var(--brass)' }}>
                    Travel to {getLocationName(trackedObjectiveLocation)}
                  </p>
                )}
              </>
            ) : (
              <p className="type-body" style={{ color: 'var(--parch-warm)' }}>{tutorialHint?.text}</p>
            )}

            {trackedQuestName && trackedObjective && currentHighlights.length > 0 && (
              <div className="mt-2 space-y-1 type-body">
                {currentHighlights.map((current) => (
                  <p
                    key={current.id}
                    className={
                      current.tone === 'favorable'
                        ? 'text-[#709C44]'
                        : current.tone === 'hostile'
                          ? 'text-[#B47844]'
                          : 'text-[#D8A428]'
                    }
                  >
                    {current.title}: {current.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!isPaused && travelHint && (
        <div className="absolute bottom-4 right-4 pointer-events-none">
          <div className="ui-chip max-w-[320px]">
            <p className="type-caption mb-1" style={{ color: 'var(--brass)' }}>Travel Guidance</p>
            <p className="type-body" style={{ color: 'var(--parch)' }}>{travelHint}</p>
          </div>
        </div>
      )}

      {!onboarding.hasCompletedTutorialBanner && (
        <div className="absolute bottom-20 left-0 right-0 mx-auto w-[min(560px,92vw)] z-50 pointer-events-auto">
          <div className="ui-panel-shell text-center">
          <div className="ui-parchment-panel">
            <h4 className="ui-heading type-h2 mb-2">
              Streets of Melaka — Controls
            </h4>
            <p className="ui-body-soft type-body mb-3 px-2 pb-2">
              Year 1580. The Portuguese fortress of A Famosa stands as a golden gateway to the East, but beneath the spice trade lies a web of debt, faith, and secrets...
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-left ui-body my-3 py-2">
              {[
                ['[W,A,S,D] / [Arrows]', 'Move Character'],
                ['[Space] / [Click]', 'Interact / Dialogue'],
                ['[I] Key', 'Open Inventory'],
                ['[J] Key', 'Open Quest Journal'],
              ].map(([keys, label]) => (
                <div key={keys} className="leading-tight">
                  <span className="ui-accent type-body block">{keys}</span>
                  <span className="ui-body-soft type-body">{label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={completeTutorialBanner}
              className="ui-btn mt-2"
            >
              Begin Journey
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Choice overlay for branching quest stages */}
      {(() => {
        const activeQuests = useQuestStore.getState().activeQuests;
        const bQuest = activeQuests.find((q) => {
          const stage = q.stages.find((s) => s.id === q.currentStageId);
          return stage?.isBranching;
        });
        const currentStage = bQuest
          ? bQuest.stages.find((s) => s.id === bQuest.currentStageId)
          : null;

        if (!bQuest || !currentStage || !currentStage.availablePaths) return null;

        return (
          <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-[100] pointer-events-auto">
            <div className="ui-panel-shell max-w-md w-full animate-fade-in text-center mx-4 relative">
            <div className="ui-parchment-panel">
              <h3 className="ui-heading mb-2">
                {currentStage.description || 'Make Your Choice'}
              </h3>
              <p className="ui-body-soft type-body mb-6">
                {bQuest.name}
              </p>
              <div className="space-y-3">
                {currentStage.availablePaths.map((path) => {
                  const check = useQuestStore.getState().canSelectPath(bQuest.id, path.id);
                  return (
                    <button
                      key={path.id}
                      disabled={!check.allowed}
                      onClick={() => {
                        useQuestStore.getState().requestPathSelection(path.id);
                      }}
                      className={`ui-topic-btn block text-left ${
                        check.allowed ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="type-body">{path.name}</span>
                        {!check.allowed && (
                          <span className="ui-topic-tag">
                            Locked
                          </span>
                        )}
                      </div>
                      {path.description && (
                        <p className="type-body mt-1" style={{ color: 'var(--parch-warm)' }}>{path.description}</p>
                      )}
                      {!check.allowed && check.reason && (
                        <p className="type-body mt-1" style={{ color: 'var(--parch-warm)' }}>
                          Requires: {check.reason}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
