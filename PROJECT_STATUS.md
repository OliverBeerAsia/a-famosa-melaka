# Project Status: A Famosa - Streets of Golden Melaka

## Current Status

- Date: August 1, 2026
- Release: `v0.11.0` — "The Forge Overhaul"
- Overall read: all five locations ship as Forge-composed scrolling worlds (640×360 native → 1920×1080, 960×540 viewport with following camera); art, audio, UI, portraits, and quest economy overhauled against a measurable late-90s benchmark. Everything below describes **shipped, verified behavior** — not intent.

## Live Runtime Baseline

| Area | Current Standard |
|------|------------------|
| World | 5 locations, each a 1920×1080 scrolling world; `CameraSystem` (deadzone 160×90, lookahead, shake API) |
| Plates | Forge-composed from layout JSON (`src/data/plate-layouts/`), 640×360 native ×3, deterministic, byte-compared in CI |
| Collision | Walkmask-authoritative (R=walkable, G=surface type → footstep SFX); per-axis slide |
| Depth | `worldDepth(y)` from `src/phaser/core/depth.ts`, world-height aware; walk-behind via relit fg overlays (0.00% plate mismatch) |
| Palette | 50-colour hue-shifted canon (`tools/forge/palette.cjs`), ≤40/screen, 0% off-palette CI-gated |
| Time of day | Per-index LUT relighting + baked light pools on painted practicals; characters tinted from the same LUTs; no runtime multiply tints on forge plates |
| Portraits | 15 seeded unique faces, 80×80 native ×3 = 240×240; uniqueness gate IoU <0.85 |
| Audio | 7 composed 60–90s Renaissance-Gamelan loops (Ogg), 16 ambient beds, 13 SFX; offline-synthesized, deterministic, decode-verified |
| UI | Native-res parchment/hardwood/brass 9-slice kit ×3; 240px dialogue portraits; no 1px features, no gradients, no AA |
| Quests | Merchant's Seal: all 4 paths completable incl. pay (525 cruzados raisable, farm-proof, simulation-tested); day-4 silk deadline; quest-reactive greetings on 6 principals |
| Content | 198 painted-prop examine hotspots + 27 authored prop texts + 55 lore objects; journal renders quest narration; all dialogue topics reachable (paging) |
| Data | Single source per location: `src/data/locations/<id>.location.json` (native px) + layout JSON; validators assert bounds + feet-level walkability incl. inbound spawns |
| Tests/CI | vitest, 127 tests; pretest/prebuild gates: location data, canon membership + byte-determinism, style |

## Architecture Notes

- **The Forge** (`tools/forge/`): `compose-plate.cjs` renders plate + walkmask + fg overlays + derived engine data from one layout file — plate and data cannot disagree. `relight.cjs`/`relight-plates.cjs` produce all ToD variants from day masters via palette LUTs. `install-plate.cjs` is the staging→shipping one-way door; `stage4-handedits.cjs` re-applies hand-authored anchors after any re-render.
- Kits: `arch-portuguese`, `arch-dock`, `arch-malay`, `arch-fortress`, `arch-church`, `nature`, `props` — all deterministic, canon-only.
- Whole-scene AI generation is retired. Canva may only ever supply small texture swatches, captured once and versioned.
- `GameScene.ts` remains a god object (~4k lines) — decomposition into 13 systems is the next engine milestone.

## Known limitations / next (v0.12 candidates)

1. **Stage 5 — living world**: NPCs still teleport between schedule stations (generalize the follower breadcrumb into WalkToBehavior + A* over walkmasks); no mouse input; no openables; theft path lacks guard-patrol stakes; A Famosa crowd respawn pacing reads sparse.
2. **Stage 6 — juice/polish**: PostFX pipeline (replace ~15 blend rects); pixel contact-shadow sprites (currently AA ellipses); palette-cycled water/torches; ambient fauna; Forge title panorama (title/loading use interim cards + scrim workaround); 27 item icons still legacy-allowlisted; portrait polish list (morion, tudung, torso dashes); St. Paul's graveyard/plaza ground seam.
3. GameScene decomposition + interaction wiring for the 6 `interactive: true` plateProps.
4. `TOOLCHAIN-MIGRATION-STATUS-2026-07-30.md` — open P1 from a prior session (Node 20/24 lane validation never run).

## Verification State

```bash
npm test                 # 127/127 (vitest)
npm run build            # green
npm run validate:all     # location data + canon (84+ plates byte-compared) + style
npm run generate:audio   # regenerate audio deterministically
npm run generate:portraits  # regenerate portraits (gated)
```

In-engine: 12-edge transition walk-test across all 5 locations (10 traverse, 2 correctly gated); per-location day/dusk/night screenshots with baked pools; walk-behind occlusion verified.

## Release History

### `v0.11.0` — The Forge Overhaul (2026-08-01)
See `docs/RELEASE_NOTES_v0.11.0.md` and `CHANGELOG.md`. Multi-agent overhaul: scrolling world, Forge pipeline, LUT relighting, portraits, real audio, UI kit, real economy, 20-item benchmark spec.

### `v0.10.0` — Graphics Cohesion and Walkable Plates (2026-06-07)
Painted-plate mode for all 5 locations, pixelated to the sprite grid; pixel spawns/collision/transitions; docs overhauled.

(Earlier releases: see CHANGELOG.md.)
