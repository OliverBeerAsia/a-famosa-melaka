/**
 * Valid Audio Placeholder Generator
 * 
 * Creates proper WAV audio files that will load correctly in Phaser/Web Audio API.
 * Uses simple sine wave tones for music and short bursts for SFX.
 * 
 * Run: node tools/create-valid-audio.js
 */

const fs = require('fs');
const path = require('path');

// Directories
const musicDir = path.join(__dirname, '..', 'assets', 'audio', 'music');
const sfxDir = path.join(__dirname, '..', 'assets', 'audio', 'sfx');

/**
 * Creates a valid WAV file buffer
 * @param {number} durationSecs - Duration in seconds
 * @param {number} frequency - Frequency in Hz (0 for silence)
 * @param {number} volume - Volume 0-1
 * @param {string} type - 'sine', 'ambient', 'sfx'
 */
function createWAV(durationSecs, frequency = 0, volume = 0.1, type = 'sine') {
  const sampleRate = 22050; // Lower sample rate for smaller files
  const numChannels = 1;    // Mono
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSecs);
  
  // Create audio data
  const audioData = new Int16Array(numSamples);
  const maxAmplitude = 32767 * volume;
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    if (type === 'sine' && frequency > 0) {
      // Simple sine wave
      sample = Math.sin(2 * Math.PI * frequency * t) * maxAmplitude;
    } else if (type === 'ambient') {
      // Ambient noise - gentle random variation
      const noise = (Math.random() - 0.5) * 0.1;
      const lowFreq = Math.sin(2 * Math.PI * 80 * t) * 0.3;
      const midFreq = Math.sin(2 * Math.PI * 200 * t) * 0.2;
      sample = (noise + lowFreq + midFreq) * maxAmplitude * 0.3;
    } else if (type === 'sfx') {
      // Short attack, quick decay
      const envelope = Math.exp(-t * 8);
      const freq = frequency || 440;
      sample = Math.sin(2 * Math.PI * freq * t) * maxAmplitude * envelope;
    } else if (type === 'music') {
      // Layered tones for music-like feel
      const f1 = frequency || 220;
      const f2 = f1 * 1.5; // Perfect fifth
      const f3 = f1 * 2;   // Octave
      const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.2 * t); // Slow swell
      sample = (
        Math.sin(2 * Math.PI * f1 * t) * 0.5 +
        Math.sin(2 * Math.PI * f2 * t) * 0.3 +
        Math.sin(2 * Math.PI * f3 * t) * 0.2
      ) * maxAmplitude * env * 0.5;
    }
    
    audioData[i] = Math.round(sample);
  }
  
  // Create WAV file buffer
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);           // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);            // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);  // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);   // SampleRate
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Copy audio data
  for (let i = 0; i < numSamples; i++) {
    buffer.writeInt16LE(audioData[i], 44 + i * 2);
  }
  
  return buffer;
}

// Music tracks with different base frequencies for variety
const musicTracks = [
  { name: 'music-main', freq: 220, duration: 5 },      // A3 - main theme
  { name: 'music-market', freq: 293, duration: 5 },   // D4 - lively
  { name: 'music-church', freq: 174, duration: 5 },   // F3 - contemplative
  { name: 'music-waterfront', freq: 196, duration: 5 }, // G3 - maritime
  { name: 'music-night', freq: 164, duration: 5 },    // E3 - mysterious
  { name: 'music-tension', freq: 130, duration: 5 },  // C3 - low, ominous
  { name: 'music-fortress', freq: 185, duration: 5 }  // F#3 - strong
];

// Ambient layers
const ambientLayers = [
  { name: 'base-tropical', type: 'ambient', duration: 3 },
  { name: 'fortress-ambience', type: 'ambient', duration: 3 },
  { name: 'distant-city', type: 'ambient', duration: 3 },
  { name: 'market-crowd', type: 'ambient', duration: 3 },
  { name: 'street-life', type: 'ambient', duration: 3 },
  { name: 'church-bells', freq: 523, type: 'music', duration: 2 }, // C5 bell
  { name: 'sacred-calm', type: 'ambient', duration: 3 },
  { name: 'water-lapping', type: 'ambient', duration: 3 },
  { name: 'harbor-activity', type: 'ambient', duration: 3 },
  { name: 'seagulls', freq: 880, type: 'sfx', duration: 1 },
  { name: 'village-life', type: 'ambient', duration: 3 },
  { name: 'jungle-sounds', type: 'ambient', duration: 3 },
  { name: 'morning-birds', freq: 1000, type: 'sfx', duration: 1 },
  { name: 'night-insects', type: 'ambient', duration: 3 },
  { name: 'cricket-chorus', freq: 4000, type: 'sfx', duration: 1 },
  { name: 'evening-calls', type: 'ambient', duration: 3 }
];

// Sound effects with distinct frequencies
const soundEffects = [
  { name: 'sfx-menu-select', freq: 660, duration: 0.1 },
  { name: 'sfx-dialogue-blip', freq: 440, duration: 0.05 },
  { name: 'sfx-item-pickup', freq: 880, duration: 0.15 },
  { name: 'sfx-door-open', freq: 220, duration: 0.3 },
  { name: 'sfx-footstep-stone', freq: 150, duration: 0.08 },
  { name: 'sfx-footstep-wood', freq: 200, duration: 0.08 },
  { name: 'sfx-footstep-dirt', freq: 100, duration: 0.08 },
  { name: 'sfx-coin-clink', freq: 1200, duration: 0.1 }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createPlaceholders() {
  console.log('🎵 Creating valid audio placeholder files...\n');
  
  ensureDir(musicDir);
  ensureDir(sfxDir);
  
  // Create music tracks
  console.log('Music Tracks:');
  musicTracks.forEach(track => {
    const filePath = path.join(musicDir, `${track.name}.wav`);
    const wav = createWAV(track.duration, track.freq, 0.15, 'music');
    fs.writeFileSync(filePath, wav);
    console.log(`  ✓ Created ${track.name}.wav (${track.duration}s)`);
  });
  
  // Create ambient layers
  console.log('\nAmbient Layers:');
  ambientLayers.forEach(layer => {
    const filePath = path.join(sfxDir, `${layer.name}.wav`);
    const wav = createWAV(layer.duration, layer.freq || 0, 0.1, layer.type || 'ambient');
    fs.writeFileSync(filePath, wav);
    console.log(`  ✓ Created ${layer.name}.wav`);
  });
  
  // Create sound effects
  console.log('\nSound Effects:');
  soundEffects.forEach(sfx => {
    const filePath = path.join(sfxDir, `${sfx.name}.wav`);
    const wav = createWAV(sfx.duration, sfx.freq, 0.2, 'sfx');
    fs.writeFileSync(filePath, wav);
    console.log(`  ✓ Created ${sfx.name}.wav`);
  });
  
  console.log('\n✅ Valid audio placeholders created!');
  console.log('\nAll files are now valid WAV format that browsers can decode.');
}

// Delete old MP3 files and create new WAV files
function cleanupOldFiles() {
  console.log('🧹 Cleaning up old MP3 placeholders...\n');
  
  const dirs = [musicDir, sfxDir];
  dirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        if (file.endsWith('.mp3')) {
          fs.unlinkSync(path.join(dir, file));
          console.log(`  Removed ${file}`);
        }
      });
    }
  });
  console.log('');
}

cleanupOldFiles();
createPlaceholders();

