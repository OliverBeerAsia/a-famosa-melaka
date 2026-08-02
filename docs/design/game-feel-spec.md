# Game-Feel Spec — v0.12 "Juice" Pass

**A Famosa: Streets of Golden Melaka** · Stage 6 (engine P5) · written 2026-08-02
Idiom target: Ultima VII palette-cycled fire/water, Baldur's Gate ambient indifference,
Diablo II pickup tactility, Commandos surface response.

> **This document is an implementation order, not a mood board.** Every number here is
> either read out of the repo (cited `file:line` or `data key`) or derived from a cited
> value by a stated rule. The engine wave implements; it does not invent.
> Where I could not derive a number I say so and give a bracket to tune inside.

---

## 0. Ground truth the implementation inherits

| Fact | Value | Source |
|---|---|---|
| Canvas | 960×540, `Phaser.AUTO`, `pixelArt:true`, `roundPixels:true`, `antialias:false` | `src/phaser/game.ts:13,34-40` |
| World | 640×360 native × `world.scale` 3 = **1920×1080** | `*.location.json` `world`, `plate.camera:"scrolling"` |
| Sprite scale | `CHARACTER_SCALE = 3` (16×32 native → 48×96) | `src/phaser/game.ts:23` |
| Depth bands | world 0–780 (`worldDepth(y)` scales 1080→780), FX 800–1000, UI ≥1001 | `src/phaser/core/depth.ts:24-35,63-84` |
| Palette | **50-colour canon**, indices 0–49, derived from ramp specs | `tools/forge/palette.cjs` |
| Plates | Forge-composed, `authoringBasis:"forge-compositor"`, ToD **baked** into dawn/dusk/night variants | `plate.variants`, `GameScene.ts:857-863` |
| Practicals | Night/dusk light pools are **baked into the plate**; runtime additive glows are disabled for forge plates | `GameScene.ts:1682-1692` |
| Character relight | Per-ToD tint from the *same* LUTs that bake plates: day `null`/1.0, dawn `#B0C5F6`/0.833, dusk `#DCAA91`/0.785, night `#455A99`/0.413 | `src/data/relight-runtime.json` |
| Walk mask | `<id>-walk.png`, R = walkable, **G = surface id** `none0 stone1 dirt2 wood3 sand4 water5 grass6 tile7` | `src/phaser/core/WalkMask.ts:19-46` |
| Camera shake API | `CameraSystem.shake(intensity /*viewport fraction*/, duration)` | `src/phaser/systems/CameraSystem.ts:115-120` |
| Shipped SFX | 13 loaded keys (below) + 16 ambience beds + 7 music tracks, all locally synthesised & deterministic | `BootScene.ts:254-268`, `assets/audio/MANIFEST.json` |
| Particle art | `dust 12×4`, `fire 16×8`, `fireflies 8×4`, `mist 64×8`, `rain 2×8`, `smoke 24×8`, `splash 8×8` (native px, frame-strips) | `assets/sprites/particles/` |

**Surface-id census** (from the shipped walkmasks — these are the budgets for §5):

| Location | walkable % | stone(1) | dirt(2) | wood(3) | sand(4) | water(5) | grass(6) |
|---|---|---|---|---|---|---|---|
| a-famosa-gate | 39.3 | 49 216 | 50 688 | — | — | — | — |
| rua-direita | 50.0 | 132 297 | 27 703 | — | — | — | — |
| st-pauls-church | 54.1 | 50 160 | 34 560 | — | — | — | 48 400 |
| waterfront | 36.1 | 52 112 | 37 888 | **3 024** | 4 464 | **82 992** | — |
| kampung | 48.2 | — | 84 296 | — | 41 736 | **6 272** | 57 136 |

Consequence, stated once and used throughout: **dust puffs belong everywhere; board creak
is a 3 024-pixel effect on the waterfront pier only; water response is waterfront + kampung
only; grass response is st-pauls + kampung only.** No effect gets authored for a surface
that does not exist.

### 0.1 Three defects this pass must not paper over

1. **Every animated prop of the same type in a location starts on the same animation
   frame.** `EnvironmentObjectSystem.createAwningFlutter/createPalmSway/createTorchGlow`
   call `sprite.play(key)` with no `startFrame`/delay (`EnvironmentObjectSystem.ts:359,
   400, 246`). Rua Direita has 6 awnings and 3 palms all flapping in lockstep — this is a
   direct, provable failure of **benchmark item 9** ("no same-loop instances in phase").
   The fallback tween paths do randomise, but with `Math.random()` (`:290-292, 337-339,
   377, 412`), which violates the project's determinism norm. §2.4 replaces both.
2. **Animated props are depth-sorted on raw `y`, not `worldDepth(y)`**
   (`EnvironmentObjectSystem.ts:319 setDepth(y-10)`, `:346,358 setDepth(y)`,
   `:392,399 setDepth(y-20)`). In a 1080-tall world any prop below world-y 800 lands
   **inside the FX band** and draws over fog/AO/grade; below 1001 it would draw over UI.
   A-famosa's `palm-sway` at native y 303 → world y 909 is already there. Fix as part of
   this pass: route every animated prop through `worldDepth()`.
3. **The only existing "water shimmer" is off-canon.** `GameScene.createWaterAnimations()`
   (`:1081-1093`) emits ADD particles tinted `0x5DADE2` — a colour that is not in the
   50-colour canon and cannot be, since canon water tops out at `water-4 #78BCB0`. It
   dies in §2.

---

## 1. PostFX consolidation

### 1.1 What exists now (the inventory)

Per location, per frame, the screen-space stack is:

| # | Object | Count | Depth | Blend | Space | Created |
|---|---|---|---|---|---|---|
| 1 | vignette `Graphics` gradient 0.16→0.07 | 1 | −10 | NORMAL | screen | `GameScene.ts:657-662` |
| 2 | AO edge rects (top 1.0, bottom 0.9, sides 0.75 × `aoAlpha`) | 4 | 940 | MULTIPLY | screen | `:1836-1848` |
| 3 | `visual.aoZones` rects | 2–2 | 941 | MULTIPLY | **world** | `:1853-1866` |
| 4 | `visual.canopyShadows` ellipses | 2–3 | 942 | MULTIPLY | **world** | `:1877-1890` |
| 5 | colour-grade SCREEN rect | 1 | 944 | SCREEN | screen | `:1962-1975` |
| 6 | colour-grade MULTIPLY rect | 1 | 945 | MULTIPLY | screen | `:1977-1988` |
| 7 | film-grain `TileSprite` (128px, 2300 random 1px dots) | 1 | 946 | OVERLAY | screen | `:1990-1999` |
| 8 | sun shafts (tweened ellipses, random ±9° angle) | 0–3 | 903+ | SCREEN | **world** | `:1909-1940` |
| 9 | fog layers (tweened ellipses) | 1–3 | 905+ | SCREEN/MULT | screen | `:2033-2087` |
| 10 | `lightingOverlay` rect (`TIME_COLORS`) | 1 | 950 | NORMAL | screen | `:2785-2794` |

**14–20 blend objects.** Three of them are already provably inert on every shipping
location:

- #5/#6 — `updateCinematicForTime()` sets `strength = hasBakedTimeVariant() ? 0 : profile.colorGradeStrength`
  (`:2009-2011`). All five locations ship dawn/dusk/night variants, so the grade is **only
  ever non-zero at `day`**, where it is `multiply 0x6A5A45 @ 0.04×0.62 = 0.025` and
  `screen hazeTint @ 0.035×0.62 = 0.022`. Two full-screen draws for 2.5 % of anything.
