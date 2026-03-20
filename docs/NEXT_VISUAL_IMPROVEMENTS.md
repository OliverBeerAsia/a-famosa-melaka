# Next Visual Improvements

**Date**: January 12, 2026
**Focus**: Building on Monkey Island-style backgrounds

---

## Completed This Session

- [x] Monkey Island-style scene background generator with Bayer dithering
- [x] 6 detailed scene backgrounds (960x540)
- [x] Removed 7MB unused ai-tiles folder
- [x] Fixed BootScene.js broken map references
- [x] Updated documentation

---

## Priority 1: Scene Background Enhancements

The current backgrounds are a strong foundation. Next improvements:

### 1.1 Add Animated Elements
- **Water animations**: Harbor waves, river ripples (3-4 frame overlays)
- **Fire/torch glow**: Flickering light on fortress walls
- **Palm frond sway**: Subtle movement in kampung scene
- **Flag animation**: Portuguese flag on fortress tower

### 1.2 Time-of-Day Variants
Generate alternate versions for day/night cycle:
- `scene-*-dawn.png` - Pink/orange sky, long shadows
- `scene-*-day.png` - Current bright versions
- `scene-*-dusk.png` - Golden hour, warm light
- `scene-*-night.png` - Blue tones, lit windows, torches

### 1.3 Atmosphere Details
- Add birds in sky (small silhouettes)
- Ship movement in harbor background
- Smoke from cooking fires in kampung
- Church bell visible in St. Paul's tower

---

## Priority 2: Character Sprite Overhaul

Current character sprites are basic placeholders (~700 bytes each). They need:

### 2.1 Cultural Accuracy Per Art Bible
| Character | Missing Details |
|-----------|----------------|
| Capitao Rodrigues | Morion helmet, breastplate, pike |
| Fernao Gomes | Ruff collar, doublet, merchant cap |
| Padre Tomas | Tonsured hair, crucifix detail |
| Aminah | Tudung headscarf, batik patterns |
| Chen Wei | Ming topknot, mandarin collar |
| Rashid | Keffiyeh detail, jambiya dagger |

### 2.2 Animation Improvements
- Current: 4-frame walk cycle only
- Need: Idle breathing (2-3 frames)
- Need: Talking animation (mouth movement)
- Need: Interaction poses (reaching, gesturing)

### 2.3 32-Color Palette Compliance
Regenerate all sprites using exact Art Bible palette colors.

---

## Priority 3: Missing UI Assets

No UI sprites currently exist. Need:

### 3.1 Dialogue System
- `dialogue-box.png` - Parchment texture with wood frame (256x64)
- `portrait-frame.png` - Gold/brass border for character portraits
- `dialogue-arrow.png` - Continue indicator

### 3.2 Inventory System
- `inventory-bg.png` - Leather satchel aesthetic
- `inventory-slot.png` - Item slot (20x20)
- `coin-display.png` - Portuguese cruzado icon

### 3.3 Journal System
- `journal-bg.png` - Aged paper with hand-drawn aesthetic
- `quest-marker.png` - Active quest indicator
- `map-overlay.png` - Period-appropriate map style

---

## Priority 4: Atmospheric Particles

Particle effects to enhance immersion:

### 4.1 Environmental
- `dust-motes.png` - Golden floating particles for afternoon scenes
- `rain-drops.png` - Monsoon season weather
- `mist-wisps.png` - Morning harbor mist
- `fireflies.png` - Night atmosphere in kampung

### 4.2 Interactive
- `smoke-puff.png` - Cooking fires, torches
- `water-splash.png` - Harbor interactions
- `sparkle.png` - Quest item highlight

---

## Priority 5: Tile Consistency

### 5.1 Verify Palette Compliance
Audit all 29 tile sprites against Art Bible 32-color palette.

### 5.2 Add Variation
- Cobblestone: 3 variants for visual interest
- Grass: Edge transition tiles
- Water: Animated 3-frame version

---

## Technical Notes

### Background Generator Capabilities
The `generate-scene-backgrounds.js` tool can be extended with:
- Additional helper functions for new element types
- Time-of-day color scheme presets
- Overlay layer generation for animations

### Sprite Generation Approach
Consider creating `generate-character-sprites-v2.js` with:
- Art Bible palette integration
- Cultural detail layers
- Animation frame generation

---

## Effort Estimates

| Task | Complexity | Files |
|------|------------|-------|
| Time-of-day backgrounds | Medium | 20 new PNGs |
| Character sprite overhaul | High | 7 sprite sheets |
| UI asset creation | Medium | 10-15 sprites |
| Particle effects | Low | 8-10 sprites |
| Tile palette audit | Low | 29 tiles |

---

*Next session: Start with time-of-day background variants to maximize visual impact.*
