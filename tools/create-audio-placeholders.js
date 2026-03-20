/**
 * Audio Placeholder Generator
 * 
 * Creates silent audio placeholders so the game can run without audio files.
 * These should be replaced with actual audio tracks for production.
 * 
 * Run: node tools/create-audio-placeholders.js
 * 
 * Audio Requirements (from briefing):
 * 
 * MUSIC TRACKS (6 required):
 * 1. music-main.mp3 - "Streets of Golden Melaka" - Wistful, adventurous main theme
 *    Style: Renaissance-meets-Gamelan fusion; Portuguese fado + Malay gamelan + Chinese melodic elements
 *    
 * 2. music-market.mp3 - "Market Day" - Lively, bustling, layered percussion
 *    Style: Energetic, crowded feel, multiple instrument layers
 *    
 * 3. music-church.mp3 - "St. Paul's Hill" - Contemplative, church bells, sacred calm
 *    Style: Church organ undertones, contemplative, peaceful
 *    
 * 4. music-waterfront.mp3 - "The Waterfront" - Sea shanty feel, waves, creaking wood
 *    Style: Maritime, Portuguese/Arab sailing influences
 *    
 * 5. music-night.mp3 - "Night in Melaka" - Mysterious, quieter, distant music
 *    Style: Nocturnal, atmospheric, cicadas underlying
 *    
 * 6. music-tension.mp3 - "Shadows" - Danger/tension for confrontations
 *    Style: Low, ominous, building intensity
 * 
 * AMBIENT SOUND LAYERS:
 * - base-tropical.mp3 - Cicadas, tropical birds, humid atmosphere
 * - fortress-ambience.mp3 - Stone echoes, distant commands, flags flapping
 * - distant-city.mp3 - Faint crowd murmur, distant bells
 * - market-crowd.mp3 - Haggling voices, crowd bustle
 * - street-life.mp3 - Footsteps, carts, merchant calls
 * - church-bells.mp3 - Periodic church bells
 * - sacred-calm.mp3 - Interior reverb, quiet murmurs
 * - water-lapping.mp3 - Waves against docks
 * - harbor-activity.mp3 - Ship creaks, loading sounds
 * - seagulls.mp3 - Seabird calls
 * - village-life.mp3 - Malay village sounds, cooking, conversations
 * - jungle-sounds.mp3 - Dense tropical forest ambience
 * - morning-birds.mp3 - Dawn bird chorus
 * - night-insects.mp3 - Crickets, night sounds
 * - cricket-chorus.mp3 - Intense cricket sounds
 * - evening-calls.mp3 - Dusk sounds, calls to prayer
 * 
 * UI SOUND EFFECTS:
 * - sfx-menu-select.mp3 - Menu selection click
 * - sfx-dialogue-blip.mp3 - Ultima-style character speech sound
 * - sfx-item-pickup.mp3 - Item collection sound
 * - sfx-door-open.mp3 - Door opening
 * - sfx-footstep-stone.mp3 - Footsteps on stone
 * - sfx-footstep-wood.mp3 - Footsteps on wood
 * - sfx-footstep-dirt.mp3 - Footsteps on dirt
 * - sfx-coin-clink.mp3 - Coin/money sound
 */

const fs = require('fs');
const path = require('path');

// Directories
const musicDir = path.join(__dirname, '..', 'assets', 'audio', 'music');
const sfxDir = path.join(__dirname, '..', 'assets', 'audio', 'sfx');

// Music tracks to create
const musicTracks = [
  'music-main',
  'music-market', 
  'music-church',
  'music-waterfront',
  'music-night',
  'music-tension',
  'music-fortress'
];

// Ambient layers
const ambientLayers = [
  'base-tropical',
  'fortress-ambience',
  'distant-city',
  'market-crowd',
  'street-life',
  'church-bells',
  'sacred-calm',
  'water-lapping',
  'harbor-activity',
  'seagulls',
  'village-life',
  'jungle-sounds',
  'morning-birds',
  'night-insects',
  'cricket-chorus',
  'evening-calls'
];

// Sound effects
const soundEffects = [
  'sfx-menu-select',
  'sfx-dialogue-blip',
  'sfx-item-pickup',
  'sfx-door-open',
  'sfx-footstep-stone',
  'sfx-footstep-wood',
  'sfx-footstep-dirt',
  'sfx-coin-clink'
];

// Create a minimal valid MP3 file (silence)
// This is a minimal valid MP3 frame - essentially silence
function createSilentMP3() {
  // Minimal MP3 with ID3v2 header and one silent frame
  // This is a properly formatted but silent MP3
  const buffer = Buffer.from([
    // ID3v2 header
    0x49, 0x44, 0x33, // "ID3"
    0x04, 0x00,       // Version 2.4.0
    0x00,             // Flags
    0x00, 0x00, 0x00, 0x00, // Size (0)
    // MP3 Frame header (320kbps, 44100Hz, stereo, no padding)
    0xFF, 0xFB, 0x90, 0x00,
    // Silent audio data
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  return buffer;
}

// Create OGG placeholder (simpler for web)
function createPlaceholderOGG() {
  // Minimal OGG file
  return Buffer.from([
    0x4F, 0x67, 0x67, 0x53, // "OggS"
    0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x1E, 0x01, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73
  ]);
}

// Ensure directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Create placeholder files
function createPlaceholders() {
  console.log('Creating audio placeholder files...\n');
  
  ensureDir(musicDir);
  ensureDir(sfxDir);
  
  const silentData = createSilentMP3();
  
  // Create music placeholders
  console.log('Music Tracks:');
  musicTracks.forEach(track => {
    const filePath = path.join(musicDir, `${track}.mp3`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, silentData);
      console.log(`  ✓ Created ${track}.mp3`);
    } else {
      console.log(`  - ${track}.mp3 already exists`);
    }
  });
  
  // Create ambient placeholders
  console.log('\nAmbient Layers:');
  ambientLayers.forEach(layer => {
    const filePath = path.join(sfxDir, `${layer}.mp3`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, silentData);
      console.log(`  ✓ Created ${layer}.mp3`);
    } else {
      console.log(`  - ${layer}.mp3 already exists`);
    }
  });
  
  // Create SFX placeholders
  console.log('\nSound Effects:');
  soundEffects.forEach(sfx => {
    const filePath = path.join(sfxDir, `${sfx}.mp3`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, silentData);
      console.log(`  ✓ Created ${sfx}.mp3`);
    } else {
      console.log(`  - ${sfx}.mp3 already exists`);
    }
  });
  
  console.log('\n✅ Audio placeholders created!');
  console.log('\nNext steps:');
  console.log('1. Replace placeholder files with actual audio');
  console.log('2. Use chiptune/lo-fi style per the briefing');
  console.log('3. Test audio in-game with: npm start');
  console.log('\nRecommended tools:');
  console.log('- FamiStudio for chiptune music');
  console.log('- LMMS for more complex tracks');
  console.log('- Audacity for editing/effects');
  console.log('- Freesound.org for ambient samples');
}

createPlaceholders();

