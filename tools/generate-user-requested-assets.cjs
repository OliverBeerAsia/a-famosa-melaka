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

// Output directories
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites');

// Ensure directories exist
['tiles', 'characters', 'objects'].forEach(dir => {
  const fullPath = path.join(OUTPUT_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const ASSETS = [
  {
    target: path.join(OUTPUT_DIR, 'characters', 'player.png'),
    prompt: "Full body character sprite facing forward, young Portuguese merchant agent, wearing red/burgundy doublet, blue breeches, brown boots, Ultima 8 style pixel art, transparent background."
  },
  {
    target: path.join(OUTPUT_DIR, 'tiles', 'cobblestone.png'),
    prompt: "Top-down cobblestone street tile, gray-brown stones, worn Portuguese colonial style, seamless tileable, Ultima 8 style pixel art."
  },
  {
    target: path.join(OUTPUT_DIR, 'tiles', 'water-tile.png'),
    prompt: "Top-down calm harbor water tile, blue-green with subtle light ripples, seamless tileable, Ultima 8 style pixel art."
  },
  {
    target: path.join(OUTPUT_DIR, 'objects', 'market-stall.png'),
    prompt: "Market vendor stall, wooden frame with red and white striped awning, isometric view, Ultima 8 style pixel art, transparent background."
  },
  {
    target: path.join(OUTPUT_DIR, 'tiles', 'wall-white.png'),
    prompt: "Front-facing whitewashed stone wall section, Portuguese colonial architecture, slight weathering, Ultima 8 style pixel art, transparent background."
  }
];

async function generateImage(prompt, outputPath) {
  console.log(`🖼️  Generating: ${path.basename(outputPath)}`);
  
  const requestBody = JSON.stringify({
    contents: [{
      parts: [{ text: prompt }]
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
      res.on('data', chunk => { data += chunk; });
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

    req.write(requestBody);
    req.end();
  });
}

async function main() {
  for (const asset of ASSETS) {
    try {
      await generateImage(asset.prompt, asset.target);
      console.log(`✅ Saved: ${asset.target}`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    // Wait between requests
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(console.error);
