# A Famosa: Streets of Golden Melaka
## Official Art Bible

**Version**: 2.1
**Last Updated**: March 2026
**Vision**: *"Humid. Golden. Crowded. Exotic. Colonial. Tense. Beautiful."*

---

## 0. EXECUTABLE PIPELINE

This art bible is paired with an operational standard:

- [ART_PIPELINE.md](ART_PIPELINE.md) defines the production checklist for gameplay, cinematic, and concept art.
- [gameplay-asset-spec.json](gameplay-asset-spec.json) is the machine-readable target for validation.
- `npm run validate:art -- --report docs/art-bible/art-audit.md` produces a shareable audit report.

Production rule:

- Gameplay art is the source of truth for anything the player traverses, clicks, equips, or reads in-world.
- Cinematic art is limited to scene backdrops, portraits, and interstitials.
- Concept art stays in staging until it is promoted through review.

---

## 1. CORE VISUAL PHILOSOPHY

This game should feel like a **memory of a place you've never been** — warm, hazy, golden. Every pixel should serve atmosphere. We're not making a generic RPG; we're capturing **1580 Portuguese Melaka at the height of its glory and tension**.

### Visual Touchstones
- **Ultima VIII: Pagan**: minimum bar for density, mood, physicality, and environmental authority
- **Hyper Light Drifter**: Atmosphere through color and light
- **Chrono Trigger**: Warmth, expressiveness, world-building through detail
- **Ultima VII**: Interaction density, everything feels tangible
- **Historical paintings of Goa and Melaka**: Architectural accuracy

### The Golden Rule
When in doubt, make it **historically truer**, **denser**, and **more tactile** before merely making it prettier. This is tropical Southeast Asia under empire; the air itself has weight, color, and tension.

---

## 2. COLOR PALETTE

### Master Palette: 32 Colors

The palette is divided into **functional groups**. All sprites and tiles MUST use only these colors.

#### ARCHITECTURE (8 colors)
```
Portuguese Stone    #8B7355  (A Famosa walls, fortress)
Whitewash          #F5F5DC  (Colonial buildings, church)
Whitewash Shadow   #D4C4A8  (Shaded walls)
Terracotta         #CD5C5C  (Portuguese roofs)
Terracotta Dark    #8B3A3A  (Roof shadows)
Dark Wood          #5D4037  (Doors, beams, ships)
Warm Wood          #8B6914  (Fresh wood, market stalls)
Iron/Metal         #4A4A4A  (Gates, weapons, fixtures)
```

#### NATURE (8 colors)
```
Jungle Dark        #228B22  (Deep foliage, shadows)
Jungle Mid         #32CD32  (Standard vegetation)
Jungle Light       #90EE90  (Sunlit leaves, grass)
Palm Trunk         #8B7765  (Tree trunks, bamboo)
Water Deep         #1E4D6B  (Ocean, deep water)
Water Mid          #2E8B8B  (Harbor water)
Water Light        #5DADE2  (Shallows, reflections)
Sand               #F4D03F  (Beach, dirt paths)
```

#### GOLDEN HOUR / ATMOSPHERE (6 colors)
```
Golden Bright      #FFD700  (Direct sunlight, highlights)
Golden Mid         #DAA520  (Warm ambient light)
Golden Shadow      #B8860B  (Warm shadows)
Sunset Orange      #FF8C00  (Dusk sky, torch glow)
Dusk Purple        #9370DB  (Evening shadows)
Night Blue         #191970  (Night sky, deep shadow)
```

#### SKIN TONES (5 colors)
```
Portuguese Fair    #FDBCB4  (European characters)
Portuguese Shadow  #D4A59A  (European shadow)
Malay/Local        #C68642  (Southeast Asian characters)
Malay Shadow       #8B5A2B  (Southeast Asian shadow)
Chinese            #FFE4C4  (Chinese merchant characters)
```

