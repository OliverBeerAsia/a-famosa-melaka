# Project Status: A Famosa - Streets of Golden Melaka

## Current Status

- Date: May 2, 2026
- Release: `v0.9.0`
- Status: historical architecture and period-art pass ready for release
- Overall read: the live isometric runtime now has documented Portuguese screen art, deeper historical crowd sprites, raised connected building masses, and cleaner collision separation between visible architecture and walkable ground

## v0.9.0 Summary

This release fixes the latest visual and traversal issues found during live browser review. The menu/loading screens now use sourced 18th-century Portuguese cityscape art, the crowd layer uses larger `16x32` role sprites, visual wall tiles no longer create invisible broad blockers, and buildings are rendered as raised architectural components instead of flat tiles.

## Live Runtime Baseline

| Area | Current Standard |
|------|------------------|
| Traversal | 2:1 isometric Phaser runtime |
| Named gameplay sheets | `64x192` sheets, `16x32` frames, `4x6` rows |
| Crowd sprites | `16x32` single-frame historical role sprites |
| Portraits | Procedural VGA-style Ultima VIII portraits for all named cast |
| Map stack | `Ground`, `Walls`, `Objects`, `Props`, `Overhang`, `Canopy`, `Highlights` |
| Building rendering | Raised connected components generated from wall/roof tiles |
| Collision | Authored colliders only; visual wall art does not create broad blockers |
| Item art | Every player-facing item has a UI icon |
| RPG state | Six implicit factions surfaced as `City Currents` |
| Style enforcement | `pretest` and `prebuild` hooks run structural and style validation |

## What Is Now Working Well

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
| `node tools/create-sourced-screen-art.cjs` | Rebuild sourced title/loading screen derivatives |
| `npm run generate:crowd` | Regenerate the `16x32` crowd role sprites |

## Release History

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
