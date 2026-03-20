/**
 * Main Entry Point
 *
 * Initializes the Phaser game instance with configuration
 */

import Phaser from 'phaser';
import { config } from './config';

// Create game instance
const game = new Phaser.Game(config);

// Log startup
console.log('A Famosa: Streets of Golden Melaka');
console.log('Game Resolution:', config.width, 'x', config.height);
console.log('Use arrow keys to move, Space to interact');

// Make game accessible globally for debugging
window.game = game;
