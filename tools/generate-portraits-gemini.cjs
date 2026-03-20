/**
 * Portrait Generator using Google Gemini API
 *
 * Generates high-quality 256×256 character portraits for NPC dialogues.
 * Styled in late 90s adventure game aesthetic (Monkey Island, Quest for Glory).
 *
 * Characters are designed according to the Art Bible with culturally
 * accurate costume details for 1580s Portuguese Melaka.
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
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'portraits');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Base style for adventure game portraits
const STYLE_PREFIX = `Create a beautiful character portrait in the style of 1990s LucasArts adventure games, specifically "The Curse of Monkey Island" (1997) and "Gabriel Knight" series.

ART STYLE (CRITICAL):
- Hand-painted, lush illustration style - NOT pixel art
- Rich oil painting aesthetic with visible brushwork texture
- Dramatic chiaroscuro lighting (strong light/shadow contrast)
- Warm color palette: amber, gold, burgundy, deep browns, tropical greens
- Slightly stylized proportions - expressive but not cartoonish
- Painterly backgrounds with soft focus, suggesting location

COMPOSITION:
- Portrait orientation, head and shoulders visible
- Character facing 3/4 view towards viewer
- Eyes are the focal point - expressive and detailed
- Dramatic rim lighting from one side
- Atmospheric depth with subtle vignette

QUALITY:
- Museum-quality illustration
- Professional concept art level detail
- Costume details historically accurate to 1580s Portuguese Melaka
- Fabric textures visible (silk sheen, wool texture, linen weave)
- NO text, NO UI elements, NO watermarks, NO borders
`;

// Character portrait definitions based on Art Bible and NPC data
const PORTRAITS = {
  'player': {
    name: 'player',
    prompt: `A young Portuguese adventurer arriving in 1580s Melaka - the player character, our eyes into this world.

CHARACTER DETAILS:
- Age: mid-20s, handsome in a relatable way (not idealized)
- Expression: Curious, alert, taking everything in - a hint of wonder
- Clothing: Well-made but practical Portuguese doublet in warm brown leather
- White linen shirt visible at open collar, slightly rumpled from travel
- No elaborate ruffs or wealth displays - a practical traveler, not nobility
- Clean-shaven with slightly tousled medium-length dark hair
- Intelligent, observant hazel or brown eyes - the eyes of someone who notices details
- Sun-touched skin - not pale, has been traveling
- Perhaps a small satchel strap visible at shoulder

LIGHTING: Warm golden hour light, the magic light of arrival in a new land
BACKGROUND: Soft amber and gold tones, hints of tropical architecture, a world waiting to be explored
MOOD: Adventure awaits - hope, curiosity, determination

This is someone the player can project onto - capable but not superhuman, curious but not naive.`
  },

  'fernao-gomes': {
    name: 'fernao-gomes',
    prompt: `Fernão Gomes, a wealthy Portuguese spice merchant in 1580s Melaka.

CHARACTER DETAILS:
- Age: late 40s, handsome but careworn
- Expression: Worry lines on forehead, anxious eyes that dart sideways
- Clothing: Sumptuous burgundy velvet doublet with gold thread embroidery
- Distinctive white ruff collar (gorguera) - starched, elaborate, a symbol of his status
- Black velvet merchant's cap with small gold pin
- Graying beard, meticulously trimmed in the Spanish style
- Dark circles under eyes betraying sleepless nights
- A bead of sweat on his temple - tropical heat and anxiety combined
- Gold signet ring visible (ironic - he's lost his seal)

LIGHTING: Warm golden light from the left, suggesting afternoon sun through a window
BACKGROUND: Rich warm tones - hints of spice barrels, silk cloth, the wealth he fears losing
MOOD: A proud man brought low by circumstance - dignity masking desperation

The viewer should feel his anxiety, see a man whose fortune hangs by a thread.`
  },

  'capitao-rodrigues': {
    name: 'capitao-rodrigues',
    prompt: `Capitão Rodrigues, veteran Portuguese fortress commander in 1580s Melaka - a man forged by war.

CHARACTER DETAILS:
- Age: early 50s, hard and weathered like old leather
- Expression: Stern, watchful, perpetually suspicious - eyes scanning for threats
- Wearing iconic Spanish morion helmet - polished steel with a crest, battle-worn
- Steel gorget (neck armor) and breastplate visible, functional not decorative
- Old scar running down left cheek - a close call he never speaks of
- Gray-streaked black beard, cropped short and military-precise
- Hard grey eyes that have seen friends die - no warmth, only duty
- Deep tan, leathery skin from decades under tropical and Mediterranean suns
- Strong jaw, clenched - a man who holds everything in
- Perhaps the edge of a red captain's sash visible

LIGHTING: Harsh afternoon sun casting strong shadows - no softness, no mercy
BACKGROUND: Grey stone fortress walls, the ramparts of A Famosa he's sworn to defend
MOOD: Iron duty, eternal vigilance, the loneliness of command

He has buried too many men to make new friends. The fortress is all he has left.`
  },

  'padre-tomas': {
    name: 'padre-tomas',
    prompt: `Padre Tomás, a Jesuit priest in 1580s Portuguese Melaka - a man of faith wrestling with doubt.

CHARACTER DETAILS:
- Age: mid-40s, gentle face showing both kindness and inner struggle
- Expression: Compassionate eyes, but with a distant quality - a man who questions in private
- Wearing the black Jesuit cassock (sotana), simple and austere
- White Roman collar crisp against the black
- Traditional tonsure haircut - bald crown with ring of brown hair going grey
- Simple wooden crucifix on a rough cord, worn smooth by constant touching
- Pale, almost luminous complexion - a man of prayers and shadows
- Thin face, ascetic but not gaunt - he eats simply but regularly
- Gentle hands, perhaps one raised in a gesture of blessing or comfort
- Slight furrow in brow - the weight of souls

LIGHTING: Soft, diffused light as through church windows - holy but melancholy
BACKGROUND: Cool grey stone, hint of candlelight, the quiet interior of St. Paul's
MOOD: Gentle faith shadowed by doubt - he believes, but late at night, he wonders

He has saved many souls. He's not sure he can save his own.`
  },

  'aminah': {
    name: 'aminah',
    prompt: `Aminah, a Malay market vendor woman in 1580s Melaka - a survivor and keeper of secrets.

CHARACTER DETAILS:
- Age: mid-30s, beautiful in a weathered, real way
- Expression: A knowing half-smile, eyes that see everything
- Wearing elegant tudung (headscarf) in rich indigo blue with subtle gold trim
- Baju kurung blouse in warm ochre with intricate hand-drawn batik patterns (flora motifs)
- Delicate traditional Malay gold earrings (subang) catching the light
- Warm brown skin with the healthy glow of someone who works outdoors
- Laugh lines around eyes - a woman who finds joy despite hardship
- Strong hands, one perhaps touching her chin thoughtfully

LIGHTING: Dappled tropical sunlight filtering through market awnings, creating warm spots
BACKGROUND: Soft-focus market colors - mangoes, rambutans, tropical abundance
MOOD: Maternal warmth hiding razor-sharp intelligence

Her eyes say "I know your secrets" while her smile says "they're safe with me."`
  },

  'chen-wei': {
    name: 'chen-wei',
    prompt: `Chen Wei, a powerful Chinese guild representative in 1580s Melaka - the real power behind the trade.

CHARACTER DETAILS:
- Age: mid-50s, distinguished and commanding presence
- Expression: Inscrutable calm, the faintest hint of a knowing smile
- Traditional Ming dynasty hairstyle - neat topknot (ji), clean-shaven forehead
- Wearing exquisite silk changshan robe in deep imperial blue
- Subtle cloud patterns woven into the silk, visible in the light
- Traditional mandarin collar, perfectly pressed
- Thin, precise mustache and small pointed goatee (very refined)
- Penetrating dark eyes that weigh and measure everything
- High cheekbones, aristocratic bearing
- Hands folded calmly, perhaps visible at bottom of frame
- A jade pendant or scholar's ring suggesting his education

LIGHTING: Cool, measured light from the side - candlelight or window light in a counting house
BACKGROUND: Dark polished wood, hint of ledgers and abacus beads, wealth implied not displayed
MOOD: Absolute composure masking centuries of accumulated wisdom and grudges

The Portuguese think they rule Melaka. His eyes know better.`
  },

  'rashid': {
    name: 'rashid',
    prompt: `Rashid, a jovial Arab sailor and storyteller in 1580s Melaka - everyone's favorite rogue.

CHARACTER DETAILS:
- Age: late 30s, weathered by sun and salt but full of life
- Expression: Mid-laugh or telling a tale, eyes twinkling with mischief
- Wearing traditional keffiyeh (headscarf) in cream and brown checks, slightly askew
- Open-collared loose shirt, sun-bleached, showing tanned chest
- Jambiya (curved Arabian dagger) with ornate handle visible at belt
- Deep sun-darkened olive skin, almost mahogany from years at sea
- Wild, curly black beard with a few grey streaks
- Deep laugh lines around eyes and mouth - a man who smiles often
- Gap-toothed grin (missing one front tooth) - adds to his roguish charm
- Small gold hoop earring glinting in his ear
- Perhaps a scar on his cheek from some adventure

LIGHTING: Bright, warm sunlight - the golden light of a harbor afternoon
BACKGROUND: Blue sky, hint of ship rigging, the freedom of the open sea
MOOD: Infectious joy, the spirit of adventure, a man with a thousand stories

You'd trust him with your life but never with your coin purse.`
  }
};

/**
 * Generate portrait image using Gemini API
 */
