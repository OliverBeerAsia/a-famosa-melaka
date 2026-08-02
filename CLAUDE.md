# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**A Famosa: Streets of Golden Melaka** is a small, atmospheric adventure RPG inspired by Ultima VII, set in Portuguese Melaka circa 1580. The game features pixel-art graphics (320×180 base resolution), ¾ top-down isometric perspective, and focuses on exploration, NPC interaction, and story-driven quests in a historically-inspired setting.

## Technology Stack

- **Graphics Production**: Claude-managed — procedural code engine (`tools/ultima8-graphics/*`) for the gameplay kit + Canva MCP for scene plates. **No external image-generation API keys** (no Gemini/OpenAI). Claude/Anthropic has no native image generation.

## Resolution & Scaling Architecture

**IMPORTANT**: The game uses a hybrid resolution approach:

| Layer | Resolution | Notes |
|-------|------------|-------|
| Game Canvas | 960×540 | Phaser renders at this size |
| Scene Plates | 320×180 native → 960×540 | Painted background pixelated to native, nearest-upscaled 3× |
| Character Sprites | 16×32 native | Scaled 3× at runtime to 48×96 |
| Static Props | sprites | Composited on the plate, scaled ~2× |
| Tile Sprites | 16×16 native | Iso tilemap path only (not shipping) |

### Why This Matters
- **Original spec** was 320×180 native with integer scaling
- **Current implementation** uses 960×540 canvas with 3× scaled characters
- **Shipping world is the painted PLATE, not the isometric tilemap** — as of v0.10.0 all 5 locations ship in `legacy-backdrop` mode: a per-location painted background plate with the player, NPCs, props, and items composited on top as Y-sorted sprites (Ultima VII-style overlap). The isometric tilemap renderer (`src/phaser/systems/IsometricRenderer.ts`) still exists but is no longer the shipping gameplay path.
- **Plates are pixelated to native 320×180 then nearest-upscaled to 960×540** so the background's pixel grid matches the 3×-scaled sprites — one cohesive chunky pixel-art look, 0% off-palette, no anti-aliasing.
- **`runtimeMode`** per location lives in `src/data/locations/<id>.location.json` under `plate.runtimeMode` (all set to `"legacy-backdrop"`). BootScene skips the iso tilemaps/tile textures entirely while no location is `"isometric"`.
- **CHARACTER_SCALE constant** in `src/phaser/game.ts` controls sprite scaling

### Scene Plate Pipeline
1. **Generate**: Canva MCP (Magic Media) produces a TRUE 2:1 isometric, EMPTY plaza/scene — no baked props or people — exported as PNG.
2. **Post-process**: `tools/post-process-scene.cjs` palette-quantizes + ordered-Bayer-dithers + PIXELATES the export to native 320×180 (`--pixelate 3`, with `--spread`/`--dither` controls), then nearest-upscales to 960×540.
3. **Install**: the processed plate becomes the location background. Master exports and provenance are tracked in `tools/canva-sources/` (see `MANIFEST.json`).

### Depth & Compositing
- Unified `worldDepth(y)` Y-sorting applies to player, NPCs, props, and items in both modes (`GameScene.ts`, `EnvironmentObjectSystem.ts`), clamped below the FX/UI depth bands (~800 / ~1001).

### Spawns & Collision (legacy-backdrop)
- **ALL** per-location coordinates are authored in NATIVE 320x180 plate pixels in `src/data/locations/<id>.location.json` and multiplied by `world.scale` (3) exactly once, in `src/phaser/core/LocationData.ts`. Never scale again downstream.
- Each plate defines perimeter `collisionRects`, plus water-edge collision for the waterfront and kampung.
- Location transitions use an on-screen pixel `triggerArea` + `spawnAt`.

### When Adding New Sprites
New character/NPC sprites should be:
- Created at 16×32 pixels (standard character size)
- They will be automatically scaled 3× by the game engine
- Physics bodies are sized proportionally via `CHARACTER_SCALE`

### Key Files
- `src/phaser/game.ts` - Contains `CHARACTER_SCALE = 3` constant
- `src/phaser/scenes/GameScene.ts` - Applies scaling + `worldDepth(y)` Y-sorting to player/NPCs
- `src/phaser/systems/EnvironmentObjectSystem.ts` - `placeStaticObjects` composites props from the location file's `props` array (skips iso-grid `clusters` unless running isometric)
- `src/phaser/systems/IsometricRenderer.ts` - Iso tilemap renderer (exists, not the shipping path)
- `src/data/locations/<id>.location.json` - THE per-location source of truth: plate/variants/`runtimeMode`, `collision.rects`, `spawns.player`, `npcs`, `transitions`, `props`, `animatedProps`, `lights`, `fires`, `audio`, `visual`, `crowd`, `items`, `loreObjects` — all in native 320x180 px
- `src/phaser/core/LocationData.ts` - loader/validator/native->world transform + typed accessors
- `src/phaser/core/depth.ts` - `worldDepth(y)` + the depth-band constants (world <800, FX 800-1000, UI 1001+)
- `tools/validate-location-data.cjs` - pretest/prebuild gate: every coordinate on-plate, every sprite/audio key real, transitions paired
- `tools/migrate-location-data.cjs` - one-shot codemod that built the above from the pre-Stage-1 sources (see `tools/migration-report.md`)
- `src/data/environment-objects.json` - Iso-grid `clusters` only (isometric authoring source; the shipping prop layout lives in the location files)
- `tools/post-process-scene.cjs` - Scene quantizer/dither/pixelate (`--pixelate`, `--spread`, `--dither`)
- `tools/canva-sources/MANIFEST.json` - Plate provenance and master exports

