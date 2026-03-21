/**
 * Animation Generator using Google Gemini API (Nano Banana)
 * 
 * Generates walking animation sprite sheets for characters
 * 4 directions x 4 frames = 16 frames per character
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getStyleHeader } = require('./load-style-header.cjs');

// API Configuration  
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-image';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
if (!API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'characters');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Base style for character sprites — loaded from canonical style header
const STYLE_PREFIX = getStyleHeader('animated-object');

// Character definitions for animation sheets
const CHARACTERS = {
  player: {
    name: 'player-sheet',
    prompt: `Young Portuguese merchant's agent character.

APPEARANCE:
- Brown hair, clean-shaven, youthful face
- Red/burgundy doublet with gold buttons
- White collar visible at neck
- Blue breeches (pants)
- Brown leather boots
- Leather belt with small pouch

Walk cycle should show natural arm swing and leg movement.`
  },

  'fernao-gomes': {
    name: 'fernao-gomes-sheet',
    prompt: `Wealthy older Portuguese merchant character.

APPEARANCE:
- Gray beard, balding with gray hair
- Fine red velvet doublet with ornate gold trim
- White ruff collar at neck
- Heavy gold chain of office
- Dark breeches
- Distinguished, slightly portly build

Walk should be dignified, slower pace befitting his status.`
  },

  'capitao-rodrigues': {
    name: 'capitao-rodrigues-sheet',
    prompt: `Portuguese military guard captain character.

APPEARANCE:
- Morion helmet (Spanish/Portuguese style, pointed crest)
- Metal breastplate armor over cloth
- Red officer's sash across chest
- Stern expression
- Sword at hip
- Military boots

Walk should be rigid, military bearing.`
  },

  'padre-tomas': {
    name: 'padre-tomas-sheet',
    prompt: `Jesuit Catholic priest character.

APPEARANCE:
- Long black cassock robe (full length)
- White clerical collar
- Gold crucifix pendant on chain
- Tonsured head (bald crown with gray hair ring)
- Kind, gentle expression
- Hands often clasped or holding rosary

Walk should be slow, contemplative, robes flowing slightly.`
  },

  'aminah': {
    name: 'aminah-sheet',
    prompt: `Malay woman market vendor character.

APPEARANCE:
- Purple/pink tudung (headscarf) covering hair
- Gold necklace visible
- Colorful silk baju kurung (traditional blouse)
- Blue batik sarong with geometric patterns
- Simple sandals or bare feet
- Warm, friendly expression

Walk should be graceful, sarong limiting stride slightly.`
  },

  'chen-wei': {
    name: 'chen-wei-sheet',
    prompt: `Chinese guild merchant representative character.

APPEARANCE:
- Traditional black silk cap
- Long purple/magenta silk changshan robe with gold embroidery
- Thin black mustache and short goatee
- Dignified, reserved expression
- Hands often hidden in wide sleeves
- Simple black cloth shoes

Walk should be measured, dignified, robes flowing.`
  },

  'rashid': {
    name: 'rashid-sheet',
    prompt: `Arab sailor from trading dhow character.

APPEARANCE:
- White keffiyeh headscarf with black agal rope
- Thick curly black beard
- Loose white cotton sailor's shirt
- Blue cloth sash at waist
- Baggy sirwal pants
- Bare feet (sailor)
- Jovial, animated expression

Walk should be rolling gait of a sailor, slightly bowlegged.`
  }
};

/**
 * Generate sprite sheet using Gemini API
 */
async function generateSpriteSheet(prompt, outputPath) {
  const fullPrompt = `${STYLE_PREFIX}\n\nCHARACTER TO ANIMATE:\n${prompt}`;
  
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
          
          if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData && part.inlineData.data) {
                const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                fs.writeFileSync(outputPath, imageBuffer);
                resolve({ success: true, path: outputPath });
                return;
              }
              if (part.text) {
                console.log('    📝', part.text.substring(0, 60) + '...');
              }
            }
          }
          
          reject(new Error('No image data in response'));
          
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(90000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Generate all animation sheets
 */
async function generateAll() {
  console.log('\n🎬 A Famosa Animation Generator\n');
  console.log('Model:', MODEL);
  console.log('=' .repeat(50) + '\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const [key, char] of Object.entries(CHARACTERS)) {
    const outputPath = path.join(OUTPUT_DIR, `${char.name}.png`);
    console.log(`🎬 Generating: ${char.name}`);
    
    try {
      await generateSpriteSheet(char.prompt, outputPath);
      console.log(`   ✅ Saved: ${char.name}.png`);
      successCount++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      failCount++;
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`\n✅ Complete! ${successCount} sheets generated, ${failCount} failed.`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
}

/**
 * Generate single character
 */
async function generateSingle(key) {
  const char = CHARACTERS[key];
  if (!char) {
    console.log(`❌ Character '${key}' not found.\n`);
    console.log('Available characters:');
    Object.keys(CHARACTERS).forEach(k => console.log(`  - ${k}`));
    return;
  }
  
  const outputPath = path.join(OUTPUT_DIR, `${char.name}.png`);
  console.log(`\n🎬 Generating: ${char.name}\n`);
  
  try {
    await generateSpriteSheet(char.prompt, outputPath);
    console.log(`✅ Saved: ${outputPath}\n`);
  } catch (error) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    await generateAll();
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    await generateSingle(args[0]);
  } else {
    console.log('\n🎬 A Famosa Animation Generator\n');
    console.log('Usage:');
    console.log('  node generate-animations-gemini.js --all         Generate ALL animations');
    console.log('  node generate-animations-gemini.js <character>   Generate single character');
    console.log('\nCharacters:');
    Object.keys(CHARACTERS).forEach(k => console.log(`  - ${k}`));
    console.log('');
  }
}

main().catch(console.error);
