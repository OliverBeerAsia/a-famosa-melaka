/**
 * Time System
 *
 * Manages game time and day/night cycle:
 * - Tracks game time (hours and minutes)
 * - Controls day/night transitions
 * - Affects lighting, NPC schedules, and ambience
 * - Can be accelerated for testing or slowed for gameplay
 */

export default class TimeSystem {
  constructor(scene) {
    this.scene = scene;

    // Time settings
    this.currentHour = 10; // Start at 10 AM
    this.currentMinute = 0;
    this.timeScale = 60; // 1 real second = 1 game minute (adjustable)

    // Day/night thresholds
    this.dawn = 6;
    this.day = 8;
    this.dusk = 18;
    this.night = 20;

    // Start time progression
    this.startTimer();
  }

  startTimer() {
    // Update time every real second (adjusted by timeScale)
    this.timer = this.scene.time.addEvent({
      delay: 1000 / (this.timeScale / 60), // Convert to real seconds
      callback: this.advanceTime,
      callbackScope: this,
      loop: true
    });
  }

  advanceTime() {
    this.currentMinute++;
    if (this.currentMinute >= 60) {
      this.currentMinute = 0;
      this.currentHour++;
      if (this.currentHour >= 24) {
        this.currentHour = 0;
      }

      // Emit hour change event
      this.scene.events.emit('hourChanged', this.currentHour);
    }
  }

  getTimeString() {
    const hour = this.currentHour.toString().padStart(2, '0');
    const minute = this.currentMinute.toString().padStart(2, '0');
    return `${hour}:${minute}`;
  }

  getTimeOfDay() {
    if (this.currentHour >= this.dawn && this.currentHour < this.day) {
      return 'dawn';
    } else if (this.currentHour >= this.day && this.currentHour < this.dusk) {
      return 'day';
    } else if (this.currentHour >= this.dusk && this.currentHour < this.night) {
      return 'dusk';
    } else {
      return 'night';
    }
  }

  // Get lighting values for current time (0-1 range)
  getLightingAlpha() {
    const hour = this.currentHour + (this.currentMinute / 60);

    // Full daylight (no overlay)
    if (hour >= this.day && hour < this.dusk) {
      return 0;
    }

    // Full night (maximum overlay)
    if (hour >= this.night || hour < this.dawn) {
      return 0.5; // 50% darkness
    }

    // Dawn transition (6-8 AM: fade from night to day)
    if (hour >= this.dawn && hour < this.day) {
      const progress = (hour - this.dawn) / (this.day - this.dawn);
      return 0.5 * (1 - progress); // Fade from 0.5 to 0
    }

    // Dusk transition (18-20: fade from day to night)
    if (hour >= this.dusk && hour < this.night) {
      const progress = (hour - this.dusk) / (this.night - this.dusk);
      return 0.5 * progress; // Fade from 0 to 0.5
    }

    return 0;
  }

  // Get tint color for current time
  getLightingTint() {
    const timeOfDay = this.getTimeOfDay();

    switch (timeOfDay) {
      case 'dawn':
        return 0xFFB366; // Warm orange dawn
      case 'day':
        return 0xFFFFFF; // Neutral white
      case 'dusk':
        return 0xFF9966; // Golden dusk
      case 'night':
        return 0x4A5A8A; // Cool blue night
      default:
        return 0xFFFFFF;
    }
  }

  destroy() {
    if (this.timer) {
      this.timer.remove();
    }
  }
}
