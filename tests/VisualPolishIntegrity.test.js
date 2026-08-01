import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { loadLocationsScreenSpace } from './helpers/locations.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RUA_DIREITA_MAP = path.join(__dirname, '..', 'assets', 'maps', 'rua-direita-iso.json');
const A_FAMOSA_MAP = path.join(__dirname, '..', 'assets', 'maps', 'a-famosa-gate-iso.json');
const ST_PAULS_MAP = path.join(__dirname, '..', 'assets', 'maps', 'st-pauls-church-iso.json');
const WATERFRONT_MAP = path.join(__dirname, '..', 'assets', 'maps', 'waterfront-iso.json');
const KAMPUNG_MAP = path.join(__dirname, '..', 'assets', 'maps', 'kampung-iso.json');
const ENVIRONMENT_OBJECTS = path.join(__dirname, '..', 'src', 'data', 'environment-objects.json');
const HISTORICAL_OBJECTS = path.join(__dirname, '..', 'src', 'data', 'historical-objects.json');
const NPCS_FILE = path.join(__dirname, '..', 'src', 'data', 'npcs.json');
const INVENTORY_STORE_FILE = path.join(__dirname, '..', 'src', 'stores', 'inventoryStore.ts');
const PORTRAITS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'portraits');
const ITEM_ICONS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'ui', 'items');
const RUNTIME_ASSET_MANIFEST = path.join(__dirname, '..', 'src', 'data', 'runtime-asset-manifest.json');
const CHARACTER_SHEETS_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'characters');
const CROWD_SPRITES_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'crowd');
const GAME_SCENE_FILE = path.join(__dirname, '..', 'src', 'phaser', 'scenes', 'GameScene.ts');
const ISOMETRIC_RENDERER_FILE = path.join(__dirname, '..', 'src', 'phaser', 'systems', 'IsometricRenderer.ts');
const TITLE_SCREEN_FILE = path.join(__dirname, '..', 'src', 'components', 'screens', 'TitleScreen.tsx');
const LOADING_SCREEN_FILE = path.join(__dirname, '..', 'src', 'components', 'screens', 'LoadingScreen.tsx');
const STYLE_MAP_PATH = path.join(__dirname, '..', 'docs', 'art-bible', 'shipping-asset-style-map.json');
const SCENES_DIR = path.join(__dirname, '..', 'assets', 'scenes');
const ISO_MAPS = [RUA_DIREITA_MAP, A_FAMOSA_MAP, ST_PAULS_MAP, WATERFRONT_MAP, KAMPUNG_MAP];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
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

function getUsedTilesetNames(map) {
  const used = new Set();
  const tilesets = [...(map.tilesets || [])].sort((a, b) => a.firstgid - b.firstgid);

  (map.layers || []).forEach((layer) => {
    if (!Array.isArray(layer.data)) return;

    layer.data.forEach((gid) => {
      if (!gid) return;
      const tileset = tilesets.reduce((match, candidate) => (
        gid >= candidate.firstgid ? candidate : match
      ), null);
      if (tileset) used.add(tileset.name);
    });
  });

  return [...used].sort();
}