- #10 — `TIME_COLORS.day.alpha = 0` (`:205`) and the tint is suppressed on baked variants
  for the same reason. It is a permanently transparent full-screen rectangle.
- #7 — the grain is **1-screen-pixel noise over a 3-screen-pixel image**. It is the
  fourth pixel density on screen; the art evaluation's cohesion complaint, in FX form.

### 1.2 The replacement

**One `MelakaPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline`, registered
once in `game.ts`, attached to `this.cameras.main` in `GameScene.create()`.** Four terms,
in this order, all in one fragment pass:

```
c = texture2D(uMainSampler, uv).rgb;
c = lut(c, uLutTex, uLutWeight);              // 1. grade
c = mix(c, hazeColour, hazeTerm(uv, uTime));  // 2. horizon haze band
c *= vignetteTerm(uv);                        // 3. vignette + edge AO, one function
c += grainTerm(uv, uGrainSeed) * uGrainAmt;   // 4. grain, quantised to the 3px grid
c = mix(c, uFlashColour.rgb, uFlashAmt);      // 5. feedback flash (§3)
```

**Uniforms** (all set from data, none hardcoded in the shader):

| Uniform | Type | Source |
|---|---|---|
| `uLutTex` | sampler2D, 256×16 | `assets/scenes/luts/<loc>-<tod>.png` (§1.4) |
| `uLutWeight` | float | 1.0 always — the LUT itself carries the "near-identity" (see §1.4) |
| `uVigStrength` | float | per-location table §1.3 |
| `uVigPower` | float | 2.4 (fixed; corner falloff exponent) |
| `uGrainAmt` | float | per-location table §1.3, × `1.30` at night, × profile scalar |
| `uGrainSeed` | float | steps at **8 Hz**, not per frame (see §1.5) |
| `uHazeColour` | vec3 | `visual.fogTint` |
| `uHazeAmt`, `uHazeY`, `uHazeSpeed` | float | §1.3 table; `uHazeSpeed` = `visual.fogSpeed` |
| `uFlashColour`, `uFlashAmt` | vec4, float | §3; `uFlashAmt` tweened 0→a→0 |

### 1.3 Per-location numbers

Derivation rule for **vignette**: the old stack's corner darkening was
`vignetteGradient(0.16) + edgeAO(aoAlpha × 1.0 top / 0.75 side) + aoZone(top-band alpha)`.
Summing at the `high` profile (`aoAlpha 0.18`) and rounding to 0.02:

| Location | `aoZones` α (top / mid) | `canopyShadows` α | **uVigStrength** | **uGrainAmt** | `uHazeColour` (=`fogTint`) | `uHazeAmt` | `uHazeY` (uv) | `uHazeSpeed` (=`fogSpeed`) |
|---|---|---|---|---|---|---|---|---|
| a-famosa-gate | 0.20 / 0.18 | 0.16, 0.12 | **0.34** | **0.026** | `0xB8B4CB` (12101515) | 0.10 | 0.62 | 0.45 |
| rua-direita | 0.18 / 0.14 | 0.11, 0.11, 0.08 | **0.28** | **0.024** | `0xC8B4CE` (13153422) | 0.08 | 0.60 | 0.38 |
| st-pauls-church | 0.20 / 0.16 | 0.12, 0.10 | **0.26** | **0.022** | `0xD5C4EA` (14010026) | 0.07 | 0.55 | 0.30 |
| waterfront | 0.15 / 0.18 | 0.08, 0.08 | **0.22** | **0.020** | `0x9FB4C8` (10467528) | 0.13 | 0.58 | 0.60 |
| kampung | 0.18 / 0.15 | 0.16, 0.15, 0.09 | **0.32** | **0.028** | `0xA8B0DA` (11059354) | 0.11 | 0.64 | 0.50 |

`uVigStrength` is the darkening at the extreme corner; edge midpoints get
`strength × 0.42`. St Paul's is deliberately *below* its summed old value: it is the
open-hilltop frame and the old edge rects were flattening its sky.

**Quality-profile scalars** (replace the individual `aoAlpha/grainAlpha/sunShaft*`
fields in `visualProfile.ts`, keep `fogLayers`→`uHazeAmt` scalar):

| Profile | vignette × | grain × | haze × | flash × |
|---|---|---|---|---|
| high | 1.00 | 1.00 | 1.00 | 1.0 |
| balanced | 0.90 | 0.80 | 0.75 | 1.0 |
| low | 0.70 | 0.00 | 0.30 | 1.0 |

Feedback flash is never quality-scaled — it is game information, not decoration.

### 1.4 The colour-grade LUT recipe

The plates already carry their time-of-day, baked by `tools/forge/relight.cjs` from
`docs/art-bible/forge/relight-luts.json`. **So the runtime LUT must be near-identity, and
its job is *location character*, not time of day.** Anything stronger re-creates the
double-grade bug the project already paid to remove.

New tool: **`tools/forge/grade-lut.cjs`** → `assets/scenes/luts/<loc>-<tod>.png`,
20 files, **256×16 px unwrapped 16³ RGB LUT** (16 slices of 16×16, blue advancing left to
right — the standard strip layout; ~2 KB each PNG, all 20 = ~40 KB).

Generation, per (location, tod), for each of the 4096 lattice colours `c`:

```
1. haze pull      c = mix(c, hazeTint,      HAZE_PULL[tod]  * lumaWeight(c))
                  hazeTint = visual.hazeTint         // a-famosa 0xE4C4D3(14993043),
                                                     // rua 0xE9C6DF, st-pauls 0xE5DFF5,
                                                     // waterfront 0xCDDCDE, kampung 0xD4CFAE
                  lumaWeight(c) = smoothstep(0.45, 1.0, luma(c))   // sky/highlights only
2. shadow anchor  c = mix(c, #181830,       SHADOW_PULL[tod] * (1 - smoothstep(0.0,0.35,luma(c))))
                                                     // palette.cjs SHADOW_ANCHOR_HEX — the
                                                     // one shadow every canon ramp leans into
3. tod trim       c = c * TINT[tod]                   // from relight-runtime.json, see below
4. saturation     c = mix(luma(c), c, SAT[tod])
5. transition hue c = mix(c, c + visual.transitionTint/255 * 0.5, LOC_HUE)  // LOC_HUE = 0.06
6. snap           quantise each channel to 1/255, clamp
```

`TINT[tod]` is `relight-runtime.json.times[tod].tintHex` **de-weighted to the residual the
plate does not already carry**, i.e. `mix(#FFFFFF, tintHex, RESID[tod])`:

| tod | `tintHex` (cited) | `lumaRatio` (cited) | `RESID` | `HAZE_PULL` | `SHADOW_PULL` | `SAT` |
|---|---|---|---|---|---|---|
| day | `#FFFFFF` | 1.000 | 0.00 | 0.10 | 0.06 | 1.04 |
| dawn | `#B0C5F6` | 0.833 | 0.10 | 0.14 | 0.08 | 0.98 |
| dusk | `#DCAA91` | 0.785 | 0.12 | 0.16 | 0.08 | 1.06 |
| night | `#455A99` | 0.413 | 0.08 | 0.06 | 0.14 | 0.92 |

`transitionTint` per location, cited for step 5: a-famosa `[40,30,20]`, rua-direita
`[50,40,10]`, st-pauls `[30,30,40]`, waterfront `[10,30,50]`, kampung `[10,40,15]`.
These are already the authored "what colour is this place" vector; step 5 is the only
term that makes waterfront read cooler than kampung at the same hour.

**Acceptance gate for the LUT** (add to `tools/validate-style.cjs`): applying
`<loc>-day.png` to the shipped day plate must move **no canon colour more than 10/255 in
any channel** and must leave ≥ 92 % of pixels still nearest-matching their original canon
index. If it fails, the LUT is grading, not trimming, and the double-grade has returned.

