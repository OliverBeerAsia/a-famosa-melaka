# Project Status: A Famosa - Streets of Golden Melaka

## Current Status

- Date: March 21, 2026
- Release: `v0.7.0`
- Status: customs-spine RPG foundation shipped on top of the world-polish baseline
- Overall read: the game now behaves more like a small authored historical RPG, not just a polished movement-and-art showcase

## v0.7.0 Summary

This release turns the customs/corruption plan into live gameplay. `Rua Direita`, `Waterfront`, `A Famosa Gate`, and the `Kampung` edge now participate in one interlocked quest spine, the game has moved from four coarse factions to six implicit trust blocs, and route access, greetings, and branching outcomes now consume world state instead of merely storing it.

## Live Runtime Baseline

| Area | Current Standard |
|------|------------------|
| Traversal | 2:1 isometric Phaser runtime |
| Named gameplay sheets | `64x192` sheets, `16x32` frames, `4x6` rows |
| Portraits | Unique late-80s / early-90s VGA-style bios for named cast |
| Map stack | `Ground`, `Walls`, `Objects`, `Props`, `Overhang`, `Canopy`, `Highlights` |
| Item art | Every player-facing item has a UI icon |
| RPG state | six mostly implicit factions surfaced as `City Currents` |
| Validation | Build, tests, and strict art validation must all pass |

## What Is Now Working Well

### World quality

- `Rua Direita`, `Waterfront`, and `Kampung` remain the reference-density slices
- `A Famosa Gate` now reads as a fortress approach instead of a sparse connector
- `St. Paul's Church` now reads as a processional sacred space instead of a lightly dressed hill
- Cross-location spread is materially better near exits and returns
- The service route between `A Famosa Gate` and `Waterfront` is now an authored, stateful shortcut rather than a dead concept

### RPG and quest structure

- `The Customs Ledger` now provides four authored outcomes: expose, broker, bury, or follow the trail
- `The Merchant's Seal`, `Rashid's Cargo`, and `Pirates on the Horizon` now share customs/cove/world-state consequences instead of reading as isolated quests
- The reputation model now distinguishes `garrison`, `church`, `portuguese-merchants`, `chinese-merchants`, `kampung-community`, and `dockside-network`
- Journal/HUD presentation now surfaces narrative currents qualitatively instead of exposing raw meters

### Art integration

- Portrait family is consistent
- World pickups can use actual item icon textures through Phaser
- Visual integrity tests now cover map richness, portrait completeness, and item-icon completeness
- Four new named customs-spine NPCs now have live runtime sheets and portraits, though these are still stopgap derivatives pending bespoke redraw

## Verification State

The current release candidate passes:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

Remaining QA risk is experiential rather than structural: full playthrough feel, deeper historical behavior, and bespoke character-art replacement still need repeated manual review.

## Known Weaknesses

- The four new customs-spine NPC sheets and portraits are functional stopgaps, not final bespoke art
- `Pirates on the Horizon` is now a useful Phase 2 hook, but it still needs a fuller rebuild beyond its current seeded state
- `St. Paul's Church` and `Kampung` have better standards coverage than before, but they are not yet as reactive as the customs spine
- The game still needs more consistent manual screenshot review and full route-walkthrough review across dawn, day, dusk, and night

## Medium-Term Priorities

1. Replace the four new stopgap customs-spine character sheets and portraits with bespoke runtime art.
2. Rebuild `Pirates on the Horizon` into the next full systemic quest cluster.
3. Push the same reactive standards into `St. Paul's Church` and `Kampung`.
4. Improve travel beats, conversation staging, and early quest pacing further.
5. Strengthen historical believability through more grounded schedules, use-patterns, and location logic.
6. Keep extending validation so quest-state and visual regressions fail loudly.

## Release History

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
