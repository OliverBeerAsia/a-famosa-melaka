# Project Status: A Famosa - Streets of Golden Melaka

## Current Status

- Date: August 2, 2026
- Release: `v0.12.0` — "The Living City"
- Overall read: all five locations are Forge-composed scrolling worlds populated by NPCs who keep real daily schedules, ambient residents, fauna, and a night watch; a single PostFX pipeline, desynced ambient animation, feedback events, and animated water carry the game feel; typography, history, and prop scale are machine-gated. Everything below describes **shipped, verified behavior** — not intent.

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
| World life | 14 NPCs on hour-by-hour walked schedules; 15 residents w/ barks; fauna tier 1; night-watch patrol w/ light-based detection; 14 openables; crowd steady-state 5-16 on screen at midday |
| Game feel | MelakaPostFX pipeline + grade LUTs (anti-double-grade gate); phase-desynced ambient animation; 21-event feedback table; practical flicker; dust/cloth/creak; animated dusk-bronze water |
| Typography | Two pixel-native faces (Press Start 2P / VT323) on integer grids, self-hosted; standard applied to React + Phaser |
| Tests/CI | vitest, 406 tests; gates: location data, canon + byte-determinism, style, grade-LUT drift, SFX key existence, prop-ruler scale |

## Architecture Notes

- **The Forge** (`tools/forge/`): `compose-plate.cjs` renders plate + walkmask + fg overlays + derived engine data from one layout file — plate and data cannot disagree. `relight.cjs`/`relight-plates.cjs` produce all ToD variants from day masters via palette LUTs. `install-plate.cjs` is the staging→shipping one-way door; `stage4-handedits.cjs` re-applies hand-authored anchors after any re-render.
- Kits: `arch-portuguese`, `arch-dock`, `arch-malay`, `arch-fortress`, `arch-church`, `nature`, `props` — all deterministic, canon-only.
- Whole-scene AI generation is retired. Canva may only ever supply small texture swatches, captured once and versioned.
- `GameScene.ts` is a 728-line orchestrator over 14 systems (src/phaser/systems/) with pure tested core modules (src/phaser/core/); residents/openables/crowd-pacing live in compositor-proof data files merged by LocationData.

## Known limitations / next (v0.13 candidates)

1. Mouse input (hover highlight, click-to-move over the walkmasks) and enterable interiors.
2. Contact-metric gate revision (#17 currently counts prop-body pixels; the honest route to the 60% bar) and a CI boot smoke test (406 green unit tests once coexisted with a no-boot tree).
3. aoZones/canopyShadows plate bake (engine no longer reads them); water regions to texture:water so the cycle animates the base surface natively; fauna tier 2 (kelip-kelip fireflies, ripples, wet footprints).
4. Rudra Mudaliar still borrows Rashid 16x32 sheet (own portrait shipped; own sheet pending) — more visible now that schedules station him 400px from Rashid daily.
5. Door-sound vocabulary (shutter-bar, curtain, church-door...) — data hooks exist, cues pending in generate-audio.
6. Customs-spine quests (Pirates on the Horizon rebuild) to the main quest standard; TOOLCHAIN-MIGRATION P1 from 2026-07-30 still unvalidated.

## Verification State

```bash
npm test                 # 406/406 (vitest)
npm run build            # green
npm run validate:all     # location data + canon (84+ plates byte-compared) + style
npm run generate:audio   # regenerate audio deterministically
npm run generate:portraits  # regenerate portraits (gated)
```

In-engine: 12-edge transition walk-test across all 5 locations (10 traverse, 2 correctly gated); per-location day/dusk/night screenshots with baked pools; walk-behind occlusion verified.

## Release History

### `v0.12.0` — The Living City (2026-08-02)
See `docs/RELEASE_NOTES_v0.12.0.md`. Living world (schedules/residents/night watch/openables), juice wave (PostFX/desync/feedback/flicker/water/fauna), engine decomposition, typography standard, 1580 historical audit, art consistency passes.

### `v0.11.0` — The Forge Overhaul (2026-08-01)
See `docs/RELEASE_NOTES_v0.11.0.md` and `CHANGELOG.md`. Multi-agent overhaul: scrolling world, Forge pipeline, LUT relighting, portraits, real audio, UI kit, real economy, 20-item benchmark spec.

### `v0.10.0` — Graphics Cohesion and Walkable Plates (2026-06-07)
Painted-plate mode for all 5 locations, pixelated to the sprite grid; pixel spawns/collision/transitions; docs overhauled.

(Earlier releases: see CHANGELOG.md.)
