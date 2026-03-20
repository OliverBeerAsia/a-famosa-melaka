/**
 * Ambient Sound System
 *
 * Manages layered ambient soundscapes:
 * - Base ambience (cicadas, wind, water)
 * - Location-specific sounds (market chatter, seagulls, bells)
 * - Time-of-day variations (dawn birds, night insects)
 * - Smooth crossfading between layers
 * - Volume control based on player proximity to sound sources
 */

export default class AmbientSoundSystem {
  constructor(scene) {
    this.scene = scene;
    this.currentLocation = null;
    this.currentTimeOfDay = 'day';
    this.activeSounds = {};
    this.fadeSpeed = 2000; // 2 seconds for crossfade
  }

  /**
   * Initialize ambient sound for a location
   * @param {string} locationKey - The map/location identifier
   */
  setLocation(locationKey) {
    if (this.currentLocation === locationKey) return;

    console.log('Setting ambient sound for location:', locationKey);
    this.currentLocation = locationKey;

    // Fade out old sounds
    this.fadeOutAll();

    // Fade in new sounds based on location
    this.fadeInLocationSounds(locationKey);
  }

  /**
   * Update sounds based on time of day
   * @param {string} timeOfDay - dawn, day, dusk, or night
   */
  setTimeOfDay(timeOfDay) {
    if (this.currentTimeOfDay === timeOfDay) return;

    console.log('Changing ambient sounds for time:', timeOfDay);
    this.currentTimeOfDay = timeOfDay;

    // Adjust sound layers for time of day
    this.updateTimeBasedSounds(timeOfDay);
  }

  /**
   * Fade in location-specific ambient layers
   */
  fadeInLocationSounds(locationKey) {
    const soundConfig = this.getLocationSoundConfig(locationKey);

    soundConfig.layers.forEach(layerKey => {
      this.fadeIn(layerKey, soundConfig.volumes[layerKey] || 0.5);
    });
  }

  /**
   * Get sound configuration for a location
   * Returns which sound layers to play and their volumes
   */
  getLocationSoundConfig(locationKey) {
    const configs = {
      'a-famosa-gate': {
        layers: ['base-tropical', 'fortress-ambience', 'distant-city'],
        volumes: {
          'base-tropical': 0.4,
          'fortress-ambience': 0.6,
          'distant-city': 0.3
        }
      },
      'rua-direita': {
        layers: ['base-tropical', 'market-crowd', 'street-life'],
        volumes: {
          'base-tropical': 0.3,
          'market-crowd': 0.7,
          'street-life': 0.5
        }
      },
      'st-pauls-church': {
        layers: ['base-tropical', 'church-bells', 'sacred-calm'],
        volumes: {
          'base-tropical': 0.4,
          'church-bells': 0.5,
          'sacred-calm': 0.6
        }
      },
      'waterfront': {
        layers: ['base-tropical', 'water-lapping', 'harbor-activity', 'seagulls'],
        volumes: {
          'base-tropical': 0.3,
          'water-lapping': 0.6,
          'harbor-activity': 0.5,
          'seagulls': 0.4
        }
      },
      'kampung': {
        layers: ['base-tropical', 'village-life', 'jungle-sounds'],
        volumes: {
          'base-tropical': 0.5,
          'village-life': 0.6,
          'jungle-sounds': 0.4
        }
      }
    };

    return configs[locationKey] || {
      layers: ['base-tropical'],
      volumes: { 'base-tropical': 0.5 }
    };
  }

  /**
   * Update sound layers based on time of day
   */
  updateTimeBasedSounds(timeOfDay) {
    // Dawn: add morning birds, reduce night insects
    if (timeOfDay === 'dawn') {
      this.fadeIn('morning-birds', 0.4);
      this.fadeOut('night-insects');
      this.fadeOut('cricket-chorus');
    }

    // Day: full ambient, birds active
    if (timeOfDay === 'day') {
      this.fadeOut('morning-birds');
      this.fadeOut('night-insects');
      this.fadeOut('cricket-chorus');
    }

    // Dusk: add evening sounds, reduce day sounds
    if (timeOfDay === 'dusk') {
      this.fadeIn('evening-calls', 0.3);
    }

    // Night: crickets, distant sounds, quieter overall
    if (timeOfDay === 'night') {
      this.fadeOut('evening-calls');
      this.fadeIn('night-insects', 0.5);
      this.fadeIn('cricket-chorus', 0.4);

      // Reduce volumes of other sounds at night
      Object.keys(this.activeSounds).forEach(key => {
        if (!key.includes('night') && !key.includes('cricket')) {
          const currentVolume = this.activeSounds[key]?.volume || 0.5;
          this.setVolume(key, currentVolume * 0.6);
        }
      });
    }
  }

  /**
   * Fade in a sound layer
   */
  fadeIn(soundKey, targetVolume = 0.5) {
    // Check if sound asset exists
    if (!this.scene.cache.audio.exists(soundKey)) {
      console.log(`Sound not loaded: ${soundKey} (will play when asset is added)`);
      return;
    }

    // If already playing, just adjust volume
    if (this.activeSounds[soundKey]) {
      this.scene.tweens.add({
        targets: this.activeSounds[soundKey],
        volume: targetVolume,
        duration: this.fadeSpeed
      });
      return;
    }

    // Create and play the sound
    const sound = this.scene.sound.add(soundKey, {
      loop: true,
      volume: 0
    });

    sound.play();
    this.activeSounds[soundKey] = sound;

    // Fade in
    this.scene.tweens.add({
      targets: sound,
      volume: targetVolume,
      duration: this.fadeSpeed
    });
  }

  /**
   * Fade out a specific sound layer
   */
  fadeOut(soundKey) {
    if (!this.activeSounds[soundKey]) return;

    const sound = this.activeSounds[soundKey];

    this.scene.tweens.add({
      targets: sound,
      volume: 0,
      duration: this.fadeSpeed,
      onComplete: () => {
        sound.stop();
        delete this.activeSounds[soundKey];
      }
    });
  }

  /**
   * Fade out all active sounds
   */
  fadeOutAll() {
    Object.keys(this.activeSounds).forEach(soundKey => {
      this.fadeOut(soundKey);
    });
  }

  /**
   * Set volume for a specific layer
   */
  setVolume(soundKey, volume) {
    if (!this.activeSounds[soundKey]) return;

    this.scene.tweens.add({
      targets: this.activeSounds[soundKey],
      volume: volume,
      duration: 500
    });
  }

  /**
   * Stop all sounds immediately
   */
  stopAll() {
    Object.values(this.activeSounds).forEach(sound => {
      sound.stop();
    });
    this.activeSounds = {};
  }

  /**
   * Cleanup when scene is destroyed
   */
  destroy() {
    this.stopAll();
  }
}
