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

describe('SDK-progressive: comments reactions + resolve', () => {
  it('addReaction + removeReaction round-trip', async () => {
    const client = makeClient();
    const comment = await client.comments.create({
      parent: { page_id: h.page.id },
      rich_text: [{ type: 'text', text: { content: 'hello', link: null } }],
    });
    const reacted = await client.comments.addReaction({ comment_id: comment.id, emoji: '👍' });
    expect(reacted.reactions).toHaveLength(1);
    expect(reacted.reactions![0]!.emoji).toBe('👍');

    const removed = await client.comments.removeReaction({
      comment_id: comment.id,
      emoji: '👍',
    });
    expect(removed.reactions).toHaveLength(0);
  });

  it('addReaction is idempotent on the same emoji', async () => {
    const client = makeClient();
    const comment = await client.comments.create({
      parent: { page_id: h.page.id },
      rich_text: [{ type: 'text', text: { content: 'dup', link: null } }],
    });
    await client.comments.addReaction({ comment_id: comment.id, emoji: '🎉' });
    const second = await client.comments.addReaction({ comment_id: comment.id, emoji: '🎉' });
    expect(second.reactions).toHaveLength(1);
    expect(second.reactions![0]!.emoji).toBe('🎉');
    expect(second.reactions![0]!.count).toBe(1);
  });

  it('resolve marks the discussion resolved', async () => {
    const client = makeClient();
    const comment = await client.comments.create({
      parent: { page_id: h.page.id },
      rich_text: [{ type: 'text', text: { content: 'resolve me', link: null } }],
    });
    const resolved = await client.comments.resolve({ comment_id: comment.id });
    expect(resolved.object).toBe('discussion');
    expect(resolved.resolved).toBe(true);
    expect(resolved.id).toBe(comment.discussion_id);
  });
});
