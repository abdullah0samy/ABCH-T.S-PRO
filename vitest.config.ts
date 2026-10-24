import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 50,
        branches: 39,
        functions: 35,
        lines: 50,
      },
      include: [
        'backend/src/common/**/*.ts',
        'backend/src/core/**/*.ts',
        'backend/src/gateways/**/*.ts',
        'backend/src/modules/**/*.ts',
        'frontend/src/components/**/*.tsx',
      ],
      exclude: [
        'backend/src/**/*.d.ts',
        'backend/src/**/*.test.ts',
        'backend/src/**/*.spec.ts',
        'backend/src/core/paths.ts',
        'frontend/src/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
