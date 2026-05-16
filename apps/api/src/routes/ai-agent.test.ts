import { listWorkspaceAIRuns } from '@bloc/db';
import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type TestHarness, bootTestHarness, closeHarness } from '../test-helpers.ts';

let h: TestHarness;

beforeEach(async () => {
  h = await bootTestHarness();
});
afterEach(async () => {
  await closeHarness(h);
});

const BASE = 'http://test.local';

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', h.bearer);
  headers.set('notion-version', LATEST_VERSION);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  return h.app.request(BASE + path, { ...init, headers });
}

describe('AI agent endpoint', () => {
  it('runs the bounded loop and returns success with at least one step', async () => {
    const res = await call('/v1/ai/agent', {
      method: 'POST',
      body: JSON.stringify({ goal: 'summarise the workspace', max_iterations: 3 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      task_id: string;
      status: string;
      steps: { index: number; type: string; status: string }[];
      message: string;
    };
    expect(body.object).toBe('agent_run');
    expect(body.task_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.status).toBe('success');
    expect(body.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('records an ai_run row', async () => {
    await call('/v1/ai/agent', {
      method: 'POST',
      body: JSON.stringify({ goal: 'do something', max_iterations: 2 }),
    });
    const runs = await listWorkspaceAIRuns(h.handle.db, h.workspaceId);
    expect(runs.some((r) => r.surface === 'agent')).toBe(true);
  });

  it('rejects missing goal', async () => {
    const res = await call('/v1/ai/agent', { method: 'POST', body: JSON.stringify({}) });
    expect(res.status).toBe(400);
  });

  it('rejects max_iterations > 10', async () => {
    const res = await call('/v1/ai/agent', {
      method: 'POST',
      body: JSON.stringify({ goal: 'x', max_iterations: 99 }),
    });
    expect(res.status).toBe(400);
  });
});
