# Ultima VIII Style Reference & Retrofit Plan

## Summary
- Complement the existing structural art pipeline with a concrete Ultima VIII reference grammar that guides characters, environments, portraits, and scenes; everything stays historically grounded in 1580 Melaka.
- Treat the Spriters Resource Ultima VIII: Pagan page as the sprite reference sheet and supplement it with Ultima VIII environment screenshots/maps for density, layering, and physicality cues.
- Roll out the first comprehensive pass across gameplay art, portraits, and scene backdrops, aligning each shipping asset with Ultima VIII-style anchors while keeping UI work as a follow-up.

## Implementation Changes
- Create an internal mirror/manifest of approved Ultima VIII sprite references (`sourceUrl`, `localPath`, `tags`, `approvedFor`, etc.) without copying or shipping the original art.
- Maintain a shipping asset style map linking every named sheet, tile, object, portrait, and scene to Ultima VIII reference IDs plus historical notes, status (keep/tune/replace), and wave.
- Expand the art bible/spec to define explicit Ultima VIII-style rules (dense props, hard pixel edges, occlusion, tactile materials, bottom-center anchoring, banned painterly gradients) and remove divergent Sierra/LucasArts/Baldur’s Gate phrasing from shipping prompts/tools.
- Keep the existing structural validator but add a new style validator that checks prompt docs for banned anchors, ensures reference coverage, and flags palette/anti-alias/contrast deviations based on reference-category metrics. Portrait validation focuses on VGA-grade clusters and silhouette readability rather than direct art copying.
- Provide new npm commands: `npm run sync:ultima8-refs`, `npm run validate:style`, and `npm run audit:art` (which chains the structural and style checks plus report generation); keep `npm run validate:art` backward compatible.
- Add a manual screenshot review/report for each major location across dawn/day/dusk/night that documents density, physicality, and historical relevance per Ultima VIII criteria.

## Corrective Waves
1. **Wave 1** – Align named gameplay sheets and matched portraits to Ultima VIII silhouette/contrast/palette language and mark each asset’s status.
2. **Wave 2** – Refresh tiles, iso tiles, props, animated objects, and crowd silhouettes used in the five locations with denser occlusion, clearer shadows, and Ultima VIII material treatment.
3. **Wave 3** – Regenerate the six base scenes and 15 time-of-day variants after the kit stabilizes, ensuring cinematic art shares the same palette and density logic.

Each wave must produce a grade card per asset (keep/tune/replace) to guide future work.

## Public Interfaces
- Commands: `npm run sync:ultima8-refs`, `npm run validate:style`, `npm run audit:art`.
- Extended specs: add `styleProfiles`, `referenceRequirements`, and `bannedStyleAnchors`.
- New manifests: one for reference material and one for the shipping asset style map.

## Test Plan
- Unit-test manifest loaders and prompt-lint rules using approved/banned style language fixtures.
- Validator tests must catch anti-alias usage, oversoft portraits, missing reference mappings, and banned prompt anchors.
- Continue running `tests/VisualPolishIntegrity.test.js` and add coverage for reference completeness and scene audit reports.
- Acceptance requires both validators to pass, reference coverage for every shipping asset, and reviewed location screenshots at dawn/day/dusk/night.

## Assumptions & Sources
- Mirror Ultima VIII references locally without shipping the original art.
- Scope for the first pass: gameplay art, portraits, and scene backdrops; UI gets vocabulary cleanup unless it becomes a blocker.
- Environment guidance supplements the Spriters Resource page with Ultima VIII screenshots/maps (e.g., the Spriters resource page, Ultima VIII map archive, MobyGames screenshots, Bootstrike review).