async function generatePortrait(prompt, outputPath) {
  const fullPrompt = `${STYLE_PREFIX}\n\nCHARACTER TO PORTRAY:\n${prompt}`;

  const requestBody = JSON.stringify({
    contents: [{
      parts: [{ text: fullPrompt }]
    }],
    generationConfig: {
      // Request square aspect ratio for portraits
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

    req.setTimeout(90000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Generate all portraits
 */
async function generateAllPortraits() {
  console.log('\n🎨 A Famosa Portrait Generator - Adventure Game Style\n');
  console.log('Model:', MODEL);
  console.log('Output:', OUTPUT_DIR);
  console.log('=' .repeat(60) + '\n');

  let successCount = 0;
  let failCount = 0;

  for (const [key, portrait] of Object.entries(PORTRAITS)) {
    const outputPath = path.join(OUTPUT_DIR, `${portrait.name}.png`);
    console.log(`\n👤 Generating: ${portrait.name}`);
    console.log(`   Character: ${key}`);

    try {
      await generatePortrait(portrait.prompt, outputPath);
      console.log(`   ✅ Saved: ${portrait.name}.png`);
      successCount++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      failCount++;
    }

    // Rate limiting
    console.log('   ⏳ Waiting for rate limit...');
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`\n✅ Complete! ${successCount} portraits generated, ${failCount} failed.`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
}

/**
 * Generate a single portrait by key
 */
async function generateSingle(key) {
  const portrait = PORTRAITS[key];
  if (!portrait) {
    console.log(`❌ Portrait '${key}' not found.\n`);
    console.log('Available portraits:');
    Object.keys(PORTRAITS).forEach(k => console.log(`  - ${k}`));
    return;
  }

  const outputPath = path.join(OUTPUT_DIR, `${portrait.name}.png`);
  console.log(`\n👤 Generating: ${portrait.name}`);

  try {
    await generatePortrait(portrait.prompt, outputPath);
    console.log(`✅ Saved: ${outputPath}\n`);
  } catch (error) {
    console.log(`❌ Failed: ${error.message}\n`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--all')) {
    await generateAllPortraits();
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    await generateSingle(args[0]);
  } else {
    console.log('\n👤 A Famosa Portrait Generator\n');
    console.log('Generates adventure game style character portraits\n');
    console.log('Usage:');
    console.log('  node generate-portraits-gemini.js --all           Generate ALL portraits');
    console.log('  node generate-portraits-gemini.js <character>     Generate single portrait');
    console.log('\nAvailable characters:');
    Object.entries(PORTRAITS).forEach(([key, portrait]) => {
      console.log(`  - ${key.padEnd(20)} → ${portrait.name}.png`);
    });
    console.log('');
  }
}

main().catch(console.error);