## Core Architecture

### Key Design Patterns

- **Modular Systems**: Keep dialogue, inventory, time, and NPC logic in separate, loosely-coupled modules
- **Data-Driven NPCs**: Store NPC dialogue, schedules, and behaviors in JSON files under `src/data/`
- **Entity-Component Pattern**: NPCs and objects should be composable entities with behavior components
- **Scene Management**: Each location (A Famosa Gate, Market, Waterfront, etc.) is a separate scene

## Art & Audio Standards

### Visual Guidelines

- **Palette**: Limited 32-48 colors; warm tropical tones, Portuguese terracotta, whitewashed walls, jungle greens, ocean blues
- **Tile Size**: 16×16 pixels for ground tiles; 16×32+ for characters/structures
- **Consistent Pixel Density**: No mixed resolutions across assets
- **Indexed Color**: Use indexed color palettes for visual cohesion
- **Palette Canon**: Maintained in `tools/ultima8-graphics/palette.cjs` (includes a tropical sky-blue ramp); all tile/scene PNGs are quantized to it
- **Animation**: Subtle environmental animation (palm fronds, water, torches, cloth)
- **Production Rule**: Graphics are Claude-managed via the procedural engine + Canva MCP. Do NOT introduce external image-generation API keys (Gemini/OpenAI).

### Audio Guidelines

- **Music Style**: Renaissance-meets-Gamelan fusion; Portuguese fado + Malay gamelan + Chinese melodic elements in chiptune/lo-fi style
- **Ambient Layers**: Seagulls, cicadas, church bells, water lapping, distant calls
- **Interactive SFX**: Footsteps (stone/wood/dirt), doors, coins, swords, crowds
- **UI Sounds**: Ultima-style character speech blips, menu navigation

## Historical & Cultural Principles

1. **Research First**: Verify historical details before implementing (architecture, clothing, trade goods, customs)
2. **Multicultural Accuracy**: Portray Portuguese, Malay, Chinese, Indian, and Arab cultures with respect and nuance
3. **Authentic Details**: Small touches (correct clothing styles, period-appropriate food, architectural elements) build believability
4. **Avoid Stereotypes**: All cultures should be portrayed as complex and fully realized

## Demo Scope

The initial demo focuses on the downtown district with 5 key locations:

1. **A Famosa Fortress Gate** — Iconic entrance with guards
2. **Rua Direita (Main Street)** — Commercial heart with market stalls and taverns
3. **St. Paul's Church Hill** — Stone church overlooking the strait
4. **The Waterfront Quay** — Ships, cargo, and merchants
5. **The Kampung Quarter** — Local Malay village area

### Demo Quest: "The Merchant's Seal"

A Portuguese merchant (Fernão Gomes) has lost his trading seal. Player investigates by questioning NPCs (6 key characters), exploring locations, and negotiating with the Chinese merchant guild to retrieve it.

## Key NPCs (Demo)

- **Fernão Gomes**: Portuguese spice merchant, quest giver (Warehouse, Rua Direita)
- **Capitão Rodrigues**: Fortress guard captain (A Famosa Gate)
- **Padre Tomás**: Jesuit priest (St. Paul's Church)
- **Aminah**: Malay market vendor (Market stalls)
- **Chen Wei**: Chinese guild representative (Waterfront counting house)
- **Rashid**: Omani sailor and navigator — warm, quick-witted, carries the weight of a family four thousand miles away; humor is his manner, not his function (Docked dhow)

## Atmosphere & Mood

**Core Keywords**: Humid. Golden. Crowded. Exotic. Colonial. Tense. Beautiful.

Every system, feature, and asset should enhance immersion. Environmental detail, ambient sound, and lighting are crucial. The day/night cycle should feel meaningful. Prioritize atmosphere over mechanical complexity.

## Development Priorities

1. **Immersion Over Features**: A small, deeply atmospheric world beats a large, shallow one
2. **Test Assets In-Engine Early**: Don't perfect sprites in isolation; iterate in context
3. **Placeholder → Iterate**: Get working placeholders first, then refine toward final quality

## Important Context

This project was initialized with a comprehensive design briefing. **See `docs/PROJECT_BRIEFING.md` for the complete vision, historical context, art direction, audio direction, gameplay systems, and milestone breakdown.**

When making design decisions, prioritize:

- Historical authenticity balanced with gameplay
- Cultural respect and nuanced portrayal
- Ultima VII-style interaction depth
- Warm, tropical pixel-art aesthetic
- Renaissance-Gamelan fusion audio identity

## Quick References

- **Full Briefing**: `docs/PROJECT_BRIEFING.md` - Complete vision and specifications
- **Current Status**: `PROJECT_STATUS.md` - What's working and next steps
- **Getting Started**: `QUICK_START.md` - How to run and develop
- **Setup Guide**: `docs/PROJECT_SETUP.md` - Technical setup documentation
