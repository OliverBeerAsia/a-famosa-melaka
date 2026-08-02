/**
 * BackdropSystem — the plate the world is painted on.
 *
 * Owns the four things that together ARE the location's surface:
 *
 *  - the **plate** itself (and its baked dawn/dusk/night variants, crossfaded
 *    when the hour rolls over),
 *  - the **walk mask**, the authoritative walkable surface where a plate ships
 *    one — sampled per pixel, with a surface id in the green channel that also
 *    drives footstep audio,
 *  - the **foreground overlays**: pieces cut from the plate that a character
 *    can walk BEHIND, drawn at the exact pixels they were cut from so they are
 *    invisible until something passes behind them,
 *  - the fallback **collision rects**, used only where there is no mask.
 *
 * It also owns the legacy isometric tilemap path. That path is not the shipping
 * renderer (every location runs `legacy-backdrop`), but it still decides the
 * world size, so it lives with the thing that decides the world size.
 *
 * `hasBakedTimeVariant()` is the fact the rest of the engine reads off this
 * system: where the plate already carries a time-of-day grade, the runtime
 * grade and the runtime practicals must both go to zero, or the scene is
 * graded twice.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';
import { IsometricRenderer } from './IsometricRenderer';
import { WalkMask } from '../core/WalkMask';
import { worldDepth } from '../core/depth';
import type { SystemContext } from '../core/SystemContext';

// Map location keys to scene background prefixes
const LOCATION_TO_SCENE: Record<string, string> = {
  'a-famosa-gate': 'a-famosa',
  'rua-direita': 'rua-direita',
  'st-pauls-church': 'st-pauls',
  'waterfront': 'waterfront',
  'kampung': 'kampung',
};

/** Day plates carry no suffix, so they need their own lookup. */
const DAY_SCENE_KEYS: Record<string, string> = {
  'a-famosa': 'scene-a-famosa-gate',
  'rua-direita': 'scene-rua-direita',
  'st-pauls': 'scene-st-pauls-church',
  'waterfront': 'scene-waterfront',
  'kampung': 'scene-kampung',
};

/** All known tileset names -> iso texture keys (legacy isometric path). */
const ISO_TILESETS = [
  { name: 'fortress-stone', textureKey: 'fortress-stone-iso' },
  { name: 'grass', textureKey: 'grass-iso' },
  { name: 'cobblestone', textureKey: 'cobblestone-iso' },
  { name: 'cobblestone-v1', textureKey: 'cobblestone-v1-iso' },
  { name: 'cobblestone-v2', textureKey: 'cobblestone-v2-iso' },
  { name: 'cobblestone-v3', textureKey: 'cobblestone-v3-iso' },
  { name: 'cobblestone-grass-h', textureKey: 'cobblestone-grass-h-iso' },
  { name: 'cobblestone-grass-v', textureKey: 'cobblestone-grass-v-iso' },
  { name: 'cobblestone-dirt-v', textureKey: 'cobblestone-dirt-v-iso' },
  { name: 'laterite-stone', textureKey: 'laterite-stone-iso' },
  { name: 'wall-white', textureKey: 'wall-white-iso' },
  { name: 'dirt-path', textureKey: 'dirt-path-iso' },
  { name: 'bamboo-floor', textureKey: 'bamboo-floor-iso' },
  { name: 'thatch-roof', textureKey: 'thatch-roof-iso' },
  { name: 'church-stone', textureKey: 'church-stone-iso' },
  { name: 'church-floor', textureKey: 'church-floor-iso' },
  { name: 'water-tile', textureKey: 'water-tile-iso' },
  { name: 'dock-wood', textureKey: 'dock-wood-iso' },
  { name: 'roof-terracotta', textureKey: 'roof-terracotta-iso' },
  { name: 'door-wood', textureKey: 'door-wood-iso' },
];

