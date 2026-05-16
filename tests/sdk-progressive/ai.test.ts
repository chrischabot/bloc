import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { Bloc } from '@bloc/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let h: TestHarness;

beforeEach(async () => {
  h = await bootTestHarness();
});
afterEach(async () => {
  await closeHarness(h);
});

const BASE = 'http://test.local';

function makeClient(): Bloc {
  return new Bloc({
    auth: h.bearer,
    baseUrl: BASE,
    fetch: async (input, init) =>
      h.app.request(typeof input === 'string' ? input : input.toString(), init ?? {}),
  });
}

describe('SDK-progressive: AI namespace', () => {
  it('completions returns ai_completion text', async () => {
    const client = makeClient();
    const result = await client.ai.completions({
      surface: 'writer',
      model: 'default',
      messages: [{ role: 'user', content: 'haiku please' }],
    });
    expect(result.object).toBe('ai_completion');
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.tokens_in).toBeGreaterThan(0);
  });

  it('qa returns answer and sources', async () => {
    const client = makeClient();
    const result = await client.ai.qa({ query: 'what is this' });
    expect(result.object).toBe('ai_answer');
    expect(Array.isArray(result.sources)).toBe(true);
  });

  it('completions with block_id persists output to an ai_block', async () => {
    const client = makeClient();
    // Seed an ai_block.
    const appended = await client.blocks.children.append({
      block_id: h.page.id,
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
    });
    const blockId = appended.results[0]!.id;
    await client.ai.completions({
      surface: 'ai_block',
      model: 'default',
      block_id: blockId,
      messages: [{ role: 'user', content: 'write me a haiku about typescript' }],
    });
    const retrieved = (await client.blocks.retrieve({ block_id: blockId })) as unknown as {
      ai_block: { output: { plain_text: string }[]; last_run_at: string };
    };
    expect(retrieved.ai_block.output.length).toBeGreaterThan(0);
    expect(retrieved.ai_block.last_run_at).toMatch(/^\d{4}/);
  });

  it('autofillRun writes a generated value into a writeable property', async () => {
    const client = makeClient();
    const db = await client.databases.create({
      parent: { type: 'page_id', page_id: h.page.id },
      properties: {
        Name: { type: 'title', title: {} },
        Notes: { type: 'rich_text', rich_text: {} },
      },
    });
    const props = db.properties as Record<string, { id: string }>;
    const row = await client.pages.create({
      parent: { type: 'database_id', database_id: db.id },
      properties: {
        Name: { title: [{ type: 'text', text: { content: 'row1', link: null } }] },
      },
    });
    const result = await client.ai.autofillRun({
      page_id: row.id,
      property_id: props['Notes']!.id,
      instructions: 'summarise the row in one line',
    });
    expect(result.object).toBe('property_item');
    expect(result.type).toBe('rich_text');
  });
});
