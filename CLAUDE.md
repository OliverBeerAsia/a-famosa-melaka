# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**A Famosa: Streets of Golden Melaka** is a small, atmospheric adventure RPG inspired by Ultima VII, set in Portuguese Melaka circa 1580. The game features pixel-art graphics (320×180 base resolution), ¾ top-down isometric perspective, and focuses on exploration, NPC interaction, and story-driven quests in a historically-inspired setting.

## Project Structure

```
melaka-rpg/
├── assets/
│   ├── sprites/       # Character, tile, object, and UI sprites
│   ├── audio/         # Music tracks and sound effects
│   └── maps/          # Tiled map files (JSON export)
├── src/
│   ├── scenes/        # Game scenes (menu, gameplay, etc.)
│   ├── entities/      # Player, NPCs, interactive objects
│   ├── systems/       # Core systems (dialogue, inventory, time)
│   ├── ui/            # UI components and HUD
│   └── data/          # JSON data files (NPCs, quests, items)
└── docs/              # Design docs, lore, art bible
```

## Technology Stack

- **Engine**: Phaser 3 with React UI layer (TypeScript)
- **Build System**: Vite with hot reload
- **State Management**: Zustand stores
- **Styling**: Tailwind CSS
- **Tilemap Editor**: Tiled (export to JSON)
- **Art Tools**: Aseprite for sprites and tiles
- **Audio Tools**: Audacity (SFX), LMMS/FamiStudio (chiptune music)

## Resolution & Scaling Architecture

**IMPORTANT**: The game uses a hybrid resolution approach:

| Layer | Resolution | Notes |
|-------|------------|-------|
| Game Canvas | 960×540 | Phaser renders at this size |
| Scene Backgrounds | ~960×540 | Hand-painted scene images |
| Character Sprites | 16×32 native | Scaled 3× at runtime to 48×96 |
| Tile Sprites | 16×16 native | Used in tilemap mode only |

### Why This Matters
- **Original spec** was 320×180 native with integer scaling
- **Current implementation** uses 960×540 canvas with 3× scaled characters
- **Scene backgrounds** are large painted images, not tilemaps
- **CHARACTER_SCALE constant** in `src/phaser/game.ts` controls sprite scaling

### When Adding New Sprites
New character/NPC sprites should be:
- Created at 16×32 pixels (standard character size)
- They will be automatically scaled 3× by the game engine
- Physics bodies are sized proportionally via `CHARACTER_SCALE`

### Key Files
- `src/phaser/game.ts` - Contains `CHARACTER_SCALE = 3` constant
- `src/phaser/scenes/GameScene.ts` - Applies scaling to player/NPCs
- `src/data/location-scenes.json` - Spawn positions (in 960×540 coordinates)

## Core Architecture

### Game Systems

1. **Exploration System**: Free movement through interconnected screens with collision detection
2. **Interaction System**: Click-to-interact with objects, NPCs, and environment
3. **Dialogue System**: Keyword-based or branching dialogue trees
4. **Inventory System**: Pick up, combine, examine, and use items
5. **Time System**: Day/night cycle affecting NPC schedules and availability
6. **Journal System**: Auto-logs quests, rumors, and important discoveries

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
- **Animation**: Subtle environmental animation (palm fronds, water, torches, cloth)

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
- **Rashid**: Arab sailor, comic relief (Docked dhow)

## Atmosphere & Mood

**Core Keywords**: Humid. Golden. Crowded. Exotic. Colonial. Tense. Beautiful.

Every system, feature, and asset should enhance immersion. Environmental detail, ambient sound, and lighting are crucial. The day/night cycle should feel meaningful. Prioritize atmosphere over mechanical complexity.

## Development Priorities

1. **Immersion Over Features**: A small, deeply atmospheric world beats a large, shallow one
2. **Test Assets In-Engine Early**: Don't perfect sprites in isolation; iterate in context
3. **Sound Is Half the Experience**: Audio implementation is not an afterthought
4. **Modular and Readable Code**: Clear naming, generous comments, separated systems
5. **Placeholder → Iterate**: Get working placeholders first, then refine toward final quality

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
