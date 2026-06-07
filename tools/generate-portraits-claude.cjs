'use strict';
/**
 * Portrait Generator — Claude API (claude-sonnet-4-6)
 *
 * Generates 512×512 NPC portrait images using Claude's image generation.
 * Falls back to the algorithmic generator (gen_portraits.py) if no API key.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node tools/generate-portraits-claude.cjs
 *   node tools/generate-portraits-claude.cjs fernao-gomes  # single character
 *
 * Requires:
 *   npm install @anthropic-ai/sdk  (in project root)
 */

const fs   = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const ROOT    = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets/sprites/portraits');

// ── Style prefix shared with prompts.json ─────────────────────────────────
const STYLE_HEADER = `Pixel art portrait in the visual language of Ultima VIII: Pagan.
Dense, material-honest rendering. Rules:
- 16×16 to 512×512 pixel grid, nearest-neighbour scaled
- Ordered (Bayer 4×4) dithering for gradients — NO anti-aliasing, NO soft edges
- NW (top-left, 315°) primary light source; hard SE shadow
- Limited 48-colour palette: warm tropicals, terracotta, parchment, navy, crimson
- Face fills 60–75% of frame height, looking directly forward
- Black 1px outline on all silhouette edges
- Period: Portuguese Melaka circa 1580
- Historical dress and cultural accuracy
`;

// ── Character descriptors ─────────────────────────────────────────────────
const CHARACTERS = {
  'fernao-gomes': {
    name: 'Fernão Gomes',
    desc: 'Portuguese spice merchant, 40s, weathered olive skin, close-cropped dark beard with silver streaks, doublet of deep crimson velvet with gold buttons, white linen ruff collar, expression: shrewd but friendly, slightly worried',
  },
  'capitao-rodrigues': {
    name: 'Capitão Rodrigues',
    desc: 'Portuguese fortress captain, 50s, suntanned fair skin, iron-grey full beard, wearing a polished morion helmet with swept brim, steel gorget, crimson sash over breastplate, expression: stern authority, direct gaze',
  },
  'padre-tomas': {
    name: 'Padre Tomás',
    desc: 'Jesuit priest, 60s, pale Portuguese complexion, bald tonsure, deep-set grey eyes, black Jesuit cassock with white collar, weathered wooden crucifix, expression: kind but troubled, furrowed brow',
  },
  'aminah': {
    name: 'Aminah',
    desc: 'Malay market vendor woman, 30s, warm brown skin, dark eyes with kohl, traditional batik sarong kebaya in saffron and maroon, golden selendang headscarf draped loosely, expression: warm smile, knowing look',
  },
  'chen-wei': {
    name: 'Chen Wei',
    desc: 'Chinese guild representative, 50s, pale Chinese complexion, thin moustache and wispy goatee, dark blue scholar guan mao cap, embroidered silk changshan in midnight blue with gold trim, expression: calculating, composed',
  },
  'rashid': {
    name: 'Rashid',
    desc: 'Arab sailor, 30s, olive Arab complexion, unshaven stubble, bright curious dark eyes, white keffiyeh headdress with rope agal, loose white thobe with a striped sash, expression: grinning mischief, one eyebrow raised',
  },
  'diogo-almeida': {
    name: 'Diogo de Almeida',
    desc: 'Portuguese nobleman, 35s, fair complexion, clean-shaven with a thin moustache, wearing a feathered velvet hat and rich embroidered doublet in navy and gold, gold chain of office, expression: haughty, suspicious',
  },
  'gaspar-mesquita': {
    name: 'Gaspar Mesquita',
    desc: 'Portuguese merchant sailor, 40s, deeply tanned skin, salt-and-pepper stubble, leather jerkin over coarse linen shirt, worn broad-brimmed hat pushed back, expression: jovial rogue, laugh lines',
  },
  'alvares': {
    name: 'Alvares',
    desc: 'Portuguese soldier, 25s, fair sunburnt skin, short blond hair, clean-shaven, wearing a morion helmet tilted back, leather cuirass over red gambeson, expression: young and alert, slightly nervous',
  },
  'lin-mei': {
    name: 'Lin Mei',
    desc: 'Chinese merchant woman, 40s, pale Chinese complexion, hair in ornate jade pin bun, embroidered silk hanfu in jade green and gold, delicate white face powder, expression: serene intelligence, measuring look',
  },
  'mak-enang': {
    name: 'Mak Enang',
    desc: 'Malay elder woman, 60s, dark weathered skin, deeply lined face, white hair pinned under a simple white tudung headscarf, plain white baju kurung, expression: wise amusement, knowing eyes',
  },
  'pak-salleh': {
    name: 'Pak Salleh',
    desc: 'Malay fisherman, 50s, very dark sun-weathered skin, short grey hair, traditional Malay baju melayu in earth tones with a sarong cloth tucked at the waist, expression: calm dignity, weary but content',
  },
  'siti': {
    name: 'Siti',
    desc: 'Young Malay woman, 20s, warm brown skin, large dark eyes, flowing black hair with a frangipani flower, colourful batik baju kurung in coral and gold, expression: curious excitement, slightly shy smile',
  },
  'player': {
    name: 'The Wanderer',
    desc: 'Player character, gender-neutral traveller, 20s, mixed-heritage appearance, practical travelling clothes of leather and linen, a broad-brimmed hat, worn leather satchel strap visible, expression: open, watchful, adventurous',
  },
};

