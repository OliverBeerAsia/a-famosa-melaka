/**
 * Simple placeholder sprite generator
 * Creates basic placeholder PNG files from base64 data
 * Run with: node tools/create-placeholders.js
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');

// 16x32 player sprite (brown/tan colored rectangle)
const playerSprite = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAgCAYAAAAbifjMAAAASklEQVR42mNgGAWjYBSMAjwwb968/yC4cOHC/1A8CrABkH4QBtHYMEg9SP1/KMYGQOpB6v9DMTYAUg9S/x+KsQGQepD6/1CMAgYGAP9iLUH8QhPuAAAAAElFTkSuQmCC';

// 16x32 NPC sprite (darker brown rectangle)
const npcSprite = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAgCAYAAAAbifjMAAAASklEQVR42mNgGAWjYBSMAjywYMGC/yD4999//6F4FGADIPlADAz//v0bhkHqQer/QzE2AFIPUv8firEBkHqQ+v9QjA2A1IPU/4diAAAjQx4prqNsYwAAAABJRU5ErkJggg==';

// 16x16 ground tile (brownish)
const groundTile = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVR42mNgGAWjYBTgBQsWLPgPwv/+/fsPxaNgFIyCUTAKRsEoGAWjYBQMHzAKRgEAGl8eKcLCLpMAAAAASUVORK5CYII=';

// 16x16 grass tile (green)
const grassTile = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVR42mNgoDL4//8/Az4MUoeNQOrwYZA6fBikDh8GqcOHQerwYZA6fBikbhSMglEAALjhIimQ7JtNAAAAAElFTkSuQmCC';

// 16x16 water tile (blue)
const waterTile = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVR42mNgGHQgJCSEAR9ISUlhwIdB6vBhkDp8GKQOH4aqw4dB6vBhkDp8GKQOH0bBKBgFAJOBHCnoRxUJAAAAAElFTkSuQmCC';

// 16x16 stone tile (gray)
const stoneTile = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVR42mNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjAAA8jAIpw9IdjwAAAABJRU5ErkJggg==';

function savePlaceholder(base64Data, outputPath) {
  const buffer = Buffer.from(base64Data, 'base64');
  const dir = path.dirname(outputPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

// Create character placeholders
savePlaceholder(playerSprite, path.join(OUTPUT_DIR, 'characters', 'player.png'));
savePlaceholder(npcSprite, path.join(OUTPUT_DIR, 'characters', 'npc.png'));

// Create tile placeholders
savePlaceholder(groundTile, path.join(OUTPUT_DIR, 'tiles', 'ground.png'));
savePlaceholder(grassTile, path.join(OUTPUT_DIR, 'tiles', 'grass.png'));
savePlaceholder(waterTile, path.join(OUTPUT_DIR, 'tiles', 'water.png'));
savePlaceholder(stoneTile, path.join(OUTPUT_DIR, 'tiles', 'stone.png'));

console.log('\nPlaceholder sprites created successfully!');
console.log('You can now run: npm install && npm start');
