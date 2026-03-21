# Quick Start Guide

## Setup

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000`.

## Core Commands

```bash
npm run dev
npm run build
npm run preview
npm test -- --runInBand
npm run validate:art -- --strict
npm run electron
npm run package:mac
```

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move |
| Space | Talk, interact, take item, or travel |
| I | Open or close inventory |
| J | Open or close journal |
| ESC | Pause menu |
| F6-F10 | Debug travel between locations |
| T / Y | Debug time controls |

## First Run Smoke Test

1. Start a new game from the title screen.
2. Confirm the arrival screen loads cleanly into `Rua Direita`.
3. Walk, stop, and reorient near at least one NPC and one item.
4. Start the first conversation and verify portrait, prompt, and dialogue flow.
5. Open inventory and journal once each.
6. Travel to at least one other location and confirm the transition screen and arrival state feel clean.

## Packaging

```bash
npm run package:mac
npm run package:win
npm run package:linux
```

Packaging output is written to `release/`.

## Release Gate

Before committing a release build, run:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

## Key Docs

- `README.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `TESTING.md`
- `docs/PROJECT_BRIEFING.md`
- `docs/PROJECT_SETUP.md`
- `docs/DESIGN_STANDARDS.md`
- `docs/RPG_EXPANSION_PLAN.md`
- `docs/ATMOSPHERIC_SYSTEMS.md`
- `docs/RELEASE_NOTES_v0.6.0.md`
- `docs/TODO.md`
