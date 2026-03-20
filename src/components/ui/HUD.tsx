/**
 * HUD Component
 *
 * Displays time/location, quest tracker, and quick-travel controls.
 */

import React from 'react';
import { useGameStore, useTime, useLocation } from '../../stores/gameStore';
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
  const reputation = useQuestStore((state) => state.reputation);
  const npcData = useDialogueStore((state) => state.allNPCData);
  const isDialogueOpen = useGameStore((state) => state.isDialogueOpen);
  const isPaused = useGameStore((state) => state.isPaused);

  // Format time string
  const timeString = `${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}`;

  // Time of day indicator color
  const timeColors = {
    dawn: 'text-orange-300',
    day: 'text-gold',
    dusk: 'text-orange-400',
    night: 'text-blue-300',
  };

  // Don't show during dialogue to reduce clutter
  if (isDialogueOpen) return null;

  const trackedQuestName = trackedObjectiveData?.questName || null;
  const trackedObjective = trackedObjectiveData?.objective || null;

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

  const repHighlights = (Object.entries(reputation) as Array<[string, number]>)
    .filter(([, value]) => Math.abs(value) >= 10)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 2);

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
        'kampung': 'Follow the eastern path beyond the docks into the kampung.',
      },
      'a-famosa-gate': {
        'rua-direita': 'Pass east through the gate approach into town.',
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
        <div className="bg-leather-300/85 px-4 py-2 rounded border border-gold/30 shadow-parchment">
          <span className="font-cinzel text-parchment-200">{location.name}</span>
        </div>

        {/* Time indicator */}
        <div className="bg-leather-300/85 px-4 py-2 rounded border border-gold/30 shadow-parchment flex flex-col items-end">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-lg ${timeColors[time.timeOfDay]}`}>
              {timeString}
            </span>
            <span className="text-parchment-400 text-sm capitalize">
              ({time.timeOfDay})
            </span>
          </div>
          <span className="text-parchment-400/80 text-xs">Day {time.day}</span>
        </div>
      </div>

      {/* Quest tracker */}
      <div className="absolute top-20 left-4 max-w-[420px] pointer-events-none">
        <div className="bg-leather-300/82 border border-gold/25 rounded px-3 py-2 shadow-parchment">
          <p className="font-cinzel text-gold text-xs uppercase tracking-wide">Quest Tracker</p>
          {trackedQuestName && trackedObjective ? (
            <>
              <p className="text-parchment-200 text-sm font-semibold">{trackedQuestName}</p>
              <p className="text-parchment-300/90 text-xs">{formatObjective(trackedObjective)}</p>
              {trackedObjectiveLocation && trackedObjectiveLocation !== location.id && (
                <p className="text-gold/90 text-[11px] mt-1">
                  Travel to {getLocationName(trackedObjectiveLocation)}
                </p>
              )}
            </>
          ) : (
            <p className="text-parchment-300/80 text-xs">No tracked objective. Speak to townsfolk for leads.</p>
          )}

          {repHighlights.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {repHighlights.map(([faction, value]) => (
                <span
                  key={faction}
                  className={`px-2 py-0.5 rounded border ${
                    value >= 0
                      ? 'border-emerald-600/40 text-emerald-300'
                      : 'border-rose-700/40 text-rose-300'
                  }`}
                >
                  {faction}: {value > 0 ? '+' : ''}{value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isPaused && travelHint && (
        <div className="absolute bottom-4 right-4 pointer-events-none">
          <div className="bg-leather-300/86 border border-gold/30 rounded px-3 py-2 shadow-parchment max-w-[320px]">
            <p className="font-cinzel text-gold text-xs uppercase tracking-wide mb-1">Travel Guidance</p>
            <p className="text-parchment-200 text-xs leading-5">{travelHint}</p>
          </div>
        </div>
      )}
    </>
  );
}