### 1.5 Grain, specifically

The grain must obey the pixel grid or it re-introduces the fourth density.

```glsl
vec2 cell = floor(gl_FragCoord.xy / 3.0);        // the 3× sprite/plate grid
float n = hash(cell + uGrainSeed);               // one value per 3×3 screen block
c += (n - 0.5) * uGrainAmt;                      // luma-only, symmetric
```

`uGrainSeed` advances **8 times a second** (`Math.floor(time / 125)`), not every frame.
Late-90s plates did not fizz at 60 Hz, and 8 Hz reads as film/heat rather than video noise.
At `uGrainAmt 0.020–0.028` the swing is ±3–4/255 — visible in flats, invisible on detail.

### 1.6 WebGL guard and canvas fallback

```ts
const webgl = this.game.renderer.type === Phaser.WEBGL;
if (webgl) { this.cameras.main.setPostPipeline(MelakaPostFX); ... }
else       { this.createCanvasFallbackFX(); }
```

`Phaser.AUTO` (`game.ts:33`) can and does select Canvas (blocklisted GPUs, some Linux/VM
setups, `--disable-gpu`). Fallback = **exactly two objects, no per-frame work**:

1. the existing vignette `Graphics` (`GameScene.ts:658`) re-authored with corner alpha
   `uVigStrength` and edge alpha `uVigStrength × 0.42`, moved to depth **999**;
2. **one** `Rectangle`, MULTIPLY, depth 998, filled with the LUT's own mapping of
   mid-grey `#808080` (read from the LUT PNG at generation time and written into
   `assets/scenes/luts/fallback.json` as `{ "<loc>-<tod>": "#RRGGBB", ... }`) at alpha
   `0.35`. This is a flat approximation of the grade and is the honest limit of canvas.

Haze, grain and flash are **off** in canvas. Flash degrades to a 120 ms alpha tween on the
fallback rect (colour swapped, then restored) so feedback is never lost. Feature flag
`?fx=off` forces the fallback for A/B screenshots.

### 1.7 What dies entirely

| Dies | Why | Where it goes |
|---|---|---|
| `createAOOverlays()` — 4 edge rects | screen-space vignette by another name | shader `vignetteTerm` |
| `visual.aoZones` runtime rects (2/loc) | world-anchored darkening of a plate the compositor already shades (`layout.shade`) | **bake into the plate**: move each zone into the layout's `shade` block, re-render, delete the runtime path and the `aoZones` key |
| `visual.canopyShadows` runtime ellipses (2–3/loc) | same — a canopy shadow belongs to the painting | **bake into the plate** `shade` block; delete key |
| `createSunShafts()` + tweens (0–3/loc) | anti-aliased vector ellipses at random angles over pixel art; the single most "not pixel art" object on screen | **bake** a hard-edged 2:1-consistent shaft into the plate's `shade` pass where the layout wants one; no runtime equivalent |
| `colorGradeMultiplyOverlay` + `colorGradeScreenOverlay` | inert on 4/5 ToD; 2.5 % at day | shader LUT (§1.4) |
| `filmGrainOverlay` `TileSprite` + `createFilmGrainTexture()` (2300 `Phaser.Math.Between` calls at boot) | wrong pixel density, non-deterministic | shader `grainTerm` |
| `lightingOverlay` rect + `TIME_COLORS` table | permanently transparent on forge plates | delete both |
| `fogLayers` ellipses + tweens (1–3/loc) | vector ellipses; drift is cheaper as a uv offset | shader `hazeTerm` |
| `createWaterAnimations()` / `waterEmitter` | off-canon `0x5DADE2` ADD particles | **§2 palette cycling** |
| `visualProfile` fields `aoAlpha`, `grainAlpha`, `sunShaftCount`, `sunShaftAlpha`, `canopyShadowAlpha`, `colorGradeStrength`, `fogLayers`, `fogBaseAlpha` | superseded | replaced by the 4 scalars in §1.3 |

**Net: 14–20 blend objects and ~9 perpetual tweens → 1 pipeline + 0 tweens** (canvas: 2
static objects). Surviving non-shader FX: `mistEmitter`, `dustEmitter`, `heatHazeEmitter`,
`fireEmitters`, `fireflyEmitter` — those are particles, not screen grades, and they stay.

---

## 2. Palette cycling

Benchmark technique 3: *palette cycling for water/torch ambient motion (U7 100 ms
rotation, BG water was colour-cycling alone) — near-zero cost.* Benchmark item 9:
*no same-loop instances in phase; periods 0.8–3.0 s, random offsets.*

### 2.1 The constraint, stated honestly

Our plates ship as **RGBA composites with the ToD and the practicals already baked in**
(`GameScene.ts:1682-1692`). No index map is emitted by `compose-plate.cjs`. So classic
in-place index rotation is not available at runtime, and a shader that colour-matches
50 canon colours per pixel is both fragile and pointless when we control the bake.

**Therefore: cycle offline, swap at runtime.** All cycling is pre-rendered by the Forge
into phase frames, in canon colours, *after* the ToD LUT — so the cycled colours are
post-LUT by construction and the four variants are handled by generating four sets. This
is exactly what U7 did in effect (a small set of palette states presented in sequence)
and it costs one texture swap per period tick.

### 2.2 (a) Water shimmer — cycle strips

`compose-plate.cjs --cycle` gains an output stage. For every ground poly with
`material:"water"` it emits, per ToD:

```
assets/scenes/cycle/<id>-<tod>-water-<n>.png     n = 0..N-1
assets/scenes/cycle/<id>-water.json              { bbox:{x,y,w,h}, frames:N, periodMs, order:[...] }
```

Each frame re-evaluates `tools/forge/texture.cjs water()` (`:465-546`) with the wave-band
phase advanced — concretely, `bandF` (`:492`) gains `+ n/N` and the glitter hash
(`:534-540`) gains `seed + n*101`. Sky-reflection ramp, current patches and shallows are
**unchanged between frames**: only crest/trough banding and glitter move. That is the
difference between water shimmering and water boiling.

Only the water bbox is written, not the whole plate.

| Location | water region | source | bbox (native, to be emitted) | **N frames** | **period** | **ms/frame** | phase offset |
|---|---|---|---|---|---|---|---|
| waterfront | `backdrop` + ground poly `basin` (`material:"water"`, `surface:"water"`, `walkable:false`) | `plate-layouts/waterfront.json` | y ∈ [`horizon.skyTo` 76, first non-water ground row]; x full 640 — **~640×150** | **8** | **2400 ms** | 300 | 0 |
| kampung | ground poly `river` (`sFrom 41.5 → sTo 49`, `ddFrom −22 → −6`) | `plate-layouts/kampung.json` | iso-projected bbox of that poly — ~180×70 | **6** | **1800 ms** | 300 | **+700 ms** |

Both periods sit inside the 0.8–3.0 s band. The kampung offset guarantees that if the two
are ever on screen together (they are not, but the rule is the rule) they never tick
together. **a-famosa-gate, rua-direita and st-pauls-church have no `material:"water"` poly
in their layouts and get no water cycle** — st Paul's background is hills + rooflines
(`background` = 4 hills, 3 distant-rooflines, 2 towers), not sea. Do not invent one.

Post-LUT water ramp, cited from `docs/art-bible/forge/relight-luts.json → times[tod].variants.base`,
so the implementer can eyeball a frame and confirm the bake is right:

