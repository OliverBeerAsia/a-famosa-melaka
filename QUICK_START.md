# Quick Start Guide

## Setup

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000`.

## Core Commands

```bash
npm run dev                          # Start dev server
npm run build                        # Build (includes prebuild validation)
npm run preview                      # Preview production build
npm test -- --runInBand              # Run tests (includes pretest validation)
npm run electron                     # Build and launch in Electron
npm run package:mac                  # Package for macOS
```

## Art & Style Commands

```bash
npm run validate:art -- --strict     # Structural art validation
npm run validate:style               # Ultima VIII style compliance
npm run validate:all                 # Combined structural + style validation
npm run wave:status                  # View wave grading progress
npm run grade:wave -- --wave 1       # Auto-grade Wave 1 assets
npm run audit:art                    # Full audit with markdown reports
npm run sync:ultima8-refs            # Sync style map with runtime manifest
```

## Art Generation (no API required)

```bash
npm run generate:portraits           # Procedural VGA portraits (all 14)
npm run generate:all-art             # All gameplay sprites (tiles, objects, etc.)
npm run generate:character-sheets    # Character animation sheets
npm run generate:animated-objects    # Animated sprite sheets
npm run generate:crowd               # Crowd silhouettes
```

## Art Generation (API required)

```bash
export OPENAI_API_KEY=sk-...         # Set OpenAI key
npm run generate:openai -- --scenes  # Scene backdrops via DALL-E 3
npm run generate:openai -- --all     # All scenes + portraits via DALL-E 3

export GEMINI_API_KEY=AIza...        # Set Gemini key
npm run generate:scenes              # Scenes via Gemini
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
6. Travel to `Waterfront` and `A Famosa Gate` and confirm the transition screen and arrival state feel clean.
7. Confirm the A Famosa service gate is visible before it is unlocked and becomes usable after customs-related quest state changes.

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
npm test -- --runInBand              # Validates + tests (52 tests, 7 suites)
npm run build                        # Validates + builds
npm run wave:status                  # Confirm wave grading is current
npm run audit:art                    # Full audit with reports
```

## Key Docs

- `README.md`
- `PROJECT_STATUS.md`
- `QUICK_START.md`
- `docs/PROJECT_BRIEFING.md`
- `docs/PROJECT_SETUP.md`
- `docs/DESIGN_STANDARDS.md`
- `docs/art-bible/ART_BIBLE.md` — Visual philosophy + Ultima VIII style rules
- `docs/art-bible/ART_PIPELINE.md` — Production workflow
- `docs/art-bible/gameplay-asset-spec.json` — Machine-readable style profiles + thresholds
- `docs/art-bible/shipping-asset-style-map.json` — Asset-to-reference mapping + grade cards
- `docs/art-bible/ultima8-reference-manifest.json` — Ultima VIII reference catalog
- `docs/art-bible/corrective-waves/wave-tracker.json` — Wave grading progress
- `docs/art-bible/corrective-waves/location-reviews/` — Per-location density reviews
- `docs/ULTIMA8_STYLE_PLAN.md` — Original style retrofit plan
