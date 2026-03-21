/**
 * Sprite Generator using Google Gemini API (Nano Banana)
 * 
 * Generates pixel art sprites for A Famosa: Streets of Golden Melaka
 * Using gemini-2.5-flash-image model for actual image generation.
 * 
 * Based on: https://ai.google.dev/gemini-api/docs/image-generation
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getStyleHeader } = require('./load-style-header.cjs');

// API Configuration  
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-image';  // Nano Banana - supports generateContent for images
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
if (!API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Output directories
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');
const TILES_DIR = path.join(OUTPUT_DIR, 'tiles');
const CHARACTERS_DIR = path.join(OUTPUT_DIR, 'characters');
const OBJECTS_DIR = path.join(OUTPUT_DIR, 'objects');

// Ensure directories exist
[TILES_DIR, CHARACTERS_DIR, OBJECTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Base style for all sprites — loaded from canonical style header
const STYLE_PREFIX = getStyleHeader();

// All sprites to generate
const SPRITES = {
  tiles: [
    { name: 'cobblestone', prompt: '16x16 pixel art tile, top-down cobblestone street, gray-brown stones with dark mortar, Portuguese colonial style, seamless tileable' },
    { name: 'grass-tropical', prompt: '16x16 pixel art tile, top-down tropical grass, lush green with tiny flowers, Southeast Asian jungle, seamless tileable' },
    { name: 'water-harbor', prompt: '16x16 pixel art tile, top-down calm harbor water, blue-green with subtle ripples, seamless tileable' },
    { name: 'wood-dock', prompt: '16x16 pixel art tile, top-down weathered wooden dock planks, brown with gaps, seamless tileable' },
    { name: 'sand-beach', prompt: '16x16 pixel art tile, top-down golden beach sand with shells, seamless tileable' },
    { name: 'terracotta-floor', prompt: '16x16 pixel art tile, top-down terracotta clay floor, orange-red tiles, Portuguese style, seamless tileable' }
  ],

  characters: [
    { name: 'player', prompt: '24x32 pixel art character, young Portuguese merchant, brown hair, red doublet with gold buttons, white collar, blue pants, brown boots, facing forward, full body, transparent background' },
    { name: 'fernao-gomes', prompt: '24x32 pixel art character, wealthy older Portuguese merchant, gray beard, fine red velvet doublet, gold chain, distinguished, facing forward, transparent background' },
    { name: 'capitao-rodrigues', prompt: '24x32 pixel art character, Portuguese military captain, morion helmet, breastplate armor, red sash, stern, facing forward, transparent background' },
    { name: 'padre-tomas', prompt: '24x32 pixel art character, Jesuit priest, black cassock robe, white collar, gold crucifix, tonsured head, kind expression, facing forward, transparent background' },
    { name: 'aminah', prompt: '24x32 pixel art character, Malay woman vendor, purple headscarf, gold necklace, colorful blouse, batik sarong, friendly smile, facing forward, transparent background' },
    { name: 'chen-wei', prompt: '24x32 pixel art character, Chinese merchant, black cap, purple silk robe with gold trim, thin mustache, dignified, facing forward, transparent background' },
    { name: 'rashid', prompt: '24x32 pixel art character, Arab sailor, white headscarf, black beard, white shirt, blue sash, jovial expression, facing forward, transparent background' }
  ],

  objects: [
    { name: 'market-stall', prompt: '32x32 pixel art, market stall with striped awning (red/white), wooden frame, goods displayed, isometric view, transparent background' },
    { name: 'spice-pile', prompt: '16x16 pixel art, pile of golden turmeric spice in ceramic bowl, warm yellow-orange, transparent background' },
    { name: 'barrel', prompt: '16x24 pixel art, wooden storage barrel, dark brown with iron bands, isometric view, transparent background' },
    { name: 'crate', prompt: '16x16 pixel art, wooden cargo crate, stamped merchant mark, isometric view, transparent background' },
    { name: 'palm-tree', prompt: '32x48 pixel art, tall coconut palm tree, green fronds, brown trunk, tropical, transparent background' },
    { name: 'lantern', prompt: '16x16 pixel art, brass hanging oil lantern with warm glow, Portuguese colonial style, transparent background' },
    { name: 'anchor', prompt: '24x24 pixel art, iron ship anchor, dark gray metal, nautical style, transparent background' },
    { name: 'cannon', prompt: '32x16 pixel art, bronze cannon on wooden carriage, Portuguese fortress style, side view, transparent background' },
    { name: 'stone-cross', prompt: '16x32 pixel art, stone religious cross, weathered gray, Portuguese Catholic style, transparent background' },
    { name: 'ceramic-vase', prompt: '16x24 pixel art, blue and white Chinese porcelain vase, Ming dynasty style, transparent background' }
  ]
};

/**
 * Generate image using Gemini API
 */
