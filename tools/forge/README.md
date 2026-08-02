# Melaka Forge — palette & relight

The colour foundation of *A Famosa: Streets of Golden Melaka*. Everything the
Forge produces — texture fills, iso kits, composed plates, recoloured sprites,
portraits, UI — draws from the canon defined here, and every time-of-day
variant in the game is derived from a day master through the LUTs defined here.

```
tools/forge/
  palette.cjs         the ~50-colour canon, generated from ramp SPECS
  relight.cjs         per-canon-index remap tables for dawn / dusk / night
  relight-plates.cjs  day master -> canon -> LUT -> baked light pass -> plates
  remap-canon.cjs     salvages the crowd + character sheets onto the canon
  validate-canon.cjs  the CI gate (membership / determinism / no AA)
  plate-masters/      IMMUTABLE day plates — the only input to relight-plates
  README.md           this file
docs/art-bible/forge/
  palette-sheet.png    labelled swatch sheet (regenerate, don't hand-edit)
  relight-luts.json    the shipped tables + the specs that produced them
  relight-preview.png  all 4 times, palette + a real plate
src/data/
  relight-runtime.json per-ToD character tint, derived from the same LUTs
```

```bash
npm run forge:palette    # canon + swatch sheet + gates
npm run forge:luts       # LUT json + preview strip + gates
npm run forge:relight    # all 20 plates + src/data/relight-runtime.json
npm run forge:remap      # crowd + character sheets -> canon
npm run validate:canon   # the CI gate (also runs in pretest / prebuild)
```

### v0.12 additions

Four more generators, all on the same contract (canon hexes only, alpha 0 or
255, one NW sun, deterministic, own gates, non-zero exit on failure):

```bash
npm run forge:title            # title-panorama.json -> opening-screen.png
                               #   + scene-loading-ribeira.png (dusk / night LUT)
npm run forge:item-icons       # the 27 inventory icons, 16x16 native x3
npm run forge:lore-objects     # crucifix / stone-tomb / stone-ruins
npm run forge:contact-shadows  # the benchmark-13 shadow sheet (data only)
```

| file | writes | notes |
|---|---|---|
| `title-screen.cjs` | `assets/scenes/opening-screen.png`, `scene-loading-ribeira.png` | one composed panorama, two LUTs. **No baked text** — that is what let `.ui-screen-scrim` go back to an even veil |
| `item-icons.cjs` | `assets/sprites/ui/items/*.png` | 27 icons; documents are separated by FITTING, never by ruling |
| `lore-objects.cjs` | `assets/sprites/objects/{crucifix,stone-tomb,stone-ruins}.png` | the three St Paul's lore objects that resolved to `debug-prop-missing` |
| `contact-shadows.cjs` | `assets/sprites/effects/contact-shadows.png` | 3 frames; see `docs/art-bible/forge/contact-shadows.md` for the engine contract |

`compose-plate.cjs` gained a `--screen` mode (picture only — no walk mask, no
derived engine data) and a `bastion` background type, both for the panorama.

**LEGACY_ALLOWLIST went 7 -> 4** in v0.12: the title screen, the loading screen
and the 27 item icons all came off it, and in every case the exemption was
replaced by real coverage in `gateMembership` rather than simply deleted.

Every one exits non-zero if a gate fails, so all are CI-ready as-is, and every
one is **deterministic** — no `Math.random`, no `Date.now`; same inputs, same
bytes. `validate-canon.cjs` enforces that last property by re-rendering all 20
plates into a scratch directory and byte-comparing them with what is checked in.

---

## 1. Palette philosophy

### The problem being fixed

The old canon (`tools/ultima8-graphics/palette.cjs`) was 23 materials × 8 shades
= **184 colours**, and almost every ramp was a *pure value slide*: the same hue
at eight brightnesses. Two things follow from that, and both were visible in the
shipped art:

1. **Nothing looks lit.** A real surface changes *hue* as it turns away from the
   light — it picks up the sky in its shadow and the sun in its highlight. A
   value slide only changes brightness, which is what you get when you tint a
   greyscale image. That is exactly what the plates read as.
