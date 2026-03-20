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
      ref={containerRef}
      id="game-container"
      className="w-full h-full flex items-center justify-center bg-[#0a0806]"
      style={{
        imageRendering: 'pixelated',
      }}
    />
  );
}