#### UI & ACCENTS (5 colors)
```
Parchment          #F5DEB3  (UI backgrounds, paper)
Parchment Dark     #DEB887  (UI borders, aged paper)
Ink Black          #1C1C1C  (Text, outlines)
Portuguese Red     #8B0000  (Accents, flags, danger)
Spice Orange       #FF6347  (Highlights, spice piles)
```

---

## 3. RESOLUTION & SCALE

### Base Resolution
- **Native**: 320×180 pixels
- **Display**: 960×540 (3x integer scale)
- **Aspect Ratio**: 16:9

### Tile Grid
- **Ground tiles**: 32×16 pixels (2:1 isometric footprint)
- **Macro tiles**: 64×32 pixels for larger floor plates or plazas
- **Wall tiles**: Stackable isometric segments; avoid square-grid thinking
- **Large objects**: Footprint multiples of the isometric grid (32×16, 64×32, 32×32, etc.)

### Character Scale
- **Standard NPC/Player**: 16×32 frame cell inside the sprite sheet
- **Large characters**: 24×48 frame cell
- **Children**: 12×24 pixels
- **Crowd silhouettes**: 8×16 pixels (background)

### Pixel Density Rule
**NEVER mix pixel densities**. A 32×16 ground tile, 16×32 character cell, and 8×16 crowd silhouette must all be authored to the same native pixel density and compositional language.

---

## 4. CHARACTER DESIGN

### Silhouette Principle
Each character must be **instantly recognizable by silhouette alone**. Cultural identity should be readable at a glance.

### Portuguese Characters

#### Fernão Gomes (Merchant)
```
- Light tropical doublet (fitted jacket) in dark blue or burgundy
- White ruff collar (signature Portuguese 1580s fashion)
- Merchant's flat cap
- Coin purse at belt
- Clean-shaven or neat beard
- Posture: Confident but worried (quest giver)
```

#### Capitão Rodrigues (Guard Captain)
```
- Morion helmet (distinctive comb shape)
- Breastplate over quilted doublet
- Pike or halberd (tall weapon = authority silhouette)
- Portuguese military sash
- Mustache (period-accurate military style)
- Posture: Rigid, formal, hand on weapon
```

#### Padre Tomás (Jesuit Priest)
```
- Black Jesuit cassock (floor-length)
- White clerical collar
- Simple wooden crucifix on cord
- Tonsured hair (period-accurate)
- Carrying prayer book or rosary
- Posture: Hands clasped, slight bow
```

### Malay Characters

#### Aminah (Market Vendor)
```
- Baju kurung (traditional Malay blouse + skirt)
- Colors: Plain-dyed or ikat cloth (gold, orange, green)
- Tudung headscarf (modest covering)
- Simple jewelry (gold earrings)
- Basket or tray of goods
- Posture: Animated, gesturing, welcoming
```

### Chinese Characters

#### Chen Wei (Guild Representative)
```
- Changshan robe (long traditional gown)
- Mandarin collar
- Dark blue or grey silk
- Queue hairstyle (long braid) — NOTE: Actually 1580 predates Qing dynasty, so Ming-era topknot instead
- Abacus or ledger in hand
- Posture: Reserved, calculating, slight bow
```

### Arab Characters

#### Rashid (Sailor)
```
- Thawb (long white robe) — weathered and salt-stained
- Keffiyeh headscarf
- Curved jambiya dagger at belt
- Weathered, sun-darkened skin
- Trimmed beard
- Posture: Relaxed, gesturing broadly, animated
```

### Animation Requirements

#### Walk Cycles (All Characters)
```
4 directions × 4 frames = 16 frames per character

Frame breakdown:
- Frame 1: Contact (foot forward)
- Frame 2: Passing (feet together)
- Frame 3: Contact (other foot forward)
- Frame 4: Passing (return)

Timing: 150ms per frame (walking pace)
```

#### Idle Animation
```
2-4 frame breathing cycle
- Subtle chest rise/fall
- Occasional head turn or gesture
- Character-specific idle (Aminah arranges goods, Padre prays, etc.)

Timing: 500ms per frame (slow, ambient)
```

