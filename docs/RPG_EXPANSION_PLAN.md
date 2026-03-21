# RPG Expansion Plan

This document defines how to deepen the game into a richer RPG without losing practical scope or historical grounding.

## Goal

Gradually move from a polished adventure slice toward a denser RPG structure with:

- more quest agency
- more faction consequence
- more systemic pressure
- more reasons to revisit places and people

The target is not to become a clone of any one game. The target is to learn from **Baldur's Gate** and **Daggerfall** while building something that fits one believable Melaka city slice.

## Lessons To Borrow

### From Baldur's Gate

Keep:

- authored quests that overlap geographically
- layered side quests around a strong main through-line
- memorable NPC agendas and local consequences
- a journal structure that makes branching progress understandable

Do not copy blindly:

- full party-management scope
- giant companion-production burden
- huge wilderness expansion before the city core is deep enough

### From Daggerfall

Keep:

- faction logic
- reputation changes
- time pressure on selected quests
- quests that can resolve differently based on timing, allegiance, and approach

Do not copy blindly:

- enormous procedural sprawl
- content quantity that outruns authored atmosphere
- systems so broad that they erase local identity

## Melaka-Specific RPG Pillars

### 1. Factions

Start with a small set of meaningful power blocs:

- Portuguese military authority
- Jesuit / church influence
- Portuguese merchant interests
- Chinese merchant/guild interests
- Malay village/community trust
- Maritime outsider networks: Arab sailors, dockside brokers, smugglers

Each quest should ideally move at least one relationship.

### 2. Multi-Path Quests

Core quests should increasingly support:

- persuasion or social leverage
- trade or barter resolution
- faction-backed intervention
- stealth or quiet delivery
- principled refusal with consequence

Not every quest needs every route, but every important quest should resist one-solution design.

### 3. Time Pressure

Use light time pressure where it improves tension:

- shipments leaving
- guards changing shift
- church protection ending
- market opportunities expiring

Deadlines should create texture, not punishment-heavy busywork.

### 4. Reputation and Access

Reputation should unlock or complicate:

- prices
- rumors
- introductions
- restricted spaces
- who lies to you
- who asks for help

This should start small and readable, not as a giant hidden-simulation blob.

## Implementation Phases

### Phase 1: Foundation

- Status: shipped in `v0.7.0`
- Six-faction trust model is now live
- The journal and HUD now represent consequence through `City Currents`
- The customs spine now gives the core quest layer an interlocked multi-path cluster

### Phase 2: World Reactivity

- Next active milestone
- Change dialogue availability based on quest state and faction trust
- Add small but visible world feedback after major decisions
- Let locations feel different when the player arrives with different loyalties or outcomes
- Rebuild `Pirates on the Horizon` as the next full reactive quest cluster
- Extend stronger reactivity into `St. Paul's Church` and `Kampung`

### Phase 3: Systemic Depth

- Introduce more time-sensitive opportunities
- Add repeatable but authored-feeling faction work only after the core authored quests are strong
- Expand economic and social consequences carefully

## Scope Guardrails

- No province-scale procedural expansion.
- No full party CRPG system until the city slice is already rich enough.
- No generic quest templates without a Melaka-specific social or historical reason.
- No increase in quest count that lowers writing, environment, or consequence quality.

## Acceptance Standard

RPG depth is succeeding when:

1. The same quest can be discussed in materially different ways by different NPCs.
2. The player can resolve important problems through more than one social or material path.
3. Faction trust changes later access or tone in understandable ways.
4. The city feels more interconnected, not merely more busy.
