/**
 * Game Canvas Component
 *
 * Embeds the Phaser game into the React component tree.
 * Handles game lifecycle and cleanup.
 */

import React, { useEffect, useRef } from 'react';
import { createGame, destroyGame } from '../phaser/game';
import { useGameStore } from '../stores/gameStore';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const setGameReady = useGameStore((state) => state.setGameReady);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    // Create Phaser game
    gameRef.current = createGame(containerRef.current);

    // Mark game as ready once boot scene completes
    gameRef.current.events.once('ready', () => {
      setGameReady(true);
    });

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        destroyGame(gameRef.current);
        gameRef.current = null;
        setGameReady(false);
      }
    };
  }, [setGameReady]);

  return (
    <div
      className="w-full h-full relative flex items-center justify-center bg-[#0a0806]"
    >
      <div
        ref={containerRef}
        id="game-container"
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      {/* Atmospheric vignette overlay — darkens edges, focuses centre */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 45%, rgba(5,3,1,0.38) 72%, rgba(5,3,1,0.72) 100%)',
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}
