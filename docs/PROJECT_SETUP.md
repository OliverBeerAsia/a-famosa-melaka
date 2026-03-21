# Project Setup and Release Workflow

## Current Stack

- Engine: Phaser 3
- UI: React 18
- Language: TypeScript
- State: Zustand
- Build: Vite
- Desktop packaging: Electron Builder

This is the live shipping stack. Older Phaser-only, JavaScript-only, or webpack-first descriptions are obsolete.

## Runtime Layout

```text
src/
  App.tsx                    React application shell
  components/
    screens/                title, loading, credits, transitions
    ui/                     HUD, dialogue, inventory, journal, pause
  data/                     manifests, maps, NPCs, items, quests
  phaser/
    scenes/                 BootScene, GameScene
    systems/                environment, weather, crowd, rendering
  stores/                   game, save, quest, dialogue, inventory
assets/
  maps/                     Tiled JSON maps
  sprites/
    characters/             named gameplay sheets
    crowd/                  crowd silhouettes
    portraits/              dialogue portraits
    objects/                world props and animated objects
    ui/items/               item icons
```

## Shipping Contracts

### Character contract

- Named sheets: `64x192`
- Frame size: `16x32`
- Layout: `4x6`
- Expected rows: walk, idle, talk

### Map contract

Major isometric locations should expose:

- `Ground`
- `Walls`
- `Objects`
- `Props`
- `Overhang`
- `Canopy`
- `Highlights`

### Portrait contract

- unique portrait per named dialogue NPC
- VGA-style pixel-art family
- square crop
- readable at dialogue scale

### Item-art contract

- every player-facing item must have a UI icon
- important world pickups should prefer item-backed art, not generic proxy sprites

## Commands

```bash
npm run dev
npm run build
npm run preview
npm test -- --runInBand
npm run validate:art -- --strict
npm run electron
npm run package:mac
```

## Release Verification

Run these before a release commit or tag:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

If packaging is required for the release, build the platform packages after those gates pass.

## Packaging

Electron Builder writes release artifacts into `release/`.

Primary commands:

```bash
npm run package:mac
npm run package:win
npm run package:linux
```

## Manual Release Flow

1. Update version metadata.
2. Update root docs and `docs/`.
3. Run tests, build, and strict art validation.
4. Package platform artifacts if required.
5. Commit on `main`.
6. Push commit.
7. Create an annotated tag.
8. Create the GitHub release with release notes and attached artifacts.

## Editing Rules for Content Work

- Do not let cinematic scene art substitute for weak playable spaces.
- Do not add new map areas without also extending tests or validation where practical.
- Do not introduce portrait aliases for named cast members.
- Do not lower the map density bar to make a release easier.

## Current High-Risk Areas

- Gameplay-sheet redraw quality for the named cast
- Manual playthrough polish versus structural/tested correctness
- Historical believability in NPC routines and conversation reactivity
- Cross-time-of-day screenshot review for all major locations
