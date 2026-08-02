/**
 * WorldObjectSystem — everything in the world that is neither a character nor
 * the plate itself.
 *
 * Three populations, all authored in `<id>.location.json` and all reachable
 * through the same examine/take verb:
 *
 *  - **items**: pickups. A sprite, a glow, a pip and a label; taking one emits
 *    to the inventory and removes it from the world.
 *  - **lore objects**: the 18 historical objects. Same furniture, but they emit
 *    prose instead of an item.
 *  - **plate hotspots**: props the Forge compositor PAINTED INTO the plate.
 *    They own no display object at all — drawing them again would double-image
 *    every crate on the street — so the examine prose is the only thing left of
 *    them, and without this system it would be unreachable on a composed plate
 *    (`props` is empty in every Forge location by construction).
 *
 * It also owns the `EnvironmentObjectSystem`, which places the sprite-backed
 * props and the animated ones (torches, flags, seagulls). That system predates
 * this one and still carries the iso-grid cluster authoring path, so it is
 * composed rather than merged: one owner for "objects in the world", but the
 * older placement code keeps its own file until the iso path is retired.
 */

import Phaser from 'phaser';
import { worldDepth } from '../core/depth';
import { getLocationPlateProps } from '../core/LocationData';
import type { SystemContext } from '../core/SystemContext';
import { EnvironmentObjectSystem } from './EnvironmentObjectSystem';
import { emitGameEvent } from '../eventBridge';
import { ITEM_DEFINITIONS } from '../../stores/inventoryStore';
import historicalObjectsData from '../../data/historical-objects.json';
import {
  INTERACTION_PRIORITY,
  INTERACTION_RADIUS,
} from '../core/interactionScore';
import type {
  InteractionCandidate,
  InteractionScan,
  InteractionSystem,
} from './InteractionSystem';

/**
 * Plate-prop labels come from the kits, so some are hand-written sentences
 * ("The wall of A Famosa") and some are bare type names ("lantern post").
 * Only the first letter is touched — title-casing the rest would turn the
 * written ones into "The Wall Of A Famosa".
 */
export const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Sprite to borrow when an item has no icon of its own, by item type. */
const WORLD_ITEM_TYPE_FALLBACKS: Record<string, string> = {
  key: 'sack',
  document: 'scroll-rack',
  trade: 'spice-pile',
  consumable: 'flowers',
  valuable: 'ceramic-vase',
};

/** Stand-in sprites for lore objects whose own art has not landed yet. */
const LORE_SPRITE_ALIASES: Record<string, string> = {
  'coat-of-arms': 'tavern-sign',
  'stone-plaque': 'gravestone',
  keris: 'wayang-kulit-puppet',
  'ship-model': 'ship-mast',
  abacus: 'balance-scale',
  book: 'scroll-rack',
  scroll: 'scroll-rack',
  vase: 'ceramic-vase',
  'incense-burner': 'candelabra',
  gong: 'bell',
  chest: 'cargo-crate',
};

/** The texture every unresolved gameplay sprite falls back to. */
export const MISSING_PROP_TEXTURE = 'debug-prop-missing';

interface WorldItemData {
  id: string;
  itemId: string;
  x: number;
  y: number;
  description: string;
}

/** Shared furniture for a world object: sprite, ground glow, pip, hover label. */
interface PlacedObject {
  sprite: Phaser.GameObjects.Image;
  anchorX: number;
  anchorY: number;
  glow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface WorldItemInstance extends PlacedObject {
  id: string;
  itemId: string;
  description: string;
}

interface LoreObjectInstance extends PlacedObject {
  id: string;
  name: string;
  description: string;
}

export interface PlateHotspot {
  key: string;
  label: string;
  examineText: string;
  x: number;
  y: number;
  /**
   * Authored "this one matters" flag from the plate layout. Not used for
   * ranking yet — it is the hook Stage 5's openables and highlight pass read.
   */
  interactive: boolean;
}

export interface WorldObjectDeps {
  /** Toast for pickups. */
  notify(text: string): void;
}

export class WorldObjectSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: SystemContext;
  private readonly deps: WorldObjectDeps;