// ── Build prompt for a character ──────────────────────────────────────────
function buildPrompt(char) {
  return `${STYLE_HEADER}
Subject: ${char.name}
Description: ${char.desc}

Composition: bust portrait (head and shoulders), centred, facing directly forward.
Background: simple single-colour gradient appropriate to the character's cultural context.
Size: 512×512 pixels.
Do NOT include any text, name labels, or UI chrome in the image.`;
}

// ── Try Claude API ─────────────────────────────────────────────────────────
async function generateWithClaude(charId, char) {
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch {
    console.error('  @anthropic-ai/sdk not installed. Run: npm install @anthropic-ai/sdk');
    return false;
  }

  const client = new Anthropic.default({ apiKey: API_KEY });
  const prompt = buildPrompt(char);

  console.log(`  Generating ${charId} via Claude API...`);
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [{
          type: 'text',
          text: prompt,
        }],
      }],
    });

    // Claude image generation returns image blocks
    const imgBlock = response.content.find(b => b.type === 'image');
    if (!imgBlock) {
      console.log('  No image block in response — Claude may not support image generation on this endpoint.');
      return false;
    }

    const imgData = Buffer.from(imgBlock.source.data, 'base64');
    const outPath = path.join(OUT_DIR, `${charId}.png`);
    fs.writeFileSync(outPath, imgData);
    console.log(`  ✓ ${charId}.png saved`);
    return true;
  } catch (err) {
    console.error(`  API error: ${err.message}`);
    return false;
  }
}

// ── Fallback: run algorithmic generator ──────────────────────────────────
function generateAlgorithmic(charId) {
  const scriptPath = path.join(__dirname, '../../outputs/gen_portraits.py');
  if (!fs.existsSync(scriptPath)) {
    console.warn('  Algorithmic fallback script not found at', scriptPath);
    return;
  }
  try {
    execSync(`python3 "${scriptPath}" ${charId}`, {
      env: { ...process.env, MELAKA: ROOT },
      stdio: 'inherit',
    });
  } catch {
    console.error('  Algorithmic generation also failed for', charId);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const target = process.argv[2];  // optional single character
  const chars  = target
    ? { [target]: CHARACTERS[target] }
    : CHARACTERS;

  if (target && !CHARACTERS[target]) {
    console.error(`Unknown character: ${target}`);
    console.error('Valid IDs:', Object.keys(CHARACTERS).join(', '));
    process.exit(1);
  }

  if (!API_KEY) {
    console.log('No ANTHROPIC_API_KEY found — using algorithmic generator for all portraits.');
    console.log('To use Claude API: add ANTHROPIC_API_KEY=sk-ant-... to .env\n');
    for (const charId of Object.keys(chars)) {
      generateAlgorithmic(charId);
    }
    return;
  }

  console.log(`Generating ${Object.keys(chars).length} portrait(s) via Claude API\n`);
  for (const [charId, char] of Object.entries(chars)) {
    const ok = await generateWithClaude(charId, char);
    if (!ok) {
      console.log(`  Falling back to algorithmic for ${charId}`);
      generateAlgorithmic(charId);
    }
  }
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
