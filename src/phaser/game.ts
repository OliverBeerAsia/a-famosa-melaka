/**
 * Phaser Game Configuration and Initialization
 *
 * Creates and configures the Phaser game instance for embedding in React.
 */

import Phaser from 'phaser';
import { eventBridge, emitGameEvent } from './eventBridge';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

// Base game resolution - 16:9 widescreen
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

// Game settings
export const TILE_SIZE = 16;
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 32;
export const PLAYER_SPEED = 180; // Adjusted for 3x scaled characters

// Character scale factor (sprites designed for 320×180, displayed at 960×540)
export const CHARACTER_SCALE = 3;

// Isometric tile dimensions (2:1 ratio)
export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;

/**
 * Create Phaser game configuration
 */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0a0806',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      expandParent: true,
      min: {
        width: GAME_WIDTH / 2,
        height: GAME_HEIGHT / 2,
      },
      max: {
        width: GAME_WIDTH * 3,
        height: GAME_HEIGHT * 3,
      },
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, GameScene],
    render: {
      pixelArt: true,
      antialias: false,
      antialiasGL: false,
      roundPixels: true,
    },
    banner: false,
  };
}

/**
 * Create and initialize the Phaser game
 */
export function createGame(parent: HTMLElement): Phaser.Game {
  const config = createGameConfig(parent);
  const game = new Phaser.Game(config);

  // Register with event bridge
  eventBridge.setGame(game);

  // Set up global error handling
  game.events.on('error', (error: Error) => {
    console.error('Phaser error:', error);
  });

  // Emit ready event when boot completes
  game.events.once('ready', () => {
    emitGameEvent('game:ready');
  });

  return game;
}

/**
 * Destroy the Phaser game instance
 */
export function destroyGame(game: Phaser.Game) {
  eventBridge.clear();
  game.destroy(true);
}
