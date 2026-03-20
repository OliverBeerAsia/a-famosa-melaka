# Art Pipeline and Audit Standard

This is the operational companion to `ART_BIBLE.md`. Use it for production decisions, not mood boards.

## Target

- Gameplay: Ultima VIII-leaning 2:1 isometric pixel art.
- Cinematic: 16:9 scene art and portraits.
- Concept: staging only; never ship raw concept renders.

## Commands

- `npm run validate:art`
- `npm run validate:art -- --report docs/art-bible/art-audit.md`
- `npm run validate:art -- --report docs/art-bible/art-audit.md --strict`

## Asset Classes

### Gameplay

Use for anything the player traverses, clicks, equips, or reads in the world.

- Native pixel art only.
- Nearest-neighbor scaling only.
- No blur, no anti-aliasing, no baked perspective drift.
- Keep silhouette readable at 1x and 3x.
- Keep source art under 256px on the longest side unless the spec explicitly allows a module.

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
5. Move anything exploratory into concept/staging paths.
6. Re-run the audit until the report is clean for that asset class.

## Ship Gate

A file is ready only when:

- It is in the right class.
- It matches the right dimensions.
- It matches the right naming pattern.
- It is readable in-engine without extra special-casing.
- It has a historical review note or a clear reason for deviation.
