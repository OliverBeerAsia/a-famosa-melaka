import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest harness.
 *
 * Replaces the old jest setup (which targeted the now-deleted parallel JS
 * codebase). Two kinds of suites run here:
 *  - `tests/*.test.js`  — data-integrity / asset-validation suites (plain
 *    node assertions over JSON + PNG files, no DOM needed).
 *  - `src/**\/*.test.ts` — unit tests for engine modules (core/depth, core/
 *    LocationData, ...) written in TypeScript and imported directly.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{js,ts}', 'src/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.js'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@phaser': path.resolve(__dirname, 'src/phaser'),
      '@data': path.resolve(__dirname, 'src/data'),
    },
  },
});
