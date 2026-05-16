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

describe('AI API', () => {
  it('POST /v1/ai/completions records a run and returns text', async () => {
    const res = await call('/v1/ai/completions', {
      method: 'POST',
      body: JSON.stringify({
        surface: 'writer',
        model: 'default',
        messages: [{ role: 'user', content: 'Write me a haiku' }],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; text: string; tokens_in: number };
    expect(body.object).toBe('ai_completion');
    expect(body.text).toContain('haiku');
    expect(body.tokens_in).toBeGreaterThan(0);

    const runs = await listWorkspaceAIRuns(h.handle.db, h.workspaceId);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.surface).toBe('writer');
  });

  it('POST /v1/ai/qa returns answer + sources', async () => {
    // Seed a block with the query word.
    await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { type: 'text', text: { content: 'apollo program details', link: null } },
              ],
              color: 'default',
            },
          },
        ],
      }),
    });

    const res = await call('/v1/ai/qa', {
      method: 'POST',
      body: JSON.stringify({ query: 'apollo' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; answer: string; sources: unknown[] };
    expect(body.object).toBe('ai_answer');
    expect(body.sources.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /v1/ai/autofill/run mutates a writeable property', async () => {
    // Create a database with a rich_text property and a row.
    const dbRes = await call('/v1/databases', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: h.page.id },
        properties: {
          Name: { type: 'title', title: {} },
          Notes: { type: 'rich_text', rich_text: {} },
        },
      }),
    });
    const dbBody = (await dbRes.json()) as {
      id: string;
      properties: Record<string, { id: string }>;
    };
    const rowRes = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'database_id', database_id: dbBody.id },
        properties: {
          Name: { title: [{ type: 'text', text: { content: 'r1', link: null } }] },
        },
      }),
    });
    const { id: rowId } = (await rowRes.json()) as { id: string };
    const autofill = await call('/v1/ai/autofill/run', {
      method: 'POST',
      body: JSON.stringify({
        page_id: rowId,
        property_id: dbBody.properties['Notes']!.id,
      }),
    });
    expect(autofill.status).toBe(200);
    const body = (await autofill.json()) as { type: string; rich_text: { plain_text: string }[] };
    expect(body.type).toBe('rich_text');
    expect(body.rich_text.length).toBeGreaterThan(0);
  });

  it('rejects autofill on a read-only property type', async () => {
    const dbRes = await call('/v1/databases', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: h.page.id },
        properties: {
          Name: { type: 'title', title: {} },
          Created: { type: 'created_time', created_time: {} },
        },
      }),
    });
    const dbBody = (await dbRes.json()) as {
      id: string;
      properties: Record<string, { id: string }>;
    };
    const rowRes = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'database_id', database_id: dbBody.id },
        properties: {
          Name: { title: [{ type: 'text', text: { content: 'r1', link: null } }] },
        },
      }),
    });
    const { id: rowId } = (await rowRes.json()) as { id: string };
    const res = await call('/v1/ai/autofill/run', {
      method: 'POST',
      body: JSON.stringify({
        page_id: rowId,
        property_id: dbBody.properties['Created']!.id,
      }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects malformed completions body', async () => {
    const res = await call('/v1/ai/completions', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('persists completion output back to an ai_block when block_id is provided', async () => {
    const append = await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            type: 'ai_block',
            ai_block: {
              prompt: [{ type: 'text', text: { content: 'haiku?', link: null } }],
              output: [],
              model: 'default',
            },
          },
        ],
      }),
    });
    expect(append.status).toBe(200);
    const { results } = (await append.json()) as { results: { id: string; type: string }[] };
    const blockId = results[0]!.id;

    const completion = await call('/v1/ai/completions', {
      method: 'POST',
      body: JSON.stringify({
        surface: 'ai_block',
        block_id: blockId,
        model: 'default',
        messages: [{ role: 'user', content: 'write a haiku' }],
      }),
    });
    expect(completion.status).toBe(200);

    const fetched = await call(`/v1/blocks/${blockId}`);
    const block = (await fetched.json()) as {
      ai_block: { output: { plain_text: string }[]; last_run_at: string; model: string };
    };
    expect(block.ai_block.output.length).toBeGreaterThan(0);
    expect(block.ai_block.last_run_at).toMatch(/^\d{4}/);
    expect(block.ai_block.model).toBe('default');
  });

  it('rejects ai_block completion against a non-ai_block', async () => {
    const append = await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            type: 'paragraph',
            paragraph: { rich_text: [], color: 'default' },
          },
        ],
      }),
    });
    const { results } = (await append.json()) as { results: { id: string }[] };
    const blockId = results[0]!.id;

    const res = await call('/v1/ai/completions', {
      method: 'POST',
      body: JSON.stringify({
        surface: 'ai_block',
        block_id: blockId,
        model: 'default',
        messages: [{ role: 'user', content: 'try' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects ai_block completion with unknown block id', async () => {
    const res = await call('/v1/ai/completions', {
      method: 'POST',
      body: JSON.stringify({
        surface: 'ai_block',
        block_id: '00000000-0000-0000-0000-000000000000',
        model: 'default',
        messages: [{ role: 'user', content: 'try' }],
      }),
    });
    expect(res.status).toBe(404);
  });
});
