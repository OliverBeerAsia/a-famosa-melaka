const fs = require('fs');
const path = require('path');

const QUEST_DIR = path.join(__dirname, '..', 'src', 'data', 'quests');
const NPC_FILE = path.join(__dirname, '..', 'src', 'data', 'npcs.json');
const MARKER_FILE = path.join(__dirname, '..', 'src', 'data', 'objective-markers.json');

const RUNTIME_NPC_LOCATIONS = {
  'mak-enang': 'kampung',
};

function loadQuests() {
  return fs.readdirSync(QUEST_DIR)
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .map((file) => JSON.parse(fs.readFileSync(path.join(QUEST_DIR, file), 'utf8')));
}

describe('Objective Marker Coverage', () => {
  test('all required quest objective targets have marker anchors', () => {
    const quests = loadQuests();
    const markerData = JSON.parse(fs.readFileSync(MARKER_FILE, 'utf8'));
    const anchors = markerData.anchors || {};
    const npcs = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8'));
    const npcLocations = {};

    Object.entries(npcs).forEach(([id, npc]) => {
      npcLocations[id] = npc.location;
    });
    Object.entries(RUNTIME_NPC_LOCATIONS).forEach(([id, location]) => {
      npcLocations[id] = location;
    });

    const missing = [];

    quests.forEach((quest) => {
      (quest.stages || []).forEach((stage) => {
        (stage.objectives || []).forEach((objective) => {
          if (objective.completed) return;

          if (['talk', 'give', 'pay'].includes(objective.type) && objective.target) {
            const locationId = npcLocations[objective.target];
            if (!locationId) {
              missing.push(`${quest.id}:${stage.id}:${objective.type} target npc missing location: ${objective.target}`);
              return;
            }
            if (!anchors[locationId] || !anchors[locationId][`npc:${objective.target}`]) {
              missing.push(`${quest.id}:${stage.id}:${objective.type} missing anchor npc:${objective.target} @ ${locationId}`);
            }
            return;
          }

          if (['location', 'go', 'explore'].includes(objective.type) && objective.target) {
            if (!anchors[objective.target] || !anchors[objective.target][`location:${objective.target}`]) {
              missing.push(`${quest.id}:${stage.id}:${objective.type} missing anchor location:${objective.target}`);
            }
            return;
          }

          if (['search', 'stealth'].includes(objective.type) && objective.target) {
            const hasAnchor = Object.values(anchors).some((locationAnchors) =>
              Boolean(locationAnchors[`poi:${objective.target}`])
            );
            if (!hasAnchor) {
              missing.push(`${quest.id}:${stage.id}:${objective.type} missing anchor poi:${objective.target}`);
            }
            return;
          }

          if (objective.type === 'escort' && objective.target) {
            const hasEscortTargetAnchor = Object.values(anchors).some((locationAnchors) =>
              Boolean(locationAnchors[`poi:${objective.target}`])
            );
            if (!hasEscortTargetAnchor) {
              missing.push(`${quest.id}:${stage.id}:escort missing target anchor poi:${objective.target}`);
            }

            if (objective.destination) {
              if (!anchors[objective.destination] || !anchors[objective.destination][`location:${objective.destination}`]) {
                missing.push(`${quest.id}:${stage.id}:escort missing destination anchor location:${objective.destination}`);
              }
            }
          }
        });
      });
    });

    expect(missing).toEqual([]);
  });
});
