/**
 * Scene Variant Generator using Google Gemini API
 *
 * Generates time-of-day variants (dawn, dusk, night) for existing scene backgrounds.
 * Creates 15 scene variants (5 locations × 3 times of day).
 *
 * Style: Late 90s Sierra/LucasArts adventure games (Monkey Island, Quest for Glory)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// API Configuration
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-image';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
if (!API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'scenes');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Base style prefix
const STYLE_PREFIX = `Create a detailed pixel art scene in the style of late 1990s Sierra and LucasArts adventure games (like Monkey Island 3, Quest for Glory 4).

STYLE REQUIREMENTS:
- High-quality pixel art with rich detail and depth
- 16:9 widescreen aspect ratio
- Painterly pixel art with smooth gradients and careful dithering
- Historical accuracy for 1580s Portuguese Melaka
- Southeast Asian tropical setting with Portuguese colonial architecture
- NO text, NO UI elements, NO watermarks - pure scene artwork
`;

// Location base descriptions
const LOCATIONS = {
  'a-famosa': {
    name: 'A Famosa Fortress Gate',
    baseDescription: `The imposing A Famosa fortress gate in Portuguese Melaka, 1580.

COMPOSITION:
- Massive stone gateway with Portuguese coat of arms carved above the arch
- Two guards in morion helmets and breastplates standing at attention
- Heavy wooden doors partially open, revealing cobblestone courtyard beyond
- Fortress walls extending to both sides with cannon emplacements
- Portuguese red and green banners hanging from the walls
- Palm trees framing the scene on the sides`,
  },

  'rua-direita': {
    name: 'Rua Direita Market',
    baseDescription: `The bustling main street (Rua Direita) of Portuguese Melaka, 1580.

COMPOSITION:
- Narrow cobblestone street winding between buildings
- Portuguese whitewashed buildings with terracotta roofs on both sides
- Colorful market awnings (red/white stripes, blue/yellow) shading stalls
- Market stalls with golden spices, silk fabrics, Chinese porcelain
- Diverse crowd: Portuguese merchants, Malay vendors, Chinese traders
- Hanging lanterns and shop signs
- A tavern with a wooden tankard sign visible`,
  },

  'st-pauls': {
    name: "St. Paul's Church",
    baseDescription: `St. Paul's Church on the hill overlooking Melaka Strait, 1580.

COMPOSITION:
- White limestone church with bell tower in center
- Stone steps leading up to the entrance with iron railings
- Graveyard with Portuguese tombstones and crosses
- View of the strait and distant ships through palm trees
- Well-maintained garden with tropical flowers`,
  },

  'waterfront': {
    name: 'The Waterfront Quay',
    baseDescription: `The busy waterfront quay of Melaka harbor, 1580.

COMPOSITION:
- Wooden dock planks in foreground with rope coils and anchor chains
- Multiple ships moored: Portuguese carrack, Arab dhow, Chinese junk
- Sailors loading/unloading cargo: barrels, crates, silk bales
- Harbor master's counting house (wooden building with scales visible)
- Seagulls on posts, fishing nets drying
- View across the calm harbor water to distant horizon`,
  },

  'kampung': {
    name: 'Kampung Quarter',
    baseDescription: `Traditional Malay kampung (village) quarter of Melaka, 1580.

COMPOSITION:
- Traditional wooden houses on stilts (rumah panggung) with thatched roofs
- Coconut palms and banana trees throughout
- Malay villagers in traditional dress going about daily life
- Cooking fire with clay pots, women preparing food
- Children playing, chickens scratching in the dirt
- A small prayer house (surau) visible in the background
- Woven mats and batik cloth hanging to dry`,
  }
};

// Time of day variations
const TIME_VARIANTS = {
  dawn: {
    suffix: 'dawn',
    atmosphere: `TIME OF DAY: DAWN (5-7 AM)

LIGHTING:
- Pink and coral sky with orange tones near horizon
- Long shadows stretching westward
- Soft, diffused morning light
- Mist rising from water and low areas
- Dew visible on surfaces

ATMOSPHERE:
- Cool, fresh feeling before the heat
- Early risers beginning their day
- Peaceful, contemplative mood
- Birds beginning to wake
- Torches/lanterns still dimly glowing, not yet extinguished`
  },

  dusk: {
    suffix: 'dusk',
    atmosphere: `TIME OF DAY: GOLDEN HOUR / DUSK (5-7 PM)

LIGHTING:
- Rich golden amber light bathing everything
- Deep orange sky transitioning to purple at zenith
- Long dramatic shadows pointing eastward
- Windows and surfaces catching golden reflections
- Warm color temperature throughout

ATMOSPHERE:
- The busiest trading hour is ending
- Vendors packing up, last negotiations
- Warm, nostalgic feeling
- Torches and lanterns being lit
- Heat of the day fading into pleasant evening`
  },

  night: {
    suffix: 'night',
    atmosphere: `TIME OF DAY: NIGHT (9 PM - 4 AM)

LIGHTING:
- Deep blue-purple sky with stars visible
- Moon providing silver highlights
- Warm orange glow from torches, lanterns, windows
- Strong contrast between lit and shadowed areas
- Firefly-like points of light in vegetation

ATMOSPHERE:
- Mysterious, slightly dangerous feeling
- Most activity has stopped
- Night watchmen on patrol
- Distant sounds of music from taverns
- Tropical insects singing
- Some windows still glowing with candlelight`
  }
};

/**
 * Generate scene variant image using Gemini API
 */