  private items: WorldItemInstance[] = [];
  private lore: LoreObjectInstance[] = [];
  private hotspots: PlateHotspot[] = [];
  private environment: EnvironmentObjectSystem | null = null;

  constructor(scene: Phaser.Scene, ctx: SystemContext, deps: WorldObjectDeps) {
    this.scene = scene;
    this.ctx = ctx;
    this.deps = deps;
  }

  // -- reads ---------------------------------------------------------------

  itemCount(): number { return this.items.length; }
  loreCount(): number { return this.lore.length; }
  hotspotCount(): number { return this.hotspots.length; }
  getPlateHotspots(): PlateHotspot[] { return this.hotspots; }

  // -- creation ------------------------------------------------------------

  create() {
    this.createWorldItems();
    this.createLoreObjects();
    this.createPlateHotspots();
  }

  /** The sprite-backed and animated props. Built after the plate exists. */
  createEnvironment() {
    this.environment = new EnvironmentObjectSystem(this.scene, this.ctx.quality());
    this.environment.initialize(this.ctx.locationId());
    this.environment.setTimeOfDay(this.ctx.timeOfDay());
  }

  /** Shared furniture builder: glow, pip and hidden label around a sprite. */
  private decorate(
    sprite: Phaser.GameObjects.Image,
    x: number,
    y: number,
    labelText: string,
    style: {
      glow: { w: number; h: number; color: number; alpha: number };
      pip: { radius: number; color: number; alpha: number; strokeAlpha: number };
      font: string;
      color: string;
    },
  ): PlacedObject {
    const markerY = y - Math.max(22, sprite.displayHeight) - 8;

    const glow = this.scene.add.ellipse(
      x, y - 4, style.glow.w, style.glow.h, style.glow.color, style.glow.alpha
    );
    glow.setDepth(979);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    // Subtle interaction pip (was a big bright disc that read as a coin).
    const marker = this.scene.add.circle(x, markerY, style.pip.radius, style.pip.color, style.pip.alpha);
    marker.setStrokeStyle(1, 0x3b2509, style.pip.strokeAlpha);
    marker.setDepth(sprite.depth + 1);

    const label = this.scene.add.text(x, markerY - 12, labelText, {
      font: style.font,
      color: style.color,
      stroke: '#000000',
      strokeThickness: 2,
    });
    label.setOrigin(0.5, 1);
    label.setDepth(sprite.depth + 2);
    label.setVisible(false);

    return { sprite, anchorX: x, anchorY: y, glow, marker, label };
  }

  private createWorldItems() {
    const worldItems = (this.ctx.location()?.items ?? []) as WorldItemData[];
    this.items = [];

    worldItems.forEach((item) => {
      const spriteKey = this.resolveWorldItemSpriteKey(item.itemId);
      const sprite = this.scene.add.image(item.x, item.y, spriteKey);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(this.getWorldItemScale(spriteKey));
      sprite.setDepth(worldDepth(item.y));

      const itemName = ITEM_DEFINITIONS[item.itemId]?.name || item.itemId;
      const placed = this.decorate(sprite, item.x, item.y, itemName, {
        glow: { w: 26, h: 13, color: 0xF4B41A, alpha: 0.1 },
        pip: { radius: 3.5, color: 0xF4B41A, alpha: 0.7, strokeAlpha: 0.8 },
        font: '12px Cinzel, Georgia, serif',
        color: '#F4E6BE',
      });

      this.items.push({
        ...placed,
        id: item.id,
        itemId: item.itemId,
        description: item.description,
      });
    });
  }

