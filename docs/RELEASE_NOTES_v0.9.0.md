# Release Notes: v0.9.0

**Date:** May 2, 2026

## Release Theme

This release is a visual credibility pass for the live isometric runtime. It replaces weak menu/loading art with documented period Portuguese cityscape sources, upgrades the background population from tiny silhouettes to readable historical role sprites, removes invisible walking blockers, and turns flat building tiles into raised connected architecture.

## Highlights

### 1. Period Portuguese screen art

- The title screen now uses a sourced 18th-century Portuguese cityscape derivative.
- The loading screen now uses a sourced Ribeira Palace and square derivative.
- Source files, URLs, fit notes, and rights notes are documented in `docs/art-bible/source-art/README.md`.
- The generation script `tools/create-sourced-screen-art.cjs` rebuilds the shipping derivatives from those sources.

### 2. More detailed historical crowd sprites

- Crowd sprites are now `16x32` instead of `8x16`.
- Portuguese merchants, guards, workers, priests, Malay locals, Malay women, Malay children, Chinese merchants, Arab traders, and Indian merchants have distinct costume reads.
- Runtime manifest, art spec, validator, and generator docs now enforce the larger crowd contract.

### 3. Player movement blockers fixed

- The visual wall layer no longer creates broad invisible collision footprints.
- Collision remains authored separately, so visible architecture cannot lock the player on ordinary walkable tiles.
- Regression tests now assert that visual wall rendering and raised-building rendering do not reintroduce those blockers.

### 4. Buildings now have raised mass

- Portuguese houses, church stone, laterite fort material, wood doors, terracotta roofs, and kampung thatch are rendered as raised connected building components.
- The renderer joins adjacent wall/roof tiles into one architectural mass, exposes only real outer faces, and separates facades from roofs.
- This avoids both the old flat-tile look and the interim concrete-box look.

## Verification

The release candidate passed:

```bash
npm test -- --runInBand
npm run build
npm run validate:art -- --strict
```

## What This Release Does Not Finish

- The raised-building renderer is still tile-driven; bespoke facade sprites would allow richer shopfronts and house silhouettes.
- The source art is period Portuguese cityscape material, but future loading variants should prioritize more direct Estado da India, Goa, and Malacca sources where quality and rights allow.
- Full manual playthrough QA is still needed after release to catch experiential issues that automated checks cannot see.
