/**
 * Phaser Mock for Jest Testing
 * 
 * Provides minimal mock implementations for testing game systems
 * without requiring actual Phaser rendering
 */

class MockScene {
  constructor() {
    this.cache = {
      json: {
        get: jest.fn().mockReturnValue(null)
      }
    };
    this.events = new MockEventEmitter();
    this.registry = new MockRegistry();
    this.time = {
      delayedCall: jest.fn()
    };
  }
}

class MockEventEmitter {
  constructor() {
    this.listeners = {};
  }
  
  on(event, callback, context) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push({ callback, context });
    return this;
  }
  
  off(event, callback, context) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        l => l.callback !== callback || l.context !== context
      );
    }
    return this;
  }
  
  emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(l => {
        l.callback.apply(l.context, args);
      });
    }
    return true;
  }
}

class MockRegistry {
  constructor() {
    this.data = {};
  }
  
  get(key) {
    return this.data[key];
  }
  
  set(key, value) {
    this.data[key] = value;
    return this;
  }
}

// Export mock Phaser
module.exports = {
  Scene: MockScene,
  Game: jest.fn(),
  AUTO: 'AUTO',
  Scale: {
    FIT: 'FIT',
    CENTER_BOTH: 'CENTER_BOTH'
  },
  Input: {
    Keyboard: {
      KeyCodes: {
        SPACE: 32,
        W: 87,
        A: 65,
        S: 83,
        D: 68
      }
    }
  },
  
  // Helper to create mock scene for tests
  createMockScene: () => new MockScene()
};


