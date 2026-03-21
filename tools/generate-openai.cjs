/**
 * OpenAI DALL-E 3 Image Generator
 *
 * Generates scene backdrops and character portraits using the OpenAI Images API.
 * Uses the same Ultima VIII style prompts as the Gemini generators via
 * load-style-header.cjs, but targets DALL-E 3 instead.
 *
 * Requires: OPENAI_API_KEY environment variable
 *
 * Usage:
 *   node tools/generate-openai.cjs --scenes          # All 21 scene backdrops
 *   node tools/generate-openai.cjs --portraits        # All 14 portraits
 *   node tools/generate-openai.cjs --portrait siti    # One portrait
 *   node tools/generate-openai.cjs --scene a-famosa   # One scene (base + 3 variants)
 *   node tools/generate-openai.cjs --all              # Everything
 *   node tools/generate-openai.cjs --help             # Usage info
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createCanvas, loadImage } = require('canvas');
const { getStyleHeader } = require('./load-style-header.cjs');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_KEY = process.env.OPENAI_API_KEY;
const API_URL = 'https://api.openai.com/v1/images/generations';
const RATE_LIMIT_MS = 3000;

const PORTRAIT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'portraits');
const SCENE_DIR = path.join(__dirname, '..', 'assets', 'scenes');

// Ensure output directories exist
for (const dir of [PORTRAIT_DIR, SCENE_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Style headers from the canonical prompt system
const PORTRAIT_STYLE = getStyleHeader('portrait');
const SCENE_STYLE = getStyleHeader('scene-backdrop');

// ---------------------------------------------------------------------------
// Portrait definitions (mirrored from generate-portraits-gemini.cjs + 4 new)
// ---------------------------------------------------------------------------

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
  },

  'gaspar-mesquita': {
    name: 'gaspar-mesquita',
    prompt: `Gaspar Mesquita, a polished Portuguese customs inspector at A Famosa in 1580s Melaka - a bureaucrat who profits from order.

CHARACTER DETAILS:
- Age: late 30s to early 40s, well-groomed and self-satisfied
- Expression: A thin, composed smile that suggests he knows more than he reveals
- Clothing: Dark Portuguese doublet with modest but clean embroidery, a mid-rank official's dress
- White collar visible but not ostentatious - a man who respects appearances without overreaching
- Small trimmed beard or neat mustache, fastidious grooming
- Alert, calculating dark eyes beneath a flat-brimmed clerk's hat or bare head
- Ink-stained fingers from working with ledgers, a quill or scroll possibly at frame edge
- Olive complexion, composed posture, a slight forward lean as if assessing the viewer

LIGHTING: Flat official daylight, even and unromantic - the light of a customs office
BACKGROUND: Stone archway of A Famosa, stacked papers, a balance scale or strongbox implied
MOOD: Bureaucratic precision masking quiet self-enrichment

He speaks of order the way a pickpocket speaks of crowds - with professional appreciation.`
  },

  'diogo-almeida': {
    name: 'diogo-almeida',
    prompt: `Diogo Almeida, a nimble young Portuguese notary runner on Rua Direita in 1580s Melaka.

CHARACTER DETAILS:
- Age: early to mid-20s, quick and lean
- Expression: Wry half-smile, sharp observant eyes constantly reading the room
- Clothing: Simple Portuguese shirt and vest, practical for moving quickly through crowds
- A leather satchel or messenger bag slung across his chest, stuffed with folded papers
- Tousled dark hair, no hat - he moves too fast to keep one on
- Light stubble, youthful energy, slight tan from running outdoors all day
- Ink on his fingers and possibly a streak on his cheek from hurried copying
- Restless posture - caught mid-motion, leaning slightly as if about to dash off

LIGHTING: Bright dappled sunlight of a busy commercial street, warm and dynamic
BACKGROUND: Hints of Rua Direita's market awnings, building facades, movement and commerce
MOOD: Quick wit, street-level intelligence, the energy of someone who sees everything from below

He carries petitions, copies, and whispers - and forgets none of them.`
  },

  'lin-mei': {
    name: 'lin-mei',
    prompt: `Lin Mei, a precise Chinese counting-house clerk at the Melaka waterfront, 1580s.

CHARACTER DETAILS:
- Age: late 20s to early 30s, composed and meticulous
- Expression: Calm, focused, faintly amused by imprecision - a look of patient discernment
- Traditional Chinese hairstyle neatly arranged, practical for long hours of desk work
- Wearing a modest but well-made silk or cotton changshan in muted blue-grey
- Mandarin collar, clean lines, nothing ostentatious
- Slender hands resting near an abacus, brush, or ledger
- Clear, intelligent dark eyes behind a face of quiet authority
- Smooth skin, understated composure, sits perfectly still

LIGHTING: Cool interior light of a counting house - a mix of window daylight and lamplight
BACKGROUND: Dark polished wood desk, abacus beads, stacked manifests, organized precision
MOOD: Quiet competence, meticulous order, the weight of numbers that never lie

She does not repeat figures for men who were daydreaming.`
  },

  'pak-salleh': {
    name: 'pak-salleh',
    prompt: `Pak Salleh, a weathered Malay fisherman and porter in the kampung quarter of 1580s Melaka.

CHARACTER DETAILS:
- Age: late 40s to early 50s, strong and sun-darkened
- Expression: Steady, unhurried gaze with deep-set eyes that read the water and the weather
- Clothing: Simple sarong and loose cotton shirt, sleeves rolled above muscular forearms
- A wide-brimmed woven hat (topi) pushed back or hanging at his neck
- Deep brown skin weathered by decades of sun, salt spray, and river work
- Calloused hands, one perhaps resting on a coiled rope or net
- Sparse grey stubble, broad honest face, a few missing teeth
- Bare feet or simple sandals, a man rooted to the riverbank

LIGHTING: Early morning golden light reflecting off the river, warm and honest
BACKGROUND: Kampung riverbank, beached boats, palm fronds, fishing nets drying on poles
MOOD: River patience, working-class dignity, a man who reads tides better than letters

He knows which boats are honest, which are not, and which ones prefer night.`
  }
};

// ---------------------------------------------------------------------------
// Scene definitions (mirrored from generate-scenes-gemini.js + time variants)
// ---------------------------------------------------------------------------

const TIME_VARIANTS = {
  dawn: 'Pre-dawn and early morning. Sky shows pale rose-gold and lavender at the horizon, transitioning to cool blue above. First light catches the tops of buildings and masts. Long blue shadows stretch across the ground. Cooking fires and lanterns still glow warmly. The air feels cool and fresh, misty near the water. Few people are about - early risers, fishermen, monks at prayer.',
  dusk: 'Late afternoon into evening twilight. The sun is low, casting everything in deep amber and burnt orange. Long dramatic shadows. Sky graduates from warm gold at the horizon through coral to deep blue overhead. Torches and oil lamps are being lit. The day\'s heat lingers. Activity is winding down - merchants closing stalls, sailors finishing work, the city preparing for evening.',
  night: 'Full nighttime scene. Deep blue-black sky with visible stars and perhaps a crescent moon. The scene is lit by warm pools of torchlight, oil lanterns, and firelight creating dramatic contrast. Windows glow amber from within. Most of the scene is in deep shadow with selective warm illumination. Fewer people visible, those present are shadowy figures. An atmosphere of mystery and quiet.'
};

const SCENES = {
  'opening-screen': {
    fileName: 'opening-screen',
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

  'a-famosa': {
    fileName: 'scene-a-famosa',
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
- A few civilians passing through the gate`
  },

  'rua-direita': {
    fileName: 'scene-rua-direita',
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
- Distant view of fortress on hill through a gap in buildings`
  },

  'st-pauls': {
    fileName: 'scene-st-pauls',
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
- Contrast between sacred European architecture and tropical setting`
  },

  'waterfront': {
    fileName: 'scene-waterfront',
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
- Creaking wood and lapping waves implied`
  },

  'kampung': {
    fileName: 'scene-kampung',
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
- Authentic traditional Malay village life`
  }
};

// ---------------------------------------------------------------------------
// API call helper
// ---------------------------------------------------------------------------

/**
 * Call the OpenAI Images API (DALL-E 3) and return raw image data as a Buffer.
 *
 * @param {string} prompt  - Full prompt text
 * @param {string} size    - One of '1024x1024', '1024x1792', '1792x1024'
 * @returns {Promise<Buffer>}
 */