2. **Nothing looks like it shares a world.** 184 independent ramps means 23
   different implied light sources. Objects composited onto a plate never sat in
   it.

### The five rules

1. **Nothing is hand-authored.** Every colour is derived from a ramp spec at the
   top of `palette.cjs`. Change a spec, everything downstream re-derives. There
   is no hex list to drift out of sync.
2. **One sun, one world.** A single key light — **NW, 30° above the horizon,
   warm amber `#FFE9B4`** (this matches the two salvageable plates: waterfront
   and rua-direita) — and a single ambient, the deep violet-blue sky bounce
   `#181830`. Every ramp is lit by *those two lights and nothing else*.
3. **Hue rotates ≥ 20° across every ramp.** Dark end rotates toward the violet
   shadow hue (250°), light end toward the sun hue (42°). Realised rotations run
   **28–50°**. This is the single highest-leverage change in the whole overhaul.
4. **Shadows converge but stay distinct.** Step 0 of each ramp is pulled a spec'd
   fraction toward `#181830`, so every dark end belongs to the same night — but
   never reaches it, so terracotta shadow ≠ foliage shadow and a 5-step ramp
   still has 5 usable steps.
5. **No pure grey, no pure black, no pure white.** Character outlines use the
   material's own step 0 (a hue-shifted dark), never `#000`. Gates enforce this.

### Two mechanisms, and why both exist

The light end of a ramp is warmed **two** ways:

- `lightRot` — a hue rotation toward 42°.
- `sunMix` — an RGB blend toward the sun colour.

Cool-hued ramps (stone, water, sky) get a **small** `lightRot` and a **large**
`sunMix`, because rotating a blue hue toward amber by the short path runs it
through cyan and green, and sunlit masonry comes out pond-coloured. `sunMix` is
a straight blend with no hue path, so it warms without the detour. Warm ramps
(terracotta, timber, earth, skin) can use the rotation directly.

---

## 2. The canon — 50 colours

| # | ramp | steps | rot | shadow → highlight |
|---|------|-------|-----|--------------------|
| 0–4 | `whitewash` | 5 | 36° | `#302C38` `#6C6464` `#ACA08C` `#DCD0B8` `#FCECCC` |
| 5–9 | `terracotta` | 5 | 46° | `#2C1020` `#581814` `#844020` `#B47844` `#DCB47C` |
| 10–14 | `stone` | 5 | 29° | `#1C1C30` `#383C58` `#606C80` `#94A0A8` `#C8CCC0` |
| 15–19 | `timber` | 5 | 44° | `#24101C` `#44201C` `#704828` `#9C7C4C` `#C8B07C` |
| 20–24 | `foliage` | 5 | 48° | `#10241C` `#144418` `#387024` `#709C44` `#B0C478` |
| 25–29 | `water` | 5 | 50° | `#10142C` `#0C284C` `#185470` `#3C8C94` `#78BCB0` |
| 30–34 | `earth` | 5 | 34° | `#301C20` `#643C24` `#987438` `#C8A860` `#F0D498` |
| 35–39 | `skin` | 5 | 38° | `#341C24` `#5C3430` `#886044` `#B8946C` `#E0C89C` |
| 40–43 | `sky` | 4 | 28° | `#20285C` `#28549C` `#6098C8` `#B8D8D8` |
| 44–45 | anchors | 2 | — | `#181830` shadow-violet · `#0C0C18` shadow-void |
| 46–49 | accents | 4 | — | `#B01C28` flag-crimson · `#D8A428` brass-gold · `#F5C860` lantern-flame · `#FFF4D4` sun-specular |

**40** material + **4** sky + **2** anchors + **4** accents = **50**.

- `earth` is where the *Golden* in Golden Melaka lives — the dirt streets and
  beach are the warmest large surface in the game.
- `skin` is **one shared ramp**. Per-culture variants (Portuguese / Malay /
  Chinese / Indian / Arab) are hue-and-saturation *rotations* of this one ramp
  applied by `remap-canon.cjs`, never separate palettes. That is what stops the
  cast reading as five different art styles standing next to each other.
