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
      <div className="relative w-[400px]">
        {/* Shadow */}
        <div className="absolute inset-0 translate-x-1 translate-y-1 bg-black/50 rounded" />

        {/* Main container */}
        <div className="relative bg-leather-200 border-2 border-gold rounded shadow-parchment">
          <div className="bg-parchment-200 m-2 p-6">
            {/* Title */}
            <h2 className="font-cinzel text-crimson text-2xl font-bold text-center mb-6">
              PAUSED
            </h2>

            {/* Volume sliders */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-leather-200 font-crimson text-sm mb-1">
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
                <label className="block text-leather-200 font-crimson text-sm mb-1">
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
                <label className="block text-leather-200 font-crimson text-sm mb-1">
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
                <label className="block text-leather-200 font-crimson text-sm mb-1">
                  Visual Quality
                </label>
                <select
                  value={visualQualityMode}
                  onChange={(e) => {
                    const mode = e.target.value as VisualQualityMode;
                    setVisualQualityMode(mode);
                    emitGameEvent('settings:visual:mode', mode);
                  }}
                  className="w-full bg-parchment-300/70 border border-sepia-light/40 rounded px-2 py-1 text-sm text-leather-200"
                >
                  <option value="auto">Auto (Adaptive)</option>
                  <option value="high">High</option>
                  <option value="balanced">Balanced</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-leather-200 font-crimson">
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
              <p className="text-[11px] text-sepia-light/80">
                Runtime profile: <span className="text-gold capitalize">{resolvedVisualQuality}</span>
              </p>
            </div>

            {/* Save slots */}
            <div className="mb-6">
              <p className="text-leather-200 font-crimson text-sm mb-2">Save Slot</p>
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {slots.map((slot) => (
                  <button
                    key={slot.index}
                    onClick={() => setSelectedSlot(slot.index)}
                    className={`w-full text-left px-2 py-1 rounded border text-xs ${
                      slot.index === selectedSlot
                        ? 'border-gold bg-gold/10 text-leather-200'
                        : 'border-sepia-light/30 text-sepia hover:border-gold/40'
                    }`}
                  >
                    <span className="font-semibold">Slot {slot.index}</span>
                    <span className="mx-2 text-sepia-light/70">•</span>
                    <span>{slot.isEmpty ? 'Empty' : `${slot.locationName} • ${formatPlaytime(slot.playtime)}`}</span>
                    {!slot.isEmpty && (
                      <span className="block text-[10px] text-sepia-light/70 mt-0.5">
                        {formatTimestamp(slot.timestamp)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu buttons */}
            <div className="space-y-3">
              <button
                onClick={handleResume}
                className="menu-btn w-full"
              >
                Resume Game
              </button>

              <button
                onClick={handleSave}
                className="menu-btn w-full"
              >
                Save Game
              </button>

              <button
                onClick={handleLoad}
                className="menu-btn w-full"
              >
                Load Game
              </button>

              <button
                onClick={onReturnToTitle}
                className="menu-btn w-full text-crimson hover:text-crimson-light"
              >
                Return to Title
              </button>
            </div>

            {/* Instructions */}
            <div className="text-center mt-4">
              <span className="text-sepia text-xs font-mono">
                [ESC] Resume
              </span>
              {status && (
                <p className="text-gold text-xs mt-2">{status}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
