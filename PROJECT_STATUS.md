# Project Status: A Famosa - Streets of Golden Melaka

## Current Status

- Date: March 21, 2026
- Release: `v0.8.0`
- Status: Ultima VIII style enforcement framework fully operational
- Overall read: the game now has a machine-enforced visual identity, automated art grading, and a corrective-wave pipeline that gates every asset against Ultima VIII style profiles

## v0.8.0 Summary

This release establishes Ultima VIII: Pagan as the singular, enforced visual authority for all shipping art. The style framework moved from aspirational documentation to automated enforcement: every `npm test` and `npm run build` now validates structural and style compliance, generation tools read from centralized prompts, and all 154 shipping assets have been graded against machine-checkable style profiles.

## Live Runtime Baseline

| Area | Current Standard |
|------|------------------|
| Traversal | 2:1 isometric Phaser runtime |
| Named gameplay sheets | `64x192` sheets, `16x32` frames, `4x6` rows |
| Portraits | Procedural VGA-style Ultima VIII portraits for all 14 named cast (no API dependency) |
| Map stack | `Ground`, `Walls`, `Objects`, `Props`, `Overhang`, `Canopy`, `Highlights` |
| Item art | Every player-facing item has a UI icon |
| RPG state | Six implicit factions surfaced as `City Currents` |
| Style enforcement | `pretest` and `prebuild` hooks run structural + style validation automatically |
| Art grading | Wave 1 complete (28/28 keep), Wave 2 graded (90/105), Wave 3 graded (21/21) |

## What Is Now Working Well

### Ultima VIII style enforcement

- Every `npm test` runs both `validate:art` and `validate:style` before Jest (pretest hook)
- Every `npm run build` runs structural validation before Vite (prebuild hook)
- Style profiles define numeric thresholds for anti-aliasing, gradient detection, and color cluster analysis
- `validate:style` reads thresholds from `styleProfiles` in the spec, not hardcoded values
- Prompt lint catches banned style anchors (Sierra, LucasArts, Baldur's Gate, painterly, etc.) across all AI prompt files
- Reference coverage ensures every shipping asset maps to Ultima VIII reference IDs

### Art generation pipeline

- Centralized style header via `load-style-header.cjs` — all generation tools read from one source
- Procedural portrait generator (`generate-portraits-procedural.cjs`) produces 512x512 VGA portraits using canvas with zero API dependency
- OpenAI DALL-E 3 generator (`generate-openai.cjs`) available for scene backdrops and AI portraits when API key is available
- All 6 existing Gemini generators rewired to use centralized style header
- Shared pixel analysis module (`pixel-analysis.cjs`) used by validator and grading tool

### Corrective wave system

- Wave 1 (characters + portraits): 28/28 graded, all keep — procedural portraits fixed both flagged assets
- Wave 2 (tiles, objects, crowd): 90/105 graded, 90 keep, 15 pending (files not yet created)
- Wave 3 (scene backdrops): 21/21 graded, all flagged for replacement (pending API-based or procedural regeneration)
- `npm run wave:status` provides instant progress visibility
- `npm run grade:wave` auto-grades assets against style profiles with pass/partial/fail verdicts

### Location reviews

- All 5 locations auto-reviewed with structural data from map files
- Object counts, density assessments, cluster coverage, material variety, and occlusion all populated
- All 5 locations meet the Ultima VIII density bar
- Time-of-day visual scores left for human review

### World quality (carried from v0.7.0)

- `Rua Direita`, `Waterfront`, and `Kampung` remain the reference-density slices
- `A Famosa Gate` reads as a fortress approach
- `St. Paul's Church` reads as a processional sacred space
- Cross-location spread is materially better near exits and returns

### RPG and quest structure (carried from v0.7.0)

- `The Customs Ledger` provides four authored outcomes
- `The Merchant's Seal`, `Rashid's Cargo`, and `Pirates on the Horizon` share world-state consequences
- Six-faction implicit reputation model active
- Journal/HUD surfaces narrative currents qualitatively

## Verification State

The current release candidate passes:

```bash
npm run build                    # prebuild structural validation + Vite build
npm test -- --runInBand          # pretest validation + 52 tests (7 suites)
npm run validate:art -- --strict # structural art compliance
npm run validate:style           # Ultima VIII style compliance
npm run wave:status              # wave grading progress
npm run audit:art                # combined audit with reports
npm run sync:ultima8-refs        # style map sync check
```

## Known Weaknesses

- Wave 3 (21 scene backdrops) all flagged for replacement — pending API-based regeneration or procedural scene generator
- 15 Wave 2 assets exist in the style map but not yet as files (future expansion assets)
- Time-of-day visual scores in location reviews require human walkthroughs
- Historical accuracy grading requires domain expertise (left null in grade cards)
- `Pirates on the Horizon` still needs a fuller rebuild beyond its current seeded state

## Medium-Term Priorities

1. Regenerate the 21 scene backdrops with Ultima VIII density (via OpenAI, Gemini, or procedural scene generator).
2. Create the 15 missing Wave 2 asset files to achieve full coverage.
3. Complete human visual review of time-of-day location screenshots.
4. Rebuild `Pirates on the Horizon` into the next full systemic quest cluster.
5. Push reactive standards into `St. Paul's Church` and `Kampung`.
6. Build a procedural scene backdrop generator for full API independence.

## New Commands (v0.8.0)

| Command | Purpose |
|---------|---------|
| `npm run validate:style` | Ultima VIII style compliance validation |
| `npm run validate:all` | Combined structural + style validation |
| `npm run grade:wave -- --wave N` | Auto-grade assets against style profiles |
| `npm run wave:status` | View wave grading progress |
| `npm run audit:art` | Full audit with markdown reports |
| `npm run sync:ultima8-refs` | Sync style map with runtime manifest |
| `npm run generate:portraits` | Procedural VGA portraits (no API) |
| `npm run generate:openai -- --scenes` | Scene backdrops via DALL-E 3 |

## Release History

### `v0.8.0` - Ultima VIII Style Enforcement and Art Grading

- Ultima VIII established as singular enforced visual authority
- Style validation runs automatically on every test and build
- 154 shipping assets mapped, graded, and tracked across 3 corrective waves
- Wave 1 complete: all 14 procedural portraits pass every style check
- Centralized style header replaces hardcoded prompts in 6 generation tools
- Shared pixel analysis module with anti-aliasing, gradient, palette, and shadow detection
- Auto-grading tool populates grade cards with pass/partial/fail verdicts
- 5 location reviews auto-populated with structural density data
- OpenAI DALL-E 3 generator available as Gemini alternative
- All divergent style references (Sierra, LucasArts, Baldur's Gate) removed from prompts, tools, docs, and source
- Art bible updated with Section 2.5 Ultima VIII Style Rules
- Design standards wired to enforcement pipeline

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
