# Project Status: A Famosa - Streets of Golden Melaka

## Current Status

**Date**: March 20, 2026
**Status**: Art Elevation Pass Complete (Ultima 8 Quality Target)
**Code Health**: 9/10 (Modern architecture, TypeScript, comprehensive documentation)

---

## Art Elevation Pass (March 20, 2026)

### Overview
A comprehensive art quality upgrade across the entire procedural graphics pipeline, targeting Ultima 8-level sprite fidelity. Every sprite category was enhanced: characters, tiles, objects, and a new environment decoration system was added.

### Key Metrics
| Category | Before | After | New |
|----------|--------|-------|-----|
| Tile sprites | 27 | 48 | +21 (12 variants, 8 transitions, 1 water frame) |
| Object sprites | 46 | 61 | +15 new culturally-authentic objects |
| Character sprites | 10 | 11 | +1 Indian crowd sprite |
| Crowd sprites | 4 | 5 | +1 (Indian merchant) |
| Palette entries | 22 | 26 | +4 (indigo, turmeric, lacquer red, Indian skin) |
| Lore objects | ~15 | ~20 | +5 historical examine objects |
| Environment clusters | 0 | 17 | New decoration system across all 5 locations |

### Technical Changes
- **Dithered shading pipeline**: All character sprites use Bayer matrix dithering for smooth gradients (was: hard shade steps)
- **Ambient occlusion system**: All objects use graded elliptical base shadows (was: flat shadow lines)
- **Tile variant system**: Post-processing weathering wrapper for any tile (stain, moss, battle damage)
- **Environment Object System**: New `EnvironmentObjectSystem.ts` with depth-sorted decorative objects, particle emitters, and animated effects
- **Isometric perspective correction**: Brightness modulation on iso tile generation for 3/4 view lighting

### Historical Accuracy Fixes
- Chen Wei's costume corrected from Qing dynasty (post-1644) to Ming dynasty (correct for 1580 Melaka)
- Indian merchants now have distinct crowd sprite instead of reusing Arab sprite
- Added pelourinho, pepper pile, wayang kulit puppet, surau prayer niche, and carrack rigging as examinable lore objects

### Files Modified (11 files, 2 new)
| File | Changes |
|------|---------|
| `tools/ultima8-graphics/palette.cjs` | 4 new palette entries |
| `tools/ultima8-graphics/characters.cjs` | Dithered shading, shadow outline, ground shadow, specular, hair/facial detail, Chen Wei fix, Indian crowd sprite |
| `tools/ultima8-graphics/tiles.cjs` | Variant system, 12 variants, 8 transitions, water enhancement |
| `tools/ultima8-graphics/objects.cjs` | AO system, detail density, 15 new sprites |
| `tools/generate-character-sheets-v2.cjs` | Post-processing integration, profile improvements |
| `tools/generate-iso-tiles.cjs` | Perspective correction |
| `tools/ultima8-graphics/generate-all.cjs` | Registers all new assets |
| `src/phaser/systems/CrowdSystem.ts` | Indian merchant sprite mapping |
| `src/phaser/scenes/BootScene.ts` | Indian crowd sprite loading |
| `src/phaser/scenes/GameScene.ts` | EnvironmentObjectSystem integration |
| `src/data/historical-objects.json` | 5 new lore objects |
| `src/data/environment-objects.json` | **NEW** — decoration clusters for 5 locations |
| `src/phaser/systems/EnvironmentObjectSystem.ts` | **NEW** — decorative object renderer |

---

## Character Scaling Fix (January 27, 2026)

### Problem
Characters appeared extremely small relative to the hand-painted scene backgrounds. The player and NPCs were barely visible against the large architectural elements.

### Root Cause Analysis
The game had a resolution mismatch:
- **Original spec** (CLAUDE.md): 320×180 native resolution, integer scaled
- **Current implementation**: 960×540 direct rendering (3× the spec)
- **Character sprites**: 16×32 pixels (designed for 320×180)
- **Scene backgrounds**: Large painted images at 960×540 scale

This meant characters were displayed at 1/3 their intended visual size relative to the environment.

### Solution
Rather than changing the base resolution (which would require regenerating all scene backgrounds), we scaled character sprites to match the 960×540 environment:

**Files Modified:**
1. `src/phaser/game.ts`
   - Added `CHARACTER_SCALE = 3` constant
   - Increased `PLAYER_SPEED` from 100 to 180 (feels more natural with larger characters)