- `sky` is an atmosphere ramp, not a material: it is a light source, so it does
  not converge on the shadow anchor.
- Accents are **small-area only**. Never a ground fill, never a wall fill.
- The two anchors are what contact shadows, cast shadows, AO, doorway interiors
  and night interstitial fill are drawn with.

### Per-screen budget

Canon is 50; the **per-screen budget is ≤ 40** (benchmark gate #14). No plate
uses skin + every accent + the full sky band at once. `validate-style.cjs`
should count *distinct canon indices per plate*, not canon size.

*(The locked spec called for a canon of ~40–44. That is exactly the size of the
ramped body — 40 material + 4 sky = 44. The 2 anchors and 4 accents are utility
entries on top, and they are the ones that stay under the per-screen budget.)*

---

## 3. Old name → new ramp

Existing generators reference `PALETTE.<name>[0..7]`. `palette.cjs` exports
`LEGACY_MAP` and `fromLegacy(name, step)` which maps a legacy 8-step index onto
the new ramp via `round(step / 7 × (n-1)) + bias`. Usage counts are from a grep
of `tools/ultima8-graphics/*.cjs`.

| old (uses) | → new | notes |
|---|---|---|
| `wood` (88) | `timber` | |
| `shadow` (87) | anchor `shadow-void` | was pure black — now never is |
| `stone` (79) | `stone` | |
| `whitewash` (66) | `whitewash` | |
| `gold` (58) | `earth` +1 / accent `brass-gold` | metal hits take the accent |
| `clothRed` (34) | accent `flag-crimson` / `terracotta` | |
| `thatch` (30) | `timber` +1, hue +8 | |
| `specular` (25) | accent `sun-specular` | |
| `jungle` (20) | `foliage` | |
| `sand` (19) | `earth` | |
| `skinPortuguese` (17) | `skin` hue +4, sat ×0.95, +1 | |
| `clothBlue` (16) | `water` −1 | |
| `skinMalay` (15) | `skin` hue −4, sat ×1.05 | |
| `water` (13) | `water` | |
| `terracotta` (12) | `terracotta` | |
| `clothSilk` (12) | `terracotta` −1, hue −18 | |
| `sky` (9) | `sky` | |
| `turmericYellow` (7) | `earth` +1 / `brass-gold` | |
| `grass` (7) | `foliage` +1 | |
| `fire` (7) | accent `lantern-flame` / `terracotta` | |
| `lightWood` (6) | `timber` +1 | |
| `skinIndian` (4) | `skin` hue −6, sat ×1.10, −1 | |
| `warmStone` (3) | `stone` hue +12 | merged: one stone, one sun |
| `skinChinese` (3) | `skin` hue +8, sat ×0.80, +1 | |
| `lacquerRed` (2) | accent `flag-crimson` | |
| `indigo` (2) | `water` −1, hue +18 | |
| `night` | anchor `shadow-violet` | night is a LUT now, not a palette |

Two collapses are deliberate: `stone`/`warmStone` (two stones implied two suns)
and `night` (a whole ramp existing purely to darken things is what the LUT
replaces).

---

## 4. How the relight LUTs work

One asset is authored at **day**. Dawn, dusk and night are produced by remapping
every canon index through a lookup table. Nothing is repainted, and — critically
— **the plate tint and the sprite tint come from the same table**. That is what
kills the *double-grade*: the plate baked with one grade while a runtime alpha
overlay applied a second, so composited sprites never matched their background.

A multiply/overlay filter moves every colour the same way, so night becomes "day
but darker" — brown mush. A LUT lets each colour behave the way its **material**
would:

- whitewash at night goes moon-silver, not grey
- foliage at night collapses almost onto the shadow anchor (nothing lights a tree)
- water at dusk **reflects the sky**: it gets *brighter* and amber while every
  solid surface around it darkens
- lantern-flame / specular / brass are **practicals** — light sources, not lit
  surfaces — and are exempt from value compression

### The per-colour pipeline

1. **Value compression** `v' = vLo + (vHi − vLo)·v^vGamma`.
   `vGamma > 1` pushes the midrange *down*, which is what "long shadows" looks
   like when all you have is a LUT.
2. **Saturation scale** `satMul`. Dawn 0.66 (desaturated), dusk 1.20 (the most
   saturated hour), night 0.55.
3. **Split tone.** Shadows take the *ambient* (sky bounce), highlights take the
   *key* (sun/moon), mixed by a smoothstep of the colour's own value.
   Each is applied as **two separate operations**:
   - `ambientW` / `keyW` — a **luminance-preserving** tint. Transfers the
     light's hue without changing brightness.
   - `ambientLift` / `keyLift` — an ordinary blend that *does* brighten.

   Fusing these two (a plain mix toward a bright key colour) is why naive
   relighting makes night bright and dusk flat: every tint silently doubles as
   an exposure change and the compression window stops meaning anything.
4. **Ramp overrides.** Per-material deviations from the global model. This is
   where most of the art lives.
5. **Practicals.** `PRACTICAL_STRENGTH` reasserts the original colour and, at
   night, pushes it *above* its day value: lantern-flame 1.00, sun-specular
   0.85, brass-gold 0.70, flag-crimson 0.30 (a banner is lit, not emissive).
6. **Cool guard** (night only). Forces `b − r ≥ 12` on every non-practical, so
   night can never drift brown no matter how the specs are tuned. `timber` and
   `earth` get a relaxed guard (3) because they sit near lantern light; `skin`
   gets none so faces stay readable.

### `reflectFloor`

A reflective surface does not take the key in proportion to its *own* value — it
takes the colour of the **sky** regardless of how dark it is. `reflectFloor`
clamps the litness term from below for a ramp. Without it, dusk water keeps
violet shadows in its dark steps and the strait never catches fire. Dusk water
runs `reflectFloor: 0.92`.

At **dawn**, water and sky get their own **cold key** (`#BCCCEC` / `#D0D8EC`)
instead of the global warm one — handing dawn water the sunrise key is what
turns a dawn sea into dead greenish grey.

### Spatial bias

Dawn and dusk each emit **two** tables: `base` (away from the sun) and `sun`
(toward it), plus a `gradient: {axis:'x', from:'base', to:'sun'}` descriptor.
The consumer lerps horizontally so a plate gets a real cool→warm gradient across
the frame instead of a flat grade. The sun is NW, so the **warm side is the left
edge**. Day and night emit one table — night's warmth comes from baked light
pools, not a gradient.

### Where the numbers landed

| | mean luma | vs day | sat | non-practical cool (b>r) |
|---|---|---|---|---|
| day | 110 | 1.00× | 49% | 18 / 46 |
| dawn | 91 | 0.83× | 27% | 29 / 46 |
| dusk | 86 | 0.78× | 52% | 3 / 46 |
| night | 45 | **0.41×** | 45% | **46 / 46** |

### Gates (both files exit non-zero on failure)

`palette.cjs --check`
- every ramp rotates ≥ 20° of hue
- no ramp reads grey (max saturation ≥ 0.10)
- adjacent steps stay distinct after the 4-unit snap (RGB distance ≥ 14) and
  keep ≥ 8 luma of separation
- canon hexes unique; nothing is pure black or pure white

`relight.cjs`
- night mean luma ≤ 0.45× day
- **zero** non-practical colours read warm at night
- lantern-flame still reads as a light source at night (luma ≥ 150)
- dusk water is *brighter* than day water and ≥ 3 of its 5 steps read warm
- dusk value spread ≥ 0.92× day's (catches "it became an orange filter")
- dawn is desaturated vs day and sits in 0.55–0.90× day luma
- nothing is crushed to black at any time of day

---

## 5. How the rest of the Forge consumes this

```js
const P = require('./palette.cjs');
const R = require('./relight.cjs');
```

**`texture.cjs`** (clustered-shading fills)
`P.rampFor('timber')` → a 5-entry array with `.shadow .dark .base .light .hi`.
Cluster shading picks 3 adjacent steps per fill and reserves the 4th/5th for
incident detail. `P.BAYER4` is available but ordered dither is legal **only** on
gradients wider than 20 native px and never inside a 16×32 sprite.

**`iso.cjs`** (shared 2:1 projection)
Face shading is fixed by `P.SUN`: NW-facing face = ramp step 3–4, top = step 2–3,
SE-facing = step 0–1. One sun means every kit module agrees without negotiation.

**`compose-plate.cjs`**
1. compose the day plate from kits, quantized to canon
2. `P.quantizeImageData(img)` → returns the count of distinct canon colours used;
   fail the plate if > 40
3. bake light pools with `ACCENTS['lantern-flame']` and the anchors
4. emit the day plate, then call `R.applyToImageData(clone, tod, {gradient:true})`
   for dawn/dusk/night — the ToD variants are *derived*, never authored

**`remap-canon.cjs`** (salvaging existing sprites)
`P.fromLegacy(oldName, oldStep)` maps any legacy `PALETTE.<name>[i]` to canon.
For sheets whose source material is unknown, `P.nearest(r,g,b)` with a `pool`
restricted to the relevant ramps avoids skin drifting into terracotta.

**Runtime character tinting**
The engine must tint sprites with `relight-luts.json`, **not** with an alpha
overlay. `times.<tod>.variants.base` is a 50-entry hex array indexed by canon
index — a 50-entry shader LUT or a pre-baked per-ToD sprite sheet, either is
fine, but it must be *this* table or the double-grade comes back.

---

## 6. Stage 2 integration — what actually shipped

### 6.1 `relight-plates.cjs` — the plate pipeline

```
tools/forge/plate-masters/scene-<stem>.png     (immutable day master, 960x540)
  -> nearest-downscale to native 320x180       (plates are already on a 3x grid)
  -> quantize to canon MINUS the accents
  -> cool-ramp coherence pass (iterated)
  -> [day]   write assets/scenes/scene-<stem>.png
  -> [ToD]   LUT remap (dawn/dusk dither base<->sun) + baked light pass
  -> nearest-upscale 3x, write assets/scenes/scene-<stem>-<tod>.png
```

Four decisions are worth knowing, because each fixed a visible defect:

- **The master lives outside `assets/scenes/`.** The tool writes the day plate,
  so it must not read it: the coherence pass re-quantizes from the ORIGINAL
  pre-canon pixels, which stop existing after the first run. Reading its own
  output made the tool non-idempotent, which the determinism gate caught.
- **Accents are excluded from the quantization pool.** rua-direita's golden
  earth sits ~14 units from `brass-gold`; an unrestricted `nearest()` scattered
  thousands of ground pixels onto that accent, and because accents are
  practicals (exempt from the night compression window) the whole plaza came
  back at night as a field of glowing gold speckle. Practicals enter a plate
  exactly one way — the baked light pass.
- **Cool-ramp coherence.** `water`, `stone` and `sky` are three cool blues whose
  mid steps are within ~30 units of each other. The waterfront sea quantized to
  a 2:1 dither of `water-2` and `stone-1` — identical at day, but at dusk
  `water` takes `reflectFloor` and a huge key weight while `stone` takes
  neither, so a flat sea detonated into an orange/violet checkerboard. The pass
  reassigns a pixel to its neighbourhood's material *only* when the two are
  already indistinguishable by luma, so real edges are never eaten.
- **The pool ramp REPLACES, it does not blend.** Blending a light pool against
  arbitrary underlying colours generates an unbounded palette (the first draft
  emitted ~480 colours per plate). A fixed 5-step warm ramp with
  ordered-dithered band edges keeps a relit plate's palette enumerable —
  `LUT(base)` + `LUT(sun)` + 5 — which is what makes the CI membership gate
  possible at all.

Where the plates landed (mean luma as a fraction of that plate's own day):

| location | dawn | dusk | night |
|---|---|---|---|
| a-famosa-gate | 0.75x | 0.75x | **0.36x** |
| kampung | 0.70x | 0.62x | **0.32x** |
| rua-direita | 0.69x | 0.58x | **0.27x** |
| st-pauls-church | 0.83x | 0.85x | **0.35x** |
| waterfront | 0.93x | 0.95x | **0.38x** |

### 6.2 Runtime character tint

`src/data/relight-runtime.json` is generated by the same run, from the same
tables, and `GameScene.TIME_CHARACTER_LIGHTING` reads it:

| | tint | alpha |
|---|---|---|
| day | (none) | 1 |
| dawn | `#B0C5F6` | 1 |
| dusk | `#DCAA91` | 1 |
| night | `#455A99` | 1 |

The tint is the best rank-1 approximation of the LUT, summed over the material
ramps with `skin` carrying half the weight (a character is mostly cloth by area,
but it is the FACE that has to stay readable). Alpha is 1.0 at every hour: the
old table faded characters to 0.9 at night, which does not read as darkness, it
reads as a ghost — the plate shows through the sprite. Darkness is the tint's
job. The Stage 0 rule is unchanged: plate-wide overlays stay OFF wherever a
baked variant exists, so this tint is the entire runtime lighting pass.

`validate-canon.cjs` fails if this file drifts from the LUTs — that drift is
precisely how the double-grade would come back.

### 6.3 Sprite salvage — `remap-canon.cjs`

Per-pixel `nearest()` is a lossy many-to-one map, and on a 16x32 sprite two
adjacent shading steps regularly land on the same canon entry, flattening the
form they described. So the remap works on the sheet's COLOUR TABLE: histogram,
vote each colour onto a ramp over the whole sheet, map within the ramp in value
order, and force apart any collapse the source separated by more than 10 luma —
measured against the first colour to claim a step, not the previous one, so a
five-step ladder cannot slide onto one entry a few luma at a time.

Two rules exist because of specific failures found by eye:

- **Virtual ramps** (`crimson`, `brass`, `indigo`) — shading ladders built from
  canon entries with an accent as the base step. Without them a red uniform is
  too much of the sheet to be an accent and falls into `terracotta`, so every
  Portuguese coat came back brown; Chen Wei's robe landed on `skin`.
- **`SKIN_MAX_SAT`** — human skin is never that saturated, so a saturated colour
  that votes `skin` is dyed cloth being mistaken for a body. The crowd's maroon
  Chinese robe collapsed five source colours onto one skin step and the garment
  read as bare flesh.

Known residual: the canon has no plum ramp, so that maroon robe now reads brown
rather than maroon. Contrast and form are preserved; the hue is not.

### 6.4 The gate

`validate-canon.cjs` runs in `pretest` and (as `--fast`) in `prebuild`:

1. **Membership** — day plates and migrated sprites ⊆ canon; ToD plates ⊆ the
   canon's LUT image for that hour plus the pool ramp.
2. **Determinism** — all 20 plates re-rendered to a scratch dir and byte-compared.
3. **No anti-aliasing** — alpha ∈ {0, 255} on everything migrated.
4. **Runtime freshness** — `relight-runtime.json` still matches the LUTs.

`LEGACY_ALLOWLIST` names the sets still on the old palette (title/loading
screens, portraits, UI, props, tiles, particles) with the stage that retires
each. **It is meant to shrink**; an entry still present when its stage lands is
a regression, not an exemption.

### 6.5 Still open

- `docs/art-bible/lighting-standard.md` still documents the **old** 48-colour
  master palette and per-ToD hexes. It needs a rewrite to point here — the sun
  direction (NW) and the violet shadow anchor (`#181830`) carry over unchanged,
  but the ToD colour table is superseded by the LUTs.
- `relight-luts.json` is hand-tunable for a one-off emergency fix, but the
  **specs in `relight.cjs` are the source of truth** and re-running overwrites
  the file. Fix the spec, not the JSON.
- `relight.cjs --preview` reads `assets/scenes/scene-waterfront.png`, which is
  now a Forge-quantized plate rather than a Canva-era one. Once
  `compose-plate.cjs` exists, point it at a freshly composed plate.
- The plate masters are Canva-era exports with heavy ordered dither. The
  coherence pass tames the worst of what relighting does to that dither, but the
  real fix is Stage 3 composing plates from the Forge kits.