#### Interaction Feedback
```
- Highlight: 1-pixel white outline when player approaches
- Speaking: Simple 2-frame mouth movement
- Reaction: Head turn toward player
```

---

## 5. ARCHITECTURE REFERENCE

### Portuguese Colonial (A Famosa, Rua Direita, Church)

```
Key Features:
├── Whitewashed walls (lime plaster over laterite/brick)
├── Terracotta tile roofs (distinctive orange-red)
├── Arched doorways and windows (Manueline influence)
├── Iron balconies (second floors)
├── Wooden shutters (painted green or blue)
├── Coat of arms above important doorways
├── Stone quoins (corner reinforcement blocks)
└── Bell towers (church only)

A Famosa Fortress Specifics:
├── Laterite stone (reddish-brown tropical stone, not European grey granite)
├── Massive walls (imply thickness)
├── Crenellations (defensive battlements)
├── Portuguese royal coat of arms over gate
├── Guard positions (visible soldiers)
└── Cannons (bronze, period-accurate)
```

### Malay Kampung (Village Quarter)

```
Key Features:
├── Raised wooden houses (stilts, 3-4 feet off ground)
├── Thatched palm leaf roofs (attap)
├── Bamboo construction visible
├── Woven mat walls or wooden planks
├── Open verandahs (communal space)
├── Fruit trees (banana, coconut, papaya)
├── Cooking fires below houses (smoke rising)
└── Fish drying racks, nets hung to dry
```

### Chinese Shophouses (Waterfront District)

```
Key Features:
├── Narrow but deep buildings
├── Covered walkway at street level (five-foot way)
├── Ornate roof tiles (different style than Portuguese)
├── Red and gold accents (doorframes, signs)
├── Chinese characters on signs
├── Incense at doorway shrines
├── Goods displayed in front (open-front shops)
└── Paper lanterns
```

### Waterfront/Maritime

```
Key Features:
├── Wooden docks (weathered grey-brown planks)
├── Portuguese carracks (multi-masted, high stern castle)
├── Chinese junks (distinctive battened lugsails)
├── Arab dhows (triangular lateen sails)
├── Smaller fishing boats (sampans)
├── Cargo: Crates, barrels, bundled goods
├── Rope coils, nets, anchors
└── Warehouses (stone base, wooden upper)
```

---

## 6. ENVIRONMENTAL ANIMATION

### Water (High Priority)
```
3-frame loop, 200ms per frame
- Subtle color shift (mid → light → mid)
- Optional: Floating debris sprites
- Harbor: Gentle lapping
- Ocean: Slightly more movement
```

### Fire/Torches
```
4-frame loop, 100ms per frame
- Flicker between 2 orange tones
- Subtle size variation
- Cast light radius (golden glow)
- Smoke particles rising
```

### Cloth/Awnings/Flags
```
3-frame loop, 300ms per frame
- Gentle wave motion
- Market awnings: Minimal movement
- Ship flags: More dramatic
- Hanging cloth: Sway from middle
```

### Vegetation
```
2-frame loop, 500ms per frame (slow, ambient)
- Palm fronds: Gentle sway
- Bushes: Occasional rustle
- Flowers: Slight bounce
- Trees: Crown movement only
```

### Crowd/Background NPCs
```
Simple 2-frame walk cycle
- Move along predefined paths
- Disappear at edge of screen
- Different silhouette types (merchant, local, soldier, etc.)
- Non-interactive (atmosphere only)
```

---

## 7. LIGHTING GUIDELINES

### Time of Day Overlay Colors