2. `src/phaser/scenes/GameScene.ts`
   - Player sprite scaled 3× with `setScale(CHARACTER_SCALE)`
   - Physics body sized/offset adjusted to match scaled sprite
   - NPC sprites scaled 3× to match player
   - Interaction radius increased from 48 to 100 pixels
   - NPC indicator positions adjusted for scaled characters

3. `src/data/location-scenes.json`
   - Adjusted player spawn positions to prevent clipping into floor collisions
   - Adjusted NPC positions for better spacing with larger characters

### Technical Details
```typescript
// Character scaling (in game.ts)
export const CHARACTER_SCALE = 3;

// Applied in GameScene.ts
this.player.setScale(CHARACTER_SCALE);
this.player.body.setSize(12 * CHARACTER_SCALE, 16 * CHARACTER_SCALE);
this.player.body.setOffset(2 * CHARACTER_SCALE, 16 * CHARACTER_SCALE);
```

### Result
- Characters now appear at 48×96 pixels visually (appropriate for 960×540)
- Proper proportion relative to buildings and scene elements
- Collision detection works correctly with scaled sprites
- Movement speed feels natural for character size

---

## Major Architecture Update (January 27, 2026)

### React + Phaser Hybrid Migration

**Completed migration from pure Phaser to React + Phaser hybrid architecture:**

- **Vite Build System**: Replaced webpack with Vite for faster development and builds
- **TypeScript**: Full TypeScript support for type safety
- **React UI Layer**: All UI components migrated to React
- **Zustand State Management**: Centralized state with React stores
- **Tailwind CSS**: Modern utility-first styling

### New File Structure

```
src/
├── App.tsx                    # Main React app shell
├── main.tsx                   # React entry point
├── vite-env.d.ts              # TypeScript declarations
├── styles/
│   └── index.css              # Tailwind CSS
├── components/
│   ├── GameCanvas.tsx         # Phaser game embed
│   ├── ui/
│   │   ├── DialogueBox.tsx    # NPC conversation
│   │   ├── InventoryPanel.tsx # Item grid
│   │   ├── JournalPanel.tsx   # Quest log
│   │   ├── PauseMenu.tsx      # Settings, save/load
│   │   └── HUD.tsx            # Time, location
│   └── screens/
│       ├── TitleScreen.tsx
│       ├── LoadingScreen.tsx
│       └── CreditsScreen.tsx
├── stores/
│   ├── gameStore.ts           # Core game state
│   ├── dialogueStore.ts       # NPC dialogue
│   ├── questStore.ts          # Quest tracking
│   ├── inventoryStore.ts      # Items & money
│   └── saveStore.ts           # Save/load system
├── phaser/
│   ├── game.ts                # Phaser config
│   ├── eventBridge.ts         # React-Phaser communication
│   └── scenes/
│       ├── BootScene.ts       # Asset loading
│       └── GameScene.ts       # Main gameplay
└── data/                      # Existing JSON (unchanged)
```

### Technology Stack Update

| Component | Old | New |
|-----------|-----|-----|
| Build | Webpack | Vite |
| Language | JavaScript | TypeScript |
| UI | Phaser DOM | React |
| State | Scene Events | Zustand |
| Styling | Inline | Tailwind CSS |

### Production Build

```bash
npm run dev     # Vite dev server (port 3000)
npm run build   # TypeScript + Vite production build
npm run preview # Preview production build
```

**Build Output**:
- `dist/assets/phaser-*.js`: ~340KB gzipped (game engine)
- `dist/assets/react-*.js`: ~43KB gzipped (React)
- `dist/assets/main-*.js`: ~14KB gzipped (game code)
- `dist/assets/vendor-*.js`: ~4KB gzipped (utilities)
- `dist/assets/main-*.css`: ~5KB gzipped (styles)

---

## What's Implemented

### New Architecture (January 2026)

- [x] Vite build system with hot reload
- [x] Full TypeScript migration
- [x] React component architecture
- [x] Zustand state management
- [x] Tailwind CSS styling
- [x] Event bridge for Phaser-React communication
- [x] Save/load system with 4 slots (1 autosave + 3 manual)
- [x] Settings menu with volume controls
- [x] Credits screen

### Core Systems

- [x] Phaser 3 engine with 960×540 resolution
- [x] Character scaling system (3× for proper proportions)
- [x] Integer scaling for pixel-perfect display
- [x] Production build working (~400KB gzipped total)

### Player & Movement

- [x] 8-directional movement with normalized diagonals
- [x] Animated walk cycles (4 directions, 4 frames each)
- [x] Idle animations
- [x] Physics-based collision

### NPCs & Dialogue

