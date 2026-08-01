# Release Notes — v0.11.0 "The Forge Overhaul"

**Date:** 2026-08-01
**Branch:** `graphics-overhaul-local`

The largest single release in the project's history: a ground-up overhaul of art production, rendering, audio, UI, and content depth, executed by a coordinated multi-agent team against a measurable late-90s benchmark (a 20-item per-screen acceptance checklist derived from sourced research on Ultima VII/VIII, Commandos, Baldur's Gate, and Fallout 2 — see the plan's benchmark spec).

## Headlines

- **A scrolling world.** All five locations are now Forge-composed 640×360-native plates in a 1920×1080 world with a following camera (deadzone + lookahead) — four times the playable area per location. The world finally extends past the frame.
- **The Melaka Forge.** A fully local, deterministic art pipeline (`tools/forge/`): one layout JSON per location renders the plate, the walk mask, the walk-behind overlays, and the engine data (spawns/collision/lights/props) in a single pass. Whole-scene AI generation is retired permanently; the coordinate-drift class of bug is structurally dead — plate and data can no longer disagree.
- **Night is night.** A 50-colour hue-shifted palette canon with per-index LUT relighting replaces multiply tints. Nights are value-compressed blue with warm lantern pools baked on actual light sources; characters tint from the same LUTs as the plates.
- **Real music.** Seven composed 60–90s Renaissance-Gamelan pieces (Karplus-Strong strings, ombak-beating metallophones, church-bell partials), 16 ambient beds, 13 SFX — all synthesized offline in pure Node, deterministic, loop-seam-verified, browser-decode-verified.
- **Fourteen faces.** The portrait system generates genuinely distinct characters (seeded skulls/features/costume; pairwise silhouette overlap capped at 0.82 vs the old set's 0.96+). Rudra Mudaliar — previously mute, broken, and wearing another man's portrait — has his own face and voice.
- **A real economy.** The "pay the debt" quest path is now genuinely completable: 525 cruzados raisable from an empty purse through in-voice work contracts, a pepper flip, and a letter of credit — with farm-proof payouts and a simulation test proving reachability. A day-4 shipping deadline makes the clock matter.
- **Period UI.** All chrome rebuilt at native resolution ×3: aged parchment, tropical hardwood, tarnished brass; 240×240 dialogue portraits; title/loading/credits reskinned. Zero 1px hairlines, zero gradients, zero anti-aliasing.

## By the numbers

| Metric | v0.10.0 | v0.11.0 |
|---|---|---|
| Playable area per location | 700×330 px effective | 1920×1080 scrolling |
| Props per plate | 6–7 | 54–105 (13–83 examinable) |
| Walkable/blocked boundary contrast (≥25% clearing) | ~12% | 45–51% |
| Overlay/plate pixel mismatch | — | 0.00% |
| Music | 5-second stubs (failed to decode) | 7 composed 60–90s loops |
| Portrait silhouette overlap (worst pair) | ≥95.6% | 82.1% |
| Tests | 58 | 127 |
| Colours (canon) | 184 value-slides | 50 hue-shifted, ≤40/screen |
| Off-palette pixels | — | 0%, CI-gated, byte-deterministic |

## Engine

- `CameraSystem` (follow, deadzone 160×90, velocity lookahead, shake API) with pure tested math; legacy-size locations render pixel-identically.
- Walkmask-authoritative collision with per-axis slide; surface-type channel drives footstep SFX.
- Walk-behind foreground overlays, relit per time-of-day through the plate LUT (0.00% mismatch).
- Unified per-location data (`src/data/locations/*.location.json`, native-px) with validators asserting every coordinate in-bounds and every spawn/transition walkable at feet level.
- Notable bugs fixed: camera bounds==canvas no-op; crowd paths rendering below the visible screen; ~40% of night lights off-canvas; 18 lore objects silently dropped; scene-transition cleanup crash; hourly NPC-recreate tint bug; worldDepth clamp killing walk-behind; 3× oversized player physics body; audio tween race freezing crossfades; texture-key/file-stem skew shipping a stale plate under green validators; journal never rendering quest narration; dialogue topics beyond nine unreachable.

## Content

- Four thin NPCs raised to ~480 words each in established voices; Rashid rewritten with dignity (−71% exclamations, one weighted family beat).
- 27 painted-prop examine texts to the historical-objects standard, plus 198 plate-prop hotspots wired (83 on Rua Direita alone).
- Quest-reactive greetings and post-quest topics on all six principals; the silk deadline closes the diplomatic path on day 4 (payment path deliberately deadline-free — the quest can never softlock).

## Production notes

- All art and audio generated locally by Claude-built deterministic tools; no external image/audio generation APIs. Canva remains only as a one-time texture-swatch source, never for whole scenes.
- CI gates: canon membership (0 tolerance), 3px block uniformity, zero AA alpha, relight provenance (LUT(day)==shipped variant, byte-compared across 84+ plates), generator determinism (double-render byte-identical), portrait uniqueness, location-data bounds/walkability.

## Known residuals (tracked for v0.12)

- Stage 5 scope: NPCs still teleport between schedule stations (walk-to behavior pending); mouse input pending; openables pending; guard-patrol stakes on the theft path pending.
- Stage 6 scope: PostFX pipeline, pixel contact-shadow sprites (currently AA ellipses), palette-cycled water/torches, ambient fauna, Forge title panorama (title screens use interim cards), 27 item icons still legacy, portrait polish list.
- A Famosa crowd pacing reads sparse (respawn tick tuning); GameScene decomposition (13 systems) deferred to Stage 4 engine track.
