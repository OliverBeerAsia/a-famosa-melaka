# Tools Directory

Asset generation and utility scripts for A Famosa: Streets of Golden Melaka.

## Primary Tools

Supported shipping generators:

- Gameplay characters: `generate-character-sheets-v2.cjs`
- Gameplay crowd silhouettes: `generate-crowd-silhouettes.cjs`
- Gameplay tiles and objects: `ultima8-graphics/generate-all.cjs`
- Cinematic scene art: `generate-scene-backgrounds.js` and `generate-time-of-day-variants.cjs`

Legacy or experimental generators in this folder should be treated as reference/staging tools unless explicitly promoted.

### `validate-gameplay-assets.cjs` (NEW - Mar 2026)
**Art pipeline audit** - Checks gameplay vs cinematic folders, isometric 2:1 sheet sizes, oversized source art, legacy standalone character sprites, and naming conventions. Can also emit a markdown report for review.

```bash
node tools/validate-gameplay-assets.cjs
node tools/validate-gameplay-assets.cjs --report docs/art-bible/art-audit.md
node tools/validate-gameplay-assets.cjs --report docs/art-bible/art-audit.md --strict
```

Use this before promoting art into shipping gameplay or cinematic folders.

### `generate-scene-backgrounds.js` (NEW - Jan 2026)
**Cinematic scene / interstitial background generator** - Creates detailed backgrounds using procedural pixel art techniques.

```bash
node tools/generate-scene-backgrounds.js
```

Features:
- **Bayer 4x4 ordered dithering** for classic sky gradients
- **Textured surfaces**: stone walls with mortar, terracotta roof tiles, cobblestones
- **Period-accurate architecture**: Portuguese colonial (1580s), Malay kampung houses
- **Atmospheric overlays**: golden dust, sea mist, divine light rays

Generates 6 scene backgrounds (960x540):
- `opening-screen.png` - Dramatic sunset silhouette with A Famosa fortress, harbor
- `scene-rua-direita.png` - Portuguese colonial market street with arcades, market stalls
- `scene-a-famosa.png` - Fortress gate with stone walls, crenellations, guards area
- `scene-st-pauls.png` - Hilltop church with bell tower, gravestones, stone steps
- `scene-waterfront.png` - Harbor with Portuguese carrack, Arab dhow, warehouses
- `scene-kampung.png` - Malay village with stilted houses, palm trees, attap roofs

### `generate-time-of-day-variants.cjs` (NEW - Feb 2026)
Generate dawn/dusk/night variants from existing base scene backgrounds:

```bash
node tools/generate-time-of-day-variants.cjs
```

Generates 15 files:
- `scene-*-dawn.png`
- `scene-*-dusk.png`
- `scene-*-night.png`

### `generate-crowd-silhouettes.cjs`
**Crowd silhouette generator** - Creates approved `8x16` background crowd sprites for the live Phaser runtime.

```bash
node tools/generate-crowd-silhouettes.cjs
```

### `create-placeholders.js`
Creates initial placeholder assets for rapid prototyping.

### `enhance-maps.js`
Enhances Tiled map exports with additional object layers and details.

### `backup-assets.js`
Backup and restore utility for asset directories.

```bash
node tools/backup-assets.js              # Backup all assets
node tools/backup-assets.js scenes       # Backup scenes only
node tools/backup-assets.js --list       # List existing backups
node tools/backup-assets.js --restore <backup-name>  # Restore a backup
```

## Asset Generation Tools

| Tool | Purpose |
|------|---------|
| `create-animated-sprites.js` | Animated sprite generation |
| `create-enhanced-character-sprites.js` | Character sprite creation |
| `create-pixel-art.js` | Basic pixel art generator |
| `create-npc-sprites.js` | NPC-specific sprites |
| `generate-character-sprites.js` | Character generation |

## Tileset Tools

| Tool | Purpose |
|------|---------|
| `create-atmospheric-tileset.js` | Atmospheric tiles |
| `create-market-tileset.js` | Market area tiles |
| `create-church-tileset.js` | Church tiles |
| `create-kampung-tileset.js` | Kampung village tiles |
| `create-waterfront-tileset.js` | Waterfront tiles |

## Audio Tools

| Tool | Purpose |
|------|---------|
| `create-audio-placeholders.js` | Audio placeholder generator |
| `create-valid-audio.js` | Audio validation |

## AI Generation Tools

These require API keys:

| Tool | Purpose |
|------|---------|
| `generate-sprites-gemini.js` | Gemini AI sprite generation |
| `generate-animations-gemini.js` | Gemini AI animations |
| `generate-scenes-gemini.js` | Scene image generation |

## Subdirectories

- `ai-prompts/` - Prompt templates for AI image generation
- `ultima8-graphics/` - Graphics generation scripts (reference implementation)

## Usage Notes

1. All tools use the `canvas` npm package for image generation
2. Output goes to `assets/sprites/` by default
3. Tools follow the 32-color Art Bible palette
4. Run from project root: `node tools/<script>.js`
5. Run `npm run validate:art -- --report docs/art-bible/art-audit.md` after major asset changes

## Dependencies

```bash
npm install canvas  # Required for image generation
```
