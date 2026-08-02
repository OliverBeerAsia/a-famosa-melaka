# Changelog

All notable changes to A Famosa: Streets of Golden Melaka.

## [0.12.0] - 2026-08-02

### The Living City

Full details in `docs/RELEASE_NOTES_v0.12.0.md`.

### Added
- **Living world**: hour-by-hour schedules for all 14 NPCs (they walk, work, and go home through real doors with quarter-correct sounds); 15 ambient residents with barks; A* pathfinding over walkmasks; the counting-house night watch (timed patrol, light-based detection, lantern dousing, fail-forward consequences); 14 persistent openables; measured crowd-pacing rebuild (0.3–1.1 → 5–16 on screen at midday).
- **Game feel**: MelakaPostFX pipeline (replaces 15 blend rects + 9 perpetual tweens), grade-LUT strips with an anti-double-grade CI gate, animation phase desync (benchmark item 9: 100% lockstep → 0%), 21-event feedback table + 12 new SFX behind a key-existence gate, practical lantern flicker, dust/cloth/creak surface responses, animated dusk-bronze water, fauna tier 1.
- **Engine**: GameScene decomposed 4,060 → 728 lines over 14 systems + 9 pure tested core modules (+279 tests, 406 total); quest hotspots moved to data and re-anchored from open water to the counting-house door; world items truly grounded (alpha-scan + contact shadows); typography standard applied to all Phaser text.
- **Art**: Forge title panorama (dusk harbour) on title/loading; graveyard seam, wheel-track cart traffic, tiled-course roofs (tartan killed), 2px ropes, compositor contact-definition pass (+contrast on all five plates), 27 item icons redrawn at true native, portrait polish (real morion, Aminah's tudung, fold clusters), prop clarity/scale pass with a calibrated prop-ruler gate in CI.
- **Typography**: two pixel-native faces on measured integer grids everywhere; fonts self-hosted (23KB) so offline builds can't regress; `font-display: block`.
- **History**: 1580 audit applied — Igreja Madre de Deus naming, the 1568–1575 sieges, the Iberian interregnum, monsoon/port corrections, Kapitan China and diocesan institutions, slavery addressed through Siti's legal status, Mak Enang's counter-narrative to the conquest myth.

### Fixed
- Teardown crashes breaking location transitions (two classes); floating world items; animated props drawing into the FX band; theft hotspots in open water; synchronized animation lockstep; the fuzzy system-font HUD clock; A Famosa silently shipping a stale plate under green validators (new plate/key gate); ruler-edged ground insets on three plates; 1px pike-haft "scratch" lines.

## [0.11.0] - 2026-08-01

### The Forge Overhaul

The largest release in the project's history — full details in `docs/RELEASE_NOTES_v0.11.0.md`.

### Added
- **Scrolling world**: all 5 locations are 640×360-native / 1920×1080-world Forge plates with `CameraSystem` (deadzone + lookahead + shake), walkmask-authoritative collision, surface-type footsteps, and relit walk-behind overlays.
- **Melaka Forge pipeline** (`tools/forge/`): layout JSON → plate + walkmask + overlays + engine data in one deterministic pass; 50-colour hue-shifted palette canon; per-index LUT relighting with baked light pools (night finally reads as night); kits for Portuguese/dock/Malay/fortress/church architecture + nature; strict CI gates (canon membership, byte-determinism, zero AA, bounds/walkability).
- **Portrait system rebuild**: 15 unique seeded faces at 240×240 (3× native), pairwise silhouette overlap ≤0.82; Rudra Mudaliar gets his own face.
- **Real audio**: 7 composed 60–90s Renaissance-Gamelan loops, 16 ambient beds, 13 SFX — pure-Node offline synthesis, loop-seam and browser-decode verified; fixed the Vite-HTML-as-ogg decode trap.
- **UI chrome kit**: parchment/hardwood/brass 9-slice system at native ×3; dialogue with 240px portraits; title/loading/credits reskinned; zero 1px hairlines.
- **Economy + content depth**: pay-the-debt path genuinely raisable (525 cruzados via in-voice contracts and a letter of credit, farm-proof, simulation-tested); day-4 silk deadline; 4 thin NPCs raised to voice; Rashid dignity pass; 198 painted-prop examine hotspots + 27 authored prop texts; quest-reactive greetings on all principals.
- 20-item measurable per-screen benchmark spec (researched from Ultima VII/VIII, Commandos, BG, Fallout 2) as the standing acceptance gate; vitest harness (127 tests).

### Fixed
- Journal never rendered quest narration; dialogue topics beyond 9 unreachable; Rudra mute with wrong portrait; impossible pay path; 18 lore objects silently dropped; crowd walking below the visible screen; ~40% of night lights off-canvas; double-graded time-of-day; baked checkerboard skies; Lisbon-painting title screens; scene-transition cleanup crash; NPC recreate tint bug; worldDepth clamp; oversized player physics body; audio tween race; texture-key/file-stem plate skew.

### Removed
- Dead parallel JS codebase, webpack path, Gemini/OpenAI generator tools, whole-scene Canva generation, multiply-tint ToD generator, one-template portrait generator, Lisbon source scans.

## [0.10.0] - 2026-06-07

### Graphics Cohesion and Walkable Plates

A full visual overhaul: every location now renders as a cohesive pixel-art painted **plate** (legacy-backdrop) with the player, NPCs, and interactive props composited on top as Y-sorted sprites (Ultima VII-style overlap). Backgrounds are pixelated to the sprite grid so the world reads as one chunky pixel-art style instead of a smooth render under chunky sprites. Production is Claude-managed with **no external image-generation API keys** (procedural engine for the gameplay kit + Canva MCP for plates).

### Added
- `tools/post-process-scene.cjs` — scene quantizer: palette-quantize + ordered Bayer dithering + `--pixelate N` (render at W/N×H/N native, nearest-upscale). 0% off-palette, no anti-aliasing.
- `tools/rederive-scenes.cjs` + `npm run scenes:rederive` — reproducibly regenerate every plate from its master export per `tools/canva-sources/MANIFEST.json`.
- `tools/canva-sources/` — master Canva exports + provenance manifest for all 5 plates (re-derivable).
- `legacyProps` array per location in `src/data/environment-objects.json` — curated, pixel-positioned interactive prop sprites.
- Tropical sky-blue ramp in `tools/ultima8-graphics/palette.cjs`.
- Unified `worldDepth(y)` Y-sort helper across `GameScene.ts` and `EnvironmentObjectSystem.ts`.
- `docs/RELEASE_NOTES_v0.10.0.md`.

### Changed
- All 5 locations switched to `runtimeMode: "legacy-backdrop"`; the painted plate (not the iso tilemap) is the shipping gameplay world. The `IsometricRenderer` is retained but dormant.
- All 5 scene plates + title/loading regenerated as empty 2:1 isometric pixel-art plates (native 320×180), props/people are sprites not baked into the art.
- Procedural portrait engine rewritten (hard value bands, vignette background instead of hatch, NW key light); character sheets contrast-quantized to read at 3×; carved-chrome UI sprites regenerated.
- Legacy `playerStart`/`npcPositions` are now pixel coordinates; perimeter + water-edge `collisionRects`; on-screen transition `triggerArea`/`spawnAt`.
- Environment props scaled ~2× (was 3×) and bounded to the plate; lore objects bounded + downscaled; world-item/lore markers reduced to subtle pips.
- Engine overlays (vignette, ambient occlusion, film grain, color grade) lightened for the pre-lit plates.
- All 97 tile PNGs quantized to the palette canon.
- Version metadata moved to `0.10.0`.

### Fixed
- Player and NPCs were spawning inside the corner wall (iso tile coords read as pixels in legacy mode) — now placed in the open walkable area.
- Missing-prop placeholder (`debug-prop-missing`) is now invisible instead of a yellow-X box over the scene.
- Removed off-plate/oversized iso-cluster props that floated outside the 960×540 plate.

### Verification
- `npm run build` (tsc + vite + asset validation)
- `npm run validate:all`
- In-engine (Playwright) walkthrough of all 5 locations + dialogue

## [0.9.0] - 2026-05-02

### Historical Architecture and Period-Art Pass

This release responds to the latest visual QA pass: menu/loading art now uses documented period Portuguese cityscape sources, crowd sprites have enough pixel depth to read as people instead of markers, wall art no longer blocks normal walking tiles, and map buildings render as raised connected structures instead of flat tiles or concrete boxes.

### Added
- `docs/art-bible/source-art/` with source images, rights notes, URLs, and retired-context references for menu/loading art
- `tools/create-sourced-screen-art.cjs` to rebuild the title/loading derivatives from documented source art
- `assets/scenes/scene-loading-ribeira.png` as the new loading backdrop
- Component-based raised-building rendering for Portuguese houses, church stone, fort laterite, doors, terracotta roofs, and kampung thatch
- Regression checks for connected building components, sourced backdrops, crowd dimensions, and visual-wall collision behavior
- New release document:
  - `docs/RELEASE_NOTES_v0.9.0.md`

### Changed
- Title and loading screens now use 18th-century Portuguese cityscape/landscape source art instead of generic or map-like placeholders
- Crowd role sprites are now `16x32` with more detailed Portuguese, Malay, Chinese, Arab, Indian, priest, worker, guard, woman, and child variants
- Runtime manifest, asset spec, generator docs, and validators now treat `16x32` as the shipping crowd contract
- Raised building tiles are drawn as connected architectural masses with exposed faces, roof caps, doors, shutters, stone/laterite texture, and thatch/terracotta material cues
- Crowd shadows were resized to match the deeper character silhouettes
- Version metadata moved to `0.9.0`

### Fixed
- Removed the invisible row-run collision footprints that could lock the player on ordinary walkable tiles
- The Phaser/React event bridge now clears the destroyed game instance without wiping subscribers for the next runtime
- Dialogue startup now opens the store-backed dialogue state when the Phaser scene begins an NPC conversation

### Verification
- `npm test -- --runInBand`
- `npm run build`
- `npm run validate:art -- --strict`

## [0.8.0] - 2026-03-21

### Ultima VIII Style Enforcement and Art Grading

This release made Ultima VIII: Pagan the enforced visual authority for shipping art, added automated style validation, and introduced the corrective-wave grading workflow used by later art passes.

### Added
- Automated style validation through `validate:style`
- Combined structural and style validation through `validate:all`
- Corrective-wave grading and status commands
- Shared pixel-analysis tooling for palette, antialiasing, gradient, and shadow checks
- Procedural VGA portrait generation for the named dialogue cast
- OpenAI scene-backdrop generation support for future replacement passes

### Changed
- `pretest` and `prebuild` now run art validation before tests and builds
- Generation prompts were centralized around a single style header
- Shipping asset style-map coverage was expanded across characters, portraits, tiles, objects, crowd sprites, and scene backdrops
- Project status and art-bible docs were updated around the enforced Ultima VIII bar

### Verification
- `npm test -- --runInBand`
- `npm run build`
- `npm run validate:style`

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
