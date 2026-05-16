import { appendChildren } from '@bloc/db';
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

describe('exports', () => {
  it('exports a page as markdown', async () => {
    await appendChildren(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      actor: h.userId,
      children: [
        {
          type: 'heading_1',
          content: {
            heading_1: {
              rich_text: [
                {
                  type: 'text',
                  text: { content: 'Hello', link: null },
                  plain_text: 'Hello',
                  href: null,
                  annotations: {},
                },
              ],
              color: 'default',
            },
          },
        },
        {
          type: 'paragraph',
          content: {
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: { content: 'Body text', link: null },
                  plain_text: 'Body text',
                  href: null,
                  annotations: {},
                },
              ],
              color: 'default',
            },
          },
        },
        {
          type: 'to_do',
          content: {
            to_do: {
              rich_text: [
                {
                  type: 'text',
                  text: { content: 'Buy milk', link: null },
                  plain_text: 'Buy milk',
                  href: null,
                  annotations: {},
                },
              ],
              checked: true,
              color: 'default',
            },
          },
        },
      ],
    });
    const res = await call(`/v1/pages/${h.page.id}/export?format=markdown`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const md = await res.text();
    expect(md).toContain('# Hello');
    expect(md).toContain('Body text');
    expect(md).toContain('- [x] Buy milk');
  });

  it('exports a page as json', async () => {
    const res = await call(`/v1/pages/${h.page.id}/export?format=json`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { object: string };
    expect(body.object).toBe('page');
  });

  it('rejects unsupported page format', async () => {
    const res = await call(`/v1/pages/${h.page.id}/export?format=docx`);
    expect(res.status).toBe(400);
  });

  it('404 on unknown page', async () => {
    const res = await call('/v1/pages/00000000-0000-0000-0000-000000000000/export?format=markdown');
    expect(res.status).toBe(404);
  });

  it('exports a database as csv', async () => {
    // Create a database with two columns and two rows.
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
    const dbBody = (await dbRes.json()) as { id: string };
    for (const [name, notes] of [
      ['Alpha', 'first'],
      ['Beta, comma', 'with "quotes"'],
    ]) {
      await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'database_id', database_id: dbBody.id },
          properties: {
            Name: { title: [{ type: 'text', text: { content: name, link: null } }] },
            Notes: { rich_text: [{ type: 'text', text: { content: notes, link: null } }] },
          },
        }),
      });
    }
    const exp = await call(`/v1/databases/${dbBody.id}/export?format=csv`);
    expect(exp.status).toBe(200);
    expect(exp.headers.get('content-type')).toContain('text/csv');
    const csv = await exp.text();
    expect(csv.split('\n')[0]).toBe('Name,Notes');
    expect(csv).toContain('Alpha,first');
    expect(csv).toContain('"Beta, comma","with ""quotes"""');
  });
});

describe('imports', () => {
  it('imports a markdown page', async () => {
    const md =
      '# Title\n\nSome **bold** text.\n\n## Subtitle\n\n- Item 1\n- Item 2\n\n1. Step one\n2. Step two\n\n- [x] done\n- [ ] todo\n\n> A quote.\n\n```js\nconst x = 1;\n```\n\n---\n';
    const res = await call('/v1/imports/markdown', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: h.page.id },
        title: 'My import',
        markdown: md,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      page_id: string;
      blocks_imported: number;
    };
    expect(body.object).toBe('import_result');
    expect(body.blocks_imported).toBeGreaterThanOrEqual(10);

    // Verify the page has child blocks.
    const children = await call(`/v1/blocks/${body.page_id}/children`);
    const childBody = (await children.json()) as { results: { type: string }[] };
    const types = childBody.results.map((b) => b.type);
    expect(types).toContain('heading_1');
    expect(types).toContain('bulleted_list_item');
    expect(types).toContain('to_do');
    expect(types).toContain('code');
  });

  it('imports a csv into a new database', async () => {
    const csv = 'Name,Status,Notes\nAlpha,Todo,first row\nBeta,Done,"second, with comma"\n';
    const res = await call('/v1/imports/csv', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: h.page.id },
        title: 'Imported',
        csv,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      database_id: string;
      rows_imported: number;
      columns: number;
    };
    expect(body.object).toBe('import_result');
    expect(body.rows_imported).toBe(2);
    expect(body.columns).toBe(3);

    // Query the database to verify rows landed.
    const query = await call(`/v1/databases/${body.database_id}/query`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const queryBody = (await query.json()) as { results: unknown[] };
    expect(queryBody.results).toHaveLength(2);
  });

  it('rejects markdown > 1MB', async () => {
    const huge = 'x'.repeat(1_048_577);
    const res = await call('/v1/imports/markdown', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'workspace', workspace: true },
        markdown: huge,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects empty csv', async () => {
    const res = await call('/v1/imports/csv', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: h.page.id },
        csv: '   ',
      }),
    });
    // Either 400 (validation) or our handler's 400 — both acceptable; never 5xx.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('round-trips: import markdown then export the resulting page contains the same content', async () => {
    const md = '# Heading\n\nA paragraph.\n\n- One\n- Two\n';
    const importRes = await call('/v1/imports/markdown', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'workspace', workspace: true },
        markdown: md,
      }),
    });
    const { page_id } = (await importRes.json()) as { page_id: string };
    const exp = await call(`/v1/pages/${page_id}/export?format=markdown`);
    const exported = await exp.text();
    expect(exported).toContain('# Heading');
    expect(exported).toContain('A paragraph.');
    expect(exported).toContain('- One');
    expect(exported).toContain('- Two');
  });
});
