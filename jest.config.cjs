/**
 * Jest Configuration
 * 
 * For unit testing game systems
 */

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: [
    'src/systems/**/*.js',
    'src/entities/**/*.js',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  
  // Mock Phaser since we're testing game logic, not rendering
  moduleNameMapper: {
    '^phaser$': '<rootDir>/tests/__mocks__/phaser.js'
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};


