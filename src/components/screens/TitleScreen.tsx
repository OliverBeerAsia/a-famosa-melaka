/**
 * Title Screen Component
 *
 * Main menu with Ultima VIII style presentation.
 * Inspired by classic adventure games with modern polish.
 */

import React, { useState, useEffect } from 'react';
import { useSaveStore } from '../../stores/saveStore';

interface TitleScreenProps {
  onNewGame: () => void;
  onContinue: () => void;
  onCredits?: () => void;
}

const TITLE_BACKGROUND = 'scenes/opening-screen.png';

export function TitleScreen({ onNewGame, onContinue, onCredits }: TitleScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasSavedGame, setHasSavedGame] = useState(false);

  // Check for saved games on mount
  useEffect(() => {
    const checkSaves = async () => {
      const saveStore = useSaveStore.getState();
      // Check if any slot has data
      for (let i = 0; i < 4; i++) {
        const meta = await saveStore.getSlotMeta(i);
        if (!meta.isEmpty) {
          setHasSavedGame(true);
          break;
        }
      }
    };
    checkSaves();
  }, []);

  const menuItems = [
    { label: 'New Game', action: onNewGame, enabled: true },
    { label: 'Continue', action: onContinue, enabled: hasSavedGame },
    { label: 'Credits', action: onCredits || (() => {}), enabled: !!onCredits },
  ];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
          break;
        case 'ArrowDown':
          setSelectedIndex((prev) => (prev + 1) % menuItems.length);
          break;
        case 'Enter':
        case ' ':
          const item = menuItems[selectedIndex];
          if (item.enabled) {
            item.action();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, menuItems]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0806] relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${TITLE_BACKGROUND}')`, imageRendering: 'pixelated' }}
        aria-hidden="true"
      />
      <div className="ui-screen-scrim" aria-hidden="true" />

      {/* Screen brackets — hardwood arms, brass corner plates */}
      <div className="ui-screen-corner ui-screen-corner--nw" />
      <div className="ui-screen-corner ui-screen-corner--ne" />
      <div className="ui-screen-corner ui-screen-corner--sw" />
      <div className="ui-screen-corner ui-screen-corner--se" />

      {/* Content */}
      <div className="relative z-10 text-center flex flex-col items-center">
        {/* Title cartouche — a brass-plated board nailed over the view. It also
            occludes the title baked into the placeholder backdrop, which would
            otherwise ghost behind this one. */}
        <div className="ui-dialogue-shell w-[min(680px,86vw)]">
          <div className="ui-parchment-panel py-4">
            <h1 className="ui-heading text-4xl tracking-wide leading-none">
              A FAMOSA
            </h1>
            <div className="ui-rule my-3 mx-auto w-[70%]" />
            <h2 className="font-cinzel text-base tracking-widest ui-body">
              Streets of Golden Melaka
            </h2>
            <p className="font-crimson ui-body-soft text-lg italic mt-2">
              Portuguese Malacca, Anno Domini 1580
            </p>
          </div>
        </div>

        {/* Menu */}
        <div className="mt-8 space-y-3">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              onClick={() => item.enabled && item.action()}
              onMouseEnter={() => item.enabled && setSelectedIndex(index)}
              disabled={!item.enabled}
              className={`ui-btn block w-[264px] mx-auto text-base ${
                item.enabled && index === selectedIndex ? 'ui-btn--selected' : ''
              }`}
              style={{ minHeight: 48 }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Controls hint */}
        <div className="mt-8 ui-keys-dark">
          [↑↓] Select • [Enter] Confirm
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="ui-caption" style={{ color: 'var(--wood-hi)' }}>
          A Pixel Art Adventure RPG chasing the density and mood of Ultima VIII
        </p>
      </div>
    </div>
  );
}
