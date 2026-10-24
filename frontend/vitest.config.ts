import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      // Previously only components were measured. Pages now included since
      // they carry virtually all business logic and user-facing interactions.
      include: [
        'src/components/**/*.{ts,tsx}',
        'src/pages/**/*.{ts,tsx}',
        'src/core/**/*.{ts,tsx}',
        'src/store/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/test/**',
      ],
      thresholds: {
        statements: 50,
        branches: 39,
        functions: 35,
        lines: 50,
      },
      reporter: ['text', 'json', 'html'],
    },
  },
});