```
DAWN (5:00-7:00)
- Overlay: #FFE4B5 at 15% opacity
- Soft, diffused light
- Long shadows (purple-tinted)
- Mist particles visible

MORNING (7:00-10:00)
- Overlay: #FFFACD at 10% opacity
- Clean, clear light
- Moderate shadows

NOON (10:00-14:00)
- Overlay: #FFFFFF at 5% opacity (slight washout)
- Harsh, direct light
- Short shadows directly beneath objects
- Heat shimmer particles

GOLDEN HOUR (14:00-17:00) ← THE SIGNATURE LOOK
- Overlay: #FFD700 at 20% opacity
- Rich, warm, golden light
- Long dramatic shadows (warm-tinted)
- Dust motes visible in light beams
- This is the "Golden Melaka" look

DUSK (17:00-19:00)
- Overlay: #FF8C00 at 25% opacity
- Deep orange-red light
- Purple shadows
- Torches begin to glow

NIGHT (19:00-5:00)
- Overlay: #191970 at 40% opacity
- Blue-black darkness
- Point lights (torches, windows) punch through
- Stars visible
- Fireflies in vegetation areas
```

### Point Light Sources
```
Torches: 48px radius, #FF8C00, flicker animation
Lanterns: 32px radius, #FFD700, steady
Cooking fires: 64px radius, #FF6347, strong flicker
Windows: 24px radius, #FFFACD, steady
Moon: Global #C0C0C0 tint at 10% when full
```

---

## 8. UI DESIGN

### Visual Language
- **Parchment aesthetic**: Aged paper texture, hand-drawn borders
- **Portuguese tilework**: Azulejo-style decorative frames
- **Period typography**: Serif fonts, drop caps for titles

### Dialogue Box
```
- Parchment background (#F5DEB3)
- Dark wood frame (#5D4037)
- Decorative corners (Portuguese scroll motif)
- NPC portrait (48×48) on left
- Text in Ink Black (#1C1C1C)
- Topic keywords highlighted in Portuguese Red (#8B0000)
```

### Inventory
```
- Leather satchel aesthetic
- Grid of item slots (bordered parchment squares)
- Selected item: Gold highlight
- Money display: Coin icon + amount
- Weight/capacity bar (if implemented)
```

### Journal
```
- Open book layout (two pages)
- Hand-written aesthetic for entries
- Quest headers in decorated capitals
- Wax seal icons for completed quests
- Map sketches for discovered locations
```

---

## 9. ASSET CHECKLIST

### Characters (Priority 1)
- [ ] Player character (all directions + animations)
- [ ] Fernão Gomes (culturally accurate redesign)
- [ ] Capitão Rodrigues (culturally accurate redesign)
- [ ] Padre Tomás (culturally accurate redesign)
- [ ] Aminah (culturally accurate redesign)
- [ ] Chen Wei (culturally accurate redesign)
- [ ] Rashid (culturally accurate redesign)
- [ ] Background crowd silhouettes (3-4 types)

### Environment (Priority 2)
- [ ] Water animation tiles
- [ ] Fire/torch animation
- [ ] Cloth/flag animation
- [ ] Vegetation sway animation
- [ ] Smoke particles
- [ ] Dust mote particles
- [ ] Heat shimmer effect
- [ ] Rain effect

### Architecture (Priority 3)
- [ ] A Famosa gate (detailed, accurate)
- [ ] Portuguese buildings (Rua Direita set)
- [ ] St. Paul's Church
- [ ] Malay kampung buildings
- [ ] Chinese shophouses
- [ ] Waterfront/dock structures
- [ ] Ship sprites (carrack, junk, dhow)

### Objects (Priority 4)
- [ ] Trade goods (spices, silk, porcelain)
- [ ] Cultural artifacts (keris, crucifix, abacus)
- [ ] Food items (period-accurate)
- [ ] Furniture (benches, tables, beds)
- [ ] Containers (barrels, crates, chests)

---

## 10. REFERENCE IMAGES

Collect reference for:
- Portuguese Goa architecture (1580s)
- Traditional Malay village (kampung)
- Ming dynasty clothing and hairstyles
- 16th century maritime vessels
- Tropical Southeast Asian vegetation
- Period weapons and armor
- Spice trade goods
- Portuguese colonial furniture

---

*"Every pixel tells a story. Make it the story of Melaka."*
