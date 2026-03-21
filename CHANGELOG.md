# Changelog

All notable changes to A Famosa: Streets of Golden Melaka.

## [0.7.0] - 2026-03-21

### Customs Spine and Implicit Faction Pass

This release turns the customs/corruption design plan into the first real reactive RPG layer in the live game. The world is still the same five-location city slice, but `Rua Direita`, `Waterfront`, `A Famosa Gate`, and `Kampung` now participate in an interlocked quest spine with stateful routing, witness chains, and implicit factional consequence.

### Added
- `src/data/quests/customs-ledger.json` with four authored resolutions
- Four new named customs-spine NPCs:
  - `gaspar-mesquita`
  - `diogo-almeida`
  - `lin-mei`
  - `pak-salleh`
- Six-faction runtime model:
  - `garrison`
  - `church`
  - `portuguese-merchants`
  - `chinese-merchants`
  - `kampung-community`
  - `dockside-network`
- `City Currents` presentation in the journal/HUD for qualitative faction state
- Stateful `A Famosa Gate <-> Waterfront` service route with lock-state messaging
- Runtime asset coverage for the four new NPC sheets and portraits
- New regression coverage for customs-ledger paths, service-route locking, and live witness dialogue payloads
- New release document:
  - `docs/RELEASE_NOTES_v0.7.0.md`

### Changed
- `The Merchant's Seal`, `Rashid's Cargo`, and `Pirates on the Horizon` now share customs/cove/world-state consequences
- Dialogue/topic availability now supports location, world flags, completed path outcomes, and reputation bands
- Save/load now migrates the legacy four-faction model into the six-faction runtime model
- `HUD.tsx` and `JournalPanel.tsx` now surface narrative currents instead of explicit numerical faction readouts
- `location-scenes.json` now treats the bonded service gate as an authored access route rather than a permanent connector
- Customs-era map dressing, world-item affordances, and historical object coverage were expanded across `A Famosa Gate`, `Rua Direita`, and `Waterfront`
- Version metadata moved to `0.7.0`

### Verification
- `npm test -- --runInBand`
- `npm run build`
- `npm run validate:art -- --strict`

## [0.6.0] - 2026-03-21

### World Polish and Presentation Pass

This release pushes the live game beyond the original `Rua Direita` hero slice and turns the current build into a much more coherent playable showcase. The major wins are richer world parity, complete item-art coverage, cleaner onboarding, and stronger documentation around the real shipping bar.

### Added
- Richer live layer stacks for `A Famosa Gate` and `St. Paul's Church` with `Props`, `Overhang`, `Canopy`, and `Highlights`
- Additional environment clusters and historical objects for those locations so their routes extend with clearer visual intent
- Complete `assets/sprites/ui/items/` coverage for every player-facing inventory item
- Loading of item icon textures into Phaser so world pickups can use item-backed art where available
- Contextual onboarding flags in `gameStore.ts` for dialogue, inventory, and journal discovery
- New release documentation:
  - `docs/RELEASE_NOTES_v0.6.0.md`
  - `docs/LESSONS_LEARNED.md`
  - `docs/TODO.md`

### Changed
- `GameScene.ts` now resolves world-item presentation dynamically from actual item icons before falling back to generic world sprites
- Interaction prompts now better distinguish talking, taking items, reading lore, and traveling
- The HUD now stays quieter before the player has actually entered the first quest loop
- Arrival and travel loading screens are now staged differently
- Previously untagged presentation and cinematic-atmosphere improvements are now rolled into the shipping release instead of lingering only as loose release notes
- Project docs were rewritten to match the live TypeScript/Phaser runtime and the current Ultima VIII-first target bar
- Version metadata moved to `0.6.0`

### Verification
- `npm test -- --runInBand`
- `npm run build`
- `npm run validate:art -- --strict`

## [0.5.0] - 2026-03-20

### Gameplay Art Runtime Contract

This release standardizes the live gameplay-art pipeline around one shipping contract for the TypeScript Phaser runtime and removes the legacy mismatch between generated assets, runtime loading, and documentation.

### Added
- `src/data/runtime-asset-manifest.json` as the shipping gameplay asset source of truth for named characters, crowd sprites, maps, tiles, and prop sheets
- Dedicated `8×16` crowd role silhouettes for Portuguese guard/worker/priest and Malay woman/child variants
- Manifest-aware art validation for palette compliance, runtime reachability, map object parity, and forbidden legacy gameplay sprites

### Changed
- Named gameplay characters now ship only as `64×192` sheets with `4×6` rows for walk, idle, and talk states
- `BootScene.ts` now loads gameplay assets from the runtime manifest instead of relying on legacy standalone named sprites
- `IsometricRenderer.ts` now renders authored Tiled object layers in the live runtime scene
- `GameScene.ts` now uses physical prop sprites for world items and lore objects, with markers as overlays instead of the only world representation
- `CrowdSystem.ts` now maps runtime crowd roles to differentiated sprite silhouettes instead of broader placeholder reuse
- `generate-character-sheets-v2.cjs` now emits the new named-character sheet contract, and `generate-crowd-silhouettes.cjs` generates the supported crowd set
- Gameplay sprite assets were re-quantized to the indexed ramp canon enforced by the validator

