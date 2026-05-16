import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'sdk-progressive', include: ['**/*.test.ts'] },
});
