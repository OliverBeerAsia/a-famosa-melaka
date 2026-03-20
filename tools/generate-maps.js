const fs = require('fs');
const path = require('path');

// Helper to create tile data array (40x30 = 1200 tiles)
function createTileLayer(width, height, fillTile = 0) {
  return Array(width * height).fill(fillTile);
}

// Helper to set a rectangular area of tiles
function fillRect(data, width, x, y, w, h, tileId) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (row >= 0 && row < 30 && col >= 0 && col < 40) {
        data[row * width + col] = tileId;
      }
    }
  }
}

// Base map template
function createBaseMap(name, layers) {
  return {
    compressionlevel: -1,
    height: 30,
    infinite: false,
    layers: layers,
    nextlayerid: layers.length + 1,
    nextobjectid: 1,
    orientation: "orthogonal",
    renderorder: "right-down",
    tiledversion: "1.10.2",
    tileheight: 32,
    tilesets: [
      {
        columns: 88,
        firstgid: 1,
        image: "../tilesets/Portuguese Colonial Streets tileset one.jpeg",
        imageheight: 1536,
        imagewidth: 2816,
        margin: 0,
        name: "portuguese-streets",
        spacing: 0,
        tilecount: 4224,
        tileheight: 32,
        tilewidth: 32
      },
      {
        columns: 88,
        firstgid: 4225,
        image: "../tilesets/master tileset.jpeg",
        imageheight: 1536,
        imagewidth: 2816,
        margin: 0,
        name: "master-tileset",
        spacing: 0,
        tilecount: 4224,
        tileheight: 32,
        tilewidth: 32
      }
    ],
    tilewidth: 32,
    type: "map",
    version: "1.10",
    width: 40
  };
}

// A Famosa Fortress Gate
function createAFamosaGate() {
  const ground = createTileLayer(40, 30, 2841); // Sand/dirt ground
  const walls = createTileLayer(40, 30, 0);
  const objects = createTileLayer(40, 30, 0);
  
  // Fortress stone walls (left and right)
  fillRect(walls, 40, 0, 5, 8, 20, 4401); // Left wall
  fillRect(walls, 40, 32, 5, 8, 20, 4401); // Right wall
  
  // Gate opening
  fillRect(ground, 40, 16, 12, 8, 6, 1); // Cobblestone path through gate
  
  // Top wall with gate
  fillRect(walls, 40, 8, 5, 24, 3, 4401);
  fillRect(walls, 40, 16, 7, 8, 1, 0); // Gate opening
  
  const layers = [
    { data: ground, height: 30, id: 1, name: "Ground", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 },
    { data: walls, height: 30, id: 2, name: "Walls", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 }
  ];
  
  return createBaseMap("a-famosa-gate", layers);
}

// Rua Direita - Main Market Street
function createRuaDireita() {
  const ground = createTileLayer(40, 30, 1); // Cobblestone
  const buildings = createTileLayer(40, 30, 0);
  
  // Buildings on left side
  fillRect(buildings, 40, 2, 3, 12, 10, 4450); // White wall
  fillRect(buildings, 40, 2, 2, 12, 1, 4500); // Terracotta roof
  
  // Buildings on right side  
  fillRect(buildings, 40, 26, 3, 12, 10, 4450);
  fillRect(buildings, 40, 26, 2, 12, 1, 4500);
  
  // Buildings bottom left
  fillRect(buildings, 40, 2, 17, 12, 10, 4450);
  fillRect(buildings, 40, 2, 16, 12, 1, 4500);
  
  // Buildings bottom right
  fillRect(buildings, 40, 26, 17, 12, 10, 4450);
  fillRect(buildings, 40, 26, 16, 12, 1, 4500);
  
  const layers = [
    { data: ground, height: 30, id: 1, name: "Ground", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 },
    { data: buildings, height: 30, id: 2, name: "Buildings", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 }
  ];
  
  return createBaseMap("rua-direita", layers);
}

// St. Paul's Church Hill
function createStPaulsChurch() {
  const ground = createTileLayer(40, 30, 2850); // Grass
  const church = createTileLayer(40, 30, 0);
  
  // Church building (center)
  fillRect(church, 40, 12, 8, 16, 14, 4420); // Church stone
  fillRect(church, 40, 12, 7, 16, 1, 4500); // Roof
  
  // Stone path leading up
  fillRect(ground, 40, 18, 22, 4, 8, 4395); // Stone path
  
  const layers = [
    { data: ground, height: 30, id: 1, name: "Ground", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 },
    { data: church, height: 30, id: 2, name: "Church", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 }
  ];
  
  return createBaseMap("st-pauls-church", layers);
}

// Waterfront Quay
function createWaterfront() {
  const ground = createTileLayer(40, 30, 3520); // Water
  const docks = createTileLayer(40, 30, 0);
  
  // Wooden dock platform
  fillRect(docks, 40, 0, 18, 40, 12, 200); // Wood planks
  
  // Dock posts
  for (let x = 5; x < 40; x += 5) {
    fillRect(docks, 40, x, 17, 1, 1, 210);
  }
  
  const layers = [
    { data: ground, height: 30, id: 1, name: "Water", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 },
    { data: docks, height: 30, id: 2, name: "Docks", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 }
  ];
  
  return createBaseMap("waterfront", layers);
}

// Kampung Quarter
function createKampung() {
  const ground = createTileLayer(40, 30, 2850); // Tropical grass
  const structures = createTileLayer(40, 30, 0);
  
  // Bamboo huts scattered around
  fillRect(structures, 40, 5, 5, 8, 6, 4600); // Bamboo walls
  fillRect(structures, 40, 5, 4, 8, 1, 4650); // Thatch roof
  
  fillRect(structures, 40, 20, 8, 8, 6, 4600);
  fillRect(structures, 40, 20, 7, 8, 1, 4650);
  
  fillRect(structures, 40, 10, 18, 8, 6, 4600);
  fillRect(structures, 40, 10, 17, 8, 1, 4650);
  
  fillRect(structures, 40, 27, 15, 8, 6, 4600);
  fillRect(structures, 40, 27, 14, 8, 1, 4650);
  
  // Dirt paths
  fillRect(ground, 40, 12, 10, 16, 2, 2800); // Horizontal path
  fillRect(ground, 40, 19, 5, 2, 20, 2800); // Vertical path
  
  const layers = [
    { data: ground, height: 30, id: 1, name: "Ground", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 },
    { data: structures, height: 30, id: 2, name: "Structures", opacity: 1, type: "tilelayer", visible: true, width: 40, x: 0, y: 0 }
  ];
  
  return createBaseMap("kampung", layers);
}

// Generate all maps
const maps = {
  'a-famosa-gate-v2.json': createAFamosaGate(),
  'rua-direita-v2.json': createRuaDireita(),
  'st-pauls-church-v2.json': createStPaulsChurch(),
  'waterfront-v2.json': createWaterfront(),
  'kampung-v2.json': createKampung()
};

const mapsDir = path.join(__dirname, '..', 'assets', 'maps');

Object.entries(maps).forEach(([filename, mapData]) => {
  const filepath = path.join(mapsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(mapData, null, 2));
  console.log(`Created: ${filepath}`);
});

console.log('\nAll maps generated successfully!');
console.log('Maps use 32x32 tile size and reference the new tilesets.');