function callDalle(prompt, size) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality: 'hd',
      response_format: 'b64_json',
    });

    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          const data = JSON.parse(raw);

          if (data.error) {
            const msg = data.error.message || JSON.stringify(data.error);
            if (/rate limit/i.test(msg)) {
              reject(new Error(`Rate limited by OpenAI. Wait and retry. Details: ${msg}`));
            } else if (/quota|billing/i.test(msg)) {
              reject(new Error(`OpenAI quota/billing issue: ${msg}`));
            } else {
              reject(new Error(`OpenAI API error: ${msg}`));
            }
            return;
          }

          if (!data.data || !data.data[0] || !data.data[0].b64_json) {
            reject(new Error('No image data in OpenAI response'));
            return;
          }

          resolve(Buffer.from(data.data[0].b64_json, 'base64'));
        } catch (e) {
          reject(new Error(`Failed to parse OpenAI response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Request failed: ${e.message}`)));
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timed out after 120 seconds'));
    });

    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Image resizing with nearest-neighbor (pixel art preservation)
// ---------------------------------------------------------------------------

/**
 * Resize a PNG buffer to exact target dimensions using nearest-neighbor interpolation.
 *
 * @param {Buffer} imageBuffer - Source PNG image data
 * @param {number} targetW     - Target width
 * @param {number} targetH     - Target height
 * @returns {Promise<Buffer>}  - Resized PNG buffer
 */
