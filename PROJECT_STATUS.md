# Project Status: A Famosa - Streets of Golden Melaka

## Current Status

- Date: June 7, 2026
- Release: `v0.10.0`
- Status: graphics cohesion and walkable-plate pass ready for release
- Overall read: all five locations now ship as cohesive painted pixel-art plates with Y-sorted sprites on top (Ultima VII overlap), actors spawn correctly on walkable ground, and the world reads as a single coherent pixel grid rather than mixed-resolution iso tiles

## v0.10.0 Summary

This release moves the shipping renderer to `legacy-backdrop` mode: every location is a hand-cohered pixel-art plate with the player, NPCs, and interactive props drawn as Y-sorted sprites over it. The five location plates plus title/loading were regenerated via Canva MCP and post-processed through `tools/post-process-scene.cjs` (palette-quantize, Bayer dither, `--pixelate 3` to native `320x180`) so the backdrop pixel grid matches the 3x sprites at 0% off-palette and zero anti-aliasing. Spawns and transitions were fixed from broken tile coordinates to pixel coordinates so actors land on walkable ground, perimeter and water-edge collision were added, and the procedural portrait/sprite/UI kit was reworked for clean reads at 3x. The isometric tilemap renderer is retained but is no longer the shipping path. The build was verified in-engine via Playwright across all five locations and dialogue.

## Live Runtime Baseline

| Area | Current Standard |
|------|------------------|
| Traversal | Legacy painted-plate + y-sorted sprites (`960x540`) |
| World art | Per-location cohesive pixel-art plates (native `320x180`, 3x to canvas) |
| Rendering mode | `legacy-backdrop` shipping; isometric tilemap renderer retained but not shipped |
| Props | Pixel-positioned `legacyProps` sprites (~2x) curated per location |
| Named gameplay sheets | `64x192` sheets, `16x32` frames, `4x6` rows, contrast-quantized for 3x |
| Crowd sprites | `16x32` single-frame historical role sprites |
| Portraits | Procedural VGA-style portraits, hard value bands, NW light, no hatch bg |
| Depth sorting | Unified `worldDepth(y)` ordering across both render modes |
| Spawns | Legacy `playerStart` / `npcPositions` are pixel coords (on-screen, walkable) |
| Collision | Authored colliders, perimeter bounds, and approximate water-edge bounds |
| Transitions | On-screen transition triggers and spawns; locations walkable and connected |
| Palette | Palette canon + tropical sky-blue ramp; all 97 tiles quantized |
| Item art | Every player-facing item has a UI icon; markers shrunk to subtle pips |
| RPG state | Six implicit factions surfaced as `City Currents` |
| Style enforcement | `pretest` and `prebuild` hooks run structural and style validation |
| Asset provenance | Plate sources recorded in `tools/canva-sources/MANIFEST.json` |

## What Is Now Working Well

### Cohesive scene plates

- All five location plates plus title/loading are regenerated as cohesive pixel art via Canva MCP and `tools/post-process-scene.cjs`.
- Post-processing palette-quantizes, applies Bayer dither, and pixelates to native `320x180` so the backdrop grid matches the 3x sprites: 0% off-palette, zero anti-aliasing.
- Source provenance is recorded in `tools/canva-sources/MANIFEST.json`.

### Walkable plates and overlap

- The shipping renderer is `legacy-backdrop`: painted plate with player/NPCs/props as Y-sorted sprites on top for Ultima VII-style overlap.
- Interactive props are pixel-positioned sprites via `legacyProps` in `src/data/environment-objects.json`, curated per location at ~2x; iso clusters are skipped on plates.
- The isometric tilemap renderer is retained but is no longer the shipping path.

### Spawns, depth, and collision

- Legacy `playerStart` and `npcPositions` are now pixel coordinates, fixing the prior tile-coord bug that spawned actors in the corner.
- A unified `worldDepth(y)` sort governs draw order in both render modes.
- Perimeter and water-edge collision keep actors on walkable ground; on-screen transition triggers and spawns make locations walkable and connected.

### Sprite and UI readability

- The procedural portrait engine was rewritten with hard value bands, NW lighting, and no hatch background.
- Character sheets were contrast-quantized to read cleanly at 3x, and carved-chrome UI sprites were regenerated.
- Engine overlays (vignette, AO, grain, color-grade) were lightened for pre-lit plates; the missing-prop placeholder is now invisible (no yellow-X boxes), and lore/world-item markers were shrunk to subtle pips.

### What Was Working Well

### Screen art sourcing

- Title and loading screens are generated from documented period Portuguese cityscape sources.
- `docs/art-bible/source-art/README.md` records source URLs, rights notes, fit notes, and retired references.
- `tools/create-sourced-screen-art.cjs` rebuilds `assets/scenes/opening-screen.png` and `assets/scenes/scene-loading-ribeira.png`.

### Building depth

- `IsometricRenderer` joins adjacent raised wall/roof tiles into components.
- Portuguese whitewash, terracotta roof, laterite stone, church stone, doors, and kampung thatch now have distinct raised material treatments.
- Only exposed outer faces render, so buildings read as connected masses rather than concrete block grids.

### Movement and collision

- Invisible row-run wall footprints have been removed.
- Visible wall art is no longer allowed to block ordinary walkable isometric ground.
- Regression tests cover visual-wall collision separation.

### Crowd readability

