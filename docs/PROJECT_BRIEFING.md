# A Famosa: Streets of Golden Melaka
## Project Briefing

## Vision

Build a historically grounded adventure RPG set in Portuguese Melaka circa 1580. The game should feel like a dense, atmospheric, interactive city slice where colonial power, trade, faith, and local life collide in believable physical spaces.

The minimum benchmark is not "pleasant retro pixel art." The minimum benchmark is Ultima VIII-grade density, mood, and physical readability, adapted to Southeast Asian history rather than copied fantasy tropes.

## Product Position

- Live shipping experience: Phaser-based isometric traversal with React UI
- Visual priority: gameplay-first readability, not cinematic backdrops hiding weak level design
- Historical priority: specific Melaka references over generic colonial or tropical dressing
- Player promise: a small but convincing adventure-RPG slice with strong atmosphere, clear interaction verbs, and places that feel used

## Core Pillars

### 1. Historical specificity

- Portuguese military, mercantile, and ecclesiastical presence must read clearly
- Malay domestic and market life must feel lived-in rather than ornamental
- Chinese, Indian, and Arab trade presence must shape the world materially
- The city should feel like a working port under empire, not a neutral fantasy town

### 2. Physical world density

- Streets, docks, church grounds, fortress edges, and village spaces should be thick with plausible use-patterns
- Exits and transitions should be staged by landmarks, clutter, and route readability rather than labels alone
- Important objects should feel placed for a reason: weighing, cooking, worship, storage, transport, surveillance

### 3. Legible adventure flow

- Movement should feel precise and intentional
- Talking, examining, taking, and traveling should feel like distinct verbs
- The first ten minutes should teach through context rather than permanent instruction clutter
- Quests should emerge through space, conversation, and material detail together

### 4. Cohesive visual language

- Named cast portraits should live in one VGA-family style
- Gameplay sheets should remain crisp and readable at runtime scale
- UI should feel part of the world, not bolted on top of it
- Time-of-day changes should preserve legibility, not only add atmosphere

## World Scope

The current playable city slice centers on five locations:

1. `A Famosa Gate`
2. `Rua Direita`
3. `St. Paul's Church`
4. `Waterfront`
5. `Kampung`

Each location must communicate a distinct function in one screenshot:

- `A Famosa Gate`: authority, surveillance, artillery, colonial control
- `Rua Direita`: mercantile frontage, civic compression, market movement
- `St. Paul's Church`: sacred ascent, ritual calm, elevated overlook
- `Waterfront`: cargo, trade friction, ship service, multilingual commerce
- `Kampung`: domestic life, prayer, food work, planted edges, village rhythm

## Character and Presentation Bar

- Named gameplay sheets stay on the current `64x192` / `4x6` contract for now
- Portraits are late-80s / early-90s VGA-style pixel bios
- The player and named cast need stronger role, age, and status readability at a glance
- Dialogue and inventory presentation should support the same visual logic as the world

## Current Design Standard

### Map contract

Shipping isometric locations should use:

- `Ground`
- `Walls`
- `Objects`
- `Props`
- `Overhang`
- `Canopy`
- `Highlights`

### Interaction standard

- Facing-aware interaction targeting
- One clear prompt for the nearest meaningful target
- Short travel and conversation staging
- Cleaner return to free control after interaction

### Validation standard

Every release should keep:

- build passing
- tests passing
- strict art validation passing
- map richness and authored spread protected by regression tests

## Current Milestone

The project has moved past prototype status. The current shipping milestone is the customs-spine foundation:

- a live interlocked quest route across `Rua Direita`, `Waterfront`, `A Famosa Gate`, and `Kampung`
- six implicit trust blocs instead of the older four-faction placeholder model
- stateful route access, greeting variation, and path gating driven by quest/world state
- authored witness NPCs and material evidence spaces instead of isolated quest topics

The next milestone is to deepen that foundation rather than restart elsewhere:

- rebuild `Pirates on the Horizon` into the next full reactive quest cluster
- push the same standards into `St. Paul's Church` and `Kampung`
- replace stopgap customs-spine character art with bespoke gameplay sheets and portraits
- continue improving early flow, conversation pacing, and historical behavior

## RPG Growth Direction

The game should gradually deepen into a stronger RPG without pretending it is already a giant party-based CRPG or a province-scale simulation.

The practical target is:

- authored quest density and consequence clarity inspired by **Baldur's Gate**
- systemic faction, reputation, and time-pressure logic inspired by **Daggerfall**
- all of it filtered through the scale of one believable Melaka city slice

This means:

- more overlapping quests in shared spaces
- more than one viable resolution path when possible
- stronger factional consequences for trade, faith, military authority, and local trust
- light systemic depth before any huge content expansion

It does **not** mean:

- instantly adding massive procedural sprawl
- generic fantasy guild content with Melaka names pasted on top
- adding party systems, classes, or continents before the current city slice feels finished

See `docs/DESIGN_STANDARDS.md` and `docs/RPG_EXPANSION_PLAN.md` for the working rules.