async function resizeImage(imageBuffer, targetW, targetH) {
  const img = await loadImage(imageBuffer);
  const canvas = createCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d');

  // Disable smoothing for nearest-neighbor (pixel art preservation)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return canvas.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// Backup helper
// ---------------------------------------------------------------------------

function backupIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    const bakPath = filePath.replace(/\.png$/, '.bak.png');
    fs.renameSync(filePath, bakPath);
    console.log(`    Backed up existing file to ${path.basename(bakPath)}`);
  }
}

// ---------------------------------------------------------------------------
// Rate limit delay
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Portrait generation
// ---------------------------------------------------------------------------

async function generatePortrait(id) {
  const portrait = PORTRAITS[id];
  if (!portrait) {
    console.error(`Unknown portrait id: "${id}"`);
    console.error('Available:', Object.keys(PORTRAITS).join(', '));
    process.exit(1);
  }

  const fullPrompt = `${PORTRAIT_STYLE}\n\nCHARACTER TO PORTRAY:\n${portrait.prompt}`;
  const outputPath = path.join(PORTRAIT_DIR, `${portrait.name}.png`);

  console.log(`  Generating portrait: ${portrait.name}`);
  backupIfExists(outputPath);

  const rawBuffer = await callDalle(fullPrompt, '1024x1024');
  const resized = await resizeImage(rawBuffer, 512, 512);
  fs.writeFileSync(outputPath, resized);
  console.log(`    Saved: ${portrait.name}.png (512x512)`);
}

async function generateAllPortraits() {
  const ids = Object.keys(PORTRAITS);
  console.log(`\nGenerating ${ids.length} portraits...\n`);

  let success = 0;
  let fail = 0;

  for (const id of ids) {
    try {
      await generatePortrait(id);
      success++;
    } catch (err) {
      console.error(`    FAILED (${id}): ${err.message}`);
      fail++;
    }
    await delay(RATE_LIMIT_MS);
  }

  console.log(`\nPortraits complete: ${success} succeeded, ${fail} failed.\n`);
}

// ---------------------------------------------------------------------------
// Scene generation
// ---------------------------------------------------------------------------

/**
 * Build a full scene prompt, optionally adding a time-of-day overlay description.
 */
function buildScenePrompt(sceneKey, timeVariant) {
  const scene = SCENES[sceneKey];
  let prompt = `${SCENE_STYLE}\n\nSCENE TO CREATE:\n${scene.prompt}`;

  if (timeVariant && TIME_VARIANTS[timeVariant]) {
    prompt += `\n\nTIME OF DAY - ${timeVariant.toUpperCase()}:\n${TIME_VARIANTS[timeVariant]}`;
  }

  return prompt;
}

function sceneOutputPath(sceneKey, timeVariant) {
  const scene = SCENES[sceneKey];
  const suffix = timeVariant ? `-${timeVariant}` : '';
  return path.join(SCENE_DIR, `${scene.fileName}${suffix}.png`);
}

async function generateSingleSceneFile(sceneKey, timeVariant) {
  const label = timeVariant
    ? `${SCENES[sceneKey].fileName}-${timeVariant}`
    : SCENES[sceneKey].fileName;

  console.log(`  Generating scene: ${label}`);

  const prompt = buildScenePrompt(sceneKey, timeVariant);
  const outputPath = sceneOutputPath(sceneKey, timeVariant);
  backupIfExists(outputPath);

  const rawBuffer = await callDalle(prompt, '1792x1024');
  const resized = await resizeImage(rawBuffer, 960, 540);
  fs.writeFileSync(outputPath, resized);
  console.log(`    Saved: ${path.basename(outputPath)} (960x540)`);
}