- [x] 6 demo NPCs with comprehensive dialogue (15+ topics each)
- [x] Time-based schedules
- [x] Topic-based conversation system with unlockable topics
- [x] Interaction indicators
- [x] Dialogue typing effect (React component)

### Inventory System

- [x] Item pickup from world
- [x] React-based grid inventory UI (Press I)
- [x] Item examination and descriptions
- [x] Money/currency tracking
- [x] Quest item support

### Quest System

- [x] 3 fully scripted quests with branching paths
- [x] Multi-stage quest progression
- [x] Objective tracking
- [x] React journal UI (Press J)
- [x] Quest dialogue modifications
- [x] 12 total resolution paths

### Time & Atmosphere

- [x] Day/night cycle with 4 lighting states
- [x] Atmospheric particle effects
- [x] Time display in HUD
- [x] Time controls for testing (T/Y keys)

### Art Pipeline (March 2026)

- [x] Dithered shading on all character sprites
- [x] Shadow outlines and ground shadow ellipses
- [x] Specular highlights on metal, gold, and silk
- [x] Hair texture noise and facial detail pixels
- [x] 12 tile variants with weathering post-processor
- [x] 8 edge transition tiles between surfaces
- [x] 4-frame water animation with caustic light
- [x] Isometric perspective correction on tiles
- [x] Ambient occlusion on all object sprites
- [x] 15 new culturally-authentic object sprites
- [x] Environment Object System (17 decoration clusters)
- [x] Animated objects (torches, seagulls, flags, palms)
- [x] Chen Wei Ming dynasty costume correction
- [x] Indian merchant crowd sprite
- [x] 5 new historical lore objects
- [x] 4 new palette entries for textiles and skin tones

### Audio System

- [x] Music system with location-based tracks
- [x] Ambient sound layer system
- [x] Time-of-day audio variations
- [x] Volume controls in pause menu
- [x] 7 music track placeholders
- [x] 24 ambient + effect placeholders

### Save/Load System (NEW)

- [x] 4 save slots (1 autosave + 3 manual)
- [x] Serializes player, time, inventory, quests, dialogue
- [x] localStorage (web) and Electron userData (desktop)
- [x] Slot metadata (location, playtime, timestamp)
- [x] Auto-save on location change

---

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move |
| Space | Interact with NPCs/Objects |
| I | Open/Close Inventory |
| J | Open/Close Journal |
| ESC | Pause Menu |
| E | Examine (in inventory) |
| F6-F10 | Quick travel to locations |
| T | Advance time (debug) |
| Y | Toggle time speed (debug) |

---

## How to Run

### Development
```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Production Build
```bash
npm run build
npm run preview
# Or: npm run electron (desktop app)
```

### Desktop Distribution
```bash
npm run package:mac    # macOS DMG
npm run package:win    # Windows installer
npm run package:linux  # Linux AppImage
```

---

## Next Steps

### Audio (Critical - Phase 3)
Replace placeholder audio files with actual recordings:
- Music: Chiptune/lo-fi Renaissance-Gamelan fusion (see AUDIO_DIRECTION.md)
- Ambient: Tropical atmosphere, location-specific sounds
- SFX: UI clicks, dialogue blips, footsteps

**Audio Generation Strategy:**
- AI generation with Suno/Udio for music tracks
- Freesound.org (CC0) for ambient sounds
- BFXR/SFXR for retro-style SFX

### Testing
- [ ] Complete playthrough: all 3 quests, all 12 resolution paths
- [ ] Save/load preserves all state correctly
- [ ] Electron builds work on macOS, Windows, Linux
- [ ] Audio crossfades between locations

### Polish
- [x] Credits screen
- [x] Loading transitions
- [ ] App icons (macOS .icns, Windows .ico)
- [ ] Historical facts on loading screens

---

## Technical Specifications

| Spec | Value |
|------|-------|
| Resolution | 960×540 (game canvas) |
| Character Scale | 3× (sprites designed for 320×180) |
| Tile Size | 16×16 pixels (native) |
| Character Size | 16×32 pixels (native), 48×96 displayed |
| Map Size | 40×30 tiles |
| Frame Rate | 60 FPS |
| Build Size | ~400KB gzipped |
| Load Time | <3s target |

---

## Dependencies

```json
{
  "dependencies": {
    "phaser": "^3.70.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0",
    "framer-motion": "^10.16.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "electron": "^28.3.3",
    "electron-builder": "^24.13.3"
  }
}
```

---

*Last Updated: March 20, 2026*
*Phase: Art Elevation Pass Complete (Ultima 8 Quality)*
*Code Lines: ~6,000+ (new architecture + art pipeline + environment system)*
