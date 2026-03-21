/**
 * Title Screen Component
 *
 * Main menu with Sierra/LucasArts style presentation.
 * Inspired by classic adventure games with modern polish.
 */

import React, { useState, useEffect } from 'react';
import { useSaveStore } from '../../stores/saveStore';

interface TitleScreenProps {
  onNewGame: () => void;
  onContinue: () => void;
  onCredits?: () => void;
}

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
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0f05] via-[#2a1a0a] to-[#0a0806]" />

      {/* Decorative corners */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-gold/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-gold/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-gold/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-gold/30" />

      {/* Content */}
      <div className="relative z-10 text-center">
        {/* Title */}
        <div className="mb-2">
          <h1 className="font-cinzel text-gold text-5xl font-bold tracking-wide text-shadow-gold">
            A FAMOSA
          </h1>
        </div>

        <div className="mb-8">
          <h2 className="font-cinzel text-parchment-300 text-2xl tracking-widest">
            Streets of Golden Melaka
          </h2>
        </div>

        {/* Subtitle */}
        <p className="font-crimson text-parchment-400 text-lg italic mb-12">
          Portuguese Malacca, Anno Domini 1580
        </p>

        {/* Menu */}
        <div className="space-y-3">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              onClick={() => item.enabled && item.action()}
              onMouseEnter={() => setSelectedIndex(index)}
              disabled={!item.enabled}
              className={`
                block w-64 mx-auto py-3 px-6 font-cinzel text-lg transition-all
                ${
                  !item.enabled
                    ? 'text-parchment-500/50 cursor-not-allowed'
                    : index === selectedIndex
                    ? 'text-gold border border-gold/50 bg-leather-300/30 shadow-gold-glow'
                    : 'text-parchment-300 hover:text-gold border border-transparent'
                }
              `}
            >
              {index === selectedIndex && item.enabled && (
                <span className="text-gold mr-2">▸</span>
              )}
              {item.label}
            </button>
          ))}
        </div>

        {/* Controls hint */}
        <div className="mt-16 text-parchment-500 text-sm font-mono">
          [↑↓] Select • [Enter] Confirm
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-parchment-500/60 text-xs">
          A Pixel Art Adventure RPG chasing the density and mood of Ultima VIII
        </p>
      </div>
    </div>
  );
}
