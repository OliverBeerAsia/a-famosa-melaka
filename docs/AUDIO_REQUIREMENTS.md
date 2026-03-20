# Audio Requirements for A Famosa

This document lists all the audio assets needed for the ambient sound system.

## Sound Asset Format
- **Format**: OGG Vorbis (best for looping ambient sounds)
- **Fallback**: MP3
- **Sample Rate**: 44.1kHz
- **Bitrate**: 128-192 kbps
- **Looping**: All ambient layers should loop seamlessly

## Base Ambient Layers

### base-tropical
**Filename**: `base-tropical.ogg`
**Duration**: 60-90 seconds
**Description**: Core tropical ambience - gentle wind rustling palm fronds, distant jungle sounds, occasional bird calls
**Volume**: 0.3-0.5
**Used in**: All locations

### morning-birds
**Filename**: `morning-birds.ogg`
**Duration**: 45-60 seconds
**Description**: Dawn chorus - tropical birds greeting the sunrise
**Volume**: 0.3-0.4
**Active**: Dawn (6-8 AM)

### night-insects
**Filename**: `night-insects.ogg`
**Duration**: 60 seconds
**Description**: Tropical night insects, rhythmic chirping
**Volume**: 0.4-0.5
**Active**: Night (20-6 AM)

### cricket-chorus
**Filename**: `cricket-chorus.ogg`
**Duration**: 45-60 seconds
**Description**: Dense cricket chorus, warm night sounds
**Volume**: 0.3-0.4
**Active**: Night (20-6 AM)

### evening-calls
**Filename**: `evening-calls.ogg`
**Duration**: 30-45 seconds
**Description**: Dusk transition sounds - evening birds, insects starting
**Volume**: 0.3
**Active**: Dusk (18-20)

## Location-Specific Layers

### A Famosa Fortress Gate

#### fortress-ambience
**Filename**: `fortress-ambience.ogg`
**Description**: Stone fortress sounds - subtle echoes, wind through battlements, distant footsteps
**Volume**: 0.5-0.6

#### distant-city
**Filename**: `distant-city.ogg`
**Description**: Muffled sounds of the city below - very subtle crowd murmur, distant bells
**Volume**: 0.2-0.3

### Rua Direita (Market Street)

#### market-crowd
**Filename**: `market-crowd.ogg`
**Description**: Portuguese and Malay voices bargaining, laughing, calling out wares. Multicultural chatter.
**Volume**: 0.6-0.7

#### street-life
**Filename**: `street-life.ogg`
**Description**: Cart wheels on cobblestones, footsteps, coins jingling, pottery clinking
**Volume**: 0.4-0.5

### St. Paul's Church

#### church-bells
**Filename**: `church-bells.ogg`
**Description**: Portuguese church bells - occasional tolls, echoing across the hill
**Volume**: 0.4-0.5

#### sacred-calm
**Filename**: `sacred-calm.ogg`
**Description**: Very subtle holy ambience - quiet, reverent space, distant Latin chanting
**Volume**: 0.5-0.6

### The Waterfront

#### water-lapping
**Filename**: `water-lapping.ogg`
**Description**: Gentle waves lapping against wooden docks and stone quay
**Volume**: 0.5-0.6

#### harbor-activity
**Filename**: `harbor-activity.ogg`
**Description**: Sailors working, cargo being loaded, ropes creaking, wood groaning
**Volume**: 0.4-0.5

#### seagulls
**Filename**: `seagulls.ogg`
**Description**: Seagulls calling, circling the harbor
**Volume**: 0.3-0.4

### The Kampung Quarter

#### village-life
**Filename**: `village-life.ogg`
**Description**: Malay village sounds - children playing, domestic animals, daily activities
**Volume**: 0.5-0.6

#### jungle-sounds
**Filename**: `jungle-sounds.ogg`
**Description**: Nearby jungle edge - rustling, tropical birds, monkeys in distance
**Volume**: 0.3-0.4

## Sound Effects (One-shots, not looping)

These will be added later for interaction:
- Footsteps on stone, wood, dirt
- Door opening/closing
- Coins jingling
- Dialog blips (Ultima-style)
- Menu navigation sounds

## Music Tracks (Future)

Not yet implemented in the ambient system, but planned:
- Main theme (Renaissance-Gamelan fusion)
- Market theme (upbeat, trading atmosphere)
- Church theme (contemplative, sacred)
- Night theme (mysterious, atmospheric)

## Implementation Notes

1. **Audio files should be placed in**: `assets/audio/ambient/`
2. **Loading in BootScene**: Add to `loadAudio()` method
3. **Seamless loops**: Ensure audio files are edited to loop perfectly
4. **Crossfading**: The system handles 2-second crossfades between layers
5. **Performance**: All sounds use Web Audio API for efficient mixing

## Next Steps

1. Source or create placeholder audio files
2. Add loading to BootScene.js
3. Test ambient layers in each location
4. Adjust volumes based on playtest feedback
5. Add music system (separate from ambient)
