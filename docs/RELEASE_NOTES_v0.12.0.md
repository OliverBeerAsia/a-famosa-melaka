# Release Notes — v0.12.0 "The Living City"

**Date:** 2026-08-02 (draft — finalize at tag time)
**Branch:** `graphics-overhaul-local`

Where v0.11.0 rebuilt Melaka's streets, v0.12.0 moves people, light, and weather into them. This is the release where the city stops posing for a painting and starts going about its day.

## Headlines

- **People live here now.** All fourteen named characters keep real daily schedules — they walk to work, tend their stalls, pray, eat, and head home at dusk instead of teleporting on the hour. Fifteen unnamed residents share the streets with them, chickens scatter in the kampung, and a village dog naps by the well.
- **The night watch is real.** The counting-house break-in is an actual scene: a guard walks an 18-waypoint patrol, lantern light genuinely matters (douse one and the shadows are yours), and getting caught has consequences short of a game over. Two failures close the theft path — the debt can still be paid honestly.
- **Light behaves like light.** A single post-processing pipeline replaced fifteen stacked screen tints: per-location color grades, night lanterns that flicker out of phase with each other, warm bronze dusk water that actually moves, and film grain that respects the pixel grid at 8 frames a second, the way late-90s plates did.
- **The world answers you.** Dust rises where you walk on dirt (and where the crowd walks, at a quarter rate), awnings sway as you brush past, pier boards creak underfoot, coins burst from payouts in proportion to the sum, and the journal quill scratches when your quest advances even if the book is closed.
- **Everything you read is readable.** Two pixel-native typefaces on measured integer grids replaced the previous font free-for-all; the fonts ship inside the game, so offline builds can never regress to system serifs.
- **1580 means 1580.** A historian's audit put the year back into the world: the church carries its Jesuit name (St. Paul's is what the Dutch will call it in 61 years), Rodrigues remembers the actual sieges of the 1570s, there is — correctly — no king in Lisbon this year, and the colonial economy's hardest truths are no longer politely absent.

## By the numbers (draft — refresh at tag)

| Metric | v0.11.0 | v0.12.0 |
|---|---|---|
| Tests | 127 | 406+ |
| GameScene | 4,060 lines | 728-line orchestrator + 14 tested systems |
| Screen-space FX objects | ~15 blend rects + 9 perpetual tweens | 1 pipeline, 0 tweens |
| Animation phase sync (benchmark item 9) | 100% lockstep | 0% on all major families |
| Walkable-boundary contrast (#17 strict) | 12% clearing | 45–55% |
| Item icons | 27 legacy blurs | 27 canon redraws at true native |
| Fonts | CDN, system fallbacks | self-hosted, 23KB, integer grids |

## Engine

- GameScene decomposed into Time/Audio/Lighting/Atmosphere/Backdrop/Interaction/NPC/WorldObject/Transition/QuestTrigger/Player/VisualQuality/UIBridge systems over pure, unit-tested core modules; pure-move discipline verified by invariant entity counts.
- A* pathfinding over the walkmasks; the Siti follower generalized into reusable Follow/WalkTo behaviors.
- Quest hotspots moved to data (`quest-hotspots.json`, native coordinates, stage- and hour-gated) — and relocated from open water to the actual counting-house door.
- World items and lore objects genuinely grounded (per-texture alpha scan + contact shadows); animated props returned to the world depth band.
- Teardown crashes fixed in two systems (the class that silently broke location transitions).

## Art

- Forge title panorama (dusk harbor) replaces the interim cards on title and loading screens.
- St. Paul's graveyard seam re-cut and kerbed; cart ruts became wandering wheel-track pairs that deepen where carts actually stop; roofs read as tiled courses instead of tartan; laundry lines are real rope with sag.
- Compositor-level contact definition (adaptive polarity) grounds every building on all five plates.
- All 27 item icons redrawn on the canon at true native resolution; portrait polish pass (a real morion, Aminah's tudung, cloth folds instead of scratch highlights); three missing lore sprites drawn.

## Content

- Historical audit applied end to end (22 errors fixed, 4 institutional topics added, slavery addressed honestly through Siti's legal status, Mak Enang's counter-narrative to the conquest myth) — every fix in the cast's own voices.
- ~1,100 words of new dialogue; the Kapitan China's seal now anchors the Chinese community's institutions across three objects and topics.

## Production

- CI gates grew: grade-LUT drift gate (the double-grade can never return), SFX key-existence gate (missing audio fails the build), canon gate now covers UI and item icons. Legacy allowlist down to 4 entries.
- Known follow-ups tracked for v0.13: contact-metric gate revision, CI boot smoke test, aoZones plate bake, water-texture layout switch, fauna tier 2.

_(Living-world specifics — schedules, residents, openables, detection numbers — to be finalized from world-engineer's landing report.)_
