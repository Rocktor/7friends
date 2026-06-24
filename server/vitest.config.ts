import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('../engine/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    server: { deps: { external: ['node:sqlite'] } },
  },
  ssr: { external: ['node:sqlite'] },
});
