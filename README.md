# A Famosa: Streets of Golden Melaka

A pixel-art adventure RPG set in Portuguese Melaka circa 1580, inspired by Ultima VII.

## Overview

Explore the fortified downtown of Portuguese-controlled Melaka at the height of its power as the "Venice of the East." Interact with merchants, sailors, missionaries, and locals in a richly detailed world that captures the unique cultural collision of 16th-century maritime Southeast Asia.

**Game Resolution**: 960×540 canvas (3x scale over 320×180 art target)
**Perspective**: ¾ top-down isometric
**Engine**: Phaser 3

## Quick Start

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The game will open in your browser at `http://localhost:3000`

### Available Commands

```bash
npm run dev      # Start development server with hot reload
npm run build    # Create production build in dist/
npm run preview  # Preview production build
npm test         # Run unit tests
npm run generate:character-sheets  # Rebuild character sprite sheets
npm run generate:scene-variants    # Rebuild dawn/dusk/night scene variants
npm run generate:graphics          # Regenerate all graphics variants
```

### Graphics Pipeline

- Character sheets are generated into `assets/sprites/characters/` as 16×32 singles and 64×128 directional sheets.
- Scene variants are generated into `assets/scenes/` as `scene-*-dawn|dusk|night.png`.
- Runtime loads the generated assets directly via Phaser `BootScene`.

## Controls

- **Arrow Keys** or **WASD**: Move player (8-directional movement)
- **Space**: Interact
- **I**: Inventory
- **J**: Journal
- **ESC**: Pause menu
- **F6-F10**: Quick travel (debug)
- **T / Y**: Advance/rewind time (debug)

## Project Structure

```text
melaka-rpg/
├── assets/
│   ├── sprites/characters/   # Player + NPC sprites and animation sheets
│   ├── sprites/portraits/    # Dialogue portraits
│   ├── sprites/tiles/        # Tile textures
│   ├── sprites/objects/      # Prop textures
│   ├── scenes/               # Day + time-of-day location backdrops
│   └── audio/                # Music and SFX
├── src/
│   ├── phaser/scenes/        # BootScene, GameScene, runtime world logic
│   ├── components/           # React UI screens and overlays
│   ├── stores/               # Zustand game/save/inventory/quest state
│   └── data/                 # NPC/location/story JSON data
├── tools/                    # Asset generation scripts
├── electron/                 # Electron main/preload process files
├── docs/                     # Art bible and design docs
└── tests/                    # Jest tests
```

## Current Features

- ✅ Multi-scene overworld with location transitions
- ✅ Time-of-day cycle with dawn/day/dusk/night lighting and scene variants
- ✅ Player + named NPC directional animation sheets
- ✅ Dialogue, inventory, quest journal, and pause/save/load UI
- ✅ Save slots with metadata and restore/hydration across core stores
- ✅ Electron packaging support and browser-first development flow
- ✅ **Ultima 8-quality art pipeline** with dithered shading, ambient occlusion, specular highlights
- ✅ **Environment Object System** with 17 decoration clusters across 5 locations
- ✅ **Animated atmosphere objects** (torches, seagulls, flags, palm sway, smoke)
- ✅ **Historical accuracy corrections** (Ming-era Chen Wei, Indian merchant sprite, 5 new lore objects)
- ✅ **48 tile sprites** including 12 weathering variants and 8 surface transitions
- ✅ **61 object sprites** with culturally-authentic items (pelourinho, wayang kulit, pepper pile)

## In Progress

- [ ] Additional NPC schedules and movement between locations
- [ ] Expanded quest content and branching outcomes

## Development

### Creating Maps

Maps are created using [Tiled Map Editor](https://www.mapeditor.org/):

1. Open Tiled and create a new map
2. Set tile size to 16×16
3. Import tilesets from `assets/sprites/tiles/`
4. Create layers: Ground, Collision, Objects
5. Export as JSON to `assets/maps/`

**Note**: The collision layer should have tiles with a custom property `collides: true`

### Adding Sprites

1. Place sprite files in `assets/sprites/`
2. Load them in `src/phaser/scenes/BootScene.ts`
3. Reference them in your game code

### Project Guidelines

See `CLAUDE.md` for detailed development guidelines including:
- Code architecture patterns
- Art and audio standards
- Historical accuracy principles
- Atmosphere and design priorities

## Dependency security overrides

Build, packaging, and test tooling in this repo now use targeted `npm overrides` to keep vulnerable transitive `minimatch` ranges on patched versions without changing the top-level tool choices.

- Rationale and validation steps: `DEPENDENCY_SECURITY_OVERRIDES.md`
- Implementation: `package.json`

Remove the overrides only after the direct build and packaging dependencies resolve to fixed subdependencies on their own.

## Procedural Art Pipeline

All game sprites are generated procedurally via Node.js canvas scripts in `tools/ultima8-graphics/`:

```bash
node tools/ultima8-graphics/generate-all.cjs   # All tiles, objects, characters
node tools/generate-character-sheets-v2.cjs     # Directional sprite sheets
node tools/generate-iso-tiles.cjs               # Isometric tile transforms
```

The pipeline produces pixel-art sprites with Ultima 8-quality rendering:
- **8-shade palettes** with Bayer matrix dithering for smooth gradients
- **Ambient occlusion** shadows at object bases
- **Specular highlights** on metal, gold, and silk surfaces
- **Seeded random** for deterministic textures (wood grain, stone pitting, hair strands)
- **Tile variant system** for weathering and damage
- **Isometric perspective correction** for 3/4 view lighting

## Technology Stack

- **Engine**: Phaser 3
- **Build Tool**: Vite
- **Tilemap Editor**: Tiled
- **Art Pipeline**: Node.js + canvas (procedural sprite generation)
- **Audio Tools**: Audacity, LMMS/FamiStudio

## Historical Context

The game is set in 1580 Melaka:
- Portugal has controlled the city for nearly 70 years (captured 1511)
- It's a thriving entrepôt with trade from China, India, Siam, Java, and beyond
- The massive A Famosa fortress dominates the hill
- Jesuit missionaries are active
- Multiple cultures coexist: Portuguese, Malay, Chinese, Indian, Arab

## License

MIT

## Credits

Game concept and design for demonstration purposes.
Historical inspiration from Portuguese Melaka (1511-1641).
