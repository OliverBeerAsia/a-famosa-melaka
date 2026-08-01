/**
 * Pause Menu Component
 *
 * Settings, save/load, and return to title functionality.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { formatPlaytime, formatTimestamp, useSaveStore } from '../../stores/saveStore';
import { emitGameEvent, eventBridge } from '../../phaser/eventBridge';
import type { VisualQualityMode } from '../../phaser/visualProfile';

interface PauseMenuProps {
  onReturnToTitle: () => void;
}

export function PauseMenu({ onReturnToTitle }: PauseMenuProps) {
  const {
    setPaused,
    musicVolume,
    sfxVolume,
    ambientVolume,
    visualQualityMode,
    resolvedVisualQuality,
    dynamicVisualQuality,
    setMusicVolume,
    setSfxVolume,
    setAmbientVolume,
    setVisualQualityMode,
    setDynamicVisualQuality,
  } = useGameStore();
  const slots = useSaveStore((state) => state.slots);
  const initializeSlots = useSaveStore((state) => state.initializeSlots);
  const saveGame = useSaveStore((state) => state.saveGame);
  const loadGame = useSaveStore((state) => state.loadGame);
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    initializeSlots();
  }, [initializeSlots]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPaused(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setPaused]);

  const handleResume = () => {
    setPaused(false);
  };

  const handleSave = useCallback(async () => {
    const success = await saveGame(selectedSlot);
    setStatus(success ? `Saved to slot ${selectedSlot}` : 'Save failed');
    await initializeSlots();
  }, [initializeSlots, saveGame, selectedSlot]);

  const handleLoad = useCallback(async () => {
    const success = await loadGame(selectedSlot);
    if (!success) {
      setStatus('Load failed');
      return;
    }

    const location = useGameStore.getState().currentLocation;
    const game = eventBridge.getGame();
    const scene = game?.scene.getScene('GameScene');
    if (scene) {
      scene.scene.restart({ mapKey: location });
      emitGameEvent('scene:change', location);
    }

    setPaused(false);
    setStatus(`Loaded slot ${selectedSlot}`);
  }, [loadGame, selectedSlot, setPaused]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Panel */}
      <div className="relative w-[400px] max-h-[94vh] overflow-y-auto">
        {/* Main container */}
        <div className="ui-panel-shell">
          <div className="ui-parchment-panel">
            {/* Title */}
            <h2 className="ui-heading text-base text-center mb-3">
              PAUSED
            </h2>

            {/* Volume sliders */}
            <div className="space-y-2 mb-3">
              <div>
                <label className="block ui-body font-crimson text-sm mb-1">
                  Music Volume
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={musicVolume}
                  onChange={(e) => {
                    const volume = parseFloat(e.target.value);
                    setMusicVolume(volume);
                    emitGameEvent('settings:music:volume', volume);
                  }}
                  className="volume-slider"
                />
              </div>

              <div>
                <label className="block ui-body font-crimson text-sm mb-1">
                  Sound Effects
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={sfxVolume}
                  onChange={(e) => {
                    const volume = parseFloat(e.target.value);
                    setSfxVolume(volume);
                    emitGameEvent('settings:sfx:volume', volume);
                  }}
                  className="volume-slider"
                />
              </div>

              <div>
                <label className="block ui-body font-crimson text-sm mb-1">
                  Ambient Sounds
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={ambientVolume}
                  onChange={(e) => {
                    const volume = parseFloat(e.target.value);
                    setAmbientVolume(volume);
                    emitGameEvent('settings:ambient:volume', volume);
                  }}
                  className="volume-slider"
                />
              </div>

              <div>
                <label className="block ui-body font-crimson text-sm mb-1">
                  Visual Quality
                </label>
                <select
                  value={visualQualityMode}
                  onChange={(e) => {
                    const mode = e.target.value as VisualQualityMode;
                    setVisualQualityMode(mode);
                    emitGameEvent('settings:visual:mode', mode);
                  }}
                  className="ui-field"
                >
                  <option value="auto">Auto (Adaptive)</option>
                  <option value="high">High</option>
                  <option value="balanced">Balanced</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm ui-body font-crimson">
                <input
                  type="checkbox"
                  checked={dynamicVisualQuality}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setDynamicVisualQuality(enabled);
                    emitGameEvent('settings:visual:dynamic', enabled);
                  }}
                  className="accent-gold"
                />
                Dynamic quality scaling
              </label>
              <p className="ui-body-soft text-xs">
                Runtime profile: <span className="ui-accent capitalize">{resolvedVisualQuality}</span>
              </p>
            </div>

            {/* Save slots */}
            <div className="mb-3">
              <p className="ui-body font-crimson text-sm mb-2">Save Slot</p>
              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                {slots.map((slot) => (
                  <button
                    key={slot.index}
                    onClick={() => setSelectedSlot(slot.index)}
                    className={`ui-list-row ${slot.index === selectedSlot ? 'ui-list-row--active' : ''}`}
                  >
                    <span className="font-semibold">Slot {slot.index}</span>
                    <span className="mx-2">•</span>
                    <span>{slot.isEmpty ? 'Empty' : `${slot.locationName} • ${formatPlaytime(slot.playtime)}`}</span>
                    {!slot.isEmpty && (
                      <span className="block text-[10px] mt-0.5">
                        {formatTimestamp(slot.timestamp)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu buttons */}
            <div className="space-y-2">
              <button
                onClick={handleResume}
                className="menu-btn"
              >
                Resume Game
              </button>

              <button
                onClick={handleSave}
                className="menu-btn"
              >
                Save Game
              </button>

              <button
                onClick={handleLoad}
                className="menu-btn"
              >
                Load Game
              </button>

              <button
                onClick={onReturnToTitle}
                className="menu-btn"
              >
                Return to Title
              </button>
            </div>

            {/* Instructions */}
            <div className="text-center mt-3">
              <span className="ui-keys">
                [ESC] Resume
              </span>
              {status && (
                <p className="ui-accent text-xs mt-2">{status}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
