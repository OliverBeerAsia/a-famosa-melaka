# Stage 5 — Living World Specification

**A Famosa: Streets of Golden Melaka** · v0.12 candidate · design spec, not implementation
Companion draft data: [`data-drafts/`](./data-drafts/)

---

## 0. What this document is

Stage 5 of the overhaul plan is "living, tactile world": NPC schedule walking, business idles,
prop collision, mouse input, minimal U7 openables, and theft-path stakes. This document specifies
the **content and behaviour** half of that — schedules, residents, the break-in scene, openables,
crowd pacing — as buildable data plus the engine contracts that data assumes. It does not
prescribe class structure; that is the engineer's call.

Everything here is grounded in shipped data. Every coordinate was verified against the actual
walk masks in `assets/scenes/masks/` using the same feet-offset test that
`tools/validate-location-data.cjs` applies to spawns (feet at `y + 15` native). Every prop is
cited by its `plateProps.key`. Every dialogue hook is cited by NPC and topic id. Anything that
needs an asset that does not exist yet is in [§9 Dependencies](#9-dependencies) and nowhere else.

### Constraints this spec was written under

| Constraint | Consequence in the spec |
|---|---|
| NPCs walk via walkmask A* | Every station and route waypoint is verified walkable at feet level. Routes are *hints*, not paths — A* fills the gaps. |
| On-camera walk / off-camera teleport + fade | `onCameraWalk` per slot. Cross-location moves are always teleport+fade. |
| No interiors exist | "Indoors" is a despawn at a named door with an effect. Every one of the 24 despawns in this spec names a real door or plate feature. |
| Native 640×360 authoring | All coordinates native. `LocationData.ts` scales ×3 exactly once. |

### The four files

| File | Contains |
|---|---|
| [`npc-schedules.draft.json`](./data-drafts/npc-schedules.draft.json) | Hour-by-hour schedule blocks + beats for all 14 named NPCs |
| [`ambient-residents.draft.json`](./data-drafts/ambient-residents.draft.json) | 15 persistent unnamed residents (3 per location) with 5 barks each |
| [`theft-waterfront-night.draft.json`](./data-drafts/theft-waterfront-night.draft.json) | Patrol route, detection model, telegraphs, consequence chain, dialogue drafts |
| [`openables.draft.json`](./data-drafts/openables.draft.json) | 12 openable objects across the 5 plates |
| [`crowd-pacing.draft.json`](./data-drafts/crowd-pacing.draft.json) | Measured diagnosis + target numbers + two fixes |

---

## 1. The design thesis

Ultima VII's world does not feel alive because its NPCs have complex AI. It feels alive because
**every character's day is legible and repeatable**. You learn that the baker is at the oven in
the morning because you saw it three mornings running, and on the fourth morning you notice he
isn't. Legibility, then repetition, then the break in the pattern — that is the whole mechanism,
and it costs almost nothing beyond authored data.

So the operating rules for this spec:

1. **Stations over wandering.** An NPC standing in a specific place doing a specific thing reads
   as alive. An NPC wandering reads as a bug. Nobody in this spec wanders except Pak Salleh, who
   is carrying crates, which is a job.
2. **The transition is the content.** The player does not care that Aminah is at her stall at
   13:00 and gone at 20:00. The player cares about the walk at 19:00 — the one moment where the
   schedule is *visible*. Every NPC in this spec has at least one signature on-camera transit.
3. **Anchor to what is painted.** Every station cites a prop. This is not decoration: it is what
   stops a future plate re-render from stranding fourteen people in the middle of a road.
4. **Reuse the prose that already exists.** Rashid's `witness` topic says he was mending nets.
   So the station is the net heap. Rudra's schedule text says he reads under the market lantern,
   and there is already a `nightOnly` lantern light at (64,286). Half this spec is just noticing
   that the writing already told us where people stand.
5. **Never punish with a wall.** Getting caught burgling costs money, reputation and a night. It
   never ends the quest.

---

## 2. Schedule system contract

### 2.1 Slot shape

The existing shape in `src/data/npcs.json` is preserved; new keys are additive and the current
engine (`GameScene.isNpcAvailableAtCurrentTime`) ignores them harmlessly, so the data can land
before the code does.

```jsonc
{
  "startHour": 8, "endHour": 18,
  "activity": "Working the street desk outside the warehouse",
  "location": "rua-direita",
  "available": true,

  "station":  { "x": 216, "y": 219 },   // ORIGIN, native px. Feet at y+15.
  "facing":   "down",                    // down|up|left|right on arrival
  "idle":     "tally",                   // business-idle key, §2.3
  "route":    [ {"x":214,"y":206} ],     // waypoint HINTS; A* fills the gaps
  "arriveBy": 9,                         // hour by which the NPC is AT station
  "onCameraWalk": true,

  "exit":  { "door": "tavern", "x": 404, "y": 163, "effect": "door-creak" },
  "enter": { "door": "tavern", "x": 404, "y": 163, "effect": "door-creak" }
}
```

**`arriveBy` is a deadline, not a start time.** The walk begins early enough that the player sees
the *transit*, not a person who has teleported and is now standing somewhere new. Estimate travel
from the route length at the NPC's walk speed and subtract. If the player enters the location
mid-transit, the NPC is caught mid-walk — which is the whole point.

**`route` is hints, not a path.** A* over the walk mask is authoritative. The hints exist to force
a *readable line* — down the centre of the street, along the quay edge — instead of whatever
diagonal the pathfinder prefers. Every waypoint in the draft is walkable at feet level; a hint
that fails validation should be dropped, not clamped.

### 2.2 Doors and the "indoors" fiction

No interiors exist. `available: false` with an `exit` block means:

1. NPC walks to `exit.{x,y}` on camera (or fades if off camera),
2. plays `effect` — a sound plus a 200 ms pause facing the door,
3. fades out over 350 ms.

Re-entry mirrors it. The effect vocabulary and its plate anchors:

| effect | Sound | Used by | Anchor |
|---|---|---|---|
| `door-creak` | wooden door + latch | Gomes, Alvares, Diogo (tavern, warehouse, alley) | `rua-direita.doors[]` |
| `door-iron` | iron-bound door, heavier | Rodrigues, Mesquita | fortress/townhouse |
| `church-door` | large door, stone reverb | Padre Tomás | `st-pauls` church (384,188), approach (404,236) |
| `shutter` | shop shutter running in its track | Chen Wei, Lin Mei | counting house |
| `shutter-bar` | shutter **plus a bar dropping** | Chen Wei at 19:00 only | counting house |
| `plank-creak` | gangplank flex | Rashid | `gangway-50` (176,222) |
| `curtain` | cloth over a doorway, no latch | Mak Enang, Pak Salleh, Aminah | kampung stilt houses |
| `none` | footsteps continue and fade | Aminah, Rudra, Diogo (street lanes) | transition trigger edges |

The distinction between `curtain` and `door-creak` is not decoration. A Malay stilt house has a
cloth doorway; a Portuguese warehouse has a bar and a latch. The player hears the difference
between the two quarters before noticing they've heard anything.

`shutter-bar` exists for exactly one moment in the game: 19:00 on the waterfront, when Chen Wei
bars the counting house. It is the last sound before the quay goes quiet, and the burglar's brief.

### 2.3 Business idles — the vocabulary

Twenty keys. Each is a 2–4 frame loop at 4–6 fps.

| Key | Frames | Who uses it |
|---|---|---|
| `idle-breathe` | 2 | **SHIPPED** — the existing `<id>-idle-<dir>` anims |
| `tally` | 2 | Gomes, Alvares, Lin Mei, Mesquita, Diogo |
| `read` | 2 | Gomes, Chen Wei, Padre Tomás, Rudra, Alvares, Diogo, Mesquita |
| `abacus` | 3 | Lin Mei |
| `weigh` | 3 | Alvares, Mesquita |
| `measure-cloth` | 3 | Rudra, kampung weaver |
| `mend-net` | 3 | Rashid |
| `cast-net` | 3 | Pak Salleh |
| `caulk` | 2 | Pak Salleh |
| `haul` | 4 | Aminah, Pak Salleh, Mak Enang, 3 residents |
| `sweep` | 4 | Siti, hill acolyte |
| `grind` | 3 | Mak Enang |
| `stir-pot` | 3 | Mak Enang, Aminah (kampung evening) |
| `draw-water` | 3 | Siti, 2 residents |
| `fan` | 2 | Aminah, Mak Enang, Rudra, 2 residents |
| `warm-hands` | 2 | Rodrigues, 3 residents, night watch |
| `hammer` | 2 | rua cooper |
| `sword-check` | 2 | Rodrigues, gate sentry |
| `talk-gesture` | 3 | the six `gesturesFrequent: true` NPCs |
| `pray-standing` | 2 | Portuguese NPCs at the Angelus, Rudra at the deepam |
| `pray-kneel` | 3 | Aminah, Rashid, Pak Salleh, Mak Enang |
| `lock-up` | 4 | Lin Mei, 18:00 only |

**Do not author these per NPC.** Twenty loops × fourteen NPCs is 280 sprite strips and it will not
happen. The economical shape is:

- **Overlay strips.** One shared 16×32 strip per idle, drawn over the NPC's existing
  `idle-down` base frame and palette-remapped to that NPC's canon ramp via the Forge's existing
  `remap-canon.cjs`. 20 strips total.
- **Three shared base poses** for the idles that change the silhouette: `seated-cross-legged`
  (mend-net, grind, caulk), `kneeling-sujud` (pray-kneel), `standing-bowed` (pray-standing).
  Three poses × four cultures' dress = 12 base frames, and several are reusable.

**Tier-0 fallback, which should ship first and may be enough:** no new character art at all.
A static prop sprite at the station (a broom leaning, an open ledger, a heap of net, a mortar)
plus a 2-frame ±1 px vertical bob at 3 fps on the existing idle. It reads as "doing something"
from three metres, which is the only distance that matters at our sprite scale. Ship Tier-0 with
Stage 5, upgrade to overlays in Stage 6 alongside the portrait pass.

### 2.4 Beats

Beats are moments, not slots. They do not move the NPC unless they carry their own `station`.

```jsonc
{ "at": "12:00", "kind": "angelus", "duration": 3,
  "idle": "pray-standing", "face": {"x":484,"y":126} }
```

`at` is HH:MM game time, `duration` is game-minutes, `face` turns the NPC toward a world point.

**The world clock everyone shares.** The church bell at 06:00 / 12:00 / 18:00 plays in *all five
locations*. This is not atmosphere — it is the mechanism that makes the schedules feel like one
city rather than five dioramas, and Pak Salleh's shipped `tides` topic already depends on it:

> "The Portuguese post their guard by the church bell. The bell rings at the same hour all year.
> The water does not. You could build a whole life in the gap between those two facts, and some
> men here have."

Beat types in use:

- **Angelus** (06:00 / 12:00 / 18:00) — Portuguese NPCs bare their heads for 1–3 game-minutes.
  Gomes stops. Rodrigues stops. Padre Tomás rings it. **Mesquita gives it one minute.**
  **Alvares does not stop at all** — a deliberate non-beat that characterises him in three
  seconds without a line of dialogue, and which the player will notice on the second day.
- **Zuhr / Asr / Maghrib** — Muslim NPCs pray at 13:00–13:20, ~16:00, ~18:45. Qibla from Melaka
  is roughly WNW, so they face off the west edge of the plate; use the same facing every time.
  Pak Salleh walks to the **surau (474,215)** for zuhr and prays **on the riverbank** for maghrib
  — the difference between the prayer you make time for and the prayer you fit around the tide.
  Aminah prays *behind her stall* rather than leaving it: a working woman's zuhr.
- **Deepam** — Rudra lights a small brass lamp at his stall at 18:30. **No new prop needed**: the
  `nightOnly` lantern at (64,286) already comes on at dusk, and the beat simply syncs him to it.
- **Social beats** — paired, mirrored on both NPCs, 6–20 game-minutes. Nine pairs are specified.
  Chen Wei takes Lin Mei's overnight tally at 08:15. Diogo copies manifests four metres from
  Mesquita at 11:00, in silence, for three hours — which is the customs-ledger quest's entire
  premise, staged.

### 2.5 The signature transits

One per NPC, the moment the schedule becomes visible:

| NPC | Hour | What the player sees |
|---|---|---|
| **Aminah** | 19:00 | Packs the stall and walks the **full length of Rua Direita** east toward the waterfront lane, past the well and both street lanterns. Her `farewellEvening` — "Take the lit route home" — is the route. |
| **Chen Wei** | 18:00 | Crosses the whole east quay from the bollards back to the counting house. The window light comes on. |
| **Lin Mei** | 18:00 | Walks to the same door, turns her back, locks it over 4 seconds with an audible key. |
| **Diogo Almeida** | 11:00 | Walks off the **west edge of Rua Direita** and fades in at A Famosa Gate. The only cross-location move in the cast. |
| **Pak Salleh** | 13:00 | Leaves the crates and walks to the **surau**. |
| **Rodrigues** | 21:00 | Closes the gate. The `gate-queue` crowd path stops spawning and drains by 21:30. |
| **Padre Tomás** | 16:00 | Crosses to the new headstone and stands at it. |
| **Rashid** | 22:00 | Leaves the brazier for the dhow. The brazier keeps burning. |
| **Gomes** | 12:00 | Bares his head toward the church stair mid-tally. |
| **Alvares** | 12:00 | Doesn't. |
| **Mak Enang** | 18:00 | Crosses to the cook fire and stays there until dark. |
| **Siti** | all day | Moves to whichever corner is furthest from the path up from Rua Direita. |
| **Rudra** | 18:00 | Sits under the lantern with his books and is still there at 22:00. |
| **Mesquita** | 21:00 | Locks himself in with the records. |

### 2.6 The one behavioural addition worth arguing for

**Aminah is reachable at home in the kampung, 20:00–22:00.** It costs one schedule slot. It turns
the kampung from a quest cul-de-sac into a place with a reason to visit after dark, it gives the
player who missed her at the market a second chance, and her `kampung`, `children`, `traditions`
and `family` topics all read completely differently spoken at her own cooking fire. It is the
cheapest "living world" win in the entire spec.

---

## 3. Ambient residents

**The tier the game is missing.** Right now there are named NPCs (14, static) and CrowdSystem
transients (spawned, routed, destroyed). Nothing in between. A fishwife who has stood at the same
stall for thirty years is not through-traffic, and modelling her as a spawn-and-destroy tween is
why the plates read as stage sets.

Residents are: created once on location enter, destroyed on location exit, never routed away,
no dialogue tree — **barks only**. 15 of them, 3 per location, 5 barks each, all using crowd
sheets that are **already registered in BootScene**. Zero new art.

Full data in [`ambient-residents.draft.json`](./data-drafts/ambient-residents.draft.json). The cast:

| Location | Residents |
|---|---|
| Rua Direita | water carrier at the well · cooper on the near pavement · porter waiting under the arcade |
| Waterfront | fishwife at the quay stall · sampan boy in the basin · tallyman at the godowns |
| A Famosa Gate | **sentry at the west guarita (24 hours)** · stallkeeper by the gate · woman at the praça well |
| Church Hill (`st-pauls-church`) | gravedigger · widow keeping a new grave · acolyte tending the porch brazier |
| Kampung | weaver at the cloth stall · child running the common · elder on the mats by the surau |

### Bark rules

- Fire on proximity (< 56 native px) or on interact. 30 s per-resident cooldown, no consecutive
  repeats, set reshuffled per in-game day.
- Rendered as world-space floating text (the `showNotification` style), **never** in the dialogue
  box. A resident is not a dialogue partner and must never look like one.
- **Voice constraint:** a resident may repeat what the street believes. A resident may never state
  a fact only a named NPC can confirm, name a quest flag, or contradict `npcs.json`. Every bark in
  the draft was checked against all 14 dialogue trees.
- **Reactive barks** replace the neutral set while a flag holds. Roughly 30 words per location
  makes the whole city notice the quest — the cheapest reactivity in the project, and it uses the
  `worldFlags` plumbing that the design evaluation flagged as "built and almost unused".

The 24-hour gate sentry is load-bearing. A fortress gate with nobody on it at 03:00 is the single
loudest thing wrong with the current night city, and the player *spawns into that location*.

---

## 4. Theft path — the counting-house break-in

Full data in [`theft-waterfront-night.draft.json`](./data-drafts/theft-waterfront-night.draft.json).

### 4.1 Where it currently is

`merchants-seal.json` stages `theft-attempt` → `theft-choice` → `theft-success` are pure state
machine: two objectives resolved by two hardcoded hotspots in `GameScene.createQuestHotspots()`
at (620,250) and (575,235).

**Those two coordinates are in the pre-scrolling 960×540 space.** Against the current
1920×1080 world they resolve to native (207,83) and (192,78) — open harbour water. There is no
walkable pixel within 40 px of either. Fixing those two numbers is a prerequisite for everything
below, and the right fix is to move them into the location file as `openables` and delete the
hardcoded table, per the Stage 1 rule that no per-location coordinate lives in TypeScript.

### 4.2 The stage

The waterfront night quay, read off `waterfront-walk.png` and the nine baked lights:

```
        UPPER (north) QUAY  y≈214-240   — the lit gauntlet
        ├── L3 (326,228) lantern ── L7 (384,222) godown window ── L6 (554,202) ── L2 (646,215)
        └── ONE DARK GAP: x 440-500  ← the escape route
        LOWER (south) QUAY  y≈260-300   — almost entirely shadow
        └── except L4 (240,300) the brazier, a 52px warm pool
```

The player enters the waterfront from Rua Direita at **(34,325)** — the far south-west corner,
550 native px from the counting-house door. The approach is a real traversal of the whole quay.

**The goal is in the light and the road to it is dark.** That is the scene.

### 4.3 The patrol

18 waypoints, verified walkable, cited in full in the draft. Shape:

- **W1 (600,272), the counting-house door — he starts here, dwelling 6 s.** The first thing the
  player ever sees the watch do is stand exactly where the player wants to be.
- W2–W8: west along the dark **south** quay.
- **W9 (240,300), the brazier — dwells 5 s warming his hands, in full light.** Visible from 200 px.
- W10–W16: back east along the lit **upper** quay, through L3, L7, the dark gap at W15, and L6.
- **W17 (610,224) under the east lantern — dwells 4 s looking down at the door, 51 px away.**

At 90 world px/s: **28.7 s of walking + 15 s of dwell = 43.7 s per loop.** Within the 40–50 s
acceptance band.

**Door unwatched window: 27.8 s** (t = 9.6 s → 37.4 s from loop start). Budget: ~9 s to cross the
last dark stretch from the nets, 6 s to work the lock, 4 s to open and slip in, 8 s of slack for a
player who mistimes it once.

### 4.4 Detection

Base: **64 native px, 90° arc**, facing = direction of travel (or the dwell `face`), plus a 20 px
peripheral notice radius.

| Player state | Vision multiplier | Effective range |
|---|---|---|
| Inside any `nightOnly` light pool | ×1.6 | 102 px |
| Inside the guard's own lantern pool (r40) | ×2.0 | 128 px — no walking past him in the dark |
| In shadow | ×0.55 | 35 px |
| In shadow **and stationary > 1.0 s** | ×0.55 × 0.7 | 24 px |
| Behind a walk-behind overlay (`waterfront-fg-0`/`-1`) | ×0.0 | hard occlusion |

Freezing behind the bale stack works, and it is the only mechanic in the scene the player has to
discover rather than be told. The two shipped foreground overlays become cover, which is free —
they already have geometry and depth.

Noise: walking the **wooden pier** (the mask's `wood` strip, x 32–160) carries 34 px; stone and
dirt carry nothing; running carries 48 px; a failed lock attempt carries 56 px.

Three states: **unaware → suspicious → alerted.** Suspicious raises the lantern (pool r40 → r56
for 2 s), walks to the last-known point, sweeps 3 s, resumes. Critically, **a suspicious guard is
off his timetable** — the 27.8 s window is void until he returns to unaware, so the player must
re-read him rather than re-count. Alerted = one shout, a 140 px/s close, and a grab. No combat.
He is not a health bar; he is a consequence.

### 4.5 Player-visible telegraphs

Seven, all made of things that happen anyway:

| | When | What |
|---|---|---|
| T1 | 18:00 daily | Chen Wei crosses the quay and goes in. The counting-house window lights. |
| T2 | 18:00 daily | Lin Mei locks the door over 4 s, back to the player, audible key. |
| T3 | 19:00 daily | The window goes out and the **bar drops**. |
| T4 | 22:00 daily | Rashid leaves. The brazier keeps burning — the last friendly face goes, the light that will give you away stays. |
| T5 | 22:00 daily | The watch appears at the door and begins the loop. |
| T6 | always | **The lantern pool arrives around a corner ~1.4 s before he does.** Light leads the man. |
| T7 | dialogue | Pak Salleh's shipped `tides` topic, plus a new `the-gap` unlock that hands over the actual rhythm. |

**Dousing.** Verified on the shipped data: for all four `lantern-post` props on the waterfront,
`light.y == prop.y − 42` and `light.x == prop.x` exactly. The lantern posts **are** the practicals.
Dousing `lantern-post-96` (646,257) kills light 2 — the pool the guard stands in at W17 while
looking at the door. Nothing new needs painting to make this legible.

Dousing is not free. On his next pass the guard sees the dead lamp, goes suspicious *there*,
relights it over 10 s, and the night's alert level rises. At level 2 his vision gains +20%; at
level 3 he stops patrolling and **posts at the door for the rest of the night**, which ends the
attempt without ever catching the player. That is the cleanest possible failure: nothing happened
to you, and you still lost.

### 4.6 Caught — the fail-forward chain

**Caught is not game over.** Guard shout, 600 ms fade, and the player wakes at the A Famosa Gate
spawn at 06:00 the following day with Rodrigues 42 px away, facing them, speaking first.

| | First catch | Second catch |
|---|---|---|
| Flags | `caught-at-counting-house`, `theft-attempt-1-failed`, `night-watch-doubled` | `+ player-known-thief`, `theft-path-closed` |
| Reputation | chinese-merchants −10, portuguese −6 | same again |
| Fine | min(money, 40), **receipted** | same |
| Confiscated | `trading-seal` if held (returned to Chen Wei), `key-warehouse` if held | same |
| Quest | returns to `choose-path`; theft path still open | theft path removed; payment / diplomatic / truth all still completable |

The reputation hit is **deliberately far lighter than the −30 for a successful theft**. Getting
caught trying is embarrassing. Getting away with it is the thing Chen Wei will not forgive.

The fine comes with a piece of paper, because Mesquita's shipped `gratuities` topic establishes
that he issues receipts in his own hand — "which no thief would do". It is funnier and more
damning than taking the money silently.

**Economy check.** 40 cruzados against the shipped 525-raisable economy (Alvares 40 + pepper 55 +
Rudra 180 + Chen Wei advance 250). Two catches cost 80, leaving 445 against a 500 debt — the
player must then also do the pepper run they might have skipped. **Losing makes the honest path
longer, not impossible.**

**Second-attempt stakes, all made of things the player already saw fail:**
a second watchman running the upper quay in reverse at half-loop offset (window collapses 27.8 s
→ ~7 s); the shutter **barred**, needing `key-warehouse` — which already exists in the world at
a-famosa-gate (184,307) and has never had a lock to fit; and the east lantern relit nightly.
Nothing new is introduced at the moment of punishment.

**Absolution.** Padre Tomás's shipped `seal-stolen` greeting already offers the confessional —
"a burden set down early is a smaller burden than one carried into the dry season." A new
`confession-theft` topic keeps that promise: 20 cruzados alms, +5 chinese-merchants, sets
`confessed-theft` which softens Aminah's and Rashid's wary greetings. His penance is not
suffering; it is **being visible again** — front third, Sunday Mass, where the people you
embarrassed yourself in front of have to look at you.

### 4.7 Dialogue hooks

**Six existing greetingVariants already cover the successful theft** (Gomes, Rodrigues, Padre
Tomás, Aminah, Chen Wei, Rashid) — they were written and are correct; the scene above is what
makes their price feel earned instead of announced.

**Gaps filled by drafts in the JSON:**

| NPC | Topic / variant | Gate |
|---|---|---|
| pak-salleh | `the-gap` (unlocked from shipped `tides`) | — |
| capitao-rodrigues | `night-complaint` | `caught-at-counting-house` |
| chen-wei | `broken-shutter` | `theft-attempt-1-failed` |
| chen-wei | `restitution` | `theft-attempt-1-failed`, not `player-known-thief` |
| **lin-mei** | **greetingVariant** — she is the person who locked that door and is the only principal with no thief variant | `seal-stolen` / `player-is-thief` / `theft-attempt-1-failed` |
| padre-tomas | `confession-theft` | `caught-at-counting-house` |
| rashid | `night-watch` | `rashid-trusts-player` / `dockside-cover` |

One existing line needs a one-word change: `chen-wei.seal-advance.availability.worldFlagsNone`
should gain `caught-at-counting-house`. A house does not advance 250 cruzados to a man its own
watchman dragged off the quay.

---

## 5. Openables

12 objects, full data in [`openables.draft.json`](./data-drafts/openables.draft.json).

**Design rule: an openable is not a new prop.** It is a flag on a prop that already exists, plus
contents, plus two lines of prose. The whole feature ships without a single new sprite.

| # | Location | Prop | Contents | Lock |
|---|---|---|---|---|
| 1 | waterfront | `customs-house` → **counting-house drawer** | `trading-seal` | inside the building |
| 2 | waterfront | `bonded-chest` (lore obj) | 30 cruzados, `letter-of-credit` | **`key-warehouse`** |
| 3 | waterfront | `godown-tin` — "the bar is new" | 15 cruzados, `saw-the-tin-shortfall` | key **+** standing |
| 4 | waterfront | `barrel-open-68` | 2 cruzados | — |
| 5 | waterfront | `crate-63` | `spice-sample` | — |
| 6 | rua-direita | `crate-37` → **Gomes's warehouse strongbox** | 12 cruzados, `cargo-manifest`, `saw-gomes-books` | quest active |
| 7 | rua-direita | `crate-stack-62` — Alvares's tally crates | tally progress | tally contract |
| 8 | rua-direita | `handcart-22` | `cargo-manifest` in a leaning fee column | — |
| 9 | rua-direita | `chicken-coop-57` | 2 eggs, one loose hen | — |
| 10 | a-famosa | `powder` | **nothing but trouble** | — |
| 11 | a-famosa | `gate-stall` | 5 cruzados | — |
| 12 | st-pauls | `churchyard-well` | `rosary` | — |
| 13 | kampung | `mats` | `medicinal-herbs` | — |
| 14 | kampung | `chicken-coop-40` | 3 eggs | — |

*(14 listed; 12 is the minimum shippable set — 4, 9, 11 and 14 are the trims.)*

Three of these do real narrative work:

- **#6, Gomes's strongbox.** Contains a manifest with **three voyages entered where he told you
  there was one**. The player who opens it has *physically seen* what Rashid's `gomes-debt`
  override tells them later. His `rest` topic already says the player is welcome in that yard,
  which is what makes the box a moral question rather than a lock. `saw-gomes-books` should give
  the truth-confrontation stage a harder opening line.
- **#2, the bonded chest.** `key-warehouse` has sat at A Famosa Gate since v0.10 unlocking
  nothing. This gives the shipped key a shipped door.
- **#10, the powder store.** The only openable in the game that is a pure trap: nothing the player
  needs, −20 Portuguese, and Rodrigues's `duty` and `garrison` topics establish exactly how he
  takes it. It costs the player the faction whose Capitão gates the diplomatic path — a lesson,
  not a wall.

**`witnessed`** — opening a container in daylight with crowd or a named NPC within 80 px sets
`petty-theft-witnessed`. Note that the rua-direita cooper resident stands 44 px from Alvares's
tally crates from 07:00 to 18:00, which is not an accident.

**`emptyText` is the writing that matters.** It is the line the player reads most often. It should
never be "It is empty."

> *"He does not lock it. That is either trust or the certainty that nobody would dare, and after
> this week you are no longer sure which."*

**Art:** Tier-0 is no sprite change at all — prompt, notification, label flips to `emptyText`.
Tier-1 is one lid-ajar frame per prop **type** (12 sprites, reusable across every instance on
every plate). Ship Tier-0. The value is in the contents and the prose, not the hinge.

---

## 6. Crowd pacing

Full measurement and both fixes in [`crowd-pacing.draft.json`](./data-drafts/crowd-pacing.draft.json).

### The diagnosis, measured

Population is governed by the **spawn interval**, not by `maxCrowd`. `trySpawnCrowdMember()` fires
once per `3000 / density` ms and spawns *at most one*; members die when their tween chain
completes. So steady state = (mean route duration) / (spawn interval), and `maxCrowd` is a ceiling
that **none of the five locations ever reaches**.

| Location | maxCrowd | density | spawn every | mean route | **steady state** | **≈ on screen** |
|---|---|---|---|---|---|---|
| a-famosa-gate | 12 | 0.5 | 6.0 s | 9.6 s | **1.6** | **0.4** |
| rua-direita | 14 | 1.0 | 3.0 s | 13.3 s | **4.4** | **1.1** |
| waterfront | 14 | 0.8 | 3.75 s | 10.2 s | **2.7** | **0.7** |
| st-pauls-church | 8 | 0.3 | 10.0 s | 10.7 s | **1.1** | **0.3** |
| kampung | 10 | 0.7 | 4.29 s | 8.2 s | **1.9** | **0.5** |

The benchmark asks for ≥2 per screen and ≥5 on Rua Direita. **"A Famosa reads sparse" is not a
perception problem — the location holds 1.6 people and shows 0.4 of them.** "Crowded" is one of
the seven atmosphere keywords in `CLAUDE.md` and it is currently the only one the engine actively
contradicts.

Two compounding causes: the world grew 4× at v0.11.0 and the crowd budget did not; and the
`balanced` quality cap of 10 sits below four of the five proposed `maxCrowd` values, so it would
silently clamp any data-only fix.

**Bonus bug:** the per-path `speed` field authored in every location file is **dead data** —
`CrowdSystem` reads `CROWD_TYPES[type].speed` and never `path.speed`. Wire it as a per-path
multiplier (the crane gang should shuffle, the street should stride) or delete it from the schema.
Right now it silently lies to the author.

### Targets

| Location | world target | on screen | `maxCrowd` | `density` (Fix A) |
|---|---|---|---|---|
| rua-direita | 22 | 6 | 24 | 5.0 |
| waterfront | 18 | 5 | 20 | 5.3 |
| a-famosa-gate | 14 | 4 | 16 | 4.4 |
| kampung | 10 | 3 | 12 | 3.7 |
| st-pauls-church | 6 | 2 | 8 | 1.7 |

Plus `getMaxCrowdCap` → low 10 / balanced 24 / high 32.

### Fix A (data-only, ships in an hour) vs Fix B (correct)

**Fix A** is the ten numbers above plus the quality caps. Residual tell: the world visibly fills
from the route endpoints for ~12 s after a location load.

**Fix B** is three small `CrowdSystem` changes after which `maxCrowd` means what the author thinks:

- **B1** — top up toward `effectiveMax` (max 2 per tick) instead of one per tick.
- **B2** — random start offset `t ∈ [0, 0.6]` along the route, so a location load presents a
  street that was *already* busy.
- **B3** — weight path selection by route duration and honour the dead `speed` field. Short loops
  like `crane-gang` (6 s) currently get the same spawn share as `west-east-street` (22 s), so they
  churn while the long routes starve.

### Time of day

`TIME_DENSITY` should become **dawn 0.45 / day 1.0 / dusk 0.8 / night 0.15**. Dusk is the busiest
hour of a tropical trading port, not a 40% reduction — the heat has broken, the lighters are up,
the market is clearing stock, the Angelus has just rung. Night goes *down*, because the ambient
residents now provide the floor and they are a far better night population than randomly-routed
transients: they are where they should be, doing something, with a bark.

Combined with the schedules, the "city empty after 22:00" failure is fixed without more crowd:
the gate sentry (24 h), the arcade porter (to 22:00), Rudra under his lantern (to 22:00), Rashid
at the brazier (to 22:00), Siti in the porch (all night), the acolyte and the kampung elder (to
21:00), and the night watch (22:00–04:00).

---

## 7. Ordering

The spec is deliberately layered so each layer ships something visible on its own.

1. **Crowd pacing Fix A + quality caps.** One hour, five files, biggest single perceived change.
2. **Ambient residents.** No new art, no new engine subsystem beyond "spawn these and don't route
   them away". Fixes the night city.
3. **Openables at Tier-0.** No new art. The prose is already written in the drafts.
4. **Schedule stations + teleport-on-hour with fade.** Replaces the destroy/recreate at
   `GameScene.recreateNPCs()`. NPCs are now in the right *places* even before they walk.
5. **A\* walking + `arriveBy` + door despawns.** The transitions become visible. This is the
   milestone the whole stage is named after.
6. **Business idles at Tier-0** (static prop + bob), then overlays in Stage 6.
7. **The theft scene.** Needs 4 and 5 in place for the telegraphs to exist, and needs the two
   stale hotspot coordinates fixed first.
8. **Crowd Fix B**, once there is a real perf baseline to measure against.

---

## 8. Acceptance checklist

Fifteen testable assertions. Each is a thing a tester can sit down and observe.

| # | Assertion |
|---|---|
| **A1** | `tools/validate-location-data.cjs` runs the feet-walkability test (`mask(x, y+15)`) over **every schedule station, every route waypoint, every resident station, every patrol waypoint and every openable approach**, and fails the build on any miss. All coordinates in `data-drafts/` pass today. |
| **A2** | At 19:00, standing at the Rua Direita well, Aminah is observed leaving her stall (104,236) and walking east past the player to the east lane (612,248), then fading. Total transit is on camera and takes 20–35 s. |
| **A3** | The waterfront night watch completes one full patrol loop in **40–50 s** measured door-to-door, and dwells visibly at the counting-house door, the brazier and the east lantern. |
| **A4** | Standing still in shadow behind `crate-stack-61` (486,289) while the guard passes within **55** native px does **not** trigger detection. Standing in the brazier pool (240,300) at 100 px **does**. |
| **A5** | Being caught returns the player to the A Famosa Gate spawn at 06:00 with ≤40 cruzados removed and a receipt in inventory. The quest is at `choose-path` and the theft path is still selectable. |
| **A6** | Being caught a **second** time removes the theft path from `choose-path`, and the payment, diplomatic and investigate-truth paths all still complete to `seal-recovered`. |
| **A7** | At 11:00, Diogo Almeida is **not** on Rua Direita and **is** at A Famosa Gate (500,268). His `ledger` / `books` / `gaspar` topics are reachable there, and `objective-markers.json` points at the right location. |
| **A8** | At 13:05 in the kampung, Pak Salleh is observed walking from the landing to the surau (479,233) and kneeling. He is at the riverbank, not the surau, for maghrib at 18:45. |
| **A9** | At 12:00 on Rua Direita the bell rings, Gomes bares his head, and **Alvares does not stop weighing**. |
| **A10** | At 18:00 on the waterfront, Chen Wei walks to the counting-house door and the window light comes on; Lin Mei locks the door over ~4 s; at 19:00 the light goes out and a bar drops. All three are observable from the quay without entering any interaction. |
| **A11** | At 23:00 **at least one human is visible across the five locations taken together** (the night watch qualifies), and the waterfront patrol is running. A Famosa Gate has a sentry at the guarita at 03:00 — `residents.json a-famosa-gate.gate-sentry`, `hours: [0, 24]`. Empty streets at that hour are correct — see the amendment note below. |
| **A12** | With `?crowdstats=1`, on-screen crowd + residents at 13:00 is ≥6 on Rua Direita, ≥5 on the waterfront, ≥4 at A Famosa Gate, ≥3 in the kampung, ≥2 on the church hill. |
| **A13** | Opening Gomes's warehouse strongbox sets `saw-gomes-books` and yields a manifest showing three voyages; the later truth-confrontation acknowledges it. |
| **A14** | `key-warehouse` (a-famosa-gate 184,307) opens the waterfront `bonded-chest` and nothing else opens it. |
| **A15** | Every `emptyText` in `openables.draft.json` is reachable in one playthrough and none of them reads "It is empty." |

### Two assertions amended after implementation

Both were found unsatisfiable while running this checklist in-engine, and both
were wrong in the *assertion*, not in the thing being asserted.

- **A4 was 40 px, and is now 55.** §4.4 gives the guard's carried lantern a
  radius of 40 native px and rules that a player inside it is spotted at ×2.0 —
  i.e. guaranteed. So "not detected at 40 px" and "always detected inside r40"
  are the same distance, and the original assertion contradicted the detection
  model two sections above it. Measured behaviour is exactly what §4.4
  specifies: frozen in shadow the player is invisible down to ~41 px and is
  taken at 34–36 px, because by then they are standing in his lamplight. 55 px
  is the nearest figure that tests the freeze mechanic rather than the lantern.

- **A11 asked for ≥2 visible characters everywhere at 23:00, and now asks for
  one.** The residents in `ambient-residents.draft.json` are authored to go home
  — the rua porter at 22:00, the kampung elder and the hill acolyte at 21:00 —
  so at 23:00 Rua Direita and the kampung hold nobody but through-traffic. That
  is not a gap in the data; it is 1580. The night is supposed to belong to the
  watch, the insects and the practicals, and a market street that still has two
  people standing in it at eleven at night would read as a stage set with the
  lights left on. **Do not extend the residents' hours to satisfy a number.**

Regression guards worth adding at the same time:

- **A16** — no coordinate anywhere in `src/phaser/` addresses a specific location. The two stale
  merchants-seal hotspots are the last two; delete them and add a lint rule.
- **A17** — bark text is checked against `npcs.json` topic text for contradictions in CI (a simple
  banned-phrase list: no resident may say a number, a name from the cast, or a flag word).

---

## 9. Dependencies

Things this spec needs that do not exist yet, in priority order.

### D1 — The counting house does not exist on the waterfront plate · **blocking for §4**

`src/data/plate-layouts/waterfront.json` has three `godown`s, one `customs-shed`, and no counting
house. Chen Wei stands at (547,251) between the customs shed and the tin godown, and the
`guild-board` (630,262) — "the board of the Fujian merchants' association" — hangs on nothing.

- **Primary (recommended):** add a `counting-house` module to the arch-dock kit — 2-storey Chinese
  shophouse front, shuttered upper window — at authoring coords ≈ s 33.5 / dd 17.5 (screen ≈
  600,268), filling the currently-empty walkable east corner (x 592–640, y 240–300). Move
  `guild-board` onto its façade. Door anchor **(596,296)**. Add its `window` light at (578,214)
  r30 with an `hours: [18,19]` window — the first light in the game with a schedule, and the
  entire T1/T3 telegraph.
- **Fallback (zero new art, and what the drafts are authored against):** designate the existing
  customs-shed block (mask-blocked x 536–616, y 232–256) as the shared *Casa da Alfândega* — the
  customs house below, the Chinese counting rooms rented above. Door anchor **(570,262)**, one
  added clause in `customs-house.examineText`, Chen Wei's station moves to (556,262).

Everything in `theft-waterfront-night.draft.json` is authored against the **fallback** and shifts
by (+26, +34) under the primary.

### D2 — Business-idle frames · **§2.3**

20 shared overlay strips (2–4 frames each) + 3 shared base poses (`seated-cross-legged`,
`kneeling-sujud`, `standing-bowed`). **Tier-0 fallback ships without any of it**: static prop at
the station + 2-frame bob. Do not block Stage 5 on this.

### D3 — No barracks door at A Famosa Gate · **§2.2**

`a-famosa-gate.location.json doors[]` has one entry at (33,364), which is **off the bottom of the
360 px plate** — feet would be at y 379. Rodrigues's 14:00 and 22:00 despawns currently use a
west-postern fiction at (37,243), walking him off past the `a-famosa-wall` prop. Either add a real
door anchor on the fortress wall line, or accept the west-postern fade. Same issue for Mesquita,
who uses the townhouse behind overlay `a-famosa-gate-fg-1` (499,232) at (548,296) — that one is
walkable and fine, but it is an inferred door, not a declared one.

**Suggestion:** add a `doors[]` entry per location per fiction door used by a schedule, and have
the validator assert each one is on-plate and has a walkable approach. Nine doors total across the
five plates.

### D4 — No customs table prop at A Famosa Gate · **§2.3, Mesquita 12:00**

He currently sets his papers against the `pelourinho` (400,264) — the public whipping post — which
is characterful enough that this may be the better answer. If a folding customs table is wanted,
it is one small prop in the `props` kit.

### D5 — No Hindu/Tamil devotional prop · **§2.4, Rudra deepam**

The spec deliberately avoids needing one: Rudra's 18:30 deepam beat syncs to the *existing*
(64,286) lantern coming on. If a small brass lamp on the stall corner is wanted later, it is one
8×8 prop. **This is worth doing in Stage 6** — Melaka's fourth culture currently has no material
presence on any plate.

### D6 — Faction key inconsistency · **§4.6**

`merchants-seal.json` uses `reputation: { chinese: ... }`. `npcs.json chen-wei.seal-advance`
uses `reputation: { "chinese-merchants": 6 }`. One of these is not being read. Pick one, migrate,
and add a validator assertion over the faction key set.

### D7 — New item: `egg` · **§5**

Needs a definition and a 16×16 icon. Value 1 cruzado. The only new item in the entire spec. If it
is not wanted, trim openables #9 and #14.

### D8 — Rudra Mudaliar still has no sprite of his own

`npcs.json rudra-mudaliar` carries a `_portraitDebt` note and `"sprite": "rashid"`. Two of the
14 scheduled NPCs will be visibly the same man standing 400 px apart on Rua Direita and the
waterfront at 15:00 every day. Stage 5 makes this **more** visible, not less, because both are now
reliably at known stations. It belongs in Stage 6 but Stage 5 is the reason it becomes urgent.

### D9 — Engine fixes assumed by this spec

| | Fix |
|---|---|
| E1 | `GameScene.ts:1602` / `:1622` quest hotspots (620,250) and (575,235) → the counting-house anchor. Currently resolve into open harbour water. Best done by moving them into the location file as openables. |
| E2 | `GameScene.recreateNPCs()` destroys and rebuilds all NPCs on the hour. Replace with per-NPC slot transition. |
| E3 | `CrowdSystem` per-path `speed` is dead data — wire or delete. |
| E4 | `getMaxCrowdCap` balanced cap of 10 clamps any crowd data fix. |
| E5 | `merchants-seal.json` `theft` path requirements need `worldFlagsNone: ["theft-path-closed"]`. |
| E6 | The `stealth` objective on `theft-attempt` should complete on **entering**, not on approaching, so being caught before entry does not silently satisfy it. |

---

## 10. What this spec deliberately does not do

- **No dynamic NPC needs.** No hunger, no fatigue, no relationship simulation. Ultima VII didn't
  have them either; the schedules carry it.
- **No NPC-to-NPC pathing conflicts.** Social beats are mirrored *facings*, not meetings. Two
  characters converging on a point is a bug generator with no payoff at this sprite scale.
- **No crowd reaction to the player beyond barks.** Making the crowd part is Stage 6 juice.
- **No interiors.** Every "indoors" in this document is a fade at a door, and the spec is written
  so that adding interiors later replaces the fade without touching the schedules.
- **No new quests.** Every flag introduced here hangs off `merchants-seal`, `customs-ledger` or
  `padres-dilemma`, all of which already ship.
