import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // e2e/ son specs de Playwright (otro test runner, otra API de
    // test.describe) — sin esto Vitest también los recoge y explota.
    exclude: ['node_modules/**', 'e2e/**'],
  },
});
