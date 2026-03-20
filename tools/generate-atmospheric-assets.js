/**
 * Generate Atmospheric Assets via Gemini API
 * 
 * Creates late 90s RPG style:
 * - Location scene backgrounds
 * - Character sprite sheets
 * - Tilesets
 * - Object sprites
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// API Configuration
const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = 'generativelanguage.googleapis.com';
const MODEL = 'gemini-2.0-flash-exp'; // Flash model with image generation support
if (!API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Style constants for all prompts
const STYLE_PREFIX = `Late 1990s isometric RPG pixel art style, like Ultima VII or Baldur's Gate. 
Rich detailed pixel art with subtle dithering. Warm tropical lighting from top-left. 
Setting: Portuguese colonial Melaka, Southeast Asia, 1580. The "Venice of the East."
Color palette: warm browns (#8B7355), terracotta (#C65D3D), cream whites (#F5F5DC), 
tropical greens (#5C8A4D), ocean blues (#4A8BA8), golden highlights (#D4AF37).`;

const NEGATIVE_PROMPT = `blurry, low quality, modern elements, anachronistic, cartoon style, 
anime, 3D render, photograph, realistic, photorealistic`;

// ============ SCENE PROMPTS ============

const SCENES = {
  'a-famosa-gate': {
    filename: 'scene-a-famosa.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art game scene of the famous A Famosa fortress gate, Portuguese Melaka, 1580.

Composition (widescreen 16:9):
- Massive weathered stone gateway with Portuguese coat of arms carved above the arch
- Two guards in morion helmets standing at attention
- Cobblestone plaza with heat shimmer
- Palm trees framing the scene
- Fortress walls extending to sides with crenellations
- Warm golden afternoon lighting
- Civilians and merchants passing through
- Market stalls visible to the left
- Church spire on hill in distant background
- Dust motes visible in shafts of light
- Tropical humidity haze

Mood: Imperial power and exotic grandeur. Gateway between worlds.`
  },

  'rua-direita': {
    filename: 'scene-rua-direita.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art game scene of Rua Direita, the main commercial street, Portuguese Melaka, 1580.

Composition (widescreen 16:9):
- Bustling market street from elevated 3/4 isometric view
- Portuguese colonial buildings: whitewashed walls, terracotta roofs, iron balconies
- Colorful striped market awnings (red, gold, blue) lining both sides
- Diverse crowd: Portuguese merchants in doublets, Malay vendors in batik, Chinese traders in changshan, Arab sailors in turbans
- Trade goods everywhere: spice barrels, silk bolts, porcelain, tropical fruits
- Hanging lanterns and painted shop signs
- Stone fountain as central focal point
- Long afternoon shadows on cobblestones
- Palm trees visible above rooflines

Mood: Sensory overload. Haggling voices. The commercial heart of the spice trade.`
  },

  'st-pauls-church': {
    filename: 'scene-st-pauls.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art game scene of St. Paul's Church on the hill, Portuguese Melaka, 1580.

Composition (widescreen 16:9):
- Simple whitewashed stone church with prominent stone cross
- Weathered gravestones in churchyard
- Ancient spreading tree (the famous "love tree")
- Panoramic view of Strait of Melaka in background
- Ships in harbor below: Portuguese carracks, Chinese junks, Arab dhows
- Stone path winding up through tropical vegetation
- Padre figure in black cassock near entrance
- Dramatic cumulus clouds in golden sky
- Frangipani trees with white flowers
- Late afternoon light creating long shadows

Mood: Sacred serenity. Where Francis Xavier walked. Spectacular maritime view.`
  },

  'waterfront': {
    filename: 'scene-waterfront.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art game scene of the waterfront harbor, Portuguese Melaka, 1580.

Composition (widescreen 16:9):
- Wooden docks extending into scene
- Large Portuguese carrack with billowing sails prominent left
- Chinese junk with distinctive battened sails center-right
- Arab dhow with lateen sail in background
- Dock workers loading cargo: crates, barrels, silk bales
- Rope coils, fishing nets, maritime equipment scattered
- Warehouse buildings behind the docks
- Counting house with merchant at ledger
- Seagulls circling overhead
- Harbor water reflecting golden sunlight
- Salt-weathered wood textures
- Tropical heat shimmer

Mood: International commerce. Wealth of three continents. Salt air and opportunity.`
  },

  'kampung': {
    filename: 'scene-kampung.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art game scene of a traditional Malay kampung village, outskirts of Portuguese Melaka, 1580.

Composition (widescreen 16:9):
- Traditional Malay wooden houses on stilts
- Thatched attap palm roofs
- Wooden walkways connecting houses
- Abundant coconut palms and banana trees
- Small river with wooden sampan boats
- Villagers in traditional batik sarongs
- Cooking fires with wisps of smoke
- Drying fish on racks
- Chickens pecking in foreground
- Water buffalo in distance
- Jungle encroaching at edges
- Distant Portuguese fort/church on hill
- Warm evening golden hour light

Mood: The real Melaka. Traditional life continuing despite colonial presence.`
  },

  'opening': {
    filename: 'opening-screen.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art title screen for a late 1990s RPG game set in Portuguese Melaka, 1580.

Composition (widescreen 16:9):
- Dramatic harbor view at golden hour/sunset
- Portuguese flag prominently displayed on left
- A Famosa fortress silhouette on hill right
- Multiple ships in harbor: carracks, junks, dhows with dramatic sails
- Warm golden-orange sky with dramatic clouds
- Reflections on calm harbor water
- Tropical coastline with palm silhouettes
- Portuguese colonial town along waterfront
- Space at top center for game title "A FAMOSA"
- Space at bottom center for menu buttons
- Rich atmospheric lighting
- Slight mist/haze for depth

Mood: Epic adventure awaits. The golden age of maritime empire. Exotic beauty.`
  }
};

// ============ CHARACTER PROMPTS ============

const CHARACTERS = {
  'player': {
    filename: 'player-full.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art character sprite sheet for a late 1990s RPG.

Character: Young Portuguese merchant's agent, 1580s. Male, mid-20s.
- Dark brown hair, short beard
- Rich red doublet with gold buttons
- White collar ruff
- Brown breeches and black boots
- Small rapier at hip

Format: Sprite sheet 96x128 pixels
- 4 columns (walk animation frames)
- 4 rows (facing: down, left, right, up)
- Each sprite: 24x32 pixels
- Clear black outline
- Walking animation cycle

Style: Ultima VII proportions. Readable silhouette at small size.`
  },

  'fernao-gomes': {
    filename: 'fernao-gomes-full.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art character sprite sheet for a late 1990s RPG.

Character: Wealthy Portuguese spice merchant, 1580s. Male, 50s.
- Grey/white beard, balding
- Dark red velvet coat with fur trim
- Large gold chain around neck
- Prominent belly (prosperous merchant)
- Burgundy clothing, jeweled rings

Format: Sprite sheet 96x128 pixels
- 4 columns (walk animation frames)  
- 4 rows (facing: down, left, right, up)
- Each sprite: 24x32 pixels

Style: Clearly wealthy and important. Dignified pompous walk.`
  },

  'capitao-rodrigues': {
    filename: 'capitao-rodrigues-full.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art character sprite sheet for a late 1990s RPG.

Character: Portuguese military captain, fortress guard, 1580s.
- Morion helmet (conquistador style with crest)
- Steel breastplate over red doublet
- White cross of Portugal on chest
- Thick dark mustache, stern expression
- Military boots, halberd weapon

Format: Sprite sheet 96x128 pixels
- 4 columns (walk animation frames)
- 4 rows (facing: down, left, right, up)  
- Each sprite: 24x32 pixels

Style: Military authority. Imposing presence. Armor catches light.`
  },

  'padre-tomas': {
    filename: 'padre-tomas-full.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art character sprite sheet for a late 1990s RPG.

Character: Jesuit priest, 1580s. Male, 40s.
- Tonsured head (bald crown with hair ring)
- Long black Jesuit cassock
- White collar
- Wooden cross on cord
- Rosary at waist
- Sandals, thin ascetic build

Format: Sprite sheet 96x128 pixels
- 4 columns (walk animation frames)
- 4 rows (facing: down, left, right, up)
- Each sprite: 24x32 pixels

Style: Humble but wise. Gentle measured walk. Hands often clasped.`
  },

  'aminah': {
    filename: 'aminah-full.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art character sprite sheet for a late 1990s RPG.

Character: Malay market vendor woman, 1580s. Female, 30s.
- Colorful baju kurung (traditional Malay dress)
- Batik patterns in red, gold, purple
- Tudung headscarf
- Gold jewelry (earrings, bracelets)
- Warm brown skin, friendly expression
- Carries basket

Format: Sprite sheet 96x128 pixels
- 4 columns (walk animation frames)
- 4 rows (facing: down, left, right, up)
- Each sprite: 24x32 pixels

Style: Vibrant local color. Lively animated walk.`
  },

  'chen-wei': {
    filename: 'chen-wei-full.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art character sprite sheet for a late 1990s RPG.

Character: Chinese merchant guild master, 1580s. Male, 50s.
- Traditional changshan robe in rich blue silk
- Black silk cap (Ming dynasty style)
- Long thin mustache and goatee
- Pale skin, wise calculating expression
- Hands often in sleeves
- Gold embroidery on robe

Format: Sprite sheet 96x128 pixels
- 4 columns (walk animation frames)
- 4 rows (facing: down, left, right, up)
- Each sprite: 24x32 pixels

Style: Dignified unhurried walk. Ancient wealth and wisdom.`
  },

  'rashid': {
    filename: 'rashid-full.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art character sprite sheet for a late 1990s RPG.

Character: Arab dhow sailor and trader, 1580s. Male, 30s.
- White turban/head wrap
- Open vest, bare chest underneath
- Full dark beard
- Deep tan sun-weathered skin
- Loose white sailor pants
- Bare feet, red sash at waist
- Gold earring

Format: Sprite sheet 96x128 pixels
- 4 columns (walk animation frames)
- 4 rows (facing: down, left, right, up)
- Each sprite: 24x32 pixels

Style: Rolling sailor gait. Animated and expressive.`
  }
};

// ============ TILESET PROMPTS ============

const TILESETS = {
  'ground-tiles': {
    filename: 'tileset-ground.png',
    prompt: `${STYLE_PREFIX}

Create a seamless pixel art ground tileset for a late 1990s isometric RPG.

Format: 256x256 pixel grid (8x8 tiles, each tile 32x32 pixels)

Tile layout:
Row 1: Cobblestone (4 variations with wear, moss, cracks) 
Row 2: Whitewashed stone floor (clean, weathered, cracked, mossy)
Row 3: Terracotta tile floor (Portuguese style, aged variants)
Row 4: Wooden planks (dock wood, indoor, weathered)
Row 5: Tropical grass (grass, dirt patches, flowers)
Row 6: Harbor water (4 animation frames with gentle waves)
Row 7: Sand/beach (dry, wet, shells, debris)
Row 8: Transitions (cobble-to-grass, stone-to-water edges)

Each tile must seamlessly connect. Consistent top-left lighting.
Weathered colonial atmosphere. Warm browns and terracotta.`
  },

  'architecture-tiles': {
    filename: 'tileset-architecture.png',
    prompt: `${STYLE_PREFIX}

Create a pixel art architectural tileset for a late 1990s isometric RPG.

Format: 256x256 pixel grid (8x8 tiles, each tile 32x32 pixels)

Tile layout:
Row 1-2: Whitewashed walls (plain, with window, door frame, corner, damaged)
Row 3: Terracotta roof tiles (flat, angled, ridge, edge pieces)
Row 4: Fortress grey stone walls (blocks, crenellations, arrow slits)
Row 5: Wooden elements (doors, shutters, balcony, beams)
Row 6: Decorative (Portuguese arms, lantern brackets, flower pots)
Row 7: Church elements (cross, arched window, bell tower)
Row 8: Market (awning fabric red/gold, wooden stall frames)

Weathered textures. Salt stains. Tropical humidity damage.
Portuguese colonial style. Consistent isometric 3/4 view.`
  }
};

// ============ API FUNCTIONS ============

async function generateImage(prompt, outputPath) {
  return new Promise((resolve, reject) => {
    // Format for Gemini generateContent with image output
    const requestBody = JSON.stringify({
      contents: [{
        parts: [{
          text: `Generate an image based on this description:

${prompt}

CRITICAL REQUIREMENTS:
- This MUST be pixel art in the style of late 1990s video game graphics
- Like Ultima VII, Baldur's Gate, or LucasArts adventure games
- NOT photorealistic - pixelated game graphics style
- Rich colors, detailed pixels, atmospheric lighting`
        }]
      }],
      generationConfig: {
        responseModalities: ["image", "text"]
      }
    });

    const options = {
      hostname: API_URL,
      path: `/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.error) {
            console.error(`API Error: ${response.error.message}`);
            reject(response.error);
            return;
          }

          // Extract image from Gemini response
          if (response.candidates && response.candidates[0]) {
            const parts = response.candidates[0].content?.parts || [];
            for (const part of parts) {
              if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                fs.writeFileSync(outputPath, imageBuffer);
                console.log(`✓ Saved: ${outputPath}`);
                resolve(outputPath);
                return;
              }
            }
          }
          
          // Show what we got if no image
          const preview = JSON.stringify(response, null, 2).substring(0, 800);
          console.log('Response preview:', preview);
          reject(new Error('No image found in response'));
          
        } catch (e) {
          console.error('Parse error:', e);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ MAIN GENERATION FUNCTIONS ============

async function generateScenes() {
  console.log('\n═══════════════════════════════════════');
  console.log('  GENERATING LOCATION SCENES');
  console.log('═══════════════════════════════════════\n');

  const outputDir = path.join(__dirname, '..', 'assets', 'scenes');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [key, scene] of Object.entries(SCENES)) {
    console.log(`\nGenerating: ${key}...`);
    const outputPath = path.join(outputDir, scene.filename);
    
    try {
      await generateImage(scene.prompt, outputPath);
      await delay(5000); // Rate limit delay
    } catch (e) {
      console.error(`Failed to generate ${key}:`, e.message);
    }
  }
}

async function generateCharacters() {
  console.log('\n═══════════════════════════════════════');
  console.log('  GENERATING CHARACTER SPRITES');
  console.log('═══════════════════════════════════════\n');

  const outputDir = path.join(__dirname, '..', 'assets', 'sprites', 'characters');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [key, char] of Object.entries(CHARACTERS)) {
    console.log(`\nGenerating: ${key}...`);
    const outputPath = path.join(outputDir, char.filename);
    
    try {
      await generateImage(char.prompt, outputPath);
      await delay(5000);
    } catch (e) {
      console.error(`Failed to generate ${key}:`, e.message);
    }
  }
}

async function generateTilesets() {
  console.log('\n═══════════════════════════════════════');
  console.log('  GENERATING TILESETS');
  console.log('═══════════════════════════════════════\n');

  const outputDir = path.join(__dirname, '..', 'assets', 'sprites', 'tilesets');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [key, tileset] of Object.entries(TILESETS)) {
    console.log(`\nGenerating: ${key}...`);
    const outputPath = path.join(outputDir, tileset.filename);
    
    try {
      await generateImage(tileset.prompt, outputPath);
      await delay(5000);
    } catch (e) {
      console.error(`Failed to generate ${key}:`, e.message);
    }
  }
}

// ============ CLI ============

async function main() {
  const args = process.argv.slice(2);
  
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  A FAMOSA: ATMOSPHERIC ASSET GENERATOR            ║');
  console.log('║  Generating late 90s RPG style graphics           ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  if (args.includes('--scenes') || args.includes('--all')) {
    await generateScenes();
  }

  if (args.includes('--characters') || args.includes('--all')) {
    await generateCharacters();
  }

  if (args.includes('--tilesets') || args.includes('--all')) {
    await generateTilesets();
  }

  if (args.length === 0) {
    console.log(`
Usage: node generate-atmospheric-assets.js [options]

Options:
  --scenes      Generate location scene backgrounds
  --characters  Generate character sprite sheets  
  --tilesets    Generate ground and architecture tilesets
  --all         Generate everything

Examples:
  node generate-atmospheric-assets.js --scenes
  node generate-atmospheric-assets.js --all
`);
  }

  console.log('\n✓ Generation complete!');
}

main().catch(console.error);
