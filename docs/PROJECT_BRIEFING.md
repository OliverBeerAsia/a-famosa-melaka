# A Famosa: Streets of Golden Melaka
## Claude Code Project Briefing

## Vision Statement

Create a small, atmospheric adventure RPG in the style of Ultima VII set in Portuguese Melaka (Malacca) circa 1580—the height of Portuguese power in the Straits. The player explores the fortified downtown around the famous A Famosa fortress, interacting with merchants, sailors, missionaries, and locals in a richly detailed pixel-art world that captures the unique cultural collision of 16th-century maritime Southeast Asia.

---

## Historical Setting

### Time Period: 1580

- Portugal has controlled Melaka for nearly 70 years (captured 1511)
- The city is a thriving entrepôt—the "Venice of the East"
- Trade flows from China, India, Siam, Java, and beyond
- Jesuit missionaries are active; St. Francis Xavier passed through decades prior
- The massive A Famosa fortress dominates the hill
- Tensions simmer between Portuguese colonizers, local Malays, Chinese merchants, Indian traders, and visiting Arab seafarers

### Downtown District (Scope for Demo)

Focus on a compact area including:

- **A Famosa Fortress Gate** — The iconic entrance, soldiers on watch
- **Rua Direita (Main Street)** — The commercial heart, market stalls, taverns
- **St. Paul's Church Hill** — Stone church overlooking the strait
- **The Waterfront Quay** — Ships unloading spices, silk, porcelain
- **The Kampung Quarter** — Local Malay village area at the edge

---

## Art Direction

### Visual Style

- **Resolution**: 320×180 base (scales to modern displays)
- **Palette**: Limited palette of 32-48 colors; warm tropical tones with Portuguese terracotta, whitewashed walls, lush jungle greens, deep ocean blues
- **Perspective**: ¾ top-down isometric (Ultima VII style)
- **Tile Size**: 16×16 pixels for ground tiles; 16×32 or larger for characters/structures
- **Animation**: Subtle environmental animation (palm fronds, water ripples, torch flicker, cloth awnings)

### Key Visual Elements

| Element | Treatment |
|---------|-----------|
| **Architecture** | Portuguese colonial: whitewashed stone, terracotta roofs, iron balconies, arched doorways |
| **A Famosa** | Massive grey stone walls, crenellations, the famous gate with Portuguese coat of arms |
| **St. Paul's** | Simple stone church with cross, gravestones, views to sea |
| **Market** | Colorful awnings, barrels, crates, hanging goods, crowded stalls |
| **Waterfront** | Wooden docks, Portuguese carracks, Chinese junks, fishing boats |
| **Flora** | Coconut palms, banana trees, frangipani, bougainvillea, tropical undergrowth |
| **Characters** | Distinct silhouettes: Portuguese soldiers (morion helmets), friars (robes), merchants (ruffs), Malay locals (sarongs, songkok), Chinese traders (changshan) |

### Atmosphere Goals

- **Humid, tropical heat** — Shimmering heat haze, golden afternoon light
- **Bustling commerce** — NPCs moving, haggling, loading cargo
- **Colonial tension** — Armed guards, whispered conversations, watching eyes
- **Exotic beauty** — Spices piled high, silk unfurling, incense smoke
- **Day/Night Cycle** — Dawn markets, blazing noon, golden hour, torch-lit nights

---

## Audio Direction

### Music Style

**Genre**: Renaissance-meets-Gamelan fusion; Portuguese fado influences mixed with Malay and Chinese melodic elements

**Instruments**:
- Portuguese: Lute, viola da gamba, rebec
- Malay: Gamelan percussion, gongs
- Chinese: Erhu, pipa
- All rendered in chiptune/lo-fi style

### Tracks Needed for Demo

1. **Main Theme** — Wistful, adventurous, hints of longing and discovery
2. **Market Day** — Lively, bustling, layered percussion
3. **St. Paul's Hill** — Contemplative, church bells, sacred calm
4. **Waterfront** — Sea shanty feel, waves, creaking wood
5. **Night in Melaka** — Mysterious, quieter, cicadas, distant music
6. **Danger/Tension** — For confrontations or intrigue