  private createLoreObjects() {
    // Positions come from <id>.location.json (native px, already scaled by
    // LocationData); the prose/sprite/historical note stay in
    // historical-objects.json. tools/validate-location-data.cjs guarantees every
    // id resolves and every coordinate is on the plate, so there is no runtime
    // bounds filter here any more — an off-plate lore object is a build failure.
    const objects = (historicalObjectsData as any).objects || {};
    this.lore = [];

    (this.ctx.location()?.loreObjects ?? []).forEach((placement) => {
      const obj = objects[placement.id];
      if (!obj) return;

      const { x, y } = placement;
      const spriteKey = this.resolveGameplaySpriteKey(obj.sprite);

      // Unresolved lore sprites fall back to the (invisible) placeholder — skip
      // them entirely so we don't leave floating markers with no object, and
      // say so loudly: a silently absent lore object looks exactly like a lore
      // object that was never authored.
      if (spriteKey === MISSING_PROP_TEXTURE) {
        console.warn(
          `[WorldObjectSystem] lore object '${placement.id}' wants sprite `
          + `'${obj.sprite}' — neither it nor its alias resolves to a loaded texture, `
          + `so it is NOT being placed in ${this.ctx.locationId()}. `
          + 'Ship the sprite or add an alias in LORE_SPRITE_ALIASES.'
        );
        return;
      }

      const sprite = this.scene.add.image(x, y, spriteKey);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(2); // match prop scale on the plate (3x was oversized)
      sprite.setDepth(worldDepth(y));

      const placed = this.decorate(sprite, x, y, obj.name, {
        glow: { w: 28, h: 14, color: 0xD4AF37, alpha: 0.06 },
        pip: { radius: 3, color: 0xD4AF37, alpha: 0.55, strokeAlpha: 0.7 },
        font: 'italic 11px Cinzel, Georgia, serif',
        color: '#D4AF37',
      });

      this.lore.push({
        ...placed,
        id: obj.id,
        name: obj.name,
        description: obj.examineText || obj.description,
      });
    });
  }

  /**
   * Painted props carry prose but no sprite. Coordinates are already in world
   * px (LocationData scaled them); anchors are bottom-centre like every other
   * ground-standing thing, and a prop can legitimately be anchored just off the
   * frame (a wall running past the edge), which is fine — the radius check in
   * the interaction scan is what decides whether it is reachable.
   */
  private createPlateHotspots() {
    this.hotspots = getLocationPlateProps(this.ctx.locationId())
      .filter((p: any) => typeof p.examineText === 'string' && p.examineText.length > 0)
      .map((p: any) => ({
        key: p.key,
        label: titleCase(p.label || p.type || p.key),
        examineText: p.examineText,
        x: p.x,
        y: p.y,
        interactive: Boolean(p.interactive),
      }));
  }

  // -- sprite resolution ---------------------------------------------------

  private resolveGameplaySpriteKey(preferredKey?: string): string {
    if (preferredKey && this.scene.textures.exists(preferredKey)) return preferredKey;

    const alias = preferredKey ? LORE_SPRITE_ALIASES[preferredKey] : null;
    if (alias && this.scene.textures.exists(alias)) return alias;

    return MISSING_PROP_TEXTURE;
  }

  private resolveWorldItemSpriteKey(itemId: string): string {
    const iconKey = `item-${itemId}`;
    if (this.scene.textures.exists(iconKey)) return iconKey;

    const itemType = ITEM_DEFINITIONS[itemId]?.type;
    return this.resolveGameplaySpriteKey(
      (itemType && WORLD_ITEM_TYPE_FALLBACKS[itemType]) || 'crate'
    );
  }

  private getWorldItemScale(spriteKey: string): number {
    // Pickups sit on the painted plate; keep icons small so they read as
    // items, not oversized props (was 2.5/3, which dwarfed characters).
    return spriteKey.startsWith('item-') ? 1.5 : 1.6;
  }

  // -- interaction ---------------------------------------------------------

