# Next Visual Improvements

**Date**: March 21, 2026  
**Standard**: Ultima VIII minimum, historically grounded 1580 Melaka, gameplay-first

## Current Direction

The live isometric runtime is the shipping source of truth. Scene backdrops, portraits, and concept art are support assets, not substitutes for weak gameplay maps.

The immediate visual bar is:

- Dense authored traversal, not empty transition corridors
- Strong silhouette readability for the player and named cast
- Historically specific Melaka atmosphere instead of generic tropical fantasy
- Believable commercial, domestic, sacred, and maritime spaces
- UI and dialogue presentation that matches the quality of the live world

## Active Baseline

These standards are now expected in the playable game:

- `Rua Direita` is the reference hero slice
- `Waterfront` and `Kampung` are being brought to the same live layering contract
- Named dialogue NPCs should have unique portrait assets, not aliases
- Bio portraits should read as late-80s / early-90s VGA pixel portraits, not painted key art
- Save/load, interaction targeting, and movement feel are part of visual quality because weak control feel cheapens the art

## Medium-Term Plan

### Phase 1: Hero Slice Parity

- Keep `Rua Direita`, `Waterfront`, and `Kampung` visually dense across the full route, especially toward exits
- Enforce `Ground`, `Walls`, `Objects`, `Props`, `Overhang`, `Canopy`, and `Highlights` as the standard live map stack
- Keep environment clusters historically grounded:
  - Portuguese mercantile frontage in `Rua Direita`
  - Maritime trade complexity in `Waterfront`
  - Domestic Malay village life in `Kampung`
- Finish unique portrait coverage, keep the full named cast readable in dialogue, and maintain a consistent VGA portrait family

### Phase 2: Parity for A Famosa and St. Paul’s

- `A Famosa`:
  - stronger fortress massing
  - artillery and guard staging
  - authority markers and colonial wear
- `St. Paul’s`:
  - processional ascent
  - graveyard rhythm and sacred objects
  - hilltop vista framing and sanctuary tone
- Both maps must pass the same density and authored-spread checks as the hero slices

### Phase 3: Character Art Upgrade

- Raise all named character sheets to a tighter cultural and silhouette bar
- Keep portraits and character sheets adjacent in sensibility: crisp, limited-palette, UI-legible
- Improve idle and talk frame readability before adding more exotic animation work
- Keep costume logic historically specific:
  - Portuguese merchant, soldier, and clergy distinctions
  - Malay domestic and market clothing with real material cues
  - Chinese merchant dress with stronger social-class signals
  - Arab sailor silhouettes that read instantly at gameplay scale
- Do not mix pixel densities or painting styles inside the live runtime

### Phase 4: Believability Pass

- Add stronger historical reference checks per location before visual sign-off
- Tune object placement to imply actual use:
  - where goods are weighed
  - where prayers happen
  - where meals are cooked
  - where cargo bottlenecks form
- Reduce “set dressing for its own sake” and favor spaces that feel inhabited

### Phase 5: Gameplay Feel and Presentation

- Keep movement response crisp and legible
- Improve NPC facing, talk staging, and topic flow so conversation feels authored rather than mechanical
- Continue integrating portrait, inventory, and dialogue art into the live game
- Build toward deeper RPG texture through faction trust, quest branching, and time-sensitive leads without abandoning the current city-slice scope
- Validate dawn/day/dusk/night readability on every upgraded map

## Acceptance Criteria

- No upgraded map should have a dead final third near a transition
- No named dialogue NPC should ship with an alias portrait
- Every upgraded location should communicate its identity in a single screenshot
- Historical specificity should be visible without reading the codex text
- Visual integrity tests should fail when layer richness, portrait coverage, or authored spread regress

## Guardrails

- Do not let cinematic PNGs hide weak gameplay spaces
- Do not accept “pretty but generic” as success
- Do not expand scope without also expanding tests and validation
- Do not treat movement, interaction, and dialogue feel as separate from graphics quality