### Sound Effects

**Ambient layers**: Seagulls, cicadas, distant calls to prayer, church bells, water lapping

**Interactive**: Footsteps (stone/wood/dirt), door creaks, coin clinks, sword draws, crowd murmur

**UI**: Menu select, inventory sounds, dialogue blips (Ultima-style character speech sounds)

---

## Gameplay Systems

### Core Mechanics (Ultima VII-Inspired)

- **Exploration**: Free movement through interconnected screens; enter buildings, climb hills
- **Interaction**: Click on anything—objects, NPCs, environment—for descriptions or actions
- **Dialogue**: Keyword-based or branching dialogue trees; ask about topics, learn secrets
- **Inventory**: Pick up, combine, use items; manage a pack
- **Time System**: Day/night cycle affects NPC schedules, shop hours, events
- **Journal**: Auto-logs quests, rumors, important information

### Demo Scope Mechanics

- Movement and collision ✅
- Basic NPC interaction (3-5 dialogue keywords per NPC)
- Simple inventory (pick up, examine, use)
- Day/night cycle (visual only for demo)
- One mini-quest chain

---

## Demo Content Outline

### The Demo Quest: "The Merchant's Seal"

A Portuguese merchant, Fernão Gomes, has lost his wax trading seal—without it, he cannot authorize shipments and suspects foul play. The player must:

1. Speak with Fernão at his warehouse on Rua Direita
2. Question NPCs: the jealous rival merchant, the local informant, the dock workers
3. Explore locations: the tavern, the waterfront, the kampung
4. Discover the seal was taken by a debt collector for the Chinese merchant guild
5. Negotiate or barter to retrieve it
6. Return to Fernão for reward

### Key NPCs (Demo)

| Name | Role | Location |
|------|------|----------|
| **Fernão Gomes** | Portuguese spice merchant, quest giver | Warehouse, Rua Direita |
| **Capitão Rodrigues** | Fortress guard captain, hints at smuggling | A Famosa Gate |
| **Padre Tomás** | Jesuit priest, knows everyone's secrets | St. Paul's Church |
| **Aminah** | Malay market vendor, local gossip | Market stalls |
| **Chen Wei** | Chinese guild representative, holds the seal | Waterfront counting house |
| **Rashid** | Arab sailor, sells exotic goods, comic relief | Docked dhow |

---

## Technical Specifications

### Recommended Stack

- **Engine**: Phaser 3 (JavaScript) ✅
- **Resolution**: 320×180 native, scaled to window ✅
- **Tile Engine**: Tiled (for map editing, exported to JSON) ✅
- **Art**: Aseprite for sprites and tiles
- **Audio**: Audacity for SFX; LMMS/FamiStudio for chiptune music
- **Version Control**: Git ✅

### Project Structure

```
melaka-rpg/
├── assets/
│   ├── sprites/
│   │   ├── characters/
│   │   ├── tiles/
│   │   ├── objects/
│   │   └── ui/
│   ├── audio/
│   │   ├── music/
│   │   └── sfx/
│   └── maps/
├── src/
│   ├── scenes/
│   ├── entities/
│   ├── systems/
│   ├── ui/
│   └── data/
├── docs/
│   ├── design/
│   ├── lore/
│   └── art-bible/
└── README.md
```

---

## Milestone Breakdown