export class BackdropSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;

  private currentBackground: Phaser.GameObjects.Image | null = null;
  private sceneColliders: Phaser.Physics.Arcade.StaticGroup | null = null;
  private mask: WalkMask | null = null;
  private plateOverlays: Phaser.GameObjects.Image[] = [];
  private isoRenderer: IsometricRenderer | null = null;
  private isometric = false;

  constructor(scene: Phaser.Scene, ctx: SystemContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  // -- public reads --------------------------------------------------------

  /**
   * The size of the world the player can move through, in world px.
   *
   * Pre-Stage-3 plates are 320x180 native = exactly the 960x540 viewport, so
   * this returns the viewport and every camera/particle/bounds calculation
   * behaves exactly as it did. A Forge-composed plate (640x360 native) returns
   * 1920x1080 and the same calculations start scrolling.
   */
  worldBounds(): { width: number; height: number } {
    if (this.isometric && this.isoRenderer) return this.isoRenderer.getWorldBounds();
    const location = this.ctx.location();
    if (location) return location.size;
    return { width: GAME_WIDTH, height: GAME_HEIGHT };
  }

  isIsometric(): boolean { return this.isometric; }
  renderer(): IsometricRenderer | null { return this.isoRenderer; }
  walkMask(): WalkMask | null { return this.mask; }
  colliders(): Phaser.Physics.Arcade.StaticGroup | null { return this.sceneColliders; }
  overlayCount(): number { return this.plateOverlays.length; }

  /** Build the backdrop for this location. Call once, before anything else. */
  create() {
    const runtimeMode = this.ctx.location()?.plate.runtimeMode || 'legacy-backdrop';
    if (runtimeMode === 'isometric') {
      this.createIsometricWorld();
      return;
    }

    const { width, height } = this.worldBounds();

    // Clear existing colliders
    if (this.sceneColliders) {
      this.sceneColliders.clear(true, true);
      this.sceneColliders = null;
    }

    // Set physics bounds
    this.scene.physics.world.setBounds(0, 0, width, height);

    // Draw background with time-of-day variant support
    const backgroundKey = this.getBackgroundKeyForTime();
    const fallbackKey = this.ctx.location()?.plate.background;
    const plateKey = (backgroundKey && this.scene.textures.exists(backgroundKey))
      ? backgroundKey
      : (fallbackKey && this.scene.textures.exists(fallbackKey) ? fallbackKey : null);

    if (plateKey) {
      this.currentBackground = this.placePlate(plateKey);
    } else {
      // Fallback gradient background
      const graphics = this.scene.add.graphics();
      graphics.fillGradientStyle(0x1a0f05, 0x1a0f05, 0x3d2817, 0x3d2817, 1);
      graphics.fillRect(0, 0, width, height);
      graphics.setDepth(-20);
    }

    // Add vignette — screen space, so it frames the VIEW rather than the world.
    const vignette = this.scene.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.16, 0.07, 0.07, 0.16);
    vignette.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    vignette.setScrollFactor(0);
    vignette.setDepth(-10);

    this.createWalkMask();
    this.createPlateOverlays();

    // Collision rects are the fallback for plates with no walk mask. Where a
    // mask exists it is authoritative (the rects are a coarse 8px cover of it),
    // and building both would block the player twice with different edges.
    const collisionRects = this.ctx.location()?.collisionRects;
    if (!this.mask && collisionRects?.length) {
      this.sceneColliders = this.scene.physics.add.staticGroup();
      collisionRects.forEach((rect) => {
        const collider = this.scene.add.rectangle(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          rect.width,
          rect.height,
          0x000000,
          0
        );
        this.scene.physics.add.existing(collider, true);
        this.sceneColliders!.add(collider);
      });
    }
  }

  /**
   * Put a plate into the world at 1:1 world pixels, top-left anchored.
   *
   * The plate is world-space (scroll factor 1) even when it exactly fills the
   * viewport: at that size scrolling is clamped to (0,0) so the two are
   * identical, and having ONE placement rule is what stops the flip-screen and
   * scrolling paths from drifting apart.
   */
  placePlate(textureKey: string, depth = -20): Phaser.GameObjects.Image {
    const { width, height } = this.worldBounds();
    const plate = this.scene.add.image(0, 0, textureKey);
    plate.setOrigin(0, 0);
    plate.setScale(width / plate.width, height / plate.height);
    plate.setScrollFactor(1);
    plate.setDepth(depth);
    return plate;
  }

  /** Load the location's walk mask into a sampler, if it ships one. */
  createWalkMask() {
    this.mask = null;
    const key = this.ctx.location()?.plate.walkMask;
    if (!key || !this.scene.textures.exists(key)) return;

    const source = this.scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = this.scene.textures.createCanvas(`${key}-sampler`, source.width, source.height);
    if (!canvas) return;
    canvas.context.imageSmoothingEnabled = false;
    canvas.context.drawImage(source as CanvasImageSource, 0, 0);
    const rgba = canvas.context.getImageData(0, 0, source.width, source.height).data;
    this.mask = WalkMask.fromRGBA(rgba, source.width, source.height, this.ctx.location()!.world.scale);
    this.scene.textures.remove(`${key}-sampler`);
  }

  /**
   * Foreground occluders: the pieces of the plate a character can walk BEHIND.
   *
   * They are drawn at the exact pixels they were cut from, so while nothing is
   * behind them they are invisible (they reproduce the plate underneath), and
   * `worldDepth(depthY)` puts them in front of any character standing further
   * up the street. Relit per time of day by the same LUT as the plate.
   */
  createPlateOverlays() {
    this.plateOverlays.forEach((o) => o.destroy());
    this.plateOverlays = [];

    (this.ctx.location()?.overlays ?? []).forEach((overlay) => {
      const key = this.overlayTextureKey(overlay.key);
      if (!this.scene.textures.exists(key)) return;
      const image = this.scene.add.image(overlay.x, overlay.y, key);
      image.setOrigin(0, 0);
      image.setScrollFactor(1);
      image.setDepth(worldDepth(overlay.depthY));
      image.setData('overlayKey', overlay.key);
      this.plateOverlays.push(image);
    });
  }

  overlayTextureKey(baseKey: string): string {
    return this.ctx.timeOfDay() === 'day' ? baseKey : `${baseKey}-${this.ctx.timeOfDay()}`;
  }

  /** Crossfade the occluders alongside the plate when the hour changes. */
  updatePlateOverlaysForTime() {
    this.plateOverlays.forEach((image) => {
      const baseKey = image.getData('overlayKey') as string;
      const key = this.overlayTextureKey(baseKey);
      if (!this.scene.textures.exists(key) || image.texture.key === key) return;

      const replacement = this.scene.add.image(image.x, image.y, key);
      replacement.setOrigin(0, 0);
      replacement.setScrollFactor(1);
      replacement.setDepth(image.depth);
      replacement.setData('overlayKey', baseKey);
      replacement.setAlpha(0);
      this.scene.tweens.add({ targets: replacement, alpha: 1, duration: 2000, ease: 'Sine.easeInOut' });
      this.scene.tweens.add({
        targets: image,
        alpha: 0,
        duration: 2000,
        ease: 'Sine.easeInOut',
        onComplete: () => image.destroy(),
      });
      const index = this.plateOverlays.indexOf(image);
      if (index !== -1) this.plateOverlays[index] = replacement;
    });
  }

  createIsometricWorld() {
    this.isometric = true;

    // Clean up any existing colliders
    if (this.sceneColliders) {
      this.sceneColliders.clear(true, true);
      this.sceneColliders = null;
    }

    const isoMapKey = this.ctx.location()?.plate.isoMapKey || `${this.ctx.locationId()}-iso`;

    // ISO_TILESETS lists every known tileset; IsometricRenderer's
    // addTilesetImage silently skips any not present in the JSON.

    this.isoRenderer = new IsometricRenderer(this.scene, isoMapKey, ISO_TILESETS);
    this.isoRenderer.create();

    // Set physics and camera bounds to isometric world size
    const bounds = this.isoRenderer.getWorldBounds();
    this.scene.physics.world.setBounds(0, 0, bounds.width, bounds.height);

    // Neutral void behind the authored tilemap; it should not read as walkable soil.
    const bg = this.scene.add.rectangle(bounds.width / 2, bounds.height / 2, bounds.width, bounds.height, 0x060504);
    bg.setDepth(-20);
  }

  getBackgroundKeyForTime(): string | null {
    const scenePrefix = LOCATION_TO_SCENE[this.ctx.locationId()];
    if (!scenePrefix) return null;

    // For day, use the base scene (no suffix)
    if (this.ctx.timeOfDay() === 'day') {
      return DAY_SCENE_KEYS[scenePrefix] || null;
    }

    // For other times, use the variant
    return `scene-${scenePrefix}-${this.ctx.timeOfDay()}`;
  }

  /**
   * True when the visible backdrop is a pre-baked time-of-day plate variant
   * (scene-<location>-dawn/dusk/night).
   *
   * Those plates already carry the time-of-day grade, so the full-screen
   * plate-wide overlays (TIME_COLORS lighting tint + TIME_COLOR_GRADE
   * multiply/screen) must be suppressed — otherwise the scene is graded twice
   * and nights turn into crushed blue mud. Character lighting is unaffected:
   * sprites are not baked, so they still need the runtime tint/alpha pass.
   */
  hasBakedTimeVariant(): boolean {
    if (this.isometric) return false;
    // 'day' uses the base plate, which carries no baked grade.
    if (this.ctx.timeOfDay() === 'day') return false;
    const key = this.getBackgroundKeyForTime();
    return !!key && this.scene.textures.exists(key);
  }

  updateBackgroundForTime() {
    const newBackgroundKey = this.getBackgroundKeyForTime();

    if (!newBackgroundKey || !this.scene.textures.exists(newBackgroundKey)) {
      console.log(`Background not found: ${newBackgroundKey}, keeping current`);
      return;
    }

    if (this.currentBackground) {
      // Crossfade to new background
      const newBg = this.placePlate(newBackgroundKey, -21); // -21: behind current
      newBg.setAlpha(0);

      // Fade in new, fade out old
      this.scene.tweens.add({
        targets: newBg,
        alpha: 1,
        duration: 2000,
        ease: 'Sine.easeInOut',
      });

      this.scene.tweens.add({
        targets: this.currentBackground,
        alpha: 0,
        duration: 2000,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (this.currentBackground) {
            this.currentBackground.destroy();
          }
          newBg.setDepth(-20);
          this.currentBackground = newBg;
        }
      });

      this.updatePlateOverlaysForTime();
    }
  }

  /** The hour rolled over: crossfade the plate and its overlays. */
  setTimeOfDay() {
    this.updateBackgroundForTime();
  }

  /** Iso path only: the renderer culls around the player. */
  update(playerX: number, playerY: number) {
    if (this.isometric && this.isoRenderer) this.isoRenderer.update(playerX, playerY);
  }

  destroy() {
    if (this.isoRenderer) {
      this.isoRenderer.destroy();
      this.isoRenderer = null;
    }
    this.isometric = false;

    if (this.sceneColliders) {
      // Arcade Physics registers its SHUTDOWN listener when the scene BOOTS;
      // the scene's own cleanup runs after it. So by the time this runs, the
      // physics world — and the static tree this group removes itself from —
      // is already gone, and clear() throws `Cannot read properties of
      // undefined (reading 'size')`. That exception used to abort the REST of
      // cleanup and leave the scene half-shut-down, so scene.restart() never
      // completed — and every in-game location transition goes through
      // scene.restart(). Phaser destroys the group with the scene regardless,
      // so dropping the reference is the whole job here; the explicit clear
      // only matters while the world is still alive.
      if (this.scene.physics?.world) {
        this.sceneColliders.clear(true, true);
      }
      this.sceneColliders = null;
    }

    this.plateOverlays = [];
    this.currentBackground = null;
    this.mask = null;
  }
}
