/**
 * Portrait Generator using Google Gemini API
 *
 * Generates character portraits for NPC dialogues.
 * Styled for late-80s / early-90s VGA adventure RPG portrait presentation.
 *
 * Characters are designed according to the Art Bible with culturally
 * accurate costume details for 1580s Portuguese Melaka.
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
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'portraits');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Base style for VGA-era portraits — loaded from canonical style header
const STYLE_PREFIX = getStyleHeader('portrait');

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
  },

  'siti': {
    name: 'siti',
    prompt: `Siti, a young Malay servant woman taking sanctuary in St. Paul's Church in 1580s Melaka.

CHARACTER DETAILS:
- Age: late teens or early 20s, visibly exhausted but still composed
- Expression: Frightened vigilance mixed with quiet dignity
- Clothing: Simple indigo or deep blue baju kurung with worn fabric, practical rather than luxurious
- Head covering modest and slightly disordered from stress, not staged for elegance
- Warm brown skin, youthful features, eyes rimmed by lack of sleep
- No jewelry beyond perhaps one small family token or thread bracelet
- Hands drawn close to the body or folded defensively
- She should read instantly as vulnerable but not broken

LIGHTING: Soft church light, cool and indirect with a faint warm candle edge
BACKGROUND: Whitewashed chapel wall, worn timber, shadows of sanctuary rather than grand wealth
MOOD: A fragile refuge, fear held together by faith and resolve

She is not a market matriarch like Aminah. She is younger, poorer, and carrying fresh trauma without losing her self-respect.`
  },

  'alvares': {
    name: 'alvares',
    prompt: `Senhor Alvares, a wealthy Portuguese sugar merchant in 1580s Melaka whose polished respectability conceals cruelty.

CHARACTER DETAILS:
- Age: early to mid-40s, prosperous and well-fed
- Expression: Controlled disdain, the kind of smile that never reaches the eyes
- Clothing: Expensive but practical merchant attire, dark velvet or blackened crimson doublet with restrained gold trim
- No anxious softness like Fernão Gomes; this man is composed and predatory
- Clean beard or tightly trimmed facial hair, immaculate grooming
- A merchant's cap or slicked hairline, carefully maintained in spite of tropical heat
- A heavy ring, chain, or sign of wealth visible but not flamboyant
- Pale-to-olive Portuguese complexion sun-touched by Melaka, with a stern jaw and narrowed eyes

LIGHTING: Warm side light that reveals money and texture but also sharp shadow on the face
BACKGROUND: Sugar cargo, ledgers, and a controlled mercantile interior rather than a cozy office
MOOD: Colonial entitlement, economic power, menace behind civility

The portrait should signal a man who thinks law, trade, and violence all belong to him by right.`
  },

  'mak-enang': {
    name: 'mak-enang',
    prompt: `Mak Enang, an elderly Malay healer in 1580s Melaka - respected, sharp-tongued, and impossible to intimidate.

CHARACTER DETAILS:
- Age: late 60s or older, lined face full of intelligence and lived experience
- Expression: Assessing, amused, slightly severe - a woman who has seen too much to be impressed easily
- Clothing: Muted green or earth-toned traditional dress with practical layering, not merchant finery
- Head covering or shawl worn for function, not display
- Weathered hands marked by work with herbs, roots, and medicines
- Warm brown skin, silver strands visible, posture upright despite age
- A small pouch of herbs, pestle, or bundle of roots may be visible at frame edge
- She should read as village authority, not fragility

LIGHTING: Filtered tropical shade with warm reflected light from wood and earth
BACKGROUND: Kampung verandah, hanging herbs, clay jars, medicinal preparation space
MOOD: Enduring knowledge, humor, and hard-earned authority

This is the kind of elder people trust before they trust official doctors or priests.`
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