| Phase | Deliverables | Est. Effort | Status |
|-------|--------------|-------------|--------|
| **1. Foundation** | Engine setup, basic movement, tilemap rendering, camera | 1 week | ✅ Complete |
| **2. World Building** | Create 5 demo locations in Tiled, basic collision | 1 week | 🟡 In Progress (1/5 locations) |
| **3. NPCs & Dialogue** | NPC entities, dialogue system, 6 NPCs scripted | 1-2 weeks | ⏳ Not Started |
| **4. Interaction** | Object interaction, inventory system, item pickups | 1 week | ⏳ Not Started |
| **5. Art Pass** | Full pixel art for demo areas, character sprites, animations | 2-3 weeks | 🟡 In Progress |
| **6. Audio Pass** | 6 music tracks, ambient layers, core SFX | 1-2 weeks | ⏳ Not Started |
| **7. Quest Logic** | Demo quest scripted and playable end-to-end | 1 week | ⏳ Not Started |
| **8. Polish** | Day/night visuals, UI, title screen, transitions | 1 week | ⏳ Not Started |

---

## Atmosphere Reference Board

### Visual Inspiration

- **Ultima VII: The Black Gate** — Interaction depth, world feel
- **Chrono Trigger** — Pixel art warmth, expressive characters
- **Stardew Valley** — Modern pixel charm, day/night
- **Hyper Light Drifter** — Atmospheric palette, environmental storytelling
- Historical paintings of 16th-century Melaka and Portuguese Goa

### Audio Inspiration

- **Chrono Cross OST** — Fusion of cultural instruments
- **Baldur's Gate tavern music** — Renaissance feel
- **Portuguese fado (Amália Rodrigues)** — Saudade, longing
- Traditional Malay gamelan recordings
- **Shovel Knight / Celeste** — Modern chiptune excellence

### Mood Keywords

**Humid. Golden. Crowded. Exotic. Colonial. Tense. Beautiful.**

*Spice-laden air. Salt and sandalwood. Creaking ships. Whispered secrets.*
*A city balanced on the blade of empire.*

---

## Development Principles

### Code Style

- Prioritize readability and maintainability
- Use clear, descriptive names (e.g., `showDialogue()`, `playerInventory`)
- Comment generously, especially for game logic
- Keep systems modular (dialogue system separate from NPC logic, etc.)

### Art Asset Approach

- Generate placeholder sprites first, iterate toward final ✅
- Maintain consistent pixel density (no mixed resolutions) ✅
- Use indexed color palettes for cohesion ✅
- Test sprites in-engine early and often ✅

### Atmosphere Priority

- **Every system should enhance immersion**
- When in doubt, add environmental detail
- Sound and music are not afterthoughts—they're half the experience
- Day/night should feel meaningful, not just cosmetic

### Historical Accuracy

- Research first, adapt for gameplay second
- Embrace the multicultural reality of Melaka
- Avoid stereotypes; portray all cultures with respect and nuance
- Small authentic details (correct clothing, food, architecture) create believability

---

## Current Progress (December 2025)

### ✅ Completed

- Phaser 3 project setup with webpack
- 320×180 resolution with integer scaling
- Player character with 8-directional movement
- Tilemap system loading Tiled JSON
- Collision detection
- Camera following system
- Portuguese Melaka color palette (32 colors)
- Atmospheric tileset:
  - Architecture (whitewash walls, terracotta roofs, fortress stone, cobblestone, wooden doors)
  - Vegetation (palm trees, tropical bushes, frangipani flowers)
  - Environmental objects (barrels, crates, pottery, market awnings)
- A Famosa Fortress Gate map (25×20 tiles)

### 🎯 Next Priorities

1. **NPC System**: Create NPC entity class with basic AI
2. **Dialogue System**: Implement text box UI and conversation trees
3. **Additional Maps**: Rua Direita market area, St. Paul's Church, Waterfront, Kampung
4. **Character Sprites**: Create all 6 demo NPCs with period-appropriate clothing
5. **Animated Sprites**: Walking animations for player and NPCs

---

## Key Quote

> "Whoever is lord of Malacca has his hand on the throat of Venice."
> — Tomé Pires, *Suma Oriental*, 1515

---

**Document Version**: 1.0
**Created For**: Claude Code CLI Project Development
**Game Title**: A Famosa: Streets of Golden Melaka
**Target Demo**: Playable slice featuring "The Merchant's Seal" quest
