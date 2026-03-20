/**
 * Music System
 *
 * Manages background music and location-based soundtracks:
 * - Location-specific music tracks
 * - Time-of-day variations
 * - Smooth crossfading between tracks
 * - Volume control
 */

export default class MusicSystem {
  constructor(scene) {
    this.scene = scene;
    this.currentTrack = null;
    this.currentTrackKey = null;
    this.volume = 0.5;
    this.fadeSpeed = 2000;
    this.enabled = true;

    // Track configuration per location
    this.locationTracks = {
      'a-famosa-gate': {
        day: 'music-fortress',
        night: 'music-night'
      },
      'rua-direita': {
        day: 'music-market',
        night: 'music-night'
      },
      'st-pauls-church': {
        day: 'music-church',
        night: 'music-church'
      },
      'waterfront': {
        day: 'music-waterfront',
        night: 'music-night'
      },
      'kampung': {
        day: 'music-main',
        night: 'music-night'
      }
    };

    // Track metadata
    this.trackInfo = {
      'music-main': {
        name: 'Streets of Golden Melaka',
        description: 'Main theme - wistful, adventurous, hints of longing'
      },
      'music-market': {
        name: 'Market Day',
        description: 'Lively, bustling, layered percussion'
      },
      'music-church': {
        name: "St. Paul's Hill",
        description: 'Contemplative, church bells, sacred calm'
      },
      'music-waterfront': {
        name: 'The Waterfront',
        description: 'Sea shanty feel, waves, creaking wood'
      },
      'music-night': {
        name: 'Night in Melaka',
        description: 'Mysterious, quieter, cicadas, distant music'
      },
      'music-fortress': {
        name: 'A Famosa',
        description: 'Martial, Portuguese colonial grandeur'
      },
      'music-tension': {
        name: 'Shadows',
        description: 'Danger/tension theme for confrontations'
      }
    };
  }

  /**
   * Set music for a location
   */
  setLocation(locationKey) {
    const config = this.locationTracks[locationKey];
    if (!config) {
      console.log(`No music config for location: ${locationKey}`);
      return;
    }

    // Determine which track to play based on time of day
    const timeOfDay = this.scene.timeSystem?.getTimeOfDay() || 'day';
    const isNight = timeOfDay === 'night' || timeOfDay === 'dusk';
    const trackKey = isNight ? config.night : config.day;

    this.playTrack(trackKey);
  }

  /**
   * Update music based on time of day change
   */
  updateTimeOfDay(timeOfDay) {
    if (!this.currentLocation) return;

    const config = this.locationTracks[this.currentLocation];
    if (!config) return;

    const isNight = timeOfDay === 'night' || timeOfDay === 'dusk';
    const trackKey = isNight ? config.night : config.day;

    if (trackKey !== this.currentTrackKey) {
      this.playTrack(trackKey);
    }
  }

  /**
   * Play a specific track with crossfade
   */
  playTrack(trackKey) {
    if (!this.enabled) return;
    if (trackKey === this.currentTrackKey) return;

    // Check if track exists
    if (!this.scene.cache.audio.exists(trackKey)) {
      console.log(`Music track not loaded: ${trackKey} (will play when asset is added)`);
      return;
    }

    // Fade out current track
    if (this.currentTrack) {
      this.scene.tweens.add({
        targets: this.currentTrack,
        volume: 0,
        duration: this.fadeSpeed,
        onComplete: () => {
          this.currentTrack.stop();
        }
      });
    }

    // Start new track
    this.currentTrack = this.scene.sound.add(trackKey, {
      loop: true,
      volume: 0
    });
    this.currentTrack.play();
    this.currentTrackKey = trackKey;

    // Fade in
    this.scene.tweens.add({
      targets: this.currentTrack,
      volume: this.volume,
      duration: this.fadeSpeed
    });

    const info = this.trackInfo[trackKey];
    if (info) {
      console.log(`Now playing: ${info.name}`);
    }
  }

  /**
   * Play tension music (for dangerous situations)
   */
  playTension() {
    this.playTrack('music-tension');
  }

  /**
   * Resume location music after tension
   */
  resumeLocationMusic() {
    if (this.currentLocation) {
      this.setLocation(this.currentLocation);
    }
  }

  /**
   * Set volume
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentTrack) {
      this.currentTrack.setVolume(this.volume);
    }
  }

  /**
   * Toggle music on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      if (this.currentLocation) {
        this.setLocation(this.currentLocation);
      }
    } else {
      this.stop();
    }
    return this.enabled;
  }

  /**
   * Stop all music
   */
  stop() {
    if (this.currentTrack) {
      this.scene.tweens.add({
        targets: this.currentTrack,
        volume: 0,
        duration: 500,
        onComplete: () => {
          this.currentTrack.stop();
          this.currentTrack = null;
          this.currentTrackKey = null;
        }
      });
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.currentTrack) {
      this.currentTrack.stop();
    }
  }
}

