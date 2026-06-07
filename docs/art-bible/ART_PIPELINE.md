# Art Pipeline and Audit Standard

This is the operational companion to `ART_BIBLE.md`. Use it for production decisions, not mood boards.

## Target

- Gameplay: per-location painted scene PLATE (legacy-backdrop mode) with player, NPCs, and props as Y-sorted sprites on top (Ultima VII overlap).
- Cinematic: 16:9 scene art and portraits for interstitials only.
- Concept: staging only; never ship raw concept renders.

## Shipping Truth

- The live gameplay runtime is the TypeScript Phaser path under `src/phaser/`.
- Shipping gameplay world art is the per-location painted scene PLATE, not the isometric tilemap. All 5 locations run `runtimeMode: "legacy-backdrop"` in `src/data/location-scenes.json`.
- The plate is a true 2:1 isometric, empty plaza; the player, NPCs, and interactive props composite over it as Y-sorted sprites (bottom-center anchored) for Ultima VII-style overlap.
- The isometric tilemap renderer is retained but dormant; it is not the shipping path.
- Portraits and cinematic-only PNGs are cinematic assets; they do not define the gameplay asset contract.
- Runtime asset parity is defined in `src/data/runtime-asset-manifest.json`.

## Scene Plate Pipeline

Scene plates are the shipping gameplay world art. They are produced Claude-managed, with no external image-generation API keys.

1. Generate a TRUE 2:1 isometric, EMPTY plaza (no baked props, no baked people) via Canva MCP (Magic Media). Empty plates only — clutter and characters arrive as sprites.
2. Export the raw render as PNG. Master raw exports and provenance are tracked in `tools/canva-sources/MANIFEST.json`.
3. Post-process to install. This quantizes to the indexed-ramp palette (`tools/ultima8-graphics/palette.cjs`) with ordered Bayer dithering, pixelates to native 320x180 (`--pixelate 3`, `--spread 26`), then nearest-upscales to 960x540 so the background pixel grid matches the 3x-scaled sprites:

   ```
   node tools/post-process-scene.cjs <raw> assets/scenes/<scene>.png --width 960 --height 540 --spread 26 --pixelate 3
   ```

4. Target output: 0% off-palette, 0 anti-aliasing. Verify each plate in-engine across all 5 locations.

## Props as Sprites (legacyProps)

- Interactive props on legacy plates are sprites, not baked paint and not iso clusters.
- They are curated and pixel-positioned via `legacyProps` in `src/data/environment-objects.json`, read by `EnvironmentObjectSystem`.
- On legacy plates the system skips the isometric prop clusters and places `legacyProps` instead.
- Prop scale is ~2x.

## Commands

- `npm run validate:all`
- `npm run validate:art`
- `npm run validate:art -- --report docs/art-bible/art-audit.md`
- `npm run validate:art -- --report docs/art-bible/art-audit.md --strict`
- `npm run grade:wave`

## Asset Classes

### Gameplay

Use for anything the player traverses, clicks, equips, or reads in the world.

- Native pixel art only.
- Nearest-neighbor scaling only.
- No blur, no anti-aliasing, no baked perspective drift.
- Keep silhouette readable at 1x and 3x.
- Keep source art under 256px on the longest side unless the spec explicitly allows a module.
- Named characters ship as `64x192` sheets with `4x6` row-major walk/idle/talk layout.
- Crowd ships as `16x32` single-frame figures so costume, role, and cultural read match named-character pixel density.
- Gameplay palette is the approved indexed-ramp canon from `tools/ultima8-graphics/palette.cjs`.

### Cinematic

Use for scene backdrops, interstitials, title beats, and portraits.

- Can be higher fidelity than gameplay.
- Must stay out of interactive world directories.
- Must match the era, palette, and cultural reference set.

### Concept / Staging

Use for experiments and AI exploration only.

- Staging folders currently include `assets/sprites/ai-objects` and `assets/sprites/ui`.
- Never referenced by runtime.
- Move useful ideas into gameplay or cinematic assets before promotion.

## Isometric 2:1 Rules

- Ground tiles are 32x16; macro tiles are 64x32.
- Character frames are authored to the sheet frame sizes in `gameplay-asset-spec.json`.
- Anchor characters and props to the bottom-center of the footprint.
- Shadow direction is fixed and consistent across the slice.
- Walkable edges stay clean; overhangs only happen when the object is clearly above the floor plane.
- Avoid mixed pixel densities inside the same scene.
- Do not let cinematic detail level leak into gameplay art.

## Gameplay Checklist

Before promotion to shipping gameplay art, confirm:

- File is in an approved gameplay directory.
- File name matches the repo naming pattern.
- Frame size or footprint matches the spec.
- Palette and outline treatment match adjacent assets.
- The asset reads clearly on the 320x180 native canvas.
- Any transparency is intentional and edge clean.
- A historical reference exists and was checked.

## Cinematic Checklist

Before promotion to shipping cinematic art, confirm:

- Scene is 960x540 or portrait is square and large enough.
- It does not contain gameplay UI or debug text.
- It does not contradict the current gameplay palette or architecture set.
- It can be reused as an interstitial without extra cropping work.
- It is tagged as cinematic, not gameplay.

## Audit Workflow

1. Generate or update the asset.
2. Run `npm run validate:art -- --report docs/art-bible/art-audit.md`.
3. Fix all `error` findings first.
4. Fix `warn` findings before promotion if the asset is player-facing.
5. Confirm the live TypeScript Phaser runtime can actually load and render the asset.
6. Move anything exploratory into concept/staging paths.
7. Re-run the audit until the report is clean for that asset class.

## Ship Gate

A file is ready only when:

- It is in the right class.
- It matches the right dimensions.
- It matches the right naming pattern.
- It is readable in-engine without extra special-casing.
- It has a historical review note or a clear reason for deviation.