async function generateImage(prompt, outputPath) {
  const fullPrompt = `${STYLE_PREFIX}\n\nNow generate: ${prompt}`;
  
  const requestBody = JSON.stringify({
    contents: [{
      parts: [{ text: fullPrompt }]
    }]
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
          
          // Check for image data in response
          if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              // Check for inline image data (base64)
              if (part.inlineData && part.inlineData.data) {
                const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                fs.writeFileSync(outputPath, imageBuffer);
                resolve({ success: true, path: outputPath });
                return;
              }
              // Also log any text response
              if (part.text) {
                console.log('    📝 Model response:', part.text.substring(0, 100));
              }
            }
          }
          
          // If no image was found
          reject(new Error('No image data in response'));
          
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Test API with a simple image generation
 */
async function testGeneration() {
  console.log('🔄 Testing Gemini image generation...\n');
  
  const testPath = path.join(OUTPUT_DIR, 'test-sprite.png');
  const testPrompt = '16x16 pixel art, simple red apple on white background, retro game style';
  
  try {
    const result = await generateImage(testPrompt, testPath);
    console.log('✅ Test successful! Image saved to:', result.path);
    console.log('\n📷 Check the file to verify image quality.\n');
    return true;
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('\n💡 The model may not support direct image generation.');
    console.log('   Try using Google AI Studio directly at aistudio.google.com\n');
    return false;
  }
}

/**
 * Generate all sprites
 */
async function generateAllSprites() {
  console.log('\n🎨 A Famosa Sprite Generator - Nano Banana\n');
  console.log('Model:', MODEL);
  console.log('=' .repeat(50) + '\n');
  
  let successCount = 0;
  let failCount = 0;
  
  // Process each category
  for (const [category, sprites] of Object.entries(SPRITES)) {
    console.log(`\n📦 ${category.toUpperCase()}:\n`);
    
    const outputDir = category === 'tiles' ? TILES_DIR 
                    : category === 'characters' ? CHARACTERS_DIR 
                    : OBJECTS_DIR;
    
    for (const sprite of sprites) {
      const outputPath = path.join(outputDir, `${sprite.name}.png`);
      console.log(`  🖼️  Generating: ${sprite.name}`);
      
      try {
        await generateImage(sprite.prompt, outputPath);
        console.log(`      ✅ Saved: ${sprite.name}.png`);
        successCount++;
      } catch (error) {
        console.log(`      ❌ Failed: ${error.message}`);
        failCount++;
      }
      
      // Rate limiting - wait between requests
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`\n✅ Complete! ${successCount} sprites generated, ${failCount} failed.`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
}

/**
 * Generate a single sprite by name
 */
async function generateSingle(name) {
  // Find the sprite
  for (const [category, sprites] of Object.entries(SPRITES)) {
    const sprite = sprites.find(s => s.name === name);
    if (sprite) {
      const outputDir = category === 'tiles' ? TILES_DIR 
                      : category === 'characters' ? CHARACTERS_DIR 
                      : OBJECTS_DIR;
      const outputPath = path.join(outputDir, `${sprite.name}.png`);
      
      console.log(`\n🖼️  Generating: ${name}`);
      console.log(`   Prompt: ${sprite.prompt}\n`);
      
      try {
        await generateImage(sprite.prompt, outputPath);
        console.log(`✅ Saved: ${outputPath}\n`);
      } catch (error) {
        console.log(`❌ Failed: ${error.message}\n`);
      }
      return;
    }
  }
  
  console.log(`❌ Sprite '${name}' not found.\n`);
  console.log('Available sprites:');
  for (const [cat, sprites] of Object.entries(SPRITES)) {
    console.log(`  ${cat}: ${sprites.map(s => s.name).join(', ')}`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    await testGeneration();
  } else if (args.includes('--all')) {
    await generateAllSprites();
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    await generateSingle(args[0]);
  } else {
    console.log('\n🎨 A Famosa Sprite Generator\n');
    console.log('Usage:');
    console.log('  node generate-sprites-gemini.js --test      Test image generation');
    console.log('  node generate-sprites-gemini.js --all       Generate ALL sprites');
    console.log('  node generate-sprites-gemini.js <name>      Generate single sprite');
    console.log('\nExamples:');
    console.log('  node generate-sprites-gemini.js player');
    console.log('  node generate-sprites-gemini.js market-stall');
    console.log('  node generate-sprites-gemini.js cobblestone\n');
  }
}

main().catch(console.error);
