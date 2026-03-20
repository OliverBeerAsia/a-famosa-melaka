/**
 * Game Configuration
 *
 * Core Phaser 3 configuration for A Famosa: Streets of Golden Melaka
 * - Fullscreen with proper scaling
 * - Pixel-perfect rendering
 * - Arcade physics for simple collision
 */

import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import TitleScene from './scenes/TitleScene';
import LoadingScene from './scenes/LoadingScene';
import GameScene from './scenes/GameScene';

// Base game resolution - 16:9 widescreen
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

// Pixel art settings
export const TILE_SIZE = 16;
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 32;

// Movement settings
export const PLAYER_SPEED = 100;

export const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a0806',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,  // Fit to container, maintain aspect ratio
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    expandParent: true,
    // Allow scaling up for larger screens
    min: {
      width: GAME_WIDTH / 2,
      height: GAME_HEIGHT / 2
    },
    max: {
      width: GAME_WIDTH * 3,
      height: GAME_HEIGHT * 3
    }
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [BootScene, TitleScene, LoadingScene, GameScene],
  render: {
    pixelArt: true,
    antialias: false,
    antialiasGL: false,
    roundPixels: true
  },
  // Disable the default Phaser loading screen
  banner: false
};
