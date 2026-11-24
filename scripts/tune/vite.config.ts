// Bundles the tuner (with the game rules and AI) into one Node file: dist-tune/tune.mjs.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'scripts/tune/tune.ts',
    outDir: 'dist-tune',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: { output: { entryFileNames: 'tune.mjs' } },
  },
  ssr: { target: 'node' },
});