/**
 * Generate a scene with its base image plus all 3 time-of-day variants.
 */
async function generateSceneWithVariants(sceneKey) {
  if (!SCENES[sceneKey]) {
    console.error(`Unknown scene key: "${sceneKey}"`);
    console.error('Available:', Object.keys(SCENES).join(', '));
    process.exit(1);
  }

  // Base scene (day / golden hour)
  await generateSingleSceneFile(sceneKey, null);
  await delay(RATE_LIMIT_MS);

  // Time-of-day variants (opening-screen only gets base, no variants)
  if (sceneKey !== 'opening-screen') {
    for (const variant of Object.keys(TIME_VARIANTS)) {
      await generateSingleSceneFile(sceneKey, variant);
      await delay(RATE_LIMIT_MS);
    }
  }
}

async function generateAllScenes() {
  const keys = Object.keys(SCENES);
  // Count: opening-screen (1 base) + 5 locations * 4 (base + 3 variants) = 21
  const total = 1 + (keys.length - 1) * 4;
  console.log(`\nGenerating ${total} scene images...\n`);

  let success = 0;
  let fail = 0;

  for (const key of keys) {
    try {
      if (key === 'opening-screen') {
        await generateSingleSceneFile(key, null);
        success++;
        await delay(RATE_LIMIT_MS);
      } else {
        // Base
        await generateSingleSceneFile(key, null);
        success++;
        await delay(RATE_LIMIT_MS);

        // Variants
        for (const variant of Object.keys(TIME_VARIANTS)) {
          try {
            await generateSingleSceneFile(key, variant);
            success++;
          } catch (err) {
            console.error(`    FAILED (${key}-${variant}): ${err.message}`);
            fail++;
          }
          await delay(RATE_LIMIT_MS);
        }
      }
    } catch (err) {
      console.error(`    FAILED (${key}): ${err.message}`);
      fail++;
    }
  }

  console.log(`\nScenes complete: ${success} succeeded, ${fail} failed.\n`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
A Famosa - OpenAI DALL-E 3 Image Generator
===========================================

Generates scene backdrops and character portraits using the OpenAI Images API.
Requires OPENAI_API_KEY environment variable.

Usage:
  node tools/generate-openai.cjs --scenes              Generate all 21 scene backdrops
  node tools/generate-openai.cjs --portraits            Generate all 14 portraits
  node tools/generate-openai.cjs --portrait <id>        Generate one portrait
  node tools/generate-openai.cjs --scene <location>     Generate one scene (base + variants)
  node tools/generate-openai.cjs --all                  Generate everything
  node tools/generate-openai.cjs --help                 Show this help

Portraits (${Object.keys(PORTRAITS).length}):
${Object.keys(PORTRAITS).map(k => '  ' + k).join('\n')}

Scenes (${Object.keys(SCENES).length} locations, 21 total images):
${Object.keys(SCENES).map(k => '  ' + k).join('\n')}
  (Each location except opening-screen gets dawn/dusk/night variants)
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  // Check for API key early
  if (!API_KEY) {
    console.error('Error: Missing OPENAI_API_KEY environment variable.');
    console.error('Set it with: export OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  console.log('\nA Famosa - OpenAI DALL-E 3 Generator');
  console.log('Model: dall-e-3 (HD quality)');
  console.log('=' .repeat(50));

  if (args.includes('--all')) {
    await generateAllPortraits();
    await generateAllScenes();
  } else if (args.includes('--portraits')) {
    await generateAllPortraits();
  } else if (args.includes('--scenes')) {
    await generateAllScenes();
  } else if (args.includes('--portrait')) {
    const idx = args.indexOf('--portrait');
    const id = args[idx + 1];
    if (!id) {
      console.error('Error: --portrait requires a character id.');
      console.error('Available:', Object.keys(PORTRAITS).join(', '));
      process.exit(1);
    }
    await generatePortrait(id);
  } else if (args.includes('--scene')) {
    const idx = args.indexOf('--scene');
    const id = args[idx + 1];
    if (!id) {
      console.error('Error: --scene requires a location key.');
      console.error('Available:', Object.keys(SCENES).join(', '));
      process.exit(1);
    }
    await generateSceneWithVariants(id);
  } else {
    console.error('Unknown arguments:', args.join(' '));
    printHelp();
    process.exit(1);
  }

  console.log('Done.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
