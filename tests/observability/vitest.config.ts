import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'observability-tests',
    include: ['**/*.test.ts'],
  },
});