  /** Offer items, painted scenery and lore objects to the interaction system. */
  registerInteractions(interaction: InteractionSystem) {
    interaction.registerProvider((scan: InteractionScan) => {
      const out: InteractionCandidate[] = [];
      for (const item of this.items) {
        const scored = scan.score(item.anchorX, item.anchorY, INTERACTION_RADIUS.item);
        if (!scored) continue;
        const itemName = ITEM_DEFINITIONS[item.itemId]?.name || item.itemId;
        out.push({
          type: 'item',
          id: item.id,
          label: `Take ${itemName}`,
          x: item.anchorX,
          y: item.anchorY,
          priority: INTERACTION_PRIORITY.item,
          score: scored.score,
          interact: () => this.takeItem(item.id, itemName),
        });
      }
      return out;
    });

    // Lowest priority and the tightest reach of any candidate: scenery must
    // never shadow an NPC, an item, a lore object or an exit.
    interaction.registerProvider((scan: InteractionScan) => {
      const out: InteractionCandidate[] = [];
      for (const p of this.hotspots) {
        const scored = scan.score(p.x, p.y, INTERACTION_RADIUS.scenery);
        if (!scored) continue;
        out.push({
          type: 'scenery',
          id: p.key,
          label: `Examine ${p.label}`,
          x: p.x,
          y: p.y,
          priority: INTERACTION_PRIORITY.scenery,
          score: scored.score,
          interact: () => emitGameEvent('message:show', p.label, p.examineText),
        });
      }
      return out;
    });

    interaction.registerProvider((scan: InteractionScan) => {
      const out: InteractionCandidate[] = [];
      for (const obj of this.lore) {
        const scored = scan.score(obj.anchorX, obj.anchorY, INTERACTION_RADIUS.lore);
        if (!scored) continue;
        out.push({
          type: 'lore',
          id: obj.id,
          label: `Examine ${obj.name}`,
          x: obj.anchorX,
          y: obj.anchorY,
          priority: INTERACTION_PRIORITY.lore,
          score: scored.score,
          interact: () => emitGameEvent('message:show', obj.name, obj.description),
        });
      }
      return out;
    });
  }

  /** Pick an item up: emit to the stores, toast, and remove it from the world. */
  private takeItem(id: string, itemName: string) {
    const index = this.items.findIndex((entry) => entry.id === id);
    if (index < 0) return;

    const item = this.items[index];
    emitGameEvent('item:pickup', item.itemId, itemName);
    emitGameEvent('item:examine', item.itemId, item.description);
    this.deps.notify(`Found: ${itemName}`);

    this.destroyPlaced(item);
    this.items.splice(index, 1);
  }

  // -- per frame -----------------------------------------------------------

  /** Pulse the pip and reveal the label of whichever item is being offered. */
  update(time: number, delta: number, targetedItemId: string | null) {
    this.items.forEach((item) => {
      const nearby = item.id === targetedItemId;
      item.label.setVisible(nearby);
      item.glow.setScale(nearby
        ? 1.15 + Math.sin(this.scene.time.now / 230) * 0.08
        : 1 + Math.sin(this.scene.time.now / 450) * 0.03);
      item.glow.setAlpha(nearby ? 0.26 : 0.16);
      item.marker.setScale(nearby ? 1 + Math.sin(this.scene.time.now / 200) * 0.2 : 1);
      item.marker.setAlpha(nearby ? 1 : 0.8);
    });

    this.environment?.update(time, delta);
  }

  setTimeOfDay() {
    this.environment?.setTimeOfDay(this.ctx.timeOfDay());
  }

  // -- teardown ------------------------------------------------------------

  private destroyPlaced(placed: PlacedObject) {
    placed.sprite.destroy();
    placed.glow.destroy();
    placed.marker.destroy();
    placed.label.destroy();
  }

  destroy() {
    this.environment?.destroy();
    this.environment = null;
    this.items.forEach((item) => this.destroyPlaced(item));
    this.items = [];
    this.lore.forEach((obj) => this.destroyPlaced(obj));
    this.lore = [];
    // Plain data, no display objects to destroy — but it must still be cleared,
    // or the old location's scenery stays examinable in the new one.
    this.hotspots = [];
  }
}
