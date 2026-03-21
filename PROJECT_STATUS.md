# Project Status: A Famosa - Streets of Golden Melaka

## Current Status

- Date: March 21, 2026
- Release: `v0.6.0`
- Status: world parity, item-art coverage, and presentation polish shipped
- Overall read: the game is now a coherent live isometric RPG slice, not just an art-pipeline experiment

## v0.6.0 Summary

This release closes the gap between the stronger `Rua Direita` slice and the rest of the playable world. `A Famosa Gate` and `St. Paul's Church` now use the richer live layer contract, item icons are complete, portrait direction is standardized, and the first-play flow is quieter and more intentional.

## Live Runtime Baseline

| Area | Current Standard |
|------|------------------|
| Traversal | 2:1 isometric Phaser runtime |
| Named gameplay sheets | `64x192` sheets, `16x32` frames, `4x6` rows |
| Portraits | Unique late-80s / early-90s VGA-style bios for named cast |
| Map stack | `Ground`, `Walls`, `Objects`, `Props`, `Overhang`, `Canopy`, `Highlights` |
| Item art | Every player-facing item has a UI icon |
| Validation | Build, tests, and strict art validation must all pass |

## What Is Now Working Well

### World quality

- `Rua Direita`, `Waterfront`, and `Kampung` remain the reference-density slices
- `A Famosa Gate` now reads as a fortress approach instead of a sparse connector
- `St. Paul's Church` now reads as a processional sacred space instead of a lightly dressed hill
- Cross-location spread is materially better near exits and returns

### Presentation

- Arrival and travel screens are differentiated
- Early HUD clutter is reduced
- Quest tracker noise is delayed until it matters
- Interaction prompts distinguish NPC talk, item pickup, lore, and travel targets

### Art integration

- Portrait family is consistent
- World pickups can use actual item icon textures through Phaser
- Visual integrity tests now cover map richness, portrait completeness, and item-icon completeness

## Verification State

The current release candidate passes:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

Remaining QA risk is experiential rather than structural: full playthrough feel, conversation pacing, and historical believability still need repeated manual review.

## Known Weaknesses

- Named gameplay sheets still need a second-pass redraw for stronger role, age, and status readability at runtime scale
- The opening ten minutes are cleaner, but still not fully at the authored-adventure standard of a mature Ultima-like
- Historical specificity is improving faster in map dressing than in systemic social behavior, schedules, and reactive dialogue
- The game still needs more consistent manual screenshot review across dawn, day, dusk, and night for every upgraded location

## Medium-Term Priorities

1. Redraw the named cast gameplay sheets inside the current runtime contract.
2. Improve travel beats, conversation staging, and early quest pacing.
3. Add the first practical RPG-depth layer: faction trust, light reputation, and multi-path resolutions in the core quest lines.
4. Strengthen historical believability through more grounded schedules, use-patterns, and location logic.
5. Tighten the item/world relationship for important quest and trade objects.
6. Keep extending validation so visual regressions fail loudly.

## Release History

### `v0.6.0` - World Polish and Presentation Pass

- A Famosa and St. Paul's parity slices landed
- Item icon coverage reached 100 percent of player-facing items
- Onboarding, prompt grammar, and loading/travel presentation improved

### `v0.5.0` - Gameplay Art Runtime Contract

- Runtime asset manifest became the shipping gameplay-art source of truth
- Named sheets, crowd silhouettes, and strict art validation were standardized

### `v0.4.0` - Art Elevation Pass

- Procedural art quality rose materially across tiles, props, characters, and environment dressing
