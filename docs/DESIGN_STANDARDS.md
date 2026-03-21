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

- the build passes
- tests pass
- strict art validation passes
- key locations were actually walked and judged by feel
- docs describe the current product truth

## Guardrails

- Do not use cinematic art to excuse weak gameplay spaces.
- Do not add scope faster than standards and tests can absorb it.
- Do not chase generic CRPG scale without a Melaka-specific reason.
- Do not let "nice looking" replace "believable and playable."