describe('Visual polish integrity', () => {
  test('sourced menu and loading backdrops are visible and tracked', () => {
    const titleSource = fs.readFileSync(TITLE_SCREEN_FILE, 'utf8');
    const loadingSource = fs.readFileSync(LOADING_SCREEN_FILE, 'utf8');
    const styleMap = loadJson(STYLE_MAP_PATH);
    const scenes = styleMap.assets?.scenes || {};
    const failures = [];

    [
      {
        id: 'opening-screen',
        fileName: 'opening-screen.png',
        componentSource: titleSource,
        runtimeUrl: 'scenes/opening-screen.png',
      },
      {
        id: 'scene-loading-ribeira',
        fileName: 'scene-loading-ribeira.png',
        componentSource: loadingSource,
        runtimeUrl: 'scenes/scene-loading-ribeira.png',
      },
    ].forEach(({ id, fileName, componentSource, runtimeUrl }) => {
      const assetPath = path.join(SCENES_DIR, fileName);
      if (!fs.existsSync(assetPath)) {
        failures.push(`${fileName} is missing from assets/scenes`);
      }
      if (!componentSource.includes(runtimeUrl)) {
        failures.push(`${id} is not referenced by its React screen`);
      }
      if (componentSource.includes(`/${runtimeUrl}`)) {
        failures.push(`${id} uses an absolute scene URL that can break in packaged builds`);
      }
      if (scenes[id]?.runtimePath !== `assets/scenes/${fileName}`) {
        failures.push(`${id} is missing or incorrectly tracked in the style map`);
      }
    });

    expect(failures).toEqual([]);
  });

  test('isometric movement keeps visual wall art out of physics collision', () => {
    const rendererSource = fs.readFileSync(ISOMETRIC_RENDERER_FILE, 'utf8');
    const gameSceneSource = fs.readFileSync(GAME_SCENE_FILE, 'utf8');
    const failures = [];

    ISO_MAPS.forEach((mapPath) => {
      const map = loadJson(mapPath);
      const groundLayer = map.layers.find((layer) => layer.name === 'Ground');
      const groundTileCount = (groundLayer?.data || []).filter(Boolean).length;
      const expectedTileCount = map.width * map.height;
      if (groundTileCount !== expectedTileCount) {
        failures.push(`${path.basename(mapPath)} Ground has ${groundTileCount}/${expectedTileCount} tiles`);
      }
    });

    if (rendererSource.includes('setCollisionByExclusion')) {
      failures.push('IsometricRenderer still makes visual wall tiles collide directly');
    }
    if (gameSceneSource.includes('physics.add.collider(this.player, wallsLayer)')) {
      failures.push('GameScene still attaches the player directly to the visual Walls layer');
    }
    if (rendererSource.includes('getBlockingFootprints')) {
      failures.push('IsometricRenderer still exposes footprint blockers from visual wall tiles');
    }
    if (gameSceneSource.includes('createIsometricCollisionFootprints')) {
      failures.push('GameScene still creates invisible isometric footprint colliders');
    }

    expect(failures).toEqual([]);
  });

  test('building tiles render as connected architecture, not concrete box grids', () => {
    const rendererSource = fs.readFileSync(ISOMETRIC_RENDERER_FILE, 'utf8');
    const requiredBuildingTiles = [
      'wall-white',
      'roof-terracotta',
      'door-wood',
      'laterite-stone',
      'church-stone',
      'thatch-roof',
    ];
    const failures = [];

    if (!rendererSource.includes('createRaisedBuildingTiles')) {
      failures.push('IsometricRenderer does not create raised building geometry');
    }
    if (!rendererSource.includes('collectBuildingComponents')) {
      failures.push('IsometricRenderer does not group adjacent building tiles into footprints');
    }
    if (!rendererSource.includes('getComponentNeighbors')) {
      failures.push('IsometricRenderer does not skip internal building faces');
    }
    if (!rendererSource.includes('roofStyle')) {
      failures.push('IsometricRenderer does not treat roof materials separately from facade materials');
    }
    if (!rendererSource.includes('removeTileAt')) {
      failures.push('flat building tiles are not removed after extrusion');
    }
    requiredBuildingTiles.forEach((tileName) => {
      if (!rendererSource.includes(`'${tileName}'`)) {
        failures.push(`${tileName} is not covered by raised building rendering`);
      }
    });

    expect(failures).toEqual([]);
  });

  test('isometric map tiles are loaded and mapped before rendering', () => {
    const manifest = loadJson(RUNTIME_ASSET_MANIFEST);
    const registeredIsoTiles = new Set(manifest.tiles?.isometric || []);
    const gameSceneSource = fs.readFileSync(GAME_SCENE_FILE, 'utf8');
    const failures = [];

    ISO_MAPS.forEach((mapPath) => {
      const map = loadJson(mapPath);
      getUsedTilesetNames(map).forEach((tilesetName) => {
        const assetPath = path.join(
          __dirname,
          '..',
          'assets',
          'sprites',
          'tiles',
          'iso',
          `${tilesetName}-iso.png`
        );

        if (!registeredIsoTiles.has(tilesetName)) {
          failures.push(`${path.basename(mapPath)} uses unregistered iso tile ${tilesetName}`);
        }
        if (!fs.existsSync(assetPath)) {
          failures.push(`${tilesetName} is registered by map but missing ${path.relative(process.cwd(), assetPath)}`);
        }
        if (!gameSceneSource.includes(`name: '${tilesetName}'`)) {
          failures.push(`${tilesetName} is missing from GameScene tilesetMappings`);
        }
      });
    });

    expect(failures).toEqual([]);
  });

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
    const locations = loadLocationsScreenSpace();

    // The shipping world is a single 960x540 legacy-backdrop plate. Lore-object
    // POSITIONS now live in src/data/locations/<id>.location.json (native px,
    // scaled here into screen space); historical-objects.json owns the prose.
    // These thresholds assert lore objects still reach the right half and lower
    // band of the actual screen rather than clustering in the middle.
    const farRightX = 700;
    const farBottomY = 400;

    const expectations = {
      'rua-direita': {
        requiredClusters: ['market-frontage', 'merchant-corridor', 'civic-crossing', 'dock-funnel'],
        minClusters: 9,
        farRightX,
      },
      waterfront: {
        requiredClusters: ['guild-frontage', 'customs-lane', 'jetty-chokepoint', 'east-pier-payoff'],
        minClusters: 8,
        farRightX,
      },
      kampung: {
        requiredClusters: ['stilt-courtyard', 'herbal-verandah', 'surau-edge', 'river-mouth-landing'],
        minClusters: 9,
        farRightX,
      },
      'a-famosa-gate': {
        requiredClusters: ['artillery-yard', 'banner-wall', 'gate-machinery', 'east-gate-handoff'],
        minClusters: 8,
        farRightX,
      },
      'st-pauls-church': {
        requiredClusters: ['forecourt-steps', 'devotional-side-garden', 'padres-work-edge', 'lower-path-markers'],
        minClusters: 8,
        farRightX,
        farBottomY,
      },
    };

    Object.entries(expectations).forEach(([locationId, config]) => {
      const locationClusters = environment.locations[locationId].clusters.map((cluster) => cluster.id);
      expect(locationClusters).toEqual(expect.arrayContaining(config.requiredClusters));
      expect(locationClusters.length).toBeGreaterThanOrEqual(config.minClusters);

      const locationObjects = locations[locationId].loreObjects;
      const farRightObject = locationObjects.some((obj) => obj.x >= config.farRightX);
      expect(farRightObject).toBe(true);
      if (config.farBottomY) {
        const farBottomObject = locationObjects.some((obj) => obj.y >= config.farBottomY);
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

    // NPCs whose portrait art is still owed. They must NOT alias another
    // character's face in the meantime (the UI falls back to a neutral wax
    // seal instead). Remove entries here as the art lands.
    const PENDING_PORTRAIT_ART = ['rudra-mudaliar'];

    const missingPortraitAssets = Object.values(npcs)
      .filter((npc) => npc.dialogue)
      .map((npc) => npc.id)
      .filter((id) => !portraitFiles.has(id) && !PENDING_PORTRAIT_ART.includes(id));

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

  test('crowd sprites use named-character pixel density for readable period costume', () => {
    const manifest = loadJson(RUNTIME_ASSET_MANIFEST);
    const failures = [];

    (manifest.crowd?.sprites || []).forEach((crowdId) => {
      const filePath = path.join(CROWD_SPRITES_DIR, `${crowdId}.png`);
      if (!fs.existsSync(filePath)) {
        failures.push(`${crowdId} is missing`);
        return;
      }

      const size = readPngSize(filePath);
      if (
        size.width !== manifest.crowd.frameWidth
        || size.height !== manifest.crowd.frameHeight
      ) {
        failures.push(`${crowdId} is ${size.width}x${size.height}, expected ${manifest.crowd.frameWidth}x${manifest.crowd.frameHeight}`);
      }
    });

    expect(manifest.crowd.frameWidth).toBe(16);
    expect(manifest.crowd.frameHeight).toBe(32);
    expect(failures).toEqual([]);
  });

  test('player-facing item icons stay complete and world-item ids stay valid', () => {
    const itemDefinitionIds = extractItemDefinitionIds();
    const iconFiles = new Set(
      fs.readdirSync(ITEM_ICONS_DIR)
        .filter((file) => file.endsWith('.png'))
        .map((file) => file.replace(/\.png$/, ''))
    );
    const worldItems = Object.fromEntries(
      Object.entries(loadLocationsScreenSpace()).map(([id, loc]) => [id, loc.items])
    );

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

  test('style map covers all assets referenced by the runtime manifest', () => {
    if (!fs.existsSync(STYLE_MAP_PATH)) return;

    const manifest = loadJson(RUNTIME_ASSET_MANIFEST);
    const styleMap = loadJson(STYLE_MAP_PATH);
    const assets = styleMap.assets || {};

    const unmapped = [];

    (manifest.characters?.named || []).forEach((id) => {
      if (!assets.characters?.[id]) unmapped.push(`characters/${id}`);
    });
    (manifest.crowd?.sprites || []).forEach((id) => {
      if (!assets.crowd?.[id]) unmapped.push(`crowd/${id}`);
    });
    (manifest.tiles?.base || []).forEach((id) => {
      if (!assets.tiles?.base?.[id]) unmapped.push(`tiles.base/${id}`);
    });
    (manifest.tiles?.isometric || []).forEach((id) => {
      if (!assets.tiles?.isometric?.[id]) unmapped.push(`tiles.isometric/${id}`);
    });
    (manifest.objects?.static || []).forEach((id) => {
      if (!assets.objects?.static?.[id]) unmapped.push(`objects.static/${id}`);
    });
    (manifest.objects?.animatedSheets || []).forEach((id) => {
      if (!assets.objects?.animatedSheets?.[id]) unmapped.push(`objects.animatedSheets/${id}`);
    });

    expect(unmapped).toEqual([]);
  });

  test('map layers meet style framework density requirements', () => {
    const SPEC_PATH = path.join(__dirname, '..', 'docs', 'art-bible', 'gameplay-asset-spec.json');
    const spec = loadJson(SPEC_PATH);
    const densityReqs = spec.densityRequirements;
    if (!densityReqs) return;

    const maps = [
      { path: RUA_DIREITA_MAP, name: 'rua-direita' },
      { path: A_FAMOSA_MAP, name: 'a-famosa-gate' },
      { path: ST_PAULS_MAP, name: 'st-pauls-church' },
      { path: WATERFRONT_MAP, name: 'waterfront' },
      { path: KAMPUNG_MAP, name: 'kampung' },
    ];

    const failures = [];

    maps.forEach(({ path: mapPath, name }) => {
      const map = loadJson(mapPath);
      const layers = new Map(map.layers.map((l) => [l.name, l]));

      Object.entries(densityReqs.minObjectsPerLayer).forEach(([layerName, minCount]) => {
        const layer = layers.get(layerName);
        if (!layer) return;
        const count = (layer.objects || []).length;
        if (count < minCount) {
          failures.push({ location: name, layer: layerName, count, required: minCount });
        }
      });
    });

    expect(failures).toEqual([]);
  });
});
