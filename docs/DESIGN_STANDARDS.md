# Design Standards

This document is the non-negotiable product standard for art, design, atmosphere, storytelling, and player experience.

## Non-Negotiables

1. The live isometric runtime is the shipping truth.
2. Historical 1580 Melaka specificity beats generic fantasy or generic colonial dressing.
3. Ultima VIII-quality density and mood is the minimum bar, not a stretch goal.
4. Graphics quality, gameplay feel, and narrative believability are one problem, not three separate tracks.

## Art Standards

### Environment

- Every major location must communicate its role in one screenshot.
- Dead final thirds near transitions are unacceptable.
- Props must imply use, not just fill space.
- Architectural logic matters:
  - fortress spaces should control movement
  - church spaces should stage ascent, ritual, and overlook
  - mercantile streets should compress movement and visibility
  - waterfront spaces should show labor and cargo pressure
  - kampung spaces should show domestic rhythm and softer edges

### Characters

- Named gameplay sheets must read role, age, and status at gameplay scale.
- Portraits and sheets should feel like members of the same visual family.
- Silhouette clarity matters more than ornamental detail.

### Items

- Important items should look important both in the inventory and in-world.
- Documents, seals, contraband, devotional items, and trade goods should not collapse into generic loot presentation.

## Atmosphere Standards

- Atmosphere should emerge from layout, motion, light, sound, and pacing together.
- Warmth alone is not enough; the city must feel humid, busy, tense, and inhabited.
- The player should sense faith, trade, labor, and colonial control without reading an exposition block.

See `ATMOSPHERIC_SYSTEMS.md` for the operational atmosphere bar.

## Storytelling Standards

### Environmental storytelling

- A space should show what people do there before an NPC explains it.
- Routes, bottlenecks, shrines, guard posts, ledgers, storage, and food work should all help tell the story.

### Dialogue and quests

- Dialogue should expose agendas, pressure, rumor, and factional interests, not only lore.
- Quests should emerge from the city's power structure:
  - merchants
  - clergy
  - soldiers
  - guild representatives
  - sailors
  - villagers
- Quest content must feel local to Melaka and the Straits trade world.
- Important quest lines should share consequences, flags, or witnesses where that makes sense. Isolated "mission bubbles" are below standard.

### RPG state and consequence

- Reputation should be mostly implicit and surfaced through access, tone, route permission, witness trust, and journal language.
- `City Currents` style summaries are acceptable; raw faction meters in the exploration HUD are not the default presentation.
- Restricted routes, bonded spaces, and service access should open because the city state changed, not because the player touched a generic unlock switch.

### Experience tone

- The game should feel authored and deliberate, not noisy or over-explained.
- UI copy, prompts, transitions, and journal updates should support atmosphere rather than break it.

## Experience Standards

### Opening quality bar

The first 10 minutes should establish:

- movement confidence
- one meaningful conversation
- one clear lead
- one reason to care about the city
- one sense that multiple interests are already colliding

### Interaction quality bar

- `Talk`, `Take`, `Examine`, and `Travel` should feel like distinct verbs.
- Interaction targeting should be readable and low-friction.
- The player should not fight the controls to appreciate the art.

### Release quality bar

A release should not be called polished unless:

- the build passes (`npm run build` — includes prebuild structural validation)
- tests pass (`npm test` — includes pretest style validation)
- strict art validation passes (`npm run validate:all`)
- wave grading is current (`npm run wave:status`)
- key locations were actually walked and judged by feel
- docs describe the current product truth

### Style enforcement pipeline

The Ultima VIII style framework is enforced through automated tooling:

- `npm test` — runs both structural and style validators before tests (pretest hook)
- `npm run build` — runs structural validator before build (prebuild hook)
- `npm run validate:all` — explicit combined structural + style validation
- `npm run grade:wave -- --wave N` — auto-grade assets against style profiles
- `npm run wave:status` — view grading progress across all 3 corrective waves
- `npm run audit:art` — full audit with markdown reports

Wave status and grade cards: `docs/art-bible/corrective-waves/`
Location reviews: `docs/art-bible/corrective-waves/location-reviews/`
Style profiles and thresholds: `docs/art-bible/gameplay-asset-spec.json`
Shipping asset style map: `docs/art-bible/shipping-asset-style-map.json`

## Guardrails

- Do not use cinematic art to excuse weak gameplay spaces.
- Do not add scope faster than standards and tests can absorb it.
- Do not chase generic CRPG scale without a Melaka-specific reason.
- Do not let "nice looking" replace "believable and playable."
