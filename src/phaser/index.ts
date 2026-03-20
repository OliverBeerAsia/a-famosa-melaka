/**
 * Phaser module exports
 */

export { createGame, destroyGame, createGameConfig, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, PLAYER_SPEED } from './game';
export { eventBridge, emitGameEvent, onGameEvent, useGameEvent } from './eventBridge';
export type { GameEvents, NPCInteractionData } from './eventBridge';
