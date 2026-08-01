/**
 * Isometric Tilemap Renderer
 *
 * Encapsulates Phaser's built-in isometric tilemap system.
 * When a Tiled JSON has orientation:"isometric", Phaser handles
 * the diamond tile rendering automatically. This module manages
 * tilemap creation, layer setup, collision, and coordinate conversion.
 */

import Phaser from 'phaser';
import { worldDepth } from '../core/depth';

export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;

interface TilesetMapping {
  /** Tileset name as defined in the Tiled JSON */
  name: string;
  /** Phaser texture key for the loaded iso sprite (e.g. 'fortress-stone-iso') */
  textureKey: string;
}

interface RaisedTileStyle {
  height: number;
  top: number;
  left: number;
  right: number;
  outline: number;
  detail: 'whitewash' | 'roof' | 'door' | 'stone' | 'thatch';
}

interface NeighborFlags {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

interface BuildingTile {
  tile: Phaser.Tilemaps.Tile;
  tilesetName: string;
  style: RaisedTileStyle;
}

interface BuildingComponent {
  tiles: BuildingTile[];
  keys: Set<string>;
  primaryStyle: RaisedTileStyle;
  roofStyle: RaisedTileStyle;
}

const RAISED_BUILDING_TILES: Record<string, RaisedTileStyle> = {
  'wall-white': {
    height: 52,
    top: 0xd9d5cc,
    left: 0xb9b4aa,
    right: 0x8f8a82,
    outline: 0x4a4540,
    detail: 'whitewash',
  },
  'roof-terracotta': {
    height: 68,
    top: 0xba5a28,
    left: 0x8a3a18,
    right: 0x5a2110,
    outline: 0x2a0a05,
    detail: 'roof',
  },
  'door-wood': {
    height: 52,
    top: 0xcac5c0,
    left: 0xaaa5a0,
    right: 0x7a7570,
    outline: 0x3a3530,
    detail: 'door',
  },
  'laterite-stone': {
    height: 56,
    top: 0xaa7028,
    left: 0x8a5a20,
    right: 0x4a3010,
    outline: 0x2a1a05,
    detail: 'stone',
  },
  'church-stone': {
    height: 60,
    top: 0xaaa5a0,
    left: 0x7a7570,
    right: 0x4a4540,
    outline: 0x2a2520,
    detail: 'stone',
  },
  'thatch-roof': {
    height: 44,
    top: 0x8a8540,
    left: 0x5a5528,
    right: 0x3a3518,
    outline: 0x1a1508,
    detail: 'thatch',
  },
};

export class IsometricRenderer {
  private scene: Phaser.Scene;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private wallsLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private objectSprites: Phaser.GameObjects.GameObject[] = [];
  private mapKey: string;
  private tilesetMappings: TilesetMapping[];
  private buildingComponents: Array<{
    graphicsList: Phaser.GameObjects.Graphics[];
    tiles: Array<{
      worldX: number;
      worldY: number;
      height: number;
    }>;
  }> = [];

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
    const mapTilesetNames = new Set(this.map.tilesets.map((tileset) => tileset.name));
    for (const mapping of this.tilesetMappings) {
      if (!mapTilesetNames.has(mapping.name)) continue;

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

    // Create the visual walls layer. Collision is authored separately so wall
    // art never creates broad blockers over walkable isometric diamonds.
    const wallsLayer = this.map.createLayer('Walls', tilesets);
    if (wallsLayer) {
      wallsLayer.setDepth(0);
      this.wallsLayer = wallsLayer;
      this.createRaisedBuildingTiles();
    }

    this.createObjectGroups();
  }

