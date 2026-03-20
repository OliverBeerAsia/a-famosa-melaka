# A Famosa: Streets of Golden Melaka

A pixel-art adventure RPG set in Portuguese Melaka circa 1580, with a pure Ultima VIII-first gameplay art direction.

## Overview

Explore the fortified downtown of Portuguese-controlled Melaka at the height of its power as the "Venice of the East." Interact with merchants, sailors, missionaries, and locals in a historically grounded world that now ships against one gameplay-art contract: 2:1 isometric traversal, manifest-driven asset loading, and strict runtime validation for characters, crowd, tiles, maps, and props.

**Game Resolution**: 960×540 canvas (3x scale over 320×180 art target)
**Perspective**: 2:1 isometric gameplay traversal
**Engine**: Phaser 3
**Current Release**: `v0.5.0`

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
npm run validate:art -- --strict  # Enforce gameplay art/runtime contract
npm run generate:character-sheets  # Rebuild character sprite sheets
npm run generate:crowd             # Rebuild crowd role silhouettes
npm run generate:scene-variants    # Rebuild dawn/dusk/night scene variants
npm run generate:graphics          # Regenerate all graphics variants
```

### Graphics Pipeline

- Named gameplay characters are generated into `assets/sprites/characters/` as `64×192` sheet-only assets (`16×32` frames, `4×6` rows for walk/idle/talk).
- Crowd gameplay sprites are generated into `assets/sprites/crowd/` as `8×16` role silhouettes.
- Scene variants are generated into `assets/scenes/` as `scene-*-dawn|dusk|night.png`.
- The live runtime asset contract is defined in `src/data/runtime-asset-manifest.json`.
- `npm run validate:art -- --strict` checks palette compliance, sheet layout, crowd dimensions, manifest coverage, map parity, and forbidden legacy gameplay sprites.
- Phaser `BootScene` loads the manifest-defined gameplay assets directly.

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
│   ├── sprites/characters/   # Named character sheets
│   ├── sprites/crowd/        # Crowd role silhouettes
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
- ✅ Player + named NPC sheet-only animation contract (`64×192`, idle and talk rows included)
- ✅ Dialogue, inventory, quest journal, and pause/save/load UI
- ✅ Save slots with metadata and restore/hydration across core stores
- ✅ Electron packaging support and browser-first development flow
- ✅ **Manifest-driven gameplay art runtime** covering 10 named characters, 10 crowd roles, 5 isometric maps, 62 static props, and 6 animated object sheets
- ✅ **Strict gameplay art validation** for palette, dimensions, dead assets, map object parity, and runtime reachability
- ✅ **Authored isometric object layers** rendered in the live Phaser runtime
- ✅ **Ultima VIII-first art pipeline** with indexed ramps, dithered shading, ambient occlusion, and role-specific crowd silhouettes

## In Progress

- [ ] Additional NPC schedules and movement between locations
- [ ] Expanded quest content and branching outcomes

## Development

### Creating Maps

Maps are created using [Tiled Map Editor](https://www.mapeditor.org/):

1. Open Tiled and create a new map
2. For shipping gameplay maps, use an isometric map with `64×32` tiles
3. Import tilesets from `assets/sprites/tiles/iso/`
4. Author the runtime layers `Ground`, `Walls`, and object groups such as `Objects`, `Props`, `Overhang`, `Canopy`, and `Highlights` as needed
5. Export JSON to `assets/maps/` and register the map and object sprite usage in `src/data/runtime-asset-manifest.json`

**Note**: The live TypeScript Phaser runtime is the shipping source of truth. Orthogonal maps and cinematic scene PNGs remain as legacy/cinematic support, but gameplay traversal is standardized on the isometric contract.

### Adding Sprites

1. Place sprite files in `assets/sprites/`
2. Register new gameplay-facing assets in `src/data/runtime-asset-manifest.json`
3. Ensure `src/phaser/scenes/BootScene.ts` or the relevant runtime system loads the manifest-defined asset class
4. Reference the registered key from map/object data or gameplay code

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
node tools/generate-character-sheets-v2.cjs     # Named character sheets (64x192)
node tools/generate-crowd-silhouettes.cjs       # Crowd role silhouettes (8x16)
node tools/generate-iso-tiles.cjs               # Isometric tile transforms
```

The pipeline produces pixel-art sprites with Ultima 8-quality rendering:
- **8-shade palettes** with Bayer matrix dithering for smooth gradients
- **Ambient occlusion** shadows at object bases
- **Specular highlights** on metal, gold, and silk surfaces
- **Seeded random** for deterministic textures (wood grain, stone pitting, hair strands)
- **Tile variant system** for weathering and damage
- **Isometric perspective correction** for 2:1 traversal lighting
- **Indexed ramp canon** enforced by the gameplay art validator

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
