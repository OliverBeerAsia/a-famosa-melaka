/**
 * VisualQualitySystem — how much atmosphere the machine can afford.
 *
 * Three tiers (low / balanced / high) select a `VisualProfile`: particle
 * frequencies, fog layer count, sun shaft count, and the alpha multipliers for
 * point lights, AO, canopy shadows, grain and contact shadows. The player can
 * pin a tier in settings; on `auto` the system watches a rolling window of
 * frame deltas and steps the tier up or down.
 *
 * The cooldown after each step is what stops it oscillating: rebuilding the
 * atmosphere layers is itself a frame spike, so an eager sampler would read
 * that spike, downgrade again, and ratchet all the way to low on a machine
 * that was coping fine.
 */

import {
  VISUAL_PROFILES,
  resolveVisualQualityMode,
  type ResolvedVisualQuality,
  type VisualProfile,
  type VisualQualityMode,
} from '../visualProfile';

/** Frame-delta window used for the running average. */
const SAMPLE_WINDOW = 90;
/** Minimum samples before the system is willing to act. */
const MIN_SAMPLES = 45;
/** Average frame delta (ms) above which the tier steps down (~51fps). */
const DOWNGRADE_MS = 19.5;
/** Average frame delta (ms) below which the tier steps up (~69fps). */
const UPGRADE_MS = 14.5;
/** Frames of silence after a downgrade / upgrade. */
const DOWNGRADE_COOLDOWN = 180;
const UPGRADE_COOLDOWN = 220;

export class VisualQualitySystem {
  private mode: VisualQualityMode = 'auto';
  private resolved: ResolvedVisualQuality = 'balanced';
  private dynamicEnabled = true;
  private profile: VisualProfile = VISUAL_PROFILES.balanced;

  private frameDeltas: number[] = [];
  private sampleCooldown = 0;

  /** Fired whenever the resolved tier changes and layers must be rebuilt. */
  private readonly onChanged: (resolved: ResolvedVisualQuality) => void;

  constructor(
    init: { mode: VisualQualityMode; resolved: ResolvedVisualQuality; dynamic: boolean },
    onChanged: (resolved: ResolvedVisualQuality) => void,
  ) {
    this.mode = init.mode;
    this.dynamicEnabled = init.dynamic;
    this.resolved = resolveVisualQualityMode(init.mode, init.resolved);
    this.profile = VISUAL_PROFILES[this.resolved];
    this.onChanged = onChanged;
  }

  getProfile(): VisualProfile { return this.profile; }
  getResolved(): ResolvedVisualQuality { return this.resolved; }
  getMode(): VisualQualityMode { return this.mode; }

  /** Settings: pin a tier, or hand control back to `auto`. */
  setMode(mode: VisualQualityMode) {
    this.mode = mode;
    this.resolved = resolveVisualQualityMode(mode, this.resolved);
    this.apply();
  }

  /** Settings: enable/disable adaptive stepping. */
  setDynamic(enabled: boolean) {
    this.dynamicEnabled = enabled;
    if (!enabled || this.mode !== 'auto') return;
    this.resolved = 'balanced';
    this.apply();
  }

  private apply() {
    this.profile = VISUAL_PROFILES[this.resolved];
    this.onChanged(this.resolved);
  }

  private downgrade() {
    if (this.resolved === 'high') this.resolved = 'balanced';
    else if (this.resolved === 'balanced') this.resolved = 'low';
    this.apply();
  }

  private upgrade() {
    if (this.resolved === 'low') this.resolved = 'balanced';
    else if (this.resolved === 'balanced') this.resolved = 'high';
    this.apply();
  }

  /** Per frame: sample, and step the tier if the average has drifted. */
  update(deltaMs: number) {
    this.frameDeltas.push(deltaMs);
    if (this.frameDeltas.length > SAMPLE_WINDOW) this.frameDeltas.shift();

    if (!this.dynamicEnabled || this.mode !== 'auto') return;
    if (this.sampleCooldown > 0) {
      this.sampleCooldown -= 1;
      return;
    }
    if (this.frameDeltas.length < MIN_SAMPLES) return;

    const average = this.frameDeltas.reduce((sum, value) => sum + value, 0) / this.frameDeltas.length;
    if (average > DOWNGRADE_MS && this.resolved !== 'low') {
      this.downgrade();
      this.sampleCooldown = DOWNGRADE_COOLDOWN;
      return;
    }
    if (average < UPGRADE_MS && this.resolved !== 'high') {
      this.upgrade();
      this.sampleCooldown = UPGRADE_COOLDOWN;
    }
  }

  destroy() {
    this.frameDeltas = [];
    this.sampleCooldown = 0;
  }
}
