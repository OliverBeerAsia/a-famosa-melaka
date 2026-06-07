# A Famosa: Streets of Golden Melaka

A historical pixel-art adventure RPG set in Portuguese Melaka circa 1580. Each location renders as a cohesive hand-painted pixel-art plate with the player, NPCs, and interactive props composited on top as Y-sorted sprites for Ultima VII-style overlap, holding a strong Ultima VIII-quality target for density, mood, physicality, and readability.

## Release Snapshot

- Current release: `v0.10.0`
- Engine: Phaser 3 + React + TypeScript
- Rendering: painted scene plates (legacy-backdrop mode) with Y-sorted composited sprites
- Native canvas: `960x540` (plates authored at native `320x180`, scaled up)
- Art bar: historical Melaka first, Ultima VIII minimum

## What v0.10.0 Adds

- Each of the five locations now renders as a single cohesive painted pixel-art plate, with the player, NPCs, and interactive props composited on top as Y-sorted sprites for true Ultima VII-style overlap
- Scene plates are produced by a Claude-managed pipeline with no external image-generation API keys: Canva MCP (Magic Media) generates a true 2:1 isometric empty plaza, then `tools/post-process-scene.cjs` palette-quantizes, Bayer-dithers, and pixelates it down to the native `320x180` grid before install to `assets/scenes/`
- Master exports and provenance are tracked in `tools/canva-sources/MANIFEST.json`; the procedural engine under `tools/ultima8-graphics/` produces the gameplay kit (tiles, props, sprites, portraits, UI)
- Interactive props are curated, pixel-positioned sprites declared via `legacyProps` in `src/data/environment-objects.json`
- Visual identity tightened toward cohesive chunky pixel art (Skald / Ultima VIII feel): strict indexed palette, ordered dithering, and a background pixel grid matched to the `3x` sprite grid
- The isometric tilemap renderer is retained but dormant; the painted-plate path is the shipping world

## Quick Start

### Requirements

- Node.js 16+
- npm

### Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:3000`.

### Core Commands

```bash
npm run dev
npm run build
npm run preview
npm test -- --runInBand
npm run validate:all
npm run electron
npm run package:mac
```

### Scene Plate Pipeline

Scene plates come from Canva MCP (Magic Media) raw exports, then are post-processed to the native pixel grid. To re-bake a plate from a raw master:

```bash
node tools/post-process-scene.cjs <raw> assets/scenes/<scene>.png --width 960 --height 540 --spread 26 --pixelate 3
```

Master exports and provenance live in `tools/canva-sources/MANIFEST.json`.

## Current Shipping Bar

### World and presentation

- Five major locations, each a cohesive painted plate with Y-sorted composited sprites: `A Famosa Gate`, `Rua Direita`, `St. Paul's Church`, `Waterfront`, `Kampung`
- Active customs-corruption spine linking `Rua Direita`, `Waterfront`, `A Famosa Gate`, and `Kampung`
- Time-of-day atmosphere with dawn, day, dusk, and night readability
- Contextual loading, onboarding, HUD, dialogue, and inventory presentation
- Save/load with exact location restore and cleaner new-game reset semantics

### Characters and art

- Fourteen named gameplay sheets on the live `64x192` / `4x6` contract
- Ten `16x32` crowd-role sprites for the runtime background population layer
- Unique VGA-style portraits for the named dialogue cast
- Complete player-facing item icon set in `assets/sprites/ui/items/`

### Validation

- Runtime asset manifest controls gameplay-facing map, tile, character, and prop loading
- `npm run validate:art -- --strict` enforces gameplay art contract compliance
- Jest coverage includes save/load, visual integrity, customs-route locking, and regression checks around map richness, quest gating, and portrait coverage

## Controls

- `Arrow Keys` / `WASD`: move
- `Space`: interact, talk, take, or travel depending on target
- `I`: inventory
- `J`: journal
- `Esc`: pause
- `F6-F10`: debug travel
- `T` / `Y`: debug time controls

## Project Structure

```text
assets/
  scenes/                Painted scene plates (the shipping world)
  maps/                  Tiled JSON maps for the dormant iso tilemap renderer
  sprites/
    characters/          Named gameplay sheets
    crowd/               Crowd role silhouettes
    portraits/           VGA-style dialogue portraits
    objects/             Prop and animated object art
    tiles/               Base and isometric tile art
    ui/items/            Player-facing item icons
tools/
  post-process-scene.cjs Palette-quantize + dither + pixelate scene plates
  canva-sources/         Master scene exports and provenance (MANIFEST.json)
  ultima8-graphics/      Procedural gameplay-kit generators
docs/
  PROJECT_BRIEFING.md    Product and world vision
  PROJECT_SETUP.md       Runtime, asset, and release workflow
  RELEASE_NOTES_v0.9.0.md
  LESSONS_LEARNED.md
  TODO.md
src/
  phaser/                BootScene, GameScene, runtime systems
  components/            React UI and screens
  stores/                Zustand game state
  data/                  NPCs, items, quests, locations, manifests
tests/                   Jest regression coverage
tools/                   Art generation and validation scripts
```

## Release Verification

`v0.10.0` was verified with:

```bash
npm test -- --runInBand
npm run build
npm run validate:all
```

## Documentation

- [docs/README.md](docs/README.md)
- [docs/PROJECT_BRIEFING.md](docs/PROJECT_BRIEFING.md)
- [docs/PROJECT_SETUP.md](docs/PROJECT_SETUP.md)
- [docs/DESIGN_STANDARDS.md](docs/DESIGN_STANDARDS.md)
- [docs/RPG_EXPANSION_PLAN.md](docs/RPG_EXPANSION_PLAN.md)
- [docs/ATMOSPHERIC_SYSTEMS.md](docs/ATMOSPHERIC_SYSTEMS.md)
- [docs/RELEASE_NOTES_v0.9.0.md](docs/RELEASE_NOTES_v0.9.0.md)
- [docs/LESSONS_LEARNED.md](docs/LESSONS_LEARNED.md)
- [docs/TODO.md](docs/TODO.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
- [CHANGELOG.md](CHANGELOG.md)
- [TESTING.md](TESTING.md)

## Historical Frame

The game is set in 1580 Melaka under Portuguese rule. The visual and systemic bar is not generic tropical fantasy. Commercial, sacred, domestic, and military spaces should read as plausible places within a colonial port city shaped by Portuguese, Malay, Chinese, Indian, and Arab presence.

## License

MIT
