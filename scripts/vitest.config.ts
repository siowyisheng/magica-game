// Config for the headless analysis scripts (not part of `npm test`).
import { defineConfig } from 'vite';

export default defineConfig({
  test: { include: ['scripts/**/*.run.ts'], testTimeout: 30 * 60 * 1000 },
} as never);
