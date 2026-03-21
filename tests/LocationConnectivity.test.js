const fs = require('fs');
const path = require('path');

const LOCATION_FILE = path.join(__dirname, '..', 'src', 'data', 'location-scenes.json');

function loadLocations() {
  return JSON.parse(fs.readFileSync(LOCATION_FILE, 'utf8'));
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function collectReachableLocations(locations, startLocationId) {
  const visited = new Set();
  const queue = [startLocationId];

  while (queue.length > 0) {
    const locationId = queue.shift();
    if (!locationId || visited.has(locationId)) continue;
    visited.add(locationId);

    const location = locations[locationId];
    if (!location) continue;

    (location.transitions || []).forEach((transition) => {
      if (transition?.targetLocation && locations[transition.targetLocation]) {
        queue.push(transition.targetLocation);
      }
    });
  }

  return visited;
}

describe('Location connectivity', () => {
  test('all slice transitions point to valid destinations with usable geometry', () => {
    const locations = loadLocations();
    const locationIds = new Set(Object.keys(locations));
    const problems = [];

    Object.entries(locations).forEach(([locationId, location]) => {
      if (!Array.isArray(location.transitions) || location.transitions.length === 0) {
        problems.push(`${locationId}: missing transitions`);
        return;
      }

      const labels = new Set();

      location.transitions.forEach((transition, index) => {
        const context = `${locationId}:transition[${index}]`;

        if (!transition || typeof transition !== 'object') {
          problems.push(`${context}: malformed transition`);
          return;
        }

        if (!transition.targetLocation || !locationIds.has(transition.targetLocation)) {
          problems.push(`${context}: unknown target location ${transition.targetLocation}`);
        }

        if (typeof transition.label !== 'string' || transition.label.trim().length === 0) {
          problems.push(`${context}: missing label`);
        } else if (labels.has(transition.label)) {
          problems.push(`${context}: duplicate label ${transition.label}`);
        } else {
          labels.add(transition.label);
        }

        const { triggerArea, spawnAt } = transition;
        if (!triggerArea || !isNumber(triggerArea.x) || !isNumber(triggerArea.y) || !isNumber(triggerArea.width) || !isNumber(triggerArea.height)) {
          problems.push(`${context}: invalid triggerArea`);
        } else if (triggerArea.width <= 0 || triggerArea.height <= 0) {
          problems.push(`${context}: triggerArea must have positive size`);
        }

        if (spawnAt) {
          if (!isNumber(spawnAt.x) || !isNumber(spawnAt.y)) {
            problems.push(`${context}: invalid spawnAt`);
          }
        }
      });
    });

    expect(problems).toEqual([]);
  });

  test('rua-direita reaches every slice location and all links are reciprocal', () => {
    const locations = loadLocations();
    const rootLocationId = 'rua-direita';
    const reachable = collectReachableLocations(locations, rootLocationId);
    const locationIds = Object.keys(locations).sort();
    const unreachable = locationIds.filter((locationId) => !reachable.has(locationId));
    const missingReverseLinks = [];

    Object.entries(locations).forEach(([sourceId, location]) => {
      (location.transitions || []).forEach((transition) => {
        const targetLocation = locations[transition.targetLocation];
        const reverseExists = Boolean(
          targetLocation
          && Array.isArray(targetLocation.transitions)
          && targetLocation.transitions.some((reverseTransition) => reverseTransition.targetLocation === sourceId)
        );

        if (!reverseExists) {
          missingReverseLinks.push(`${sourceId} -> ${transition.targetLocation}`);
        }
      });
    });

    expect(unreachable).toEqual([]);
    expect(missingReverseLinks).toEqual([]);
    expect([...reachable].sort()).toEqual(locationIds);
  });

  test('the A Famosa <-> Waterfront service route stays visible but locked behind customs world state', () => {
    const locations = loadLocations();
    const routePairs = [
      ['a-famosa-gate', 'waterfront'],
      ['waterfront', 'a-famosa-gate'],
    ];

    routePairs.forEach(([sourceId, targetId]) => {
      const transition = (locations[sourceId].transitions || []).find((entry) => entry.targetLocation === targetId);

      expect(transition).toBeTruthy();
      expect(transition.showWhenLocked).toBe(true);
      expect(typeof transition.lockedLabel).toBe('string');
      expect(transition.lockedLabel.length).toBeGreaterThan(0);
      expect(typeof transition.blockedMessage).toBe('string');
      expect(transition.blockedMessage.length).toBeGreaterThan(0);
      expect(Array.isArray(transition.requirements?.worldFlagsAny)).toBe(true);
      expect(transition.requirements.worldFlagsAny.length).toBeGreaterThan(0);
    });
  });
});