async function generateSceneVariant(locationKey, timeKey) {
  const location = LOCATIONS[locationKey];
  const timeVariant = TIME_VARIANTS[timeKey];

  const prompt = `${STYLE_PREFIX}

SCENE: ${location.name}

${location.baseDescription}

${timeVariant.atmosphere}

Create this scene with the specified time of day lighting and atmosphere. Make the lighting dramatic and atmospheric.`;

  const outputPath = path.join(OUTPUT_DIR, `scene-${locationKey}-${timeVariant.suffix}.png`);

  const requestBody = JSON.stringify({
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {}
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
      reject(new Error('Request timeout (scenes are complex)'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Generate all scene variants
 */
async function generateAllVariants() {
  console.log('\n🌅 A Famosa Scene Variant Generator\n');
  console.log('Model:', MODEL);
  console.log('Output:', OUTPUT_DIR);
  console.log('=' .repeat(60) + '\n');

  let successCount = 0;
  let failCount = 0;
  const total = Object.keys(LOCATIONS).length * Object.keys(TIME_VARIANTS).length;

  for (const locationKey of Object.keys(LOCATIONS)) {
    for (const timeKey of Object.keys(TIME_VARIANTS)) {
      const location = LOCATIONS[locationKey];
      const timeVariant = TIME_VARIANTS[timeKey];
      const filename = `scene-${locationKey}-${timeVariant.suffix}.png`;

      console.log(`\n🖼️  Generating: ${filename}`);
      console.log(`   Location: ${location.name}`);
      console.log(`   Time: ${timeKey}`);

      try {
        await generateSceneVariant(locationKey, timeKey);
        console.log(`   ✅ Saved: ${filename}`);
        successCount++;
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        failCount++;
      }

      // Rate limiting - scenes are complex
      console.log('   ⏳ Waiting for rate limit...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`\n✅ Complete! ${successCount}/${total} scenes generated, ${failCount} failed.`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
}

/**
 * Generate variants for a single location
 */
async function generateLocationVariants(locationKey) {
  const location = LOCATIONS[locationKey];
  if (!location) {
    console.log(`❌ Location '${locationKey}' not found.\n`);
    console.log('Available locations:');
    Object.keys(LOCATIONS).forEach(k => console.log(`  - ${k}`));
    return;
  }

  console.log(`\n🌅 Generating variants for: ${location.name}\n`);

  for (const timeKey of Object.keys(TIME_VARIANTS)) {
    const timeVariant = TIME_VARIANTS[timeKey];
    const filename = `scene-${locationKey}-${timeVariant.suffix}.png`;

    console.log(`\n🖼️  Generating: ${filename} (${timeKey})`);

    try {
      await generateSceneVariant(locationKey, timeKey);
      console.log(`   ✅ Saved: ${filename}`);
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }

    await new Promise(r => setTimeout(r, 5000));
  }
}

/**
 * Generate a single specific variant
 */
async function generateSingleVariant(locationKey, timeKey) {
  const location = LOCATIONS[locationKey];
  const timeVariant = TIME_VARIANTS[timeKey];

  if (!location) {
    console.log(`❌ Location '${locationKey}' not found.`);
    return;
  }
  if (!timeVariant) {
    console.log(`❌ Time variant '${timeKey}' not found. Use: dawn, dusk, night`);
    return;
  }

  const filename = `scene-${locationKey}-${timeVariant.suffix}.png`;
  console.log(`\n🖼️  Generating: ${filename}`);

  try {
    await generateSceneVariant(locationKey, timeKey);
    console.log(`✅ Saved: ${path.join(OUTPUT_DIR, filename)}\n`);
  } catch (error) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--all')) {
    await generateAllVariants();
  } else if (args.length === 2 && !args[0].startsWith('--')) {
    // Two args: location and time
    await generateSingleVariant(args[0], args[1]);
  } else if (args.length === 1 && !args[0].startsWith('--')) {
    // One arg: generate all variants for that location
    await generateLocationVariants(args[0]);
  } else {
    console.log('\n🌅 A Famosa Scene Variant Generator\n');
    console.log('Generates dawn/dusk/night variants of scene backgrounds\n');
    console.log('Usage:');
    console.log('  node generate-scene-variants.js --all              Generate ALL variants (15 images)');
    console.log('  node generate-scene-variants.js <location>         Generate all times for location (3 images)');
    console.log('  node generate-scene-variants.js <location> <time>  Generate single variant');
    console.log('\nAvailable locations:');
    Object.entries(LOCATIONS).forEach(([key, loc]) => {
      console.log(`  - ${key.padEnd(15)} → ${loc.name}`);
    });
    console.log('\nAvailable times:');
    Object.entries(TIME_VARIANTS).forEach(([key, variant]) => {
      console.log(`  - ${key.padEnd(10)} → scene-*-${variant.suffix}.png`);
    });
    console.log('\nExamples:');
    console.log('  node generate-scene-variants.js kampung night');
    console.log('  node generate-scene-variants.js waterfront');
    console.log('  node generate-scene-variants.js --all');
    console.log('');
  }
}

main().catch(console.error);
