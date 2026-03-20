const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data', 'locations');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const ZONE_FILES = ['downtown.json', 'harbor.json', 'outskirts.json'].map((file) => path.join(DATA_DIR, file));
const LOCATION_SCHEMA_FILE = path.join(__dirname, '..', 'src', 'data', 'schemas', 'location-schema.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

describe('Location metadata integrity', () => {
  test('world and zone fixtures stay in sync', () => {
    const world = loadJson(WORLD_FILE);
    const worldLocations = world.locations || {};
    const zoneNames = new Set();
    const seenLocations = new Map();
    const problems = [];

    expect(Object.keys(worldLocations).length).toBeGreaterThan(0);

    ZONE_FILES.forEach((filePath) => {
      const zoneData = loadJson(filePath);
      const zoneId = path.basename(filePath, '.json');

      zoneNames.add(zoneData.zone);

      if (zoneData.zone !== zoneId) {
        problems.push(`${zoneId}: zone name mismatch (${zoneData.zone})`);
      }

      if (!Array.isArray(zoneData.locations) || zoneData.locations.length === 0) {
        problems.push(`${zoneId}: missing location list`);
        return;
      }

      zoneData.locations.forEach((locationId) => {
        const location = worldLocations[locationId];
        if (!location) {
          problems.push(`${zoneId}: unknown location ${locationId}`);
          return;
        }

        if (!isNonEmptyString(location.name)) {
          problems.push(`${locationId}: missing display name`);
        }

        if (!isNonEmptyString(location.description)) {
          problems.push(`${locationId}: missing description`);
        }

        if (!isNonEmptyString(location.mapKey)) {
          problems.push(`${locationId}: missing mapKey`);
        } else if (location.mapKey !== locationId) {
          problems.push(`${locationId}: mapKey mismatch (${location.mapKey})`);
        }

        if (seenLocations.has(locationId)) {
          problems.push(`${locationId}: listed in both ${seenLocations.get(locationId)} and ${zoneId}`);
        } else {
          seenLocations.set(locationId, zoneId);
        }
      });
    });

    expect(problems).toEqual([]);
    expect([...zoneNames].sort()).toEqual(['downtown', 'harbor', 'outskirts']);
    expect([...seenLocations.keys()].sort()).toEqual(Object.keys(worldLocations).sort());
  });

  test('location schema documents the isometric projection and audio metadata contract', () => {
    const schema = loadJson(LOCATION_SCHEMA_FILE);
    const properties = schema.properties || {};

    expect(properties).toHaveProperty('projection');
    expect(properties.projection.type).toBe('object');
    expect(properties.projection.properties.mode.enum).toContain('isometric-2:1');
    expect(properties.projection.properties.anchor.enum).toContain('bottom-center');

    expect(properties).toHaveProperty('ambientSounds');
    expect(properties.ambientSounds.type).toBe('array');
    expect(properties.ambientSounds.items.type).toBe('string');

    expect(properties).toHaveProperty('music');
    expect(properties.music.type).toBe('string');

    expect(properties).toHaveProperty('nightMusic');
    expect(properties.nightMusic.type).toBe('string');
  });

  test('location metadata fields remain structurally safe if audio overrides are added later', () => {
    const world = loadJson(WORLD_FILE);

    Object.entries(world.locations || {}).forEach(([locationId, location]) => {
      if (Object.prototype.hasOwnProperty.call(location, 'music')) {
        expect(isNonEmptyString(location.music)).toBe(true);
      }

      if (Object.prototype.hasOwnProperty.call(location, 'nightMusic')) {
        expect(isNonEmptyString(location.nightMusic)).toBe(true);
      }

      if (Object.prototype.hasOwnProperty.call(location, 'ambientSounds')) {
        expect(Array.isArray(location.ambientSounds)).toBe(true);
        expect(location.ambientSounds.length).toBeGreaterThan(0);
        location.ambientSounds.forEach((soundKey) => {
          expect(isNonEmptyString(soundKey)).toBe(true);
        });
      }

      expect(locationId).toBe(location.mapKey);
    });
  });
});
