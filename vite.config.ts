import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Dev-server endpoint for the in-game dev tool: POST /__magica/overrides
 * writes the balance overrides to src/rules/data/overrides.json. Only exists
 * while running `npm run dev`.
 */
function balanceWriter(): Plugin {
  const target = fileURLToPath(new URL('./src/rules/data/overrides.json', import.meta.url));
  return {
    name: 'magica-balance-writer',
    configureServer(server) {
      server.middlewares.use('/__magica/overrides', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('expected an object of overrides');
            writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
            res.statusCode = 200;
            res.end('ok');
          } catch (e) {
            res.statusCode = 400;
            res.end(String((e as Error).message));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), balanceWriter()],
  test: {
    include: ['src/**/*.test.ts'],
  },
} as never);
