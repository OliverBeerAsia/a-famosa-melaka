/**
 * Map Enhancement Tool
 * 
 * Creates more detailed Tiled JSON maps for all 5 demo locations.
 * Each map features:
 * - Larger size (40x30 tiles = 640x480 pixels)
 * - Detailed architecture and landscaping
 * - Multiple object layers
 * - Proper collision setup
 * 
 * Run: node tools/enhance-maps.js
 */

const fs = require('fs');
const path = require('path');

const mapsDir = path.join(__dirname, '..', 'assets', 'maps');

// Tile IDs for tilesets
const TILES = {
  // Ground tiles
  GRASS: 1,
  COBBLESTONE: 2,
  FORTRESS_STONE: 3,
  DIRT_PATH: 4,
  DOCK_WOOD: 5,
  CHURCH_FLOOR: 6,
  BAMBOO_FLOOR: 7,
  WATER: 8,
  
  // Wall tiles
  WALL_WHITE: 10,
  WALL_STONE: 11,
  ROOF_TERRACOTTA: 12,
  THATCH_ROOF: 13,
  DOOR_WOOD: 14
};

// Common tileset definitions
function getTilesets(tilesetNames) {
  const allTilesets = {
    'fortress-stone': {
      columns: 1, firstgid: 1,
      image: '../sprites/tiles/fortress-stone.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'fortress-stone', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    },
    'grass': {
      columns: 1, firstgid: 2,
      image: '../sprites/tiles/grass.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'grass', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    },
    'cobblestone': {
      columns: 1, firstgid: 3,
      image: '../sprites/tiles/cobblestone.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'cobblestone', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    },
    'wall-white': {
      columns: 1, firstgid: 4,
      image: '../sprites/tiles/wall-white.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'wall-white', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16,
      tiles: [{ id: 0, properties: [{ name: 'collides', type: 'bool', value: true }] }]
    },
    'roof-terracotta': {
      columns: 1, firstgid: 5,
      image: '../sprites/tiles/roof-terracotta.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'roof-terracotta', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    },
    'door-wood': {
      columns: 1, firstgid: 6,
      image: '../sprites/tiles/door-wood.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'door-wood', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    },
    'water-tile': {
      columns: 1, firstgid: 7,
      image: '../sprites/tiles/water-tile.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'water-tile', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16,
      tiles: [{ id: 0, properties: [{ name: 'collides', type: 'bool', value: true }] }]
    },
    'dock-wood': {
      columns: 1, firstgid: 8,
      image: '../sprites/tiles/dock-wood.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'dock-wood', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    },
    'church-stone': {
      columns: 1, firstgid: 9,
      image: '../sprites/tiles/church-stone.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'church-stone', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16,
      tiles: [{ id: 0, properties: [{ name: 'collides', type: 'bool', value: true }] }]
    },
    'church-floor': {
      columns: 1, firstgid: 10,
      image: '../sprites/tiles/church-floor.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'church-floor', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    },
    'dirt-path': {
      columns: 1, firstgid: 11,
      image: '../sprites/tiles/dirt-path.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'dirt-path', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    },
    'bamboo-floor': {
      columns: 1, firstgid: 12,
      image: '../sprites/tiles/bamboo-floor.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'bamboo-floor', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    },
    'thatch-roof': {
      columns: 1, firstgid: 13,
      image: '../sprites/tiles/thatch-roof.png',
      imageheight: 16, imagewidth: 16,
      margin: 0, name: 'thatch-roof', spacing: 0,
      tilecount: 1, tileheight: 16, tilewidth: 16
    }
  };
  
  return tilesetNames.map(name => allTilesets[name]).filter(Boolean);
}

// Helper to fill a rectangular area in a tile layer
function fillRect(data, mapWidth, x, y, w, h, tileId) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const idx = (y + dy) * mapWidth + (x + dx);
      if (idx >= 0 && idx < data.length) {
        data[idx] = tileId;
      }
    }
  }
}

// Create object entry
function createObject(id, name, x, y, width, height, gid) {
  return {
    gid,
    height,
    id,
    name,
    rotation: 0,
    visible: true,
    width,
    x,
    y: y + height // Tiled uses bottom-left origin for objects
  };
}

// Generate A Famosa Gate map
function generateAFamosaGate() {
  const width = 40;
  const height = 30;
  const mapWidth = width;
  
  // Initialize layers
  const ground = new Array(width * height).fill(2); // Grass
  const walls = new Array(width * height).fill(0);
  const objects = [];
  let objectId = 1;
  
  // Cobblestone road leading to gate
  fillRect(ground, mapWidth, 15, 0, 10, 30, 3);
  
  // Fortress walls (massive grey stone)
  // Left wall
  fillRect(walls, mapWidth, 0, 8, 16, 3, 1);
  fillRect(walls, mapWidth, 0, 8, 3, 14, 1);
  
  // Right wall  
  fillRect(walls, mapWidth, 24, 8, 16, 3, 1);
  fillRect(walls, mapWidth, 37, 8, 3, 14, 1);
  
  // Gate structure
  fillRect(walls, mapWidth, 15, 8, 10, 4, 1);
  // Gate opening (no wall)
  fillRect(walls, mapWidth, 18, 10, 4, 2, 0);
  
  // Crenellations on top
  for (let x = 0; x < 40; x += 2) {
    if (x < 15 || x >= 25) {
      fillRect(walls, mapWidth, x, 7, 1, 1, 1);
    }
  }
  
  // Add decorative objects
  // Palm trees
  objects.push(createObject(objectId++, 'palm-tree', 48, 128, 16, 32, 20));
  objects.push(createObject(objectId++, 'palm-tree', 576, 128, 16, 32, 20));
  objects.push(createObject(objectId++, 'palm-tree', 32, 368, 16, 32, 20));
  objects.push(createObject(objectId++, 'palm-tree', 592, 368, 16, 32, 20));
  
  // Barrels and crates near gate
  objects.push(createObject(objectId++, 'barrel', 224, 200, 16, 16, 21));
  objects.push(createObject(objectId++, 'barrel', 400, 200, 16, 16, 21));
  objects.push(createObject(objectId++, 'crate', 240, 200, 16, 16, 22));
  objects.push(createObject(objectId++, 'crate', 384, 200, 16, 16, 22));
  
  // Pottery and decoration
  objects.push(createObject(objectId++, 'pottery', 64, 256, 16, 16, 23));
  objects.push(createObject(objectId++, 'pottery', 560, 256, 16, 16, 23));
  
  // Flowers/bushes
  objects.push(createObject(objectId++, 'bush', 80, 160, 16, 16, 24));
  objects.push(createObject(objectId++, 'bush', 544, 160, 16, 16, 24));
  objects.push(createObject(objectId++, 'flowers', 96, 320, 16, 16, 25));
  objects.push(createObject(objectId++, 'flowers', 528, 320, 16, 16, 25));
  
  return createMapJSON('a-famosa-gate', width, height, ground, walls, objects,
    ['fortress-stone', 'grass', 'cobblestone', 'wall-white']);
}

// Generate Rua Direita (Market) map
function generateRuaDireita() {
  const width = 40;
  const height = 30;
  const mapWidth = width;
  
  const ground = new Array(width * height).fill(2); // Grass border
  const walls = new Array(width * height).fill(0);
  const objects = [];
  let objectId = 1;
  
  // Main cobblestone street
  fillRect(ground, mapWidth, 3, 0, 34, 30, 3);
  
  // Buildings on left side
  fillRect(walls, mapWidth, 0, 4, 10, 8, 4);  // Building 1
  fillRect(walls, mapWidth, 0, 16, 10, 8, 4); // Building 2
  
  // Buildings on right side
  fillRect(walls, mapWidth, 30, 4, 10, 8, 4);  // Building 3
  fillRect(walls, mapWidth, 30, 16, 10, 8, 4); // Building 4
  
  // Roof tiles on buildings
  fillRect(walls, mapWidth, 0, 3, 10, 1, 5);
  fillRect(walls, mapWidth, 0, 15, 10, 1, 5);
  fillRect(walls, mapWidth, 30, 3, 10, 1, 5);
  fillRect(walls, mapWidth, 30, 15, 10, 1, 5);
  
  // Doors
  fillRect(walls, mapWidth, 7, 11, 2, 1, 6);
  fillRect(walls, mapWidth, 7, 23, 2, 1, 6);
  fillRect(walls, mapWidth, 31, 11, 2, 1, 6);
  fillRect(walls, mapWidth, 31, 23, 2, 1, 6);
  
  // Market stalls in the middle
  objects.push(createObject(objectId++, 'market-stall-1', 176, 128, 16, 24, 30));
  objects.push(createObject(objectId++, 'market-stall-2', 208, 128, 16, 24, 31));
  objects.push(createObject(objectId++, 'market-stall-1', 240, 128, 16, 24, 30));
  objects.push(createObject(objectId++, 'market-stall-2', 272, 128, 16, 24, 31));
  
  objects.push(createObject(objectId++, 'market-stall-1', 176, 320, 16, 24, 30));
  objects.push(createObject(objectId++, 'market-stall-2', 208, 320, 16, 24, 31));
  objects.push(createObject(objectId++, 'market-stall-1', 240, 320, 16, 24, 30));
  objects.push(createObject(objectId++, 'market-stall-2', 272, 320, 16, 24, 31));
  
  // Spice piles
  objects.push(createObject(objectId++, 'spice-pile', 192, 160, 16, 16, 32));
  objects.push(createObject(objectId++, 'spice-pile', 256, 160, 16, 16, 32));
  objects.push(createObject(objectId++, 'spice-pile', 192, 352, 16, 16, 32));
  
  // Barrels and sacks
  objects.push(createObject(objectId++, 'barrel', 128, 192, 16, 16, 21));
  objects.push(createObject(objectId++, 'sack', 144, 192, 16, 16, 33));
  objects.push(createObject(objectId++, 'barrel', 352, 192, 16, 16, 21));
  objects.push(createObject(objectId++, 'amphora', 368, 192, 16, 16, 34));
  
  // Lanterns
  objects.push(createObject(objectId++, 'lantern', 160, 100, 8, 16, 35));
  objects.push(createObject(objectId++, 'lantern', 288, 100, 8, 16, 35));
  objects.push(createObject(objectId++, 'lantern', 160, 290, 8, 16, 35));
  objects.push(createObject(objectId++, 'lantern', 288, 290, 8, 16, 35));
  
  // Tavern sign
  objects.push(createObject(objectId++, 'tavern-sign', 16, 80, 16, 16, 36));
  
  // Palm trees at corners
  objects.push(createObject(objectId++, 'palm-tree', 16, 432, 16, 32, 20));
  objects.push(createObject(objectId++, 'palm-tree', 608, 432, 16, 32, 20));
  
  return createMapJSON('rua-direita', width, height, ground, walls, objects,
    ['fortress-stone', 'grass', 'cobblestone', 'wall-white', 'roof-terracotta', 'door-wood']);
}

// Generate St. Paul's Church map
function generateStPaulsChurch() {
  const width = 40;
  const height = 30;
  const mapWidth = width;
  
  const ground = new Array(width * height).fill(2); // Grass
  const walls = new Array(width * height).fill(0);
  const objects = [];
  let objectId = 1;
  
  // Stone floor plaza
  fillRect(ground, mapWidth, 10, 5, 20, 20, 10);
  
  // Stone path leading up
  fillRect(ground, mapWidth, 17, 24, 6, 6, 10);
  
  // Church building
  fillRect(walls, mapWidth, 12, 6, 16, 10, 9);
  
  // Church entrance (opening)
  fillRect(walls, mapWidth, 18, 15, 4, 1, 0);
  
  // Bell tower
  fillRect(walls, mapWidth, 14, 2, 4, 5, 9);
  
  // Gravestones area
  objects.push(createObject(objectId++, 'gravestone', 80, 280, 16, 16, 40));
  objects.push(createObject(objectId++, 'gravestone', 112, 300, 16, 16, 40));
  objects.push(createObject(objectId++, 'gravestone', 80, 320, 16, 16, 40));
  objects.push(createObject(objectId++, 'gravestone', 528, 280, 16, 16, 40));
  objects.push(createObject(objectId++, 'gravestone', 560, 300, 16, 16, 40));
  objects.push(createObject(objectId++, 'gravestone', 528, 320, 16, 16, 40));
  
  // Stone cross at top of church
  objects.push(createObject(objectId++, 'stone-cross', 256, 32, 16, 32, 41));
  
  // Bell
  objects.push(createObject(objectId++, 'bell', 240, 64, 16, 16, 42));
  
  // Wooden pews inside
  objects.push(createObject(objectId++, 'wooden-pew', 224, 160, 16, 16, 43));
  objects.push(createObject(objectId++, 'wooden-pew', 256, 160, 16, 16, 43));
  objects.push(createObject(objectId++, 'wooden-pew', 224, 192, 16, 16, 43));
  objects.push(createObject(objectId++, 'wooden-pew', 256, 192, 16, 16, 43));
  
  // Altar
  objects.push(createObject(objectId++, 'altar', 240, 112, 16, 16, 44));
  
  // Arched windows
  objects.push(createObject(objectId++, 'arched-window', 192, 128, 16, 32, 45));
  objects.push(createObject(objectId++, 'arched-window', 288, 128, 16, 32, 45));
  
  // Palm trees and bushes
  objects.push(createObject(objectId++, 'palm-tree', 32, 64, 16, 32, 20));
  objects.push(createObject(objectId++, 'palm-tree', 592, 64, 16, 32, 20));
  objects.push(createObject(objectId++, 'bush', 160, 368, 16, 16, 24));
  objects.push(createObject(objectId++, 'bush', 448, 368, 16, 16, 24));
  objects.push(createObject(objectId++, 'flowers', 176, 384, 16, 16, 25));
  objects.push(createObject(objectId++, 'flowers', 432, 384, 16, 16, 25));
  
  return createMapJSON('st-pauls-church', width, height, ground, walls, objects,
    ['fortress-stone', 'grass', 'church-stone', 'church-floor']);
}

// Generate Waterfront map
function generateWaterfront() {
  const width = 40;
  const height = 30;
  const mapWidth = width;
  
  const ground = new Array(width * height).fill(7); // Water
  const walls = new Array(width * height).fill(0);
  const objects = [];
  let objectId = 1;
  
  // Dock/wharf area (bottom half is land)
  fillRect(ground, mapWidth, 0, 15, 40, 15, 8); // Dock wood
  fillRect(ground, mapWidth, 0, 20, 40, 10, 3); // Cobblestone back area
  
  // Warehouse buildings
  fillRect(walls, mapWidth, 2, 22, 8, 6, 4);
  fillRect(walls, mapWidth, 30, 22, 8, 6, 4);
  
  // Roofs
  fillRect(walls, mapWidth, 2, 21, 8, 1, 5);
  fillRect(walls, mapWidth, 30, 21, 8, 1, 5);
  
  // Dock piers extending into water
  fillRect(ground, mapWidth, 8, 10, 4, 6, 8);
  fillRect(ground, mapWidth, 20, 8, 4, 8, 8);
  fillRect(ground, mapWidth, 32, 10, 4, 6, 8);
  
  // Ship masts
  objects.push(createObject(objectId++, 'ship-mast', 160, 48, 16, 64, 50));
  objects.push(createObject(objectId++, 'ship-mast', 352, 32, 16, 64, 50));
  
  // Dhow sail
  objects.push(createObject(objectId++, 'dhow-sail', 528, 64, 32, 48, 51));
  
  // Cargo and barrels
  objects.push(createObject(objectId++, 'cargo-crate', 192, 272, 16, 16, 52));
  objects.push(createObject(objectId++, 'cargo-crate', 208, 272, 16, 16, 52));
  objects.push(createObject(objectId++, 'cargo-crate', 192, 288, 16, 16, 52));
  objects.push(createObject(objectId++, 'maritime-barrel', 384, 272, 16, 16, 53));
  objects.push(createObject(objectId++, 'maritime-barrel', 400, 272, 16, 16, 53));
  
  // Rope coils
  objects.push(createObject(objectId++, 'rope-coil', 144, 256, 16, 16, 54));
  objects.push(createObject(objectId++, 'rope-coil', 480, 256, 16, 16, 54));
  
  // Fishing nets
  objects.push(createObject(objectId++, 'fishing-net', 256, 240, 32, 16, 55));
  
  // Anchors
  objects.push(createObject(objectId++, 'anchor', 128, 208, 16, 16, 56));
  objects.push(createObject(objectId++, 'anchor', 496, 208, 16, 16, 56));
  
  // Sacks and amphoras
  objects.push(createObject(objectId++, 'sack', 320, 288, 16, 16, 33));
  objects.push(createObject(objectId++, 'amphora', 336, 288, 16, 16, 34));
  
  return createMapJSON('waterfront', width, height, ground, walls, objects,
    ['water-tile', 'dock-wood', 'cobblestone', 'wall-white', 'roof-terracotta']);
}

// Generate Kampung map
function generateKampung() {
  const width = 40;
  const height = 30;
  const mapWidth = width;
  
  const ground = new Array(width * height).fill(2); // Grass
  const walls = new Array(width * height).fill(0);
  const objects = [];
  let objectId = 1;
  
  // Dirt paths
  fillRect(ground, mapWidth, 18, 0, 4, 30, 11);  // Main path
  fillRect(ground, mapWidth, 5, 12, 30, 4, 11);  // Cross path
  
  // Traditional house platforms (bamboo floor)
  fillRect(ground, mapWidth, 4, 4, 8, 6, 12);
  fillRect(ground, mapWidth, 28, 4, 8, 6, 12);
  fillRect(ground, mapWidth, 4, 20, 8, 6, 12);
  fillRect(ground, mapWidth, 28, 20, 8, 6, 12);
  
  // Thatch roof structures (walls)
  fillRect(walls, mapWidth, 5, 4, 6, 4, 13);
  fillRect(walls, mapWidth, 29, 4, 6, 4, 13);
  fillRect(walls, mapWidth, 5, 20, 6, 4, 13);
  fillRect(walls, mapWidth, 29, 20, 6, 4, 13);
  
  // Banana trees
  objects.push(createObject(objectId++, 'banana-tree', 16, 176, 16, 32, 60));
  objects.push(createObject(objectId++, 'banana-tree', 560, 176, 16, 32, 60));
  objects.push(createObject(objectId++, 'banana-tree', 48, 384, 16, 32, 60));
  objects.push(createObject(objectId++, 'banana-tree', 576, 384, 16, 32, 60));
  
  // Palm trees
  objects.push(createObject(objectId++, 'palm-tree', 224, 64, 16, 32, 20));
  objects.push(createObject(objectId++, 'palm-tree', 384, 64, 16, 32, 20));
  
  // Water well (center of village)
  objects.push(createObject(objectId++, 'water-well', 304, 224, 16, 16, 61));
  
  // Cooking fires
  objects.push(createObject(objectId++, 'cooking-fire', 64, 144, 16, 16, 62));
  objects.push(createObject(objectId++, 'cooking-fire', 544, 144, 16, 16, 62));
  
  // Woven mats
  objects.push(createObject(objectId++, 'woven-mat', 80, 128, 16, 16, 63));
  objects.push(createObject(objectId++, 'woven-mat', 528, 128, 16, 16, 63));
  objects.push(createObject(objectId++, 'woven-mat', 80, 336, 16, 16, 63));
  objects.push(createObject(objectId++, 'woven-mat', 528, 336, 16, 16, 63));
  
  // Bamboo fences
  objects.push(createObject(objectId++, 'bamboo-fence', 192, 96, 16, 16, 64));
  objects.push(createObject(objectId++, 'bamboo-fence', 416, 96, 16, 16, 64));
  objects.push(createObject(objectId++, 'bamboo-fence', 192, 368, 16, 16, 64));
  objects.push(createObject(objectId++, 'bamboo-fence', 416, 368, 16, 16, 64));
  
  // Coconuts
  objects.push(createObject(objectId++, 'coconut', 240, 112, 16, 16, 65));
  objects.push(createObject(objectId++, 'coconut', 400, 352, 16, 16, 65));
  
  // Pottery
  objects.push(createObject(objectId++, 'pottery', 96, 160, 16, 16, 23));
  objects.push(createObject(objectId++, 'pottery', 512, 160, 16, 16, 23));
  
  // Bushes and flowers
  objects.push(createObject(objectId++, 'bush', 160, 48, 16, 16, 24));
  objects.push(createObject(objectId++, 'bush', 448, 48, 16, 16, 24));
  objects.push(createObject(objectId++, 'flowers', 176, 432, 16, 16, 25));
  objects.push(createObject(objectId++, 'flowers', 432, 432, 16, 16, 25));
  
  return createMapJSON('kampung', width, height, ground, walls, objects,
    ['grass', 'dirt-path', 'bamboo-floor', 'thatch-roof']);
}

// Create the final map JSON structure
function createMapJSON(name, width, height, groundData, wallsData, objects, tilesetNames) {
  return {
    compressionlevel: -1,
    height: height,
    infinite: false,
    layers: [
      {
        data: groundData,
        height: height,
        id: 1,
        name: 'Ground',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        width: width,
        x: 0,
        y: 0
      },
      {
        data: wallsData,
        height: height,
        id: 2,
        name: 'Walls',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        width: width,
        x: 0,
        y: 0
      },
      {
        draworder: 'topdown',
        id: 3,
        name: 'Objects',
        objects: objects,
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0
      }
    ],
    nextlayerid: 4,
    nextobjectid: objects.length + 1,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    tileheight: 16,
    tilesets: getTilesets(tilesetNames),
    tilewidth: 16,
    type: 'map',
    version: '1.10',
    width: width
  };
}

// Generate all maps
function generateAllMaps() {
  console.log('Generating enhanced maps...\n');
  
  if (!fs.existsSync(mapsDir)) {
    fs.mkdirSync(mapsDir, { recursive: true });
  }
  
  const maps = [
    { name: 'a-famosa-gate', generator: generateAFamosaGate },
    { name: 'rua-direita', generator: generateRuaDireita },
    { name: 'st-pauls-church', generator: generateStPaulsChurch },
    { name: 'waterfront', generator: generateWaterfront },
    { name: 'kampung', generator: generateKampung }
  ];
  
  maps.forEach(({ name, generator }) => {
    const mapData = generator();
    const filepath = path.join(mapsDir, `${name}.json`);
    fs.writeFileSync(filepath, JSON.stringify(mapData, null, 2));
    console.log(`  ✓ ${name}.json (${mapData.width}x${mapData.height} tiles)`);
  });
  
  console.log('\n✅ Enhanced maps generated!');
  console.log('\nMap sizes: 40x30 tiles (640x480 pixels)');
  console.log('Features: Multiple buildings, objects, and detailed landscaping');
}

generateAllMaps();