| canon idx | name | day | dawn | dusk | night |
|---|---|---|---|---|---|
| 25 | water-0 | `#10142C` | `#373E55` | `#66402F` | `#0E1220` |
| 26 | water-1 | `#0C284C` | `#37465D` | `#765237` | `#0F1627` |
| 27 | water-2 | `#185470` | `#40566A` | `#956D41` | `#152032` |
| 28 | water-3 | `#3C8C94` | `#4F6778` | `#C6924F` | `#202F41` |
| 29 | water-4 | `#78BCB0` | `#627581` | `#F8AE57` | `#32404E` |
| 49 | sun-specular | `#FFF4D4` | `#FFF9D9` | `#FFEBC4` | `#F8EED2` |

Note dusk water is a **warm bronze ramp**, not blue — the crest highlights at dusk must
come from 28→29 (`#C6924F`→`#F8AE57`), never from a blue tint. This is precisely the
"dusk water turns grey" defect the art evaluation logged, already fixed in the bake; the
cycle must not undo it.

**Runtime** (`WaterCycleSystem`, ~60 lines):
- one `Phaser.GameObjects.Image` per cycle region, positioned at `bbox × world.scale`,
  `setDepth(-19)` (the plate sits at −21/−20, see `placePlate`), `scrollFactor 1`;
- a single `time.addEvent({ delay: msPerFrame, loop: true })` per region advances
  `setTexture(<id>-<tod>-water-<n>)`;
- on ToD change, swap the key prefix and keep the frame index (no visible reset);
- `visualProfile.low` → freeze on frame 0 (static, still correct, zero ticks).

**Budget:** waterfront ≈ 640×150×4 B × 8 frames × 4 ToD ≈ 12 MB decoded / ~0.3–0.5 MB as
PNG; kampung ~0.05 MB. If decoded VRAM is a concern on low, load only the current ToD's
frames and lazily fetch on transition — the boot loader already staggers by group.

### 2.3 (c) Title panorama harbour

`assets/scenes/opening-screen.png` is **960×540** and is drawn by React as a CSS
`backgroundImage` (`TitleScreen.tsx:17,73`), *not* by Phaser. So the title cycle is a DOM
effect:

- Forge emits `opening-screen-water-0..5.png` — **6 frames, harbour band bbox only**,
  same `water()` phase advance, at the title's day grade.
- `TitleScreen.tsx` renders one absolutely-positioned `<div>` per frame over the base
  image at the bbox rect, `image-rendering: pixelated`, `opacity` driven by a single
  `requestAnimationFrame` tick that flips index every **433 ms (period 2600 ms)**. No
  cross-fade — a fade would blend canon colours into off-canon intermediates.
- A **second, independent** element: 3 lit-window frames on the town silhouette,
  period **3000 ms**, start offset **+900 ms** (never coincident with the water tick).
- `@media (prefers-reduced-motion: reduce)` → freeze both on frame 0.

