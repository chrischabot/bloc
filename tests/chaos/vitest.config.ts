import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'chaos', include: ['**/*.test.ts'] },
});
