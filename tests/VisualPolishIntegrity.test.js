const fs = require('fs');
const path = require('path');

const RUA_DIREITA_MAP = path.join(__dirname, '..', 'assets', 'maps', 'rua-direita-iso.json');
const A_FAMOSA_MAP = path.join(__dirname, '..', 'assets', 'maps', 'a-famosa-gate-iso.json');
const ST_PAULS_MAP = path.join(__dirname, '..', 'assets', 'maps', 'st-pauls-church-iso.json');
const WATERFRONT_MAP = path.join(__dirname, '..', 'assets', 'maps', 'waterfront-iso.json');
const KAMPUNG_MAP = path.join(__dirname, '..', 'assets', 'maps', 'kampung-iso.json');
const ENVIRONMENT_OBJECTS = path.join(__dirname, '..', 'src', 'data', 'environment-objects.json');
const HISTORICAL_OBJECTS = path.join(__dirname, '..', 'src', 'data', 'historical-objects.json');
const NPCS_FILE = path.join(__dirname, '..', 'src', 'data', 'npcs.json');
const INVENTORY_STORE_FILE = path.join(__dirname, '..', 'src', 'stores', 'inventoryStore.ts');
const WORLD_ITEMS_FILE = path.join(__dirname, '..', 'src', 'data', 'items.json');
const PORTRAITS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'portraits');
const ITEM_ICONS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'ui', 'items');
const RUNTIME_ASSET_MANIFEST = path.join(__dirname, '..', 'src', 'data', 'runtime-asset-manifest.json');
const CHARACTER_SHEETS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'characters');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractItemDefinitionIds() {
  const source = fs.readFileSync(INVENTORY_STORE_FILE, 'utf8');
  return [...source.matchAll(/^\s+'([a-z0-9-]+)':\s*\{/gm)].map((match) => match[1]);
}

function expectRichLiveMap(mapPath, minFarRightX) {
  const map = loadJson(mapPath);
  const layers = new Map(map.layers.map((layer) => [layer.name, layer]));
  const requiredLayers = ['Props', 'Overhang', 'Canopy', 'Highlights'];

  requiredLayers.forEach((layerName) => {
    expect(layers.has(layerName)).toBe(true);
    expect(layers.get(layerName).type).toBe('objectgroup');
    expect((layers.get(layerName).objects || []).length).toBeGreaterThan(0);
  });

  const authoredObjects = requiredLayers.flatMap((layerName) => layers.get(layerName).objects || []);
  const maxX = Math.max(...authoredObjects.map((obj) => obj.x || 0));

  expect(maxX).toBeGreaterThanOrEqual(minFarRightX);
}

describe('Visual polish integrity', () => {
  test('Rua Direita keeps its richer live isometric layering and right-side detail', () => {
    expectRichLiveMap(RUA_DIREITA_MAP, 1900);
  });

  test('Waterfront and Kampung keep the richer live layer contract beyond Rua Direita', () => {
    expectRichLiveMap(WATERFRONT_MAP, 1800);
    expectRichLiveMap(KAMPUNG_MAP, 1800);
  });

  test('A Famosa and St. Paul’s keep the richer live layer contract too', () => {
    expectRichLiveMap(A_FAMOSA_MAP, 1800);
    expectRichLiveMap(ST_PAULS_MAP, 1100);
  });

  test('hero slices keep their added Melaka-era environment clusters and hotspot spread', () => {
    const environment = loadJson(ENVIRONMENT_OBJECTS);
    const historical = loadJson(HISTORICAL_OBJECTS);

    const expectations = {
      'rua-direita': {
        requiredClusters: ['market-frontage', 'merchant-corridor', 'civic-crossing', 'dock-funnel'],
        minClusters: 9,
        farRightX: 1200,
      },
      waterfront: {
        requiredClusters: ['guild-frontage', 'customs-lane', 'jetty-chokepoint', 'east-pier-payoff'],
        minClusters: 8,
        farRightX: 1100,
      },
      kampung: {
        requiredClusters: ['stilt-courtyard', 'herbal-verandah', 'surau-edge', 'river-mouth-landing'],
        minClusters: 9,
        farRightX: 900,
      },
      'a-famosa-gate': {
        requiredClusters: ['artillery-yard', 'banner-wall', 'gate-machinery', 'east-gate-handoff'],
        minClusters: 8,
        farRightX: 1500,
      },
      'st-pauls-church': {
        requiredClusters: ['forecourt-steps', 'devotional-side-garden', 'padres-work-edge', 'lower-path-markers'],
        minClusters: 8,
        farRightX: 900,
        farBottomY: 620,
      },
    };

    Object.entries(expectations).forEach(([locationId, config]) => {
      const locationClusters = environment.locations[locationId].clusters.map((cluster) => cluster.id);
      expect(locationClusters).toEqual(expect.arrayContaining(config.requiredClusters));
      expect(locationClusters.length).toBeGreaterThanOrEqual(config.minClusters);

      const locationObjects = Object.values(historical.objects)
        .filter((obj) => obj.location === locationId);
      const farRightObject = locationObjects.some((obj) => (obj.position?.x || 0) >= config.farRightX);
      expect(farRightObject).toBe(true);
      if (config.farBottomY) {
        const farBottomObject = locationObjects.some((obj) => (obj.position?.y || 0) >= config.farBottomY);
        expect(farBottomObject).toBe(true);
      }
    });
  });

  test('named dialogue NPCs keep unique portrait assets instead of aliases', () => {
    const npcs = loadJson(NPCS_FILE);
    const portraitFiles = new Set(
      fs.readdirSync(PORTRAITS_DIR)
        .filter((file) => file.endsWith('.png'))
        .map((file) => file.replace(/\.png$/, ''))
    );

    const missingPortraitAssets = Object.values(npcs)
      .filter((npc) => npc.dialogue)
      .map((npc) => npc.id)
      .filter((id) => !portraitFiles.has(id));

    const aliasPortraits = Object.values(npcs)
      .filter((npc) => npc.dialogue && npc.portrait && npc.portrait !== npc.id)
      .map((npc) => ({
        id: npc.id,
        portrait: npc.portrait,
      }));

    expect(missingPortraitAssets).toEqual([]);
    expect(aliasPortraits).toEqual([]);
  });

  test('named cast gameplay sheets stay present for the live runtime', () => {
    const manifest = loadJson(RUNTIME_ASSET_MANIFEST);
    const missingSheets = manifest.characters.named.filter((characterId) => {
      const filePath = path.join(CHARACTER_SHEETS_DIR, `${characterId}-sheet.png`);
      return !fs.existsSync(filePath);
    });

    expect(missingSheets).toEqual([]);
  });

  test('player-facing item icons stay complete and world-item ids stay valid', () => {
    const itemDefinitionIds = extractItemDefinitionIds();
    const iconFiles = new Set(
      fs.readdirSync(ITEM_ICONS_DIR)
        .filter((file) => file.endsWith('.png'))
        .map((file) => file.replace(/\.png$/, ''))
    );
    const worldItems = loadJson(WORLD_ITEMS_FILE)['world-items'];

    expect(itemDefinitionIds.length).toBeGreaterThanOrEqual(20);

    const missingIcons = itemDefinitionIds.filter((itemId) => !iconFiles.has(itemId));
    const invalidWorldItems = Object.entries(worldItems).flatMap(([locationId, entries]) =>
      entries
        .filter((entry) => !itemDefinitionIds.includes(entry.itemId))
        .map((entry) => ({ locationId, itemId: entry.itemId }))
    );

    expect(missingIcons).toEqual([]);
    expect(invalidWorldItems).toEqual([]);
  });
});
