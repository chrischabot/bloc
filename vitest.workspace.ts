import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/api',
  'apps/web',
  'apps/worker',
  'packages/shared',
  'packages/db',
  'packages/sdk',
  'packages/ai',
  'packages/ui',
  'packages/observability',
  'tests/contract',
  'tests/sdk-progressive',
  'tests/chaos',
  'tests/observability',
]);