  private createObjectGroups(): void {
    const layerNames = ['Objects', 'Props', 'Overhang', 'Canopy', 'Highlights'];

    layerNames.forEach((layerName) => {
      const objectLayer = this.map.getObjectLayer(layerName);
      if (!objectLayer) return;

      objectLayer.objects.forEach((obj) => {
        const textureKey = this.scene.textures.exists(obj.name) ? obj.name : 'debug-prop-missing';
        const x = (obj.x || 0) + ((obj.width || 0) / 2);
        const y = obj.y || 0;
        const image = this.scene.add.image(x, y, textureKey);
        image.setOrigin(0.5, 1);
        image.setScale(3);
        image.setDepth(this.getObjectDepth(layerName, y));
        this.objectSprites.push(image);
      });
    });
  }

  private getObjectDepth(layerName: string, y: number): number {
    if (layerName === 'Highlights') return y + 3000;
    if (layerName === 'Overhang' || layerName === 'Canopy') return y + 2000;
    return y;
  }

  private createRaisedBuildingTiles(): void {
    if (!this.wallsLayer) return;

    const tiles = this.wallsLayer.getTilesWithin(
      0,
      0,
      this.map.width,
      this.map.height,
      { isNotEmpty: true },
    );

    const buildingTiles = new Map<string, BuildingTile>();
    tiles.forEach((tile) => {
      const tilesetName = this.getTilesetNameForTile(tile);
      if (!tilesetName) return;
      const style = RAISED_BUILDING_TILES[tilesetName];
      if (!style) return;
      buildingTiles.set(`${tile.x},${tile.y}`, { tile, tilesetName, style });
    });

    this.buildingComponents = [];

    this.collectBuildingComponents(buildingTiles).forEach((component) => {
      const graphicsList: Phaser.GameObjects.Graphics[] = [];
      const tilesInfo: Array<{ worldX: number; worldY: number; height: number }> = [];

      component.tiles.forEach((bTile) => {
        const building = this.scene.add.graphics();
        const world = this.tileToWorld(bTile.tile.x, bTile.tile.y);
        // Set quantized individual depth per tile tip to fix 1D sorting popping and z-fighting
        building.setDepth(worldDepth(world.y + ISO_TILE_HEIGHT / 2));
        
        const neighbors = this.getComponentNeighbors(component.keys, bTile.tile.x, bTile.tile.y);
        this.drawBuildingTile(
          building,
          world.x,
          world.y,
          bTile.style,
          component.primaryStyle,
          component.roofStyle,
          bTile.tile.x,
          bTile.tile.y,
          neighbors,
        );
        this.objectSprites.push(building);
        graphicsList.push(building);

        tilesInfo.push({
          worldX: world.x,
          worldY: world.y,
          height: bTile.style.height || 52
        });
      });

      this.buildingComponents.push({
        graphicsList,
        tiles: tilesInfo
      });
    });

    buildingTiles.forEach(({ tile }) => {
      this.wallsLayer!.removeTileAt(tile.x, tile.y);
    });
  }

  private collectBuildingComponents(
    buildingTiles: Map<string, BuildingTile>,
  ): BuildingComponent[] {
    const visited = new Set<string>();
    const components: BuildingComponent[] = [];

    buildingTiles.forEach((start, startKey) => {
      if (visited.has(startKey)) return;

      const keys = new Set<string>();
      const queue = [start];
      const tiles: BuildingTile[] = [];
      visited.add(startKey);
      keys.add(startKey);

      while (queue.length > 0) {
        const current = queue.shift()!;
        tiles.push(current);

        [
          [current.tile.x, current.tile.y - 1],
          [current.tile.x, current.tile.y + 1],
          [current.tile.x + 1, current.tile.y],
          [current.tile.x - 1, current.tile.y],
        ].forEach(([x, y]) => {
          const key = `${x},${y}`;
          const neighbor = buildingTiles.get(key);
          if (!neighbor || visited.has(key)) return;

          visited.add(key);
          keys.add(key);
          queue.push(neighbor);
        });
      }

      const roofTile = tiles.find(({ style }) => (
        style.detail === 'roof' || style.detail === 'thatch'
      ));
      const facadeTile = tiles.find(({ style }) => (
        style.detail === 'whitewash' || style.detail === 'door' || style.detail === 'stone'
      ));
      const fallbackRoofStyle = facadeTile?.style.detail === 'whitewash' || facadeTile?.style.detail === 'door'
        ? RAISED_BUILDING_TILES['roof-terracotta']
        : facadeTile?.style;

      components.push({
        tiles,
        keys,
        primaryStyle: facadeTile?.style || start.style,
        roofStyle: roofTile?.style || fallbackRoofStyle || start.style,
      });
    });

    return components;
  }