### Removed
- Standalone named gameplay character PNGs from `assets/sprites/characters/`
- The legacy generic gameplay fallback sprite `assets/sprites/characters/npc.png`
- The deprecated `crowd-indian-sheet.png` gameplay asset

### Documentation
- Updated the README, quick start, testing guide, project status, and art pipeline docs to describe the sheet-only, manifest-driven gameplay runtime

### Verification
- `npm run validate:art -- --strict`
- `npm run build`

## [0.4.0] - 2026-03-20

### Art Elevation Pass: Ultima 8 Quality

A focused art elevation pass across the entire procedural graphics pipeline, touching every sprite category with higher fidelity rendering and historically accurate content.

#### Phase 1: Character Sprite Enhancement
- **Dithered shading** on all 10 characters — smooth palette gradients replacing hard shade steps via `setDitheredPixel()` using Bayer matrix dithering
- **Shadow outlines** (right/bottom edge) and **ground shadow ellipses** on every character for depth and ground contact
- **Specular highlights** on metal (Capitao's armor), gold (buttons, buckles, chains), and silk (Chen Wei, Aminah garments)
- **Hair texture** with seeded noise for strand detail, plus highlight streaks for volume
- **Facial details**: Fernao's crow's feet, Capitao's diagonal scar, Mak Enang's forehead wrinkles, Alvares' sneer lines
- **Headscarf fringe** on Aminah, Siti, and Mak Enang with alternating dark/light edge pixels
- **Improved profile views**: 72% head compression (up from 65%), ear bump, 2px nose protrusion with bridge shading, jawline shadow

#### Phase 2: Tile Enrichment
- **Tile variant system** with `drawWithVariant()` weathering post-processor (stain/crack darkening, moss tinting)
- **12 new tile variants** (2 each for grass, fortress-stone, whitewash-wall, dirt-path, dock-wood, church-floor)
- **8 new edge transition tiles** (grass-to-sand, dirt-to-grass, cobblestone-to-water, fortress-to-cobblestone, H+V each)
- **Enhanced water animation**: caustic light patterns with `specular[2]` pixels, depth gradient, expanded to 4-frame cycle
- **Isometric perspective correction**: top-half brightened 5%, bottom-half darkened 8% for 3/4 view lighting

#### Phase 3: Object Detail Pass
- **Ambient occlusion system** (`addAmbientOcclusion()`) replacing flat shadows on all objects with graded elliptical shadows
- **Detail density increase**: wood grain lines, stone pitting (~5%), metal rivet dots on existing sprites
- **15 new object sprites**: fruit basket, coconut water stand, bench, wine jug, sugar cone, handcart, pelourinho, candelabra, iron fence, scroll rack, fish basket, herb drying rack, rice pot, wayang kulit puppet, spice pile pepper

#### Phase 4: Historical Accuracy Corrections
- **Chen Wei costume fix**: Replaced Qing-era queue/changshan with Ming-era sifangjin cap, topknot, and cross-collar zhiduo (historically correct for 1580)
- **4 new palette entries**: indigo (batik/Indian textiles), turmeric yellow (ceremonial), lacquer red (Chinese temple), Indian skin tones (Tamil/Dravidian)
- **Indian merchant crowd sprite** (`drawCrowdIndian`): Dravidian skin, jama coat, pagri turban, dhoti — replacing the incorrect Arab sprite reuse
- **5 new lore objects**: pelourinho (Portuguese pillory), black pepper pile, wayang kulit puppet, surau prayer niche, carrack rigging detail

#### Phase 5: Environment Object Placement System
- **`environment-objects.json`**: Decorative object cluster definitions for all 5 locations (17 clusters total)
- **`EnvironmentObjectSystem.ts`**: New system that renders decorative objects with depth sorting, interactive examine hotspots, and particle emitters (smoke, steam, dust)
- **Animated objects**: Torch flicker, seagull flight loops, flag wave, palm frond sway, awning flutter, smoke columns
- **Quality-tier aware**: Low quality skips decorative objects entirely for performance
- **GameScene integration**: Full lifecycle management (create, update, time-of-day, cleanup)

### Changed
- `generate-all.cjs` now generates 48 tiles (+21 new), 61 objects (+15 new), 12 characters (+3), 5 crowd sprites (+1)
- All existing character sprite sheets regenerated with enhanced dithering and shadow effects
- `BootScene.ts` now loads Indian crowd sprite alongside existing crowd types

---

## [0.2.0] - 2026-01-27

### Added
- React + Phaser hybrid architecture
- Vite build system replacing Webpack
- Full TypeScript migration
- Zustand state management
- Tailwind CSS styling
- Save/load system with 4 slots
- Credits screen
- Settings menu with volume controls

### Changed
- UI migrated from Phaser DOM to React components
- Event bridge for Phaser-React communication

---

## [0.1.0] - 2026-01-26

### Added
- Initial Phaser 3 implementation
- 5 location scenes with hand-painted backgrounds
- 6 NPCs with comprehensive dialogue systems
- 3 fully scripted quests with branching paths
- Day/night cycle with atmospheric effects
- Inventory and journal systems
- Time-based NPC schedules
