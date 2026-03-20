const Phaser = require('phaser');
const fs = require('fs');
const path = require('path');

function loadQuestSystemClass() {
  const sourcePath = path.join(__dirname, '..', 'src', 'systems', 'QuestSystem.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transformed = `${source.replace('export default class QuestSystem', 'class QuestSystem')}\nmodule.exports = QuestSystem;\n`;
  const moduleProxy = { exports: {} };
  const evaluator = new Function('module', 'exports', transformed);
  evaluator(moduleProxy, moduleProxy.exports);
  return moduleProxy.exports;
}

const QuestSystem = loadQuestSystemClass();

const questIndex = {
  quests: ['test-quest', 'follow-up-quest'],
};

const testQuest = {
  id: 'test-quest',
  name: 'Test Quest',
  description: 'A quest used to validate runtime behavior.',
  giver: 'test-npc',
  triggerTopic: 'start',
  stages: [
    {
      id: 'start',
      description: 'Start stage',
      objectives: [
        { id: 'talk-start', type: 'talk', target: 'test-npc', topic: 'start', completed: false },
      ],
      journalEntry: 'Quest started.',
      nextStage: 'payment',
    },
    {
      id: 'payment',
      description: 'Payment stage',
      objectives: [
        { id: 'pay-amount', type: 'pay', target: 'test-npc', amount: 20, completed: false },
      ],
      journalEntry: 'Need to pay 20 cruzados.',
      nextStage: 'complete',
    },
    {
      id: 'complete',
      description: 'Quest complete',
      objectives: [],
      journalEntry: 'Quest complete.',
      reward: {
        items: ['reward-item'],
        money: 15,
      },
    },
  ],
};

const followUpQuest = {
  id: 'follow-up-quest',
  name: 'Follow-up Quest',
  description: 'Requires test-quest completion.',
  giver: 'test-npc',
  triggerTopic: 'follow-up',
  prerequisites: ['test-quest'],
  stages: [
    {
      id: 'start',
      description: 'Follow-up start',
      objectives: [{ id: 'talk-follow-up', type: 'talk', target: 'test-npc', topic: 'follow-up', completed: false }],
      journalEntry: 'Follow-up started.',
    },
  ],
};

function createMockSceneWithQuests() {
  const scene = Phaser.createMockScene();

  scene.cache.json.get = jest.fn((key) => {
    if (key === 'quest-index') return questIndex;
    if (key === 'quest-test-quest') return testQuest;
    if (key === 'quest-follow-up-quest') return followUpQuest;
    return null;
  });

  scene.inventory = {
    addItem: jest.fn(),
    addMoney: jest.fn(),
    removeItemById: jest.fn(),
  };

  scene.timeSystem = {
    getTimeString: jest.fn().mockReturnValue('12:00'),
  };

  return scene;
}

describe('QuestSystem Runtime', () => {
  test('loads quest definitions from cache index', () => {
    const scene = createMockSceneWithQuests();
    const questSystem = new QuestSystem(scene);

    expect(Object.keys(questSystem.questDefinitions).sort()).toEqual(['follow-up-quest', 'test-quest']);
  });

  test('starts quest and records journal + active state', () => {
    const scene = createMockSceneWithQuests();
    const questSystem = new QuestSystem(scene);

    const started = questSystem.startQuest('test-quest');

    expect(started).toBe(true);
    expect(questSystem.isQuestActive('test-quest')).toBe(true);
    expect(questSystem.getCurrentObjectives('test-quest')).toHaveLength(1);
    expect(questSystem.getJournal().length).toBeGreaterThan(0);
  });

  test('topic event starts quest from trigger topic', () => {
    const scene = createMockSceneWithQuests();
    const questSystem = new QuestSystem(scene);

    scene.events.emit('topicDiscussed', { npcId: 'test-npc', topic: 'start' });

    expect(questSystem.isQuestActive('test-quest')).toBe(true);
  });

  test('completes talk objective and advances to next stage', () => {
    const scene = createMockSceneWithQuests();
    const questSystem = new QuestSystem(scene);
    questSystem.startQuest('test-quest');

    const completed = questSystem.checkObjective('test-quest', 'talk', 'test-npc', { topic: 'start' });
    const stage = questSystem.getQuestStage('test-quest');

    expect(completed).toBe(true);
    expect(stage.id).toBe('payment');
  });

  test('payment objective enforces amount threshold', () => {
    const scene = createMockSceneWithQuests();
    const questSystem = new QuestSystem(scene);
    questSystem.startQuest('test-quest');
    questSystem.checkObjective('test-quest', 'talk', 'test-npc', { topic: 'start' });

    const insufficient = questSystem.checkObjective('test-quest', 'pay', 'test-npc', { amount: 10 });
    const sufficient = questSystem.checkObjective('test-quest', 'pay', 'test-npc', { amount: 20 });

    expect(insufficient).toBe(false);
    expect(sufficient).toBe(true);
  });

  test('completing quest grants rewards and moves to completed list', () => {
    const scene = createMockSceneWithQuests();
    const questSystem = new QuestSystem(scene);
    questSystem.startQuest('test-quest');
    questSystem.checkObjective('test-quest', 'talk', 'test-npc', { topic: 'start' });
    questSystem.checkObjective('test-quest', 'pay', 'test-npc', { amount: 20 });

    expect(questSystem.isQuestActive('test-quest')).toBe(false);
    expect(questSystem.isQuestCompleted('test-quest')).toBe(true);
    expect(scene.inventory.addItem).toHaveBeenCalledWith('reward-item');
    expect(scene.inventory.addMoney).toHaveBeenCalledWith(15);
  });

  test('enforces quest prerequisites', () => {
    const scene = createMockSceneWithQuests();
    const questSystem = new QuestSystem(scene);

    const beforeCompletion = questSystem.startQuest('follow-up-quest');

    questSystem.startQuest('test-quest');
    questSystem.checkObjective('test-quest', 'talk', 'test-npc', { topic: 'start' });
    questSystem.checkObjective('test-quest', 'pay', 'test-npc', { amount: 20 });

    const afterCompletion = questSystem.startQuest('follow-up-quest');

    expect(beforeCompletion).toBe(false);
    expect(afterCompletion).toBe(true);
  });

  test('save/load roundtrip restores active/completed/journal state', () => {
    const scene = createMockSceneWithQuests();
    const questSystem = new QuestSystem(scene);
    questSystem.startQuest('test-quest');
    questSystem.checkObjective('test-quest', 'talk', 'test-npc', { topic: 'start' });

    const snapshot = questSystem.save();

    const freshScene = createMockSceneWithQuests();
    const restored = new QuestSystem(freshScene);
    restored.load(snapshot);

    expect(restored.isQuestActive('test-quest')).toBe(true);
    expect(restored.isQuestCompleted('test-quest')).toBe(false);
    expect(restored.getJournal().length).toBe(snapshot.journal.length);
  });
});
