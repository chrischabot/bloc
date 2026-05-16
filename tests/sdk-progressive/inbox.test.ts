import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { addMember, createUser } from '@bloc/db';
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

function makeClient(bearer = h.bearer): Bloc {
  return new Bloc({
    auth: bearer,
    baseUrl: BASE,
    fetch: async (input, init) =>
      h.app.request(typeof input === 'string' ? input : input.toString(), init ?? {}),
  });
}

describe('SDK-progressive: inbox namespace', () => {
  it('list returns an empty feed for a fresh actor', async () => {
    const result = await makeClient().inbox.list();
    expect(result.object).toBe('list');
    expect(result.type).toBe('inbox_entry');
    expect(result.results).toHaveLength(0);
  });

  it('list returns a comment by another user on a page the actor created', async () => {
    const client = makeClient();
    const other = await createUser(h.handle.db, {
      email: `o${Date.now()}@local`,
      type: 'person',
    });
    await addMember(h.handle.db, { workspaceId: h.workspaceId, userId: other.id, role: 'member' });
    await client.permissions.grant({
      page_id: h.page.id,
      grantee_type: 'user',
      grantee_id: other.id,
      level: 'can_comment',
    });
    const otherClient = makeClient(`Bearer test_${h.workspaceId}_${other.id}`);
    await otherClient.comments.create({
      parent: { page_id: h.page.id },
      rich_text: [{ type: 'text', text: { content: 'hi', link: null } }],
    });

    const inbox = await client.inbox.list({ kind: 'comment' });
    expect(inbox.results.some((e) => e.kind === 'comment')).toBe(true);
  });
});
