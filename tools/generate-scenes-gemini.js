/**
 * Scene Generator using Google Gemini API (Nano Banana)
 * 
 * Generates Ultima VIII style adventure game scenes for:
 * - Opening/Title screen
 * - Location interstitials (5 locations)
 * - Character portraits
 * 
 * Style: Dense atmospheric pixel art in the Ultima VIII tradition
 * 
 * NOTE: This script automatically backs up existing scenes before generating!
 *       Use --no-backup to skip backup.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { getStyleHeader } = require('./load-style-header.cjs');

// API Configuration  
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-image';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
if (!API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'scenes');
const BACKUP_SCRIPT = path.join(__dirname, 'backup-assets.js');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Auto-backup scenes before regenerating
 */
function backupScenesIfExists() {
  // Check if there are existing scene files
  const existingFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  
  if (existingFiles.length === 0) {
    console.log('📁 No existing scenes to backup.\n');
    return;
  }

  console.log('🔄 Backing up existing scenes before regenerating...\n');
  
  try {
    // Run backup script
    execSync(`node "${BACKUP_SCRIPT}" scenes`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('');
  } catch (error) {
    console.log('⚠️  Backup failed, but continuing with generation...\n');
  }
}

// Base style for Ultima VIII scenes — loaded from canonical style header
const STYLE_PREFIX = getStyleHeader('scene-backdrop');

// Scene definitions
const SCENES = {
  // Opening/Title screen
  opening: {
    name: 'opening-screen',
    prompt: `A breathtaking panoramic view of Portuguese Melaka harbor at golden sunset, 1580.

COMPOSITION:
- Foreground: Weathered wooden dock with coiled ropes, barrels, and a Portuguese flag
- Middle ground: Busy harbor with Portuguese carracks, Arab dhows, and Chinese junks with colorful sails
- Background: The iconic A Famosa fortress on the hill, whitewashed buildings, St. Paul's Church silhouette
- Sky: Dramatic golden-orange sunset with wispy clouds reflecting on calm harbor water

ATMOSPHERE:
- Warm golden light casting long shadows
- Smoke rising from cooking fires in the distance
- Birds (seagulls) flying across the sky
- Slight heat haze over the water
- Sense of adventure and exotic mystery

This is the title screen - make it EPIC and inviting, capturing the romance of the Age of Exploration.`
  },

  // Location interstitials
  'a-famosa-gate': {
    name: 'scene-a-famosa',
    prompt: `The imposing A Famosa fortress gate in Portuguese Melaka, 1580, at midday.

COMPOSITION:
- Massive stone gateway with Portuguese coat of arms carved above the arch
- Two guards in morion helmets and breastplates standing at attention
- Heavy wooden doors partially open, revealing cobblestone courtyard beyond
- Fortress walls extending to both sides with cannon emplacements
- Portuguese red and green banners hanging from the walls
- Palm trees framing the scene on the sides

ATMOSPHERE:
- Harsh tropical sunlight creating strong shadows
- Heat shimmer rising from the stone
- Sense of military power and colonial authority
- Some tropical vines growing on ancient stonework
- A few civilians passing through the gate

Style: Dense Ultima VIII-era cinematic composition, detailed and atmospheric.`
  },

  'rua-direita': {
    name: 'scene-rua-direita',
    prompt: `The bustling main street (Rua Direita) of Portuguese Melaka, 1580.

COMPOSITION:
- Narrow cobblestone street winding between buildings
- Portuguese whitewashed buildings with terracotta roofs on both sides
- Colorful market awnings (red/white stripes, blue/yellow) shading stalls
- Market stalls overflowing with: golden spices, silk fabrics, Chinese porcelain
- Diverse crowd: Portuguese merchants, Malay vendors, Chinese traders, Arab sailors
- Hanging lanterns and shop signs
- A tavern with a wooden tankard sign visible

ATMOSPHERE:
- Dappled sunlight filtering through awnings
- Vibrant colors and busy activity
- Sense of exotic commerce and cultural mixing
- Warm afternoon light
- Distant view of fortress on hill through a gap in buildings

Style: Dense Ultima VIII-era cinematic composition, rich detail, bustling life.`
  },

  'st-pauls-church': {
    name: 'scene-st-pauls',
    prompt: `St. Paul's Church on the hill overlooking Melaka Strait, 1580.

COMPOSITION:
- White limestone church with bell tower in center
- Stone steps leading up to the entrance with iron railings
- Graveyard with Portuguese tombstones and crosses
- Jesuit priest in black robes standing near the entrance
- View of the strait and distant ships through palm trees
- Well-maintained garden with tropical flowers

ATMOSPHERE:
- Peaceful, contemplative mood
- Soft morning light filtering through clouds
- Church bells suggesting recent ringing
- Cool shadows under the palm trees
- Contrast between sacred European architecture and tropical setting

Style: Dense Ultima VIII-era cinematic composition, serene and spiritual.`
  },

  'waterfront': {
    name: 'scene-waterfront',
    prompt: `The busy waterfront quay of Melaka harbor, 1580.

COMPOSITION:
- Wooden dock planks in foreground with rope coils and anchor chains
- Multiple ships moored: Portuguese carrack (large, prominent), Arab dhow, Chinese junk
- Sailors loading/unloading cargo: barrels, crates, silk bales
- Harbor master's counting house (wooden building with scales visible)
- Seagulls on posts, fishing nets drying
- View across the calm harbor water to distant horizon

ATMOSPHERE:
- Salt air and maritime activity
- Late afternoon light reflecting off the water
- Sailors of many nationalities working together
- Sense of global trade and adventure
- Creaking wood and lapping waves implied

Style: Dense Ultima VIII-era cinematic composition, nautical and adventurous.`
  },

  'kampung': {
    name: 'scene-kampung',
    prompt: `Traditional Malay kampung (village) quarter of Melaka, 1580.

COMPOSITION:
- Traditional wooden houses on stilts (rumah panggung) with thatched roofs
- Coconut palms and banana trees throughout
- Malay villagers in traditional dress going about daily life
- Cooking fire with clay pots, women preparing food
- Children playing, chickens scratching in the dirt
- A small prayer house (surau) visible in the background
- Woven mats and batik cloth hanging to dry

ATMOSPHERE:
- Peaceful evening time, golden hour light
- Fireflies beginning to appear
- Sound of gamelan music implied
- Contrast with colonial Portuguese areas
- Authentic traditional Malay village life

Style: Dense Ultima VIII-era cinematic composition, warm and cultural.`
  }
};

/**
 * Generate scene image using Gemini API
 */
async function generateScene(prompt, outputPath) {
  const fullPrompt = `${STYLE_PREFIX}\n\nSCENE TO CREATE:\n${prompt}`;
  
  const requestBody = JSON.stringify({
    contents: [{
      parts: [{ text: fullPrompt }]
    }],
    generationConfig: {
      // Request 16:9 aspect ratio for widescreen
    }
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}?key=${API_KEY}`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.error) {
            reject(new Error(`API Error: ${response.error.message}`));
            return;
          }
          
          if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData && part.inlineData.data) {
                const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                fs.writeFileSync(outputPath, imageBuffer);
                resolve({ success: true, path: outputPath });
                return;
              }
              if (part.text) {
                console.log('    📝', part.text.substring(0, 80) + '...');
              }
            }
          }
          
          reject(new Error('No image data in response'));
          
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout (scenes are complex, may need longer)'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Generate all scenes
 */
async function generateAllScenes() {
  console.log('\n🎨 A Famosa Scene Generator - Ultima VIII Style\n');
  console.log('Model:', MODEL);
  console.log('=' .repeat(60) + '\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const [key, scene] of Object.entries(SCENES)) {
    const outputPath = path.join(OUTPUT_DIR, `${scene.name}.png`);
    console.log(`\n🖼️  Generating: ${scene.name}`);
    console.log(`   ${key === 'opening' ? '(Title Screen)' : '(Location: ' + key + ')'}`);
    
    try {
      await generateScene(scene.prompt, outputPath);
      console.log(`   ✅ Saved: ${scene.name}.png`);
      successCount++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      failCount++;
    }
    
    // Rate limiting - longer wait for complex scenes
    console.log('   ⏳ Waiting for rate limit...');
    await new Promise(r => setTimeout(r, 5000));
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`\n✅ Complete! ${successCount} scenes generated, ${failCount} failed.`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
}

/**
 * Generate a single scene by key
 */
async function generateSingle(key) {
  const scene = SCENES[key];
  if (!scene) {
    console.log(`❌ Scene '${key}' not found.\n`);
    console.log('Available scenes:');
    Object.keys(SCENES).forEach(k => console.log(`  - ${k}`));
    return;
  }
  
  const outputPath = path.join(OUTPUT_DIR, `${scene.name}.png`);
  console.log(`\n🖼️  Generating: ${scene.name}`);
  
  try {
    await generateScene(scene.prompt, outputPath);
    console.log(`✅ Saved: ${outputPath}\n`);
  } catch (error) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const skipBackup = args.includes('--no-backup');
  
  if (args.includes('--all')) {
    // Auto-backup before generating all scenes
    if (!skipBackup) {
      backupScenesIfExists();
    }
    await generateAllScenes();
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    // Auto-backup before generating single scene
    if (!skipBackup) {
      backupScenesIfExists();
    }
    await generateSingle(args[0]);
  } else {
    console.log('\n🎨 A Famosa Scene Generator\n');
    console.log('Generates Ultima VIII style adventure game scenes\n');
    console.log('⚠️  NOTE: Automatically backs up existing scenes before generating!\n');
    console.log('Usage:');
    console.log('  node generate-scenes-gemini.js --all              Generate ALL scenes');
    console.log('  node generate-scenes-gemini.js <scene-name>       Generate single scene');
    console.log('  node generate-scenes-gemini.js --all --no-backup  Skip backup');
    console.log('\nAvailable scenes:');
    Object.entries(SCENES).forEach(([key, scene]) => {
      console.log(`  - ${key.padEnd(20)} → ${scene.name}.png`);
    });
    console.log('');
  }
}

main().catch(console.error);
