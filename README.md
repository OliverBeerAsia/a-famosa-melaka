# A Famosa: Streets of Golden Melaka

A historical pixel-art adventure RPG set in Portuguese Melaka circa 1580, built as a live isometric Phaser runtime with a strong Ultima VIII-quality target for density, mood, physicality, and readability.

## Release Snapshot

- Current release: `v0.7.0`
- Engine: Phaser 3 + React + TypeScript
- Perspective: 2:1 isometric traversal
- Native canvas: `960x540`
- Art bar: historical Melaka first, Ultima VIII minimum

## What v0.7.0 Adds

- A new interlocked quest cluster, `The Customs Ledger`, tying `Rua Direita`, `Waterfront`, `A Famosa Gate`, and `Kampung` into one corruption-and-cargo spine
- A six-faction implicit reputation model with `City Currents` replacing the older coarse four-faction setup
- A visible-but-locked `A Famosa Gate <-> Waterfront` service route gated by world state instead of being permanently open
- Four new named customs-spine NPCs: `Gaspar Mesquita`, `Diogo Almeida`, `Lin Mei`, and `Pak Salleh`
- Expanded customs-era environment dressing, world-item affordances, and fortress/quay paperwork spaces across the live route
- Save/load migration and regression coverage for quest resolutions, route gating, and witness-driven quest state

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
- Active customs-corruption spine linking `Rua Direita`, `Waterfront`, `A Famosa Gate`, and `Kampung`
- Time-of-day atmosphere with dawn, day, dusk, and night readability
- Contextual loading, onboarding, HUD, dialogue, and inventory presentation
- Save/load with exact location restore and cleaner new-game reset semantics

### Characters and art

- Fourteen named gameplay sheets on the live `64x192` / `4x6` contract
- Ten crowd-role silhouettes for the runtime background population layer
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
  RELEASE_NOTES_v0.7.0.md
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

`v0.7.0` was verified with:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

## Documentation

- [docs/README.md](docs/README.md)
- [docs/PROJECT_BRIEFING.md](docs/PROJECT_BRIEFING.md)
- [docs/PROJECT_SETUP.md](docs/PROJECT_SETUP.md)
- [docs/DESIGN_STANDARDS.md](docs/DESIGN_STANDARDS.md)
- [docs/RPG_EXPANSION_PLAN.md](docs/RPG_EXPANSION_PLAN.md)
- [docs/ATMOSPHERIC_SYSTEMS.md](docs/ATMOSPHERIC_SYSTEMS.md)
- [docs/RELEASE_NOTES_v0.7.0.md](docs/RELEASE_NOTES_v0.7.0.md)
- [docs/LESSONS_LEARNED.md](docs/LESSONS_LEARNED.md)
- [docs/TODO.md](docs/TODO.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
- [CHANGELOG.md](CHANGELOG.md)
- [TESTING.md](TESTING.md)

## Historical Frame

The game is set in 1580 Melaka under Portuguese rule. The visual and systemic bar is not generic tropical fantasy. Commercial, sacred, domestic, and military spaces should read as plausible places within a colonial port city shaped by Portuguese, Malay, Chinese, Indian, and Arab presence.

## License

MIT