- Crowd sprites moved from `8x16` silhouettes to `16x32` role sprites.
- Portuguese, Malay, Chinese, Arab, Indian, priest, worker, guard, woman, and child variants now read more clearly at game scale.
- Runtime manifest, asset spec, validator, generator docs, and shadows match the new contract.

### RPG and quest structure

- `The Customs Ledger` provides four authored outcomes.
- `The Merchant's Seal`, `Rashid's Cargo`, and `Pirates on the Horizon` share world-state consequences.
- Six-faction implicit reputation model remains active.
- Journal/HUD surfaces narrative currents qualitatively.

## Known limitations / next

- Time-of-day (dawn/dusk/night) variants for the new plates are not yet regenerated; the old variants are still in place.
- Inter-location transitions are authored but not all walk-tested end to end.
- Water-edge collision is approximate on the waterfront and kampung plates.
- Some lore sprite art (for example the "book") reads oddly at its current size.
- Optional: increase prop density and per-asset prop sizing for richer scenes.

## Production Rule

Art is Claude-managed with no external image-generation API keys: the procedural kit plus Canva MCP only, not Gemini or OpenAI.

## Verification State

The current release candidate passes:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

Additional release validation remains available:

```bash
npm run validate:all
npm run wave:status
npm run audit:art
npm run sync:ultima8-refs
```

## Known Weaknesses

- Raised buildings are still tile-derived; bespoke facade sprites would make individual houses and shops more historically specific.
- Current menu/loading sources are period Portuguese cityscape material, but future variants should prioritize stronger direct Estado da India, Goa, and Malacca source material where rights and quality allow.
- Time-of-day visual scores in location reviews require human walkthroughs.
- Historical accuracy grading still needs deeper domain review.
- `Pirates on the Horizon` still needs a fuller rebuild beyond its current seeded state.

## Medium-Term Priorities

1. Replace more scene backdrops with documented, rights-clean Portuguese Estado da India or Malacca/Goa material.
2. Add bespoke facade/roof sprites for the most important houses, shops, and civic buildings.
3. Complete human visual review of time-of-day location screenshots.
4. Rebuild `Pirates on the Horizon` into the next full systemic quest cluster.
5. Push reactive standards into `St. Paul's Church` and `Kampung`.
6. Keep automated art/style validation aligned with the live runtime rather than historical docs.

## New Commands Since v0.8.0

| Command | Purpose |
|---------|---------|
| `node tools/post-process-scene.cjs --pixelate 3` | Palette-quantize, Bayer-dither, and pixelate scene plates to native `320x180` |
| `node tools/create-sourced-screen-art.cjs` | Rebuild sourced title/loading screen derivatives |
| `npm run generate:crowd` | Regenerate the `16x32` crowd role sprites |

## Release History

### `v0.10.0` - Graphics Cohesion and Walkable Plates Pass

- All five locations moved to `legacy-backdrop` shipping mode: painted plate plus Y-sorted player/NPC/prop sprites
- Five location plates plus title/loading regenerated via Canva MCP and post-processed to native `320x180` (palette-quantize, Bayer dither, `--pixelate 3`)
- 0% off-palette, zero anti-aliasing; source provenance recorded in `tools/canva-sources/MANIFEST.json`
- Interactive props pixel-positioned via `legacyProps`; iso clusters skipped on plates
- Procedural portraits, character sheets, and carved-chrome UI sprites reworked for clean 3x reads
- Legacy `playerStart` / `npcPositions` converted to pixel coords; unified `worldDepth(y)` sort; perimeter and water-edge collision; on-screen transitions and spawns
- Tropical sky-blue palette ramp added; all 97 tiles quantized to palette canon
- Invisible missing-prop placeholder, subtle marker pips, bounded/downscaled lore objects, lightened engine overlays for pre-lit plates
- Verified in-engine via Playwright across all five locations and dialogue

### `v0.9.0` - Historical Architecture and Period-Art Pass

- Sourced Portuguese period cityscape art for title/loading screens
- Source-art documentation and rebuild script added
- Crowd sprites upgraded to `16x32` with stronger historical costume cues
- Invisible visual-wall collision footprints removed
- Raised connected building components added for houses, church, fort, doors, roofs, and thatch
- Runtime manifest, validators, tests, and docs updated for the new contracts

### `v0.8.0` - Ultima VIII Style Enforcement and Art Grading

- Ultima VIII established as singular enforced visual authority
- Style validation runs automatically on every test and build
- Shipping assets mapped, graded, and tracked across corrective waves
- Centralized style header replaces hardcoded prompts in generation tools
- Shared pixel-analysis module supports automated style grading
- Art bible updated with enforced style rules

### `v0.7.0` - Customs Spine and Implicit Faction Pass

- `The Customs Ledger` landed as a four-resolution quest cluster
- Six-faction implicit reputation and `City Currents` landed
- A Famosa <-> Waterfront service routing became stateful
- Four new named quest-bearing/support NPCs were added to the live runtime

### `v0.6.0` - World Polish and Presentation Pass

- A Famosa and St. Paul's parity slices landed
- Item icon coverage reached 100 percent of player-facing items
- Onboarding, prompt grammar, and loading/travel presentation improved

### `v0.5.0` - Gameplay Art Runtime Contract

- Runtime asset manifest became the shipping gameplay-art source of truth
- Named sheets, crowd silhouettes, and strict art validation were standardized

### `v0.4.0` - Art Elevation Pass

- Procedural art quality rose materially across tiles, props, characters, and environment dressing