  private drawBuildingComponent(
    graphics: Phaser.GameObjects.Graphics,
    component: BuildingComponent,
  ): void {
    const sorted = [...component.tiles].sort((left, right) => (
      (left.tile.x + left.tile.y) - (right.tile.x + right.tile.y)
    ));

    sorted.forEach(({ tile, style }) => {
      const world = this.tileToWorld(tile.x, tile.y);
      const neighbors = this.getComponentNeighbors(component.keys, tile.x, tile.y);
      this.drawBuildingTile(
        graphics,
        world.x,
        world.y,
        style,
        component.primaryStyle,
        component.roofStyle,
        tile.x,
        tile.y,
        neighbors,
      );
    });
  }

  private getComponentNeighbors(keys: Set<string>, tileX: number, tileY: number): NeighborFlags {
    return {
      north: keys.has(`${tileX},${tileY - 1}`),
      south: keys.has(`${tileX},${tileY + 1}`),
      east: keys.has(`${tileX + 1},${tileY}`),
      west: keys.has(`${tileX - 1},${tileY}`),
    };
  }

  private getTilesetNameForTile(tile: Phaser.Tilemaps.Tile): string | null {
    const tileIndex = tile.index;
    const tilesets = this.map.tilesets as Array<Phaser.Tilemaps.Tileset & {
      firstgid?: number;
      total?: number;
      tileTotal?: number;
    }>;

    let match: string | null = null;
    tilesets.forEach((tileset) => {
      const firstgid = tileset.firstgid ?? 1;
      const total = tileset.total ?? tileset.tileTotal ?? 1;
      if (tileIndex >= firstgid && tileIndex < firstgid + total) {
        match = tileset.name;
      }
    });

    return match;
  }

  private drawBuildingTile(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    style: RaisedTileStyle,
    facadeStyle: RaisedTileStyle,
    roofStyle: RaisedTileStyle,
    tileX: number,
    tileY: number,
    neighbors: NeighborFlags,
  ): void {
    const halfW = ISO_TILE_WIDTH / 2;
    const halfH = ISO_TILE_HEIGHT / 2;
    const raisedY = y - style.height;

    const top = { x, y: raisedY - halfH };
    const right = { x: x + halfW, y: raisedY };
    const bottom = { x, y: raisedY + halfH };
    const left = { x: x - halfW, y: raisedY };
    const baseRight = { x: x + halfW, y };
    const baseBottom = { x, y: y + halfH };
    const baseLeft = { x: x - halfW, y };

    const topStyle = style.detail === 'door' ? facadeStyle : style;
    const roofIsThatch = roofStyle.detail === 'thatch';
    const isPortugueseHouse = facadeStyle.detail === 'whitewash' || facadeStyle.detail === 'door';
    const topColor = roofStyle.top;
    const roofLeft = roofIsThatch ? 0x7a7538 : (isPortugueseHouse ? 0xba5a28 : topColor);
    const roofRight = roofIsThatch ? 0x4a4520 : (isPortugueseHouse ? 0x8a3a18 : topColor);

    if (!neighbors.south) {
      this.fillPolygon(graphics, [left, bottom, baseBottom, baseLeft], facadeStyle.left);
    }
    if (!neighbors.east) {
      this.fillPolygon(graphics, [right, baseRight, baseBottom, bottom], facadeStyle.right);
    }

    if (roofStyle.detail === 'roof' || roofStyle.detail === 'thatch' || isPortugueseHouse) {
      const ridge = { x, y: raisedY - (roofStyle.detail === 'thatch' ? 9 : 5) };
      this.fillPolygon(graphics, [top, ridge, bottom, left], roofLeft);
      this.fillPolygon(graphics, [top, right, bottom, ridge], roofRight);
      graphics.lineStyle(1, roofStyle.detail === 'thatch' ? 0x3a3518 : 0x4a1a0a, 0.65);
      graphics.lineBetween(top.x, top.y, bottom.x, bottom.y);
      graphics.lineBetween(left.x, left.y, right.x, right.y);
    } else {
      this.fillPolygon(graphics, [top, right, bottom, left], topColor);
    }

    graphics.lineStyle(1, topStyle.outline, 0.7);
    graphics.strokePoints([top, right, bottom, left, top], false, false);
    if (!neighbors.south || !neighbors.east) {
      graphics.strokePoints([left, baseLeft, baseBottom, baseRight, right], false, false);
    }

    this.drawRaisedTileDetail(graphics, x, y, topStyle, roofStyle, tileX, tileY, neighbors);
  }

