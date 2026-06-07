# Release Notes — v0.10.0

**A Famosa: Streets of Golden Melaka**
**Date:** 2026-06-07
**Title:** Graphics Cohesion and Walkable Plates

---

## Overview

v0.10.0 is a full graphics overhaul. The game moved from a dark isometric tilemap to a **cohesive painted pixel-art world**: every location is a hand-curated scene **plate** with the player, NPCs, and interactive props composited on top as Y-sorted sprites (Ultima VII-style overlap). The key fix for "weak / inconsistent" graphics was unifying the **pixel grid** — backgrounds are pixelated down to match the 3× sprite scale, so the whole screen reads as one chunky pixel-art style.

All of this is produced by a **Claude-managed pipeline with no external image-generation API keys**: a procedural code engine for the gameplay kit, and Canva MCP for the painterly plates, post-processed in-project.

## Rendering model

- **Shipping mode is `legacy-backdrop`** for all 5 locations (`src/data/location-scenes.json`). The painted plate is the world; the isometric tilemap renderer is retained but dormant.
- **Y-sorting** (`worldDepth(y)`) applies to player, NPCs, props, and items in both modes, clamped below the FX/UI depth bands.
- **Spawns/collision** authored in pixel space: `playerStart`/`npcPositions`, perimeter `collisionRects`, water-edge collision (waterfront/kampung), and on-screen transition `triggerArea`/`spawnAt`.

## Scene plate pipeline

```
Canva MCP (Magic Media) — true 2:1 isometric, EMPTY plaza, no baked props/people
  → master export PNG (tools/canva-sources/, tracked in MANIFEST.json)
  → node tools/post-process-scene.cjs <raw> assets/scenes/<scene>.png \
        --width 960 --height 540 --spread 26 --pixelate 3
        (palette-quantize + ordered Bayer dither + pixelate to native 320×180)
  → installed plate (0% off-palette, 0 anti-aliasing)
```

Re-derive every plate from its master at any time: `npm run scenes:rederive`.

## Props as sprites

Interactive props are curated, pixel-positioned sprites via `legacyProps` in `src/data/environment-objects.json` (read by `EnvironmentObjectSystem.placeStaticObjects`, which skips the iso-grid clusters on plates). Themed per location — market stalls (Rua Direita), cannons/crates (A Famosa), crosses/graves (St Paul's), cargo/nets (Waterfront), cooking fire/mats/well (Kampung).

## Sprites, portraits, UI

- Procedural portrait engine rewritten: hard value bands, vignette background (no hatch), NW key light.
- Character sheets contrast-quantized so head/torso/limbs read at 3×.
- Carved-chrome UI sprites regenerated; title/loading screens dithered into the unified palette.
- Tropical sky-blue ramp added to the palette canon; all 97 tiles quantized to it.

## Polish fixes

- Player/NPCs no longer spawn inside the corner wall.
- Missing-prop placeholder is invisible (no more yellow-X boxes).
- Oversized/off-plate iso-cluster props removed; markers reduced to subtle pips; overlays lightened for pre-lit plates.

## Verification

- `npm run build` (tsc + vite + asset validation) — green
- `npm run validate:all`
- In-engine Playwright walkthrough of all 5 locations + dialogue

## Known limitations / next

- Time-of-day (dawn/dusk/night) variants for the new plates are not yet regenerated.
- Inter-location transitions are authored but not all walk-tested end to end.
- Water-edge collision is approximate on waterfront/kampung.
- A few lore sprites (e.g. the "book") read oddly at size.
- Optional: richer prop density and per-asset prop sizing.