Blocked on the new title panorama landing (open task #19). If the panorama slips, the
title cycle slips with it — it is in the v0.13 column for that reason (§6).

### 2.4 (b) Practicals — flicker cycling on canon indices

Night/dusk light pools are baked into the plate, so we cannot rotate their palette in
place. What we *can* do, and what actually reads, is cycle a **small additive flicker
delta** sitting on top of each baked pool.

**Art request (Forge, `tools/forge/kits/` — 4 sprites, day one):** a radial pool sprite
per light radius class, hard-edged with a 2-px ordered-dither ring (no AA), drawn in
canon colours only, in **3 palette states** each:

| state | core | mid | ring | canon indices |
|---|---|---|---|---|
| A (hot) | `#FFF4D4` | `#F5C860` | `#D8A428` | 49 → 48 → 47 |
| B (base) | `#F5C860` | `#D8A428` | `#B47844` | 48 → 47 → 8 |
| C (low) | `#D8A428` | `#B47844` | `#844020` | 47 → 8 → 7 |

Radius classes, taken from the actual `lights[].radius` values in the location data
(34, 36, 38, 40, 42, 46, 48, 50, 52, 54, 58) → four sheets at native radii **34, 42, 50, 58**,
nearest-class assignment. Sheet layout: `flame-pool-<r>.png`, 3 frames side by side,
frame size `2r × 2r` native.

**Cycle rules per light type** (`type` is already in the data):

| type | period | states in order | Δalpha | Δradius | count in shipping data |
|---|---|---|---|---|---|
| `torch` | **900 ms** | B A B C | ±0.05 | ±1 native px | `animatedProps` type `torch`: a-famosa 2, rua 2, st-pauls 1 |
| `cookingFire` | **1200 ms** | B A C B A | ±0.07 | ±2 native px | a-famosa 2, rua 3, st-pauls 2, waterfront 1, kampung 4 |
| `lantern` | **1600 ms** | B A B | ±0.03 | 0 | a-famosa 9, rua 10, st-pauls 6, waterfront 7, kampung 1 |
| `window` | **3000 ms** | B B A (a room behind glass, near-steady) | ±0.02 | 0 | a-famosa 2, rua 4, st-pauls 4, waterfront 1, kampung 3 |

Totals in `lights[]`: a-famosa 13, rua-direita 17, st-pauls 12, waterfront 9, kampung 8
= **59 authored practicals**. A `torch` animated prop and a `lantern` light frequently
share coordinates (e.g. rua-direita `278,171` torch over `278,183` lantern) — the flicker
attaches to the **light**, and the torch prop keeps its own sprite animation.

Base alpha over the baked pool: **0.10** (`torch`/`cookingFire`), **0.07** (`lantern`),
**0.05** (`window`), ADD blend, depth `worldDepth(light.y × scale)` so a passing character
occludes correctly, `nightOnly` lights only exist dusk+night (the data flag already says so).

**Phase offsets — the fix for benchmark item 9.** Deterministic, no `Math.random()`:

```ts
// i = index of this instance among same-type instances in this location
const GOLDEN = 0.6180339887498949;
const phase  = period * ((i * GOLDEN) % 1);              // maximal spread, any count
const jitter = 1 + 0.12 * (hash2(x, y) * 2 - 1);         // ±12 % period, position-seeded
const myPeriod = period * jitter;
```

Apply the **same helper** to every existing animated prop, closing defect §0.1(1):
`awning-flutter` base 1100 ms, `palm-sway` base 2200 ms, `smoke` base 1700 ms,
`seagull-fly` base 900 ms — each instance offset by the golden-ratio sequence and jittered
±12 %. Ship it as `src/phaser/core/phase.ts` with a vitest asserting: for N ≤ 24
instances, no two phases within `period/(2N)` of each other, and the output is identical
across runs.

**Cap:** at most **12 flickering practicals per location**, chosen by distance to camera
centre each time the camera settles; the rest render their B state statically. Rua Direita
has 17 lights; the cap costs nothing visible and bounds the worst case.

### 2.5 What must never cycle

Sky (40–43), foliage (20–24), skin (35–39), stone/whitewash. A cycling sky reads as a
rendering bug; foliage motion is the `palm-sway` sprite's job. Cycling is for **water and
flame only**, plus the title's lit windows.

---

## 3. Feedback event table

Existing bridge events are used verbatim where they exist (`src/phaser/eventBridge.ts:96-133`).
New events are marked **NEW** and must be added to the `GameEvents` interface in the same file.

**Shipped SFX (13, loaded at `BootScene.ts:254-268`):** `sfx-menu-select`,
`sfx-dialogue-blip`, `sfx-item-pickup`, `sfx-door-open`, `sfx-footstep-stone`,
`sfx-footstep-wood`, `sfx-footstep-dirt`, `sfx-coin-clink`, `sfx-gate-creak`,
`sfx-waves-crash`, `sfx-crowd-murmur`, `sfx-birds-tropical`, `sfx-wind-hilltop`.

### 3.1 The table

Volumes are absolute `playSfx` scales (the mixer applies the user's SFX volume on top —
`GameScene.ts:3875-3882`). "UI pulse" values are for the React layer via a
`useFeedback()` hook reading a new `feedbackStore`.

| Event | Emitted at | SFX (vol) | Particle / world | UI pulse | Shake | Notes |
|---|---|---|---|---|---|---|
| `item:pickup` | `GameScene.ts:2536-2544` (already wired) | `sfx-item-pickup` **0.38** | **sparkle**: 5 `dust.png` particles at the item's last world pos, ADD, tint `#F5C860`(48)→`#D8A428`(47), lifespan 420 ms, speed 22 px/s radial, gravity −14; item sprite scales 1.0→1.25→0 over 180 ms | inventory icon flash `#F5C860` 160 ms; item name slides into the HUD ticker | — | The Diablo-II beat: the *sprite leaves*, it doesn't just vanish |
| `item:examine` | `eventBridge` (exists, unwired in Phaser) | **NEW** `sfx-examine-soft` **0.22** | none | examine panel fades in 140 ms `ease-out` | — | |
| **NEW** `prop:examine` | `EnvironmentObjectSystem` examine path (fix the ESM `require()` at `:537` first) | **NEW** `sfx-examine-soft` **0.22** | 1-frame 2 px outline pulse on the prop in `whitewash-4 #FCECCC`, 120 ms | — | — | |
| `dialogue:start` | `GameScene` NPC interact | `sfx-menu-select` **0.30** | NPC turns to face player over 120 ms | portrait panel slides up 180 ms `cubic-bezier(.2,.7,.3,1)`; world dims via `uFlashAmt` **−0.06** (negative = darken) 200 ms | — | Camera does **not** move; this is a flip-screen-derived frame |
| `dialogue:end` | `ui:dialogue:close` handler `:2441` | **NEW** `sfx-panel-close` **0.24** | — | panel slides down 140 ms; dim releases 200 ms | — | |
| `dialogue:topic:selected` | `:2446-2447` (already plays blip) | `sfx-dialogue-blip` **0.28** | — | selected row background `#D8A428` @0.25, 90 ms | — | Keep — this is the Ultima speech blip |
| `dialogue:item:given` | `:2546-2547` | `sfx-item-pickup` **0.20** | 3 sparkle particles at the NPC's hands (sprite y − 30 native) | inventory count decrements with a 200 ms count-down | — | |
| `dialogue:money:paid` | `:2550-2551` | `sfx-coin-clink` **0.34** | **coin burst**: `n = clamp(round(amount/25), 1, 6)` particles, `dust.png` tinted `brass-gold #D8A428`(47), arc up 30 px then fall, 520 ms, 40 ms stagger | purse total counts down over `120 ms × n`, digits pulse `#D8A428` | — | Payout size is *readable from the burst* — the U7/D2 trick |
| `quest:start` | `:2528-2531` | **NEW** `sfx-quest-chime` **0.42** | — | journal tab pulses `#F5C860` 3× over 900 ms; toast "New Quest" 2.4 s | — | |
| `quest:advance` | `questStore` | **NEW** `sfx-journal-quill` **0.30** | — | journal tab single pulse 400 ms | — | Must fire even when the journal is closed — this is the fix for "3 000 words invisible" made audible |
| `quest:complete` | `questStore` | **NEW** `sfx-quest-chime` **0.50** + `church-bells` **0.18** (ambience bank, one-shot) | — | full-panel parchment sweep 700 ms | **flash** `#FFF4D4` `uFlashAmt` 0.10, 260 ms ease-out | The one earned "moment". Prefer flash over shake |
| **NEW** `journal:updated` | `questStore`, `loreStore` | `sfx-journal-quill` **0.22** | — | journal tab dot appears | — | Distinct from `quest:advance`: discoveries/rumours |
| **NEW** `world:transition:start` | `TransitionSystem` | per-location `audio.transitionSound` (already authored: a-famosa `sfx-gate-creak`*, rua `sfx-crowd-murmur`, st-pauls `sfx-wind-hilltop`, waterfront `sfx-waves-crash`, kampung `sfx-birds-tropical`) **0.40** | — | screen fade to `#0C0C18` (canon `shadow-void`, index 45) 260 ms | a-famosa gate only: **0.0035 / 140 ms**, fired 90 ms into the fade | *Verify a-famosa's key — Stage 1 flagged 5 transition SFX referenced but not loaded |
| **NEW** `world:transition:complete` | `TransitionSystem` | none | — | fade in from `#0C0C18` 320 ms; location name card 1.6 s | — | Asymmetric fade (out fast, in slow) reads as arrival |
| **NEW** `player:rest:start` | `GameScene.ts:2455-2470` rest path | **NEW** `sfx-rest-chime` **0.28** | — | fade to `#0C0C18` 500 ms | — | |
| **NEW** `player:rest:complete` | same | ambience for the new ToD crossfades in over 1200 ms | — | fade in 800 ms; clock readout ticks the elapsed hours over 600 ms | — | Showing the hours *pass* is worth more than a number changing |
| `game:save` | `saveStore` | **NEW** `sfx-save-seal` **0.34** | — | slot row flashes `#B01C28` (crimson 46 — a wax seal) 260 ms | — | |
| `game:load` | `saveStore` | `sfx-menu-select` **0.30** | — | fade through `#0C0C18` 300 ms | — | |
| **NEW** `feedback:denied` | interaction system, locked hotspots (`GameScene.ts:3184` already shows text) | **NEW** `sfx-denied-thud` **0.30** | — | message row shakes 3 px × 2, 160 ms; text tint `#B01C28` | **0.0020 / 90 ms — only when the denial is physical** (locked door, blocked route). Never for a conversational refusal | |
| `ui:inventory:toggle` / `ui:journal:toggle` | `:2427-2434` | **NEW** `sfx-panel-open` **0.26** / `sfx-panel-close` **0.24** | — | panel scale 0.98→1.0 + opacity, 160 ms | — | |
| `ui:pause:toggle` | `:2436-2438` | `sfx-menu-select` **0.24** | — | world desaturates via `uFlashAmt` −0.10 | — | |
| `time:day-passed` | clock | `church-bells` **0.20** | — | day counter increments with 400 ms pulse | — | |

### 3.2 Camera-shake policy (write this in the code as a comment)

> This is not an action game. Shake is reserved for **physical impact the player caused or
> received**. Three sites are approved: the A Famosa gate slam (0.0035 / 140 ms), a
> physical denial (0.0020 / 90 ms), and — if a cannon is ever fired in the demo —
> 0.0060 / 220 ms. Nothing else. `CameraSystem.shake()` must early-return when a dialogue
> or panel is open, and must never fire more than once per 400 ms.

`intensity` is a viewport fraction (`CameraSystem.ts:115-118`): 0.0035 × 540 ≈ 1.9 px —
sub-sprite-pixel at 3×, which is exactly right. Anything above 0.008 will visibly break
the pixel grid and must be rejected in review.

### 3.3 New-SFX request list → `tools/generate-audio/`

12 sounds. Synthesis hints use the tool's existing vocabulary
(`assets/audio/MANIFEST.json → synthesis`). All mono 44.1 kHz WAV, deterministic seed
`melaka:<key>:v1`, peak-normalised to −6 dBFS, ≤ 700 ms unless noted.

| key | len | synthesis hint | character |
|---|---|---|---|
| `sfx-examine-soft` | 180 ms | single plucked (Karplus-Strong) note, short body resonance, low-passed 3 kHz | a fingertip on an object; must sit *under* dialogue blips |
| `sfx-quest-chime` | 900 ms | bell partial set (hum/prime/tierce), 2 notes a fifth apart, long tail | Portuguese, not fantasy-RPG; kin to `music-church` |
| `sfx-journal-quill` | 320 ms | bandpassed shaker + one short noise scrape | quill on paper, no melody |
| `sfx-page-turn` | 280 ms | two filtered noise bursts, 90 ms apart, pitch-falling | for journal/topic paging |
| `sfx-denied-thud` | 240 ms | pitch-dropping membrane (rebana `dum` at low level) + tight lowpass, no ring | flat, unmusical, unmistakably "no" |
| `sfx-panel-open` | 300 ms | metallophone (saron) single strike, soft mallet, fast decay | brass fitting |
| `sfx-panel-close` | 260 ms | same voice, damped, one step lower | must be the *pair* of open |
| `sfx-save-seal` | 420 ms | membrane press + short wax "creak" (filtered noise sweep) | a seal pressed into wax |
| `sfx-rest-chime` | 1100 ms | suling (blown sine stack + breath) two-note fall, heavy reverb | night settling |
| `sfx-cloth-rustle` | 300 ms | brown-noise burst through a moving bandpass, 2 grains | awning/banner pass-by (§5.4) |
| `sfx-wood-creak-short` | 350 ms | bowed-string voice at very low amplitude + inharmonic partials | pier board underfoot (§5.6) |
| `sfx-grass-brush` | 260 ms | white-noise grains, 3 bursts, highpass 1.2 kHz | walking through grass (§5.5) |

All 12 must be added to the `BootScene.ts:254-268` load list and to
`tools/validate-*`'s key-existence check, so a missing SFX fails the build rather than
silently no-op-ing at runtime (the failure mode Stage 1 found in the 5 transition sounds).

---

## 4. Ambient fauna layer

BG-style **scripted indifference**: fauna never react to the player, never block, never
carry dialogue, never appear in an interaction scoring pass. They exist to make the frame
move when nothing is happening. Benchmark item 8 wants ≥3 ambient animation layers per
scene (≥4 waterfront) — the current data already passes on *count* (a-famosa 5 types,
rua 5, waterfront 4, kampung 4, st-pauls 4); what fauna buys is **variety and life at the
ground plane**, where every existing layer is either sky (seagull) or architecture
(awning/palm/smoke).

### 4.1 Behaviour archetypes

| id | motion | tick | ToD gate | depth |
|---|---|---|---|---|
| **A `perch-hop`** | idle on an anchor, 2-frame idle @ 3 fps; every 6–14 s hop 8–16 native px to a neighbouring anchor over 400 ms | 250 ms | — | `worldDepth(y)` |
| **B `peck-wander`** | random walk in radius R over walkable mask: 60 % idle/peck (4-frame @ 4 fps), 40 % walk 1–2 s at 10–16 native px/s | 200 ms | — | `worldDepth(y)` |
| **C `flight-arc`** | enter off-frame → quadratic bezier across → exit off-frame; 18–26 native px/s; re-enter after 12–30 s | 60 ms | — | FX band 890–905 |
| **D `flutter-drift`** | sinusoidal drift inside a bbox, `x += sin(t·a)·s`, `y += sin(t·b + φ)·s·0.6`, never lands | 100 ms | see table | 895 (butterflies), `worldDepth(y)`−1 (fireflies, they hug the water) |
| **E `sleep-lie`** | lying, 2-frame breathing @ 1 fps; stands, walks ≤ 24 px, re-lies every 40–90 s | 500 ms | — | `worldDepth(y)` |

All timings get the §2.4 golden-ratio phase spreader. All positions are validated against
`WalkMask.canStand()`; a fauna instance that fails is re-seeded at
`nearestWalkable()` (already implemented, `WalkMask.ts:122`).

### 4.2 Per-location roster

Period- and place-appropriate for Melaka, 1580. No animal that is not plausibly there.

| Location | fauna | count (high) | archetype | ToD | placement rule |
|---|---|---|---|---|---|
| **kampung** | ayam kampung (village chicken) | 4 | B, R = 40 native px | despawn 19:00–06:00 (they roost) | on `surface dirt(2)` or `sand(4)`, ≥ 24 px from a `cookingFire` |
| | village dog | 1 | E | all | near a house, on `dirt` |
| | butterflies | 3 | D, bbox 60×40 | 08:00–17:00 | over `grass(6)` |
| | **kelip-kelip** (fireflies) | 14 | D, bbox = river poly + 20 px | 20:00–05:00 | over/beside the `river` water poly — the Melaka firefly is the single most place-specific detail available to us; reuse `particles/fireflies.png` (8×4, exists) |
| | biawak (monitor lizard) | 1 | B, R = 30, speed ×0.6 | 09:00–16:00 | river bank, `surface dirt` adjacent to `water(5)` |
| **waterfront** | seagulls | 3 (exists) | C | day/dawn/dusk | already authored in `animatedProps` |
| | dock rats | 2 | B, R = 26, speed ×1.4 | 20:00–05:00 | on `wood(3)` near cargo props |
| | ship's cat | 1 | A → E | all (A by night, E by day) | on `wood(3)`, crate-top anchors |
| **rua-direita** | pariah dogs | 2 | E / B mix | all | on `stone(1)`, off the main crowd paths |
| | street cats | 2 | A | 17:00–06:00 | wall/step anchors |
| | rock doves | 4 | A + occasional C | 06:00–19:00 | ground `stone` + roof-edge anchors |
| **a-famosa-gate** | pigeons | 3 | A | day | fort-wall anchors |
| | soldier's dog | 1 | E | day | near the guardhouse |
| | kite (*Haliastur indus*, brahminy) | 1 | C, slow (10 px/s), high arc | day/dusk | sky band only, y < 90 native |
| **st-pauls-church** | swifts | 4 | C, fast (30 px/s), tight arcs around the tower | dawn/dusk | y < 120 native |
| | wall lizard (cicak) | 1 | A, small hops | day | church wall anchors |
| | butterflies | 2 | D | day | over `grass(6)` (48 400 px available) |

**Data home:** a new `fauna` array in `src/data/locations/<id>.location.json`, native px,
validated by `tools/validate-location-data.cjs` exactly like `animatedProps`
(on-plate bounds, sprite key exists, archetype in enum, ToD window valid).

```json
"fauna": [
  { "type": "chicken", "archetype": "peck-wander", "x": 212, "y": 268, "radius": 40,
    "hours": [6, 19], "count": 4 }
]
```

### 4.3 Sprite-sheet requests (art track)

All native px, canon colours only, **1 px selective outline in the material's own step-0
hue** (never `#000`), **contact shadow required for every ground-dwelling animal**
(benchmark item 13 is non-negotiable at our sprite scale — a fauna sprite without a
contact shadow will read as a decal). Horizontal strips, no padding, left-to-right.

| sheet | frame | frames | layout | notes |
|---|---|---|---|---|
| `fauna-chicken.png` | 12×12 | 4 peck + 4 walk | 96×12 | one facing, flipped for the other; comb in `flag-crimson #B01C28`(46) |
| `fauna-dog-pariah.png` | 20×14 | 4 walk + 2 idle + 3 lie | 180×14 | short-coat tan from `earth`(30–34) |
| `fauna-cat.png` | 14×10 | 4 walk + 2 idle + 2 sit | 112×10 | two recolours (ginger `terracotta`, grey `stone`) via `remap-canon.cjs` |
| `fauna-dove.png` | 10×8 | 2 idle + 4 walk + 4 fly | 100×8 | |
| `fauna-butterfly.png` | 6×6 | 4 | 24×6 | 2 recolours; no contact shadow (never lands) |
| `fauna-lizard.png` | 22×8 | 4 walk + 2 idle | 132×8 | biawak; `fauna-cicak.png` is the same sheet at 10×5 |
| `fauna-rat.png` | 10×6 | 4 walk | 40×6 | |
| `fauna-swift.png` | 8×6 | 3 fly | 24×6 | |
| `fauna-kite.png` | 14×10 | 3 fly (mostly glide) | 42×10 | |
| *(fireflies)* | — | — | — | **reuse `assets/sprites/particles/fireflies.png`** (8×4) |

Contact shadows come from the shared pixel contact-shadow sheet already scheduled in the
art track (ellipse ≥ 60 % of foot width, 25–45 % opacity, angle matching the plate's
single NW sun, `SUN.azimuthDeg 315` / `elevationDeg 30` — `palette.cjs`).

### 4.4 Rules the implementation must enforce

- **No physics body, no collider, never in `findBestInteractionTarget` scoring.**
- Ground fauna: `worldDepth(y)` — the player walks in front of and behind them. Flying
  fauna: fixed FX depths 890–905 (below `DEPTH_FX_CEILING` 1000, above every world object).
  **Never `setDepth(y)` on a 1080-tall world** (defect §0.1(2)).
- Budget: **≤ 8 fauna instances per location on `high`, 5 on `balanced`, 2 on `low`**
  (chosen by roster order). Fauna count is *added to* the crowd budget check, not exempt
  from it — `visualProfile.maxCrowdSize` (15/10/5) minus live fauna.
- Fauna pause when a dialogue is open (the frame should hold still while you read).
- Deterministic: seeded by `hash2(locationId, instanceIndex)`, no `Math.random()`.

---

## 5. Surface-response set

Commandos technique 8: *surfaces respond to sprites*. We have the channel for free —
`WalkMask.surfaceAt(worldX, worldY)` returns one of 8 material ids
(`WalkMask.ts:104-109`) and the footstep bank already routes through it
(`footstepAt()`, used at `GameScene.ts:3896`). Six effects, ranked by impact ÷ cost.

Global rule: **one `SurfaceResponseSystem` with a single pooled group of 24 objects.**
When the pool is full the oldest is recycled. No effect ever allocates in `update()`.

### 5.1 ① Dust puff on dirt — *highest impact, lowest cost*

- **Trigger:** the existing footstep tick (`GameScene.ts:3893-3897`) when
  `surfaceAt(foot) ∈ {dirt(2), sand(4), grass(6)}` **and** the player's speed is
  > 60 % of `PLAYER_SPEED` (180) — walking raises dust, shuffling does not.
- **Rate:** at most 1 puff per 2 footsteps.
- **Sprite:** existing `assets/sprites/particles/dust.png` (12×4 → 3 frames of 4×4 native).
- **Spec:** 2 particles at the foot point (`y + WALK_FOOT_OFFSET`, `GameScene.ts:226`),
  lifespan **380 ms**, alpha 0.50→0, `speedY −6 px/s`, `speedX ±8 px/s`, scale 3→4.5,
  tint by surface: dirt `earth-2 #987438`(32), sand `earth-3 #C8A860`(33),
  grass `foliage-1 #144418`(21) at alpha 0.35.
- **Depth:** `worldDepth(footY) − 1` (behind the walker's feet).
- **Cap:** 6 alive. **Also fires for crowd members and NPCs** at 1/4 the rate — this is
  what makes the *city*, not just the player, kick up dust.
- **Cost:** ~30 lines. It is the single cheapest thing in this document that makes the
  ground feel like ground.

### 5.2 ② Cloth sway on pass-by — *cheapest "the world noticed you"*

- **Trigger:** player's world x within **60 world px (20 native)** of an
  `awning-flutter` animated prop **and** |Δx| decreasing (approaching).
- **Response:** no new art. Retime the existing prop animation: amplitude ×**1.8**,
  rate ×**1.4** for **900 ms**, then ease back over 400 ms. On the sprite-anim path this
  is `anims.timeScale`; on the tween fallback it is the tween's `timeScale`/`scaleY` range.
- **SFX:** `sfx-cloth-rustle` **0.14**, once per prop per 4 s.
- **Cap:** 3 props responding at once; nearest wins.
- **Cost:** ~25 lines, zero assets. `awning-flutter` counts: rua-direita 6, a-famosa 5,
  waterfront 5, kampung 4, st-pauls 1 — this fires constantly and costs nothing.

### 5.3 ③ Board creak on the pier — *audio-only surface response*

- **Trigger:** footstep where `surfaceAt ∈ {wood(3)}` (waterfront only: 3 024 mask px).
- **Response:** `sfx-wood-creak-short` at **0.18**, on 1 footstep in 4, pitch-randomised
  ±6 % from a position hash (deterministic). **No visual.** A creak that only sometimes
  happens is the whole effect; a creak on every step becomes a rhythm instrument.
- **Cost:** ~10 lines + 1 new SFX.

### 5.4 ④ Water-edge ripple

- **Trigger:** any character (player, NPC, crowd, ground fauna) whose foot point is within
  **12 world px (4 native)** of a `water(5)` mask pixel **and** whose speed > 0.
- **Sprite request:** `fx-ripple.png`, native **16×8**, **3 frames** (expanding ring
  10×5 → 13×6 → 16×8), 1 px ring, canon `water-4 #78BCB0`(29) with a `sun-specular`(49)
  glint pixel on frame 2.
- **ToD:** tint the ring to the post-LUT `water-4` for the current time —
  day `#78BCB0`, dawn `#627581`, dusk `#F8AE57`, night `#32404E` (table §2.2). One tint
  set, no extra art.
- **Lifetime:** 520 ms, alpha 0.50→0. **Depth:** `worldDepth(y) − 1`.
- **Cap:** 4 alive; 1 per character per 700 ms.
- **Locations:** waterfront (82 992 water px), kampung river (6 272).
- **Cost:** ~40 lines + 1 sprite. Parked to v0.13 only because it wants the Stage-5 NPC
  walking to be in place first, or it fires almost exclusively for the player.

### 5.5 ⑤ Grass part

- **Trigger:** footstep where `surfaceAt == grass(6)` (st-pauls 48 400 px, kampung 57 136).
- **Sprite request:** `fx-grass-part.png`, native **12×8**, **2 frames** (blade cluster
  bending away from travel direction, springing back), `foliage-1/2` (21/22).
- **Lifetime:** 260 ms. **Depth:** `worldDepth(footY) + 1` (in *front* of the feet — the
  grass closes over them).
- **SFX:** `sfx-grass-brush` **0.16**, 1 step in 3.
- **Cap:** 4 alive.

### 5.6 ⑥ Wet footprints on the quay

- **Trigger:** the player's foot point was within 4 native px of `water(5)` in the last
  **500 ms**; then every footstep for the next **6 steps** leaves a print.
- **Sprite request:** `fx-footprint.png`, native **6×3**, 2 variants (L/R), a darkened
  decal, not a colour: composite the surface colour toward `shadow-violet #181830`(44) at
  **0.35** — one sprite works on wood *and* stone because it is a darkener.
- **Lifetime:** fade out over **9 000 ms** (they dry), alpha 0.35→0 with a hold at
  0.35 for the first 3 000 ms.
- **Cap:** **12 alive**, ring buffer, cleared on location change and **not persisted in
  saves** (decals are frame decoration; `saveStore` is at v4 and must not gain a decal list).
- **Depth:** `worldDepth(y) − 2`.
- **Locations:** waterfront quay, kampung river bank.
- **Cost:** the highest of the six (decal pooling + a wetness timer on the player), which
  is why it is last.

---

## 6. Priority, effort, and the cut line

Effort is engineer-days for the engine wave; art and audio tracks run in parallel and are
called out separately. "Blocks" means the item cannot start until the named work lands.

### v0.12 — ships

| # | Item | §  | Eng days | Art / audio | Blocks | Why it's above the line |
|---|---|---|---|---|---|---|
| 1 | **PostFX pipeline + canvas fallback + LUT tool** | §1 | **2.0** | 0.25 d (grade-lut.cjs is a Forge tool) | GameScene decomposition landing far enough to own an `AtmosphereSystem` | Removes 14–20 blend objects and the last pixel-density violation; every other item renders on top of it |
| 2 | **Bake `aoZones` / `canopyShadows` / sun shafts into plates; delete runtime paths** | §1.7 | 0.5 | 0.75 d (Forge `shade` blocks + re-render 20 plate variants) | #1 | Half the FX stack disappears into the art where it belongs |
| 3 | **`core/phase.ts` golden-ratio spreader + apply to all animated props; fix `setDepth(y)` → `worldDepth(y)`** | §0.1, §2.4 | **0.5** | — | — | Fixes two provable defects (benchmark item 9, FX-band bleed) for half a day |
| 4 | **Feedback event table — existing 13 SFX + all UI pulses + particle bursts** | §3 | **1.25** | — | — | The whole pickup/dialogue/payout loop becomes tactile with zero new assets |
| 5 | **New-SFX batch (12) + BootScene load + key-existence gate** | §3.3 | 0.25 (wiring) | **1.0 d audio** | — | Runs fully parallel; #4 upgrades in place as keys land |
| 6 | **Practical flicker cycling (torch/lantern/fire/window)** | §2.4 | **0.75** | 0.5 d (4 pool sprites × 3 states) | #3 | Night stops being a still image; **59 practicals** across 5 locations already authored and baked |
| 7 | **Surface responses ① dust, ② cloth sway, ③ board creak** | §5.1–5.3 | **0.75** | — | #5 for the two SFX | Ground and cloth respond; ~65 lines total, zero new sprites |
| 8 | **Water cycle strips — waterfront + kampung** | §2.2 | **1.5** (0.5 tool, 0.5 bake+verify, 0.5 runtime) | — | #1 (ToD/LUT settled) | Kills the off-canon particle shimmer; benchmark technique 3; waterfront's 83 k water pixels are a third of that frame |
| 9 | **Fauna tier 1 — chickens (kampung), doves (a-famosa + rua), cats (rua), archetypes A/B/E only** | §4 | **1.5** | 0.75 d (4 sheets) | #3 (phase), fauna schema in location data | Ground-plane life; archetypes C/D are the ones that need more tuning |
| | **Total** | | **≈ 9.0 eng-days** | **≈ 3.25 art/audio-days (parallel)** | | |

### v0.13 — parked, with the reason

| Item | § | Why it waits |
|---|---|---|
| Title panorama harbour + lit-window cycling | §2.3 | Blocked on the new title panorama (open task #19). Cycling the *current* opening screen is wasted work |
| Water-edge ripples | §5.4 | Wants Stage 5 NPC walking, or it only ever fires for the player and reads as a player-only effect |
| Wet footprints | §5.6 | Highest-cost surface effect; needs decal pooling + an explicit save-exclusion decision |
| Grass part | §5.5 | Only two locations have grass; lower yield than ①–③ |
| Fauna tier 2 — fireflies, biawak, dogs, butterflies, swifts, kite, rats | §4.2 | Archetypes C (flight-arc) and D (flutter-drift) need on-screen tuning; the kelip-kelip in particular deserve a proper look rather than a rushed one, since they are the most place-specific detail in the game |
| Bloom term on practicals | §1.2 | The pipeline exists after #1; bloom is one more term and a threshold uniform. Do it once the flicker cycling has settled the night look |
| `uFlashAmt` used for anything beyond quest completion and panel dim | §3 | Prove the three approved uses first |
| Additional shake sites | §3.2 | Policy is "three sites"; any fourth needs a design argument, not a ticket |

### 6.1 Verification

- **Benchmark item 9 gate:** a Playwright capture of 10 s at 8 fps per location; a script
  asserts that no two same-type animated props share an animation frame index in > 15 % of
  sampled frames. This is a hard CI gate — the defect it catches is currently 100 % present.
- **Benchmark item 8:** ambient-animation-layer count per location, asserted from the
  location data (`animatedProps` types + `fauna` types + water-cycle presence): ≥ 3, ≥ 4
  waterfront.
- **LUT identity gate:** §1.4 (no canon colour moved > 10/255; ≥ 92 % index stability).
- **Canvas parity:** boot with `?fx=off`, screenshot all 5 locations × 4 ToD, confirm no
  location is unreadably dark or flat (grayscale separation gate #17 still passes).
- **Determinism:** `npm run forge:cycle` twice → byte-identical cycle frames; `core/phase.ts`
  vitest asserts identical output across runs and minimum phase separation.
- **Budget:** an assertion in `SurfaceResponseSystem` that the pool never exceeds 24 and a
  dev-overlay counter for live fauna + crowd vs `visualProfile.maxCrowdSize`.
- **Feel check, human:** walk each location for 60 s at day and at night with sound on.
  If the frame is ever completely still for more than 2 s while standing, an ambient layer
  is missing or synchronised.

---

## Appendix A — canon indices this document uses

| idx | name | hex | used for |
|---|---|---|---|
| 7 | terracotta-2 | `#844020` | flame pool ring, state C |
| 8 | terracotta-3 | `#B47844` | flame pool mid/ring |
| 21 | foliage-1 | `#144418` | grass dust tint, grass-part |
| 22 | foliage-2 | `#387024` | grass-part |
| 25–29 | water-0…4 | `#10142C … #78BCB0` | water cycle strips, ripples |
| 32 | earth-2 | `#987438` | dirt dust puff |
| 33 | earth-3 | `#C8A860` | sand dust puff |
| 44 | shadow-violet | `#181830` | LUT shadow anchor, footprint darkener |
| 45 | shadow-void | `#0C0C18` | transition fade colour |
| 46 | flag-crimson | `#B01C28` | save-seal pulse, denial text |
| 47 | brass-gold | `#D8A428` | coin burst, flame states |
| 48 | lantern-flame | `#F5C860` | pickup sparkle, flame core, quest pulse |
| 49 | sun-specular | `#FFF4D4` | quest-complete flash, ripple glint, flame hot state |

## Appendix B — files this spec asks the engine wave to touch

**New:** `src/phaser/systems/AtmosphereSystem.ts` (owns the pipeline),
`src/phaser/pipelines/MelakaPostFX.ts`, `src/phaser/systems/WaterCycleSystem.ts`,
`src/phaser/systems/FlickerSystem.ts`, `src/phaser/systems/FaunaSystem.ts`,
`src/phaser/systems/SurfaceResponseSystem.ts`, `src/phaser/core/phase.ts`,
`src/stores/feedbackStore.ts`, `tools/forge/grade-lut.cjs`.

**Modified:** `src/phaser/scenes/GameScene.ts` (delete §1.7 rows),
`src/phaser/visualProfile.ts` (replace 8 fields with 4 scalars),
`src/phaser/eventBridge.ts` (9 new events), `src/phaser/scenes/BootScene.ts` (12 SFX +
cycle frames + fauna sheets), `src/phaser/systems/EnvironmentObjectSystem.ts` (phase +
depth fixes), `tools/forge/compose-plate.cjs` (`--cycle`),
`tools/validate-location-data.cjs` (`fauna` schema), `src/data/locations/*.location.json`
(add `fauna`, remove `visual.aoZones` / `visual.canopyShadows` once baked),
`src/components/screens/TitleScreen.tsx` (v0.13).
