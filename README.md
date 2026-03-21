# A Famosa: Streets of Golden Melaka

A historical pixel-art adventure RPG set in Portuguese Melaka circa 1580, built as a live isometric Phaser runtime with a strong Ultima VIII-quality target for density, mood, physicality, and readability.

## Release Snapshot

- Current release: `v0.6.0`
- Engine: Phaser 3 + React + TypeScript
- Perspective: 2:1 isometric traversal
- Native canvas: `960x540`
- Art bar: historical Melaka first, Ultima VIII minimum

## What v0.6.0 Adds

- Full parity pass for `A Famosa Gate` and `St. Paul's Church` with the richer live map stack: `Ground`, `Walls`, `Objects`, `Props`, `Overhang`, `Canopy`, `Highlights`
- Stronger authored spread across all five major locations so transition corridors do not collapse into empty final thirds
- Late-80s / early-90s VGA-style portrait direction locked across the named cast
- Complete inventory icon coverage for every player-facing item, with Phaser loading the item icons directly for world pickups where possible
- Contextual onboarding and cleaner interaction presentation so the opening path reads more like an authored adventure RPG and less like a systems demo
- Expanded visual integrity tests covering map richness, portrait coverage, and item-art coverage

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
npm run validate:art -- --strict
npm run electron
npm run package:mac
```

## Current Shipping Bar

### World and presentation

- Five major isometric locations: `A Famosa Gate`, `Rua Direita`, `St. Paul's Church`, `Waterfront`, `Kampung`
- Time-of-day atmosphere with dawn, day, dusk, and night readability
- Contextual loading, onboarding, HUD, dialogue, and inventory presentation
- Save/load with exact location restore and cleaner new-game reset semantics

### Characters and art

- Ten named gameplay sheets on the live `64x192` / `4x6` contract
- Ten crowd-role silhouettes for the runtime background population layer
- Unique VGA-style portraits for the named dialogue cast
- Complete player-facing item icon set in `assets/sprites/ui/items/`

### Validation

- Runtime asset manifest controls gameplay-facing map, tile, character, and prop loading
- `npm run validate:art -- --strict` enforces gameplay art contract compliance
- Jest coverage includes save/load, visual integrity, and regression checks around map richness and portrait coverage

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
  maps/                  Tiled JSON maps for the live runtime
  sprites/
    characters/          Named gameplay sheets
    crowd/               Crowd role silhouettes
    portraits/           VGA-style dialogue portraits
    objects/             Prop and animated object art
    tiles/               Base and isometric tile art
    ui/items/            Player-facing item icons
docs/
  PROJECT_BRIEFING.md    Product and world vision
  PROJECT_SETUP.md       Runtime, asset, and release workflow
  RELEASE_NOTES_v0.6.0.md
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

`v0.6.0` was verified with:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

## Documentation

- [docs/README.md](docs/README.md)
- [docs/PROJECT_BRIEFING.md](docs/PROJECT_BRIEFING.md)
- [docs/PROJECT_SETUP.md](docs/PROJECT_SETUP.md)
- [docs/RELEASE_NOTES_v0.6.0.md](docs/RELEASE_NOTES_v0.6.0.md)
- [docs/LESSONS_LEARNED.md](docs/LESSONS_LEARNED.md)
- [docs/TODO.md](docs/TODO.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
- [CHANGELOG.md](CHANGELOG.md)
- [TESTING.md](TESTING.md)

## Historical Frame

The game is set in 1580 Melaka under Portuguese rule. The visual and systemic bar is not generic tropical fantasy. Commercial, sacred, domestic, and military spaces should read as plausible places within a colonial port city shaped by Portuguese, Malay, Chinese, Indian, and Arab presence.

## License

MIT
