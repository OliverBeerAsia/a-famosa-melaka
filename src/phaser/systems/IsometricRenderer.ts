/**
 * Isometric Tilemap Renderer
 *
 * Encapsulates Phaser's built-in isometric tilemap system.
 * When a Tiled JSON has orientation:"isometric", Phaser handles
 * the diamond tile rendering automatically. This module manages
 * tilemap creation, layer setup, collision, and coordinate conversion.
 */

import Phaser from 'phaser';

export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;

interface TilesetMapping {
  /** Tileset name as defined in the Tiled JSON */
  name: string;
  /** Phaser texture key for the loaded iso sprite (e.g. 'fortress-stone-iso') */
  textureKey: string;
}

export class IsometricRenderer {
  private scene: Phaser.Scene;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private wallsLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private mapKey: string;
  private tilesetMappings: TilesetMapping[];

  constructor(
    scene: Phaser.Scene,
    mapKey: string,
    tilesetMappings: TilesetMapping[],
  ) {
    this.scene = scene;
    this.mapKey = mapKey;
    this.tilesetMappings = tilesetMappings;
  }

  create(): void {
    this.map = this.scene.make.tilemap({ key: this.mapKey });

    // Add each tileset, mapping JSON names to loaded iso texture keys
    const tilesets: Phaser.Tilemaps.Tileset[] = [];
    for (const mapping of this.tilesetMappings) {
      const tileset = this.map.addTilesetImage(
        mapping.name,
        mapping.textureKey,
      );
      if (tileset) {
        tilesets.push(tileset);
      } else {
        console.warn(
          `IsometricRenderer: tileset "${mapping.name}" → "${mapping.textureKey}" failed to load`,
        );
      }
    }

    if (tilesets.length === 0) {
      console.error('IsometricRenderer: no tilesets loaded');
      return;
    }

    // Create ground layer
    const groundLayer = this.map.createLayer('Ground', tilesets);
    if (groundLayer) {
      groundLayer.setDepth(-15);
      this.groundLayer = groundLayer;
    }

    // Create walls layer with collision
    const wallsLayer = this.map.createLayer('Walls', tilesets);
    if (wallsLayer) {
      wallsLayer.setDepth(0);
      // Collide with any non-empty tile in the walls layer
      wallsLayer.setCollisionByExclusion([-1, 0]);
      this.wallsLayer = wallsLayer;
    }
  }

  /** Convert world pixel coordinates to tile coordinates */
  worldToTile(worldX: number, worldY: number): Phaser.Math.Vector2 {
    const point = this.map.worldToTileXY(worldX, worldY);
    return point || new Phaser.Math.Vector2(0, 0);
  }

  /** Convert tile coordinates to world pixel coordinates (center of tile) */
  tileToWorld(tileX: number, tileY: number): Phaser.Math.Vector2 {
    const point = this.map.tileToWorldXY(tileX, tileY);
    if (point) {
      // tileToWorldXY returns the top-left of the tile diamond.
      // Offset to center of the tile for entity placement.
      point.x += ISO_TILE_WIDTH / 2;
      point.y += ISO_TILE_HEIGHT / 2;
    }
    return point || new Phaser.Math.Vector2(0, 0);
  }

  /** Get the walls tilemap layer for physics collision */
  getCollisionLayer(): Phaser.Tilemaps.TilemapLayer | null {
    return this.wallsLayer;
  }

  /** Get the underlying Phaser tilemap */
  getMap(): Phaser.Tilemaps.Tilemap {
    return this.map;
  }

  /** Calculate world-space bounds of the isometric map */
  getWorldBounds(): { width: number; height: number } {
    const w = this.map.width;
    const h = this.map.height;
    // Isometric diamond: width = (mapW + mapH) * tileW/2, height = (mapW + mapH) * tileH/2
    return {
      width: (w + h) * (ISO_TILE_WIDTH / 2),
      height: (w + h) * (ISO_TILE_HEIGHT / 2),
    };
  }

  destroy(): void {
    if (this.groundLayer) {
      this.groundLayer.destroy();
      this.groundLayer = null;
    }
    if (this.wallsLayer) {
      this.wallsLayer.destroy();
      this.wallsLayer = null;
    }
  }
}