  private fillPolygon(
    graphics: Phaser.GameObjects.Graphics,
    points: Array<{ x: number; y: number }>,
    color: number,
  ): void {
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.closePath();
    graphics.fillPath();
  }

  private drawRaisedTileDetail(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    style: RaisedTileStyle,
    roofStyle: RaisedTileStyle,
    tileX: number,
    tileY: number,
    neighbors: NeighborFlags,
  ): void {
    const detailY = y - style.height + 22;

    if (style.detail === 'door') {
      if (neighbors.south && neighbors.east) return;
      graphics.fillStyle(0x3a2510, 1);
      graphics.fillRect(x - 5, y - style.height + 25, 10, 20);
      graphics.fillStyle(0xda9a40, 1);
      graphics.fillRect(x + 2, y - style.height + 34, 2, 2);
      return;
    }

    if (style.detail === 'whitewash' && (tileX + tileY) % 3 === 0 && (!neighbors.south || !neighbors.east)) {
      graphics.fillStyle(0x1a1a25, 0.9);
      graphics.fillRect(x + 8, detailY, 6, 8);
      graphics.fillStyle(0xeae5e0, 0.45);
      graphics.fillRect(x + 9, detailY + 1, 2, 2);
      return;
    }

    if (roofStyle.detail === 'roof') {
      graphics.lineStyle(1, 0x6a2a10, 0.65);
      for (let offset = -20; offset <= 20; offset += 8) {
        graphics.lineBetween(x + offset, y - style.height - 9, x + offset + 12, y - style.height + 3);
      }
      return;
    }

    if (roofStyle.detail === 'thatch') {
      graphics.lineStyle(1, 0x3a3518, 0.6);
      for (let offset = -24; offset <= 24; offset += 6) {
        graphics.lineBetween(x + offset, y - style.height - 7, x + offset + 8, y - style.height + 8);
      }
      return;
    }

    if (style.detail === 'stone' && (tileX + tileY) % 2 === 0) {
      graphics.lineStyle(1, 0x2a2520, 0.5);
      graphics.lineBetween(x - 18, detailY, x - 2, detailY + 8);
      graphics.lineBetween(x + 4, detailY + 5, x + 20, detailY - 3);
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

  /** Get the visual walls layer. Physics collision is authored separately. */
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

  update(playerX: number, playerY: number): void {
    this.buildingComponents.forEach((comp) => {
      // Cohesive fading: check if player is behind ANY tile in the component
      const isBehind = comp.tiles.some((tile) => {
        const dx = playerX - tile.worldX;
        const dy = playerY - tile.worldY;
        return dy < 16 && dy > -tile.height - 20 && Math.abs(dx) < 48;
      });

      const targetAlpha = isBehind ? 0.35 : 1.0;
      comp.graphicsList.forEach((gfx) => {
        gfx.setAlpha(targetAlpha);
      });
    });
  }

  destroy(): void {
    this.objectSprites.forEach((sprite) => sprite.destroy());
    this.objectSprites = [];
    this.buildingComponents = [];
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
