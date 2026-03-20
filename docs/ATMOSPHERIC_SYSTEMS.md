# Atmospheric Systems - Implementation Summary

This document describes the atmospheric systems implemented to enhance immersion in A Famosa: Streets of Golden Melaka.

## Overview

Three major systems have been implemented to create a living, breathing world:

1. **Particle Effects System** - Visual atmosphere (dust, heat haze)
2. **Time & Lighting System** - Dynamic day/night cycle with realistic lighting
3. **Ambient Sound System** - Layered audio atmosphere (ready for audio files)

---

## 1. Particle Effects System

**Location**: `src/scenes/GameScene.js:106-145`

### Features

- **Dust Motes**: Floating particles that drift slowly upward, giving a sense of tropical heat and stillness
  - Spawn across entire map
  - 150ms spawn frequency
  - 8-12 second lifespan
  - Warm whitewash tint (#F4E6D3)
  - Additive blending for golden glow effect

- **Heat Haze**: Larger, very subtle particles creating atmospheric distortion
  - Spawn in lower half of screen (where heat would rise from ground)
  - 300ms spawn frequency
  - 5-8 second lifespan
  - Golden warmth tint (#F4B41A)
  - Very low alpha (0.05) for subtle effect

### Technical Details

- Uses Phaser 3 particle emitter system
- Particles use procedurally generated 8x8 circular texture
- Proper depth layering (heat haze at 500, dust motes at 900)
- Performance-optimized with controlled spawn rates

---

## 2. Time & Lighting System

**Location**: `src/systems/TimeSystem.js`, `src/scenes/GameScene.js:151-210`

### Time System Features

- **Configurable Time Flow**: 1 real second = 1 game minute (adjustable)
- **24-Hour Cycle**: Tracks hours and minutes
- **Time of Day States**: Dawn (6-8), Day (8-18), Dusk (18-20), Night (20-6)
- **Event System**: Emits `hourChanged` event for other systems to react

### Lighting System Features

- **Dynamic Overlay**: Rectangle covering entire map with variable tint and alpha
- **Smooth Transitions**: 1-second tweens between lighting states
- **Time-Based Colors**:
  - Dawn: Warm orange (#FFB366)
  - Day: Neutral white (#FFFFFF) - no overlay
  - Dusk: Golden (#FF9966)
  - Night: Cool blue (#4A5A8A) with 50% darkness

- **Progressive Fading**: Gradual transitions during dawn (6-8) and dusk (18-20)

### UI Display

- Time shown in upper-right corner (HH:MM format)
- Golden text (#F4B41A) with black stroke
- Fixed to camera (doesn't scroll)

### Debug Controls

- **T Key**: Advance time by 1 hour
- **Y Key**: Toggle between normal (60x) and fast (600x) time speed

---

## 3. Ambient Sound System

**Location**: `src/systems/AmbientSoundSystem.js`, `src/scenes/GameScene.js:212-229`

### Core Features

- **Layered Audio**: Multiple sound layers play simultaneously with individual volumes
- **Smooth Crossfading**: 2-second fades when changing locations or time of day
- **Location-Specific Soundscapes**: Each map has unique ambient layers
- **Time-of-Day Variations**: Sounds change based on dawn/day/dusk/night
- **Graceful Degradation**: System works even when audio files are not yet loaded

### Location Configurations

#### A Famosa Fortress Gate
- `base-tropical` (0.4) - Tropical ambience
- `fortress-ambience` (0.6) - Stone fortress echoes
- `distant-city` (0.3) - Muffled city sounds

#### Rua Direita (Market Street)
- `base-tropical` (0.3)
- `market-crowd` (0.7) - Portuguese/Malay voices, bargaining
- `street-life` (0.5) - Carts, footsteps, coins

#### St. Paul's Church
- `base-tropical` (0.4)
- `church-bells` (0.5) - Portuguese bells
- `sacred-calm` (0.6) - Reverent atmosphere

#### The Waterfront
- `base-tropical` (0.3)
- `water-lapping` (0.6) - Waves on docks
- `harbor-activity` (0.5) - Sailors, cargo
- `seagulls` (0.4) - Seabirds

#### The Kampung Quarter
- `base-tropical` (0.5)
- `village-life` (0.6) - Malay village sounds
- `jungle-sounds` (0.4) - Nearby jungle

### Time-of-Day Sound Variations

- **Dawn**: Add `morning-birds` (0.4), fade out night sounds
- **Day**: Clear daytime ambience, no special layers
- **Dusk**: Add `evening-calls` (0.3)
- **Night**: Add `night-insects` (0.5) and `cricket-chorus` (0.4), reduce all other sounds to 60% volume

### Integration

- Automatically updates when location changes (via scene restart)
- Automatically updates when time of day changes (via `hourChanged` event)
- Properly cleans up sounds when scene is destroyed

### Audio Assets Required

See `docs/AUDIO_REQUIREMENTS.md` for complete list of audio files needed.

**Note**: Audio files are not yet included in the project. The system will log warnings when sounds are not found but will continue to function. Once audio files are added to `assets/audio/ambient/` and loaded in BootScene, the system will automatically play them.

---

## Usage in GameScene

The systems are initialized in this order:

1. Tilemap created
2. **Atmospheric particles** created
3. **Time system** created (starts ticking)
4. **Ambient sound** created (starts playing location sounds)
5. Player created
6. Camera set up

This ensures atmosphere is established before gameplay begins.

---

## Performance Considerations

- **Particles**: Limited spawn rates and lifespans prevent particle buildup
- **Lighting**: Single rectangle overlay, not per-pixel effects
- **Audio**: Uses Web Audio API, efficient mixing, proper cleanup
- **Tweens**: Reuses Phaser's tween system, no custom interpolation

---

## Future Enhancements

1. **Particle System**:
   - Add fireflies at night
   - Add rain during weather events
   - Add smoke from chimneys

2. **Lighting System**:
   - Add torches/lanterns as point lights at night
   - Add window glow from buildings
   - Add dynamic shadows from objects

3. **Sound System**:
   - Add positional audio (3D sound based on player proximity)
   - Add footstep variation based on ground type
   - Add music system (separate from ambient)

4. **Integration**:
   - Link weather system to particles and lighting
   - Link NPC schedules to time system
   - Add special events (church bells at specific hours)

---

## Testing

To test the atmospheric systems:

1. **Particles**: Should be visible immediately, floating gently upward
2. **Time System**:
   - Watch time display in upper-right
   - Press `T` to advance time and see lighting change
   - Press `Y` to speed up time and watch full day/night cycle
3. **Ambient Sound**:
   - Check browser console for "Setting ambient sound for location" messages
   - Will play sounds once audio files are added
   - Switch locations (1: Fortress, 2: Market) to hear different configurations

---

## Integration with Project Brief

These systems directly support the project's core atmosphere keywords:

- **Humid**: Heat haze particles, tropical sound layers
- **Golden**: Warm particle tints, golden dusk lighting, time display color
- **Crowded**: Market crowd sounds, street life ambience
- **Exotic**: Tropical base sounds, multicultural voice layers
- **Colonial**: Church bells, fortress ambience, Portuguese elements
- **Tense**: Night sounds, subtle atmospheric pressure
- **Beautiful**: Particle effects, smooth lighting transitions, layered soundscapes

**Priority alignment**: "Immersion Over Features" - These systems create deep atmosphere without adding gameplay complexity.
